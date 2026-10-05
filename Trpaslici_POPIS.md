# ⛰️ Srdce hory: kompletní popis hry

*Stránka `obsah/trpaslici.html`. Popis odpovídá kódu ke dni 5. 10. 2026 (uložení `VERZE 12`).*

Srdce hory je budovatelská strategie v **bočním řezu horou** s pixel artem. Klan sedmi trpaslíků
přichází k opuštěné hoře předků. Prokopává se do hloubky, staví síně, dílny a výrobní řetězce,
přežívá zimy, obchoduje s karavanami a brání se goblinům a tvorům z hlubin. V kampani je cílem
dokopat se ke **Srdci hory** a Klíčem ukovaným z hvězdné oceli znovu zažehnout **Výheň předků**.
Přitom se nesmí předčasně probudit **Pradávný spáč**.

Trpaslíky hráč neřídí přímo, řízení je nepřímé jako ve „zjednodušeném Dwarf Fortress“. Označuje,
co vykopat, kde postavit stavbu nebo zónu, zadává výrobní zakázky a nastavuje priority prací.
Trpaslíci si pak práci berou sami podle profese, vzdálenosti, priorit a svých potřeb.

---

## Obsah

1. [Základní parametry](#1-základní-parametry)
2. [Čas, kalendář a roční období](#2-čas-kalendář-a-roční-období)
3. [Hora: mapa, vrstvy, rudy a jeskyně](#3-hora-mapa-vrstvy-rudy-a-jeskyně)
4. [Začátek hry](#4-začátek-hry)
5. [Trpaslíci: profese, dovednosti, priority](#5-trpaslíci-profese-dovednosti-priority)
6. [Pohyb a cesty](#6-pohyb-a-cesty)
7. [Kopání, schodiště, otesání, kácení](#7-kopání-schodiště-otesání-kácení)
8. [Stavby](#8-stavby)
9. [Dílny, recepty a výroba](#9-dílny-recepty-a-výroba)
10. [Nástroje](#10-nástroje)
11. [Zóny, sklady a nošení](#11-zóny-sklady-a-nošení)
12. [Jídlo, pití, farmy](#12-jídlo-pití-farmy)
13. [Potřeby, zdraví a nálada](#13-potřeby-zdraví-a-nálada)
14. [Příroda hory: stabilita, voda, magma, světlo](#14-příroda-hory-stabilita-voda-magma-světlo)
15. [Sláva a milníky](#15-sláva-a-milníky)
16. [Karavana a obchod](#16-karavana-a-obchod)
17. [Migranti, hosté a velikost klanu](#17-migranti-hosté-a-velikost-klanu)
18. [Události s volbou](#18-události-s-volbou)
19. [Tvorové a nepřátelé](#19-tvorové-a-nepřátelé)
20. [Boj, strážci a obrana](#20-boj-strážci-a-obrana)
21. [Goblinní nájezdy](#21-goblinní-nájezdy)
22. [Příběh: ruiny, desky, artefakty, Klíč](#22-příběh-ruiny-desky-artefakty-klíč)
23. [Pradávný spáč a finále](#23-pradávný-spáč-a-finále)
24. [Konec hry, epilog, rekordy](#24-konec-hry-epilog-rekordy)
25. [Volný režim](#25-volný-režim)
26. [Nápověda „Co dál?“](#26-nápověda-co-dál)
27. [Automatika a záchranné mechanismy](#27-automatika-a-záchranné-mechanismy)
28. [Rozhraní](#28-rozhraní)
29. [Ovládání](#29-ovládání)
30. [Grafika a zvuk](#30-grafika-a-zvuk)
31. [Ukládání, adresa, offline](#31-ukládání-adresa-offline)
32. [Technické poznámky a testy](#32-technické-poznámky-a-testy)
33. [Rady pro hráče](#33-rady-pro-hráče)

---

## 1. Základní parametry

| | |
|---|---|
| Žánr | budovatelská strategie, kolonie, nepřímé řízení |
| Pohled | boční řez s gravitací, pixel art (16 × 16 px, jemný styl 32 × 32 px) |
| Mapa | šířka 64 / 96 / 128 / 160 polí (malá / střední / velká / obří), výška vždy 192 polí: 32 řádků nad údolím a 160 m pod ním |
| Čas | reálný s pauzou, rychlosti ⏸ / 1× / 2× / 4× |
| Režimy | 🔥 kampaň (cíl, Spáč, vítězství i prohra) · ♾️ volný režim (bez konce, sada cílů) |
| Klan | 7 trpaslíků na začátku, nejvýš 40 |
| Determinismus | celá hora i simulace vychází ze seedu, stejný seed dá stejnou horu |
| Platforma | prohlížeč (myš i dotyk, od šířky 320 px), funguje i offline a z `file://` |

---

## 2. Čas, kalendář a roční období

- **Tah** trvá 100 ms při rychlosti 1×, takže za sekundu proběhne 10 tahů. Za jeden snímek se provede nejvýš 40 tahů.
- **Den** má 600 tahů, tedy 1 minutu při 1×. Den začíná v 6:00 a herní hodina má 25 tahů.
- **Rok** má 4 období po 12 dnech, celkem 48 dní (48 minut při 1×).
- **Denní světlo** venku:
  - 7–19 h: plné,
  - 5–7 h: svítá,
  - 19–21 h: stmívá se,
  - v noci: 0,3.
- Trpaslíci jedí a spí **podle potřeby**, ne podle denní doby.

| období | ikona | růst ječmene (za 30 tahů) | zvláštnosti |
|---|---|---|---|
| jaro | 🌸 | 3 | migranti, karavana 8. den |
| léto | ☀️ | 4 | migranti, ječmen roste nejrychleji |
| podzim | 🍂 | 2 | migranti, karavana 6. den (30. den roku), pole se sklízí vždy |
| zima | ❄️ | 0 | viz níže |

**Zima:**
- Mráz na začátku zimy spálí úrodu na polích.
- Pole se neseje ani nesklízí.
- Potok pod širým nebem zamrzne. Pít se z něj dá dál, ale déle (prosekat led trvá 45 tahů místo 25) a za horší vzpomínku (−9).
- Stromy nedorůstají. Obří houby rostou dál.
- Spotřeba jídla je ×1,2.
- Kdo je venku a nespí, dostane náladu „mrzne venku“ (−3).
- Mělké houbárny (do 12 m) rostou pomaleji.
- Nepřichází migranti.

Na začátku každého období se vynuluje počítadlo záchvatů vzteku (viz [13](#13-potřeby-zdraví-a-nálada)).

---

## 3. Hora: mapa, vrstvy, rudy a jeskyně

### Povrch
- **Údolí** leží vlevo. Je v něm les (jedle), louka s trávou a keři a potok o 3 polích. Potok se dá brodit.
- **Brána předků** je v kolmé skalní stěně. Za ní leží vykopaná **předsíň** 6 × 3 pole ze zdiva předků, která je zároveň výchozím skladem.
- **Hora** má vrchol 22–27 polí nad údolím. Na svazích rostou stromy a leží balvany, nad sněžnou čarou jsou jen balvany.
- Okraje mapy a dva spodní řádky tvoří **kořen hory**, který se nedá prokopat.

### Vrstvy pod údolím
Hranice vrstev jsou vlnité, ±4,5 m.

| hloubka | hornina | tvrdost | strop unese (polí) | co v ní je |
|---|---|---|---|---|
| 0–20 m | hlína (místy jíl) | 1 | 3 | jíl → cihly do budoucna, snadné kopání |
| 20–50 m | vápenec | 2 | 5 | uhlí, krápníkové jeskyně, prameny |
| 50–90 m | žula | 4 | 9 | železo, měď, jeskyně s pavouky |
| 90–130 m | čedič | 4 | 7 | stříbro, zlato, drahokamy, houbové jeskyně, podzemní jezero, ruiny |
| 130–160 m | hlubinný kámen | 5 | 8 | magma, hvězdná ruda, goblinní tunel, Srdce hory |

Další materiály:

| materiál | tvrdost | strop unese (polí) |
|---|---|---|
| zdivo předků | 3 | 12 |
| runová zeď | 6 | 20 |
| kamenná zeď (otesaná) | 2 | 10 |
| suť po závalu | 1 | 2 |
| obsidián | 6 | 15 |

**Co padá při kopání:**
- hlína nedá nic,
- jíl dá jíl s pravděpodobností 50 %,
- vápenec, žula, čedič a hlubinný kámen dají kámen s pravděpodobností 35 %,
- zdivo dá kámen s pravděpodobností 60 %,
- runová zeď, suť a obsidián dají kámen s pravděpodobností 50 %,
- kamenná zeď dá kámen vždy,
- pole s rudou dá vždy 1 kus rudy, a to místo kamene.

### Rudy (žíly jako náhodné procházky)

| ruda | hloubka | žil (střední hora) | zaručeno |
|---|---|---|---|
| uhlí | −12 až 60 m (+ hlubší žíly 40–110 m) | 16 + 5–7 | žíla hned u brány (hloubka −3 až 8) |
| měď | 38–95 m | 8 | – |
| železo | 48–105 m | 11 | žíla v 47–53 m blízko brány |
| zlato | 80–140 m | 6 | žíla v 84–96 m v dosahu brány + poklad v Síni předků |
| stříbro | 88–135 m | 6 | – |
| drahokamy | 95–152 m | 14 (krátké) | – |
| hvězdná ruda | 126–156 m | 3 | žíla nad Srdcem v 126–134 m, **vždy aspoň 10 kusů nad 138 m** |

Na jiných velikostech hory se počet žil a jeskyní násobí šířkou hory / 96.

### Jeskyně
Jeskyně jsou uzavřené, dokud do nich klan neprokope. **Prokopnutí do jeskyně je rozhodnutí**: přinese suroviny, ale probudí tvory.

| typ | hloubka | obsah |
|---|---|---|
| krápníková | 22–48 m | krápníky, netopýři |
| obyčejná | 55–86 m | netopýři, obří pavouci |
| podzemní jezero | 95–124 m | voda |
| houbová | 93–126 m | obří houby (jídlo i dřevo), někdy pavouk |
| hlubinná | 132–150 m | krystaly, pavouci |

### Zvláštní místa
- **Strážnice** (60–125 m): malá ruina s runovou deskou.
- **Síň předků** (98–122 m): ruina 19 × 6 se sloupy, runovou deskou a pokladem (3 zlata, 2 drahokamy).
- **Goblinní tunel** (134–152 m): vede od okraje mapy, je dlouhý 45–70 polí a vysoký 2 pole. Sídlí v něm goblini.
- **Magmatické kapsy** (2–4, od 138 m).
- **Srdce hory** (143–150 m): síň 15 × 6 z runové zdi se sloupy a **Výhní předků**. Podstavec Výhně se nedá vykopat.

### Viditelnost
Nevykopaná hora je skrytá. Vidět je jen to, co je vidět z oblohy, a pevná pole kolem vykopaného prostoru.
Prokopnutí do jeskyně odhalí celou jeskyni. Parametr `?ladeni` ukáže celou horu.

---

## 4. Začátek hry

- **Klan:** 7 trpaslíků u Brány předků: 2 horníci, kameník, tesař, kovář, sládek a farmář. Jména se losují ze 36 a barva vousů ze 7.
- **Zásoby:** 6 polen, 30 jídel, 30 piv (vystačí asi na pět dní) a 2 staré měděné krumpáče.
- **Sklad:** předsíň, druh „vše“.
- **Přátelé:** zakladatelé jsou přátelé po dvojicích a sedmý je přítelem prvního.
- **Pauza:** nová hra začíná v pauze. První den je v Přehledu odkaz „❓ Jak hrát“.
- **Volby v menu před založením hory:** režim (kampaň / volný), velikost hory a seed (náhodný, hora dne nebo vlastní).

---

## 5. Trpaslíci: profese, dovednosti, priority

### Profese

| profese | hlavní práce | dílny, které obsluhuje přednostně | nástroj | dovednost kopání na začátku |
|---|---|---|---|---|
| horník | kopat | – | krumpáč | 6 |
| tesař | řemeslo | tesařská dílna | sekera | 1 |
| kameník | řemeslo | kamenická dílna, brusírna; přednostně tesá stěny | kladivo | 3 |
| kovář | řemeslo | tavírna, kovárna, magmatická výheň, runová kovárna | kladivo | 2 |
| sládek | řemeslo | pivovar | kladivo | 1 |
| farmář | pole + řemeslo | kuchyně | sekera | 1 |
| strážce | stráž | – | krumpáč, válečná sekera, zbroj | 2 (boj 3) |

Milíř a zbrojnice nemají vlastního řemeslníka, obsluhuje je kdokoli.

### Dovednosti
- **Kopání (0–20):** zlepší se o 1 po (6 + 2 × dovednost) vykopaných polích. Každý bod zrychlí kopání o 8 %.
- **Boj (0–10):**
  - Roste výcvikem. Lekce trvá 60 tahů. Ve zbrojnici se získá 2 body za tah, na místě 1 bod. Za 600 bodů je +1 boj.
  - Strážce má navíc po každém úderu šanci 8 % na +1.
  - Každý bod přidá 10 % k útoku.
- **Veterán** je trpaslík s bojem ≥ 6 nebo kopáním ≥ 12. Když padne, mají všichni náladu −5 a klan ztratí 5 slávy.

### Druhy práce a stupně priority
Každý trpaslík má 7 druhů práce:

| druh | ikona |
|---|---|
| kopat | ⛏️ |
| kácet | 🪓 |
| stavět | 🔨 |
| nosit | 📦 |
| pole | 🌾 |
| řemeslo (dílna) | ⚒️ |
| stráž | ⚔️ |

Každý druh má jeden ze stupňů:

| stupeň | význam |
|---|---|
| **1** | hlavní práce |
| **2** | běžná práce |
| **3** | jen když není nic jiného |
| vypnuto | tuto práci nedělá |

Výchozí stupně (předvolba „podle profese“):
- hlavní práce profese 1,
- nošení a pole 1 u všech (logistika a jídlo drží klan),
- ostatní 2,
- stráž vypnutá (kromě strážce).

Předvolba „vše na 2“ dá všem všechno na 2.

**Jak trpaslík vybírá práci:**
1. Prochází úrovně 0 → 0,5 → 0,9 → 1 → 1,9 → 2 → 2,9 → 3.
2. Na každé úrovni hledá **nejbližší** úkol (hledání do šířky od sebe).
3. Úroveň, na které nic nenašel, na 20 tahů přeskakuje.

Některé úkoly dostanou lepší úroveň:

| úkol | úprava úrovně |
|---|---|
| ⭐ přednostní kopání | o stupeň výš |
| příběhové úkoly (číst desku, zažehnout Výheň) | o stupeň výš |
| ⭐ plán stavby | o dva stupně výš |
| rozdělaná práce (donést materiál na plán, postavit připravený plán) | těsně před ostatní práci téhož stupně |
| připravená dílna u hlavní práce | úroveň 0,5 |
| nouzové úkoly | úroveň 0 |

Úkol nikdy nemůže mít lepší úroveň než 0,5, s výjimkou nouze.

Když trpaslík nic nenajde, chvíli se toulá a za 15–19 tahů hledá znovu.

### 🎯 Pracoviště
- Trpaslíka jde vyhradit „jen pro <typ dílny>“. Pak dělá jen řemeslo v dílnách toho typu, ostatní práce se mu vypnou a po zrušení vyhrazení se vrátí.
- Vyhrazený trpaslík si materiál do své dílny nosí sám.
- Pokud je k typu dílny někdo vyhrazený, obsluhují ji jen vyhrazení.
- Jinak má přednost řemeslník dané profese. Když připravená dílna čeká bez obsluhy 100 tahů, zaskočí kdokoli. Kuchyně v nouzi hladu je volná pro všechny hned.

### 🚨 Nouzové priority
Hra je zapíná a vypíná sama, kontroluje je každých 60 tahů. Zapnutí a vypnutí se zapíše do deníku a ukáže v ⚠️ Pozor.

- **Hlad:**
  - Zapne se, když jídla zbývá méně než na 3 dny, nebo když předpověď říká, že dojde do 6 dnů. Vypne se, až je zásoba na víc než 6 dní a předpověď dojití do 10 dnů neukazuje.
  - Kuchyně a donáška do ní dostanou úroveň 0 a kuchyně bere suroviny před pivovarem.
  - Sklizeň dostane úroveň 0 jen tehdy, když chybí suroviny.
- **Strop:** když praská strop a existuje plán podpěry, dostane stavba podpěr a donáška na ně úroveň 0.
- **Voda:** když je u pumpy voda, dostane čerpání úroveň 0.

### Barva čepice
Barva čepice ukazuje hlavní práci trpaslíka (legenda je v Klanu). Šedá znamená všestranného trpaslíka (3 a víc rovnocenných prací). Tvar pokrývky hlavy se řídí profesí:
- horník: helma s lampou,
- strážce: rohatá přilba,
- farmář: slamák,
- ostatní: kapuce.

---

## 6. Pohyb a cesty

Trpaslík je vysoký jedno pole. Stát může na volném poli s pevnou zemí pod sebou, na schodišti, na žebříku a na brodu v potoce.

| pohyb | doba (tahy) |
|---|---|
| chůze | 4 (s nákladem 5) |
| krok o pole nahoru (schod) | 6 |
| lezení po schodišti / žebříku | 6 |
| krok dolů | 5 |
| přeskok díry široké 1 pole | 7 |
| pád | 3 a pak 2 za pole |
| výtah | 3 (nástup) + 1 za pole |
| zvednout věc | 4 |

**Svislý pohyb:**
- Svisle se dá jen po vytesaném **schodišti**, postaveném **žebříku** nebo **výtahem**.
- Výtah je pro hledání cest jediný krok mezi stanicemi, proto ho trpaslíci upřednostní. Stanice jsou oba konce šachty a pole, vedle kterých je podlaha.
- Tvorové výtahem nejezdí.

**Pády:**
- Hledání cest dovolí seskok nejvýš o 3 pole.
- Seskok o 2–3 pole dovolí jen tam, odkud se dá vylézt zpátky.
- Hlubší pád zraní: −15 zdraví za každé pole nad 3.

**Překážky:**
- Dveře trpaslíky pustí.
- Zavřená mříž nepustí nikoho.
- Trpaslíci si navzájem nepřekážejí.

**Voda:** ve vodě trpaslík plave vzhůru a ztrácí zdraví (−0,4 každé 2 tahy). Může se utopit.

---

## 7. Kopání, schodiště, otesání, kácení

### Kopání (⛏️ K)
- Tažením se označí obdélník. Pruh ukazuje rozměr a jestli strop vydrží („⚠️ potřebuje podpěry“ / „✅ strop vydrží“).
- **Dosah:**
  - do stran,
  - nad sebe,
  - šikmo nahoru a dolů (je-li vedle volno),
  - až 2 pole nad hlavu, takže místnosti mohou být vysoké 3 pole.
- **Pod sebe** kope trpaslík jen schodiště, pole pod žebříkem, nebo jámu hloubky 1, ze které vystoupí do strany. Šachtu si pod sebou nevykope.
- **Doba kopání:**
  - 14 × tvrdost tahů,
  - ×1,3, když je v poli ruda,
  - ×1,8 u tvrdé skály (tvrdost ≥ 4) bez železného krumpáče,
  - ÷ (1 + 0,08 × dovednost),
  - ÷ rychlost podle nálady,
  - ÷ krumpáč.
  - Minimum jsou 3 tahy.
- Kopání pod 138 m (pásmo Spáče) chce v kampani potvrzení.

### Schodiště (⛰️ L)
Svislý pruh vykopaných polí, ze kterých se stane schodiště. Je to hlavní cesta do hloubky a nestojí žádný materiál.

### ⭐ Přednost (P)
Nástroj, který zvedá prioritu:
- na označeném kopání: o stupeň výš,
- na plánu stavby: o dva stupně,
- na donášce: o jeden.

Na mapě je u takového pole hvězdička. Druhým použitím se přednost zruší.

### Otesání (🧱 O)
- **Zadní stěna** volného pole se změní na kamennou zeď (obklad).
- **Líc horniny** (podlaha, strop, boční stěna sousedící s volnem) se změní na opracovaný kámen.
  - Ruda v líci se vytěží.
  - Otesaný strop unese aspoň tolik jako původní hornina.
- Kamenná stěna je zadarmo. Hlína, jíl a suť stojí 1 kámen.
- Tesá přednostně kameník, jinak kdokoli s povoleným stavěním.
- Otesané síně zlepšují náladu (viz kvalita místností).

### Kácení (🪓 C)
- Kácí se **jedle**, **obří houby** a dorostlé pařezy.
  - Jedle dá 3 polena, pařez doroste za 4 dny (v zimě ne).
  - Obří houba dá 2 houby a 2 polena a doroste za 4 dny (i v zimě).
- Značka „kácet“ zůstává na pařezu, takže se strom po dorostení pokácí znovu. Trvale se značka zruší nástrojem ✖️.
- Kácení trvá 40 tahů, zrychluje ho sekera.

### ✖️ Zrušit (X)
Zruší označení i plány. Materiál donesený na plán se vrátí na zem.

---

## 8. Stavby

Stavba se nejdřív **naplánuje**. Na mapě se ukáže průsvitně s ukazatelem doneseného materiálu. Trpaslíci pak materiál donesou a stavbu postaví.

**Náhled stavby pod myší:**
- zelený: stavba jde postavit,
- červený: nejde, s důvodem (například „⛔ neprozkoumané místo“).

Nedostupné stavby jsou v paletě zamčené 🔒 a místo ceny ukazují důvod („potřebuje tesařskou dílnu“, „nejdřív přečti runovou desku“, „nejdřív najdi magma“).

| skupina | stavba | cena | místo | k čemu je |
|---|---|---|---|---|
| **Chodby a šachty** | 🪜 žebřík | 1 🪵 | volno, svisle | svislá cesta i ve vykopané šachtě; do skály se vytesá schodiště |
| | 🛗 výtah | 1 🪵 / pole | svisle; po tesařské dílně | rychlá jízda šachtou (3 + 1 tah/pole proti 6 za pole po žebříku); nahradí schody i žebřík |
| | 🪵 podpěra | 1 🪵 | volno | trám pod strop síně, zabrání závalu |
| | 🔥 louč | 1 🪵 | volno | světlo s dosahem 7 polí; voda ji uhasí |
| | ⛲ ruční pumpa | 3 🪵 | volno | odčerpává vodu do 3 polí kolem |
| | 🧱 kamenná zeď | 1 🪨 | volno | zazdí pole |
| **Jídlo a pití** | 🍲 kuchyně | 2 🪵 | podlaha, 2 pole | jídlo z hub a ječmene; svítí |
| | 🍺 pivovar | 3 🪵 | podlaha, 2 pole | pivo |
| | 🪣 studna | 4 🪨 + 1 🪵 | 2 pole vody | voda neodteče ani nezamrzne a pumpa ji nebere; pití za −2 místo −6 |
| **Nábytek** | 🛏️ postel | 1 postel (z dílny) | podlaha | spánek, ošetřovna |
| | 🍽️ stůl, 🪑 židle | z dílny | podlaha | jídelna |
| | 🗿 socha | z dílny | podlaha | sláva +8, přepych, kvalita jídelny |
| **Řemeslné dílny** | 🪚 tesařská dílna | 3 🪵 | podlaha, 2 pole | |
| | 🪨 kamenická dílna | 3 🪨 | podlaha, 2 pole | |
| | 💎 brusírna | 2 🪨 | podlaha, 2 pole | |
| **Kovy a oheň** | ♨️ milíř | 2 🪵 | podlaha, 2 pole | dřevěné uhlí; svítí |
| | 🔥 tavírna | 3 🪨 | podlaha, 2 pole | pruty; svítí |
| | ⚒️ kovárna | 3 🪨 | podlaha, 2 pole | nástroje, zbraně, zbroj; svítí |
| | 🌋 magmatická výheň | 4 🪨 | do 3 polí od známého magmatu | taví a kove bez uhlí |
| | ✴️ runová kovárna | 4 🪨 + 2 zlaté pruty | po přečtení runové desky | hvězdná ocel a artefakty |
| **Obrana** | 🚪 dveře | 1 🪵 | podlaha | nepustí kapaliny ani netvory; goblin vyrazí na 8 ran, troll na 3 |
| | 🚧 padací mříž | 2 železné pruty | volno | zavřená (klepnutím) nepustí nikoho |
| | 🪤 past | 2 🪨 + 1 železný prut | podlaha | netvorovi ubere 25 ♥, napne se znovu za 300 tahů |
| | 🛡️ zbrojnice | 2 🪨 + 2 🪵 | podlaha, 2 pole | výcvik strážců (2× rychlejší než na místě) |

**Pravidla plánování:**
- Jednopolové stavby na volno (kromě zdi) jdou naplánovat i do nevykopané skály. Pole se samo označí ke kopání, u žebříku a výtahu jako schodiště.
- Plán, jehož vykopání by zbořilo stavbu nad ním, se odmítne.
- Do neprozkoumaného pole se plánovat nedá, výjimkou jsou žebřík a výtah.
- Pod 138 m plán sám kopat nezačne. Kopání se tam musí vyznačit ručně a potvrdit.
- Krápník, tráva a kosti stavbě nepřekážejí (krápník se odlomí).
- Když pod stavbou zmizí podlaha, stavba se zboří a materiál vypadne.
- Nábytek ze skladu se **rozmisťuje sám** každých 60 tahů:
  - postele nejdřív na ošetřovnu (max(2, ⌈klan/5⌉)), pak do ložnice,
  - stoly, židle a sochy do jídelny.

---

## 9. Dílny, recepty a výroba

Klepnutím na dílnu se otevře její panel: kdo v ní smí pracovat, obě pracoviště, recepty a fronta zakázek.

**Výroba:**
- Každá dílna zabírá 2 pole a má **2 pracoviště**, takže v ní mohou vyrábět dva trpaslíci současně.
- Výroba má dva kroky:
  1. Pracoviště si vezme první zakázku, na kterou je materiál, a kdokoli s nošením ho donese.
  2. Řemeslník výrobek vyrobí.
- Pracoviště, kterému 2 dny chybí dosažitelný materiál, se uvolní.

**Zakázky:**
- `+1` / `+5` vyrobí N kusů.
- `♾️` je trvalá zakázka „udržuj zásobu N“ (±5).
- `↑` mění pořadí, `✖` ruší. Zrušení vysype donesený materiál.
- Kuchyně a pivovar mají po postavení trvalé zakázky „udržuj 20“ na oba recepty.
- Příběhové zakázky (runová kovárna, díly Klíče) mají přednost a drží si materiál.

Doby jsou v tazích. Dělí je rychlost (nálada), kladivo, Durinovo kladivo (1,3×) a cech mistrů (1,15×).

| dílna | recept | doba |
|---|---|---|
| 🍲 kuchyně | 1 houba → 1 jídlo (houbový guláš) | 30 |
| | 1 ječmen → 2 jídla (ječný chléb) | 50 |
| 🍺 pivovar | 1 ječmen → 2 piva (ječné, lepší nálada) | 60 |
| | 1 houba → 1 pivo (slabé houbové) | 40 |
| 🪚 tesařská | dřevo → postel / stůl / židle | 60 / 50 / 40 |
| 🪨 kamenická | kámen → stůl / židle / socha (kamenný nábytek je lepší a dražší) | 70 / 60 / 120 |
| ♨️ milíř | 2 dřeva → 2 uhlí | 90 |
| 🔥 tavírna | ruda + uhlí → prut (železo, měď, stříbro, zlato) | 70–80 |
| ⚒️ kovárna | prut + uhlí → krumpáč (Fe 90 / Cu 80), sekera (Fe 80), kladivo (Fe 80 / Cu 70) | |
| | 2 Fe + uhlí → válečná sekera | 110 |
| | 3 Fe + uhlí → železná zbroj; 3 Cu + uhlí → měděná zbroj | 140 / 120 |
| | 2 Fe + uhlí → kovaná socha | 100 |
| 🌋 magmatická výheň | totéž bez uhlí: pruty 50–60, krumpáč 70, sekera 60, kladivo 60, válečná sekera 90, zbroj 110, socha 80 | |
| 💎 brusírna | drahokam → broušený drahokam | 100 |
| | zlatý prut + drahokam → šperk | 140 |
| | stříbrný prut → pohár | 110 |
| ✴️ runová kovárna | hvězdná ruda + uhlí → hvězdná ocel | 120 |
| | artefakty a Klíč, viz [22](#22-příběh-ruiny-desky-artefakty-klíč) | 240–300 |
| 🛡️ zbrojnice | bez receptů, jen výcvik | |

Sklad ukazuje, co blokuje výrobu zbraní: chybí kovárna, tavírna, ruda, uhlí nebo dřevo do milíře.

**Hospodářské řetězce:**
```
les ──► dřevo ──► tesař ──► postele, stoly, židle · žebříky, výtah, podpěry, louče, dveře
          └──► milíř ──► dřevěné uhlí ─┐
hora ──► kámen ──► kameník ──► kamenný nábytek, sochy · dílny, zdi, pasti
     ──► uhlí ─────────────────────────┤
     ──► rudy ──► tavírna ◄────────────┘──► pruty ──► kovárna ──► nástroje, zbraně, zbroj, sochy
     ──► drahokamy ──► brusírna ──► brusy, šperky, poháry (obchod, sláva, artefakty)
pole ──► ječmen ──► kuchyně (chléb) / pivovar (ječné pivo)
houbárna / obří houby ──► houby ──► kuchyně (guláš) / pivovar (houbové pivo)
magma ──► magmatická výheň (bez uhlí)
hvězdná ruda ──► runová kovárna ──► hvězdná ocel ──► artefakty ──► Klíč k Srdci
```

---

## 10. Nástroje

| nástroj | zrychluje | železný | měděný | kdo si ho bere |
|---|---|---|---|---|
| krumpáč | kopání, tesání | ×1,6 | ×1,35 | horník, strážce |
| sekera | kácení | ×2,0 | ×1,6 | tesař, farmář |
| kladivo | stavění, výrobu | ×1,4 | ×1,25 | kameník, kovář, sládek |

- Trpaslík si nástroj své profese vyzvedne sám. Měděný vymění za železný.
- **Opotřebení:** každé použití ubere železnému nástroji 1,5 % a měděnému 2,5 %, takže železný vydrží asi 67 použití a měděný asi 40. Zlomení oznámí deník.
- Bez železného krumpáče se tvrdá skála kope 1,8× pomaleji.
- Kdo zemře nebo odejde, výstroj upustí.
- Kdo přestane být strážcem, odloží válečnou sekeru a zbroj, pokud je nějaký strážce potřebuje.

---

## 11. Zóny, sklady a nošení

Zóny se kreslí tažením (🗺️ Z) na volná a prozkoumaná pole. Celkem jich může být nejvýš 250. „✂️ zmenšit zónu“ ubírá pole.

| zóna | kde smí ležet | k čemu je |
|---|---|---|
| 📦 sklad | kdekoli, kde se dá stát | 4 věci na pole; filtr druhů; ⭐ přednostní sklad |
| 🛏️ ložnice | pod zemí | postele, spánek, vzpomínky; určuje místo pro migranty |
| 🍽️ jídelna | pod zemí | stoly, židle, sochy; jídlo a pivo tu leží a počítá se do zásob |
| 🌾 pole ječmene | venku na hlíně nebo jílu | 2 snopy z pole; v zimě nic |
| 🍄 houbárna | pod zemí na podlaze | 1 houba z pole, roste celý rok |
| 🌲 lesní školka | venku (jedle) i pod zemí (obří houby) | sázení a kácení dřeva |
| 🩹 ošetřovna | pod zemí | hojení 3× rychlejší |

**Filtr skladu:**
- Skupiny se dají zapnout nebo vypnout celé (stav vše / část / nic) i po jednotlivých druzích.
- Skupiny: kámen a jíl, rudy, dřevo, nábytek, jídlo, kovy, cennosti.
- Rychlé volby „vše“ / „nic“.
- ⭐ přednostní sklad: nové věci se nosí nejdřív sem, i když je jiný sklad blíž.

**Kam se věc nosí (v tomto pořadí):**
1. Jídlo a pivo do jídelny (do 600 polí cesty).
2. Přednostní sklad.
3. Nejbližší nezaplněné pole skladu.
4. Nejméně zaplněné pole.

Další pravidla nošení:
- Materiál pro dílny a plány má přednost před úklidem.
- Farmář nese čerstvou sklizeň rovnou do kuchyně nebo pivovaru, který ji čeká.
- Kam se nedá dojít, tam se věc zablokuje na 600 tahů.

**Kvalita místností:**
- Jídelna:
  - základ +4,
  - kamenný nábytek +2,
  - sochy +2 za kus (nejvýš 2),
  - stěny otesané z ≥ 60 % +2.
- Ložnice:
  - základ +5,
  - otesané stěny +2,
  - socha +2.

Vyšší kvalita znamená lepší vzpomínku po jídle a spánku.

---

## 12. Jídlo, pití, farmy

### Farmy
- **Pole ječmene:** zasít, nechat dorůst do zralosti a sklidit 2 snopy.
  - Úroda roste každých 30 tahů podle období (jaro 3 / léto 4 / podzim 2 / zima 0) až do 101, tedy zhruba 1 000 tahů při plném růstu.
  - Setí i sklizeň trvají 20 tahů.
- **Houbárna:** roste o 2, u vody (do 3 polí) nebo v houbové či krápníkové jeskyni o 3. V zimě mělko pod povrchem roste o 1 pomaleji. Sklizeň dá 1 houbu.
- **Lesní školka:** sazenice jedle doroste za 3 dny (venku, ne v zimě), obří houba pod zemí za 4 dny (i v zimě).
- **Cíl zásoby farmy:** farmy pracují jen do zásoby. Cíl je ruční (−5 / +5), nebo automatický:
  - houby a ječmen: max(12, 5 × klan),
  - dřevo: max(15, 10 + klan).
  - Na podzim se pole sklízí vždy.

### Jídlo a pití

| co | přidá | poznámka |
|---|---|---|
| hotové jídlo | +70 jídla | trvá 30 tahů; u stolu v jídelně, jinak u stolu, jinak na zemi (−3) |
| syrové houby / ječmen | +35 / +30 | jen v nouzi (jídlo < 15), vzpomínka −5 |
| pivo | +70 pití | ječné +3, houbové +1; obě do 8 dnů +2 („pestrá piva“) |
| voda z potoka / jezera | +50 pití | −6 („žádné pivo!“) |
| voda ze studny | +50 pití | −2 |
| led (zima) | +50 pití | 45 tahů, −9 |

Trpaslík jde pít k pivu, nebo ke studni, podle toho, co je blíž.

### Bilance a předpověď
- **📊 Bilance (Sklad):**
  - Skutečná výroba a spotřeba za poslední až 4 celé dny podle zdroje.
  - Výdrž zásoby.
  - Reálná kapacita kuchyní a pivovarů (asi třetina teoretické) a kolik trpaslíků uživí.
  - Řádek „Nepokryto“ (pili vodu, jedli syrové suroviny).
  - Upozornění, když trvalá zakázka „udržuj N“ zastavuje vaření.
- **❄️ Předpověď zimy (Přehled):**
  - Porce jídla včetně surovin (s kuchyní: houba 1 porce, ječmen 2; bez kuchyně ½).
  - Denní změna podle bilance.
  - Verdikt: „✅ Přežijete“, „⚠️ Těsně“, nebo „❌ Jídlo dojde N. den zimy“ s počtem chybějících porcí a radou.
  - ⚠️ Pozor hlásí, když jídlo dojde do 15 dnů.

---

## 13. Potřeby, zdraví a nálada

### Potřeby (0–100)

| potřeba | úbytek za tah | spotřeba | jde ji splnit pod | kritická (přeruší práci) |
|---|---|---|---|---|
| jídlo | 0,0235 (ve spánku ½, v zimě ×1,2) | ~0,17 jídla/den | 30 | 12 |
| pití | 0,031 (ve spánku ½) | ~0,23 piva/den | 30 | 12 |
| spánek | 0,057 (jen vzhůru) | | 20 (vstává vyspalý na 95) | 5 |

- **Spánek:** postel +0,5/tah, zem +0,3/tah. Na zemi spí trpaslík jen v bezpečí nebo v krajní únavě. Spánkový cyklus trvá asi 2,6 dne.
- **Hladovění:** při nulovém jídle −0,04 zdraví za tah, při nulovém pití −0,06.
  - Od plného jídla k smrti hladem je to asi 11 dní.
  - Od plného pití k smrti žízní asi 8 dní.
  - Deník varuje předem („Docházejí zásoby jídla!“, „Dochází pivo!“).

### Zdraví a léčení
- Hojení probíhá jen tehdy, když má trpaslík pití a jídlo nad 30:
  - vzhůru +0,004 za tah,
  - ve spánku +0,04,
  - na ošetřovně ×3.
- Trpaslík se zdravím pod 60 jde na ošetřovnu. Pod 35 si lehne i do obyčejné postele.
- Léčení nikdy nepředběhne hlad a žízeň.
- Na ošetřovně leží do 95 zdraví, jinde do 60.
- **Horečka** (událost): trpaslík leží.
- **Příčiny smrti:** boj, hlad, žízeň, pád, zával, magma, utonutí.

### Nálada (0–100)
**Nálada = 45 + vzpomínky + trvalé stavy.**

**Rychlost práce** je 0,6× (nálada 0) až 1,4× (nálada 100). **Nevrlý** (nálada pod 40) pracuje navíc ×0,85.

| trvalý stav | vliv |
|---|---|
| hlad / žízeň (pod 20) | −15 / −15 |
| k smrti unavený (spánek < 15) | −10 |
| bolí ho zranění (zdraví < 60) | −10 |
| pracuje ve tmě (světlo < 0,2) | −6 |
| mrzne venku (v zimě) | −3 |
| každý má svou postel v ložnici | +3 |
| bydlí v otesaných síních (≥ 60 % / ≥ 95 %) | +3 / +5 |
| patří k legendárnímu klanu (sláva 650) | +4 |
| přepych od 3. roku (sochy + ½ kamenného nábytku na trpaslíka): pod 0,15 | −4 (od 5. roku −6) |
| přepych od 0,5 na trpaslíka | +3 |

| vzpomínka | hodnota | dny |
|---|---|---|
| jedl syrové / na zemi / u stolu | −5 / −3 / +4 | 5 |
| jedl v jídelně → v pěkné jídelně → hodoval v nádherné síni | +4 až +12 (podle kvality) | 5 |
| ledová voda / voda / studna | −9 / −6 / −2 | 4 |
| houbové / ječné pivo / pestrá piva | +1 / +3 / +2 | 4 |
| spal na zemi / postel mimo ložnici / ložnice (až „pěkná ložnice“) | −6 / +3 / +5 až +9 | 3 |
| zhojili ho na ošetřovně | +3 | 2 |
| smutek za mrtvého | −12, každý další −4, nejvýš −24 | 3 |
| ztráta přítele | −16, další −6, nejvýš −28 | 6 |
| někdo odešel z klanu | −4, nejvýš −8 | 2 |
| padl veterán | −5 | 4 |
| písně bardů (milník slávy) | +6 | 4 |
| události (poutník, slavnost, spor…) | −3 až +10 | 1–3 |

**Návyk:**
- Opakovaný stejný kladný zážitek (jídlo, pití, spánek) ztrácí 8 % za každé opakování, nejvýš klesne na 40 % hodnoty.
- Pestrost se vyplácí.

**Záchvat vzteku a odchod:**
- Při náladě pod 12 roste vztek. Po asi 4,6 dne přijde záchvat: trpaslík 400 tahů nepracuje, jen se brání.
- Záchvat se odloží, dokud je v hoře nepřítel.
- **Druhý záchvat v tomtéž období** znamená, že trpaslík z klanu **odejde**. Upustí výstroj a ostatní mají náladu −4.

**Přátelé:**
- Každý trpaslík má nejvýš 3 přátele.
- Zakladatelé jsou přátelé po dvojicích.
- Nováček se spřátelí se svou skupinou a s jedním starousedlíkem.

---

## 14. Příroda hory: stabilita, voda, magma, světlo

### Stabilita stropu a závaly
- Chodby a místnosti vysoké 1–2 pole jsou vždy bezpečné.
- Síň vysoká 3 a víc polí potřebuje v každém řádku pod stropem **podpěru** aspoň po tolika polích, kolik unese hornina stropu:

| strop | unese polí |
|---|---|
| hlína, jíl | 3 |
| vápenec | 5 |
| čedič | 7 |
| hlubinný kámen | 8 |
| žula | 9 |
| zeď | 10 |
| zdivo | 12 |

- Počítají se jen vykopaná pole. Přírodní jeskyně drží vždy.
- **Nestabilní strop:**
  1. Nejdřív praská a sype prach. Deník a ⚠️ Pozor to hlásí s odpočtem.
  2. Po **600 tazích** (1 den) se zřítí.
  3. Strop padne na podlahu jako suť (dá kámen i rudu, která v něm byla).
  4. Zasypaní trpaslíci ztratí 35 zdraví. Stavby, plány, zóny i úroda v místě dopadu zaniknou.
- Při závalu se obraz otřese (lze vypnout).
- Podpěru jde naplánovat do pole označeného ke kopání. Postaví se hned po vykopání.

### Voda
- Voda je buněčný automat (krok každé 4 tahy):
  - jednotka padá,
  - teče ke spádu do 8 polí,
  - hladiny spojených nádob se vyrovnávají.
- Dveře vodu nepustí. Venku voda odteče údolím.
- **Pramen:** při kopání vápence (18–55 m) vytryskne s pravděpodobností 1,5 %. Přidá 16 jednotek vody, jednu každých 150 tahů.
- **Podzemní jezero:** prokopnutím k němu se zatopí chodby.
- **Ruční pumpa:** jednotka vody za 12 tahů práce, do 3 polí kolem pumpy.
- **Studna:** drží vodu na místě a nezamrzá.
- Voda uhasí louč. Trpaslík se ve vodě může utopit.
- Automat usne, když se nic nehýbe, a probudí ho až změna.

### Magma
- Teče pomaleji (krok každých 12 tahů).
- Spálí věci, stavby, žebříky a plány a zabije trpaslíka.
- Magma u vody ztuhne na **obsidián**. Studnu, které magma vypaří vodu, zničí.
- Je to i palivo: magmatická výheň do 3 polí od magmatu taví a kove bez uhlí.

### Světlo
- **Denní světlo** proniká 4 pole do hory a slábne.
- Další zdroje:

| zdroj | dosah |
|---|---|
| louč | 7 polí |
| ohnivé dílny (kuchyně, milíř, tavírna, kovárna, výhně) | 4 pole |
| hořící Výheň předků | 12 polí |

- Světlo se šíří jen volným prostorem a zdi stíní.
- **Lampa předků** (artefakt) dá celé hoře aspoň 0,4 světla, takže končí nálada „pracuje ve tmě“.
- Ve hře se světlo kreslí jako barevná vyhlazená vrstva tmy a mlhy.

---

## 15. Sláva a milníky

Sláva ⭐ se přepočítává každý den:

```
5 × objevená místa  +  vykopaná pole / 40  +  nejhlubší bod / 3
+ 3 × dílna  +  2 × trpaslík  +  8 × postavená socha
+ hodnota/10 za každou cennost ve skladu (brus, šperk, pohár, socha)
+ bonusy (události, desky +10, artefakty +25, vyčištěný tunel +20, Spáč +40, Výheň +60, padlý veterán −5)
```

**Co sláva ovlivňuje:**
- výkupní ceny karavany (až +50 %),
- nabídku karavany,
- počet migrantů (1 + sláva/60, nejvýš 4),
- dary,
- milníky,
- **sílu goblinních nájezdů** („sláva láká“: +1 za každých 200, nejvýš +4).

| milník | odměna |
|---|---|
| ⭐ 120 | vyhlášená karavana: válečné sekery, zbroj, zlaté pruty, drahokamy |
| ⭐ 200 | migranti s 50% šancí zkušení; karavana veze hvězdnou rudu |
| ⭐ 250 | písně bardů: všichni +6 nálady na 4 dny |
| ⭐ 330 | čestná stráž: 2 zkušení ozbrojení strážci (bez místa +10 slávy) |
| ⭐ 500 | cech mistrů: dílny ×1,15, výkup karavany +20 % |
| ⭐ 650 | legenda hor: nálada +4 natrvalo, všichni migranti zkušení, 3 ozbrojení veteráni |

Zkušený trpaslík má kopání +3 a boj +3. Milníky jsou přehledně v záložce 🔥 Příběh.

---

## 16. Karavana a obchod

**Příjezd a pobyt:**
- Karavana přijíždí **8. den jara a 6. den podzimu** a zůstane **2 dny**.
- Při obléhání se otočí.
- Ohlásí ji zvonek a zpráva. Otevírá se tlačítkem 🐫 nad mapou nebo klepnutím na vůz.
- Okno obchodu hru pozastaví.

**Nabídka:**
- Vždy: jídlo, pivo, dřevo, uhlí, ječmen a železné pruty (víc se slávou).
- Od slávy 20: krumpáče.
- Od 30: sekery a kladiva.
- Od 60: stříbrné pruty.
- Od milníku 120: válečné sekery, zbroj, zlaté pruty, drahokamy.
- Od milníku 200 (nebo když Klíči chybí): hvězdná ruda.

**Ceny:**
- Karavana prodává za 1,5× základní hodnotu.
- Kupuje za základní hodnotu × (1,2 u cenností) × (1 + sláva/200, nejvýš +50 %, +20 % po milníku 500).
- **Hromadný výkup:** jídlo, pivo, houby, ječmen a železné pruty od 10 kusů najednou mají +25 %.
- Obchod je **výměnný** a přebytek hodnoty karavana nevrací.
- Prodává se jen ze skladu: ne nesené, rezervované ani Klíč.
- Koupené zboží se složí před bránu.

| příklady hodnot | |
|---|---|
| kámen, jíl, houby, ječmen | 1 |
| dřevo, jídlo, pivo, uhlí | 2 |
| železná ruda / prut | 4 / 9 |
| stříbrný / zlatý prut | 20 / 28 |
| drahokam / brus / šperk / pohár | 15 / 45 / 110 / 60 |
| krumpáč / válečná sekera / zbroj | 16 / 30 / 45 |
| socha | 25 |
| hvězdná ruda / hvězdná ocel | 40 / 80 |

**Okno obchodu:**
- Karty zboží s ikonou, zásobou a cenou.
- Uprostřed košíky „Dostaneš“ / „Dáš“, váhy pokrytí ceny a bilance.
- Ovládání:
  - klik +1,
  - Shift+klik +10,
  - Ctrl/⌘+klik vše,
  - pravý klik −1,
  - klik v košíku vrací.
- **⚖️ Doplnit** dorovná cenu nejdražšími cennostmi a přebytky (ne základními surovinami).
- **↺ Vyčistit**, **🤝 Plácnout si** (jen když dáváš dost), čip „🕐 odjede za N h“.

---

## 17. Migranti, hosté a velikost klanu

- **Kdy:** na začátku jara, léta a podzimu (ne v zimě a ne při obléhání) přijde skupina nováčků. Událost nabídne volbu přijmout všechny / jen prvního / odmítnout.
- **Kolik:** min(1 + sláva/60 (nejvýš 4), volné postele v ložnicích + 1). Strop klanu je **40**.
- **Složení:** s 60% šancí dostane každý nováček řemeslo, které klanu chybí. Po milnících 200 a 650 bývají zkušení.
- **Kde se objeví:** na nejlevějším dosažitelném poli údolí.
- **Když chybí místo** (plno nebo bez postelí), přijdou **hosté** s darem nebo na hostinu (viz události).
- Čip 🛏️ a text v Klanu ukazují místo v klanu a důvod.

---

## 18. Události s volbou

**Spouštění:**
- Od 3. dne, jednou denně v poledne, s pravděpodobností 1/3.
- Jen když žádná jiná událost nečeká.

**Okno události:**
- Hru pozastaví a nejde zavřít bez volby.
- Má ilustraci: návštěvník, klan, nebo objev.

| událost | volby a následky |
|---|---|
| **Poutník** (ne v zimě) | *Dát 3 jídla*: nálada +3, sláva +5, za 8–14 dní se vrátí jako potulný mistr (2 drahokamy, nebo zkušený trpaslík do klanu). *Poslat pryč*: možná −2 nálady; s 50% šancí to byl **goblinní zvěd**, který za 3–6 dní ukradne 2 cenné věci (do hodnoty 45, ne díly Klíče). |
| **Horečka** | *Den v posteli*. *Odvar* (2 houby + 1 pivo, jen ¼ dne). *Ať pracuje*: 40 % rozchodí, jinak −30 zdraví a riziko nákazy dalších. |
| **Spor dvou trpaslíků** (o krumpáč, poslední pivo, splétání vousu, zásluhy…) | *Za pravdu A / B*: +6 / −6. *Usmířit u soudku* (3 piva): oba +3. *Ať si to vyřídí*: 50 % oba −3, jinak rvačka (−15 zdraví). |
| **Krystalová dutina** (od 60 vykopaných polí) | *Rychle*: +3 drahokamy, ale 35 % zával s těžkým zraněním až smrtí horníků. *Opatrně*: 2 horníci půl dne, +2 drahokamy. *Nechat předkům*: sláva +12, nálada +2. |
| **Pivní slavnost** (od 15 piv) | *Velká* (−10 piv): +10 nálady na 3 dny, sláva +5, ¼ dne volno. *Přípitek* (−4): +4. *Teď ne*: −3. |
| **Dar z Železných hor** (sláva ≥ 50, nejvýš jednou za 20 dní) | 4 železné pruty / válečná sekera / odmítnout s díky (sláva +10). |
| **Hlas hlubin** (kampaň, od 90 m, jednou) | *Píseň předků* (−6 piv): +4 nálady, nájezd o 3 dny později. *Naslouchat* (2 horníci ½ dne): prozradí žílu hvězdné rudy a stopy k ruinám a Srdci (🧭). *Kopat dál*: sláva +6, −3 nálady, 30 % vyleze tvor z hlubin. |
| **Zbloudilý trpaslík** | Přijmout / odmítnout. V plné hoře jen nocleh (−2 jídla, sláva +4). |
| **Hosté** (plný klan na začátku období) | Dar (2 železné pruty + drahokam) / hostina (−6 piv, sláva +10, nálada +4) / rozloučit se. |
| **Migranti** | Přijmout všechny / jen prvního / odmítnout. |

---

## 19. Tvorové a nepřátelé

| tvor | ♥ | útok | pohyb | zvláštnosti | kořist (60 %) |
|---|---|---|---|---|---|
| 🦇 netopýr | 12 | 3 | létá | útočí pomaleji | – |
| 🕷️ obří pavouk | 45 | 6 | leze po stěnách a stropech | | hedvábí |
| 👺 goblin | 30 (první nájezd 20) | 6 | chodí | vyrazí dveře (8 ran), krade nejcennější věc ze skladu a utíká | čepel |
| 🏹 goblinní lukostřelec | 24 | 5 | chodí | střílí až na 3 pole při volném výhledu | čepel |
| 👹 horský troll | 130 | 11 | chodí | vyrazí dveře na 3 rány; civilisté před ním vždy utíkají | drahokam |
| 🐉 Pradávný spáč | 420 | 20 | leze | odolnost podle síly obrany (viz [23](#23-pradávný-spáč-a-finále)) | hvězdná ruda |

**Probuzení jeskyní** (při prokopnutí, každá jeskyně jen jednou):

| jeskyně | kdo se probudí |
|---|---|
| krápníková / obyčejná | 1–3 netopýři |
| obyčejná / hlubinná | 1–2 pavouci |
| houbová | 50 % pavouk |
| goblinní tunel | 2–3 goblini („a jsou doma!“), nájezd se přiblíží |

**Tvor z hlubin:**
- **Neklid hory** (0–1) roste:
  - s hloubkou (od 60 m, plný ve 150 m),
  - o 0,1 za každý artefakt,
  - trvale o 0,3 po předčasném probuzení Spáče.
- Při neklidu ≥ 0,5 může jednou denně vylézt pavouk ze známé hluboké jeskyně.

**Chování tvorů:**
- Tvorové chodí po trpaslících. Útok probudí spícího.
- Netopýr bez cíle poletuje.
- Goblin bez cíle krade a s kořistí uteče z mapy (věc zmizí).
- Nájezdník, který se ke klanu 120× nedostane, se stáhne.

---

## 20. Boj, strážci a obrana

### Boj
- Kdo stojí vedle nepřítele, udeří jednou za **10 tahů**, i uprostřed práce (spící se nebrání).
- **Útok trpaslíka** = zbraň × kov × (1 + 0,1 × boj) × 1,3 s Rohem hory.

| zbraň | útok |
|---|---|
| holé ruce | 4 |
| krumpáč | 6 |
| kladivo | 7 |
| sekera | 8 |
| válečná sekera | 14 |

  Měděná zbraň má ×0,8.
- **Zásah** = útok × (0,7–1,3) × (1 − zbroj). Železná zbroj ubere 40 % poškození, měděná 25 %.
- Zbraně ani zbroj se neopotřebují.

### Strážci (⚔️ stráž)
- Loví **známé** nepřátele kdekoli v dosažitelné hoře. Pustí kvůli tomu jinou práci, jídlo i spánek počkají (kromě kritické potřeby).
- Lov nezačnou pod 40 ♥, pod 35 ♥ ustoupí.
- Sami si vezmou válečnou sekeru a zbroj.
- Bez nepřátel **cvičí**: ve zbrojnici 2× rychleji než na místě, do boje 10.
- Na **Spáče** jdou jen ozbrojení strážci ve skupině aspoň 3 (jinak se shromáždí opodál a čekají).

### Civilisté
- Útěk:
  - civilista utíká pod 60 ♥,
  - před trollem utíká vždy,
  - před Spáčem utíkají všichni kromě ozbrojených strážců a zažíhajícího.
- **Úkryt:** viděný útočník do 12 polí (nájezdník, Spáč, tvor, který nedávno útočil; netopýr ne) přeruší spánek, jídlo i léčení. Trpaslík se schová do ložnice, ošetřovny, skladu nebo jídelny dál od nepřátel.
- Civilista nevkročí na 2 pole k nájezdníkovi.
- Kdo nese Klíč nebo zažíhá, se neschovává.

### 🔔 Poplach
- Tlačítko nad mapou: „Kdo nestráží, nechá práce a schová se.“
- Když během poplachu padne poslední útočník, poplach se odvolá sám.

### Obranné stavby
| stavba | účinek |
|---|---|
| 🚪 dveře | netvory (netopýry, pavouky, Spáče) nepustí vůbec; goblin je vyrazí za 8 ran, troll za 3 |
| 🚧 mříž | po zavření nepustí nikoho; nedá se zavřít na trpaslíka; zavřená brána udrží nájezd venku |
| 🪤 past | 25 ♥ netvorovi, sama se napne za 300 tahů |
| 🛡️ zbrojnice | výcvik |

---

## 21. Goblinní nájezdy

**Načasování:**
- **První nájezd** přijde **36. den**. Jsou to jen 2–3 vyhladovělí goblini (20 ♥).
- Další nájezdy chodí každých **18–26 dní**. Vyšší neklid interval zkracuje až o 30 %, širší hora prodlužuje.
- **Den předem přijde varování** s místem (brána / tunel / „horníci v hlubinách slyší cizí krumpáče“) a odhadem velikosti: „malá tlupa“, „velká tlupa!“, „celé vojsko!“, „mezi nimi je vidět trolla“.
- Předpověď příštího nájezdu je stále v Přehledu a v ⚠️ Pozor.

**Síla** (body, troll = 3 body):
```
(1 + klan/9 + lákadlo slávy (sláva/200, max 4) + počet nájezdů/7 + neklid) × (šířka/96)^¼
strop 18 a zároveň nejvýš 0,6 × klan (aspoň 3)
```

**Složení:**
- **Lukostřelci** přicházejí od 2. nájezdu a od 2. roku. Každý bod síly je lukostřelec s pravděpodobností 30 %.
- **Trollové** (od síly 7): jeden na každé 4 obrněné strážce klanu, nejvýš 3.

**Druhy nájezdu:** do 6. nájezdu je to vždy útok, pak se losuje.

| druh | co dělá |
|---|---|
| ⚔️ útok | tlupa jde na trpaslíky |
| 💰 loupež | slabší (60 %) zloději jdou po cennostech ve skladech; rada: strážce ke skladům |
| 🏹 obléhání | tlupa s lukostřelci 2 dny čeká v údolí; karavana se otočí, migranti nepřijdou |
| ⛏️ podkop | od 60 m hloubky goblini vylezou z podzemí 10–30 polí od nejhlubšího trpaslíka |

**Odkud nájezd přichází:**
- **Odkrytým goblinním tunelem**, pokud z něj vede cesta ke klanu.
- Jinak **údolím k bráně**.
- **Vyčištěný tunel** (v tunelu stojí trpaslík a není v něm žádný tvor) dá slávu +20 a nájezdy pak chodí jen údolím.

---

## 22. Příběh: ruiny, desky, artefakty, Klíč

### Runové desky
- Desky leží ve **strážnici** a v **Síni předků**.
- Přečte je trpaslík s povoleným řemeslem (120 tahů). Každá přečtená deska dá slávu +10.
- Úlomky příběhu se zapisují do deníku a do záložky 🔥 Příběh:
  1. **Deska strážců:** o Spáči, kterému „zavřeli oči kamenem a písní“, a o tom, že kdo sestoupí k Srdci bez Klíče, probudí ho.
     - Odemkne **runovou kovárnu**.
     - Odhalí stopy k ruinám a Srdci (🧭).
  2. **Deska Síně předků:** Výheň hasne bez hvězdné oceli a Klíč přijme jen klan, který ukoval aspoň 2 ze 3 věcí.
     - Odemkne **artefakty**.
  3. **Runy Srdce hory** (při objevení Srdce): „Oheň, který zažehnete, bude hořet, dokud bude žít klan.“

### Runová kovárna a artefakty
Každý artefakt jde ukovat jen jednou. Dá slávu +25 a zvedne neklid hory o 0,1.

| výrobek | materiál | doba | účinek |
|---|---|---|---|
| hvězdná ocel | hvězdná ruda + uhlí | 120 | materiál |
| 🔨 Durinovo kladivo | 2 hvězdné pruty + železný prut | 240 | stavba a výroba celého klanu 1,3× |
| 🏮 Lampa předků | 2 hvězdné pruty + broušený drahokam | 240 | v hoře nikde úplná tma (světlo ≥ 0,4) |
| 📯 Roh hory | 2 hvězdné pruty + stříbrný pohár | 240 | útok všech trpaslíků 1,3× |
| 🗝️ **Klíč k Srdci** | 3 hvězdné pruty + šperk | 300 | věc, která zažehne Výheň; **až po 2 ze 3 artefaktů**; nedá se prodat |

**Volba artefaktů:**
- V „Co dál?“ jde zvolit dvojici artefaktů (kladivo+lampa / kladivo+roh / lampa+roh / automaticky).
- Automatická volba doporučí **Roh**, když nájezdy bolí nebo klanu chybí 6 obrněných strážců a zároveň je známé stříbro. Jinak doporučí kladivo a lampu.

**Kusovník Klíče:**
- Tabulka v „Co dál?“: co je potřeba, co klan má, co chybí a co leží nedosažitelně.
- Potřeba je 3 + 2 × (zbývající artefakty) hvězdných prutů, šperk a vstupy artefaktů. Pokud runová kovárna ještě nestojí, k tomu 2 zlaté pruty.
- Je rozpadlý na suroviny (ruda + uhlí).
- Dílny nesmí spotřebovat díly Klíče na trvalé zakázky.
- Deník jednou varuje, když trvalá zakázka bere poslední uhlí potřebné pro Klíč.

### 🧭 Vodítko
Nápověda směru vede v tomto pořadí:
1. k nepřečtené desce,
2. k ruinám (pásmo ±8 sloupců a hloubka; bez desky jen „60–125 m“),
3. ke Srdci.

Hotový Klíč „táhne“ a ukazuje přesný směr a vzdálenost. Tlačítkem „📍 ukázat“ se pohled posune na místo.

---

## 23. Pradávný spáč a finále

### Probuzení (kampaň)
- **Od 130 m** hora varuje „🌋 Hora duní…“ (nejvýš jednou za 3 dny) a na mapě se kreslí jantarové pásmo.
- **Od 138 m** začíná červené pásmo Spáče. Kopání tam chce potvrzení.
- **Předčasné probuzení:** kopání ≥ 138 m nebo objevení Srdce **bez Klíče** Spáče probudí. Neklid hory pak trvale stoupne o 0,3.
- Jinak se Spáč probudí, až když se s Klíčem začne zažíhat Výheň.

### Finále
1. Trpaslík s Klíčem dojde k Výhni a **zažíhá ji 1 den** (600 tahů práce).
   - Boj zažíhání přerušuje.
   - Když zažíhající padne, Klíč sebere jiný trpaslík.
2. Spáč se probudí v Srdci.
   - Jeho **odolnost** = základní útok ozbrojených strážců / 45 (aspoň 1), takže silná obrana ho zesílí.
   - Všechny zásahy se jí dělí.
3. Během zažíhání vylezou z puklin **dvě vlny pavouků** (v 150 a 380 tazích). Každá má 1 + ozbrojení/3 pavouků, nejvýš 4.
4. Spáč i pavouci jdou po zažíhajícím. Když nikdo nezažíhá, Spáč hlídá Výheň.
5. Goblinní nájezd během zažíhání počká.
6. Přehled ukazuje **🛡️ Obranu proti Spáči**:
   - počet strážců, útok, ♥ a útok Spáče, odolnost,
   - odhad boje „málo strážců“ / „špatný“ / „vyrovnaný“ / „dobrý“.

**Výsledek:**
- Poražený Spáč dá slávu +40: „🏆 Pradávný spáč padl! Hora je volná.“
- **Vítězství:** „🔥🔥🔥 VÝHEŇ PŘEDKŮ HOŘÍ!“, sláva +60. Výheň svítí do 12 polí.
- **Prohra:** zahyne celý klan.

---

## 24. Konec hry, epilog, rekordy

**Okno konce hry:**
- Ilustrace vítězství / porážky a nadpis „🔥 Srdce hory bije!“ / „🪦 Hora utichla“.
- **Epilog:**
  - výhra: „Po N dnech (R. rok) zažehl klan Výheň… v síních žije Z trpaslíků. Písně o jejich slávě…“
  - prohra: „Hora X znovu utichla. Klan vydržel N dní…“
- **Statistiky:**
  - dny, roky,
  - trpaslíci (nejvíc), padlí podle příčin,
  - sláva, nejhlubší bod, vykopaná pole,
  - poražení nepřátelé, nájezdy, artefakty,
  - osud Spáče.
- **Tlačítka:** „♾️ Hrát dál (volný režim)“ (po vítězství), „🔍 Prohlédnout horu“, „⛰️ Nová hora“.

**🏆 Rekordy** (v menu, s možností vynulovat):
- nejrychlejší vítězství (den),
- nejhlubší šachta (m),
- nejvyšší sláva.

Nový rekord ohlásí okno konce hry.

---

## 25. Volný režim

- Spáč se sám nikdy neprobudí a zažehnutí Výhně hru neukončí.
- „Co dál?“ nabízí prvních 9 výukových kroků a pak **11 cílů**:
  1. hloubka 80 m,
  2. velká síň (jídelna ≥ 24 polí, ≥ 60 % otesaná, ≥ 2 sochy),
  3. opevnění (dveře nebo mříž, 2 pasti, 4 ozbrojení strážci),
  4. hloubka 140 m,
  5. sláva 250,
  6. sláva 330,
  7. vyčistit goblinní tunel,
  8. hloubka 155 m,
  9. sláva 500,
  10. **vyzvat Spáče** (tlačítko „⚔️ Vyzvat Spáče“ po nalezení Srdce; Spáč se drží 25 polí od Srdce, bez vln pavouků; +40 slávy),
  11. sláva 650.
- Potom přichází nekonečný cíl: „♾️ další stovka slávy · přežij další desítku nájezdů – hora nikdy nespí.“

---

## 26. Nápověda „Co dál?“

Kampaň vede 17 kroků:

| # | krok |
|---|---|
| 1 | ⛏️ vykopat místnost za bránou (20 polí) |
| 2 | 🪚 tesařská dílna |
| 3 | 🛏️ ložnice a 3 postele |
| 4 | 🍄 houbárna nebo pole + kuchyně |
| 5 | 🍺 pivovar |
| 6 | 🔥 2 louče |
| 7 | 🪜 schodiště do 30 m |
| 8 | 🧱 železná ruda (48–105 m) a tavírna |
| 9 | ⚔️ kovárna a ozbrojený strážce (+ zbrojnice) |
| 10 | 📜 ruiny (80–130 m) a přečtená deska (🧭) |
| 11 | ✴️ runová kovárna (2 zlaté pruty; zlato v 80–140 m) |
| 12 | 📜 druhá deska, odemčené artefakty (🧭) |
| 13 | 🟣 hvězdná ruda (126–137 m), volba artefaktů |
| 14 | ✨ 2 ze 3 artefaktů |
| 15 | 🗝️ šperk a Klíč k Srdci |
| 16 | ❤️‍🔥 prokopat se do Srdce (~150 m) (🧭) |
| 17 | 🔥 donést Klíč a ubránit Výheň |

U kroků 11–15 je kusovník Klíče.

---

## 27. Automatika a záchranné mechanismy

Hra hlídá situace, které by jinak hráče potrestaly za nešikovnost cest:

- **Uvízlý trpaslík** (nemůže dojít ke skladu):
  - ohlásí se s místem,
  - hra sama naplánuje záchranný ⭐ žebřík, nebo bez dřeva schodiště do známé skály (nikdy v pásmu Spáče ani do neznáma),
  - žebřík čekající na dřevo 2 dny se nahradí schodištěm,
  - zbytečné záchrany se uklidí.
- **Cenné věci v jámě** (zlato, drahokamy, hvězdná ruda, díly Klíče): hra pro ně naplánuje cestu ven.
- Hotový Klíč nad Srdcem: hra dokopá cestu dolů.
- **Materiál zrušeného plánu** a věci z vody se přesunou na nejbližší suché místo.
- **Nábytek** se rozmisťuje sám a farmy pracují do cíle zásoby.
- **⚠️ Pozor** shrnuje vše naléhavé, seřazené podle závažnosti:

| závažnost | upozornění |
|---|---|
| naléhavé | nepřátelé, poplach, praskající strop, uvízlí, nouze, málo jídla, hlad podle předpovědi, zranění |
| mírné | blokovaná kovárna, nevrlí, postele bez ložnice, voda u pumpy, málo piva, plná ložnice |

---

## 28. Rozhraní

### Horní lišta
- Název hry a hory.
- 📅 den.
- **Zásoby** s pevným místem: 🍖 jídlo, 🍺 pivo, 🪵 dřevo, 🪨 kámen, ⚫ uhlí, 🔩 železné pruty, 📦 ostatní. Jídlo a pivo pod 2 × klan zčervenají.
- 🕐 hodina, 🧔 počet trpaslíků, období („🌸 jaro 5/12“), ⭐ sláva.
- Rychlost ⏸ 1× 2× 4×, menu ☰.

### Mapa
- **Minimapa** (klik vystředí pohled).
- Tlačítka nad mapou: 🐫 Karavana, ⚔️ N nepřátel (klik ukáže prvního), 🔔 Poplach, 🏁 Konec hry.
- **Oznámení:** lístečky důležitých zpráv (7 s, příběh 12 s, nejvýš 3). Klik ukáže místo (rozbíhající se kruhy) nebo otevře deník.
- Panel nástrojů, palety staveb a zón, informační pruh nástroje.
- Zoom +/−, 🏠 brána.
- Hloubkové měřítko. Při kopání se ukazuje pásmo Spáče.

### Pravý panel – záložky
| záložka | obsah |
|---|---|
| 🧭 **Přehled** | ⚠️ Pozor (nejvýš 5 položek, 📍 skok na místo), 🧭 Co dál? (vodítko, volba artefaktů, kusovník), hora (prozkoumáno %, nejhlouběji, seed, místo v klanu), obrana (předpověď nájezdu, druh, lákadlo, neklid / obrana proti Spáči), ⏳ čím klan tráví čas, ❄️ předpověď zimy |
| 🔍 **Výběr** | detail klepnutého pole, trpaslíka, dílny, plánu, stavby, nepřítele nebo zóny (otevře se sám) |
| 🧔 **Klan** | karty trpaslíků (portrét, činnost, výbava, teploměry 🍖 💧 🙂, stupně prací, pracoviště); řádek „všem“, předvolby, filtr podle práce / ozbrojení / výbavy, legenda čepic |
| 📦 **Sklad** | 📊 bilance jídla a piva, zbraně a nástroje (co jde ukovat a co chybí), suroviny za den, přehled zásob (ve skladu / jinde / v ruce); sbalitelné oddíly |
| 📜 **Deník** | posledních 40 zpráv (paměť 200), typy s barvou a zvukem, 📍 skok na místo, odznak nových důležitých |
| 🔥 **Příběh** | úlomky desek, artefakty, režim a cíl, milníky slávy |
| ❓ **Pomoc** | Začátek, Jídlo, Stavby, Klan, Boj, Cíl hry, Ovládání, Vrstvy hory a rudy |

**Detail trpaslíka:**
- portrét 32 × 32, činnost a cíl, zdraví,
- dovednosti a výbava,
- pruhy potřeb,
- nálada s rozpisem všech důvodů, rychlost práce,
- přepych, stupně prací, pracoviště.

**Detail pole:**
- hloubka, hornina a žíla, tvrdost,
- kolik unese strop, praskání,
- objekt, ležící věci, označená práce.

---

## 29. Ovládání

| akce | myš / dotyk | klávesa |
|---|---|---|
| posun pohledu | tažení (nástroj pohled), pravé tlačítko, dva prsty | šipky, WASD |
| zoom | kolečko, štípnutí | `+` `-` (1–8) |
| skok na bránu | 🏠 | Home |
| pauza / pokračovat | ⏸ | mezerník |
| rychlost 1× / 2× / 4× | tlačítka | 1 / 2 / 3 |
| pohled (zrušit nástroj) | pravý klik bez tažení | V, Esc |
| kopat / schody / přednost | tažení obdélníku | K / L / P |
| kácet / otesat | tažení | C / O |
| stavět / zóny | paleta | B / Z |
| zrušit | tažení | X |
| vybrat trpaslíka / pole | klik (druhý klik na trpaslíka vybere pole pod ním) | |
| detail trpaslíka v Klanu | dvojklik na kartu | |
| stupeň práce | klik další / pravý klik předchozí | Enter / Shift+Enter |
| záložky panelu | klik | ←/→, Home/End |

Zkratky nefungují v textových polích, s Ctrl/Alt/Meta a při otevřeném dialogu.

### Menu ☰
- **Režim:** 🔥 kampaň / ♾️ volný.
- **Velikost hory:** malá / střední / velká / obří.
- **Hry a seed:** 🎲 nová náhodná hora, 📅 hora dne, vlastní seed, 🔗 odkaz na horu.
- **Soubory:** 💾 uložit do souboru, 📂 načíst ze souboru (s potvrzením a zálohou).
- **Rekordy.**
- **🎨 Grafika:** klasická / jemná / hladká.
- **✨ Efekty:**
  - barevné světlo a mlha,
  - obloha a odlesky,
  - zářivé jiskry,
  - okraje terénu,
  - zatřesení při závalu,
  - plynulá kamera.
- **Zvuk:** 🔊 zvuky, 🎵 hudba, hlasitost.
- 🔦 Ukázat celou horu (ladění).

---

## 30. Grafika a zvuk

### Grafika
Vše je pixel art kreslený v kódu se seedovanými texturami.

- **Styly:**
  - klasická: 16 px na dlaždici,
  - jemná: 32 px (horniny kreslené nativně, sprity zjemněné EPX a dokreslené detaily),
  - hladká: od přiblížení 4 se zvětšuje 4×.
- **Terén:**
  - nerovné hrany a zaoblené rohy jeskyní, prolnutí hornin,
  - rudy se leskem, praskliny,
  - voda a magma v 8 snímcích s pěnou, bublinami a jiskrami,
  - led s prasklinami.
- **Trpaslíci:**
  - stínování, halena v barvě profese, trojtónové vousy, pokrývka hlavy podle profese a čepice v barvě práce,
  - 4snímková chůze, plavání, spánek se Zzz, dýchání a mrkání,
  - překryvy zranění, jizvy, obvazů a potu,
  - vlastní portrét.
- **Dílny:** 11 typů ve 4 snímcích animace (oheň, pára, kouř z milíře, bublající guláš, kapající pivo, brus, runy).
- **Tvorové:** 4 snímky chůze, útok, záblesk zásahu, rozpad na částice. Lukostřelec vystřelí viditelný šíp.
- **Okolí:**
  - obloha s barvami dne, hvězdami a měsícem,
  - hory v pozadí se vzdušnou perspektivou,
  - sněžení v zimě, animovaná tráva, houby, krápníky a krystaly,
  - hořící Výheň.
- **Světlo:** barevné, rozmazané, s mlhou.
- **Částice:**
  - prach z kopání v barvě horniny, jiskry z kovadliny, třísky,
  - oblak závalu, kapky, jiskry boje,
  - fialové jiskry Spáče, jiskry loučí.
- **Kamera:** plynulý zoom a dojezd se setrvačností. Snímek se vykreslí za 4–5 ms.

### Zvuk
Vše syntetizované přes Web Audio. Zvuk se zapne až po prvním klepnutí.

- **Zvuky:**
  - úder krumpáče podle horniny (hlína tupě, žula ostře, rudy a runy zvoní),
  - vykopnutí, sekera, kladivo, kovadlina, pila dílen,
  - praskání stropu, zával, kapka vody,
  - bojový roh (nájezd), třesk zbraní, zásah, řev Spáče, pád nepřítele,
  - objev, zvonek (karavana, událost), smrt, fanfára, varování.
- **Prostorový zvuk:** zvuky hrají jen z místa v obraze, se stereem podle polohy. Roh, objev, zvonek, smrt a fanfára hrají vždy.
- **Hudba:** tichý dron a pentatonické tóny s ozvěnou. S hloubkou pohledu klesá výška i jas.

---

## 31. Ukládání, adresa, offline

- **Automatické ukládání:**
  - každý herní den,
  - při skrytí nebo zavření stránky,
  - při akcích v menu.
- **Formát uložení:** hora se generuje znovu ze seedu, ukládají se jen měnící se pole (RLE + base64) a stav hry (uložení má obvykle desítky až ~120 kB). Uložení verzí 9–12 se načtou.
- **Export a import:**
  - Export uloží soubor `srdce-hory-<seed>-den<N>.json`.
  - Import vždy s potvrzením. Předchozí hra jde do zálohy a z Přehledu se dá vrátit (↺).
- **Hra ve dvou záložkách:** varování „Hraj jen v jedné záložce“.
- **Chyby úložiště:**
  - Nečitelné uložení se zazálohuje a nabídne se stažení.
  - Plné úložiště zobrazí výzvu k exportu.
- **Adresa:**
  - `?seed=…` (text i číslo; u jiné hory se hra zeptá),
  - `?velikost=mala|stredni|velka|obri`,
  - `?ladeni` ukáže celou horu.
  - Parametry se po použití z adresy odstraní.
- **localStorage:** `webapp_hra_trpaslici_save` (+ `_save_zaloha`), `_seed`, `_velikost`, `_grafika`, `_efekty`, `_zalozka`, `_sklad_sekce`, `_zvuk`, rekordy `_vitezstvi`, `_hloubka`, `_slava`.
- **Offline:** service worker (`sw.js`) předcachuje celou hru, takže po prvním načtení běží i bez sítě.

---

## 32. Technické poznámky a testy

**Soubory:** `obsah/trpaslici.html` a `obsah/trpaslici/*.js` jako obyčejné skripty v jmenném prostoru `globalThis.TRP`, takže hra funguje i přes `file://`.

| soubor | obsah |
|---|---|
| `nahoda.js` | seedovaná náhoda (mulberry32) |
| `hora.js` | generátor hory, materiály, rudy, jeskyně, ruiny |
| `cesty.js` | hledání cest s gravitací, žebříky, výtah |
| `prace.js` | kopání, značky, otesání, věci, tok zásob |
| `stavby.js` | stavby, dílny, recepty, zóny, dostupnost |
| `potreby.js` | potřeby, nálada, vzpomínky, jídlo, pití, spánek, léčení |
| `priroda.js` | stabilita, závaly, voda, magma, prameny, pumpa |
| `svetlo.js` | mapa světla (logika, ovlivňuje náladu) |
| `obdobi.js` | kalendář, sláva, milníky, karavana, obchod, migranti |
| `udalosti.js` | události s volbou |
| `hrozby.js` | tvorové, boj, nájezdy, poplach |
| `pribeh.js` | desky, artefakty, Klíč, Spáč, finále, „Co dál?“, cíle |
| `hra.js` | hlavní smyčka, trpaslíci, výběr práce, priority, nouze, záchrany |
| `ulozeni.js` | uložení a obnova (`VERZE 12`) |
| `grafika.js`, `ui.js`, `ui-skin.js`, `zvuk.js` | kreslení, rozhraní, ikony, zvuk (jen tyto sahají na DOM) |

- **Logika bez DOM:** simulace je deterministická a nezávislá na vykreslování. Běží i v node pro testy a bota.

**Testy** (ve složce `_test/`):

| test | co ověřuje |
|---|---|
| `node trpaslici_test.js [N]` | generátor na N seedech |
| `node trpaslici_sim.js 40 6000` | scénáře a fuzz s invarianty a porovnáním po uložení a načtení |
| `node trpaslici_velikosti.js` | všechny velikosti hory |
| `node trpaslici_vykon_sim.js` | rozpočet µs na tah na fixtuře pozdní hry |
| `node sw_trpaslici_check.js` | offline seznam souborů |
| `python3 trpaslici_snimek.py` | UI v headless Chromiu |
| `python3 trpaslici_sprity_test.py` | sprity |
| `python3 trpaslici_vykon.py` | výkon kreslení |

**Bot** `node _test/trpaslici_bot.js [her] [let]` hraje celé hry jako „rozumný správce“. Výsledky po revizi 4 (24 her na střední hoře):
- vítězství 12/24, 0 proher,
- medián času do vítězství ~197 dní (asi 4 roky),
- 0,11 padlých na nájezd,
- medián nálady 54.

**Plánovací a záznamové dokumenty:** `Trpaslici_PLAN.md` (etapy a revize), `Trpaslici_SPRITY_PLAN.md`, `Trpaslici_GRAFIKA2_PLAN.md`.

---

## 33. Rady pro hráče

1. **První dny:**
   - Vykopej v hlíně za bránou nízkou místnost (2 pole vysokou, ta nepotřebuje podpěry).
   - Pokácej stromy, postav tesařskou dílnu, kuchyni a houbárnu nebo pole.
   - Zásoby vydrží asi 5 dní.
2. **Jídlo je úzké hrdlo kuchyně**, ne pole. Druhý kuchař nebo druhá kuchyně pomůže víc než další houbárna. Sleduj 📊 bilanci a ❄️ předpověď zimy.
3. **Postele v ložnici** zlepší náladu, rychlost spánku a otevřou místo pro migranty.
4. **Síně vysoké 3 pole** potřebují podpěry podle horniny. Naplánuj je dopředu do označeného kopání.
5. **Schodiště** je zadarmo, **výtah** ušetří čas v dlouhé šachtě.
6. **První nájezd přijde 36. den.** Do té doby měj kovárnu, válečnou sekeru a aspoň jednoho strážce, ideálně dveře nebo mříž v bráně.
7. **Sláva láká gobliny.** Pro pozdní hru stav zbrojnici, pasti a obrněné strážce.
8. **Neprokopávej se k jeskyním naslepo.** Probudí tvory, jezero zatopí chodby a magma spálí stavby.
9. **Pod 130 m hora duní, od 138 m se budí Spáč.** Do hloubky jdi až s Klíčem a silnou obranou (aspoň 3 ozbrojení strážci, raději víc).
10. **Rozmanitost zlepšuje náladu:** ječné i houbové pivo, jídelna se sochami, otesané stěny a od 3. roku přepych.

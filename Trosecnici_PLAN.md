# Plán: 🏝️ Trosečníci (od 25. 9. 2026)

Tahová management/survival strategie na procedurálním tropickém ostrově, hratelná po večerech
a kdykoli přerušitelná. Stav se odškrtává průběžně; „pokračuj" = vzít první neodškrtnutou etapu
a dotáhnout ji celou (implementace → testy v node → headless ověření → záznam výsledků níže).

Nahrazuje položku „🏝️ Opuštěný ostrov" z `HRY_PLAN.md`.

## Rozhodnutí (schválena 25. 9. 2026)

- **Soubory:** `obsah/trosecnici.html` (stránka) + složka `obsah/trosecnici/` s obyčejnými skripty
  (ne ES moduly – musí fungovat i přes `file://`). Společný jmenný prostor `TROS`
  (`globalThis.TROS`), takže stejné soubory jdou v node načíst přes `require`.
  Logika (`nahoda.js`, `svet.js`, později `hra.js`, `stavby.js`, `postavy.js`, `udalosti.js`…)
  **nesahá na DOM ani localStorage**; DOM a plátno mají jen `grafika.js` a `ui.js`.
- **Grafika: pixel art.** Dlaždice 16×16 px kreslené v kódu – terén procedurálně (paleta + šum
  se seedem, 3–4 varianty na biom, pěna a přechody na pobřeží podle sousedů), objekty ručně
  jako řetězcové pixelové mapy s paletou. Vše se jednou předkreslí do atlasu (offscreen canvas)
  a kreslí se celými násobky zvětšení s `imageSmoothingEnabled = false`. Žádné cizí obrázky.
  Plátno respektuje `devicePixelRatio`.
- **Lidé: výprava + práce.** Hráč přímo řídí jen *výpravu* (1–3 lidé s akčními body, chodí po mapě,
  průzkum, sběr, stavba). Ostatní se *přidělují na práci* (molo, sběr vody, stavba, léčení)
  a ta proběhne v noci automaticky. Den = 12 AB výpravy.
- **Podzemí – zjednodušeně** (změna 25. 9. 2026, na přání uživatele): žádná samostatná hra ani mapa
  podzemí. Když výprava stojí na poli jeskyně s otevřenými kamennými dveřmi, nabídne se akce
  „Prohledat podzemí" (AB + pochodeň). Každé prohledání posune výpravu hlouběji a přinese příběh,
  kořist, nebezpečí nebo artefakt; na dně čeká finále. Původní etapy 8–10 jsou sloučené do etapy 8,
  z Nekonečného podzemí se nic nepřebírá.
- **Seedovaná náhoda** (mulberry32): seed ostrova → vždy stejný ostrov. Režim „Ostrov dne" (seed z data).
- **Ukládání:** automaticky po každém dni do `webapp_hra_trosecnici_save`, export/import JSON.
- Hlavička jako ostatní hry (`common.css`, `theme.js`, `podpis.js`, `rekord.js`, `dialog.js`),
  ovládání myší i dotykem, od 320 px, světlé i tmavé téma (mapa je vždy „denní" pixel art,
  téma mění panely).

## Etapy

- [x] **1. Ostrov a pixel-art mapa** (25. 9. 2026)
  - generátor 60×60: výška (radiální spád × fbm šum) + vlhkost → hluboké/mělké moře, pláž,
    džungle, savana, skály, sopečná oblast; řeka od hor k moři, laguna, útesy
  - zvláštní lokace: vrak lodi u startu, jeskyně, vodopád, starý tábor, kamenná hlava, ruiny
  - start na pláži s vrakem; mlha války, odkrývání okolí
  - atlas dlaždic a objektů v pixel artu, kamera (posun, zoom kolečkem/gestem), info o poli
  - test v node na 1000 seedech: podíl souše, start na pláži, sladká voda v dosahu,
    všechny lokace umístěné a dosažitelné po souši, determinismus, rychlost generátoru
- [x] **2. Přežití jednotlivce** → první hratelná verze, záznam v `apps.js` (25. 9. 2026)
  - 12 AB/den, akce na poli (pohyb/průzkum 1, sběr, kácení 2, rybaření 3, nabrat vodu…)
  - 🍖 jídlo 💧 voda 🪵 dřevo 🪨 kámen 🌿 vlákna; zásoby z vraku (nůž, láhev, dřevo)
  - noc: spotřeba, hlad, žízeň, zdraví; konec hry; deník dne; ukládání a pokračování
- [x] **3. Stavby a automatizace** (25. 9. 2026)
  - 🔥 ohniště → ⛺ přístřešek → 🛖 chatrč; sběrač dešťové vody, 🎣 molo, 📦 sklad, 🌾 políčko, 🪚 pila
  - stavby jako sprity na mapě; výroba za noc podle přiděleného člověka; kapacity skladu
- [x] **4. Trosečníci** (25. 9. 2026)
  - postavy: jméno, pixelový portrét, profese (tesař, lékařka, rybář, botanička, námořník…),
    vlastnosti, zdraví, zranění, nemoci
  - nálezy s volbou „Přijmout do tábora?" (+pracovník, +spotřeba), nepravidelné přírůstky
    (skupiny, vraky po bouři); výprava vs. práce; smrt a deník („Do háje. Miguel.")
- [x] **5. Počasí a události** (25. 9. 2026)
  - předpověď („bouře za 2 dny"), škody na stavbách a stromech, déšť plní zásobníky
  - balíček ~30 událostí s volbami (prase v zásobách, neznámé ovoce, žraloci, horečka,
    vyplavená bedna, oheň na pobřeží…)
- [x] **6. Objevy místo výzkumu** (25. 9. 2026)
  - nález odemkne recept: šrot → kovárna → nástroje; hlína → cihly; léčivky → ošetřovna;
    🔨 dílna, 🗼 rozhledna (odkrývá mlhu); strom receptů bez slepých uliček
- [x] **7. Tajemství ostrova a loď** (25. 9. 2026)
  - 🗿 hlava → ruiny → symboly → kamenné dveře v jeskyni (řetěz indicií na mapě)
  - stavba lodi (~100+ dní), volba „Odplout, nebo zůstat?", konec hry s epilogem
- [x] **8. Podzemí (zjednodušené prohledávání)** (25. 9. 2026)
  - na poli jeskyně s otevřenými dveřmi akce „🕯️ Prohledat podzemí" (3 AB + 1 🔥)
  - 6 úrovní po 2 prohledáních (vstupní síň → … → srdce ostrova), na každé úlomek příběhu
  - náhodný výsledek podle hloubky: kořist (kov, léčivky, slepé ryby), nebezpečí (past, zával,
    jedovatý pavouk, zhasnutá pochodeň) – profese výpravy pomáhají (lékař, tesař, botanik)
  - 4 artefakty s trvalým účinkem (ze 6 podle seedu), finále s volbou a dopadem na epilog
  - panel podzemí (hloubka, příběh, artefakty), dialog výsledku, uložená hra v7
- [x] **9. Vyvážení a dotažení** (původně 11; 25. 9. 2026)
  - bot v node odehraje stovky her po 150 dnech: přežití, křivka populace, hladomory
  - úvodní výukové dny, nápověda, rekordy (nejdelší přežití, počet lidí), statistiky konce hry
  - `apps.js`, zvednout `webapp-vN` v `sw.js`

## Ověření po každé etapě

1. Logika v node (`_test/trosecnici_test.js`) – generátor na mnoha seedech, později simulace.
2. Headless Chromium úsporně (jeden prohlížeč s limity, postupně): obě témata, iframe 360 px, **DPI 2**.
3. Snímek mapy jako důkaz běhu.
4. `upload.sh` nespouštět – nahrává uživatel ručně.

## Záznamy z etap

(doplňuje se po dokončení každé etapy – naměřená čísla, vědomé kompromisy)

### Etapa 1 – Ostrov a pixel-art mapa (25. 9. 2026)

Soubory: `obsah/trosecnici.html`, `obsah/trosecnici/{nahoda,svet,grafika,ui}.js`.
Testy: `node _test/trosecnici_test.js [počet]` (generátor), `python3 _test/trosecnici_snimek.py`
(headless: chyby JS, klik a chůze přes syntetické PointerEvent, tažení, úzký displej, DPI 2, snímky
`_test/trosecnici_*.png`).

Naměřeno na 1000 seedech (0 chyb):

| míra | min | medián | max |
|---|---|---|---|
| podíl souše | 27 % | 40 % | 54 % |
| kroků ze startu k pitné vodě | 5 | 10 | 14 |
| čas generování | 3,1 ms | 3,6 ms | 20 ms |
| kroků ke kamenné hlavě / jeskyni / ruinám / táboru | 12 / 14 / 18 / 22 | 33 / 29 / 36 / 42 | 63 / 59 / 70 / 72 |

Laguna je na všech ostrovech, průměrně 1,44 řeky. Stejný seed dá vždy stejný ostrov.
Všech 6 lokací je dosažitelných po souši (vrak z pláže vedle startu). Headless test prošel 12/12.

Jak generátor postupuje: výška (fbm × radiální spád, zvlnění pobřeží, kužel sopky mimo střed) →
odstranění drobných ostrůvků → laguna vykousnutá do pobřeží s průlivem → hloubka moře →
řeky po nejnižším sousedovi, které se nesmějí dotknout vlastního koryta → biomy podle percentilu
výšky, vzdálenosti od moře a vlhkosti (u řeky vlhčeji) → kráter na vrcholu → start (pláž u moře,
voda 5–14 kroků, daleko od sopky; podmínky se postupně uvolňují) → lokace s minimální
vzdáleností od startu a rozestupem.

Vědomé kompromisy:

| co | proč |
|---|---|
| přechody mezi biomy jen „vyšší přeroste nižšího" | stačí 8 směrů × 2 varianty masek a nepotřebuje se sada 47 přechodových dlaždic |
| vodopád je jeden statický sprite na poli řeky | animace přijde, až bude mít vodopád herní význam (etapa 7) |
| průzkum zatím nestojí akční body, žádné ukládání postupu (jen seed) | patří do etapy 2 |
| stránka zatím není v `apps.js` ani v `sw.js` | zapíše se v etapě 2, až bude hra hratelná; do té doby se otevírá přímo `obsah/trosecnici.html` |
| sprity objektů jsou 16 px široké, vysoké až 17 px a přesahují pole nad sebou | kreslí se po řádcích shora dolů, takže se správně překrývají |

Opraveno při ověřování: automatický obrys dělal z vodopádu bílou krabičku a z pěny u vraku
černou šachovnici (sprity teď mají `bezObrysu`). Široké znaky ＋/－ na tlačítkách zoomu chyběly
v písmu. `height:100vh` spolu s `podpis.js` odečetlo pruh dvakrát a pod mapou zůstala mezera
22 px, tělo má proto `height:100%`.

### Etapa 2 – Přežití jednotlivce (25. 9. 2026)

Nový soubor `obsah/trosecnici/hra.js` obsahuje pravidla bez DOM. `ui.js` je přepsaný (lišta stavu, akce,
noc, konec, deník, menu s exportem a importem JSON), cesta v `svet.js` je teď Dijkstra s cenou terénu.
Katalog: sekce „🏝️ Tropické ostrovy" v `apps.js`, `sw.js` zvednutý na `webapp-v131`.
Uložení `webapp_hra_trosecnici_save` (po každém tahu), rekord `webapp_hra_trosecnici_dny`.

Pravidla: den = 12 AB. Krok stojí 1 AB (pláž, savana), 2 AB (džungle, skály, sopka, brod).
14 akcí za 1–3 AB (kokosy, bobule, vlákna, dříví, větve, kácení se sekerou, kámen, voda, rybaření,
kraby, vrak ve 4 kolech, opuštěný tábor → sekera, oštěp). Zdroje se vyčerpávají na 2–4 dny.
V noci se sní 1 🍖 a vypijí 2 💧. Chybějící jídlo stojí 15 ❤️ a každá chybějící dávka vody 20 ❤️;
když nic nechybí, přibude +6 ❤️ a navíc 1 za každé nevyužité AB. Pod 50 ❤️ má den −2 AB, pod 25 ❤️ −4 AB.
Voda se nosí jen v nádobách (láhev 4, sud 6).

Testy: `node _test/trosecnici_hra_test.js [her] [dní]` – 922 kontrol, 0 chyb (vrak, odmítnutá akce se
neplatí, uložení tam a zpět, přehrání pokácených stromů, smrt hladem a žízní, determinismus,
cena 235 cest = nezávislá Dijkstra O(n²)). Headless `_test/trosecnici_snimek.py` 21/21 (akce tlačítkem,
chůze za 3 AB, obnova po načtení stránky, noc, rekord, menu, smrt a nová hra, úzký displej, DPI 2).

Bot na 300 hrách × 40 dní: přežilo **87 %**. Sekeru našlo 26 %, oštěp 99 %, medián objevených
míst 4/6 a odkrytých polí 919. Bot je hloupý (chodí k nejbližšímu cíli), úmrtí jsou rozprostřená
mezi 4. a 39. dnem.

Nález při vyvažování: bez nápovědy umíral bot 5. den žízní, přežilo jen 13 % her, protože řeka
schovaná v mlze se naslepo nenajde. Hráč by na tom byl podobně. Úvodní deník proto říká, kterým
směrem je slyšet šumět voda (skutečný směr k nejbližší řece). S botovou opravou průzkumu to
zvedlo přežití na 57 %, s nápovědou na 87–91 %.

Vědomé kompromisy:

| co | proč |
|---|---|
| zásoby jsou společné, nic se nenosí | správa zásob pro skupinu přijde v etapě 4, tahání věcí by jen zdržovalo |
| jídlo se nekazí a nemá limit | kažení a sklad jsou v etapě 3 (📦 sklad) |
| spí se kdekoli, bez přístřešku | ohniště a přístřešek s bonusem k odpočinku jsou v etapě 3 |
| počasí zatím není, déšť vodu nedoplňuje | etapa 5 |
| test bota trvá asi 4 min na 300 her | kvůli kontrolní Dijkstře O(n²) při každém kroku; stačí spouštět se 100 hrami |

### Etapa 3 – Stavby a automatizace (25. 9. 2026)

Nový soubor `obsah/trosecnici/stavby.js` (pravidla staveb bez DOM). Uložená hra je ve verzi 2
a hra z etapy 2 se při načtení převede. `sw.js` je na `webapp-v135`.

| stavba | cena | AB | pravidlo | účinek |
|---|---|---|---|---|
| 🔥 ohniště | 3 🪵 2 🪨 | 2 | 1×, zakládá tábor | úlovky z vody +1 🍖 (vaření), spánek u ohně +2 ❤️ |
| ⛺ přístřešek | 4 🪵 4 🌿 | 3 | v táboře | spánek +5 ❤️ |
| 🛖 chatrč | 8 🪵 4 🪨 6 🌿 | 5 | na místě přístřešku, sekera | spánek +10 ❤️ |
| 🪣 sběrač | 4 🪵 3 🌿 | 3 | v táboře, max 3 | +4 místa na vodu, +1 💧 za noc |
| 🎣 molo | 6 🪵 2 🌿 | 4 | pláž u moře nebo laguny, max 2 | rybaření z mola: 2 AB, 80–90 %, 3–4 🍖 |
| 📦 sklad | 6 🪵 4 🪨 | 3 | v táboře, max 2 | limity +20 🍖 +25 🪵 +20 🪨 +20 🌿 |
| 🌾 políčko | 2 🪵 2 🌿 | 3 | v táboře, savana nebo džungle, max 4 | sklizeň +5 🍖 po 6 dnech, pak každé 4 dny |
| 🪚 pila | 6 🪵 4 🪨 | 4 | v táboře, sekera + šrot | kácení +2 🪵, stavby −1 AB |

„V táboře" znamená nejvýš 5 polí od ohniště (Čebyševova vzdálenost). Staví se na poli, kde
trosečník stojí, a pole musí být volné. Nově platí limity zásob: bez skladu 10 🍖, 15 🪵,
12 🪨, 12 🌿. Co se nevejde, propadne a akce na to upozorní. Spánek počítá nejlepší úkryt a oheň
na poli trosečníka nebo hned vedle, bonus platí i o hladu. Stavby jsou pixelové sprity; lávka
mola se kreslí na sousední vodu, políčko má 3 fáze růstu a plamen ohně je animovaný.

Testy: node 801 kontrol, 0 chyb (pořadí ohniště → tábor, dosah tábora, obsazené pole, chatrč jen na
přístřešku a se sekerou, spánek v chatrči u ohně +12 ❤️, sběrač v noci, sklad a limity, hláška
o přetečení, políčko 6 + 4 dny, směr lávky mola, pila −1 AB, převod uložené hry v1 → v2).
Headless 23/23 (celý tábor postavený tlačítky, snímek `_test/trosecnici_tabor.png`, noc se sběračem).
Bot (150 her × 40 dní): přežilo **92 %**, tábor 93 %, sběrač 90 %, políčko 70 %, přístřešek 56 %.

Vědomé kompromisy:

| co | proč |
|---|---|
| molo nemá automatickou výrobu, rybaří se z něj akcí | „+6 🍖/den s rybářem" přijde s přidělováním lidí v etapě 4, pole `pracovnik` je připravené |
| stavby se nedají zbourat ani poškodit | poškození přinesou bouře v etapě 5 |
| jídlo se nekazí, jen má limit | pro jednotlivce by kažení bylo jen otravné; zváží se v etapě 11 |

### Etapa 4 – Trosečníci (25. 9. 2026)

Nový soubor `obsah/trosecnici/postavy.js` (lidé, výprava, práce, celá noc). Uložená hra je ve verzi 3;
hry z etap 2 a 3 se převedou (zdraví jednotlivce přejde na „Ty", nálezy se doplní ze seedu).
`sw.js` je na `webapp-v139`.

- **Lidé:** jméno (bez opakování v jedné hře), rod, profese, zdraví a vzhled (pleť, vlasy, 6 účesů,
  košile podle profese). Z toho vzniká pixelový portrét 16×16 i postava na mapě.
- **Profese:**
  - 🪚 tesař: ve výpravě staví za ⅔ AB, jako dřevorubec +1 🪵
  - 🩺 lékař: práce „Léčit" dá +10 ❤️ všem v táboře, ve výpravě +5 ❤️ členům
  - 🎣 rybář: úlovky ×1,5 (výprava i molo)
  - 🌿 botanik: bobule neotráví a dají +1 🍖, sběr +1
  - ⚓ námořník: z pláže vidí o 2 pole dál
  - 🍲 kuchař: tábor od 3 lidí sní o 1 🍖 méně
  - 🧍 trosečník: bez bonusu
- **Výprava (1–3 lidé):** 12 AB + 3 za každého dalšího člena. Slabost (pod 50 a pod 25 ❤️) ubírá.
  Do výpravy a z ní se přeřazuje jen doma (5 polí od ohniště, bez tábora od vraku); vedoucí nemůže odejít sám.
- **Práce přes noc:** sběr +2 🍖, voda +4 💧 (řeka do 8 polí, jinak +2), dřevorubec +3 🪵, kameník +2 🪨,
  vlákna +3 🌿, rybář na molu +6 🍖 (1 na molo), políčka (sklidí zralá), léčit, odpočinek (+15 ❤️).
  Bez tábora se pracuje za polovic.
- **Noc:** výroba jde nejdřív na večeři a limit skladu se uplatní až na zbytek; při ověřování se tu našla
  chyba, kdy se úlovek z mola ořízl ještě před jídlem. Jedí a pijí nejdřív nejslabší. Úkryty mají místa:
  chatrč 3× +10 ❤️, přístřešek 2× +5 ❤️. Výprava je může využít jen do 1 pole, oheň dává +2 ❤️.
- **Smrt:** zápis do deníku („💀 Miguel, rybář, zemřel – žízeň. Do háje, Miguel."). Když zemře hrdina,
  výpravu převezme nejzdravější. Hra končí, až nezůstane nikdo.
- **Nálezy:** 5–7 míst na pláži nebo v savaně aspoň 10 kroků od startu, skupiny po 1 (68 %), 2 (20 %)
  a 3 (12 %). Krok vedle nich otevře nabídku s portréty, profesemi a bilancí (+pracovníci, +🍖/den,
  +💧/den, kolik máš). Odmítnutí počkají 3 dny, pak zmizí. Na mapě mávají, na minimapě jsou růžově.
- **Mapa:** výprava jde za vedoucím, pracující stojí kolem ohniště (bez tábora u vraku).

Testy: node 829 kontrol, 0 chyb (nálezy: počet, unikátní jména, determinismus, vzdálenost; hlášení při
kroku, odmítnutí a pozdější přijetí, AB 12+3; 4 lidé −4 🍖 −8 💧; nejslabší jí první; Miguel zemře
a hra běží; smrt hrdiny → vede Elena; výroba práce včetně rybáře na molu 9+1; jeden rybář na molo;
léčí jen lékař; přeřazování jen doma; tesař; vypršení odmítnutí; převod v2 → v3; serializace).
Headless 27/27 (krok k nálezu otevře nabídku, přijetí, přeřazení práce, noc se souhrnem po lidech,
snímky `_test/trosecnici_nalez.png`, `_lide.png`, `_noc_lide.png`, `_tabor.png`).

Bot (150 her × 60 dní, přijímá, když zásoby stačí, a přiděluje voda → molo → sběr → dřevo):
přežilo **88 %**, lidí na konci medián 4 (max 9), mrtvých medián 0, ale medián 18 žíznivých nocí.
Voda je podle záměru hlavní napětí, protože každý člověk potřebuje 2 💧 a nádoby jsou malé.

Vědomé kompromisy:

| co | proč |
|---|---|
| nálezy jsou jen předem rozmístěné na mapě | noví trosečníci z událostí (oheň na pobřeží, vrak po bouři) přijdou s událostmi v etapě 5 |
| zranění a nemoci jsou zatím jen nízké zdraví | horečky a uštknutí přinesou události v etapě 5 |
| lidé v táboře nestaví, staví jen výprava | stavění bez hráče by vyžadovalo frontu staveb; zvážit v etapě 11 |

### Etapa 5 – Počasí a události (25. 9. 2026)

Nové soubory `obsah/trosecnici/pocasi.js` a `udalosti.js`. Uložená hra je ve verzi 4 (převod z v3
doplní plán počasí). `sw.js` je na `webapp-v142`.

**Počasí** se plánuje dopředu ze seedu, takže předpověď na 2 dny vždy vyjde.

| počasí | účinek |
|---|---|
| ☀️ slunce, ⛅ polojasno | normální den |
| 🌧️ déšť | sběrač +3 💧, do nádob +2 (plachta +2); kdo spí bez střechy −3 ❤️ |
| 🔥 vedro | každý vypije 3 💧; když chybí jen třetí dávka, −8 ❤️ (ne plná žízeň); výprava −1 AB; sběrače suché |
| 🌬️ vítr | den před bouří |
| ⛈️ bouře | výprava −4 AB, všechny nádoby plné, bez střechy −10 ❤️; v noci poškodí přístřešek (50 %), molo (40 %), sběrač (25 %), chatrč (10 %), zničí úrodu políčka (50 %), polámané větve +4 🪵 |

První bouře přijde 8.–12. den, další po 9–16 dnech a do deníku se ohlásí 2 dny předem
(„⛈️ Tropická bouře se blíží. Přijde za 2 dny."). Poškozená stavba nefunguje, dokud ji někdo
neopraví: 🔧 2 AB a polovina ceny.

**Události:** od 3. dne je ráno 40% šance. Po bouři přijde vždy něco, co bouře přinesla:
vrak s 1–3 trosečníky nebo bedna.

| událost | co udělá |
|---|---|
| 🐗 prase v zásobách | volba: honit (50 % +5 🍖 / zranění) nebo nechat (ztráta ⅓ jídla) |
| 🍈 neznámé ovoce | volba bez botanika; s botanikem jistý zisk |
| 🤒 horečka | volba: uložit (2 noci) nebo pracovat (4 noci); nemoc −6 ❤️ za noc, lékař vyléčí |
| 🐢 želva | volba: vejce +3 🍖, nebo nechat (+3 ❤️ všem) |
| 🗯️ hádka | volba: rozsoudit (−2 AB), nebo nechat (oba −8 ❤️) |
| 🦈 žraloci / 🐟 hejno | 3 / 2 dny rybaření ×0,5 / ×1,5 |
| 🐍 uštknutí v džungli | −35 ❤️, s lékařem −15 |
| 📦 bedna | na mapě; uvnitř jídlo, vlákna, dřevo, 🧭 kompas (+1 dohled), ⛺ plachta (+5 místa na vodu), lékárnička (+15 ❤️ všem, konec nemocí) |
| 🔥 oheň na pobřeží | nový nález trosečníků, vidět z dálky |
| drobné | 🐒 opice, 🪵 kmeny, 🪨 sesuv, 🥥 kokosy, 🦟 komáři (bez chatrče), 😴 únava, 🌈 duha, ⛵ plachta na obzoru (náznak etapy 7), 🦇 netopýři z jeskyně (náznak podzemí) |

Čekající volba je uložená v `s.udalost` a po načtení hry se ukáže znovu. Příčiny smrti:
žízeň, hlad, horečka, bouře, vyčerpání.

**Rozhraní:** v liště čip počasí (dnes, teplota, ikony na 2 dny, v titulku celá předpověď), v panelu
varování (bouře, vedro, žraloci, hejno, poškozené stavby) a 🤒 u nemocných. Po noci přijde dialog
události. Na mapě prší (šikmé kapky a blesky při bouři), vedro má oranžový nádech, u poškozených
staveb bliká výstražná značka, bedny jsou vidět na mapě i minimapě.

Testy: node 854 kontrol, 0 chyb. Pokryto: počasí je deterministické, 4–9 bouří za 80 dní, první
8.–12. den, rozestup 9–16, vítr před bouří, ohlášení 2 dny předem, pestrost počasí. Účinky: déšť
a sběrač, bouře naplní nádoby, vedro −8 místo žízně, bouře −10 ❤️ bez střechy a −4 AB. Poškozený
přístřešek nedá úkryt, oprava stojí polovinu; bouře poškodí přístřešek ve 10–30 ze 40 her.
Nemoc −6 ❤️, lékař vyléčí, bedna se otevře. 60 her × 60 dní událostí bez výjimky a všech 22 událostí
se aspoň jednou objevilo; čekající volba přežije uložení; převod v3 → v4.
Headless 30/30 (čip a varování při bouři, dialog události s volbou a výsledkem, snímky
`_test/trosecnici_boure.png` a `_udalost.png`).

Bot (150 her × 60 dní; neopravuje a na události neodpovídá): přežilo **86 %**, lidí medián 4
(max 9), žíznivých nocí medián 9.

Nález při vyvažování: vedro zprvu dávalo plný postih za žízeň (−20 ❤️) i tomu, kdo vypil 2 ze 3 dávek.
Po 3 dnech vedra to zabíjelo celé tábory. Třetí dávka proto stojí jen −8 ❤️. Bot navíc doplňoval
vodu pod 4 💧 bez ohledu na počet lidí; teď počítá lidi i předpověď vedra.

Vědomé kompromisy:

| co | proč |
|---|---|
| předpověď je vždy přesná | nejistota by byla spíš frustrující; bouře má být hrozba, na kterou se dá připravit |
| bouře nekácí stromy na mapě | mazání objektů by rozbíjelo kontinuitu mapy; stačí dřevo navíc |
| ohniště, sklad, pila a políčko (kromě úrody) se nepoškodí | kamenné a pevné stavby |

### Etapa 6 – Objevy místo výzkumu (25. 9. 2026)

Nový soubor `obsah/trosecnici/objevy.js`. Uložená hra je ve verzi 5; převod doplní suroviny,
a kdo už má šrot, dostane +3 ⚙️. `sw.js` je na `webapp-v143`.

Nové suroviny: 🧱 hlína, ⚙️ kov, 🌱 léčivky, 🔥 pochodně. Čipy v liště se ukážou až po objevu.

| objev | spouštěč | odemyká |
|---|---|---|
| 🧱 hlína | výprava u řeky | kopat hlínu (+2, krumpáč +1), 🧱 hliněná pec → 🛢️ cihlová nádrž (+12 💧, +1/noc, v dešti +4, bouři vydrží) |
| 🌱 léčivky | botanik ve výpravě v džungli, vodopád nebo ruiny | sbírat léčivky (botanik +1), 🏥 ošetřovna (odpočinek +10 ❤️, lékař +20, horečku v táboře vyléčí za 1 🌱) |
| ⛰️ výhled | výprava na skalách | 🗼 rozhledna (odkryje okruh 14 polí) |
| 🌋 ruda | výprava v sopečné oblasti | těžit rudu (2 AB, +1 ⚙️, krumpáč +1), jen s kovárnou |
| ⚒️ kovářství | šrot z vraku + postavená pec | ⚒️ kovárna: 🪝 udice, ⛏️ krumpáč, 🔧 nářadí (stavby −1 AB), 🪓 sekera |
| 🔨 řemeslo | postavená pila | 🔨 dílna: 🕸️ sítě, 🏺 hliněné nádoby (+4 💧, max 3, potřebují pec), 🔥 pochodně |

Kov je navíc ze 4. prohledání vraku (+3) a z beden. Stavby, které hráč ještě nezná, se v nabídce
neukážou. Panel 💡 Objevy ukazuje objevené i nápovědy k neobjeveným („Co asi leží na dně a na
březích řek?"). Objev otevře dialog (víc objevů naráz v jednom) a zapíše se do deníku.

**Bez slepých uliček:** statický test ověří, že každá stavba i výrobek má známý objev, předchozí
stavbu a suroviny se zdrojem. Test na 300 ostrovech potvrdí, že řeka, skály, sopka, vodopád i
ruiny jsou vždy dosažitelné pěšky. Sekeru lze vykovat, i když se nenajde opuštěný tábor.

Testy: node 884 kontrol, 0 chyb (celý řetězec krok za krokem: řeka → hlína → pec + šrot → kovářství →
kovárna → 4 nástroje → ruda na sopce; skály → rozhledna odkryje ≥ 400 polí; vodopád → léčivky →
ošetřovna vyléčí horečku; pila → řemeslo → dílna → nádoby, pochodně, sítě; nářadí −1 AB; převod v4 → v5).
Headless 32/32 (krok k řece otevře dialog objevu, čip hlíny, panel objevů; všech 6 nových staveb
postaveno a kovárna nabízí výrobky; snímky `_test/trosecnici_objev.png`, `_tabor2.png`).

Bot (150 her × 60 dní, staví i pec, nádrž a ošetřovnu): přežilo **89 %**, objevů medián 4/6, pec 61 %.

Vědomé kompromisy:

| co | proč |
|---|---|
| cihly nejsou samostatná surovina, stavby z cihel stojí hlínu a potřebují pec | o jednu surovinu a jeden krok výroby méně, řetěz „hlína → pec → cihlové stavby" zůstává |
| ruda se taví rovnou při těžbě (s kovárnou) | nemá smysl nosit rudu zvlášť, když ji zpracuje kovárna v táboře |
| pochodně zatím k ničemu nejsou | jsou připravené pro podzemí (etapy 8–10) |

### Etapa 7 – Tajemství ostrova a loď (25. 9. 2026)

Nový soubor `obsah/trosecnici/tajemstvi.js`. Uložená hra je ve verzi 6. `sw.js` je na `webapp-v146`.

**Tajemství (pořadí je volné):**

| místo | akce | výsledek |
|---|---|---|
| 🗿 kamenná hlava | prozkoumat (1 AB) | ☀️ slunce; hlava hledí k ruinám, ty se odkryjí na mapě |
| 🏛️ ruiny | prozkoumat (2 AB) | 🌀 spirála (klíč) a nápověda „voda, která padá" a „oheň ze země"; vodopád se odkryje |
| 💧 vodopád | za clonu (2 AB + 1 🔥) | 💧 voda |
| 🔥 okraj kráteru | prohlédnout (2 AB, −5 ❤️) | 🔥 oheň |
| 🕳️ jeskyně | průzkum (3 AB + 2 🔥) | kamenné dveře se třemi prohlubněmi |
| 🚪 dveře | otevřít (2 AB + 1 🔥, všechny 4 symboly) | schody do tmy – vstup do podzemí (etapa 8) |

Pochodeň se dá udělat i u ohniště (1 🪵 1 🌿), aby tajemství nezáviselo na dílně. Panel 🗿 Tajemství
ukazuje 4 políčka symbolů a další kroky; v deníku mají zápisy tajemství vlastní typ.

**Loď:** ⛵ loděnice (10 🪵 4 🌿, pláž u moře, odemkne řemeslo). Loď má 5 dílů, každý se nejdřív
zaplatí a pak na něm pracuje:

| díl | suroviny | práce |
|---|---|---|
| kýl | 20 🪵 4 ⚙️ | 80 |
| trup a paluba | 30 🪵 6 ⚙️ | 140 |
| stěžeň | 10 🪵 | 40 |
| plachta | 25 🌿 (s plachtou z bedny 10) | 60 |
| lanoví a kormidlo | 15 🌿 6 🪵 2 ⚙️ | 80 |

Celkem 400 práce, 66 🪵, 12 ⚙️ a 40 🌿. Kvůli surovinám je potřeba sklad a kov (vrak, bedny, ruda
s kovárnou). Na lodi pracuje výprava na loděnici (akce „Pracovat" spotřebuje všechny AB, 2 práce za AB,
tesař ×1,5) a lidé přes noc v roli ⛵ Stavba lodi (4, tesař 6). Na mapě loď roste po fázích
(kýl → trup → stěžeň → plachta) na vodě vedle loděnice. Lávka mola ani loď nemíří na vrak;
při ověřování se loď u startu kreslila pod vrak.

**Odplutí:** z loděnice, když je loď hotová, na cestu je 3 🍖 a 5 💧 na osobu a nefouká (bouře, vítr).
Dialog „Loď je připravena – odplout, nebo zůstat?" připomene nevyřešené tajemství. Odplutí je konec
hry s epilogem (kdo je na palubě, hroby, stav tajemství, statistiky) a rekordem „Nejrychlejší záchrana"
(`webapp_hra_trosecnici_plavba`, nižší je lepší).

Testy: node 910 kontrol, 0 chyb. Tajemství: jeskyně bez pochodní ne; dveře bez symbolů ne; sopka dřív
než ruiny; hlava jen jednou; ruiny hlásí, co chybí; vodopád bez pochodně ne; dveře se otevřou.
Pochodeň u ohniště. Loď: loděnice jen s řemeslem; kýl stojí 20 🪵 4 ⚙️; 11 AB = 22 práce; tesař 6 + 4
přes noc; všech 5 dílů za 14 dní plné práce tří lidí (při neomezených surovinách). Odplutí ne v bouři
a ne bez zásob, jinak konec „odplul" se 3 lidmi a odečtenými zásobami. Převod v5 → v6.
Headless 36/36 (panely Tajemství a Loď, dialog odplutí, epilog a rekord; snímky
`_test/trosecnici_lod.png`, `_odplout.png`, `_epilog.png`). Bot (150 × 60): přežilo 89 %.

Vědomé kompromisy:

| co | proč |
|---|---|
| loď za ~14 dní práce + shánění surovin, ne pevně 100+ dní | délku určují suroviny, kov a předpoklady (pila, sklad, kovárna); nutit čekání uměle by nudilo. Skutečnou délku ukáže bot v etapě 11 |
| plavba je jistá (bez rizika ztroskotání) | po desítkách dní hry by náhodná smrt na moři byla nefér |
| za dveřmi zatím jen schody | podzemí je v etapách 8–10 |

### Etapa 8 – Podzemí, zjednodušené (25. 9. 2026)

Na přání uživatele bez samostatné mapy a hry: když výprava stojí na poli jeskyně s otevřenými dveřmi,
nabídne se „🕯️ Prohledat podzemí" (3 AB + 1 🔥). Původní etapy 8–10 jsou sloučené, plán má teď
9 etap. Nový soubor `obsah/trosecnici/podzemi.js`. Uložená hra je ve verzi 7. `sw.js` je na `webapp-v151`.

- **6 úrovní** (vstupní síň → chodba sloupů → podzemní jezero → pohřebnice → lávový most → srdce ostrova),
  každá se prohledává dvakrát. Při prvním vstupu přijde úlomek příběhu dávných stavitelů hlav.
- **Výsledek hodu:** nebezpečí 18 % + 6 % za úroveň (past −15 ❤️ a víc, s lékařem −7; zával: tesař ho
  projde, jinak dohoří pochodeň navíc; jeskynní pavouk = horečka; netopýři zhasnou pochodeň a vrátí
  výpravu na začátek síně). Kořist 45 % (kov, slepé ryby v jezeře, léčivé houby – botanik víc, mince).
- **Artefakty** na konci 2.–5. úrovně, 4 ze 6 podle seedu:
  - 🏺 džbán deště (+2 💧/noc)
  - 🔱 trojzubec (rybaření +20 % a +1)
  - 🪬 amulet (horečka −3 místo −6)
  - 🗺️ kamenná mapa (celý ostrov bez mlhy)
  - 📜 svitek stavitelů (práce na lodi +50 %)
  - 🪞 obsidiánové zrcadlo (dohled +2)
- **Finále v srdci ostrova:** vzít zlatou sošku (ostrov se otřese, všichni −10 ❤️), nebo ji nechat
  (všichni +20 ❤️). Volba se promítne do epilogu.
- **Rozhraní:** dialog výsledku s tlačítky „Prohledat dál" a „Zpět na světlo"; panel 🗿 ukazuje
  hloubku a posbíraný příběh; epilog ukazuje úrovně a artefakty.

Opraveno při ověřování:
- Jeskyně stojí na skalách, takže první akce spustila objev „Výhled" a jeho dialog přepsal dialog
  podzemí. Objev se teď u podzemí jen oznámí.
- Po založení nové hry zůstal na obrazovce epilog předchozí hry.
- Na poli lokace se vypisoval seznam staveb se stejným důvodem u každé; teď je tam jeden řádek.

Testy: node 927 kontrol, 0 chyb (bez dveří ani bez pochodně to nejde; projití na dno za 10–25
prohledání; 4 artefakty a 6 úlomků; deník; mapa odkryje ostrov; volba jen jednou; na 40 ostrovech
437 prohledání, nebezpečí 23 %, netopýři 6 %, všechny ostrovy prošly; účinky džbánu, amuletu,
zrcadla a svitku; převod v6 → v7). Headless 39/39 (dialog prohledání, druhé prohledání tlačítkem,
panel; snímek `_test/trosecnici_podzemi.png`). Bot (150 × 60): přežilo 89 %.

### Kontrola chyb po etapě 8 (25. 9. 2026)

Hra je funkčně hotová (zbývá jen etapa 9 – vyvážení a dotažení). Nové testy:

- `node _test/trosecnici_fuzz.js [her] [dní]` – náhodné hraní se všemi akcemi, stavbami, kroky,
  rolemi, nálezy a volbami událostí; polovina her s posilou (suroviny, objevy, symboly), ať se
  dojde k lodi a podzemí. Po každém tahu a každé noci hlídá invarianty: zásoby jsou celá nezáporná
  čísla v limitech, AB 0..max, zdraví 1–100, unikátní id, výprava 1–3 lidé, schůdné pole, stavby
  jen na souši a mimo lokace, platná loď a podzemí, po konci žádné akce, texty bez `undefined`,
  `NaN`, `[object` a `null`; každých 10 dní uložení a načtení tam a zpět.
  **Výsledek (200 her × 150 dní):** 15 602 dní, 57 980 akcí, 2 266 staveb, 8 891 událostí, 673 nálezů,
  100 loděnic, 100 otevřených dveří, 32× dno podzemí, max 18 lidí – **0 chyb**. Použity všechny akce
  kromě „vykovat sekeru" (posila ji dává rovnou; pokrývá ji jednotkový test), všechny stavby a role.
- `KOL=3000 python3 _test/trosecnici_ui_fuzz.py` – náhodné klikání v prohlížeči (akce, stavby, kroky,
  klik na mapu, výběr práce, spánek, klávesy, zoom, menu, všechny dialogy včetně konce a nové hry)
  v 8 průchodech: 1280×800, 900×700 s DPI 2, 420×800, obě témata, 3 průchody v pozdní hře (hotová
  loď, otevřené dveře, podzemí, až 163 dní a 13 lidí). Každých 20 kol vykreslí mapu i minimapu
  (i v dešti, bouři, vedru a s odkrytou mapou); každých 50 kol kontroluje texty panelu a vodorovné
  přetečení. **Výsledek: 8/8, 0 chyb.**
- Otevření přes `file://` funguje (klasické skripty, žádné moduly).

Nalezeno a opraveno:
- **Poškozené molo shodilo vykreslování mapy.** Výstražná značka počítala s výškou spritu, ale molo
  se kreslí jen jako lávka. Po bouři, která molo poškodila, by mapa zamrzla. Opraveno v `grafika.js`.
- **Smyčka vykreslování** plánovala další snímek až po kreslení, takže jakákoli výjimka zmrazila mapu
  natrvalo. Teď se snímek plánuje předem a chyba kreslení se jen zapíše do konzole (jednou).

`sw.js` je na `webapp-v154`.

### Etapa 9 – vyvážení: první měření (25. 9. 2026)

Nový „rozumný hráč" `node _test/trosecnici_bot.js [her] [dní] [rychly|zvedavy] [--diag|--detail seed]`.
Hraje celou hru jako člověk: vodu hlídá podle předpovědi, když řeku nezná, jde po sluchu, staví tábor
u řeky, trosečníky přijímá, když je uživí, přiděluje práci, sbírá objevy, vykove sekeru, staví loď
a odpluje. Měří milníky, náročnost (žízeň, hlad, krize, úmrtí) a zábavnost (rozhodnutí a události
za den, dny bez ničeho nového, nejdelší nuda, skladba akcí, úzká hrdla).

**Nalezené problémy vyvážení a opravy:**

| problém | dopad | oprava |
|---|---|---|
| balvan nešel odstranit, strom bez sekery taky ne | tábor v zarostlém terénu neměl kde stavět; hláška „nejdřív odstraň balvan" slibovala nemožné | nové akce ⛏️ rozbít balvan (3 AB, krumpáč 2, +3 🪨), 🔪 porazit strom nožem (4 AB), 🌿 vykopat keř |
| na cestu 5 💧 na osobu | tábor s 10 lidmi potřeboval 50 💧, ale unesl kolem 33 – hotová loď nemohla odplout | 2 🍖 + 3 💧 na osobu; když se voda nevejde, hláška poradí, co postavit |
| kov (12 ⚙️ na loď, ruda +1) | loď stála na kýlu; v polovině her do 250. dne neodplulo | ruda +2 (krumpáč +3), loď 8 ⚙️ (kýl 3, trup 4, lanoví 1) |
| bez tábora se sekerou chyběla rada | cesta přes kovárnu nebyla vidět | hláška u stavby: „Vykovej ji v kovárně" / „leží prý v opuštěném táboře" |

**Stav po opravách (100 her × 250 dní, rychlý hráč):**
- odplulo **76 %**, medián **104. den** (10–90 %: 72–151 dní) – sedí na zadání 100–150 dní;
  zbylých 24 % jsou hlavně nedostatky bota (kov, pořadí priorit)
- milníky (medián): tábor 4. den, první trosečník 15., sklad 13., kovárna 26., pila 29., loděnice 34., hotová loď 103.
- náročnost: úmrtí 0 %, žíznivé noci medián 0 (90 % ≤ 1), krizové noci 0; hloupý bot z etapy 5
  přitom umírá v 11 % her – hra je tvrdá hlavně na začátku a pro hráče, který nesleduje vodu
- zábavnost: 0,31 rozhodnutí a 0,43 události za den, 17 událostí s volbou za hru;
  48 % dní bez ničeho nového, nejdelší nuda medián 6 dní (90 %: 9)
- skladba akcí: voda 20 %, bobule 14 %, kraby 10 %, kokosy 8 %, dříví 7 % – přes polovinu akcí je
  obstarávání jídla a vody i v pozdní hře
- úzká hrdla stavby: dřevo > vlákna > hlína > kámen > kov
- okruh tajemství (hlava → ruiny → vodopád → kráter → jeskyně → tábor): medián 18,7 dne chůze při
  12 AB, s tříčlennou výpravou asi 12; podzemí dalších asi 12 prohledání

Testy po změnách: node 794/794, fuzz 150 her × 150 dní bez chyb, headless 39/39. `sw.js` je na `webapp-v156`.

### Etapa 9 – vyvážení: méně rutiny a oživení prostředka hry (25. 9. 2026)

Uživatel z doporučení vybral body 2 (rutina kolem vody a jídla) a 3 (hluchý prostředek hry).

**Méně rutiny:**
- Práce „💧 Nosit vodu": když je tábor do 8 polí od řeky, nosič přes noc naplní všechny nádoby
  (dřív +4 💧). Daleko od řeky +2.
- Práce „🫐 Sběr jídla" +3 🍖 (botanik +4), dřív +2.

**Prostředek hry:**
- **🔥 Signální hranice** (od 12. dne nebo po první lodi na obzoru; pláž nebo skály, 8 🪵 2 🌿). Akce
  „Přiložit" (1 AB, 4 🪵) → hoří 3 dny, déšť i bouře ji uhasí. Když hoří, od 50. dne je každé ráno
  1,5% šance, že si vás všimne projíždějící loď: „Nastoupit" = konec „zachráněni" s vlastním epilogem,
  „Zůstat" = hra běží dál (+sud vody). Lodě na obzoru se teď objevují opakovaně (nejdřív za 15 dní)
  a text připomene hranici. Na mapě plameny a kouř.
- **Události kolem stavby lodi:** 🐜 termiti (−15 práce, s tesařem −5), 🪵 kus cizího kýlu (+20 práce
  nebo +8 🪵), 💡 lepší spoj (tesař, +15), 🎉 „Loď roste" – volba: slavnost (−1 🍖 na osobu, všichni
  +8 ❤️), nebo pracovat (+10). Bouře může strhnout lešení (−20 práce, 40 %).

Nalezeno a opraveno při ověřování: **přijetí trosečníka mohlo stáhnout AB pod nulu**. Když někdo
během dne zeslábl, přepočet sil výpravy odečetl víc, než zbývalo. Našel to fuzz test, přidal jsem
kontrolu záporných AB po každé akci a stavbě.

Rozumný hráč se naučil totéž co člověk: u řeky nechává jednoho nosiče vody, sbírá jídlo jen tehdy,
když ho tábor nevyrobí, práci v táboře mění i na cestách, vlákna bere z trávy a keřů a od 40. dne
přikládá na hranici.

**Měření (100 her × 250 dní, rychlý hráč):**

| | před úpravami | po úpravách |
|---|---|---|
| odplulo / zachráněno | 76 % | **86 %** (69 % vlastní lodí, 17 % záchrana) |
| den odplutí (10 % / medián / 90 %) | 72 / 104 / 151 | 79 / **117** / 192 |
| rutina voda + jídlo po 30. dni | 59 % akcí | **45 %** (voda 5 %) |
| rozhodnutí / události za den | 0,31 / 0,43 | 0,30 / 0,44 |
| dny bez ničeho nového | 48 % | 47 % |
| úmrtí, krizové noci | 0 / 0 | 0 / 0 |

Testy: node 806/806, fuzz 300 her × 150 dní bez chyb, headless 42/42 (hranice, záchrana → epilog),
klikací test 8/8. `sw.js` je na `webapp-v157`.

### Etapa 9 – dotažení (25. 9. 2026)

Nový soubor `obsah/trosecnici/rady.js` (čistá logika). **Hra je hotová, všech 9 etap.**

- **Průvodce „🧭 Co dál?"** nahoře v panelu: 10 kroků v tomto pořadí – vrak, najít řeku (se směrem,
  odkud šumí voda), nabrat vodu, ohniště, přístřešek nebo sběrač, trosečníci, práce v táboře, sklad,
  2 objevy a cesta domů (hranice nebo loděnice). Postup se odvozuje jen ze stavu hry, takže funguje
  i po načtení a nepřeskočí. ✕ ho vypne (`webapp_hra_trosecnici_rady`), zapnout jde v menu ☰.
- **Uvítání** u nové hry (jen se zapnutými radami): krátký příběh ztroskotání a tři základní pravidla.
- **Varování** v panelu, když je vody nebo jídla méně, než se dnes v noci spotřebuje (počítá lidi i vedro).
- **Rekordy:** nejdelší přežití, nejrychlejší záchrana a nově nejvíc zachráněných
  (`webapp_hra_trosecnici_zachraneni`).
- **Statistiky konce:** stavby, objevy, kroky, úlovky, místa, podzemí a artefakty. Nově se počítají
  akce (`stat.akce`) a stavby (`stat.postaveno`); starší uložené hry se doplní.

Testy: node 820/820 (průvodce krok za krokem, varování, počítadla, načtení staré hry), fuzz 200 her ×
150 dní bez chyb, headless 45/45 (uvítání, „Co dál?" 1/10 → 2/10 se směrem k vodě, vypnutí ✕;
snímky `_test/trosecnici_uvitani.png`, `_rada.png`), klikací test 8/8. `sw.js` je na `webapp-v159`.

### Úprava rozhraní: panel se záložkami (25. 9. 2026)

Podnět uživatele: pravý panel se musel neustále rolovat (akce, lidé, stavby, loď, tajemství, věci,
objevy, deník a nápověda byly pod sebou).

- **Nahoře napevno:** průvodce „🧭 Co dál?" – standardně jeden řádek s cílem, rada se rozbalí
  kliknutím; první 3 kroky jsou rozbalené. Pod ním varování, každé na jeden řádek, podrobnosti
  v bublině. Hlavička zabere nejvýš třetinu panelu.
- **Záložky:**
  - ✋ Tady: akce na místě nahoře, pod nimi popis pole zhuštěný na řádek (celý v „Popis místa")
    a stavby; co tady postavit nejde, je sbalené v „Jinde nebo později (n)". U vybraného
    vzdáleného pole je nahoře jeho popis s „Jít sem" a odkaz zpět.
  - 👥 Lidé.
  - 🏕️ Tábor: loď, tajemství, věci, objevená místa.
  - 📖 Deník: posledních 60 zápisů.
  - 💡 Více: objevy, nápověda, rekordy.

  Klávesy T, L, B, J, V; zvolená záložka se pamatuje. Klik na mapu přepne na Tady. Odznaky:
  počet lidí, „!" u poškozených staveb nebo % lodi, tečka u nových zápisů v deníku.
- **Dole napevno:** 🌙 Jít spát se zbývajícími AB.
- **Mobil:** čipy zásob v jednom posuvném řádku, mapa na 44 % výšky, panel roluje sám a tlačítko
  spánku zůstává na obrazovce. Dřív bylo na 360×760 pod okrajem.

Změřeno (`_test/trosecnici_zalozky.py`, snímky `_test/trosecnici_zal_*.png`): obsah záložky
na 1280×800 má 357 px (dřív 189 px, když hlavičku zabíraly celé odstavce rad a varování);
tlačítko spánku je vidět na počítači i na 360×760. Headless 45/45, klikací test 8/8 (s náhodným
přepínáním záložek). `sw.js` je na `webapp-v160`.

### Mezerník a varování podle noční výroby (25. 9. 2026)

- **Mezerník** = 🌙 Jít spát (i když má fokus naposledy kliknuté tlačítko akce – akce se nezopakuje);
  při 4 a více AB se hra zeptá a druhý mezerník potvrdí. Souhrn noci odklepne mezerník, Enter nebo Esc;
  podržený mezerník nepřeskočí další den. V dialozích událostí mezerník stiskne tlačítko s fokusem, ve výběru
  práce se chová normálně.
- **Varování a barva čipů** nově počítají s tím, co tábor v noci vyrobí. Výroba lidí je vytažená do
  `postavy.vyrobaNoci(s)` a voda ze staveb a počasí do `stavby.vodaNaNoc(s)`; obojí používá skutečná noc
  i odhad `postavy.odhadNoci(s)`, takže se nerozcházejí. Dřív hlásilo „chybí voda", i když nosič u řeky
  v noci naplní všechny nádoby. Počítají se nosiči, sběrače, nádrže, déšť a bouře, džbán, sběr jídla,
  molo, políčka, kuchař i vedro. Bublina ukáže, kolik přinese noc.
- Oprava při refaktoru: práce „Políčka" u víc lidí teď sklízí zralá políčka jen jednou (výsledek stejný, bez dvojího průchodu).

Testy: node 824/824 – odhad se na 200 náhodných stavech přesně shoduje se skutečnou nocí (vypito, snědeno);
nosič a sběrač umlčí varování. Headless 48/48 – mezerník skutečným stiskem klávesy přes WebDriver
(usne bez opakování akce, odklepne souhrn, dvojí mezerník s dotazem). Fuzz a klikací test bez chyb.
`sw.js` je na `webapp-v161`.

### Trend zásob v liště (25. 9. 2026)

Každý čip zásoby ukazuje změnu za nejbližší noc: zelené ▲n přibude, červené ▼n ubude, beze změny nic.
Bublina rozepíše práci v táboře, přítok (sběrače, déšť, nosiči), spotřebu a to, co se nevejde do zásob,
a stav ráno. Počítá to `postavy.bilanceNoci(s)` stejnými funkcemi jako skutečná noc; nezahrnuje ranní
události a polámané větve po bouři. Čipy jsou o kousek hustší, aby se i s trendy vešly na 1280 px do řádku.

Testy: node 825/825 – trend na 300 náhodných stavech × 9 surovin přesně odpovídá skutečné změně za noc.
Headless 49/49 (voda ▼, dřevo ▲ od dřevorubce, bublina s rozpisem; snímek `_test/trosecnici_trend.png`),
fuzz a klikací test bez chyb. `sw.js` je na `webapp-v163`.

### Nemocní se vracejí k práci, pochod přes únavu (25. 9. 2026)

- **Nemocný a jeho práce:** texty horečky a kousnutí pavoukem říkají, co dotyčný dělá
  („Marta (tesařka, 🪓 Dřevorubec) se probudila celá rozpálená"; `postavy.kdoACo`). Volba „Uložit na
  odpočinek" si práci zapamatuje (`o.puvodniRole`); v panelu Lidé je „↩ po uzdravení: 🪓 Dřevorubec".
  Jakmile nemoc skončí (sama, lékařem nebo v ošetřovně), dotyčný se v noci **vrátí ke své práci**
  a souhrn noci to oznámí. Když ta práce už nejde (třeba zmizelo molo), jde na sběr jídla. Ruční změna
  práce hráčem návrat zruší.
- **Pochod přes únavu** (prodloužení chůze): když při chůzi dojdou AB, dialog „😓 Síly došly" nabídne
  🥾 jít dál přes únavu (až 6 AB navíc denně, každý AB navíc stojí všechny ve výpravě 3 ❤️), nebo
  ⛺ zastavit. Cíl zůstane vybraný i přes noc, ráno stačí „Jít sem". V popisu cesty je odkaz
  „🥾 dojít dnes přes únavu (−n ❤️)", klávesou Shift+šipka jde krok přes únavu. Limit se přes noc obnoví
  (`s.navic`). Po chůzi přijde jedno souhrnné oznámení, ne jedno za každý krok.
- Oprava: řádek „Ráno: počasí" se do souhrnu noci přidával až po vykreslení, takže se nikdy neukázal.

Testy: node 836/836 (text horečky s prací, zapamatování, návrat po uzdravení sám i s lékařem, ruční změna,
neplatná práce → sběr, přes únavu −3 ❤️, limit 6, obnova v noci), fuzz s náhodnými kroky přes únavu bez chyb,
headless 53/53 (dialog „Síly došly", dojití přes únavu, cíl přes noc, panel „po uzdravení"; snímky
`_test/trosecnici_unava.png`, `_nemocny.png`), klikací test 8/8. `sw.js` je na `webapp-v164`.

### Symbol ohně šel těžko najít (25. 9. 2026)

Hlášení uživatele: prošel celý ostrov a nevěděl, kde získat poslední symbol. Byl to 🔥 oheň na okraji
kráteru. Akce „Prohlédnout okraj kráteru" se nabízela jen na poli těsně vedle lávy ze 4 stran a nápověda
zněla jen „sopka?". Kráter byl přitom dostupný na všech 1000 ověřených ostrovech – šlo čistě o to, jak to
hra sdělí.

Opravy: akce jde teď do 2 polí od lávy všemi směry; ruiny odkryjí kráter na mapě a řeknou „kráter na
vrcholu sopky"; nad kráterem bliká značka, dokud symbol chybí; panel 🗿 u každého chybějícího symbolu
říká přesně kde a jak (vodopád s pochodní, okraj kráteru do 2 polí); klik na kráter poradí totéž.
Uložené hry se opraví samy (značka i nápověda se odvozují ze stavu).

Testy: node 840/840 (symbol ohně jde získat na všech 300 ostrovech; úhlopříčně do 2 polí ano, 3 pole ne;
ruiny odkryjí kráter), headless 54/54 (snímek `_test/trosecnici_krater.png`). `sw.js` je na `webapp-v165`.

### Pěšiny a stezky (25. 9. 2026)

Návrh uživatele: kudy se hodně chodí, tam vznikne pěšina a chůze po ní je levnější.

- Každé pole si pamatuje, kolikrát do něj výprava vstoupila (`s.slapano`, v uložené hře; starší hry
  začínají s prázdným).
- **🟫 Pěšina** (4 průchody): náročný terén (džungle, skály, sopka, brod) za 1 AB místo 2.
- **🟨 Stezka** (12 průchodů): krok za **½ AB** kdekoli. AB zůstávají celá čísla – lichý půlkrok zaplatí
  celý AB a druhý půlkrok je „zdarma" (`s.pulKrok`), přes noc propadne.
- Hledání cesty počítá s cenou podle pole (`hra.cenaPole`), takže pěšiny a stezky samo upřednostní –
  vyšlapané cesty mezi táborem, řekou a sopkou se tím samy prohlubují. Cena cesty v popisu i červené tečky
  („dnes nedojdeš") počítají s půlkroky.
- Na mapě: pěšina jako řídce vyšlapaná hlína, stezka jako souvislá cesta propojená se sousedními poli.
  V popisu pole „🟨 stezka (prošlapáno 15×) · krok ½ AB"; první pěšina a první stezka se zapíšou do deníku.

Testy: node 851/851 (pěšina po 4, stezka po 12, dva kroky po stezce = 1 AB, kredit a jeho propadnutí přes noc,
uložení, cesta přes stezku levnější a skutečná chůze stojí přesně tolik, kolik cesta slíbila), fuzz bez chyb,
headless 55/55 (snímek `_test/trosecnici_stezky.png`), klikací test bez chyb. `sw.js` je na `webapp-v167`.

### Síly došly: výchozí je odpočinek (25. 9. 2026)

Když při chůzi dojdou AB, dialog „😓 Síly došly" má jako výchozí (první, zvýrazněná, s fokusem – mezerník
i Enter) volbu **🌙 Odpočinout (zítra dál)**, která ukončí den; cíl zůstane vybraný. Dál „🥾 Jít dál přes
únavu" (jen dokud to denní limit dovolí) a „⛺ Jen zastavit". Dialog se ukáže i při vyčerpaném limitu únavy
(bez volby jít dál). Headless 56/56 (fokus na Odpočinout, mezerník v dialogu → noc). `sw.js` je na `webapp-v168`.

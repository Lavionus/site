# sites

Statický web se sbírkou malých HTML aplikací, hostovaný na GitHub Pages
(<https://lavionus.github.io/site/>). Bez backendu, data zůstávají v prohlížeči.

| Cesta | Web | Katalog | Stránky |
|---|---|---|---|
| `/` | hlavní rozcestník – 273 aplikací | `apps.js` | `obsah/` |

## Tři oddělené weby

Výukový web **Metodus** a jeho **ukázková stránka** tady od září 2026 nejsou.
Každý má vlastní složku, vlastní repozitář a vlastní GitHub Pages — schválně,
aby se z jednoho nedalo odmazáním adresy v prohlížeči dojít na druhý:

| Složka (vedle téhle) | Repozitář | Adresa |
|---|---|---|
| `---------------github_site` | `Lavionus/site` | <https://lavionus.github.io/site/> |
| `metodus` | `Lavionus/metodus` | <https://lavionus.github.io/metodus/> |
| `metodus-ukazka` | `Lavionus/metodus-ukazka` | <https://lavionus.github.io/metodus-ukazka/> |

Proto **tenhle web na Metodus nikde neodkazuje** — ani z menu, ani z úvodní
stránky, ani přesměrováním starých `#obsah/<výuková aplikace>` (neznámý hash
otevře domovskou stránku). Když se sem přidá odkaz na Metodus, ztratí celé
oddělení smysl.

Dvě věci si hlavní web kvůli tomu drží ve vlastní kopii:
`obsah/textures/8k_earth_{daymap,nightmap}.jpg` pro `obsah/weather_globe.html`
a `obsah/historicke_mapy_odkazy.html` pro mapové nástroje. Dřív si obojí půjčoval
z `metodus/`. Když se předloha v Metodusu změní, je potřeba kopii obnovit ručně.

```bash
./test_local.sh          # lokální server na http://localhost:8000 (nikdy file://)
./upload.sh "zpráva"     # nahraje VŠECHNY TŘI weby (ukázku si předtím vyrobí ze zdroje)
./upload.sh -n           # nasucho: ukáže, co by se nahrálo, a nic neodešle
```

Podpis autora (`Webové stránky © Radovan Valenta · hdm@seznam.cz`) vykresluje
`podpis.js` ve vlastním pruhu u spodní hrany okna (22 px, text vpravo) – Metodus
má ve svém repozitáři vlastní kopii s vlastním názvem díla (konstanta `DILO`
na začátku souboru). Každá nová stránka ho musí mít v `<head>`:
`<script src="../podpis.js" defer></script>`. Pruh obsah nepřekrývá: tělu se
přidá spodní odsazení, `100vh` v CSS stránky se zmenší o výšku pruhu a prvky
ukotvené napevno u spodní hrany se nad něj posunou. Uvnitř rozcestníku se
v iframu nekreslí, podpis tam patří nadřazené stránce.

**Rozbočka** (`obsah/tubeSplit.html`) má stejné kónické konce a sražení jako
`obsah/tubeRed.html` – zvlášť pro vstupní přírubu a společně pro všechny
vývody (bývají stejné a karty vývodů jsou už dost nabité). Řezy vstupní příruby
se dopočítají tam, kde se profil lomí; u vývodů se fazeta smí zakousnout jen do
rovné části za narovnáním průřezu (`narovnani()` – stejný výpočet používá
geometrie i kontrola), protože blíž k přechodu je řez ještě elipsa a kolmá
fazeta by ji přehnula. Síť zůstává uzavřená (každá hrana ve dvou trojúhelnících).

Historii vytvořených tvarů v obou generátorech trubek (`obsah/tubeRed.html`,
`obsah/tubeSplit.html`) obsluhuje sdílený `tvary.js`: uloží nastavení stránky do
`localStorage` pod názvem (nezadaný se odvodí z rozměrů, např. `100 → 2× 40 mm`),
umí je znovu načíst, přepsat, přejmenovat, smazat a celou sbírku vyvézt nebo
nahrát ze souboru JSON. Stránka modulu dodá jen čtyři funkce (co uložit, jak to
nastavit zpět, krátký popis a kontrolu, že záznam patří jí); klíče jsou oddělené
(`webapp_redukce_tvary`, `webapp_rozbocka_tvary`) a export STL/OBJ se pojmenuje
podle naposledy uloženého či načteného tvaru.

Větší datové soubory leží vedle své stránky v `obsah/` a načítají se jako
klasický `<script>`, ne přes `fetch` – tím fungují i z `file://` a service worker
si je uloží při prvním otevření stránky. Slovník ke Scrabblu
(`obsah/scrabbleSlovnik.js`, 41 tis. tvarů, 366 kB) vznikl tak, že frekvenční
seznam českých slov z titulků (hermitdave/FrequencyWords) prošel pravopisným
slovníkem cs_CZ (LibreOffice/hunspell); postup je popsaný v hlavičce souboru.

**Kónické konce a sražení** umí obě stránky s trubkami. U napojení na druhou
přírubu má příruba rozměry podle zadání (OD/ID) a k svému volnému konci se
lineárně mění o zadanou hodnotu průměru – zvlášť zvenku (plášť se zužuje)
a zevnitř (díra se rozšiřuje), podle režimu *bez kónusu / zvenku / zevnitř /
oboje*; záporná hodnota kónus obrátí. Nezávisle na kónusu se dá na hranu volného
konce dát ještě **sražení** (fazeta zvenku / zevnitř / oboje) – měří se od
plochy, kterou tam nechal kónus, takže jde obojí kombinovat. Každá fazeta má
vlastní rozměr v mm (o kolik se posune poloměr) a vlastní úhel od osy dílu: 45°
je stejně hluboká jako dlouhá, 30° zajede do délky skoro dvakrát dál, 60° naopak
sotva půl. Na konci musí zbýt aspoň 0,2 mm stěny a fazeta se při daném úhlu musí
vejít do délky příruby, jinak se díl nevygeneruje a stránka řekne proč. Příruby
dlouhých redukcí se kvůli tomu staví z řezu (`profilPriruby` + `pridejProfil`)
místo napevno indexovaných prstenců – do řezu se tak dá přidat libovolný počet
hran. Do září 2026 na to byla zvláštní stránka `obsah/tubeRedCone.html`; ta se
stala jedinou verzí generátoru redukcí a je zpátky pod `obsah/tubeRed.html`
(i s původními klíči `reductionSettings` a `webapp_redukce_tvary`, aby lidem
zůstalo nastavení i uložené tvary).

**Kulturní akce v krajích** (`obsah/kulturni_akce.html`) staví na katalogu
`obsah/kulturniAkceData.js` – 100 tradičních každoročních akcí (hody, poutě,
výstavy, festivaly, vinobraní, adventní trhy) rozdělených podle krajů a druhu.
Celostátní akce mají kraj `CR` a zobrazují se vždy. Akce se opakují každý rok,
proto se neukládá rok, ale měsíc, volitelně den a slovní termín; stránka
dopočítá nejbližší budoucí výskyt. Vybrané kraje, filtry i vlastní akce
uživatele si stránka pamatuje v `localStorage` (`kulturni_akce_*`).
Volné celostátní API s kulturními akcemi neexistuje, katalog se proto rozšiřuje
ručně v datovém souboru.

**Scrabble anglicky** (`obsah/scrabble_en.html`) je stejná hra s anglickou sadou
kamenů a slovníkem `obsah/scrabbleSlovnikEn.js` (28 kB). Herní logika je kopie
`obsah/scrabble.html` – liší se jen sada, slovník, klíče v `localStorage`
(`webapp_hra_scrabble_en*`) a texty; **opravy v pravidlech nebo v generátoru tahů
je proto potřeba udělat v obou souborech**. Slovník je záměrně malý (~3 000
tvarů): je to školní slovní zásoba ZŠ, u které se dá u každého zahraného slova
ukázat český význam a počítač nehraje slova, která dítě nemůže znát. V souboru
se udržuje jen základ (`ZAKLAD` s významy, `NAVIC` bez nich) a odvozené tvary
(množné číslo, `-ing`, `-ed`, stupňování) se dopočítají při načtení.

**Stavitel rodokmenu** (`obsah/rodokmen.html`) je nový nástroj pro rodokmeny —
staví se **od nejmladší generace vzhůru k předkům**. Data drží po vzoru GEDCOMu
v **osobách a rodinách** (`rodina = {partneri, deti, svatba}`), ne polem rodičů
a partnerů u každé osoby: díky tomu se manžel vybírá jednou a platí pro všechny
společné děti, sourozenci vzniknou sami a nevlastní se od vlastních poznají
podle rodiny. Vazby se dělají **v kontextu člověka** (u vybrané osoby jsou
tlačítka přidat otce / matku / partnera / dítě / sourozence) a druhá strana se
buď napovídá mezi zapsanými, nebo rovnou zakládá — s předvyplněným pohlavím
a příjmením. **Nesmysl se nevpustí dovnitř**: kruh v rodokmenu, rodič mladší
než dítě, matka zemřelá před porodem, sourozenci jako partneři ani třetí rodič
neprojdou; sporné případy (rodič v 15 letech, pohrobek, velký věkový rozdíl) se
jen potvrzují. **Ověření stromu** projde data znovu (i ta načtená odjinud),
seřadí nálezy podle závažnosti a u většiny nabídne opravu na jedno klepnutí —
prohodit data, odpojit nemožného rodiče, sloučit duplicitu. Vývod kreslí
s čísly **Sosa–Stradonitz** (otec 2n, matka 2n+1), umí i rozrod potomků, vývodovou
tabulku k tisku, statistiky s **úplností vývodu** po generacích a kalkulačku
příbuznosti. Načte **zálohu ze stránky Heritage**, vlastní zálohu i **GEDCOM**
z cizích programů (a všechno zase vyveze, včetně zpětného exportu pro Heritage).
Kontroly: `_test/rodokmen_test.js` (model, preventivní pravidla, rozvržení bez
překryvů, ověření a opravy), `_test/rodokmen_test2.js` (zálohy, GEDCOM tam
a zpět, import z Heritage, vývodová tabulka, příbuznost), `_test/rodokmen.html`
a `_test/rodokmen_mobil.html`. Starší `obsah/Heritage.html` zůstává a odkazuje
na nový nástroj.

**Heritage** (`obsah/Heritage.html`) je genealogická aplikace (5 900 řádků);
nepřepisoval se, dostal tři chybějící věci a tři opravy. **GEDCOM 5.5.1** je
formát, kterým si rodokmeny předávají všechny genealogické programy — bez něj
byl rodokmen uvězněný v téhle stránce. Model drží vztahy u osoby
(`parents[]`, `partners[]`), GEDCOM je drží v rodinách (`FAM`: HUSB, WIFE,
CHIL), takže export rodiny poskládá a import je zase rozpustí; načte i soubory
z jiných programů (`ABT 1850`, `GIVN`/`SURN`, `CONT`). **Kalkulačka
příbuznosti** najde nejbližšího společného předka a ze dvou vzdáleností k němu
odvodí české pojmenování (prababička, prasynovec, bratranec z druhého kolena
o generaci posunutý) včetně řetězu jmen; přes partnera dopočítá i zetě, tchyni
a švagra — a právě tenhle krok smí být jen jeden, jinak se dva partneři
odkazují na sebe donekonečna. **Slučování duplicit** navazuje na kontrolu dat:
zůstane první záznam, druhý mu předá chybějící údaje a všechny vazby se
přepojí. Opravené chyby: `performUndo` neplnil zásobník „znovu“ (Redo tedy
nefungoval) a nechával neplatnou cache osob, `resizeCanvas` padal při každém
načtení stránky (posluchač `resize` visel dřív, než vzniklo plátno) a
`pushUndo` byl v souboru definovaný dvakrát. Kontroly: `_test/heritage_test.js`
(20 pojmenování příbuznosti, GEDCOM tam a zpět i cizí soubor, slučování),
`_test/heritage.html` (22 testů v prohlížeči včetně importu přes skutečný
vstup souboru) a `_test/heritage_mobil.html`.

**Editor diagramů** (`obsah/flowchart.html`) drží diagram jako data (uzly a
hrany) a plátno z nich pokaždé překreslí celé. Tvarů je devět (proces,
rozhodnutí, start/konec, vstup/výstup, příprava, databáze, dokument, spojka,
poznámka) a každý umí tři věci: spočítat svou velikost podle textu (zalomí se
a uzel se zvětší), nakreslit se a vrátit svůj **obrys jako mnohoúhelník**.
Obrys je důležitý: hrana se zakotví v jeho průsečíku s polopřímkou ze středu,
takže šipka končí přesně na hraně kosočtverce i válce — dřív to byl pevný odhad
„38 px od středu“, stejný pro všechny tvary. Lomené hrany mají tvar **L**
(z jednoho uzlu vodorovně, do druhého svisle); dřívější tvar „Z“ vedl středem
mezi uzly a procházel skrz ně. K tomu přibylo: výběr rámečkem a více uzlů
najednou, historie (Ctrl+Z), kopírování, přichytávání k mřížce, posun a
přiblížení plátna, automatické srovnání do vrstev, barvy uzlů, klávesové
zkratky, uložené diagramy přes sdílený `tvary.js` a export do **SVG, PNG, JSON
a Mermaidu** (Mermaid se umí i načíst zpátky, včetně zápisu z jiných nástrojů).
Vyvezený SVG se ořízne na diagram a styly se do něj zapíšou napevno — původní
verze vyvážela výřez okna, takže co bylo mimo, v souboru chybělo. Dvě pasti,
na které došlo při testech: `setPointerCapture` musí být v `try/catch` (u
syntetické události vyhodí `NotFoundError` a shodí celou obsluhu) a
`e.target.matches` v obsluze kláves selže, když událost přijde na `window`.
Kontroly: `_test/diagram_test.js` (kotvení hran po obvodu všech tvarů, zalomení
textu, pravoúhlost lomených hran, převod tam a zpět přes Mermaid, převod
starého formátu), `_test/diagram.html` a `_test/diagram_mobil.html`.

**Papíry na tisk** (`obsah/gridGen.html`) počítají všechno v **milimetrech**, ne
v pixelech: papír se tiskne, ne prohlíží (dřív se zadával rozestup v px při
72 DPI, takže „50 px“ znamenalo 17,6 mm). Vzor se sestaví jako seznam čar,
teček a kružnic v mm papíru a z toho vznikne náhled, tisk, PDF, SVG i PNG —
**jedna geometrie, pět výstupů**; předtím byl každý vzor napsaný třikrát
(náhled, PNG, SVG) a verze se rozcházely. Vzorů je patnáct (čtverečky,
milimetrák, tečky, křížky, linky, izometrie, trojúhelníky, šestiúhelníky,
kosočtverce, notová osnova, tabulatura, kaligrafie, kruhová mřížka…), k tomu
čtrnáct hotových papírů na jedno klepnutí a formáty A3/A4/A5/Letter na výšku
i na šířku. **PDF se kreslí vektorově** (jsPDF `line`/`circle`, komprimované),
ne jako vložený obrázek — soubor je řádově menší a čáry ostré; tečky se kreslí
jako čárka nulové délky s kulatým koncem, protože kružnice je v PDF čtveřice
Bézierů a u dvou tisíc teček z toho byl megabajt. Tiskne se týž SVG, co je
v náhledu, takže výstup odpovídá tomu, co je vidět, a je vektorový; barvu
papíru tiskárna vyplní jen na vyžádání. Šikmé rodiny čar se generují přes
celou plochu a ořezávají se Liang–Barskym, hrany šestiúhelníků se sdílejí
(jinak by je tiskárna přejela dvakrát). Kontroly: `_test/papiry_test.js`
(120 kombinací vzor × nastavení — nic nesmí přetéct z tiskové plochy a SVG
musí být platné XML), `_test/papiry.html` a `_test/papiry_mobil.html`.

**Vykrajovátka** (`obsah/cookieCutter.html`) vytáhnou jeden uzavřený obrys do
výšky: dole límec na prsty (rozšíření ven), nahoře ostří (stěna se zúží na
zadanou tloušťku). Předloh je padesát v šesti skupinách (základní, Vánoce,
Velikonoce, příroda, zvířata, jídlo, věci); jeden katalog (`KATALOG`) plní
rozbalovací nabídku i **galerii náhledů** — mřížku obrysů nakreslených hrubší
mřížkou až po startu stránky, kde se tvar vybírá klepnutím. Jednoduché tvary se
počítají parametricky, složené (perníček, motýl, sněhulák, autíčko…) se skládají
z kruhů, kapslí, elips, obdélníků a mnohoúhelníků a obvod se obkrouží z masky.
**Kusy takového tvaru se musí překrývat**: co se nedotýká, obkrouží se jen jako
největší plocha a zbytek siluety zmizí (takhle se tiše ztratil lístek u jablka
i křídla motýla) — hlídá to `_test/celistvost.js` a stránka to hlásí do konzole.
Sestavená předloha se drží v paměti, aby tahání za tloušťku stěny nepočítalo
masku v každém snímku. Tatáž cesta dělá i **vlastní
předlohy**: text vykreslený na plátno (obtažení slepí písmena k sobě, jinak by
vykrajovátko bylo na několik dílů) a nahraný obrázek (PNG/JPG/SVG, práh podle
průhlednosti nebo jasu). Vnitřní líc stěny a límec vznikají odsazením obrysu;
odsazení se ořízne dvakrát — bod blíž k obrysu, než je odsazení, a bod, který
skončil na jeho špatné straně — a zbylé smyčky se vystřihnou podle orientace.
Když se to nepovede (v nejužším místě už na dvě stěny není místo), stránka to
řekne a model nevygeneruje; pozná to trojím způsobem — odsazený obrys se nesmí
protnout sám se sebou, vnitřní líc musí ležet celý uvnitř obrysu a límec celý
venku (v úzkém místě se odsazení překlopí na druhou stranu, aniž by se obrys
protnul), a plocha dutiny má vyjít zhruba jako plocha zmenšená o pásek stěny
kolem obvodu. Záložka **Půdorys**
kreslí všechny tři obrysy přes sebe, takže je vidět, co odsazení udělalo.
Export: binární STL (v mm a s osou **Z nahoru**, model stojí na podložce), OBJ
a SVG půdorysu 1:1 jako papírová šablona. Uložené tvary vede sdílený `tvary.js`
(klíč `webapp_vykrajovatko_tvary`), poslední nastavení `vykrajovatko_nastaveni`.
Náhled kreslí **každý snímek** — kreslení jen po změně vycházelo hned po startu
prázdné (plátno WebGL první snímek po vzniku bufferu zahodí) a náhled zůstal
černý až do prvního pohybu myší. Kamera se **nepamatuje v milimetrech, ale
v poměru k modelu** (násobek vzdálenosti, ze které je model celý vidět, a posun
v jeho poloměrech): po přegenerování se přepočítá na novou velikost, takže při
změně rozměru ze 60 na 200 mm model z náhledu neuteče a přiblížení ani natočení
se přitom neztratí. Otáčí se kolem bodu, na který se právě dívá, takže
posunutý obraz zůstane posunutý a model při otáčení nikam neposkočí.
Plátnu se velikost nastavuje `setSize(w, h)` **včetně CSS rozměru**: s
`updateStyle = false` má plátno na displeji s DPI 2 dvojnásobek pixelů, ale žádný
CSS rozměr, vykreslí se dvakrát větší než jeho místo a z náhledu zbude roh
modelu. Headless testy běží ve výchozím DPI 1, takže na to nepřijdou — proto je
v `_test/vykr_dpi.py` běh s `--force-device-scale-factor=2`, který porovná CSS
rozměr plátna s kontejnerem.

**Solitaire** (`obsah/solitaire.html`) hraje Klondike s otáčením po jedné kartě
a neomezeným počtem kol balíčku – proto se dá při hledání tahu koukat i do
neotočených karet zásoby, na každou z nich se hráč dostane. Z toho žije
**Nápověda** (najde první užitečný tah; přesun uvnitř stolu nabízí jen tehdy,
když odkryje kartu nebo uvolní sloupec, jinak by posílala karty dokola)
i hláška **„žádný tah už není možný"**, která se ukáže sama po tahu, jímž se
partie zasekne. Tlačítko **Dokončit** se nabídne teprve tehdy, když si odklizení
na základy stránka nanečisto zkusí na kopii stavu a vyjde – pouhé „všechny karty
lícem nahoru" nestačí, karta potřebná na základ může být zavalená vyšší kartou
a automat by se zasekl v půli. Celé dokončení je v historii jeden krok, takže ho
Zpět vrátí najednou. Ze sloupce se smí brát jen sestupná řada střídavých barev
(`jeSekvence`) a na prázdný sloupec smí jen král – jako v pravidlech.

**Markdown → DOCX / ODT** (`obsah/md_dokument.html`) je vedle převodníku taky
**čtečka dlouhých .md souborů**. Tři režimy (Editor / Rozdělené / Čtení, `Alt+1`
až `Alt+3`) — ve **Čtení** zdrojový Markdown zmizí a zůstane jen sázený text
v jednom sloupci; k němu **osnova** z nadpisů se scroll-spy a filtrem (`Alt+O`),
hledání v dokumentu se zvýrazněním a počítadlem nálezů (`Ctrl+F`), **sbalitelné
oddíly** (klik na šipku u nadpisu; tlačítko „Oddíly" sbalí vše), **bloky kódu
s hlavičkou** (jazyk, počet řádků, kopírování, sbalení — i hromadně přepínačem
„Sbalit bloky kódu"), pruh postupu čtení a statistika (slova, znaky, odhad doby
čtení). Osnovu jde **zamknout k místu v textu** (🔒 v její hlavičce, výchozí):
drží aktivní kapitolu uprostřed a posouvá se jen při změně kapitoly, aby
nebojovala s ručním listováním. Rozečtený
text i pozice ve stránce se pamatují v `localStorage`
(`md_dokument_text`, `md_dokument_pozice`), typografie a téma v
`md_dokument_cteni`.

**Vlastní téma stránky** je nad tématem rozcestníku: volba *Podle rozcestníku*
(výchozí) nechá platit `common.css` + `theme.js`, kterákoli jiná (Světlé, Tmavé,
Sépie, Les, Nokturno, Stará knihovna, Vysoký kontrast) zapíše `data-md-tema` na `<html>` a
přebije i zprávu, kterou rozcestník posílá do iframu. Dokument vždy leží na
vlastním **listu** (`.telo`) a plocha kolem něj je „stůl" (`--bg-deep`).
**Sépie** a **Stará knihovna** na ten list kreslí zažloutlý papír: zrno
z `feTurbulence` v SVG jako datová adresa (dlaždice 180 px, žádný soubor navíc)
a nad ním nestejnoměrné nažloutnutí ze dvou radiálních přechodů. Obrázek se váže
k rámu prvku, takže při posouvání textu papír zůstane stát, a při tisku se
vypíná i s rámečkem listu.

**Stará knihovna** je tmavý ořech s mosazným akcentem a papírovým listem — tedy
světlý text v okolí, ale tmavý text na papíře. Proto si témata s papírem
přepisují na `.telo` vlastní sadu proměnných (`--list-text`, `--list-akcent`,
`--list-kod` …): barvy okolí by na papíře byly nečitelné. Ze stejného důvodu
přibylo `--accent-text` (text na akcentní ploše tlačítek) — na mosazi i na žluté
z Vysokého kontrastu bílý text zaniká. Pravidla témat proto stojí
až za `common.css` a každé definuje **celou** paletu, ne jen odchylky; usadit se
musí ještě před vykreslením, o to se stará krátký skript v `<head>`. Nadstavba
sahá jen do DOM náhledu, export do DOCX/ODT pracuje s HTML od `marked`, takže se
do výsledných dokumentů obaly kódu ani kotvy nadpisů nedostanou. Ověřuje to
`_test/md_ctecka.py` (100 kontrol v headless Chromiu) vedle původního
`_test/md_dokument.py`; `_test/md_snimky.html` slouží ke snímkování čtečky
(`?tema=…&rezim=…&osnova=1&hledat=slovo&dolu=px`).

**Poznámky** (panel vpravo, `Alt+P`) se drží **bloku, ke kterému patří**, a
ukládají se na **úplný konec dokumentu** jako HTML komentář — jsou tedy součástí
.md souboru, ale v náhledu, na GitHubu ani v jiných prohlížečích Markdownu
vidět nejsou. Jedním zdrojem pravdy je text v editoru:

```
<!-- md-poznamky
Poznámky ke čtení (stránka „Markdown → DOCX / ODT“): číslo řádku dokumentu a poznámka.
7 {"kotva":"Druhý odstavec o hruškách.","text":"text poznámky"}
-->
```

Číslo je řádek, kde blok začíná, kotva začátek jeho textu. Řádky bloků se
počítají z tokenů `marked.lexer()` (nejvyšší úroveň odpovídá dětem `.telo` jedna
k jedné; nic nevykreslí jen mezery, definice odkazů a HTML komentáře). Po úpravě
textu se poznámka hledá na svém řádku, pak podle kotvy (nejbližší shoda), takže
se s odstavcem posune; nenajde-li se, zůstane u nejbližšího bloku s ⚠ a 📌 ji
připne jinam. `--` v textu poznámky se zapisuje jako JSON `\u002d`, jinak by
komentář ukončilo. Přepsání bloku uprostřed psaní v editoru by rozbilo jeho
historii Zpět, proto se přeskupení zapíše až po opuštění editoru. Značky
poznámek a tlačítko „📝+“ leží ve vlastní vrstvě nad listem (`.pozn-vrstva`,
pozice podle `offsetTop` bloku, přepočet přes `ResizeObserver`) — do bloků se
nesahá, hledání, osnova ani sbalování je nevidí. Do .docx/.odt/.doc jdou
poznámky jen na přání (přepínač v patě panelu) jako příloha na konci;
`window.MD_PRO_EXPORT` z exportu vždy odebere skrytý blok.

**Ukládání** (.md, .docx, .odt, .doc; `Ctrl+S` = .md) jde přes dialog „Uložit
jako“ (`showSaveFilePicker` – Chrome, Edge, Opera). Prohlížeče bez něj (Firefox,
Safari) dostanou klasické stažení a stránka poradí zapnout „Vždy se ptát, kam
ukládat“; zavření dialogu se ohlásí jako zrušené uložení.

**Tisk** má vlastní panel: papír (A4/A5/Letter, orientace, okraje), písmo
a velikost, nová stránka před nadpisem 1./2. úrovně, obsah na začátku, záhlaví
s názvem, čísla stránek „n / celkem“ (okrajové boxy `@page`, Chromium 131+;
Firefox je zatím ignoruje), vypsání adres odkazů, barevné/černobílé nadpisy
a poznámky u odstavců nebo na konci. Proměnnou část skládá `pouzijTisk()` do
`<style id="tiskStyl">`, prvky jen pro tisk (`.jen-tisk`) leží v listu trvale —
nastavení tak platí i pro `Ctrl+P`. Tmavá témata mají `color-scheme: dark`,
tisk ho vrací na světlé, jinak by plátno natřelo tmavě i okraje stránky.
Ověřuje to `_test/md_tisk.py`: vytiskne `_test/md_tisk.html` do PDF a obsah
stránek zkontroluje přes `pdftotext`.

**Celá obrazovka** schová pruh s podpisem: `:root:fullscreen` nastaví
`--podpis-vyska` na 0 (podle ní `podpis.js` odsazuje tělo a zkracuje `100vh`)
a `#autor-podpis` skryje. Rám rozcestníku (`index.html`) má kvůli tomu
`allow="fullscreen"` — bez něj by celou obrazovku z podstránky nešlo zapnout
vůbec.

Po větší změně zvyš verzi cache v `sw.js` (`webapp-vN`) – jinak návštěvník uvidí
novou verzi až při druhém načtení. Metodus má svou vlastní v `../metodus/sw.js`.

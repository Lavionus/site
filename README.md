# sites

Statický web se sbírkou malých HTML aplikací, hostovaný na GitHub Pages
(<https://lavionus.github.io/site/>). Bez backendu, data zůstávají v prohlížeči.

| Cesta | Web | Katalog | Stránky |
|---|---|---|---|
| `/` | hlavní rozcestník – 315 aplikací | `apps.js` | `obsah/` |

## Tři oddělené weby

Výukový web **Metodus** a jeho **ukázková stránka** tady od září 2026 nejsou.
Každý má vlastní složku, vlastní repozitář a vlastní GitHub Pages — schválně,
aby se z jednoho nedalo odmazáním adresy v prohlížeči dojít na druhý:

| Složka (vedle téhle) | Repozitář | Adresa |
|---|---|---|
| `---------------github_site` | `Lavionus/site` | <https://lavionus.github.io/site/> |
| `metodus` | `Lavionus/metodus` | <https://lavionus.github.io/metodus/> |
| `metodus-ukazka` | `Lavionus/metodus-ukazka` | <https://lavionus.github.io/metodus-ukazka/> |

Odkaz vede **jen jedním směrem**: od 19. 10. 2026 (na přání autora) tenhle web
odkazuje na Metodus na plnou adresu `https://lavionus.github.io/metodus/` – z menu
(`index.html`, `.odkaz-metodus`), z úvodní stránky (`obsah/aplikace.html`, oddíl
🎓 Výuka) a ze stránky O projektu. Metodus na tenhle web neodkazuje. Staré
`#obsah/<výuková aplikace>` se dál nepřesměrovávají (neznámý hash otevře
domovskou stránku).

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

**Překladač světů** (`obsah/prekladac_svetu.html`, jádro `prekladac_svetu/jadro.js` = `PRESVETU`,
rozhraní `prekladac_svetu/ui.js`) překládá do 8 vestavěných vymyšlených jazyků (elfština, trpasličí,
skřetí, dračí, mimozemská, robotí, galaktická, řeč mágů – žádný není převzatý z knih či filmů) a do
**vlastních jazyků** z editoru (začátky/jádra/konce slabik, přípony, semínko, slabiky, oddělovač, písmo,
hlas, volby; 🎲 náhodný jazyk; vestavěný se ukládá jako kopie i s lexikonem). Slovo se rozdělí na kmen
a českou koncovku, kořen se poskládá hashem kmene (FNV + mulberry32), koncovka dostane příponu; ~400
běžných slov (`SLOVA`) má tabulku bez shod (shoda → jiná přípona, pak „sůl“ kořene). **Lexikon**
(ruční překlady: jen tvar, nebo celý kmen) má přednost; klik na slovo ve výstupu nebo ✏️ v rozboru,
import/export CSV. Dál rozbor slov (kmen·koncovka → kořen·přípona, zdroj), mezířádkový výstup,
generátor jmen s přídomky, uložené texty (Ctrl+S/O), export TXT/MD/CSV/PNG (PNG kreslí i tengwar,
runy… i vlastní abecedy) a jazyk jako JSON. **Vlastní abecedy** (`prekladac_svetu/abecedy.js` = `ABECEDY`): každý
jazyk má `pismo: 'abeceda', abeceda: {styl, semeno}` – 8 stylů (vlnité, runové, drápance, dračí háky, kroužky pod
linkou, plošné spoje, geometrické, pečetě); znak = tahy na mřížce u,v → obtah Clipperem → TTF exportem Písmolijny
(`pismolijna/jadro/{model,krivky,export}.js`), v prohlížeči `FontFace` (rodina `Abeceda <styl>_<semeno>`), ke stažení .ttf.
Font mapuje a–z, A–Z, diakritiku (č → c), číslice a interpunkci; podobné znaky se přegenerují (podpis na mřížce po čtvrtinách). localStorage: `webapp_prekladac_svetu{,_slova,_jazyky,_lexikon,_texty}`.
Test `node _test/prekladac_svetu_test.js` (vč. 30 náhodných jazyků tam a zpět). **Změna `SLOVA`, hlásek
nebo koncovek změní překlady** (dřív uložené texty se rozejdou).

**Písma: 3D text a Převodník písma** (`obsah/text3d.html`, `obsah/prevod_pisma.html`)
sdílejí složku `obsah/fonty/`: 70 volně šiřitelných fontů (SIL OFL, tři Apache 2.0;
soupis a copyrighty v `fonty/LICENCE.md`, plné znění `fonty/OFL.txt` a `APACHE-2.0.txt`), katalog
a úložiště vlastních fontů `fonty/fonty.js` a přepis do jiných písem
`fonty/prepis.js`. **Vlastní fonty** (TTF/OTF/WOFF/WOFF2) se ukládají do
IndexedDB `webapp_fonty` (localStorage by na soubory nestačil) a obě stránky je
vidí, protože běží na stejném originu. Přepis: tengwar v kódování Free Tengwar /
CSUR (U+E000…) pro font Alcarin Tengwar — samohlásky jako tehtar nad předchozí
nebo následující souhláskou, dlouhé na dlouhém nosiči, `s`/`z` s tehtou jako
nuquerna, `r` před samohláskou rómen, jinak óre, ď/ť/ň dvě tečky pod; dál runy
(futhark), hlaholice, azbuka, alfabeta, ogam, Braillovo písmo (česká tabulka), egyptské
hieroglyfy (jednosouhlásková abeceda), fénické (zprava doleva – 3D text řádky otáčí),
etruské, gótské a Morseovka. **Offline / file://:** 3D text potřebuje bajty fontu
(obrysy čte opentype.js), jenže stránka otevřená z disku nesmí soubor načíst
přes `fetch()`; převodníku to nevadilo, protože písmo kreslí prohlížeč přes
`FontFace(url())`. Proto má každý font kopii jako skript `fonty/js/<soubor>.js`
(base64, vyrábí `fonty/sestav_js.py` – **po přidání fontu spustit**), kterou
`fonty.js` načte, když `fetch()` selže (`_test/pismo_file.py`). 3D text navíc zná
**podložky tiskáren**: obrys v náhledu, kontrola, zda se model vejde (i natočený),
doporučené zmenšení a „regálové“ rozložení samostatných písmen na jednu či víc
podložek. Obě stránky vyplňují výšku okna (výšku plochy dopočítá JS z polohy
pod lištami a z `--podpis-vyska`). **3D text** čte obrysy
glyfů přes `lib/opentype.min.js` (křivky se dělí podle průhybu, odchylka
0,03 mm) a sjednocuje je přes `lib/clipper.min.js` (Clipper 6.4.2, Boost
licence) — psací písma i diakritika se překrývají a bez sjednocení by šablona
nebo rytina vyšly s překříženými dírami. Režimy jen písmena / reliéf na desce /
vyrytý (volitelně s výplní druhou barvou) / prořezaná šablona jsou jen
vytažení 2D oblastí v různých výškách (rozdíly oblastí dělá Clipper), žádné 3D
booleovské operace. Znaménka s nulovou šířkou (tehtar) se vystředí nad
předchozí písmeno, protože opentype.js neumí kotvy GPOS. Earcut na víku občas
nechá T-spoj (vrchol díry na hraně trojúhelníku) — `opravTSpoje` najde
nespárované hrany a trojúhelník v tom bodě rozdělí; bez toho slicery hlásí
„opravené chyby“. Export: STL (celek / text / deska), **3MF s deskou a textem
jako dvěma díly jednoho objektu** (ve sliceru se jim jen přiřadí filamenty),
ZIP s každým souvislým kusem zvlášť a SVG obrysu. Geometrie je vystavená jako
Výběr fontu na obou stránkách je sdílená komponenta `FONTY.vyberFontu` (tlačítko s ukázkou a panel s hledáním, druhy a mřížkou náhledů vlastního textu; panel je `position: fixed` a umisťuje se podle tlačítka, jinak by ho ořízl rolovací boční panel). **Prázdná políčka u tengwaru** mimo stránku nejsou chyba: znaky leží v soukromé oblasti Unicode a bez nainstalovaného fontu je nic nenakreslí — převodník proto nabízí obrázek, „Kopírovat pro Word“ (HTML s názvem fontu) a stažení fontu; otevření přes `file://` hlásí, že fonty nejde načíst. `window.TEXT3D` a testuje se v node nad všemi fonty a režimy (`_test/text3d_tesnost.js`: těsnost hran,
kladný objem); prohlížečová kontrola obou stránek `_test/pismo_snimky.py [dpi]`.

**Návrhář turbín a proudění** (`obsah/turbina_navrhar.html`) má čtyři pohledy
na jeden návrh: 2D výkres řezu rotorem (vlastní editor s mnohoúhelníky,
křivkami, profily NACA, lopatkami, rotačním polem, undo, export SVG), 2D simulaci
proudění mřížkovou Boltzmannovou metodou (D2Q9, BGK + Smagorinsky, odraz od
pohybující se stěny, moment výměnou hybnosti → Cp, automatické proměření
Cp(λ)), 3D model s animovanými stopami proudu (export STL/OBJ v mm) a analýzu:
vrtule a Kaplan přes BEM (Prandtl, Buhl, poláry s Viternovou extrapolací),
Darrieus přes MST (Strickland), Savonius empiricky, Pelton a Bánki Eulerovou
rovnicí, Tesla bilancí momentu hybnosti mezi disky. Ruční úprava výkresu přepne
typ na „Vlastní tvar“ (3D = vytažení výkresu). Rotor se v LBM otáčí ⟲ (Bánki ⟳,
výkres je proto zrcadlený). LBM běží při Re ~ 10²–10³, takže Cp vychází nižší
než v literatuře — slouží k porovnání tvarů. Testy: `_test/turbina.py`
(modely, stabilita, 3D těsnost listu), `turbina_krivka.py`, `turbina_dpi.py`,
`turbina2.py` (předlohy, pohon, vazba proud ↔ rotor), `turbina3.py` (každý stroj ve svém okolí, 2D i 3D).
**Od 25. 9. 2026 jeden řešič pro 2D i 3D**: 3D částice nese pole řešiče a úhel rotoru je z řešiče
(dřív šlo o předepsané kinematické pole, které na rotor nereagovalo). **Okolí stroje** (`okoli()`)
dává oblast výpočtu, typy okrajů (`vstup` rychlost, `tlak` spád, `vystup` tlak bez zpětného proudu,
`volne`) a stěny jako tvary s příznakem `okoli` – u osových strojů navíc `lathe` profil pro 3D rotaci.
**Osové stroje**: meridiánový řez s osově souměrnými členy (zdroj hmoty −ρu_r/r, hybnost −ρu·u_r/r
+ vazké členy) a aktuátorovým diskem svázaným s BEM prvky listu; ověřeno proti teorii hybnosti
(C_T = 0,89 → rychlost v disku 0,64, úplav 0,32; teorie 0,67 / 0,33). **Pozor na Guův zdroj síly:**
činitel 1 − 1/2τ platí jen s posunem rovnovážné rychlosti o F/2ρ – bez něj se při τ ≈ 0,52 do proudu
dostalo jen 5 % síly disku. **Tenké listy** (Darrieus, Bánki) jsou aktuátorové čáry (Gaussovo jádro
ε ≈ 2 buňky); Darrieus pak dává λ ≈ 4, Cp ≈ 0,45 (MST 0,40–0,46). Turbíny s dýzou mají tlakový vstup
(spád), jinak se při přiškrcení kolem tlak neomezeně zvyšoval. Rozkmitání u Peltonu způsoboval roh
dýzy uvnitř obálky lžic – hubice musí ležet vně ≈ 1,2 Rp. Ponořený paprsek se u kola ohýbá (jednofázový
model), proto míří o kus výš.
Galerie **📚 Předlohy** (33 návrhů) je v `Predlohy.SEZNAM`. **Režim pohonu motorem**
(`TYPY[typ].pohon`, parametry ve `stav.pp`) počítá vrtule a lodní šrouby přes BEM
s indukovanou rychlostí (bisekce, funguje i pro statický tah), míchadla výkonovým
číslem Np, tangenciální ventilátor bezrozměrnou charakteristikou a Teslovo
čerpadlo. **Rotor ve 3D reaguje na proud**: J·dω/dt = M_proud(ω) − k·ω² − tření,
kde M_proud(ω) je z výkonové křivky modelu (`dynZTabulky`); časové měřítko
zobrazení se drží, dokud se nezmění typ, takže je vidět zrychlení při silnějším
proudu. Tření 4 % jmenovitého momentu způsobí, že štíhlý Darrieus ani vrtule bez
natočení listů se z klidu nerozběhnou. Ve 2D je volný rotor výchozí; okamžitý moment
z LBM má při zakrývání buněk stěnou velké špičky, proto jde do dynamiky přes dolní
propust (~250 kroků).

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

**Markdown → DOCX / ODT** (`obsah/md_dokument.html`) má od 4. 11. 2026 horní lištu
s nabídkami jako generátory (Soubor / Zobrazení / Poznámky / Změny; ovládání sdílené
`trubky_gui.js`, CSS lišty zkopírované – celé `trubky_gui.css` by přepsalo `.plocha`),
režimy a hledání zůstávají přímo na liště. Je vedle převodníku taky
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
`_test/md_ctecka.py` (přes 130 kontrol v headless Chromiu) vedle původního
`_test/md_dokument.py`; `_test/md_snimky.html` slouží ke snímkování čtečky
(`?tema=…&rezim=…&osnova=1&hledat=slovo&dolu=px`).

**Poznámky** (panel vpravo, `Alt+P`) jsou od 4. 11. 2026 **stejné jako ve čtečce
Kronik**: označ v náhledu pár slov → lišta s barvou / 📝 poznámkou / 🗑. Drží se
mimo text dokumentu (`webapp_md_dokument_poznamky`, pole `zvyrazneni` a `cizi`
jako `webapp_kroniky_poznamky`); zvýraznění zná pořadí bloku (dítě `.telo`),
rozsah znaků v jeho textu a citaci, podle které se po úpravě textu dohledá.
Patří k dokumentu podle jména načteného souboru. Soubor poznámek (⬇ Uložit /
📂 Načíst) je formát `kroniky-poznamky` – Markdown pro člověka a balík JSON
v HTML komentáři na konci; obě stránky si ho přečtou navzájem (test
`_test/md_dokument_jadro_test.js` to ověřuje proti `ctecka/jadro.js`).
Načtené poznámky čtenáře se ukážou vlnovkou a jdou převzít mezi svoje; ze
souboru z Kronik se ukážou ty, jejichž citace v dokumentu je. „💾 .md“ přidá
balík na konec dokumentu (vypínatelné), při načtení se z textu zase vyjme.
Staré poznámky (`> [!poznámka]` pod odstavcem, skrytý `<!-- md-poznamky -->`)
se při načtení převedou na zvýraznění první věty odstavce a z textu zmizí. Do
.docx/.odt/.doc jdou poznámky jen na přání jako příloha (`window.MD_PRO_EXPORT`).

**Změny** (Δ, `Alt+Z`): stránka si pamatuje *zkontrolovaný text*
(`webapp_md_dokument_zaklad`) a každý rozdíl proti němu je změna – z editoru,
z kódu vpravo i po **⟳ Znovu načíst** (týž soubor z disku; rozdíly proti
zkontrolovanému textu se ukážou jako změny, místní neuložené úpravy se před
přepsáním ohlásí). Rozdíl po řádcích počítá `MD_JADRO.rozdil` (Myers, nad 1500
úprav jeden velký úsek). Panel ukáže úseky s původním a novým textem, ✓ úsek
přenese do zkontrolovaného textu, ↶ vrátí původní; změněné bloky mají v náhledu
proužek vlevo. Přístup k souboru pro znovunačtení drží `FileSystemFileHandle`
v IndexedDB `webapp_md_dokument` (Chrome/Edge; jinak se soubor vybere znovu).
**📂 Načíst** = nový dokument (zkontrolovaný text = soubor). **📄 Nový** založí prázdný dokument
(zeptá se na název; nahradil dřívější 🗑️). Uložení .md přes dialog „Uložit jako“
udělá z uloženého souboru dokument – ⟳ ho pak čte a poznámky jdou s ním.

**Rozdělené zobrazení** drží editor a náhled na stejném místě oběma směry:
poloha řádku v zalamovaném `textarea` se změří na skrytém zrcadle (stejné
písmo a šířka), mezi bloky se interpoluje lineárně; posun, který stránka
udělala sama, se 150 ms neodráží zpět. Režim **Dva náhledy** (`Alt+4`) ukáže
dokument dvakrát: levý jde s osnovou, pravý (`#nahled2`) má vlastní hledání
a skok na kapitolu. Pravý jde přepnout **Náhled / Kód**; kód se dá upravit
a „💾 Uložit změny“ (`Ctrl+S` v kódu) ho přepíše do dokumentu (→ Δ Změny).
**🔗 Vázat** spojí posouvání obou panelů (náhled i kód) stejným mechanismem
jako rozdělené zobrazení.

**Samostatná verze** (bez vazby na web, jeden soubor) se generuje příkazem
`node tools/samostatne.mjs` do `../Samostatne_stranky/md_dokument.html` – po
změně stránky přegenerovat. `podpis.js` vynechá, `theme.js` nahradí tématem
podle systému, stránka to pozná podle `window.SAMOSTATNA_STRANKA`. Bez jakéhokoli
odkazu na web (přání autora): komentáře pryč (esbuild), náhrady textů u stránky,
kontrola zakázaných výrazů, vpravo dole jen `vN · © 2026 hdm@seznam.cz` (verze
stránky z gitu jako `tools/verze.mjs`). Uložená nezměněná ukázka ze starší verze
(jiný odkaz) se při startu nahradí aktuální ukázkou. Nová viditelná
zmínka o webu/Kronikách v md_dokument → doplnit náhradu, jinak sestavení selže.
Test samostatné verze: zkopírovat do `_test/md_samostatna.html` a
`MD_STRANKA=md_samostatna.html python3 _test/md_ctecka.py` (2 kontroly rozcestníku
a podpisu tam selžou záměrně).

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

## Úpravy souborů a generátory (29. 10. 2026)

Dvanáct stránek, vše lokálně v prohlížeči; jádra bez DOM s testy `node _test/<jmeno>_test.js`.
Nové knihovny: `obsah/lib/pdflib/` (pdf-lib + fontkit, MIT; Liberation Sans OFL),
`obsah/lib/pdfjs/` (PDF.js 4.10, Apache 2.0), `obsah/lib/onnx/` (onnxruntime-web 1.22, MIT + model u2netp, Apache 2.0),
`obsah/lib/tesseract/eng.traineddata` (Apache 2.0).

**PDF dílna** (`obsah/pdf_dilna.html` + `obsah/pdf_dilna/{jadro,ui}.js`) je
práce s PDF celá v prohlížeči nad pdf-lib (`obsah/lib/pdflib`) a PDF.js
(`obsah/lib/pdfjs`, náhledy). Načte víc PDF i obrázků (JPG/PNG/WebP → stránka
na A4 nebo ve velikosti obrázku, JPEG s EXIF otočením se srovná), ukáže mřížku
náhledů s barevným proužkem původního souboru; stránky jde vybírat (Ctrl/Shift,
na dotyku klepnutím), přetahovat myší, otáčet, duplikovat, mazat, vkládat
prázdné a obracet pořadí. Export spojí vše do jednoho PDF, **Rozdělit** stáhne
ZIP (po N stránkách, podle rozsahů `1-3,5,8-`, každá zvlášť; vlastní ZIP
„uloženo“ + CRC32), „Vyjmout vybrané“ uloží výběr. Nástroje s živým náhledem
stránky: vodoznak (text s diakritikou přes fontkit + Liberation Sans, krytí,
úhel, dlaždice, nebo obrázek), číslování (`{n} / {celkem}`, pozice, okraj, od
stránky, první číslo), záhlaví/zápatí se značkami, ořez okrajů v mm, změna na
A4 a **zmenšení velikosti** rastrováním přes PDF.js do JPEG (DPI, kvalita,
odstíny šedi; varování, že text přestane jít označit). Podpis se kreslí myší
či prstem nebo nahraje (s odstraněním bílého pozadí) a umístí rámečkem na
náhledu; razítko je vektorový text s rámečkem a `{datum}`. Metadata jde
nastavit i úplně odstranit (Info + XMP). Model: stránky odkazují do neměnných
zdrojů, úprava obsahu vyrobí nový zdroj jen z dotčených stránek → Zpět/Znovu
jsou snímky seznamu. Souřadnice nástrojů jsou „vizuální“ (`naUzivatel`), takže
text i podpis sedí i na stránkách s `/Rotate`. Šifrovaná PDF se slušně
odmítnou (pdf-lib je neotevře ani nevytvoří, XFA neumí). Rozpracovaná práce
se ukládá do IndexedDB `webapp_pdf_dilna`, nastavení do
`webapp_pdf_dilna_nast`. Test jádra `node _test/pdf_dilna_test.js` (polohy
textu ověřuje přes poppler `pdftotext -bbox`, šifrování přes qpdf).

**OCR – text z obrázku a skenu** (`obsah/ocr.html`, moduly `obsah/ocr/`) převádí
fotky, skeny a PDF na text přímo v prohlížeči (Tesseract.js 5 z `lib/tesseract`,
modely `ces` a `eng` z tessdata_fast, přepínač ces / eng / ces+eng). Vstup: více
obrázků najednou, přetažení, `Ctrl+V` ze schránky, PDF (vybrané stránky se
rasterizují přes PDF.js v 150–400 DPI). Jádro `ocr/jadro.js` (`window.OCR`, bez
DOM) dělá předzpracování nad polem ve tvaru ImageData: otočení o 90° i o libovolný
úhel (bilineárně, plátno se zvětší), ořez, zvětšení, šedá, vyrovnání úrovní,
kontrast/jas, medián 3×3, práh Otsu nebo adaptivní Sauvola (integrální obrazy;
polarita textu se pozná podle bodů výrazně tmavších/světlejších než místní
průměr, takže ji nezmate stín). Sklon odhaduje promítnutím černobílé zmenšeniny
(nejostřejší profil řádků, krok 0,5° a pak 0,1°). Geometrie (otočení, ořez,
oblasti) se pamatuje u stránky v normalizovaných souřadnicích, úpravy pro čtení
platí pro všechny stránky; náhled počítá stejný řetězec nad zmenšeninou do
1 400 px (bez zvětšení). Oblasti myší se čtou zvlášť (`rectangle`, PSM 6)
v pořadí čísel (ručně ↑↓ nebo `seradOblasti` po řádcích/sloupcích), bez oblastí
celá stránka (PSM 3). Text se skládá ze slov Tesseractu (`slozText`), každé slovo
si nese pozici v textu, takže klik na slovo v náhledu ho označí v textu (po
úpravách textu se hledá nejbližší výskyt); slova pod prahem jistoty jsou
oranžová. Export: kopírování, TXT stránky/všech, **prohledávatelné PDF** přes
pdf-lib + fontkit s Liberation Sans – obraz (barevný JPEG nebo zpracovaný PNG)
a neviditelný text (render mode 3) slovo po slovu, roztažený matice textu na
šířku slova (`vrstvaTextu`); opravy z textu se přenesou, když sedí počet slov.
Worker Tesseractu vzniká až při prvním čtení, dávka ukazuje průběh a jde zrušit
(`Esc` – worker se ukončí a příště vznikne znovu). Testy: `node
_test/ocr_test.js` (90 kontrol jádra) a snímky přes `_test/snimek_cela.py`
s ukázkovým generovaným skenem (natočení, stín, šum).

**Hromadné úpravy obrázků** (`obsah/obrazky_davka.html`) zpracují celou složku
najednou – soubory i složky jdou vybrat (`webkitdirectory`) nebo přetáhnout
(rekurzivně přes `webkitGetAsEntry`, podsložky se pamatují a do ZIPu i do složky
se dají zachovat). Vlevo se skládá **řetěz kroků** (ořez na poměr ze středu,
volitelně otočený podle orientace fotky; změna velikosti podle delší strany,
šířky, výšky, procent nebo do rámečku s „jen zmenšovat“; jas/kontrast/sytost;
stupně šedi; ruční otočení a zrcadlení; okraj v px nebo % kratší strany;
vodoznak textem či logem v 9 pozicích nebo jako dlaždice), pod ním výstup
(JPEG/WebP/PNG/AVIF – AVIF jen když ho prohlížeč umí zakódovat, zjišťuje se
`toBlob`; kvalita; **cílová velikost** binárním hledáním kvality) a vzor jmen
(`{nazev}`, `{n:3}`, `{datum:YYYYMMDD_HHmmss}` z EXIF DateTimeOriginal, jinak
datum změny souboru, `{sirka}x{vyska}`, `{ext}`; kolize dostanou `_2`…).
Orientaci z EXIF aplikuje už dekodér (`createImageBitmap(..., {imageOrientation:
'from-image'})`), výstup přes plátno EXIF ani GPS nenese – fotky s polohou mají
v seznamu značku 📍 GPS. Náhled před/po s porovnávacím posuvníkem a odhad
úspory pro celou dávku. Zpracování běží ve 1–3 workerech přes `OffscreenCanvas`
(záložně v hlavním vlákně) s průběhem a zrušením (`Esc`); uložit jde ZIP
(vlastní zapisovač „uloženo“ s CRC32 a UTF-8 jmény), jednotlivě nebo přímo do
složky přes `showDirectoryPicker`. Řetězy jdou ukládat jako předvolby
(`webapp_obrazky_davka_predvolby`, aktuální stav `webapp_obrazky_davka_nastaveni`),
logo vodoznaku leží v IndexedDB `webapp_obrazky_davka`. Jádro bez DOM
(`obrazky_davka/jadro.js`: rozměry, šablona jmen, čtečka hlaviček a EXIF pro
JPEG/PNG/WebP/GIF/BMP, úpravy pixelů, binární hledání, ZIP) testuje
`node _test/obrazky_davka_test.js` (87 kontrol, ZIP ověřuje Python `zipfile`
a `unzip -t`, skutečné vzorky vyrábí `_test/obrazky_davka_vzorky.py` přes PIL);
kreslení je v `obrazky_davka/vykresli.js`, sdílené workerem i hlavním vláknem.

`obsah/pozadi.html` – **Odstranění pozadí** (jádro `obsah/pozadi/jadro.js` = `window.POZADI`,
UI `obsah/pozadi/stranka.js`). Automaticky AI modelem přímo v prohlížeči: U²-Net
`u2netp` (Apache 2.0, 4,6 MB) přes onnxruntime-web 1.22.0 jen s wasm backendem
(`obsah/lib/onnx/`, MIT, viz README.txt); prostředí i model se stahují až po
kliknutí s průběhem (wasm se předává přes `ort.env.wasm.wasmBinary`, jedno
vlákno – GitHub Pages nejsou crossOriginIsolated). Model běží na zmenšenině
320×320, maska se na plné rozlišení přenáší rychlým řízeným filtrem podle jasu
obrazu (hrana sedne na obrys), pak úrovně a čištění ostrůvků. Bez AI: klíčování
barvou (vzdálenost v CbCr přepočtená na jas pixelu – stíny na plátně zůstanou
pozadím, měkkost, potlačení přesvitu) a kouzelná hůlka (souvislý/globální výběr,
přidat/odebrat, Alt otočí). Ruční doladění štětcem obnovit/vymazat (velikost,
tvrdost, tahy se nesčítají), zoom/posun/štípnutí, náhled masky a červený
překryv, undo/redo (hloubka podle paměti), zúžení/rozšíření hrany přes
vzdálenostní pole, feather, „přimknout k obrazu“, invertovat, uložit/načíst
masku. Výstup PNG/WebP/JPEG, průhledné nebo nové pozadí (barva, rozmazaný
originál, vlastní obrázek), ořez na obsah s okrajem, stín (v ‰ delší strany).
Pracuje do 8192 px delší strany. Dvě kreslené ukázky (zátiší pro AI, zelené
plátno pro klíčování). Testy: `node _test/pozadi_test.js` (57 kontrol).

**Vektorizace** (`obsah/vektorizace.html`, jádro `obsah/vektorizace/jadro.js`
= `window.VEKTORIZACE`, trasování ve Workeru `vektorizace/worker.js`, ovládání
`vektorizace/ui.js`) převádí bitmapu na SVG/DXF vlastní implementací čistou
místností (potrace je GPL, z něj nic). Obrys se sleduje **po hranách pixelů**
s pevným pravidlem odbočení na křižovatkách, takže vnější obrysy vycházejí
kladně a díry záporně orientované. Vnoření (díra v rámu, ostrov v díře) se
určí přes nejmenší obsahující smyčku opačného znaménka a SVG kreslí
`fill-rule="evenodd"`. Vyhlazení: rohy k-kosinovou mírou (práh úhlu, poloha
upřesněná průsečíkem stran) → úsek mezi rohy se pokryje co nejdelšími
**digitálními přímkami** (odchylka ≤ eps) → každou hranu nahradí přímka
proložená jejími body (PCA), vrcholy = průsečíky → v hladkých vrcholech
kvadratika ze středu hrany do středu další (spojitá tečna) → **korekce
plochy** posunem po normále na plochu mřížkového obrysu → zhuštění kubikami
(Schneider, nejmenší čtverce + Newton) s doladěním délky táhel na plochu.
Bez toho proložení na surových schodech dělalo hrboly a kruh ztrácel 2 %
plochy; teď je odchylka plochy kruhu, čtverce s dírou i písmene pod 1 %.
Hladká smyčka bez rohů se dělí na 4 části (dvě kubiky kruh nevystihnou).
Režimy: **černobílý** (Otsu / ruční práh, invert), **vícebarevný** (k-means++
nebo median cut s posunem dělení na změnu hodnoty; malé oblasti se sloučí se
sousedem; vrstvy „na sobě bez mezer" = každá vrstva je sjednocení své a všech
vyšších barev, nebo „vedle sebe" pro řezání), **obrys k řezání** (jen čáry)
a **středová čára** (Zhang–Suen, graf kostry s m-sousedstvím bez trojúhelníků,
ořez výběžků). Předzpracování: ořez tažením, automatické zvětšení malých
obrázků (bilineárně, max 4,5 Mpx), rozostření. Náhled vedle sebe / posuvník /
prolnutí, lupa a posun (i dvěma prsty), uzly (rohy čtverečkem). Výstup SVG
(zaokrouhlení, relativní příkazy počítané ze zaokrouhlených souřadnic, jedna
cesta na barvu, fyzická šířka v mm), DXF R12 (POLYLINE po vrstvách, ACI barva,
křivky zploštěné s odchylkou v mm, osa y nahoru) a PNG přes vykreslené SVG.
Poslední obrázek v IndexedDB `webapp_vektorizace`, nastavení
`webapp_vektorizace_nastaveni`. Testy: `node _test/vektorizace_test.js`
(76 kontrol – kruh, kruh AA ×2, čtverec s dírou a ostrovem, písmeno A,
skvrny, Otsu, barvy oběma kvantizacemi, průhlednost, středová čára, SVG/DXF,
výkon 600×600 pod 4 s).

**GIF, animace a sprite sheety** (`obsah/animace_gif.html`) skládá animace ze
snímků. Vstupem jsou obrázky (řazené podle názvu), animovaný GIF (vlastní
dekodér s LZW, prokládáním, disposal 1/2/3 a průhledností), video (úsek a FPS,
snímky přes Mediabunny `CanvasSink`, záloha posouváním `<video>`) a sprite sheet
(řez podle mřížky – počet buněk nebo velikost, okraj, mezera – nebo automaticky
podle souvislých oblastí na průhledném či barevném pozadí, blízké části se
slučují). Časová osa umí výběr Shift/Ctrl, přeřazení tažením, délku snímku
jednotlivě i hromadně, duplikovat/smazat, obrátit, ping-pong, onion skin
a přehrávání s rychlostí; úpravy ořez (tažením), změna velikosti (nejbližší
soused pro pixel art, plynule plošným filtrem), otočení/zrcadlení a text přes
animaci (obrys, ostré hrany). Výstupy: GIF z vlastního kodéru (median-cut nebo
oktanový strom, přesná paleta pro ≤ 256 barev, společná/lokální paleta,
Floyd–Steinberg, ukládání jen změněného obdélníku s průhledností pro
nezměněné pixely, smyčky), APNG (vlastní zápis bloků s CRC, zlib přes
`CompressionStream`, adaptivní filtry řádků), WebM přes Mediabunny
`CanvasSource` (VP9/VP8/AV1 podle prohlížeče), sprite sheet PNG + JSON
TexturePacker „hash“/„array“ (trim, `duration`, `meta.frameTags`) v ZIPu
a ZIP jednotlivých PNG (zapisovač „uloženo“ + CRC32). Odhad velikosti kóduje
vzorek ze středu animace ve workeru (`animace_gif/worker.js`). Jádro bez DOM je
`obsah/animace_gif/jadro.js` (`window.ANIMACE_GIF`), UI `animace_gif/stranka.js`;
rozpracovaná animace se ukládá do IndexedDB. Test jádra
`node _test/animace_gif_test.js` (kulatá cesta GIF/APNG/LZW, kontrola s Pillow,
ZIP přes Python `zipfile`, balení a řez sprite sheetů).

**Editor titulků** (`obsah/titulky.html` + `obsah/titulky/{jadro,app}.js`) čte
a zapisuje **SRT, WebVTT, ASS/SSA, SBV, MicroDVD (SUB) a TXT**. Jádro
(`window.TITULKY`, v node `require`) nemá DOM: titulek je `{id, od, do, text,
styl, akter}` s časy v ms a textem se značkami `<i> <b> <u>` jako v SRT; ostatní
ASS přepisy (`{\pos(…)}`) zůstávají v textu, takže ASS → ASS je bezztrátové
a do SRT se přenese jen `{\an8}`. **Kódování** se pozná samo (BOM, UTF-16 bez
BOM, platné UTF-8, jinak skóre českých písmen mezi windows-1250, ISO-8859-2
a windows-1252) a jde ručně přepnout ve stavovém řádku; ukládá se vždy UTF-8,
volitelně s BOM a CRLF. MicroDVD přepočítává snímky ↔ čas podle FPS (i z řádku
`{1}{1}23.976`). Přečasování: posun všeho/výběru/od výběru, změna FPS
(23,976 ↔ 25) a lineární synchronizace podle dvou bodů. Kontrola kvality hlídá
překryvy, délku, CPS, délku a počet řádků, prázdné a malé mezery; automatické
opravy zalamují na 2 vyvážené řádky (předložka nezůstane na konci), prodlužují
krátké a dorovnávají mezery. Video běží v `<video>`, titulky se kreslí na plátno
**stejnou funkcí jako při vypálení** (`kresliTitulkyNa`), vlna zvuku se čte
proudově přes Mediabunny (`AudioBufferSink`, nejvýš 4 h, záloha WebAudio do
150 MB). Bloky na ose se táhnou (posun i okraje), klávesy A/S/D (F3/F4/F9 i při
psaní) nastavují časy, režim **Přepis** zachytí začátek při prvním písmenu.
**Vypálení** jde přes `MB.Conversion` s `video.process` (WebCodecs), bez nich
stránka srozumitelně odmítne. Rozpracovaný projekt se ukládá do IndexedDB
`webapp_titulky`. Testy: `node _test/titulky_test.js` (jádro vč. kulatých cest
a kódování).

**Generátor karet a kartiček** (`obsah/karty_generator.html` + `obsah/karty_generator/`)
skládá hromadně karty z šablony a tabulky – vlastní deskovky, flashcards, RPG
předměty a kouzla, kvízové a slovíčkové kartičky, karty úkolů. Šablona je
seznam vrstev v milimetrech (text, ikona/emoji, obrázek, tvar, rámeček) pro
líc i rub; ve všech textových vlastnostech, i v barvách, fungují proměnné
`{sloupec}`, `{sloupec|výchozí}`, `{#}` a `{celkem}`. **Podmíněné styly** mění
vlastnost vrstvy podle hodnoty sloupce (barva rámečku podle „vzácnosti“, červené
♥ ♦, skrytí prázdné možnosti D). Text se zalamuje a **zmenší písmo, aby se vešel**;
měření je v jádře injektované (v prohlížeči z plátna, v testu odhadem), takže
stejný algoritmus hlídá přetečení i v souhrnu před tiskem. Data se píšou
v mřížce (vložení bloku z Excelu Ctrl+V, přejmenování sloupce přepíše proměnné
v šabloně) nebo importují z CSV/TSV (oddělovač se odhadne) a XLSX/ODS přes
SheetJS; sloupec `pocet` určuje kopie. Obrázky se nahrají hromadně do IndexedDB
a přiřazují se **podle jména souboru** (i bez přípony). Formáty poker, bridž,
tarot, mini, A7… nebo vlastní, spadávka, bezpečná zóna, zaoblené rohy.
Rozložení na A4/A3/Letter volí orientaci s nejvíc kartami, kreslí ořezové
značky a volitelně obrys řezu; **rub se zrcadlí** podle hrany překlápění, a když
by po obrácení karty stál vzhůru nohama (otočené karty, krátká hrana), otočí se
o 180°; posun rubu dorovná nepřesnou duplexní tiskárnu. Výstupy: PDF přes
pdf-lib (karty jako obrázky v nastaveném DPI, každá jedinečná karta vložená
jednou), tisk přes prohlížeč se stejným rozložením a PNG všech karet v ZIPu
(metoda „uloženo“ + CRC32). Projekty se ukládají průběžně do IndexedDB, s
historií zpět/znovu; export JSON i s obrázky. Sedm předloh (hrací karty 52 ks,
flashcard, RPG předmět, RPG kouzlo, kvíz, slovíčka, úkol) je jen z tvarů
a emoji. Kontroly: `_test/karty_generator_test.js` (217 kontrol: proměnné,
podmínky, CSV, kopie, zalomení a písmo, rozložení, zrcadlení a otočení rubu,
značky, hledání obrázků, normalizace projektu, všechny předlohy).

**Hromadný tisk štítků** (`obsah/stitky_hromadne.html` + `obsah/stitky_hromadne/{jadro,vykres,ui}.js`)
tiskne adresní štítky, cenovky, jmenovky, inventární a kuchyňské štítky na samolepicí
archy A4. Postup je ve čtyřech kartách: **Arch** (databáze 28 běžných archů Avery
Zweckform 3474/3475/3651/3657/3666… a Avery L7160/L7163/L7651…, hledání podle
rozměru `70x37` i kódu, vlastní arch a papír, „moje archy“, kontrola přesahu a okrajů,
kalibrace posunu tiskárny X/Y se zkušebním tiskem obrysů), **Data** (editor mřížky
s vkládáním bloků z Excelu, import CSV/TSV s poznáním oddělovače a hlavičky, XLSX/ODS
přes SheetJS, kopie záznamu, začátek od N-tého štítku načatého archu, výběr `1-5, 9`,
číslování s předponou/nulami jako pole `{cislo}` i bez tabulky), **Návrh** (text
s poli `{jmeno}` s automatickým zmenšením a zalamováním, QR kód, EAN-13/EAN-8/Code 128,
obrázek, rámeček; prvky se táhnou myší a jejich polohy jsou v % vnitřní plochy, takže
návrh pasuje i na jiný arch) a **Náhled a tisk**. Jádro bez DOM rozloží každý štítek do
primitiv v milimetrech (text, obdélníky, rámeček, obrázek) a z nich vzniká **náhled
i tisk jako SVG v přesných mm** (`@page` podle papíru) a **vektorové PDF** v jsPDF —
jedna geometrie, dva výstupy. Text se měří písmem Liberation Sans načteným přes
FontFace a stejné písmo se vkládá do PDF, takže zmenšení písma sedí v obou. Logika
čárových kódů je převzatá z Generátoru čárových kódů (tam je vložená ve stránce).
Projekty včetně obrázků jsou v IndexedDB, export/import JSON. Rozměry archů jsou
z katalogů výrobců (stav 10/2026) a ve stránce označené „ověřit podle balení“.
Kontroly: `_test/stitky_hromadne_test.js` (201 kontrol – archy, geometrie, rozdělení
na archy, CSV, číslování, EAN/Code128, rozvržení textu, předlohy, SVG a PDF výstup).

**Vstupenky, kupóny a poukazy** (`obsah/vstupenky.html` + `obsah/vstupenky/`)
vyrábí série tiskovin s unikátním číslem a u vchodu je kontroluje. Sedm
předloh (vstupenka s ústřižkem, dárkový poukaz DL, slevový kupón, tombola –
los + kontrolní ústřižek, šatnový lístek, stravenka, parkovací lístek),
ústřižek vlevo/vpravo/dole s perforací. Číslování řadou (od–do, krok, nuly,
předpona/přípona) nebo náhodnými unikátními kódy z abecedy bez záměnných znaků
(0/O/1/I), semínko z `crypto.getRandomValues` a deterministický xoshiro128**
(náhled se nemění), varování, když je platný víc než každý 10 000. kód;
kontrolní znak Luhn mod N nad libovolnou abecedou nebo Damm. Generátor sedadel
zápisem `A-F: 1-20`, `Balkon | 1-3: 1-12 liché`, `vynechat: A1 B/7` – kus na
každé místo. Texty s proměnnými (`{kod}`, `{rada}`, `{misto}`, `{url}`…), QR
(`lib/qrcode`, i URL se `{kod}`) a Code 128 – všechny prvky se tahají myší
v náhledu. Kreslí se jedním rendererem (`kresli.js`) do plátna: náhled, arch
(automatické otočení kusu, vystředěná mřížka, ořezové značky jen vně mřížky),
tisk přes `@page` v mm i PDF (jsPDF, obrázky kusů v 200–400 DPI + vektorové
značky). CSV vydaných kódů je zároveň vstupem režimu **Kontrola na vstupu**:
seznamy v IndexedDB, skenování kamerou (BarcodeDetector, jinak zxing-wasm),
ruční čtečky přes Enter, kód z URL v QR (`?kod=` nebo poslední úsek cesty),
výsledek platný / už použitý (s časem) / neznámý / překlep v kontrolním znaku,
zvuk + vibrace, vrácení posledního odbavení, export stavu a sloučení stavu
z jiného zařízení. Jádro bez DOM (`vstupenky/jadro.js`, `window.VSTUPENKY`)
testuje `node _test/vstupenky_test.js` (506 kontrol; Code 128 se ověřuje
skutečným dekodérem zxing-wasm v node).

**🧩 Generátor puzzle z fotky** (`obsah/puzzle_generator.html` + `puzzle_generator/{jadro,vystup,ui}.js`)
vytvoří řezací šablonu jigsaw puzzle. Mřížka se dopočítá z celkového počtu dílků
podle poměru stran (nebo sloupce × řádky), vnitřní uzly mřížky se náhodně posunou
a každá vnitřní hrana dostane vlastní zámek z osmi kubických Bézierových křivek
(tvar klasický/kulatý/protáhlý, velikost, náhodnost polohy, hlavy, krčku i zvlnění,
semínko pro opakovatelnost). Hrana existuje v puzzle jen jednou a oba sousední dílky
na ni odkazují (jeden obráceně) – sdílená hrana je totožná z principu a laser ji
řeže jen jednou; hrany se navíc řetězí do souvislých řezů po řadách a sloupcích.
`P.pruseciky()` hlídá, aby se hrany nekřížily ani nepřiblížily pod minimální mezeru
(2,5 % dílku), kolidující zámky se zmenšují. Varianty: zaoblené rohy obrysu, „whimsy“
(srdce/kruh/hvězda vyříznuté kolem středového uzlu, čtyři okolní dílky mají rovný
řez k tvaru) a dětské čtverce 2×2–4×4. Výstupy: SVG pro laser/plotter (předvolby
vlasová čára 0,01 mm / LightBurn / Cricut, volitelně čísla ke gravírování),
DXF R12, SVG rubu se zrcadleným rozmístěním čísel, PDF přes jsPDF (fotka s řeznými
linkami rozdělená na listy A4/A3 bez překryvu s ořezovými značkami, úvodní list
s mapou listů a kontrolním čtvercem, za každým lícem zrcadlený rub s čísly pro
oboustranný tisk) a PNG líce i rubu. Fotka se ořízne na poměr puzzle (tažení +
přiblížení), stránka hlídá DPI ve výsledné velikosti (< 150 varování). Bonus: hra
na obrazovce – dílky (předkreslené sprity) se přetahují, k sousedovi i na desku
zapadnou podle shody posunu (`P.prichyt`), spojené se táhnou jako skupina; čas,
předloha, jen okraje, průběžné ukládání do IndexedDB. Testy:
`node _test/puzzle_generator_test.js` (sdílení hran, plochy dílků = plocha puzzle,
žádné průsečíky, řezy bez duplicit, SVG/DXF/PDF, listy, přichycení; ~2500 kontrol).

**Plakát mapy** (`obsah/plakat_mapy.html` + `obsah/plakat_mapy/{jadro,ui}.js`) dělá
minimalistické plakáty místa k tisku ve stylu „city map poster“. Mapa jsou vektorové
dlaždice OpenFreeMap (schéma OpenMapTiles, zdarma bez klíče, CORS `*`) vykreslené
přes `lib/maplibre`; styl se **generuje v JS z palety** (`PLAKAT.generujStyl`) –
10 palet (černobílý, inkoust, modrotisk, sépie, noční, pastel, minimal jen silnice,
voda a zeleň, terakota, černý kontrast) a editor barev vrstev (voda, zeleň, budovy,
železnice, pozadí, pět tříd silnic s vlastní barvou, tloušťkou a skrytím), popisky
volitelně. Hledání přes Nominatim jen po potvrzení, nejvýš 1 dotaz/s, výsledky
v paměti; souřadnice se čtou i ve tvaru `50°4'31"N 14°26'16"E`. Plakát: A4/A3/A2/
50×70/30×40/vlastní, orientace, okraj, rámeček, maska obdélník/kruh/srdce, text
dole/přes mapu/v pruhu, písma z `obsah/fonty`, značka místa. **Náhled i export
kreslí stejná funkce nad `PLAKAT.rozvrzeni(n, W, H)`** (vše úměrné kratší straně),
takže export odpovídá náhledu. Export PNG/PDF (jsPDF, JPEG 93 %) v 100–300 DPI
vykreslí mapu znovu ve skrytém kontejneru stejné CSS velikosti jako náhled
s `pixelRatio` = cílové px / CSS px (`preserveDrawingBuffer`, `maxCanvasSize`);
při překročení limitu WebGL (`MAX_RENDERBUFFER_SIZE`/viewport) nebo 150 Mpx
nabídne nižší DPI. „Podrobnost mapy“ 1,5×/2× zvětší CSS plochu a zoom o log2
(víc ulic, tenčí čáry). Atribuce © OpenStreetMap / OpenFreeMap je vždy v rohu.
Režim **Hvězdná obloha** líně načte katalog `obsah/dalekohled/data.js`
(Yale BSC + čáry souhvězdí d3-celestial) a kreslí stereografickou projekci od zenitu
(sever nahoře, východ vlevo) k datu, času a pásmu; polohy J2000 bez precese.
Ukládá do `webapp_plakat_mapy_posledni` a `webapp_plakat_mapy_ulozene`, nastavení
jde exportovat/načíst jako `.json` (i přetažením). Test `node _test/plakat_mapy_test.js`
(formáty a DPI, souřadnice, styly všech palet, rozvržení, tvary, hvězdný čas, 280 kontrol).

**Cestovatelská mapa** (`obsah/cestovni_mapa.html` + `obsah/cestovni_mapa/{jadro,styly,ui}.js`)
kreslí ručně stylizované mapy cesty s animovanou trasou pro cestopisná videa. Obrysy zemí jsou
offline z **Natural Earth** (volné dílo): přehled světa 1:50m v `svet.js` (258 zemí, řeky, jezera,
města), detail 1:10m po zemích v `zeme/<A3>.json` (obrys, řeky a jezera oříznuté na zemi, města),
načítá se jen to, co je v záběru a od 22 px/° výš. Data vyrábí
`python3 -I tools/cestovni_mapa_data.py <složka s NE GeoJSON>` (shapely); `hb` = obdélník hlavní
části země (bez zámoří, přes antimeridián). Názvy zemí z `Intl.DisplayNames` podle ISO kódu.
Projekce lokální válcová kolem středu pohledu, vše se kreslí v referenčních px šířky 1920
(export v libovolném rozlišení vypadá stejně). Trasa = kubické Bézierovy úseky: automatické
tečny Catmull-Rom + vybočení „ohyb“ podle dopravy, nebo ruční úchyty uložené v zeměpisných
souřadnicích. **Ruční chvění čar je deformační pole** (2D šum podle polohy), takže společné
hranice sousedů zůstanou společné. 7 stylů (Inkoust a papír – výchozí podle předlohy uživatele,
Kresba tužkou se šrafami, Akvarel, Stará mapa s vlnkami u pobřeží, Křída, Čistá, Noční neon),
periodické textury papíru a mraků, kreslené dopravní prostředky (loď, letadlo, auto, bus, vlak,
kolo, pěšky), automatické rozmístění popisků bez překryvů, titulek, kompas, měřítko, legenda.
Animace: tempo po úsecích/po délce, zastávky, kamera statická/sledující/přelet; export PNG
(i průhledné pozadí) a video MP4/WebM snímek po snímku přes Mediabunny. Místa: klik (jméno
nejbližšího města), Nominatim, souřadnice (`PLAKAT.ctiSouradnice`), GPX. Ukládá do
`webapp_cestovni_mapa` (víc map), fotky bodů do IndexedDB `webapp_cestovni_mapa_fotky` (zmenšené
na 1600 px; v projektu jen id, stažený JSON je přibalí jako `_fotky`). **Editor kreslí mapový podklad
jednou do mezipaměti** (`CMSTYLY.vykresliPodklad`, při přehrávání s kamerou 2× převzorkovaný)
a za pohybu jen trasu a značky (~1 ms/snímek); export kreslí vše vektorově. Fotky (polaroid)
a počítadlo km jsou v prostoru obrazovky – sledující kamera je neořízne. Úchyty křivek se
zrcadlí na sousední úsek (Alt = zlom), zoom tlačítky i dvěma prsty, značky příjezdů na časové
ose (`datalist`), šipky směru, průhledné video WebM (`alpha: 'keep'`). Testy
`node _test/cestovni_mapa_test.js` (48) a `python3 _test/cestovni_mapa_ui.py [dpi] [--styly] [--mp4] [--alfa]`
(skutečná myš i dva dotykové prsty, fotka, export videa, alfa přes ffprobe, úzký displej).

## Lamamp – přehrávač (29. 10. 2026)

**Lamamp** (`obsah/lamamp.html` + `obsah/lamamp/`) je retro přehrávač hudby (vzhled klasických
přehrávačů z přelomu tisíciletí, umí jejich skiny `.wsz`), vlastní implementace (plán a stav etap `Lamamp_PLAN.md`).
HD (od 2×, vestavěné skiny): archy skinu se kreslí v měřítku okna (`vychozi(motiv, m)`, arch.m), okno se vykresluje přímo v rozlišení obrazovky; nápisy skutečným písmem na místech pixelových znaků, text displeje s diakritikou (`textHD`), číslice jako vektorové segmenty, bitmapové ikony přes EPX, hladká křivka EQ. Skiny .wsz a 1× zůstávají pixelové, volitelně vyhlazené (`vyhlazeni.js`: Scale2x 2–3× + bilineární zmenšení, jen změněný obdélník; Zobrazit → Vyhlazovat skiny .wsz, výchozí vypnuto). Test `python3 _test/lamamp_vyhlazeni.py`. Vestavěné skiny (10 motivů: Lamamp, Grafit, Okna 98, Stříbro, Terminál, Jantar, Neon, Les, Rubín, Oceán) jsou jedna kresba s přemapováním barev podle role (neutrální / akcent / displej, `TEMATA` ve `skin.js`, `nast.skin = 'tema:<id>'`; přehled `python3 _test/lamamp_skiny.py`). Výchozí skin se kreslí kódem (`skin.js`) do archů s rozměry a rozložením bitmap
klasického skinu (main, titlebar, cbuttons, numbers, text, playpaus, monoster, posbar, volume,
balance, shufrep, eqmain, eq_ex, pledit), takže skin `.wsz` je jen výměna zdrojů: vlastní
rozbalení ZIPu (`DecompressionStream`), dekodér BMP, `viscolor.txt`, `pledit.txt`, `region.txt`
(tvar okna přes `clip-path`) a `nums_ex.bmp`. Okna (`hlavni.js`, `ekvalizer.js`, `playlist.js`)
jsou bez DOM, kreslí se v pixelech skinu a zvětšují celočíselně v pixelech zařízení (ostré na
každém DPI); text playlistu se kreslí zvlášť v plném rozlišení s diakritikou. Zvuk (`zvuk.js`):
`<audio>` → prolínání → preamp → 10× peaking filtr → vyvážení → hlasitost → analyzátor;
dvě mechaniky pro prolínání, režim „přímo“ bez Web Audio (výchozí na iPhonu – hraje se
zamčeným displejem) a stream bez CORS se přehraje přímo. Tagy (`tagy.js`): ID3v1/v2.2–2.4
(i windows-1250), Xing/Info/VBRI, FLAC, OGG Vorbis/Opus, MP4/M4A/ALAC, WAV INFO. Jádro
(`jadro.js`): playlist, výběr, shuffle/repeat, M3U/PLS, předvolby EQ a `.eqf`. Správce oken
(`okna.js`): přichytávání, skupina tažená hlavním oknem, posun oken při zmenšení. Úložiště
IndexedDB `webapp_lamamp` (playlist, kopie skladeb – výchozí zapnuté, skiny, složky na ploše), nastavení v
`webapp_lamamp_nastaveni`. Složky s hudbou na ploše (`plocha.js`): ikony ve stylu Windows 98 vedle oken; v Chrome/Edge zástupce
složky na disku (File System Access, handle v IndexedDB, po reloadu `requestPermission` na kliknutí; přetažení
složky z Průzkumníka přes `getAsFileSystemHandle`), jinde kopie skladeb v IndexedDB. Položky playlistu ze
složky nesou `slozka` + `rel` (+ `blobKlic`) a nekopírují se znovu. Testy: `node _test/lamamp_test.js` (113, vzorky z
`_test/lamamp_vzorky.sh` přes ffmpeg), `python3 _test/lamamp_ui.py [dpi]` (65 kontrol skutečnou
myší, prstem a klávesami vč. přehrávání, EQ, prolínání, skinu a obnovy po reloadu),
`python3 _test/lamamp_snimek.py [dpi] [--archy]`, `python3 _test/lamamp_pruzkum.py` (okrajové scénáře: prázdný seznam, klávesy v dialozích, zmenšená okna, 3×, úzké okno, téma, poškozené nastavení), `node _test/lamamp_fuzz.js [počet] [seed]` (mutace vzorků do parserů tagů, BMP, ZIP, textů a .eqf – hlídá zamrznutí), `python3 _test/lamamp_opice.py [kroků] [seed]` (náhodné klikání, tažení a klávesy v prohlížeči – chyby JS, živé kreslení, soulad stavu se zvukem), `node _test/lamamp_firefox.js` (Firefox přes nativní WebDriver BiDi, bez geckodriveru), `python3 _test/lamamp_zatez.py` (3000 skladeb, plynulost, 1500 přepnutí a paměť). Zapisuje jen jedna záložka (Web Locks `webapp_lamamp_zapis`), další jen čte.

Po větší změně zvyš verzi cache v `sw.js` (`webapp-vN`) – jinak návštěvník uvidí
novou verzi až při druhém načtení. Metodus má svou vlastní v `../metodus/sw.js`.

**Společná čtečka knih** (sekce 📚 Knihy) slouží všem dílům: **Kroniky vyhnanství**
(`obsah/kroniky.html`, sága v sedmi knihách) a **Povídky ze světa Kronik**
(`obsah/kniha_povidky_kronik.html`). Další dílo = další krátká stránka, kód se nemění.

- `obsah/ctecka/` – kód pro všechna díla: `sablona.js` (HTML těla), `ctecka.css`,
  `jadro.js`, `ctecka.js`. Stránka díla jen nastaví `window.CTECKA_DILO`
  (`id`, `nazev`, `ikona`, `data`, `stranka`, `klic`, `soubor`) a skripty vloží.
- `obsah/knihy/<dílo>/` – data: `knihy.json` (knihy, kapitoly, počty slov, otisky),
  kapitoly v `<kniha>/*.md`, ilustrace v `<kniha>/obrazky/` (WebP);
  `obsah/knihy/dila.json` = seznam děl (čte ho Sazba knihy).

Vše vzniká z rukopisů v `../KNIHY/KronikaLidstva` (knihy `books/book_NN/chapters/`, povídky
`povidky/NN_*.md`) skriptem `python3 tools/knihy_export.py [id_díla…]`, který vygeneruje
i stránky děl (ručně neupravovat):
- vynechá redakční bloky `<!-- KONTINUITA -->`;
- PNG originály z `obrazky/zdroj/` převede na WebP (1400 px);
- na web zkopíruje jen použité obrázky a obálku.

Nové dílo: položka v `DILA` v `tools/knihy_export.py` → spustit skript → záznam v `apps.js`
(sekce 📚 Knihy, `"stav": "vyvoj"`), `i18n/en/_katalog.js`, ikony, `python3 _test/nastaveni_klice.py`,
verze v `sw.js`. U existujícího díla neměnit `klic` (uložené pozice a poznámky) ani `stranka` (odkazy).

Ilustrace se do kapitoly píší jako samostatný odstavec
`![popis](obrazky/soubor.webp)`. Po přepsání knih stačí skript spustit znovu
a zvednout `sw.js`.

Kód je rozdělený na dvě části:
- `ctecka/jadro.js` (`KRONIKY_JADRO`, bez DOM) obsahuje rozbor Markdownu,
  hledání bez diakritiky a věty pro předčítání. Dále sestavuje EPUB 3 (ZIP bez
  komprese, obálka `cover-image`) a MOBI 6: PalmDB, nekomprimovaný UTF-8 text
  po 4096 B, JPEG záznamy, EXTH s obálkou, `filepos` měřené v bajtech, FLIS/FCIS/EOF.
- `ctecka/ctecka.js` je uživatelské rozhraní. Pro e-knihy převádí WebP na JPEG
  přes plátno; pro MOBI jde nejvýš na 120 kB, kvůli limitu záznamu ~127 kB.

Co čtečka umí:
- horní lišta s nabídkami (Obrazovka = celá obrazovka zvlášť), obsah s obálkami,
  přečtenými kapitolami a časem čtení;
- fulltext ve všech knihách díla;
- záložky vázané na slovo a větu: označené slovo, bez výběru první slovo nahoře.
  Ukládá se `slovo`, `veta` a `vOd`, takže se záložka po redakci dohledá podle
  věty, pak podle slova. Staré záložky na odstavec se převedou samy;
- zvýraznění ve 4 barvách s poznámkou a citace;
- posuvník kapitoly vpravo se značkami záložek a zvýraznění, tažením rychlý posun;
- ilustrace s lupou (lze vypnout);
- předčítání po větách:
  - Wake Lock drží obrazovku rozsvícenou, iframe rozcestníku má
    `allow="screen-wake-lock"`;
  - ručně zamčený telefon řeč prohlížeče zastaví, po odemčení pokračuje od
    přerušené věty;
- motivy, písmo, řádkování, šířka sloupce, volba „nezhasínat obrazovku“;
- export EPUB a MOBI s ilustracemi, Markdown, poznámky, tisk, offline, statistiky,
  záloha JSON, odkaz `?kniha=2&kap=05_druha_smrt&blok=12`;
- barevné motivy (7 barev × 5 stupňů, kontrast WCAG), listování po stránkách (klepnutí doprostřed schová lišty),
  🔤 význam slova (Wikislovník), hlasy Piper, zpět na místo před skokem (↩, Backspace), zvýraznění čtené věty
  a časovač vypnutí předčítání (revize 9. 11. 2026);
- odolnost: kapitola/knihy.json se stahují s opakováním a při výpadku sítě se ukáže „↻ Zkusit znovu“;
  výběr prstem nepřekresluje odstavec (touchend by šel odpojenému `<em>`); místo čtení drží ResizeObserver plochy;
  značky se ukotvují jednou za otevření kapitoly (3000 odstavců ~0,1 s). Testy `_test/ctecka_dotyk_ui.py`,
  `_test/ctecka_revize_ui.py`.

Tisk celé knihy (Nástroje → Sazba celé knihy / Vysázet tuto kapitolu) otevírá
samostatnou stránku Sazba knihy (`obsah/sazba.html?dilo=kroniky&kniha=kniha1[&kapitola=N]`),
popsanou níže.

Klíče úložiště: `<klic>` (nastavení, pozice, pokrok, čas) a `<klic>_poznamky`;
Kroniky `webapp_kroniky`, povídky `webapp_kniha_povidky_kronik`. Záloha nese `dilo`
a do jiného díla nejde obnovit.

Testy:
- `node _test/kroniky_test.js` kontroluje jádro, všechna data a platnost EPUB
  a MOBI. S `KRONIKY_MOBI_PY=<python s balíkem mobi>` navíc rozbalí MOBI
  přes KindleUnpack.
- `python3 _test/kroniky_ui.py` je proklik včetně tažení posuvníku. Podstrkuje
  falešnou řečovou syntézu, protože headless nemá hlasy.
- tisk kapitoly a volání sazby ze čtečky kontroluje `_test/sazba_test.py`.

**Čtečka knih** (`obsah/ctecka_knih.html`, sekce 📚 Knihy) je univerzální čtečka pro vlastní
e-knihy uživatele ve stejné společné čtečce jako Kroniky:
- `ctecka_knih.html` = knihovna (mřížka obálek, pokrok, hledání, řazení, úprava názvu/autora,
  odebrání, přetažení souborů do okna), `ctecka_knih.html?id=<kniha>` = čtení;
- `ctecka/prevod.js` (`CTECKA_PREVOD`) převádí EPUB (vlastní čtení ZIP + `DecompressionStream`,
  názvy kapitol z nav/NCX, obálka, ilustrace), MOBI/PRC/AZW (PalmDOC nebo bez komprese, EXTH,
  `recindex` obrázky; HUFF/CDIC a DRM ne), Markdown (YAML hlavička, úroveň kapitol, přiložené
  obrázky) a TXT (UTF-8, jinak windows-1250) na kapitoly v Markdownu čtečky. Nadpisy v prostém
  textu („KAPITOLA 1.“, „Část druhá“, VERZÁLKY) pozná `jeNadpis`; EPUB dělené po stránkách
  (z PDF/Wordu) slučuje, čísla stránek za nadpisy nebere;
- `ctecka/knihovna.js` drží knihy v IndexedDB `webapp_ctecka_knih` (store `meta` + `obsah`)
  a čtečce předá `CTECKA_DILO.zdroj` = `{knihy(), kapitola(), obrazek()}` místo souborů na webu.
  Stav knihy `webapp_ctecka_knih_<id>` (+`_poznamky`), nová kniha převezme vzhled z naposledy čtené.
  Sazba, odkazy, betačtení a „offline“ jsou u vlastních knih skryté.
  Ruční „dočteno/nedočteno“ (✔ na kartě, `meta.docteno`, jinak dočteno = přečteno do konce) a filtr
  Rozečtené / Nepřečtené / Dočtené v nabídce Řadit a filtr.
- **Moje knihy z webu**: složka **`moje_knihy/` v kořeni webu** – co se do ní nakopíruje (`.md`, `.txt`,
  `.epub`, `.mobi` nebo složka s kapitolami `*.md`, obrázky a `obalka.*`), to po nahrání nabídne čtečka
  v ➕ Přidat → 🌐 Moje knihy z webu. `moje_knihy/seznam.json` generuje `tools/vlastni_knihy.py`
  a spouští ho sám `upload.sh` i `test_local.sh` (seznam se přepíše jen při změně). U Markdownu údaje
  z YAML hlavičky (`title`, `author`, `description`, `series`, `series_index`), u EPUB z metadat.
  Přidaná kniha je napojená (`meta.web`) a knihovna i čtečka ji při změně otisku samy stáhnou znovu;
  EPUB/MOBI/TXT se převádějí stejně jako soubor ze zařízení. Kapitoly mají jména souborů podle názvu
  (`kapitolySeJmeny`), takže pozice a záložky přežijí vložení kapitoly.
- Data knihovny jsou v `ctecka/knihovna_data.js` (`KNIH_DATA`): IndexedDB, `ulozKnihu` (z převodníku,
  i aktualizace – `meta.rucne` chrání ruční úpravy), pokrok, série (`calibre:series` z EPUB, jinak
  `serieZNazvu`), záloha celé knihovny do ZIP (`knihovna.json` + `knihy/<id>/…` + stavy z localStorage)
  a čtenářský deník (`zacato`, `dokonceno`, `hodnoceni`, `poznamka`, roční cíl v nastavení).
- Knihovna (`ctecka/knihovna.js`): pruh Pokračovat ve čtení, řazení i po sériích (police), filtr,
  hromadné přidání složky (`webkitdirectory` i přetažení složky, po jedné knize, průběh se zrušením,
  duplicity se přeskočí), okno úprav (údaje, obálka z obrázku, hvězdičky, data, úprava kapitol:
  přejmenovat / spojit / odebrat), deník s grafem po měsících.
- Ve společné čtečce (platí i pro Kroniky): 🔤 význam slova (Wikislovník přes API s `origin=*`,
  ohýbaný tvar → základní slovo) a odkazy na Jazykovou příručku a překlad; **Listovat po stránkách**
  (Zobrazení) – plocha `overflow:hidden`, `strana(±1)`, maska useknutého řádku `#maskaStrany`,
  klepnutí/přejetí/kolečko/klávesy; hlasy **Piper** v předčítání (`ctecka/piper.js`, worker
  a mezipaměť `piper-hlasy` sdílené s Předčítačem, přehrávání přes `<audio>`, Media Session).
- Barevné motivy čtení (i Kroniky): 7 barev × 5 stupňů (tmavé … světlé), motiv `rodina-stupeň`
  (`sepie-2`). Barvy počítá `J.barvyMotivu` v `ctecka/jadro.js` a hlídá kontrast WCAG (text ≥ 7 : 1,
  u středního ≥ 6, tlumený ≥ 4,5, slabý a akcent ≥ 3); `ctecka.js` je nastaví jako proměnné na `body`.
- Angličtina: slovník stránky `i18n/en/ctecka_knih.js` a sdílené `i18n/en/ctecka/{sablona,ctecka,jadro}.js`.
  Čtečka se načítá za běhu, proto jsou ve stránce nespouštěné `<script type="text/plain" src>`
  (jen pro nástroje i18n). Složené texty jsou v kódu po `<span>`, aby šly přeložit po kusech.
- revize 9. 11. 2026: import ověřen na 700 skutečných e-knihách (`_test/ctecka_knih_hromadny.py`) – OPF s předponou
  `opf:`, MOBI ve windows-1250, řídicí znaky C1 a dvojitě převedená čeština, UTF-16; přejmenovaný soubor na webu
  se napojí podle názvu, smazaný dostane značku „není na webu“, přejmenovaná/spojená kapitola převezme pozice
  a poznámky; záloha a obnova po částech (iPad), sdílení zálohy, připomínka po 30 dnech, 🆕 nová verze z webu,
  odhad dočtení, zobrazení mřížka/seznam.
- testy: `node _test/ctecka_knih_test.js`, `python3 _test/ctecka_knih_ui.py` (vlastní EPUB/MOBI
  z exportu čtečky + vzorek skutečných e-knih z `~/Dokumenty`, `KNIH=`, `SEMINKO=`, `JEN=`),
  `python3 _test/ctecka_knih_ui2.py` (web, napojení, hromadné přidání, záloha, série, úpravy, deník),
  `python3 _test/ctecka_knih_ui3.py` (slovníček, stránkování, Piper – `PIPER=0` bez stahování 63 MB).
  Plán: `CteckaKnih_PLAN.md`.

**Knižní nástroje (6. 11. 2026, roj Mr. Smithů)** – každá stránka má jádro bez DOM `obsah/<jméno>/jadro.js`
a test `node _test/<jméno>_test.js`:
- `redakce.html` – Redakční lupa rukopisu (opakování slov, dlouhé věty, vata, trpný rod, přímá řeč, rytmus,
  postavy, čtivost; nálezy podtržené v editoru; jen česky).
- `nastenka_scen.html` – Nástěnka scén (kartičky ve sloupcích, osnova, časová osa, pruhy postav, graf napětí,
  šablony struktury, import/export kostry v Markdownu, počty slov z rukopisu).
- `gamebook_editor.html` – Editor gamebooků ve formátu `obsah/gamebook/pribeh*.js` (graf scén, formuláře,
  kontroly dosažitelnosti a slepých uliček, hraní na zkoušku enginem, export `.js` do webu).
- `vypisky.html` – Výpisky a citáty (jen ČTE poznámky Čtečky knih, Kronik a Povídek; vlastní citáty a štítky
  v `webapp_vypisky`; kartičky citátů do PDF).
- `brozura.html` – Tisk knížky doma (vyřazení PDF do archů: sešitek, složky, lepená vazba, 4 na list; creep,
  značky, otočení rubu; návod na vazbu).
- `obalka_knihy.html` – Obálka knihy k tisku (hřbet podle stran a papíru, KDP/tiskárna/pevná vazba,
  ISBN EAN-13 + EAN-5, texty jako křivky přes opentype.js, PDF a PNG 300 DPI).
- `zalozky_exlibris.html` – Záložky a ex libris (šablony, generativní vzory, monogramy, arch s ořezovými
  značkami a oboustranným tiskem, export pro 3D Razítko).

**Sazba knihy** (`obsah/sazba.html`, sekce Psaní & text) vysází knihu do PDF k tisku
jako z nakladatelství. Stránkování dělá Paged.js 0.4.3 (`obsah/lib/pagedjs`, MIT,
CSS Paged Media).
- `sazba/jadro.js` (`SAZBA_JADRO`, bez DOM): Markdown → kapitoly a bloky, HTML a CSS
  `@page` (formáty, zrcadlené okraje, spadávka, ořezové značky, záhlaví přes
  `string-set`, obsah přes `target-counter`), předvolby a popisky v jazyce knihy
  (cs/sk/en/de).
- `sazba/zdroje.js` (`SAZBA_ZDROJE`): vlastní kniha (texty .md/.txt/.html a obrázky
  v IndexedDB `webapp_sazba`, párování obrázků podle jména), knihy Skriptoria (čte
  jeho IndexedDB `skriptoriumDB`, HTML kapitol → bloky) a Kroniky.
- `sazba/kniha.html` je rám s vysázenou knihou; knihu si bere z
  `(parent|opener).SAZBA_DATA()`, takže jde otevřít i v nové kartě (↗).
- Písma EB Garamond a Literata (OFL) jsou v `sazba/pisma/`.
- Volání zvenku: `sazba.html?dilo=<dílo>&kniha=<id>[&kapitola=N]` ze čtečky (starší
  `?kroniky=<id>` = dílo Kroniky) a
  `sazba.html?skriptorium=<id>` (Skriptorium → Export → Profesionální sazba).
- Klíče: `webapp_sazba` (nastavení), `webapp_sazba_zdroj`, `webapp_sazba_meta`
  (úpravy názvu, autora, obálky podle zdroje).
- Pasti: Paged.js dá `counter-reset: page` jen jedné straně a Chromium ho dál
  nepřenese, proto se po sazbě nastaví číslo každé straně (`counter-set`). `zoom`
  náhledu během sazby rozhodí měření, proto se zapíná až po třídě `hotovo`.
  Paged.js značí rozdělenou sekci `text-align-last: justify` a to se dědí do
  odstavců, proto je to v CSS přebité.
- Test `python3 _test/sazba_test.py`: jádro v node a skutečná PDF (rozměr i se
  spadávkou, souvislé číslování, obsah proti stranám kapitol). Dál zkouší vlastní
  knihu přetažením, knihu ze Skriptoria a volání ze čtečky.

**Fotokniha – návrhář** (`obsah/fotokniha.html`, sekce Obrázky & foto) skládá fotoknihu
po dvoustranách a exportuje tisková data. Plán po etapách je ve `Fotokniha_PLAN.md`.
- `fotokniha/jadro.js` (`FOTOKNIHA`, bez DOM): model v mm (n dvoustran = 2n − 2 stran,
  krajní půlky = desky), výřez fotky (cover × zoom, střed cx/cy) a účinné DPI, předlohy
  rozvržení, přichytávání, kontrola před tiskem, archy tisku, export PDF (pdf-lib:
  originální JPEG bez přepočtu, výřez = ořezová cesta, EXIF orientace = matice,
  TrimBox/BleedBox, volitelně ořezové značky), kreslení archu na plátno (JPEG 300 DPI).
- Verze 2 (profi): plocha je dvoustrana nebo obálka (`geom(k, di)`, `di = 'obalka'`, hřbet z počtu stran),
  textová pole se 16 písmy TTF (`PISMA`, metriky přes fontkit, `rozlozText` – stejné zalomení v náhledu SVG,
  PDF i JPEG), čísla stran, lem fotky, `scena(k, arch)` = společné kreslicí operace pro PDF i plátno,
  automatické rozvržení, EXIF datum, záloha projektu do ZIPu (`rozbalZip`), paleta Ctrl+K, náhled knihy.
  Písma Liberation Serif/Sans (regular, kurzíva) přidána do `obsah/fonty` (OFL, viz LICENCE.md).
- `fotokniha/uloziste.js` (`FK_ULOZ`): IndexedDB `webapp_fotokniha` (knihy, fotky jako
  originál + náhled 1600 px). `fotokniha/editor.js` je UI. Z `pdf_dilna/jadro.js` bere
  `exifOrientace` a `zip`.
- Past: po `setPointerCapture` míří `dblclick` na `#platno`, ne na rámeček. Rámeček se proto
  hledá přes `elementFromPoint`.
- Testy: `node _test/fotokniha_test.js` (jádro, PDF všech 8 EXIF orientací přes pdftoppm, text a obálka
  přes pdftotext) a `python3 _test/fotokniha_ui.py [dpi]` (myš, ukládání, export z prohlížeče, text v SVG
  = šířka fontkitu, obálka, automatika, prohození, záloha a obnova).

**Předčítač** (`obsah/predcitac.html`, sekce Psaní & text) čte text nahlas neuronovými
hlasy Piper přímo v prohlížeči. Vznikl jako pokus pro čtečku Kronik: `speechSynthesis`
na iOS po zamčení obrazovky ztichne, skutečný zvuk v `<audio>` hraje dál.
- `predcitac/jadro.js` (`PREDC_JADRO`, bez DOM): Markdown → odstavce → věty (zkratky,
  iniciály, řadové číslovky), kusy pro syntézu, WAV.
- `predcitac/worker.js`: espeak-ng ve WASM (`lib/piper/`, GPL-3.0, viz README.txt) →
  ID fonémů → model ONNX (`lib/onnx`, jedno vlákno – GitHub Pages nemá COOP/COEP).
- `predcitac/stranka.js`: hlasy z `huggingface.co/rhasspy/piper-voices` (voices.json; navíc komunitní hlas Honza z `Thomcles/Piper-TTS-Czech` v poli KOMUNITNI,
  CORS povolený) do Cache Storage `piper-hlasy` (ne `webapp-…`, ty maže sw.js).
  Režim průběžně: adaptivní kusy (při zásobě pod 10 s se kus uzavře hned, pak až
  ~700 znaků), zásoba 150 s. Režim předem: celý text do jednoho WAV (export).
  Media Session, deník událostí ke kopírování (zkoušky na iPadu).
- Klíče: `webapp_predcitac` (nastavení, pozice), `webapp_predcitac_text` (text do 300 000 znaků).
- Testy: `node _test/predcitac_test.js` (jádro), `python3 _test/predcitac_ui.py`
  (skutečné stažení hlasu ~63 MB, syntéza, oba režimy, MD přetažením). V headless
  desktopu syntéza jirka-medium ~5× rychleji než čtení.
- Od 6. 11. 2026 výběr **úpravy hlasu** (předvolby a uložené úpravy z Dílny hlasů, aplikují se
  na každou větu přes `hlasy/efekty.js`) a **vlastní hlasy** importované v Dílně (klíč
  `vlastni-<id>`, soubory v Cache Storage pod `https://vlastni-hlas.local/<id>/model.onnx[.json]`).

**Dílna hlasů** (`obsah/hlasy.html`, sekce Psaní & text) – syntetické hlasy ve třech režimech:
- 🎚️ *Úprava hlasu*: Piper hlas (sdílí Cache Storage i worker s Předčítačem) → `hlasy/efekty.js`
  (`HLASY_EFEKTY`, bez DOM): YIN základní tón, TD-PSOLA (výška a formanty nezávisle, rozsah
  intonace, vibrato, chvění), LPC šepot/dech, efekty (telefon, rádio, robot, ozvěna, hala,
  jeskyně – Schroederův dozvuk), 15 předvoleb. Základní zvuk textu se drží v paměti, posuvník
  přepočítá jen úpravy.
- 🤖 *Umělý hlas*: `hlasy/formant.js` (`HLASY_FORMANT`) – vlastní formantová syntéza češtiny:
  pravidla výslovnosti (ď/ť/ň, bě/mě, spodoba znělosti, ř neznělé, čísla slovy), prozódie
  (přízvuk, deklinace, otázka stoupá), Rosenbergův puls / pila / obdélník / šum → kaskáda
  rezonátorů F1–F5 + šumová větev. Jen čeština.
- 🧬 *Nové hlasy*: import vlastního Piper hlasu (.onnx + .onnx.json, kontrola konfigurace) a návod
  k lokálnímu řetězu XTTS-v2 → dataset → dotrénování Piperu (`/mnt/sata/HOME/AI_Hlasy/`, mimo web).
- Klíče: `webapp_hlasy` (nastavení), `webapp_hlasy_upravy` (uložené úpravy), `webapp_hlasy_vlastni`
  (rejstřík importovaných hlasů) – poslední dva čte i Předčítač.
- Testy: `node _test/hlasy_test.js` (13: posun f0/formantů měřený YIN a DFT, šepot, předvolby,
  výslovnost, přízvuk, otázka) a `python3 _test/hlasy_ui.py` (skutečný hlas jirka: Žena = f0 ×1,50
  změřeno na řeči, import hlasu, Předčítač s úpravou).

**Volná místa** (`obsah/prace.html`, sekce Finance) – prohlížeč volných pracovních míst
z otevřených dat MPSV / Úřadu práce ČR (≈40 tis. inzerátů). Plán a etapy `Prace_PLAN.md`.
- Data: `python3 tools/prace_data.py` (před uploadem; `--offline` = z cache `~/.cache/prace_data`)
  stáhne `volna-mista.json` (186 MB) + číselníky z `data.mpsv.cz/od/soubory/ciselniky/` + adresní
  místa RÚIAN (ČÚZK CSV, S-JTSK → WGS84 v `tools/prace_krovak.py`) a zapíše `obsah/prace/data/`
  (`meta.json`, `obce.json`, `mista.json` ≈ 7,6 MB / 2,3 MB gzip, `detail/00–63.json`).
  Minimální mzda je v `MINIMALNI_MZDA` (ručně, každý leden).
- `prace/jadro.js` (`PRACE_JADRO`, bez DOM): příprava řádků, hodinová → měsíční mzda, filtry,
  řazení, vzdálenost od domova, filtr ⇄ URL. `prace/stranka.js`: lišta, filtry, seznam, detail,
  mapa (Leaflet + vlastní shlukování v mřížce 56 px), odkaz na Čistou mzdu (`net_salary.html?hruba=`).
- Klíče: `webapp_prace_filtr`, `webapp_prace_domov`.
- Testy: `node _test/prace_test.js` (jádro nad skutečnými daty), `python3 _test/prace_ui.py`.

**Svět u stolu** (`obsah/svet_u_stolu.html` + `obsah/svet_u_stolu/`, sekce Recepty & kuchyně) – kalendář
svátečních a zvykových jídel světa (273 současných + 113 historických tradic, 103 zemí; průzkum a schválení `SvetUStolu_PRUZKUM.md`).
- Historické tradice: pole `doba` (38 epoch v `SUS.DOBY` – antika, Vikingové, Lucemburkové, Tudorovci, tereziánská doba,
  biedermeier/Rettigová, viktoriánská Anglie, první republika, přídělový systém, socialismus, Edo, Inkové…) a `pramen`
  (dobový zdroj), id `hist-…`, soubory `hist_*_data.js`. V pohledu Den oddíl „📜 V historii“, pohled Dějiny (H) = časová
  osa epoch, filtr Doba. Neověřené dobové recepty jsou označené „rekonstrukce v duchu…“.
- Pohledy Den / Měsíc / Rok / Mapa (Equal Earth, výřez kolem zemí dne), hledání i v surovinách, filtr
  tradic (novodobé „dny jídla“ výchozí vypnuté) a kontinentů, detail se symbolikou, recept s přepočtem porcí,
  odkaz na zdroj, URL `#pohled/datum/id`.
- Data `*_data.js` po regionech (formát `svet_u_stolu/FORMAT_DAT.md`; koncovka `_data.js` = nástroje i18n
  je neberou jako rozhraní – texty dat jsou jen česky, ve stránce `data-i18n="ne"`). Ověřeno 11/2026.
- `jadro.js` (`SUS`, bez DOM): pevná data, Velikonoce západní i pravoslavné, týdenní pravidla, islámský
  (Umm al-Qura) a židovský kalendář přes `Intl`, čínský z tabulek Hongkongské observatoře (`lunarni.js`,
  2023–2038 – ICU se u novoluní u půlnoci plete o den, např. Nový rok 2027 a 2030), slunovrat (`slunecni`),
  hinduistické svátky a japonské Dojó/Secubun z tabulek **jen na 2025–2036 – před rokem 2036 doplnit**.
- Generátory: `node tools/svet_u_stolu_mapa.mjs` (mapa z `cestovni_mapa/svet.js`),
  `node tools/svet_u_stolu_hko.mjs <složka s T<rok>e.txt z hko.gov.hk>`.
- Klíč `webapp_svet_u_stolu` (pohled, filtry). Test `node _test/svet_u_stolu_test.js` (výpočty dat +
  kontrola dat, každá položka má termín v letech 2025–2036).

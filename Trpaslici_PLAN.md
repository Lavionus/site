# Plán: ⛰️ Srdce hory – trpaslíci v hoře (od 29. 9. 2026)

Budovatelská strategie v **bočním řezu horou**: klan trpaslíků přichází k opuštěné hoře předků,
prokopává se do hloubky, staví síně, dílny a výrobní řetězce, přežívá zimy, obchoduje s karavanami
a brání se tomu, co vyleze z hlubin. Cílem je dokopat se k **Srdci hory** a znovu zažehnout
Výheň předků. Stav se odškrtává průběžně; „pokračuj" = vzít první neodškrtnutou etapu
a dotáhnout ji celou (implementace → testy v node → headless ověření → záznam výsledků níže).

Odlišení od existující `obsah/dwarf_colony.html` (⛏️ Trpasličí kolonie – voxelová 3D kolonie
ve stylu RimWorldu, sandbox bez cíle): tady je **2D řez s gravitací**, pixel art, pevný cíl
a příběh, výrobní řetězce jako hlavní hádanka a hrozby, které se stupňují s hloubkou.

## Rozhodnutí (schválena 29. 9. 2026)

- **Pohled: boční řez** (jako Terraria / Craft the World / Oxygen Not Included). Mapa 96 × 160 polí,
  nahoře povrch s lesem, údolím a cestou, dole vrstvy hory. Gravitace dává hře tvar: trpaslík
  chodí po podlaze, svislé šachty potřebují **žebříky/schodiště**, široké stropy potřebují
  **podpěry**, jinak hrozí zával. Na tom stojí většina rozhodování při kopání.
- **Řízení: nepřímé** (Dwarf Fortress „lite"). Hráč tažením označuje, co vykopat, kde postavit
  místnost/dílnu/sklad, zadává výrobní objednávky („udržuj 10 piv") a priority prací.
  Trpaslíci si práci berou sami podle profese, vzdálenosti a potřeb. Přímý rozkaz jen výjimečně
  (povolat stráž, evakuovat).
- **Čas: reálný s pauzou**, rychlosti ⏸ / 1× / 2× / 4×. Simulace běží v pevných tazích
  (10 tahů/s při 1×), je deterministická ze seedu a nezávislá na vykreslování – jde tedy spustit
  v node (testy, bot) libovolně rychle. Rok = 4 roční období × 12 dní, den ≈ 1 minuta při 1×.
- **Grafika: pixel art** kreslený v kódu (jako Trosečníci a Podzemí): dlaždice 16 × 16, textury
  hornin procedurálně se seedem, trpaslíci a stavby jako řetězcové pixelové mapy s paletou,
  předkreslený atlas, zvětšení celými násobky, `imageSmoothingEnabled = false`, `devicePixelRatio`.
  **Světlo z loučí**: neosvětlené chodby jsou tmavé (a zhoršují náladu), louče a výhně svítí,
  zdi světlo stíní. Nevykopaná hora je skrytá – vidět je jen to, co sousedí s vykopaným.
- **Soubory:** `obsah/trpaslici.html` + složka `obsah/trpaslici/` s obyčejnými skripty
  (ne ES moduly – musí fungovat i přes `file://`), jmenný prostor `globalThis.TRP`.
  Logika (`nahoda.js`, `hora.js`, `cesty.js`, `prace.js`, `stavby.js`, `vyroba.js`, `potreby.js`,
  `priroda.js`, `hrozby.js`, `hra.js`) **nesahá na DOM ani localStorage**; plátno a DOM mají jen
  `grafika.js`, `svetlo.js`, `ui.js`, `zvuk.js`.
- **Ukládání:** automaticky každý den do `webapp_hra_trpaslici_save`, export/import JSON, verze
  uložené hry. Rekordy přes `rekord.js` (`webapp_hra_trpaslici_*`).
- **Rozsah pro čitelnost a výkon:** nejvýš ~40 trpaslíků, 96 × 160 polí; cesty přes A* nad
  grafem „stojných" polí s mezipamětí, která se zneplatní jen v okolí změny.
- Hlavička jako ostatní hry (`common.css`, `theme.js`, `podpis.js`, `rekord.js`, `dialog.js`),
  ovládání myší i dotykem, od 320 px, světlé i tmavé téma (hora je vždy stejná, téma mění panely).

## Svět hory

| hloubka | vrstva | co tam je |
|---|---|---|
| povrch | údolí, les, louka, potok | dřevo, ječmen, zvěř, cesta pro karavany; v zimě nepoužitelné |
| 0–20 | hlína, jíl | snadné kopání, jíl → cihly; nestabilní, potřebuje podpěry |
| 20–50 | vápenec, uhlí | uhlí, prosakující voda, první jeskyně |
| 50–90 | žula, železo, měď | tvrdá hornina (pomalé kopání, stabilní), rudné žíly |
| 90–130 | čedič, stříbro, drahokamy | houbové jeskyně, podzemní jezero, **ruiny předků** s runovými deskami |
| 130–160 | hlubiny | magma, hvězdná ruda, goblinní tunely, **Srdce hory** a Pradávný spáč |

Generátor: vrstvy zvlněné šumem, rudné žíly jako náhodné procházky, jeskyně jako buněčný automat,
podzemní jezero a magmatické kapsy, ruiny jako ručně navržené šablony vložené do hory. Jeskyně
jsou uzavřené, dokud je trpaslíci neprokopnou – **prokopnutí do jeskyně je rozhodnutí**
(zdroje × nebezpečí).

## Hospodářství

```
les ──► dřevo ──► tesař ──► žebříky, podpěry, nábytek, sudy
          └──► milíř ──► dřevěné uhlí ─┐
hora ──► kámen ──► kameník ──► bloky, stoly, sochy (nálada)
     ──► uhlí ─────────────────────────┤
     ──► železná ruda ──► tavírna ◄────┘──► železo ──► kovárna ──► krumpáče, sekery, zbraně, zbroj
     ──► drahokamy ──► brusírna ──► šperky (obchod, výzdoba, sláva)
louka ─► ječmen ──► pivovar ──► pivo (bez piva klesá nálada)
jeskyně/farmy ──► houby ──► kuchyně ──► jídlo
magma ──► magmatická výheň (kovárna bez uhlí) · hvězdná ruda ──► runová kovárna ──► artefakty
```

Trpaslík má **profesi** (horník, tesař, kameník, kovář, sládek, farmář, strážce…) s úrovní, která
roste praxí, a **potřeby**: jídlo, pivo, spánek (ložnice), společnost (jídelna), světlo.
Nálada ovlivňuje rychlost práce; dlouhodobě špatná vede k odchodu nebo záchvatu vzteku.
**Sláva klanu** (výzdoba, vyrobené předměty, objevy) láká migranty a lepší karavany.

## Etapy

- [x] **1. Hora a pixel-art řez** (29. 9. 2026)
  - generátor 96 × 160 podle tabulky výše, seedovaná náhoda (mulberry32), determinismus
  - atlas dlaždic hornin a rud (3–4 varianty na horninu, praskliny, lesk žil), povrch s oblohou
  - kamera (posun, zoom kolečkem/gestem), info o poli, skrytá nevykopaná hora, `?ladeni` = vše vidět
  - test v node na 1000 seedech: podíly vrstev, počet rudných žil v dosahu z povrchu, jeskyně
    uzavřené, Srdce hory existuje a je dosažitelné kopáním, rychlost generátoru
- [x] **2. Trpaslíci, kopání a gravitace** → první hratelná verze, záznam v `apps.js` (29. 9. 2026)
  - 7 trpaslíků u brány, sprity s animací chůze, kopání, lezení
  - cesty s gravitací: chůze po podlaze, pád (zranění od 4 polí), žebříky a schodiště
  - nástroj „kopat" (tažení obdélníku), „kopat schodiště", fronta prací, výběr nejbližší práce
  - vykopaná hornina padá jako kus na zem, přenášení
- [x] **3. Stavby, sklady a dílny** (29. 9. 2026)
  - skladové zóny (podle druhu), stavba ze skutečného materiálu, který se musí donést
  - žebřík, podpěra, dveře, louče; dílny tesař a kameník; místnosti (ložnice, jídelna) jako
    ohraničené prostory s nábytkem
  - ukládání a pokračování, pauza a rychlosti, deník klanu
- [x] **4. Potřeby, jídlo a nálada** (29. 9. 2026)
  - hlad, žízeň (pivo/voda), spánek, nálada s rozpisem důvodů; smrt hladem
  - povrchové pole ječmene, houbová farma v jeskyni, kuchyně, pivovar
  - světlo z loučí (stínování zdmi) a jeho vliv na náladu
- [x] **5. Kov a výrobní objednávky** (29. 9. 2026)
  - milíř, tavírna, kovárna, brusírna; nástroje zrychlují práci a opotřebují se
  - objednávky „vyrob N" / „udržuj zásobu N", priority prací po profesích, přehled zásob
- [x] **6. Roční období, karavany a migranti** (29. 9. 2026)
  - jaro/léto/podzim/zima (zima: povrch zamrzne, žádná úroda, karavany nechodí)
  - karavana 2× ročně: nabídka a poptávka, cena podle kvality; sláva klanu → migranti
  - události s volbou (poutník, nemoc, spor dvou trpaslíků, nález v žíle…)
- [x] **7. Příroda hory: voda, stabilita, magma** (29. 9. 2026)
  - stabilita stropu (rozpětí bez podpěry podle horniny) → praskání jako varování → zával
  - voda jako jednoduchý buněčný automat: prosakování, zaplavení chodby, podzemní jezero,
    ruční pumpa a odvodňovací štola
  - magma: nebezpečí i palivo (magmatická výheň)
- [x] **8. Hrozby a obrana** (29. 9. 2026)
  - zvěř z jeskyní (obří pavouci, netopýři), goblinní nájezdy z hlubinných tunelů se stupňují
    s hloubkou a slávou
  - strážci, zbrojnice, výcvik, dveře a padací mříže, pasti; jednoduchý boj na poli
- [x] **9. Hlubiny a cíl hry** (29. 9. 2026)
  - ruiny předků s runovými deskami (úlomky příběhu, odemykají recepty), hvězdná ruda,
    runová kovárna a 3–4 artefakty s trvalým účinkem
  - Srdce hory: zažehnutí Výhně předků = vítězství; Pradávný spáč se probudí, když klan
    kope příliš hluboko příliš brzy – finále s obranou
  - epilog a statistiky konce hry (roky, počet trpaslíků, sláva, nejhlubší bod)
- [x] **10. Zvuk a atmosféra** (29. 9. 2026)
  - Web Audio, vše syntetizované: údery krumpáče podle horniny, kovárna, kapání vody,
    praskání stropu, zával, bojový roh; tichá generativní hudba podle hloubky
  - částice (prach, jiskry z kovárny), plápolání loučí
- [x] **11. Vyvážení a dotažení** (29. 9. 2026)
  - bot „rozumný správce" v node odehraje stovky her: přežití prvních 3 zim, křivka populace,
    hladomory, čas do Srdce hory (cíl: medián ~8–12 herních let)
  - úvodní výukové úkoly, nápověda, rekordy, dotykové rozvržení, `sw.js` (`webapp-vN`)

## Ověření po každé etapě

1. Logika v node (`_test/trpaslici_test.js`, později `trpaslici_sim.js` a bot) – generátor na
   mnoha seedech, invarianty simulace (nikdo neuvízne ve zdi, materiál se neztrácí ani nevzniká
   z ničeho, žádná práce není nedosažitelná navždy).
2. Headless Chromium úsporně (jeden prohlížeč s limity, postupně): obě témata, iframe 360 px,
   **DPI 2**; klikání/tažení přes syntetické `PointerEvent`, kreslení volat přímo (rAF v
   synchronní smyčce neběží).
3. Snímek hory jako důkaz běhu.
4. `upload.sh` nespouštět – nahrává uživatel ručně.

## Odpovědi na otevřené otázky (29. 9. 2026)

1. Pohled: **boční řez**.
2. Řízení: **nepřímé** (designace, objednávky, priority).
3. Čas: **reálný s pauzou**.
4. Cíl: **oboje** – kampaň s cílem Srdce hory i volný režim bez konce (volba při založení hry;
   ve volném režimu se Pradávný spáč neprobudí a zažehnutí výhně hru neukončí).

## Záznamy z etap

(doplňuje se po dokončení každé etapy – naměřená čísla, vědomé kompromisy)

### Etapa 1 – Hora a pixel-art řez (29. 9. 2026)

Soubory: `obsah/trpaslici.html`, `obsah/trpaslici/{nahoda,hora,grafika,ui}.js` (jmenný prostor `TRP`).
Testy: `node _test/trpaslici_test.js [počet]` (generátor), `python3 _test/trpaslici_snimek.py`
(headless, porty 8193/9613: chyby JS, klik/tažení/kolečko/šipky přes syntetické události, menu
a seed, obnova po načtení, úzký displej v rámu 360 px, DPI 2, snímky `_test/trpaslici_*.png`) – 15/15.

Mapa 96 × 192 polí: 32 řádků nad údolím (obloha a hora) + 160 m pod ním. Údolí vlevo s lesem,
loukou a potokem, kolmá skalní stěna s Bránou předků a vykopanou předsíní 6 × 3, hora s vrcholem
22–27 polí nad údolím. Pod povrchem vrstvy podle tabulky (hranice zvlněné šumem), okraje mapy
a dva spodní řádky jsou kořen hory (neprokopatelný).

Naměřeno na 1000 seedech (0 chyb):

| míra | min | medián | max |
|---|---|---|---|
| čas generování | 2,2 ms | 2,6 ms | 17 ms |
| podíl hlíny / vápence / žuly / čediče / hlubinného kamene | 9 / 20 / 21 / 20 / 12 % | 12 / 22 / 24 / 22 / 14 % | 14 / 25 / 25 / 24 / 15 % |
| jeskyní (krápníkové, obyčejné, houbové, jezero, hlubinné) | 10 | 12 | 13 |
| vody v podzemním jezeře | 9 | 38 | 79 |
| stromů | 11 | 21 | 32 |
| vykopaných polí od brány k Srdci hory | 113 | 137 | 156 |
| … k uhlí / železu / mědi | 1 / 38 / 33 | 3 / 48 / 47 | 19 / 63 / 74 |
| … ke stříbru / zlatu / drahokamům / hvězdné rudě | 74 / 70 / 80 / 108 | 95 / 93 / 100 / 130 | 120 / 127 / 123 / 149 |

Test hlídá: determinismus, podíl každé vrstvy ≥ 8 %, že na začátku není vidět žádná jeskyně,
ruina ani kapsa magmatu, že objekty stojí na pevné zemi (krápníky visí ze stropu), žádná ruda
ve volném poli, Srdce hory i všechny jeskyně a ruiny dosažitelné kopáním (0-1 BFS, kořen hory
a magma neprostupné), uhlí do 25 a železo do 70 vykopaných polí, a že prokopnutí do jeskyně
odhalí celou jeskyni.

Viditelnost: `odhal()` zaplavuje od nově otevřených polí přes volno, vodu a magma a označí
i pevné sousedy. Platí invariant „známé průhledné pole ⇒ známá celá jeho průhledná komponenta",
takže v etapě 2 stačí po vykopání pole zavolat `odhal` jen na něj.

Vědomé kompromisy:

| co | proč |
|---|---|
| světlo z loučí zatím není – předsíň je tmavá, hluboká místa v režimu ladění plně osvětlená | patří do etapy 4 (spolu s vlivem na náladu) |
| hranice vrstev jsou vodorovné pásy zvlněné šumem ±4,5 m | tabulka hloubek má pro hráče platit; zvrásnění by rozbilo čitelnost „kam kopat pro železo" |
| jeskyně, ruiny a magma mají mezi sebou aspoň 2–6 polí horniny | jinak by se jeskyně slévaly a prokopnutí jedné by odhalilo víc najednou |
| hvězdná ruda má zaručenou žílu 8–14 polí nad Srdcem hory | náhodné žíly v 0,6 % hor končily v magmatu a hvězdná ruda chyběla |
| goblinní tunel je zatím jen uzavřená chodba | nájezdy přijdou v etapě 8 |
| stránka zatím není v `apps.js` ani `sw.js` | zapíše se v etapě 2, až bude hratelná |
| seed poslední hory se pamatuje v `webapp_hra_trpaslici_seed` | ukládání celé hry přijde v etapě 3 |

Opraveno při ověřování: syntetické `PointerEvent` v Chromiu s vynuceným DPI 2 hlásí špatné
`offsetX/offsetY` (poloviční), takže klik mířil o 6 polí vedle – ovládání teď počítá polohu
z `clientX − getBoundingClientRect()`. Předměty ve Síni předků visely ve vzduchu (šablona je měla
o řádek výš než podlahu). Jezero a kapsy magmatu se v ~0,2 % hor nevešly – jezero se teď umísťuje
před ostatní hluboké jeskyně a magma má víc pokusů. Vápenec vypadal jako tapeta (zkamenělina
v každém čtvrtém poli) – zkameněliny jsou teď vzácný překryv (1 : 29); čedič vypadal jako dlaždice.
Značka hloubkového pravítka splývala s popiskem („– 40 m"). Kamera už neukazuje prázdno za okrajem mapy.

### Etapa 2 – Trpaslíci, kopání a gravitace (29. 9. 2026)

Nové soubory: `obsah/trpaslici/{cesty,prace,hra}.js` (logika bez DOM), grafika a `ui.js` rozšířené.
Katalog: `apps.js` vedle Trpasličí kolonie, `sw.js` zvednutý na `webapp-v198`.
Testy: `node _test/trpaslici_sim.js [hor] [tahů]` (scénáře + invarianty při náhodném označování),
`python3 _test/trpaslici_snimek.py` rozšířený na 25 kontrol (kreslení obdélníku nástrojem přes
PointerEvent, pravé tlačítko posouvá, kopání a schodiště v reálné hře, sklad, výběr a sledování
trpaslíka, rychlosti a mezerník, potvrzení nové hory, úzký displej, DPI 2) – 25/25.

Pravidla pohybu (trpaslík je vysoký jedno pole): chůze po stojném poli, krok o pole nahoru,
překročení díry široké jedno pole, pád (hledání cest dovolí nejvýš 3 pole, hlubší pád zraní:
15 % zdraví za každé pole nad 3), svisle jen po vytesaném schodišti. Kopat se dá do stran,
nad i pod sebe, šikmo a až dvě pole nad hlavu – místnosti tedy mohou být vysoké 3 pole.
Doba kopání = 1,4 s × tvrdost (ruda +30 %), zkracuje ji dovednost (horník začíná na 6/20,
roste praxí). Kámen padá z tvrdé horniny v 35 % (zdivo 60 %), jíl z jílu v 50 %, ruda vždy;
hlína nedává nic. Věci padají na zem a trpaslíci je nosí do skladu – zatím podlaha předsíně
(5 polí, hromady po 4). Každý trpaslík si práci vybírá sám: BFS od sebe, první pole, odkud
dosáhne na označenou práci nebo na věc mimo sklad; rezervace brání dvěma na jedné práci.

Naměřeno:

| scénář | výsledek |
|---|---|
| tunel 15 polí + výška 3 na konci + schodiště 31 polí + chodba 10 polí ve dně (58 polí) | vše vykopané a odnesené za 3 672 tahů (≈ 6 min hry při 1×), 16 věcí, nikdo se nezranil |
| místnost 25 × 3 | vykopaná, nikdo se nezasekl (žádná práce beze změny déle než 30 s) |
| pád do šachty hloubky 7 | zranění (zdraví 40 %), ne smrt |
| šachta bez schodiště | kopáč uvízne, deník to ohlásí; po vytesání schodiště vedle šachty se dostane ven (překročí díru) |
| náhodné označování, 40 hor × 6 000 tahů | 3 247 vykopaných polí, 0 mrtvých, 21 zranění, 0 porušených invariantů, 1,4 µs na tah |

Invarianty: nikdo nestojí ve skále, nikdo nenese neexistující věc, žádná věc ve skále ani ve
vzduchu, žádná osiřelá rezervace, žádné označení na volném poli, počet věcí nikdy neklesá.

Vědomé kompromisy:

| co | proč |
|---|---|
| pauza a rychlosti už teď (plán je měl až v etapě 3) | v reálném čase se bez nich nedá rozumně hrát ani testovat |
| postup se neukládá – po znovunačtení je nová hra na stejné hoře; nová hora se proto nejdřív ptá | ukládání celé hry je v etapě 3 |
| sklad je napevno podlaha předsíně | skladové zóny jsou v etapě 3 |
| schodiště jde jen vytesat do skály, na volné pole ne | žebříky ze dřeva patří k stavbám (etapa 3) |
| trpaslíci si nepřekáží (víc jich může stát na jednom poli) | srážky by v úzkých chodbách vedly k zácpám bez herního přínosu |
| voda a magma se zatím nehýbou; trpaslík do nich nevstoupí | proudění je v etapě 7 |
| hlína nedává materiál | aby se předsíň nezavalila hromadami už v prvních minutách |

Opraveno při ověřování: uvězněný trpaslík v kole zvedal kámen, který nemohl donést, a zase ho
pokládal (věc se teď na minutu zablokuje); hláška o uvíznutí se opakovala stále dokola a
kontrola se kvůli podmínce na čas skoro nespouštěla; z vytesaného schodiště vedle šachty nešlo
přejít jednopolovou díru (přidané překročení); hromady ve skladu byly na jednom poli (teď se
rozkládají); úzká lišta měla tři řádky; syntetický klik v testu se trefil do trpaslíka.

### Etapa 3 – Stavby, sklady a dílny (29. 9. 2026)

Nové soubory: `obsah/trpaslici/stavby.js` (stavby, dílny, recepty, zóny) a `ulozeni.js`
(uložení a obnova). `hra.js` má obecné hledání práce, `sw.js` zvednutý na `webapp-v200`.
Testy: `node _test/trpaslici_sim.js` rozšířený o scénáře etapy 3 a náhodné stavění/zóny/rušení
ve fuzzu, `python3 _test/trpaslici_snimek.py` 32/32.

Co přibylo:
- **🪓 kácení** jedlí: 2 polena, z pařezu za 5 dní doroste nový strom. Klan přichází se 6 poleny.
- **🔨 stavby z doneseného materiálu**: žebřík (1 🪵, svislá cesta i v už vykopané šachtě), podpěra,
  dveře, louč (se září), kamenná zeď (1 🪨, zazdí pole), tesařská dílna (3 🪵), kamenická dílna
  (3 🪨), postel, stůl, židle, socha. Plán je vidět jako průsvitný obrys s ukazatelem doneseného
  materiálu; zrušení plánu vrátí donesený materiál na zem.
- **dílny a zakázky**: klepnutím na dílnu se otevřou recepty (+1 / +5) a fronta zakázek.
  Tesař: postel, stůl, židle ze dřeva; kameník: stůl, židle, socha z kamene. Dílnu obsluhuje
  její řemeslník, a jen když žádný není, kdokoli.
- **🗺️ zóny**: sklad s filtrem (vše / kámen a jíl / uhlí a rudy / dřevo / výrobky), ložnice
  a jídelna s přehledem vybavení. Předsíň je výchozí sklad „vše".
- **ukládání**: automaticky každý herní den, při skrytí a zavření stránky; export a import JSON
  v menu. Hora se po načtení generuje ze seedu, ukládají se jen měnící se pole (RLE + base64).

Naměřeno:

| scénář | výsledek |
|---|---|
| kácení stromů v údolí seedu 7 | dřevo ve skladu za 127 tahů; pařezy po 5 dnech dorostly |
| místnost 8 × 2 → tesařská dílna → zakázka 2 postele → postavit do ložnice | dílna stojí, postele vyrobené za ~650 tahů a obě postavené v zóně |
| šachta bez schodů, 2 uvízlí → žebřík 5 polí | vysvobozeni za ~1 200 tahů (žebřík se staví shora dolů) |
| předsíň přepnutá na „kámen" + nový dřevník | všechno dřevo přestěhováno za 47 tahů |
| uložení | 8,9 kB; obnovená hra je po 3 000 dalších tazích shodná s nepřerušenou (determinismus) |
| náhodná hra, 40 hor × 6 000 tahů (kopání, stavby, zóny, zakázky, rušení) | 2 876 polí, 140 staveb, 0 mrtvých, 0 porušených invariantů, každá hra uložitelná a obnovitelná beze změny, 2,9 µs na tah |

Nové invarianty: počet věcí „na cestě" k plánu i zakázce přesně odpovídá trpaslíkům, kteří je
nesou; na plán se nedonese víc, než potřebuje; id věcí jsou jedinečná.

Vědomé kompromisy:

| co | proč |
|---|---|
| místnost = zóna (obdélník volných polí), ne uzavřený prostor | uzavřenost se v bočním řezu špatně vysvětluje; stačí, že ložnice obsahuje postele |
| podpěry, dveře a louče zatím nemají účinek (jen se postaví) | stabilita stropu je v etapě 7, nepřátelé v etapě 8, světlo a nálada v etapě 4 |
| zakázky „vyrob N", ne „udržuj zásobu N" | trvalé objednávky jsou v etapě 5 |
| postavené stavby se nedají rozebrat (jen se zboří, když zmizí podlaha – materiál vypadne) | rozebírání bude potřeba až s lepším nábytkem |
| stará uložená hra jiné verze se odmítne (s hláškou), nepřevádí se | formát se bude v dalších etapách měnit; převodníky až po vydání |

Opraveno při ověřování: test uložené hry v prohlížeči pokračoval ve hře z minulého běhu
(localStorage se teď na začátku maže); nápověda „Jak hrát" odsouvala klan dolů (rozbalená jen
první den).

### Etapa 4 – Potřeby, jídlo a nálada (29. 9. 2026)

Nové soubory: `obsah/trpaslici/potreby.js` (potřeby, nálada, hledání jídla/pití/postele) a
`svetlo.js` (mapa světla – logika bez DOM, protože ji potřebuje nálada). Uložená hra verze 3
(přibylo pole `uroda`), `sw.js` na `webapp-v202`.
Testy: `node _test/trpaslici_sim.js` (scénáře etapy 4 + fuzz, sudé hory bez „krmení"),
`python3 _test/trpaslici_snimek.py` 37/37.

Pravidla:
- **Potřeby** 0–100: jídlo ubývá 0,08/tah (≈ 0,8 jídla denně), pití 0,1/tah (≈ 1 pivo denně),
  spánek 0,2/tah; ve spánku jídlo a pití ubývají poloviční rychlostí. Pod 30 jde trpaslík jíst/pít,
  spát jde pod 20 nebo v noci (22–6) pod 65. Pod 12 přeruší práci. Při nulovém jídle ztrácí
  0,1 zdraví/tah, při nulovém pití 0,15 → smrt hladem zhruba 3 dny po posledním jídle.
- **Jídlo**: hotové jídlo (+70), v nouzi syrové houby/ječmen (+30–35, zlá vzpomínka). S jídlem jde
  trpaslík k židli nebo stolu v jídelně, když je do 900 kroků BFS (+6 nálady), jinak jí na zemi (−3).
- **Pití**: pivo (+70, +4 nálady), jinak voda z potoka nebo jezera (+50, −6 nálady).
- **Spánek**: volná postel (0,5/tah, v ložnici +8 nálady, jinde +5), jinak na zemi (0,3/tah, −6).
- **Nálada** = 55 + vzpomínky (1–3 dny) + stavy (hlad −15, žízeň −15, únava −10, bolest −10,
  tma −6, smrt druha −12 na 3 dny). Rychlost práce 0,6× až 1,4×. Nálada pod 12 déle než
  zhruba 2 dny → záchvat vzteku (40 s bez práce).
- **Farmy**: zóna pole (venku na hlíně) a houbárna (pod zemí). Zasít → za ~1 000 tahů zralé →
  sklizeň dá 2 kusy. Obří houby se dají „kácet" (3 houby, dorostou za 4 dny).
- **Kuchyně** (2 🪵, vaří farmář) a **pivovar** (3 🪵, vaří sládek): z 1 houby/ječmene 2 jídla
  nebo 2 piva. Obě se postaví s **trvalými zakázkami „udržuj 14"** (♾️ v panelu dílny, ±5).
- **Světlo**: denní světlo venku podle hodiny (noc 0,3) a 4 pole do hory; louč 7 polí, šíří se
  jen volnem, zdi stíní. Ve hře se kreslí jako vyhlazená vrstva tmy.
- Start: 30 jídel a 30 piv (≈ 5 dní).

Naměřeno:

| scénář | výsledek |
|---|---|
| bez jídla i piva | pijí z potoka, první smrt hladem 5. den, varování v deníku předem |
| „rozumný hráč" (seed 7): pole 9 polí, kuchyně, pivovar, tesař, 7 postelí v ložnici, 2 louče | příprava 14 dní (brzdí ji dřevo – 2 stromy v údolí, dorůstají 5 dní), pak 15 dní bez úmrtí; jídlo 12, pivo 13 na konci |
| nálada v té kolonii po dnech | 56–64 (nikdy pod 55); všech 7 spí v ložnici |
| o půlnoci | spí 7/7 |
| světlo | u louče 0,88, ve skále 0 |
| náhodná hra 40 hor × 6 000 tahů | 0 porušených invariantů (potřeby 0–100, dva v jedné posteli), 64 úmrtí hlady na sudých horách bez krmení (bez farem se hladovět má), 5,7 µs na tah |

Vědomé kompromisy:

| co | proč |
|---|---|
| trvalé zakázky „udržuj N" už teď (plán je měl v etapě 5) | bez nich by se jídlo muselo objednávat ručně každý den |
| kuchyně stojí 2 dřeva, ne kámen | v hlíně u brány se kámen na začátku nezíská a hlad nečeká |
| stromy se po dorostení musí označit znovu | automatické kácení by vykácelo les, který hráč chce nechat |
| odchod nespokojeného trpaslíka z klanu zatím není | patří k migrantům a karavanám (etapa 6) |
| pole roste i v zimě | roční období jsou v etapě 6 |
| vrstva tmy je vyhlazená, ne po polích | pixelové schody ze světla vypadaly hůř než plynulý přechod |

Opraveno při ověřování: louče ve třetím řádku místnosti se nedaly postavit (dosah stavění byl
±1 pole, kopání přitom 2 nahoru) a trpaslíci kvůli nim donekonečna nosili a pokládali dřevo –
dosah stavění je teď stejný jako kopání a nedosažitelný plán se na minutu odloží. Klepnutí na
dílnu, kde stál trpaslík, vybralo vždy trpaslíka (druhé klepnutí teď vybere pole). Vyhlazená tma
rozsvěcovala okraje neprozkoumané hory. Test hladomoru zpočátku čekal vodu, ale piva bylo dost.

### Etapa 5 – Kov a výrobní objednávky (29. 9. 2026)

Uložená hra verze 4 (dílny mají rozpracovaný výrobek, trpaslíci nástroj a povolené práce),
`sw.js` na `webapp-v203`. Testy: `node _test/trpaslici_sim.js` (+ scénáře kovu, nástrojů a priorit,
fuzz s náhodnými dílnami, zakázkami, jejich rušením, přidávanými surovinami a přepínáním prací),
`python3 _test/trpaslici_snimek.py` 40/40.

Co přibylo:
- **Výroba ve dvou krocích** (jako stavby): dílna bez práce si vezme první aktivní zakázku, na kterou
  je materiál; kdokoli s povoleným nošením do ní materiál donese; pak ji řemeslník dílny vyrobí.
  Recepty tak můžou mít víc materiálů (ruda + uhlí). Zrušení zakázky vysype donesený materiál.
- **Milíř** (2 🪵, kdokoli): 2 polena → 2 uhlí. **Tavírna** (3 🪨, kovář): ruda + uhlí → prut
  (železo, měď, stříbro, zlato). **Kovárna** (3 🪨, kovář): prut + uhlí → krumpáč (železný/měděný),
  sekera, kladivo. **Brusírna** (2 🪨, kameník): broušený drahokam, šperk (zlato + drahokam),
  stříbrný pohár. Kuchyně, tavírna, kovárna a milíř svítí (světlo 4 pole).
- **Nástroje**: trpaslík si sám vyzvedne nástroj svého řemesla (horník krumpáč, tesař a farmář
  sekeru, kameník, kovář a sládek kladivo). Krumpáč zrychlí kopání (měď 1,35×, železo 1,6×),
  sekera kácení (1,6× / 2×), kladivo stavění i výrobu (1,25× / 1,4×). Každé použití ubere 2,5 %
  (měď) nebo 1,5 % (železo) – měděný vydrží ~40 použití, železný ~66; zlomení hlásí deník.
  Klan přichází se dvěma starými měděnými krumpáči. Mrtvý trpaslík nástroj upustí.
- **⚙️ Kdo co dělá**: tabulka trpaslík × druh práce (kopání, kácení, stavění, nošení, pole, dílna).
  Vypnutí práci hned přeruší. Potřeby platí vždy.
- **Přehled zásob**: po skupinách – ve skladu, jinde (na zemi / nesené), v ruce. Nové skupiny
  filtru skladu: kovy a nástroje, cennosti.

Naměřeno:

| scénář | výsledek |
|---|---|
| start | oba horníci si do 200 tahů vezmou měděné krumpáče |
| 3 železné rudy + 8 uhlí + kámen → tavírna, kovárna, milíř | 3 pruty, železný krumpáč, železné kladivo, uhlí z milíře; kladivo si vzal řemeslník |
| kopání jen jedním povoleným trpaslíkem s měděným krumpáčem | ostatní nekopali; krumpáč se zlomil po ~40 kopáních, deník to hlásí |
| náhodná hra 40 hor × 6 000 tahů | 0 porušených invariantů (materiál na cestě do dílny = nosiči, jedna rezervace výroby na dílnu, nástroj s kladným stavem), 5,2 µs na tah |

Vědomé kompromisy:

| co | proč |
|---|---|
| nástroj si trpaslík vezme jen podle řemesla, ne podle právě dělané práce | výměny nástrojů za chodu by vedly k běhání do skladu a zpět |
| šperky, poháry a broušené drahokamy zatím nemají užitek | jejich hodnota přijde s karavanami a slávou klanu (etapa 6) |
| zbraně a zbroj kovárna zatím nekove | patří k obraně (etapa 8) |
| priority jsou zapnuto/vypnuto, ne stupně 1–5 | pro 7–40 trpaslíků to stačí a tabulka zůstane čitelná i na mobilu |

Opraveno při ověřování: náhodný test vkládal suroviny pod padajícího trpaslíka (věci visely ve
vzduchu – chyba testu, ne hry). Podezřele světlá skála u kovárny se ukázala jako správně
osvětlená vápencová stěna (změřeno v prohlížeči: světlo 0,22).

### Etapa 6 – Roční období, karavany a migranti (29. 9. 2026)

Nové soubory: `obsah/trpaslici/obdobi.js` (období, sláva, karavana, obchod, migranti) a
`udalosti.js` (události s volbou). Uložená hra verze 5, `sw.js` na `webapp-v204`.
Testy: `node _test/trpaslici_sim.js` (+ období, obchod, zima, migranti, odchod, horečka, uložení
s čekající událostí a karavanou; fuzz náhodně řeší události a obchoduje),
`python3 _test/trpaslici_snimek.py` 44/44.

Pravidla:
- **Rok** = jaro, léto, podzim, zima po 12 dnech. Pole roste 3 / 4 / 2 / 0 za 30 tahů (houbárna
  stále 3); v zimě se pole neseje a začátkem zimy mráz spálí vše, co na poli zůstalo. Potok pod
  širým nebem zamrzne (podzemní jezero ne), stromy v zimě nedorůstají, venku v zimě „mrzne" (−3).
- **Sláva** = objevená místa × 5 + vykopaná pole / 40 + hloubka / 3 + dílny × 3 + trpaslíci × 2 +
  sochy × 8 + cennosti ve skladu + bonusy z událostí. Přepočítá se každý den.
- **Karavana** přijede 8. den jara a 6. den podzimu, zůstane 2 dny. Nabízí jídlo, pivo, dřevo, uhlí,
  ječmen a podle slávy železné pruty, krumpáče, sekery, kladiva a stříbro. Obchod je výměnný:
  prodává se ze skladů za základní hodnotu (cennosti ×1,2, sláva až +50 %), kupuje za 1,5× hodnotu;
  koupené zboží leží před bránou. Přebytek hodnoty karavana nevrací.
- **Noví trpaslíci**: na začátku jara, léta a podzimu přijde skupina 1–5 podle slávy (přednost
  chybějící řemesla) – událost s volbou přijmout všechny / jen prvního / odmítnout. Objeví se na
  nejlevějším poli údolí, ze kterého se dá dojít k bráně. Nejvýš 40 trpaslíků.
- **Odchod**: druhý záchvat vzteku v témž období = trpaslík odejde (upustí nástroj, ostatním −4).
- **Události** (od 3. dne, denně s pravděpodobností 1/3, jen když žádná nečeká): poutník, horečka
  (den na lůžku, nebo práce se ztrátou zdraví a nákazou), spor dvou trpaslíků (komu dát za pravdu,
  nebo rvačka), dutina s krystaly (drahokamy, nebo sláva), pivní slavnost, dar za slávu (≥ 50),
  zbloudilý trpaslík. Okno události hru pozastaví, dokud hráč nerozhodne.

Naměřeno:

| scénář | výsledek |
|---|---|
| karavana | přijela 8. den, odmítla chybějící zboží i nerovný obchod, vyměnila 5 jídel (hodnota 10) za 3 dřeva (9), po 2 dnech odjela |
| 36 dní hry | 7 událostí (poutník, migranti 2×, spor, zbloudilý 2×, dar) |
| začátek zimy (37. den) | mráz spálil úrodu na 3 polích, potok zamrzl |
| jaro, sláva 59 | přišla skupina 2 trpaslíků; nováček se z okraje údolí dostane do skladu |
| trpaslík s náladou −90 | po dvou záchvatech odešel z hory |
| náhodná hra 40 hor × 6 000 tahů (+ události, obchody) | 0 porušených invariantů, 5,4 µs na tah |

Vědomé kompromisy:

| co | proč |
|---|---|
| prodané zboží zmizí ze skladu hned, trpaslíci ho k vozu nenosí | nošení k vozu by jen zdržovalo obchod, který trvá 2 dny |
| přebytek hodnoty propadne (žádné peníze) | výměnný obchod bez měny je pro trpaslíky čitelnější; hráč vidí bilanci předem |
| v zimě nechodí migranti ani karavany, jinak zima nemá nepřátele | nájezdy přijdou v etapě 8 |
| události se neřetězí a nemají dlouhodobé následky kromě vzpomínek a slávy | na řetězce je čas s příběhem předků (etapa 9) |

Opraveno při ověřování: noví trpaslíci se objevovali za potokem, přes který se nedá přejít, a do
hory se nikdy nedostali. Nevyřízená událost v testu blokovala všechny další (ve hře ji hráč vyřídit
musí). Lišta se na úzkém displeji lámala do tří řádků – údaje jsou teď v jednom posuvném řádku.
Sněžení bylo příliš řídké.

### Etapa 7 – Příroda hory: voda, stabilita, magma (29. 9. 2026)

Nový soubor `obsah/trpaslici/priroda.js`; nové materiály suť a obsidián, stavby ruční pumpa a
magmatická výheň. Uložená hra verze 6 (pole `vykopane`, praskající stropy, prameny, stav vody),
`sw.js` na `webapp-v205`. Testy: `node _test/trpaslici_sim.js` (+ 15 scénářů přírody),
`python3 _test/trpaslici_snimek.py` 46/46.

Pravidla:
- **Stabilita**: chodby a místnosti vysoké 1–2 pole jsou bezpečné (v řezu jsou „úzké"). Síň vysoká
  3+ pole potřebuje v každém řádku pod stropem podpěru aspoň po tolika polích, kolik unese hornina
  stropu (hlína, jíl 3; vápenec 5; čedič 7; hlubinný kámen 8; žula 9; zeď 10; zdivo 12). Počítají se
  jen vykopaná pole – přírodní jeskyně drží. Nestabilní strop hlásí deník (nejvýš jednou za minutu),
  praská a sype prach; po 60 s se zřítí: strop spadne na podlahu jako suť (tvrdost 1, dá kámen),
  zasypané trpaslíky zraní (−35), stavby na podlaze zboří, věci vytlačí nad suť. Rostoucí síň zdědí
  původní odpočet. Podpěru (a jiné jednopolové stavby na volno) jde naplánovat i do pole označeného
  ke kopání – postaví se po vykopání.
- **Voda**: jednotky padají, tečou k nejbližšímu spádu do 8 polí a hladiny spojených nádob se
  vyrovnávají (z nejvyššího řádku tělesa na nejnižší volné podepřené pole vedle, jen když je níž –
  proto se vždy ustálí). Dveře kapalinu nepustí, voda venku odteče údolím. Trpaslík ve vodě ztrácí
  zdraví a plave vzhůru; utopit se může. Voda uhasí louč. Při kopání vápence (20–55 m) vytryskne
  s pravděpodobností 1,5 % pramen (16 jednotek vody).
- **Ruční pumpa** (3 🪵): trpaslík s povoleným nošením odčerpává vodu do 3 polí okolo (1 jednotka
  za 1,2 s).
- **Magma** teče pomaleji (každých 12 tahů), spálí věci a stavby (žebříky, podpěry…), zabije
  trpaslíka; s vodou ztuhne na obsidián. **Magmatická výheň** (4 🪨, jen do 3 polí od magmatu)
  taví rudu a kove nástroje bez uhlí.
- Automat kapalin usne po dvou celých cyklech bez pohybu a probudí ho až změna (kopání, stavba,
  zával, pramen, pumpa).

Naměřeno:

| scénář | výsledek |
|---|---|
| síň 8 × 3 v hlíně bez podpěr | praská, za minutu zával (8 polí suti), nikdo neskončil ve skále |
| stejná síň s podpěrami naplánovanými před kopáním | vydrží |
| chodba 21 × 1 / síň 8 × 3 v žule | bezpečné |
| prokopnutí k jezeru (chodba 12 polí) | voda natekla do všech 12 polí, ustálila se po 95 tazích, žádná nezmizela |
| pumpa u zatopené chodby | odčerpala 17 jednotek |
| dveře pod vodou / magma pod vodou / magma nad žebříkem | voda drží / obsidián / žebřík i dřevo shořely |
| trpaslík pod vodou bez úniku | utopil se |
| magmatická výheň | 2 rudy → 2 pruty bez uhlí |
| náhodná hra 40 hor × 6 000 tahů | 0 porušených invariantů, 13,8 µs na tah (přepočet stability po každém výkopu) |

Vědomé kompromisy:

| co | proč |
|---|---|
| nízké místnosti (1–2 pole) jsou vždy stabilní | jinak by každá chodba potřebovala podpěry; v řezu nejde ukázat hloubku do strany |
| voda nemá tlak do výšky (nevystoupá U-trubkou) | stačí vyrovnávání hladin; zjednodušený automat se vždy zastaví |
| pumpa „odvádí vodu pryč", nepřečerpává ji jinam | bez potrubí by přečerpávání bylo jen zmatek |
| magma v kapse, která protíná goblinní tunel, do tunelu na začátku steče | tunel je skrytý; hráč ho najde už zatopený magmatem – je to i varování |

Opraveno při ověřování: voda tekla jen ke spádům a nevylila se do rovné chodby; první verze
rozlévání kmitala (vrstva magmatu v tunelu jezdila tam a zpět) – nahrazena spojenými nádobami.
Automat po vzbuzení hned znovu usnul podle starého počitadla (magma nedostalo krok). Pramen
zatápěl šachty ve starých scénářích (4 % → 1,5 %). Síň v kolonii se zřítila, protože na plán ve
skále se „nedosažitelně" nosilo dřevo a plán se zablokoval. Zával zasypal materiál vrácený ze
zrušeného plánu (přidána i obecná pojistka „vytlačit ze skály"). Po závalu zůstávalo označení.

### Etapa 8 – Hrozby a obrana (29. 9. 2026)

Nový soubor `obsah/trpaslici/hrozby.js`; stavby padací mříž, past, zbrojnice; kovárna kove válečnou
sekeru a zbroj (železnou i měděnou). Uložená hra verze 7, `sw.js` na `webapp-v206`.
Testy: `node _test/trpaslici_sim.js` (+ 10 scénářů boje; ve fuzzu náhodné nájezdy, tvorové u trpaslíků
a spuštěné mříže), `python3 _test/trpaslici_snimek.py` 49/49.

Pravidla:
- **Tvorové** se probudí, když se klan prokope do jeskyně: krápníková / obyčejná → 1–3 netopýři
  (létají, 12 ♥, útok 3), obyčejná / hlubinná → 1–2 obří pavouci (lezou po stěnách a stropech, 45 ♥,
  útok 8, padá z nich hedvábí), houbová → někdy pavouk, cizí tunel → 2–3 goblini a brzký nájezd.
- **Goblini** (30 ♥, útok 6) chodí jako trpaslíci, vyrážejí dveře (8 ran), a když nemají na koho
  útočit, kradou nejcennější věc ze skladu a utíkají údolím. **Nájezdy**: první 20. den, pak každých
  10–15 dní; síla 2 + sláva/40 + hloubka/50 (nejvýš 8); tunelem, když je odkrytý, jinak údolím.
- **Boj**: kdo stojí vedle nepřítele, udeří jednou za 10 tahů (i uprostřed práce). Útok trpaslíka:
  pěsti 4, krumpáč 6, kladivo 7, sekera 8, válečná sekera 14 (měď 0,8×), × (1 + 0,1 × dovednost boje);
  zbroj ubere 40 % (měděná 25 %). Poškození ±30 %.
- **Strážci** (nový sloupec ⚔️ v „Kdo co dělá"; výchozí jen profese strážce) loví nepřátele, berou si
  válečnou sekeru a zbroj a bez nepřátel cvičí ve **zbrojnici** (dovednost boje až 10).
- **Dveře** netvory nepustí (goblin je vyrazí), **padací mříž** (klepnutím v panelu) nepustí nikoho,
  **past** ubere 25 ♥ a za 30 s se sama napne.
- UI: poplach ⚔️ s počtem viditelných nepřátel (klepnutí ukáže prvního), tvorové na minimapě
  červeně, ukazatele zdraví trpaslíků i tvorů.

Naměřeno:

| scénář | výsledek |
|---|---|
| netopýři u brány | zabiti, klan žije |
| nájezd 4 goblinů (sláva 80) na nebráněný klan | padli 2 trpaslíci, 4 goblini zabiti |
| stejný nájezd, 3 strážci s válečnou sekerou, zbrojí a bojem 5 | nikdo nepadl |
| zavřená mříž v bráně | goblini zůstali venku, nikdo nepadl; po otevření boj |
| past / dveře | past goblina zranila a napnula se znovu; další goblin vyrazil dveře |
| strážce u zbrojnice | dovednost boje roste |
| náhodná hra 40 hor × 6 000 tahů (+ nájezdy, tvorové, mříže) | 0 porušených invariantů, 12,5 µs na tah |

Vědomé kompromisy:

| co | proč |
|---|---|
| nečinní trpaslíci před netvory neutíkají, jen se brání | útěk by vyžadoval vlastní hledání bezpečí; hráč má mříž, dveře a strážce |
| zbraně a zbroj se neopotřebují | opotřebení nástrojů stačí; výzbroj je drahá |
| tvorové se nerozmnožují, jeskyně se probudí jen jednou | nekonečný přísun by z hlubin udělal mlýnek; hrozbu obnovují nájezdy |

Opraveno při ověřování: bez obrany 4 goblini vybili celý klan (pěsti 2) – zvýšen útok beze zbraně
i nástrojů, goblinům ubráno zdraví; test dveří zabila past dřív, než goblin došel (rozděleno);
dlouhé testy v prohlížeči zasahovaly nájezdy (v testovacím obalu vypnuty).

### Etapa 9 – Hlubiny a cíl hry (29. 9. 2026)

Nový soubor `obsah/trpaslici/pribeh.js`; stavba runová kovárna; tvor Pradávný spáč; okno epilogu;
volba režimu v menu. Uložená hra verze 8, `sw.js` na `webapp-v207`.
Testy: `node _test/trpaslici_sim.js` (+ 10 scénářů příběhu), `python3 _test/trpaslici_snimek.py` 54/54.

Pravidla:
- **Runové desky** (strážnice, Síň předků): přečte je trpaslík s povolenou prací v dílně (12 s).
  První přečtená odemkne **runovou kovárnu** (4 🪨 + 2 zlaté pruty, kove kovář), druhá **artefakty**;
  objevení Srdce přidá poslední úlomek. Úlomky jsou v deníku i v panelu „Příběh předků".
- **Runová kovárna**: hvězdná ruda + uhlí → hvězdná ocel; artefakty (každý jen jednou):
  Durinovo kladivo (2 🌟 + železný prut; stavba a výroba 1,3×), Lampa předků (2 🌟 + broušený drahokam;
  světlo v hoře aspoň 0,4 – konec „práce ve tmě"), Roh hory (2 🌟 + pohár; útok 1,3×), Klíč k Srdci
  (3 🌟 + šperk; věc, nedá se prodat). Každý artefakt +15 slávy.
- **Pradávný spáč** (420 ♥, útok 20, leze po stěnách; padá z něj hvězdná ruda) v kampani:
  probudí se, když klan kope od 138 m nebo objeví Srdce **bez Klíče** („příliš hluboko příliš brzy");
  jinak až ve chvíli, kdy se s Klíčem začne zažíhat Výheň – a s ním přijde i goblinní nájezd.
- **Vítězství**: trpaslík s Klíčem v Srdci zažíhá Výheň 60 s (boj ho přerušuje, po smrti Klíč
  sebere jiný). Výheň pak hoří (světlo 12 polí). **Prohra**: zahyne celý klan.
- **Epilog** se statistikami (dny, rok, trpaslíci, padlí, sláva, hloubka, výkopy, poražení nepřátelé,
  nájezdy, artefakty, Spáč); po vítězství jde hrát dál ve volném režimu.
- **Volný režim** (volba v menu před novou horou): Spáč se neprobudí a hra nekončí.

Naměřeno:

| scénář | výsledek |
|---|---|
| desky ve strážnici a Síni předků | odemčena runová kovárna, pak artefakty; úlomky v deníku |
| runová kovárna s 9 hvězdnými rudami | 9 prutů hvězdné oceli a všechny 4 artefakty; druhý stejný artefakt objednat nejde |
| kopání ve 140 m bez Klíče | Spáč se probudil; ve volném režimu ne |
| 7 ozbrojených trpaslíků s Klíčem v Srdci | Spáč se probudil, padl, Výheň hoří, vítězství, epilog |
| zahynutí klanu | prohra, epilog „Hora utichla…" |
| náhodná hra 40 hor × 6 000 tahů | 0 porušených invariantů |

Vědomé kompromisy:

| co | proč |
|---|---|
| artefakty (kromě Klíče) nejsou věci, jen trvalé účinky | goblin by je jinak mohl ukrást a hráč by přišel o hodiny práce |
| cesta k Srdci se kope jako k čemukoli jinému (runové zdi jsou jen tvrdé) | tajemství drží Spáč, ne zámek |
| hvězdné rudy je v hoře málo (žíla nad Srdcem + 3 náhodné) | Klíč má být vrchol, ne vedlejší produkt; množství ověří bot v etapě 11 |

Opraveno při ověřování: Spáč se objevil ve vzduchu uprostřed síně, kde lezoucí tvor nemá kam
šlápnout, a finále proběhlo bez boje – rodí se teď na podlaze a z volného vzduchu se umí
dostat ke stěně.

### Etapa 10 – Zvuk a atmosféra (29. 9. 2026)

Nový soubor `obsah/trpaslici/zvuk.js` (Web Audio, vše syntetizované); částice v `grafika.js`.
Logika jen vydává události do `hra._zvuky` (neukládají se, nejvýš 80 ve frontě); prohlížeč je každý
snímek vybere, přehraje (jen v obraze, se stereem podle polohy; roh, zvonek, objev, smrt a fanfára
vždy) a vytvoří z nich částice. `sw.js` na `webapp-v208`.
Testy: `node _test/trpaslici_sim.js` (události z kopání, kácení, stavby, závalu, nájezdu),
`python3 _test/trpaslici_snimek.py` 56/56 (všech 18 zvuků vykreslených do OfflineAudioContext:
špička 0,06–0,68).

Zvuky: úder krumpáče podle horniny (hlína tupě, žula ostře, runy a rudy zvoní), vykopnutí,
sekera, kladivo, kovadlina (kovárny, tavírna, výhně), pila (ostatní dílny), praskání stropu,
zával (hluboké dunění), kapka vody, bojový roh (nájezd), třesk zbraní, zásah, řev Spáče, pád
nepřítele, objev (arpeggio), zvonek (karavana, událost), smrt (moll), fanfára (zažehnutí Výhně).
Hudba: tichý dron a pentatonické tóny s ozvěnou; s hloubkou pohledu klesá výška i jas.
Nastavení v menu (zvuky, hudba, hlasitost) se pamatuje. AudioContext vzniká až po prvním klepnutí.

Částice: prach z úderů a vykopání (barva horniny, u rudy zlaté jiskry), jiskry z kovadliny, třísky,
oblak závalu, kapky, jiskry boje, fialové jiskry Spáče; jiskry z loučí a ohnivých dílen. Svítící
částice se kreslí přes vrstvu tmy.

Vědomé kompromisy:

| co | proč |
|---|---|
| zvuky nemají prostorový dosah do hloubky (jen levo/pravo a ztlumení podle přiblížení) | v řezu by „vzdálenost nahoru/dolů" zněla nepřirozeně |
| hudba není skládaná, jen generovaná z náhody | stačí jako ambient; skladba by potřebovala hudebníka |
| poslech ověřuje uživatel | test měří jen, že zvuk vznikne a nepřebudí se |

### Etapa 11 – Vyvážení a dotažení (29. 9. 2026)

Bot „rozumný správce" `_test/trpaslici_bot.js` odehraje celé hry bez prohlížeče (rozhoduje jednou denně
jako hráč: obytná místnost, dílny, ložnice, houbárny podle počtu trpaslíků, hlavní schodiště s přednostním
kopáním, průzkumné štoly po 14 m, chodby k ruinám, průmysl ve 12 m, strážci, karavana, události, štola
pro hvězdnou rudu, odbočka kolem magmatu, tunel do Srdce s Klíčem). Měří vítězství, čas do Klíče
a do vítězství, přežití prvních 3 zim, křivku populace, hladomor, příčiny smrti a hloubku.
`node _test/trpaslici_bot.js 12 10` (≈ 11 min); ladění `--diag`, `--od=N`, prostředí `KONEC_MAPA=od-do`,
`DESKY`, `CINNOSTI`, `MAPA`.

Výsledek (12 her × nejvýš 10 let, 621 s): **prohra 0 %, přežití prvních 3 zim 100 %**, populace 10 → 15 (4. rok)
→ 20 (6. rok) → 30 (11. rok), úmrtí za 12 her: boj 26, žízeň 1; nejhlubší bod medián 124 m; Spáč předčasně 0 %.
Klíč vykoval bot ve 3 hrách z 12 (295., 352., 422. den), vyhrál 1 hru (398. den = 8,3 roku); předchozí dávka
s týmž botem 2 z 12 (328. a 424. den). Na začátku etapy bot nevyhrál nikdy a 17 % her prohrál v 1. roce.
Zbylé hry bez vítězství zastaví botova navigace, ne hra: magma nebo obří houba přímo pod šachtou, pomalé
kopání v hloubce a daleké cesty (bot nestaví druhou základnu dole). Zkušený hráč to obejde; cíl „medián
8–12 let" tak odpovídá vítězným hrám bota.

Co bot odhalil a co se ve hře změnilo (týká se i hráče):

| problém | oprava |
|---|---|
| potok v údolí (3 pole) odřízl levou část údolí – stromy za ním nešly pokácet | potok na povrchu se brodí |
| trpaslík si vykopal šachtu pod sebou a uvízl na dně | pod sebe kope jen schodiště, pod žebříkem nebo jámu hloubky 1, ze které se vystoupí do strany |
| hledání práce „nejbližší první": nalezenou desku, Klíč ani materiál pro vzdálenou dílnu nikdo nevzal, vždy bylo co uklízet blíž | přednostní průchody: čtení desky, zažehnutí Klíčem, donést materiál na plán/do dílny (s krátkou blokací, když cesta není) |
| hvězdná ruda ležela hlavně pod 138 m, kde se budí Spáč, a Klíč ji přitom potřebuje | jisté žíly hvězdné rudy nad Srdcem v 126–134 m |
| zlato se často nenašlo | jistá zlatá žíla v dosahu brány (84–96 m), 6 žil, poklad v Síni předků |
| průzkumná štola prokopala podlahu pod Výhní, Klíč spadl do díry a Výheň nešla zažehnout | podstavec Výhně nejde kopat |
| zboží karavany a dary padaly na pevné pole u brány – i do zdi, kterou tam hráč postavil (fuzz 40×6000) | skládají se na nejbližší volné stojné pole |
| v zimě trpaslíci umírali žízní u zamrzlého potoka | led se dá pít (pomaleji, nálada −9) |
| kuchyně a pivovar bez zakázek nevařily | výchozí trvalé zakázky 20 |
| hráč neměl jak říct „tohle nejdřív" | nástroj ⭐ přednost (klávesa P, hvězdička na poli): označené kopání se udělá dřív než cokoli jiného; `VERZE` uložení 9 |
| krápník v jeskyni zablokoval žebřík a nešel odstranit | stavba krápník odlomí |

Nové v rozhraní: sekce **🧭 Co dál?** hned pod názvem hory – 17 výukových kroků od první místnosti po zažehnutí
(ve volném režimu 9 kroků bez příběhu; logika `TRP.pribeh.coDal` testovaná v node). Rekordy přes `rekord.js`:
nejrychlejší vítězství, nejhlubší šachta, nejvyšší sláva (v menu; nový rekord hlásí okno konce hry).
Dotykové rozvržení ověřeno v rámu 360 px (nic nepřetéká) a při DPI 2 (klik trefí pole). `sw.js` na `webapp-v209`.

Testy: `node _test/trpaslici_test.js 20` ✔, `node _test/trpaslici_sim.js 40 6000` 99 kontrol, 0 chyb,
`python3 _test/trpaslici_snimek.py` 59/59, bot viz výše.

Vědomé kompromisy:

| co | proč |
|---|---|
| cíl „medián 8–12 let" platí pro zkušeného hráče; bot je hloupější než člověk a část her nedotáhne | rok má 48 dní = 48 minut při 1× (den = 600 tahů = 1 minuta) – 8 let je ~6 h při 1×, ~1,6 h při 4× |
| bot „vidí" celou mapu (ví, kde jsou ruiny a Srdce) | měří tempo hospodářství a průchodnost řetězce, ne průzkum |
| hledání cest dovolí seskočit až 3 pole i tam, odkud se nevyleze (např. ze štoly do jeskyně pod ní) | omezení na 1 pole rozbilo běžné cesty v údolí a sklepích; hra uvízlého hlásí („potřebuje žebřík") a žebřík ho vysvobodí |
| boj je hlavní příčina smrti v dlouhé hře | nájezdy rostou se slávou a hloubkou záměrně; obrana (strážci, mříže, pasti) je hráčova práce |


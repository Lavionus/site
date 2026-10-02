# Srdce hory – plán propracovanějších spritů

Navazuje na etapu z 30. 9. 2026 (trpaslíci a 11 dílen, viz dodatek v `Trpaslici_PLAN.md`).
Cíl: vše, co se kreslí ve hře, dotáhnout na stejnou úroveň – stínování zleva shora, 3–4 tóny
na materiál, čitelný obrys, v jemném stylu dokreslené detaily a tam, kde to dává smysl, 4 snímky
jemné animace.

## Zásady (platí pro všechny etapy)

- Logická velikost spritů se **nemění** (hra počítá s rozměry, klikání, kolize) – jen víc detailu.
- Klasický styl: ruční kresba po pixelech. Jemný styl: EPX + dokreslení přes `hotovo(obrys, jemne)`
  (oči, lesky, textura). Nativní kresba 32 px jen tam, kde EPX zjevně nestačí (velké sprity).
- Průsvitné efekty (záře, kouř, pára, třpyt) jen přes `k.zar()` – bez obrysu.
- Mezery 1–2 px mezi předměty v klasickém stylu zčernají obrysem → předměty dávat na podklad.
- Animace: 4 snímky, index `((snimek >> 1) + i) & 3` (4 fps), s posunem podle pole, ať se
  sousední kusy nehýbou synchronně. Atlas je pak pole snímků.
- Po každé etapě: náhled `_test/trpaslici_sprity.html` (obě varianty, zvětšit v PIL), `trpaslici_snimek.py`,
  node testy, zvednout `sw.js`, zapsat dodatek. Hlídat dobu stavby atlasu (`pripravAtlas`) – cíl < 150 ms v jemném stylu.

## Etapy

### 0. Základ a náhled ✅ (30. 9. 2026)
- [x] Sdílené pomůcky přesunout k sobě a doplnit: `rampa(barva)` (4 tóny ze základní barvy),
      `stinPod(k, x, y, w)` (kontaktní stín na podlaze), `dither(k, …)` (přechod přes Bayer), `trpyt(k, x, y, f)`.
- [x] Jedna tabulka materiálových palet (dřevo, kámen, železo, měď, stříbro, zlato, obsidián, runa, kůže, látka).
- [x] Náhled rozšířit o kategorie (`?jen=trp|dil|tvor|stavby|veci|priroda|teren|ostatni`) a animaci (přehrávání snímků).
- [x] Kontrolní test v UI testu: každý sprite v atlasu má čekané rozměry v obou stylech, atlas se postaví bez chyb, čas stavby.

### 1. Stavby a nábytek ✅ (30. 9. 2026)
- [x] Postel, stůl, židle – dřevěná a kamenná verze výrazně odlišná (léta dřeva / kvádry), přikrývka se vzorem, polštář, hrnek na stole.
- [x] Socha – trpaslík na podstavci se sekerou, patina, v jemném stylu tesané rysy.
- [x] Dveře – kování, panty, zámek; otevřené/zavřené a poškozené (praskliny podle stavu).
- [x] Žebřík (provázaná příčky), podpěra (trám s klíny a kovovou objímkou), schodiště (hrana stupně, ošlapání).
- [x] Louč – železný držák, 4 snímky plamene + záře přes `zar` (dnes 3 snímky bez záře).
- [x] Pumpa – páka, 4 snímky (páka nahoru/dolů jen když čerpá), voda v korýtku.
- [x] Past (napnutá: zuby; spuštěná: sklapnutá, krev/zelená krev), mříž (nýty, řetěz s kladkou; otevřená/zavřená).
- [x] Zeď z kvádrů – ponechána textura horniny `ZED` (už je z kvádrů, v jemném stylu nativní), pole a úroda: 4 fáze růstu, houby vs. ječmen, pařez s letokruhy.

### 2. Věci na zemi a výrobky ✅ (30. 9. 2026)
- [x] Suroviny: kámen podle horniny (tvar + žilkování), hlína/jíl, uhlí s leskem, rudy (kousky kovu v hlušině s třpytem), drahokamy a hvězdná ruda broušené.
- [x] Pruty (železo, měď, stříbro, zlato, hvězdný) – ingot s úkosem a leskem, kov rozlišitelný i ve 12 px.
- [x] Nástroje a zbraně (krumpáč, sekera, kladivo, válečná sekera, zbroj, čepel) – stejný tvar jako v ruce trpaslíka.
- [x] Jídlo, pivo, houby, ječmen, dřevo (polena s letokruhem), hedvábí, šperk, pohár, klíč, brus.
- [x] Hromádky: místo posunu 2–4 kusů vlastní sprite „hromada" pro každý druh (2, 3, 4 kusy), čitelnější.

### 3. Tvorové a nepřátelé ✅ (30. 9. 2026)
- [x] Goblin – 4 snímky chůze, 2 útoku (oštěp/nůž), kůže s bradavicemi, svítící oči (`zar`), roztrhaný hadr; varianta šaman/vůdce.
- [x] Pavouk – 4 snímky nohou (střídání po párech), lesk očí, chlupy; pavučina jako objekt na stěně.
- [x] Netopýr – 4 snímky mávání, visící klidová póza.
- [x] Pradávný spáč (24 × 20) – spí/probouzí se/bojuje, pulzující hvězdné krystaly, v jemném stylu nativní kresba.
- [x] Zásah: záblesk (přebarvení na bílo/červeno na 1 snímek), smrt: rozpad na částice.

### 4. Trpaslíci – doplnění ✅ (30. 9. 2026)
- [x] Obličej: vousy už nevypadají jako rouška přes nos – baňatý nos přečnívá přes knír, vousy začínají pod ním.
- [x] Vlastní póza spánku (na zemi na zádech, v posteli hlava na polštáři), jídlo/pití (krajíc / korbel u úst), boj se sekerou (snímky kope). Plavání (hlava nad vodou) zbývá.
- [x] Střihy vousů (plnovous, rozdvojený s korálky, krátký, cop) – hash z barvy vousů a profese, ne z `t.id` (portrét v ui.js se cachuje podle profese a vousů). Pleš/vlasy, jizva zbývá.
- [x] Zranění (obvaz), únava (propadlá ramena), zuřivost (rudá tvář).
- [x] Portrét v kartě trpaslíka: vlastní 32 × 32 (hlava a ramena), ne zvětšený sprite.

### 5. Příroda na povrchu i v podzemí ✅ (30. 9. 2026)
- [x] Jedle (kůra, větve ve vrstvách, šišky), keř (bobule), tráva (2 snímky vlnění), balvan (lišejník), pařez.
- [x] Obří houby – svítící klobouky se `zar`, výtrusy jako animace; krápníky s kapkou (4 snímky).
- [x] Krystaly s třpytem, kosti, zkameněliny, runová deska (runy slabě svítí), sloup, brána (nativní jemná kresba).
- [x] Výheň předků: vyhaslá a hořící jako 4 snímky (dnes statický obdélníkový plamen).
- [x] Zima a podzim: sníh na všech venkovních objektech, led s prasklinami a odlesky.

### 6. Terén ✅ (30. 9. 2026)
- [x] Rudy: jemná nativní textura (žíly, krystalky, lesk) místo EPX; drahokamy s třpytem (animovaný lesk vzácně).
- [x] Praskliny ve 3 stupních jemně, zkameněliny, „neznámo" s náznakem hloubky.
- [x] Voda: pěna u hladiny a u pumpy; magma: bubliny a jiskry, záře na okolních stěnách.
- [x] Vzdálené hory a mraky: 3 vrstvy, v jemném stylu detailnější silueta.

### 7. Karavana, značky a efekty ✅ (30. 9. 2026)
- [x] Karavana (48 × 26): vůz s plachtou, mula s 2–4 snímky chůze, točící se kola, obchodník; zboží na voze.
- [x] Značky (kopání, schody, přednost, kácení), výběrový rámeček, pruhy zdraví a průběhu jako malé sprity s rámečkem.
- [x] „Zzz", vykřičník zuřivosti, ikonky nálad nad hlavou jako pixelové sprity místo obdélníků.
- [x] Částice: tvary (jiskra, prach, kapka, list, sněhová vločka) místo čtverečků.

### 8. Ladění ✅ (30. 9. 2026)
- [x] Sjednotit směr světla a saturaci napříč všemi sprity (snímek celé hory v obou stylech vedle sebe).
- [x] Čitelnost při nejmenším zoomu, DPI 2 (`vykr_dpi`), doba stavby atlasu a paměť cache.
- [x] Zápis do `Trpaslici_PLAN.md`, `sw.js`.

## Doporučené pořadí
0 → 1 → 2 → 3 → 4 → 5 → 7 → 6 → 8 (nejdřív to, co hráč vidí nejvíc a nejblíž).

## Záznamy

**Etapa 0 (30. 9. 2026)** – v `grafika.js` nová sekce „společné palety a pomůcky" hned za paletami hornin:
tabulka `MAT` (dřevo, kámen, mramor, železo, ocel, litina, měď, měděná, stříbro, zlato, kůže, látka, plátno, obsidián, runa;
pořadí [základ, tmavá, světlá, nejtmavší, lesk]), pomůcky `rampa`, `stinPod`, `dither`, `trpyt` a přesunuté `kvadr`, `zdivo`,
`plamen`, `kour`, `zare`, `lampicka`, `sudCelo`. Náhled `_test/trpaslici_sprity.html` prochází celý atlas sám
(`?jen=trp,dil,stavby,veci,tvor,priroda,teren,ostatni`, `&anim=1` přehrává animace) a plní `window.__sprity`.
Nový test `python3 _test/trpaslici_sprity_test.py [kategorie]` (porty 8195/9615): bez chyb JS, žádný prázdný sprite,
jemný = přesně 2× klasický, rozměry trpaslíků/věcí/dílen, 4 snímky dílen, doba stavby atlasu (teď 22 ms / ~70 ms) – 10/10.
Test hned našel chybu ve hře: hvězdný prut (`prut_hvezdny`) spadl do obecné větve prutů bez barev → výjimka při kreslení,
jakmile ležel na zemi nebo ho někdo nesl (kampaň: „ukuj 3 hvězdné pruty"). Opraveno. Artefakty `art_*` na zemi neleží
(zapisují se jako účinek), v náhledu se vynechávají. UI test 73/73, `sw.js` na `webapp-v226`.

**Etapa 1 (30. 9. 2026)** – stavby a nábytek překresleny: postel (dřevo: vyřezávané čelo a nohy; kámen: zděné lože s runou;
kostkovaná přikrývka přes okraj, polštář, slamník), stůl (dřevo: soustružené nohy, lub; kámen: deska na podstavci se svíčkou;
na obou korbel s pěnou a talíř s chlebem), židle (dřevo s podsedákem / kamenné křeslo), socha (trpaslík v rohaté přilbě se
sekerou, mramor na podstavci se zlatou tabulkou a mechem), dveře (kamenný překlad, prkna se suky, nýtované pásy, klepadlo;
`a.dvere` = [celé, naštípnuté 1–3 rány, rozbité 4+ ran, otevřené když v nich stojí trpaslík]), žebřík (provazy na příčlích),
podpěra (klíny, objímka, kamenná patka), schodiště (ošlapané stupně), louč (4 snímky, plamen a záře bez obrysu),
pumpa (`a.pumpa` = [klid, 4 snímky čerpání] – páka a proud vody jen když u ní trpaslík pumpuje), past (spoušť, čelisti;
spuštěná s krví), mříž (kladka, řetěz, hroty, nýty), pařez (4 varianty: letokruhy, houbička, mech, zaseknutá sekera),
úroda ve 4 fázích (pole: klíček → mladé → klasy → zralé skloněné klasy; houbárna: prostřední houba roste pomaleji, zralé svítí);
mapování úrody 1–25 / 26–66 / 67–100 / 101. Sprite test 10/10, UI test 74/74, `sw.js` na `webapp-v227`.

**Etapa 2 (30. 9. 2026)** – `vec()` a `malyVyrobek()` sloučeny do `vecSprite(druh, mat)`: kámen podle horniny (vrstvení
u vápence a hlíny, zrnka u žuly a čediče), jíl s otiskem prstu, uhlí ve dvou lesklých kusech, rudy jako hlušina s kovovými
zrny a třpytem, drahokamy a hvězdná ruda jako krystaly v kameni (hvězdná svítí), polena s letokruhy, miska guláše se lžící
a párou, korbel s obručemi, snop ječmene, ingoty s úkosem a leskem (hvězdný svítí), nástroje se stínovaným kovem, obouruční
sekera, kyrys s nárameníky, broušený drahokam, náhrdelník s rubínem, stříbrný pohár, role hedvábí, čepel s řapem, zlatý klíč.
Hromádky: když na poli leží 2–4 stejné věci, kreslí se jako úhledná hromádka `hromada(druh, mat, n)` (16 × 14, stín pod ní,
cache se maže se stylem); smíšené věci po starém. Sprite test 10/10, UI test 74/74, `sw.js` na `webapp-v228`.

**Etapa 3 (30. 9. 2026)** – tvorové: `a.tvor[druh]` je objekt snímků `jde0–jde3, stoji, utok0, utok1` (netopýr `mava0–mava3, visi`).
Goblin (hubené nohy, roztřepený hadr, uši, špičatý nos, bradavice, žhnoucí oči, nůž; útok rozmach/bodnutí), pavouk (nohy jako
lomené čáry kyčel → koleno → chodidlo, páry se střídají, zadeček se znakem a chlupy, svítící oči, kusadla s jedem, při útoku
zdvižená noha), netopýr (4 snímky mávání s kostmi prstů a blánou, visí hlavou dolů, když stojí pod pevným stropem), Spáč (hřbet
z nepravidelných kamenných desek, pulzující krystaly se září, rozžhavené oči, při útoku rozevřená tlama). Nová pomůcka `cara()`.
Stav se čte jen při kreslení: útok podle odpočtu `u.utok ≥ 7`, zásah = bílý záblesk 140 ms (pokles `zdravi` od minulého
kreslení, `prebarvi` s cache), smrt = rozpad na částice v barvách tvora (tvor zmizel ze seznamu; ne při načtení hry).
Sprite test 10/10, UI test 74/74, `sw.js` na `webapp-v229`.

**Etapa 4** – převzala ji souběžná relace (překreslení trpaslíků), tato relace blok `trpaslik()`/`spriteTrpaslika()` nemění.

**Etapa 5 (30. 9. 2026)** – příroda: jedle (patra s převislými špičkami a stínem, kořeny, šišky), keř (trsy lístků, bobule
nebo kvítky), balvan (plošky, prasklina, lišejník), tráva (4 snímky kývání klasů), obří houby (prstenec, lupeny, tečky,
pulzující záře, stoupající výtrusy), krápníky (rýhy, mokrý lesk, kapka roste a odkápne), runová deska (otlučené hrany,
pulzující runy, mech), kosti (lebka, žebra, hnát), krystaly (4 hroty s ploškami, záře, putující třpyt), sloup (kanelury,
prasklina, mech), zkameněliny (amonit, trilobit, rybí kostra), brána (zděné pilíře s runami, klenák, zlatá vykládka, okovaná
vrata), Výheň předků (runový podstavec, zděná výheň; zažehnutá = 4 snímky velkého plamene se září a jiskrami z komína
místo statických obdélníků), led (praskliny a šikmý odlesk). Animované objekty v `a.objSn[o][varianta][snímek]`, zimní a
podzimní podoby zůstávají statické z `a.obj`. Oprava vrstvy záře: průsvitná záře už nepřepíše plný pixel plamene
(stejná chyba se předtím projevila u louče). Sprite test 10/10, UI test 74/74, `sw.js` na `webapp-v230`.

**Etapa 4, část (30. 9. 2026)** – hráč si stěžoval, že vousy vypadají jako rouška přes nos: obličej měl jen dva řádky kůže
a vousy začínaly rovnou čarou přes celou šířku tváře včetně nosu. Nově: velký baňatý nos 2 × 2 (`NOS`, `NOS_S`, `NOS_T`) kreslený
až po vousech, takže přečnívá přes knír; knír ve světlejším tónu (`zesvetli(vous, 0.24)` – odliší se i u černých vousů), pod ním
stín úst; ruměná tvář. Čtyři střihy `STRIHY` (řádky 7–12 jako textová mapa) vybírá `strihVousu(vous, prof)`. Při chůzi se trup
ve snímku `jde1`/`nese1` zvedne o pixel. Nové snímky v `SNIMKY_T`: `ji0/ji1` (krajíc), `pije0/pije1` (korbel, střídání po 4 tazích),
`spi` (leží na zádech, noční čepice s bambulí, podle `SPI`), `spip` (v posteli: jen hlava na polštáři a vousy přes přikrývku).
Ve `kresli`: stav `ji` → ji/pije podle `t.prace.typ`, `bojuje` na místě → snímky kope (sekera), spánek místo otočeného spritu,
„Zzz" z `a.ikona.zzz` nad hlavou. Sprite test 10/10, UI test 74/74, sim 0 chyb, `sw.js` na `webapp-v231`.

**Etapa 7 (30. 9. 2026)** – karavana (`a.karavana` = 4 snímky: plachta na žebrech se šňůrováním, náklad v zadním otvoru,
kola s loukotěmi, lucerna se září, mula v postroji stříhá ušima a ohání ocasem, kupec na kozlíku s dýmkou a kouřem).
Ikonky `a.ikona.zzz` (3 snímky, písmena z 4 × 4) a `a.ikona.zuri` (vykřičník) – vykřičník zuřivosti je nasazený, Zzz ve smyčce
spánku převzala souběžná relace (upravuje tam pózy spánku). Ukazatele zdraví trpaslíků i tvorů a průběhu kopání kreslí
`pruh()` (tmavý rámeček, světlá horní hrana). Částice: svítící jiskry mají ocásek proti směru letu, kapky vody jsou protáhlé
(`pridejCastici(…, tvar)`). Značky kopání/schodů/kácení a přednosti zůstaly (průsvitné překryvy jsou čitelné). Ikonky nálad nad
hlavou vynechány – hra takový stav nekreslí. Sprite test 10/10, UI test 74/74, `sw.js` na `webapp-v232`.

**Etapa 6 (30. 9. 2026)** – terén: v jemném stylu nativní rudy 32 × 32 (`texturaRudyJemna`: kovové žilky s leskem a zrny,
uhlí jako sloj čoček, drahokamy a hvězdná ruda jako šestiboké krystaly se světlou a tmavou ploškou a bílým leskem) a praskliny
(`prasklinyJemne`: tenké větvené čáry se světlou hranou). Hladina vody má putující pěnu, hladina magmatu bubliny (obojí
v klasickém i jemném stylu), z magmatu pod volným prostorem létají jiskry (`jiskryZeZdroju`). Hory v pozadí mají třetí,
bližší vrstvu (paralaxa 0,7). „Neznámo" zůstalo – tmavý šum dobře odlišuje neprozkoumanou horu. Animovaný třpyt drahokamů
ve skále vynechán (každá dlaždice navíc × 4 snímky), třpytí se krystaly jako objekty. Sprite test 10/10, UI test 74/74,
`sw.js` na `webapp-v233`.

**Etapa 4 – dokončení (30. 9. 2026)** – na práci souběžné relace (obličej, střihy vousů, pózy spánku, jídla a pití) navazuje:
plavání (`plave0/plave1` – z vody kouká hlava a ruce, spodek odříznutý, čeřící se hladina), jizva přes tvář u čtvrtiny
trpaslíků (hash vousů a profese, v jemném stylu šikmá), překryvy stavu `a.stavTrp` (obvaz přes čelo při zdraví < 50, rudá
tvář při zuřivosti, kapka potu při únavě `spanek < 20`; kreslí se přes sprite i se zrcadlením a houpáním), vlastní portrét
`portretTrpaslika(barva, vous, prof)` 32 × 32 (vždy nativně): ramena s halenou (strážce kroužková zbroj), ovál obličeje se
stínem, uši, oči s leskem, obočí, ruměné tváře, baňatý nos přes knír, vousy podle stejného střihu jako na mapě, pokrývka
hlavy podle profese (helma se svítící lampou, rohatá přilba s nánosníkem, slamák, kapuce se svěšeným cípem); používá ho karta
trpaslíka v `ui.js`. Pleš vynechána – trpaslíci nosí pokrývku hlavy vždy. Sprite test 11/11 (nově portréty 32 × 32),
UI test 74/74, `sw.js` na `webapp-v234`.

**Etapa 8 (30. 9. 2026)** – ladění: prohlédnuty snímky celé hory, jezera, Výhně, zimy, boje a DPI 2 v obou stylech – světlo zleva
shora a sytost drží napříč sprity. Jemný styl při zoomu 1 na displeji s DPI 1 (32 px sprite na 16 px) se teď zmenšuje
s vyhlazením (`ctx.imageSmoothingEnabled = z < J`) – dřív se bral každý druhý pixel a jemné detaily (lesk oka, prameny vousů,
třpyt) náhodně mizely a blikaly; při zoomu ≥ 2 zůstávají ostré pixely, mezi dlaždicemi nevznikají švy. Sprite test hlídá
i paměť atlasu (jemný styl 426 pláten ≈ 2 MB) a dobu stavby (≈ 20 ms klasický, ≈ 70 ms jemný). Průběžné cache
(`cacheTrp`, `cacheVeci`, `cacheHromad`, bílé záblesky) jsou omezené počtem kombinací a mažou se se změnou stylu.
Testy: generátor, scénáře, sprite test 12/12, UI test 74/74 (bot nespouštěn – logika hry se neměnila), `sw.js` na `webapp-v235`.

## Shrnutí (30. 9. 2026)
Všech 9 etap hotových (etapu 4 začala souběžná relace, dokončila tato). Nové pomůcky pro další kreslení: `MAT`, `rampa`,
`stinPod`, `dither`, `trpyt`, `cara`, `kvadr`, `zdivo`, `plamen`, `kour`, `zare`, `lampicka`, `sudCelo`, vrstva `k.zar()`
a dokreslení `hotovo(obrys, jemne)`. Nalezené a opravené chyby: pád kreslení hvězdného prutu na zemi, záře přepisující plamen.

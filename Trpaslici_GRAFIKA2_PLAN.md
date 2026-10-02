# Srdce hory – druhé kolo grafiky: vylepšení a vyhlazení

Navazuje na `Trpaslici_SPRITY_PLAN.md` (všech 9 etap hotových 30. 9. 2026). První kolo přidalo detail jednotlivým
spritům. Tohle kolo řeší **celkový obraz**: hranaté okraje terénu, schodovitou mlhu, ploché světlo, trhanou animaci
a skoky kamery.

## Co je teď nejvíc vidět (snímky při zoomu 8 a v noci, 30. 9. 2026)

- Vykopané prostory jsou přesné obdélníky z dlaždic, rohy ostré, stěna nemá žádnou nerovnost.
- Hranice neprozkoumané hory je schodovitá po celých polích (ostrý skok z neznáma na plnou dlaždici).
- Styk dvou hornin (hlína × vápenec) je rovná čára po okraji dlaždice, textury se opakují po 16/32 px.
- Světlo je jen stmívání: mapa tmy má 1 px na pole, louč, výheň ani magma nic nezbarví, světlo „neteče" za roh.
- Trpaslíci chodí ve 2 snímcích (tvorové už ve 4), pohyb mezi poli je lineární, animace běží po 125 ms.
- Zoom skáče po celých násobcích (1–8), kamera při sledování trpaslíka cuká.
- V noci je nad spícími hodně velkých „Zzz", ukazatele a značky naskakují bez přechodu.
- Jemný styl = EPX (zaoblí jen úhlopříčky 45°), obrys je všude stejně tmavý.
- Objekty mají jen 4 pevné varianty (`hra.hora.varianta` 0–3) – les jedlí, řada keřů nebo pole hub vypadá jako
  kopírovaný; stejné sprity se opakují i u věcí na zemi, nábytku a tvorů.

## Zásady

- Logika hry se nemění; vše jen v `grafika.js` (+ kamera v `ui.js`), testy v node musí dál projít beze změny.
- Rozpočet výkonu: snímek ≤ 8 ms na 1280 × 800 při zoomu 2 v jemném stylu (měřit před a po každé etapě),
  stavba atlasu ≤ 400 ms, paměť atlasu ≤ 48 MB.
- Každá nová vrstva jde vypnout (přepínač v nastavení grafiky / proměnná), kdyby na slabém stroji brzdila.
- Po etapě: `_test/trpaslici_sprity_test.py`, UI test (`TEST_PORT=8393 DRIVER_PORT=9813`), snímky v obou stylech
  a při DPI 2, zápis do tohoto souboru a dodatek do `Trpaslici_PLAN.md`, zvednout `sw.js`.

## Etapy

### A. Okraje terénu (autotiling) ✅ (30. 9. 2026)
- [x] Vypuklé rohy vykopaných prostor zaoblit (poloměr 3 px, v jemném 6 px) – do rohu se kreslí pozadí/zeď s maskou.
- [x] Nerovná hrana stěny: každá odkrytá strana pevné dlaždice dostane profil z šumu (1–2 px výstupky a zuby),
      podle horniny (žula hrubá, hlína měkká, zdivo rovné).
- [x] Vydutý roh (kout) s ambientní okluzí – tmavší klín v rohu místo dvou nezávislých stínů.
- [x] Styk dvou hornin: pás 2–3 px rozptýlený přes Bayerovu matici místo rovné čáry; rudy mohou přesahovat do souseda.
- [x] Menší opakování textur: 4 varianty → 8 a otočení/zrcadlení podle pole.
- Test: snímek vykopané síně 8 × 3 při zoomu 8 v obou stylech; čas snímku.

### R. Náhodné varianty spritů ✅ (30. 9. 2026)
Princip: vzhled se odvodí z hashe `smichej(seed hory, pole, druh)` – je stabilní (po načtení i po přeposunu kamery
stejný), nemění uložení hry ani logiku. Sprite se generuje z parametrů a ukládá do cache podle zaokrouhlených parametrů
(např. 16–32 kombinací na druh), takže paměť zůstane v mezích; zrcadlení zdarma přes transformaci.
- [x] **Stromy (jedle):** výška ±4 px, šířka a počet pater, nesouměrné větve (jedna strana delší), lehký náklon, odstín
      zeleně (tmavší/modřejší/žlutější), šišky, ulomená větev nebo suchá špička, mladý stromek × starý strom s holým
      kmenem, výjimečně suchý strom. Na podzim a v zimě každý strom mění barvu a nabírá sníh trochu jinak.
- [x] **Keře:** tvar koruny (kulatý, rozložitý, řídký), hustota a barva bobulí nebo květů, velikost.
- [x] **Tráva:** počet a výška stébel, poměr kvetoucích, suchá stébla, fáze kývání posunutá podle pole (vítr jde vlnou).
- [x] **Balvany:** obrys, plošky, praskliny, množství lišejníku a mechu, občas malý kamínek vedle.
- [x] **Houby:** výška třeně, šířka a náklon klobouku, počet teček, odstín, trsy 1–3 hub, fáze záře posunutá.
- [x] **Krápníky a krystaly:** počet a délka hrotů, šířka, zlomený hrot; krystaly různé úhly a barevné odstíny.
- [x] **Pařezy, kosti, zkameněliny:** výška řezu a letokruhy, rozházení kostí, natočení zkameněliny.
- [x] **Věci na zemi:** zrcadlení a drobný posun v hromádce, 2–3 tvary hroudy kamene/rudy/uhlí, polena různě dlouhá.
- [x] **Nábytek a stavby:** opotřebení (suky, oprýskání, mech u kamenného), barva přikrývky u postelí, věci na stole
      (korbel/svíčka/talíř/nic); zdivo s občas jiným kvádrem.
- [x] **Tvorové:** velikost ±1 px, odstín kůže goblinů, znak na zadečku pavouka, jizvy; vůdce/šaman goblinů odlišný.
- [x] **Trpaslíci:** k existujícím střihům vousů odstín haleny, záplaty, delší/kratší kapuce, náušnice, podle `t.id`.
- [x] Náhled: v `_test/trpaslici_sprity.html` mřížka 8 × 4 náhodných kusů od každého druhu; test ověří, že varianty
      jsou opravdu různé (hash obrázku) a že cache nepřeroste limit.

### B. Mlha neprozkoumaného a světlo ✅ (30. 9. 2026)
- [x] Měkký okraj neznáma: tma prolne 4–6 px do známého pole (přechod rozptýlením), žádné schody po polích.
- [x] Mapa světla ve 4× jemnějším rozlišení (4 × 4 vzorků na pole) s rozmazáním – světlo plynule obtéká rohy.
- [x] Barevné světlo: teplá louč a výheň, rudé magma, modrozelené houby a krystaly, studený měsíc; míchání
      aditivně do tónovací vrstvy.
- [x] Mihotání světla louče a výhně v rytmu snímků plamene (±5 % dosahu).
- [x] Denní přechody plynule (svítání a soumrak barevně, ne jen jas).
- Test: noční snímek s loučí, výhní a magmatem; čas přepočtu mapy světla při změně (≤ 4 ms).

### C. Plynulejší animace ✅ (30. 9. 2026)
- [x] Trpaslík: chůze 4 snímky (jde0–jde3), lezení 4 snímky, rozmach krumpáčem 3 snímky; mrkání a dýchání v klidu
      (občas, s posunem fáze podle id).
- [x] Pohyb mezi poli s mírným zrychlením a zpomalením (ease), pád se zrychlením, dopad s prachem.
- [x] Voda a magma 8 snímků místo 4, louč 6 snímků; snímky se přepínají podle skutečného času, ne po 125 ms tiku.
- [x] Záblesk při zásahu doznívá (bílá → normální přes 3 kroky), ne tvrdě 140 ms.
- Test: sprite test (rozměry nových snímků), UI test kopání a boje.

### D. Kamera a zoom ✅ (30. 9. 2026)
- [x] Plynulý zoom: animace mezi celými násobky přes ~150 ms (během animace necelý násobek, na konci zase ostrý).
- [x] Sledování trpaslíka s tlumením (kamera dojíždí), setrvačnost po tažení myší.
- [x] Zaokrouhlení posunu kamery na celé pixely zařízení – žádné chvění spritů při pomalém posunu.
- Test: DPI 2 (klik trefí pole i během animace zoomu), úzký displej.

### E. Hladší jemný styl ✅ (30. 9. 2026)
- [x] Lepší zvětšovač místo EPX: vyhlazení šikmých hran i mimo 45° (xBR-lite / MMPX), prostřední tón na schodech.
- [x] Výběrový obrys (sel-out): obrys v tmavší barvě sousedního pixelu spritu místo jednotné černé – méně „nalepený" vzhled.
- [x] Třetí styl „hladký" (4× = 64 px na pole) pro zoom ≥ 4: dvojí zvětšení + dokreslení, automaticky podle zoomu
      (1× při zoomu 1, 2× při 2–3, 4× od 4) – vždy ostré pixely obrazovky.
- Test: paměť a čas atlasu pro 4× (odhad 8 MB, ≤ 400 ms), porovnávací snímek 1× / 2× / 4×.

### F. Obloha a přechody barev ✅ (30. 9. 2026)
- [x] Obloha: přechod rozptýlený (bez pruhů), hvězdy v noci se jemně třpytí, měsíc; mraky ve 2 vrstvách s paralaxou.
- [x] Hory v pozadí: vzdušná perspektiva (vzdálenější světlejší a modřejší), měkký okraj siluety.
- [x] Hladina vody průsvitná s odrazem oblohy/světla, u břehu tmavší.
- [x] Horniny s hloubkou nepatrně chladnější a tmavší (plynule, ne skokem po vrstvách).

### G. Efekty a částice ✅ (30. 9. 2026)
- [x] Oheň, jiskry a záře kreslit aditivně (`lighter`), částice se zmenšují a doznívají.
- [x] Prach po vykopání se usazuje, kouř a pára měkké (kruhové s průhledností, ne čtverečky).
- [x] Zával: krátké zatřesení obrazu (vypínatelné) a oblak prachu.

### H. Značky a ukazatele ve hře ✅ (30. 9. 2026)
- [x] „Zzz" menší, stoupá a mizí; nad skupinou spáčů nejvýš jedno na 2 pole.
- [x] Značky kopání/kácení a výběrový rámeček s pulzujícím okrajem, naskakují s krátkým přechodem.
- [x] Ukazatele zdraví a průběhu plynule dojíždějí k nové hodnotě a při plném zdraví zmizí.

### I. Výkon a kontrola ✅ (30. 9. 2026)
- [x] Měření času snímku v UI testu (průměr a 95. percentil) v obou stylech a při DPI 2.
- [x] Předkreslení statického terénu do bloků (např. 16 × 16 polí), překreslit jen při změně – uvolní čas pro světlo a okraje.
- [x] Porovnávací snímky před/po pro každou etapu (stejný seed, stejná pozice kamery).

## Doporučené pořadí
A → R → B → C → E → D → F → G → H, výkon (I) průběžně – nejdřív okraje terénu a náhodné varianty (obojí bourá
„dlaždicový" a „kopírovaný" dojem), pak světlo, pohyb a jemný styl, nakonec drobnosti.

## Záznamy

**Výchozí měření (30. 9. 2026)** – `_test/trpaslici_vykon.py` (headless bez GPU, 1280 × 800, po 3000 tazích): klasický zoom 1/2/4 = 10,6 / 8,0 / 5,3 ms, jemný 15,4 / 6,8 / 5,9 ms (průměr); p95 17–63 ms (špičky při přepočtu).

**Etapa A (30. 9. 2026)** – okraje terénu: pevné pole u volna nebo u jiné horniny se kreslí jako předpočítaná dlaždice
`dlazdiceOkraje()` (cache max. 5000 kusů, nejstarší se zahazují): nerovná hrana z 1D šumu ve světových souřadnicích
(navazuje přes pole; amplituda a vlnová délka podle horniny v tabulce `OKRAJ` – žula a suť hrubé, hlína měkká, zdivo
a runy rovné), zaoblené vypuklé rohy (poloměr 9 px hlína/jíl … 5 px žula/čedič), světlá horní hrana a stíny se počítají
podle skutečného profilu, do odříznutého místa prosvítá zeď pozadí nebo obloha, nahoře pod trávou a sněhem se nezubatí.
Vyduté kouty volných polí dostanou čtvrtkruhovou výplň horniny `vyplnKoutu()` – schody po polích se mění v plynulé
zaoblené stěny. Styk dvou hornin je rozptýlený pás 2 px (Bayer). Rudy a zkameněliny se u okrajových polí zapékají
do dlaždice. Textury horniny a zdi se u poloviny polí zrcadlí (8 variant místo 4). Vše lze vypnout `okrajeZapnute`.
Měření: klasický 9,3 / 7,1 / 4,9 ms, jemný 13,1 / 6,2 / 5,0 ms (zoom 1/2/4) – bez zpomalení. Nový test výkonu
`_test/trpaslici_vykon.py`. Sprite test 12/12, UI test 74/74, `sw.js` na `webapp-v236`.

**Etapa R (30. 9. 2026, agent ve vlně 1)** – 16 variant z hashe pole + zrcadlení: jedle (výška, patra, nesouměrnost, náklon,
4 odstíny, šišky, ulomená větev, suchá špička, mladý stromek, starý holý kmen, vzácně suchý strom), keře, balvany, tráva,
houby (trsy 1–3), krápníky, krystaly (5 odstínů), pařezy, kosti; sezónní podoby líně k variantě (`zasnez(zdroj, v)`,
`podzimObj`). Líná cache `spriteObjektu()` (limit 1200, LRU), `variantaPole()`. Zkameněliny natočené zrcadlením. Věci: 3 tvary
hroudy, různá polena, zrcadlení podle `v.id`, 4 varianty hromádek. Nábytek 8 variant (barvy a vzory přikrývek, co je na stole,
opotřebení – suky, oprýskání, mech). Goblini 3 odstíny + vůdce s přilbou (`u.id % 6 === 0`), pavouci 3 znaky. Trpaslíci
4 vzhledy podle `t.id % 4` (odstín haleny, záplata, náušnice, delší cíp) – nový 8. parametr `spriteTrpaslika`. Náhled
`?jen=var`, sprite test 90/90 (varianty se opravdu liší, cache v limitu). Vynecháno: velikost tvorů ±1 px, jizvy tvorů,
zdivo s jiným kvádrem, kratší kapuce.

**Etapa B (30. 9. 2026, agent ve vlně 1)** – `svetloVrstva()` 4 × 4 vzorků na pole s rozmazáním (světlo obtéká rohy), barevné
zdroje `najdiZdroje`/`sirBarevne` (louč teplá, ohnivé dílny, Výheň předků, rudé magma, modrozelené houby, krystaly) s mihotáním
±5 % dosahu, denní barvy `barvaDne` (měsíc, předjitří, východ, zlatá hodina, západ, soumrak), měkký okraj neznáma `mlha` bez
prozrazení tvaru skrytých jeskyní. Přepočet jen při změně: 0,5–1 ms (mihotání/změna), s novými známými poli ~2,7 ms, první
snímek 6–11 ms. Přepínač `TRP.grafika.barevneSvetlo(false)`, měření `TRP.grafika.casSvetla()`. `svetlo.js` (logika) beze změny.
Omezení: magma/houby svítí jen vizuálně; bez `ctx.filter` (starší Safari) jen vyhlazení.

**Etapa D (30. 9. 2026, agent ve vlně 1)** – `ui.js`: dvojice kamer `kam` (cíl, testy čtou hned) a `vid` (co je vidět);
`zoomuj(krok, cx, cy, plynule)` – kolečko, tlačítka, klávesy a pinch zoomují plynule 150 ms (geometricky, bod pod kurzorem drží),
bez 4. parametru okamžitě; dojezd kamery (τ 140 ms) při sledování trpaslíka, šipkách a minimapě; setrvačnost po tažení
(útlum τ 320 ms); posun zaokrouhlený na celé px zařízení (`kamKresby`); v `kresli()` vyhlazení i při necelém zoomu během
animace. Přepínač `TRP.ui.plynule` (výchozí vypnuto při prefers-reduced-motion). Oprava při integraci: dotyk během dojezdu
měnil cíl kamery (první bod tažení mířil jinam) – `zastavKameru()` teď jen dokončí dojezd a `poleZBodu()` mapuje na cíl
kromě animace zoomu. Omezení: proužky na horách v pozadí během animace zoomu (řeší etapa F).

**Vlna 1 celkem:** node testy 0 chyb, sprite test 90/90, UI test 76/76, výkon jemný zoom 2 = 6,4 ms (klasický zoom 1 13,6 ms),
`sw.js` na `webapp-v239`.

**Etapa C (30. 9. 2026, agent ve vlně 2)** – trpaslík: nové snímky `jde2`, `jde3`, `leze2`, `leze3`, `kope2` (vrchol rozmachu),
`mrk`, `dech`; chůze a lezení = celý 4snímkový cyklus na jedno pole podle postupu kroku (nohy nekloužou), kopání
`kope2 → kope0 → kope1 (úder) → kope0`, v klidu nádech a mrknutí (fáze podle `t.id`). Ease `postupTrp()`: první krok cesty
se rozjíždí, poslední dojíždí, uprostřed lineárně (navazování podle paměti ve WeakMap); pád se zrychlením a prach při dopadu;
`polohaTrpaslika` používá stejný výpočet (kamera a klikání = kreslení). Tvorové stejný ease (`postupKroku`). Louč 6 snímků podle
skutečného času, záblesk tvora doznívá ve 3 krocích. Omezení: zablokovaný další krok zastaví bez dojezdu; tvorové nepadají zrychleně.

**Etapa F (30. 9. 2026, agent ve vlně 2)** – obloha `barvyNebe()` navázaná na `barvaDne`: barevné svítání a soumrak, v noci tmavě
modrá s 520 třpytivými hvězdami a měsícem na oblouku (19–6 h); přechod předkreslený do dlaždice s rozptýlením (bez pruhů).
Mraky ve 2 vrstvách s paralaxou. Hory: vzdušná perspektiva, v noci tmavé siluety, měkký okraj, kreslené cestou (opraveny
proužky při animaci zoomu). Nová `tmaMimoMapu()` – nad mapou už v noci nesvítí obloha. Kapaliny 8 snímků (`KAP_SNIMKU`, plynulá
smyčka `vlna()`), průsvitnější hladina s odlesky a barvou obzoru venku, tmavší voda u břehu (`brehVody`, `a.breh`). Horniny
s hloubkou chladnější a tmavší (průsvitné pásy po 2 řádcích). Přepínač `TRP.grafika.oblohaEfekty(false)`.

**Etapa G (30. 9. 2026, agent ve vlně 2)** – svítící částice aditivně (`lighter`) se září z předkreslených měkkých spritů
(`mekkySprite`, cache), zmenšují se a doznívají; nové tvary `prach` (odpor vzduchu, pomalu klesá a drobí se) a `kour` (měkký
obláček, roste a řídne); vykopání = úlomky + obláčky, zával = úlomky, oblak a zatřesení obrazu (`otresPosun`, max 2 px, 300 ms,
tlumené). Svítící částice se kreslí i bez tmy (dřív v tom případě nestárly). Přepínače `TRP.grafika.aditivniEfekty()`,
`TRP.grafika.zatreseni()` (paměť v localStorage, zatřesení vypnuté při prefers-reduced-motion).

**Vlna 2 celkem:** node testy 0 chyb, sprite test 90/90, UI test 76/76; výkon jemný zoom 2 = 6,7–7,0 ms (rozpočet splněn),
ale zoom 4 zpomalil z ~5 na ~8,3 ms a p95 špičky až 75 ms – řeší etapa I. `sw.js` na `webapp-v243`.

**Etapa E (30. 9. 2026, agent ve vlně 3)** – zvětšovač MMPX (McGuire & Gagiu 2021) místo EPX + `schody()` doplní na šikmé
hrany jeden prostřední tón; zvětšuje se pole indexů palety (jemný atlas rychlejší: 89–116 ms). Výběrový obrys (sel-out):
obrys v ztmavené barvě sousedního pixelu (jemný/hladký 60 %, klasický 30 %). Nový styl „hladká (4× při přiblížení)": J=4 se
zapne automaticky od zoomu 4 (hystereze pod 3,5), sady cache pro každé J zvlášť (`prepniJ`, přepnutí 0,1 ms, první stavba
~200–290 ms), nativní textury se ve 4× zdvojí (`na4`), okraje terénu přes `S*J`; limity cache ve 4× nižší. Atlas: klasický
30 ms, jemný 89 ms / 2,5 MB, hladký 192 ms / 10 MB. Porovnání `TRP.grafika.zvetsovac('epx'|'mmpx'|'mmpx2')`, náhled
`styl=jemny-epx|hladky`. Omezení: jednorázové zadrhnutí při prvním přechodu na 4×, textury ve 4× bez nového detailu.

**Etapa H (30. 9. 2026, agent ve vlně 3)** – Zzz = dvě malá stoupající a mizející písmena (`zetko`, `a.ikona.z`), na poli
jen jeden spáč, v řadě jen každý druhý; značky kopání/schodů/kácení s pulzujícím okrajem (jeden `stroke` na typ) a prolnutím
180 ms při vzniku (jen u polí viditelných i v minulém snímku); pulzující výběrový rámeček; ukazatele zdraví dojíždějí
(τ 140 ms) a při plném zdraví zmizí, průběh kopání plyne i mezi tahy; `TRP.grafika.animuje()` drží překreslování během přechodů.
Nastavení: blok „✨ Efekty" (barevné světlo a mlha, obloha a odlesky, zářivé jiskry a oheň, okraje terénu, zatřesení
při závalu, plynulá kamera) uložený v `webapp_hra_trpaslici_efekty`; nový `TRP.grafika.okrajeTerenu()`.

**Vlna 3 celkem:** node testy 0 chyb, sprite test 132/132, UI test 76/76; výkon (klidný stroj) jemný zoom 2 = 6,5–6,7 ms,
zoom 1 ~13 ms, zoom 4 ~8 ms s p95 ~70 ms – řeší etapa I. `sw.js` na `webapp-v245`.

**Etapa I (30. 9. 2026, samostatný agent)** – příčiny: dlaždice oblohy se stavěla znovu v 80 % snímků (klíč podle hodiny;
při zoomu 4 přes 2000 řádků, 2,6 MB ImageData za snímek → úklid paměti = špičky 65–80 ms), vrstva světla se přepočítávala
a rozmazávala přes celou mapu, při zoomu 1 ~4000 polí po několika `drawImage`, test měřil jen JS (nyní vynucené dokreslení
přes `getImageData` 1 px). Opravy: klíč oblohy podle barev + jen viditelné řádky + znovupoužité ImageData; světlo jen ve
výřezu kolem pohledu (`svetloVyrez`); předkreslení terénu do bloků 16 × 16 polí při zoomu 1–2 s podpisem obsahu bloku (hash
terénu, pozadí, rud, známých polí, `lez` i o pole kolem), kapaliny zvlášť, LRU 40 MB (`blokyTerenu`); v pauze nevznikají
nové jiskry (překreslení 23/s → 7,7/s); cache barev minimapy; měření fází `mereniFazi(true)`.
Měření s dokreslením (klasický / jemný, zoom 1/2/4): 4,9 / 3,8 / 4,4 a 4,6 / 4,7 / 5,3 ms, p95 ≤ 7,3 ms (dřív 26–79 ms),
v klidu 3,7–4,6 ms. DPI 2: 13–16 ms (software rastr, 4× víc pixelů). Test výkonu 4/4 (nově klid, p95, překreslení v pauze,
`DPI=2`). Obraz terénu pixelově stejný s bloky i bez nich.

## Shrnutí druhého kola (30. 9. 2026)
Hotové všechny etapy A, R, B, C, D, E, F, G, H, I. Etapy B–I udělali agenti ve vlnách (1: R, B, D; 2: C, F, G; 3: E, H;
pak I samostatně) s oddělenými částmi kódu a vlastními porty prohlížeče; orchestrátor po každé vlně spustil všechny testy
a zapsal výsledky. Při integraci opravena jedna chyba (dotyk během dojezdu kamery měnil cíl – první bod tažení mířil vedle).
Konečný stav: node testy 0 chyb, sprite test 132/132, UI test 76/76, výkon 4/4, `sw.js` na `webapp-v246`. Všechny nové
efekty jdou vypnout v nastavení („✨ Efekty") nebo přes `TRP.grafika.*`.

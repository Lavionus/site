# Plán: 🧊 Modelář 3D (od 14. 10. 2026)

Snadné 3D CAD v prohlížeči pro 3D tisk. Ovládá se jako Tinkercad, ale umí víc: zaoblení a sražení hran,
skicy, závity, ozubená kola, pole a export do souborů STL/3MF/OBJ/STEP. Vše běží lokálně, bez účtu.
Vzorem funkcí je [layerling](https://layerling.com/) (AGPL-3.0). **Modelář je vlastní aplikace, ne fork.**

## Pravidla „čisté místnosti“ (právní rámec)

Layerling je pod AGPL-3.0. Kdyby se z jeho kódu přebíral text, struktura funkcí nebo data, vzniklo by
odvozené dílo a celý Modelář by musel být pod AGPL. Proto platí:

1. **Přebírají se jen myšlenky:** seznam funkcí, chování z pohledu uživatele a volba veřejných knihoven.
   Funkce, ovládání ani vzhled se autorským právem chránit nedají.
2. **Při psaní se zdrojáky layerlingu neotevírají.** Průzkum 14. 10. 2026 prošel jen strukturu souborů,
   importy a dokumentaci formátu. Výsledky jsou shrnuté níže v části „Co jsme se naučili“. Víc není potřeba.
3. **Nepřebírají se data ani média:** ikony, obrázky z návodu ani texty nápovědy.
4. **Formát projektu je vlastní** (žádné `.lyl`).
5. **Licence knihoven:** three.js (MIT), manifold-3d (Apache-2.0), occt-wasm (MIT/Apache, uvnitř OpenCascade
   LGPL-2.1 s výjimkou, takže stačí uvést oznámení a nechat WASM jako samostatný nahraditelný soubor),
   opentype.js (MIT), clipper (Boost). Do aplikace přidáme stránku „O aplikaci / licence“.

## Co jsme se naučili z průzkumu layerlingu (architektura, ne kód)

- Má ~100 tis. řádků TypeScriptu (Next.js + React). Dva soubory mají po 13 tis. řádků. **Ponaučení:** malé moduly.
- **Dvě jádra:** rychlé meshové booleany (manifold-3d) pro běžnou práci a OpenCascade (WASM ve workeru,
  ~21 MB) jen pro přesné operace: zaoblení a sražení hran, skořepinu, STEP a závity a pružiny jako B-rep.
- Tvary jsou parametrické definice. Mesh se z nich vždy přegeneruje a uloží se jen „upečená“ geometrie (importy, výsledky OCCT).
- Jeden plochý objekt tvaru se stovkou volitelných polí pro všechny druhy. **Ponaučení:** u nás má každý druh vlastní `param`.
- Projekt obsahuje historii undo, sdílená data jsou deduplikovaná podle hashe a soubor se při otevření validuje.
- Má limity proti zamrznutí OCCT (počet trojúhelníků, časový limit, restart jádra po vyčerpání paměti).

## Rozhodnutí (uživatel 14. 10. 2026 potvrdil název, umístění a nahrazení tinkercad.html)

1. **Název: Modelář 3D** (potvrzeno), umístění v `github_site` (potvrzeno). Soubory `obsah/modelar.html` + `obsah/modelar/*.js`, jmenný prostor `MDL`.
2. **Platforma:** čistý JS bez sestavování jako ostatní stránky webu. Three.js 0.160 se načte z `obsah/lib/`
   a stávající `fonty/fonty.js`, `opentype`, `clipper` a `jspdf` se použijí znovu. WASM jádra budou v `obsah/lib/manifold/` a `obsah/lib/occt/`.
3. **Zdroj pravdy = strom receptu.** Scéna je strom uzlů a obě jádra jsou jen „překladače“ tohoto stromu:
   manifold dělá rychlý mesh, OCCT na požádání přesné B-rep. Upéct (zafixovat mesh) je potřeba jen u importů.
4. **Manifold od první etapy.** OCCT se načítá líně (až při první přesné operaci) ve vlastním workeru.
5. **Starý `obsah/tinkercad.html`** (665 řádků, vlastní CSG) se po dokončení etapy 4 nahradí přesměrováním na Modelář (potvrzeno).
6. **Žádné funkce pro tiskárny** (přání uživatele): bez profilů tiskáren, kontroly desky, převisů ani odhadu filamentu.
   Výstupem je export objektů do souborů. Deska je jen pracovní plocha s volitelnou velikostí.
7. **Česky,** jednotky mm (palce volitelně v etapě 10).
8. **Bez AI a MCP** (statický web nemá server). Lze se k tomu vrátit později.

## Soubory a moduly (smlouva)

Logika bez DOM musí jít spustit v node, aby šla testovat.

| Soubor | Obsah | node |
|---|---|---|
| `jadro/sit.js` | síť `{poz, idx}`: svaření, kontrola vodotěsnosti, objem, obálka, orientace, geometrie pro zobrazení (normály se zlomem 30°) | ✔ |
| `jadro/model.js` | uzly a dokument (neměnné úpravy se sdílením), normalizace, `obalkaUzlu`, `spodekUzlu`, `klicGeometrie` | ✔ |
| `jadro/historie.js` | zpět/znovu: záznam = stav po akci (dok, výběr, popis), slučování opakovaných akcí (šipky, 1,5 s), limit 500 | ✔ |
| `jadro/transformace.js` | posun, otočení kolem osy, zrcadlení (příznaky `zrcadlo`), zarovnání, položení na rovinu / plochou, změna velikosti úchytem, duplikace s opakováním; pracovní rovina `{puvod, osy:[u,v,n]}` | ✔ |
| `jadro/tvary.js` | katalog `M.TVARY` (12 tvarů: popis parametrů, výchozí rozměr a barva) a obecné generátory `rotacni`, `hranolove`, `zaoblenyKvadr`; složité díly později v `jadro/tvary/*.js` | ✔ |
| `jadro/booleany.js` | `M.vytvorBooleany(w)`: skupina → manifold (sjednocení/průnik plných − díry, rekurzivně), barvy přes `runOriginalID`, LRU mezipaměť Manifoldů s `delete()`; `M.zobrazovaciData` | ✔ |
| `jadro/occt.js` | `M.vytvorOcct(m)`: B-rep z receptu (analytické tvary přesně, ostatní z rovinných ploch sítě), skupiny přes fuseAll/common/cutAll, úprava skupiny (zaoblení, sražení, skořepina; hrany a plochy dohledané geometricky), hrany jako lomené čáry, rovinné plochy, síť, STEP export (záložní síť pro díly) a import | ✔ |
| `jadro/vykres.js` | technický výkres: pohledy v 1. kvadrantu (nárys, půdorys, bokorys zleva) + izometrie, ostré hrany a obrysy, viditelnost po kouscích hran (mřížka promítnutých trojúhelníků), skryté čárkovaně bez překryvu s viditelnými, kóty, měřítko z normalizované řady, razítko, `M.vykresSvg` | ✔ |
| `jadro/dilna.js` | měření (vzdálenost, úhel, kružnice třemi body), přichycení, poznámky a referenční body (`dok.poznamky`), vlastní tvary (`tvarZUzlu`, `vlozTvar` s novými id) | ✔ |
| `jadro/skica.js` | skica: tvary (obdélník, kruh/elipsa, n-úhelník, cesta s oblouky b = tan(θ/4) a zaoblením, text, polygony), obrysy, synchronní obálka, `M.manifoldSkici` (CrossSection: sjednocení − otvory, extrude se zúžením/zkroucením, zkosení vršku, revolve) | ✔ |
| `jadro/dily.js` | parametrické díly `M.DILY` (šroub, matice, díra se závitem, díra pro šroub, ozubené kolo, pružina, pant, vroubkování, plástev, štítek): tabulky závitů M/UNC/UNF/BSW, analytická obálka, `manifold(w, p)`; šroubovice = řez vytažený se zkroucením | ✔ |
| `jadro/upravy.js` | pole (lineární, kruhové, spirálové), rozdělení rovinou (dvě skupiny těleso − poloprostor), rovinná plocha pod kliknutím (clipper), středy děr, vzor děr (skica + seskupení) | ✔ |
| `jadro/soubory/svg.js` | SVG → obrysy: cesty (vč. A, S, T), tvary, transformace, viewBox a jednotky, fill-rule; plocha / obrys (tah, clipper offset) / silueta | ✔ |
| `jadro/soubory/zip.js` | ZIP bez knihoven: zápis store/deflate-raw (CompressionStream), čtení, CRC32, limit rozbalení | ✔ |
| `jadro/soubory/{stl,obj,trojmf}.js` | STL (binární i textové), OBJ (o/g, v/vt/vn, vějíř; zápis s `mtllib`/`usemtl`, `M.obj.mtl`, čtení MTL (Kd) i barev vrcholů), 3MF (jednotky, build, komponenty i v dalším .model přes p:path, barvy objektů i po trojúhelnících, basematerials i colorgroup) | ✔ |
| `jadro/soubory/projekt.js` | `.modelar` = gzip JSON {format, verze, nazev, dok, deska, kamera, zdroje (base64)}; ověření před otevřením | ✔ |
| `jadro/soubory/export.js` | `M.exportuj` (světové sítě, skupiny přes `sitSkupiny`, sloučení, „každá barva zvlášť“ přes `castiPodleBarev`, OBJ + MTL a STL po barvách v ZIPu), `M.nactiGeometrii` (i ZIP a OBJ s přiloženými MTL), `M.uzlyZImportu` (barvy trojúhelníků ke zdroji) | ✔ |

| `worker.js` | klasický worker: `importScripts` jádra + `import()` manifoldu, zpráva `{id, typ:'skupina', uzel}` → data pro zobrazení (přenos bez kopie) | |
| `vypocty.js` | `M.spocitejSkupinu(uzel)` → Promise, slučování stejných klíčů, záloha v hlavním vlákně, událost `vypocty`; přesné jádro: líný worker `worker_occt.js` (z file:// hlavní vlákno + WASM z gzip+base64), `pripravOcct` dopočte sítě skupin s úpravou do `M.zdroje` pod `klicOcct`, `M.occtHrany/occtPlochy/occtOver/occtStep/occtImportStep`, událost `occt` | |
| `worker_occt.js` | klasický worker přesného jádra: `importScripts` jádra + `occt.klasicky.js`, typy `sit`, `hrany`, `plochy`, `step`, `importStep` | |
| `ui/dilna.js` | nabídka Dílna: měření s přichycením v pixelech (i z okolí kurzoru), poznámky (SVG vrstva), řez pohledem (ořezová rovina materiálů, vnitřek oranžově), historie s posuvníkem, okno Výkres (náhled, SVG, PDF přes jsPDF s Liberation Sans), Moje tvary, paleta Ctrl+K | |
| `ui/occt.js` | panel Zaoblení/Sražení/Skořepina (nemodální, vpravo), SVG vrstva s hranami (klik = výběr), klik na stěnu v režimu `plochy`, ověření přesným jádrem před zápisem, `M.odeberUpravu` | |
| `spolecne.js` | jmenný prostor `MDL` (`globalThis.MDL`, aby šel sdílet i mezi moduly v node), události `M.na/M.vysli`, `M.mm` | ✔ |
| `kamera.js` | oběžná kamera bez DOM: az/el/vzd/cíl, perspektiva + orto ve shodě, zoom ke kurzoru, posun, animace, Domů podle bodů | ✔ |
| `deska.js` | pracovní deska: shader mřížky (fwidth, jemná mřížka mizí), osy, okraj, barvy motivu | |
| `kostka.js` | kostka pohledů (26 oblastí, `M.oblastKostky` jde v node), tažení otáčí | |
| `scena.js` | renderer, světla, myš, vykreslování na požádání `M.prekresli()`, `S.domu/pohled/projekce` | |
| `stav.js` | `M.app = {dok, vyber, uprava, rovina, rezim, schranka, duplikace}`, `M.zmenDokument` (historie; `docasne` při tažení), `zacniUpravu/dokonciUpravu/zrusUpravu`, zpět/znovu, Ctrl+D, schránka | ✔ |
| `telesa.js` | dokument → objekty three.js, sdílená geometrie s počítáním odkazů, rámeček výběru, díry, `zasah(px,py)`, náhled | |
| `vyber.js` | levé tlačítko: klik, Shift, obdélník, posun tažením (Shift osa, Ctrl volně, Alt kopie), režimy `rovina`/`plochou` | |
| `ui/prikazy.js` | seznam příkazů `M.PRIKAZY` (klávesy, povolení), klávesnice, šipky, lišta a nabídky Zrcadlit/Zarovnat | |
| `ui.js` | lišta, panel desky, stavový řádek, `M.spust()` | |
| `uchyty.js` | SVG úchyty nad plátnem (rohy, hrany, vrchol, šipka zvednutí, oblouky otáčení), tažení, popisek, úhloměr | |
| `ui/knihovna.js` | dlaždice s ikonami vykreslenými z generátorů, přetažení na desku/těleso s náhledem, klik = doprostřed | |
| `ui/inspektor.js` | plovoucí karta: čísla (čárka, Enter, šipky), parametry tvaru, barva, těleso/díra, skrýt, zámek | |
| `ui/seznam.js` | seznam objektů s okem a zámkem | |
| `ui/dily.js` | obrysy písma štítků v hlavním vlákně (FONTY), zápis jako náhrada posledního kroku historie | |
| `ui/upravy.js` | nabídka Úpravy: okna Pole (živý náhled jako úprava), Rozdělit (rovina ve scéně), Vzor děr (režim klikání, 2D náhled), Obalit SVG kolem válce | |
| `ui/skica.js` | editor skici (`<dialog>` přes celou plochu): nástroje, přichycení, panel, podklad, vlastní historie, text přes `FONTY`, `M.pridejSkicu` | |
| `ui/napoveda.js` | nápověda (❓, F1; klávesy z `M.PRIKAZY`, postupy, odkaz na licence) a průvodce pro začátečníky (6 kroků se zvýrazněním, náhradní cíl na úzké obrazovce, sám jen při první návštěvě) | |
| `modelar-licence.html` | stránka licencí knihoven a písem, poznámka k LGPL (Open CASCADE) | |
| `ulozeni.js` | IndexedDB `webapp_modelar` (projekty, zdroje), autosave 1,2 s + při odchodu, náhled `S.vytvorNahled`, přehled, kopie, smazání s úklidem zdrojů | |
| `ui/soubory.js` | název projektu, nabídka Soubor, otevření/import (pole i přetažení), okno Export, `.modelar`, Ctrl+S/O/E, `M.stahniSoubor` | |
| `ui/projekty.js` | okno Moje projekty (karty s náhledem, otevřít, kopie, stáhnout, smazat) | |

Uzel: `{id, druh, nazev, rozmer:[sx,sy,sz], param:{…}, poloha:[x,y,z], rotace:[rx,ry,rz], role:'teleso'|'dira',
barva, skryto, zamceno, deti?:[…], operace?:'sjednoceni'|'prunik'}`. Osa Z míří nahoru (jako slicery a formát STL) a deska leží v Z = 0.
`rozmer` je obalový kvádr tvaru, generátor ho vyplní přesně (střed v počátku); `poloha` je jeho střed ve světě.
Inspektor ukazuje X, Y středu a Z spodku nad deskou. Rotace je Euler XYZ ve stupních kolem středu.

## Etapy

- [x] **1. Kostra a pracovní deska.** HTML, three.js scéna, deska s mřížkou v mm, kamera (otáčení, posun,
  zoom ke kurzoru, ViewCube, pohledy zepředu, shora a z boku, perspektiva a ortografický pohled), světlý a tmavý motiv.
- [x] **2. Model a základní tvary.** `model.js`, 12 tvarů (kvádr se zaoblením, válec, koule, kužel, jehlan,
  střecha, klín, trubka, torus, polokoule, n-boký hranol, kapsle), knihovna s přetažením na desku,
  výběr (klik, Shift, obdélník), inspektor s přesnými čísly, barvy, skrýt a zamknout, seznam objektů.
- [x] **3. Transformace a historie.** Úchyty velikosti, výšky a rotace s kótami při tažení, posun šipkami,
  přichytávání k mřížce a úhlům, zarovnání, zrcadlení, duplikace, pole Ctrl+D, položení plochou dolů,
  pracovní rovina na ploše tělesa, undo a redo (Ctrl+Z/Y), klávesové zkratky.
- [x] **4. Booleany (manifold ve workeru).** Díry, seskupení, rozdělení skupiny, průnik, cache podle hashe,
  vždy vodotěsný výsledek. Test: objemy proti vzorcům, fuzz náhodných skupin.
- [x] **5. Ukládání a soubory.** Autosave do IndexedDB, přehled projektů s náhledy, soubor projektu
  `.modelar` (JSON přes nativní `CompressionStream`, importy deduplikované podle SHA-256, validace při otevření),
  export STL, 3MF a OBJ (výběr nebo vše), import STL, OBJ a 3MF.
- [x] **6. Skici.** 2D editor (čára, oblouk, obdélník, kruh, mnohoúhelník, zaoblené rohy, přesné souřadnice,
  podkladový obrázek), vytažení se zkosením, zkroucením a posunem horní plochy, rotace kolem osy,
  import SVG jako skici (plocha, obrys, silueta), text z `fonty/fonty.js`, lofty mezi dvěma profily.
- [x] **7. Parametrické díly.** Závity (metrické, UNC/UNF, Whitworth: šroub, matice, díra se závitem
  s vůlí pro tisk), ozubená kola (evolventní, čelní, šikmá, vnitřní), pružiny, pant tištěný v celku,
  vroubkování, zahloubené a kuželové díry pro šrouby, plástev, štítek se jménem a ikonou.
- [x] **8. Pole a úpravy těles.** Lineární, kruhové a spirálové pole, vzor děr na rovné ploše (mřížky,
  větrání), rozdělení tělesa rovinou i šikmo, obalení vzoru SVG kolem válce.
- [x] **9. Přesné jádro OCCT.** Líné načtení ve workeru s průběhem, B-rep z receptu, výběr hran myší,
  zaoblení a sražení hran (řetězce tečných hran), skořepina s jednotnou stěnou a otevřenými plochami, import
  a export STEP, limity a restart jádra. **Pojmenování hran:** výběr se ukládá jako geometrický popis (střed,
  směr, normály sousedních ploch) a po přepočtu se dohledává, aby zaoblení přežilo změnu rozměrů.
- [x] **10. Dílna.** Měření (vzdálenost, úhel, poloměr), řez rovinou, posuvník historie, výkresy (tři pohledy
  s kótami do PDF a SVG přes jspdf), poznámky, referenční body, příkazová paleta Ctrl+K, vlastní tvary do knihovny.
- [x] **11. Barvy v exportech.** Tělesa podle barev, export 3MF s objekty a barvami, OBJ s MTL, import
  barevného 3MF a OBJ.
- [x] **12. Dokončení.** Dotykové ovládání, offline (`sw.js`), průvodce pro začátečníky, nápověda, stránka
  licencí, katalog v `apps.js`, přesměrování `tinkercad.html`, výkonový test (500 těles).

Odhad rozsahu: 25–40 tis. řádků JS. Etapy 1–5 dají použitelnou náhradu Tinkercadu, 6–8 přidají skicy, díly a pole
a 9 je technicky nejriskantnější (velké WASM, stabilita OCCT).

## Testy (podle [[testy-usporne-pamet]])

- `node _test/modelar_jadro.js` (etapy 1–3: 119 kontrol; kamera, kostka, tvary, model, stav, historie, transformace): model, historie, tvary (vodotěsnost, objem proti vzorci), booleany (fuzz),
  formát projektu (uložit → otevřít = totéž), importy a exporty tam a zpět.
- `node _test/modelar_booleany.js [fuzz]` (etapa 4: 36 kontrol, včetně klasické verze knihovny a base64 WASM, objemy proti vzorcům, vnořené a zvětšené skupiny, barvy,
  seskupení ↔ rozdělení, LRU, fuzz 60 / 300 náhodných skupin).
- `node _test/modelar_soubory.js` (etapa 5: 44 kontrol – ZIP, STL, OBJ, 3MF ze sliceru, .modelar a odmítnutí poškozených, export, import).
- `node _test/modelar_skica.js` (etapa 6: 38 kontrol – plochy tvarů, objemy vytažení/zúžení/zkroucení/posunu/rotace, obálka = síť, úprava skici).
- `node _test/modelar_svg.js` (etapa 6: 30 kontrol – jednotky, cesty, transformace, fill-rule, obrys, silueta, chyby).
- `node _test/modelar_dily.js` (etapa 7: 26 kontrol – 29 variant vodotěsných, pravý závit, šroub projde maticí i dírou se závitem, kola v záběru
  se neprotínají ani při otáčení (a přisunutá ano), vnitřní ozubení, pružina, pant s vůlí, štítek s písmem, uzel dílu).
- `node _test/modelar_upravy.js` (etapa 8: 26 kontrol – pole, rozdělení (objem a strany i šikmo, mezera), plocha a díry, vzor děr, ovinutý vzor A·∫r/R dr).
- `node _test/modelar_occt.js` (etapa 9: 21 kontrol – 26 tvarů přesně (vodotěsné, objem ≈ síť, obálka), skupina s dírou, zaoblení a sražení
  vybraných hran (i po posunu a zvětšení), skořepina otevřená i uzavřená (1084 mm³), chyby česky, STEP tam a zpět ve světové poloze,
  šroub do STEP přes síť, úprava uvnitř manifoldové skupiny).
- `node _test/modelar_dilna.js` (etapa 10: 44 kontrol – výkres kvádru a díry (skryté čáry, překryvy, částečně zakrytá hrana), kóty, měřítka,
  SVG, měření, kružnice třemi body, přichycení, poznámky i v souboru projektu, vlastní tvary, Ctrl+D skupiny, skok v historii).
- `node _test/modelar_barvy.js` (etapa 11: 36 kontrol – skupina podle barev (díra, vnoření, nebarevná skupina, průnik), export po barvách
  (3MF, STL v ZIPu, sloučení), OBJ + MTL tam a zpět (i ZIP, bez MTL, barvy vrcholů), 3MF s barvami po trojúhelnících a colorgroup,
  barvy ze souboru u modelu (zdroj, vypnutí, projekt, poškozená data), názvy barev).
- `python3 _test/modelar_ui_e12.py [dpi]` (etapa 12: 52 kontrol – dotyk přes WebDriver (klepnutí, posun prstem, otáčení, roztažení,
  dva prsty, zrušení posunu druhým prstem), nápověda, průvodce (i na šířce telefonu), výkon s 500 tělesy, offline přes service
  worker (sada v cache, stránka a výpočet bez sítě), stránka licencí; dotyk a nápověda i z file://).
- `node _test/modelar_revize.js` (revize 15. 10. 2026: 52 kontrol – zip bomba, CRC, 3MF validace a limit komponent, STL s výplní,
  ASCII nan, rychlý OBJ, SVG okno/vnořené svg/use, poškozený .modelar, klíče zdrojů s barvami, rozdělení rovinou, barvy stejných
  dílů, barevná díra, rozdělení skupiny-díry, pružina, plástev, pant, ovinutí, NaN ze skici, rotační skica na desce).
- `python3 _test/modelar_ui_revize.py [dpi]` (revize: 94 kontrol – inspektor (celá čísla, Enter, šipky, Ctrl+Z), hidden, zkratky
  s bočním panelem, pole = jeden krok, panely se nepřekrývají, nabídky a Esc, zaoblení skupiny s dírou, panel po posunu,
  dvojklik ve skice, poloměr díry, měření a poznámky, umístění z knihovny a palety; přes server i z file://).
- `python3 _test/modelar_ui_revize2.py [dpi]` (druhá celková revize 15. 10. 2026: 32 kontrol – šipky otáčení trefitelné,
  Esc s prioritou, příkazy během náhledu, zrcadlení po kliku, panel úprav a výběr, poznámka s tělesem, Enter v oknech,
  fokus po přidání tvaru, skicář Esc, panel na střední šířce; server i file://).
- `python3 _test/modelar_ui_prani2.py [dpi]` (druhá várka přání 15. 10. 2026: 97 kontrol – pravé tlačítko bez nabídky prohlížeče,
  rozšířené tvary a odvozená pole (průměry torusu, trubky…), zrcadlení šipkami (M), šipky otáčení s úhloměrem a zadáním úhlu,
  bod otáčení (P) a panel Otočit kolem bodu, zaoblení/sražení a skořepina kliknutím; server i file://).
- `python3 _test/modelar_ui_prani.py [dpi]` (přání 15. 10. 2026: 40 kontrol – pohled zespodu, horní úchyty, zarovnání puntíky (L),
  Shift + pravé tlačítko; přes server i z file://).
- `node _test/modelar_tisk.js` (příprava tisku: 17 kontrol – hmotnost a filament, převisy, kontrola desky s opravami, rozmístění).
- `python3 _test/modelar_ui_revize3.py [dpi]` (třetí revize: 60 kontrol – skryté hrany se nevyberou, rozdělení se skutečnou
  velikostí dílů, dialogy uprostřed, pohled shora, výpočty v polích, text ve skice, kontrola tisku, kóty, klávesa A,
  skupiny hran, úzká lišta; server i file://).
- `python3 _test/modelar_ui_revize4.py [dpi]` (čtvrtá revize: 30 kontrol – orientace pro tisk, odsazení, obrys plochy,
  STEP s dírou pro šroub, Ctrl+Z v panelu, Hotovo během výpočtu, šipky po kliku, normála roztažené skupiny,
  překryvy v kontrole tisku, protikolo; server i file://).
- `python3 _test/modelar_ui_revize5.py [dpi]` (pátá revize: 32 kontrol – sloupek a díry pro vložky, tenké stěny,
  vůle, Backspace na posuvníku, Ctrl+D z inspektoru, Zpět po tělesech, díra na stěnu, zaměření, ☰ Panel na
  1100 px, panel tisku; server i file://).
- `node _test/sw_modelar_check.js` – offline seznam MODELAR v `sw.js` sedí se soubory, odkazy stránky a `importScripts` workerů.
- `python3 _test/modelar_ui_e11.py [dpi]` (etapa 11: 32 kontrol – export po barvách z okna, OBJ + MTL, import OBJ s MTL polem souborů,
  ZIP přetažením, barvy ve scéně a v inspektoru, Zpět, IndexedDB; přes server i z file://).
- `python3 _test/modelar_ui_e10.py [dpi]` (etapa 10: 64 kontrol – měření myší, poznámky a referenční body, řez, historie, výkres SVG/PDF s písmem,
  vlastní tvar, Ctrl+K; přes server i z file://).
- `python3 _test/modelar_ui_e9.py [dpi]` (etapa 9: 67 kontrol – panel, hrany ve scéně, klik myší na hranu, vybrat vše/žádnou, Zpět/Znovu,
  inspektor (upravit, sražení, odebrat), skořepina klikem na stěnu, chyba velkého poloměru, export STEP a import zpět; přes server i z file://).
- `_test/modelar_prohlizec.py`: sdílený obal headless Chromia (zámek `_test/.zamek`, kontrola paměti, profil v /tmp,
  úklid ve finally, sběr chyb včetně `console.error`). Parametr `zastav=N` není potřeba: scéna se kreslí jen na požádání.
- `python3 _test/modelar_ui_e8.py [dpi]` (etapa 8: 44 kontrol – pole, řez, vzor děr klikem, obalení SVG výběrem souboru; přes server i z file://).
- `python3 _test/modelar_ui_e7.py [dpi]` (etapa 7: 42 kontrol – díly z knihovny, inspektor, štítek, skupina s dírou, export; přes server i z file://).
- `python3 _test/modelar_ui_e6.py [dpi]` (etapa 6: 40 kontrol – kreslení myší, klávesy, zpět, výška, dvojklik, zkroucení, loft, text, SVG; text a SVG i z file://).
- `python3 _test/modelar_ui_e5.py [dpi]` (etapa 5: 60 kontrol, vše přes server i z file:// – ukládání a obnovení, projekty, import výběrem
  souboru i přetažením, export s kontrolou obsahu, .modelar tam a zpět).
- `python3 _test/modelar_ui_e4.py [dpi]` (etapa 4: 29 kontrol, seskupení, díra paprskem, zvětšení bez výpočtu, rozdělení, záloha,
  přesměrování, otevření z file://, selhání výpočtu → náhled + hláška).
- `python3 _test/modelar_ui_e3.py [dpi]` (etapa 3: 47 kontrol, úchyty, posun, otáčení, příkazy, rovina skutečnou myší).
- `python3 _test/modelar_ui.py [dpi]` (etapy 1–2: 66 kontrol, snímky `_test/modelar_*_dpiN.png`): skutečnou myší přes WebDriver (přetažení tvaru, úchyty, díra + seskupení,
  undo, export).

## Záznamy z etap

**14. 10. 2026:** průzkum layerlingu (licence AGPL-3.0, architektura), sepsán tento plán. Úprava podle uživatele:
vypuštěna etapa „Pro tiskárnu“ (profily tiskáren, převisy, filament), potvrzen název, umístění a nahrazení tinkercad.html.
Etapy zatím nezačaly.

**14. 10. 2026 – etapa 1 hotová.** `obsah/modelar.html` + `modelar/{spolecne,kamera,deska,kostka,scena,ui}.js`.
- Kamera je vlastní (UMD three.js 0.160 nemá OrbitControls), osa Z nahoru. Zoom je stejnolehlost se středem v bodě
  pod kurzorem, takže bod zůstává na stejném pixelu v perspektivě i v orto (test: odchylka < 0,001 px). Nad obzorem
  se místo desky bere rovina kolmá na pohled procházející cílem, takže cíl neuteče do nekonečna.
- Orto kamera se drží ve shodě s perspektivou: polovina výšky = vzd · tan(fov/2), stojí o 20 m dál kvůli ořezu.
- **Domů** hledá vzdálenost půlením tak, aby rohy desky vyplnily 90 % obrazu. Koule opsaná desce nechávala
  desku na 40 % plochy.
- Vykresluje se jen na požádání a stojící scéna nepřekresluje. Kostka má vlastní malý renderer.
- Past: první měření rozměrů plátna hned po prvním snímku nesedělo o 22 px (rozvržení ještě dotvářel `podpis.js`),
  ResizeObserver to vzápětí srovná. Test proto čeká 0,5 s a kontroluje šířku i výšku bufferu.
- Na úzkém displeji (≤ 760 px) je panel schovaný čistě v CSS a ukazuje ho tlačítko „☰ Panel“ (třída `panel-ukazany`).
- Do katalogu `apps.js` ani `sw.js` se stránka zatím nepřidala (podle plánu v etapě 12, přesměrování tinkercad po etapě 4).

**14. 10. 2026 – etapa 2 hotová.** `jadro/{sit,tvary,model}.js`, `stav.js`, `telesa.js`, `vyber.js`, `ui/{knihovna,inspektor,seznam}.js`.
- Tvar = obalový kvádr `rozmer` + `param`; stačí tři obecné generátory. Rotační profil `{s, d, z}` (škála elipsy
  a odsazení v mm) dává i eliptickou trubku se stálou stěnou a eliptický torus. Kružnice mají počet segmentů
  dělitelný 4 a na osách přesné ±1, takže obálka sítě přesně sedí na rozměr.
- Zaoblený kvádr je vzorkovaný po stěnách velkého kvádru s tan rozestupem (rovnoměrné úhly normál) a promítnutý
  na Minkowského součet. Shodné okrajové body mají stejný výpočet, takže se svaří přesně.
- Past: eliptický torus s trubicí přes celý otvor stáhl vnitřní kruh na kratší ose do bodu a síť nebyla
  vodotěsná. Šířka trubice je proto omezená na 45 % kratší poloosy.
- Past: `THREE.ShapeUtils.triangulateShape` nezaručuje orientaci trojúhelníků. Víčka se srovnávají podle znaménka plochy.
- Test sítí: 172 vzorků (výchozí, extrémní poměry 0,5 × 100 × 3, náhodné rozměry a parametry se semínkem)
  jsou vodotěsné, bez degenerací a s obálkou na rozměr. Objemy sedí na vzorce (přesně u hranatých a mnohoúhelníků,
  do 0,5 % u koule, polokoule, toru, kapsle a zaobleného kvádru).
- Díra se zatím jen zobrazuje (poloprůhledně šedě). Odečítání přijde v etapě 4.
- Tažení levým tlačítkem začaté na tělese se zatím ignoruje, je vyhrazené pro posun v etapě 3.

**14. 10. 2026 – etapa 3 hotová.** `jadro/{historie,transformace}.js`, `uchyty.js`, `ui/prikazy.js`, úpravy `stav.js`, `vyber.js`, `deska.js`.
- **Úchyty jsou SVG nad plátnem.** Každý snímek se promítnou a chytají se jako DOM prvky. Past: prvek, na kterém začalo
  tažení, se při dalším snímku překreslí a zachycení ukazatele se ztratí. Tažení se proto sleduje posluchači na `document`.
- **Úchyty:** rohy a středy hran spodní podstavy (šířka a hloubka, protější strana stojí), vrchol (výška, spodek stojí),
  šipka zvednutí podél normály roviny, tři oblouky otáčení (krok 15°, Shift 1°, úhloměr s výsečí). Svislé oblouky si
  vybírají stranu na obrazovce (X doprava, Y doleva), jinak se nahoře křížily. Středy hran se schovají na hraně
  kratší než 36 px, jinak malé těleso nešlo chytit (úchyty ho celé zakryly).
- **Změna velikosti** se počítá v tuhém lokálním rámci uzlu (`tuhaMaticeUzlu`), takže funguje i u natočených těles.
- **Zrcadlení:** S·R·Z(m) = (S·R·L_b)·Z(m ⊕ b), kde b je lokální osa nejbližší ose zrcadlení. Nenatočené těleso nezmění
  rotaci, three.js otočí orientaci stěn podle záporného determinantu.
- **Obálka a spodek počítají se skutečnými vrcholy sítě** (`M.vrcholyUzlu` s mezipamětí), ne s rohy obalového
  kvádru. Jinak natočený klín „položený plochou“ visel nad deskou.
- **Historie:** tažení = jeden krok (`zacniUpravu` → dočasné změny → `dokonciUpravu`), Esc vrátí stav před tažením,
  šipky do 1,5 s splývají. Ctrl+D jako v Tinkercadu: po posunu nebo otočení kopie další Ctrl+D zopakuje tuhou
  transformaci (pole). Kopie s automatickým názvem dostanou další číslo.
- **Pracovní rovina** (W, klik na stěnu): mřížka v barvě akcentu (stejný shader, lokální souřadnice `meritko`, záporný
  polygon offset, aby ležela nad stěnou). Počátek se v rovině stěny přichytí na krok. Knihovna pokládá tvary na rovinu
  natočené podle ní, posun a šipky jedou v jejích osách, D pokládá podél její normály.
- **Past v testech:** headless Chromium bere české rozložení klávesnice, takže WebDriverova klávesa „z“ dá `e.key = 'y'`
  (text v poli je přitom „z“). `Prohlizec.klavesy` rozložení jednou zjistí z `keydown` a Z/Y prohodí. Aplikace čte `e.key`,
  takže uživatelům funguje Ctrl+Z na každém rozložení.
- **Omezení:** úchyty velikosti jen u jednoho tělesa (víc těles: zvednutí a otáčení kolem společného středu).

**14. 10. 2026 – etapa 4 hotová.** `obsah/lib/manifold/` (manifold-3d 3.5.3, Apache-2.0, 75 kB JS + 540 kB WASM, beze změn),
`jadro/booleany.js`, `worker.js`, `vypocty.js`, skupiny v `model.js`, `transformace.js` (`seskupUzly`, `rozdelSkupiny`), `telesa.js`.
- **Skupina** = uzel `druh:'skupina'` s dětmi v lokálních souřadnicích, `zaklad` = obálka plných dětí (střed v 0), `operace`,
  `barevne`. Matice skupiny nese měřítko `rozmer/zaklad`, takže zvětšení i posun skupiny boolean nepřepočítávají
  (klíč `M.klicBooleanu` je hash podstromu bez id, názvů a zámků; barvy dětí jen u barevné skupiny).
- **Výsledek:** sjednocení (nebo průnik) plných dětí − sjednocení děr; skupina samých děr je díra a v nadřazené skupině
  se odečte. Nebarevná vnořená skupina vystupuje jednou barvou (`asOriginal`). Stěny vyříznuté dírou dostanou barvu
  plné části, v jejíž obálce leží (jinak měly barvu díry).
- **Rozdělení** rozloží matici skupina · dítě na polohu, rotaci, zrcadlo a rozměr (`rozmer` = základ dítěte × |měřítko|).
  Přesné, pokud zkosení nevzniká (měřítko skupiny podél os dítěte). Jinak jde o pravoúhlé přiblížení.
- **Zobrazení:** dokud worker nevrátí nový výsledek, zůstává vidět předchozí geometrie (`zobrazenyKlic`), takže nic nebliká.
  Rámeček výběru a obálka na obrazovce dělí měřítkem skupiny.
- **Past:** `import()` v klasickém skriptu se řeší vůči URL souboru skriptu (`obsah/modelar/`), `new Worker()` vůči stránce.
- **Obálka skupiny** pro spodek, D a zarovnání se počítá z vrcholů plných dětí. Kde díra ořízne okraj, je obálka o kus větší.
- **Přesměrování:** `obsah/tinkercad.html` je teď jen přesměrování na `modelar.html`. Katalog `apps.js` ukazuje na Modelář
  („🧊 Modelář 3D“), `sw.js` v332. Lišta se pod 1450 px vejde na řádek (tlačítka pohledů schová, umí je kostka),
  pod 1150 px zmizí popisky.

**14. 10. 2026 – oprava po hlášení uživatele: po seskupení byl vidět jen drátový obrys.** Stránka otevřená ze souboru
(`file://`) nepustí worker, `import()` ES modulu ani stažení `.wasm`. Výpočet selhal a zůstala prázdná geometrie (jen rámeček
výběru). Testy běžely přes server, proto chybu neviděly.
- `obsah/lib/manifold/prevod_klasicky.py` vyrobí `manifold.klasicky.js` (stejný kód, `export default` → `globalThis.ManifoldModule`,
  `import.meta.url` → `globalThis.MANIFOLD_URL`) a `manifold.wasm.js` (WASM v base64, 720 kB, načte se jen na `file://`).
  Worker načítá knihovnu přes `importScripts`, záloha v hlavním vlákně přes `<script>`. Past: knihovna i s `wasmBinary` skládá
  URL k `.wasm` ze své adresy, takže `MANIFOLD_URL` musí být platná URL.
- Skupina hned ukazuje náhled z plných dílů (`M.nahradniSitSkupiny`, díry neodečtené). Když výpočet selže, náhled zůstane a
  stavový řádek ukáže „⚠ Skupinu nejde spočítat…“ (na file:// s radou otevřít přes server).

**14. 10. 2026 – etapa 5 hotová.** `jadro/soubory/{zip,stl,obj,trojmf,projekt,export}.js`, `ulozeni.js`, `ui/{soubory,projekty}.js`, druh `sit`.
- **Importovaný model** = uzel `druh:'sit'` se `zdroj` (id geometrie v `M.zdroje`) a `zaklad`. Měřítko je jako u skupiny, geometrie
  není v dokumentu (levná historie a ukládání). Klíč zdroje je 106bitový hash bajtů (2× cyrb53), ne SHA-256 z plánu: je
  synchronní (`crypto.subtle` je asynchronní) a na deduplikaci a kontrolu poškození stačí. Worker dostane každý zdroj jen
  jednou (`poslaneZdroje`).
- **Soubor `.modelar`:** gzip JSON přes CompressionStream (bez něj čistý JSON, ten jde také otevřít). Při otevření se ověří formát,
  verze, normalizace uzlů, duplicitní id, chybějící zdroje a jejich kontrolní klíč. Až potom se cokoli změní. Otevřený soubor je
  nový projekt.
- **Export:** viditelná plná tělesa (volné díry ani skrytá ne), zrcadlené s otočenými stěnami (kladný objem), skupiny jako
  indexovaná síť z workeru (`typ:'sit'`). Volba „sloučit“ = dočasná barevná skupina ze všech těles, takže v 3MF zůstanou barvy.
- **Ukládání:** projekt se uloží 1,2 s po změně, při `pagehide` a `beforeunload` a hned na Ctrl+S. Náhled se kreslí do WebGLRenderTarget
  (bez desky, rámečků a pozadí), kamerou „Domů“ na obálku těles. Bez IndexedDB aplikace jede dál a hlásí „⚠ neukládá se“.
- **Start je asynchronní** (otevření posledního projektu), takže `MDL.pripraveno` čeká v testech, aby přidané těleso nepřepsal.
- **Import** se položí na volné místo u středu pohledu (posun doprava), vzájemná poloha objektů z jednoho souboru zůstane.
  Neuzavřená síť se zobrazí s varováním (ve skupině s dírou nemusí jít spočítat).
- **Pasti v testech:**
  - Nástroj Write převedl `\ue009` v Python testu na skutečný znak. Klávesy WebDriveru proto píšu jako `chr(0xE009)`.
  - Detekce rozložení klávesnice v `Prohlizec.klavesy` brala fokus pomocnému poli. Teď vrací fokus i výběr.
  - Náhled projektu nesmí volat `M.prekresli()`, jinak se při každém uložení zbytečně překreslí plátno (test „stojící scéna“).
- Lišta: popisky nástrojů pod 1600 px schované (ikony s title), aby se vešla na řádek.

**14. 10. 2026 – etapa 6 hotová.** `jadro/skica.js`, `jadro/soubory/svg.js`, `ui/skica.js`, loft v `jadro/tvary.js`, druh `skica` v modelu.
- **Skica** = uzel `druh:'skica'` s `param` (tvary + parametry tělesa), `stred` a `zaklad` (obálka tělesa v souřadnicích skici) a
  volitelným `podklad`. Měřítko je jako u skupiny. Těleso počítá worker přes manifold `CrossSection`
  (`extrude(h, dělení, zkroucení, [k, k])`, zkosení vršku maticí, `revolve(seg, úhel)`), synchronně se počítají jen body vrstev pro
  obálku (úchyty, spodek, zarovnání). `M.upravSkicu` zachová měřítko i polohu počátku skici ve světě.
- **Past:** zkroucené vytažení obdélníku (4 vrcholy) mělo o 3 % větší objem. Mezi pootočenými vrstvami vznikaly silně zborcené
  stěny a triangulace soustavně přidávala objem. Při zkroucení se proto obrysy zhustí (úsek ≤ úhlopříčka / 40) a vrstvy jsou po 2°.
- **Loft:** profily vzorkované paprsky ze středu (oba mají bod pro každý úhel), dutý se stálou kolmou tloušťkou, plynulý =
  smoothstep. Zkroucený loft se po vygenerování napasuje do kvádru `rozmer` (fuzz to vyžaduje), takže tloušťka stěny pak
  není úplně přesná.
- **Inspektor** umí parametry typu volba (`volby`, select) a přepínač (`prepinac`). U skici ukazuje jen parametry zvoleného režimu.
- **Editor skici** je `<dialog>` přes celou plochu.
  - Past: SVG plátno nebere fokus, takže klávesy se poslouchají na `document`, dokud je editor otevřený.
  - Past: nový kruh se zahazoval jako „malý“, protože kontrola četla `r` místo `rx`.
  - Historie editoru si pamatuje výběr před změnou i po ní (Zpět po smazání tvar zase vybere).
  - Delete s vybraným bodem čáry smaže jen bod; čára musí mít aspoň 3 body.
- **Text** se převede na obrysy (`FONTY.opentype`, funguje i z file:// přes base64 kopie fontů), ve skice je uložený i text
  a písmo pro úpravu. V seznamu písem jsou jen latinková.
- **SVG:** vlastní čtení XML (třídy z `<style>` se nečtou, výchozí výplň je černá). Výsledek je tvar `polygony`, vycentrovaný.
- **Past v testech:** detekce rozložení klávesnice musí chytat `keydown` na `document`, protože při otevřeném modálním okně je
  pomocné pole neaktivní (inert) a detekce si jinak zapamatovala „neprohazovat“.

**14. 10. 2026 – etapa 7 hotová.** `jadro/dily.js`, `ui/dily.js`, díly v modelu, knihovně (sekce Díly), inspektoru (textový parametr).
- **Díly mají skutečné rozměry z parametrů.** Fungují jako skica: `param` + `stred` + `zaklad` z analytické obálky (`obalka(p)`),
  `rozmer` škáluje. `M.upravPrirozeny` (dříve `upravSkicu`) je společná pro skici i díly a zachová měřítko a počátek.
- **Šroubovice:** příčný řez (poloměr podle lichoběžníkového profilu závitu v závislosti na úhlu) vytažený se zkroucením 360° na
  stoupání je přesná šroubová plocha. Stejně se dělá pružina (řez šroubovou trubkou ≈ ohnutá elipsa) a šikmé a šípové ozubení.
  Vnitřní závit = stejný profil posunutý o vůli. Šroub M8 s vůlí projde maticí i dírou se závitem (ověřeno průnikem přes fáze).
- **Ozubení:** evolventa, hlava omezená na zašpičatění zubu, vnitřní kolo = válec minus „kolo“ s prohozenou hlavou a patou.
  Ověřeno, že dvojice 20:13 se při otáčení neprotíná a přisunutá o 0,6 mm ano.
- **Pasti:**
  - Dřík šroubu jen dotýkající se hlavy plochou dal po sjednocení dvě oddělená tělesa. Dřík se proto zasune 0,5 mm do hlavy.
  - Analytická obálka šestihranu: v Y je rozměr přes plošky, ne přes rohy.
  - Kolo s málo zuby nemá zub ve všech směrech, takže obálka „kružnice hlavy“ ho jen obsahuje.
  - Pant: křídla musí mít mezi sebou mezeru (vůli), jinak se dotýkají a nejde o dvě tělesa.
  - Inspektor: přestavba při fokusu v číselném poli vyvolá `change` odstraněného pole během stavby nového. Handler odpojeného
    pole se proto ignoruje a `obnov` přeskočí pole bez prvku.
- **Štítek:** obrysy písma počítá hlavní vlákno (worker fonty nemá). Hlídá to `ui/dily.js` podle `param.konturyPro` a zápis
  nahradí poslední krok historie (`M.zmenDokument(..., { nahraditPosledni: true })`). Volba „Vyrobit“ (celý / jen podklad / jen
  písmo) umožní tisk ve dvou barvách. Štítek s ikonou zatím není.
- Testovací obal ukládá u chyb JS i zásobník volání (`__chyby`).

**14. 10. 2026 – etapa 8 hotová.** `jadro/upravy.js`, `ui/upravy.js`, skrytý díl `obalSvg` v `jadro/dily.js`, `M.telesa.svetovaSit(id)`.
- **Pole** vytváří samostatné kopie (číslované). Okno ukazuje živý náhled jako „úpravu“ (`zacniUpravu` → dočasné změny), takže Zrušit
  nic nezapíše a celé pole je jeden krok zpět. Volitelně se výsledek seskupí. Okno si pamatuje minulé hodnoty.
- **Rozdělení rovinou** = dvě skupiny „kopie tělesa − obří kvádr (díra) na druhé straně roviny“. Výsledek zůstává parametrický a
  obálka skupiny je obálka tělesa (díry ji nezvětšují). Volitelně se části odsunou od sebe. V okně se ukazuje oranžová rovina.
- **Vzor děr:** klik na plochu (režim `vzorDer`) → `oblastPlochy` sjednotí koplanární trojúhelníky (clipper, jen souvislá část pod
  kliknutím, s otvory) → `stredyDer` (mřížka nebo šachovnice, okraj přes offset clipperu) → skica s dírami vytažená do tělesa
  (osa z skici = −normála) a seskupená s ním. Hloubka 0 = skrz (z vrcholů tělesa).
- **Obalení SVG:** díl `obalSvg` = obrysy vytažené radiálně, `refineToLength` a `warp` (x → úhel x/R, z → poloměr), takže délka podél
  obvodu sedí. Skupina s válcem: vystouplý jako barevná skupina, vyrytý jako díra. Vzor delší než obvod se odmítne.
- **Past (UI):** oznámení ze sdíleného `dialog.js` (nahoře uprostřed) zakrývala lištu, takže klik na nabídku padl na oznámení. V Modeláři
  je `.dlg-toasty` posunuté pod lištu. Okna s náhledem ve scéně (Pole, Rozdělit) stojí vpravo nad panelem (`dialog.okno.vedle`).
- Skrytý díl (`skryty: true`) se v knihovně neukazuje.

**14. 10. 2026 – etapa 9 hotová.** `jadro/occt.js`, `worker_occt.js`, OCCT ve `vypocty.js`, `ui/occt.js`, `lib/occt/` (occt-wasm 5.4.0).
- **Knihovna:** occt-wasm 5.4.0 (obal MIT/Apache, WASM s OpenCascade LGPL-2.1, viz `lib/occt/LICENCE.txt`). Stejně jako u manifoldu
  je převedená na klasický skript (`prevod_klasicky.py`) a WASM je i jako gzip+base64 (9,4 MB) pro otevření z file://, kde se rozbalí
  přes `DecompressionStream`. Načte se až při první přesné úpravě nebo STEP (stavový řádek „načítám přesné jádro (22 MB)“).
- **Úprava je vlastnost skupiny** (`occt: {operace, hodnota, hrany | plochy}`), jednotlivé těleso se obalí skupinou s jedním dítětem
  (`M.obalUpravou`, id zůstává). Hrany a plochy se ukládají jako geometrický popis v přirozených souřadnicích skupiny (střed + délka,
  střed + normála) a po přepočtu se dohledají nejbližší; posun, otočení i změna velikosti skupiny je proto nerozbijí.
- **Tok výpočtu:** síť skupiny s úpravou spočítá OCCT a uloží do `M.zdroje` pod `klicOcct` (odvozený zdroj, neukládá se do projektu
  a po otevření se spočítá znovu); manifold ji pak bere jako hotovou síť, takže zaoblené těleso jde dál seskupovat a vrtat.
  Skici a díly, které OCCT samo nepostaví, dodá manifold jako síť (`sitePro`) a převedou se na rovinné plochy.
- **Použít** nejdřív úpravu spočítá a do dokumentu zapíše jen úspěšnou. Chyba (třeba příliš velký poloměr) zůstane v panelu česky.
- **STEP:** export uzlů ve světové poloze (válec jako válcová plocha), díly se závity a velké sítě jdou jako trojúhelníky. Import
  uloží k síti i text STEP (`step`, `stredStep` – i v IndexedDB a `.modelar`), takže úpravy importovaného modelu jsou přesné.
- **Pasti:**
  - Typy podtvarů v embind API jsou malými písmeny (`'edge'`, `'face'`). `surfaceNormal` už počítá s orientací plochy, normála se
    nesmí podruhé otáčet (jinak se horní a spodní plocha kvádru nerozliší).
  - `shell` bez otevřené plochy vrací jen vnitřní stěnu → uzavřená dutina = těleso − `offset(−t)`.
  - `importStlBinary` odmítne celou síť kvůli jedinému zdegenerovanému trojúhelníku (po zaokrouhlení na float32) – před převodem se
    vyhazují trojúhelníky s nulovou plochou nebo hranou pod 0,1 µm.
  - Polokoule = průnik koule a kvádru až po měřítku; eliptický torus OCCT nemá, jde přes rovinné plochy sítě.
  - Ve workeru i v hlavním vlákně musí být načtené `jadro/occt.js` (z file:// se počítá na stránce).

**14. 10. 2026 – etapa 10 hotová.** `jadro/vykres.js`, `jadro/dilna.js`, `ui/dilna.js`, nabídka 📐 Dílna, sekce Moje tvary, IndexedDB verze 2.
- **Výkres:** promítání v 1. kvadrantu (evropské): nárys, pod ním půdorys, vpravo bokorys zleva, vpravo dole izometrie bez
  měřítka, razítko. Kreslí se ostré hrany (úhel ploch > 25°) a obrysy (hrana mezi plochou k divákovi a odvrácenou), viditelnost se
  zkouší po kouscích hrany proti trojúhelníkům v mřížce. Skryté čáry se odečtou tam, kde leží na viditelné (zadní hrana kvádru za
  přední) nebo na už nakreslené skryté – bez toho byl výkres plný čárkovaných dvojic. U závitů (desítky tisíc skrytých úseků) se
  skryté čáry v pohledu vynechají a okno to napíše. Měřítko z řady 10 : 1 … 1 : 1000, počítá se ve workeru (šroub M8 ~4 s).
- **PDF:** jsPDF se načte až při exportu; písmo Liberation Sans Bold přes `FONTY.data('libsans')` (z file:// ze záložního skriptu),
  takže čeština funguje i offline. Otočený text: jsPDF otáčí kolem začátku a proti směru hodin – začátek se posouvá ručně.
- **Měření:** přichycení se počítá v pixelech obrazovky (12 px) k vrcholům a středům hran trojúhelníků pod kurzorem i v jeho okolí
  (klik přesně na roh tělesa paprsek často mine a bod by spadl na desku) a k referenčním bodům.
- **Poznámky** jsou součástí dokumentu (`dok.poznamky`), takže fungují Zpět, ukládání i soubor projektu. Prázdný text = referenční bod.
- **Řez pohledem:** `localClippingEnabled`, rovina na materiálech těles (i nově vzniklých), oboustranné plochy a vnitřek přes
  `gl_FrontFacing` oranžově. Model se nemění.
- **Opravené staré chyby:** Ctrl+D (a vložení, pole) skupiny, skici, dílu či importu padalo na `M.TVARY[druh]` a kopie skupiny měla
  stejná id dětí (projekt by pak nešel otevřít) → `M.noveIdHluboko`.
- **Pasti:** třída `.paleta` už patřila barvám v inspektoru (paleta příkazů byla pořád vidět) → `.paleta-prikazu`. SVG vrstvy nad
  plátnem chytají myš – v režimech měření/poznámky musí mít značky `pointer-events: none`, jinak klik nedojde k plátnu (vyber.js
  poslouchá na canvasu).

**14. 10. 2026 – etapa 11 hotová.** Barvy v exportech a importech (`booleany.js`, `soubory/{obj,trojmf,export,projekt}.js`, `telesa.js`, inspektor, okno Export).
- **Každá barva zvlášť** (volba v okně Export): pro vícebarevný tisk objekt pro každou barvu (3MF, OBJ), u STL ZIP s jedním STL na barvu
  („Projekt - cervena.stl“). Tělesa stejné barvy se spojí. Barevná skupina se rozdělí na **uzavřená** tělesa: barva = její plné části ∩
  výsledek skupiny (díry, průnik) − barvy dřív v pořadí dětí (`vysledekPodleBarev`). Rozdělit hotovou síť podle barev trojúhelníků
  by dalo otevřené slupky, se kterými slicer neumí.
- **OBJ** se exportuje v ZIPu spolu s `.mtl` (materiál `barva_rrggbb`, Kd 0–1, `usemtl` i po trojúhelnících barevné skupiny).
  Import: OBJ vybraný (nebo přetažený) spolu s `.mtl`, ZIP s OBJ + MTL, barvy vrcholů `v x y z r g b` (i 0–255, zaokrouhlené
  na 16 úrovní). Názvy objektů v OBJ smí mít mezery.
- **3MF import** čte barvy po trojúhelnících (`pid`/`p1`) z `basematerials` i `colorgroup` (rozšíření Materials); barva objektu =
  převládající barva.
- **Barvy ze souboru** u importovaného modelu: zdroj si pamatuje `barvyTroj` + `paleta` (IndexedDB, `.modelar`), scéna je kreslí
  barvami po vrcholech, inspektor má „Barvy ze souboru (N)“ (vypnutí = `jednobarevne` v uzlu, mění klíč geometrie). Export je nese
  dál (3MF po trojúhelnících, OBJ usemtl). Ve skupině a při „každá barva zvlášť“ je model jednou barvou (manifold barvy trojúhelníků
  importu nenese). Poškozené barvy v souboru projektu se zahodí bez chyby.
- **Pasti:** `svarSit` vyhazuje zdegenerované trojúhelníky – barvy po trojúhelnících se musí přeindexovat (`zachovane`). Hláška exportu
  potřebuje české tvary čísel (1 barva, 2–4 barvy, 5 barev).

**14. 10. 2026 – etapa 12 hotová, Modelář 3D dokončen (všech 12 etap).** `ui/napoveda.js`, `modelar-licence.html`, dotyk ve `scena.js`/`vyber.js`, sada MODELAR v `sw.js`.
- **Dotyk** (Pointer Events): klepnutí vybere, tažení tělesa ho posune, tažení po prázdnu otáčí pohledem (místo výběru obdélníkem),
  dva prsty přibližují (poměr vzdáleností) a posouvají (střed prstů). Druhý prst zruší rozdělaný tah prvním prstem (posun se vrátí,
  do historie nic) a nový tah nezačne, dokud se nezvednou všechny prsty (`M.gesto`). Na hrubém ukazateli jsou úchyty 1,8× větší.
- **Offline:** stránka registruje `../sw.js` a řekne si o docachování sady MODELAR (56 souborů: stránka, skripty, three, opentype,
  clipper, jsPDF, písmo, manifold + WASM, licence). Přesné jádro OCCT (22 MB) v sadě není – uloží se samo při prvním použití.
  Test ověří načtení stránky i výpočet skupiny bez sítě (`chromium/network_conditions`).
- **Průvodce** se spustí sám jen při první návštěvě s prázdnou scénou a ne pod WebDriverem (`navigator.webdriver`), jinak by zakryl
  plochu všem testům. Na úzké obrazovce zvýrazní místo schované knihovny tlačítko ☰ Panel; u vysokých prvků stojí bublina vedle.
- **Výkon:** 500 těles – přidání ~100 ms, výběr všech ~40 ms, posun všech ~40 ms, Zpět ~40 ms, seskupení 100 těles ~200 ms. Snímek
  ~230 ms jen v headless (SwiftShader na procesoru); optimalizace (instancing) zatím nebyla potřeba.
- Katalog `apps.js` má nové štítky (3mf, step, závity, výkres); `tinkercad.html` přesměrovává od etapy 4.

**15. 10. 2026 – revize celé aplikace (kolo 1).** Čtyři nezávislé revize (jádro, soubory a výpočty, kód UI, průzkumné testy
v prohlížeči jako uživatel) našly ~50 potvrzených chyb; opravené a pokryté testy `modelar_revize.js` a `modelar_ui_revize.py`.
- **Nejzávažnější:** `M.mm(x, 0)` mazal nuly i z celých čísel (počet zubů 20 → „2“, Enter pak kolo zničil); zaoblení/sražení/
  skořepina selhaly na každé skupině s více částmi (OCCT vrací compound → teď po tělesech); záložní OCCT v hlavním vlákně
  přepisovalo zdroje ořezanými kopiemi (ztráta barev); smazání otevřeného projektu ho hned uložilo zpět; zip/gzip bomby;
  3MF 4^20 komponent; OBJ s mnoha objekty kvadraticky (24 s → 0,3 s); rozdělení rovinou u těles > 2,5 m nedělalo nic a díra
  se rozdělila na obří díry; stejné díly různých barev měly jednu barvu; nemodální panely blokovaly všechny zkratky.
- **Zdroje geometrie jsou neměnné:** klíč = otisk sítě + barvy + STEP (`M.klicZdroje(sit, extra)`); starší soubory mají jen otisk
  (kontrola `id.startsWith`). Odvozené sítě OCCT nad 40 se zapomínají (i ve workerech, zpráva `zapomen`).
- **Workery:** selhání startu (WASM) → hlášení `start` a přepnutí na hlavní vlákno; zdroje se značí jako odeslané až po odeslání.
- **Ukládání:** autosave ukládá potvrzený stav (ne náhled pole), chybějící geometrii doplní (jiná karta ji mohla smazat),
  `onversionchange`, unikátní název projektu při opakovaném otevření souboru.
- **UI:** `[hidden]` vždy skryje; `M.modalniOkno()` (`:modal`) místo `dialog[open]`; boční panely se navzájem zavírají
  (`M.otevriPanel`), leží pod kostkou a vedle knihovny, na telefonu dole; panel zaoblení přežije posun/barvu (zavře se jen při
  změně tvaru s hláškou) a výsledek použije na aktuální stav; dvojklik ve skice vlastní detekcí (zachycení ukazatele bere
  click/dblclick); přichycení měření ignoruje zakryté body; STEP odmítne sítě nad 12 000 trojúhelníků (šroub by měl 343 MB);
  přístupné názvy lišty, aria-expanded a Esc u nabídek, combobox palety; kontrast ve světlém motivu; české tvary čísel (`M.pocet`).
- **Pasti:** test délky historie po Zpět neplatí (větev „znovu“ se ořízne) – měřit `historie.index`. `getComputedTextLength`
  pro šířku textu SVG. Rotační skica: obálka z konvexního obalu profilu otočeného po 7,5° (body tělesa, ne rohy válce).

**15. 10. 2026 – revize, kolo 2.** Kontrola oprav z kola 1 + realistické projekty v prohlížeči (krabička s víčkem, držák se
šrouby, jmenovka, převodovka, pracovní rovina, telefon, světlý motiv). Opraveno:
- **Bezpečnost:** id uzlu ze souboru šlo neošetřené do HTML (XSS) → `M.idOk` (jen `[A-Za-z0-9_-]`, jinak nové id) a `esc` v seznamu.
- **Dotyk:** tažení úchytu prstem nikdy neskončilo (úchyty se při tažení překreslují a implicitně zachycený prvek zmizel;
  `touch-action` uvnitř SVG Chrome nebere → pointercancel). Chycený prvek se teď při překreslení jen skryje a `#plocha` má
  `touch-action: none` (inspektor `pan-y`).
- **Přesné úpravy ve skutečné velikosti:** zvětšená skupina se skořepinou/zaoblením se počítá zvětšená (stěna 2 mm zůstane 2 mm),
  pak zpět do přirozených souřadnic; klíč `klicOcct` obsahuje měřítko. Po nerovnoměrném zvětšení jsou rovné plochy v OCCT
  B-spline – rovinnost se pozná z nulové křivosti. Druhá úprava na těleso s úpravou se přidá jako další vrstva (po dotazu).
- Rotační skica s profilem přes osu (kužel) měla obálku výšky 0,01 (profil se teď ořízne na osu s průsečíky); SVG `<use>`
  sám na sebe (exponenciální) a vnořené svg v % a mm; barevná podskupina a její kopie-díra; ZIP jména v UTF-8 bez příznaku;
  panel zaoblení s otevřeným měřením (pořadí otevírání); zkratky ve skicáři s bočním panelem; hodnota úpravy na 3 desetiny;
  aria-expanded po výběru z nabídky; automatické názvy se závorkou; Esc zavře řez a historii; panel na telefonu dole;
  náhled projektu se uloží znovu, až worker dopočítá; tvar z knihovny na volné místo i na pracovní rovině; název v hlášce.
- Ochrany úložiště po `onversionchange`, pořadí registrace ve workerech, paleta > 65 535 barev, textové STL s dlouhou hlavičkou.

**15. 10. 2026 – revize, kolo 3 (zátěž, klávesnice, telefon, vzhled).**
- **Paměť a výkon:** mezipaměť booleanů omezená i počtem trojúhelníků (6 mil.); pád WebAssembly ve workeru (došla 4 GB
  paměť) → ohlásit „nevešel se do paměti“, worker vyměnit za nový a rozdělané poslat znovu (dřív selhávalo všechno do
  znovunačtení); totéž v hlavním vlákně a u OCCT. Závity a pružiny mají rozpočet ~1,5 mil. trojúhelníků (jemnost se sníží;
  dřív M8 × 100 s 256 segmenty = 5 mil., 7 GB, pád karty). Obrysové hrany se nad 300 tisíc trojúhelníků nestaví (EdgesGeometry
  blokovala 2,7 s), normály přes ploché pole sousedů (CSR) místo Map, kontrola vodotěsnosti jen do 500 tisíc. `M.najdiUzel`
  přes index (WeakMap na pole uzlů) – výběr tisíců těles už není kvadratický. Mezipaměť vrcholů omezená velikostí. Při otevření
  jiného projektu se geometrie, kterou nic nepotřebuje, uvolní (`M.uklidZdroje`, i ve workerech). Náhled projektu nejvýš jednou
  za 20 s (vždy při odchodu) a jednou po dopočítání skupin. Chybějící geometrie dílu po chybě už nehází v `EdgesGeometry`.
- **Klávesnice a čtečky:** šipky posouvají tělesa jen s fokusem na scéně (plátno má tabindex a název), v nabídce chodí po
  položkách (role menu/menuitem, Home/End, zavření při odchodu fokusu); fokus se po zavření okna vrací na tlačítko nabídky
  nebo na scénu; průvodce drží Tab v bublině a vrací fokus; názvy ikonových tlačítek (Zarovnat, projekty, skicář), aria-pressed
  u barev, aria-current v historii, combobox palety, živá oblast pro oznámení (`dialog.js`), stav ukládání už nehlásí každou změnu.
- **Telefon a rozvržení:** tah prstem po knihovně ji posouvá (tvar se táhne vodorovně, `touch-action: pan-y`, kontrola, že
  pod prstem je plocha), malé těleso má méně úchytů (prst ho chytí), lišta v jednom posuvném řádku s ☰/❓ přichycenými vpravo,
  panely nad lištou podpisu, okno Pole bez překryvů, panely jako sloupec (historie bez dvojitého posuvníku), náhled výkresu
  omezený, nepoužité prázdné „Projekt N“ se při odchodu smaže.
- **Čeština:** „Ovinout SVG kolem válce“, „Pant (tisk vcelku)“, tvary čísel u trojúhelníků, velká písmena u voleb, jednotné
  názvy (Měřit … poloměr, Položit na desku / rovinu, Esc).

**15. 10. 2026 – revize, ověření.** Nezávislé ověření znovu spustilo reprodukční skripty všech kol: opravené potvrzeny (dotyk,
paměť workeru, výkon výběru, uvolňování zdrojů, nabídky a fokus, panely, OCCT ve skutečné velikosti, nepřátelské soubory…).
Dořešeno: tah prstem po knihovně (začne jen vodorovně, posun seznamu panel nezavře, pohnutý prst nic nepřidá), další pasti
WebAssembly („function signature mismatch“; worker posílá i jméno chyby RuntimeError), přichycení měření řazené podle obrazovky
s přirážkou za hloubku (paprsek u okraje díry trefí vzdálenou stěnu), druhý prst ruší tažení úchytu, Tab/↓ z tlačítka otevřené
nabídky do ní, přetečení zásobníku u extrémního souboru projektu česky. Vědomě ponecháno: dotykové cíle lišty ~28 px (lišta
by se nevešla), rozvržení Tab (knihovna je v DOM před lištou), měření nad tvarem pod 0,1 mm.

**15. 10. 2026 – přání uživatele.**
- **Pohled zespodu:** deska je při kameře pod deskou průsvitná (alfa 0,35, bez zápisu hloubky) a kreslí se až po tělesech
  (`deska.zespodu()` ve `scena.js` každý snímek) – dřív zakryla tělesa a byly vidět jen otisky těch na desce.
- **Čtyři úchyty i nahoře** (`horni±1±1`): šířka a hloubka tažená v rovině horní stěny, výška a spodek drží, se Shiftem v poměru.
  Čtverečky úchytů se kreslí nad oblouky otáčení (horní roh jinak ležel pod obloukem).
- **Zarovnání jako v Tinkercadu** (`ui/zarovnani.js`, klávesa L / tlačítko ⊞ Zarovnat; nabídka podle os zůstala pod ▾):
  puntíky X (přední hrana), Y (pravá hrana), Z (svisle v rohu) kolem výběru, najetí = náhled (úprava, odjetí ji zruší), klik =
  jeden krok Zpět, režim trvá; klik na vybrané těleso = vztažné (rámeček, nehne se, `M.zarovnejUzly(…, klic)`); Esc / klik mimo
  konec. Puntíky leží kolem celého výběru a na obrazovce mají minimální rozestup.
- **Posun scény Shift + pravé tlačítko** už fungoval – ověřeno testem a uvedeno v nápovědě.

**15. 10. 2026 – druhá várka přání.**
- **Zrcadlení ve scéně** (`ui/zrcadleni.js`, klávesa **M** / tlačítko ⇋ Zrcadlit, nabídka podle os zůstala pod ▾): dvojité šipky
  na obou stranách obálky pro každou osu, najetí = náhled, klik = „Zrcadlit X“, režim trvá, Esc / klik vedle konec.
  **Měření se přesunulo na R** (M je teď zrcadlení jako v Tinkercadu).
- **Šipky otáčení jako v Tinkercadu** (`uchyty.js`): vyplněné zahnuté dvojité šipky, najetí ukáže slabý úhloměr roviny,
  při tahu úhloměr s ryskami po 5°/15°/45° a popisy stupňů; kurzor uvnitř úhloměru = po 15°, vně (za vnějším kroužkem)
  nebo se Shiftem = po 1°. Klik bez tažení otevře pole pro úhel (Enter = otočit).
- **Bod otáčení / pivot** (`ui/pivot.js`, klávesa **P**, Úpravy → Bod otáčení): 27 puntíků (rohy, středy hran a stěn, střed;
  u jednoho tělesa v jeho natočení), klik na stěnu nebo desku také; šipky pak otáčejí kolem něj (značka ⊕), změna výběru ho
  zruší. Panel **Otočit kolem bodu**: osa, úhel, bod X/Y/Z, Otočit i Otočit kopii (opakovaně = kruhová řada). `M.app.pivot`.
- **Tvary – víc parametrů**: odvozená pole v inspektoru (`odvozeny: true`, `cti`/`zapis` – zapisují rozměr i parametry,
  spodek stojí, `normalizujParam` je přeskakuje): torus vnější/vnitřní průměr a průměr průřezu (nový param `vnitrni` %,
  0 = postaru podle výšky; `M.polosirkaTorusu` sdílí síť i OCCT), trubka vnější/vnitřní průměr, válec průměr + zaoblení
  hran (OCCT přesně přes fillet kruhových hran), kužel dolní/horní průměr v mm, jehlan počet stran + horní šířka,
  hranol stěna (dutý, odsazení průnikem polorovin), polokoule stěna (dutá kopule otevřená dole, OCCT přesně).
- **Rozšířené tvary** (`sada: 'rozsirene'`, vlastní sekce knihovny `#knihovnaRozsirene`): hvězda (cípy, vnitřní poloměr,
  zúžení), šipka, kříž, profil L/U/T/I/jekl (stěna mm), výseč (úhel, vnitřní průměr), oblouk trubky (úhel, průřez),
  schody, srdce, vlnovka, brána, rámeček (šířka, zaoblení). Nový `M.vytahni(obrys, díry, výška, zúžení, vějíř|trojúhelníky)`
  – vytažení s dírami; u obrysů s mnoha body na přímce (schody, vlnovka) podstava vějířem / pásem, jinak earcut dává
  ploché trojúhelníky.
- **Pravé tlačítko**: nabídka prohlížeče potlačená na celé ploše (překryvné vrstvy, inspektor mimo textová pole) i po
  otáčení pohledem s puštěním nad panelem; Ctrl + pravé = posun jako Shift (Firefox se Shiftem nabídku vynutí vždy).
- **Zaoblení / sražení / skořepina kliknutím** (`ui/occt.js` přepsán): nastavit velikost a klikat – každý klik hned
  počítá a zapíše (krok historie), klik na upravenou hranu ji vrátí, změna velikosti přepočítá vše, Všechny / Žádná,
  skořepina má značky u všech rovných ploch a tlačítko Uzavřená dutina; Hotovo zavře, Zrušit vše vrátí stav před
  otevřením. Zpět/Znovu při otevřeném panelu srovná výběr hran podle uzlu; změna tvaru hrany načte znovu. Jiná úprava
  na tělese s úpravou = rovnou nová vrstva (bez dotazu). Selhání = chyba v panelu, výběr se vrátí.
- **Skořepina opravena** (`jadro/occt.js`): kruhový kužel a polokoule (výška = poloměr) se staví analyticky (měřítkem
  vznikaly B-spline plochy, na kterých offset padal); shell/offset zkouší spojení oblouky a pak průsečíky, výsledek
  musí mít rozumný objem a projít `isValid`; když shell s otevřenou plochou selže (zaoblený válec), záloha = uzavřená
  dutina + průraz vnitřkem posunutým přes otevřenou plochu.


**15. 10. 2026 – sražení u sloučených těles a kombinace úprav.**
- Skupina (boolean) nechávala rozdělené plochy a nadbytečné hrany na styku těles → po booleanech `unifySameDomain`
  (jen skupina s víc dětmi). Švy válců/koulí (hrana mezi plochou a jí samou, `adjacentFaces` + `isSame`) se jako hrany
  nenabízejí – zaoblit ani srazit nejdou. Uložená hrana, která se po sloučení ploch nenajde, se vynechá (chyba jen když
  nezbyde žádná).
- OCCT neumí srazit hranu, která končí v zaoblení (a podobné kombinace): záloha `hranyBooleanem` – rovná hrana mezi
  dvěma rovinami se ořízne klínem (sražení) nebo klínem bez tečného válce (zaoblení), vypouklá odečtením, vydutá
  přidáním; konce klínu přesahují jen tam, kde za hranou těleso není (`containsPoint`).
- Testy: `modelar_occt.js` +8 (každá hrana sloučených těles, krychle zaoblení→sražení i obráceně, skořepiny),
  `modelar_ui_prani2.py` 105 kontrol (sražení kliknutím na sloučeném kvádru s válcem, kombinace na krychli).
- Oprava zálohy (stejný den): zaoblení vnitřní horní hrany skořepiny poloměrem větším než stěna – OCCT správně selže,
  ale záloha klínem ukousla i vnější stěnu a v rozích prořízla sousední stěny (sloupky v rozích). Záloha teď ověří, že
  obě plochy jsou od hrany široké aspoň t po celé délce (`containsPoint` kousek pod plochou), jinak česká chyba
  „poloměr … je větší, než je plocha u vybrané hrany široká“; přesah konců klínu se zkouší vzorky po celé délce.
- Druhá oprava (stejný den, nahlášené „překrývání v rozích“ a rozbitý okraj krabičky):
  - OCCT vrací bez chyby (isValid = true) rozbité zaoblení/sražení, když se úpravy na tenké stěně překrývají (objem
    po zaoblení vnějších i vnitřních hran okraje *vzrostl*, síť děravá → manifold „Not manifold“). Teď se nativní výsledek
    kontroluje: vypouklé hrany musí objem zmenšit, vyduté zvětšit (`vypuklost` – bod kousek ven podél součtu normál),
    jedno těleso; `sitUzlu` u úpravy odmítne nevodotěsnou síť. Pak nastoupí záloha.
  - Záloha: směr „do plochy“ podle bodů těsně pod a nad plochou (`containsPoint`) – těžiště u plochy s otvorem (okraj
    krabičky) leží v otvoru a vnitřní hrana se brala jako vydutá (přidával se materiál).
  - Přesah klínu za konec hrany: pokračuje, dokud je průřez klínu v tělese jen zčásti (projde zaoblením sousední hrany
    až ven – žádná „stříška“), u plného průřezu končí; kde navazuje jiná upravovaná hrana a těleso pokračuje (vnitřní roh
    okraje), klín se prodlouží a seřízne rovinou pokosu – bez zubů v rozích.
  - Testy: `modelar_occt.js` 42 (+ okraj krabičky 8 hran zaoblení 1,5 i sražení 1: objem klesne, vodotěsné).
- Vnitřní (vyduté) hrany, třeba uvnitř skořepiny (stejný den):
  - Kontrola `vypuklost` brala vydutou hranu jako vypouklou (bod podél součtu normál je mimo těleso u obou) → přesné
    zaoblení vnitřních hran se zahodilo. Teď bod ve směru n1 − n2: u vypouklé mimo těleso, u vyduté v materiálu.
  - Nenabízejí se hladké přechody (plochy na hraně tečné, `uvFromPoint` + `surfaceNormal`) – vnitřek skořepiny
    zaobleného kvádru je oblý a OCCT ho zaoblit neumí („no suitable edges“).
  - Kontrola nativního výsledku i vodotěsnou sítí (z kopie tělesa – triangulace v tělese rozbila pozdější nerovnoměrné
    měřítko zvětšené skupiny: „shape has no geometry“).
  - Smíšený výběr (vnitřní dno a rohy + hrany okraje), který OCCT naráz neumí: po skupinách vyduté → vypouklé
    (a obráceně, hrany druhé skupiny se v novém tělese dohledají po přímce), pak vyduté přesně + vypouklé zálohou,
    až nakonec celé zálohou.
  - Testy `modelar_occt.js` 47 (dno skořepiny přidá (1 − π/4)·r²·délka, rohy, smíšený výběr, zaoblený kvádr 8 hran).

**15. 10. 2026 – témata plochy a druhá celková revize (5 revizorů: jádro, OCCT a soubory, scéna, panely, průzkum v prohlížeči).**
- **Témata plochy** (`deska.js` `M.TEMATA_DESKY`, panel Pracovní deska → dlaždice s náhledem, `M.zmenTemaDesky`, pamatuje
  `localStorage modelar_nastaveni.tema`): Podle webu, Grafit, Světlá, Modrotisk, Modrobílá, Rýsovací papír, Řezací podložka,
  Půlnoc, Pískovec, Soumrak; pozadí s přechodem (CanvasTexture), `M.svetlaScena()` ladí kostku, díry a odraz země podle tématu.
- **Přesné jádro**: podobnost (stejné měřítko) přes `transform`, zrcadlení přes `mirror` (roviny zůstanou rovinami);
  záložní postupy přijímají rovné B-spline plochy/hrany (`jeRovina`, `jeUsecka`); hrany si ukládají bod uprostřed
  parametru a konce rovné hrany (`bod`, `konce`, i v `normalizujOcct`) a hledají se po přímce / bodu, po zvětšení
  skupiny s vnořenou úpravou volněji; nová data s chybějící hranou = chyba (ne tiché vynechání); vnořené úpravy
  počítané ve skutečné velikosti (`brep(u, site, vnejsi)`); objem ze sítě, když se OCCT od sítě liší > 0,5 %;
  plocha skořepiny jen ve stejné rovině; body vymyšlené clipperem zpět do roviny (ne [0,0,0]); jehlicovité
  trojúhelníky vynechané; kužel s horním průměrem 100 % = válec; pád OCCT v hlavním vlákně se zotaví.
- **Import/soubory**: síť naruby se obrátí; OBJ dělí objekty jen podle `o` (`g` jen bez `o`); vícebarevný import
  drží barvy v barevné skupině (běhy s vlastními originalID); formát projektu verze 2; projekty z IndexedDB se ověří.
- **Jádro**: závit s velkým stoupáním (hloubka ≤ 80 % poloměru, rozpočet otáček), obálka štítku s očkem, rozpočet
  trojúhelníků vroubku a zkroucené skici, obálka průnikové skupiny, stěna loftu po napasování, sdílení nezměněných
  dětí při úpravě skupiny (WeakSet), LRU mezipaměť vrcholů, spirála ze středu, kamera „Domů“ u velkých scén, vzor
  děr nejvýš 5000 (dřív zamrzlo), eliptický torus – vnitřní průměr a průřez.
- **Scéna a ovládání**: Esc s prioritou (tah → nabídka → modální okno → boční panel → režim, ne v poli), příkazy
  z klávesnice během tažení/náhledu (blokované / náhled se zruší), po kliku na šipku zrcadlení / puntík zarovnání
  žádný nový náhled pod kurzorem, panel přesných úprav: „počítám“ se nezasekne, souběh načítání, Zpět během výpočtu,
  jiný výběr panel zavře; tah v režimu klikání není klik; bod otáčení jde s tělesem a úhloměr kolem něj sahá
  k tělesu; způsob úhlu otáčení pevný pro celý tah; obdélníkový výběr bez rohů za kamerou; pravé/prostřední tlačítko
  otáčí i nad úchyty; rozepsané pole inspektoru se potvrdí před akcí ve scéně; nový projekt bez režimu a pivotu.
- **Panely**: skicář Esc přes keydown (Chrome by zavřel bez dotazu), Zpět během tažení ne, bod cesty se hne až po 4 px;
  přepnutí projektu po neúspěšném uložení se zeptá; chyba ukládání vidět i na úzké obrazovce (a jednou hlášením);
  řez pohledem překreslí nová tělesa a náhled projektu bez řezu; posuvník historie široký; nápověda nešedá;
  nabídky se vejdou do výšky okna; paleta Ctrl+K i se soubory a nápovědou; „Zrušit seskupení“ místo „Rozdělit“;
  výkres jen z kreslitelného výběru, písmo PDF se po chybě zkusí znovu; měření zůstane při Poznámce (referenční bod);
  meze polí (pole, rozdělení, ovinutí); číselná klávesnice na telefonu.
- Z průzkumu v prohlížeči: svislé šipky otáčení se umisťují výpočtem (nejdelší na obrazovce, mimo obdélník tělesa
  a druhou šipku, minimum ~70 px) a mají tmavý obrys (červená na červeném tělese); boční panel na šířce 761–1250 px
  vlevo místo inspektoru; Enter v okně potvrdí hlavní tlačítko (`ui.js`), okno Pole s fokusem; Enter na dlaždici
  knihovny přesune fokus na scénu (Shift+Enter ne); názvy úprav „(skořepina, zaoblení)“ bez shody v rodě a bez
  hromadění závorek; poznámka kliknutá na těleso se k němu přichytí (`uzel`, `lokal`, `M.bodPoznamky`); popisy
  úhloměru vně kruhu; tlačítka panelu úprav vypnutá, než jádro načte hrany.

- Přání (15. 10., večer): zrcadlení má jen 3 šipky (jedna na osu, na straně ke kameře); skořepina jen u plných těles
  (`M.lzeSkorepinu`, příznak `skorepina` v katalogu tvarů – ne trubka, torus, oblouk trubky, profil, rámeček, tvary
  se stěnou; skupiny, skici a importy ano, díly ne; příkaz i volba v panelu vypnuté); zaoblení okraje skořepiny a
  pak svislého vnitřního rohu: pokos podle průsečíku přímek (i když se hrany po zaoblení rohu nedotýkají) a pořadí
  „vypouklé zálohou, pak vyduté přesně“ – bez zubu v rohu, stejně jako najednou (test v `modelar_ui_revize2.py`, 38).
- **Nová horní lišta a nabídka Tvary (15. 10., večer)**: knihovna tvarů z bočního panelu přesunuta do rozbalovací
  nabídky „✚ Tvary“ (`#nabTvary`, zvýrazněné hlavní tlačítko): hledání s fokusem při otevření (bez diakritiky,
  ↓ na první dlaždici, Enter vloží), skoky na sekce Základní / Rozšířené / Díly / Moje, po vložení se zavře
  (Shift + klik / Shift + Enter ji nechá otevřenou), při přetahování na desku zprůhlední (`.tahne`), `M.otevriTvary()`.
  Lišta v pojmenovaných skupinách s malým nadpisem: Projekt (název, Soubor, stav) → Historie → Vložit → Upravit
  (Seskupit, Zrušit seskupení, Duplikovat, Úpravy ▾) → Uspořádat (Zrcadlit ▾, Zarovnat ▾, Na desku, Plochou, Rovina)
  → Nástroje (Dílna ▾) → Pohled (Domů, Pohled ▾ se směry a přepínačem perspektivy) → vpravo ❓ a ☰ Panel.
  Vždy jeden řádek: popisky tlačítek od 1900 px, popisky nabídek do 1200 px, pod tím posun (bez posuvníku).
  Boční panel už jen Objekty, Pracovní deska a Ovládání. Testovací obal `stred_prvku` otevře nabídku, když je
  prvek v zavřené; průvodce ukazuje na `#btnTvary`.
  Hlášky (toasty) v Modeláři dole nad stavovým řádkem a průchozí pro myš (nahoře zakrývaly lištu a otevřené
  nabídky a spolkly klik); puštění přetaženého tvaru nad lištou neotevře nabídku (`M.posledniTahKnihovny`).
  Test `modelar_ui_revize2.py` 56 kontrol (skupiny lišty, vejde se, hledání, Enter, Shift + klik, Esc, Pohled ▾).

### Třetí celková revize a sada vylepšení (15. 10. 2026, noc)

Revize třemi pohledy (jádro a OCCT, scéna a panely, QA v prohlížeči skutečnou myší); opraveno vše nalezené:

- **Výběr hran**: hrana za stěnou (vnitřní roh skořepiny za přední stěnou) se kreslí tečkovaně a nejde na ni
  kliknout – viditelnost paprsky z kamery (`T.zakryte`, hrany zhuštěné na ~16 úseků, přepočet po zastavení kamery
  i po nové síti). Hrany, které se na obrazovce kryjí, rozhodne vzdálenost od kamery (`hranaVBode`); zvýraznění
  pod kurzorem = hrana, kterou vybere klik. Dřív klik na vnější svislou hranu vybral vnitřní a „zaoblení“ přidalo materiál.
- **Přesné jádro**:
  - zaoblení/sražení s horní mezí změny objemu z analytického průřezu (`mezZmenyObjemu`: r²(tg φ/2 − φ/2)·L,
    ½d²·sin φ·L) – oblouk přidal +68 mm³ a prošel všemi kontrolami;
  - záloha ořezem ne pro hrany se zlomem pod 15°, nejdřív ověří, že všechny hrany jsou úsečky mezi rovinami
    (jinak zavádějící „větší než plocha“);
  - nenabízí hrany se zlomem pod 20° (plošky oblouku, přechodu – stovky hran) ani hladké přechody kruhových hran
    (test tečnosti bral těžiště kruhu místo bodu na hraně – kapsle);
  - výjimka WebAssembly → česká chyba (prázdný výsledek „příliš tenké nebo malé“); plocha, kterou nejde postavit
    spojenou, po trojúhelnících;
  - **měřítko přes obaly úprav** (`brepR` s odloženým měřítkem): skupina s jedním dítětem (obal úpravy) protlačí
    zvětšení dovnitř – základní tvar ve skutečné velikosti, úpravy ve skutečné velikosti, bez škálování tam a zpět
    (B-spline). Skupina více těles měřítko nepropouští (jako zobrazení manifoldem) → úprava vnější skupiny nezmění
    tvar vnořené. Skořepina se zaobleným okrajem roztažená: dřív chyba, teď 50 ms; zaoblený kvádr se skořepinou
    roztažený: dřív 41 s a chyba, teď 0,4 s. Síť, hrany a plochy se převádějí do přirozených souřadnic lineárně, STEP
    dostane upravené těleso tuhou maticí (roviny zůstanou rovinami);
  - skořepina se nenabízí u srdce, vlnovky a přechodu (vždy selhala, přechod po 30 s).
- **Rozdělení rovinou**: část = průnik s poloprostorem (obálka průniku = skutečný díl): inspektor ukazuje
  skutečnou velikost, mezera odsune jen kladnou část (spodní díl zůstane na desce), rovina mimo těleso = česká chyba.
- **Poznámky přichycené k tělesu** (`M.srovnejPoznamky` při každé změně dokumentu): jedou s posunem, otočením,
  zrcadlem i změnou velikosti (bod v jednotkovém kvádru tělesa, `jedn`); obalení úpravou, seskupení, zrušení
  seskupení i smazání je nechá na místě (u skupiny / části / volně) – dřív skákaly na místo vzniku.
- Projekt z úložiště prohlížeče prochází stejnou kontrolou jako ze souboru (`M.projekt.overDok`).
- **Rozhraní**: dialogy (dotaz, potvrzení) uprostřed (`dialog.js`: `margin:auto`, reset `*{margin:0}` je táhl do rohu);
  text ve skice bere psaní hned (dotaz až po stisku); pohled shora/zespodu rovnoběžně s osami; lišta: kolečko myši
  ji posouvá, `scroll-padding` – zaměřené tlačítko nezajede pod ❓, ❓ a ☰ přilepené ve všech šířkách, bez posuvníku;
  ☰ Panel `aria-expanded` podle skutečného stavu; panel nástroje na telefonu schová boční panel; průvodce nad
  nabídkami; „Zrušit vše“ v úpravách hran zachová posun a barvu; puntíky zarovnání po pohybu kamery;
  raycast kurzoru jednou za snímek; zarovnání a položení bez šumu float32 v polohách; text ve skice 2 mm.
- **Vylepšení**:
  - čísla ve všech polích berou výpočty a jednotky (`M.prectiCislo`: `60/2`, `(10+5)*2`, `3 cm`, `1 000`, `=2*3,5`),
    neplatné nebo oříznuté hodnoty se ohlásí (červený záblesk pole + hláška, `M.oznamPole`);
  - **kóty** vybraného tělesa ve scéně (`ui/koty.js`): šířka, hloubka, výška podél os tělesa, klik na číslo = nová
    velikost (spodek stojí), u více těles obálka; vypínač v nabídce Pohled (pamatuje si ho prohlížeč);
  - **příprava tisku** (`jadro/tisk.js`, `ui/tisk.js`): hmotnost a délka filamentu ve stavovém řádku (materiály
    PLA…pryskyřice, výplň), panel Kontrola tisku (Dílna) s problémy a opravami jedním klikem (mimo desku, pod deskou,
    visí ve vzduchu, větší než deska, samostatná díra), převisy červeně ve scéně, Rozmístit na desce;
  - skupiny hran v panelu zaoblení: Svislé / Horní / Dolní;
  - klávesa A (a Insert) otevře nabídku Tvary.
- Testy: `node _test/modelar_tisk.js` (17), `modelar_occt.js` (+12 → 59), `modelar_dilna.js` (+10 → 54),
  `modelar_upravy.js` (+4 → 30), `python3 _test/modelar_ui_revize3.py` (60 kontrol, server i file://).

### Čtvrtá celková revize a vylepšení (16. 10. 2026)

Čtyři revizoři (jádro a OCCT, soubory a ukládání, kód rozhraní, QA jako uživatel skutečnou myší); opravy:

- **Přesné jádro**: skořepina s otevřenou plochou se ověří na síti (paprsek, `M.bodVSiti`) – OCCT u natočeného
  a roztaženého tělesa vracelo zavřenou dutinu a jeho klasifikátor bodů lhal; natočení po 90° v obalu úpravy
  přeskládá zvětšení na osy dítěte (skutečná velikost, roviny zůstanou rovinami); mez změny objemu počítá s celým
  tečným řetězem hran (`delkaRetezu`, jádro vrací pro tutéž hranu různá id – `isSame`); filtr mělkých hran (pod 20°)
  jen u těles ze sítě a jen mezi malými ploškami (hřeben ploché střechy a 24boký hranol se zase nabízejí, při
  dohledávání uložených hran se nefiltruje); hrany vybrané při jiném zvětšení se dohledají i v měřítku 1.
- **Rozdělení rovinou**: kontrola protnutí na skutečných vrcholech (šikmá rovina mimo kouli), mezera odsune horní díl
  i při normále dolů. **Poznámky** na skice a dílu při změně parametrů zůstanou na místě. **Rozmístit** nehýbe
  skrytými a zamčenými, hlásí zamčené překážky. **Výrazy**: jednotka platí pro součin (`1/2 in` = 12,7), bez
  binárního šumu, hluboké závorky = NaN.
- **Soubory a ukládání**: dvě karty nad jedním projektem – starší karta nepřepíše novější práci (značka karty,
  verze změn; vlastní změny se uloží jako „(kopie z druhé karty)“); model v µm / v metrech se při importu převede
  po tisících s hláškou; 3MF: strop 8 M trojúhelníků a vrcholů, 300 MB XML (bomba odmítnuta do 2 s); STL s UTF-8 BOM;
  klíč barevné skupiny zná „barvy ze souboru vypnuté“; sloučený export zachová barvy souboru a slučuje JEN
  překrývající se tělesa (samostatné díly zůstanou samostatnými objekty); řídicí znaky v názvech pryč (3MF bylo
  neplatné XML); OBJ/MTL bez mezer v názvu; projekt z úložiště se ověří dřív, než se načítá geometrie; výpočet
  spadlý na paměť se při dalším použití zkusí znovu; zablokované otevření databáze nezůstane viset.
- **STEP**: přesné sjednocení, které selže (písmo vnořené do tělesa), spadne na síť z manifoldu s hláškou místo
  chyby „fuseAll: operation failed“.
- **Rozhraní**: normála zásahu inverzní transpozicí (F, W, vzor děr na roztažených skupinách), shader převisů taky,
  převisy zmizí z díry a respektují řez pohledem, nejsou v náhledu projektu; „Hotovo“/Esc během výpočtu úpravu
  dopočítá a zapíše; viditelnost hran až po zastavení kamery; úchyty a Dílna se nepřekreslují bez změny
  (`M.hlidacSnimku`), klíč geometrie v mezipaměti (WeakMap); panel tisku odloženě; dotyk – širší zásah hran;
  kóty potvrdí rozepsané pole inspektoru, zavřou se při změně velikosti okna; Ctrl+Z funguje i s fokusem na
  přepínači; klik do scény (i na úchyt) jí vrátí fokus (šipky); řez pohledem a skryté poznámky se s novým projektem
  vypnou; Ctrl+S/O/E nejdřív zruší náhled; kontrast palety, `aria-live`, `role=application`, fokus barvy;
  „Domů“ na úzkém okně vycentruje desku do části, kterou nezakrývá inspektor; rozměry natočeného tělesa
  označené „(osy tělesa)“; varování a běžící čas u výpočtu s víc než 60 hranami; zavření poslední otevřené plochy
  = uzavřená dutina; panel si pamatuje poslední velikost; „Odebrat skořepinu“; ikony bez duplicit.
- **Vylepšení**: nejlepší orientace pro tisk (`M.orientaceProTisk` – kandidáti z velkých ploch a os, skóre převisy
  − ½·plocha na desce + výška; Dílna a panel tisku); odsazení stěn / vůle (operace `odsazeni`, `M.odsadUzel`,
  základ zahrne vůli, spodek zůstane); přesná díra pro šroub v přesném jádru i STEP (válce, kužel, šestihran);
  klik na rovnou plochu v panelu zaoblení vybere celý její obrys; kontrola tisku hledá překrývající se tělesa
  (`M.sitePrekryvaji`, oprava Rozmístit); protikolo k ozubenému kolu (`M.protikolo`: osová vzdálenost m·(z1+z2)/2,
  fáze 180° + 180°/z2, šikmé zuby zrcadlené v Y).
- Testy: `modelar_ui_revize4.py` (30 kontrol), node `modelar_occt.js` 73, `modelar_tisk.js` 24, `modelar_soubory.js` 52,
  `modelar_dily.js` 30, `modelar_upravy.js` 32, `modelar_jadro.js` 121.

### Pátá celková revize a rozšíření (16. 10. 2026)

Čtyři revizoři (jádro a OCCT, soubory a ukládání se dvěma kartami ve fake-indexeddb a PrusaSlicerem, kód
rozhraní, QA skutečnou myší); opravy:

- **Ukládání a karty**: záznam se sestaví až ve frontě ukládání (při souběhu jedna kopie, ne dvě); karta bez vlastních
  změn nic nepřepíše ani neoživí smazaný projekt a nepohne s časem úpravy; prázdný „Projekt N“ se maže jen když je
  prázdný i v úložišti (jiná karta ho mohla naplnit); smazání otevřeného projektu se už neptá nesmyslně; karta se
  zastaralou verzí ji při otevření načte znovu; BroadcastChannel: po uložení v jedné kartě druhá hned nabídne načtení
  novější verze (s vlastními změnami upozorní, že se uloží jako kopie).
- **3MF pro slicery**: dotýkající se tělesa (štítek na desce, kostka na kostce) jdou jako jeden objekt z dílů
  (síť s barvou na trojúhelníku + `Metadata/Slic3r_PE_model.config` s díly a extrudery) – PrusaSlicer je dřív
  rozházel na podložku (ověřeno slicováním: vršek 3,95 mm, dva díly s extrudery 1 a 2); Sloučit počítá i dotyk;
  čtení díly ze `Slic3r_PE_model.config` i komponenty vrátí jako samostatná tělesa na svých místech.
- **Přesné jádro**: zmizelá rovná hrana se nezamění za sousední (okolí úměrné odchylce měřítka, v měřítku 1 jen
  na své přímce); zaokrouhlené rovnoměrné zvětšení (1,37) se bere jako rovnoměrné (žádný zbytečný B-spline);
  odsazení eliptických tvarů přes triangulaci (do 1500 plošek), poctivé hlášky u odsazení i skořepiny oblých ploch
  po roztažení; mnohostěny (hranol, jehlan, hvězda…) bez filtru mělkých hran; binární STL s BOM v hlavičce; drobnosti
  (`2x3`, velká čísla, tečny řetězu jednou, odebrání odsazení u vlastní skupiny, české tvary).
- **Protikolo**: v rámci kola (zrcadla a zvětšení se přenesou), šípové zuby zrcadlené, směr kolem osy volný
  (řetěz kol nepřistane na prvním), poctivá hláška při kolizi.
- **Kontrola tisku**: překryvy i podél hran (trubka skrz desku), výsledky dvojic v paměti, sítě až na požádání.
- **Rozhraní**: Delete/Backspace na posuvníku, přepínači či zaškrtávátku nemaže tělesa; „Hotovo“ během výpočtu
  nemění výběr; kóty po zavřeném dotazu; Ctrl+D/G/K z pole inspektoru; Zpět slučuje šipky/barvu jen u týchž
  těles; díra a tvar puštěné na stěnu se natočí podle normály, díra se zanoří s hlavou v rovině stěny;
  dotyk na jiném tělese pod šipkou otáčení ho vybere; nejlepší orientace srovná natočení kolem Z na nejmenší
  půdorys a šum ignoruje; panel tisku nepřetéká; „Zaměřit výběr“ (tečka, Pohled, dvojklik v seznamu) a panel úprav
  sám zaměří těleso, které by zakryl; ☰ Panel schová boční panel i na šířce 761–1250 px; odsazení díry soustředné;
  díly po rozdělení „(horní / spodní část)“; varování u textu v SVG; písmo štítku, které se nenačte, text nesmaže;
  stav načítání přesného jádra po pádu.
- **Rozšíření**: díra pro šroub pro **závitovou vložku** (heat-set, průměry M2–M8) a **samořezný šroub**; díl
  **Sloupek pro šroub** (pro vložku / samořezný / průchozí, automatická tloušťka stěny, i přesně v OCCT a STEP);
  **tenké stěny** v kontrole tisku (`M.tenkeSteny`, paprsky dovnitř s mřížkou, červený překryv); **vůle mezi
  tělesy** (`M.vuleSiti`, Dílna, výsledek v panelu Měření).
- Testy: `modelar_ui_revize5.py` (32), node `modelar_occt.js` 80, `modelar_dily.js` 45, `modelar_tisk.js` 30,
  `modelar_dilna.js` 58, `modelar_soubory.js` 54, `modelar_jadro.js` 122.

### Výkresy a témata plochy (16. 10. 2026, přání)

- **Výkres** (`jadro/vykres.js`): rozpoznání kružnic v pohledech (`M.kruzniceVPohledu` – uzavřené smyčky ≥ 8 úseček
  se stálým poloměrem); čerchované **středové kříže** a **osy děr** v ostatních pohledech (v délce stěn díry, bez
  duplicit); **kóty průměrů** odkazem „Ø6“ / „2× Ø6“ (stejné díry jedním popisem); **polohy děr** v půdorysu od levé
  a spodní hrany; kóty s textem nad čarou a u krátkých kót šipky zvenku s textem vedle; **řez A–A** (`M.rezSiti` –
  ořez sítě rovinou a průnik, `M.srafy` – šrafy 45° sudá/lichá, díry zůstanou prázdné) rovinou přes největší díru,
  stopa řezu v půdorysu se šipkami a písmeny A; razítko s **materiálem a hmotností** (objem ze sítí × hustota podle
  Kontroly tisku) a značkou promítání ISO E; **export DXF** (`M.vykresDxf`, R12, hladiny OBRYS/SKRYTE/OSY/KOTY/TEXT,
  typy čar ČÁRKOVANÁ a ČERCHOVANÁ, diakritika \U+XXXX – ověřeno ezdxf: 0 chyb). PDF kreslí čerchované osy a kružnice.
  Okno výkresu: Vpravo dole (izometrie / řez / nic), Osy a kóty děr, Materiál, tlačítko DXF.
- **Témata plochy**: 14 nových (Tyrkysová laguna, Les, Láva, Oceán, Máta, Levandule, Broskev, Retro monitor, Karbon,
  Sníh, Ořech, Měď, Bauhaus, Vysoký kontrast) – celkem 24; výběr i přímo v nabídce Pohled ▾ (dlaždice 4 v řadě).
- Testy: `modelar_dilna.js` 64 (kružnice, osy, Ø, poloha, řez a šrafy, DXF), `modelar_ui_revize5.py` 44.

### Přání 16. 10. 2026 (závity, šipky, střed otáčení, vzor děr, struktura, stavový řádek)

- **Počet závitů**: odvozené pole „Počet závitů“ u Díry se závitem a Šroubu (délka = počet × stoupání, celé číslo).
- **Šipky otáčení** decentnější: oblouk 40° místo 55°, tenká bílá čára s průhledností 0,62, hrot max. 11 px, plná
  sytost až při najetí / tahu; tenčí pás pro zásah myší.
- **Střed otáčení pohledu**: s výběrem kolem středu obálky vybraných těles (`S.stredOtaceni`), bez výběru kolem
  počátku desky (`Kamera.otoc(dx, dy, stred)` – rotace kolem bodu, bod zůstane na obrazovce na místě).
- **Vzor děr**: režim „Počtem děr po celé ploše“ (nx × ny rozložené po obálce plochy); okno ukazuje rozměr plochy
  a u jediné díry radí, proč se víc nevejde (výchozí kostka 20 mm má po odstupu jen 10 × 10 mm).
- **Struktura na ploše** (Úpravy ▾, klik na plochu): jádro povrch3d (POVRCH + VZORY, 22 vzorů) načtené líně;
  `jadro/struktura.js` (výběr plochy, nastavení, výpočet, `M.nahradSiti`) a `ui/struktura.js` (okno s náhledem
  vzoru, odhad trojúhelníků, výpočet ve workeru z textu modulů – jde i z file://). Rovina i plášť válce (vzor se
  ovine dokola – váleček na těsto), vyrytá / vystouplá, natočení, náběh u okrajů, převrácení; limit 400 tisíc
  trojúhelníků (jemnost se zvětší). Těleso se nahradí sítí na stejném místě (Ctrl+Z vrátí). Obrys výběru se
  u sítí s víc než 25 000 ostrými hranami nekreslí (jemná struktura by těleso jen přebarvila).
- **Stavový řádek**: souřadnice kurzoru v polích pevné šířky (8ch, zarovnané vpravo) – zbytek řádku neposkakuje.
- Testy: node `modelar_struktura.js` (20), `modelar_upravy.js` 34, `modelar_jadro.js` 124; prohlížeč
  `modelar_ui_revize6.py` (52, server i file://).

### Ukazatel čekání (16. 10. 2026, přání: „při načítání se tváří, že zamrzla“)

- `#cekani` nad pracovní plochou (pilulka nahoře uprostřed): točící se kolečko a lišta průběhu. Animace přes
  transform běží v kompozitoru, takže se točí, i když hlavní vlákno počítá. Je přímo v HTML, takže je vidět od
  prvního vykreslení stránky, ještě než se stáhnou skripty.
- API ve `spolecne.js`: `M.cekej(klic, text, podil|null, zpozdeni=250)`, `M.hotovoCekani(klic)` a
  `M.dejVykreslit()` (počká na vykreslení před těžkou prací v hlavním vlákně). Víc souběžných úloh = ukazuje
  poslední; úlohy kratší než 250 ms se neukážou.
- Napojeno na: start stránky / otevírání projektu, výpočty skupin (dávka „n z m“ s lištou), načítání OCCT (22 MB),
  import souborů (název, pořadí, „Vkládám do scény…“), strukturu (načtení jádra, příprava plochy, zobrazení
  výsledku; v okně kolečko a lišta s % z workeru).
- Test: `modelar_ui_revize6.py` (66 kontrol).

### Další tvary (16. 10. 2026, přání: „rozšiř databanku předdefinovaných tvarů“)

- Třetí sada knihovny `sada: 'dalsi'` (sekce „Další tvary“ v nabídce Tvary, skok „Další“), 16 tvarů v `jadro/tvary.js`:
  **Mnohostěn** (čtyřstěn, osmistěn, dvanáctistěn, dvacetistěn, kubooktaedr, kosočtverečný dvanáctistěn, komolý
  dvacetistěn – míč), **Drahokam** (fasety, horní plocha, korunka), **Sražený kvádr** (sražení všech hran),
  **Paraboloid**, **Čočka** (dva kulové vrchlíky), **Váza** (hrdlo, dno, stěna – dutá nebo plná), **Drážka (ovál)**,
  **Půlměsíc**, **Kapka**, **Puzzle dílek** (výstupky / zámky / krajový), **Blesk**, **Plochá spirála** (závity,
  šířka pásu), **Květ** (plátky, hloubka zářezů, otvor), **Háček** (tloušťka, výška špičky), **Montážní deska**
  (zaoblení, 4 otvory, odstup), **Krabička** (otevřená: stěna, dno, zaoblení rohů).
- `M.konvexniObal(body)`: stěny = roviny přes trojice bodů bez bodů za nimi, body v rovině seřazené kolem těžiště
  (rovná stěna = jedna plocha, i pětiúhelníky a šestiúhelníky), O(n⁴) – pro desítky bodů (míč 60 bodů = 44 ms).
- Rovinné (mnohostěn, drahokam, sražený kvádr, blesk) jsou v OCCT mezi `MNOHOSTENY` (rovné plochy jsou skutečné).
- Testy: `modelar_jadro.js` (všech 604 náhodných sítí vodotěsných s přesnou obálkou), `modelar_occt.js` (přesně),
  `modelar_ui_revize6.py` (88; dlaždice všech sekcí skutečnou myší – obsluha klikání se původně napojila jen na první tři mřížky).

### Přání 16. 10. 2026 (3): úhel otočení, položení skupiny, sada šroubu, háček S, puzzle s vůlí

- **Úhel otočení navazuje**: u jednoho tělesa úchyt ukazuje skutečné natočení a přírůstek („Z 60° (+30°)“),
  přichycení po 15° / 1° platí pro výsledné natočení (ze 7° tah skočí na 15°, 30°…), rysky úhloměru mají 0° tam,
  kde je těleso nenatočené. Platí, když otočení mění jen tu jednu složku natočení (ověří se zkušebním otočením
  o 10°); víc těles nebo obecné natočení = přírůstek jako dřív.
- **Položit na desku u skupiny**: spodek se bere ze spočítané výsledné sítě (`M.zapisVysledekSkupiny` z telesa.js,
  `minNadRovinou` v transformace.js) – díra nebo průnik, který odřízne spodní část, už nenechá výsledek viset.
- **Šroub + matice (sada)** (`DILY.sadaSroub`): jeden díl, šroub a matice vedle sebe, společný závit, celková
  vůle 0,35 mm (šroub −40 %, matice +60 %), výchozí M10, matice se sraženým vstupem z obou stran (45°).
  Test: šroub ze sady projde maticí ze sady (M8, M10, M16, přes 24 fází otočení). Oprava: obálka šroubu počítá
  se zúžením o vůli (tyč bez hlavy).
- **Háček S** (`hakS`, Další tvary): naplocho (pevnější tisk), tloušťka a délka špiček; pás kolem střednice
  (`pasKolemCary`).
- **Puzzle s odsazením** (`odsazeni`, výchozí 0,15 mm): obrys v mm (`M.obrysPuzzle`, `hranaPuzzle`): hrany
  dovnitř o odsazení, výstupek menší, zámek větší; obálka = rozměr, rozteč dílků vrací `roztec`. Ověřeno:
  mezera výstupek–zámek ≈ 2 × odsazení, bez překryvu.
- Testy: `modelar_ui_prani3.py` (28), `modelar_dily.js` 60, `modelar_jadro.js` 124.
- **Úhloměr od osy** (přání): 0° leží na ose (otáčení kolem Z → směr X, kolem X → Y, kolem Y → Z), čárkovaná
  osa nuly s popiskem „0° X“, popisky rysek = natočení od osy; výseč od osy k tělesu a ručička ve směru jeho
  osy (u jednoho tělesa = stejné číslo jako popisek u kurzoru). U víc těles výseč od začátku tahu o přírůstek.

### Přání 16. 10. 2026 (4): šroub a matice zvlášť, šroubovice, háček S na trubky, kvalita

- **Sada šroub + matice** vkládá dva samostatné objekty (`M.uzlySadySroubu`, `M.pridejTvar('sadaSroub')`),
  díl `sadaSroub` zůstává kvůli uloženým projektům. Matice má přepínač **Sražený vstup závitu** (výchozí zapnutý).
  Oprava: přepínače (ano/ne) v parametrech dílů se v `normalizujParamDilu` vždy vracely na výchozí hodnotu.
- **Maticová šroubovice** (`DILY.sroubovice`): trubka s vnitřním závitem, délka / počet závitů, stěna, odvozený
  vnější průměr (zápis dopočítá stěnu), sražení vstupů – vložit do díry jiného tělesa a seskupit.
- **Háček S** přesunut z tvarů do dílů (`DILY.hakS`, `sada: 'dalsi'` → v sekci Další tvary; skutečné mm):
  průměr trubky nahoře / dole, vůle, šířka drátu, síla, rovný krček, délka a zahnutí špiček. Svislý krček tečně
  k oběma obloukům – předtím šikmý krček zasahoval do horního oblouku a trubka nedosedla. Test: vzdálenost
  středu trubky od obrysu = poloměr trubky + polovina vůle.
- **Kvalita oblých ploch** (`M.KVALITY` Hrubá ½× / Střední / Jemná 2× / Velmi jemná 4× výchozích segmentů,
  v mezích tvaru): inspektor (i víc těles a skupiny), paleta „Kvalita výběru: …“, kvalita nových těles v nabídce
  Tvary (localStorage). `M.kvalitaUzlu`, `M.sKvalitou`, `M.nastavKvalitu`, `M.nastavKvalituVybranych`.
- Testy: `modelar_dily.js` 71, `modelar_jadro.js` 129, `modelar_ui_prani3.py` 60.

### Rozšíření 16. 10. 2026 (návrhy 1–12 a 14)

1. **Propojené díly** (`vazba` v uzlu dílu; `M.propojeneZmeny`, `M.nastavVazbu`, `M.protikusy`, `M.lzePropojit`):
   šroub ↔ matice ze sady, krabička ↔ víko – sdílené parametry (`M.SPOJENE_KLICE`: závit, průměr, stoupání, rozměry,
   stěna, zaoblení; víko na šroubky ↔ sloupky). Inspektor mění oba v jednom kroku, ukazuje „Propojeno s…“ a umí
   propojení zrušit; paleta Propojit / Zrušit propojení. Kopie se nepropojují.
2. **Moje vůle pro tisk** (Dílna): kalibrační destička (`DILY.kalibraceVule` – kolíky v dírách 0,1–0,5 mm, hodnota
   vyrytá sedmisegmentovými číslicemi), uložená vůle (`M.mojeVule`, localStorage) se použije u nových dílů podle
   `M.vulePro` (matice/šroubovice/díra: v − 0,05; sada a víko: v; háček, klip, příchytka: 2v; puzzle odsazení: v/2).
3. **Skládačka** (Další tvary → Skládačka…, `M.uzlySkladacky`): N × M dílků, okraje `vlastni` + `hrany` (z/v/r),
   rozměr dílků dopočítaný na stejnou rozteč; složená (tisk vcelku) nebo od sebe. Textové parametry tvarů.
4. **Odhad kvality** v inspektoru („Teď ≈ … trojúhelníků“, odhad v nápovědě tlačítek, `M.odhadTrojKvality`);
   nad 1,5 milionu se zeptá.
5. **Nové díly**: klip na trubku, kabelová příchytka (zahloubené díry), držák na zeď (žebro, zápustné díry),
   zacvakávací čep; přepínače (bool) v dílech.
6. **Krabička s víkem** (`krabiceSVikem` → dva propojené uzly `krabice` + `vicko`): nasazovací lem s vůlí, nebo
   víko na šroubky se sloupky v rozích (zahloubené díry).
7. **Text po obvodu** (`ui/reliefy.js`): kolem válce (ovinutí `obalitVzorem`) nebo po kružnici (skica z písmen
   po oblouku, `M.textPoKruznici`); **reliéf z obrázku** (`M.sitReliefu` – výšková mapa, podklad, boky; tmavé = vyšší
   pro litofanii).
8. **Závit na válec** (`M.zavitNaValec`): vnější (horní část válce zúžená prstencem na jádro + závitová tyč, vnořené
   skupiny) nebo vnitřní (díra se závitem shora); závity s **vlastním průměrem** (`velikost: 'vlastni'`, `prumer`,
   stoupání podle průměru `M.stoupaniPro`). Oprava: `map(zaokr)` předával index jako počet desetinných míst.
9. **Zaoblení spojů**: v úpravě hran tlačítko „⌒ Spoje“ vybere vyduté hrany (materiál kolem středu hrany > 58 %
   z 26 mírně pootočených směrů, `M.bodVSiti`).
10. **Pole podél křivky** (typ `krivka` v `M.poleUzlu`, `M.cestaZeSkici`, `M.bodyNaCeste`): nejdelší obrys skici,
    rovnoměrně po délce, natáčení podle tečny, otevřená / uzavřená.
11. **Cena** materiálu (Kontrola tisku: cena cívky Kč/kg; stavový řádek „· 2,97 Kč“, `M.cenaTisku`).
12. **Rozmístění na desku** s otáčením o 90° (skyline, 4 pořadí × s/bez otočení, původní řady jako záloha).
14. **Šablony projektů** (`jadro/sablony.js`, Soubor → Nový ze šablony): krabička na elektroniku, stojánek na
    telefon, jmenovka, organizér na tužky, věšák na klíče, podtácek.
- Testy: node `modelar_sablony.js` (41), `modelar_upravy.js` 41, `modelar_dily.js` 71; prohlížeč `modelar_ui_prani4.py`.

### Revize 6 (16. 10. 2026, „kompletní revize, profesionální nástroj“)

Čtyři revizoři paralelně (jádro v node, kód UI staticky, soubory a export v node, QA skutečnou myší v prohlížeči,
server i file://, DPI 1/2, šířky 420–1920), jen hlásili; opravy jsem dělal já. Nálezy: 0 kritických, 19 závažných,
~60 drobných. Hlavní opravy:
- **Propojení přes skupiny**: `M.propojeneZmeny`/`M.protikusy` rekurzivně, `M.upravVnorene` + `M.prestavSkupinu`
  (skupina přepočítá obálku a zachová polohu ve světě), `M.dokSeZmenouParametru` (jeden krok, odsunutí protikusu
  nebo jeho skupiny při překryvu, více klíčů – vlastní průměr převezme normu); pole Rozměr u krabičky/víka mění
  parametry (`rozmerKlice`); lem víka podle dutiny; povolené dvojice propojení; kopie páru (duplikace, vložení,
  vlastní tvar) dostane novou společnou vazbu (`M.kopieSVazbami`).
- **Vroubek do STL děravý** (nulové hrany z průniku) – druhé vytažení posunuté; nový test `modelar_stl_svar.js`.
- **Díly**: příchytka pro tenké kabely, montážní deska s velkým zaoblením, čep (přesah podle prořezu, obálka),
  otvory klipu/příchytky, opsané kružnice děr (vůle i u velkých průměrů), klip max 150°, vůle omezená vůči průměru
  závitu, imbus a sražení u malých závitů, sloupky krabičky v zaoblených rozích, zahloubení díry do hloubky,
  hrubé závity, rozpočet vroubku, háček S – špička nepřejede krček, věšák v šabloně s háčky kolmo z desky.
- **Soubory**: verze souboru 3, obálka dílu ze souboru ověřená proti parametrům (posun/měřítko zachované),
  přepínače „false“/0, podklad skici jen data URL, Uložit/Export bez nepotvrzeného náhledu (`M.potvrzenyDok`),
  STEP vynechá příliš složitá tělesa a zbytek vyexportuje, 12 písem štítku offline.
- **Výkon**: `M.indexBodVSiti` (mřížka v Y–Z, stejný výsledek, 60–250× rychlejší) – Spoje, překryvy v kontrole tisku;
  odhady kvality v inspektoru s pamětí.
- **UI**: šablona bez úložiště i se Zpět, struktura (souběh, změna tělesa během načítání, české chyby, spáry
  ≥ 0,5 mm, tykání, odklad přepočtu), text po obvodu (dvojí vložení, Esc, výška), reliéf (SVG bez rozměrů, chyby
  čtení, obrázek zůstane), závit na válec (validace, normovaný závit v radě), pole podél křivky (prázdná skica,
  originál na začátek, přesná tečna), lišta (posuvná část zvlášť, ❓/☰ nic nezakryjí, stín u okraje), vkládání
  na desku, otáčení nezanoří těleso, kóty ořezané a při otáčení skryté, pohled Shora vždy stejně natočený,
  inspektor: tip k dílu, společné parametry víc dílů, kontrola okrajů puzzle, kontrola tisku celého modelu,
  předvolby s pamětí v soukromém okně (`modelar_vule`, `modelar_kvalitaNovych`), přístupnost (procenta mimo
  živou oblast, role img, názvy), nápověda Postupy doplněná.
- Testy: `modelar_stl_svar.js`, `modelar_ui_revize7.py`; úpravy starších testů (počty dlaždic, klíče, segmenty 192).
- **Druhé kolo revize** (kontrola oprav): přestavění skupiny posouvá i body hran/ploch OCCT, odsunutí protikusu jen
  při nově vzniklém překryvu (sestavený pár zůstane), tečna pole přes ostré rohy, vlastní průměr podle každého dílu,
  index bodu v síti i daleko v −X; úchyty změny velikosti u krabičky/víka mění parametry, úchyty ořezané plátnem,
  kontrola tisku „jen výběr“ filtruje i problémy, zaměření vložené skládačky, rada při seskupení tělesa ležícího
  celého v díře, stavový řádek na mobilu na jeden řádek, kopie s vlastním názvem „(2)“.

## Odsazení obrysu ve skice – offset (17. 10. 2026)
- Jádro `M.odsadTvarSkici(t, d, {spoj, vysledek, seg})` v `jadro/skica.js` (ClipperLib, oblast tvaru NonZero jako u tělesa):
  d > 0 ven, d < 0 dovnitř; rohy zaoblené / ostré (miter ≤ 4·d) / zkosené; výsledek odsazený obrys nebo
  **stěna z obrysu** (pás tloušťky |d| vně nebo uvnitř – vnější rozměr se při d < 0 nezmění). Vrací tvar `polygony`,
  otvor zůstane otvorem; tvar, který by zmizel, = česká chyba.
- Skicář: u vybraného tvaru sekce „⇲ Odsadit obrys (offset)“ (klávesa O → fokus do vzdálenosti), čárkovaný náhled
  (v paměti podle klíče, kreslí se při každém pohybu), výsledek Nový obrys (kopie) / Nahradit tvar / Stěna z obrysu,
  chyba v panelu a vypnuté tlačítko, zápis do historie skicáře (Ctrl+Z).
- Celé těleso dál přes Úpravy → Odsadit stěny (OCCT); v paletě se najde i slovem „offset“. Nápověda Postupy doplněná.
- Testy: sekce v `_test/modelar_skica.js` (53), prohlížeč `_test/modelar_ui_offset.py` (30, server + file://).

## Náhledy úprav – „duchové“ (19. 10. 2026)
- `S.telesa.ukazDuchy(klic, uzly, styl)` v `telesa.js`: tělesa mimo dokument kreslená čárkovanými hranami
  (`LineDashedMaterial`, délky čar ve světových mm, viditelné výrazně + zakryté slabě přes `depthTest: false`)
  a výplní s obrysem podle natočení plochy (vlastní shader – oblé tvary po offsetu nemají ostré hrany).
  Styl `nahled` (výsledek před potvrzením, barva akcentu) a `puvodni` (tvar před úpravou, jen obrys).
  Geometrie přes počítání odkazů jako tělesa; dokud worker počítá, duch je skrytý (náhradní tvar by lhal).
- **Offset tělesa** má místo dotazu panel `#oknoOdsazeni`: hodnota (výpočty v poli), rychlé volby, živý náhled
  (přesné jádro na pozadí, starší výsledky zahozené, chyba v panelu), Enter / Použít = jeden krok historie.
- **Otočit kolem bodu**: duch otočených těles podle úhlu, osy a bodu.
- **Rozpracovaná úprava** (`M.app.uprava` – tažení, úchyty, zarovnání, zrcadlení): původní tvar změněných těles
  čárkovaně, po dokončení / zrušení zmizí.
- Test `_test/modelar_ui_nahledy.py` (44), `modelar_ui_revize4.py` přes nový panel.

## Přání 19. 10. 2026 (2): vazby, proměnné, skica na ploše, tažení, sestavy, knihovna, podpěry, PNG, zjednodušení

Postup: tři výpočetní jádra paralelně (agenti, jen nové soubory + node testy), UI a zbytek já.
- **Proměnné projektu** (`jadro/promenne.js`, `ui/promenne.js`, Dílna → ƒx): `dok.promenne [{jmeno, vyraz, popis}]`,
  `u.vzorce {klic: výraz}` (klíče `rozmer.i`, `poloha.0/1`, `spodek`, `rotace.i`, `param.k`, `odv.k`), skupina může mít
  vlastní `promenne` (parametrický díl). `M.prectiCislo(text, promenne)` umí jména, `pi`, sqrt/abs/round/floor/ceil/min/max/
  sin/cos/tan (°; argumenty `;` nebo `, `). `M.aplikujVzorce(dok)` přepočítá pole i kóty skic; přejmenování/odebrání
  opraví výrazy. Inspektor: výraz s proměnnou = vzorec (modré pole, jeden krok historie přes `M.sloucitDalsi`), číslo nebo
  šipka vzorec zruší; „Parametry dílu“ u skupiny s proměnnými.
- **Vazby a kóty ve skice** (`jadro/vazby.js` – LM řešič s krokem nejmenší normy, volnost z hodnosti; nástroj ⊾ K v
  `ui/skica.js`): tvary skici mají stálá `id` (`M.normalizujParamSkici`), `param.vazby`. Klávesy H V P K E C F D, kóta
  smí být výraz s proměnnou, sporná vazba se nepřidá, tah bodu/tvaru řeší vazby (`tah` z tvarů na začátku tahu).
- **Skica na ploše / kapsa** (`M.skicaNaPlose` v jadro/upravy.js, režimy `skicaNaPlose`/`kapsaNaPlose`): osy skici
  u, v, n (pohled zvenku), počátek = klik přichycený na mřížku (ne roh trojúhelníku – dřív čtvrtinová kapsa), obrys
  plochy jako čárkované vodítko, přidat (volitelně spojit) nebo vyříznout (hloubka / skrz) a seskupit.
- **Tažení po dráze** (`jadro/tazeni.js`, režim skici `tazeni`: `draha` křivka/šroubovice, `drahaBody`, `uzavrena`,
  `polomerS`, `stoupaniS`, `otacekS`, `levotoc`; rámce s minimální rotací, mitre v lomech; `M.tazeniZeSkic`, okno
  `ui/tazeni.js`). Inspektor filtruje parametry i podle `d.draha`.
- **Pohyblivá sestava** (`jadro/sestava.js`, `ui/sestava.js`): `dok.klouby` (otočení/posuv, meze, hodnota = současná
  poloha dílů), vnořené klouby jedou s rodičem, srážky = skupina průnik dvojice ve workeru (`M.sitSkupiny`), projetí
  rozsahu, přehrávání jako dočasná úprava.
- **Knihovna dílů**: `M.tvarZUzlu(uzly, nazev, dok)` – vzorce s proměnnými projektu → jedna skupina s proměnnými;
  náhled `S.vytvorNahled(w, h, ids)`; soubor knihovny = .modelar (každý díl jedna skupina, `M.dokZKnihovny`).
- **Podpěry** (`M.podperySite` v jadro/tisk.js: sloupy pod převisy na plochu mířící nahoru nebo desku, dělení velkých
  trojúhelníků), tlačítko ▥ v Kontrole tisku; převisy stupňovaně (žlutě 10° před mezí). Pozn.: živé převisy
  a nejlepší orientace existovaly už dřív.
- **Rychlé kóty** (`M.vzdalenostiKSousedum` v jadro/dilna.js, `ui/rychleKoty.js`): při posunu myší mezery k sousedům
  v ±X/±Y (soused musí překrývat druhou osu i výšku), jinak k okraji desky. Past: třída `tah-posun` je na plátně.
- **Obrázek PNG** (`S.snimek(w, h, volby)` ve scena.js, `ui/obrazek.js`): průhledné pozadí, 2× vyhlazení, bez desky.
- **Zjednodušení sítě** (`jadro/zjednoduseni.js` QEM s link condition, worker typ `zjednodus` s průběhem,
  `ui/zjednoduseni.js`, nabídka po importu nad 500 tis. trojúhelníků). 1M → 100k za ~2,6 s v node.
- Testy: node `modelar_promenne.js` (34), `modelar_vazby.js` (72), `modelar_tazeni.js` (63), `modelar_zjednoduseni.js` (39),
  `modelar_prani5.js` (39); prohlížeč `modelar_ui_prani5.py [dpi] [--jen-server]` (118 = 59 server + 59 file://).
  Past testů: headless české rozložení kláves – „/“ do dialogu zapisovat přes value; po kótě 50 mm obdélník vyjede
  z pohledu skicáře (před klikem Přizpůsobit).

## Ikony rozhraní (19. 10. 2026)
Sada od uživatele v `obsah/modelar/assets/icons-cad/` (84 ikon, PNG 256 px, archy). Na web jen zmenšené
`assets/icons-cad/ui/*.webp` (64 px, celkem ~166 kB, v offline sadě MODELAR); zdroje (png/, webp/ 256 px, source-sheets/,
icon-sheet-source.png) jsou v `.gitignore`. `ui/ikony.js`: `M.IKONY` příkaz → ikona + seznam dalších prvků (nabídky,
pohledy, tlačítka panelů); `M.pouzijIkony(koren)` nahradí úvodní emoji/symbol tlačítka obrázkem (původní znak zůstává
v HTML jako záloha), volá se při startu a po každé přestavbě inspektoru; paleta Ctrl+K ukazuje ikony příkazů.
Přepínač projekce mění jen text za ikonou. Nové tlačítko s příkazem dostane ikonu přidáním do `M.IKONY`.

## Připomínky 19. 10. 2026 (kóty posunu, náhled měření, stupnice otáčení více těles)
- **Kóty posunu** místo mezer k sousedům: vyber.js publikuje `M.tahPosunu {p0, u, v, du, dv}` (p0 = střed spodku obálky
  před tahem), `ui/rychleKoty.js` kreslí kótu X (U) a Y (V) od původní polohy (křížek) s posunem se znaménkem,
  u šikmého posunu i přímou vzdálenost; popisek u kurzoru jen při vypnutých kótách (`M.kotyPosunuZapnute`).
  `M.vzdalenostiKSousedum` zůstává v jádře (testy), UI ho nepoužívá.
- **Náhled bodu při měření**: pointermove na plátně v režimu `mereni` (1× za snímek) → `bodKliku` → `mer.nahled`;
  značka (zelená = přichycený vrchol / střed hrany / referenční bod), popis druhu, guma s živou délkou / úhlem.
- **Úhloměr u více těles**: bez absolutního úhlu (`tah.zakladUhel == null`) má stupnice nulu v místě uchopení
  (`tah.a0`) a čte se relativně (+45°…), stejně jako popisek; dřív byla nula na ose a výseč od uchopení.
- Test `modelar_ui_prani5.py` 140. Pasti WebDriveru: po sérii akcí myši občas nedorazí pointerDown / dotyková sekvence
  (do dokumentu nepřijde vůbec) – pořadí kroků v testu nebo jeden opakovaný pokus; ověřit záznamem událostí.
- Úprava (19. 10.): úhlopříčná vzdálenost pryč (uživatel ji nechce); kóty posunu oranžová X / fialová Y, čárkovaně,
  plný barevný štítek – odlišné od kót velikosti (červená/zelená/modrá).
- Úprava 2 (19. 10.): kóty posunu v barvách os (obrys štítku i čáry jako kóty velikosti), štítek se světlou výplní,
  čárkovaně; štítky se rozmístí bez překryvu (`rozmistiStitky`: kolmo od kóty, překážky = druhý štítek a křížek).
  Past testu: tah tělesa začne až po 4 px – při malém posunu nejdřív odjet stranou.

## Připomínky 20. 10. 2026
- **Skica jako normální těleso při změně velikosti**: `M.zapecMeritkoSkici` (jadro/model.js) + `M.skicaSMeritkem` (jadro/skica.js) –
  po puštění úchytu velikosti (uchyty.js konec), poli Rozměr v inspektoru a kótě ve scéně se měřítko zapeče do parametrů:
  tvary dostanou nové rozměry a polohy (zaoblení obdélníku zůstane), výška vytažení = rozměr Z, měřítko 1, počátek skici
  ve světě zůstane. N-úhelník a text při nestejném měřítku přejdou na obrysy, kóty se přeměří. Nezapéká se: rotace,
  tažení po dráze, kóty s proměnnými (zůstane měřítko). Během tahu se dál jen škáluje (bez přepočtu ve workeru).
- **Otáčení více těles od osy**: `tah.zakladUhel = 0` výchozí (místo null) – stupnice s nulou na ose, výseč od osy,
  popisek „Z 30° (+30°)“ jako u jednoho tělesa; přichytávání k násobkům od osy. Test modelar_ui_prani3 upraven.
- Úchyty středu hran (uchyty.js): práh délky hrany na obrazovce 36 px → 16 px. Dřív chyběly na kratších hranách
  i u výchozího kvádru 20 mm (34 px), u malých skic byly vidět jen dva ze čtyř.
- Úchyty středu hran i na horní stěně (`hornihrana±1…`, `uchyt.horni` – tažené v rovině horní stěny jako horní rohy):
  natočené těleso (skica na boční stěně, pracovní rovina) má vlastní „spodek“ přiložený k jinému tělesu, takže na
  viditelné straně černé úchyty chyběly. Horní úchyt hrany se vynechá, když by ležel < 1,4 × velikost od jiného
  (dolní roh / hrana mají přednost – jinak by tah prstem za roh chytil hranu, test modelar_ui_revize).
- **Objekt ze skici = běžné těleso** (přání 20. 10. 2026, uživatel to chce takto, i když skica byla „logicky správně“):
  po Hotovo (nová kresba, skica na ploše, import SVG, tažení po dráze) se skica převede na síť s osami desky
  (`M.sitZeSkici` v jadro/model.js: síť z workeru `M.sitSkupiny`, matice uzlu zapečená do vrcholů, rotace 0, zdroj
  formátu 'skica', id zůstane; `M.skicuNaTeleso` v ui/skica.js, i uvnitř skupiny přes `M.upravVnorene`). Skica se pak
  neupravuje. Volba ve skicáři „Ponechat jako skicu“ (`st.vysledek`; výchozí: nová kresba = těleso, úprava staré skici
  = skica) a v okně tažení – pro profily a dráhy tažení / pole po křivce. Inspektor u tělesa ze skici: „Těleso“.
  `M.pridejSkicu` je teď async (volby {teleso, zapsat}). Testy e6, offset, prani5 upravené (pomocník objem_vyberu).
- **Numerická klávesnice** (podle `e.code`, i s vypnutým NumLockem): Num 6 = zaměřit výběr + pevný střed otáčení
  (`S.nastavStredOtaceni`, platí i bez výběru, Domů ho zruší); Num 4 = posadit výběr na základní desku (Z = 0,
  `M.ROVINA_DESKY`, i se zapnutou pracovní rovinou). Klávesy v M.PRIKAZY jako 'Num4' / 'Num6'.
- **Magnet (G)** – `M.prisadPlochu` (jadro/transformace.js: otočení nejkratší cestou nA → −nB kolem středu plochy A,
  posun středu A na bod kliknutí na B), `ui/magnet.js` (režimy 'magnet' → 'magnet2', zvýraznění plochy A oranžově
  ze `M.oblastPlochy` + ShapeGeometry, cílová plocha pod kurzorem zeleně, oblá plocha = jen trojúhelník), tlačítko
  v liště Uspořádat s ikonou magnet.webp (od uživatele, sw v425). Lišta 1300 px: ikonová tlačítka padding 6 px.

## Text na zakřivenou plochu (20. 10. 2026)
Stránka v apps.js přepnuta na „beta“ (pokyn uživatele). `jadro/textNaPlose.js`: `M.indexPovrchu` (nejbližší bod sítě
přes mřížku buněk, normály rohů vyhlazené jen přes hrany do 40° – ostré hrany zůstanou), `M.mrizkaNaPovrchu`
(krokování po povrchu: účaří od bodu kliknutí, z každého bodu sloupec nahoru/dolů, krok h = výška písma / 25,
délky po povrchu zachované = samolepka bez natažení), `M.jemnaSitObrysu` (Clipper: pásy a čtverečky h,
THREE.ShapeUtils, svaření; bez T-spojů), `M.textNaPovrch` (vršek +výška, spodek −zanoření po normále, boky po
hraničních hranách → uzavřená síť), `M.textNaTeleso` (uzel sítě s osami desky, seskupení: vystouplý sjednocení,
vyrytý díra). UI: okno Text (ui/reliefy.js) má výchozí režim „Na plochu tělesa“ → režim scény 'textNaPlochu',
směr účaří = pravá osa kamery promítnutá do tečné roviny + natočení. Funguje na zaoblení, kouli, skupiny s dírou
(dřív jen holý válec), importy. Testy: node `modelar_text_plocha.js` (19), prohlížeč v modelar_ui_prani5.py
(212); modelar_ui_prani4 upraven (výchozí režim). Past testu: dítě skupiny má polohu v souřadnicích skupiny.

## Rohy při kombinaci sražení a zaoblení (20. 10. 2026)
Problém: druhá úprava hran na tělese s první (obal B nad obalem A) – svislá hrana po úpravě horních hran pokračuje
v rohu průsečnicí dvou zaoblení / sražení; OCCT ji nativně neupraví (prodlužuje jen přesně tečné řetězce), záložní
ořez booleanem dal u sražení špičku, u zaoblení zářez. Řešení v jadro/occt.js:
- `prohozeneVrstvy(u, site, S)` na začátku skupiny v brepR: B se spočítá na tělese bez A a A se zopakuje navrch
  (hrany obou dohledané bez délky, A posunuté o polohu vnitřního obalu); jen bez zvětšení / natočení, obě operace
  hranové, a když je B zaoblení, musí být A < 0,95·r_B (jinak se A kolem oblouku přetočí – sražení 5 kolem r 3 nejde,
  zůstane původní pořadí). `uprav(t, o, jenNativne)` – v prohozeném pořadí žádné záložní ořezy, selhání = postaru.
- `prodluzVyber` (jeden krok): k vybrané hraně v každém konci jednoznačně nejlépe navazující hranu (odklon ≤ 60°) –
  nové úseky v rozích (sražené rohy) při opakování A; zkusí se nativně, při selhání bez prodloužení.
Test: node `_test/modelar_occt_rohy.js` (9: obě pořadí, dvě zaoblení, kvádr bez prodloužení). Ladicí snímky rohů
přes UI: Úpravy → zaoblit/srazit + tlačítka skupin hran.
- Doplněk (20. 10.): prohození vrstev i když starší úprava sedí přímo na skupině více těles (kvádr s kapsou) –
  dřív jen obal s jedním dítětem, proto se u kapsy nespustilo (zářez ve vnějším rohu). Test rohy 12 kontrol.
- Hrany vybraného tělesa černé, rámeček výběru černý / na tmavé ploše světle šedý (telesa.js motiv) – přání.
- Num 8 = přepnout vybrané Těleso ↔ Díra (příkaz teleso_dira).
- **Zakryté hrany čerchovaně** (telesa.js): ke každému tělesu (ne díře) druhá LineSegments se stejnou geometrií hran,
  ShaderMaterial s depthFunc GreaterDepth (jen za povrchem), vrchol posunutý o 0,3 % ke kameře (viditelné hrany
  neblikají), vzor v px (čárka 8, mezera 3, tečka 2, mezera 3) z atributu lineDistance (naplnHrany) a uniformy
  mm/px u cíle kamery; řez pohledem přes clipping chunky; v náhledu projektu a PNG ne (userData.prekryv).
  Přepínač Pohled ▾ / příkaz skryteHrany (localStorage modelar_skryteHrany).
- Doplněk 2 (20. 10.): smíšený okraj kapsy (část zaoblená, část sražená, rohy obojí, sražené dno). `hranyPostupne`
  (svislé hrany jednotlivě napřed, pak souvislé skupiny, pak hrana po hraně) – stupeň před záložním ořezem; v
  prohozených vrstvách i „smíšené pořadí“: svislé hrany obou úprav, pak ostatní (novější úprava napřed). Okraj, který
  plynule obíhá zaoblený roh, je pro OCCT jeden tečný řetěz – dostane ho celý novější úprava, pohlcené hrany starší
  se přeskočí (režim 'pohlcene': jen u druhé úpravy a nikdy všechny – jinak by se úprava tiše vynechala, past z
  testu modelar_occt „krychle zaoblená + sražené svislé“). Test rohy 14. Zakryté hrany mají příznak userData.pomocne
  (ne prekryv – ten počítá test tenkých stěn). Šipky otáčení kratší (ROZPETI 28°).
- Pravý panel jde schovat ☰ na všech šířkách nad 760 px (dřív jen 761–1250), stav v localStorage
  `modelar_panelSkryty`, příkaz 'panel' (M.prepniPanel). Lišta na 1300 px: mezera ve skupinách 2 px (jinak přetekla o 8 px).
- Doplněk 3 (20. 10.): kazy v rozích (sražené svislé + zaoblený okraj kapsy). Pravidlo: svislé hrany vždy napřed –
  prohození vrstev se přeskočí, když má svislé hrany jen starší úprava A (zaoblené svislé, pak sražený okraj → dřív „V“
  v rohu). `hranyPostupne` zkusí i výběr prodloužený o pokračování v rozích (prodluzVyber – sražený roh na okraji),
  a když skupina nejde (plné zaoblení tenké stěny: r = půl tloušťky, OCCT neumí), zkusí hodnotu 0,97/0,94/0,9×
  dřív než po hranách (ty v rozích nechávaly zuby). Test rohy 20 (bodové sondy; objem rozdíl nepozná).
- Doplněk 4 (20. 10.): roztažená skupina (úchyty) – úprava hran se uloží přímo do ní (obalUpravou nedělá nový obal),
  takže A měla měřítko a prohození vrstev se vynechalo → nad sražením „ucho“ zaoblení. prohozeneVrstvy teď počítá
  ve skutečné velikosti: těleso bez A brepR(…, S·měřítko A) (+ zbylé měřítko), hrany A ×(S·měřítko A) + poloha·S,
  hrany B ×S, obě s odchylkou. Test rohy 24.
- Doplněk 5 (20. 10.) – hloubková oprava rohů „jednou provždy“: OCCT u kombinací zaoblení/sražení občas vrátí těleso,
  které je „platné“ a uzavřené, ale plášť se protíná sám se sebou (přeložená rohová ploška = zubatá čočka, přetočené
  zaoblení = rozbitý plášť). isValid ani vodotěsnost to nepoznají. Nová kontrola `M.samopruniky` (jadro/sit.js:
  zametání obálek + průnik trojúhelníků bez společného vrcholu, práh 0,15 % velikosti – mikropřehyby se nepočítají)
  je v `zdravaSit` a projde jí každý mezivýsledek (hranyNativne i záložní ořez). Neprojde-li postup, zkusí se další
  (pořadí vrstev, smíšené, po částech, menší hodnota, ořez); neprojde-li nic, úprava skončí chybou – rozbité těleso už
  nikdy. Podmínka „A < 0,95·r B“ pro prohození zrušena (přetočení zachytí kontrola). Zátěžový test
  `_test/modelar_occt_zatez.js` (40 náhodných scénářů 2–3 vrstev, i roztažené; se starým jádrem 4 rozbitá tělesa,
  teď 0; chyba jen u nemožných zadání – zaoblení větší než stěna, sražení tečné hrany).
- Doplněk 6 (20. 10.): projekt uživatele (tmp/Projekt 2.modelar – skořepina, zaoblení 2 horních hran, sražení zbylých
  horních a 3 svislých) – v rozích zvlněná rohová ploška (zlom 104° uvnitř jedné plochy, 3930 trojúhelníků): síť
  uzavřená, bez samoprůniků, ale zubatá „čočka“. `zvrasneniPloch` (occt.js) – největší zlom mezi sousedními
  trojúhelníky uvnitř plochy (skupiny tessellace getFaceGroupsPtr); zdravaSit ho omezuje na 45° (hladké plochy do
  ~10°, zvlněné 56–178°). Pak se vezme jiný postup – u projektu hladké rohy (5°, 152 trojúhelníků). Zátěžový test:
  10 z 11 zvlněných výsledků má čistou náhradu, 1 chyba (sražení tečné hrany). Výpočet asi 1,5× pomalejší.
  Test rohy 27 (projekt jako případ), zátěž hlídá i zvlnění. O.zvrasneni(u, site, sMistem) pro ladění.

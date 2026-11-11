# Plán: ✏️ Z náčrtu do 3D (od 11. 11. 2026)

Technický díl nakreslený rukou (na tisknutý list, nebo myší, prstem či perem na virtuálním papíře)
se převede na přesný 3D model pro tisk. Rozměry se berou **z kót, ne z čar**: kresba určí, *co tam je*
(obrys, díry, osy, co je rovnoběžné), čísla kót určí, *jak velké to je*. Mezi tím stojí řešič vazeb
z Modeláře. **Bez AI a bez cizích služeb.** Vše běží v prohlížeči, po načtení i offline.

## Rozhodnutí (11. 11. 2026)

1. **Název „Z náčrtu do 3D“.** Soubory `obsah/nacrt3d.html` a `obsah/nacrt3d/*.js`, jmenný prostor `N3D`.
2. **Žádná AI, žádné služby ani klíče** (výslovné přání). Rozpoznávání je klasická geometrie a zpracování obrazu.
3. **Čísla kót se zadávají ručně.** Stránka najde, kde kóta je, a uživatel napíše číslo. Ručně psané číslice
   rozpozná jen volitelná etapa 10 (vlastní rozpoznávač se vzory od uživatele, jen pro virtuální papír).
4. **Kóty jinou barvou** (červeně) se doporučují. Jednobarevná kresba jde také, jen s víc klikáním.
5. **Mřížka 5 mm, list A4 na výšku** (A3 jako volba). Mřížka je tečková ve „slepé“ světle modré barvě.
6. **Typy listů:** `plochy` (1 pohled + tloušťka), `rotacni` (půlprofil u předtištěné osy),
   `pohledy` (nárys, půdorys, bokorys v evropském promítání; prázdný pohled = plné vytažení).
7. **Výstupy:** STL, 3MF a soubor `.modelar`. Díl se v Modeláři otevře jako skica s vazbami a kótami, takže
   jde dál upravovat. Přímé předání mezi stránkami Modelář nemá, proto se předává soubor.
8. **Znovu použít:** `modelar/jadro/vazby.js` (řešič vazeb, node i worker), formát skici z `modelar/jadro/skica.js`,
   manifold z `lib/manifold`, jsPDF z `lib/`, písmo `lib/pdflib/LiberationSans-Regular.ttf`.
9. V `apps.js` je od 11. 11. (na přání uživatele už po etapě 3) v sekci 🧊 3D modelování se stavem `"vyvoj"`, anglický název
   v `i18n/en/_katalog.js`. Texty stránky zatím jen česky – překlad v etapě 11.

## Geometrie listu (smlouva)

- Souřadnice listu jsou v **mm, počátek vlevo nahoře, y dolů**. Mřížka je globální od počátku (krok 5 mm),
  takže rámečky na stejných řádcích nebo sloupcích mřížky jsou zarovnané.
- **Rohové značky:** čtverec 6 × 6 modulů. Vnější prstenec je černý, uvnitř je 4 × 4 = 16 bitů:
  6 datových (2 bity roh, 4 bity typ listu) a 10 kontrolních. Žádná ze 4 rotací platného kódu není platná
  pro jiná data (ověřeno testem), takže čtení určí roh, typ listu i natočení fotky. Kolem značky je bílá zóna.
- **Pohledy v souřadnicích tělesa** (X doprava, Y dozadu, Z nahoru):
  - nárys (pohled zepředu): vodorovně X, svisle Z;
  - půdorys (pod nárysem): vodorovně X, směrem od nárysu (dolů) přibývá „k předku“;
  - bokorys zleva (vpravo od nárysu): svisle Z, směrem od nárysu (doprava) přibývá „k předku“.
  Nárys a půdorys sdílejí sloupce mřížky (X), nárys a bokorys sdílejí řádky (Z).
- **Rotační list:** předtištěná svislá osa. Kreslí se půlprofil vpravo od ní (x = poloměr, y = výška),
  stejně jako u rotace skici v Modeláři.

## Data („výkres“)

```js
{ verze: 1, typ: 'plochy'|'rotacni'|'pohledy', format: 'A4'|'A3', mrizka: 5,
  tloustka: 5,                                   // jen plochy
  tahy: [{ id, pero: 'obrys'|'skryta'|'osa'|'kota', body: [[x, y], ...] }],   // mm listu, surové tahy
  prvky: [{ id, druh: 'usecka'|'oblouk'|'kruh', pero, ... }],                  // rozpoznané a srovnané
  koty: [{ id, a, b?, typ: 'delka'|'vzdalX'|'vzdalY'|'prumer'|'polomer', hodnota, poloha: [x, y] }],
  foto?: idFotky }                               // IndexedDB
```

Řetěz: **tahy → prvky** (rozpoznání, srovnání, přichycení) **→ obrysy a kružnice po pohledech → vazby**
(automatické vodorovně/svisle/splývá + kóty + mezipohledové „stejné X/Z“) **→ `resVazbySkici`** (jedno řešení
pro všechny pohledy najednou) **→ 3D** (manifold). Fotka i virtuální papír ústí do stejných **tahů**.

## Moduly (smlouva)

| Soubor | Obsah | node |
|---|---|---|
| `nacrt3d/listy.js` | typy listů, rozvrh (rámečky, osa, pole, legenda, značky) pro A4/A3, kódování a čtení značek, kreslení listu přes obecný „kreslič“ (plátno i jsPDF) | ✔ |
| `nacrt3d/tahy.js` | rozpoznání tahu (úsečka, oblouk, kružnice, obdélník, lomená), vyhlazení, rohy, přichycení na mřížku a konce | ✔ |
| `nacrt3d/vyklad.js` | prvky → obrysy (cykly grafu), díry, osy, přiřazení kót, automatické vazby, mezipohledové vazby | ✔ |
| `nacrt3d/stavba.js` | vyřešené obrysy → těleso (vytažení, rotace, průnik pohledů, díry) přes manifold, export STL/3MF/.modelar | ✔ |
| `nacrt3d/kontrola.js` | rozpory mezi pohledy, chybějící kóty (volnost), překryv modelu na list | ✔ |
| `nacrt3d/foto.js` | fotka → narovnaný list: značky, homografie, vyrovnání světla, odfiltrování mřížky, oddělení barev | ✔ (na poli pixelů) |
| `nacrt3d/vektor.js` | inkoust → tahy: kostra (Zhang–Suen), lomené čáry, čárkované a čerchované čáry | ✔ |
| `nacrt3d/papir.js` | virtuální papír: Pointer Events (myš, dotyk, pero s přítlakem, dlaň), pera, guma, zoom, zpět/vpřed | – |
| `nacrt3d/ui.js` | lišta s nabídkami, panely, 3D náhled (three 0.160), projekty v IndexedDB | – |

## Etapy

- [x] **1. Šablony** (hotovo 11. 11.): `listy.js` (rozvrh tří typů pro A4/A3, značky s kódem, slepá mřížka, legenda, pole),
      tisk do PDF (jsPDF + Liberation Sans) a stejný list na plátně. Stránka s výběrem listu a náhledem.
      Test `_test/nacrt3d_test.js`: kód značek tam i zpět a jednoznačnost při rotacích, zarovnání rámečků na
      mřížku a mezi pohledy, rámečky uvnitř listu a mimo značky.
- [x] **2. Virtuální papír + rozpoznání tahů:** kreslení na listu (pera obrys/skrytá/osa/kóta, guma, zoom,
      zpět), rozpoznání a srovnání tahu po zvednutí pera, přichycení na mřížku, kóta: tah červeně a hned políčko
      na číslo. Test v node na syntetických roztřesených tazích.
      *Hotovo 11. 11.:* `tahy.js` (převzorkování, vyhlazení, kružnice Kåsa, rohy podle zatočení v okně, úseky mezi
      rohy optimálně na úsečky/oblouky dynamickým programováním s chybou jako druhým kritériem, přichycení přes
      skupiny společných x/y), `papir.js` (Pointer Events, dlaň při peru, štípnutí, kolečko, guma, kóta s políčkem,
      zpět/vpřed, mezipaměť pozadí), kresba v `localStorage` `webapp_nacrt3d_vykres`. Úspěšnost na 60 semínkách:
      úsečka, obdélník, kružnice, díra, L, půlkruh, U a stupeň 60/60, silně roztřesený obdélník 45/60.
      Kóta se zatím jen uloží s konci a číslem – přiřazení k hranám (i kóta odsazená vedle hrany) je etapa 3.
- [x] **3. Výklad + řešič:** obrysy a díry po pohledech, automatické vazby, kóty, mezipohledové vazby, řešení
      přes `vazby.js`, ukazatel chybějících kót (volnost). Editor: výběr a oprava prvků, přiřazení kóty.
      *Hotovo 11. 11.:* `vyklad.js` – rovinný graf z tahů pera „obrys“ (spojení konců do 1,2 mm, T-spoje, u rotačního
      listu doplnění úseku po ose, odříznutí visících konců s hlášením), vnější stěna každé souvislé části = obrys,
      vnoření (lichá hloubka = otvor). Vazby: vodorovně/svisle podle kresby, kotva vlevo dole (u tří pohledů v nárysu),
      kóty přiřazené průmětem (vodorovná → vzdalX, svislá → vzdalY, šikmá → délka, přes kružnici ⌀, od středu R,
      u rotačního listu vodorovná od osy = ⌀), mezipohledové svisle/vodorovně mezi body se stejným X (nárys–půdorys)
      a Z (nárys–bokorys). Měřítko kresby = medián poměrů kóta / kresba (už z jediné kóty): kresba se nejdřív celá
      přeškáluje (tvar zůstane), řešič pak dorovná kóty; škáluje se po pohledech kolem kotvy / zadního okraje, aby
      zarovnání zůstalo. Modrý náhled se kreslí zpět v měřítku kresby (`vysledek.zobrazit`), `vysledek.tvary` = skutečné mm.
      (Uživatel 11. 11.: „když přidám kótu, tvar se změní – to je špatně“ → dřívější pravidlo „jen ≥ 2 shodné kóty“ zrušeno.) Rozpor kót, nepřiřazené kóty,
      profil přes osu → Kontrola. Řešič z Modeláře se načítá samostatně (`omez`, `mm` doplňuje vyklad.js).
      UI: vyřešený tvar modře přes kresbu (evenodd = otvory), kóty barevně podle stavu, nástroj Výběr (V) s úchyty
      (body, konce kót, střed a poloměr kružnice), změna pera a Delete, tlačítko Kontrola se seznamem hlášení.
      Hloubka mezi půdorysem a bokorysem se řešičem nespojuje (není typ vazby „stejná vzdálenost v jiné ose“) –
      sjednotí se při stavbě (etapa 4): hloubku určí půdorys, bokorys se přizpůsobí.
*Revize 11. 11. (po etapě 3): 14 nálezů opraveno, zápis v `REVIZE.md`.*

- [x] **4. Stavba 3D:** plochý (vytažení + díry), rotační, tři pohledy (průnik vytažení, díry ze skrytých čar),
      náhled, export STL/3MF/.modelar. **Stránka funguje celá bez focení**, zápis do `apps.js` (vyvoj), ikona, sw.js.
      *Hotovo 11. 11. (na přání „vylepši na profi nástroj“):* `stavba.js` – `N3D.postavTeleso(w, vykres, vyklad)` přes
      manifold (CrossSection EvenOdd = otvory i ostrůvky; plochý extrude o tloušťku (bez ní 5 mm + hlášení), rotační
      revolve s ořezem na r ≥ 0, tři pohledy = průnik vytažených pohledů (nárys podél Y, půdorys podél Z, bokorys podél X;
      stačí dva pohledy), hloubka z půdorysu – nesouhlasný bokorys se přepočte s varováním, díl na desce v počátku,
      počet kusů). UI: panel 🧊 3D (M) vedle papíru s živým náhledem (`SPOJKY_NAHLED`, three r128), rozměry, objem,
      hmotnost podle materiálu, síť; 💾 Export STL / 3MF (`KRAB.stlBinarni` / `soubor3mf`); hlášení stavby v Kontrole;
      📏 tabulka kót (K): přepis čísel, Enter/šipky, 🎯 ukázat. Test `_test/nacrt3d_stavba_test.js` (46 kontrol: uzavřené
      sítě, objemy, orientace, díry, klín, nesouhlasná hloubka, STL/3MF). Díry ze skrytých čar (slepé díry) a `.modelar`
      přesunuty do etap P1 a P7.
*Úprava 11. 11. podle kresby uživatele („jak může být z černého objektu ten modrý?“ + „kóty ať odskočí mimo kresbu“):*
mělký oblouk (< 35°) = rukou prohnutá rovná čára; vodorovné/svislé tětivy oblouků drží konce spolu; měřítko kresby
zvlášť po osách (šířka/výška, u tří pohledů X, Z a hloubka); odhadnuté vodorovně/svisle (id `a…`) ustoupí kótám –
uvolňují se po jedné (37 nahoře / 35 dole = šikmá hrana, ne rozpor); kóta se kreslí mezi měřenými body s vynášecími
čarami a po zadání čísla odskočí 8 mm za obrys (`N3D.umistiKotu`, řazení po 7 mm, kóta výřezu od výřezu, šikmá si
pamatuje body v `m`); příkazy „Odsadit všechny kóty“ (📏) a „Znovu rozpoznat čáry“ (👁, z uložených surových tahů).

*Revize 2 (11. 11.): 7 nálezů opraveno, zápis v `REVIZE.md`.*

### Profi nástroj (přání 11. 11. 2026 „vylepši na profi nástroj“)

- [ ] **P1. Export do Modeláře (`.modelar`):** skica s obrysy a vazbami (kóty jako kóty skici, y nahoru, otočené
      vyboulení), plochý = vytažení, rotační = rotace, tři pohledy = skupina „průnik“ tří skic; ověřit jádrem Modeláře v node
      (stejný objem jako `postavTeleso`).
- [ ] **P2. Projekty:** víc výkresů v IndexedDB (název, náhled, datum), uložit/otevřít soubor `.nacrt3d.json`, název v hlavičce
      listu i v názvu exportu.
- [x] **P3. Přesné kreslení:** během tahu úsečky zadat délku/úhel z klávesnice, nástroje obdélník / kružnice / oblouk
      s rozměrem, vlastní krok mřížky (1 / 2,5 / 5 / 10 mm).
      *Hotovo 11. 11. (přání „víc nástrojů pro kreslení“):* `nastroje.js` (bez DOM) – `tvarZBodu`, `ciselneZadani`
      (úsečka „40“ / „40<30“, obdélník „40x20“, kružnice/díra průměr – zadané číslo = kóta s `umistit`),
      `vybouleniTriBody`. Pero (obrys/skrytá/osa, klávesy 1–3) je oddělené od nástroje (`nast.pero`; staré
      `nastroj: 'obrys'` se převede na `ruka`). Nástroje ✍️ ruka Q, ╱ úsečka L (klikáním lomená, Enter/dvojklik konec, klik
      na první bod uzavře, Backspace, Esc), ▭ obdélník O, ◯ kružnice C, ⊕ díra s osami D, ◠ oblouk 3 body A; tažení
      i klik-klik, přichycení k bodům a na krok (👁 Zobrazit → Krok), živý rozměr u kurzoru.
- [x] **P4. Úpravy výběru:** výběr obdélníkem a Shiftem, posun, kopie, zrcadlení podle osy, pole (vzor děr), zaoblení
      a zkosení rohu (R/C kóta), ořez a prodloužení čáry k jiné.
      *Hotovo 11. 11. kromě ořezu/prodloužení a R/C kóty:* `model.vybrane` je pole id; výběr klepnutím, Shiftem a rámem,
      posun tažením s přichycením taženého bodu, šipky 1 / 5 mm, Ctrl+D kopie, Ctrl+A, ⇋ ⇵ zrcadlení na místě, 🪞 kopie
      podle vybrané osy, ▦ pole (Dialog.zeptej „nx ny dx dy“); ◜ Roh: zaoblení R / zkosení X (`N3D.upravRoh`, i roh ze
      dvou čar se společným koncem – zkrátí je a přidá oblouk), políčko až po puštění myši (fokus).
      Výklad: kotva pro každou skupinu obrysů spojenou kótami (díl roste doprava nahoru, ne na obě strany);
      kóta přesně sedící s kresbou (±2 %) = měřítko 1 : 1 v té ose.
- [x] **P4b. Vodicí linky, chytré přichytávání, měření, odsazení, ořez** (přání 11. 11. „vodicí lišty, snapování a další
      užitečné nástroje“): `geom.js` (primitiva úsečka/oblouk/kružnice/přímka s parametrem t, průsečíky, nejbližší bod),
      `prichyt.js` (`pripravPrichyt` – konce, středy úseček a oblouků, středy a kvadranty kružnic, průsečíky O(n²) do 700
      primitiv; `chytBod` – pořadí body → vodicí linka → zarovnání s body (stopy) → na čáře → úhel po 15° → mřížka,
      volby po druzích, Alt vypne), mezipaměť podle `model.verze` (během tažení se nepřepočítává). Vodicí linky
      `vykres.voditka [{id, a, u}]` (nepočítají se do 3D, jsou ve zpět/vpřed, maže je guma), nástroj ┼ (G): klepnutí =
      vodorovná + svislá, tažení = směr po 15°. 📐 měření (U). `nastroje.js`: `odsad` (ekvidistanta s ostrými rohy mezi
      úsečkami, oblouky se stejným středem), `orizni` (úsečka / oblouk / kružnice / uzavřená čára mezi průsečíky, i
      s vodicími linkami), `prodluz` (Shift u ořezu). Nabídka 🧲 Přichytávání (volby, krok, vodicí linky). rovnoběžně, kolmo, stejná délka, symetrie podle osy, tečna, soustředně;
      ikony vazeb u hran, referenční (neřídící) kóty, úhlová kóta.
- [ ] **P6. Čistý výkres:** PDF/SVG/DXF z vyřešené geometrie (pohledy, kóty, razítko, izometrie z 3D).
- [ ] **P7. Slepé díry a kapsy ze skrytých čar** (hloubka z druhého pohledu), závit M (symbol), sražení hran.

- [ ] **5. Fotka → narovnaný list:** soubor nebo fotoaparát, značky, homografie, vyrovnání osvětlení, odfiltrování
      mřížky, oddělení černé a červené. Test na syntetických „fotkách“ (vykreslený list + perspektiva, stín, šum,
      JPEG). Pak 3–5 skutečných fotek od uživatele.
- [ ] **6. Vektorizace fotky:** inkoust → tahy (kostra, lomené čáry, typy čar), napojení na etapu 2–3.
- [ ] **7. Kóty z fotky:** kótovací čáry a šipky (červené i jednobarevné), výřez čísla a rychlé zadání (Tab, číslo, Tab).
- [ ] **8. Kontrola a překryv:** rozpory mezi pohledy, chybějící a nadbytečné kóty, model promítnutý zpět přes list.
- [ ] **9. Učesat:** tlačítko s animací. Tvary doskočí na srovnané, rukopis (poznámky) se uhladí: účaří, výška,
      sklon, rozestupy a vyhlazení třesu, písmena ale zůstanou uživatelova.
- [ ] **10. Ručně psané kóty (volitelné):** vlastní rozpoznávač číslic typu $P se vzory od uživatele (IndexedDB),
      jen pro virtuální papír.
- [ ] **11. Dokončení:** projekty v IndexedDB, nápověda „Jak kreslit“ s ukázkami, i18n, test UI v headless
      prohlížeči (tahy přehrané skutečnými událostmi ukazatele), revize.
- [ ] **12. Později:** šikmé plochy a obecná rekonstrukce ze tří pohledů (Wesley–Markowsky), zkosení, zaoblení,
      závity, kapsy s hloubkou, další typy listů.

## Testy

- `_test/nacrt3d_test.js` (node): listy a značky, rozpoznání tahů, výklad, řešič, stavba (rozměry, objem, těsnost sítě).
- `_test/nacrt3d_tahy_gen.js`: generátor roztřesených tahů (šum, vlnění, přetah na koncích), semínko → opakovatelné.
- Generátor syntetických skic: známý díl → roztřesené tahy (šum, přetahy, nedotažené rohy) → pro fotku navíc
  vykreslení a „vyfocení“. Stejná sada slouží virtuálnímu papíru i fotce.
- UI: `_test/nacrt3d_ui.py [složka]` (WebDriver): PDF všech listů do složky, kreslení myší / perem / štípnutí
  dvěma prsty přes `/actions`, kóta s číslem, Escape, zpět/vpřed, guma, obnovení po načtení, snímek `papir.png`.

## Rizika a meze

- Ruční kresba bez mřížky a bez kót dá jen orientační model.
- Volné tvary (organické, ergonomické) nejsou cílem.
- Foto: lesklý papír, silný stín a modré pero blízko barvy mřížky zhorší čištění. Pero musí být tmavší než mřížka.

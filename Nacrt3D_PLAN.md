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
9. Nová stránka v `apps.js` se zapíše se stavem `"vyvoj"`, až bude použitelná (po etapě 4).

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
      a Z (nárys–bokorys). Měřítko kresby: jen když se ≥ 2 kóty shodnou (±10 %) – jedna kóta mění jen svůj rozměr;
      škáluje se po pohledech kolem kotvy / zadního okraje, aby zarovnání zůstalo. Rozpor kót, nepřiřazené kóty,
      profil přes osu → Kontrola. Řešič z Modeláře se načítá samostatně (`omez`, `mm` doplňuje vyklad.js).
      UI: vyřešený tvar modře přes kresbu (evenodd = otvory), kóty barevně podle stavu, nástroj Výběr (V) s úchyty
      (body, konce kót, střed a poloměr kružnice), změna pera a Delete, tlačítko Kontrola se seznamem hlášení.
      Hloubka mezi půdorysem a bokorysem se řešičem nespojuje (není typ vazby „stejná vzdálenost v jiné ose“) –
      sjednotí se při stavbě (etapa 4): hloubku určí půdorys, bokorys se přizpůsobí.
*Revize 11. 11. (po etapě 3): 14 nálezů opraveno, zápis v `REVIZE.md`.*

- [ ] **4. Stavba 3D:** plochý (vytažení + díry), rotační, tři pohledy (průnik vytažení, díry ze skrytých čar),
      náhled, export STL/3MF/.modelar. **Stránka funguje celá bez focení**, zápis do `apps.js` (vyvoj), ikona, sw.js.
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

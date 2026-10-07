# 🚁 Nad krajinou: simulátor letu dronem — návrh

*Návrh ke schválení, verze 7. 10. 2026. Kódová jména souborů a jmenného prostoru jsou návrh.
Nic se zatím neprogramuje, dokud nejsou zodpovězené otevřené otázky v kapitole 14.*

Nad krajinou je simulátor letu kvadrokoptérou v **3D krajině, která má vypadat přirozeně**:
kopce s lesy, louky s trávou, která se vlní ve větru, řeka a jezero s odrazy oblohy, vesnice,
mraky a světlo, které se mění podle denní doby. Hráč létá volně, plní fotografické mise, učí se
létat v kurzu, nebo závodí brankami jako FPV pilot.

Fyzika je skutečná (tah čtyř motorů, setrvačnost, odpor vzduchu, vítr, baterie), ale s volitelnou
asistencí, takže si zalétá začátečník s klávesnicí i pilot s vysílačkou v režimu Acro.

---

## Obsah

1. [Hlavní rozhodnutí](#1-hlavní-rozhodnutí)
2. [Jak dosáhnout přirozené grafiky](#2-jak-dosáhnout-přirozené-grafiky)
3. [Krajina: generátor ze seedu](#3-krajina-generátor-ze-seedu)
4. [Dron a fyzika](#4-dron-a-fyzika)
5. [Letové režimy](#5-letové-režimy)
6. [Kamery](#6-kamery)
7. [Ovládání](#7-ovládání)
8. [Herní režimy](#8-herní-režimy)
9. [Počasí a denní doba](#9-počasí-a-denní-doba)
10. [Zvuk](#10-zvuk)
11. [Rozhraní a OSD](#11-rozhraní-a-osd)
12. [Technické řešení a výkon](#12-technické-řešení-a-výkon)
13. [Postup vývoje po etapách](#13-postup-vývoje-po-etapách)
14. [Otevřené otázky](#14-otevřené-otázky)

---

## 1. Hlavní rozhodnutí

| Oblast | Návrh |
|---|---|
| Engine | **Three.js r160** z `obsah/lib/three.0.160.0.min.js` (už je na webu), WebGL2, bez build kroku |
| Svět | Jedna souvislá krajina cca **4 × 4 km** generovaná ze seedu, okraj zamlžený do dálky |
| Styl | Realistický, ne kreslený: fyzikálně založené osvětlení (PBR), atmosférický rozptyl, mlha s výškou |
| Fyzika | Vlastní model kvadrokoptéry, pevný krok 240 Hz, oddělený od vykreslování |
| Ovládání | Klávesnice, gamepad, **RC vysílačka přes USB** (Gamepad API), dotyk na mobilu |
| Cíl výkonu | 60 fps na běžném notebooku s integrovanou grafikou v nastavení „Střední“ |
| Offline | Ano, přes `sw.js` jako ostatní hry |

## 2. Jak dosáhnout přirozené grafiky

Přirozený dojem nedělá jedna věc, ale souhra několika. Seřazeno podle toho, kolik přinesou:

1. **Světlo a atmosféra.** Obloha z modelu rozptylu (Rayleigh + Mie), slunce podle denní doby,
   **vzdušná perspektiva**: vzdálené kopce modrají a ztrácejí kontrast. Výšková mlha v údolích ráno.
   Tónování ACES, správné sRGB. Tohle samo udělá z šedivé krajiny fotku.
2. **Terén s texturami podle sklonu a výšky.** Tráva na rovině, hlína a kamení ve svazích,
   skála na srázech, písek a bahno u vody. Textury se míchají měkce (podle šumu, ne ostrou hranou)
   a mapují se triplanárně, aby se skála ve svahu netáhla. Detailní normálová mapa zblízka,
   makro variace barvy z dálky, aby se textura neopakovala dlaždicově.
3. **Vegetace.** Stromy (smrk, borovice, buk, bříza) jako instancované modely zblízka a
   **impostory** (předrenderované obrázky z 8 úhlů) v dálce. Tráva jako instancované stébla do
   ~60 m kolem dronu, pohyb ve větru, a **proplach od vrtulí** — když dron letí nízko, tráva pod ním
   se rozvlní do kruhu. Kameny, keře, polní květiny.
4. **Stíny.** Kaskádové stínové mapy (2–3 kaskády), aby měl stín i strom zblízka i les v dálce.
   Stín dronu na zemi (pomáhá odhadu výšky, skutečně důležité pro pocit z letu).
5. **Voda.** Řeka a jezero s odrazem oblohy a okolí, Fresnel (shora průhledná, pod úhlem zrcadlo),
   animované vlnky, pěna u břehu, barva podle hloubky. Při nízkém letu zčeření od vrtulí.
6. **Mraky.** Vrstva kupovitých mraků raymarchovaná v nízkém rozlišení a stíny mraků
   přebíhající po krajině (velmi levný a velmi účinný trik).
7. **Kamera jako kamera.** FPV kamera s lehkým soudkovým zkreslením a širokým úhlem,
   kinematografická kamera s expozicí, jemný bloom proti slunci, odlesk objektivu, volitelně
   „analogový“ FPV šum a zrnění.

### Textury: dvě možnosti

- **A) Fotografické CC0 textury** (Poly Haven / ambientCG, licence CC0, rozlišení 1k) —
  tráva, hlína, skála, písek, kůra, listí. Celkem cca **4–6 MB**. Výrazně realističtější.
- **B) Plně procedurální** — textury se vygenerují v prohlížeči při startu. Nula MB navíc,
  ale zblízka působí „počítačově“.

Doporučuji **A**, s B jako zálohou pro nejnižší nastavení. Viz otázka 3.

## 3. Krajina: generátor ze seedu

- **Výšková mapa** z vrstveného šumu (fBm + ridged pro hřebeny) a pak **zjednodušená hydraulická
  eroze** (stovky tisíc kapek, počítá se jednou při generování ve Web Workeru, ~2–4 s). Eroze je to,
  co dělá z šumu skutečnou krajinu: rýhy ve svazích, naplavené dno údolí.
- **Řeka** teče po spádu z hor do jezera, koryto se do terénu vyhloubí.
- **Biomy** podle výšky, sklonu a vlhkosti: les ve svazích, louky a pole v údolí, kosodřevina a
  skály nahoře.
- **Lidská stopa:** malá vesnice (kostel, domy, stodoly), polní cesty, ohrady, balíky sena,
  elektrické vedení (překážka!), rozhledna na kopci. Domy jsou jednoduché modely skládané
  v kódu, ne stažené.
- **LOD terénu:** dlaždicový terén s úrovněmi detailu (blízko hustá síť, daleko řídká) a plynulým
  prolnutím, aby nebylo vidět „přeskakování“.
- Stejný seed = stejná krajina. Navrhuji několik pojmenovaných map (např. *Údolí*, *Jezero*,
  *Hřebeny*) + náhodnou.

## 4. Dron a fyzika

Model, ne animace. Dron je tuhé těleso se čtyřmi motory:

- Každý motor má **tah ∝ otáčky²** a zpoždění roztočení (motor nereaguje okamžitě).
- Momenty: náklon z rozdílu tahů, otáčení (yaw) z reakčního momentu vrtulí.
- **Odpor vzduchu** lineární i kvadratický, jiný zepředu a shora.
- **Vítr a nárazy** (šum v čase i prostoru), turbulence za kopci a budovami.
- **Přízemní efekt** — těsně nad zemí dron „plave“ na polštáři.
- **Baterie:** napětí klesá s odběrem, při vysokém tahu propad (voltage sag), dron slábne.
- **Srážky:** lehký náraz = odraz a ztráta vrtule (dron se točí), tvrdý = havárie.
  Kolize s terénem, stromy (kmen + koruna jako zjednodušené tvary), budovy, dráty.
- Typy dronů:
  1. **Kamerový dron** (jako DJI Mini/Air) — klidný, stabilní, GPS, 30 min baterie.
  2. **FPV freestyle 5"** — lehký, silný, Acro, 4 min baterie.
  3. **Cinewhoop** — malý s ochranou vrtulí, pro průlety mezi stromy a budovami.

## 5. Letové režimy

| Režim | Pro koho | Chování |
|---|---|---|
| **Pozice (GPS)** | začátečník, kamerový dron | Puštěné páky = dron stojí na místě a drží výšku, kompenzuje vítr |
| **Úhel (Angle)** | mírně pokročilý | Páka = náklon, max. 35°, samo se vyrovná, výšku drží pilot |
| **Horizont** | přechod | Jako Úhel, při plné páce udělá přemet |
| **Acro** | FPV pilot | Páka = rychlost otáčení (rates jako v Betaflightu: RC rate, super rate, expo), nic se samo nevyrovná |

Plus **Návrat domů** (RTH) při slabé baterii u kamerového dronu.

## 6. Kamery

- **FPV** — z dronu, náklon kamery nastavitelný 0–45°, široký úhel.
- **Gimbal** — stabilizovaná kamera kamerového dronu, ovládaný náklon, režim fotek.
- **Za dronem** (chase) — pro začátečníky.
- **Pilot na zemi (LOS)** — pohled z místa, kde stojí pilot, a dron vidí jako tečku na obloze.
  Užitečné pro trénink skutečného létání na dohled.
- **Přehrávání** — záznam letu a jeho přehrání s volnou kamerou, zpomalením a filmovou kamerou
  po křivce. Export snímku jako PNG.

## 7. Ovládání

- **Klávesnice** (Mode 2): W/S plyn, A/D yaw, šipky náklon. U kláves se páka „vrací“ plynule.
- **Gamepad** — dvě páky, s mrtvou zónou a expo.
- **RC vysílačka přes USB** (RadioMaster, Jumper, FrSky… v režimu joysticku) — průvodce
  kalibrací: pohni pákami, přiřaď kanály, přepínač na režim a na „arm“.
- **Myš** volitelně pro kameru v přehrávání.
- **Dotyk** — dvě virtuální páky na mobilu (jen ve vybraných nastaveních grafiky).
- Mode 1/2 přepínatelné, zbraně nejsou :)

## 8. Herní režimy

1. **Volný let** — vybereš mapu, dron, denní dobu, počasí a letíš.
2. **Letová škola** — 10 krátkých lekcí: vzlet a vznášení, přistání na plošině, osmička kolem
   kůlů, let v protivětru, orientace když dron letí k tobě, nouzové přistání se slabou baterií,
   první let v Acru… Hodnocení hvězdičkami.
3. **Fotomise** — „vyfoť kostel s jezerem v pozadí ze zlaté hodiny“, „najdi stádo srnek
   v lese“, „prolétni pod mostem“. Hodnotí se kompozice (objekt v záběru, třetiny), klidný záběr,
   čas a baterie.
4. **Závod brankami** — FPV tratě v krajině (les, kolem kostela, kaňonem řeky), časovka s **duchem**
   nejlepšího kola, rekordy přes `rekord.js`.
5. **Hledání** (volitelné) — sběr předmětů po krajině / pátrání po ztraceném turistovi s termokamerou.

## 9. Počasí a denní doba

- Denní doba posuvníkem: svítání (mlha v údolích), poledne, **zlatá hodina**, soumrak.
- Oblačnost: jasno / polojasno / zataženo; vítr 0–12 m/s s nárazy.
- Volitelně déšť (kapky na kameře FPV) a mlha.
- Noc s osvětlenou vesnicí a světly na dronu jako bonus v poslední etapě.

## 10. Zvuk

Všechno syntetizované přes Web Audio, žádné soubory:

- **Motory**: čtyři oscilátory s frekvencí podle otáček + šum vrtulí; mění se s plynem, při
  rychlém klesání typické „bublání“ (prop wash).
- Vítr podle rychlosti, ptáci a cvrčci podle denní doby, šumění lesa, potok u řeky.
- Zvuk se tlumí se vzdáleností v pohledu z LOS kamery.

## 11. Rozhraní a OSD

- **OSD jako v Betaflightu** v FPV režimu: napětí, čas letu, výška, rychlost, umělý horizont,
  šipka domů.
- **Kamerový HUD** jako DJI aplikace: výška, vzdálenost, rychlost, baterie, mapa v rohu.
- Hlavní menu: mapa, dron, režim, počasí, ovládání, grafika.
- Nastavení grafiky: **Nízká / Střední / Vysoká / Ultra** + automatické snížení, když fps padá.
- Barevné téma webu přes `theme.js` jen v menu; samotná hra je vždy „fotografická“.

## 12. Technické řešení a výkon

`obsah/dron.html` + `obsah/dron/*.js` (obyčejné skripty, jmenný prostor `DRON`):

| Soubor | Obsah | Běží v node |
|---|---|---|
| `nahoda.js`, `sum.js` | seedovaná náhoda, šum (simplex, fBm) | ano |
| `teren.js` | výšková mapa, eroze, řeka, biomy, rozmístění objektů | ano |
| `teren_worker.js` | generování ve Web Workeru | — |
| `fyzika.js` | model dronu, motory, vítr, baterie, kolize | ano |
| `rizeni.js` | letové režimy, PID, rates | ano |
| `vstup.js` | klávesnice, gamepad, vysílačka, dotyk, kalibrace | — |
| `scena.js` | Three.js scéna, LOD terénu, materiály | — |
| `obloha.js` | atmosféra, slunce, mraky, mlha | — |
| `voda.js`, `vegetace.js`, `stavby.js` | voda, stromy/tráva/impostory, vesnice | — |
| `kamera.js`, `post.js` | kamery, postprocessing | — |
| `zvuk.js`, `osd.js`, `mise.js`, `ui.js` | zvuk, OSD/HUD, režimy, menu | částečně |

- Shadery vlastní (`ShaderMaterial` / `onBeforeCompile` nad `MeshStandardMaterial`).
- Fyzika s pevným krokem, vykreslování interpolované — let je stejný při 30 i 144 fps.
- Terén a eroze ve Workeru, aby stránka nezamrzla.
- Stránka nesmí žrát paměť: textury se sdílí, instancování, uvolňování dlaždic mimo dosah.

### Testy

- `_test/dron_fyzika.js` (node): vznášení je stabilní, v Úhlu náklon nepřekročí limit, v GPS dron
  ve větru drží pozici, baterie se vybije v očekávaném čase, determinismus se seedem.
- `_test/dron_teren.js` (node): eroze, řeka teče dolů a ústí do jezera, startovní plocha je rovná.
- `_test/dron_bot.js`: autopilot proletí závodní trať a lekce (ověří, že jsou průchozí).
- `_test/dron_snimek.py`: headless snímky v několika denních dobách + měření fps. Jeden Chromium
  s limity paměti, postupně, a pozor, headless běží v DPI 1.

## 13. Postup vývoje po etapách

- [ ] 1. **Fyzika a ovládání** — dron na šedé rovině s mřížkou, všechny letové režimy, klávesnice
       a gamepad, FPV + chase kamera, testy fyziky. *(Tady se rozhodne, jestli „to létá dobře“.)*
- [ ] 2. **Terén** — generátor s erozí ve Workeru, LOD, kolize s terénem.
- [ ] 3. **Světlo a obloha** — atmosféra, slunce, vzdušná perspektiva, mlha, stíny, tónování.
- [ ] 4. **Materiály terénu** — míchání textur podle sklonu/výšky, triplanár, makro variace.
- [ ] 5. **Voda** — řeka a jezero, odrazy, Fresnel, břehy.
- [ ] 6. **Vegetace** — stromy s impostory, tráva s větrem a proplachem vrtulí, kameny.
- [ ] 7. **Vesnice a překážky** — domy, kostel, most, dráty, rozhledna; kolize.
- [ ] 8. **Mraky, počasí, denní doba** — mraky a jejich stíny, vítr, déšť, posuvník času.
- [ ] 9. **Kamery, OSD, přehrávání** — gimbal, LOS, záznam a přehrání, fotky.
- [ ] 10. **Herní režimy** — letová škola, fotomise, závody s duchem, rekordy.
- [ ] 11. **Zvuk, vysílačka, mobil** — syntéza motorů, kalibrace RC, dotyk.
- [ ] 12. **Ladění** — nastavení grafiky, automatický výkon, bot, offline, nápověda, revize.

Po každé etapě headless snímek a krátké ověření, jako u ostatních her.

## 14. Otevřené otázky

1. **Název** — „Nad krajinou“? Jiné nápady: „Dronem nad údolím“, „Vzdušná čára“, „Ptačí perspektiva“.
2. **Typ krajiny** — česká vrchovina (kopce, lesy, vesnice, rybník) jako výchozí? Nebo spíš
   hory/Alpy, pobřeží, nebo víc map různého typu?
3. **Textury** — smím stáhnout **CC0 fotografické textury** (cca 4–6 MB do `obsah/dron/tex/`),
   nebo vše procedurálně bez stahování?
4. **Míra realismu** — hlavně **simulátor** (výchozí fyzika věrná, asistence volitelná),
   nebo spíš **pohodová hra** (arkádovější, odpouštějící)? Návrh: simulátor s asistencemi.
5. **Hlavní zaměření** — kamerový dron a focení krajiny, **FPV** závody/freestyle, nebo obojí
   rovnocenně? Návrh: obojí, ale etapy 1–9 se ladí hlavně na pocit z letu a krásu krajiny.
6. **Cílový hardware** — na čem to hlavně poběží? Mobil ano/ne? (Mobil výrazně omezí grafiku.)
7. **Vysílačka** — máš RC vysílačku, na které by šlo USB ovládání odzkoušet? Pokud ne, udělám
   ji podle standardu a otestuje se jen gamepad/klávesnice.
8. **Živí tvorové** — srnky, ptáci, krávy na pastvě jako oživení krajiny? (Přidá to dojem
   „živé přírody“, ale je to práce navíc — návrh: ano, v jednoduché podobě v etapě 7.)

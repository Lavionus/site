# Plán: ♾️ Laboratoř nemožných tvarů (od 20. 10. 2026)

Vzdělávací 3D laboratoř v prohlížeči. Zobrazuje paradoxní tělesa, neorientovatelné plochy, uzly, minimální
plochy, fraktály a optické iluze. **Každý objekt se počítá ze vzorce nebo z konstrukce přímo v aplikaci.**
Žádné předem připravené modely se nenačítají.

Hlavní zásada je **poctivost**. Každý objekt nese štítek přesnosti. Vlastnosti jako Eulerova
charakteristika, orientovatelnost, počet okrajů, plocha, objem, křivost nebo počet rovnovážných poloh se
**měří na vygenerované síti** a porovnávají s teoretickou hodnotou. Nikde nejsou jen napsané v textu.

## Stav (21. 10. 2026): etapy 1–10 hotové + rozšíření

### Rozšíření (21. 10. 2026)
- Etapa 10 (`objekty/fyzika.js`, skupina „Tělesa se zvláštními fyzikálními vlastnostmi“):
  - **Tělesa konstantní šířky:** Reuleauxův čtyřstěn (není konstantní šířky, max (√3 − √2/2)s), dvě Meissnerova tělesa
    a hladká tělesa z opěrné funkce s/2 + ε·xyz (konvexní do ε ≈ 0,919, změřeno). Meissner = průnik koulí o poloměru s se středy
    ve vrcholech a ve všech bodech tří ostrých hran (odvozeno z podmínky konstantní šířky). Ověřeno objemem (Kawohl–Weber),
    šířkou ve 2 000 směrech a Blaschkeho vztahem. Tlačítko „Otáčet mezi deskami“.
  - **Oloid a valivá tělesa ze dvou kružnic:** přesné povrchové přímky, tan²α = (1 − d cos t)² − cos²t. Povrch 4π, objem 3,0524.
    Výška těžiště při valení: oloid 1/√2 … 3/4, těleso d = √2 konstantní. Tlačítko „Valit po stole“.
  - **Sférikon a dvojkužel:** konstantní výška těžiště r/√2.
- `objekty/rozsireni.js`:
  - **Hopfova fibrace:** číslo spletení vláken změřené Gaussovým integrálem (±1).
  - **Trojperiodické plochy P, D, gyroid** (nový štítek 🟡 aproximace, nodální aproximace). Měří se odchylka |H| od nuly
    (P 14,5 %, D 3,0 %, gyroid 2,1 % vůči √|K|) a rod na periodické buňce (3, 9, 5 – shoda s teorií).
  - **Amesův pokoj:** projektivní zobrazení P/(1 + w·P), kouzelný pohled = kukátko.
- Sdílené: `N.surfaceNets` v jádře (i periodické), `N.orientaceDolu` + `N.prehrajNaStole` (animace na stole), `Pohled.deska`.
- Možné další kroky: keltský kámen (simulace valení bez prokluzu s převrácením rotace), přesný gyroid z Weierstrassovy reprezentace.

### Etapy 1–9

- Stránka `obsah/nemozne.html`, v `apps.js` v sekci 🧪 Simulace & věda se stavem `vyvoj`, cache `sw.js` v441.
- 26 objektů: torus, Möbius, Klein (2 imerze), Boy, Římská plocha, trojlístek, osmičkový uzel, torusový uzel (p, q),
  catenoid, helicoid, catenoid ↔ helicoid, Enneper, Costa, Dini, Gabrielův roh, Gömböc (+ elipsoid a kostka pro srovnání),
  Menger, Sierpiński, Koch, Mandelbulb, Penroseův trojúhelník, nemožné schodiště, Sugiharův válec.
- Testy: `node _test/nemozne_jadro.js` (938 kontrol), `python3 _test/nemozne_ui.py [dpi]` (skutečná myš),
  `python3 _test/nemozne_snimek.py [dpi] [objekt[:parametry][@JS]]…` (snímky + kontrola ✘ v tabulce).

### Zjištění a rozhodnutí během práce
- **Gömböc:** použit analytický tvar M. L. Sloana (arXiv:2306.14914): r⁴ = 1 + 4ε sin θ cos(φ − P(θ)). Těžiště a {S, U, H} = {1, 1, 0}
  vychází přesně. Sloanova mez konvexity (ε ≤ 0,15 / 0,17) ale **neplatí**: naše měření dává ε ≲ 0,0323 (P = 5θ)
  a ε ≲ 0,0355 (druhá varianta). Shoduje se to s T. Couey (arXiv:2604.17120: β ≲ 0,036; při 0,05 je K_min = −0,569 a 4 % povrchu).
  Zelený štítek dostane tvar jen po ověření všech tří podmínek, jinak je červený.
- Počítání rovnováh na mřížce dává v plochých šikmých údolích falešná minima (17 místo 1). Proto mřížka slouží jen pro kandidáty,
  pak následuje Newton na ∇g = 0, sloučení bodů a kontrola Poincaré–Hopf.
- Kutálení po stole musí běžet po **hladkém** tělese. Opěrná funkce mnohostěnu z bodů dávala u Gömböcu 2 koncové polohy.
- Costova plocha: ℘ a ζ z theta řad (q = e^−π), ořez válcem s bisekcí hran (`N.orizni`). Rod Mengerovy houby je odvozený
  rekurencí χ(Mₙ₊₁) = 20χ(Mₙ) − 24χ(Kₙ).
- Nemožné schodiště: ramena různé délky (posun (H, H, H) ∥ izometrický pohled). Rovnoměrný posun všech schodů dával plochý obraz.
- Penroseův trojúhelník: svislý trám je seříznutý rovinou z = y − w, která obsahuje směr pohledu.

## Rozhodnutí (návrh, potvrdí uživatel)

1. **Název:** ♾️ Laboratoř nemožných tvarů. Soubory budou `obsah/nemozne.html` a `obsah/nemozne/*.js`,
   jmenný prostor `NEM`.
2. **Sekce v katalogu:** 🧪 Simulace & věda. V `apps.js` bude `"stav": "vyvoj"`.
3. **Platforma:** čistý JS bez sestavování. Three.js 0.160 z `obsah/lib/three-0.160/`. Ovládání kamery bude
   vlastní, malé (orbit + posun + zoom, i dotykem), podobně jako v Modeláři. Ortografická i perspektivní
   kamera jsou potřeba kvůli iluzím.
4. **Těžké výpočty poběží ve Web Workeru:** Mandelbulb, Menger od úrovně 4, hledání samoprůniků, Costa a
   počítání rovnováh Gömböcu. Rozhraní nesmí zamrznout.
5. **Licence:** vlastní kód, three.js je MIT. Vzorce jsou matematika a nejsou chráněné. Zdroje vzorců se
   uvedou u každého objektu.

## Štítek přesnosti (povinný u každého objektu)

| Štítek | Význam | Objekty |
|---|---|---|
| 🟢 **Přesná parametrizace** | Vzorec přesně definuje plochu. Chyba vzniká jen vzorkováním do sítě (rozlišení je uvedené). | torus, Möbius, Klein, Boy (Bryant–Kusner), Římská plocha, uzly, catenoid, helicoid, Enneper, Dini, Gabrielův roh (useknutý) |
| 🔵 **Numerický výpočet přesné definice** | Definice je přesná, ale počítá se numericky (eliptické funkce, iterace, izoplocha). Uvede se odhad chyby. | Costa (Weierstrassovy ℘, ζ), Mandelbulb (síť z izoplochy) |
| 🟣 **Konečná iterace fraktálu** | Zobrazuje se n-tá úroveň. Limitní objekt zobrazit nelze, jeho vlastnosti se ukazují jako limita čísel. | Menger, Sierpiński, Koch |
| 🟠 **Přesná konstrukce iluze** | Skutečné 3D těleso, které z vypočteného směru pohledu vytváří iluzi. | Penrose, schodiště, Sugiharův válec |
| 🔴 **Ilustrativní model** | Tvar jen připomíná skutečný objekt. Požadovanou vlastnost **nemá** nebo nebyla ověřena. | Gömböc, dokud ho neověří kontrola z etapy 6 |

Štítek je vidět vždy, ne až v nápovědě. U 🔴 je červený pruh s vysvětlením.

## Architektura

```
obsah/nemozne.html          – rozvržení: seznam objektů | 3D pohled | parametry + vlastnosti + teorie
obsah/nemozne/
  jadro.js      – vzorkovač parametrických ploch (u,v) s TOPOLOGICKÝM sešitím švů:
                  periodické, periodické s převrácením (Möbius, Klein), antipodální (RP²)
                  → svaruje se podle parametru, NE podle polohy (poloha by slila i čáry samoprůniku)
  trubka.js     – trubka kolem křivky s rotačně minimálním rámem (bez zkrucování Frenetova rámu)
  implicit.js   – marching cubes pro izoplochy (Mandelbulb export)
  topologie.js  – χ = V − E + F, kontrola orientovatelnosti (BFS po trojúhelnících),
                  počet okrajových křivek, rod, malování strany přes dvojité pokrytí
  merici.js     – plocha, objem (věta o divergenci), diskrétní K (úhlový defekt), H (kotangentový Laplace),
                  K a H i analyticky z parametrizace (centrální diference)
  pruniky.js    – samoprůniky (trojúhelník × trojúhelník přes prostorovou mřížku) → čáry průniku
  rovnovaha.js  – opěrná funkce h(n) vůči těžišti, kritické body na jemné ikosféře směrů,
                  kontrola Poincaré–Hopf (S − H + U = 2), kvazistatické kutálení
  objekty/*.js  – jeden soubor na skupinu, každý objekt je záznam:
                  { id, nazev, skupina, stitek, parametry:[schema pro posuvníky],
                    generuj(p) → {sit, krivky?, meta}, teorie:{χ, orient, okraje, …}, zdroje:[…], text }
  pohled.js     – three.js scéna, kamery, materiály (různé barvy přední a zadní strany),
                  barevná mapa křivosti, řez rovinou, průhlednost, drátěný model, šachovnice (u,v)
  ui.js         – seznam, posuvníky ze schématu, panel vlastností (měřeno vs. teorie ✔/✘), URL hash
  export.js     – STL / OBJ / GLB / PNG, zesílení plochy pro 3D tisk
  worker.js     – těžké výpočty
```

**Panel vlastností** je jádro výuky. Například: *„χ změřeno 0, teorie 0 ✔ · neorientovatelná ✔ · okraje 1 ✔ ·
plocha 12,57 · samoprůniky: žádné“*.

## Etapy

### Etapa 1 – Kostra a jádro
- Stránka, 3D pohled, vlastní orbitální ovládání, posuvníky generované ze schématu, štítek přesnosti.
- `jadro.js` (sešívání švů), `topologie.js`, `merici.js` (plocha, objem, χ, orientovatelnost, okraje).
- Objekty: **torus** (R, r) a **Möbiova páska** (poloměr, šířka, počet půlotáček n).
  U Möbiovy pásky se ukáže, že liché n dává 1 okraj a neorientovatelnou plochu, sudé n 2 okraje a
  orientovatelnou plochu. Měří se to, nevypisuje.
- Testy: `_test/nemozne_jadro.js` (node), `_test/nemozne_ui.py` (headless, DPI 1 i 2).

### Etapa 2 – Neorientovatelné plochy
- **Kleinova láhev**: klasická „láhev“ a imerze „osmička“. Upozornění, že v ℝ³ jde jen o imerzi, ne o vnoření.
- **Boyova plocha**: parametrizace Bryant–Kusner (přesná, racionální v komplexní proměnné).
- **Římská plocha** (Steiner): obraz sféry (x,y,z) ↦ (yz, xz, xy). Má 6 zaštípnutých bodů a není imerze.
- **Čáry samoprůniku** zvýrazněné (`pruniky.js`). U Costy a torusu se naopak ukáže, že průnik je prázdný.
- **Malování strany:** klik na plochu spustí animované šíření barvy po jedné straně. Na Möbiovi a Kleinovi
  barva přejde na rub výchozího místa a obarví všechno.
- **Mravenec:** bod s normálou obejde střední kružnici. Po jednom oběhu má normálu převrácenou.

### Etapa 3 – Uzly
- **Trojlístek** (tloušťka) a **torusový uzel (p, q)**. Pro NSD(p,q) = d > 1 vznikne spleť d komponent,
  aplikace to oznámí a obarví komponenty zvlášť.
- Zobrazí se teoretický počet křížení min(p(q−1), q(p−1)) a varování při samoprůniku trubky (tloušťka je
  příliš velká vůči nejmenší vzdálenosti větví, změřeno).

### Etapa 4 – Minimální plochy
- **Catenoid**, **helicoid** a jejich **asociovaná rodina**: animovaná izometrická deformace catenoid ↔ helicoid.
- **Enneperova plocha** se samoprůniky od zvoleného poloměru.
- **Costova plocha**: Weierstrassova–Enneperova reprezentace s ℘ a ζ pro čtvercovou mřížku. Funkce se počítají
  numericky (theta řady). Kontrola useknutého kusu: rod 1, 3 okraje, χ = −3.
- Barevná mapa střední křivosti H a numerické ověření, že |H| ≈ 0 (uvede se max. a průměr).

### Etapa 5 – Matematicky zvláštní tělesa
- **Diniho plocha** (a, b). Změřená Gaussova křivost K se porovná s teorií −1/(a²+b²) a zobrazí se odchylka.
- **Gabrielův roh** y = 1/x na [1, a]. Živá čísla: objem π(1 − 1/a) → π, plocha ≥ 2π ln a → ∞
  (numerický integrál i dolní mez). Posuvník a jde logaritmicky až do 10⁶, osa x se dá přepnout na log
  měřítko. Vysvětlení „paradoxu malíře“.

### Etapa 6 – Gömböc (pečlivě)
Postup je obrácený: **nejdřív nástroj na ověření, potom model.**
1. `rovnovaha.js`: pro libovolné konvexní homogenní těleso spočítá těžiště a opěrnou funkci h(n).
   Stabilní polohy jsou lokální minima h, nestabilní lokální maxima, k tomu sedla. Kontrola S − H + U = 2.
   Testy: koule je degenerovaná, kvádr dá {6, 8} (S, U), elipsoid {2, 2}.
2. **Kutálení:** těleso položené na stůl v libovolné orientaci se kvazistaticky překulí do rovnováhy.
   Ukáže se, kolik různých poloh lze dosáhnout.
3. **Model Gömböcu:** před implementací rešerše literatury (Várkonyi & Domokos 2006, *Mono-monostatic
   bodies*, Math. Intelligencer; Domokos & Várkonyi 2008). Pak dvě cesty:
   - a) Matematická konstrukce z důkazu (radiální funkce s malou odchylkou od koule). Je přesná, ale
     vizuálně téměř koule. Zobrazí se i se zvětšenou odchylkou a s upozorněním, že zvětšená verze už
     vlastnost nemusí mít. Ověřovač to změří.
   - b) Tvar viditelně podobný skutečnému Gömböcu. Získá štítek „numericky ověřeno {1, 1} na síti
     s rozlišením X“ **jen tehdy**, když ho ověřovač skutečně změří jako {1, 1}. Jinak má štítek 🔴
     ilustrativní a vypíše se naměřený počet poloh (např. „tento model má S = 2, U = 1“).
   Vlastní optimalizace tvaru na {1, 1} je výzkumný úkol, bez záruky úspěchu.
4. Text vysvětlí, proč to ve 2D nejde (věta o čtyřech vrcholech) a proč homogenita a konvexita rozlišují
   Gömböc od vstávacího panáčka (ten je jen pro srovnání).

### Etapa 7 – Fraktály
- **Mengerova houba** do úrovně 4 (1,6 × 10⁵ krychlí). Kreslí se jen vnější stěny a sousední stěny se ruší,
  případně se použije instancing. Čísla: objem (20/27)ⁿ → 0, plocha 2(20/9)ⁿ + 4(8/9)ⁿ → ∞,
  dimenze log 20 / log 3. Plocha a objem se zároveň měří na síti.
- **Sierpińského čtyřstěn**: objem (1/2)ⁿ, plocha zůstává konstantní, dimenze 2.
- **Kochova vločka ve 3D**: vysunutí, volitelně se zkroucením. Obvod 3(4/3)ⁿ → ∞, plocha → 8/5 výchozího trojúhelníku.
- **Mandelbulb** (mocnina 8 podle White–Nylander, mocnina nastavitelná): náhled raymarchingem v shaderu
  (přesný pro každý pixel při dané iteraci) a síť marching cubes ve workeru pro export.
  Štítek uvede iterace a rozlišení mřížky.

### Etapa 8 – Optické iluze
- **Penroseův trojúhelník:** tři trámy otevřeného 3D tělesa. Mezera se schová přesně podél vypočteného směru
  pohledu v ortografické projekci. Tlačítko „kouzelný pohled“ plynule najede do přesného úhlu,
  volné otáčení odhalí trik.
- **Nemožné schodiště** (Penrose): skutečné schody se skrytým výškovým skokem, kamera má definovaný pohled.
- **Sugiharův dvojznačný válec:** pro dva pohledy pod úhlem θ a dvě zadané křivky (kružnice, čtverec,
  volitelně další) se vypočte prostorová horní hrana: y = (f − g)/(2 sin θ), z = (f + g)/(2 cos θ).
  Rozdělená obrazovka se dvěma pohledy, případně virtuální zrcadlo.

### Etapa 9 – Dokončení
- Export STL/OBJ/GLB/PNG. **Zesílení pro tisk** ±t/2 podél normály. Funguje i na Möbiovi, u ploch se
  samoprůniky se zobrazí varování.
- Sdílení přes URL hash (objekt + parametry), offline přes service worker, nápověda, panel zdrojů.
- Záznam v `apps.js` (stav `vyvoj`), zvýšení verze cache v `sw.js`.
- **Plošný test všech objektů:** každý se vygeneruje s krajními parametry. Kontroluje se, že nevznikne NaN,
  síť je sešitá a měřené invarianty sedí s teorií (tabulka níže). Ukládá se snímek každého objektu.
- Revize kódu a textů.

### Etapa 10 (volitelná) – Tělesa se zvláštními fyzikálními vlastnostmi
Návrhy nad rámec zadání, dělat jen po souhlasu: **Meissnerovo těleso** (konstantní šířka), **oloid** (při
kutálení se dotkne podložky celým povrchem), **sférikon**, **keltský kámen** (obrácení rotace, vyžaduje
simulaci tuhého tělesa).

## Kontrolní tabulka invariantů (pro testy)

| Objekt | χ | Orientovatelná | Okraje | Další kontrola |
|---|---|---|---|---|
| Torus | 0 | ano | 0 | objem 2π²Rr², plocha 4π²Rr |
| Möbius, n liché | 0 | ne | 1 | |
| Möbius, n sudé | 0 | ano | 2 | |
| Kleinova láhev | 0 | ne | 0 | samoprůnik neprázdný |
| Boyova plocha | 1 | ne | 0 | samoprůnik s trojným bodem |
| Římská plocha | 1 | ne | 0 | 6 zaštípnutých bodů |
| Uzel (p,q), NSD = d | 0 na komponentu | ano | 0 | d komponent |
| Catenoid (kus) | 0 | ano | 2 | \|H\| ≈ 0 |
| Helicoid, Enneper (kus) | 1 | ano | 1 | \|H\| ≈ 0 |
| Costa (useknutá) | −3 | ano | 3 | \|H\| ≈ 0, bez samoprůniku |
| Dini | 1 | ano | 1 | K ≈ −1/(a²+b²) |
| Menger n | – | – | – | plocha a objem podle vzorců |
| Sierpiński n | – | – | – | plocha konstantní, objem (1/2)ⁿ |
| Gömböc | 2 | ano | 0 | S − H + U = 2; {1, 1} jen pokud změřeno |

## Otázky k rozhodnutí
1. Název a sekce: platí „♾️ Laboratoř nemožných tvarů“ v 🧪 Simulace & věda?
2. Etapa 10 (tělesa navíc): ano, nebo ne?
3. Export pro 3D tisk: je potřeba už v etapě 1, nebo stačí na konci?

# Návrhy na další stránky/aplikace

Stav k 29. 10. 2026. Návrhy vycházejí z katalogu hlavního webu (`apps.js`, 438 stránek)
**i z katalogu Metodu** (`../metodus/apps.js`, 274 stránek), aby se nedublovalo.

Pravidla:

- Před přidáním návrhu ověřit oba katalogy (`grep -i <téma> apps.js ../metodus/apps.js`).
- Výuková témata (učivo ZŠ: jazyky, matematika, fyzika, přírodopis, hudební nauka…)
  patří do Metodu, ne sem.
- Zahradnická témata uživatel teď nechce (sekce Zahrada & pěstování se nerozšiřuje).
- Hotové návrhy přesunout do archivu na konci souboru.

## Otevřené návrhy

### Realizace vybraných (10. 11. 2026, po 4 stránkách)

- [x] **Etapa 1:** 1 Zásoby (`zasoby`), 2 Předplatné (`predplatne`), 6 Dávky (`davky`), 7 OSVČ (`osvc`)
- [ ] **Etapa 2:** 8 Konec PP (`konec_pp`), 11 Bateriový pack (`baterie_pack`), 12 Ložiska (`loziska`), 13 Pneumatiky (`pneumatiky`)
- [ ] **Etapa 3:** 14 Velikosti, 17 Deník nemoci, 19 Vzory z obrázku, 20 Pletení a háčkování
- [ ] **Etapa 4:** 21 Omalovánky, 23 CSS hřiště, 25 Turnajový pavouk, 26 Půjčené věci (rozšíření majetku)

### Návrhy z 10. 11. 2026 (ověřeno proti oběma katalogům, nic z toho zatím není)

**Domácnost & finance**
- **1. Zásoby spíže a mrazáku** (`zasoby.html`). Položky s datem spotřeby, umístěním a množstvím, upozornění „brzy prošlé“, čtení EAN (sdílet čtečku z Deníku jídla), výstup „co dokoupit“ do Plánovače nákupů.
- **2. Správce předplatných** (`predplatne.html`). Opakované platby (streaming, pojištění, domény…), měsíční/roční souhrn, upozornění před obnovou, přepočet měn. Doplňuje Sledování výdajů, které je jednorázové.
- **3. Dělení útraty ve skupině** (`deleni_utraty.html`). Kdo za co platil na výletě/oslavě, vyrovnání minimem převodů, sdílení přes odkaz/QR. Dělení hypotéky je jiný případ.
- **4. Co stojí provoz spotřebiče** (`provoz_spotrebice.html`). Příkon × doba × tarif, standby, porovnání starého a nového spotřebiče (návratnost), štítky A–G.
- **5. Vytápění: ztráta, výkon, paliva** (`vytapeni.html`). Orientační tepelná ztráta (plocha, zateplení, lokalita), výkon zdroje, porovnání ceny za kWh tepla (dřevo prm/sypané, pelety, plyn, elektřina, TČ). Stárnoucí ceny ručně jako u tarifu.

**Právo, práce & ČR (jen_cs)**
- **6. Nemocenská, PPM a rodičovský příspěvek** (`davky.html`). Výpočet náhrady mzdy a nemocenského z DVZ, mateřská, volba délky rodičovského příspěvku. Sazby ročně ručně (stárnoucí data).
- **7. OSVČ: paušální daň vs. skutečné výdaje** (`osvc.html`). Porovnání paušální daně, výdajových paušálů a skutečných výdajů vč. odvodů, DPP/DPČ odvody. Doplňuje Čistou mzdu.
- **8. Konec pracovního poměru** (`konec_pp.html`). Výpovědní doba (změny 2025), odstupné, nevyčerpaná dovolená, zkušební doba, kalendář lhůt.

**Technika & elektro**
- **9. Elektronická dílna** (`elektronika.html`). Barevné kódy rezistorů a SMD kódy, předřadný odpor LED, dělič napětí, RC filtr, 555, kapacita/ESR, spotřeba na baterii.
- **10. Pinouty konektorů** (`pinouty.html`). Referenční karty: RJ45 T568A/B, USB A/C, DB9 RS-232, HDMI, jack 3,5, Molex/ATX, Dupont, I²C/SPI hlavičky Raspberry/Arduino, kreslené ze SVG, tisk.
- **11. Návrh bateriového packu** (`baterie_pack.html`). Články 18650/21700/LiFePO4 v konfiguraci S×P, kapacita, napětí, proud, doba běhu, BMS, 3D držák článků (výstup STL). Ostrovní systém řeší dům, ne pack.
- **12. Katalog ložisek, O‑kroužků a těsnění** (`loziska.html`). Z označení (6204‑2RS, 608ZZ…) rozměry, únosnost, drážky pro O‑kroužky, gufera; výstup do Modeláře (vložit do dílu).
- **13. Kalkulačka pneumatik a disků** (`pneumatiky.html`). Rozměr → průměr/obvod, odchylka tachometru, porovnání dvou rozměrů, ET a šířka disku, tlak dle zatížení.
- **14. Tabulky velikostí** (`velikosti.html`). Oblečení a boty EU/UK/US/cm, dětské podle výšky, prsteny, rukavice, kola rámů; z naměřených hodnot doporučí velikost.

**Zdraví & sport**
- **15. Kalkulačka tempa a výkonu** (`tempo.html`). Pace ↔ rychlost, splity, odhad času závodu (Riegel), cyklistika: převody kola (gear inches), kadence, W/kg. Napojit na Tréninkový deník.
- **16. Test sluchu** (`test_sluchu.html`). Tónová audiometrie po frekvencích a uších (orientační, s varováním), audiogram k tisku. Vedle Oční tabulky.
- **17. Deník nemoci** (`denik_nemoci.html`). Teplota, léky, příznaky, tekutiny u dítěte; graf teploty, export pro lékaře. Doplní Rozvrh léků.

**Tvorba**
- **18. Zpěvník s akordy** (`zpevnik.html`). Text s akordy (ChordPro), transpozice, kapodastr, diagramy akordů pro kytaru/ukulele, tisk sešitu A5, vlastní knihovna v IndexedDB.
- **19. Vzory z obrázku: křížková výšivka, korálky, mozaika** (`vzory_z_obrazku.html`). Redukce barev na paletu (DMC, Hama), mřížka se symboly, legenda a spotřeba, tisk po listech. Dithering a Pixel studio dodají základ.
- **20. Pletení a háčkování** (`pleteni.html`). Přepočet vzorku na hustotu, počítadlo řad, jednoduché schéma vzoru (čtverečky), výpočet příze.
- **21. Omalovánky z fotky** (`omalovanky.html`). Hrany → obrys pro děti, nastavení detailu, tisk A4, dávkově.

**Vývoj & data**
- **22. Síťová kalkulačka** (`sitova_kalkulacka.html`). IPv4/IPv6 subnety, CIDR, VLSM, rozsahy, maska ↔ prefix, převod IP. Standard, který chybí.
- **23. CSS hřiště: Flexbox, Grid, cubic‑bezier** (`css_hriste.html`). Vizuální nastavení a generovaný kód.
- **24. Náhled sdílení (Open Graph / meta tagy)** (`og_nahled.html`). Generátor meta tagů a náhled karty jako na sociálních sítích; bez stahování cizích URL.

**Organizace**
- **25. Turnajový pavouk a rozlosování** (`turnaj.html`). Vyřazovací/skupinový/švýcarský systém, nasazení, tisk, průběžné výsledky, sdílení odkazem.
- **26. Půjčené věci** (rozšíření `Evidence domácího majetku`, ne nová stránka). Komu, kdy, připomínka vrácení.

### 🌿 Příroda & venku

- **Atlas hub – houbaření a záměny** (`houby_atlas.html`). Praktický průvodce pro sběr:
  karta druhu s jednotnou ilustrací, jedlost/jedovatost, **nebezpečné záměny vedle sebe**,
  jednoduchý klíč (ano/ne otázky), sezónnost. Odlišit od Metodu: `pr6_houby` a „Houby
  a lišejníky“ učí systém a stavbu hub, tohle má být terénní pomůcka. Obrázky jsou jádro
  (Codex na pokyn, nebo lokální Z-Image).

### 🩺 Zdraví

- **Ilustrovaná první pomoc – rozšíření Lékárničky** (`first_aid_ref.html`, ne nová stránka).
  Postupy krok za krokem v obrázcích (zotavovací poloha, Heimlichův manévr, resuscitace)
  a tisk karty A4/A6 do auta a dílny. Metodus (`pr8_prvni_pomoc`, „Zdraví, nemoc a první
  pomoc“) to probírá jako učivo; tady jde o rychlou referenci a tisk.

### 📐 Technika

- **Průvodce spojovacím materiálem a nářadím** (`sprav_material.html`). Hmoždinky
  (do čeho kterou), nýty, hřebíky, typy hlav a bitů, vrtáky podle materiálu, pilové listy;
  kreslené karty + „čím to přichytit“ (materiál podkladu a zátěž → doporučení). Závity
  a šrouby vynechat – ty už jsou na hlavním webu (`Šrouby & závity`) i v Metodu.

### 🎮 Hry

- **Další gamebooky** do sekce 📖 Gamebooky. Engine (`obsah/gamebook/jadro.js`) je obecný,
  nový příběh = nový datový soubor jako `gamebook/pribeh.js` + ilustrace. Pak udělat
  výběr příběhu na titulní straně.
- **Dobble / Postřeh** (`dobble.html`). Generátor karet, kde mají každé dvě karty právě
  jeden společný symbol (projektivní rovina řádu 7 → 55 karet, 57 symbolů); hra na
  obrazovce + tisk karet. Potřebuje sadu 57 jednotných ikon (arch 4×4 přes Codex nebo
  lokální SD).
- **Obrazové sady pro Pexeso** (rozšíření `memory_game.html`, ne nová stránka). Tematické balíčky
  (zvířata, památky ČR, nářadí). Vlajky ne – Metodus má „Kvíz vlajky a města“.
- **Uzly – rozšíření Námořnických uzlů** (`uzly.html`) o horolezecké a rybářské uzly s animací kroků.

### 🏠 Domácnost

- **Domácí údržba – návaznosti.** Propojit s Evidencí majetku (úkol údržby u konkrétního
  spotřebiče) a s Domácími odečty (připomínka měsíčního odečtu). Až po zpětné vazbě
  uživatele na `udrzba.html`.

## Už je v Metodu (sem nepatří)

| Návrh | Kde je v Metodu |
|---|---|
| Němčina – slovíčka a časování | „🇩🇪 Němčina – slovíčka“, „Slovní zásoba NJ a FJ“, „Výslovnost NJ a FJ“ |
| Fyzikální pokusy pro děti (simulace) | „🔬 Fyzikální hřiště – síla, pohyb a energie“, „⚖️ Páka a jednoduché stroje“ |
| Notová osnova – čtení not | „🎼 Notová osnova – čtení not“, „🎹 Intervaly“, „🥁 Rytmus, délky not a takt“ |
| Obrazový slovník cizích jazyků | předměty `aj` a `dcj` (slovní zásoba) |
| Sekce pro děti (násobilka, vyjmenovaná slova, hodiny, zlomky) | „✖️ Procvičování násobilky“, „✍️ Vyjmenovaná slova“, „🕐 Učení hodin“, „🍕 Zlomky…“ |
| Houby a rostliny jako učivo | `pr6_houby`, „🍄 Houby a lišejníky“, „🌿 Stavba a systém rostlin“ |

## Archiv – realizováno

**29. 10. 2026 (úpravy souborů a generátory):** 📄 PDF dílna (`pdf_dilna`), 🔍 OCR (`ocr`),
nová sekce 📄 PDF & skeny; 🗂️ Hromadné úpravy obrázků, ✂️ Odstranění pozadí, 〰️ Vektorizace,
🎞️ GIF a sprite sheety, 💬 Editor titulků, 🎴 Generátor karet, 🏷️ Hromadný tisk štítků,
🎟️ Vstupenky a poukazy, 🧩 Generátor puzzle, 🗺️ Plakát mapy. Odloženo: ZIP nástroj, převodník zvuku.

**29. 10. 2026:** 🔧 Domácí údržba a revize (`udrzba.html`), ⛏️ gamebook Hlubina pod
Černou horou (`gamebook.html`, nová sekce 📖 Gamebooky).

**Dřívější návrhy z tohoto souboru (všechny na webu):** Zettelkasten, vCard + QR,
docházka, zápis z porady, budík dle spánkových cyklů, oční tabulka, kalendář růstu dítěte,
lékárnička, kalkulačka kofeinu, rybářský kalendář, plánovač záhonů, astronomický kalendář
úkazů, komiksové stripy, storyboard, generátor nálepek, paleta z obrázku, spotřeba
barvy/tapety, betonová směs, sklon střechy, dimenzování kabelu, kalkulačka pružin,
URL builder, YAML ↔ JSON, Git cheatsheet, generátor .env, API tester, bingo kartičky,
generátor křížovek, O projektu.

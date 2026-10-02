# Revize webu — nálezy a provedené opravy

Revize proběhla 26. 8. 2026 nad všemi **517 stránkami** (264 v `obsah/`, 253 v
`metodus/obsah/`). Všechny nálezy z ní jsou **opravené**; tenhle dokument je
zároveň zápisem, co se změnilo a proč.

Ověřeno automaticky (nástroje leží v `_test/`, složka je v `.gitignore`):

| Kontrola | Výsledek |
|---|---|
| `_test/run.py` — funkční testy v headless Chromiu | **286 / 286 prošlo** |
| `_test/sweep.py` — načtení všech 517 stránek | **0 stránek neshodilo JS** |
| `_test/syntaxe.py` — `node --check` nad 541 skripty | **0 syntaktických chyb** |
| `_test/async_pasti.py` — hlídač async návratových hodnot | **0 nálezů** |
| katalogy `apps.js` / `metodus/apps.js` | 264 + 250 položek, **0 chybějících souborů** |

---

## Co se nedotklo

Rozcestníky (hledání, oblíbené, nedávné, filtry Metodusu), `flashcards`, `chess`
(minimax + alfa-beta), `statistics`, `word_counter`, `cable_sizing_calc`,
`dew_point`, `forecast`, `Heritage`, `trip_planner` — tyhle části jsou v pořádku
a měnily se jen tam, kde do nich zasáhla některá ze systémových oprav.

---

## A. Systémové opravy

### A1 · Hry neměly paměť — 25 ze 42 ✅

Vznikl sdílený modul **`rekord.js`** (`Rekord.sleduj(klíč, {vyssiLepsi, format, popisek})`)
s jednotným pruhem „🏆 Nejlepší: … ↺“ a klíči `webapp_hra_*`. Nasazen do:

| Hra | Co se sleduje |
|---|---|
| minesweeper | nejlepší čas zvlášť pro každou obtížnost |
| sokoban | nejméně tahů na úroveň |
| hanoi | nejméně tahů podle počtu disků (řešení tlačítkem se nepočítá) |
| memory | nejlepší čas podle velikosti mřížky |
| nonogram | nejlepší čas na obrázek (náhodná zadání rekord nemají) |
| yahtzee, breakout, jump_game, fps_arena, stack-attack | nejvyšší skóre |
| lodě | nejméně výstřelů k vítězství |
| solitaire | nejméně tahů k výhře |
| connect4, pong, šachy, piškvorky, kámen-nůžky-papír | série výher nad počítačem |
| reversi | nejlepší výhra (rozdíl kamenů) |
| trivia | nejlepší úspěšnost |

Bez rekordu zůstávají už jen čtyři a záměrně: `crossword_gen` a `bingo_gen` jsou
generátory, `dwarf_colony` a `pirateers` otevřené sandboxy bez konce hry.

### A2 · Metodus: 74 stránek mimo vlastní standard ✅

`uloha.js` uměl jen úlohy, kde se **klepe na možnost** — proto stránky s psanou
odpovědí stály mimo. Vznikl proto modul **`procvic.js`**, který stejná pravidla
(chyba → zatřesení a druhá šance, správně → automatický posun, do skóre jen
odpověď napoprvé) rozšiřuje i na psané odpovědi, a k tomu přidává **přehled
chybných příkladů a tlačítko „🔁 Zopakovat chyby“**.

Sedmička kvízů byla převedená:

- **`mocniny_odmocniny`, `desetinna_cisla`, `casovani_sloves`, `trigonometrie`,
  `kombinatorika`** → plně na `procvic.js` + `vyuka.css`. Přibyly nápovědy
  s postupem, u trigonometrie se ke každému zadání kreslí trojúhelník,
  u porovnávání desetinných čísel se odpovídá klepnutím.
- **`multiplication` a `mental_math`** jsou rychlostní drily s časomírou —
  druhá šance by je popřela, takže si sprint nechaly. Dostaly ale přehled chyb,
  rekord, zápis do `Uloha.skore` a barvy z tokenů. `mental_math` navíc přenese
  starý rekord z klíče `mentalmath_best`.

> **Zbývá do budoucna:** zbylých ~67 nestandardních stránek Metodusu jsou z velké
> části referenční a simulační (`periodic_table`, `optika`, `paka`,
> `slepa_mapa_evropa`…), kde `uloha.js` nedává smysl. Sjednocení jejich hlaviček
> je kosmetická práce na samostatnou dávku.

### A3 · Studijní deník nečetl, co už na disku bylo ✅

`edu_progress.html` si dřív musel uživatel naklikat celý ručně. Teď:

- **`uloha.js` vede deník činnosti** (`metodus_aktivita`) — u každé odpovědi zapíše
  datum, název stránky a poměr správně/pokusů. Název stránky bereme z adresy,
  protože klíče skóre se na soubory namapovat nedají (33 ze 171 má zkrácený tvar).
- Deník z toho **sám** počítá sérii dní, kalendář, celkový počet odpovědí
  a úspěšnost; předmět si dohledá v `metodus/apps.js`.
- Přibyl přehled **„co ti jde a co drhne“** — témata seřazená podle úspěšnosti
  napoprvé, s odkazem rovnou na procvičení.
- Ruční zaškrtávání zůstalo jako doplněk (zeleně automatické, modře ruční).
- Deník se sám ořezává na posledních 120 dní, ať `localStorage` neroste.

### A4 · 42× `alert()`, 58× `confirm()`, 12× `prompt()` ✅

Vznikl modul **`dialog.js`** (`Dialog.info` / `chyba` / `potvrd` / `zeptej`) —
toast a `<dialog>` v barvách webu, Esc i klik mimo znamenají zrušeno, návratové
hodnoty se chovají jako u nativních funkcí. Nahrazeno strojově na **74 stránkách**
(92 + 80 + 18 volání); nativní volání zbylo **nula**.

Protože `confirm`/`prompt` jsou synchronní a `Dialog` vrací Promise, musely
obalující funkce zesynchronnět na `async`. Na to vznikl hlídač
`_test/async_pasti.py` — a odhalil **skutečnou regresi**: `guardUnsaved()` ve
`Vzorce.html` se volá jako `if (!guardUnsaved())`, což by u Promise bylo vždy
nepravdivé a ochrana neuložených změn by tiše přestala fungovat. Opraveno na
`await` na všech třech místech.

### A5 · Nízký kontrast ✅

- **118 inline `style="color:#888"` na 69 stránkách** nahrazeno za
  `var(--text-faint)` (inline styl přebije `[data-theme="light"]` override,
  takže je CSS revize nemohla zachytit).
- Světlý `--text-faint` ztmaven z `#7a828a` (3,51:1) na **`#686f77`** (4,58:1).
- **Stavové barvy neměly světlou variantu vůbec** — `--warn` mělo na světlém
  pozadí kontrast 1,95:1. Doplněny: `--ok #177540`, `--warn #7d5800`,
  `--danger #c0392b`, všechny nad 4,5:1. (Našel to test kontrastu ve `wordle`.)

### A6 · Stránky mimo katalog ✅

`agri_calendar.html` a `tinkercad.html` doplněny do `apps.js` (264 položek).
`aplikace.html` mimo katalog **zůstává správně** — je to úvodní přehled, ne
aplikace; v původní revizi bylo označené jako osiřelé nepřesně.

---

## B. Opravené stránky

| # | Stránka | Co bylo špatně | Co se stalo |
|---|---|---|---|
| B1 | `wordle` | slovník obsahoval useknutá neslova `medvě`, `sklen`, `okurk`, `jablk`, `traum` — hru pak nešlo vyhrát | 317 ověřených tajenek + 74 přijímaných tipů, kontrola „tohle slovo neznám“, statistika a rozložení pokusů, režim slova dne, klávesnice se staví z písmen slovníku |
| B2 | `vision_test` | přepočet `velikost × 8` neměl vazbu na fyzickou velikost pixelu → „6/6“ nic neznamenalo | kalibrace platební kartou (85,6 mm), velikost podle normy (písmeno svírá 5 úhlových minut), interaktivní test s vyhodnocením, Sloanova písmena |
| B4 | `piskvorky` | neomezený minimax = neporazitelný soupeř, jen 3×3, žádné skóre | tři obtížnosti, volba kdo začíná, trvalé skóre, **režim 15×15 na pět v řadě** s heuristickým soupeřem |
| B5 | `lights_out` | mohla vygenerovat už zhasnutou desku | kontrola při generování, velikosti 3×3–6×6, nápověda řešením soustavy nad GF(2), rekord na velikost |
| B6 | `rock_paper_scissors` | reset nastavoval `#e0e0e0` → kontrast 1,19:1 | barvy z tokenů (ověřeno 13,2:1), ovládání klávesami K/P/N, volba soupeře, který čte hráčovy zvyky |
| B7 | `physics_playground` | inline `#e0e0e0` | `var(--text)` |
| B8 | `tabooGame` | patička odkazovala na neexistující `obsah/index.html` | mrtvý odkaz odstraněn |
| B9 | `contact_page` | 101 znaků textu, přitom sem `about.html` posílá hlášení chyb | odkaz na GitHub Issues, návod co do hlášení napsat, šablona předvyplněná podle prohlížeče, poznámka o soukromí |
| B10 | datové sady | sokoban 4 úrovně, trivia 48 otázek, první pomoc 12 témat | **sokoban 31 úrovní** ověřených prohledáním stavového prostoru (každá zná své optimum), **trivia 160 otázek** bez duplicit a s pamětí odehraných, **první pomoc 16 témat**, **HTTP 50 kódů** |
| B11 | `cutting_speed` | „obvodová rychlost“ se po zkrácení vždy rovnala zadanému `vc` | nahrazeno úběrem materiálu Q, doporučeným rozmezím `fz` podle průměru a kontrolou proti maximálním otáčkám stroje |
| B12 | `solitaire` | žádné zpět, žádná uložená partie | tlačítko ↶ Zpět (i Ctrl+Z) s plnou historií, automatické ukládání rozehrané hry, rekord |
| B13 | `minesweeper` | těžká deska 24×16 přetékala na telefonu | buňka odvozená od šířky viewportu (těžká deska 368 px), rekord na obtížnost |
| — | `stack-attack` | jediná hra bez `common.css`, konec hry přes `alert()` + `location.reload()`, na mobilu nehratelná | přepsána: sdílené téma, vlastní překryv, pauza, dotykové ovládání, rostoucí obtížnost, rekord |

### Nálezy, které revize nepředpokládala

- **`margin_calculator` padal při každém neúplném zadání.** `isFinite(null)` je
  `true` (null se převede na 0), takže se volalo `null.toLocaleString()`.
  Nahrazeno `Number.isFinite`. Chyba tam byla už předtím — našel ji sweep.
- **`travel_diary` a `PNG_merger`** měly `<img src="">`, což prohlížeč načítá
  jako adresu stránky. Atribut odstraněn.
- **`trivia` opakovala otázky hned v dalším kole.** Odehrané se pamatují,
  po vyčerpání sady se kolo uzavře.

---

## Poznámka k testům

Ve složce `_test/` (mimo git) zůstávají nástroje, které se hodí i příště:

```bash
python3 _test/syntaxe.py       # node --check nad všemi inline skripty
python3 _test/run.py           # funkční testy v headless Chromiu
python3 _test/sweep.py         # načte všech 517 stránek a hlásí chyby JS
python3 _test/async_pasti.py   # async funkce, jejichž návratovou hodnotu někdo testuje
```

Server v `run.py` a `sweep.py` vkládá stránkám sběrač chyb hned za `<head>` —
jinak by se nedaly zachytit chyby z prvního běhu skriptů. Testy interakce běží
v reálném čase; `--virtual-time-budget` se nepoužívá, protože v něm neběží
`requestAnimationFrame`.

> Po nasazení zvyš verzi cache: `sw.js` je na `webapp-v71`, `metodus/sw.js` na
> `metodus-v31` — obojí už zvednuté touto dávkou.

---

## Revize stránky `obsah/valka_ukrajina.html` (2. 10. 2026)

Stránku jsem prošel ručně a souběžně ji zkontroloval nezávislý recenzent, který ověřoval
čisté funkce v node nad živými daty. Nálezy jsem ověřil a všechny opravil.

### Chyby v datech (uživatel viděl špatná čísla)

| Nález | Oprava |
|---|---|
| Parser CSV dělil text na řádky dřív, než zpracoval uvozovky. Export Oryx má v poli `"Surface-To-Air Missile Systems⏎"` konec řádku, takže **ukrajinské protiletadlové komplety ukazovaly 0 místo 179** a v tooltipu „NaN“. | Parser čte po znacích přes celý text, uvozovky platí i přes konce řádků, `""` = uvozovka, hodnoty se ořezávají. |
| Oryx vede ukrajinské lodě jako `Naval Ships`, ruské jako `Naval Ships and Submarines` → **ukrajinské lodě ukazovaly 0 místo 44**. | Sjednocení klíče v `oryxSouhrn`. |
| Graf vývoje území měl u rekonstrukcí 2022–2024 štítek „ověřeno“, ačkoli časosběr je správně vede jako odhad. | Dva štítky: rekonstrukce ≈ odhad, denní data ✔ ověřeno. |
| Verdikt křížové kontroly ISW × DeepStateMap vždy tvrdil, že DeepState leží mezi užším a širším vymezením ISW, i když čísla vyšla jinak. | Text se volí podle skutečné polohy čísel; doplněna přesnost výpočtu ±1 %. |
| Červenec 2024 (data až od 8. 7.) se počítal jako celý měsíc a mohl vyjít jako „nejrychlejší“; denní tempo se dělilo pevnými 30,4 dny. | První i běžící měsíc jsou označené jako neúplné, tempo se počítá ze skutečného počtu dní. |
| Poslední bod časové řady Oryx byl dvakrát. | Duplicita odstraněna. |
| Den války se přepínal o půlnoci UTC, tedy v ČR až v 1–2 h ráno. | Počítá se od místní půlnoci. |
| Formulace „GŠ ZSU = zabití a *těžce* ranění“, „Rusko ovládlo Luhanskou oblast“ a „z Mariupolu chybí většina obětí“ tvrdily víc, než zdroje říkají. | Přeformulováno podle zdrojů (Rusko oblast „prohlásilo za dobytou“, OSN „výrazně vyšší“ čísla kvůli okupovaným městům). |

Ověřeno výpočtem: vrstvy ISW „kontrola“, „postup“ a „infiltrace“ se nepřekrývají (průnik 0 km²), takže
dlaždice nic nezapočítává dvakrát. Části mimo obrys Ukrajiny (~1,3 %) jsou jen 207 drobných proužků podél
hranice a pobřeží, tedy generalizace hranic.

### Chyby v chování

- **Dvojí přehrávání:** rychlé pauza → přehrát spustilo druhou smyčku a snímky běžely dvojnásobnou rychlostí. Opraveno číslem běhu.
- **Stránka visela na „Načítám…“:** po výpadku DeepStateMap se to týkalo křížové kontroly a časosběru, po výpadku GŠ ZSU zůstalo prázdné plátno. Chyba v jedné části navíc zastavila překreslení ostatních při změně tématu. Opraveno: každá sekce má vlastní chybovou hlášku a vykreslení je izolované (`bezpecne`).
- **Vrstva časosběru:** při přeletu na výřez ujížděla mapě. Každý snímek navíc alokoval 4 plátna velikosti mapy (~30 MB při DPI 2) a po zoomu se kreslil dvakrát. Opraveno: plátno se při zoomu schová, pomocná plátna se znovu používají a kreslí se jen na `moveend`.
- **Tažení posuvníkem:** spouštělo stovku souběžných stahování a přechodná síťová chyba se zapamatovala navždy. Opraveno: posuvník čeká 120 ms, snímky se přednačítají jen při přehrávání a po síťové chybě se zkusí znovu (404 se pamatuje).
- **Šipky na klávesnici:** posouvaly snímek i při práci s mapou a fungovaly i s Alt (Zpět v prohlížeči). Opraveno.
- **Zbytečné překreslování:** `theme.js` zapisuje téma i beze změny, a každé takové zapsání překreslilo celou stránku. Opraveno.
- **Přístupnost:**
  - grafy mají `role="img"` a popis,
  - posuvník hlásí datum (`aria-valuetext`),
  - přepínače mají `aria-pressed`,
  - odkazy na události jsou ovladatelné klávesnicí,
  - panel snímku se ohlašuje (`aria-live`, při přehrávání vypnuto).
- **Kompatibilita:** odstraněn operátor `||=`, kvůli kterému by Safari < 14 nespustil vůbec nic.

### Testy

| Kontrola | Výsledek |
|---|---|
| `node --check` + jednotkový test parseru a `oryxSouhrn` nad živým CSV | 0 NaN, PVO UA 179, lodě UA 44 |
| `_test/test_valka_cas.py` (časosběr: krokování, kroky týden/2 týdny/měsíc, přehrávání, pauza/přehrát, šipky, aria) | prošlo, 0 chyb JS |
| totéž s `DPR=2` | plátno 1362 px na 681 CSS px, bez lemů |
| `_test/snimek_valka.py` (obě témata, úzký displej 360 px) | nic nepřetéká, 0 chyb JS |
| výpadek všech zdrojů z GitHubu (`--host-resolver-rules`) | každá sekce ukáže chybu, nic nevisí, 0 chyb JS |

Zbývá vědomě: statická čísla OSN, Mediazony a UNHCR je potřeba při aktualizaci obnovit ručně
(konstanta `STATICKA`). `findLastIndex` a `.at()` vyžadují Safari 15.4+ nebo Firefox 104+.

### Druhé kolo revize (2. 10. 2026, zaměřené na čtenáře a na regrese)

Recenzent s čerstvým pohledem zkontroloval opravy z prvního kola i obsah. Já jsem prošel celostránkové
snímky a ověřil sporná místa v datech.

**Chyby v obsahu**

| Nález | Oprava |
|---|---|
| **Sever 2022 chyběl.** Rekonstrukce vede území obsazené v únoru až dubnu 2022 u Kyjeva, Černihivu a Sum (až 34 532 km²) ve zvláštní vrstvě `grey`, kterou stránka nepoužívala. Březnové maximum vycházelo o ~35 000 km² nižší a stažení ze severu (událost č. 2) na grafu ani v časosběru vůbec nebylo vidět. | Graf má tečkovanou řadu „včetně severu“, časosběr kreslí sever šrafovaně a počítá ho do plochy. Ukazuje 163 827 km² (27,1 %) k 21. 3. 2022 a −34 417 km² k 7. 4. 2022. |
| **24 ze 40 historických snímků byly kopie předchozího.** Časosběr ukazoval „+0 km²“ a hned potom nafouknuté tempo (Avdijivka 56,9 km²/den místo 8,9). | Kopie se vyřazují, zůstává 16 skutečných snímků. |
| Graf měsíců ukazuje **čistou** změnu, ale popisky mluvily o „ziscích a ztrátách“ a o „nejrychlejším měsíci postupu“. Ověřil jsem, že skoro nulové měsíce 2026 nejsou výpadek dat (mapa se měnila 22–25krát měsíčně). | Nadpis, vysvětlivka i tooltip mluví o čisté změně; „Měsíc s největším čistým ziskem Ruska (od 7/2024)“. |
| Věta „ISW spíše nadhodnocuje ruskou kontrolu“ odporovala číslům na stránce (DeepStateMap uvádí o 4 000 km² víc). | Přeformulováno neutrálně. |
| Na stránce byly dvě různé „aktuální“ plochy bez vysvětlení (ISW 113 069 a DeepStateMap 117 096 km²). | Dlaždice uvádí obě a odkazuje na křížovou kontrolu. |
| Pruhy „mrtví podle Mediazony“ a „zabití + ranění podle GŠ ZSU“ sváděly ke srovnání. | Výslovně napsáno, že nejde o tutéž veličinu. |
| Sporné území (postup a infiltrace) neslo štítek „ověřeno“. U rekonstrukcí se srovnání s vlastním zdrojem tvářilo jako ověření. | Štítek odebrán; u rekonstrukcí je to „kontrola výpočtu“. |
| Vnitřně vysídlení byli označeni jako „lidé bez domova“; číslo 5,3 mil. bylo natvrdo mimo `STATICKA`; srovnání s počtem obyvatel Česka bylo zavádějící. | Opraveno a přesunuto do `STATICKA`, srovnání odstraněno. |
| U nulové změny se zobrazovalo „+0 km² pro Rusko“. | Nově „beze změny“. |
| Verdikt mohl současně tvrdit „shoda“ i „metodiky se rozcházejí“. | Opraveno. |

**Regrese z prvního kola**

- Čekající skok z posuvníku (120 ms) mohl po přepnutí kroku skočit na nesouvisející datum.
- `bezpecne` některé chyby spolkl a sekce zůstala na „Načítám…“. Teď se hláška vypíše do dané sekce.
- Pomocné plátno se při zoomu prohlížeče pod 100 % mazalo jen zčásti.
- Při výpadku Oryxu i GŠ ZSU zároveň druhá chybová hláška spadla, protože přepisovala už odstraněné plátno. Tuhle chybu našel až test výpadků, hlášky se teď sčítají.
- Chyba snímku časosběru je česky a přehrávání se na ní zastaví.

**Testy:** `_test/test_valka_cas.py` (navíc kontroly snímků 21. 3. a 7. 4. 2022 a 18. 2. 2024),
`_test/snimek_valka.py` (obě témata, 360 px) a test výpadku všech zdrojů z GitHubu — 0 chyb JS,
nic nevisí na „Načítám…“.

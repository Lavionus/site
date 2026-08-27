# Revize webu — nálezy a provedené opravy

Revize proběhla 26. 8. 2026 nad všemi **517 stránkami** (264 v `obsah/`, 253 v
`nodus/obsah/`). Všechny nálezy z ní jsou **opravené**; tenhle dokument je
zároveň zápisem, co se změnilo a proč.

Ověřeno automaticky (nástroje leží v `_test/`, složka je v `.gitignore`):

| Kontrola | Výsledek |
|---|---|
| `_test/run.py` — funkční testy v headless Chromiu | **286 / 286 prošlo** |
| `_test/sweep.py` — načtení všech 517 stránek | **0 stránek neshodilo JS** |
| `_test/syntaxe.py` — `node --check` nad 541 skripty | **0 syntaktických chyb** |
| `_test/async_pasti.py` — hlídač async návratových hodnot | **0 nálezů** |
| katalogy `apps.js` / `nodus/apps.js` | 264 + 250 položek, **0 chybějících souborů** |

---

## Co se nedotklo

Rozcestníky (hledání, oblíbené, nedávné, filtry Nodusu), `flashcards`, `chess`
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

### A2 · Nodus: 74 stránek mimo vlastní standard ✅

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

> **Zbývá do budoucna:** zbylých ~67 nestandardních stránek Nodusu jsou z velké
> části referenční a simulační (`periodic_table`, `optika`, `paka`,
> `slepa_mapa_evropa`…), kde `uloha.js` nedává smysl. Sjednocení jejich hlaviček
> je kosmetická práce na samostatnou dávku.

### A3 · Studijní deník nečetl, co už na disku bylo ✅

`edu_progress.html` si dřív musel uživatel naklikat celý ručně. Teď:

- **`uloha.js` vede deník činnosti** (`nodus_aktivita`) — u každé odpovědi zapíše
  datum, název stránky a poměr správně/pokusů. Název stránky bereme z adresy,
  protože klíče skóre se na soubory namapovat nedají (33 ze 171 má zkrácený tvar).
- Deník z toho **sám** počítá sérii dní, kalendář, celkový počet odpovědí
  a úspěšnost; předmět si dohledá v `nodus/apps.js`.
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

> Po nasazení zvyš verzi cache: `sw.js` je na `webapp-v71`, `nodus/sw.js` na
> `nodus-v31` — obojí už zvednuté touto dávkou.

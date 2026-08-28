# ◈ Nodus

Samostatný web s interaktivními výukovými aplikacemi pro základní školu —
čeština, matematika, cizí jazyky, prvouka a vlastivěda, přírodní vědy, zeměpis,
dějepis a informatika. Vše běží v prohlížeči, bez serveru a bez registrace,
po prvním otevření i offline (PWA + service worker).

Katalog je zároveň **kostrou osnov ZŠ**: 243 témat v 11 předmětech a 9 ročnících
plus 8 nástrojů bez vazby na předmět — dohromady 251 položek. Osnova je momentálně
pokrytá celá, žádné téma nezůstalo jen jako zástupce (🚧). Přehled je na stránce
[Osnova](obsah/osnova.html).

Živě: <https://lavionus.github.io/site/nodus/>

## Struktura

| Cesta | Obsah |
|---|---|
| `index.html` | rozcestník — menu, hledání, oblíbené, deep-linky přes `#obsah/…` |
| `apps.js` | katalog (jediný zdroj pravdy pro menu, hledání i úvodní přehled) |
| `obsah/prehled.html` | úvodní stránka v pracovní ploše (ročníky, předměty, tip dne, oblíbené) |
| `obsah/osnova.html` | mřížka ročníků × předmětů s přehledem pokrytí učiva |
| `obsah/*.html` | jednotlivé výukové aplikace |
| `obsah/lib/`, `obsah/textures/`, `obsah/Anatomy/` | knihovny a data aplikací |
| `common.css`, `theme.js` | sdílený vzhled a přepínání světlého/tmavého režimu |
| `podpis.js` | autorský podpis (`Nodus © Radovan Valenta · hdm@seznam.cz`) ve vlastním pruhu dole – patří do `<head>` **každé** stránky; název díla drží konstanta `DILO` |
| `rec.js` | čtení nahlas – systémový hlas, jinak vestavěný ze složky `hlas/` |
| `uloha.js` | společné chování úloh: zaklepání u chyby, zelená a automatický posun u správné odpovědi, skóre |
| `vyjmenovana.js` | řady vyjmenovaných slov (jediný zdroj pro doplňovačky, vyjmenovaná slova i diktáty) |
| `vyuka.css` | společný vzhled procvičovacích aplikací (plocha, možnosti, odezva, řazení, pravopisné díly) |
| `hlas/` | vestavěný syntetizér řeči (meSpeak/eSpeak, GPL) – viz `hlas/LICENCE.md` |
| `fonty/` | školní psací písmo Playwrite CZ (OFL) – viz `fonty/LICENCE.md` |
| `sw.js`, `manifest.webmanifest`, `icon-*.png`, `apple-touch-icon.png` | PWA (cache `nodus-vN`) |
| `logo.svg` | značka (uzel) pro manifest a další použití; v hlavičkách je stejná cesta vložená inline (bere barvu z motivu a nezávisí na načtení souboru) |
| `favicon.svg`, `favicon.ico` | ikona v záložce prohlížeče |
| `Logo/` | zdrojové obrázky značky + `build_ikon.sh`, který z nich generuje celou sadu |

## Katalog a osnova

Každá položka v `apps.js` má kromě `soubor`, `nazev` a `tagy` také:

| Pole | Význam |
|---|---|
| `predmet` | id z `KATALOG_PREDMETY` (`cj`, `m`, `aj`, `dcj`, `prv`, `inf`, `f`, `ch`, `pr`, `z`, `d`); nástroje bez vazby na předmět ho nemají |
| `rocniky` | ročníky ZŠ, kterých se téma týká — podle nich filtruje menu i mřížka osnovy |
| `stav` | `'plan'` u připravovaných témat; hotové aplikace pole nemají |

Menu filtruje ve třech nezávislých osách (předmět, ročník, zobrazení
připravovaných — ten se skryje, dokud katalog žádné `stav: 'plan'` neobsahuje)
a hledání jde napříč všemi. Stránka `obsah/osnova.html` počítá
mřížku pokrytí přímo z katalogu — druhý zdroj pravdy neexistuje.

Rozdělení témat do ročníků odpovídá obvyklé praxi českých ŠVP. RVP ZV samo
stanovuje očekávané výstupy po obdobích (1.–3. a 4.–5. ročník, 2. stupeň),
ne po jednotlivých ročnících. Revidované RVP ZV bylo schváleno v lednu 2025
a povinné bude od září 2027 pro 1. a 6. ročník.

## Generátor pracovních listů

`obsah/pracovni_listy.html` skládá tisknutelné listy z vlastního katalogu
generátorů úloh (konstanta `G` uvnitř stránky). Každé téma má stejná metadata
jako katalog Nodusu, takže se výběr filtruje ve dvou osách jako menu:

| Pole | Význam |
|---|---|
| `p` | hlavní předmět — id z `PREDMETY` (shodné s `KATALOG_PREDMETY` v `apps.js`) |
| `p2` | vedlejší předměty; krajská města patří do vlastivědy i zeměpisu a filtr je najde v obou |
| `r` | ročníky, kterých se téma týká — podle nich filtruje nabídka |
| `t`, `instr` | název tématu a pokyn nad úlohami na listu |
| `gen(d, R)` | vrátí `{q, a}` pro obtížnost `d` a generátor náhody `R` |
| `sig` | podpis tvaru úlohy — úlohy se pak rozprostřou mezi všechny tvary, aby se na listu neopakovala stejná věta |

Volba ročníku zúží seznam témat a předvyplní obtížnost (1.–3. lehká,
4.–6. střední, 7.–9. těžká). Jakmile si ji učitel přenastaví ručně, ročník
už do ní nesahá.

Řešení se výchozím nastavením tiskne **na zvláštní stránce** a **kód listu**
(podle něj se dá tentýž list vyrobit znovu) jde jen na ni — na listy pro žáky
se tiskne, jen když si to učitel přepne volbou *Tisknout kód listu*. Celé
nastavení včetně textů v hlavičce, vybraných témat a kódu listu se průběžně
ukládá do `localStorage` (`worksheet_gen_v2`), takže se stránka otevře tam,
kde ji učitel opustil.

Arch v náhledu je vždy bílý papír, proto uvnitř `.sheet-page` **nesmí být
proměnné motivu** — ve světlém režimu vycházelo `--bg-hover` na bílém papíře
jako neviditelná čísla úloh a linka na jméno, a to i v tisku.

## Psaní nové procvičovací aplikace

Stránka vystačí s krátkou kostrou – styly řeší `vyuka.css`, chování odpovědí `uloha.js`:

```html
<link rel="stylesheet" href="../common.css">
<link rel="stylesheet" href="../vyuka.css">
<script src="../theme.js"></script>
<script src="../podpis.js" defer></script>
<script src="../rec.js"></script>
<script src="../uloha.js"></script>
```
```js
const skore = Uloha.skore('nodus_muj_klic', document.getElementById('skore'));
Uloha.vyber({
  kam: plocha, odezva, moznosti: [{ klic: 'a', ikona: '🌷', popis: 'jaro' }, …],
  spravnyKlic: 'a', zpravaOk: '✅ …', poSpravne: skore.vyhodnot, dalsi: novaUloha,
});
```

K dispozici jsou i `Uloha.zamichej`, `Uloha.nahodne`, `Uloha.nahodneCislo` a `Uloha.trhni`
(pro vlastní úlohy typu klikání do obrázku nebo řazení do pořadí).

Volitelné pole `prodleva` říká, za jak dlouho se nabídne další otázka. Smí to být
i funkce `(napoprve) => ms` — stránky, které po odpovědi ukazují kartičku
s vysvětlením, potřebují delší pauzu, a po chybě ještě delší, protože právě
tehdy si má žák vysvětlení přečíst. Bez pole platí `Uloha.PRODLEVA` (900 ms).

## Pravopisné stránky

Stránky o pravopisu (`doplnovacky`, `vyjmenovana_slova`, `shoda_podmetu`,
`diktat_gen`, `cj2_tvrde_mekke`, `cj3_parove`, `cj2_abeceda`) drží stejný postup,
aby se dítě neučilo pokaždé nové ovládání. Díly na to jsou ve `vyuka.css`:

| Třída | K čemu je |
|---|---|
| `.veta-uloha` | věta nebo slovo s vynechaným písmenem; `.mezera.prazdna` je prázdné místo, `.mezera.doplneno` už doplněné |
| `.spoust` | písmeno, **podle kterého se pravopis rozhoduje** (obojetná souhláska, souhláska před i/y) – svítí žlutě už v zadání |
| `.podmet`, `.slovo-klik` | podtržený podmět a klikací slova ve větě (tečkovaná linka je vidět i na dotykovém displeji, kde není hover) |
| `.pravidlo` | kartička **proč** – ukáže se až po odpovědi (`.ok`), nebo na vyžádání jako nápověda (`.tip`) |
| `.rada` | pás vyjmenovaných slov; `span.sviti` rozsvítí to, o které v úloze šlo |
| `.pomucka` | trvalý přehled pod úlohou (souhlásky, páry, rody, abeceda); `.znak.sviti` rozsvítí právě probírané místo |
| `.klavesy`, `kbd` | klávesové zkratky vypsané u úlohy, ne až v patičce |
| `.pruh` | ukazatel postupu série |

Pravidla, která z toho plynou:

1. **Kde se rozhoduje, musí být vidět předem** (`.spoust`, podtržený podmět),
   **proč to tak je, až potom** (`.pravidlo.ok`). Kartička s pravidlem se nikdy
   neukazuje dřív než odpověď – jinak není co procvičovat.
2. **Nápověda zužuje, neprozrazuje.** Ukáže řadu, ve které se má hledat, rozsvítí
   souhlásku v přehledu, ztlumí polovinu možností — správnou odpověď neřekne.
3. **Chyba nezavírá úlohu.** Špatná možnost zaklepe a zčervená, otázka běží dál
   (řeší `uloha.js`); do skóre se počítá jen odpověď napoprvé.
4. **Přehled pod úlohou žije.** Souhláska, pár nebo rod se v něm po odpovědi
   rozsvítí — přehled tak není jen text, ale ukazuje, kam probíraný jev patří.

## Zpracování připravovaného tématu

Momentálně žádné připravované téma v katalogu není, ale mechanika zůstává pro
další rozšiřování osnovy. Placeholder stránka popisuje, co má aplikace umět,
a cituje očekávaný výstup RVP. Až téma zpracuješ:

1. Přepiš `obsah/<slug>.html` na skutečnou aplikaci
   (v `<head>` nalinkovat `../common.css`, `../theme.js` a `../podpis.js`).
2. V `apps.js` u položky **smaž pole `stav`** — tím zmizí značka 🚧 z menu
   a téma se v osnově přepne na hotové.
3. Zvyš verzi cache v `sw.js` (`nodus-vN`), jinak návštěvníci uvidí novinku
   až při druhém načtení.

## Přidání nového tématu

Záznam do příslušné sekce v `apps.js` (`soubor`, `nazev`, `tagy`, `predmet`,
`rocniky`, případně `stav: 'plan'`) a odpovídající stránka v `obsah/`.

## Psací písmo

Ve složce `fonty/` je **Playwrite CZ** – česká varianta školní psací abecedy
(OFL, plná diakritika, 68 kB). `common.css` ho deklaruje jako `--font-psaci`,
takže stránka jen napíše:

```css
.pismenko { font-family: var(--font-psaci); line-height: 1.9; }
```

Soubor se stáhne až ve chvíli, kdy ho stránka opravdu použije; v `sw.js` je
v `JADRO`, takže funguje i offline. Vysoký řádek není zbytečnost – psací tvary
mají nahoře kličku a dole smyčku a při `line-height: 1` lezou z rámce ven.

Zatím ho používá `obsah/cj1_pismena.html` (úloha *Velké a malé*), kde si dítě
přepne mezi tiskacím a psacím písmem; volba se pamatuje v `localStorage`.

## Čtení nahlas

Stránky s procvičováním umí předříkat zadání přes Web Speech API. Volá se přes
sdílený `rec.js`, nikdy ne přímo `speechSynthesis` – samotné `'speechSynthesis'
in window` je totiž pravda i v prohlížeči bez jediného nainstalovaného hlasu
a řeč se pak „přehraje“ do ticha.

```html
<script src="../rec.js"></script>
```
```js
Rec.mluv('máma', { rychlost: 0.8 });          // vrací false, když hlas chybí
Rec.hlidejTlacitko(document.getElementById('btnCist'));
Rec.poznamkaOHlasu(rodicovskyPrvek);          // vysvětlivka, když hlas chybí
```

Pořadí je dané: **systémový hlas** (zní nejlíp), a když žádný pro daný jazyk
není, sáhne se po **vestavěném hlasu** ve složce `hlas/` (meSpeak = eSpeak
v JavaScriptu). Web tak mluví i na počítači bez jediného nainstalovaného hlasu –
typicky na Linuxu, kde `speech-dispatcher` bez syntetizéru hlásí jen modul `dummy`.

Vestavěný hlas se stahuje **až při prvním přehrání** (jádro 1,5 MB, gzipem asi
0,5 MB), pak si ho service worker drží v cache a funguje i offline. Zní strojově;
hezčí je systémový hlas (na Linuxu `sudo pacman -S espeak-ng`, ověření
`spd-say -l cs "ahoj"`, pak restart prohlížeče).

Podporované jazyky vestavěného hlasu: čeština, angličtina, němčina, francouzština
(přidání dalšího popisuje `hlas/LICENCE.md`).

## Vazba na hlavní web

Nodus je záměrně samostatný — složku lze nasadit i na vlastní doménu nebo
do jiného repozitáře. Zůstávají jen tyto vazby na nadřazený web
(`../../obsah/`, po vyjmutí složky vedou do prázdna):

- `obsah/iss.html`, `obsah/planet_globe.html` → odkaz na `weather_globe.html` (glóbus počasí)
- `obsah/eduMaps.html` → odkaz na `map_export.html` (tvorba map)
- `obsah/prehled.html` (patička) a `index.html` (tlačítko *Ostatní aplikace*) → `../index.html`

Opačným směrem je hlavní web závislý na této složce jediným místem:
`obsah/weather_globe.html` používá textury Země z `../nodus/obsah/textures/`
(aby se 34 MB textur neduplikovalo). Při osamostatnění Nodusu je potřeba textury
zkopírovat zpět.

## Vývoj a nasazení

```bash
./test_local.sh          # z kořene repozitáře, pak http://localhost:8000/nodus/
./upload.sh "zpráva"     # commit + push na GitHub Pages
```

Testovat vždy přes lokální server — otevření přes `file://` blokuje CORS
(textury, fetch, moduly).

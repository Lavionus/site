# ◈ Nodus

Samostatný web s interaktivními výukovými aplikacemi pro základní školu —
čeština, matematika, cizí jazyky, prvouka a vlastivěda, přírodní vědy, zeměpis,
dějepis a informatika. Vše běží v prohlížeči, bez serveru a bez registrace,
po prvním otevření i offline (PWA + service worker).

Katalog je zároveň **kostrou osnov ZŠ**: 242 témat v 11 předmětech a 9 ročnících
plus 8 nástrojů bez vazby na předmět — dohromady 250 položek. Osnova je momentálně
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
| `rec.js` | čtení nahlas – systémový hlas, jinak vestavěný ze složky `hlas/` |
| `uloha.js` | společné chování úloh: zaklepání u chyby, zelená a automatický posun u správné odpovědi, skóre |
| `vyuka.css` | společný vzhled procvičovacích aplikací (plocha, možnosti, odezva, řazení) |
| `hlas/` | vestavěný syntetizér řeči (meSpeak/eSpeak, GPL) – viz `hlas/LICENCE.md` |
| `sw.js`, `manifest.webmanifest`, `icon-*.png` | PWA (cache `nodus-vN`) |

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

## Psaní nové procvičovací aplikace

Stránka vystačí s krátkou kostrou – styly řeší `vyuka.css`, chování odpovědí `uloha.js`:

```html
<link rel="stylesheet" href="../common.css">
<link rel="stylesheet" href="../vyuka.css">
<script src="../theme.js"></script>
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

## Zpracování připravovaného tématu

Momentálně žádné připravované téma v katalogu není, ale mechanika zůstává pro
další rozšiřování osnovy. Placeholder stránka popisuje, co má aplikace umět,
a cituje očekávaný výstup RVP. Až téma zpracuješ:

1. Přepiš `obsah/<slug>.html` na skutečnou aplikaci
   (v `<head>` nalinkovat `../common.css` a `../theme.js`).
2. V `apps.js` u položky **smaž pole `stav`** — tím zmizí značka 🚧 z menu
   a téma se v osnově přepne na hotové.
3. Zvyš verzi cache v `sw.js` (`nodus-vN`), jinak návštěvníci uvidí novinku
   až při druhém načtení.

## Přidání nového tématu

Záznam do příslušné sekce v `apps.js` (`soubor`, `nazev`, `tagy`, `predmet`,
`rocniky`, případně `stav: 'plan'`) a odpovídající stránka v `obsah/`.

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

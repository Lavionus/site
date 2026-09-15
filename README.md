# sites

Statický web se sbírkou malých HTML aplikací, hostovaný na GitHub Pages
(<https://lavionus.github.io/site/>). Bez backendu, data zůstávají v prohlížeči.

| Cesta | Web | Katalog | Stránky |
|---|---|---|---|
| `/` | hlavní rozcestník – 273 aplikací | `apps.js` | `obsah/` |

## Tři oddělené weby

Výukový web **Metodus** a jeho **ukázková stránka** tady od září 2026 nejsou.
Každý má vlastní složku, vlastní repozitář a vlastní GitHub Pages — schválně,
aby se z jednoho nedalo odmazáním adresy v prohlížeči dojít na druhý:

| Složka (vedle téhle) | Repozitář | Adresa |
|---|---|---|
| `---------------github_site` | `Lavionus/site` | <https://lavionus.github.io/site/> |
| `metodus` | `Lavionus/metodus` | <https://lavionus.github.io/metodus/> |
| `metodus-ukazka` | `Lavionus/metodus-ukazka` | <https://lavionus.github.io/metodus-ukazka/> |

Proto **tenhle web na Metodus nikde neodkazuje** — ani z menu, ani z úvodní
stránky, ani přesměrováním starých `#obsah/<výuková aplikace>` (neznámý hash
otevře domovskou stránku). Když se sem přidá odkaz na Metodus, ztratí celé
oddělení smysl.

Dvě věci si hlavní web kvůli tomu drží ve vlastní kopii:
`obsah/textures/8k_earth_{daymap,nightmap}.jpg` pro `obsah/weather_globe.html`
a `obsah/historicke_mapy_odkazy.html` pro mapové nástroje. Dřív si obojí půjčoval
z `metodus/`. Když se předloha v Metodusu změní, je potřeba kopii obnovit ručně.

```bash
./test_local.sh          # lokální server na http://localhost:8000 (nikdy file://)
./upload.sh "zpráva"     # nahraje VŠECHNY TŘI weby (ukázku si předtím vyrobí ze zdroje)
./upload.sh -n           # nasucho: ukáže, co by se nahrálo, a nic neodešle
```

Podpis autora (`Webové stránky © Radovan Valenta · hdm@seznam.cz`) vykresluje
`podpis.js` ve vlastním pruhu u spodní hrany okna (22 px, text vpravo) – Metodus
má ve svém repozitáři vlastní kopii s vlastním názvem díla (konstanta `DILO`
na začátku souboru). Každá nová stránka ho musí mít v `<head>`:
`<script src="../podpis.js" defer></script>`. Pruh obsah nepřekrývá: tělu se
přidá spodní odsazení, `100vh` v CSS stránky se zmenší o výšku pruhu a prvky
ukotvené napevno u spodní hrany se nad něj posunou. Uvnitř rozcestníku se
v iframu nekreslí, podpis tam patří nadřazené stránce.

Historii vytvořených tvarů v obou generátorech trubek (`obsah/tubeRed.html`,
`obsah/tubeSplit.html`) obsluhuje sdílený `tvary.js`: uloží nastavení stránky do
`localStorage` pod názvem (nezadaný se odvodí z rozměrů, např. `100 → 2× 40 mm`),
umí je znovu načíst, přepsat, přejmenovat, smazat a celou sbírku vyvézt nebo
nahrát ze souboru JSON. Stránka modulu dodá jen čtyři funkce (co uložit, jak to
nastavit zpět, krátký popis a kontrolu, že záznam patří jí); klíče jsou oddělené
(`webapp_redukce_tvary`, `webapp_rozbocka_tvary`) a export STL/OBJ se pojmenuje
podle naposledy uloženého či načteného tvaru.

Větší datové soubory leží vedle své stránky v `obsah/` a načítají se jako
klasický `<script>`, ne přes `fetch` – tím fungují i z `file://` a service worker
si je uloží při prvním otevření stránky. Slovník ke Scrabblu
(`obsah/scrabbleSlovnik.js`, 41 tis. tvarů, 366 kB) vznikl tak, že frekvenční
seznam českých slov z titulků (hermitdave/FrequencyWords) prošel pravopisným
slovníkem cs_CZ (LibreOffice/hunspell); postup je popsaný v hlavičce souboru.

**Kulturní akce v krajích** (`obsah/kulturni_akce.html`) staví na katalogu
`obsah/kulturniAkceData.js` – 100 tradičních každoročních akcí (hody, poutě,
výstavy, festivaly, vinobraní, adventní trhy) rozdělených podle krajů a druhu.
Celostátní akce mají kraj `CR` a zobrazují se vždy. Akce se opakují každý rok,
proto se neukládá rok, ale měsíc, volitelně den a slovní termín; stránka
dopočítá nejbližší budoucí výskyt. Vybrané kraje, filtry i vlastní akce
uživatele si stránka pamatuje v `localStorage` (`kulturni_akce_*`).
Volné celostátní API s kulturními akcemi neexistuje, katalog se proto rozšiřuje
ručně v datovém souboru.

**Scrabble anglicky** (`obsah/scrabble_en.html`) je stejná hra s anglickou sadou
kamenů a slovníkem `obsah/scrabbleSlovnikEn.js` (28 kB). Herní logika je kopie
`obsah/scrabble.html` – liší se jen sada, slovník, klíče v `localStorage`
(`webapp_hra_scrabble_en*`) a texty; **opravy v pravidlech nebo v generátoru tahů
je proto potřeba udělat v obou souborech**. Slovník je záměrně malý (~3 000
tvarů): je to školní slovní zásoba ZŠ, u které se dá u každého zahraného slova
ukázat český význam a počítač nehraje slova, která dítě nemůže znát. V souboru
se udržuje jen základ (`ZAKLAD` s významy, `NAVIC` bez nich) a odvozené tvary
(množné číslo, `-ing`, `-ed`, stupňování) se dopočítají při načtení.

**Solitaire** (`obsah/solitaire.html`) hraje Klondike s otáčením po jedné kartě
a neomezeným počtem kol balíčku – proto se dá při hledání tahu koukat i do
neotočených karet zásoby, na každou z nich se hráč dostane. Z toho žije
**Nápověda** (najde první užitečný tah; přesun uvnitř stolu nabízí jen tehdy,
když odkryje kartu nebo uvolní sloupec, jinak by posílala karty dokola)
i hláška **„žádný tah už není možný"**, která se ukáže sama po tahu, jímž se
partie zasekne. Tlačítko **Dokončit** se nabídne teprve tehdy, když si odklizení
na základy stránka nanečisto zkusí na kopii stavu a vyjde – pouhé „všechny karty
lícem nahoru" nestačí, karta potřebná na základ může být zavalená vyšší kartou
a automat by se zasekl v půli. Celé dokončení je v historii jeden krok, takže ho
Zpět vrátí najednou. Ze sloupce se smí brát jen sestupná řada střídavých barev
(`jeSekvence`) a na prázdný sloupec smí jen král – jako v pravidlech.

Po větší změně zvyš verzi cache v `sw.js` (`webapp-vN`) – jinak návštěvník uvidí
novou verzi až při druhém načtení. Metodus má svou vlastní v `../metodus/sw.js`.

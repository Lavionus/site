# Multijazyčnost – plán

Zadání (29. 10. 2026): web má být i anglicky. Výhledově přibudou další jazyky, takže
**přidání jazyka musí být jen „nový záznam + nové slovníky“** – bez zásahu do jádra a do stránek.

Rozsah: ~457 stránek, desítky tisíc českých řetězců, ~135 souborů kreslí text na plátno.
Ručně přepsat všechny stránky nejde → automatický překlad DOM + slovníky + nástroje na pokrytí.

## Zásady
- **Čeština zůstává zdrojem.** Stránky se nepřepisují, český text v HTML/JS je zároveň klíčem
  slovníku (styl gettext). Chybí-li překlad, zobrazí se čeština – nic se nerozbije.
- **Jazykově neutrální jádro.** Nikde v kódu žádné `if (jazyk === 'en')`. Vše jazykové je v rejstříku
  jazyků a ve slovnících; nástroje berou jazyk parametrem (`--jazyk en`).
- **Záložní řetězec jazyků** v rejstříku (např. `sk → cs`, `de → en → cs`): chybějící překlad se
  hledá v dalším jazyce řetězce, poslední je vždy čeština.
- **Bez build kroku, bez CDN, bez `fetch`.** Slovníky jsou `.js` soubory načítané `<script>`em
  (jako `apps.js`), takže fungují stejně jako zbytek webu.
- **Stránky vázané na Česko se nepřekládají** (tiskopisy NV 322/2025, QR platba SPAYD, tarify ERÚ,
  schodiště ČSN, právní dokumenty…) – pole `"jen_cs": true` u položky v `apps.js`, v katalogu štítek „jen česky“.
- **Obsahově těžké stránky** (gamebook, Voynich, model češtiny v Šifrách, časová osa) až úplně na konec,
  rozhodne autor.
- Pořadí vln: `beta` (316 stránek) před `vyvoj`; uvnitř podle sekcí katalogu.
- Kód, komentáře a názvy dál česky (viz CLAUDE.md).

## Architektura
| Soubor | Obsah |
|---|---|
| `i18n.js` | jádro (`I18N`): zjištění jazyka, načtení slovníků, překlad DOM, `t()`, formáty; vkládá se do `<head>` hned za `theme.js` |
| `i18n/jazyky.js` | **rejstřík jazyků** – jediné místo, kde jazyk „vzniká“: `{ kod: 'en', nazev: 'English', cesky: 'angličtina', vlajka: '🇬🇧', smer: 'ltr', zaloha: ['cs'], stav: 'vyvoj' }` |
| `i18n/<kod>/_spolecne.js` | sdílené texty: rozcestník, `dialog.js`, `podpis.js`, `rekord.js`, `tvary.js`, nastavení, sdílené GUI (`trubky_gui.js`, `karticky_tisk.js`…) |
| `i18n/<kod>/_katalog.js` | překlad katalogu: skupiny, sekce, stavy, `nazev` + `tagy` podle klíče `soubor` (`apps.js` se nemění) |
| `i18n/<kod>/<stranka>.js` | slovník stránky; větší stránky se složkou mohou mít `i18n/<kod>/<stranka>/<modul>.js` |
| `i18n/GLOSAR.md` | terminologie napříč jazyky (sloupec na jazyk) – aby „Uložit“, „Předloha“, „Díl“… byly všude stejně |
| `_test/i18n_*.{js,py}` | testy a nástroje (viz níže) |

**Slovník** se registruje voláním `I18N.pridej('en', { 'Uložit': 'Save', … })`.
Hodnota může být:
- řetězec – prostý překlad,
- vzor s parametry – `'Nalezeno {n} položek': { one: '{n} item found', other: '{n} items found' }`
  (tvary podle `Intl.PluralRules` daného jazyka, takže čeština i polština se 3–4 tvary fungují stejně),
- kontext při dvojznačnosti – klíč `'Otevřít@soubor'` vs. `'Otevřít@dveře'`, v kódu `t('Otevřít', {ctx:'soubor'})`.

**Jak jádro pracuje**
1. Jazyk: `?lang=` → `localStorage['webapp_lang']` → `navigator.languages` (první, který je v rejstříku) → `cs`.
   V iframu ho doručí rozcestník přes `postMessage({jazyk})` (stejně jako téma).
2. Je-li jazyk `cs`, jádro nedělá nic dalšího (nulová cena pro dnešní návštěvníky).
3. Jinak synchronně během parsování `<head>` přidá `<script>` se slovníky (`_spolecne` + stránka podle
   cesty) pro celý záložní řetězec. Seznam `i18n/<kod>/_seznam.js` říká, které stránky slovník mají
   (žádné 404). Do překladu `html[data-i18n-ceka]` skryje tělo (pojistka proti probliknutí, limit 3 s).
4. Po `DOMContentLoaded` projde textové uzly a atributy `title`, `placeholder`, `aria-label`, `alt`,
   `value` tlačítek, `<title>`; text normalizuje (mezery, okraje) a nahradí. Pamatuje si, co sám
   zapsal, aby už přeložený text nepřekládal znovu.
5. `MutationObserver` překládá, co stránka vykreslí později (hned v callbacku, ještě před vykreslením).
   Vynechá `<script>`, `<style>`, `<code>`, `contenteditable`, vstupy uživatele a prvky `[data-i18n="ne"]`.
6. `t()` pro to, co DOM nezachytí: plátno (`fillText`), PDF/DXF/SVG exporty, `Dialog.*`, skládané věty.
7. `<html lang>` a `dir` podle jazyka. Přepnutí jazyka = uložit + znovu načíst stránku
   (`I18N.nastav(kod)`, v iframu `postMessage({jazyk})` → reload) – žádné živé přepínání.

**Formáty:** `I18N.cislo()`, `I18N.datum()`, `I18N.mena()` přes `Intl` s kódem jazyka;
`I18N.precti('3,5')` přijme desetinnou čárku i tečku (vstupy na stránkách často počítají s čárkou).

## Nástroje
- **Extraktor** `python3 _test/i18n_vytahni.py <stranka> [--jazyk en] [--nanecisto]` – české řetězce z HTML i JS literálů
  (bez komentářů, bez klíčů localStorage, bez CSS) → doplní do slovníku chybějící klíče s hodnotou `null`
  a označí ty, které už ve zdroji nejsou (zastaralé).
- **Pseudojazyk `xx`** (v rejstříku, `stav: 'test'`, v přepínači skrytý): automaticky „přeloží“ vše na
  `⟦Ůložít·····⟧` – o 30–40 % delší, s hranicemi. Bez jediného ručního překladu ukáže, co jádro
  nezachytí a co přetéká na mobilu. Zároveň ověřuje, že přidání jazyka opravdu nepotřebuje změnu jádra.
- **Kontrola pokrytí** `python3 _test/i18n_pokryti.py [--jazyk en] [stranky…]` – otevře stránku v daném
  jazyce (jeden Chromium, postupně, izolovaný localStorage, úklid), vypíše texty, které zůstaly česky
  (diakritika / slova z českého slovníku), a přetečení prvků; výstup `% pokrytí` na stránku.
- **Přehled** `python3 _test/i18n_prehled.py [--jazyk en] [--stranky] [--zastarale] [--dalsi N]` – tabulka stránek: přeloženo / chybí / zastaralé,
  podle sekcí a stavů; souhrn pro každý jazyk z rejstříku.
- **Hlídač** (součást přehledu): stránka změněná po posledním překladu, nový řetězec bez překladu.

## Etapy
- [x] A. **Jádro.** `i18n.js` + `i18n/jazyky.js` (cs, en, pseudojazyk xx): zjištění jazyka, záložní
  řetězec, načtení slovníků, překlad DOM, `MutationObserver`, `t()` s parametry/plurály/kontextem,
  formáty a `precti()`. Testy `node _test/i18n_test.js [-v]` (41) a `python3 _test/i18n_ui.py` (29)
  na `_test/i18n_stranka.html` se slovníkem `i18n/en/_test/` (mimo git).
- [x] B. **Přepínač v rozcestníku.** Výběr jazyka v hlavičce (vedle tématu) generovaný z rejstříku,
  `postMessage` do iframu, `lang` na `<html>`, klíč `webapp_lang` v `nastaveni_klice.js`,
  načtení `i18n.js` do všech stránek (návrh: `theme.js` ho připíše přes `document.write` – je
  synchronně v `<head>` téměř všude, 20 stránek bez `theme.js` doplnit ručně),
  `i18n.js` + rejstřík + `_spolecne` do `JADRO` v `sw.js`. Text rozcestníku samotného.
- [x] C. **Sdílené moduly.** `dialog.js`, `podpis.js`, `rekord.js`, `tvary.js`, `nastaveni.html`,
  sdílená GUI (`trubky_gui`, `karticky_tisk`, horní menu podle vzoru prompty) → `i18n/en/_spolecne.js`.
  Založit `i18n/GLOSAR.md`.
- [x] D. **Katalog.** `i18n/en/_katalog.js` (skupiny, sekce, stavy, názvy, tagy), hledání v obou
  jazycích (český i anglický název najde stránku), dlaždice `aplikace.html`, `about.html` vč. podmínek,
  `"jen_cs": true` v `apps.js` + štítek „jen česky“ v menu a na dlaždici (štítek zatím ne – až se rozhodne seznam). Po tomhle je web použitelný anglicky
  na úrovni navigace.
- [x] E. **Nástroje.** Extraktor, pseudojazyk naplno, kontrola pokrytí, přehled + hlídač.
- [x] F. **Pilot (5 stránek různých typů).** Jednoduchá kalkulačka, `prompty.html` (menu, dialogy,
  IndexedDB), hra s plátnem, generátor s PDF exportem, stránka s modulovou složkou. Změřit čas na stránku,
  podíl textů, které vyžadují `t()`, opravit jádro. Zapsat poučení a odhad zbytku sem do plánu.
- [ ] G. **Vlna 1 – beta: Produktivita, Zdraví, Vaření, Příroda.**
- [ ] H. **Vlna 2 – beta: Tvorba & média, Technika, 3D.**
- [ ] I. **Vlna 3 – beta: Vývoj & data, Formuláře (jen ty, které nejsou v `jen_cs`), Vyšetřování, ostatní sekce.**
- [ ] J. **Vlna 4 – beta: Hry** (plátno přes `t()`, texty příběhů).
- [ ] K. **Vlna 5 – vyvoj:** zbylé stránky ve stavu vývoj.
- [ ] L. **Obsahově těžké stránky** – jen po rozhodnutí autora, jednotlivě.
- [ ] M. **Zakotvení do postupu.** CLAUDE.md: kontrolní seznam nové stránky (`i18n.js` v `<head>`,
  slovník pro všechny jazyky z rejstříku, nebo `"jen_cs": true` v `apps.js`), `_test/i18n_prehled.py` po každé
  změně textu; README – sekce o jazycích.

Každá vlna (G–K): extraktor → překlad → kontrola pokrytí (cíl ≥ 98 %, zbytek vědomě) → pseudojazyk
na mobilu 320 px (přetečení) → zvednout `sw.js`. Velká vlna se může rozdělit na víc sezení;
„pokračuj“ = další nepřeložená stránka podle `i18n_prehled.py --dalsi 5`.

## Jak přidat další jazyk (cíl návrhu)
1. Záznam do `i18n/jazyky.js` (kód, názvy, vlajka, směr, záložní řetězec, `stav: 'vyvoj'`).
2. `python3 _test/i18n_vytahni.py --z en --jazyk de` – založí `i18n/de/` se všemi klíči anglických slovníků
   (`null`, i `_seznam.js`); `--vse --jazyk de` je vytáhne znovu z češtiny. Tagy katalogu zůstanou z angličtiny (záloha)
   – vlastní přes `I18N.pridejTagy('de', …)`.
3. Nový sloupec v `i18n/GLOSAR.md`, pak překlad: `_spolecne` → `_katalog` → stránky po vlnách.
4. `i18n_pokryti.py --jazyk de`, `i18n_prehled.py --jazyk de`.
5. V přepínači se jazyk ukáže sám; dokud je `stav: 'vyvoj'`, jen s označením (posouvá autor).
Bez změny `i18n.js`, stránek i `apps.js`. Pravolevé písmo (`smer: 'rtl'`) jádro podporuje atributem
`dir`; rozvržení stránek by se ale muselo zvlášť zkontrolovat.

## Rozhodnutí autora (29. 10. 2026)
- Anglická verze má vlastní název webu i podpis (`DILO`, `ROZCESTNIK` v `podpis.js` přes `t()`) – etapa C.
- Tagy se přeloží **a** doplní anglickými synonymy pro hledání – etapa D.
- Jazyk podle prohlížeče; slovenština dostane češtinu, jazyky, které web nemá, angličtinu
  (`pribuzne`, `nahradni` v rejstříku).

## Stav etapy A (29. 10. 2026)
- `i18n.js`, `i18n/jazyky.js` (cs, en, xx), prázdné `i18n/en/_seznam.js` a `_spolecne.js`.
  Zatím je nenačítá žádná stránka – web se chová beze změny.
- DOM: textové uzly + `title`, `placeholder`, `aria-label`, `alt`, `label`, `value` tlačítek, `<title>`.
  Vynechá `script, style, noscript, code, pre, kbd, samp, textarea, [contenteditable], [data-i18n="ne"]`.
  Okraje bez písmen (emoji, `:`, čísla) se odříznou a přilepí zpět; klíče s `{param}` slouží i jako
  vzory pro text z DOM (`Nalezeno 12 položek`).
- Past pro vlny: stránka, která porovnává text prvku (`btn.textContent === 'Start'`), v angličtině
  selže – takové místo označit `data-i18n="ne"`, nebo porovnávat stav, ne text.

## Stav etap B–D (29. 10. 2026)
- **B:** `theme.js` připíše `i18n.js` přes `document.write` (je synchronně v `<head>` všude); 21 stránek bez
  `theme.js` má `<script src="../i18n.js">` přímo. V hlavičce rozcestníku tlačítko jazyka (kód „CS/EN“,
  nabídka z rejstříku, 🚧 = jazyk není stable) → uloží `webapp_lang` a načte rozcestník znovu (iframe s ním).
  `?lang=xx` volbu i uloží. Bez slovníku stránky zůstane `lang="cs"` a nic se neskrývá.
  `sweep.py` (517 stránek) bez chyb JS v `en` i v pseudojazyce `xx` (`SWEEP_LANG=xx python3 _test/sweep.py`).
- **C:** `i18n/en/_spolecne.js` (podpis, stavy, dialog, rekord, tvary.js), `nastaveni.js`, `i18n/GLOSAR.md`.
  Dialogy a tvary.js bez zásahu do kódu – složené věty pokrývají vzory (`Uloženo jako „{nazev}“`).
  `karticky_tisk.js` používají jen 2 stránky → přeloží se s nimi ve vlně (sdílený slovník přes `_seznam.js`).
  `trubky_gui.js` texty nemá.
- **D:** `i18n/en/_katalog.js` – 523 názvů (14 skupin, 49 sekcí, 463 stránek) + anglická hledací slova
  (`I18N.pridejTagy`, `I18N.tagy(soubor)`); přeloženo agenty, **ke kontrole autorem** (velikost písmen
  „Title Case“ vs. „Sentence case“ zatím nejednotná). Rozcestník i úvod hledají česky i anglicky
  (`I18N.preloz`), tip ukazuje anglické tagy. `aplikace.js`, `about.js` (s větou, že závazné je české znění).
  Sdílené slovníky: `I18N.seznam(kod, stranky, { _katalog: [...] })`.
- Při přidání stránky do `apps.js` teď navíc: záznam do `i18n/en/_katalog.js` (název + tagy).

## Stav etapy E (29. 10. 2026)
- `_test/i18n_nastroje.py` – společné jádro nástrojů: texty z HTML (textové uzly + atributy jako v i18n.js)
  a z JS (řetězce bez komentářů, regexů, `console.*`, klíčů úložiště a selektorů; `'A ' + x + ' B'` i šablony
  `` `A ${x}` `` → klíč se vzorem `A {x} B`; řetězce s HTML se rozeberou jako HTML), JS stránky = `<script src>`
  mimo kořen a `lib/` + importy + složka stejného jména. `Slovnik.zna()` hledá stejně jako prohlížeč
  (přesně, bez okrajů, vzorem), nový klíč bez emoji a dvojtečky na okrajích.
- `i18n_vytahni.py` – doplní `null` klíče (hotové nemění), založí slovník i záznam v `_seznam.js`;
  `--z en --jazyk de` založí nový jazyk (vyzkoušeno naostro, pak smazáno).
- `i18n_pokryti.py` – % pokrytí za běhu (`I18N.prelozene()` / `chybejici()`, počítají se jen texty, které
  vypadají česky), `-v` vypíše zbylé, `--zapis` je připíše do slovníku, `--preteceni` porovná rám 360 px
  česky × pseudojazyk a hlásí jen nová přetečení. Pseudojazyk u dlouhých textů vyplňuje po slovech.
- `i18n_prehled.py` – stav podle stavů stránek, `--stranky`, `--zastarale` (slova klíče už ve zdrojích nejsou),
  `--dalsi N` = co překládat dál. Pole `"jen_cs": true` u položky v `apps.js` stránku z překladu vyřadí
  (zatím u žádné – seznam navrhne pilot, rozhodne autor).
- Odhad objemu: extraktor najde ve 463 stránkách ~97 000 textů (průměr 210 na stránku, Skriptorium 256,
  Editor 22). Část jsou úlomky skládaných vět – skutečné číslo upřesní pilot.

## Stav etapy F – pilot (29. 10. 2026)
Přeloženo: `unit_converter` (kalkulačka, 121 klíčů), `pomodoro` (20), `had` (hra na plátně, 10),
`stencil` (generátor s PDF a složkou modulů, 179 + sdílený modul písem 100), `cviceni/index` (PWA
v podsložce s vlastním SW, 156). Všech 9 slovníků má za běhu 100 %, bez nových přetečení v 360 px.

**Postup na stránku (pro vlny G–K):**
1. `python3 _test/i18n_vytahni.py <stránky…>` – slovník s `null` (+ slovníky sdílených modulů).
2. Přeložit `null` klíče do JSON `{"česky": "anglicky" | {"one":…, "other":…}}` → `python3 _test/i18n_vypln.py <stránka> soubor.json`.
3. `python3 _test/i18n_pokryti.py <stránky…> --zapis -v --preteceni` → doplnit, co se ukáže až za běhu, znovu 2.
4. U her a plátna snímek okem (dialogy, hlášky po akci). `sw.js` +1.

**Poučení z pilotu (už zapracované do nástrojů / jádra):**
- Extraktor bere i texty bez diakritiky, když jsou v roli textu (`name:`, `label:`, `.textContent =`,
  `Dialog.*(`) a jednoslovné „Slovo“ s velkým písmenem; `…` a `{param}` na konci už nevadí.
- **Sdílené moduly:** JS soubor pod `obsah/`, který načítá víc stránek, dostane vlastní slovník
  `i18n/<kod>/<cesta modulu>.js` a v `_seznam.js` seznam stránek (automaticky). Zatím `fonty/fonty`
  (12 stránek), čekají `tiskopisy/*` (17), `trubky_gui` (15, bez textů), `krabicky/jadro` (13), `karticky_tisk` (2).
- **Parametry vzoru se překládají** (i vnořeným vzorem o úroveň): klíč `{n} {listu}` + klíče `list`/`listy`/`listů`
  zvládne české tvary skládané v kódu bez úprav stránky. Sousední parametry (`{kde}{n}`) rozdělit nejdou –
  takový klíč smazat a napsat ručně (`Vrstva {j}: {zprava}`).
- Obecné vzory bez českého textu (`{x} ms`) do slovníku nepatří – „přeložily“ by cokoli beze změny.
- PWA s vlastním service workerem (`cviceni/sw.js`) musí mít i18n soubory ve svém seznamu (+ verze).
- Hlas (speechSynthesis): `I18N.preloz(text)` a `I18N.locale` místo pevného `cs-CZ`.
- Názvy písem a podobná vlastní jména: překlad = stejný text (aby se nepočítaly jako chybějící).
- Úpravy stránek v pilotu: jen `cviceni/index.html` (hlas) a `cviceni/sw.js` – ostatní stránky beze změny.

**Odhad zbytku:** statický extraktor najde ~97 000 textů ve 463 stránkách (u pilotu odpovídal skutečnosti
±10 %). Ručně v jednom vlákně je to desítky sezení; reálné je překládat **vlny přes agenty** (jako katalog
v etapě D): agent dostane 5–10 stránek, udělá kroky 1–3 a vrátí souhrn, já zkontroluji pokrytí, vzorky
a snímky. Na vlnu 30–40 stránek odhadem 1 sezení.

**Rozhodnout autor před vlnami:**
- Které stránky zůstanou jen česky (`"jen_cs": true` v `apps.js`). Návrh: skupina Formuláře & tiskopisy
  (tiskopisy podle NV 322/2025 aj.), Právo & dokumenty, QR platba (SPAYD), tarif fix/spot (ERÚ),
  schodiště (ČSN), Metodus odkazy. Gamebooky a obsahově těžké stránky (Voynich, časová osa, Šifry – model češtiny) zvlášť.
- Jestli vlny pouštět přes agenty (spotřeba tokenů) – a kolik stránek na jednu vlnu.

# CLAUDE.md – web „sites“ (Lavionus/site)

Statický web se sbírkou ~410 malých HTML aplikací (nástroje, kalkulačky, hry,
3D generátory, simulace). Bez backendu a bez build kroku – co je na disku, to
jde na GitHub Pages: <https://lavionus.github.io/site/> (repo `Lavionus/site`,
větev `main`). Data uživatelů zůstávají v prohlížeči (localStorage / IndexedDB).

Autor: Radovan Valenta. **Komunikace česky** (s diakritikou), kód, názvy
proměnných i komentáře v duchu okolního kódu – tedy převážně česky.

## Pravidla, která se nesmí porušit

- **Nenasazovat.** `./upload.sh` ani `git push` nespouštět a nenabízet – nasazuje
  si autor sám. Po práci jen shrnout změny (včetně nové verze cache v `sw.js`).
- **Nová stránka v katalogu má vždy `"stav": "vyvoj"`.** Na `beta`/`stable` ji
  posouvá jen autor.
- **Po každé změně `apps.js`** (nová stránka, sekce, přejmenování, jiné emoji)
  spustit bez ptaní `node tools/generate-index-icons.mjs` (potřebuje Chromium,
  `magick`, `cwebp`).
- **Po změně čehokoli, co jde na web, zvednout `CACHE = PREFIX + 'vN'` v `sw.js`**
  (service worker je stale-while-revalidate – bez toho návštěvník vidí starou verzi).
- **Nikdy `file://`** – testovat přes `./test_local.sh` (http://localhost:8000).
  Port 8766 patří jinému webu (Metodus), testovací servery dávat jinam.
- Soubory v `_test/` nejsou v gitu a nemají zálohu – **před přepsáním přečíst**,
  nový pomocný skript pod vlastním jménem.
- Testy v prohlížeči úsporně (viz níže) a po sobě **uklidit Chromium**.
- Preferuj horni menu s rozbalovacimi tlacitky, zpřehlední to celou stranku. Vzor třeba stranka prompty.html.

## Struktura

| Cesta | Co to je |
|---|---|
| `index.html` | Rozcestník: menu vlevo, aplikace v `<iframe name="okno">`, otevírá se přes `#obsah/<soubor>.html` (`otevri()`), přepínač tématu, hledání, filtr stavu |
| `apps.js` | **Katalog – jediný zdroj pravdy** pro menu, hledání i úvodní dlaždice: `KATALOG_STAVY`, `KATALOG_SKUPINY`, `KATALOG_SEKCE[].polozky[]` |
| `obsah/*.html` | Jednotlivé aplikace (jedna stránka = jeden soubor; větší mají vedle sebe složku stejného jména s moduly, např. `obsah/modelar/`, `obsah/dron/`) |
| `obsah/aplikace.html` | Domovská stránka v iframu (dlaždice podle katalogu) |
| `obsah/about.html` | O projektu, `#podminky` = podmínky užívání |
| `obsah/nastaveni.html` + `nastaveni_klice.js` | Správa dat v localStorage/IndexedDB podle aplikací (⚙️ v hlavičce) |
| `obsah/lib/` | Lokální knihovny: three (r128 i 0.160), leaflet, maplibre, chart.js, jspdf, occt, manifold, sql.js, zxing, tesseract, ffmpeg, mediabunny… – **používat tyhle, ne CDN** |
| `common.css` | Sdílené barevné proměnné obou témat (`--bg`, `--bg-elevated`, `--text`, `--text-muted`, `--text-faint`, `--accent`, `--on-accent`, `--border`, `--danger`, `--ok`, `--warn`…) |
| `theme.js` | Světlé/tmavé téma (`webapp_theme`, do iframu přes `postMessage({tema})`) |
| `podpis.js` | Pruh s podpisem autora a štítkem stavu u spodní hrany (v iframu se nekreslí) |
| `dialog.js` | Náhrada alert/confirm/prompt: `Dialog.info/chyba`, `await Dialog.potvrd()`, `await Dialog.zeptej()` |
| `rekord.js` | Osobní rekordy her (`Rekord.sleduj('webapp_hra_…', {...})`) |
| `tvary.js` | Pojmenované uložené nastavení stránek (generátory trubek, cookieCutter, modelar, kleste, flowchart…) |
| `sw.js` | Service worker: `JADRO` (předcache), ostatní stránky se cachují při otevření |
| `assets/index-icons/` | Ikony menu – web používá jen `web-128/` + `ikony.js` (`KATALOG_IKONY`) |
| `tools/` | `generate-index-icons.mjs` (+ `index-icons-web.mjs`), skripty k Nahnoji |
| `*_PLAN.md`, `*_POPIS.md` | Plány a popisy velkých projektů po etapách (hry, Modelář, Dron, Písmolijna…) – „pokračuj" = vzít první neodškrtnutou etapu |
| `HRY_PLAN.md`, `NAVRHY.md` | Seznam her a návrhy dalších stránek (nedublovat existující) |
| `README.md`, `REVIZE.md` | Popis webu a jednotlivých stránek, zápis revizí |
| `_test/` | Testy a pomocné skripty (mimo git) |
| `tmp/`, `podzemi_kopie_*` | Pracovní/zálohové složky – nesahat, nepovažovat za součást webu |

Sousední složky `../metodus` a `../metodus-ukazka` jsou **samostatné weby
s vlastními repozitáři**. Tenhle web na Metodus odkazuje jen plnou adresou,
opačně ne. `upload.sh` nahrává všechny tři.

## Přidání nové stránky – kontrolní seznam

1. `obsah/<jmeno>.html`, `lang="cs"`, v `<head>` v tomto pořadí:
   ```html
   <link rel="stylesheet" href="../common.css">
   <script src="../theme.js"></script>
   <script src="../podpis.js" defer></script>
   ```
   Barvy jen přes proměnné z `common.css`; text na ploše `var(--accent)` má
   `color: var(--on-accent, #fff)` (nikdy natvrdo `#fff`). Funguje na mobilu
   (od 320 px) i v obou tématech.
2. Žádné nativní `alert/confirm/prompt` – `dialog.js` (volající funkce `async`).
3. Klíče localStorage s prefixem `webapp_` (hry `webapp_hra_*`); větší data
   (obrázky, soubory) do IndexedDB – localStorage má 5 MB na celý web.
   Stránka, která ukládá → `python3 _test/nastaveni_klice.py`.
4. Záznam do příslušné sekce v `apps.js` (`soubor`, `nazev` s emoji, `"stav": "vyvoj"`,
   `tagy`). **Vkládat textově** – formát souboru je smíšený, nepřeserializovávat
   přes `JSON.stringify`. Anglický název a hledací slova téže stránky do `i18n/en/_katalog.js`
   (viz `Multijazycnost_PLAN.md`).
5. `node tools/generate-index-icons.mjs`, zvednout verzi v `sw.js`.
6. Nový sdílený soubor → ověřit `git check-ignore -v <soubor>` (`.gitignore` má
   `*copy*`, `*kopie*`, `*.bak*` – tiše by se nenahrál). Sdílené moduly patří do `JADRO`.
7. Vlastní service worker stránky jen s úzkým `scope` (vzor `forecast-sw.js`).
8. Ručně stárnoucí data (sazby, ceny, zákonné částky) označit ve stránce datem
   a zmínit v souhrnu.
9. **Angličtina (i18n):** web je přeložený (`Multijazycnost_PLAN.md`). Nová stránka a každá změna
   textů → `python3 _test/i18n_vytahni.py <klíč>` (klíč = cesta pod obsah/ bez .html), přeložit `null`
   (`_test/i18n_vypln.py <klíč> preklady.json [--pridat]`), ověřit `_test/i18n_pokryti.sh <klíč> --zapis -v`.
   Čeština v kódu zůstává zdrojem – nepřepisovat na `I18N.t()`, jen kde je text mimo DOM a jádro ho
   nezachytí. Výstup v jiném jazyce než rozhraní (dokument, data uživatele) → `data-i18n="ne"`;
   plátno/PDF jen s daty uživatele → `<html data-i18n-platno="ne">`. Stránka vázaná na ČR → `"jen_cs": true`.
   Přehled: `python3 _test/i18n_prehled.py --stranky`.

## Testování

- Logiku testovat v **node** (`_test/<jmeno>_test.js`); větší stránky mají jádro
  v samostatném JS nebo vystavené přes `window.<JMENO>`, kód v IIFE jde vyříznout
  a spustit ve `vm` se stubem DOM.
- Prohlížeč: headless Chromium + `chromedriver` přes W3C WebDriver v `urllib`
  (Puppeteer/Playwright nejsou). Hotové nástroje:
  `_test/snimek_tropy.py stranka jmeno "JS akce"` (bezpečný snímek s hlídáním paměti),
  `_test/snimek_dom.py`, `_test/ovladani.py stranka scenar.json` (skutečná myš/klávesy),
  `_test/run.py` (testy v iframu), `_test/sweep.py` (načte všechny stránky a hlásí chyby JS),
  `_test/kontrast_audit.py` (WCAG obou témat), `_test/vykr_dpi.py` (HiDPI).
- Pasti: `--virtual-time-budget` zastaví `requestAnimationFrame` a falešně shazuje
  síť; `--dump-dom` končí při `load` (async práci utne); headless má min. šířku
  500 px (užší displej = iframe dané šířky); testy běží v DPI 1 – u plátna/WebGL
  ověřit i `--force-device-scale-factor=2`; WebDriver klávesy se překládají
  podle české QWERTZ (posílat přes CDP `Input.dispatchKeyEvent`).
- Paměť: jeden Chromium (`--renderer-process-limit=1 --disable-gpu
  --disable-dev-shm-usage`), stránky postupně, hlídat `MemAvailable`. Na konci
  `DELETE /session/<id>` **před** ukončením chromedriveru, zkontrolovat
  `pgrep -af "enable-automation|chromedriver"` a smazat vlastní
  `/tmp/.org.chromium.Chromium.*`. Cizí procesy nechat být.
- 3D sítě se ověřují měřením (těsnost hran, kladný objem, úhly normál), ne okem.
- `_test/syntaxe.py` je zastaralý (hledá neexistující `metodus/`).

## Další kontext

Podrobné poznámky k jednotlivým projektům (pasti, rozhodnutí, stav etap) jsou
v auto-paměti Claude Code (`~/.claude/projects/-mnt-sata-HOME-OSS-Workspace/memory/`,
index `MEMORY.md`) a v příslušných `*_PLAN.md`. Před prací na konkrétní stránce
se podívat tam a do README.md (`grep` podle názvu souboru).


SKILLS
Nasledujici soubory načítej jako další skills:
/mnt/sata/HOME/OSS_Workspace/.claude/Claude_Skills/Ponytail.md — režim FULL
/mnt/sata/HOME/OSS_Workspace/.claude/Claude_Skills/Caveman.md — režim LITE
Pravidla aplikuj po celou dobu konverzace.

Ponytail řídí způsob implementace kódu.
Caveman řídí stručnost komunikace.

Při konfliktu mají přednost bezpečnost, správnost a explicitní požadavky uživatele.
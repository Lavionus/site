# Ikony rozcestníku

Samostatný balík ikon pro `index.html`, určený k následnému zapojení do rozhraní.
Generátor čte aktuální katalog z `apps.js`; samotné stránky ani katalog nemění.

Struktura:

- `svg/` – zdrojové škálovatelné ikony,
- `png/` – 256×256 px s průhledným okolím,
- `webp/` – optimalizované varianty 256×256 px,
- `manifest.json` – přesná vazba ikony na kategorii, sekci a soubor stránky.

Názvy jsou stabilní a nezaměnitelné: například stránka
`obsah/modelar.html` má soubory `page-modelar.*`. Vnořená cesta se zapisuje
pomocí `--`. Ikony kategorií začínají `category-`, ikony sekcí `section-`.

Každá ikona používá významový symbol z katalogu, barevnost hlavní kategorie,
monogram a krátký kontrolní kód odvozený z jednoznačného ID. Kontrolní kód
pomáhá rozeznat i položky, které v původním katalogu používají stejný symbol.

Regenerace z kořene webu:

```bash
node tools/generate-index-icons.mjs
```

Požadavky generátoru: Node.js, Chromium, ImageMagick (`magick`) a `cwebp`.

## Zapojení do webu

Rozcestník (`index.html` – menu, sekce, kategorie) a úvodní stránka
(`obsah/aplikace.html` – dlaždice) berou ikony z `web-128/` (kompaktní varianta 128×128 px, ~2,4 kB/ks: stejné
barvy a symbol, ale symbol přes celou dlaždici a bez monogramu a kódu, které
na velikosti ~28 px v menu nejdou přečíst) přes mapu `ikony.js`
(`KATALOG_IKONY`). Obojí vyrábí `node tools/index-icons-web.mjs`
z `manifest.json` a `svg/`; generátor výše ho
spouští na konci sám. Co v mapě chybí (nová stránka před přegenerováním),
zobrazí se dál s emoji z názvu – po přidání stránky nebo sekce do `apps.js`
stačí balík přegenerovat. Na web jdou jen `svg/`, `web-128/`, `ikony.js`
a `manifest.json`; `png/` a `webp/` (256 px) jsou v `.gitignore`.

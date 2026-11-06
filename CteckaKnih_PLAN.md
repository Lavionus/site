# Čtečka knih – plán vylepšení

Zadání (6. 11. 2026): univerzální čtečka `obsah/ctecka_knih.html` (knihovna v IndexedDB + společná
čtečka `obsah/ctecka/`). Udělat vše z návrhů kromě nových formátů (FB2, PDF, MOBI HUFF/CDIC)
a navíc: **knihy, které autor napíše, leží na webu ve složce a v dialogu přidání knihy se z ní dají
vybrat a napojit** (napojená kniha se sama aktualizuje, když se na webu změní).

Kód: `ctecka/knihovna.js` (úložiště, správce, spuštění čtečky), `ctecka/prevod.js` (formáty),
`ctecka/ctecka.js` + `sablona.js` (společná čtečka – změny platí i pro Kroniky a Povídky).
Testy: `node _test/ctecka_knih_test.js`, `python3 _test/ctecka_knih_ui.py`, regrese Kronik
`node _test/kroniky_test.js`, `python3 _test/kroniky_ui.py`, `python3 _test/kniha_povidky_ui.py`.

## Etapy
- [x] 1. **Knihy z webu**: složka `moje_knihy/` v kořeni webu (od 6. 11. odpoledne; soubor `.md/.txt/.epub/.mobi`
      nebo složka s kapitolami `*.md` a obrázky; seznam generuje sám upload.sh i test_local.sh), `python3 tools/vlastni_knihy.py [zdroj…]` zkopíruje zdroje a vygeneruje
      `seznam.json` (název, autor, soubory, obrázky, slova, otisk). Dialog „Přidat knihu“: ze zařízení,
      celá složka, knihy z webu. Napojená kniha (`meta.web`) se při otevření knihovny i čtečky
      aktualizuje podle otisku; pozice drží stabilní jména kapitol (podle názvu, ne pořadí).
- [x] 2. **Hromadné načtení složky** (`webkitdirectory`): knihy po jedné (paměť), průběh, zrušení,
      duplicity tiše přeskočit a na konci shrnout.
- [x] 3. **Záloha celé knihovny** do jednoho ZIP (knihy, obrázky, obálky, pokrok, poznámky, deník)
      a obnova (sloučení, stejné id = nahradit).
- [x] 4. **Rozečtené nahoře** (pruh „Pokračovat ve čtení“), **série** (calibre:series z EPUB,
      odhad z názvu, ruční úprava) s řazením po sériích, **okno úprav knihy** (název, autor, série,
      díl, obálka z obrázku, hodnocení, poznámka).
- [x] 5. **Čtenářský deník**: začato / dočteno (datum), hodnocení, poznámka, roční cíl, statistiky
      (knih a slov za rok, čas čtení ze stavu čtečky), seznam dočtených po letech.
- [x] 6. **Úprava kapitol**: přejmenovat, spojit s předchozí, smazat (kontrola rozdělení po převodu).
- [x] 7. **Slovníček a překlad** ve výběrové liště čtečky (Wikislovník, překlad) – i Kroniky.
- [x] 8. **Stránkování** jako na čtečce: listování po obrazovkách klepnutím/přejetím, bez useknutého
      řádku dole – volba v Zobrazení, i Kroniky.
- [x] 9. **Hlas Piper** v předčítání čtečky (stejné hlasy a mezipaměť `piper-hlasy` jako Předčítač,
      přehrávání přes `<audio>` kvůli zamčené obrazovce) – i Kroniky.
- [x] 10. **Angličtina** rozhraní čtečky a knihovny (i18n), u Čtečky knih zrušit `jen_cs`.

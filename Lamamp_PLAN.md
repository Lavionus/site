# Winamp – plán

Zadání (29. 10. 2026): webová stránka, která vypadá jako tehdejší Winamp (2.x) a přehrává načtené písničky.
Vlastní implementace, žádný Webamp. **Citová záležitost – jde o věrnost a detail, ne o rychlost.**

Stránka: `obsah/lamamp.html` + `obsah/lamamp/` · v `apps.js` stav `"vyvoj"`, pak ikony + `sw.js`.
Testy: `node _test/lamamp_test.js [-v]`, `python3 _test/lamamp_ui.py [dpi]`, `python3 _test/lamamp_snimek.py`.

## Zásady
- **Originální grafika Nullsoftu se nekopíruje** (base skin je jejich). Výchozí skin si nakreslíme sami
  „v duchu“ Winampu 2.x: stejné rozměry, rozvržení, pixelové písmo, zelený LCD, kovové zkosené hrany.
  Kdo má vlastní `.wsz`, nahraje si ho a uvidí přesně to, co tenkrát (etapa I).
- **Pixelová přesnost:** okna mají originální rozměry (hlavní 275×116, EQ 275×116, playlist 275×232+,
  zmenšené 275×14). Kreslí se v logických pixelech a celočíselně se zvětšují (1×/2×/3×, „double size“
  jako Ctrl+D), `image-rendering: pixelated`. Musí to být ostré i na DPI 1,25/1,5 (past z paměti:
  headless běží v DPI 1 → snímky dělat i s `--force-device-scale-factor`).
- **Chování jako originál:** rolující titulek (lze chytit a posunout myší), blikající čas při pauze,
  kliknutí na čas = zbývající/uplynulý, kliknutí na vizualizaci = přepnutí režimu, tooltipy kurzorem,
  přichytávání oken k sobě a k okraji (snap 10 px), posun skupiny přichycených oken spolu.
- **Vše lokálně:** soubory se nikam neodesílají, žádné CDN, žádné závislosti mimo `obsah/lib`.
- Nad „plochou“ s okny horní menu s rozbalovacími tlačítky jako na webu (vzor `prompty.html`):
  Soubor (přidat soubory/složku, playlist), Vzhled (skin, velikost 1×/2×), Nápověda (zkratky, iPhone).
  Plocha pod ním je tmavá a s tématem webu se nemění – Winamp má vlastní skin.
- Všechny texty česky, ale popisky tlačítek a LCD zůstávají „winampovské“ (PLAY, EQ, PL, kbps, kHz).

## Architektura modulů (`obsah/lamamp/`)
| Soubor | Obsah |
|---|---|
| `jadro.js` | stav přehrávače (WA_JADRO): playlist, pořadí shuffle, repeat, výběr, časy; čisté funkce, běží i v node |
| `zvuk.js` | Web Audio řetězec: `<audio>` → preamp → 10× Biquad (peaking, krajní shelf) → balance (StereoPanner) → gain → analyser → výstup; crossfade dvěma `<audio>` |
| `tagy.js` | parser ID3v1/v2.2–2.4 (vč. UTF-16, APIC obal), Vorbis comment (OGG/FLAC), MP4 atomy (M4A); délka a bitrate (Xing/VBRI hlavička) |
| `skin.js` | výchozí skin kreslený kódem do plátna + načtení `.wsz` (vlastní mini-unzip přes `DecompressionStream('deflate-raw')`, BMP přes `createImageBitmap`), `viscolor.txt`, `pledit.txt`, `region.txt` |
| `okna.js` | správce oken: tažení, přichytávání, z-index, windowshade, double size, uložení pozic |
| `hlavni.js` | hlavní okno: LCD číslice, titulek, kbps/kHz, mono/stereo, posuvníky, tlačítka, clutterbar (O A I D V) |
| `ekvalizer.js` | 10 pásem + preamp, ON/AUTO, křivka, předvolby (vestavěné Winamp sady + vlastní), import/export `.eqf` |
| `playlist.js` | seznam, výběr (Shift/Ctrl), přetahování, hledání (J = jump to file), menu ADD/REM/SEL/MISC/LIST, `.m3u`/`.m3u8`/`.pls` |
| `vizualizace.js` | spektrum (19 sloupců s padajícími vrcholky, jako originál), osciloskop (tečky/čáry/plný), vypnuto; 60 fps jen když hraje |
| `uloziste.js` | IndexedDB: playlist, nastavení, EQ, skiny; volitelně i samotné soubory (viz iPhone) |
| `ovladani.js` | klávesy (Z X C V B, šipky, J, L, Ctrl+D, R, S…), Media Session, dotyk |

## Etapy
- [x] A. **Výchozí skin a hlavní okno (statické).** Pixelový skin kódem: rám, titulní lišta (aktivní/neaktivní),
  LCD číslice 9×13, malé písmo 5×6 pro titulek a kbps, tlačítka ve stavech normál/stisk, posuvníky.
  Snímek proti ruční kontrole – tady se nespěchá, je to „obličej“ celé stránky.
- [x] B. **Přehrávání.** Načtení souborů (tlačítko ⏏, `<input multiple>`, drag & drop), play/pause/stop/
  předchozí/další, posun, hlasitost (barva posuvníku mění odstín jako v originále), balance, čas,
  rolující titulek, kbps/kHz/stereo, shuffle/repeat.
- [x] C. **Tagy.** `tagy.js` + test na vzorcích vyrobených v testu (ID3v1, v2.3 UTF-16, v2.4 UTF-8, FLAC, OGG, M4A).
  Formát titulku „Interpret - Název“ jako Winamp, záloha podle jména souboru.
- [x] D. **Playlist.** Okno se změnou velikosti (po 25×29 px), výběr, přetahování, mazání, řazení,
  celkový čas „0:00/12:34“, dvojklik = hraj, menu tlačítek dole, M3U/PLS, přidání složky
  (`webkitdirectory`, na iPhonu nejde).
- [x] E. **Vizualizace.** Analyser → 19 sloupců (logaritmické rozdělení pásem, útlum a vrcholky
  jako originál), osciloskop, barvy z `viscolor.txt`. Výkon: jedno plátno, žádné alokace ve smyčce.
- [x] F. **Ekvalizér.** Biquad řetězec, preamp, ON/AUTO, křivka, předvolby, `.eqf`.
  Test: frekvenční odezva přes `getFrequencyResponse` odpovídá posuvníkům.
- [x] G. **Okna.** Tažení, přichytávání, windowshade (hlavní i EQ i playlist), double size, zavírání
  a otevírání přes tlačítka EQ/PL, uložení rozložení.
- [x] H. **Paměť a ovládání.** IndexedDB, klávesové zkratky, Media Session (obal, interpret, ovládání
  z klávesnice/sluchátek/zamčené obrazovky), crossfade (volitelný), menu pravým tlačítkem.
- [x] I. **Skiny `.wsz`.** Mini-unzip, mapování všech bitmap (main, cbuttons, titlebar, shufrep, posbar,
  volume, balance, monoster, playpaus, numbers/nums_ex, text, eqmain, eq_ex, pledit, gen),
  chybějící části doplnit z výchozího skinu, `region.txt` = tvar okna (clip-path). Knihovna skinů v IndexedDB.
- [x] J. **iPhone a dotyk** (viz níže) – mobilní rozvržení, ověření na skutečném zařízení.
- [x] K. **Leštění:** „It really whips the llama's ass“ úvodní zvuk – NE originální nahrávka (autorská),
  vlastní krátký syntetický „ding“ nebo nic; About okno; nápověda; offline přes `sw.js`.

## iPhone (Safari na iOS) – co se stane a co s tím
Stránka poběží, ale iOS má svá omezení:
- **Načítání:** soubory jdou vybrat z aplikace Soubory / iCloud Drive (i více najednou). **Složku vybrat nejde**
  a drag & drop na iPhonu prakticky není → tlačítko „Přidat soubory“ musí být velké a zřetelné.
  Hudba z aplikace Hudba (Apple Music) **dostupná není** – web k ní nemá přístup (DRM).
- **Formáty:** MP3, M4A/AAC, ALAC, WAV, FLAC ano; OGG/Opus jen na novějším iOS (18.4+), jinak hláška.
- **Hlasitost:** `audio.volume` iOS ignoruje → hlasitost řídíme přes `GainNode` (máme ji v řetězci, takže funguje).
- **Zamčený displej / pozadí:** největší riziko. Když jde zvuk přes Web Audio (kvůli EQ a vizualizaci),
  iOS při zamčení obrazovky AudioContext pozastaví a hudba ztichne. Řešení k ověření na zařízení:
  přepínač „Hrát i se zamčeným displejem“ = při skrytí stránky obejít Web Audio a hrát přímo `<audio>`
  (bez EQ, vizualizace stejně není vidět). Další skladba v pozadí přes `ended` + Media Session.
- **Tlačítko ztlumení (silent switch):** Web Audio by se jím umlčelo → `navigator.audioSession.type = 'playback'`
  (Safari 17+), jinak upozornění.
- **Spuštění zvuku** jen po dotyku (autoplay politika) → AudioContext odemknout při prvním dotyku.
- **Displej:** iPhone má ~390 bodů na šířku, okno 275 px → zvětšení ~1,4×; na výšku okna pod sebou
  (hlavní, EQ, playlist), bez volného tažení. Originální tlačítka jsou drobná (23×18 px) → necháme
  vzhled, ale zvětšíme neviditelné dotykové plochy (min. 44 bodů) a posuvníky ovládáme tažením kdekoli v řádku.
  Na šířku (landscape) lze 2× a vedle sebe. Dvojklik = dvojí ťuknutí, pravé tlačítko = dlouhý stisk.
- **Paměť playlistu:** odkazy na vybrané soubory po zavření stránky na iOS neplatí → playlist přežije
  jen když soubory zkopírujeme do IndexedDB (volba „Pamatovat si skladby“, ukazatel obsazeného místa).
  Safari maže data webu nepoužitého 7 dní – neplatí, když je stránka přidaná na plochu.
- **Na plochu (PWA):** po „Přidat na plochu“ běží na celou obrazovku jako aplikace – doporučený způsob.
- Klávesové zkratky na iPhonu nejsou (jen s Bluetooth klávesnicí).

Pozn.: headless test iPhone neodhalí (zamčený displej, silent switch, výběr souborů) → po etapě J
ověřit ručně na skutečném iPhonu, seznam kontrol bude v nápovědě k testu.

## Testy
- `_test/lamamp_test.js` (node): jádro playlistu (shuffle bez opakování, repeat, mazání aktuální), tagy na
  vygenerovaných vzorcích, mini-unzip (stored + deflate), BMP čtení, předvolby EQ, `.eqf`/`.m3u`/`.pls`.
- `_test/lamamp_ui.py` (headless Chromium, jeden prohlížeč, izolovaný localStorage, DELETE session po testu):
  vygeneruje krátký WAV (sinus 440 Hz + 2 kHz), načte ho, ověří běh času, nenulová data ve vizualizaci,
  že EQ na 2 kHz mění spektrum, playlist, přetažení oken a přichycení, klávesy.
- `_test/lamamp_snimek.py`: snímky v DPI 1 / 1,5 / 2 a mobilní viewport 390×844 (dotykové emulace).

## Stav etapy A (29. 10. 2026)
- `winamp/skin.js` (WA_SKIN): 11 archů ve formátu bitmap .wsz (main, titlebar, cbuttons, numbers, text, playpaus,
  monoster, posbar, volume, balance, shufrep), vlastní písmo 5×6 s rozložením text.bmp, nápis v liště `NAZEV = 'LAMAMP'`, lama místo loga.
- `winamp/hlavni.js` (WA_HLAVNI): sprity, oblasti myši, posuvníky, čas, titulek – bez DOM.
- `lamamp.html`: lišta (Vzhled: velikost auto/1×/2×/3×, pozadí tmavé/Windows 98), měřítko celočíselně v pixelech
  zařízení (ostré i na DPI 1,25/1,5), přesun okna za lištu, D = 2×, ukázkové skladby; `window.WA_APP.stav` pro testy.
- Testy: `node _test/lamamp_test.js` (25), `python3 _test/lamamp_snimek.py [dpi] [--archy]` (snímky + 9 kontrol skutečnou myší).
- Pozn.: SHUFFLE (164+47) a REPEAT (210) se o 1 px překrývají – stejně jako v originále.

## Stav etap B–K (29. 10. 2026)
- Hotovo vše; moduly `tagy.js`, `jadro.js`, `zvuk.js`, `vizualizace.js`, `ekvalizer.js`, `playlist.js`, `okna.js`, `uloziste.js`, `app.js`.
- Úvodní zvuk (etapa K) vynechán – originál je autorský a vlastní „ding“ by rušil; místo toho okno O programu (klik na lamu).
- Neověřeno na skutečném zařízení: iPhone (zamčený displej, tlačítko ztlumení, výběr z aplikace Soubory) a internetová rádia (test běží bez sítě).
- Výchozí výška playlistu 145 px (aby se 3 okna ve 2× vešla na běžný monitor).

## Rozšíření: složky na ploše (29. 10. 2026)
- [x] Ikony složek vedle oken (Win98: dvojklik přehraje, výběr šrafováním, zástupce = šipka, hrající = zelený trojúhelník), barvy, přejmenování, vlastnosti.
- [x] Chrome/Edge: zástupce složky na disku (showDirectoryPicker, přetažení složky na plochu); ostatní prohlížeče a iPhone: kopie v IndexedDB.
- [x] Přetažení ikony na playlist = přidat, na hlavní okno = přehrát, jinam = přesun (poloha se pamatuje); nabídka plochy (nová složka, seřadit ikony, pozadí).
- Test: `_test/lamamp_ui.py` simuluje složku na disku přes OPFS (`navigator.storage.getDirectory()`).

## Vestavěné skiny (29. 10. 2026)
- [x] 9 dalších motivů výchozího skinu přemapováním barev podle role (neutrální/akcent/displej), světlé motivy s tmavými ikonami; menu Skiny: Vestavěné / Načtené (.wsz).

## Rozhodnutí
- 29. 10. 2026: název **Lamamp** všude (stránka `obsah/lamamp.html`, klíče `webapp_lamamp*`); slovo Winamp se v aplikaci nezobrazuje. Pamatování skladeb zapnuté jako výchozí. Nabídky playlistu se kreslí až po textu seznamu.
- 29. 10. 2026: vlastní implementace místo Webampu; žádná originální grafika ani zvuky Nullsoftu.

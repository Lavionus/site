# Plán: 🅰️ Písmolijna – editor písma (od 23. 10. 2026)

Editor fontů v prohlížeči se schopnostmi FontForge a něčím navíc: mřížka znaků, editor obrysů
s Bézierovými křivkami, metriky a kerning, ligatury, kontrola chyb, booleany, obtažení, zesílení,
kurzíva, automatické české akcenty, obtahování obrázku, interpolace dvou řezů a export do
TTF / OTF / WOFF / SVG. Vše běží lokálně, bez účtu a bez serveru.

**Písmolijna je vlastní aplikace, ne port FontForge** (GPL-3.0) – přebírají se jen myšlenky a seznam funkcí,
kód se nepřebírá. Knihovny: opentype.js (MIT, čtení fontů a zápis OTF/CFF), Clipper 6.4.2 (Boost,
2D booleany a ofset). Zápis TrueType (glyf/loca, cmap, kern, GSUB) je vlastní.

## Rozhodnutí

1. **Název Písmolijna**, soubory `obsah/pismolijna.html` + `obsah/pismolijna/{jadro,ui}/*.js`, jmenný prostor `PSL`.
2. Čistý JS bez sestavování. Logika bez DOM běží v node (testy `_test/pismolijna_*.js`), výstup TTF se ověřuje fontTools.
3. **Vnitřní model = kubické křivky** (body jako UFO: `l` úsečka, `c` kubický bod na křivce, `o` řídicí bod, `s` hladký).
   Kvadratické obrysy z TrueType se při importu převádějí přesně, při exportu TTF se kubiky aproximují (tolerance 0,5 jednotky).
4. Vnější obrysy **po směru hodinových ručiček** (y nahoru, konvence TrueType); „Opravit směr“ to srovná.
5. Projekt se ukládá automaticky do IndexedDB `webapp_pismolijna`; export/import projektu jako `.pismo.json`.
   Hotový font jde jedním tlačítkem poslat do sdílených fontů webu (`FONTY.pridej`, IndexedDB `webapp_fonty`) –
   hned je pak k dispozici ve 3D textu, Převodníku písma apod.
6. Česky, jednotky = jednotky em (výchozí 1000/em).

## Datový model (smlouva)

```js
font = {
  format: 'pismolijna', verze: 1,
  info: { rodina, styl, verzeFontu, copyright, designer, licence, url, popis,
          upm, ascender, descender, xVyska, vyskaVerzalek, lineGap, sklon, podtrzeniPoz, podtrzeniTl,
          vaha, sirkaTrida },
  poradi: ['.notdef', 'space', 'A', …],        // pořadí glyfů ve fontu (GID)
  glyfy: { A: glyf, … },
  kerning: { A: { V: -80 }, '@kulate_L': { … } },  // levý → pravý → hodnota; klíč '@…' = skupina
  skupiny: { '@kulate_L': ['O', 'C', …] },
  ligatury: [ { z: ['f', 'i'], na: 'f_i' } ],
  vodidla: [ { osa: 'y', poz: 500, nazev: '' } ]
}
glyf = {
  nazev, uni: [0x41], sirka: 600,
  obrysy: [ { body: [ {x, y, t: 'l'|'c'|'o', s: bool} ], otevreny?: true } ],
  komponenty: [ { glyf: 'a', m: [xx, xy, yx, yy, dx, dy] } ],
  kotvy: [ { nazev: 'top', x, y } ],
  pozadi?: { obrysy, obrazek?: {data, x, y, meritko, pruhlednost} },
  barva?: '#rrggbb', poznamka?: ''
}
```

Uzavřený obrys: body jdou cyklicky, za posledním bodem pokračuje první. Bod `c` předcházejí právě dva `o`.

## Soubory a moduly

| Soubor | Obsah | node |
|---|---|---|
| `jadro/model.js` | nový font/glyf, názvy glyfů (AGL pro latinku), cmap, rozložení komponent, obálka, LSB/RSB, Unicode bloky | ✔ |
| `jadro/krivky.js` | segmenty, obálka, plocha a směr, zploštění, dělení kubiky, nejbližší bod, kubika↔kvadratika, proložení bodů křivkou (Schneider), extrémy, zjednodušení, zaokrouhlení | ✔ |
| `jadro/operace.js` | transformace, booleany (Clipper + proložení), ofset/obtažení, zesílení, kurzíva, opravy směru, sestavení akcentů, automatické mezery a kerning, interpolace | ✔ |
| `jadro/kontrola.js` | hledání chyb (otevřené obrysy, směr, chybějící extrémy, body blízko sebe, samoprůniky, neceločíselné souřadnice, prázdné/nepoužité glyfy…) | ✔ |
| `jadro/export.js` | vlastní zápis TTF (glyf, loca, cmap 4+12, head, hhea, hmtx, maxp, name, OS/2, post, kern, GSUB liga, GPOS kern), WOFF (deflate), SVG font, OTF přes opentype.js | ✔ |
| `jadro/import.js` | TTF/OTF/WOFF přes opentype.js → model (vč. kerningu a ligatur, kde jdou přečíst), SVG cesta → obrysy, projekt `.pismo.json` | ✔ |
| `jadro/obtah.js` | obtahování obrázku (práh, hranice, zjednodušení, proložení křivkami), šablona pro ruční písmo | ✔ |
| `ui/*.js` | mřížka znaků, editor glyfu, metriky/kerning, náhled, dialogy, úložiště | – |

## Etapy

1. **Jádro** – model, křivky, testy v node. ✔
2. **Export a import** – TTF/OTF/WOFF/SVG, ověření fontTools a načtením přes FontFace. ✔
3. **Mřížka znaků** – bloky Unicode, hledání, výběr, barvy buněk, kopírování mezi buňkami. ✔
4. **Editor glyfu** – lupa/posun, metriky, nástroje výběr/pero/obdélník/elipsa/nůž/měřítko, úchyty, hladké/rohové body, zpět/znovu, pozadí. ✔
5. **Informace o fontu, náhled** – živé vykreslení přes FontFace, vodopád velikostí, vlastní text. ✔
6. **Metriky a kerning** – okno s textem, tažení páru, skupiny, automatické mezery a kerning. ✔
7. **Transformace a booleany** – sjednocení/průnik/rozdíl, odstranění překryvů, obtažení, zesílení, kurzíva, extrémy, zjednodušení, zaokrouhlení. ✔
8. **Kontrola chyb** – seznam problémů s opravou jedním klikem. ✔
9. **České akcenty a komponenty** – kotvy, sestavení á č ď é ě í ň ó ř š ť ú ů ý ž automaticky. ✔
10. **Obtahování** – obrázek na pozadí, automatické obtažení, šablona pro ruční písmo (tisk → sken → glyfy). ✔
11. **Ligatury a interpolace** – GSUB liga, mezistupeň dvou řezů. ✔
12. **Dokončení** – nápověda, zkratky, dotyk, sdílení do fontů webu ✔; revize s uživatelem zbývá.

## Stav (23. 10. 2026)

Etapy 1–11 hotové v prvním průchodu. Testy:
`node _test/pismolijna_export.js` (141 kontrol, round-trip přes fontTools), `node _test/pismolijna_operace.js`,
`node _test/pismolijna_kontrola.js`, `node _test/pismolijna_obtah.js`, prohlížeč `python3 _test/pismolijna_ui.py [dpi]`
(38 kontrol) a `python3 _test/pismolijna_ui2.py` (36 kontrol – operace, akcenty, kontrola, obtahování, nabídky).

Navíc oproti FontForge: tvarování křivky tažením, štětec a tužka s proložením, měřítko s tloušťkami tahů,
kontextové glyfy v editoru, automatický kerning podle profilů, rukopisné písmo ze skenu šablony, náhled
skutečně vygenerovaným fontem v prohlížeči, CSS s vloženým písmem, přidání do fontů webu.

Známá omezení: import nečte složené glyfy jako komponenty (opentype.js je rozkládá), GPOS kerning
se při importu čte jen pro U+0020–024F, nezapisuje se hinting ani GDEF/mark.

## Rozšíření 23. 10. 2026 (odpoledne)

- **Symetrie glyfu** `glyf.zrcadlo = {svisle, vodorovne, x?, y?}` – živé zrcadlení podle svislé, vodorovné nebo obou os
  (`PSL.maticeZrcadla`, `PSL.obrysySeZrcadlem`, `PSL.zapecZrcadlo`); kopie počítá `plneObrysy`, editor je kreslí čárkovaně,
  export TTF je zapisuje. Menu Glyf: jednorázové zrcadlení vybraných glyfů vodorovně/svisle.
- **Režim Jednoduchý / Pokročilý** (přepínač v liště, `webapp_pismolijna_nastaveni.rezim`, výchozí jednoduchý). Pokročilé prvky mají
  třídu `pokrocile` (CSS je skryje), menu filtruje `POKR_AKCE` v `ui/app.js`, panel `POKR_SEKCE/POLE/TL` v `ui/panel.js`.
- **Generátor stylových písem** `jadro/generator.js` + karta `ui/generator.js`: 24 stylů (strašidelné, slizové, krvavý horor,
  bublinové, komiks 3D, kreslené, metalové, black metal, Diablo, tesaná gotika, kamenné, plamenné, ledové, pixel, LED, neon,
  obrysové, inline, šablona, retro, závodní, grunge, nafouknuté, origami) + vlastní kombinace 19 efektů (pokročilý režim).
  Efekty nad mnohoúhelníky přes Clipper, semínko = opakovatelná varianta, síla 0,2–2. Test `node _test/pismolijna_generator.js`,
  GUI `python3 _test/pismolijna_ui3.py`.
- Vlastní kombinace rozšířena na 39 efektů v 6 skupinách (`P.GENERATOR_SKUPINY`; pořadí skupin = pořadí v řetězu):
  deformace (zúžit, rozšířit, perspektiva, vypouklé, vlnité pokřivení), tvar (zaoblit rohy), okraje (tání, chlupaté),
  přidat (třpytky), vzor (šikmé a svislé pruhy, šachovnice, děrovaný plech, bublinky, razítko, rozříznuté), kolem písmene
  (dvojitý neon, halo, plochý stín, odraz na vodě). Zaškrtnutí efektu rovnou vybere kartu Vlastní kombinace.
- Směr obrysů: `PSL.hloubkaVnoreni` (krivky.js) hlasuje víc vnitřních bodů – sdílí ji `opravSmer` i kontrola,
  u dotýkajících se obrysů se tak nemýlí.

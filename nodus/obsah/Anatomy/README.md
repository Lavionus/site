# Atlas lidského těla

Vstupní stránka: `../anatomie.html`. Funguje samostatně i v rámci Nodus,
bez sestavení, externích knihoven a síťových API. Sdílí `common.css`,
`theme.js` a `podpis.js` s okolními stránkami.

## Obsah a rozšíření

- `atlas-data.js`: registr modulů, český výklad a geometrie orgánů.
- `atlas.js`: renderer mapy, výběr, zvýraznění soustav a stavový automat kvízu.
- `atlas.css`: lokální vzhled a responzivní rozložení.
- `../Prirodopis/organy-atlas-predek-v3.png`: přední ilustrace 1024 × 1536.
- `../Prirodopis/organy-atlas-zada-v2.png`: odpovídající zadní ilustrace 1024 × 1536.

Nově vytvářené přírodopisné obrázky ukládejte do `obsah/Prirodopis`.
V `Anatomy` zůstávají pouze kód a dokumentace atlasu. Původní starý
obrázek `Organs.png` nebyl součástí nového generování a zůstává zachovaný.

Přepínač nad mapou vybírá přední nebo zadní pohled z `ANATOMY_MODULES`.
Každý pohled má vlastní obrázek, obrysy, seznam soustav a sadu otázek.
Přední pohled obsahuje deset struktur, zadní čtyři. Sdílená ID (mozek,
plíce) zachovávají postup prohlížení mezi pohledy. Změna pohledu
v režimu kvízu zahájí nové kolo; prohlížení zachová společný výběr,
případně vybere první dostupný orgán.
Pro další moduly přidejte záznam s `id`, `title`, `viewName`, `caption`,
`image`, `viewBox` a `organs` a tlačítko volající `changeView(index)`.
Renderer znovu sestaví mapu a nabídku soustav podle zvoleného modulu.
Každý orgán má stabilní ID, soustavu, výklad, obrysové `paths`, bod
`anchor` pro odkazovou čáru a souřadnice popisku `label`.
Kvíz čerpá ze stejných záznamů; každý orgán je v jednom kole právě jednou.

Souřadnice jsou v nativním prostoru obrázku, nikoli v CSS pixelech.
SVG obsahuje zároveň obrázek i aktivní plochy, takže při změně velikosti
nebo přiblížení nedochází k jejich vzájemnému posunu.
Obrysy sledují viditelnou část orgánů. Tlusté střevo má konkávní obrys,
aby aktivní plocha nezasahovala do vnitřních kliček tenkého střeva.
Malé orgány lze pohodlně vybrat také popiskem nebo HTML tlačítkem.
Při přidávání orgánů kontrolujte překryvy a pořadí vykreslení SVG.

## Ilustrace

Vytvořena vestavěným nástrojem image_gen (nikoli přes CLI), 14. 9. 2026.
Finální generovací prompt:

> Use case: scientific-educational. Create a professional anatomically credible educational atlas illustration of human internal organs, front view, head through pelvis, centered upright, portrait 2:3 image. Clean ivory background #f7f4ee, generous blank side margins for future interactive labels. Beautiful fine medical illustration, softly shaded realistic organs with crisp distinct silhouettes, neutral translucent human body outline (head neck shoulders upper arms torso pelvis), no genitals, no gore. Brain visible in cutaway skull. Trachea with cartilage rings splits to two lungs. Heart between lungs slightly on viewer RIGHT (subject left). Liver below lung on viewer LEFT (subject right), small green gallbladder visible at lower edge of liver. Stomach on viewer RIGHT below lung. Large intestine framing clearly distinct coiled small intestine, rectum at bottom. Anatomically coherent proportions. Only these nine structures need emphasis: brain, trachea, two lungs, heart, liver, gallbladder, stomach, small intestine, large intestine. No extraneous organs, no text, no numbers, no leader lines, no diagram labels. Full head and pelvis visible without cropping. Premium school science atlas with muted coral lungs, burgundy liver, red heart, peach stomach and intestines, taupe body outline. Save generated asset for use in a website.

Ilustrace je didaktický průhled, nikoli přesný anatomický řez. Nezobrazuje
všechny soustavy ani všechny orgány. Odborné zdroje výkladu jsou přímo
v patičce stránky.

## Ověření

Chromium: desktop 1440 px a mobil 390 px, světlé a tmavé téma,
žádné chyby JavaScriptu ani vodorovné přetékání stránky.
Ověřeny zásahy bodů všech devíti orgánů při skrytých popiscích,
filtr dýchací soustavy, výběr klávesnicí, devět unikátních otázek,
výsledek 9/9, blokování opakované odpovědi, chybná odpověď,
restart a návrat do prohlížení. Syntaxe obou JS souborů zkontrolována
pomocí `node --check`.

Zadní pohled navíc ověřen v Chromiu: šest zásahových bodů bez popisků,
kvíz 6/6, restart kvízu při změně pohledu (1/9 a 1/6), klávesnice
a mobilní šířka 390 px bez přetékání. Oba pohledy bez chyb JavaScriptu.


## Oprava prostorového vztahu v pánvi

Aktuální ilustrace jsou `Prirodopis/organy-atlas-predek-v3.png` a
`Prirodopis/organy-atlas-zada-v2.png`. Měchýř je pouze vpředu; zezadu
byl odstraněn spolu s močovody. Starší PNG jsou předchozí verze a
stránka je nepoužívá. Zadní pohled zachovává ledviny, plíce, mozek a míchu.
Přední aktivní plocha tlustého střeva již nepokrývá část zakrytou měchýřem.
Ověřeno v Chromiu: 10 a 4 zásahové body, žádný překryv měchýře se střevem
v testovaných bodech (510,1191) a (510,1260), kvízy 10/10 a 4/4,
přepínání pohledů a mobilní šířka 390 px bez chyb JavaScriptu.
Prompty opravy jsou v `../Prirodopis/organy-oprava-panve-prompty.md`.

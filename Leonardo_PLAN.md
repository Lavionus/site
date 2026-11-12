# Leonardův zápisník – plán

Stránka `obsah/leonardo.html` + `obsah/leonardo/` (popis v README.md). „pokračuj“ = první neodškrtnutá etapa.

## Zdroje (ověřeno 12. 11. 2026)

| Co | Odkud | Licence / poznámka |
|---|---|---|
| Snímky Codex Atlanticus 1–1119 r/v | Commons, `Category:Codex Atlanticus (codex-atlanticus.it)` (2238 souborů, 1000×1000 px, dva tvary názvu) | PD-Art. upload.wikimedia.org vrací 429 → stahovat ~1/s, UA s adresou webu (bez e-mailu) |
| Převod nového (Marinoni) ↔ starého (Hoepli) a antického čísla | Museo Galileo `https://teche.museogalileo.it/LeoService/Servizio/Leo/Numerazioni?sigla=MARINONI|HOEPLI|STORICA` | fakta; služba umí i `Foglio?num=ATL.0654.1` (datace, popisy Marinoniho – ty jsou autorské, nepřebírat) |
| Rok a témata stran | data v bundlu `codex-atlanticus.ambrosiana.it/js/app.*.js` (`{page:N,year,fragments:[{side,argomento:"topic_N",subCategory}]}`, popisky `topic_N` IT/EN) | fakta z katalogu, uvedeno ve zdrojích |
| Italský text | it.wikisource `Frammenti letterari e filosofici` (Solmi 1900) + `Sommarii e riferimenti` (odkazy na listy) | PD, přepis CC BY-SA |
| Anglický překlad Richter | Gutenberg #5000 (čistý text, bez odkazů na listy); 1883 OCR na archive.org `literaryworksofl01leonuoft` (IT+EN, odkazy „A. 23 a]“, ale OCR dvousloupcové a zašuměné) | PD |
| Kodex o letu ptáků (Turín) | Commons `Category:Codex on the Flight of Birds` (49 souborů) | PD |
| Pařížské rukopisy A–M | Commons jen jednotlivé listy (0–19 na rukopis) | dál hledat |
| Codex Leicester, Windsor | jen ukázky / nevolné | ne |

## Etapy

- [x] **1. Codex Atlanticus + Solmi** – data (`_test/leonardo_sestav.py`), prohlížeč se zrcadlem a filtry,
      panel Text/List/Poznámka, režimy Texty, Témata a roky, Poznámky, O zápisnících; 675 úryvků přeloženo
      (Mr. Smith ×5, dávky `_originaly/preklad/`), testy node + UI, i18n en 100 %.
- [x] **2. Kodex o letu ptáků** – 40 stran z Commons, text 1893 (Piumati, kritický přepis) + překlad, režim 🐦.
      Nejisté: řezy textu na hranicích stran, čtení OCR „pesa i 2/3“, „lita“, účet na zadní desce; listy 1, 2, 10, 17 v 1893 chyběly.
- [x] **3. Richterovy úryvky** – `richter.json` (1566 čísel, 1349 s odkazem: 573 vysoká, 568 střední, 208 nízká jistota;
      77 Solmiho čísel ověřeno ručně), anglické úryvky na stranách CA. Zbývá: strany a/b u 456 záznamů
      (rejstřík listů v Bibliography, `richter02.txt` ř. ~57418–60300), anglický text jako jazyk pro EN rozhraní u Solmiho úryvků.
- [ ] **4. Pařížské rukopisy** – najít volné snímky (Institut de France / Gallica / Commons), napojit odkazy A–M, Ash.
- [x] **5. Revize překladu** – 68 úryvků opraveno, terminologie sjednocena, 28 nadpisů zkráceno (záloha před revizí jen ve scratchpadu).
      Zbývá případná odborná kontrola.
- [x] **6. Zážitek** – ⭐ slavné listy s prohlídkou (32), ❓ hádanky z proroctví, ✍️ zrcadlové písmo, 🎲, období života.
- [ ] **7. Možnosti** – vyznačit polohu úryvku na snímku (ruční obdélníky; rozhodlo by i kandidáty a/b);
      vyšší rozlišení: IIIF Museo Galileo nemá veřejný manifest ani licenci (12. 11.) – nepoužívat bez svolení.

## Nejistá místa překladu (hlášení Mr. Smithů 12. 11.)

s047 calendrino → Kaladrius · s082 lumerpa, s086 alepo ponechány · s087 konec pštrosa · s094 doplněno [páření] ·
s127 „colarne“ = cotenne · s141 „scuvi“ = scolpisci · s142 tortomalio = pryšec · s176, s180, s210, s214 volněji ·
s215 opravy OCR · s260 „suggetto colla forma“ · s286 poškozené · s294 „ombra della luna“ (spíš země) ·
s318 [10] fiume Era, [32] řečnická otázka · s327 nedokončená věta · s344, s353, s357, s378, s398, s402 [3] vóto/vuoto,
[52] · s405, s406, s410, s420, s425, s430, s436 porušená místa · s438 [3], s445 [3], s472 [2], s475, s493 [0] blesky
(překlad podle smyslu, doslova opačně), [1] výšky · s505 obr, „merlo“ = smerlo · s534, s535 text nesedí k názvu
(už u Solmiho) · s571, s583, s596, s620, s647, s673 · vtipy s663, s667, s673 s vysvětlivkou v [ ].

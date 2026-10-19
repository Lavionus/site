# Keltské uzly – plán revize 3

Stránka `obsah/keltske_uzly.html`, moduly `obsah/keltske_uzly/*.js`.
Testy: `node _test/keltske_uzly_test.js`, `python3 _test/keltske_snimky.py` (DPR=2), `python3 _test/keltske_klik.py`.

## Architektura
- **Logika** (inline `<script id="logika">`, `window.KELT`, testy v node): mřížka (obdélník / kruh / dlaždice), sestavení pramenů, úseky, rozpojení pro hlavy, spojení do jednoho pramene, semínka výplní, kódování odkazu.
- **Scéna** – jediný zdroj pro všechny výstupy: prameny → úseky v px (vrstva 0 pod / 1 oblouk / 2 nad, body, index křížení), šířky, hlavy/ocasy, semínka, ořez dlaždice.
- `keltske_uzly/vystupy.js` (`KELT_VYSTUPY`): SVG ze scény, SVG pro plotr (osa) a řezání (obrysy), označení ploch pro výplň, STL z výškové mapy.
- `keltske_uzly/spiraly.js` (`KELT_SPIRALY`): řetěz (Newgrange), triskel, vlna (běžící pes).
- `keltske_uzly/zvirata.js` (`KELT_ZVIRATA`): hlavy (had, pták, pes) a ocasy jako SVG cesty.

## Etapy
1. [x] Scéna + přesun SVG do vystupy.js – vzhled beze změny (porovnat snímky předvoleb)
2. [x] Dlaždice (mřížka uzavřená do sebe, ukázka 3×3), zvýraznění pramene pod myší, barvení pramene kliknutím, 🔗 jeden pramen
3. [x] Výplň ploch (šachovnice z teček / středů buněk, vnějšek se nevyplní)
4. [x] Spirály (řetěz, triskel, vlna)
5. [x] Zvířecí konce (had, pták, pes) – rozpojení na odrazu u vnějšího okraje
6. [x] Tvar z písmene / obrázku (vystřižení buněk)
7. [x] Exporty: plotr (osa s přerušením), řezání (obrysy), STL reliéf; tisk A4 (omalovánka, šablona, tečky)
8. [x] Krok za krokem (6 kroků s animací zlomů)
9. [x] Předvolby, „Jak to funguje", verze cache, závěrečné snímky (obě témata, DPR 2, úzký displej)

## Rozhodnutí
- Výplň se počítá rastrově (maska pásků + vyplnění od semínek), do SVG se vkládá jako obrázek.
- Barvy pramenů se pamatují u segmentů (klíč „i.j.s"), v odkazu jeden segment za pramen.
- STL = výšková mapa (nad vyšší, pod nižší) → uzavřená síť s podložkou, tiskne se bez podpěr.

## Stav (19. 10. 2026)
Všech 9 etap hotových. Testy: `node _test/keltske_uzly_test.js` (logika, dlaždice, spojení pramenů, výplň, spirály, STL uzavřenost, plotr, hlavy),
`python3 _test/keltske_snimky.py` (24 předvoleb, výplně, hlavy, krok za krokem; DPR=2), `python3 _test/keltske_klik.py` (myš, barvení, odkaz, exporty přes `window.__keltZachyt`, tisk).

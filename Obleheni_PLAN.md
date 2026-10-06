# Plán: 🏝️ Ostrov v obležení (od 6. 10. 2026)

Tower defense na ostrově generovaném ze seedu. Popis hry je v `Obleheni_POPIS.md`. Tady jsou
rozhodnutí, která odpovědi na otevřené otázky z popisu mění, a záznamy z etap.

## Rozhodnutí (odpovědi uživatele 6. 10. 2026)

1. **Téma: fantasy.** Kromě pirátů a příšer přibývají mágové: věž mága (řetězový blesk),
   nepřátelský mág se štítem a vzducholoď mágů.
2. **Mapa 32 × 24 polí bez posouvání.** Celý ostrov je vždy na obrazovce, plátno se jen zmenší podle šířky.
3. **Věže bez výdrže, jako v TD.** Lodě ostřelují jen přístav a vesnice. Pevnost leží aspoň 6 polí
   od vody, takže ji lodě nedostřelí. Útoky na věže se změnily na **vyřazení**: harpyje, wyverna,
   mořský had a chapadla krakena věž na čas umlčí.
4. **Souš: předem dané cesty** (rozhodnutí Clauda). Generátor vede cesty od každé pláže k pevnosti.
   Pěchota chodí jen po cestách, věže se na cesty stavět nesmí, pasti ano. Palisády nejsou.
   Je to čitelné jako v TD a na malé mapě to dává lepší hratelnost než bludiště.
5. **Grafika: SVG sprity kreslené v kódu jako v TD** (rozhodnutí Clauda). Moře, pobřeží a terén
   se kreslí procedurálně do předrenderovaného pozadí, vlnky se animují.
6. **Jen zlato.**
7. **Vlastní loď: jen strážní šalupa** (nejvýš 2), staví se v přístavu.
8. **Název: Ostrov v obležení** (rozhodnutí Clauda).

## Soubory

`obsah/obleheni.html` + `obsah/obleheni/*.js` (obyčejné skripty, jmenný prostor `OBL`):
`nahoda.js`, `data.js`, `ostrov.js`, `toky.js`, `sim.js`, `kampan.js` (logika, bez DOM, jde v node),
`grafika.js` (pozadí po pixelech + sprity kreslené kódem), `zvuk.js`, `ui.js` (prohlížeč).

## Etapy

- [x] 1. Ostrov (generátor, kontrola hratelnosti, pozadí, náhled se seedem)
- [x] 2. Moře a lodě, pěchota po cestách, pevnost
- [x] 3. Věže a stavba
- [x] 4. Vzduch a vítr
- [x] 5. Systémy z TD (aury, synergie, specializace, sloučení, hodnosti, imunity)
- [x] 6. Vyřazování věží, mořští tvorové, pasti, řetěz
- [x] 7. Počasí, příliv, hlídka, ekonomika, schopnosti
- [x] 8. Bossové, kampaň, nekonečná obrana, ostrov dne, ukládání
- [x] 9. Grafika a zvuk
- [x] 10. Bot, vyvážení, nápověda, katalog, offline

## Záznamy z etap

**6. 10. 2026: všech 10 etap v jednom běhu** (uživatel chtěl celou hru bez dotazů).

- **Ostrov** (`ostrov.js`): 6 biomů, souš 30–42 % mapy, hloubky 1–4, pláže a útesy, řeka s mosty, pevnost 2×2
  aspoň 6 polí od vody, přístav s vybagrovaným průplavem, 1–3 vesnice, 3–5 míst přistání s cestami k pevnosti,
  4–7 bodů nástupu. Když kontrola hratelnosti neprojde, zkouší se další pokus odvozený ze seedu: 300 z 300 seedů projde.
- **Změna proti popisu:** pěšák nebo letec, který dojde k pevnosti, jednou „vtrhne“ (ubere `vtrh` bodů) a zmizí,
  jako únik v TD. První verze, ve které útočili dál, byla nehratelná: 10 pirátů zbořilo pevnost za 10 s.
  Trvale útočí jen střelci (z dálky 3 polí), lodě na budovy a kraken s admirálem (dostřel 6,5 pole až na pevnost).
- **Bossové míří i na pevnost**, jinak by se admirál po pádu přístavu neměl kam vydat a vlna by ho vyřadila.
- **Pojistky proti zaseknutí:** mořský had pustí věž po 20 s, po 4 minutách vlny se lodě a tvorové (kromě bossů) stáhnou.
- **Vyvážení botem** (`_test/obleheni_bot.js`, 6 seedů): ostrov 1 lehká 5/6, normální 3/6, těžká 0/6;
  ostrov 4 lehká 4/6, normální 1/6; ostrov 8 lehká 3/6. Bot je jednoduchý (neslučuje, synergie neřeší),
  člověk s artefakty by měl být lepší. Těžká obtížnost je zatím pro bota nevyhratelná.
- **Testy:** `node _test/obleheni_test.js [n]` (generátor, fuzz s invarianty: loď nikdy na souši, obsazenost polí,
  zlato ≥ 0; determinismus simulace; uložení a obnova mezi vlnami dají stejný výsledek; kampaň 8 kroků),
  `node _test/sw_obleheni_check.js` (offline sada), `python3 _test/obleheni_snimek.py [dpi] menu boj zivy panel vrstvy
  souostrovi svetly uzky tok` (snímky `_test/obl_*.png`, tok = celá kampaň přes klikání).
- Past: neukládané střádače (opravy skladu, nabíjení děla pevnosti) se nulují na začátku vlny, jinak se obnovená hra rozešla o 1 bod.
- Katalog: `apps.js` za Sector Defense, offline sada `OBLEHENI` v `sw.js`, cache `webapp-v286`. Neuploadováno.

### Možná pokračování
- Chytřejší bot (slučování, specializace podle situace) a podle něj doladit těžkou obtížnost.
- Úvodní výuková vlna s nápovědou přímo na mapě.

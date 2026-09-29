# Plán: nové hry (od 25. 9. 2026)

Stav se odškrtává průběžně; „pokračuj" = vzít první neodškrtnutou položku.

## Už na webu (nedělat znovu)

- 🧩 Nonogram – `obsah/nonogram.html`
- 🔤 Wordle česky – `obsah/wordle.html`
- 💣 Hledání min – `obsah/minesweeper.html`

## Společná pravidla pro logické mřížky

- Jedna samostatná stránka `obsah/<hra>.html`, hlavička jako ostatní hry
  (`common.css`, `theme.js`, `podpis.js`, `rekord.js`).
- **Generátor s jediným řešením** (ověřený řešitelem, který počítá řešení do 2).
- Režimy: **Denní zadání** (seed z data, pro všechny stejné) a **Nové zadání** (náhodné).
- Velikost/obtížnost, Zpět, Kontrola chyb, Nápověda, stopky, rekord na velikost
  (klíče `webapp_hra_<hra>_<velikost>`).
- Ovládání myší i dotykem, šířka od 320 px, světlé i tmavé téma.
- Čistá logika (generátor, řešitel) nesmí sahat na DOM – ověřuje se v node.
- Katalog: nová sekce **„🧠 Logické mřížky"** ve skupině `hry`.

## Logické hry

- [x] 👑 Queens – `obsah/queens.html`
- [x] 💡 Akari (Light Up) – `obsah/akari.html`
- [x] 🧠 Mastermind – `obsah/mastermind.html`
- [x] 🔗 Hashi (Mosty) – `obsah/hashi.html`
- [x] 🔢 Kakuro – `obsah/kakuro.html`
- [x] 🏝️ Nurikabe – `obsah/nurikabe.html`
- [x] ⭕ Slitherlink – `obsah/slitherlink.html`

## Tropické hry (sekce „🏝️ Tropické ostrovy")

- [x] 🗝️ Poklad pirátů – `obsah/poklad.html` – ostrov 7/9/11, orientační body (palmy, skály, vrak,
      chýše, lebka, pramen), 3–7 indicií s jediným řešením (minimální sada, žádná indicie sama
      neprozradí víc než 2 místa), 3 kopnutí; testy `_test/poklad_test.js` (nezávislá pravidla),
      `_test/poklad_snimky.py` (klikací test + snímky).
- [x] 🎣 Tropický rybář – `obsah/rybar.html` – boční pohled pod hladinu, molo / útes / hlubina,
      16 druhů (hloubka × doba × návnada), živá sardinka jako návnada, okusování → záběr → boj s napětím
      vlasce, předměty u dna (bota, mince, láhev s tipem, truhlička), žralok ukousne úlovek, zakázky,
      obchod, atlas s největšími kusy; testy `_test/rybar_test.js`, `_test/rybar_snimky.py`.
- 🏝️ ~~Opuštěný ostrov~~ – nahrazeno větší hrou **Trosečníci**, samostatný plán v `Trosecnici_PLAN.md`
      (tady se neodškrtává).
- [x] ⚓ Pirát obchodník – `obsah/obchodnik.html` – 30 dní, 6 přístavů × 6 druhů zboží (profily podle
      seedu, denní výkyvy, cenový tlak při velkém obchodu, tržní události), plavba 1–5 dní s bouřemi,
      vraky a piráty (boj/útěk/vzdát), loděnice, lichvář (2 %/den), hospoda se zvěstmi a mapou k pokladu,
      tabulka naposledy viděných cen, ukládání partie; testy `_test/obchodnik_test.js` (invarianty +
      3 boti), `_test/obchodnik_snimky.py`.
- [x] 🗺️ Souostroví pokladů → hotovo jako 🏴‍☠️ **Tajemství Karibiku** – `obsah/karibik.html`
      (mlha, vítr, zásoby, rybaření, vraky, chýše, veršovaná mapa ze 3 útržků, bouře, den/noc,
      syntetizovaný zvuk moře; testy `_test/karibik_test.js`, `karibik_bot.js`, `karibik_snimky.py`).
- [x] 🐠 Laguna – `obsah/laguna.html` – potápění s fotoaparátem: 5 míst (tráva, korály, útes, vrak, sráz),
      31 druhů ve 4 úrovních vzácnosti podle místa a denní doby, plaché/maskované/zalézající ryby, dech,
      noc s baterkou, fotka = skutečný výřez scény hodnocený 1–3 ★, atlas se siluetami a nápovědou,
      jemný pixel art (scéna v 1/2–1/3 rozlišení, posterizace s Bayerovým ditheringem, přepínač 🟦);
      rozšíření: 🎯 výzvy (3 aktivní, vždy splnitelné), 🦪 perly (objevy, ★★★, výzvy, obří zévy), 🐚 sbírka
      12 mušlí a pokladů ze dna + perla, 🧰 výbava (dech, ploutve, baterka, objektiv, rybí průvodce na minimapě);
      mapy: 🏝️ Laguna, 🌿 Mangrovový záliv (od 8 druhů), 🌋 Černá pláž (16), 🕳️ Modrá díra (24) – vlastní dno,
      barvy, dekorace a druhy; celkem 50 druhů a 18 pokladů ze dna, atlas s filtrem podle map;
      testy `_test/laguna_test.js`, `_test/laguna_snimky.py`.

### Rozšíření tropických ostrovů (od 29. 9. 2026)

Každá hra: `obsah/<soubor>.html`, první inline skript `const <Hra>Logika = (function(){…})()` bez DOM,
druhý UI v IIFE; test logiky `_test/<soubor>_test.js` (node, přes `_test/logicke_mrizky.js`), rekord
`webapp_hra_<soubor>*`, zvuk jen syntetizovaný (Web Audio), šířka od 320 px, obě témata.

- [x] 🎲 Pirátské kostky – `obsah/kostky.html` – Liar's Dice/Perudo: lebky jako žolíci (½ / 2n+1), „Lháři!" i volitelné „Přesně!", 2–4 AI piráti s povahami (počtář, blafařka, čtenář s pamětí…), 3 obtížnosti + denní výzva, tabulka pravděpodobností, statistika; test `_test/kostky_test.js`.
- [x] 🃏 Štychy na palubě – `obsah/stychy.html` – štychová hra s tajným odhadem, 10 kol, 3–5 hráčů, Kapitán/Pirát/Panna/Útěk + trumfová Černá vlajka, 3 úrovně AI (heuristika, Monte Carlo), denní plavba, deník skóre; test `_test/stychy_test.js`.
- [x] 🍹 Taverna v přístavu – `obsah/taverna.html` – časovaná manažerská hra po večerech: hosté s trpělivostí, recepty ze surovin + krok, pálení jídel, úklid, fronta akcí; ráno trh s kazícími se surovinami, vylepšení, recepty, jídelní lístek, události a zvěsti (sbírka); kampaň 15 dní / denní / nekonečná, 3 obtížnosti; test `_test/taverna_test.js`.
- [x] 🌴 Plantáž – `obsah/plantaz.html` – tahová budovatelská hra po měsících: klučení džungle, 6 plodin s nároky na vodu a půdu, sucho/deště, hurikány s předpovědí, střídání plodin, lis/palírna/sušárna, trh a zakázky lodí, placení dělníci/družstvo; cíl za 5 let ×3 obtížnosti + volná hra + denní ostrov; test `_test/plantaz_test.js`.
- [x] ⚓ Loděnice – `obsah/lodenice.html` – stavba lodi z dílů (4 trupy, 3 dřeva, ráhnové/gaflové plachty, stěžně, balast, děla, náklad), fyzika výtlak/ponor/GM/GZ/rychlost trupu, polární diagram, zkouška na moři s převrhnutím a zaplavením, 8 zakázek ★–★★★ + denní zakázka; test `_test/lodenice_test.js`.
- [x] 🧭 Navigátor – `obsah/navigator.html` – plavba bez GPS mezi 15 přístavy Karibiku (12 tras): kompas, log s přesýpacími hodinami, výpočet polohy pravítkem a úhloměrem, sextant (Polárka, polední Slunce + deklinace), chronometr, proudy a drift, zaměření mysů, 3 obtížnosti, denní plavba; test `_test/navigator_test.js`.
- [x] 🪢 Námořnické uzly – `obsah/uzly.html` – hlavolam „Rozmotej lana" (planarita, 15 úrovní 6–38 kolíků, denní zadání se sérií, náhodná 10–40, hvězdy, rekordy) + atlas 11 uzlů s krokovou SVG animací (nad/pod), k čemu slouží a častá chyba, kvíz; test `_test/uzly_test.js`.
- [x] 🍾 Vzkaz v láhvi – `obsah/lahev.html` – denní šifrovaný vzkaz (Caesar, atbaš, morseovka, zednářská, substituce s frekvencemi, Vigenère s hádankou, sloupcová transpozice), 3 obtížnosti, pomůcky, mapa ostrova 14×10 s kopáním, série dní, archiv; test `_test/lahev_test.js`.
- [x] 🥁 Steel drum – `obsah/steeldrum.html` – tenor pan 29 polí v kvintovém kruhu, syntéza Web Audio; volná hra s calypso doprovodem, rytmus (7 skladeb, 3 obtížnosti, combo ×4, kalibrace latence), Opakuj po mně s denním motivem; test `_test/steeldrum_test.js`.
- [x] ⛵ Regata – `obsah/regata.html` – závod plachetnic shora: polární diagram, trim plachty s vlaječkami, nárazy a stáčení větru, větrný stín, start s odpočtem a předčasným startem, obeplutí bójí levobokem, 3–5 AI, 3 tratě, denní regata, rekord trati; test `_test/regata_test.js`.
- [x] 🐢 Želví pláž – `obsah/zelvy.html` – noční pláž v pixel artu, mláďata táhnou ke světlu a lampy je svádějí do vnitrozemí; baterka (červené/bílé světlo), zhasínání lamp, žlábky v písku; krab duch, volavka, pes; 12 nocí kampaně + denní a náhodná noc, deník přírodovědce, sbírka 5 druhů, odznaky; test `_test/zelvy_test.js`.
- [x] 🌋 Živly ostrova – `obsah/zivly.html` – průřez sopkou (SiO₂/plyny/tlak → typ erupce, VEI, presety Soufrière Hills/Mont Pelée/La Soufrière) a hurikán (26,5 °C, střih, Coriolis, Saffir–Simpson); mini-hry 🎯 Vulkanolog a 🎯 Předpověď, 3 obtížnosti, denní výzva; test `_test/zivly_test.js`.
- [x] 🐚 Plážový sběratel – `obsah/plaz.html` – odliv podle Měsíce (jarní/hluchý), 5 zón, 36 druhů + 8 tvorů k focení, třpyt a hrabání, počasí, 5 pláží, denní pláž; test `_test/plaz_test.js`.

## Po každé hře

1. Test logiky v node (unikátnost řešení, řešitelnost generátoru na mnoha seedech).
2. Headless snímek v obou tématech + úzké zobrazení (iframe 360 px).
3. Záznam v `apps.js`, zvednout `webapp-vN` v `sw.js`.

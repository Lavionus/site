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

## Po každé hře

1. Test logiky v node (unikátnost řešení, řešitelnost generátoru na mnoha seedech).
2. Headless snímek v obou tématech + úzké zobrazení (iframe 360 px).
3. Záznam v `apps.js`, zvednout `webapp-vN` v `sw.js`.

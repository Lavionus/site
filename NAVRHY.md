## 7. 🔍 Rešerše stavu podstránek (2026-07-14) — ✅ ÚKLID PROVEDEN

**Celkový stav: velmi dobrý.** 224 HTML stránek v `obsah/`, z toho 219 napojených v menu (20 sekcí, 9 nadřazených skupin). **Žádný mrtvý odkaz** – všechny položky menu vedou na existující soubor.

### Nalezené drobnosti k úklidu

| Soubor | Problém | Doporučení |
|---|---|---|
| `obsah/book_creator.html` | sirotek – nahrazen `skriptorium.html` | smazat (ověřit, že skriptorium umí vše) |
| `obsah/book_creator copy.html` | pracovní kopie | smazat |
| `obsah/forecast copy.html` | pracovní kopie – **sdílí localStorage klíče s ostrou verzí** (`savedLocation`, `weatherCache`…) | smazat |
| `obsah/skriptorium (Kopie).html` | pracovní kopie | smazat |
| `index copy.html` | stará kopie rozcestníku | smazat |
| `style.css` (root) | nikým nelinkovaný duplikát inline stylů z `index.html` | smazat, nebo naopak využít (viz 9.1) |
| `obsah/vzorce_2026-07-09.json` | ruční export z modulu Vzorce, nic ho nereferencuje | přesunout mimo repo / smazat |
| `obsah/dummy` | prázdný soubor | smazat |

### Konzistence podstránek

- **11 stránek nemá `<meta name="viewport">`** (agri_calendar, aplikace, brainstorm, car_tracker, gene_map, had, gpx_viewer, stack-attack, piskvorky, unit_converter, travel_diary) → na mobilu se zobrazí zmenšené.
- **3 stránky mají jiné `lang` než `cs`** (retro_pacman, retro_invaders, retro_tetris).
- **38 stránek načítá knihovny z CDN** (Leaflet, Chart.js…) → bez internetu nefungují a při zrušení CDN verze se rozbijí.
- **localStorage**: 82 aplikací ukládá data; skutečné kolize klíčů jsou jen mezi „copy" soubory (vyřeší úklid). Do budoucna doporučen prefix dle aplikace (např. `forecast_savedLocation`).
- `obsah/aplikace.html` (úvod v iframe) je jen dvouřádkový placeholder – nevyužitý potenciál (viz 8.4).

---

## 8. 🧭 Návrhy na logiku rozcestníku (index.html) — ✅ HOTOVO (2026-07-14)

1. **Katalog aplikací jako data (apps.json)** – menu dnes žije natvrdo v HTML (219 `<li>` položek). Přesun do JSON (`nazev, soubor, emoji, sekce, skupina, klíčová slova`) a generování menu skriptem:
   - jediný zdroj pravdy, přidání aplikace = 1 řádek JSON,
   - umožní dashboard, oblíbené, štítky i lepší hledání bez další duplicity.
2. **Deep-linking přes URL hash** – dnes se stav drží jen v `sessionStorage`, takže odkaz nejde sdílet a F5 v novém tabu vrátí úvod. Řešení: `index.html#obsah/forecast.html` + `hashchange` listener; tlačítko Zpět v prohlížeči začne fungovat mezi aplikacemi.
3. **Oblíbené ⭐ + naposledy použité** – při 219 položkách je to největší UX zisk: hvězdička u položky menu, sekce „Oblíbené" a „Nedávné" nahoře (localStorage).
4. **`aplikace.html` → dashboard** – úvodní stránka jako dlaždice: oblíbené, naposledy otevřené, náhodný tip, počet aplikací. (Nejlépe generováno ze stejného apps.json.)
5. **Hledání i podle klíčových slov** – dnes se hledá jen v názvu („hypotéka" nenajde Úvěr, „počasí" nenajde Forecast). Aliasy v katalogu z bodu 1.
6. **Klávesové zkratky** – `Ctrl+K` / `/` fokus hledání, `Esc` vyčistí dotaz, šipky ↑↓ + Enter pohyb ve výsledcích.
7. **Tlačítko „otevřít v novém okně"** u aktivní aplikace (užitečné pro hry a mapy, které chtějí celou obrazovku) + tlačítko 🏠 domů.
8. **PWA pro celý rozcestník** – manifest + service worker s cache (forecast už svůj má); web pak půjde „nainstalovat" a spustit offline.
9. **Světlý režim** – volitelný přepínač; dnes je vše natvrdo tmavé.

---

## 9. 🛠️ Návrhy na vylepšení podstránek — ✅ HOTOVO (body 4–6 částečně, viz poznámky)

1. **Sdílený `common.css`** – každá stránka má dnes vlastní inline styly; sjednotit alespoň CSS proměnné (barvy, fonty) do sdíleného souboru, aby šel vzhled (a případný světlý režim) měnit na jednom místě. Nevyužitý `style.css` je dobrý základ.
2. **Vendorovat CDN knihovny** do `obsah/lib/` (leaflet, chart.js, …) – offline provoz + nezávislost na třetích stranách. Týká se 38 stránek.
3. **Doplnit viewport** do 11 stránek a `lang="cs"` do 3 retro her (viz rešerše).
4. **Jednotný export/import dat** – aplikace s uživatelskými daty (deníky, trackery, kanban…) by měly mít tlačítko „Záloha JSON" / „Obnovit"; část už má, sjednotit.
5. **Prefixy localStorage klíčů** podle aplikace – prevence budoucích kolizí na společné doméně.
6. **Zpětný odkaz / titulek** – sjednotit chování při přímém otevření stránky mimo iframe (odkaz `../index.html` s `target="_top"` po vzoru historicke_mapy_odkazy.html).

---

## 10. 💡 Kolo 5 – náměty na nové stránky — ✅ HOTOVO (vše vytvořeno a napojeno)

### 💰 Finance & domácnost
- [x] **Kalkulačka DPH** – cena s/bez DPH, sazby ČR → `obsah/dph_calc.html`
- [x] **Čistá mzda ČR** – hrubá → čistá, odvody → `obsah/net_salary.html`
- [x] **Měnový převodník** – kurzy ČNB/ECB s offline cache → `obsah/currency_conv.html`
- [x] **Jednotková cena** – porovnání balení v obchodě (Kč/kg, Kč/l) → `obsah/unit_price.html`

### 🎓 Vzdělávání
- [x] **Slepá mapa ČR** – kraje a krajská města (řeky zatím ne – chybí kvalitní data) → `obsah/slepa_mapa.html`
- [x] **Čtenářský deník** – evidence knih, hodnocení, poznámky, export/import JSON → `obsah/reading_log.html`
- [x] **Chemické názvosloví** – procvičování vzorců a názvů (kvíz + přehled) → `obsah/chem_nazvoslovi.html`



---

## 11. ✅ Záznam implementace (2026-07-14)

**Úklid (sekce 7):** smazány `book_creator.html` + všechny „copy/Kopie" soubory, `index copy.html`, `style.css`, `obsah/dummy`; `vzorce_2026-07-09.json` přesunut do `MyWebSites/tmp/`. Doplněn viewport (10 stránek + dashboard) a `lang="cs"` (3 retro hry).

**Logika rozcestníku (sekce 8):** kompletně přepsán `index.html`:
- katalog aplikací žije v **`apps.js`** (`KATALOG_SKUPINY`, `KATALOG_SEKCE`; položka = `soubor`, `nazev`, volitelně `tagy`) – menu, hledání i dashboard se z něj generují; **nová aplikace se přidává jedním záznamem v apps.js**;
- deep-linking `index.html#obsah/….html` + funkční tlačítko Zpět (hashchange);
- oblíbené ⭐ (hvězdička u položky menu) a Nedávné – sekce nahoře v menu i dlaždice na dashboardu;
- hledání bez diakritiky a přes klíčová slova (`tagy`);
- klávesové zkratky: `Ctrl+K` / `/` hledání, `↑↓` + `Enter` výběr, `Esc` zavře/vyčistí;
- tlačítka 🏠 domů a 🗗 otevřít v novém okně, přepínač 🌓 světlý/tmavý režim;
- PWA: `manifest.webmanifest` + `sw.js` (jádro předcachováno, aplikace se cachují při prvním otevření → fungují offline) + ikony `icon-192/512.png`;
- `obsah/aplikace.html` je dashboard (tip dne, oblíbené, nedávné, statistika).

**Vylepšení podstránek (sekce 9):**
1. ✅ `common.css` – sdílené CSS proměnné (tmavé i světlé téma); používá index, dashboard a nové stránky. Starší stránky lze migrovat postupně.
2. ✅ CDN knihovny staženy do `obsah/lib/` (Leaflet, Chart.js, three.js, jsPDF, html2canvas, FontAwesome…, i Tailwind pro cvGen) a odkazy přepsány – 36 stránek už nezávisí na internetu. Google Fonts ponechány (bez připojení se jen použije náhradní font).
3. ✅ viewport + lang – hotovo.
4. ⚠️ částečně – export/import JSON mají nové aplikace (čtenářský deník); plošné doplnění do starších aplikací zbývá.
5. ⚠️ částečně – nové aplikace používají prefixované klíče (`reading_log_…`, `currency_conv_…`); plošné přejmenování u starých aplikací by smazalo uložená data uživatelů, proto neprovedeno (vyžadovalo by migraci klíčů).
6. ⏳ neprovedeno – sjednocení zpětných odkazů při otevření mimo iframe.

**Kolo 5 (sekce 10):** všech 7 stránek vytvořeno, napojeno v `apps.js` a otestováno v prohlížeči (headless Chromium). Poznámky: ČNB API nemá CORS, převodník proto automaticky přechází na ECB kurzy a poslední stažené kurzy ukládá pro offline; slepá mapa má vlastní zjednodušenou geometrii krajů (bez závislosti na internetu).

---

## 12. 🎓 Návrh: rozšíření výuky podle stupňů / ročníků (2026-07-15) — ✅ IMPLEMENTOVÁNO

> **Schváleno:** členění A-3 (podle předmětů), B = všech 17 aplikací, C = knihovna sad. Hotovo 2026-07-15 – viz sekce 13.



Sekce Vzdělávání má dnes 23 aplikací v jednom seznamu. Návrh má dvě části: **(A) členění menu** a **(B) nové výukové aplikace po stupních**.

### A) Členění menu – varianty

**Varianta 1 (doporučená): sekce podle stupňů.** Skupina 🎓 Vzdělávání se rozdělí na 3 sekce – čistě přesun položek v `apps.js`, žádný nový kód:
- 🧒 **1. stupeň ZŠ (1.–5. ročník):** násobilka, mentální matematika, učení hodin, vyjmenovaná slova, slovní druhy, kartičky
- 🎒 **2. stupeň ZŠ (6.–9. ročník):** zlomky, římské číslice, periodická tabulka, chemické názvosloví, fyzikální vzorce, slepá mapa ČR, kvíz vlajky, sluneční soustava, hvězdná obloha, morseovka, hudební nauka, čtenářský deník
- 🎓 **SŠ & obecné:** algoritmy řazení, AI přednáška, historické mapy, trenažér psaní, mapy, mentální matematika (nebo do 1. st.)

Nevýhoda: aplikace může být jen v jedné sekci (duplicita by rozbila oblíbené/hledání, klíčem je `soubor`). Hraniční aplikace zařadíme podle převažujícího použití a do `tagy` dáme ročníky („3. ročník", „2. stupeň"…), takže hledání najde vše.

**Varianta 2: jedna sekce + filtr stupně.** Položky dostanou pole `stupen: [1,2,3]` a v menu přibudou filtrační pilulky (1. st. / 2. st. / SŠ). Aplikace může patřit do více stupňů, ale vyžaduje zásah do index.html.

**Varianta 3: sekce podle předmětů** (Čeština, Matematika, Přírodní vědy, Zeměpis & dějepis, Ostatní) + ročníky jen v tazích.

### B) Nové výukové aplikace (výběr k odsouhlasení)

**🧒 1. stupeň:**
- [ ] 🔢 Počítání do 20/100 – sčítání/odčítání, volba ročníku a oboru čísel
- [ ] 📖 Slabiky a první čtení (1.–2. ročník)
- [ ] ✍️ Doplňovačky i/y – diktáty navazující na vyjmenovaná slova
- [ ] 📏 Převody jednotek pro děti (délka, hmotnost, čas, objem)
- [ ] 🔺 Geometrické tvary a tělesa – poznávačka
- [ ] 🇬🇧 Angličtina – první slovíčka (obrázkové kartičky)

**🎒 2. stupeň:**
- [ ] 💯 Procenta a trojčlenka – trenažér
- [ ] 🧮 Lineární rovnice – procvičování krok za krokem
- [ ] 📐 Obvody, obsahy, objemy – kvíz se vzorci
- [ ] 🗺️ Slepá mapa Evropy / světa (rozšíření stávající ČR)
- [ ] 🇬🇧 Anglická nepravidelná slovesa
- [ ] 📜 Časová osa českých dějin
- [ ] ✏️ Shoda podmětu s přísudkem + větné členy

**🎓 SŠ & obecné:**
- [ ] 📈 Grafy funkcí – interaktivní vykreslování (lineární, kvadratické, goniometrické)
- [ ] 🧬 Genetika – Punnettův čtverec (křížení)
- [ ] 🧪 Vyčíslování chemických rovnic
- [ ] 📚 Literární směry a autoři – kvíz/kartičky

**Navíc – synergie s kartičkami:** hotové sady kartiček po ročnících (vyjmenovaná slova, slovíčka AJ, letopočty, vzorce…) jako JSON soubory ke stažení/importu – využije nový per-sada export/import ve flashcards.html; stačí stránka „knihovna sad".

### Postup po schválení
1. Fáze 1: členění menu (schválená varianta) – jen `apps.js`.
2. Fáze 2: nové aplikace dle zaškrtnutého výběru, po dávkách.
3. Fáze 3: knihovna sad kartiček po ročnících.

---

## 13. ✅ Záznam implementace rozšíření výuky (2026-07-15)

**Členění menu (A-3):** sekce 🎓 Vzdělávání v `apps.js` rozdělena podle předmětů na 6 sekcí (skupina `vzdelavani` zůstává, takže pilulka Vzdělávání drží vše pohromadě):
📖 Čeština (7) · 🔢 Matematika (12) · 🔬 Přírodní vědy (7) · 🌍 Zeměpis & dějepis (6) · 🇬🇧 Cizí jazyky (2) · 🎓 Kartičky & další výuka (7). Ke každé položce doplněny tagy s ročníky/stupni („3. ročník", „2. stupeň", „sš"…), takže hledání najde aplikace i podle ročníku.

**Nové aplikace (B – všech 17 + knihovna):**
- Čeština: `doplnovacky.html` (i/y), `shoda_podmetu.html`, `slabiky.html` (první čtení + čtení nahlas přes SpeechSynthesis), `literarni_smery.html` (přehled + kvíz).
- Matematika: `pocitani.html` (do 20/100, vysvědčení), `procenta.html` (procenta + trojčlenka), `rovnice.html` (5 úrovní, postup), `geometrie_vzorce.html` (přehled + kvíz), `prevody_jednotek.html`, `geo_tvary.html` (SVG poznávačka), `grafy_funkci.html` (canvas, interaktivní parametry).
- Přírodní vědy: `punnett.html` (monohybridní křížení), `vycislovani_rovnic.html`.
- Zeměpis & dějepis: `slepa_mapa_evropa.html` (46 států, vlastní zjednodušená geometrie), `casova_osa.html` (26 událostí, 3 kvízy).
- Angličtina: `aj_slovicka.html` (6 témat, obrázkové kartičky + kvíz + čtení), `aj_slovesa.html` (62 nepravidelných sloves, tabulka + doplňování).
- Knihovna (C): `knihovna_sad.html` – 15 hotových sad kartiček po předmětech; tlačítko „➕ Přidat do Kartiček" zapisuje přímo do `localStorage` (`flashcards_state`), nebo „⬇️ JSON" stáhne ve formátu importu flashcards.

**Slepá mapa Evropy – data:** vygenerována z veřejného `map-of-europe` GeoJSON, zjednodušena Douglas–Peuckerem, promítnuta do Mercatoru a vestavěna přímo do stránky (~92 kB, žádná CDN závislost). Osm ministátů (Andorra, Lichtenštejnsko, Lucembursko, Monako, San Marino, Vatikán, Malta, Kypr) je jako klikací tečky.

**Ověření:** `node --check` na apps.js i na inline skriptech všech 18 stránek; kontrola katalogu (244 položek, 0 chybějících souborů, 0 duplicit); headless Chromium render všech stránek bez JS chyb + kontrola, že se dynamický obsah vykreslil (mapa 46 států, kvízy, knihovna 15 sad).

**Styl:** všechny nové stránky používají sdílený `common.css` (tmavý i světlý režim přes `webapp_theme`), mají viewport i `lang="cs"` a jsou plně offline (žádné CDN).

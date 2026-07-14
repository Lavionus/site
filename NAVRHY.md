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

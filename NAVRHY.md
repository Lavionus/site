# 📋 Návrhy na rozšíření webového systému

> Dokument shrnuje doporučení pro rozcestník `index.html`.
> Vznikl jako podklad – stav realizace je vyznačen níže.
> Datum vzniku: 2026-06-17 · Aktualizováno: 2026-07-06 (dokončeno kolo 4)

---

## 1. ⚡ Rychlá náprava – hotové stránky mimo menu — ✅ HOTOVO

Všechny 4 stránky zkontrolovány, opraveny a napojeny do menu.

| Soubor | Titulek | Sekce | Stav |
|---|---|---|---|
| `obsah/map_export.html` | 🗺️ Mapový exportér | 🌍 Geo & Počasí | ✅ napojeno |
| `obsah/map_compare.html` | ⚖️ Porovnání historických a moderních map | 🌍 Geo & Počasí | ✅ napojeno |
| `obsah/historicke_mapy_odkazy.html` | 📜 Kde najít historické mapy | 🎓 Vzdělávání | ✅ napojeno |
| `obsah/shopplanner.html` | 🛒 Plánovač nákupů | 📊 Produktivita | ✅ napojeno |

Opraveno navíc:
- ✅ Zpětný odkaz v `historicke_mapy_odkazy.html` (`index.html` → `../index.html` s `target="_top"` kvůli iframe).
- ✅ Sjednocena datace rakousko-uherských vojenských mapování v `map_compare.html` i `historicke_mapy_odkazy.html` (1. 1763–1787, 2. 1836–1852, 3. 1869–1887) a popisky srovnány s reálnými dlaždicemi.

Dva `.md` průvodci zatím bez odkazu (ponecháno):
- `obsah/mapovy_pruvodce.md`
- `obsah/historicke_mapy_pruvodce.md`

---

## 2. 💡 Nové stránky — ✅ HOTOVO (vše vytvořeno a napojeno)

### 📊 Produktivita
- [x] Pomodoro / časovač s logem → `obsah/pomodoro.html`
- [x] Generátor hesel → `obsah/password_gen.html`
- [x] QR generátor + čtečka → `obsah/qr_generator.html`
- [x] Markdown ↔ HTML převodník → `obsah/md_html.html`
- [x] Sledování návyků (habit tracker) → `obsah/habit_tracker.html`

### 🩺 Zdraví & Kondice
- [x] BMI / kalorická kalkulačka → `obsah/bmi_calc.html`
- [x] Dechové cvičení (4-7-8, box breathing) → `obsah/breathing.html`
- [x] Tréninkový deník → `obsah/workout_log.html`

### 🌱 Zemědělství
- [x] Kalkulačka hnojení (dávky N-P-K) → `obsah/fertilizer_calc.html`
- [x] Evidence dešťových srážek / GDD (sumace teplot) → `obsah/rainfall_gdd.html`
- [x] Plánovač střídání plodin → `obsah/crop_rotation.html`
- [x] Kalkulačka výsevku (kg/ha) → `obsah/seeding_calc.html`

### 🌍 Geo & Počasí
- [x] Měřič vzdáleností / ploch na mapě → `obsah/distance_measure.html`
- [x] Východ/západ slunce a fáze měsíce → `obsah/sun_moon.html`
- [x] Časová pásma / world clock → `obsah/world_clock.html`

### 🎨 Design & Média
- [x] Color picker / generátor palet → `obsah/color_picker.html`
- [x] Převodník formátů obrázků (WebP/PNG/JPG) → `obsah/image_converter.html`
- [x] Generátor zvukového spektra / vizualizér → `obsah/spectrum_visualizer.html`
- [x] ASCII art z obrázku → `obsah/ascii_art.html`

### 📐 Technické & 3D
- [x] Kalkulačka šroubů / závitů → `obsah/screw_calc.html`
- [x] Generátor ozubených kol (SVG) → `obsah/gear_generator.html`
- [x] Převodník úhlů / měřítek → `obsah/angle_converter.html`

### 💻 Vývoj & DB
- [x] JSON formatter / validátor → `obsah/json_formatter.html`
- [x] Regex tester → `obsah/regex_tester.html`
- [x] Base64 / URL encoder → `obsah/base64_encoder.html`
- [x] SQL formatter → `obsah/sql_formatter.html`
- [x] Diff nástroj → `obsah/diff_tool.html`

### 🎮 Hry
- [x] 2048 → `obsah/game_2048.html`
- [x] Minesweeper → `obsah/minesweeper.html`
- [x] Memory (pexeso) → `obsah/memory_game.html`

---

## 3. 🧹 Drobnosti k úklidu / ověření

- [ ] **Kopie souborů** – `index (Kopie).html` a `index (Kopie 2).html` lze smazat, pokud nejsou potřeba.
- [ ] **Nekonzistentní cesta u vzorců** – odkaz má `href="obsah/Vzorce.html"`, ale `data-page="../Vzorce/Vzorce.html"` (`index.html`). Ověřit, zda míří správně.

---

## 4. 🚀 Další návrhy na nové stránky (kolo 2) — ✅ HOTOVO (vše vytvořeno a napojeno)

### 📊 Produktivita
- [x] **Faktura / cenová nabídka** → `obsah/invoice_gen.html`
- [x] **Sledování výdajů / rozpočet** → `obsah/expense_tracker.html`
- [x] **Kalkulačka času** → `obsah/time_calc.html`
- [x] **Losovač / kolo štěstí** → `obsah/random_picker.html`
- [x] **Počítadlo slov a znaků** → `obsah/word_counter.html`

### 🩺 Zdraví & Kondice
- [x] **Deník krevního tlaku** → `obsah/blood_pressure.html`
- [x] **Kalkulačka tepových zón** → `obsah/heart_zones.html`

### 🌍 Geo & Počasí
- [x] **Převodník GPS souřadnic** → `obsah/gps_converter.html`
- [x] **Kompas & azimut** → `obsah/compass_azimuth.html`
- [x] **Výškový profil trasy** → `obsah/elevation_profile.html`

### 🎨 Design & Média
- [x] **Generátor CSS gradientů** → `obsah/gradient_gen.html`
- [x] **Generátor stínů (box-shadow)** → `obsah/shadow_gen.html`
- [x] **Favicon generátor** → `obsah/favicon_gen.html`
- [x] **Pixel art editor** → `obsah/pixel_art.html`
- [x] **Generátor SVG blobů / vln** → `obsah/blob_gen.html`

### 📐 Technické & 3D
- [x] **Elektro kalkulačka (Ohmův zákon)** → `obsah/ohm_calc.html`
- [x] **Převodník číselných soustav** → `obsah/number_base.html`
- [x] **Kalkulačka objemu a hmotnosti materiálu** → `obsah/material_weight.html`
- [x] **Spotřeba filamentu 3D tisku** → `obsah/filament_calc.html`
- [x] **Trigonometrická kalkulačka** → `obsah/triangle_calc.html`

### 💻 Vývoj & DB
- [x] **UUID / GUID generátor** → `obsah/uuid_gen.html`
- [x] **Hash generátor** → `obsah/hash_gen.html`
- [x] **Unix timestamp převodník** → `obsah/timestamp_conv.html`
- [x] **CSV ↔ JSON převodník** → `obsah/csv_json.html`
- [x] **Lorem ipsum / testovací data** → `obsah/lorem_ipsum.html`
- [x] **Kontrola kontrastu barev (WCAG)** → `obsah/contrast_checker.html`
- [x] **Cron expression builder** → `obsah/cron_builder.html`

### 🎓 Vzdělávání
- [x] **Procvičování násobilky / počtů** → `obsah/multiplication.html`
- [x] **Periodická tabulka prvků** → `obsah/periodic_table.html`
- [x] **Kvíz: vlajky a hlavní města** → `obsah/flags_quiz.html`
- [x] **Trenažér psaní všemi deseti** → `obsah/typing_trainer.html`
- [x] **Morseova abeceda** → `obsah/morse_code.html`

### 🎮 Hry
- [x] **Sudoku** → `obsah/sudoku.html`
- [x] **Wordle (česky)** → `obsah/wordle.html`
- [x] **Kámen, nůžky, papír** → `obsah/rock_paper_scissors.html`
- [x] **Sokoban** → `obsah/sokoban.html`
- [x] **Osmisměrka** → `obsah/osmismerka.html`

---

## 5. 🌟 Další návrhy na nové stránky (kolo 3) — ✅ HOTOVO (vše vytvořeno a napojeno)

> Všechny stránky používají obecné příklady (žádná zmínka o konkrétní firmě).

### 📊 Produktivita
- [x] **Kanban tabule** → `obsah/kanban.html`
- [x] **Odpočet do události (countdown)** → `obsah/countdown.html`
- [x] **Šifrované poznámky** → `obsah/secure_notes.html`
- [x] **Generátor e-mailového podpisu** → `obsah/email_signature.html`

### 🩺 Zdraví & Kondice
- [x] **Připomínač léků / rozvrh** → `obsah/medication_reminder.html`
- [x] **Tracker nálady (mood)** → `obsah/mood_tracker.html`
- [x] **Kalkulačka ideální hmotnosti** → `obsah/ideal_weight.html`
- [x] **Tracker spánku** → `obsah/sleep_tracker.html`

### 🌍 Geo & Počasí
- [x] **Kalkulačka rosného bodu & vlhkosti** → `obsah/dew_point.html`
- [x] **Převodník meteo jednotek** → `obsah/meteo_units.html`
- [x] **Plocha pozemku z GPS bodů** → `obsah/gps_area.html`

### 🎨 Design & Média
- [x] **Generátor Wi-Fi QR kódu** → `obsah/wifi_qr.html`
- [x] **Dithering / pixelizace obrázku** → `obsah/dither.html`
- [x] **Generátor opakujících se vzorů (SVG)** → `obsah/pattern_gen.html`
- [x] **Picker emoji & symbolů** → `obsah/emoji_picker.html`
- [x] **Generátor meme** → `obsah/meme_gen.html`

### 📐 Technické & 3D
- [x] **Kalkulačka rozvinu ohýbaného plechu** → `obsah/sheet_bend.html`
- [x] **Řezné podmínky (CNC/soustružení)** → `obsah/cutting_speed.html`
- [x] **Převodník tlaku / síly / momentu** → `obsah/pressure_force.html`
- [x] **Kalkulačka pravoúhlého trojúhelníku** → `obsah/right_triangle.html`
- [x] **Kalkulačka průhybu nosníku** → `obsah/beam_deflection.html`

### 💻 Vývoj & DB
- [x] **JWT decoder** → `obsah/jwt_decoder.html`
- [x] **Převodník velikosti písmen** → `obsah/case_converter.html`
- [x] **Slug generátor** → `obsah/slug_gen.html`
- [x] **Live HTML/CSS/JS editor** → `obsah/live_editor.html`
- [x] **Reference HTTP stavových kódů** → `obsah/http_status.html`
- [x] **.gitignore generátor** → `obsah/gitignore_gen.html`

### 🎓 Vzdělávání
- [x] **Převodník římských číslic** → `obsah/roman_numerals.html`
- [x] **Kartičky / flashcards** → `obsah/flashcards.html`
- [x] **Kalkulačka zlomků** → `obsah/fraction_calc.html`
- [x] **Trénink mentální matematiky** → `obsah/mental_math.html`

### 🎮 Hry
- [x] **Lodě (Battleship)** → `obsah/battleship.html`
- [x] **Čtyři v řadě (Connect 4)** → `obsah/connect4.html`
- [x] **Simon** → `obsah/simon.html`
- [x] **Lights Out** → `obsah/lights_out.html`
- [x] **Hanojské věže** → `obsah/hanoi.html`
- [x] **Breakout / Arkanoid** → `obsah/breakout.html`

---

## 6. 💡 Další návrhy na nové stránky (kolo 4) — ✅ HOTOVO (vše vytvořeno a napojeno)

### 📝 Psaní & text
- [x] **Částka slovy** — převod čísla na český slovní zápis (hodí se k fakturám) → `obsah/amount_words.html`
- [x] **Generátor jmen** — náhodná jména osob/postav/projektů → `obsah/name_gen.html`

### ✅ Organizace & čas
- [x] **Kalkulačka datumů** — dny mezi daty, pracovní dny, státní svátky ČR → `obsah/date_calc.html`
- [x] **Týdenní jídelníček** — plánovač jídel s generováním nákupního seznamu → `obsah/meal_planner.html`
- [x] **Rozhodovací matice** — vážené hodnocení variant podle kritérií → `obsah/decision_matrix.html`
- [x] **Vícenásobné stopky & časovače** — několik nezávislých časovačů najednou → `obsah/timers.html`

### 🩺 Zdraví & kondice
- [x] **Pitný režim** — denní tracker vypité vody s cílem → `obsah/water_tracker.html`
- [x] **Reakční test** — měření reakční doby → `obsah/reaction_test.html`
- [x] **Test barvocitu** — orientační Ishihara tabulky → `obsah/color_vision.html`

### 🗺️ Mapy & cesty
- [x] **Náklady na cestu** — palivo, opotřebení, rozpočítání mezi spolujezdce → `obsah/trip_cost.html`

### 🎨 Grafika & generátory
- [x] **Flowchart / diagramy** — jednoduchý editor vývojových diagramů (SVG export) → `obsah/flowchart.html`
- [x] **Generátor diplomů** — certifikát/diplom k tisku podle šablony → `obsah/certificate_gen.html`
- [x] **Náhled a párování fontů** — ukázky systémových fontů vedle sebe → `obsah/font_preview.html`
- [x] **Simulace barvosleposti** — náhled barev/obrázku očima barvoslepého → `obsah/colorblind_sim.html`

### 🖼️ Obrázky & foto
- [x] **EXIF prohlížeč** — zobrazení a odstranění metadat z fotky → `obsah/exif_viewer.html`
- [x] **Vodoznak** — text/logo do obrázku, dávkově → `obsah/watermark.html`
- [x] **Ořez obrázku** — crop s poměry stran (4:3, 16:9, čtverec…) → `obsah/image_crop.html`

### 🎬 Audio & video
- [x] **Hlasový záznamník** — nahrávání z mikrofonu, export WAV/WebM → `obsah/voice_recorder.html`
- [x] **Ladička** — chromatická ladička přes mikrofon → `obsah/tuner.html`
- [x] **Metronom** — tempo, takty, akcenty → `obsah/metronome.html`
- [x] **Piano** — hratelná klaviatura s klávesnicí → `obsah/piano.html`

### 📐 Strojní & 3D
- [x] **Tolerance a uložení ISO** — H7/g6 apod., mezní úchylky → `obsah/iso_tolerance.html`
- [x] **Převodník tvrdosti** — HRC ↔ HB ↔ HV ↔ Rm → `obsah/hardness_conv.html`
- [x] **Převodové poměry** — řemeny/řetězy/ozubení, otáčky a momenty → `obsah/gear_ratio.html`

### 🧮 Výpočty & převody
- [x] **Statistika** — průměr, medián, rozptyl, směrodatná odchylka ze seznamu čísel → `obsah/statistics.html`
- [x] **Kreslič grafů funkcí** — vykreslení y = f(x) → `obsah/function_plot.html`
- [x] **Řešič rovnic** — lineární a kvadratické rovnice s postupem → `obsah/equation_solver.html`

### 💻 Vývoj & nástroje
- [x] **Generátor Markdown tabulek** — vizuální editor → MD → `obsah/md_table.html`
- [x] **Keycode tester** — zobrazení event.key/code stisknuté klávesy → `obsah/keycode.html`
- [x] **Generátor testovacích dat** — mock jména, adresy, IČO, e-maily (CSV/JSON) → `obsah/mock_data.html`

### 🎓 Vzdělávání
- [x] **Hvězdná obloha** — souhvězdí podle data a polohy → `obsah/star_map.html`
- [x] **Hudební nauka** — noty, stupnice, kvintakord → `obsah/music_theory.html`
- [x] **Fyzikální vzorce a konstanty** — přehled s dosazovací kalkulačkou → `obsah/physics_ref.html`
- [x] **Slovní druhy** — procvičování pro školáky → `obsah/slovni_druhy.html`

### 🕹️ Hry
- [x] **Šachy** — proti druhému hráči u jednoho PC → `obsah/chess.html`
- [x] **Solitaire (Klondike)** → `obsah/solitaire.html`
- [x] **Kostky (Yahtzee)** → `obsah/yahtzee.html`
- [x] **Reversi / Othello** → `obsah/reversi.html`
- [x] **Pong** → `obsah/pong.html`
- [x] **Asteroids** → `obsah/asteroids.html`
- [x] **Vědomostní kvíz (trivia)** — otázky z okruhů, skóre → `obsah/trivia.html`
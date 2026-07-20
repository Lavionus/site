# Návrhy na další stránky/aplikace

Návrhy vycházejí z toho, co už katalog v `apps.js` obsahuje (přes 200 existujících
aplikací), aby se nedublovalo. Řazeno podle stávajících skupin v katalogu, u každé
položky krátký popis a proč by mohla mít smysl vedle existujících appek.

## 🗂️ Produktivita

- **Zettelkasten / propojené poznámky** (`notes_graph.html`) – krátké lístky s odkazy mezi
  sebou a grafovým náhledem. `editor.html` a `secure_notes.html` jsou lineární, chybí
  propojování.
- **Generátor vizitky / vCard + QR** (`vcard_gen.html`) – vyplníš údaje, dostaneš QR
  s vCard k naskenování do telefonu. Navazuje na `wifi_qr.html` a `qr_generator.html`,
  ale konkrétně pro kontaktní údaje.
- **Docházka / evidence odpracovaných hodin** (`timesheet.html`) – jednoduchý týdenní
  výkaz s exportem do CSV, součty pro fakturaci. Doplňuje `invoice_gen.html`.
- **Generátor agendy schůzky / zápisu z porady** (`meeting_notes.html`) – šablona s body,
  akčními kroky a termíny, tisk/export do PDF.

## 🩺 Zdraví

- **Budík dle spánkových cyklů** (`sleep_cycle_alarm.html`) – zadáš čas buzení nebo
  usnutí, spočítá optimální časy (násobky 90 min). `sleep_tracker.html` jen loguje spánek
  zpětně, tohle by bylo plánovací.
- **Oční tabulka / rychlý test zraku (Snellenova tabulka)** (`vision_test.html`) – tisk
  nebo zobrazení na monitoru pro orientační test ostrosti vidění, doplňuje
  `color_vision.html` a `colorblind_sim.html`.
- **Kalendář růstu dítěte (percentily)** (`growth_chart.html`) – zadání výšky/váhy podle
  věku a zobrazení v percentilových křivkách. V katalogu chybí cokoliv pro rodiče
  malých dětí kromě `clock_learning`.
- **Lékárnička – rychlá první pomoc** (`first_aid_ref.html`) – přehledová referenční
  příručka (popáleniny, zlomeniny, alergická reakce) s vyhledáváním, offline. Podobný
  princip jako `physics_ref.html`, jen pro první pomoc.
- **Kalkulačka kofeinu za den** (`caffeine_tracker.html`) – sčítání dávek kofeinu z nápojů
  a upozornění na doporučený denní limit, doplňuje `water_tracker.html`.

## 🌿 Příroda & venku

- **Rybářský kalendář (fáze měsíce a aktivita ryb)** (`fishing_calendar.html`) – využívá
  stejná data jako `sun_moon.html`, ale cílené na predikci „kdy brát na ryby".
- **Plánovač záhonů (vizuální rozvržení zahrady)** (`garden_layout.html`) – interaktivní
  mřížka záhonů s přetahováním plodin, respektuje `crop_rotation.html` (střídání plodin)
  a `seeding_calc.html`, ale řeší prostorové rozmístění, ne jen termíny.
- **Astronomický kalendář úkazů** (`sky_events.html`) – meteorické roje, zatmění,
  konjunkce planet v daném roce a místě; navazuje na `star_map.html` a `sun_moon.html`.

## 🎨 Tvorba & média

- **Generátor komiksových stripů (2D, panely + bubliny)** (`comic_strip.html`) – jiný
  přístup než `comic3d.html`/`comic3d_walk.html` (ty jsou 3D scény) – klasické 2D panely
  s textovými bublinami z vlastních obrázků.
- **Storyboard tvůrce** (`storyboard.html`) – mřížka scén s náčrtem, popiskem a časováním,
  pro video/film projekty.
- **Generátor nálepek (sticker) s obrysem** (`sticker_maker.html`) – nahraješ obrázek,
  aplikace vytvoří bílý obrys a export na tisk, jiné zaměření než `watermark.html`.
- **Paleta z obrázku (extrakce barev)** (`palette_from_image.html`) – nahrát fotku a
  vytáhnout dominantní barvy do palety; doplňuje `color_picker.html`, který barvy jen
  vybírá ručně.

## 📐 Technika

- **Kalkulačka spotřeby barvy/tapety na místnost** (`paint_coverage_calc.html`) – rozměry
  místnosti, počet vrstev → litry barvy nebo role tapety. Doplňuje `material_weight.html`
  a `filament_calc.html`, které řeší jiné materiály.
- **Kalkulačka betonové směsi** (`concrete_mix_calc.html`) – objem základu/desky →
  množství cementu, písku, štěrku, vody.
- **Sklon střechy / délka krokví** (`roof_pitch_calc.html`) – zadání rozpětí a sklonu,
  výpočet délky krokve a úhlů řezu.
- **Průřez a úbytek napětí na kabelu** (`cable_sizing_calc.html`) – doplňuje
  `ohm_calc.html`, ale cíleně pro dimenzování vodičů podle proudu a délky.
- **Kalkulačka pružin (tažné/tlačné)** (`spring_calc.html`) – tuhost, síla, počet závitů;
  zapadá vedle `gear_ratio.html`, `screw_calc.html`.

## 💻 Vývoj & data

- **Query string / URL builder a parser** (`url_builder.html`) – rozklad URL na části,
  skládání s parametry, encode/decode. Chybí vedle `base64_encoder.html`.
- **YAML ↔ JSON převodník** (`yaml_json.html`) – analogicky k `csv_json.html`.
- **Cheatsheet Git příkazů s vyhledáváním** (`git_cheatsheet.html`) – rychlá offline
  referenční příručka, podobný princip jako `http_status.html`.
- **Generátor .env / konfiguračních souborů** (`env_gen.html`) – formulář → `.env` nebo
  `docker-compose` úryvek, doplňuje `gitignore_gen.html`.
- **API/webhook tester** (`api_tester.html`) – jednoduchý klient pro GET/POST s hlavičkami,
  doplňuje `regex_tester.html` a `json_formatter.html`.

## 🎓 Vzdělávání

- **Němčina – slovíčka a časování** (`de_slovicka.html`) – katalog má jen angličtinu
  (`aj_slovicka`, `aj_slovesa`), němčina/další jazyk chybí úplně.
- **Fyzikální pokusy pro děti (simulace)** (`physics_playground.html`) – navazuje na
  `gravitacni_hriste.html`, ale širší (kyvadlo, nakloněná rovina, srážky).
- **Notová osnova – čtení not (trénink)** (`notes_reading.html`) – doplňuje
  `music_theory.html`, ale zaměřené na rychlé rozpoznávání not na lince.

## 🎮 Hry

- **Generátor bingo kartiček** (`bingo_gen.html`) – pro oslavy/výuku, tisk kartiček
  s náhodným rozmístěním čísel/slov.
- **Křížovka – generátor** (`crossword_gen.html`) – doplňuje `osmismerka.html` (ta je jen
  na hledání slov v mřížce), křížovka je jiný typ hádanky.

## ✉️ Ostatní

- **Stránka „O projektu" / changelog** (`about.html`) – přehled, kdy co přibylo v
  katalogu, odkaz na GitHub repo. Vhodné pro návštěvníky, kteří se ptají „co je nového".


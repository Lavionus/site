// Katalog aplikací – jediný zdroj pravdy pro menu, hledání a dashboard.
// Přidání aplikace = jeden záznam v poli `polozky` příslušné sekce.
// `tagy` jsou volitelná klíčová slova pro hledání (aliasy).
const KATALOG_SKUPINY = [
  { id: 'produktivita', label: '🗂️ Produktivita' },
  { id: 'zdravi',       label: '🩺 Zdraví' },
  { id: 'priroda',      label: '🌿 Příroda & venku' },
  { id: 'tvorba',       label: '🎨 Tvorba & média' },
  { id: 'technika',     label: '📐 Technika' },
  { id: 'vyvoj',        label: '💻 Vývoj & data' },
  { id: 'vzdelavani',   label: '🎓 Vzdělávání' },
  { id: 'hry',          label: '🎮 Hry' },
  { id: 'vysetrovani',  label: '🕵️ Vyšetřování' },
  { id: 'vareni',       label: '🍳 Vaření & recepty' },
  { id: 'dokumenty',    label: '📜 Právo & dokumenty' },
  { id: 'duchovno',     label: '📖 Duchovní život' },
  { id: 'ostatni',      label: '✉️ Ostatní' },
];

const KATALOG_SEKCE = [
  {
    "nazev": "📝 Psaní & text",
    "skupina": "produktivita",
    "polozky": [
      {
        "soubor": "obsah/editor.html",
        "nazev": "📝 Editor",
        "tagy": [
          "poznámky",
          "text",
          "psaní"
        ]
      },
      {
        "soubor": "obsah/brainstorm.html",
        "nazev": "💡 Brainstorm",
        "tagy": [
          "nápady",
          "myšlenková mapa"
        ]
      },
      {
        "soubor": "obsah/md_html.html",
        "nazev": "📝 Markdown ↔ HTML"
      },
      {
        "soubor": "obsah/word_counter.html",
        "nazev": "🔡 Počítadlo slov"
      },
      {
        "soubor": "obsah/secure_notes.html",
        "nazev": "🔒 Šifrované poznámky",
        "tagy": [
          "heslo",
          "šifrování",
          "soukromé"
        ]
      },
      {
        "soubor": "obsah/password_vault.html",
        "nazev": "🔐 Trezor hesel",
        "tagy": ["heslo", "šifrování", "přihlašovací údaje", "login", "správce hesel"]
      },
      {
        "soubor": "obsah/notes_graph.html",
        "nazev": "🕸️ Zettelkasten (propojené poznámky)",
        "tagy": [
          "zettelkasten",
          "wiki",
          "odkazy",
          "graf poznámek"
        ]
      },
      {
        "soubor": "obsah/skriptorium.html",
        "nazev": "📖 Skriptorium (tvůrce knih)",
        "tagy": [
          "kniha",
          "epub",
          "publikace",
          "book creator"
        ]
      },
      {
        "soubor": "obsah/amount_words.html",
        "nazev": "💬 Částka slovy",
        "tagy": [
          "faktura",
          "slovy",
          "koruna"
        ]
      },
      {
        "soubor": "obsah/name_gen.html",
        "nazev": "🎲 Generátor jmen"
      },
      {
        "soubor": "obsah/print_editor.html",
        "nazev": "🖨️ Editor pro tisk a export",
        "tagy": ["tisk", "markdown", "export", "html editor", "wysiwyg", "formátování"]
      }
    ]
  },
  {
    "nazev": "✅ Organizace & čas",
    "skupina": "produktivita",
    "polozky": [
      {
        "soubor": "obsah/kalendar.html",
        "nazev": "📅 Kalendář",
        "tagy": [
          "diář",
          "události",
          "svátky"
        ]
      },
      {
        "soubor": "obsah/todo.html",
        "nazev": "✅ Úkoly",
        "tagy": [
          "seznam",
          "to-do",
          "checklist"
        ]
      },
      {
        "soubor": "obsah/pomodoro.html",
        "nazev": "🍅 Pomodoro",
        "tagy": [
          "časovač",
          "soustředění",
          "produktivita"
        ]
      },
      {
        "soubor": "obsah/habit_tracker.html",
        "nazev": "🎯 Sledování návyků"
      },
      {
        "soubor": "obsah/kanban.html",
        "nazev": "📋 Kanban tabule",
        "tagy": [
          "úkoly",
          "nástěnka",
          "projekt"
        ]
      },
      {
        "soubor": "obsah/project_manager.html",
        "nazev": "🗂️ Správce projektů",
        "tagy": [
          "projekty",
          "úkoly",
          "gantt"
        ]
      },
      {
        "soubor": "obsah/countdown.html",
        "nazev": "⏳ Odpočet do události"
      },
      {
        "soubor": "obsah/time_calc.html",
        "nazev": "⏱️ Kalkulačka času"
      },
      {
        "soubor": "obsah/timesheet.html",
        "nazev": "⏱️ Docházka / evidence hodin",
        "tagy": [
          "docházka",
          "výkaz",
          "hodiny",
          "fakturace"
        ]
      },
      {
        "soubor": "obsah/meeting_notes.html",
        "nazev": "🗒️ Zápis z porady",
        "tagy": [
          "agenda",
          "porada",
          "schůzka",
          "úkoly"
        ]
      },
      {
        "soubor": "obsah/calendar_print.html",
        "nazev": "🗓️ Tisknutelný kalendář"
      },
      {
        "soubor": "obsah/date_calc.html",
        "nazev": "📅 Kalkulačka datumů",
        "tagy": [
          "dny",
          "pracovní dny",
          "svátky",
          "datum"
        ]
      },
      {
        "soubor": "obsah/meal_planner.html",
        "nazev": "🍽️ Týdenní jídelníček",
        "tagy": [
          "jídlo",
          "vaření",
          "nákup",
          "recepty"
        ]
      },
      {
        "soubor": "obsah/decision_matrix.html",
        "nazev": "⚖️ Rozhodovací matice"
      },
      {
        "soubor": "obsah/timers.html",
        "nazev": "⏲️ Stopky & časovače"
      }
    ]
  },
  {
    "nazev": "💰 Finance & domácnost",
    "skupina": "produktivita",
    "polozky": [
      {
        "soubor": "obsah/cvGen.html",
        "nazev": "📄 Životopis",
        "tagy": [
          "cv",
          "resume",
          "zaměstnání"
        ]
      },
      {
        "soubor": "obsah/invoice_gen.html",
        "nazev": "🧾 Faktura / nabídka",
        "tagy": [
          "účet",
          "objednávka",
          "fakturace"
        ]
      },
      {
        "soubor": "obsah/expense_tracker.html",
        "nazev": "💰 Sledování výdajů",
        "tagy": [
          "rozpočet",
          "peníze",
          "útrata"
        ]
      },
      {
        "soubor": "obsah/loan_calc.html",
        "nazev": "🏦 Úvěr & hypotéka",
        "tagy": [
          "hypotéka",
          "půjčka",
          "splátka",
          "úrok"
        ]
      },
      {
        "soubor": "obsah/savings_calc.html",
        "nazev": "📈 Spoření & úročení",
        "tagy": [
          "úrok",
          "investice",
          "složené úročení"
        ]
      },
      {
        "soubor": "obsah/shopplanner.html",
        "nazev": "🛒 Plánovač nákupů",
        "tagy": [
          "nákupní seznam",
          "obchod"
        ]
      },
      {
        "soubor": "obsah/car_tracker.html",
        "nazev": "🚗 Spotřeba auta",
        "tagy": [
          "benzín",
          "nafta",
          "tankování",
          "palivo"
        ]
      },
      {
        "soubor": "obsah/odecty.html",
        "nazev": "🔌 Domácí odečty",
        "tagy": [
          "elektřina",
          "voda",
          "plyn",
          "energie",
          "měřák"
        ]
      },
      {
        "soubor": "obsah/dph_calc.html",
        "nazev": "🧾 Kalkulačka DPH",
        "tagy": [
          "daň",
          "sazba",
          "cena s dph",
          "cena bez dph"
        ]
      },
      {
        "soubor": "obsah/margin_calculator.html",
        "nazev": "🧾 Kalkulačka marže a cenotvorby",
        "tagy": ["marže", "přirážka", "markup", "cenotvorba", "prodejní cena"]
      },
      {
        "soubor": "obsah/net_salary.html",
        "nazev": "💵 Čistá mzda ČR",
        "tagy": [
          "hrubá mzda",
          "plat",
          "odvody",
          "daň",
          "superhrubá"
        ]
      },
      {
        "soubor": "obsah/currency_conv.html",
        "nazev": "💱 Měnový převodník",
        "tagy": [
          "kurzy",
          "čnb",
          "euro",
          "dolar",
          "valuty"
        ]
      },
      {
        "soubor": "obsah/unit_price.html",
        "nazev": "🛒 Jednotková cena",
        "tagy": [
          "porovnání",
          "nákup",
          "kč/kg",
          "kč/l",
          "balení"
        ]
      }
    ]
  },
  {
    "nazev": "🧰 Drobné nástroje",
    "skupina": "produktivita",
    "polozky": [
      {
        "soubor": "obsah/unit_converter.html",
        "nazev": "⚖️ Konvertor jednotek",
        "tagy": [
          "jednotky",
          "míry",
          "váhy",
          "převod"
        ]
      },
      {
        "soubor": "obsah/password_gen.html",
        "nazev": "🔑 Generátor hesel",
        "tagy": [
          "bezpečnost",
          "passphrase"
        ]
      },
      {
        "soubor": "obsah/qr_generator.html",
        "nazev": "📱 QR generátor + čtečka",
        "tagy": [
          "qr kód",
          "čtečka",
          "skener"
        ]
      },
      {
        "soubor": "obsah/random_picker.html",
        "nazev": "🎡 Losovač / kolo štěstí",
        "tagy": [
          "náhoda",
          "losování",
          "ruleta",
          "výběr"
        ]
      },
      {
        "soubor": "obsah/email_signature.html",
        "nazev": "✉️ E-mailový podpis"
      },
      {
        "soubor": "obsah/vcard_gen.html",
        "nazev": "📇 Vizitka (vCard + QR)",
        "tagy": [
          "vizitka",
          "vcard",
          "kontakt",
          "qr"
        ]
      },
      {
        "soubor": "obsah/wifi_qr.html",
        "nazev": "📶 Wi-Fi QR kód",
        "tagy": [
          "wifi",
          "připojení",
          "qr"
        ]
      },
      {
        "soubor": "obsah/snippet_manager.html",
        "nazev": "📋 Snippet manager",
        "tagy": ["šablony", "textové bloky", "e-mail", "rychlé odpovědi", "clipboard"]
      }
    ]
  },
  {
    "nazev": "🩺 Zdraví & kondice",
    "skupina": "zdravi",
    "polozky": [
      {
        "soubor": "obsah/kondiciogram.html",
        "nazev": "📊 Kondiciogram",
        "tagy": [
          "biorytmus",
          "kondice"
        ]
      },
      {
        "soubor": "obsah/kondiciogram_retro.html",
        "nazev": "🖨️ Kondiciogram retro"
      },
      {
        "soubor": "obsah/relaxsounds.html",
        "nazev": "🌧️ Relaxační zvuky",
        "tagy": [
          "déšť",
          "zvuky",
          "spánek",
          "meditace"
        ]
      },
      {
        "soubor": "obsah/bmi_calc.html",
        "nazev": "🩺 BMI & kalorie",
        "tagy": [
          "váha",
          "kalorie",
          "dieta",
          "index"
        ]
      },
      {
        "soubor": "obsah/breathing.html",
        "nazev": "🫁 Dechové cvičení",
        "tagy": [
          "relaxace",
          "stres",
          "meditace"
        ]
      },
      {
        "soubor": "obsah/workout_log.html",
        "nazev": "🏋️ Tréninkový deník",
        "tagy": [
          "cvičení",
          "posilování",
          "fitness"
        ]
      },
      {
        "soubor": "obsah/blood_pressure.html",
        "nazev": "🩸 Deník krevního tlaku",
        "tagy": [
          "tlak",
          "hypertenze",
          "puls"
        ]
      },
      {
        "soubor": "obsah/heart_zones.html",
        "nazev": "❤️ Tepové zóny",
        "tagy": [
          "tep",
          "puls",
          "kardio",
          "běh"
        ]
      },
      {
        "soubor": "obsah/medication_reminder.html",
        "nazev": "💊 Rozvrh léků",
        "tagy": [
          "léky",
          "prášky",
          "dávkování"
        ]
      },
      {
        "soubor": "obsah/mood_tracker.html",
        "nazev": "😊 Tracker nálady"
      },
      {
        "soubor": "obsah/ideal_weight.html",
        "nazev": "⚖️ Ideální hmotnost"
      },
      {
        "soubor": "obsah/sleep_tracker.html",
        "nazev": "😴 Tracker spánku",
        "tagy": [
          "spánek",
          "usínání"
        ]
      },
      {
        "soubor": "obsah/water_tracker.html",
        "nazev": "💧 Pitný režim",
        "tagy": [
          "voda",
          "hydratace"
        ]
      },
      {
        "soubor": "obsah/reaction_test.html",
        "nazev": "⚡ Reakční test"
      },
      {
        "soubor": "obsah/color_vision.html",
        "nazev": "👁️ Test barvocitu"
      },
      {
        "soubor": "obsah/sleep_cycle_alarm.html",
        "nazev": "😴 Budík dle spánkových cyklů",
        "tagy": [
          "spánek",
          "budík",
          "cykly",
          "usínání"
        ]
      },
      {
        "soubor": "obsah/vision_test.html",
        "nazev": "👁️ Oční tabulka (test zraku)",
        "tagy": [
          "zrak",
          "snellen",
          "oči"
        ]
      },
      {
        "soubor": "obsah/growth_chart.html",
        "nazev": "📈 Kalendář růstu dítěte (percentily)",
        "tagy": [
          "dítě",
          "růst",
          "percentil",
          "výška",
          "váha"
        ]
      },
      {
        "soubor": "obsah/first_aid_ref.html",
        "nazev": "🩹 Lékárnička – první pomoc",
        "tagy": [
          "první pomoc",
          "úraz",
          "kpr",
          "resuscitace"
        ]
      },
      {
        "soubor": "obsah/caffeine_tracker.html",
        "nazev": "☕ Kalkulačka kofeinu",
        "tagy": [
          "kofein",
          "káva",
          "energy drink"
        ]
      }
    ]
  },
  {
    "nazev": "🌦️ Počasí",
    "skupina": "priroda",
    "polozky": [
      {
        "soubor": "obsah/forecast.html",
        "nazev": "🌧️ Předpověď",
        "tagy": [
          "počasí",
          "déšť",
          "teplota",
          "meteo"
        ]
      },
      {
        "soubor": "obsah/weather_globe.html",
        "nazev": "🌍 Glóbus počasí"
      },
      {
        "soubor": "obsah/pocasi_eu.html",
        "nazev": "🌦️ Počasí Evropy",
        "tagy": [
          "meteo",
          "mapa počasí"
        ]
      },
      {
        "soubor": "obsah/radareu.html",
        "nazev": "📡 Radar EU",
        "tagy": [
          "srážky",
          "déšť",
          "bouřky",
          "počasí"
        ]
      },
      {
        "soubor": "obsah/historicalWeather.html",
        "nazev": "📉 Historie",
        "tagy": [
          "počasí",
          "archiv",
          "srážky",
          "teploty"
        ]
      },
      {
        "soubor": "obsah/dew_point.html",
        "nazev": "💧 Rosný bod & vlhkost"
      },
      {
        "soubor": "obsah/meteo_units.html",
        "nazev": "🌡️ Převodník meteo jednotek"
      }
    ]
  },
  {
    "nazev": "🌱 Zahrada & pěstování",
    "skupina": "priroda",
    "polozky": [
      {
        "soubor": "obsah/crop_rotation.html",
        "nazev": "🔄 Plánovač střídání plodin",
        "tagy": [
          "zahrada",
          "osevní postup",
          "plodiny"
        ]
      },
      {
        "soubor": "obsah/garden_layout.html",
        "nazev": "🌱 Plánovač záhonů",
        "tagy": [
          "zahrada",
          "záhon",
          "rozvržení",
          "plán"
        ]
      },
      {
        "soubor": "obsah/seeding_calc.html",
        "nazev": "🌾 Kalkulačka výsevku",
        "tagy": [
          "setí",
          "osivo",
          "zahrada"
        ]
      },
      {
        "soubor": "obsah/fertilizer_calc.html",
        "nazev": "🌱 Kalkulačka hnojení N-P-K",
        "tagy": [
          "hnojivo",
          "zahrada",
          "dusík"
        ]
      },
      {
        "soubor": "obsah/rainfall_gdd.html",
        "nazev": "🌧️ Srážky & GDD",
        "tagy": [
          "srážky",
          "růstové stupně",
          "zahrada",
          "pole"
        ]
      },
      {
        "soubor": "obsah/fishing_calendar.html",
        "nazev": "🎣 Rybářský kalendář",
        "tagy": [
          "rybaření",
          "solunární",
          "měsíc",
          "ryby"
        ]
      }
    ]
  },
  {
    "nazev": "🗺️ Mapy & cesty",
    "skupina": "priroda",
    "polozky": [
      {
        "soubor": "obsah/trip_planner.html",
        "nazev": "🥾 Plánovač tras",
        "tagy": [
          "trasa",
          "výlet",
          "turistika",
          "mapa"
        ]
      },
      {
        "soubor": "obsah/vacation_planner.html",
        "nazev": "🗺️ Plánovač dovolené",
        "tagy": [
          "dovolená",
          "cestování",
          "itinerář"
        ]
      },
      {
        "soubor": "obsah/gpx_viewer.html",
        "nazev": "📡 GPX Viewer",
        "tagy": [
          "trasa",
          "gps",
          "záznam",
          "mapa"
        ]
      },
      {
        "soubor": "obsah/travel_diary.html",
        "nazev": "✈️ Cestovní deník"
      },
      {
        "soubor": "obsah/packing_list.html",
        "nazev": "🎒 Balicí seznam",
        "tagy": [
          "kufr",
          "dovolená",
          "seznam"
        ]
      },
      {
        "soubor": "obsah/travel_budget.html",
        "nazev": "💶 Cestovní rozpočet"
      },
      {
        "soubor": "obsah/map_export.html",
        "nazev": "🗺️ Mapový exportér",
        "tagy": [
          "mapa",
          "tisk",
          "export"
        ]
      },
      {
        "soubor": "obsah/map_compare.html",
        "nazev": "⚖️ Porovnání map",
        "tagy": [
          "historické mapy",
          "porovnání"
        ]
      },
      {
        "soubor": "obsah/distance_measure.html",
        "nazev": "📏 Měřič vzdáleností",
        "tagy": [
          "mapa",
          "měření",
          "vzdálenost",
          "plocha"
        ]
      },
      {
        "soubor": "obsah/elevation_profile.html",
        "nazev": "⛰️ Výškový profil",
        "tagy": [
          "nadmořská výška",
          "stoupání",
          "trasa"
        ]
      },
      {
        "soubor": "obsah/gps_area.html",
        "nazev": "📐 Plocha z GPS bodů",
        "tagy": [
          "pozemek",
          "výměra",
          "hektar",
          "parcela"
        ]
      },
      {
        "soubor": "obsah/trip_cost.html",
        "nazev": "🚗 Náklady na cestu",
        "tagy": [
          "palivo",
          "benzín",
          "spolujezdci",
          "kilometrovné"
        ]
      }
    ]
  },
  {
    "nazev": "🧭 Navigace & čas",
    "skupina": "priroda",
    "polozky": [
      {
        "soubor": "obsah/gps_converter.html",
        "nazev": "🧭 Převodník GPS",
        "tagy": [
          "souřadnice",
          "wgs84",
          "převod"
        ]
      },
      {
        "soubor": "obsah/compass_azimuth.html",
        "nazev": "🧭 Kompas & azimut"
      },
      {
        "soubor": "obsah/sun_moon.html",
        "nazev": "🌅 Slunce & Měsíc",
        "tagy": [
          "východ",
          "západ",
          "fáze měsíce",
          "slunce"
        ]
      },
      {
        "soubor": "obsah/world_clock.html",
        "nazev": "🕐 Světové hodiny",
        "tagy": [
          "časová pásma",
          "čas",
          "hodiny"
        ]
      },
      {
        "soubor": "obsah/sextant.html",
        "nazev": "🧭 Sextant – poloha podle hvězd",
        "tagy": ["astronavigace", "polárka", "zeměpisná šířka", "slunce v poledne"]
      }
    ]
  },
  {
    "nazev": "🎨 Grafika & generátory",
    "skupina": "tvorba",
    "polozky": [
      {
        "soubor": "obsah/color_picker.html",
        "nazev": "🎨 Color picker & palety",
        "tagy": [
          "barvy",
          "paleta",
          "hex",
          "rgb"
        ]
      },
      {
        "soubor": "obsah/gradient_gen.html",
        "nazev": "🌈 CSS gradienty"
      },
      {
        "soubor": "obsah/shadow_gen.html",
        "nazev": "🌑 Generátor stínů"
      },
      {
        "soubor": "obsah/pattern_gen.html",
        "nazev": "🔳 Generátor vzorů"
      },
      {
        "soubor": "obsah/blob_gen.html",
        "nazev": "🫧 SVG bloby"
      },
      {
        "soubor": "obsah/favicon_gen.html",
        "nazev": "⭐ Favicon generátor"
      },
      {
        "soubor": "obsah/Circle_generator.html",
        "nazev": "⭕ Kružnice"
      },
      {
        "soubor": "obsah/stained_glass.html",
        "nazev": "🔷 Vitráž"
      },
      {
        "soubor": "obsah/comic3d.html",
        "nazev": "💥 Komiksový 3D prostor"
      },
      {
        "soubor": "obsah/comic3d_walk.html",
        "nazev": "🚶 Komiksový 3D svět (procházka)"
      },
      {
        "soubor": "obsah/comic_strip.html",
        "nazev": "💬 Generátor komiksových stripů",
        "tagy": [
          "komiks",
          "bublina",
          "panely",
          "strip"
        ]
      },
      {
        "soubor": "obsah/storyboard.html",
        "nazev": "🎬 Storyboard tvůrce",
        "tagy": [
          "scénář",
          "video",
          "film",
          "scény"
        ]
      },
      {
        "soubor": "obsah/palette_from_image.html",
        "nazev": "🎨 Paleta z obrázku",
        "tagy": [
          "barvy",
          "paleta",
          "extrakce",
          "hex"
        ]
      },
      {
        "soubor": "obsah/sticker_maker.html",
        "nazev": "🏷️ Generátor nálepek",
        "tagy": [
          "sticker",
          "nálepka",
          "obrys"
        ]
      },
      {
        "soubor": "obsah/ascii_art.html",
        "nazev": "🔤 ASCII art"
      },
      {
        "soubor": "obsah/pixel_art.html",
        "nazev": "🎨 Pixel art editor"
      },
      {
        "soubor": "obsah/meme_gen.html",
        "nazev": "🖼️ Generátor meme"
      },
      {
        "soubor": "obsah/emoji_picker.html",
        "nazev": "😀 Picker emoji"
      },
      {
        "soubor": "obsah/whiteboard.html",
        "nazev": "✏️ Whiteboard",
        "tagy": [
          "kreslení",
          "tabule",
          "skica"
        ]
      },
      {
        "soubor": "obsah/wedding_invite.html",
        "nazev": "💍 Svatební oznámení"
      },
      {
        "soubor": "obsah/flowchart.html",
        "nazev": "🔀 Flowchart editor",
        "tagy": [
          "diagram",
          "schéma",
          "vývojový"
        ]
      },
      {
        "soubor": "obsah/certificate_gen.html",
        "nazev": "🏆 Generátor diplomů"
      },
      {
        "soubor": "obsah/font_preview.html",
        "nazev": "🔤 Náhled fontů"
      },
      {
        "soubor": "obsah/colorblind_sim.html",
        "nazev": "🌈 Simulace barvosleposti"
      }
    ]
  },
  {
    "nazev": "🖼️ Obrázky & foto",
    "skupina": "tvorba",
    "polozky": [
      {
        "soubor": "obsah/PNG_merger.html",
        "nazev": "🖼️ Koláže",
        "tagy": [
          "koláž",
          "spojení obrázků",
          "mřížka"
        ]
      },
      {
        "soubor": "obsah/IMG_print.html",
        "nazev": "🖼️ Resizer obrázků",
        "tagy": [
          "tisk",
          "zmenšení",
          "velikost obrázku"
        ]
      },
      {
        "soubor": "obsah/image_converter.html",
        "nazev": "🖼️ Převodník obrázků",
        "tagy": [
          "webp",
          "png",
          "jpg",
          "formát"
        ]
      },
      {
        "soubor": "obsah/dither.html",
        "nazev": "🌫️ Dithering obrázku"
      },
      {
        "soubor": "obsah/Heritage.html",
        "nazev": "🌳 Heritage tree"
      },
      {
        "soubor": "obsah/gene_map.html",
        "nazev": "🧬 Mapa dědičnosti"
      },
      {
        "soubor": "obsah/exif_viewer.html",
        "nazev": "📷 EXIF prohlížeč"
      },
      {
        "soubor": "obsah/watermark.html",
        "nazev": "💧 Vodoznak"
      },
      {
        "soubor": "obsah/image_crop.html",
        "nazev": "✂️ Ořez obrázku"
      }
    ]
  },
  {
    "nazev": "🎬 Audio & video",
    "skupina": "tvorba",
    "polozky": [
      {
        "soubor": "obsah/mp3cutter.html",
        "nazev": "✂️ MP3 ořez",
        "tagy": [
          "hudba",
          "střih",
          "audio",
          "vyzvánění"
        ]
      },
      {
        "soubor": "obsah/videocutter.html",
        "nazev": "🎬 Video ořez",
        "tagy": [
          "video",
          "střih"
        ]
      },
      {
        "soubor": "obsah/soundGen.html",
        "nazev": "🎵 Generátor zvuku"
      },
      {
        "soubor": "obsah/spectrum_visualizer.html",
        "nazev": "🎵 Zvukový vizualizér"
      },
      {
        "soubor": "obsah/voice_recorder.html",
        "nazev": "🎙️ Hlasový záznamník"
      },
      {
        "soubor": "obsah/tuner.html",
        "nazev": "🎸 Ladička"
      },
      {
        "soubor": "obsah/metronome.html",
        "nazev": "🥁 Metronom"
      },
      {
        "soubor": "obsah/piano.html",
        "nazev": "🎹 Piano"
      }
    ]
  },
  {
    "nazev": "📐 Strojní & 3D",
    "skupina": "technika",
    "polozky": [
      {
        "soubor": "obsah/Vzorce.html",
        "nazev": "🧮 Modul vzorců",
        "tagy": [
          "matematika",
          "výpočty",
          "vzorce",
          "latex"
        ]
      },
      {
        "soubor": "obsah/tubeRed.html",
        "nazev": "🔧 Redukce trubek"
      },
      {
        "soubor": "obsah/cookieCutter.html",
        "nazev": "🍪 Vykrajovátka"
      },
      {
        "soubor": "obsah/voronoi_stl.html",
        "nazev": "🕸 Voronoi z STL"
      },
      {
        "soubor": "obsah/papercraft.html",
        "nazev": "📦 Papírové modely",
        "tagy": [
          "pepakura",
          "papercraft",
          "stl",
          "obj",
          "3d",
          "střih",
          "rozklad",
          "lepení"
        ]
      },
      {
        "soubor": "obsah/gridGen.html",
        "nazev": "📏 Mřížka A4"
      },
      {
        "soubor": "obsah/splitGen.html",
        "nazev": "🍕 Dělič kruhu"
      },
      {
        "soubor": "obsah/screw_calc.html",
        "nazev": "🔩 Šrouby & závity",
        "tagy": [
          "závit",
          "metrický",
          "utahovací moment"
        ]
      },
      {
        "soubor": "obsah/gear_generator.html",
        "nazev": "⚙️ Ozubená kola"
      },
      {
        "soubor": "obsah/sheet_bend.html",
        "nazev": "📐 Rozvin plechu"
      },
      {
        "soubor": "obsah/cutting_speed.html",
        "nazev": "⚙️ Řezné podmínky"
      },
      {
        "soubor": "obsah/material_weight.html",
        "nazev": "⚖️ Hmotnost materiálu",
        "tagy": [
          "ocel",
          "hliník",
          "hustota",
          "hmotnost"
        ]
      },
      {
        "soubor": "obsah/filament_calc.html",
        "nazev": "🧵 Spotřeba filamentu",
        "tagy": [
          "3d tisk",
          "pla",
          "petg"
        ]
      },
      {
        "soubor": "obsah/iso_tolerance.html",
        "nazev": "📏 Tolerance a uložení ISO",
        "tagy": [
          "h7",
          "g6",
          "uložení",
          "díra",
          "hřídel"
        ]
      },
      {
        "soubor": "obsah/hardness_conv.html",
        "nazev": "🔨 Převodník tvrdosti"
      },
      {
        "soubor": "obsah/gear_ratio.html",
        "nazev": "⚙️ Převodové poměry"
      },
      {
        "soubor": "obsah/paint_coverage_calc.html",
        "nazev": "🎨 Spotřeba barvy/tapety",
        "tagy": [
          "malování",
          "barva",
          "tapeta",
          "místnost"
        ]
      },
      {
        "soubor": "obsah/concrete_mix_calc.html",
        "nazev": "🧱 Betonová směs",
        "tagy": [
          "beton",
          "cement",
          "stavba",
          "základy"
        ]
      },
      {
        "soubor": "obsah/roof_pitch_calc.html",
        "nazev": "🏠 Sklon střechy, krokve a plocha",
        "tagy": [
          "střecha",
          "krov",
          "krokev",
          "tesařina",
          "valbová",
          "pultová",
          "stanová"
        ]
      },
      {
        "soubor": "obsah/rafter_spacing_calc.html",
        "nazev": "📐 Rozteč krokví / trámků",
        "tagy": [
          "krokev",
          "rozteč",
          "pozednice",
          "krov",
          "tesařina",
          "rozestup"
        ]
      },
      {
        "soubor": "obsah/wooden_shed_3d.html",
        "nazev": "🪵 Dřevěná stavba – 3D a kusovník",
        "tagy": [
          "3d",
          "přístřešek",
          "domek",
          "kůlna",
          "kusovník",
          "krov",
          "dřevostavba",
          "kozy",
          "přístřešek na auta",
          "carport"
        ]
      },
      {
        "soubor": "obsah/cable_sizing_calc.html",
        "nazev": "🔌 Dimenzování kabelu",
        "tagy": [
          "elektro",
          "kabel",
          "úbytek napětí",
          "průřez"
        ]
      },
      {
        "soubor": "obsah/spring_calc.html",
        "nazev": "🌀 Kalkulačka pružin",
        "tagy": [
          "pružina",
          "tuhost",
          "strojírenství"
        ]
      }
    ]
  },
  {
    "nazev": "🧮 Výpočty & převody",
    "skupina": "technika",
    "polozky": [
      {
        "soubor": "obsah/angle_converter.html",
        "nazev": "📐 Úhly & měřítka"
      },
      {
        "soubor": "obsah/ohm_calc.html",
        "nazev": "⚡ Ohmův zákon"
      },
      {
        "soubor": "obsah/number_base.html",
        "nazev": "🔢 Číselné soustavy"
      },
      {
        "soubor": "obsah/pressure_force.html",
        "nazev": "🔧 Tlak / síla / moment"
      },
      {
        "soubor": "obsah/triangle_calc.html",
        "nazev": "📐 Trojúhelník"
      },
      {
        "soubor": "obsah/right_triangle.html",
        "nazev": "📐 Pravoúhlý trojúhelník"
      },
      {
        "soubor": "obsah/beam_deflection.html",
        "nazev": "🏗️ Průhyb nosníku"
      },
      {
        "soubor": "obsah/statistics.html",
        "nazev": "📊 Statistika dat"
      },
      {
        "soubor": "obsah/function_plot.html",
        "nazev": "📈 Grafy funkcí"
      },
      {
        "soubor": "obsah/equation_solver.html",
        "nazev": "🧮 Řešič rovnic"
      }
    ]
  },
  {
    "nazev": "💻 Vývoj & nástroje",
    "skupina": "vyvoj",
    "polozky": [
      {
        "soubor": "obsah/er_diagram.html",
        "nazev": "🗂️ ER Diagram Editor",
        "tagy": [
          "databáze",
          "entity",
          "schéma"
        ]
      },
      {
        "soubor": "obsah/json_formatter.html",
        "nazev": "🗂️ JSON formatter",
        "tagy": [
          "validátor",
          "pretty print"
        ]
      },
      {
        "soubor": "obsah/sql_formatter.html",
        "nazev": "🗄️ SQL formatter"
      },
      {
        "soubor": "obsah/diff_tool.html",
        "nazev": "🔀 Diff nástroj",
        "tagy": [
          "porovnání",
          "rozdíl",
          "text"
        ]
      },
      {
        "soubor": "obsah/live_editor.html",
        "nazev": "💻 Live HTML/CSS/JS editor",
        "tagy": [
          "html",
          "css",
          "js",
          "playground"
        ]
      },
      {
        "soubor": "obsah/regex_tester.html",
        "nazev": "🔍 Regex tester",
        "tagy": [
          "regulární výrazy",
          "vzory"
        ]
      },
      {
        "soubor": "obsah/http_status.html",
        "nazev": "🌐 HTTP stavové kódy"
      },
      {
        "soubor": "obsah/gitignore_gen.html",
        "nazev": "🚫 .gitignore generátor"
      },
      {
        "soubor": "obsah/cron_builder.html",
        "nazev": "⏰ Cron builder"
      },
      {
        "soubor": "obsah/md_table.html",
        "nazev": "📋 Markdown tabulky"
      },
      {
        "soubor": "obsah/keycode.html",
        "nazev": "⌨️ Keycode tester"
      },
      {
        "soubor": "obsah/mock_data.html",
        "nazev": "🧪 Testovací data",
        "tagy": [
          "fake data",
          "generátor",
          "testování",
          "ičo"
        ]
      },
      {
        "soubor": "obsah/git_cheatsheet.html",
        "nazev": "📚 Git cheatsheet",
        "tagy": [
          "git",
          "příkazy",
          "verzování"
        ]
      },
      {
        "soubor": "obsah/shortcuts_reference.html",
        "nazev": "⌨️ Přehled klávesových zkratek",
        "tagy": ["excel", "vs code", "photoshop", "prohlížeč", "hotkeys", "kombinace kláves"]
      },
      {
        "soubor": "obsah/env_gen.html",
        "nazev": "⚙️ Generátor .env souborů",
        "tagy": [
          "env",
          "konfigurace",
          "docker"
        ]
      },
      {
        "soubor": "obsah/api_tester.html",
        "nazev": "🛰️ API / webhook tester",
        "tagy": [
          "api",
          "http",
          "webhook",
          "rest"
        ]
      }
    ]
  },
  {
    "nazev": "🔧 Data & převodníky",
    "skupina": "vyvoj",
    "polozky": [
      {
        "soubor": "obsah/base64_encoder.html",
        "nazev": "🔐 Base64 / URL encoder",
        "tagy": [
          "kódování",
          "url",
          "encode",
          "decode"
        ]
      },
      {
        "soubor": "obsah/uuid_gen.html",
        "nazev": "🆔 UUID generátor"
      },
      {
        "soubor": "obsah/hash_gen.html",
        "nazev": "#️⃣ Hash generátor",
        "tagy": [
          "md5",
          "sha",
          "otisk"
        ]
      },
      {
        "soubor": "obsah/timestamp_conv.html",
        "nazev": "🕰️ Unix timestamp",
        "tagy": [
          "unix",
          "epoch",
          "čas",
          "datum"
        ]
      },
      {
        "soubor": "obsah/csv_json.html",
        "nazev": "🔄 CSV ↔ JSON",
        "tagy": [
          "tabulka",
          "data",
          "převod"
        ]
      },
      {
        "soubor": "obsah/lorem_ipsum.html",
        "nazev": "📝 Lorem ipsum"
      },
      {
        "soubor": "obsah/contrast_checker.html",
        "nazev": "🌗 Kontrast (WCAG)",
        "tagy": [
          "wcag",
          "přístupnost",
          "barvy"
        ]
      },
      {
        "soubor": "obsah/jwt_decoder.html",
        "nazev": "🔑 JWT decoder"
      },
      {
        "soubor": "obsah/case_converter.html",
        "nazev": "🔠 Převodník case"
      },
      {
        "soubor": "obsah/slug_gen.html",
        "nazev": "🔗 Slug generátor"
      },
      {
        "soubor": "obsah/url_builder.html",
        "nazev": "🔗 URL builder / parser",
        "tagy": [
          "url",
          "query string",
          "parametry"
        ]
      },
      {
        "soubor": "obsah/yaml_json.html",
        "nazev": "🔄 YAML ↔ JSON převodník",
        "tagy": [
          "yaml",
          "json",
          "konfigurace"
        ]
      }
    ]
  },
  {
    "nazev": "📖 Čeština",
    "skupina": "vzdelavani",
    "polozky": [
      {
        "soubor": "obsah/slabiky.html",
        "nazev": "📖 Slabiky a první čtení",
        "tagy": ["1. stupeň", "1. ročník", "2. ročník", "čtení", "slabikování"]
      },
      {
        "soubor": "obsah/vyjmenovana_slova.html",
        "nazev": "✍️ Vyjmenovaná slova",
        "tagy": ["1. stupeň", "3. ročník", "pravopis", "i/y"]
      },
      {
        "soubor": "obsah/doplnovacky.html",
        "nazev": "✍️ Doplňovačky i/y",
        "tagy": ["1. stupeň", "3. ročník", "4. ročník", "5. ročník", "pravopis", "diktát", "vyjmenovaná slova"]
      },
      {
        "soubor": "obsah/slovni_druhy.html",
        "nazev": "✏️ Slovní druhy",
        "tagy": ["1. stupeň", "2. stupeň", "mluvnice"]
      },
      {
        "soubor": "obsah/shoda_podmetu.html",
        "nazev": "✏️ Shoda podmětu s přísudkem",
        "tagy": ["2. stupeň", "6. ročník", "7. ročník", "pravopis", "koncovky", "příčestí"]
      },
      {
        "soubor": "obsah/literarni_smery.html",
        "nazev": "📚 Literární směry a autoři",
        "tagy": ["střední škola", "sš", "maturita", "literatura", "sloh"]
      },
      {
        "soubor": "obsah/reading_log.html",
        "nazev": "📚 Čtenářský deník",
        "tagy": ["knihy", "četba", "hodnocení", "literatura"]
      },
      {
        "soubor": "obsah/cteni_s_porozumenim.html",
        "nazev": "📖 Čtení s porozuměním",
        "tagy": ["čtení", "porozumění", "text", "otázky", "1. stupeň", "2. stupeň", "sš"]
      },
      {
        "soubor": "obsah/vetny_rozbor.html",
        "nazev": "✏️ Rozbor věty – větné členy",
        "tagy": ["mluvnice", "podmět", "přísudek", "předmět", "přívlastek", "2. stupeň"]
      },
      {
        "soubor": "obsah/diktat_gen.html",
        "nazev": "✍️ Generátor diktátů",
        "tagy": ["diktát", "pravopis", "poslech", "vyjmenovaná slova", "velká písmena"]
      },
      {
        "soubor": "obsah/synonyma_antonyma.html",
        "nazev": "🔁 Synonyma a antonyma",
        "tagy": ["slovní zásoba", "synonyma", "antonyma", "opozita"]
      }
    ]
  },
  {
    "nazev": "🔢 Matematika",
    "skupina": "vzdelavani",
    "polozky": [
      {
        "soubor": "obsah/pocitani.html",
        "nazev": "🔢 Počítání do 20 a 100",
        "tagy": ["1. stupeň", "1. ročník", "2. ročník", "3. ročník", "sčítání", "odčítání"]
      },
      {
        "soubor": "obsah/multiplication.html",
        "nazev": "✖️ Procvičování násobilky",
        "tagy": ["1. stupeň", "3. ročník", "násobení"]
      },
      {
        "soubor": "obsah/clock_learning.html",
        "nazev": "🕐 Učení hodin",
        "tagy": ["1. stupeň", "2. ročník", "čas", "hodiny"]
      },
      {
        "soubor": "obsah/prevody_jednotek.html",
        "nazev": "📏 Převody jednotek",
        "tagy": ["1. stupeň", "2. stupeň", "délka", "hmotnost", "objem", "čas", "jednotky"]
      },
      {
        "soubor": "obsah/fraction_calc.html",
        "nazev": "➗ Kalkulačka zlomků",
        "tagy": ["2. stupeň", "zlomky"]
      },
      {
        "soubor": "obsah/procenta.html",
        "nazev": "💯 Procenta a trojčlenka",
        "tagy": ["2. stupeň", "7. ročník", "8. ročník", "9. ročník", "úměra"]
      },
      {
        "soubor": "obsah/rovnice.html",
        "nazev": "🧮 Lineární rovnice",
        "tagy": ["2. stupeň", "8. ročník", "9. ročník", "neznámá", "algebra"]
      },
      {
        "soubor": "obsah/geo_tvary.html",
        "nazev": "🔺 Geometrické tvary a tělesa",
        "tagy": ["1. stupeň", "2. stupeň", "geometrie", "útvary"]
      },
      {
        "soubor": "obsah/geometrie_vzorce.html",
        "nazev": "📐 Obvody, obsahy, objemy",
        "tagy": ["2. stupeň", "6. ročník", "7. ročník", "8. ročník", "9. ročník", "geometrie", "vzorce"]
      },
      {
        "soubor": "obsah/grafy_funkci.html",
        "nazev": "📈 Grafy funkcí",
        "tagy": ["2. stupeň", "9. ročník", "střední škola", "sš", "funkce", "graf", "parabola"]
      },
      {
        "soubor": "obsah/roman_numerals.html",
        "nazev": "🏛️ Římské číslice",
        "tagy": ["číslice", "převod"]
      },
      {
        "soubor": "obsah/mental_math.html",
        "nazev": "🧠 Mentální matematika",
        "tagy": ["počítání zpaměti", "trénink"]
      },
      {
        "soubor": "obsah/desetinna_cisla.html",
        "nazev": "🔢 Desetinná čísla",
        "tagy": ["desetinná čísla", "sčítání", "porovnávání", "zaokrouhlování", "2. stupeň"]
      },
      {
        "soubor": "obsah/mocniny_odmocniny.html",
        "nazev": "√ Mocniny a odmocniny",
        "tagy": ["mocniny", "odmocniny", "2. stupeň"]
      },
      {
        "soubor": "obsah/kombinatorika.html",
        "nazev": "🎲 Kombinatorika a pravděpodobnost",
        "tagy": ["kombinatorika", "pravděpodobnost", "variace", "kombinace", "permutace", "sš"]
      },
      {
        "soubor": "obsah/trigonometrie.html",
        "nazev": "📐 Trigonometrie pravoúhlého trojúhelníku",
        "tagy": ["trigonometrie", "sinus", "kosinus", "tangens", "sš"]
      },
      {
        "soubor": "obsah/geometricke_konstrukce.html",
        "nazev": "📏 Geometrické konstrukce kružítkem",
        "tagy": ["geometrie", "kružítko", "pravítko", "konstrukce", "2. stupeň"]
      }
    ]
  },
  {
    "nazev": "🔬 Přírodní vědy",
    "skupina": "vzdelavani",
    "polozky": [
      {
        "soubor": "obsah/periodic_table.html",
        "nazev": "⚛️ Periodická tabulka",
        "tagy": ["chemie", "prvky", "mendělejev", "2. stupeň", "sš"]
      },
      {
        "soubor": "obsah/chem_nazvoslovi.html",
        "nazev": "⚗️ Chemické názvosloví",
        "tagy": ["chemie", "vzorce", "oxidy", "kyseliny", "soli", "2. stupeň", "sš"]
      },
      {
        "soubor": "obsah/vycislovani_rovnic.html",
        "nazev": "🧪 Vyčíslování chemických rovnic",
        "tagy": ["chemie", "2. stupeň", "8. ročník", "9. ročník", "sš", "koeficienty", "stechiometrie"]
      },
      {
        "soubor": "obsah/punnett.html",
        "nazev": "🧬 Punnettův čtverec",
        "tagy": ["biologie", "genetika", "2. stupeň", "sš", "křížení", "dědičnost", "alely"]
      },
      {
        "soubor": "obsah/physics_ref.html",
        "nazev": "⚛️ Fyzikální vzorce",
        "tagy": ["fyzika", "2. stupeň", "sš"]
      },
      {
        "soubor": "obsah/solar_system.html",
        "nazev": "🪐 Sluneční soustava",
        "tagy": ["planety", "vesmír", "astronomie"]
      },
      {
        "soubor": "obsah/planet_globe.html",
        "nazev": "🌐 Glóbusy planet",
        "tagy": ["planety", "vesmír", "astronomie", "mars", "měsíc", "3d", "glóbus"]
      },
      {
        "soubor": "obsah/pohyb_vesmirem.html",
        "nazev": "🌌 Pohyb vesmírem",
        "tagy": ["vesmír", "galaxie", "měsíc", "slunce", "oběh", "astronomie", "mléčná dráha"]
      },
      {
        "soubor": "obsah/gravitacni_hriste.html",
        "nazev": "🎯 Gravitační hřiště",
        "tagy": ["gravitace", "fyzika", "kepler", "oběžná dráha", "vesmír", "simulace", "kosmická rychlost"]
      },
      {
        "soubor": "obsah/gravitacni_hriste2.html",
        "nazev": "🌀 Gravitační hřiště: Vzájemná přitažlivost",
        "tagy": ["gravitace", "fyzika", "n-těles", "hmotnost", "vesmír", "simulace", "srážky planet"]
      },
      {
        "soubor": "obsah/physics_playground.html",
        "nazev": "🔬 Fyzikální hřiště pro děti",
        "tagy": ["fyzika", "kyvadlo", "nakloněná rovina", "srážky", "simulace"]
      },
      {
        "soubor": "obsah/iss.html",
        "nazev": "🛰️ ISS živě",
        "tagy": ["vesmír", "stanice", "družice", "oběžná dráha", "astronomie", "živě"]
      },
      {
        "soubor": "obsah/star_map.html",
        "nazev": "🌌 Hvězdná obloha",
        "tagy": ["hvězdy", "souhvězdí", "astronomie", "obloha", "roční období", "zimní obloha", "letní obloha"]
      },
      {
        "soubor": "obsah/sky_events.html",
        "nazev": "🌠 Astronomický kalendář úkazů",
        "tagy": ["meteorický roj", "zatmění", "úplněk", "slunovrat", "rovnodennost", "astronomie"]
      },
      {
        "soubor": "obsah/anatomie.html",
        "nazev": "🫀 Biologie člověka",
        "tagy": ["biologie", "anatomie", "orgány", "soustavy", "2. stupeň"]
      },
      {
        "soubor": "obsah/bunka.html",
        "nazev": "🔬 Stavba buňky",
        "tagy": ["biologie", "buňka", "organely", "jádro", "mitochondrie", "2. stupeň"]
      },
      {
        "soubor": "obsah/potravni_retezec.html",
        "nazev": "🌾 Potravní řetězce",
        "tagy": ["biologie", "ekosystém", "producent", "konzument", "1. stupeň", "2. stupeň"]
      }
    ]
  },
  {
    "nazev": "🌍 Zeměpis & dějepis",
    "skupina": "vzdelavani",
    "polozky": [
      {
        "soubor": "obsah/slepa_mapa.html",
        "nazev": "🗺️ Slepá mapa ČR",
        "tagy": ["kraje", "krajská města", "zeměpis", "česko", "2. stupeň"]
      },
      {
        "soubor": "obsah/slepa_mapa_evropa.html",
        "nazev": "🗺️ Slepá mapa Evropy",
        "tagy": ["státy", "evropa", "zeměpis", "2. stupeň", "sš"]
      },
      {
        "soubor": "obsah/flags_quiz.html",
        "nazev": "🏳️ Kvíz vlajky a města",
        "tagy": ["vlajky", "státy", "hlavní města", "zeměpis"]
      },
      {
        "soubor": "obsah/eduMaps.html",
        "nazev": "🗺️ Mapy",
        "tagy": ["zeměpis", "mapy", "výuka"]
      },
      {
        "soubor": "obsah/casova_osa.html",
        "nazev": "📜 Časová osa českých dějin",
        "tagy": ["dějepis", "historie", "letopočty", "2. stupeň", "sš"]
      },
      {
        "soubor": "obsah/historicke_mapy_odkazy.html",
        "nazev": "📜 Kde najít historické mapy",
        "tagy": ["dějepis", "mapy", "archiv"]
      },
      {
        "soubor": "obsah/svetova_hlavni_mesta.html",
        "nazev": "🌍 Kvíz světových hlavních měst",
        "tagy": ["zeměpis", "hlavní města", "svět", "státy"]
      },
      {
        "soubor": "obsah/reky_pohori.html",
        "nazev": "🏔️ Řeky a pohoří ČR",
        "tagy": ["zeměpis", "česko", "řeky", "pohoří", "2. stupeň"]
      },
      {
        "soubor": "obsah/svetove_dejiny.html",
        "nazev": "📜 Časová osa světových dějin",
        "tagy": ["dějepis", "historie", "svět", "letopočty", "2. stupeň", "sš"]
      },
      {
        "soubor": "obsah/eu_instituce.html",
        "nazev": "🇪🇺 Instituce Evropské unie",
        "tagy": ["eu", "evropská unie", "instituce", "politika", "sš"]
      }
    ]
  },
  {
    "nazev": "🇬🇧🇩🇪🇫🇷 Cizí jazyky",
    "skupina": "vzdelavani",
    "polozky": [
      {
        "soubor": "obsah/aj_slovicka.html",
        "nazev": "🇬🇧 Angličtina – první slovíčka",
        "tagy": ["angličtina", "english", "1. stupeň", "slovíčka", "obrázky", "začátečník"]
      },
      {
        "soubor": "obsah/aj_slovesa.html",
        "nazev": "🇬🇧 Anglická nepravidelná slovesa",
        "tagy": ["angličtina", "english", "2. stupeň", "sš", "irregular verbs", "slovesa"]
      },
      {
        "soubor": "obsah/de_slovicka.html",
        "nazev": "🇩🇪 Němčina – slovíčka",
        "tagy": ["němčina", "deutsch", "slovíčka", "členy", "der die das"]
      },
      {
        "soubor": "obsah/fr_slovicka.html",
        "nazev": "🇫🇷 Francouzština – slovíčka",
        "tagy": ["francouzština", "français", "slovíčka", "členy", "le la les"]
      },
      {
        "soubor": "obsah/casovani_sloves.html",
        "nazev": "🔤 Trenažér časování sloves",
        "tagy": ["gramatika", "slovesa", "časování", "angličtina", "němčina", "francouzština"]
      },
      {
        "soubor": "obsah/vyslovnost.html",
        "nazev": "🔊 Výslovnost a poslech",
        "tagy": ["poslech", "výslovnost", "angličtina", "němčina", "francouzština"]
      }
    ]
  },
  {
    "nazev": "🎓 Kartičky & další výuka",
    "skupina": "vzdelavani",
    "polozky": [
      {
        "soubor": "obsah/flashcards.html",
        "nazev": "🎴 Kartičky (flashcards)",
        "tagy": ["učení", "opakování", "sady"]
      },
      {
        "soubor": "obsah/knihovna_sad.html",
        "nazev": "🗂️ Knihovna sad kartiček",
        "tagy": ["kartičky", "flashcards", "sady", "vyjmenovaná slova", "slovíčka", "letopočty", "ke stažení"]
      },
      {
        "soubor": "obsah/typing_trainer.html",
        "nazev": "⌨️ Trenažér psaní",
        "tagy": ["psaní všemi deseti", "klávesnice"]
      },
      {
        "soubor": "obsah/music_theory.html",
        "nazev": "🎼 Hudební nauka",
        "tagy": ["hudba", "noty"]
      },
      {
        "soubor": "obsah/notes_reading.html",
        "nazev": "🎼 Notová osnova – čtení not",
        "tagy": ["hudba", "noty", "houslový klíč", "solfeggio"]
      },
      {
        "soubor": "obsah/morse_code.html",
        "nazev": "📡 Morseova abeceda",
        "tagy": ["morseovka", "kód", "vysílání"]
      },
      {
        "soubor": "obsah/eduSort.html",
        "nazev": "🔢 Algoritmy řazení",
        "tagy": ["informatika", "programování", "sorting"]
      },
      {
        "soubor": "obsah/AI_prednaska.html",
        "nazev": "🤖 AI přednáška",
        "tagy": ["umělá inteligence", "informatika", "prezentace", "chatgpt", "prompt"]
      },
      {
        "soubor": "obsah/pracovni_listy.html",
        "nazev": "🖨️ Generátor pracovních listů",
        "tagy": ["tisk", "pdf", "pracovní list", "násobilka", "sčítání", "vyjmenovaná slova", "učitel"]
      },
      {
        "soubor": "obsah/edu_progress.html",
        "nazev": "🏅 Studijní deník a odznaky",
        "tagy": ["pokrok", "gamifikace", "streak", "odznaky", "návyk"]
      },
      {
        "soubor": "obsah/citation_generator.html",
        "nazev": "📚 Generátor citací",
        "tagy": ["citace", "bibliografie", "iso 690", "apa", "seminární práce", "zdroje"]
      }
    ]
  },
  {
    "nazev": "🕹️ Akční & arkády",
    "skupina": "hry",
    "polozky": [
      {
        "soubor": "obsah/had.html",
        "nazev": "🐍 Had",
        "tagy": [
          "snake",
          "hra"
        ]
      },
      {
        "soubor": "obsah/stack-attack.html",
        "nazev": "📦 Stack Attack"
      },
      {
        "soubor": "obsah/jump_game.html",
        "nazev": "🏃 Skákačka"
      },
      {
        "soubor": "obsah/backwardRide.html",
        "nazev": "🚗 Couvání"
      },
      {
        "soubor": "obsah/retro_invaders.html",
        "nazev": "👾 Retro Invaders"
      },
      {
        "soubor": "obsah/retro_tetris.html",
        "nazev": "🟦 Retro Tetris"
      },
      {
        "soubor": "obsah/retro_pacman.html",
        "nazev": "🟡 Retro Pac-Man"
      },
      {
        "soubor": "obsah/breakout.html",
        "nazev": "🧱 Breakout"
      },
      {
        "soubor": "obsah/tower_defense.html",
        "nazev": "🏰 Tower Defense"
      },
      {
        "soubor": "obsah/tower_defense_sc.html",
        "nazev": "🛰️ Sector Defense"
      },
      {
        "soubor": "obsah/pong.html",
        "nazev": "🏓 Pong"
      },
      {
        "soubor": "obsah/asteroids.html",
        "nazev": "🚀 Asteroids"
      }
    ]
  },
  {
    "nazev": "🧩 Hlavolamy & logické",
    "skupina": "hry",
    "polozky": [
      {
        "soubor": "obsah/piskvorky.html",
        "nazev": "⭕ Piškvorky",
        "tagy": [
          "tic tac toe",
          "hra"
        ]
      },
      {
        "soubor": "obsah/game_2048.html",
        "nazev": "🔢 2048",
        "tagy": [
          "čísla",
          "posouvání",
          "hra"
        ]
      },
      {
        "soubor": "obsah/minesweeper.html",
        "nazev": "💣 Hledání min",
        "tagy": [
          "miny",
          "sapér",
          "hra"
        ]
      },
      {
        "soubor": "obsah/memory_game.html",
        "nazev": "🃏 Pexeso",
        "tagy": [
          "pexeso",
          "paměť",
          "karty"
        ]
      },
      {
        "soubor": "obsah/sudoku.html",
        "nazev": "🔢 Sudoku"
      },
      {
        "soubor": "obsah/wordle.html",
        "nazev": "🟩 Slovo (Wordle)",
        "tagy": [
          "slova",
          "hádání",
          "hra"
        ]
      },
      {
        "soubor": "obsah/sokoban.html",
        "nazev": "📦 Sokoban"
      },
      {
        "soubor": "obsah/osmismerka.html",
        "nazev": "🔡 Osmisměrka"
      },
      {
        "soubor": "obsah/crossword_gen.html",
        "nazev": "🧩 Generátor křížovek",
        "tagy": [
          "křížovka",
          "hádanka",
          "slova"
        ]
      },
      {
        "soubor": "obsah/bingo_gen.html",
        "nazev": "🎱 Generátor bingo kartiček",
        "tagy": [
          "bingo",
          "oslava",
          "tisk",
          "party"
        ]
      },
      {
        "soubor": "obsah/tabooGame.html",
        "nazev": "🚫 Tabu (slovní popis)"
      },
      {
        "soubor": "obsah/pantomima.html",
        "nazev": "🎭 Pantomima (databanka)",
        "tagy": [
          "šarády",
          "charades",
          "předvádění",
          "zvířata",
          "povolání"
        ]
      },
      {
        "soubor": "obsah/lights_out.html",
        "nazev": "💡 Lights Out"
      },
      {
        "soubor": "obsah/hanoi.html",
        "nazev": "🗼 Hanojské věže"
      },
      {
        "soubor": "obsah/simon.html",
        "nazev": "🎵 Simon"
      },
      {
        "soubor": "obsah/connect4.html",
        "nazev": "🔴 Čtyři v řadě"
      },
      {
        "soubor": "obsah/battleship.html",
        "nazev": "🚢 Lodě"
      },
      {
        "soubor": "obsah/rock_paper_scissors.html",
        "nazev": "✊ Kámen nůžky papír"
      },
      {
        "soubor": "obsah/hangman.html",
        "nazev": "🪢 Šibenice"
      },
      {
        "soubor": "obsah/nonogram.html",
        "nazev": "🎨 Nonogramy"
      },
      {
        "soubor": "obsah/checkers.html",
        "nazev": "♟️ Dáma",
        "tagy": [
          "dáma",
          "hra"
        ]
      },
      {
        "soubor": "obsah/chess.html",
        "nazev": "♟️ Šachy",
        "tagy": [
          "šachy",
          "hra",
          "figurky"
        ]
      },
      {
        "soubor": "obsah/solitaire.html",
        "nazev": "🃏 Solitaire",
        "tagy": [
          "karty",
          "klondike",
          "pasiáns"
        ]
      },
      {
        "soubor": "obsah/yahtzee.html",
        "nazev": "🎲 Kostky (Yahtzee)"
      },
      {
        "soubor": "obsah/reversi.html",
        "nazev": "⚫ Reversi"
      },
      {
        "soubor": "obsah/trivia.html",
        "nazev": "❓ Vědomostní kvíz"
      }
    ]
  },
  {
    "nazev": "🕵️ Organizace případu",
    "skupina": "vysetrovani",
    "polozky": [
      {
        "soubor": "obsah/case_timeline.html",
        "nazev": "🕵️ Časová osa případu",
        "tagy": ["vyšetřování", "timeline", "případ", "chronologie"]
      },
      {
        "soubor": "obsah/evidence_log.html",
        "nazev": "📦 Evidenční deník důkazů",
        "tagy": ["vyšetřování", "chain of custody", "důkazy", "evidence"]
      },
      {
        "soubor": "obsah/investigation_checklist.html",
        "nazev": "✅ Kontrolní seznamy vyšetřování",
        "tagy": ["vyšetřování", "checklist", "ohledání", "výslech", "nehoda"]
      },
      {
        "soubor": "obsah/protocol_gen.html",
        "nazev": "📝 Generátor protokolů",
        "tagy": ["vyšetřování", "protokol", "ohledání", "výslech", "zajištění věci"]
      },
      {
        "soubor": "obsah/interview_questions.html",
        "nazev": "🎙️ Generátor otázek k výslechu",
        "tagy": ["vyšetřování", "výslech", "svědek", "poškozený", "podezřelý", "pohovor"]
      }
    ]
  },
  {
    "nazev": "🔍 Digitální forenzní pomůcky",
    "skupina": "vysetrovani",
    "polozky": [
      {
        "soubor": "obsah/hash_compare.html",
        "nazev": "🔐 Porovnání otisků souborů",
        "tagy": ["forenzní", "hash", "sha256", "otisk", "integrita"]
      },
      {
        "soubor": "obsah/file_signature.html",
        "nazev": "🔎 Identifikace typu souboru",
        "tagy": ["forenzní", "magic bytes", "hlavička souboru", "falešná přípona"]
      },
      {
        "soubor": "obsah/vin_decoder.html",
        "nazev": "🚗 Dekodér VIN",
        "tagy": ["vozidlo", "vin", "identifikační číslo", "wmi"]
      }
    ]
  },
  {
    "nazev": "⚖️ Právní a mapové pomůcky",
    "skupina": "vysetrovani",
    "polozky": [
      {
        "soubor": "obsah/trestni_zakonik_ref.html",
        "nazev": "⚖️ Rychlá reference trestního zákoníku",
        "tagy": ["zákon", "paragraf", "trestní zákoník", "skutková podstata"]
      },
      {
        "soubor": "obsah/scene_sketch.html",
        "nazev": "📐 Náčrt místa činu",
        "tagy": ["místo činu", "plánek", "skica", "měřítko", "značky důkazů"]
      }
    ]
  },
  {
    "nazev": "🍳 Recepty",
    "skupina": "vareni",
    "polozky": [
      {
        "soubor": "obsah/recipes.html",
        "nazev": "🍳 Kniha receptů",
        "tagy": ["vaření", "recept", "porce", "přepočet množství", "ingredience"]
      }
    ]
  },
  {
    "nazev": "📜 Vzory dokumentů",
    "skupina": "dokumenty",
    "polozky": [
      {
        "soubor": "obsah/household_docs.html",
        "nazev": "📜 Vzory dokumentů pro domácnost",
        "tagy": ["plná moc", "výpověď z nájmu", "půjčka", "reklamace", "smlouva"]
      }
    ]
  },
  {
    "nazev": "📖 Studium Bible",
    "skupina": "duchovno",
    "polozky": [
      {
        "soubor": "obsah/bible_study.html",
        "nazev": "📖 Studium Bible",
        "tagy": ["bible", "plán čtení", "verše", "zapamatování", "studijní deník", "víra"]
      }
    ]
  },
  {
    "nazev": "🔮 Výklad karet",
    "skupina": "duchovno",
    "polozky": [
      {
        "soubor": "obsah/tarot_reading.html",
        "nazev": "🔮 Výklad karet",
        "tagy": ["tarot", "karty", "výklad", "arkána", "věštění", "deník výkladů"]
      }
    ]
  },
  {
    "nazev": "🌿 Pohanské svátky",
    "skupina": "duchovno",
    "polozky": [
      {
        "soubor": "obsah/pagan_rituals.html",
        "nazev": "🌿 Pohanské svátky a rituály",
        "tagy": ["keltové", "vikingové", "slované", "baltové", "řekové", "římané", "egypťané", "šintoismus", "jorubové", "aztékové", "kolo roku", "samhain", "yule", "blót", "svátky", "rituály"]
      }
    ]
  },
  {
    "nazev": "✉️ Ostatní",
    "skupina": "ostatni",
    "polozky": [
      {
        "soubor": "obsah/contact_page.html",
        "nazev": "Kontakt"
      },
      {
        "soubor": "obsah/about.html",
        "nazev": "ℹ️ O projektu",
        "tagy": [
          "changelog",
          "statistiky",
          "github"
        ]
      }
    ]
  }
];

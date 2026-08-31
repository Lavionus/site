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
        "nazev": "📝 Markdown ↔ HTML",
        "tagy": ["markdown", "html", "převod", "konverze", "readme"]
      },
      {
        "soubor": "obsah/word_counter.html",
        "nazev": "🔡 Počítadlo slov",
        "tagy": ["počet slov", "znaky", "délka textu", "statistika textu"]
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
        "nazev": "🎲 Generátor jmen",
        "tagy": ["jména", "přezdívka", "postava", "náhodné jméno", "fantasy"]
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
        "nazev": "🎯 Sledování návyků",
        "tagy": ["návyky", "denní rutina", "série", "streak", "sebekázeň"]
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
        "nazev": "⏳ Odpočet do události",
        "tagy": ["odpočet", "kolik zbývá", "termín", "událost", "svatba", "dovolená"]
      },
      {
        "soubor": "obsah/time_calc.html",
        "nazev": "⏱️ Kalkulačka času",
        "tagy": ["sčítání času", "rozdíl časů", "hodiny", "minuty", "výpočet času"]
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
        "nazev": "🗓️ Tisknutelný kalendář",
        "tagy": ["kalendář", "tisk", "měsíční plánovač", "rok"]
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
        "nazev": "⚖️ Rozhodovací matice",
        "tagy": ["rozhodování", "kritéria", "váhy", "výběr", "porovnání variant"]
      },
      {
        "soubor": "obsah/timers.html",
        "nazev": "⏲️ Stopky & časovače",
        "tagy": ["stopky", "časovač", "minutka", "pomodoro", "intervaly"]
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
        "soubor": "obsah/ceny_trhy.html",
        "nazev": "⛽ Ceny paliv a bitcoinu",
        "tagy": [
          "benzín",
          "natural 95",
          "nafta",
          "lpg",
          "pohonné hmoty",
          "bitcoin",
          "btc",
          "kryptoměny",
          "kurz"
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
        "nazev": "✉️ E-mailový podpis",
        "tagy": ["podpis", "e-mail", "signature", "kontaktní údaje", "html podpis"]
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
        "nazev": "🖨️ Kondiciogram retro",
        "tagy": ["biorytmus", "kondice", "cykly", "retro", "tisk"]
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
        "soubor": "obsah/menstrual_calendar.html",
        "nazev": "🌸 Menstruační kalendář",
        "tagy": [
          "cyklus",
          "menstruace",
          "ovulace",
          "plodné dny",
          "perioda",
          "PMS"
        ]
      },
      {
        "soubor": "obsah/mood_tracker.html",
        "nazev": "😊 Tracker nálady",
        "tagy": ["nálada", "deník", "emoce", "psychika", "sledování"]
      },
      {
        "soubor": "obsah/ideal_weight.html",
        "nazev": "⚖️ Ideální hmotnost",
        "tagy": ["hmotnost", "váha", "postava", "zdravá váha", "kalkulačka"]
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
        "nazev": "⚡ Reakční test",
        "tagy": ["reakce", "rychlost", "postřeh", "ms", "test"]
      },
      {
        "soubor": "obsah/color_vision.html",
        "nazev": "👁️ Test barvocitu",
        "tagy": ["barvocit", "ishihara", "barvoslepost", "zrak", "test"]
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
        "nazev": "🌍 Glóbus počasí",
        "tagy": ["počasí", "glóbus", "3d", "mapa", "teplota", "svět"]
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
        "nazev": "💧 Rosný bod & vlhkost",
        "tagy": ["rosný bod", "vlhkost", "kondenzace", "plíseň", "psychrometrie"]
      },
      {
        "soubor": "obsah/meteo_units.html",
        "nazev": "🌡️ Převodník meteo jednotek",
        "tagy": ["převod jednotek", "teplota", "tlak", "rychlost větru", "srážky"]
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
      },
      {
        "soubor": "obsah/agri_calendar.html",
        "nazev": "🌱 Zemědělský kalendář",
        "tagy": [
          "polní práce",
          "setí",
          "sklizeň",
          "agro"
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
        "nazev": "✈️ Cestovní deník",
        "tagy": ["cestování", "deník", "zápisky", "výlety", "fotky"]
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
        "nazev": "💶 Cestovní rozpočet",
        "tagy": ["rozpočet", "cestování", "útrata", "rozdělení nákladů", "měna"]
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
        "nazev": "🧭 Kompas & azimut",
        "tagy": ["kompas", "azimut", "orientace", "buzola", "sever"]
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
        "nazev": "🌈 CSS gradienty",
        "tagy": ["css", "gradient", "přechod barev", "web design"]
      },
      {
        "soubor": "obsah/shadow_gen.html",
        "nazev": "🌑 Generátor stínů",
        "tagy": ["css", "box-shadow", "stín", "web design"]
      },
      {
        "soubor": "obsah/pattern_gen.html",
        "nazev": "🔳 Generátor vzorů",
        "tagy": ["css", "vzor", "tapeta", "pozadí", "textura"]
      },
      {
        "soubor": "obsah/blob_gen.html",
        "nazev": "🫧 SVG bloby",
        "tagy": ["svg", "blob", "tvar", "web design", "organický tvar"]
      },
      {
        "soubor": "obsah/favicon_gen.html",
        "nazev": "⭐ Favicon generátor",
        "tagy": ["favicon", "ikona", "web", "png", "záložka"]
      },
      {
        "soubor": "obsah/Circle_generator.html",
        "nazev": "⭕ Kružnice",
        "tagy": ["kružnice", "obrazce", "geometrie", "generátor", "tisk"]
      },
      {
        "soubor": "obsah/stained_glass.html",
        "nazev": "🔷 Vitráž",
        "tagy": ["vitráž", "sklo", "mozaika", "generátor", "výtvarka"]
      },
      {
        "soubor": "obsah/comic3d.html",
        "nazev": "💥 Komiksový 3D prostor",
        "tagy": ["komiks", "3d", "scéna", "bubliny", "kreslení"]
      },
      {
        "soubor": "obsah/comic3d_walk.html",
        "nazev": "🚶 Komiksový 3D svět (procházka)",
        "tagy": ["komiks", "3d", "procházka", "prostor", "walk"]
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
        "nazev": "🔤 ASCII art",
        "tagy": ["ascii", "art", "obrázek na text", "terminál"]
      },
      {
        "soubor": "obsah/pixel_art.html",
        "nazev": "🎨 Pixel art editor",
        "tagy": ["pixel", "kreslení", "editor", "sprite", "8bit"]
      },
      {
        "soubor": "obsah/pixel_studio.html",
        "nazev": "🧩 Pixel studio (PNG assety)",
        "tagy": [
          "pixel art",
          "sprite",
          "herní asset",
          "tileset",
          "dlaždice",
          "průhlednost",
          "vyklíčovat",
          "přeškálovat",
          "paleta",
          "png"
        ]
      },
      {
        "soubor": "obsah/map_maker.html",
        "nazev": "🗺️ Kreslení map",
        "tagy": [
          "mapa",
          "hexy",
          "šestiúhelníky",
          "čtvercová mřížka",
          "dračí doupě",
          "d&d",
          "rpg",
          "dungeon",
          "kobka",
          "battlemap",
          "herní mapa",
          "kartograf",
          "kartografie",
          "hexová mapa",
          "pergamen",
          "fantasy"
        ]
      },
      {
        "soubor": "obsah/meme_gen.html",
        "nazev": "🖼️ Generátor meme",
        "tagy": ["meme", "vtip", "obrázek s textem", "popisek"]
      },
      {
        "soubor": "obsah/emoji_picker.html",
        "nazev": "😀 Picker emoji",
        "tagy": ["emoji", "symboly", "znaky", "kopírovat", "unicode"]
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
        "nazev": "💍 Svatební oznámení",
        "tagy": ["svatba", "oznámení", "pozvánka", "tisk", "šablona"]
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
        "nazev": "🏆 Generátor diplomů",
        "tagy": ["diplom", "certifikát", "ocenění", "tisk", "soutěž"]
      },
      {
        "soubor": "obsah/font_preview.html",
        "nazev": "🔤 Náhled fontů",
        "tagy": ["fonty", "písmo", "typografie", "náhled", "párování"]
      },
      {
        "soubor": "obsah/colorblind_sim.html",
        "nazev": "🌈 Simulace barvosleposti",
        "tagy": ["barvoslepost", "přístupnost", "simulace", "daltonismus", "kontrast"]
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
        "nazev": "🌫️ Dithering obrázku",
        "tagy": ["dithering", "pixelizace", "rastr", "retro", "obrázek"]
      },
      {
        "soubor": "obsah/Heritage.html",
        "nazev": "🌳 Heritage tree",
        "tagy": ["rodokmen", "genealogie", "předkové", "rodina", "strom"]
      },
      {
        "soubor": "obsah/gene_map.html",
        "nazev": "🧬 Mapa dědičnosti",
        "tagy": ["dědičnost", "genetika", "geny", "rodokmen", "znaky"]
      },
      {
        "soubor": "obsah/exif_viewer.html",
        "nazev": "📷 EXIF prohlížeč",
        "tagy": ["exif", "metadata", "foto", "gps", "expozice"]
      },
      {
        "soubor": "obsah/watermark.html",
        "nazev": "💧 Vodoznak",
        "tagy": ["vodoznak", "logo", "ochrana fotky", "copyright"]
      },
      {
        "soubor": "obsah/image_crop.html",
        "nazev": "✂️ Ořez obrázku",
        "tagy": ["ořez", "crop", "obrázek", "poměr stran", "úprava fotky"]
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
        "nazev": "🎵 Generátor zvuku",
        "tagy": ["zvuk", "tón", "frekvence", "generátor", "sinus"]
      },
      {
        "soubor": "obsah/spectrum_visualizer.html",
        "nazev": "🎵 Zvukový vizualizér",
        "tagy": ["spektrum", "vizualizace", "hudba", "fft", "analyzér"]
      },
      {
        "soubor": "obsah/voice_recorder.html",
        "nazev": "🎙️ Hlasový záznamník",
        "tagy": ["nahrávání", "diktafon", "mikrofon", "audio", "záznam"]
      },
      {
        "soubor": "obsah/tuner.html",
        "nazev": "🎸 Ladička",
        "tagy": ["ladička", "kytara", "ladění", "tón", "frekvence"]
      },
      {
        "soubor": "obsah/metronome.html",
        "nazev": "🥁 Metronom",
        "tagy": ["metronom", "tempo", "bpm", "rytmus", "cvičení"]
      },
      {
        "soubor": "obsah/piano.html",
        "nazev": "🎹 Piano",
        "tagy": ["klavír", "klávesy", "hudba", "tóny", "nástroj"]
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
        "nazev": "🔧 Redukce trubek",
        "tagy": ["trubky", "redukce", "rozvin", "plech", "svařování"]
      },
      {
        "soubor": "obsah/cookieCutter.html",
        "nazev": "🍪 Vykrajovátka",
        "tagy": ["vykrajovátka", "cukroví", "3d tisk", "pečení", "stl"]
      },
      {
        "soubor": "obsah/voronoi_stl.html",
        "nazev": "🕸 Voronoi z STL",
        "tagy": ["voronoi", "stl", "3d model", "síť", "odlehčení"]
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
        "nazev": "📏 Mřížka A4",
        "tagy": ["mřížka", "a4", "tisk", "papír", "čtverečky"]
      },
      {
        "soubor": "obsah/splitGen.html",
        "nazev": "🍕 Dělič kruhu",
        "tagy": ["kruh", "dělení", "paprsky", "úhly", "šablona"]
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
        "nazev": "⚙️ Ozubená kola",
        "tagy": ["ozubené kolo", "svg", "modul", "zuby", "převod"]
      },
      {
        "soubor": "obsah/sheet_bend.html",
        "nazev": "📐 Rozvin plechu",
        "tagy": ["plech", "ohyb", "rozvin", "ohraňování", "k-faktor"]
      },
      {
        "soubor": "obsah/cutting_speed.html",
        "nazev": "⚙️ Řezné podmínky",
        "tagy": ["obrábění", "otáčky", "posuv", "fréza", "soustružení"]
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
        "nazev": "🔨 Převodník tvrdosti",
        "tagy": ["tvrdost", "hrc", "hb", "vickers", "rockwell"]
      },
      {
        "soubor": "obsah/gear_ratio.html",
        "nazev": "⚙️ Převodové poměry",
        "tagy": ["převod", "poměr", "kola", "otáčky", "řemenice"]
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
        "soubor": "obsah/tinkercad.html",
        "nazev": "🧊 3D Návrhář",
        "tagy": [
          "3d",
          "modelování",
          "tinkercad",
          "tvary"
        ]
      },
      {
        "soubor": "obsah/quake_lab.html",
        "nazev": "🏚️ Zemětřesná laboratoř",
        "tagy": [
          "zemětřesení",
          "simulátor",
          "konstrukce",
          "statika",
          "seizmicita",
          "pevnost",
          "nosník",
          "vzpěra",
          "spoje",
          "materiály"
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
        "nazev": "📐 Úhly & měřítka",
        "tagy": ["úhly", "stupně", "radiány", "měřítko", "sklon"]
      },
      {
        "soubor": "obsah/ohm_calc.html",
        "nazev": "⚡ Ohmův zákon",
        "tagy": ["ohmův zákon", "proud", "napětí", "odpor", "výkon", "elektro"]
      },
      {
        "soubor": "obsah/number_base.html",
        "nazev": "🔢 Číselné soustavy",
        "tagy": ["binární", "hexadecimální", "osmičková", "soustava", "převod"]
      },
      {
        "soubor": "obsah/pressure_force.html",
        "nazev": "🔧 Tlak / síla / moment",
        "tagy": ["tlak", "síla", "moment", "bar", "newton", "převod"]
      },
      {
        "soubor": "obsah/triangle_calc.html",
        "nazev": "📐 Trojúhelník",
        "tagy": ["trojúhelník", "sinus", "kosinus", "strany", "úhly"]
      },
      {
        "soubor": "obsah/right_triangle.html",
        "nazev": "📐 Pravoúhlý trojúhelník",
        "tagy": ["pravoúhlý", "pythagoras", "odvěsna", "přepona", "trojúhelník"]
      },
      {
        "soubor": "obsah/beam_deflection.html",
        "nazev": "🏗️ Průhyb nosníku",
        "tagy": ["nosník", "průhyb", "zatížení", "statika", "ohyb"]
      },
      {
        "soubor": "obsah/statistics.html",
        "nazev": "📊 Statistika dat",
        "tagy": ["průměr", "medián", "směrodatná odchylka", "data", "statistika"]
      },
      {
        "soubor": "obsah/function_plot.html",
        "nazev": "📈 Kreslič grafů funkcí",
        "tagy": ["graf funkce", "kreslení", "matematika", "parabola", "průběh"]
      },
      {
        "soubor": "obsah/equation_solver.html",
        "nazev": "🧮 Řešič rovnic",
        "tagy": ["rovnice", "kvadratická", "soustava", "řešení", "kořeny"]
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
        "nazev": "🗄️ SQL formatter",
        "tagy": ["sql", "formátování", "dotaz", "databáze", "select"]
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
        "nazev": "🌐 HTTP stavové kódy",
        "tagy": ["http", "kódy", "404", "500", "api", "reference"]
      },
      {
        "soubor": "obsah/gitignore_gen.html",
        "nazev": "🚫 .gitignore generátor",
        "tagy": ["git", "gitignore", "šablona", "repozitář"]
      },
      {
        "soubor": "obsah/cron_builder.html",
        "nazev": "⏰ Cron builder",
        "tagy": ["cron", "plánovač", "crontab", "výraz", "linux"]
      },
      {
        "soubor": "obsah/md_table.html",
        "nazev": "📋 Markdown tabulky",
        "tagy": ["markdown", "tabulka", "generátor", "readme"]
      },
      {
        "soubor": "obsah/keycode.html",
        "nazev": "⌨️ Keycode tester",
        "tagy": ["klávesy", "keycode", "javascript", "event", "test"]
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
        "nazev": "🆔 UUID generátor",
        "tagy": ["uuid", "guid", "identifikátor", "náhodné id"]
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
        "nazev": "📝 Lorem ipsum",
        "tagy": ["lorem ipsum", "výplňový text", "testovací data", "placeholder"]
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
        "nazev": "🔑 JWT decoder",
        "tagy": ["jwt", "token", "dekodér", "payload", "autentizace"]
      },
      {
        "soubor": "obsah/case_converter.html",
        "nazev": "🔠 Převodník case",
        "tagy": ["velikost písmen", "camelcase", "snake_case", "verzálky", "text"]
      },
      {
        "soubor": "obsah/slug_gen.html",
        "nazev": "🔗 Slug generátor",
        "tagy": ["slug", "url", "diakritika", "seo", "adresa"]
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
        "nazev": "📦 Stack Attack",
        "tagy": ["arkáda", "bedny", "retro", "hra"]
      },
      {
        "soubor": "obsah/jump_game.html",
        "nazev": "🏃 Skákačka",
        "tagy": ["skákačka", "plošinovka", "platformer", "hra"]
      },
      {
        "soubor": "obsah/backwardRide.html",
        "nazev": "🚗 Couvání",
        "tagy": ["couvání", "vozík", "přívěs", "simulátor", "řidič"]
      },
      {
        "soubor": "obsah/retro_invaders.html",
        "nazev": "👾 Retro Invaders",
        "tagy": ["space invaders", "střílečka", "retro", "arkáda"]
      },
      {
        "soubor": "obsah/retro_tetris.html",
        "nazev": "🟦 Retro Tetris",
        "tagy": ["tetris", "kostky", "retro", "skládání"]
      },
      {
        "soubor": "obsah/retro_pacman.html",
        "nazev": "🟡 Retro Pac-Man",
        "tagy": ["pacman", "bludiště", "retro", "arkáda"]
      },
      {
        "soubor": "obsah/breakout.html",
        "nazev": "🧱 Breakout",
        "tagy": ["arkanoid", "cihly", "pálka", "míček", "arkáda"]
      },
      {
        "soubor": "obsah/pozirani_bunek.html",
        "nazev": "🦠 Požírání buněk",
        "tagy": ["buňky", "agar", "mikrosvět", "plankton", "přežití", "arkáda", "hra"]
      },
      {
        "soubor": "obsah/pirateers/index.html",
        "nazev": "🏴‍☠️ Pirateers",
        "tagy": [
          "piráti",
          "lodě",
          "plachetnice",
          "námořní bitva",
          "ostrovy",
          "hra"
        ]
      },
      {
        "soubor": "obsah/tower_defense.html",
        "nazev": "🏰 Tower Defense",
        "tagy": ["obrana věží", "strategie", "vlny", "věže"]
      },
      {
        "soubor": "obsah/tower_defense_sc.html",
        "nazev": "🛰️ Sector Defense",
        "tagy": ["obrana věží", "vesmír", "strategie", "sci-fi"]
      },
      {
        "soubor": "obsah/pong.html",
        "nazev": "🏓 Pong",
        "tagy": ["pong", "pálky", "retro", "arkáda"]
      },
      {
        "soubor": "obsah/asteroids.html",
        "nazev": "🚀 Asteroids",
        "tagy": ["asteroidy", "vesmír", "loď", "retro", "arkáda"]
      },
      {
        "soubor": "obsah/fps_arena.html",
        "nazev": "🔫 FPS Aréna (3D)",
        "tagy": [
          "fps",
          "střílečka",
          "shooter",
          "3d",
          "webgl",
          "three.js",
          "first person",
          "krunker",
          "venge",
          "aréna"
        ]
      },
      {
        "soubor": "obsah/dwarf_colony.html",
        "nazev": "⛏️ Trpasličí kolonie",
        "tagy": [
          "kolonie",
          "simulace",
          "těžba",
          "voxel",
          "3d",
          "strategie",
          "rimworld",
          "dwarf fortress"
        ]
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
        "nazev": "🔢 Sudoku",
        "tagy": ["sudoku", "čísla", "hlavolam", "logika"]
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
        "nazev": "📦 Sokoban",
        "tagy": ["bedny", "hlavolam", "logika", "skladiště"]
      },
      {
        "soubor": "obsah/osmismerka.html",
        "nazev": "🔡 Osmisměrka",
        "tagy": ["osmisměrka", "hledání slov", "mřížka", "slovní hra"]
      },
      {
        "soubor": "obsah/scrabble.html",
        "nazev": "🔤 Scrabble",
        "tagy": ["scrabble", "slovní hra", "desková hra", "písmena", "kameny", "skládání slov"]
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
        "nazev": "🚫 Tabu (slovní popis)",
        "tagy": ["tabu", "slovní hra", "popis", "párty", "zakázaná slova"]
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
        "nazev": "💡 Lights Out",
        "tagy": ["světla", "hlavolam", "logika", "přepínání"]
      },
      {
        "soubor": "obsah/hanoi.html",
        "nazev": "🗼 Hanojské věže",
        "tagy": ["hanoj", "věže", "hlavolam", "disky", "logika"]
      },
      {
        "soubor": "obsah/simon.html",
        "nazev": "🎵 Simon",
        "tagy": ["simon", "paměť", "sekvence", "barvy", "zvuky"]
      },
      {
        "soubor": "obsah/connect4.html",
        "nazev": "🔴 Čtyři v řadě",
        "tagy": ["čtyři v řadě", "connect four", "desková hra", "dva hráči"]
      },
      {
        "soubor": "obsah/battleship.html",
        "nazev": "🚢 Lodě",
        "tagy": ["lodě", "battleship", "námořní bitva", "mřížka"]
      },
      {
        "soubor": "obsah/rock_paper_scissors.html",
        "nazev": "✊ Kámen nůžky papír",
        "tagy": ["kámen nůžky papír", "hra", "náhoda"]
      },
      {
        "soubor": "obsah/hangman.html",
        "nazev": "🪢 Šibenice",
        "tagy": ["šibenice", "hádání slov", "slovní hra", "písmena"]
      },
      {
        "soubor": "obsah/nonogram.html",
        "nazev": "🎨 Nonogramy",
        "tagy": ["nonogram", "japonské křížovky", "logika", "obrázek"]
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
        "nazev": "🎲 Kostky (Yahtzee)",
        "tagy": ["kostky", "yahtzee", "vrhcáby", "hod kostkou", "desková hra"]
      },
      {
        "soubor": "obsah/reversi.html",
        "nazev": "⚫ Reversi",
        "tagy": ["reversi", "othello", "desková hra", "kameny"]
      },
      {
        "soubor": "obsah/trivia.html",
        "nazev": "❓ Vědomostní kvíz",
        "tagy": ["kvíz", "vědomosti", "otázky", "test", "soutěž"]
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
    "nazev": "📖 Duchovní život",
    "skupina": "duchovno",
    "polozky": [
      {
        "soubor": "obsah/bible_study.html",
        "nazev": "📖 Studium Bible",
        "tagy": ["bible", "plán čtení", "verše", "zapamatování", "studijní deník", "víra"]
      },
      {
        "soubor": "obsah/tarot_reading.html",
        "nazev": "🔮 Výklad karet",
        "tagy": ["tarot", "karty", "výklad", "arkána", "věštění", "deník výkladů"]
      },
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
        "nazev": "Kontakt",
        "tagy": ["kontakt", "e-mail", "napište nám", "autor"]
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

// Aplikace přesunuté na samostatný web Nodus (složka nodus/).
// Seznam slouží jen k přesměrování starých odkazů `#obsah/...`;
// katalog výuky je v nodus/apps.js.
const PRESUNUTO_NODUS = [
  "obsah/AI_prednaska.html",
  "obsah/aj_slovesa.html",
  "obsah/aj_slovicka.html",
  "obsah/anatomie.html",
  "obsah/bunka.html",
  "obsah/casova_osa.html",
  "obsah/casovani_sloves.html",
  "obsah/chem_nazvoslovi.html",
  "obsah/citation_generator.html",
  "obsah/clock_learning.html",
  "obsah/cteni_s_porozumenim.html",
  "obsah/de_slovicka.html",
  "obsah/desetinna_cisla.html",
  "obsah/diktat_gen.html",
  "obsah/doplnovacky.html",
  "obsah/eduMaps.html",
  "obsah/eduSort.html",
  "obsah/edu_progress.html",
  "obsah/elektrina.html",
  "obsah/eu_instituce.html",
  "obsah/flags_quiz.html",
  "obsah/flashcards.html",
  "obsah/fr_slovicka.html",
  "obsah/fraction_calc.html",
  "obsah/geo_tvary.html",
  "obsah/geometricke_konstrukce.html",
  "obsah/geometrie_vzorce.html",
  "obsah/grafy_funkci.html",
  "obsah/gravitacni_hriste.html",
  "obsah/gravitacni_hriste2.html",
  "obsah/historicke_mapy_odkazy.html",
  "obsah/iss.html",
  "obsah/knihovna_sad.html",
  "obsah/kombinatorika.html",
  "obsah/literarni_smery.html",
  "obsah/mental_math.html",
  "obsah/mocniny_odmocniny.html",
  "obsah/morse_code.html",
  "obsah/multiplication.html",
  "obsah/music_theory.html",
  "obsah/notes_reading.html",
  "obsah/optika.html",
  "obsah/paka.html",
  "obsah/periodic_table.html",
  "obsah/physics_playground.html",
  "obsah/physics_ref.html",
  "obsah/planet_globe.html",
  "obsah/pocitani.html",
  "obsah/pohyb_vesmirem.html",
  "obsah/potravni_retezec.html",
  "obsah/pracovni_listy.html",
  "obsah/prevody_jednotek.html",
  "obsah/procenta.html",
  "obsah/punnett.html",
  "obsah/reading_log.html",
  "obsah/reky_pohori.html",
  "obsah/roman_numerals.html",
  "obsah/rovnice.html",
  "obsah/shoda_podmetu.html",
  "obsah/sky_events.html",
  "obsah/slabiky.html",
  "obsah/slepa_mapa.html",
  "obsah/slepa_mapa_evropa.html",
  "obsah/slovni_druhy.html",
  "obsah/solar_system.html",
  "obsah/star_map.html",
  "obsah/svetova_hlavni_mesta.html",
  "obsah/svetove_dejiny.html",
  "obsah/synonyma_antonyma.html",
  "obsah/trigonometrie.html",
  "obsah/typing_trainer.html",
  "obsah/vetny_rozbor.html",
  "obsah/vitr_tunel.html",
  "obsah/vodni_hladina.html",
  "obsah/vycislovani_rovnic.html",
  "obsah/vyjmenovana_slova.html",
  "obsah/vyslovnost.html"
];

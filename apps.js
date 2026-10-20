// Katalog aplikací – jediný zdroj pravdy pro menu, hledání a dashboard.
// Přidání aplikace = jeden záznam v poli `polozky` příslušné sekce.
// `tagy` jsou volitelná klíčová slova pro hledání (aliasy).
// `stav` je fáze vývoje stránky: 'vyvoj' (nová, autor ji ještě nezkontroloval),
// 'beta' (zkontrolovaná) nebo 'stable' (autor ji uznal za hotovou).
// Každá nově přidaná stránka začíná jako 'vyvoj'; dál ji posouvá jen autor.
const KATALOG_STAVY = [
  { id: 'vyvoj',  label: 'Vývoj',  popis: 'Ve vývoji – zatím neprošlo kontrolou autora' },
  { id: 'beta',   label: 'Beta',   popis: 'Zkontrolováno autorem, ještě se může měnit' },
  { id: 'stable', label: 'Stable', popis: 'Hotová, ověřená verze' },
];

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
        "stav": "beta",
        "tagy": [
          "poznámky",
          "text",
          "psaní"
        ]
      },
      {
        "soubor": "obsah/brainstorm.html",
        "nazev": "💡 Brainstorm",
        "stav": "beta",
        "tagy": [
          "nápady",
          "myšlenková mapa"
        ]
      },
      {
        "soubor": "obsah/mapa_souvislosti.html",
        "nazev": "🕸️ Mapa souvislostí",
        "stav": "vyvoj",
        "tagy": ["mapa souvislostí", "pojmová mapa", "concept map", "znalostní graf", "graf", "uzly", "vztahy", "myšlenková mapa", "časová osa", "dějiny", "výuka", "export svg", "json", "analýza sítě", "centralita", "komunity", "skupiny", "prezentace", "graphml", "gexf", "csv", "graphviz", "mermaid", "wikipedie", "kumu", "obsidian canvas"]
      },
      {
        "soubor": "obsah/md_html.html",
        "nazev": "📝 Markdown ↔ HTML",
        "stav": "beta",
        "tagy": ["markdown", "html", "převod", "konverze", "readme"]
      },
      {
        "soubor": "obsah/md_dokument.html",
        "nazev": "📄 Markdown → DOCX / ODT",
        "stav": "beta",
        "tagy": ["markdown", "word", "docx", "odt", "odf", "doc", "libreoffice", "převod", "konverze", "dokument"]
      },
      {
        "soubor": "obsah/word_counter.html",
        "nazev": "🔡 Počítadlo slov",
        "stav": "beta",
        "tagy": ["počet slov", "znaky", "délka textu", "statistika textu"]
      },
      {
        "soubor": "obsah/secure_notes.html",
        "nazev": "🔒 Šifrované poznámky",
        "stav": "beta",
        "tagy": [
          "heslo",
          "šifrování",
          "soukromé"
        ]
      },
      {
        "soubor": "obsah/password_vault.html",
        "nazev": "🔐 Trezor hesel",
        "stav": "beta",
        "tagy": ["heslo", "šifrování", "přihlašovací údaje", "login", "správce hesel"]
      },
      {
        "soubor": "obsah/notes_graph.html",
        "nazev": "🕸️ Zettelkasten (propojené poznámky)",
        "stav": "beta",
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
        "stav": "beta",
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
        "stav": "beta",
        "tagy": [
          "faktura",
          "slovy",
          "koruna"
        ]
      },
      {
        "soubor": "obsah/name_gen.html",
        "nazev": "🎲 Generátor jmen",
        "stav": "beta",
        "tagy": ["jména", "přezdívka", "postava", "náhodné jméno", "fantasy"]
      },
      {
        "soubor": "obsah/word_gen.html",
        "nazev": "🔤 Generátor a hledání slov",
        "stav": "beta",
        "tagy": ["vymyšlená slova", "pseudoslova", "název projektu", "značka", "brand", "dvojice slov", "náhodné slovo", "fantasy",
                 "hledání slov", "slovník", "český slovník", "anglický slovník", "slova obsahující", "křížovky", "osmisměrka", "scrabble pomocník", "přesmyčky"]
      },
      {
        "soubor": "obsah/print_editor.html",
        "nazev": "🖨️ Editor pro tisk a export",
        "stav": "beta",
        "tagy": ["tisk", "markdown", "export", "html editor", "wysiwyg", "formátování"]
      },
      {
        "soubor": "obsah/prompty.html",
        "nazev": "🤖 Databanka promptů",
        "stav": "vyvoj",
        "tagy": ["prompt", "AI", "ChatGPT", "Claude", "umělá inteligence", "šablony", "proměnné", "knihovna promptů"]
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
        "stav": "beta",
        "tagy": [
          "diář",
          "události",
          "svátky"
        ]
      },
      {
        "soubor": "obsah/kulturni_akce.html",
        "nazev": "🎪 Kulturní akce v krajích",
        "stav": "beta",
        "tagy": ["akce", "výstavy", "hody", "poutě", "festivaly", "vinobraní", "jarmark", "posezení", "kraje", "kultura"]
      },
      {
        "soubor": "obsah/todo.html",
        "nazev": "✅ Úkoly",
        "stav": "beta",
        "tagy": [
          "seznam",
          "to-do",
          "checklist"
        ]
      },
      {
        "soubor": "obsah/pomodoro.html",
        "nazev": "🍅 Pomodoro",
        "stav": "beta",
        "tagy": [
          "časovač",
          "soustředění",
          "produktivita"
        ]
      },
      {
        "soubor": "obsah/habit_tracker.html",
        "nazev": "🎯 Sledování návyků",
        "stav": "beta",
        "tagy": ["návyky", "denní rutina", "série", "streak", "sebekázeň"]
      },
      {
        "soubor": "obsah/kanban.html",
        "nazev": "📋 Kanban tabule",
        "stav": "beta",
        "tagy": [
          "úkoly",
          "nástěnka",
          "projekt"
        ]
      },
      {
        "soubor": "obsah/project_manager.html",
        "nazev": "🗂️ Správce projektů",
        "stav": "beta",
        "tagy": [
          "projekty",
          "úkoly",
          "gantt"
        ]
      },
      {
        "soubor": "obsah/countdown.html",
        "nazev": "⏳ Odpočet do události",
        "stav": "beta",
        "tagy": ["odpočet", "kolik zbývá", "termín", "událost", "svatba", "dovolená"]
      },
      {
        "soubor": "obsah/time_calc.html",
        "nazev": "⏱️ Kalkulačka času",
        "stav": "beta",
        "tagy": ["sčítání času", "rozdíl časů", "hodiny", "minuty", "výpočet času"]
      },
      {
        "soubor": "obsah/timesheet.html",
        "nazev": "⏱️ Docházka / evidence hodin",
        "stav": "beta",
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
        "stav": "beta",
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
        "stav": "beta",
        "tagy": ["kalendář", "tisk", "měsíční plánovač", "rok"]
      },
      {
        "soubor": "obsah/date_calc.html",
        "nazev": "📅 Kalkulačka datumů",
        "stav": "beta",
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
        "stav": "beta",
        "tagy": [
          "jídlo",
          "vaření",
          "nákup",
          "recepty"
        ]
      },
      {
        "soubor": "obsah/rozhodovani.html",
        "nazev": "⚖️ Vícekriteriální rozhodování",
        "stav": "vyvoj",
        "tagy": ["rozhodování", "rozhodovací matice", "AHP", "TOPSIS", "PROMETHEE", "vážený součet", "VIKOR", "průvodce", "Monte Carlo", "citlivostní analýza", "kritéria", "váhy", "decision_matrix"]
      },
      {
        "soubor": "obsah/timers.html",
        "nazev": "⏲️ Stopky & časovače",
        "stav": "beta",
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
        "stav": "beta",
        "tagy": [
          "cv",
          "resume",
          "zaměstnání"
        ]
      },
      {
        "soubor": "obsah/invoice_gen.html",
        "nazev": "🧾 Faktura / nabídka",
        "stav": "beta",
        "tagy": [
          "účet",
          "objednávka",
          "fakturace"
        ]
      },
      {
        "soubor": "obsah/expense_tracker.html",
        "nazev": "💰 Sledování výdajů",
        "stav": "beta",
        "tagy": [
          "rozpočet",
          "peníze",
          "útrata"
        ]
      },
      {
        "soubor": "obsah/loan_calc.html",
        "nazev": "🏦 Úvěr & hypotéka",
        "stav": "beta",
        "tagy": [
          "hypotéka",
          "půjčka",
          "splátka",
          "úrok"
        ]
      },
      {
        "soubor": "obsah/hypo_podil.html",
        "nazev": "🏠 Dělení hypotéky ve dvou",
        "stav": "beta",
        "tagy": [
          "hypotéka",
          "podíl",
          "spolumajitel",
          "partneři",
          "vklad",
          "spoluvlastnictví",
          "kdo kolik platí"
        ]
      },
      {
        "soubor": "obsah/savings_calc.html",
        "nazev": "📈 Spoření & úročení",
        "stav": "beta",
        "tagy": [
          "úrok",
          "investice",
          "složené úročení"
        ]
      },
      {
        "soubor": "obsah/shopplanner.html",
        "nazev": "🛒 Plánovač nákupů",
        "stav": "beta",
        "tagy": [
          "nákupní seznam",
          "obchod"
        ]
      },
      {
        "soubor": "obsah/car_tracker.html",
        "nazev": "🚗 Spotřeba auta",
        "stav": "beta",
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
        "stav": "beta",
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
        "stav": "beta",
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
        "stav": "beta",
        "tagy": ["marže", "přirážka", "markup", "cenotvorba", "prodejní cena"]
      },
      {
        "soubor": "obsah/net_salary.html",
        "nazev": "💵 Čistá mzda ČR",
        "stav": "beta",
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
        "stav": "beta",
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
        "stav": "beta",
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
        "stav": "beta",
        "tagy": [
          "porovnání",
          "nákup",
          "kč/kg",
          "kč/l",
          "balení"
        ]
      },
      {
        "soubor": "obsah/inflace.html",
        "nazev": "📉 Inflační kalkulačka ČR",
        "stav": "beta",
        "tagy": ["inflace", "kupní síla", "čsú", "znehodnocení", "přepočet", "reálná mzda", "ceny v minulosti", "koruna"]
      },
      {
        "soubor": "obsah/tco.html",
        "nazev": "💰 Celkové náklady vlastnictví (TCO)",
        "stav": "vyvoj",
        "tagy": ["kalkulačka", "finance", "ekonomika", "porovnání", "energie", "úvěr", "grafy"]
      },
      {
        "soubor": "obsah/majetek.html",
        "nazev": "📦 Evidence domácího majetku",
        "stav": "vyvoj",
        "tagy": ["domácnost", "záruky", "inventář", "QR štítky", "offline", "záloha"]
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
        "stav": "beta",
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
        "stav": "beta",
        "tagy": [
          "bezpečnost",
          "passphrase"
        ]
      },
      {
        "soubor": "obsah/qr_generator.html",
        "nazev": "📱 QR generátor + čtečka",
        "stav": "beta",
        "tagy": [
          "qr kód",
          "čtečka",
          "skener"
        ]
      },
      {
        "soubor": "obsah/barcode_gen.html",
        "nazev": "▥ Generátor čárových kódů",
        "stav": "beta",
        "tagy": ["čárový kód", "ean", "ean-13", "ean-8", "upc", "code 128", "isbn", "štítky", "sklad", "barcode"]
      },
      {
        "soubor": "obsah/random_picker.html",
        "nazev": "🎡 Losovač / kolo štěstí",
        "stav": "beta",
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
        "stav": "beta",
        "tagy": ["podpis", "e-mail", "signature", "kontaktní údaje", "html podpis"]
      },
      {
        "soubor": "obsah/vcard_gen.html",
        "nazev": "📇 Vizitka (vCard + QR)",
        "stav": "beta",
        "tagy": [
          "vizitka",
          "vcard",
          "kontakt",
          "qr"
        ]
      },
      {
        "soubor": "obsah/qr_platba.html",
        "nazev": "💳 QR platba",
        "stav": "vyvoj",
        "tagy": ["qr platba", "spayd", "platba", "banka", "účet", "iban", "variabilní symbol", "pay by square", "epc", "sepa", "faktura"]
      },
      {
        "soubor": "obsah/wifi_qr.html",
        "nazev": "📶 Wi-Fi QR kód",
        "stav": "beta",
        "tagy": [
          "wifi",
          "připojení",
          "qr"
        ]
      },
      {
        "soubor": "obsah/snippet_manager.html",
        "nazev": "📋 Snippet manager",
        "stav": "beta",
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
        "stav": "beta",
        "tagy": [
          "biorytmus",
          "kondice"
        ]
      },
      {
        "soubor": "obsah/kondiciogram_retro.html",
        "nazev": "🖨️ Kondiciogram retro",
        "stav": "beta",
        "tagy": ["biorytmus", "kondice", "cykly", "retro", "tisk"]
      },
      {
        "soubor": "obsah/relaxsounds.html",
        "nazev": "🌧️ Relaxační zvuky",
        "stav": "beta",
        "tagy": [
          "déšť",
          "zvuky",
          "spánek",
          "meditace"
        ]
      },
      {
        "soubor": "obsah/potraviny.html",
        "nazev": "🥗 Deník jídla",
        "stav": "beta",
        "tagy": ["kalorie", "počítadlo kalorií", "jídelníček", "výživa", "makroživiny", "bílkoviny", "čárový kód", "EAN", "skenování",
                 "hubnutí", "potraviny", "nutriční hodnoty", "vitaminy", "recepty", "pitný režim", "hmotnost", "Open Food Facts"]
      },
      {
        "soubor": "obsah/bmi_calc.html",
        "nazev": "🩺 BMI & kalorie",
        "stav": "beta",
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
        "stav": "beta",
        "tagy": [
          "relaxace",
          "stres",
          "meditace"
        ]
      },
      {
        "soubor": "obsah/cviceni/index.html",
        "nazev": "💪 Časovač cvičení",
        "stav": "vyvoj",
        "tagy": ["časovač", "intervaly", "tabata", "HIIT", "EMOM", "AMRAP", "kruhový trénink", "pauza mezi sériemi", "odpočet", "stopky",
                 "box", "posilovna", "fitness", "cvičení", "trénink", "mobil", "aplikace", "interval timer"]
      },
      {
        "soubor": "obsah/workout_log.html",
        "nazev": "🏋️ Tréninkový deník",
        "stav": "beta",
        "tagy": [
          "cvičení",
          "posilování",
          "fitness"
        ]
      },
      {
        "soubor": "obsah/blood_pressure.html",
        "nazev": "🩸 Deník krevního tlaku",
        "stav": "beta",
        "tagy": [
          "tlak",
          "hypertenze",
          "puls"
        ]
      },
      {
        "soubor": "obsah/heart_zones.html",
        "nazev": "❤️ Tepové zóny",
        "stav": "beta",
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
        "stav": "beta",
        "tagy": [
          "léky",
          "prášky",
          "dávkování"
        ]
      },
      {
        "soubor": "obsah/menstrual_calendar.html",
        "nazev": "🌸 Menstruační kalendář",
        "stav": "beta",
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
        "stav": "beta",
        "tagy": ["nálada", "deník", "emoce", "psychika", "sledování"]
      },
      {
        "soubor": "obsah/ideal_weight.html",
        "nazev": "⚖️ Ideální hmotnost",
        "stav": "beta",
        "tagy": ["hmotnost", "váha", "postava", "zdravá váha", "kalkulačka"]
      },
      {
        "soubor": "obsah/sleep_tracker.html",
        "nazev": "😴 Tracker spánku",
        "stav": "beta",
        "tagy": [
          "spánek",
          "usínání"
        ]
      },
      {
        "soubor": "obsah/water_tracker.html",
        "nazev": "💧 Pitný režim",
        "stav": "beta",
        "tagy": [
          "voda",
          "hydratace"
        ]
      },
      {
        "soubor": "obsah/reaction_test.html",
        "nazev": "⚡ Reakční test",
        "stav": "beta",
        "tagy": ["reakce", "rychlost", "postřeh", "ms", "test"]
      },
      {
        "soubor": "obsah/color_vision.html",
        "nazev": "👁️ Test barvocitu",
        "stav": "beta",
        "tagy": ["barvocit", "ishihara", "barvoslepost", "zrak", "test"]
      },
      {
        "soubor": "obsah/sleep_cycle_alarm.html",
        "nazev": "😴 Budík dle spánkových cyklů",
        "stav": "beta",
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
        "stav": "beta",
        "tagy": [
          "zrak",
          "snellen",
          "oči"
        ]
      },
      {
        "soubor": "obsah/growth_chart.html",
        "nazev": "📈 Kalendář růstu dítěte (percentily)",
        "stav": "beta",
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
        "stav": "beta",
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
        "stav": "beta",
        "tagy": [
          "kofein",
          "káva",
          "energy drink"
        ]
      },
      {
        "soubor": "obsah/alkohol_krev.html",
        "nazev": "🍺 Alkohol v krvi",
        "stav": "vyvoj",
        "tagy": ["promile", "alkohol", "Widmark", "řízení", "pivo", "víno", "vystřízlivění"]
      },
      {
        "soubor": "obsah/tehotenstvi.html",
        "nazev": "🤰 Těhotenský kalendář",
        "stav": "vyvoj",
        "tagy": ["těhotenství", "termín porodu", "Naegele", "týden těhotenství", "trimestr", "screening", "porod"]
      },
      {
        "soubor": "obsah/ockovani.html",
        "nazev": "💉 Očkovací kalendář",
        "stav": "vyvoj",
        "tagy": ["očkování", "vakcíny", "hexavakcína", "MMR", "děti", "přeočkování", "tetanus", "klíšťová encefalitida", "HPV"]
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
        "stav": "beta",
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
        "stav": "beta",
        "tagy": ["počasí", "glóbus", "3d", "mapa", "teplota", "svět"]
      },
      {
        "soubor": "obsah/pocasi_eu.html",
        "nazev": "🌦️ Počasí Evropy",
        "stav": "beta",
        "tagy": [
          "meteo",
          "mapa počasí"
        ]
      },
      {
        "soubor": "obsah/radareu.html",
        "nazev": "📡 Radar EU",
        "stav": "beta",
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
        "stav": "beta",
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
        "stav": "beta",
        "tagy": ["rosný bod", "vlhkost", "kondenzace", "plíseň", "psychrometrie"]
      },
      {
        "soubor": "obsah/meteo_units.html",
        "nazev": "🌡️ Převodník meteo jednotek",
        "stav": "beta",
        "tagy": ["převod jednotek", "teplota", "tlak", "rychlost větru", "srážky"]
      },
      {
        "soubor": "obsah/bourky.html",
        "nazev": "⚡ Bouřky a blesky živě",
        "stav": "vyvoj",
        "tagy": ["blesky", "bouřky", "radar", "počasí", "mapa", "živá data"]
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
        "stav": "beta",
        "tagy": [
          "zahrada",
          "osevní postup",
          "plodiny"
        ]
      },
      {
        "soubor": "obsah/garden_layout.html",
        "nazev": "🌱 Plánovač záhonů",
        "stav": "beta",
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
        "stav": "beta",
        "tagy": [
          "setí",
          "osivo",
          "zahrada"
        ]
      },
      {
        "soubor": "obsah/fertilizer_calc.html",
        "nazev": "🌱 Kalkulačka hnojení N-P-K",
        "stav": "beta",
        "tagy": [
          "hnojivo",
          "zahrada",
          "dusík"
        ]
      },
      {
        "soubor": "obsah/rainfall_gdd.html",
        "nazev": "🌧️ Srážky & GDD",
        "stav": "beta",
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
        "stav": "beta",
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
        "stav": "beta",
        "tagy": [
          "polní práce",
          "setí",
          "sklizeň",
          "agro"
        ]
      },
      {
        "soubor": "obsah/zahradni_stavby.html",
        "nazev": "🌿 Zahradní stavby ze dřeva",
        "stav": "vyvoj",
        "tagy": ["zahrada", "vyvýšený záhon", "kompostér", "pergola", "lamely", "stínění", "zemní tlak", "průhyb", "statika", "dřevo", "kusovník", "plán řezů", "PDF", "DXF", "STL", "3D"]
      },
      {
        "soubor": "obsah/ptaci_budky.html",
        "nazev": "🐦 Ptačí budky a hmyzí hotely",
        "stav": "vyvoj",
        "tagy": ["budka", "ptáci", "hmyzí hotel", "truhlařina", "řezný plán", "šablona", "PDF 1:1", "DXF", "STL", "3D", "netopýři", "zahrada"]
      }
    ]
  },
  {
    "nazev": "🗺️ Mapy & cesty",
    "skupina": "priroda",
    "polozky": [
      {
        "soubor": "obsah/dvere_do_sveta.html",
        "nazev": "🚪 Dveře do světa",
        "stav": "vyvoj",
        "tagy": ["webkamera", "webkamery", "živě", "live", "kamera", "výhled", "cestování", "svět", "náhodné místo", "příroda", "zvířata", "hory", "moře", "sopky", "polární záře", "přístavy", "lodě", "street view"]
      },
      {
        "soubor": "obsah/trip_planner.html",
        "nazev": "🥾 Plánovač tras",
        "stav": "beta",
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
        "stav": "beta",
        "tagy": [
          "dovolená",
          "cestování",
          "itinerář"
        ]
      },
      {
        "soubor": "obsah/gpx_viewer.html",
        "nazev": "📡 GPX Viewer",
        "stav": "beta",
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
        "stav": "beta",
        "tagy": ["cestování", "deník", "zápisky", "výlety", "fotky"]
      },
      {
        "soubor": "obsah/packing_list.html",
        "nazev": "🎒 Balicí seznam",
        "stav": "beta",
        "tagy": [
          "kufr",
          "dovolená",
          "seznam"
        ]
      },
      {
        "soubor": "obsah/travel_budget.html",
        "nazev": "💶 Cestovní rozpočet",
        "stav": "beta",
        "tagy": ["rozpočet", "cestování", "útrata", "rozdělení nákladů", "měna"]
      },
      {
        "soubor": "obsah/map_export.html",
        "nazev": "🗺️ Mapový exportér",
        "stav": "beta",
        "tagy": [
          "mapa",
          "tisk",
          "export"
        ]
      },
      {
        "soubor": "obsah/map_compare.html",
        "nazev": "⚖️ Porovnání map",
        "stav": "beta",
        "tagy": [
          "historické mapy",
          "porovnání"
        ]
      },
      {
        "soubor": "obsah/distance_measure.html",
        "nazev": "📏 Měřič vzdáleností",
        "stav": "beta",
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
        "stav": "beta",
        "tagy": [
          "nadmořská výška",
          "stoupání",
          "trasa"
        ]
      },
      {
        "soubor": "obsah/gps_area.html",
        "nazev": "📐 Plocha z GPS bodů",
        "stav": "beta",
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
        "stav": "beta",
        "tagy": [
          "palivo",
          "benzín",
          "spolujezdci",
          "kilometrovné"
        ]
      },
      {
        "soubor": "obsah/ziva_zeme.html",
        "nazev": "🌋 Živá Země",
        "stav": "vyvoj",
        "tagy": ["zemětřesení", "požáry", "sopky", "ISS", "mapa", "živá data"]
      },
      {
        "soubor": "obsah/zaplavy.html",
        "nazev": "🌊 Zaplavení terénu",
        "stav": "vyvoj",
        "tagy": ["mapa", "povodně", "záplavy", "DEM", "GIS", "terén", "GeoTIFF"]
      },
      {
        "soubor": "obsah/vyletni_denik.html",
        "nazev": "📔 Výletní deník",
        "stav": "vyvoj",
        "tagy": ["výlety", "deník", "GPX", "KML", "mapa", "fotografie", "výškový profil", "statistiky", "kalendář", "počasí", "offline"]
      },
      {
        "soubor": "obsah/svetelne_znecisteni.html",
        "nazev": "🌌 Světelné znečištění a tmavá obloha",
        "stav": "vyvoj",
        "tagy": ["astronomie", "mapa", "světelné znečištění", "Bortle", "Měsíc", "soumrak", "oblačnost", "pozorování hvězd", "GPX"]
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
        "stav": "beta",
        "tagy": [
          "souřadnice",
          "wgs84",
          "převod"
        ]
      },
      {
        "soubor": "obsah/compass_azimuth.html",
        "nazev": "🧭 Kompas & azimut",
        "stav": "beta",
        "tagy": ["kompas", "azimut", "orientace", "buzola", "sever"]
      },
      {
        "soubor": "obsah/sun_moon.html",
        "nazev": "🌅 Slunce & Měsíc",
        "stav": "beta",
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
        "stav": "beta",
        "tagy": [
          "časová pásma",
          "čas",
          "hodiny"
        ]
      },
      {
        "soubor": "obsah/sextant.html",
        "nazev": "🧭 Sextant – poloha podle hvězd",
        "stav": "beta",
        "tagy": ["astronavigace", "polárka", "zeměpisná šířka", "slunce v poledne"]
      },
      {
        "soubor": "obsah/sky_events.html",
        "nazev": "🔭 Astronomický kalendář úkazů",
        "stav": "beta",
        "tagy": ["astronomie", "Měsíc", "zatmění", "meteory", "planety", "kalendář", "ics"]
      },
      {
        "soubor": "obsah/slunecni_hodiny.html",
        "nazev": "☀️ Sluneční hodiny",
        "stav": "vyvoj",
        "tagy": ["sluneční hodiny", "gnomon", "rovnice času", "analema", "šablona", "tisk 1:1", "PDF", "DXF", "astronomie", "deklinace stěny", "Canterbury", "kapesní hodiny", "výškové hodiny"]
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
        "stav": "beta",
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
        "stav": "beta",
        "tagy": ["css", "gradient", "přechod barev", "web design"]
      },
      {
        "soubor": "obsah/shadow_gen.html",
        "nazev": "🌑 Generátor stínů",
        "stav": "beta",
        "tagy": ["css", "box-shadow", "stín", "web design"]
      },
      {
        "soubor": "obsah/pattern_gen.html",
        "nazev": "🔳 Generátor vzorů",
        "stav": "beta",
        "tagy": ["css", "vzor", "tapeta", "pozadí", "textura"]
      },
      {
        "soubor": "obsah/blob_gen.html",
        "nazev": "🫧 SVG bloby",
        "stav": "beta",
        "tagy": ["svg", "blob", "tvar", "web design", "organický tvar"]
      },
      {
        "soubor": "obsah/favicon_gen.html",
        "nazev": "⭐ Favicon generátor",
        "stav": "beta",
        "tagy": ["favicon", "ikona", "web", "png", "záložka"]
      },
      {
        "soubor": "obsah/Circle_generator.html",
        "nazev": "⭕ Kružnice",
        "stav": "beta",
        "tagy": ["kružnice", "obrazce", "geometrie", "generátor", "tisk"]
      },
      {
        "soubor": "obsah/stained_glass.html",
        "nazev": "🔷 Vitráž",
        "stav": "beta",
        "tagy": ["vitráž", "sklo", "mozaika", "generátor", "výtvarka"]
      },
      {
        "soubor": "obsah/comic3d.html",
        "nazev": "💥 Komiksový 3D prostor",
        "stav": "beta",
        "tagy": ["komiks", "3d", "scéna", "bubliny", "kreslení"]
      },
      {
        "soubor": "obsah/comic3d_walk.html",
        "nazev": "🚶 Komiksový 3D svět (procházka)",
        "stav": "beta",
        "tagy": ["komiks", "3d", "procházka", "prostor", "walk"]
      },
      {
        "soubor": "obsah/comic_strip.html",
        "nazev": "💬 Generátor komiksových stripů",
        "stav": "beta",
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
        "stav": "beta",
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
        "stav": "beta",
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
        "stav": "beta",
        "tagy": [
          "sticker",
          "nálepka",
          "obrys"
        ]
      },
      {
        "soubor": "obsah/ascii_art.html",
        "nazev": "🔤 ASCII art",
        "stav": "beta",
        "tagy": ["ascii", "art", "obrázek na text", "terminál"]
      },
      {
        "soubor": "obsah/pixel_art.html",
        "nazev": "🎨 Pixel art editor",
        "stav": "beta",
        "tagy": ["pixel", "kreslení", "editor", "sprite", "8bit"]
      },
      {
        "soubor": "obsah/pixel_studio.html",
        "nazev": "🧩 Pixel studio (PNG assety)",
        "stav": "beta",
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
        "stav": "beta",
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
        "stav": "beta",
        "tagy": ["meme", "vtip", "obrázek s textem", "popisek"]
      },
      {
        "soubor": "obsah/emoji_picker.html",
        "nazev": "😀 Picker emoji",
        "stav": "beta",
        "tagy": ["emoji", "symboly", "znaky", "kopírovat", "unicode"]
      },
      {
        "soubor": "obsah/whiteboard.html",
        "nazev": "✏️ Whiteboard",
        "stav": "beta",
        "tagy": [
          "kreslení",
          "tabule",
          "skica"
        ]
      },
      {
        "soubor": "obsah/wedding_invite.html",
        "nazev": "💍 Svatební oznámení",
        "stav": "beta",
        "tagy": ["svatba", "oznámení", "pozvánka", "tisk", "šablona"]
      },
      {
        "soubor": "obsah/flowchart.html",
        "nazev": "🔀 Editor diagramů",
        "stav": "beta",
        "tagy": [
          "diagram",
          "schéma",
          "vývojový",
          "flowchart",
          "mermaid",
          "postup",
          "proces",
          "svg",
          "png"
        ]
      },
      {
        "soubor": "obsah/certificate_gen.html",
        "nazev": "🏆 Generátor diplomů",
        "stav": "beta",
        "tagy": ["diplom", "certifikát", "ocenění", "tisk", "soutěž"]
      },
      {
        "soubor": "obsah/font_preview.html",
        "nazev": "🔤 Náhled fontů",
        "stav": "beta",
        "tagy": ["fonty", "písmo", "typografie", "náhled", "párování"]
      },
      {
        "soubor": "obsah/prevod_pisma.html",
        "nazev": "🧝 Převodník písma",
        "stav": "beta",
        "tagy": ["fonty", "písmo", "elfí písmo", "tengwar", "tolkien", "pán prstenů", "runy", "futhark", "hlaholice", "azbuka", "cyrilice", "alfabeta", "řečtina", "ogam", "braille", "slepecké písmo", "hieroglyfy", "egypt", "fénické písmo", "etruské písmo", "gótské písmo", "morseovka", "přepis", "transliterace", "vlastní font"]
      },
      {
        "soubor": "obsah/hieroglyfy.html",
        "nazev": "🏺 Egyptský písař",
        "stav": "vyvoj",
        "tagy": ["hieroglyfy", "egypt", "egyptské písmo", "faraon", "kartuše", "přepis", "jméno hieroglyfy", "kleopatra", "gardiner", "jsesh", "mdc", "starověk", "písmo", "dějepis"]
      },
      {
        "soubor": "obsah/colorblind_sim.html",
        "nazev": "🌈 Simulace barvosleposti",
        "stav": "beta",
        "tagy": ["barvoslepost", "přístupnost", "simulace", "daltonismus", "kontrast"]
      },
      {
        "soubor": "obsah/spirograf.html",
        "nazev": "✒️ Spirograf",
        "stav": "vyvoj",
        "tagy": ["spirograf", "hypotrochoida", "epitrochoida", "kreslení", "vzory", "mandala", "SVG"]
      },
      {
        "soubor": "obsah/keltske_uzly.html",
        "nazev": "🪢 Keltské uzly",
        "stav": "vyvoj",
        "tagy": ["keltské uzly", "pletenec", "cop", "uzel", "triquetra", "trojlístek", "ornament", "vzory", "mandala", "SVG"]
      },
      {
        "soubor": "obsah/plakat_utrzky.html",
        "nazev": "📌 Plakát s útržky",
        "stav": "vyvoj",
        "tagy": ["plakát", "inzerát", "vývěska", "útržky", "nástěnka", "tisk", "PDF", "QR"]
      },
      {
        "soubor": "obsah/volvelle.html",
        "nazev": "🎡 Volvelle – otočné kotouče",
        "stav": "vyvoj",
        "tagy": ["volvelle", "papír", "tisk", "šablona", "kalendář", "měsíc", "šifra", "planisféra", "hvězdy", "logaritmické pravítko", "převodník", "PDF", "SVG", "DXF", "3D", "pro děti"]
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
        "stav": "beta",
        "tagy": [
          "koláž",
          "spojení obrázků",
          "mřížka"
        ]
      },
      {
        "soubor": "obsah/IMG_print.html",
        "nazev": "🖼️ Resizer obrázků",
        "stav": "beta",
        "tagy": [
          "tisk",
          "zmenšení",
          "velikost obrázku"
        ]
      },
      {
        "soubor": "obsah/image_converter.html",
        "nazev": "🖼️ Převodník obrázků",
        "stav": "beta",
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
        "stav": "beta",
        "tagy": ["dithering", "pixelizace", "rastr", "retro", "obrázek"]
      },
      {
        "soubor": "obsah/rodokmen.html",
        "nazev": "🌳 Stavitel rodokmenu",
        "stav": "beta",
        "tagy": ["rodokmen", "genealogie", "předkové", "rodina", "strom", "gedcom", "vývod", "matrika",
                 "příbuznost", "ověření", "sosa", "ahnentafel", "profesionální"]
      },
      {
        "soubor": "obsah/Heritage.html",
        "nazev": "🌳 Heritage tree",
        "stav": "beta",
        "tagy": ["rodokmen", "genealogie", "předkové", "rodina", "strom", "gedcom", "příbuznost", "matrika", "bratranec", "rodinný strom", "export"]
      },
      {
        "soubor": "obsah/gene_map.html",
        "nazev": "🧬 Mapa dědičnosti",
        "stav": "beta",
        "tagy": ["dědičnost", "genetika", "geny", "rodokmen", "znaky"]
      },
      {
        "soubor": "obsah/exif_viewer.html",
        "nazev": "📷 EXIF prohlížeč",
        "stav": "beta",
        "tagy": ["exif", "metadata", "foto", "gps", "expozice"]
      },
      {
        "soubor": "obsah/watermark.html",
        "nazev": "💧 Vodoznak",
        "stav": "beta",
        "tagy": ["vodoznak", "logo", "ochrana fotky", "copyright"]
      },
      {
        "soubor": "obsah/image_crop.html",
        "nazev": "✂️ Ořez obrázku",
        "stav": "beta",
        "tagy": ["ořez", "crop", "obrázek", "poměr stran", "úprava fotky"]
      },
      {
        "soubor": "obsah/stencil.html",
        "nazev": "🎨 Šablona na sprej (stencil)",
        "stav": "vyvoj",
        "tagy": ["stencil", "šablona", "sprej", "graffiti", "můstky", "ostrůvky", "plotr", "cricut", "silhouette", "laser", "svg", "dxf", "pdf", "vyřezávání", "vrstvy"]
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
        "stav": "beta",
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
        "stav": "beta",
        "tagy": [
          "video",
          "střih"
        ]
      },
      {
        "soubor": "obsah/video_sekce.html",
        "nazev": "🎞️ Dělení videa na sekce",
        "stav": "vyvoj",
        "tagy": ["video", "střih", "sekce", "rozdělit", "snímek", "export"]
      },
      {
        "soubor": "obsah/nahnoji.html",
        "nazev": "📼 Videotéka Nahnoji.cz",
        "stav": "vyvoj",
        "tagy": ["video", "videa", "nahnoji", "přehrávač", "galerie", "videotéka", "sdílení"]
      },
      {
        "soubor": "obsah/soundGen.html",
        "nazev": "🎵 Generátor zvuku",
        "stav": "beta",
        "tagy": ["zvuk", "tón", "frekvence", "generátor", "sinus"]
      },
      {
        "soubor": "obsah/spectrum_visualizer.html",
        "nazev": "🎵 Zvukový vizualizér",
        "stav": "beta",
        "tagy": ["spektrum", "vizualizace", "hudba", "fft", "analyzér"]
      },
      {
        "soubor": "obsah/voice_recorder.html",
        "nazev": "🎙️ Hlasový záznamník",
        "stav": "beta",
        "tagy": ["nahrávání", "diktafon", "mikrofon", "audio", "záznam"]
      },
      {
        "soubor": "obsah/tuner.html",
        "nazev": "🎸 Ladička",
        "stav": "beta",
        "tagy": ["ladička", "kytara", "ladění", "tón", "frekvence"]
      },
      {
        "soubor": "obsah/metronome.html",
        "nazev": "🥁 Metronom",
        "stav": "beta",
        "tagy": ["metronom", "tempo", "bpm", "rytmus", "cvičení"]
      },
      {
        "soubor": "obsah/piano.html",
        "nazev": "🎹 Piano",
        "stav": "beta",
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
        "stav": "beta",
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
        "stav": "beta",
        "tagy": ["trubky", "redukce", "rozvin", "plech", "svařování", "kónus", "sražení", "fazeta"]
      },
      {
        "soubor": "obsah/tubeRedFlat.html",
        "nazev": "🔧 Redukce se zploštěním",
        "stav": "vyvoj",
        "tagy": ["trubky", "redukce", "zploštění", "ovál", "obdélník", "elipsa", "plochá trubka", "vzduchotechnika", "odsávání", "3d tisk", "stl", "3mf", "kónus", "sražení", "límec", "příruba", "šrouby", "těsnění", "hadice", "bajonet", "výkres", "šablona"]
      },
      {
        "soubor": "obsah/tubeSplit.html",
        "nazev": "🔱 Rozbočka trubek",
        "stav": "beta",
        "tagy": ["trubky", "rozbočka", "odsávání", "vývody", "kalhoty", "redukce", "svařování", "kónus", "sražení", "fazeta"]
      },
      {
        "soubor": "obsah/kleste.html",
        "nazev": "🗜️ Kleště, pinzety a svorky",
        "stav": "vyvoj",
        "tagy": ["kleště", "pinzeta", "svorka", "peán", "jehelec", "kocher", "reverzní pinzeta", "samosvorná", "rohatka", "kleště na topinky", "kleště na pečivo", "grilovací kleště", "kleště na salát", "kleště na led", "kleště na sklenice", "kleště na cukr", "kolíček", "klip na sáčky", "svorka na hadičky", "čelisti", "zoubkování", "print-in-place", "kloub", "čep", "3d tisk", "stl", "3mf"]
      },
      {
        "soubor": "obsah/cookieCutter.html",
        "nazev": "🍪 Vykrajovátka",
        "stav": "beta",
        "tagy": ["vykrajovátka", "cukroví", "3d tisk", "pečení", "stl", "obj", "svg", "vánoce", "velikonoce", "perníčky", "monogram", "z obrázku", "šablona", "50 tvarů", "zvířátka", "srdíčko", "hvězda", "stromek"]
      },
      {
        "soubor": "obsah/text3d.html",
        "nazev": "🔠 3D text z písma",
        "stav": "beta",
        "tagy": ["3d tisk", "stl", "3mf", "svg", "číslo domu", "popisné číslo", "cedulka", "jmenovka", "nápis", "písmena", "font", "písmo", "reliéf", "rytina", "šablona", "sprej", "tengwar", "elfí písmo", "runy", "braille", "hieroglyfy", "podložka", "tiskárna", "vlastní font"]
      },
      {
        "soubor": "obsah/povrch3d.html",
        "nazev": "🧱 Struktury a hrany 3D modelu",
        "stav": "vyvoj",
        "tagy": ["3d tisk", "stl", "obj", "3mf", "struktura", "textura", "reliéf", "cihly", "kámen", "dlažba", "prkna", "šupiny", "vroubkování", "slzičkový plech", "výšková mapa", "displacement", "sražení", "fazeta", "zaoblení", "rádius", "hrany", "úprava modelu", "vlastní vzor", "nápis", "logo", "gravírování", "šindel", "palisáda", "bosáž", "měření tloušťky"]
      },
      {
        "soubor": "obsah/turbina_navrhar.html",
        "nazev": "🌀 Návrhář turbín a proudění",
        "stav": "beta",
        "tagy": ["turbína", "vrtule", "proudění", "cfd", "lbm", "větrná elektrárna", "savonius", "darrieus", "gorlov", "tesla", "pelton", "kaplan", "bánki", "cross-flow", "lopatka", "naca", "bem", "aerodynamika", "hydrodynamika", "stl"]
      },
      {
        "soubor": "obsah/ozubena_kola.html",
        "nazev": "⚙️ Návrhář ozubených soukolí",
        "stav": "beta",
        "tagy": ["ozubená kola", "ozubení", "převod", "převodovka", "evolventa", "modul", "pastorek", "šikmé zuby", "šípové zuby", "hřeben", "planetová převodovka", "vnitřní ozubení", "cevové soukolí", "lucerna", "mlýn", "hodinové kolo", "cykloida", "maltézský kříž", "rohatka", "západka", "kusovník", "stl", "3mf", "dxf", "3d tisk"]
      },
      {
        "soubor": "obsah/soukoli_skladacka.html",
        "nazev": "🧩 Skládačka soukolí",
        "stav": "beta",
        "tagy": ["ozubená kola", "převod", "převodovka", "skládačka", "hřiště", "simulace", "převodový poměr", "řemen", "řetěz", "řemenice", "hřeben", "věnec", "vložené kolo", "hodinový převod", "otáčky", "moment", "kinematika"]
      },
      {
        "soubor": "obsah/voronoi_stl.html",
        "nazev": "🕸 Voronoi z STL",
        "stav": "vyvoj",
        "tagy": ["voronoi", "stl", "3d model", "síť", "odlehčení"]
      },
      {
        "soubor": "obsah/papercraft.html",
        "nazev": "📦 Papírové modely",
        "stav": "beta",
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
        "soubor": "obsah/strihy.html",
        "nazev": "✂️ Střihy – oděvy a kopací míč",
        "stav": "beta",
        "tagy": ["střih", "šití", "oblečení", "tričko", "mikina", "sukně", "kalhoty", "šaty", "halenka", "košile", "vesta", "župan", "kimono", "šortky", "legíny", "zavinovací sukně", "zástěra", "čepice", "kšiltovka", "klobouk", "pelerína", "pončo", "míč", "fotbalový míč", "panely", "šestiúhelník", "pětiúhelník", "střihový plán", "spotřeba látky", "tisk po stranách", "vnořený střih", "pdf", "dxf"]
      },
      {
        "soubor": "obsah/gridGen.html",
        "nazev": "📏 Papíry na tisk",
        "stav": "beta",
        "tagy": ["mřížka", "a4", "a3", "a5", "tisk", "papír", "čtverečky", "milimetrový papír", "linky", "tečky", "izometrie", "notová osnova", "tabulatura", "šestiúhelníky", "kaligrafie", "pdf", "svg"]
      },
      {
        "soubor": "obsah/splitGen.html",
        "nazev": "🍕 Dělič kruhu",
        "stav": "beta",
        "tagy": ["kruh", "dělení", "paprsky", "úhly", "šablona"]
      },
      {
        "soubor": "obsah/screw_calc.html",
        "nazev": "🔩 Šrouby & závity",
        "stav": "beta",
        "tagy": [
          "závit",
          "metrický",
          "utahovací moment"
        ]
      },
      {
        "soubor": "obsah/evolventni_kola.html",
        "nazev": "⚙️ Evolventní ozubená kola",
        "stav": "vyvoj",
        "tagy": ["strojírenství", "ozubení", "CAD", "3D tisk", "STL", "DXF", "SVG", "výuka", "gear_generator"]
      },
      {
        "soubor": "obsah/sheet_bend.html",
        "nazev": "📐 Rozvin plechu",
        "stav": "beta",
        "tagy": ["plech", "ohyb", "rozvin", "ohraňování", "k-faktor"]
      },
      {
        "soubor": "obsah/cutting_speed.html",
        "nazev": "⚙️ Řezné podmínky",
        "stav": "beta",
        "tagy": ["obrábění", "otáčky", "posuv", "fréza", "soustružení"]
      },
      {
        "soubor": "obsah/material_weight.html",
        "nazev": "⚖️ Hmotnost materiálu",
        "stav": "beta",
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
        "stav": "beta",
        "tagy": [
          "3d tisk",
          "pla",
          "petg"
        ]
      },
      {
        "soubor": "obsah/iso_tolerance.html",
        "nazev": "📏 Tolerance a uložení ISO",
        "stav": "beta",
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
        "stav": "beta",
        "tagy": ["tvrdost", "hrc", "hb", "vickers", "rockwell"]
      },
      {
        "soubor": "obsah/gear_ratio.html",
        "nazev": "⚙️ Převodové poměry",
        "stav": "beta",
        "tagy": ["převod", "poměr", "kola", "otáčky", "řemenice"]
      },
      {
        "soubor": "obsah/paint_coverage_calc.html",
        "nazev": "🎨 Spotřeba barvy/tapety",
        "stav": "beta",
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
        "stav": "beta",
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
        "stav": "beta",
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
        "soubor": "obsah/schodiste.html",
        "nazev": "🪜 Návrh schodiště",
        "stav": "vyvoj",
        "tagy": ["schody", "schodiště", "ČSN 73 4130", "stupně", "kosé stupně", "točité", "vřetenové", "schodnice", "podchodná výška", "stropní otvor", "zábradlí", "DXF", "rodinný dům", "tesařina"]
      },
      {
        "soubor": "obsah/rafter_spacing_calc.html",
        "nazev": "📐 Rozteč krokví / trámků",
        "stav": "beta",
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
        "soubor": "obsah/pudorys.html",
        "nazev": "🏠 Půdorys a rozvody",
        "stav": "beta",
        "tagy": ["půdorys", "dispozice", "patro", "místnost", "stěny", "okna", "dveře", "kóty", "rozvody", "voda", "elektro", "kanalizace", "plyn", "topení", "zásuvky", "dxf", "3d", "výkaz", "plocha m2", "stavba", "rekonstrukce"]
      },
      {
        "soubor": "obsah/wooden_shed_3d.html",
        "nazev": "🪵 Dřevěná stavba – 3D a kusovník",
        "stav": "beta",
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
        "soubor": "obsah/modelar.html",
        "nazev": "🧊 Modelář 3D",
        "stav": "beta",
        "tagy": [
          "3d",
          "modelování",
          "tinkercad",
          "tvary",
          "cad",
          "3d tisk",
          "stl",
          "3mf",
          "step",
          "závity",
          "výkres"
        ]
      },
      {
        "soubor": "obsah/quake_lab.html",
        "nazev": "🏚️ Zemětřesná laboratoř",
        "stav": "beta",
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
        "stav": "beta",
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
        "stav": "beta",
        "tagy": [
          "pružina",
          "tuhost",
          "strojírenství"
        ]
      },
      {
        "soubor": "obsah/vacky.html",
        "nazev": "⚙️ Návrhář diskových vaček",
        "stav": "vyvoj",
        "tagy": ["strojírenství", "mechanismy", "vačky", "kinematika", "CAD", "export", "3D tisk"]
      },
      {
        "soubor": "obsah/prevody_mech.html",
        "nazev": "⚙️ Návrhář mechanických převodů",
        "stav": "vyvoj",
        "tagy": ["strojírenství", "převody", "ozubená kola", "řemen", "řetěz", "kinematika", "simulace"]
      },
      {
        "soubor": "obsah/pevnost_tisku.html",
        "nazev": "🧱 Pevnost výtisků (FDM)",
        "stav": "vyvoj",
        "tagy": ["3D tisk", "FDM", "pevnost", "nosník", "průhyb", "výpočet", "inženýrství", "materiály"]
      },
      {
        "soubor": "obsah/krabicky.html",
        "nazev": "📦 Krabičky pro elektroniku",
        "stav": "vyvoj",
        "tagy": ["3D tisk", "CAD", "elektronika", "Arduino", "ESP32", "STL", "3MF", "generátor"]
      },
      {
        "soubor": "obsah/panty.html",
        "nazev": "🔩 Panty a klouby pro 3D tisk",
        "stav": "vyvoj",
        "tagy": ["3D tisk", "CAD", "STL", "pant", "kloub", "FDM", "návrh", "strojírenství"]
      },
      {
        "soubor": "obsah/stitky_panely.html",
        "nazev": "🎛️ Štítky a čelní panely",
        "stav": "vyvoj",
        "tagy": ["štítky", "čelní panel", "Eurorack", "19\" rack", "laser", "CNC", "SVG", "DXF", "PDF 1:1", "samolepky", "elektronika"]
      },
      {
        "soubor": "obsah/tech_tisk.html",
        "nazev": "📏 Technický generátor pro tisk",
        "stav": "vyvoj",
        "tagy": ["pravítko", "úhloměr", "stupnice", "číselník", "dělicí kotouč", "vrtací šablona", "rozteč otvorů", "PCD", "VESA", "NEMA", "mřížka", "milimetrový papír", "π-páska", "měřítko", "řezací podložka", "kalibrace tiskárny", "rádiusové měrky", "závitové měrky", "logaritmické pravítko", "semilogaritmický papír", "ternární diagram", "rozvinutí kužele", "sedlo trubky", "segmentové koleno", "šablona kružnic", "elipsa", "tisk 1:1", "PDF", "SVG", "DXF", "PNG", "laser"]
      },
      {
        "soubor": "obsah/krabice_fefco.html",
        "nazev": "📦 Krabice z kartonu (FEFCO)",
        "stav": "vyvoj",
        "tagy": ["krabice", "FEFCO", "vlnitá lepenka", "karton", "rozvin", "výsek", "dieline", "skládačka", "obal", "SVG", "DXF", "PDF", "plotr", "laser", "3D"]
      },
      {
        "soubor": "obsah/vrtaci_sablony.html",
        "nazev": "🔩 Vrtací šablony",
        "stav": "vyvoj",
        "tagy": ["vrtání", "šablona", "systém 32", "závěsy", "kolíky", "úchytky", "VESA", "KU 68", "PCD", "PDF 1:1", "STL", "3D tisk", "přípravek"]
      },
      {
        "soubor": "obsah/truhlarske_spoje.html",
        "nazev": "🪚 Šablony truhlářských spojů",
        "stav": "vyvoj",
        "tagy": ["truhlářství", "dřevo", "spoje", "rybina", "dovetail", "cinky", "čep a dlab", "přeplátování", "pero a drážka", "kolíky", "lamely", "šablona", "tisk 1:1", "PDF", "SVG", "DXF", "STL", "3D", "kusovník", "CNC"]
      },
      {
        "soubor": "obsah/planetarium.html",
        "nazev": "🌍 Planetárium Slunce–Země–Měsíc",
        "stav": "vyvoj",
        "tagy": ["tellurium", "orrery", "planetárium", "ozubená kola", "převody", "Měsíc", "fáze", "roční období", "zatmění", "STL", "DXF", "3D tisk"]
      },
      {
        "soubor": "obsah/ohyb_dreva.html",
        "nazev": "🌙 Ohýbání dřeva – formy a kopyta",
        "stav": "vyvoj",
        "tagy": ["truhlářství", "ohýbání dřeva", "laminování", "pára", "kerf", "formy", "MDF", "tisk 1:1", "DXF", "STL", "kusovník"]
      },
      {
        "soubor": "obsah/drevo_vypocty.html",
        "nazev": "🌳 Dřevo – pohyb, průhyb, povrchy",
        "stav": "vyvoj",
        "tagy": ["dřevo", "truhlářství", "vlhkost", "EMC", "sesychání", "průhyb", "police", "povrchová úprava", "lak", "olej", "řezivo", "objem"]
      },
      {
        "soubor": "obsah/sablony_frezka.html",
        "nazev": "🌀 Šablony pro horní frézku",
        "stav": "vyvoj",
        "tagy": ["frézka", "kopírovací kroužek", "šablona", "ofset", "truhlářství", "kruhové rameno", "motýlek", "DXF", "STL", "PDF 1:1"]
      },
      {
        "soubor": "obsah/navrh_skrini.html",
        "nazev": "🗄️ Návrh skříní a korpusů",
        "stav": "vyvoj",
        "tagy": ["skříň", "korpus", "nábytek", "kuchyňská linka", "DTD", "kusovník", "řezný plán", "systém 32", "závěsy", "zásuvky", "výsuvy", "konfirmát", "vrtání", "DXF", "CNC", "PDF", "3D"]
      },
      {
        "soubor": "obsah/rezny_plan.html",
        "nazev": "📏 Řezný plán – optimalizace dělení",
        "stav": "vyvoj",
        "tagy": ["truhlářství", "nábytek", "dělení desek", "optimalizace", "DTD", "MDF", "překližka", "hranování", "1D řezání", "CNC", "PDF", "štítky", "DXF"]
      },
      {
        "soubor": "obsah/ostreni.html",
        "nazev": "🔪 Ostření dlát a hoblíků – přípravky",
        "stav": "vyvoj",
        "tagy": ["ostření", "dláto", "hoblík", "honovací vozík", "3D tisk", "STL", "bruska", "truhlářství", "šablona"]
      },
      {
        "soubor": "obsah/kolikovaci_pripravky.html",
        "nazev": "🔩 Kolíkovací a kapsové přípravky",
        "stav": "vyvoj",
        "tagy": ["truhlářství", "kolíky", "pocket hole", "kapsový spoj", "konfirmát", "excentr", "přípravek", "3D tisk", "STL", "šablona", "PDF 1:1"]
      },
      {
        "soubor": "obsah/intarzie.html",
        "nazev": "🧩 Intarzie a parketáž",
        "stav": "vyvoj",
        "tagy": ["intarzie", "marketerie", "parketáž", "dýha", "rybí kost", "šachovnice", "kompasová růžice", "teselace", "Escher", "bookmatch", "řezný plán", "laser", "kerf", "SVG", "DXF", "PDF", "3D", "truhlářství"]
      },
      {
        "soubor": "obsah/prkenka.html",
        "nazev": "🔲 Prkénka a lepené vzory",
        "stav": "vyvoj",
        "tagy": ["truhlářství", "krájecí prkénko", "end grain", "šachovnice", "3D kostky", "chevron", "řezný seznam", "PDF", "DXF", "3D"]
      },
      {
        "soubor": "obsah/segmentove_soustruzeni.html",
        "nazev": "🏺 Segmentové soustružení",
        "stav": "vyvoj",
        "tagy": ["soustružení", "segmentové soustružení", "segmented turning", "mísa", "váza", "kroužky", "segmenty", "pokos", "ozdobný pás", "řezný plán", "šablona 1:1", "PDF", "DXF", "STL", "3D", "truhlářství"]
      },
      {
        "soubor": "obsah/drevene_hracky.html",
        "nazev": "🧸 Dřevěné hračky a dětský nábytek",
        "stav": "vyvoj",
        "tagy": ["hračky", "kostky", "stavebnice", "kuličková dráha", "puzzle", "lupenková pila", "zvířátka", "tahací hračka", "učící věž", "dětský nábytek", "EN 71-1", "ergonomie", "stabilita", "šablona 1:1", "PDF", "DXF", "STL", "3D"]
      },
      {
        "soubor": "obsah/pripravky_pila.html",
        "nazev": "🪚 Přípravky pro pilu a vrtačku",
        "stav": "vyvoj",
        "tagy": ["truhlářství", "stolní pila", "okružní pila", "pokosová pila", "vrtačka", "přípravky", "3D tisk", "STL", "DXF", "PDF 1:1", "kalkulačka"]
      },
      {
        "soubor": "obsah/drzaky_naradi.html",
        "nazev": "🧰 Držáky nářadí a Gridfinity",
        "stav": "vyvoj",
        "tagy": ["gridfinity", "3D tisk", "STL", "dílna", "nářadí", "French cleat", "pegboard", "truhlářství", "PDF 1:1", "kusovník"]
      },
      {
        "soubor": "obsah/oblouky_profily.html",
        "nazev": "〰️ Šablony oblouků a profilů",
        "stav": "vyvoj",
        "tagy": ["truhlářství", "oblouk", "elipsa", "parabola", "řetězovka", "spline", "pružná lať", "kabriolová noha", "kuželová noha", "soustružení", "měrka průměrů", "ogee", "profil lišty", "šablona", "tisk 1:1", "PDF", "DXF", "STL", "3D"]
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
        "stav": "beta",
        "tagy": ["úhly", "stupně", "radiány", "měřítko", "sklon"]
      },
      {
        "soubor": "obsah/ohm_calc.html",
        "nazev": "⚡ Ohmův zákon",
        "stav": "beta",
        "tagy": ["ohmův zákon", "proud", "napětí", "odpor", "výkon", "elektro"]
      },
      {
        "soubor": "obsah/number_base.html",
        "nazev": "🔢 Číselné soustavy",
        "stav": "beta",
        "tagy": ["binární", "hexadecimální", "osmičková", "soustava", "převod"]
      },
      {
        "soubor": "obsah/pressure_force.html",
        "nazev": "🔧 Tlak / síla / moment",
        "stav": "beta",
        "tagy": ["tlak", "síla", "moment", "bar", "newton", "převod"]
      },
      {
        "soubor": "obsah/triangle_calc.html",
        "nazev": "📐 Trojúhelník",
        "stav": "beta",
        "tagy": ["trojúhelník", "sinus", "kosinus", "strany", "úhly"]
      },
      {
        "soubor": "obsah/right_triangle.html",
        "nazev": "📐 Pravoúhlý trojúhelník",
        "stav": "beta",
        "tagy": ["pravoúhlý", "pythagoras", "odvěsna", "přepona", "trojúhelník"]
      },
      {
        "soubor": "obsah/beam_deflection.html",
        "nazev": "🏗️ Průhyb nosníku",
        "stav": "beta",
        "tagy": ["nosník", "průhyb", "zatížení", "statika", "ohyb"]
      },
      {
        "soubor": "obsah/statistics.html",
        "nazev": "📊 Statistika dat",
        "stav": "beta",
        "tagy": ["průměr", "medián", "směrodatná odchylka", "data", "statistika"]
      },
      {
        "soubor": "obsah/function_plot.html",
        "nazev": "📈 Kreslič grafů funkcí",
        "stav": "beta",
        "tagy": ["graf funkce", "kreslení", "matematika", "parabola", "průběh"]
      },
      {
        "soubor": "obsah/equation_solver.html",
        "nazev": "🧮 Řešič rovnic",
        "stav": "beta",
        "tagy": ["rovnice", "kvadratická", "soustava", "řešení", "kořeny"]
      }
    ]
  },
  {
    "nazev": "⚡ Energie & elektro",
    "skupina": "technika",
    "polozky": [
      {
        "soubor": "obsah/fve_kalk.html",
        "nazev": "☀️ Výroba fotovoltaiky",
        "stav": "vyvoj",
        "tagy": ["fotovoltaika", "FVE", "solár", "výroba elektřiny", "návratnost", "PVGIS", "energie"]
      },
      {
        "soubor": "obsah/tarif_spot.html",
        "nazev": "⚡ Fixní, nebo spotový tarif?",
        "stav": "vyvoj",
        "tagy": ["elektřina", "spot", "spotová cena", "OTE", "fixace", "distribuční sazba", "ERÚ", "TDD", "energie", "cena elektřiny"]
      },
      {
        "soubor": "obsah/offgrid_baterie.html",
        "nazev": "🔋 Ostrovní systém",
        "stav": "vyvoj",
        "tagy": ["off-grid", "baterie", "LiFePO4", "měnič", "solární panel", "MPPT", "chata", "průřez kabelu"]
      },
      {
        "soubor": "obsah/logic_gates.html",
        "nazev": "🔲 Simulátor logických hradel",
        "stav": "vyvoj",
        "tagy": ["logika", "hradla", "digitální obvody", "sčítačka", "klopný obvod", "pravdivostní tabulka", "elektronika"]
      },
      {
        "soubor": "obsah/cpu8.html",
        "nazev": "🧮 CPU 6502 – emulátor a assembler",
        "stav": "vyvoj",
        "tagy": ["6502", "procesor", "assembler", "emulátor", "výuka", "programování", "retro", "C64", "NES", "8bit"]
      },
      {
        "soubor": "obsah/plc.html",
        "nazev": "🏭 Simulátor PLC – Ladder",
        "stav": "vyvoj",
        "tagy": ["PLC", "automatizace", "ladder", "IEC 61131-3", "PID", "simulátor", "výuka", "elektro"]
      }
    ]
  },
  {
    "nazev": "🧪 Simulace & věda",
    "skupina": "technika",
    "polozky": [
      {
        "soubor": "obsah/evoluce.html",
        "nazev": "🧬 Evoluční laboratoř",
        "stav": "vyvoj",
        "tagy": ["biologie", "evoluce", "simulace", "genetika", "přírodní výběr", "výuka", "statistika", "experimenty", "selekční gradient"]
      },
      {
        "soubor": "obsah/epidemie.html",
        "nazev": "🦠 Simulátor epidemií",
        "stav": "vyvoj",
        "tagy": ["epidemiologie", "SIR", "SEIR", "R0", "Rt", "stochastika", "sítě", "agentový model", "věková struktura", "simulace", "výuka"]
      },
      {
        "soubor": "obsah/bunecne_automaty.html",
        "nazev": "🧫 Laboratoř buněčných automatů",
        "stav": "vyvoj",
        "tagy": ["simulace", "matematika", "game of life", "celulární automat", "wolfram", "wireworld"]
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
        "stav": "beta",
        "tagy": [
          "databáze",
          "entity",
          "schéma"
        ]
      },
      {
        "soubor": "obsah/json_formatter.html",
        "nazev": "🗂️ JSON formatter",
        "stav": "beta",
        "tagy": [
          "validátor",
          "pretty print"
        ]
      },
      {
        "soubor": "obsah/sql_formatter.html",
        "nazev": "🗄️ SQL formatter",
        "stav": "beta",
        "tagy": ["sql", "formátování", "dotaz", "databáze", "select"]
      },
      {
        "soubor": "obsah/diff_tool.html",
        "nazev": "🔀 Diff nástroj",
        "stav": "beta",
        "tagy": [
          "porovnání",
          "rozdíl",
          "text"
        ]
      },
      {
        "soubor": "obsah/live_editor.html",
        "nazev": "💻 Live HTML/CSS/JS editor",
        "stav": "beta",
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
        "stav": "beta",
        "tagy": [
          "regulární výrazy",
          "vzory"
        ]
      },
      {
        "soubor": "obsah/http_status.html",
        "nazev": "🌐 HTTP stavové kódy",
        "stav": "beta",
        "tagy": ["http", "kódy", "404", "500", "api", "reference"]
      },
      {
        "soubor": "obsah/gitignore_gen.html",
        "nazev": "🚫 .gitignore generátor",
        "stav": "beta",
        "tagy": ["git", "gitignore", "šablona", "repozitář"]
      },
      {
        "soubor": "obsah/cron_builder.html",
        "nazev": "⏰ Cron builder",
        "stav": "beta",
        "tagy": ["cron", "plánovač", "crontab", "výraz", "linux"]
      },
      {
        "soubor": "obsah/md_table.html",
        "nazev": "📋 Markdown tabulky",
        "stav": "beta",
        "tagy": ["markdown", "tabulka", "generátor", "readme"]
      },
      {
        "soubor": "obsah/keycode.html",
        "nazev": "⌨️ Keycode tester",
        "stav": "beta",
        "tagy": ["klávesy", "keycode", "javascript", "event", "test"]
      },
      {
        "soubor": "obsah/mock_data.html",
        "nazev": "🧪 Testovací data",
        "stav": "beta",
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
        "stav": "beta",
        "tagy": [
          "git",
          "příkazy",
          "verzování"
        ]
      },
      {
        "soubor": "obsah/shortcuts_reference.html",
        "nazev": "⌨️ Přehled klávesových zkratek",
        "stav": "beta",
        "tagy": ["excel", "vs code", "photoshop", "prohlížeč", "hotkeys", "kombinace kláves"]
      },
      {
        "soubor": "obsah/env_gen.html",
        "nazev": "⚙️ Generátor .env souborů",
        "stav": "beta",
        "tagy": [
          "env",
          "konfigurace",
          "docker"
        ]
      },
      {
        "soubor": "obsah/api_tester.html",
        "nazev": "🛰️ API / webhook tester",
        "stav": "beta",
        "tagy": [
          "api",
          "http",
          "webhook",
          "rest"
        ]
      },
      {
        "soubor": "obsah/git_historie.html",
        "nazev": "🌳 Historie Gitu",
        "stav": "vyvoj",
        "tagy": ["git", "vývoj", "vizualizace", "graf", "statistiky", "GitHub"]
      },
      {
        "soubor": "obsah/testovaci_data.html",
        "nazev": "🧪 Generátor testovacích dat",
        "stav": "vyvoj",
        "tagy": ["vývoj", "databáze", "SQL", "CSV", "JSON", "testování", "syntetická data"]
      },
      {
        "soubor": "obsah/sqlite.html",
        "nazev": "🗄️ SQLite – prohlížeč a editor",
        "stav": "vyvoj",
        "tagy": ["databáze", "SQL", "SQLite", "nástroje", "ER diagram", "export", "offline"]
      },
      {
        "soubor": "obsah/analyzator_logu.html",
        "nazev": "📜 Analyzátor logů",
        "stav": "vyvoj",
        "tagy": ["logy", "syslog", "nginx", "apache", "json", "regex", "analýza", "nástroje", "IT"]
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
        "stav": "beta",
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
        "stav": "beta",
        "tagy": ["uuid", "guid", "identifikátor", "náhodné id"]
      },
      {
        "soubor": "obsah/hash_gen.html",
        "nazev": "#️⃣ Hash generátor",
        "stav": "beta",
        "tagy": [
          "md5",
          "sha",
          "otisk"
        ]
      },
      {
        "soubor": "obsah/timestamp_conv.html",
        "nazev": "🕰️ Unix timestamp",
        "stav": "beta",
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
        "stav": "beta",
        "tagy": [
          "tabulka",
          "data",
          "převod"
        ]
      },
      {
        "soubor": "obsah/lorem_ipsum.html",
        "nazev": "📝 Lorem ipsum",
        "stav": "beta",
        "tagy": ["lorem ipsum", "výplňový text", "testovací data", "placeholder"]
      },
      {
        "soubor": "obsah/contrast_checker.html",
        "nazev": "🌗 Kontrast (WCAG)",
        "stav": "beta",
        "tagy": [
          "wcag",
          "přístupnost",
          "barvy"
        ]
      },
      {
        "soubor": "obsah/jwt_decoder.html",
        "nazev": "🔑 JWT decoder",
        "stav": "beta",
        "tagy": ["jwt", "token", "dekodér", "payload", "autentizace"]
      },
      {
        "soubor": "obsah/case_converter.html",
        "nazev": "🔠 Převodník case",
        "stav": "beta",
        "tagy": ["velikost písmen", "camelcase", "snake_case", "verzálky", "text"]
      },
      {
        "soubor": "obsah/slug_gen.html",
        "nazev": "🔗 Slug generátor",
        "stav": "beta",
        "tagy": ["slug", "url", "diakritika", "seo", "adresa"]
      },
      {
        "soubor": "obsah/url_builder.html",
        "nazev": "🔗 URL builder / parser",
        "stav": "beta",
        "tagy": [
          "url",
          "query string",
          "parametry"
        ]
      },
      {
        "soubor": "obsah/yaml_json.html",
        "nazev": "🔄 YAML ↔ JSON převodník",
        "stav": "beta",
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
        "stav": "beta",
        "tagy": [
          "snake",
          "hra"
        ]
      },
      {
        "soubor": "obsah/stack-attack.html",
        "nazev": "📦 Stack Attack",
        "stav": "beta",
        "tagy": ["arkáda", "bedny", "retro", "hra"]
      },
      {
        "soubor": "obsah/jump_game.html",
        "nazev": "🏃 Skákačka",
        "stav": "beta",
        "tagy": ["skákačka", "plošinovka", "platformer", "hra"]
      },
      {
        "soubor": "obsah/backwardRide.html",
        "nazev": "🚗 Couvání",
        "stav": "beta",
        "tagy": ["couvání", "vozík", "přívěs", "simulátor", "řidič"]
      },
      {
        "soubor": "obsah/retro_invaders.html",
        "nazev": "👾 Retro Invaders",
        "stav": "beta",
        "tagy": ["space invaders", "střílečka", "retro", "arkáda"]
      },
      {
        "soubor": "obsah/retro_tetris.html",
        "nazev": "🟦 Retro Tetris",
        "stav": "beta",
        "tagy": ["tetris", "kostky", "retro", "skládání"]
      },
      {
        "soubor": "obsah/retro_pacman.html",
        "nazev": "🟡 Retro Pac-Man",
        "stav": "beta",
        "tagy": ["pacman", "bludiště", "retro", "arkáda"]
      },
      {
        "soubor": "obsah/tank1990.html",
        "nazev": "🪖 Tank 1990",
        "stav": "vyvoj",
        "tagy": ["tank a 1990", "battle city", "tanky", "nes", "famiclone", "retro", "arkáda", "dva hráči", "orel", "editor map"]
      },
      {
        "soubor": "obsah/ostruvek.html",
        "nazev": "🏝️ Ostrůvek (three.js + Blender)",
        "stav": "vyvoj",
        "tagy": ["ostrov", "skřítek", "krystaly", "3d", "three.js", "blender", "gltf", "low-poly", "demo", "hra"]
      },
      {
        "soubor": "obsah/breakout.html",
        "nazev": "🧱 Breakout",
        "stav": "beta",
        "tagy": ["arkanoid", "cihly", "pálka", "míček", "arkáda"]
      },
      {
        "soubor": "obsah/pozirani_bunek.html",
        "nazev": "🦠 Požírání buněk",
        "stav": "beta",
        "tagy": ["buňky", "agar", "mikrosvět", "plankton", "přežití", "arkáda", "hra"]
      },
      {
        "soubor": "obsah/pirateers/index.html",
        "nazev": "🏴‍☠️ Pirateers",
        "stav": "beta",
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
        "stav": "beta",
        "tagy": ["obrana věží", "strategie", "vlny", "věže"]
      },
      {
        "soubor": "obsah/podzemi.html",
        "nazev": "🗡️ Nekonečné podzemí",
        "stav": "beta",
        "tagy": ["dungeon", "crawler", "roguelike", "dungeon master", "podzemí", "bludiště", "rpg", "hra"]
      },
      {
        "soubor": "obsah/tower_defense_sc.html",
        "nazev": "🛰️ Sector Defense",
        "stav": "beta",
        "tagy": ["obrana věží", "vesmír", "strategie", "sci-fi"]
      },
      {
        "soubor": "obsah/obleheni.html",
        "nazev": "🏝️ Ostrov v obležení",
        "stav": "vyvoj",
        "tagy": ["obrana věží", "tower defense", "ostrov", "lodě", "piráti", "kraken", "wyverny", "fantasy", "strategie", "procedurální mapa", "seed", "kampaň"]
      },
      {
        "soubor": "obsah/dron.html",
        "nazev": "🚁 Nad krajinou",
        "stav": "vyvoj",
        "tagy": ["dron", "simulátor", "let", "fpv", "kvadrokoptéra", "krajina", "3d", "focení", "závody", "letová škola", "vysílačka", "hra"]
      },
      {
        "soubor": "obsah/pong.html",
        "nazev": "🏓 Pong",
        "stav": "beta",
        "tagy": ["pong", "pálky", "retro", "arkáda"]
      },
      {
        "soubor": "obsah/asteroids.html",
        "nazev": "🚀 Asteroids",
        "stav": "beta",
        "tagy": ["asteroidy", "vesmír", "loď", "retro", "arkáda"]
      },
      {
        "soubor": "obsah/fps_arena.html",
        "nazev": "🔫 FPS Aréna (3D)",
        "stav": "beta",
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
        "soubor": "obsah/trpaslici.html",
        "nazev": "⛰️ Srdce hory",
        "stav": "beta",
        "tagy": ["trpaslíci", "hora", "budovatelská strategie", "kopání", "těžba", "důl", "pixel art", "boční řez", "gravitace", "dwarf fortress", "craft the world", "procedurální mapa"]
      },
      {
        "soubor": "obsah/sine.html",
        "nazev": "🏰 Síně pod horou",
        "stav": "vyvoj",
        "tagy": ["trpaslíci", "hora", "budovatelská strategie", "pohled shora", "kopání", "síně", "patra", "malovaná mapa", "dwarf fortress", "rimworld", "procedurální mapa", "obrana", "příběh"]
      },
      {
        "soubor": "obsah/dwarf_colony.html",
        "nazev": "⛏️ Trpasličí kolonie",
        "stav": "beta",
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
      },
      {
        "soubor": "obsah/cesta_rodu.html",
        "nazev": "⚜️ Cesta rodu",
        "stav": "beta",
        "tagy": [
          "idle",
          "inkrementální",
          "středověk",
          "rod",
          "generace",
          "dědictví",
          "erb",
          "hospodaření",
          "simulace života",
          "hra"
        ]
      },
      {
        "soubor": "obsah/bomberman.html",
        "nazev": "💣 Bomberman",
        "stav": "vyvoj",
        "tagy": ["hra", "arkáda", "retro", "boti", "2 hráči"]
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
        "stav": "beta",
        "tagy": [
          "tic tac toe",
          "hra"
        ]
      },
      {
        "soubor": "obsah/game_2048.html",
        "nazev": "🔢 2048",
        "stav": "beta",
        "tagy": [
          "čísla",
          "posouvání",
          "hra"
        ]
      },
      {
        "soubor": "obsah/minesweeper.html",
        "nazev": "💣 Hledání min",
        "stav": "beta",
        "tagy": [
          "miny",
          "sapér",
          "hra"
        ]
      },
      {
        "soubor": "obsah/memory_game.html",
        "nazev": "🃏 Pexeso",
        "stav": "beta",
        "tagy": [
          "pexeso",
          "paměť",
          "karty"
        ]
      },
      {
        "soubor": "obsah/sudoku.html",
        "nazev": "🔢 Sudoku",
        "stav": "beta",
        "tagy": ["sudoku", "čísla", "hlavolam", "logika"]
      },
      {
        "soubor": "obsah/wordle.html",
        "nazev": "🟩 Slovo (Wordle)",
        "stav": "beta",
        "tagy": [
          "slova",
          "hádání",
          "hra"
        ]
      },
      {
        "soubor": "obsah/sokoban.html",
        "nazev": "📦 Sokoban",
        "stav": "beta",
        "tagy": ["bedny", "hlavolam", "logika", "skladiště"]
      },
      {
        "soubor": "obsah/osmismerka.html",
        "nazev": "🔡 Osmisměrka",
        "stav": "beta",
        "tagy": ["osmisměrka", "hledání slov", "mřížka", "slovní hra"]
      },
      {
        "soubor": "obsah/scrabble.html",
        "nazev": "🔤 Scrabble",
        "stav": "beta",
        "tagy": ["scrabble", "slovní hra", "desková hra", "písmena", "kameny", "skládání slov"]
      },
      {
        "soubor": "obsah/scrabble_en.html",
        "nazev": "🔡 Scrabble anglicky",
        "stav": "beta",
        "tagy": ["scrabble", "angličtina", "english", "slovní hra", "slovíčka", "skládání slov", "výuka"]
      },
      {
        "soubor": "obsah/crossword_gen.html",
        "nazev": "🧩 Generátor křížovek",
        "stav": "beta",
        "tagy": [
          "křížovka",
          "hádanka",
          "slova"
        ]
      },
      {
        "soubor": "obsah/bingo_gen.html",
        "nazev": "🎱 Generátor bingo kartiček",
        "stav": "beta",
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
        "stav": "beta",
        "tagy": ["tabu", "slovní hra", "popis", "párty", "zakázaná slova"]
      },
      {
        "soubor": "obsah/pantomima.html",
        "nazev": "🎭 Pantomima (databanka)",
        "stav": "beta",
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
        "stav": "beta",
        "tagy": ["světla", "hlavolam", "logika", "přepínání"]
      },
      {
        "soubor": "obsah/hanoi.html",
        "nazev": "🗼 Hanojské věže",
        "stav": "beta",
        "tagy": ["hanoj", "věže", "hlavolam", "disky", "logika"]
      },
      {
        "soubor": "obsah/simon.html",
        "nazev": "🎵 Simon",
        "stav": "beta",
        "tagy": ["simon", "paměť", "sekvence", "barvy", "zvuky"]
      },
      {
        "soubor": "obsah/connect4.html",
        "nazev": "🔴 Čtyři v řadě",
        "stav": "beta",
        "tagy": ["čtyři v řadě", "connect four", "desková hra", "dva hráči"]
      },
      {
        "soubor": "obsah/battleship.html",
        "nazev": "🚢 Lodě",
        "stav": "beta",
        "tagy": ["lodě", "battleship", "námořní bitva", "mřížka"]
      },
      {
        "soubor": "obsah/rock_paper_scissors.html",
        "nazev": "✊ Kámen nůžky papír",
        "stav": "beta",
        "tagy": ["kámen nůžky papír", "hra", "náhoda"]
      },
      {
        "soubor": "obsah/hangman.html",
        "nazev": "🪢 Šibenice",
        "stav": "beta",
        "tagy": ["šibenice", "hádání slov", "slovní hra", "písmena"]
      },
      {
        "soubor": "obsah/nonogram.html",
        "nazev": "🎨 Nonogramy",
        "stav": "beta",
        "tagy": ["nonogram", "japonské křížovky", "logika", "obrázek"]
      },
      {
        "soubor": "obsah/checkers.html",
        "nazev": "♟️ Dáma",
        "stav": "beta",
        "tagy": [
          "dáma",
          "hra"
        ]
      },
      {
        "soubor": "obsah/chess.html",
        "nazev": "♟️ Šachy",
        "stav": "beta",
        "tagy": [
          "šachy",
          "hra",
          "figurky"
        ]
      },
      {
        "soubor": "obsah/solitaire.html",
        "nazev": "🃏 Solitaire",
        "stav": "beta",
        "tagy": [
          "karty",
          "klondike",
          "pasiáns"
        ]
      },
      {
        "soubor": "obsah/yahtzee.html",
        "nazev": "🎲 Kostky (Yahtzee)",
        "stav": "beta",
        "tagy": ["kostky", "yahtzee", "vrhcáby", "hod kostkou", "desková hra"]
      },
      {
        "soubor": "obsah/reversi.html",
        "nazev": "⚫ Reversi",
        "stav": "beta",
        "tagy": ["reversi", "othello", "desková hra", "kameny"]
      },
      {
        "soubor": "obsah/trivia.html",
        "nazev": "❓ Vědomostní kvíz",
        "stav": "beta",
        "tagy": ["kvíz", "vědomosti", "otázky", "test", "soutěž"]
      }
    ]
  },
  {
    "nazev": "🧠 Logické mřížky",
    "skupina": "hry",
    "polozky": [
      {
        "soubor": "obsah/queens.html",
        "nazev": "👑 Královny (Queens)",
        "stav": "beta",
        "tagy": ["queens", "královny", "dáma", "oblasti", "logika", "hlavolam", "denní hádanka"]
      },
      {
        "soubor": "obsah/akari.html",
        "nazev": "💡 Akari (Light Up)",
        "stav": "beta",
        "tagy": ["akari", "light up", "žárovky", "osvětlení", "logika", "hlavolam", "nikoli", "denní hádanka"]
      },
      {
        "soubor": "obsah/mastermind.html",
        "nazev": "🧠 Mastermind",
        "stav": "beta",
        "tagy": ["mastermind", "logik", "hádání kombinace", "barvy", "kolíčky", "dedukce", "bulls and cows"]
      },
      {
        "soubor": "obsah/hashi.html",
        "nazev": "🔗 Mosty (Hashi)",
        "stav": "beta",
        "tagy": ["hashi", "hashiwokakero", "bridges", "mosty", "ostrovy", "propojování", "logika", "hlavolam", "denní hádanka"]
      },
      {
        "soubor": "obsah/kakuro.html",
        "nazev": "🔢 Kakuro",
        "stav": "beta",
        "tagy": ["kakuro", "číselná křížovka", "součty", "čísla", "sudoku", "logika", "hlavolam", "denní hádanka"]
      },
      {
        "soubor": "obsah/nurikabe.html",
        "nazev": "🏝️ Nurikabe",
        "stav": "beta",
        "tagy": ["nurikabe", "ostrovy", "moře", "zatápění", "logika", "hlavolam", "denní hádanka"]
      },
      {
        "soubor": "obsah/slitherlink.html",
        "nazev": "⭕ Slitherlink",
        "stav": "beta",
        "tagy": ["slitherlink", "smyčka", "loop", "tečky", "čáry", "fences", "logika", "hlavolam", "denní hádanka"]
      }
    ]
  },
  {
    "nazev": "🏝️ Tropické ostrovy",
    "skupina": "hry",
    "polozky": [
      {
        "soubor": "obsah/karibik.html",
        "nazev": "🏴‍☠️ Tajemství Karibiku",
        "stav": "beta",
        "tagy": ["piráti", "poklad", "karibik", "ostrovy", "plachetnice", "mapa", "mlha", "rybaření", "explorace", "hádanka", "denní výprava"]
      },
      {
        "soubor": "obsah/trosecnici.html",
        "nazev": "🏝️ Trosečníci",
        "stav": "beta",
        "tagy": ["trosečník", "survival", "přežití", "ostrov", "tahová strategie", "pixel art", "průzkum", "mlha", "rybaření", "procedurální mapa"]
      },
      {
        "soubor": "obsah/poklad.html",
        "nazev": "🗝️ Poklad pirátů",
        "stav": "beta",
        "tagy": ["piráti", "poklad", "ostrov", "indicie", "dedukce", "logika", "hlavolam", "mapa", "denní hádanka"]
      },
      {
        "soubor": "obsah/rybar.html",
        "nazev": "🎣 Tropický rybář",
        "stav": "beta",
        "tagy": ["rybaření", "ryby", "rybář", "moře", "molo", "útes", "návnada", "atlas ryb", "relax", "tropy"]
      },
      {
        "soubor": "obsah/obchodnik.html",
        "nazev": "⚓ Pirát obchodník",
        "stav": "beta",
        "tagy": ["obchod", "piráti", "karibik", "ekonomie", "ceny", "loď", "plavba", "strategie", "taipan", "pixel art", "flotila", "vylepšení", "noc", "stará mapa", "game boy"]
      },
      {
        "soubor": "obsah/laguna.html",
        "nazev": "🐠 Laguna",
        "stav": "beta",
        "tagy": ["potápění", "šnorchlování", "ryby", "korály", "fotografie", "atlas", "podmořský svět", "relax", "moře", "mangrovy", "modrá díra", "pixel art"]
      },
      {
        "soubor": "obsah/zapad_slunce.html",
        "nazev": "🌅 Západ slunce",
        "stav": "beta",
        "tagy": ["relax", "relaxace", "západ slunce", "východ slunce", "úsvit", "bouřka", "delfíni", "pláž", "molo", "útes", "plachetnice", "mangrovy", "laguna", "moře", "vlny", "palmy", "hvězdy", "dýchání", "zvuky přírody", "usínání", "karibik", "zelený záblesk", "bioluminiscence"]
      },
      {
        "soubor": "obsah/kostky.html",
        "nazev": "🎲 Pirátské kostky",
        "stav": "beta",
        "tagy": ["kostky", "liar's dice", "perudo", "blafování", "pravděpodobnost", "piráti", "AI soupeři", "strategie", "denní výzva", "hospoda"]
      },
      {
        "soubor": "obsah/stychy.html",
        "nazev": "🃏 Štychy na palubě",
        "stav": "beta",
        "tagy": ["karty", "štychy", "odhad", "piráti", "AI soupeři", "strategie", "trumfy", "denní výzva", "tahová", "více hráčů"]
      },
      {
        "soubor": "obsah/taverna.html",
        "nazev": "🍹 Taverna v přístavu",
        "stav": "beta",
        "tagy": ["manažerská", "taverna", "hospoda", "vaření", "recepty", "piráti", "ekonomika", "časovka", "pixel art", "vylepšení", "zvěsti", "denní výzva", "přístav"]
      },
      {
        "soubor": "obsah/plantaz.html",
        "nazev": "🌴 Plantáž",
        "stav": "beta",
        "tagy": ["budovatelská", "strategie", "tahová", "ekonomika", "simulace", "farmaření", "ostrov", "počasí", "hurikány", "obchod", "pixel art", "denní výzva"]
      },
      {
        "soubor": "obsah/lodenice.html",
        "nazev": "⚓ Loděnice",
        "stav": "beta",
        "tagy": ["lodě", "plachetnice", "fyzika", "Archimédes", "stabilita", "metacentrum", "simulace", "konstrukce", "stavění", "zakázky", "polární diagram", "denní výzva"]
      },
      {
        "soubor": "obsah/navigator.html",
        "nazev": "🧭 Navigátor",
        "stav": "beta",
        "tagy": ["navigace", "sextant", "Polárka", "astronomie", "deklinace", "výpočet polohy", "mapa", "karibik", "plachetnice", "výuková", "simulace", "denní výzva"]
      },
      {
        "soubor": "obsah/lahev.html",
        "nazev": "🍾 Vzkaz v láhvi",
        "stav": "beta",
        "tagy": ["šifry", "luštění", "kryptografie", "Caesar", "morseovka", "substituce", "Vigenère", "piráti", "poklad", "mapa", "denní výzva", "logika"]
      },
      {
        "soubor": "obsah/uzly.html",
        "nazev": "🪢 Námořnické uzly",
        "stav": "beta",
        "tagy": ["hlavolam", "logika", "planarita", "rozmotávání", "uzly", "lana", "námořnictví", "atlas", "výuka", "kvíz", "denní výzva"]
      },
      {
        "soubor": "obsah/steeldrum.html",
        "nazev": "🥁 Steel drum",
        "stav": "beta",
        "tagy": ["hudba", "rytmická hra", "steel drum", "calypso", "karibik", "syntéza zvuku", "paměť", "Simon", "denní výzva", "dotyk", "klávesnice"]
      },
      {
        "soubor": "obsah/regata.html",
        "nazev": "⛵ Regata",
        "stav": "beta",
        "tagy": ["plachetnice", "regata", "závod", "vítr", "polární diagram", "křižování", "taktika", "AI soupeři", "denní výzva", "simulace", "dotykové ovládání"]
      },
      {
        "soubor": "obsah/zelvy.html",
        "nazev": "🐢 Želví pláž",
        "stav": "beta",
        "tagy": ["želvy", "mořské želvy", "pláž", "noc", "příroda", "ochrana přírody", "světelné znečištění", "pixel art", "relax", "deník", "denní výzva"]
      },
      {
        "soubor": "obsah/plaz.html",
        "nazev": "🐚 Plážový sběratel",
        "stav": "beta",
        "tagy": ["pláž", "mušle", "sběratelství", "příliv", "odliv", "Měsíc", "pixel art", "relax", "atlas", "příroda", "denní výzva"]
      },
      {
        "soubor": "obsah/zivly.html",
        "nazev": "🌋 Živly ostrova",
        "stav": "beta",
        "tagy": ["sopka", "vulkán", "erupce", "hurikán", "počasí", "karibik", "simulace", "výuková", "zeměpis", "předpověď", "evakuace", "denní výzva"]
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
        "stav": "beta",
        "tagy": ["vyšetřování", "timeline", "případ", "chronologie"]
      },
      {
        "soubor": "obsah/evidence_log.html",
        "nazev": "📦 Evidenční deník důkazů",
        "stav": "beta",
        "tagy": ["vyšetřování", "chain of custody", "důkazy", "evidence"]
      },
      {
        "soubor": "obsah/investigation_checklist.html",
        "nazev": "✅ Kontrolní seznamy vyšetřování",
        "stav": "beta",
        "tagy": ["vyšetřování", "checklist", "ohledání", "výslech", "nehoda"]
      },
      {
        "soubor": "obsah/protocol_gen.html",
        "nazev": "📝 Generátor protokolů",
        "stav": "beta",
        "tagy": ["vyšetřování", "protokol", "ohledání", "výslech", "zajištění věci"]
      },
      {
        "soubor": "obsah/interview_questions.html",
        "nazev": "🎙️ Generátor otázek k výslechu",
        "stav": "beta",
        "tagy": ["vyšetřování", "výslech", "svědek", "poškozený", "podezřelý", "pohovor"]
      },
      {
        "soubor": "obsah/vazby_analyza.html",
        "nazev": "🕸️ Analýza vazeb",
        "stav": "vyvoj",
        "tagy": ["vyšetřování", "graf vazeb", "link analysis", "centralita", "nejkratší cesta", "CSV"]
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
        "stav": "beta",
        "tagy": ["forenzní", "hash", "sha256", "otisk", "integrita"]
      },
      {
        "soubor": "obsah/file_signature.html",
        "nazev": "🔎 Identifikace typu souboru",
        "stav": "beta",
        "tagy": ["forenzní", "magic bytes", "hlavička souboru", "falešná přípona"]
      },
      {
        "soubor": "obsah/vin_decoder.html",
        "nazev": "🚗 Dekodér VIN",
        "stav": "beta",
        "tagy": ["vozidlo", "vin", "identifikační číslo", "wmi"]
      },
      {
        "soubor": "obsah/sifry.html",
        "nazev": "🔏 Šifry – kryptologická dílna",
        "stav": "vyvoj",
        "tagy": ["šifra", "Caesar", "Vigenère", "Enigma", "Morseovka", "frekvenční analýza", "kryptografie", "kryptoanalýza", "luštění", "výzva", "hra", "transpozice", "substituce",
          "afinní", "Beaufort", "Playfair", "Bifid", "ADFGVX", "Hill", "Bacon", "plotová šifra", "Base64", "hash", "SHA-256", "MD5", "HMAC", "AES", "RSA", "teorie čísel", "XOR", "index koincidence", "Kasiski", "CyberChef", "recept",
          "šifrovačky", "zednářská šifra", "pigpen", "A1Z26", "ťukací kód", "Braille", "semafor", "čtyřčtverec", "Trifid", "nihilistická", "Myszkowski", "skytale", "Chaocipher", "luštění bez klíče",
          "crib", "známý otevřený text", "Turingova bomba", "M-209", "Lorenz", "Tunny", "Jeffersonův válec", "deník", "hex výpis", "kampaň", "šifra dne", "Voynichův rukopis", "Bealovy šifry", "Zodiac", "Kryptos"]
      }
    ]
  },
  {
    "nazev": "🔬 Forenzní výpočty",
    "skupina": "vysetrovani",
    "polozky": [
      {
        "soubor": "obsah/brzdna_draha.html",
        "nazev": "🚗 Rychlost z brzdné stopy",
        "stav": "vyvoj",
        "tagy": ["nehoda", "brzdná dráha", "rychlost", "součinitel tření", "dráha zastavení"]
      },
      {
        "soubor": "obsah/doba_smrti.html",
        "nazev": "🌡️ Odhad doby smrti",
        "stav": "vyvoj",
        "tagy": ["soudní lékařství", "Henssge", "nomogram", "posmrtné skvrny", "ztuhlost"]
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
        "stav": "beta",
        "tagy": ["zákon", "paragraf", "trestní zákoník", "skutková podstata"]
      },
      {
        "soubor": "obsah/scene_sketch.html",
        "nazev": "📐 Náčrt místa činu",
        "stav": "beta",
        "tagy": ["místo činu", "plánek", "skica", "měřítko", "značky důkazů", "kóty", "půdorys", "fotka jako podklad", "fotopozice", "kriminalistika"]
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
        "stav": "beta",
        "tagy": ["vaření", "recept", "porce", "přepočet množství", "ingredience"]
      },
      {
        "soubor": "obsah/kvasek_chleb.html",
        "nazev": "🍞 Kvásek a chleba",
        "stav": "beta",
        "tagy": ["kvásek", "chléb", "pečení", "pekařská procenta", "hydratace", "kvas", "žitný", "sourdough", "krmení kvásku"]
      },
      {
        "soubor": "obsah/kuchynske_miry.html",
        "nazev": "🥄 Kuchyňské míry podle suroviny",
        "stav": "beta",
        "tagy": ["hrnek", "lžíce", "lžička", "gramy", "převod", "mouka", "cukr", "cup", "forma na dort", "trouba", "droždí"]
      },
      {
        "soubor": "obsah/fermentace.html",
        "nazev": "🫙 Fermentace a zavařování",
        "stav": "beta",
        "tagy": ["kvašení", "kysané zelí", "okurky", "solanka", "sterilace", "zavařování", "nálev", "kompot", "kimči", "ocet"]
      },
      {
        "soubor": "obsah/peceni_masa.html",
        "nazev": "🥩 Pečení a uzení masa",
        "stav": "vyvoj",
        "tagy": ["maso", "pečeně", "teplota jádra", "propečení", "steak", "sous-vide", "uzení", "udírna", "gril", "časovač", "drůbež", "zvěřina"]
      },
      {
        "soubor": "obsah/kava_pomery.html",
        "nazev": "☕ Kávové poměry",
        "stav": "vyvoj",
        "tagy": ["káva", "espresso", "V60", "pour-over", "french press", "AeroPress", "moka", "cold brew", "poměr", "mletí", "barista", "časovač"]
      },
      {
        "soubor": "obsah/prepocet_receptu.html",
        "nazev": "🔁 Přepočet receptu",
        "stav": "vyvoj",
        "tagy": ["recept", "porce", "přepočet", "forma na dort", "plech", "hrnky", "lžíce", "cup", "oz", "zlomky", "vejce", "škálování"]
      },
      {
        "soubor": "obsah/sezonni_potraviny.html",
        "nazev": "🍎 Sezónní kalendář potravin",
        "stav": "vyvoj",
        "tagy": ["sezóna", "sezónní", "zelenina", "ovoce", "houby", "bylinky", "zvěřina", "ryby", "nákup", "kalendář", "lokální", "co vařit"]
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
        "stav": "beta",
        "tagy": ["plná moc", "výpověď z nájmu", "půjčka", "reklamace", "smlouva"]
      }
    ]
  },
  {
    "nazev": "⚖️ Právní výpočty",
    "skupina": "dokumenty",
    "polozky": [
      {
        "soubor": "obsah/dedicke_podily.html",
        "nazev": "⚖️ Dědické podíly",
        "stav": "beta",
        "tagy": ["dědictví", "dědická třída", "zákonná posloupnost", "pozůstalost", "sjm", "povinný díl", "občanský zákoník", "závěť"]
      },
      {
        "soubor": "obsah/lhuty_uroky.html",
        "nazev": "⚖️ Lhůty a úroky z prodlení",
        "stav": "vyvoj",
        "tagy": ["úrok z prodlení", "repo sazba", "ČNB", "lhůta", "OSŘ", "správní řád", "svátky", "Velikonoce", "fikce doručení", "pracovní dny"]
      },
      {
        "soubor": "obsah/nezabavitelna_castka.html",
        "nazev": "💸 Nezabavitelná částka (exekuce)",
        "stav": "vyvoj",
        "tagy": ["exekuce", "srážky ze mzdy", "nezabavitelná částka", "přednostní pohledávka", "insolvence", "OSŘ 279", "životní minimum", "2026"]
      },
      {
        "soubor": "obsah/vyzivne.html",
        "nazev": "👨‍👧 Orientační výživné",
        "stav": "vyvoj",
        "tagy": ["výživné", "alimenty", "tabulka MSp", "střídavá péče", "dítě", "rozvod", "kontrolní částka"]
      },
      {
        "soubor": "obsah/soudni_poplatky.html",
        "nazev": "🏛️ Soudní poplatky",
        "stav": "vyvoj",
        "tagy": ["soudní poplatek", "sazebník", "žaloba", "platební rozkaz", "odvolání", "dovolání", "rozvod", "katastr", "notář", "549/1991"]
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
        "stav": "beta",
        "tagy": ["bible", "plán čtení", "verše", "zapamatování", "studijní deník", "víra"]
      },
      {
        "soubor": "obsah/tarot_reading.html",
        "nazev": "🔮 Výklad karet",
        "stav": "beta",
        "tagy": ["tarot", "karty", "výklad", "arkána", "věštění", "deník výkladů"]
      },
      {
        "soubor": "obsah/pagan_rituals.html",
        "nazev": "🌿 Pohanské svátky a rituály",
        "stav": "beta",
        "tagy": ["keltové", "vikingové", "slované", "baltové", "řekové", "římané", "egypťané", "šintoismus", "jorubové", "aztékové", "kolo roku", "samhain", "yule", "blót", "svátky", "rituály"]
      }
    ]
  },
  {
    "nazev": "🏛️ Dějiny",
    "skupina": "ostatni",
    "polozky": [
      {
        "soubor": "obsah/casova_osa.html",
        "nazev": "🏛️ Historická časová osa",
        "stav": "beta",
        "tagy": ["historie", "dějepis", "chronologie", "timeline", "časová osa", "civilizace", "srovnání", "starověk", "středověk", "světové války", "kosmonautika", "juliánský kalendář", "panovníci", "osobnosti"]
      },
      {
        "soubor": "obsah/voynich.html",
        "nazev": "📜 Voynichův rukopis",
        "stav": "vyvoj",
        "tagy": ["voynich", "rukopis", "manuskript", "šifra", "nerozluštěné", "eva", "přepis", "transliterace", "středověk", "rudolf ii", "hořčický", "kryptologie", "lingvistika", "entropie", "zipf", "kwic", "yale", "beinecke"]
      }
    ]
  },
  {
    "nazev": "✉️ Ostatní",
    "skupina": "ostatni",
    "polozky": [
      {
        "soubor": "obsah/valka_ukrajina.html",
        "nazev": "🇺🇦 Vývoj války na Ukrajině",
        "stav": "vyvoj",
        "tagy": ["ukrajina", "válka", "rusko", "isw", "fronta", "mapa fronty", "okupace", "deepstate", "oryx", "ztráty", "osn", "uprchlíci", "zprávy"]
      },
      {
        "soubor": "obsah/contact_page.html",
        "nazev": "Kontakt",
        "stav": "beta",
        "tagy": ["kontakt", "e-mail", "napište nám", "autor"]
      },
      {
        "soubor": "obsah/about.html",
        "nazev": "ℹ️ O projektu",
        "stav": "beta",
        "tagy": [
          "changelog",
          "statistiky",
          "github"
        ]
      }
    ]
  }
];


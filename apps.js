// Katalog aplikací – jediný zdroj pravdy pro menu, hledání a dashboard.
// Přidání aplikace = jeden záznam v poli `polozky` příslušné sekce.
// `tagy` jsou volitelná klíčová slova pro hledání (aliasy).
// `stav` je fáze vývoje stránky: 'vyvoj' (nová, autor ji ještě nezkontroloval),
// 'beta' (zkontrolovaná) nebo 'stable' (autor ji uznal za hotovou).
// Každá nově přidaná stránka začíná jako 'vyvoj'; dál ji posouvá jen autor.
// `jen_cs: true` = stránka se nepřekládá (česká legislativa, normy, banky) – v jiném jazyce má štítek „CZ“.
const KATALOG_STAVY = [
  { id: 'vyvoj',  label: 'Vývoj',  popis: 'Ve vývoji – zatím neprošlo kontrolou autora' },
  { id: 'beta',   label: 'Beta',   popis: 'Zkontrolováno autorem, ještě se může měnit' },
  { id: 'stable', label: 'Stable', popis: 'Hotová, ověřená verze' },
];

const KATALOG_SKUPINY = [
  { id: 'produktivita', label: '🗂️ Produktivita' },
  { id: 'zdravi',       label: '🩺 Zdraví' },
  { id: 'vareni',       label: '🍳 Vaření & recepty' },
  { id: 'priroda',      label: '🌿 Příroda & venku' },
  { id: 'tvorba',       label: '🎨 Tvorba & média' },
  { id: 'technika',     label: '📐 Technika' },
  { id: '3d',           label: '🧊 3D' },
  { id: 'vyvoj',        label: '💻 Vývoj & data' },
  { id: 'hry',          label: '🎮 Hry' },
  { id: 'vysetrovani',  label: '🕵️ Vyšetřování' },
  { id: 'dokumenty',    label: '📜 Právo & dokumenty' },
  { id: 'formulare',    label: '📋 Formuláře & tiskopisy' },
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
        "popis": "Píše Markdown s náhledem a ukládá dokumenty v prohlížeči",
        "stav": "beta",
        "tagy": [
          "poznámky",
          "text",
          "psaní"
        ]
      },
      {
        "soubor": "obsah/skriptorium.html",
        "nazev": "📖 Skriptorium (tvůrce knih)",
        "popis": "Píše knihu po kapitolách s obálkou, poznámkami a exportem do EPUB",
        "stav": "beta",
        "tagy": [
          "kniha",
          "epub",
          "publikace",
          "book creator"
        ]
      },
      {
        "soubor": "obsah/sazba.html",
        "nazev": "📐 Sazba knihy (PDF k tisku)",
        "popis": "Vysází knihu do PDF k tisku s obálkou, obsahem a spadávkou",
        "stav": "beta",
        "tagy": ["sazba", "kniha", "pdf", "tisk", "typografie", "a5", "obálka", "obsah", "čísla stran", "záhlaví", "spadávka", "markdown", "paged media", "self-publishing", "brožura", "skriptorium"]
      },
      {
        "soubor": "obsah/predcitac.html",
        "nazev": "🔊 Předčítač (neuronové hlasy)",
        "popis": "Čte text nahlas neuronovými hlasy, i offline a do WAV",
        "stav": "beta",
        "tagy": ["předčítání", "čtení nahlas", "tts", "text na řeč", "hlas", "piper", "audiokniha", "markdown", "zamčená obrazovka", "ipad", "offline", "wav"]
      },
      {
        "soubor": "obsah/hlasy.html",
        "nazev": "🧬 Dílna hlasů (syntetické hlasy)",
        "popis": "Upraví výšku a barvu hlasu nebo vytvoří nový syntetický hlas",
        "stav": "vyvoj",
        "tagy": ["hlas", "tts", "text na řeč", "syntéza řeči", "piper", "úprava hlasu", "změna hlasu", "výška", "formanty", "šepot", "robot", "formantová syntéza", "klonování hlasu", "xtts", "wav"]
      },
      {
        "soubor": "obsah/print_editor.html",
        "nazev": "🖨️ Editor pro tisk a export",
        "popis": "Vyčistí text zkopírovaný z webu a vytiskne ho nebo exportuje",
        "stav": "beta",
        "tagy": ["tisk", "markdown", "export", "html editor", "wysiwyg", "formátování"]
      },
      {
        "soubor": "obsah/md_html.html",
        "nazev": "📝 Markdown ↔ HTML",
        "popis": "Převádí Markdown na HTML a zpět s živým náhledem",
        "stav": "beta",
        "tagy": ["markdown", "html", "převod", "konverze", "readme"]
      },
      {
        "soubor": "obsah/md_dokument.html",
        "nazev": "📄 Markdown → DOCX / ODT",
        "popis": "Převede Markdown do Wordu nebo LibreOffice i s obrázky a tabulkami",
        "stav": "beta",
        "tagy": ["markdown", "word", "docx", "odt", "odf", "doc", "libreoffice", "převod", "konverze", "dokument"]
      },
      {
        "soubor": "obsah/brainstorm.html",
        "nazev": "💡 Brainstorm",
        "popis": "Kartičky s nápady na volném plátně, posun a přiblížení",
        "stav": "beta",
        "tagy": [
          "nápady",
          "myšlenková mapa"
        ]
      },
      {
        "soubor": "obsah/mapa_souvislosti.html",
        "nazev": "🕸️ Mapa souvislostí",
        "popis": "Kreslí síť pojmů, lidí a událostí s typy vztahů a analýzou",
        "stav": "vyvoj",
        "tagy": ["mapa souvislostí", "pojmová mapa", "concept map", "znalostní graf", "graf", "uzly", "vztahy", "myšlenková mapa", "časová osa", "dějiny", "výuka", "export svg", "json", "analýza sítě", "centralita", "komunity", "skupiny", "prezentace", "graphml", "gexf", "csv", "graphviz", "mermaid", "wikipedie", "kumu", "obsidian canvas"]
      },
      {
        "soubor": "obsah/notes_graph.html",
        "nazev": "🕸️ Zettelkasten (propojené poznámky)",
        "popis": "Poznámky propojené odkazy [[název]] a zobrazené jako graf",
        "stav": "beta",
        "tagy": [
          "zettelkasten",
          "wiki",
          "odkazy",
          "graf poznámek"
        ]
      },
      {
        "soubor": "obsah/flowchart.html",
        "nazev": "🔀 Editor diagramů",
        "popis": "Kreslí vývojové diagramy a schémata procesů, export do SVG",
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
        "soubor": "obsah/prompty.html",
        "nazev": "🤖 Databanka promptů",
        "popis": "Ukládá a třídí prompty pro AI se šablonami a proměnnými",
        "stav": "vyvoj",
        "tagy": ["prompt", "AI", "ChatGPT", "Claude", "umělá inteligence", "šablony", "proměnné", "knihovna promptů"]
      },
      {
        "soubor": "obsah/cvGen.html",
        "nazev": "📄 Životopis",
        "popis": "Sestaví životopis podle šablony, s verzemi a exportem do PDF",
        "stav": "beta",
        "tagy": [
          "cv",
          "resume",
          "zaměstnání"
        ]
      },
      {
        "soubor": "obsah/name_gen.html",
        "nazev": "🎲 Generátor jmen",
        "popis": "Vymyslí jméno osoby, postavy, mazlíčka, firmy či obce",
        "stav": "beta",
        "tagy": ["jména", "přezdívka", "postava", "náhodné jméno", "fantasy"]
      },
      {
        "soubor": "obsah/word_gen.html",
        "nazev": "🔤 Generátor a hledání slov",
        "popis": "Vymýšlí pseudoslova na názvy a hledá slova ve slovníku podle vzoru",
        "stav": "beta",
        "tagy": ["vymyšlená slova", "pseudoslova", "název projektu", "značka", "brand", "dvojice slov", "náhodné slovo", "fantasy",
                 "hledání slov", "slovník", "český slovník", "anglický slovník", "slova obsahující", "křížovky", "osmisměrka", "scrabble pomocník", "přesmyčky"]
      },
      {
        "soubor": "obsah/word_counter.html",
        "nazev": "🔡 Počítadlo slov",
        "popis": "Spočítá slova, znaky, věty a dobu čtení textu",
        "stav": "beta",
        "tagy": ["počet slov", "znaky", "délka textu", "statistika textu"]
      },
      {
        "soubor": "obsah/redakce.html",
        "nazev": "🔎 Redakční lupa rukopisu",
        "popis": "Najde v rukopisu opakování, dlouhé věty, vatu a trpný rod",
        "stav": "vyvoj",
        "jen_cs": true,
        "tagy": ["redakce", "rukopis", "korektura", "styl", "opakování slov", "dlouhé věty", "vata", "trpný rod", "přímá řeč", "čtivost", "doba čtení", "postavy", "román", "povídka", "markdown", "psaní", "kniha"]
      },
      {
        "soubor": "obsah/nastenka_scen.html",
        "nazev": "🗂️ Nástěnka scén (plánovač zápletky)",
        "popis": "Plánuje zápletku na kartičkách scén s postavami a křivkou napětí",
        "stav": "vyvoj",
        "tagy": ["scény", "zápletka", "osnova", "román", "kniha", "psaní", "plánování", "korková tabule", "kartičky", "kapitoly", "dějství", "tři dějství", "hrdinova cesta", "save the cat", "sedm bodů", "časová osa", "postavy", "pov", "napětí", "gradace", "markdown", "rukopis", "počet slov"]
      }
    ]
  },
  {
    "nazev": "📄 PDF & skeny",
    "skupina": "produktivita",
    "polozky": [
      {
        "soubor": "obsah/pdf_dilna.html",
        "nazev": "📄 PDF dílna",
        "popis": "Spojí, rozdělí, otočí a podepíše PDF nebo z obrázků udělá PDF",
        "stav": "vyvoj",
        "tagy": ["pdf", "spojit pdf", "rozdělit pdf", "sloučit", "přeřadit stránky", "otočit stránky", "smazat stránky", "obrázky do pdf", "jpg do pdf", "vodoznak", "číslování stránek", "záhlaví", "zápatí", "podpis", "razítko", "ořez", "a4", "metadata", "zmenšit pdf", "komprese", "zip", "offline"]
      },
      {
        "soubor": "obsah/ocr.html",
        "nazev": "🔍 OCR – text z obrázku a skenu",
        "popis": "Přečte text z fotky či skenu a udělá prohledávatelné PDF",
        "stav": "vyvoj",
        "tagy": ["ocr", "rozpoznání textu", "sken", "pdf", "prohledávatelné pdf", "tesseract", "fotka", "přepis"]
      },
      {
        "soubor": "obsah/skener.html",
        "nazev": "📄 Skener dokumentů",
        "popis": "Naskenuje dokument kamerou, srovná perspektivu a uloží do PDF",
        "stav": "vyvoj",
        "tagy": ["skener", "sken", "skenování", "kamera", "fotka dokumentu", "perspektiva", "ořez", "detekce okrajů", "černobílý sken", "pdf", "jpg", "png", "více stránek", "ocr", "offline"]
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
        "popis": "Měsíční kalendář pro zápis událostí s časem a popisem",
        "stav": "beta",
        "tagy": [
          "diář",
          "události",
          "svátky"
        ]
      },
      {
        "soubor": "obsah/todo.html",
        "nazev": "✅ Úkoly",
        "popis": "Seznam úkolů s prioritami, termíny a statistikami",
        "stav": "beta",
        "tagy": [
          "seznam",
          "to-do",
          "checklist"
        ]
      },
      {
        "soubor": "obsah/kanban.html",
        "nazev": "📋 Kanban tabule",
        "popis": "Úkoly ve sloupcích Úkoly, Probíhá a Hotovo s přetahováním",
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
        "popis": "Strom projektů a stránek s úkoly, exportem a importem",
        "stav": "beta",
        "tagy": [
          "projekty",
          "úkoly",
          "gantt"
        ]
      },
      {
        "soubor": "obsah/habit_tracker.html",
        "nazev": "🎯 Sledování návyků",
        "popis": "Odškrtává denní návyky a ukazuje série splněných dní",
        "stav": "beta",
        "tagy": ["návyky", "denní rutina", "série", "streak", "sebekázeň"]
      },
      {
        "soubor": "obsah/pomodoro.html",
        "nazev": "🍅 Pomodoro",
        "popis": "Střídá 25 minut práce a pauzy, vede záznam relací",
        "stav": "beta",
        "tagy": [
          "časovač",
          "soustředění",
          "produktivita"
        ]
      },
      {
        "soubor": "obsah/timers.html",
        "nazev": "⏲️ Stopky & časovače",
        "popis": "Stopky s mezičasy a několik minutek najednou",
        "stav": "beta",
        "tagy": ["stopky", "časovač", "minutka", "pomodoro", "intervaly"]
      },
      {
        "soubor": "obsah/countdown.html",
        "nazev": "⏳ Odpočet do události",
        "popis": "Ukazuje, kolik dní a hodin zbývá do svatby či dovolené",
        "stav": "beta",
        "tagy": ["odpočet", "kolik zbývá", "termín", "událost", "svatba", "dovolená"]
      },
      {
        "soubor": "obsah/meeting_notes.html",
        "nazev": "🗒️ Zápis z porady",
        "popis": "Agenda, body jednání a úkoly s termíny, tisk do PDF",
        "stav": "beta",
        "tagy": [
          "agenda",
          "porada",
          "schůzka",
          "úkoly"
        ]
      },
      {
        "soubor": "obsah/timesheet.html",
        "nazev": "⏱️ Docházka / evidence hodin",
        "popis": "Týdenní výkaz odpracovaných hodin se součty a exportem do CSV",
        "stav": "beta",
        "tagy": [
          "docházka",
          "výkaz",
          "hodiny",
          "fakturace"
        ]
      },
      {
        "soubor": "obsah/rozhodovani.html",
        "nazev": "⚖️ Vícekriteriální rozhodování",
        "popis": "Porovná varianty podle více kritérií metodami AHP, TOPSIS aj.",
        "stav": "vyvoj",
        "tagy": ["rozhodování", "rozhodovací matice", "AHP", "TOPSIS", "PROMETHEE", "vážený součet", "VIKOR", "průvodce", "Monte Carlo", "citlivostní analýza", "kritéria", "váhy", "decision_matrix"]
      },
      {
        "soubor": "obsah/calendar_print.html",
        "nazev": "🗓️ Tisknutelný kalendář",
        "popis": "Vytiskne roční nebo měsíční kalendář se svátky a čísly týdnů",
        "stav": "beta",
        "tagy": ["kalendář", "tisk", "měsíční plánovač", "rok"]
      },
      {
        "soubor": "obsah/world_clock.html",
        "nazev": "🕐 Světové hodiny",
        "popis": "Aktuální čas ve vybraných městech a časových pásmech",
        "stav": "beta",
        "tagy": [
          "časová pásma",
          "čas",
          "hodiny"
        ]
      },
      {
        "soubor": "obsah/time_calc.html",
        "nazev": "⏱️ Kalkulačka času",
        "popis": "Sčítá časy, počítá odpracované hodiny a rozdíl mezi daty",
        "stav": "beta",
        "tagy": ["sčítání času", "rozdíl časů", "hodiny", "minuty", "výpočet času"]
      },
      {
        "soubor": "obsah/date_calc.html",
        "nazev": "📅 Kalkulačka datumů",
        "popis": "Počet dní a pracovních dní mezi daty, přičítání dnů, svátky ČR",
        "stav": "beta",
        "tagy": [
          "dny",
          "pracovní dny",
          "svátky",
          "datum"
        ]
      },
      {
        "soubor": "obsah/rodinny_rozvrh.html",
        "nazev": "👨‍👩‍👧 Rodinný rozvrh",
        "popis": "Týdenní plán rodiny s kroužky, odvozy a hlídáním kolizí",
        "stav": "vyvoj",
        "tagy": ["rozvrh", "rodina", "kroužky", "škola", "odvozy", "vyzvedávání", "kolize", "týden", "kalendář", "ics", "lednice", "tisk"]
      }
    ]
  },
  {
    "nazev": "💰 Finance & domácnost",
    "skupina": "produktivita",
    "polozky": [
      {
        "soubor": "obsah/expense_tracker.html",
        "nazev": "💰 Sledování výdajů",
        "popis": "Zapisuje příjmy a výdaje po kategoriích a hlídá rozpočet",
        "stav": "beta",
        "tagy": [
          "rozpočet",
          "peníze",
          "útrata"
        ]
      },
      {
        "soubor": "obsah/majetek.html",
        "nazev": "📦 Evidence domácího majetku",
        "popis": "Soupis věcí v domácnosti se zárukami, účtenkami a QR štítky",
        "stav": "beta",
        "tagy": ["domácnost", "záruky", "inventář", "QR štítky", "offline", "záloha", "půjčit", "půjčky", "výpůjčky", "půjčené věci", "zapůjčení", "vrácení", "kauce", "komu jsem půjčil"]
      },
      {
        "soubor": "obsah/udrzba.html",
        "nazev": "🔧 Domácí údržba a revize",
        "popis": "Hlídá servis kotle, filtry, kominíka a STK s plánem na rok",
        "stav": "vyvoj",
        "tagy": ["údržba", "revize", "kominík", "kotel", "STK", "filtry", "detektor kouře", "připomínky", "kalendář", "servis"]
      },
      {
        "soubor": "obsah/terminy.html",
        "nazev": "📅 Hlídač termínů – záruky, prohlídky, očkování",
        "popis": "Hlídá záruky, prohlídky, očkování a platnost dokladů rodiny",
        "stav": "vyvoj",
        "jen_cs": true,
        "tagy": ["záruka", "záruky", "preventivní prohlídka", "zubař", "gynekolog", "očkování", "přeočkování", "tetanus", "klíšťata", "kontrola u lékaře", "doklady", "platnost", "občanský průkaz", "pas", "pes", "vzteklina", "připomínky", "kalendář", "rodina"]
      },
      {
        "soubor": "obsah/zasoby.html",
        "nazev": "📦 Zásoby spíže a mrazáku",
        "popis": "Eviduje zásoby v lednici a spíži s daty spotřeby a nákupem",
        "stav": "vyvoj",
        "tagy": ["zásoby", "spíž", "mrazák", "lednice", "potraviny", "datum spotřeby", "nákupní seznam", "EAN", "čárový kód", "domácnost", "plýtvání"]
      },
      {
        "soubor": "obsah/predplatne.html",
        "nazev": "💳 Správce předplatných",
        "popis": "Přehled předplatných a pravidelných plateb s kalendářem obnov",
        "stav": "vyvoj",
        "tagy": ["předplatné", "streaming", "software", "pojištění", "náklady", "obnova", "kalendář", "ics", "domácnost", "finance", "rozpočet"]
      },
      {
        "soubor": "obsah/odecty.html",
        "nazev": "🔌 Domácí odečty",
        "popis": "Zapisuje stavy měřáků elektřiny, vody a plynu s grafy spotřeby",
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
        "soubor": "obsah/car_tracker.html",
        "nazev": "🚗 Spotřeba auta",
        "popis": "Zapisuje tankování a počítá spotřebu a náklady na kilometr",
        "stav": "beta",
        "tagy": [
          "benzín",
          "nafta",
          "tankování",
          "palivo"
        ]
      },
      {
        "soubor": "obsah/pneumatiky.html",
        "nazev": "🛞 Kalkulačka pneumatik a disků",
        "popis": "Rozluští značení pneumatik, porovná rozměry a spočítá disky",
        "stav": "vyvoj",
        "tagy": ["pneumatiky", "disky", "auto", "rozměr", "tachometr", "ET", "rozteč", "DOT", "index nosnosti", "zimní pneumatiky", "tlak", "kalkulačka"]
      },
      {
        "soubor": "obsah/shopplanner.html",
        "nazev": "🛒 Plánovač nákupů",
        "popis": "Porovnává produkty před nákupem i s finanční rozvahou",
        "stav": "beta",
        "tagy": [
          "nákupní seznam",
          "obchod"
        ]
      },
      {
        "soubor": "obsah/loan_calc.html",
        "nazev": "🏦 Úvěr & hypotéka",
        "popis": "Spočítá splátku, umořovací plán a kolik si můžete půjčit",
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
        "popis": "Rozdělí splátku hypotéky podle vlastních vkladů obou partnerů",
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
        "popis": "Kolik naspoříte se složeným úročením a kolik odkládat na cíl",
        "stav": "beta",
        "tagy": [
          "úrok",
          "investice",
          "složené úročení"
        ]
      },
      {
        "soubor": "obsah/tco.html",
        "nazev": "💰 Celkové náklady vlastnictví (TCO)",
        "popis": "Porovná, kolik varianty stojí za celou dobu používání",
        "stav": "vyvoj",
        "tagy": ["kalkulačka", "finance", "ekonomika", "porovnání", "energie", "úvěr", "grafy"]
      },
      {
        "soubor": "obsah/inflace.html",
        "nazev": "📉 Inflační kalkulačka ČR",
        "popis": "Přepočítá částku z minulých let na dnešní ceny podle ČSÚ",
        "stav": "beta",
        "tagy": ["inflace", "kupní síla", "čsú", "znehodnocení", "přepočet", "reálná mzda", "ceny v minulosti", "koruna"]
      },
      {
        "soubor": "obsah/net_salary.html",
        "nazev": "💵 Čistá mzda ČR",
        "popis": "Spočítá čistou mzdu a náklady zaměstnavatele pro rok 2026",
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
        "soubor": "obsah/davky.html",
        "nazev": "🤱 Nemocenská, PPM a rodičovský příspěvek",
        "popis": "Spočítá nemocenskou, mateřskou, otcovskou a rodičovský příspěvek",
        "stav": "vyvoj",
        "jen_cs": true,
        "tagy": ["nemocenská", "náhrada mzdy", "mateřská", "PPM", "peněžitá pomoc v mateřství", "rodičovský příspěvek", "rodičovská", "otcovská", "ošetřovné", "denní vyměřovací základ", "DVZ", "redukční hranice", "OSSZ", "dávky", "kalkulačka"]
      },
      {
        "soubor": "obsah/osvc.html",
        "nazev": "🧾 OSVČ: paušální daň vs. výdaje",
        "popis": "Porovná paušální daň, výdajový paušál a skutečné výdaje OSVČ",
        "stav": "vyvoj",
        "jen_cs": true,
        "tagy": ["osvč", "paušální daň", "výdajový paušál", "skutečné výdaje", "sociální pojištění", "zdravotní pojištění", "daň z příjmů", "DPP", "DPČ", "živnost", "kalkulačka"]
      },
      {
        "soubor": "obsah/konec_pp.html",
        "nazev": "📤 Konec pracovního poměru",
        "popis": "Spočítá výpovědní dobu, odstupné a proplacení dovolené",
        "stav": "vyvoj",
        "jen_cs": true,
        "tagy": ["výpověď", "výpovědní doba", "odstupné", "dovolená", "zákoník práce", "flexinovela", "dohoda", "zkušební doba", "úřad práce", "kalkulačka", "lhůty"]
      },
      {
        "soubor": "obsah/prace.html",
        "nazev": "💼 Volná místa",
        "popis": "Hledá volná místa z úřadu práce podle mzdy, oboru a mapy",
        "stav": "vyvoj",
        "jen_cs": true,
        "tagy": ["práce", "volná místa", "nabídka práce", "zaměstnání", "úřad práce", "brigáda", "hledám práci", "mzda", "plat", "DPP", "DPČ", "inzeráty", "mapa", "dojíždění", "MPSV"]
      },
      {
        "soubor": "obsah/invoice_gen.html",
        "nazev": "🧾 Faktura / nabídka",
        "popis": "Vystaví fakturu, zálohovou fakturu nebo cenovou nabídku k tisku",
        "stav": "beta",
        "tagy": [
          "účet",
          "objednávka",
          "fakturace"
        ]
      },
      {
        "soubor": "obsah/dph_calc.html",
        "nazev": "🧾 Kalkulačka DPH",
        "popis": "Přepočítá cenu s DPH a bez DPH podle českých sazeb",
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
        "popis": "Spočítá marži, přirážku a prodejní cenu a nesplete je",
        "stav": "beta",
        "tagy": ["marže", "přirážka", "markup", "cenotvorba", "prodejní cena"]
      },
      {
        "soubor": "obsah/currency_conv.html",
        "nazev": "💱 Měnový převodník",
        "popis": "Převádí měny podle denních kurzů ČNB, funguje i offline",
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
        "popis": "Průměrné ceny benzínu, nafty a LPG v ČR a kurz bitcoinu",
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
        "popis": "Porovná balení podle ceny za kilogram, litr nebo kus",
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
        "soubor": "obsah/amount_words.html",
        "nazev": "💬 Částka slovy",
        "popis": "Napíše číslo nebo částku v korunách či eurech slovy",
        "stav": "beta",
        "jen_cs": true,
        "tagy": [
          "faktura",
          "slovy",
          "koruna"
        ]
      },
      {
        "soubor": "obsah/deleni_vydaju.html",
        "nazev": "🤝 Dělení společných výdajů",
        "popis": "Rozpočítá společné výdaje skupiny a ukáže, kdo komu dluží",
        "stav": "vyvoj",
        "tagy": ["dělení výdajů", "kdo komu dluží", "společné výdaje", "výlet", "spolubydlení", "oslava", "vyrovnání", "splitwise", "QR platba", "měny", "kurz"]
      },
      {
        "soubor": "obsah/financni_nezavislost.html",
        "nazev": "🏝️ Kalkulačka finanční nezávislosti",
        "popis": "Kolik naspořit, aby výnosy kryly výdaje, a kdy to nastane",
        "stav": "vyvoj",
        "tagy": ["FIRE", "finanční nezávislost", "pravidlo 4 %", "předčasný důchod", "renta", "Monte Carlo", "backtest", "spoření", "investice", "míra výběru", "Coast FI", "Lean FI"]
      },
      {
        "soubor": "obsah/obalky.html",
        "nazev": "✉️ Rozpočet obálkovou metodou",
        "popis": "Rozdělí měsíční příjem do obálek a hlídá výdaje i cíle spoření",
        "stav": "vyvoj",
        "tagy": ["rozpočet", "obálková metoda", "nulový rozpočet", "plánování", "spoření", "cíle spoření", "měsíční rozpočet", "import výpisu", "CSV banka", "domácnost", "finance", "peníze"]
      }
    ]
  },
  {
    "nazev": "🧰 Drobné nástroje",
    "skupina": "produktivita",
    "polozky": [
      {
        "soubor": "obsah/password_vault.html",
        "nazev": "🔐 Trezor hesel",
        "popis": "Ukládá přihlašovací údaje zašifrované hlavním heslem",
        "stav": "beta",
        "tagy": ["heslo", "šifrování", "přihlašovací údaje", "login", "správce hesel"]
      },
      {
        "soubor": "obsah/secure_notes.html",
        "nazev": "🔒 Šifrované poznámky",
        "popis": "Poznámky zašifrované heslem a uložené jen v prohlížeči",
        "stav": "beta",
        "tagy": [
          "heslo",
          "šifrování",
          "soukromé"
        ]
      },
      {
        "soubor": "obsah/password_gen.html",
        "nazev": "🔑 Generátor hesel",
        "popis": "Vytvoří silné náhodné heslo nebo frázi zvolené délky",
        "stav": "beta",
        "tagy": [
          "bezpečnost",
          "passphrase"
        ]
      },
      {
        "soubor": "obsah/qr_generator.html",
        "nazev": "📱 QR generátor + čtečka",
        "popis": "Vytvoří QR kód z textu či odkazu a přečte QR kód kamerou",
        "stav": "beta",
        "tagy": [
          "qr kód",
          "čtečka",
          "skener"
        ]
      },
      {
        "soubor": "obsah/qr_platba.html",
        "nazev": "💳 QR platba",
        "popis": "Udělá platební QR kód z čísla účtu, částky a symbolů",
        "stav": "vyvoj",
        "jen_cs": true,
        "tagy": ["qr platba", "spayd", "platba", "banka", "účet", "iban", "variabilní symbol", "pay by square", "epc", "sepa", "faktura"]
      },
      {
        "soubor": "obsah/wifi_qr.html",
        "nazev": "📶 Wi-Fi QR kód",
        "popis": "Vytvoří QR kód, kterým se hosté připojí k Wi-Fi bez hesla",
        "stav": "beta",
        "tagy": [
          "wifi",
          "připojení",
          "qr"
        ]
      },
      {
        "soubor": "obsah/vcard_gen.html",
        "nazev": "📇 Vizitka (vCard + QR)",
        "popis": "Vytvoří vizitku vCard a QR kód, který uloží kontakt do mobilu",
        "stav": "beta",
        "tagy": [
          "vizitka",
          "vcard",
          "kontakt",
          "qr"
        ]
      },
      {
        "soubor": "obsah/barcode_gen.html",
        "nazev": "▥ Generátor čárových kódů",
        "popis": "Vytvoří kódy EAN, UPC a Code 128 do SVG, PNG i na štítky",
        "stav": "beta",
        "tagy": ["čárový kód", "ean", "ean-13", "ean-8", "upc", "code 128", "isbn", "štítky", "sklad", "barcode"]
      },
      {
        "soubor": "obsah/email_signature.html",
        "nazev": "✉️ E-mailový podpis",
        "popis": "Sestaví HTML podpis e-mailu s kontakty a logem",
        "stav": "beta",
        "tagy": ["podpis", "e-mail", "signature", "kontaktní údaje", "html podpis"]
      },
      {
        "soubor": "obsah/snippet_manager.html",
        "nazev": "📋 Textové šablony (snippety)",
        "popis": "Ukládá textové šablony a odpovědi a kopíruje je jedním klikem",
        "stav": "beta",
        "tagy": ["šablony", "textové bloky", "e-mail", "rychlé odpovědi", "clipboard"]
      },
      {
        "soubor": "obsah/random_picker.html",
        "nazev": "🎡 Losovač / kolo štěstí",
        "popis": "Vylosuje vítěze na kole štěstí nebo rozdělí lidi do skupin",
        "stav": "beta",
        "tagy": [
          "náhoda",
          "losování",
          "ruleta",
          "výběr"
        ]
      },
      {
        "soubor": "obsah/turnaj.html",
        "nazev": "🏆 Turnajový pavouk a rozlosování",
        "popis": "Rozlosuje turnaj do pavouka, skupin nebo každý s každým",
        "stav": "vyvoj",
        "tagy": ["turnaj", "pavouk", "rozlosování", "nasazení", "vyřazovací systém", "dvojí vyřazovací", "každý s každým", "bergerovy tabulky", "švýcarský systém", "buchholz", "skupiny", "play-off", "tabulka", "výsledky", "šachy", "stolní tenis", "fotbal", "šipky", "tisk pavouka"]
      },
      {
        "soubor": "obsah/unit_converter.html",
        "nazev": "⚖️ Konvertor jednotek",
        "popis": "Převádí délky, hmotnosti, objemy a další jednotky",
        "stav": "beta",
        "tagy": [
          "jednotky",
          "míry",
          "váhy",
          "převod"
        ]
      },
      {
        "soubor": "obsah/velikosti.html",
        "nazev": "📏 Tabulky velikostí",
        "popis": "Převede velikosti oblečení, bot, prstenů a rámů kol EU, UK, US",
        "stav": "vyvoj",
        "tagy": ["velikost", "tabulka velikostí", "převod velikostí", "oblečení", "boty", "velikost bot", "EU", "UK", "US", "Mondopoint", "dětské velikosti", "prsten", "velikost prstenu", "měřítko prstenu", "rukavice", "klobouk", "čepice", "obvod hlavy", "podprsenka", "košíček", "rám kola", "košile", "džíny", "W/L", "míry", "EN 13402"]
      },
      {
        "soubor": "obsah/meraky.html",
        "nazev": "📱 Měřáky z telefonu",
        "popis": "Vodováha, sklonoměr, hlukoměr, luxmetr a další ze senzorů mobilu",
        "stav": "vyvoj",
        "tagy": ["vodováha", "sklonoměr", "úhloměr", "hlukoměr", "decibely", "luxmetr", "stroboskop", "otáčky", "spektrum", "senzory", "kompas", "buzola", "azimut", "výškoměr", "výška stromu", "pravítko", "posuvka", "vibrace", "seismograf", "akcelerometr", "gyroskop", "gramofon", "krokoměr", "GPS", "rychloměr", "tachometr", "GPX", "ladička", "ladění kytary", "generátor tónu", "růžový šum", "spektrogram", "třetinooktávy", "dávka hluku", "tep", "puls", "deník měření"]
      },
      {
        "soubor": "obsah/pocitadlo.html",
        "nazev": "🔢 Počítadlo kusů",
        "popis": "Počítá návštěvníky, ptáky či kusy klepnutím, i více najednou",
        "stav": "vyvoj",
        "tagy": ["počítadlo", "tally", "sčítání", "návštěvníci", "ptáci", "doprava", "kola", "klikr", "statistiky", "CSV"]
      }
    ]
  },
  {
    "nazev": "📓 Zdravotní deníky",
    "skupina": "zdravi",
    "polozky": [
      {
        "soubor": "obsah/potraviny.html",
        "nazev": "🥗 Deník jídla",
        "popis": "Zapisuje jídlo a kalorie, skenuje čárové kódy českých výrobků",
        "stav": "beta",
        "tagy": ["kalorie", "počítadlo kalorií", "jídelníček", "výživa", "makroživiny", "bílkoviny", "čárový kód", "EAN", "skenování",
                 "hubnutí", "potraviny", "nutriční hodnoty", "vitaminy", "recepty", "pitný režim", "hmotnost", "Open Food Facts"]
      },
      {
        "soubor": "obsah/workout_log.html",
        "nazev": "🏋️ Tréninkový deník",
        "popis": "Zapisuje cviky, série, opakování a váhu se statistikami",
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
        "popis": "Zapisuje měření tlaku a tepu a barevně je hodnotí",
        "stav": "beta",
        "tagy": [
          "tlak",
          "hypertenze",
          "puls"
        ]
      },
      {
        "soubor": "obsah/mood_tracker.html",
        "nazev": "😊 Tracker nálady",
        "popis": "Zapisuje denní náladu a ukazuje ji v kalendáři",
        "stav": "beta",
        "tagy": ["nálada", "deník", "emoce", "psychika", "sledování"]
      },
      {
        "soubor": "obsah/sleep_tracker.html",
        "nazev": "😴 Tracker spánku",
        "popis": "Zapisuje dobu usnutí a probuzení a počítá délku spánku",
        "stav": "beta",
        "tagy": [
          "spánek",
          "usínání"
        ]
      },
      {
        "soubor": "obsah/water_tracker.html",
        "nazev": "💧 Pitný režim",
        "popis": "Odklikává vypitou vodu a hlídá denní cíl",
        "stav": "beta",
        "tagy": [
          "voda",
          "hydratace"
        ]
      },
      {
        "soubor": "obsah/caffeine_tracker.html",
        "nazev": "☕ Kalkulačka kofeinu",
        "popis": "Sčítá kofein z vypitých nápojů proti dennímu limitu",
        "stav": "beta",
        "tagy": [
          "kofein",
          "káva",
          "energy drink"
        ]
      },
      {
        "soubor": "obsah/medication_reminder.html",
        "nazev": "💊 Rozvrh léků",
        "popis": "Denní rozpis léků s dávkami a časy k odškrtnutí",
        "stav": "beta",
        "tagy": [
          "léky",
          "prášky",
          "dávkování"
        ]
      },
      {
        "soubor": "obsah/denik_nemoci.html",
        "nazev": "🤒 Deník nemoci",
        "popis": "Zapisuje teplotu a léky rodiny a hlídá dávky podle hmotnosti",
        "stav": "vyvoj",
        "tagy": ["nemoc", "horečka", "teplota", "teploměr", "dítě", "paracetamol", "ibuprofen", "Paralen", "Nurofen", "dávkování", "léky", "příznaky", "kašel", "rýma", "dehydratace", "graf teploty", "lékař", "pediatr", "deník", "rodina"]
      },
      {
        "soubor": "obsah/menstrual_calendar.html",
        "nazev": "🌸 Menstruační kalendář",
        "popis": "Sleduje cyklus a odhadne další krvácení, ovulaci a plodné dny",
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
        "soubor": "obsah/denik_migren.html",
        "nazev": "🤕 Deník migrén a bolestí hlavy",
        "popis": "Zapisuje záchvaty, léky a spouštěče a zpracuje přehled pro lékaře",
        "stav": "vyvoj",
        "tagy": ["migréna", "bolest hlavy", "deník", "záchvat", "aura", "tenzní bolest", "triptan", "analgetika", "nadužívání léků", "ICHD-3", "MIDAS", "spouštěče", "tlak vzduchu", "počasí", "kalendář", "pro lékaře", "neurolog"]
      }
    ]
  },
  {
    "nazev": "🩺 Zdravotní kalkulačky",
    "skupina": "zdravi",
    "polozky": [
      {
        "soubor": "obsah/bmi_calc.html",
        "nazev": "🩺 BMI & kalorie",
        "popis": "Spočítá BMI a denní potřebu kalorií podle aktivity",
        "stav": "beta",
        "tagy": [
          "váha",
          "kalorie",
          "dieta",
          "index"
        ]
      },
      {
        "soubor": "obsah/ideal_weight.html",
        "nazev": "⚖️ Ideální hmotnost",
        "popis": "Zdravé rozmezí hmotnosti podle výšky a několika vzorců",
        "stav": "beta",
        "tagy": ["hmotnost", "váha", "postava", "zdravá váha", "kalkulačka"]
      },
      {
        "soubor": "obsah/heart_zones.html",
        "nazev": "❤️ Tepové zóny",
        "popis": "Spočítá maximální tep a tréninkové zóny podle věku",
        "stav": "beta",
        "tagy": [
          "tep",
          "puls",
          "kardio",
          "běh"
        ]
      },
      {
        "soubor": "obsah/alkohol_krev.html",
        "nazev": "🍺 Alkohol v krvi",
        "popis": "Odhadne promile alkoholu v krvi a dobu vystřízlivění",
        "stav": "vyvoj",
        "tagy": ["promile", "alkohol", "Widmark", "řízení", "pivo", "víno", "vystřízlivění"]
      },
      {
        "soubor": "obsah/tehotenstvi.html",
        "nazev": "🤰 Těhotenský kalendář",
        "popis": "Spočítá termín porodu, týden těhotenství a plán vyšetření",
        "stav": "vyvoj",
        "tagy": ["těhotenství", "termín porodu", "Naegele", "týden těhotenství", "trimestr", "screening", "porod"]
      },
      {
        "soubor": "obsah/growth_chart.html",
        "nazev": "📈 Kalendář růstu dítěte (percentily)",
        "popis": "Percentil výšky a váhy dítěte podle věku a pohlaví (WHO)",
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
        "soubor": "obsah/ockovani.html",
        "nazev": "💉 Očkovací kalendář",
        "popis": "Osobní harmonogram očkování dětí i dospělých podle data narození",
        "stav": "vyvoj",
        "tagy": ["očkování", "vakcíny", "hexavakcína", "MMR", "děti", "přeočkování", "tetanus", "klíšťová encefalitida", "HPV"]
      },
      {
        "soubor": "obsah/sleep_cycle_alarm.html",
        "nazev": "😴 Budík dle spánkových cyklů",
        "popis": "Kdy jít spát nebo vstát, aby ses probudil na konci cyklu",
        "stav": "beta",
        "tagy": [
          "spánek",
          "budík",
          "cykly",
          "usínání"
        ]
      },
      {
        "soubor": "obsah/kondiciogram.html",
        "nazev": "📊 Kondiciogram",
        "popis": "Výpočet biorytmů korigovaný spánkem, zátěží a pohlavím",
        "stav": "beta",
        "tagy": [
          "biorytmus",
          "kondice"
        ]
      },
      {
        "soubor": "obsah/kondiciogram_retro.html",
        "nazev": "🖨️ Kondiciogram retro",
        "popis": "Biorytmy ve stylu staré jehličkové tiskárny",
        "stav": "beta",
        "tagy": ["biorytmus", "kondice", "cykly", "retro", "tisk"]
      },
      {
        "soubor": "obsah/score2.html",
        "nazev": "❤️ Kardiovaskulární riziko (SCORE2)",
        "popis": "Desetileté riziko infarktu a mrtvice podle ESC 2021",
        "stav": "vyvoj",
        "tagy": ["SCORE2", "infarkt", "mrtvice", "cholesterol", "krevní tlak", "kouření", "ESC", "srdce", "diabetes"]
      }
    ]
  },
  {
    "nazev": "🧘 Cvičení, relax & testy",
    "skupina": "zdravi",
    "polozky": [
      {
        "soubor": "obsah/cviceni/index.html",
        "nazev": "💪 Časovač cvičení",
        "popis": "Intervaly Tabata, HIIT, EMOM i pauzy mezi sériemi s velkými číslicemi",
        "stav": "vyvoj",
        "tagy": ["časovač", "intervaly", "tabata", "HIIT", "EMOM", "AMRAP", "kruhový trénink", "pauza mezi sériemi", "odpočet", "stopky",
                 "box", "posilovna", "fitness", "cvičení", "trénink", "mobil", "aplikace", "interval timer"]
      },
      {
        "soubor": "obsah/breathing.html",
        "nazev": "🫁 Dechové cvičení",
        "popis": "Vedené dýchání s animací nádechu a výdechu na uklidnění",
        "stav": "beta",
        "tagy": [
          "relaxace",
          "stres",
          "meditace"
        ]
      },
      {
        "soubor": "obsah/relaxsounds.html",
        "nazev": "🌧️ Relaxační zvuky",
        "popis": "Mixuj nahrávky deště, lesa a moře pro soustředění i spánek",
        "stav": "beta",
        "tagy": [
          "déšť",
          "zvuky",
          "spánek",
          "meditace"
        ]
      },
      {
        "soubor": "obsah/reaction_test.html",
        "nazev": "⚡ Reakční test",
        "popis": "Změř rychlost reakce kliknutím, až plocha zezelená",
        "stav": "beta",
        "tagy": ["reakce", "rychlost", "postřeh", "ms", "test"]
      },
      {
        "soubor": "obsah/color_vision.html",
        "nazev": "👁️ Test barvocitu",
        "popis": "Najdi číslo v kruhu teček jako u Ishiharových tabulek",
        "stav": "beta",
        "tagy": ["barvocit", "ishihara", "barvoslepost", "zrak", "test"]
      },
      {
        "soubor": "obsah/vision_test.html",
        "nazev": "👁️ Oční tabulka (test zraku)",
        "popis": "Snellenova tabulka v reálné velikosti na orientační test zraku",
        "stav": "beta",
        "tagy": [
          "zrak",
          "snellen",
          "oči"
        ]
      },
      {
        "soubor": "obsah/first_aid_ref.html",
        "nazev": "🩹 Lékárnička – první pomoc",
        "popis": "Offline postupy první pomoci a tísňová čísla",
        "stav": "beta",
        "tagy": [
          "první pomoc",
          "úraz",
          "kpr",
          "resuscitace"
        ]
      },
      {
        "soubor": "obsah/bezecky_plan.html",
        "nazev": "🏃 Běžecký plán a tempa",
        "popis": "VDOT z času závodu, predikce časů, tréninková tempa a plán",
        "stav": "vyvoj",
        "tagy": ["běh", "běhání", "VDOT", "Daniels", "Riegel", "VO2max", "tempo", "kalkulačka tempa", "predikce času", "maraton", "půlmaraton", "10 km", "5 km", "mezičasy", "negativní split", "tréninkový plán", "intervaly", "prahové tempo", "kalendář", "ics", "převýšení", "teplota"]
      }
    ]
  },
  {
    "nazev": "🍳 Recepty & kuchyně",
    "skupina": "vareni",
    "polozky": [
      {
        "soubor": "obsah/recipes.html",
        "nazev": "🍳 Kniha receptů",
        "popis": "Vlastní recepty s přepočtem na počet porcí, uložené v prohlížeči",
        "stav": "beta",
        "tagy": ["vaření", "recept", "porce", "přepočet množství", "ingredience"]
      },
      {
        "soubor": "obsah/prepocet_receptu.html",
        "nazev": "🔁 Přepočet receptu",
        "popis": "Vložený recept přepočítá na jiné porce, formu nebo jednotky",
        "stav": "vyvoj",
        "tagy": ["recept", "porce", "přepočet", "forma na dort", "plech", "hrnky", "lžíce", "cup", "oz", "zlomky", "vejce", "škálování"]
      },
      {
        "soubor": "obsah/meal_planner.html",
        "nazev": "🍽️ Týdenní jídelníček",
        "popis": "Snídaně, obědy a večeře na týden s nákupním seznamem",
        "stav": "beta",
        "tagy": [
          "jídlo",
          "vaření",
          "nákup",
          "recepty"
        ]
      },
      {
        "soubor": "obsah/kuchynske_miry.html",
        "nazev": "🥄 Kuchyňské míry podle suroviny",
        "popis": "Převod hrnků a lžic na gramy podle konkrétní suroviny",
        "stav": "beta",
        "tagy": ["hrnek", "lžíce", "lžička", "gramy", "převod", "mouka", "cukr", "cup", "forma na dort", "trouba", "droždí"]
      },
      {
        "soubor": "obsah/kvasek_chleb.html",
        "nazev": "🍞 Kvásek a chleba",
        "popis": "Pekařská procenta, krmení kvásku a časový plán pečení",
        "stav": "beta",
        "tagy": ["kvásek", "chléb", "pečení", "pekařská procenta", "hydratace", "kvas", "žitný", "sourdough", "krmení kvásku"]
      },
      {
        "soubor": "obsah/fermentace.html",
        "nazev": "🫙 Fermentace a zavařování",
        "popis": "Slanost nálevu, doby sterilace, nálevy a deník várek",
        "stav": "beta",
        "tagy": ["kvašení", "kysané zelí", "okurky", "solanka", "sterilace", "zavařování", "nálev", "kompot", "kimči", "ocet"]
      },
      {
        "soubor": "obsah/peceni_masa.html",
        "nazev": "🥩 Pečení a uzení masa",
        "popis": "Teplota trouby, čas, teplota jádra a plán, kdy začít",
        "stav": "vyvoj",
        "tagy": ["maso", "pečeně", "teplota jádra", "propečení", "steak", "sous-vide", "uzení", "udírna", "gril", "časovač", "drůbež", "zvěřina"]
      },
      {
        "soubor": "obsah/kava_pomery.html",
        "nazev": "☕ Kávové poměry",
        "popis": "Poměr kávy a vody, mletí a teplota pro každou metodu přípravy",
        "stav": "vyvoj",
        "tagy": ["káva", "espresso", "V60", "pour-over", "french press", "AeroPress", "moka", "cold brew", "poměr", "mletí", "barista", "časovač"]
      },
      {
        "soubor": "obsah/sezonni_potraviny.html",
        "nazev": "🍎 Sezónní kalendář potravin",
        "popis": "Co je v Česku právě v sezóně a co z toho uvařit",
        "stav": "vyvoj",
        "tagy": ["sezóna", "sezónní", "zelenina", "ovoce", "houby", "bylinky", "zvěřina", "ryby", "nákup", "kalendář", "lokální", "co vařit"]
      },
      {
        "soubor": "obsah/svet_u_stolu.html",
        "nazev": "🌍 Svět u stolu",
        "popis": "Sváteční jídla a tradice světa v kalendáři, mapě i dějinách",
        "stav": "vyvoj",
        "tagy": ["svátky", "tradice", "zvyky", "rituál", "kalendář", "svět", "národní jídla", "Vánoce", "Velikonoce", "Nový rok", "čínský Nový rok", "ramadán", "Diwali", "recept", "mapa", "co se jí"]
      },
      {
        "soubor": "obsah/nutricni_recept.html",
        "nazev": "🥗 Nutriční hodnoty receptu",
        "popis": "Energie, tuky, sacharidy a bílkoviny receptu ze seznamu surovin",
        "stav": "vyvoj",
        "tagy": ["nutriční hodnoty", "kalorie", "recept", "etiketa", "výživové údaje", "bílkoviny", "sacharidy", "tuky", "1169/2011", "deník jídla"]
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
        "popis": "Počasí, radar srážek, bouřkový CAPE, UV i geomagnetika pro místo",
        "stav": "beta",
        "tagy": [
          "počasí",
          "déšť",
          "teplota",
          "meteo"
        ]
      },
      {
        "soubor": "obsah/forecast2.html",
        "nazev": "🌤️ Předpověď 2",
        "popis": "Vylepšená předpověď: hodiny a dny, grafy, porovnání modelů, kiosk",
        "stav": "vyvoj",
        "tagy": ["počasí", "déšť", "teplota", "meteo", "hodinová předpověď", "10 dní", "radar", "výstrahy"]
      },
      {
        "soubor": "obsah/radareu.html",
        "nazev": "📡 Radar EU",
        "popis": "Animovaný srážkový radar nad Evropou se špendlíky",
        "stav": "beta",
        "tagy": [
          "srážky",
          "déšť",
          "bouřky",
          "počasí"
        ]
      },
      {
        "soubor": "obsah/bourky.html",
        "nazev": "⚡ Bouřky a blesky živě",
        "popis": "Blesky z družice MTG a srážkový radar nad Evropou v reálném čase",
        "stav": "vyvoj",
        "tagy": ["blesky", "bouřky", "radar", "počasí", "mapa", "živá data"]
      },
      {
        "soubor": "obsah/pocasi_eu.html",
        "nazev": "🌦️ Počasí Evropy",
        "popis": "Předpověď pro sledovaná místa na mapě Evropy",
        "stav": "beta",
        "tagy": [
          "meteo",
          "mapa počasí"
        ]
      },
      {
        "soubor": "obsah/weather_globe.html",
        "nazev": "🌍 Glóbus počasí",
        "popis": "Aktuální počasí a srážky na otočném 3D glóbu",
        "stav": "beta",
        "tagy": ["počasí", "glóbus", "3d", "mapa", "teplota", "svět"]
      },
      {
        "soubor": "obsah/historicalWeather.html",
        "nazev": "📉 Historie počasí",
        "popis": "Historická data počasí pro den, měsíc i rok a změny po dekádách",
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
        "popis": "Rosný bod, absolutní vlhkost a mokrý teploměr z teploty a vlhkosti",
        "stav": "beta",
        "tagy": ["rosný bod", "vlhkost", "kondenzace", "plíseň", "psychrometrie"]
      },
      {
        "soubor": "obsah/meteo_units.html",
        "nazev": "🌡️ Převodník meteo jednotek",
        "popis": "Převod teploty, tlaku, rychlosti větru a srážek",
        "stav": "beta",
        "tagy": ["převod jednotek", "teplota", "tlak", "rychlost větru", "srážky"]
      },
      {
        "soubor": "obsah/meteogram.html",
        "nazev": "⛰️ Meteogram pro hory a létání",
        "popis": "Vítr ve výškách, nulová izoterma a oblačnost pro túry a létání",
        "stav": "vyvoj",
        "tagy": ["počasí", "meteogram", "hory", "paragliding", "plachtění", "vítr ve výškách", "nulová izoterma", "základna oblaků", "termika", "emagram", "Skew-T", "CAPE", "inverze", "ICON-D2", "ECMWF"]
      },
      {
        "soubor": "obsah/snih_laviny.html",
        "nazev": "❄️ Sníh a laviny",
        "popis": "Výška sněhu, vítr, oteplení a mapa sklonů pro skialpinisty",
        "stav": "vyvoj",
        "tagy": ["laviny", "sníh", "skialpinismus", "skialpy", "hory", "sklon svahu", "mapa sklonitosti", "orientace svahu", "redukční metoda", "Munter", "lavinové nebezpečí", "nový sníh", "výška sněhu", "Krkonoše", "Jeseníky", "Tatry", "Alpy", "Open-Meteo"]
      }
    ]
  },
  {
    "nazev": "🌱 Zahrada & pěstování",
    "skupina": "priroda",
    "polozky": [
      {
        "soubor": "obsah/garden_layout.html",
        "nazev": "🌱 Plánovač záhonů",
        "popis": "Vybarvi mřížku záhonu plodinami a vytiskni plán",
        "stav": "beta",
        "tagy": [
          "zahrada",
          "záhon",
          "rozvržení",
          "plán"
        ]
      },
      {
        "soubor": "obsah/crop_rotation.html",
        "nazev": "🔄 Plánovač střídání plodin",
        "popis": "Osevní postup na víc let s kontrolou zásad střídání",
        "stav": "beta",
        "tagy": [
          "zahrada",
          "osevní postup",
          "plodiny"
        ]
      },
      {
        "soubor": "obsah/agri_calendar.html",
        "nazev": "🌱 Zemědělský kalendář",
        "popis": "Polní a zahradní práce podle měsíců s vlastními úkoly",
        "stav": "beta",
        "tagy": [
          "polní práce",
          "setí",
          "sklizeň",
          "agro"
        ]
      },
      {
        "soubor": "obsah/seeding_calc.html",
        "nazev": "🌾 Kalkulačka výsevku",
        "popis": "Výsevek v kg/ha z počtu rostlin, HTZ a klíčivosti",
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
        "popis": "Dávky N-P-K podle plodiny a přepočet na množství hnojiv",
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
        "popis": "Evidence srážek a výpočet sumy efektivních teplot",
        "stav": "beta",
        "tagy": [
          "srážky",
          "růstové stupně",
          "zahrada",
          "pole"
        ]
      },
      {
        "soubor": "obsah/zahradni_stavby.html",
        "nazev": "🌿 Zahradní stavby ze dřeva",
        "popis": "Záhony, kompostéry a pergoly: statika, kusovník a výkresy",
        "stav": "vyvoj",
        "tagy": ["zahrada", "vyvýšený záhon", "kompostér", "pergola", "lamely", "stínění", "zemní tlak", "průhyb", "statika", "dřevo", "kusovník", "plán řezů", "PDF", "DXF", "STL", "3D"]
      },
      {
        "soubor": "obsah/ptaci_budky.html",
        "nazev": "🐦 Ptačí budky a hmyzí hotely",
        "popis": "Budky z jednoho prkna podle druhu ptáka s řezným plánem",
        "stav": "vyvoj",
        "tagy": ["budka", "ptáci", "hmyzí hotel", "truhlařina", "řezný plán", "šablona", "PDF 1:1", "DXF", "STL", "3D", "netopýři", "zahrada"]
      }
    ]
  },
  {
    "nazev": "🗺️ Mapy & GPS",
    "skupina": "priroda",
    "polozky": [
      {
        "soubor": "obsah/map_export.html",
        "nazev": "🗺️ Mapový exportér",
        "popis": "Vyber oblast mapy a vytiskni ji na jednu či víc stránek A4",
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
        "popis": "Historická a moderní mapa vedle sebe se synchronním posunem",
        "stav": "beta",
        "tagy": [
          "historické mapy",
          "porovnání"
        ]
      },
      {
        "soubor": "obsah/gpx_viewer.html",
        "nazev": "📡 Prohlížeč GPX",
        "popis": "Trasa z GPX na mapě s výškovým profilem a statistikami",
        "stav": "beta",
        "tagy": [
          "trasa",
          "gps",
          "záznam",
          "mapa"
        ]
      },
      {
        "soubor": "obsah/distance_measure.html",
        "nazev": "📏 Měřič vzdáleností",
        "popis": "Klikáním změř vzdálenost nebo plochu na mapě",
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
        "popis": "Stoupání, klesání a graf výšek trasy z GPX nebo bodů",
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
        "popis": "Výměra pozemku v m², arech a hektarech z bodů v mapě",
        "stav": "beta",
        "tagy": [
          "pozemek",
          "výměra",
          "hektar",
          "parcela"
        ]
      },
      {
        "soubor": "obsah/gps_converter.html",
        "nazev": "🧭 Převodník GPS",
        "popis": "Převod souřadnic mezi DD, DMS, DDM a UTM",
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
        "popis": "Azimut, zpětný azimut a vzdálenost mezi dvěma body",
        "stav": "beta",
        "tagy": ["kompas", "azimut", "orientace", "buzola", "sever"]
      },
      {
        "soubor": "obsah/viditelnost.html",
        "nazev": "👁️ Viditelnost z bodu (výhled)",
        "popis": "Co je vidět z kopce či rozhledny podle modelu terénu",
        "stav": "vyvoj",
        "tagy": ["viditelnost", "viewshed", "výhled", "rozhledna", "panorama", "obzor", "čára pohledu", "zakřivení Země", "refrakce", "DMR 5G", "terén", "vrcholy", "kumulativní viditelnost", "Fresnelova zóna", "rádiový spoj", "východ slunce", "větrná elektrárna", "GeoTIFF", "KML"]
      },
      {
        "soubor": "obsah/dosazitelnost.html",
        "nazev": "⏱️ Dosažitelnost za čas (izochrony)",
        "popis": "Kam se dostaneš za pár minut pěšky, na kole či autem",
        "stav": "vyvoj",
        "tagy": ["izochrony", "dosažitelnost", "dojezdová doba", "kde bydlet", "pěšky", "kolo", "auto", "průnik", "valhalla", "mapa", "trasa", "geojson"]
      }
    ]
  },
  {
    "nazev": "🧳 Cestování & výlety",
    "skupina": "priroda",
    "polozky": [
      {
        "soubor": "obsah/trip_planner.html",
        "nazev": "🥾 Plánovač tras",
        "popis": "Naplánuj trasu výletu s body a poznámkami na mapě",
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
        "popis": "Plán dovolených s mapou, rozpočtem, věcmi a sdílením přes QR",
        "stav": "beta",
        "tagy": [
          "dovolená",
          "cestování",
          "itinerář"
        ]
      },
      {
        "soubor": "obsah/travel_diary.html",
        "nazev": "✈️ Cestovní deník",
        "popis": "Výlety s místy na mapě, daty a poznámkami",
        "stav": "beta",
        "tagy": ["cestování", "deník", "zápisky", "výlety", "fotky"]
      },
      {
        "soubor": "obsah/vyletni_denik.html",
        "nazev": "📔 Výletní deník",
        "popis": "Evidence výletů: lidé, náklady, trasa z GPX, místa a fotky",
        "stav": "vyvoj",
        "tagy": ["výlety", "deník", "GPX", "KML", "mapa", "fotografie", "výškový profil", "statistiky", "kalendář", "počasí", "offline"]
      },
      {
        "soubor": "obsah/packing_list.html",
        "nazev": "🎒 Balicí seznam",
        "popis": "Odškrtávací seznam věcí na cestu ze šablon",
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
        "popis": "Společné výdaje na cestě a kdo komu kolik dluží",
        "stav": "beta",
        "tagy": ["rozpočet", "cestování", "útrata", "rozdělení nákladů", "měna"]
      },
      {
        "soubor": "obsah/trip_cost.html",
        "nazev": "🚗 Náklady na cestu",
        "popis": "Cena paliva, mýta a podíl na osobu pro cestu autem",
        "stav": "beta",
        "tagy": [
          "palivo",
          "benzín",
          "spolujezdci",
          "kilometrovné"
        ]
      },
      {
        "soubor": "obsah/kulturni_akce.html",
        "nazev": "🎪 Kulturní akce v krajích",
        "popis": "Výstavy, poutě, festivaly a vinobraní ve vybraných krajích",
        "stav": "beta",
        "tagy": ["akce", "výstavy", "hody", "poutě", "festivaly", "vinobraní", "jarmark", "posezení", "kraje", "kultura"]
      },
      {
        "soubor": "obsah/fishing_calendar.html",
        "nazev": "🎣 Rybářský kalendář",
        "popis": "Nejlepší doby pro rybolov podle Měsíce a solunární teorie",
        "stav": "beta",
        "tagy": [
          "rybaření",
          "solunární",
          "měsíc",
          "ryby"
        ]
      },
      {
        "soubor": "obsah/cestovni_mapa.html",
        "nazev": "🧭 Cestovatelská mapa",
        "popis": "Kreslené mapy s animovanou trasou a exportem videa",
        "stav": "vyvoj",
        "tagy": ["cestopis", "mapa", "trasa", "video", "animace", "YouTube", "vlog", "kreslená mapa", "inkoust", "akvarel", "stará mapa", "Bézier", "MP4", "WebM", "PNG", "Indiana Jones mapa", "cesta letadlem"]
      },
      {
        "soubor": "obsah/zeme_v_kostce.html",
        "nazev": "🌍 Země v kostce pro cestovatele",
        "popis": "Vstup, očkování, zásuvky, tísňová čísla, klima a svátky států",
        "stav": "beta",
        "tagy": ["zásuvky", "adaptér", "napětí", "tísňová čísla", "měna", "předvolba", "časové pásmo", "strana jízdy", "spropitné", "pitná voda", "dálniční známka", "mýto", "MZV", "státy světa", "cestování", "víza", "očkování", "malárie", "státní svátky", "klima", "fráze", "jet lag", "rozpočet cesty", "silniční pravidla", "velikosti oblečení", "volné táboření", "spaní v autě", "obytňák", "pláže", "houby", "drony", "nudismus", "alkohol na veřejnosti"]
      }
    ]
  },
  {
    "nazev": "🌍 Země živě",
    "skupina": "priroda",
    "polozky": [
      {
        "soubor": "obsah/dvere_do_sveta.html",
        "nazev": "🚪 Dveře do světa",
        "popis": "Otevři dveře a podívej se živou kamerou někam na Zemi",
        "stav": "beta",
        "tagy": ["webkamera", "webkamery", "živě", "live", "kamera", "výhled", "cestování", "svět", "náhodné místo", "příroda", "zvířata", "hory", "moře", "sopky", "polární záře", "přístavy", "lodě", "street view"]
      },
      {
        "soubor": "obsah/ziva_zeme.html",
        "nazev": "🌋 Živá Země",
        "popis": "Zemětřesení, požáry, sopky a poloha ISS právě teď",
        "stav": "beta",
        "tagy": ["zemětřesení", "požáry", "sopky", "ISS", "mapa", "živá data"]
      },
      {
        "soubor": "obsah/zaplavy.html",
        "nazev": "🌊 Zaplavení terénu",
        "popis": "Orientační model zaplavení terénu při zvolené hladině vody",
        "stav": "vyvoj",
        "tagy": ["mapa", "povodně", "záplavy", "DEM", "GIS", "terén", "GeoTIFF"]
      },
      {
        "soubor": "obsah/svetelne_znecisteni.html",
        "nazev": "🌌 Světelné znečištění a tmavá obloha",
        "popis": "Mapa jasu noční oblohy a třídy Bortle pro pozorování hvězd",
        "stav": "vyvoj",
        "tagy": ["astronomie", "mapa", "světelné znečištění", "Bortle", "Měsíc", "soumrak", "oblačnost", "pozorování hvězd", "GPX"]
      }
    ]
  },
  {
    "nazev": "🔭 Astronomie",
    "skupina": "priroda",
    "polozky": [
      {
        "soubor": "obsah/dalekohled.html",
        "nazev": "🔭 Hvězdářský dalekohled",
        "popis": "Zorné pole okuláru a kamery, plánovač noci a deník pozorování",
        "stav": "beta",
        "tagy": ["astronomie", "dalekohled", "teleskop", "simulace", "planetárium", "planety", "Měsíc", "Jupiter", "Saturn", "dvojhvězdy", "Messier", "NGC", "galaxie", "mlhoviny", "okulár", "zvětšení", "seeing", "světelné znečištění", "Dobson", "pozorování", "plánovač noci", "pozorovací seznam", "deník pozorování", "astrofotografie", "kamera", "efemeridy", "úkazy", "konjunkce", "vyhledávací mapa", "PDF"]
      },
      {
        "soubor": "obsah/sky_events.html",
        "nazev": "🔭 Astronomický kalendář úkazů",
        "popis": "Zatmění, meteorické roje, fáze Měsíce a konjunkce pro tvé místo",
        "stav": "beta",
        "tagy": ["astronomie", "Měsíc", "zatmění", "meteory", "planety", "kalendář", "ics"]
      },
      {
        "soubor": "obsah/sun_moon.html",
        "nazev": "🌅 Slunce & Měsíc",
        "popis": "Východ a západ Slunce a Měsíce a fáze Měsíce pro místo",
        "stav": "beta",
        "tagy": [
          "východ",
          "západ",
          "fáze měsíce",
          "slunce"
        ]
      },
      {
        "soubor": "obsah/planetarium.html",
        "nazev": "🌍 Planetárium Slunce–Země–Měsíc",
        "popis": "Návrh ozubeného telluria k výrobě s fázemi a zatměními",
        "stav": "vyvoj",
        "tagy": ["tellurium", "orrery", "planetárium", "ozubená kola", "převody", "Měsíc", "fáze", "roční období", "zatmění", "STL", "DXF", "3D tisk"]
      },
      {
        "soubor": "obsah/slunecni_hodiny.html",
        "nazev": "☀️ Sluneční hodiny",
        "popis": "Návrh a tisk šablon slunečních hodin 1:1 pro tvou polohu",
        "stav": "beta",
        "tagy": ["sluneční hodiny", "gnomon", "rovnice času", "analema", "šablona", "tisk 1:1", "PDF", "DXF", "astronomie", "deklinace stěny", "Canterbury", "kapesní hodiny", "výškové hodiny"]
      },
      {
        "soubor": "obsah/sextant.html",
        "nazev": "🧭 Sextant – poloha podle hvězd",
        "popis": "Zeměpisná šířka z výšky Polárky nebo poledního Slunce",
        "stav": "beta",
        "tagy": ["astronavigace", "polárka", "zeměpisná šířka", "slunce v poledne"]
      },
      {
        "soubor": "obsah/satelity.html",
        "nazev": "🛰️ Přelety ISS a satelitů",
        "popis": "Předpověď viditelných přeletů ISS, Starlinků a jasných družic",
        "stav": "vyvoj",
        "tagy": ["ISS", "družice", "satelity", "přelety", "Starlink", "Tiangong", "Hubble", "SGP4", "TLE", "CelesTrak", "pozorování", "obloha", "mapa"]
      },
      {
        "soubor": "obsah/atlas_mesice.html",
        "nazev": "🌕 Atlas Měsíce",
        "popis": "Mapa přivrácené strany Měsíce s terminátorem a librací",
        "stav": "vyvoj",
        "tagy": ["měsíc", "mapa měsíce", "krátery", "terminátor", "librace", "fáze", "dalekohled", "pozorování", "selenografie", "apollo"]
      }
    ]
  },
  {
    "nazev": "🎨 Barvy & web design",
    "skupina": "tvorba",
    "polozky": [
      {
        "soubor": "obsah/color_picker.html",
        "nazev": "🎨 Color picker & palety",
        "popis": "Výběr barvy v HEX, RGB, HSL a CMYK s harmonickými paletami",
        "stav": "beta",
        "tagy": [
          "barvy",
          "paleta",
          "hex",
          "rgb"
        ]
      },
      {
        "soubor": "obsah/palette_from_image.html",
        "nazev": "🎨 Paleta z obrázku",
        "popis": "Vytáhne hlavní barvy z nahraného obrázku",
        "stav": "beta",
        "tagy": [
          "barvy",
          "paleta",
          "extrakce",
          "hex"
        ]
      },
      {
        "soubor": "obsah/gradient_gen.html",
        "nazev": "🌈 CSS gradienty",
        "popis": "Lineární, radiální a kuželové přechody s kopírováním CSS",
        "stav": "beta",
        "tagy": ["css", "gradient", "přechod barev", "web design"]
      },
      {
        "soubor": "obsah/shadow_gen.html",
        "nazev": "🌑 Generátor stínů",
        "popis": "Vrstvené box-shadow s náhledem a kopírováním CSS",
        "stav": "beta",
        "tagy": ["css", "box-shadow", "stín", "web design"]
      },
      {
        "soubor": "obsah/css_hriste.html",
        "nazev": "🧩 CSS hřiště: Flexbox, Grid, cubic-bezier",
        "popis": "Vizuálně zkoušej Flexbox, Grid, cubic-bezier a keyframes",
        "stav": "vyvoj",
        "tagy": ["css", "flexbox", "grid", "cubic-bezier", "easing", "animace", "keyframes", "transition", "steps", "linear()", "grid-template-areas", "rozvržení", "web design", "výuka"]
      },
      {
        "soubor": "obsah/pattern_gen.html",
        "nazev": "🔳 Generátor vzorů",
        "popis": "Opakující se vzory pozadí v CSS nebo SVG",
        "stav": "beta",
        "tagy": ["css", "vzor", "tapeta", "pozadí", "textura"]
      },
      {
        "soubor": "obsah/blob_gen.html",
        "nazev": "🫧 SVG bloby",
        "popis": "Náhodné organické tvary ke stažení jako SVG",
        "stav": "beta",
        "tagy": ["svg", "blob", "tvar", "web design", "organický tvar"]
      },
      {
        "soubor": "obsah/favicon_gen.html",
        "nazev": "⭐ Favicon generátor",
        "popis": "Ikona webu z emoji, textu nebo obrázku v sadě PNG",
        "stav": "beta",
        "tagy": ["favicon", "ikona", "web", "png", "záložka"]
      },
      {
        "soubor": "obsah/colorblind_sim.html",
        "nazev": "🌈 Simulace barvosleposti",
        "popis": "Jak obrázek nebo paletu vidí lidé s poruchou barvocitu",
        "stav": "beta",
        "tagy": ["barvoslepost", "přístupnost", "simulace", "daltonismus", "kontrast"]
      },
      {
        "soubor": "obsah/contrast_checker.html",
        "nazev": "🌗 Kontrast (WCAG)",
        "popis": "Ověří kontrast textu a pozadí podle WCAG AA a AAA",
        "stav": "beta",
        "tagy": [
          "wcag",
          "přístupnost",
          "barvy"
        ]
      }
    ]
  },
  {
    "nazev": "✏️ Kreslení & komiks",
    "skupina": "tvorba",
    "polozky": [
      {
        "soubor": "obsah/pixel_art.html",
        "nazev": "🎨 Pixel art editor",
        "popis": "Kresli po pixelech v malé mřížce a exportuj PNG",
        "stav": "beta",
        "tagy": ["pixel", "kreslení", "editor", "sprite", "8bit"]
      },
      {
        "soubor": "obsah/pixel_studio.html",
        "nazev": "🧩 Pixel studio (PNG assety)",
        "popis": "Pokročilý editor pixelových assetů s vrstvami a paletami",
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
        "popis": "Kreslení map pro Dračí doupě na čtvercích nebo hexech",
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
        "soubor": "obsah/whiteboard.html",
        "nazev": "✏️ Whiteboard",
        "popis": "Vektorová tabule s tvary, spojnicemi, rámy a prezentací",
        "stav": "beta",
        "tagy": [
          "kreslení",
          "tabule",
          "skica"
        ]
      },
      {
        "soubor": "obsah/comic_strip.html",
        "nazev": "💬 Generátor komiksových stripů",
        "popis": "Vlož fotky do panelů, přidej bubliny a stáhni strip",
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
        "popis": "Mřížka scén s náčrtem, popiskem a časováním k tisku",
        "stav": "beta",
        "tagy": [
          "scénář",
          "video",
          "film",
          "scény"
        ]
      },
      {
        "soubor": "obsah/comic3d.html",
        "nazev": "💥 Komiksový 3D prostor",
        "popis": "3D scéna s toon stínováním, obrysy a halftone rastrem",
        "stav": "beta",
        "tagy": ["komiks", "3d", "scéna", "bubliny", "kreslení"]
      },
      {
        "soubor": "obsah/comic3d_walk.html",
        "nazev": "🚶 Komiksový 3D svět (procházka)",
        "popis": "Procházka postavou po 3D světě v komiksovém stylu",
        "stav": "beta",
        "tagy": ["komiks", "3d", "procházka", "prostor", "walk"]
      },
      {
        "soubor": "obsah/ascii_art.html",
        "nazev": "🔤 ASCII art",
        "popis": "Převede obrázek na text ze znaků",
        "stav": "beta",
        "tagy": ["ascii", "art", "obrázek na text", "terminál"]
      },
      {
        "soubor": "obsah/spirograf.html",
        "nazev": "✒️ Spirograf",
        "popis": "Kreslí hypotrochoidy a epitrochoidy ve vrstvách s exportem",
        "stav": "vyvoj",
        "tagy": ["spirograf", "hypotrochoida", "epitrochoida", "kreslení", "vzory", "mandala", "SVG"]
      },
      {
        "soubor": "obsah/stained_glass.html",
        "nazev": "🔷 Vitráž",
        "popis": "Vitrážová mozaika z buněk, i podle nahraného obrázku",
        "stav": "beta",
        "tagy": ["vitráž", "sklo", "mozaika", "generátor", "výtvarka"]
      },
      {
        "soubor": "obsah/keltske_uzly.html",
        "nazev": "🪢 Keltské uzly",
        "popis": "Kreslení keltských pleteníc a uzlů na mřížce",
        "stav": "vyvoj",
        "tagy": ["keltské uzly", "pletenec", "cop", "uzel", "triquetra", "trojlístek", "ornament", "vzory", "mandala", "SVG"]
      },
      {
        "soubor": "obsah/animace_snimky.html",
        "nazev": "🎞️ Animace snímek po snímku",
        "popis": "Kresli animaci po snímcích s cibulovou slupkou a export",
        "stav": "vyvoj",
        "tagy": ["animace", "kreslená animace", "frame by frame", "cibulová slupka", "onion skin", "rotoskopie", "časová osa", "tlak pera", "stylus", "gif", "mp4", "webm", "sprite sheet", "flipbook"]
      }
    ]
  },
  {
    "nazev": "🔤 Písmo & znaky",
    "skupina": "tvorba",
    "polozky": [
      {
        "soubor": "obsah/font_preview.html",
        "nazev": "🔤 Náhled fontů",
        "popis": "Porovná fonty na vlastním textu a pomůže najít dobrou dvojici",
        "stav": "beta",
        "tagy": ["fonty", "písmo", "typografie", "náhled", "párování"]
      },
      {
        "soubor": "obsah/prevod_pisma.html",
        "nazev": "🧝 Převodník písma",
        "popis": "Přepíše český text elfím písmem, runami, hlaholicí či Braillem",
        "stav": "beta",
        "tagy": ["fonty", "písmo", "elfí písmo", "tengwar", "tolkien", "pán prstenů", "runy", "futhark", "hlaholice", "azbuka", "cyrilice", "alfabeta", "řečtina", "ogam", "braille", "slepecké písmo", "hieroglyfy", "egypt", "fénické písmo", "etruské písmo", "gótské písmo", "morseovka", "přepis", "transliterace", "vlastní font"]
      },
      {
        "soubor": "obsah/prekladac_svetu.html",
        "nazev": "🪐 Překladač do sci-fi a fantasy jazyků",
        "popis": "Přeloží text do elfštiny, dračí řeči a dalších vymyšlených jazyků",
        "stav": "vyvoj",
        "tagy": ["překladač", "vymyšlený jazyk", "conlang", "elfština", "elfí jazyk", "trpasličí", "skřetí", "dračí řeč", "mimozemský jazyk", "robot", "fantasy", "sci-fi", "jména postav", "RPG", "dračí doupě", "tengwar", "runy", "zaklínadla"]
      },
      {
        "soubor": "obsah/pismolijna.html",
        "nazev": "🅰️ Písmolijna – editor písma",
        "popis": "Kreslení glyfů, kerning a export vlastního písma do TTF",
        "stav": "vyvoj",
        "tagy": ["fonty", "písmo", "editor fontů", "fontforge", "glyfy", "bézierovy křivky", "kerning", "ligatury", "diakritika", "ttf", "otf", "woff", "svg font", "typografie", "rukopisné písmo", "obtahování", "vlastní font"]
      },
      {
        "soubor": "obsah/pergamen.html",
        "nazev": "📜 Pergamen",
        "popis": "Listina na pergamenu písmem z webu, se šifrou a šifrovacím klíčem",
        "stav": "vyvoj",
        "tagy": ["pergamen", "listina", "dopis", "svitek", "starý papír", "pečeť", "iniciála", "fonty", "vlastní font", "šifra", "šifrovací klíč", "Caesar", "runy", "ptačí písmo", "pozvánka", "hra", "tisk", "PDF"]
      },
      {
        "soubor": "obsah/emoji_picker.html",
        "nazev": "😀 Picker emoji",
        "popis": "Vyhledá emoji a symboly a zkopíruje je jedním klikem",
        "stav": "beta",
        "tagy": ["emoji", "symboly", "znaky", "kopírovat", "unicode"]
      }
    ]
  },
  {
    "nazev": "🖨️ Tiskoviny & šablony",
    "skupina": "tvorba",
    "polozky": [
      {
        "soubor": "obsah/wedding_invite.html",
        "nazev": "💍 Svatební oznámení",
        "popis": "Navrhne svatební oznámení s texty, písmy a rámečky k tisku",
        "stav": "beta",
        "tagy": ["svatba", "oznámení", "pozvánka", "tisk", "šablona"]
      },
      {
        "soubor": "obsah/certificate_gen.html",
        "nazev": "🏆 Generátor diplomů",
        "popis": "Vytvoří diplom nebo certifikát v několika stylech k tisku",
        "stav": "beta",
        "tagy": ["diplom", "certifikát", "ocenění", "tisk", "soutěž"]
      },
      {
        "soubor": "obsah/sticker_maker.html",
        "nazev": "🏷️ Generátor nálepek",
        "popis": "Přidá obrázku s průhledným pozadím barevný obrys nálepky",
        "stav": "beta",
        "tagy": [
          "sticker",
          "nálepka",
          "obrys"
        ]
      },
      {
        "soubor": "obsah/meme_gen.html",
        "nazev": "🖼️ Generátor meme",
        "popis": "Vloží do obrázku text, šipky a tvary a vytvoří vtipný meme",
        "stav": "beta",
        "tagy": ["meme", "vtip", "obrázek s textem", "popisek"]
      },
      {
        "soubor": "obsah/plakat_utrzky.html",
        "nazev": "📌 Plakát s útržky",
        "popis": "Inzerát na nástěnku s odtrhávacími kontakty, tisk 1:1",
        "stav": "beta",
        "tagy": ["plakát", "inzerát", "vývěska", "útržky", "nástěnka", "tisk", "PDF", "QR"]
      },
      {
        "soubor": "obsah/volvelle.html",
        "nazev": "🎡 Volvelle – otočné kotouče",
        "popis": "Papírové otočné kotouče: věčný kalendář, fáze Měsíce, šifry",
        "stav": "vyvoj",
        "tagy": ["volvelle", "papír", "tisk", "šablona", "kalendář", "měsíc", "šifra", "planisféra", "hvězdy", "logaritmické pravítko", "převodník", "PDF", "SVG", "DXF", "3D", "pro děti"]
      },
      {
        "soubor": "obsah/stencil.html",
        "nazev": "🎨 Šablona na sprej (stencil)",
        "popis": "Udělá z obrázku či textu šablonu k vyříznutí s můstky",
        "stav": "vyvoj",
        "tagy": ["stencil", "šablona", "sprej", "graffiti", "můstky", "ostrůvky", "plotr", "cricut", "silhouette", "laser", "svg", "dxf", "pdf", "vyřezávání", "vrstvy"]
      },
      {
        "soubor": "obsah/krajky.html",
        "nazev": "🪡 Generátor krajek",
        "popis": "Generuje papírové dečky a krajkové lemovky k vystřižení",
        "stav": "vyvoj",
        "tagy": ["krajka", "dečka", "vystřihovánka", "papírová dečka", "lemovka", "paličkování", "podvinek", "torchon", "pavouk", "plátno", "půlhod", "můstky", "plotr", "cricut", "laser", "svg", "dxf", "pdf", "vzor"]
      },
      {
        "soubor": "obsah/pleteni.html",
        "nazev": "🧶 Pletení a háčkování",
        "popis": "Přepočet vzorku a návodu, přidávání oček, spotřeba příze",
        "stav": "beta",
        "tagy": ["pletení", "háčkování", "vzorek", "přepočet návodu", "přidávání oček", "ubírání", "spotřeba příze", "klubka", "počítadlo řad", "schéma vzoru", "žakár", "copánky", "jehlice", "háček", "zkratky návodů"]
      },
      {
        "soubor": "obsah/halloween.html",
        "nazev": "🎃 Halloweenská dílna",
        "popis": "Šablony na pavučiny, vyřezávání dýní, girlandy a siluety",
        "stav": "vyvoj",
        "tagy": ["halloween", "pavučina", "dýně", "šablona na dýni", "vyřezávání dýně", "girlanda", "harmonika", "řetěz z papíru", "netopýr", "duch", "siluety", "dekorace", "okno", "vystřihovánka", "plotr", "cricut", "svg", "dxf", "pdf", "pro děti"]
      },
      {
        "soubor": "obsah/gridGen.html",
        "nazev": "📏 Papíry na tisk",
        "popis": "Čtverečkovaný, linkovaný, tečkovaný či notový papír do PDF",
        "stav": "beta",
        "tagy": ["mřížka", "a4", "a3", "a5", "tisk", "papír", "čtverečky", "milimetrový papír", "linky", "tečky", "izometrie", "notová osnova", "tabulatura", "šestiúhelníky", "kaligrafie", "pdf", "svg"]
      },
      {
        "soubor": "obsah/splitGen.html",
        "nazev": "🍕 Dělič kruhu",
        "popis": "Nakreslí kružnici rozdělenou paprsky na stejné díly k tisku",
        "stav": "beta",
        "tagy": ["kruh", "dělení", "paprsky", "úhly", "šablona"]
      },
      {
        "soubor": "obsah/Circle_generator.html",
        "nazev": "⭕ Kružnice",
        "popis": "Generuje barevné i černobílé kruhové obrazce podle semínka",
        "stav": "beta",
        "tagy": ["kružnice", "obrazce", "geometrie", "generátor", "tisk"]
      },
      {
        "soubor": "obsah/strihy.html",
        "nazev": "✂️ Střihy – oděvy a kopací míč",
        "popis": "Střihy triček, mikin, sukní i kopacího míče v PDF k tisku",
        "stav": "beta",
        "tagy": ["střih", "šití", "oblečení", "tričko", "mikina", "sukně", "kalhoty", "šaty", "halenka", "košile", "vesta", "župan", "kimono", "šortky", "legíny", "zavinovací sukně", "zástěra", "čepice", "kšiltovka", "klobouk", "pelerína", "pončo", "míč", "fotbalový míč", "panely", "šestiúhelník", "pětiúhelník", "střihový plán", "spotřeba látky", "tisk po stranách", "vnořený střih", "pdf", "dxf"]
      },
      {
        "soubor": "obsah/barefoot_vlozky.html",
        "nazev": "🦶 Barefoot vložky – šablony",
        "popis": "Šablona barefoot vložky z rozměrů nohy nebo obkreslené předlohy",
        "stav": "vyvoj",
        "tagy": ["barefoot", "vložka", "stélka", "boty", "obuv", "minimalistická obuv", "chodidlo", "noha", "měření nohy", "velikost bot", "EU", "UK", "US", "Mondopoint", "vnitřní délka", "kontrolní šablona", "zkoušení bot", "plsť", "korek", "kůže", "ořezové čáry", "na míru", "obkreslení", "sken", "fotka", "předloha", "kalibrace", "offset", "obrys", "projekt", "porovnání levé a pravé", "rozvržení na arch", "nesting", "laser", "plotr", "výroba", "kalibrační karta", "stélka", "vyhlazení obrysu", "pelota", "dvouvrstvá vložka", "zakázky", "šablona 1:1", "pdf", "svg", "dxf", "3D"]
      },
      {
        "soubor": "obsah/tech_tisk.html",
        "nazev": "📏 Technický generátor pro tisk",
        "popis": "Pravítka, úhloměry, stupnice a vrtací šablony v měřítku 1:1",
        "stav": "vyvoj",
        "tagy": ["pravítko", "úhloměr", "stupnice", "číselník", "dělicí kotouč", "vrtací šablona", "rozteč otvorů", "PCD", "VESA", "NEMA", "mřížka", "milimetrový papír", "π-páska", "měřítko", "řezací podložka", "kalibrace tiskárny", "rádiusové měrky", "závitové měrky", "logaritmické pravítko", "semilogaritmický papír", "ternární diagram", "rozvinutí kužele", "sedlo trubky", "segmentové koleno", "šablona kružnic", "elipsa", "tisk 1:1", "PDF", "SVG", "DXF", "PNG", "laser"]
      },
      {
        "soubor": "obsah/stitky_panely.html",
        "nazev": "🎛️ Štítky a čelní panely",
        "popis": "Navrhne štítky a čelní panely v mm s otvory pro laser a CNC",
        "stav": "vyvoj",
        "tagy": ["štítky", "čelní panel", "Eurorack", "19\" rack", "laser", "CNC", "SVG", "DXF", "PDF 1:1", "samolepky", "elektronika"]
      },
      {
        "soubor": "obsah/krabice_fefco.html",
        "nazev": "📦 Krabice z kartonu (FEFCO)",
        "popis": "Rozvinutý střih krabice z lepenky podle kódu FEFCO",
        "stav": "vyvoj",
        "tagy": ["krabice", "FEFCO", "vlnitá lepenka", "karton", "rozvin", "výsek", "dieline", "skládačka", "obal", "SVG", "DXF", "PDF", "plotr", "laser", "3D"]
      },
      {
        "soubor": "obsah/karty_generator.html",
        "nazev": "🎴 Generátor karet a kartiček",
        "popis": "Navrhne karty do deskovek, kvízů a kartičky ze seznamu dat",
        "stav": "vyvoj",
        "tagy": ["karty", "kartičky", "deskovka", "flashcards", "RPG", "kvíz", "slovíčka", "hromadný tisk", "CSV", "XLSX", "PDF", "spadávka", "ořezové značky", "oboustranný tisk"]
      },
      {
        "soubor": "obsah/stitky_hromadne.html",
        "nazev": "🏷️ Hromadný tisk štítků",
        "popis": "Tiskne adresní štítky, cenovky a jmenovky z tabulky dat",
        "stav": "vyvoj",
        "tagy": ["štítky", "etikety", "adresy", "cenovky", "jmenovky", "inventář", "QR", "EAN", "Code128", "Avery", "Zweckform", "arch", "hromadná korespondence", "CSV", "XLSX", "tisk", "PDF"]
      },
      {
        "soubor": "obsah/vstupenky.html",
        "nazev": "🎟️ Vstupenky, kupóny a poukazy",
        "popis": "Číslované vstupenky, kupóny a poukazy s QR kódy k tisku",
        "stav": "vyvoj",
        "tagy": ["vstupenka", "kupón", "poukaz", "tombola", "číslování", "QR", "sedadla", "kontrola vstupu", "tisk", "PDF"]
      },
      {
        "soubor": "obsah/puzzle_generator.html",
        "nazev": "🧩 Generátor puzzle z fotky",
        "popis": "Rozřeže fotku na dílky puzzle k tisku, laseru nebo hraní",
        "stav": "vyvoj",
        "tagy": ["puzzle", "jigsaw", "skládačka", "fotka", "laser", "plotter", "SVG", "DXF", "PDF", "řezací šablona", "whimsy", "dětské puzzle", "hra"]
      },
      {
        "soubor": "obsah/omalovanky.html",
        "nazev": "🖍️ Omalovánky z fotky",
        "popis": "Převede fotku na obrysovou omalovánku nebo malování podle čísel",
        "stav": "vyvoj",
        "tagy": ["omalovánky", "obrázky", "děti", "tisk", "malování podle čísel", "skica", "hrany", "PDF"]
      },
      {
        "soubor": "obsah/plakat_mapy.html",
        "nazev": "🗺️ Plakát mapy",
        "popis": "Plakát s mapou města nebo hvězdnou oblohou z OpenStreetMap",
        "stav": "vyvoj",
        "tagy": ["plakát", "mapa", "city map poster", "tisk", "hvězdná obloha", "OpenStreetMap", "PDF", "dárek"]
      },
      {
        "soubor": "obsah/zasedaci_poradek.html",
        "nazev": "🪑 Zasedací pořádek a jmenovky",
        "popis": "Rozsadí hosty ke stolům, nakreslí plánek a vytiskne jmenovky",
        "stav": "vyvoj",
        "tagy": ["zasedací pořádek", "svatba", "oslava", "konference", "hosté", "stoly", "plánek sálu", "rozsazení", "jmenovky", "stanové karty", "čísla stolů", "menu", "tisk"]
      },
      {
        "soubor": "obsah/origami.html",
        "nazev": "🦢 Origami – návody a papíry",
        "popis": "Návody na origami modely krok za krokem a papír k tisku",
        "stav": "vyvoj",
        "tagy": ["origami", "skládání papíru", "návod", "jeřáb", "žabka", "lodička", "vlaštovka", "krabička masu", "sonobe", "modulární origami", "crease pattern", "papír k tisku", "vzory", "oboustranný tisk"]
      }
    ]
  },
  {
    "nazev": "🖼️ Obrázky & foto",
    "skupina": "tvorba",
    "polozky": [
      {
        "soubor": "obsah/fotokniha.html",
        "nazev": "📔 Fotokniha – návrhář",
        "popis": "Rozvrhne fotky a texty do fotoknihy a připraví PDF k tisku",
        "stav": "vyvoj",
        "tagy": ["fotokniha", "fotoalbum", "album", "kniha z fotek", "rozvržení", "dvoustrana", "spadávka", "ořez", "dpi", "pdf k tisku", "tisk", "fotolab", "lay-flat", "koláž"]
      },
      {
        "soubor": "obsah/IMG_print.html",
        "nazev": "🖼️ Tisk obrázků na A4",
        "popis": "Vytiskne obrázky na A4 v přesné velikosti v milimetrech",
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
        "popis": "Převede obrázek mezi WebP, PNG a JPG přímo v prohlížeči",
        "stav": "beta",
        "tagy": [
          "webp",
          "png",
          "jpg",
          "formát"
        ]
      },
      {
        "soubor": "obsah/image_crop.html",
        "nazev": "✂️ Ořez obrázku",
        "popis": "Ořízne obrázek volně nebo v zadaném poměru stran",
        "stav": "beta",
        "tagy": ["ořez", "crop", "obrázek", "poměr stran", "úprava fotky"]
      },
      {
        "soubor": "obsah/watermark.html",
        "nazev": "💧 Vodoznak",
        "popis": "Vloží do fotky textový vodoznak, třeba dlaždicově přes celou",
        "stav": "beta",
        "tagy": ["vodoznak", "logo", "ochrana fotky", "copyright"]
      },
      {
        "soubor": "obsah/PNG_merger.html",
        "nazev": "🖼️ Koláže",
        "popis": "Poskládá více obrázků do koláže na plátně a vyexportuje ji",
        "stav": "beta",
        "tagy": [
          "koláž",
          "spojení obrázků",
          "mřížka"
        ]
      },
      {
        "soubor": "obsah/dither.html",
        "nazev": "🌫️ Dithering obrázku",
        "popis": "Převede obrázek na retro rastr s omezenou paletou barev",
        "stav": "beta",
        "tagy": ["dithering", "pixelizace", "rastr", "retro", "obrázek"]
      },
      {
        "soubor": "obsah/foto_filtry.html",
        "nazev": "🎨 Fotofiltry – umělecké efekty a úpravy fotek",
        "popis": "Umělecké filtry jako olejomalba či kresba a úpravy fotek",
        "stav": "vyvoj",
        "tagy": ["filtry", "foto filtry", "efekty", "pointilismus", "olejomalba", "akvarel", "kresba tužkou", "uhel", "perokresba", "šrafování", "komiks", "pop-art", "rastr", "halftone", "vitráž", "ASCII art", "glitch", "VHS", "tilt-shift", "miniatura", "sépie", "černobílá", "vintage", "duotón", "termovize", "kaleidoskop", "malá planeta", "jas", "kontrast", "sytost", "teplota", "vinětace"]
      },
      {
        "soubor": "obsah/vzory_z_obrazku.html",
        "nazev": "🧵 Vzory z obrázku: křížková výšivka, korálky, mozaika",
        "popis": "Převede obrázek na vzor pro výšivku, korálky nebo mozaiku",
        "stav": "vyvoj",
        "tagy": ["výšivka", "křížková výšivka", "DMC", "korálky", "zažehlovací korálky", "Hama", "Perler", "Artkal", "mozaika", "LEGO", "vzor", "pixel art", "paleta", "ruční práce", "tisk", "PDF"]
      },
      {
        "soubor": "obsah/obrazky_davka.html",
        "nazev": "🗂️ Hromadné úpravy obrázků",
        "popis": "Zmenší, ořízne a převede celou dávku obrázků najednou",
        "stav": "vyvoj",
        "tagy": ["hromadně", "dávka", "složka", "zmenšení", "ořez", "převod", "webp", "avif", "jpg", "vodoznak", "přejmenování", "exif", "gps", "cílová velikost", "zip"]
      },
      {
        "soubor": "obsah/pozadi.html",
        "nazev": "✂️ Odstranění pozadí",
        "popis": "Odstraní pozadí fotky pomocí AI a uloží průhledné PNG",
        "stav": "vyvoj",
        "tagy": ["pozadí", "odstranit pozadí", "průhledné PNG", "AI", "U2-Net", "chroma key", "zelené plátno", "kouzelná hůlka", "maska", "výřez", "fotka", "stín"]
      },
      {
        "soubor": "obsah/vektorizace.html",
        "nazev": "〰️ Vektorizace – bitmapa → SVG/DXF",
        "popis": "Převede bitmapu na vektory SVG nebo DXF pro řezání",
        "stav": "vyvoj",
        "tagy": ["vektorizace", "trasování", "trace", "bitmapa", "obrázek", "svg", "dxf", "png", "logo", "laser", "plotr", "řezání", "fólie", "středová čára", "centerline", "barvy", "kvantizace", "bézier", "mm"]
      },
      {
        "soubor": "obsah/animace_gif.html",
        "nazev": "🎞️ GIF, animace a sprite sheety",
        "popis": "Skládá snímky do GIFu, APNG či WebM a tvoří sprite sheety",
        "stav": "vyvoj",
        "tagy": ["gif", "animace", "apng", "webm", "sprite sheet", "pixel art", "video na gif", "texturepacker", "phaser", "časová osa"]
      },
      {
        "soubor": "obsah/anonymizace.html",
        "nazev": "🕶️ Anonymizace fotek",
        "popis": "Rozmaže obličeje a SPZ na fotkách a smaže polohu z EXIF",
        "stav": "vyvoj",
        "tagy": ["anonymizace", "rozmazání obličejů", "SPZ", "pixelizace", "EXIF", "GPS", "XMP", "IPTC", "metadata", "soukromí", "GDPR", "dávkově", "video", "protokol"]
      },
      {
        "soubor": "obsah/panorama.html",
        "nazev": "🌄 Skládání panoramat",
        "popis": "Složí fotky do panoramatu včetně 360° a malé planety",
        "stav": "vyvoj",
        "tagy": ["panorama", "stitching", "spojení fotek", "360°", "sférické panorama", "malá planeta", "kontrolní body", "bundle adjustment", "GPano", "EXIF", "foto"]
      },
      {
        "soubor": "obsah/pred_po.html",
        "nazev": "↔️ Porovnání před a po",
        "popis": "Porovná dva obrázky posuvníkem, lupou nebo mapou rozdílů",
        "stav": "vyvoj",
        "tagy": ["před a po", "porovnání obrázků", "posuvník", "rozdíl", "PSNR", "SSIM", "heat-mapa", "zarovnání", "rekonstrukce", "staré foto", "blikání", "GIF", "vložitelný posuvník"]
      }
    ]
  },
  {
    "nazev": "🎬 Audio & video",
    "skupina": "tvorba",
    "polozky": [
      {
        "soubor": "obsah/videocutter.html",
        "nazev": "🎬 Video ořez",
        "popis": "Ořízne video a vyexportuje z něj zvukovou stopu do MP3",
        "stav": "beta",
        "tagy": [
          "video",
          "střih"
        ]
      },
      {
        "soubor": "obsah/video_sekce.html",
        "nazev": "🎞️ Dělení videa na sekce",
        "popis": "Rozdělí video snímkově přesně na pojmenované části",
        "stav": "vyvoj",
        "tagy": ["video", "střih", "sekce", "rozdělit", "snímek", "export"]
      },
      {
        "soubor": "obsah/lamamp.html",
        "nazev": "🦙 Lamamp – přehrávač",
        "popis": "Retro hudební přehrávač se skiny, playlisty a rádiem",
        "stav": "vyvoj",
        "tagy": ["hudba", "přehrávač", "mp3", "lamamp", "retro", "playlist", "ekvalizér", "skin"]
      },
      {
        "soubor": "obsah/nahnoji.html",
        "nazev": "📼 Videotéka",
        "popis": "Přehrává seriály a videa a pamatuje si, kde jste skončili",
        "stav": "beta",
        "tagy": ["video", "videa", "nahnoji", "přehrávač", "galerie", "videotéka", "seriály", "sdílení"]
      },
      {
        "soubor": "obsah/mp3cutter.html",
        "nazev": "✂️ MP3 ořez",
        "popis": "Ořízne MP3 podle vlnového průběhu, třeba na vyzvánění",
        "stav": "beta",
        "tagy": [
          "hudba",
          "střih",
          "audio",
          "vyzvánění"
        ]
      },
      {
        "soubor": "obsah/voice_recorder.html",
        "nazev": "🎙️ Hlasový záznamník",
        "popis": "Nahraje hlas z mikrofonu a uloží ho, vše jen v prohlížeči",
        "stav": "beta",
        "tagy": ["nahrávání", "diktafon", "mikrofon", "audio", "záznam"]
      },
      {
        "soubor": "obsah/soundGen.html",
        "nazev": "🎵 Generátor zvuku",
        "popis": "Syntezátor tónů a melodií s filtrem, LFO a exportem do WAV",
        "stav": "beta",
        "tagy": ["zvuk", "tón", "frekvence", "generátor", "sinus"]
      },
      {
        "soubor": "obsah/spectrum_visualizer.html",
        "nazev": "🎵 Zvukový vizualizér",
        "popis": "Zobrazí spektrum a vlnu zvuku z mikrofonu nebo souboru",
        "stav": "beta",
        "tagy": ["spektrum", "vizualizace", "hudba", "fft", "analyzér"]
      },
      {
        "soubor": "obsah/piano.html",
        "nazev": "🎹 Piano",
        "popis": "Hrajte na klavír myší, dotykem nebo klávesnicí",
        "stav": "beta",
        "tagy": ["klavír", "klávesy", "hudba", "tóny", "nástroj"]
      },
      {
        "soubor": "obsah/tuner.html",
        "nazev": "🎸 Ladička",
        "popis": "Chromatické ladění kytary a dalších nástrojů přes mikrofon",
        "stav": "beta",
        "tagy": ["ladička", "kytara", "ladění", "tón", "frekvence"]
      },
      {
        "soubor": "obsah/metronome.html",
        "nazev": "🥁 Metronom",
        "popis": "Odklepává tempo v BPM s přízvukem taktu a tap tempem",
        "stav": "beta",
        "tagy": ["metronom", "tempo", "bpm", "rytmus", "cvičení"]
      },
      {
        "soubor": "obsah/titulky.html",
        "nazev": "💬 Editor titulků",
        "popis": "Upraví a přečasuje titulky SRT, VTT či ASS podle videa",
        "stav": "vyvoj",
        "tagy": ["titulky", "srt", "vtt", "ass", "ssa", "sub", "sbv", "přečasování", "synchronizace", "fps", "kódování", "windows-1250", "vypálení", "video", "přepis"]
      }
    ]
  },
  {
    "nazev": "⚙️ Strojírenství",
    "skupina": "technika",
    "polozky": [
      {
        "soubor": "obsah/ozubena_kola.html",
        "nazev": "⚙️ Návrhář ozubených soukolí",
        "popis": "Čelní, planetová i šneková soukolí s výpočtem a exportem",
        "stav": "beta",
        "tagy": ["ozubená kola", "ozubení", "převod", "převodovka", "evolventa", "modul", "pastorek", "šikmé zuby", "šípové zuby", "hřeben", "planetová převodovka", "vnitřní ozubení", "cevové soukolí", "lucerna", "mlýn", "hodinové kolo", "cykloida", "maltézský kříž", "rohatka", "západka", "kusovník", "stl", "3mf", "dxf", "3d tisk"]
      },
      {
        "soubor": "obsah/evolventni_kola.html",
        "nazev": "⚙️ Evolventní kola – přesný generátor",
        "popis": "Přesný profil evolventního kola pro 3D tisk, STL a DXF",
        "stav": "vyvoj",
        "tagy": ["strojírenství", "ozubení", "CAD", "3D tisk", "STL", "DXF", "SVG", "výuka", "gear_generator"]
      },
      {
        "soubor": "obsah/prevody_mech.html",
        "nazev": "⚙️ Návrhář mechanických převodů",
        "popis": "Skládá převody z kol, řemenic a řetězů a simuluje pohyb",
        "stav": "vyvoj",
        "tagy": ["strojírenství", "převody", "ozubená kola", "řemen", "řetěz", "kinematika", "simulace"]
      },
      {
        "soubor": "obsah/gear_ratio.html",
        "nazev": "⚙️ Kalkulačka převodového poměru",
        "popis": "Spočítá převod, otáčky a moment přes kola i řemenice",
        "stav": "beta",
        "tagy": ["převod", "poměr", "kola", "otáčky", "řemenice"]
      },
      {
        "soubor": "obsah/vacky.html",
        "nazev": "⚙️ Návrhář diskových vaček",
        "popis": "Profil diskové vačky podle zvoleného pohybového zákona",
        "stav": "vyvoj",
        "tagy": ["strojírenství", "mechanismy", "vačky", "kinematika", "CAD", "export", "3D tisk"]
      },
      {
        "soubor": "obsah/turbina_navrhar.html",
        "nazev": "🌀 Návrhář turbín a proudění",
        "popis": "Simuluje proudění kolem rotoru turbíny nebo vrtule",
        "stav": "beta",
        "tagy": ["turbína", "vrtule", "proudění", "cfd", "lbm", "větrná elektrárna", "savonius", "darrieus", "gorlov", "tesla", "pelton", "kaplan", "bánki", "cross-flow", "lopatka", "naca", "bem", "aerodynamika", "hydrodynamika", "stl"]
      },
      {
        "soubor": "obsah/screw_calc.html",
        "nazev": "🔩 Šrouby & závity",
        "popis": "Tabulka metrických závitů, vrták pro závit a utahovací moment",
        "stav": "beta",
        "tagy": [
          "závit",
          "metrický",
          "utahovací moment"
        ]
      },
      {
        "soubor": "obsah/spring_calc.html",
        "nazev": "🌀 Kalkulačka pružin",
        "popis": "Spočítá tuhost a sílu tažné či tlačné pružiny",
        "stav": "beta",
        "tagy": [
          "pružina",
          "tuhost",
          "strojírenství"
        ]
      },
      {
        "soubor": "obsah/sheet_bend.html",
        "nazev": "📐 Rozvin plechu",
        "popis": "Spočítá rozvinutou délku ohýbaného plechu z K-faktoru",
        "stav": "beta",
        "tagy": ["plech", "ohyb", "rozvin", "ohraňování", "k-faktor"]
      },
      {
        "soubor": "obsah/cutting_speed.html",
        "nazev": "⚙️ Řezné podmínky",
        "popis": "Otáčky a posuv pro frézování a soustružení podle materiálu",
        "stav": "beta",
        "tagy": ["obrábění", "otáčky", "posuv", "fréza", "soustružení"]
      },
      {
        "soubor": "obsah/iso_tolerance.html",
        "nazev": "📏 Tolerance a uložení ISO",
        "popis": "Mezní úchylky děr a hřídelí a charakter uložení podle ISO 286",
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
        "soubor": "obsah/loziska.html",
        "nazev": "⚙️ Ložiska, O-kroužky a těsnění",
        "popis": "Dekóduje označení ložisek, hledá podle rozměrů, O-kroužky",
        "stav": "beta",
        "tagy": ["ložiska", "kuličková ložiska", "6204", "608", "2RS", "ZZ", "C3", "O-kroužky", "drážka O-kroužku", "AS568", "gufera", "těsnění", "L10", "uložení", "strojírenství", "3D tisk", "STL"]
      },
      {
        "soubor": "obsah/hardness_conv.html",
        "nazev": "🔨 Převodník tvrdosti",
        "popis": "Převádí tvrdost HB, HV, HRC a pevnost oceli",
        "stav": "beta",
        "tagy": ["tvrdost", "hrc", "hb", "vickers", "rockwell"]
      },
      {
        "soubor": "obsah/material_weight.html",
        "nazev": "⚖️ Hmotnost materiálu",
        "popis": "Spočítá hmotnost tyče, plechu či trubky z materiálu",
        "stav": "beta",
        "tagy": [
          "ocel",
          "hliník",
          "hustota",
          "hmotnost"
        ]
      },
      {
        "soubor": "obsah/remenice.html",
        "nazev": "🛞 Řemenice GT2/HTD a napínáky",
        "popis": "Ozubené řemenice GT2 a HTD a napínáky pro 3D tisk",
        "stav": "vyvoj",
        "tagy": ["3D tisk", "STL", "3MF", "řemenice", "GT2", "HTD", "T5", "MXL", "ozubený řemen", "napínák", "kladka", "ložisko", "délka řemene", "převod"]
      }
    ]
  },
  {
    "nazev": "🪚 Truhlářství",
    "skupina": "technika",
    "polozky": [
      {
        "soubor": "obsah/navrh_skrini.html",
        "nazev": "🗄️ Návrh skříní a korpusů",
        "popis": "Navrhne korpusový nábytek s kusovníkem a plánem vrtání",
        "stav": "vyvoj",
        "tagy": ["skříň", "korpus", "nábytek", "kuchyňská linka", "DTD", "kusovník", "řezný plán", "systém 32", "závěsy", "zásuvky", "výsuvy", "konfirmát", "vrtání", "DXF", "CNC", "PDF", "3D"]
      },
      {
        "soubor": "obsah/rezny_plan.html",
        "nazev": "📏 Řezný plán – optimalizace dělení",
        "popis": "Optimalizuje dělení desek a tyčí s co nejmenším odpadem",
        "stav": "vyvoj",
        "tagy": ["truhlářství", "nábytek", "dělení desek", "optimalizace", "DTD", "MDF", "překližka", "hranování", "1D řezání", "CNC", "PDF", "štítky", "DXF"]
      },
      {
        "soubor": "obsah/truhlarske_spoje.html",
        "nazev": "🪚 Šablony truhlářských spojů",
        "popis": "Rybiny a další dřevěné spoje s orýsovacími šablonami 1:1",
        "stav": "vyvoj",
        "tagy": ["truhlářství", "dřevo", "spoje", "rybina", "dovetail", "cinky", "čep a dlab", "přeplátování", "pero a drážka", "kolíky", "lamely", "šablona", "tisk 1:1", "PDF", "SVG", "DXF", "STL", "3D", "kusovník", "CNC"]
      },
      {
        "soubor": "obsah/kolikovaci_pripravky.html",
        "nazev": "🔩 Kolíkovací a kapsové přípravky",
        "popis": "Přípravky na kolíky, kapsové spoje a konfirmáty k tisku",
        "stav": "vyvoj",
        "tagy": ["truhlářství", "kolíky", "pocket hole", "kapsový spoj", "konfirmát", "excentr", "přípravek", "3D tisk", "STL", "šablona", "PDF 1:1"]
      },
      {
        "soubor": "obsah/pripravky_pila.html",
        "nazev": "🪚 Přípravky pro pilu a vrtačku",
        "popis": "Parametrické přípravky ke stolní, pokosové pile a vrtačce",
        "stav": "vyvoj",
        "tagy": ["truhlářství", "stolní pila", "okružní pila", "pokosová pila", "vrtačka", "přípravky", "3D tisk", "STL", "DXF", "PDF 1:1", "kalkulačka"]
      },
      {
        "soubor": "obsah/sablony_frezka.html",
        "nazev": "🌀 Šablony pro horní frézku",
        "popis": "Kopírovací šablony s ofsetem pro kroužek nebo ložisko frézky",
        "stav": "vyvoj",
        "tagy": ["frézka", "kopírovací kroužek", "šablona", "ofset", "truhlářství", "kruhové rameno", "motýlek", "DXF", "STL", "PDF 1:1"]
      },
      {
        "soubor": "obsah/vrtaci_sablony.html",
        "nazev": "🔩 Vrtací šablony",
        "popis": "Vrtací šablony 1:1 pro systém 32, závěsy, úchytky a kolíky",
        "stav": "vyvoj",
        "tagy": ["vrtání", "šablona", "systém 32", "závěsy", "kolíky", "úchytky", "VESA", "KU 68", "PCD", "PDF 1:1", "STL", "3D tisk", "přípravek"]
      },
      {
        "soubor": "obsah/oblouky_profily.html",
        "nazev": "〰️ Šablony oblouků a profilů",
        "popis": "Oblouky, elipsy, řetězovky a profily nohou k tisku 1:1",
        "stav": "vyvoj",
        "tagy": ["truhlářství", "oblouk", "elipsa", "parabola", "řetězovka", "spline", "pružná lať", "kabriolová noha", "kuželová noha", "soustružení", "měrka průměrů", "ogee", "profil lišty", "šablona", "tisk 1:1", "PDF", "DXF", "STL", "3D"]
      },
      {
        "soubor": "obsah/ohyb_dreva.html",
        "nazev": "🌙 Ohýbání dřeva – formy a kopyta",
        "popis": "Výpočet lamel, odpružení a forem pro ohýbání dřeva",
        "stav": "vyvoj",
        "tagy": ["truhlářství", "ohýbání dřeva", "laminování", "pára", "kerf", "formy", "MDF", "tisk 1:1", "DXF", "STL", "kusovník"]
      },
      {
        "soubor": "obsah/segmentove_soustruzeni.html",
        "nazev": "🏺 Segmentové soustružení",
        "popis": "Rozdělí mísu či vázu na kroužky segmentů s úhly a délkami",
        "stav": "vyvoj",
        "tagy": ["soustružení", "segmentové soustružení", "segmented turning", "mísa", "váza", "kroužky", "segmenty", "pokos", "ozdobný pás", "řezný plán", "šablona 1:1", "PDF", "DXF", "STL", "3D", "truhlářství"]
      },
      {
        "soubor": "obsah/intarzie.html",
        "nazev": "🧩 Intarzie a parketáž",
        "popis": "Navrhne vzory z dýh: rybí kost, šachovnice, teselace",
        "stav": "vyvoj",
        "tagy": ["intarzie", "marketerie", "parketáž", "dýha", "rybí kost", "šachovnice", "kompasová růžice", "teselace", "Escher", "bookmatch", "řezný plán", "laser", "kerf", "SVG", "DXF", "PDF", "3D", "truhlářství"]
      },
      {
        "soubor": "obsah/prkenka.html",
        "nazev": "🔲 Prkénka a lepené vzory",
        "popis": "Krájecí prkénka z lepených pruhů s postupem výroby",
        "stav": "vyvoj",
        "tagy": ["truhlářství", "krájecí prkénko", "end grain", "šachovnice", "3D kostky", "chevron", "řezný seznam", "PDF", "DXF", "3D"]
      },
      {
        "soubor": "obsah/drevene_hracky.html",
        "nazev": "🧸 Dřevěné hračky a dětský nábytek",
        "popis": "Kostky, kuličková dráha, zvířátka a dětský nábytek ze dřeva",
        "stav": "vyvoj",
        "tagy": ["hračky", "kostky", "stavebnice", "kuličková dráha", "puzzle", "lupenková pila", "zvířátka", "tahací hračka", "učící věž", "dětský nábytek", "EN 71-1", "ergonomie", "stabilita", "šablona 1:1", "PDF", "DXF", "STL", "3D"]
      },
      {
        "soubor": "obsah/rostouci_zidle.html",
        "nazev": "🪑 Rostoucí židle",
        "popis": "Dětská židle s přestavitelným sedákem, roste s dítětem",
        "stav": "beta",
        "tagy": ["rostoucí židle", "dětská židle", "nábytek", "ergonomie", "EN 1729", "WHO", "drážky", "stabilita", "truhlářství", "šablona 1:1", "PDF", "DXF", "SVG", "CNC", "STL", "řezný plán", "3D"]
      },
      {
        "soubor": "obsah/ostreni.html",
        "nazev": "🔪 Ostření dlát a hoblíků – přípravky",
        "popis": "Úhly ostří a přípravky na ostření dlát a hoblíků",
        "stav": "vyvoj",
        "tagy": ["ostření", "dláto", "hoblík", "honovací vozík", "3D tisk", "STL", "bruska", "truhlářství", "šablona"]
      },
      {
        "soubor": "obsah/drevo_vypocty.html",
        "nazev": "🌳 Dřevo – pohyb, průhyb, povrchy",
        "popis": "Pohyb masivu podle vlhkosti, průhyb polic a povrchové úpravy",
        "stav": "vyvoj",
        "tagy": ["dřevo", "truhlářství", "vlhkost", "EMC", "sesychání", "průhyb", "police", "povrchová úprava", "lak", "olej", "řezivo", "objem"]
      },
      {
        "soubor": "obsah/kalkulace_zakazky.html",
        "nazev": "🧮 Kalkulace truhlářské zakázky",
        "popis": "Spočítá materiál, práci a cenovou nabídku truhlářské zakázky",
        "stav": "vyvoj",
        "jen_cs": true,
        "tagy": ["kalkulace", "nabídka", "cenová nabídka", "truhlář", "zakázka", "ceník", "prořez", "hranování", "kování", "režie", "marže", "DPH", "varianty", "plán vs. skutečnost", "kusovník", "PDF"]
      }
    ]
  },
  {
    "nazev": "🏠 Stavba & dům",
    "skupina": "technika",
    "polozky": [
      {
        "soubor": "obsah/pudorys.html",
        "nazev": "🏠 Půdorys a rozvody",
        "popis": "Nakreslí půdorys s kótami, rozvody, vybavením a 3D náhledem",
        "stav": "beta",
        "tagy": ["půdorys", "dispozice", "patro", "místnost", "stěny", "okna", "dveře", "kóty", "rozvody", "voda", "elektro", "kanalizace", "plyn", "topení", "zásuvky", "dxf", "3d", "výkaz", "plocha m2", "stavba", "rekonstrukce"]
      },
      {
        "soubor": "obsah/wooden_shed_3d.html",
        "nazev": "🪵 Dřevěná stavba – 3D a kusovník",
        "popis": "3D kostra kůlny či přístřešku s kusovníkem a postupem",
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
        "soubor": "obsah/schodiste.html",
        "nazev": "🪜 Návrh schodiště",
        "popis": "Navrhne schody podle ČSN 73 4130 včetně točitých",
        "stav": "vyvoj",
        "jen_cs": true,
        "tagy": ["schody", "schodiště", "ČSN 73 4130", "stupně", "kosé stupně", "točité", "vřetenové", "schodnice", "podchodná výška", "stropní otvor", "zábradlí", "DXF", "rodinný dům", "tesařina"]
      },
      {
        "soubor": "obsah/roof_pitch_calc.html",
        "nazev": "🏠 Sklon střechy, krokve a plocha",
        "popis": "Spočítá sklon, délku krokví a plochu sedlové či valbové střechy",
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
        "soubor": "obsah/rafter_spacing_calc.html",
        "nazev": "📐 Rozteč krokví / trámků",
        "popis": "Rozmístí krokve rovnoměrně po pozednici podle počtu či rozteče",
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
        "soubor": "obsah/concrete_mix_calc.html",
        "nazev": "🧱 Betonová směs",
        "popis": "Kolik cementu, písku a štěrku potřebujete na desku či sloup",
        "stav": "beta",
        "tagy": [
          "beton",
          "cement",
          "stavba",
          "základy"
        ]
      },
      {
        "soubor": "obsah/paint_coverage_calc.html",
        "nazev": "🎨 Spotřeba barvy/tapety",
        "popis": "Kolik barvy nebo rolí tapety potřebujete na místnost",
        "stav": "beta",
        "tagy": [
          "malování",
          "barva",
          "tapeta",
          "místnost"
        ]
      },
      {
        "soubor": "obsah/tepelne_ztraty.html",
        "nazev": "🌡️ Tepelné ztráty a skladby konstrukcí",
        "popis": "Součinitel U, kondenzace a tepelné ztráty budovy podle ČSN",
        "stav": "vyvoj",
        "jen_cs": true,
        "tagy": ["tepelné ztráty", "součinitel U", "skladba konstrukce", "ČSN 73 0540", "kondenzace", "Glaser", "rosný bod", "plísně", "fRsi", "tepelné čerpadlo", "kotel", "izolace", "zateplení", "lambda"]
      },
      {
        "soubor": "obsah/destova_voda.html",
        "nazev": "🌧️ Dešťová voda",
        "popis": "Žlaby a svody, akumulační nádrž a vsakování dešťové vody",
        "stav": "vyvoj",
        "jen_cs": true,
        "tagy": ["dešťová voda", "srážky", "žlab", "svod", "odvodnění střechy", "akumulační nádrž", "vsakování", "retenční nádrž", "ČSN 75 9010", "ČSN 75 6760", "zalévání", "úspora vody"]
      }
    ]
  },
  {
    "nazev": "🧮 Výpočty & převody",
    "skupina": "technika",
    "polozky": [
      {
        "soubor": "obsah/Vzorce.html",
        "nazev": "🧮 Modul vzorců",
        "popis": "Ukládá vlastní vzorce s proměnnými, počítá je a zobrazí v LaTeXu",
        "stav": "beta",
        "tagy": [
          "matematika",
          "výpočty",
          "vzorce",
          "latex"
        ]
      },
      {
        "soubor": "obsah/equation_solver.html",
        "nazev": "🧮 Řešič rovnic",
        "popis": "Vyřeší lineární a kvadratickou rovnici i soustavu dvou rovnic",
        "stav": "beta",
        "tagy": ["rovnice", "kvadratická", "soustava", "řešení", "kořeny"]
      },
      {
        "soubor": "obsah/function_plot.html",
        "nazev": "📈 Kreslič grafů funkcí",
        "popis": "Nakreslí grafy jedné či více funkcí y = f(x) v zadaném rozsahu",
        "stav": "beta",
        "tagy": ["graf funkce", "kreslení", "matematika", "parabola", "průběh"]
      },
      {
        "soubor": "obsah/statistics.html",
        "nazev": "📊 Statistika dat",
        "popis": "Spočítá průměr, medián, rozptyl, kvartily a histogram z čísel",
        "stav": "beta",
        "tagy": ["průměr", "medián", "směrodatná odchylka", "data", "statistika"]
      },
      {
        "soubor": "obsah/triangle_calc.html",
        "nazev": "📐 Trojúhelník",
        "popis": "Dopočítá strany, úhly a obsah trojúhelníku ze tří zadaných hodnot",
        "stav": "beta",
        "tagy": ["trojúhelník", "sinus", "kosinus", "strany", "úhly"]
      },
      {
        "soubor": "obsah/right_triangle.html",
        "nazev": "📐 Pravoúhlý trojúhelník",
        "popis": "Dopočítá odvěsny, přeponu a úhly ze dvou zadaných hodnot",
        "stav": "beta",
        "tagy": ["pravoúhlý", "pythagoras", "odvěsna", "přepona", "trojúhelník"]
      },
      {
        "soubor": "obsah/angle_converter.html",
        "nazev": "📐 Úhly & měřítka",
        "popis": "Převádí stupně, radiány a gony, sklon v procentech a měřítka map",
        "stav": "beta",
        "tagy": ["úhly", "stupně", "radiány", "měřítko", "sklon"]
      },
      {
        "soubor": "obsah/number_base.html",
        "nazev": "🔢 Číselné soustavy",
        "popis": "Převádí čísla mezi dvojkovou, osmičkovou, desítkovou a hex soustavou",
        "stav": "beta",
        "tagy": ["binární", "hexadecimální", "osmičková", "soustava", "převod"]
      },
      {
        "soubor": "obsah/pressure_force.html",
        "nazev": "🔧 Tlak / síla / moment",
        "popis": "Převádí jednotky tlaku, síly a krouticího momentu",
        "stav": "beta",
        "tagy": ["tlak", "síla", "moment", "bar", "newton", "převod"]
      },
      {
        "soubor": "obsah/beam_deflection.html",
        "nazev": "🏗️ Průhyb nosníku",
        "popis": "Spočítá průhyb a ohybový moment nosníku podle uložení a zatížení",
        "stav": "beta",
        "tagy": ["nosník", "průhyb", "zatížení", "statika", "ohyb"]
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
        "popis": "Odhadne měsíční a roční výrobu FVE podle polohy, sklonu a orientace",
        "stav": "vyvoj",
        "tagy": ["fotovoltaika", "FVE", "solár", "výroba elektřiny", "návratnost", "PVGIS", "energie"]
      },
      {
        "soubor": "obsah/offgrid_baterie.html",
        "nazev": "🔋 Ostrovní systém",
        "popis": "Navrhne baterii, měnič a panely off-grid systému podle spotřebičů",
        "stav": "vyvoj",
        "tagy": ["off-grid", "baterie", "LiFePO4", "měnič", "solární panel", "MPPT", "chata", "průřez kabelu"]
      },
      {
        "soubor": "obsah/baterie_pack.html",
        "nazev": "🔋 Návrh bateriového packu",
        "popis": "Sestaví pack z článků 18650 a dalších: zapojení S×P, kapacita, držák",
        "stav": "vyvoj",
        "tagy": ["baterie", "akumulátor", "18650", "21700", "LiFePO4", "Li-ion", "BMS", "SxP", "článek", "elektronika", "3D tisk", "STL", "kalkulačka"]
      },
      {
        "soubor": "obsah/tarif_spot.html",
        "nazev": "⚡ Fixní, nebo spotový tarif?",
        "popis": "Porovná roční cenu elektřiny u fixní a spotové nabídky",
        "stav": "vyvoj",
        "jen_cs": true,
        "tagy": ["elektřina", "spot", "spotová cena", "OTE", "fixace", "distribuční sazba", "ERÚ", "TDD", "energie", "cena elektřiny"]
      },
      {
        "soubor": "obsah/cable_sizing_calc.html",
        "nazev": "🔌 Dimenzování kabelu",
        "popis": "Spočítá úbytek napětí a doporučí průřez kabelu",
        "stav": "beta",
        "tagy": [
          "elektro",
          "kabel",
          "úbytek napětí",
          "průřez"
        ]
      },
      {
        "soubor": "obsah/ohm_calc.html",
        "nazev": "⚡ Ohmův zákon",
        "popis": "Dopočítá napětí, proud, odpor a výkon, přečte barevné proužky",
        "stav": "beta",
        "tagy": ["ohmův zákon", "proud", "napětí", "odpor", "výkon", "elektro"]
      },
      {
        "soubor": "obsah/logic_gates.html",
        "nazev": "🔲 Simulátor logických hradel",
        "popis": "Sestavujte a simulujte obvody z hradel, klopných obvodů a sčítaček",
        "stav": "vyvoj",
        "tagy": ["logika", "hradla", "digitální obvody", "sčítačka", "klopný obvod", "pravdivostní tabulka", "elektronika"]
      },
      {
        "soubor": "obsah/plc.html",
        "nazev": "🏭 Simulátor PLC – Ladder",
        "popis": "Programujte PLC v ladder diagramu a simulujte vstupy a výstupy",
        "stav": "vyvoj",
        "tagy": ["PLC", "automatizace", "ladder", "IEC 61131-3", "PID", "simulátor", "výuka", "elektro"]
      },
      {
        "soubor": "obsah/cpu8.html",
        "nazev": "🧮 CPU 6502 – emulátor a assembler",
        "popis": "Pište assembler pro MOS 6502, krokujte program a sledujte registry",
        "stav": "vyvoj",
        "tagy": ["6502", "procesor", "assembler", "emulátor", "výuka", "programování", "retro", "C64", "NES", "8bit"]
      },
      {
        "soubor": "obsah/elektroinstalace.html",
        "nazev": "⚡ Elektroinstalace domu",
        "popis": "Navrhne okruhy, jističe, chrániče a průřezy elektroinstalace domu",
        "stav": "vyvoj",
        "jen_cs": true,
        "tagy": ["elektroinstalace", "elektrikář", "projektant", "okruhy", "jistič", "chránič", "RCD", "proudový chránič", "selektivita", "úbytek napětí", "průřez kabelu", "způsob uložení", "impedance smyčky", "soudobost", "hlavní jistič", "fáze", "vyvážení fází", "rozvaděč", "jednopólové schéma", "štítky", "kusovník", "CYKY", "ČSN 33 2000", "ČSN 33 2130", "rodinný dům"]
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
        "popis": "Sledujte evoluci populace organismů s dědičnými geny a selekcí",
        "stav": "vyvoj",
        "tagy": ["biologie", "evoluce", "simulace", "genetika", "přírodní výběr", "výuka", "statistika", "experimenty", "selekční gradient"]
      },
      {
        "soubor": "obsah/epidemie.html",
        "nazev": "🦠 Simulátor epidemií",
        "popis": "Modeluje průběh epidemie modely SIR/SEIR, opatření a očkování",
        "stav": "vyvoj",
        "tagy": ["epidemiologie", "SIR", "SEIR", "R0", "Rt", "stochastika", "sítě", "agentový model", "věková struktura", "simulace", "výuka"]
      },
      {
        "soubor": "obsah/bunecne_automaty.html",
        "nazev": "🧫 Laboratoř buněčných automatů",
        "popis": "Hra Život a další buněčné automaty s vlastními pravidly",
        "stav": "vyvoj",
        "tagy": ["simulace", "matematika", "game of life", "celulární automat", "wolfram", "wireworld"]
      },
      {
        "soubor": "obsah/quake_lab.html",
        "nazev": "🏚️ Zemětřesná laboratoř",
        "popis": "Postavte konstrukci a vyzkoušejte, zda vydrží otřesy zemětřesení",
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
        "soubor": "obsah/nemozne.html",
        "nazev": "♾️ Laboratoř nemožných tvarů",
        "popis": "Prohlížejte Möbiovu pásku, Kleinovu láhev, uzly a optické iluze v 3D",
        "stav": "vyvoj",
        "tagy": ["matematika", "topologie", "Möbiova páska", "Kleinova láhev", "Boyova plocha", "uzly", "minimální plochy", "Costa", "Gömböc", "fraktály", "Mandelbulb", "Menger", "Penrose", "iluze", "3D", "3D tisk", "STL", "výuka"]
      },
      {
        "soubor": "obsah/vodopady.html",
        "nazev": "💧 Simulátor vodopádů",
        "popis": "Tvarujte krajinu a sledujte, jak po ní teče voda a tvoří vodopády",
        "stav": "vyvoj",
        "tagy": ["voda", "vodopád", "tekutina", "proudění", "fyzika", "simulace", "částice", "SPH", "kaskáda", "přehrada", "řeka", "pískoviště", "výuka"]
      }
    ]
  },
  {
    "nazev": "🧊 3D modelování",
    "skupina": "3d",
    "polozky": [
      {
        "soubor": "obsah/modelar.html",
        "nazev": "🧊 Modelář 3D",
        "popis": "Skládejte 3D modely z tvarů v prohlížeči a exportujte je pro tisk",
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
        "soubor": "obsah/nacrt3d.html",
        "nazev": "✏️ Z náčrtu do 3D",
        "popis": "Převede ruční náčrt na papíře nebo obrazovce na 3D model",
        "stav": "beta",
        "tagy": ["náčrt", "skica", "kresba", "výkres", "kóty", "3d", "3d tisk", "technický výkres", "nárys", "půdorys", "bokorys", "rotační díl", "mřížka", "šablona", "pero", "tablet", "stl"]
      },
      {
        "soubor": "obsah/text3d.html",
        "nazev": "🔠 3D text z písma",
        "popis": "Vytvoří 3D nápisy, čísla domů a cedulky z písem pro tisk",
        "stav": "beta",
        "tagy": ["3d tisk", "stl", "3mf", "svg", "číslo domu", "popisné číslo", "cedulka", "jmenovka", "nápis", "písmena", "font", "písmo", "reliéf", "rytina", "šablona", "sprej", "tengwar", "elfí písmo", "runy", "braille", "hieroglyfy", "podložka", "tiskárna", "vlastní font"]
      },
      {
        "soubor": "obsah/povrch3d.html",
        "nazev": "🧱 Struktury a hrany 3D modelu",
        "popis": "Vtlačí do stěn modelu cihly, kámen či nápis a zaoblí nebo srazí hrany",
        "stav": "beta",
        "tagy": ["3d tisk", "stl", "obj", "3mf", "struktura", "textura", "reliéf", "cihly", "kámen", "dlažba", "prkna", "šupiny", "vroubkování", "slzičkový plech", "výšková mapa", "displacement", "sražení", "fazeta", "zaoblení", "rádius", "hrany", "úprava modelu", "vlastní vzor", "nápis", "logo", "gravírování", "šindel", "palisáda", "bosáž", "měření tloušťky"]
      },
      {
        "soubor": "obsah/voronoi_stl.html",
        "nazev": "🕸 Voronoi z STL",
        "popis": "Převede 3D model STL na děrovanou voronoi síť k tisku",
        "stav": "vyvoj",
        "tagy": ["voronoi", "stl", "3d model", "síť", "odlehčení"]
      },
      {
        "soubor": "obsah/papercraft.html",
        "nazev": "📦 Papírové modely",
        "popis": "Rozloží 3D model na papírové střihy k vystřižení a slepení",
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
        "soubor": "obsah/bludiste3d.html",
        "nazev": "🌀 Bludiště – krabička, kostka, deska",
        "popis": "Generuje bludiště jako dárkovou krabičku, kostku nebo desku k tisku",
        "stav": "vyvoj",
        "tagy": ["3D tisk", "STL", "3MF", "bludiště", "labyrint", "hlavolam", "dárková krabička", "maze gift box", "kulička", "generátor"]
      },
      {
        "soubor": "obsah/formy.html",
        "nazev": "🫙 Formy na odlévání",
        "popis": "Vytvoří dvoudílnou nebo silikonovou formu na odlévání z modelu",
        "stav": "vyvoj",
        "tagy": ["3D tisk", "STL", "3MF", "forma", "odlévání", "silikon", "sádra", "epoxid", "beton", "mýdlo", "čokoláda", "podkosy", "manifold"]
      },
      {
        "soubor": "obsah/klicenky.html",
        "nazev": "🔑 Klíčenky a jmenovky (vícebarevné)",
        "popis": "Navrhněte vícebarevné klíčenky, jmenovky a magnety s textem",
        "stav": "vyvoj",
        "tagy": ["3D tisk", "STL", "3MF", "klíčenka", "jmenovka", "text", "vícebarevný tisk", "M600", "magnet", "záložka"]
      },
      {
        "soubor": "obsah/kostky3d.html",
        "nazev": "🎲 Herní kostky a žetony",
        "popis": "Generuje herní kostky D4–D20 a žetony s vyrytými čísly k tisku",
        "stav": "vyvoj",
        "tagy": ["3D tisk", "STL", "3MF", "kostka", "D6", "D20", "RPG", "žetony", "figurky", "těžiště", "deskové hry"]
      },
      {
        "soubor": "obsah/razitko.html",
        "nazev": "🔏 Razítka, pečeti a reliéfy",
        "popis": "Navrhněte razítko, pečeť do vosku nebo reliéf s textem k tisku",
        "stav": "vyvoj",
        "tagy": ["3D tisk", "STL", "3MF", "razítko", "pečeť", "vosk", "plaketa", "reliéf", "text po kruhu", "SVG", "generátor"]
      },
      {
        "soubor": "obsah/stinitka.html",
        "nazev": "🛎️ Lustrová stínítka",
        "popis": "Generuje stínítka na lustr různých tvarů a vzorů k 3D tisku",
        "stav": "vyvoj",
        "tagy": ["3D tisk", "STL", "3MF", "stínítko", "lustr", "lampa", "svítidlo", "E14", "E27", "tulipán", "zvon", "litofanie", "režim váza", "výkres", "generátor"]
      }
    ]
  },
  {
    "nazev": "🖨️ 3D tisk – díly a přípravky",
    "skupina": "3d",
    "polozky": [
      {
        "soubor": "obsah/krabicky.html",
        "nazev": "📦 Krabičky pro elektroniku",
        "popis": "Navrhne krabičku pro elektroniku s víkem, sloupky a otvory",
        "stav": "vyvoj",
        "tagy": ["3D tisk", "CAD", "elektronika", "Arduino", "ESP32", "STL", "3MF", "generátor"]
      },
      {
        "soubor": "obsah/panty.html",
        "nazev": "🔩 Panty a klouby pro 3D tisk",
        "popis": "Navrhněte panty, čepové, kulové a pružné klouby k tisku",
        "stav": "vyvoj",
        "tagy": ["3D tisk", "CAD", "STL", "pant", "kloub", "FDM", "návrh", "strojírenství"]
      },
      {
        "soubor": "obsah/krabicka_pant.html",
        "nazev": "🗃️ Krabička s víčkem na pantu",
        "popis": "Navrhne krabičku s víčkem na pantech a přihrádkami k tisku",
        "stav": "beta",
        "tagy": ["3D tisk", "CAD", "STL", "3MF", "krabička", "víčko", "pant", "čep", "zapínání", "chlopeň", "přihrádky", "organizér", "magnety", "generátor"]
      },
      {
        "soubor": "obsah/drzaky_naradi.html",
        "nazev": "🧰 Držáky nářadí a Gridfinity",
        "popis": "Generuje Gridfinity krabičky a vložky i držáky nářadí na stěnu",
        "stav": "beta",
        "tagy": ["gridfinity", "3D tisk", "STL", "dílna", "nářadí", "French cleat", "pegboard", "truhlářství", "PDF 1:1", "kusovník"]
      },
      {
        "soubor": "obsah/kleste.html",
        "nazev": "🗜️ Kleště, pinzety a svorky",
        "popis": "Navrhněte kleště, pinzety a svorky k tisku z předvoleb nebo od nuly",
        "stav": "vyvoj",
        "tagy": ["kleště", "pinzeta", "svorka", "peán", "jehelec", "kocher", "reverzní pinzeta", "samosvorná", "rohatka", "kleště na topinky", "kleště na pečivo", "grilovací kleště", "kleště na salát", "kleště na led", "kleště na sklenice", "kleště na cukr", "kolíček", "klip na sáčky", "svorka na hadičky", "čelisti", "zoubkování", "print-in-place", "kloub", "čep", "3d tisk", "stl", "3mf"]
      },
      {
        "soubor": "obsah/samosvorna_pinzeta.html",
        "nazev": "✂️ Samosvorná pinzeta",
        "popis": "Generuje reverzní pinzetu tištěnou z jednoho kusu",
        "stav": "vyvoj",
        "tagy": ["pinzeta", "samosvorná", "reverzní pinzeta", "křížová pinzeta", "pružné oko", "kloub", "čep", "print-in-place", "pájení", "3D tisk", "STL", "3MF", "generátor"]
      },
      {
        "soubor": "obsah/odizolovac.html",
        "nazev": "✂️ Stahovák izolace pro 3D tisk",
        "popis": "Navrhne tisknutelný stahovák izolace s kouskem ulamovací čepele",
        "stav": "vyvoj",
        "tagy": ["3D tisk", "STL", "elektro", "elektrikář", "odizolování", "stahovák", "kabel", "CYKY", "CY", "CYSY", "CYKYLo", "ulamovací nůž", "čepel", "generátor", "pružný kloub", "flexure", "kleště", "V-zářez", "AWG", "měrka průřezu", "podélný řez"]
      },
      {
        "soubor": "obsah/s_hak.html",
        "nazev": "🪝 S hák na trubky",
        "popis": "Navrhne S hák na zavěšení mezi dvě trubky různých průměrů",
        "stav": "vyvoj",
        "tagy": ["3D tisk", "STL", "3MF", "S hák", "háček", "trubka", "tyč", "šatní tyč", "zacvaknutí", "průřez", "žebro", "prolnutí", "nosnost", "generátor", "CAD"]
      },
      {
        "soubor": "obsah/tubeRed.html",
        "nazev": "🔧 Redukce trubek",
        "popis": "Navrhne redukci mezi dvěma průměry trubek pro 3D tisk",
        "stav": "beta",
        "tagy": ["trubky", "redukce", "rozvin", "plech", "svařování", "kónus", "sražení", "fazeta"]
      },
      {
        "soubor": "obsah/tubeRedFlat.html",
        "nazev": "🔧 Redukce se zploštěním",
        "popis": "Navrhne přechod z kruhové trubky na zploštělý či oválný průřez",
        "stav": "beta",
        "tagy": ["trubky", "redukce", "zploštění", "ovál", "obdélník", "elipsa", "plochá trubka", "vzduchotechnika", "odsávání", "3d tisk", "stl", "3mf", "kónus", "sražení", "límec", "příruba", "šrouby", "těsnění", "hadice", "bajonet", "výkres", "šablona"]
      },
      {
        "soubor": "obsah/tubeSplit.html",
        "nazev": "🔱 Rozbočka trubek",
        "popis": "Navrhne rozbočku trubek s více vývody, třeba pro odsávání",
        "stav": "beta",
        "tagy": ["trubky", "rozbočka", "odsávání", "vývody", "kalhoty", "redukce", "svařování", "kónus", "sražení", "fazeta"]
      },
      {
        "soubor": "obsah/rozbocka_vzt.html",
        "nazev": "🌬️ Rozbočka pro vzduchotechniku",
        "popis": "Navrhne rozbočku VZT se vstupem uprostřed a vývody kolem osy",
        "stav": "vyvoj",
        "tagy": ["vzduchotechnika", "VZT", "rozbočka", "rozdělovač", "odsávání", "rekuperace", "ventilace", "spiro", "trubky", "vývody", "difuzor", "tlaková ztráta", "nízký odpor", "spojka hadic", "prodloužení hadice", "úchyty", "odlomitelné podpory", "3D tisk", "STL", "3MF", "generátor"]
      },
      {
        "soubor": "obsah/kloubova_hadice.html",
        "nazev": "🦾 Kloubová hadice – ostřik a odsávání",
        "popis": "Generuje stavitelnou článkovou hadici pro ostřik nebo odsávání",
        "stav": "vyvoj",
        "tagy": ["kloubová hadice", "článková hadice", "stavitelná hadice", "husí krk", "chladicí kapalina", "ostřik", "emulze", "olej", "ofuk", "vzduch", "odsávání", "tryska", "plochá tryska", "sací hubice", "koule", "jamka", "kloub", "zacvaknutí", "obráběcí stroj", "soustruh", "frézka", "CNC", "závit G", "rozbočka", "magnetická patka", "stavitelný držák", "kalibrace vůle", "3D tisk", "STL", "3MF", "generátor"]
      },
      {
        "soubor": "obsah/cookieCutter.html",
        "nazev": "🍪 Vykrajovátka",
        "popis": "Navrhněte vykrajovátka na cukroví z předloh, písmen nebo obrázku",
        "stav": "beta",
        "tagy": ["vykrajovátka", "cukroví", "3d tisk", "pečení", "stl", "obj", "svg", "vánoce", "velikonoce", "perníčky", "monogram", "z obrázku", "šablona", "50 tvarů", "zvířátka", "srdíčko", "hvězda", "stromek"]
      },
      {
        "soubor": "obsah/soukoli_skladacka.html",
        "nazev": "🧩 Skládačka soukolí",
        "popis": "Skládá kola, hřebeny, řemeny a řetězy a počítá převody",
        "stav": "beta",
        "tagy": ["ozubená kola", "převod", "převodovka", "skládačka", "hřiště", "simulace", "převodový poměr", "řemen", "řetěz", "řemenice", "hřeben", "věnec", "vložené kolo", "hodinový převod", "otáčky", "moment", "kinematika"]
      },
      {
        "soubor": "obsah/pevnost_tisku.html",
        "nazev": "🧱 Pevnost výtisků (FDM)",
        "popis": "Odhadne únosnost tištěného dílu v ohybu a tahu podle výplně",
        "stav": "vyvoj",
        "tagy": ["3D tisk", "FDM", "pevnost", "nosník", "průhyb", "výpočet", "inženýrství", "materiály"]
      },
      {
        "soubor": "obsah/filament_calc.html",
        "nazev": "🧵 Spotřeba filamentu",
        "popis": "Převede gramy na metry, spočítá zbytek na cívce i cenu výtisku",
        "stav": "beta",
        "tagy": [
          "3d tisk",
          "pla",
          "petg",
          "gramy na metry",
          "zbytek na cívce",
          "cena tisku",
          "sklad cívek"
        ]
      },
      {
        "soubor": "obsah/kabely3d.html",
        "nazev": "🔌 Kabelové průchodky a organizéry",
        "popis": "Generuje průchodky do stolu, klipy a organizéry kabelů k tisku",
        "stav": "vyvoj",
        "tagy": ["3D tisk", "STL", "3MF", "kabely", "průchodka", "organizér", "hřebínek", "klip", "zacvaknutí", "PETG", "TPU"]
      },
      {
        "soubor": "obsah/knofliky.html",
        "nazev": "🎛️ Knoflíky a hlavice",
        "popis": "Navrhněte knoflíky na potenciometr a hlavice na šrouby k tisku",
        "stav": "beta",
        "tagy": ["3D tisk", "STL", "3MF", "knoflík", "potenciometr", "hlavice", "hvězdice", "matice", "šroub", "knopka", "kolečko", "generátor"]
      },
      {
        "soubor": "obsah/stojany.html",
        "nazev": "🎧 Stojany a držáky",
        "popis": "Navrhněte stojan s moduly pro ovladač, telefon či sluchátka",
        "stav": "vyvoj",
        "tagy": ["3D tisk", "STL", "3MF", "stojan", "držák", "ovladač", "gamepad", "sluchátka", "háček", "pod stůl", "telefon", "tablet", "notebook", "konzole", "VR", "hodinky", "nabíječka", "MagSafe", "AirPods", "organizér", "odlehčení", "generátor"]
      },
      {
        "soubor": "obsah/nozicky.html",
        "nazev": "🪑 Nožičky, krytky a podložky",
        "popis": "Generuje nožičky nábytku, krytky a podložky pod nohy k tisku",
        "stav": "vyvoj",
        "tagy": ["3D tisk", "STL", "3MF", "nožička", "pantofle", "krytka trubky", "záslepka", "klín", "podložka", "TPU", "nábytek"]
      },
      {
        "soubor": "obsah/odmerky.html",
        "nazev": "🥄 Odměrky do kuchyně",
        "popis": "Navrhne odměrku s přesným objemem v ml, lžících nebo gramech",
        "stav": "vyvoj",
        "tagy": ["3D tisk", "STL", "3MF", "odměrka", "kuchyň", "lžíce", "lžička", "cup", "hrnek", "mouka", "objem", "stupnice", "generátor"]
      },
      {
        "soubor": "obsah/pruzne.html",
        "nazev": "🪢 Pružné mechanismy a živé panty",
        "popis": "Generuje živé panty, bistabilní přepínače a pružné mechanismy",
        "stav": "vyvoj",
        "tagy": ["3D tisk", "STL", "3MF", "živý pant", "pružný mechanismus", "compliant", "bistabilní", "snap-fit", "spona", "pružina", "křížový kloub", "flexure", "paralelogram", "krabička", "generátor"]
      },
      {
        "soubor": "obsah/spojky.html",
        "nazev": "🔗 Spojky profilů, trubek a latí",
        "popis": "Navrhněte spojky hliníkových profilů, trubek a latí k tisku",
        "stav": "beta",
        "tagy": ["3D tisk", "STL", "3MF", "spojka", "hliníkový profil", "2020", "3030", "4040", "T-matice", "úhelník", "vzpěra", "skrytý úhelník", "krytka drážky", "lišta", "trubka", "jäkl", "uzel", "kopule", "stan", "latě", "rám"]
      },
      {
        "soubor": "obsah/uhelniky.html",
        "nazev": "📐 Úhelníky a odsávání frézky",
        "popis": "Navrhne úhelník s výztuhami a odsávací klín za frézu k tisku",
        "stav": "beta",
        "tagy": ["3D tisk", "STL", "3MF", "úhelník", "vingl", "výztuha", "vruty", "zápustná hlava", "dřevo", "nábytek", "odsávání", "frézka", "stolní frézka", "pravítko", "hadice", "vysavač", "generátor"]
      },
      {
        "soubor": "obsah/bryle.html",
        "nazev": "👓 Brýlové obroučky",
        "popis": "Navrhne brýlové obroučky a stranice podle rozměrů skel",
        "stav": "vyvoj",
        "tagy": ["3D tisk", "STL", "3MF", "brýle", "obroučky", "generátor", "optika", "pant", "stranice", "most", "drážka pro sklo", "boxing", "obruba"]
      },
      {
        "soubor": "obsah/kliky.html",
        "nazev": "🚪 Kliky a knoby ke dveřím",
        "popis": "Navrhněte dveřní kliku nebo knob s rozetou a štítem k tisku",
        "stav": "beta",
        "tagy": ["3D tisk", "STL", "3MF", "klika", "kliky", "dveřní klika", "knob", "koule", "rozeta", "štít", "čtyřhran", "rozteč 72", "rozteč 90", "PZ", "BB", "WC", "trn", "kování", "dveře", "generátor"]
      },
      {
        "soubor": "obsah/kolicky.html",
        "nazev": "🧺 Kolíčky na prádlo",
        "popis": "Navrhne kolíček na prádlo s pružinou ze starého kolíčku",
        "stav": "beta",
        "tagy": ["3D tisk", "STL", "3MF", "kolíček", "kolíčky", "kolíček na prádlo", "prádlo", "šňůra", "pružina", "torzní pružina", "tlačná pružina", "tištěná pružina", "TPU", "oblouk", "smyčka", "třmen", "dřevěný kolíček", "plastový kolíček", "recyklace", "háček", "klip", "magnet", "skicář", "generátor"]
      },
      {
        "soubor": "obsah/vesaky.html",
        "nazev": "🧥 Věšáky se skrytými šrouby",
        "popis": "Navrhne nástěnný věšák s úchytem, který skryje šrouby",
        "stav": "beta",
        "tagy": ["3D tisk", "STL", "3MF", "věšák", "háček", "háčky", "věšák na bundy", "kabát", "ručník", "nástěnný věšák", "skryté šrouby", "rybina", "úchyt na zeď", "náhodný tvar", "generátor"]
      },
      {
        "soubor": "obsah/cleat.html",
        "nazev": "🪝 Háčky a úchyty na French cleat",
        "popis": "Generuje háky, sedla a držáky nářadí na French cleat lištu",
        "stav": "beta",
        "tagy": ["3D tisk", "STL", "3MF", "French cleat", "francouzská lišta", "nástěnná lišta", "úkos 45°", "hák", "háček", "heavy duty", "dvojitý hák", "kolík", "sedlo na hadici", "kolébka", "klip na tyč", "držák koštěte", "V-drážka", "držák hadru", "police", "stojánek", "šroubováky", "bity", "sada vrtáků", "kleště", "hřeben na kabely", "kapsa", "kelímky", "zásobník", "montážní deska", "suchý zip", "dílna", "nářadí", "rybina", "generátor"]
      },
      {
        "soubor": "obsah/knob.html",
        "nazev": "🔮 Knob – generátor tvarů",
        "popis": "Tvarujte hlavu knobu ze semínka nebo skici a zvolte uchycení",
        "stav": "beta",
        "tagy": ["3D tisk", "STL", "3MF", "knob", "koule", "dveřní knoflík", "nábytkový knoflík", "generátor", "semínko", "skica", "krček", "zapuštění", "čtyřhran", "D-profil", "šroubek", "rozeta"]
      },
      {
        "soubor": "obsah/ibc.html",
        "nazev": "🛢️ Napojení hadic na IBC",
        "popis": "Generuje adaptéry výpusti IBC kontejneru na hadici a závity",
        "stav": "vyvoj",
        "tagy": ["3D tisk", "STL", "3MF", "IBC", "kontejner", "adaptér", "hadice", "hadicový trn", "závit", "S60×6", "redukce", "průchodka", "víko", "záslepka"]
      },
      {
        "soubor": "obsah/soupe.html",
        "nazev": "🚪 Šoupě do odsávání",
        "popis": "Navrhne šoupě nebo klapku do potrubí odsávání dílny",
        "stav": "vyvoj",
        "tagy": ["šoupě", "blast gate", "klapka", "uzávěr", "odsávání", "vysavač", "potrubí", "dílna", "hadice", "příruba", "3D tisk", "STL", "3MF", "generátor"]
      },
      {
        "soubor": "obsah/odsavaci_botka.html",
        "nazev": "🌪️ Odsávací botka",
        "popis": "Navrhne odsávací botku na vřeteno CNC nebo horní frézku",
        "stav": "vyvoj",
        "tagy": ["odsávání", "botka", "dust shoe", "frézka", "CNC", "vřeteno", "horní frézka", "kartáč", "vysavač", "hadice", "magnety", "3D tisk", "STL", "3MF", "generátor"]
      },
      {
        "soubor": "obsah/adapter_vysavac.html",
        "nazev": "🌀 Adaptér nářadí → vysavač",
        "popis": "Navrhne adaptér z vývodu nářadí na hadici vysavače",
        "stav": "vyvoj",
        "tagy": ["adaptér", "vysavač", "odsávání", "hadice", "vývod", "bruska", "pila", "frézka", "hoblík", "rychlospojka", "bajonet", "redukce", "proudění", "3D tisk", "STL", "3MF", "generátor"]
      },
      {
        "soubor": "obsah/ventilator_trubka.html",
        "nazev": "💨 Ventilátor → trubka",
        "popis": "Navrhne přechod z ventilátoru na trubku, mřížku nebo odsávač pájení",
        "stav": "vyvoj",
        "tagy": ["ventilátor", "PC ventilátor", "přechod", "trubka", "hadice", "mřížka ventilátoru", "odsávač", "pájení", "výpary", "uhlíkový filtr", "vzduchotechnika", "pracovní bod", "3D tisk", "STL", "3MF", "generátor"]
      },
      {
        "soubor": "obsah/prichytky_trubek.html",
        "nazev": "🔩 Příchytky trubek a hadic",
        "popis": "Navrhne příchytky a objímky trubek a hadic na zeď či profil",
        "stav": "vyvoj",
        "tagy": ["příchytka", "klip", "trubka", "hadice", "kabel", "omega", "objímka", "French cleat", "hliníkový profil", "držák hadice", "3D tisk", "STL", "3MF", "generátor"]
      },
      {
        "soubor": "obsah/kopirovaci_krouzky.html",
        "nazev": "⭕ Kopírovací kroužky a podložky",
        "popis": "Navrhne kopírovací kroužky a podložky pro horní frézku",
        "stav": "vyvoj",
        "tagy": ["kopírovací kroužek", "horní frézka", "podložka", "sub-base", "patka", "šablona", "odsazení", "kružítko", "centrovací trn", "Porter-Cable", "3D tisk", "STL", "3MF", "generátor"]
      },
      {
        "soubor": "obsah/snek.html",
        "nazev": "🐌 Šnekový převod",
        "popis": "Navrhne šnek a šnekové kolo k tisku, spočítá samosvornost a účinnost",
        "stav": "vyvoj",
        "tagy": ["šnek", "šnekové kolo", "šnekový převod", "převodovka", "ozubení", "globoidní", "samosvorný", "převod", "ložisko", "608", "625", "výkres", "3D tisk", "STL", "3MF", "generátor"]
      },
      {
        "soubor": "obsah/kolecka.html",
        "nazev": "🛼 Kolečka a pojezdy",
        "popis": "Náhradní kolečka a pojezdy s ložisky, vidlicí nebo úchytem pro 3D tisk",
        "stav": "vyvoj",
        "tagy": ["kolečko", "kolo", "pojezd", "kladka", "ložisko", "608", "625", "V-slot", "vidlice", "otočné kolečko", "šuplík", "sprchové dveře", "posuvná vrata", "vozík", "TPU", "excentr", "Hertz", "3D tisk", "STL", "3MF", "generátor"]
      },
      {
        "soubor": "obsah/kliky_hridel.html",
        "nazev": "☸️ Kliky a ruční kola na hřídel",
        "popis": "Navrhne kliku, ruční kolo, rukojeť nebo páku na hřídel se stupnicí",
        "stav": "vyvoj",
        "tagy": ["klika", "ruční kolo", "rukojeť", "páka", "hřídel", "náboj", "stupnice", "posuv", "soustruh", "frézka", "naviják", "ventil", "pero", "stavěcí šroub", "3D tisk", "STL", "3MF", "generátor"]
      },
      {
        "soubor": "obsah/sita.html",
        "nazev": "🧇 Síta a mřížky",
        "popis": "Navrhne síta, sítka do odtoku a trychtýře i třídicí věž pro 3D tisk",
        "stav": "vyvoj",
        "tagy": ["síto", "sítko", "mřížka", "prosévání", "kompost", "písek", "mouka", "čaj", "odtok", "vpusť", "šachta", "trychtýř", "cedník", "3D tisk", "STL", "3MF", "generátor"]
      },
      {
        "soubor": "obsah/trychtyre.html",
        "nazev": "🫗 Trychtýře a násypky na míru",
        "popis": "Navrhne trychtýř přesně na hrdlo láhve, kanystru, sklenice nebo nádrže",
        "stav": "vyvoj",
        "tagy": ["trychtýř", "násypka", "nálevka", "hrdlo", "PET", "kanystr", "zavařování", "nádrž", "olej", "granulát", "odvzdušnění", "průtok", "3D tisk", "STL", "3MF", "generátor"]
      },
      {
        "soubor": "obsah/foto_uchyty.html",
        "nazev": "🎥 Úchyty kamer a fotoaparátů",
        "popis": "Složí úchyt kamery z článků: prsty, závit 1/4″, patka, klouby",
        "stav": "vyvoj",
        "tagy": ["úchyt kamery", "akční kamera", "držák kamery", "GoPro kompatibilní", "LEGO kompatibilní", "kostky", "stavebnice", "Technic", "prsty M5", "stativový závit", "1/4 palce", "3/8 palce", "studená patka", "kulový kloub", "objímka na řídítka", "přísavka", "magnetický držák", "držák telefonu", "klip na batoh", "adaptér", "3D tisk", "STL", "3MF", "generátor"]
      },
      {
        "soubor": "obsah/sluchatka.html",
        "nazev": "👂 Nástavce na sluchátka a špunty",
        "popis": "Bláznivé ozdoby do uší: prst, červ, paprička na pecky i špunty",
        "stav": "vyvoj",
        "tagy": ["sluchátka", "pecky", "špunty do uší", "ušní špička", "TPU", "ozdoba", "prst", "červ", "paprička", "chapadlo", "jednorožec", "mrkev", "kost", "kaktus", "ulita", "srdce", "svíčka", "tykadla", "legrace", "3D tisk", "STL", "3MF", "generátor"]
      },
      {
        "soubor": "obsah/civka_filamentu.html",
        "nazev": "🪀 Držák a adaptér cívky filamentu",
        "popis": "Redukce otvoru cívky, stojan s ložisky a vodítko filamentu pro tisk",
        "stav": "vyvoj",
        "tagy": ["cívka", "filament", "redukce", "adaptér", "držák cívky", "stojan", "ložisko", "608", "sušicí box", "vodítko", "PTFE", "kladka", "3D tisk", "STL", "3MF", "generátor"]
      },
      {
        "soubor": "obsah/zarazky_dveri.html",
        "nazev": "🛑 Zarážky a aretace dveří a oken",
        "popis": "Klín pod dveře, zarážka s magnetem a aretace okna nebo dvířek",
        "stav": "vyvoj",
        "tagy": ["zarážka", "dveře", "klín", "magnet", "neodym", "aretace", "okno", "ventilace", "hřeben", "doraz", "šuplík", "3D tisk", "STL", "3MF", "generátor"]
      },
      {
        "soubor": "obsah/organizer_vrtaku.html",
        "nazev": "🪛 Organizér vrtáků a bitů",
        "popis": "Navrhne stojánek, kazetu nebo držák bitů s popisky velikostí",
        "stav": "vyvoj",
        "tagy": ["vrtáky", "bity", "závitníky", "ořechy", "organizér", "stojánek", "popisky", "Gridfinity", "French cleat", "dílna", "3D tisk", "STL", "3MF", "generátor"]
      },
      {
        "soubor": "obsah/vanocni_ozdoby.html",
        "nazev": "🎄 Vánoční ozdoby",
        "popis": "Navrhne vločky, hvězdy, baňky a jmenovky na dárky pro tisk bez podpor",
        "stav": "vyvoj",
        "tagy": ["Vánoce", "ozdoby", "vločka", "hvězda", "baňka", "vázový režim", "jmenovka", "dárek", "3D tisk", "STL", "3MF", "generátor"]
      },
      {
        "soubor": "obsah/dozy_zavit.html",
        "nazev": "🍯 Dózy a víčka se závitem",
        "popis": "Navrhne šroubovací dózu, víčko na PET láhev či kanystr a vzorek závitu",
        "stav": "vyvoj",
        "tagy": ["dóza", "víčko", "závit", "šroubovací", "krabička", "kelímek", "PET láhev", "PCO 1881", "kanystr", "hrdlo", "zátka", "uzávěr", "O-kroužek", "těsnění", "kalibrace závitu", "3D tisk", "STL", "3MF", "generátor"]
      },
      {
        "soubor": "obsah/kvetinace.html",
        "nazev": "🪴 Samozavlažovací květináče",
        "popis": "Navrhne samozavlažovací květináč, vložku do obalu nebo podmisku",
        "stav": "vyvoj",
        "tagy": ["květináč", "samozavlažovací", "zásobník vody", "vložka do obalu", "podmiska", "knot", "vodoznak", "rostliny", "zahrada", "3D tisk", "STL", "3MF", "generátor"]
      },
      {
        "soubor": "obsah/klipy_sacky.html",
        "nazev": "📎 Klipy na sáčky a uzávěry",
        "popis": "Navrhne klip, lištu, výlevku s víčkem či kolíček na načaté sáčky",
        "stav": "vyvoj",
        "tagy": ["klip na sáčky", "svorka na sáček", "uzávěr sáčku", "zaklapávací klip", "čepový pant", "živý pant", "západka", "násuvná lišta", "výlevka", "sypací hrdlo", "šroubovací víčko", "kolíček", "C-klip", "magnet", "očko", "print-in-place", "kuchyně", "3D tisk", "STL", "3MF", "generátor"]
      }
    ]
  },
  {
    "nazev": "💻 Vývoj & nástroje",
    "skupina": "vyvoj",
    "polozky": [
      {
        "soubor": "obsah/live_editor.html",
        "nazev": "💻 Live HTML/CSS/JS editor",
        "popis": "Pište HTML, CSS a JavaScript a hned vidíte výsledek",
        "stav": "beta",
        "tagy": [
          "html",
          "css",
          "js",
          "playground"
        ]
      },
      {
        "soubor": "obsah/api_tester.html",
        "nazev": "🛰️ API / webhook tester",
        "popis": "Posílá HTTP požadavky na vlastní API a zobrazí odpovědi",
        "stav": "beta",
        "tagy": [
          "api",
          "http",
          "webhook",
          "rest"
        ]
      },
      {
        "soubor": "obsah/regex_tester.html",
        "nazev": "🔍 Regex tester",
        "popis": "Vyzkoušejte regulární výraz na textu se zvýrazněním shod",
        "stav": "beta",
        "tagy": [
          "regulární výrazy",
          "vzory"
        ]
      },
      {
        "soubor": "obsah/diff_tool.html",
        "nazev": "🔀 Diff nástroj",
        "popis": "Porovná dva texty a zvýrazní přidané a odebrané řádky",
        "stav": "beta",
        "tagy": [
          "porovnání",
          "rozdíl",
          "text"
        ]
      },
      {
        "soubor": "obsah/git_historie.html",
        "nazev": "🌳 Historie Gitu",
        "popis": "Zobrazí graf commitů, větví a statistiky repozitáře Git",
        "stav": "vyvoj",
        "tagy": ["git", "vývoj", "vizualizace", "graf", "statistiky", "GitHub"]
      },
      {
        "soubor": "obsah/analyzator_logu.html",
        "nazev": "📜 Analyzátor logů",
        "popis": "Načte syslog, Nginx či JSON log, filtruje a hledá chyby",
        "stav": "vyvoj",
        "tagy": ["logy", "syslog", "nginx", "apache", "json", "regex", "analýza", "nástroje", "IT"]
      },
      {
        "soubor": "obsah/cron_builder.html",
        "nazev": "⏰ Cron builder",
        "popis": "Sestaví a vysvětlí cron výraz a ukáže nejbližší spuštění",
        "stav": "beta",
        "tagy": ["cron", "plánovač", "crontab", "výraz", "linux"]
      },
      {
        "soubor": "obsah/env_gen.html",
        "nazev": "⚙️ Generátor .env souborů",
        "popis": "Vytvoří .env a konfigurační soubory z šablon pro Node, Django, Docker",
        "stav": "beta",
        "tagy": [
          "env",
          "konfigurace",
          "docker"
        ]
      },
      {
        "soubor": "obsah/gitignore_gen.html",
        "nazev": "🚫 .gitignore generátor",
        "popis": "Sestaví .gitignore podle zvolených jazyků a nástrojů",
        "stav": "beta",
        "tagy": ["git", "gitignore", "šablona", "repozitář"]
      },
      {
        "soubor": "obsah/keycode.html",
        "nazev": "⌨️ Keycode tester",
        "popis": "Ukáže key, code a keyCode stisknuté klávesy v JavaScriptu",
        "stav": "beta",
        "tagy": ["klávesy", "keycode", "javascript", "event", "test"]
      },
      {
        "soubor": "obsah/http_status.html",
        "nazev": "🌐 HTTP stavové kódy",
        "popis": "Přehled HTTP kódů 1xx–5xx s vysvětlením, kdy nastávají",
        "stav": "beta",
        "tagy": ["http", "kódy", "404", "500", "api", "reference"]
      },
      {
        "soubor": "obsah/git_cheatsheet.html",
        "nazev": "📚 Git cheatsheet",
        "popis": "Nejpoužívanější příkazy Gitu podle témat s vysvětlením",
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
        "popis": "Klávesové zkratky pro Excel, VS Code, Photoshop a prohlížeče",
        "stav": "beta",
        "tagy": ["excel", "vs code", "photoshop", "prohlížeč", "hotkeys", "kombinace kláves"]
      }
    ]
  },
  {
    "nazev": "🗄️ Databáze & testovací data",
    "skupina": "vyvoj",
    "polozky": [
      {
        "soubor": "obsah/sqlite.html",
        "nazev": "🗄️ SQLite – prohlížeč a editor",
        "popis": "Otevře databázi .sqlite, ukáže tabulky a spustí SQL dotazy",
        "stav": "vyvoj",
        "tagy": ["databáze", "SQL", "SQLite", "nástroje", "ER diagram", "export", "offline"]
      },
      {
        "soubor": "obsah/er_diagram.html",
        "nazev": "🗂️ Editor ER diagramů",
        "popis": "Kreslete tabulky a vztahy databáze, import i export SQL",
        "stav": "beta",
        "tagy": [
          "databáze",
          "entity",
          "schéma"
        ]
      },
      {
        "soubor": "obsah/sql_formatter.html",
        "nazev": "🗄️ Formátovač SQL",
        "popis": "Naformátuje SQL dotaz do čitelné podoby nebo na jeden řádek",
        "stav": "beta",
        "tagy": ["sql", "formátování", "dotaz", "databáze", "select"]
      },
      {
        "soubor": "obsah/testovaci_data.html",
        "nazev": "🧪 Testovací data pro databáze",
        "popis": "Vygeneruje realistická data do tabulek s vazbami jako SQL či CSV",
        "stav": "vyvoj",
        "tagy": ["vývoj", "databáze", "SQL", "CSV", "JSON", "testování", "syntetická data"]
      },
      {
        "soubor": "obsah/mock_data.html",
        "nazev": "🪪 Fiktivní osoby a firmy",
        "popis": "Vytvoří smyšlená česká jména, adresy, e-maily a platná IČO",
        "stav": "beta",
        "tagy": [
          "fake data",
          "generátor",
          "testování",
          "ičo"
        ]
      }
    ]
  },
  {
    "nazev": "🔧 Data & převodníky",
    "skupina": "vyvoj",
    "polozky": [
      {
        "soubor": "obsah/json_formatter.html",
        "nazev": "🗂️ Formátovač JSON",
        "popis": "Zkontroluje platnost JSON, naformátuje jej nebo minifikuje",
        "stav": "beta",
        "tagy": [
          "validátor",
          "pretty print"
        ]
      },
      {
        "soubor": "obsah/yaml_json.html",
        "nazev": "🔄 YAML ↔ JSON převodník",
        "popis": "Převádí konfigurace mezi formáty YAML a JSON oběma směry",
        "stav": "beta",
        "tagy": [
          "yaml",
          "json",
          "konfigurace"
        ]
      },
      {
        "soubor": "obsah/csv_json.html",
        "nazev": "🔄 CSV ↔ JSON",
        "popis": "Převádí tabulková data mezi CSV a JSON s náhledem tabulky",
        "stav": "beta",
        "tagy": [
          "tabulka",
          "data",
          "převod"
        ]
      },
      {
        "soubor": "obsah/excel_vzorce.html",
        "nazev": "📊 Vzorce v Excelu – kurz",
        "popis": "Kurz vzorců: rozbor vlastního vzorce, krokování, úlohy, tahák",
        "stav": "beta",
        "tagy": ["excel", "vzorce", "funkce", "tabulkový procesor", "kurz", "výuka", "SUMA", "KDYŽ", "SVYHLEDAT", "XLOOKUP", "COUNTIF", "SUMIF", "INDEX", "POZVYHLEDAT", "absolutní odkaz", "$", "vyhodnotit vzorec", "LibreOffice Calc", "Google Tabulky", "spreadsheet", "rozbor vzorce", "vysvětlení vzorce", "formát buněk", "řada", "Zpět", "procvičování", "zkouška", "učitel", "sada úloh", "xlsx", "import Excelu", "listy", "názvy", "podmíněné formátování", "FILTR", "dynamické pole", "audit vzorců", "předchůdci"]
      },
      {
        "soubor": "obsah/md_table.html",
        "nazev": "📋 Markdown tabulky",
        "popis": "Vyplňte tabulku a získejte ji v Markdownu, třeba do README",
        "stav": "beta",
        "tagy": ["markdown", "tabulka", "generátor", "readme"]
      },
      {
        "soubor": "obsah/base64_encoder.html",
        "nazev": "🔐 Base64 / URL encoder",
        "popis": "Zakóduje či dekóduje text v Base64, URL a HTML entitách",
        "stav": "beta",
        "tagy": [
          "kódování",
          "url",
          "encode",
          "decode"
        ]
      },
      {
        "soubor": "obsah/url_builder.html",
        "nazev": "🔗 URL builder / parser",
        "popis": "Rozloží URL na části a sestaví adresu s parametry",
        "stav": "beta",
        "tagy": [
          "url",
          "query string",
          "parametry"
        ]
      },
      {
        "soubor": "obsah/jwt_decoder.html",
        "nazev": "🔑 JWT decoder",
        "popis": "Dekóduje hlavičku a obsah JWT tokenu a ukáže platnost",
        "stav": "beta",
        "tagy": ["jwt", "token", "dekodér", "payload", "autentizace"]
      },
      {
        "soubor": "obsah/hash_gen.html",
        "nazev": "#️⃣ Hash generátor",
        "popis": "Spočítá SHA-1, SHA-256 a další hashe textu nebo souboru",
        "stav": "beta",
        "tagy": [
          "md5",
          "sha",
          "otisk"
        ]
      },
      {
        "soubor": "obsah/uuid_gen.html",
        "nazev": "🆔 UUID generátor",
        "popis": "Vygeneruje UUID v4, krátká ID a další identifikátory",
        "stav": "beta",
        "tagy": ["uuid", "guid", "identifikátor", "náhodné id"]
      },
      {
        "soubor": "obsah/timestamp_conv.html",
        "nazev": "🕰️ Unix timestamp",
        "popis": "Převod Unix času v s i ms na datum a zpět",
        "stav": "beta",
        "tagy": [
          "unix",
          "epoch",
          "čas",
          "datum"
        ]
      },
      {
        "soubor": "obsah/case_converter.html",
        "nazev": "🔠 Převodník case",
        "popis": "Změní text na VELKÁ, malá, camelCase, snake_case a další",
        "stav": "beta",
        "tagy": ["velikost písmen", "camelcase", "snake_case", "verzálky", "text"]
      },
      {
        "soubor": "obsah/slug_gen.html",
        "nazev": "🔗 Slug generátor",
        "popis": "Převede text na čistou adresu URL bez diakritiky",
        "stav": "beta",
        "tagy": ["slug", "url", "diakritika", "seo", "adresa"]
      },
      {
        "soubor": "obsah/lorem_ipsum.html",
        "nazev": "📝 Lorem ipsum",
        "popis": "Vygeneruje výplňový text a smyšlené osoby v JSON či CSV",
        "stav": "beta",
        "tagy": ["lorem ipsum", "výplňový text", "testovací data", "placeholder"]
      }
    ]
  },
  {
    "nazev": "🕹️ Arkády",
    "skupina": "hry",
    "polozky": [
      {
        "soubor": "obsah/had.html",
        "nazev": "🐍 Had",
        "popis": "Klasická hra: sbírej jídlo, roste ti ocas, nenaraz",
        "stav": "beta",
        "tagy": [
          "snake",
          "hra"
        ]
      },
      {
        "soubor": "obsah/retro_tetris.html",
        "nazev": "🟦 Retro Tetris",
        "popis": "Skládej padající kostky a mazej plné řady",
        "stav": "beta",
        "tagy": ["tetris", "kostky", "retro", "skládání"]
      },
      {
        "soubor": "obsah/retro_pacman.html",
        "nazev": "🟡 Retro Pac-Man",
        "popis": "Projdi bludiště, sněz tečky a uteč duchům",
        "stav": "beta",
        "tagy": ["pacman", "bludiště", "retro", "arkáda"]
      },
      {
        "soubor": "obsah/retro_invaders.html",
        "nazev": "👾 Retro Invaders",
        "popis": "Sestřeluj šiky vetřelců, než dosednou na zem",
        "stav": "beta",
        "tagy": ["space invaders", "střílečka", "retro", "arkáda"]
      },
      {
        "soubor": "obsah/vajicka.html",
        "nazev": "🥚 Retro Vajíčka",
        "popis": "LCD hra z 80. let: chytej košíkem kutálející se vejce",
        "stav": "vyvoj",
        "tagy": ["vajíčka", "vejce", "chytání", "lcd", "elektronika", "kapesní hra", "retro", "slepice", "košík"]
      },
      {
        "soubor": "obsah/chobotnice.html",
        "nazev": "🐙 Retro Chobotnice",
        "popis": "LCD hra: vynes poklad z vraku a vyhni se chapadlům",
        "stav": "vyvoj",
        "tagy": ["chobotnice", "potápěč", "poklad", "lcd", "elektronika", "kapesní hra", "retro", "moře"]
      },
      {
        "soubor": "obsah/tank1990.html",
        "nazev": "🪖 Tank 1990",
        "popis": "Tankové bitvy jako Battle City, i ve dvou, braň orla",
        "stav": "vyvoj",
        "tagy": ["tank a 1990", "battle city", "tanky", "nes", "famiclone", "retro", "arkáda", "dva hráči", "orel", "editor map"]
      },
      {
        "soubor": "obsah/krumpac.html",
        "nazev": "⛏️ Krumpáč",
        "popis": "Pixelová plošinovka s krumpáčem: 4 světy, bossové, obchod",
        "stav": "vyvoj",
        "tagy": ["plošinovka", "trpaslík", "jeskyně", "pixel art", "skákačka", "retro", "arkáda", "bossové", "obchod", "světy"]
      },
      {
        "soubor": "obsah/starfall.html",
        "nazev": "🚀 Starfall: Iron Horizon",
        "popis": "Vesmírná střílečka: 15 misí, lodě, zbraně, nekonečný režim",
        "stav": "beta",
        "tagy": ["shoot-em-up", "střílečka", "vesmír", "tyrian", "pixel art", "bossové", "hangár", "obchod", "kampaň", "arkáda"]
      },
      {
        "soubor": "obsah/bomberman.html",
        "nazev": "💣 Bomberman",
        "popis": "Kladením bomb ničíš bedny a potvory, kampaň i souboj",
        "stav": "vyvoj",
        "tagy": ["hra", "arkáda", "retro", "boti", "2 hráči"]
      },
      {
        "soubor": "obsah/breakout.html",
        "nazev": "🧱 Breakout",
        "popis": "Odrážej míček pálkou, rozbíjej cihly a chytej bonusy",
        "stav": "beta",
        "tagy": ["arkanoid", "cihly", "pálka", "míček", "arkáda"]
      },
      {
        "soubor": "obsah/pong.html",
        "nazev": "🏓 Pong",
        "popis": "Odrážej míček pálkou proti počítači nebo ve dvou",
        "stav": "beta",
        "tagy": ["pong", "pálky", "retro", "arkáda"]
      },
      {
        "soubor": "obsah/asteroids.html",
        "nazev": "🚀 Asteroids",
        "popis": "Řiď loď ve vesmíru a rozstřílej rozpadající se asteroidy",
        "stav": "beta",
        "tagy": ["asteroidy", "vesmír", "loď", "retro", "arkáda"]
      },
      {
        "soubor": "obsah/stack-attack.html",
        "nazev": "📦 Stack Attack",
        "popis": "Přenášej padající bedny a skládej tři stejné barvy",
        "stav": "beta",
        "tagy": ["arkáda", "bedny", "retro", "hra"]
      },
      {
        "soubor": "obsah/jump_game.html",
        "nazev": "🏃 Skákačka",
        "popis": "Plošinovka: skákej po plošinách a sbírej body",
        "stav": "beta",
        "tagy": ["skákačka", "plošinovka", "platformer", "hra"]
      },
      {
        "soubor": "obsah/backwardRide.html",
        "nazev": "🚗 Couvání",
        "popis": "Zacouvej s přívěsem na parkovací místo v pěti levelech",
        "stav": "beta",
        "tagy": ["couvání", "vozík", "přívěs", "simulátor", "řidič"]
      },
      {
        "soubor": "obsah/blinkr.html",
        "nazev": "🚦 Zrcátko, blinkr, jeď!",
        "popis": "Jízda shora po křižovatkách: přednost podle pravidel ČR nebo Británie",
        "stav": "vyvoj",
        "tagy": ["autoškola", "přednost v jízdě", "křižovatka", "pravidlo pravé ruky", "kruhový objezd", "semafor", "jízda vlevo", "Velká Británie", "Highway Code", "simulátor", "řidič", "hra"]
      },
      {
        "soubor": "obsah/pozirani_bunek.html",
        "nazev": "🦠 Požírání buněk",
        "popis": "Jako buňka požírej menší a utíkej před většími",
        "stav": "beta",
        "tagy": ["buňky", "agar", "mikrosvět", "plankton", "přežití", "arkáda", "hra"]
      },
      {
        "soubor": "obsah/fps_arena.html",
        "nazev": "🔫 FPS Aréna (3D)",
        "popis": "3D střílečka z vlastního pohledu proti vlnám nepřátel",
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
        "soubor": "obsah/pristani.html",
        "nazev": "🌙 Přistání na Měsíci",
        "popis": "Přistaň s modulem na Měsíci i Marsu s věrnou fyzikou",
        "stav": "vyvoj",
        "tagy": ["lunar lander", "přistání", "měsíc", "mars", "vesmír", "raketa", "fyzika", "gravitace", "palivo", "kampaň", "gamepad", "ghost"]
      }
    ]
  },
  {
    "nazev": "🏰 Strategie & simulace",
    "skupina": "hry",
    "polozky": [
      {
        "soubor": "obsah/trpaslici.html",
        "nazev": "⛰️ Srdce hory",
        "popis": "Buduj trpasličí sídlo v hoře, těž rudy a braň klan",
        "stav": "beta",
        "tagy": ["trpaslíci", "hora", "budovatelská strategie", "kopání", "těžba", "důl", "pixel art", "boční řez", "gravitace", "dwarf fortress", "craft the world", "procedurální mapa"]
      },
      {
        "soubor": "obsah/sine.html",
        "nazev": "🏰 Síně pod horou",
        "popis": "Trpasličí budovatelská hra shora: síně a chodby pod horou",
        "stav": "vyvoj",
        "tagy": ["trpaslíci", "hora", "budovatelská strategie", "pohled shora", "kopání", "síně", "patra", "malovaná mapa", "dwarf fortress", "rimworld", "procedurální mapa", "obrana", "příběh"]
      },
      {
        "soubor": "obsah/dwarf_colony.html",
        "nazev": "⛏️ Trpasličí kolonie",
        "popis": "3D kolonie trpaslíků: těžba, farmy, stavby, den a noc",
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
        "soubor": "obsah/magnat.html",
        "nazev": "🚂 Dopravní magnát",
        "popis": "Dopravní strategie: tratě, silnice, vlaky a rostoucí města",
        "stav": "vyvoj",
        "tagy": ["doprava", "železnice", "vlaky", "tycoon", "budovatelská strategie", "ekonomika", "izometrie", "města", "průmysl", "procedurální mapa", "seed"]
      },
      {
        "soubor": "obsah/obleheni.html",
        "nazev": "🏝️ Ostrov v obležení",
        "popis": "Tower defense: braň ostrov před loďmi, letci i příšerami",
        "stav": "vyvoj",
        "tagy": ["obrana věží", "tower defense", "ostrov", "lodě", "piráti", "kraken", "wyverny", "fantasy", "strategie", "procedurální mapa", "seed", "kampaň"]
      },
      {
        "soubor": "obsah/tower_defense.html",
        "nazev": "🏰 Tower Defense",
        "popis": "Stav věže podél cesty a zastav vlny nepřátel",
        "stav": "beta",
        "tagy": ["obrana věží", "strategie", "vlny", "věže"]
      },
      {
        "soubor": "obsah/tower_defense_sc.html",
        "nazev": "🛰️ Sector Defense",
        "popis": "Sci-fi tower defense: braň sektor před vlnami nepřátel",
        "stav": "beta",
        "tagy": ["obrana věží", "vesmír", "strategie", "sci-fi"]
      },
      {
        "soubor": "obsah/podzemi.html",
        "nazev": "🗡️ Nekonečné podzemí",
        "popis": "Dungeon crawler: sestupuj do pater, bojuj a sbírej kořist",
        "stav": "beta",
        "tagy": ["dungeon", "crawler", "roguelike", "dungeon master", "podzemí", "bludiště", "rpg", "hra"]
      },
      {
        "soubor": "obsah/pirateers/index.html",
        "nazev": "🏴‍☠️ Pirateers",
        "popis": "Pirátské námořní bitvy: kormidluj loď a pal boční salvy",
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
        "soubor": "obsah/cesta_rodu.html",
        "nazev": "⚜️ Cesta rodu",
        "popis": "Prožij generace rodu od podruha až po šlechtický erb",
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
        "soubor": "obsah/dron.html",
        "nazev": "🚁 Nad krajinou",
        "popis": "Simulátor letu dronem v 3D krajině: fotomise i závody",
        "stav": "beta",
        "tagy": ["dron", "simulátor", "let", "fpv", "kvadrokoptéra", "krajina", "3d", "focení", "závody", "letová škola", "vysílačka", "hra"]
      },
      {
        "soubor": "obsah/ostruvek.html",
        "nazev": "🏝️ Ostrůvek (three.js + Blender)",
        "popis": "3D procházka po ostrově, sbírej krystaly na čas",
        "stav": "beta",
        "tagy": ["ostrov", "skřítek", "krystaly", "3d", "three.js", "blender", "gltf", "low-poly", "demo", "hra"]
      },
      {
        "soubor": "obsah/lukavice.html",
        "nazev": "🚗 Lukavice 3D",
        "popis": "Projdi se nebo projeď autem 3D model skutečné obce",
        "stav": "beta",
        "tagy": ["lukavice", "ústí nad orlicí", "žamberk", "obec", "vesnice", "3d", "auto", "jízda", "chůze", "procházka", "openstreetmap", "mapa", "terén", "three.js", "hra"]
      }
    ]
  },
  {
    "nazev": "📖 Gamebooky",
    "skupina": "hry",
    "polozky": [
      {
        "soubor": "obsah/gamebook.html",
        "nazev": "⛏️ Hlubina pod Černou horou",
        "popis": "Hledej otce ve starém dole: volby, kostky a souboje",
        "stav": "beta",
        "jen_cs": true,
        "tagy": ["gamebook", "textová hra", "adventura", "příběh", "kostky", "permoník", "důl", "fighting fantasy"]
      },
      {
        "soubor": "obsah/gamebook_praha.html",
        "nazev": "⚗️ Stín nad Zlatou uličkou",
        "popis": "Rudolfínská Praha 1609: zachraň alchymistu do úsvitu",
        "stav": "vyvoj",
        "jen_cs": true,
        "tagy": ["gamebook", "textová hra", "adventura", "příběh", "kostky", "alchymie", "Praha", "Rudolf II.", "homunkulus", "orloj"]
      },
      {
        "soubor": "obsah/gamebook_jan.html",
        "nazev": "🌿 Svatojánská noc",
        "popis": "Podle českých pověstí zachraň sestřičku od jezinek",
        "stav": "vyvoj",
        "jen_cs": true,
        "tagy": ["gamebook", "textová hra", "adventura", "příběh", "kostky", "pověsti", "jezinky", "vodník", "Krakonoš", "kapradí"]
      },
      {
        "soubor": "obsah/gamebook_stanice.html",
        "nazev": "🛰️ Opuštěná stanice",
        "popis": "Sci-fi: prozkoumej umlklou stanici na ledovém měsíci",
        "stav": "vyvoj",
        "jen_cs": true,
        "tagy": ["gamebook", "textová hra", "adventura", "příběh", "kostky", "sci-fi", "vesmír", "stanice", "umělá inteligence", "první kontakt"]
      },
      {
        "soubor": "obsah/gamebook_editor.html",
        "nazev": "🧭 Editor gamebooků",
        "popis": "Napiš vlastní gamebook: graf scén, kontrola a export",
        "stav": "vyvoj",
        "tagy": ["gamebook", "gamebooky", "editor", "příběh", "interaktivní kniha", "hra knihou", "scény", "volby", "graf", "větvení", "hrdina", "dobrodružství", "psaní", "kontrola příběhu", "export"]
      }
    ]
  },
  {
    "nazev": "♟️ Deskové & karetní",
    "skupina": "hry",
    "polozky": [
      {
        "soubor": "obsah/chess.html",
        "nazev": "♟️ Šachy",
        "popis": "Hraj proti počítači nebo ve dvou, i s hodinami",
        "stav": "beta",
        "tagy": [
          "šachy",
          "hra",
          "figurky"
        ]
      },
      {
        "soubor": "obsah/checkers.html",
        "nazev": "♟️ Dáma",
        "popis": "Hraj dámu proti počítači ve třech obtížnostech",
        "stav": "beta",
        "tagy": [
          "dáma",
          "hra"
        ]
      },
      {
        "soubor": "obsah/reversi.html",
        "nazev": "⚫ Reversi",
        "popis": "Obracej kameny soupeře, proti počítači nebo ve dvou",
        "stav": "beta",
        "tagy": ["reversi", "othello", "desková hra", "kameny"]
      },
      {
        "soubor": "obsah/piskvorky.html",
        "nazev": "⭕ Piškvorky",
        "popis": "Tři v řadě na 3×3 nebo pětky na velké desce",
        "stav": "beta",
        "tagy": [
          "tic tac toe",
          "hra"
        ]
      },
      {
        "soubor": "obsah/connect4.html",
        "nazev": "🔴 Čtyři v řadě",
        "popis": "Pouštěj žetony do sloupců a spoj čtyři v řadě",
        "stav": "beta",
        "tagy": ["čtyři v řadě", "connect four", "desková hra", "dva hráči"]
      },
      {
        "soubor": "obsah/battleship.html",
        "nazev": "🚢 Lodě",
        "popis": "Hledej a potop loďstvo počítače dřív než on tvoje",
        "stav": "beta",
        "tagy": ["lodě", "battleship", "námořní bitva", "mřížka"]
      },
      {
        "soubor": "obsah/solitaire.html",
        "nazev": "🃏 Solitaire",
        "popis": "Karetní pasiáns Klondike s nápovědou a tahem zpět",
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
        "popis": "Házej pěti kostkami a sbírej kombinace do tabulky",
        "stav": "beta",
        "tagy": ["kostky", "yahtzee", "vrhcáby", "hod kostkou", "desková hra"]
      },
      {
        "soubor": "obsah/memory_game.html",
        "nazev": "🃏 Pexeso",
        "popis": "Otáčej karty a hledej dvojice na co nejméně tahů",
        "stav": "beta",
        "tagy": [
          "pexeso",
          "paměť",
          "karty"
        ]
      },
      {
        "soubor": "obsah/rock_paper_scissors.html",
        "nazev": "✊ Kámen nůžky papír",
        "popis": "Zahraj si proti počítači, který umí číst tvé zvyky",
        "stav": "beta",
        "tagy": ["kámen nůžky papír", "hra", "náhoda"]
      }
    ]
  },
  {
    "nazev": "🔤 Slovní & společenské",
    "skupina": "hry",
    "polozky": [
      {
        "soubor": "obsah/scrabble.html",
        "nazev": "🔤 Scrabble",
        "popis": "Skládej slova z kamenů s českou sadou i proti počítači",
        "stav": "beta",
        "tagy": ["scrabble", "slovní hra", "desková hra", "písmena", "kameny", "skládání slov"]
      },
      {
        "soubor": "obsah/scrabble_en.html",
        "nazev": "🔡 Scrabble anglicky",
        "popis": "Anglické Scrabble s významem každého zahraného slova",
        "stav": "beta",
        "tagy": ["scrabble", "angličtina", "english", "slovní hra", "slovíčka", "skládání slov", "výuka"]
      },
      {
        "soubor": "obsah/wordle.html",
        "nazev": "🟩 Slovo (Wordle)",
        "popis": "Uhodni pětipísmenné české slovo na šest pokusů",
        "stav": "beta",
        "tagy": [
          "slova",
          "hádání",
          "hra"
        ]
      },
      {
        "soubor": "obsah/hangman.html",
        "nazev": "🪢 Šibenice",
        "popis": "Hádej slovo po písmenech, než se oběšenec dokreslí",
        "stav": "beta",
        "tagy": ["šibenice", "hádání slov", "slovní hra", "písmena"]
      },
      {
        "soubor": "obsah/osmismerka.html",
        "nazev": "🔡 Osmisměrka",
        "popis": "Hledej slova v mřížce všemi osmi směry, i k tisku",
        "stav": "beta",
        "tagy": ["osmisměrka", "hledání slov", "mřížka", "slovní hra"]
      },
      {
        "soubor": "obsah/crossword_gen.html",
        "nazev": "🧩 Generátor křížovek",
        "popis": "Z vlastních slov a nápověd sestaví křížovku k tisku",
        "stav": "beta",
        "tagy": [
          "křížovka",
          "hádanka",
          "slova"
        ]
      },
      {
        "soubor": "obsah/trivia.html",
        "nazev": "❓ Vědomostní kvíz",
        "popis": "Deset náhodných otázek z vybraného okruhu",
        "stav": "beta",
        "tagy": ["kvíz", "vědomosti", "otázky", "test", "soutěž"]
      },
      {
        "soubor": "obsah/tabooGame.html",
        "nazev": "🚫 Tabu (slovní popis)",
        "popis": "Kartičky Tabu: popiš slovo bez zakázaných výrazů",
        "stav": "beta",
        "tagy": ["tabu", "slovní hra", "popis", "párty", "zakázaná slova", "tisk kartiček", "karty"]
      },
      {
        "soubor": "obsah/pantomima.html",
        "nazev": "🎭 Pantomima (databanka)",
        "popis": "Databanka slov k předvádění beze slov, i k tisku",
        "stav": "beta",
        "tagy": [
          "šarády",
          "tisk kartiček",
          "charades",
          "předvádění",
          "zvířata",
          "povolání"
        ]
      },
      {
        "soubor": "obsah/bingo_gen.html",
        "nazev": "🎱 Generátor bingo kartiček",
        "popis": "Vytvoří bingo kartičky s čísly nebo vlastními slovy",
        "stav": "beta",
        "tagy": [
          "bingo",
          "oslava",
          "tisk",
          "party"
        ]
      }
    ]
  },
  {
    "nazev": "🧩 Hlavolamy",
    "skupina": "hry",
    "polozky": [
      {
        "soubor": "obsah/sudoku.html",
        "nazev": "🔢 Sudoku",
        "popis": "Doplň čísla 1–9 do mřížky, se zápisky a žebříčkem",
        "stav": "beta",
        "tagy": ["sudoku", "čísla", "hlavolam", "logika"]
      },
      {
        "soubor": "obsah/nonogram.html",
        "nazev": "🎨 Nonogramy",
        "popis": "Vybarvi políčka podle čísel a odhal obrázek",
        "stav": "beta",
        "tagy": ["nonogram", "japonské křížovky", "logika", "obrázek"]
      },
      {
        "soubor": "obsah/queens.html",
        "nazev": "👑 Královny (Queens)",
        "popis": "Rozmísti královny: jedna v řádku, sloupci i oblasti",
        "stav": "beta",
        "tagy": ["queens", "královny", "dáma", "oblasti", "logika", "hlavolam", "denní hádanka"]
      },
      {
        "soubor": "obsah/akari.html",
        "nazev": "💡 Akari (Light Up)",
        "popis": "Rozmísti žárovky tak, aby osvítily celou mřížku",
        "stav": "beta",
        "tagy": ["akari", "light up", "žárovky", "osvětlení", "logika", "hlavolam", "nikoli", "denní hádanka"]
      },
      {
        "soubor": "obsah/kakuro.html",
        "nazev": "🔢 Kakuro",
        "popis": "Číselná křížovka: doplň číslice podle součtů",
        "stav": "beta",
        "tagy": ["kakuro", "číselná křížovka", "součty", "čísla", "sudoku", "logika", "hlavolam", "denní hádanka"]
      },
      {
        "soubor": "obsah/hashi.html",
        "nazev": "🔗 Mosty (Hashi)",
        "popis": "Propoj ostrovy mosty podle čísel bez křížení",
        "stav": "beta",
        "tagy": ["hashi", "hashiwokakero", "bridges", "mosty", "ostrovy", "propojování", "logika", "hlavolam", "denní hádanka"]
      },
      {
        "soubor": "obsah/nurikabe.html",
        "nazev": "🏝️ Nurikabe",
        "popis": "Zatop moře tak, aby zbyly ostrovy dané velikosti",
        "stav": "beta",
        "tagy": ["nurikabe", "ostrovy", "moře", "zatápění", "logika", "hlavolam", "denní hádanka"]
      },
      {
        "soubor": "obsah/slitherlink.html",
        "nazev": "⭕ Slitherlink",
        "popis": "Spoj tečky jedinou smyčkou podle čísel v polích",
        "stav": "beta",
        "tagy": ["slitherlink", "smyčka", "loop", "tečky", "čáry", "fences", "logika", "hlavolam", "denní hádanka"]
      },
      {
        "soubor": "obsah/mastermind.html",
        "nazev": "🧠 Mastermind",
        "popis": "Uhodni tajnou kombinaci barev podle nápověd",
        "stav": "beta",
        "tagy": ["mastermind", "logik", "hádání kombinace", "barvy", "kolíčky", "dedukce", "bulls and cows"]
      },
      {
        "soubor": "obsah/minesweeper.html",
        "nazev": "💣 Hledání min",
        "popis": "Odkryj všechna pole bez min podle čísel sousedů",
        "stav": "beta",
        "tagy": [
          "miny",
          "sapér",
          "hra"
        ]
      },
      {
        "soubor": "obsah/game_2048.html",
        "nazev": "🔢 2048",
        "popis": "Posouvej dlaždice a spojuj stejná čísla až na 2048",
        "stav": "beta",
        "tagy": [
          "čísla",
          "posouvání",
          "hra"
        ]
      },
      {
        "soubor": "obsah/sokoban.html",
        "nazev": "📦 Sokoban",
        "popis": "Tlač bedny ve skladišti na vyznačená místa",
        "stav": "beta",
        "tagy": ["bedny", "hlavolam", "logika", "skladiště"]
      },
      {
        "soubor": "obsah/lights_out.html",
        "nazev": "💡 Lights Out",
        "popis": "Zhasni všechna světla, klik přepne i sousedy",
        "stav": "beta",
        "tagy": ["světla", "hlavolam", "logika", "přepínání"]
      },
      {
        "soubor": "obsah/hanoi.html",
        "nazev": "🗼 Hanojské věže",
        "popis": "Přesuň disky na jinou tyč, větší nikdy na menší",
        "stav": "beta",
        "tagy": ["hanoj", "věže", "hlavolam", "disky", "logika"]
      },
      {
        "soubor": "obsah/simon.html",
        "nazev": "🎵 Simon",
        "popis": "Zapamatuj si a zopakuj rostoucí řadu barev",
        "stav": "beta",
        "tagy": ["simon", "paměť", "sekvence", "barvy", "zvuky"]
      },
      {
        "soubor": "obsah/viktoriansky_dum.html",
        "nazev": "🕯️ Viktoriánský dům",
        "popis": "Hledej ukryté předměty v pokojích starého domu",
        "stav": "vyvoj",
        "tagy": ["hledání předmětů", "skryté předměty", "hidden object", "hledačka", "viktoriánský", "pokoje", "starožitnosti", "pozornost", "obrázková hra", "kde je vali"]
      }
    ]
  },
  {
    "nazev": "❓ Hádanky",
    "skupina": "hry",
    "polozky": [
      {
        "soubor": "obsah/ciselny_kod.html",
        "nazev": "🔐 Číselný kód",
        "popis": "Rozlušti zámek z logických nápověd k číslicím",
        "stav": "vyvoj",
        "tagy": ["hádanka", "kód", "zámek", "kombinace", "pravidla", "prvočíslo", "logika", "dedukce", "trezor", "denní hádanka"]
      },
      {
        "soubor": "obsah/einstein.html",
        "nazev": "🦓 Einsteinova hádanka",
        "popis": "Z nápověd urči, kdo bydlí ve kterém domě a co má",
        "stav": "vyvoj",
        "tagy": ["hádanka", "einstein", "zebra", "logika", "dedukce", "logická mřížka", "křížkovací tabulka", "domy", "denní hádanka"]
      },
      {
        "soubor": "obsah/rytiri_padousi.html",
        "nazev": "🗡️ Rytíři a padouši",
        "popis": "Urči podle výroků, kdo mluví pravdu a kdo lže",
        "stav": "vyvoj",
        "tagy": ["rytíři a padouši", "hádanka", "logika", "dedukce", "pravda", "lež", "výroky", "lháři", "hlavolam", "denní hádanka"]
      },
      {
        "soubor": "obsah/pismenkove_pocty.html",
        "nazev": "➕ Písmenkové počty",
        "popis": "Nahraď písmena číslicemi, aby příklad vyšel",
        "stav": "vyvoj",
        "tagy": ["hádanka", "alfametika", "písmenka", "číslice", "sčítání", "šifra", "logika", "dedukce", "SEND+MORE", "denní hádanka"]
      },
      {
        "soubor": "obsah/vahy_mince.html",
        "nazev": "⚖️ Váhy a falešná mince",
        "popis": "Najdi padělek mezi mincemi co nejméně váženími",
        "stav": "vyvoj",
        "tagy": ["váhy", "falešná mince", "padělek", "vážení", "hlavolam", "logika", "dedukce", "12 mincí", "strategie", "hádanka"]
      },
      {
        "soubor": "obsah/prevoznik.html",
        "nazev": "🚣 Převozník",
        "popis": "Převez všechny přes řeku tak, aby se nesnědli",
        "stav": "vyvoj",
        "tagy": ["hlavolam", "logika", "převoz", "řeka", "vlk koza zelí", "misionáři a kanibalové", "most a lucerna", "žárliví manželé", "hádanka"]
      },
      {
        "soubor": "obsah/vyprava.html",
        "nazev": "🧭 Dílna výprav",
        "popis": "Připrav pro druhé šifrovanou hru s mapou pokladu a kartami k tisku",
        "stav": "vyvoj",
        "tagy": ["hledání pokladu", "bojovka", "šifrovačka", "mapa pokladu", "šifry", "stopovaná", "Indiana Jones", "dětská hra", "narozeninová hra", "únikovka", "zednářská šifra", "Caesar", "Morseovka", "ptačí písmo", "šifrovací kolečko", "tisk"]
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
        "popis": "Klidná výprava souostrovím: objevuj ostrovy a sbírej",
        "stav": "beta",
        "tagy": ["piráti", "poklad", "karibik", "ostrovy", "plachetnice", "mapa", "mlha", "rybaření", "explorace", "hádanka", "denní výprava"]
      },
      {
        "soubor": "obsah/trosecnici.html",
        "nazev": "🏝️ Trosečníci",
        "popis": "Přežij na ostrově: sbírej zdroje, stav tábor a přijímej trosečníky",
        "stav": "beta",
        "tagy": ["trosečník", "survival", "přežití", "ostrov", "tahová strategie", "pixel art", "průzkum", "mlha", "rybaření", "procedurální mapa"]
      },
      {
        "soubor": "obsah/poklad.html",
        "nazev": "🗝️ Poklad pirátů",
        "popis": "Podle indicií vyškrtej políčka a vykopej truhlu",
        "stav": "beta",
        "tagy": ["piráti", "poklad", "ostrov", "indicie", "dedukce", "logika", "hlavolam", "mapa", "denní hádanka"]
      },
      {
        "soubor": "obsah/rybar.html",
        "nazev": "🎣 Tropický rybář",
        "popis": "Lov ryb z mola i nad hlubinou, prodej a sbírej druhy",
        "stav": "beta",
        "tagy": ["rybaření", "ryby", "rybář", "moře", "molo", "útes", "návnada", "atlas ryb", "relax", "tropy"]
      },
      {
        "soubor": "obsah/obchodnik.html",
        "nazev": "⚓ Pirát obchodník",
        "popis": "Za 30 dní nakupuj levně, prodávej draze a splať dluh",
        "stav": "beta",
        "tagy": ["obchod", "piráti", "karibik", "ekonomie", "ceny", "loď", "plavba", "strategie", "taipan", "pixel art", "flotila", "vylepšení", "noc", "stará mapa", "game boy"]
      },
      {
        "soubor": "obsah/laguna.html",
        "nazev": "🐠 Laguna",
        "popis": "Potápěj se v laguně a fotografuj ryby do atlasu",
        "stav": "beta",
        "tagy": ["potápění", "šnorchlování", "ryby", "korály", "fotografie", "atlas", "podmořský svět", "relax", "moře", "mangrovy", "modrá díra", "pixel art"]
      },
      {
        "soubor": "obsah/zapad_slunce.html",
        "nazev": "🌅 Západ slunce",
        "popis": "Relaxační západ slunce se zvuky moře a dýcháním",
        "stav": "beta",
        "tagy": ["relax", "relaxace", "západ slunce", "východ slunce", "úsvit", "bouřka", "delfíni", "pláž", "molo", "útes", "plachetnice", "mangrovy", "laguna", "moře", "vlny", "palmy", "hvězdy", "dýchání", "zvuky přírody", "usínání", "karibik", "zelený záblesk", "bioluminiscence"]
      },
      {
        "soubor": "obsah/kostky.html",
        "nazev": "🎲 Pirátské kostky",
        "popis": "Liar's Dice: blafuj o kostkách v pohárcích proti pirátům",
        "stav": "beta",
        "tagy": ["kostky", "liar's dice", "perudo", "blafování", "pravděpodobnost", "piráti", "AI soupeři", "strategie", "denní výzva", "hospoda"]
      },
      {
        "soubor": "obsah/stychy.html",
        "nazev": "🃏 Štychy na palubě",
        "popis": "Karetní hra: odhadni počet štychů a trefuj se přesně",
        "stav": "beta",
        "tagy": ["karty", "štychy", "odhad", "piráti", "AI soupeři", "strategie", "trumfy", "denní výzva", "tahová", "více hráčů"]
      },
      {
        "soubor": "obsah/taverna.html",
        "nazev": "🍹 Taverna v přístavu",
        "popis": "Míchej grog, peč ryby a obsluhuj hosty, splať dluh",
        "stav": "beta",
        "tagy": ["manažerská", "taverna", "hospoda", "vaření", "recepty", "piráti", "ekonomika", "časovka", "pixel art", "vylepšení", "zvěsti", "denní výzva", "přístav"]
      },
      {
        "soubor": "obsah/plantaz.html",
        "nazev": "🌴 Plantáž",
        "popis": "Pět let hospodař na tropické plantáži a prodávej úrodu",
        "stav": "beta",
        "tagy": ["budovatelská", "strategie", "tahová", "ekonomika", "simulace", "farmaření", "ostrov", "počasí", "hurikány", "obchod", "pixel art", "denní výzva"]
      },
      {
        "soubor": "obsah/lodenice.html",
        "nazev": "⚓ Loděnice",
        "popis": "Postav loď z dílů a vyzkoušej ji ve větru na moři",
        "stav": "beta",
        "tagy": ["lodě", "plachetnice", "fyzika", "Archimédes", "stabilita", "metacentrum", "simulace", "konstrukce", "stavění", "zakázky", "polární diagram", "denní výzva"]
      },
      {
        "soubor": "obsah/navigator.html",
        "nazev": "🧭 Navigátor",
        "popis": "Pluj Karibikem bez GPS, jen s kompasem a sextantem",
        "stav": "beta",
        "tagy": ["navigace", "sextant", "Polárka", "astronomie", "deklinace", "výpočet polohy", "mapa", "karibik", "plachetnice", "výuková", "simulace", "denní výzva"]
      },
      {
        "soubor": "obsah/lahev.html",
        "nazev": "🍾 Vzkaz v láhvi",
        "popis": "Rozlušti šifrovaný vzkaz a podle něj vykopej poklad",
        "stav": "beta",
        "tagy": ["šifry", "luštění", "kryptografie", "Caesar", "morseovka", "substituce", "Vigenère", "piráti", "poklad", "mapa", "denní výzva", "logika"]
      },
      {
        "soubor": "obsah/uzly.html",
        "nazev": "🪢 Námořnické uzly",
        "popis": "Rozmotej lana bez křížení a nauč se námořnické uzly",
        "stav": "beta",
        "tagy": ["hlavolam", "logika", "planarita", "rozmotávání", "uzly", "lana", "námořnictví", "atlas", "výuka", "kvíz", "denní výzva"]
      },
      {
        "soubor": "obsah/steeldrum.html",
        "nazev": "🥁 Steel drum",
        "popis": "Hraj na karibský ocelový buben, rytmus i opakování",
        "stav": "beta",
        "tagy": ["hudba", "rytmická hra", "steel drum", "calypso", "karibik", "syntéza zvuku", "paměť", "Simon", "denní výzva", "dotyk", "klávesnice"]
      },
      {
        "soubor": "obsah/regata.html",
        "nazev": "⛵ Regata",
        "popis": "Závod plachetnic: čti vítr, křižuj a obepluj bóje",
        "stav": "beta",
        "tagy": ["plachetnice", "regata", "závod", "vítr", "polární diagram", "křižování", "taktika", "AI soupeři", "denní výzva", "simulace", "dotykové ovládání"]
      },
      {
        "soubor": "obsah/zelvy.html",
        "nazev": "🐢 Želví pláž",
        "popis": "Doveď vylíhlá želvátka v noci bezpečně do moře",
        "stav": "beta",
        "tagy": ["želvy", "mořské želvy", "pláž", "noc", "příroda", "ochrana přírody", "světelné znečištění", "pixel art", "relax", "deník", "denní výzva"]
      },
      {
        "soubor": "obsah/plaz.html",
        "nazev": "🐚 Plážový sběratel",
        "popis": "Sbírej mušle při odlivu a dopiš atlas pláže v pixel artu",
        "stav": "beta",
        "tagy": ["pláž", "mušle", "sběratelství", "příliv", "odliv", "Měsíc", "pixel art", "relax", "atlas", "příroda", "denní výzva"]
      },
      {
        "soubor": "obsah/zivly.html",
        "nazev": "🌋 Živly ostrova",
        "popis": "Simulace sopek a hurikánů – předpověz erupci i trasu bouře",
        "stav": "beta",
        "tagy": ["sopka", "vulkán", "erupce", "hurikán", "počasí", "karibik", "simulace", "výuková", "zeměpis", "předpověď", "evakuace", "denní výzva"]
      },
      {
        "soubor": "obsah/potapeni_vrak.html",
        "nazev": "🤿 Potápění k vraku",
        "popis": "Potápěj se k vrakům pro poklady, hlídej vzduch a dekompresi",
        "stav": "vyvoj",
        "tagy": ["potápění", "vrak", "poklad", "dekomprese", "Bühlmann", "vzduch", "narkóza", "nitrox", "proudy", "průzkum", "vylepšení", "deník ponorů", "moře", "tropy"]
      }
    ]
  },
  {
    "nazev": "📍 Na místě činu",
    "skupina": "vysetrovani",
    "polozky": [
      {
        "soubor": "obsah/vysetrovani.html",
        "nazev": "🧪 Vyšetřovací laboratoř – úvod a modelový případ",
        "popis": "Rozcestník kriminalistických nástrojů s modelovým případem",
        "stav": "vyvoj",
        "tagy": ["vyšetřování", "modelový případ", "průvodce", "kriminalistika", "metodika", "přehled nástrojů", "výuka", "nábor", "policie"]
      },
      {
        "soubor": "obsah/scene_sketch.html",
        "nazev": "📐 Náčrt místa činu",
        "popis": "Plánek místa činu v metrech s kótami, značkami stop a měřítkem",
        "stav": "beta",
        "tagy": ["místo činu", "plánek", "skica", "měřítko", "značky důkazů", "kóty", "půdorys", "fotka jako podklad", "fotopozice", "kriminalistika"]
      },
      {
        "soubor": "obsah/fotodokumentace.html",
        "nazev": "📸 Fotodokumentace",
        "popis": "Fotky do spisu s otiskem, anotacemi stop a fototabulkou k tisku",
        "stav": "vyvoj",
        "tagy": ["fotodokumentace", "fototabulka", "místo činu", "anotace", "značky stop", "měřítko", "kalibrace", "perspektiva", "homografie", "měření", "nejistota", "EXIF", "SHA-256", "zakrytí SPZ", "rozmazání obličeje", "lupa", "spis", "kriminalistika"]
      },
      {
        "soubor": "obsah/teren.html",
        "nazev": "📱 Terén – sken štítků a předání stop",
        "popis": "Přenos spisu mezi telefonem a PC, sken QR štítků a předání stop",
        "stav": "vyvoj",
        "tagy": ["terén", "telefon", "mobil", "QR", "štítek", "sken", "předání", "řetězec předávání", "chain of custody", "fotodokumentace", "offline", "balíček spisu"]
      },
      {
        "soubor": "obsah/investigation_checklist.html",
        "nazev": "✅ Kontrolní seznamy vyšetřování",
        "popis": "Checklisty pro ohledání, výslech či nehodu se zaškrtáváním",
        "stav": "beta",
        "tagy": ["vyšetřování", "checklist", "ohledání", "výslech", "nehoda"]
      },
      {
        "soubor": "obsah/evidence_log.html",
        "nazev": "📦 Evidenční deník důkazů",
        "popis": "Evidence stop s řetězcem předání, QR štítky a exportem",
        "stav": "beta",
        "tagy": ["vyšetřování", "chain of custody", "důkazy", "evidence"]
      },
      {
        "soubor": "obsah/protocol_gen.html",
        "nazev": "📝 Generátor protokolů",
        "popis": "Protokoly o ohledání, výslechu a zajištění věci k tisku",
        "stav": "beta",
        "tagy": ["vyšetřování", "protokol", "ohledání", "výslech", "zajištění věci"]
      }
    ]
  },
  {
    "nazev": "🔬 Analýza stop",
    "skupina": "vysetrovani",
    "polozky": [
      {
        "soubor": "obsah/vyska_z_fotky.html",
        "nazev": "📏 Výška osoby z fotky",
        "popis": "Odhadne výšku osoby z fotky nebo záznamu kamery",
        "stav": "vyvoj",
        "tagy": ["fotogrammetrie", "výška osoby", "kamerový záznam", "CCTV", "úběžník", "horizont", "dvojpoměr", "Criminisi", "single view metrology", "Monte Carlo", "nejistota", "zkreslení objektivu", "protokol", "kriminalistika", "citlivostní analýza", "porovnání s podezřelým", "více snímků", "ukázky"]
      },
      {
        "soubor": "obsah/krevni_stopy.html",
        "nazev": "🩸 Úhel dopadu krevních stop",
        "popis": "Spočítá úhel dopadu a oblast původu krevních stop z fotky",
        "stav": "vyvoj",
        "tagy": ["BPA", "krvavé stopy", "úhel dopadu", "kriminalistika", "forenzní", "oblast konvergence", "oblast původu", "tangentová metoda", "elipsa", "3D", "protokol", "CSV", "výuka", "perspektiva", "homografie", "RANSAC", "Monte Carlo", "gravitace", "ukázky"]
      },
      {
        "soubor": "obsah/brzdna_draha.html",
        "nazev": "🚗 Rychlost z brzdné stopy",
        "popis": "Odhadne rychlost vozidla z délky brzdné stopy",
        "stav": "vyvoj",
        "tagy": ["nehoda", "brzdná dráha", "rychlost", "součinitel tření", "dráha zastavení"]
      },
      {
        "soubor": "obsah/stret_vozidel.html",
        "nazev": "💥 Rekonstrukce střetu vozidel",
        "popis": "Spočítá rychlosti vozidel před srážkou ze zachování hybnosti",
        "stav": "vyvoj",
        "tagy": ["střet", "srážka", "dopravní nehoda", "hybnost", "rekonstrukce nehody", "dojezd", "konečná poloha", "rychlost před střetem", "Δv", "PDOF", "brzdná stopa", "Monte Carlo", "plánek nehody", "kriminalistika"]
      },
      {
        "soubor": "obsah/doba_smrti.html",
        "nazev": "🌡️ Odhad doby smrti",
        "popis": "Odhad doby od smrti podle teploty těla a posmrtných změn",
        "stav": "vyvoj",
        "tagy": ["soudní lékařství", "Henssge", "nomogram", "posmrtné skvrny", "ztuhlost"]
      }
    ]
  },
  {
    "nazev": "📱 Digitální a datové stopy",
    "skupina": "vysetrovani",
    "polozky": [
      {
        "soubor": "obsah/casova_analyza.html",
        "nazev": "🕰️ Časová analýza záznamů GPS a telefonu",
        "popis": "Polohy z GPS, Google Takeout a výpisy hovorů na jedné časové ose",
        "stav": "vyvoj",
        "tagy": ["vyšetřování", "časová analýza", "GPS", "Google Takeout", "Timeline", "výpis hovorů", "CSV", "EXIF", "GPX", "KML", "GeoJSON", "časové pásmo", "posun hodin", "pobyty", "stay points", "nemožná rychlost", "mezery v datech", "souběh osob", "alibi", "mapa", "protokol", "kriminalistika", "soukromí", "BTS", "zájmová místa", "domov a práce", "vzorce pohybu", "konzistence zdrojů", "spoofing", "SHA-256", "řetězec důkazů"]
      },
      {
        "soubor": "obsah/vazby_analyza.html",
        "nazev": "🕸️ Analýza vazeb",
        "popis": "Graf vazeb mezi osobami, telefony, vozidly a účty",
        "stav": "beta",
        "tagy": ["vyšetřování", "graf vazeb", "link analysis", "centralita", "nejkratší cesta", "CSV"]
      },
      {
        "soubor": "obsah/financni_toky.html",
        "nazev": "💸 Finanční toky z výpisů",
        "popis": "Rozbor bankovních výpisů a hledání podezřelých plateb",
        "stav": "vyvoj",
        "tagy": ["bankovní výpis", "finanční šetření", "praní peněz", "AML", "hospodářská kriminalita", "smurfing", "strukturování", "money mule", "bílý kůň", "okružní platby", "Sankey", "toky peněz", "CSV import", "windows-1250", "párování převodů", "indicie"]
      },
      {
        "soubor": "obsah/hash_compare.html",
        "nazev": "🔐 Porovnání otisků souborů",
        "popis": "Spočítá a porovná hashe souborů a ověří manifest",
        "stav": "beta",
        "tagy": ["forenzní", "hash", "sha256", "otisk", "integrita"]
      },
      {
        "soubor": "obsah/file_signature.html",
        "nazev": "🔎 Identifikace typu souboru",
        "popis": "Pozná skutečný typ souboru z hlavičky a odhalí falešnou příponu",
        "stav": "beta",
        "tagy": ["forenzní", "magic bytes", "hlavička souboru", "falešná přípona"]
      },
      {
        "soubor": "obsah/pravost_fotky.html",
        "nazev": "🖼️ Ověření pravosti fotografie",
        "popis": "Kontrola úprav fotografie: EXIF, ELA a stopy přeuložení",
        "stav": "vyvoj",
        "tagy": ["pravost fotky", "úprava fotografie", "padělek", "fotomontáž", "ELA", "error level analysis", "EXIF", "metadata", "náhled", "kvantizační tabulka", "kvalita JPEG", "dvojitá komprese", "klonování", "copy-move", "šum", "forenzní analýza obrazu", "SHA-256", "protokol"]
      },
      {
        "soubor": "obsah/exif_viewer.html",
        "nazev": "📷 EXIF prohlížeč",
        "popis": "Zobrazí metadata fotky včetně GPS a umí je odstranit",
        "stav": "beta",
        "tagy": ["exif", "metadata", "foto", "gps", "expozice"]
      },
      {
        "soubor": "obsah/mic.html",
        "nazev": "🖨️ Stopy tiskárny (MIC)",
        "popis": "Najde a dekóduje žluté sledovací tečky tiskárny na skenu",
        "stav": "vyvoj",
        "tagy": ["tiskárna", "žluté tečky", "MIC", "machine identification code", "sledovací tečky", "yellow dots", "steganografie", "sériové číslo", "sken", "forenzní", "Xerox", "DocuColor", "anonymizace", "soukromí", "laserová tiskárna"]
      },
      {
        "soubor": "obsah/vin_decoder.html",
        "nazev": "🚗 Dekodér VIN",
        "popis": "Rozloží VIN na výrobce, model, rok a ověří kontrolní znak",
        "stav": "beta",
        "tagy": ["vozidlo", "vin", "identifikační číslo", "wmi"]
      },
      {
        "soubor": "obsah/sifry.html",
        "nazev": "🔏 Šifry – kryptologická dílna",
        "popis": "Šifruj, luštěj a analyzuj – Caesar, Vigenère, Enigma a další",
        "stav": "beta",
        "tagy": ["šifra", "Caesar", "Vigenère", "Enigma", "Morseovka", "frekvenční analýza", "kryptografie", "kryptoanalýza", "luštění", "výzva", "hra", "transpozice", "substituce",
          "afinní", "Beaufort", "Playfair", "Bifid", "ADFGVX", "Hill", "Bacon", "plotová šifra", "Base64", "hash", "SHA-256", "MD5", "HMAC", "AES", "RSA", "teorie čísel", "XOR", "index koincidence", "Kasiski", "CyberChef", "recept",
          "šifrovačky", "zednářská šifra", "pigpen", "A1Z26", "ťukací kód", "Braille", "semafor", "čtyřčtverec", "Trifid", "nihilistická", "Myszkowski", "skytale", "Chaocipher", "luštění bez klíče",
          "crib", "známý otevřený text", "Turingova bomba", "M-209", "Lorenz", "Tunny", "Jeffersonův válec", "deník", "hex výpis", "kampaň", "šifra dne", "Voynichův rukopis", "Bealovy šifry", "Zodiac", "Kryptos"]
      }
    ]
  },
  {
    "nazev": "📁 Spis a výslech",
    "skupina": "vysetrovani",
    "polozky": [
      {
        "soubor": "obsah/spis.html",
        "nazev": "📁 Spis případu",
        "popis": "Společný spis: osoby, stopy, události a vazby jednoho případu",
        "stav": "vyvoj",
        "tagy": ["spis", "případ", "vyšetřování", "osoby", "stopy", "vazby", "události", "evidence", "balíček", "export", "import", "historie změn", "modelový případ"]
      },
      {
        "soubor": "obsah/nastenka.html",
        "nazev": "🧷 Nástěnka vyšetřovatele",
        "popis": "Nástěnka s provázky mezi osobami, stopami a tvrzeními",
        "stav": "vyvoj",
        "tagy": ["nástěnka", "provázky", "vazby", "spis", "tvrzení", "důkazy", "rozpor", "alibi", "myšlenková mapa", "vyšetřování", "kriminalistika"]
      },
      {
        "soubor": "obsah/rozbor_vypovedi.html",
        "nazev": "🗒️ Rozbor výpovědi",
        "popis": "Vyznačí v textu výpovědi časy, osoby a místa a najde rozpory",
        "stav": "vyvoj",
        "tagy": ["výpověď", "úřední záznam", "podání vysvětlení", "rozbor textu", "alibi", "rozpor", "tvrzení", "časová osa", "spis", "svědek"]
      },
      {
        "soubor": "obsah/case_timeline.html",
        "nazev": "🕵️ Časová osa případu",
        "popis": "Chronologie událostí, důkazů a výpovědí s mírou jistoty",
        "stav": "beta",
        "tagy": ["vyšetřování", "timeline", "případ", "chronologie"]
      },
      {
        "soubor": "obsah/interview_questions.html",
        "nazev": "🎙️ Příprava výslechu",
        "popis": "Plán výslechu podle modelu PEACE s bankou otázek",
        "stav": "beta",
        "tagy": ["vyšetřování", "výslech", "svědek", "poškozený", "podezřelý", "pohovor"]
      },
      {
        "soubor": "obsah/trestni_zakonik_ref.html",
        "nazev": "⚖️ Rychlá reference trestního zákoníku",
        "popis": "Vyhledávání vybraných paragrafů a skutkových podstat",
        "stav": "beta",
        "jen_cs": true,
        "tagy": ["zákon", "paragraf", "trestní zákoník", "skutková podstata"]
      },
      {
        "soubor": "obsah/treninkovy_pripad.html",
        "nazev": "🎓 Tréninkový případ – najdi rozpor",
        "popis": "Projdi smyšlený spis a najdi rozpory ve výpovědích",
        "stav": "vyvoj",
        "jen_cs": true,
        "tagy": ["vyšetřování", "kriminalistika", "cvičení", "trénink", "rozpor", "výpověď", "alibi", "svědek", "důkazy", "stopy", "spis", "nábor", "policie", "hra", "logika", "kritické myšlení"]
      }
    ]
  },
  {
    "nazev": "⚖️ Právo & dokumenty",
    "skupina": "dokumenty",
    "polozky": [
      {
        "soubor": "obsah/household_docs.html",
        "nazev": "📜 Vzory dokumentů pro domácnost",
        "popis": "Plná moc, výpověď z nájmu, reklamace či půjčka k vyplnění",
        "stav": "beta",
        "jen_cs": true,
        "tagy": ["plná moc", "výpověď z nájmu", "půjčka", "reklamace", "smlouva"]
      },
      {
        "soubor": "obsah/dedicke_podily.html",
        "nazev": "⚖️ Dědické podíly",
        "popis": "Spočítá, kdo a kolik dědí ze zákona bez závěti",
        "stav": "beta",
        "jen_cs": true,
        "tagy": ["dědictví", "dědická třída", "zákonná posloupnost", "pozůstalost", "sjm", "povinný díl", "občanský zákoník", "závěť"]
      },
      {
        "soubor": "obsah/lhuty_uroky.html",
        "nazev": "⚖️ Lhůty a úroky z prodlení",
        "popis": "Úrok z prodlení a počítání lhůt podle českých zákonů",
        "stav": "vyvoj",
        "jen_cs": true,
        "tagy": ["úrok z prodlení", "repo sazba", "ČNB", "lhůta", "OSŘ", "správní řád", "svátky", "Velikonoce", "fikce doručení", "pracovní dny"]
      },
      {
        "soubor": "obsah/nezabavitelna_castka.html",
        "nazev": "💸 Nezabavitelná částka (exekuce)",
        "popis": "Kolik smí exekutor strhnout ze mzdy a kolik zůstane",
        "stav": "vyvoj",
        "jen_cs": true,
        "tagy": ["exekuce", "srážky ze mzdy", "nezabavitelná částka", "přednostní pohledávka", "insolvence", "OSŘ 279", "životní minimum", "2026"]
      },
      {
        "soubor": "obsah/vyzivne.html",
        "nazev": "👨‍👧 Orientační výživné",
        "popis": "Orientační výše výživného podle tabulky ministerstva",
        "stav": "vyvoj",
        "jen_cs": true,
        "tagy": ["výživné", "alimenty", "tabulka MSp", "střídavá péče", "dítě", "rozvod", "kontrolní částka"]
      },
      {
        "soubor": "obsah/soudni_poplatky.html",
        "nazev": "🏛️ Soudní poplatky",
        "popis": "Spočítá soudní poplatek za žalobu, odvolání či návrh",
        "stav": "vyvoj",
        "jen_cs": true,
        "tagy": ["soudní poplatek", "sazebník", "žaloba", "platební rozkaz", "odvolání", "dovolání", "rozvod", "katastr", "notář", "549/1991"]
      }
    ]
  },
  {
    "nazev": "🦺 BOZP a požární ochrana",
    "skupina": "formulare",
    "polozky": [
      {
        "soubor": "obsah/kniha_urazu.html",
        "nazev": "🩹 Kniha úrazů",
        "popis": "Evidence pracovních úrazů zaměstnavatele k tisku",
        "stav": "vyvoj",
        "jen_cs": true,
        "tagy": ["kniha úrazů", "úraz", "pracovní úraz", "BOZP", "evidence úrazů", "NV 322/2025", "201/2010", "tiskopis", "formulář", "tisk", "šablona"]
      },
      {
        "soubor": "obsah/zaznam_urazu.html",
        "nazev": "📝 Záznam o úrazu – koncept",
        "popis": "Koncept záznamu o pracovním úrazu podle NV 322/2025",
        "stav": "vyvoj",
        "jen_cs": true,
        "tagy": ["záznam o úrazu", "pracovní úraz", "SÚIP", "hlášení úrazu", "NV 322/2025", "BOZP", "tiskopis", "formulář", "tisk", "šablona"]
      },
      {
        "soubor": "obsah/prezencni_listina.html",
        "nazev": "✍️ Prezenční listina ze školení",
        "popis": "Listina účastníků školení BOZP a PO s podpisy k tisku",
        "stav": "vyvoj",
        "jen_cs": true,
        "tagy": ["prezenční listina", "školení", "BOZP", "PO", "požární ochrana", "podpisy", "tiskopis", "formulář", "tisk", "šablona"]
      },
      {
        "soubor": "obsah/karta_oopp.html",
        "nazev": "🦺 Karta výdeje OOPP",
        "popis": "Osobní karta výdeje ochranných pomůcek zaměstnancům",
        "stav": "vyvoj",
        "jen_cs": true,
        "tagy": ["OOPP", "ochranné pomůcky", "výdejka", "osobní karta", "pracovní oděv", "BOZP", "390/2021", "tiskopis", "formulář", "tisk", "šablona"]
      },
      {
        "soubor": "obsah/kontrolni_list.html",
        "nazev": "☑️ Kontrolní listy",
        "popis": "Checklisty pro prověrku BOZP, audit či kontrolu vozidla",
        "stav": "vyvoj",
        "jen_cs": true,
        "tagy": ["kontrolní list", "checklist", "prověrka BOZP", "audit", "kontrola vozidla", "kontrola", "tiskopis", "formulář", "tisk", "šablona"]
      },
      {
        "soubor": "obsah/pozarni_kniha.html",
        "nazev": "🧯 Požární kniha a kontroly PHP",
        "popis": "Záznamy požární ochrany a kontrol hasicích přístrojů",
        "stav": "vyvoj",
        "jen_cs": true,
        "tagy": ["požární kniha", "požární ochrana", "PO", "hasicí přístroje", "PHP", "246/2001", "preventivní požární prohlídka", "tiskopis", "formulář", "tisk", "šablona"]
      },
      {
        "soubor": "obsah/provozni_denik.html",
        "nazev": "🛠️ Provozní deníky a revize",
        "popis": "Deníky kotelny, VZV, žebříků a regálů s hlídáním revizí",
        "stav": "vyvoj",
        "jen_cs": true,
        "tagy": ["provozní deník", "kotelna", "vysokozdvižný vozík", "VZV", "žebříky", "regály", "revize", "lhůty revizí", "elektro", "tiskopis", "formulář", "tisk", "šablona"]
      }
    ]
  },
  {
    "nazev": "👥 Zaměstnanci",
    "skupina": "formulare",
    "polozky": [
      {
        "soubor": "obsah/dochazka.html",
        "nazev": "🕒 Evidence pracovní doby",
        "popis": "Výkaz docházky s přesčasy, noční prací a svátky",
        "stav": "vyvoj",
        "jen_cs": true,
        "tagy": ["docházka", "výkaz práce", "evidence pracovní doby", "přesčas", "noční práce", "svátky", "fond pracovní doby", "§ 96", "tiskopis", "formulář", "tisk", "šablona"]
      },
      {
        "soubor": "obsah/smenny_rozpis.html",
        "nazev": "📅 Směnný rozpis",
        "popis": "Rozvrh směn zaměstnanců na měsíc k tisku",
        "stav": "vyvoj",
        "jen_cs": true,
        "tagy": ["směny", "směnný rozpis", "rozvrh pracovní doby", "plán směn", "§ 84", "služby", "tiskopis", "formulář", "tisk", "šablona"]
      },
      {
        "soubor": "obsah/plan_dovolenych.html",
        "nazev": "🏖️ Plán dovolených",
        "popis": "Rozvrh čerpání dovolené zaměstnanců na celý rok",
        "stav": "vyvoj",
        "jen_cs": true,
        "tagy": ["dovolená", "plán dovolených", "rozvrh čerpání dovolené", "§ 217", "nárok", "tiskopis", "formulář", "tisk", "šablona"]
      },
      {
        "soubor": "obsah/mzdove_naklady.html",
        "nazev": "🧮 Mzdové náklady zaměstnavatele",
        "popis": "Kolik zaměstnanec stojí firmu: odvody, čistá mzda, DPP",
        "stav": "vyvoj",
        "jen_cs": true,
        "tagy": ["mzdové náklady", "superhrubá mzda", "cena práce", "odvody zaměstnavatele", "sociální pojištění", "zdravotní pojištění", "čistá mzda", "DPP", "DPČ", "minimální mzda", "doplatek do minima", "sleva na pojistném", "zkrácený úvazek", "pojištění odpovědnosti", "Kooperativa", "stravenkový paušál", "benefity", "náklad na hodinu", "OSVČ", "švarcsystém", "kalkulačka", "2026"]
      }
    ]
  },
  {
    "nazev": "🏢 Firma, provoz a protokoly",
    "skupina": "formulare",
    "polozky": [
      {
        "soubor": "obsah/pokladna.html",
        "nazev": "💰 Pokladní doklady a kniha",
        "popis": "Příjmové a výdajové doklady a pokladní kniha s částkou slovy",
        "stav": "vyvoj",
        "jen_cs": true,
        "tagy": ["pokladní doklad", "příjmový doklad", "výdajový doklad", "pokladní kniha", "částka slovy", "účetnictví", "pokladna", "tiskopis", "formulář", "tisk", "šablona"]
      },
      {
        "soubor": "obsah/kniha_jizd.html",
        "nazev": "🚗 Kniha jízd",
        "popis": "Evidence služebních jízd s tachometrem a PHM k tisku",
        "stav": "vyvoj",
        "jen_cs": true,
        "tagy": ["kniha jízd", "evidence jízd", "služební auto", "tachometr", "PHM", "daně", "tiskopis", "formulář", "tisk", "šablona"]
      },
      {
        "soubor": "obsah/cestovni_prikaz.html",
        "nazev": "🧳 Cestovní příkaz",
        "popis": "Pracovní cesta a vyúčtování stravného a náhrad",
        "stav": "vyvoj",
        "jen_cs": true,
        "tagy": ["cestovní příkaz", "pracovní cesta", "cestovní náhrady", "stravné", "vyúčtování", "služební cesta", "tiskopis", "formulář", "tisk", "šablona"]
      },
      {
        "soubor": "obsah/predavaci_protokol.html",
        "nazev": "🔑 Předávací protokoly",
        "popis": "Protokoly o předání bytu, vozidla, klíčů či díla",
        "stav": "vyvoj",
        "jen_cs": true,
        "tagy": ["předávací protokol", "předání bytu", "nájem", "měřidla", "klíče", "předání vozidla", "předání díla", "svěřené věci", "tiskopis", "formulář", "tisk", "šablona"]
      },
      {
        "soubor": "obsah/haccp.html",
        "nazev": "🌡️ HACCP a hygiena",
        "popis": "Záznamy teplot, úklidu a příjmu zboží pro provozovny jídla",
        "stav": "vyvoj",
        "jen_cs": true,
        "tagy": ["HACCP", "teploty", "lednice", "sanitační plán", "úklid", "příjem zboží", "hygiena potravin", "852/2004", "gastro", "tiskopis", "formulář", "tisk", "šablona"]
      },
      {
        "soubor": "obsah/evidence_odpadu.html",
        "nazev": "♻️ Evidence odpadů",
        "popis": "Průběžná evidence odpadů s katalogovými čísly",
        "stav": "vyvoj",
        "jen_cs": true,
        "tagy": ["odpady", "evidence odpadů", "průběžná evidence", "541/2020", "273/2021", "ISPOP", "katalogové číslo", "tiskopis", "formulář", "tisk", "šablona"]
      },
      {
        "soubor": "obsah/vlastni_tiskopis.html",
        "nazev": "🧩 Vlastní tiskopis",
        "popis": "Navrhni si vlastní formulář nebo tabulku k tisku",
        "stav": "vyvoj",
        "jen_cs": true,
        "tagy": ["vlastní tiskopis", "editor formulářů", "návrh formuláře", "tabulka k tisku", "prázdný formulář", "JSON", "tiskopis", "formulář", "tisk", "šablona"]
      },
      {
        "soubor": "obsah/sklad.html",
        "nazev": "📦 Skladová evidence",
        "popis": "Skladové karty, příjemky, výdejky a inventura s FIFO",
        "stav": "vyvoj",
        "tagy": ["sklad", "skladová evidence", "skladová karta", "příjemka", "výdejka", "převodka", "inventura", "FIFO", "vážený průměr", "ocenění zásob", "stav k datu", "minimální zásoba", "objednávka", "EAN", "čárový kód", "dílna", "firma", "tisk", "CSV"]
      },
      {
        "soubor": "obsah/reklamace.html",
        "nazev": "🧾 Reklamační protokol",
        "popis": "Protokol o přijetí a vyřízení reklamace s hlídáním lhůt",
        "stav": "vyvoj",
        "jen_cs": true,
        "tagy": ["reklamace", "reklamační protokol", "potvrzení o přijetí reklamace", "vyřízení reklamace", "30 dní", "24 měsíců", "záruka", "vady zboží", "spotřebitel", "odstoupení od smlouvy", "§ 2165", "evidence reklamací", "tisk", "formulář"]
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
        "popis": "Čtení Bible, plán čtení, verše k zapamatování a deník",
        "stav": "beta",
        "tagy": ["bible", "plán čtení", "verše", "zapamatování", "studijní deník", "víra"]
      },
      {
        "soubor": "obsah/tarot_reading.html",
        "nazev": "🔮 Výklad karet",
        "popis": "Vylosuj tarotové karty, zjisti jejich význam a veď deník",
        "stav": "beta",
        "tagy": ["tarot", "karty", "výklad", "arkána", "věštění", "deník výkladů"]
      },
      {
        "soubor": "obsah/pagan_rituals.html",
        "nazev": "🌿 Pohanské svátky a rituály",
        "popis": "Kalendáře pohanských svátků světa s významy a zvyky",
        "stav": "beta",
        "tagy": ["keltové", "vikingové", "slované", "baltové", "řekové", "římané", "egypťané", "šintoismus", "jorubové", "aztékové", "kolo roku", "samhain", "yule", "blót", "svátky", "rituály"]
      }
    ]
  },
  {
    "nazev": "🏛️ Dějiny & genealogie",
    "skupina": "ostatni",
    "polozky": [
      {
        "soubor": "obsah/casova_osa.html",
        "nazev": "🏛️ Historická časová osa",
        "popis": "Porovnej civilizace a události vedle sebe v čase",
        "stav": "beta",
        "jen_cs": true,
        "tagy": ["historie", "dějepis", "chronologie", "timeline", "časová osa", "civilizace", "srovnání", "starověk", "středověk", "světové války", "kosmonautika", "juliánský kalendář", "panovníci", "osobnosti"]
      },
      {
        "soubor": "obsah/rodokmen.html",
        "nazev": "🌳 Stavitel rodokmenu",
        "popis": "Sestav rodokmen předků, ověř ho a spočítej příbuznost",
        "stav": "beta",
        "tagy": ["rodokmen", "genealogie", "předkové", "rodina", "strom", "gedcom", "vývod", "matrika",
                 "příbuznost", "ověření", "sosa", "ahnentafel", "profesionální"]
      },
      {
        "soubor": "obsah/Heritage.html",
        "nazev": "🌳 Heritage – genealogická aplikace",
        "popis": "Správa osob a rodinných vztahů s importem GEDCOM",
        "stav": "beta",
        "tagy": ["rodokmen", "genealogie", "předkové", "rodina", "strom", "gedcom", "příbuznost", "matrika", "bratranec", "rodinný strom", "export"]
      },
      {
        "soubor": "obsah/gene_map.html",
        "nazev": "🧬 Mapa dědičnosti",
        "popis": "Sleduj dědění znaků v rodině a spočítej příbuzenství",
        "stav": "beta",
        "tagy": ["dědičnost", "genetika", "geny", "rodokmen", "znaky"]
      },
      {
        "soubor": "obsah/hieroglyfy.html",
        "nazev": "🏺 Egyptský písař",
        "popis": "Přepíše jméno nebo text do hieroglyfů i s kartuší",
        "stav": "vyvoj",
        "tagy": ["hieroglyfy", "egypt", "egyptské písmo", "faraon", "kartuše", "přepis", "jméno hieroglyfy", "kleopatra", "gardiner", "jsesh", "mdc", "starověk", "písmo", "dějepis"]
      },
      {
        "soubor": "obsah/voynich.html",
        "nazev": "📜 Voynichův rukopis",
        "popis": "Snímky, přepisy EVA a statistiky nerozluštěného rukopisu",
        "stav": "beta",
        "tagy": ["voynich", "rukopis", "manuskript", "šifra", "nerozluštěné", "eva", "přepis", "transliterace", "středověk", "rudolf ii", "hořčický", "kryptologie", "lingvistika", "entropie", "zipf", "kwic", "yale", "beinecke"]
      },
      {
        "soubor": "obsah/leonardo.html",
        "nazev": "🪶 Leonardův zápisník",
        "popis": "Codex Atlanticus Leonarda da Vinciho s českým překladem",
        "stav": "vyvoj",
        "tagy": ["leonardo", "da vinci", "codex atlanticus", "atlantický kodex", "rukopis", "zápisník", "zrcadlové písmo", "renesance", "bajky", "proroctví", "překlad", "italština", "ambrosiana", "vynálezy", "stroje"]
      },
      {
        "soubor": "obsah/stare_mapy.html",
        "nazev": "🗺️ Staré mapy – jak to tu vypadalo",
        "popis": "Porovnej vojenská mapování a katastr s dnešní mapou",
        "stav": "vyvoj",
        "tagy": ["staré mapy", "historické mapy", "vojenské mapování", "Müllerova mapa", "stabilní katastr", "katastrální mapa", "ortofoto", "50. léta", "letecké snímky", "plány Prahy", "Vídeň", "Slovensko", "S-JTSK", "porovnání map", "opona", "georeference", "měření", "GeoJSON", "genealogie", "krajina"]
      },
      {
        "soubor": "obsah/kurent.html",
        "nazev": "✒️ Čtení kurentu (staré písmo)",
        "popis": "Přepis matrik psaných kurentem, převod dat a nácvik písma",
        "stav": "vyvoj",
        "tagy": ["kurent", "kurrent", "švabach", "staré písmo", "matrika", "genealogie", "paleografie", "čtení rukopisu", "přepis", "transkripce", "sken", "německé písmo", "latina", "slovníček", "zkratky", "jména", "nemoci", "povolání", "staré míry", "převod data", "svátky", "Velikonoce", "juliánský kalendář", "římské číslice", "chronogram", "šablony zápisů", "cvičení", "psaní stylusem", "převodník", "tisk"]
      }
    ]
  },
  {
    "nazev": "📚 Knihy",
    "skupina": "ostatni",
    "polozky": [
      {
        "soubor": "obsah/ctecka_knih.html",
        "nazev": "📖 Čtečka knih",
        "popis": "Čti vlastní EPUB, MOBI či Markdown se záložkami a hledáním",
        "stav": "vyvoj",
        "tagy": ["čtečka", "e-kniha", "ebook", "kniha", "knihovna", "čtení", "epub", "mobi", "kindle", "markdown", "md", "txt", "záložky", "poznámky", "zvýraznění", "předčítání", "offline", "reader"]
      },
      {
        "soubor": "obsah/kroniky.html",
        "nazev": "🐉 Kroniky vyhnanství",
        "popis": "Sága o sedmi knihách od středověku po budoucnost, ke čtení i poslechu",
        "stav": "beta",
        "jen_cs": true,
        "tagy": ["kniha", "román", "čtení", "čtečka", "e-kniha", "epub", "předčítání", "záložky", "poznámky", "sága", "fantasy", "Poslední drak", "Krev starších", "Paměť kamene", "První vyhnanci", "Strážci ticha", "Rozsudek", "Druhý soud", "Chebsko", "Jáchymov", "Yucatán", "středověk", "pravěk", "sci-fi", "drak"]
      },
      {
        "soubor": "obsah/kniha_povidky_kronik.html",
        "nazev": "📜 Povídky ze světa Kronik",
        "popis": "Samostatné povídky ze světa ságy Kroniky vyhnanství",
        "stav": "vyvoj",
        "jen_cs": true,
        "tagy": ["kniha", "povídky", "povídka", "čtení", "čtečka", "e-kniha", "epub", "předčítání", "Kroniky vyhnanství", "Von Wölfen geholt", "Odnesli je vlci", "Poslední zima obrů", "Vejce na útesu", "Kavyl", "Roh, který pije", "Obchůzka", "Sladká voda", "Pokojní a zdvořilí", "Pro pořádek", "Tři falešné", "vlkodlak", "obři", "harpyje", "kentauři", "jednorožec", "Atlantida", "mor", "elfové", "Krušnohoří", "třicetiletá válka", "pravěk", "mezolit", "fantasy"]
      },
      {
        "soubor": "obsah/kroniky_atlas.html",
        "nazev": "🗺️ Atlas a bestiář Kronik",
        "popis": "Populace, postavy, mapa a časová osa ságy bez spoilerů",
        "stav": "vyvoj",
        "jen_cs": true,
        "tagy": ["atlas", "bestiář", "Kroniky vyhnanství", "postavy", "mapa", "časová osa", "slovníček", "pojmy", "draci", "elfové", "upíři", "vlkodlaci", "trpaslíci", "jednorožci", "obři", "kentauři", "harpyje", "fantasy", "bez spoilerů", "encyklopedie"]
      },
      {
        "soubor": "obsah/vypisky.html",
        "nazev": "📌 Výpisky a citáty",
        "popis": "Zvýraznění, poznámky a citáty z knih na jednom místě",
        "stav": "vyvoj",
        "tagy": ["výpisky", "citáty", "citát dne", "zvýraznění", "poznámky", "záložky", "čtečka knih", "kroniky", "štítky", "kartičky", "tisk citátů", "export markdown", "csv", "knihy"]
      },
      {
        "soubor": "obsah/brozura.html",
        "nazev": "🖨️ Tisk knížky doma",
        "popis": "Seřadí strany PDF do archů pro sešitek nebo knihu",
        "stav": "vyvoj",
        "tagy": ["vyřazení", "brožura", "sešitek", "knižní vazba", "složky", "signatury", "lepená vazba", "sedlová vazba", "tisk knihy", "archy", "creep", "ořezové značky", "oboustranný tisk", "PDF", "A5 na A4", "knihařství"]
      },
      {
        "soubor": "obsah/obalka_knihy.html",
        "nazev": "📕 Obálka knihy k tisku",
        "popis": "Navrhni obálku se hřbetem, spadávkou a čárovým kódem ISBN",
        "stav": "vyvoj",
        "tagy": ["obálka", "obalka", "kniha", "hřbet", "šířka hřbetu", "spadávka", "ISBN", "EAN-13", "EAN-5", "čárový kód", "KDP", "Amazon", "brožura", "pevná vazba", "tisk", "PDF", "self-publishing", "anotace", "nakladatel"]
      },
      {
        "soubor": "obsah/zalozky_exlibris.html",
        "nazev": "🔖 Záložky do knih a ex libris",
        "popis": "Navrhni záložky a ex libris s citáty a ornamenty k tisku",
        "stav": "vyvoj",
        "tagy": ["záložka", "záložky do knih", "ex libris", "exlibris", "knižní štítek", "citát", "monogram", "iniciály", "střapec", "tisk", "arch A4", "ořezové značky", "spadávka", "PDF", "SVG", "art deco", "keltský vzor", "razítko", "kniha", "knihovna"]
      },
      {
        "soubor": "obsah/ctenarsky_denik.html",
        "nazev": "📚 Čtenářský deník",
        "popis": "Domácí knihovna se skenem ISBN, průběhem čtení a statistikami",
        "stav": "vyvoj",
        "tagy": ["čtenářský deník", "knihy", "knihovna", "ISBN", "čárový kód", "sken", "Open Library", "Goodreads", "police", "přečteno", "chci číst", "průběh čtení", "hodnocení", "citáty", "poznámky", "série", "půjčeno", "čtenářská výzva", "statistiky", "škola", "zápis do deníku", "povinná četba", "tisk", "PDF", "CSV", "export", "import"]
      }
    ]
  },
  {
    "nazev": "🎤 Přednášky a bezpečnost",
    "skupina": "ostatni",
    "polozky": [
      {
        "soubor": "obsah/prednasky.html",
        "nazev": "🧭 Přednášky – rozcestník a program",
        "popis": "Přehled přednášek o AI a bezpečnosti s délkou a tiskem",
        "stav": "vyvoj",
        "jen_cs": true,
        "tagy": ["přednášky", "rozcestník", "přehled", "program", "harmonogram", "prezentace", "délka", "počet snímků", "AI", "bezpečnost", "podvody", "senioři", "lektor"]
      },
      {
        "soubor": "obsah/AI_prednaska.html",
        "nazev": "🤖 Přednáška: Úvod do AI",
        "popis": "Slidy pro laiky: co je umělá inteligence a jak ji používat",
        "stav": "beta",
        "tagy": ["AI", "umělá inteligence", "přednáška", "prezentace", "slidy", "ChatGPT", "prompt", "LLM", "pro laiky"]
      },
      {
        "soubor": "obsah/AI_prednaska2.html",
        "nazev": "🚀 Přednáška: AI o půl roku dál",
        "popis": "Slidy o novinkách v AI: agenti, deepfaky a AI Act",
        "stav": "vyvoj",
        "tagy": ["AI", "umělá inteligence", "přednáška", "pokračování", "novinky", "agenti", "deepfake", "AI Act", "Claude", "Gemini", "GPT", "pro laiky"]
      },
      {
        "soubor": "obsah/podvody.html",
        "nazev": "🛡️ Běžné podvody a jak se bránit",
        "popis": "Jak poznat podvod po telefonu, SMS či e-mailu a co dělat",
        "stav": "vyvoj",
        "jen_cs": true,
        "tagy": ["bezpečnost", "podvod", "podvodníci", "phishing", "spam", "telefon", "SMS", "klonovaný hlas", "deepfake", "bezpečný účet", "peníze omylem", "bazar", "senioři", "kyberbezpečnost"]
      },
      {
        "soubor": "obsah/podvody_prednaska.html",
        "nazev": "🎤 Přednáška: Nenechte se napálit",
        "popis": "Slidy o běžných podvodech a obraně proti nim",
        "stav": "vyvoj",
        "jen_cs": true,
        "tagy": ["přednáška", "prezentace", "slidy", "bezpečnost", "podvod", "phishing", "telefon", "klonovaný hlas", "deepfake", "bezpečný účet", "peníze omylem", "senioři", "pro laiky"]
      },
      {
        "soubor": "obsah/AI_prednaska3.html",
        "nazev": "🧪 Přednáška: AI v praxi – workshop",
        "popis": "Workshop se šablonami promptů pro domácnost a úřady",
        "stav": "vyvoj",
        "tagy": ["AI", "umělá inteligence", "přednáška", "workshop", "prompt", "šablona promptu", "halucinace", "pro laiky", "senioři"]
      },
      {
        "soubor": "obsah/bezpecny_telefon_prednaska.html",
        "nazev": "🔐 Přednáška: Bezpečný telefon a účty",
        "popis": "Slidy o heslech, dvoufázovém ověření a zálohách",
        "stav": "vyvoj",
        "jen_cs": true,
        "tagy": ["přednáška", "bezpečnost", "hesla", "správce hesel", "2FA", "dvoufázové ověření", "passkey", "aktualizace", "záloha", "telefon", "senioři"]
      },
      {
        "soubor": "obsah/fake_news_prednaska.html",
        "nazev": "🔎 Přednáška: Fake news a deepfake",
        "popis": "Slidy o ověřování zpráv, hoaxů a falešných videí",
        "stav": "vyvoj",
        "jen_cs": true,
        "tagy": ["přednáška", "fake news", "hoax", "dezinformace", "deepfake", "ověřování", "fact-checking", "zpětné hledání obrázku", "boti", "mediální gramotnost"]
      },
      {
        "soubor": "obsah/deti_internet_prednaska.html",
        "nazev": "👨‍👩‍👧 Přednáška: Děti a internet",
        "popis": "Slidy pro rodiče o sítích, kyberšikaně a vydírání",
        "stav": "vyvoj",
        "jen_cs": true,
        "tagy": ["přednáška", "děti", "rodiče", "sociální sítě", "kyberšikana", "kybergrooming", "sextortion", "rodičovská kontrola", "čas u obrazovky", "hry"]
      },
      {
        "soubor": "obsah/digitalni_pozustalost_prednaska.html",
        "nazev": "🕯️ Přednáška: Digitální pozůstalost",
        "popis": "Slidy o tom, jak předat účty, hesla a fotky blízkým",
        "stav": "vyvoj",
        "jen_cs": true,
        "tagy": ["přednáška", "digitální pozůstalost", "dědictví", "hesla", "účty", "správce neaktivního účtu", "digitální dědic", "fotky", "úmrtí", "závěť"]
      },
      {
        "soubor": "obsah/bezpecne_placeni_prednaska.html",
        "nazev": "💳 Přednáška: Bezpečné placení",
        "popis": "Slidy o bezpečném placení kartou, mobilem a QR kódem",
        "stav": "vyvoj",
        "jen_cs": true,
        "tagy": ["přednáška", "placení", "platební karta", "Apple Pay", "Google Pay", "QR platba", "limity", "chargeback", "bankomat", "nákupy online"]
      },
      {
        "soubor": "obsah/slovnicek_ai.html",
        "nazev": "📖 Slovníček: AI a bezpečnost",
        "popis": "Srozumitelná vysvětlení pojmů z AI a kyberbezpečnosti",
        "stav": "vyvoj",
        "jen_cs": true,
        "tagy": ["slovníček", "pojmy", "AI", "umělá inteligence", "bezpečnost", "kyberbezpečnost", "phishing", "deepfake", "hesla", "2FA", "AI Act", "podvod", "pro laiky", "senioři"]
      },
      {
        "soubor": "obsah/trenink_podvodu.html",
        "nazev": "📞 Trénink: podvodný hovor a SMS",
        "popis": "Vyzkoušej si podvodný hovor či SMS a nauč se bránit",
        "stav": "vyvoj",
        "jen_cs": true,
        "tagy": ["bezpečnost", "podvod", "trénink", "nácvik", "scénáře", "telefon", "SMS", "bezpečný účet", "klonovaný hlas", "rodinné heslo", "peníze omylem", "bazar", "technická podpora", "nahrávání hovoru", "senioři"]
      },
      {
        "soubor": "obsah/kontrola_odkazu.html",
        "nazev": "🔗 Kontrola odkazu",
        "popis": "Rozebere podezřelý odkaz z SMS či e-mailu bez otevření",
        "stav": "vyvoj",
        "tagy": ["bezpečnost", "podvod", "phishing", "odkaz", "URL", "SMS", "e-mail", "doména", "punycode", "homoglyfy", "zkracovač", "falešná pošta", "banka", "senioři", "kyberbezpečnost", "offline"]
      },
      {
        "soubor": "obsah/bezpecnostni_karticka.html",
        "nazev": "🪪 Rodinná bezpečnostní kartička",
        "popis": "Kartička k tisku s čísly a zásadami proti podvodníkům",
        "stav": "vyvoj",
        "jen_cs": true,
        "tagy": ["senioři", "podvody", "bezpečnost", "tisk", "kartička", "telefon", "banka", "rodinné heslo", "lednice"]
      },
      {
        "soubor": "obsah/zabezpec_telefon.html",
        "nazev": "✅ Zabezpeč si telefon – kontrolní seznam",
        "popis": "Postupy krok za krokem pro zabezpečení Androidu a iPhonu",
        "stav": "vyvoj",
        "jen_cs": true,
        "tagy": ["bezpečnost", "mobil", "Android", "iPhone", "kontrolní seznam", "dvoufázové ověření", "hesla", "záloha", "podvody", "nastavení"]
      },
      {
        "soubor": "obsah/spravce_hesel_prednaska.html",
        "nazev": "🔑 Přednáška: Správce hesel v praxi",
        "popis": "Slidy, jak zapnout a používat správce hesel v mobilu",
        "stav": "vyvoj",
        "jen_cs": true,
        "tagy": ["přednáška", "správce hesel", "hesla", "Android", "iPhone", "Správce hesel Google", "Hesla Apple", "Klíčenka", "Bitwarden", "passkey", "přístupový klíč", "kontrola hesel", "sdílení hesel", "senioři"]
      },
      {
        "soubor": "obsah/prednaska_sit.html",
        "nazev": "🛜 Bezpečná domácí síť a router",
        "popis": "Slidy o nastavení routeru, Wi-Fi a sítě pro hosty",
        "stav": "vyvoj",
        "jen_cs": true,
        "tagy": ["přednáška", "router", "wi-fi", "wpa3", "wps", "síť pro hosty", "chytrá domácnost", "kamery", "dns", "rodičovská kontrola", "vpn", "veřejná wi-fi", "bezpečnost", "senioři", "kontrolní seznam"]
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
        "popis": "Mapy fronty, ztráty a uprchlíci z ověřených otevřených dat",
        "stav": "beta",
        "tagy": ["ukrajina", "válka", "rusko", "isw", "fronta", "mapa fronty", "okupace", "deepstate", "oryx", "ztráty", "osn", "uprchlíci", "zprávy"]
      },
      {
        "soubor": "obsah/zpravy.html",
        "nazev": "📰 Mozaika zpráv",
        "popis": "Titulky z desítek českých i zahraničních zpravodajských webů",
        "stav": "beta",
        "jen_cs": true,
        "tagy": ["zprávy", "novinky", "zpravodajství", "rss", "agregátor", "titulky", "čtečka zpráv", "idnes", "novinky.cz", "seznam zprávy", "čt24", "irozhlas", "aktuálně", "sport", "technika", "věda", "ekonomika", "témata"]
      },
      {
        "soubor": "obsah/about.html",
        "nazev": "ℹ️ O projektu",
        "popis": "Co je tento rozcestník, změny, statistiky a zdroje",
        "stav": "beta",
        "tagy": [
          "changelog",
          "statistiky",
          "github"
        ]
      },
      {
        "soubor": "obsah/contact_page.html",
        "nazev": "✉️ Kontakt",
        "popis": "Nahlas chybu nebo pošli nápad na novou aplikaci",
        "stav": "beta",
        "tagy": ["kontakt", "e-mail", "napište nám", "autor"]
      }
    ]
  }
];


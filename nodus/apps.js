// Poznámka: obsah/vyslovnost.html je dočasně mimo katalog – stránka stojí na
// poslechu a web zatím nemá kvalitní hlas. Až bude, stačí položku vrátit sem.
// Katalog výukových aplikací Nodus – jediný zdroj pravdy pro menu, hledání,
// úvodní přehled i stránku Osnova.
//
// Položka: { soubor, nazev, tagy, predmet, rocniky, stav }
//   predmet – id z KATALOG_PREDMETY (nástroje bez vazby na předmět ho nemají)
//   rocniky – ročníky ZŠ, kterých se téma týká (filtr v menu)
//   stav    – 'plan' u připravovaných stránek; hotové aplikace pole nemají
//
// Kostra témat vychází z RVP ZV; rozdělení do ročníků odpovídá obvyklé praxi
// českých ŠVP (RVP samo stanovuje výstupy po obdobích, ne po ročnících).

const KATALOG_PREDMETY = [
  { id: 'cj',  label: 'Český jazyk',            emoji: '📖', rocniky: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
  { id: 'm',   label: 'Matematika',             emoji: '🔢', rocniky: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
  { id: 'aj',  label: 'Anglický jazyk',         emoji: '🇬🇧', rocniky: [3, 4, 5, 6, 7, 8, 9] },
  { id: 'dcj', label: 'Další cizí jazyk',       emoji: '🗣️', rocniky: [7, 8, 9] },
  { id: 'prv', label: 'Prvouka a vlastivěda',   emoji: '🏡', rocniky: [1, 2, 3, 4, 5] },
  { id: 'inf', label: 'Informatika',            emoji: '💻', rocniky: [4, 5, 6, 7, 8, 9] },
  { id: 'f',   label: 'Fyzika',                 emoji: '⚛️', rocniky: [6, 7, 8, 9] },
  { id: 'ch',  label: 'Chemie',                 emoji: '⚗️', rocniky: [8, 9] },
  { id: 'pr',  label: 'Přírodopis',             emoji: '🧬', rocniky: [6, 7, 8, 9] },
  { id: 'z',   label: 'Zeměpis',                emoji: '🌍', rocniky: [6, 7, 8, 9] },
  { id: 'd',   label: 'Dějepis',                emoji: '📜', rocniky: [6, 7, 8, 9] },
];

const KATALOG_SKUPINY = [
  { id: 'cestina',     label: '📖 Čeština' },
  { id: 'matematika',  label: '🔢 Matematika' },
  { id: 'jazyky',      label: '🗣️ Cizí jazyky' },
  { id: 'prvouka',     label: '🏡 Prvouka & vlastivěda' },
  { id: 'priroda',     label: '🔬 Přírodní vědy' },
  { id: 'spolecnost',  label: '🌍 Zeměpis & dějepis' },
  { id: 'informatika', label: '💻 Informatika' },
  { id: 'dalsi',       label: '🎓 Další výuka' },
];

const KATALOG_SEKCE = [
  {
    "nazev": "✍️ Pravopis",
    "skupina": "cestina",
    "polozky": [
      {
        "soubor": "obsah/cj1_pismena.html",
        "nazev": "🔤 Písmena a hlásky",
        "tagy": [
          "1. ročník",
          "čtení",
          "hláska",
          "písmeno",
          "sluchová analýza"
        ],
        "predmet": "cj",
        "rocniky": [
          1
        ]
      },
      {
        "soubor": "obsah/cj2_tvrde_mekke.html",
        "nazev": "✍️ Tvrdé a měkké souhlásky",
        "tagy": [
          "2. ročník",
          "i/y",
          "tvrdé souhlásky",
          "měkké souhlásky",
          "pravopis"
        ],
        "predmet": "cj",
        "rocniky": [
          2
        ]
      },
      {
        "soubor": "obsah/cj2_abeceda.html",
        "nazev": "🔤 Abeceda a řazení slov",
        "tagy": [
          "2. ročník",
          "abeceda",
          "řazení",
          "slovník"
        ],
        "predmet": "cj",
        "rocniky": [
          2,
          3
        ]
      },
      {
        "soubor": "obsah/doplnovacky.html",
        "nazev": "✍️ Doplňovačky i/y",
        "tagy": [
          "1. stupeň",
          "3. ročník",
          "4. ročník",
          "5. ročník",
          "pravopis",
          "diktát",
          "vyjmenovaná slova",
          "obojetné souhlásky",
          "příbuzná slova"
        ],
        "predmet": "cj",
        "rocniky": [
          3,
          4,
          5
        ]
      },
      {
        "soubor": "obsah/diktat_gen.html",
        "nazev": "✍️ Generátor diktátů",
        "tagy": [
          "diktát",
          "pravopis",
          "poslech",
          "vyjmenovaná slova",
          "velká písmena",
          "doplňování písmen",
          "přepis věty"
        ],
        "predmet": "cj",
        "rocniky": [
          3,
          4,
          5,
          6,
          7,
          8,
          9
        ]
      },
      {
        "soubor": "obsah/cj3_parove.html",
        "nazev": "✍️ Párové souhlásky",
        "tagy": [
          "3. ročník",
          "spodoba",
          "párové souhlásky",
          "pravopis",
          "b/p",
          "d/t",
          "z/s",
          "spodoba znělosti"
        ],
        "predmet": "cj",
        "rocniky": [
          3
        ]
      },
      {
        "soubor": "obsah/vyjmenovana_slova.html",
        "nazev": "✍️ Vyjmenovaná slova",
        "tagy": [
          "1. stupeň",
          "3. ročník",
          "pravopis",
          "i/y",
          "řady vyjmenovaných slov",
          "přehled"
        ],
        "predmet": "cj",
        "rocniky": [
          3,
          4,
          5
        ]
      },
      {
        "soubor": "obsah/shoda_podmetu.html",
        "nazev": "✏️ Shoda podmětu s přísudkem",
        "tagy": [
          "2. stupeň",
          "6. ročník",
          "7. ročník",
          "pravopis",
          "koncovky",
          "příčestí",
          "podmět",
          "rod podmětu",
          "-li -ly -la"
        ],
        "predmet": "cj",
        "rocniky": [
          6,
          7
        ]
      },
      {
        "soubor": "obsah/cj8_prejata.html",
        "nazev": "🌍 Přejatá slova",
        "tagy": [
          "8. ročník",
          "přejatá slova",
          "pravopis",
          "skloňování cizích slov",
          "s/z"
        ],
        "predmet": "cj",
        "rocniky": [
          8
        ]
      },
      {
        "soubor": "obsah/cj9_prijimacky.html",
        "nazev": "🎯 Příprava na přijímací zkoušky – ČJ",
        "tagy": [
          "9. ročník",
          "přijímací zkoušky",
          "cermat",
          "test",
          "opakování"
        ],
        "predmet": "cj",
        "rocniky": [
          9
        ]
      }
    ]
  },
  {
    "nazev": "🧩 Tvarosloví & skladba",
    "skupina": "cestina",
    "polozky": [
      {
        "soubor": "obsah/cj2_druhy_vet.html",
        "nazev": "❓ Druhy vět",
        "tagy": [
          "2. ročník",
          "věta oznamovací",
          "tázací",
          "rozkazovací",
          "přací",
          "interpunkce"
        ],
        "predmet": "cj",
        "rocniky": [
          2,
          3
        ]
      },
      {
        "soubor": "obsah/slovni_druhy.html",
        "nazev": "✏️ Slovní druhy",
        "tagy": [
          "1. stupeň",
          "2. stupeň",
          "mluvnice",
          "ohebné",
          "neohebné",
          "slovní druhy"
        ],
        "predmet": "cj",
        "rocniky": [
          3,
          4,
          5,
          6
        ]
      },
      {
        "soubor": "obsah/cj3_slovesa.html",
        "nazev": "🏃 Slovesa – osoba, číslo, čas",
        "tagy": [
          "3. ročník",
          "slovesa",
          "osoba",
          "číslo",
          "čas",
          "časování"
        ],
        "predmet": "cj",
        "rocniky": [
          3,
          4
        ]
      },
      {
        "soubor": "obsah/cj3_podstatna.html",
        "nazev": "📗 Podstatná jména – rod a číslo",
        "tagy": [
          "3. ročník",
          "podstatná jména",
          "rod",
          "číslo",
          "mluvnické kategorie"
        ],
        "predmet": "cj",
        "rocniky": [
          3,
          4
        ]
      },
      {
        "soubor": "obsah/cj4_pady.html",
        "nazev": "📗 Pády a vzory podstatných jmen",
        "tagy": [
          "4. ročník",
          "5. ročník",
          "pády",
          "vzory",
          "skloňování",
          "pravopis koncovek"
        ],
        "predmet": "cj",
        "rocniky": [
          4,
          5
        ]
      },
      {
        "soubor": "obsah/synonyma_antonyma.html",
        "nazev": "🔁 Synonyma a antonyma",
        "tagy": [
          "slovní zásoba",
          "synonyma",
          "antonyma",
          "opozita"
        ],
        "predmet": "cj",
        "rocniky": [
          4,
          5,
          6,
          7
        ]
      },
      {
        "soubor": "obsah/cj4_stavba_slova.html",
        "nazev": "🧩 Stavba slova",
        "tagy": [
          "4. ročník",
          "kořen",
          "předpona",
          "přípona",
          "slova příbuzná"
        ],
        "predmet": "cj",
        "rocniky": [
          4,
          5
        ]
      },
      {
        "soubor": "obsah/cj5_pridavna.html",
        "nazev": "🎨 Přídavná jména",
        "tagy": [
          "5. ročník",
          "přídavná jména",
          "tvrdá",
          "měkká",
          "přivlastňovací",
          "vzory"
        ],
        "predmet": "cj",
        "rocniky": [
          5,
          6
        ]
      },
      {
        "soubor": "obsah/cj5_skladebni_dvojice.html",
        "nazev": "🔗 Základní skladební dvojice",
        "tagy": [
          "5. ročník",
          "podmět",
          "přísudek",
          "skladební dvojice",
          "věta"
        ],
        "predmet": "cj",
        "rocniky": [
          5,
          6
        ]
      },
      {
        "soubor": "obsah/cj5_zajmena_cislovky.html",
        "nazev": "🔢 Zájmena a číslovky",
        "tagy": [
          "5. ročník",
          "zájmena",
          "číslovky",
          "druhy",
          "skloňování"
        ],
        "predmet": "cj",
        "rocniky": [
          5,
          6
        ]
      },
      {
        "soubor": "obsah/vetny_rozbor.html",
        "nazev": "✏️ Rozbor věty – větné členy",
        "tagy": [
          "mluvnice",
          "podmět",
          "přísudek",
          "předmět",
          "přívlastek",
          "2. stupeň",
          "rozbor věty",
          "větné členy"
        ],
        "predmet": "cj",
        "rocniky": [
          6,
          7,
          8
        ]
      },
      {
        "soubor": "obsah/cj6_slovni_zasoba.html",
        "nazev": "📚 Slovní zásoba a význam slov",
        "tagy": [
          "6. ročník",
          "slovní zásoba",
          "význam slov",
          "homonyma",
          "mnohoznačnost"
        ],
        "predmet": "cj",
        "rocniky": [
          6,
          7
        ]
      },
      {
        "soubor": "obsah/cj7_rozvijejici.html",
        "nazev": "🔗 Rozvíjející větné členy",
        "tagy": [
          "7. ročník",
          "předmět",
          "přívlastek",
          "příslovečné určení",
          "větné členy"
        ],
        "predmet": "cj",
        "rocniky": [
          7,
          8
        ]
      },
      {
        "soubor": "obsah/cj7_neohebne.html",
        "nazev": "🔤 Neohebné slovní druhy",
        "tagy": [
          "7. ročník",
          "příslovce",
          "předložky",
          "spojky",
          "částice",
          "citoslovce"
        ],
        "predmet": "cj",
        "rocniky": [
          7
        ]
      },
      {
        "soubor": "obsah/cj7_slovotvorba.html",
        "nazev": "🧩 Slovotvorba",
        "tagy": [
          "7. ročník",
          "odvozování",
          "skládání",
          "zkracování",
          "slovotvorný základ"
        ],
        "predmet": "cj",
        "rocniky": [
          7
        ]
      },
      {
        "soubor": "obsah/cj8_souveti.html",
        "nazev": "🔗 Souvětí souřadné a podřadné",
        "tagy": [
          "8. ročník",
          "souvětí",
          "věta hlavní",
          "věta vedlejší",
          "poměry",
          "čárka"
        ],
        "predmet": "cj",
        "rocniky": [
          8,
          9
        ]
      },
      {
        "soubor": "obsah/cj9_vyvoj_jazyka.html",
        "nazev": "🗿 Útvary a vývoj českého jazyka",
        "tagy": [
          "9. ročník",
          "spisovný jazyk",
          "nářečí",
          "obecná čeština",
          "slang",
          "vývoj jazyka"
        ],
        "predmet": "cj",
        "rocniky": [
          9
        ]
      }
    ]
  },
  {
    "nazev": "📚 Čtení & literatura",
    "skupina": "cestina",
    "polozky": [
      {
        "soubor": "obsah/slabiky.html",
        "nazev": "📖 Slabiky a první čtení",
        "tagy": [
          "1. stupeň",
          "1. ročník",
          "2. ročník",
          "čtení",
          "slabikování"
        ],
        "predmet": "cj",
        "rocniky": [
          1,
          2
        ]
      },
      {
        "soubor": "obsah/cteni_s_porozumenim.html",
        "nazev": "📖 Čtení s porozuměním",
        "tagy": [
          "čtení",
          "porozumění",
          "text",
          "otázky",
          "1. stupeň",
          "2. stupeň",
          "sš"
        ],
        "predmet": "cj",
        "rocniky": [
          2,
          3,
          4,
          5,
          6,
          7,
          8,
          9
        ]
      },
      {
        "soubor": "obsah/reading_log.html",
        "nazev": "📚 Čtenářský deník",
        "tagy": [
          "knihy",
          "četba",
          "hodnocení",
          "literatura"
        ],
        "predmet": "cj",
        "rocniky": [
          4,
          5,
          6,
          7,
          8,
          9
        ]
      },
      {
        "soubor": "obsah/cj6_baje.html",
        "nazev": "🐉 Mýty, báje a pohádky",
        "tagy": [
          "6. ročník",
          "literatura",
          "mýtus",
          "báje",
          "pohádka",
          "literární druhy"
        ],
        "predmet": "cj",
        "rocniky": [
          6
        ]
      },
      {
        "soubor": "obsah/cj9_literatura_20.html",
        "nazev": "📘 Literatura 20. století",
        "tagy": [
          "9. ročník",
          "literatura",
          "20. století",
          "směry",
          "autoři"
        ],
        "predmet": "cj",
        "rocniky": [
          9
        ]
      },
      {
        "soubor": "obsah/literarni_smery.html",
        "nazev": "📚 Literární směry a autoři",
        "tagy": [
          "střední škola",
          "sš",
          "maturita",
          "literatura",
          "sloh"
        ],
        "predmet": "cj",
        "rocniky": [
          9
        ]
      }
    ]
  },
  {
    "nazev": "✒️ Sloh a komunikace",
    "skupina": "cestina",
    "polozky": [
      {
        "soubor": "obsah/cj4_prima_rec.html",
        "nazev": "💬 Přímá řeč",
        "tagy": [
          "4. ročník",
          "přímá řeč",
          "uvozovky",
          "interpunkce",
          "uvozovací věta"
        ],
        "predmet": "cj",
        "rocniky": [
          4,
          5
        ]
      },
      {
        "soubor": "obsah/cj8_sloh.html",
        "nazev": "✒️ Slohové útvary – výklad a úvaha",
        "tagy": [
          "8. ročník",
          "sloh",
          "výklad",
          "úvaha",
          "osnova",
          "kompozice"
        ],
        "predmet": "cj",
        "rocniky": [
          8,
          9
        ]
      }
    ]
  },
  {
    "nazev": "🔢 Čísla & početní operace",
    "skupina": "matematika",
    "polozky": [
      {
        "soubor": "obsah/m1_porovnavani.html",
        "nazev": "⚖️ Porovnávání a řady čísel",
        "tagy": [
          "1. ročník",
          "porovnávání",
          "číselná osa",
          "více",
          "méně"
        ],
        "predmet": "m",
        "rocniky": [
          1,
          2
        ]
      },
      {
        "soubor": "obsah/pocitani.html",
        "nazev": "🔢 Počítání do 20 a 100",
        "tagy": [
          "1. stupeň",
          "1. ročník",
          "2. ročník",
          "3. ročník",
          "sčítání",
          "odčítání"
        ],
        "predmet": "m",
        "rocniky": [
          1,
          2,
          3
        ]
      },
      {
        "soubor": "obsah/multiplication.html",
        "nazev": "✖️ Procvičování násobilky",
        "tagy": [
          "1. stupeň",
          "3. ročník",
          "násobení"
        ],
        "predmet": "m",
        "rocniky": [
          2,
          3,
          4
        ]
      },
      {
        "soubor": "obsah/m3_deleni_zbytkem.html",
        "nazev": "➗ Dělení se zbytkem",
        "tagy": [
          "3. ročník",
          "dělení",
          "zbytek",
          "násobilka"
        ],
        "predmet": "m",
        "rocniky": [
          3,
          4
        ]
      },
      {
        "soubor": "obsah/m4_pisemne_operace.html",
        "nazev": "✏️ Písemné sčítání, odčítání a násobení",
        "tagy": [
          "4. ročník",
          "písemné algoritmy",
          "sčítání",
          "odčítání",
          "násobení pod sebou"
        ],
        "predmet": "m",
        "rocniky": [
          4
        ]
      },
      {
        "soubor": "obsah/m4_pisemne_deleni.html",
        "nazev": "➗ Písemné dělení",
        "tagy": [
          "4. ročník",
          "5. ročník",
          "písemné dělení",
          "dělitel",
          "zbytek"
        ],
        "predmet": "m",
        "rocniky": [
          4,
          5
        ]
      },
      {
        "soubor": "obsah/m4_zlomky_uvod.html",
        "nazev": "🍕 Zlomky – části celku",
        "tagy": [
          "4. ročník",
          "zlomky",
          "část celku",
          "polovina",
          "čtvrtina",
          "názorně"
        ],
        "predmet": "m",
        "rocniky": [
          4,
          5
        ]
      },
      {
        "soubor": "obsah/roman_numerals.html",
        "nazev": "🏛️ Římské číslice",
        "tagy": [
          "číslice",
          "převod"
        ],
        "predmet": "m",
        "rocniky": [
          4,
          5,
          6
        ]
      },
      {
        "soubor": "obsah/mental_math.html",
        "nazev": "🧠 Mentální matematika",
        "tagy": [
          "počítání zpaměti",
          "trénink"
        ],
        "predmet": "m",
        "rocniky": [
          4,
          5,
          6,
          7,
          8,
          9
        ]
      },
      {
        "soubor": "obsah/desetinna_cisla.html",
        "nazev": "🔢 Desetinná čísla",
        "tagy": [
          "desetinná čísla",
          "sčítání",
          "porovnávání",
          "zaokrouhlování",
          "2. stupeň"
        ],
        "predmet": "m",
        "rocniky": [
          5,
          6
        ]
      },
      {
        "soubor": "obsah/m5_slovni_ulohy.html",
        "nazev": "🧠 Slovní úlohy a úsudek",
        "tagy": [
          "5. ročník",
          "slovní úlohy",
          "úsudek",
          "strategie řešení"
        ],
        "predmet": "m",
        "rocniky": [
          5,
          6
        ]
      },
      {
        "soubor": "obsah/fraction_calc.html",
        "nazev": "➗ Kalkulačka zlomků",
        "tagy": [
          "2. stupeň",
          "zlomky"
        ],
        "predmet": "m",
        "rocniky": [
          6,
          7
        ]
      },
      {
        "soubor": "obsah/m6_delitelnost.html",
        "nazev": "🔍 Dělitelnost, prvočísla, NSD a NSN",
        "tagy": [
          "6. ročník",
          "dělitelnost",
          "prvočísla",
          "nsd",
          "nsn",
          "rozklad"
        ],
        "predmet": "m",
        "rocniky": [
          6
        ]
      },
      {
        "soubor": "obsah/m7_pomer.html",
        "nazev": "⚖️ Poměr a měřítko",
        "tagy": [
          "7. ročník",
          "poměr",
          "měřítko mapy",
          "dělení v poměru",
          "postupný poměr"
        ],
        "predmet": "m",
        "rocniky": [
          7
        ]
      },
      {
        "soubor": "obsah/m7_cela_cisla.html",
        "nazev": "➖ Celá čísla",
        "tagy": [
          "7. ročník",
          "celá čísla",
          "záporná čísla",
          "absolutní hodnota",
          "číselná osa"
        ],
        "predmet": "m",
        "rocniky": [
          7
        ]
      },
      {
        "soubor": "obsah/m7_zlomky_operace.html",
        "nazev": "🍕 Počítání se zlomky",
        "tagy": [
          "7. ročník",
          "zlomky",
          "krácení",
          "společný jmenovatel",
          "sčítání zlomků"
        ],
        "predmet": "m",
        "rocniky": [
          7
        ]
      },
      {
        "soubor": "obsah/procenta.html",
        "nazev": "💯 Procenta a trojčlenka",
        "tagy": [
          "2. stupeň",
          "7. ročník",
          "8. ročník",
          "9. ročník",
          "úměra"
        ],
        "predmet": "m",
        "rocniky": [
          7,
          8,
          9
        ]
      },
      {
        "soubor": "obsah/mocniny_odmocniny.html",
        "nazev": "√ Mocniny a odmocniny",
        "tagy": [
          "mocniny",
          "odmocniny",
          "2. stupeň"
        ],
        "predmet": "m",
        "rocniky": [
          8,
          9
        ]
      },
      {
        "soubor": "obsah/m9_prijimacky.html",
        "nazev": "🎯 Příprava na přijímací zkoušky – M",
        "tagy": [
          "9. ročník",
          "přijímací zkoušky",
          "cermat",
          "test",
          "opakování"
        ],
        "predmet": "m",
        "rocniky": [
          9
        ]
      }
    ]
  },
  {
    "nazev": "📏 Měření & jednotky",
    "skupina": "matematika",
    "polozky": [
      {
        "soubor": "obsah/clock_learning.html",
        "nazev": "🕐 Učení hodin",
        "tagy": [
          "1. stupeň",
          "2. ročník",
          "čas",
          "hodiny"
        ],
        "predmet": "m",
        "rocniky": [
          1,
          2,
          3
        ]
      },
      {
        "soubor": "obsah/prevody_jednotek.html",
        "nazev": "📏 Převody jednotek",
        "tagy": [
          "1. stupeň",
          "2. stupeň",
          "délka",
          "hmotnost",
          "objem",
          "čas",
          "jednotky",
          "USA",
          "palce",
          "galony"
        ],
        "predmet": "m",
        "rocniky": [
          4,
          5,
          6,
          7
        ]
      }
    ]
  },
  {
    "nazev": "📐 Geometrie",
    "skupina": "matematika",
    "polozky": [
      {
        "soubor": "obsah/geo_tvary.html",
        "nazev": "🔺 Geometrické tvary a tělesa",
        "tagy": [
          "1. stupeň",
          "2. stupeň",
          "geometrie",
          "útvary"
        ],
        "predmet": "m",
        "rocniky": [
          1,
          2,
          3,
          4,
          5
        ]
      },
      {
        "soubor": "obsah/m2_geo_zaklady.html",
        "nazev": "📏 Bod, přímka, úsečka",
        "tagy": [
          "2. ročník",
          "geometrie",
          "bod",
          "přímka",
          "úsečka",
          "měření"
        ],
        "predmet": "m",
        "rocniky": [
          2,
          3
        ]
      },
      {
        "soubor": "obsah/m4_obvod_obsah.html",
        "nazev": "🟦 Obvod a obsah čtverce a obdélníku",
        "tagy": [
          "4. ročník",
          "obvod",
          "obsah",
          "čtverec",
          "obdélník",
          "čtvercová síť"
        ],
        "predmet": "m",
        "rocniky": [
          4,
          5
        ]
      },
      {
        "soubor": "obsah/m4_soumernost.html",
        "nazev": "🪞 Osová souměrnost",
        "tagy": [
          "4. ročník",
          "souměrnost",
          "osa souměrnosti",
          "zrcadlení"
        ],
        "predmet": "m",
        "rocniky": [
          4,
          5
        ]
      },
      {
        "soubor": "obsah/m5_site_teles.html",
        "nazev": "📦 Sítě těles",
        "tagy": [
          "5. ročník",
          "síť tělesa",
          "krychle",
          "kvádr",
          "prostorová představivost"
        ],
        "predmet": "m",
        "rocniky": [
          5,
          6
        ]
      },
      {
        "soubor": "obsah/geometricke_konstrukce.html",
        "nazev": "📏 Geometrické konstrukce kružítkem",
        "tagy": [
          "geometrie",
          "kružítko",
          "pravítko",
          "konstrukce",
          "těžnice",
          "kolmice",
          "tečna",
          "osa úhlu",
          "dynamická geometrie",
          "2. stupeň"
        ],
        "predmet": "m",
        "rocniky": [
          6,
          7,
          8,
          9
        ]
      },
      {
        "soubor": "obsah/geometrie_vzorce.html",
        "nazev": "📐 Obvody, obsahy, objemy",
        "tagy": [
          "2. stupeň",
          "6. ročník",
          "7. ročník",
          "8. ročník",
          "9. ročník",
          "geometrie",
          "vzorce"
        ],
        "predmet": "m",
        "rocniky": [
          6,
          7,
          8,
          9
        ]
      },
      {
        "soubor": "obsah/m6_uhly.html",
        "nazev": "📐 Úhel a jeho velikost",
        "tagy": [
          "6. ročník",
          "úhel",
          "úhloměr",
          "stupně",
          "osa úhlu",
          "druhy úhlů"
        ],
        "predmet": "m",
        "rocniky": [
          6
        ]
      },
      {
        "soubor": "obsah/m6_krychle_kvadr.html",
        "nazev": "📦 Krychle a kvádr – povrch a objem",
        "tagy": [
          "6. ročník",
          "povrch",
          "objem",
          "krychle",
          "kvádr",
          "jednotky objemu"
        ],
        "predmet": "m",
        "rocniky": [
          6,
          7
        ]
      },
      {
        "soubor": "obsah/m6_trojuhelnik.html",
        "nazev": "🔺 Trojúhelník – druhy a konstrukce",
        "tagy": [
          "6. ročník",
          "trojúhelník",
          "konstrukce",
          "sss",
          "sus",
          "usu",
          "trojúhelníková nerovnost"
        ],
        "predmet": "m",
        "rocniky": [
          6
        ]
      },
      {
        "soubor": "obsah/m7_shodnost.html",
        "nazev": "📐 Shodnost trojúhelníků",
        "tagy": [
          "7. ročník",
          "shodnost",
          "věty o shodnosti",
          "konstrukce"
        ],
        "predmet": "m",
        "rocniky": [
          7
        ]
      },
      {
        "soubor": "obsah/m7_ctyruhelniky.html",
        "nazev": "🔷 Čtyřúhelníky a hranoly",
        "tagy": [
          "7. ročník",
          "čtyřúhelník",
          "rovnoběžník",
          "lichoběžník",
          "hranol"
        ],
        "predmet": "m",
        "rocniky": [
          7
        ]
      },
      {
        "soubor": "obsah/m8_kruh.html",
        "nazev": "⭕ Kruh a kružnice",
        "tagy": [
          "8. ročník",
          "kruh",
          "kružnice",
          "obvod",
          "obsah",
          "pí",
          "tětiva"
        ],
        "predmet": "m",
        "rocniky": [
          8
        ]
      },
      {
        "soubor": "obsah/m8_pythagoras.html",
        "nazev": "📐 Pythagorova věta",
        "tagy": [
          "8. ročník",
          "pythagorova věta",
          "pravoúhlý trojúhelník",
          "přepona",
          "odvěsna"
        ],
        "predmet": "m",
        "rocniky": [
          8
        ]
      },
      {
        "soubor": "obsah/m8_valec.html",
        "nazev": "🥫 Válec",
        "tagy": [
          "8. ročník",
          "válec",
          "povrch",
          "objem",
          "rotační těleso"
        ],
        "predmet": "m",
        "rocniky": [
          8
        ]
      },
      {
        "soubor": "obsah/trigonometrie.html",
        "nazev": "📐 Trigonometrie pravoúhlého trojúhelníku",
        "tagy": [
          "trigonometrie",
          "sinus",
          "kosinus",
          "tangens",
          "sš"
        ],
        "predmet": "m",
        "rocniky": [
          9
        ]
      },
      {
        "soubor": "obsah/m9_podobnost.html",
        "nazev": "🔍 Podobnost",
        "tagy": [
          "9. ročník",
          "podobnost",
          "poměr podobnosti",
          "zvětšení",
          "zmenšení",
          "měřítko",
          "měření stínem",
          "výška stromu",
          "interaktivní"
        ],
        "predmet": "m",
        "rocniky": [
          9
        ]
      },
      {
        "soubor": "obsah/m9_jehlan_kuzel.html",
        "nazev": "🔻 Jehlan, kužel a koule",
        "tagy": [
          "9. ročník",
          "jehlan",
          "kužel",
          "koule",
          "povrch",
          "objem",
          "síť tělesa",
          "plášť",
          "kruhová výseč",
          "interaktivní"
        ],
        "predmet": "m",
        "rocniky": [
          9
        ]
      }
    ]
  },
  {
    "nazev": "🧮 Algebra & funkce",
    "skupina": "matematika",
    "polozky": [
      {
        "soubor": "obsah/rovnice.html",
        "nazev": "🧮 Lineární rovnice",
        "tagy": [
          "2. stupeň",
          "8. ročník",
          "9. ročník",
          "neznámá",
          "algebra",
          "váhy",
          "rovnováha",
          "interaktivní"
        ],
        "predmet": "m",
        "rocniky": [
          8,
          9
        ]
      },
      {
        "soubor": "obsah/m8_vyrazy.html",
        "nazev": "🧮 Výrazy a jejich úpravy",
        "tagy": [
          "8. ročník",
          "výrazy",
          "mnohočleny",
          "roznásobení",
          "vytýkání",
          "vzorce",
          "plošný model",
          "interaktivní"
        ],
        "predmet": "m",
        "rocniky": [
          8
        ]
      },
      {
        "soubor": "obsah/grafy_funkci.html",
        "nazev": "📈 Grafy funkcí",
        "tagy": [
          "2. stupeň",
          "9. ročník",
          "střední škola",
          "sš",
          "funkce",
          "graf",
          "parabola",
          "nulové body",
          "odečítání z grafu",
          "interaktivní"
        ],
        "predmet": "m",
        "rocniky": [
          9
        ]
      },
      {
        "soubor": "obsah/m9_lomene_vyrazy.html",
        "nazev": "🧮 Lomené výrazy",
        "tagy": [
          "9. ročník",
          "lomené výrazy",
          "podmínky",
          "krácení",
          "zlomky s proměnnou",
          "zakázaná hodnota",
          "interaktivní"
        ],
        "predmet": "m",
        "rocniky": [
          9
        ]
      },
      {
        "soubor": "obsah/m9_soustavy.html",
        "nazev": "🧮 Soustavy rovnic",
        "tagy": [
          "9. ročník",
          "soustavy rovnic",
          "dosazovací metoda",
          "sčítací metoda",
          "grafické řešení",
          "průsečík přímek",
          "rovnoběžky",
          "interaktivní"
        ],
        "predmet": "m",
        "rocniky": [
          9
        ]
      }
    ]
  },
  {
    "nazev": "📊 Data, statistika & finance",
    "skupina": "matematika",
    "polozky": [
      {
        "soubor": "obsah/m5_prumer.html",
        "nazev": "📈 Aritmetický průměr",
        "tagy": [
          "5. ročník",
          "průměr",
          "statistika",
          "data",
          "vyrovnání",
          "interaktivní"
        ],
        "predmet": "m",
        "rocniky": [
          5,
          6
        ]
      },
      {
        "soubor": "obsah/m7_umernost.html",
        "nazev": "📉 Přímá a nepřímá úměrnost",
        "tagy": [
          "7. ročník",
          "úměrnost",
          "trojčlenka",
          "graf úměrnosti",
          "konstanta úměrnosti",
          "hyperbola",
          "interaktivní"
        ],
        "predmet": "m",
        "rocniky": [
          7,
          8
        ]
      },
      {
        "soubor": "obsah/m8_statistika.html",
        "nazev": "📊 Statistika – průměr, medián, modus",
        "tagy": [
          "8. ročník",
          "statistika",
          "medián",
          "modus",
          "četnost",
          "diagram",
          "odlehlá hodnota",
          "interaktivní"
        ],
        "predmet": "m",
        "rocniky": [
          8,
          9
        ]
      },
      {
        "soubor": "obsah/kombinatorika.html",
        "nazev": "🎲 Kombinatorika a pravděpodobnost",
        "tagy": [
          "kombinatorika",
          "pravděpodobnost",
          "variace",
          "kombinace",
          "permutace",
          "sš",
          "simulace",
          "relativní četnost",
          "interaktivní"
        ],
        "predmet": "m",
        "rocniky": [
          9
        ]
      },
      {
        "soubor": "obsah/m9_financni.html",
        "nazev": "💰 Finanční matematika",
        "tagy": [
          "9. ročník",
          "úrok",
          "půjčka",
          "spoření",
          "rozpočet",
          "finanční gramotnost",
          "složené úročení",
          "splátka",
          "interaktivní"
        ],
        "predmet": "m",
        "rocniky": [
          9
        ]
      }
    ]
  },
  {
    "nazev": "🗣️ Slovní zásoba",
    "skupina": "jazyky",
    "polozky": [
      {
        "soubor": "obsah/aj_slovicka.html",
        "nazev": "🇬🇧 Angličtina – první slovíčka",
        "tagy": [
          "angličtina",
          "english",
          "1. stupeň",
          "slovíčka",
          "obrázky",
          "začátečník"
        ],
        "predmet": "aj",
        "rocniky": [
          3,
          4,
          5
        ]
      },
      {
        "soubor": "obsah/aj3_pozdravy.html",
        "nazev": "👋 Pozdravy a představení",
        "tagy": [
          "3. ročník",
          "angličtina",
          "pozdravy",
          "představení",
          "konverzace"
        ],
        "predmet": "aj",
        "rocniky": [
          3
        ]
      },
      {
        "soubor": "obsah/aj_slovesa.html",
        "nazev": "🇬🇧 Anglická nepravidelná slovesa",
        "tagy": [
          "angličtina",
          "english",
          "2. stupeň",
          "sš",
          "irregular verbs",
          "slovesa"
        ],
        "predmet": "aj",
        "rocniky": [
          6,
          7,
          8,
          9
        ]
      },
      {
        "soubor": "obsah/de_slovicka.html",
        "nazev": "🇩🇪 Němčina – slovíčka",
        "tagy": [
          "němčina",
          "deutsch",
          "slovíčka",
          "členy",
          "der die das"
        ],
        "predmet": "dcj",
        "rocniky": [
          7,
          8,
          9
        ]
      },
      {
        "soubor": "obsah/fr_slovicka.html",
        "nazev": "🇫🇷 Francouzština – slovíčka",
        "tagy": [
          "francouzština",
          "français",
          "slovíčka",
          "členy",
          "le la les"
        ],
        "predmet": "dcj",
        "rocniky": [
          7,
          8,
          9
        ]
      },
      {
        "soubor": "obsah/dcj8_cislovky_cas.html",
        "nazev": "🕐 Číslovky a určování času",
        "tagy": [
          "8. ročník",
          "němčina",
          "francouzština",
          "číslovky",
          "hodiny",
          "datum"
        ],
        "predmet": "dcj",
        "rocniky": [
          8
        ]
      }
    ]
  },
  {
    "nazev": "🔤 Gramatika & výslovnost",
    "skupina": "jazyky",
    "polozky": [
      {
        "soubor": "obsah/aj3_abeceda.html",
        "nazev": "🔤 Abeceda a hláskování",
        "tagy": [
          "3. ročník",
          "angličtina",
          "abeceda",
          "spelling",
          "hláskování"
        ],
        "predmet": "aj",
        "rocniky": [
          3,
          4
        ]
      },
      {
        "soubor": "obsah/aj4_pritomny_prosty.html",
        "nazev": "⏰ Přítomný čas prostý",
        "tagy": [
          "4. ročník",
          "angličtina",
          "present simple",
          "koncovka -s",
          "do/does"
        ],
        "predmet": "aj",
        "rocniky": [
          4,
          5
        ]
      },
      {
        "soubor": "obsah/aj4_predlozky.html",
        "nazev": "📍 Předložky místa a času",
        "tagy": [
          "4. ročník",
          "angličtina",
          "předložky",
          "in/on/at",
          "místo",
          "čas"
        ],
        "predmet": "aj",
        "rocniky": [
          4,
          5
        ]
      },
      {
        "soubor": "obsah/aj4_mnozne_cislo.html",
        "nazev": "🔢 Množné číslo a členy",
        "tagy": [
          "4. ročník",
          "angličtina",
          "plural",
          "a/an/the",
          "členy"
        ],
        "predmet": "aj",
        "rocniky": [
          4
        ]
      },
      {
        "soubor": "obsah/casovani_sloves.html",
        "nazev": "🔤 Trenažér časování sloves",
        "tagy": [
          "gramatika",
          "slovesa",
          "časování",
          "angličtina",
          "němčina",
          "francouzština"
        ],
        "predmet": "aj",
        "rocniky": [
          4,
          5,
          6,
          7,
          8,
          9
        ]
      },
      {
        "soubor": "obsah/aj5_pritomny_prubehovy.html",
        "nazev": "🏃 Přítomný čas průběhový",
        "tagy": [
          "5. ročník",
          "angličtina",
          "present continuous",
          "ing",
          "právě teď"
        ],
        "predmet": "aj",
        "rocniky": [
          5,
          6
        ]
      },
      {
        "soubor": "obsah/aj5_modalni.html",
        "nazev": "🔑 Can, must – modální slovesa",
        "tagy": [
          "5. ročník",
          "angličtina",
          "can",
          "must",
          "modální slovesa",
          "povolení"
        ],
        "predmet": "aj",
        "rocniky": [
          5,
          6
        ]
      },
      {
        "soubor": "obsah/aj6_minuly_cas.html",
        "nazev": "⏪ Minulý čas prostý",
        "tagy": [
          "6. ročník",
          "angličtina",
          "past simple",
          "did",
          "pravidelná slovesa"
        ],
        "predmet": "aj",
        "rocniky": [
          6,
          7
        ]
      },
      {
        "soubor": "obsah/aj6_stupnovani.html",
        "nazev": "📈 Stupňování přídavných jmen",
        "tagy": [
          "6. ročník",
          "angličtina",
          "comparative",
          "superlative",
          "stupňování"
        ],
        "predmet": "aj",
        "rocniky": [
          6,
          7
        ]
      },
      {
        "soubor": "obsah/aj7_budouci.html",
        "nazev": "⏩ Budoucí čas – will a going to",
        "tagy": [
          "7. ročník",
          "angličtina",
          "future",
          "will",
          "going to",
          "plány"
        ],
        "predmet": "aj",
        "rocniky": [
          7
        ]
      },
      {
        "soubor": "obsah/aj7_pocitatelnost.html",
        "nazev": "🍎 Počitatelná a nepočitatelná podstatná jména",
        "tagy": [
          "7. ročník",
          "angličtina",
          "countable",
          "uncountable",
          "some/any",
          "much/many"
        ],
        "predmet": "aj",
        "rocniky": [
          7
        ]
      },
      {
        "soubor": "obsah/dcj7_cleny.html",
        "nazev": "📗 Členy a rod podstatných jmen",
        "tagy": [
          "7. ročník",
          "němčina",
          "francouzština",
          "členy",
          "der die das",
          "le la les"
        ],
        "predmet": "dcj",
        "rocniky": [
          7,
          8
        ]
      },
      {
        "soubor": "obsah/dcj7_vyslovnost.html",
        "nazev": "🔊 Výslovnost a abeceda (NJ/FJ)",
        "tagy": [
          "7. ročník",
          "němčina",
          "francouzština",
          "výslovnost",
          "abeceda",
          "další cizí jazyk"
        ],
        "predmet": "dcj",
        "rocniky": [
          7
        ]
      },
      {
        "soubor": "obsah/dcj8_casovani.html",
        "nazev": "🏃 Časování pravidelných sloves",
        "tagy": [
          "8. ročník",
          "němčina",
          "francouzština",
          "časování",
          "slovesa"
        ],
        "predmet": "dcj",
        "rocniky": [
          8
        ]
      },
      {
        "soubor": "obsah/aj8_predpritomny.html",
        "nazev": "🔄 Předpřítomný čas",
        "tagy": [
          "8. ročník",
          "angličtina",
          "present perfect",
          "ever",
          "never",
          "already",
          "yet"
        ],
        "predmet": "aj",
        "rocniky": [
          8
        ]
      },
      {
        "soubor": "obsah/aj8_trpny_rod.html",
        "nazev": "🔧 Trpný rod",
        "tagy": [
          "8. ročník",
          "angličtina",
          "passive voice",
          "trpný rod"
        ],
        "predmet": "aj",
        "rocniky": [
          8,
          9
        ]
      },
      {
        "soubor": "obsah/dcj9_minuly.html",
        "nazev": "⏪ Minulý čas – úvod",
        "tagy": [
          "9. ročník",
          "němčina",
          "francouzština",
          "perfektum",
          "passé composé",
          "minulý čas"
        ],
        "predmet": "dcj",
        "rocniky": [
          9
        ]
      },
      {
        "soubor": "obsah/aj9_neprima_rec.html",
        "nazev": "💬 Nepřímá řeč",
        "tagy": [
          "9. ročník",
          "angličtina",
          "reported speech",
          "nepřímá řeč",
          "posun časů"
        ],
        "predmet": "aj",
        "rocniky": [
          9
        ]
      },
      {
        "soubor": "obsah/aj9_podminkove.html",
        "nazev": "🔀 Podmínkové věty",
        "tagy": [
          "9. ročník",
          "angličtina",
          "conditionals",
          "if",
          "podmínkové věty"
        ],
        "predmet": "aj",
        "rocniky": [
          9
        ]
      }
    ]
  },
  {
    "nazev": "🏡 Člověk a jeho svět",
    "skupina": "prvouka",
    "polozky": [
      {
        "soubor": "obsah/prv1_rodina.html",
        "nazev": "👨‍👩‍👧 Rodina a domov",
        "tagy": [
          "1. ročník",
          "prvouka",
          "rodina",
          "domov",
          "příbuzenské vztahy"
        ],
        "predmet": "prv",
        "rocniky": [
          1,
          2
        ]
      },
      {
        "soubor": "obsah/prv1_cesta_skola.html",
        "nazev": "🚸 Cesta do školy a bezpečnost",
        "tagy": [
          "1. ročník",
          "prvouka",
          "bezpečnost",
          "dopravní výchova",
          "chodec"
        ],
        "predmet": "prv",
        "rocniky": [
          1,
          2
        ]
      },
      {
        "soubor": "obsah/prv2_zdravi.html",
        "nazev": "🩹 Zdraví, nemoc a první pomoc",
        "tagy": [
          "2. ročník",
          "prvouka",
          "zdraví",
          "nemoc",
          "první pomoc",
          "tísňová volání"
        ],
        "predmet": "prv",
        "rocniky": [
          2,
          3
        ]
      },
      {
        "soubor": "obsah/prv5_zdravy_styl.html",
        "nazev": "🥗 Zdravý životní styl",
        "tagy": [
          "5. ročník",
          "přírodověda",
          "zdraví",
          "výživa",
          "pohyb",
          "režim dne"
        ],
        "predmet": "prv",
        "rocniky": [
          5
        ]
      }
    ]
  },
  {
    "nazev": "🌳 Příroda kolem nás",
    "skupina": "prvouka",
    "polozky": [
      {
        "soubor": "obsah/prv1_rocni_obdobi.html",
        "nazev": "🍂 Roční období a čas",
        "tagy": [
          "1. ročník",
          "prvouka",
          "roční období",
          "měsíce",
          "den",
          "týden"
        ],
        "predmet": "prv",
        "rocniky": [
          1,
          2
        ]
      },
      {
        "soubor": "obsah/prv1_smysly.html",
        "nazev": "👁️ Lidské tělo a smysly",
        "tagy": [
          "1. ročník",
          "prvouka",
          "smysly",
          "tělo",
          "zrak",
          "sluch"
        ],
        "predmet": "prv",
        "rocniky": [
          1,
          2
        ]
      },
      {
        "soubor": "obsah/prv2_zvirata.html",
        "nazev": "🐄 Domácí a volně žijící zvířata",
        "tagy": [
          "2. ročník",
          "prvouka",
          "zvířata",
          "domácí zvířata",
          "mláďata",
          "třídění"
        ],
        "predmet": "prv",
        "rocniky": [
          2,
          3
        ]
      },
      {
        "soubor": "obsah/prv3_ziva_neziva.html",
        "nazev": "🌱 Živá a neživá příroda",
        "tagy": [
          "3. ročník",
          "prvouka",
          "živá příroda",
          "neživá příroda",
          "třídění",
          "znaky života"
        ],
        "predmet": "prv",
        "rocniky": [
          3
        ]
      },
      {
        "soubor": "obsah/prv3_voda_vzduch.html",
        "nazev": "💧 Voda, vzduch a půda",
        "tagy": [
          "3. ročník",
          "prvouka",
          "voda",
          "vzduch",
          "půda",
          "koloběh vody"
        ],
        "predmet": "prv",
        "rocniky": [
          3,
          4
        ]
      },
      {
        "soubor": "obsah/prv4_ekosystemy.html",
        "nazev": "🌳 Ekosystémy – les, louka, voda",
        "tagy": [
          "4. ročník",
          "přírodověda",
          "ekosystém",
          "les",
          "louka",
          "rybník",
          "společenstva"
        ],
        "predmet": "prv",
        "rocniky": [
          4,
          5
        ]
      },
      {
        "soubor": "obsah/prv4_horniny.html",
        "nazev": "🪨 Horniny a nerosty",
        "tagy": [
          "4. ročník",
          "přírodověda",
          "horniny",
          "nerosty",
          "vlastnosti",
          "určování"
        ],
        "predmet": "prv",
        "rocniky": [
          4,
          5
        ]
      },
      {
        "soubor": "obsah/prv5_energie.html",
        "nazev": "⚡ Energie a její zdroje",
        "tagy": [
          "5. ročník",
          "přírodověda",
          "energie",
          "elektrárny",
          "obnovitelné zdroje",
          "úspory"
        ],
        "predmet": "prv",
        "rocniky": [
          5
        ]
      }
    ]
  },
  {
    "nazev": "🕰️ Naše vlast a dějiny",
    "skupina": "prvouka",
    "polozky": [
      {
        "soubor": "obsah/prv3_obec.html",
        "nazev": "🏘️ Naše obec a kraj",
        "tagy": [
          "3. ročník",
          "vlastivěda",
          "obec",
          "kraj",
          "orientace",
          "plán obce"
        ],
        "predmet": "prv",
        "rocniky": [
          3,
          4
        ]
      },
      {
        "soubor": "obsah/prv4_nejstarsi_dejiny.html",
        "nazev": "🏰 Nejstarší české dějiny",
        "tagy": [
          "4. ročník",
          "vlastivěda",
          "dějiny",
          "Sámo",
          "Velká Morava",
          "Přemyslovci"
        ],
        "predmet": "prv",
        "rocniky": [
          4,
          5
        ]
      },
      {
        "soubor": "obsah/prv4_mapy_smery.html",
        "nazev": "🧭 Mapa, plán a světové strany",
        "tagy": [
          "4. ročník",
          "vlastivěda",
          "mapa",
          "světové strany",
          "měřítko",
          "orientace"
        ],
        "predmet": "prv",
        "rocniky": [
          4,
          5
        ]
      },
      {
        "soubor": "obsah/prv5_statni_symboly.html",
        "nazev": "🇨🇿 Státní symboly a instituce",
        "tagy": [
          "5. ročník",
          "vlastivěda",
          "státní symboly",
          "prezident",
          "parlament",
          "demokracie"
        ],
        "predmet": "prv",
        "rocniky": [
          5
        ]
      },
      {
        "soubor": "obsah/prv5_dejiny_20.html",
        "nazev": "🕰️ 20. století v našich dějinách",
        "tagy": [
          "5. ročník",
          "vlastivěda",
          "20. století",
          "republika",
          "války",
          "1989"
        ],
        "predmet": "prv",
        "rocniky": [
          5
        ]
      }
    ]
  },
  {
    "nazev": "⚛️ Fyzika",
    "skupina": "priroda",
    "polozky": [
      {
        "soubor": "obsah/f6_hustota.html",
        "nazev": "⚖️ Hustota",
        "tagy": [
          "6. ročník",
          "fyzika",
          "hustota",
          "objem",
          "hmotnost",
          "plavání těles"
        ],
        "predmet": "f",
        "rocniky": [
          6,
          7
        ]
      },
      {
        "soubor": "obsah/physics_ref.html",
        "nazev": "⚛️ Fyzikální vzorce",
        "tagy": [
          "fyzika",
          "2. stupeň",
          "sš",
          "vzorce",
          "kalkulačka",
          "konstanty",
          "graf závislosti",
          "interaktivní"
        ],
        "predmet": "f",
        "rocniky": [
          6,
          7,
          8,
          9
        ]
      },
      {
        "soubor": "obsah/f6_mereni.html",
        "nazev": "📏 Měření fyzikálních veličin",
        "tagy": [
          "6. ročník",
          "fyzika",
          "měření",
          "délka",
          "objem",
          "hmotnost",
          "čas",
          "teplota"
        ],
        "predmet": "f",
        "rocniky": [
          6
        ]
      },
      {
        "soubor": "obsah/physics_playground.html",
        "nazev": "🔬 Fyzikální hřiště pro děti",
        "tagy": [
          "fyzika",
          "kyvadlo",
          "nakloněná rovina",
          "srážky",
          "simulace"
        ],
        "predmet": "f",
        "rocniky": [
          6,
          7
        ]
      },
      {
        "soubor": "obsah/f6_vlastnosti_latek.html",
        "nazev": "🧊 Vlastnosti látek a těles",
        "tagy": [
          "6. ročník",
          "fyzika",
          "látka",
          "těleso",
          "skupenství",
          "částice",
          "Archimédův zákon",
          "vztlak",
          "hustota",
          "plavání těles"
        ],
        "predmet": "f",
        "rocniky": [
          6
        ]
      },
      {
        "soubor": "obsah/paka.html",
        "nazev": "⚖️ Páka a jednoduché stroje",
        "tagy": [
          "fyzika",
          "páka",
          "moment síly",
          "rameno",
          "rovnováha",
          "kladka",
          "kladkostroj",
          "ozubená kola",
          "převod",
          "jednoduché stroje",
          "zlaté pravidlo mechaniky",
          "simulace",
          "2. stupeň",
          "sš"
        ],
        "predmet": "f",
        "rocniky": [
          7,
          8
        ]
      },
      {
        "soubor": "obsah/gravitacni_hriste2.html",
        "nazev": "🌀 Gravitační hřiště: Vzájemná přitažlivost",
        "tagy": [
          "gravitace",
          "fyzika",
          "n-těles",
          "hmotnost",
          "vesmír",
          "simulace",
          "srážky planet",
          "sluneční soustava",
          "kruhová dráha",
          "stabilita soustavy"
        ],
        "predmet": "f",
        "rocniky": [
          7,
          9
        ]
      },
      {
        "soubor": "obsah/f7_tlak.html",
        "nazev": "🎈 Tlak v kapalinách a plynech",
        "tagy": [
          "7. ročník",
          "fyzika",
          "tlak",
          "pascalův zákon",
          "archimédův zákon",
          "vztlak",
          "hydraulika"
        ],
        "predmet": "f",
        "rocniky": [
          7,
          8
        ]
      },
      {
        "soubor": "obsah/gravitacni_hriste.html",
        "nazev": "🎯 Gravitační hřiště",
        "tagy": [
          "gravitace",
          "fyzika",
          "kepler",
          "oběžná dráha",
          "vesmír",
          "simulace",
          "kosmická rychlost"
        ],
        "predmet": "f",
        "rocniky": [
          7,
          9
        ]
      },
      {
        "soubor": "obsah/f7_pohyb.html",
        "nazev": "🏃 Pohyb tělesa – dráha a rychlost",
        "tagy": [
          "7. ročník",
          "fyzika",
          "pohyb",
          "rychlost",
          "dráha",
          "graf pohybu"
        ],
        "predmet": "f",
        "rocniky": [
          7
        ]
      },
      {
        "soubor": "obsah/vitr_tunel.html",
        "nazev": "💨 Vítr a překážky – aerodynamický tunel",
        "tagy": [
          "fyzika",
          "vítr",
          "proudění",
          "aerodynamika",
          "víry",
          "turbulence",
          "odpor vzduchu",
          "vztlak",
          "křídlo",
          "kármánova vírová stezka",
          "simulace",
          "2. stupeň",
          "sš"
        ],
        "predmet": "f",
        "rocniky": [
          7,
          8
        ]
      },
      {
        "soubor": "obsah/f7_sila.html",
        "nazev": "💪 Síla, těžiště a Newtonovy zákony",
        "tagy": [
          "7. ročník",
          "fyzika",
          "síla",
          "newtonovy zákony",
          "těžiště",
          "skládání sil",
          "gravitace"
        ],
        "predmet": "f",
        "rocniky": [
          7
        ]
      },
      {
        "soubor": "obsah/elektrina.html",
        "nazev": "⚡ Elektřina – obvody a magnetismus",
        "tagy": [
          "fyzika",
          "elektřina",
          "ohmův zákon",
          "proud",
          "napětí",
          "odpor",
          "elektrický obvod",
          "sériové zapojení",
          "paralelní zapojení",
          "žárovka",
          "zkrat",
          "pojistka",
          "magnetické pole",
          "elektromagnet",
          "cívka",
          "pravidlo pravé ruky",
          "elektromagnetická indukce",
          "generátor",
          "spotřeba elektřiny",
          "kWh",
          "cena elektřiny",
          "elektrická práce",
          "simulace",
          "2. stupeň",
          "sš"
        ],
        "predmet": "f",
        "rocniky": [
          8,
          9
        ]
      },
      {
        "soubor": "obsah/f8_teplo.html",
        "nazev": "🌡️ Teplo a změny skupenství",
        "tagy": [
          "8. ročník",
          "fyzika",
          "teplo",
          "teplota",
          "skupenské teplo",
          "var",
          "tání",
          "kalorimetr"
        ],
        "predmet": "f",
        "rocniky": [
          8
        ]
      },
      {
        "soubor": "obsah/vodni_hladina.html",
        "nazev": "💧 Vodní hladina – vlny a slapy",
        "tagy": [
          "fyzika",
          "vlnění",
          "vlny",
          "voda",
          "rybník",
          "kruhy na vodě",
          "interference",
          "ohyb",
          "difrakce",
          "odraz",
          "štěrbina",
          "simulace",
          "příliv",
          "odliv",
          "slapy",
          "slapové jevy",
          "měsíc",
          "zeměpis",
          "2. stupeň",
          "sš"
        ],
        "predmet": "f",
        "rocniky": [
          8,
          9
        ]
      },
      {
        "soubor": "obsah/optika.html",
        "nazev": "🔦 Optika – odraz, lom a čočky",
        "tagy": [
          "fyzika",
          "optika",
          "světlo",
          "odraz",
          "lom",
          "snellův zákon",
          "index lomu",
          "mezní úhel",
          "úplný odraz",
          "čočka",
          "spojka",
          "rozptylka",
          "zrcadlo",
          "ohnisko",
          "hranol",
          "spektrum",
          "disperze",
          "duha",
          "simulace",
          "2. stupeň",
          "sš",
          "dalekohled",
          "hvězdářský dalekohled",
          "zvětšení"
        ],
        "predmet": "f",
        "rocniky": [
          8,
          9
        ]
      },
      {
        "soubor": "obsah/optika_soustava.html",
        "nazev": "\ud83e\udde9 Stavba optick\u00e9 soustavy",
        "tagy": [
          "fyzika",
          "optika",
          "optick\u00e1 soustava",
          "\u010do\u010dka",
          "spojka",
          "rozptylka",
          "zrcadlo",
          "clona",
          "ohnisko",
          "obraz",
          "zv\u011bt\u0161en\u00ed",
          "dalekohled",
          "zrcadlov\u00fd dalekohled",
          "mikroskop",
          "lupa",
          "promita\u010dka",
          "simulace",
          "stavebnice",
          "2. stupe\u0148",
          "\u0161\u0161"
        ],
        "predmet": "f",
        "rocniky": [
          8,
          9
        ]
      },
      {
        "soubor": "obsah/f8_prace_energie.html",
        "nazev": "🔧 Práce, výkon a energie",
        "tagy": [
          "8. ročník",
          "fyzika",
          "práce",
          "výkon",
          "energie",
          "účinnost",
          "polohová energie"
        ],
        "predmet": "f",
        "rocniky": [
          8
        ]
      },
      {
        "soubor": "obsah/f9_jaderna.html",
        "nazev": "☢️ Jaderná energie",
        "tagy": [
          "9. ročník",
          "fyzika",
          "atom",
          "jádro",
          "radioaktivita",
          "štěpení",
          "jaderná elektrárna",
          "řetězová reakce",
          "regulační tyče",
          "kritický stav",
          "kritické množství",
          "součinitel násobení",
          "reflektor neutronů",
          "poločas rozpadu",
          "parogenerátor",
          "simulace",
          "interaktivní"
        ],
        "predmet": "f",
        "rocniky": [
          9
        ]
      },
      {
        "soubor": "obsah/f9_zvuk.html",
        "nazev": "🔊 Zvukové jevy",
        "tagy": [
          "9. ročník",
          "fyzika",
          "zvuk",
          "kmitání",
          "frekvence",
          "ozvěna",
          "hlasitost"
        ],
        "predmet": "f",
        "rocniky": [
          9
        ]
      },
      {
        "soubor": "obsah/f9_stridavy_proud.html",
        "nazev": "🔌 Střídavý proud a rozvod elektřiny",
        "tagy": [
          "9. ročník",
          "fyzika",
          "střídavý proud",
          "transformátor",
          "elektrárna",
          "rozvodná síť"
        ],
        "predmet": "f",
        "rocniky": [
          9
        ]
      }
    ]
  },
  {
    "nazev": "⚗️ Chemie",
    "skupina": "priroda",
    "polozky": [
      {
        "soubor": "obsah/ch8_bezpecnost.html",
        "nazev": "☣️ Bezpečnost práce a výstražné značky",
        "tagy": [
          "8. ročník",
          "chemie",
          "bezpečnost",
          "ghs",
          "výstražné symboly",
          "laboratoř"
        ],
        "predmet": "ch",
        "rocniky": [
          8
        ]
      },
      {
        "soubor": "obsah/chem_nazvoslovi.html",
        "nazev": "⚗️ Chemické názvosloví",
        "tagy": [
          "chemie",
          "vzorce",
          "oxidy",
          "kyseliny",
          "soli",
          "2. stupeň",
          "sš"
        ],
        "predmet": "ch",
        "rocniky": [
          8,
          9
        ]
      },
      {
        "soubor": "obsah/ch8_atom.html",
        "nazev": "⚛️ Atom, molekula a chemická vazba",
        "tagy": [
          "8. ročník",
          "chemie",
          "atom",
          "elektron",
          "proton",
          "vazba",
          "ionty",
          "molekula",
          "izotop"
        ],
        "predmet": "ch",
        "rocniky": [
          8
        ]
      },
      {
        "soubor": "obsah/periodic_table.html",
        "nazev": "⚛️ Periodická tabulka",
        "tagy": [
          "chemie",
          "prvky",
          "mendělejev",
          "2. stupeň",
          "sš"
        ],
        "predmet": "ch",
        "rocniky": [
          8,
          9
        ]
      },
      {
        "soubor": "obsah/ch8_voda_vzduch.html",
        "nazev": "💨 Voda a vzduch",
        "tagy": [
          "8. ročník",
          "chemie",
          "voda",
          "vzduch",
          "složení",
          "znečištění",
          "pitná voda"
        ],
        "predmet": "ch",
        "rocniky": [
          8
        ]
      },
      {
        "soubor": "obsah/ch8_smesi.html",
        "nazev": "🧪 Směsi a jejich oddělování",
        "tagy": [
          "8. ročník",
          "chemie",
          "směs",
          "roztok",
          "filtrace",
          "destilace",
          "koncentrace"
        ],
        "predmet": "ch",
        "rocniky": [
          8
        ]
      },
      {
        "soubor": "obsah/vycislovani_rovnic.html",
        "nazev": "🧪 Vyčíslování chemických rovnic",
        "tagy": [
          "chemie",
          "2. stupeň",
          "8. ročník",
          "9. ročník",
          "sš",
          "koeficienty",
          "stechiometrie"
        ],
        "predmet": "ch",
        "rocniky": [
          8,
          9
        ]
      },
      {
        "soubor": "obsah/ch9_zivotni_prostredi.html",
        "nazev": "♻️ Chemie a životní prostředí",
        "tagy": [
          "9. ročník",
          "chemie",
          "plasty",
          "recyklace",
          "paliva",
          "skleníkový efekt",
          "odpady"
        ],
        "predmet": "ch",
        "rocniky": [
          9
        ]
      },
      {
        "soubor": "obsah/ch9_prirodni_latky.html",
        "nazev": "🍞 Přírodní látky",
        "tagy": [
          "9. ročník",
          "chemie",
          "sacharidy",
          "tuky",
          "bílkoviny",
          "vitamíny",
          "výživa"
        ],
        "predmet": "ch",
        "rocniky": [
          9
        ]
      },
      {
        "soubor": "obsah/ch9_redoxni.html",
        "nazev": "🔋 Redoxní reakce a elektrolýza",
        "tagy": [
          "9. ročník",
          "chemie",
          "oxidace",
          "redukce",
          "elektrolýza",
          "koroze",
          "galvanický článek"
        ],
        "predmet": "ch",
        "rocniky": [
          9
        ]
      },
      {
        "soubor": "obsah/ch9_uhlovodiky.html",
        "nazev": "🛢️ Uhlovodíky",
        "tagy": [
          "9. ročník",
          "chemie",
          "uhlovodíky",
          "alkany",
          "alkeny",
          "ropa",
          "paliva"
        ],
        "predmet": "ch",
        "rocniky": [
          9
        ]
      },
      {
        "soubor": "obsah/ch9_ph.html",
        "nazev": "🧫 Kyseliny, hydroxidy a pH",
        "tagy": [
          "9. ročník",
          "chemie",
          "ph",
          "kyselina",
          "hydroxid",
          "indikátor",
          "neutralizace"
        ],
        "predmet": "ch",
        "rocniky": [
          9
        ]
      },
      {
        "soubor": "obsah/ch9_derivaty.html",
        "nazev": "🧴 Deriváty uhlovodíků",
        "tagy": [
          "9. ročník",
          "chemie",
          "deriváty",
          "alkoholy",
          "kyseliny",
          "funkční skupina"
        ],
        "predmet": "ch",
        "rocniky": [
          9
        ]
      }
    ]
  },
  {
    "nazev": "🧬 Přírodopis",
    "skupina": "priroda",
    "polozky": [
      {
        "soubor": "obsah/potravni_retezec.html",
        "nazev": "🌾 Potravní řetězce",
        "tagy": [
          "biologie",
          "ekosystém",
          "producent",
          "konzument",
          "1. stupeň",
          "2. stupeň"
        ],
        "predmet": "pr",
        "rocniky": [
          6,
          9
        ]
      },
      {
        "soubor": "obsah/pr6_houby.html",
        "nazev": "🍄 Houby a lišejníky",
        "tagy": [
          "6. ročník",
          "přírodopis",
          "houby",
          "lišejníky",
          "symbióza",
          "určování hub"
        ],
        "predmet": "pr",
        "rocniky": [
          6
        ]
      },
      {
        "soubor": "obsah/pr6_bezobratli.html",
        "nazev": "🐌 Bezobratlí",
        "tagy": [
          "6. ročník",
          "přírodopis",
          "bezobratlí",
          "žahavci",
          "měkkýši",
          "kroužkovci"
        ],
        "predmet": "pr",
        "rocniky": [
          6,
          7
        ]
      },
      {
        "soubor": "obsah/bunka.html",
        "nazev": "🔬 Stavba buňky",
        "tagy": [
          "biologie",
          "buňka",
          "organely",
          "jádro",
          "mitochondrie",
          "2. stupeň"
        ],
        "predmet": "pr",
        "rocniky": [
          6
        ]
      },
      {
        "soubor": "obsah/pr6_clenovci.html",
        "nazev": "🕷️ Členovci",
        "tagy": [
          "6. ročník",
          "přírodopis",
          "členovci",
          "hmyz",
          "pavoukovci",
          "korýši",
          "proměna"
        ],
        "predmet": "pr",
        "rocniky": [
          6,
          7
        ]
      },
      {
        "soubor": "obsah/pr6_mikroorganismy.html",
        "nazev": "🦠 Bakterie, viry a jednobuněčné organismy",
        "tagy": [
          "6. ročník",
          "přírodopis",
          "bakterie",
          "viry",
          "prvoci",
          "mikroskop",
          "nemoci"
        ],
        "predmet": "pr",
        "rocniky": [
          6
        ]
      },
      {
        "soubor": "obsah/pr7_rostliny.html",
        "nazev": "🌿 Stavba a systém rostlin",
        "tagy": [
          "7. ročník",
          "přírodopis",
          "rostliny",
          "kořen",
          "stonek",
          "list",
          "květ",
          "fotosyntéza"
        ],
        "predmet": "pr",
        "rocniky": [
          7
        ]
      },
      {
        "soubor": "obsah/pr7_obratlovci_studenokrevni.html",
        "nazev": "🐟 Ryby, obojživelníci a plazi",
        "tagy": [
          "7. ročník",
          "přírodopis",
          "ryby",
          "obojživelníci",
          "plazi",
          "obratlovci"
        ],
        "predmet": "pr",
        "rocniky": [
          7
        ]
      },
      {
        "soubor": "obsah/pr7_ptaci_savci.html",
        "nazev": "🦅 Ptáci a savci",
        "tagy": [
          "7. ročník",
          "přírodopis",
          "ptáci",
          "savci",
          "přizpůsobení",
          "potrava"
        ],
        "predmet": "pr",
        "rocniky": [
          7
        ]
      },
      {
        "soubor": "obsah/pr8_rozmnozovani.html",
        "nazev": "👶 Rozmnožování a vývoj člověka",
        "tagy": [
          "8. ročník",
          "přírodopis",
          "rozmnožovací soustava",
          "vývoj",
          "dospívání",
          "těhotenství"
        ],
        "predmet": "pr",
        "rocniky": [
          8
        ]
      },
      {
        "soubor": "obsah/pr8_prvni_pomoc.html",
        "nazev": "🚑 Zdraví a první pomoc",
        "tagy": [
          "8. ročník",
          "přírodopis",
          "první pomoc",
          "zdraví",
          "úraz",
          "resuscitace"
        ],
        "predmet": "pr",
        "rocniky": [
          8
        ]
      },
      {
        "soubor": "obsah/anatomie.html",
        "nazev": "🫀 Biologie člověka",
        "tagy": [
          "biologie",
          "anatomie",
          "orgány",
          "soustavy",
          "2. stupeň"
        ],
        "predmet": "pr",
        "rocniky": [
          8
        ]
      },
      {
        "soubor": "obsah/pr9_ekologie.html",
        "nazev": "♻️ Ekologie a ochrana přírody",
        "tagy": [
          "9. ročník",
          "přírodopis",
          "ekologie",
          "ekosystém",
          "chráněná území",
          "biodiverzita"
        ],
        "predmet": "pr",
        "rocniky": [
          9
        ]
      },
      {
        "soubor": "obsah/pr9_geologicke_deje.html",
        "nazev": "🌋 Geologické děje",
        "tagy": [
          "9. ročník",
          "přírodopis",
          "sopky",
          "zemětřesení",
          "zvětrávání",
          "litosférické desky"
        ],
        "predmet": "pr",
        "rocniky": [
          9
        ]
      },
      {
        "soubor": "obsah/pr9_mineraly.html",
        "nazev": "💎 Minerály a horniny",
        "tagy": [
          "9. ročník",
          "přírodopis",
          "minerály",
          "horniny",
          "vyvřelé",
          "usazené",
          "přeměněné"
        ],
        "predmet": "pr",
        "rocniky": [
          9
        ]
      },
      {
        "soubor": "obsah/pr9_vyvoj_zeme.html",
        "nazev": "🦕 Vývoj Země a života",
        "tagy": [
          "9. ročník",
          "přírodopis",
          "geologické éry",
          "zkameněliny",
          "evoluce",
          "dinosauři"
        ],
        "predmet": "pr",
        "rocniky": [
          9
        ]
      },
      {
        "soubor": "obsah/punnett.html",
        "nazev": "🧬 Punnettův čtverec",
        "tagy": [
          "biologie",
          "genetika",
          "2. stupeň",
          "sš",
          "křížení",
          "dědičnost",
          "alely"
        ],
        "predmet": "pr",
        "rocniky": [
          9
        ]
      }
    ]
  },
  {
    "nazev": "🪐 Astronomie",
    "skupina": "priroda",
    "polozky": [
      {
        "soubor": "obsah/star_map.html",
        "nazev": "🌌 Hvězdná obloha",
        "tagy": [
          "hvězdy",
          "souhvězdí",
          "astronomie",
          "obloha",
          "roční období",
          "zimní obloha",
          "letní obloha"
        ],
        "predmet": "f",
        "rocniky": [
          6,
          9
        ]
      },
      {
        "soubor": "obsah/pohyb_vesmirem.html",
        "nazev": "🌌 Pohyb vesmírem",
        "tagy": [
          "vesmír",
          "galaxie",
          "měsíc",
          "slunce",
          "oběh",
          "astronomie",
          "mléčná dráha"
        ],
        "predmet": "f",
        "rocniky": [
          6,
          9
        ]
      },
      {
        "soubor": "obsah/planet_globe.html",
        "nazev": "🌐 Glóbusy planet",
        "tagy": [
          "planety",
          "vesmír",
          "astronomie",
          "mars",
          "měsíc",
          "3d",
          "glóbus"
        ],
        "predmet": "f",
        "rocniky": [
          6,
          9
        ]
      },
      {
        "soubor": "obsah/sky_events.html",
        "nazev": "🌠 Astronomický kalendář úkazů",
        "tagy": [
          "meteorický roj",
          "zatmění",
          "úplněk",
          "slunovrat",
          "rovnodennost",
          "astronomie"
        ],
        "predmet": "f",
        "rocniky": [
          6,
          9
        ]
      },
      {
        "soubor": "obsah/solar_system.html",
        "nazev": "🪐 Sluneční soustava",
        "tagy": [
          "planety",
          "vesmír",
          "astronomie"
        ],
        "predmet": "f",
        "rocniky": [
          6,
          9
        ]
      },
      {
        "soubor": "obsah/iss.html",
        "nazev": "🛰️ ISS živě",
        "tagy": [
          "vesmír",
          "stanice",
          "družice",
          "oběžná dráha",
          "astronomie",
          "živě"
        ],
        "predmet": "f",
        "rocniky": [
          9
        ]
      }
    ]
  },
  {
    "nazev": "🌍 Zeměpis",
    "skupina": "spolecnost",
    "polozky": [
      {
        "soubor": "obsah/z6_atmosfera.html",
        "nazev": "☁️ Atmosféra a počasí",
        "tagy": [
          "6. ročník",
          "zeměpis",
          "atmosféra",
          "počasí",
          "podnebné pásy",
          "tlak vzduchu"
        ],
        "predmet": "z",
        "rocniky": [
          6,
          7
        ]
      },
      {
        "soubor": "obsah/z6_hydrosfera.html",
        "nazev": "🌊 Hydrosféra",
        "tagy": [
          "6. ročník",
          "zeměpis",
          "hydrosféra",
          "oceány",
          "řeky",
          "ledovce",
          "koloběh vody"
        ],
        "predmet": "z",
        "rocniky": [
          6,
          7
        ]
      },
      {
        "soubor": "obsah/z6_planeta_zeme.html",
        "nazev": "🌎 Planeta Země – tvar a pohyby",
        "tagy": [
          "6. ročník",
          "zeměpis",
          "Země",
          "rotace",
          "oběh",
          "střídání dne a noci",
          "roční období"
        ],
        "predmet": "z",
        "rocniky": [
          6
        ]
      },
      {
        "soubor": "obsah/z6_mapa_souradnice.html",
        "nazev": "🗺️ Mapa, měřítko a souřadnice",
        "tagy": [
          "6. ročník",
          "zeměpis",
          "mapa",
          "měřítko",
          "zeměpisná šířka",
          "délka",
          "glóbus"
        ],
        "predmet": "z",
        "rocniky": [
          6
        ]
      },
      {
        "soubor": "obsah/eduMaps.html",
        "nazev": "🗺️ Mapy",
        "tagy": [
          "zeměpis",
          "mapy",
          "výuka"
        ],
        "predmet": "z",
        "rocniky": [
          6,
          7,
          8,
          9
        ]
      },
      {
        "soubor": "obsah/z6_litosfera.html",
        "nazev": "🪨 Litosféra a povrch Země",
        "tagy": [
          "6. ročník",
          "zeměpis",
          "litosféra",
          "pohoří",
          "sopky",
          "desky",
          "nadmořská výška"
        ],
        "predmet": "z",
        "rocniky": [
          6
        ]
      },
      {
        "soubor": "obsah/z7_afrika.html",
        "nazev": "🌍 Afrika",
        "tagy": [
          "7. ročník",
          "zeměpis",
          "Afrika",
          "Sahara",
          "státy",
          "regiony"
        ],
        "predmet": "z",
        "rocniky": [
          7
        ]
      },
      {
        "soubor": "obsah/svetova_hlavni_mesta.html",
        "nazev": "🌍 Kvíz světových hlavních měst",
        "tagy": [
          "zeměpis",
          "hlavní města",
          "svět",
          "státy"
        ],
        "predmet": "z",
        "rocniky": [
          7,
          9
        ]
      },
      {
        "soubor": "obsah/z7_amerika.html",
        "nazev": "🌎 Amerika",
        "tagy": [
          "7. ročník",
          "zeměpis",
          "Amerika",
          "Kordillery",
          "Amazonie",
          "státy"
        ],
        "predmet": "z",
        "rocniky": [
          7
        ]
      },
      {
        "soubor": "obsah/z7_asie.html",
        "nazev": "🌏 Asie",
        "tagy": [
          "7. ročník",
          "zeměpis",
          "Asie",
          "Himálaj",
          "monzun",
          "státy"
        ],
        "predmet": "z",
        "rocniky": [
          7
        ]
      },
      {
        "soubor": "obsah/flags_quiz.html",
        "nazev": "🏳️ Kvíz vlajky a města",
        "tagy": [
          "vlajky",
          "státy",
          "hlavní města",
          "zeměpis"
        ],
        "predmet": "z",
        "rocniky": [
          7,
          8,
          9
        ]
      },
      {
        "soubor": "obsah/z7_australie_oceanie.html",
        "nazev": "🦘 Austrálie, Oceánie a polární oblasti",
        "tagy": [
          "7. ročník",
          "zeměpis",
          "Austrálie",
          "Oceánie",
          "Antarktida",
          "Arktida"
        ],
        "predmet": "z",
        "rocniky": [
          7
        ]
      },
      {
        "soubor": "obsah/z8_cr_prirodni.html",
        "nazev": "🇨🇿 ČR – povrch, podnebí a vodstvo",
        "tagy": [
          "8. ročník",
          "zeměpis",
          "Česko",
          "povrch",
          "podnebí",
          "vodstvo",
          "úmoří"
        ],
        "predmet": "z",
        "rocniky": [
          8
        ]
      },
      {
        "soubor": "obsah/z8_evropa_regiony.html",
        "nazev": "🇪🇺 Evropa – regiony",
        "tagy": [
          "8. ročník",
          "zeměpis",
          "Evropa",
          "regiony",
          "severní",
          "jižní",
          "západní",
          "východní"
        ],
        "predmet": "z",
        "rocniky": [
          8
        ]
      },
      {
        "soubor": "obsah/reky_pohori.html",
        "nazev": "🏔️ Řeky a pohoří ČR",
        "tagy": [
          "zeměpis",
          "česko",
          "řeky",
          "pohoří",
          "2. stupeň"
        ],
        "predmet": "z",
        "rocniky": [
          8
        ]
      },
      {
        "soubor": "obsah/z8_cr_hospodarstvi.html",
        "nazev": "🏭 ČR – obyvatelstvo a hospodářství",
        "tagy": [
          "8. ročník",
          "zeměpis",
          "Česko",
          "obyvatelstvo",
          "průmysl",
          "zemědělství",
          "doprava"
        ],
        "predmet": "z",
        "rocniky": [
          8,
          9
        ]
      },
      {
        "soubor": "obsah/slepa_mapa_evropa.html",
        "nazev": "🗺️ Slepá mapa Evropy",
        "tagy": [
          "státy",
          "evropa",
          "zeměpis",
          "2. stupeň",
          "sš"
        ],
        "predmet": "z",
        "rocniky": [
          8
        ]
      },
      {
        "soubor": "obsah/slepa_mapa.html",
        "nazev": "🗺️ Slepá mapa ČR",
        "tagy": [
          "kraje",
          "krajská města",
          "zeměpis",
          "česko",
          "2. stupeň"
        ],
        "predmet": "z",
        "rocniky": [
          8
        ]
      },
      {
        "soubor": "obsah/z9_hospodarstvi_svet.html",
        "nazev": "🌐 Světové hospodářství a globalizace",
        "tagy": [
          "9. ročník",
          "zeměpis",
          "hospodářství",
          "globalizace",
          "obchod",
          "sektory"
        ],
        "predmet": "z",
        "rocniky": [
          9
        ]
      },
      {
        "soubor": "obsah/z9_obyvatelstvo.html",
        "nazev": "👥 Obyvatelstvo a sídla světa",
        "tagy": [
          "9. ročník",
          "zeměpis",
          "obyvatelstvo",
          "migrace",
          "města",
          "hustota zalidnění"
        ],
        "predmet": "z",
        "rocniky": [
          9
        ]
      },
      {
        "soubor": "obsah/z9_globalni_problemy.html",
        "nazev": "🔥 Globální problémy a životní prostředí",
        "tagy": [
          "9. ročník",
          "zeměpis",
          "klima",
          "globální oteplování",
          "chudoba",
          "udržitelnost"
        ],
        "predmet": "z",
        "rocniky": [
          9
        ]
      }
    ]
  },
  {
    "nazev": "📜 Dějepis & společnost",
    "skupina": "spolecnost",
    "polozky": [
      {
        "soubor": "obsah/d6_recko.html",
        "nazev": "🏛️ Starověké Řecko",
        "tagy": [
          "6. ročník",
          "dějepis",
          "Řecko",
          "Athény",
          "Sparta",
          "demokracie",
          "olympijské hry"
        ],
        "predmet": "d",
        "rocniky": [
          6
        ]
      },
      {
        "soubor": "obsah/d6_rim.html",
        "nazev": "🏟️ Starověký Řím",
        "tagy": [
          "6. ročník",
          "dějepis",
          "Řím",
          "republika",
          "císařství",
          "legie",
          "křesťanství"
        ],
        "predmet": "d",
        "rocniky": [
          6,
          7
        ]
      },
      {
        "soubor": "obsah/d6_stary_orient.html",
        "nazev": "🏺 Starověký Egypt a Mezopotámie",
        "tagy": [
          "6. ročník",
          "dějepis",
          "Egypt",
          "Mezopotámie",
          "písmo",
          "pyramidy",
          "starověk"
        ],
        "predmet": "d",
        "rocniky": [
          6
        ]
      },
      {
        "soubor": "obsah/historicke_mapy_odkazy.html",
        "nazev": "📜 Kde najít historické mapy",
        "tagy": [
          "dějepis",
          "mapy",
          "archiv"
        ],
        "predmet": "d",
        "rocniky": [
          6,
          7,
          8,
          9
        ]
      },
      {
        "soubor": "obsah/svetove_dejiny.html",
        "nazev": "📜 Časová osa světových dějin",
        "tagy": [
          "dějepis",
          "historie",
          "svět",
          "letopočty",
          "2. stupeň",
          "sš"
        ],
        "predmet": "d",
        "rocniky": [
          6,
          7,
          8,
          9
        ]
      },
      {
        "soubor": "obsah/d6_prameny.html",
        "nazev": "🔎 Čas, prameny a práce historika",
        "tagy": [
          "6. ročník",
          "dějepis",
          "historické prameny",
          "letopočet",
          "periodizace",
          "archeologie"
        ],
        "predmet": "d",
        "rocniky": [
          6
        ]
      },
      {
        "soubor": "obsah/d6_pravek.html",
        "nazev": "🦴 Pravěk",
        "tagy": [
          "6. ročník",
          "dějepis",
          "pravěk",
          "doba kamenná",
          "doba bronzová",
          "lovci",
          "zemědělství"
        ],
        "predmet": "d",
        "rocniky": [
          6
        ]
      },
      {
        "soubor": "obsah/d7_rany_stredovek.html",
        "nazev": "⚔️ Raný středověk a příchod Slovanů",
        "tagy": [
          "7. ročník",
          "dějepis",
          "středověk",
          "stěhování národů",
          "Sámo",
          "Velká Morava",
          "Slované"
        ],
        "predmet": "d",
        "rocniky": [
          7
        ]
      },
      {
        "soubor": "obsah/d7_husitstvi.html",
        "nazev": "⛪ Husitství",
        "tagy": [
          "7. ročník",
          "dějepis",
          "husité",
          "Jan Hus",
          "Žižka",
          "reformace",
          "kalich"
        ],
        "predmet": "d",
        "rocniky": [
          7,
          8
        ]
      },
      {
        "soubor": "obsah/d7_lucemburkove.html",
        "nazev": "🏰 Lucemburkové a Karel IV.",
        "tagy": [
          "7. ročník",
          "dějepis",
          "Lucemburkové",
          "Karel IV.",
          "gotika",
          "univerzita"
        ],
        "predmet": "d",
        "rocniky": [
          7
        ]
      },
      {
        "soubor": "obsah/d7_premyslovci.html",
        "nazev": "👑 Přemyslovci",
        "tagy": [
          "7. ročník",
          "dějepis",
          "Přemyslovci",
          "český stát",
          "panovníci",
          "kolonizace"
        ],
        "predmet": "d",
        "rocniky": [
          7
        ]
      },
      {
        "soubor": "obsah/casova_osa.html",
        "nazev": "📜 Časová osa českých dějin",
        "tagy": [
          "dějepis",
          "historie",
          "letopočty",
          "2. stupeň",
          "sš"
        ],
        "predmet": "d",
        "rocniky": [
          7,
          8,
          9
        ]
      },
      {
        "soubor": "obsah/d8_objevy_renesance.html",
        "nazev": "⛵ Zámořské objevy a renesance",
        "tagy": [
          "8. ročník",
          "dějepis",
          "objevy",
          "Kolumbus",
          "renesance",
          "humanismus"
        ],
        "predmet": "d",
        "rocniky": [
          8
        ]
      },
      {
        "soubor": "obsah/d8_prumyslova_revoluce.html",
        "nazev": "🏭 Průmyslová revoluce a národní obrození",
        "tagy": [
          "8. ročník",
          "dějepis",
          "průmyslová revoluce",
          "stroje",
          "národní obrození",
          "rok 1848"
        ],
        "predmet": "d",
        "rocniky": [
          8,
          9
        ]
      },
      {
        "soubor": "obsah/d8_osvicenstvi.html",
        "nazev": "💡 Osvícenství a revoluce",
        "tagy": [
          "8. ročník",
          "dějepis",
          "osvícenství",
          "Marie Terezie",
          "Josef II.",
          "francouzská revoluce",
          "Napoleon"
        ],
        "predmet": "d",
        "rocniky": [
          8
        ]
      },
      {
        "soubor": "obsah/d8_reformace.html",
        "nazev": "📜 Reformace a třicetiletá válka",
        "tagy": [
          "8. ročník",
          "dějepis",
          "reformace",
          "Luther",
          "třicetiletá válka",
          "Bílá hora"
        ],
        "predmet": "d",
        "rocniky": [
          8
        ]
      },
      {
        "soubor": "obsah/eu_instituce.html",
        "nazev": "🇪🇺 Instituce Evropské unie",
        "tagy": [
          "eu",
          "evropská unie",
          "instituce",
          "politika",
          "sš"
        ],
        "predmet": "d",
        "rocniky": [
          9
        ]
      },
      {
        "soubor": "obsah/d9_prvni_valka.html",
        "nazev": "🎖️ První světová válka",
        "tagy": [
          "9. ročník",
          "dějepis",
          "první světová válka",
          "fronty",
          "legie",
          "Versailles"
        ],
        "predmet": "d",
        "rocniky": [
          9
        ]
      },
      {
        "soubor": "obsah/d9_csr.html",
        "nazev": "🏛️ Vznik ČSR a meziválečné období",
        "tagy": [
          "9. ročník",
          "dějepis",
          "Československo",
          "Masaryk",
          "první republika",
          "Mnichov"
        ],
        "predmet": "d",
        "rocniky": [
          9
        ]
      },
      {
        "soubor": "obsah/d9_druha_valka.html",
        "nazev": "🕯️ Druhá světová válka a holokaust",
        "tagy": [
          "9. ročník",
          "dějepis",
          "druhá světová válka",
          "protektorát",
          "holokaust",
          "odboj"
        ],
        "predmet": "d",
        "rocniky": [
          9
        ]
      },
      {
        "soubor": "obsah/d9_studena_valka.html",
        "nazev": "🧊 Studená válka a rok 1989",
        "tagy": [
          "9. ročník",
          "dějepis",
          "studená válka",
          "komunismus",
          "1968",
          "1989",
          "sametová revoluce"
        ],
        "predmet": "d",
        "rocniky": [
          9
        ]
      }
    ]
  },
  {
    "nazev": "🧭 Algoritmy & programování",
    "skupina": "informatika",
    "polozky": [
      {
        "soubor": "obsah/inf4_sekvence.html",
        "nazev": "🧭 Programování – sekvence příkazů",
        "tagy": [
          "4. ročník",
          "informatika",
          "programování",
          "algoritmus",
          "sekvence",
          "robot"
        ],
        "predmet": "inf",
        "rocniky": [
          4
        ]
      },
      {
        "soubor": "obsah/inf5_cykly.html",
        "nazev": "🔁 Programování – cykly a větvení",
        "tagy": [
          "5. ročník",
          "informatika",
          "cyklus",
          "podmínka",
          "větvení",
          "blokové programování"
        ],
        "predmet": "inf",
        "rocniky": [
          5,
          6
        ]
      },
      {
        "soubor": "obsah/inf6_promenne.html",
        "nazev": "📦 Programování – proměnné a podmínky",
        "tagy": [
          "6. ročník",
          "informatika",
          "proměnná",
          "podmínka",
          "programování"
        ],
        "predmet": "inf",
        "rocniky": [
          6,
          7
        ]
      },
      {
        "soubor": "obsah/inf7_funkce.html",
        "nazev": "🧩 Programování – funkce a parametry",
        "tagy": [
          "7. ročník",
          "informatika",
          "funkce",
          "podprogram",
          "parametr",
          "programování"
        ],
        "predmet": "inf",
        "rocniky": [
          7,
          8
        ]
      },
      {
        "soubor": "obsah/eduSort.html",
        "nazev": "🔢 Algoritmy řazení",
        "tagy": [
          "informatika",
          "programování",
          "sorting"
        ],
        "predmet": "inf",
        "rocniky": [
          8,
          9
        ]
      },
      {
        "soubor": "obsah/inf9_model_simulace.html",
        "nazev": "🧪 Modely a simulace",
        "tagy": [
          "9. ročník",
          "informatika",
          "model",
          "simulace",
          "systém",
          "graf"
        ],
        "predmet": "inf",
        "rocniky": [
          9
        ]
      }
    ]
  },
  {
    "nazev": "🔣 Data, informace & sítě",
    "skupina": "informatika",
    "polozky": [
      {
        "soubor": "obsah/inf4_data.html",
        "nazev": "🔣 Data, informace a kódování",
        "tagy": [
          "4. ročník",
          "informatika",
          "data",
          "kódování",
          "binární kód",
          "piktogramy"
        ],
        "predmet": "inf",
        "rocniky": [
          4,
          5
        ]
      },
      {
        "soubor": "obsah/morse_code.html",
        "nazev": "📡 Morseova abeceda",
        "tagy": [
          "morseovka",
          "kód",
          "vysílání"
        ],
        "predmet": "inf",
        "rocniky": [
          5,
          6,
          7
        ]
      },
      {
        "soubor": "obsah/inf6_tabulky.html",
        "nazev": "📊 Tabulkový procesor – vzorce",
        "tagy": [
          "6. ročník",
          "informatika",
          "tabulka",
          "vzorce",
          "graf",
          "buňka"
        ],
        "predmet": "inf",
        "rocniky": [
          6,
          7
        ]
      },
      {
        "soubor": "obsah/inf7_site.html",
        "nazev": "🌐 Počítačové sítě a internet",
        "tagy": [
          "7. ročník",
          "informatika",
          "síť",
          "internet",
          "ip adresa",
          "server",
          "protokol"
        ],
        "predmet": "inf",
        "rocniky": [
          7,
          8
        ]
      },
      {
        "soubor": "obsah/inf7_sifrovani.html",
        "nazev": "🔐 Šifrování a kódování dat",
        "tagy": [
          "7. ročník",
          "informatika",
          "šifra",
          "caesarova šifra",
          "kódování",
          "komprese"
        ],
        "predmet": "inf",
        "rocniky": [
          7,
          8
        ]
      },
      {
        "soubor": "obsah/inf8_databaze.html",
        "nazev": "🗄️ Databáze a strukturovaná data",
        "tagy": [
          "8. ročník",
          "informatika",
          "databáze",
          "záznam",
          "filtrování",
          "třídění dat"
        ],
        "predmet": "inf",
        "rocniky": [
          8,
          9
        ]
      }
    ]
  },
  {
    "nazev": "🛡️ Bezpečnost & etika",
    "skupina": "informatika",
    "polozky": [
      {
        "soubor": "obsah/inf4_hardware.html",
        "nazev": "🖥️ Hardware a bezpečné chování",
        "tagy": [
          "4. ročník",
          "informatika",
          "hardware",
          "počítač",
          "bezpečnost",
          "heslo"
        ],
        "predmet": "inf",
        "rocniky": [
          4,
          5
        ]
      },
      {
        "soubor": "obsah/inf5_zdroje.html",
        "nazev": "🔍 Informace na internetu a ověřování",
        "tagy": [
          "5. ročník",
          "informatika",
          "vyhledávání",
          "ověřování zdrojů",
          "dezinformace"
        ],
        "predmet": "inf",
        "rocniky": [
          5,
          6
        ]
      },
      {
        "soubor": "obsah/inf6_digitalni_stopa.html",
        "nazev": "👣 Digitální stopa a bezpečnost",
        "tagy": [
          "6. ročník",
          "informatika",
          "digitální stopa",
          "soukromí",
          "sociální sítě",
          "kyberšikana"
        ],
        "predmet": "inf",
        "rocniky": [
          6,
          7
        ]
      },
      {
        "soubor": "obsah/inf8_licence.html",
        "nazev": "⚖️ Autorská práva a licence",
        "tagy": [
          "8. ročník",
          "informatika",
          "autorské právo",
          "licence",
          "creative commons",
          "citace"
        ],
        "predmet": "inf",
        "rocniky": [
          8,
          9
        ]
      },
      {
        "soubor": "obsah/AI_prednaska.html",
        "nazev": "🤖 AI přednáška",
        "tagy": [
          "umělá inteligence",
          "informatika",
          "prezentace",
          "chatgpt",
          "prompt"
        ],
        "predmet": "inf",
        "rocniky": [
          9
        ]
      },
      {
        "soubor": "obsah/inf9_ai_etika.html",
        "nazev": "🤖 Umělá inteligence a etika",
        "tagy": [
          "9. ročník",
          "informatika",
          "umělá inteligence",
          "etika",
          "chatbot",
          "dezinformace"
        ],
        "predmet": "inf",
        "rocniky": [
          9
        ]
      }
    ]
  },
  {
    "nazev": "🎴 Učení & opakování",
    "skupina": "dalsi",
    "polozky": [
      {
        "soubor": "obsah/typing_trainer.html",
        "nazev": "⌨️ Trenažér psaní",
        "tagy": [
          "psaní všemi deseti",
          "klávesnice"
        ]
      },
      {
        "soubor": "obsah/flashcards.html",
        "nazev": "🎴 Kartičky (flashcards)",
        "tagy": [
          "učení",
          "opakování",
          "sady"
        ]
      },
      {
        "soubor": "obsah/edu_progress.html",
        "nazev": "🏅 Studijní deník a odznaky",
        "tagy": [
          "pokrok",
          "gamifikace",
          "streak",
          "odznaky",
          "návyk"
        ]
      },
      {
        "soubor": "obsah/knihovna_sad.html",
        "nazev": "🗂️ Knihovna sad kartiček",
        "tagy": [
          "kartičky",
          "flashcards",
          "sady",
          "vyjmenovaná slova",
          "slovíčka",
          "letopočty",
          "ke stažení"
        ]
      }
    ]
  },
  {
    "nazev": "🎼 Hudba",
    "skupina": "dalsi",
    "polozky": [
      {
        "soubor": "obsah/music_theory.html",
        "nazev": "🎼 Hudební nauka",
        "tagy": [
          "hudba",
          "noty"
        ]
      },
      {
        "soubor": "obsah/notes_reading.html",
        "nazev": "🎼 Notová osnova – čtení not",
        "tagy": [
          "hudba",
          "noty",
          "houslový klíč",
          "solfeggio"
        ]
      }
    ]
  },
  {
    "nazev": "🖨️ Pro učitele",
    "skupina": "dalsi",
    "polozky": [
      {
        "soubor": "obsah/citation_generator.html",
        "nazev": "📚 Generátor citací",
        "tagy": [
          "citace",
          "bibliografie",
          "iso 690",
          "apa",
          "seminární práce",
          "zdroje"
        ]
      },
      {
        "soubor": "obsah/pracovni_listy.html",
        "nazev": "🖨️ Generátor pracovních listů",
        "tagy": [
          "tisk",
          "pdf",
          "pracovní list",
          "učitel",
          "škola",
          "násobilka",
          "sčítání",
          "zlomky",
          "rovnice",
          "pythagorova věta",
          "vyjmenovaná slova",
          "i/y",
          "bě pě vě mě",
          "shoda přísudku",
          "slovní druhy",
          "angličtina",
          "němčina",
          "slovíčka",
          "klíč řešení",
          "kód listu",
          "varianty A/B",
          "živý náhled",
          "obtížnost po tématech",
          "filtr podle ročníku",
          "filtr podle předmětu",
          "prvouka",
          "hodiny",
          "kalendář",
          "slabiky",
          "tvrdé a měkké souhlásky",
          "přírodopis",
          "lidské tělo",
          "fyzikální veličiny",
          "rychlost dráha čas",
          "dvojková soustava"
        ]
      }
    ]
  }
];

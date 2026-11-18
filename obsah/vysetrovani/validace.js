// GENEROVÁNO: node tools/vysetrovani_validace.mjs – ručně neupravovat
window.VALIDACE = {
 "datum": "2026-11-18",
 "nastroje": {
  "brzdna_draha": {
   "druh": "cislo",
   "velicina": "počáteční rychlost vozidla",
   "jednotka": "km/h",
   "interval": "Interval = rychlost pro μ min a μ max zvoleného povrchu z tabulky stránky (ne statistický interval spolehlivosti).",
   "poznamka": "Prvních 12 případů: skutečné μ náhodně uvnitř tabulkového rozsahu povrchu, délka stopy z nezávislé numerické integrace (krok 10 µs) se stejným sklonem a náběhem, jaký dostane nástroj. Ověřují tedy jen výpočet (vzorec, sklon, náběh) a to, že rozsah μ pokryje skutečnou hodnotu, pokud v něm skutečně leží – ne přesnost v praxi, kde rozhoduje hlavně to, zda tabulkový rozsah pro dané místo platí (proto se μ měří zkušebním brzděním) a jak přesně je změřen začátek stopy. Poslední tři případy ukazují citlivost na chybný vstup: μ pod tabulkovým rozsahem → rychlost nadhodnocena a pravda leží pod celým intervalem (✗); neuvedený sklon −6 % → střed odhadu nadhodnocen asi o 3 km/h; skutečný náběh 0,5 s místo zadaných 0,2 s → střed podhodnocen asi o 3 km/h (nástroj přičítá a·t_n/2 jen za zadaný náběh). U druhých dvou pravda v intervalu zůstala jen díky jeho šíři danou rozsahem μ – chyba vstupu se do intervalu nijak nepromítá. Stopa od kol s ABS do validace nepatří – model ji nepopisuje.",
   "radky": [
    {
     "ukazka": "asfalt suchý, skut. μ 0,66, náběh 0,2 s, stopa 13,5 m",
     "pravda": 50,
     "odhad": 53.23,
     "od": 49.49,
     "do": 56.97,
     "chyba": 3.23,
     "ok": true
    },
    {
     "ukazka": "asfalt suchý, skut. μ 0,70, náběh 0,2 s, stopa 41,0 m",
     "pravda": 88,
     "odhad": 90.84,
     "od": 84.58,
     "do": 97.1,
     "chyba": 2.84,
     "ok": true
    },
    {
     "ukazka": "asfalt suchý, skut. μ 0,72, sklon −3 %, náběh 0,25 s, stopa 91,6 m",
     "pravda": 130,
     "odhad": 132.3,
     "od": 122.85,
     "do": 141.75,
     "chyba": 2.3,
     "ok": true
    },
    {
     "ukazka": "asfalt mokrý, skut. μ 0,60, náběh 0,2 s, stopa 30,1 m",
     "pravda": 70,
     "odhad": 64.79,
     "od": 56.75,
     "do": 72.84,
     "chyba": -5.21,
     "ok": true
    },
    {
     "ukazka": "asfalt mokrý, skut. μ 0,44, sklon 4 %, náběh 0,3 s, stopa 77,8 m",
     "pravda": 100,
     "odhad": 107.98,
     "od": 95.56,
     "do": 120.4,
     "chyba": 7.98,
     "ok": true
    },
    {
     "ukazka": "beton suchý, skut. μ 0,84, náběh 0,15 s, stopa 54,4 m",
     "pravda": 110,
     "odhad": 103.64,
     "od": 96.57,
     "do": 110.72,
     "chyba": -6.36,
     "ok": true
    },
    {
     "ukazka": "beton mokrý, skut. μ 0,62, sklon −2 %, náběh 0,2 s, stopa 39,9 m",
     "pravda": 80,
     "odhad": 76.52,
     "od": 67.57,
     "do": 85.46,
     "chyba": -3.48,
     "ok": true
    },
    {
     "ukazka": "dlažba (kostky) suchá, skut. μ 0,59, sklon 6 %, náběh 0,2 s, stopa 11,1 m",
     "pravda": 45,
     "odhad": 47.06,
     "od": 43.56,
     "do": 50.57,
     "chyba": 2.06,
     "ok": true
    },
    {
     "ukazka": "dlažba (kostky) mokrá, skut. μ 0,51, náběh 0,1 s, stopa 11,8 m",
     "pravda": 40,
     "odhad": 37.24,
     "od": 32.97,
     "do": 41.52,
     "chyba": -2.76,
     "ok": true
    },
    {
     "ukazka": "štěrk, šotolina, skut. μ 0,55, náběh 0,2 s, stopa 23,9 m",
     "pravda": 60,
     "odhad": 57.93,
     "od": 50.71,
     "do": 65.14,
     "chyba": -2.07,
     "ok": true
    },
    {
     "ukazka": "sníh ujetý, skut. μ 0,16, sklon −4 %, náběh 0,3 s, stopa 83,5 m",
     "pravda": 50,
     "odhad": 62.26,
     "od": 48.89,
     "do": 75.64,
     "chyba": 12.26,
     "ok": true
    },
    {
     "ukazka": "led, náledí, skut. μ 0,06, náběh 0,2 s, stopa 56,8 m",
     "pravda": 30,
     "odhad": 37.06,
     "od": 27.05,
     "do": 47.07,
     "chyba": 7.06,
     "ok": true
    },
    {
     "ukazka": "MIMO MODEL: ohlazený mokrý asfalt, skut. μ 0,32 < tabulkových 0,40, stopa 58,3 m",
     "pravda": 70,
     "odhad": 89.43,
     "od": 78.41,
     "do": 100.45,
     "chyba": 19.43,
     "ok": false
    },
    {
     "ukazka": "MIMO MODEL: neuvedený sklon −6 % (zadáno 0 %), suchý asfalt μ 0,75, stopa 34,4 m",
     "pravda": 80,
     "odhad": 83.41,
     "od": 77.65,
     "do": 89.17,
     "chyba": 3.41,
     "ok": true
    },
    {
     "ukazka": "MIMO MODEL: náběh skutečně 0,5 s (zadáno 0,2 s), suchý asfalt μ 0,72, stopa 15,7 m",
     "pravda": 60,
     "odhad": 57.28,
     "od": 53.26,
     "do": 61.29,
     "chyba": -2.72,
     "ok": true
    }
   ],
   "souhrn": {
    "n": 15,
    "pokryto": 14,
    "mae": 5.5447,
    "sirka": 15.348
   }
  },
  "casova_analyza": {
   "druh": "kategorie",
   "radky": [
    {
     "ukazka": "Setkání: souběh Novák × Malá (jen Smíchov, večer)",
     "pravda": "1 souběh, Smíchov",
     "odhad": "1 souběh, Smíchov",
     "ok": true
    },
    {
     "ukazka": "Setkání: výpadek GPS Nováka kolem poledne",
     "pravda": "1 mezera",
     "odhad": "1 mezera",
     "ok": true
    },
    {
     "ukazka": "Setkání: vložený chybný fix (skok do Brna)",
     "pravda": "vyřazen 1 bod",
     "odhad": "vyřazen 1 bod",
     "ok": true
    },
    {
     "ukazka": "Alibi Dvořáka: „ve 21:20 doma“",
     "pravda": "vyvráceno",
     "odhad": "vyvráceno",
     "ok": true
    },
    {
     "ukazka": "Dvořák ve 21:20 u skladu (místo činu)",
     "pravda": "v okruhu",
     "odhad": "v okruhu",
     "ok": true
    },
    {
     "ukazka": "Kontrola: Dvořák v 19:00 doma (pravdivá část výpovědi)",
     "pravda": "potvrzeno",
     "odhad": "potvrzeno",
     "ok": true
    },
    {
     "ukazka": "Návštěvy skladu za večer",
     "pravda": "1 návštěva",
     "odhad": "1 návštěva",
     "ok": true
    },
    {
     "ukazka": "Výpis operátora (BTS) × GPS telefonu",
     "pravda": "0 rozporů",
     "odhad": "0 rozporů",
     "ok": true
    },
    {
     "ukazka": "Posun hodin fotografií (jiné pásmo)",
     "pravda": "oprava +1 h (pásmo)",
     "odhad": "oprava +1 h (pásmo)",
     "ok": true
    },
    {
     "ukazka": "Posun hodin kamery do auta (±30 s)",
     "pravda": "oprava −4,5 min",
     "odhad": "oprava −4,5 min",
     "ok": true
    },
    {
     "ukazka": "Před opravou: fotky v rozporu s trasou",
     "pravda": "9 z 9 v rozporu",
     "odhad": "9 z 9 v rozporu",
     "ok": true
    },
    {
     "ukazka": "Po opravě posunů: rozpory zdrojů",
     "pravda": "0 rozporů",
     "odhad": "0 rozporů",
     "ok": true
    },
    {
     "ukazka": "Spoofing: díra v GPS (prah 30 min)",
     "pravda": "1 mezera",
     "odhad": "1 mezera",
     "ok": true
    },
    {
     "ukazka": "Spoofing: nemožné rychlosti (> 250 km/h)",
     "pravda": "1 (návrat z Bratislavy)",
     "odhad": "1 (návrat z Bratislavy)",
     "ok": true
    },
    {
     "ukazka": "Spoofing odhalen: BTS × GPS (rozpor/bez GPS/ok)",
     "pravda": "3 / 2 / 3",
     "odhad": "3 / 2 / 3",
     "ok": true
    },
    {
     "ukazka": "BTS: hovory přes cizí anténu (…199)",
     "pravda": "2 rozpory, jen …199",
     "odhad": "2 rozpory, jen …199",
     "ok": true
    },
    {
     "ukazka": "BTS: ostatní události ve výseči antény",
     "pravda": "11 v pořádku",
     "odhad": "11 v pořádku",
     "ok": true
    },
    {
     "ukazka": "Vzorce: nejčastější místo",
     "pravda": "domov",
     "odhad": "domov",
     "ok": true
    },
    {
     "ukazka": "Vzorce: práce – počet dní",
     "pravda": "10",
     "odhad": "10",
     "ok": true
    },
    {
     "ukazka": "Vzorce: posilovna – počet návštěv",
     "pravda": "4",
     "odhad": "4",
     "ok": true
    },
    {
     "ukazka": "Bankomat: zastávky ≥ 5 min (jen průjezdy)",
     "pravda": "0",
     "odhad": "0",
     "ok": true
    },
    {
     "ukazka": "Byt svědka J.: návštěvy",
     "pravda": "0",
     "odhad": "0",
     "ok": true
    },
    {
     "ukazka": "Případ 17: alibi Fialy „v 02:08 doma“",
     "pravda": "vyvráceno",
     "odhad": "vyvráceno",
     "ok": true
    },
    {
     "ukazka": "Případ 17: Fiala v 02:08 u prodejny",
     "pravda": "v okruhu",
     "odhad": "v okruhu",
     "ok": true
    },
    {
     "ukazka": "Případ 17: kontrola – Fiala ve 23:30 doma",
     "pravda": "potvrzeno",
     "odhad": "potvrzeno",
     "ok": true
    },
    {
     "ukazka": "Případ 17: hovor 01:31 – Fiala doma?",
     "pravda": "vyvráceno",
     "odhad": "vyvráceno",
     "ok": true
    },
    {
     "ukazka": "Případ 17: souběh Fiala × Brabec (začátek a konec ±10 min)",
     "pravda": "1 souběh 01:38–02:33",
     "odhad": "1 souběh 01:38–02:33",
     "ok": true
    },
    {
     "ukazka": "Případ 17: čerpací stanice (průjezd 01:52 + tankování 02:21–02:27)",
     "pravda": "2 návštěvy",
     "odhad": "2 návštěvy",
     "ok": true
    }
   ],
   "velicina": "závěr analýzy (alibi, souběh, mezery, posun hodin, rozpory zdrojů, místa)",
   "jednotka": "",
   "interval": "Kategorie se porovnává přesně; posun kamery a souběh v případu 17 s uvedenou tolerancí.",
   "poznamka": "Pravda je dána konstrukcí syntetické ukázky (jadro.js – ukazkaAlibi, ukazkaHodiny…), ne výstupem nástroje. Parametry analýz jsou stejné, jaké ukázka nabízí ve stránce (alibi R 150 m, okno 5–10 min; souběh R 200 m, Δt 5 min; mezery od 30 min; limit 250 km/h). Časové údaje: souběh Novák × Malá 17:49–19:08 (pravda 17:54–19:00); výpadek 12:53–14:06 (pravda 12:53–14:06); návštěva skladu 21:03–21:45 (pravda 21:03–21:45, chyba 0/0 min); posun fotek 3600 s (pravda +3600 s), kamery −270 s (pravda −270 s, chyba 0 s); díra v GPS 52 min (pravda 52 min); souběh Fiala × Brabec 01:37–02:35 (pravda 01:38–02:33; chyba -1/2 min); pobyt u prodejny 01:58–02:14 (pravda 01:58–02:14 + příjezd/odjezd v okruhu 150 m). Souběh začíná a končí o pár minut dřív/později než skutečné setkání, protože se počítá v okruhu 200 m (osoby se k sobě teprve blíží) a s tolerancí Δt 5 min – je to vlastnost metody, ne chyba. Ukázky mají GPS s přesností 4–40 m a vzorkování 0,5–5 min; skutečné exporty mívají delší výpadky, horší přesnost uvnitř budov a pouze polohu z BTS (stovky m až km).",
   "souhrn": {
    "n": 28,
    "spravne": 28
   }
  },
  "doba_smrti": {
   "druh": "cislo",
   "velicina": "doba od smrti (PMI)",
   "jednotka": "h",
   "interval": "Interval = Henssgeho 95% tolerance podle normované teploty Q a toho, zda je zadán korekční faktor c ≠ 1 (± 2,8 / 3,2 / 4,5 h, s faktorem ± 2,8 / 4,5 / 7 h), stejně jako ve stránce.",
   "poznamka": "Prvních 11 případů vzniklo stejným modelem, jaký nástroj invertuje (Marshall–Hoare v Henssgeho parametrizaci, kódováno nezávisle), jen s teplotou zaokrouhlenou na 0,1 °C – malá chyba ukazuje správnost numerického řešení a vliv zaokrouhlení (v pozdní fázi, kdy tělo chladne pomalu, je 0,1 °C znát víc). Skutečný rozptyl reálných případů kolem modelu tyto ukázky NEobsahují – ten je právě obsahem Henssgeho tolerancí (odvozených z měření na skutečných tělech), proto tu interval vychází zbytečně „bezpečně“. Případy MIMO MODEL ukazují citlivost na chybný předpoklad: podceněná izolace (c) nebo hmotnost zkracuje odhad, přeceněná prodlužuje; změna teploty okolí během chladnutí (zadána jen teplota při nálezu) posouvá odhad – ochlazení okolí po smrti vede k podhodnocení, oteplení k nadhodnocení; horečka v okamžiku smrti odhad zkracuje, protože tělo „začíná výš“. Tolerance nástroje tyto systematické chyby nepokrývá, pokud se vstup nezadá správně – proto se c volí podle situace v době smrti, ne nálezu, a změna okolí se řeší podle Henssgeho doporučení (např. průměrem teplot) nebo konzultací soudního lékaře.",
   "radky": [
    {
     "ukazka": "PMI 3 h, okolí 18 °C, 75 kg, c 1 → 36,2 °C",
     "pravda": 3,
     "odhad": 2.93,
     "od": 0.13,
     "do": 5.73,
     "chyba": -0.07,
     "ok": true
    },
    {
     "ukazka": "PMI 6 h, okolí 12 °C, 90 kg, c 1 → 34,1 °C",
     "pravda": 6,
     "odhad": 5.96,
     "od": 3.16,
     "do": 8.76,
     "chyba": -0.04,
     "ok": true
    },
    {
     "ukazka": "PMI 10 h, okolí 15 °C, 70 kg, c 1 → 29,7 °C",
     "pravda": 10,
     "odhad": 10.03,
     "od": 7.23,
     "do": 12.83,
     "chyba": 0.03,
     "ok": true
    },
    {
     "ukazka": "PMI 16 h, okolí 12 °C, 90 kg, c 1 → 26,4 °C",
     "pravda": 16,
     "odhad": 15.93,
     "od": 13.13,
     "do": 18.73,
     "chyba": -0.07,
     "ok": true
    },
    {
     "ukazka": "PMI 24 h, okolí 5 °C, 80 kg, c 1 → 15,9 °C",
     "pravda": 24,
     "odhad": 23.97,
     "od": 20.77,
     "do": 27.17,
     "chyba": -0.03,
     "ok": true
    },
    {
     "ukazka": "PMI 8 h, okolí 20 °C, 60 kg, c 1,2 → 32,9 °C",
     "pravda": 8,
     "odhad": 8.01,
     "od": 5.21,
     "do": 10.81,
     "chyba": 0.01,
     "ok": true
    },
    {
     "ukazka": "PMI 12 h, okolí 10 °C, 100 kg, c 1,4 → 32,6 °C",
     "pravda": 12,
     "odhad": 12,
     "od": 9.2,
     "do": 14.8,
     "chyba": 0,
     "ok": true
    },
    {
     "ukazka": "PMI 5 h, okolí 8 °C, 65 kg, c 0,7 → 30,6 °C",
     "pravda": 5,
     "odhad": 4.97,
     "od": 2.17,
     "do": 7.77,
     "chyba": -0.03,
     "ok": true
    },
    {
     "ukazka": "PMI 20 h, okolí 15 °C, 85 kg, c 1,1 → 25,8 °C",
     "pravda": 20,
     "odhad": 20.08,
     "od": 15.58,
     "do": 24.58,
     "chyba": 0.08,
     "ok": true
    },
    {
     "ukazka": "PMI 6 h, okolí 26 °C, 70 kg, c 1 → 34,6 °C",
     "pravda": 6,
     "odhad": 5.92,
     "od": 3.12,
     "do": 8.72,
     "chyba": -0.08,
     "ok": true
    },
    {
     "ukazka": "PMI 10 h, okolí 30 °C, 80 kg, c 1 → 34,6 °C",
     "pravda": 10,
     "odhad": 10.13,
     "od": 7.33,
     "do": 12.93,
     "chyba": 0.13,
     "ok": true
    },
    {
     "ukazka": "MIMO MODEL: skutečně c 1,3 (oblečení), zadáno 1,0; PMI 12 h, 15 °C, 75 kg → 30,8 °C",
     "pravda": 12,
     "odhad": 9.33,
     "od": 6.53,
     "do": 12.13,
     "chyba": -2.67,
     "ok": true
    },
    {
     "ukazka": "MIMO MODEL: skutečně c 0,7 (mokré tělo), zadáno 1,0; PMI 8 h, 12 °C, 70 kg → 27,8 °C",
     "pravda": 8,
     "odhad": 10.97,
     "od": 8.17,
     "do": 13.77,
     "chyba": 2.97,
     "ok": false
    },
    {
     "ukazka": "MIMO MODEL: hmotnost odhadnuta 70 kg, skutečně 95 kg; PMI 14 h, 12 °C → 28,3 °C",
     "pravda": 14,
     "odhad": 10.44,
     "od": 7.64,
     "do": 13.24,
     "chyba": -3.56,
     "ok": false
    },
    {
     "ukazka": "MIMO MODEL: okolí 20 °C prvních 8 h, pak 8 °C (zadáno 8 °C); PMI 14 h, 75 kg → 27,6 °C",
     "pravda": 14,
     "odhad": 10.43,
     "od": 7.63,
     "do": 13.23,
     "chyba": -3.57,
     "ok": false
    },
    {
     "ukazka": "MIMO MODEL: okolí 8 °C prvních 6 h, pak 18 °C (zadáno 18 °C); PMI 10 h, 75 kg → 28,9 °C",
     "pravda": 10,
     "odhad": 13.49,
     "od": 10.69,
     "do": 16.29,
     "chyba": 3.49,
     "ok": false
    },
    {
     "ukazka": "MIMO MODEL: horečka 39,5 °C v okamžiku smrti (model 37,2); PMI 6 h, 15 °C, 75 kg → 35,6 °C",
     "pravda": 6,
     "odhad": 3.56,
     "od": 0.76,
     "do": 6.36,
     "chyba": -2.44,
     "ok": true
    }
   ],
   "souhrn": {
    "n": 17,
    "pokryto": 13,
    "mae": 1.1335,
    "sirka": 5.847
   }
  },
  "financni_toky": {
   "druh": "kategorie",
   "radky": [
    {
     "ukazka": "Import banka Beta (UTF-8 s BOM, čárka, Credit/Debit, čas zvlášť): účet, počet a součet transakcí",
     "pravda": "1700017011/9992; 80; -5 684,10",
     "odhad": "1700017011/9992; 80; -5 684,10",
     "ok": true
    },
    {
     "ukazka": "Mule: rychlý průtok – příchozí platby, které do 48 h odešly",
     "pravda": "5 plateb",
     "odhad": "5 plateb",
     "ok": true
    },
    {
     "ukazka": "Mule: noční transakce (23–5 h)",
     "pravda": "5 transakcí",
     "odhad": "5 transakcí",
     "ok": true
    },
    {
     "ukazka": "Mule: náhlá změna chování, okno zahrnuje první platbu oběti (20. 10.)",
     "pravda": "ano",
     "odhad": "ano",
     "ok": true
    },
    {
     "ukazka": "Mule: vějíř – 5 plátců → 1 příjemce",
     "pravda": "dovnitř, 5 plátců",
     "odhad": "dovnitř, 5 plátců",
     "ok": true
    },
    {
     "ukazka": "MIMO MODEL – mule ve výpisu bez času: noční transakce",
     "pravda": "5 transakcí",
     "odhad": "nelze (výpis nemá čas)",
     "ok": false
    },
    {
     "ukazka": "Mule: dělení pod limit, kulaté částky, okruh (nevloženo)",
     "pravda": "žádná indicie",
     "odhad": "žádná indicie",
     "ok": true
    },
    {
     "ukazka": "Import banka Alfa (windows-1250, středník, desetinná čárka, preambule): účet, počet a součet transakcí",
     "pravda": "1700017021/9991; 28; 213 787,70",
     "odhad": "1700017021/9991; 28; 213 787,70",
     "ok": true
    },
    {
     "ukazka": "Smurfing: vklady hotovosti těsně pod limitem",
     "pravda": "7 vkladů",
     "odhad": "7 vkladů",
     "ok": true
    },
    {
     "ukazka": "Smurfing: vklad nad limitem a bezhotovostní platba v pásmu nezapočteny",
     "pravda": "nezapočteny",
     "odhad": "nezapočteny",
     "ok": true
    },
    {
     "ukazka": "Import banka Gama – Alfa Stav (IBAN protiúčtu, „d. m. rrrr h:mm“): účet, počet a součet transakcí",
     "pravda": "1700017031/9993; 28; 1 314 059,72",
     "odhad": "1700017031/9993; 28; 1 314 059,72",
     "ok": true
    },
    {
     "ukazka": "Import banka Gama – Gama Consult: účet, počet a součet transakcí",
     "pravda": "1700017033/9993; 16; 433 350,80",
     "odhad": "1700017033/9993; 16; 433 350,80",
     "ok": true
    },
    {
     "ukazka": "Okruh: nalezená cesta (zkratky firem)",
     "pravda": "AS → BT → GC → DS → AS",
     "odhad": "AS → BT → GC → DS → AS",
     "ok": true
    },
    {
     "ukazka": "Okruh: počet okruhů (půjčka a splátka AS ⇄ GC se nepočítá)",
     "pravda": "1",
     "odhad": "1",
     "ok": true
    },
    {
     "ukazka": "Okruh: půjčka a splátka spárovány jako převody mezi zajištěnými účty",
     "pravda": "2 páry",
     "odhad": "2 páry",
     "ok": true
    },
    {
     "ukazka": "Okruh: Sankeyův diagram – okruh rozpojen, výsledek bez cyklu",
     "pravda": "1 rozpojení, bez cyklu",
     "odhad": "1 rozpojení, bez cyklu",
     "ok": true
    },
    {
     "ukazka": "Okruh: Sankey – obousměrný tok AS ⇄ GC sloučen na čistý tok",
     "pravda": "sloučeno",
     "odhad": "sloučeno",
     "ok": true
    },
    {
     "ukazka": "Klub: vějíř – 12 investorů → 1 příjemce",
     "pravda": "dovnitř, 12 plátců",
     "odhad": "dovnitř, 12 plátců",
     "ok": true
    },
    {
     "ukazka": "Klub: kulaté částky (násobek 1 000 Kč)",
     "pravda": "10 plateb",
     "odhad": "10 plateb",
     "ok": true
    },
    {
     "ukazka": "Import domácnost, výpis 1 (červen–srpen): účet, počet a součet transakcí",
     "pravda": "1700017051/9991; 106; -47 182,20",
     "odhad": "1700017051/9991; 106; -47 182,20",
     "ok": true
    },
    {
     "ukazka": "Import domácnost, výpis 2 (srpen–listopad): účet, počet a součet transakcí",
     "pravda": "1700017051/9991; 128; -46 891,60",
     "odhad": "1700017051/9991; 128; -46 891,60",
     "ok": true
    },
    {
     "ukazka": "Import spořicí účet: účet, počet a součet transakcí",
     "pravda": "1700017052/9991; 12; 30 032,75",
     "odhad": "1700017052/9991; 12; 30 032,75",
     "ok": true
    },
    {
     "ukazka": "Domácnost (planý poplach?): Dělení pod limit (structuring / smurfing)",
     "pravda": "žádná indicie",
     "odhad": "žádná indicie",
     "ok": true
    },
    {
     "ukazka": "Domácnost (planý poplach?): Rychlý průtok",
     "pravda": "žádná indicie",
     "odhad": "žádná indicie",
     "ok": true
    },
    {
     "ukazka": "Domácnost (planý poplach?): Okruhy (peníze se vrátí)",
     "pravda": "žádná indicie",
     "odhad": "žádná indicie",
     "ok": true
    },
    {
     "ukazka": "Domácnost (planý poplach?): Vějíř dovnitř / ven",
     "pravda": "žádná indicie",
     "odhad": "žádná indicie",
     "ok": true
    },
    {
     "ukazka": "Domácnost (planý poplach?): Kulaté částky",
     "pravda": "žádná indicie",
     "odhad": "žádná indicie",
     "ok": true
    },
    {
     "ukazka": "Domácnost (planý poplach?): Neobvyklé časy",
     "pravda": "žádná indicie",
     "odhad": "žádná indicie",
     "ok": true
    },
    {
     "ukazka": "Domácnost (planý poplach?): Náhlá změna chování účtu",
     "pravda": "žádná indicie",
     "odhad": "žádná indicie",
     "ok": true
    },
    {
     "ukazka": "Domácnost: duplicity v překryvu výpisů (srpen)",
     "pravda": "33 duplicit",
     "odhad": "33 duplicit",
     "ok": true
    },
    {
     "ukazka": "Domácnost: převody na spořicí účet spárované",
     "pravda": "6 párů",
     "odhad": "6 párů",
     "ok": true
    },
    {
     "ukazka": "Import případ 17 – bazar (Alfa): účet, počet a součet transakcí",
     "pravda": "1700017171/9991; 36; 108 582,80",
     "odhad": "1700017171/9991; 36; 108 582,80",
     "ok": true
    },
    {
     "ukazka": "Import případ 17 – Fiala (Beta): účet, počet a součet transakcí",
     "pravda": "1700017172/9992; 36; 15 463",
     "odhad": "1700017172/9992; 36; 15 463",
     "ok": true
    },
    {
     "ukazka": "Import případ 17 – Brabec (Gama): účet, počet a součet transakcí",
     "pravda": "1700017173/9993; 38; 33 006,30",
     "odhad": "1700017173/9993; 38; 33 006,30",
     "ok": true
    },
    {
     "ukazka": "Případ 17: rychlý průtok na účtu bazaru (Kříž)",
     "pravda": "ano, 16. 11.",
     "odhad": "ano, 16. 11.",
     "ok": true
    },
    {
     "ukazka": "Případ 17: rychlý průtok u Fialy (výběr hotovosti)",
     "pravda": "ano, 16. 11.",
     "odhad": "ano, 16. 11.",
     "ok": true
    },
    {
     "ukazka": "Případ 17: průtok u Brabce (peníze zůstaly)",
     "pravda": "ne",
     "odhad": "ne",
     "ok": true
    },
    {
     "ukazka": "Případ 17: převody Kříž → Fiala a Kříž → Brabec spárovány přes tři banky",
     "pravda": "2 páry",
     "odhad": "2 páry",
     "ok": true
    }
   ],
   "poznamka": "Ukázky jsou syntetické a vznikly se známou pravdou: transakce se zapíší do CSV ve formátu tří smyšlených bank a projdou stejným importem jako soubory uživatele; detekce běží s výchozími prahy. Ověřuje se tím import (kódování, oddělovač, desetinná čárka, formát data, účet z preambule, IBAN), párování převodů, duplicity, rozpojení cyklů v diagramu a to, že každý vložený vzorec je nalezen – a na běžné domácnosti žádný planý poplach. Neověřuje se, jak často detektory hlásí legitimní provoz na skutečných účtech (firmy, bazary, rodinné převody) – to závisí na prazích a na skladbě účtu. Řádek MIMO MODEL záměrně selhává: výpis bez času transakce neumožní poznat noční provoz ani průtok v hodinách. Ukázky mimo vložené vzorce mohou mít další indicie (např. změna chování u firmy po velké zakázce); ty v tabulce nejsou a jsou vidět v nástroji.",
   "souhrn": {
    "n": 38,
    "spravne": 37
   }
  },
  "krevni_stopy": {
   "druh": "cislo",
   "velicina": "výška oblasti původu nad podlahou (přímé zpětné dráhy, bod nejblíž všem přímkám)",
   "jednotka": "cm",
   "interval": "90% interval Monte Carlo (5. – 95. percentil výšky z 300 opakování, σ rozměru elipsy 0,1 mm, σ směru 3°) – stejný, jaký ukazuje stránka.",
   "poznamka": "Vzdálenost odhadu od skutečného zdroje ve 3D [cm]: Jeden zdroj na podlaze 0,0; Dvě události na stěně Z1 0,0; Dvě události na stěně Z2 0,0; Stěna a podlaha 0,0; Zašuměné stopy a odlehlé 0,5; Fotka šikmo – korekce perspektivy 0,0; Gravitace a zakřivené dráhy 46,8. Úhel dopadu α jednotlivých stop proti pravdě: průměrná abs. chyba 0,2° (75 stop). Ukázka „Gravitace a zakřivené dráhy“ má skutečně zakřivené (balistické) dráhy – přímky výšku záměrně nadhodnocují a pravda leží mimo interval; to je ukázka hlavní meze metody, ne chyba výpočtu. Korekce gravitace pro rozsah rychlostí dopadu 2,5–4 m/s (nastavení ukázky) dává 8,2–50,4 cm (pravda 30,0 cm). Interval zahrnuje jen šum měření elipsy a směru, ne chybu modelu (zakřivení dráhy, deformace stopy). Stopy se zde berou jako přesné elipsy ukázky; ve stránce se navíc hledají prahováním fotky. Ukázka „Zakreslete sami“ nemá zakreslené stopy, proto chybí.",
   "radky": [
    {
     "ukazka": "Jeden zdroj na podlaze",
     "pravda": 26,
     "odhad": 26,
     "od": 25.26,
     "do": 26.68,
     "chyba": 0,
     "ok": true
    },
    {
     "ukazka": "Dvě události na stěně – Z1",
     "pravda": 38,
     "odhad": 38,
     "od": 37.32,
     "do": 38.62,
     "chyba": 0,
     "ok": true
    },
    {
     "ukazka": "Dvě události na stěně – Z2",
     "pravda": 23,
     "odhad": 23,
     "od": 22.37,
     "do": 23.61,
     "chyba": 0,
     "ok": true
    },
    {
     "ukazka": "Stěna a podlaha",
     "pravda": 22,
     "odhad": 22,
     "od": 21.44,
     "do": 22.46,
     "chyba": 0,
     "ok": true
    },
    {
     "ukazka": "Zašuměné stopy a odlehlé",
     "pravda": 30,
     "odhad": 29.62,
     "od": 29,
     "do": 30.03,
     "chyba": -0.38,
     "ok": true
    },
    {
     "ukazka": "Fotka šikmo – korekce perspektivy",
     "pravda": 24,
     "odhad": 24,
     "od": 23.52,
     "do": 24.39,
     "chyba": 0,
     "ok": true
    },
    {
     "ukazka": "Gravitace a zakřivené dráhy",
     "pravda": 30,
     "odhad": 76.73,
     "od": 75.13,
     "do": 77.99,
     "chyba": 46.73,
     "ok": false
    }
   ],
   "souhrn": {
    "n": 7,
    "pokryto": 6,
    "mae": 6.73,
    "sirka": 1.391
   }
  },
  "pravost_fotky": {
   "druh": "kategorie",
   "radky": [
    {
     "ukazka": "Neupravená fotka z fotoaparátu – ELA",
     "pravda": "nenalezena",
     "odhad": "nenalezena",
     "ok": true
    },
    {
     "ukazka": "Neupravená fotka z fotoaparátu – šum",
     "pravda": "nenalezena",
     "odhad": "nenalezena",
     "ok": true
    },
    {
     "ukazka": "Neupravená fotka z fotoaparátu – klonování",
     "pravda": "nenalezena",
     "odhad": "nenalezena",
     "ok": true
    },
    {
     "ukazka": "Neupravená fotka z fotoaparátu – metadata",
     "pravda": "nenalezena",
     "odhad": "nenalezena",
     "ok": true
    },
    {
     "ukazka": "Neupravená fotka z fotoaparátu – náhled EXIF",
     "pravda": "nenalezena",
     "odhad": "nenalezena",
     "ok": true
    },
    {
     "ukazka": "Neupravená fotka z fotoaparátu – dvojitá komprese",
     "pravda": "nenalezena",
     "odhad": "nenalezena",
     "ok": true
    },
    {
     "ukazka": "Vložený objekt z jiného JPEG – ELA",
     "pravda": "nalezena",
     "odhad": "nalezena",
     "ok": true
    },
    {
     "ukazka": "Vložený objekt z jiného JPEG – šum",
     "pravda": "nalezena",
     "odhad": "nalezena",
     "ok": true
    },
    {
     "ukazka": "Vložený objekt z jiného JPEG – klonování",
     "pravda": "nenalezena",
     "odhad": "nenalezena",
     "ok": true
    },
    {
     "ukazka": "Vložený objekt z jiného JPEG – metadata",
     "pravda": "nenalezena",
     "odhad": "nenalezena",
     "ok": true
    },
    {
     "ukazka": "Vložený objekt z jiného JPEG – náhled EXIF",
     "pravda": "nelze",
     "odhad": "nelze",
     "ok": true
    },
    {
     "ukazka": "Vložený objekt z jiného JPEG – dvojitá komprese",
     "pravda": "nalezena",
     "odhad": "nalezena",
     "ok": true
    },
    {
     "ukazka": "Zklonovaná oblast (zakryté auto) – ELA",
     "pravda": "nalezena",
     "odhad": "nenalezena",
     "ok": false
    },
    {
     "ukazka": "Zklonovaná oblast (zakryté auto) – šum",
     "pravda": "nenalezena",
     "odhad": "nenalezena",
     "ok": true
    },
    {
     "ukazka": "Zklonovaná oblast (zakryté auto) – klonování",
     "pravda": "nalezena",
     "odhad": "nalezena",
     "ok": true
    },
    {
     "ukazka": "Zklonovaná oblast (zakryté auto) – metadata",
     "pravda": "nenalezena",
     "odhad": "nenalezena",
     "ok": true
    },
    {
     "ukazka": "Zklonovaná oblast (zakryté auto) – náhled EXIF",
     "pravda": "nelze",
     "odhad": "nelze",
     "ok": true
    },
    {
     "ukazka": "Zklonovaná oblast (zakryté auto) – dvojitá komprese",
     "pravda": "nalezena",
     "odhad": "nalezena",
     "ok": true
    },
    {
     "ukazka": "Metadata: software editoru – ELA",
     "pravda": "nenalezena",
     "odhad": "nenalezena",
     "ok": true
    },
    {
     "ukazka": "Metadata: software editoru – šum",
     "pravda": "nenalezena",
     "odhad": "nenalezena",
     "ok": true
    },
    {
     "ukazka": "Metadata: software editoru – klonování",
     "pravda": "nenalezena",
     "odhad": "nenalezena",
     "ok": true
    },
    {
     "ukazka": "Metadata: software editoru – metadata",
     "pravda": "nalezena",
     "odhad": "nalezena",
     "ok": true
    },
    {
     "ukazka": "Metadata: software editoru – náhled EXIF",
     "pravda": "nenalezena",
     "odhad": "nenalezena",
     "ok": true
    },
    {
     "ukazka": "Metadata: software editoru – dvojitá komprese",
     "pravda": "nalezena",
     "odhad": "nalezena",
     "ok": true
    },
    {
     "ukazka": "Zmenšeno bez úpravy EXIF – ELA",
     "pravda": "nenalezena",
     "odhad": "nenalezena",
     "ok": true
    },
    {
     "ukazka": "Zmenšeno bez úpravy EXIF – šum",
     "pravda": "nenalezena",
     "odhad": "nenalezena",
     "ok": true
    },
    {
     "ukazka": "Zmenšeno bez úpravy EXIF – klonování",
     "pravda": "nenalezena",
     "odhad": "nenalezena",
     "ok": true
    },
    {
     "ukazka": "Zmenšeno bez úpravy EXIF – metadata",
     "pravda": "nalezena",
     "odhad": "nalezena",
     "ok": true
    },
    {
     "ukazka": "Zmenšeno bez úpravy EXIF – náhled EXIF",
     "pravda": "nenalezena",
     "odhad": "nenalezena",
     "ok": true
    },
    {
     "ukazka": "Zmenšeno bez úpravy EXIF – dvojitá komprese",
     "pravda": "nenalezena",
     "odhad": "nenalezena",
     "ok": true
    },
    {
     "ukazka": "Náhled EXIF neodpovídá obsahu – ELA",
     "pravda": "nalezena",
     "odhad": "nenalezena",
     "ok": false
    },
    {
     "ukazka": "Náhled EXIF neodpovídá obsahu – šum",
     "pravda": "nalezena",
     "odhad": "nalezena",
     "ok": true
    },
    {
     "ukazka": "Náhled EXIF neodpovídá obsahu – klonování",
     "pravda": "nenalezena",
     "odhad": "nenalezena",
     "ok": true
    },
    {
     "ukazka": "Náhled EXIF neodpovídá obsahu – metadata",
     "pravda": "nenalezena",
     "odhad": "nenalezena",
     "ok": true
    },
    {
     "ukazka": "Náhled EXIF neodpovídá obsahu – náhled EXIF",
     "pravda": "nalezena",
     "odhad": "nalezena",
     "ok": true
    },
    {
     "ukazka": "Náhled EXIF neodpovídá obsahu – dvojitá komprese",
     "pravda": "nalezena",
     "odhad": "nalezena",
     "ok": true
    },
    {
     "ukazka": "Dvojitá komprese (60 → 85) – ELA",
     "pravda": "nenalezena",
     "odhad": "nenalezena",
     "ok": true
    },
    {
     "ukazka": "Dvojitá komprese (60 → 85) – šum",
     "pravda": "nenalezena",
     "odhad": "nenalezena",
     "ok": true
    },
    {
     "ukazka": "Dvojitá komprese (60 → 85) – klonování",
     "pravda": "nenalezena",
     "odhad": "nenalezena",
     "ok": true
    },
    {
     "ukazka": "Dvojitá komprese (60 → 85) – metadata",
     "pravda": "nenalezena",
     "odhad": "nenalezena",
     "ok": true
    },
    {
     "ukazka": "Dvojitá komprese (60 → 85) – náhled EXIF",
     "pravda": "nelze",
     "odhad": "nelze",
     "ok": true
    },
    {
     "ukazka": "Dvojitá komprese (60 → 85) – dvojitá komprese",
     "pravda": "nalezena",
     "odhad": "nalezena",
     "ok": true
    },
    {
     "ukazka": "Neupravená fotka z fotoaparátu (jiná scéna) – ELA",
     "pravda": "nenalezena",
     "odhad": "nenalezena",
     "ok": true
    },
    {
     "ukazka": "Neupravená fotka z fotoaparátu (jiná scéna) – šum",
     "pravda": "nenalezena",
     "odhad": "nenalezena",
     "ok": true
    },
    {
     "ukazka": "Neupravená fotka z fotoaparátu (jiná scéna) – klonování",
     "pravda": "nenalezena",
     "odhad": "nenalezena",
     "ok": true
    },
    {
     "ukazka": "Neupravená fotka z fotoaparátu (jiná scéna) – metadata",
     "pravda": "nenalezena",
     "odhad": "nenalezena",
     "ok": true
    },
    {
     "ukazka": "Neupravená fotka z fotoaparátu (jiná scéna) – náhled EXIF",
     "pravda": "nenalezena",
     "odhad": "nenalezena",
     "ok": true
    },
    {
     "ukazka": "Neupravená fotka z fotoaparátu (jiná scéna) – dvojitá komprese",
     "pravda": "nenalezena",
     "odhad": "nenalezena",
     "ok": true
    },
    {
     "ukazka": "Vložený objekt z jiného JPEG (jiná scéna) – ELA",
     "pravda": "nalezena",
     "odhad": "nalezena",
     "ok": true
    },
    {
     "ukazka": "Vložený objekt z jiného JPEG (jiná scéna) – šum",
     "pravda": "nalezena",
     "odhad": "nalezena",
     "ok": true
    },
    {
     "ukazka": "Vložený objekt z jiného JPEG (jiná scéna) – klonování",
     "pravda": "nenalezena",
     "odhad": "nenalezena",
     "ok": true
    },
    {
     "ukazka": "Vložený objekt z jiného JPEG (jiná scéna) – metadata",
     "pravda": "nenalezena",
     "odhad": "nenalezena",
     "ok": true
    },
    {
     "ukazka": "Vložený objekt z jiného JPEG (jiná scéna) – náhled EXIF",
     "pravda": "nelze",
     "odhad": "nelze",
     "ok": true
    },
    {
     "ukazka": "Vložený objekt z jiného JPEG (jiná scéna) – dvojitá komprese",
     "pravda": "nalezena",
     "odhad": "nalezena",
     "ok": true
    },
    {
     "ukazka": "Zklonovaná oblast (zakryté auto) (jiná scéna) – ELA",
     "pravda": "nalezena",
     "odhad": "nenalezena",
     "ok": false
    },
    {
     "ukazka": "Zklonovaná oblast (zakryté auto) (jiná scéna) – šum",
     "pravda": "nenalezena",
     "odhad": "nenalezena",
     "ok": true
    },
    {
     "ukazka": "Zklonovaná oblast (zakryté auto) (jiná scéna) – klonování",
     "pravda": "nalezena",
     "odhad": "nalezena",
     "ok": true
    },
    {
     "ukazka": "Zklonovaná oblast (zakryté auto) (jiná scéna) – metadata",
     "pravda": "nenalezena",
     "odhad": "nenalezena",
     "ok": true
    },
    {
     "ukazka": "Zklonovaná oblast (zakryté auto) (jiná scéna) – náhled EXIF",
     "pravda": "nelze",
     "odhad": "nelze",
     "ok": true
    },
    {
     "ukazka": "Zklonovaná oblast (zakryté auto) (jiná scéna) – dvojitá komprese",
     "pravda": "nalezena",
     "odhad": "nalezena",
     "ok": true
    },
    {
     "ukazka": "Metadata: software editoru (jiná scéna) – ELA",
     "pravda": "nenalezena",
     "odhad": "nenalezena",
     "ok": true
    },
    {
     "ukazka": "Metadata: software editoru (jiná scéna) – šum",
     "pravda": "nenalezena",
     "odhad": "nenalezena",
     "ok": true
    },
    {
     "ukazka": "Metadata: software editoru (jiná scéna) – klonování",
     "pravda": "nenalezena",
     "odhad": "nenalezena",
     "ok": true
    },
    {
     "ukazka": "Metadata: software editoru (jiná scéna) – metadata",
     "pravda": "nalezena",
     "odhad": "nalezena",
     "ok": true
    },
    {
     "ukazka": "Metadata: software editoru (jiná scéna) – náhled EXIF",
     "pravda": "nenalezena",
     "odhad": "nenalezena",
     "ok": true
    },
    {
     "ukazka": "Metadata: software editoru (jiná scéna) – dvojitá komprese",
     "pravda": "nalezena",
     "odhad": "nalezena",
     "ok": true
    },
    {
     "ukazka": "Zmenšeno bez úpravy EXIF (jiná scéna) – ELA",
     "pravda": "nenalezena",
     "odhad": "nenalezena",
     "ok": true
    },
    {
     "ukazka": "Zmenšeno bez úpravy EXIF (jiná scéna) – šum",
     "pravda": "nenalezena",
     "odhad": "nenalezena",
     "ok": true
    },
    {
     "ukazka": "Zmenšeno bez úpravy EXIF (jiná scéna) – klonování",
     "pravda": "nenalezena",
     "odhad": "nenalezena",
     "ok": true
    },
    {
     "ukazka": "Zmenšeno bez úpravy EXIF (jiná scéna) – metadata",
     "pravda": "nalezena",
     "odhad": "nalezena",
     "ok": true
    },
    {
     "ukazka": "Zmenšeno bez úpravy EXIF (jiná scéna) – náhled EXIF",
     "pravda": "nenalezena",
     "odhad": "nenalezena",
     "ok": true
    },
    {
     "ukazka": "Zmenšeno bez úpravy EXIF (jiná scéna) – dvojitá komprese",
     "pravda": "nenalezena",
     "odhad": "nenalezena",
     "ok": true
    },
    {
     "ukazka": "Náhled EXIF neodpovídá obsahu (jiná scéna) – ELA",
     "pravda": "nalezena",
     "odhad": "nenalezena",
     "ok": false
    },
    {
     "ukazka": "Náhled EXIF neodpovídá obsahu (jiná scéna) – šum",
     "pravda": "nalezena",
     "odhad": "nalezena",
     "ok": true
    },
    {
     "ukazka": "Náhled EXIF neodpovídá obsahu (jiná scéna) – klonování",
     "pravda": "nenalezena",
     "odhad": "nenalezena",
     "ok": true
    },
    {
     "ukazka": "Náhled EXIF neodpovídá obsahu (jiná scéna) – metadata",
     "pravda": "nenalezena",
     "odhad": "nenalezena",
     "ok": true
    },
    {
     "ukazka": "Náhled EXIF neodpovídá obsahu (jiná scéna) – náhled EXIF",
     "pravda": "nalezena",
     "odhad": "nalezena",
     "ok": true
    },
    {
     "ukazka": "Náhled EXIF neodpovídá obsahu (jiná scéna) – dvojitá komprese",
     "pravda": "nalezena",
     "odhad": "nalezena",
     "ok": true
    },
    {
     "ukazka": "Dvojitá komprese (60 → 85) (jiná scéna) – ELA",
     "pravda": "nenalezena",
     "odhad": "nalezena",
     "ok": false
    },
    {
     "ukazka": "Dvojitá komprese (60 → 85) (jiná scéna) – šum",
     "pravda": "nenalezena",
     "odhad": "nenalezena",
     "ok": true
    },
    {
     "ukazka": "Dvojitá komprese (60 → 85) (jiná scéna) – klonování",
     "pravda": "nenalezena",
     "odhad": "nenalezena",
     "ok": true
    },
    {
     "ukazka": "Dvojitá komprese (60 → 85) (jiná scéna) – metadata",
     "pravda": "nenalezena",
     "odhad": "nenalezena",
     "ok": true
    },
    {
     "ukazka": "Dvojitá komprese (60 → 85) (jiná scéna) – náhled EXIF",
     "pravda": "nelze",
     "odhad": "nelze",
     "ok": true
    },
    {
     "ukazka": "Dvojitá komprese (60 → 85) (jiná scéna) – dvojitá komprese",
     "pravda": "nalezena",
     "odhad": "nalezena",
     "ok": true
    }
   ],
   "velicina": "indicie podle typu analýzy (nalezena / nenalezena / nelze posoudit); u ELA, šumu a klonu musí oblast ležet v upravené části, u klonu sedět posun ±2 px (až na znaménko – metoda neurčí, která oblast je originál)",
   "poznamka": "Pokryto: rozbor skutečných bajtů JPEG (markery, DQT, EXIF, XMP, náhled), pravidla metadat, ELA, šum, copy-move, dvojitá komprese a porovnání náhledu – na 7 typech úprav ve dvou sadách scén. Nepokryto: skutečné fotografie a fotoaparáty, skutečné editory a jejich kodéry (zde všechny soubory zapsal vlastní kodér 4:4:4 se standardními Huffmanovými tabulkami; skutečné soubory mívají 4:2:0, progresivní zápis, MPF), sociální sítě, pokročilé úpravy (převzorkování, přidaný šum, AI). Pixely v node = rekonstrukce kodéru, v prohlížeči je dekóduje prohlížeč (rozdíl ±1–3 úrovně). Prahy automatických indicií byly nastaveny na galerii (varianta 0) a variantách 1–3; „jiná scéna“ (varianta 5) je mimo ladicí sadu. Selhání ponechaná v tabulce: ELA nevidí kopii z téhož obrázku (stejná historie komprese – posun mimo mřížku 8×8 nestačí) ani hladkou výplň (ukázka Náhled EXIF) a u dvojité komprese 60 → 85 dává na části scén falešnou oblast.",
   "souhrn": {
    "n": 84,
    "spravne": 79
   }
  },
  "stret_vozidel": {
   "druh": "cislo",
   "velicina": "rychlost vozidla před střetem",
   "jednotka": "km/h",
   "interval": "Odhad = výpočet ze středů zadaných rozsahů; interval = 2,5–97,5 % Monte Carlo z rovnoměrně vzorkovaných mezí vstupů (± úhly, dojezdy, hmotnosti, rozsah f a μ).",
   "poznamka": "Ukázky jsou syntetické a vznikly modelem, který je vůči nástroji jen „o krok jiný“ (ráz s restitucí místo samotné hybnosti, jinak tatáž přímočará fyzika dojezdu). Ověřují tedy hlavně výpočet a chování intervalu, ne přesnost metody na skutečných nehodách, kde rozhoduje rotace vozidel, poloha těžišť, skutečné f a přesnost změřených konečných poloh. Najetí zezadu: rychlost B je zadaná jako známý rozsah 15–25 km/h, takže řádek B jen opakuje vstup (bez něj je úloha při rovnoběžných směrech neřešitelná). Nákladní auto a osobní auto: rychlost lehkého vozidla vychází s velmi širokým intervalem (řádově 10–100 km/h) – pravda v něm leží, ale výsledek je prakticky nepoužitelný; to je skutečná vlastnost metody při velkém poměru hmotností, ne chyba výpočtu. MIMO MODEL (náraz B do sloupu během dojezdu, zastaví se po 45 % volné dráhy): nástroj považuje celý dojezd za brzdný, podcení rychlost B po střetu a tím i rychlosti obou vozidel před střetem – pravda leží nad intervalem (✗) u obou vozidel. Selhání se nemaskuje; v praxi se dojezd s nárazem do překážky do výpočtu hybnosti nepoužije.",
   "radky": [
    {
     "ukazka": "Čelní šikmý střet – A osobní",
     "pravda": 74,
     "odhad": 75.29,
     "od": 67.96,
     "do": 83.56,
     "chyba": 1.29,
     "ok": true
    },
    {
     "ukazka": "Čelní šikmý střet – B osobní",
     "pravda": 52,
     "odhad": 53.89,
     "od": 47.3,
     "do": 61.27,
     "chyba": 1.89,
     "ok": true
    },
    {
     "ukazka": "Boční střet v křižovatce – A osobní",
     "pravda": 48,
     "odhad": 48.32,
     "od": 41.67,
     "do": 54.7,
     "chyba": 0.32,
     "ok": true
    },
    {
     "ukazka": "Boční střet v křižovatce – B osobní",
     "pravda": 46,
     "odhad": 45.31,
     "od": 39.77,
     "do": 50.7,
     "chyba": -0.69,
     "ok": true
    },
    {
     "ukazka": "Najetí zezadu – A osobní",
     "pravda": 63,
     "odhad": 65.21,
     "od": 51.35,
     "do": 77.08,
     "chyba": 2.21,
     "ok": true
    },
    {
     "ukazka": "Najetí zezadu – B osobní (rychlost zadána jako známá)",
     "pravda": 20,
     "odhad": 20,
     "od": 15.26,
     "do": 24.75,
     "chyba": 0,
     "ok": true
    },
    {
     "ukazka": "Nákladní auto a osobní auto – A nákladní",
     "pravda": 42,
     "odhad": 41.63,
     "od": 37.52,
     "do": 45.47,
     "chyba": -0.37,
     "ok": true
    },
    {
     "ukazka": "Nákladní auto a osobní auto – B osobní",
     "pravda": 36,
     "odhad": 48.71,
     "od": 6.29,
     "do": 96.79,
     "chyba": 12.71,
     "ok": true
    },
    {
     "ukazka": "Šikmý střet z kopce na mokru – A osobní",
     "pravda": 58,
     "odhad": 57.88,
     "od": 50.12,
     "do": 66.44,
     "chyba": -0.12,
     "ok": true
    },
    {
     "ukazka": "Šikmý střet z kopce na mokru – B dodávka",
     "pravda": 44,
     "odhad": 45.34,
     "od": 39.8,
     "do": 51.61,
     "chyba": 1.34,
     "ok": true
    },
    {
     "ukazka": "MIMO MODEL: náraz do sloupu při dojezdu – A osobní",
     "pravda": 55,
     "odhad": 45.33,
     "od": 41.05,
     "do": 49.73,
     "chyba": -9.67,
     "ok": false
    },
    {
     "ukazka": "MIMO MODEL: náraz do sloupu při dojezdu – B osobní",
     "pravda": 50,
     "odhad": 43.24,
     "od": 38.78,
     "do": 47.96,
     "chyba": -6.76,
     "ok": false
    }
   ],
   "souhrn": {
    "n": 12,
    "pokryto": 10,
    "mae": 3.1142,
    "sirka": 19.433
   }
  },
  "vazby_analyza": {
   "druh": "cislo",
   "radky": [
    {
     "ukazka": "Hvězda K₁,4: mezilehlost středu (= 1)",
     "pravda": 1,
     "odhad": 1,
     "od": null,
     "do": null,
     "chyba": 0,
     "ok": null
    },
    {
     "ukazka": "Hvězda K₁,4: mezilehlost listu (= 0)",
     "pravda": 0,
     "odhad": 0,
     "od": null,
     "do": null,
     "chyba": 0,
     "ok": null
    },
    {
     "ukazka": "Hvězda K₁,4: stupeň středu (= n − 1)",
     "pravda": 4,
     "odhad": 4,
     "od": null,
     "do": null,
     "chyba": 0,
     "ok": null
    },
    {
     "ukazka": "Hvězda K₁,7: mezilehlost středu (= 1)",
     "pravda": 1,
     "odhad": 1,
     "od": null,
     "do": null,
     "chyba": 0,
     "ok": null
    },
    {
     "ukazka": "Hvězda K₁,7: mezilehlost listu (= 0)",
     "pravda": 0,
     "odhad": 0,
     "od": null,
     "do": null,
     "chyba": 0,
     "ok": null
    },
    {
     "ukazka": "Hvězda K₁,7: stupeň středu (= n − 1)",
     "pravda": 7,
     "odhad": 7,
     "od": null,
     "do": null,
     "chyba": 0,
     "ok": null
    },
    {
     "ukazka": "Cesta P5: mezilehlost 2. vrcholu ((i−1)(n−i)/C(n−1,2))",
     "pravda": 0.5,
     "odhad": 0.5,
     "od": null,
     "do": null,
     "chyba": 0,
     "ok": null
    },
    {
     "ukazka": "Cesta P5: mezilehlost 3. vrcholu ((i−1)(n−i)/C(n−1,2))",
     "pravda": 0.666667,
     "odhad": 0.666667,
     "od": null,
     "do": null,
     "chyba": 0,
     "ok": null
    },
    {
     "ukazka": "Cesta P7: mezilehlost 4. vrcholu ((i−1)(n−i)/C(n−1,2))",
     "pravda": 0.6,
     "odhad": 0.6,
     "od": null,
     "do": null,
     "chyba": 0,
     "ok": null
    },
    {
     "ukazka": "Cesta P7: mezilehlost 1. vrcholu ((i−1)(n−i)/C(n−1,2))",
     "pravda": 0,
     "odhad": 0,
     "od": null,
     "do": null,
     "chyba": 0,
     "ok": null
    },
    {
     "ukazka": "Kružnice C5: mezilehlost ((n−1)(n−3)/8 / C(n−1,2))",
     "pravda": 0.166667,
     "odhad": 0.166667,
     "od": null,
     "do": null,
     "chyba": 0,
     "ok": null
    },
    {
     "ukazka": "Kružnice C6: mezilehlost ((n−2)²/8 / C(n−1,2))",
     "pravda": 0.2,
     "odhad": 0.2,
     "od": null,
     "do": null,
     "chyba": 0,
     "ok": null
    },
    {
     "ukazka": "Kružnice C9: mezilehlost ((n−1)(n−3)/8 / C(n−1,2))",
     "pravda": 0.214286,
     "odhad": 0.214286,
     "od": null,
     "do": null,
     "chyba": 0,
     "ok": null
    },
    {
     "ukazka": "Úplný graf K5: mezilehlost (= 0)",
     "pravda": 0,
     "odhad": 0,
     "od": null,
     "do": null,
     "chyba": 0,
     "ok": null
    },
    {
     "ukazka": "Úplný graf K5: stupeň (= n − 1)",
     "pravda": 4,
     "odhad": 4,
     "od": null,
     "do": null,
     "chyba": 0,
     "ok": null
    },
    {
     "ukazka": "Motýlek (2 trojúhelníky, společný vrchol): střed = 4/6",
     "pravda": 0.666667,
     "odhad": 0.666667,
     "od": null,
     "do": null,
     "chyba": 0,
     "ok": null
    },
    {
     "ukazka": "Motýlek: stupeň středu (= 4)",
     "pravda": 4,
     "odhad": 4,
     "od": null,
     "do": null,
     "chyba": 0,
     "ok": null
    },
    {
     "ukazka": "Trojúhelníky spojené mostem: konec mostu = 6/10",
     "pravda": 0.6,
     "odhad": 0.6,
     "od": null,
     "do": null,
     "chyba": 0,
     "ok": null
    },
    {
     "ukazka": "Kolo (střed + C6): mezilehlost středu = (6·½ + 3)/15",
     "pravda": 0.4,
     "odhad": 0.4,
     "od": null,
     "do": null,
     "chyba": 0,
     "ok": null
    },
    {
     "ukazka": "Cesta P6: konec–konec (= n − 1 kroků)",
     "pravda": 5,
     "odhad": 5,
     "od": null,
     "do": null,
     "chyba": 0,
     "ok": null
    },
    {
     "ukazka": "Kružnice C8: protilehlé vrcholy (= n/2 kroků)",
     "pravda": 4,
     "odhad": 4,
     "od": null,
     "do": null,
     "chyba": 0,
     "ok": null
    },
    {
     "ukazka": "Mřížka 4 × 4: roh–roh (= 3 + 3 kroků)",
     "pravda": 6,
     "odhad": 6,
     "od": null,
     "do": null,
     "chyba": 0,
     "ok": null
    },
    {
     "ukazka": "Nejsilnější cesta: min(3/5, 2/1) = 0,6",
     "pravda": 0.6,
     "odhad": 0.6,
     "od": null,
     "do": null,
     "chyba": 0,
     "ok": null
    },
    {
     "ukazka": "Táž síť, nejméně kroků (A–E–D = 2)",
     "pravda": 2,
     "odhad": 2,
     "od": null,
     "do": null,
     "chyba": 0,
     "ok": null
    }
   ],
   "velicina": "normalizovaná mezilehlost (0–1), stupeň, délka nejkratší cesty (kroky) nebo její cena Σ 1/síla",
   "jednotka": "",
   "interval": "Interval se neuvádí: výpočet je deterministický a přesný, nejistota nevzniká z dat – značka ✓/✗ „pravda v intervalu“ tu proto nemá význam, rozhoduje sloupec Chyba, který má být 0.",
   "poznamka": "Pravda je spočtená z analytických vzorců pro hvězdu, cestu, kružnici, úplný graf, motýlek, kolo a mřížku (Freeman 1977; normalizace dělením počtem dvojic ostatních vrcholů (n−1)(n−2)/2), ne z jádra nástroje. Ověřuje se tím jen správnost implementace (Brandesův algoritmus, BFS, Dijkstra). Co metriky znamenají ve skutečné síti, záleží na úplnosti dat – chybějící vazba může mezilehlost zcela změnit.",
   "souhrn": {
    "n": 24,
    "pokryto": 0,
    "mae": 0,
    "sirka": null
   }
  },
  "vyska_z_fotky": {
   "druh": "cislo",
   "velicina": "tělesná výška osoby",
   "jednotka": "cm",
   "interval": "95% interval = 2,5. až 97,5. percentil 2000 vzorků Monte Carlo (šum kliknutí, úběžníky, reference, korekce postoje/obuvi, k1), seed 12345 jako ve stránce.",
   "poznamka": "Ukázky jsou spočtené tak, jak se načtou – včetně záměrných chyb, které má uživatel v galerii najít: „Širokoúhlá kamera“ má zadané k1 = 0 místo skutečných 0,22 a „Tři reference“ chybnou výšku dveří (210 místo 197 cm). Systematickou chybu vstupu interval Monte Carlo nezahrnuje (u zkreslení je odhad o 4 cm nízko a pravda leží jen na samém okraji intervalu; chybnou referenci zčásti tlumí vážená kombinace s ostatními). Po opravě podle úkolů ukázky se odhad k pravdě přiblíží. Vynecháno (bez zakreslených čar, měří uživatel sám): Cvičení – změřte sami.",
   "radky": [
    {
     "ukazka": "Chodba se dveřmi – základní postup",
     "pravda": 180,
     "odhad": 180.47,
     "od": 178.45,
     "do": 182.49,
     "chyba": 0.47,
     "ok": true
    },
    {
     "ukazka": "Širokoúhlá kamera – oprava zkreslení",
     "pravda": 172,
     "odhad": 167.58,
     "od": 163.39,
     "do": 172.12,
     "chyba": -4.42,
     "ok": true
    },
    {
     "ukazka": "Tři reference, jedna chybná",
     "pravda": 168,
     "odhad": 169.5,
     "od": 166.83,
     "do": 172.05,
     "chyba": 1.5,
     "ok": true
    },
    {
     "ukazka": "Chůze, obuv a čepice – korekce postoje",
     "pravda": 178,
     "odhad": 178.49,
     "od": 174.54,
     "do": 182.53,
     "chyba": 0.49,
     "ok": true
    },
    {
     "ukazka": "Tři snímky jedné osoby – sloučení",
     "pravda": 185,
     "odhad": 184.9,
     "od": 182.86,
     "do": 186.84,
     "chyba": -0.1,
     "ok": true
    },
    {
     "ukazka": "Parkoviště – porovnání s podezřelými – Pachatel (A)",
     "pravda": 181,
     "odhad": 182.95,
     "od": 176.55,
     "do": 189.28,
     "chyba": 1.95,
     "ok": true
    },
    {
     "ukazka": "Parkoviště – porovnání s podezřelými – Svědkyně (B)",
     "pravda": 165,
     "odhad": 164.9,
     "od": 158.51,
     "do": 171.19,
     "chyba": -0.1,
     "ok": true
    },
    {
     "ukazka": "Modelový případ 17/2026 – řidič u stojanu",
     "pravda": 187,
     "odhad": 188.9,
     "od": 183.55,
     "do": 194.41,
     "chyba": 1.9,
     "ok": true
    }
   ],
   "souhrn": {
    "n": 8,
    "pokryto": 8,
    "mae": 1.3662,
    "sirka": 8.279
   }
  }
 }
};

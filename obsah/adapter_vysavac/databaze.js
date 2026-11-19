/* Adaptér nářadí → vysavač – rozměrová databáze vývodů nářadí a koncovek hadic vysavačů.
   VŠECHNY ROZMĚRY JSOU TYPICKÉ (sestaveno 19. 11. 2026 z obecně uváděných hodnot, ne z ověřeného měření
   ani výkresů výrobců) – před tiskem je nutné ověřit posuvkou. Výrobci rozměry mezi generacemi mění.

   Položka: typ 'vnejsi' = protikus je ČEP (měří se vnější Ø, adaptér se na něj nasouvá – hrdlo),
            typ 'vnitrni' = protikus je HRDLO (měří se vnitřní Ø, adaptér se do něj zasouvá – čep).
   d0 = Ø u ústí / u kořene čepu (větší), d1 = Ø v hloubce L (menší – kužel), L = délka zasunutí (mm).
   spoj (nepovinné) = doporučený druh spoje, stoupani/hloubka = šroubovací vlnitá hadice. */
(function () {
  'use strict';
  const DATUM = '19. 11. 2026';
  const POZNAMKA = 'typické – ověřit měřením';
  const n = (id, skupina, znacka, nazev, typ, d0, d1, L, navic) => Object.assign({ id, druh: 'naradi', skupina, znacka, nazev, typ, d0, d1, L }, navic || {});
  const h = (id, skupina, znacka, nazev, typ, d0, d1, L, navic) => Object.assign({ id, druh: 'hadice', skupina, znacka, nazev, typ, d0, d1, L }, navic || {});
  const POLOZKY = [
    // ---- nářadí: vývody odsávání ----
    n('festool_d27', 'Brusky a frézky', 'Festool', 'brusky ETS / ETS EC / RTS / DTS, frézka OF 1010 (vývod pro hadici D27)', 'vnitrni', 29, 27.5, 25, { pozn: 'hadicová koncovka se zasouvá do vývodu' }),
    n('festool_d36', 'Pily', 'Festool', 'ponorné pily TS 55 / TS 75, frézka OF 1400, Kapex (vývod D36)', 'vnitrni', 37, 35.5, 30, { pozn: 'hadicová koncovka se zasouvá do vývodu' }),
    n('makita_bo', 'Brusky a frézky', 'Makita', 'excentrické brusky BO5031 / BO5041 (vývod bez sáčku)', 'vnejsi', 35, 33.5, 25),
    n('makita_hs', 'Pily', 'Makita', 'kotoučové pily HS6601 / HS7601 / 5008MG', 'vnejsi', 35.5, 34.5, 30),
    n('makita_rt', 'Brusky a frézky', 'Makita', 'horní frézka RT0700 – odsávací nástavec', 'vnejsi', 24.5, 24, 20),
    n('makita_kp', 'Hoblíky', 'Makita', 'hoblíky KP0800 / KP0810 (výhoz třísek)', 'vnejsi', 35, 34, 25),
    n('bosch_modra', 'Pily', 'Bosch', 'modrá řada GKS / GEX / GSS / GOF (vývod 35 mm)', 'vnejsi', 35, 34, 30),
    n('bosch_zelena', 'Brusky a frézky', 'Bosch', 'zelená řada – brusky PEX / PSS / PSM (vývod bez prachového boxu)', 'vnejsi', 26.5, 25.5, 20),
    n('bosch_pho', 'Hoblíky', 'Bosch', 'hoblíky PHO / GHO (výhoz třísek)', 'vnejsi', 35, 34, 25),
    n('metabo_sxe', 'Brusky a frézky', 'Metabo', 'excentrické brusky SXE / SRE', 'vnejsi', 28, 27, 22),
    n('metabo_ks', 'Pily', 'Metabo', 'kotoučové a pokosové pily KS / KGS (vývod 35 mm)', 'vnejsi', 35, 34.5, 30),
    n('dewalt_bruska', 'Brusky a frézky', 'DeWalt', 'excentrické brusky DWE6423 / DCW210', 'vnejsi', 32, 31.5, 25),
    n('dewalt_25', 'Pily', 'DeWalt', 'stolní a pokosové pily – vývod 2½″', 'vnejsi', 63.5, 62.5, 35),
    n('einhell_35', 'Pily', 'Einhell', 'pily a brusky s vývodem 35 mm', 'vnejsi', 35, 34, 25),
    n('parkside_pexs', 'Brusky a frézky', 'Parkside', 'excentrické brusky PEXS', 'vnejsi', 32, 31, 22),
    n('parkside_hoblik', 'Hoblíky', 'Parkside', 'hoblík PEH (výhoz třísek)', 'vnejsi', 35, 34, 25),
    // ---- vysavače a hadice: koncovky ----
    h('karcher_wd', 'Kärcher', 'Kärcher', 'WD – konec hadice / trubka DN 35', 'vnejsi', 35.5, 34.5, 40),
    h('karcher_nt', 'Kärcher', 'Kärcher', 'NT – koncovka C-DN-35', 'vnejsi', 35, 34.5, 40),
    h('festool_d27h', 'Festool', 'Festool', 'CT – hadice D27, kónická koncovka do nářadí', 'vnejsi', 31, 27, 32),
    h('festool_d36h', 'Festool', 'Festool', 'CT – hadice D36, kónická koncovka do nářadí', 'vnejsi', 39.5, 35.5, 32),
    h('makita_vc24', 'Makita', 'Makita', 'VC – kónická koncovka 24 mm do nářadí', 'vnejsi', 28, 24, 30),
    h('makita_vc38', 'Makita', 'Makita', 'VC – koncovka hadice 38 mm', 'vnejsi', 38, 37, 35),
    h('nilfisk_attix', 'Nilfisk', 'Nilfisk', 'Attix – hadice 36 mm', 'vnejsi', 36, 35, 35),
    h('nilfisk_aero', 'Nilfisk', 'Nilfisk', 'Aero – hadice 32 mm', 'vnejsi', 32, 31.5, 35),
    h('bosch_gas', 'Bosch', 'Bosch', 'GAS – koncovka hadice 35 mm', 'vnejsi', 35, 34, 35),
    h('parkside_pnts', 'Parkside', 'Parkside', 'PNTS – koncovka hadice 35 mm', 'vnejsi', 35, 34, 35),
    h('std32', 'Standard', '', 'trubka 32 mm (domácí vysavač) – konec trubky', 'vnejsi', 32, 31.5, 45),
    h('std32_hrdlo', 'Standard', '', 'hrdlo příslušenství 32 mm (hubice, kartáč)', 'vnitrni', 32.6, 32, 40),
    h('std35', 'Standard', '', 'trubka 35 mm (dílenský vysavač) – konec trubky', 'vnejsi', 35, 34.5, 45),
    h('std38', 'Standard', '', 'trubka 38 mm – konec trubky', 'vnejsi', 38, 37.5, 45),
    h('shopvac_25', 'Standard', 'Shop-Vac', 'koncovka hadice 2½″', 'vnejsi', 58, 57, 45),
    h('vlnita32', 'Standard', '', 'vlnitá hadice 32 mm – šroubovací konec (bez koncovky)', 'vnitrni', 32, 32, 30, { spoj: 'zavit', stoupani: 6, hloubka: 2, pozn: 'stoupání = rozteč vln hadice' }),
  ];
  const API = { DATUM, POZNAMKA, POLOZKY, najdi: id => POLOZKY.find(x => x.id === id) || null };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else window.ADVYS_DB = API;
})();

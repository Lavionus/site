# 💼 Volná místa – plán

Stránka `obsah/prace.html` + `obsah/prace/` (jádro `PRACE_JADRO`, data `obsah/prace/data/`).
Prohlížeč volných pracovních míst z otevřených dat MPSV / Úřadu práce ČR. Bez backendu,
osobní data (oblíbené, uložená hledání, přihlášky) jen v prohlížeči.

## Zdroje

- **Hlavní:** `https://data.mpsv.cz/od/soubory/volna-mista/volna-mista.json` (≈186 MB, bez komprese,
  CORS `*`, 1× denně, ≈40 tis. inzerátů / 105 tis. míst), schéma `…/volna-mista.schema.json`,
  stránka sady <https://data.mpsv.cz/web/data/volna-mista-za-celou-cr>.
- **Číselníky:** `https://data.mpsv.cz/od/soubory/ciselniky/<jmeno>.json` (okresy, obce, kraje, cz-isco,
  smennosti, vzdelani-detailni-kategorie, pracovnepravni-vztahy, vhodnosti-pro-typ-zamestnance,
  vyhody-volneho-mista, dovednosti, jazyky, urovne-znalosti-jazyka, kontaktni-pracoviste,
  typy-mzdy, typy-mista-vykonu-prace, obory-cinnosti-pro-vm).
- **Souřadnice:** RÚIAN adresní místa CSV z ČÚZK
  `https://vdp.cuzk.gov.cz/vymenny_format/csv/<RRRRMMDD>_OB_ADR_csv.zip` (poslední den předch. měsíce,
  S-JTSK → WGS84 vlastním převodem v `tools/prace_krovak.py`); střed obce = průměr jejích adres.
- Anonymní inzeráty (`ZverejnovatVpm/anosp`) nemají zaměstnavatele ani místo → hlásit se přes ÚP.
- Přímý odkaz na detail na portálu ÚP neověřen (SPA) → v detailu ref. číslo + odkaz na vyhledávání ÚP.

## Obnova dat

Varianta (b) + (c): autor před uploadem spustí `python3 tools/prace_data.py` (stáhne, zpracuje,
zapíše `obsah/prace/data/`), stránka ukazuje datum dat a varuje, jsou-li starší 3 dnů.
Volitelně (c) „čerstvá data“ přímo v prohlížeči (Worker projde 186 MB) – etapa 8.

## Formát dat (`obsah/prace/data/`)

- `meta.json` – datum, počty, číselníky, CZ-ISCO (použité kódy + předci), kraje, okresy se středy.
- `obce.json` – všechny obce `[kod, nazev, okres, lat, lon]` (výběr domova + polohy obcí).
- `mista.json` – pole řádků, jeden kompaktní řádek na inzerát (pořadí sloupců v `meta.pole`, bez dlouhých textů).
- `detail/NN.json` – texty, kontakty, popisy výhod/dovedností; dávka = `portalId % 64`.

## Stav (5. 11. 2026)

Etapy 1–5 hotové. Testy: `node _test/prace_test.js`, `python3 _test/prace_ui.py` (snímky `_test/prace_*.png`).
Data v gitu ≈ 38 MB (při každé obnově se mění většina dávek detailu → repozitář roste o ~10 MB za obnovu).

## Etapy

- [x] 1. `tools/prace_data.py` + `tools/prace_krovak.py`, data v `obsah/prace/data/`, kontrola velikostí.
- [x] 2. `obsah/prace/jadro.js` (`PRACE_JADRO`): načtení řádků, přepočet mzdy (hodinová → měsíční),
      filtry, řazení, vzdálenost, stav filtru ⇄ URL; test `_test/prace_test.js`.
- [x] 3. `obsah/prace.html`: horní lišta s nabídkami, panel filtrů, seznam (stránkování), mobil + obě témata.
- [x] 4. Detail inzerátu: dávka detailu, kontakt, výhody, dovednosti, jazyky, odkazy (URL firmy, ÚP),
      čistá mzda (`net_salary.html`), sdílení odkazu.
- [x] 5. Mapa (Leaflet z `obsah/lib/leaflet`, vlastní shlukování), okruh od domova.
- [ ] 6. Moje: oblíbené, skryté, uložená hledání + „N nových od minula“, přihlášky (stav, poznámka, termín).
- [ ] 7. Přehledy trhu: počty a mediány mezd podle oboru/profese/okresu, nejžádanější dovednosti.
- [ ] 8. Doplňky: čerstvá data v prohlížeči (Worker), (odkazy na Jobs.cz/Profesia/LinkedIn/Indeed už jsou v „O datech“),
      sledované firmy přes veřejná ATS API (Greenhouse, Lever, Recruitee…), práce na dálku (Remotive, Arbeitnow).
- [ ] 9. Revize, `_test/prace_ui.py`, `apps.js` (`"stav": "vyvoj"`, `jen_cs`), ikony, `sw.js`, README.

# Fotokniha – návrhář fotoknih (plán po etapách)

Stránka `obsah/fotokniha.html` + moduly `obsah/fotokniha/`.
„pokračuj" = vzít první neodškrtnutou etapu.

## Zásady

- **Model v milimetrech.** Kniha = formát (ořezový rozměr strany), spadávka, bezpečná zóna,
  vazba a pole dvoustran. Souřadnice prvků jsou v mm v soustavě dvoustrany
  (x zleva od ořezu levé strany, y shora od ořezu). Náhled i tisk se z modelu jen vykreslují.
- **Dvoustrany:** n dvoustran = 2n − 2 tištěných stran. Levá polovina 1. dvoustrany a pravá
  polovina poslední jsou vnitřek desek (netisknou se). Strana 1 = vpravo na 1. dvoustraně.
- **Fotka v rámečku** vyplňuje rámeček (cover) × `zoom`, střed výřezu `cx, cy` (0–1).
  Účinné DPI = px výřezu / palce rámečku.
- **Tisk bez ztráty:** do PDF jde originální JPEG beze změny (výřez = ořezová cesta,
  EXIF orientace = transformační matice). Jiné formáty se při importu převedou na JPEG 95 %.
- **Data:** IndexedDB `webapp_fotokniha` (knihy jako JSON, fotky jako bloby: originál + náhled 1600 px).
- Moduly: `jadro.js` (FOTOKNIHA – bez DOM, test v node), `uloziste.js` (FK_ULOZ),
  `editor.js` (UI). Z `pdf_dilna/jadro.js` se bere `exifOrientace` a `zip`.

## Etapy

- [x] **1. Jádro a tisknutelná kniha** – formáty, nová kniha, projekty v IndexedDB,
  import fotek (náhledy), šuplík, editor dvoustrany (rámečky: přesun, změna velikosti,
  přichytávání, výřez fotky posunem a zoomem), předlohy rozvržení stránky i dvoustrany,
  pozadí, vodítka (ořez, spadávka, bezpečná zóna, hřbet), hlídání DPI, kontrola před tiskem,
  export PDF po stranách / po dvoustranách (TrimBox, BleedBox, volitelně ořezové značky),
  JPEG 300 DPI po dvoustranách v ZIPu, zpět/znovu, správa dvoustran.
  Testy `_test/fotokniha_test.js` (node) a `_test/fotokniha_ui.py`.
- [x] **2. Automatika a šuplík** – EXIF datum pořízení, řazení šuplíku (přidání / datum / název),
  filtr nepoužitých, automatické rozvržení (1–4 nebo střídavě, podle orientace, jen prázdné strany),
  prohození fotek (tlačítko ⇄ nebo Shift + tažení).
- [x] **3. Text a obálka** – textová pole (16 písem TTF, zalomení podle metrik fontkitu = shodně
  náhled / PDF / JPEG, zarovnání, svisle, otočení 90°/270° pro hřbet), čísla stran (vypnutelná po dvoustranách),
  obálka = zadní deska | hřbet | přední deska (měkká / tvrdé desky, hřbet z počtu stran a tloušťky listu
  nebo ručně, přesah), export PDF obálky se značkami ohybu, lem kolem fotky.
- [x] **4. Dotažení** – záloha projektu do ZIPu a obnova (nová id), paleta Ctrl+K, kopírovat/vložit prvek,
  duplikovat dvoustranu, přiblížení plochy (Ctrl+kolečko), náhled knihy, kontrola textů (přetečení,
  bezpečná zóna, ohyb hřbetu) a prázdných stran, i18n.
- [ ] **5. Možná dál** – předvolby konkrétních tiskáren (nutno ověřit aktuální podmínky), více prvků
  najednou (výběr obdélníkem, zarovnání), filtry fotek (ČB/sepie – v PDF by znamenaly přepočet JPEG).

## Jak nechat vytisknout (shrnutí do nápovědy)

1. Služby přijímající PDF (Blurb, Lulu, Saal Digital u vybraných produktů) – rozměry dle jejich předlohy.
2. Místní digitální tiskárna / knihařství – PDF se spadávkou a ořezovými značkami, vazba V2/V8/lay-flat.
3. Fotolab – JPEG dvoustran 300 DPI sRGB, slepení do alba.

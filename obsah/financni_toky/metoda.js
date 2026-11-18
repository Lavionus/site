/* Finanční toky – obsah panelu „📐 Metoda, literatura, meze“ (vysetrovani/metoda.js) */
MetodaPanel.nastav({
  nastroj: 'financni_toky',
  princip: [
    'Výpisy se načtou jako CSV: kódování (UTF-8 se pozná podle platnosti, jinak windows-1250), oddělovač podle nejčastějšího stejného počtu polí na řádku, řádek hlavičky podle známých názvů sloupců, desetinný oddělovač podle tvaru částek. Čísla účtů se sjednotí na tuzemský tvar „předčíslí-číslo/banka“ (CZ IBAN se převede).',
    'Duplicita = transakce téhož účtu se stejným dnem, částkou, protiúčtem, VS a zprávou ve dvou různých výpisech (k-tá shodná transakce výpisu se páruje s k-tou shodnou transakcí dřívějšího výpisu). Převod mezi dvěma zajištěnými účty = odchozí z A na B a příchozí na B z A se stejnou částkou a měnou do ±N dní; v tocích se počítá jednou.',
    'Toky tvoří orientovaný graf: uzel = účet (bez účtu hotovost, karta s obchodníkem, poplatky). Sankeyův diagram potřebuje graf bez cyklů – obousměrné toky se sloučí na čistý tok a zbylé cykly se rozpojí odebráním nejslabší hrany cyklu; obojí se vypíše.',
    'Detekce hledají vzorce, které doporučení a typologie FATF a učebnice forenzního účetnictví uvádějí jako rizikové (strukturování, průtokové účty, okružní platby, sběrné účty). Každý nález je indicie k prověření s odkazem na konkrétní transakce, ne závěr.',
    'Rychlý průtok: odchozí platby se přiřazují k příchozím metodou LIFO (nejdřív odchází to, co přišlo naposledy) – starší zůstatek tedy průtok nevytváří. Okruhy: hledání cyklů v grafu do hloubky s časovou návazností (každý další převod nejdříve v den předchozího) a s podmínkou, že částka cestou neklesne pod zvolený podíl.'
  ],
  vzorce: [
    'dělení pod limit: transakce s L·(1 − p) ≤ |částka| < L,  v okně W dní ≥ n transakcí\n(překrývající se okna se sloučí; výchozí L nastav podle zadání, p = 10 %, W = 7, n = 3, jen hotovost)',
    'průtok: příchozí P ≥ min,  Σ (odchozí přiřazené k P metodou LIFO do H hodin) ≥ q·P\n(výchozí H = 48 h, q = 80 %, min = 10 000 Kč)',
    'okruh: A → B₁ → … → Bₖ → A,  t₁ ≤ t₂ ≤ … (po dnech),  t_konec − t₁ ≤ W,\n        q·c₁ ≤ cᵢ ≤ c₁/q,  délka ≥ 3 (A ↔ B není okruh)',
    'vějíř dovnitř: ≥ m různých plátců za W dní a ≥ q objemu odejde na 1–2 účty\n(vějíř ven obráceně; jen bankovní účty, platby ≥ min)',
    'kulaté částky: |c| mod M = 0 u ≥ n plateb a ≥ q podílu plateb ≥ min\n(opakované platby stejné částky téže protistraně se vynechají)',
    'změna chování: (obrat v okně W / W) ÷ (obrat v předchozích Z dnech / Z) ≥ k  a  obrat v okně ≥ min'
  ],
  predpoklady: [
    'Výpisy jsou úplné za sledované období a správně přiřazené k účtům; ručně upravené transakce jsou v protokolu vyznačené.',
    'Částka má správné znaménko (+ příjem, − výdaj) – u výpisů se zvláštními sloupci příjem/výdaj nebo se sloupcem směru to zajistí mapování.',
    'Datum je den zaúčtování nebo provedení; čas, pokud ho výpis nese, je místní. Výpisy pásmo neuvádějí, nástroj s časy nepřepočítává.',
    'Stejný účet zapsaný různě (IBAN, s předčíslím, s nulami) se sjednotí; jiná zahraniční čísla se porovnávají doslova.'
  ],
  meze: [
    'Výpisy ukazují jen bezhotovostní pohyby na zajištěných účtech. Co se stane s hotovostí po výběru, účty mimo podklady, platby přes třetí osoby, kryptoaktiva a zápočty vidět nejsou – okruh nebo průtok může ve skutečnosti pokračovat jinudy.',
    'Shoda se vzorcem není trestný čin ani důkaz úmyslu. Legitimní vysvětlení mají všechny vzorce: výplata a hned splátky (průtok), sbírka nebo společný nákup (vějíř), trvalé příkazy a zálohy (kulaté částky), směnný provoz (noční časy), nová zakázka nebo dědictví (změna chování), cash-pooling ve skupině firem (okruh).',
    'Výsledek závisí na prazích; jiné prahy dají jiné nálezy. Výchozí hodnoty jsou ilustrační, limit pro dělení pod limit nastav podle zadání. Parametry jsou vždy v protokolu.',
    'Výpisy bez času transakce: pořadí plateb během dne není známé (příchozí se řadí před odchozí), průtok v hodinách je jen přibližný a neobvyklé časy nelze posoudit.',
    'Párování a duplicity jsou heuristické – dvě shodné platby téhož dne mohou být ve skutečnosti různé, převod s poplatkem odečteným z částky se nespáruje.',
    'Název protistrany uvádí banka plátce podle zadání příkazu; totožnost majitele účtu výpis neprokazuje (to je věc dožádání u banky).',
    'Osobní údaje: zpracovávej jen v rozsahu zadání. Pro výuku, konzultace a předávání mimo spis používej pseudonymizovaná data – nástroj umí nahradit popisky účtů kódy.',
    'Ověření v tabulce je na syntetických ukázkách s vloženými vzorci a na jedné „čisté“ domácnosti. Nevypovídá o tom, jak často detektory hlásí legitimní provoz u skutečných firem a podnikatelů.'
  ],
  literatura: [
    'FATF: International Standards on Combating Money Laundering and the Financing of Terrorism & Proliferation (Doporučení FATF) a typologické zprávy FATF – rizikové vzorce (strukturování, průtokové a sběrné účty, okružní platby).',
    'M.-J. Kranacher, R. Riley: Forensic Accounting and Fraud Examination. Wiley – sledování toků peněz a analýza bankovních výpisů ve finančním šetření.',
    'Zákon č. 253/2008 Sb., o některých opatřeních proti legalizaci výnosů z trestné činnosti a financování terorismu (AML zákon) – rámec povinností povinných osob v ČR.'
  ]
});

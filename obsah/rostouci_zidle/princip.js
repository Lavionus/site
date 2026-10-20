/* ============================================================
   Rostoucí židle – „Jak to funguje“, postup výroby, normy (HTML, bez DOM)
   ============================================================ */
(function (koren) {
  'use strict';
  const t = (x, y, s, a, v, c) => `<text x="${x}" y="${y}" font-size="${v || 10}" text-anchor="${a || 'middle'}" fill="${c || 'currentColor'}">${s}</text>`;
  const fig = (w, h, s, p) => `<figure class="schema"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${p}" font-family="sans-serif">${s}</svg><figcaption>${p}</figcaption></figure>`;
  const D = '#d9b98a', M = '#1f5fa8', C = '#c0392b', Z = '#2e8b57';

  const schemaSklon = () => fig(340, 200,
    `<path d="M60 190L120 190L200 30L140 30Z" fill="${D}" stroke="currentColor"/>` +
    [0, 1, 2, 3, 4, 5, 6].map((i) => { const z = 170 - i * 20, x = 70 + (190 - z) * 0.4; return `<path d="M${x} ${z}H${x + 60}" stroke="#6b4a2a" stroke-width="3"/>`; }).join('') +
    `<path d="M150 70H40" stroke="${M}" stroke-width="6"/>${t(70, 62, 'sedák (vysoko = vzadu)', 'middle', 9, M)}` +
    `<path d="M110 150H10" stroke="${Z}" stroke-width="6"/>${t(40, 142, 'podnožka (níž = vpředu)', 'middle', 9, Z)}` +
    `<path d="M20 190H300" stroke="currentColor" stroke-width="3"/><path d="M40 190H260" stroke="${D}" stroke-width="10" opacity=".8"/>${t(240, 182, 'ližina prodloužená dozadu', 'middle', 9)}` +
    t(250, 60, 'drážky vodorovné,', 'middle', 9) + t(250, 74, 'bok šikmý →', 'middle', 9) + t(250, 88, 'každá výš je dál vzadu', 'middle', 9),
    'Šikmý bok: čím výš drážka, tím je dál vzadu. Podnožka pod sedákem se tak sama posune dopředu pod chodidla a těžiště dítěte zůstává nad ližinami.');
  const schema909090 = () => fig(340, 170,
    `<rect x="60" y="20" width="18" height="90" fill="${D}"/><path d="M78 110H190" stroke="currentColor" stroke-width="10"/>` +
    `<circle cx="120" cy="40" r="16" fill="#f0c39b"/><path d="M110 60V110H180V160H215" fill="none" stroke="#3b4a63" stroke-width="12" stroke-linejoin="round"/>` +
    `<path d="M160 160H240" stroke="${Z}" stroke-width="8"/>${t(270, 164, 'podnožka', 'start', 9, Z)}` +
    `<path d="M100 92A12 12 0 0 0 112 104" fill="none" stroke="${C}"/>${t(94, 98, '90°', 'end', 9, C)}` +
    `<path d="M170 122A12 12 0 0 0 182 110" fill="none" stroke="${C}"/>${t(200, 126, '90°', 'start', 9, C)}` +
    `<path d="M190 148A12 12 0 0 0 202 160" fill="none" stroke="${C}"/>${t(220, 150, '90°', 'start', 9, C)}` +
    `<path d="M250 30H330" stroke="currentColor" stroke-width="6"/>${t(290, 22, 'stůl', 'middle', 9)}<path d="M250 30V60" stroke="${M}" stroke-dasharray="3 2"/>${t(300, 50, 'loket u desky', 'middle', 9, M)}`,
    'Pravidlo 90-90-90: kyčle, kolena i kotníky v pravém úhlu, chodidla celou plochou na podnožce, loket zhruba ve výšce desky stolu.');

  koren.RZPrincip = {
    princip: () => `
      <h3>Proč „roste s dítětem“</h3>
      <p>Batole i dospělý sedí u stejného stolu (72–76 cm). Mění se jen výška sedu a výška opory chodidel. Sedák a podnožka jsou proto dvě desky zasunuté do <b>vodorovných drážek</b> ve dvou bocích; přestaví se do jiné drážky a sevřou se dvěma svorníky. Jde o obecný princip známý z mnoha „rostoucích“ židlí – tady je to <b>vlastní konstrukce</b> (rozměry, počet drážek, ližiny, svorníky i opěradlo počítá tato stránka). Konkrétní komerční design (např. Tripp Trapp® od Stokke – chráněný design) nekopírujeme.</p>
      ${schemaSklon()}
      <h3>Proč šikmé boky</h3>
      <ul><li>Podnožka leží o výšku podkolení níž než sedák – na šikmém boku je tím automaticky o <i>podkolení × tg sklonu</i> vpředu, tedy pod chodidly.</li>
      <li>Vysoko posazené malé dítě je vzadu, blíž opěradlu – těžiště je nad ližinami i při odstrčení od stolu.</li>
      <li>Boky tvoří s ližinami trojúhelník – židle je tuhá bez dalších spojů.</li></ul>
      <h3>Ergonomie 90-90-90</h3>${schema909090()}
      <p><b>Výška sedu</b> = výška stolu − rozdíl stůl/sed. Rozdíl bere z tabulky ČSN EN 1729-1 (velikosti 0–7, lineárně mezi středy pásem), výšku dítěte z mediánu WHO podle věku, nebo ji zadáte. <b>Podnožka</b> je o výšku podkolení (≈ 0,25 × výška postavy) níž; povolené je koleno 90° až zadaný úhel (chodidla mírně vpředu), nebo nejvýš 12 mm „na špičkách“. <b>Hloubka sedu</b> (od opěradla k přední hraně) ≈ 0,8 × délka stehna (0,275 × výška) – sedák se v drážce posune dopředu nebo dozadu, štítek říká o kolik.</p>
      <h3>Optimalizace drážek</h3>
      <p>Program zkouší rozteče od 50 mm dolů (nejmenší rozteč = tloušťka desky + vůle + 8 mm dřeva mezi drážkami) a posun první drážky po 1 mm. Vybere největší rozteč (nejméně drážek), při které má každý věk z rozsahu i každé zadané dítě sedák v toleranci výšky a podnožku v povoleném úhlu kolene. Když to nejde, vybere kompromis s nejmenším počtem nevyhovujících poloh a vypíše je.</p>
      <h3>Stabilita</h3>
      <p>Pro každý věk se počítá těžiště židle a dítěte proti opěrnému polygonu ližin ve čtyřech případech: odstrčení od stolu (dozadu – nejčastější úraz), naklonění ke stolu, do boku a <b>postavení na podnožku</b>. Bezpečnost = moment vlastní tíhy k hraně převržení / moment síly opření. Ližiny se prodlužují po 10 mm, dokud všechny polohy nemají bezpečnost aspoň zadanou hodnotu.</p>`,
    postup: () => `
      <h3>Přestavení krok za krokem</h3>
      <ol><li>Povolte oba svorníky (kloboukové matice) o 2–3 otáčky – boky se uvolní.</li>
      <li>Vysuňte podnožku a sedák dopředu z drážek.</li>
      <li>Podle štítku zasuňte podnožku do drážky Dn a sedák do Dm; sedák vysuňte před přední hranu boku o uvedený počet mm.</li>
      <li>Dotáhněte svorníky rovnoměrně (nejdřív dolní, pak horní), desky se nesmí v drážkách hýbat. Vůli doplňte klínkem.</li>
      <li>Zkuste: dítě sedí, chodidla celou plochou na podnožce, stehna vodorovně, loket u desky stolu.</li></ol>
      <h3>Výroba</h3>
      <ol><li>Boky: přířez z buku / bukové spárovky nebo březové překližky; šikmé řezy nahoře a dole podle šablony 1:1 (kruhová pila s pokosovým dorazem).</li>
      <li>Drážky: oba boky upnout vedle sebe vnitřními líci nahoru (zrcadlově!), horní frézka s drážkovací frézou na šířku desky + vůle, vodicí lišta kolmá k vláknům šablony; hloubka ${'≈'} 8 mm, nejdřív zkušební drážka na odřezku.</li>
      <li>Otvory Ø 8,5 pro svorníky skrz oba boky najednou (stojanová vrtačka), kolíkové otvory pro opěradlo a ližiny podle šablony.</li>
      <li>Ližiny se zkosenými konci; spojit s boky kolíky Ø 10 a lepidlem D3, zespodu vrut.</li>
      <li>Opěradlo: dvě příčky s kolíky Ø 8, hrany zaoblené R 6.</li>
      <li>Vše zaoblit (R ≥ 3, rohy desek R ≥ 10), brousit 120 → 180 → 240.</li></ol>
      <h3>Povrch bezpečný pro děti</h3>
      <p>Tvrdý voskový olej nebo vodou ředitelný lak s deklarovanou shodou s <b>EN 71-3</b> (migrace prvků) – dítě židli olizuje. Nechat úplně vytvrdit (olej 2–4 týdny). Hadry s olejem rozložit naplocho nebo namočit (samovznícení). Podnožku lze opatřit protiskluzovými drážkami.</p>
      <p class="info">Bezpečnost u strojů: drážky frézujte s vodicí lištou a pevně upnutým obrobkem, nikdy „z ruky“; na kruhové pile štípací klín a posuvné saně, krátké kusy nikdy volnou rukou.</p>`,
    zdroje: () => `<h3>Normy a zdroje</h3><ul>
      <li><b>ČSN EN 1729-1</b> Nábytek – Židle a stoly pro vzdělávací instituce – Funkční rozměry (velikosti 0–7, výška sedu h8 a stolu h1).</li>
      <li><b>WHO Child Growth Standards</b> (0–5 let) a <b>WHO Growth Reference 2007</b> (5–19 let) – medián výšky podle věku.</li>
      <li><b>ČSN EN 14988</b> Dětské vysoké židle – Požadavky a zkušební metody (pro děti do 36 měsíců: stabilita, zádržný systém, mezery). <i>Jen odkaz – konstrukci vůči normě ověřte, tato stránka zkoušky nenahrazuje.</i></li>
      <li><b>ČSN EN 71-3</b> Bezpečnost hraček – Migrace určitých prvků (povrchové úpravy).</li>
      <li>Antropometrické podíly (výška podkolení, délka stehna, segmenty těla) – zjednodušeně podle Drillise a Contiho; u konkrétního dítěte je lepší změřit.</li></ul>
      <p class="info">Princip „rostoucí židle“ je obecný. Tripp Trapp® je ochranná známka společnosti Stokke a jeho design je chráněný – tato stránka nekopíruje jeho tvar ani rozměry.</p>`,
  };
})(typeof window !== 'undefined' ? window : globalThis);

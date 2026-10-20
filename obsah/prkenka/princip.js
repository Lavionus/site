/* ============================================================
   Prkénka – texty „Jak to funguje“ (HTML pro stránku + řádky pro PDF), bez DOM
   ============================================================ */
(function (koren) {
  'use strict';
  // schéma: vlákna jako svazek brček – nůž na čele vklouzne mezi vlákna, na boku je přeřezává
  const SCHEMA = `<svg viewBox="0 0 420 150" role="img" aria-label="Nůž na čelním a podélném vlákně">
  <g fill="none" stroke="currentColor" stroke-width="1.2">
    <text x="10" y="16" fill="currentColor" stroke="none" font-size="12">Čelní vlákno (end grain)</text>
    ${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<rect x="${14 + i * 22}" y="40" width="18" height="90" rx="9"/>`).join('')}
    <path d="M96 28 L104 70 L112 28" stroke-width="2"/><text x="118" y="36" fill="currentColor" stroke="none" font-size="10">ostří klouže mezi vlákna</text>
    <text x="230" y="16" fill="currentColor" stroke="none" font-size="12">Podélné vlákno (edge / face grain)</text>
    ${[0, 1, 2, 3, 4].map((i) => `<rect x="230" y="${44 + i * 18}" width="180" height="14" rx="7"/>`).join('')}
    <path d="M312 28 L320 62 L328 28" stroke-width="2"/><text x="334" y="36" fill="currentColor" stroke="none" font-size="10">ostří vlákna přeřezává</text>
  </g></svg>`;

  const SEKCE = [
    ['Proč čelní dřevo šetří nůž', [
      'Dřevo je svazek dutých vláken (cév a vláknic) podél kmene. Na čelním dřevě (end grain) stojí vlákna kolmo k ploše: ostří zajede mezi ně, vlákna se rozestoupí a po vytažení nože se zčásti zase zavřou. Ostří se tolik neotupuje a stopy po noži se „zacelují“.',
      'Na podélném vlákně (edge grain – hrana prkna nahoru, face grain – plocha prkna nahoru) nůž vlákna přeřezává. Prkénko je stabilnější, levnější a snáz se vyrábí, ale rýhy zůstávají a nůž se tupí rychleji.',
      'Daň za čelní dřevo: čelo saje vodu (víc praská, nesmí do myčky ani se nechat ve vodě), lepené spáry jsou čelo na čelo a namáhají se při každé změně vlhkosti. Proto tloušťka aspoň 32–40 mm, vysušené dřevo (8–12 %) a pravidelné olejování.',
    ]],
    ['Jak vzniká vzor', [
      'Všechny vzory vznikají opakováním stejných operací: nařezat pruhy → slepit panel → rovinně srovnat → příčně rozřezat na plátky → plátky otočit čelem nahoru a/nebo posunout či otočit o 180° → slepit znovu. Šachovnice tak vznikne z panelu A B A B, kde se každý druhý plátek otočí konec za konec; cihlová vazba posunem každého druhého plátku o půl cihly; chevron šikmým řezem a překlopením každého druhého pásu.',
      '3D kostky (tumbling blocks) jsou šestiúhelníky složené ze tří kosočtverců s úhly 60° a 120°. Tři kosočtverce se v ose sejdou úhly 3 × 120° = 360°; oko je čte jako krychli ve volném rovnoběžném promítání. Kosočtverečné lišty mají výšku s · sin 60° a řežou se kotoučem nakloněným o 30°.',
      'Šířka kotouče (kerf) se ztrácí při každém řezu: panel pro n plátků musí být dlouhý 2 × zarovnání + n × (plátek + řez). Kalkulačka počítá s hrubými rozměry: pruh je o úbytek hoblování vyšší, plátek o úbytek broušení tlustší.',
    ]],
    ['Lepidla vhodná pro styk s potravinami', [
      'PVAc D3 (vodovzdorné disperzní lepidlo; řada výrobců u něj uvádí vhodnost pro nepřímý styk s potravinami po vytvrzení): nejběžnější volba, otevřená doba typicky ~10 min, stáhnout min. 1 h, zatížit až po 24 h.',
      'PVAc D2 stačí pro prkénka, která se nemyjí dlouho ve vodě; D4 (dvousložkové) pro nejvyšší odolnost vodě.',
      'Polyuretanové (PUR) lepidlo pění, vyplní drobné mezery a dobře lepí mastná exotická dřeva; přebytek po vytvrzení mechanicky odstranit. Epoxid na prkénka spíš ne (křehký, nevhodný na čelní spáry).',
      'Konkrétní schválení pro potraviny ověřte v technickém listu výrobce – liší se podle trhu. Lepidlo nechte vytvrdit podle listu, teprve pak hoblujte a brušte.',
    ]],
    ['Olej a vosk', [
      'Minerální (parafinový) olej v potravinářské kvalitě: nežlukne, nevysychá, vsákne se do pórů a brání nasávání vody. Čelní prkénko napouštějte opakovaně, dokud olej vsakuje (první den i 4–6×), přebytek po 20 min setřít.',
      'Vosk (včelí nebo karnaubský rozpuštěný v minerálním oleji, typicky 1 : 4) uzavře povrch a přidá lesk; nanést na nasycené prkénko, rozleštit.',
      'Rostlinné oleje z kuchyně (slunečnicový, olivový) žluknou – nepoužívejte. Tvrdnoucí oleje (lněná fermež, tungový olej, „oleje na pracovní desky“) jsou po úplném vytvrzení použitelné, ale čelní dřevo se jimi těžko sytí a vytvrzení trvá týdny.',
      'Údržba: umýt teplou vodou a saponátem, osušit, sušit na hraně; jednou za 2–4 týdny přeolejovat. Nikdy do myčky ani namáčet.',
    ]],
    ['Bezpečnost u řezání krátkých kusů', [
      'Plátky čelního dřeva jsou krátké a vysoké – na okružní pile nejnebezpečnější práce. Řežte na přířezných saních (crosscut sled) s upnutým panelem a dorazem pro délku umístěným PŘED kotoučem; kus musí být po řezu volný, nesmí být sevřený mezi kotoučem a dorazem.',
      'Podélné pravítko nikdy nepoužívejte jako doraz pro příčný řez – sevřený kus se zakousne a vystřelí (zpětný vrh). Pokud ho chcete využít jako měřítko, připevněte na něj odsazovací špalík před kotoučem.',
      'Úzké pruhy podélně řežte s posunovačem (push stick / push block) a přítlakem, rozvírací klín a kryt na místě. Úzký pruh odřezávejte na straně od pravítka, nebo použijte dorazový přípravek pro tenké pruhy (thin rip jig).',
      'Úkosový řez (kosočtverce): kotouč nakloněný od pravítka, ne k němu – odřezek se nesmí zaklínit mezi kotouč a pravítko. Kotouč čistý a ostrý, výška nad dílem ~ 1 zub.',
      'Čelní dřevo nehoblujte v tloušťkovačce – hrany se vylamují a kusy mohou být vymrštěny. Použijte válcovou brusku, pásovou brusku nebo frézovací saně (router sled); pokud už tloušťkovačku, pak jen s obětními lištami po stranách, zkosenou odtokovou hranou a třískami do 0,3 mm – na vlastní riziko.',
      'Ochranné brýle, chrániče sluchu a odsávání; prach exotických dřev (padouk, wenge) dráždí – respirátor FFP2/FFP3.',
    ]],
  ];
  function html() {
    let s = `<div class="schema">${SCHEMA}</div>`;
    for (const [n, odst] of SEKCE) s += `<h3>${n}</h3>` + odst.map((o) => `<p>${o}</p>`).join('');
    return s;
  }
  function radky() { const out = []; for (const [n, odst] of SEKCE) { out.push('# ' + n); out.push(...odst); } return out; }
  const API = { SEKCE, html, radky };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.PKP = API;
})(typeof window !== 'undefined' ? window : globalThis);

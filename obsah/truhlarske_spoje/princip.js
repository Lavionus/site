/* ============================================================
   Šablony truhlářských spojů – „Jak to funguje“ a postup výroby (texty + schémata, bez DOM)
   ============================================================ */
(function (koren) {
  'use strict';
  const A = '#d9a66a', B = '#a9733f', C = '#efd9a8', CARA = 'currentColor';
  const sipka = (x1, y1, x2, y2, barva, txt, tx, ty) => {
    const u = Math.atan2(y2 - y1, x2 - x1), s = 7, a1 = u + 2.7, a2 = u - 2.7;
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${barva}" stroke-width="2.4"/>` +
      `<path d="M${x2} ${y2}L${x2 + s * Math.cos(a1)} ${y2 + s * Math.sin(a1)}L${x2 + s * Math.cos(a2)} ${y2 + s * Math.sin(a2)}Z" fill="${barva}"/>` +
      (txt ? `<text x="${tx}" y="${ty}" font-size="11" fill="${barva}" text-anchor="middle">${txt}</text>` : '');
  };
  const OK = '#2e8b57', NE = '#c0392b';
  const vlakna = (x, y, w, h, svisle) => {
    let s = '';
    for (let i = 1; i < 6; i++) s += svisle ? `<path d="M${x + w * i / 6} ${y + 2}q${w * 0.04} ${h / 2} 0 ${h - 4}" stroke="#7a5230" stroke-width="0.7" fill="none" opacity="0.6"/>` : `<path d="M${x + 2} ${y + h * i / 6}q${w / 2} ${h * 0.05} ${w - 4} 0" stroke="#7a5230" stroke-width="0.7" fill="none" opacity="0.6"/>`;
    return s;
  };
  const obal = (w, h, obsah) => `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif" role="img">${obsah}</svg>`;

  const SCHEMA = {
    rybina: () => obal(340, 170,
      `<path d="M20 15 H80 V60 L20 48 Z" fill="${B}" stroke="${CARA}"/><path d="M20 122 L80 110 V155 H20 Z" fill="${B}" stroke="${CARA}"/>` +
      `<path d="M20 48 L80 60 H320 V110 H80 L20 122 Z" fill="${A}" stroke="${CARA}" stroke-width="1.5"/>${vlakna(80, 60, 240, 50, false)}` +
      sipka(230, 85, 300, 85, NE, '', 0, 0) + `<text x="265" y="52" font-size="11" fill="${NE}" text-anchor="middle">✕ tah po délce drží</text>` +
      `<circle cx="140" cy="135" r="7" fill="none" stroke="${OK}" stroke-width="2"/><circle cx="140" cy="135" r="2.2" fill="${OK}"/>` +
      `<text x="152" y="139" font-size="11" fill="${OK}">✓ montáž jen kolmo k nákresu</text>` +
      `<text x="50" y="168" font-size="11" fill="${CARA}" text-anchor="middle">B</text><text x="200" y="125" font-size="11" fill="${CARA}">A – ozub 1:N</text>`),
    cinky: () => obal(340, 170,
      [0, 1, 2, 3, 4].map((i) => `<rect x="${60 + i * 30}" y="${i % 2 ? 40 : 20}" width="30" height="${i % 2 ? 110 : 20}" fill="${i % 2 ? B : A}" stroke="${CARA}"/>`).join('') +
      `<rect x="60" y="40" width="150" height="110" fill="none" stroke="${CARA}"/>` +
      [0, 2, 4].map((i) => `<rect x="${60 + i * 30}" y="40" width="30" height="20" fill="${A}" stroke="${CARA}"/>`).join('') +
      `<text x="235" y="60" font-size="11" fill="${OK}">✓ velká lepená</text><text x="235" y="74" font-size="11" fill="${OK}">plocha podél vláken</text>` +
      `<text x="235" y="104" font-size="11" fill="${NE}">✕ bez lepidla</text><text x="235" y="118" font-size="11" fill="${NE}">nedrží v tahu</text>`),
    cep: () => obal(340, 170,
      `<rect x="20" y="10" width="70" height="150" fill="${B}" stroke="${CARA}"/>${vlakna(20, 10, 70, 150, true)}` +
      `<rect x="90" y="55" width="220" height="60" fill="${A}" stroke="${CARA}"/>${vlakna(90, 55, 220, 60, false)}` +
      `<rect x="40" y="70" width="50" height="30" fill="${A}" stroke="${CARA}" stroke-dasharray="4 3"/>` +
      sipka(200, 40, 200, 52, OK, '', 0, 0) + `<text x="200" y="34" font-size="11" fill="${OK}" text-anchor="middle">osazení nese ohyb</text>` +
      sipka(250, 140, 300, 140, NE, '✕ tah: lepidlo / klínky', 255, 160)),
    preplatovani: () => obal(340, 170,
      `<rect x="20" y="95" width="300" height="25" fill="${A}" stroke="${CARA}"/><rect x="20" y="70" width="110" height="25" fill="${A}" stroke="${CARA}"/>` +
      `<rect x="130" y="70" width="80" height="25" fill="${B}" stroke="${CARA}"/><rect x="130" y="45" width="80" height="25" fill="${B}" stroke="${CARA}" opacity="0.6"/>` +
      `<text x="170" y="38" font-size="11" fill="${CARA}" text-anchor="middle">B (polovina tloušťky)</text>` +
      `<text x="170" y="140" font-size="11" fill="${OK}" text-anchor="middle">✓ lepená plocha = celý plátek</text>` + sipka(170, 20, 170, 40, OK, '', 0, 0)),
    pero: () => obal(340, 170,
      `<rect x="20" y="50" width="140" height="60" fill="${A}" stroke="${CARA}"/><rect x="160" y="70" width="30" height="20" fill="${A}" stroke="${CARA}"/>` +
      `<path d="M190 50 H320 V110 H190 V90 H163 V70 H190 Z" fill="${B}" stroke="${CARA}"/><rect x="160" y="70" width="30" height="20" fill="${A}" stroke="${CARA}"/>` +
      `<text x="170" y="135" font-size="11" fill="${OK}" text-anchor="middle">✓ lícuje plochy, kryje spáru</text><text x="170" y="150" font-size="11" fill="${CARA}" text-anchor="middle">desky mohou sesychat a bobtnat</text>`),
    koliky: () => obal(340, 170,
      `<rect x="20" y="40" width="150" height="80" fill="${A}" stroke="${CARA}"/><rect x="170" y="40" width="150" height="80" fill="${B}" stroke="${CARA}"/>` +
      `<rect x="120" y="73" width="100" height="14" rx="5" fill="${C}" stroke="${CARA}"/>` +
      `<text x="170" y="30" font-size="11" fill="${CARA}" text-anchor="middle">kolík přes spáru, drážky pro lepidlo</text>` +
      `<text x="170" y="145" font-size="11" fill="${OK}" text-anchor="middle">✓ vystředí díly, nese smyk</text>`),
    lamelo: () => obal(340, 170,
      `<rect x="20" y="40" width="150" height="80" fill="${A}" stroke="${CARA}"/><rect x="170" y="40" width="150" height="80" fill="${B}" stroke="${CARA}"/>` +
      `<path d="M140 80 A 60 60 0 0 1 200 80 A 60 60 0 0 1 140 80 Z" transform="translate(0 0) scale(1 1)" fill="${C}" stroke="${CARA}"/>` +
      `<ellipse cx="170" cy="80" rx="32" ry="12" fill="${C}" stroke="${CARA}"/>` +
      `<text x="170" y="30" font-size="11" fill="${CARA}" text-anchor="middle">lamela z lisovaného buku</text>` +
      `<text x="170" y="145" font-size="11" fill="${OK}" text-anchor="middle">✓ vodou z lepidla nabobtná a zapře se</text>`),
  };
  SCHEMA.polokryta = SCHEMA.rybina;

  const TEXTY = {
    rybina: {
      proc: 'Ozub (rybina) se k základně zužuje. Tah po délce desky A ho vtlačuje do klínovité dutiny v desce B, takže spoj drží mechanicky i bez lepidla. Sestavit ani rozebrat ho jde jen jedním směrem – kolmo na desku A (podél čepů).',
      vlakna: 'Ozuby i čepy mají vlákna podél své délky, proto jsou pevné. Sklon 1:6 (měkké dřevo) až 1:8 (tvrdé) je kompromis: strmější sklon drží víc, ale na rozích ozubu vzniká krátké vlákno, které se odštípne. Mírnější sklon je pevný v materiálu, ale zámek je slabší.',
      kdy: 'Rohy truhel, krabic, korpusů a zadních stěn zásuvek – všude, kde se deska snaží vytáhnout z rohu. Viditelné z obou stran (průběžný ozub je i ozdoba).',
      postup: ['Hoblujte desky na tloušťku, zarovnejte konce do pravého úhlu.', 'Rýsovačkou (nebo podle šablony) vyznačte základní čáry: na desce A ve vzdálenosti tloušťky B (+ přesah), na desce B ve vzdálenosti tloušťky A, po obou plochách i hranách.', 'Nalepte šablonu A kolem konce desky (ohyby na hranu), případně přeneste body šablonou s úhlem 1:N. Křížkem označte odpad.', 'Řežte ozuby na odpadní straně čáry (šedý pruh) až k základní čáře, pilu držte svisle.', 'Odpad mezi ozuby vylomte lupenkovou pilkou a dočistěte dlátem od obou ploch k základní čáře (lehce podříznout do středu).', 'Desku A přiložte na čelo B a ostrým nožem obkreslete ozuby (u šablony B je to už nakreslené) – tím je přesnost zaručena i při drobné chybě v řezu.', 'Čepy řežte na odpadní straně, dutiny vydlabejte od obou ploch.', 'Zkuste suchou montáž, pouze lehce dočistěte. Lepte, stáhněte svěrkami přes podložky, po zaschnutí zarovnejte přesah hoblíkem.'],
    },
    polokryta: {
      proc: 'Stejný zámek jako u průběžné rybiny, ale ozuby nevedou přes celou tloušťku čela – zůstává krytí, takže z lícní strany (čelo zásuvky) není spoj vidět. Tah za čelo (otevírání zásuvky) zachytávají ozuby.',
      vlakna: 'Krytí má vlákna napříč tahu – musí mít aspoň 3–5 mm, jinak praskne. Ozuby by měly zasahovat aspoň do 2/3 tloušťky čela.',
      kdy: 'Čela zásuvek, místa, kde má být spoj vidět jen z boku.',
      postup: ['Vyznačte na čele hloubku ozubů (tloušťka čela − krytí) z vnitřní plochy a tloušťku boku na čele.', 'Vyřízněte a dočistěte ozuby na boku (jako u průběžné rybiny), délka = hloubka dutiny.', 'Bok postavte na čelo, nožem obkreslete ozuby na čelo (nebo použijte šablonu B).', 'Pilou řežte šikmo jen do vyznačené hloubky – na lícní krytí nesmíte zasáhnout.', 'Dutiny vydlabejte svisle a vodorovně ze dvou směrů, rohy dočistěte úzkým dlátem.', 'Suchá montáž, lepení, zarovnání přesahu na boku.'],
    },
    cinky: {
      proc: 'Prsty se střídají a dávají velkou lepenou plochu podél vláken – lepený spoj je velmi pevný, ale mechanicky nedrží v žádném směru (bez lepidla se rozpadne).',
      vlakna: 'Boky prstů jsou dřevo podél vlákna (lepí se výborně); čela prstů jsou čelní dřevo (lepí se špatně). Proto pevnost roste s počtem prstů.',
      kdy: 'Krabice, šuplíky, bedny, výrobky z překližky na CNC nebo laseru. Jednoduché na strojní výrobu přípravkem na kotoučové pile.',
      postup: ['Rozdělte šířku na lichý počet stejných prstů (krajní prsty má díl A).', 'Vyznačte základní čáry ve vzdálenosti tloušťky protilehlé desky (+ přesah).', 'Šablonu nalepte kolem konce a označte odpad X.', 'Řežte na odpadní straně (nebo frézujte přípravkem s klíčkem o šířce prstu).', 'Odpad odstraňte dlátem nebo lupenkovou pilkou.', 'Suchá montáž, lepení, po zaschnutí zarovnání čel prstů.'],
    },
    cep: {
      proc: 'Čep zasunutý v dlabu přenáší ohyb a smyk lícemi a osazením – osazení se opírá o nohu a nedovolí rámu se zkroutit. V tahu drží lepidlo, kolíček přes čep nebo klínky (u průchozího čepu s klínky se konec čepu roztáhne do rozevřeného dlabu a drží mechanicky).',
      vlakna: 'Čep má vlákna podél své délky. Tloušťka 1/3 lubu ponechá obě líce dlabu stejně silné. Dlab se dělá dlátem o šířce čepu – ne obráceně. Široký čep (přes 6× tloušťku) při sesychání v dlabu povolí.',
      kdy: 'Rámy dveří a oken, stoly (noha + lub), židle, lavice, pracovní stoly. Klasický nejpevnější rámový spoj.',
      postup: ['Vyznačte polohu dlabu na noze a jeho šířku podle dláta (rýsovačka na dva hroty).', 'Vydlabejte dlab: začněte uprostřed, postupujte ke koncům, poslední 1–2 mm u konců dočistěte až nakonec. Hloubku kontrolujte.', 'Na lubu vyznačte osazení (délku čepu) kolem dokola a líce čepu rýsovačkou nastavenou podle dlabu.', 'Řežte líce čepu podélně (na odpadní straně), pak osazení příčně.', 'Boční osazení dořízněte, čep zkuste do dlabu – má jít ztuha rukou.', 'U čepu s klínky: do čepu udělejte dva zářezy pilou, dlab z vnější strany mírně rozevřete; po vložení čepu zatlučte klínky s lepidlem, napříč k vláknům nohy.', 'Lepení, stažení, zarovnání vyčnívajícího čepu.'],
    },
    preplatovani: {
      proc: 'Oba díly se v místě spoje zeslabí na polovinu a vloží do sebe. Lepená plocha je velká a podél vláken; zámek drží jen v jednom směru (kolmo k ploše), ostatní nese lepidlo, kolíky nebo vruty.',
      vlakna: 'Plátky mají vlákna podél, takže lepidlo drží dobře. Dno zářezu musí být rovné – jinak spoj nedosedne.',
      kdy: 'Rámy, mřížoví, stolové podnože, rohy jednoduchých rámů, konstrukce z hranolů.',
      postup: ['Vyznačte šířku zářezu podle druhého dílu (obkreslením), hloubku rýsovačkou na polovinu tloušťky z lícní strany obou dílů.', 'Řežte boky zářezu na odpadní straně až k hloubkové čáře; uprostřed udělejte několik pomocných řezů.', 'Odpad vylomte dlátem, dno zarovnejte dlátem nebo římsovníkem / frézkou.', 'Vyzkoušejte, lepte a stáhněte.'],
    },
    pero: {
      proc: 'Pero v drážce srovná plochy sousedních desek a kryje spáru. Spoj se obvykle nelepí po celé délce (obklady), aby desky mohly sesychat a bobtnat; u spárované desky stolu se lepí hrany.',
      vlakna: 'U pera z masivu vede vlákno podél spoje – pero je pevné po délce, ale může se ulomit napříč. Volné pero z překližky je pevnější.',
      kdy: 'Palubky, obklady, podlahy, výplně rámů, spárování desek.',
      postup: ['Profil na čele zkontrolujte šablonou (měrka pera / drážky).', 'Drážku frézujte nebo řežte na kotoučové pile ve dvou průchodech z obou ploch (vystředěno).', 'Pero vytvořte dvěma polodrážkami, vyzkoušejte do drážky – má jít volně rukou.', 'Na dně drážky nechte rezervu (pero nesmí dosednout na dno).'],
    },
    koliky: {
      proc: 'Kolíky přes spáru vystředí díly a přenášejí smyk. Pevnost dává hlavně lepidlo na kolících (drážkovaný kolík vede lepidlo a vzduch).',
      vlakna: 'Kolík do čela (čelní dřevo) drží hůř – musí jít hlouběji (2,5× průměr a víc). Do plochy jen do 2/3 tloušťky, aby neprošel.',
      kdy: 'Korpusy ze dřevotřísky a překližky, spárování desek, opravy, rámy, kde nelze dělat čep.',
      postup: ['Obě desky si označte (A/B, líce) a přiložte šablonu / přípravek ke stejné referenční ploše.', 'Středy otvorů naznačte důlčíkem nebo šídlem (kříž v šabloně).', 'Vrtejte kolmo s hloubkovým dorazem (vrták se středicím hrotem, Ø kolíku).', 'Hrany otvorů lehce zahloubte, lepidlo do otvoru i na kolík, kolíky zatlučte do jednoho dílu, pak nasaďte druhý a stáhněte.'],
    },
    lamelo: {
      proc: 'Lamela z lisovaného buku se vloží do štěrbin vyfrézovaných kotoučem Ø 100 mm. Voda z lepidla ji nabobtná, takže štěrbinu vyplní a spoj zpevní a vystředí. Štěrbina je delší než lamela – dovoluje posunout díl o pár milimetrů do strany.',
      vlakna: 'Lamela má vlákna šikmo (45°), proto se neštípe v žádném směru. Středy lamel se kreslí čarou přes spáru – frézka má stejnou značku.',
      kdy: 'Spárování desek (zarovnání ploch), korpusy, rámy z desek, rohy na pokos.',
      postup: ['Desky přiložte k sobě a čarou přes spáru vyznačte středy lamel (šablona: červené čáry).', 'Nastavte výšku frézy na střed tloušťky (u silných desek dvě řady), velikost lamely na stroji.', 'Frézujte štěrbiny do obou dílů od stejné referenční plochy (lícem k dorazu).', 'Lepidlo do štěrbin, vložit lamely, sestavit a hned stáhnout – lamely rychle nabobtnají.'],
    },
  };

  const OBECNE = [
    { nadpis: 'Směr vláken a síly', text: 'Dřevo je silné podél vláken a slabé napříč. Lepidlo drží na bocích (podélné dřevo), na čelech skoro vůbec. Spoj navrhujte tak, aby lepené plochy byly podélné a aby tah nevedl napříč krátkými vlákny (rohy ozubů, tenká krytí, stěny dlabu).' },
    { nadpis: 'Vůle a přesah', text: 'Vůle (mm na každou stykovou plochu) umožní sestavení a nechá místo lepidlu: 0–0,05 mm pro ruční přesné spoje, 0,1–0,15 mm pro CNC a 3D tisk. Přesah = o kolik ozuby, prsty a čepy vyčnívají; po slepení se zarovnají hoblíkem.' },
    { nadpis: 'Řez na odpadní straně', text: 'Čára na šabloně je hrana hotového dílu. Pila má šířku řezu (kerf) – řež celý řez v šedém pruhu na straně odpadu (X), čára zůstane na dílu. U CNC se nástroj korekcí posune stejně.' },
    { nadpis: 'Tisk šablon', text: 'Tiskněte „skutečná velikost“ (100 %) a změřte kontrolní úsečku nebo čtverec 50 mm. Šablonu přilepte lepicí tyčinkou nebo oboustrannou páskou, ohyby (čárkovaně) ohněte přes hrany. Velké šablony se dělí na listy s pásmem lepení.' },
  ];

  const API = { SCHEMA, TEXTY, OBECNE };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.TSP = API;
})(typeof window !== 'undefined' ? window : globalThis);

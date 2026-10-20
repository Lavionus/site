/* ============================================================
   Šablony oblouků a profilů – „Jak to funguje“, „Postup výroby“ a bezpečnost (HTML + malá SVG schémata)
   OBLPrincip.princip(rezim), OBLPrincip.postup(rezim) → HTML; OBLPrincip.postupText(rezim) → [řádky] pro PDF
   ============================================================ */
(function (koren) {
  'use strict';
  const fig = (w, h, obsah, popis) => `<figure class="schema"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${popis}">${obsah}</svg><figcaption>${popis}</figcaption></figure>`;
  const t = (x, y, s, a, vel, c) => `<text x="${x}" y="${y}" font-size="${vel || 10}" text-anchor="${a || 'middle'}" fill="${c || 'currentColor'}">${s}</text>`;
  const A = 'var(--accent)';

  function schemaTetiva() {
    let s = '<path d="M30 150 A 260 260 0 0 1 310 150" fill="none" stroke="currentColor" stroke-width="2"/>';
    s += `<path d="M30 150H310" stroke="currentColor" stroke-dasharray="4 3"/><path d="M170 150V112" stroke="${A}" stroke-width="1.5"/>`;
    s += t(178, 135, 'h', 'start', 11, A) + t(170, 166, 'tětiva c', 'middle', 10);
    s += `<path d="M170 112L170 40" stroke="currentColor" stroke-dasharray="2 3"/>` + t(176, 58, 'R = (c²/4 + h²) / 2h', 'start', 10, A);
    s += t(170, 186, 'úhel = 4·atan(2h / c), délka = R · úhel', 'middle', 10);
    return fig(340, 196, s, 'Z tětivy c a vzepětí h vyjde poloměr bez kreslení středu – užitečné u velkých poloměrů, kde střed leží daleko mimo dílnu.');
  }
  function schemaProvazek() {
    let s = '<ellipse cx="170" cy="100" rx="140" ry="80" fill="none" stroke="currentColor" stroke-width="2"/>';
    s += `<circle cx="55" cy="100" r="4" fill="${A}"/><circle cx="285" cy="100" r="4" fill="${A}"/>` + t(55, 120, 'F1', 'middle', 10, A) + t(285, 120, 'F2', 'middle', 10, A);
    s += '<path d="M55 100L210 24L285 100" fill="none" stroke="#b3261e" stroke-width="1.5" stroke-dasharray="5 3"/><circle cx="210" cy="24" r="3.5" fill="#b3261e"/>' + t(222, 22, 'tužka', 'start', 10, '#b3261e');
    s += t(170, 196, '|PF1| + |PF2| = 2a (provázek napnutý tužkou)', 'middle', 10);
    return fig(340, 204, s, 'Zahradnická konstrukce: hřebíky v ohniscích ve vzdálenosti 2c = 2·√(a² − b²) od sebe; provázek se smyčkou délky 2a + 2c.');
  }
  function schemaLat() {
    let s = '<path d="M20 120 C 90 30, 230 30, 320 110" fill="none" stroke="currentColor" stroke-width="2.5"/>';
    for (const [x, y] of [[20, 120], [110, 62], [215, 58], [320, 110]]) s += `<circle cx="${x}" cy="${y + 6}" r="4" fill="${A}"/>`;
    for (let i = 0; i <= 12; i++) { const x = 20 + i * 25, y = 120 - 70 * Math.sin(Math.PI * i / 12) * 0.85; s += `<path d="M${x} ${y}L${x} ${y - 14 - 6 * Math.sin(Math.PI * i / 12)}" stroke="#2c8a4a"/>`; }
    s += t(170, 150, 'hřebíky = body, lať se ohne s nejmenší energií ohybu', 'middle', 10) + t(170, 20, 'hřebínek křivosti (zeleně) – musí se měnit plynule', 'middle', 10, '#2c8a4a');
    return fig(340, 160, s, 'Ohnutá pružná lať mezi hřebíky má mezi body nulové čtvrté derivace průhybu – to je přesně přirozený kubický spline.');
  }
  function schemaKabriol() {
    let s = '<rect x="40" y="10" width="60" height="200" fill="#d9b98a" fill-opacity=".35" stroke="currentColor"/>';
    s += '<path d="M76 10V58C100 64 100 80 96 96C88 130 74 168 74 186C78 196 92 198 92 210H52C54 198 62 194 62 186C60 168 54 120 46 80C42 70 40 62 40 58V10" fill="#c9975c" fill-opacity=".7" stroke="currentColor"/>';
    s += t(70, 226, 'plocha 1', 'middle', 10);
    s += '<rect x="170" y="10" width="60" height="200" fill="#d9b98a" fill-opacity=".35" stroke="currentColor"/>';
    s += '<path d="M194 10V58C170 64 170 80 174 96C182 130 196 168 196 186C192 196 178 198 178 210H218C216 198 208 194 208 186C210 168 216 120 224 80C228 70 230 62 230 58V10" fill="#c9975c" fill-opacity=".7" stroke="currentColor"/>';
    s += t(200, 226, 'plocha 2 (otočeno o 90°)', 'middle', 10);
    s += t(290, 90, '1. řez pásovkou', 'middle', 10, A) + t(290, 104, 'odřezky přilepit zpět', 'middle', 10, A) + t(290, 130, '2. řez z boku', 'middle', 10, A);
    return fig(340, 236, s, 'Stejná šablona na dvou sousedních plochách hranolu; po prvním řezu se odřezky přichytí zpět, aby hranol měl rovnou opěrnou plochu pro druhý řez.');
  }
  function schemaKuzel() {
    let s = '<rect x="10" y="40" width="320" height="110" fill="#d9b98a" fill-opacity=".25" stroke="currentColor"/>' + t(170, 168, 'saně (posuv podél podélného pravítka pily)', 'middle', 10);
    s += '<path d="M10 150H330" stroke="#b3261e" stroke-width="2.5"/>' + t(300, 144, 'kotouč', 'middle', 10, '#b3261e');
    s += '<path d="M40 128L300 92" stroke="currentColor" stroke-width="3"/>' + t(170, 98, 'opěrné pravítko pod úhlem α', 'middle', 10);
    s += '<path d="M40 128L40 158L300 150L300 92" fill="#c9975c" fill-opacity=".5" stroke="currentColor"/>';
    s += `<path d="M28 128V158" stroke="${A}"/>` + t(24, 146, 'u', 'end', 11, A) + '<rect x="24" y="112" width="16" height="50" fill="none" stroke="currentColor"/>' + t(32, 106, 'zarážka', 'middle', 9);
    return fig(340, 178, s, 'Přípravek na kuželové nohy: noha leží na pravítku, které svírá s hranou saní (linií kotouče) úhel α = atan(u / délka zúžení).');
  }
  function schemaSoustruh() {
    let s = '<path d="M20 100H320" stroke="currentColor" stroke-dasharray="10 3 2 3"/>';
    s += '<path d="M30 100V60H80C90 60 90 40 100 40C110 40 110 60 120 60L180 70Q220 80 260 50H310V100" fill="#c9975c" fill-opacity=".6" stroke="currentColor"/>';
    s += '<path d="M30 52H80C90 52 90 32 100 32C110 32 110 52 120 52L180 62Q220 72 260 42H310V20H30Z" fill="#9fc5a8" fill-opacity=".55" stroke="currentColor"/>' + t(170, 16, 'kontrolní šablona = negativ profilu', 'middle', 10);
    s += '<rect x="40" y="128" width="260" height="30" fill="none" stroke="currentColor"/>';
    for (const [x, w] of [[60, 30], [120, 22], [170, 18], [230, 26]]) s += `<path d="M${x} 128V140H${x + w}V128" fill="none" stroke="${A}" stroke-width="1.5"/>`;
    s += t(170, 172, 'měrka průměrů: výřez = přesný Ø v kótovaném místě', 'middle', 10);
    return fig(340, 180, s, 'Výkres → měrka průměrů (sizing) pro hrubé kroky a rozměrová lať pro polohy → kontrolní šablona pro výsledný tvar.');
  }
  function schemaLista() {
    let s = '<path d="M20 30H250A40 40 0 0 1 290 70V150H20Z" fill="#d9b98a" fill-opacity=".5" stroke="currentColor"/>';
    s += '<circle cx="250" cy="70" r="40" fill="none" stroke="currentColor" stroke-dasharray="3 3"/>' + t(250, 74, 'R', 'middle', 11, A);
    s += '<rect x="290" y="96" width="14" height="40" rx="4" fill="#bbb" stroke="currentColor"/>' + t(310, 120, 'ložisko', 'start', 9);
    s += `<path d="M300 30V70" stroke="${A}"/>` + t(306, 52, 'výška řezu', 'start', 9, A);
    return fig(360, 160, s, 'Fréza s ložiskem se vede po zbylé ploše boku; když profil zabere celý bok, musí se vést pravítkem frézovacího stolu.');
  }

  const BEZP_PASOVKA = '<li><b>Pásová pila:</b> vodítko kotouče 3–5 mm nad dílem, ruce mimo dráhu pilového pásu, oblouky řežte s odlehčovacími řezy; malé díly posunujte hranolkem.</li>';
  const BEZP_FREZA = '<li><b>Horní frézka / frézovací stůl:</b> fréza proti směru posuvu (sousledně nikdy z ruky), úběr po vrstvách, krátké díly přidržovat přítlakem nebo v přípravku, ochranné brýle a chrániče sluchu.</li>';
  const BEZP_SOUSTRUH = '<li><b>Soustruh:</b> opěrka nože co nejblíž dílu, otáčky podle průměru (velký průměr = nízké otáčky), žádné rukavice, volné rukávy ani šperky. Šablonu, měrku a posuvku přikládejte <b>jen k zastavenému dílu</b>; za chodu jen zaoblený kalibr (sizing tool) spolu s nožem.</li>';
  const BEZP_PILA = '<li><b>Okružní pila:</b> kryt kotouče a rozpěrný klín ponechat, kotouč max. 5 mm nad dílem, ruce na saních a posunovači – nikdy mezi pravítko a kotouč. Noha musí být v saních upnutá rychloupínkami; odřezky neodstraňovat za chodu.</li>';

  function princip(rezim) {
    let h = '';
    if (['tetiva', 'tribody', 'segment'].includes(rezim)) {
      h += '<h3>Kruhový oblouk</h3><p>Oblouk je určen tětivou <i>c</i> (rozpětím) a vzepětím <i>h</i> (výškou nad tětivou): <b>R = (c²/4 + h²) / 2h</b>. Opačně z poloměru: h = R − √(R² − c²/4). Středový úhel je 4·atan(2h/c) a délka oblouku R × úhel. U velkých poloměrů (lub stolu R 2–5 m) střed nenakreslíte – proto stránka dává <b>pořadnice</b>: výšky oblouku nad tětivou po zvoleném kroku. Body vynesete úhelníkem a spojíte pružnou latí.</p>' + schemaTetiva();
      h += '<p>Oblouk ze tří bodů je kružnice opsaná trojúhelníku: střed leží na průsečíku os úseček P1P2 a P2P3. Hodí se, když tvar odměříte na zdi nebo staré předloze.</p>';
      if (rezim === 'segment') h += '<h3>Segmentový oblouk</h3><p>Z <i>n</i> lichoběžníků vznikne prstenec nebo oblouk o úhlu Θ. Každé čelo segmentu se řízne pod úhlem <b>Θ / 2n</b> od kolmice (12 segmentů na kruh = 15°). Vnější hrana lichoběžníku je tečnou k vnějšímu poloměru (2·R·tg φ), vnitřní hrana je volená tak, aby se do materiálu vešel i vnitřní oblouk – tomu odpovídá šířka prkna R − r·cos φ. Chyba úhlu se násobí 2n: u 12 segmentů dělá 0,1° na řezu mezeru 2,4° v posledním spoji, proto nejdřív slepte „nasucho“ a poslední spoj dorovnejte.</p>';
    }
    if (rezim === 'elipsa') h += '<h3>Elipsa a provázek</h3><p>Elipsa je množina bodů, jejichž součet vzdáleností od dvou ohnisek je stálý (= 2a, délka hlavní osy). Ohniska leží na hlavní ose ve vzdálenosti <b>c = √(a² − b²)</b> od středu. Do ohnisek zatlučte hřebíky, provázek svažte do smyčky délky <b>2a + 2c</b> (nebo uvažte konce na hřebíky s volnou délkou 2a) a tužkou provázek napínejte. Stránka v testech konstrukci provázkem nasimuluje a ověří, že body leží na parametrické elipse x = a cos t, y = b sin t.</p>' + schemaProvazek() + '<p>Obvod elipsy nemá jednoduchý vzorec – uvádí se Ramanujanova aproximace (chyba pod 0,01 % pro truhlářské poměry). Provázek se natahuje – použijte nepružný (zednická šňůra, kevlar) a zkontrolujte délku na ose: vrchol musí vyjít přesně v ±a.</p>';
    if (rezim === 'parabola') h += '<h3>Parabola</h3><p>Parabola y = h·(1 − (2x/w)²) má vrchol uprostřed a paty v ±w/2. Každý její bod je stejně daleko od ohniska (f = w²/16h pod vrcholem) a od řídicí přímky. Proti kruhovému oblouku je u paty strmější a ve vrcholu plošší – lub působí „napjatěji“. Poloměr křivosti ve vrcholu je 2f.</p>';
    if (rezim === 'retezovka') h += '<h3>Řetězovka</h3><p>Volně visící řetěz má tvar y = a·(cosh(x/a) − 1). Parametr <i>a</i> se z rozpětí a průvěsu dopočítá numericky (půlením intervalu). Obrácená řetězovka je tvar, ve kterém klenba přenáší jen tlak – proto ji používal Gaudí. Tvar si snadno ověříte: pověste řetízek uvedené délky mezi dva body ve vzdálenosti rozpětí.</p>';
    if (rezim === 'lat') h += '<h3>Pružná lať (spline)</h3><p>Lodní a nábytkáři kreslili plynulé křivky ohnutou latí (batten) přidržovanou hřebíky nebo závažími („kachny“). Lať zaujme tvar s nejmenší energií ohybu ∫κ² ds. Pro malé průhyby je to <b>přirozený kubický spline</b>: mezi body je průhyb kubický polynom (EI·y⁗ = 0), v bodech je spojitá první i druhá derivace a volné konce nemají ohybový moment (y″ = 0). Pro větší ohyby (křivka se stáčí, body nejdou zleva doprava) stránka použije <b>parametrický spline podle délky oblouku</b>, který se elastice blíží.</p>' + schemaLat() + '<p><b>Hřebínek křivosti</b> (zelené čáry kolmo ke křivce úměrné křivosti) ukazuje plynulost – skoky nebo zuby znamenají „hrbol“, který by bylo vidět v odlesku laku. <b>Nejmenší poloměr</b> určuje, jak tlustou lať lze ohnout: přetvoření na povrchu je t / 2R. Suché dřevo snese typicky 0,5–1 % (hodnota je editovatelná), napařené buk/jasan i 2–5 %.</p>';
    if (rezim === 'kabriol') h += '<h3>Kabriolová noha</h3><p>Nohy ve stylu Queen Anne/Chippendale se kreslí jedinou šablonou: <b>přední čára</b> (koleno, kotník, špička) a <b>zadní čára</b>. Předlohy v knihách bývají v mřížce (1 čtverec = 1 palec); body opíšete ve čtvercích a stránka je převede na zvolenou velikost čtverce – klasická metoda zvětšování přes mřížku. Mezi body vede spline, v bodech s příznakem „roh“ je ostrý přechod (např. hlava/koleno).</p>' + schemaKabriol() + '<p>3D náhled ukazuje tvar po vyřezání ze dvou stran (průnik dvou vytažených profilů) – průřez je v každé výšce čtverec. Teprve potom se noha ručně zaobluje rašplí, páskou a škrabkou; kotník bývá kulatý, koleno se dotváří v návaznosti na lub a „ucha“.</p>';
    if (rezim === 'kuzel') h += '<h3>Kuželová noha</h3><p>Zúžení začíná pod čtyřhranem (kde se napojují luby) a na patu ubírá <b>u</b> na každé zúžené straně. Úhel přípravku je α = atan(u / délka zúžení). Zužujte vždy vnitřní strany – vnější zůstanou svislé a stůl působí stabilně.</p>' + schemaKuzel() + '<p>Při zúžení <b>protilehlých</b> stran leží druhá plocha na pravítku už zúžená – úhel nohy vůči kotouči se tím zmenší o α. Proto se pro protilehlé strany nastavuje <b>dvojnásobný posun (2α)</b>, nebo se mezi pravítko a patu vloží podložka tloušťky u (stránka ji vykreslí i jako STL). Sousední strany se řežou se stejným nastavením.</p>';
    if (rezim === 'soustruh') h += '<h3>Soustružený profil</h3><p>Profil se skládá z prvků: <b>válec</b>, <b>kužel</b>, <b>korálek</b> (bead – kruhový oblouk vypouklý), <b>výžlabek</b> (cove – vydutý), <b>ogee</b> (S-křivka ze dvou stejných oblouků s vodorovnou tečnou na koncích), <b>zaoblení</b> (čtvrtelipsa na konci) a <b>čtyřhran</b> (pommel – neotáčená část nohy). Mezi prvky může být osazení (skok průměru).</p>' + schemaSoustruh() + '<p>Postup soustružníka: hranol se nejdřív osoustruží na válec, rozměrovou latí se tužkou přenesou polohy hranic, upichovákem a posuvkou/kalibrem (sizing tool) se v každém kótovaném místě zapíchne na průměr z <b>měrky průměrů</b> a teprve pak se tvar mezi zápichy dotvaruje. Výsledek se kontroluje <b>negativní šablonou</b> s vůlí. U série (4 nohy, příčky) to zaručí shodnost.</p>';
    if (rezim === 'lista') h += '<h3>Profily hran</h3><p><b>Oblounek</b> (roundover) je čtvrtkruh na rohu; spuštěná fréza vytvoří osazení (ovolo s výstupkem). <b>Výžlabek</b> (cove) je vydutý čtvrtkruh. <b>Ogee</b> spojuje vypouklou a vydutou část – cyma reversa (vypouklé nahoře) a římské ogee / cyma recta (výžlabek nahoře). <b>Fazeta</b> je zkosení, <b>polodrážka</b> osazení pro zadní stěnu nebo sklo.</p>' + schemaLista() + '<p>Poloměry fréz se vyrábějí v typických řadách (metrické i palcové – 6,35 = ¼″, 9,5 = ⅜″, 12,7 = ½″); seznam je editovatelný. Hloubka úběru na průchod je typická hodnota – podle stroje a dřeva ji upravte.</p>';
    if (rezim === 'operadlo') h += '<h3>Prohnuté opěradlo</h3><p>Přední (vydutá) plocha opěradla je kruhový oblouk z šířky a prohnutí; zadní plocha je soustředná o tloušťku dál. <b>Rozvinutá délka</b> se počítá na střední ploše (neutrální vrstva). Lepená lamela se lisuje mezi dvě formy – vnitřní (vypouklou) a vnější (vydutou) – jejichž poloměry se liší o tloušťku lamely.</p><p>Po vyjmutí z formy se lamela trochu narovná (<b>odpružení</b>). Orientačně se uvádí, že ztráta křivosti klesá se čtvercem počtu vrstev (≈ 1/n²); formy se proto ohnou o tuto hodnotu víc. Je to hrubé pravidlo – závisí na dřevu, lepidle a době lisování; ověřte ho na zkušebním kusu a hodnotu zadejte jako vlastní %.</p>';
    if (rezim === 'apron') h += '<h3>Oblouk lubu</h3><p>Výřez spodní hrany odlehčí lub opticky i hmotnostně. U nohou se nechávají rovné konce (rameno), kde lub nese čep a rohovou spojku. Kruhový oblouk je nejklidnější, elipsa a parabola mají strmější konce, dvojitý oblouk s nožkou je typický pro komody. Nad výřezem nechte aspoň 15 mm – lub nese desku i zásuvku. Poloviční šablona šetří papír: obkreslete, otočte podle osy a obkreslete druhou polovinu – lub vyjde přesně souměrný.</p>';
    h += '<h3>Tisk 1:1 a kontrola</h3><p>PDF je v milimetrech; každý list má kontrolní úsečky <b>100 mm vodorovně i svisle</b> a poslední strana čtverec 50 × 50 mm. Tiskněte ve skutečné velikosti (100 %, vypnuté „přizpůsobit stránce“), úsečky změřte a odchylku zadejte do kalibrace. Velké šablony se dělí na listy s přesahem a značkami; listy slepte podle čárkovaných čar. SVG a DXF jsou v mm pro řezací plotr, laser nebo CNC.</p>';
    h += '<p>STL kontrolní šablony je deska zadané tloušťky; větší než tisková plocha se rozdělí na kusy se <b>rybinovými zámky</b> (vůle nastavitelná) a vyrytým označením. Tiskněte <b>PETG</b> (pružnější, méně křehké než PLA) s 3–4 perimetry, šablonu kontrolujte proti výtisku 1:1.</p>';
    return h;
  }

  function postup(rezim) {
    let h = '<h3>Šablona</h3><ol><li>Vytiskněte PDF 1:1, změřte kontrolní úsečky (u odchylky nad 0,3 % zadejte kalibraci a tiskněte znovu).</li>'
      + '<li>Listy slepte podle čárkovaných čar, nalepte na MDF / překližku 4–6 mm (sprejové lepidlo) a vyřízněte těsně vedle čáry; dorovnejte rašplí a smirkem na čáru.</li>'
      + '<li>Hranu šablony zkontrolujte proti pořadnicím nebo kótám. Šablona z tvrdého materiálu poslouží i pro kopírovací frézu s ložiskem.</li></ol>';
    if (['tetiva', 'tribody', 'elipsa', 'parabola', 'retezovka', 'lat', 'apron'].includes(rezim)) h += '<h3>Přenesení na díl</h3><ol><li>Obkreslete šablonu ostrou tužkou, u velkých dílů vyneste pořadnice úhelníkem a spojte je pružnou latí přidrženou hřebíčky.</li><li>Vyřízněte pásovou pilou nebo přímočarou pilou 1–2 mm vedle čáry, dorovnejte vřetenovou bruskou, hoblíkem s vypouklou botkou nebo kopírovací frézou podle šablony přichycené oboustrannou páskou.</li><li>Při kopírování frézou ubírejte nejvýš 2–3 mm – zbytek odřízněte předem.</li></ol>';
    if (rezim === 'segment') h += '<h3>Segmenty</h3><ol><li>Na pokosové pile nebo na saních okružní pily nastavte úhel, zkušebně uřízněte 4 kusy a složte do 90° (u prstence 12 segmentů tři kusy = 90°).</li><li>Segmenty řežte střídavě otočené z jednoho pásu s dorazem na délku vnější hrany.</li><li>Lepte po polovinách, poloviny srovnejte na brusném papíru na desce a teprve pak slepte k sobě – poslední spoj tak sedí.</li></ol>';
    if (rezim === 'kabriol') h += '<h3>Výroba nohy</h3><ol><li>Hranol srovnejte do pravého úhlu, vyznačte vnitřní roh. Nejdřív vyfrézujte dlaby pro luby – na hranolu je to snadné.</li><li>Šablonu obkreslete na dvě sousední vnitřní plochy (koleno k vnějšímu rohu).</li><li>Vyřízněte první plochu, odřezky přichyťte zpět páskou, otočte o 90° a vyřízněte druhou.</li><li>Zaoblete rašplí, škrabkou a brusným papírem; kotník převeďte do kruhového průřezu, chodidlo vytočte na soustruhu nebo ručně.</li></ol>';
    if (rezim === 'kuzel') h += '<h3>Zúžení na pile</h3><ol><li>Saně slepte a sešroubujte podle výkresu, hranu saní ořízněte prvním průchodem podél pravítka – tím je linie kotouče přesně na hraně.</li><li>Na nohu vyznačte začátek zúžení, položte ji na pravítko s patou u zarážky a upněte rychloupínkami.</li><li>Řežte sousední plochy se stejným nastavením; protilehlé s dvojnásobným posunem nebo s podložkou tl. u u paty.</li><li>Stopy pily dorovnejte hoblíkem; přechod u čtyřhranu nechte ostrý nebo ho lehce zaoblete.</li></ol>';
    if (rezim === 'soustruh') h += '<h3>Soustružení</h3><ol><li>Hranol vystřeďte (úhlopříčky), čtyřhrany vyznačte a mezi nimi osoustružte na válec mírně nad největší Ø.</li><li>Rozměrovou lať přiložte k otáčejícímu se válci a tužkou přeneste hranice prvků.</li><li>V kótovaných místech zapíchněte upichovákem na průměr – kalibrem nastaveným podle měrky (výřez), nebo posuvkou za klidu.</li><li>Tvarujte mezi zápichy: korálky a ogee řezákem nebo žlábkovým nožem, výžlabky žlábkovým nožem od okraje ke dnu.</li><li>Zastavte stroj a přiložte kontrolní šablonu; opravte, obruste a povrchově upravte na stroji.</li></ol>';
    if (rezim === 'lista') h += '<h3>Frézování</h3><ol><li>Nejdřív vyzkoušejte na odřezku stejné tloušťky – výšku frézy nastavte podle šablony.</li><li>Ubírejte po vrstvách (hloubka na průchod viz hodnoty), poslední průchod tenký pro čistý povrch.</li><li>U desek frézujte nejdřív čela (napříč vláken), pak podélné hrany – vytržení na rozích se tím odfrézuje.</li></ol>';
    if (rezim === 'operadlo') h += '<h3>Ohýbaná lamela</h3><ol><li>Formy vyřízněte z vrstev MDF slepených na výšku, kontaktní plochy dorovnejte na čáru a přelepte balicí páskou (lepidlo se nepřichytí).</li><li>Dýhy nařežte s přídavkem, natřete lepidlo válečkem na všechny styčné plochy, vložte mezi formy a stahujte svěrkami od středu ke krajům.</li><li>Nechte v lisu alespoň dvojnásobek doby udávané pro lepidlo, po vyjmutí lamelu den nechte odpočinout, pak ořízněte na délku a šířku.</li><li>Z masivu: obkreslete obě křivky na polotovar, řízněte pásovou pilou nejdřív vypouklou stranu, pak vydutou.</li></ol>';
    h += '<h3>Bezpečnost</h3><ul>' + BEZP_PASOVKA;
    if (rezim === 'kuzel' || rezim === 'segment') h += BEZP_PILA;
    if (rezim === 'lista' || rezim === 'apron' || rezim === 'tetiva') h += BEZP_FREZA;
    if (rezim === 'soustruh') h += BEZP_SOUSTRUH;
    h += '<li>Prach z tvrdého dřeva a MDF je zdraví škodlivý – odsávání a respirátor FFP2.</li></ul>';
    return h;
  }
  const postupText = (rezim) => postup(rezim).replace(/<\/(li|h3)>/g, '\n').replace(/<[^>]+>/g, '').split('\n').map((s) => s.trim()).filter(Boolean);

  koren.OBLPrincip = { princip, postup, postupText };
})(typeof window !== 'undefined' ? window : globalThis);

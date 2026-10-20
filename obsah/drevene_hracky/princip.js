/* ============================================================
   Dřevěné hračky – oddíly „Jak to funguje“, „Postup výroby“ a „Bezpečnost a zdroje“ (HTML + schémata, bez DOM)
   ============================================================ */
(function (koren) {
  'use strict';
  const fig = (w, h, obsah, popis) => `<figure class="schema"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${popis}" font-family="sans-serif">${obsah}</svg><figcaption>${popis}</figcaption></figure>`;
  const t = (x, y, s, a, vel, c) => `<text x="${x}" y="${y}" font-size="${vel || 10}" text-anchor="${a || 'middle'}" fill="${c || 'currentColor'}">${s}</text>`;
  const D = '#d9b98a', D2 = '#b98552', MOD = '#1f5fa8', CER = '#c0392b', ZEL = '#2e8b57';

  const SCHEMA = {
    kostky: () => fig(340, 130,
      `<rect x="10" y="80" width="40" height="40" fill="${D}" stroke="currentColor"/>${t(30, 75, '1:1:1')}` +
      `<rect x="60" y="80" width="80" height="40" fill="${D}" stroke="currentColor"/>${t(100, 75, '1:1:2')}` +
      `<rect x="150" y="80" width="160" height="40" fill="${D}" stroke="currentColor"/>${t(230, 75, '1:1:4 = 2 × 1:1:2 = 4 krychle')}` +
      `<rect x="150" y="20" width="160" height="20" fill="${D2}" stroke="currentColor"/>${t(230, 14, 'destička ½ : 1 : 4 – dvě nad sebou = výška modulu')}` +
      `<path d="M10 40H50V0Z" transform="translate(0 20)" fill="${D2}" stroke="currentColor"/>${t(30, 70, '½ krychle', 'middle', 8)}`,
      'Modulová stavebnice: všechny délky jsou násobky modulu M, takže se kostky vzájemně nahrazují a věže zůstávají rovné.'),
    draha: () => fig(340, 150,
      `<rect x="20" y="20" width="90" height="90" fill="${D}" stroke="currentColor"/><rect x="120" y="20" width="90" height="90" fill="${D}" stroke="currentColor"/>` +
      `<path d="M20 65H110" stroke="${D2}" stroke-width="18"/><path d="M120 65A45 45 0 0 1 165 110" fill="none" stroke="${D2}" stroke-width="18"/>` +
      `<circle cx="60" cy="65" r="7" fill="${MOD}"/>${t(65, 132, 'rovná drážka', 'middle', 9)}${t(165, 132, 'zatáčka R = M/2', 'middle', 9)}` +
      `<path d="M230 40L320 52" stroke="currentColor"/><path d="M230 40V100H320V52" fill="none" stroke="currentColor"/><path d="M230 46L320 58" stroke="${CER}" stroke-dasharray="4 3"/>` +
      t(275, 34, 'hloubka drážky roste o sklon × délka', 'middle', 9) + t(275, 118, 'věž je vodorovná, sklon je v drážce', 'middle', 9),
      'Každý modul v patře má o něco hlubší drážku, takže kulička jede dolů i ve vodorovně poskládané věži; na konci patra propadne otvorem do modulu pod ním.'),
    puzzle: () => fig(340, 120,
      `<path d="M20 20H120V100H20Z" fill="${D}" stroke="currentColor"/><path d="M70 20V48A10 10 0 1 1 70 72V100" fill="none" stroke="${CER}" stroke-width="2"/>` + t(70, 115, 'zámek (jigsaw)', 'middle', 9) +
      `<path d="M190 20H290V100H190Z" fill="${D}" stroke="currentColor"/><path d="M240 20C250 40 230 60 240 80S240 95 240 100" fill="none" stroke="${ZEL}" stroke-width="2"/>` + t(240, 115, 'slepý dílek (vlnka) – pro nejmenší', 'middle', 9),
      'Sousední dílky sdílejí tutéž čáru řezu – proto se nepřekrývají a dohromady pokryjí celý obrázek.'),
    valec: () => fig(340, 120,
      `<path d="M40 20V100L60 110V30Z" fill="none" stroke="currentColor"/><ellipse cx="50" cy="25" rx="20" ry="8" fill="none" stroke="currentColor"/>` +
      t(50, 116, 'Ø 31,7 mm', 'middle', 9) + t(110, 40, 'hloubka 25,4 až 57,1 mm (šikmé dno)', 'start', 9) +
      `<rect x="45" y="55" width="12" height="22" fill="${CER}" opacity=".7"/>` + t(110, 70, 'co se celé vejde pod okraj = malý díl', 'start', 9, CER) + t(110, 90, 'pro děti do 3 let zakázané (EN 71-1)', 'start', 9, CER),
      'Zkušební válec pro malé díly: díl, který se do něj vejde bez stlačení, může dítě vdechnout nebo spolknout.'),
    stabilita: () => fig(340, 150,
      `<path d="M60 130L90 20H170L200 130Z" fill="${D}" fill-opacity=".5" stroke="currentColor"/><circle cx="130" cy="70" r="5" fill="${CER}"/>` +
      `<path d="M130 70V130" stroke="${CER}" stroke-dasharray="4 3"/><path d="M200 130L130 70" stroke="${MOD}"/>` + t(165, 145, 'rezerva d', 'middle', 9, MOD) + `<path d="M130 136H200" stroke="${MOD}"/>` +
      `<path d="M150 30H200" stroke="currentColor" stroke-width="2"/><path d="M200 26L210 30L200 34Z" fill="currentColor"/>` + t(240, 34, 'síla F ve výšce h', 'middle', 9) +
      t(260, 80, 'převrhne, když', 'middle', 10) + t(260, 96, 'F · h > m · g · d', 'middle', 11, CER),
      'Těžiště (nábytek + dítě) se musí promítat do opěrného polygonu; rezerva d k hraně a výška síly h určují, jakou silou dítě věc převrhne.'),
  };

  const P = {
    kostky: {
      princip: `<h3>Modul a poměry</h3><p>Stavebnice stojí na jednom rozměru – <b>modulu M</b>. Kvádr 1:1:2 je přesně dvě krychle, 1:1:4 čtyři, destička ½ je polovina výšky. Klasické „unit blocks“ (Caroline Prattová) mají poměr 1:2:4 (např. 35 × 70 × 140 mm). Díky tomu se dají kostky zaměňovat a stavby jsou rovné.</p>${SCHEMA.kostky()}<h3>Řezný plán</h3><p>Kostky se stejným průřezem se řežou z jednoho hranolu. Program přířezy seřadí od nejdelšího a skládá je do hranolů metodou <i>first-fit decreasing</i>; mezi kusy počítá prořez pily a na začátku odřez nerovného čela. Trojboké hranoly vzniknou úhlopříčným řezem krychle (2 ks), sloupky se soustruží z přířezu s přídavkem na upnutí.</p><h3>Kolíkové spojky</h3><p>Volitelně se do středu každého modulu nahoře i dole vyvrtá díra pro kolík – z kostek pak jde stavět i převislé tvary. Kolík je ale malý díl!</p>`,
      postup: `<ol><li>Hranol srovnejte a vytloušťkujte přesně na M (± 0,1 mm), zkontrolujte pravý úhel.</li><li>Na pokosové / formátovací pile nastavte <b>doraz (stop block)</b> na délku – všechny kusy jedné délky řežte bez přeměřování.</li><li>Oblouk: vyvrtejte Forstnerem / vyřízněte lupenkou podle šablony (střed oblouku je vyznačen křížkem).</li><li>Trojúhelníky řežte z krychle na pásové pile s přípravkem (ruce mimo pilový pás!).</li><li>Hrany zaoblete frézkou R 1–2 mm nebo ručně, brouste 120 → 180 → 240, navlhčete, přebruste.</li><li>Povrch: včelí vosk s olejem nebo bez úpravy.</li></ol><p class="info">Bezpečnost u strojů: krátké kusy (pod 150 mm) nikdy neřežte volnou rukou u kotouče – používejte posuvné saně a přítlačnou lištu, nebo nejprve uřízněte delší kus a zkracujte s dorazem mimo kotouč (odřezek nesmí zůstat sevřený mezi kotoučem a dorazem).</p>`,
    },
    draha: {
      princip: `<h3>Jak se kulička valí</h3><p>Moduly jsou krychle M × M × M. Věž je poskládaná vodorovně, sklon je v <b>drážce</b>: v každém modulu se drážka prohlubuje o <i>sklon × délka dráhy v modulu</i>. Na konci patra kulička propadne otvorem do modulu pod ním a začne znovu z menší hloubky.</p>${SCHEMA.draha()}<h3>Fyzika (zjednodušeně)</h3><p>Valící se koule má zrychlení <b>a = 5/7 · g · (sin θ − C<sub>rr</sub> · cos θ)</b> (5/7 kvůli rotační energii). V zatáčce se počítá dvojnásobný odpor (tření o stěnu). Po pádu otvorem simulace konzervativně začíná z klidu. V zatáčce o poloměru R vyjede kulička přes okraj drážky, když v² / (g·R) > tan φ, kde φ je úhel, při kterém přejede přes hranu drážky hloubky e (cos φ = 1 − e/r).</p><p>Dráha pod 2 % sklonu je citlivá na nepřesnost výroby a stůl, nad 8 % je kulička rychlá a hlučná.</p>`,
      postup: `<ol><li>Vyrobte krychle M (jako u kostek, přesně!).</li><li>Drážky: stolní frézka s kopírovacím kroužkem nebo CNC; kulová fréza Ø = šířka drážky. Hloubku na vstupu a výstupu přečtěte ze šablony – frézujte s přípravkem se šikmou podložkou (sklon), nebo v CNC po dráze.</li><li>Zatáčky: frézujte podle šablony s R = M/2 kolem rohu (šablonu nalepit na MDF jako vodítko pro kopírovací kroužek).</li><li>Propadové otvory: stojanová vrtačka, Forstner Ø otvoru, skrz.</li><li>Startovní modul má misku – Forstner většího průměru mělce.</li><li>Brousit drážky (válcový brousek), aby kulička neskákala.</li></ol><p class="info">U frézky veďte malé kostky v přípravku s přítlačnými rukojeťmi, nikdy prsty u frézy.</p>`,
    },
    zviratka: {
      princip: `<h3>Tvary</h3><p>Zvířátka jsou nakreslená ze základních tvarů (elipsy, kruhy, tlusté čáry) a sjednocená; kouty se zaoblí <i>uzavřením</i> obrysu (offset +r a −r), takže se dobře řežou lupenkovou pilou a nemají křehké špičky. Oči a ucho jsou jen gravírované čáry – žádné otvory 5–12 mm, do kterých by se zasekl prst.</p><p>Vlastní tvar lze importovat ze SVG (path, polygon, rect, circle, ellipse, transformace skupin) – vyplněné plochy se sjednotí.</p><h3>Stojící figurka</h3><p>Figurka stojí, pokud se těžiště jejího obrysu promítá do chodidel. Program spočítá šířku opory a úhel, při kterém se převrhne (dopředu i do boku – proto záleží na tloušťce).</p><h3>Dílky a vkládačka</h3>${SCHEMA.puzzle()}<p>Zvířátko se rozdělí mřížkou řezů ořezanou obrysem; malé zbytky se připojí k sousednímu dílku. Vkládačka je rám s výřezy, pod ním podložka; dílek má úchyt (kolíček).</p>`,
      postup: `<ol><li>Vytiskněte PDF 1:1, zkontrolujte měřítko, šablonu nalepte na desku (lepidlo na papír, páska pod šablonu se snadno sloupne).</li><li>Lupenková pila: pilka č. 5–7 na 18 mm, stůl kolmo; ostré kouty řežte nadvakrát.</li><li>Vnitřní výřezy (rám vkládačky): navrtejte otvor Ø 2 na čáře, provlečte pilku.</li><li>Zaoblete hrany (frézka R 2 s ložiskem, ručně brusný papír), odstraňte třísky.</li><li>Detaily vypalte pyrografem nebo vyryjte laserem.</li><li>Úchyty vlepte (PVA D3), nechte vytvrdit 24 h a zkuste tahem.</li></ol><p class="info">U lupenkové pily držte ruce po stranách pilky, nikdy před ní; malé kusy přidržujte přítlačnou patkou.</p>`,
    },
    puzzle: {
      princip: `<h3>Dělení na dílky</h3><p>Deska se rozdělí na řádky × sloupce tak, aby buňky byly co nejvíc čtvercové. Každá vnitřní hrana je jedna lomená čára – <b>zámek</b> (krk a kulatá hlava, na náhodnou stranu) nebo <b>vlnka</b> (slepý dílek bez zámků, snadno se skládá). Sousední dílky sdílejí stejnou čáru, takže se nepřekrývají a pokrývají celý obrázek – program to kontroluje součtem ploch a průniky dvojic.</p>${SCHEMA.puzzle()}<h3>Velikost podle věku</h3><p>Pro mladší děti méně a větších dílků (typické doporučení): 2 roky do 6 dílků ≥ 60 mm, 3 roky do 12 ≥ 48 mm, 4 roky do 24, 6 let do 60. Každý dílek se navíc prověří zkušebním válcem pro malé díly.</p>`,
      postup: `<ol><li>Vytiskněte list s obrázkem 1:1 (laserovou tiskárnou, nebo pigmentovým inkoustem).</li><li>Přilepte na překližku (sprej / lepidlo na papír), vyhlaďte bez bublin, zatižte.</li><li>Přelakujte vodou ředitelným lakem s EN 71-3, nechte zaschnout.</li><li>Řežte lupenkovou pilou pilkou č. 2–3 (zámky) ze strany obrázku, nebo laserem (SVG / DXF bez popisů).</li><li>Hrany dílků lehce přebruste, aby se nelámala vlákna.</li></ol>`,
    },
    tahaci: {
      princip: `<h3>Kola, osy a světlá výška</h3><p>Osa leží ve výšce poloměru kola nad zemí. Spodek podvozku je o <i>výšku osy v podvozku</i> níž – rozdíl je světlá výška. Kolo se točí buď s osou v otvoru podvozku s vůlí (kola nalepená na osu), nebo samo na kolíku s hlavou (kolík zalepený v podvozku). Mezi kolem a bokem musí být mezera / podložka, jinak drhne.</p><p>STL kolo má na vnitřní straně náboj, který podložku nahrazuje. Tištěné kolíky mají ve středu otvor pro ocelový drát – tištěný dřík se ve smyku láme mezi vrstvami.</p>`,
      postup: `<ol><li>Podvozek vyřízněte z hranolu, otvory os vrtejte na stojanové vrtačce s dorazem (obě strany stejně vysoko!).</li><li>Kola: korunkový vrták / kruhová řezačka, nebo kotouče z kulatiny; středový otvor vrtat s přípravkem kolmo.</li><li>Nástavbu (kabinu) vyřízněte podle šablony, okna Forstnerem, přilepte s kolíkem.</li><li>Brousit, zaoblit, povrch.</li><li>Osadit kola (lepit jen ta část, která se netočí), zkontrolovat volný chod.</li><li>Šňůru zakončit uzlem zapuštěným v zahloubení.</li></ol><p class="info">Kola na pásové pile neřežte z ruky – kruhová řezačka nebo korunka ve stojanové vrtačce, obrobek upnutý.</p>`,
    },
    vez: {
      princip: `<h3>Výška plošiny</h3><p>Dítě má pracovat s deskou linky asi 5–10 cm pod loktem. Výška lokte ve stoje je přibližně 0,63 × výška postavy. Plošina se proto staví na <b>linka − (loket − 8 cm)</b>, s několika polohami na lištách, aby rostla s dítětem. Zábradlí má sahat aspoň do poloviny výšky dítěte nad plošinou.</p>${SCHEMA.stabilita()}<h3>Převržení</h3><p>Těžiště věže a dítěte musí ležet nad opěrným polygonem (obrys nohou na podlaze). Program počítá rezervu k nejbližší hraně a sílu, kterou dítě převrhne věž, když se opře do zábradlí: F<sub>krit</sub> = m·g·d / h. Proto je věž dole hlubší než nahoře.</p>`,
      postup: `<ol><li>Bočnice vyřízněte z překližky 18 mm (kruhová pila s vodicí lištou), madla navrtat v rozích Ø 32 a vyříznout přímočarou pilou.</li><li>Otvory pro příčky Forstnerem hl. 12 mm – obě bočnice spolu (zrcadlově!).</li><li>Lišty pro plošinu přilepit a přišroubovat na vyznačené čáry.</li><li>Sestavit s příčkami a vzpěrami, zkontrolovat úhlopříčky.</li><li>Plošinu přišroubovat k liště, aby nevyklouzla.</li><li>Zaoblit všechny hrany R ≥ 3, povrch lak s EN 71-3.</li></ol><p class="info">Velké desky na kruhové pile vždy s vodicí lištou nebo podélným pravítkem a štípacím klínem; úzké pruhy s přítlačnou lištou.</p>`,
    },
    stul: {
      princip: `<h3>Ergonomie podle EN 1729-1</h3><p>Norma ČSN EN 1729-1 rozděluje dětský školní nábytek do <b>velikostí 0–7</b> podle tělesné výšky a ke každé předepisuje výšku sedu (h8) a výšku stolu (h1). Pro dítě, jehož výška padne do dvou pásem, program volí to, jehož středu je blíž. Výšku podle věku odhaduje z mediánu WHO; skutečná výška dítěte je vždy lepší.</p><p>Druhá možnost je <i>úměrně</i>: sed ≈ zákolenní výška ≈ 0,25 × výška postavy, stůl ≈ sed + 0,165 × výška. Pod lubem stolu musí zbýt místo na stehna (≈ sed + 0,085 × výška + 2 cm).</p>${SCHEMA.stabilita()}<p>Židle se nejčastěji převrhne dozadu, když se dítě zakloní – zadní nohy proto sahají až pod opěradlo.</p>`,
      postup: `<ol><li>Nohy a luby nařežte na čisto, čepy na lubech (15 mm) a dlaby v nohách – nebo kolíky Ø 8.</li><li>Rámy slepte ve dvou krocích (nejdřív dva protilehlé boky), kontrolujte úhlopříčky.</li><li>Desku stolu připevněte příchytkami (deska pracuje), rohy R ≥ 10 mm.</li><li>Sedák přišroubujte zespodu, přední hranu zaoblete.</li><li>Dole filcové podložky.</li></ol><p class="info">Dlaby na stojanové vrtačce / dlabačce, obrobek upnout do svěráku; čepy na kotoučové pile jen s posuvnými saněmi.</p>`,
    },
    skrinka: {
      princip: `<h3>Převržení a kotvení</h3><p>Dítě po policích šplhá jako po žebříku – jeho hmotnost na přední hraně a tah nahoře převrátí i těžkou skříňku. Program počítá dva případy (zkušební hmotnost na přední hraně s tahem; šplhající dítě) a doporučí <b>kotvení ke zdi</b>, pokud je skříňka vyšší než 600 mm, štíhlá nebo málo stabilní.</p>${SCHEMA.stabilita()}<h3>Truhla s víkem</h3><p>Do truhly se dítě vejde – EN 71-1 proto u takových hraček požaduje větrací otvory a víko, které samo nespadne (zpomalovač / držák víka). Mezera v pantu je místo přivření prstů.</p>`,
      postup: `<ol><li>Desky nařežte (formátovací pila / kruhová s lištou), hrany olepte nebo zaoblete.</li><li>Spoje: kolíky Ø 8 + konfirmáty, záda do polodrážky.</li><li>Sestavit, zkontrolovat úhlopříčky, přibít záda.</li><li>Truhla: osadit pant a zpomalovač víka, vyvrtat větrací otvory.</li><li>Připevnit ke zdi kotvicím páskem.</li></ol>`,
    },
  };

  const ZDROJE = `<h3>Zdroje a normy (uvádějte vždy aktuální znění)</h3><ul>
    <li><b>ČSN EN 71-1</b> Bezpečnost hraček – Mechanické a fyzikální vlastnosti: zkušební válec pro malé díly (Ø 31,7 mm, hloubka 25,4–57,1 mm), ostré hrany, šňůry, magnety, prostory, do kterých se dítě vejde.</li>
    <li><b>ČSN EN 71-3</b> Migrace určitých prvků – požadavek na barvy a laky hraček.</li>
    <li><b>ČSN EN 1729-1</b> Nábytek – Židle a stoly pro vzdělávací instituce – Funkční rozměry (velikosti 0–7, výška sedu a stolu).</li>
    <li><b>WHO Child Growth Standards</b> (0–5 let) a <b>WHO Growth Reference 2007</b> (5–19 let) – medián výšky podle věku.</li>
    <li>ASTM F963 (USA) – malé koule pod 44,5 mm pro děti do 3 let; EN 716 (postýlky) – mezery mezi příčkami 45–65 mm.</li></ul>
    <p class="info">Kontroly na této stránce jsou zjednodušené a orientační – nenahrazují zkoušky podle norem ani posouzení shody. Hračky prodávané v EU musí mít označení CE a technickou dokumentaci.</p>`;

  koren.DHPrincip = {
    princip: (r) => (P[r] ? P[r].princip : '') + (['kostky', 'zviratka', 'puzzle', 'tahaci', 'draha'].includes(r) ? `<h3>Malé díly</h3>${SCHEMA.valec()}` : ''),
    postup: (r) => (P[r] ? P[r].postup : ''),
    zdroje: () => ZDROJE,
  };
})(typeof window !== 'undefined' ? window : globalThis);

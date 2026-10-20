/* ============================================================
   Ostření – oddíly „Jak to funguje“, „Postup ostření“, „Bezpečnost u brusky“, „Zrnitosti“
   OSTRPrincip.princip() / .postup() / .bezpecnost() / .zrnitosti(OSTR) → HTML
   ============================================================ */
(function (koren) {
  'use strict';
  const fig = (w, h, obsah, popis, y0) => `<figure class="schema"><svg viewBox="0 ${y0 || 0} ${w} ${h}" role="img" aria-label="${popis}">${obsah}</svg><figcaption>${popis}</figcaption></figure>`;
  const t = (x, y, s, a, vel, c) => `<text x="${x}" y="${y}" font-size="${vel || 10}" text-anchor="${a || 'middle'}" fill="${c || 'currentColor'}">${s}</text>`;

  function schemaKlin() {
    let s = '<path d="M20 120L300 120L300 100L110 100Z" fill="#9aa4ad" stroke="currentColor"/>';
    s += '<path d="M20 120L56 106" stroke="var(--accent)" stroke-width="1.6" fill="none"/>';
    s += '<path d="M20 120L110 100" stroke="#b3261e" stroke-width="1"/>';
    s += '<path d="M62 120A42 42 0 0 0 61 111" fill="none" stroke="#b3261e"/>' + t(78, 116, 'θ', 'start', 11, '#b3261e');
    s += '<path d="M44 120A24 24 0 0 0 43.5 112" fill="none" stroke="var(--accent)"/>' + t(36, 100, 'mikrofazeta', 'middle', 9, 'var(--accent)');
    s += t(200, 114, 'hřbet (zadní strana) – zrcadlově rovný', 'middle', 9, '#222') + t(170, 140, 'primární fazeta θ + mikrofazeta o 3–5° strmější', 'middle', 10);
    return fig(320, 62, s, 'Ostří je klín mezi hřbetem a fazetou. Mikrofazeta je úzký pásek na samé špičce – brousí se jen ten, proto je ostření rychlé.', 86);
  }
  function schemaVozik() {
    let s = '<path d="M10 130H330" stroke="currentColor" stroke-width="1.5"/>';
    s += '<circle cx="80" cy="116" r="14" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="80" cy="116" r="2" fill="currentColor"/>';
    s += '<path d="M30 60L290 130L294 126L34 56Z" fill="#9aa4ad" stroke="currentColor"/>';
    s += '<path d="M80 116L95 80" stroke="var(--accent)" stroke-dasharray="3 2"/>' + t(100, 100, 'H + t', 'start', 9, 'var(--accent)');
    s += '<path d="M150 98L290 136" stroke="#1f5fa8" stroke-width="0.8"/>' + t(214, 126, 'L (vyložení)', 'middle', 9, '#1f5fa8');
    s += '<path d="M250 130A40 40 0 0 1 252 120" fill="none" stroke="#b3261e"/>' + t(238, 124, 'θ', 'middle', 11, '#b3261e');
    s += t(80, 146, 'váleček r', 'middle', 9) + t(260, 146, 'ostří na kameni', 'middle', 9);
    return fig(340, 104, s, 'Vozík s nožem tvoří trojúhelník: osa válečku, ostří na kameni a kolmice k loži. Delší vyložení = menší úhel.', 48);
  }
  function schemaDuty() {
    let s = '<circle cx="90" cy="90" r="70" fill="#b8bcc4" stroke="currentColor"/>';
    s += '<path d="M150 54L310 90L310 96L146 62Z" fill="#9aa4ad" stroke="currentColor"/>';
    s += '<path d="M90 90L150 54" stroke="currentColor" stroke-dasharray="4 2"/>' + t(112, 66, 'R', 'middle', 10);
    s += '<path d="M90 90L156 78" stroke="#1f5fa8" stroke-dasharray="2 2"/>' + t(130, 96, 'd = R·cos θ', 'start', 9, '#1f5fa8');
    s += t(240, 120, 'menší kotouč → hlubší výbrus', 'middle', 10) + t(240, 134, 'a jiný úhel při stejné opěrce', 'middle', 10);
    return fig(320, 180, s, 'Dutý výbrus: úhel ostří určuje vzdálenost d osy kotouče od roviny hřbetu nože, θ = arccos(d / R).');
  }

  function princip() {
    return `
<h3>Proč na úhlu záleží</h3>
<p>Ostří je klín. Čím je ostřejší (menší úhel θ), tím menší silou řeže, ale tím méně materiálu nese špičku – při úderu paličkou nebo v tvrdém dřevě se vylomí nebo ohne. Proto se úhel volí podle práce: odřezávací dláto 20°, stolařské 25°, dlabací 30–35°; želízko hoblíku fazetou dolů 25° + mikrofazeta 30°. Hodnoty v aplikaci jsou <b>typické</b> – pokud ostří drží krátce nebo se drolí, přidejte 2–5°.</p>
${schemaKlin()}
<h3>Mikrofazeta a zadní fazeta</h3>
<p><b>Mikrofazeta</b> (microbevel) je úzká plôška na konci primární fazety o pár stupňů strmější. Brousí se jen tato plôška, takže ostření jemnými kameny trvá desítky tahů místo stovek. Po několika ostřeních se mikrofazeta rozšíří – pak primární fazetu obnovte hrubším kamenem.</p>
<p><b>Zadní fazeta</b> (back bevel) je malá fazeta na hřbetu. U želízka fazetou dolů zvyšuje úhel řezu (45° lože + 10° = 55°) – pomáhá proti vytrhávání vláken u zvlněného dřeva. „Trik s pravítkem“ (ruler trick) je zadní fazeta pod 1°: tenké pravítko pod vzdálenějším koncem želízka – stačí vyleštit jen pár mm u ostří místo celé zadní strany.</p>
<h3>Honovací vozík – geometrie</h3>
${schemaVozik()}
<p>Nůž leží fazetou dolů na loži vozíku, ostří se opírá o kámen a vozík jede po válečku. Platí <code>D·sin θ − (H + t)·cos θ = r − s</code>, kde D = vyložení + poloha čela vozíku, H = výška lože nad osou válečku, t = tloušťka nože, r = poloměr válečku a s = o kolik je broušená plocha výš než plocha, po které jede váleček. Aplikace z toho počítá úhel z vyložení i obráceně a tabulku pro všechny úhly. Citlivost bývá 0,5–1° na 1 mm vyložení – proto měrka vyložení: nastavení je opakovatelné bez pravítka.</p>
<p>Tloušťka nože vstupuje do výpočtu: tlusté želízko (4 mm) má při stejném vyložení o několik desetin stupně větší úhel než tenké (2 mm). Měrka je proto počítaná pro zadanou tloušťku (je vyrytá na posledním stupni).</p>
<h3>Otřep (burr)</h3>
<p>Když broušením fazety dosáhnete až k hřbetu, materiál se na hraně ohne na druhou stranu – vznikne otřep, který ucítíte nehtem nebo palcem tahem <i>od hřbetu přes ostří</i>. Otřep po celé šířce je jediný spolehlivý důkaz, že fazeta dosáhla ostří. Na každé další zrnitosti brousíte jen dokud otřep nezjemní; nakonec ho odstraníte pár tahy hřbetem naplocho po nejjemnějším kameni a obtažením na řemeni.</p>
<h3>Zrcadlení zadní strany</h3>
<p>Ostří je průsečík dvou ploch – fazety a hřbetu. Pokud hřbet není rovný a vyleštěný aspoň 5–10 mm od ostří, ostří nikdy nebude lepší než jeho rýhy. Zadní stranu nového nože srovnejte jednou (hrubý kámen nebo papír na skle, P220 → P2500), pak už jen pár tahů na nejjemnějším kameni při každém ostření.</p>
<h3>Zakulacení ostří (camber)</h3>
<p>Želízko hoblíku do hrubovacího a uhlazovacího hoblíku má mírně zakulacené ostří, aby rohy neryly do plochy. Zakulacení se dělá ve vozíku s úzkým válečkem: pár tahů s tlakem prstu na levý roh, stejně na pravý, pak méně blíž ke středu. Hloubka: uhlazovák 0,05–0,1 mm, hoblík 0,3–0,5 mm, macek 2–3 mm (poloměr ~75–100 mm).</p>
<h3>Úhel řezu hoblíku</h3>
<p>Fazetou dolů: úhel řezu = úhel lože (45° běžně, 50° „York pitch“, 55° „middle pitch“); fazeta určuje jen vůli (lože − fazeta, má zůstat ≥ 10°). Fazetou nahoru (lože 12°): úhel řezu = lože + fazeta, takže strmější fazeta = strmější řez do vzpurného dřeva, vůle je pořád 12°.</p>
<h3>Dutý výbrus na brusce</h3>
${schemaDuty()}
<p>Kotouč vybrousí fazetu do oblouku. Výhoda: při ručním ostření na kameni se dotýká jen přední a zadní hrana fazety, takže se snadno drží úhel a brousí se málo materiálu. Hloubka výbrusu je přibližně b²/(8R), kde b je délka fazety. Opěrka pro tisk má stupnici sklonu; aplikace ke zvolenému úhlu a průměru kotouče spočítá sklon i vzdálenost čepu od osy kotouče a ukáže, jak se úhel mění, když se kotouč opotřebovává.</p>`;
  }

  function postup() {
    return `
<h3>Postup ostření krok za krokem</h3>
<ol>
<li><b>Kontrola:</b> Prohlédněte ostří proti světlu – vylomeniny a lesklé ploché odrazy na ostří znamenají, že je potřeba hrubší zrnitost.</li>
<li><b>Zadní strana (jednou u nového nože):</b> na skle s papírem P220–P400 srovnejte prvních 10–20 mm hřbetu do roviny (rovnoměrný mat), pak P1000 → P2500 do zrcadla. Pomáhá fix po celé ploše – kde zůstane, tam je prohlubeň.</li>
<li><b>Nastavení vozíku:</b> nůž volně upněte, vozík vložte válečkem do kolébky měrky a nůž vysuňte, až se ostří opře o stupeň zvoleného úhlu. Utáhněte obě křídlové matice střídavě, ostří kolmo k ose válečku (středová ryska na loži).</li>
<li><b>Primární fazeta:</b> hrubý kámen (#220–#400 / P400). Tlak prsty na nůž co nejblíž ostří, váleček jen vede. Brousit, dokud otřep není po celé šířce.</li>
<li><b>Hlavní ostření:</b> #1000 (P1000) – tahy po celé délce kamene, ať se kámen opotřebovává rovnoměrně. Opět do otřepu.</li>
<li><b>Mikrofazeta:</b> nůž ve vozíku zasuňte o hodnotu „od mikro“ z tabulky (nebo použijte stupeň měrky), na #4000–#8000 stačí 10–20 tahů.</li>
<li><b>Otřep pryč:</b> 2–3 tahy hřbetem naplocho po nejjemnějším kameni, střídat s 1–2 tahy ve vozíku; nakonec obtáhnout po kůži s pastou (tahem od ostří).</li>
<li><b>Zkouška:</b> řez přes vlákna měkkého dřeva (smrk) musí zanechat lesklou plochu bez trhlin; ostří proti světlu neodráží žádnou linku.</li>
<li><b>Údržba kamenů:</b> vodní kameny po každém ostření rovnat (diamantová deska nebo P120 na skle) – vydutý kámen zakulatí ostří a změní úhel.</li>
</ol>
<h3>Výroba přípravků (3D tisk)</h3>
<ol>
<li>Zkontrolujte vůli tisku: vytiskněte nejdřív svěrku a změřte otvory – šroub M6 má projít volně, šestihran hlavy zapadnout bez násilí. Podle toho upravte „vůli tisku“.</li>
<li>Tělo vozíku tiskněte <b>ložem dolů</b> (lože na podložce = rovná referenční plocha). PETG, 4 perimetry, výplň ≥ 40 %, bez podpěr. Otvor osy má tvar kapky, aby se tiskl bez převisu.</li>
<li>Vložte šrouby M6 hlavou do kapes ve spodku těla, nasaďte svěrku, podložky a křídlové matice. Ložisko 608 (nebo kolečko) vložte do drážky s podložkami M8 po stranách a stáhněte osou M8 se samojistnou maticí – jen tak, aby se váleček volně otáčel bez vůle.</li>
<li>Posuvkou změřte skutečnou výšku lože H a průměr válečku a ověřte jedním měřením úhlu (digitální úhloměr). Odchylku zadejte do kalibrace – měrka a tabulky se přepočítají.</li>
<li>Měrku vyložení a úhlovou měrku tiskněte z PLA naplocho; první vrstva bez „sloní nohy“ (jinak se zkreslí hrany zářezů a stupňů).</li>
<li>Opěrku brusky tiskněte z PETG nebo ASA; na opěrnou plochu nalepte plech 1,5–2 mm (jiskry a horké špony plast taví).</li>
</ol>`;
  }

  function bezpecnost(O) {
    const pop = O ? O.POPOUSTENI.map((q) => `<span class="barva"><i style="background:${q.hex}"></i>${q.barva} ~${q.t} °C</span>`).join(' ') : '';
    return `
<h3>Stolní bruska – bezpečnost</h3>
<ul>
<li><b>Ochranné brýle nebo štít vždy</b>, i s krytem brusky. Při spuštění stůjte mimo rovinu kotouče – prasklý kotouč letí v této rovině.</li>
<li>Nový kotouč: zvukovou zkouškou (lehké poklepání – čistý zvuk, ne drnčení), maximální otáčky kotouče ≥ otáčky brusky. Kotouč s trhlinou nebo vylomeninou nepoužívat.</li>
<li><b>Mezera opěrky ke kotouči max. 2–3 mm</b>, horní lapač jisker ≤ 6 mm. Po každé změně sklonu opěrky ji znovu přisuňte (opotřebením kotouče mezera roste). Do větší mezery může nástroj vtáhnout.</li>
<li>Nebrousit na boku rovného kotouče, nebrousit hliník/měď/dřevo (zanesou kotouč). Volné rukávy, rukavice v blízkosti kotouče, dlouhé vlasy – riziko vtažení.</li>
<li>Plastová opěrka z 3D tisku: tiskněte z PETG/ASA, na čelo a opěrnou plochu nalepte plech; jiskry plast taví a deformují. Šrouby aretace musí být utažené – sklopení za chodu vede nástroj do kotouče.</li>
<li>Prach z broušení (kov + pojivo) nevdechovat; při broušení za mokra kotouč nesmí stát ve vodě (nevyváženost).</li>
</ul>
<h3>Přehřátí a popouštění oceli</h3>
<p>Ostří je tenké, na kotouči se ohřeje za vteřiny. Uhlíková nástrojová ocel je popuštěná na ~200 °C; jakmile ostří zbarví, ztratilo tvrdost a takovou část je nutné odbrousit:</p>
<p class="barvy">${pop}</p>
<ul>
<li>Lehký tlak, nůž neustále posouvat po šířce kotouče, po pár sekundách namočit do vody (u HSS nemáčet rozžhavené – praská, nechat vychladnout na vzduchu).</li>
<li>Hrubý měkký kotouč (bílý korund, zrnitost 60–80, „měkké“ pojivo) hřeje méně než šedý tvrdý; kotouč pravidelně orovnávat diamantem.</li>
<li>Na brusce tvarujte jen fazetu – ostření (otřep) až na kamenech. Nikdy nebrousit až do ostří na hrubém kotouči.</li>
</ul>
<h3>Ruční ostření</h3>
<ul><li>Nože a dláta pokládat ostřím od sebe; otřep řeže – nekontrolovat ho tahem podél ostří.</li><li>Vozík tlačit prsty co nejblíž ostří, prsty mimo hranu kamene.</li></ul>`;
  }

  function zrnitosti(O) {
    return `<table class="tabZrn"><thead><tr><th>Zrnitost (papír / kámen)</th><th>zrno ~µm</th><th>použití</th></tr></thead><tbody>${O.ZRNITOSTI.map((q) => `<tr><td style="text-align:left">${q.ozn}</td><td>${String(q.um).replace('.', ',')}</td><td>${q.uziti}</td></tr>`).join('')}</tbody></table>
<p class="info">Velikosti zrn jsou orientační (FEPA P pro brusné papíry, JIS pro japonské vodní kameny – stejné číslo neznamená stejné zrno). „Scary sharp“: papír za mokra na plaveném skle, každá zrnitost do zmizení rýh předchozí.</p>`;
  }

  koren.OSTRPrincip = { princip, postup, bezpecnost, zrnitosti };
})(typeof window !== 'undefined' ? window : globalThis);

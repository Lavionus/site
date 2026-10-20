/* ============================================================
   Segmentové soustružení – oddíly „Jak to funguje“, „Postup“ a „Bezpečnost“ (HTML + malá SVG schémata)
   SEGPrincip.princip() / postup() / bezpecnost() → řetězec HTML
   ============================================================ */
(function (koren) {
  'use strict';
  const fig = (w, h, obsah, popis) => `<figure class="schema"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${popis}">${obsah}</svg><figcaption>${popis}</figcaption></figure>`;
  const t = (x, y, s, a, vel, c) => `<text x="${x}" y="${y}" font-size="${vel || 10}" text-anchor="${a || 'middle'}" fill="${c || 'currentColor'}">${s}</text>`;

  /** segment v kroužku: středový úhel, pokos, vnější/vnitřní hrana, šířka lišty */
  function schemaSegment() {
    const cx = 160, cy = 200, n = 12, b = 2 * Math.PI / n, aO = 170, rv = 115, aI = rv * Math.cos(b / 2);
    let s = '';
    for (let j = -2; j <= 1; j++) {
      const a0 = -Math.PI / 2 + j * b, a1 = a0 + b, th = a0 + b / 2;
      const P = (a, d) => { const x = d / Math.cos(a - th); return [cx + x * Math.cos(a), cy + x * Math.sin(a)]; };
      const q = [P(a0, aI), P(a0, aO), P(a1, aO), P(a1, aI)];
      s += `<path d="M${q.map((p) => p.map((v) => v.toFixed(1)).join(' ')).join('L')}Z" fill="${j === -1 ? 'var(--accent)' : '#d9b98a'}" fill-opacity="${j === -1 ? 0.35 : 0.5}" stroke="currentColor"/>`;
    }
    s += `<path d="M${cx} ${cy}L${cx + 200 * Math.cos(-Math.PI / 2 - b)} ${cy + 200 * Math.sin(-Math.PI / 2 - b)}M${cx} ${cy}L${cx} ${cy - 200}" stroke="currentColor" stroke-dasharray="3 3" stroke-width=".8"/>`;
    s += `<path d="M${cx} ${cy - 40}A40 40 0 0 0 ${cx + 40 * Math.cos(-Math.PI / 2 - b)} ${cy + 40 * Math.sin(-Math.PI / 2 - b)}" fill="none" stroke="var(--accent)"/>` + t(cx - 14, cy - 46, '360/n', 'middle', 9, 'var(--accent)');
    s += `<circle cx="${cx}" cy="${cy}" r="${rv}" fill="none" stroke="#b3261e" stroke-dasharray="4 3" stroke-width=".8"/>`;
    s += t(cx + 2, cy - rv + 14, 'r vnitřní (dutina − přídavek)', 'start', 9, '#b3261e');
    s += t(cx - 70, 22, 'vnější hrana = 2·R·tan(180°/n)', 'middle', 9) + t(cx + 100, 120, 'pokos = 180°/n', 'start', 9, 'var(--accent)');
    s += t(250, 60, 'R = apotéma', 'start', 9) + t(250, 72, '(max. poloměr + přídavek)', 'start', 9);
    s += `<circle cx="${cx}" cy="${cy}" r="2.5" fill="currentColor"/>` + t(cx + 6, cy + 4, 'osa', 'start', 9);
    return fig(360, 210, s, 'Segment je lichoběžník: n segmentů dělí kruh na úhly 360°/n, každý konec se řeže pod úhlem 180°/n. Vnější hrana je počítaná na apotému R (aby kruh R ležel celý ve dřevě), vnitřní vrchol nesmí zasáhnout do dutiny.');
  }
  /** profil a kroužky – schody hrubých kroužků obalují stěnu */
  function schemaKrouzky() {
    let s = '<path d="M20 190H300" stroke="currentColor" stroke-width=".6"/>';
    const prof = (z) => 40 + 160 * Math.sin(Math.min(1, z / 150) * Math.PI / 2) * 0.82;
    let d = '', di = '';
    for (let z = 0; z <= 150; z += 5) { d += (z ? 'L' : 'M') + (30 + prof(z)).toFixed(1) + ' ' + (190 - z); di += (z ? 'L' : 'M') + (30 + prof(z) - 14).toFixed(1) + ' ' + (190 - Math.max(z, 12)); }
    for (let i = 0; i < 6; i++) {
      const z0 = i * 26 - 3, z1 = z0 + 26, ro = Math.max(prof(Math.max(0, z0)), prof(Math.min(150, z1))) + 6, ri = i === 0 ? 0 : Math.min(prof(Math.max(0, z0)), prof(Math.min(150, z1))) - 20;
      s += `<rect x="${30 + ri}" y="${190 - z1}" width="${ro - ri}" height="26" fill="#d9b98a" fill-opacity="${i % 2 ? 0.55 : 0.35}" stroke="currentColor" stroke-width=".6"/>`;
    }
    s += `<path d="${d}" fill="none" stroke="#b3261e" stroke-width="2"/><path d="${di}" fill="none" stroke="#b3261e" stroke-width="1.4"/>`;
    s += `<path d="M30 10V195" stroke="currentColor" stroke-dasharray="6 3 2 3"/>` + t(34, 14, 'osa', 'start', 9);
    s += t(235, 60, 'hrubý kroužek', 'start', 9) + t(235, 72, '= prkno tl. h', 'start', 9) + t(200, 120, 'profil stěny', 'start', 9, '#b3261e') + t(200, 132, 'po soustružení', 'start', 9, '#b3261e');
    return fig(330, 200, s, 'Profil se rozřeže na vrstvy tloušťky prkna. Pro každou vrstvu se vezme největší vnější a nejmenší vnitřní poloměr v jejím rozsahu výšky a přidá přídavek. Sousední kroužky se musí překrývat aspoň o lepenou plochu.');
  }
  /** chyba úhlu: klín mezery */
  function schemaMezera() {
    let s = '';
    const cx = 60, cy = 150;
    for (let j = 0; j < 6; j++) {
      const a0 = (-90 + j * 31) * Math.PI / 180, a1 = a0 + 31 * Math.PI / 180;
      const p = (a, r) => (cx + r * Math.cos(a)).toFixed(1) + ' ' + (cy + r * Math.sin(a)).toFixed(1);
      s += `<path d="M${p(a0, 60)}L${p(a0, 130)}L${p(a1, 130)}L${p(a1, 60)}Z" fill="#d9b98a" fill-opacity=".5" stroke="currentColor"/>`;
    }
    const a = (-90 + 6 * 31) * Math.PI / 180, p = (r) => (cx + r * Math.cos(a)).toFixed(1) + ' ' + (cy + r * Math.sin(a)).toFixed(1);
    s += `<path d="M${p(60)}L${p(130)}" stroke="#b3261e" stroke-width="2"/>`;
    s += t(200, 40, 'každý řez o δ větší:', 'start', 10) + t(200, 56, 'součet = 360° + 2n·δ', 'start', 10, 'var(--accent)');
    s += t(200, 82, 'celý kroužek najednou:', 'start', 10) + t(200, 98, 'jedna spára zeje o 2n·δ', 'start', 10);
    s += t(200, 124, 'mezera ≈ délka spáry · tan(2n·δ)', 'start', 10, '#b3261e');
    s += t(200, 150, 'n = 12, δ = 0,1°, spára 50 mm', 'start', 9) + t(200, 164, '→ 2,4° → mezera 2,1 mm', 'start', 9);
    return fig(380, 190, s, 'Chyba úhlu se násobí počtem řezů: 24 řezů po 0,1° je 2,4° – a ta se sejde v jedné spáře.');
  }
  /** lepení polovin a srovnání na brusce */
  function schemaPoloviny() {
    let s = '<path d="M30 110A80 80 0 0 1 190 110Z" fill="#d9b98a" fill-opacity=".5" stroke="currentColor"/><path d="M60 110A50 50 0 0 1 160 110" fill="var(--bg-elevated)" stroke="currentColor"/>';
    s += '<path d="M20 112H200" stroke="var(--accent)" stroke-width="2"/>' + t(110, 128, 'rovina polovin – srovnat na talířové brusce', 'middle', 9, 'var(--accent)');
    s += '<rect x="230" y="40" width="16" height="90" fill="#bbb" stroke="currentColor"/>' + t(238, 146, 'kotouč', 'middle', 9) + '<path d="M246 85H300" stroke="currentColor" stroke-width="1"/>' + t(304, 89, 'stůl ⟂ kotouči', 'start', 9);
    s += t(110, 20, '1. slepit dvě poloviny  2. srovnat jejich plochy  3. slepit kroužek', 'middle', 9);
    return fig(380, 160, s, 'Poloviny se slepí zvlášť, jejich styčné plochy se srovnají do roviny (talířová bruska, ruční hoblík nebo brusný papír na skle). Chyba úhlu se tím vynuluje a spáry jsou neviditelné.');
  }

  function princip() {
    return `
<h3>Geometrie segmentu</h3>
${schemaSegment()}
<p>Kroužek z <b>n</b> segmentů je pravidelný n-úhelník. Středový úhel segmentu je <b>360°/n</b>, každý konec se proto řeže pod <b>pokosem 180°/n</b> (n = 12 → 15°, n = 16 → 11,25°, n = 24 → 7,5°). Dva sousední řezy dají úhel spáry 2 × 180°/n a všech 2n řezů dohromady přesně 360°.</p>
<ul>
<li><b>Vnější hrana</b> L<sub>v</sub> = 2·R·tan(180°/n), kde R je <i>apotéma</i> (vzdálenost středu od středu vnější hrany) = největší poloměr profilu ve vrstvě + přídavek. Rohy mnohoúhelníku pak vyčnívají, ale kruh R leží celý ve dřevě.</li>
<li><b>Vnitřní hrana</b>: vrcholy vnitřního mnohoúhelníku musí ležet na kružnici r = nejmenší vnitřní poloměr − přídavek (jinak by vrchol vykousl dutinu). Vnitřní apotéma je r·cos(180°/n), vnitřní hrana L<sub>i</sub> = 2·r·sin(180°/n).</li>
<li><b>Šířka lišty</b> = R − r·cos(180°/n). Délka spáry (lepená plocha mezi segmenty) = šířka / cos(180°/n).</li>
<li><b>Dýha ve spáře</b> tloušťky t zkrátí obě hrany segmentu o t / cos(180°/n), úhel řezu se nemění.</li>
<li><b>Otevřené segmentování</b> (open segment): bloky s řezem 90° obsadí jen podíl obvodu, mezi nimi zůstane mezera. Vnitřní hrana bloku je posunutá tak, aby i rohy bloku zasahovaly do dutiny jen přídavkem.</li>
</ul>
<h3>Z profilu ke kroužkům</h3>
${schemaKrouzky()}
<p>Vnější křivka je hladký spline přes řídicí body (kubický Hermite; „ostrý“ bod láme tečnu). Vnitřní křivka vznikne <b>odsazením o tloušťku stěny kolmo k povrchu</b> (eroze kruhem – na strmých i plochých místech je stěna stejně tlustá), nebo ji zadáte vlastními body (uzavřené formy). Nádoba se rozdělí na vrstvy od spodní plochy (−přídavek na srovnání dna), výška vrstvy = tloušťka prkna. Pro každou vrstvu se z profilu vezme <b>největší vnější</b> a <b>nejmenší vnitřní</b> poloměr v jejím výškovém rozsahu – tím je zaručeno, že hotová stěna s přídavkem leží uvnitř hrubého kroužku v celé jeho výšce. Je-li dutina menší než nastavený poloměr (nebo vrstva zasahuje do dna), kroužek se udělá z plné desky.</p>
<p><b>Lepená plocha</b> mezi sousedními kroužky = překryv jejich radiálních rozsahů. Na strmé (skoro vodorovné) stěně může vyjít malá – pak pomůže tenčí prkno, víc přídavku, nebo plošší profil. Program varuje pod nastavenou mezí.</p>
<h3>Chyba úhlu × počet segmentů → mezera</h3>
${schemaMezera()}
<p>Je-li pokos o δ větší, má každý segment úhel 2(180°/n + δ) a kroužek dohromady 360° + 2n·δ. Při lepení celého kroužku se veškerá chyba sejde v poslední spáře: zeje klínem 2n·δ, mezera ≈ délka spáry · tan(2n·δ). Při δ &gt; 0 spára zeje <b>uvnitř</b> (segmenty dosednou vnějšími rohy), při δ &lt; 0 <b>venku</b>. Kalkulačka v záložce <i>Chyba úhlu</i> spočítá mezeru i přípustnou chybu pily pro vaši mezeru.</p>
<h3>Lepení polovin a srovnání</h3>
${schemaPoloviny()}
<p>Při sudém n se nejdřív slepí dvě poloviny po n/2 segmentech (na rovné podložce, segmenty se jen „protřou“ lepidlem a přitlačí). Po zaschnutí se styčné plochy obou polovin srovnají do roviny – na talířové brusce s úhelníkem, hoblíkem nebo na brusném papíru nalepeném na skle. Tím se veškerá chyba úhlu odstraní a obě poloviny do sebe zapadnou bez mezery. Pak se kroužek slepí celý, zbrousí se rovinně z obou stran (aby další vrstva lícovala) a nalepí na předchozí kroužek, vystředěný a pootočený podle šablony.</p>
<h3>Ozdobné pásy</h3>
<ul>
<li><b>Střídání dřevin</b> – posloupnost dřevin (např. javor–ořech) se opakuje po obvodu.</li>
<li><b>Šachovnice</b> – kroužek ze dvou (i víc) tenkých podvrstev, každá podvrstva má dřeviny posunuté o jeden segment. Řezný plán počítá podvrstvy jako samostatné lišty poloviční tloušťky.</li>
<li><b>Cihlová vazba</b> (brick) – každý druhý kroužek pootočený o půl segmentu, spáry se nekryjí nad sebou. Šablona kroužku ukazuje tečkovaně spáry kroužku pod ním.</li>
<li><b>Dýhy ve spárách</b> – tenký proužek jiné barvy v každé spáře; vodorovná <b>mezivrstva</b> je celý tenký kotouč (dýha, tenká deska) mezi kroužky.</li>
<li><b>Otevřené segmentování</b> – bloky s mezerami lepené na plný kroužek pod nimi; každá další vrstva bloků je pootočená, takže bloky leží „na spárách“.</li>
</ul>`;
  }

  function postup() {
    return `
<h3>Postup výroby krok za krokem</h3>
<ol>
<li><b>Návrh</b>: profil, tloušťka stěny a dna, přídavek (2–4 mm u stabilního dřeva, víc u vlhčího nebo pro začátek). Zkontrolujte varování (lepená plocha, šířka lišty, délka vnitřní hrany).</li>
<li><b>Materiál</b>: suché dřevo (8–12 %), prkna srovnaná na stejnou tloušťku (tloušťkovačka) – tloušťka prkna = výška vrstvy. Podle řezného plánu nařežte lišty na šířku (podélný řez na okružní pile s rozvírací klínem, nebo pásová pila) a zarovnejte hrany.</li>
<li><b>Řezání segmentů</b>: pila nastavená na pokos 180°/n (zkontrolujte klínem z 3D tisku nebo zkušebním kroužkem), délkový doraz se šikmou plochou nastavte na vnější hranu. Po každém řezu lištu otočte (lichoběžníky do sebe, minimum odpadu). Kusy číslujte podle lišty.</li>
<li><b>Zkouška úhlu</b>: poskládejte kroužek nasucho a stáhněte páskem – mezera ukáže chybu (kalkulačka „Chyba úhlu“). Doladěním o setiny stupně ušetříte broušení.</li>
<li><b>Lepení polovin</b> na rovné podložce (pečicí papír), PVAc lepidlo, segmenty protřít a přitlačit. Po zaschnutí srovnat styčné plochy polovin, slepit celý kroužek (lepidlo, sevřít svěrkou nebo stahovacím páskem).</li>
<li><b>Srovnání kroužků</b>: obě plochy kroužku přebruste do roviny (talířová bruska, rovinná bruska, nebo na soustruhu na lícní desce) – na tloušťce záleží méně než na rovnoběžnosti.</li>
<li><b>Skládání</b>: dno (plná deska) nalepte na lícní desku / přířez se šroubováním. Každý další kroužek vystřeďte (šablona 1:1 – kružnice a osa 0°) a pootočte podle tečkovaných spár kroužku pod ním; lepte pod lisem nebo koníkem soustruhu s přítlačnou deskou. Po několika kroucích je výhodné průběžně dosoustružit vnitřek, dokud je přístupný.</li>
<li><b>Soustružení</b>: po vytvrzení lepidla (PVAc ≥ 24 h) vnější tvar, pak vnitřek na tloušťku stěny (měřidlo tloušťky), broušení, povrchová úprava (olej, vosk, lak).</li>
</ol>
<h3>Tisk šablon</h3>
<p>Šablony kroužků tiskněte ve skutečné velikosti (100 %, bez „přizpůsobit stránce“). Na každém listu jsou kontrolní úsečky 50 a 100 mm vodorovně i svisle; při odchylce zadejte naměřené délky do Kalibrace. Velké kroužky se dělí na víc listů s přesahem a značkami pro slepení.</p>`;
  }

  function bezpecnost() {
    return `
<h3>Bezpečnost</h3>
<ul>
<li><b>Pokosová pila</b>: segmenty jsou malé – držte je přítlakem nebo přípravkem, ne prsty u kotouče (vzdálenost ruky od kotouče aspoň 10 cm). Po řezu nechte kotouč doběhnout dole a teprve pak ho zvedněte – jinak může zachytit uříznutý kus a vymrštit ho. Délkový doraz zezadu pevně upnout; klín i doraz z 3D tisku jen jako přiložné přípravky, nikdy nevedou ruku ke kotouči.</li>
<li><b>Okružní pila</b>: pro příčné řezy segmentů jen saně (sled) s dorazem na saních. Nikdy nepoužívejte podélné pravítko jako délkový doraz – kus sevřený mezi kotoučem a pravítkem vylétne zpět (zpětný ráz). Podélné řezy lišt s rozvíracím klínem a posuvkou.</li>
<li><b>Talířová bruska</b>: brousit na sestupné straně kotouče (stůl ji podpírá), malé kusy v přípravku.</li>
<li><b>Soustruh</b>: lepený polotovar soustružit až po vytvrzení lepidla, nejprve nízké otáčky; orientačně Ø × otáčky ≈ 150 000–230 000 mm·ot/min (Ø 250 → 600–900 ot/min). Stát mimo rovinu otáčení, obličejový štít. Zkontrolujte, že žádná spára nezeje.</li>
<li><b>Prach</b>: exotické dřeviny (wenge, padouk, eben, zebrano) mohou dráždit – odsávání a respirátor FFP2/FFP3.</li>
<li><b>3D tisk přípravků</b>: PETG (tužší a odolnější vůči teplu u pily) nebo PLA; 4 stěny, výplň ≥ 40 %. Klín a doraz přišroubujte vruty 4 mm se zápustnou hlavou k pomocnému pravítku / saním; před prvním řezem zkontrolujte úhel zkušebním kroužkem.</li>
</ul>`;
  }

  koren.SEGPrincip = { princip, postup, bezpecnost };
})(typeof window !== 'undefined' ? window : globalThis);

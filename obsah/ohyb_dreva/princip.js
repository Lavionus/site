/* ============================================================
   Ohýbání dřeva – „Jak to funguje“, postup výroby, bezpečnost (HTML)
   OHDPrincip.princip(metoda), .postup(metoda), .postupPdf(metoda) → HTML / pole vět
   ============================================================ */
(function (koren) {
  'use strict';
  const fig = (w, h, obsah, popis) => `<figure class="schema"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${popis}">${obsah}</svg><figcaption>${popis}</figcaption></figure>`;
  const t = (x, y, s, a, vel, c) => `<text x="${x}" y="${y}" font-size="${vel || 10}" text-anchor="${a || 'middle'}" fill="${c || 'currentColor'}">${s}</text>`;

  function schemaOdpruzeni() {
    let s = '<path d="M20 130 Q160 20 300 130" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="4 3"/>';
    for (let i = 0; i < 5; i++) s += `<path d="M20 ${118 - i * 5} Q160 ${8 - i * 5} 300 ${118 - i * 5}" fill="none" stroke="#c98a4b" stroke-width="4"/>`;
    s += '<path d="M20 150 Q160 70 300 150" fill="none" stroke="var(--accent)" stroke-width="2"/>';
    s += t(160, 168, 'po povolení svěrek: křivost klesne o ≈ 1/n²', 'middle', 10, 'var(--accent)') + t(160, 12, 'balík n lamel ve formě', 'middle', 10);
    return fig(320, 176, s, 'Odpružení lepeného ohybu: tuhost slepeného balíku roste s n³, vratný moment volných lamel jen s n → vrátí se ≈ 1/n² křivosti.');
  }
  function schemaPas() {
    let s = '<path d="M30 140 A130 130 0 0 1 290 140" fill="#e6d3a8" stroke="currentColor"/>' + t(160, 130, 'kopyto', 'middle', 10);
    s += '<path d="M14 140 A146 146 0 0 1 306 140" fill="none" stroke="#c98a4b" stroke-width="16"/>';
    s += '<path d="M4 140 A156 156 0 0 1 316 140" fill="none" stroke="#555b63" stroke-width="3"/>';
    s += '<path d="M2 150V128M318 150V128" stroke="#c0392b" stroke-width="6"/>';
    s += t(160, 24, 'ocelový pás na vnějším (taženém) líci', 'middle', 10) + t(40, 166, 'doraz', 'middle', 10, '#c0392b') + t(280, 166, 'doraz', 'middle', 10, '#c0392b');
    return fig(320, 172, s, 'Pás s dorazy nedovolí vnějšímu líci se prodloužit – neutrální vrstva se posune k pásu a dřevo se na vnitřní straně pěchuje (to snese až ~25–30 %).');
  }
  function schemaKerf() {
    let s = '<rect x="10" y="60" width="300" height="24" fill="#d8c39a" stroke="currentColor"/>';
    for (let i = 0; i < 9; i++) s += `<rect x="${60 + i * 24}" y="60" width="6" height="18" fill="var(--bg-elevated,#fff)" stroke="currentColor"/>`;
    s += t(160, 50, 'zářezy šířky k, hloubky h, rozteč s', 'middle', 10) + t(160, 100, 'zbytek z (kůže) drží desku pohromadě', 'middle', 10);
    s += '<path d="M60 120 Q160 200 260 120" fill="none" stroke="var(--accent)" stroke-width="2"/>' + t(160, 150, 'každý zářez se zavře o φ ≤ 2·atan(k/2h)', 'middle', 10, 'var(--accent)');
    return fig(320, 190, s, 'Kerf bending: zářezy na vnitřní straně se při ohybu zavírají. Součet uzavření všech zářezů = úhel ohybu.');
  }

  function princip(m) {
    if (m === 'para') return `
<h3>Proč pára</h3>
<p>Lignin, který drží vlákna dřeva pohromadě, při teplotě kolem 100 °C a vysoké vlhkosti měkne (termoplastické chování). Napařené dřevo lze ohnout s malým poloměrem a po vychladnutí a vyschnutí ve formě si tvar podrží. Rozhoduje <b>vlhkost dřeva</b> (ideálně vzduchosuché 15–20 %, sušené v sušárně se ohýbá hůř) a <b>rovné vlákno</b> bez suků.</p>
<h3>Doba napařování</h3>
<p>Typické pravidlo: <b>1 hodina na 25 mm (1″) tloušťky</b> od chvíle, kdy box plně páří. Přepaření nepomáhá – dřevo spíš zkřehne. Rychlost je v nastavení editovatelná.</p>
<h3>Ohýbací pás (strap)</h3>
<p>Dřevo snese v tahu jen asi 1–2 % prodloužení, v tlaku (napařené) až ~25–30 %. Bez pásu leží neutrální vrstva uprostřed a vnější líc se trhá. <b>Ocelový pás s dorazy</b> na obou čelech nedovolí vnějšímu líci se prodloužit – celý ohyb se pak „vejde“ do stlačení vnitřní strany. Proto je přířez dlouhý jako <b>vnější líc</b> ohnutého dílu a vzdálenost dorazů musí přířezu přesně odpovídat.</p>
${schemaPas()}
<p>Kalkulačka kontroluje dvě věci: typický minimální poměr R/t pro dřevinu (s pásem / bez pásu) a přetvoření líce (stlačení t/(R+t), resp. protažení (t/2)/(R+t/2)). Obě meze jsou orientační – zkušební kus je vždy nejlepší test.</p>
<h3>Kopyto a odpružení</h3>
<p>Po vyjmutí z formy se díl trochu rozevře. Kopyto se proto dělá o něco „křivější“ (přehnutí, typicky 5–15 % podle dřeviny a tloušťky) – zadává se v procentech křivosti. Díl nechte ve formě aspoň 24 h a pak dosušte na přípravku (týden i víc), než se tvar ustálí.</p>
<h3>Bezpečnost</h3>
<ul><li>Pára opaří během zlomku sekundy: silné rukavice, dlouhé rukávy, box otevírat od sebe.</li><li>Vyvíječ páry nesmí být uzavřený – box musí mít volný výstup páry (žádný přetlak).</li><li>Při ohybu může díl prasknout a vymrštit třísky: ochranné brýle, nestát v rovině pásu.</li></ul>`;
    if (m === 'zarezy') return `
<h3>Princip</h3>
<p>Zářezy (kerf bending) na vnitřní straně oblouku zeslabí desku tak, že se ohýbá jen tenká „kůže“ zbylého materiálu. Bloky mezi řezy jsou tuhé a otáčejí se kolem dna řezu – kerf se zavírá.</p>
${schemaKerf()}
<h3>Výpočet</h3>
<ul><li>Hloubka řezu h = t − z (t tloušťka desky, z zbytek).</li><li>Zcela zavřený zářez šířky k otočí sousední blok o <b>φ<sub>max</sub> = 2·atan(k / 2h)</b>.</li><li>Počet zářezů N = ⌈θ / φ<sub>max</sub>⌉, skutečné uzavření φ = θ / N – součet uzavření všech zářezů je přesně úhel ohybu θ.</li><li>Kořeny zářezů leží po ohnutí na kružnici R<sub>k</sub> = R<sub>i</sub> + h; jejich rozteč na rovné desce je <b>s = R<sub>k</sub> · φ</b>.</li><li>Mezi řezy musí zbýt můstek s − k (aspoň ~2 mm), jinak je poloměr pro tuto pilu příliš malý.</li></ul>
<p>Minimální poloměr kůže je dán materiálem (typický poměr R/z, editovatelný). Když kůže praská, zmenšete zbytek z nebo zvětšete poloměr. Po ohnutí se zářezy často vyplní lepidlem s pilinami a deska se přilepí na žebra – oblouk pak drží tvar.</p>
<h3>Bezpečnost u okružní pily</h3>
<ul><li>Řezy neprůchozí: kotouč nastavte na hloubku h zkušebním řezem a kontrolujte posuvným měřítkem.</li><li>Používejte příčný doraz / formátovací saně a přítlačný hřeben, nikdy nevoďte desku rukou u kotouče. Rozteč nastavujte dorazem (indexový kolík), ne od ruky.</li><li>Rozpěrný klín u neprůchozích řezů nejde použít – o to víc hlídejte zpětný vrh; stůjte mimo rovinu kotouče, ochranné brýle a sluchátka.</li></ul>`;
    return `
<h3>Lepené ohyby (bent lamination)</h3>
<p>Silný ohnutý díl se skládá z tenkých lamel, které se samy ohnou za studena bez prasknutí. Lamely se natřou lepidlem, sevřou ve formě a po vytvrzení drží tvar – slepené spáry zablokují vzájemné posouvání lamel.</p>
<h3>Tloušťka lamely</h3>
<p>Tenká lamela tloušťky t ohnutá na poloměr R má v krajních vláknech přetvoření ≈ t / 2R. Prakticky se používá <b>minimální poměr R/t</b> podle dřeviny (typicky 40–75, tabulka je editovatelná). Kalkulačka najde nejmenší poloměr vnitřního líce celého balíku (u části zakřivené k balíku je to R − T) a z něj maximální tloušťku lamely.</p>
<h3>Odpružení (springback)</h3>
${schemaOdpruzeni()}
<p>Po vyjmutí z formy se ohyb trochu narovná. Pro lepené ohyby se běžně používá odhad, že se vrátí <b>≈ 1/n² křivosti</b> (n = počet lamel); poloměr po povolení tedy vyjde ≈ R · n²/(n² − 1), rozdíl ≈ R/n². Odvození: každá volná lamela by se chtěla vrátit s momentem úměrným t³, celkem n·t³; slepený balík má ale tuhost úměrnou (n·t)³ – poměr je 1/n². Pravidlo uvádí truhlářská literatura (např. L. Schleining: <i>The Complete Manual of Wood Bending</i>, 2002; články Fine Woodworking o bent lamination). Je to odhad – skutečné odpružení zvyšuje vlhkost lamel, PVA lepidlo (dotvarování pod napětím) a předčasné vyjmutí. Proto se doporučuje UF (močovinoformaldehydové) lepidlo nebo epoxid a forma se dá „přehnout“ o odhadované odpružení (volba <b>kompenzace</b>).</p>
<h3>Forma</h3>
<ul><li><b>Jednodílná</b> (pozitiv) – balík se přitahuje svěrkami přes přítlačnou lištu; okna ve formě dávají svěrkám záchyt kolmo k líci.</li><li><b>Dvoudílná</b> – pozitiv a negativ; líc negativu je odsazen přesně o tloušťku balíku (+ případná korková/pryžová vložka). Na strmých úsecích svislé stažení netlačí kolmo – tam přidejte svěrky nebo negativ rozdělte.</li><li>Forma se skládá z <b>vrstev MDF</b> (typicky 18 mm) slepených a sešroubovaných, zarovnaných kolíky. Šířka formy = šířka lamel + okraj na obou stranách.</li></ul>
<h3>Svěrky</h3>
<p>Lisovací tlak pro lepení typicky 0,7 MPa (měkké dřevo) až 1,0 MPa (tvrdé). Celková síla = tlak × délka × šířka; počet svěrek kalkulačka určí z rozteče i z potřebné síly (typická síla svěrky je editovatelná – ověřte u svých svěrek).</p>`;
  }

  const POSTUP = {
    laminace: [
      'Vytiskněte PDF 1:1, změřte kontrolní úsečky 100 mm (při odchylce zadejte kalibraci) a slepte listy podle čárkovaných čar.',
      'Šablonu přilepte na první vrstvu MDF, vyřízněte pásovou pilou ~2 mm vedle čáry a líc dobruste přesně na čáru (líc je červeně).',
      'Další vrstvy vyřízněte nahrubo a zarovnejte kopírovací frézou s ložiskem podle první vrstvy. Vyvrtejte otvory pro kolíky přes šablonu.',
      'Vrstvy slepte, nasaďte kolíky, sešroubujte. Líc přebruste a přelepte balicí páskou nebo PE fólií (separace).',
      'Lamely nařežte z jednoho přířezu, ohoblujte/přebruste na stejnou tloušťku a očíslujte v pořadí, aby kresba navazovala. Délka = střednice + přídavek.',
      'Nasucho zkuste sevřít celý balík – připravte všechny svěrky. Pak natřete lepidlo (UF nebo epoxid) na všechny vnitřní spáry, ne na vnější líce.',
      'Balík vložte do formy (přes přítlačnou lištu u jednodílné), utahujte od středu ke koncům, aby lepidlo vytlačovalo ven.',
      'Nechte vytvrdit podle lepidla (UF typicky 8–12 h při 20 °C, raději déle), vyjměte, změřte odpružení a zarovnejte hrany a konce.',
    ],
    para: [
      'Vytiskněte PDF 1:1 kopyta, zkontrolujte měřítko a vyrobte kopyto z vrstev MDF (stejně jako formu pro laminaci). Líc přebruste.',
      'Připravte pás s dorazy: vzdálenost dorazů = délka přířezu. Dub chraňte fólií nebo nerezovým pásem.',
      'Přířez z rovnovláknitého, vzduchosuchého dřeva bez suků; hrany srazit, aby se netrhala vlákna.',
      'Napařujte podle výpočtu (1 h na 25 mm od plného páření). Formu, svěrky a pás mějte připravené vedle boxu.',
      'Vyjmutý díl ihned vložte do pásu (čela na dorazy), přiložte na střed kopyta a plynule ohýbejte – na ohyb máte jen 1–2 minuty.',
      'Zajistěte svěrkami, nechte vychladnout a vyschnout ve formě aspoň 24 h, pak dosušte na přípravku. Teprve potom opracujte na čisto.',
    ],
    zarezy: [
      'Vytiskněte šablonu zářezů 1:1, zkontrolujte měřítko a přiložte ji nulou k čelu desky (případně přeneste rysky na doraz pily).',
      'Nastavte hloubku řezu h zkušebním řezem na odpadu a změřte zbytek z posuvným měřítkem.',
      'Řežte na formátovacích saních nebo s příčným dorazem; rozteč nastavujte indexovým dorazem (kolík do předchozího řezu).',
      'Nasucho ohněte na žebra/šablonu. Když kůže praská, zmenšete zbytek nebo zvětšete poloměr.',
      'Zářezy vyplňte lepidlem (s pilinami), ohněte na žebra a zajistěte; po vytvrzení oblouk drží tvar.',
    ],
  };
  function postup(m) {
    const p = POSTUP[m] || POSTUP.laminace;
    return '<h3>Postup výroby</h3><ol>' + p.map((x) => `<li>${x}</li>`).join('') + '</ol>';
  }
  const postupPdf = (m) => (POSTUP[m] || POSTUP.laminace).map((x, i) => `${i + 1}. ${x}`);
  koren.OHDPrincip = { princip, postup, postupPdf };
})(typeof window !== 'undefined' ? window : globalThis);

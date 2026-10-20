/* ============================================================
   Kolíkovací a kapsové přípravky – oddíly „Jak to funguje“, „Postup“ a „Bezpečnost“ (HTML)
   KPPrincip.princip(rezim), .postup(rezim), .bezpecnost(rezim) → řetězec HTML
   ============================================================ */
(function (koren) {
  'use strict';
  const fig = (w, h, obsah, popis) => `<figure class="schema"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${popis}">${obsah}</svg><figcaption>${popis}</figcaption></figure>`;
  const t = (x, y, s, a, vel, c) => `<text x="${x}" y="${y}" font-size="${vel || 10}" text-anchor="${a || 'middle'}" fill="${c || 'currentColor'}">${s}</text>`;

  function schemaZrcadlo() {
    let s = '<rect x="20" y="30" width="120" height="40" fill="#e2c08a" fill-opacity=".6" stroke="currentColor"/><rect x="180" y="30" width="120" height="40" fill="#c89c62" fill-opacity=".6" stroke="currentColor"/>';
    for (const x of [40, 70, 120]) s += `<circle cx="${x}" cy="50" r="4" fill="none" stroke="currentColor"/>`;
    for (const x of [200, 250, 280]) s += `<circle cx="${x}" cy="50" r="4" fill="none" stroke="currentColor"/>`;
    s += '<path d="M20 26V74" stroke="var(--accent)" stroke-width="3"/><path d="M300 26V74" stroke="var(--accent)" stroke-width="3"/>';
    s += t(80, 20, 'díl A – doraz vlevo', 'middle', 9) + t(240, 20, 'díl B – doraz vpravo (zrcadlo)', 'middle', 9);
    s += '<path d="M150 50H170" stroke="currentColor" marker-end=""/>' + t(160, 90, 'po složení: x v B = W − x v A', 'middle', 9, 'var(--accent)');
    return fig(320, 100, s, 'Nesouměrné rozložení: díry protikusu jsou zrcadlové. Zrcadlový přípravek má doraz na opačném konci.');
  }
  function schemaKapsa() {
    let s = '<rect x="10" y="40" width="160" height="40" fill="#e2c08a" fill-opacity=".6" stroke="currentColor"/><rect x="170" y="40" width="140" height="40" fill="#c89c62" fill-opacity=".6" stroke="currentColor"/>';
    s += '<path d="M60 40L170 60L250 75" stroke="var(--danger)" stroke-dasharray="6 3" fill="none"/>';
    s += '<path d="M60 40L150 56" stroke="currentColor" stroke-width="8" stroke-opacity=".25"/>';
    s += t(90, 30, 'kapsa na rubu', 'middle', 9) + t(170, 96, 'výstup ve středu tloušťky protikusu', 'middle', 9, 'var(--accent)') + t(260, 30, 'hrot ≥ rezerva od líce', 'middle', 9);
    s += '<path d="M40 40A20 20 0 0 1 59 36" fill="none" stroke="var(--accent)"/>' + t(36, 34, '15°', 'end', 9, 'var(--accent)');
    return fig(320, 104, s, 'Kapsový spoj v řezu: vrut pod 15° vychází z čela dílu A ve středu tloušťky protikusu a hrot zůstává pod lícem.');
  }

  function princip(rezim) {
    let h = '';
    if (rezim === 'kapsa') {
      h += '<h3>Kapsový spoj (pocket hole)</h3><p>Do rubu dílu A se pod malým úhlem (typicky <b>15°</b>) vyvrtá stupňovitým vrtákem kapsa: velký průměr pro hlavu vrutu, pilotní průměr až ven z čela. Vrut pak táhne díl A k protikusu. Spoj se dělá bez kolíků a svěrek na celou délku, je rychlý a dobře drží v rámech, korpusech a u připevnění desek.</p>';
      h += schemaKapsa();
      h += '<ul><li><b>Výstup osy na čele</b> se volí ve středu tloušťky protikusu (u rámů v rovině) – vrut pak má v protikusu nejvíc materiálu na obě strany.</li>'
        + '<li><b>Délka vrutu</b> je z tabulky podle tloušťky (typické hodnoty, upravte podle svých vrutů). Stránka spočítá, kde musí sedět hlava (stupeň vrtáku), aby hrot zůstal aspoň o rezervu pod protější plochou.</li>'
        + '<li><b>Kroužek</b> na stupňovitém vrtáku se opírá o horní plochu vedení, která je kolmá na osu. Vzdálenost od stupně ke kroužku = vedení + vzdálenost od rubu ke dnu kapsy. Měrka (blok se slepým otvorem) ji přenese bez měření.</li>'
        + '<li><b>Tisk přípravku na boku</b>: profil leží na podložce, vedení je vodorovné – otvor se tiskne kapkovitě (špička nahoru, bez převisu) nebo se do něj vlepí kovové pouzdro.</li></ul>';
      return h;
    }
    if (rezim === 'centr') {
      return '<h3>Centrovací měrky (dowel centers)</h3><p>Když jsou díry v jednom dílu hotové, vloží se do nich měrky s hrotem a druhý díl se přiloží přesně na místo a přitlačí. Hroty označí středy děr v protikusu. Tištěný hrot označí měkké dřevo; do tvrdého dřeva zatlačte do měrky špendlík nebo malý hřebíček.</p>'
        + '<p>Čep má o vůli menší průměr než vrták (výchozí −0,05 mm na poloměru) – v díře musí sedět bez vůle. Límec dosedá na plochu, takže hrot je vždy ve stejné výšce.</p>';
    }
    h += '<h3>Kolíkovací přípravek</h3><p>Přípravek drží vrták kolmo a na správném místě: <b>vedení</b> (otvor s vůlí nebo kovové pouzdro) určuje polohu a směr, <b>koncový doraz</b> polohu podél spoje a <b>stěny</b> polohu přes tloušťku.</p>'
      + '<ul><li><b>Samostředicí (U)</b> – tvar U na pevnou tloušťku (+ vůle sevření): díra je vždy ve středu, i když tloušťka trochu kolísá, je chyba poloviční.</li>'
      + '<li><b>S dorazem od líce (L)</b> – jedna stěna u líce, díra v zadané vzdálenosti. Líce dílů pak lícují i při různých tloušťkách.</li>'
      + '<li><b>Do čela</b> (hrana / konec dílu) se vrtá U nebo L přípravkem, <b>do plochy</b> deskou s dorazem na čele a boční hraně protikusu.</li></ul>';
    h += '<h3>Zrcadlení protikusu</h3>' + schemaZrcadlo()
      + '<p>Díly se skládají „tváří k sobě“, proto se poloha podél spoje v protikusu zrcadlí (x → W − x). Při souměrném rozložení a středění stačí jeden přípravek. Jinak stránka vytvoří zrcadlový přípravek B s dorazem na opačném konci; test ověřuje, že osy děr po složení leží na jedné přímce.</p>';
    h += '<h3>Délka a počet kolíků (typická pravidla, editovatelná)</h3><ul>'
      + '<li>Ø kolíku ≈ 0,45 × tloušťky (nejbližší nižší z řady 6 / 8 / 10 / 12), nejvýš polovina tloušťky.</li>'
      + '<li>Hloubka do plochy ≈ 0,65 × tloušťky, pod dnem aspoň 5 mm. Do čela zbytek délky kolíku (asi 2/3) + 1 mm na lepidlo.</li>'
      + '<li>Rozteč do 128 mm, krajní kolík aspoň 2 × Ø (min. 25 mm) od kraje.</li>'
      + '<li>Únosnost je jen orientační: menší z pevnosti lepené spáry (π · d · h · τ) a střihu kolíku. Neslouží jako statický výpočet.</li></ul>';
    if (rezim === 'konfirmat') h += '<h3>Konfirmát</h3><p>Konfirmát (typicky 7 × 50) se šroubuje z vnější strany boku do čela police. Bok má průchozí díru Ø 7 se zahloubením hlavy, čelo police předvrtání Ø 5 do hloubky délka − tloušťka boku + rezerva. Přípravek A vede Ø 5 do čela, deska B Ø 7 v boku.</p>';
    if (rezim === 'excentr') h += '<h3>Excentr</h3><p>Excentrická spojka sedí v otvoru Ø 15 v ploše police, šroub nebo čep jde čelem police do boku. Přípravek A má proto kromě vedení do čela i <b>křídlo</b> na rubové ploše s vedením pro Forstnerův vrták Ø 15 – obě díry se tak trefí. Rozměry (vzdálenost od hrany 24 / 34 mm, hloubka, Ø čepu) jsou typické; ověřte je u svého kování.</p>';
    h += '<h3>Dlouhé přípravky</h3><p>Přípravek delší než tisková plocha se rozdělí na díly. Sousední díly sdílejí jednu díru (<b>index</b>): po vyvrtání prvního dílu zasuňte do poslední díry kolík a další díl na něj navlékněte.</p>';
    h += '<h3>Tisk</h3><p>PETG (houževnatější, méně se opotřebí), PLA jen na občasné použití. 4 perimetry, výplň 40 % a víc. Deska přípravku leží na podložce, otvory jsou svislé a kulaté. Tiskárny tisknou díry o 0,1–0,3 mm menší – vůli ověřte na zkušebním kusu. Pro opakované vrtání použijte kovová vrtací pouzdra (jejich vnější Ø zadejte – stránka uvádí jen typické hodnoty).</p>';
    return h;
  }

  function postup(rezim) {
    if (rezim === 'kapsa') return '<ol>'
      + '<li>Zadejte tloušťky a typ spoje, zkontrolujte délku vrutu a rezervu hrotu.</li>'
      + '<li>Vytiskněte přípravek, kroužek a měrku (PETG). Vedení zkuste vrtákem – má jít volně, bez viklání.</li>'
      + '<li>Kroužek nastavte měrkou: vrták zasuňte stupněm na dno měrky, kroužek dosuňte na horní plochu, utáhněte šroub.</li>'
      + '<li>Díl A položte rubem nahoru na stůl, přípravek přiložte dorazem k čelu a <b>upněte svěrkou</b> přes přípravek k dílu i ke stolu.</li>'
      + '<li>Vrták zasuňte do vedení, spusťte vysokými otáčkami, vrtejte postupně s vyjížděním, dokud kroužek nedosedne.</li>'
      + '<li>Díly sevřete (u rámu přes spoj, aby líce lícovaly), vrut zašroubujte – ne příliš, v měkkém dřevě se závit snadno strhne.</li></ol>';
    if (rezim === 'centr') return '<ol><li>Vyvrtejte díry v dílu A (přípravkem nebo podle šablony).</li><li>Vložte měrky odpovídajícího Ø až po límec.</li><li>Díl B přiložte přesně do polohy (doraz, úhelník) a přitlačte nebo lehce klepněte paličkou.</li><li>Vrtejte do důlků; vrták se středicím hrotem se do nich sám chytí.</li></ol>';
    return '<ol>'
      + '<li>Díly označte: A / B, líc, referenční konec (odkud se měří). U nesouměrného rozložení je to důležité.</li>'
      + '<li>Vytiskněte přípravky (STL), kroužky a měrky. Otvory zkuste vrtákem, pouzdra nalisujte svěrákem rovně.</li>'
      + '<li>Kroužky nastavte měrkami (vrták na dno měrky, kroužek na horní plochu).</li>'
      + '<li>Přípravek A nasaďte na čelo dílu A, doraz opřete o referenční konec, <b>upněte svěrkou</b>. Vrtejte s vyjížděním, dokud kroužek nedosedne.</li>'
      + '<li>U děleného přípravku zasuňte do poslední díry indexový kolík, nasaďte další díl, upněte a pokračujte.</li>'
      + '<li>Protikus B vrtejte přípravkem B (zrcadlový / deska). Desku opřete o čelo i boční hranu B. Průchozí díry podložte prkénkem.</li>'
      + '<li>Zkusmo složte bez lepidla. Lepidlo naneste do děr i na kolíky, spoj stáhněte svěrkami, přebytek setřete.</li>'
      + '<li>Bez přípravku: vytiskněte PDF 1:1 (šablony A a B), změřte kontrolní úsečky, chlopně ohněte přes hrany, středy propíchněte šídlem.</li></ol>';
  }

  function bezpecnost(rezim) {
    return '<ul>'
      + '<li>Přípravek i díl vždy <b>upněte</b> (svěrka, svěrák, stůl vrtačky) – ruka nemá držet malý díl u rotujícího vrtáku. Prsty mimo osu vrtání a mimo výstup vrtáku.</li>'
      + '<li>Ochranné brýle; dlouhé vlasy, rukávy a rukavice pryč od vřetene (rukavice se může navinout).</li>'
      + (rezim === 'kapsa' ? '<li>Stupňovitý vrták je dlouhý a ostrý: spouštějte ho až zasunutý ve vedení, vytahujte až po zastavení. Akušroubovák s přepnutím na vrtání, vysoké otáčky.</li>' : '<li>U Forstnerova vrtáku nízké otáčky a pevné upnutí – při zaseknutí strhává díl.</li>')
      + '<li>Tištěné přípravky se vrtákem opotřebí; při viklání vrtáku ve vedení přípravek vyřaďte nebo použijte kovová pouzdra.</li>'
      + '<li>Prach z MDF a DTD je zdraví škodlivý – odsávání nebo respirátor FFP2.</li></ul>';
  }

  koren.KPPrincip = { princip, postup, bezpecnost };
})(typeof window !== 'undefined' ? window : globalThis);

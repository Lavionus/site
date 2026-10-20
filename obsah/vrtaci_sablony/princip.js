/* ============================================================
   Vrtací šablony – oddíly „Jak to funguje“ a „Postup vrtání“ (HTML + malá SVG schémata)
   VSPrincip.princip(rezim) / VSPrincip.postup(rezim) → řetězec HTML
   ============================================================ */
(function (koren) {
  'use strict';
  const fig = (w, h, obsah, popis) => `<figure class="schema"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${popis}">${obsah}</svg><figcaption>${popis}</figcaption></figure>`;
  const t = (x, y, s, a, vel, c) => `<text x="${x}" y="${y}" font-size="${vel || 10}" text-anchor="${a || 'middle'}" fill="${c || 'currentColor'}">${s}</text>`;

  /** bok skříně se dvěma řadami děr a kótami 37 / 32 */
  function schema32() {
    let s = '<rect x="40" y="10" width="200" height="200" fill="none" stroke="currentColor" stroke-width="1.5"/>';
    s += '<path d="M40 10V210" stroke="var(--accent)" stroke-width="3"/>' + t(36, 112, 'přední hrana', 'middle', 9, 'var(--accent)').replace('<text', '<text transform="rotate(-90 36 112)"');
    for (let i = 0; i < 6; i++) for (const x of [70, 214]) s += `<circle cx="${x}" cy="${40 + i * 26}" r="3.2" fill="currentColor"/>`;
    s += '<path d="M40 196H70M40 192V200M70 192V200" stroke="var(--accent)" stroke-width="1"/>' + t(55, 192, '37', 'middle', 9, 'var(--accent)');
    s += '<path d="M84 40V66M80 40H88M80 66H88" stroke="var(--accent)" stroke-width="1"/>' + t(96, 56, '32', 'start', 9, 'var(--accent)');
    s += '<path d="M70 222H214M70 218V226M214 218V226" stroke="currentColor" stroke-width="0.8"/>' + t(142, 234, 'n × 32 (zadní řada v násobku rozteče)', 'middle', 9);
    s += t(250, 60, 'podpěrky polic', 'start', 9) + t(250, 74, 'Ø 5 mm', 'start', 9) + t(250, 120, 'stejná rozteč', 'start', 9) + t(250, 134, 'pro závěsy, výsuvy,', 'start', 9) + t(250, 148, 'úchytky i spojky', 'start', 9);
    return fig(340, 240, s, 'Systém 32 mm: přední řada 37 mm od přední hrany, díry po 32 mm, zadní řada ve vzdálenosti n × 32 mm od přední.');
  }
  /** papírová šablona s chlopní přes hranu */
  function schemaChlopen() {
    let s = '<path d="M20 120H300V170H20Z" fill="#d9b98a" fill-opacity=".55" stroke="currentColor"/>' + t(160, 152, 'deska (bok, dvířka)', 'middle', 10);
    s += '<path d="M40 70H280V120H40Z" fill="#fff" stroke="currentColor" stroke-dasharray="0"/>';
    s += '<path d="M40 120V150H70V120" fill="#fff" fill-opacity=".85" stroke="currentColor"/>';
    s += t(56, 140, '', 'middle', 9);
    for (const x of [90, 130, 170, 210, 250]) s += `<path d="M${x - 6} 95H${x + 6}M${x} 89V101" stroke="currentColor" stroke-width="1"/><circle cx="${x}" cy="95" r="3" fill="none" stroke="currentColor"/>`;
    s += '<path d="M40 120H280" stroke="var(--accent)" stroke-width="3"/>';
    s += t(160, 64, 'šablona – kříže na středech děr', 'middle', 10) + t(80, 186, 'chlopeň ohnutá přes hranu = doraz', 'start', 10, 'var(--accent)');
    s += '<path d="M76 182L58 150" stroke="var(--accent)" stroke-width="1" marker-end=""/>';
    return fig(320, 196, s, 'Referenční hrana: chlopeň za tlustou čarou ohněte přes hranu desky – šablona pak nemůže ujet a vzdálenosti od hrany sedí.');
  }
  /** řez: deska, přípravek, vrták s hloubkovým kroužkem */
  function schemaKrouzek() {
    let s = '<rect x="20" y="110" width="280" height="60" fill="#d9b98a" fill-opacity=".55" stroke="currentColor"/>';
    s += '<rect x="20" y="92" width="280" height="18" fill="#9fc5a8" fill-opacity=".5" stroke="currentColor"/>' + t(250, 105, 'přípravek T', 'middle', 9);
    s += '<path d="M150 110V146L156 152L162 146V110" fill="#fff" stroke="currentColor"/>';
    s += '<rect x="150" y="20" width="12" height="126" fill="#bbb" stroke="currentColor"/><path d="M150 146L156 152L162 146" fill="#bbb" stroke="currentColor"/>';
    s += '<rect x="140" y="70" width="32" height="22" fill="var(--accent)" fill-opacity=".8" stroke="currentColor"/>' + t(186, 85, 'kroužek', 'start', 9);
    s += '<path d="M120 92V152M116 92H124M116 152H124" stroke="var(--accent)" stroke-width="1"/>' + t(112, 126, 'hloubka + T', 'end', 9, 'var(--accent)');
    s += '<path d="M60 110V146M56 110H64M56 146H64" stroke="currentColor" stroke-width="0.8"/>' + t(52, 132, 'hloubka', 'end', 9);
    return fig(320, 180, s, 'Hloubkový kroužek se nastaví na „hloubka + tloušťka přípravku“ měřeno od špičky vrtáku; u papírové šablony jen na hloubku.');
  }
  /** úsečky X a Y – tiskárna může škálovat každou osu jinak */
  function schemaKalibrace() {
    let s = '<rect x="20" y="10" width="150" height="190" fill="#fff" stroke="currentColor"/>';
    s += '<path d="M30 185H130" stroke="currentColor" stroke-width="1.5"/>' + t(80, 180, '100 mm vodorovně', 'middle', 8);
    s += '<path d="M160 20V120" stroke="currentColor" stroke-width="1.5"/>' + t(150, 70, '100 mm svisle', 'middle', 8).replace('<text', '<text transform="rotate(-90 150 70)"');
    s += t(200, 50, 'naměřeno 99,2 mm', 'start', 9) + t(200, 64, '→ korekce X = 100 / 99,2', 'start', 9, 'var(--accent)');
    s += t(200, 110, 'naměřeno 100,6 mm', 'start', 9) + t(200, 124, '→ korekce Y = 100 / 100,6', 'start', 9, 'var(--accent)');
    s += t(200, 170, 'směr posuvu papíru', 'start', 9) + '<path d="M290 160V190M284 184L290 192L296 184" stroke="currentColor" fill="none"/>';
    return fig(340, 210, s, 'Tiskárny posouvají papír válečky – svislý směr bývá jinak přesný než vodorovný. Proto jsou kontrolní úsečky v obou osách.');
  }

  function princip(rezim) {
    let h = '<h3>Systém 32 mm</h3>';
    h += '<p>Většina korpusového nábytku se vrtá v jednotné síti: <b>přední řada děr 37 mm od přední hrany</b> a díry <b>po 32 mm</b>. Na stejnou síť jsou dělané montážní destičky závěsů, výsuvy zásuvek, podpěrky polic i spojovací kování – jedna šablona tak poslouží pro celou skříň.</p>';
    h += '<p><b>Proč zrovna 32 mm?</b> Síť vznikla v 60. letech s průmyslovými vícevřetenovými vrtacími hlavami. Uvádí se, že 32 mm byla nejmenší rozteč, při které se vedle sebe vešly převody sousedních vřeten – a zároveň dost malá, aby šlo kování jemně stavět. Ustálená vzdálenost 37 mm od hrany dovoluje dvířkům na boku přesah a nechává místo pro destičky závěsů.</p>';
    h += schema32();
    h += '<p>Zadní řada se nemá měřit od zadní hrany, ale <b>v násobku 32 mm od přední řady</b> – pak lícují i díly, které se šroubují do obou řad (výsuvy, kování). V režimu „Systém 32“ to zaškrtávací pole hlídá samo.</p>';
    h += '<h3>Proč měřit kontrolní úsečky</h3>';
    h += '<p>Ani tiskárna nastavená na „100 %“ nemusí tisknout přesně. Typicky se tiskne s měřítkem 94–97 %, když zůstane zapnuté <i>přizpůsobit stránce</i>, a i bez něj se rozměr ve směru posuvu papíru liší o desetiny procenta. Na 600 mm dlouhé řadě dělá 0,5 % chybu 3 mm – to už díry neodpovídají kování.</p>';
    h += schemaKalibrace();
    h += '<p>Proto má každý list <b>úsečku 100 mm vodorovně i svisle</b> (s dílkem 50 mm). Změřte je ocelovým pravítkem, naměřené délky zadejte do <i>Kalibrace tiskárny</i> a stránka další PDF nakreslí s opravou zvlášť pro osu X a Y.</p>';
    h += '<h3>Jak přiložit šablonu</h3>';
    h += schemaChlopen();
    h += '<ul><li><b>Tlustá čára</b> je referenční hrana – měří se od ní všechny kóty. Chlopeň za ní ohněte přes hranu desky a přilepte papírovou páskou.</li>'
      + '<li>U šablony na roh (dvě referenční hrany) přiložte obě – roh je označený kroužkem.</li>'
      + '<li>Delší šablony se lepí z více listů: list ořízněte na levém / horním okraji a přiložte na čárkovanou čáru sousedního listu; drobný náhled vpravo dole ukazuje, kde list leží.</li>'
      + '<li>Na zdi není hrana – šablonu vyrovnejte <b>vodováhou</b> podle červené čáry a výšku nad podlahou odměřte (spodní hrana šablony je uvedená na listu).</li>'
      + '<li>Protikus (druhý bok, díl B u kolíků) je zrcadlový: díry lícují, až se díly složí k sobě.</li></ul>';
    h += '<h3>Přípravek z 3D tiskárny</h3>';
    h += '<p>Deska přípravku má na spodní straně <b>doraz (lištu)</b>, který se opře o referenční hranu, u čela desky dva dorazy, které přípravek vystředí na tloušťku. Otvory jsou zvětšené o vůli pro vrták, nebo se do nich nalisuje <b>kovové pouzdro</b> – plast se vrtákem rychle vytluče, pouzdro drží průměr i kolmost. Dlouhé přípravky se rozdělí na části do tiskové plochy; sousední části sdílejí jednu díru, do které se při přesunu zasune kolík (index).</p>';
    h += schemaKrouzek();
    h += '<p>Tiskárny tisknou díry o 0,1–0,3 mm menší – vůli ověřte na zkušebním kusu. Pro přesnost tiskněte s hustou výplní a aspoň 3 perimetry.</p>';
    if (rezim === 'elektro') h += '<h3>Krabice KU 68</h3><p>Krabice pod omítku pro přístroje mají průměr 68 mm (vrtá se korunkou) a do vícenásobných rámečků se řadí s roztečí <b>71 mm</b>, kterou používá většina výrobců – u své řady ji ověřte. Krabice se spojují spojkami do řady, proto musí být rozteč přesná.</p>';
    if (rezim === 'vesa') h += '<h3>VESA</h3><p>VESA MIS udává rozteč závitových otvorů na zadní straně televize (75 × 75 až 400 × 400 a větší). Nástěnná deska držáku má často vlastní rozteč otvorů do zdi – zadejte ji v poli „vlastní rozteč nástěnné desky“.</p>';
    if (rezim === 'pcd') h += '<h3>Roztečná kružnice</h3><p>Díry leží na kružnici průměru D po úhlu 360° / n. Tětiva mezi sousedními dírami je D · sin(180° / n) – podle ní se dá rozteč na hotovém díle kontrolně změřit posuvkou. Přípravek se vystředí čepem ve středovém otvoru, nebo límcem kolem vnějšího průměru.</p>';
    return h;
  }

  function postup(rezim) {
    const zed = ['obraz', 'policka', 'vesa', 'galerie', 'elektro'].includes(rezim);
    let h = '<h3>Příprava</h3><ol>'
      + '<li>Vytiskněte PDF ve <b>skutečné velikosti</b> (100 %, vypnuté „přizpůsobit stránce“) a změřte kontrolní úsečky.</li>'
      + '<li>Šablonu ořízněte podle obrysu, slepte listy a přiložte ji k referenční hraně (u zdi vyrovnejte vodováhou).</li>'
      + '<li>Zkontrolujte pravítkem aspoň jednu kótu od hrany a jednu rozteč – omyl se pozná dřív, než je v desce díra.</li></ol>';
    h += '<h3>Označení středů</h3><ol>'
      + '<li>Přes střed kříže udělejte <b>důlek</b> – důlčíkem do kovu, šídlem nebo hrotem do dřeva, do obkladu nalepte přes střed lepicí pásku, aby vrták neujížděl.</li>'
      + '<li>Šablonu sejměte (u přípravku zůstává přiložený), vrták nasaďte přesně do důlku.</li></ol>';
    h += '<h3>Vrtání</h3><ol>'
      + '<li><b>Kolmost:</b> nejlépe stojanová vrtačka nebo vodicí přípravek. Z ruky si postavte úhelník vedle vrtáku a kontrolujte ho ze dvou stran (zepředu a z boku).</li>'
      + '<li><b>Hloubka:</b> nastavte hloubkový doraz nebo kroužek podle tabulky (sloupec „kroužek“). Nouzově poslouží páska na vrtáku.</li>'
      + '<li>Větší průměry předvrtejte menším vrtákem. Misky Ø 35 a excentry Ø 15 vrtejte <b>Forstnerovým vrtákem</b> s nízkými otáčkami; nevrtejte hlouběji, než dovolí tloušťka dvířek.</li>'
      + '<li>Do laminované DTD vrtejte s ostrým vrtákem s předřezem; z rubu podložte prkénkem, aby se líc u průchozích děr nevylomil.</li>';
    if (zed) h += '<li><b>Zeď:</b> detektorem ověřte, že v místě nevede kabel ani trubka. Svisle nad a pod vypínači a zásuvkami a vodorovně u nich bývají vedení – tam nevrtejte. Do zdiva příklepem, do sádrokartonu bez příklepu a s hmoždinkou pro dutou stěnu.</li>'
      + '<li>Krabice KU 68 vrtejte korunkou se středicím vrtákem – nejdřív středicím vrtákem přes kříž, korunka se pak vede sama.</li>';
    h += '</ol><h3>Kontrola</h3><ol><li>Po prvních dvou dírách zkontrolujte rozteč posuvkou nebo zkusmo nasaďte kování.</li><li>U zrcadlových dílů (levý / pravý bok, kolíky) díly před vrtáním označte, ať se šablona nepřiloží k nesprávné hraně.</li></ol>';
    return h;
  }

  koren.VSPrincip = { princip, postup };
})(typeof window !== 'undefined' ? window : globalThis);

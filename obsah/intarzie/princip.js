/* ============================================================
   Intarzie a parketáž – oddíly „Jak to funguje“ a „Postup výroby“ (HTML + schémata SVG)
   INTP.princip() / INTP.postup(vzor) → řetězec HTML
   ============================================================ */
(function (koren) {
  'use strict';
  const fig = (w, h, obsah, popis) => `<figure class="schema"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${popis}">${obsah}</svg><figcaption>${popis}</figcaption></figure>`;
  const t = (x, y, s, a, vel, c) => `<text x="${x}" y="${y}" font-size="${vel || 10}" text-anchor="${a || 'middle'}" fill="${c || 'currentColor'}">${s}</text>`;

  function schemaRozdil() {
    let s = '';
    // intarzie: vsazení do masivu
    s += '<rect x="10" y="30" width="90" height="40" fill="#c99a63" stroke="currentColor"/><path d="M35 30h40v10H35z" fill="#3b2a1c" stroke="currentColor"/>' + t(55, 88, 'intarzie', 'middle', 10) + t(55, 100, 'vsazeno do masivu', 'middle', 8);
    // marketerie: obrazová skladba z dýh na podkladu
    s += '<rect x="120" y="44" width="90" height="26" fill="#b9b2a5" stroke="currentColor"/><path d="M120 40h90v4h-90z" fill="#e7cf9f" stroke="currentColor"/><path d="M140 40q15-14 30 0z" fill="#6b4630" stroke="currentColor"/>' + t(165, 88, 'marketerie', 'middle', 10) + t(165, 100, 'obraz z dýh na podkladu', 'middle', 8);
    // parketáž: geometrie
    s += '<rect x="230" y="44" width="90" height="26" fill="#b9b2a5" stroke="currentColor"/>';
    for (let i = 0; i < 6; i++) s += `<path d="M${230 + i * 15} 40h15v4h-15z" fill="${i % 2 ? '#5a3d28' : '#e7cf9f'}" stroke="currentColor" stroke-width=".6"/>`;
    s += t(275, 88, 'parketáž', 'middle', 10) + t(275, 100, 'geometrie z dýh', 'middle', 8);
    return fig(330, 108, s, 'Intarzie = vložka zapuštěná do masivu; marketerie = obrazová skladba z dýh; parketáž (parquetry) = geometrický vzor z dýh. Obě poslední se lepí jako celek na podklad.');
  }
  function schemaShoda() {
    let s = '';
    const list = (x, zr, posun) => {
      let q = `<rect x="${x}" y="20" width="44" height="80" fill="#d9b27c" stroke="currentColor"/>`;
      for (let i = 0; i < 5; i++) { const y = 30 + i * 15 + posun; q += `<path d="M${x + (zr ? 44 : 0)} ${y}c${zr ? -15 : 15} -10 ${zr ? -25 : 25} 10 ${zr ? -44 : 44} 2" fill="none" stroke="#7a4f2a" stroke-width="1.4"/>`; }
      return q;
    };
    s += list(10, false, 0) + list(54, true, 0) + t(54, 116, 'bookmatch', 'middle', 10) + t(54, 128, 'každý 2. list obrácen', 'middle', 8);
    s += list(170, false, 0) + list(214, false, 0) + t(214, 116, 'slip match', 'middle', 10) + t(214, 128, 'listy posunuty vedle sebe', 'middle', 8);
    s += '<path d="M98 16v88" stroke="var(--accent)" stroke-width="1.2" stroke-dasharray="3 2"/>';
    return fig(280, 134, s, 'Bookmatch: sousední listy z balíku, jeden otočený líc–rub → zrcadlová kresba přes spáru (lesk se na sousedních listech střídá). Slip match: listy jen posunuté → kresba se opakuje, lesk je stejný.');
  }
  function schemaBalik() {
    let s = '';
    const c = ['#efe0bf', '#c9945e', '#6a4630', '#2e2420'];
    c.forEach((b, i) => { s += `<path d="M30 ${70 - i * 9}l120 0l30 -18l-120 0z" fill="${b}" stroke="currentColor" stroke-width=".8"/>`; });
    s += '<path d="M60 33l120 0l30-18-120 0z" fill="#fff" stroke="currentColor"/>' + t(120, 26, 'nalepený výkres', 'middle', 8, '#000');
    s += '<path d="M200 0v90" stroke="#888" stroke-width="2"/><path d="M196 40h8" stroke="#888" stroke-width="6"/>' + t(232, 50, 'lupínková pila', 'middle', 9);
    s += t(140, 92, 'balík: krycí list + dýhy všech barev,', 'middle', 9) + t(140, 104, 'sešité nebo přelepené páskou po obvodu', 'middle', 9);
    return fig(280, 110, s, 'Řezání do balíku (packet cutting): všechny dýhy se naskládají na sebe, celý motiv se prořízne najednou kolmým řezem. Z každé vrstvy vznikne kompletní sada dílků – díly k sobě sedí bez ohledu na šířku řezu.');
  }
  function schemaOkenko() {
    let s = '<rect x="10" y="10" width="120" height="80" fill="#e7cf9f" stroke="currentColor"/>';
    s += '<path d="M45 30h40l10 30H40z" fill="var(--bg,#fff)" stroke="currentColor" stroke-dasharray="3 2"/>' + t(70, 78, 'okénko v podkladové dýze', 'middle', 8);
    s += '<path d="M150 10h120v80H150z" fill="#6a4630" stroke="currentColor"/><path d="M185 30h40l10 30H180z" fill="none" stroke="#fff" stroke-width="1.2"/>' + t(210, 78, 'dýha vložky pod okénkem', 'middle', 8, '#fff');
    s += t(210, 22, 'obkreslit nožem přes okraj okénka', 'middle', 8, '#fff');
    return fig(280, 98, s, 'Okénková metoda (window method): v podkladové dýze se vyřízne okénko, pod ně se podloží dýha vložky a posune, až kresba sedí; nožem se obkreslí přes hranu okénka, vložka se vyřízne a vlepí. Spára je téměř nulová a kresbu vidíte předem.');
  }
  function schemaKerf() {
    let s = '<rect x="40" y="25" width="90" height="50" fill="#d9b27c" stroke="currentColor" stroke-width="1"/>';
    s += '<rect x="34" y="19" width="102" height="62" fill="none" stroke="#d0021b" stroke-width="1.2"/>' + t(85, 14, 'dráha laseru: +k/2 ven', 'middle', 8, '#d0021b');
    s += '<path d="M136 50h18M136 46v8M154 46v8" stroke="var(--accent)"/>' + t(170, 53, 'k/2', 'start', 9, 'var(--accent)');
    s += '<rect x="200" y="20" width="80" height="60" fill="#6a4630" stroke="currentColor"/><rect x="220" y="35" width="40" height="30" fill="var(--bg,#fff)" stroke="currentColor"/><rect x="226" y="41" width="28" height="18" fill="none" stroke="#d0021b" stroke-width="1.2"/>' + t(240, 94, 'okno: −k/2 dovnitř', 'middle', 8, '#d0021b');
    return fig(300, 100, s, 'Kompenzace šířky řezu (kerf k): paprsek odebere k/2 na každou stranu čáry. Dílek se proto řeže po obrysu posunutém o k/2 ven, okno v podkladu o k/2 dovnitř – výsledné díly mají jmenovitý rozměr a sedí bez spár.');
  }
  function schemaLepeni() {
    let s = '';
    s += '<rect x="20" y="20" width="240" height="8" fill="#f4f0e4" stroke="currentColor"/>' + t(270, 27, 'lícní páska (papír)', 'start', 8);
    s += '<rect x="20" y="28" width="240" height="5" fill="#c99a63" stroke="currentColor"/>' + t(270, 34, 'dýha vzoru 0,6 mm', 'start', 8);
    s += '<rect x="20" y="33" width="240" height="2" fill="#e8d84a"/>' + t(270, 41, 'lepidlo', 'start', 8);
    s += '<rect x="20" y="35" width="240" height="30" fill="#b9b2a5" stroke="currentColor"/>' + t(140, 55, 'podklad MDF / překližka / laťovka', 'middle', 9);
    s += '<rect x="20" y="65" width="240" height="2" fill="#e8d84a"/><rect x="20" y="67" width="240" height="5" fill="#d8c6a0" stroke="currentColor"/>' + t(270, 72, 'protidýha (rub)', 'start', 8);
    s += '<path d="M30 6v10M90 6v10M150 6v10M210 6v10M250 6v10" stroke="var(--accent)" stroke-width="1.4" marker-end=""/>' + t(140, 92, 'lis / vakuový pytel – rovnoměrný tlak, chraňte proti prolepení separační fólií', 'middle', 8);
    return fig(380, 98, s, 'Skladba: vzor z dýh drží lícní páskou, lepí se rubem na podklad. Na druhou stranu podkladu vždy protidýha s vlákny ve stejném směru – jinak se deska prohne.');
  }

  function princip() {
    return `
<h3>Intarzie, marketerie, parketáž</h3>
${schemaRozdil()}
<ul>
<li><b>Intarzie (inlay)</b> – vložky ze dřeva (i kovu, kosti) zapuštěné do vyfrézovaného nebo vydlabaného lůžka v masivu. Tloušťka vložek 1–3 mm i víc.</li>
<li><b>Marketerie (marquetry)</b> – obraz složený z tenkých dýh (typicky 0,6 mm) různých dřevin, slepený jako celek na podklad. Dílky mají volné tvary podle motivu.</li>
<li><b>Parketáž (parquetry)</b> – geometrický vzor z dýh: rybí kost, šachovnice, koš, kostky, hvězdy. Dílky se opakují, takže rozhoduje přesnost úhlů a stejná šířka pásků.</li>
</ul>
<h3>Směr vláken</h3>
<p>Každý dílek má vlákna (grain) v určitém směru – je to součást návrhu, ne náhoda. Dýha se v listu dělí jen podél vláken, světlo se od ní odráží podle směru vláken (dílky s vlákny napříč působí jinak světle), a jinak se i smršťuje. Proto v řezném plánu musí být každý dílek natočen tak, aby jeho vlákna běžela <b>podél délky listu dýhy</b>; nástroj pak počítá skutečnou spotřebu i s odpadem. Šipka ↔ na šablonách ukazuje směr vláken.</p>
<p><b>Chatoyance</b> (měňavý lesk, „kočičí oko“) vzniká tím, že vlákna nejsou v dýze přesně rovnoběžná s povrchem – v pásech kresby se střídavě sklánějí. Při pohybu světla nebo diváka pásy přeskakují mezi světlou a tmavou. 3D náhled to napodobuje: zapněte chatoyanci a otáčejte světlem.</p>
<h3>Bookmatch a slip match</h3>
${schemaShoda()}
<p>Listy dýhy z jednoho kmene jdou v balíku za sebou a mají téměř stejnou kresbu. <b>Bookmatch</b> = sousední list se otočí jako stránka knihy, kresba se zrcadlí přes spáru (u velkých ploch dvířek a desek, u 4 listů „diamant“). <b>Slip match</b> = listy jen posunuté vedle sebe – kresba se opakuje a všechny listy lesknou stejně, což u pásků a parketáže působí klidněji. V náhledu volbu „Sesazení dýh“ uvidíte na kresbě; dílky z obráceného listu mají na šabloně značku <b>Z</b>.</p>
<h3>Řezání do balíku (packet cutting)</h3>
${schemaBalik()}
<ol>
<li>Dýhy všech barev (+ krycí list z odpadní dýhy nebo lepenky) naskládejte na sebe, vlákna podle návrhu, a sešijte / přelepte po obvodu.</li>
<li>Nalepte na balík výkres (sestavu 1:1) a vyvrtejte startovací otvor 0,6–0,8 mm v čáře.</li>
<li>Řežte lupínkovou pilou (scroll saw, jemný plátek č. 2/0–2) přesně kolmo – sklon stolu 0°. Každá vrstva dá celou sadu dílků.</li>
<li>Dílky každé barvy roztřiďte a skládejte do sady, která má mít danou barvu – z ostatních vrstev vzniknou další (barevně prohozené) obrazy.</li>
</ol>
<p>Výhoda: díly k sobě sedí, šířka řezu se ztratí (všechny díly ztratí stejně). Nevýhoda: směr vláken je v balíku pro všechny dílky stejný – pro dílky s jiným směrem vláken je potřeba další balík.</p>
<h3>Okénková metoda (window method)</h3>
${schemaOkenko()}
<p>Podkladová dýha drží výkres; řeže se po jednom dílku skalpelem (č. 10A / 11). Vložka se natáčí pod okénkem, dokud kresba a vlákna nesedí, pak se obkreslí a vyřízne s nožem lehce skloněným dovnitř (úkos 2–5°), aby šla vtlačit bez spáry.</p>
<h3>Laser a kompenzace šířky řezu</h3>
${schemaKerf()}
<p>Šířka řezu (kerf) CO₂ laseru v dýze 0,6 mm bývá typicky 0,08–0,2 mm (záleží na čočce, výkonu a dřevině – změřte zkušebním čtvercem: kerf = jmenovitý rozměr − naměřený rozměr). Řez se ztmaví (spálená hrana); spáry pak působí jako tenká linka. Laserové výstupy (SVG/DXF) jsou rozložené podle řezného plánu, vrstvy podle dřevin.</p>
<h3>Lepení</h3>
${schemaLepeni()}
<ul>
<li>Sestavený vzor držte na <b>lícní straně</b> gumovanou papírovou páskou (veneer tape) – lepí se rub, páska se po vytvrzení navlhčí a seškrábne.</li>
<li>Lepidlo: PVAc (D2/D3) – jednoduché, ale „plíží“ a může prorazit; močovinoformaldehydové (UF) práškové – tvrdé, bez plížení, ideální pro dýhy (rukavice, větrat); kostní / kožní klih – horký s kladívkem na dýhu nebo tekutý, umožní opravy teplem.</li>
<li>Tlak: lis nebo vakuový pytel; rovnoměrně, cauly (prohnuté přítlačné latě) od středu ke krajům.</li>
<li><b>Protidýha</b> na rubu podkladu (stejná tloušťka, vlákna stejným směrem) – jinak se deska po vyschnutí prohne.</li>
<li>Brousit opatrně: dýha 0,6 mm se snadno probrousí; tmavé piliny (ořech, wenge) zanesou póry světlých dřevin – brousit po vláknech, odsávat.</li>
<li>Stínování v horkém písku (sand shading): okraj dílku se ponoří na pár sekund do jemného písku rozpáleného na pánvi – ztmavne a dodá plastičnost (kostky, listy).</li>
</ul>
<h3>Bezpečnost</h3>
<ul class="varovani-seznam">
<li class="chyba"><b>Laser:</b> nikdy bez dozoru – dýha je hořlavá. Odsávání a filtrace kouře, asistenční vzduch, hasicí přístroj na dosah. Neřežte PVC ani neznámé plasty (chlor), lepené dýhy s neznámým lepidlem testujte.</li>
<li class="varovani"><b>Lupínková pila:</b> přítlačná patka nastavená těsně nad balík, prsty mimo dráhu plátku, ruce tlačí balík ze stran, ne proti plátku. Malé dílky nedržte prsty u plátku – doprořízněte z balíku.</li>
<li class="varovani"><b>Skalpel:</b> řez od těla, ocelové pravítko s protiskluzem, několik lehkých tahů místo jednoho silného, tupé čepele měnit (tupá čepel trhá a smekne se).</li>
<li class="varovani"><b>Prach exotických dřevin</b> (padouk, wenge, palisandr, eben, zebrano) může dráždit a senzibilizovat – broušení s odsáváním a respirátorem FFP2/FFP3.</li>
<li class="info"><b>Lepidla:</b> UF lepidlo uvolňuje formaldehyd – rukavice, větrání; horký klih – pozor na opaření.</li>
</ul>`;
  }

  function postup(vzor) {
    const marke = vzor === 'marketerie';
    const kroky = marke ? [
      'Připravte motiv v SVG (vyplněné plochy, každá barva = jedna dřevina). Nástroj tvary rozdělí tak, aby se nepřekrývaly (pozdější tvar je navrchu) a zbytek pole je podklad.',
      'Přiřaďte barvám dřeviny a u každé skupiny (i jednotlivých dílků kliknutím) nastavte směr vláken – listy, stonky a stíny podle tvaru, pozadí obvykle vodorovně.',
      'Zvolte metodu: balík (všechny dýhy najednou, lupínková pila), okénko (skalpel, dílek po dílku) nebo laser (výstupy SVG/DXF s kompenzací kerf).',
      'Vytiskněte PDF 1:1 a ověřte kontrolní úsečky 50 / 100 mm vodorovně i svisle.',
      'Okénková metoda: výkres přilepte na podkladovou dýhu, postupujte od pozadí k popředí, od velkých dílků k malým; každý vložený dílek ihned zajistěte páskou z líce.',
      'Hotový obraz přelepte z líce lícní páskou, zkontrolujte spáry proti světlu, drobné spáry vyplňte tmelem z pilin a lepidla.',
      'Lepte rubem na podklad s protidýhou, v lisu nebo vakuu (doba podle lepidla, typicky 1–4 h).',
      'Po vytvrzení odstraňte pásku (navlhčit, seškrábnout), lehce přebruste (zrno 180–240) a povrchově upravte (šelak, olej, lak).',
    ] : [
      'Nastavte rozměr desky, bordury a linky; zvolte vzor a velikost modulu tak, aby u okrajů nevznikaly štěpiny (posuňte nebo otočte vzor).',
      'Přiřaďte skupinám dílků dřeviny a zkontrolujte směr vláken (šipky v náhledu); pro klidnější vzhled pásků zvolte slip match.',
      'Řezný plán ukáže, kolik listů každé dřeviny potřebujete a jak dílky na listech leží – vlákna vždy podél listu. Počítejte s rezervou na zkušební kusy.',
      'Pásky řežte z listu podél vláken nožem po pevném pravítku nebo na přípravku (ostré, rovné hrany jsou základ); úhlové dílky (rybí kost, kostky, hvězdy) ořezávejte na přípravku s dorazem přesně na úhel – chyba 0,5° se na 10 dílcích sečte.',
      'Skládejte na vytištěnou sestavu 1:1 (nebo na lepicí papír) od středu nebo od řídicí osy, každou spáru ihned přelepte z líce lícní páskou.',
      'Bordura a linka: pásy s vlákny podél strany, rohy na pokos (pokosy přesně na úhlopříčce rohu).',
      'Celek lepte rubem na podklad, na druhé straně protidýha; lis / vakuum.',
      'Po vytvrzení sejměte pásku, přebruste po vláknech převládajícího směru, nakonec ručně jemným zrnem, a povrchově upravte.',
    ];
    return `<h3>${marke ? 'Marketerie' : 'Parketáž'} – postup krok za krokem</h3><ol>${kroky.map((k) => `<li>${k}</li>`).join('')}</ol>
<h3>Tisk šablon</h3>
<ol><li>PDF tiskněte ve <b>skutečné velikosti</b> (100 %, ne „přizpůsobit stránce“). Na každém listu jsou kontrolní úsečky 50 / 100 mm vodorovně i svisle – změřte je.</li>
<li>Velké šablony jsou rozdělené na listy s pásmem lepení: ořízněte okraj podle popisu a přiložte na čárkovanou čáru sousedního listu.</li>
<li>Listy řezného plánu jsou 1:1 – lze je nalepit přímo na list dýhy (vlákna listu vodorovně, šipka v patě listu).</li></ol>`;
  }

  koren.INTP = { princip, postup };
})(typeof window !== 'undefined' ? window : globalThis);

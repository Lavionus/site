/* ============================================================
   Návrh skříní – oddíly „Jak to funguje“, „Postup montáže“ a „Bezpečnost“ (HTML + malá SVG schémata)
   ============================================================ */
(function (koren) {
  'use strict';
  const fig = (w, h, obsah, popis) => `<figure class="schema"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${popis}">${obsah}</svg><figcaption>${popis}</figcaption></figure>`;
  const t = (x, y, s, a, vel, c) => `<text x="${x}" y="${y}" font-size="${vel || 10}" text-anchor="${a || 'middle'}" fill="${c || 'currentColor'}">${s}</text>`;
  const R = (x, y, w, h, f) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${f || '#d9b98a'}" fill-opacity=".6" stroke="currentColor"/>`;

  function schemaKonstrukce() {
    let s = '';
    // bok přes dno
    s += R(20, 20, 12, 140) + R(108, 20, 12, 140) + R(32, 140, 76, 12) + R(32, 20, 76, 12);
    s += t(70, 178, 'dno a strop mezi boky', 'middle', 9);
    // dno pod boky, strop přes boky
    s += R(160, 148, 100, 12) + R(160, 20, 100, 12) + R(160, 32, 12, 116) + R(248, 32, 12, 116);
    s += t(210, 178, 'dno pod boky, strop přes boky', 'middle', 9);
    // traverzy
    s += R(300, 20, 12, 140) + R(388, 20, 12, 140) + R(312, 140, 76, 12) + R(312, 20, 20, 12, 'var(--accent)') + R(368, 20, 20, 12, 'var(--accent)');
    s += t(350, 178, 'traverzy (pod pracovní deskou)', 'middle', 9);
    return fig(420, 190, s, 'Základní sestavy korpusu (pohled zepředu). Kudy vede spára, rozhoduje, který díl nese zatížení a které hrany jsou vidět.');
  }
  function schemaCela() {
    let s = R(20, 20, 10, 120) + R(150, 20, 10, 120);
    s += `<rect x="16" y="10" width="148" height="8" fill="var(--accent)" fill-opacity=".8" stroke="currentColor"/>`;
    s += t(90, 160, 'na doraz: čelo = pole − spára', 'middle', 9);
    s += '<path d="M14 6V2M166 6V2" stroke="currentColor"/>' + t(90, 6, '', 'middle', 8);
    s += R(220, 20, 10, 120) + R(350, 20, 10, 120);
    s += `<rect x="233" y="20" width="114" height="8" fill="var(--accent)" fill-opacity=".8" stroke="currentColor"/>`;
    s += t(290, 160, 'vložené: čelo = otvor − 2 × spára', 'middle', 9);
    return fig(380, 170, s, 'Čela na doraz překrývají hrany korpusu (sousední skříňky mají mezi čely celou spáru), vložená čela sedí v otvoru lícem s korpusem.');
  }
  function schemaZasuvka() {
    let s = R(20, 20, 12, 120) + R(228, 20, 12, 120);
    s += `<rect x="44" y="50" width="172" height="80" fill="none" stroke="currentColor" stroke-width="1.5"/>`;
    s += `<rect x="32" y="96" width="12" height="10" fill="#2c8a4a" fill-opacity=".7"/><rect x="216" y="96" width="12" height="10" fill="#2c8a4a" fill-opacity=".7"/>`;
    s += '<path d="M32 150H44M32 146V154M44 146V154" stroke="var(--accent)"/>' + t(38, 166, 'vůle', 'middle', 9, 'var(--accent)');
    s += t(130, 92, 'korpus zásuvky', 'middle', 10) + t(130, 106, 'š = světlost − 2 × vůle', 'middle', 9);
    s += t(130, 14, 'výsuv (kuličkový 12,5 mm / skrytý ~5 mm – podle výrobce)', 'middle', 9);
    return fig(260, 176, s, 'Zásuvka: šířka korpusu zásuvky vychází ze světlé šířky otvoru mínus vůle výsuvu na každé straně; délka = nejbližší standardní délka výsuvu.');
  }

  function princip() {
    return `
<h3>Co stránka počítá</h3>
<p>Každý dílec je kvádr v souřadnicích sestavy (x doprava, y nahoru od podlahy, z od zdi dopředu). Z rozměrů korpusu, tloušťky desek a zvolené konstrukce se odvodí poloha a rozměr všech dílců, pak čela se spárami, korpusy zásuvek podle vůle výsuvů a nakonec všechny díry – systém 32, podložky a misky závěsů, spojovací kování a předvrty výsuvů. Kontrola kolizí ověří, že se žádné dva dílce nepřekrývají objemem (dotyk je v pořádku, překryv v drážce zad nebo dna zásuvky je záměrný).</p>
${schemaKonstrukce()}
<h3>Konstrukční zásady</h3>
<ul>
<li><b>Bok přes dno</b> (dno mezi boky) – klasika: skříňka stojí na bocích, spoje dna se namáhají smykem. <b>Dno pod boky</b> se hodí na nožičky nebo kolečka, hrana dna je pak vidět z boku (olepí se). Strop přes boky dává hladkou horní plochu bez spáry.</li>
<li><b>Traverzy</b> místo stropu – dolní kuchyňské skříňky pod pracovní deskou; přední traverza drží boky ve vzdálenosti, zadní nese záda a slouží k přišroubování desky.</li>
<li><b>Záda v drážce</b> (HDF 3 mm, drážka 8 mm, odsazení ~16 mm od zadní hrany) zpevní korpus a schovají nerovnost zdi; <b>přibitá záda</b> jsou nejrychlejší (sponky po ~100 mm + lepidlo, nejdřív srovnat úhlopříčky); <b>vložená záda</b> z tlustší desky (≥ 8 mm) se šroubují mezi boky.</li>
<li><b>Konfirmát 7 × 50</b>: stupňovitý vrták 5/7 mm – Ø7 skrz lícní díl, Ø5 do čela druhého dílu; spoj je pevný hned, ale nejde opakovaně rozebírat. <b>Kolík Ø8 × 35</b> s lepidlem je neviditelný a přesný, potřebuje svěrky. <b>Excentr Ø15</b> (minifix) je rozebíratelný – pouzdro v ploše dílu, svorník v protikusu; mezi excentry se dávají kolíky pro vedení.</li>
<li><b>Systém 32 mm</b>: přední řada děr Ø5 je 37 mm od přední hrany, rozteč 32 mm, zadní řada je v násobku 32 od přední. Do stejného rastru padají podpěrky polic, podložky závěsů i výsuvy, takže jeden přípravek vrtá vše. Rastr začíná ${'<i>prvním otvorem nad dnem</i>'} (nastavitelné).</li>
<li><b>Hrany</b>: pohledové hrany korpusu se olepují ABS 1 mm (nebo 0,8), čela kolem dokola 2 mm. Při odečítání se řezný rozměr zmenší o tloušťku hrany, aby po olepení seděl hotový rozměr.</li>
<li><b>Směr vláken</b>: u dekorů dřeva vedou vlákna boků a dvířek svisle, dna, police a čel zásuvek vodorovně (lze přepnout na svislá čela zásuvek – „jedno prkno“ přes celou výšku). U bílé, šedé a HDF lze dílce v řezném plánu otáčet.</li>
<li><b>Police</b> z DTD 18 mm se při rozpětí nad ~800 mm prohýbají – stránka upozorní; řešením je příčka, tlustší deska nebo nosná lišta.</li>
</ul>
${schemaCela()}
<h3>Čela, spáry a závěsy</h3>
<p>Čela na doraz se dělí na pole po osách příček a dělicích polic; od pole se odečte spára (polovina na každé straně), takže mezi sousedními čely i sousedními skříňkami vyjde vždy celá spára. Vložená čela mají spáru kolem dokola v otvoru. Počet závěsů roste s výškou dvířek: do 900 mm 2, do 1600 mm 3, do 2000 mm 4, do 2400 mm 5 (typické hodnoty, u těžkých nebo prosklených dvířek přidejte). Misky Ø35 jsou ~22 mm od hrany (podle typu závěsu 3–6 mm „K“), podložky na boku sedí v přední řadě systému 32 – závěsy se proto přichytávají do rastru.</p>
${schemaZasuvka()}
<h3>Výstupy</h3>
<ul>
<li><b>Kusovník</b> sdružuje stejné dílce (název, rozměr, materiál, hrany, vlákna). Délka je vždy rozměr podél vláken, pokud dílec vlákna má.</li>
<li><b>Řezný plán</b> je jednoduché gilotinové dělení (každý řez prochází celým zbytkem desky) s prořezem a ořezem okrajů. Pro optimalizaci a export do pily použijte JSON pro <a href="rezny_plan.html">Řezný plán</a>.</li>
<li><b>Plán vrtání</b> ukazuje dílec ze strany s více dírami; díry z druhé strany jsou čárkovaně, díry do hran jsou v rozvinutých pásech kolem obrysu. DXF dílců má hloubku v názvu vrstvy (VRT_D5_H12, RUB_…, HRANA_…), jak to čte většina CAM programů.</li>
<li>Papírové šablony 1:1 pro ruční vrtání (systém 32, závěsy, výsuvy, konfirmáty) připraví <a href="vrtaci_sablony.html">Vrtací šablony</a>.</li>
</ul>
<p class="info">Všechny hodnoty kování (vůle výsuvů, poloha misek, hloubky děr, délky konfirmátů) jsou typické a editovatelné – před vrtáním je porovnejte s návodem konkrétního výrobce.</p>`;
  }

  function postup() {
    return `
<h3>Postup výroby a montáže</h3>
<ol>
<li><b>Kontrola projektu</b>: žádná varování, rozměry odpovídají místu (u linky změřte zeď ve třech výškách a připočtěte rezervu u rohu a spotřebičů).</li>
<li><b>Nářez</b>: kusovník / JSON pošlete do velkoobchodu s formátovací pilou (řezné rozměry, olepení ABS dle sloupce hrany). Doma: okružní pila s vodicí lištou, nejdřív delší podélné řezy, dílce označte (K1-BL…).</li>
<li><b>Olepení hran</b> (nažehlovací nebo olepovačka), přesahy zařízněte a začistěte hranou škrabkou.</li>
<li><b>Vrtání</b> podle plánu vrtání: nejdřív systém 32 a podložky závěsů na bocích (přípravek nebo šablona 1:1 přiložená k přední hraně), pak spojovací díry do ploch, nakonec díry do hran (kolíkovačka nebo přípravek, vrták kolmo, hloubkový doraz). Misky Ø35 vrtejte Forstnerovým vrtákem na stojanové vrtačce s dorazem.</li>
<li><b>Drážky pro záda</b> (pokud jsou): okružní pilou nebo frézkou drážkovou frézou 3–4 mm, hloubka 8 mm, odsazení od zadní hrany podle nastavení.</li>
<li><b>Sestavení korpusu</b> na rovné podložce: boky + dno + strop/traverzy, příčky, pevné police. Konfirmáty utahujte ručně (aku šroubovák s nízkým momentem). Záda zasuňte do drážky ještě před stropem / přibijte až po kontrole pravoúhlosti – <b>úhlopříčky musí být stejné</b>.</li>
<li><b>Nožičky / sokl</b>, korpus postavte, vyrovnejte vodováhou, sousední korpusy stáhněte spojovacími šrouby přes boky (u linky), horní skříňky pověste na lištu a závěsy.</li>
<li><b>Výsuvy a zásuvky</b>: lišty výsuvů na boky do předvrtů, korpusy zásuvek sestavte, nasaďte, čela připevněte nejprve oboustrannou páskou, seřiďte spáry a pak přišroubujte zevnitř.</li>
<li><b>Dvířka</b>: závěsy do misek, nacvaknout na podložky, seřídit stavěcími šrouby závěsů (strana, hloubka, výška) na stejnou spáru.</li>
<li><b>Pracovní deska</b>: přišroubovat zespodu přes traverzy (vruty kratší než tloušťka desky!), řezy a zadní hranu zatěsnit silikonem nebo lakem proti vlhkosti.</li>
</ol>
<h3>Bezpečnost u strojů</h3>
<ul>
<li><b>Okružní pila</b>: ochranný kryt a rozváděcí klín vždy nasazené, úzké dílce podávat posuvkou, nikdy rukou mezi kotoučem a podélným dorazem; stát mimo osu kotouče (zpětný vrh). Velkoformátové desky si nechte nařezat – je to bezpečnější a přesnější.</li>
<li><b>Ruční frézka</b>: dílec upnout, frézovat proti směru otáčení, oběma rukama držet frézku, nikdy nesahat pod základnu.</li>
<li><b>Stojanová vrtačka</b>: dílec opřít o doraz nebo upnout (Forstnerův vrták Ø35 umí dílec vytrhnout a roztočit), žádné rukavice u rotujícího vřetena, dlouhé vlasy svázat.</li>
<li><b>Prach z DTD a MDF</b> je zdraví škodlivý – odsávání, respirátor FFP2/FFP3, ochranné brýle a chrániče sluchu.</li>
<li>Vysoké skříně a horní skříňky <b>vždy kotvěte ke zdi</b> (ochrana proti převržení, zejména kvůli dětem); nosnost hmoždinek ověřte podle typu zdiva.</li>
</ul>`;
  }
  koren.NSPrincip = { princip, postup };
})(typeof window !== 'undefined' ? window : globalThis);

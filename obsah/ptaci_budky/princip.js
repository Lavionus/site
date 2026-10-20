/* ============================================================
   Ptačí budky – texty „Jak to funguje“, postup výroby, kdy vyvěsit, čištění, predátoři, hmyzí hotel.
   Vrací HTML (bez DOM). Čísla se doplňují z aktuální sestavy.
   ============================================================ */
(function (koren) {
  'use strict';
  const PB = koren.PB || (typeof require !== 'undefined' ? require('./jadro.js') : null);
  const cz = PB.cz;

  function princip(B) {
    const S = B.druh, u = B.dutina, o = B.info.otv, net = B.typ === 'netopyr', polo = B.typ === 'polobudka';
    const otvTxt = o ? (o.tvar === 'oval' ? `oválný ${cz(o.w, 0)} × ${cz(o.h, 0)} mm` : `Ø ${cz(o.w, 0)} mm`) : polo ? 'polootevřené čelo' : 'štěrbina zespodu';
    return `
<h3>Proč právě tyto rozměry</h3>
<p><b>Vletový otvor rozhoduje, kdo se nastěhuje.</b> ${o ? `Pro druh ${S.nazev.toLowerCase()} je doporučený otvor ${otvTxt} (rozsah ${S.otvor.rozsah.join('–')} mm). Menší otvor nepustí větší a silnější druhy (koňadru, vrabce, špačka), které by menší druh vytlačily.` : polo ? 'Polobudka má otevřenou horní část čela – druhy jako rehek, konipas nebo lejsek šedý potřebují výhled a hnízdí v polodutinách.' : 'Netopýři lezou do úzké štěrbiny zespodu; šířka štěrbiny 15–25 mm odpovídá štěrbinám za kůrou a v trámech.'}</p>
<p><b>Výška otvoru ode dna</b> (${o ? cz(o.c[1] - o.h / 2 - u.zd, 0) + ' mm' : '–'}) brání kuně, kočce a strace dosáhnout tlapou nebo zobákem na mláďata. U malých dutinových budek se doporučuje alespoň 120–130 mm (RSPB: min. 125 mm).</p>
<p><b>Dno ${cz(u.W, 0)} × ${cz(u.D, 0)} mm</b> – dost místa pro hnízdo a snůšku, ale ne tolik, aby budka vychladla. <b>Tloušťka prkna ${cz(u.t, 0)} mm</b> izoluje proti přehřátí i chladu (doporučeno 18–25 mm, ne méně než 15 mm).</p>
<h3>Konstrukce</h3>
<ul>
<li><b>Stříška se sklonem ${cz(u.alfa)}°</b> a přesahem ${cz(B.P.presahPredni, 0)} mm přes čelo odvádí vodu dopředu a chrání otvor před deštěm. Zadní konec stříšky je seříznutý pod úhlem ${cz(u.alfa)}°, aby po osazení svisle dosedl k zadní stěně.</li>
<li><b>Otevírání pro čištění:</b> ${B.cisteni === 'strecha' ? 'stříška na pantu u zadní stěny, zajištěná háčkem (proti větru a kunám).' : B.cisteni === 'bok' ? 'levý bok se vyklápí na dvou hřebících nahoře (čepy přes přední a zadní stěnu), dole ho drží pojistný vrut. Mezera nad bokem slouží i k větrání.' : 'netopýří budku není třeba čistit – trus vypadává štěrbinou.'}</li>
${net ? '' : '<li><b>Odvodnění:</b> 4 otvory Ø 6 mm v rozích dna – voda, která zateče, odteče a hnízdo neplesniví.</li><li><b>Větrání:</b> otvory Ø 8 mm v bocích nahoře u zadní stěny (nebo mezera nad otočným bokem) – v létě se budka nepřehřeje.</li>'}
<li><b>Drsná vnitřní stěna pod otvorem</b> (vroubky pilou po ~10 mm) – mláďata po ní vylezou k otvoru. Dřevo uvnitř nehoblujte a nenatírejte.</li>
<li><b>Žádné bidélko.</b> Ptáci ho nepotřebují, pomáhá jen predátorům (straka, sojka) se zachytit a vybírat hnízdo.</li>
<li><b>Materiál:</b> neošetřené vyschlé dřevo (smrk, borovice, modřín, dub), případně voděodolná překližka. Natírat jen zvenku přírodním olejem nebo lazurou bez biocidů, uvnitř nic. Spoje lepit lepidlem D3 a šroubovat nerezovými nebo pozinkovanými vruty.</li>
</ul>
<h3>Doporučení: ${S.nazev} (<i>${S.lat}</i>)</h3>
<p>Výška zavěšení: <b>${S.zav[0]}–${S.zav[1]} m</b>. Orientace: <b>${S.orient}</b>. ${S.pozn}</p>
<p class="info">Zdroje (doporučení, hodnoty se mezi organizacemi liší o několik mm): ${S.zdroje.map((z) => PB.ZDROJE[z]).join('; ')}. Rozměry jsou typické hodnoty – všechny lze upravit.</p>
<h3>Kdy vyvěsit</h3>
<p>${net ? 'Netopýří budky nejlépe na jaře (březen–duben), osídlení může trvat i několik let. Vyvěste víc budek s různou orientací (J, JV, JZ) – netopýři se během léta stěhují podle teploty.' : 'Nejlépe na podzim nebo v zimě (říjen–únor): ptáci budky využívají k přenocování a na jaře je už znají. Sýkory začínají stavět v březnu, puštík hnízdí už od února – sovy budky vyvěste do konce ledna. Nová budka vyvěšená v dubnu ještě může být obsazena druhou snůškou.'}</p>
<h3>Čištění</h3>
<p>${net ? 'Netopýří budka se nečistí. Pokud se pod ní hromadí trus, je obsazená – v době mláďat (červen–srpen) ji nekontrolujte a nerušte. Netopýři jsou zvláště chránění.' : 'Jednou ročně <b>po skončení hnízdění, v září až listopadu</b> (nikdy ne v době hnízdění – ptáci jsou chránění zákonem o ochraně přírody a hnízdo se nesmí rušit). Staré hnízdo vyhoďte (paraziti – blechy, roztoči), budku vykartáčujte, případně vypařte vřelou vodou; žádnou chemii ani dezinfekci. Pracujte v rukavicích. Najdete-li nevylíhlá vejce, smí se odstranit až po skončení hnízdní sezony.'}</p>
<h3>Ochrana před predátory</h3>
<ul>
<li>Budku věšte na hladký kmen nebo zeď bez větví v blízkosti, ze kterých by kočka nebo kuna doskočila; mimo dosah z plotu a střechy.</li>
<li>Kmen lze chránit manžetou z plechu nebo ostnatým límcem (proti kočkám a kunám).</li>
<li><b>Prodloužený tunel před otvorem</b> (STL níže, 40–80 mm) – kuna ani straka přes delší tunel na mláďata nedosáhne. Tunel má stejnou světlost jako otvor.</li>
<li>Strakapoud rád rozšiřuje otvor a vybírá mláďata – kovový nebo plastový kroužek kolem otvoru (tunel) to znemožní.</li>
<li>Stříšku vždy zajistěte háčkem – kuna umí víko odklopit.</li>
</ul>`;
  }

  function postup(B) {
    const u = B.dutina, net = B.typ === 'netopyr';
    return `
<h3>Postup výroby krok za krokem</h3>
<ol>
<li><b>Prkno</b> ${cz(B.P.B, 0)} × ${cz(u.t, 0)} mm, délka min. ${cz(PB.minimalniPrkno(B, B.P).delka, 0)} mm. Zkontrolujte, že je rovné a vyschlé (vlhkost do ~15 %), bez velkých suků v místě otvoru.</li>
<li><b>Orýsování</b> podle řezného plánu – díly v pořadí na prkně, mezi nimi prořez ${cz(B.P.prorez, 0)} mm (šířka kotouče). Šablony 1:1 z PDF přilepte na díly nebo propíchněte středy otvorů a vrutů.</li>
<li><b>Příčné řezy</b> na pokosové nebo okružní pile s příčným dorazem. Přední stěnu a stříšku řežte s <b>úkosem ${cz(u.alfa)}°</b> (náklon kotouče); po úkosovém řezu začistěte konec zbytku prkna kolmo.</li>
<li><b>Boky</b> jako dvojice: odměřte celek, pak jedním <b>šikmým řezem</b> (v rovině prkna, ${cz(u.alfa)}° od příčného směru) rozdělte na levý a pravý bok – oba lichoběžníky do sebe zapadnou. Šikmý řez veďte podél pravítka nebo na pásové pile.</li>
<li><b>Vletový otvor</b> vrtejte <b>vrtací korunkou nebo Forstnerovým vrtákem</b> do upnutého dílu (svěrky, podložka pod dílem proti vytržení). Ovál vyřízněte přímočarou pilou z vrtaných děr. Hrany otvoru zlehka zaoblete pilníkem.</li>
<li><b>Vroubky</b> na vnitřní straně čela pod otvorem – několik příčných zářezů pilkou hlubokých ~1–2 mm${net ? ', u netopýří budky na celé zadní stěně uvnitř i na přistávací ploše' : ''}.</li>
<li><b>Otvory</b> pro odvodnění a větrání (Ø 6 / 8 mm), předvrtání vrutů (~60 % průměru vrutu, 10 mm od hrany).</li>
<li><b>Sestavení</b> v pořadí animace: ${net ? 'lišty (boky) na zadní stěnu → přední stěna → stříška' : 'dno mezi boky → zadní stěna → boky → přední stěna → stříška'}. Lepit a šroubovat; zkontrolujte pravé úhly.</li>
<li><b>Pant a háček</b> (nebo čepy otočného boku), montážní otvory v zadní stěně. Volitelně ošetřit vnější plochy olejem.</li>
</ol>
<h3>Bezpečnost u strojů</h3>
<ul>
<li>Okružní / pokosová pila: ochranný kryt kotouče, rozvírací klín, <b>krátké díly neřežte bez příčného dorazu nebo přípravku</b>; ruce nikdy v linii kotouče, na dosah posuvka. Úkos nastavujte při vypnutém stroji a vytaženém přívodu.</li>
<li>Šikmý řez boků na okružní pile veďte jen v saních nebo s přípravkem – úzké díly mohou být vymrštěny zpětným rázem.</li>
<li>Vrtačka s korunkou: díl vždy upnout svěrkami (korunka se zakusuje a díl vytrhne z ruky), nízké otáčky, brýle.</li>
<li>Ochrana sluchu a očí, odsávání prachu (dubový a bukový prach je karcinogenní).</li>
</ul>`;
  }

  function hotelText(H) {
    return `
<h3>Jak hmyzí hotel funguje</h3>
<p>Samotářské včely (zednice, čalounice, drvodělky) a vosičky kladou vajíčka do <b>úzkých slepých chodbiček</b>: do chodbičky nanosí pyl, nakladou vajíčko, oddělí přepážkou z hlíny nebo listů a pokračují k ústí. Larvy přezimují uvnitř a na jaře se vyprostí. Proto:</p>
<ul>
<li><b>Otvory Ø 2–10 mm</b>, nejvíce 4–8 mm (zednice rezavá ~7–8 mm). Různé průměry = různé druhy.</li>
<li><b>Hloubka</b>: malé otvory 50–80 mm, Ø 6–10 mm 100–150 mm (v delších chodbičkách se líhne víc samiček). Tady: ${[2, 4, 6, 8, 10].map((d) => `Ø ${d} → ${PB.hloubkaOtvoru(d, H.dutina.D - 15)} mm`).join(', ')}.</li>
<li><b>Neprůchozí</b> – zadní stěna musí být zavřená, průchozí trubičky včely neobsadí (průvan, predátoři).</li>
<li><b>Hladké stěny otvorů</b> – vrtejte ostrým vrtákem do <b>boku</b> tvrdého vyschlého dřeva (buk, jasan, dub, ovocné), ne do čela (praská, vlhne). Ústí zbavte třísek a vybruste – roztřepená vlákna trhají křídla.</li>
<li><b>Trubičky</b> rákosu nebo bambusu uřízněte těsně za kolénkem (zadní konec zavřený), ústí bez otřepů, zasuňte natěsno.</li>
<li><b>Rozestup otvorů</b> ≥ ${cz(H.H.rozestup, 0)} mm, okraj bloku ≥ ${cz(H.H.okraj, 0)} mm – blok nepraská.</li>
<li>Měkké dřevo jehličnanů (pryskyřice, třísky), šišky, slámu a dřevitou vlnu nepoužívejte – včely je neosídlí, jen se tam množí plísně a škvoři.</li>
</ul>
<h3>Umístění</h3>
<ul>
<li>Na <b>slunné místo s orientací J až JV</b>, chráněné před deštěm a větrem, alespoň 0,5–1 m nad zemí, pevně (nesmí se kývat).</li>
<li>Do 100–300 m musí kvést rostliny (včely létají blízko) a být zdroj vlhké hlíny na přepážky.</li>
<li>Přední stranu chraňte pletivem (oko 15–25 mm, 2–3 cm od čela) proti sýkorám a datlům.</li>
<li>Přes zimu nechte venku – larvy potřebují chlad. Do tepla domu je nenoste (vylíhly by se předčasně).</li>
</ul>
<h3>Údržba</h3>
<p>Plesnivé nebo staré trubičky (po 2–3 letech) vyměňte – na jaře po vylétnutí, staré moduly odložte poblíž, aby se z nich dokončili poslední obyvatelé. Dřevěné bloky lze provrtat znovu.</p>`;
  }

  const API = { princip, postup, hotelText };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.PBP = API;
})(typeof window !== 'undefined' ? window : globalThis);

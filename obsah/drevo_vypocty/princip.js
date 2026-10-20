/* ============================================================
   Dřevo – pohyb, průhyb, povrchy · „Jak to funguje“ (HTML texty ke každé záložce)
   ============================================================ */
(function (koren) {
  'use strict';
  const P = {};

  P.pohyb = `
<h3>Proč se dřevo hýbe</h3>
<p>Dřevo je hygroskopické: s okolním vzduchem si vyměňuje vodu, dokud nedosáhne <b>rovnovážné vlhkosti</b> (EMC, <i>equilibrium moisture content</i>).
Pod bodem nasycení vláken (FSP, cca 25–30 %) voda vstupuje do buněčných stěn a dřevo bobtná, při vysychání sesychá.
Nad FSP přibývá jen volná voda v dutinách a rozměr se nemění.</p>
<h3>Rovnovážná vlhkost – rovnice Hailwood–Horrobin</h3>
<p>Wood Handbook (USDA FPL, 2010, rov. 4-5) uvádí empirickou sorpční izotermu, platnou pro většinu dřevin
(desorpce/adsorpce průměrně):</p>
<p><code>EMC = 1800/W · [ Kh/(1−Kh) + (K₁Kh + 2K₁K₂K²h²) / (1 + K₁Kh + K₁K₂K²h²) ]</code></p>
<p>kde h je relativní vlhkost (0–1) a W, K, K₁, K₂ jsou kvadratické funkce teploty v °C:
W = 349 + 1,29T + 0,0135T², K = 0,805 + 0,000736T − 0,00000273T², K₁ = 6,27 − 0,00938T − 0,000303T², K₂ = 1,91 + 0,0407T − 0,000293T².
Při 20 °C a 65 % RH vychází 12,0 % – proto se „normová“ vlhkost uvádí jako 12 %.</p>
<h3>Změna rozměru</h3>
<p><code>ΔD = D · C · (MC₂ − MC₁)</code> – D je rozměr napříč vlákny, C koeficient rozměrové změny na 1 % vlhkosti
(Wood Handbook tab. 4-5, platí cca pro 6–14 %), MC vlhkost v %. Tangenciálně (podél letokruhů) se dřevo hýbe
zhruba 1,5–2,5× víc než radiálně, podélně jen ~0,01 % na 1 % – podélný pohyb se v nábytku zanedbává.</p>
<p>U desky s letokruhy pod úhlem θ k ploše platí transformace <code>C(θ) = C_T·cos²θ + C_R·sin²θ</code>.
„Poloha v kmeni“ integruje úhel přes celou šířku: u tangenciálního prkna z kraje kmene jsou letokruhy na okrajích skloněné, a koeficient je proto o něco menší než čisté C_T.</p>
<h3>Roční průběh</h3>
<p>Z měsíčních průměrů teploty a RH se spočte EMC. Skutečná vlhkost dřeva se opožďuje – model prvního řádu
s časovou konstantou τ (dny). Orientačně: 20 mm neošetřené dřevo τ ≈ 10–20 dní, 40 mm ≈ 40–80 dní; olej zpomalí málo,
film laku 2–5× (lak výměnu vlhkosti <b>zpomalí, ale nezastaví</b>).
Vytápěný interiér je v zimě suchý: venkovní vzduch o 0 °C a 85 % RH ohřátý na 21 °C má jen asi 25 % RH.
Tuto úvahu dělá volba „interiér odvozený z venkovního klimatu“ (stejný obsah páry + vnitřní produkce vlhkosti Δp podle EN ISO 13788).</p>
<h3>Konstrukční zásady</h3>
<ul>
<li><b>Výplň v rámu</b> (<i>floating panel</i>) – nelepit, jen vložit do drážky; mezera ke dnu drážky pojme letní roztažení, hloubka drážky drží výplň i v zimě. Výplň namořte a naolejujte <b>před</b> sestavením, jinak se v zimě odkryje nenamořený pruh.</li>
<li><b>Deska stolu</b> – pevně jen v jedné linii (střed nebo zadní hrana), jinde podlouhlé otvory napříč vláken (<i>slotted holes</i>), kovové příchytky „osmičky“ (<i>figure-8</i>) nebo dřevěné knoflíky (<i>buttons</i>) v drážce lubu.</li>
<li><b>Palubky a obklady</b> – montovat při vlhkosti blízké provozní; v suchém interiéru nechat aklimatizovat 1–2 týdny. Mezery u stěn = celkové roztažení plochy.</li>
<li>Křížově lepené spoje masivu (např. lišta napříč deskou lepená po celé délce) praskají – lepit jen střed, konce šroubovat v podélných otvorech (<i>breadboard end</i>).</li>
</ul>
<h3>Zdroje a přesnost</h3>
<p>USDA Forest Products Laboratory: <i>Wood Handbook – Wood as an Engineering Material</i>, GTR-190 (2010), public domain – rovnice EMC a koeficienty amerických dřevin.
Evropské dřeviny: typické hodnoty z literatury nauky o dřevě (orientační). Jednotlivé kusy se liší o ±15–25 % – počítejte s rezervou.</p>`;

  P.pruhyb = `
<h3>Model</h3>
<p>Police je nosník Euler–Bernoulli, řešený metodou konečných prvků (200+ prvků s Hermitovými funkcemi), takže zvládne libovolné
rozmístění podpor, převislé konce i vetknutí. Kontrola: prostý nosník s rovnoměrným zatížením dává přesně
<code>δ = 5qL⁴ / (384·E·I)</code>, osamělá síla uprostřed <code>δ = PL³/(48·E·I)</code>.</p>
<h3>Složený průřez (lišta, výztuha)</h3>
<p>Přední lišta nalepená na hranu police (<i>edge banding / front rail</i>) zvětšuje moment setrvačnosti s třetí mocninou výšky.
Průřez se skládá z obdélníků s vlastním modulem pružnosti; neutrální osa <code>ȳ = ΣEᵢAᵢyᵢ / ΣEᵢAᵢ</code>,
tuhost <code>EI = Σ Eᵢ·(bᵢhᵢ³/12 + Aᵢ·dᵢ²)</code> (Steinerova věta). Předpoklad: lišta je <b>nalepená po celé délce</b> – šroubovaná nebo jen přiložená lišta pomáhá mnohem méně.
Lišta 20×40 mm na 18mm DTD zmenší průhyb zhruba 2,5–4×; lišta na výšku je účinnější než silnější deska.</p>
<h3>Dotvarování (creep)</h3>
<p>Dřevo a desky se pod trvalým zatížením dál prohýbají. Eurokód 5 (EN 1995-1-1, tab. 3.2) dává součinitel k_def pro třídu provozu 1:
masiv a lepené lamelové dřevo 0,6, překližka 0,8, OSB/3 1,5, dřevotříska a MDF 2,25. Konečný průhyb od trvalého zatížení
<code>δ_fin = δ_inst · (1 + k_def)</code>. Knihovna je typické trvalé zatížení – u DTD je tedy konečný průhyb ~3,25× okamžitý.</p>
<h3>Limit</h3>
<p>Běžný limit pro police je L/300 (1 mm na 300 mm rozpětí); Sagulator (Woodbin) používá přísnějších 0,02″ na stopu ≈ L/600,
od kterého je průhyb okem prakticky neviditelný. U převislého konce se limit počítá z dvojnásobku vyložení.</p>
<h3>Typické hodnoty</h3>
<p>Moduly pružnosti jsou typické střední hodnoty (desky podle EN 12369-1 a technických listů, masiv podle Wood Handbook tab. 5-3a a evropské literatury)
a lze je přepsat. Zatížení knihami se mezi knihovnami liší až dvojnásobně – nejlépe zvážit metr vlastních knih.</p>
<h3>Praktické rady</h3>
<ul><li>Zkrácení rozpětí o 20 % zmenší průhyb o ~60 % (L⁴).</li>
<li>Prostřední podpora (příčka, konzola) u dlouhé police je účinnější než silnější materiál.</li>
<li>Zadní lišta přišroubovaná do korpusu nebo zad (vetknutí po délce) průhyb také výrazně omezí – tento model ho nepočítá, je na straně bezpečnosti.</li>
<li>Kolíčky do 5 mm otvorů unesou typicky desítky kg na kus – nosnost kolíčků a jejich otvorů ověřte u výrobce.</li></ul>`;

  P.povrch = `
<h3>Spotřeba</h3>
<p><code>V = A · (k₁ + (n − 1)) / vydatnost · k_nanášení · (1 + rezerva)</code> – A plocha (m²), n počet vrstev, vydatnost v m²/l na vrstvu,
k₁ násobek první vrstvy (savé dřevo vypije víc, typicky 1,2–1,5 u olejů), k_nanášení ztráty (stříkání HVLP ~1,35, vzduchové ~1,6).
Vydatnosti jsou <b>typické</b> – vždy platí údaj z technického listu konkrétního výrobku. Tvrdé jemnopórovité dřevo (buk, javor) vypije méně než
měkké nebo hrubopórovité (smrk, dub, jasan).</p>
<h3>Plocha z kusovníku</h3>
<p>Každý díl: obě plochy, podélné hrany a čela. Čela savě pijí 2–3× víc – nechte je v rezervě, nebo je předem zatřete zředěným nátěrem.</p>
<h3>Postup (obecně)</h3>
<ol>
<li>Broušení po stupních (P120 → P150 → P180, nepřeskakovat víc než jeden stupeň), vždy po směru vláken, nakonec kontrola šikmým světlem.</li>
<li>U vodou ředitelných hmot navlhčit povrch, nechat zaschnout a zvednuté vlákno přebrousit (jinak je po první vrstvě povrch drsný).</li>
<li>Odprášit (vysavač, antistatická prachovka – ne hadr s olejem pod lak).</li>
<li>Nanášet tenké vrstvy; oleje a vosky po 15–20 min důkladně setřít přebytek.</li>
<li>Mezibroušení po proschnutí (lak P240–P320, olej rouno), odprášit.</li>
<li>Plného vytvrzení se dosáhne za dny až týdny – do té doby nezatěžovat, nezakrývat, nepokládat předměty natrvalo.</li>
</ol>
<h3>Bezpečnost</h3>
<ul>
<li><b>Hadry od oleje (lněný, tungový, voskové oleje) se mohou samovolně vznítit!</b> Rozložit naplocho venku k vyschnutí, nebo uložit do uzavřené kovové nádoby s vodou.</li>
<li>Rozpouštědlové laky a nitro: větrat, bez otevřeného ohně, respirátor s filtrem A2 (organické páry), rukavice nitril.</li>
<li>Broušení: odsávání + respirátor FFP2/FFP3 – prach z dubu a buku je karcinogenní (IARC sk. 1).</li>
</ul>
<p>Časy schnutí platí pro cca 20 °C a 50–65 % RH; při 10 °C se zhruba zdvojnásobí, vysoká vlhkost zpomalí vodou ředitelné hmoty.</p>`;

  P.objem = `
<h3>Objem</h3>
<p>Řezivo: <code>V = L·Š·T·ks</code> (m³ = plm – plnometr, skutečný objem dřevní hmoty). Kulatina: Huberův vzorec <code>V = π/4 · d² · L</code> se středovým
průměrem bez kůry; Smalianův <code>V = π/8 · (d₁² + d₂²) · L</code> z průměrů čel (u kuželovitých kmenů nadhodnocuje).
Prostorové metry (prm): rovnané štípané dříví 1 prm ≈ 0,6–0,7 plm, sypané (prms) ≈ 0,4 plm – závisí na délce a tvaru polen.</p>
<h3>Hmotnost a vlhkost</h3>
<p>Vlhkost dřeva v truhlářství = <b>absolutní</b> (na sušinu): <code>MC = (m − m₀)/m₀ · 100 %</code>, m₀ hmotnost po vysušení při 103 ± 2 °C.
U palivového dříví se často uvádí <b>relativní</b> vlhkost (na mokrou hmotnost) <code>w = (m − m₀)/m</code>; převod <code>MC = w/(100 − w)·100</code>.</p>
<p>Hmotnost po sušení: <code>m₂ = m₁ · (1 + MC₂) / (1 + MC₁)</code> – sušina zůstává, odchází jen voda.
Hustota při vlhkosti MC se odvozuje z hustoty při 12 % (stálá sušina, objem se mění objemovým koeficientem ≈ C_T + C_R do FSP).</p>
<h3>Orientační doby sušení na vzduchu</h3>
<p>Staré pravidlo „rok na palec (25 mm) tloušťky“ platí jen hrubě; venku pod střechou dřevo dosáhne pouze venkovní EMC (u nás 14–18 %),
pro nábytek do vytápěného interiéru (8–10 %) je nutné dosušení v sušárně nebo v interiéru. Vlhkoměr s kolíky se kalibruje na dřevinu a teplotu.</p>
<p>Ceny jsou jen ilustrativní – vložte ceny svého dodavatele (Kč/m³ s DPH nebo bez, ale jednotně).</p>`;

  koren.DVP = P;
  if (typeof module !== 'undefined' && module.exports) module.exports = P;
})(typeof window !== 'undefined' ? window : globalThis);

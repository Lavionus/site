/* Lekce výukové stránky Excel – vzorce (window.XLV_LEKCE).
   Vzorce v datech jsou v ANGLICKÉM zápisu (čárky, tečky) – stránka je převede do zvoleného jazyka.
   V textu: [[=vzorec]] = klikací ukázka (rozloží se v dílně), {SUM} = název funkce v aktuálním jazyce,
   {;} = oddělovač argumentů, [[@C2]] = odkaz, který vybere buňku v listu.
   Úloha: { id, zadani, cil, reseni, kopirovat?, absolutni?, vyzaduje?, varianty?, chranit?, napovedy[] }
   Předpověď: { vzorec } = „Co vrátí?“, nebo { vzorec, z, na } = „Jak bude vypadat po zkopírování?“ */
window.XLV_LEKCE = [
{
  id: 'zaklady', emoji: '✏️', nazev: 'První vzorec',
  cile: ['vím, že vzorec začíná znakem =', 'znám operátory a jejich pořadí', 'počítám s adresami buněk, ne s opsanými čísly'],
  text: `
<h3>Co je vzorec</h3>
<p>Buňka může obsahovat <b>hodnotu</b> (číslo, text, datum) nebo <b>vzorec</b>. Vzorec vždy začíná znakem <kbd>=</kbd>.
Bez něj je <code>2+3</code> jen text. V buňce se ukáže <b>výsledek</b>, vzorec samotný vidíte v řádku vzorců nad listem.</p>
<p>Klikněte v listu na buňku [[@C2]]. Nahoře uvidíte vzorec [[=A2*B2]]: „vezmi to, co je v A2, a vynásob tím, co je v B2“.
Změňte cenu v [[@A2]] a sledujte, jak se C2 sama přepočítá. <b>To je celé kouzlo tabulky:</b> vzorec si nepamatuje čísla, ale <i>adresy</i>.</p>
<div class="pozor">Nepište <code>=120*3</code>. Když se cena změní, výsledek zůstane starý. Pište <code>=A2*B2</code>.</div>

<h3>Adresa buňky</h3>
<p>Adresa = <b>písmeno sloupce + číslo řádku</b>: <code>B3</code> je sloupec B, řádek 3. Do vzorce ji nemusíte psát –
<b>při psaní vzorce klikněte na buňku</b> a adresa se vloží sama. Barevně se pak zvýrazní, kam vzorec „sahá“.</p>

<h3>Operátory</h3>
<table class="tab">
<tr><th>Znak</th><th>Význam</th><th>Ukázka</th></tr>
<tr><td><kbd>+</kbd> <kbd>-</kbd></td><td>sčítání, odčítání</td><td>[[=A2+A3]]</td></tr>
<tr><td><kbd>*</kbd> <kbd>/</kbd></td><td>násobení, dělení</td><td>[[=A2/B2]]</td></tr>
<tr><td><kbd>^</kbd></td><td>mocnina</td><td>[[=2^10]]</td></tr>
<tr><td><kbd>%</kbd></td><td>procento (vydělí 100)</td><td>[[=A2*15%]]</td></tr>
<tr><td><kbd>&amp;</kbd></td><td>spojení textů</td><td>[[="Cena: "&A2&" Kč"]]</td></tr>
<tr><td><kbd>=</kbd> <kbd>&lt;&gt;</kbd> <kbd>&lt;</kbd> <kbd>&gt;</kbd> <kbd>&lt;=</kbd> <kbd>&gt;=</kbd></td><td>porovnání → PRAVDA / NEPRAVDA</td><td>[[=A2>100]]</td></tr>
</table>

<h3>Pořadí výpočtu</h3>
<p>Platí matematika ze školy: nejdřív <code>^</code>, pak <code>* /</code>, pak <code>+ -</code>, nakonec <code>&amp;</code> a porovnání.
Závorky mají přednost před vším. Porovnejte [[=2+3*4]] a [[=(2+3)*4]] – klikněte na ně a projděte výpočet krok za krokem.</p>
<div class="pozor"><b>Past:</b> v Excelu má záporné znaménko přednost před mocninou. [[=-2^2]] dá <b>4</b>, ne −4.
Chcete-li −4, napište [[=-(2^2)]].</div>
<p>Kliknutím na kteroukoli ukázku ji uvidíte v dílně rozloženou na kroky – jako Excelové <i>Vzorce → Vyhodnotit vzorec</i>.</p>`,
  list: { sloupcu: 5, radku: 6, bunky: {
    A1: 'Cena za kus', B1: 'Kusů', C1: 'Celkem', D1: 'S DPH', E1: 'Sazba DPH',
    A2: '120', B2: '3', C2: '=A2*B2', E2: '21%',
    A3: '80', B3: '5',
    A5: 'Průměrná cena:',
  } },
  predpovez: [
    { vzorec: '=2+3*4' }, { vzorec: '=(2+3)*4' }, { vzorec: '=10/4' }, { vzorec: '=-2^2' }, { vzorec: '="Ahoj"&" "&"světe"' }, { vzorec: '=A2>100' },
  ],
  ulohy: [
    { id: 'z1', cil: 'C3', reseni: '=A3*B3', zadani: 'Do [[@C3]] spočítejte, kolik stojí všechny kusy ve 3. řádku.',
      napovedy: ['Stejně jako v C2, jen o řádek níž.', 'Napište = a klikněte na A3, pak *, pak klikněte na B3 a Enter.'] },
    { id: 'z2', cil: 'D2', reseni: '=C2*(1+E2)', zadani: 'Do [[@D2]] spočítejte cenu celkem <b>včetně DPH</b>. Sazba je v [[@E2]].',
      napovedy: ['Cena s DPH = cena × (1 + sazba). 21 % je 0,21.', 'Pozor na závorky: =C2*(1+E2). Bez nich by se násobilo jen 1.'] },
    { id: 'z3', cil: 'B5', reseni: '=(A2+A3)/2', zadani: 'Do [[@B5]] spočítejte průměrnou cenu za kus z A2 a A3 – zatím bez funkcí, jen operátory.',
      napovedy: ['Průměr = součet ÷ počet.', 'Sčítání musí proběhnout dřív než dělení → závorky.'] },
  ],
},
{
  id: 'odkazy', emoji: '📌', nazev: 'Kopírování a znak $',
  cile: ['chápu, proč se odkazy při kopírování posouvají', 'umím ukotvit odkaz znakem $ (F4)', 'rozliším $A$1, A$1 a $A1'],
  text: `
<h3>Relativní odkaz se posouvá</h3>
<p>Vzorec si ve skutečnosti nepamatuje „B4“, ale <b>„buňka o jeden sloupec vlevo“</b>. Když ho zkopírujete o řádek níž,
posune se i odkaz: z <code>=B4*2</code> v C4 se v C5 stane <code>=B5*2</code>. Díky tomu napíšete vzorec jednou a „stáhnete“ ho dolů pro celý sloupec.</p>
<p><b>Vyzkoušejte:</b> vyberte buňku, chyťte myší <b>čtvereček v jejím pravém dolním rohu</b> (úchyt) a táhněte dolů.
Nebo buňku zkopírujte <kbd>Ctrl+C</kbd> a vložte jinam <kbd>Ctrl+V</kbd>.</p>

<h3>Absolutní odkaz $ stojí na místě</h3>
<p>Kurz eura je jen jeden, v [[@B1]]. Když napíšete do C4 <code>=B4*B1</code> a zkopírujete dolů, v C5 bude <code>=B5*B2</code> –
a B2 je prázdná! Kurz se musí <b>ukotvit</b>: [[=B4*$B$1]]. Znak <code>$</code> znamená „tuhle část adresy neposouvej“.</p>
<table class="tab">
<tr><th>Zápis</th><th>Při kopírování</th><th>Název</th></tr>
<tr><td><code>B1</code></td><td>posouvá se sloupec i řádek</td><td>relativní</td></tr>
<tr><td><code>$B$1</code></td><td>nehýbe se vůbec</td><td>absolutní</td></tr>
<tr><td><code>B$1</code></td><td>sloupec se posouvá, řádek ne</td><td>smíšený</td></tr>
<tr><td><code>$B1</code></td><td>řádek se posouvá, sloupec ne</td><td>smíšený</td></tr>
</table>
<div class="tip"><b>F4:</b> když je kurzor v řádku vzorců na adrese, klávesa <kbd>F4</kbd> přepíná B1 → $B$1 → B$1 → $B1 → B1. Funguje i tady.</div>

<h3>Smíšený odkaz: násobilka jedním vzorcem</h3>
<p>V oblasti F3:K8 je rozpracovaná násobilka. Čísla řádků jsou ve sloupci F, čísla sloupců v řádku 3.
Jeden vzorec v G4 musí jít zkopírovat do celé tabulky: z <b>čísla řádku</b> si má držet sloupec F (<code>$F4</code>),
z <b>čísla sloupce</b> řádek 3 (<code>G$3</code>).</p>`,
  list: { sloupcu: 11, radku: 8, bunky: {
    A1: 'Kurz EUR', B1: '25.2',
    A3: 'Položka', B3: 'Cena €', C3: 'Cena Kč',
    A4: 'Batoh', B4: '45', A5: 'Stan', B5: '189', A6: 'Spacák', B6: '79', A7: 'Karimatka', B7: '22',
    F3: '×', G3: '1', H3: '2', I3: '3', J3: '4', K3: '5',
    F4: '1', F5: '2', F6: '3', F7: '4', F8: '5',
  } },
  predpovez: [
    { vzorec: '=B4*2', z: 'C4', na: 'C6' },
    { vzorec: '=B4*$B$1', z: 'C4', na: 'C7' },
    { vzorec: '=A1+B$1', z: 'C2', na: 'D5' },
    { vzorec: '=$A1*2', z: 'B1', na: 'D3' },
  ],
  ulohy: [
    { id: 'o1', cil: 'C4', kopirovat: 'C4:C7', absolutni: true, reseni: '=B4*$B$1',
      zadani: 'Do [[@C4]] napište převod ceny na koruny tak, aby šel vzorec zkopírovat až do C7. Pak ho úchytem stáhněte dolů.',
      napovedy: ['Cena v Kč = cena v € × kurz.', 'Kurz je jen v B1 – ten se při kopírování nesmí posunout.', 'Ukotvení: $B$1 (napište B1 a stiskněte F4).'] },
    { id: 'o2', cil: 'G4', kopirovat: 'G4:K8', absolutni: true, reseni: '=$F4*G$3',
      zadani: 'Do [[@G4]] napište jeden vzorec násobilky, který půjde zkopírovat do celé oblasti G4:K8.',
      napovedy: ['Výsledek = číslo řádku (sloupec F) × číslo sloupce (řádek 3).', 'Odkaz na F4 si má při kopírování doprava držet sloupec F → $F4.', 'Odkaz na G3 si má při kopírování dolů držet řádek 3 → G$3.'] },
  ],
},
{
  id: 'funkce', emoji: '∑', nazev: 'Funkce SUMA, PRŮMĚR, MIN, MAX',
  cile: ['rozumím stavbě funkce: název, závorky, argumenty', 'používám oblasti A1:A5', 'vím, proč POČET a POČET2 vracejí různá čísla'],
  text: `
<h3>Stavba funkce</h3>
<p>Funkce je hotový „stroj“ na výpočet. Má <b>název</b>, za ním <b>závorky</b> a v nich <b>argumenty</b> oddělené
<code>{;}</code>. Třeba [[=SUM(B2:B8)]]:</p>
<ul>
<li><b>{SUM}</b> – název funkce (v českém Excelu česky, v anglickém anglicky – přepínač nahoře),</li>
<li><b>B2:B8</b> – <i>oblast</i>: všechny buňky od B2 do B8 (dvojtečka = „až“),</li>
<li>argumentů může být víc: [[=SUM(B2:B4,B6,100)]].</li>
</ul>
<div class="tip">Když píšete název funkce, pod řádkem vzorců se nabídnou funkce. Po otevření závorky se ukáže, jaké argumenty funkce chce
a ve kterém právě jste.</div>

<h3>Nejpoužívanější funkce</h3>
<table class="tab">
<tr><th>Funkce</th><th>Co dělá</th><th>Ukázka</th></tr>
<tr><td>{SUM}</td><td>součet</td><td>[[=SUM(B2:B8)]]</td></tr>
<tr><td>{AVERAGE}</td><td>průměr (součet ÷ počet čísel)</td><td>[[=AVERAGE(B2:B8)]]</td></tr>
<tr><td>{MAX}, {MIN}</td><td>největší, nejmenší</td><td>[[=MAX(B2:B8)]]</td></tr>
<tr><td>{COUNT}</td><td>kolik buněk obsahuje <b>číslo</b></td><td>[[=COUNT(B2:B8)]]</td></tr>
<tr><td>{COUNTA}</td><td>kolik buněk není prázdných</td><td>[[=COUNTA(B2:B8)]]</td></tr>
</table>
<p>V neděli bylo zavřeno – v [[@B8]] je text „zavřeno“. {SUM} a {AVERAGE} text <b>v oblasti tiše přeskočí</b>,
proto je průměr ze 6 dnů, ne ze 7. {COUNT} počítá jen čísla (6), {COUNTA} všechno neprázdné (7). Porovnejte rozklad obou.</p>
<div class="pozor">Prázdná buňka a nula nejsou totéž: {AVERAGE} prázdnou buňku vynechá, nulu započítá.
Smažte B8 a pak do ní napište 0 – sledujte, jak se průměr změní.</div>`,
  list: { sloupcu: 5, radku: 8, bunky: {
    A1: 'Den', B1: 'Tržba', D1: 'Ukazatel', E1: 'Hodnota',
    A2: 'pondělí', B2: '12400', A3: 'úterý', B3: '9800', A4: 'středa', B4: '15100', A5: 'čtvrtek', B5: '11300',
    A6: 'pátek', B6: '18900', A7: 'sobota', B7: '22600', A8: 'neděle', B8: 'zavřeno',
    D2: 'Tržba za týden', D3: 'Průměr na den', D4: 'Nejlepší den', D5: 'Nejhorší den', D6: 'Otevřeno dní',
  } },
  predpovez: [{ vzorec: '=SUM(1,2,3)' }, { vzorec: '=AVERAGE(2,4,9)' }, { vzorec: '=COUNT(B2:B8)' }, { vzorec: '=COUNTA(A1:B1)' }, { vzorec: '=MAX(B2:B8)-MIN(B2:B8)' }],
  ulohy: [
    { id: 'f1', cil: 'E2', reseni: '=SUM(B2:B8)', vyzaduje: ['SUM'], zadani: 'Do [[@E2]] sečtěte tržby za celý týden.',
      napovedy: ['Funkce součtu je {SUM}.', 'Napište ={SUM}( a myší označte tažením B2 až B8.'] },
    { id: 'f2', cil: 'E3', reseni: '=AVERAGE(B2:B8)', vyzaduje: ['AVERAGE'], zadani: 'Do [[@E3]] spočítejte průměrnou tržbu za otevřený den.',
      napovedy: ['{AVERAGE} text „zavřeno“ přeskočí sama.'] },
    { id: 'f3', cil: 'E4', reseni: '=MAX(B2:B8)', vyzaduje: ['MAX'], zadani: 'Do [[@E4]] najděte nejvyšší denní tržbu.', napovedy: ['{MAX}(oblast)'] },
    { id: 'f4', cil: 'E5', reseni: '=MIN(B2:B8)', vyzaduje: ['MIN'], zadani: 'Do [[@E5]] najděte nejnižší denní tržbu.', napovedy: ['{MIN}(oblast)'] },
    { id: 'f5', cil: 'E6', reseni: '=COUNT(B2:B8)', zadani: 'Do [[@E6]] spočítejte, kolik dní bylo otevřeno (kolik dní má číselnou tržbu).',
      napovedy: ['Potřebujete funkci, která počítá jen čísla.', '{COUNT}, ne {COUNTA}.'] },
  ],
},
{
  id: 'zaokrouhleni', emoji: '🎯', nazev: 'Zaokrouhlování a zbytek',
  cile: ['rozliším formát buňky od skutečného zaokrouhlení', 'vyberu ROUND / ROUNDUP / ROUNDDOWN', 'používám MOD na zbytek po dělení'],
  text: `
<h3>Formát není zaokrouhlení</h3>
<p>Když v Excelu nastavíte „2 desetinná místa“, číslo jen <b>vypadá</b> zaokrouhleně. Uvnitř zůstává celé a dál se s ním počítá.
Proto součet „zaokrouhlených“ položek někdy nesedí o haléř. Skutečně zaokrouhlí jen funkce.</p>
<table class="tab">
<tr><th>Funkce</th><th>Co dělá</th><th>kladné</th><th>záporné</th></tr>
<tr><td>{ROUND}(číslo{;} místa)</td><td>matematicky (5 nahoru)</td><td>[[=ROUND(2.5,0)]]</td><td>[[=ROUND(-2.5,0)]]</td></tr>
<tr><td>{ROUNDUP}</td><td>vždy od nuly</td><td>[[=ROUNDUP(2.1,0)]]</td><td>[[=ROUNDUP(-2.1,0)]]</td></tr>
<tr><td>{ROUNDDOWN}</td><td>vždy k nule (useknutí)</td><td>[[=ROUNDDOWN(2.9,0)]]</td><td>[[=ROUNDDOWN(-2.9,0)]]</td></tr>
<tr><td>{INT}</td><td>dolů na celé číslo</td><td>[[=INT(2.9)]]</td><td>[[=INT(-2.1)]]</td></tr>
</table>
<p>Druhý argument je počet desetinných míst. Může být i <b>záporný</b>: [[=ROUND(1234.5,-2)]] zaokrouhlí na stovky.</p>

<h3>Zbytek po dělení</h3>
<p>[[=MOD(107,12)]] je 11: 107 kusů do krabic po 12 → 8 plných krabic a 11 kusů zbude.
Kolik krabic potřebuji? <b>Vždy nahoru</b>: [[=ROUNDUP(107/12,0)]] = 9. Polovinu krabice koupit nejde.</p>
<div class="tip">{MOD} pozná sudá/lichá čísla: [[=MOD(A2,2)=0]] je PRAVDA pro sudé.</div>`,
  list: { sloupcu: 4, radku: 7, bunky: {
    A1: 'Kusů', B1: 'Do krabice', C1: 'Krabic', D1: 'V poslední',
    A2: '107', B2: '12',
    A5: 'Cena bez DPH', B5: '99.99', A6: 'Sazba DPH', B6: '21%', A7: 'Cena s DPH',
  } },
  predpovez: [{ vzorec: '=ROUND(2.345,2)' }, { vzorec: '=ROUND(-2.5,0)' }, { vzorec: '=INT(-2.5)' }, { vzorec: '=ROUNDDOWN(-2.5,0)' }, { vzorec: '=MOD(17,5)' }, { vzorec: '=ROUND(1234.567,-2)' }],
  ulohy: [
    { id: 'r1', cil: 'C2', reseni: '=ROUNDUP(A2/B2,0)', vyzaduje: ['ROUNDUP'], zadani: 'Do [[@C2]] spočítejte, kolik krabic je potřeba (i načatá krabice se počítá).',
      napovedy: ['Vydělte kusy kapacitou krabice a zaokrouhlete vždy nahoru.', '={ROUNDUP}(A2/B2{;}0)'] },
    { id: 'r2', cil: 'D2', reseni: '=MOD(A2,B2)', vyzaduje: ['MOD'], zadani: 'Do [[@D2]] spočítejte, kolik kusů bude v poslední, neplné krabici.',
      napovedy: ['Je to zbytek po dělení.', '{MOD}(dělenec{;} dělitel)'] },
    { id: 'r3', cil: 'B7', reseni: '=ROUND(B5*(1+B6),2)', vyzaduje: ['ROUND'], zadani: 'Do [[@B7]] spočítejte cenu s DPH zaokrouhlenou na haléře (2 desetinná místa).',
      napovedy: ['Nejdřív cena s DPH: B5*(1+B6).', 'Celý výpočet vložte jako první argument do {ROUND}, druhý argument je 2.'] },
  ],
},
{
  id: 'kdyz', emoji: '🔀', nazev: 'Podmínka KDYŽ',
  cile: ['vím, že porovnání vrací PRAVDA / NEPRAVDA', 'sestavím KDYŽ se třemi argumenty', 'nedávám hranici natvrdo do vzorce'],
  text: `
<h3>Porovnání = otázka s odpovědí ano/ne</h3>
<p>[[=B2>=50]] se ptá „je v B2 aspoň 50?“ a odpoví logickou hodnotou <b>PRAVDA</b> nebo <b>NEPRAVDA</b>
(v anglickém Excelu TRUE/FALSE). Texty se porovnávají bez ohledu na velikost písmen: [[="a"="A"]].</p>

<h3>{IF}: rozcestí</h3>
<p><code>{IF}(podmínka{;} hodnota_když_ano{;} hodnota_když_ne)</code></p>
<p>Excel nejdřív vyhodnotí podmínku. Podle výsledku spočítá <b>jen jednu</b> ze dvou dalších větví – druhá se vůbec nepočítá.
Projděte si krok za krokem [[=IF(B2>=$F$1,"prospěl","neprospěl")]] a [[=IF(2>1,"x",1/0)]] – dělení nulou nevadí, protože se na něj nedojde.</p>
<ul>
<li>Text ve vzorci musí být v <b>uvozovkách</b>: <code>"prospěl"</code>. Bez nich hledá Excel funkci jménem prospěl → chyba #NÁZEV?.</li>
<li>Prázdný text se píše <code>""</code>: [[=IF(B2>90,"⭐","")]].</li>
<li>Větev může obsahovat výpočet: [[=IF(B2>90,B2*10,0)]].</li>
</ul>
<div class="pozor">Hranici 50 nepište do vzorce. Dejte ji do buňky ([[@F1]]) a odkazujte se na ni s $. Když se hranice změní, přepíšete jedno číslo, ne sto vzorců.</div>`,
  list: { sloupcu: 6, radku: 7, bunky: {
    A1: 'Žák', B1: 'Body', C1: 'Výsledek', D1: 'Odměna', E1: 'Hranice:', F1: '50',
    A2: 'Adam', B2: '72', A3: 'Bára', B3: '45', A4: 'Cyril', B4: '50', A5: 'Dana', B5: '93', A6: 'Emil', B6: '38', A7: 'Fanny', B7: '61',
  } },
  predpovez: [{ vzorec: '=5>3' }, { vzorec: '="a"="A"' }, { vzorec: '=IF(1>2,"x","y")' }, { vzorec: '=IF(0,"x","y")' }, { vzorec: '=IF(B4>=F1,"ano","ne")' }],
  ulohy: [
    { id: 'k1', cil: 'C2', kopirovat: 'C2:C7', absolutni: true, reseni: '=IF(B2>=$F$1,"prospěl","neprospěl")', vyzaduje: ['IF'],
      zadani: 'Do [[@C2]] napište vzorec, který vypíše „prospěl“, když má žák aspoň tolik bodů jako hranice v F1, jinak „neprospěl“. Zkopírujte až do C7.',
      napovedy: ['Podmínka: B2>=F1.', 'Hranice F1 se nesmí při kopírování posunout → $F$1.', '={IF}(B2>=$F$1{;}"prospěl"{;}"neprospěl")'] },
    { id: 'k2', cil: 'D2', kopirovat: 'D2:D7', reseni: '=IF(B2>90,B2*10,0)', vyzaduje: ['IF'], varianty: [{ B5: '90' }],
      zadani: 'Do [[@D2]]: kdo má víc než 90 bodů, dostane odměnu 10 Kč za každý bod, ostatní 0. Zkopírujte do D7.',
      napovedy: ['Větev „ano“ je výpočet B2*10.', 'Víc než 90 = >90 (ne >=).'] },
  ],
},
{
  id: 'logika', emoji: '🧩', nazev: 'Vnořené KDYŽ, A, NEBO, IFS',
  cile: ['vnořím KDYŽ do KDYŽ', 'spojím podmínky funkcemi A a NEBO', 'znám IFS jako přehlednější náhradu'],
  text: `
<h3>Víc než dvě možnosti: vnořené {IF}</h3>
<p>Do větve „ne“ lze vložit další {IF}. Známka podle bodů:</p>
<p>[[=IF(B2>=90,1,IF(B2>=75,2,IF(B2>=60,3,IF(B2>=45,4,5))))]]</p>
<p>Čte se jako schody: „aspoň 90? → 1. Jinak aspoň 75? → 2. Jinak…“. <b>Pořadí je důležité</b> – začněte nejvyšší hranicí.
Kdybyste začali <code>B2>=45</code>, dostal by čtyřku i žák s 95 body. V dílně si přepněte na záložku <b>Strom</b> a uvidíte vnoření.</p>
<p>Novější Excel má {IFS}, kde se podmínky a hodnoty píšou za sebou, bez vnořování:
[[=IFS(B2>=90,1,B2>=75,2,B2>=60,3,B2>=45,4,TRUE,5)]]. Poslední „podmínka“ PRAVDA platí vždy – je to „jinak“.</p>

<h3>{AND} a {OR}</h3>
<table class="tab">
<tr><th>Funkce</th><th>PRAVDA, když…</th><th>Ukázka</th></tr>
<tr><td>{AND}(p1{;} p2{;} …)</td><td>platí <b>všechny</b> podmínky</td><td>[[=AND(B2>=50,C2="ano")]]</td></tr>
<tr><td>{OR}(p1{;} p2{;} …)</td><td>platí <b>aspoň jedna</b></td><td>[[=OR(B2>=90,C2="ano")]]</td></tr>
<tr><td>{NOT}(p)</td><td>obrátí výsledek</td><td>[[=NOT(B2>=50)]]</td></tr>
</table>
<p>Samy vracejí jen PRAVDA/NEPRAVDA, proto se obvykle vkládají do {IF} jako podmínka.</p>
<div class="pozor">Zápis <code>50&lt;=B2&lt;=100</code> jako v matematice nefunguje! Excel porovná 50&lt;=B2 (PRAVDA) a pak PRAVDA&lt;=100.
Správně: [[=AND(B2>=50,B2<=100)]].</div>`,
  list: { sloupcu: 5, radku: 7, bunky: {
    A1: 'Jméno', B1: 'Body', C1: 'Úkol', D1: 'Známka', E1: 'Postup',
    A2: 'Adam', B2: '92', C2: 'ano', A3: 'Bára', B3: '58', C3: 'ne', A4: 'Cyril', B4: '75', C4: 'ano',
    A5: 'Dana', B5: '44', C5: 'ano', A6: 'Emil', B6: '61', C6: 'ano', A7: 'Fanny', B7: '89', C7: 'ne',
  } },
  predpovez: [{ vzorec: '=AND(TRUE,FALSE)' }, { vzorec: '=OR(1>2,3>2)' }, { vzorec: '=NOT(5>3)' }, { vzorec: '=IF(AND(B2>50,C2="ano"),"✓","✗")' }],
  ulohy: [
    { id: 'l1', cil: 'D2', kopirovat: 'D2:D7', reseni: '=IF(B2>=90,1,IF(B2>=75,2,IF(B2>=60,3,IF(B2>=45,4,5))))',
      zadani: 'Do [[@D2]] napište známku: 90 a víc → 1, 75 → 2, 60 → 3, 45 → 4, méně → 5. Zkopírujte do D7. Můžete použít vnořené {IF} nebo {IFS}.',
      napovedy: ['Začněte nejvyšší hranicí: {IF}(B2>=90{;}1{;} …).', 'Na místo „…“ dejte další {IF} pro 75, a tak dál.', 'Spočítejte závorky: čtyři {IF} = čtyři závorky na konci.'] },
    { id: 'l2', cil: 'E2', kopirovat: 'E2:E7', reseni: '=IF(AND(B2>=50,C2="ano"),"postupuje","nepostupuje")', vyzaduje: ['AND'],
      zadani: 'Do [[@E2]]: žák postupuje, jen když má <b>aspoň 50 bodů a zároveň</b> odevzdal úkol („ano“). Vypište „postupuje“ / „nepostupuje“, zkopírujte do E7.',
      napovedy: ['Obě podmínky současně → {AND}.', '={IF}({AND}(B2>=50{;}C2="ano"){;}"postupuje"{;}"nepostupuje")'] },
  ],
},
{
  id: 'podminene', emoji: '🔢', nazev: 'COUNTIF a SUMIF',
  cile: ['počítám a sčítám jen řádky, které splňují podmínku', 'píšu kritéria ">5000", "Nov*", "<>Brno"', 'skládám kritérium z buňky přes &'],
  text: `
<h3>Počítej / sečti jen něco</h3>
<p><code>{COUNTIF}(oblast{;} kritérium)</code> spočítá buňky, které splňují kritérium.<br>
<code>{SUMIF}(oblast{;} kritérium{;} součet)</code> projde <i>oblast</i> a tam, kde kritérium platí, přičte číslo ze stejného řádku oblasti <i>součet</i>.</p>
<p>[[=SUMIF(B2:B9,"Praha",C2:C9)]] = „součet částek ve sloupci C u řádků, kde je ve sloupci B Praha“.</p>
<h3>Jak psát kritérium</h3>
<table class="tab">
<tr><th>Kritérium</th><th>Význam</th><th>Ukázka</th></tr>
<tr><td><code>"Praha"</code></td><td>rovná se (bez ohledu na velikost písmen)</td><td>[[=COUNTIF(B2:B9,"praha")]]</td></tr>
<tr><td><code>"&gt;5000"</code></td><td>porovnání – <b>operátor patří do uvozovek</b></td><td>[[=COUNTIF(C2:C9,">5000")]]</td></tr>
<tr><td><code>"&lt;&gt;Brno"</code></td><td>různé od</td><td>[[=COUNTIF(B2:B9,"<>Brno")]]</td></tr>
<tr><td><code>"Nov*"</code></td><td>* = libovolné znaky, ? = jeden znak</td><td>[[=COUNTIF(A2:A9,"Nov*")]]</td></tr>
<tr><td><code>"&gt;"&amp;F6</code></td><td>hranice z buňky – spojí se přes &amp;</td><td>[[=COUNTIF(C2:C9,">"&F6)]]</td></tr>
</table>
<div class="pozor"><code>"&gt;F6"</code> nefunguje – Excel by porovnával s textem „F6“. Operátor je text, adresa ne: <code>"&gt;"&amp;F6</code>.</div>
<h3>Víc podmínek najednou</h3>
<p>{COUNTIFS} a {SUMIFS} berou dvojice <i>oblast{;} kritérium</i>. U {SUMIFS} je oblast součtu <b>první</b>:
[[=SUMIFS(C2:C9,A2:A9,"Novák",B2:B9,"Brno")]].</p>`,
  list: { sloupcu: 6, radku: 9, bunky: {
    A1: 'Prodejce', B1: 'Město', C1: 'Částka',
    A2: 'Novák', B2: 'Praha', C2: '5200', A3: 'Svoboda', B3: 'Brno', C3: '3100', A4: 'Novák', B4: 'Brno', C4: '7400',
    A5: 'Dvořák', B5: 'Praha', C5: '2900', A6: 'Svoboda', B6: 'Praha', C6: '6100', A7: 'Novotná', B7: 'Ostrava', C7: '4500',
    A8: 'Novák', B8: 'Brno', C8: '1800', A9: 'Dvořák', B9: 'Ostrava', C9: '8300',
    E1: 'Ukazatel', F1: 'Výsledek', E2: 'Obchodů v Praze', E3: 'Tržba v Praze', E4: 'Obchodů nad 5000', E5: 'Novák v Brně',
    E6: 'Hranice', F6: '4000', E7: 'Obchodů nad hranicí',
  } },
  predpovez: [{ vzorec: '=COUNTIF(B2:B9,"Brno")' }, { vzorec: '=COUNTIF(A2:A9,"Nov*")' }, { vzorec: '=SUMIF(A2:A9,"Dvořák",C2:C9)' }],
  ulohy: [
    { id: 'p1', cil: 'F2', reseni: '=COUNTIF(B2:B9,"Praha")', vyzaduje: ['COUNTIF'], zadani: 'Do [[@F2]] spočítejte obchody v Praze.', napovedy: ['{COUNTIF}(B2:B9{;}"Praha")'] },
    { id: 'p2', cil: 'F3', reseni: '=SUMIF(B2:B9,"Praha",C2:C9)', vyzaduje: ['SUMIF'], zadani: 'Do [[@F3]] sečtěte částky obchodů v Praze.',
      napovedy: ['Oblast s podmínkou je sloupec B, sčítá se sloupec C.', '{SUMIF}(B2:B9{;}"Praha"{;}C2:C9)'] },
    { id: 'p3', cil: 'F4', reseni: '=COUNTIF(C2:C9,">5000")', vyzaduje: ['COUNTIF'], chranit: ['C2'], zadani: 'Do [[@F4]] spočítejte obchody s částkou nad 5000.',
      napovedy: ['Kritérium porovnání: ">5000" i s uvozovkami.'] },
    { id: 'p4', cil: 'F5', reseni: '=SUMIFS(C2:C9,A2:A9,"Novák",B2:B9,"Brno")', vyzaduje: ['SUMIFS'], zadani: 'Do [[@F5]] sečtěte, kolik prodal <b>Novák v Brně</b>.',
      napovedy: ['Dvě podmínky → {SUMIFS}.', 'Oblast součtu je u {SUMIFS} první: {SUMIFS}(C2:C9{;}A2:A9{;}"Novák"{;}B2:B9{;}"Brno").'] },
    { id: 'p5', cil: 'F7', reseni: '=COUNTIF(C2:C9,">"&F6)', vyzaduje: ['COUNTIF'], varianty: [{ F6: '2000' }, { F6: '7000' }],
      zadani: 'Do [[@F7]] spočítejte obchody nad hranicí z [[@F6]]. Změňte hranici a ověřte, že se výsledek mění.',
      napovedy: ['Kritérium musí být text „>4000“ – složte ho z ">" a F6.', '">"&F6'] },
  ],
},
{
  id: 'svyhledat', emoji: '🔎', nazev: 'SVYHLEDAT',
  cile: ['vyhledám hodnotu v tabulce podle klíče', 'vím, kdy použít přesnou a kdy přibližnou shodu', 'umím číst chybu #NENÍ_K_DISPOZICI'],
  text: `
<h3>Najdi řádek, vrať sloupec</h3>
<p><code>{VLOOKUP}(hledat{;} tabulka{;} sloupec{;} přibližně)</code></p>
<ol>
<li><b>hledat</b> – co hledám (kód zboží),</li>
<li><b>tabulka</b> – kde; hledá se vždy v jejím <b>prvním sloupci</b>,</li>
<li><b>sloupec</b> – kolikátý sloupec <i>tabulky</i> vrátit (počítá se od 1 v rámci tabulky, ne od A),</li>
<li><b>přibližně</b> – NEPRAVDA = přesná shoda, PRAVDA nebo vynecháno = přibližná.</li>
</ol>
<p>[[=VLOOKUP(F1,A2:C6,3,FALSE)]]: najde kód z F1 v A2:A6 a vrátí 3. sloupec téhož řádku (cenu). Zkuste do F1 napsat neexistující kód.</p>
<div class="pozor"><b>Nejčastější chyba:</b> zapomenutý 4. argument. Bez něj Excel hledá <i>přibližně</i> a u neseřazených dat vrátí
nesmysl, bez varování. Pro kódy, jména a čísla faktur pište vždy NEPRAVDA (nebo 0).</div>
<h3>Přibližná shoda: pásma</h3>
<p>Slevová tabulka H2:I5 říká: od 0 Kč sleva 0 %, od 1000 Kč 5 %… Přesnou částku 7200 v tabulce nenajdete,
ale přibližná shoda vrátí řádek s <b>největší hodnotou menší nebo rovnou</b> → 5000 → 10 %. Data musí být seřazená vzestupně.
[[=VLOOKUP(F5,H2:I5,2,TRUE)]]</p>
<div class="tip">{VLOOKUP} umí hledat jen v prvním sloupci a vracet doprava. Doleva neumí – to řeší další lekce.</div>`,
  list: { sloupcu: 9, radku: 6, bunky: {
    A1: 'Kód', B1: 'Zboží', C1: 'Cena',
    A2: 'P01', B2: 'Pero', C2: '25', A3: 'S02', B3: 'Sešit', C3: '39', A4: 'G03', B4: 'Guma', C4: '12', A5: 'L04', B5: 'Lepidlo', C5: '58', A6: 'P05', B6: 'Pravítko', C6: '33',
    E1: 'Kód:', F1: 'L04', E2: 'Cena:', E3: 'Zboží:',
    E5: 'Nákup:', F5: '7200', E6: 'Sleva:',
    H1: 'Od částky', I1: 'Sleva', H2: '0', I2: { v: '0', f: '%' }, H3: '1000', I3: { v: '0.05', f: '%' }, H4: '5000', I4: { v: '0.1', f: '%' }, H5: '10000', I5: { v: '0.15', f: '%' },
  } },
  predpovez: [{ vzorec: '=VLOOKUP("G03",A2:C6,2,FALSE)' }, { vzorec: '=VLOOKUP("X99",A2:C6,3,FALSE)' }, { vzorec: '=VLOOKUP("P01",A2:C6,4,FALSE)' }, { vzorec: '=VLOOKUP(999,H2:I5,2)' }],
  ulohy: [
    { id: 's1', cil: 'F2', reseni: '=VLOOKUP(F1,A2:C6,3,FALSE)', vyzaduje: ['VLOOKUP'], varianty: [{ F1: 'S02' }, { F1: 'P05' }],
      zadani: 'Do [[@F2]] vyhledejte cenu zboží, jehož kód je v F1.',
      napovedy: ['Hledat F1, tabulka A2:C6, cena je 3. sloupec tabulky.', 'Kódy chtějí přesnou shodu: 4. argument NEPRAVDA.'] },
    { id: 's2', cil: 'F3', reseni: '=VLOOKUP(F1,A2:C6,2,FALSE)', vyzaduje: ['VLOOKUP'], varianty: [{ F1: 'G03' }, { F1: 'S02' }],
      zadani: 'Do [[@F3]] vyhledejte název zboží podle kódu v F1.', napovedy: ['Název je 2. sloupec tabulky.'] },
    { id: 's3', cil: 'F6', reseni: '=VLOOKUP(F5,H2:I5,2,TRUE)', vyzaduje: ['VLOOKUP'], varianty: [{ F5: '999' }, { F5: '10000' }, { F5: '25000' }],
      zadani: 'Do [[@F6]] najděte slevu pro nákup v F5 podle pásem v H2:I5.',
      napovedy: ['Tady chcete přibližnou shodu – 4. argument PRAVDA (nebo ho vynechte).'] },
  ],
},
{
  id: 'index', emoji: '🧭', nazev: 'INDEX + POZVYHLEDAT a XLOOKUP',
  cile: ['najdu pozici hodnoty funkcí POZVYHLEDAT', 'vytáhnu hodnotu podle pozice funkcí INDEX', 'umím hledat „doleva“ a používat XLOOKUP'],
  text: `
<h3>Dvě jednoduché funkce místo jedné složité</h3>
<p><b>{MATCH}</b>(hledat{;} oblast{;} 0) odpoví „na kolikátém místě to je“: [[=MATCH("Praha",B2:B7,0)]].<br>
<b>{INDEX}</b>(oblast{;} pozice) odpoví „co je na tom místě“: [[=INDEX(A2:A7,3)]].</p>
<p>Složené dohromady hledají v libovolném sloupci a vracejí z libovolného jiného – i <b>doleva</b>, což {VLOOKUP} neumí:</p>
<p>[[=INDEX(A2:A7,MATCH(F1,B2:B7,0))]] – „najdi město z F1 ve sloupci B a vrať zemi ze stejného řádku sloupce A“.</p>
<p>Projděte kroky: nejdřív se spočítá vnitřní {MATCH} (číslo pozice), pak ho použije {INDEX}.</p>
<div class="tip">Třetí argument {MATCH} 0 = přesná shoda. Stejná past jako u {VLOOKUP}: bez něj hledá přibližně.</div>
<h3>{XLOOKUP} (Excel 2021 a 365)</h3>
<p><code>{XLOOKUP}(hledat{;} kde_hledat{;} co_vrátit{;} [když_nenajde])</code> – přesná shoda je výchozí a umí i náhradní text:
[[=XLOOKUP(F1,B2:B7,C2:C7,"neznámé")]]. Ve starších Excelech (2016, 2019) ale chybí – tam zůstává {INDEX}+{MATCH}.</p>`,
  list: { sloupcu: 6, radku: 7, bunky: {
    A1: 'Země', B1: 'Hlavní město', C1: 'Obyvatel (mil.)',
    A2: 'Česko', B2: 'Praha', C2: '10.9', A3: 'Slovensko', B3: 'Bratislava', C3: '5.4', A4: 'Polsko', B4: 'Varšava', C4: '36.6',
    A5: 'Rakousko', B5: 'Vídeň', C5: '9.2', A6: 'Německo', B6: 'Berlín', C6: '83.5', A7: 'Maďarsko', B7: 'Budapešť', C7: '9.6',
    E1: 'Město:', F1: 'Vídeň', E2: 'Země:', E3: 'Obyvatel:', E4: 'Pořadí:',
  } },
  predpovez: [{ vzorec: '=MATCH("Berlín",B2:B7,0)' }, { vzorec: '=INDEX(B2:B7,2)' }, { vzorec: '=INDEX(A2:C7,4,3)' }, { vzorec: '=XLOOKUP("Řím",B2:B7,A2:A7,"?")' }],
  ulohy: [
    { id: 'i1', cil: 'F4', reseni: '=MATCH(F1,B2:B7,0)', vyzaduje: ['MATCH'], varianty: [{ F1: 'Berlín' }],
      zadani: 'Do [[@F4]] zjistěte, na kolikátém místě seznamu měst (B2:B7) je město z F1.', napovedy: ['{MATCH}(F1{;}B2:B7{;}0)'] },
    { id: 'i2', cil: 'F2', reseni: '=INDEX(A2:A7,MATCH(F1,B2:B7,0))', vyzaduje: ['INDEX'], varianty: [{ F1: 'Praha' }, { F1: 'Budapešť' }],
      zadani: 'Do [[@F2]] najděte zemi, jejíž hlavní město je v F1. Země je <b>vlevo</b> od města, takže {VLOOKUP} nepomůže.',
      napovedy: ['Pozici města už umíte spočítat ({MATCH}).', 'Tu pozici dejte jako 2. argument {INDEX} nad oblastí zemí A2:A7.'] },
    { id: 'i3', cil: 'F3', reseni: '=XLOOKUP(F1,B2:B7,C2:C7)', varianty: [{ F1: 'Varšava' }],
      zadani: 'Do [[@F3]] najděte počet obyvatel země s hlavním městem z F1 – funkcí {XLOOKUP} nebo {INDEX}+{MATCH}.',
      napovedy: ['{XLOOKUP}(F1{;}B2:B7{;}C2:C7)'] },
  ],
},
{
  id: 'text', emoji: '🔤', nazev: 'Práce s textem',
  cile: ['spojuji texty přes & a CONCAT', 'vyřezávám části textu ZLEVA, ZPRAVA, ČÁST', 'najdu pozici znaku funkcí NAJÍT a použiji ji v jiné funkci'],
  text: `
<h3>Spojování</h3>
<p>[[=B2&" "&C2]] spojí jméno, mezeru a příjmení. Mezera je taky text, proto v uvozovkách. Totéž umí [[=CONCAT(B2," ",C2)]].
Číslo se při spojení převede na text: [[="Body: "&10*5]].</p>
<h3>Vyřezávání</h3>
<table class="tab">
<tr><th>Funkce</th><th>Výsledek pro „Jan Novák“</th></tr>
<tr><td>{LEFT}(text{;} n) – n znaků zleva</td><td>[[=LEFT("Jan Novák",3)]]</td></tr>
<tr><td>{RIGHT}(text{;} n) – n znaků zprava</td><td>[[=RIGHT("Jan Novák",5)]]</td></tr>
<tr><td>{MID}(text{;} start{;} n) – od pozice start</td><td>[[=MID("Jan Novák",5,3)]]</td></tr>
<tr><td>{LEN}(text) – počet znaků</td><td>[[=LEN("Jan Novák")]]</td></tr>
<tr><td>{FIND}(co{;} kde) – pozice</td><td>[[=FIND(" ","Jan Novák")]]</td></tr>
</table>
<p><b>Skládání funkcí:</b> jména mají různou délku, takže počet znaků nelze napsat natvrdo. Pozici mezery najde {FIND}
a výsledek se použije jako argument: [[=LEFT(A2,FIND(" ",A2)-1)]] – „vezmi zleva tolik znaků, kolik jich je před mezerou“.</p>
<h3>Úklid textu</h3>
<p>{TRIM} smaže přebytečné mezery [[=TRIM("  Jan   Novák ")]], {PROPER} dá velká počáteční písmena [[=PROPER("jAN nOVÁK")]],
{UPPER}/{LOWER} převedou na velká/malá, {SUBSTITUTE} nahradí text [[=SUBSTITUTE("1.5.2026",".","/")]].</p>`,
  list: { sloupcu: 4, radku: 5, bunky: {
    A1: 'Celé jméno', B1: 'Jméno', C1: 'Příjmení', D1: 'Login',
    A2: 'Jan Novák', A3: 'Petra Svobodová', A4: 'Ota Kos', A5: 'Marie Dvořáková',
  } },
  predpovez: [{ vzorec: '=LEFT("Excel",2)' }, { vzorec: '=LEN("a b")' }, { vzorec: '=FIND("e","Excel")' }, { vzorec: '="1"&"2"' }, { vzorec: '=UPPER(MID("tabulka",3,3))' }],
  ulohy: [
    { id: 't1', cil: 'B2', kopirovat: 'B2:B5', reseni: '=LEFT(A2,FIND(" ",A2)-1)', varianty: [{ A2: 'Bohuslav Martinů', A4: 'Al Bundy' }],
      zadani: 'Do [[@B2]] vytáhněte z celého jména křestní jméno. Vzorec musí fungovat pro jména libovolné délky; zkopírujte do B5.',
      napovedy: ['Křestní jméno je všechno před mezerou.', 'Pozice mezery: {FIND}(" "{;}A2). Znaků před ní je o jeden méně.', '={LEFT}(A2{;}{FIND}(" "{;}A2)-1)'] },
    { id: 't2', cil: 'C2', kopirovat: 'C2:C5', reseni: '=MID(A2,FIND(" ",A2)+1,100)', varianty: [{ A2: 'Bohuslav Martinů', A4: 'Al Bundy' }],
      zadani: 'Do [[@C2]] vytáhněte příjmení (vše za mezerou). Zkopírujte do C5.',
      napovedy: ['Příjmení začíná na pozici mezera + 1.', '{MID}(A2{;} pozice{;} 100) – stovka je „dost znaků“. Nebo {RIGHT}(A2{;}{LEN}(A2)-{FIND}(" "{;}A2)).'] },
    { id: 't3', cil: 'D2', kopirovat: 'D2:D5', reseni: '=LOWER(LEFT(B2,1)&C2)', varianty: false,
      zadani: 'Do [[@D2]] vytvořte login: první písmeno jména + příjmení, vše malými písmeny (Jan Novák → jnovák). Použijte sloupce B a C.',
      napovedy: ['První písmeno: {LEFT}(B2{;}1).', 'Spojte & s C2 a celé obalte {LOWER}(…).'] },
  ],
},
{
  id: 'datum', emoji: '📅', nazev: 'Datum a čas',
  cile: ['vím, že datum je v Excelu číslo dne', 'počítám rozdíl dat a přičítám dny', 'rozložím a složím datum funkcemi ROK, MĚSÍC, DEN, DATUM'],
  text: `
<h3>Datum je číslo</h3>
<p>Excel ukládá datum jako <b>pořadové číslo dne</b> od začátku roku 1900. 1. 9. 2026 je ve skutečnosti 46266 – jen je
naformátované jako datum. Proto lze s daty počítat:</p>
<ul>
<li>rozdíl dvou dat = počet dní: [[=B5-B4]],</li>
<li>datum + číslo = datum o tolik dní později: [[=B5+14]] (splatnost za 14 dní),</li>
<li>dnešní datum: [[=TODAY()]] – přepočítává se každý den.</li>
</ul>
<h3>Rozložit a složit</h3>
<table class="tab">
<tr><th>Funkce</th><th>Ukázka</th></tr>
<tr><td>{YEAR}, {MONTH}, {DAY}</td><td>[[=YEAR(B4)]] [[=MONTH(B4)]] [[=DAY(B4)]]</td></tr>
<tr><td>{DATE}(rok{;} měsíc{;} den)</td><td>[[=DATE(2026,12,24)]]</td></tr>
<tr><td>{WEEKDAY}(datum{;} 2) – pondělí = 1</td><td>[[=WEEKDAY(B5,2)]]</td></tr>
<tr><td>{TEXT}(datum{;} "dddd") – název dne</td><td>[[=TEXT(B5,"dddd")]]</td></tr>
<tr><td>{NETWORKDAYS}(od{;} do) – pracovní dny</td><td>[[=NETWORKDAYS(B4,B5)]]</td></tr>
</table>
<p>{DATE} umí přetečení: [[=DATE(2026,1,32)]] je 1. 2. 2026 a [[=DATE(YEAR(B4),MONTH(B4)+1,1)]] je první den příštího měsíce.</p>
<div class="tip">Napište do prázdné buňky číslo 46266 a do vedlejší [[=TEXT(46266,"d.m.yyyy")]] – je to totéž datum.</div>`,
  list: { sloupcu: 3, radku: 9, bunky: {
    A1: 'Zakázka', A2: 'Dnes je', B2: '=TODAY()',
    A4: 'Začátek', B4: '1. 9. 2026', A5: 'Konec', B5: '26. 11. 2026',
    A6: 'Trvá dní', A7: 'Pracovních dní', A8: 'Splatnost (+14 dní)', A9: 'Konec připadá na',
  } },
  predpovez: [{ vzorec: '=B5-B4' }, { vzorec: '=YEAR(B5)' }, { vzorec: '=MONTH(B4)+1' }, { vzorec: '=WEEKDAY(B4,2)' }],
  ulohy: [
    { id: 'd1', cil: 'B6', reseni: '=B5-B4', varianty: [{ B4: '1. 10. 2026', B5: '15. 12. 2026' }], zadani: 'Do [[@B6]] spočítejte, kolik dní zakázka trvá.',
      napovedy: ['Datum je číslo – stačí odečíst.'] },
    { id: 'd2', cil: 'B7', reseni: '=NETWORKDAYS(B4,B5)', vyzaduje: ['NETWORKDAYS'], varianty: [{ B4: '1. 10. 2026', B5: '15. 12. 2026' }],
      zadani: 'Do [[@B7]] spočítejte pracovní dny (po–pá) od začátku do konce.', napovedy: ['{NETWORKDAYS}(začátek{;} konec)'] },
    { id: 'd3', cil: 'B8', reseni: '=B5+14', varianty: [{ B5: '20. 12. 2026' }], zadani: 'Do [[@B8]] spočítejte datum splatnosti: 14 dní po konci zakázky.',
      napovedy: ['Datum + počet dní = nové datum.'] },
    { id: 'd4', cil: 'B9', reseni: '=TEXT(B5,"dddd")', vyzaduje: ['TEXT'], varianty: [{ B5: '20. 12. 2026' }],
      zadani: 'Do [[@B9]] vypište slovem, na jaký den v týdnu konec připadá.', napovedy: ['{TEXT}(B5{;}"dddd") – čtyři d = celý název dne.'] },
  ],
},
{
  id: 'chyby', emoji: '🐞', nazev: 'Chyby a jak je ošetřit',
  cile: ['poznám typ chyby a vím, co ji způsobilo', 'ošetřím chybu funkcí IFERROR', 'předejdu chybě podmínkou'],
  text: `
<h3>Co chyba říká</h3>
<table class="tab">
<tr><th>Chyba</th><th>Příčina</th><th>Zkuste</th></tr>
<tr><td><code>#DĚLENÍ_NULOU!</code> (#DIV/0!)</td><td>dělení nulou nebo prázdnou buňkou</td><td>[[=B1/B2]]</td></tr>
<tr><td><code>#NÁZEV?</code> (#NAME?)</td><td>překlep v názvu funkce, text bez uvozovek</td><td>[[=SUMA2(B1)]] [[=IF(B1>5,ano,ne)]]</td></tr>
<tr><td><code>#HODNOTA!</code> (#VALUE!)</td><td>počítání s textem</td><td>[[=A1+1]]</td></tr>
<tr><td><code>#NENÍ_K_DISPOZICI</code> (#N/A)</td><td>hledaná hodnota nenalezena</td><td>[[=VLOOKUP("X",D2:E4,2,FALSE)]]</td></tr>
<tr><td><code>#ODKAZ!</code> (#REF!)</td><td>odkaz mimo list nebo oblast</td><td>[[=VLOOKUP("Jan",D2:E4,5,FALSE)]]</td></tr>
<tr><td><code>#ČÍSLO!</code> (#NUM!)</td><td>matematicky nemožné</td><td>[[=SQRT(-4)]]</td></tr>
</table>
<p>Chyba se <b>šíří</b>: vzorec, který odkazuje na buňku s chybou, vrátí taky chybu. Hledejte proto první chybu v řetězu.
V rozkladu krok za krokem uvidíte přesně, která část chybu vyrobila.</p>
<p><b>Cyklický odkaz</b> vznikne, když vzorec odkazuje sám na sebe (i oklikou přes jiné buňky). Napište do [[@B4]] <code>=B4+1</code>.</p>
<h3>Ošetření</h3>
<p><code>{IFERROR}(výpočet{;} náhrada)</code> – když je výsledek chyba, vrátí náhradu: [[=IFERROR(B1/B2,0)]].</p>
<div class="pozor">{IFERROR} schová <i>každou</i> chybu – i překlep, který byste potřebovali vidět. Kde jde chybě předejít podmínkou,
je to čistší: [[=IF(B2=0,0,B1/B2)]]. U hledání stačí {IFNA}, která zachytí jen „nenalezeno“.</div>`,
  list: { sloupcu: 5, radku: 6, bunky: {
    A1: 'Tržba', B1: '15000', A2: 'Kusů', A3: 'Na kus',
    D1: 'Jméno', E1: 'Body', D2: 'Jan', E2: '17', D3: 'Eva', E3: '23', D4: 'Ota', E4: '9',
    D6: 'Hledám:', E6: 'Iva', A6: 'Body hledaného:',
  } },
  predpovez: [{ vzorec: '=B1/B2' }, { vzorec: '=IFERROR(B1/B2,"–")' }, { vzorec: '=SQRT(-4)' }, { vzorec: '=IFNA(VLOOKUP("Iva",D2:E4,2,FALSE),0)' }],
  ulohy: [
    { id: 'c1', cil: 'B3', reseni: '=IFERROR(B1/B2,0)', varianty: [{ B2: '4' }, { B2: '0' }, { B2: '12' }],
      zadani: 'Do [[@B3]] spočítejte tržbu na kus (B1 ÷ B2). Když počet kusů chybí nebo je 0, ukažte 0 místo chyby.',
      napovedy: ['Samotné B1/B2 dá při prázdném B2 chybu.', '{IFERROR}(B1/B2{;}0) nebo {IF}(B2=0{;}0{;}B1/B2)'] },
    { id: 'c2', cil: 'B6', reseni: '=IFERROR(VLOOKUP(E6,D2:E4,2,FALSE),"nenalezeno")', vyzaduje: ['VLOOKUP'], varianty: [{ E6: 'Eva' }, { E6: 'Ota' }],
      zadani: 'Do [[@B6]] vyhledejte body člověka z E6. Když v tabulce není, vypište „nenalezeno“.',
      napovedy: ['Nejdřív samotné {VLOOKUP}(E6{;}D2:E4{;}2{;}NEPRAVDA).', 'Pak ho obalte {IFERROR}(…{;}"nenalezeno") nebo {IFNA}.'] },
  ],
},
{
  id: 'projekt', emoji: '🧾', nazev: 'Závěrečný projekt: faktura',
  cile: ['spojím vše dohromady v jedné tabulce', 'navrhnu vzorce, které jdou kopírovat', 'zkontroluji výsledek rozkladem'],
  text: `
<h3>Faktura od začátku do konce</h3>
<p>Doplňte fakturu tak, aby se celá přepočítala po změně množství, ceny nebo sazby. Postupujte po řádcích
a po každém vzorci si ho projděte v rozkladu. Když zaváháte, vraťte se do lekce, ze které úloha vychází:</p>
<ul>
<li>řádek položky: množství × cena a kopírování (lekce 1–2),</li>
<li>mezisoučet: {SUM} (lekce 3),</li>
<li>sleva: podmínka s hranicí v buňce (lekce 5),</li>
<li>DPH: zaokrouhlení na haléře (lekce 4),</li>
<li>počet dražších položek: {COUNTIF} (lekce 7).</li>
</ul>
<div class="tip">Všechny konstanty (sazba, hranice slevy, procento slevy) jsou v buňkách G1:G3. Do vzorců patří jen odkazy na ně.</div>`,
  list: { sloupcu: 7, radku: 11, bunky: {
    A1: 'Položka', B1: 'Množství', C1: 'Cena/ks', D1: 'Celkem',
    A2: 'Monitor', B2: '2', C2: '4290', A3: 'Klávesnice', B3: '3', C3: '890', A4: 'Myš', B4: '3', C4: '349',
    A5: 'Kabel HDMI', B5: '4', C5: '199', A6: 'Dokovací stanice', B6: '1', C6: '3590',
    C8: 'Mezisoučet', C9: 'Sleva', C10: 'DPH', C11: 'K úhradě',
    F1: 'Sazba DPH', G1: '21%', F2: 'Sleva od', G2: '10000', F3: 'Sleva', G3: '5%', F5: 'Položek nad 1000 Kč',
  } },
  predpovez: [],
  ulohy: [
    { id: 'j1', cil: 'D2', kopirovat: 'D2:D6', reseni: '=B2*C2', zadani: 'Do [[@D2]] spočítejte cenu položky a zkopírujte do D6.', napovedy: ['Množství × cena za kus.'] },
    { id: 'j2', cil: 'D8', reseni: '=SUM(B2:B6*C2:C6)', vyzaduje: ['SUM'], zadani: 'Do [[@D8]] sečtěte všechny položky.', napovedy: ['{SUM}(D2:D6)'] },
    { id: 'j3', cil: 'D9', reseni: '=IF(SUM(B2:B6*C2:C6)>=G2,SUM(B2:B6*C2:C6)*G3,0)', vyzaduje: ['IF'], chranit: ['G2'], varianty: [{ B2: '1' }, { B2: '5' }],
      zadani: 'Do [[@D9]] spočítejte slevu: když je mezisoučet aspoň G2, je sleva G3 z mezisoučtu, jinak 0.',
      napovedy: ['{IF}(D8>=G2{;} D8*G3{;} 0)'] },
    { id: 'j4', cil: 'D10', reseni: '=ROUND((SUM(B2:B6*C2:C6)-IF(SUM(B2:B6*C2:C6)>=G2,SUM(B2:B6*C2:C6)*G3,0))*G1,2)', vyzaduje: ['ROUND'], chranit: ['G2'],
      zadani: 'Do [[@D10]] spočítejte DPH ze zlevněné částky (mezisoučet − sleva), zaokrouhlené na haléře.',
      napovedy: ['Základ daně: D8-D9.', '{ROUND}((D8-D9)*G1{;}2)'] },
    { id: 'j5', cil: 'D11', reseni: '=SUM(B2:B6*C2:C6)-IF(SUM(B2:B6*C2:C6)>=G2,SUM(B2:B6*C2:C6)*G3,0)+ROUND((SUM(B2:B6*C2:C6)-IF(SUM(B2:B6*C2:C6)>=G2,SUM(B2:B6*C2:C6)*G3,0))*G1,2)', chranit: ['G2'],
      zadani: 'Do [[@D11]] spočítejte částku k úhradě.', napovedy: ['Mezisoučet − sleva + DPH: D8-D9+D10.'] },
    { id: 'j6', cil: 'G5', reseni: '=COUNTIF(C2:C6,">1000")', vyzaduje: ['COUNTIF'], zadani: 'Do [[@G5]] spočítejte, kolik položek má cenu za kus vyšší než 1000 Kč.',
      napovedy: ['{COUNTIF}(C2:C6{;}">1000")'] },
  ],
},
];

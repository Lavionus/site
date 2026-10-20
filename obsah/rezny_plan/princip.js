/* Řezný plán – texty „Jak to funguje“, postup a bezpečnost, formáty importu (HTML řetězce) */
(function (koren) {
  'use strict';
  const schemaGilotina = `<figure class="schema"><svg viewBox="0 0 560 210" role="img" aria-label="Stupně gilotinových řezů">
  <defs><marker id="rpSip" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="currentColor"/></marker></defs>
  <g fill="none" stroke="currentColor" stroke-width="1.2">
    <rect x="10" y="20" width="160" height="110" fill="#e9d8b8" stroke="#7a6545"/>
    <line x1="10" y1="62" x2="170" y2="62" stroke="#c2410c" stroke-width="2"/><line x1="10" y1="100" x2="170" y2="100" stroke="#c2410c" stroke-width="2"/>
    <rect x="200" y="20" width="160" height="110" fill="#e9d8b8" stroke="#7a6545"/>
    <line x1="200" y1="62" x2="360" y2="62" stroke="#c2410c" stroke-width="1"/><line x1="200" y1="100" x2="360" y2="100" stroke="#c2410c" stroke-width="1"/>
    <line x1="262" y1="20" x2="262" y2="62" stroke="#c2410c" stroke-width="2"/><line x1="315" y1="20" x2="315" y2="62" stroke="#c2410c" stroke-width="2"/>
    <line x1="290" y1="62" x2="290" y2="100" stroke="#c2410c" stroke-width="2"/><line x1="245" y1="100" x2="245" y2="130" stroke="#c2410c" stroke-width="2"/>
    <rect x="390" y="20" width="160" height="110" fill="#e9d8b8" stroke="#7a6545"/>
    <rect x="390" y="20" width="62" height="42" fill="#cfe3f7"/><rect x="453" y="20" width="52" height="42" fill="#f9dcc0"/><rect x="506" y="20" width="44" height="30" fill="#d6efd2"/>
    <line x1="506" y1="50" x2="550" y2="50" stroke="#c2410c" stroke-width="2"/>
    <rect x="390" y="62" width="100" height="38" fill="#f3d2e4"/><rect x="491" y="62" width="59" height="38" fill="#e6e0f7"/>
    <rect x="390" y="100" width="55" height="30" fill="#fbeeb8"/>
  </g>
  <g fill="currentColor" font-size="12" font-family="sans-serif">
    <text x="90" y="150" text-anchor="middle">1. stupeň – pruhy</text><text x="90" y="166" text-anchor="middle">(podélné řezy přes celou desku)</text>
    <text x="280" y="150" text-anchor="middle">2. stupeň – příčně v pruhu</text><text x="280" y="166" text-anchor="middle">(každý řez přes celý pruh)</text>
    <text x="470" y="150" text-anchor="middle">3. stupeň – dořezání</text><text x="470" y="166" text-anchor="middle">(odřezky = zbytek / odpad)</text>
  </g>
  <path d="M175 75 L195 75" stroke="currentColor" stroke-width="1.4" marker-end="url(#rpSip)"/><path d="M365 75 L385 75" stroke="currentColor" stroke-width="1.4" marker-end="url(#rpSip)"/>
</svg><figcaption>Gilotinový řez vždy prochází celým kusem od hrany ke hraně – jinak to na formátovací ani ruční pile nejde.</figcaption></figure>`;

  const princip = `
<h3>Co stránka řeší</h3>
<p><b>2D – desky:</b> rozmístí dílce na velkoplošné desky (DTD, MDF, HDF, překližka, OSB, spárovka) tak, aby se spotřebovalo co nejméně materiálu (nejnižší cena), dodržel se směr dekoru/vláken a šlo to skutečně nařezat. <b>1D – tyče:</b> rozdělí požadované délky hranolů, fošen, lišt nebo profilů (jekly, L profily) do polotovarů – i při více délkách s různou cenou.</p>
${schemaGilotina}
<h3>Jak se počítá – 2D</h3>
<ol>
<li><b>Řezný rozměr.</b> Z hotového rozměru se odečte tloušťka ABS hrany na každé hranované straně (a případně přičte přídavek na frézování před olepením – pre-milling). Na desku se kreslí řezný rozměr, na štítek a do kusovníku hotový.</li>
<li><b>Prořez a okraj.</b> Každý dílec se při balení zvětší o šířku řezu vpravo a nahoře a užitná plocha (deska − 2 × okraj) o jednu šířku řezu. Díky tomu mají skutečné dílce mezi sebou vždy aspoň šířku řezu (kotouč, fréza). Okraj je pás, který se z každé tovární hrany odřízne při zarovnání (poškozené hrany, nepravoúhlost).</li>
<li><b>Heuristiky.</b> Gilotinový režim používá algoritmus <i>Guillotine</i> (volné obdélníky dělené vždy jedním průběžným řezem) se 4 pravidly výběru místa (nejlepší plocha BAF, nejkratší/nejdelší zbývající strana BSSF/BLSF, zdola-zleva BL) × 8 pravidly dělení (kratší/delší osa, kratší/delší zbytek, min./max. plocha, vždy podélně, vždy příčně). Volný režim (CNC) přidá <i>MaxRects</i> (5 pravidel včetně kontaktního obvodu) a <i>Skyline</i> (zdola-zleva, nejmenší odpad).</li>
<li><b>Hledání.</b> Každá metoda se zkusí se 7 způsoby řazení dílců (plocha, delší/kratší strana, obvod, délka, šířka, protáhlost). Pak náhodné restarty a lokální hledání nad pořadím dílců (prohození, přesun, otočení úseku), plnění desek jednotlivě (každá deska co nejvíc zaplněná) a nakonec „rozbij a postav znovu“ – nejméně zaplněná deska se s jednou až dvěma dalšími přeskládá znovu. Vybere se řešení s nejnižší cenou, pak nejmenším počtem desek a nejvíc soustředěným odpadem (velký zbytek je užitečnější než deset malých).</li>
<li><b>Více formátů a zbytky.</b> Pro každou další desku se zkusí všechny dostupné formáty a vybere se ten s nejnižší cenou za skutečně využitou plochu; na konci se každá deska zkusí nahradit levnějším formátem, do kterého se vejde celý její obsah. Zbytky ze skladu mají cenu 0, a proto se použijí přednostně.</li>
<li><b>Posloupnost řezů.</b> Z hotového uložení se rekonstruuje strom řezů: v kusu se najdou všechny průběžné řezy jedním směrem (pruhy), každý pruh se odřízne od zbytku desky a rekurzivně rozdělí druhým směrem, až zbudou samostatné dílce a odřezky. Každý řez je zapsán i s kusem, který dělí, a s nastavením pravítka (šířka odřezávaného pruhu). Kontrolní simulace ověřuje, že každý řez dělí celý existující kus a neprojde žádným dílcem.</li>
<li><b>Zbytky.</b> Odřezky, jejichž kratší strana i plocha překročí nastavené minimum, se označí jako použitelné; jedním tlačítkem je zapíšete do skladu zbytků a příští výpočet je použije dřív než nové desky.</li>
</ol>
<h3>Jak se počítá – 1D</h3>
<ol>
<li>Kapacita tyče = délka − zarovnání čela + šířka řezu, kus zabere délku + šířku řezu (poslední kus u konce tyče řez nepotřebuje). Platí tedy: zarovnání + Σ délek + (n − 1) × řez ≤ délka tyče.</li>
<li>FFD a BFD (první/nejlepší vhodná tyč, kusy od nejdelšího) pro každou délku polotovaru zvlášť, sekvenční batoh (SHP – každá další tyč se naplní řešením úlohy o batohu tak, aby cena za využitou délku byla nejnižší) ve dvou variantách a náhodné restarty.</li>
<li>Každá tyč se nakonec převede na nejlevnější dostupnou délku, do které se její kusy vejdou.</li>
<li>Do 24 kusů ve skupině se úloha řeší <b>přesně</b> metodou větvení a mezí (branch and bound) s dolní mezí z ceny za milimetr – výsledek je označen jako optimální. U větších úloh se opakovaně vybírá několik nejhůř využitých tyčí a jejich kusy se přeřežou přesně.</li>
</ol>
<h3>Jak číst plán</h3>
<ul>
<li>Číslo dílce <b>3.2</b> = řádek 3 seznamu dílců, 2. kus. Stejné označení je na štítku i v CSV.</li>
<li>Modrá čára uvnitř dílce = hranovaná strana (silná = hrana ≥ 1 mm). D1/D2 jsou podélné strany (podél délky dílce), Š1/Š2 příčné.</li>
<li>Oranžové čáry a kroužky = řezy v pořadí; čárkovaně zarovnání tovární hrany. Symbol ⟲ = dílec je otočený (délka dílce leží napříč desky).</li>
<li>Šipka „směr vláken“ ukazuje podélný směr dekoru desky; dílce se zaškrtnutým směrem vláken se nikdy neotáčí.</li>
</ul>`;

  const postup = `
<h3>Postup řezání na formátovací pile</h3>
<ol>
<li>Zkontrolujte rozměr a pravoúhlost desky; změřte skutečnou šířku řezu (tloušťka zubů kotouče + rozvod, typicky 3,2–4,4 mm; s předřezem bývá stejná) a zadejte ji.</li>
<li>Řezy č. 1 a 2 jsou <b>zarovnání</b> – odříznutí okraje podélně a příčně, od nich se měří vše další.</li>
<li>Řežte <b>v pořadí čísel</b>. Sloupec „Pravítko“ je šířka pruhu, který řezem odříznete od děleného kusu (nastavení podélného pravítka nebo dorazu). Po řezu vždy pokračujte s kusem podle plánu – nic neotáčejte jinak, než ukazuje plán.</li>
<li>U dekorů dbejte, aby dílce se směrem vláken ležely tak, jak je nakresleno; lícovou stranu mějte nahoru (u pily s předřezem) a při řezání ruční okružní pilou lícem dolů.</li>
<li>Hned po odříznutí dílce nalepte štítek (stejné označení jako v plánu) na rub nebo na hranu, která se nebude olepovat.</li>
<li>Použitelné zbytky zapište tlačítkem do skladu, popište tužkou rozměrem a materiálem.</li>
</ol>
<h3>Ruční okružní pila s vodicí lištou (track saw)</h3>
<ul>
<li>Celou desku položte na podložku (pěnový polystyren / XPS, rošt), aby byl každý kus podepřen i po odříznutí – plán je proto řazen tak, že nejdřív odříznete celé pruhy a teprve pak je dělíte.</li>
<li>Lištu přikládejte na značky, ne na hranu; odměr měřte od hrany kusu, který plán uvádí jako „dělený kus“. Na straně odpadu je řez – rysku dávejte na hranu lišty.</li>
<li>Kotouč s větším počtem zubů (48–60 z na 160 mm) a předřez/ochrana proti vytrhávání zmenší otřepy laminátu.</li>
</ul>
<h3>CNC (volné uložení)</h3>
<ul>
<li>Šířka řezu = průměr frézy (+ případná vůle pro dokončovací průchod). Dílce se nemusí dát dělit gilotinou, ale musí mezi nimi zůstat tloušťka frézy.</li>
<li>DXF má vrstvy DESKA, OKRAJ, DILCE, ZBYTKY, REZY a TEXT – obrysy dílců jsou uzavřené polylinie v mm. Malé dílce držte můstky (tabs) nebo vakuem s obětní deskou, dílce vyřezávejte od nejmenších.</li>
</ul>
<h3>Bezpečnost u strojů</h3>
<ul class="varovani">
<li>Na formátovací pile používejte rozvírací klín a ochranný kryt kotouče; úzké pruhy (pod ~120 mm) posouvejte posuvkou, nikdy rukou mezi kotoučem a pravítkem.</li>
<li>Nikdy neřezejte podélně s příčným dorazem a současně s pravítkem – hrozí zpětný vrh. Odřezek nesmí uvíznout mezi kotoučem a pravítkem.</li>
<li>Velké desky podpírejte (podávací stůl, druhá osoba); ruka se nikdy nepohybuje v ose kotouče.</li>
<li>Ochrana sluchu a zraku, odsávání prachu (MDF a DTD prach je zdraví škodlivý), u ruční pily lišta zajištěná proti posunu svěrkami.</li>
</ul>`;

  const tipy = `
<h3>Tipy</h3>
<ul>
<li><b>Rezerva.</b> Kupujte desku navíc, pokud je využití nad ~90 % – chyba v jednom řezu jinak znamená další cestu do obchodu. U dekorů s nápadnou kresbou počítejte s odpadem na sladění kresby.</li>
<li><b>Směr vláken</b> zaškrtněte u všech viditelných dílců s dekorem dřeva (dvířka, čela, boky); záda, dna zásuvek a vnitřní dílce nechte otáčet – ušetří se nejvíc.</li>
<li><b>Pořadí řezů.</b> Nejdřív dlouhé podélné řezy (pruhy) – desku tak rychle zmenšíte na lehké kusy a přesnost se drží od jedné zarovnané hrany. Volba „první řezy“ = auto vybere směr s menším počtem řezů.</li>
<li><b>Hrany.</b> Odečet tloušťky hrany zapněte, pokud zadáváte hotové rozměry. Přídavek na hranu (typicky 20–50 mm na kus) pokrývá přetahy na začátku a konci olepování.</li>
<li><b>Zbytky</b> pod ~150 mm v kratší straně se obvykle nevyplatí skladovat; minimum nastavíte v nastavení.</li>
<li>Ceny desek, hran a profilů v předvolbách jsou <b>typické orientační</b> hodnoty – přepište je podle ceníku vašeho dodavatele.</li>
</ul>`;

  const formaty = `
<h3>Import z tabulky (CSV / schránka z Excelu)</h3>
<p>Oddělovač se pozná sám (tabulátor, středník, čárka), desetinná čárka i tečka. Hlavička je volitelná; rozpoznané sloupce (bez diakritiky, i anglicky):</p>
<ul>
<li><code>nazev</code> / name, <code>delka</code> / length, <code>sirka</code> / width, <code>ks</code> / qty, <code>material</code>, <code>tl</code> (tloušťka), <code>vlakna</code> (ano/ne) nebo <code>otacet</code> (ano/ne), <code>pozn</code></li>
<li>hrany: <code>d1 d2 s1 s2</code> (kód nebo název hrany, „ano“ = první hrana v seznamu), nebo jeden sloupec <code>hrany</code> ve tvaru <code>2/1</code> (2 podélné, 1 příčná), <code>1010</code> (D1 D2 Š1 Š2) či „d1 s2“.</li>
<li>Bez hlavičky: <code>délka;šířka;ks;název;materiál</code> (začíná-li řádek číslem) nebo <code>název;délka;šířka;ks;materiál;vlákna</code>.</li>
<li>Řádek bez šířky se načte jako <b>1D kus</b> (sloupec materiál = profil).</li>
</ul>
<pre class="kod">Název;Délka;Šířka;Ks;Materiál;Vlákna;Hrany
Bok;720;560;2;DTD 18 bílá;ne;1/2
Dvířka;716;396;2;DTD 18 dub;ano;2/2
Noha;740;;4;hranol 60×60;;</pre>
<h3>JSON kusovník (napojení jiných stránek)</h3>
<p>Jiné stránky mohou předat kusovník souborem nebo přes <code>localStorage['webapp_rezny_plan_vstup']</code> (stránka si ho při otevření nabídne k načtení a klíč smaže). Formát <code>kusovnik-v1</code>:</p>
<pre class="kod">{
  "format": "kusovnik-v1",
  "zdroj": "Truhlářské spoje", "projekt": "Komoda",
  "dilce": [ { "nazev": "Bok", "delka": 720, "sirka": 450, "ks": 2,
               "material": "DTD 18 dub", "vlakna": true,
               "hrany": { "d1": "ABS2", "d2": "", "s1": "", "s2": "" },
               "pozn": "" } ],
  "tyce":  [ { "nazev": "Noha", "delka": 740, "ks": 4, "profil": "hranol 60×60" } ],
  "desky": [ { "material": "DTD 18 dub", "delka": 2800, "sirka": 2070,
               "tloustka": 18, "cena": 1890, "ks": null, "vlakna": true } ],
  "polotovary": [ { "nazev": "Hranol 6 m", "profil": "hranol 60×60",
                    "delka": 6000, "cena": 450, "ks": null } ],
  "hrany_typy": [ { "id": "ABS2", "nazev": "ABS 2 mm dub", "tloustka": 2,
                    "sirka": 23, "cena": 22 } ]
}</pre>
<ul>
<li>Povinné jsou jen <code>dilce</code> nebo <code>tyce</code>; rozměry v mm, <code>ks: null</code> = neomezeně. Chybějící materiály a profily se doplní do skladu s typickým formátem.</li>
<li>Přijímá se i prosté pole řádků <code>{"nazev","ks","rozmer":"720 × 560 × 18 mm","material"}</code>, jaké exportují kusovníky ostatních stránek webu – deska se pozná podle poměru šířka/tloušťka, ostatní (hranoly, kolíky) jdou do 1D.</li>
<li>Tlačítko „Export kusovníku“ vytvoří stejný formát; „Export projektu“ uloží celý stav stránky včetně nastavení.</li>
</ul>`;

  koren.RPP = { princip, postup, tipy, formaty };
})(typeof window !== 'undefined' ? window : globalThis);

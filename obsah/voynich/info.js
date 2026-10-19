/* Voynichův rukopis – informační režim: o rukopisu, EVA, legenda IVTFF, zkratky, zdroje. */
(function () {
  'use strict';
  const V = window.Voynich, J = V.J, esc = V.esc;

  const EVA = [
    ['o', 'malý kroužek; nejčastější znak'], ['a', 'podobá se latinskému a'], ['y', 'jako „9“ s ocáskem, hlavně na konci slov'],
    ['d', 'jako „8“ s ocáskem'], ['e', 'jako „c“; často zdvojené ee'], ['i', 'krátký tah (minima); řady ii, iii'],
    ['n', 'zakončení řady i (aiin, daiin)'], ['r', 'jako „2“, hlavně na konci slov'], ['l', 'tah se smyčkou, podobá se „l“'],
    ['s', 'podobá se „s“; sh = s s obloučkem'], ['q', 'jako „4“, téměř jen na začátku slov (qo-)'], ['m', 'zakončení podobné „m“'],
    ['k', 'šibenice (gallows) se dvěma smyčkami'], ['t', 'šibenice se smyčkou a delším ramenem'], ['p', 'šibenice s jednou smyčkou, hlavně v prvních řádcích odstavců'],
    ['f', 'šibenice podobná p, vzácnější'], ['ch', 'lavice (bench) – dvě c spojená nahoře'], ['sh', 'lavice s obloučkem nad začátkem'],
    ['cth ckh cph cfh', 'lavicové šibenice – šibenice vepsaná do lavice'], ['g x v z j u b', 'vzácné znaky a varianty'],
    ['?', 'nečitelný znak'], ['@NNN;', 'vzácný glyf mimo základní EVA (v přepisu ZL)']
  ];

  function kresli() {
    const el = document.getElementById('obsahInfo');
    const zl = V.prepis('zl');
    const k = V.korpus('zl');
    el.innerHTML = `
<h2>O rukopisu</h2>
<div class="mrizka2">
<div>
<p><b>Voynichův rukopis</b> (Beinecke Rare Book &amp; Manuscript Library, Yale University, signatura <b>MS 408</b>) je ilustrovaný kodex psaný neznámým písmem a neznámým jazykem, který se dosud nepodařilo přečíst. Pergamen byl radiokarbonovou metodou datován do let <b>1404–1438</b>. Dochovalo se zhruba 240 stran v 18 složkách; asi čtrnáct listů chybí a několik je velkých rozkládacích.</p>
<p>Jmenuje se po antikvářovi <b>Wilfridu Voynichovi</b>, který ho získal v roce 1912 z jezuitské sbírky ve Ville Mondragone u Frascati. Starší dějiny vedou do <b>Prahy</b>: na první stránce byl pod ultrafialovým světlem rozpoznán podpis <b>Jakuba Hořčického z Tepence</b>, lékárníka a alchymisty na dvoře Rudolfa II. V 17. století rukopis vlastnil pražský alchymista Georg Baresch a po něm lékař a rektor pražské univerzity <b>Jan Marek Marci</b>. Ten ho v 60. letech 17. století poslal do Říma jezuitovi Athanasiu Kircherovi. V přiloženém dopise uvedl, že ho podle doslechu koupil císař Rudolf II. za 600 dukátů. Po Voynichově smrti rukopis koupil antikvář Hans P. Kraus a roku 1969 ho daroval Yaleově univerzitě.</p>
<p>Navzdory úsilí kryptologů (včetně týmu Williama Friedmana), lingvistů i amatérů zůstává text nerozluštěn. Hlavní hypotézy: šifra přirozeného jazyka, neznámý nebo vymyšlený jazyk, přirozený jazyk ve vlastním písmu, nebo smysluplně nevyjadřující text (podvrh, glosolálie). Statistiky textu (Zipfův zákon, opakování slov, vazba znaků na polohu ve slově a na řádku, nízká entropie) zatím nedávají jednoznačnou odpověď. Právě k jejich ověřování slouží tahle stránka.</p>
</div>
<div>
<h3 style="margin-top:0">Sekce rukopisu</h3>
${V.J.PORADI_ILUSTRACI.map(i => `<p style="margin:4px 0"><b>${esc(J.ILUSTRACE[i])}</b> – ${esc(J.ILUSTRACE_POPIS[i])}.</p>`).join('')}
<h3>Jazyky a písaři</h3>
<p>Prescott Currier (1976) rozlišil dva statisticky odlišné „jazyky“ <b>A</b> a <b>B</b>. Liší se třeba četností slov chedy, qokeedy (B) proti chol, chor (A). Paleografka <b>Lisa Fagin Davis</b> (2020) rozpoznala pět písařů. Jejich čísla jsou v přepisu ZL a v této stránce jako „písař 1–5“; Currierovo starší rozdělení je ve sloupci „Currier“.</p>
<h3>Čísla tohoto vydání</h3>
<p>${V.SNIMKY.length} snímků · ${zl.stranky.length} stránek přepisu · ${k.lokusy.length.toLocaleString('cs-CZ')} řádků a popisků · ${k.slova.length.toLocaleString('cs-CZ')} slov v přepisu ZL.</p>
</div>
</div>

<h2>Abeceda EVA</h2>
<p>Přepisy používají <b>EVA</b> (Extensible/European Voynich Alphabet; R. Zandbergen a G. Landini, 1998). Písmena EVA jsou jen <b>konvenční značky pro tvary</b> voynichského písma, ne jejich hláskové hodnoty. Například „daiin“ neznamená, že se slovo čte [daiin]. EVA rozkládá složitější tvary na jednodušší tahy. Proto se v analýze dá přepnout jednotka na „glyfy“, kde se ch, sh a lavicové šibenice počítají jako jeden znak.</p>
<div class="eva-tab">${EVA.map(([z, p]) => `<div><b class="eva">${esc(z)}</b>${esc(p)}</div>`).join('')}</div>

<h2>Značky v přepisu</h2>
<div class="mrizka2">
<div><h3>Druhy textu (lokusy IVTFF)</h3><table class="meta">${Object.entries(J.TYP_LOKUSU).map(([k2, v]) => `<tr><th class="eva">${k2}</th><td>${esc(v)}</td></tr>`).join('')}</table></div>
<div><h3>Zápis IVTFF</h3><table class="meta">
<tr><th class="eva">.</th><td>mezera mezi slovy</td></tr>
<tr><th class="eva">,</th><td>nejistá mezera (volba ⚙️ určuje, zda dělí slova)</td></tr>
<tr><th class="eva">[a:b]</th><td>nejisté čtení – první varianta je pravděpodobnější</td></tr>
<tr><th class="eva">{ }</th><td>ligatura (spojené znaky)</td></tr>
<tr><th class="eva">?</th><td>nečitelný znak; ??? = neznámý počet znaků</td></tr>
<tr><th class="eva">&lt;-&gt;</th><td>text přerušený kresbou</td></tr>
<tr><th class="eva">&lt;%&gt; &lt;$&gt;</th><td>začátek a konec odstavce</td></tr>
<tr><th class="eva">&lt;!…&gt;</th><td>komentář přepisovatele (v textu značka ✱)</td></tr>
<tr><th class="eva">@NNN;</th><td>vzácný glyf mimo EVA</td></tr>
</table>
<h3>Poloha položky (lokátor)</h3><table class="meta">${Object.entries(J.LOKATOR).map(([k2, v]) => `<tr><th class="eva">${esc(k2)}</th><td>${esc(v)}</td></tr>`).join('')}</table></div>
</div>

<h2>Ovládání prohlížeče</h2>
<div class="zkratky">
<div><kbd>←</kbd> <kbd>→</kbd> / <kbd>PgUp</kbd> <kbd>PgDn</kbd> předchozí / další snímek</div>
<div><kbd>Home</kbd> <kbd>End</kbd> první / poslední snímek</div>
<div><kbd>/</kbd> skok na folio (např. f68r1, 116v, #120)</div>
<div>kolečko myši, dva prsty: přiblížení · tažení: posun</div>
<div>dvojklik: přiblížit 2× (s <kbd>Shift</kbd> oddálit)</div>
<div><kbd>+</kbd> <kbd>−</kbd> přiblížit / oddálit · <kbd>0</kbd> celý snímek</div>
<div><kbd>W</kbd> na šířku · <kbd>1</kbd> skutečná velikost</div>
<div><kbd>R</kbd> otočit o 90° (<kbd>Shift</kbd>+<kbd>R</kbd> zpět)</div>
<div><kbd>F</kbd> filtry obrazu (inkoust, pigmenty, negativ)</div>
<div><kbd>S</kbd> srovnání dvou snímků vedle sebe</div>
<div><kbd>N</kbd> náhledy · <kbd>P</kbd> panel s přepisem</div>
<div><kbd>B</kbd> záložka · <kbd>Esc</kbd> zavřít nabídku</div>
</div>
<p class="male tlumeny">Odkaz na konkrétní stránku: <span class="eva">voynich.html#f68r1</span>; na hledání: <span class="eva">voynich.html#hledat=qokeedy</span>.</p>

<h2>Zdroje a práva</h2>
<ul>
<li><b>Snímky:</b> <a href="${esc(V.SN.katalog)}" target="_blank" rel="noopener">Beinecke Rare Book &amp; Manuscript Library, Yale University, MS 408</a> – volné dílo; Yale u digitalizací volných děl nenárokuje autorská práva. Na tomto webu jsou zmenšené na výšku 1600 px a převedené do WebP; originál v plném rozlišení otevře tlačítko „⤢ Originál“ (IIIF).</li>
<li><b>Přepisy:</b> soubory IVTFF z <a href="https://www.voynich.nu/transcr.html" target="_blank" rel="noopener">voynich.nu</a> (René Zandbergen): ZL 3b (Zandbergen–Landini), IT 2a (Takeshi Takahashi z interlineárního souboru Landini–Stolfi), RF 1b (referenční přepis). Autorská práva k přepisům náleží jejich autorům; zde se používají pro studijní a badatelské účely s uvedením zdroje. Popis formátu: R. Zandbergen, <a href="https://www.voynich.nu/software/ivtt/IVTFF_format.pdf" target="_blank" rel="noopener">IVTFF format</a>.</li>
<li><b>Statistiky</b> počítá tato stránka přímo v prohlížeči z vybraného přepisu; výsledky závisí na přepisu a na volbách výkladu (⚙️).</li>
</ul>
<h3>Kam dál</h3>
<ul>
<li><a href="https://www.voynich.nu/" target="_blank" rel="noopener">voynich.nu</a> – nejpodrobnější web o rukopisu (historie, popis stránek, přepisy)</li>
<li><a href="https://www.voynich.ninja/" target="_blank" rel="noopener">Voynich Ninja</a> – diskusní fórum badatelů</li>
<li><a href="https://www.ic.unicamp.br/~stolfi/voynich/" target="_blank" rel="noopener">Jorge Stolfi</a> – klasické analýzy struktury slov</li>
<li>M. E. D'Imperio: <i>The Voynich Manuscript: An Elegant Enigma</i> (NSA, 1978)</li>
<li>P. Currier: <i>Papers on the Voynich Manuscript</i> (1976)</li>
<li>L. Fagin Davis: <i>How Many Glyphs and How Many Scribes? Digital Paleography and the Voynich Manuscript</i>, Manuscript Studies 5/1 (2020)</li>
</ul>`;
  }
  V.rezimy.info = { ukaz: kresli };
})();

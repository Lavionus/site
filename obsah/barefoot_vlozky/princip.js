/* ============================================================
   Barefoot vložky – „Jak to funguje“: měření, rezervy, tvary prstů, materiály, velikosti, historie.
   Jeden zdroj pro HTML (záložka) i PDF (řádky, nadpis začíná „# “).
   ============================================================ */
(function (koren) {
  'use strict';
  const ODDILY = [
    ['Co je barefoot vložka', [
      'Barefoot (minimalistická) bota má plochou podrážku bez podpatku (zero drop), ohebnou podešev a širokou špičku, ve které se prsty volně roztáhnou. Vložka do ní proto není „ortopedická“ – nemá podporu klenby ani zvýšenou patu. Je to tenká rovná deska ve tvaru chodidla, která hřeje, saje pot a dá se vyprat nebo vyměnit.',
      'V režimu Univerzální generátor kreslí vložku ze tří rozměrů chodidla. Vnitřní strana je skoro rovná (palec míří dopředu, ne do špičky), přední okraj sleduje délky prstů a k obrysu se přičítá rezerva.',
    ]],
    ['Jak změřit chodidlo', [
      'Měřte odpoledne nebo večer (noha během dne nateče), vestoje a s váhou na obou nohou, v ponožkách, které budete v botách nosit.',
      'Postavte se patou ke zdi na papír a nechte druhého obkreslit chodidlo tužkou drženou svisle. Délka = od zdi k nejdelšímu prstu. Šířka přes klouby = vzdálenost dvou rovnoběžných čar podél nohy, které se dotýkají kloubu palce a malíku (jako posuvkou). Šířka paty = nejširší místo paty, asi 2–5 cm od zadního okraje.',
      'Změřte obě nohy – rozdíl několika milimetrů je běžný. Botu vybírejte podle větší, vložky můžete mít každou podle své nohy (volba „každá zvlášť“).',
      'Obkreslený obrys nebo starou vložku můžete vyfotit shora i s pravítkem a vložit jako předlohu – po kalibraci podle pravítka na ní nástroj změří délku a šířky.',
    ]],
    ['Proč rezerva ve špičce', [
      'Při kroku se chodidlo zatížením prodlouží a roztáhne (klenba se sníží) – u dospělých o několik milimetrů. V botě navíc noha při došlapu klouže dopředu. Barefoot výrobci proto doporučují vnitřní délku o 10–15 mm delší než chodidlo, u dětí 12–17 mm (s rezervou na růst asi na půl roku).',
      'Do stran se přidává jen málo (0–3 mm na stranu): prsty se mají roztáhnout, ale chodidlo nemá v botě plavat. Za patou se rezerva většinou nedává – pata se opře o zadní stěnu.',
      'Kontrolní šablona (režim „zkoušení bot“) je obrys nohy prodloužený o rezervu, s jazýčkem na vytažení. Zasunete ji do boty: když se ve špičce ohne, bota je krátká; když je za špičkou šablony ještě místo, vidíte kolik. Zelené značky ukazují, kde končí noha.',
    ]],
    ['Tvary prstů', [
      'Egyptský tvar – palec je nejdelší a ostatní prsty šikmo ubývají; v Evropě nejčastější. Řecký tvar – druhý prst přesahuje palec (Mortonův prst); v botě o délce rozhoduje druhý prst. Římský (čtvercový) – první dva až tři prsty jsou skoro stejně dlouhé, potřebuje hranatou širokou špičku.',
      'Délku chodidla vždy měřte k nejdelšímu prstu, ať je to kterýkoli – tvar prstů pak jen rozhoduje, kde špička vložky vrcholí.',
    ]],
    ['Ořezové čáry a velikosti', [
      'Červené čárkované čáry jsou obrys zmenšený dovnitř po zvoleném kroku (tak jako u kupovaných vložek s vyznačenými čísly). Když je vložka do boty dlouhá, odstřihne se špička po čáře – ubere délku i trochu šířky ve špičce.',
      'Čísla EU/UK/US jsou jen orientační. Vnitřní délka boty se převádí na délku kopyta (zde + 8 mm) a z ní na pařížský steh (2/3 cm = 1 číslo EU) nebo na britskou třetinu palce. Výrobci mají vlastní tabulky a liší se i o jedno číslo – vždy porovnávejte vnitřní délku, kterou udávají, nebo šablonu přímo v botě.',
    ]],
    ['Materiály', [
      'Vlněná plsť 3–5 mm hřeje i vlhká a saje pot, časem se slehne. Korek 2–3 mm je lehký a neplesniví. Rostlinně vyčiněná kůže 1,5–2,5 mm je tenká a odolná. EVA pěna je levná na zkoušku tvaru, ale nesaje pot. Ovčí kožešina 6–10 mm je zimní vložka – vezme hodně místa, počítejte s botou o číslo větší. Lněná nebo konopná tkanina ve dvou prošitých vrstvách je letní a pratelná.',
      'Každý milimetr vložky ubírá výšku ve špičce a citlivost chodidla. Pro barefoot boty volte co nejtenčí materiál, který stačí na teplo.',
      'Perforace (otvory) zlepšuje odvod vlhkosti u kůže a EVA; plsť a tkanina ji nepotřebují.',
    ]],
    ['Vložky na míru z předlohy', [
      'Režim „Na míru“ nekreslí model, ale skutečný obrys: obkreslené chodidlo (tužkou drženou svisle, vestoje), otisk nebo starou vložku, která sedí. Předlohu naskenujte nebo vyfoťte kolmo shora. Na jednom obrázku mohou být obě nohy – každý uzavřený obrys se stane samostatnou šablonou; když se dva dotýkají, rozdělte je čarou.',
      'Měřítko obrázku: u skenu stačí zadat DPI. U fotky klikněte na čtyři rohy listu papíru – obrázek se srovná do pravého úhlu a zároveň dostane přesné měřítko (list A4 má 210 × 297 mm). Jde to i podle dvou bodů na pravítku. Když měřítko neznáte, zadejte skutečnou délku a šířku chodidla změřenou pravítkem (okno 📏 Kalibrace → Rozměry obrysů, nebo u vybraného obrysu) – kalibrace v ose délky a v ose šířky je nezávislá, takže opraví i mírně šikmou fotku.',
      'U obkreslené čáry vyberte, zda brát obrys ze středu, vnitřní, nebo vnější hrany čáry; tužka vede kousek vedle chodidla, proto bývá potřeba korekce asi −1 až −2 mm (nebo záporný offset).',
      'Šablona se natočí podle hlavní osy tvaru (od paty ke špičce) nebo podle vnitřní tečny paty a kloubu palce – tak, jak se měří u obuvi. Pootočení lze doladit ručně.',
      'Offset X rozšíří vložku do stran, offset Y prodlouží vpředu i vzadu, „ve špičce“ přidá délku jen v přední části. Offset se počítá jako obálka elipsy kolem obrysu, takže sleduje tvar i v prohlubních. Společný offset platí pro všechny šablony projektu, vlastní offset šablony se k němu přičte.',
      'V režimu ◉ Uzly lze uzly obrysu táhnout myší, dvojklikem přidat a pravým tlačítkem nebo klávesou Delete smazat – třeba když čáru přerušil prst nebo stín. Projekt se ukládá automaticky do prohlížeče (i s předlohami); pro zálohu nebo přenos na jiný počítač použijte export projektu.',
    ]],
    ['Kalibrační karta, vyhlazení prstů a měření', [
      'Nejpřesnější a nejpohodlnější cesta je kalibrační karta (Nástroje → Kalibrační karta A4, okno 📏 Kalibrace, nebo tlačítko 📄 Kalibrační karta v panelu Předlohy): list A4 se čtyřmi černými čtverci. Nohu obkreslíte přímo na kartu a vyfotíte ji mobilem – stránka čtverce najde sama, srovná perspektivu a nastaví měřítko. Bez karty zkusí najít okraje celého listu papíru (papír musí být celý v záběru a kontrastní proti podložce).',
      'Tužka u prstů obvykle zajede do mezer mezi nimi a obrys je zvlněný. Nejrychlejší je 〰️ Vyhladit (v liště editoru, v Nástrojích nebo klávesa H): otevře nastavení síly u prstů a po celém obrysu a změnu ukáže oranžově v editoru; tlačítko Použít ji provede (u prstů vyplní zářezy, jinde obrys jen mírně narovná a uzly rozloží rovnoměrně), další použití vyhladí víc, Zpět (Ctrl+Z) vrátí. Vratné nastavení, které obrys trvale nemění, je u obrysu v části ✋ Vyhlazení prstů.',
      'Nástroj Měřit v editoru změří vzdálenost dvou bodů a úhel u prostředního ze tří bodů, např. odklon palce nebo šířku paty v libovolném místě.',
      'Šablona může být chodidlo, stará vložka, nebo stélka vyjmutá z boty. Stélka se netiskne, ale v záložce Porovnání ukáže, kde noha přesahuje botu (červeně) a kolik zbývá místa (zeleně). Stejně lze porovnat chodidlo vestoje a vsedě – rozdíl ukáže, o kolik se noha zatížením prodlouží a rozšíří.',
    ]],
    ['Výroba: vrstvy, podpory, boty, zakázky', [
      'Dvouvrstvá vložka: svrchní vrstva má plný obrys, spodní (např. korek pod plstí) je o pár milimetrů menší, aby se hrana nedrolila. Obě se kreslí do jedné šablony a na arch se dají rozvrhnout zvlášť.',
      'Pelota pod příčnou klenbou a podpatěnka jsou korekční prvky – kreslí se jako vyznačená místa a přilepují se na spodní stranu. Patří k vložce doporučené odborníkem; čistě barefoot vložka je rovná.',
      'Moje boty: zapište vnitřní délku a šířku svých bot a stránka ukáže rezervu u každé nohy. Tlačítkem „ořez“ se do šablony přidá plná červená čára přesně na délku boty.',
      'Projekt má stav zakázky, termín a počet párů; seznam všech zakázek jde stáhnout jako CSV. Před každou velkou změnou (nové hledání obrysů, měřítko, mazání, zapečení) se uloží verze, ke které se lze vrátit v nabídce Projekt.',
    ]],
    ['Kalibrace, fotka a sdílení', [
      'Tlačítko 📏 Kalibrace v liště pulzuje s vykřičníkem, dokud předloha nemá skutečné měřítko (ani zadané skutečné rozměry obrysů); po kalibraci ukáže ✓. Okno Kalibrace má tři části: měřítko předlohy (kalibrační karta, list papíru, pravítko, DPI), skutečné rozměry šablon (délka a šířka zvlášť) a tiskárnu. Tiskárny často tisknou o 1–3 % jinak – ze zkušebního listu se změří úsečky 150 a 200 mm a všechna PDF (šablony, arch, karta) se pak tisknou s vyrovnáním.',
      'Fotku lze pořídit přímo fotoaparátem (📷 Vyfotit). Po načtení se hodnotí kvalita: ostrost, přesvícení, tma, kontrast a šikmost snímku; při problému stránka poradí, co zlepšit.',
      'Dvě obkreslení téže nohy lze zprůměrovat – stránka ukáže, jak moc se liší (přesnost měření). Poškozenou předlohu jedné nohy lze dorovnat tvarem druhé (zrcadleně, se zachováním vlastní délky a šířky). Obrys jde také obkreslit ručně v editoru, uzly táhnout s dosahem (sousední uzly se posunou plynule) a vyhlazení vlnek nejdřív prohlédnout oranžově v náhledu.',
      'Sdílení odkazem nese obrysy a nastavení přímo v odkazu (zkomprimované) – nic se neukládá na server; fotky, jméno klienta ani poznámka se nepřenášejí. Odkaz jde předat i jako QR kód, třeba na štítku zakázky.',
      'Pro laser, Cricut, Silhouette nebo CNC nůž je výstup jen s tím, co stroj dělá: řez (s kompenzací šířky řezu – obrys se posune ven o polovinu, otvory zmenší), bigování ořezových čar a gravírování popisků.',
    ]],
    ['Porovnání nohou a výroba z archu', [
      'Záložka Porovnání zrcadlí levou nohu a přiloží ji patou na pravou. Ukáže rozdíl délky, šířky, paty a plochy i místo největší odchylky obrysu. Rozdíl do 3–4 mm bývá běžný; větší rozdíl je důvod mít každou vložku podle své nohy.',
      'Záložka Arch materiálu spočítá, kolik párů se vejde na arch plsti, korku nebo kůže. Vložky se kladou do řad, střídavě špičkou proti patě, a zbytek archu se dovyplní vložkami napříč. Mezera mezi díly odpovídá nástroji: laser 1–2 mm, nůž nebo nůžky 3–5 mm. U materiálu se směrem vlasu nebo vláken zvolte jen jeden směr. Rozvržení jde stáhnout jako SVG nebo DXF pro laser, plotr či CNC nůž.',
    ]],
    ['Jak se kreslí obrys', [
      'Z délky, šířky přes klouby a šířky paty se spočítají opěrné body: pata, vnější hrana, kloub malíku (asi 63 % délky od paty), kloub palce (asi 72 %), špičky prstů podle zvoleného tvaru a vnitřní hrana s volitelným prohnutím u klenby. Body se proloží uzavřenou křivkou (centripetální Catmull-Rom, nedělá smyčky) a obrys se pak přesně přeškáluje na cílovou délku a šířku; šířka paty se doladí opakovaným výpočtem.',
      'Rezervy se přičítají k opěrným bodům (vpředu, do stran, za patou), ořezové čáry vznikají posunem obrysu po normále dovnitř. Šablona se tiskne 1:1 – kontrolní čtverec a měřítka na listu ukáží, jestli tiskárna neměnila velikost. Delší vložky se rozdělí na více listů s přesahem.',
      'Obrys je modelový, ne sken vaší nohy. Proto má smysl šablonu před stříháním materiálu porovnat s obkresleným chodidlem nebo starou vložkou a parametry doladit.',
    ]],
    ['Trocha historie', [
      'Anglická velikost se odvozuje od ječného zrna (barleycorn, třetina palce); tradice ji připisuje nařízení Eduarda II. z roku 1324, doložená je ale až mnohem později. Kontinentální pařížský steh (pointure) měří 2/3 cm – podle šití obuvi. Mezinárodní Mondopoint (ISO 9407) uvádí přímo délku a šířku chodidla v milimetrech, používá se u lyžařských a vojenských bot.',
      'Měřidlo délky i šířky chodidla, které dodnes stojí v obchodech, patentoval Charles Brannock v roce 1927.',
      'Lidé chodili tisíce let bosí nebo v mokasínech a sandálech bez podpatku. Zájem o minimalistickou obuv oživily běžecké boty s prsty (od roku 2005), kniha Born to Run (2009) a studie Daniela Liebermana a kol. v Nature (2010) o tom, jak bosí běžci došlapují.',
    ]],
    ['Upozornění', [
      'Nástroj nenahrazuje lékaře ani ortopeda. Při bolestech nohou, cukrovce, deformitách nebo po úrazu se přechod na barefoot obuv a vlastní vložky poraďte s odborníkem. Přecházejte postupně – svaly chodidla a lýtka si zvykají týdny až měsíce.',
    ]],
  ];

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const SCHEMA = `<svg viewBox="0 0 260 150" role="img" aria-label="Měření chodidla: délka od paty k nejdelšímu prstu, šířka přes klouby a šířka paty">
<path d="M28 75c0-22 12-33 34-35 22-2 50-6 80-12 32-6 55-6 70 2 15 8 22 22 22 45s-7 37-22 45c-15 8-38 8-70 2-30-6-58-10-80-12-22-2-34-13-34-35z" fill="none" stroke="currentColor" stroke-width="1.6"/>
<line x1="20" y1="20" x2="20" y2="130" stroke="currentColor" stroke-width="3"/><text x="23" y="16" font-size="8" fill="currentColor">zeď</text>
<line x1="20" y1="142" x2="236" y2="142" style="stroke:var(--danger)" stroke-width="1.2"/><text x="128" y="139" font-size="9" text-anchor="middle" style="fill:var(--danger)">délka k nejdelšímu prstu</text>
<line x1="236" y1="128" x2="236" y2="146" style="stroke:var(--danger)" stroke-width="1"/>
<line x1="176" y1="26" x2="176" y2="124" style="stroke:var(--accent)" stroke-width="1.2"/><text x="180" y="78" font-size="9" style="fill:var(--accent)">šířka přes klouby</text>
<line x1="52" y1="44" x2="52" y2="106" style="stroke:var(--ok)" stroke-width="1.2"/><text x="56" y="78" font-size="9" style="fill:var(--ok)">pata</text>
</svg>`;

  function html() {
    return ODDILY.map(([h, P], i) => `<h3>${esc(h)}</h3>${i === 1 ? `<div class="schema">${SCHEMA}</div>` : ''}${P.map((p) => `<p>${esc(p)}</p>`).join('')}`).join('');
  }
  function radky() { const out = []; for (const [h, P] of ODDILY) { out.push('# ' + h, ...P); } return out; }

  const API = { ODDILY, html, radky };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.BFP = API;
})(typeof window !== 'undefined' ? window : globalThis);

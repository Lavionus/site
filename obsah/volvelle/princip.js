/* ============================================================
   Volvelle – oddíl „Jak to funguje“ a historie (HTML řetězce, bez DOM)
   ============================================================ */
(function (koren) {
  'use strict';
  const V = koren.VOLV;
  /** schéma: vrstvy nad sebou a nýtek */
  function schemaVrstev() {
    let s = '<figure class="schema"><svg viewBox="0 0 380 120" role="img" aria-label="Vrstvy volvelle nad sebou">';
    const vrstvy = [['spodní kotouč (pevný)', 0.95, '#e9d8ad'], ['otočný kotouč', 0.72, '#cfe0ea'], ['kryt s okénkem / ukazatel', 0.5, '#f6ecd3']];
    vrstvy.forEach(([t, k, c], i) => {
      const y = 92 - i * 26, rx = 120 * k, ry = 16 * k;
      s += `<ellipse cx="130" cy="${y}" rx="${rx}" ry="${ry}" fill="${c}" stroke="currentColor" stroke-width="1"/>`;
      if (i === 2) s += `<path d="M150 ${y - 6} l18 0 l-3 9 l-12 0 z" fill="var(--bg-elevated)" stroke="currentColor" stroke-width=".8"/>`;
      s += `<text x="${130 + rx + 8}" y="${y + 4}" font-size="10" fill="currentColor">${t}</text>`;
    });
    s += '<line x1="130" y1="20" x2="130" y2="104" stroke="var(--accent)" stroke-width="2.5"/><circle cx="130" cy="20" r="4" fill="var(--accent)"/>';
    s += '<text x="138" y="16" font-size="10" fill="var(--accent)">nýtek / patentka</text></svg>';
    return s + '<figcaption>Volvelle = kotouče na společné ose. Horní vrstvy mají okénka nebo ukazatel; jejich vzájemné natočení „počítá“.</figcaption></figure>';
  }
  const TEXTY = {
    kalendar: () => `<h3>Věčný kalendář</h3>
      <p>Den v týdnu se dá složit ze tří čísel: <b>kódu roku</b>, <b>kódu měsíce</b> a <b>dne</b>. Kód roku K je den v týdnu 1. ledna (0 = neděle), v přestupném roce o 1 větší; kód měsíce M je počet dní před ním mod 7 (leden 0, únor 3, březen 3, duben 6 …). Pak</p>
      <p style="text-align:center"><b>den v týdnu = (K + M + d − 1) mod 7</b></p>
      <p>Na spodním kotouči jsou roky rozdělené do 7 sektorů podle K, na horním měsíce do 7 sektorů podle M (proti směru ručiček). Když šipku měsíce natočíte na rok, je kotouč otočený o (K + M)·360°/7 a sedm okének nad prstencem dnů ukazuje dny v týdnu pro řádky 1, 8, 15… Leden a únor přestupného roku mají kód o 1 menší (led*, úno*), protože přestupný den ještě nenastal.</p>
      <p>Juliánský kalendář má přestupný každý čtvrtý rok; gregoriánský vynechává roky dělitelné 100, ale ne 400. Šablona ověřuje každý den 1900–2100 proti vestavěnému kalendáři prohlížeče.</p>`,
    mesic: () => `<h3>Fáze Měsíce</h3>
      <p>Od novoluní k novoluní uplyne v průměru <b>${V ? V.cislo(V.SYNODICKY, 4) : '29,5306'} dne</b> (synodický měsíc). Kotouč fází má po obvodu 360° = jedna lunace, takže jeden den je ${V ? V.cislo(360 / V.SYNODICKY, 2) : '12,19'}°. Okénko krytu ukazuje fázi a šipka stáří ve dnech.</p>
      <p>Skutečné lunace kolísají o ±14 hodin (eliptická dráha Měsíce i Země), proto je na krytu tabulka skutečných novoluní a úplňků zvoleného roku, spočítaná metodou Jeana Meeuse (Astronomical Algorithms, kap. 49, přesnost na minuty). Když kotouč jednou nastavíte podle novoluní a pak už ho jen každý den pootočíte o dílek, odchylka od skutečných fází během roku nepřesáhne jeden den.</p>
      <p>Osvětlený podíl kotouče je přibližně (1 − cos(2π · stáří / lunace)) / 2. Na jižní polokouli je Měsíc „obrácený“ – dorůstá zleva.</p>`,
    sifra: () => `<h3>Šifrovací kotouč</h3>
      <p>Vnější kotouč nese otevřenou abecedu, vnitřní otočný kotouč šifrovou. Při shodném pořadí jde o <b>Caesarovu šifru</b>: písmeno i se nahradí písmenem (i + k) mod N, kde k je natočení. Dešifruje se opačným posunem.</p>
      <p>Leon Battista Alberti popsal kotouč v traktátu <i>De componendis cifris</i> (1467) s míchanou vnitřní abecedou – a hlavně s nápadem kotouč <b>během zprávy pootáčet</b>. Tím vznikla první polyalfabetická šifra: stejné písmeno se pokaždé zašifruje jinak a frekvenční analýza přestane fungovat. Rozbor a lámání šifer najdete na stránce <a href="sifry.html">Šifry – kryptologická dílna</a>.</p>
      <p>Česká abeceda s CH má 27 znaků (bez diakritiky), úplná 42 znaků; anglická 26. Albertiho kotouč měl venku 20 písmen a číslice 1–4, uvnitř 24 znaků.</p>`,
    planisfera: () => `<h3>Otočná mapa hvězd (planisféra)</h3>
      <p>Hvězdy jsou zakreslené kolem světového pólu v <b>ekvidistantní azimutální projekci</b>: vzdálenost od středu je úměrná 90° − δ (deklinace), směr odpovídá rektascenzi α. Kryt nese okénko ve tvaru <b>obzoru</b> pro šířku φ: jeho body splňují sin δ = cos φ · cos A (A = azimut) a hodinový úhel H = atan2(−sin A, −cos A · sin φ). Jižní bod obzoru leží na δ = φ − 90°, severní na δ = 90° − φ, zenit na δ = φ.</p>
      <p>Hvězda kulminuje (je na poledníku), když se její rektascenze rovná <b>místnímu hvězdnému času</b>. Ten roste o 360° za hvězdný den a v tutéž hodinu se každý den posune o 0,9856°. Proto stačí dvě stupnice: na okraji hvězdného kotouče data (hvězdný čas o místní půlnoci), na krytu hodiny pásma, posunuté o zeměpisnou délku. Nastavení data proti hodině natočí oblohu přesně na hvězdný čas (chyba do 1°, tj. 4 minut).</p>
      <p>Data: Yale Bright Star Catalogue (Hoffleit &amp; Warren, 5. vyd.) – volné dílo, ${koren.VOLV_HVEZDY ? koren.VOLV_HVEZDY.pocet : 904} hvězd do 4,5 mag; čáry a jména souhvězdí z projektu d3-celestial (© Olaf Frohn, licence BSD-3).</p>`,
    prevodnik: () => `<h3>Převodník jednotek</h3>
      <p>Každý prstenec má dělicí čáru: vně stupnice jedné jednotky, uvnitř druhé. Hodnota x leží pod úhlem θ = θ₀ + rozpětí · (f(x) − f(min)) / (f(max) − f(min)), kde f je buď identita (lineární stupnice – teplota, palce), nebo log₁₀ (logaritmická – hmotnost, objem). Druhá jednotka se kreslí přes převodní funkci, takže štěrbina ukazatele vždy spojuje odpovídající hodnoty.</p>
      <p>Logaritmická stupnice zachovává poměry: 2 → 4 je stejně daleko jako 1 → 2. Proto se hodí pro rozsahy přes několik řádů (5 g až 2 kg) a dá stejně přesné čtení v procentech v celém rozsahu.</p>`,
    logaritmicky: () => `<h3>Kotoučové logaritmické pravítko</h3>
      <p>Hodnota x stupnice C/D leží pod úhlem 360° · log₁₀ x. Protože log(a·b) = log a + log b, sčítání úhlů je násobení: natočením kotouče o log a a odečtem o log b dál dostanete log(a·b). Kruhové pravítko nemá „konce“ – výsledek nikdy nevyjede mimo stupnici.</p>
      <ul><li><b>CI</b> – převrácená hodnota (1 − log x), <b>A/B</b> – dvě dekády na obvod (čte se x², opačně √x), <b>K</b> – tři dekády (x³, ∛x).</li>
      <li><b>S</b> a <b>T</b> – úhly, jejichž sin a tg (×10) jsou na D; <b>L</b> – lineární stupnice mantisy dekadického logaritmu.</li></ul>
      <p>Logaritmy publikoval John Napier (1614), kruhové pravítko popsal William Oughtred (1632). Kotoučová pravítka se vyráběla do 70. let 20. století – například pro letectví (E6B).</p>`,
    rok: () => `<h3>Můj rok</h3>
      <p>Kotouč dělí rok na dny poměrně (1 den = 360°/365 nebo 366). Měsíce mají proto různě velké výseče, roční období začínají v obvyklých dnech (21. 3., 21. 6., 23. 9., 21. 12.) a znamení zvěrokruhu podle tradičních dat. Velikonoce se počítají pro zvolený rok (gregoriánský výpočet), Den matek je druhá květnová neděle.</p>
      <p>Okénko horního kotouče ukáže kolem dne, na který šipku natočíte, svátky a vlastní dny – narozeniny, výlety, Ježíška.</p>`,
    vlastni: () => `<h3>Vlastní volvelle</h3>
      <p>Každá vrstva je kotouč (nebo ukazatel) s libovolným počtem <b>prstenců</b> – mezikruží rozdělených na dílky s textem nebo ikonou (<code>:slunce:</code>, <code>:mesic:</code>, <code>:hvezda:</code>, <code>:srdce:</code>, <code>:list:</code>, <code>:vlocka:</code>, <code>:kvet:</code>, <code>:kapka:</code>, <code>:mrak:</code>, <code>:klic:</code>, <code>:darek:</code>, <code>:stromek:</code>, <code>:vejce:</code>) – a <b>okének</b> (výseč nebo kruh, opakovaně po obvodu). Texty dílků oddělujte středníkem, víc řádků v dílku svislou čarou |.</p>
      <p>Počet dílků vrstvy určuje přichytávání při otáčení. Náhled ukazuje, co je vidět v okénkách.</p>`,
  };
  function html(id) {
    return schemaVrstev() + (TEXTY[id] ? TEXTY[id]() : '') + `
      <h3>Historie volvelle</h3>
      <p>Otočné papírové kotouče jsou staré jako tištěná kniha – i starší. Katalánský filozof <b>Ramon Llull</b> (asi 1232–1316) v díle <i>Ars magna</i> kombinoval otočnými kruhy pojmy a hledal „všechny pravdy“; jeho kotouče se považují za předchůdce kombinatoriky i počítačů. Ve středověkých astronomických rukopisech sloužily volvelle k výpočtu polohy Slunce, Měsíce a data Velikonoc.</p>
      <p>Vrcholem je <b>Astronomicum Caesareum</b> Petra Apiana (Ingolstadt, 1540) věnované Karlu V.: desítky ručně kolorovaných, mnohovrstevných kotoučů s nitěmi a perličkami, jimiž se daly „vytočit“ polohy planet, zatmění i horoskopy. V 19. a 20. století volvelle žily dál jako planisféry, kalkulátory pro fotografy a piloty, kalendáře a šifrovací kotouče – a dodnes v dětských knížkách.</p>
      <p class="info">Tip: tiskněte na papír 160–250 g/m², okénka vyřízněte skalpelem na řezací podložce; pro lepší otáčení vložte mezi vrstvy kroužek z pauzovacího papíru.</p>`;
  }
  koren.VOLV_PRINCIP = { html, schemaVrstev };
})(typeof window !== 'undefined' ? window : globalThis);

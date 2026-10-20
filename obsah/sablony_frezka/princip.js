/* ============================================================
   Šablony pro horní frézku – oddíly „Jak to funguje“, „Postup“ a „Bezpečnost“ (HTML + malá SVG schémata)
   SFPrincip.princip(rezim, V) / postup(rezim, V, N) / bezpecnost() → řetězec HTML
   ============================================================ */
(function (koren) {
  'use strict';
  const cz = (x, d) => koren.SF.cz(x, d == null ? 2 : d);
  const fig = (w, h, obsah, popis) => `<figure class="schema"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${popis}">${obsah}</svg><figcaption>${popis}</figcaption></figure>`;
  const t = (x, y, s, a, vel, c) => `<text x="${x}" y="${y}" font-size="${vel || 10}" text-anchor="${a || 'middle'}" fill="${c || 'currentColor'}">${s}</text>`;

  /** řez: šablona, kroužek, fréza – ofset o */
  function schemaOfset() {
    let s = '<rect x="10" y="120" width="320" height="50" fill="#d9b98a" fill-opacity=".5" stroke="currentColor"/>' + t(60, 150, 'obrobek', 'middle', 10);
    s += '<rect x="10" y="96" width="140" height="24" fill="#5f9e6e" fill-opacity=".5" stroke="currentColor"/>' + t(70, 112, 'šablona', 'middle', 10);
    s += '<rect x="150" y="96" width="34" height="20" fill="#2f62b8" fill-opacity=".55" stroke="currentColor"/>';
    s += '<rect x="158" y="20" width="18" height="128" fill="#d04a00" fill-opacity=".75" stroke="currentColor"/>';
    s += '<path d="M167 14V176" stroke="var(--accent)" stroke-dasharray="6 2 1 2"/>' + t(222, 30, 'osa frézy', 'start', 10);
    s += '<path d="M120 120H330" stroke="none"/><path d="M158 148V120H330" fill="none" stroke="none"/>';
    s += '<path d="M150 82H167M150 78V86M167 78V86" stroke="var(--accent)"/>' + t(140, 76, 'Rk', 'middle', 10, 'var(--accent)');
    s += '<path d="M150 186H158M150 182V190M158 182V190" stroke="var(--accent)"/>' + t(154, 202, 'o', 'middle', 11, 'var(--accent)');
    s += t(250, 100, 'kroužek Ø Dk', 'start', 10) + '<path d="M246 98L186 106" stroke="currentColor" stroke-width=".7"/>';
    s += t(250, 140, 'fréza Ø Df', 'start', 10) + '<path d="M246 138L177 134" stroke="currentColor" stroke-width=".7"/>';
    return fig(340, 210, s, 'Kroužek se opírá o hranu šablony, fréza řeže o o = (Dk − Df) / 2 dál od hrany. Proto je šablona vždy o o větší (otvor) nebo menší (ostrůvek) než výsledný řez.');
  }
  /** roh: kroužek nedosáhne do ostrého rohu */
  function schemaRoh() {
    let s = '<path d="M20 180V20H300" fill="none" stroke="currentColor" stroke-width="2"/>' + t(160, 14, 'hrana otvoru šablony', 'middle', 10);
    s += '<circle cx="56" cy="56" r="36" fill="#2f62b8" fill-opacity=".25" stroke="#2f62b8"/><circle cx="56" cy="56" r="16" fill="#d04a00" fill-opacity=".55" stroke="#d04a00"/>';
    s += '<path d="M20 20L30.5 30.5" stroke="#d01818" stroke-width="2"/>' + t(70, 110, 'kroužek R k', 'start', 10, '#2f62b8');
    s += '<path d="M40 180V56A16 16 0 0 1 56 40H300" fill="none" stroke="#d04a00" stroke-width="1.5" stroke-dasharray="5 3"/>';
    s += t(180, 60, 'řez: roh zaoblený (R ≥ Rf, šablona R ≥ Rk)', 'middle', 10, '#d04a00');
    s += '<path d="M22 22L36 22L22 36Z" fill="#d01818" fill-opacity=".6"/>' + t(80, 150, 'sem kroužek nedosáhne', 'start', 10, '#d01818');
    return fig(320, 190, s, 'Ostrý vnitřní roh šablony: kroužek je kulatý, do rohu nedojede. Nejmenší vnitřní poloměr šablony = poloměr kroužku, nejmenší poloměr výsledné kapsy = poloměr frézy.');
  }
  /** sousledné / nesousledné frézování */
  function schemaSmer() {
    let s = '<rect x="20" y="40" width="140" height="100" fill="#d9b98a" fill-opacity=".45" stroke="currentColor"/>' + t(90, 30, 'vnější obrys dílu', 'middle', 10);
    s += '<path d="M14 34H166V146H14Z" fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-dasharray="6 3"/>';
    s += '<path d="M60 34H110" stroke="var(--accent)" stroke-width="2.4" marker-end=""/><path d="M104 29L114 34L104 39" fill="none" stroke="var(--accent)" stroke-width="2.4"/>';
    s += t(90, 166, 'posuv PROTI směru hodin', 'middle', 10, 'var(--accent)');
    s += '<rect x="200" y="40" width="140" height="100" fill="#d9b98a" fill-opacity=".45" stroke="currentColor"/><rect x="235" y="70" width="70" height="40" fill="var(--bg-elevated,#fff)" stroke="currentColor"/>' + t(270, 30, 'vnitřní otvor / kapsa', 'middle', 10);
    s += '<path d="M241 76H299V104H241Z" fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-dasharray="6 3"/>';
    s += '<path d="M290 76H250" stroke="var(--accent)" stroke-width="2.4"/><path d="M256 71L246 76L256 81" fill="none" stroke="var(--accent)" stroke-width="2.4"/>';
    s += t(270, 166, 'posuv PO směru hodin', 'middle', 10, 'var(--accent)');
    return fig(360, 176, s, 'Při pohledu shora se fréza točí po směru hodin. Nesousledně (proti otáčení) = vnější obrys proti směru hodin, otvor po směru hodin. Fréza se pak nechytá a nevytrhává se z ruky.');
  }
  /** motýlek – pár šablon */
  function schemaMotylek() {
    const m = (dx, k, c) => `<path d="M${dx + 10} ${60 - 25 * k}L${dx + 60} ${60 - 9 * k}L${dx + 110} ${60 - 25 * k}V${60 + 25 * k}L${dx + 60} ${60 + 9 * k}L${dx + 10} ${60 + 25 * k}Z" fill="${c}" stroke="currentColor" stroke-linejoin="round"/>`;
    let s = '<rect x="0" y="10" width="125" height="100" fill="#5f9e6e" fill-opacity=".45" stroke="currentColor"/>' + m(2, 1.3, 'var(--bg-elevated,#fff)') + t(62, 126, 'A: otvor = tvar ⊕ o', 'middle', 10);
    s += m(170, 0.75, '#5f9e6e') + t(230, 126, 'B: ostrůvek = tvar ⊖ o', 'middle', 10);
    return fig(300, 134, s, 'Kapsa se frézuje uvnitř otvoru A, vložka obíháním ostrůvku B. Ostré rohy se při tom zaoblí různě – proto se tvar předem zaoblí tak, aby oba řezy vyšly stejně.');
  }

  function princip(rezim, V) {
    let h = '<h3>Kopírovací kroužek a ofset</h3>';
    h += '<p>Kopírovací kroužek (guide bushing, template guide) se přišroubuje do základny frézky a fréza prochází jeho středem. Kroužek jede po hraně šablony, fréza řeže <b>o ofset o = (Ø kroužku − Ø frézy) / 2</b> dál. ';
    h += `S kroužkem Ø${cz(V.Dv)} a frézou Ø${cz(V.Df)} je o = <b>${cz(V.o, 3)} mm</b>.</p>`;
    h += schemaOfset();
    h += '<ul><li><b>Vnitřní kopírování</b> (otvor, kapsa, výřez): kroužek jede uvnitř otvoru šablony → <b>otvor šablony = tvar zvětšený o o</b>.</li>';
    h += '<li><b>Vnější kopírování</b> (obrys dílu): kroužek obíhá šablonu → <b>šablona = tvar zmenšený o o</b>.</li>';
    h += '<li><b>Fréza s ložiskem</b> (pattern / flush-trim bit): ložisko stejného průměru jako břity → o = 0, šablona = tvar. Menší ložisko (polodrážková fréza) dá záporný ofset.</li></ul>';
    h += '<p>Ofset není „posun“: oblouky se mění soustředně (poloměr ± o), rovné hrany se posunou rovnoběžně a ostré rohy se při zvětšení zakulatí poloměrem o. Elipsa se po ofsetu už elipsou nestane – je to rovnoběžná křivka. Stránka proto počítá ofset přesně pro přímky, oblouky a kružnice (DXF obsahuje skutečné oblouky) a obecné tvary (text, SVG) přes polygonový ofset s kulatým spojem s tolerancí 0,002 mm. Výsledný řez se pak <b>znovu nasimuluje</b> z hotové šablony (dráha středu kroužku a obálka frézy) a porovná se zadaným tvarem Hausdorffovou vzdáleností.</p>';
    h += '<h3>Nejmenší poloměry</h3>';
    h += `<p>Kroužek je kulatý, takže do vnitřního rohu šablony ostřejšího než jeho poloměr (${cz(V.Rv)} mm) nedojede. Výsledek: kapsa má rohy nejméně s <b>poloměrem frézy</b> (${cz(V.Rf)} mm), a výstupky do kapsy (vnitřní kouty otvoru) nejméně s poloměrem o. Při vnějším kopírování naopak vyjdou vnější rohy dílu zaoblené nejméně o, kouty nejméně poloměrem frézy. Taková místa náhled zvýrazní červeně a vypíše varování.</p>`;
    h += schemaRoh();
    if (rezim === 'motylek') {
      h += '<h3>Motýlek: pár šablon s kompenzací</h3>';
      h += '<p>Kapsa (vnitřní kopírování) má rohy konců zaoblené poloměrem frézy a pas zaoblený poloměrem o. Vložka (vnější kopírování) je má obráceně: konce s poloměrem o, pas s poloměrem frézy. Kdyby měl motýlek ostré rohy, vložka by do kapsy nesedla. Stránka proto <b>tvar předem zaoblí</b>: rohy konců na max(Rf, o<sub>vložky</sub> + spára), pas na max(o<sub>kapsy</sub>, Rf − spára). Pak oba řezy přesně odpovídají tvaru a vložka je menší přesně o zadanou spáru na lepidlo. Lze použít i dva různé kroužky (inlay sada) – pak stačí jeden tvar.</p>';
      h += schemaMotylek();
    }
    if (rezim === 'rameno') {
      h += '<h3>Kruhové rameno</h3>';
      h += '<p>Rameno nahradí základovou desku frézky (šrouby do stejných závitů). Čep v otvoru ramene se zapíchne do středu kruhu. <b>Kotouč</b> (díl uvnitř): poloměr = vzdálenost čep–osa frézy − Rf. <b>Kruhový otvor</b> (díl vně): poloměr = vzdálenost + Rf. Stupnice je pro zvolený případ v celých číslech; druhý případ = číslo ± Ø frézy. Při jemném kroku se otvory pro čep střídají ve více řadách – vzdálenost od osy frézy zůstává přesná (přepona).</p>';
    }
    if (rezim === 'tvoditko') {
      h += '<h3>Vodítko na drážky</h3>';
      h += '<p>Když základna frézky jede po rovném vodítku, je osa frézy ve vzdálenosti „osa → hrana základny“ (u kulaté základny = její poloměr; změřte – základny nebývají přesně souosé, otáčejte frézkou stále stejně). Líc vodítka proto leží <b>(odstup − Rf)</b> od bližší hrany drážky. Širší drážka = druhý průchod s distanční lištou tloušťky (šířka drážky − Ø frézy). Příložník (head) je napříč a první průchod do něj prořízne značku, kde přesně drážka bude.</p>';
      h += '<p>Štěrbinová šablona pro kroužek má štěrbinu široku <b>drážka + 2 × o</b>; kroužek jede po obou stranách štěrbiny, takže šířka drážky je dána šablonou a nezávisí na základně.</p>';
    }
    if (rezim === 'text') h += '<h3>Písmena</h3><p>Písmena z běžného písma mají ostré rohy a tenké tahy – s kroužkem vyjdou zaoblená a tahy užší než fréza zmizí. Vhodná jsou tučná bezpatková nebo šablonová písma od výšky ~5× Ø frézy. Uzavřené vnitřky písmen (O, A, B, D…) jsou v šabloně volné ostrůvky – šablonové písmo (Saira Stencil One) je má přerušené můstky.</p>';
    if (rezim === 'svg') h += '<h3>Import SVG</h3><p>Čtou se prvky path, rect, circle, ellipse, polygon a polyline včetně transformací skupin; křivky se zploští s tolerancí 0,005 mm. Vyplněné cesty se sčítají pravidlem nonzero (nebo podle fill-rule), cesty bez výplně sudé–liché. Texty v SVG převeďte v editoru na křivky.</p>';
    if (rezim === 'pant') h += '<h3>Pant a zámek</h3><p>Šablona leží na hraně dveří, dorazy zespodu obepínají líc (a rub) – kapsa je tak vždy ve stejné vzdálenosti od líce. Kapsa pantu je otevřená k líci (otvor šablony přesahuje přes hranu), kapsa zámku je uprostřed tloušťky. Rysky na okrajích šablony přiložte k tužkovým značkám polohy pantu.</p>';
    if (rezim === 'magnety') h += '<h3>Magnety</h3><p>Kapsa = Ø magnetu + vůle. Na neodymové magnety lepte epoxidem nebo CA; hloubku volte o 0,1–0,3 mm větší, aby magnet nepřečníval. Pro jednotlivé kapsy je Forstnerův vrták rychlejší, šablona se vyplatí u série.</p>';
    return h;
  }

  function postup(rezim, V, N) {
    let h = '<h3>Výroba šablony</h3><ol>';
    h += '<li>Materiál: MDF nebo bříza 6–12 mm (pro kroužek musí být šablona silnější než nákrček kroužku), u menších šablon i plexi nebo 3D tisk (PETG, 100 % výplň okrajů, ≥ 4 perimetry).</li>';
    h += '<li>Laser / CNC: soubor DXF nebo SVG, vrstva <b>REZ</b>. CNC frézou ≤ Ø6 – vnitřní rohy otvoru šablony mohou mít poloměr až poloměr kroužku, takže nevadí.</li>';
    h += '<li>Ručně: PDF 1:1 nalepte na desku, vyřízněte vedle čáry (přímočará pila, vrtáky v rozích), hranu dobruste přesně na čáru. Hrana šablony musí být hladká a kolmá – každá nerovnost se přenese.</li>';
    h += '<li>Kontrola: zkušební řez do odpadu, změřte – rozdíl oproti zadání = chyba ofsetu (zkontrolujte skutečný Ø kroužku a frézy posuvkou).</li></ol>';
    h += '<h3>Frézování</h3><ol>';
    h += '<li>Vystřeďte kroužek (středicí trn). Necentrický kroužek posune řez podle toho, jak frézku otočíte.</li>';
    h += '<li>Šablonu upněte k obrobku (oboustranná páska, svěrky mimo dráhu základny, vruty do odpadu) a obrobek ke stolu.</li>';
    h += `<li>Hloubku dělte na průchody po ≤ ${cz(N.tris, 1)} mm. Poslední průchod tenký (0,5–1 mm) – čistá hrana.</li>`;
    h += '<li>Frézku zapněte nad šablonou, zanořte (ponorná frézka) nebo začněte v otvoru, kroužek celou dobu přitlačený k hraně. Posuv plynulý, nezastavovat na místě (spálená místa).</li>';
    h += '<li>U průchozích výřezů podložte obrobek obětní deskou a odřezávaný kus zajistěte, aby nespadl a nesevřel frézu.</li></ol>';
    if (rezim === 'motylek') h += '<h3>Motýlek</h3><ol><li>Kapsa: šablona A, vnitřní kopírování, hloubka podle tabulky.</li><li>Vložka: šablona B na prkénku tlustším o 1–2 mm, obíhat po obvodu, pak vložku odříznout na pásové pile.</li><li>Zkusit nasucho, zalepit, po zaschnutí zarovnat hoblíkem / bruskou.</li></ol>';
    if (rezim === 'rameno') h += '<h3>Kruhové rameno</h3><ol><li>Do středu kruhu vyvrtejte otvor pro čep (neprůchozí u viditelných ploch).</li><li>Frézujte po vrstvách, kotouč na konci podepřete / připevněte k podložce oboustrannou páskou, ať se poslední průchod neutrhne.</li><li>Posuv: kotouč (vnější obrys) proti směru hodin, otvor po směru hodin.</li></ol>';
    return h;
  }

  function bezpecnost() {
    let h = '<h3>Bezpečnost u horní frézky</h3><ul>';
    h += '<li><b>Směr posuvu – nesousledné frézování</b> (conventional cut): veďte frézu proti směru jejího otáčení. Fréza se otáčí (shora) po směru hodin, takže <b>vnější obrys objíždějte proti směru hodin, otvor po směru hodin</b>. Sousledné frézování (climb cut) frézu táhne a může ji vytrhnout z ruky – nanejvýš na tenký dočišťovací průchod a s pevným úchopem.</li>';
    h += '<li><b>Hloubka třísky na průchod</b>: v měkkém dřevě a MDF orientačně ≤ Ø frézy, v tvrdém dřevě ≤ ½ Ø; drážkovací fréza Ø6 raději po 2–3 mm. Přetížení = spálené hrany, ulomená fréza, cukání.</li>';
    h += '<li><b>Upnutí</b>: obrobek i šablona musí být pevně upnuté, nikdy nedržet díl v ruce. Svěrky mimo dráhu základny. Malé díly frézujte na větším kusu a odřízněte až nakonec.</li>';
    h += '<li>Stopka frézy zasunutá v kleštině aspoň na ¾ délky stopky, ne až na dno. Otáčky podle průměru (velké frézy pomaleji).</li>';
    h += '<li>Kroužek a fréza se nesmí dotýkat – před zapnutím otočte vřetenem rukou. Kovový kroužek, žádný tištěný v kontaktu s frézou.</li>';
    h += '<li>Brýle, chrániče sluchu, respirátor (MDF prach), odsávání. Volné rukávy a rukavice ne.</li>';
    h += '<li>Frézku zapínejte a vypínejte nad šablonou, mimo záběr; počkejte na zastavení, než ji zvednete.</li>';
    h += '<li>Přípravky z 3D tisku (PETG/PLA) jsou šablony pro kroužek – nikdy nesmí být v dosahu břitů. Čep kruhového ramene a šrouby kovové.</li></ul>';
    h += schemaSmer();
    return h;
  }
  koren.SFPrincip = { princip, postup, bezpecnost };
})(typeof window !== 'undefined' ? window : globalThis);

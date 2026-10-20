/* ============================================================
   Přípravky pro pilu a vrtačku – „Jak to funguje“ a postup výroby (HTML texty, bez DOM)
   ============================================================ */
(function (koren) {
  'use strict';
  const CARA = 'currentColor', CERV = '#c0392b', MOD = '#2e6fb5', DR = '#d9a66a';
  const svg = (w, h, s) => `<figure class="schema"><svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif" role="img">${s}</svg>`;
  const fig = (t) => `<figcaption>${t}</figcaption></figure>`;

  const SCHEMA = {
    petRezu: () => svg(360, 150,
      [0, 1, 2, 3].map((i) => { const x = 20 + i * 82; return `<rect x="${x}" y="30" width="62" height="62" fill="${DR}" stroke="${CARA}"/><text x="${x + 31}" y="66" font-size="12" text-anchor="middle" fill="${CARA}">řez ${i + 1}</text><path d="M${x + 66} 30 V92" stroke="${CERV}" stroke-width="2"/>`; }).join('') +
      `<path d="M30 112 h300" stroke="${CARA}" stroke-width="3"/><text x="180" y="128" font-size="11" text-anchor="middle" fill="${CARA}">přední pravítko – po každém řezu otočit díl o 90° (řezaná hrana k pravítku)</text>` +
      `<text x="180" y="18" font-size="11" text-anchor="middle" fill="${MOD}">5. řez odřízne proužek z 1. hrany – jeho klínovitost = 4 × chyba pravítka</text>`) + fig('Metoda 5 řezů: chyba se při čtyřech otočeních sečte čtyřikrát, proto ji lze změřit obyčejným posuvným měřítkem.'),
    sane: () => svg(360, 150,
      `<rect x="20" y="20" width="320" height="110" fill="${DR}" stroke="${CARA}"/><rect x="20" y="104" width="320" height="16" fill="#b9874f" stroke="${CARA}"/><rect x="20" y="20" width="320" height="10" fill="#b9874f" stroke="${CARA}"/>` +
      `<rect x="170" y="120" width="34" height="18" fill="none" stroke="${CERV}" stroke-width="2"/><path d="M188 10 V145" stroke="${CERV}" stroke-dasharray="6 3"/>` +
      `<path d="M90 20 V130 M280 20 V130" stroke="${CARA}" stroke-dasharray="3 3"/><text x="94" y="70" font-size="11" fill="${CARA}">lišta</text><text x="284" y="70" font-size="11" fill="${CARA}">lišta</text>` +
      `<text x="210" y="134" font-size="11" fill="${CERV}">bezpečnostní blok</text><text x="24" y="100" font-size="11" fill="${CARA}">přední pravítko (referenční, seřizuje se)</text>`) + fig('Saně jedou v drážkách stolu; přední pravítko je kolmé k řezu a nese díl, zadní jen drží saně pohromadě.'),
    voditko: () => svg(360, 110,
      `<rect x="10" y="70" width="340" height="24" fill="${DR}" stroke="${CARA}"/><rect x="30" y="58" width="200" height="12" fill="#c9b18f" stroke="${CARA}"/><rect x="30" y="40" width="70" height="18" fill="#b9874f" stroke="${CARA}"/>` +
      `<rect x="100" y="52" width="160" height="6" fill="#888" stroke="${CARA}"/><rect x="230" y="20" width="4" height="60" fill="${CERV}"/>` +
      `<path d="M100 32 H230" stroke="${MOD}"/><text x="165" y="28" font-size="11" fill="${MOD}" text-anchor="middle">offset</text><text x="240" y="40" font-size="11" fill="${CERV}">kotouč</text>`) + fig('Základna je nejdřív širší; první řez pilou ji zařízne přesně na linii řezu. Hrana vodítka pak = hrana dílu.'),
  };

  const P = {
    sane: {
      princip: `${SCHEMA.sane()}<p>Úhlové saně (crosscut sled) nesou díl přes kotouč na velké základně vedené <b>dvěma lištami v drážkách stolu</b> (miter slot). Přesnost dává jen <b>přední pravítko</b> – je přišroubované jedním šroubem jako čepem u kotouče a druhým stavěcím šroubem na vzdáleném konci, kterým se dorovná do pravého úhlu.</p>
      <p>Kotouč vyjíždí nad základnu o tloušťku dílu + 5 mm. Na konci řezu zajede do předního pravítka – proto je pravítko silné a za ním je <b>bezpečnostní blok</b>, který kotouč při výjezdu kryje. Zadní pravítko musí být tak vysoké, aby nad prořezem zůstalo aspoň 20 mm materiálu.</p>
      ${SCHEMA.petRezu()}<p><b>Metoda 5 řezů</b>: čtvercový kus desky (≈ 400–500 mm) ořízněte postupně na všech čtyřech stranách, po každém řezu ho otočte o 90° po směru hodinových ručiček (při pohledu shora), takže čerstvě řezaná hrana jde k pravítku. Pátým řezem odřízněte z první hrany proužek ~20 mm. Změřte jeho šířku u pravítka (A) a na druhém konci (B), vzdálenost míst měření L. Chyba jednoho řezu je <b>ε = (A − B) / (4·L)</b>; konec pravítka u stavěcího šroubu (rameno F od čepu) posuňte o <b>F·ε</b>. Je-li A &gt; B, posuňte vzdálený konec pravítka <b>od sebe</b> (dozadu), je-li A &lt; B, k sobě.</p>
      <p>Lišty jsou o vůli užší než drážka (typicky 0,1–0,3 mm na šířce) a 1 mm nižší, aby saně ležely na stole, ne na dnech drážek.</p>`,
      postup: `<ol><li>Změřte drážky (šířka, hloubka, vzdálenost os od kotouče) a zadejte je – uvedené hodnoty jsou jen typické (3/4″ × 3/8″).</li>
      <li>Nařežte díly podle řezného seznamu; přední pravítko slepte ze dvou vrstev a zarovnejte spodní a pracovní hranu.</li>
      <li>Lišty (tisk nebo tvrdé dřevo) vložte do drážek, podložte je pod úroveň stolu (mince) a na ně položte základnu s tenkou oboustrannou páskou, rovnoběžně s kotoučem. Opatrně zvedněte, přišroubujte zespodu.</li>
      <li>Vyzkoušejte chod (vosk); přebroušením boků lišt odstraňte drhnutí. Pak prvním průjezdem prořízněte základnu.</li>
      <li>Přední pravítko přišroubujte čepem u kotouče, druhý konec srovnejte úhelníkem a zajistěte svěrkou. Proveďte 5 řezů, zadejte A, B, L a posuňte konec o vypočtenou hodnotu. Opakujte, dokud není chyba pod 0,05 mm/m; pak zajistěte dalšími vruty.</li>
      <li>Nasaďte zadní pravítko a bezpečnostní blok, pod stůl doraz pojezdu.</li></ol>`,
    },
    pokos: {
      princip: `<p>Rámové pokosy 45° se řežou na saních se <b>dvěma pravítky skloněnými ±45°</b> k řezu. Protože svírají přesně 90°, doplňují se chyby obou stran: levý a pravý konec lišty sice nemusí mít přesně 45°, ale <b>roh je vždy pravý</b>, pokud je pravý úhel mezi pravítky.</p>
      <p>Kontrola rámem: z jedné lišty se nařežou 4 díly, tři rohy se sesadí a změří se spára posledního rohu g na délce pokosu m (= šířka lišty × √2). Chyba se nasčítá z osmi řezů: <b>δ = atan(g / m) / 8</b> na řez, úhel mezi pravítky se liší od 90° o 2δ. Spára na vnější straně (u špičky) znamená, že rohy jsou větší než 90° → zmenšit úhel mezi pravítky.</p>`,
      postup: `<ol><li>Základnu s lištami vyrobte stejně jako u úhlových saní a prořízněte ji.</li><li>Na základnu narýsujte přesně 90° úhelníkem (nebo trojúhelníkem 3-4-5) vrcholem na prořezu.</li>
      <li>Pravítka přišroubujte zespodu, u každého jeden otvor převrtejte pro seřízení.</li><li>Zkušební rám, změřit spáru, zadat, posunout konec jednoho pravítka o vypočtenou hodnotu.</li><li>Nasaďte zadní a přední příčku (kryt výjezdu kotouče).</li></ol>`,
    },
    cepy: {
      princip: `<p>Šablona na čepy jezdí po <b>podélném pravítku</b> pily. Díl stojí svisle na čele a je upnutý; kotouč vysunutý na délku čepu odřízne líc. Vzdálenost čela šablony od boku kotouče je <b>(t<sub>díl</sub> + t<sub>čep</sub>) / 2</b>: po prvním řezu se díl otočí druhou plochou k čelu a druhý řez se stejným nastavením dá čep přesně uprostřed.</p>
      <p>Odpad padá na vnější stranu kotouče – nesevře se mezi kotoučem a pravítkem. Osazení se pak řeže příčně na saních s dorazem.</p>`,
      postup: `<ol><li>Čelo a bočnici přišroubujte k můstku tak, aby šablona šla po pravítku s vůlí ~0,5 mm (vyzkoušejte s papírem).</li><li>Svislý doraz nastavte úhelníkem přesně kolmo ke stolu.</li><li>Zkušební kus: řez, otočit, řez; tloušťku čepu doladí posun podélného pravítka o polovinu chyby.</li></ol>`,
    },
    hrebinek: {
      princip: `<p>Hřebínková přítlačka (featherboard) tlačí díl k pravítku nebo ke stolu pružnými prsty. Prsty jsou <b>skloněné ve směru posuvu</b>: díl jde dopředu, při pokusu o zpětný pohyb se prsty zapřou – omezují zpětný vrh.</p>
      <p>Upevnění: <b>T-lišta</b> se při utažení zapře o hrany T-drážky. Pro <b>obdélníkovou drážku</b> je lišta podélně prořízlá a šroub se zápustnou hlavou zespodu ji kuželem roztáhne – přidrží se třením o boky drážky.</p>`,
      postup: `<ol><li>Tiskněte z PETG naplocho, 3–4 perimetry, aby prsty byly plné.</li><li>Šrouby M6 vložte do lišty zespodu, nasaďte přítlačku, podložky a knoflíky.</li><li>Umístěte před kotouč, díl vsuňte a přítlačku přisuňte tak, aby se prsty prohnuly o 2–3 mm; utáhněte.</li></ol>`,
    },
    vlozka: {
      princip: `<p><b>Nulová vložka</b> (zero-clearance insert) má prořez přesně na šířku kotouče – podpírá vlákna u řezu (méně vytrhávání) a do mezery nepropadnou tenké odřezky. Tvar se kopíruje z původní vložky; šablona se frézuje frézou s ložiskem, nebo s kopírovacím kroužkem – pak musí být šablona menší o (Ø kroužku − Ø frézy) / 2.</p>`,
      postup: `<ol><li>Obrys změřte nebo obkreslete z původní vložky, zadejte rozměry a polohu kotouče.</li><li>Vytiskněte šablonu 1:1, nalepte na MDF, vyřízněte s přídavkem a přebruste na čáru – každá vada se okopíruje.</li><li>Polotovar vložky připevněte k šabloně oboustrannou páskou a ofrézujte.</li><li>Vyvrtejte otvory, vyřízněte závity pro stavěcí šrouby, vyřízněte startovací drážku.</li><li>Vložku vyrovnejte se stolem, přidržte ji deskou upnutou přes ni a pomalu zvedněte běžící kotouč skrz.</li></ol>`,
    },
    voditko: {
      princip: `${SCHEMA.voditko()}<p>Vodítko je <b>tenká základna</b> s nalepeným <b>pravítkem</b>. Patka pily jede podél pravítka; kotouč je od hrany patky vzdálen o <b>offset</b>. Základna se vyrobí širší a první řez pilou ji ořízne – hrana základny je pak přesně linie řezu a vodítko se přikládá přímo na rysku.</p>
      <p>Offset se měří posuvným měřítkem od hrany patky k boku zubu (zub vyhnutý k patce) vpředu i vzadu. Rozdíl obou měření ukazuje, zda je kotouč rovnoběžný s patkou – nerovnoběžný kotouč řez pálí a zvyšuje riziko zpětného vrhu.</p>`,
      postup: `<ol><li>Pravítko nařežte z tovární hrany překližky (nejrovnější hrana jde k pile).</li><li>Na základnu naneste lepidlo, položte pravítko k vnější hraně, přišroubujte po 150 mm (hlavy zapustit).</li><li>Delší vodítko: spoje pravítka jsou přesazené proti spojům základny – každý spoj překrývá druhá vrstva.</li><li>Vodítko upněte na odpadní desku a pilou s nastavenou hloubkou ořízněte přebytek základny.</li><li>Nasaďte koncovky, spodek případně polepte protiskluzovou páskou.</li></ol>`,
    },
    doraz: {
      princip: `<p>Doraz se nasadí shora přes pravítko pily (fence) a zajistí šroubem M6 tlačícím na zadní stranu pravítka. Čelní plocha je doraz pro konec dílu. Zkosení v rohu u stolu a pravítka tvoří <b>drážku na prach</b> – piliny, které se tam usadí, neodsunou díl a délka zůstává stejná.</p>`,
      postup: `<ol><li>Tiskněte profilem na podložce; čelní plocha leží na podložce a je rovná.</li><li>Matici M6 zatlačte do šestihranné kapsy (případně zažehlete).</li><li>Délku nastavte měřením od boku zubů nebo zkušebním řezem a zajistěte šroubem.</li></ol>`,
    },
    posunovac: {
      princip: `<p>Posunovač nahrazuje ruku v nebezpečné zóně u kotouče. <b>Tyč</b> botkou přidržuje díl na stole a patkou ho tlačí vpřed, <b>blok</b> zase tlačí širší díly svou plochou. Patka musí být nižší než nejtenčí díl, aby nezachytila stůl.</p>`,
      postup: `<ol><li>Tyč vyřízněte z 12–18mm překližky podle DXF/PDF 1:1, hrany zaoblete, rukojeť přebruste.</li><li>Blok tiskněte profilem na podložce; spodek polepte gumou.</li><li>Naříznutou patku obnovte nebo celý posunovač vyměňte.</li></ol>`,
    },
    klin: {
      princip: `<p>Šikmé díry na stojanové vrtačce se vrtají s dílem podloženým v úhlu. <b>Pevný klín</b> má výšku h = t<sub>min</sub> + L·tan α. <b>Sklopná deska</b> se otáčí na klavírovém závěsu; šroub v držáku pod deskou jede v obloukové drážce bočnice se středem v ose závěsu, takže úhel se nastaví podle stupnice a zajistí křídlovou maticí.</p>`,
      postup: `<ol><li>Klín tiskněte profilem na podložce – šikmá plocha je pak hladká a úhel přesný.</li><li>Sklopnou desku: šablonu bočnice 1:1 nalepte, drážku vyvrtejte na koncích a vyřízněte lupenkovou pilou, stupnici přeneste.</li><li>Úhel ověřte digitálním úhloměrem na desce proti stolu vrtačky.</li></ol>`,
    },
    vblok: {
      princip: `<p>Kulatina v drážce tvaru V se dotýká obou boků, takže její osa leží vždy v ose V – vrták míří přesně do středu bez ohledu na průměr. Osa je nad vrcholem V ve výšce <b>r / sin(α/2)</b>. Odlehčovací drážka ve vrcholu dává místo pro výjezd vrtáku a třísky.</p>`,
      postup: `<ol><li>Tiskněte profilem na podložce (boky V jsou svislé stěny).</li><li>Vrták zasuňte do drážky a V-blok upněte ke stolu tak, aby hrot mířil do osy V.</li><li>Kulatinu upněte do V (svěrka, pásek) a navrtejte.</li></ol>`,
    },
    kolik: {
      princip: `<p>Přípravek obepne desku dvěma bočnicemi, otvory leží v polovině tloušťky. Doraz na boku určuje vzdálenost od referenční hrany – oba spojované díly se vrtají od stejné hrany, takže díry na sebe přesně sedí. Pro sériovou práci nalisujte ocelová vrtací pouzdra, plast se vrtákem rychle vytluče.</p>`,
      postup: `<ol><li>Tiskněte vedením na podložce, 100 % výplň kolem otvorů (nebo 5 perimetrů).</li><li>Nasaďte na čelo desky, doraz k referenční hraně, přitáhněte svěrkou.</li><li>Na vrták nasaďte hloubkový kroužek (hloubka + výška vedení) a vrtejte.</li></ol>`,
    },
  };
  const API = { princip: (r) => (P[r] || {}).princip || '', postup: (r) => (P[r] || {}).postup || '' };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.PPPrincip = API;
})(typeof window !== 'undefined' ? window : globalThis);

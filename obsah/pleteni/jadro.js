/* Pletení a háčkování – jádro bez DOM (test: _test/pleteni_test.js).
   Přepočet vzorku, rovnoměrné přidávání/ubírání, spotřeba příze, tabulky jehlic a přízí,
   počítadla řad, schéma vzoru (mřížka symbolů + barvy) a jeho export do SVG, migrace uložených dat. */
(function () {
  'use strict';

  const VERZE = 1;
  const KLIC = 'webapp_pleteni';
  /* Orientační tabulky (spotřeby, návin, rozsahy jehlic) – podle běžných tabulek výrobců a Craft Yarn Council, stav 11/2026. */
  const PARAMETRY = { rok: 2026, stav: '11/2026', rezerva: 0.1 };

  const zaokr = (x, d = 1) => Math.round(x * 10 ** d) / 10 ** d;
  const kladne = x => Number.isFinite(x) && x > 0;

  /* ---------- přepočet vzorku ---------- */

  /* Kolik oček a řad potřebuji na rozměr (cm) při mém vzorku (oček/řad na 10 cm). */
  function prepocetVzorku(o) {
    const r = {};
    if (kladne(o.ocka) && kladne(o.sirka)) r.ocka = Math.round(o.sirka * o.ocka / 10);
    if (kladne(o.rady) && kladne(o.vyska)) r.rady = Math.round(o.vyska * o.rady / 10);
    return r;
  }

  /* Nejbližší celé číslo tvaru k·nasobek + plus (raport vzoru, např. 4k+2). */
  function naNasobek(x, nasobek = 1, plus = 0) {
    nasobek = Math.max(1, Math.round(nasobek) || 1); plus = Math.round(plus) || 0;
    return Math.max(nasobek + plus, Math.round((x - plus) / nasobek) * nasobek + plus);
  }

  /* Úprava čísla z návodu na můj vzorek: počet v návodu × (moje hustota / hustota návodu). */
  function upravaNavodu(pocet, hustotaNavod, hustotaMoje, nasobek = 1, plus = 0) {
    if (!kladne(pocet) || !kladne(hustotaNavod) || !kladne(hustotaMoje)) return null;
    const presne = pocet * hustotaMoje / hustotaNavod;
    const novy = naNasobek(presne, nasobek, plus);
    return {
      presne: zaokr(presne, 2), pocet: novy,
      cmNavod: zaokr(pocet / hustotaNavod * 10),        // rozměr, který návod zamýšlí
      cmBezUpravy: zaokr(pocet / hustotaMoje * 10),     // co vyjde mně, když upletu číslo z návodu
      cmUprava: zaokr(novy / hustotaMoje * 10)          // co vyjde mně s upraveným číslem
    };
  }

  /* ---------- rovnoměrné přidávání / ubírání ---------- */

  /* Rozdělí n kusů do g mezer co nejrovnoměrněji (větší a menší se střídají). */
  function rozdelRovne(n, g) {
    const r = [];
    for (let i = 0; i < g; i++) r.push(Math.floor((i + 1) * n / g) - Math.floor(i * n / g));
    return r;
  }

  /* stavajici = oček na jehlici, pridat > 0 přidat, < 0 ubrat (2 spolu). Plošně jsou kraje bez přidání
     (mezer je o 1 víc), kruhově se opakuje dokola. Vrací kroky [{o:n},{z:'+'|'-'}…], text a „každé X. očko“. */
  function rozdelPridavani(stavajici, pridat, kruhove) {
    stavajici = Math.round(stavajici); pridat = Math.round(pridat);
    if (!(stavajici > 0) || !pridat) return null;
    const ubrat = pridat < 0, n = Math.abs(pridat);
    const volna = ubrat ? stavajici - 2 * n : stavajici;   // očka mimo „2 spolu“
    if (volna < 0) return { chyba: 'Nelze ubrat víc než polovinu oček.' };
    const mezery = rozdelRovne(volna, kruhove ? n : n + 1);
    const kroky = [];
    mezery.forEach((m, i) => {
      if (m) kroky.push({ o: m });
      if (i < n) kroky.push({ z: ubrat ? '-' : '+' });
    });
    const vysledek = stavajici + pridat;
    // „každé X. a Y. očko“: u ubírání se do čísla počítá i druhé očko z 2 spolu
    const vnitrni = kruhove ? mezery : mezery.slice(0, n);
    const kazde = [...new Set(vnitrni.map(m => m + (ubrat ? 2 : 0)))].sort((a, b) => a - b);
    return { kroky, mezery, vysledek, kazde, kruhove: !!kruhove, ubrat, text: textKroku(kroky, ubrat) };
  }

  /* Zhuštěný text: opakující se dvojice (n oček + přidat) sloučí do „(n o, +1) ×k“. */
  function textKroku(kroky, ubrat) {
    const akce = ubrat ? '2 spolu' : 'přidat 1';
    const casti = [];
    for (let i = 0; i < kroky.length;) {
      const k = kroky[i];
      if (k.o != null && kroky[i + 1] && kroky[i + 1].z) {
        const n = k.o; let krat = 0;
        while (kroky[i] && kroky[i].o === n && kroky[i + 1] && kroky[i + 1].z) { krat++; i += 2; }
        casti.push(krat > 1 ? `(${n} o, ${akce}) ×${krat}` : `${n} o, ${akce}`);
      } else if (k.z) {
        let krat = 0;
        while (kroky[i] && kroky[i].z) { krat++; i++; }
        casti.push(krat > 1 ? `(${akce}) ×${krat}` : akce);
      } else { casti.push(`${k.o} o`); i++; }
    }
    return casti.join(', ');
  }

  /* Rozložení přidávání do řad: kolikrat× během rady řad → „každou a. řadu b×, každou (a+1). řadu c×“. */
  function rozdelVRadach(rady, kolikrat) {
    rady = Math.round(rady); kolikrat = Math.round(kolikrat);
    if (!(rady > 0) || !(kolikrat > 0)) return null;
    if (kolikrat > rady) return { chyba: 'Víc přidání než řad – přidávejte v řadě vícekrát.' };
    const a = Math.floor(rady / kolikrat), vic = rady % kolikrat;
    const intervaly = [];
    if (kolikrat - vic) intervaly.push({ kazdou: a, krat: kolikrat - vic });
    if (vic) intervaly.push({ kazdou: a + 1, krat: vic });
    return { intervaly, text: intervaly.map(x => `${x.krat}× každou ${x.kazdou}. řadu`).join(' a ') };
  }

  /* ---------- příze ---------- */

  /* Kategorie podle Craft Yarn Council (0–7). navin = typický návin m/50 g, jehlice/hacek mm, vzorek = oček na 10 cm. */
  const PRIZE = [
    { id: 'lace', cyc: 0, nazev: 'Lace (krajková)', wpi: '30+', navin: [300, 500], jehlice: [1.5, 2.25], hacek: [1.4, 2.25], vzorek: [33, 40] },
    { id: 'fingering', cyc: 1, nazev: 'Fingering / sock (ponožková)', wpi: '19–22', navin: [175, 230], jehlice: [2.25, 3.25], hacek: [2.25, 3.5], vzorek: [27, 32] },
    { id: 'sport', cyc: 2, nazev: 'Sport (baby)', wpi: '15–18', navin: [140, 170], jehlice: [3.25, 3.75], hacek: [3.5, 4.5], vzorek: [23, 26] },
    { id: 'dk', cyc: 3, nazev: 'DK (light worsted)', wpi: '12–14', navin: [110, 135], jehlice: [3.75, 4.5], hacek: [4.5, 5.5], vzorek: [21, 24] },
    { id: 'worsted', cyc: 4, nazev: 'Worsted', wpi: '9–11', navin: [85, 105], jehlice: [4.5, 5.5], hacek: [5.5, 6.5], vzorek: [16, 20] },
    { id: 'aran', cyc: 4, nazev: 'Aran', wpi: '8–9', navin: [75, 90], jehlice: [5, 5.5], hacek: [5.5, 6.5], vzorek: [16, 18] },
    { id: 'bulky', cyc: 5, nazev: 'Bulky / chunky', wpi: '6–8', navin: [45, 70], jehlice: [5.5, 8], hacek: [6.5, 9], vzorek: [12, 15] },
    { id: 'superbulky', cyc: 6, nazev: 'Super bulky', wpi: '5–6', navin: [25, 45], jehlice: [8, 12.75], hacek: [9, 15], vzorek: [7, 11] },
    { id: 'jumbo', cyc: 7, nazev: 'Jumbo', wpi: '≤ 4', navin: [8, 25], jehlice: [12.75, 25], hacek: [15, 25], vzorek: [1, 6] }
  ];
  const PRIZE_ID = Object.fromEntries(PRIZE.map(p => [p.id, p]));

  /* Odhad kategorie z návinu (m na gramy). Vrací nejbližší podle středu rozsahu (logaritmicky). */
  function kategoriePodleNavinu(metry, gramy = 50) {
    if (!kladne(metry) || !kladne(gramy)) return null;
    const na50 = metry / gramy * 50;
    let nej = null, d = Infinity;
    for (const p of PRIZE) {
      const st = Math.sqrt(p.navin[0] * p.navin[1]), x = Math.abs(Math.log(na50 / st));
      if (x < d) { d = x; nej = p; }
    }
    return nej;
  }

  /* Orientační spotřeba v metrech pro dospělou velikost M (min–max). null = pro tuto přízi se nehodí. */
  const VYROBKY = [
    { id: 'cepice', nazev: '🧢 Čepice (dospělá)', m: { lace: [320, 400], fingering: [230, 320], sport: [200, 275], dk: [180, 250], worsted: [160, 210], aran: [140, 190], bulky: [115, 140], superbulky: [70, 95], jumbo: [35, 55] } },
    { id: 'sala', nazev: '🧣 Šála (cca 20 × 160 cm)', m: { lace: [500, 700], fingering: [410, 500], sport: [370, 460], dk: [320, 410], worsted: [275, 365], aran: [250, 320], bulky: [180, 230], superbulky: [110, 140], jumbo: [55, 80] } },
    { id: 'ponozky', nazev: '🧦 Ponožky (pár, dospělé)', m: { lace: null, fingering: [320, 420], sport: [275, 320], dk: [230, 275], worsted: [180, 230], aran: [160, 200], bulky: null, superbulky: null, jumbo: null } },
    { id: 'rukavice', nazev: '🧤 Rukavice / palčáky (pár)', m: { lace: null, fingering: [230, 300], sport: [180, 250], dk: [150, 210], worsted: [130, 180], aran: [115, 160], bulky: [90, 120], superbulky: [60, 80], jumbo: null } },
    { id: 'svetr', nazev: '🧥 Svetr (dospělý, s rukávy)', velikost: true, m: { lace: [1800, 2300], fingering: [1370, 1650], sport: [1190, 1370], dk: [1100, 1280], worsted: [915, 1100], aran: [820, 1000], bulky: [640, 820], superbulky: [460, 640], jumbo: [230, 370] } },
    { id: 'vesta', nazev: '🦺 Vesta / top bez rukávů', velikost: true, m: { lace: [1100, 1400], fingering: [820, 1000], sport: [730, 870], dk: [640, 780], worsted: [550, 680], aran: [500, 620], bulky: [380, 500], superbulky: [270, 380], jumbo: [140, 220] } },
    { id: 'dekaMimi', nazev: '👶 Deka pro miminko (cca 75 × 90 cm)', m: { lace: null, fingering: [1100, 1300], sport: [920, 1100], dk: [820, 1000], worsted: [730, 870], aran: [640, 780], bulky: [500, 600], superbulky: [320, 410], jumbo: [140, 220] } },
    { id: 'deka', nazev: '🛋️ Deka na gauč (cca 125 × 150 cm)', m: { lace: null, fingering: [2700, 3200], sport: [2400, 2800], dk: [2000, 2400], worsted: [1650, 2000], aran: [1450, 1800], bulky: [1100, 1350], superbulky: [730, 920], jumbo: [300, 460] } }
  ];
  const VYROBEK_ID = Object.fromEntries(VYROBKY.map(v => [v.id, v]));
  /* Násobek spotřeby svetru/vesty podle velikosti (M = 1). */
  const VELIKOSTI = [
    { id: 'mimi', nazev: 'miminko (0–12 m)', k: 0.25 }, { id: 'dite2', nazev: 'dítě 2–4 roky', k: 0.4 },
    { id: 'dite6', nazev: 'dítě 6–8 let', k: 0.55 }, { id: 'dite10', nazev: 'dítě 10–12 let', k: 0.7 },
    { id: 'XS', nazev: 'XS', k: 0.85 }, { id: 'S', nazev: 'S', k: 0.92 }, { id: 'M', nazev: 'M', k: 1 },
    { id: 'L', nazev: 'L', k: 1.1 }, { id: 'XL', nazev: 'XL', k: 1.2 }, { id: 'XXL', nazev: 'XXL', k: 1.32 }, { id: '3XL', nazev: '3XL', k: 1.45 }
  ];

  function odhadVyrobku(vyrobek, prize, velikost) {
    const v = VYROBEK_ID[vyrobek]; if (!v) return null;
    const m = v.m[prize]; if (!m) return null;
    const k = v.velikost ? ((VELIKOSTI.find(x => x.id === velikost) || { k: 1 }).k) : 1;
    return { min: Math.round(m[0] * k / 10) * 10, max: Math.round(m[1] * k / 10) * 10 };
  }

  /* Počet klubek: metry (+ rezerva) / návin klubka. */
  function klubka(metry, navin, gramyKlubka = 50, rezerva = PARAMETRY.rezerva) {
    if (!kladne(metry) || !kladne(navin)) return null;
    const potreba = metry * (1 + (rezerva || 0));
    const pocet = Math.ceil(potreba / navin - 1e-9);
    return { pocet, metry: Math.round(potreba), gramy: Math.round(potreba / navin * gramyKlubka) };
  }

  /* Spotřeba z vyváženého vzorku: vzorek (g, š × v cm) → gramy a metry na plochu výrobku (cm²). */
  function spotrebaZVzorku(o) {
    if (!kladne(o.vzorekG) || !kladne(o.vzorekSirka) || !kladne(o.vzorekVyska) || !kladne(o.plocha)) return null;
    const gramy = o.vzorekG / (o.vzorekSirka * o.vzorekVyska) * o.plocha;
    const r = { gramy: Math.round(gramy) };
    if (kladne(o.navin) && kladne(o.gramyKlubka)) r.metry = Math.round(gramy * o.navin / o.gramyKlubka);
    return r;
  }

  /* Záměna příze: původně pocet klubek po navinA m / gramyA g, náhradní navinB m / gramyB g. */
  function zamenaPrize(pocet, navinA, gramyA, navinB, gramyB) {
    if (!kladne(pocet) || !kladne(navinA) || !kladne(navinB)) return null;
    gramyA = gramyA || 50; gramyB = gramyB || 50;
    const metry = pocet * navinA;
    const hustA = navinA / gramyA * 100, hustB = navinB / gramyB * 100;  // m na 100 g
    const rozdil = hustB / hustA - 1;
    return {
      metry, pocet: Math.ceil(metry / navinB - 1e-9), gramy: Math.round(metry / navinB * gramyB),
      mNa100A: Math.round(hustA), mNa100B: Math.round(hustB), rozdilPct: Math.round(rozdil * 100),
      podobna: Math.abs(rozdil) <= 0.1,
      kategorieA: kategoriePodleNavinu(navinA, gramyA), kategorieB: kategoriePodleNavinu(navinB, gramyB)
    };
  }

  /* ---------- jehlice a háčky ---------- */
  /* mm ↔ US ↔ UK staré (UK/kanadské číslování) ↔ US háček. '' = rozměr se v soustavě nepoužívá. */
  const JEHLICE = [
    { mm: 2, us: '0', uk: '14', hacek: '' },
    { mm: 2.25, us: '1', uk: '13', hacek: 'B-1' },
    { mm: 2.5, us: '1½', uk: '–', hacek: '' },
    { mm: 2.75, us: '2', uk: '12', hacek: 'C-2' },
    { mm: 3, us: '2½', uk: '11', hacek: '' },
    { mm: 3.25, us: '3', uk: '10', hacek: 'D-3' },
    { mm: 3.5, us: '4', uk: '–', hacek: 'E-4' },
    { mm: 3.75, us: '5', uk: '9', hacek: 'F-5' },
    { mm: 4, us: '6', uk: '8', hacek: 'G-6' },
    { mm: 4.5, us: '7', uk: '7', hacek: '7' },
    { mm: 5, us: '8', uk: '6', hacek: 'H-8' },
    { mm: 5.5, us: '9', uk: '5', hacek: 'I-9' },
    { mm: 6, us: '10', uk: '4', hacek: 'J-10' },
    { mm: 6.5, us: '10½', uk: '3', hacek: 'K-10½' },
    { mm: 7, us: '–', uk: '2', hacek: '' },
    { mm: 7.5, us: '–', uk: '1', hacek: '' },
    { mm: 8, us: '11', uk: '0', hacek: 'L-11' },
    { mm: 9, us: '13', uk: '00', hacek: 'M/N-13' },
    { mm: 10, us: '15', uk: '000', hacek: 'N/P-15' },
    { mm: 12, us: '17', uk: '', hacek: '' },
    { mm: 15, us: '19', uk: '', hacek: 'P/Q' },
    { mm: 19, us: '35', uk: '', hacek: 'S' },
    { mm: 25, us: '50', uk: '', hacek: '' }
  ];

  /* Převod: z = 'mm' | 'us' | 'uk' | 'hacek'. U mm vrátí nejbližší řádek (a příznak přesnosti). */
  function prevodJehlic(hodnota, z = 'mm') {
    const s = String(hodnota == null ? '' : hodnota).trim().replace(',', '.').replace(/\.5$/, '½').toUpperCase();
    if (!s) return null;
    if (z === 'mm') {
      const x = parseFloat(String(hodnota).replace(',', '.'));
      if (!kladne(x)) return null;
      let nej = JEHLICE[0];
      for (const r of JEHLICE) if (Math.abs(r.mm - x) < Math.abs(nej.mm - x)) nej = r;
      return Object.assign({ presne: Math.abs(nej.mm - x) < 0.01 }, nej);
    }
    const r = JEHLICE.find(r => {
      const v = String(r[z]).toUpperCase();
      return v === s || (z === 'hacek' && v.split(/[-/]/).includes(s));
    });
    return r ? Object.assign({ presne: true }, r) : null;
  }

  /* ---------- zkratky návodů ---------- */
  /* druh: 'p' pletení, 'h' háčkování. us/uk se liší jen u háčkování (pozor, stejná zkratka = jiné očko!). */
  const ZKRATKY = [
    { druh: 'p', en: 'k', cz: 'hladce (H)', pozn: 'knit' },
    { druh: 'p', en: 'p', cz: 'obrace (O)', pozn: 'purl' },
    { druh: 'p', en: 'CO', cz: 'nahodit očka', pozn: 'cast on' },
    { druh: 'p', en: 'BO', cz: 'uzavřít (ukončit) očka', pozn: 'bind off (UK cast off)' },
    { druh: 'p', en: 'yo', cz: 'nahození (přehoz) – dírka', pozn: 'yarn over' },
    { druh: 'p', en: 'k2tog', cz: '2 očka hladce spolu (sklon doprava)', pozn: 'knit two together' },
    { druh: 'p', en: 'p2tog', cz: '2 očka obrace spolu', pozn: 'purl two together' },
    { druh: 'p', en: 'ssk', cz: '2 očka sejmout, hladce spolu za zadní nit (sklon doleva)', pozn: 'slip, slip, knit' },
    { druh: 'p', en: 'skp / sl1-k1-psso', cz: '1 sejmout, 1 hladce, sejmuté přetáhnout (sklon doleva)', pozn: 'slip, knit, pass slipped stitch over' },
    { druh: 'p', en: 's2kp / cdd', cz: '2 sejmout spolu, 1 hladce, přetáhnout (ubrání 2, střed)', pozn: 'centered double decrease' },
    { druh: 'p', en: 'sl / sl1', cz: 'sejmout očko (bez upletení)', pozn: 'slip' },
    { druh: 'p', en: 'wyif / wyib', cz: 's přízí před prací / za prací', pozn: 'with yarn in front / back' },
    { druh: 'p', en: 'M1 / M1L / M1R', cz: 'přidat z příčné nitě (doleva / doprava)', pozn: 'make one' },
    { druh: 'p', en: 'kfb', cz: 'přidat: uplést hladce za přední a zadní nit', pozn: 'knit front and back' },
    { druh: 'p', en: 'tbl', cz: 'za zadní nit (překřížené očko)', pozn: 'through back loop' },
    { druh: 'p', en: 'C4F / C4B', cz: 'copánek ze 4 oček, křížit doleva (před prací) / doprava (za prací)', pozn: 'cable 4 front / back' },
    { druh: 'p', en: 'RS / WS', cz: 'lícová / rubová strana', pozn: 'right side / wrong side' },
    { druh: 'p', en: 'rnd', cz: 'kruhová řada', pozn: 'round' },
    { druh: 'p', en: 'pm / sm', cz: 'vložit / přesunout značku', pozn: 'place / slip marker' },
    { druh: 'p', en: 'st / sts', cz: 'očko / očka', pozn: 'stitch(es)' },
    { druh: 'p', en: 'rep', cz: 'opakovat', pozn: 'repeat' },
    { druh: 'p', en: 'St st', cz: 'hladký žerzej (líc hladce, rub obrace)', pozn: 'stockinette (UK stocking stitch)' },
    { druh: 'p', en: 'garter st', cz: 'vroubkový vzor (všechny řady hladce)', pozn: 'garter stitch' },
    { druh: 'p', en: 'k1, p1 rib', cz: 'pružný vzor 1 hladce, 1 obrace', pozn: 'ribbing' },
    { druh: 'p', en: 'w&t', cz: 'obtočit a otočit (zkrácené řady)', pozn: 'wrap and turn' },
    { druh: 'h', en: 'ch', uk: 'ch', cz: 'řetízkové očko (ŘO)', pozn: 'chain' },
    { druh: 'h', en: 'sl st', uk: 'ss / sl st', cz: 'pevné (spojovací) očko (PO)', pozn: 'slip stitch' },
    { druh: 'h', en: 'sc', uk: 'dc', cz: 'krátký sloupek (KS)', pozn: 'US single crochet = UK double crochet' },
    { druh: 'h', en: 'hdc', uk: 'htr', cz: 'polodlouhý sloupek (PDS)', pozn: 'US half double = UK half treble' },
    { druh: 'h', en: 'dc', uk: 'tr', cz: 'dlouhý sloupek (DS)', pozn: 'US double crochet = UK treble!' },
    { druh: 'h', en: 'tr', uk: 'dtr', cz: 'dvojitý dlouhý sloupek (2DS)', pozn: 'US treble = UK double treble' },
    { druh: 'h', en: 'dtr', uk: 'trtr', cz: 'trojitý dlouhý sloupek (3DS)', pozn: 'US double treble = UK triple treble' },
    { druh: 'h', en: 'sc2tog', uk: 'dc2tog', cz: '2 krátké sloupky spolu (ubrání)', pozn: 'decrease' },
    { druh: 'h', en: 'inc', uk: 'inc', cz: '2 sloupky do 1 očka (přidání)', pozn: 'increase' },
    { druh: 'h', en: 'MR', uk: 'MR', cz: 'magický (čarovný) kroužek', pozn: 'magic ring' },
    { druh: 'h', en: 'FLO / BLO', uk: 'FLO / BLO', cz: 'jen za přední / zadní nit', pozn: 'front / back loop only' },
    { druh: 'h', en: 'yo', uk: 'yoh / yrh', cz: 'nahodit (přízi na háček)', pozn: 'yarn over' },
    { druh: 'h', en: 'sk', uk: 'miss', cz: 'vynechat (přeskočit) očko', pozn: 'skip' },
    { druh: 'h', en: 'gauge', uk: 'tension', cz: 'vzorek (hustota)', pozn: '' }
  ];

  /* ---------- počítadla ---------- */

  function novePocitadlo(nazev = 'Řady') { return { id: noveId(), nazev, hodnota: 0, raport: 0, kazdych: 0, od: 0, text: '' }; }

  /* Krok o delta (±1); nepůjde pod nulu. */
  function krok(p, delta) { p.hodnota = Math.max(0, (p.hodnota || 0) + delta); return p; }

  /* Popis stavu: u raportu „řada 3 z 8, opakování 2“, u připomínky „teď!“ nebo „za 2 řady“. */
  function stavPocitadla(p) {
    const h = p.hodnota || 0, r = {};
    if (p.raport > 0) {
      r.vRaportu = h === 0 ? 0 : ((h - 1) % p.raport) + 1;
      r.opakovani = h === 0 ? 0 : Math.ceil(h / p.raport);
    }
    if (p.kazdych > 0) {
      const prvni = (p.od || 0) > 0 ? p.od : p.kazdych;
      if (h < prvni) r.za = prvni - h;
      else { const zb = (h - prvni) % p.kazdych; r.za = zb === 0 ? 0 : p.kazdych - zb; }
      r.ted = r.za === 0;
      r.kolikrat = pocetPripominek(p, h);
    }
    return r;
  }
  /* Počet řad ≤ h, ve kterých připomínka nastala (řady od, od+k, od+2k…; od = 0 → k, 2k…). */
  function pocetPripominek(p, h) {
    if (!(p.kazdych > 0)) return 0;
    const prvni = (p.od || 0) > 0 ? p.od : p.kazdych;
    return h < prvni ? 0 : Math.floor((h - prvni) / p.kazdych) + 1;
  }

  /* ---------- schéma vzoru ---------- */
  /* Symboly kreslené čarami do čtverce 10 × 10 (SVG path, Path2D). fill = vyplnit, s = šířka v buňkách, zrc = zrcadlový protějšek. */
  const SYMBOLY = {
    pleteni: [
      { id: '', nazev: 'hladce (líc) / obrace (rub)', zk: 'k', d: '' },
      { id: 'p', nazev: 'obrace (líc) / hladce (rub)', zk: 'p', d: 'M6.3 5A1.3 1.3 0 1 1 3.7 5A1.3 1.3 0 1 1 6.3 5Z', fill: true },
      { id: 'yo', nazev: 'nahození (přehoz)', zk: 'yo', d: 'M7.5 5A2.5 2.5 0 1 1 2.5 5A2.5 2.5 0 1 1 7.5 5Z' },
      { id: 'k2tog', nazev: '2 hladce spolu (doprava)', zk: 'k2tog', d: 'M2 8L8 2', zrc: 'ssk' },
      { id: 'ssk', nazev: 'přetažení / ssk (doleva)', zk: 'ssk', d: 'M2 2L8 8', zrc: 'k2tog' },
      { id: 'p2tog', nazev: '2 obrace spolu', zk: 'p2tog', d: 'M2 8L8 2M5 7.6A0.9 0.9 0 1 1 4.99 7.6Z' },
      { id: 'cdd', nazev: '3 spolu, střed nahoře (s2kp)', zk: 's2kp', d: 'M2 8L5 2L8 8' },
      { id: 'sl', nazev: 'sejmout očko', zk: 'sl', d: 'M2.5 2.5L5 8L7.5 2.5' },
      { id: 'm1', nazev: 'přidat z příčné nitě (M1)', zk: 'M1', d: 'M2.5 8V2.5L5 6L7.5 2.5V8' },
      { id: 'tbl', nazev: 'hladce za zadní nit (překřížené)', zk: 'k tbl', d: 'M3.5 8.5L6.5 4.5A1.6 1.6 0 1 0 3.5 4.5L6.5 8.5' },
      { id: 'bob', nazev: 'boule (bobble)', zk: 'MB', d: 'M5 2L8 5L5 8L2 5Z', fill: true },
      { id: 'c2r', nazev: 'copánek 2 oček doprava (1/1 RC)', zk: 'RT', s: 2, d: 'M1 9L9 1M1 1L4 4M6 6L9 9', zrc: 'c2l' },
      { id: 'c2l', nazev: 'copánek 2 oček doleva (1/1 LC)', zk: 'LT', s: 2, d: 'M1 1L9 9M1 9L4 6M6 4L9 1', zrc: 'c2r' },
      { id: 'c4b', nazev: 'copánek 4 oček doprava (C4B)', zk: 'C4B', s: 4, d: 'M1 9L9 1M1 1L4 4M6 6L9 9', zrc: 'c4f' },
      { id: 'c4f', nazev: 'copánek 4 oček doleva (C4F)', zk: 'C4F', s: 4, d: 'M1 1L9 9M1 9L4 6M6 4L9 1', zrc: 'c4b' },
      { id: 'c6b', nazev: 'copánek 6 oček doprava (C6B)', zk: 'C6B', s: 6, d: 'M1 9L9 1M1 1L4 4M6 6L9 9', zrc: 'c6f' },
      { id: 'c6f', nazev: 'copánek 6 oček doleva (C6F)', zk: 'C6F', s: 6, d: 'M1 1L9 9M1 9L4 6M6 4L9 1', zrc: 'c6b' },
      { id: 'x', nazev: 'není očko', zk: '', d: '', sedy: true }
    ],
    hackovani: [
      { id: '', nazev: 'prázdné', zk: '', d: '' },
      { id: 'ch', nazev: 'řetízkové očko', zk: 'ch', d: 'M7.8 5A2.8 1.6 0 1 1 2.2 5A2.8 1.6 0 1 1 7.8 5Z' },
      { id: 'slst', nazev: 'pevné (spojovací) očko', zk: 'sl st', d: 'M6.2 5A1.2 1.2 0 1 1 3.8 5A1.2 1.2 0 1 1 6.2 5Z', fill: true },
      { id: 'sc', nazev: 'krátký sloupek (US sc / UK dc)', zk: 'sc', d: 'M3 3L7 7M7 3L3 7' },
      { id: 'hdc', nazev: 'polodlouhý sloupek (US hdc / UK htr)', zk: 'hdc', d: 'M2.5 2H7.5M5 2V9' },
      { id: 'dc', nazev: 'dlouhý sloupek (US dc / UK tr)', zk: 'dc', d: 'M2.5 1.5H7.5M5 1.5V9.5M3.5 6.5L6.5 4.5' },
      { id: 'tr', nazev: 'dvojitý dlouhý sloupek (US tr / UK dtr)', zk: 'tr', d: 'M2.5 1H7.5M5 1V9.5M3.5 5L6.5 3M3.5 7.5L6.5 5.5' },
      { id: 'inc', nazev: '2 krátké sloupky do 1 očka (přidat)', zk: 'inc', d: 'M5 9L2.2 1.5M5 9L7.8 1.5M3 3.5L4.6 5M7 3.5L5.4 5' },
      { id: 'dec', nazev: '2 krátké sloupky spolu (ubrat)', zk: 'sc2tog', d: 'M2.2 8.5L5 1M7.8 8.5L5 1M3 6.5L4.6 5M7 6.5L5.4 5' },
      { id: 'dc2', nazev: '2 dlouhé sloupky do 1 očka', zk: '2 dc', d: 'M5 9.5L2.5 1.5M5 9.5L7.5 1.5M1.5 1.5H3.5M6.5 1.5H8.5' },
      { id: 'pop', nazev: 'pukance / popcorn', zk: 'pc', d: 'M5 5m-3 0a3 2.2 0 1 0 6 0a3 2.2 0 1 0 -6 0', fill: true },
      { id: 'fpdc', nazev: 'reliéfní sloupek zepředu (FPdc)', zk: 'FPdc', d: 'M2.5 1.5H7.5M5 1.5V9.5M3.5 6.5L6.5 4.5M2.5 9.5C2.5 7.5 7.5 7.5 7.5 9.5' },
      { id: 'pic', nazev: 'pikotka (3 ŘO)', zk: 'picot', d: 'M5 9V5M7.5 3.2A2.5 2 0 1 1 2.5 3.2A2.5 2 0 1 1 7.5 3.2Z' },
      { id: 'x', nazev: 'není očko', zk: '', d: '', sedy: true }
    ]
  };
  const SYMBOL = {};
  for (const sada in SYMBOLY) { SYMBOL[sada] = {}; for (const s of SYMBOLY[sada]) SYMBOL[sada][s.id] = s; }
  const POKR = '~';   // buňka zabraná širokým symbolem (copánek) zleva
  const MAX_ROZMER = 200;

  const PALETA = ['#ffffff', '#1f2937', '#c0392b', '#2e86c1', '#27ae60', '#f1c40f', '#8e44ad', '#e67e22', '#ec87c0', '#7f5539'];

  function noveSchema(sirka = 20, vyska = 20, sada = 'pleteni') {
    sirka = omez(sirka, 1, MAX_ROZMER); vyska = omez(vyska, 1, MAX_ROZMER);
    return { sirka, vyska, sada: SYMBOLY[sada] ? sada : 'pleteni', kruhove: false,
      bunky: new Array(sirka * vyska).fill(''), barvy: new Array(sirka * vyska).fill(0),
      paleta: PALETA.slice(0, 4), raport: null };
  }
  function omez(x, a, b) { x = Math.round(+x); return Number.isFinite(x) ? Math.max(a, Math.min(b, x)) : a; }
  const idx = (s, x, y) => y * s.sirka + x;

  /* Číslo řady (1 = spodní, jak se plete) a strana, odkud se čte: plošně liché zprava, sudé zleva; kruhově vždy zprava. */
  function cisloRady(s, y) { return s.vyska - y; }
  function stranaRady(s, y) { return s.kruhove || cisloRady(s, y) % 2 === 1 ? 'vpravo' : 'vlevo'; }

  /* Odstraní široký symbol, který zasahuje do buňky (x,y): najde jeho hlavu a vyčistí všechny jeho buňky. */
  function uvolni(s, x, y) {
    let h = x;
    while (h > 0 && s.bunky[idx(s, h, y)] === POKR) h--;
    const sym = SYMBOL[s.sada][s.bunky[idx(s, h, y)]];
    const sir = sym && sym.s > 1 ? sym.s : 1;
    if (h + sir - 1 < x) { s.bunky[idx(s, x, y)] = ''; return; }   // osiřelé pokračování
    for (let i = h; i < h + sir && i < s.sirka; i++) s.bunky[idx(s, i, y)] = '';
  }

  /* Položí symbol na (x,y); široký zabere buňky doprava (vejde-li se), přepsané široké symboly smaže celé. */
  function poloz(s, x, y, id) {
    if (x < 0 || y < 0 || x >= s.sirka || y >= s.vyska) return false;
    const sym = SYMBOL[s.sada][id]; if (!sym) return false;
    const sir = sym.s > 1 ? sym.s : 1;
    if (x + sir > s.sirka) return false;
    for (let i = x; i < x + sir; i++) uvolni(s, i, y);
    s.bunky[idx(s, x, y)] = id;
    for (let i = 1; i < sir; i++) s.bunky[idx(s, x + i, y)] = POKR;
    return true;
  }
  function barvi(s, x, y, c) {
    if (x < 0 || y < 0 || x >= s.sirka || y >= s.vyska) return false;
    s.barvy[idx(s, x, y)] = omez(c, 0, s.paleta.length - 1); return true;
  }

  /* Řádek rozdělený na celky [id, …pokračování] – aby se široké symboly při zrcadlení nerozpadly. */
  function celkyRadku(s, y) {
    const r = [];
    for (let x = 0; x < s.sirka; x++) {
      const id = s.bunky[idx(s, x, y)];
      if (id === POKR && r.length) r[r.length - 1].push(x); else r.push([x]);
    }
    return r;
  }

  /* Zrcadlení vodorovně (levá ↔ pravá): obrátí pořadí celků, symboly se sklonem vymění za protějšek. */
  function zrcadliVodorovne(s) {
    const b = s.bunky.slice(), c = s.barvy.slice();
    for (let y = 0; y < s.vyska; y++) {
      const celky = celkyRadku(s, y);
      let x = 0;
      for (let k = celky.length - 1; k >= 0; k--) {
        const cel = celky[k], id = s.bunky[idx(s, cel[0], y)], sym = SYMBOL[s.sada][id];
        b[idx(s, x, y)] = sym && sym.zrc ? sym.zrc : id;
        for (let i = 1; i < cel.length; i++) b[idx(s, x + i, y)] = POKR;
        for (let i = 0; i < cel.length; i++) c[idx(s, x + i, y)] = s.barvy[idx(s, cel[cel.length - 1 - i], y)];
        x += cel.length;
      }
    }
    s.bunky = b; s.barvy = c; return s;
  }
  /* Zrcadlení svisle (horní ↔ dolní řady). */
  function zrcadliSvisle(s) {
    const b = [], c = [];
    for (let y = s.vyska - 1; y >= 0; y--) {
      b.push(...s.bunky.slice(y * s.sirka, (y + 1) * s.sirka));
      c.push(...s.barvy.slice(y * s.sirka, (y + 1) * s.sirka));
    }
    s.bunky = b; s.barvy = c; return s;
  }

  /* Změna rozměru: kotva vlevo dole (řada 1 zůstává řadou 1). Široké symboly, které se nevejdou, se smažou. */
  function zmenVelikost(s, sirka, vyska) {
    sirka = omez(sirka, 1, MAX_ROZMER); vyska = omez(vyska, 1, MAX_ROZMER);
    const n = noveSchema(sirka, vyska, s.sada);
    const dy = vyska - s.vyska;
    for (let y = 0; y < s.vyska; y++) {
      const ny = y + dy; if (ny < 0 || ny >= vyska) continue;
      for (let x = 0; x < Math.min(sirka, s.sirka); x++) {
        n.bunky[ny * sirka + x] = s.bunky[idx(s, x, y)];
        n.barvy[ny * sirka + x] = s.barvy[idx(s, x, y)];
      }
    }
    s.bunky = n.bunky; s.barvy = n.barvy; s.sirka = sirka; s.vyska = vyska;
    // useknuté široké symboly a osiřelá pokračování
    for (let y = 0; y < vyska; y++) for (let x = 0; x < sirka; x++) {
      const id = s.bunky[idx(s, x, y)], sym = SYMBOL[s.sada][id];
      if (sym && sym.s > 1 && x + sym.s > sirka) for (let i = x; i < sirka; i++) s.bunky[idx(s, i, y)] = '';
      if (id === POKR && (x === 0 || s.bunky[idx(s, x - 1, y)] === '')) s.bunky[idx(s, x, y)] = '';
    }
    if (s.raport) s.raport = normRaport(s, s.raport);
    return s;
  }

  function normRaport(s, r) {
    if (!r) return null;
    const x = omez(r.x, 0, s.sirka - 1), y = omez(r.y, 0, s.vyska - 1);
    return { x, y, w: omez(r.w, 1, s.sirka - x), h: omez(r.h, 1, s.vyska - y) };
  }

  /* Náhled celé plochy: raport (nebo celé schéma) zopakovaný nx × ny. Vrací nové schéma (široké symboly přes okraj raportu se oříznou). */
  function plocha(s, nx, ny) {
    const r = s.raport ? normRaport(s, s.raport) : { x: 0, y: 0, w: s.sirka, h: s.vyska };
    nx = omez(nx, 1, 50); ny = omez(ny, 1, 50);
    const w = Math.min(MAX_ROZMER * 4, r.w * nx), h = Math.min(MAX_ROZMER * 4, r.h * ny);
    const p = { sirka: w, vyska: h, sada: s.sada, kruhove: s.kruhove, paleta: s.paleta.slice(), raport: null, bunky: new Array(w * h), barvy: new Array(w * h) };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const sx = r.x + (x % r.w), sy = r.y + (y % r.h);
      let id = s.bunky[idx(s, sx, sy)];
      const sym = SYMBOL[s.sada][id];
      if (sym && sym.s > 1 && (x % r.w) + sym.s > r.w) id = '';
      if (id === POKR && x % r.w === 0) id = '';
      p.bunky[y * w + x] = id; p.barvy[y * w + x] = s.barvy[idx(s, sx, sy)];
    }
    return p;
  }

  /* Použité symboly a barvy (pro legendu), v pořadí sady. */
  function legenda(s) {
    const pouzite = new Set(s.bunky), barvy = new Set(s.barvy);
    return {
      symboly: SYMBOLY[s.sada].filter(x => x.id !== '' && pouzite.has(x.id)),
      barvy: s.paleta.map((b, i) => ({ i, barva: b })).filter(x => barvy.has(x.i) && (x.i > 0 || barvy.size > 1))
    };
  }

  /* Text řady pro „čtení“ návodem: „Ř. 3 (zprava): 2 k, yo, k2tog…“ – zleva/zprava podle strany. */
  function popisRady(s, y) {
    const celky = celkyRadku(s, y);
    if (stranaRady(s, y) === 'vpravo') celky.reverse();
    const casti = [];
    for (const c of celky) {
      const id = s.bunky[idx(s, c[0], y)], sym = SYMBOL[s.sada][id];
      if (!sym || sym.sedy) continue;
      let zk = sym.zk || (s.sada === 'pleteni' ? 'k' : '');
      if (!zk) continue;
      // na rubové řadě plošného pletení se hladce/obrace obrací
      if (s.sada === 'pleteni' && !s.kruhove && stranaRady(s, y) === 'vlevo') zk = zk === 'k' ? 'p' : zk === 'p' ? 'k' : zk;
      const pos = casti[casti.length - 1];
      if (pos && pos.zk === zk) pos.n++; else casti.push({ zk, n: 1 });
    }
    return casti.map(c => c.n > 1 ? `${c.zk}${['k', 'p', 'ch', 'sc', 'hdc', 'dc', 'tr'].includes(c.zk) ? c.n : ' ×' + c.n}` : c.zk).join(', ');
  }

  const escXml = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  /* SVG schématu (pro export, tisk i náhled): mřížka, barvy, symboly, čísla řad na straně čtení, rámeček raportu, legenda. */
  function schemaSvg(s, o = {}) {
    const b = o.bunka || 18, okraj = o.cisla === false ? 4 : 28;
    const w = s.sirka * b, h = s.vyska * b;
    const leg = o.legenda === false ? null : legenda(s);
    const radkuLeg = leg ? leg.symboly.length + (leg.barvy.length ? 1 : 0) : 0;
    const vyskaLeg = radkuLeg ? 14 + radkuLeg * 20 : 0;
    const W = w + 2 * okraj, H = h + 2 * okraj + vyskaLeg + (o.nazev ? 22 : 0);
    const top = okraj + (o.nazev ? 22 : 0);
    const r = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="sans-serif">`,
      `<rect width="${W}" height="${H}" fill="#fff"/>`];
    if (o.nazev) r.push(`<text x="${okraj}" y="16" font-size="14" font-weight="bold" fill="#000">${escXml(o.nazev)}</text>`);
    r.push(`<g transform="translate(${okraj},${top})">`);
    for (let y = 0; y < s.vyska; y++) for (let x = 0; x < s.sirka; x++) {
      const c = s.barvy[idx(s, x, y)], sym = SYMBOL[s.sada][s.bunky[idx(s, x, y)]];
      const fill = sym && sym.sedy ? '#bdbdbd' : (s.paleta[c] || '#fff');
      if (fill.toLowerCase() !== '#ffffff' && fill !== '#fff') r.push(`<rect x="${x * b}" y="${y * b}" width="${b}" height="${b}" fill="${fill}"/>`);
    }
    // mřížka (každá 10. čára silnější)
    for (let x = 0; x <= s.sirka; x++) r.push(`<line x1="${x * b}" y1="0" x2="${x * b}" y2="${h}" stroke="#000" stroke-opacity="${(s.sirka - x) % 10 === 0 ? 0.8 : 0.3}" stroke-width="${(s.sirka - x) % 10 === 0 ? 1.2 : 0.6}"/>`);
    for (let y = 0; y <= s.vyska; y++) r.push(`<line x1="0" y1="${y * b}" x2="${w}" y2="${y * b}" stroke="#000" stroke-opacity="${(s.vyska - y) % 10 === 0 ? 0.8 : 0.3}" stroke-width="${(s.vyska - y) % 10 === 0 ? 1.2 : 0.6}"/>`);
    for (let y = 0; y < s.vyska; y++) for (let x = 0; x < s.sirka; x++) {
      const sym = SYMBOL[s.sada][s.bunky[idx(s, x, y)]];
      if (!sym || !sym.d) continue;
      const sir = sym.s > 1 ? sym.s : 1, c = s.paleta[s.barvy[idx(s, x, y)]] || '#fff';
      const barva = jeTmava(c) ? '#fff' : '#000';
      if (sir > 1) r.push(`<rect x="${x * b + 1}" y="${y * b + 1}" width="${sir * b - 2}" height="${b - 2}" fill="${c}" />`);
      r.push(`<path transform="translate(${x * b},${y * b}) scale(${sir * b / 10},${b / 10})" d="${sym.d}" fill="${sym.fill ? barva : 'none'}" stroke="${barva}" stroke-width="${zaokr(Math.max(1.2, b / 14), 2)}" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"/>`);
    }
    if (s.raport) {
      const q = normRaport(s, s.raport);
      r.push(`<rect x="${q.x * b}" y="${q.y * b}" width="${q.w * b}" height="${q.h * b}" fill="none" stroke="#d32f2f" stroke-width="2.5"/>`);
    }
    r.push('</g>');
    if (o.cisla !== false) {
      const fs = Math.max(7, Math.min(11, b * 0.62));
      for (let y = 0; y < s.vyska; y++) {
        const n = cisloRady(s, y), vpravo = stranaRady(s, y) === 'vpravo';
        const tx = vpravo ? okraj + w + 3 : okraj - 3;
        r.push(`<text x="${tx}" y="${top + y * b + b / 2 + fs * 0.35}" font-size="${fs}" fill="#000" text-anchor="${vpravo ? 'start' : 'end'}">${n}</text>`);
      }
      for (let x = 0; x < s.sirka; x++) {
        const n = s.sirka - x;   // očka se počítají zprava
        if (n % 5 && n !== 1) continue;
        r.push(`<text x="${okraj + x * b + b / 2}" y="${top + h + fs + 3}" font-size="${fs}" fill="#555" text-anchor="middle">${n}</text>`);
      }
    }
    if (leg && radkuLeg) {
      let y = top + h + okraj;
      for (const sym of leg.symboly) {
        const sir = sym.s > 1 ? sym.s : 1, bw = 16 * Math.min(sir, 3);
        r.push(`<rect x="${okraj}" y="${y}" width="${bw}" height="16" fill="${sym.sedy ? '#bdbdbd' : '#fff'}" stroke="#000" stroke-width="0.6"/>`);
        if (sym.d) r.push(`<path transform="translate(${okraj},${y}) scale(${bw / 10},1.6)" d="${sym.d}" fill="${sym.fill ? '#000' : 'none'}" stroke="#000" vector-effect="non-scaling-stroke" stroke-width="1.3" stroke-linecap="round"/>`);
        r.push(`<text x="${okraj + bw + 8}" y="${y + 12}" font-size="12" fill="#000">${escXml(sym.nazev)}${sym.zk ? ' (' + escXml(sym.zk) + ')' : ''}</text>`);
        y += 20;
      }
      if (leg.barvy.length) {
        let x = okraj;
        leg.barvy.forEach((c, i) => {
          r.push(`<rect x="${x}" y="${y}" width="16" height="16" fill="${c.barva}" stroke="#000" stroke-width="0.6"/><text x="${x + 20}" y="${y + 12}" font-size="12" fill="#000">${String.fromCharCode(65 + i)}</text>`);
          x += 40;
        });
      }
    }
    r.push('</svg>');
    return r.join('');
  }

  function jeTmava(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return false;
    const n = parseInt(m[1], 16), R = n >> 16, G = (n >> 8) & 255, B = n & 255;
    return 0.299 * R + 0.587 * G + 0.114 * B < 120;
  }

  /* ---------- projekty, migrace ---------- */
  let citac = 0;
  function noveId() { return Date.now().toString(36) + (citac++).toString(36) + Math.random().toString(36).slice(2, 6); }

  function novyProjekt(nazev = 'Nový projekt') {
    return { id: noveId(), nazev, prize: '', jehlice: '', poznamka: '', pocitadla: [novePocitadlo('Řady')], schema: null, vytvoreno: new Date().toISOString().slice(0, 10) };
  }
  function prazdna() { const p = novyProjekt('Můj první projekt'); return { verze: VERZE, projekty: [p], aktivni: p.id }; }

  const txt = (x, max = 4000) => typeof x === 'string' ? x.slice(0, max) : '';
  const cislo = (x, d = 0) => Number.isFinite(+x) ? +x : d;

  function normSchema(s) {
    if (!s || typeof s !== 'object') return null;
    const n = noveSchema(s.sirka, s.vyska, s.sada);
    n.kruhove = !!s.kruhove;
    if (Array.isArray(s.paleta) && s.paleta.length) n.paleta = s.paleta.filter(c => /^#[0-9a-f]{6}$/i.test(c)).slice(0, 16);
    if (!n.paleta.length) n.paleta = PALETA.slice(0, 4);
    const sym = SYMBOL[n.sada];
    for (let i = 0; i < n.bunky.length; i++) {
      const id = Array.isArray(s.bunky) ? s.bunky[i] : '';
      n.bunky[i] = (id === POKR || (typeof id === 'string' && sym[id])) ? id : '';
      n.barvy[i] = Array.isArray(s.barvy) ? omez(s.barvy[i] || 0, 0, n.paleta.length - 1) : 0;
    }
    n.raport = s.raport ? normRaport(n, s.raport) : null;
    return n;
  }

  function migruj(d) {
    if (!d || typeof d !== 'object' || !Array.isArray(d.projekty)) return prazdna();
    const projekty = d.projekty.filter(p => p && typeof p === 'object').map(p => ({
      id: txt(p.id, 40) || noveId(), nazev: txt(p.nazev, 200) || 'Projekt', prize: txt(p.prize, 300), jehlice: txt(p.jehlice, 100),
      poznamka: txt(p.poznamka, 20000), vytvoreno: txt(p.vytvoreno, 10),
      pocitadla: (Array.isArray(p.pocitadla) ? p.pocitadla : []).filter(x => x && typeof x === 'object').map(x => ({
        id: txt(x.id, 40) || noveId(), nazev: txt(x.nazev, 80) || 'Počítadlo', hodnota: Math.max(0, Math.round(cislo(x.hodnota))),
        raport: Math.max(0, Math.round(cislo(x.raport))), kazdych: Math.max(0, Math.round(cislo(x.kazdych))),
        od: Math.max(0, Math.round(cislo(x.od))), text: txt(x.text, 200)
      })),
      schema: normSchema(p.schema)
    }));
    if (!projekty.length) return prazdna();
    for (const p of projekty) if (!p.pocitadla.length) p.pocitadla.push(novePocitadlo('Řady'));
    return { verze: VERZE, projekty, aktivni: projekty.some(p => p.id === d.aktivni) ? d.aktivni : projekty[0].id };
  }

  const API = {
    VERZE, KLIC, PARAMETRY, PRIZE, PRIZE_ID, VYROBKY, VELIKOSTI, JEHLICE, ZKRATKY, SYMBOLY, SYMBOL, POKR, PALETA, MAX_ROZMER,
    prepocetVzorku, naNasobek, upravaNavodu, rozdelPridavani, rozdelVRadach, textKroku,
    kategoriePodleNavinu, odhadVyrobku, klubka, spotrebaZVzorku, zamenaPrize, prevodJehlic,
    novePocitadlo, krok, stavPocitadla, pocetPripominek,
    noveSchema, poloz, barvi, zrcadliVodorovne, zrcadliSvisle, zmenVelikost, plocha, legenda, cisloRady, stranaRady, popisRady, schemaSvg, normRaport, jeTmava,
    novyProjekt, prazdna, migruj, normSchema, noveId
  };
  if (typeof module !== 'undefined') module.exports = API; else window.PleteniJadro = API;
})();

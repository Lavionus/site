/* ============================================================
   schodiste/jadro.js – výpočetní jádro stránky schodiste.html
   (čisté funkce bez DOM, testuje _test/schodiste_test.js).

   Postup:
     1. normové hodnoty jsou na JEDNOM místě (NORMA, KATEGORIE, ZDROJE),
     2. z konstrukční výšky H a počtu výšek n plyne h = H / n, šířka b podle
        cíle (pohodlí / úspora místa / vyplnit půdorys / vlastní),
     3. geometrie půdorysu: výstupní čára (úsečky + oblouky), přední hrany
        stupňů (nosy) jako úsečky vnitřní okraj → vnější okraj; kosé stupně
        se vyrovnávají metodou rozvinutí (hladký přechod rozvinutého
        vnitřního okraje kubickým Hermitovým úsekem) nebo metodou úměrnosti
        (šířky u vnitřního okraje v aritmetické řadě),
     4. kontroly podle normy, podchodná výška po výstupní čáře (strop
        s otvorem i schodiště nad sebou), potřebný stropní otvor,
     5. schodnice, výkaz materiálu, zábradlí.
   Souřadnice v milimetrech, půdorys x vpravo, y nahoru (jako v CAD).
   ============================================================ */
const SCHOD = (function () {
  'use strict';

  /* ============================================================
     1. NORMOVÉ HODNOTY – jediné místo v kódu
     ============================================================ */
  const STAV_K = '13. 10. 2026';

  const ZDROJE = {
    csn: { nazev: 'ČSN 73 4130:2010 Schodiště a šikmé rampy – Základní požadavky (náhled normy; tiskové změny Z1 2018, Z2 2024)', url: 'https://nahledy.normy.biz/n.php?i=85172' },
    ckait: { nazev: 'TS ČKAIT 02/2021 Geometrická přesnost schodišť, příloha 1 – tabulky požadavků ČSN 73 4130:2010 s čísly článků', url: 'https://profesis.ckait.cz/wp-content/uploads/2020/07/ts-ckait-02-2021.pdf' },
    cvut: { nazev: 'ČVUT FSv, PS01 Vertikální komunikace (1), J. Pazderka – výklad ČSN 73 4130:2010', url: 'https://kps.fsv.cvut.cz/upload/files/ps01-14-schodit1.pdf' },
    dashofer: { nazev: 'Technické požadavky na výstavbu, díl 7/6 Schodiště a rampy (Dashöfer, 2010)', url: 'https://www.dashofer.cz/download/ukazky/BBS2_07_06_01.pdf' },
    spspb: { nazev: 'SPŠ stavební Pardubice – Schodiště (tabulka polohy výstupní čáry, pomocné vzorce)', url: 'https://www.spspb.cz/wp-content/uploads/2021/01/VY_32_INOVACE2_SV_POS_03.pdf' },
    mendelu: { nazev: 'MENDELU – Technické požadavky na objekty z hlediska bezpečnosti při užívání (schodiště, zábradlí, zatížení)', url: 'https://fraxinus.mendelu.cz/vyuka/soubory/TMZD_BC/Povinne_volitelne_predmety/Vyrobni_objekty/TECHNICK%C3%89%20PO%C5%BDADAVKY%20NA%20OBJEKTY%20Z%20HLEDISKA%20BEZPE%C4%8CNOSTI%20P%C5%98I%20U%C5%BD%C3%8DV%C3%81N%C3%8D.pdf' },
    v268: { nazev: 'Vyhláška 268/2009 Sb., § 40 (rodinné domy) – nahrazena vyhláškou 146/2024 Sb. (účinnost 1. 7. 2024)', url: 'https://www.zakonyprolidi.cz/cs/2009-268' },
    v146: { nazev: 'Vyhláška 146/2024 Sb. o požadavcích na výstavbu, § 31 (schodiště) a § 34 (zábradlí)', url: 'https://e-sbirka.gov.cz/sb/2024/146' },
    mmr: { nazev: 'MMR – metodická pomůcka Bytový dům: sklon ramene a výška stupně (2020)', url: 'https://mmr.gov.cz/getattachment/d2bf30a5-846b-4b19-817c-1c8c2d4b3432/Metodika_BD_schody.pdf.aspx?lang=cs-CZ&ext=.pdf' },
    zabr: { nazev: 'ČSN 74 3305 Ochranná zábradlí – průvodce požadavky (iMateriály)', url: 'https://imaterialy.cz/rubriky/legislativa/ochranna-zabradli-pruvodce-pozadavky-norem_46614-html/' },
    zabr25: { nazev: 'Ochranná zábradlí a změny ČSN 74 3305 v roce 2025 (konstrukce.cz)', url: 'https://konstrukce.cz/vzdelavani/ochranna-zabradli-a-zmeny-normy-csn-74-3305-v-2025-1718' },
    lit: { nazev: 'Odborná literatura – bezpečnostní pravidlo h + b ≈ 460 mm (DIN 18065, Neufert); jen doporučení', url: '' },
    ec5: { nazev: 'ČSN EN 1995-1-1 / EN 1991-1-1 (dřevo C24: fm,k = 24 MPa, E0,mean = 11 000 MPa, kmod = 0,8/0,9, γM = 1,3, kdef = 0,6; břemeno 2 kN) – jen orientační odhad', url: '' },
  };

  const NORMA = {
    krok: { cil: 630, min: 600, max: 650, okMin: 620, okMax: 640, zdroj: ['csn', 'cvut', 'ckait'],
      pozn: '2h + b = 630 mm (čl. 9.1.6); v odůvodněných případech 600–650 mm. Pásmo 620–640 mm hodnotíme jako vyhovující, zbytek intervalu jako mezní.' },
    pohodli: { cil: 120, tol: 20, zdroj: ['spspb', 'mendelu'], pozn: 'b − h ≈ 120 mm – doplňkové pravidlo pohodlnosti (jen doporučení).' },
    bezpecnost: { cil: 460, tol: 20, zdroj: ['lit'], pozn: 'h + b ≈ 460 mm – bezpečnostní pravidlo (jen doporučení, ČSN ho neuvádí).' },
    bMin: { hodnota: 210, zdroj: ['ckait', 'cvut', 'dashofer'], pozn: 'Nejmenší šířka stupně na výstupní čáře 210 mm (čl. 9.1.8). TS ČKAIT u RD cituje 200 mm – použita přísnější hodnota 210 mm.' },
    stupniceMin: { hodnota: 250, zdroj: ['ckait', 'dashofer'], pozn: 'Nejmenší šířka stupnice (b + přesah nosu) 250 mm (čl. 9.1.8).' },
    koseMin: { hodnota: 130, zdroj: ['dashofer', 'mendelu', 'spspb'], pozn: 'Kosé a zvláštní stupně musí mít v nejužším místě šířku stupně nejméně 130 mm (měříme na vnitřním okraji ramene – konzervativně tětivou).' },
    kose400: { sirkaRamene: 1200, vzdalenost: 400, zdroj: ['dashofer'], pozn: 'U ramen širších než 1 200 mm (dvou- a víceproudových) musí kosé stupně splnit nejmenší šířku stupně (210 mm) a stupnice (250 mm) už ve vzdálenosti 400 mm od vnitřního okraje.' },
    pMin: { hodnota: 3, zdroj: ['csn', 'cvut'], pozn: 'Rameno má nejméně 3 výšky stupňů; 1–2 výšky nejsou rameno a z bezpečnostních důvodů se nedoporučují.' },
    mezipodesta: { krok: 630, zdroj: ['dashofer', 'cvut'], pozn: 'Mezipodesta bez změny směru: délka ≥ 630 mm + b (doporučeno násobek 630 mm + b).' },
    podlazniPodesta: { pridavek: 100, zdroj: ['dashofer', 'ckait'], pozn: 'Podesta musí mít průchodnou šířku alespoň jako rameno; podlažní podesta se doporučuje o 100–200 mm širší.' },
    vystupniCara: { tabulka: [{ do: 900, od: 300 }, { do: 1200, od: 400 }, { do: 1800, od: 1 / 3 }, { do: Infinity, od: 1 / 2 }], zdroj: ['dashofer', 'spspb', 'cvut', 'ckait'],
      pozn: 'U zakřivených a smíšených ramen leží výstupní čára blíž vnějšímu okraji: šířka ramene do 900 mm → 300 mm od vnějšího okraje, do 1 200 mm → 400 mm, do 1 800 mm → B/3, širší → v ose. U přímých ramen v ose. Pravidlo s hranicí 1 100 mm jsme v dostupných pramenech nenašli; text normy (čl. 6.4 Výstupní čára, změny Z1/2018 a Z2/2024 jsou tiskové) jsme neměli k dispozici.',
      citace: 'Citace (Dashöfer, Technické požadavky na výstavbu 7/6, výklad ČSN 73 4130): „U přímočarých schodišť leží výstupní čára v ose ramene. Pouze u schodišť se zakřivenými rameny je poloha výstupní čáry závislá na průchodné šířce schodišťového ramene a leží u průchodné šířky 900 mm ve vzdálenosti 300 mm, u průchodné šířky 900–1200 mm ve vzdálenosti 400 mm od vnějšího okraje (tj. od okraje s větším poloměrem), u průchodné šířky 1200–1800 mm ve vzdálenosti rovnající se 1/3 průchodné šířky od vnějšího okraje a u průchodné šířky 1800 mm a větší v ose schodišťového ramene.“ Shodně ČVUT (Pazderka): „…ve vzdálenosti 1/3 od vnější hrany oblouku u ramen zakřivených“.' },
    h1: { rd: 2100, a: 1500, b: 750, zdroj: ['dashofer', 'cvut', 'v268'], pozn: 'Podchodná výška h₁ = 1 500 + 750 / cos α (svisle nad spojnicí hran na výstupní čáře); v RD, uvnitř bytu a u pomocných schodišť nejméně 2 100 mm.' },
    h2: { a: 750, b: 1500, min: 1950, minPodkrovi: 1900, zdroj: ['cvut', 'dashofer', 'spspb'],
      pozn: 'Průchodná výška h₂ = 750 + 1 500 · cos α (kolmo k výstupní čáře), nejméně 1 950 mm (ČVUT, SPŠ Pardubice, MENDELU), u schodišť do podkroví je 1 900 mm hodnotou doporučenou (Dashöfer, SPŠ). Podle normy se posuzuje hlavně při manipulaci s rozměrnými předměty – u RD ji proto hodnotíme jako mezní, ne jako chybu.' },
    sklonTridy: [
      { do: 7, nazev: 'šikmá rampa' }, { do: 20, nazev: 'rampové schodiště' }, { do: 25, nazev: 'mírné schodiště' },
      { do: 35, nazev: 'běžné schodiště' }, { do: 45, nazev: 'strmé schodiště' }, { do: 58, nazev: 'žebříkové schodiště' },
      { do: 90, nazev: 'žebřík' }],
    zabradli: {
      vysky: [{ do: 3000, vyska: 900 }, { do: 12000, vyska: 1000 }, { do: 30000, vyska: 1100 }, { do: Infinity, vyska: 1200 }],
      mezera: 120, mezeraDeti: 80, mezeraVodorovna: 180, spodni: 120, spodniDeti: 80, neslezitelnaDo: 750,
      zdroj: ['zabr', 'zabr25', 'spspb', 'mendelu', 'v146'],
      pozn: 'Volné okraje ramen a podest musí mít zábradlí. Výška podle hloubky volného prostoru: do 3 m 900 mm, do 12 m 1 000 mm, do 30 m 1 100 mm, víc 1 200 mm; na schodišti se měří svisle nad spojnicí hran stupňů. Svislé mezery ve výplni nejvýš 120 mm (v provozech pro děti 80 mm), vodorovné nejvýš 180 mm; v bytových domech a provozech pro děti výplň do 750 mm nesmí umožnit šplhání (svislé příčle).' },
    madlo: { min: 900, max: 1000, prichod: 150, jednostranneDo: 1650, jednostranneDoTocite: 1100, zdroj: ['mendelu', 'dashofer'],
      pozn: 'Madlo ve výšce 900–1 000 mm, aspoň po jedné straně; po obou stranách u ramen širších než 1 650 mm (točitá a smíšená nad 1 100 mm) a v bezbariérových stavbách (900 mm). Na začátku a konci každého ramene má vodorovná část madla přesahovat aspoň o 150 mm.' },
    zatizeni: { q: 3.0, g: 0.6, Q: 2.0, zdroj: ['mendelu', 'ec5'], pozn: 'Užitné zatížení schodišť v obytných budovách 3,0 kN/m², vlastní tíha dřevěného schodiště odhadem 0,6 kN/m². Osamělé břemeno 2 kN na stupnici (ČSN EN 1991-1-1 + NA, kategorie A). Konečný průhyb s dotvarováním kdef = 0,6, ψ2 = 0,3. Jen orientační odhad průřezu.' },
    drevo: { fmk: 24, E: 11000, kmod: 0.8, kmodQ: 0.9, gM: 1.3, kdef: 0.6, psi2: 0.3, zdroj: ['ec5'] },
    deska: { stihlostMax: 30, zdroj: ['ec5'], pozn: 'Železobetonová deska ramene mívá tloušťku asi L/25 až L/30 (L = šikmé rozpětí) – jen orientační vodítko, desku navrhuje statik.' },
  };

  /* Kategorie podle účelu. Kde se zdroje rozcházejí, je zvolena přísnější hodnota (viz pozn). */
  const KATEGORIE = {
    rd_hlavni: {
      nazev: 'Hlavní schodiště v rodinném domě (i uvnitř bytu)', kratce: 'RD – hlavní',
      Bmin: 900, sklonMax: 35, sklonMaxVyjimka: 41, vyjimkaDoH: 3000, sklonMinDop: null,
      hMax: 200, hDopMin: 150, hDopMax: 180, bMin: 210, pMax: 18, h1: 'rd', h2: 'podminene', kose: true, madloObe: false, hCil: 175,
      zdroj: ['ckait', 'v268', 'cvut', 'dashofer'],
      pozn: 'Šířka ≥ 900 mm, sklon ≤ 35° (≤ 41° při konstrukční výšce do 3 000 mm), nejvýš 18 výšek v rameni, podchodná výška 2 100 mm. Největší výšku stupně 200 mm uvádí ČSN 73 4130:1985 (vydání 2010 jen „optimálně 150–180 mm“) – nad 180 mm hodnotíme jako mezní.',
    },
    rd_vedlejsi: {
      nazev: 'Vedlejší (pomocné) schodiště v RD – sklep, technické prostory', kratce: 'RD – vedlejší',
      Bmin: 750, sklonMax: 41, sklonMaxVyjimka: null, sklonMinDop: null,
      hMax: 210, hDopMin: 150, hDopMax: 180, bMin: 210, pMax: 18, h1: 'rd', h2: 'podminene', kose: true, madloObe: false, hCil: 185,
      zdroj: ['ckait', 'v268', 'dashofer'],
      pozn: 'Šířka ≥ 750 mm (vyhl. 268/2009 § 40, ČSN čl. 6.6.4), sklon ≤ 41° (schodiště do podzemních podlaží a na půdu), výška stupně pomocných schodišť ≤ 210 mm (ČSN 1985), nejvýš 18 výšek.',
    },
    podkrovi: {
      nazev: 'Do podkroví / na půdu, k nepobytovým prostorům', kratce: 'Podkroví, půda',
      Bmin: 750, sklonMax: 41, sklonMaxVyjimka: null, sklonMinDop: null,
      hMax: 210, hDopMin: 150, hDopMax: 180, bMin: 210, pMax: 18, h1: 'rd', h2: 'podminene', h2min: 1900, kose: true, madloObe: false, hCil: 190,
      zdroj: ['ckait', 'dashofer', 'v268'],
      pozn: 'Jako pomocné schodiště: šířka ≥ 750 mm, sklon ≤ 41°, h ≤ 210 mm, nejvýš 18 výšek; průchodná výška do podkroví 1 900 mm doporučená. Vede-li do obytného podkroví, jde o hlavní schodiště RD.',
    },
    domovni: {
      nazev: 'Hlavní domovní schodiště bytového domu', kratce: 'Bytový dům',
      Bmin: 1100, sklonMax: 35, sklonMaxVyjimka: null, sklonMinDop: 25,
      hMax: 180, hDopMin: 150, hDopMax: 180, bMin: 210, pMax: 16, h1: 'vzorec', h2: 'povinne', kose: true, madloObe: false, hCil: 165,
      zdroj: ['ckait', 'mmr', 'dashofer'],
      pozn: 'Šířka ≥ 1 100 mm, sklon 25° < α ≤ 35° (čl. 6.1.1), h ≤ 180 mm (ČSN 1985 pro bytové domy), podchodná výška podle vzorce. Počet výšek: ČSN 2010 připouští 18, starší vydání i bezbariérové stavby 16 – použito konzervativně 16.',
    },
    verejne: {
      nazev: 'Veřejné a bezbariérově užívané stavby', kratce: 'Veřejné / bezbariérové',
      Bmin: 1500, sklonMax: 28, sklonMaxVyjimka: null, sklonMinDop: null,
      hMax: 160, hDopMin: 150, hDopMax: 160, bMin: 310, pMax: 16, pMin: 4, bezbar: true, h1: 'vzorec', h2: 'povinne', kose: false, madloObe: true, hCil: 155,
      zdroj: ['ckait', 'cvut', 'mmr'],
      pozn: 'Bezbariérové užívání: sklon ≤ 28°, h ≤ 160 mm, b ≥ 310 mm, nejvýš 16 výšek, ramena a stupně přímé, ve všech ramenech stejný počet stupňů (vyhl. 398/2009 příl. 1 čl. 2.0.2), stupnice bez přesahu a s podstupnicí (kolmé k sobě; u změn staveb přesah nejvýš 25 mm), nejméně 4 výšky v rameni (TS ČKAIT, ČSN čl. 9.1.4), madla po obou stranách ve výšce 900 mm, šířka ramene 1 500 mm (ČSN 73 4130 čl. 6.6.6; pro bytové domy uvádí ČSN 73 4001:2024 i 1 200 mm – použita přísnější hodnota). Šířku únikových cest dále určuje požárně bezpečnostní řešení.',
    },
  };
  /* bytový dům s bezbariérovým užíváním – přebírá přísné hodnoty */
  function kategorie(ucel, bezbar) {
    const k = KATEGORIE[ucel] || KATEGORIE.rd_hlavni;
    if (ucel === 'domovni' && bezbar) {
      return Object.assign({}, k, { Bmin: 1500, sklonMax: 28, sklonMinDop: null, hMax: 160, hDopMax: 160, bMin: 310, pMin: 4, bezbar: true, kose: false, madloObe: true, hCil: 155,
        nazev: k.nazev + ' – bezbariérově užívané', pozn: k.pozn + ' Bezbariérové užívání: sklon ≤ 28°, h ≤ 160 mm, b ≥ 310 mm, přímá ramena, madla oboustranně, šířka 1 500 mm.' });
    }
    return k;
  }

  const TYPY = {
    primo: { nazev: 'Přímé jednoramenné', ramen: 1 },
    dvouramenne: { nazev: 'Dvouramenné přímé s mezipodestou', ramen: 2 },
    L_podesta: { nazev: 'Lomené do L s podestou', ramen: 2 },
    L_kose: { nazev: 'Lomené do L s kosými stupni', ramen: 1, kose: true },
    U_podesta: { nazev: 'Do U s mezipodestou', ramen: 2 },
    U_kose: { nazev: 'Do U s kosými stupni v otočce', ramen: 1, kose: true },
    tocite: { nazev: 'Točité (vřetenové / se zrcadlem)', ramen: 1, kose: true, tocite: true },
  };

  /* ============================================================
     2. Pomocná geometrie
     ============================================================ */
  const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const mul = (a, s) => [a[0] * s, a[1] * s];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
  const crs = (a, b) => a[0] * b[1] - a[1] * b[0];
  const dlz = a => Math.hypot(a[0], a[1]);
  const vzd = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const jedn = a => { const l = dlz(a) || 1; return [a[0] / l, a[1] / l]; };
  const lerp = (a, b, s) => [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s];

  /* lomená čára s parametrem délky */
  function Lomena(body) {
    const seg = []; let L = 0;
    for (let i = 0; i + 1 < body.length; i++) {
      const l = vzd(body[i], body[i + 1]);
      seg.push({ a: body[i], b: body[i + 1], l, u0: L }); L += l;
    }
    function bod(u) {
      if (u <= 0) { const s = seg.find(q => q.l > 0) || seg[0]; return s.l > 0 ? lerp(s.a, s.b, u / s.l) : s.a.slice(); }
      for (const s of seg) if (u <= s.u0 + s.l && s.l > 0) return lerp(s.a, s.b, (u - s.u0) / s.l);
      const s = seg.slice().reverse().find(q => q.l > 0) || seg[seg.length - 1];
      return s.l > 0 ? lerp(s.a, s.b, (u - s.u0) / s.l) : s.b.slice();
    }
    /* parametr nejbližšího bodu */
    function param(p) {
      let best = Infinity, bu = 0;
      for (const s of seg) {
        if (s.l === 0) continue;
        const d = sub(s.b, s.a); let q = dot(sub(p, s.a), d) / (s.l * s.l); q = Math.max(0, Math.min(1, q));
        const x = lerp(s.a, s.b, q), dd = vzd(x, p);
        if (dd < best - 1e-9) { best = dd; bu = s.u0 + q * s.l; }
      }
      return bu;
    }
    function vzdalenost(p) { return vzd(bod(param(p)), p); }
    /* první průsečík paprsku P + s·d (s > eps) */
    function paprsek(P, d) {
      let best = null;
      for (const s of seg) {
        if (s.l === 0) continue;
        const e = sub(s.b, s.a), den = crs(d, e);
        if (Math.abs(den) < 1e-12) continue;
        const w = sub(s.a, P);
        const t = crs(w, e) / den, q = crs(w, d) / den;
        if (t > 1e-6 && q >= -1e-9 && q <= 1 + 1e-9 && (!best || t < best.t)) best = { t, p: add(P, mul(d, t)), u: s.u0 + Math.max(0, Math.min(1, q)) * s.l };
      }
      return best;
    }
    return { body, seg, L, bod, param, vzdalenost, paprsek };
  }

  /* cesta výstupní čáry: úsečky {t:'u', a, b} a oblouky {t:'o', c, r, f0, f1} (rad, f1 < f0 = po směru hod.) */
  function Cesta(segs) {
    let L = 0;
    const s = segs.map(q => {
      const l = q.t === 'u' ? vzd(q.a, q.b) : q.r * Math.abs(q.f1 - q.f0);
      const o = Object.assign({}, q, { l, t0: L }); L += l; return o;
    });
    function bod(t) {
      let q = s[s.length - 1];
      for (const x of s) if (t <= x.t0 + x.l) { q = x; break; }
      if (t < 0) q = s[0];
      const u = (t - q.t0);
      if (q.t === 'u') return q.l > 0 ? lerp(q.a, q.b, u / q.l) : q.a.slice();
      const f = q.f0 + (q.f1 > q.f0 ? 1 : -1) * u / q.r;
      return [q.c[0] + q.r * Math.cos(f), q.c[1] + q.r * Math.sin(f)];
    }
    function vzorky(t0, t1, krok) {
      const out = []; const N = Math.max(2, Math.ceil((t1 - t0) / krok));
      for (let i = 0; i <= N; i++) { const t = t0 + (t1 - t0) * i / N; out.push({ t, p: bod(t) }); }
      return out;
    }
    return { segs: s, L, bod, vzorky };
  }

  function bodVPolygonu(p, poly) {
    let in_ = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if (((a[1] > p[1]) !== (b[1] > p[1])) && (p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0])) in_ = !in_;
    }
    return in_;
  }
  function plocha(poly) {
    let s = 0;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) s += (poly[j][0] + poly[i][0]) * (poly[j][1] - poly[i][1]);
    return Math.abs(s) / 2;
  }
  function teziste(poly) {
    let x = 0, y = 0; for (const p of poly) { x += p[0]; y += p[1]; } return [x / poly.length, y / poly.length];
  }
  /* oříznutí polygonu polorovinou a·x + b·y ≤ c (Sutherland–Hodgman) */
  function orizni(poly, a, b, c) {
    const out = [], uvnitr = p => a * p[0] + b * p[1] <= c + 1e-9;
    for (let i = 0; i < poly.length; i++) {
      const P = poly[i], Q = poly[(i + 1) % poly.length], pi = uvnitr(P), qi = uvnitr(Q);
      if (pi) out.push(P);
      if (pi !== qi) {
        const fp = a * P[0] + b * P[1] - c, fq = a * Q[0] + b * Q[1] - c, s = fp / (fp - fq);
        out.push(lerp(P, Q, s));
      }
    }
    return out;
  }
  function bboxBodu(body) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of body) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
    return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
  }
  function oblouk(c, r, f0, f1, N) {
    const out = []; for (let i = 0; i <= N; i++) { const f = f0 + (f1 - f0) * i / N; out.push([c[0] + r * Math.cos(f), c[1] + r * Math.sin(f)]); } return out;
  }
  function puleni(f, a, b, cil, iter) {
    let fa = f(a) - cil;
    for (let i = 0; i < (iter || 60); i++) {
      const m = (a + b) / 2, fm = f(m) - cil;
      if ((fa <= 0) === (fm <= 0)) { a = m; fa = fm; } else b = m;
    }
    return (a + b) / 2;
  }

  /* ============================================================
     3. Základní výpočty
     ============================================================ */
  function konstrukcniVyska(s) {
    if (s.vyskaRezim === 'hruba') return (+s.Hhruba || 0) - (+s.podlahaDole || 0) + (+s.podlahaNahore || 0);
    return +s.H || 0;
  }
  function vystupniOdVnejsiho(B) {
    for (const r of NORMA.vystupniCara.tabulka) if (B <= r.do) return r.od < 1 ? B * r.od : r.od;
    return B / 2;
  }
  function sklonTrida(a) {
    for (const t of NORMA.sklonTridy) if (a <= t.do) return t.nazev; return 'žebřík';
  }
  function h1Pozadovana(kat, alfaDeg) {
    if (kat.h1 === 'rd') return NORMA.h1.rd;
    return NORMA.h1.a + NORMA.h1.b / Math.cos(rad(alfaDeg));
  }
  function h2Pozadovana(kat, alfaDeg) {
    const min = kat.h2min || NORMA.h2.min;
    return Math.max(min, NORMA.h2.a + NORMA.h2.b * Math.cos(rad(alfaDeg)));
  }
  function vyskaZabradli(hloubka) {
    for (const r of NORMA.zabradli.vysky) if (hloubka <= r.do) return r.vyska;
    return 1200;
  }
  function sklonMaxPro(kat, H) {
    if (kat.sklonMaxVyjimka && H <= kat.vyjimkaDoH) return kat.sklonMaxVyjimka;
    return kat.sklonMax;
  }

  /* ============================================================
     4. Geometrie půdorysu
     ============================================================ */
  /* společný výstup: nosy (přední hrany) k = 1..n, stupně k = 1..n−1 */
  function Chyba(text, pole) { const e = new Error(text); e.pole = pole; return e; }
  function nos(k, I, O, W, t, h) { return { k, I, O, W, t, z: k * h }; }
  function stupen(k, poly, h, typ, rameno) { return { k, poly, z: k * h, typ, rameno }; }

  function geoPrimo(p) {
    const { n, h, b, B } = p;
    const nosy = [], stupne = [];
    for (let k = 1; k <= n; k++) { const x = (k - 1) * b; nosy.push(nos(k, [x, B], [x, 0], [x, B / 2], x, h)); }
    for (let k = 1; k < n; k++) { const x = (k - 1) * b; stupne.push(stupen(k, [[x, 0], [x + b, 0], [x + b, B], [x, B]], h, 'rovny', 0)); }
    const L = (n - 1) * b;
    return { nosy, stupne, cesta: Cesta([{ t: 'u', a: [0, B / 2], b: [L, B / 2] }]),
      vnitrni: [[0, B], [L, B]], vnejsi: [[0, 0], [L, 0]], ramena: [{ k0: 1, k1: n, smer: [1, 0], typ: 'prime' }],
      vystupSmer: [1, 0] };
  }

  function geoDvouramenne(p) {
    const { n, h, b, B, n1, Lp } = p;
    const nosy = [], stupne = [];
    const X1 = (n1 - 1) * b;
    const xk = k => k <= n1 ? (k - 1) * b : X1 + Lp + (k - n1 - 1) * b;
    for (let k = 1; k <= n; k++) { const x = xk(k); nosy.push(nos(k, [x, B], [x, 0], [x, B / 2], x, h)); }
    for (let k = 1; k < n; k++) {
      const x0 = xk(k), x1 = xk(k + 1);
      stupne.push(stupen(k, [[x0, 0], [x1, 0], [x1, B], [x0, B]], h, k === n1 ? 'podesta' : 'rovny', k < n1 ? 0 : (k === n1 ? -1 : 1)));
    }
    const L = xk(n);
    return { nosy, stupne, cesta: Cesta([{ t: 'u', a: [0, B / 2], b: [L, B / 2] }]),
      vnitrni: [[0, B], [L, B]], vnejsi: [[0, 0], [L, 0]],
      ramena: [{ k0: 1, k1: n1, smer: [1, 0], typ: 'prime' }, { k0: n1 + 1, k1: n, smer: [1, 0], typ: 'prime' }], vystupSmer: [1, 0],
      delkyRamen: [(n1 - 1) * b, (n - n1 - 1) * b], vysekRamen: [n1, n - n1] };
  }

  /* L s podestou, levotočivé (druhé rameno jde do +y) */
  function geoLPodesta(p) {
    const { n, h, b, B, n1 } = p; const Bp = Math.max(p.Bp, B);
    const X1 = (n1 - 1) * b, n2 = n - n1;
    const nosy = [], stupne = [];
    const r = Bp - B / 2, oblL = Math.PI / 2 * r;
    for (let k = 1; k <= n1; k++) { const x = (k - 1) * b; nosy.push(nos(k, [x, B], [x, 0], [x, B / 2], x, h)); }
    const x2i = X1 + Bp - B, x2o = X1 + Bp, x2w = X1 + Bp - B / 2;
    for (let j = 1; j <= n2; j++) { const y = Bp + (j - 1) * b; nosy.push(nos(n1 + j, [x2i, y], [x2o, y], [x2w, y], X1 + oblL + (j - 1) * b, h)); }
    for (let k = 1; k < n; k++) {
      if (k < n1) { const x = (k - 1) * b; stupne.push(stupen(k, [[x, 0], [x + b, 0], [x + b, B], [x, B]], h, 'rovny', 0)); }
      else if (k === n1) stupne.push(stupen(k, [[X1, 0], [X1 + Bp, 0], [X1 + Bp, Bp], [X1, Bp]], h, 'podesta', -1));
      else { const y = Bp + (k - n1 - 1) * b; stupne.push(stupen(k, [[x2i, y], [x2o, y], [x2o, y + b], [x2i, y + b]], h, 'rovny', 1)); }
    }
    const yEnd = Bp + (n2 - 1) * b;
    const cesta = Cesta([{ t: 'u', a: [0, B / 2], b: [X1, B / 2] }, { t: 'o', c: [X1, Bp], r, f0: -Math.PI / 2, f1: 0 }, { t: 'u', a: [x2w, Bp], b: [x2w, yEnd] }]);
    return { nosy, stupne, cesta,
      vnitrni: [[0, B], [X1, B], [X1, Bp], [x2i, Bp], [x2i, yEnd]], vnejsi: [[0, 0], [x2o, 0], [x2o, yEnd]],
      pasy: [[0, 0, X1 + Bp, Bp], [x2i, 0, x2o, yEnd]],
      ramena: [{ k0: 1, k1: n1, smer: [1, 0], typ: 'prime' }, { k0: n1 + 1, k1: n, smer: [0, 1], typ: 'prime' }], vystupSmer: [0, 1],
      delkyRamen: [X1 + Bp, yEnd], vysekRamen: [n1, n2] };
  }

  /* U s mezipodestou, levotočivé (druhé rameno jde do −x nad prvním) */
  function geoUPodesta(p) {
    const { n, h, b, B, n1, z } = p; const Bp = Math.max(p.Bp, B);
    const X1 = (n1 - 1) * b, n2 = n - n1;
    const nosy = [], stupne = [];
    const r = (B + z) / 2, oblL = Math.PI * r;
    for (let k = 1; k <= n1; k++) { const x = (k - 1) * b; nosy.push(nos(k, [x, B], [x, 0], [x, B / 2], x, h)); }
    const yi = B + z, yo = 2 * B + z, yw = 1.5 * B + z;
    for (let j = 1; j <= n2; j++) { const x = X1 - (j - 1) * b; nosy.push(nos(n1 + j, [x, yi], [x, yo], [x, yw], X1 + oblL + (j - 1) * b, h)); }
    for (let k = 1; k < n; k++) {
      if (k < n1) { const x = (k - 1) * b; stupne.push(stupen(k, [[x, 0], [x + b, 0], [x + b, B], [x, B]], h, 'rovny', 0)); }
      else if (k === n1) stupne.push(stupen(k, [[X1, 0], [X1 + Bp, 0], [X1 + Bp, yo], [X1, yo]], h, 'podesta', -1));
      else { const x = X1 - (k - n1 - 1) * b; stupne.push(stupen(k, [[x - b, yi], [x, yi], [x, yo], [x - b, yo]], h, 'rovny', 1)); }
    }
    const xEnd = X1 - (n2 - 1) * b;
    const cesta = Cesta([{ t: 'u', a: [0, B / 2], b: [X1, B / 2] }, { t: 'o', c: [X1, B + z / 2], r, f0: -Math.PI / 2, f1: Math.PI / 2 }, { t: 'u', a: [X1, yw], b: [xEnd, yw] }]);
    return { nosy, stupne, cesta,
      vnitrni: [[0, B], [X1, B], [X1, yi], [xEnd, yi]], vnejsi: [[0, 0], [X1 + Bp, 0], [X1 + Bp, yo], [xEnd, yo]],
      ramena: [{ k0: 1, k1: n1, smer: [1, 0], typ: 'prime' }, { k0: n1 + 1, k1: n, smer: [-1, 0], typ: 'prime' }], vystupSmer: [-1, 0], zrcadlo: z,
      delkyRamen: [X1 + Bp, X1 + Bp - xEnd], vysekRamen: [n1, n2] };
  }

  /* --- kosé stupně: obecný řešič pro L (90°) a U (180°) --- */
  function rozestupNosu(cesta, n, b) {
    const t = [0];
    for (let k = 1; k < n; k++) {
      const P = cesta.bod(t[k - 1]);
      const f = x => vzd(cesta.bod(x), P);
      const lo = t[k - 1] + b * 0.999, hi = t[k - 1] + b * 1.6;
      if (f(hi) < b) throw new Error('Výstupní čára má v otočce příliš malý poloměr pro šířku stupně ' + Math.round(b) + ' mm.');
      t.push(puleni(f, lo, hi, b, 50));
    }
    return t;
  }

  /* Rozvinutý vnitřní okraj: z(u). metoda 'rozvinuti' = Hermite C1, 'umernost' = aritmetická řada šířek */
  function vnitrniPolohy(metoda, ka, kb, ua, ub, h, b, slope) {
    const M = kb - ka, du = ub - ua, out = {};
    if (M <= 1) return out;
    if (metoda === 'umernost') {
      const S1 = M % 2 === 0 ? M * M / 4 : (M * M - 1) / 4;
      const den = M * (M + 1) / 2 - S1;
      const D = (M * b - du) / den, A = b - D * (M + 1) / 2;
      let u = ua;
      for (let j = 0; j < M - 1; j++) { const jc = Math.abs(j + 0.5 - M / 2); u += A + D * jc; out[ka + j + 1] = u; }
      return out;
    }
    const za = ka * h, zb = kb * h, m = slope * du;
    const z = s => { const s2 = s * s, s3 = s2 * s; return (2 * s3 - 3 * s2 + 1) * za + (s3 - 2 * s2 + s) * m + (-2 * s3 + 3 * s2) * zb + (s3 - s2) * m; };
    for (let k = ka + 1; k < kb; k++) out[k] = ua + du * puleni(z, 0, 1, k * h, 60);
    return out;
  }

  function geoKose(p, U) {
    const { n, h, b, B } = p;
    const z = U ? Math.max(0, p.z) : 0;
    const e = p.vystupni > 0 ? Math.min(p.vystupni, B - 50) : vystupniOdVnejsiho(B), d = B - e;
    const otocka = U ? Math.PI * d + z : Math.PI / 2 * d;
    const X1 = p.m1 * b - otocka / 2;
    const n1Min = Math.ceil((otocka / 2 / b + 0.5) * 2) / 2;
    if (X1 < -1e-6) throw Chyba('1. rameno je příliš krátké – otočka s kosými stupni potřebuje před osou aspoň ' + String(n1Min).replace('.', ',') + ' výšky (zadáno ' + String(p.m1 + 0.5).replace('.', ',') + ').', 'n1');
    const DAL = 100000;
    let segs, inner, outer;
    if (!U) {
      segs = [{ t: 'u', a: [0, e], b: [X1, e] }, { t: 'o', c: [X1, B], r: d, f0: -Math.PI / 2, f1: 0 }, { t: 'u', a: [X1 + d, B], b: [X1 + d, B + DAL] }];
      inner = Lomena([[0, B], [X1, B], [X1, B + DAL]]);
      outer = Lomena([[0, 0], [X1 + B, 0], [X1 + B, B + DAL]]);
    } else {
      segs = [{ t: 'u', a: [0, e], b: [X1, e] }, { t: 'o', c: [X1, B], r: d, f0: -Math.PI / 2, f1: 0 },
        { t: 'u', a: [X1 + d, B], b: [X1 + d, B + z] }, { t: 'o', c: [X1, B + z], r: d, f0: 0, f1: Math.PI / 2 },
        { t: 'u', a: [X1, B + z + d], b: [X1 - DAL, B + z + d] }];
      inner = Lomena([[0, B], [X1, B], [X1, B + z], [X1 - DAL, B + z]]);
      outer = Lomena([[0, 0], [X1 + B, 0], [X1 + B, 2 * B + z], [X1 - DAL, 2 * B + z]]);
    }
    const cesta = Cesta(segs);
    const T0 = X1, T1 = X1 + otocka;
    const uS = t => {
      if (t <= T0 + 1e-6) return t;
      if (!U) return t >= T1 - 1e-6 ? t - Math.PI / 2 * d : null;
      if (t >= X1 + Math.PI / 2 * d - 1e-6 && t <= X1 + Math.PI / 2 * d + z + 1e-6) return t - Math.PI / 2 * d;
      return t >= T1 - 1e-6 ? t - Math.PI * d : null;
    };
    const t = rozestupNosu(cesta, n, b);
    let ka0 = 1, kb0 = n + 1;
    for (let k = 1; k <= n; k++) if (t[k - 1] <= T0 + 1e-6) ka0 = k;
    for (let k = n; k >= 1; k--) if (t[k - 1] >= T1 - 1e-6) kb0 = k;
    if (kb0 > n) throw Chyba('2. rameno je příliš krátké – za osou otočky musí zůstat aspoň ' + String(Math.ceil((otocka / 2 / b + 1) * 2) / 2).replace('.', ',') + ' výšky; 1. rameno může mít nejvýš ' + String(Math.max(1, Math.floor((n - 1 - otocka / 2 / b) * 2) / 2)).replace('.', ',') + ' výšky.', 'n1');
    const ext = Math.max(0, p.ext | 0);
    const ka = Math.max(1, ka0 - ext), kb = Math.min(n, kb0 + ext);
    const ua = uS(t[ka - 1]), ub = uS(t[kb - 1]);
    const polohy = vnitrniPolohy(p.metoda, ka, kb, ua, ub, h, b, h / b);
    const nosy = [];
    for (let k = 1; k <= n; k++) {
      const tk = t[k - 1], W = cesta.bod(tk);
      let I;
      if (k > ka && k < kb) I = inner.bod(polohy[k]);
      else { const u = uS(tk); if (u == null) throw new Error('Kosé stupně nepokrývají celou otočku.'); I = inner.bod(u); }
      let dir = sub(W, I);
      if (dlz(dir) < 1e-6) throw new Error('Přední hrana stupně prochází vnitřním okrajem na výstupní čáře.');
      dir = jedn(dir);
      const hit = outer.paprsek(I, dir);
      if (!hit) throw new Error('Přední hrana stupně ' + k + ' neprotíná vnější okraj.');
      const o = nos(k, I, hit.p, W, tk, h); o.kosy = k > ka && k < kb;
      nosy.push(o);
    }
    /* ukončení druhého ramene */
    const Wn = nosy[n - 1].W;
    let vnitrni, vnejsi, vystupSmer;
    let pasy = null, delkyRamen;
    if (!U) { const yE = Wn[1]; delkyRamen = [X1 + B, yE]; vnitrni = [[0, B], [X1, B], [X1, yE]]; vnejsi = [[0, 0], [X1 + B, 0], [X1 + B, yE]]; vystupSmer = [0, 1]; pasy = [[0, 0, X1 + B, B], [X1, 0, X1 + B, yE]]; }
    else { const xE = Wn[0]; delkyRamen = [X1 + B, X1 + B - xE]; vnitrni = [[0, B], [X1, B], [X1, B + z], [xE, B + z]]; vnejsi = [[0, 0], [X1 + B, 0], [X1 + B, 2 * B + z], [xE, 2 * B + z]]; vystupSmer = [-1, 0]; }
    const Lin = Lomena(vnitrni), Lout = Lomena(vnejsi);
    for (const q of nosy) { q.u = Lin.param(q.I); q.v = Lout.param(q.O); }
    /* polygony stupňů včetně rohových vrcholů okrajů */
    const stupne = [];
    for (let k = 1; k < n; k++) {
      const A = nosy[k - 1], C = nosy[k];
      const poly = [A.I];
      for (let i = 1; i < vnitrni.length - 1; i++) { const u = Lin.param(vnitrni[i]); if (u > A.u + 1e-6 && u < C.u - 1e-6) poly.push(vnitrni[i]); }
      poly.push(C.I, C.O);
      const rohy = [];
      for (let i = 1; i < vnejsi.length - 1; i++) { const v = Lout.param(vnejsi[i]); if (v > A.v + 1e-6 && v < C.v - 1e-6) rohy.push(vnejsi[i]); }
      poly.push(...rohy.reverse(), A.O);
      stupne.push(stupen(k, poly, h, (k >= ka && k < kb) ? 'kosy' : 'rovny', 0));
    }
    /* šířky kosých stupňů */
    const sirkyVnitrni = [], sirky400 = [], sirkyVnejsi = [];
    const v400 = NORMA.kose400.vzdalenost;
    const bod400 = q => {
      const L = vzd(q.I, q.O); if (L <= v400) return null;
      const s = puleni(x => Lin.vzdalenost(lerp(q.I, q.O, x)), 0, 1, v400, 40);
      return lerp(q.I, q.O, s);
    };
    for (let k = 1; k < n; k++) {
      const A = nosy[k - 1], C = nosy[k];
      sirkyVnitrni.push(vzd(A.I, C.I)); sirkyVnejsi.push(vzd(A.O, C.O));
      const a4 = bod400(A), c4 = bod400(C); sirky400.push(a4 && c4 ? vzd(a4, c4) : null);
    }
    /* monotónnost: přední hrany se nesmí křížit */
    let krizeni = false;
    for (let k = 1; k < n; k++) if (nosy[k].u <= nosy[k - 1].u + 1e-6 || nosy[k].v <= nosy[k - 1].v + 1e-6) krizeni = true;
    const tEnd = t[n - 1];
    return { nosy, stupne, cesta, vnitrni, vnejsi, pasy, ramena: [{ k0: 1, k1: n, smer: [1, 0], typ: 'kose' }], vystupSmer, zrcadlo: z,
      delkyRamen, vysekRamen: [p.m1 + 0.5, n - p.m1 - 0.5], osaOtocky: p.m1 * b,
      kose: { ka, kb, ka0, kb0, ext, metoda: p.metoda, sirkyVnitrni, sirky400, sirkyVnejsi, krizeni, e, d, X1, tEnd,
        pocet: kb - ka, minVnitrni: Math.min(...sirkyVnitrni.slice(ka - 1, kb - 1)) } };
  }

  function geoTocite(p) {
    const { n, h, R, Rin, uhel } = p;
    const B = R - Rin;
    if (B <= 100) throw Chyba('Průměr vřetena / zrcadla musí být aspoň o 200 mm menší než průměr schodiště (' + Math.round(2 * R) + ' mm).', 'vreteno');
    const e = p.vystupni > 0 ? Math.min(p.vystupni, B - 50) : vystupniOdVnejsiho(B), rw = R - e;
    const phi = rad(uhel) / (n - 1);
    const f0 = -Math.PI / 2;
    const b = 2 * rw * Math.sin(phi / 2);
    const polar = (r, f) => [r * Math.cos(f), r * Math.sin(f)];
    const nosy = [], stupne = [];
    for (let k = 1; k <= n; k++) {
      const f = f0 + (k - 1) * phi;
      const o = nos(k, polar(Rin, f), polar(R, f), polar(rw, f), rw * (k - 1) * phi, h); o.f = f; nosy.push(o);
    }
    const N = Math.max(2, Math.ceil(deg(phi) / 4));
    for (let k = 1; k < n; k++) {
      const fa = f0 + (k - 1) * phi, fb = fa + phi;
      stupne.push(stupen(k, oblouk([0, 0], R, fa, fb, N).concat(oblouk([0, 0], Rin, fb, fa, N)), h, 'kosy', 0));
    }
    let plosina = null;
    if (p.plosina > 0) {
      const fa = f0 + rad(uhel), fb = fa + rad(p.plosina), M = Math.max(2, Math.ceil(p.plosina / 4));
      plosina = { k: n, poly: oblouk([0, 0], R, fa, fb, M).concat(oblouk([0, 0], Rin, fb, fa, M)), z: n * h, typ: 'plosina' };
    }
    const cesta = Cesta([{ t: 'o', c: [0, 0], r: rw, f0, f1: f0 + rad(uhel) }]);
    const fE = f0 + rad(uhel);
    return { nosy, stupne, cesta, plosina, vnitrni: null, vnejsi: null,
      ramena: [{ k0: 1, k1: n, smer: [1, 0], typ: 'tocite' }], vystupSmer: [-Math.sin(fE), Math.cos(fE)],
      tocite: { R, Rin, rw, e, phi: deg(phi), b, B, uhel, f0 },
      kose: { sirkyVnitrni: new Array(n - 1).fill(2 * Rin * Math.sin(phi / 2)), sirkyVnejsi: new Array(n - 1).fill(2 * R * Math.sin(phi / 2)),
        sirky400: new Array(n - 1).fill(B > NORMA.kose400.sirkaRamene ? 2 * (Rin + NORMA.kose400.vzdalenost) * Math.sin(phi / 2) : null),
        minVnitrni: 2 * Rin * Math.sin(phi / 2), ka: 1, kb: n, pocet: n - 1, krizeni: false, e, d: rw - Rin } };
  }

  /* zrcadlení (pravotočivé) a posun do kladného kvadrantu */
  function transformuj(g, smer, tocite) {
    const zrc = smer === 'P';
    const vse = [];
    const T0 = q => zrc ? [q[0], -q[1]] : [q[0], q[1]];
    const sbirej = q => { vse.push(T0(q)); };
    g.nosy.forEach(q => { sbirej(q.I); sbirej(q.O); });
    g.stupne.forEach(s => s.poly.forEach(sbirej));
    if (g.plosina) g.plosina.poly.forEach(sbirej);
    if (tocite) { const R = g.tocite.R; vse.push([-R, -R], [R, R]); }
    if (g.vnejsi) g.vnejsi.forEach(sbirej);
    const bb = bboxBodu(vse);
    const T = q => { const a = T0(q); return [a[0] - bb.x0, a[1] - bb.y0]; };
    const posun = [-bb.x0, -bb.y0];
    g.nosy = g.nosy.map(q => Object.assign({}, q, { I: T(q.I), O: T(q.O), W: T(q.W) }));
    g.stupne = g.stupne.map(s => Object.assign({}, s, { poly: s.poly.map(T) }));
    if (g.plosina) g.plosina = Object.assign({}, g.plosina, { poly: g.plosina.poly.map(T) });
    if (g.vnitrni) g.vnitrni = g.vnitrni.map(T);
    if (g.vnejsi) g.vnejsi = g.vnejsi.map(T);
    const tEnd = g.nosy[g.nosy.length - 1].t;
    g.vystupniBody = g.cesta.vzorky(0, tEnd, 20).map(q => ({ t: q.t, p: T(q.p) }));
    g.vystupniBod = t => T(g.cesta.bod(t));
    g.vystupSmer = zrc ? [g.vystupSmer[0], -g.vystupSmer[1]] : g.vystupSmer;
    g.ramena = g.ramena.map(r => Object.assign({}, r, { smer: zrc ? [r.smer[0], -r.smer[1]] : r.smer }));
    if (tocite) g.tocite.stred = T([0, 0]);
    if (g.pasy) g.pasy = g.pasy.map(r => { const a = T([r[0], r[1]]), c = T([r[2], r[3]]); return [Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.max(a[0], c[0]), Math.max(a[1], c[1])]; });
    g.bbox = { x0: 0, y0: 0, x1: bb.w, y1: bb.h, w: bb.w, h: bb.h };
    g.zrcadleno = zrc; g.posun = posun;
    return g;
  }

  function geometrie(p) {
    let g;
    switch (p.typ) {
      case 'dvouramenne': g = geoDvouramenne(p); break;
      case 'L_podesta': g = geoLPodesta(p); break;
      case 'U_podesta': g = geoUPodesta(p); break;
      case 'L_kose': g = geoKose(p, false); break;
      case 'U_kose': g = geoKose(p, true); break;
      case 'tocite': g = geoTocite(p); break;
      default: g = geoPrimo(p);
    }
    return transformuj(g, p.smer, p.typ === 'tocite');
  }

  /* ============================================================
     5. Výchozí stav, normalizace vstupu
     ============================================================ */
  const OCEL_PROFILY_KLICE = { 'UPN 140': 1, 'UPN 160': 1, 'UPN 180': 1, 'UPN 200': 1, 'UPN 220': 1, 'UPN 240': 1, 'P 200×10': 1, 'P 250×12': 1 };
  const VYCHOZI = {
    nazev: 'Schodiště RD', typ: 'primo', smer: 'L', ucel: 'rd_hlavni', bezbar: false,
    vyskaRezim: 'cista', H: 2800, Hhruba: 2800, podlahaDole: 120, podlahaNahore: 120,
    dostDelka: 4600, dostSirka: 1000, dostPrumer: 3000,
    B: 900, Bp: 1000, zrcadlo: 150, Lp: 0, rozdeleni: 'auto', n1: 0, n1Pro: 0, delka1: 0, m1: 0, ext: -1, metoda: 'rozvinuti', vystupni: 0,
    prumer: 2800, vreteno: 900, uhel: 270, plosina: 90,
    tlStropu: 250, otvorAuto: true, otvorH2: false, otvorX: 0, otvorY: 0, otvorDx: 3800, otvorDy: 900,
    n: 0, cil: 'pohodli', bVlastni: 280,
    material: 'drevo', schodnice: 'zapustena', podstupnice: true, nos: 30, tlStupnice: 40, tlPodstupnice: 20,
    schodniceTl: 60, schodniceVys: 300, drazka: 15, deskaTl: 180, ocelProfil: 'UPN 200',
    zabradliStrany: 'vnitrni', hloubkaPadu: 0, deti: false, prickaTl: 20, sloupkyRozestup: 1200,
  };
  const CISLA = {
    H: [1000, 12000], Hhruba: [1000, 12000], podlahaDole: [0, 600], podlahaNahore: [0, 600], dostDelka: [500, 30000], dostSirka: [500, 30000], dostPrumer: [800, 6000],
    B: [500, 4000], Bp: [500, 6000], vystupni: [0, 3000], n1Pro: [0, 80], delka1: [0, 30000], zrcadlo: [0, 3000], Lp: [0, 10000], n1: [0, 60], m1: [0, 60], ext: [-1, 20], prumer: [1000, 6000], vreteno: [0, 3000], uhel: [90, 720], plosina: [0, 180],
    tlStropu: [0, 1500], otvorX: [-20000, 20000], otvorY: [-20000, 20000], otvorDx: [0, 30000], otvorDy: [0, 30000], n: [0, 80], bVlastni: [150, 450],
    nos: [0, 80], tlStupnice: [0, 120], tlPodstupnice: [0, 60], schodniceTl: [20, 200], schodniceVys: [100, 600], drazka: [0, 40], deskaTl: [80, 400],
    hloubkaPadu: [0, 100000], prickaTl: [5, 100], sloupkyRozestup: [300, 3000],
  };
  function normalizuj(s) {
    /* jen známé klíče – cizí vlastnosti (toString, __proto__…) z odkazu či úložiště se ignorují */
    const o = Object.assign({}, VYCHOZI);
    if (s && typeof s === 'object') for (const k of Object.keys(VYCHOZI)) if (Object.prototype.hasOwnProperty.call(s, k)) o[k] = s[k];
    /* migrace: návrh bez volby „rozdeleni“ = dosavadní chování (polovina, nebo zadané n1 / m1) */
    if (!s || typeof s !== 'object' || !Object.prototype.hasOwnProperty.call(s, 'rozdeleni')) {
      const n1 = +o.n1 || 0, m1 = +o.m1 || 0;
      o.rozdeleni = n1 > 0 || m1 > 0 ? 'vlastni' : 'stejne';
      if (jeKose(o.typ) && m1 > 0) o.n1 = m1 + 0.5;
      o.n1Pro = 0; o.delka1 = 0;
    }
    if (!ROZDELENI.includes(o.rozdeleni)) o.rozdeleni = 'auto';
    for (const k in CISLA) {
      let v = +o[k]; if (!isFinite(v)) v = VYCHOZI[k];
      o[k] = Math.min(CISLA[k][1], Math.max(CISLA[k][0], v));
    }
    if (!TYPY[o.typ]) o.typ = 'primo';
    if (!KATEGORIE[o.ucel]) o.ucel = 'rd_hlavni';
    if (o.smer !== 'P') o.smer = 'L';
    if (!['pohodli', 'uspora', 'pudorys', 'vlastni'].includes(o.cil)) o.cil = 'pohodli';
    if (!['drevo', 'zb', 'ocel'].includes(o.material)) o.material = 'drevo';
    if (!['zapustena', 'zubata'].includes(o.schodnice)) o.schodnice = 'zapustena';
    if (!['rozvinuti', 'umernost'].includes(o.metoda)) o.metoda = 'rozvinuti';
    if (!['vnitrni', 'vnejsi', 'obe', 'zadna'].includes(o.zabradliStrany)) o.zabradliStrany = 'vnitrni';
    o.nazev = String(o.nazev == null ? '' : o.nazev).slice(0, 60);
    if (!Object.prototype.hasOwnProperty.call(OCEL_PROFILY_KLICE, o.ocelProfil)) o.ocelProfil = VYCHOZI.ocelProfil;
    o.bezbar = !!o.bezbar && o.bezbar !== 'false'; o.otvorH2 = !!o.otvorH2 && o.otvorH2 !== 'false'; o.otvorAuto = o.otvorAuto !== false && o.otvorAuto !== 'false'; o.podstupnice = o.podstupnice !== false && o.podstupnice !== 'false'; o.deti = !!o.deti && o.deti !== 'false';
    o.n = Math.round(o.n);
    return o;
  }

  /* ============================================================
     6. Návrh pro dané n
     ============================================================ */
  /* ---- rozdělení výšek mezi ramena (lomená a dvouramenná schodiště) ----
     n1 = výšek v 1. rameni; u podest celé číslo (podesta je na hraně n1), u kosých stupňů po půlkách
     (osa otočky leží v t = (n1 − 0,5) · b po výstupní čáře). */
  const TYPY_ROZDELENI = ['dvouramenne', 'L_podesta', 'U_podesta', 'L_kose', 'U_kose'];
  const ROZDELENI = ['auto', 'prostor', 'stejne', 'prvni', 'druhe', 'vlastni'];
  const jeKose = typ => typ === 'L_kose' || typ === 'U_kose';
  function zaokrN1(typ, x) { return jeKose(typ) ? Math.round(x * 2) / 2 : Math.round(x); }
  /* odhad rozměrů [délka, šířka] bez stavby geometrie (pro hledání „podle prostoru“) */
  function odhadRozmeru(s, n, b, n1) {
    const B = s.B, Bp = Math.max(s.Bp, B), z = Math.max(0, s.zrcadlo);
    if (s.typ === 'L_podesta') return [(n1 - 1) * b + Bp, Bp + (n - n1 - 1) * b];
    if (s.typ === 'U_podesta') { const X1 = (n1 - 1) * b, xE = X1 - (n - n1 - 1) * b; return [X1 + Bp - Math.min(0, xE), 2 * B + z]; }
    if (s.typ === 'dvouramenne') return [(n - 2) * b + (s.Lp > 0 ? s.Lp : NORMA.mezipodesta.krok + b), B];
    const e = s.vystupni > 0 ? Math.min(s.vystupni, B - 50) : vystupniOdVnejsiho(B), d = B - e;
    const U = s.typ === 'U_kose', otocka = U ? Math.PI * d + z : Math.PI / 2 * d;
    const X1 = (n1 - 0.5) * b - otocka / 2, T = (n - 1) * b, zbytek = T - X1 - otocka;
    if (X1 < 0 || zbytek < 0) return null;
    if (!U) return [X1 + B, B + zbytek];
    const xE = X1 - zbytek; return [X1 + B - Math.min(0, xE), 2 * B + z];
  }
  function mezeN1(s, n, b) {
    if (!jeKose(s.typ)) return [2, n - 1];
    let lo = 1, hi = n - 1;
    while (lo < hi && !odhadRozmeru(s, n, b, lo)) lo += 0.5;
    while (hi > lo && !odhadRozmeru(s, n, b, hi)) hi -= 0.5;
    return [lo, hi];
  }
  function rozdeleniRamen(s, n, h, b) {
    const kat = kategorie(s.ucel, s.bezbar);
    const kose = jeKose(s.typ);
    const stejne = kose ? n / 2 : Math.ceil(n / 2);
    let rezim = s.rozdeleni;
    if (kat.bezbar && !kose && rezim !== 'stejne') return { n1: stejne, rezim: 'stejne', vynuceno: true };   // bezbariérově stejný počet ve všech ramenech
    const [lo, hi] = mezeN1(s, n, b);
    const omez = x => Math.min(hi, Math.max(lo, zaokrN1(s.typ, x)));
    const vejde = r => r && r[0] <= s.dostDelka + 0.5 && r[1] <= s.dostSirka + 0.5;
    if (rezim === 'stejne') return { n1: omez(stejne), rezim };
    if (rezim === 'prvni') return { n1: omez(n * 2 / 3), rezim };
    if (rezim === 'druhe') return { n1: omez(n / 3), rezim };
    if (rezim === 'vlastni') {
      let x;
      if (s.delka1 > 0) {
        /* délka 1. ramene v mm (rozměr v půdorysu ve směru 1. ramene) */
        const B = s.B, Bp = Math.max(s.Bp, B);
        if (s.typ === 'L_podesta' || s.typ === 'U_podesta') x = (s.delka1 - Bp) / b + 1;
        else if (s.typ === 'dvouramenne') x = s.delka1 / b + 1;
        else {
          const e = s.vystupni > 0 ? Math.min(s.vystupni, B - 50) : vystupniOdVnejsiho(B), d = B - e;
          const otocka = s.typ === 'U_kose' ? Math.PI * d + Math.max(0, s.zrcadlo) : Math.PI / 2 * d;
          x = (s.delka1 - B + otocka / 2) / b + 0.5;
        }
      } else x = s.n1Pro >= 3 ? s.n1 * n / s.n1Pro : s.n1;      // drží poměr ramen při změně počtu výšek
      /* vlastní rozdělení se u kosých stupňů neořezává – nesmyslné zadání ohlásí geometrie srozumitelnou chybou */
      if (!(x > 0)) x = stejne;
      return { n1: kose ? zaokrN1(s.typ, x) : Math.min(n - 1, Math.max(2, Math.round(x))), rezim };
    }
    /* podle prostoru: vejde se → nejvyváženější; nevejde se nic → nejmenší přesah */
    const sym = odhadRozmeru(s, n, b, omez(stejne));
    if (rezim === 'auto' && (vejde(sym) || s.typ === 'dvouramenne')) return { n1: omez(stejne), rezim: 'stejne', auto: true };
    let best = null;
    for (let x = lo; x <= hi + 1e-9; x += kose ? 0.5 : 1) {
      const r = odhadRozmeru(s, n, b, x); if (!r) continue;
      const pres = Math.max(0, r[0] - s.dostDelka) + Math.max(0, r[1] - s.dostSirka);
      const minRam = Math.min(x, n - x);
      const skore = (pres > 0.5 ? 1e6 + pres : 0) + (minRam < 3 ? 1e4 : 0) + Math.abs(x - n / 2);
      if (!best || skore < best.skore) best = { x, skore };
    }
    return { n1: best ? best.x : omez(stejne), rezim: 'prostor', auto: rezim === 'auto' };
  }

  function parametryGeometrie(s, n, h, b) {
    const p = { typ: s.typ, smer: s.smer, n, h, b, B: s.B, Bp: s.Bp, z: s.zrcadlo, metoda: s.metoda, vystupni: s.vystupni };
    if (TYPY_ROZDELENI.includes(s.typ)) p.rozdeleni = rozdeleniRamen(s, n, h, b);
    if (s.typ === 'dvouramenne' || s.typ === 'L_podesta' || s.typ === 'U_podesta') {
      p.n1 = Math.round(p.rozdeleni.n1);
      if (p.n1 < 2) p.n1 = 2;           // podesta musí ležet nad podlahou
      if (p.n1 > n - 1) p.n1 = n - 1;
      p.Lp = s.Lp > 0 ? s.Lp : Math.ceil(NORMA.mezipodesta.krok + b);
    }
    if (s.typ === 'L_kose' || s.typ === 'U_kose') {
      p.m1 = p.rozdeleni.n1 - 0.5;
      p.ext = s.ext >= 0 ? s.ext : -1;
    }
    if (s.typ === 'tocite') { p.R = s.prumer / 2; p.Rin = s.vreteno / 2; p.uhel = s.uhel; p.plosina = s.plosina; }
    return p;
  }

  /* kosé: automatická volba počtu vyrovnávaných stupňů na každé straně */
  function geometrieAuto(s, p) {
    if ((p.typ === 'L_kose' || p.typ === 'U_kose') && p.ext < 0) {
      let nejlepsi = null, chyba = null;
      for (let ext = 1; ext <= 6; ext++) {
        let g; try { g = geometrie(Object.assign({}, p, { ext })); } catch (e) { chyba = e; continue; }
        const k = g.kose; const ok = !k.krizeni && k.minVnitrni >= NORMA.koseMin.hodnota && (s.B <= NORMA.kose400.sirkaRamene || k.sirky400.every(x => x == null || x >= NORMA.bMin.hodnota));
        const skore = (ok ? 0 : 1e6) + (k.krizeni ? 1e7 : 0) - k.minVnitrni + ext * 5;
        if (!nejlepsi || skore < nejlepsi.skore) nejlepsi = { g, skore };
        if (ok && ext >= 2) break;
      }
      if (!nejlepsi) throw chyba || new Error('Kosé stupně nelze vyrovnat.');
      return nejlepsi.g;
    }
    return geometrie(p);
  }

  function sirkaStupne(s, n, h, H) {
    const kat = kategorie(s.ucel, s.bezbar);
    const aMax = sklonMaxPro(kat, H);
    const bUspora = Math.ceil(Math.max(NORMA.krok.min - 2 * h, h / Math.tan(rad(aMax)), Math.max(NORMA.bMin.hodnota, kat.bMin || 0), NORMA.stupniceMin.hodnota - s.nos));
    if (s.cil === 'vlastni') return s.bVlastni;
    if (s.cil === 'uspora') return bUspora;
    if (s.cil === 'pudorys') return null;   // dohledá se podle půdorysu
    return Math.round(NORMA.krok.cil - 2 * h);
  }

  function vejdeSe(s, g) {
    if (s.typ === 'tocite') return { ok: s.prumer <= s.dostPrumer + 0.5, presahX: Math.max(0, s.prumer - s.dostPrumer), presahY: 0 };
    return { ok: g.bbox.w <= s.dostDelka + 0.5 && g.bbox.h <= s.dostSirka + 0.5, presahX: Math.max(0, g.bbox.w - s.dostDelka), presahY: Math.max(0, g.bbox.h - s.dostSirka) };
  }

  function navrh(vstup, nVolba) {
    const s = normalizuj(vstup);
    const H = konstrukcniVyska(s);
    const kat = kategorie(s.ucel, s.bezbar);
    let n = nVolba || (s.n >= 3 ? s.n : 0);
    if (!n) { const vs = varianty(s); const d = vs.find(r => r.doporucena && !r.chyba); n = d ? d.n : doporuceneN(s, H); }
    const h = H / n;
    if (!(H >= 500)) throw Chyba('Konstrukční výška ' + Math.round(H) + ' mm je příliš malá (nejméně 500 mm) – zkontrolujte výšku a skladby podlah.', s.vyskaRezim === 'hruba' ? 'Hhruba' : 'H');
    if (!(n >= 3)) throw Chyba('Počet výšek stupňů musí být aspoň 3.', 'n');
    if (h > 250) throw Chyba('Pro ' + n + ' výšek vychází výška stupně ' + Math.round(h) + ' mm – takový počet výšek nemá smysl.', 'n');
    let b = sirkaStupne(s, n, h, H), g, p;
    if (b != null && !(b >= 100)) throw Chyba('Pro ' + n + ' výšek vychází šířka stupně ' + Math.round(b) + ' mm – takový počet výšek nemá smysl.', 'n');
    if (s.typ === 'tocite') {
      p = parametryGeometrie(s, n, h, 0); g = geometrie(p); b = g.tocite.b;
    } else if (b == null) {
      /* vyplnit půdorys: největší b, které se vejde */
      const bMinimal = Math.max(150, Math.ceil(Math.max(NORMA.krok.min - 2 * h, NORMA.bMin.hodnota, kat.bMin || 0, NORMA.stupniceMin.hodnota - s.nos)));
      let lo = bMinimal, hi = Math.max(bMinimal, Math.min(420, NORMA.krok.max - 2 * h));
      /* rozměr půdorysu na počtu vyrovnávaných stupňů nezávisí – při hledání stačí pevná hodnota */
      const zkus = bb => { try { const pp = parametryGeometrie(s, n, h, bb); if (pp.ext < 0) pp.ext = 2; const gg = geometrie(pp); return vejdeSe(s, gg).ok ? { pp, gg } : null; } catch (e) { return null; } };
      if (zkus(hi)) b = Math.floor(hi);
      else if (zkus(lo)) {
        for (let i = 0; i < 20; i++) { const m = (lo + hi) / 2; if (zkus(m)) lo = m; else hi = m; }
        b = Math.floor(lo);
        if (!zkus(b)) b = Math.max(bMinimal, b - 1);
      } else b = bMinimal;
      p = parametryGeometrie(s, n, h, b); g = geometrieAuto(s, p);
    } else {
      p = parametryGeometrie(s, n, h, b); g = geometrieAuto(s, p);
    }
    if (h > 250 || !(b >= 100)) throw Chyba('Pro ' + n + ' výšek vychází výška stupně ' + Math.round(h) + ' mm a šířka ' + Math.round(b) + ' mm – takový počet výšek nemá smysl.', 'n');
    const alfa = deg(Math.atan2(h, b));
    const vysledek = { s, H, kat, n, h, b, alfa, p, g };
    vysledek.vejde = vejdeSe(s, g);
    if (g.delkyRamen) vysledek.rozdeleni = Object.assign({}, p.rozdeleni || {}, { delky: g.delkyRamen, vysek: g.vysekRamen,
      popis: g.vysekRamen.map(x => String(Math.round(x * 2) / 2).replace('.', ',')).join(' + ') });
    vysledek.podchod = podchodnaVyska(vysledek);
    vysledek.kontroly = kontroly(vysledek);
    pridejOpravy(vysledek.kontroly, vysledek);
    vysledek.souhrn = souhrnKontrol(vysledek.kontroly);
    return vysledek;
  }

  function doporuceneN(s, H) {
    const kat = kategorie(s.ucel, s.bezbar);
    let n = Math.max(3, Math.round(H / kat.hCil));
    while (H / n > kat.hMax && n < 80) n++;
    return n;
  }

  /* ============================================================
     7. Podchodná a průchodná výška, stropní otvor
     ============================================================ */
  function rameno(v, k) { const r = v.g.ramena.findIndex(r => k >= r.k0 && k <= r.k1); return r < 0 ? 0 : r; }

  /* prvky nad bodem: strop mimo otvor, stupně a podesty výš */
  function prvkyNad(v) {
    const { s, h, g } = v;
    const cosA = Math.cos(rad(v.alfa));
    const tlPrvku = st => {
      if (s.material === 'zb') return st.typ === 'podesta' || st.typ === 'plosina' ? s.deskaTl : h + s.deskaTl / cosA;
      return Math.max(20, s.tlStupnice);
    };
    const out = g.stupne.map(st => ({ poly: st.poly, horni: st.z, spodni: st.z - tlPrvku(st), bb: bboxBodu(st.poly), k: st.k }));
    if (g.plosina) out.push({ poly: g.plosina.poly, horni: g.plosina.z, spodni: g.plosina.z - tlPrvku(g.plosina), bb: bboxBodu(g.plosina.poly), k: g.plosina.k });
    return out;
  }
  function stropSpodni(v) { return v.H - v.s.podlahaNahore - v.s.tlStropu; }
  function otvorPoly(o) { return [[o.x, o.y], [o.x + o.dx, o.y], [o.x + o.dx, o.y + o.dy], [o.x, o.y + o.dy]]; }

  function svetlostNad(v, P, zP, prvky, otvor, jenStrop) {
    let min = Infinity, co = null;
    const zs = stropSpodni(v);
    if (!otvor || !vOtvoru(P, otvor)) {
      if (zs - zP < min) { min = zs - zP; co = 'strop'; }
    }
    if (!jenStrop) {
      for (const e of prvky) {
        if (e.horni <= zP + v.h + 1) continue;
        if (P[0] < e.bb.x0 - 1 || P[0] > e.bb.x1 + 1 || P[1] < e.bb.y0 - 1 || P[1] > e.bb.y1 + 1) continue;
        if (!bodVPolygonu(P, e.poly)) continue;
        if (e.spodni - zP < min) { min = e.spodni - zP; co = 'stupen'; }
      }
    }
    return { svetlost: min, co };
  }

  /* výška spojnice hran na výstupní čáře v parametru t (na podestě vodorovně) */
  function vyskaVystupni(v, t) {
    const N = v.g.nosy;
    if (t <= N[0].t) return N[0].z;
    for (let k = 0; k + 1 < N.length; k++) {
      const A = N[k], C = N[k + 1];
      if (t <= C.t + 1e-9) {
        const st = v.g.stupne[k];
        if (st && st.typ === 'podesta') return A.z;
        return A.z + (C.z - A.z) * (t - A.t) / ((C.t - A.t) || 1);
      }
    }
    return N[N.length - 1].z;
  }

  /* body pro návrh otvoru: přední hrany v celé šířce + výstupní čára */
  /* Světlost nad celou plochou ramene: síť uzlů na každém stupni (napříč 6, podél 4 dílů),
     výška = spojnice hran v daném místě, na podestě její povrch. Vrací buňky pro barevnou mapu. */
  function mapaPodchodu(v, otvor, prvky, pozad) {
    const N = v.g.nosy, bunky = [];
    let min = Infinity, kde = null;
    const NL = 6, NP = 4;
    const hodnot = (P, z, info) => {
      const r = svetlostNad(v, P, z, prvky, otvor, false);
      if (r.svetlost < min) { min = r.svetlost; kde = Object.assign({ p: P, z, co: r.co }, info); }
      return r.svetlost;
    };
    for (let k = 0; k + 1 < N.length; k++) {
      const st_ = v.g.stupne[k], A = N[k], C = N[k + 1], posledni = k + 2 === N.length;
      if (st_.typ === 'podesta') {
        const bb = bboxBodu(st_.poly), M = 6;
        const uzel = (i, j) => [bb.x0 + bb.w * i / M, bb.y0 + bb.h * j / M];
        const val = [];
        for (let i = 0; i <= M; i++) { val.push([]); for (let j = 0; j <= M; j++) { const P = uzel(i, j); val[i].push(bodVPolygonu(teziste([P, P, P]), st_.poly) || jeNaObvodu(P, st_.poly) ? hodnot(P, st_.z, { k: k + 1, napric: 0.5, podesta: true }) : null); } }
        for (let i = 0; i < M; i++) for (let j = 0; j < M; j++) {
          const c = [(bb.x0 + bb.w * (i + 0.5) / M), (bb.y0 + bb.h * (j + 0.5) / M)];
          if (!bodVPolygonu(c, st_.poly)) continue;
          const vv = [val[i][j], val[i + 1][j], val[i][j + 1], val[i + 1][j + 1]].filter(x => x != null);
          bunky.push({ poly: [uzel(i, j), uzel(i + 1, j), uzel(i + 1, j + 1), uzel(i, j + 1)], svetlost: vv.length ? Math.min(...vv) : Infinity });
        }
        continue;
      }
      const val = [];
      for (let j = 0; j <= NP; j++) {
        val.push([]);
        const f = j / NP, Ii = lerp(A.I, C.I, f), Oo = lerp(A.O, C.O, f), z = A.z + (C.z - A.z) * f;
        for (let i = 0; i <= NL; i++) {
          if (posledni && j === NP) { val[j].push(Infinity); continue; }     // výstupní hrana = podlaha patra
          const P = lerp(Ii, Oo, i / NL);
          /* u kosých stupňů může spojnice vnitřních bodů přetnout kout mimo schodiště */
          val[j].push(bodVPolygonu(P, st_.poly) || jeNaObvodu(P, st_.poly) ? hodnot(P, z, { k: k + 1, napric: i / NL }) : null);
        }
      }
      const uzel = (j, i) => lerp(lerp(A.I, C.I, j / NP), lerp(A.O, C.O, j / NP), i / NL);
      if (st_.poly.length === 4) {
        /* čtyřúhelníkový stupeň: síť buněk ho pokryje přesně */
        for (let j = 0; j < NP; j++) for (let i = 0; i < NL; i++) {
          const vv = [val[j][i], val[j][i + 1], val[j + 1][i], val[j + 1][i + 1]].filter(x => x != null);
          bunky.push({ poly: [uzel(j, i), uzel(j, i + 1), uzel(j + 1, i + 1), uzel(j + 1, i)], svetlost: vv.length ? Math.min(...vv) : Infinity });
        }
      } else {
        /* stupeň s rohem okraje nebo oblouky (kosý u koutu, točitý): celý polygon jako jedna buňka
           s nejhorším vzorkem – síť + vrcholy + těžiště + body po vnitřní hraně, aby nezůstala díra */
        const vv = [].concat(...val).filter(x => x != null);
        /* výška spojnice hran v bodě: poměr vzdáleností od přední a zadní hrany stupně */
        const odPrimky = (P, a, c) => Math.abs(crs(sub(P, a), sub(c, a))) / (vzd(a, c) || 1);
        const zBodu = P => { const da = odPrimky(P, A.I, A.O), dc = odPrimky(P, C.I, C.O); return A.z + (C.z - A.z) * (da / ((da + dc) || 1)); };
        for (const P of st_.poly) if (!(posledni && odPrimky(P, C.I, C.O) < 1)) vv.push(hodnot(P, zBodu(P), { k: k + 1, napric: 0 }));
        vv.push(hodnot(teziste(st_.poly), (A.z + C.z) / 2, { k: k + 1, napric: 0.5 }));
        /* středy hran polygonu (vnitřní hrana jde přes roh okraje, ne tětivou mimo schodiště) */
        st_.poly.forEach((P, i, arr) => { const M = lerp(P, arr[(i + 1) % arr.length], 0.5); if (!(posledni && odPrimky(M, C.I, C.O) < 1)) vv.push(hodnot(M, zBodu(M), { k: k + 1, napric: 0 })); });
        bunky.push({ poly: st_.poly.map(q => q.slice()), svetlost: Math.min(...vv) });
      }
    }
    for (const b of bunky) b.stav = b.svetlost === Infinity ? 'volno' : b.svetlost < pozad - 0.5 ? 'chyba' : 'ok';
    return { bunky, min, kde };
  }
  function jeNaObvodu(P, poly) {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length], d = sub(b, a), L = dlz(d);
      if (L < 1e-9) continue;
      const t = dot(sub(P, a), d) / (L * L);
      if (t >= -1e-9 && t <= 1 + 1e-9 && Math.abs(crs(sub(P, a), d)) / L < 0.5) return true;
    }
    return false;
  }

  function navrhniOtvor(v, vyskaPotreba) {
    const zs = stropSpodni(v), prah = zs - vyskaPotreba;   // body výš než prah musí být pod otvorem
    const body = [];
    const N = v.g.nosy;
    /* přesná hranice na spojnici hran: mezi nosy k a k+1 roste výška lineárně */
    for (let k = 0; k + 1 < N.length; k++) {
      const A = N[k], C = N[k + 1], st_ = v.g.stupne[k];
      const zA = A.z, zC = st_ && st_.typ === 'podesta' ? A.z : C.z;
      if (zA > prah) { body.push(A.I, A.O, lerp(A.I, A.O, 0.5)); }
      if (zC > prah) { body.push(C.I, C.O); if (st_ && zA > prah) for (const p of st_.poly) body.push(p); }
      if (zA <= prah && zC > prah) {
        const f = (prah - zA) / (zC - zA);
        for (let i = 0; i <= 8; i++) body.push(lerp(lerp(A.I, C.I, f), lerp(A.O, C.O, f), i / 8));
      }
    }
    if (v.g.plosina) for (const p of v.g.plosina.poly) body.push(p);
    const posl = N[N.length - 1];
    body.push(posl.I, posl.O);
    /* u schodišť do L po pásech ramen – otvor do tvaru L, ne přes vnitřní kout */
    const pasy = v.g.pasy || [[v.g.bbox.x0, v.g.bbox.y0, v.g.bbox.x1, v.g.bbox.y1]];
    const obdelniky = [];
    for (const r of pasy) {
      const uvnitr = body.filter(p => p[0] >= r[0] - 0.5 && p[0] <= r[2] + 0.5 && p[1] >= r[1] - 0.5 && p[1] <= r[3] + 0.5);
      if (!uvnitr.length) continue;
      const bb = bboxBodu(uvnitr);
      const X0 = Math.floor(Math.max(r[0], bb.x0)), Y0 = Math.floor(Math.max(r[1], bb.y0));
      const X1 = Math.ceil(Math.min(r[2], bb.x1)), Y1 = Math.ceil(Math.min(r[3], bb.y1));
      if (X1 - X0 > 0.5 && Y1 - Y0 > 0.5) obdelniky.push({ x: X0, y: Y0, dx: X1 - X0, dy: Y1 - Y0 });
    }
    return otvorZObdelniku(obdelniky);
  }
  function otvorZObdelniku(obdelniky) {
    if (!obdelniky.length) return { x: 0, y: 0, dx: 0, dy: 0, obdelniky: [], obrys: [] };
    const bb = bboxBodu(obdelniky.flatMap(r => [[r.x, r.y], [r.x + r.dx, r.y + r.dy]]));
    return { x: bb.x0, y: bb.y0, dx: bb.w, dy: bb.h, obdelniky, obrys: sjednoceniObdelniku(obdelniky), tvarL: obdelniky.length > 1 };
  }
  function vOtvoru(P, o) {
    const R = o.obdelniky || [o];
    return R.some(r => P[0] >= r.x - 1e-6 && P[0] <= r.x + r.dx + 1e-6 && P[1] >= r.y - 1e-6 && P[1] <= r.y + r.dy + 1e-6);
  }
  /* obrys sjednocení osově rovnoběžných obdélníků (smyčky proti směru hodinových ručiček) */
  function sjednoceniObdelniku(R) {
    const xs = [...new Set(R.flatMap(r => [r.x, r.x + r.dx]))].sort((a, b) => a - b);
    const ys = [...new Set(R.flatMap(r => [r.y, r.y + r.dy]))].sort((a, b) => a - b);
    const cov = (i, j) => {
      if (i < 0 || j < 0 || i >= xs.length - 1 || j >= ys.length - 1) return false;
      const cx = (xs[i] + xs[i + 1]) / 2, cy = (ys[j] + ys[j + 1]) / 2;
      return R.some(r => cx > r.x && cx < r.x + r.dx && cy > r.y && cy < r.y + r.dy);
    };
    const hrany = [];
    for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < ys.length - 1; j++) {
      if (!cov(i, j)) continue;
      const a = [xs[i], ys[j]], b = [xs[i + 1], ys[j]], c = [xs[i + 1], ys[j + 1]], d = [xs[i], ys[j + 1]];
      if (!cov(i, j - 1)) hrany.push([a, b]);
      if (!cov(i + 1, j)) hrany.push([b, c]);
      if (!cov(i, j + 1)) hrany.push([c, d]);
      if (!cov(i - 1, j)) hrany.push([d, a]);
    }
    const klic = p => p[0] + ',' + p[1];
    const zac = new Map(); for (const h of hrany) { const k = klic(h[0]); if (!zac.has(k)) zac.set(k, []); zac.get(k).push(h); }
    const pouzite = new Set(), smycky = [];
    for (const h0 of hrany) {
      if (pouzite.has(h0)) continue;
      const smycka = []; let h = h0;
      while (h && !pouzite.has(h)) {
        pouzite.add(h); smycka.push(h[0]);
        const dalsi = (zac.get(klic(h[1])) || []).find(x => !pouzite.has(x));
        h = dalsi;
      }
      /* sloučit body na přímce */
      const out = smycka.filter((p, i) => {
        const a = smycka[(i - 1 + smycka.length) % smycka.length], b = smycka[(i + 1) % smycka.length];
        return Math.abs((p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0])) > 1e-9;
      });
      if (out.length >= 4) smycky.push(out);
    }
    return smycky;
  }

  function podchodnaVyska(v) {
    const { s, kat } = v;
    const h1 = h1Pozadovana(kat, v.alfa), h2 = h2Pozadovana(kat, v.alfa);
    const cosA = Math.cos(rad(v.alfa));
    const potrebaOtvor = (kat.h2 === 'povinne' || s.otvorH2) ? Math.max(h1, h2 / cosA) : h1;
    const otvorNavrh = navrhniOtvor(v, potrebaOtvor);
    const otvorNavrhH2 = navrhniOtvor(v, Math.max(h1, h2 / cosA));
    const otvor = s.otvorAuto ? otvorNavrh : otvorZObdelniku(s.otvorDx > 0 && s.otvorDy > 0 ? [{ x: s.otvorX, y: s.otvorY, dx: s.otvorDx, dy: s.otvorDy }] : []);
    const prvky = prvkyNad(v);
    let min = Infinity, kde = null; const profil = [];
    const tKonec = v.g.nosy[v.g.nosy.length - 1].t - 1;
    const vOtv = P => vOtvoru(P, otvor);
    const zkus = t => {
      const P = v.g.vystupniBod(t), z = vyskaVystupni(v, t);
      const r = svetlostNad(v, P, z, prvky, otvor, false);
      profil.push({ t, z, nad: r.svetlost === Infinity ? null : z + r.svetlost, co: r.co });
      if (r.svetlost < min) { min = r.svetlost; kde = { t, p: P, z, co: r.co }; }
    };
    const N = Math.max(2, Math.ceil(tKonec / 5));
    let predIn = null, predT = 0;
    for (let i = 0; i <= N; i++) {
      const t = tKonec * i / N, P = v.g.vystupniBod(t), inn = vOtv(P);
      if (predIn !== null && inn !== predIn) {
        /* přechod hranou otvoru – dohledat a vyhodnotit těsně vně */
        let a = predT, c = t;
        for (let j = 0; j < 30; j++) { const m = (a + c) / 2; if (vOtv(v.g.vystupniBod(m)) === predIn) a = m; else c = m; }
        zkus(predIn ? c : a);
      }
      zkus(t); predIn = inn; predT = t;
    }
    profil.sort((x, y) => x.t - y.t);
    /* světlost nad celou průchodnou šířkou (síť přes plochu ramene) */
    const mapa = mapaPodchodu(v, otvor, prvky, h1);
    const minVystupni = min, kdeVystupni = kde;
    let celkem = min, kdeCelkem = kde ? Object.assign({ napric: null }, kde) : null;
    if (mapa.min < min - 0.5) { celkem = mapa.min; kdeCelkem = mapa.kde; }
    return { h1Pozad: h1, h2Pozad: h2, min: celkem, kde: kdeCelkem, minVystupni, kdeVystupni, minPlocha: mapa.min, mapa: mapa.bunky,
      h2: minVystupni === Infinity ? Infinity : minVystupni * cosA, profil, otvor, otvorNavrh, otvorNavrhH2, potrebaOtvor };
  }

  /* ============================================================
     8. Kontroly
     ============================================================ */
  const mm = x => Math.round(x).toLocaleString('cs-CZ') + ' mm';
  const popisSvetlosti = (min, pozad) => min <= 0 ? 'kolize s konstrukcí (chybí ' + Math.round(pozad - min).toLocaleString('cs-CZ') + ' mm)' : mm(min);
  const mm1 = x => (Math.round(x * 10) / 10).toLocaleString('cs-CZ') + ' mm';
  const st = x => (Math.round(x * 10) / 10).toLocaleString('cs-CZ') + '°';
  function popisMista(kde) {
    if (!kde) return '';
    const co = kde.co === 'strop' ? 'hrana stropu' : 'schodiště nad sebou';
    if (kde.t != null) return co + ' nad výstupní čárou ve vzdálenosti ' + mm(kde.t) + ' od nástupu';
    if (kde.podesta) return co + ' nad podestou (stupeň ' + kde.k + ')';
    const strana = kde.napric <= 0.2 ? 'u vnitřního okraje' : kde.napric >= 0.8 ? 'u vnějšího okraje' : 'uprostřed šířky';
    return co + ' nad stupněm ' + kde.k + ' ' + strana;
  }
  function K(id, nazev, hodnota, pozadavek, stav, zdroj, pole, pozn) { return { id, nazev, hodnota, pozadavek, stav, zdroj, pole, pozn }; }

  function kontroly(v) {
    const { s, kat, H, n, h, b, alfa, g } = v;
    const out = [];
    const aMax = sklonMaxPro(kat, H);
    /* výška stupně */
    out.push(K('h', 'Výška stupně h', mm1(h), (kat.hMax ? '≤ ' + kat.hMax + ' mm, optimálně ' + kat.hDopMin + '–' + kat.hDopMax + ' mm' : ''),
      h > kat.hMax + 1e-9 ? 'chyba' : (h > kat.hDopMax + 1e-9 || h < 130) ? 'mez' : 'ok', kat.zdroj, 'H'));
    /* šířka stupně */
    const bMin = Math.max(NORMA.bMin.hodnota, kat.bMin || 0);
    out.push(K('b', 'Šířka stupně b (na výstupní čáře)', mm1(b), '≥ ' + bMin + ' mm', b < bMin - 1e-9 ? 'chyba' : 'ok', bMin > 210 ? kat.zdroj : NORMA.bMin.zdroj, 'bVlastni'));
    const stupnice = b + (s.material === 'zb' ? 0 : s.nos);
    out.push(K('stupnice', 'Šířka stupnice b + přesah', mm1(stupnice), '≥ ' + NORMA.stupniceMin.hodnota + ' mm', stupnice < NORMA.stupniceMin.hodnota - 1e-9 ? 'chyba' : 'ok', NORMA.stupniceMin.zdroj, 'nos'));
    /* krok */
    const kr = 2 * h + b;
    out.push(K('krok', 'Krokový vzorec 2h + b', mm1(kr), '630 mm (600–650)', kr < NORMA.krok.min - 1e-9 || kr > NORMA.krok.max + 1e-9 ? 'chyba' : (kr < NORMA.krok.okMin || kr > NORMA.krok.okMax) ? 'mez' : 'ok', NORMA.krok.zdroj, 'bVlastni'));
    out.push(K('pohodli', 'Pohodlnost b − h', mm1(b - h), '≈ 120 mm (doporučení)', Math.abs(b - h - NORMA.pohodli.cil) <= NORMA.pohodli.tol ? 'ok' : 'mez', NORMA.pohodli.zdroj, 'bVlastni'));
    out.push(K('bezpecnost', 'Bezpečnost h + b', mm1(h + b), '≈ 460 mm (doporučení)', Math.abs(h + b - NORMA.bezpecnost.cil) <= NORMA.bezpecnost.tol ? 'ok' : 'mez', NORMA.bezpecnost.zdroj, 'bVlastni'));
    /* sklon */
    let sklonStav = alfa > aMax + 1e-9 ? 'chyba' : 'ok';
    if (sklonStav === 'ok' && kat.sklonMinDop && alfa <= kat.sklonMinDop) sklonStav = 'mez';
    out.push(K('sklon', 'Sklon ramene α', st(alfa) + ' (' + sklonTrida(alfa) + ')',
      (kat.sklonMinDop ? kat.sklonMinDop + '° < α ≤ ' : '≤ ') + aMax + '°' + (kat.sklonMaxVyjimka && aMax === kat.sklonMaxVyjimka ? ' (konstr. výška ≤ 3 000 mm)' : ''), sklonStav, kat.zdroj, 'H'));
    /* počet výšek v ramenech */
    const pocty = g.ramena.map(r => r.k1 - r.k0 + 1);
    const pMin = kat.pMin || NORMA.pMin.hodnota;
    const pStav = pocty.some(p => p < pMin || p > kat.pMax) ? 'chyba' : 'ok';
    out.push(K('pocet', 'Počet výšek v rameni', pocty.join(' + '), pMin + ' až ' + kat.pMax, pStav, ['csn', 'ckait', 'cvut'], s.typ === 'primo' ? 'typ' : 'n1'));
    if (pocty.length > 1 && (kat.bezbar ? Math.max(...pocty) !== Math.min(...pocty) : Math.max(...pocty) - Math.min(...pocty) > 1))
      out.push(K('pocetStejny', 'Stejný počet výšek v ramenech', pocty.join(' + '), kat.bezbar ? 'bezbariérově povinně stejně (vyhl. 398/2009 příl. 1 čl. 2.0.2)' : 'doporučeno stejně', kat.bezbar ? 'chyba' : 'mez', kat.bezbar ? ['ckait'] : NORMA.pMin.zdroj, 'n1'));
    if (kat.bezbar && s.material !== 'zb') {
      out.push(K('bezbarNos', 'Přesah stupnice (bezbariérově)', mm(s.nos), '0 mm – stupnice a podstupnice kolmé (u změn staveb ≤ 25 mm)', s.nos > 0 ? 'chyba' : 'ok', ['ckait'], 'nos'));
      out.push(K('bezbarPodst', 'Podstupnice (bezbariérově)', s.podstupnice ? 'ano' : 'otevřené schodiště', 'povinné – uzavřené stupně', s.podstupnice ? 'ok' : 'chyba', ['ckait'], 'podstupnice'));
    }
    /* stejné výšky */
    const hz = Math.abs(g.nosy[n - 1].z - H);
    if (v.rozdeleni) {
      const r = v.rozdeleni, popisRezimu = { stejne: 'stejně dlouhá', prvni: 'delší 1. rameno', druhe: 'delší 2. rameno', vlastni: 'vlastní', prostor: 'podle prostoru' }[r.rezim] || r.rezim;
      out.push(K('rozdeleni', 'Rozdělení ramen', r.popis + ' výšek · ' + r.delky.map((d, i) => (i + 1) + '. rameno ' + mm(d)).join(' · '), popisRezimu + (r.auto ? ' (automaticky)' : ''), 'info', ['csn'], 'rozdeleni',
        r.vynuceno ? 'Bezbariérově užívané schodiště musí mít ve všech ramenech stejný počet stupňů (vyhl. 398/2009 příl. 1 čl. 2.0.2) – rozdělení je vynucené jako stejně dlouhá ramena.' :
        jeKose(s.typ) ? 'U kosých stupňů je celé schodiště jedno rameno; rozdělení určuje polohu osy otočky (délky jsou rozměry v půdorysu).' : ''));
    }
    out.push(K('stejne', 'Všechny výšky stupňů stejné', n + ' × ' + mm1(h) + ' = ' + mm(n * h), 'poslední hrana = konstrukční výška', hz < 0.01 ? 'ok' : 'chyba', ['v146', 'csn'], 'H'));
    /* šířka ramene */
    const Bw = s.typ === 'tocite' ? g.tocite.B : s.B;
    out.push(K('B', 'Šířka ramene', mm(Bw), '≥ ' + kat.Bmin + ' mm', Bw < kat.Bmin - 1e-9 ? 'chyba' : 'ok', kat.zdroj, s.typ === 'tocite' ? 'prumer' : 'B'));
    /* podesty */
    if (['dvouramenne', 'L_podesta', 'U_podesta'].includes(s.typ)) {
      if (s.typ === 'dvouramenne') {
        const Lp = v.p.Lp, pozad = NORMA.mezipodesta.krok + b;
        out.push(K('mezipodesta', 'Délka mezipodesty', mm(Lp), '≥ 630 + b = ' + mm(pozad), Lp < pozad - 0.5 ? 'chyba' : 'ok', NORMA.mezipodesta.zdroj, 'Lp'));
      } else {
        out.push(K('podesta', 'Hloubka podesty', mm(Math.max(s.Bp, s.B)), '≥ šířka ramene ' + mm(s.B), s.Bp < s.B - 0.5 ? 'chyba' : 'ok', NORMA.podlazniPodesta.zdroj, 'Bp',
          s.Bp < s.B ? 'Podesta se automaticky zvětšila na šířku ramene.' : ''));
      }
    }
    if (s.material !== 'zb' && s.typ !== 'tocite') {
      const zasah = s.schodniceTl;
      out.push(K('zasahy', 'Zásahy do průchodné šířky', 'schodnice ' + mm(zasah) + ', volně mezi schodnicemi ' + mm(s.B - 2 * zasah), 'schodnice ≤ 200 mm, madlo/zábradlí ≤ 100 mm (u obou stran ≤ 50 mm)', zasah > 200 ? 'chyba' : 'info', ['dashofer', 'cvut', 'ckait'], 'schodniceTl',
        'Průchodná šířka B se měří mezi stěnami / vnějšími okraji ramene; schodnice, madla a zábradlí do ní smějí zasahovat jen omezeně.'));
    }
    out.push(K('podlazni', 'Podlažní podesta (nástup / výstup)', 'volný prostor před nástupem a za výstupem', '≥ ' + mm(Bw) + ', doporučeno ' + mm(Bw + NORMA.podlazniPodesta.pridavek) + ' a víc', 'info', NORMA.podlazniPodesta.zdroj, 'B'));
    /* kosé stupně */
    if (g.kose) {
      if (!kat.kose) out.push(K('koseZakaz', 'Kosé / točité stupně', 'použity', 'v této kategorii jen přímá ramena', 'chyba', kat.zdroj, 'typ'));
      const minV = g.kose.minVnitrni;
      out.push(K('koseMin', 'Kosý stupeň v nejužším místě', mm(minV), '≥ ' + NORMA.koseMin.hodnota + ' mm', minV < NORMA.koseMin.hodnota - 1e-9 ? 'chyba' : 'ok', NORMA.koseMin.zdroj, s.typ === 'tocite' ? 'vreteno' : 'ext'));
      if (Bw > NORMA.kose400.sirkaRamene) {
        const s4 = g.kose.sirky400.filter(x => x != null);
        const m4 = s4.length ? Math.min(...s4) : null;
        const pozad = Math.max(NORMA.bMin.hodnota, NORMA.stupniceMin.hodnota - s.nos);
        out.push(K('kose400', 'Kosý stupeň 400 mm od vnitřního okraje', m4 == null ? '–' : mm(m4), '≥ ' + pozad + ' mm (stupeň 210, stupnice 250)', m4 != null && m4 < pozad - 1e-9 ? 'chyba' : 'ok', NORMA.kose400.zdroj, 'ext'));
      }
      if (g.kose.krizeni) out.push(K('krizeni', 'Přední hrany kosých stupňů', 'kříží se', 'nesmí se křížit', 'chyba', NORMA.koseMin.zdroj, 'ext'));
      const eN = vystupniOdVnejsiho(Bw), eS = g.kose.e;
      const vlastni = s.vystupni > 0 && Math.abs(eS - eN) > 1;
      out.push(K('vystupni', 'Poloha výstupní čáry', mm(eS) + ' od vnějšího okraje (' + mm(Bw - eS) + ' od vnitřního)', 'ČSN 73 4130 čl. 6.4: ' + mm(eN) + ' od vnějšího okraje při šířce ramene ' + mm(Bw), vlastni ? 'mez' : 'info', NORMA.vystupniCara.zdroj, 'vystupni',
        (vlastni ? 'Zadaná poloha se liší od pravidla normy – šířka stupně b platí na zadané čáře. ' : '') + NORMA.vystupniCara.citace));
    }
    if (g.tocite) {
      out.push(K('uhelStupne', 'Úhel na stupeň', st(g.tocite.phi) + ' × ' + (n - 1) + ' = ' + st(g.tocite.phi * (n - 1)), 'zadaný úhel ' + st(s.uhel), 'info', ['csn'], 'uhel'));
    }
    /* podchodná výška */
    const pv = v.podchod;
    const h1Txt = kat.h1 === 'rd' ? '≥ 2 100 mm' : '≥ 1 500 + 750 / cos α = ' + mm(pv.h1Pozad);
    const misto = popisMista(pv.kde);
    const chybi = pv.h1Pozad - pv.min;
    out.push(K('h1', 'Podchodná výška (svisle)', pv.min === Infinity ? 'nic nad schodištěm' : popisSvetlosti(pv.min, pv.h1Pozad), h1Txt, pv.min < pv.h1Pozad - 0.5 ? 'chyba' : 'ok', NORMA.h1.zdroj, s.otvorAuto ? 'tlStropu' : 'otvorDx',
      pv.min <= 0 ? 'Schodiště naráží do ' + (pv.kde && pv.kde.co === 'strop' ? 'stropu' : 'konstrukce nad sebou') + ' – do požadované výšky ' + mm(pv.h1Pozad) + ' chybí ' + mm(chybi) + ' (' + misto + '). Zvětšete stropní otvor.'
        : chybi > 0.5 ? 'Chybí ' + mm(chybi) + ' – nejtěsnější místo: ' + misto + '.' : pv.kde ? 'Nejtěsnější místo: ' + misto + '.' : ''));
    const h2Stav = pv.h2 < pv.h2Pozad - 0.5 ? (kat.h2 === 'povinne' ? 'chyba' : 'mez') : 'ok';
    out.push(K('h2', 'Průchodná výška (kolmo)', pv.h2 === Infinity ? '–' : pv.h2 <= 0 ? 'kolize' : mm(pv.h2), '≥ ' + mm(pv.h2Pozad) + (kat.h2 !== 'povinne' ? ' (doporučení)' : ''), h2Stav, NORMA.h2.zdroj, 'otvorDx',
      kat.h2 !== 'povinne' && h2Stav !== 'ok' ? 'Podle normy se posuzuje hlavně při manipulaci s rozměrnými předměty – u RD a pomocných schodišť proto upozornění, ne chyba. Splnění vyžaduje otvor ' + mm(pv.otvorNavrhH2.dx) + ' × ' + mm(pv.otvorNavrhH2.dy) + ' (volba „otvor i pro průchodnou výšku“).' : ''));
    if (!s.otvorAuto) {
      const o = pv.otvorNavrh;
      out.push(K('otvor', 'Stropní otvor (zadaný)', mm(s.otvorDx) + ' × ' + mm(s.otvorDy), 'potřeba aspoň ' + mm(o.dx) + ' × ' + mm(o.dy), pv.min < pv.h1Pozad - 0.5 ? 'chyba' : 'ok', NORMA.h1.zdroj, 'otvorDx'));
    }
    /* půdorys */
    const vj = v.vejde;
    const pudTxt = s.typ === 'tocite' ? 'průměr ' + mm(s.prumer) : mm(g.bbox.w) + ' × ' + mm(g.bbox.h);
    const dostTxt = s.typ === 'tocite' ? 'dostupný průměr ' + mm(s.dostPrumer) : 'dostupné ' + mm(s.dostDelka) + ' × ' + mm(s.dostSirka);
    out.push(K('pudorys', 'Vejde se do půdorysu', pudTxt, dostTxt, vj.ok ? 'ok' : 'chyba', [], s.typ === 'tocite' ? 'dostPrumer' : 'dostDelka',
      vj.ok ? '' : 'Přesah ' + [vj.presahX > 0 ? mm(vj.presahX) + ' na délku' : '', vj.presahY > 0 ? mm(vj.presahY) + ' na šířku' : ''].filter(Boolean).join(', ') + '.'));
    /* zábradlí a madlo */
    const zb = zabradli(v);
    out.push(K('zabradli', 'Výška zábradlí', zb.strany.length ? mm(zb.vyska) : 'bez volného okraje', zb.strany.length ? 'hloubka volného prostoru ' + mm(zb.hloubka) : '–', 'info', NORMA.zabradli.zdroj, 'zabradliStrany'));
    if (zb.strany.length) {
      out.push(K('mezery', 'Mezery ve výplni zábradlí (největší)', mm(zb.mezeraSkutecna), '≤ ' + zb.mezera + ' mm (koule ⌀ ' + zb.mezera + ' mm neprojde)', zb.mezeraSkutecna <= zb.mezera + 1e-9 ? 'ok' : 'chyba', NORMA.zabradli.zdroj, 'prickaTl',
        'Příčle rozpočítané po stupních podle skutečné šířky stupně na straně zábradlí (' + zb.naStupen + ' na nejširší stupeň).'));
      const sp = s.deti ? NORMA.zabradli.spodniDeti : NORMA.zabradli.spodni;
      out.push(K('spodniMezera', 'Mezera u pochozí plochy', 'příčle kotvené do stupňů / schodnice', '≤ ' + sp + ' mm; trojúhelník stupeň – vodorovná výplň ≤ ' + NORMA.zabradli.mezera + ' mm', 'info', NORMA.zabradli.zdroj, 'zabradliStrany',
        'Při výplni nad spodním vodorovným pásem hlídejte mezeru mezi hranou stupně a výplní.'));
      if (s.deti) out.push(K('deti', 'Provoz pro děti', 'mezery ≤ 80 mm, výplň do 750 mm nepřelezitelná', 'svislé příčle bez vodorovných prvků, druhé madlo 400–700 mm', 'info', NORMA.zabradli.zdroj, 'deti'));
    }
    /* orientační statika dřevěných schodnic (ne normový požadavek) */
    if (s.material === 'drevo') {
      g.ramena.forEach((r, i) => {
        const sch = schodnice(v, i); if (!sch) return;
        const st_ = sch.statika, pres = st_.vyuziti > 1 || st_.prohyb > st_.limit;
        out.push(K('statika' + i, 'Schodnice ramene ' + (i + 1) + ' – orientační statika', 'σ ' + Math.round(st_.vyuziti * 100) + ' %, průhyb ' + (Math.round(st_.prohyb * 10) / 10).toLocaleString('cs-CZ') + ' / ' + (Math.round(st_.limit * 10) / 10).toLocaleString('cs-CZ') + ' mm',
          'σ ≤ 100 %, průhyb ≤ L/300 (odhad, C24)', pres ? 'mez' : 'ok', NORMA.zatizeni.zdroj.concat(['ec5']), 'schodniceVys',
          pres ? 'Orientačně nevyhovuje – zvětšete výšku schodnice' + (st_.doporucena ? ' na ' + st_.doporucena + ' mm' : '') + ' nebo přidejte podporu. Není to normová kontrola, průřez musí posoudit statik.' : 'Jen hrubý odhad, průřez posoudí statik.'));
        if (i === 0) {
          const su = st_.stupnice, presS = su.vyuziti > 1;
          out.push(K('statikaStupnice', 'Stupnice – břemeno 2 kN (orientačně)', 'σ ' + Math.round(su.vyuziti * 100) + ' % při rozpětí ' + mm(su.Ls), 'σ ≤ 100 % (C24)', presS ? 'mez' : 'ok', NORMA.zatizeni.zdroj.concat(['ec5']), 'tlStupnice',
            presS ? 'Stupnice tl. ' + s.tlStupnice + ' mm orientačně nevyhoví' + (su.doporucena ? ' – zvolte aspoň ' + su.doporucena + ' mm' : '') + ' nebo zkraťte rozpětí (střední schodnice).' : ''));
        }
      });
    }
    if (s.material === 'zb') {
      const r0 = g.ramena.reduce((a, r) => (r.k1 - r.k0 > a.k1 - a.k0 ? r : a), g.ramena[0]);
      const L = (g.nosy[r0.k1 - 1].t - g.nosy[r0.k0 - 1].t + v.b) / Math.cos(rad(alfa));
      const sti = L / s.deskaTl;
      out.push(K('deska', 'Deska ramene – štíhlost (orientačně)', 'L/d = ' + Math.round(sti) + ' (L ≈ ' + mm(L) + ')', 'obvykle L/25 až L/30', sti > NORMA.deska.stihlostMax ? 'mez' : 'ok', NORMA.deska.zdroj, 'deskaTl',
        sti > NORMA.deska.stihlostMax ? 'Deska je na rozpětí štíhlá – orientačně tloušťka aspoň ' + mm(Math.ceil(L / NORMA.deska.stihlostMax / 10) * 10) + '. Není to normová kontrola, desku navrhuje statik.' : NORMA.deska.pozn));
    }
    out.push(K('madlo', 'Madlo', zb.madloStrany === 2 ? 'po obou stranách' : 'aspoň po jedné straně', mm(NORMA.madlo.min) + '–' + mm(NORMA.madlo.max) + ' nad hranou stupně', 'info', NORMA.madlo.zdroj, 'B'));
    return out;
  }
  /* konkrétní náprava u nevyhovujících kontrol (stránka z ní dělá tlačítko „Opravit“) */
  function pridejOpravy(out, v) {
    const { s, kat } = v;
    const O = (text, zmena) => ({ text, zmena });
    for (const k of out) {
      if (k.stav !== 'chyba' && k.stav !== 'mez') continue;
      let o = null;
      if (k.id === 'h1' && !s.otvorAuto) o = O('Navrhnout otvor automaticky', { otvorAuto: true });
      else if (k.id === 'h2' && !(s.otvorAuto && s.otvorH2)) o = O('Otvor i pro průchodnou výšku', { otvorAuto: true, otvorH2: true });
      else if (k.id === 'B') o = O('Šířka ramene ' + kat.Bmin + ' mm', { B: kat.Bmin });
      else if (k.id === 'podesta') o = O('Podesta jako šířka ramene', { Bp: s.B });
      else if (k.id === 'mezipodesta') o = O('Mezipodesta 630 mm + b', { Lp: 0 });
      else if (k.id === 'pudorys' && s.cil !== 'uspora') o = O('Úspora místa (nejkratší vyhovující b)', { cil: 'uspora', n: 0 });
      else if (['h', 'b', 'krok', 'sklon', 'stupnice', 'pohodli', 'bezpecnost'].includes(k.id)) {
        if (s.cil === 'vlastni') o = O('Šířka b podle pohodlí', { cil: 'pohodli' });
        else if (s.n >= 3) o = O('Doporučená varianta', { n: 0 });
      } else if (k.id === 'koseMin' || k.id === 'kose400' || k.id === 'krizeni') {
        if (s.typ === 'U_kose') o = O('Zrcadlo o 100 mm širší', { zrcadlo: s.zrcadlo + 100 });
        else if (s.typ === 'tocite') o = O('Zrcadlo / vřeteno o 100 mm větší', { vreteno: s.vreteno + 100 });
        else if (s.ext >= 0 || s.metoda !== 'rozvinuti') o = O('Automatické vyrovnání (rozvinutí)', { ext: -1, metoda: 'rozvinuti' });
      } else if (k.id.startsWith('statika') && k.id !== 'statikaStupnice') {
        const sch = schodnice(v, +k.id.slice(7) || 0);
        if (sch && sch.statika.doporucena) o = O('Schodnice ' + sch.statika.doporucena + ' mm', { schodniceVys: sch.statika.doporucena });
      } else if (k.id === 'statikaStupnice') {
        const sch = schodnice(v, 0);
        if (sch && sch.statika.stupnice.doporucena) o = O('Stupnice ' + sch.statika.stupnice.doporucena + ' mm', { tlStupnice: sch.statika.stupnice.doporucena });
      } else if (k.id === 'deska') {
        const m = /(\d[\d\s\u00a0]*) mm\./.exec(k.pozn || '');
        if (m) o = O('Deska ' + m[1].trim() + ' mm', { deskaTl: +m[1].replace(/\D/g, '') });
      } else if (k.id === 'bezbarNos') o = O('Bez přesahu nosu', { nos: 0 });
      else if (k.id === 'bezbarPodst') o = O('S podstupnicemi', { podstupnice: true });
      else if (k.id === 'pocetStejny') o = O('Stejně výšek v ramenech', { n: v.n % 2 ? v.n + 1 : v.n, n1: 0 });
      else if (k.id === 'koseZakaz') o = O('Přímé dvouramenné', { typ: 'dvouramenne', n: 0 });
      if (o) k.oprava = o;
    }
  }
  function souhrnKontrol(k) {
    const c = k.filter(x => x.stav === 'chyba').length, m = k.filter(x => x.stav === 'mez').length;
    return { chyby: c, meze: m, stav: c ? 'chyba' : m ? 'mez' : 'ok' };
  }

  /* ============================================================
     9. Varianty n−2 … n+2
     ============================================================ */
  /* Varianty: projde se celý rozumný rozsah n (u kosých a točitých tvarů b závisí na délce
     výstupní čáry, takže okolí n z H nestačí), doporučí se nejlepší – vyhovující má vždy přednost.
     Vrací 5 řádků kolem zvoleného / doporučeného n (doporučený řádek je vždy mezi nimi). */
  function hodnotVariantu(s, n) {
    let v = null, chyba = null;
    try { v = navrh(s, n); } catch (e) { chyba = e.message; }
    const r = { n, chyba };
    if (v) {
      r.h = v.h; r.b = v.b; r.alfa = v.alfa; r.krok = 2 * v.h + v.b; r.delka = v.g.nosy[v.n - 1].t;
      r.pudorys = s.typ === 'tocite' ? null : [v.g.bbox.w, v.g.bbox.h];
      r.kontroly = {}; for (const k of v.kontroly) r.kontroly[k.id] = k.stav;
      r.souhrn = v.souhrn;
      r.skore = v.souhrn.chyby * 1000 + v.souhrn.meze * 40 + (s.cil === 'uspora' ? r.delka / 40 : Math.abs(r.krok - 630) + 0.3 * Math.abs(v.b - v.h - 120));
    } else r.skore = 1e9;
    return r;
  }
  function rozsahVariant(s, H) {
    let nMin = 3;
    if (['dvouramenne', 'L_podesta', 'U_podesta'].includes(s.typ)) nMin = 6;
    if (['L_kose', 'U_kose', 'tocite'].includes(s.typ)) nMin = 5;
    /* výška stupně zhruba 120–230 mm */
    return [Math.max(nMin, Math.floor(H / 230)), Math.max(nMin + 4, Math.ceil(H / 120))];
  }
  function varianty(vstup) {
    const s = normalizuj(vstup);
    const H = konstrukcniVyska(s);
    const [nMin, nMax] = rozsahVariant(s, H);
    const vse = new Map();
    for (let n = nMin; n <= nMax; n++) vse.set(n, hodnotVariantu(Object.assign({}, s, { n: 0 }), n));
    let best = null; for (const r of vse.values()) if (!best || r.skore < best.skore) best = r;
    best.doporucena = true;
    const stred = s.n >= 3 ? s.n : best.n;
    let start = Math.max(nMin, Math.min(stred - 2, nMax - 4));
    const out = [];
    for (let n = start; n < start + 5; n++) out.push(vse.has(n) ? vse.get(n) : hodnotVariantu(Object.assign({}, s, { n: 0 }), n));
    if (!out.includes(best)) { out.push(best); out.sort((a, c) => a.n - c.n); }
    return out;
  }

  /* ============================================================
     10. Schodnice (dřevo / ocel) pro přímá ramena
     ============================================================ */
  function schodnice(v, ri) {
    const { s, h, b, g } = v;
    const r = g.ramena[ri || 0];
    if (!r || r.typ !== 'prime') return null;
    const nr = r.k1 - r.k0 + 1;          // výšek v rameni
    const z0 = (r.k0 - 1) * h;            // podlaha / podesta pod ramenem
    const a = Math.atan2(h, b), cosA = Math.cos(a), sinA = Math.sin(a), tanA = h / b;
    const w = s.schodniceVys, tSt = s.material === 'zb' ? 0 : s.tlStupnice, tP = s.podstupnice ? s.tlPodstupnice : 0, nos_ = s.nos;
    /* x = vodorovně od přední hrany prvního stupně ramene, z = výška */
    let poly, hloubkaZubu = 0, zbyva = null, typ = s.schodnice;
    const zTop = z0 + nr * h;              // horní podlaha / podesta
    const xHead = (nr - 1) * b + nos_ + tP; // líc čela nad posledním stupněm
    if (typ === 'zubata') {
      const c = k => (k - 1) * b + nos_ + tP; // svislý řez k-tého zubu
      const S = k => z0 + k * h - tSt;        // úroveň sedla pod stupnicí k
      const zub = [[c(1), z0], [c(1), S(1)]];
      for (let k = 1; k < nr; k++) { zub.push([c(k + 1), S(k)]); if (k + 1 < nr) zub.push([c(k + 1), S(k + 1)]); }
      /* spodní hrana: rovnoběžka s přímkou vrcholů zubů ve vzdálenosti w */
      const zb = x => S(1) + (x - c(1)) * tanA - w / cosA;
      const xEnd = c(nr);
      zub.push([xEnd, zb(xEnd)]);
      const xf = c(1) + (z0 - zb(c(1))) / tanA;  // průsečík spodní hrany s podlahou
      if (xf > c(1)) zub.push([xf, z0]); else zub[0] = [c(1), zb(c(1))];
      poly = zub;
      hloubkaZubu = h * b / Math.hypot(h, b);
      zbyva = w - hloubkaZubu;
    } else {
      /* zapuštěné stupně: horní hrana nad spojnicí hran o 50 mm (kolmo) */
      const presah = 50;
      const zt = x => z0 + h + x * tanA + presah / cosA;
      const zbot = x => zt(x) - w / cosA;
      const xL = -nos_ - 200, xR = xHead + 400;
      poly = [[xL, zbot(xL)], [xR, zbot(xR)], [xR, zt(xR)], [xL, zt(xL)]];
      poly = orizni(poly, 0, -1, -z0);                 // z ≥ z0 (podlaha)
      poly = orizni(poly, -1, 0, 20);                  // x ≥ −20 – svislý řez 20 mm před prvním nosem
      poly = orizni(poly, 1, 0, xHead);                // x ≤ líc čela
      poly = orizni(poly, 0, 1, zTop);                 // z ≤ horní podlaha
      /* zbývající dřevo pod drážkou: zadní spodní roh stupnice */
      let minZb = Infinity;
      for (let k = 1; k < nr; k++) {
        const P = [(k - 1) * b + b + nos_, z0 + k * h - tSt - 0];
        const dist = (P[1] - zbot(P[0])) * cosA;
        if (dist < minZb) minZb = dist;
      }
      zbyva = minZb;
    }
    /* délka prkna = průmět polygonu na osu schodnice */
    const u = [cosA, sinA], nn = [-sinA, cosA];
    let umin = Infinity, umax = -Infinity, vmin = Infinity, vmax = -Infinity;
    for (const P of poly) { const pu = dot(P, u), pv = dot(P, nn); umin = Math.min(umin, pu); umax = Math.max(umax, pu); vmin = Math.min(vmin, pv); vmax = Math.max(vmax, pv); }
    const delka = umax - umin, sirkaPrkna = vmax - vmin;
    /* orientační statika: prostý nosník, rozpětí = vodorovný průmět, zatížení z poloviny šířky */
    const Lh = (nr - 1) * b + nos_ + tP + 100;
    const Lsl = Lh / cosA;
    const pas = s.B / 2 / 1000;             // m zatěžovací šířky
    const qd = (1.35 * NORMA.zatizeni.g + 1.5 * NORMA.zatizeni.q) * pas;   // kN/m vodorovného průmětu
    const qk = (NORMA.zatizeni.g + NORMA.zatizeni.q) * pas;
    const M = qd * Math.pow(Lh / 1000, 2) / 8;          // kNm
    const fmd = NORMA.drevo.fmk * NORMA.drevo.kmod / NORMA.drevo.gM;     // MPa
    const ucinna = typ === 'zubata' ? zbyva : w;        // výška průřezu
    const bt = s.schodniceTl;
    const W_ = bt * ucinna * ucinna / 6;                 // mm³
    const sigma = M * 1e6 / W_;                          // MPa
    const I_ = bt * Math.pow(ucinna, 3) / 12;
    /* konečný průhyb s dotvarováním: w_fin = w_G·(1 + kdef) + w_Q·(1 + ψ2·kdef) */
    const D = NORMA.drevo, qG = NORMA.zatizeni.g * pas * (1 + D.kdef), qQ = NORMA.zatizeni.q * pas * (1 + D.psi2 * D.kdef);
    const qkn = (qG + qQ) * cosA * cosA;                 // kolmá složka na šikmou délku (kN/m = N/mm)
    const prohyb = 5 * qkn * Math.pow(Lsl, 4) / (384 * D.E * I_);
    const limit = Lsl / 300;
    /* stupnice: osamělé břemeno 2 kN uprostřed rozpětí mezi schodnicemi (ČSN EN 1991-1-1, kat. A) */
    const Ls = Math.max(100, typ === 'zubata' ? s.B - s.schodniceTl : s.B - 2 * s.schodniceTl + 2 * s.drazka);
    const dSt = b + nos_ + tP, tSt2 = Math.max(1, s.tlStupnice);
    const fmdQ = D.fmk * D.kmodQ / D.gM;
    const Mst = Math.max(1.5 * NORMA.zatizeni.Q * Ls / 4 * 1000, 1.5 * NORMA.zatizeni.q * dSt / 1000 * Ls * Ls / 8);   // N·mm
    const sigSt = Mst / (dSt * tSt2 * tSt2 / 6);
    let tlDop = null; for (let t = 20; t <= 120; t += 5) if (Mst / (dSt * t * t / 6) <= fmdQ) { tlDop = t; break; }
    /* doporučená výška průřezu pro danou tloušťku (krok 20 mm) */
    let doporucena = null;
    for (let hh = 160; hh <= 500; hh += 20) {
      const hu = typ === 'zubata' ? hh - hloubkaZubu : hh;
      if (hu <= 40) continue;
      const Wh = bt * hu * hu / 6, Ih = bt * Math.pow(hu, 3) / 12;
      if (M * 1e6 / Wh <= fmd && 5 * qkn * Math.pow(Lsl, 4) / (384 * NORMA.drevo.E * Ih) <= limit) { doporucena = hh; break; }
    }
    const krok = Math.hypot(h, b);
    return {
      rameno: ri || 0, typ, nr, delka, sirkaPrkna, poly, z0, zTop, xHead,
      uhelPata: deg(a), uhelHlava: 90 - deg(a), odpocetPata: tSt, prvniVyska: h - tSt,
      hloubkaZubu, zbyva, krok, sablona: Array.from({ length: Math.max(0, nr - 1) }, (_, i) => ({ k: i + 1, vzdalenost: (i + 1) * krok })),
      statika: { Lh, Lsl, qd, M, sigma, fmd, vyuziti: sigma / fmd, prohyb, limit, doporucena, ucinna,
        stupnice: { Ls, sigma: sigSt, fmd: fmdQ, vyuziti: sigSt / fmdQ, doporucena: tlDop } },
    };
  }

  /* ============================================================
     11. Zábradlí
     ============================================================ */
  function zabradli(v) {
    const { s, g, H, h, b } = v;
    const strany = s.zabradliStrany === 'obe' ? ['vnitrni', 'vnejsi'] : s.zabradliStrany === 'zadna' ? [] : [s.zabradliStrany];
    const hloubka = s.hloubkaPadu > 0 ? s.hloubkaPadu : H;
    const vyska = vyskaZabradli(hloubka);
    const mezera = s.deti ? NORMA.zabradli.mezeraDeti : NORMA.zabradli.mezera;
    /* délky volných okrajů ve 3D (podél hran nosů) */
    const okraj = strana => {
      let L = 0, Lp = 0;
      const N = g.nosy;
      for (let k = 0; k + 1 < N.length; k++) {
        const A = strana === 'vnitrni' ? N[k].I : N[k].O, C = strana === 'vnitrni' ? N[k + 1].I : N[k + 1].O;
        const st_ = g.stupne[k];
        const dxy = vzd(A, C), dz = st_ && st_.typ === 'podesta' ? 0 : h;
        if (st_ && st_.typ === 'podesta') {
          /* podesta: délka okraje (vnitřního / vnějšího) mezi hranami ramen */
          const okr = strana === 'vnitrni' ? g.vnitrni : g.vnejsi;
          if (okr) { const Lo = Lomena(okr); Lp += Math.abs(Lo.param(C) - Lo.param(A)); } else Lp += dxy;
          continue;
        }
        L += Math.hypot(dxy, dz);
      }
      return { sikme: L, podesta: Lp };
    };
    const delky = strany.map(okraj);
    /* šikmé délky zábradlí po ramenech (u nesouměrných ramen se liší) */
    const poRamenech = g.ramena.map(r => {
      let L = 0;
      for (const strana of strany) for (let k = r.k0; k < r.k1; k++) {
        const st_ = g.stupne[k - 1]; if (!st_ || st_.typ === 'podesta') continue;
        const A = strana === 'vnitrni' ? g.nosy[k - 1].I : g.nosy[k - 1].O, C = strana === 'vnitrni' ? g.nosy[k].I : g.nosy[k].O;
        L += Math.hypot(vzd(A, C), h);
      }
      return L;
    });
    const sikme = delky.reduce((a, d) => a + d.sikme, 0), podesty = delky.reduce((a, d) => a + d.podesta, 0);
    /* příčle po stupních a stranách: skutečná šířka stupně na straně zábradlí (u kosých stupňů se liší) */
    const tp = s.prickaTl, krok_ = mezera + tp;
    const poStupnich = {};
    let mezeraSkutecna = 0, pricky = 0, naStupen = 0;
    for (const strana of strany) {
      poStupnich[strana] = g.nosy.slice(0, -1).map((q, k) => {
        if (g.stupne[k].typ === 'podesta') return 0;
        const w = vzd(strana === 'vnitrni' ? q.I : q.O, strana === 'vnitrni' ? g.nosy[k + 1].I : g.nosy[k + 1].O);
        const c = Math.max(1, Math.ceil(w / krok_));
        mezeraSkutecna = Math.max(mezeraSkutecna, w / c - tp);
        pricky += c; naStupen = Math.max(naStupen, c);
        return c;
      });
    }
    pricky += Math.ceil(podesty / krok_);
    const sloupky = strany.length ? strany.length * 2 + Math.ceil((sikme + podesty) / s.sloupkyRozestup) : 0;
    const Bw = s.typ === 'tocite' ? g.tocite.B : s.B;
    const limitJedno = (s.typ === 'tocite' || g.kose) ? NORMA.madlo.jednostranneDoTocite : NORMA.madlo.jednostranneDo;
    const madloStrany = (v.kat.madloObe || Bw > limitJedno) ? 2 : 1;
    const madlo = (sikme / Math.max(1, strany.length)) * madloStrany + 2 * NORMA.madlo.prichod * madloStrany + podesty;
    /* zábradlí kolem otvoru v patře – orientačně obvod otvoru bez výstupní hrany */
    const o = v.podchod ? v.podchod.otvor : null;
    let kolemOtvoru = 0;
    if (o && o.obrys) {
      const per = o.obrys.reduce((a, sm) => a + sm.reduce((b, p, i) => b + vzd(p, sm[(i + 1) % sm.length]), 0), 0);
      const posl = g.nosy[g.nosy.length - 1];
      kolemOtvoru = Math.max(0, per - vzd(posl.I, posl.O) - (strany.includes('vnejsi') ? 0 : (s.typ === 'tocite' ? 0 : Math.max(o.dx, o.dy))));
    }
    return { strany, hloubka, vyska, mezera, mezeraSkutecna, naStupen, poStupnich, poRamenech, pricky, sloupky, sikme, podesty, madlo, madloStrany, kolemOtvoru,
      vyskaPricky: vyska - 50 - 60 };
  }

  /* ============================================================
     12. Výkaz materiálu
     ============================================================ */
  function obdelnikPodelHrany(poly, smer) {
    const u = jedn(smer), nn = [-u[1], u[0]];
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (const p of poly) { const x = dot(p, u), y = dot(p, nn); a0 = Math.min(a0, x); a1 = Math.max(a1, x); b0 = Math.min(b0, y); b1 = Math.max(b1, y); }
    return { delka: a1 - a0, hloubka: b1 - b0 };
  }
  function vykaz(v) {
    const { s, g, h, b, n } = v;
    const radky = [];
    const R = (skupina, polozka, pocet, rozmer, mnozstvi, jednotka) => radky.push({ skupina, polozka, pocet, rozmer, mnozstvi, jednotka });
    const cosA = Math.cos(rad(v.alfa));
    const stupneBez = g.stupne.filter(x => x.typ !== 'podesta');
    const podesty = g.stupne.filter(x => x.typ === 'podesta').concat(g.plosina ? [g.plosina] : []);
    if (s.material === 'drevo' || s.material === 'ocel') {
      /* stupnice – skupiny podle rozměrů */
      const skup = new Map(); let V = 0;
      for (const st_ of stupneBez) {
        const q = g.nosy[st_.k - 1];
        const r = obdelnikPodelHrany(st_.poly, sub(q.O, q.I));
        let delka = r.delka, hloubka = r.hloubka + s.nos + (s.material === 'drevo' && s.podstupnice ? s.tlPodstupnice : 0);
        if (s.material === 'drevo' && s.schodnice === 'zapustena' && !g.kose) delka = r.delka - 2 * s.schodniceTl + 2 * s.drazka;
        const klic = Math.round(delka) + ' × ' + Math.round(hloubka);
        skup.set(klic, (skup.get(klic) || 0) + 1);
        V += delka * hloubka * s.tlStupnice / 1e9;
      }
      for (const [k, c] of skup) R('Stupně', s.material === 'ocel' ? 'Stupnice (plech/rošt/dřevo)' : 'Stupnice', c, k + ' × ' + s.tlStupnice + ' mm', null, '');
      R('Stupně', 'Stupnice celkem', stupneBez.length, '', V, 'm³');
      if (s.podstupnice && s.material === 'drevo') {
        let Vp = 0; const sk = new Map();
        for (let k = 1; k <= n; k++) {
          const q = g.nosy[k - 1];
          if (g.stupne[k - 2] && g.stupne[k - 2].typ === 'podesta') { /* čelo podesty */ }
          let delka = vzd(q.I, q.O);
          if (s.schodnice === 'zapustena' && !g.kose) delka = delka - 2 * s.schodniceTl + 2 * s.drazka;
          const vys = h - s.tlStupnice + s.drazka;
          const klic = Math.round(delka) + ' × ' + Math.round(vys);
          sk.set(klic, (sk.get(klic) || 0) + 1);
          Vp += delka * vys * s.tlPodstupnice / 1e9;
        }
        for (const [k, c] of sk) R('Stupně', 'Podstupnice', c, k + ' × ' + s.tlPodstupnice + ' mm', null, '');
        R('Stupně', 'Podstupnice celkem', n, '', Vp, 'm³');
      }
      /* schodnice */
      let Vs = 0, Ls = 0;
      g.ramena.forEach((r, i) => {
        const sch = schodnice(v, i);
        if (sch) {
          const nazev = s.material === 'ocel' ? 'Schodnice ' + s.ocelProfil : (sch.typ === 'zubata' ? 'Schodnice zubatá' : 'Schodnice se zapuštěnými stupni');
          R('Schodnice', nazev + ' – rameno ' + (i + 1), 2, Math.round(sch.delka) + ' × ' + Math.round(sch.sirkaPrkna) + ' × ' + s.schodniceTl + ' mm', null, '');
          Vs += 2 * sch.delka * s.schodniceVys * s.schodniceTl / 1e9; Ls += 2 * sch.delka;
        }
      });
      if (g.kose && !g.tocite) {
        const Lin = Lomena(g.vnitrni), Lout = Lomena(g.vnejsi);
        const li = Math.hypot(Lin.L, v.H), lo = Math.hypot(Lout.L, v.H);
        R('Schodnice', 'Schodnice vnitřní (zalomená / lepená) – rozvinutá délka', 1, Math.round(li) + ' mm', null, '');
        R('Schodnice', 'Schodnice vnější (u stěny) – rozvinutá délka', 1, Math.round(lo) + ' mm', null, '');
        Ls += li + lo; Vs += (li + lo) * s.schodniceVys * s.schodniceTl / 1e9;
      }
      if (g.tocite) R('Schodnice', 'Nosné vřeteno / středový sloup (výška)', 1, Math.round(v.H + s.podlahaNahore) + ' mm', null, '');
      if (s.material === 'drevo' && Vs) R('Schodnice', 'Schodnice celkem', null, '', Vs, 'm³');
      if (s.material === 'ocel' && Ls) {
        const kgm = (OCEL_PROFILY[s.ocelProfil] || 25.3);
        R('Schodnice', 'Ocelové schodnice celkem', null, Math.round(Ls) + ' mm × ' + kgm + ' kg/m', Ls / 1000 * kgm, 'kg');
      }
      for (const p of podesty) R('Podesty', p.typ === 'plosina' ? 'Výstupní plošina – deska' : 'Podesta – nosný rošt + deska', 1, Math.round(plocha(p.poly) / 1e4) / 100 + ' m²', plocha(p.poly) * s.tlStupnice / 1e9, 'm³');
    } else {
      /* železobeton monolit */
      const d = s.deskaTl;
      let V = 0, podhled = 0, cela = 0, boky = 0;
      for (const st_ of stupneBez) {
        const A = plocha(st_.poly);
        V += A * (h / 2 + d / cosA) / 1e9;
        podhled += A / cosA / 1e6;
      }
      for (const q of g.nosy) cela += vzd(q.I, q.O) * h / 1e6;   // čelo každé výšky (i před podestou)
      for (const p of podesty) { const A = plocha(p.poly); V += A * d / 1e9; podhled += A / 1e6; }
      /* boky: rozvinutá délka okrajů × průměrná výška průřezu */
      const Lb = (g.kose && !g.tocite) ? Lomena(g.vnitrni).L + Lomena(g.vnejsi).L : 2 * g.nosy[n - 1].t;
      boky = Lb / cosA * (h / 2 + d / cosA) / 1e6;
      R('Beton', 'Beton (ramena + podesty)', null, 'deska ' + d + ' mm', V, 'm³');
      R('Beton', 'Výztuž – orientačně 90 kg/m³ (podle statika)', null, '', V * 90, 'kg');
      R('Bednění', 'Podhled ramen a podest', null, '', podhled, 'm²');
      R('Bednění', 'Čela stupňů', n, '', cela, 'm²');
      R('Bednění', 'Boky ramen (u stěny jen při volném okraji)', null, '', boky, 'm²');
      if (s.tlStupnice > 0) R('Povrch', 'Nášlapná vrstva stupňů (obklad)', stupneBez.length, s.tlStupnice + ' mm', stupneBez.reduce((a, x) => a + plocha(x.poly), 0) / 1e6, 'm²');
    }
    /* zábradlí */
    const z = zabradli(v);
    if (z.strany.length) {
      R('Zábradlí', 'Zábradlí – šikmá část (volné okraje)', null, 'výška ' + z.vyska + ' mm', z.sikme / 1000, 'm');
      if (z.poRamenech.length > 1) z.poRamenech.forEach((L, i) => R('Zábradlí', '  z toho ' + (i + 1) + '. rameno', null, '', L / 1000, 'm'));
      if (z.podesty > 0) R('Zábradlí', 'Zábradlí – podesty', null, '', z.podesty / 1000, 'm');
      R('Zábradlí', 'Sloupky (rozestup ≤ ' + s.sloupkyRozestup + ' mm)', z.sloupky, '', null, '');
      const rozsah = z.strany.flatMap(st => z.poStupnich[st].filter(c => c > 0));
      const cMin = Math.min(...rozsah), cMax = Math.max(...rozsah);
      R('Zábradlí', 'Svislé příčle ' + s.prickaTl + ' mm (' + (cMin === cMax ? cMax : cMin + '–' + cMax) + ' na stupeň, největší mezera ' + Math.round(z.mezeraSkutecna) + ' mm)', z.pricky, 'cca ' + z.vyskaPricky + ' mm', null, '');
    }
    R('Zábradlí', 'Madlo (' + (z.madloStrany === 2 ? 'obě strany' : 'jedna strana') + ', vč. přesahů 150 mm)', null, '', z.madlo / 1000, 'm');
    if (s.deti) R('Zábradlí', 'Druhé (dětské) madlo ve výšce 400–700 mm', null, '', z.madlo / 1000, 'm');
    if (z.kolemOtvoru > 0) R('Zábradlí', 'Zábradlí kolem otvoru v patře (orientačně)', null, '', z.kolemOtvoru / 1000, 'm');
    return radky;
  }
  const OCEL_PROFILY = { 'UPN 140': 16.0, 'UPN 160': 18.8, 'UPN 180': 22.0, 'UPN 200': 25.3, 'UPN 220': 29.4, 'UPN 240': 33.2, 'P 200×10': 15.7, 'P 250×12': 23.6 };

  /* tabulka výšek stupňů (kumulativně) a hrubé výšky u monolitu */
  function tabulkaVysek(v) {
    const { s, h, n } = v;
    const rows = [];
    for (let k = 1; k <= n; k++) rows.push({ k, z: k * h, hruba: null });
    if (s.material === 'zb') {
      const tn = s.tlStupnice;
      for (const r of rows) r.hruba = r.k === n ? v.H - s.podlahaNahore + s.podlahaDole : r.z - tn + s.podlahaDole;
    }
    return rows;
  }

  return {
    STAV_K, ZDROJE, NORMA, KATEGORIE, TYPY, VYCHOZI, OCEL_PROFILY,
    kategorie, konstrukcniVyska, vystupniOdVnejsiho, sklonTrida, h1Pozadovana, h2Pozadovana, vyskaZabradli, sklonMaxPro,
    normalizuj, navrh, varianty, rozsahVariant, TYPY_ROZDELENI, mezeN1, rozdeleniRamen, odhadRozmeru, popisSvetlosti, doporuceneN, schodnice, zabradli, vykaz, tabulkaVysek, vyskaVystupni, stropSpodni, otvorPoly, vOtvoru, sjednoceniObdelniku,
    geometrie, rozestupNosu, vnitrniPolohy,
    pom: { Lomena, Cesta, bodVPolygonu, plocha, orizni, bboxBodu, vzd, rad, deg, oblouk, lerp, sub, add, mul, jedn, dot, teziste },
  };
})();
if (typeof module !== 'undefined') module.exports = SCHOD;

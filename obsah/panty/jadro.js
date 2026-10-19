/* ============================================================
   panty/jadro.js – výpočetní jádro návrháře pantů a kloubů (bez DOM).
   Parametry a jejich kontrola, materiály, vzorce (meze pohybu, poměrné
   přetvoření pružných prvků), upozornění pro FDM tisk, matice 4×4,
   kontrola sítí (vodotěsnost, objem), binární STL a rozmístění dílů
   na tiskové podložce. Geometrie přes manifold je v panty/geometrie.js.
   Souřadnice: mm, osa pantu = osa X, Z nahoru (podložka tiskárny z = 0).
   Úhly v rozhraní ve stupních.
   ============================================================ */
(function () {
  'use strict';

  /* ---------- režimy ---------- */
  const REZIMY = {
    pant:   { nazev: 'Klasický pant (tisk v místě)', kratce: 'Pant v místě', pohyb: 'osa',
              popis: 'Dva listy se střídavými články. Čep je součástí listu A a prochází články listu B s vůlí – tiskne se vcelku, už smontovaný.' },
    cep:    { nazev: 'Pant s vyjímatelným čepem', kratce: 'Vyjímatelný čep', pohyb: 'osa',
              popis: 'Dva listy se střídavými články a samostatný čep s hlavou. Čep lze vytisknout naležato, nebo nahradit kovovým (drát, hřeb, šroub).' },
    kulovy: { nazev: 'Kulový kloub', kratce: 'Kulový kloub', pohyb: 'koule',
              popis: 'Koule s krčkem a jamka se zúženým hrdlem. Jamka má podélné zářezy, aby koule šla zacvaknout.' },
    pruzny: { nazev: 'Pružný (filmový) spoj', kratce: 'Pružný spoj', pohyb: 'ohyb',
              popis: 'Dva bloky spojené tenkým páskem, který se při pohybu ohýbá. Jeden díl bez čepu – vhodné hlavně pro PP, PETG a TPU.' }
  };

  /* ---------- materiály (orientační hodnoty pro výtisky FDM) ----------
     E = modul pružnosti v tahu [MPa] (výtisk, ve směru vláken, typické hodnoty z technických listů),
     epsKr = dovolené krátkodobé poměrné přetvoření pro jednorázové/občasné ohnutí (zacvaknutí),
     epsOpak = orientační mez pro opakovaný ohyb pružného pásku, hustota [g/cm³]. Výtisk bývá o 20–50 % slabší
     než vstřikovaný díl a mezi vrstvami ještě výrazně méně. */
  const MATERIALY = {
    PLA:  { nazev: 'PLA',  E: 3500, epsKr: 0.020, epsOpak: 0.005, unava: 'velmi špatná – pružný pant vydrží jednotky až desítky ohybů', teplota: 55, hustota: 1.24 },
    PETG: { nazev: 'PETG', E: 2100, epsKr: 0.035, epsOpak: 0.012, unava: 'střední – stovky ohybů při malém přetvoření', teplota: 75, hustota: 1.27 },
    ABS:  { nazev: 'ABS / ASA', E: 2100, epsKr: 0.030, epsOpak: 0.010, unava: 'střední', teplota: 90, hustota: 1.05 },
    PA:   { nazev: 'PA (nylon)', E: 1400, epsKr: 0.060, epsOpak: 0.025, unava: 'dobrá (po navlhnutí)', teplota: 80, hustota: 1.14 },
    PP:   { nazev: 'PP', E: 1300, epsKr: 0.080, epsOpak: 0.060, unava: 'výborná – klasický materiál filmových pantů', teplota: 90, hustota: 0.90 },
    TPU:  { nazev: 'TPU 95A', E: 30, epsKr: 0.40, epsOpak: 0.25, unava: 'výborná (pružný materiál)', teplota: 60, hustota: 1.21 }
  };

  /* ---------- parametry ----------
     typ: 'cislo' | 'cele' | 'vyber'; rezimy: ve kterých režimech se zobrazuje. */
  const H = ['pant', 'cep'], K = ['kulovy'], P = ['pruzny'], VSE = ['pant', 'cep', 'kulovy', 'pruzny'];
  const PARAMETRY = [
    // pant – listy a články
    { klic: 'delka', nazev: 'Délka pantu (podél osy)', j: 'mm', v: 60, min: 8, max: 400, krok: 1, skupina: 'Rozměry', rezimy: H },
    { klic: 'sirka', nazev: 'Šířka listu od osy', j: 'mm', v: 20, min: 4, max: 200, krok: 0.5, skupina: 'Rozměry', rezimy: H },
    { klic: 'tloustka', nazev: 'Tloušťka listu', j: 'mm', v: 2.4, min: 0.6, max: 20, krok: 0.1, skupina: 'Rozměry', rezimy: H },
    { klic: 'prumerKloubu', nazev: 'Vnější průměr článku', j: 'mm', v: 7, min: 2, max: 60, krok: 0.1, skupina: 'Rozměry', rezimy: H },
    { klic: 'clanku', nazev: 'Počet článků', j: 'ks', typ: 'cele', v: 5, min: 2, max: 41, krok: 1, skupina: 'Rozměry', rezimy: H,
      napoveda: 'Články se střídají A, B, A, … Lichý počet dá listu A oba krajní články.' },
    { klic: 'prumerCepu', nazev: 'Průměr čepu', j: 'mm', v: 3, min: 0.8, max: 50, krok: 0.1, skupina: 'Čep a vůle', rezimy: H },
    { klic: 'vuleR', nazev: 'Radiální vůle čepu', j: 'mm', v: 0.35, min: 0, max: 2, krok: 0.05, skupina: 'Čep a vůle', rezimy: H,
      napoveda: 'Mezera mezi čepem a otvorem na poloměru. Pro trysku 0,4 mm obvykle 0,3–0,5 mm.' },
    { klic: 'vuleA', nazev: 'Axiální mezera mezi články', j: 'mm', v: 0.4, min: 0, max: 3, krok: 0.05, skupina: 'Čep a vůle', rezimy: H,
      napoveda: 'Mezera mezi sousedními články podél osy. Ve stejné šíři se kolem článků druhého listu vybírá i deska listu.' },
    { klic: 'hlavaD', nazev: 'Průměr hlavy čepu', j: 'mm', v: 6, min: 1, max: 80, krok: 0.1, skupina: 'Čep a vůle', rezimy: ['cep'] },
    { klic: 'hlavaH', nazev: 'Výška hlavy čepu', j: 'mm', v: 1.6, min: 0.4, max: 20, krok: 0.1, skupina: 'Čep a vůle', rezimy: ['cep'] },
    { klic: 'presah', nazev: 'Přesah čepu za pant', j: 'mm', v: 0, min: 0, max: 30, krok: 0.5, skupina: 'Čep a vůle', rezimy: ['cep'],
      napoveda: 'Délka, o kterou čep vyčnívá na druhé straně (např. pro pojistný kroužek nebo zahřátí a roznýtování).' },
    { klic: 'zplosteni', nazev: 'Zploštění čepu pro tisk naležato', j: 'mm', v: 0.3, min: 0, max: 10, krok: 0.05, skupina: 'Čep a vůle', rezimy: ['cep'],
      napoveda: 'Seříznutí jedné strany čepu i hlavy, aby čep ležel na podložce. Vrstvy pak běží podél čepu a čep je pevnější ve střihu.' },
    { klic: 'uhelMin', nazev: 'Pohyb od', j: '°', v: 0, min: -270, max: 270, krok: 1, skupina: 'Pohyb', rezimy: H,
      napoveda: '0° = listy rozložené naplocho, 180° = list B přeložený přes list A.' },
    { klic: 'uhelMax', nazev: 'Pohyb do', j: '°', v: 180, min: -270, max: 270, krok: 1, skupina: 'Pohyb', rezimy: H },

    // kulový kloub
    { klic: 'kouleD', nazev: 'Průměr koule', j: 'mm', v: 14, min: 3, max: 80, krok: 0.1, skupina: 'Rozměry', rezimy: K },
    { klic: 'vuleK', nazev: 'Radiální vůle v jamce', j: 'mm', v: 0.3, min: 0, max: 2, krok: 0.05, skupina: 'Rozměry', rezimy: K },
    { klic: 'stena', nazev: 'Tloušťka stěny jamky', j: 'mm', v: 2, min: 0.6, max: 15, krok: 0.1, skupina: 'Rozměry', rezimy: K },
    { klic: 'otvorJamkyD', nazev: 'Průměr hrdla jamky', j: 'mm', v: 12, min: 1, max: 80, krok: 0.1, skupina: 'Rozměry', rezimy: K,
      napoveda: 'Musí být menší než koule (drží ji v jamce) a větší než krček (umožní náklon).' },
    { klic: 'krcekD', nazev: 'Průměr krčku', j: 'mm', v: 6, min: 1, max: 60, krok: 0.1, skupina: 'Rozměry', rezimy: K },
    { klic: 'krcekL', nazev: 'Délka krčku (střed koule → deska)', j: 'mm', v: 16, min: 2, max: 200, krok: 0.5, skupina: 'Rozměry', rezimy: K },
    { klic: 'sloupekL', nazev: 'Výška jamky (střed → deska)', j: 'mm', v: 12, min: 2, max: 200, krok: 0.5, skupina: 'Rozměry', rezimy: K },
    { klic: 'zarezu', nazev: 'Počet zářezů jamky', j: 'ks', typ: 'cele', v: 4, min: 0, max: 12, krok: 1, skupina: 'Zacvaknutí', rezimy: K },
    { klic: 'zarezS', nazev: 'Šířka zářezu', j: 'mm', v: 1.2, min: 0.3, max: 10, krok: 0.1, skupina: 'Zacvaknutí', rezimy: K },
    { klic: 'zarezH', nazev: 'Horní konec zářezu nad středem', j: 'mm', v: 4, min: -40, max: 40, krok: 0.5, skupina: 'Zacvaknutí', rezimy: K,
      napoveda: 'Zářezy vedou od hrdla nahoru do této výšky (0 = rovník koule). Delší zářez = měkčí zacvaknutí.' },
    { klic: 'deskaA', nazev: 'Strana montážní desky', j: 'mm', v: 30, min: 4, max: 300, krok: 0.5, skupina: 'Montáž', rezimy: K },
    { klic: 'deskaT', nazev: 'Tloušťka montážní desky', j: 'mm', v: 3, min: 0.8, max: 30, krok: 0.1, skupina: 'Montáž', rezimy: K },
    { klic: 'naklonMax', nazev: 'Požadovaný náklon', j: '°', v: 35, min: 1, max: 89, krok: 1, skupina: 'Pohyb', rezimy: K,
      napoveda: 'Do jakého náklonu krčku od osy jamky (ve všech směrech) se kontrolují kolize.' },

    // pružný spoj
    { klic: 'delkaP', nazev: 'Šířka spoje (podél osy ohybu)', j: 'mm', v: 30, min: 3, max: 400, krok: 0.5, skupina: 'Rozměry', rezimy: P },
    { klic: 'blokL', nazev: 'Délka bloku', j: 'mm', v: 15, min: 2, max: 200, krok: 0.5, skupina: 'Rozměry', rezimy: P },
    { klic: 'blokH', nazev: 'Výška bloku', j: 'mm', v: 6, min: 0.6, max: 100, krok: 0.1, skupina: 'Rozměry', rezimy: P },
    { klic: 'pasekT', nazev: 'Tloušťka pásku', j: 'mm', v: 0.6, min: 0.2, max: 5, krok: 0.05, skupina: 'Pásek', rezimy: P,
      napoveda: 'Volte celistvý násobek výšky vrstvy (např. 3 × 0,2 mm).' },
    { klic: 'pasekL', nazev: 'Délka pásku (ohybová délka)', j: 'mm', v: 5, min: 0.5, max: 60, krok: 0.1, skupina: 'Pásek', rezimy: P },
    { klic: 'ohybMin', nazev: 'Ohyb od', j: '°', v: 0, min: -180, max: 180, krok: 1, skupina: 'Pohyb', rezimy: P,
      napoveda: 'Kladný ohyb zavírá bloky k sobě horními plochami.' },
    { klic: 'ohybMax', nazev: 'Ohyb do', j: '°', v: 45, min: -180, max: 180, krok: 1, skupina: 'Pohyb', rezimy: P },

    // montážní otvory (všechny režimy)
    { klic: 'otvoru', nazev: 'Počet otvorů na díl', j: 'ks', typ: 'cele', v: 2, min: 0, max: 12, krok: 1, skupina: 'Montážní otvory', rezimy: VSE,
      napoveda: 'U kulového kloubu 0, 2 nebo 4 otvory v rozích desky.' },
    { klic: 'otvorD', nazev: 'Průměr otvoru pro šroub', j: 'mm', v: 3.4, min: 0.8, max: 30, krok: 0.1, skupina: 'Montážní otvory', rezimy: VSE },
    { klic: 'zahloubeni', nazev: 'Zahloubení', typ: 'vyber', v: 'kuzel', volby: [['kuzel', 'kuželové 90° (zápustný šroub)'], ['valec', 'válcové (šroub s válcovou hlavou)'], ['zadne', 'žádné']],
      skupina: 'Montážní otvory', rezimy: VSE },
    { klic: 'hlavaSroubuD', nazev: 'Průměr hlavy šroubu', j: 'mm', v: 6.5, min: 1, max: 40, krok: 0.1, skupina: 'Montážní otvory', rezimy: VSE },
    { klic: 'hlavaSroubuH', nazev: 'Hloubka válcového zahloubení', j: 'mm', v: 1.6, min: 0.2, max: 30, krok: 0.1, skupina: 'Montážní otvory', rezimy: VSE },
    { klic: 'otvorOdOsy', nazev: 'Osa otvorů od osy pantu (0 = auto)', j: 'mm', v: 0, min: 0, max: 200, krok: 0.5, skupina: 'Montážní otvory', rezimy: H },

    // společné
    { klic: 'material', nazev: 'Materiál', typ: 'vyber', v: 'PETG', volby: Object.keys(MATERIALY).map(k => [k, MATERIALY[k].nazev]), skupina: 'Tisk', rezimy: VSE },
    { klic: 'tryska', nazev: 'Průměr trysky', j: 'mm', v: 0.4, min: 0.1, max: 1.2, krok: 0.05, skupina: 'Tisk', rezimy: VSE },
    { klic: 'vrstva', nazev: 'Výška vrstvy', j: 'mm', v: 0.2, min: 0.04, max: 0.8, krok: 0.02, skupina: 'Tisk', rezimy: VSE },
    { klic: 'segmentu', nazev: 'Jemnost oblouků (segmentů na kružnici)', j: '', typ: 'cele', v: 48, min: 16, max: 128, krok: 4, skupina: 'Tisk', rezimy: VSE }
  ];
  const PODLE_KLICE = Object.fromEntries(PARAMETRY.map(d => [d.klic, d]));

  function vychozi(rezim) {
    const o = {};
    for (const d of PARAMETRY) o[d.klic] = d.v;
    if (rezim === 'kulovy') { o.otvoru = 4; o.otvorD = 3.4; o.hlavaSroubuD = 6.5; }
    if (rezim === 'pruzny') { o.otvoru = 2; o.material = 'PP'; }
    if (rezim === 'cep') { o.prumerKloubu = 8; o.prumerCepu = 3.2; o.vuleR = 0.25; }
    return o;
  }

  /* Převod čísla z textu (desetinná čárka i tečka). */
  function cislo(x) {
    if (typeof x === 'number') return x;
    if (typeof x !== 'string') return NaN;
    const t = x.trim().replace(/\s/g, '').replace(',', '.');
    return t === '' ? NaN : Number(t);
  }

  /* Normalizace vstupu: ořez do mezí, celá čísla, výběry; chyby a upozornění.
     Vrací { p, chyby: [{klic, text}], upozorneni: [{klic, text}] } – chyby brání stavbě modelu. */
  function normalizuj(rezim, vstup) {
    if (!REZIMY[rezim]) throw new Error('neznámý režim ' + rezim);
    const zakl = vychozi(rezim), p = {}, chyby = [], upoz = [];
    vstup = vstup && typeof vstup === 'object' ? vstup : {};
    for (const d of PARAMETRY) {
      let x = vstup[d.klic];
      if (d.typ === 'vyber') {
        p[d.klic] = d.volby.some(v => v[0] === x) ? x : zakl[d.klic];
        continue;
      }
      x = cislo(x);
      if (!Number.isFinite(x)) { if (vstup[d.klic] !== undefined && d.rezimy.includes(rezim)) upoz.push({ klic: d.klic, text: `${d.nazev}: neplatné číslo, použita výchozí hodnota.` }); x = zakl[d.klic]; }
      if (d.typ === 'cele') x = Math.round(x);
      if (x < d.min || x > d.max) {
        if (d.rezimy.includes(rezim)) upoz.push({ klic: d.klic, text: `${d.nazev}: hodnota upravena do rozsahu ${fmt(d.min)}–${fmt(d.max)} ${d.j || ''}.` });
        x = Math.min(d.max, Math.max(d.min, x));
      }
      p[d.klic] = x;
    }
    const ch = (klic, text) => chyby.push({ klic, text });
    const up = (klic, text) => upoz.push({ klic, text });
    if (rezim === 'pant' || rezim === 'cep') kontrolaPantu(rezim, p, ch, up);
    if (rezim === 'kulovy') kontrolaKoule(p, ch, up);
    if (rezim === 'pruzny') kontrolaPruzneho(p, ch, up);
    return { p, chyby, upozorneni: upoz };
  }

  /* odvozené rozměry pantu */
  function rozmeryPantu(p) {
    const R = p.prumerKloubu / 2, rh = p.prumerCepu / 2 + p.vuleR;
    const seg = p.delka / p.clanku;
    const dk = p.zahloubeni === 'zadne' ? p.otvorD : Math.max(p.otvorD, p.hlavaSroubuD);
    const yo = p.otvorOdOsy > 0 ? p.otvorOdOsy : (R + p.vuleR + p.sirka) / 2;
    const hlZahl = p.zahloubeni === 'kuzel' ? (dk - p.otvorD) / 2 : p.zahloubeni === 'valec' ? p.hlavaSroubuH : 0;
    return { R, rh, seg, clanekDelka: seg - p.vuleA, stena: R - rh, dk, yo, hlZahl };
  }

  function kontrolaPantu(rezim, p, ch, up) {
    const r = rozmeryPantu(p), tr = p.tryska;
    if (p.tloustka > p.prumerKloubu) ch('tloustka', 'List je tlustší než průměr článku – zvětšete průměr článku nebo ztenčete list.');
    else if (p.tloustka > r.R) up('tloustka', 'List je tlustší než poloměr článku, pant se proto nesloží až na 180° (zastaví se dřív).');
    if (r.stena < 0.4) ch('prumerCepu', `Stěna článku kolem otvoru čepu má jen ${fmt(r.stena)} mm – zmenšete čep nebo zvětšete článek.`);
    else if (r.stena < 2 * tr) up('prumerCepu', `Stěna článku ${fmt(r.stena)} mm je tenčí než 2 perimetry (${fmt(2 * tr)} mm) – článek bude křehký.`);
    if (r.clanekDelka < 1) ch('clanku', `Článek by byl dlouhý jen ${fmt(r.clanekDelka)} mm – snižte počet článků nebo axiální mezeru.`);
    else if (r.clanekDelka < 3) up('clanku', `Články jsou krátké (${fmt(r.clanekDelka)} mm) a snadno se ulomí.`);
    if (p.sirka < r.R + p.vuleR + 1) ch('sirka', 'List je užší než článek s vůlí – zvětšete šířku listu.');
    if (p.uhelMin >= p.uhelMax) ch('uhelMax', 'Rozsah pohybu: „do“ musí být větší než „od“.');
    if (rezim === 'cep') {
      if (p.hlavaD <= p.prumerCepu + 2 * p.vuleR + 0.2) ch('hlavaD', 'Hlava čepu musí být větší než otvor v článcích, jinak čep propadne.');
      if (p.zplosteni > p.prumerCepu / 3) ch('zplosteni', 'Zploštění je větší než třetina průměru čepu – čep by byl příliš oslabený.');
    }
    if (p.otvoru > 0) {
      if (p.zahloubeni !== 'zadne' && p.hlavaSroubuD <= p.otvorD) ch('hlavaSroubuD', 'Hlava šroubu musí být větší než otvor.');
      if (r.hlZahl > p.tloustka - 0.4) ch(p.zahloubeni === 'valec' ? 'hlavaSroubuH' : 'hlavaSroubuD',
        `Zahloubení (${fmt(r.hlZahl)} mm) je hlubší, než dovoluje list (${fmt(p.tloustka)} mm, pod hlavou má zůstat aspoň 0,4 mm).`);
      if (r.yo - r.dk / 2 < r.R + p.vuleR + 0.4 || r.yo + r.dk / 2 > p.sirka - 0.4)
        ch('otvorOdOsy', `Otvory s hlavou ⌀ ${fmt(r.dk)} mm se nevejdou do listu mezi článek a okraj – rozšiřte list nebo upravte polohu otvorů.`);
      if (p.delka / p.otvoru < r.dk + 1) ch('otvoru', 'Otvory jsou podél listu příliš nahusto.');
    }
  }

  function rozmeryKoule(p) {
    const Rb = p.kouleD / 2, Rc = Rb + p.vuleK, Ro = Rc + p.stena, ro = p.otvorJamkyD / 2, rs = p.krcekD / 2;
    const z0 = ro < Rc ? -Math.sqrt(Rc * Rc - ro * ro) : 0;           // hrdlo se potkává s dutinou
    const z1 = ro < Ro ? -Math.sqrt(Ro * Ro - ro * ro) : 0;           // hrdlo vychází z vnější koule
    const dk = p.zahloubeni === 'zadne' ? p.otvorD : Math.max(p.otvorD, p.hlavaSroubuD);
    const hlZahl = p.zahloubeni === 'kuzel' ? (dk - p.otvorD) / 2 : p.zahloubeni === 'valec' ? p.hlavaSroubuH : 0;
    const okraj = Math.max(dk / 2 + 1.2, p.otvorD / 2 + 2);
    return { Rb, Rc, Ro, ro, rs, z0, z1, dk, hlZahl, okraj, presahDrzeni: Rb - ro };
  }

  function kontrolaKoule(p, ch, up) {
    const r = rozmeryKoule(p);
    if (p.krcekD >= p.otvorJamkyD) ch('krcekD', 'Krček musí být užší než hrdlo jamky, jinak se kloub nemůže naklonit.');
    if (p.otvorJamkyD >= p.kouleD) ch('otvorJamkyD', 'Hrdlo jamky musí být užší než koule, jinak koule vypadne.');
    else if (r.presahDrzeni < 0.2) up('otvorJamkyD', `Koule přesahuje hrdlo jen o ${fmt(r.presahDrzeni)} mm na poloměru – bude snadno vypadávat.`);
    if (p.krcekD > p.kouleD * 0.9) ch('krcekD', 'Krček je skoro stejně silný jako koule.');
    if (p.krcekL < r.Ro + 0.5) ch('krcekL', `Krček je kratší než vnější poloměr jamky (${fmt(r.Ro)} mm) – deska by narážela do jamky.`);
    if (p.sloupekL < r.Ro * 0.6) ch('sloupekL', `Výška jamky musí být aspoň ${fmt(r.Ro * 0.6)} mm, aby jamka měla nad koulí dost materiálu.`);
    if (p.deskaA < 2 * r.Ro && p.deskaA < p.krcekD + 2) ch('deskaA', 'Montážní deska je menší než jamka i krček.');
    if (p.deskaA < 2 * r.Ro) up('deskaA', 'Montážní deska je užší než jamka – jamka bude přečnívat přes desku.');
    if (p.otvoru > 0) {
      if (![2, 4].includes(p.otvoru)) up('otvoru', 'U kulového kloubu se použijí 2 nebo 4 otvory (v rozích desky).');
      if (p.zahloubeni !== 'zadne' && p.hlavaSroubuD <= p.otvorD) ch('hlavaSroubuD', 'Hlava šroubu musí být větší než otvor.');
      if (r.hlZahl > p.deskaT - 0.4) ch('deskaT', `Zahloubení (${fmt(r.hlZahl)} mm) je hlubší, než dovoluje deska.`);
      const roh = p.deskaA / 2 - r.okraj;
      if (roh < r.dk / 2 + 0.5) ch('deskaA', 'Otvory se do desky nevejdou – zvětšete desku nebo zmenšete otvory.');
      else if (Math.hypot(roh, roh) - r.dk / 2 < Math.max(r.rs, 0) + 0.5) up('deskaA', 'Hlavy šroubů zasahují ke krčku nebo jamce – šroubovák nemusí projít.');
    }
    if (p.zarezu > 0) {
      if (p.zarezH <= r.z1 + 1) ch('zarezH', 'Zářezy jsou tak krátké, že nic nepovolí – posuňte jejich horní konec výš.');
      if (p.zarezu * p.zarezS > Math.PI * p.otvorJamkyD * 0.5) ch('zarezS', 'Zářezy zabírají víc než polovinu obvodu hrdla.');
      if (p.zarezH > r.Ro - 0.5) up('zarezH', 'Zářezy vedou skoro až k vrcholu jamky – jamka se rozpadne na samostatné prsty.');
    } else if (r.presahDrzeni > 0.5) up('zarezu', 'Bez zářezů půjde koule zacvaknout jen u pružného materiálu (TPU) nebo malého přesahu.');
    if (p.naklonMax >= 89) up('naklonMax', 'Náklon téměř 90° je nad možnosti kulového kloubu s hrdlem.');
  }

  function rozmeryPruzneho(p) {
    const dk = p.zahloubeni === 'zadne' ? p.otvorD : Math.max(p.otvorD, p.hlavaSroubuD);
    const hlZahl = p.zahloubeni === 'kuzel' ? (dk - p.otvorD) / 2 : p.zahloubeni === 'valec' ? p.hlavaSroubuH : 0;
    return { dk, hlZahl };
  }

  function kontrolaPruzneho(p, ch, up) {
    const r = rozmeryPruzneho(p);
    if (p.pasekT >= p.blokH) ch('pasekT', 'Pásek musí být tenčí než bloky.');
    if (p.ohybMin >= p.ohybMax) ch('ohybMax', 'Rozsah ohybu: „do“ musí být větší než „od“.');
    if (p.pasekT < 2 * p.vrstva) up('pasekT', `Pásek má méně než 2 vrstvy (${fmt(p.pasekT / p.vrstva)}) – bude děravý nebo se při prvním ohybu roztrhne.`);
    const nv = p.pasekT / p.vrstva;
    if (Math.abs(nv - Math.round(nv)) > 0.05) up('pasekT', `Tloušťka pásku není celistvý násobek výšky vrstvy (${fmt(nv)} vrstvy) – slicer ji zaokrouhlí.`);
    if (p.otvoru > 0) {
      if (p.zahloubeni !== 'zadne' && p.hlavaSroubuD <= p.otvorD) ch('hlavaSroubuD', 'Hlava šroubu musí být větší než otvor.');
      if (r.hlZahl > p.blokH - 0.4) ch('blokH', `Zahloubení (${fmt(r.hlZahl)} mm) je hlubší, než dovoluje výška bloku.`);
      if (p.blokL < r.dk + 1) ch('blokL', 'Otvory se do bloku nevejdou – prodlužte blok.');
      if (p.delkaP / p.otvoru < r.dk + 1) ch('otvoru', 'Otvory jsou podél bloku příliš nahusto.');
    }
  }

  /* ---------- vzorce (nezávislé na síti; slouží k porovnání s geometrickou kontrolou) ---------- */
  const RAD = Math.PI / 180;

  /* Mezní úhly pantu s listy zarovnanými ke spodku článku (osa v počátku, list A vlevo, B vpravo):
     – zavírání (kladný úhel): horní plochy listů jsou ve vzdálenosti d = R − t od osy, jako první se
       potkají vnější rohy (±W, −d), a to při otočení o 180° + 2·atan(d/W);
     – opačný směr: deska každého listu je kolem článků druhého listu vybraná na poloměr R + c, takže
       nejbližší bod spodní plochy je ve vzdálenosti yc = √((R + c)² − R²) od osy; dva takové body
       (yc, −R) a (−yc, −R) se potkají při otočení o −(180° − 2·atan(R/yc)). Bez vůle (c = 0) to je 0°.
     Platí pro d ≥ 0 (list nejvýš tak tlustý jako poloměr článku). */
  function teorieMezePantu(p) {
    const R = p.prumerKloubu / 2, d = R - p.tloustka, W = p.sirka, c = p.vuleR;
    const yc = Math.sqrt((R + c) * (R + c) - R * R);
    return { max: 180 + 2 * Math.atan2(d, W) / RAD, min: -(180 - 2 * Math.atan2(R, yc) / RAD), platne: d >= 0 };
  }

  /* Mezní náklon kulového kloubu: krček (válec o poloměru rs, osa prochází středem koule)
     narazí na hranu hrdla. Hrdlo je válcová plocha o poloměru ro mezi z0 (dutina) a z1 (vnější koule).
     Bod hrdla (ro, z) leží pod úhlem atan(ro/|z|) od osy jamky ve vzdálenosti ρ = √(ro² + z²);
     osa krčku nakloněná o α má od něj vzdálenost ρ·sin(atan(ro/|z|) − α), dotek je při rovnosti s rs.
     Rozhoduje nejmenší úhel přes celé hrdlo. Bez zářezů nezávisí na směru náklonu. */
  function teorieNaklonu(p) {
    const r = rozmeryKoule(p);
    if (r.rs >= r.ro) return 0;
    let nej = Infinity;
    const N = 400;
    for (let i = 0; i <= N; i++) {
      const z = r.z0 + (r.z1 - r.z0) * i / N, rho = Math.hypot(r.ro, z);
      const a = Math.atan2(r.ro, -z) - Math.asin(Math.min(1, r.rs / rho));
      if (a < nej) nej = a;
    }
    return nej / RAD;
  }

  /* Pružný pásek ohnutý do oblouku (konstantní křivost κ = θ/L):
     největší poměrné přetvoření na povrchu ε = κ·t/2 = t·θ/(2L),
     ohybový moment M = E·I·κ, I = b·t³/12 → M = E·b·t³·θ/(12·L) [N·mm]. */
  function pruznyPasek(p, uhelStupne) {
    const th = Math.abs(uhelStupne) * RAD, m = MATERIALY[p.material] || MATERIALY.PETG;
    const eps = p.pasekT * th / (2 * p.pasekL);
    const I = p.delkaP * Math.pow(p.pasekT, 3) / 12;
    const M = m.E * I * th / p.pasekL;
    const polomer = th > 0 ? p.pasekL / th : Infinity;
    return { eps, M, I, polomer, epsKr: m.epsKr, epsOpak: m.epsOpak };
  }

  /* Úhel ohybu, kdy se dotknou horní vnitřní hrany bloků (stejně vysoké bloky, pásek dole):
     oblouk neutrální osy v z = t/2 o poloměru ρ = L/θ; hrany se potkají, když ρ = H − t/2,
     tj. θ = L / (H − t/2). */
  function teorieOhybu(p) {
    const rad = p.pasekL / (p.blokH - p.pasekT / 2);
    return rad / RAD;
  }

  /* Zacvaknutí koule: zářezy dělí jamku na pružné prsty (vetknutý nosník obdélníkového průřezu).
     Podle návrhových pravidel pro západky (Bayer): ε = 1,5·y·h / l², kde y = potřebné rozevření
     (přesah koule přes hrdlo na poloměru), h = tloušťka prstu (stěna jamky), l = délka prstu (zářezu). */
  function zacvaknuti(p) {
    const r = rozmeryKoule(p), m = MATERIALY[p.material] || MATERIALY.PETG;
    if (p.zarezu < 1) return null;
    const y = Math.max(0, r.Rb - r.ro), h = p.stena, l = p.zarezH - r.z1;
    if (l <= 0) return { y, h, l, eps: Infinity, epsKr: m.epsKr };
    return { y, h, l, eps: 1.5 * y * h / (l * l), epsKr: m.epsKr };
  }

  /* ---------- upozornění pro FDM tisk ----------
     Vrací pole {uroven: 'chyba'|'varovani'|'info', nadpis, text}. */
  function upozorneniTisku(rezim, p) {
    const u = [], m = MATERIALY[p.material] || MATERIALY.PETG, tr = p.tryska;
    const add = (uroven, nadpis, text) => u.push({ uroven, nadpis, text });
    if (rezim === 'pant' || rezim === 'cep') {
      const r = rozmeryPantu(p);
      if (rezim === 'pant') {
        if (p.vuleR < 0.2) add('chyba', 'Vůle pro tisk v místě', `Radiální vůle ${fmt(p.vuleR)} mm je pro tisk vcelku příliš malá – čep se s článkem nejspíš spojí. Běžně funguje 0,3–0,5 mm (tryska 0,4 mm); vždy vytiskněte zkušební kus.`);
        else if (p.vuleR < 0.3) add('varovani', 'Vůle pro tisk v místě', `Vůle ${fmt(p.vuleR)} mm je hraniční. Záleží na kalibraci průtoku, chlazení a materiálu (PETG lepí víc než PLA).`);
        if (p.vuleA < 0.3) add('varovani', 'Axiální mezera', 'Mezera mezi články pod 0,3 mm se u první vrstvy (rozplácnutí, „sloní noha“) a u přemostění snadno zalije.');
        add('info', 'Převis čepu', 'Čep visí v otvoru bez podpory: spodní strana otvoru se tiskne, horní je přemostění, které se mírně prověsí. Po tisku pant několikrát protočte, aby se uvolnil.');
        if (p.prumerCepu < 2.5) add('varovani', 'Tenký tištěný čep', `Tištěný čep ⌀ ${fmt(p.prumerCepu)} mm má málo perimetrů a ve střihu snadno praskne.`);
      } else {
        add('info', 'Orientace čepu', p.zplosteni > 0
          ? 'Čep tiskněte naležato na zploštělé straně – vrstvy pak běží podél čepu a zatížení střihem jde přes vlákna, ne mezi vrstvami.'
          : 'Bez zploštění se čep tiskne nastojato: zatížení střihem pak působí přesně mezi vrstvami (nejslabší směr). Zvažte zploštění nebo kovový čep.');
        add('info', 'Kovový čep', `Místo tištěného čepu lze použít drát, hřebík nebo šroub ⌀ ${fmt(p.prumerCepu)} mm (otvor ⌀ ${fmt(p.prumerCepu + 2 * p.vuleR)} mm). Je výrazně pevnější a nemaže se.`);
      }
      add('info', 'Vodorovné otvory', `Otvory v článcích leží vodorovně, jejich strop je přemostění – skutečný průměr bývá o 0,1–0,3 mm menší. Proto je vůle ${fmt(p.vuleR)} mm na poloměru, ne na průměru.`);
      add('info', 'Směrová pevnost', 'Listy se tisknou naplocho: v ohybu kolem osy pantu jsou pevné. Články jsou kroužky z vrstev rovnoběžných s osou – síla od čepu kolmo nahoru je trhá mezi vrstvami; nezatěžujte pant tahem kolmo od podložky.');
      if (p.tloustka < 3 * tr) add('varovani', 'Tenký list', `List ${fmt(p.tloustka)} mm odpovídá méně než 3 šířkám extruze – ohyb listu bude měkký.`);
      if (r.stena < 3 * tr) add('varovani', 'Stěna článku', `Stěna článku ${fmt(r.stena)} mm – doporučeno aspoň 3 perimetry (${fmt(3 * tr)} mm) a 100% výplň článků.`);
    }
    if (rezim === 'kulovy') {
      const z = zacvaknuti(p), r = rozmeryKoule(p);
      add('info', 'Krček je nejslabší místo', 'Krček se tiskne nastojato, ohyb krčku tedy namáhá spoje mezi vrstvami – praskne o řád dřív než ve směru vláken. Volte co nejsilnější krček, 100% výplň, nebo krček z kovového šroubu.');
      add('info', 'Převisy', 'Spodní polovina koule převisá nad krčkem (u menších koulí tiskne většina tiskáren bez podpěr, u větších přidejte podpěru jen z podložky). Jamka se tiskne hrdlem nahoru, vnitřní klenba nad hrdlem je převis do 45° od svislice jen u vyšší vůle.');
      if (z) {
        const pomer = z.eps / z.epsKr;
        add(pomer > 1 ? 'chyba' : pomer > 0.7 ? 'varovani' : 'info', 'Zacvaknutí',
          `Prsty jamky se při nasazení rozevřou o ${fmt(z.y)} mm. Odhad přetvoření ε = 1,5·y·h/l² = ${fmt(z.eps * 100)} % (orientační mez pro ${m.nazev}: ${fmt(z.epsKr * 100)} %). ` +
          (pomer > 1 ? 'Prsty pravděpodobně prasknou – prodlužte zářezy, ztenčete stěnu nebo zmenšete přesah.' : 'Vrstvy prstů jsou kolmo k ohybu – výtisk vydrží méně než vstřikovaný díl.'));
      }
      if (p.vuleK < 0.15) add('varovani', 'Vůle koule', 'Vůle v jamce pod 0,15 mm – kloub půjde ztuha, po tisku ho rozhýbejte.');
      if (r.presahDrzeni > 0 && p.zarezu === 0 && p.material !== 'TPU') add('varovani', 'Montáž', 'Jamka bez zářezů z tuhého materiálu: kouli bude nutné vtlačit za tepla, nebo kloub tisknout s TPU.');
    }
    if (rezim === 'pruzny') {
      const s = pruznyPasek(p, Math.max(Math.abs(p.ohybMin), Math.abs(p.ohybMax)));
      const pom = s.eps / s.epsOpak;
      add(s.eps > s.epsKr ? 'chyba' : pom > 1 ? 'varovani' : 'info', 'Přetvoření pásku',
        `Při ohybu ${fmt(Math.max(Math.abs(p.ohybMin), Math.abs(p.ohybMax)))}° je přetvoření povrchu pásku ε = t·θ/(2L) = ${fmt(s.eps * 100)} %. Orientačně ${m.nazev}: opakovaný ohyb do ${fmt(s.epsOpak * 100)} %, jednorázově do ${fmt(s.epsKr * 100)} %. Únava: ${m.unava}.`);
      add('info', 'Směr vláken', 'Pásek tiskněte naplocho (spodní vrstvy) a s vlákny napříč přes ohyb (kolmo k ose ohybu) – v pásku nastavte 100% výplň a úhel výplně kolmo na osu. Vlákna podél osy ohybu se roztrhnou při prvním ohnutí.');
      if (p.material === 'PLA') add('varovani', 'PLA', 'PLA je pro pružné panty nevhodné – po několika ohybech praskne. Lepší je PP, PETG nebo TPU.');
    }
    add('info', 'Tolerance tisku', `Rozměry výtisku se běžně liší o ±0,1–0,2 mm (u otvorů víc). Pro vůle počítejte s průměrem trysky ${fmt(tr)} mm a výškou vrstvy ${fmt(p.vrstva)} mm, vždy si vytiskněte zkušební kus, případně kalibrační měrku vůlí.`);
    add('info', 'Teplota', `${m.nazev} měkne zhruba od ${m.teplota} °C – v autě, na slunci nebo u topení se díl může zdeformovat.`);
    return u;
  }

  const NEOVERENO = 'Model je jen geometrický návrh pro FDM tisk. Není ověřený výpočtem ani zkouškou pro bezpečnostně kritické použití (nosné a zdvihací prvky, ochranná zařízení, dveře a poklopy nad lidmi, zdravotnické pomůcky, hračky pro malé děti). Pevnost výtisku závisí na materiálu, nastavení tisku a orientaci vrstev.';

  /* ---------- matice 4×4 (po sloupcích, jako three.js a manifold) ---------- */
  const mI = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  function mNasob(a, b) {
    const o = new Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
    return o;
  }
  const mPosun = (x, y, z) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
  /* otočení o úhel (stupně) kolem osy (ax, ay, az) procházející počátkem – Rodriguesův vzorec */
  function mOsa(ax, ay, az, stupne) {
    const n = Math.hypot(ax, ay, az); ax /= n; ay /= n; az /= n;
    const a = stupne * RAD, c = Math.cos(a), s = Math.sin(a), t = 1 - c;
    return [
      t * ax * ax + c, t * ax * ay + s * az, t * ax * az - s * ay, 0,
      t * ax * ay - s * az, t * ay * ay + c, t * ay * az + s * ax, 0,
      t * ax * az + s * ay, t * ay * az - s * ax, t * az * az + c, 0,
      0, 0, 0, 1];
  }
  const mRotX = st => mOsa(1, 0, 0, st);
  function mBod(m, b) {
    return [m[0] * b[0] + m[4] * b[1] + m[8] * b[2] + m[12],
            m[1] * b[0] + m[5] * b[1] + m[9] * b[2] + m[13],
            m[2] * b[0] + m[6] * b[1] + m[10] * b[2] + m[14]];
  }

  /* Pohyb dílu B pružného spoje: konec oblouku neutrální osy (z = t/2) délky L ohnutého o θ.
     T(q) = P + R(θ)·(q − (·, L, t/2)). */
  function maticeOhybu(p, stupne) {
    const th = stupne * RAD, L = p.pasekL, z0 = p.pasekT / 2;
    let Py, Pz;
    if (Math.abs(th) < 1e-9) { Py = L; Pz = z0; }
    else { const rho = L / th; Py = rho * Math.sin(th); Pz = z0 + rho * (1 - Math.cos(th)); }
    return mNasob(mPosun(0, Py, Pz), mNasob(mRotX(stupne), mPosun(0, -L, -z0)));
  }
  /* Bod pásku (x, y ∈ ⟨0, L⟩, z) v ohnutém stavu. */
  function bodOhybu(p, stupne, v) {
    const th = stupne * RAD, L = p.pasekL, z0 = p.pasekT / 2;
    if (Math.abs(th) < 1e-9) return [v[0], v[1], v[2]];
    const k = th / L, s = Math.min(L, Math.max(0, v[1])), rho = 1 / k, a = k * s, h = v[2] - z0;
    return [v[0], rho * Math.sin(a) - h * Math.sin(a), z0 + rho * (1 - Math.cos(a)) + h * Math.cos(a)];
  }
  /* Kulový kloub: náklon o α kolem vodorovné osy kolmé na směr azimutu φ (krček se vychýlí směrem φ). */
  function maticeNaklonu(alfa, azimut) {
    const f = azimut * RAD;
    // krček míří dolů (−Z); aby se jeho konec vychýlil ve směru (cos φ, sin φ), otáčíme kolem (−sin φ, cos φ, 0) záporně
    return mOsa(-Math.sin(f), Math.cos(f), 0, -alfa);
  }

  /* ---------- sítě ---------- */
  /* Indexovaná síť z manifold.getMesh(): {poz: Float64Array xyz, idx: Uint32Array}. */
  function sitZMeshe(mesh) {
    const np = mesh.numProp, vp = mesh.vertProperties, n = vp.length / np;
    const poz = new Float64Array(n * 3);
    for (let i = 0; i < n; i++) { poz[i * 3] = vp[i * np]; poz[i * 3 + 1] = vp[i * np + 1]; poz[i * 3 + 2] = vp[i * np + 2]; }
    return { poz, idx: Uint32Array.from(mesh.triVerts) };
  }

  /* Kontrola sítě: každá hrana právě ve dvou trojúhelnících s opačnou orientací,
     objem přes divergenční větu (kladný = normály ven), degenerované trojúhelníky. */
  function zkontrolujSit(sit) {
    const { poz, idx } = sit, hrany = new Map();
    let objem = 0, degen = 0, chybnych = 0;
    const nt = idx.length / 3;
    for (let t = 0; t < nt; t++) {
      const a = idx[t * 3], b = idx[t * 3 + 1], c = idx[t * 3 + 2];
      if (a === b || b === c || a === c) { degen++; continue; }
      const ax = poz[a * 3], ay = poz[a * 3 + 1], az = poz[a * 3 + 2];
      const bx = poz[b * 3], by = poz[b * 3 + 1], bz = poz[b * 3 + 2];
      const cx = poz[c * 3], cy = poz[c * 3 + 1], cz = poz[c * 3 + 2];
      objem += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
      const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
      if (Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) < 1e-12) degen++;
      for (const [i, j] of [[a, b], [b, c], [c, a]]) {
        const k = i < j ? i + ',' + j : j + ',' + i, smer = i < j ? 1 : -1;
        const z = hrany.get(k);
        if (!z) hrany.set(k, { n: 1, s: smer });
        else { z.n++; z.s += smer; }
      }
    }
    for (const z of hrany.values()) if (z.n !== 2 || z.s !== 0) chybnych++;
    return { vodotesna: chybnych === 0 && hrany.size > 0, chybnychHran: chybnych, hran: hrany.size, trojuhelniku: nt, degenerovanych: degen, objem };
  }

  /* Binární STL: 80 B hlavička, počet, pro každý trojúhelník normála + 3 vrcholy (float32) + 2 B atribut. */
  function stlBinarni(sit, nazev) {
    const { poz, idx } = sit, nt = idx.length / 3;
    const buf = new ArrayBuffer(84 + 50 * nt), dv = new DataView(buf);
    const hl = ('Panty a klouby – ' + (nazev || 'dil')).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '-').slice(0, 79);
    for (let i = 0; i < hl.length; i++) dv.setUint8(i, hl.charCodeAt(i));
    dv.setUint32(80, nt, true);
    let o = 84;
    for (let t = 0; t < nt; t++) {
      const v = [0, 1, 2].map(k => { const i = idx[t * 3 + k]; return [poz[i * 3], poz[i * 3 + 1], poz[i * 3 + 2]]; });
      const ux = v[1][0] - v[0][0], uy = v[1][1] - v[0][1], uz = v[1][2] - v[0][2];
      const wx = v[2][0] - v[0][0], wy = v[2][1] - v[0][1], wz = v[2][2] - v[0][2];
      let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      dv.setFloat32(o, nx, true); dv.setFloat32(o + 4, ny, true); dv.setFloat32(o + 8, nz, true); o += 12;
      for (const b of v) { dv.setFloat32(o, b[0], true); dv.setFloat32(o + 4, b[1], true); dv.setFloat32(o + 8, b[2], true); o += 12; }
      dv.setUint16(o, 0, true); o += 2;
    }
    return buf;
  }

  /* Čtení binárního STL a svaření vrcholů podle přesné shody souřadnic (float32). */
  function ctiStl(buf) {
    const dv = new DataView(buf);
    if (buf.byteLength < 84) throw new Error('STL je kratší než hlavička');
    const nt = dv.getUint32(80, true);
    if (84 + 50 * nt !== buf.byteLength) throw new Error('délka STL neodpovídá počtu trojúhelníků');
    const mapa = new Map(), poz = [], idx = new Uint32Array(nt * 3), normaly = new Float32Array(nt * 3);
    let o = 84;
    for (let t = 0; t < nt; t++) {
      normaly[t * 3] = dv.getFloat32(o, true); normaly[t * 3 + 1] = dv.getFloat32(o + 4, true); normaly[t * 3 + 2] = dv.getFloat32(o + 8, true);
      o += 12;
      for (let k = 0; k < 3; k++) {
        const x = dv.getFloat32(o, true), y = dv.getFloat32(o + 4, true), z = dv.getFloat32(o + 8, true); o += 12;
        const kl = x + ',' + y + ',' + z;
        let i = mapa.get(kl);
        if (i === undefined) { i = poz.length / 3; poz.push(x, y, z); mapa.set(kl, i); }
        idx[t * 3 + k] = i;
      }
      o += 2;
    }
    return { poz: Float64Array.from(poz), idx, normaly, trojuhelniku: nt };
  }

  /* ---------- rozmístění na podložce ----------
     polozky: [{id, sirka, hloubka}] (obrysy v mm), podlozka {sirka, hloubka}, rozestup mm.
     Policové skládání: díly seřazené podle hloubky, delší strana podél X (pokud se vejde),
     díly, které se nevejdou ani samy, jsou v poli nevejde. Celé rozmístění se vycentruje. */
  function rozmisti(polozky, podlozka, rozestup) {
    rozestup = Math.max(0, rozestup || 0);
    const W = podlozka.sirka, D = podlozka.hloubka, vysl = [], nevejde = [];
    const pr = polozky.map(p => {
      let w = p.sirka, d = p.hloubka, otoceno = false;
      const vejdeSe = (a, b) => a <= W + 1e-9 && b <= D + 1e-9;
      if ((d > w && vejdeSe(d, w)) || !vejdeSe(w, d)) { if (vejdeSe(d, w)) { [w, d] = [d, w]; otoceno = true; } }
      return { id: p.id, w, d, otoceno, ok: vejdeSe(w, d) };
    }).sort((a, b) => b.d - a.d || b.w - a.w);
    let x = 0, y = 0, polHloubka = 0;
    for (const q of pr) {
      if (!q.ok) { nevejde.push(q.id); continue; }
      if (x > 0 && x + q.w > W + 1e-9) { y += polHloubka + rozestup; x = 0; polHloubka = 0; }
      if (y + q.d > D + 1e-9) { nevejde.push(q.id); continue; }
      vysl.push({ id: q.id, x, y, sirka: q.w, hloubka: q.d, otoceno: q.otoceno });
      x += q.w + rozestup; polHloubka = Math.max(polHloubka, q.d);
    }
    if (vysl.length) {
      const maxX = Math.max(...vysl.map(v => v.x + v.sirka)), maxY = Math.max(...vysl.map(v => v.y + v.hloubka));
      const dx = (W - maxX) / 2, dy = (D - maxY) / 2;
      for (const v of vysl) { v.x += dx; v.y += dy; }
    }
    const plocha = vysl.reduce((s, v) => s + v.sirka * v.hloubka, 0);
    return { umisteni: vysl, nevejde, vyuziti: plocha / (W * D) };
  }

  const PODLOZKY = [
    ['220x220', 'Ender 3 / obecná 220 × 220 mm', 220, 220],
    ['250x210', 'Prusa MK3/MK4 250 × 210 mm', 250, 210],
    ['256x256', 'Bambu X1/P1/A1 256 × 256 mm', 256, 256],
    ['180x180', 'Prusa MINI / A1 mini 180 × 180 mm', 180, 180],
    ['300x300', 'Velká 300 × 300 mm', 300, 300],
    ['vlastni', 'Vlastní rozměr', 0, 0]
  ];

  /* ---------- pomocné ---------- */
  function fmt(x, des) {
    if (!Number.isFinite(x)) return x > 0 ? '∞' : '–';
    if (des === undefined) des = Math.abs(x) >= 100 ? 0 : Math.abs(x) >= 10 ? 1 : 2;
    let s = x.toFixed(des);
    if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
    if (s === '-0') s = '0';
    return s.replace('.', ',').replace('-', '−');
  }

  const api = { REZIMY, MATERIALY, PARAMETRY, PODLE_KLICE, PODLOZKY, NEOVERENO, RAD,
    vychozi, cislo, normalizuj, rozmeryPantu, rozmeryKoule, rozmeryPruzneho,
    teorieMezePantu, teorieNaklonu, teorieOhybu, pruznyPasek, zacvaknuti, upozorneniTisku,
    mI, mNasob, mPosun, mOsa, mRotX, mBod, maticeOhybu, bodOhybu, maticeNaklonu,
    sitZMeshe, zkontrolujSit, stlBinarni, ctiStl, rozmisti, fmt };
  if (typeof module !== 'undefined') module.exports = api; else window.PANTY = api;
})();

/* Konec pracovního poměru – jádro bez DOM (test: _test/konec_pp_test.js).
   Zákoník práce 262/2006 Sb. ve znění flexinovely 120/2025 Sb. (účinnost 1. 6. 2025): výpovědní doba (§ 51) běží
   ode dne doručení výpovědi a končí dnem stejného čísla (chybí-li, posledním dnem měsíce); výpověď doručená
   před 1. 6. 2025 se řídí dosavadní úpravou (od 1. dne následujícího měsíce). Výpověď pro § 52 písm. f)–h) = 1 měsíc.
   Odstupné § 67 (1–3× z org. důvodů, 12× při nejvyšší přípustné expozici), jednorázová náhrada 12× při pracovním
   úrazu / nemoci z povolání (§ 271ca). Dovolená § 212–213, 222. Ručně stárnoucí data – stav k 11/2026, orientačně. */
(function () {
  'use strict';

  const VERZE = 1;
  const KLIC = 'webapp_konec_pp';
  const STAV_K = '11/2026';

  const PARAMETRY = {
    rok: 2026,
    ucinnostFlexinovely: '2025-06-01',     // zák. 120/2025 Sb.
    vypovedniMesicu: 2,                    // § 51 odst. 1
    vypovedniKratkaMesicu: 1,              // výpověď podle § 52 písm. f)–h)
    kratkaPismena: ['f', 'g', 'h'],
    zkusebniMesicu: 4, zkusebniVedouciMesicu: 8,   // § 35 po flexinovele (dříve 3 / 6)
    odstupneNasobky: [1, 2, 3],            // trvání < 1 rok, 1–2 roky, ≥ 2 roky (§ 67 odst. 1)
    odstupneExpozice: 12,                  // § 52 písm. e) – nejvyšší přípustná expozice
    nahradaUraz: 12,                       // § 271ca – pracovní úraz / nemoc z povolání (od 1. 6. 2025 místo odstupného)
    tydnuDovolene: 4, minOdpracovanoTydnu: 4,
    tydnuRok: 52,
    tydnuMesic: 4.348,                     // průměrný počet týdnů v měsíci (odhad průměrného výdělku)
    upPracovnichDnu: 3,                    // registrace na ÚP do 3 prac. dnů → podpora od následujícího dne po skončení
    ochrannaLhutaNemoc: 7,                 // § 15 zák. 187/2006 Sb.
    zpDnu: 8,                              // oznámení zdravotní pojišťovně
    zalobaMesicu: 2                        // § 72 – neplatnost rozvázání
  };

  const DUVODY = {
    a: { text: '§ 52 a) – zrušení nebo přemístění zaměstnavatele', skupina: 'org' },
    b: { text: '§ 52 b) – přemístění zaměstnavatele', skupina: 'org' },
    c: { text: '§ 52 c) – nadbytečnost (organizační změna)', skupina: 'org' },
    d: { text: '§ 52 d) – dlouhodobá ztráta zdravotní způsobilosti', skupina: 'zdravi' },
    e: { text: '§ 52 e) – nejvyšší přípustná expozice', skupina: 'expozice' },
    f: { text: '§ 52 f) – nesplňuje předpoklady / neuspokojivé výsledky', skupina: 'poruseni' },
    g: { text: '§ 52 g) – porušení povinností', skupina: 'poruseni' },
    h: { text: '§ 52 h) – porušení režimu dočasně práce neschopného', skupina: 'poruseni' }
  };
  const ZPUSOBY = {
    vypoved_zam: 'Výpověď zaměstnance',
    vypoved_zav: 'Výpověď zaměstnavatele',
    dohoda: 'Dohoda o rozvázání',
    okamzite: 'Okamžité zrušení',
    zkusebni: 'Zrušení ve zkušební době',
    urcita: 'Uplynutí doby určité'
  };

  /* ---------- data ---------- */
  const jeDatum = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !isNaN(Date.parse(s));
  const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const zIso = s => { const [r, m, d] = s.split('-').map(Number); return new Date(r, m - 1, d); };
  const pridejDny = (s, n) => { const d = zIso(s); d.setDate(d.getDate() + n); return iso(d); };
  const rozdilDnu = (a, b) => Math.round((zIso(b) - zIso(a)) / 864e5);
  const dnuVMesici = (r, m) => new Date(r, m + 1, 0).getDate();   // m od 0
  const formatDatum = s => jeDatum(s) ? zIso(s).toLocaleDateString('cs-CZ') : '';
  const formatKc = (n, des) => (Math.round(n * 100) / 100).toLocaleString('cs-CZ', { minimumFractionDigits: des || 0, maximumFractionDigits: des || 0 }) + ' Kč';
  const DNY_TYDNE = ['neděle', 'pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota'];
  const denTydne = s => DNY_TYDNE[zIso(s).getDay()];

  /* Den se stejným číslem o n měsíců později; neexistuje-li, poslední den měsíce. */
  function stejnyDen(s, n) {
    const [r, m, d] = s.split('-').map(Number);
    const c = new Date(r, m - 1 + n, 1);
    const max = dnuVMesici(c.getFullYear(), c.getMonth());
    return { datum: iso(new Date(c.getFullYear(), c.getMonth(), Math.min(d, max))), oriznuto: d > max };
  }
  const pridejMesice = (s, n) => stejnyDen(s, n).datum;

  /* Celé roky mezi dvěma daty (výročí). */
  function celychRoku(od, do_) {
    const a = zIso(od), b = zIso(do_);
    let r = b.getFullYear() - a.getFullYear();
    if (b.getMonth() < a.getMonth() || (b.getMonth() === a.getMonth() && b.getDate() < a.getDate())) r--;
    return Math.max(0, r);
  }

  /* ---------- svátky ČR a pracovní dny ---------- */
  function velikonocniNedele(r) {   // Meeus/Jones/Butcher
    const a = r % 19, b = Math.floor(r / 100), c = r % 100, d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mes = Math.floor((h + l - 7 * m + 114) / 31), den = ((h + l - 7 * m + 114) % 31) + 1;
    return iso(new Date(r, mes - 1, den));
  }
  function svatky(r) {
    const vn = velikonocniNedele(r);
    return new Set(['01-01', '05-01', '05-08', '07-05', '07-06', '09-28', '10-28', '11-17', '12-24', '12-25', '12-26'].map(x => r + '-' + x)
      .concat([pridejDny(vn, -2), pridejDny(vn, 1)]));
  }
  function jePracovni(s) {
    const den = zIso(s).getDay();
    return den !== 0 && den !== 6 && !svatky(+s.slice(0, 4)).has(s);
  }
  /* n-tý pracovní den po datu s (s sám se nepočítá). */
  function pracovniDenPo(s, n) {
    let d = s, k = 0;
    while (k < n) { d = pridejDny(d, 1); if (jePracovni(d)) k++; }
    return d;
  }

  /* ---------- výpovědní doba ---------- */
  /* Nový běh (od 1. 6. 2025): od dne doručení do dne stejného čísla. Starý (výpověď doručená dříve nebo sjednaný):
     od 1. dne následujícího měsíce do posledního dne měsíce. */
  function vypovedniDoba(doruceni, mesicu, staryBeh) {
    if (staryBeh) {
      const [r, m] = doruceni.split('-').map(Number);
      const zac = iso(new Date(r, m, 1));
      return { zacatek: zac, konec: iso(new Date(r, m + mesicu, 0)), oriznuto: false, staryBeh: true };
    }
    const k = stejnyDen(doruceni, mesicu);
    return { zacatek: doruceni, konec: k.datum, oriznuto: k.oriznuto, staryBeh: false };
  }

  /* Délka výpovědní doby v měsících: zákonná podle důvodu, sjednaná delší má přednost. */
  function delkaVypovedni(zpusob, duvod, doruceni, sjednana) {
    const predNovelou = doruceni < PARAMETRY.ucinnostFlexinovely;
    let zakonna = PARAMETRY.vypovedniMesicu;
    if (zpusob === 'vypoved_zav' && !predNovelou && PARAMETRY.kratkaPismena.includes(duvod)) zakonna = PARAMETRY.vypovedniKratkaMesicu;
    return { zakonna, mesicu: Math.max(zakonna, Math.round(sjednana || 0)), predNovelou };
  }

  /* Ochranná doba (§ 53) prodlužuje výpověď zaměstnavatele; zákaz výpovědi se nevztahuje na § 52 a), b), g), h) (§ 54, zjednodušeně). */
  const ochranaPlati = (zpusob, duvod) => zpusob === 'vypoved_zav' && !['a', 'b', 'g', 'h'].includes(duvod);

  /* ---------- zkušební doba ---------- */
  /* Běží ode dne vzniku PP, končí dnem před dnem stejného čísla (nebo posledním dnem měsíce, chybí-li), prodlužuje se o překážky. */
  function zkusebniDoba(nastup, mesicu, vedouci, prekazkyDnu, konecUrcita) {
    const max = vedouci ? PARAMETRY.zkusebniVedouciMesicu : PARAMETRY.zkusebniMesicu;
    const m = Math.min(Math.max(1, Math.round(mesicu || max)), max);
    const k = stejnyDen(nastup, m);
    let konec = k.oriznuto ? k.datum : pridejDny(k.datum, -1);
    let omezenoUrcitou = false;
    if (jeDatum(konecUrcita) && konecUrcita > nastup) {   // nejvýš polovina sjednané doby trvání PP
      const pul = pridejDny(nastup, Math.floor((rozdilDnu(nastup, konecUrcita) + 1) / 2) - 1);
      if (pul < konec) { konec = pul; omezenoUrcitou = true; }
    }
    const prek = Math.max(0, Math.round(prekazkyDnu || 0));
    return { mesicu: m, max, konecBez: konec, konec: pridejDny(konec, prek), prekazky: prek, omezenoUrcitou };
  }

  /* ---------- peníze ---------- */
  const prumerHodinovy = (mzda, uvazek) => Math.round(Math.max(0, +mzda || 0) / (Math.max(1, +uvazek || 40) * PARAMETRY.tydnuMesic) * 100) / 100;

  function odstupnePocet(nastup, konec) {
    const roky = celychRoku(nastup, konec);
    return { roky, nasobek: PARAMETRY.odstupneNasobky[Math.min(roky, 2)] };
  }

  /* Odstupné / jednorázová náhrada / náhrada mzdy za výpovědní dobu podle způsobu a důvodu. */
  function narokyPenezni(o, konec) {
    const mzda = Math.max(0, o.mzda || 0);
    const r = { odstupne: 0, odstupneNasobek: 0, odstupneText: 'nenáleží', nahradaUraz: 0, nahradaOkamzite: 0, roky: 0 };
    const sk = o.duvod && DUVODY[o.duvod] ? DUVODY[o.duvod].skupina : '';
    const sDuvodem = o.zpusob === 'vypoved_zav' || (o.zpusob === 'dohoda' && o.duvod);
    if (sDuvodem && sk === 'org') {
      const p = odstupnePocet(o.nastup, konec);
      r.roky = p.roky; r.odstupneNasobek = p.nasobek; r.odstupne = p.nasobek * mzda;
      r.odstupneText = `${p.nasobek}× průměrný výdělek (pracovní poměr ${p.roky < 1 ? 'kratší než 1 rok' : p.roky < 2 ? '1–2 roky' : 'aspoň 2 roky'}, § 67 odst. 1)`;
    } else if (sDuvodem && sk === 'expozice') {
      r.odstupneNasobek = PARAMETRY.odstupneExpozice; r.odstupne = PARAMETRY.odstupneExpozice * mzda;
      r.odstupneText = `${PARAMETRY.odstupneExpozice}× průměrný výdělek (nejvyšší přípustná expozice)`;
    } else if (sDuvodem && sk === 'zdravi' && o.uraz) {
      r.nahradaUraz = PARAMETRY.nahradaUraz * mzda;
      r.odstupneText = 'nenáleží – místo něj jednorázová náhrada § 271ca';
    }
    if (o.zpusob === 'okamzite' && o.okamziteKdo === 'zam') r.nahradaOkamzite = PARAMETRY.vypovedniMesicu * mzda;   // § 56 odst. 2
    return r;
  }

  /* Dovolená v hodinách: roční nárok × odpracované týdny / 52 (celé hodiny nahoru), nárok jen při ≥ 4 odpracovaných týdnech v roce. */
  function dovolena(o, konec) {
    const uvazek = Math.max(1, o.uvazek || 40);
    const rok = +konec.slice(0, 4);
    const od = jeDatum(o.nastup) && o.nastup > rok + '-01-01' ? o.nastup : rok + '-01-01';
    const kalDnu = Math.max(0, rozdilDnu(od, konec) + 1);
    const odpracHod = Math.max(0, Math.floor(kalDnu / 7) * uvazek - Math.max(0, o.neodpracovanoHod || 0));
    const tydnu = Math.min(PARAMETRY.tydnuRok, Math.floor(odpracHod / uvazek + 1e-9));
    const rocni = uvazek * (o.tydnuDovolene || PARAMETRY.tydnuDovolene);
    const narok = tydnu >= PARAMETRY.minOdpracovanoTydnu ? Math.ceil(rocni * tydnu / PARAMETRY.tydnuRok - 1e-9) : 0;
    const zbyva = narok + Math.max(0, o.prevedenoHod || 0) - Math.max(0, o.cerpanoHod || 0);
    const phv = prumerHodinovy(o.mzda, uvazek);
    return { od, kalDnu, tydnu, rocni, narok, zbyva, phv, nahrada: Math.max(0, zbyva) * phv, precerpano: zbyva < 0 ? -zbyva : 0 };
  }

  /* ---------- hlavní výpočet ---------- */
  function spocti(vstup) {
    const o = Object.assign(vychozi(), vstup || {});
    const varovani = [];
    const kroky = [];
    let konec, vd = null, zd = null, konecVD = null;
    const den = o.doruceni;

    if (o.zpusob === 'vypoved_zam' || o.zpusob === 'vypoved_zav') {
      const dl = delkaVypovedni(o.zpusob, o.duvod, den, o.sjednanaVD);
      const stary = dl.predNovelou || !!o.staryBeh;
      vd = Object.assign(vypovedniDoba(den, dl.mesicu, stary), dl);
      konecVD = vd.konec;
      konec = vd.konec;
      kroky.push(['Délka výpovědní doby', `${dl.mesicu} měs.${dl.mesicu > dl.zakonna ? ' (sjednaná delší)' : dl.zakonna === 1 ? ' (§ 52 f–h)' : ''}`]);
      kroky.push(['Běh', stary ? (dl.predNovelou ? 'výpověď doručena před 1. 6. 2025 – od 1. dne následujícího měsíce' : 'sjednaný: od 1. dne následujícího měsíce') : 'od dne doručení do dne stejného čísla']);
      if (vd.oriznuto) kroky.push(['Stejné číslo dne chybí', 'konec = poslední den měsíce']);
      const och = Math.max(0, Math.round(o.ochrannaDnu || 0));
      if (och && ochranaPlati(o.zpusob, o.duvod)) {
        konec = pridejDny(vd.konec, och);
        kroky.push(['Ochranná doba (§ 53)', `+${och} dní → výpovědní doba se o ně prodlužuje`]);
      } else if (och) varovani.push(o.zpusob === 'vypoved_zam' ? 'Ochranná doba (§ 53) prodlužuje jen výpověď danou zaměstnavatelem – u vaší výpovědi se nepočítá.' : 'U výpovědi podle § 52 a), b), g), h) se zákaz výpovědi a prodloužení o ochrannou dobu zpravidla neuplatní (§ 54) – nepočítáno.');
      if (o.zpusob === 'vypoved_zav' && !o.duvod) varovani.push('Zaměstnavatel může dát výpověď jen z důvodu v § 52 – zvolte důvod.');
    } else if (o.zpusob === 'zkusebni') {
      zd = zkusebniDoba(o.nastup, o.zkusebniMesicu, o.vedouci, o.prekazkyDnu, null);
      konec = den;
      kroky.push(['Zkušební doba', `${zd.mesicu} měs. (max ${zd.max}) + ${zd.prekazky} dní překážek → do ${formatDatum(zd.konec)}`]);
      if (den > zd.konec) varovani.push(`Zkušební doba skončila ${formatDatum(zd.konec)} – zrušení ve zkušební době už není možné.`);
      if (den < o.nastup) varovani.push('Datum zrušení je před nástupem.');
    } else if (o.zpusob === 'urcita') {
      konec = jeDatum(o.konecUrcita) ? o.konecUrcita : den;
      kroky.push(['Sjednaný konec', formatDatum(konec)]);
    } else {
      konec = den;   // dohoda (sjednaný den), okamžité zrušení (doručením)
    }
    if (jeDatum(o.nastup) && konec < o.nastup) varovani.push('Konec pracovního poměru vychází před nástupem – zkontrolujte data.');

    const pen = narokyPenezni(o, konec);
    const dov = dovolena(o, konec);
    const celkem = pen.odstupne + pen.nahradaUraz + pen.nahradaOkamzite + dov.nahrada;
    const vyplatniTermin = vyplatniDenPo(konec, o.vyplatniDen);
    return { o, konec, konecVD, vd, zd, pen, dov, celkem, varovani, kroky, vyplatniTermin, lhuty: lhuty(o, konec, vd, pen, vyplatniTermin) };
  }

  /* Nejbližší výplatní termín po skončení (den v měsíci; neexistuje-li, poslední den). */
  function vyplatniDenPo(konec, vyplatniDen) {
    const vd = Math.min(31, Math.max(1, Math.round(vyplatniDen || 15)));
    const [r, m] = konec.split('-').map(Number);
    for (let i = 0; i < 3; i++) {
      const c = new Date(r, m - 1 + i, 1);
      const d = iso(new Date(c.getFullYear(), c.getMonth(), Math.min(vd, dnuVMesici(c.getFullYear(), c.getMonth()))));
      if (d > konec) return d;
    }
    return konec;
  }

  /* Kalendář lhůt seřazený podle data. */
  function lhuty(o, konec, vd, pen, vyplatniTermin) {
    const L = [];
    const p = (id, datum, nazev, kdo, popis) => L.push({ id, datum, nazev, kdo, popis });
    const z = o.zpusob;
    if (z === 'vypoved_zam' || z === 'vypoved_zav') {
      p('doruceni', o.doruceni, 'Doručení výpovědi', z === 'vypoved_zam' ? 'zaměstnanec' : 'zaměstnavatel', 'Písemně, do vlastních rukou; rozhoduje den doručení druhé straně.');
      p('zacatekVD', vd.zacatek, 'Začátek výpovědní doby', '', vd.staryBeh ? 'Od 1. dne měsíce po doručení.' : 'Běží ode dne doručení (§ 51 po flexinovele).');
      p('konecVD', vd.konec, 'Konec výpovědní doby', '', 'Bez prodloužení o ochrannou dobu.');
    } else if (z === 'dohoda') p('doruceni', o.doruceni, 'Den skončení sjednaný v dohodě', 'obě strany', 'Dohoda písemně, každá strana dostane jedno vyhotovení.');
    else if (z === 'okamzite') p('doruceni', o.doruceni, 'Doručení okamžitého zrušení', o.okamziteKdo === 'zam' ? 'zaměstnanec' : 'zaměstnavatel', 'Do 2 měsíců ode dne, kdy se strana o důvodu dozvěděla, nejpozději do 1 roku od vzniku.');
    else if (z === 'zkusebni') p('doruceni', o.doruceni, 'Doručení zrušení ve zkušební době', '', 'Bez udání důvodu; ne v prvních 14 dnech dočasné pracovní neschopnosti. Doručit nejpozději poslední den zkušební doby.');
    p('konec', konec, 'Poslední den pracovního poměru', '', 'Zaměstnavatel vydá potvrzení o zaměstnání (zápočtový list), potvrzení o zdanitelných příjmech a doklady pro ÚP.');
    p('up', pracovniDenPo(konec, PARAMETRY.upPracovnichDnu), 'Registrace na úřadu práce – nejpozději', 'zaměstnanec', 'Žádost o zprostředkování zaměstnání do 3 pracovních dnů od skončení → podpora už ode dne po skončení (jinak až od podání).');
    p('nemoc', pridejDny(konec, Math.min(PARAMETRY.ochrannaLhutaNemoc, jeDatum(o.nastup) ? Math.max(1, rozdilDnu(o.nastup, konec) + 1) : PARAMETRY.ochrannaLhutaNemoc)), 'Konec ochranné lhůty nemocenského pojištění', '', 'Nemoc vzniklá do 7 dní po skončení (nejvýš po dobu trvání zaměstnání) zakládá nárok na nemocenské.');
    p('zp', pridejDny(konec, PARAMETRY.zpDnu), 'Zdravotní pojišťovna – oznámit změnu', 'zaměstnanec', 'Zaměstnavatel vás odhlásí; pokud nejste v evidenci ÚP ani nemáte nové zaměstnání, do 8 dnů oznamte pojišťovně a plaťte pojistné sami.');
    p('vyplata', vyplatniTermin, (pen.odstupne || pen.nahradaUraz ? 'Výplata odstupného, ' : 'Výplata ') + 'poslední mzdy a náhrady za dovolenou', 'zaměstnavatel', pen.odstupne || pen.nahradaUraz ? 'Odstupné nejpozději v nejbližším výplatním termínu po skončení, pokud se nedohodnete jinak.' : 'Mzda za poslední měsíc a náhrada za nevyčerpanou dovolenou v nejbližším výplatním termínu.');
    p('zaloba', pridejMesice(konec, PARAMETRY.zalobaMesicu), 'Žaloba na neplatnost rozvázání – nejpozději', '', '§ 72: neplatnost uplatnit u soudu do 2 měsíců ode dne skončení pracovního poměru.');
    return L.filter(x => jeDatum(x.datum)).sort((a, b) => a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : 0);
  }

  /* ---------- souhrn a iCalendar ---------- */
  function souhrnText(v) {
    const o = v.o;
    const r = [`Konec pracovního poměru – ${ZPUSOBY[o.zpusob]}${o.duvod && (o.zpusob === 'vypoved_zav' || o.zpusob === 'dohoda') ? ', ' + DUVODY[o.duvod].text : ''}`,
      `Poslední den: ${formatDatum(v.konec)} (${denTydne(v.konec)})`];
    if (v.vd) r.push(`Výpovědní doba: ${v.vd.mesicu} měs., ${formatDatum(v.vd.zacatek)} – ${formatDatum(v.vd.konec)}${v.konec !== v.vd.konec ? ', s ochrannou dobou do ' + formatDatum(v.konec) : ''}`);
    r.push(`Odstupné: ${formatKc(v.pen.odstupne)} (${v.pen.odstupneText})`);
    if (v.pen.nahradaUraz) r.push(`Jednorázová náhrada (pracovní úraz / nemoc z povolání): ${formatKc(v.pen.nahradaUraz)}`);
    if (v.pen.nahradaOkamzite) r.push(`Náhrada mzdy za výpovědní dobu (§ 56): ${formatKc(v.pen.nahradaOkamzite)}`);
    r.push(`Nevyčerpaná dovolená: ${v.dov.zbyva} h × ${formatKc(v.dov.phv, 2)} = ${formatKc(v.dov.nahrada)}`);
    r.push(`Celkem hrubě: ${formatKc(v.celkem)}`, '', 'Lhůty:');
    v.lhuty.forEach(l => r.push(`${formatDatum(l.datum)} – ${l.nazev}`));
    r.push('', `Orientačně, stav k ${STAV_K} – rozhoduje zákoník práce / právník.`);
    return r.join('\n');
  }

  function icsText(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  function icsZalom(radek) {
    const enc = new TextEncoder(); const out = []; let akt = '', del = 0;
    for (const ch of radek) {
      const b = enc.encode(ch).length;
      if (del + b > (out.length ? 74 : 75)) { out.push(akt); akt = ''; del = 0; }
      akt += ch; del += b;
    }
    out.push(akt);
    return out.join('\r\n ');
  }
  function ics(lhutyList, dnyPredem, razitko) {
    const r = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//webapp//Konec pracovniho pomeru//CS', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
    const ts = razitko || '20000101T000000Z';
    for (const l of lhutyList) {
      const d = l.datum.replace(/-/g, '');
      r.push('BEGIN:VEVENT', 'UID:konecpp-' + l.id + '-' + d + '@konec-pp.local', 'DTSTAMP:' + ts,
        'DTSTART;VALUE=DATE:' + d, 'DTEND;VALUE=DATE:' + pridejDny(l.datum, 1).replace(/-/g, ''),
        'SUMMARY:' + icsText(l.nazev), 'DESCRIPTION:' + icsText(l.popis + '\n(orientačně, stav k ' + STAV_K + ')'));
      if (dnyPredem > 0) r.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsText(l.nazev), 'TRIGGER:-P' + Math.round(dnyPredem) + 'D', 'END:VALARM');
      r.push('END:VEVENT');
    }
    r.push('END:VCALENDAR');
    return r.map(icsZalom).join('\r\n') + '\r\n';
  }

  /* ---------- poslední vstupy ---------- */
  const vychozi = () => ({ verze: VERZE, zpusob: 'vypoved_zam', duvod: 'c', uraz: false, okamziteKdo: 'zav', doruceni: '', nastup: '', konecUrcita: '',
    sjednanaVD: 0, staryBeh: false, ochrannaDnu: 0, mzda: 45000, uvazek: 40, tydnuDovolene: 4, cerpanoHod: 0, prevedenoHod: 0, neodpracovanoHod: 0,
    vyplatniDen: 15, vedouci: false, zkusebniMesicu: 4, prekazkyDnu: 0, dnyPredem: 1 });
  function migruj(d) {
    const v = vychozi();
    if (!d || typeof d !== 'object') return v;
    for (const k of Object.keys(v)) if (k in d && typeof d[k] === typeof v[k]) v[k] = d[k];
    v.verze = VERZE;
    if (!ZPUSOBY[v.zpusob]) v.zpusob = 'vypoved_zam';
    if (v.duvod && !DUVODY[v.duvod]) v.duvod = 'c';
    return v;
  }

  const API = {
    VERZE, KLIC, STAV_K, PARAMETRY, DUVODY, ZPUSOBY,
    jeDatum, pridejDny, pridejMesice, rozdilDnu, stejnyDen, celychRoku, formatDatum, formatKc, denTydne,
    velikonocniNedele, svatky, jePracovni, pracovniDenPo,
    vypovedniDoba, delkaVypovedni, ochranaPlati, zkusebniDoba, prumerHodinovy, odstupnePocet, narokyPenezni, dovolena,
    vyplatniDenPo, lhuty, spocti, souhrnText, ics, icsText, icsZalom, vychozi, migruj
  };
  if (typeof module !== 'undefined') module.exports = API; else window.KonecPpJadro = API;
})();

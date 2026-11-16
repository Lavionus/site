/* Deník migrén a bolestí hlavy – jádro bez DOM (test: node _test/denik_migren_test.js).
   Časy jsou místní řetězce 'YYYY-MM-DDTHH:MM' (jako <input type="datetime-local">), dny 'YYYY-MM-DD'.
   Nejde o diagnózu: prahy nadužívání léků podle ICHD-3 (kap. 8.2) a skóre MIDAS jsou jen podklad pro lékaře. */
(function () {
  'use strict';

  const VERZE = 1;
  const KLIC = 'webapp_denik_migren';

  const TYPY = {
    bez_aury: { nazev: 'Migréna bez aury', kratce: 'migréna', barva: 'var(--danger)' },
    s_aurou: { nazev: 'Migréna s aurou', kratce: 'migréna s aurou', barva: 'color-mix(in srgb, var(--danger) 60%, var(--accent))' },
    tenzni: { nazev: 'Tenzní bolest hlavy', kratce: 'tenzní', barva: 'var(--warn)' },
    jina: { nazev: 'Jiná / nejasná', kratce: 'jiná', barva: 'var(--text-muted)' }
  };

  /* Oblasti klikací hlavy. Strana = strana pacienta (l = levá, p = pravá, '' = střed). */
  const OBLASTI = {
    celo_l: { nazev: 'čelo vlevo', strana: 'l' }, celo_p: { nazev: 'čelo vpravo', strana: 'p' },
    spanek_l: { nazev: 'spánek vlevo', strana: 'l' }, spanek_p: { nazev: 'spánek vpravo', strana: 'p' },
    oko_l: { nazev: 'za levým okem', strana: 'l' }, oko_p: { nazev: 'za pravým okem', strana: 'p' },
    temeno: { nazev: 'temeno', strana: '' },
    tyl_l: { nazev: 'týl vlevo', strana: 'l' }, tyl_p: { nazev: 'týl vpravo', strana: 'p' },
    sije: { nazev: 'šíje', strana: '' }
  };

  const PRIZNAKY = ['nevolnost', 'zvracení', 'citlivost na světlo', 'citlivost na zvuk', 'citlivost na pachy',
    'zhoršení pohybem', 'pulzující bolest', 'tlaková / svíravá bolest', 'aura – zrak', 'aura – brnění', 'aura – řeč',
    'závrať', 'slzení / rýma', 'únava, zívání'];

  const SPOUSTECE = {
    spanek: 'spánek (málo / moc / jinak)',
    stres: 'stres nebo uvolnění po něm',
    jidlo: 'jídlo (vynechané / určitá potravina)',
    alkohol: 'alkohol',
    menstruace: 'menstruace',
    pocasi: 'změna počasí (pocit)',
    kofein: 'kofein (víc / vynechaný)',
    namaha: 'fyzická námaha',
    obrazovka: 'dlouho u obrazovky'
  };

  /* Druhy akutních léků a prahy nadužívání (ICHD-3, 8.2 Medication-overuse headache):
     pravidelné užívání > 3 měsíce v ≥ 15 dnech/měsíc u neopioidních analgetik, v ≥ 10 dnech/měsíc u ostatních. */
  const DRUHY_LEKU = {
    analgetikum: { nazev: 'analgetikum / NSAID (paracetamol, ibuprofen, ASA, metamizol…)', kratce: 'analgetika', limit: 15, ichd: '8.2.3' },
    triptan: { nazev: 'triptan', kratce: 'triptany', limit: 10, ichd: '8.2.2' },
    kombinovane: { nazev: 'kombinované analgetikum (s kofeinem, kodeinem…)', kratce: 'kombinovaná', limit: 10, ichd: '8.2.5' },
    opioid: { nazev: 'opioid (tramadol, kodein…)', kratce: 'opioidy', limit: 10, ichd: '8.2.4' },
    ergotamin: { nazev: 'ergotamin', kratce: 'ergotaminy', limit: 10, ichd: '8.2.1' },
    jiny_akutni: { nazev: 'jiný lék na záchvat (gepant, lasmiditan…)', kratce: 'jiné akutní', limit: 10, ichd: '8.2.8' },
    neakutni: { nazev: 'nepočítat (antiemetikum, prevence…)', kratce: 'nepočítané', limit: null, ichd: '' }
  };
  const LIMIT_KOMBINACE = 10; // ICHD-3 8.2.6: více skupin, žádná sama nepřekročena, dohromady ≥ 10 dní

  /* Obchodní názvy v ČR → druh (orientačně; uživatel může druh změnit). Kombinace se testují dřív než jednotlivé látky. */
  const ZNACKY = [
    ['kombinovane', ['valetol', 'ataralgin', 'paralen plus', 'coldrex', 'panadol extra', 'acylcoffin', 'saridon', 'thomapyrin', 'excedrin', 'migralgin', 'korylan', 'ultracod', 'ultracet', 'zaldiar', 'mig-400']],
    ['opioid', ['tramadol', 'tramal', 'tralgit', 'kodein', 'codein', 'morfin', 'oxykodon', 'dihydrokodein', 'dhc']],
    ['triptan', ['triptan', 'imigran', 'sumatriptan', 'maxalt', 'rizatriptan', 'relpax', 'zomig', 'zolmitriptan', 'naramig', 'amerge', 'frovatriptan', 'almogran', 'rizaport', 'sumigra']],
    ['ergotamin', ['ergotamin', 'dihydroergotamin', 'cafergot']],
    ['jiny_akutni', ['rimegepant', 'vydura', 'nurtec', 'ubrogepant', 'lasmiditan', 'rayvow', 'zavegepant']],
    ['neakutni', ['degan', 'metoklopramid', 'thiethylperazin', 'torecan', 'domperidon', 'ondansetron', 'topiramat', 'propranolol', 'amitriptylin', 'flunarizin', 'aimovig', 'ajovy', 'emgality', 'vyepti', 'botox', 'magnesium', 'hořčík', 'magnosolv']],
    ['analgetikum', ['paracetamol', 'paralen', 'panadol', 'ibuprofen', 'ibalgin', 'nurofen', 'brufen', 'aspirin', 'acylpyrin', 'anopyrin', 'kyselina acetylsalicylová', 'asa', 'naproxen', 'nalgesin', 'diclofenac', 'diklofenak', 'voltaren', 'ketoprofen', 'ketonal', 'metamizol', 'novalgin', 'algifen', 'nimesil', 'nimesulid', 'aulin', 'dexoket', 'dexketoprofen', 'etoricoxib', 'arcoxia']]
  ];
  function druhLeku(nazev) {
    const n = String(nazev || '').toLowerCase();
    if (!n.trim()) return '';
    for (const [druh, slova] of ZNACKY) if (slova.some(s => n.includes(s))) return druh;
    return '';
  }

  const ULEVA = {
    bez_bolesti: 'bez bolesti do 2 h',
    uleva: 'úleva do 2 h',
    bez_ucinku: 'bez účinku',
    '': 'nehodnoceno'
  };

  /* MIDAS (Migraine Disability Assessment; Stewart WF et al., Neurology 2001;56(6 Suppl 1):S20–S28) – volně převzaté otázky. */
  const MIDAS_OTAZKY = [
    'Kolik dní za poslední 3 měsíce jste kvůli bolesti hlavy vynechal(a) práci nebo školu?',
    'Kolik dní za poslední 3 měsíce byla vaše výkonnost v práci nebo ve škole snížena na polovinu nebo méně? (Nepočítejte dny z 1. otázky.)',
    'Kolik dní za poslední 3 měsíce jste kvůli bolesti hlavy nedělal(a) práce v domácnosti?',
    'Kolik dní za poslední 3 měsíce byla vaše výkonnost v domácnosti snížena na polovinu nebo méně? (Nepočítejte dny ze 3. otázky.)',
    'Kolik dní za poslední 3 měsíce jste kvůli bolesti hlavy vynechal(a) rodinné, společenské nebo volnočasové aktivity?'
  ];
  const MIDAS_STUPNE = [
    { od: 0, stupen: 'I', popis: 'malé nebo žádné omezení' },
    { od: 6, stupen: 'II', popis: 'mírné omezení' },
    { od: 11, stupen: 'III', popis: 'středně těžké omezení' },
    { od: 21, stupen: 'IV', popis: 'těžké omezení' }
  ];
  function midasSkore(odp) {
    const cisla = (odp || []).slice(0, 5).map(v => Math.max(0, Math.min(90, Math.round(Number(v) || 0))));
    while (cisla.length < 5) cisla.push(0);
    const skore = cisla.reduce((s, v) => s + v, 0);
    const st = MIDAS_STUPNE.filter(s => skore >= s.od).pop();
    return { skore, stupen: st.stupen, popis: st.popis, odp: cisla };
  }

  /* ---------- čas ---------- */
  const RE_CAS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
  const RE_DEN = /^\d{4}-\d{2}-\d{2}$/;
  const p2 = n => String(n).padStart(2, '0');
  const den = cas => String(cas || '').slice(0, 10);
  const mesic = d => String(d || '').slice(0, 7);
  /* Dny počítané přes UTC – žádné potíže s letním časem. */
  const dnyOd1970 = d => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 864e5;
  function pridejDny(d, n) {
    const x = new Date((dnyOd1970(d) + n) * 864e5);
    return x.getUTCFullYear() + '-' + p2(x.getUTCMonth() + 1) + '-' + p2(x.getUTCDate());
  }
  const rozdilDni = (a, b) => dnyOd1970(b) - dnyOd1970(a);
  function rozsahDni(od, doDne) {
    const r = [];
    for (let d = od; d <= doDne && r.length < 4000; d = pridejDny(d, 1)) r.push(d);
    return r;
  }
  function pridejMesice(m, n) {
    const i = +m.slice(0, 4) * 12 + (+m.slice(5, 7) - 1) + n;
    return Math.floor(i / 12) + '-' + p2(i % 12 + 1);
  }
  const dnuVMesici = m => new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).getUTCDate();
  function tedText(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + 'T' + p2(d.getHours()) + ':' + p2(d.getMinutes());
  }
  function minutyMezi(a, b) {
    if (!RE_CAS.test(a) || !RE_CAS.test(b)) return null;
    return rozdilDni(den(a), den(b)) * 1440 + (+b.slice(11, 13) * 60 + +b.slice(14, 16)) - (+a.slice(11, 13) * 60 + +a.slice(14, 16));
  }
  function formatDen(d) { return RE_DEN.test(d) ? (+d.slice(8, 10)) + '. ' + (+d.slice(5, 7)) + '. ' + d.slice(0, 4) : ''; }
  function formatCas(c) { return RE_CAS.test(c) ? formatDen(den(c)) + ' ' + (+c.slice(11, 13)) + ':' + c.slice(14, 16) : ''; }
  const MESICE = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'];
  const formatMesic = m => MESICE[+m.slice(5, 7) - 1] + ' ' + m.slice(0, 4);
  function formatTrvani(min) {
    if (min == null || min < 0) return '';
    if (min < 60) return min + ' min';
    const h = Math.floor(min / 60), m = min % 60;
    if (h < 48) return h + ' h' + (m ? ' ' + m + ' min' : '');
    return Math.floor(h / 24) + ' d ' + (h % 24) + ' h';
  }
  const cislo = (x, des) => x == null || !isFinite(x) ? '–' : Number(x).toFixed(des == null ? 1 : des).replace('.', ',').replace('-', '−');

  /* ---------- normalizace ---------- */
  const noveId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const text = (v, max) => String(v == null ? '' : v).slice(0, max || 500);
  const cas = v => RE_CAS.test(String(v || '')) ? String(v) : '';
  const seznam = (v, povolene) => Array.isArray(v) ? [...new Set(v.map(x => text(x, 80)).filter(x => x && (!povolene || povolene.includes(x))))] : [];
  const cisloNeboNull = v => v == null || v === '' || !isFinite(Number(v)) ? null : Number(v);

  function normLek(l) {
    l = l || {};
    const nazev = text(l.nazev, 80).trim();
    return {
      nazev,
      druh: DRUHY_LEKU[l.druh] ? l.druh : (druhLeku(nazev) || 'analgetikum'),
      davka: text(l.davka, 40),
      cas: cas(l.cas),
      uleva: ULEVA[l.uleva] != null ? l.uleva : ''
    };
  }
  function normZachvat(z) {
    z = z || {};
    const zac = cas(z.zacatek);
    let kon = cas(z.konec);
    if (kon && zac && kon < zac) kon = '';
    const p = z.pocasi;
    return {
      id: text(z.id, 40) || noveId(),
      zacatek: zac,
      konec: kon,
      intenzita: Math.max(0, Math.min(10, Math.round(Number(z.intenzita)) || 0)),
      typ: TYPY[z.typ] ? z.typ : 'bez_aury',
      mista: seznam(z.mista, Object.keys(OBLASTI)),
      priznaky: seznam(z.priznaky),
      spoustece: seznam(z.spoustece),
      leky: Array.isArray(z.leky) ? z.leky.map(normLek).filter(l => l.nazev) : [],
      pozn: text(z.pozn, 2000),
      pocasi: p && typeof p === 'object' ? { tlak: cisloNeboNull(p.tlak), zmena24: cisloNeboNull(p.zmena24), teplota: cisloNeboNull(p.teplota), misto: text(p.misto, 80) } : null
    };
  }
  function prazdna() { return { verze: VERZE, zachvaty: [], dny: {}, midas: [], poloha: null, prahTlaku: 5 }; }
  function migruj(d) {
    const r = prazdna();
    if (!d || typeof d !== 'object') return r;
    r.zachvaty = (Array.isArray(d.zachvaty) ? d.zachvaty : []).map(normZachvat).filter(z => z.zacatek)
      .sort((a, b) => a.zacatek < b.zacatek ? -1 : a.zacatek > b.zacatek ? 1 : 0);
    if (d.dny && typeof d.dny === 'object') {
      for (const [k, v] of Object.entries(d.dny)) {
        if (!RE_DEN.test(k) || !v) continue;
        const s = seznam(v.spoustece);
        if (s.length || v.bezBolesti || text(v.pozn).trim()) r.dny[k] = { spoustece: s, pozn: text(v.pozn, 500), bezBolesti: !!v.bezBolesti };
      }
    }
    r.midas = (Array.isArray(d.midas) ? d.midas : []).filter(m => m && RE_DEN.test(m.datum)).map(m => ({
      datum: m.datum, odp: midasSkore(m.odp).odp, a: cisloNeboNull(m.a), b: cisloNeboNull(m.b)
    }));
    const pol = d.poloha;
    if (pol && isFinite(pol.lat) && isFinite(pol.lon) && Math.abs(pol.lat) <= 90 && Math.abs(pol.lon) <= 180) r.poloha = { lat: +pol.lat, lon: +pol.lon, nazev: text(pol.nazev, 120) };
    if ([3, 5, 8].includes(Number(d.prahTlaku))) r.prahTlaku = Number(d.prahTlaku);
    return r;
  }

  /* ---------- dny bolesti a léků ---------- */
  const MAX_DNI_ZACHVATU = 14; // pojistka proti překlepu v datu konce
  function dnyZachvatu(z) {
    const od = den(z.zacatek);
    const doDne = z.konec ? den(z.konec) : od;
    return rozsahDni(od, doDne < od ? od : doDne).slice(0, MAX_DNI_ZACHVATU);
  }
  /* Mapa den → {max intenzita, počet záchvatů, typy} */
  function mapaBolesti(zachvaty) {
    const m = {};
    for (const z of zachvaty) for (const d of dnyZachvatu(z)) {
      const x = m[d] || (m[d] = { max: 0, zachvatu: 0, typy: [] });
      x.max = Math.max(x.max, z.intenzita);
      if (d === den(z.zacatek)) x.zachvatu++;
      if (!x.typy.includes(z.typ)) x.typy.push(z.typ);
    }
    return m;
  }
  /* Mapa den → seznam druhů léků (bez duplicit). Den léku = den z času užití, jinak den začátku záchvatu. */
  function mapaLeku(zachvaty) {
    const m = {};
    for (const z of zachvaty) for (const l of z.leky) {
      const d = den(l.cas || z.zacatek);
      const x = m[d] || (m[d] = []);
      if (!x.includes(l.druh)) x.push(l.druh);
    }
    return m;
  }
  const pocitany = druh => DRUHY_LEKU[druh] && DRUHY_LEKU[druh].limit != null;

  function prehledMesice(data, m) {
    const zz = data.zachvaty.filter(z => mesic(z.zacatek) === m);
    const bol = mapaBolesti(data.zachvaty), lek = mapaLeku(data.zachvaty);
    const dnyBolesti = Object.keys(bol).filter(d => mesic(d) === m).length;
    const dnyL = Object.keys(lek).filter(d => mesic(d) === m);
    const poDruzich = {};
    let dnyAkutnich = 0;
    for (const d of dnyL) {
      const akutni = lek[d].filter(pocitany);
      if (akutni.length) dnyAkutnich++;
      for (const dr of akutni) poDruzich[dr] = (poDruzich[dr] || 0) + 1;
    }
    const nad = Object.entries(poDruzich).filter(([dr, n]) => n >= DRUHY_LEKU[dr].limit)
      .map(([dr, n]) => ({ druh: dr, dni: n, limit: DRUHY_LEKU[dr].limit, ichd: DRUHY_LEKU[dr].ichd }));
    const kombinace = !nad.length && Object.keys(poDruzich).length > 1 && dnyAkutnich >= LIMIT_KOMBINACE;
    const hodnocene = zz.flatMap(z => z.leky).filter(l => pocitany(l.druh) && l.uleva);
    return {
      mesic: m, zachvatu: zz.length, dnyBolesti, dnyAkutnich, poDruzich, nadUzivani: nad, kombinace,
      prekroceno: nad.length > 0 || kombinace,
      prumIntenzita: zz.length ? zz.reduce((s, z) => s + z.intenzita, 0) / zz.length : null,
      uspesnostLeku: hodnocene.length ? hodnocene.filter(l => l.uleva !== 'bez_ucinku').length / hodnocene.length : null,
      poTypech: Object.fromEntries(Object.keys(TYPY).map(t => [t, zz.filter(z => z.typ === t).length]))
    };
  }
  function prehledMesicu(data, posledniMesic, pocet) {
    const r = [];
    for (let i = pocet - 1; i >= 0; i--) r.push(prehledMesice(data, pridejMesice(posledniMesic, -i)));
    return r;
  }

  /* Upozornění na riziko nadužívání: aktuální měsíc + klouzavých 30 dní + počet po sobě jdoucích měsíců nad prahem.
     ICHD-3 8.2 vyžaduje navíc bolest hlavy ≥ 15 dní v měsíci a trvání > 3 měsíce – rozhoduje lékař. */
  function nadUzivani(data, dnes) {
    const lek = mapaLeku(data.zachvaty), bol = mapaBolesti(data.zachvaty);
    const od = pridejDny(dnes, -29);
    const okno = {};
    let dnyOkno = 0, dnyBolestiOkno = 0;
    for (const d of rozsahDni(od, dnes)) {
      if (bol[d]) dnyBolestiOkno++;
      const akutni = (lek[d] || []).filter(pocitany);
      if (akutni.length) dnyOkno++;
      for (const dr of akutni) okno[dr] = (okno[dr] || 0) + 1;
    }
    const oknoNad = Object.entries(okno).filter(([dr, n]) => n >= DRUHY_LEKU[dr].limit).map(([dr, n]) => ({ druh: dr, dni: n, limit: DRUHY_LEKU[dr].limit, ichd: DRUHY_LEKU[dr].ichd }));
    const oknoKombinace = !oknoNad.length && Object.keys(okno).length > 1 && dnyOkno >= LIMIT_KOMBINACE;
    // po sobě jdoucí kalendářní měsíce nad prahem, počítáno od posledního ukončeného nebo aktuálního
    let mesicuZaSebou = 0;
    for (let m = mesic(dnes); mesicuZaSebou < 24; m = pridejMesice(m, -1)) {
      if (prehledMesice(data, m).prekroceno) mesicuZaSebou++;
      else if (m !== mesic(dnes)) break; // rozběhnutý aktuální měsíc řadu nepřerušuje
    }
    const blizko = Object.entries(okno).filter(([dr, n]) => n < DRUHY_LEKU[dr].limit && n >= DRUHY_LEKU[dr].limit - 2)
      .map(([dr, n]) => ({ druh: dr, dni: n, limit: DRUHY_LEKU[dr].limit }));
    const uroven = oknoNad.length || oknoKombinace || mesicuZaSebou > 0 ? (mesicuZaSebou >= 3 ? 'vysoke' : 'prekroceno') : blizko.length ? 'blizko' : 'ok';
    return { od, do: dnes, poDruzich: okno, dnyAkutnich: dnyOkno, dnyBolesti: dnyBolestiOkno, nad: oknoNad, kombinace: oknoKombinace, blizko, mesicuZaSebou, uroven };
  }

  /* ---------- relativní riziko ---------- */
  /* a = exponované dny se záchvatem, b = exponované bez, c = neexponované se záchvatem, d = neexponované bez.
     95% interval spolehlivosti přes logaritmus (Katz); při nulové buňce Haldaneova oprava +0,5. */
  function relativniRiziko(a, b, c, d) {
    if (a + b === 0 || c + d === 0) return { rr: null, lo: null, hi: null };
    if ([a, b, c, d].includes(0)) { a += 0.5; b += 0.5; c += 0.5; d += 0.5; }
    const rr = (a / (a + b)) / (c / (c + d));
    const se = Math.sqrt(1 / a - 1 / (a + b) + 1 / c - 1 / (c + d));
    return { rr, lo: Math.exp(Math.log(rr) - 1.96 * se), hi: Math.exp(Math.log(rr) + 1.96 * se) };
  }
  function vyhodnotRR(a, b, c, d) {
    const r = relativniRiziko(a, b, c, d);
    const malyVzorek = a < 5 || c < 5 || a + b < 10 || c + d < 10;
    return Object.assign(r, { a, b, c, d, malyVzorek, vyznamne: r.rr != null && !malyVzorek && (r.lo > 1 || r.hi < 1) });
  }
  /* Spouštěče: sledované dny = dny se začátkem záchvatu + dny s denním záznamem (i „bez bolesti“). */
  function spoustecePrehled(data, od, doDne) {
    const zacatky = {};
    for (const z of data.zachvaty) {
      const d = den(z.zacatek);
      if ((od && d < od) || (doDne && d > doDne)) continue;
      (zacatky[d] || (zacatky[d] = new Set()));
      z.spoustece.forEach(s => zacatky[d].add(s));
    }
    const dny = new Set(Object.keys(zacatky));
    for (const d of Object.keys(data.dny)) if ((!od || d >= od) && (!doDne || d <= doDne)) dny.add(d);
    const bol = mapaBolesti(data.zachvaty);
    // den v průběhu záchvatu (ne jeho začátek) se nehodnotí – nebyl by to ani „den bez záchvatu“
    const sledovane = [...dny].filter(d => zacatky[d] || !bol[d]);
    const dnyBez = sledovane.filter(d => !zacatky[d]).length;
    const vsechny = [...new Set(Object.keys(SPOUSTECE).concat(data.zachvaty.flatMap(z => z.spoustece)))];
    const zachvatu = Object.keys(zacatky).length;
    const radky = vsechny.map(s => {
      let a = 0, b = 0, c = 0, d = 0;
      for (const den_ of sledovane) {
        const exp = (zacatky[den_] && zacatky[den_].has(s)) || (data.dny[den_] && data.dny[den_].spoustece.includes(s));
        if (zacatky[den_]) { if (exp) a++; else c++; } else { if (exp) b++; else d++; }
      }
      return Object.assign({ id: s, nazev: SPOUSTECE[s] || s, podil: zachvatu ? a / zachvatu : 0 }, dnyBez >= 10 ? vyhodnotRR(a, b, c, d) : { a, b, c, d, rr: null, malyVzorek: true });
    }).filter(r => r.a + r.b > 0).sort((x, y) => y.a - x.a);
    return { dnu: sledovane.length, dnuSeZachvatem: zachvatu, dnuBez: dnyBez, radky };
  }

  /* ---------- počasí (Open-Meteo) ---------- */
  /* Archiv (ERA5/reanalýza) má zpoždění několika dní – posledních 7 dní se bere z předpovědního API, které umí i nedávnou minulost. */
  function urlPocasi(lat, lon, od, doDne, dnes) {
    const hranice = pridejDny(dnes, -7);
    const q = (o, d) => `?latitude=${(+lat).toFixed(3)}&longitude=${(+lon).toFixed(3)}&start_date=${o}&end_date=${d}&hourly=pressure_msl,temperature_2m&timezone=auto`;
    const r = [];
    if (doDne > dnes) doDne = dnes;
    if (od > doDne) return r;
    if (od < hranice) r.push('https://archive-api.open-meteo.com/v1/archive' + q(od, doDne < hranice ? doDne : pridejDny(hranice, -1)));
    if (doDne >= hranice) r.push('https://api.open-meteo.com/v1/forecast' + q(od > hranice ? od : hranice, doDne));
    return r;
  }
  /* Spojí hodinové řady z více odpovědí do mapy 'YYYY-MM-DDTHH:00' → {p, t} (null hodnoty vynechá). */
  function slozHodiny(odpovedi) {
    const h = {};
    for (const o of odpovedi) {
      const x = o && o.hourly;
      if (!x || !Array.isArray(x.time)) continue;
      x.time.forEach((t, i) => {
        const p = x.pressure_msl ? x.pressure_msl[i] : null, tt = x.temperature_2m ? x.temperature_2m[i] : null;
        if (p != null || tt != null) h[t] = { p: p == null ? null : p, t: tt == null ? null : tt };
      });
    }
    return h;
  }
  /* Počasí v hodině začátku záchvatu: tlak (hPa, přepočtený na hladinu moře), změna proti stejné hodině předchozího dne, teplota. */
  function pocasiZachvatu(hodiny, zacatek) {
    if (!RE_CAS.test(zacatek)) return null;
    const k = zacatek.slice(0, 13) + ':00';
    const pred = pridejDny(den(zacatek), -1) + k.slice(10);
    const ted = hodiny[k], vcera = hodiny[pred];
    if (!ted) return null;
    return {
      tlak: ted.p,
      zmena24: ted.p != null && vcera && vcera.p != null ? Math.round((ted.p - vcera.p) * 10) / 10 : null,
      teplota: ted.t
    };
  }
  /* Denní průměry tlaku a teploty + změna denního průměru tlaku proti předchozímu dni. Den musí mít aspoň 20 hodin. */
  function denniPocasi(hodiny) {
    const s = {};
    for (const [k, v] of Object.entries(hodiny)) {
      if (v.p == null) continue;
      const d = k.slice(0, 10), x = s[d] || (s[d] = { p: 0, t: 0, n: 0, nt: 0 });
      x.p += v.p; x.n++;
      if (v.t != null) { x.t += v.t; x.nt++; }
    }
    const r = {};
    for (const [d, x] of Object.entries(s)) if (x.n >= 20) r[d] = { p: Math.round(x.p / x.n * 10) / 10, t: x.nt ? Math.round(x.t / x.nt * 10) / 10 : null };
    for (const d of Object.keys(r)) {
      const v = r[pridejDny(d, -1)];
      r[d].zmena = v ? Math.round((r[d].p - v.p) * 10) / 10 : null;
    }
    return r;
  }
  /* Riziko záchvatu v den s poklesem denního průměru tlaku o ≥ prah hPa proti dnům bez poklesu. */
  function tlakPrehled(data, dnyPocasi, od, doDne, prah) {
    prah = prah || data.prahTlaku || 5;
    const zacatky = new Set(data.zachvaty.map(z => den(z.zacatek)));
    let a = 0, b = 0, c = 0, d = 0, sumaZ = 0, nZ = 0, sumaO = 0, nO = 0;
    for (const dd of rozsahDni(od, doDne)) {
      const x = dnyPocasi[dd];
      if (!x || x.zmena == null) continue;
      const exp = x.zmena <= -prah, zach = zacatky.has(dd);
      if (zach) { sumaZ += x.zmena; nZ++; } else { sumaO += x.zmena; nO++; }
      if (exp) { if (zach) a++; else b++; } else { if (zach) c++; else d++; }
    }
    return Object.assign(vyhodnotRR(a, b, c, d), { prah, dnu: a + b + c + d, prumZmenaZachvat: nZ ? sumaZ / nZ : null, prumZmenaOstatni: nO ? sumaO / nO : null });
  }

  /* ---------- souhrny ---------- */
  function lekyPrehled(zachvaty) {
    const m = {};
    for (const z of zachvaty) for (const l of z.leky) {
      const k = l.nazev.toLowerCase();
      const x = m[k] || (m[k] = { nazev: l.nazev, druh: l.druh, uziti: 0, hodnoceno: 0, bezBolesti: 0, uleva: 0 });
      x.uziti++;
      if (l.uleva) { x.hodnoceno++; if (l.uleva === 'bez_bolesti') x.bezBolesti++; if (l.uleva !== 'bez_ucinku') x.uleva++; }
    }
    return Object.values(m).sort((a, b) => b.uziti - a.uziti);
  }
  function mistaPrehled(zachvaty) {
    const pocty = {};
    let jedno = 0, obou = 0, l = 0, p = 0;
    for (const z of zachvaty) {
      z.mista.forEach(o => { pocty[o] = (pocty[o] || 0) + 1; });
      const strany = new Set(z.mista.map(o => OBLASTI[o].strana).filter(Boolean));
      if (strany.size === 1) { jedno++; if (strany.has('l')) l++; else p++; }
      else if (strany.size === 2) obou++;
    }
    return { pocty, jednostranne: jedno, oboustranne: obou, vlevo: l, vpravo: p };
  }
  function popisMist(mista) {
    return mista.map(o => OBLASTI[o] ? OBLASTI[o].nazev : o).join(', ');
  }
  function trvani(z) { return z.konec ? minutyMezi(z.zacatek, z.konec) : null; }

  /* Kalendář: týdny od pondělí, buňka = {den, vMesici, bolest, leky, zaznam} */
  function kalendar(data, m) {
    const bol = mapaBolesti(data.zachvaty), lek = mapaLeku(data.zachvaty);
    const prvni = m + '-01';
    const dowPrvni = (new Date(dnyOd1970(prvni) * 864e5).getUTCDay() + 6) % 7; // 0 = pondělí
    let d = pridejDny(prvni, -dowPrvni);
    const posledni = m + '-' + p2(dnuVMesici(m));
    const tydny = [];
    while (d <= posledni) {
      const t = [];
      for (let i = 0; i < 7; i++, d = pridejDny(d, 1)) {
        t.push({ den: d, vMesici: mesic(d) === m, bolest: bol[d] || null, leky: (lek[d] || []).slice(), zaznam: data.dny[d] || null });
      }
      tydny.push(t);
    }
    return tydny;
  }

  /* ---------- CSV ---------- */
  function csvBunka(v) {
    const s = String(v == null ? '' : v);
    return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function csv(data) {
    const hl = ['začátek', 'konec', 'trvání (min)', 'intenzita 0–10', 'typ', 'lokalizace', 'příznaky', 'léky', 'spouštěče', 'tlak hPa', 'změna tlaku 24 h hPa', 'teplota °C', 'poznámka'];
    const radky = data.zachvaty.map(z => [
      z.zacatek.replace('T', ' '), z.konec.replace('T', ' '), trvani(z) == null ? '' : trvani(z), z.intenzita, TYPY[z.typ].nazev,
      popisMist(z.mista), z.priznaky.join(', '),
      z.leky.map(l => `${l.nazev}${l.davka ? ' ' + l.davka : ''}${l.cas ? ' (' + l.cas.slice(11) + ')' : ''} – ${ULEVA[l.uleva]}`).join(' | '),
      z.spoustece.map(s => SPOUSTECE[s] || s).join(', '),
      z.pocasi && z.pocasi.tlak != null ? String(z.pocasi.tlak).replace('.', ',') : '',
      z.pocasi && z.pocasi.zmena24 != null ? String(z.pocasi.zmena24).replace('.', ',') : '',
      z.pocasi && z.pocasi.teplota != null ? String(z.pocasi.teplota).replace('.', ',') : '',
      z.pozn
    ]);
    return '﻿' + [hl].concat(radky).map(r => r.map(csvBunka).join(';')).join('\r\n') + '\r\n';
  }

  const API = {
    VERZE, KLIC, TYPY, OBLASTI, PRIZNAKY, SPOUSTECE, DRUHY_LEKU, LIMIT_KOMBINACE, ULEVA, MIDAS_OTAZKY, MIDAS_STUPNE,
    druhLeku, midasSkore, den, mesic, pridejDny, rozdilDni, rozsahDni, pridejMesice, dnuVMesici, tedText, minutyMezi,
    formatDen, formatCas, formatMesic, formatTrvani, cislo, noveId,
    normLek, normZachvat, prazdna, migruj, dnyZachvatu, mapaBolesti, mapaLeku, prehledMesice, prehledMesicu, nadUzivani,
    relativniRiziko, vyhodnotRR, spoustecePrehled, urlPocasi, slozHodiny, pocasiZachvatu, denniPocasi, tlakPrehled,
    lekyPrehled, mistaPrehled, popisMist, trvani, kalendar, csv
  };
  if (typeof module !== 'undefined') module.exports = API; else window.DenikMigrenJadro = API;
})();

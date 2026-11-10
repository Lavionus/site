/* Deník nemoci – epizody nemoci po osobách, záznamy teploty, léků, příznaků, tekutin…
   Jádro bez DOM (test: _test/denik_nemoci_test.js). Časy jsou místní řetězce 'YYYY-MM-DDTHH:MM' (jako <input type="datetime-local">).
   Dávkování a prahy teploty jsou ORIENTAČNÍ – řídí se příbalovým letákem a lékařem. */
(function () {
  'use strict';

  const VERZE = 1;
  const KLIC = 'webapp_denik_nemoci';

  /* Ručně stárnoucí údaje – stav 11/2026. Dávky podle běžných doporučení pro děti (SPC přípravků),
     strop pro dospělé: paracetamol 4 g/den, ibuprofen bez předpisu 1 200 mg/den. */
  const PARAMETRY = {
    stav: '11/2026',
    leky: {
      paracetamol: { nazev: 'Paracetamol', mgKg: [10, 15], intervalH: [4, 6], maxMgKgDen: 60, maxMgDen: 4000, minVekMes: 0 },
      ibuprofen: { nazev: 'Ibuprofen', mgKg: [5, 10], intervalH: [6, 8], maxMgKgDen: 30, maxMgDen: 1200, minVekMes: 3, minKg: 5 }
    }
  };

  /* Obchodní názvy → účinná látka (orientační, jen nejčastější v ČR). */
  const ZNACKY = {
    paracetamol: ['paracetamol', 'paralen', 'panadol', 'calpol', 'efferalgan', 'perfalgan', 'daleron', 'coldrex', 'acetaminophen'],
    ibuprofen: ['ibuprofen', 'nurofen', 'ibalgin', 'brufen', 'ibumax', 'apo-ibuprofen', 'ibuprofen-ratiopharm', 'modafen']
  };

  /* Místo měření → orientační posun na ekvivalent v podpaží (prahy 37,5 / 38 / 39 / 40 platí pro podpaží, jak se měří v ČR). */
  const MISTA = {
    podpazi: { nazev: 'podpaží', posun: 0 },
    usta: { nazev: 'ústa', posun: -0.3 },
    ucho: { nazev: 'ucho', posun: -0.4 },
    konecnik: { nazev: 'konečník', posun: -0.5 }
  };

  const KATEGORIE = {
    nizka: { nazev: 'nízká – přeměřte', barva: 'var(--accent)' },
    normalni: { nazev: 'normální', barva: 'var(--ok)' },
    zvysena: { nazev: 'zvýšená teplota', barva: 'color-mix(in srgb, var(--ok) 35%, var(--warn))' },
    horecka: { nazev: 'horečka', barva: 'var(--warn)' },
    vysoka: { nazev: 'vysoká horečka', barva: 'var(--danger)' },
    velmi_vysoka: { nazev: 'velmi vysoká horečka', barva: 'color-mix(in srgb, var(--danger) 70%, var(--text))' }
  };

  const TYPY = [
    { id: 'teplota', ikona: '🌡️', nazev: 'Teplota' },
    { id: 'lek', ikona: '💊', nazev: 'Lék' },
    { id: 'priznaky', ikona: '🤧', nazev: 'Příznaky' },
    { id: 'tekutiny', ikona: '💧', nazev: 'Tekutiny' },
    { id: 'moceni', ikona: '🚽', nazev: 'Močení' },
    { id: 'jidlo', ikona: '🍽️', nazev: 'Jídlo' },
    { id: 'spanek', ikona: '😴', nazev: 'Spánek' },
    { id: 'poznamka', ikona: '📝', nazev: 'Poznámka' }
  ];
  const TYP = Object.fromEntries(TYPY.map(t => [t.id, t]));

  const PRIZNAKY = ['kašel', 'rýma', 'bolest v krku', 'zvracení', 'průjem', 'vyrážka', 'bolest hlavy', 'bolest ucha', 'bolest břicha',
    'únava', 'zimnice', 'bolest svalů', 'ucpaný nos', 'chrapot', 'pálení při močení', 'nechutenství', 'dušnost', 'neklid / pláč'];
  const INTENZITY = ['', 'mírné', 'střední', 'silné'];
  const JEDNOTKY = ['mg', 'ml', 'tbl', 'čípek', 'kapky', 'sáček'];

  /* ---------- čas ---------- */
  const dv = n => String(n).padStart(2, '0');
  function naDatum(s) {
    if (s instanceof Date) return new Date(s.getTime());
    const m = /^(\d{4})-(\d\d)-(\d\d)(?:[T ](\d\d):(\d\d))?/.exec(String(s || ''));
    return m ? new Date(+m[1], m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)) : null;
  }
  const naText = d => `${d.getFullYear()}-${dv(d.getMonth() + 1)}-${dv(d.getDate())}T${dv(d.getHours())}:${dv(d.getMinutes())}`;
  const tedText = () => naText(new Date());
  const den = s => String(s).slice(0, 10);
  const H = 3600000;
  function formatCas(s, sDnem) {
    const d = naDatum(s); if (!d) return '';
    const c = `${d.getHours()}:${dv(d.getMinutes())}`;
    return sDnem === false ? c : `${d.getDate()}. ${d.getMonth() + 1}. ${c}`;
  }
  function formatDen(s) {
    const d = naDatum(s); if (!d) return '';
    return ['ne', 'po', 'út', 'st', 'čt', 'pá', 'so'][d.getDay()] + ' ' + d.getDate() + '. ' + (d.getMonth() + 1) + '. ' + d.getFullYear();
  }
  const cislo = (v, des) => (Math.round(v * 10 ** (des || 0)) / 10 ** (des || 0)).toString().replace('.', ',');

  function vekMesice(osoba, ted) {
    if (!osoba || !osoba.narozeni) return null;
    const n = naDatum(osoba.narozeni), t = naDatum(ted || tedText());
    if (!n || !t) return null;
    let m = (t.getFullYear() - n.getFullYear()) * 12 + t.getMonth() - n.getMonth();
    if (t.getDate() < n.getDate()) m--;
    return Math.max(0, m);
  }
  function popisVeku(m) {
    if (m == null) return '';
    if (m < 24) return m + ' měs.';
    const r = Math.floor(m / 12);
    return r + (r < 5 ? ' roky' : ' let');
  }

  /* ---------- teplota ---------- */
  function kategorieTeploty(t, misto, vekMes) {
    t = Number(t);
    const M = MISTA[misto] || MISTA.podpazi;
    const p = Math.round((t + M.posun) * 10) / 10;
    let k = p < 35.5 ? 'nizka' : p < 37.5 ? 'normalni' : p < 38 ? 'zvysena' : p <= 39 ? 'horecka' : p <= 40 ? 'vysoka' : 'velmi_vysoka';
    const varovani = [];
    let volat = k === 'velmi_vysoka';
    if (vekMes != null && vekMes < 3 && t >= 38) { volat = true; varovani.push('Kojenec do 3 měsíců s teplotou 38 °C a víc – volejte lékaře.'); }
    else if (k === 'velmi_vysoka') varovani.push('Teplota nad 40 °C – volejte lékaře.');
    return { t, misto: misto in MISTA ? misto : 'podpazi', prepocet: p, kategorie: k, nazev: KATEGORIE[k].nazev, barva: KATEGORIE[k].barva, volatLekare: volat, varovani };
  }

  /* ---------- léky ---------- */
  function latka(nazev) {
    const n = String(nazev || '').toLowerCase();
    for (const l in ZNACKY) if (ZNACKY[l].some(z => n.includes(z))) return l;
    return null;
  }
  /* dávka v mg: jednotka mg přímo, jinak dávka × síla (mg v 1 ml / tabletě / čípku); neznámé = null */
  function mgDavky(z) {
    const d = Number(z.davka);
    if (!(d > 0)) return null;
    if (z.jednotka === 'mg') return d;
    return Number(z.sila) > 0 ? d * Number(z.sila) : null;
  }

  /* Kdy je možná další dávka a kolik zbývá do max. denní dávky (klouzavě za posledních 24 h).
     zaznamy = záznamy epizody (stačí typ 'lek'), lek = název nebo látka, ted = Date nebo text. */
  function dalsiDavka(zaznamy, lek, hmotnost, ted, vekMes) {
    const T = naDatum(ted || tedText()).getTime();
    const l = latka(lek);
    const kg = Number(hmotnost) > 0 ? Number(hmotnost) : null;
    const varovani = [];
    const shoda = z => z.typ === 'lek' && (l ? latka(z.nazev) === l : String(z.nazev || '').trim().toLowerCase() === String(lek || '').trim().toLowerCase());
    const davky = (zaznamy || []).filter(shoda).map(z => ({ cas: naDatum(z.cas).getTime(), mg: mgDavky(z), z }))
      .filter(d => d.cas <= T).sort((a, b) => a.cas - b.cas);
    const posledni = davky.length ? naText(new Date(davky[davky.length - 1].cas)) : null;
    if (!l) {
      return { latka: null, posledni, mozno: null, uzTed: null, zbyvaDnes_mg: null, za24h_mg: null, max_mg: null, davka_mg: null,
        varovani: ['Pro tento lék tu pravidla nejsou – interval a dávku hlídejte podle příbalového letáku.'] };
    }
    const P = PARAMETRY.leky[l];
    const max = kg ? Math.min(Math.round(kg * P.maxMgKgDen), P.maxMgDen) : P.maxMgDen;
    const davka = kg ? [Math.round(kg * P.mgKg[0]), Math.min(Math.round(kg * P.mgKg[1]), Math.round(P.maxMgDen / 4))] : null;
    if (!kg) varovani.push('Zadejte hmotnost – bez ní počítám jen strop pro dospělé (' + P.maxMgDen + ' mg/den).');
    if (vekMes != null && vekMes < P.minVekMes) varovani.push(P.nazev + ' se u dětí do ' + P.minVekMes + ' měsíců bez lékaře nepodává.');
    if (P.minKg && kg && kg < P.minKg) varovani.push(P.nazev + ' se u dětí pod ' + P.minKg + ' kg bez lékaře nepodává.');
    if (vekMes != null && vekMes < 3 && l === 'paracetamol') varovani.push('U kojence do 3 měsíců dávkujte jen po poradě s lékařem.');
    if (davky.some(d => d.mg == null)) varovani.push('U některé dávky chybí síla (mg v ml / tabletě) – do denního součtu se nezapočítala.');

    const okno = t => davky.filter(d => d.cas > t - 24 * H && d.cas <= t).reduce((s, d) => s + (d.mg || 0), 0);
    const za24 = okno(T);
    for (let i = 1; i < davky.length; i++) {
      const h = (davky[i].cas - davky[i - 1].cas) / H;
      if (h < P.intervalH[0] - 1e-9) varovani.push(`Dávky ${formatCas(naText(new Date(davky[i - 1].cas)))} a ${formatCas(naText(new Date(davky[i].cas)))} jsou jen ${cislo(h, 1)} h od sebe (min. ${P.intervalH[0]} h).`);
    }
    if (za24 > max) varovani.push(`Za posledních 24 h ${za24} mg – překročena max. denní dávka ${max} mg!`);
    const posl = davky[davky.length - 1];
    if (posl && posl.mg != null && davka && posl.mg > davka[1] * 1.1) varovani.push(`Poslední dávka ${posl.mg} mg je víc než ${P.mgKg[1]} mg/kg (${davka[1]} mg).`);

    /* nejdřívější čas: min. interval od poslední dávky a zároveň se další dávka vejde do klouzavých 24 h */
    let mozno = null;
    if (posl) {
      const dalsi = davka ? davka[0] : (posl.mg || 0);
      let t = posl.cas + P.intervalH[0] * H;
      const kandidati = [t].concat(davky.map(d => d.cas + 24 * H)).filter(x => x >= t).sort((a, b) => a - b);
      t = kandidati.find(x => okno(x) + dalsi <= max + 1e-9);
      if (t == null) t = posl.cas + 24 * H;
      mozno = naText(new Date(t));
    }
    return {
      latka: l, posledni, mozno, uzTed: !mozno || naDatum(mozno).getTime() <= T,
      za24h_mg: za24, max_mg: max, zbyvaDnes_mg: Math.max(0, max - za24), davka_mg: davka, intervalH: P.intervalH, varovani
    };
  }

  /* ---------- data ---------- */
  let citac = 0;
  const noveId = p => p + Date.now().toString(36) + (citac++).toString(36) + Math.floor(Math.random() * 1296).toString(36);
  function prazdna() { return { verze: VERZE, osoby: [], epizody: [], zaznamy: [] }; }
  const txt = (v, n) => String(v == null ? '' : v).slice(0, n || 200);
  const num = v => { const x = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(x) ? x : null; };
  const casOk = v => naDatum(v) ? naText(naDatum(v)) : '';

  function normOsoba(o) {
    o = o || {};
    return { id: txt(o.id, 40) || noveId('o'), jmeno: txt(o.jmeno, 80) || 'Bez jména', typ: o.typ === 'dospely' ? 'dospely' : 'dite',
      narozeni: /^\d{4}-\d\d-\d\d$/.test(o.narozeni || '') ? o.narozeni : '', hmotnost: num(o.hmotnost) };
  }
  function normEpizoda(e) {
    e = e || {};
    return { id: txt(e.id, 40) || noveId('e'), osoba: txt(e.osoba, 40), nazev: txt(e.nazev, 120) || 'Nemoc',
      zacatek: casOk(e.zacatek) || tedText(), konec: casOk(e.konec), poznamka: txt(e.poznamka, 4000) };
  }
  function normZaznam(z) {
    z = z || {};
    const r = { id: txt(z.id, 40) || noveId('z'), epizoda: txt(z.epizoda, 40), typ: TYP[z.typ] ? z.typ : 'poznamka', cas: casOk(z.cas) || tedText(), pozn: txt(z.pozn, 2000) };
    if (r.typ === 'teplota') { r.t = num(z.t); r.misto = z.misto in MISTA ? z.misto : 'podpazi'; }
    if (r.typ === 'lek') { r.nazev = txt(z.nazev, 120); r.davka = num(z.davka); r.jednotka = JEDNOTKY.includes(z.jednotka) ? z.jednotka : 'mg'; r.sila = num(z.sila); }
    if (r.typ === 'priznaky') { r.priznaky = (Array.isArray(z.priznaky) ? z.priznaky : []).map(p => txt(p, 60)).filter(Boolean); r.intenzita = [1, 2, 3].includes(+z.intenzita) ? +z.intenzita : 2; }
    if (r.typ === 'tekutiny') r.ml = num(z.ml);
    if (r.typ === 'moceni') { r.pocet = num(z.pocet) || 1; }
    if (r.typ === 'jidlo') r.mnozstvi = ['nic', 'malo', 'normalne'].includes(z.mnozstvi) ? z.mnozstvi : 'normalne';
    if (r.typ === 'spanek') { r.hodin = num(z.hodin); r.kvalita = ['klidny', 'neklidny', 'spatny'].includes(z.kvalita) ? z.kvalita : 'klidny'; }
    return r;
  }
  function migruj(d) {
    if (!d || typeof d !== 'object') return prazdna();
    const r = prazdna();
    r.osoby = (Array.isArray(d.osoby) ? d.osoby : []).map(normOsoba);
    r.epizody = (Array.isArray(d.epizody) ? d.epizody : []).map(normEpizoda);
    r.zaznamy = (Array.isArray(d.zaznamy) ? d.zaznamy : []).map(normZaznam);
    return r;
  }

  const MNOZSTVI = { nic: 'nejí', malo: 'málo', normalne: 'normálně' };
  const KVALITA = { klidny: 'klidný', neklidny: 'neklidný', spatny: 'špatný' };
  /* krátký popis záznamu pro osu, souhrn i CSV */
  function popisZaznamu(z) {
    switch (z.typ) {
      case 'teplota': return z.t == null ? '' : cislo(z.t, 1) + ' °C (' + MISTA[z.misto].nazev + ')';
      case 'lek': { const mg = mgDavky(z); return [z.nazev, z.davka != null ? cislo(z.davka, 2) + ' ' + z.jednotka : '', mg != null && z.jednotka !== 'mg' ? '= ' + cislo(mg, 0) + ' mg' : ''].filter(Boolean).join(' '); }
      case 'priznaky': return z.priznaky.join(', ') + (z.priznaky.length ? ' – ' + INTENZITY[z.intenzita] : '');
      case 'tekutiny': return z.ml != null ? cislo(z.ml, 0) + ' ml' : '';
      case 'moceni': return z.pocet > 1 ? z.pocet + '×' : 'močil(a)';
      case 'jidlo': return MNOZSTVI[z.mnozstvi];
      case 'spanek': return (z.hodin != null ? cislo(z.hodin, 1) + ' h, ' : '') + KVALITA[z.kvalita];
      default: return '';
    }
  }

  const zaznamyEpizody = (data, id) => data.zaznamy.filter(z => z.epizoda === id).sort((a, b) => a.cas < b.cas ? -1 : a.cas > b.cas ? 1 : 0);

  /* záznamy seskupené po dnech, vzestupně */
  function dny(zaznamy) {
    const m = new Map();
    zaznamy.slice().sort((a, b) => a.cas < b.cas ? -1 : a.cas > b.cas ? 1 : 0).forEach(z => {
      const d = den(z.cas);
      if (!m.has(d)) m.set(d, []);
      m.get(d).push(z);
    });
    return [...m].map(([d, zz]) => ({ den: d, zaznamy: zz }));
  }

  function souhrnEpizody(data, epizodaId, ted) {
    const e = data.epizody.find(x => x.id === epizodaId);
    if (!e) return null;
    const o = data.osoby.find(x => x.id === e.osoba) || null;
    const zz = zaznamyEpizody(data, e.id);
    const vek = vekMesice(o, e.zacatek);
    const teploty = zz.filter(z => z.typ === 'teplota' && z.t != null).map(z => Object.assign({ cas: z.cas }, kategorieTeploty(z.t, z.misto, vek)));
    const maxT = teploty.reduce((m, t) => !m || t.prepocet > m.prepocet ? t : m, null);
    const poDnech = dny(zz).map(d => {
      const tt = teploty.filter(t => den(t.cas) === d.den);
      const tek = d.zaznamy.filter(z => z.typ === 'tekutiny').reduce((s, z) => s + (z.ml || 0), 0);
      const moc = d.zaznamy.filter(z => z.typ === 'moceni').reduce((s, z) => s + (z.pocet || 1), 0);
      return { den: d.den, maxT: tt.length ? Math.max(...tt.map(t => t.prepocet)) : null, minT: tt.length ? Math.min(...tt.map(t => t.prepocet)) : null,
        mereni: tt.length, tekutiny_ml: tek, moceni: moc };
    });
    const leky = new Map();
    zz.filter(z => z.typ === 'lek').forEach(z => {
      const l = latka(z.nazev), k = l || z.nazev.toLowerCase();
      if (!leky.has(k)) leky.set(k, { nazev: l ? PARAMETRY.leky[l].nazev : z.nazev, latka: l, davky: [], mgPoDnech: {} });
      const L = leky.get(k), mg = mgDavky(z);
      L.davky.push({ cas: z.cas, popis: popisZaznamu(z), mg });
      if (mg != null) L.mgPoDnech[den(z.cas)] = (L.mgPoDnech[den(z.cas)] || 0) + mg;
    });
    const pr = new Map();
    zz.filter(z => z.typ === 'priznaky').forEach(z => z.priznaky.forEach(p => {
      const x = pr.get(p) || { nazev: p, prvni: z.cas, posledni: z.cas, maxIntenzita: 0, pocet: 0 };
      x.posledni = z.cas; x.maxIntenzita = Math.max(x.maxIntenzita, z.intenzita); x.pocet++;
      pr.set(p, x);
    }));
    const konec = e.konec || (zz.length ? zz[zz.length - 1].cas : e.zacatek);
    const trvani = Math.floor((naDatum(den(konec)) - naDatum(den(e.zacatek))) / (24 * H)) + 1;
    const varovani = teploty.filter(t => t.volatLekare).map(t => formatCas(t.cas) + ': ' + t.varovani.join(' '));
    const s = { epizoda: e, osoba: o, vekMes: vek, zacatek: e.zacatek, konec: e.konec, trvaniDni: trvani, pocetZaznamu: zz.length,
      maxTeplota: maxT, teploty, poDnech, leky: [...leky.values()], priznaky: [...pr.values()],
      poznamky: zz.filter(z => z.pozn).map(z => ({ cas: z.cas, typ: z.typ, text: z.pozn })), varovani };
    s.text = textSouhrnu(s, ted);
    return s;
  }

  function textSouhrnu(s, ted) {
    const r = [], e = s.epizoda, o = s.osoba;
    r.push('DENÍK NEMOCI – ' + e.nazev);
    if (o) r.push('Pacient: ' + o.jmeno + (s.vekMes != null ? ', ' + popisVeku(s.vekMes) : '') + (o.hmotnost ? ', ' + cislo(o.hmotnost, 1) + ' kg' : ''));
    r.push('Začátek: ' + formatDen(e.zacatek) + ' ' + formatCas(e.zacatek, false) + (e.konec ? ' · konec: ' + formatDen(e.konec) : ' · trvá') + ' · ' + s.trvaniDni + '. den');
    if (s.maxTeplota) r.push('Nejvyšší teplota: ' + cislo(s.maxTeplota.t, 1) + ' °C (' + MISTA[s.maxTeplota.misto].nazev + ') ' + formatCas(s.maxTeplota.cas));
    if (e.poznamka) r.push('Poznámka: ' + e.poznamka);
    r.push('', 'PRŮBĚH PO DNECH');
    s.poDnech.forEach(d => {
      const c = [formatDen(d.den) + ':'];
      if (d.maxT != null) c.push('teplota ' + cislo(d.minT, 1) + '–' + cislo(d.maxT, 1) + ' °C (' + d.mereni + '× měřeno, přepočet na podpaží)');
      if (d.tekutiny_ml) c.push('tekutiny ' + d.tekutiny_ml + ' ml');
      if (d.moceni) c.push('močení ' + d.moceni + '×');
      r.push('  ' + c.join(', '));
    });
    if (s.leky.length) {
      r.push('', 'LÉKY');
      s.leky.forEach(L => {
        r.push('  ' + L.nazev + ':');
        r.push('    ' + L.davky.map(d => formatCas(d.cas) + ' ' + d.popis).join('; '));
        const pd = Object.keys(L.mgPoDnech);
        if (pd.length) r.push('    celkem za den: ' + pd.map(d => formatDen(d).replace(/ \d{4}$/, '') + ' ' + cislo(L.mgPoDnech[d], 0) + ' mg').join(', '));
      });
    }
    if (s.priznaky.length) {
      r.push('', 'PŘÍZNAKY');
      s.priznaky.forEach(p => r.push('  ' + p.nazev + ' – od ' + formatCas(p.prvni) + (p.posledni !== p.prvni ? ' do ' + formatCas(p.posledni) : '') + ', nejvýš ' + INTENZITY[p.maxIntenzita]));
    }
    if (s.poznamky.length) {
      r.push('', 'POZNÁMKY');
      s.poznamky.forEach(p => r.push('  ' + formatCas(p.cas) + ' ' + p.text));
    }
    r.push('', 'Vytvořeno ' + formatCas(ted || tedText()) + ' v Deníku nemoci (záznamy rodičů/pacienta, ne lékařská zpráva).');
    return r.join('\n');
  }

  const csvB = v => { const s = String(v == null ? '' : v); return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  function csv(data) {
    const r = [['Osoba', 'Nemoc', 'Čas', 'Druh', 'Hodnota', 'Teplota °C', 'Místo měření', 'Lék', 'Dávka', 'Jednotka', 'mg', 'Příznaky', 'Intenzita', 'Tekutiny ml', 'Poznámka']];
    data.zaznamy.slice().sort((a, b) => a.cas < b.cas ? -1 : 1).forEach(z => {
      const e = data.epizody.find(x => x.id === z.epizoda) || {}, o = data.osoby.find(x => x.id === e.osoba) || {};
      const mg = z.typ === 'lek' ? mgDavky(z) : null;
      r.push([o.jmeno, e.nazev, z.cas.replace('T', ' '), TYP[z.typ].nazev, popisZaznamu(z),
        z.typ === 'teplota' && z.t != null ? cislo(z.t, 1) : '', z.typ === 'teplota' ? MISTA[z.misto].nazev : '',
        z.nazev || '', z.davka != null ? cislo(z.davka, 2) : '', z.typ === 'lek' ? z.jednotka : '', mg != null ? cislo(mg, 0) : '',
        z.priznaky ? z.priznaky.join(', ') : '', z.typ === 'priznaky' ? INTENZITY[z.intenzita] : '', z.ml != null ? z.ml : '', z.pozn]);
    });
    return '﻿' + r.map(x => x.map(csvB).join(';')).join('\r\n');
  }

  const API = {
    VERZE, KLIC, PARAMETRY, ZNACKY, MISTA, KATEGORIE, TYPY, TYP, PRIZNAKY, INTENZITY, JEDNOTKY, MNOZSTVI, KVALITA,
    kategorieTeploty, latka, mgDavky, dalsiDavka, prazdna, migruj, normOsoba, normEpizoda, normZaznam, noveId,
    zaznamyEpizody, dny, souhrnEpizody, csv, popisZaznamu, vekMesice, popisVeku,
    naDatum, naText, tedText, den, formatCas, formatDen, cislo
  };
  if (typeof module !== 'undefined') module.exports = API; else window.DenikNemociJadro = API;
})();

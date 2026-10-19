/* Generátor testovacích dat – uživatelské rozhraní. Výpočty: TDJadro (jadro.js), generování: worker.js. */
(function () {
  'use strict';
  const J = window.TDJadro;
  const KLIC = 'webapp_testovaci_data_stav';
  const NAHLED_RADKU = 12;
  const STRANKA = 50;
  const $ = id => document.getElementById(id);
  const fmt = (n, des) => typeof n === 'number' ? n.toLocaleString('cs-CZ', { maximumFractionDigits: des === undefined ? 3 : des }) : String(n);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ================= Stav ================= */
  let stav = { schema: J.SABLONY.eshop.schema(), seed: 'demo-2026', davka: 5000, export: {} };
  let verze = 0;            // počítadlo změn schématu
  let vysledek = null;      // { verze, seed, tabulky, statistiky, integrita, cas, radku }
  let rezimDat = 'nahled';  // 'nahled' | 'data'
  let vybranaTab = null;
  let stranka = 0;
  let nahled = null;        // { data, chyba }
  let uloha = 0;            // id běžící úlohy
  let generujeSe = false, exportujeSe = false;
  const otevrene = new WeakSet();

  try {
    const s = JSON.parse(localStorage.getItem(KLIC) || 'null');
    if (s && s.schema && Array.isArray(s.schema.tabulky)) stav = Object.assign(stav, s);
  } catch (e) { /* bez uloženého stavu */ }
  normalizujSchema(stav.schema);
  stav.export = stav.export || {};

  let casUlozeni = null;
  function uloz() {
    clearTimeout(casUlozeni);
    casUlozeni = setTimeout(() => { try { localStorage.setItem(KLIC, JSON.stringify(stav)); } catch (e) { /* plné úložiště */ } }, 300);
  }

  function normalizujSloupec(s) {
    if (!J.TYPY[s.typ] || J.TYPY[s.typ].jenPravidlo) s.typ = 'text';
    const v = J.VYCHOZI[s.typ] || {};
    for (const k in v) if (s[k] === undefined) s[k] = v[k];
    if (s.nullP === undefined) s.nullP = 0;
    s.unikatni = !!s.unikatni; s.pk = !!s.pk;
    if (!Array.isArray(s.pravidla)) s.pravidla = [];
    s.pravidla.forEach(p => { if (!p.gen || !J.TYPY[p.gen.typ]) p.gen = { typ: 'null' }; if (typeof p.kdyz !== 'string') p.kdyz = ''; });
    if (s.nazev === undefined) s.nazev = 'sloupec';
    return s;
  }
  function normalizujSchema(sch) {
    sch.tabulky = (sch.tabulky || []).filter(t => t && typeof t === 'object');
    for (const t of sch.tabulky) {
      if (!t.rezimRadku) t.rezimRadku = 'pevny';
      if (t.radky === undefined) t.radky = 100;
      if (t.minNaRodice === undefined) t.minNaRodice = 1;
      if (t.maxNaRodice === undefined) t.maxNaRodice = 3;
      t.sloupce = (Array.isArray(t.sloupce) ? t.sloupce : []).filter(s => s && typeof s === 'object').map(normalizujSloupec);
    }
    return sch;
  }

  /* ================= Pracovník (Web Worker se zálohou v hlavním vlákně) ================= */
  let worker = null, mistni = null;
  function posli(z) {
    if (worker) worker.postMessage(z);
    else mistni(z);
  }
  function zalozMistni() {
    worker = null;
    mistni = window.TDPracovnik.vytvorObsluhu(z => setTimeout(() => prijmi(z), 0));
  }
  try {
    worker = new Worker('testovaci_data/worker.js');
    worker.onmessage = e => prijmi(e.data);
    worker.onerror = e => {
      e.preventDefault && e.preventDefault();
      if (generujeSe || exportujeSe) zobrazChybuGenerovani('Web Worker selhal (' + (e.message || 'neznámá chyba') + ') – zkuste to znovu, poběží v hlavním vlákně.');
      ukonciBeh();
      zalozMistni();
    };
  } catch (e) { zalozMistni(); }

  /* ================= Editor schématu ================= */
  const TYPY_SKUPINY = (() => {
    const sk = {};
    for (const k in J.TYPY) { const g = J.TYPY[k].skupina; (sk[g] = sk[g] || []).push(k); }
    return sk;
  })();
  function moznostiTypu(vybrany, proPravidlo) {
    let h = '';
    for (const g in TYPY_SKUPINY) {
      const typy = TYPY_SKUPINY[g].filter(k => proPravidlo ? (k !== 'reference' && k !== 'sekvence') : !J.TYPY[k].jenPravidlo);
      if (!typy.length) continue;
      h += '<optgroup label="' + esc(g) + '">' + typy.map(k => '<option value="' + k + '"' + (k === vybrany ? ' selected' : '') + '>' + esc(J.TYPY[k].nazev) + '</option>').join('') + '</optgroup>';
    }
    return h;
  }

  const ROZDELENI = [
    { k: 'rozdeleni', l: 'Rozdělení', t: 'vyber', m: [['rovnomerne', 'rovnoměrné'], ['normalni', 'normální (Gaussovo)'], ['exponencialni', 'exponenciální'], ['lognormalni', 'lognormální'], ['trojuhelnikove', 'trojúhelníkové']] },
    { k: 'stred', l: o => ({ normalni: 'Střed (průměr)', exponencialni: 'Průměr', lognormalni: 'Medián', trojuhelnikove: 'Vrchol (nejčastější)' }[o.rozdeleni] || 'Střed'), t: o => o._datum ? 'text' : 'cislo', kdyz: o => o.rozdeleni && o.rozdeleni !== 'rovnomerne', ph: 'výchozí: střed rozsahu' },
    { k: 'odchylka', l: o => o._datum ? 'Směrodatná odchylka (dny)' : 'Směrodatná odchylka', t: 'cislo', kdyz: o => o.rozdeleni === 'normalni', ph: 'výchozí: šestina rozsahu' },
    { k: 'tvar', l: 'Tvar σ (rozptyl logaritmu)', t: 'cislo', kdyz: o => o.rozdeleni === 'lognormalni', ph: '0,6' },
  ];
  const POLE = {
    sekvence: [{ k: 'start', l: 'Začátek', t: 'cislo' }, { k: 'krok', l: 'Krok', t: 'cislo' }],
    cele: [{ k: 'min', l: 'Minimum', t: 'cislo' }, { k: 'max', l: 'Maximum', t: 'cislo' }].concat(ROZDELENI),
    desetinne: [{ k: 'min', l: 'Minimum', t: 'cislo' }, { k: 'max', l: 'Maximum', t: 'cislo' }, { k: 'des', l: 'Desetinných míst', t: 'cislo' }].concat(ROZDELENI),
    datum: [{ k: 'od', l: 'Od', t: 'datum' }, { k: 'do', l: 'Do', t: 'datum' }].concat(ROZDELENI),
    datumcas: [{ k: 'od', l: 'Od (RRRR-MM-DD HH:MM:SS)', t: 'text', mono: true }, { k: 'do', l: 'Do', t: 'text', mono: true }].concat(ROZDELENI),
    boolean: [{ k: 'pravd', l: 'Pravděpodobnost „ano“ (%)', t: 'cislo' }],
    vycet: [{ k: 'hodnoty', l: 'Hodnoty – jedna na řádek, váha za svislítkem (hodnota | 3)', t: 'textarea', cela: true }],
    text: [{ k: 'rezim', l: 'Generovat', t: 'vyber', m: [['slova', 'slova'], ['vety', 'věty']] }, { k: 'min', l: 'Nejméně', t: 'cislo' }, { k: 'max', l: 'Nejvíce', t: 'cislo' }],
    uuid: [],
    vzor: [{ k: 'vzor', l: 'Vzor: # číslice, ? písmeno, * alfanum., [A-Z] třída, (a|b), {n,m}', t: 'text', mono: true, cela: true }],
    jmeno: [
      { k: 'cast', l: 'Část jména', t: 'vyber', m: [['cele', 'celé jméno'], ['krestni', 'křestní jméno'], ['prijmeni', 'příjmení']] },
      { k: 'pohlavi', l: 'Pohlaví', t: 'vyber', m: [['nahodne', 'náhodně'], ['m', 'muž'], ['z', 'žena'], ['sloupec', 'podle sloupce']] },
      { k: 'sloupecPohlavi', l: 'Sloupec s pohlavím (M/Ž)', t: 'sloupec', kdyz: o => o.pohlavi === 'sloupec' },
    ],
    email: [
      { k: 'zdroj', l: 'Místní část', t: 'vyber', m: [['nahodny', 'náhodná slova'], ['sloupce', 'ze jména a příjmení']] },
      { k: 'sloupecJmeno', l: 'Sloupec se jménem', t: 'sloupec', kdyz: o => o.zdroj === 'sloupce' },
      { k: 'sloupecPrijmeni', l: 'Sloupec s příjmením', t: 'sloupec', kdyz: o => o.zdroj === 'sloupce' },
      { k: 'domena', l: 'Doména (RFC 2606)', t: 'vyber', m: [['mix', 'example.com / .org / .net'], ['example.com', 'example.com'], ['example.org', 'example.org'], ['example.net', 'example.net']] },
    ],
    telefon: [{ k: 'format', l: 'Fiktivní rozsah', t: 'vyber', cela: true, m: [['cz0', 'ČR +420 0xx xxx xxx (nepřidělená řada)'], ['uk', 'UK +44 7700 900xxx (Ofcom, pro film/TV)'], ['us', 'USA +1 xxx 555 01xx (fiktivní)']] }],
    adresa: [{ k: 'cast', l: 'Část adresy', t: 'vyber', m: [['cela', 'celá adresa'], ['ulice', 'ulice a číslo'], ['obec', 'obec'], ['psc', 'PSČ']] }],
    produkt: [],
    reference: [
      { k: 'tabulka', l: 'Odkazovaná tabulka', t: 'tabulka' },
      { k: 'sloupec', l: 'Sloupec (PK / unikátní)', t: 'sloupecTabulky' },
      { k: 'rozdeleni', l: 'Výběr nadřazeného řádku', t: 'vyber', m: [['rovnomerne', 'rovnoměrně'], ['zipf', 'Zipf – někteří mnohem častěji']] },
      { k: 's', l: 'Exponent Zipfa (0–5)', t: 'cislo', kdyz: o => o.rozdeleni === 'zipf' },
    ],
    vzorec: [{ k: 'vyraz', l: 'Výraz', t: 'vyraz', cela: true }],
    null: [],
  };

  function cisloZPole(v) {
    const s = String(v).trim().replace(/\s/g, '').replace(',', '.');
    if (s === '') return '';
    const n = Number(s);
    return isFinite(n) ? n : v;
  }

  /* Vykreslí parametry generátoru g (typ + parametry) do kontejneru. */
  function vykresliParametry(kont, g, t, pozmeneno) {
    const pole = POLE[g.typ] || [];
    const pom = Object.assign({}, g, { _datum: g.typ === 'datum' || g.typ === 'datumcas' });
    let h = '';
    const id = () => 'p' + Math.random().toString(36).slice(2, 9);
    const ids = [];
    for (const p of pole) {
      if (p.kdyz && !p.kdyz(pom)) continue;
      const l = typeof p.l === 'function' ? p.l(pom) : p.l;
      const typ = typeof p.t === 'function' ? p.t(pom) : p.t;
      const i = id(); ids.push([i, p.k, typ]);
      const v = g[p.k] === undefined || g[p.k] === null ? '' : g[p.k];
      let vstup;
      if (typ === 'vyber') vstup = '<select id="' + i + '">' + p.m.map(([k, n]) => '<option value="' + esc(k) + '"' + (String(v) === k ? ' selected' : '') + '>' + esc(n) + '</option>').join('') + '</select>';
      else if (typ === 'textarea') vstup = '<textarea id="' + i + '" rows="4" spellcheck="false">' + esc(v) + '</textarea>';
      else if (typ === 'vyraz') {
        vstup = '<textarea id="' + i + '" class="mono" rows="2" spellcheck="false" placeholder="např. zaokrouhli(mnozstvi * cena, 2)">' + esc(v) + '</textarea>' +
          '<div class="chipy" data-vlozit="' + i + '">' + t.sloupce.map(s => '<button type="button" class="chip" data-nazev="' + esc(s.nazev) + '" title="Vložit název sloupce">' + esc(s.nazev) + '</button>').join('') + '</div>';
      } else if (typ === 'sloupec') vstup = '<select id="' + i + '"><option value="">– vyberte –</option>' + t.sloupce.map(s => '<option' + (s.nazev === v ? ' selected' : '') + '>' + esc(s.nazev) + '</option>').join('') + '</select>';
      else if (typ === 'tabulka') vstup = '<select id="' + i + '"><option value="">– vyberte –</option>' + stav.schema.tabulky.map(x => '<option' + (x.nazev === v ? ' selected' : '') + '>' + esc(x.nazev) + '</option>').join('') + '</select>';
      else if (typ === 'sloupecTabulky') {
        const rt = stav.schema.tabulky.find(x => x.nazev === g.tabulka);
        vstup = '<select id="' + i + '"><option value="">– vyberte –</option>' + (rt ? rt.sloupce : []).map(s => '<option value="' + esc(s.nazev) + '"' + (s.nazev === v ? ' selected' : '') + '>' + esc(s.nazev) + (s.pk ? ' (PK)' : s.unikatni ? ' (unikátní)' : '') + '</option>').join('') + '</select>';
      } else if (typ === 'datum') vstup = '<input type="text" id="' + i + '" class="mono" value="' + esc(v) + '" placeholder="RRRR-MM-DD" inputmode="numeric" spellcheck="false">';
      else vstup = '<input type="text" id="' + i + '" value="' + esc(typeof v === 'number' ? String(v).replace('.', ',') : v) + '"' + (typ === 'cislo' ? ' inputmode="decimal"' : '') + (p.mono ? ' class="mono"' : '') + (p.ph ? ' placeholder="' + esc(p.ph) + '"' : '') + ' spellcheck="false">';
      h += '<div' + (p.cela || typ === 'vyraz' || typ === 'textarea' ? ' class="cela"' : '') + '><label for="' + i + '">' + esc(l) + '</label>' + vstup + '</div>';
    }
    if (!pole.length) h = '<div class="cela napoveda">' + (g.typ === 'uuid' ? 'UUID verze 4 v kanonickém tvaru, odvozené ze seedu.' : g.typ === 'produkt' ? 'Název výrobku: přídavné jméno ve správném rodě + podstatné jméno, občas varianta (S, M, Pro…).' : g.typ === 'null' ? 'Hodnota bude NULL.' : '') + '</div>';
    if (g.typ === 'jmeno' && g.pohlavi === 'nahodne') h += '<div class="cela napoveda">Tip: pro souhlas křestního jména a tvaru příjmení v různých sloupcích přidejte sloupec pohlaví (výčet M/Ž) a zvolte „podle sloupce“.</div>';
    kont.innerHTML = '<div class="mrizka">' + h + '</div>';
    for (const [i, k, typ] of ids) {
      const el = kont.querySelector('#' + i);
      const strukt = typ === 'vyber' || typ === 'tabulka';
      el.addEventListener(strukt || typ === 'sloupec' || typ === 'sloupecTabulky' ? 'change' : 'input', () => {
        g[k] = typ === 'cislo' ? cisloZPole(el.value) : el.value;
        if (k === 'tabulka') g.sloupec = (stav.schema.tabulky.find(x => x.nazev === el.value) || { sloupce: [] }).sloupce.filter(s => s.pk).map(s => s.nazev)[0] || '';
        if (strukt) vykresliParametry(kont, g, t, pozmeneno);
        pozmeneno(strukt);
      });
    }
    kont.querySelectorAll('[data-vlozit]').forEach(ch => ch.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const ta = kont.querySelector('#' + ch.dataset.vlozit);
      const a = ta.selectionStart ?? ta.value.length, z = ta.selectionEnd ?? ta.value.length;
      ta.value = ta.value.slice(0, a) + b.dataset.nazev + ta.value.slice(z);
      ta.focus(); ta.selectionStart = ta.selectionEnd = a + b.dataset.nazev.length;
      ta.dispatchEvent(new Event('input'));
    }));
  }

  function popisSloupce(s) {
    const st = [];
    if (s.pk) st.push('<span class="stitek pk">PK</span>');
    else if (s.unikatni) st.push('<span class="stitek">unikátní</span>');
    if (s.typ === 'reference') st.push('<span class="stitek fk">→ ' + esc(s.tabulka || '?') + '.' + esc(s.sloupec || '?') + '</span>');
    if (Number(s.nullP) > 0) st.push('<span class="stitek">NULL ' + fmt(Number(s.nullP)) + ' %</span>');
    if (s.pravidla && s.pravidla.length) st.push('<span class="stitek">pravidla: ' + s.pravidla.length + '</span>');
    if (J.TYPY[s.typ] && J.TYPY[s.typ].synteticke) st.push('<span class="stitek synt" title="Syntetická hodnota – nepatří skutečné osobě">syntetické</span>');
    return '<span class="sl-nazev">' + esc(s.nazev || '(bez názvu)') + '</span><span class="sl-typ">' + esc((J.TYPY[s.typ] || {}).nazev || s.typ) + '</span>' + st.join('') + '<span class="stitek chyba" hidden>chyba</span>';
  }

  function prejmenujVeVyrazu(src, stare, nove) {
    try {
      const tk = J.tokenizuj(src); let out = '', last = 0;
      tk.forEach((x, k) => {
        if (x.t === 'id' && x.v === stare && !(tk[k + 1] && tk[k + 1].t === 'op' && tk[k + 1].v === '(')) { out += src.slice(last, x.p) + nove; last = x.p + stare.length; }
      });
      return out + src.slice(last);
    } catch (e) { return src; }
  }
  function prejmenujSloupec(t, stare, nove) {
    if (!stare || stare === nove) return;
    const uprav = g => {
      if (!g) return;
      if (g.typ === 'vzorec' && typeof g.vyraz === 'string') g.vyraz = prejmenujVeVyrazu(g.vyraz, stare, nove);
      ['sloupecPohlavi', 'sloupecJmeno', 'sloupecPrijmeni'].forEach(k => { if (g[k] === stare) g[k] = nove; });
    };
    for (const s of t.sloupce) { uprav(s); (s.pravidla || []).forEach(p => { p.kdyz = prejmenujVeVyrazu(p.kdyz, stare, nove); uprav(p.gen); }); }
    if (t.fkRodic === stare) t.fkRodic = nove;
    for (const t2 of stav.schema.tabulky) for (const s of t2.sloupce) {
      if (s.typ === 'reference' && s.tabulka === t.nazev && s.sloupec === stare) s.sloupec = nove;
    }
  }
  function prejmenujTabulku(stare, nove) {
    if (!stare || stare === nove) return;
    for (const t of stav.schema.tabulky) for (const s of t.sloupce) if (s.typ === 'reference' && s.tabulka === stare) s.tabulka = nove;
  }

  function vykresliSloupec(det, t, s) {
    const sum = det.querySelector('summary');
    const telo = det.querySelector('.sl-telo');
    sum.innerHTML = popisSloupce(s);
    const iN = 'n' + Math.random().toString(36).slice(2, 8);
    telo.innerHTML =
      '<div class="chyby sl-chyby"></div>' +
      '<div class="mrizka"><div><label for="' + iN + '">Název</label><input type="text" id="' + iN + '" class="mono sl-nazev-vstup" value="' + esc(s.nazev) + '" spellcheck="false" autocomplete="off"></div>' +
      '<div><label for="' + iN + 't">Typ</label><select id="' + iN + 't" class="sl-typ-vyber">' + moznostiTypu(s.typ) + '</select></div></div>' +
      '<div class="sl-parametry"></div>' +
      '<div class="mrizka">' +
      '<div><label for="' + iN + 'n">NULL (%)</label><input type="text" inputmode="decimal" id="' + iN + 'n" class="sl-null" value="' + esc(String(s.nullP).replace('.', ',')) + '"></div>' +
      '<div><label for="' + iN + 'q">SQL typ (nepovinné)</label><input type="text" id="' + iN + 'q" class="mono sl-sql" value="' + esc(s.sqlTyp || '') + '" placeholder="odvodí se" spellcheck="false"></div>' +
      '</div>' +
      '<div class="tlacitka"><label class="zaskrt"><input type="checkbox" class="sl-unik"' + (s.unikatni ? ' checked' : '') + '>Unikátní</label>' +
      '<label class="zaskrt"><input type="checkbox" class="sl-pk"' + (s.pk ? ' checked' : '') + '>Primární klíč</label></div>' +
      '<div class="sl-pravidla"></div>' +
      '<div class="sl-akce">' +
      '<button class="male sl-pridat-pravidlo" title="Když platí podmínka, použije se jiný generátor">+ Podmíněné pravidlo</button>' +
      '<button class="male ikona sl-nahoru" title="Posunout nahoru" aria-label="Posunout nahoru">↑</button>' +
      '<button class="male ikona sl-dolu" title="Posunout dolů" aria-label="Posunout dolů">↓</button>' +
      '<button class="male sl-dup">Duplikovat</button>' +
      '<button class="male nebezpecne sl-smaz">Smazat</button></div>';
    const zmena = strukt => { sum.innerHTML = popisSloupce(s); zmeneno(strukt); };
    vykresliParametry(telo.querySelector('.sl-parametry'), s, t, zmena);
    const nazev = telo.querySelector('.sl-nazev-vstup');
    let puvodni = s.nazev;
    nazev.addEventListener('input', () => { s.nazev = nazev.value.trim(); sum.innerHTML = popisSloupce(s); zmeneno(false); });
    nazev.addEventListener('change', () => { prejmenujSloupec(t, puvodni, s.nazev); puvodni = s.nazev; vykresliEditor(); zmeneno(true); });
    telo.querySelector('.sl-typ-vyber').addEventListener('change', e => {
      const novy = e.target.value;
      const zachovat = { nazev: s.nazev, nullP: s.nullP, unikatni: s.unikatni, pk: s.pk, pravidla: s.pravidla, sqlTyp: s.sqlTyp };
      for (const k of Object.keys(s)) delete s[k];
      Object.assign(s, { typ: novy }, JSON.parse(JSON.stringify(J.VYCHOZI[novy] || {})), zachovat);
      if (novy === 'reference') {
        const jina = stav.schema.tabulky.find(x => x !== t && x.sloupce.some(y => y.pk));
        if (jina) { s.tabulka = jina.nazev; s.sloupec = jina.sloupce.find(y => y.pk).nazev; }
      }
      vykresliSloupec(det, t, s); zmeneno(true);
    });
    telo.querySelector('.sl-null').addEventListener('input', e => { s.nullP = cisloZPole(e.target.value); if (s.nullP === '') s.nullP = 0; sum.innerHTML = popisSloupce(s); zmeneno(false); });
    telo.querySelector('.sl-sql').addEventListener('input', e => { s.sqlTyp = e.target.value; zmeneno(false); });
    telo.querySelector('.sl-unik').addEventListener('change', e => { s.unikatni = e.target.checked; zmena(false); });
    telo.querySelector('.sl-pk').addEventListener('change', e => { s.pk = e.target.checked; if (s.pk) { t.sloupce.forEach(x => { if (x !== s) x.pk = false; }); vykresliEditor(); } zmena(true); });
    const ix = () => t.sloupce.indexOf(s);
    telo.querySelector('.sl-nahoru').addEventListener('click', () => { const i = ix(); if (i > 0) { t.sloupce.splice(i, 1); t.sloupce.splice(i - 1, 0, s); vykresliEditor(); zmeneno(true); } });
    telo.querySelector('.sl-dolu').addEventListener('click', () => { const i = ix(); if (i < t.sloupce.length - 1) { t.sloupce.splice(i, 1); t.sloupce.splice(i + 1, 0, s); vykresliEditor(); zmeneno(true); } });
    telo.querySelector('.sl-dup').addEventListener('click', () => {
      const k = JSON.parse(JSON.stringify(s)); k.nazev = unikatniNazev(t.sloupce.map(x => x.nazev), s.nazev + '_kopie'); k.pk = false;
      t.sloupce.splice(ix() + 1, 0, k); otevrene.add(k); vykresliEditor(); zmeneno(true);
    });
    telo.querySelector('.sl-smaz').addEventListener('click', async () => {
      if (!(await Dialog.potvrd('Smazat sloupec „' + s.nazev + '“?'))) return;
      t.sloupce.splice(ix(), 1); vykresliEditor(); zmeneno(true);
    });
    telo.querySelector('.sl-pridat-pravidlo').addEventListener('click', () => {
      s.pravidla.push({ kdyz: '', gen: { typ: 'null' } }); vykresliPravidla(); zmena(true);
    });
    function vykresliPravidla() {
      const kont = telo.querySelector('.sl-pravidla');
      kont.innerHTML = '';
      s.pravidla.forEach((p, k) => {
        const d = document.createElement('div'); d.className = 'pravidlo';
        const i = 'r' + Math.random().toString(36).slice(2, 8);
        d.innerHTML = '<div class="pravidlo-hlava"><b>Pravidlo ' + (k + 1) + '</b><span class="tlacitka">' +
          (k > 0 ? '<button class="male ikona pr-nahoru" aria-label="Pravidlo výš" title="Vyhodnotit dříve">↑</button>' : '') +
          '<button class="male nebezpecne pr-smaz">Odebrat</button></span></div>' +
          '<label for="' + i + '">Když (podmínka)</label><input type="text" id="' + i + '" class="mono pr-kdyz" value="' + esc(p.kdyz) + '" placeholder="např. stav == &quot;zrušená&quot;" spellcheck="false">' +
          '<label for="' + i + 't">… pak generovat</label><select id="' + i + 't" class="pr-typ">' + moznostiTypu(p.gen.typ, true) + '</select>' +
          '<div class="pr-parametry"></div>';
        kont.appendChild(d);
        d.querySelector('.pr-kdyz').addEventListener('input', e => { p.kdyz = e.target.value; zmeneno(false); });
        d.querySelector('.pr-typ').addEventListener('change', e => {
          p.gen = Object.assign({ typ: e.target.value }, JSON.parse(JSON.stringify(J.VYCHOZI[e.target.value] || {})));
          vykresliParametry(d.querySelector('.pr-parametry'), p.gen, t, zmena); zmeneno(true);
        });
        d.querySelector('.pr-smaz').addEventListener('click', () => { s.pravidla.splice(k, 1); vykresliPravidla(); zmena(true); });
        const nh = d.querySelector('.pr-nahoru');
        if (nh) nh.addEventListener('click', () => { s.pravidla.splice(k, 1); s.pravidla.splice(k - 1, 0, p); vykresliPravidla(); zmena(true); });
        vykresliParametry(d.querySelector('.pr-parametry'), p.gen, t, zmena);
      });
    }
    vykresliPravidla();
  }

  function unikatniNazev(existujici, zaklad) {
    const set = new Set(existujici.map(x => x.toLowerCase()));
    if (!set.has(zaklad.toLowerCase())) return zaklad;
    for (let i = 2; ; i++) if (!set.has((zaklad + i).toLowerCase())) return zaklad + i;
  }

  function vykresliEditor() {
    const kont = $('tabulky');
    kont.innerHTML = '';
    stav.schema.tabulky.forEach((t, ti) => {
      const k = document.createElement('div'); k.className = 'tab-karta'; k.dataset.ti = ti;
      const i = 't' + ti;
      const fkMoznosti = t.sloupce.filter(s => s.typ === 'reference' && s.tabulka !== t.nazev);
      k.innerHTML =
        '<div class="tab-hlava"><div><label for="' + i + 'n">Tabulka</label><input type="text" id="' + i + 'n" class="tab-nazev" value="' + esc(t.nazev) + '" spellcheck="false" autocomplete="off"></div>' +
        '<div class="tlacitka"><button class="male ikona tab-nahoru" aria-label="Tabulka výš" title="Výš">↑</button><button class="male ikona tab-dolu" aria-label="Tabulka níž" title="Níž">↓</button>' +
        '<button class="male tab-dup">Duplikovat</button><button class="male nebezpecne tab-smaz">Smazat</button></div></div>' +
        '<div class="tab-radky">' +
        '<div class="w-rezim"><label for="' + i + 'r">Počet řádků</label><select id="' + i + 'r" class="tab-rezim"><option value="pevny"' + (t.rezimRadku === 'pevny' ? ' selected' : '') + '>pevný počet</option><option value="na_rodice"' + (t.rezimRadku === 'na_rodice' ? ' selected' : '') + '>na každý nadřazený řádek</option></select></div>' +
        (t.rezimRadku === 'na_rodice'
          ? '<div class="w-fk"><label for="' + i + 'f">podle cizího klíče</label><select id="' + i + 'f" class="tab-fk"><option value="">– vyberte –</option>' + fkMoznosti.map(s => '<option' + (s.nazev === t.fkRodic ? ' selected' : '') + '>' + esc(s.nazev) + '</option>').join('') + '</select></div>' +
            '<div class="w-min"><label for="' + i + 'a">min</label><input type="text" inputmode="numeric" id="' + i + 'a" class="tab-min" value="' + esc(t.minNaRodice) + '"></div>' +
            '<div class="w-min"><label for="' + i + 'b">max</label><input type="text" inputmode="numeric" id="' + i + 'b" class="tab-max" value="' + esc(t.maxNaRodice) + '"></div>'
          : '<div class="w-pocet"><label for="' + i + 'p">řádků</label><input type="text" inputmode="numeric" id="' + i + 'p" class="tab-pocet" value="' + esc(t.radky) + '"></div>') +
        '</div>' +
        (t.rezimRadku === 'na_rodice' && !fkMoznosti.length ? '<div class="napoveda">Nejdřív přidejte sloupec typu „Cizí klíč“ odkazující na jinou tabulku.</div>' : '') +
        '<div class="chyby tab-chyby"></div>' +
        '<div class="sloupce"></div>' +
        '<div class="tlacitka" style="margin-top:8px"><button class="male tab-pridat">+ Sloupec</button><button class="male tab-pridat-fk">+ Cizí klíč</button></div>';
      kont.appendChild(k);
      const sl = k.querySelector('.sloupce');
      t.sloupce.forEach((s, si) => {
        const det = document.createElement('details'); det.className = 'sl'; det.dataset.si = si;
        det.innerHTML = '<summary></summary><div class="sl-telo"></div>';
        if (otevrene.has(s)) det.open = true;
        let vykresleno = false;
        det.querySelector('summary').innerHTML = popisSloupce(s);
        const kresli = () => { if (!vykresleno) { vykresleno = true; vykresliSloupec(det, t, s); zobrazChybySchematu(); } };
        if (det.open) kresli();
        det.addEventListener('toggle', () => { if (det.open) { otevrene.add(s); kresli(); } else otevrene.delete(s); });
        sl.appendChild(det);
      });
      const nazev = k.querySelector('.tab-nazev');
      let puvodni = t.nazev;
      nazev.addEventListener('input', () => { t.nazev = nazev.value.trim(); zmeneno(false); });
      nazev.addEventListener('change', () => { prejmenujTabulku(puvodni, t.nazev); puvodni = t.nazev; vykresliEditor(); zmeneno(true); });
      k.querySelector('.tab-rezim').addEventListener('change', e => {
        t.rezimRadku = e.target.value;
        if (t.rezimRadku === 'na_rodice' && !t.fkRodic) { const f = t.sloupce.find(s => s.typ === 'reference' && s.tabulka !== t.nazev); if (f) t.fkRodic = f.nazev; }
        vykresliEditor(); zmeneno(true);
      });
      const pp = k.querySelector('.tab-pocet'); if (pp) pp.addEventListener('input', () => { t.radky = cisloZPole(pp.value); zmeneno(false); });
      const fk = k.querySelector('.tab-fk'); if (fk) fk.addEventListener('change', () => { t.fkRodic = fk.value; zmeneno(true); });
      const mn = k.querySelector('.tab-min'); if (mn) mn.addEventListener('input', () => { t.minNaRodice = cisloZPole(mn.value); zmeneno(false); });
      const mx = k.querySelector('.tab-max'); if (mx) mx.addEventListener('input', () => { t.maxNaRodice = cisloZPole(mx.value); zmeneno(false); });
      k.querySelector('.tab-nahoru').addEventListener('click', () => { if (ti > 0) { stav.schema.tabulky.splice(ti, 1); stav.schema.tabulky.splice(ti - 1, 0, t); vykresliEditor(); zmeneno(true); } });
      k.querySelector('.tab-dolu').addEventListener('click', () => { if (ti < stav.schema.tabulky.length - 1) { stav.schema.tabulky.splice(ti, 1); stav.schema.tabulky.splice(ti + 1, 0, t); vykresliEditor(); zmeneno(true); } });
      k.querySelector('.tab-dup').addEventListener('click', () => {
        const c = JSON.parse(JSON.stringify(t)); c.nazev = unikatniNazev(stav.schema.tabulky.map(x => x.nazev), t.nazev + '_kopie');
        c.sloupce.forEach(s => { if (s.typ === 'reference' && s.tabulka === t.nazev) s.tabulka = c.nazev; });
        stav.schema.tabulky.splice(ti + 1, 0, c); vykresliEditor(); zmeneno(true);
      });
      k.querySelector('.tab-smaz').addEventListener('click', async () => {
        const odkazy = stav.schema.tabulky.filter(x => x !== t && x.sloupce.some(s => s.typ === 'reference' && s.tabulka === t.nazev)).map(x => x.nazev);
        if (!(await Dialog.potvrd('Smazat tabulku „' + t.nazev + '“ se všemi sloupci?' + (odkazy.length ? '\nOdkazují na ni: ' + odkazy.join(', ') + ' – tyto cizí klíče bude třeba opravit.' : '')))) return;
        stav.schema.tabulky.splice(stav.schema.tabulky.indexOf(t), 1); vykresliEditor(); zmeneno(true);
      });
      k.querySelector('.tab-pridat').addEventListener('click', () => {
        const s = J.novySloupec(unikatniNazev(t.sloupce.map(x => x.nazev), 'sloupec' + (t.sloupce.length + 1)), 'cele');
        t.sloupce.push(s); otevrene.add(s); vykresliEditor(); zmeneno(true);
      });
      k.querySelector('.tab-pridat-fk').addEventListener('click', () => {
        const cil = stav.schema.tabulky.find(x => x !== t && x.sloupce.some(y => y.pk)) || t;
        const pk = cil.sloupce.find(y => y.pk) || cil.sloupce[0] || { nazev: 'id' };
        const s = J.novySloupec(unikatniNazev(t.sloupce.map(x => x.nazev), cil.nazev + '_' + pk.nazev), 'reference', { tabulka: cil.nazev, sloupec: pk.nazev });
        t.sloupce.push(s); otevrene.add(s); vykresliEditor(); zmeneno(true);
      });
    });
    $('souhrnSchematu').textContent = stav.schema.tabulky.length + ' tab. · ' + stav.schema.tabulky.reduce((a, t) => a + t.sloupce.length, 0) + ' sloupců';
    zobrazChybySchematu();
    vykresliVolbyExportu();
  }

  /* ================= Kontrola a rychlý náhled ================= */
  let kontrola = { chyby: [], varovani: [], poradi: [] };
  let casNahledu = null;
  function zmeneno(strukturalni) {
    verze++;
    uloz();
    clearTimeout(casNahledu);
    casNahledu = setTimeout(prepocitej, strukturalni ? 0 : 250);
  }

  function prepocitej() {
    kontrola = J.zkontrolujSchema(stav.schema);
    zobrazChybySchematu();
    const odh = kontrola.odhadRadku;
    $('odhad').textContent = odh ? '≈ ' + fmt(Math.round(odh), 0) + ' řádků' : '–';
    nahled = null;
    if (!kontrola.chyby.length) {
      try { const g = new J.Generator(stav.schema, { seed: stav.seed, limitRadku: NAHLED_RADKU }); g.vse(); nahled = { data: g.data }; }
      catch (e) { nahled = { chyba: e.message }; }
    } else nahled = { chyba: 'Schéma obsahuje chyby – opravte je (vlevo červeně).' };
    $('generovat').disabled = generujeSe || kontrola.chyby.length > 0;
    vykresliData();
  }

  function zobrazChybySchematu() {
    const k = kontrola;
    const globalni = k.chyby.filter(c => !c.tabulka).map(c => '<div>' + esc(c.zprava) + '</div>')
      .concat(k.varovani.filter(c => !c.tabulka).map(c => '<div class="varovani">' + esc(c.zprava) + '</div>'));
    $('chybySchematu').innerHTML = globalni.join('');
    document.querySelectorAll('.tab-karta').forEach(karta => {
      const t = stav.schema.tabulky[+karta.dataset.ti]; if (!t) return;
      const tn = String(t.nazev || '').trim();
      const proT = c => c.tabulka === tn || c.tabulka === '#' + (+karta.dataset.ti + 1);
      karta.querySelector('.tab-chyby').innerHTML = k.chyby.filter(c => proT(c) && !c.sloupec).map(c => '<div>' + esc(c.zprava) + '</div>').join('') +
        k.varovani.filter(c => proT(c) && !c.sloupec).map(c => '<div class="varovani">' + esc(c.zprava) + '</div>').join('');
      karta.querySelectorAll('details.sl').forEach(det => {
        const s = t.sloupce[+det.dataset.si]; if (!s) return;
        const sn = String(s.nazev || '').trim();
        const proS = c => proT(c) && (c.sloupec === sn || c.sloupec === '#' + (+det.dataset.si + 1));
        const ch = k.chyby.filter(proS), va = k.varovani.filter(proS);
        det.classList.toggle('ma-chybu', ch.length > 0);
        const st = det.querySelector('summary .stitek.chyba'); if (st) st.hidden = !ch.length;
        const box = det.querySelector('.sl-chyby');
        if (box) box.innerHTML = ch.map(c => '<div>' + esc(c.zprava) + '</div>').join('') + va.map(c => '<div class="varovani">' + esc(c.zprava) + '</div>').join('');
      });
    });
  }

  /* ================= Zobrazení dat ================= */
  function jeCiselny(druh) { return druh === 'cele' || druh === 'desetinne'; }
  function bunka(v, druh) {
    if (v === null || v === undefined) return '<td class="null">NULL</td>';
    let s;
    if (typeof v === 'boolean') s = v ? 'true' : 'false';
    else if (typeof v === 'number') s = fmt(v, 10);
    else s = String(v);
    const zobr = s.length > 80 ? s.slice(0, 80) + '…' : s;
    return '<td' + (typeof v === 'number' ? ' class="cislo"' : '') + (s.length > 30 || /\n/.test(s) ? ' title="' + esc(s) + '"' : '') + '>' + esc(zobr).replace(/\n/g, '↵') + '</td>';
  }
  function hlavicka(t, sloupce, druhy) {
    return '<thead><tr><th class="cislo">#</th>' + sloupce.map((n, i) => {
      const s = t && t.sloupce.find(x => x.nazev === n);
      const synt = s && J.TYPY[s.typ] && J.TYPY[s.typ].synteticke;
      return '<th' + (druhy && jeCiselny(druhy[i] && druhy[i].druh) ? ' class="cislo"' : '') + '>' + esc(n) + (synt ? '<span class="stitek synt" title="Syntetické – nepatří skutečné osobě">synt.</span>' : '') + '</th>';
    }).join('') + '</tr></thead>';
  }

  function vykresliData() {
    const maData = !!vysledek;
    if (!maData) rezimDat = 'nahled';
    $('rezimDat').innerHTML = maData
      ? '<button class="male" data-rezim="nahled" aria-pressed="' + (rezimDat === 'nahled') + '">Náhled schématu</button><button class="male" data-rezim="data" aria-pressed="' + (rezimDat === 'data') + '">Vygenerovaná data</button>'
      : '';
    const tabulky = rezimDat === 'data' ? vysledek.tabulky.map(t => ({ nazev: t.nazev, pocet: t.pocet }))
      : (nahled && nahled.data ? kontrola.poradi.filter(n => nahled.data[n]).map(n => ({ nazev: n, pocet: nahled.data[n].radky.length })) : []);
    if (!tabulky.some(t => t.nazev === vybranaTab)) { vybranaTab = tabulky.length ? tabulky[0].nazev : null; stranka = 0; }
    $('zalozky').innerHTML = tabulky.map(t => '<button role="tab" aria-selected="' + (t.nazev === vybranaTab) + '" aria-pressed="' + (t.nazev === vybranaTab) + '" data-tab="' + esc(t.nazev) + '">' + esc(t.nazev) + '<span class="pocet">' + fmt(t.pocet, 0) + '</span></button>').join('');
    const def = stav.schema.tabulky.find(t => t.nazev === vybranaTab);
    if (rezimDat === 'nahled') {
      $('stavDat').innerHTML = nahled && nahled.chyba
        ? '<span style="color:var(--text-chyba)">' + esc(nahled.chyba) + '</span>'
        : 'Rychlý náhled – prvních ' + NAHLED_RADKU + ' řádků každé tabulky se stejným seedem, přepočítává se při každé úpravě. ' +
          (maData ? '' : 'Plná data vytvoří tlačítko <b>Generovat</b>.');
      const d = nahled && nahled.data && vybranaTab ? nahled.data[vybranaTab] : null;
      $('nahled').innerHTML = d ? hlavicka(def, d.sloupce, d.druhy) + '<tbody>' + d.radky.map((r, i) => '<tr><td class="ix">' + (i + 1) + '</td>' + r.map((v, j) => bunka(v, d.druhy && d.druhy[j].druh)).join('') + '</tr>').join('') + '</tbody>' : '';
      $('obalNahledu').hidden = !d;
      $('strankovani').innerHTML = '';
      $('statistikyObal').hidden = true; $('integritaObal').hidden = true;
      return;
    }
    // plná data
    const zast = vysledek.verze !== verze || vysledek.seed !== stav.seed;
    $('stavDat').innerHTML = 'Vygenerováno <b>' + fmt(vysledek.radku, 0) + '</b> řádků v ' + vysledek.tabulky.length + ' tabulkách za ' + fmt(vysledek.cas / 1000, 2) + ' s (seed <code>' + esc(vysledek.seed) + '</code>). ' +
      (vysledek.integrita.ok ? '<span style="color:var(--text-ok)">Integrita v pořádku.</span>' : '<span style="color:var(--text-chyba)">Integrita porušena – viz níže.</span>') +
      (zast ? '<div class="stary"><b>Schéma nebo seed se od generování změnily.</b> Zobrazená data a export odpovídají předchozímu stavu – vygenerujte znovu.</div>' : '');
    const info = vysledek.tabulky.find(t => t.nazev === vybranaTab);
    $('obalNahledu').hidden = false;
    nactiStranku(info);
    // statistiky
    const st = vysledek.statistiky[vybranaTab] || [];
    $('statistikyObal').hidden = false;
    $('statistiky').innerHTML = '<thead><tr><th>Sloupec</th><th>Druh</th><th class="cislo">NULL</th><th class="cislo">Různých</th><th class="cislo">Min</th><th class="cislo">Max</th><th class="cislo">Průměr</th><th class="cislo">Sm. odch.</th><th class="cislo">Medián</th><th>Nejčastější</th></tr></thead><tbody>' +
      st.map(o => {
        const f = v => v === undefined || v === null ? '' : typeof v === 'number' ? fmt(v, 2) : esc(String(v).length > 24 ? String(v).slice(0, 24) + '…' : v);
        const druh = { cele: 'celé č.', desetinne: 'desetinné', datum: 'datum', datumcas: 'datum a čas', boolean: 'boolean', uuid: 'UUID', text: 'text' }[o.druh] || o.druh;
        const delka = o.delkaMin !== undefined ? ' (délka ' + o.delkaMin + '–' + o.delkaMax + ')' : '';
        const top = o.nejcastejsi ? o.nejcastejsi.map(([v, c]) => esc(String(v).slice(0, 20)) + ' <span style="color:var(--text-faint)">' + fmt(100 * c / o.pocet, 1) + ' %</span>').join(', ') : '<span style="color:var(--text-faint)">většinou různé</span>';
        return '<tr><td>' + esc(o.nazev) + '</td><td>' + druh + esc(delka) + '</td><td class="cislo">' + fmt(o.pocet ? 100 * o.nully / o.pocet : 0, 1) + ' %</td><td class="cislo">' + fmt(o.ruznych, 0) + '</td><td class="cislo">' + f(o.min) + '</td><td class="cislo">' + f(o.max) + '</td><td class="cislo">' + f(o.prumer) + '</td><td class="cislo">' + f(o.smerOdch) + '</td><td class="cislo">' + f(o.median) + '</td><td style="white-space:normal;min-width:180px">' + top + '</td></tr>';
      }).join('') + '</tbody>';
    // integrita (celé schéma)
    $('integritaObal').hidden = false;
    $('integrita').innerHTML = vysledek.integrita.polozky.map(p => {
      if (p.druh === 'fk') {
        return '<li class="' + (p.ok ? '' : 'spatne') + '"><b>' + esc(p.tabulka + '.' + p.sloupec) + '</b> → ' + esc(p.cil) + ' <span class="det">' +
          (p.chyba ? esc(p.chyba) : fmt(p.odkazu, 0) + ' odkazů, ' + fmt(p.sirotku, 0) + ' sirotků, NULL ' + fmt(p.nullu, 0) + ', použito ' + fmt(100 * p.pokrytiRodicu, 1) + ' % nadřazených řádků' + (p.priklady.length ? '; např. ' + esc(p.priklady.join(', ')) : '')) + '</span></li>';
      }
      return '<li class="' + (p.ok ? '' : 'spatne') + '"><b>' + esc(p.tabulka + '.' + p.sloupec) + '</b> ' + (p.druh === 'pk' ? 'primární klíč' : 'unikátní') + ' <span class="det">' +
        fmt(p.radku, 0) + ' řádků, duplicit ' + fmt(p.duplicit, 0) + (p.druh === 'pk' ? ', NULL ' + fmt(p.nullu, 0) : '') + '</span></li>';
    }).join('') || '<li class="det">Schéma nemá klíče ani cizí klíče.</li>';
  }

  let poslednipozadavek = 0;
  function nactiStranku(info) {
    if (!info) { $('nahled').innerHTML = ''; $('strankovani').innerHTML = ''; return; }
    const stranek = Math.max(1, Math.ceil(info.pocet / STRANKA));
    stranka = Math.min(stranka, stranek - 1);
    const id = ++poslednipozadavek;
    posli({ typ: 'radky', id, tabulka: info.nazev, od: stranka * STRANKA, pocet: STRANKA });
    $('strankovani').innerHTML = '<button class="male" data-str="0" ' + (stranka === 0 ? 'disabled' : '') + ' aria-label="První stránka">«</button>' +
      '<button class="male" data-str="' + (stranka - 1) + '" ' + (stranka === 0 ? 'disabled' : '') + '>‹ Předchozí</button>' +
      '<span>stránka <label class="sr-only" for="cisloStranky">Číslo stránky</label><input type="text" inputmode="numeric" id="cisloStranky" value="' + (stranka + 1) + '"> z ' + fmt(stranek, 0) + '</span>' +
      '<button class="male" data-str="' + (stranka + 1) + '" ' + (stranka >= stranek - 1 ? 'disabled' : '') + '>Další ›</button>' +
      '<button class="male" data-str="' + (stranek - 1) + '" ' + (stranka >= stranek - 1 ? 'disabled' : '') + ' aria-label="Poslední stránka">»</button>';
  }
  function zobrazRadky(z) {
    if (z.id !== poslednipozadavek || rezimDat !== 'data' || z.tabulka !== vybranaTab) return;
    const info = vysledek.tabulky.find(t => t.nazev === z.tabulka);
    const def = stav.schema.tabulky.find(t => t.nazev === z.tabulka);
    $('nahled').innerHTML = hlavicka(def, info.sloupce, info.druhy) + '<tbody>' + z.radky.map((r, i) => '<tr><td class="ix">' + fmt(z.od + i + 1, 0) + '</td>' + r.map((v, j) => bunka(v, info.druhy[j].druh)).join('') + '</tr>').join('') + '</tbody>';
  }

  $('rezimDat').addEventListener('click', e => { const b = e.target.closest('[data-rezim]'); if (!b) return; rezimDat = b.dataset.rezim; stranka = 0; vykresliData(); });
  $('zalozky').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (!b) return; vybranaTab = b.dataset.tab; stranka = 0; vykresliData(); });
  $('strankovani').addEventListener('click', e => {
    const b = e.target.closest('[data-str]'); if (!b || b.disabled) return;
    stranka = Math.max(0, +b.dataset.str); nactiStranku(vysledek.tabulky.find(t => t.nazev === vybranaTab));
  });
  $('strankovani').addEventListener('change', e => {
    if (e.target.id !== 'cisloStranky') return;
    const n = parseInt(e.target.value, 10); if (!(n >= 1)) return;
    stranka = n - 1; nactiStranku(vysledek.tabulky.find(t => t.nazev === vybranaTab));
  });

  /* ================= Generování ================= */
  function zobrazChybuGenerovani(z) { $('chybyGenerovani').innerHTML = z ? '<div>' + esc(z) + '</div>' : ''; }
  function ukonciBeh() {
    generujeSe = false; exportujeSe = false;
    $('generovat').disabled = kontrola.chyby.length > 0;
    $('zrusit').disabled = true;
    $('zrusitExport').hidden = true;
    $('stahnout').disabled = !vysledek;
  }

  $('generovat').addEventListener('click', () => {
    prepocitej();
    if (kontrola.chyby.length) { zobrazChybuGenerovani('Schéma obsahuje chyby – opravte je.'); return; }
    zobrazChybuGenerovani('');
    const id = ++uloha;
    generujeSe = true;
    $('generovat').disabled = true; $('zrusit').disabled = false; $('stahnout').disabled = true;
    $('prubeh').hidden = false; $('listaPrubehu').firstElementChild.style.width = '0%';
    $('prubehText').textContent = 'Spouštím…';
    posli({ typ: 'generuj', id, schema: stav.schema, seed: stav.seed, davka: stav.davka, verze });
    beh = { id, verze, seed: stav.seed, odhad: kontrola.odhadRadku || 1 };
  });
  let beh = null;
  $('zrusit').addEventListener('click', () => {
    if (!beh) return;
    posli({ typ: 'zrus', id: beh.id });
    $('prubehText').textContent = 'Ruším…';
  });

  function prijmi(z) {
    if (z.typ === 'radky') return zobrazRadky(z);
    if (!beh || z.id !== beh.id) {
      if (exportBeh && z.id === exportBeh.id) return prijmiExport(z);
      return;
    }
    if (z.typ === 'prubeh') {
      const pct = Math.min(99, 100 * z.radku / Math.max(z.radku, beh.odhad));
      $('listaPrubehu').firstElementChild.style.width = pct.toFixed(1) + '%';
      $('listaPrubehu').setAttribute('aria-valuenow', Math.round(pct));
      $('prubehText').textContent = 'Tabulka ' + (z.indexTabulky + 1) + ' z ' + z.pocetTabulek + ' (' + z.tabulka + ')' +
        (z.celkem !== null && z.celkem !== undefined ? ': ' + fmt(z.radek, 0) + ' / ' + fmt(z.celkem, 0) : '') +
        ' · celkem ' + fmt(z.radku, 0) + ' řádků · ' + fmt(z.cas / 1000, 1) + ' s';
    } else if (z.typ === 'hotovo') {
      vysledek = { verze: beh.verze, seed: beh.seed, tabulky: z.tabulky, statistiky: z.statistiky, integrita: z.integrita, cas: z.cas, radku: z.radku };
      $('listaPrubehu').firstElementChild.style.width = '100%';
      $('prubehText').textContent = 'Hotovo: ' + fmt(z.radku, 0) + ' řádků za ' + fmt(z.cas / 1000, 2) + ' s (' + fmt(Math.round(z.radku / Math.max(0.001, z.cas / 1000)), 0) + ' řádků/s) + statistiky ' + fmt((z.casCelkem - z.cas) / 1000, 2) + ' s.';
      beh = null; rezimDat = 'data'; stranka = 0;
      ukonciBeh(); vykresliData(); vykresliVolbyExportu();
    } else if (z.typ === 'chyba') {
      zobrazChybuGenerovani(z.zprava);
      $('prubehText').textContent = 'Generování skončilo chybou.';
      vysledek = null; beh = null; ukonciBeh(); vykresliData();
    } else if (z.typ === 'zruseno') {
      $('prubehText').textContent = 'Zrušeno.';
      vysledek = null; beh = null; ukonciBeh(); vykresliData();
    }
  }

  /* ================= Export ================= */
  let exportBeh = null;
  const MIME = { csv: 'text/csv;charset=utf-8', json: 'application/json;charset=utf-8', jsonl: 'application/x-ndjson;charset=utf-8', sqlite: 'application/sql;charset=utf-8', postgresql: 'application/sql;charset=utf-8' };
  const PRIPONA = { csv: 'csv', json: 'json', jsonl: 'jsonl', sqlite: 'sql', postgresql: 'sql' };
  function vykresliVolbyExportu() {
    const e = stav.export;
    e.format = e.format || 'csv';
    $('format').value = e.format;
    const tabs = vysledek ? vysledek.tabulky.map(t => t.nazev) : kontrola.poradi;
    const csv = e.format === 'csv';
    if (csv && (!e.tabulka || tabs.indexOf(e.tabulka) < 0)) e.tabulka = tabs[0] || '';
    $('exportTabulka').innerHTML = (csv ? '' : '<option value="">všechny (' + tabs.length + ')</option>') + tabs.map(n => '<option' + (n === e.tabulka ? ' selected' : '') + '>' + esc(n) + '</option>').join('');
    if (!csv && tabs.indexOf(e.tabulka) < 0) e.tabulka = '';
    $('exportTabulka').value = e.tabulka || '';
    const z = (k, l, vych) => '<label class="zaskrt"><input type="checkbox" data-volba="' + k + '"' + ((e[k] === undefined ? vych : e[k]) ? ' checked' : '') + '>' + l + '</label>';
    let h = '';
    if (csv) {
      h = '<div class="mrizka"><div><label for="oddelovac">Oddělovač</label><select id="oddelovac" data-volba="oddelovac">' +
        [[',', 'čárka ,'], [';', 'středník ;'], ['\t', 'tabulátor']].map(([v, n]) => '<option value="' + esc(v) + '"' + ((e.oddelovac || ',') === v ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></div>' +
        '<div style="align-self:end"><button class="male" id="predvolbaExcel" title="Středník, desetinná čárka, BOM">Předvolba: český Excel</button></div></div>' +
        '<div class="tlacitka">' + z('hlavicka', 'Hlavička', true) + z('desetinnaCarka', 'Desetinná čárka', false) + z('bom', 'BOM (UTF-8 pro Excel)', false) + z('ochranaVzorcu', 'Ochrana proti vzorcům', false) + '</div>';
    } else if (e.format === 'json') {
      h = '<div class="tlacitka">' + z('poznamka', 'Klíč „_poznamka“ o syntetických datech', true) + '</div>';
    } else if (e.format === 'jsonl') {
      h = '<div class="napoveda">Jeden JSON objekt na řádek. Při více tabulkách má každý řádek klíč <code>_tabulka</code>.</div>';
    } else {
      h = '<div class="mrizka"><div><label for="radkuNaInsert">Řádků na jeden INSERT</label><input type="text" inputmode="numeric" id="radkuNaInsert" data-volba="radkuNaInsert" value="' + esc(e.radkuNaInsert || 500) + '"></div></div>' +
        '<div class="tlacitka">' + z('createTable', 'CREATE TABLE', true) + z('dropTable', 'DROP TABLE IF EXISTS', false) + z('transakce', 'Transakce BEGIN/COMMIT', true) + z('poznamka', 'Komentář o syntetických datech', true) + '</div>' +
        '<div class="napoveda">Tabulky v pořadí podle cizích klíčů (nejdřív nadřazené). ' + (e.format === 'sqlite' ? 'Boolean jako 1/0, datumy jako text ISO 8601, <code>PRAGMA foreign_keys = ON</code>.' : 'Typy INTEGER/BIGINT, NUMERIC, BOOLEAN, DATE, TIMESTAMP, UUID, TEXT; <code>standard_conforming_strings = on</code>.') + '</div>';
    }
    $('volbyExportu').innerHTML = h;
    const ex = $('predvolbaExcel');
    if (ex) ex.addEventListener('click', () => { Object.assign(e, { oddelovac: ';', desetinnaCarka: true, bom: true }); uloz(); vykresliVolbyExportu(); });
    $('stahnout').disabled = !vysledek || generujeSe || exportujeSe;
    $('exportStav').textContent = vysledek ? '' : 'Nejdřív vygenerujte data.';
  }
  $('format').addEventListener('change', e => {
    if ((stav.export.format || 'csv') === 'csv' && e.target.value !== 'csv') stav.export.tabulka = '';
    stav.export.format = e.target.value; uloz(); vykresliVolbyExportu();
  });
  $('exportTabulka').addEventListener('change', e => { stav.export.tabulka = e.target.value; uloz(); });
  $('volbyExportu').addEventListener('change', e => {
    const k = e.target.dataset.volba; if (!k) return;
    if (e.target.type === 'checkbox') stav.export[k] = e.target.checked;
    else if (k === 'radkuNaInsert') { const n = parseInt(e.target.value, 10); stav.export[k] = n >= 1 && n <= 5000 ? n : 500; e.target.value = stav.export[k]; }
    else stav.export[k] = e.target.value;
    uloz();
  });

  $('stahnout').addEventListener('click', () => {
    if (!vysledek || exportujeSe) return;
    const e = stav.export; const f = e.format || 'csv';
    const m = {
      format: f === 'sqlite' || f === 'postgresql' ? 'sql' : f, dialekt: f === 'postgresql' ? 'postgresql' : 'sqlite',
      tabulky: e.tabulka ? [e.tabulka] : [],
      oddelovac: e.oddelovac || ',', hlavicka: e.hlavicka !== false, desetinnaCarka: !!e.desetinnaCarka, bom: !!e.bom, ochranaVzorcu: !!e.ochranaVzorcu,
      poznamka: e.poznamka !== false, createTable: e.createTable !== false, dropTable: !!e.dropTable, transakce: e.transakce !== false,
      radkuNaInsert: e.radkuNaInsert || 500,
    };
    const id = ++uloha;
    exportBeh = { id, nazev: 'testovaci_data_' + (e.tabulka || 'vse') + '_' + vysledek.seed, pripona: PRIPONA[f] };
    exportujeSe = true;
    $('stahnout').disabled = true; $('zrusitExport').hidden = false; $('generovat').disabled = true;
    $('exportStav').textContent = 'Připravuji…'; $('ukazkaExportu').hidden = true;
    posli({ typ: 'export', id, moznosti: m, mime: MIME[f] });
  });
  $('zrusitExport').addEventListener('click', () => { if (exportBeh) posli({ typ: 'zrus', id: exportBeh.id }); });

  function bezpecnyNazev(s) { return J.slug(s).replace(/-/g, '_').slice(0, 80) || 'data'; }
  function prijmiExport(z) {
    if (z.typ === 'export_prubeh') {
      $('exportStav').textContent = fmt(z.hotovo, 0) + ' / ' + fmt(z.celkem, 0) + ' řádků · ' + velikost(z.velikost);
    } else if (z.typ === 'export_hotovo') {
      const nazev = bezpecnyNazev(exportBeh.nazev) + '.' + exportBeh.pripona;
      const u = URL.createObjectURL(z.blob);
      const a = document.createElement('a'); a.href = u; a.download = nazev; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(u), 120000);
      $('exportStav').textContent = 'Staženo ' + nazev + ' (' + velikost(z.velikost) + ').';
      window.__posledniExport = z.blob;
      z.blob.slice(0, 3000).text().then(t => {
        const ukazka = $('ukazkaExportu'); ukazka.hidden = false;
        const radky = t.replace(/^﻿/, '').split('\n'); if (z.velikost > 3000) radky.pop();
        ukazka.textContent = radky.slice(0, 30).join('\n') + (z.velikost > 3000 || radky.length > 30 ? '\n…' : '');
      }).catch(() => {});
      exportBeh = null; ukonciBeh();
    } else if (z.typ === 'chyba') {
      $('exportStav').textContent = ''; zobrazChybuGenerovani('Export: ' + z.zprava); exportBeh = null; ukonciBeh();
    } else if (z.typ === 'zruseno') {
      $('exportStav').textContent = 'Export zrušen.'; exportBeh = null; ukonciBeh();
    }
  }
  function velikost(b) { return b < 1024 ? b + ' B' : b < 1048576 ? fmt(b / 1024, 1) + ' kB' : fmt(b / 1048576, 1) + ' MB'; }

  /* ================= Ovládání nahoře ================= */
  $('sablona').innerHTML = Object.keys(J.SABLONY).map(k => '<option value="' + k + '">' + esc(J.SABLONY[k].nazev) + '</option>').join('');
  $('nactiSablonu').addEventListener('click', async () => {
    if (!(await Dialog.potvrd('Nahradit současné schéma šablonou „' + J.SABLONY[$('sablona').value].nazev + '“?'))) return;
    stav.schema = normalizujSchema(J.SABLONY[$('sablona').value].schema());
    vykresliEditor(); zmeneno(true);
  });
  $('pridatTabulku').addEventListener('click', () => {
    const n = unikatniNazev(stav.schema.tabulky.map(t => t.nazev), 'tabulka' + (stav.schema.tabulky.length + 1));
    stav.schema.tabulky.push({ nazev: n, rezimRadku: 'pevny', radky: 100, minNaRodice: 1, maxNaRodice: 3, sloupce: [J.novySloupec('id', 'sekvence', { pk: true })] });
    vykresliEditor(); zmeneno(true);
    const posl = document.querySelector('.tab-karta:last-child'); if (posl) posl.scrollIntoView({ block: 'nearest' });
  });
  $('exportSchematu').addEventListener('click', () => {
    const b = new Blob([JSON.stringify({ format: 'generator-testovacich-dat', verze: 1, seed: stav.seed, schema: stav.schema }, null, 2)], { type: 'application/json' });
    const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = 'schema_testovacich_dat.json'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 60000);
  });
  $('importSchematuBtn').addEventListener('click', () => $('importSchematu').click());
  $('importSchematu').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try {
      const o = JSON.parse(await f.text());
      const sch = o.schema || o;
      if (!sch || !Array.isArray(sch.tabulky)) throw new Error('soubor neobsahuje pole „tabulky“');
      stav.schema = normalizujSchema(sch);
      if (typeof o.seed === 'string') { stav.seed = o.seed; $('seed').value = o.seed; }
      vykresliEditor(); zmeneno(true);
      Dialog.info('Schéma načteno.');
    } catch (x) { Dialog.chyba('Schéma se nepodařilo načíst: ' + x.message); }
  });
  $('seed').value = stav.seed;
  $('seed').addEventListener('input', e => { stav.seed = e.target.value; uloz(); clearTimeout(casNahledu); casNahledu = setTimeout(prepocitej, 250); });
  $('nahodnySeed').addEventListener('click', () => {
    const b = new Uint32Array(2);
    try { crypto.getRandomValues(b); } catch (x) { b[0] = Date.now(); b[1] = Math.random() * 1e9; }
    stav.seed = b[0].toString(36) + b[1].toString(36).slice(0, 4);
    $('seed').value = stav.seed; uloz(); prepocitej();
  });
  $('davka').value = String(stav.davka);
  $('davka').addEventListener('change', e => { stav.davka = +e.target.value; uloz(); });

  // nápověda funkcí
  $('seznamFunkci').innerHTML = Object.keys(J.FUNKCE).map(k => {
    const f = J.FUNKCE[k];
    const arg = f[0] === f[1] ? f[0] : f[0] + '–' + (f[1] > 10 ? '…' : f[1]);
    return '<dt>' + esc(k) + '(' + (k === 'nadrazeny' ? 'fk, "sloupec"' : k === 'kdyz' ? 'podmínka, ano, ne' : arg + ' arg.') + ')</dt><dd>' + esc(f[3]) + '</dd>';
  }).join('');

  vykresliEditor();
  prepocitej();
  ukonciBeh();

  // pro testy
  window.__td = { stav: () => stav, vysledek: () => vysledek, kontrola: () => kontrola, prepocitej, vykresliEditor, zmeneno };
})();

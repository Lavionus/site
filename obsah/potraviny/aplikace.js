/* ============================================================
   potraviny/aplikace.js – rozhraní Deníku jídla.
   Logika výpočtů je v jadro.js (DENIK_JADRO), grafy v grafy.js,
   čtečka kódů v ctecka.js. Stav se ukládá do localStorage
   (webapp_potraviny); databáze potravin se stahuje z data/*.json.
   Texty z databáze (názvy výrobků) se vkládají jen jako text.
   ============================================================ */
(function () {
  'use strict';
  const J = window.DENIK_JADRO;
  const G = window.DENIK_GRAFY;
  const KLIC = 'webapp_potraviny';
  const DATA = 'potraviny/data/';
  const D = typeof Dialog !== 'undefined' ? Dialog : {
    info: t => console.log(t), chyba: t => console.warn(t),
    potvrd: async t => window.confirm(t), zeptej: async (t, v) => window.prompt(t, v),
  };

  /* ================= stav ================= */
  let S = J.novyStav();
  let poskozeno = false;
  try {
    const t = localStorage.getItem(KLIC);
    if (t) S = J.normalizujStav(JSON.parse(t));
  } catch (e) {
    poskozeno = true;
    try { localStorage.setItem(KLIC + '_poskozeno_' + Date.now(), localStorage.getItem(KLIC) || ''); } catch (_) { /* nic */ }
  }
  let ulozTimer = null, chybaUlozeniHlasena = false, trvaleZadano = false;
  let ulozPodListou = false;   // uložení, ke kterému patří právě zobrazená lišta „Vrátit“
  function uloz(hned) {
    // jakákoli další změna zneplatní „Vrátit“ (obnova snímku by ji tiše zahodila)
    if (!ulozPodListou && typeof schovejListu === 'function') schovejListu();
    clearTimeout(ulozTimer); ulozTimer = null;
    const proved = () => {
      ulozTimer = null;
      try {
        localStorage.setItem(KLIC, JSON.stringify(S));
        chybaUlozeniHlasena = false;
        if (!trvaleZadano) { trvaleZadano = true; pozadejTrvaleUloziste(); }
      } catch (e) {
        if (!chybaUlozeniHlasena) D.chyba('Deník se nepodařilo uložit – úložiště prohlížeče je plné nebo zakázané. Stáhni si zálohu (záložka Data).');
        chybaUlozeniHlasena = true;
      }
    };
    if (hned) proved(); else ulozTimer = setTimeout(proved, 250);
  }
  // požádat prohlížeč, aby úložiště stránky nemazal při nedostatku místa / po nečinnosti (Safari)
  let trvaleUloziste = null;
  async function pozadejTrvaleUloziste() {
    try {
      if (!navigator.storage || !navigator.storage.persist) return;
      trvaleUloziste = (await navigator.storage.persisted()) || (await navigator.storage.persist());
    } catch (_) { /* nepodporováno */ }
  }
  addEventListener('pagehide', () => { if (ulozTimer) uloz(true); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && ulozTimer) uloz(true); });
  // změna v jiné záložce: rozepsanou vlastní změnu nepřepisovat; jinak převzít stav a zavřít rozdělané vrstvy
  addEventListener('storage', e => {
    if (e.key !== KLIC || !e.newValue) return;
    if (ulozTimer) { uloz(true); return; }
    schovejListu();
    try {
      S = J.normalizujStav(JSON.parse(e.newValue));
      obnovIndexUzivatele();
      if (vrstvy.length) { zavriVsechnyVrstvy(); D.info('Deník byl změněn v jiné záložce – zobrazuji aktuální stav.'); }
      // rozepsanou poznámku zachovat (text i kurzor) – zbytek deníku překreslit
      const akt = document.activeElement;
      const pise = akt && akt.closest && akt.closest('.poznamka-dne') ? { text: akt.value, a: akt.selectionStart, b: akt.selectionEnd } : null;
      vykresliVse();
      if (pise) {
        const ta = document.querySelector('.poznamka-dne textarea');
        if (ta) { ta.value = pise.text; J.den(S, aktivniDen).pozn = pise.text; ta.focus(); ta.setSelectionRange(pise.a, pise.b); }
      }
    } catch (_) { /* nic */ }
  });

  const DB = {
    nacteno: false, chyba: null, vyrobky: [], suroviny: [], podleEan: new Map(), podleId: new Map(),
    index: [], indexUziv: [], vse: [], meta: {}, ciselniky: { aditiva: {}, alergeny: {} }, slozeni: null,
  };

  let aktivniDen = J.datumKlic(new Date());
  let pohled = 'denik';
  let obdobi = 7;

  const NAZVY_SKUPIN_ZIVIN = { tuky: 'Mastné kyseliny a cholesterol', mineraly: 'Minerální látky', vitaminy: 'Vitaminy', ostatni: 'Ostatní' };
  /* ================= pomocné DOM ================= */
  function h(tag, atr, ...deti) {
    const e = document.createElement(tag);
    if (atr) for (const k in atr) {
      const v = atr[k];
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k === 'style' && typeof v === 'object') {
        for (const s in v) { if (s.startsWith('--')) e.style.setProperty(s, v[s]); else e.style[s] = v[s]; }
      }
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else if (k === 'dataset') Object.assign(e.dataset, v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const d of deti.flat()) {
      if (d === null || d === undefined || d === false) continue;
      e.appendChild(typeof d === 'object' ? d : document.createTextNode(String(d)));
    }
    return e;
  }
  // append bez null/undefined/false (nativní append by vložil text „null“)
  function pridat(el, ...deti) { for (const d of deti.flat()) if (d !== null && d !== undefined && d !== false) el.append(d); return el; }
  const $ = s => document.querySelector(s);
  const fc = (v, d) => J.formatCislo(v, d);
  const jedn = f => (f && f.ml ? 'ml' : 'g');
  function kcalText(v) { return Number.isFinite(v) ? fc(v, 0) + ' kcal' : '–'; }
  function ziv(k) { return J.ZIV[k]; }

  /* ================= vrstvy (sheety) ================= */
  const vrstvy = [];
  function otevriVrstvu({ titulek, telo, pata, hlavickaNavic, sirka, priZavreni, trida }) {
    const predFokus = document.activeElement;
    const pozadi = h('div', { class: 'sheet-pozadi' });
    const titulekEl = h('h2', { text: titulek || '' });
    const zavrit = h('button', { class: 'btn ikona plain', type: 'button', 'aria-label': 'Zavřít', title: 'Zavřít (Esc)', text: '✕' });
    const sheet = h('div', { class: 'sheet ' + (trida || ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': titulek || '' },
      h('div', { class: 'sheet-hl' }, titulekEl, hlavickaNavic || null, zavrit),
      telo, pata || null);
    if (sirka) sheet.style.width = 'min(' + sirka + ',100%)';
    pozadi.appendChild(sheet);
    zavriNabidku();
    if (lista && !lista.hidden) zobrazListu(false);   // lišta nesmí překrývat patičku vrstvy
    // obsah pod vrstvou je pro klávesnici a čtečky obrazovky neaktivní
    const podklad = vrstvy.length ? vrstvy[vrstvy.length - 1].pozadi : $('.wrap');
    podklad.inert = true;
    document.body.appendChild(pozadi);
    document.documentElement.style.overflow = 'hidden';
    const v = {
      pozadi, sheet, titulekEl,
      zavri() {
        const i = vrstvy.indexOf(v);
        if (i < 0) return;
        vrstvy.splice(i, 1);
        pozadi.remove();
        const horni = vrstvy.length ? vrstvy[vrstvy.length - 1].pozadi : $('.wrap');
        horni.inert = false;
        if (!vrstvy.length) { document.documentElement.style.overflow = ''; if (lista && listaVraceni) zobrazListu(true); }
        if (priZavreni) priZavreni();
        if (predFokus && document.contains(predFokus)) try { predFokus.focus(); } catch (_) { /* nic */ }
        if (!vrstvy.length) zkontrolujDen();
      },
    };
    zavrit.addEventListener('click', () => v.zavri());
    pozadi.addEventListener('mousedown', e => { if (e.target === pozadi) v.zavri(); });
    // Tab zůstává uvnitř vrstvy
    sheet.addEventListener('keydown', e => {
      if (e.key !== 'Tab') return;
      const prvky = [...sheet.querySelectorAll('button:not([disabled]), input:not([type=hidden]):not([disabled]), select, textarea, a[href], [tabindex="0"], summary')]
        .filter(x => x.offsetParent !== null || x === document.activeElement);
      if (!prvky.length) return;
      const i = prvky.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); prvky[prvky.length - 1].focus(); }
      else if (!e.shiftKey && i === prvky.length - 1) { e.preventDefault(); prvky[0].focus(); }
    });
    vrstvy.push(v);
    // výchozí fokus: volající ho obvykle nastaví sám (pole); jinak zavírací tlačítko, aby se dialog ohlásil
    setTimeout(() => { if (vrstvy.includes(v) && !sheet.contains(document.activeElement)) zavrit.focus(); }, 60);
    return v;
  }
  function zavriVsechnyVrstvy() { while (vrstvy.length) vrstvy[vrstvy.length - 1].zavri(); }
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || (window.DENIK_CTECKA && DENIK_CTECKA.jeOtevrena()) || document.querySelector('dialog[open]')) return;
    if (otevrenaNabidka) { e.preventDefault(); zavriNabidku(true); return; }
    if (vrstvy.length) { e.preventDefault(); vrstvy[vrstvy.length - 1].zavri(); }
  });

  /* ----- „Vrátit“: snímek stavu před změnou a lišta s tlačítkem ----- */
  let lista = null, listaCas = null, listaVraceni = null;
  // zmena() provede akci; „Vrátit“ obnoví stav před ní – jen dokud nedošlo k jiné změně (uloz() lištu zruší)
  function sVracenim(popis, zmena) {
    const pred = JSON.stringify(S);
    zmena();
    obnovIndexUzivatele(); vykresliPohled();
    ulozSListou(popis, () => {
      S = J.normalizujStav(JSON.parse(pred));
      uloz(true); obnovIndexUzivatele(); vykresliVse();
    });
  }
  // uloží stav a ukáže lištu; naVraceni dostane stav, ve kterém lištu ukázala
  function ulozSListou(popis, naVraceni) {
    ulozPodListou = true;
    try { uloz(); } finally { ulozPodListou = false; }
    ukazListu(popis, naVraceni);
  }
  function ukazListu(popis, naVraceni) {
    if (!lista) {
      lista = h('div', { class: 'lista-vratit', role: 'status', 'aria-live': 'polite' });
      // časovač stojí, dokud je nad lištou myš nebo v ní fokus (čas na rozmyšlenou)
      lista.addEventListener('mouseenter', () => clearTimeout(listaCas));
      lista.addEventListener('focusin', () => clearTimeout(listaCas));
      lista.addEventListener('mouseleave', () => { if (!lista.contains(document.activeElement)) naplanujSchovani(); });
      lista.addEventListener('focusout', e => { if (!lista.contains(e.relatedTarget)) naplanujSchovani(); });
      document.body.appendChild(lista);
    }
    lista.textContent = '';
    listaVraceni = naVraceni;
    const tl = h('button', { class: 'btn mini', type: 'button', title: 'Vrátit (Ctrl+Z)' }, '↶ Vrátit');
    tl.addEventListener('click', vratitPosledni);
    lista.append(h('span', { text: popis }), tl);
    zobrazListu(!vrstvy.length);
    naplanujSchovani();
  }
  function zobrazListu(vidi) {
    if (!lista) return;
    lista.hidden = !vidi;
    document.body.classList.toggle('ma-listu', !!vidi);
  }
  function naplanujSchovani() { clearTimeout(listaCas); listaCas = setTimeout(schovejListu, 12000); }
  function vratitPosledni() {
    if (!listaVraceni) return;
    const f = listaVraceni;
    schovejListu();
    f();
    D.info('Vráceno.');
    const cil = $('#denPopis');
    if (pohled === 'denik' && cil && !vrstvy.length) cil.focus();
  }
  function vratPridani(den, id) {
    if (J.smazZaznam(S, den, id)) { uloz(); vykresliPohled(); }
    else D.info('Záznam se mezitím změnil – nic nebylo vráceno.');
  }
  function schovejListu() {
    clearTimeout(listaCas);
    listaVraceni = null;
    if (lista) { if (lista.contains(document.activeElement)) document.activeElement.blur(); zobrazListu(false); }
  }

  /* ----- přechod přes půlnoc: když uživatel sledoval „dnešek“, přepnout na nový den ----- */
  let znamyDnes = J.datumKlic(new Date());
  function zkontrolujDen() {
    const dnes = J.datumKlic(new Date());
    if (dnes === znamyDnes) return;
    const fv = document.getElementById('formVaha');
    if (fv && fv.datum.value === znamyDnes) fv.datum.value = dnes;
    const sledovalDnes = aktivniDen === znamyDnes;
    znamyDnes = dnes;
    if (vrstvy.length) { znamyDnes = J.posunDen(dnes, -1); return; }  // zkusí se znovu po zavření vrstvy
    if (sledovalDnes) aktivniDen = dnes;
    vykresliPohled();
  }

  /* rozbalovací nabídka */
  let otevrenaNabidka = null;
  let nabidkaTlacitko = null;
  function nabidka(tlacitko, polozky) {
    zavriNabidku();
    nabidkaTlacitko = tlacitko;
    tlacitko.setAttribute('aria-expanded', 'true');
    const r = tlacitko.getBoundingClientRect();
    const m = h('div', { class: 'karta', role: 'menu', style: {
      position: 'fixed', zIndex: 150, minWidth: '230px', padding: '6px', boxShadow: 'var(--shadow)',
      background: 'var(--bg-elevated)', top: Math.min(innerHeight - 20, r.bottom + 4) + 'px',
    } });
    for (const p of polozky) {
      if (p === '-') { m.appendChild(h('div', { style: { borderTop: '1px solid var(--border)', margin: '5px 0' } })); continue; }
      m.appendChild(h('button', {
        class: 'btn plain', role: 'menuitem', type: 'button', style: { width: '100%', justifyContent: 'flex-start' },
        onclick: () => { zavriNabidku(true); p.akce(); },
      }, p.text));
      if (p.nebezpecne) m.lastChild.classList.add('danger');
    }
    document.body.appendChild(m);
    const sirka = m.offsetWidth;
    m.style.left = Math.max(6, Math.min(innerWidth - sirka - 6, r.right - sirka)) + 'px';
    const vyska = m.offsetHeight;
    if (r.bottom + 4 + vyska > innerHeight) m.style.top = Math.max(6, r.top - vyska - 4) + 'px';
    otevrenaNabidka = m;
    m.querySelector('button').focus();
    // šipky mezi položkami, Tab zavře
    m.addEventListener('keydown', e => {
      const b = [...m.querySelectorAll('button')];
      const i = b.indexOf(document.activeElement);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); b[(i + (e.key === 'ArrowDown' ? 1 : b.length - 1)) % b.length].focus(); }
      else if (e.key === 'Home') { e.preventDefault(); b[0].focus(); }
      else if (e.key === 'End') { e.preventDefault(); b[b.length - 1].focus(); }
      else if (e.key === 'Tab') { zavriNabidku(); }
    });
    setTimeout(() => {
      document.addEventListener('mousedown', mimoNabidku);
      addEventListener('scroll', zavriNabidkuUdalosti, true);
      addEventListener('resize', zavriNabidkuUdalosti);
    }, 0);
  }
  function mimoNabidku(e) { if (otevrenaNabidka && !otevrenaNabidka.contains(e.target)) zavriNabidku(); }
  function zavriNabidkuUdalosti(e) { if (otevrenaNabidka && !(e && e.target && e.target.nodeType === 1 && otevrenaNabidka.contains(e.target))) zavriNabidku(); }
  function zavriNabidku(vratitFokus) {
    if (otevrenaNabidka) { otevrenaNabidka.remove(); otevrenaNabidka = null; }
    if (nabidkaTlacitko) {
      nabidkaTlacitko.setAttribute('aria-expanded', 'false');
      if (vratitFokus && document.contains(nabidkaTlacitko)) nabidkaTlacitko.focus();
      nabidkaTlacitko = null;
    }
    document.removeEventListener('mousedown', mimoNabidku);
    removeEventListener('scroll', zavriNabidkuUdalosti, true);
    removeEventListener('resize', zavriNabidkuUdalosti);
  }

  /* ================= databáze ================= */
  function stav(text, chyba) {
    const el = $('#dataStav');
    el.textContent = '';
    if (chyba) {
      pridat(el, h('span', { class: 'chyba-text', text }), ' ', h('button', { class: 'btn mini', onclick: nactiDatabazi, text: 'Zkusit znovu' }));
    } else el.textContent = text;
  }
  async function stahni(soubor) {
    const r = await fetch(DATA + soubor, { cache: 'no-cache' }).catch(() => null) || await fetch(DATA + soubor);
    if (!r.ok) throw new Error(soubor + ': HTTP ' + r.status);
    return r.json();
  }
  let databazeSlib = null;
  function nactiDatabazi() {
    if (!databazeSlib) databazeSlib = nactiDatabaziInterne().finally(() => { databazeSlib = null; });
    return databazeSlib;
  }
  async function nactiDatabaziInterne() {
    DB.chyba = null;
    stav('');
    $('#dataStav').append(h('span', { class: 'nacitani' }), ' načítám databázi…');
    try {
      const [v, s, c] = await Promise.all([stahni('vyrobky.json'), stahni('suroviny.json'), stahni('ciselniky.json')]);
      DB.vyrobky = v.radky.map(J.vyrobekZRadku);
      DB.suroviny = s.radky.map(J.surovinaZRadku);
      DB.meta = { vyrobky: v.zdroj, statistika: v.statistika, suroviny: s.zdroj, ciselniky: c.zdroj };
      DB.ciselniky = { aditiva: c.aditiva || {}, alergeny: c.alergeny || {} };
      DB.podleEan.clear(); DB.podleId.clear();
      for (const f of DB.vyrobky) { DB.podleEan.set(f.ean, f); DB.podleId.set(f.id, f); }
      for (const f of DB.suroviny) DB.podleId.set(f.id, f);
      DB.index = J.vytvorIndex(DB.suroviny.concat(DB.vyrobky));
      DB.nacteno = true;
      obnovIndexUzivatele();
      stav(fc(DB.vyrobky.length) + ' výrobků · ' + DB.suroviny.length + ' potravin');
      document.dispatchEvent(new Event('denik-data'));
    } catch (e) {
      DB.chyba = e;
      stav('Databázi se nepodařilo načíst (' + e.message + ').', true);
      document.dispatchEvent(new Event('denik-data-chyba'));
    }
  }
  function obnovIndexUzivatele() {
    const f = Object.values(S.vlastni).concat(Object.values(S.recepty).map(J.receptJakoPotravina), Object.values(S.cache || {}));
    DB.indexUziv = J.vytvorIndex(f);
    DB.vse = DB.indexUziv.concat(DB.index);
  }
  let slozeniSlib = null;
  function nactiSlozeni() {
    if (!slozeniSlib) slozeniSlib = stahni('slozeni.json').then(x => (DB.slozeni = x.data)).catch(e => { slozeniSlib = null; throw e; });
    return slozeniSlib;
  }
  // aktuální podoba potraviny podle id (nebo null)
  function potravina(id) {
    if (!id) return null;
    if (id[0] === 'm') return S.vlastni[id] || null;
    if (id[0] === 'r') return S.recepty[id] ? J.receptJakoPotravina(S.recepty[id]) : null;
    if (id[0] === 'v') return DB.podleId.get(id) || (S.cache && S.cache[id.slice(1)]) || null;
    return DB.podleId.get(id) || null;
  }
  function podleEan(kod) {
    for (const v of J.eanVarianty(kod)) {
      const m = Object.values(S.vlastni).find(f => f.ean === v);
      if (m) return m;
      if (DB.podleEan.has(v)) return DB.podleEan.get(v);
      if (S.cache && S.cache[v]) return S.cache[v];
    }
    return null;
  }
  // dotaz na Open Food Facts (jen jednotlivě po naskenování, s omezením četnosti)
  const dotazyOff = [];
  async function hledejOnline(kod) {
    if (!S.nastaveni.online || !navigator.onLine) return null;
    const ted = Date.now();
    while (dotazyOff.length && ted - dotazyOff[0] > 60000) dotazyOff.shift();
    if (dotazyOff.length >= 10) throw new Error('Příliš mnoho dotazů na Open Food Facts – zkus to za minutu.');
    dotazyOff.push(ted);
    const pole = 'code,product_name,product_name_cs,product_name_sk,product_name_en,generic_name,generic_name_cs,brands,quantity,product_quantity,product_quantity_unit,serving_size,serving_quantity,nutriments,nutriscore_grade,nova_group,ingredients_text,ingredients_text_cs,allergens_tags,traces_tags';
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 9000);
    try {
      const r = await fetch('https://world.openfoodfacts.org/api/v2/product/' + encodeURIComponent(kod) + '?fields=' + pole,
        { signal: ctrl.signal, headers: { 'X-User-Agent': 'DenikJidla/1.0 (lavionus.github.io)' } });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error('Open Food Facts odpověděl chybou ' + r.status);
      const x = await r.json();
      if (x.status !== 1 || !x.product) return null;
      const f = J.vyrobekZOff(x.product, kod);
      if (!f) return null;
      S.cache[f.ean] = f;
      uloz();
      obnovIndexUzivatele();
      return f;
    } catch (e) {
      if (e.name === 'AbortError') throw new Error('Open Food Facts neodpovídá.');
      throw e;
    } finally { clearTimeout(t); }
  }

  /* ================= cíle ================= */
  function cileDne(k) { return J.cile(S.profil, k || aktivniDen); }
  function jidla() { return S.nastaveni.jidla.filter(j => !j.skryto); }
  function nazevJidla(id) { const j = S.nastaveni.jidla.find(x => x.id === id); return j ? j.nazev : 'Ostatní'; }
  function vychoziJidlo() {
    const hod = new Date().getHours();
    const pref = hod < 10 ? 'snidane' : hod < 12 ? 'svacina1' : hod < 15 ? 'obed' : hod < 18 ? 'svacina2' : hod < 21 ? 'vecere' : 'druha';
    const vid = jidla();
    return (vid.find(j => j.id === pref) || vid[0] || S.nastaveni.jidla[0]).id;
  }

  /* ================= přepínání pohledů ================= */
  function prepni(v) {
    if (v === 'statistiky' && pohled !== 'statistiky') kalendarMesic = null;   // kalendář po příchodu na záložku od aktuálního měsíce
    pohled = v;
    document.body.classList.toggle('pohled-denik', v === 'denik');
    document.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-selected', String(t.dataset.v === v)));
    document.querySelectorAll('main > section').forEach(s => { s.hidden = s.id !== 'v-' + v; });
    try { sessionStorage.setItem(KLIC + '_pohled', v); } catch (_) { /* nic */ }
    vykresliPohled();
  }
  function vykresliPohled() {
    if (pohled === 'denik') vykresliDenik();
    else if (pohled === 'potraviny') vykresliPotraviny();
    else if (pohled === 'statistiky') vykresliStatistiky();
    else if (pohled === 'profil') vykresliProfil();
    else if (pohled === 'data') vykresliData();
  }
  function vykresliVse() { vykresliPohled(); }

  /* ================= DENÍK ================= */
  function popisMnozstvi(z, f) {
    const j = jedn(f);
    if (z.rychly) return 'rychlý záznam';
    if (z.porce && z.porce.pocet) return fc(z.porce.pocet, 2) + ' × ' + z.porce.n + ' (' + fc(z.g, 0) + ' ' + j + ')';
    return fc(z.g, 1) + ' ' + j;
  }
  function vykresliDenik() {
    const dnes = J.datumKlic(new Date());
    $('#denPopis').textContent = J.popisDne(aktivniDen, dnes);
    $('#denVyber').value = aktivniDen;
    $('#denDnes').hidden = aktivniDen === dnes;
    const ser = J.serie(S, dnes);
    $('#serie').textContent = ser > 1 ? '🔥 ' + J.pocet(ser, 'den', 'dny', 'dní') + ' v řadě' : '';
    const d = S.dny[aktivniDen] || { z: [], voda: 0, pohyb: [] };
    const soub = J.souhrnDne(S, aktivniDen);
    const kont = $('#jidla');
    kont.textContent = '';
    if (poskozeno) kont.appendChild(h('div', { class: 'upozorneni' }, 'Uložená data deníku byla poškozená a nešla načíst. Kopie byla odložena v úložišti prohlížeče; začínáš s prázdným deníkem.'));
    pripomenutiZalohy(kont);
    const viditelna = jidla().map(j => j.id);
    // jídla se záznamy, která jsou skrytá nebo smazaná, se zobrazí také
    for (const z of d.z) if (!viditelna.includes(z.j)) viditelna.push(z.j);
    for (const jid of viditelna) {
      const zaznamy = d.z.filter(z => z.j === jid);
      const s = soub.jidla[jid] || {};
      const karta = h('section', { class: 'karta jidlo', 'aria-label': nazevJidla(jid) });
      const hl = h('div', { class: 'jidlo-hl' },
        h('h2', {}, h('span', { class: 'jidlo-ik', 'aria-hidden': 'true', text: IKONY_JIDEL[jid] || '🍽️' }), nazevJidla(jid)),
        zaznamy.length ? h('span', { class: 'jidlo-makra', title: 'bílkoviny / sacharidy / tuky' },
          'B ' + fc(s.bilkoviny, 0) + ' · S ' + fc(s.sacharidy, 0) + ' · T ' + fc(s.tuk, 0)) : null,
        h('span', { class: 'jidlo-kcal', text: zaznamy.length ? fc(s.kcal || 0, 0) + ' kcal' : '' }),
        // na telefonu jsou přidání a skenování přímo v záhlaví (patička jídla je skrytá)
        h('button', { class: 'btn ikona plain jen-mobil', type: 'button', 'aria-label': 'Naskenovat do jídla ' + nazevJidla(jid), onclick: () => skenuj({ jidlo: jid }) }, '📷'),
        h('button', { class: 'btn ikona plain jen-mobil', type: 'button', 'aria-label': 'Přidat do jídla ' + nazevJidla(jid), style: { fontSize: '1.5rem', color: 'var(--accent)' }, onclick: () => otevriPridani({ jidlo: jid }) }, '+'),
        h('button', { class: 'btn ikona plain', type: 'button', 'aria-label': 'Další akce – ' + nazevJidla(jid), 'aria-haspopup': 'menu', 'aria-expanded': 'false', text: '⋯',
          onclick: e => nabidkaJidla(e.currentTarget, jid, zaznamy) }));
      karta.appendChild(hl);
      if (zaznamy.length) {
        const ul = h('ul', { class: 'zaznamy' });
        for (const z of zaznamy) {
          const f = S.potraviny[z.p];
          if (!f) continue;
          const v = J.zivinyZa(f.n, z.g);
          const li = h('li', {
            class: 'zaznam', tabindex: '0', role: 'button', 'aria-label': f.nazev + ', ' + popisMnozstvi(z, f) + ', ' + kcalText(v.kcal),
            onclick: () => { if (!li._potlacitKlik) upravZaznam(aktivniDen, z.id); },
            onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); upravZaznam(aktivniDen, z.id); } },
          },
          h('div', { class: 'nazev' },
            h('div', {}, f.nazev),
            h('div', { class: 'detail' }, [f.znacka, popisMnozstvi(z, f)].filter(Boolean).join(' · '))),
          h('span', { class: 'kc', text: kcalText(v.kcal) }));
          prejetiSmazat(li, () => { const den = aktivniDen; sVracenim('Smazáno: ' + f.nazev, () => J.smazZaznam(S, den, z.id)); });
          ul.appendChild(li);
        }
        karta.appendChild(ul);
      } else karta.appendChild(h('div', { class: 'jidlo-prazdne', text: 'Zatím nic.' }));
      // „obvykle“: časté potraviny tohoto jídla, které tu dnes ještě nejsou – přidání jedním klepnutím
      const uz = new Set(zaznamy.map(z => (S.potraviny[z.p] || {}).id));
      const navrhy = J.castePrJidlo(S, jid, aktivniDen, 60, 4).filter(x => !uz.has(x.f.id));
      if (navrhy.length) {
        karta.appendChild(h('div', { class: 'navrhy', role: 'group', 'aria-label': 'Obvykle v jídle ' + nazevJidla(jid) },
          ...navrhy.map(x => {
            const ff = potravina(x.f.id) || x.f;
            const mn = x.porce && x.porce.pocet ? fc(x.porce.pocet, 2) + ' × ' + x.porce.n : fc(x.g) + ' ' + jedn(ff);
            return h('button', { class: 'navrh', type: 'button', title: 'Přidat ' + ff.nazev + ' (' + mn + ')', 'aria-label': 'Přidat ' + ff.nazev + ', ' + mn,
              onclick: () => rychlePridej(ff, x.g, x.porce, aktivniDen, jid) }, '+ ', h('span', { text: ff.nazev }), h('small', { text: mn }));
          })));
      }
      karta.appendChild(h('div', { class: 'jidlo-pata' },
        h('button', { class: 'btn mini', type: 'button', onclick: () => otevriPridani({ jidlo: jid }) }, '+ Přidat'),
        h('button', { class: 'btn mini', type: 'button', title: 'Naskenovat čárový kód', onclick: () => skenuj({ jidlo: jid }) }, '📷 Skenovat'),
        h('button', { class: 'btn mini plain', type: 'button', onclick: () => rychlyZaznam(jid) }, '⚡ Rychlý záznam')));
      kont.appendChild(karta);
    }
    // pohyb a poznámka
    const pohybKarta = h('section', { class: 'karta jidlo pohyb-karta', 'aria-label': 'Pohyb' },
      h('div', { class: 'jidlo-hl' }, h('h2', { text: '🏃 Pohyb' }),
        h('span', { class: 'jidlo-kcal', text: soub.pohyb ? '−' + fc(soub.pohyb) + ' kcal' : '' })));
    if (d.pohyb && d.pohyb.length) {
      const ul = h('ul', { class: 'zaznamy' });
      for (const p of d.pohyb) {
        ul.appendChild(h('li', { class: 'zaznam', tabindex: '0', role: 'button', onclick: () => upravPohyb(p.id),
          onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); upravPohyb(p.id); } } },
        h('div', { class: 'nazev' }, h('div', {}, p.nazev || 'Aktivita'), p.minuty ? h('div', { class: 'detail', text: p.minuty + ' min' }) : null),
        h('span', { class: 'kc', text: fc(p.kcal) + ' kcal' })));
      }
      pohybKarta.appendChild(ul);
    }
    pohybKarta.appendChild(h('div', { class: 'jidlo-pata' }, h('button', { class: 'btn mini', type: 'button', onclick: () => upravPohyb(null) }, '+ Přidat pohyb')));
    kont.appendChild(pohybKarta);
    const pozn = h('textarea', { class: 'vstup', placeholder: 'Poznámka ke dni (jak ses cítil, hlad, spánek…)', 'aria-label': 'Poznámka ke dni', maxlength: '2000' });
    pozn.value = d.pozn || '';
    pozn.addEventListener('input', () => { const dd = J.den(S, aktivniDen); dd.pozn = pozn.value; uloz(); });
    kont.appendChild(h('section', { class: 'karta poznamka-dne' }, h('h2', { text: '📝 Poznámka' }), pozn));
    vykresliSouhrn(soub);
  }

  function pripomenutiZalohy(kont) {
    const dny = Object.values(S.dny).filter(d => d.z.length).length;
    const posl = S.nastaveni.zaloha ? J.rozdilDni(S.nastaveni.zaloha, J.datumKlic(new Date())) : null;
    // „Nepřipomínat“ platí 60 dní – data jsou jen v prohlížeči, úplně zapomenout na zálohu je riskantní
    if (S.nastaveni.skrytZalohu === true) S.nastaveni.skrytZalohu = J.datumKlic(new Date());   // starší „navždy“ → odteď
    const skryto = typeof S.nastaveni.skrytZalohu === 'string' && J.zKlice(S.nastaveni.skrytZalohu) && J.rozdilDni(S.nastaveni.skrytZalohu, J.datumKlic(new Date())) < 7;
    if (dny >= 5 && (posl === null || posl > 14) && !skryto) {
      kont.appendChild(h('div', { class: 'upozorneni info' },
        posl === null ? 'Deník ještě nemá zálohu. ' : 'Poslední záloha je stará ' + J.pocet(posl, 'den', 'dny', 'dní') + '. ',
        'Data jsou jen v tomto prohlížeči. ',
        h('button', { class: 'btn mini', type: 'button', onclick: stahniZalohu }, 'Stáhnout zálohu'), ' ',
        h('button', { class: 'btn mini plain', type: 'button', onclick: () => { S.nastaveni.skrytZalohu = J.datumKlic(new Date()); uloz(); vykresliDenik(); } }, 'Teď ne')));
    }
  }

  function vykresliSouhrn(soub) {
    const c = cileDne();
    const el = $('#souhrn');
    el.textContent = '';
    const snedeno = soub.celkem.kcal || 0;
    const pohybKcal = S.nastaveni.pohybKCili ? soub.pohyb : 0;
    const cilKcal = c.kcal ? c.kcal + pohybKcal : null;
    const kruh = h('div', {});
    const bil = h('div', { class: 'bilance' });
    el.appendChild(h('div', { class: 'souhrn-hlavni' }, kruh, bil));
    G.kruh(kruh, snedeno, cilKcal, { popis: 'Energie dne' });
    if (cilKcal) {
      const zbyva = cilKcal - snedeno;
      pridat(bil, 
        h('div', { class: 'zbyva ' + (zbyva < 0 ? 'chyba-text' : '') }, zbyva >= 0 ? 'Zbývá ' + fc(zbyva) + ' kcal' : 'Přes cíl o ' + fc(-zbyva) + ' kcal'),
        h('div', {}, 'Cíl ', h('b', { text: fc(c.kcal) }), ' kcal'),
        pohybKcal ? h('div', {}, '+ pohyb ', h('b', { text: fc(pohybKcal) }), ' kcal') : null,
        h('div', {}, 'Snědeno ', h('b', { text: fc(snedeno) }), ' kcal'));
    } else {
      pridat(bil, h('div', {}, 'Snědeno ', h('b', { text: fc(snedeno) }), ' kcal'),
        h('div', { class: 'slabe' }, 'Vyplň profil a uvidíš svůj denní cíl. '),
        h('button', { class: 'btn mini', type: 'button', onclick: () => prepni('profil') }, '🎯 Nastavit cíl'));
    }
    const mk = h('div', { class: 'makra' });
    const radekMakra = (nazev, kl, barva) => {
      const v = soub.celkem[kl] || 0, cil = c.zivinyCil[kl];
      const pod = cil ? Math.min(100, 100 * v / cil) : 0;
      return h('div', {},
        h('div', { class: 'mbar-hl' }, h('span', { text: nazev }), h('span', { text: fc(v) + (cil ? ' / ' + fc(cil) : '') + ' g' })),
        h('div', { class: 'mbar' + (cil && v > cil * 1.1 ? ' nad' : ''), role: 'progressbar', 'aria-label': nazev, 'aria-valuenow': String(Math.round(v)), 'aria-valuemax': cil ? String(Math.round(cil)) : null },
          h('i', { style: { width: pod + '%', background: barva } })));
    };
    pridat(mk, radekMakra('Bílkoviny', 'bilkoviny', 'var(--c-bil)'), radekMakra('Sacharidy', 'sacharidy', 'var(--c-sach)'), radekMakra('Tuky', 'tuk', 'var(--c-tuk)'));
    el.appendChild(mk);
    const lim = (nazev, kl, max, min, d, jed, mekce, popis) => {
      const v = soub.celkem[kl] || 0;
      const hrana = max || min;
      const j = jed || 'g';
      const nad = max && v > max;
      return h('div', { title: popis || (max ? 'nejvýše ' + fc(max, d || 0) + ' ' + j : min ? 'aspoň ' + fc(min, d || 0) + ' ' + j : null) }, h('span', { text: nazev }),
        h('b', { class: nad ? (mekce ? 'warn-text' : 'chyba-text') : (min && v >= min ? 'ok-text' : ''), text: fc(v, d || 0) + (hrana ? ' / ' + fc(hrana, d || 0) : '') + ' ' + j }));
    };
    el.appendChild(h('div', { class: 'limity' },
      lim('Vláknina', 'vlaknina', null, c.zivinyCil.vlaknina),
      lim('Cukry celkem', 'cukry', c.limity.cukry, null, 0, 'g', true,
        'Orientační: WHO doporučuje volné (přidané) cukry pod 10 % energie. Etikety uvádějí všechny cukry včetně přirozených z ovoce a mléka, proto se limit jen zvýrazní.'),
      lim('Nasycené MK', 'nasycene', c.limity.nasycene),
      lim('Sůl', 'sul', c.limity.sul, null, 1),
      (soub.celkem.kof || 0) > 0 ? lim('Kofein', 'kof', 400, null, 0, 'mg', false, 'EFSA: do 400 mg denně je pro dospělé bezpečné (v těhotenství 200 mg). Kofein je uveden jen u části potravin.') : null,
      null));
    // voda
    const cilVoda = Math.round((c.vodaMl || 2000) * 0.8 / 250) * 250; // ~80 % vody z nápojů
    const napoje = soub.napoje || 0;
    const voda = (soub.voda || 0) + napoje;
    const casteN = J.casteNapoje(S, aktivniDen, 30, 3);
    const skl = h('div', { class: 'voda-sklenice', 'aria-hidden': 'true' });
    for (let i = 0; i < Math.max(cilVoda, voda) / 250; i++) skl.appendChild(h('span', { class: i < voda / 250 ? 'plna' : '' }));
    const pridejVodu = ml => { const dd = J.den(S, aktivniDen); dd.voda = Math.max(0, (dd.voda || 0) + ml); uloz(); vykresliDenik(); };
    el.appendChild(h('div', { class: 'voda' },
      h('div', { class: 'voda-hl' }, h('span', {}, '💧 Pitný režim'), h('b', { text: fc(voda / 1000, 2) + ' / ' + fc(cilVoda / 1000, 1) + ' l' })),
      skl,
      napoje || soub.tekute.kcal >= 1 ? h('div', { class: 'slabe', style: { margin: '-4px 0 6px' }, text: [
        napoje ? 'z toho ' + fc(napoje) + ' ml z nápojů v deníku' : '',
        soub.tekute.kcal >= 1 ? 'tekuté kalorie ' + fc(soub.tekute.kcal) + ' kcal' + (soub.tekute.cukry >= 1 ? ' (cukry ' + fc(soub.tekute.cukry) + ' g)' : '') : ''].filter(Boolean).join(' · ') }) : null,
      soub.alk >= 0.5 ? h('div', { class: 'alk-radek', title: 'Standardní nápoj = 10 g čistého alkoholu (malé pivo, deci vína, panák). Bezpečná dávka alkoholu neexistuje.',
        text: '🍺 Alkohol ' + fc(soub.alk, 0) + ' g = ' + stdNapoje(soub.alk) }) : null,
      h('div', { class: 'voda-tl' },
        h('button', { class: 'btn mini', type: 'button', onclick: () => pridejVodu(250) }, '+ sklenice 250 ml'),
        h('button', { class: 'btn mini', type: 'button', onclick: () => pridejVodu(500) }, '+ 0,5 l'),
        h('button', { class: 'btn mini plain', type: 'button', disabled: (soub.voda || 0) <= 0, 'aria-label': 'Ubrat 250 ml', onclick: () => pridejVodu(-250) }, '−250 ml')),
      casteN.length ? h('div', { class: 'voda-tl napoje-rychle', role: 'group', 'aria-label': 'Časté nápoje' },
        ...casteN.map(x => {
          const ff = potravina(x.f.id) || x.f;
          const mn = x.porce && x.porce.pocet ? (x.porce.pocet !== 1 ? fc(x.porce.pocet, 2) + ' × ' : '') + x.porce.n.replace(/ \(.*\)$/, '') : fc(x.g) + ' ml';
          return h('button', { class: 'btn mini', type: 'button', title: 'Přidat ' + ff.nazev + ' (' + mn + ') do jídla ' + nazevJidla(vychoziJidlo()),
            onclick: () => rychlePridej(ff, x.g, x.porce, aktivniDen, vychoziJidlo()) }, '+ ' + ikonaNapoje(J.druhNapoje(ff)) + ' ', h('span', { class: 'napoj-n', text: ff.nazev }), ' ', h('small', { text: mn }));
        })) : null));
    el.appendChild(h('div', { class: 'radek', style: { marginTop: '12px' } },
      h('button', { class: 'btn mini', type: 'button', onclick: () => detailDne(aktivniDen) }, '🔬 Všechny živiny'),
      soub.pocet ? h('span', { class: 'slabe', text: J.pocet(soub.pocet, 'položka', 'položky', 'položek') }) : null));
    if (c.poznamky.length) el.appendChild(h('p', { class: 'slabe', style: { marginTop: '8px' }, text: c.poznamky.join(' ') }));
  }

  function nabidkaJidla(btn, jid, zaznamy) {
    const den = aktivniDen;   // akce se týkají dne, ve kterém byla nabídka otevřena
    const vcera = J.posunDen(den, -1);
    const vceraPocet = (S.dny[vcera] ? S.dny[vcera].z.filter(z => z.j === jid).length : 0);
    const sablony = Object.values(S.sablony);
    const pol = [
      { text: '⚡ Rychlý záznam (jen kalorie)', akce: () => rychlyZaznam(jid) },
      ...(sablony.length ? [{ text: '📋 Přidat uložené jídlo…', akce: () => vyberSablonu(den, jid) }] : []),
      { text: '📋 Zkopírovat ze včerejška' + (vceraPocet ? ' (' + vceraPocet + ')' : ''), akce: () => {
        if (!vceraPocet) { D.info('Včera v tomto jídle nic nebylo.'); return; }
        sVracenim('Zkopírováno: ' + J.pocet(vceraPocet, 'položka', 'položky', 'položek'), () => J.kopirujJidlo(S, vcera, jid, den, jid));
      } },
      { text: '📅 Zkopírovat z jiného dne…', akce: () => kopirujZDne(jid, den) },
    ];
    if (zaznamy.length) {
      pol.push({ text: '➡️ Zkopírovat na jiný den…', akce: () => kopirujNaDen(jid, den) });
      pol.push({ text: '💾 Uložit jídlo pro příště…', akce: () => ulozJakoSablonu(zaznamy, jid) });
      pol.push({ text: '🍲 Uložit jako recept', akce: () => jidloJakoRecept(zaznamy) });
      pol.push('-');
      pol.push({ text: '🗑️ Smazat celé jídlo', nebezpecne: true, akce: () => {
        sVracenim('Smazáno: ' + nazevJidla(jid) + ' (' + J.pocet(zaznamy.length, 'položka', 'položky', 'položek') + ')', () => {
          const dd = S.dny[den];
          if (dd) dd.z = dd.z.filter(z => z.j !== jid);
        });
      } });
    }
    nabidka(btn, pol);
  }
  function vyberSablonu(den, jid) {
    const ul = h('ul', { class: 'vysledky', style: { border: '0' } });
    const v = otevriVrstvu({ titulek: 'Uložené jídlo → ' + nazevJidla(jid), telo: h('div', { class: 'sheet-telo', style: { padding: '0' } }, ul), sirka: '520px' });
    for (const s of Object.values(S.sablony).sort((a, b) => a.nazev.localeCompare(b.nazev, 'cs'))) ul.appendChild(radekSablony(s, () => { v.zavri(); pouzijSablonu(s, den, jid); }));
    const prvni = ul.querySelector('li'); if (prvni) setTimeout(() => prvni.focus(), 30);
  }
  function nabidkaDne(btn) {
    const den = aktivniDen;
    const d = S.dny[den];
    const pocet = d ? d.z.length : 0;
    const pol = [
      { text: '📅 Zkopírovat celý den z…', akce: async () => {
        const k = await vyberDatum('Zkopírovat všechna jídla ze dne', J.posunDen(den, -1));
        if (!k) return;
        const n = S.dny[k] ? S.dny[k].z.length : 0;
        if (!n) { D.info('Ten den nic zapsáno není.'); return; }
        sVracenim('Zkopírováno: ' + J.pocet(n, 'položka', 'položky', 'položek'), () => J.kopirujDen(S, k, den));
      } },
    ];
    if (pocet) {
      pol.push({ text: '➡️ Zkopírovat celý den na…', akce: async () => {
        const k = await vyberDatum('Zkopírovat všechna jídla na den', J.posunDen(den, 1));
        if (!k) return;
        sVracenim('Zkopírováno: ' + J.pocet(pocet, 'položka', 'položky', 'položek') + ' → ' + J.popisDne(k, J.datumKlic(new Date())).toLowerCase(), () => J.kopirujDen(S, den, k));
      } });
      pol.push('-');
      pol.push({ text: '🗑️ Smazat všechna jídla dne', nebezpecne: true, akce: () => {
        sVracenim('Smazáno: ' + J.pocet(pocet, 'položka', 'položky', 'položek'), () => { if (S.dny[den]) S.dny[den].z = []; });
      } });
    }
    nabidka(btn, pol);
  }
  async function vyberDatum(titulek, vychozi) {
    return new Promise(ok => {
      const inp = h('input', { type: 'date', class: 'vstup', value: vychozi, 'aria-label': 'Datum' });
      let vysl = null;
      const v = otevriVrstvu({
        titulek, sirka: '360px',
        telo: h('div', { class: 'sheet-telo' }, inp),
        pata: h('div', { class: 'sheet-pata' }, h('div', { class: 'vpravo' },
          h('button', { class: 'btn', type: 'button', onclick: () => v.zavri() }, 'Zrušit'),
          h('button', { class: 'btn primary', type: 'button', onclick: () => { vysl = J.zKlice(inp.value) ? inp.value : null; v.zavri(); } }, 'Vybrat'))),
        priZavreni: () => ok(vysl),
      });
      inp.focus();
    });
  }
  async function kopirujZDne(jid, den) {
    const k = await vyberDatum('Zkopírovat ' + nazevJidla(jid) + ' ze dne', J.posunDen(den, -1));
    if (!k) return;
    const n = S.dny[k] ? S.dny[k].z.filter(z => z.j === jid).length : 0;
    if (!n) { D.info('Ten den v tomto jídle nic nebylo.'); return; }
    sVracenim('Zkopírováno: ' + J.pocet(n, 'položka', 'položky', 'položek'), () => J.kopirujJidlo(S, k, jid, den, jid));
  }
  async function kopirujNaDen(jid, den) {
    const k = await vyberDatum('Zkopírovat ' + nazevJidla(jid) + ' na den', J.posunDen(den, 1));
    if (!k) return;
    const n = S.dny[den] ? S.dny[den].z.filter(z => z.j === jid).length : 0;
    sVracenim('Zkopírováno: ' + J.pocet(n, 'položka', 'položky', 'položek') + ' → ' + J.popisDne(k, J.datumKlic(new Date())).toLowerCase(), () => J.kopirujJidlo(S, den, jid, k, jid));
  }
  function radekSablony(s, naPouziti) {
    const c = J.souhrnSablony(s);
    const ai = alergenInfo(s);
    const varuje = ai && (ai.obsahuje.length || ai.slova.length);
    const li = h('li', { class: 'vysledek', tabindex: '0', role: 'button', 'aria-label': 'Uložené jídlo ' + s.nazev + ', ' + kcalText(c.kcal) + (varuje ? '. Pozor, obsahuje: ' + textAlergenu(ai).obs.join(', ') : '') },
      h('div', { class: 'nazev' }, h('div', {}, h('span', { class: 'znak m', text: 'JÍDLO' }),
        varuje ? h('span', { class: 'znak a', title: 'Obsahuje: ' + textAlergenu(ai).obs.join(', '), text: '⚠ ALERGEN' }) : null, s.nazev),
        h('div', { class: 'detail', text: s.polozky.map(p => p.f.nazev).join(', ') })),
      h('div', { class: 'kc' }, kcalText(c.kcal || 0), h('small', { text: J.pocet(s.polozky.length, 'položka', 'položky', 'položek') })));
    li.addEventListener('click', naPouziti);
    li.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); naPouziti(); } });
    return li;
  }
  // snímky potravin v šabloně/receptu, ke kterým existuje novější verze (opravená vlastní potravina, nová data)
  function zastaraleSnimky(seznam) {
    return seznam.filter(p => { const a = potravina(p.f.id); return a && a.typ !== 'r' && J.klicSnimku(a) !== J.klicSnimku(p.f); }).length;
  }
  function aktualizujSnimky(seznam) {
    for (const p of seznam) { const a = potravina(p.f.id); if (a && a.typ !== 'r') p.f = J.snimek(a); }
  }
  function pouzijSablonu(s, den, jidlo) {
    if (!S.sablony[s.id]) { D.chyba('Uložené jídlo už neexistuje.'); return []; }
    let nove = [];
    sVracenim(nazevJidla(jidlo) + ': ' + s.nazev + ' (' + J.pocet(s.polozky.length, 'položka', 'položky', 'položek') + ')', () => { nove = J.pouzijSablonu(S, s.id, den, jidlo); });
    return nove;
  }
  async function ulozJakoSablonu(zaznamy, jid) {
    const nazev = await D.zeptej('Název uloženého jídla (např. Moje snídaně)', nazevJidla(jid));
    if (nazev === null) return;
    try {
      J.ulozSablonu(S, nazev, zaznamy);
      uloz(); D.info('Uloženo. Najdeš ho v panelu Přidat → 📋 Uložená jídla.');
      if (pohled === 'potraviny') vykresliPotraviny();
    } catch (e) { D.chyba(e.message); }
  }
  const IKONY_JIDEL = { snidane: '🌅', svacina1: '🍎', obed: '🍲', svacina2: '🥨', vecere: '🌙', druha: '🌃' };
  const IKONY_NAPOJU = { pivo: '🍺', vino: '🍷', destilat: '🥃', mleko: '🥛', dzus: '🧃', kava: '☕', voda: '💧', napoj: '🥤' };
  function ikonaNapoje(d) { return IKONY_NAPOJU[d] || '🥤'; }
  // „1 standardní nápoj“, „2 standardní nápoje“, „5 standardních nápojů“, „1,6 standardního nápoje“
  function stdNapoje(gAlk) {
    const x = J.zaokrouhli(J.standardniNapoje(gAlk), 1);
    if (x !== Math.round(x)) return fc(x, 1) + ' standardního nápoje';
    return x === 1 ? '1 standardní nápoj' : x >= 2 && x <= 4 ? x + ' standardní nápoje' : fc(x, 0) + ' standardních nápojů';
  }
  // řádek v detailu: druh, alkohol, odhad energie, přepínač pitného režimu (výjimka u potraviny)
  function infoNapoje(f, druh) {
    const box = h('div', { class: 'napoj-info' });
    const casti = [];
    if (druh) casti.push(ikonaNapoje(druh) + ' ' + J.DRUHY_NAPOJU[druh].n);
    if (Number.isFinite(f.n.alk) && (druh === 'pivo' || druh === 'vino' || druh === 'destilat' || f.n.alk > 0)) {
      const obj = f.n.alk / 0.789;
      casti.push(f.n.alk < 0.5 ? 'nealkoholické (do ' + fc(Math.max(0.5, obj), 1) + ' % obj.)' : 'alkohol ' + fc(obj, 1) + ' % obj.' + ((f.priznaky & 64) ? ' (odhad)' : ''));
      const vn = druh && J.DRUHY_NAPOJU[druh].porce[0][0], pv = vn ? J.DRUHY_NAPOJU[druh].porce[0][1] : 0;
      if (pv && f.n.alk >= 0.5) casti.push(vn.replace(/ \(.*\)$/, '') + ' = ' + fc(J.standardniNapoje(f.n.alk * pv / 100), 1) + ' std. nápoje');
    }
    if (casti.length) box.appendChild(h('div', { text: casti.join(' · ') }));
    if (f.priznaky & 128) box.appendChild(h('div', { class: 'slabe', text: 'Energie v databázi chyběla – je dopočítaná z obsahu alkoholu a typického složení. Přesné hodnoty najdeš na etiketě.' }));
    const vyj = S.nastaveni.pitnyVyjimky || {};
    const bezVyjimky = J.doPitnehoRezimu(f, { ...S.nastaveni, pitnyVyjimky: {} });
    const chk = h('input', { type: 'checkbox', checked: J.doPitnehoRezimu(f, S.nastaveni) ? true : null });
    const rucne = h('span', { class: 'slabe', text: f.id in vyj ? ' (nastaveno ručně)' : '' });
    chk.addEventListener('change', () => {
      const nv = { ...(S.nastaveni.pitnyVyjimky || {}) };
      if ((chk.checked ? 1 : 0) === bezVyjimky) delete nv[f.id]; else nv[f.id] = chk.checked;
      S.nastaveni.pitnyVyjimky = nv;
      rucne.textContent = f.id in nv ? ' (nastaveno ručně)' : '';
      uloz(); vykresliDenik();
    });
    box.appendChild(h('label', { class: 'prepinac', style: { margin: '6px 0 0' } }, chk, ' Počítat do pitného režimu', rucne));
    return box;
  }
  function zavibruj(ms) { try { if (navigator.vibrate) navigator.vibrate(ms || 12); } catch (_) { /* nic */ } }
  function rychlePridej(f, g, porce, den, jidlo) {
    try {
      const z = J.pridejZaznam(S, den, jidlo, f, g, { porce });
      zavibruj();
      vykresliDenik();
      ulozSListou(nazevJidla(jidlo) + ': ' + f.nazev + ' (' + fc(g) + ' ' + jedn(f) + ')', () => vratPridani(den, z.id));
    } catch (e) { D.chyba(e.message); }
  }
  // přejetí položky doleva (dotyk) = smazat; krátký pohyb nebo svislý posun stránky nic nedělá
  function prejetiSmazat(li, naSmazani) {
    let x0 = 0, y0 = 0, dx = 0, aktivni = false, rozhodnuto = false;
    li.addEventListener('touchstart', e => {
      if (e.touches.length !== 1) return;
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; dx = 0; aktivni = true; rozhodnuto = false; li._potlacitKlik = false;
    }, { passive: true });
    li.addEventListener('touchmove', e => {
      if (!aktivni) return;
      const mx = e.touches[0].clientX - x0, my = e.touches[0].clientY - y0;
      if (!rozhodnuto) {
        if (Math.abs(mx) < 10 && Math.abs(my) < 10) return;
        rozhodnuto = true;
        if (Math.abs(my) > Math.abs(mx) || mx > 0) { aktivni = false; return; }   // svisle nebo doprava = posun/den
        li.classList.add('tazeny');
        if (!li.querySelector('.smazat-pod')) li.prepend(h('span', { class: 'smazat-pod', 'aria-hidden': 'true', text: '🗑️ Smazat' }));
      }
      dx = Math.min(0, mx);
      li.style.transform = 'translateX(' + dx + 'px)';
      li._prejeti = true;
    }, { passive: true });
    li.addEventListener('touchend', () => {
      if (!aktivni) return;
      aktivni = false;
      if (!li._prejeti) return;
      li._prejeti = false;
      li._potlacitKlik = true;
      setTimeout(() => { li._potlacitKlik = false; }, 350);
      li.classList.remove('tazeny');
      if (dx < -Math.min(120, li.offsetWidth * 0.35)) {
        li.style.transition = 'transform .15s ease-in';
        li.style.transform = 'translateX(-100%)';
        zavibruj(20);
        setTimeout(naSmazani, 140);
      } else {
        li.style.transition = 'transform .15s ease-out';
        li.style.transform = '';
        setTimeout(() => { li.style.transition = ''; const pod = li.querySelector('.smazat-pod'); if (pod) pod.remove(); }, 160);
      }
    });
  }
  function jidloJakoRecept(zaznamy) {
    // rychlé záznamy nemají hmotnost – do receptu by se započítaly jako fiktivních 100 g
    const rychle = zaznamy.filter(z => z.rychly).length;
    const suroviny = zaznamy.filter(z => !z.rychly).map(z => ({ f: S.potraviny[z.p], g: z.g })).filter(s => s.f);
    if (!suroviny.length) { D.info('Jídlo obsahuje jen rychlé záznamy bez hmotnosti – recept z nich nejde sestavit.'); return; }
    if (rychle) D.info('Rychlé záznamy (' + rychle + ') nemají hmotnost, do receptu se nepřevzaly.');
    editorReceptu({ nazev: '', porci: 1, suroviny });
  }

  /* ----- přidávání: hledání ----- */
  function bonusy() {
    const m = new Map();
    for (const x of J.caste(S, 80)) m.set(x.f.id, Math.min(25, 8 + x.n * 2));
    for (const id of S.oblibene) m.set(id, (m.get(id) || 0) + 20);
    return m;
  }
  function zvyrazni(text, dotaz) {
    const tok = J.norm(dotaz).split(/[^a-z0-9%]+/).filter(t => t.length > 1);
    if (!tok.length) return document.createTextNode(text);
    // normalizace po znacích s mapou indexů – délka po odstranění diakritiky se může lišit
    let n = '';
    const mapa = [];
    for (let i = 0; i < text.length; i++) { const x = J.norm(text[i]); for (let k = 0; k < x.length; k++) mapa.push(i); n += x; }
    const znacky = new Array(text.length).fill(false);
    for (const t of tok) { let i = n.indexOf(t); while (i >= 0) { for (let j = i; j < i + t.length; j++) znacky[mapa[j]] = true; i = n.indexOf(t, i + 1); } }
    const fr = document.createDocumentFragment();
    let i = 0;
    while (i < text.length) {
      let j = i;
      while (j < text.length && znacky[j] === znacky[i]) j++;
      const kus = text.slice(i, j);
      fr.appendChild(znacky[i] ? h('mark', { text: kus }) : document.createTextNode(kus));
      i = j;
    }
    return fr;
  }
  // kontrola alergenů a vyhýbaných složek podle profilu (null = nic se nehlídá)
  function hlidaSe() { return (S.profil.alergeny && S.profil.alergeny.length) || String(S.profil.vyhybat || '').trim(); }
  let slozeniChyba = false;
  // kontrola jedné potraviny; recept a uložené jídlo se skládají ze svých surovin
  function alergenInfo(f, hloubka) {
    if (!hlidaSe() || !f) return null;
    if ((hloubka || 0) > 3) return null;
    if (f.typ === 'r') {
      const r = S.recepty[f.id];
      if (r) return J.slucAlergeny(r.suroviny.map(s => alergenInfo(potravina(s.f.id) || s.f, (hloubka || 0) + 1)));
    }
    if (f.polozky) return J.slucAlergeny(f.polozky.filter(p => !p.rychly).map(p => alergenInfo(potravina(p.f.id) || p.f, (hloubka || 0) + 1)));
    if (f.typ === 'q') return null;   // rychlý záznam nemá složení ani rozumný název
    let sl = null;
    if (f.ean && DB.slozeni) sl = DB.slozeni[f.ean] || null;   // i vlastní upravená kopie výrobku má jeho EAN
    if (!sl && f.typ === 'o' && f.slozeni) sl = [f.slozeni, null, f.alergeny || null, f.stopy || null];
    if ((f.typ === 'v' || (f.ean && DB.nacteno && DB.podleEan.has(f.ean))) && !DB.slozeni && !sl)
      return { nacita: !slozeniChyba, chyba: slozeniChyba, obsahuje: [], stopy: [], slova: [], slovaStopy: [] };
    return J.kontrolaAlergenu(f, sl, S.profil);
  }
  function textAlergenu(ai) {
    // text pro odznak, aria-label a varování
    const obs = ai.obsahuje.map(nazevAlergenu).concat(ai.slova);
    const st = ai.stopy.map(nazevAlergenu).concat(ai.slovaStopy || []);
    return { obs, st };
  }
  function nazevAlergenu(k) { const a = J.ALERGENY.find(x => x.k === k); return a ? a.n.split(' (')[0].toLowerCase() : k; }
  function znakPotraviny(f) {
    const z = [];
    const ai = alergenInfo(f);
    if (ai && (ai.obsahuje.length || ai.slova.length)) {
      const p = textAlergenu(ai);
      z.push(h('span', { class: 'znak a', title: 'Obsahuje: ' + p.obs.join(', ') + (ai.odhad ? ' (odhad podle názvu)' : ''), text: '⚠ ' + (ai.obsahuje.length ? 'ALERGEN' : 'SLOŽKA') }));
    } else if (ai && (ai.stopy.length || (ai.slovaStopy && ai.slovaStopy.length))) {
      z.push(h('span', { class: 'znak w', title: 'Může obsahovat stopy: ' + textAlergenu(ai).st.join(', '), text: '⚠ STOPY' }));
    } else if (ai && ai.chyba) {
      z.push(h('span', { class: 'znak w', title: 'Složení se nepodařilo načíst – alergeny nejde ověřit', text: '? ALERGENY' }));
    }
    if (f.typ === 's') z.push(h('span', { class: 'znak s', title: 'Obecná potravina (USDA)', text: 'OBECNÉ' }));
    if (f.typ === 'm') z.push(h('span', { class: 'znak m', title: 'Moje potravina', text: 'MOJE' }));
    if (f.typ === 'r') z.push(h('span', { class: 'znak r', title: 'Recept', text: 'RECEPT' }));
    if (f.typ === 'o') z.push(h('span', { class: 'znak o', title: 'Staženo online z Open Food Facts', text: 'ONLINE' }));
    if (f.priznaky & 2) z.push(h('span', { class: 'znak w', title: 'Výrobek nemá nutriční hodnoty', text: 'BEZ HODNOT' }));
    else if (f.priznaky & 1) z.push(h('span', { class: 'znak w', title: 'Hodnoty si navzájem neodpovídají – ověř je na obalu', text: '?' }));
    return z;
  }
  // odznaky (alergen, stopy, typ) slovy pro čtečky obrazovky – aria-label řádku jinak přebije obsah
  function popisOdznaku(f) {
    const c = [];
    const ai = alergenInfo(f);
    if (ai && ai.chyba && !ai.obsahuje.length) c.push('alergeny nejde ověřit');
    if (ai && (ai.obsahuje.length || ai.slova.length)) c.push('pozor, obsahuje: ' + textAlergenu(ai).obs.join(', '));
    else if (ai && (ai.stopy.length || (ai.slovaStopy && ai.slovaStopy.length))) c.push('může obsahovat stopy: ' + textAlergenu(ai).st.join(', '));
    if (f.typ === 's') c.push('obecná potravina');
    if (f.typ === 'm') c.push('moje potravina');
    if (f.typ === 'r') c.push('recept');
    if (f.priznaky & 1) c.push('hodnoty si neodpovídají');
    return c.length ? '. ' + c.join('. ') : '';
  }
  let poradiVysledku = 0;
  function radekVysledku(f, dotaz, naVyber, naPlus, extra, samostatny) {
    const kcal = f.n && f.n.kcal;
    const det = [f.znacka, f.mnozstvi, extra].filter(Boolean).join(' · ');
    // v panelu přidávání jsou řádky volby comboboxu (fokus zůstává v poli); v Procházení samostatné prvky
    const li = h('li', { class: 'vysledek', id: 'vys' + (++poradiVysledku), tabindex: samostatny ? '0' : '-1', role: samostatny ? 'button' : 'option',
      'aria-selected': samostatny ? null : 'false',
      'aria-label': f.nazev + (f.znacka ? ', ' + f.znacka : '') + (Number.isFinite(kcal) ? ', ' + fc(kcal) + ' kcal na 100 ' + jedn(f) : ', bez nutričních hodnot') + popisOdznaku(f) },
      h('div', { class: 'nazev' },
        h('div', {}, ...znakPotraviny(f), dotaz ? zvyrazni(f.nazev, dotaz) : f.nazev),
        det ? h('div', { class: 'detail' }, dotaz ? zvyrazni(det, dotaz) : det) : null),
      f.nutriscore ? h('span', { class: 'nutri ' + f.nutriscore, title: 'Nutri-Score ' + f.nutriscore.toUpperCase(), text: f.nutriscore }) : null,
      h('div', { class: 'kc' }, Number.isFinite(kcal) ? fc(kcal) : '–', h('small', { text: 'kcal/100 ' + jedn(f) })),
      // „+“ je zkratka pro myš/dotyk; klávesnice přidává přes detail (interaktivní prvek uvnitř option by byl neplatný)
      naPlus ? h('button', { class: 'btn ikona plus', type: 'button', tabindex: '-1', 'aria-hidden': 'true', title: 'Rovnou přidat (naposledy použité množství)',
        onclick: e => { e.stopPropagation(); naPlus(f); } }, '+') : null);
    li.addEventListener('click', () => naVyber(f));
    if (samostatny) li.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === li) { e.preventDefault(); naVyber(f); } });
    li._f = f;
    return li;
  }

  // panel přidávání; rezim: 'denik' (výchozí) nebo 'vyber' (naVyber(f, g) – pro recepty)
  function otevriPridani(volby) {
    volby = volby || {};
    const rezimVyber = typeof volby.naVyber === 'function';
    let jidlo = volby.jidlo || vychoziJidlo();
    const den = volby.den || aktivniDen;
    const idSeznamu = 'seznam' + (++poradiVysledku);
    const vstup = h('input', { type: 'search', class: 'vstup', placeholder: 'Hledat potravinu, značku nebo EAN…', 'aria-label': 'Hledat potravinu',
      autocomplete: 'off', enterkeyhint: 'search', spellcheck: 'false', role: 'combobox', 'aria-autocomplete': 'list', 'aria-expanded': 'true', 'aria-controls': idSeznamu });
    const sken = h('button', { class: 'btn', type: 'button', title: 'Naskenovat čárový kód', 'aria-label': 'Naskenovat čárový kód' }, '📷');
    const cipy = h('div', { class: 'cipy', role: 'group', 'aria-label': 'Výběr seznamu' });
    const seznam = h('ul', { class: 'vysledky', role: 'listbox', 'aria-label': 'Výsledky', id: idSeznamu });
    const info = h('div', { class: 'slabe', style: { padding: '6px 14px' }, 'aria-live': 'polite' });
    let karta = 'nedavne', filtr = 'vse', aktivni = -1;
    const KARTY = [['nedavne', '🕘 Nedávné'], ['caste', '⭐ Časté'], ['oblibene', '♥ Oblíbené'], ['moje', '✎ Moje'], ['recepty', '🍲 Recepty']]
      .concat(rezimVyber ? [] : [['sablony', '📋 Uložená jídla']]);
    const FILTRY = [['vse', 'Vše'], ['s', 'Obecné potraviny'], ['v', 'Výrobky'], ['m', 'Moje a recepty']];
    const vyberJidla = h('select', { class: 'vstup', 'aria-label': 'Jídlo', style: { maxWidth: '170px' } },
      ...S.nastaveni.jidla.map(j => h('option', { value: j.id, selected: j.id === jidlo ? true : null }, j.nazev)));
    vyberJidla.addEventListener('change', () => { jidlo = vyberJidla.value; });
    const telo = h('div', { style: { display: 'flex', flexDirection: 'column', minHeight: 0, flex: '1' } },
      h('div', { class: 'hledani' }, vstup, sken), cipy, info, seznam);
    const pata = h('div', { class: 'sheet-pata' },
      h('button', { class: 'btn mini', type: 'button', onclick: () => editorPotraviny({}, f => vybrano(f)) }, '+ Nová potravina'),
      rezimVyber ? null : h('button', { class: 'btn mini', type: 'button', onclick: () => { v.zavri(); rychlyZaznam(jidlo); } }, '⚡ Rychlý záznam'),
      h('span', { class: 'vpravo slabe', text: rezimVyber ? '' : J.popisDne(den, J.datumKlic(new Date())) }));
    const v = otevriVrstvu({
      titulek: rezimVyber ? (volby.titulek || 'Vybrat surovinu') : 'Přidat do jídla',
      hlavickaNavic: rezimVyber ? null : vyberJidla,
      telo, pata, trida: 'sheet-pridani',
    });

    function vybrano(f) {
      if (rezimVyber) {
        detailPotraviny(f, { rezim: 'vyber', naVyber: (ff, g) => { volby.naVyber(ff, g); v.zavri(); } });
      } else {
        detailPotraviny(f, { rezim: 'pridat', den, jidlo: () => jidlo, poPridani: () => { v.zavri(); } });
      }
    }
    function rovnou(f) {
      const pos = J.nedavne(S, 200).find(x => x.f.id === f.id);
      let g = pos ? pos.g : (f.porce && f.porce[0] ? f.porce[0].g : 100);
      let porce = pos ? pos.porce : (f.porce && f.porce[0] ? { n: f.porce[0].n, pocet: 1 } : null);
      if (rezimVyber) { volby.naVyber(f, g); v.zavri(); return; }
      try {
        const z = J.pridejZaznam(S, den, jidlo, f, g, { porce });
        vykresliDenik();
        ulozSListou(nazevJidla(jidlo) + ': ' + f.nazev + ' (' + fc(g) + ' ' + jedn(f) + ')', () => vratPridani(den, z.id));
      } catch (e) { D.chyba(e.message); }
    }
    sken.addEventListener('click', () => skenuj({ jidlo, den, naVyber: rezimVyber ? (f, g) => { volby.naVyber(f, g); v.zavri(); } : null, poPridani: () => v.zavri() }));

    function vykresliCipy() {
      cipy.textContent = '';
      const q = vstup.value.trim();
      const sada = q ? FILTRY : KARTY;
      const akt = q ? filtr : karta;
      for (const [id, text] of sada) {
        cipy.appendChild(h('button', { class: 'cip', type: 'button', 'aria-pressed': String(id === akt),
          onclick: () => { if (q) filtr = id; else karta = id; vykresliCipy(); vykresliVysledky(); } }, text));
      }
    }
    function vykresliVysledky() {
      const q = vstup.value.trim();
      seznam.textContent = ''; aktivni = -1;
      vstup.removeAttribute('aria-activedescendant');
      vstup.setAttribute('aria-expanded', 'false');
      let polozky = [];
      if (q) {
        if (!DB.nacteno && !DB.indexUziv.length) { info.textContent = DB.chyba ? 'Databáze není načtená.' : 'Databáze se ještě načítá…'; return; }
        const filtrF = filtr === 'vse' ? null : filtr === 's' ? f => f.typ === 's' : filtr === 'v' ? f => f.typ === 'v' || f.typ === 'o' : f => f.typ === 'm' || f.typ === 'r';
        polozky = J.hledej(DB.vse.length ? DB.vse : DB.indexUziv, q, { limit: 80, bonus: bonusy(), filtr: filtrF });
        info.textContent = polozky.tolerantni ? 'Přesná shoda nenalezena – zobrazuji podobně psané výsledky.' : '';
        if (!polozky.length) {
          const cisla = q.replace(/\s/g, '');
          const p = h('li', { class: 'prazdny' }, 'Nic nenalezeno pro „' + q + '“.', h('br'));
          if (/^\d{8,14}$/.test(cisla)) {
            pridat(p, h('button', { class: 'btn mini', type: 'button', onclick: () => hledejKod(cisla) }, '🌐 Hledat kód ' + cisla + (S.nastaveni.online ? ' online' : '')));
          } else {
            pridat(p, 'Zkus kratší slovo nebo jiný tvar (např. „jogurt bílý“). ',
              h('button', { class: 'btn mini', type: 'button', onclick: () => editorPotraviny({ nazev: q }, f => vybrano(f)) }, '+ Vytvořit „' + q + '“'));
          }
          seznam.appendChild(p);
          return;
        }
      } else {
        if (karta === 'nedavne') polozky = J.nedavne(S, 60).map(x => aktualni(x.f));
        else if (karta === 'caste') polozky = J.caste(S, 60).map(x => aktualni(x.f));
        else if (karta === 'oblibene') polozky = S.oblibene.map(potravina).filter(Boolean);
        else if (karta === 'moje') polozky = Object.values(S.vlastni).sort((a, b) => a.nazev.localeCompare(b.nazev, 'cs'));
        else if (karta === 'recepty') polozky = Object.values(S.recepty).map(J.receptJakoPotravina).sort((a, b) => a.nazev.localeCompare(b.nazev, 'cs'));
        else if (karta === 'sablony') {
          const sb = Object.values(S.sablony).sort((a, b) => a.nazev.localeCompare(b.nazev, 'cs'));
          if (sb.length) {
            for (const s of sb) seznam.appendChild(radekSablony(s, () => { pouzijSablonu(s, den, jidlo); v.zavri(); }));
            return;
          }
        }
        if (!polozky.length) {
          const texty = {
            nedavne: 'Tady se objeví potraviny, které zapíšeš. Začni psát název nebo naskenuj kód.',
            caste: 'Nejčastěji zapisované potraviny se objeví po pár dnech používání.',
            oblibene: 'Potravinu přidáš do oblíbených srdíčkem v jejím detailu.',
            moje: 'Vlastní potraviny vytvoříš tlačítkem „Nová potravina“ – třeba z etikety výrobku.',
            recepty: 'Recepty vytvoříš v záložce Potraviny a recepty.',
            sablony: 'Opakující se jídlo ulož v deníku přes ⋯ u jídla → „Uložit jídlo pro příště…“.',
          };
          seznam.appendChild(h('li', { class: 'prazdny', text: texty[karta] }));
          return;
        }
      }
      const fr = document.createDocumentFragment();
      for (const f of polozky) fr.appendChild(radekVysledku(f, q, vybrano, rovnou));
      seznam.appendChild(fr);
      vstup.setAttribute('aria-expanded', 'true');
    }
    // hledání kódu z panelu: jedno naráz, s ukazatelem; po zavření panelu se výsledek zahodí
    let hledaKod = false;
    async function hledejKod(c) {
      if (hledaKod) return;
      hledaKod = true;
      info.textContent = 'Hledám kód ' + c + '…';
      try {
        await zpracujKod(c, { jidlo, den, poPridani: () => v.zavri(), platne: () => document.contains(seznam),
          naVyber: rezimVyber ? (f, g) => { volby.naVyber(f, g); v.zavri(); } : null });
      } finally { hledaKod = false; if (document.contains(info)) info.textContent = ''; }
    }
    // potravina z deníku (snímek) → aktuální verze z databáze, pokud existuje
    function aktualni(snim) { return potravina(snim.id) || snim; }
    let casovac = null;
    vstup.addEventListener('input', () => { clearTimeout(casovac); casovac = setTimeout(() => { vykresliCipy(); vykresliVysledky(); }, 90); });
    vstup.addEventListener('keydown', e => {
      const li = seznam.querySelectorAll('.vysledek');
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!li.length) return;
        aktivni = e.key === 'ArrowDown' ? Math.min(li.length - 1, aktivni + 1) : Math.max(0, aktivni - 1);
        li.forEach((x, i) => { x.classList.toggle('aktivni', i === aktivni); x.setAttribute('aria-selected', String(i === aktivni)); });
        li[aktivni].scrollIntoView({ block: 'nearest' });
        vstup.setAttribute('aria-activedescendant', li[aktivni].id);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const x = li[aktivni >= 0 ? aktivni : 0];
        if (x && x._f) vybrano(x._f);
        else {
          const c = vstup.value.replace(/\s/g, '');
          if (/^\d{8,14}$/.test(c)) hledejKod(c);
        }
      }
    });
    const priData = () => { if (document.contains(seznam)) vykresliVysledky(); };
    document.addEventListener('denik-data', priData);
    const puvodniZavri = v.zavri;
    v.zavri = () => { document.removeEventListener('denik-data', priData); puvodniZavri(); };
    if (volby.dotaz) vstup.value = volby.dotaz;
    vykresliCipy(); vykresliVysledky();
    setTimeout(() => vstup.focus(), 30);
    return v;
  }

  /* ----- skenování ----- */
  function skenuj(volby) {
    if (!window.DENIK_CTECKA) { D.chyba('Čtečka se ještě načítá.'); return; }
    if (lista) zobrazListu(false);   // lišta by zakryla ruční zadání kódu
    DENIK_CTECKA.otevri({
      titulek: volby && volby.potvrzeni ? '✓ ' + volby.potvrzeni + ' – naskenuj další' : 'Naskenuj čárový kód výrobku',
      naKod: async (kod, sezeni) => { await zpracujKod(kod, volby, sezeni); return true; },
      // po zavření čtečky zase ukázat lištu Vrátit (pokud ještě platí)
      priZavreni: () => { if (lista && listaVraceni && !vrstvy.length) zobrazListu(true); },
    });
  }
  // sezeni = číslo sezení čtečky, pokud kód přišel z ní; když ho mezitím uživatel zavřel
  // nebo otevřel znovu, výsledek se zahodí (neotevírat nečekaně detail)
  async function zpracujKod(kod, volby, sezeni) {
    volby = volby || {};
    const zeCtecky = sezeni !== undefined && window.DENIK_CTECKA;
    const platne = () => (!zeCtecky || DENIK_CTECKA.sezeni() === sezeni) && (!volby.platne || volby.platne());
    let f = podleEan(kod);
    if (!f && !DB.nacteno) {
      // databáze se načítá (nebo selhala) – zkusit ji dočíst, nejdéle 20 s
      await Promise.race([nactiDatabazi(), new Promise(ok => setTimeout(ok, 20000))]);
      if (!platne()) return false;
      f = podleEan(kod);
    }
    if (!f && S.nastaveni.online && navigator.onLine) {
      try { f = await hledejOnline(kod); }
      catch (e) { D.chyba(e.message); }
      if (!platne()) return false;
    }
    if (zeCtecky) DENIK_CTECKA.zavri();
    if (f) {
      const navic = volby.naVyber
        ? { rezim: 'vyber', naVyber: (ff, g) => volby.naVyber(ff, g) }
        : { rezim: 'pridat', den: volby.den || aktivniDen, jidlo: () => volby.jidlo || vychoziJidlo(), poPridani: volby.poPridani,
          dalsiSken: zeCtecky ? (jid, den, potvrzeni) => skenuj({ ...volby, jidlo: jid, den, potvrzeni }) : null };
      detailPotraviny(f, navic);
      return true;
    }
    const zeme = J.eanZeme(kod);
    const ok = await D.potvrd((DB.nacteno ? 'Výrobek s kódem ' + kod + (zeme ? ' (' + zeme + ')' : '') + ' v databázi není'
      : 'Databázi výrobků se nepodařilo načíst, kód ' + kod + ' proto nejde vyhledat') +
      (S.nastaveni.online ? (navigator.onLine ? ' ani v Open Food Facts' : ' (jsi offline, online hledání nešlo)') : '') +
      '.\n\nChceš ho zadat sám podle etikety? Uloží se mezi tvé potraviny a příště ho naskenuješ.', { ok: 'Zadat z etikety', zrus: 'Zrušit' });
    if (ok) editorPotraviny({ ean: kod }, nova => {
      if (volby.naVyber) detailPotraviny(nova, { rezim: 'vyber', naVyber: (ff, g) => volby.naVyber(ff, g) });
      else detailPotraviny(nova, { rezim: 'pridat', den: volby.den || aktivniDen, jidlo: () => volby.jidlo || vychoziJidlo(), poPridani: volby.poPridani });
    });
    return false;
  }

  /* ----- detail potraviny / úprava záznamu ----- */
  // rezim: 'pridat' {den, jidlo(), poPridani}, 'upravit' {den, zaznam}, 'vyber' {naVyber(f, g)}, 'nahled'
  function detailPotraviny(f, volby) {
    volby = volby || { rezim: 'nahled' };
    const rezim = volby.rezim;
    const z = volby.zaznam || null;
    const j = jedn(f);
    const bezHodnot = !Number.isFinite(f.n && f.n.kcal);
    // jednotky: g/ml + porce
    // u nápojů i typické porce (půllitr, sklenka, panák) – i u starších záznamů a vlastních potravin
    const porceVse = f.ml ? J.doplnNapoj({ ...f, porce: (f.porce || []).slice() }).porce : (f.porce || []);
    const druh = J.druhNapoje(f);
    const jednotky = [{ n: j, g: 1 }].concat(porceVse.map(p => ({ n: p.n + ' (' + fc(p.g, 1) + ' ' + j + ')', g: p.g, nazev: p.n })));
    let jIdx = 0, mnoz = 100;
    if (z) {
      if (z.porce && z.porce.pocet) {
        const i = jednotky.findIndex(x => x.nazev === z.porce.n);
        if (i > 0) { jIdx = i; mnoz = z.porce.pocet; } else mnoz = z.g;
      } else mnoz = z.g;
    } else {
      const pos = J.nedavne(S, 300).find(x => x.f.id === f.id);
      if (pos && pos.porce && pos.porce.pocet) {
        const i = jednotky.findIndex(x => x.nazev === pos.porce.n);
        if (i > 0) { jIdx = i; mnoz = pos.porce.pocet; } else mnoz = pos.g;
      } else if (pos) mnoz = pos.g;
      else if (rezim !== 'vyber') {
        // výchozí jednotka: malá porce výrobku, u obecné potraviny „kus“; jinak 100 g
        // (americké „hrnky“ ani celé balení se jako výchozí nehodí; v receptech vždy gramy)
        const vn = J.vychoziPorceNapoje(f, porceVse);
        let i = vn ? jednotky.findIndex(x => x.nazev === vn) : -1;
        if (i < 0) i = jednotky.findIndex((x, k) => k > 0 && (
          (/^porce/.test(x.nazev) && x.g <= 250 && x.g !== 100) || (/^(střední kus|kus)$/.test(x.nazev) && x.g <= 400)));
        if (i > 0) { jIdx = i; mnoz = 1; }
      }
    }
    // text + inputmode: desetinná čárka funguje ve všech prohlížečích (number v cs prostředí ne vždy)
    const vstupM = h('input', { type: 'text', class: 'vstup', inputmode: 'decimal', autocomplete: 'off', 'aria-label': 'Množství', value: String(J.zaokrouhli(mnoz, 2)).replace('.', ',') });
    const vyberJ = h('select', { class: 'vstup', 'aria-label': 'Jednotka' }, ...jednotky.map((x, i) => h('option', { value: String(i), selected: i === jIdx ? true : null }, x.n)));
    const gramy = () => (J.cislo(vstupM.value) || 0) * jednotky[+vyberJ.value].g;
    const vypocet = h('div', { class: 'vypocet', 'aria-live': 'polite' });
    const rychle = h('div', { class: 'rychle-g' });
    for (const g of (druh ? [100, 200, 250, 330, 500] : [25, 50, 100, 150, 200, 250])) {
      rychle.appendChild(h('button', { class: 'btn mini', type: 'button', onclick: () => { vyberJ.value = '0'; jIdx = 0; vstupM.value = String(g); prepocti(); } }, g + ' ' + j));
    }
    const c = cileDne(volby.den);
    // nápověda při pravděpodobné záměně porcí a gramů („80“ při jednotce porce)
    const napoveda = h('div', { class: 'slabe', style: { margin: '-2px 0 8px' }, 'aria-live': 'polite' });
    function prepocti() {
      const g = gramy();
      const pocet = J.cislo(vstupM.value) || 0;
      napoveda.textContent = '';
      if (+vyberJ.value > 0 && pocet >= 15 && jednotky[+vyberJ.value].g >= 15) {
        pridat(napoveda, 'Myslíš ' + fc(pocet, 1) + ' ' + j + '? ',
          h('button', { class: 'btn mini', type: 'button', onclick: () => { vyberJ.value = '0'; jIdx = 0; prepocti(); vstupM.focus(); } }, 'Ano, ' + fc(pocet, 1) + ' ' + j));
      }
      const v = J.zivinyZa(f.n || {}, g);
      vypocet.textContent = '';
      const bunka = (kl, nazev, tr) => h('div', { class: tr || '' }, h('b', { text: kl === 'kcal' ? fc(v.kcal, 0) : fc(v[kl], 1) + ' g' }),
        h('span', { text: nazev + (kl === 'kcal' && c.kcal && Number.isFinite(v.kcal) ? ' · ' + fc(100 * v.kcal / c.kcal, 0) + ' % cíle' : '') }));
      pridat(vypocet, bunka('kcal', 'kcal', 'kc'), bunka('bilkoviny', 'bílkoviny'), bunka('sacharidy', 'sacharidy'), bunka('tuk', 'tuky'));
      if ((v.alk || 0) >= 0.5) vypocet.appendChild(h('div', { class: 'vypocet-alk', text: ikonaNapoje(druh || 'pivo') + ' ' + fc(v.alk, 1) + ' g alkoholu = ' + stdNapoje(v.alk) }));
      tlacitkoHlavni.disabled = !(g > 0);
    }
    vstupM.addEventListener('input', prepocti);
    vyberJ.addEventListener('change', () => {
      // přepočet zadaného množství do nové jednotky (jIdx = dosavadní jednotka)
      vstupM.value = vyberJ.value === '0' ? String(J.zaokrouhli(jednotky[jIdx].g * (J.cislo(vstupM.value) || 0), 1) || 100) : '1';
      jIdx = +vyberJ.value;
      prepocti();
    });

    // obsah
    const telo = h('div', { class: 'sheet-telo' });
    const obr = (S.nastaveni.obrazky && f.ean && f.obrazek && navigator.onLine) ? h('img', {
      class: 'detail-obr', alt: '', loading: 'lazy', referrerpolicy: 'no-referrer', src: J.obrazekUrl(f.ean, f.obrazek, 200),
      onerror: e => e.target.remove(), title: 'Foto: Open Food Facts (CC BY-SA)' }) : null;
    const stitky = h('div', { class: 'stitky' });
    if (f.nutriscore) stitky.appendChild(h('span', { class: 'stitek' }, 'Nutri-Score ', h('span', { class: 'nutri ' + f.nutriscore, text: f.nutriscore })));
    if (f.nova) stitky.appendChild(h('span', { class: 'stitek', title: 'Míra průmyslového zpracování (1 = nezpracované, 4 = ultrazpracované)', text: 'NOVA ' + f.nova }));
    if (f.skupina && J.SKUPINY[f.skupina]) stitky.appendChild(h('span', { class: 'stitek', text: J.SKUPINY[f.skupina] }));
    if (f.ean) stitky.appendChild(h('span', { class: 'stitek', title: 'Čárový kód' + (J.eanZeme(f.ean) ? ' – registrován: ' + J.eanZeme(f.ean) : ''), text: 'EAN ' + f.ean }));
    const oblibena = S.oblibene.includes(f.id);
    const srdce = h('button', { class: 'btn ikona plain', type: 'button', 'aria-pressed': String(oblibena), 'aria-label': 'Oblíbená', title: 'Oblíbená', text: oblibena ? '♥' : '♡' });
    srdce.addEventListener('click', () => {
      const i = S.oblibene.indexOf(f.id);
      if (i >= 0) S.oblibene.splice(i, 1); else S.oblibene.push(f.id);
      const je = i < 0;
      srdce.textContent = je ? '♥' : '♡'; srdce.setAttribute('aria-pressed', String(je));
      uloz();
    });
    telo.appendChild(h('div', { class: 'detail-hl' }, obr,
      h('div', { class: 'detail-info' },
        h('h3', { text: f.nazev, style: { fontSize: '1.05rem' } }),
        f.znacka || f.mnozstvi ? h('div', { class: 'zn', text: [f.znacka, f.mnozstvi].filter(Boolean).join(' · ') }) : null,
        stitky)));
    // alergeny a vyhýbané složky podle profilu
    const alergenBox = h('div', {});
    telo.appendChild(alergenBox);
    const ukazAlergeny = () => {
      const ai = alergenInfo(f);
      alergenBox.textContent = '';
      if (!ai || ai.nacita) return;
      const p = textAlergenu(ai);
      if (ai.chyba && !p.obs.length) { pridat(alergenBox, h('div', { class: 'upozorneni', role: 'status', text: 'Složení výrobků se nepodařilo načíst – hlídané alergeny ' + (f.typ === 'r' || f.polozky ? 'u některé suroviny ' : '') + 'teď nejde ověřit. Zkontroluj obal.' })); return; }
      if (ai.ciziPismo) pridat(alergenBox, h('div', { class: 'upozorneni info', text: 'Složení je v písmu, které kontrola neumí přečíst (cyrilice/řečtina) – vychází jen z alergenů uvedených v databázi.' }));
      const zdroj = ai.zdroj === 'nazev' ? ' (kontrolováno jen podle názvu' + (f.typ === 'r' || f.polozky ? ' u některé suroviny' : '') + ' – ověř na obalu)' : '';
      if (p.obs.length) {
        pridat(alergenBox, h('div', { class: 'alergen-varovani', role: 'status' }, h('b', { text: '⚠ Pozor: ' }),
          'obsahuje ' + p.obs.join(', ') + zdroj + (p.st.length ? '; může obsahovat stopy: ' + p.st.join(', ') : '') + '.'));
      } else if (p.st.length) {
        pridat(alergenBox, h('div', { class: 'upozorneni', role: 'status', text: '⚠ Může obsahovat stopy: ' + p.st.join(', ') + '.' }));
      } else if (ai.zdroj === 'nazev') {
        pridat(alergenBox, h('div', { class: 'upozorneni info', text: (f.typ === 'v' ? 'U tohoto výrobku chybí složení' : f.typ === 'r' || f.polozky ? 'U některé suroviny chybí složení' : 'U této potraviny složení neznáme') +
          ' – hlídané alergeny jsou zkontrolované jen podle názvu. To neznamená, že je neobsahuje.' }));
      }
    };
    if (hlidaSe()) { if ((f.typ === 'v' || f.typ === 'r' || f.polozky || f.ean) && !DB.slozeni) nactiSlozeni().then(ukazAlergeny, () => { slozeniChyba = true; ukazAlergeny(); }); else ukazAlergeny(); }
    // upozornění
    if (bezHodnot) {
      telo.appendChild(h('div', { class: 'upozorneni' }, 'Tento výrobek nemá v databázi nutriční hodnoty. ',
        h('button', { class: 'btn mini', type: 'button', onclick: () => doplnHodnoty(f) }, '✎ Doplnit z etikety')));
    } else if (f.priznaky & 1 || J.energieSedi(f.n) === false) {
      telo.appendChild(h('div', { class: 'upozorneni' }, 'Hodnoty si navzájem neodpovídají (energie nesedí s makroživinami nebo cukrů je víc než sacharidů). Ověř je na obalu – ',
        h('button', { class: 'btn mini', type: 'button', onclick: () => doplnHodnoty(f) }, 'opravit ve vlastní kopii')));
    }
    if (f.ml) telo.appendChild(infoNapoje(f, druh));
    if (f.typ === 's') telo.appendChild(h('div', { class: 'upozorneni info', text: 'Obecná potravina podle americké databáze USDA – u konkrétního výrobku se hodnoty mohou lišit (zejména pečivo a uzeniny).' }));
    if (f.typ === 'o') telo.appendChild(h('div', { class: 'upozorneni info', text: 'Staženo online z Open Food Facts ' + (f.stazeno ? J.zKlice(f.stazeno).toLocaleDateString('cs-CZ') : '') + '. Údaje vkládají dobrovolníci – při pochybnosti porovnej s obalem.' }));

    let tlacitkoHlavni = h('button', { class: 'btn primary', type: 'button' });
    let tlacitkoDalsi = null;
    if (rezim !== 'nahled' && !bezHodnot) {
      telo.appendChild(h('div', { class: 'mnozstvi' }, vstupM, vyberJ));
      telo.appendChild(napoveda);
      telo.appendChild(rychle);
      let vyberJidla = null, vyberDne = null;
      if (rezim === 'pridat' || rezim === 'upravit') {
        vyberJidla = h('select', { class: 'vstup', 'aria-label': 'Jídlo' },
          ...S.nastaveni.jidla.map(x => h('option', { value: x.id }, x.nazev)));
        const jidloVychozi = rezim === 'upravit' ? z.j : volby.jidlo();
        // záznam z jídla, které už v nastavení není (smazané / z jiného zařízení) – zachovat ho
        if (!S.nastaveni.jidla.some(x => x.id === jidloVychozi)) vyberJidla.appendChild(h('option', { value: jidloVychozi }, nazevJidla(jidloVychozi)));
        vyberJidla.value = jidloVychozi;
        vyberDne = h('input', { type: 'date', class: 'vstup', 'aria-label': 'Den', value: volby.den });
        telo.appendChild(h('div', { class: 'vyber-radek' }, vyberJidla, vyberDne));
      }
      telo.appendChild(vypocet);
      tlacitkoHlavni.textContent = rezim === 'upravit' ? 'Uložit změnu' : rezim === 'vyber' ? 'Vybrat' : '+ Přidat do deníku';
      let probiha = false;
      let dalsi = false;
      tlacitkoHlavni.addEventListener('click', async () => {
        if (probiha) return;
        probiha = true;
        try { await ulozDetail(); } finally { probiha = false; dalsi = false; }
      });
      if (rezim === 'pridat' && volby.dalsiSken) {
        tlacitkoDalsi = h('button', { class: 'btn', type: 'button', title: 'Přidat a hned naskenovat další výrobek do stejného jídla' }, '+ a skenovat další');
        tlacitkoDalsi.addEventListener('click', () => { dalsi = true; tlacitkoHlavni.click(); });
      }
      async function ulozDetail() {
        const g = gramy();
        if (!(g > 0)) { D.chyba('Zadej množství.'); return; }
        // ochrana před překlepem (např. 150 „hrnků“ místo 150 g)
        if (g > 3000 && !(await D.potvrd('Opravdu ' + fc(g / 1000, 1) + ' ' + (j === 'ml' ? 'l' : 'kg') + ' (' + fc(J.cislo(vstupM.value), 2) + ' × ' + jednotky[+vyberJ.value].n + ')?', { ok: 'Ano, zapsat', zrus: 'Opravit' }))) {
          vstupM.focus(); vstupM.select(); return;
        }
        const porce = +vyberJ.value > 0 ? { n: jednotky[+vyberJ.value].nazev, pocet: J.cislo(vstupM.value) } : null;
        try {
          if (rezim === 'vyber') { v.zavri(); volby.naVyber(f, g); return; }   // nejdřív horní vrstva (fokus se vrací správně)
          const den = J.zKlice(vyberDne.value) ? vyberDne.value : volby.den;
          if (rezim === 'upravit') {
            const zz = J.najdiZaznam(S, volby.den, z.id);
            if (!zz) { v.zavri(); return; }
            zz.g = J.zaokrouhli(g, 1);
            if (porce) zz.porce = porce; else delete zz.porce;
            zz.j = vyberJidla.value;
            if (den !== volby.den) J.presunZaznam(S, volby.den, z.id, den, vyberJidla.value, false);
          } else {
            const nz = J.pridejZaznam(S, den, vyberJidla.value, f, g, { porce });
            v.zavri();
            ulozSListou(nazevJidla(vyberJidla.value) + ': ' + f.nazev + ' (' + fc(g) + ' ' + j + ')', () => vratPridani(den, nz.id));
            if (dalsi && volby.dalsiSken) { vykresliPohled(); volby.dalsiSken(vyberJidla.value, den, nazevJidla(vyberJidla.value) + ': ' + f.nazev); return; }
            if (volby.poPridani) volby.poPridani();
            vykresliPohled();
            return;
          }
          uloz();
          v.zavri();
          if (volby.poPridani) volby.poPridani();
          vykresliPohled();
        } catch (e) { D.chyba(e.message); }
      }
      vstupM.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); tlacitkoHlavni.click(); } });
    }
    // tabulka živin na 100 g
    if (!bezHodnot) telo.appendChild(tabulkaZivin(f));
    // složení
    const slozeniSekce = h('div', { class: 'sekce' });
    telo.appendChild(slozeniSekce);
    vykresliSlozeni(f, slozeniSekce);
    // zdroj
    telo.appendChild(h('div', { class: 'zdroj' }, ...zdrojPotraviny(f)));

    const pata = h('div', { class: 'sheet-pata' });
    if (rezim === 'upravit') {
      pridat(pata, 
        h('button', { class: 'btn danger', type: 'button', onclick: async () => {
          v.zavri();
          sVracenim('Smazáno: ' + f.nazev, () => J.smazZaznam(S, volby.den, z.id));
        } }, '🗑️ Smazat'));
    }
    const porovnat = bezHodnot ? null : h('button', { class: 'btn ikona plain', type: 'button', 'aria-pressed': String(vPorovnani(f)), 'aria-label': 'Porovnat s jinými potravinami', title: 'Přidat do porovnání / odebrat' }, '⚖️');
    if (porovnat) porovnat.addEventListener('click', () => { prepniPorovnani(f); porovnat.setAttribute('aria-pressed', String(vPorovnani(f))); });
    const vic = h('button', { class: 'btn ikona', type: 'button', 'aria-label': 'Další akce', 'aria-haspopup': 'menu', text: '⋯' });
    vic.addEventListener('click', () => {
      const pol = [];
      if (f.typ !== 'm' && f.typ !== 'r') pol.push({ text: '✎ Vytvořit vlastní upravenou kopii', akce: () => doplnHodnoty(f) });
      if (f.typ === 'm') pol.push({ text: '✎ Upravit potravinu', akce: () => editorPotraviny(S.vlastni[f.id] || f, () => { v.zavri(); }) });
      if (f.typ === 'r' && S.recepty[f.id]) pol.push({ text: '✎ Upravit recept', akce: () => { v.zavri(); editorReceptu(S.recepty[f.id]); } });
      if (f.ean) pol.push({ text: '🌐 Otevřít na Open Food Facts', akce: () => window.open('https://world.openfoodfacts.org/product/' + encodeURIComponent(f.ean), '_blank', 'noopener') });
      if (rezim === 'upravit') pol.push({ text: '📋 Duplikovat záznam', akce: () => { v.zavri(); sVracenim('Duplikováno: ' + f.nazev, () => J.presunZaznam(S, volby.den, z.id, volby.den, null, true)); } });
      if (!pol.length) pol.push({ text: 'Žádné další akce', akce: () => {} });
      nabidka(vic, pol);
    });
    pridat(pata, srdce, porovnat, vic, h('div', { class: 'vpravo' },
      h('button', { class: 'btn', type: 'button', onclick: () => v.zavri() }, rezim === 'nahled' ? 'Zavřít' : 'Zrušit'),
      rezim !== 'nahled' && !bezHodnot ? tlacitkoDalsi : null,
      rezim !== 'nahled' && !bezHodnot ? tlacitkoHlavni : null));
    const v = otevriVrstvu({ titulek: rezim === 'upravit' ? 'Upravit záznam' : f.nazev, telo, pata, sirka: '600px' });
    prepocti();
    if (rezim !== 'nahled' && !bezHodnot) setTimeout(() => { vstupM.focus(); vstupM.select(); }, 30);
    return v;
  }
  /* ----- porovnání potravin (nejvýš 4, na 100 g) ----- */
  // drží snímky; při zobrazení se bere aktuální verze potraviny (opravená vlastní potravina apod.)
  const porovnani = [];
  try { for (const f of JSON.parse(sessionStorage.getItem(KLIC + '_porovnani') || '[]')) if (f && f.id && f.n) porovnani.push(f); } catch (_) { /* nic */ }
  let tlacitkoPorovnani = null;
  function ulozPorovnani() { try { sessionStorage.setItem(KLIC + '_porovnani', JSON.stringify(porovnani)); } catch (_) { /* nic */ } }
  function vPorovnani(f) { return porovnani.some(x => x.id === f.id); }
  function prepniPorovnani(f) {
    const i = porovnani.findIndex(x => x.id === f.id);
    if (i >= 0) porovnani.splice(i, 1);
    else {
      if (porovnani.length >= 4) { D.chyba('Porovnat jde nejvýš 4 potraviny – nejdřív některou odeber.'); return; }
      porovnani.push(J.snimek(f));
      D.info(porovnani.length === 1 ? 'Přidáno do porovnání. Další potravinu přidáš tlačítkem ⚖️ v jejím detailu.' : 'Přidáno do porovnání (' + porovnani.length + ').');
    }
    ulozPorovnani();
    vykresliTlacitkoPorovnani();
  }
  function vykresliTlacitkoPorovnani() {
    if (!tlacitkoPorovnani) {
      tlacitkoPorovnani = h('button', { class: 'btn primary porovnani', type: 'button' });
      tlacitkoPorovnani.addEventListener('click', ukazPorovnani);
      document.body.appendChild(tlacitkoPorovnani);
    }
    tlacitkoPorovnani.hidden = !porovnani.length;
    document.body.classList.toggle('ma-porovnani', porovnani.length > 0);
    tlacitkoPorovnani.textContent = '⚖️ Porovnat (' + porovnani.length + ')';
  }
  // u těchto živin je lepší méně; u ostatních (bílkoviny, vláknina, vitaminy…) více
  const MENE_JE_LEPE = new Set(['kcal', 'tuk', 'nasycene', 'cukry', 'sul', 'trans', 'chol', 'alk']);
  // u těchto nemá „lepší/horší“ smysl (záleží na potřebě) – bez zvýraznění
  const NEUTRALNI = new Set(['sacharidy', 'voda', 'kof', 'mufa', 'pufa']);
  function ukazPorovnani() {
    const telo = h('div', { class: 'sheet-telo' });
    const vykresli = () => {
      telo.textContent = '';
      if (!porovnani.length) { telo.appendChild(h('p', { class: 'prazdny', text: 'Porovnání je prázdné.' })); return; }
      const aktualni = porovnani.map(f => { const a = potravina(f.id); return a && Number.isFinite(a.n.kcal) ? a : f; });
      const radky = J.porovnej(aktualni);
      const tab = h('table', { class: 'tab-porovnani', style: { width: '100%', borderCollapse: 'collapse' } });
      tab.appendChild(h('thead', {}, h('tr', {}, h('th', { text: 'na 100 g / ml' }),
        ...aktualni.map(f => h('th', { scope: 'col' }, h('div', { text: f.nazev }), f.znacka ? h('div', { class: 'slabe', text: f.znacka }) : null,
          h('button', { class: 'btn mini plain', type: 'button', 'aria-label': 'Odebrat ' + f.nazev + ' z porovnání', onclick: () => { prepniPorovnani(f); vykresli(); } }, '✕'))))));
      const tb = h('tbody');
      for (const rd of radky) {
        if (rd.s !== 'zaklad' && rd.s !== 'odvozene' && !S.nastaveni.mikro) continue;
        const zname = rd.hodnoty.filter(v => v !== null);
        const hodnotit = zname.length >= 2 && !NEUTRALNI.has(rd.k);
        const nej = hodnotit ? (MENE_JE_LEPE.has(rd.k) ? Math.min(...zname) : Math.max(...zname)) : null;
        const nejhor = hodnotit ? (MENE_JE_LEPE.has(rd.k) ? Math.max(...zname) : Math.min(...zname)) : null;
        tb.appendChild(h('tr', { class: rd.pod ? 'pod' : '' }, h('td', { text: rd.n }),
          ...rd.hodnoty.map(v => h('td', { class: v === null ? '' : nej !== nejhor && v === nej ? 'nej' : nej !== nejhor && v === nejhor ? 'nejhor' : '',
            text: v === null ? '–' : (rd.k === 'kcal' ? fc(v) + ' kcal' : fc(v, rd.d) + ' ' + rd.j) }))));
      }
      tab.appendChild(tb);
      pridat(telo, h('div', { style: { overflowX: 'auto' } }, tab),
        h('p', { class: 'slabe', style: { marginTop: '8px' }, text: 'Zeleně je příznivější hodnota (u energie, tuků, cukrů a soli nižší, u bílkovin, vlákniny, vitaminů a minerálů vyšší), červeně méně příznivá. Sacharidy a voda se nehodnotí. „–“ = údaj chybí.' }));
    };
    vykresli();
    const v = otevriVrstvu({ titulek: '⚖️ Porovnání potravin', telo, sirka: '860px',
      pata: h('div', { class: 'sheet-pata' }, h('button', { class: 'btn danger', type: 'button', onclick: () => { porovnani.length = 0; ulozPorovnani(); vykresliTlacitkoPorovnani(); v.zavri(); } }, 'Vyprázdnit'),
        h('div', { class: 'vpravo' }, h('button', { class: 'btn', type: 'button', onclick: () => v.zavri() }, 'Zavřít'))) });
  }
  function upravZaznam(k, id) {
    const z = J.najdiZaznam(S, k, id);
    if (!z) return;
    const snim = S.potraviny[z.p];
    if (!snim) return;
    if (z.rychly) { rychlyZaznam(z.j, z); return; }
    detailPotraviny(snim, { rezim: 'upravit', den: k, zaznam: z });
  }
  function doplnHodnoty(f) {
    const kopie = { nazev: f.nazev, znacka: f.znacka, ean: f.ean, n: { ...(f.n || {}) }, porce: (f.porce || []).map(p => ({ ...p })), ml: f.ml, puvod: f.id };
    editorPotraviny(kopie, nova => {
      D.info('Uloženo mezi tvé potraviny. Při příštím skenování se použije tvoje verze.');
      zavriVsechnyVrstvy();
      detailPotraviny(nova, { rezim: 'pridat', den: aktivniDen, jidlo: () => vychoziJidlo() });
    });
  }

  function tabulkaZivin(f) {
    const n = f.n || {};
    const j = jedn(f);
    const sek = h('div', { class: 'sekce' });
    const pe = J.podilEnergie(n);
    pridat(sek, h('h3', { text: 'Výživové hodnoty na 100 ' + j }));
    if (Number.isFinite(n.kcal) && (n.tuk || n.sacharidy || n.bilkoviny)) {
      pridat(sek, h('div', { class: 'pruh-makra', 'aria-hidden': 'true' },
        h('i', { style: { width: pe.bilkoviny + '%', background: 'var(--c-bil)' } }),
        h('i', { style: { width: pe.sacharidy + '%', background: 'var(--c-sach)' } }),
        h('i', { style: { width: pe.tuk + '%', background: 'var(--c-tuk)' } }),
        h('i', { style: { width: pe.alk + '%', background: 'var(--c-alk)' } })),
      h('div', { class: 'legenda' },
        h('span', { style: { '--b': 'var(--c-bil)' }, text: 'bílkoviny ' + fc(pe.bilkoviny) + ' %' }),
        h('span', { style: { '--b': 'var(--c-sach)' }, text: 'sacharidy ' + fc(pe.sacharidy) + ' %' }),
        h('span', { style: { '--b': 'var(--c-tuk)' }, text: 'tuky ' + fc(pe.tuk) + ' %' }),
        pe.alk > 0.5 ? h('span', { style: { '--b': 'var(--c-alk)' }, text: 'alkohol ' + fc(pe.alk) + ' %' }) : null));
    }
    const tab = h('table', { class: 'tab-ziviny' });
    const tb = h('tbody');
    let skup = null;
    for (const z of J.ZIVINY) {
      if (!Number.isFinite(n[z.k])) continue;
      if (z.s !== 'zaklad' && z.s !== skup) { skup = z.s; tb.appendChild(h('tr', { class: 'skup' }, h('td', { colspan: '2', text: NAZVY_SKUPIN_ZIVIN[z.s] }))); }
      const hodn = z.k === 'kcal' ? fc(n.kcal) + ' kcal (' + fc(n.kcal * 4.184) + ' kJ)' : fc(n[z.k], z.d) + ' ' + z.j;
      tb.appendChild(h('tr', { class: z.pod ? 'pod' : '' }, h('td', { text: z.n }), h('td', { text: hodn })));
    }
    tab.appendChild(tb);
    sek.appendChild(tab);
    return sek;
  }
  function popisAlergenu(t) {
    const k = String(t).toLowerCase().replace(/[^a-z0-9]/g, '');
    return DB.ciselniky.alergeny[k] || String(t).replace(/-/g, ' ');
  }
  function popisAditiva(t) {
    const k = String(t).toLowerCase().replace(/[^a-z0-9]/g, '');
    return DB.ciselniky.aditiva[k] || String(t).toUpperCase();
  }
  async function vykresliSlozeni(f, sek) {
    if (f.typ === 'r' && S.recepty[f.id]) {
      const r = S.recepty[f.id];
      pridat(sek, h('h3', { text: 'Suroviny receptu' }),
        h('ul', { class: 'seznam' }, ...r.suroviny.map(s => h('li', {}, h('span', { class: 'nazev', text: s.f.nazev }), h('span', { class: 'slabe', text: fc(s.g) + ' ' + jedn(s.f) })))));
      if (r.postup) pridat(sek, h('h3', { text: 'Postup', style: { marginTop: '10px' } }), h('p', { class: 'slozeni-text', style: { whiteSpace: 'pre-wrap' }, text: r.postup }));
      return;
    }
    if (f.typ === 'o' && f.slozeni) { pridat(sek, h('h3', { text: 'Složení' }), h('p', { class: 'slozeni-text', text: f.slozeni })); return; }
    if (!f.ean || (f.typ !== 'v' && !(f.typ === 'm' && DB.podleEan.has(f.ean)))) return;
    pridat(sek, h('p', { class: 'slabe' }, h('span', { class: 'nacitani' }), ' načítám složení…'));
    let data;
    try { await nactiSlozeni(); data = DB.slozeni[f.ean]; }
    catch (e) { sek.textContent = ''; pridat(sek, h('p', { class: 'slabe', text: 'Složení se nepodařilo načíst.' })); return; }
    sek.textContent = '';
    if (!data) { pridat(sek, h('p', { class: 'slabe', text: 'Složení výrobku v databázi chybí.' })); return; }
    const [text, jazyk, al, stopy, adit, stit] = data;
    if (text) pridat(sek, h('h3', { text: 'Složení' + (jazyk && jazyk !== 'cs' ? ' (' + jazyk + ')' : '') }), h('p', { class: 'slozeni-text', text }));
    if (al && al.length) pridat(sek, h('p', { style: { marginTop: '8px', fontSize: '.86rem' } }, h('b', { text: 'Alergeny: ' }), al.filter(a => a !== 'none').map(popisAlergenu).join(', ') || 'žádné'));
    if (stopy && stopy.length) pridat(sek, h('p', { style: { fontSize: '.86rem' } }, h('b', { text: 'Může obsahovat stopy: ' }), stopy.map(popisAlergenu).join(', ')));
    if (adit && adit.length) pridat(sek, h('p', { style: { fontSize: '.86rem', marginTop: '6px' } }, h('b', { text: 'Přídatné látky: ' }), adit.map(popisAditiva).join(', ')));
    if (stit && stit.length) {
      const st = { vegan: 'veganské', vegetarian: 'vegetariánské', 'gluten-free': 'bez lepku', organic: 'bio', 'eu-organic': 'bio (EU)', 'no-lactose': 'bez laktózy', 'lactose-free': 'bez laktózy', 'palm-oil-free': 'bez palmového oleje', 'no-added-sugar': 'bez přidaného cukru' };
      pridat(sek, h('div', { class: 'stitky', style: { marginTop: '6px' } }, ...[...new Set(stit.map(s => st[s] || s))].map(s => h('span', { class: 'stitek', text: '✓ ' + s }))));
    }
  }
  function zdrojPotraviny(f) {
    if (f.typ === 'v') return ['Zdroj: ', h('a', { href: 'https://world.openfoodfacts.org/product/' + encodeURIComponent(f.ean), target: '_blank', rel: 'noopener', text: 'Open Food Facts' }),
      ' (ODbL), údaje k ' + (DB.meta.vyrobky ? DB.meta.vyrobky.stazeno : '') + (f.rok ? ', poslední úprava výrobku ' + f.rok : '') + '. Údaje vkládají dobrovolníci.'];
    if (f.typ === 'o') return ['Zdroj: Open Food Facts (ODbL), staženo online.'];
    if (f.typ === 's') return ['Zdroj: USDA FoodData Central (CC0) – „' + (f.popis || '') + '“. Výběr a český název: autor aplikace.'];
    if (f.typ === 'm') return ['Tvoje vlastní potravina' + (f.puvod ? ' (upravená kopie)' : '') + '.'];
    if (f.typ === 'r') return ['Tvůj recept – hodnoty spočítané ze surovin.'];
    if (f.typ === 'q') return ['Rychlý záznam.'];
    return [];
  }

  /* ----- rychlý záznam ----- */
  function rychlyZaznam(jid, z) {
    const den = aktivniDen;
    const f = z ? S.potraviny[z.p] : null;
    const pole = {};
    const vytvor = (kl, nazev, krok) => {
      pole[kl] = h('input', { class: 'vstup', type: 'text', inputmode: 'decimal', autocomplete: 'off', 'data-krok': krok || '1', value: f && Number.isFinite(f.n[kl]) ? String(J.zaokrouhli(f.n[kl], 1)) : '' });
      return h('label', { class: 'pole' }, nazev, pole[kl]);
    };
    const nazev = h('input', { class: 'vstup', type: 'text', maxlength: '80', placeholder: 'např. Oběd v restauraci', value: f ? f.nazev : '' });
    const telo = h('div', { class: 'sheet-telo' },
      h('p', { class: 'slabe', style: { marginBottom: '10px' }, text: 'Pro jídla, která nechceš rozepisovat. Zadej hodnoty za celou porci – stačí energie, nebo jen makroživiny (energie se dopočítá).' }),
      h('div', { class: 'form' }, h('label', { class: 'pole siroke' }, 'Název', nazev),
        vytvor('kcal', 'Energie (kcal)'), vytvor('bilkoviny', 'Bílkoviny (g)', '0.1'), vytvor('sacharidy', 'Sacharidy (g)', '0.1'), vytvor('tuk', 'Tuky (g)', '0.1')));
    const ulozit = h('button', { class: 'btn primary', type: 'button' }, z ? 'Uložit' : 'Přidat');
    const pata = h('div', { class: 'sheet-pata' },
      z ? h('button', { class: 'btn danger', type: 'button', onclick: () => { v.zavri(); sVracenim('Smazáno: ' + (f ? f.nazev : 'rychlý záznam'), () => J.smazZaznam(S, den, z.id)); } }, '🗑️ Smazat') : null,
      h('div', { class: 'vpravo' }, h('button', { class: 'btn', type: 'button', onclick: () => v.zavri() }, 'Zrušit'), ulozit));
    const v = otevriVrstvu({ titulek: '⚡ Rychlý záznam – ' + nazevJidla(jid), telo, pata, sirka: '480px' });
    ulozit.addEventListener('click', () => {
      const n = {};
      for (const kl in pole) n[kl] = J.cislo(pole[kl].value);
      try {
        // nejdřív vytvořit nový (může selhat na validaci), teprve pak odstranit původní
        const novy = J.rychlyZaznam(S, den, jid, nazev.value.trim() || 'Rychlý záznam', n);
        if (z) { J.smazZaznam(S, den, z.id); novy.j = z.j; }
        uloz(); v.zavri(); vykresliDenik();
      } catch (e) { D.chyba(e.message); }
    });
    telo.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); ulozit.click(); } });
    setTimeout(() => (f ? pole.kcal : nazev).focus(), 30);
  }

  /* ----- pohyb ----- */
  function upravPohyb(id) {
    const den = aktivniDen;
    const d = J.den(S, den);
    const p = id ? d.pohyb.find(x => x.id === id) : null;
    const nazev = h('input', { class: 'vstup', type: 'text', maxlength: '60', placeholder: 'např. Běh, kolo, posilovna', value: p ? p.nazev : '' });
    const minuty = h('input', { class: 'vstup', type: 'number', min: '0', max: '1440', step: '1', inputmode: 'numeric', value: p && p.minuty ? String(p.minuty) : '' });
    const kcal = h('input', { class: 'vstup', type: 'number', min: '0', max: '10000', step: '1', inputmode: 'numeric', value: p ? String(p.kcal) : '' });
    const telo = h('div', { class: 'sheet-telo' },
      h('div', { class: 'form' }, h('label', { class: 'pole siroke' }, 'Aktivita', nazev),
        h('label', { class: 'pole' }, 'Doba (min)', minuty), h('label', { class: 'pole' }, 'Spáleno (kcal)', kcal)),
      h('p', { class: 'slabe', style: { marginTop: '10px' }, text: 'Hodnotu spálené energie převezmi ze sporttesteru nebo aplikace. Odhady bývají nadsazené – proto lze přičítání k cíli vypnout v nastavení profilu.' }));
    const ulozit = h('button', { class: 'btn primary', type: 'button' }, p ? 'Uložit' : 'Přidat');
    const pata = h('div', { class: 'sheet-pata' },
      p ? h('button', { class: 'btn danger', type: 'button', onclick: () => { v.zavri(); sVracenim('Smazáno: ' + (p.nazev || 'aktivita'), () => { const dd = S.dny[den]; if (dd) dd.pohyb = dd.pohyb.filter(x => x.id !== id); }); } }, '🗑️ Smazat') : null,
      h('div', { class: 'vpravo' }, h('button', { class: 'btn', type: 'button', onclick: () => v.zavri() }, 'Zrušit'), ulozit));
    const v = otevriVrstvu({ titulek: '🏃 Pohyb', telo, pata, sirka: '440px' });
    ulozit.addEventListener('click', () => {
      const k = J.cislo(kcal.value);
      if (k === null || k < 0 || k > 10000) { D.chyba('Zadej spálenou energii v kcal.'); kcal.focus(); return; }
      const x = { id: p ? p.id : J.noveId('p'), nazev: nazev.value.trim() || 'Aktivita', kcal: Math.round(k) };
      const m = J.cislo(minuty.value); if (m) x.minuty = Math.round(m);
      // stav mohl být mezitím nahrazen (jiná záložka, Vrátit) – pracovat s aktuálním dnem
      const dd = J.den(S, den);
      const pp = p ? dd.pohyb.find(q => q.id === p.id) : null;
      if (pp) Object.assign(pp, x); else dd.pohyb.push(x);
      uloz(); v.zavri(); vykresliDenik();
    });
    telo.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); ulozit.click(); } });
    setTimeout(() => nazev.focus(), 30);
  }

  /* ----- detail všech živin dne ----- */
  function detailDne(k) {
    const s = J.souhrnDne(S, k);
    const c0 = cileDne(k);
    const c = c0.kcal && S.nastaveni.pohybKCili && s.pohyb ? { ...c0, kcal: c0.kcal + s.pohyb } : c0;
    const telo = h('div', { class: 'sheet-telo' });
    if (!s.pocet) telo.appendChild(h('p', { class: 'prazdny', text: 'V tento den zatím nic není zapsáno.' }));
    else { telo.appendChild(tabulkaPlneni(s.celkem, c, s.pokryti, 'Za den')); telo.appendChild(kartaZdroju(k, k, true)); }
    otevriVrstvu({ titulek: 'Živiny – ' + J.popisDne(k, J.datumKlic(new Date())), telo, sirka: '640px' });
  }
  // tabulka hodnot s cíli; pokryti = podíl energie, u kterého je hodnota známá
  function tabulkaPlneni(hodn, c, pokryti, nadpis) {
    const tab = h('table', { class: 'tab-ziviny' });
    tab.appendChild(h('thead', {}, h('tr', {}, h('th', { text: 'Živina' }), h('th', { text: nadpis || 'Množství' }), h('th', { text: 'Cíl / limit' }), h('th', { text: 'Plnění' }))));
    const tb = h('tbody');
    let skup = null;
    for (const z of J.ZIVINY) {
      if (z.s !== 'zaklad' && !S.nastaveni.mikro) continue;
      const v = hodn[z.k];
      const cil = c.zivinyCil[z.k] || (z.k === 'kcal' ? c.kcal : null);
      const limit = c.limity[z.k];
      if (!Number.isFinite(v) && !cil) continue;
      if (z.s !== 'zaklad' && z.s !== skup) { skup = z.s; tb.appendChild(h('tr', { class: 'skup' }, h('td', { colspan: '4', text: NAZVY_SKUPIN_ZIVIN[z.s] }))); }
      const pok = pokryti && pokryti[z.k];
      const malePokryti = z.s !== 'zaklad' && pok !== undefined && pok < 0.7;
      let pln = null;
      const ref = cil || limit;
      if (ref && Number.isFinite(v)) {
        const p = 100 * v / ref;
        // limit (cukry, nasycené tuky, sůl): nad 100 % špatně; cíl: pod 70 % málo, energie a makra nad 115 % moc
        const tr = limit && !cil ? (p > 100 ? 'moc' : '') : p < 70 ? 'malo' : (['kcal', 'tuk', 'sacharidy', 'bilkoviny'].includes(z.k) && p > 115 ? 'moc' : '');
        pln = h('span', {}, h('span', { class: 'procento', text: fc(p) + ' %' }), h('span', { class: 'minibar', 'aria-hidden': 'true' }, h('i', { class: tr, style: { width: Math.min(100, p) + '%' } })));
      }
      const ul = c.limity[z.k + '_ul'];
      tb.appendChild(h('tr', { class: z.pod ? 'pod' : '' },
        h('td', {}, z.n, malePokryti ? h('div', { class: 'pokryti', text: 'údaj zná ' + fc(100 * pok) + ' % zapsaného jídla' }) : null),
        h('td', { text: Number.isFinite(v) ? fc(v, z.d) + ' ' + z.j : '–' }),
        h('td', { text: cil ? fc(cil, z.d) + ' ' + z.j : limit ? 'max. ' + fc(limit, z.d) + ' ' + z.j : '', title: ul ? 'Horní tolerovatelný příjem (EFSA): ' + fc(ul) + ' ' + z.j : null }),
        h('td', {}, pln)));
    }
    tab.appendChild(tb);
    return h('div', {}, tab,
      h('p', { class: 'slabe', style: { marginTop: '8px' } }, 'Cíle: energie a makroživiny podle profilu; vitaminy a minerály podle referenčních hodnot ',
        h('a', { href: 'https://multimedia.efsa.europa.eu/drvs/index.htm', target: '_blank', rel: 'noopener', text: 'EFSA' }),
        ' pro dospělé (PRI/AI); limity cukrů a nasycených tuků 10 % energie (WHO), sůl 5 g. U výrobků jsou vitaminy a minerály uvedené jen zřídka – součet je pak podhodnocený. ' +
        'Niacin z databáze USDA nezahrnuje tryptofan, skutečný příjem (v ekvivalentech NE) je vyšší. Horní limity (UL) jsou uvedené v popisku cíle.'));
  }

  /* ================= POTRAVINY A RECEPTY ================= */
  function vykresliPotraviny() {
    const q = J.norm($('#hledatVlastni').value);
    const ul = $('#seznamVlastni');
    ul.textContent = '';
    const vl = Object.values(S.vlastni).filter(f => !q || J.norm(f.nazev + ' ' + f.znacka + ' ' + (f.ean || '')).includes(q)).sort((a, b) => a.nazev.localeCompare(b.nazev, 'cs'));
    if (!vl.length) ul.appendChild(h('li', { class: 'slabe', text: q ? 'Nic nenalezeno.' : 'Zatím žádné. Vytvoř potravinu z etikety výrobku, který v databázi chybí.' }));
    for (const f of vl) {
      ul.appendChild(h('li', {},
        h('div', { class: 'nazev' }, h('div', { text: f.nazev }), h('div', { class: 'slabe', text: [f.znacka, f.ean ? 'EAN ' + f.ean : '', kcalText(f.n.kcal) + '/100 ' + jedn(f)].filter(Boolean).join(' · ') })),
        h('button', { class: 'btn mini', type: 'button', title: 'Přidat do deníku', onclick: () => detailPotraviny(f, { rezim: 'pridat', den: aktivniDen, jidlo: () => vychoziJidlo() }) }, '+'),
        h('button', { class: 'btn mini', type: 'button', onclick: () => editorPotraviny(f, () => vykresliPotraviny()) }, 'Upravit')));
    }
    const ur = $('#seznamRecepty');
    ur.textContent = '';
    const rec = Object.values(S.recepty).sort((a, b) => a.nazev.localeCompare(b.nazev, 'cs'));
    if (!rec.length) ur.appendChild(h('li', { class: 'slabe', text: 'Zatím žádné. Recept spočítá živiny na porci ze surovin – stačí je jednou zadat.' }));
    for (const r of rec) {
      const v = J.spocitejRecept(r);
      ur.appendChild(h('li', {},
        h('div', { class: 'nazev' }, h('div', { text: r.nazev }),
          h('div', { class: 'slabe', text: J.pocet(r.suroviny.length, 'surovina', 'suroviny', 'surovin') + ' · ' + J.pocet(v.porci, 'porce', 'porce', 'porcí') + ' · ' + kcalText((v.celkem.kcal || 0) / v.porci) + ' na porci' })),
        h('button', { class: 'btn mini', type: 'button', title: 'Přidat do deníku', onclick: () => detailPotraviny(J.receptJakoPotravina(r), { rezim: 'pridat', den: aktivniDen, jidlo: () => vychoziJidlo() }) }, '+'),
        h('button', { class: 'btn mini', type: 'button', onclick: () => editorReceptu(r) }, 'Upravit'),
        h('button', { class: 'btn mini plain', type: 'button', title: 'Duplikovat recept', 'aria-label': 'Duplikovat recept ' + r.nazev, onclick: () => {
          editorReceptu({ ...r, id: null, nazev: r.nazev + ' (kopie)', suroviny: r.suroviny.map(s => ({ ...s })) });
        } }, '⧉')));
    }
    vykresliSablonyPotraviny();
    vykresliProchazeni();
  }
  function vykresliSablonyPotraviny() {
    const ul = $('#seznamSablon');
    ul.textContent = '';
    const sb = Object.values(S.sablony).sort((a, b) => a.nazev.localeCompare(b.nazev, 'cs'));
    if (!sb.length) { ul.appendChild(h('li', { class: 'slabe', text: 'Zatím žádná.' })); return; }
    for (const s of sb) {
      const c = J.souhrnSablony(s);
      ul.appendChild(h('li', {},
        h('div', { class: 'nazev' }, h('div', { text: s.nazev }),
          h('div', { class: 'slabe', text: J.pocet(s.polozky.length, 'položka', 'položky', 'položek') + ' · ' + kcalText(c.kcal) + ' · ' + s.polozky.map(p => p.f.nazev).join(', ') })),
        h('button', { class: 'btn mini', type: 'button', title: 'Přidat do deníku (' + nazevJidla(vychoziJidlo()) + ')', 'aria-label': 'Přidat ' + s.nazev + ' do deníku', onclick: () => { pouzijSablonu(s, aktivniDen, vychoziJidlo()); } }, '+'),
        zastaraleSnimky(s.polozky) ? h('button', { class: 'btn mini', type: 'button', title: 'Některá potravina má mezitím jiné hodnoty (např. opravená vlastní potravina) – převzít aktuální',
          onclick: () => sVracenim('Aktualizováno: ' + s.nazev, () => { aktualizujSnimky(s.polozky); s.zmeneno = Date.now(); }) }, '↻ Aktualizovat (' + zastaraleSnimky(s.polozky) + ')') : null,
        h('button', { class: 'btn mini', type: 'button', onclick: async () => {
          const n = await D.zeptej('Nový název uloženého jídla', s.nazev);
          if (n && n.trim()) { s.nazev = n.trim().slice(0, 80); s.zmeneno = Date.now(); uloz(); vykresliPotraviny(); }
        } }, 'Přejmenovat'),
        h('button', { class: 'btn mini plain danger', type: 'button', 'aria-label': 'Smazat uložené jídlo ' + s.nazev, onclick: () => sVracenim('Smazáno uložené jídlo: ' + s.nazev, () => { delete S.sablony[s.id]; }) }, '✕')));
    }
  }
  let prochazetCasovac = null;
  function vykresliProchazeni() {
    const ul = $('#prochazetVysledky'), info = $('#prochazetInfo');
    const sel = $('#prochazetSkupina');
    if (sel.options.length === 1) {
      const pocty = {};
      for (const f of DB.suroviny.concat(DB.vyrobky)) pocty[f.skupina] = (pocty[f.skupina] || 0) + 1;
      const sk = Object.keys(pocty).filter(k => J.SKUPINY[k]);
      const nazvy = [...new Set(sk.map(k => J.SKUPINY[k]))].sort((a, b) => a.localeCompare(b, 'cs'));
      for (const n of nazvy) sel.appendChild(h('option', { value: n }, n + ' (' + sk.filter(k => J.SKUPINY[k] === n).reduce((s, k) => s + pocty[k], 0) + ')'));
    }
    ul.textContent = '';
    if (!DB.nacteno) { info.textContent = DB.chyba ? 'Databáze není načtená.' : 'Databáze se načítá…'; return; }
    const q = $('#prochazetDotaz').value.trim();
    const skup = sel.value, raz = $('#prochazetRazeni').value;
    const ok = f => (!skup || J.SKUPINY[f.skupina] === skup) && Number.isFinite(f.n.kcal);
    let pol;
    if (q) pol = J.hledej(DB.vse, q, { limit: 400, filtr: ok });
    else if (skup || raz !== 'relevance') pol = DB.suroviny.concat(DB.vyrobky).filter(ok);
    else { info.textContent = 'Zadej hledaný výraz nebo vyber skupinu či řazení.'; return; }
    const na100kcal = (f, k) => f.n.kcal > 5 ? (f.n[k] || 0) / f.n.kcal * 100 : -1;
    const razeni = {
      bilkoviny: (a, b) => na100kcal(b, 'bilkoviny') - na100kcal(a, 'bilkoviny'),
      vlaknina: (a, b) => na100kcal(b, 'vlaknina') - na100kcal(a, 'vlaknina'),
      'kcal-': (a, b) => a.n.kcal - b.n.kcal, 'kcal+': (a, b) => b.n.kcal - a.n.kcal,
      cukry: (a, b) => (a.n.cukry ?? 99) - (b.n.cukry ?? 99), sul: (a, b) => (a.n.sul ?? 99) - (b.n.sul ?? 99),
    }[raz];
    if (razeni) pol = pol.filter(f => !(f.priznaky & 1)).sort(razeni);
    const celkem = pol.length;
    pol = pol.slice(0, 150);
    const fr = document.createDocumentFragment();
    for (const f of pol) {
      let extra = '';
      if (raz === 'bilkoviny') extra = fc(na100kcal(f, 'bilkoviny'), 1) + ' g bílk./100 kcal';
      if (raz === 'vlaknina') extra = fc(na100kcal(f, 'vlaknina'), 1) + ' g vlák./100 kcal';
      if (raz === 'cukry') extra = fc(f.n.cukry, 1) + ' g cukrů';
      if (raz === 'sul') extra = fc(f.n.sul, 2) + ' g soli';
      fr.appendChild(radekVysledku(f, q, ff => detailPotraviny(ff, { rezim: 'pridat', den: aktivniDen, jidlo: () => vychoziJidlo() }), null, extra, true));
    }
    ul.appendChild(fr);
    info.textContent = (pol.tolerantni ? 'Přesná shoda nenalezena – podobně psané výsledky. ' : '') +
      (celkem > pol.length ? 'Zobrazeno ' + pol.length + ' z ' + fc(celkem) + ' – upřesni hledání.' : celkem ? J.pocet(celkem, 'položka', 'položky', 'položek') + '.' : 'Nic nenalezeno.');
  }

  /* ----- editor vlastní potraviny ----- */
  function editorPotraviny(f, poUlozeni) {
    f = f || {};
    const existujici = f.id && f.id[0] === 'm' && S.vlastni[f.id];
    const n = f.n || {};
    const pole = {};
    const vstup = (kl, popis, krok, extra) => {
      pole[kl] = h('input', Object.assign({ class: 'vstup', type: 'text', inputmode: 'decimal', autocomplete: 'off', 'data-krok': krok || '0.1',
        value: Number.isFinite(n[kl]) ? String(n[kl]) : '' }, extra || {}));
      return h('label', { class: 'pole' }, popis, pole[kl]);
    };
    const nazev = h('input', { class: 'vstup', type: 'text', maxlength: '120', required: true, value: f.nazev || '' });
    const znacka = h('input', { class: 'vstup', type: 'text', maxlength: '40', value: f.znacka || '' });
    const ean = h('input', { class: 'vstup', type: 'text', inputmode: 'numeric', maxlength: '14', value: f.ean || '' });
    const ml = h('select', { class: 'vstup' }, h('option', { value: '0' }, 'gramy (g)'), h('option', { value: '1' }, 'mililitry (ml)'));
    ml.value = f.ml ? '1' : '0';
    // nápoj: druh (porce, pitný režim) a alkohol v % obj. jako na etiketě
    const druhV = h('select', { class: 'vstup' }, h('option', { value: '' }, 'není nápoj / určit podle názvu'),
      ...Object.entries(J.DRUHY_NAPOJU).map(([k, d]) => h('option', { value: k }, d.n)));
    druhV.value = f.druh && J.DRUHY_NAPOJU[f.druh] ? f.druh : '';
    const alkObj = h('input', { class: 'vstup', type: 'text', inputmode: 'decimal', autocomplete: 'off', placeholder: 'např. 4,9',
      value: Number.isFinite(n.alk) ? String(J.zaokrouhli(n.alk / 0.789, 1)).replace('.', ',') : '' });
    const napojPole = h('div', { class: 'form', style: { marginTop: '8px' } },
      h('label', { class: 'pole' }, 'Druh nápoje', druhV), h('label', { class: 'pole' }, 'Alkohol (% obj.)', alkObj));
    const ukazNapoj = () => { napojPole.hidden = ml.value !== '1'; };
    ml.addEventListener('change', ukazNapoj); ukazNapoj();
    const kj = h('input', { class: 'vstup', type: 'number', min: '0', step: '1', inputmode: 'numeric', placeholder: 'kJ' });
    if (Number.isFinite(n.kcal)) kj.value = String(Math.round(n.kcal * 4.184));
    const zakl = h('div', { class: 'ziviny-form' },
      vstup('kcal', 'Energie (kcal)', '1'), h('label', { class: 'pole' }, 'nebo energie (kJ)', kj),
      vstup('tuk', 'Tuky (g)'), vstup('nasycene', '– z toho nasycené (g)'),
      vstup('sacharidy', 'Sacharidy (g)'), vstup('cukry', '– z toho cukry (g)'),
      vstup('vlaknina', 'Vláknina (g)'), vstup('bilkoviny', 'Bílkoviny (g)'), vstup('sul', 'Sůl (g)', '0.01'));
    pole.kcal.addEventListener('input', () => { const v = J.cislo(pole.kcal.value); kj.value = v !== null ? String(Math.round(v * 4.184)) : ''; });
    kj.addEventListener('input', () => { const v = J.cislo(kj.value); pole.kcal.value = v !== null ? String(Math.round(v / 4.184)) : ''; kontrola(); });
    const mikro = h('div', { class: 'ziviny-form' });
    for (const z of J.ZIVINY) if (z.s !== 'zaklad') mikro.appendChild(vstup(z.k, z.n + ' (' + z.j + ')', z.d >= 2 ? '0.01' : z.d === 1 ? '0.1' : '1'));
    // % obj. ↔ g alkoholu na 100 ml (1 % obj. = 0,789 g)
    if (pole.alk) {
      alkObj.addEventListener('input', () => { const v = J.cislo(alkObj.value); pole.alk.value = v !== null && v >= 0 && v <= 96 ? String(J.zaokrouhli(v * 0.789, 2)) : ''; kontrola(); });
      pole.alk.addEventListener('input', () => { const v = J.cislo(pole.alk.value); alkObj.value = v !== null ? String(J.zaokrouhli(v / 0.789, 1)).replace('.', ',') : ''; });
    }
    const porceKont = h('div', {});
    const porce = (f.porce || []).map(p => ({ ...p }));
    function vykresliPorce() {
      porceKont.textContent = '';
      porce.forEach((p, i) => {
        const n1 = h('input', { class: 'vstup', type: 'text', maxlength: '40', value: p.n || '', placeholder: 'např. plátek, kus, kelímek', 'aria-label': 'Název porce' });
        const g1 = h('input', { class: 'vstup', type: 'text', inputmode: 'decimal', autocomplete: 'off', value: p.g || '', 'aria-label': 'Hmotnost porce', style: { width: '90px' } });
        n1.addEventListener('input', () => { p.n = n1.value; });
        g1.addEventListener('input', () => { p.g = J.cislo(g1.value); });
        porceKont.appendChild(h('div', { class: 'radek', style: { marginBottom: '6px' } }, n1, g1, h('span', { class: 'slabe', text: ml.value === '1' ? 'ml' : 'g' }),
          h('button', { class: 'btn mini plain', type: 'button', 'aria-label': 'Odebrat porci', onclick: () => { porce.splice(i, 1); vykresliPorce(); } }, '✕')));
      });
      porceKont.appendChild(h('button', { class: 'btn mini', type: 'button', onclick: () => { porce.push({ n: '', g: null }); vykresliPorce(); porceKont.querySelector('.radek:last-of-type input').focus(); } }, '+ Přidat porci'));
    }
    vykresliPorce();
    const chyby = h('div', { class: 'chyba-text', style: { fontSize: '.84rem', whiteSpace: 'pre-line', minHeight: '1em' }, 'aria-live': 'polite' });
    const sedi = h('div', { class: 'slabe' });
    function sesbirej() {
      const x = { id: existujici ? f.id : null, nazev: nazev.value.trim(), znacka: znacka.value.trim(), ean: ean.value.replace(/\D/g, ''),
        ml: ml.value === '1', n: {}, porce: porce.filter(p => p.n && p.g > 0), puvod: f.puvod, skupina: f.skupina, druh: ml.value === '1' ? druhV.value : '' };
      for (const kl in pole) { const v = J.cislo(pole[kl].value); if (v !== null) x.n[kl] = v; }
      if (!Number.isFinite(x.n.kcal)) { const e = J.energieZMaker(x.n); if (e !== null) x.n.kcal = Math.round(e); }
      return x;
    }
    function kontrola() {
      const x = sesbirej();
      const e = J.energieZMaker(x.n);
      sedi.textContent = e !== null && Number.isFinite(J.cislo(pole.kcal.value)) ? 'Energie spočtená z makroživin: ' + fc(e) + ' kcal' + (J.energieSedi(x.n) === false ? ' – nesedí se zadanou, zkontroluj opis.' : ' ✓') : '';
    }
    zakl.addEventListener('input', kontrola);
    const telo = h('div', { class: 'sheet-telo' },
      h('p', { class: 'slabe', style: { marginBottom: '10px' }, text: 'Opiš údaje z etikety – hodnoty na 100 g (nebo 100 ml). Údaje z obalu výrobku, který máš doma, smíš volně zapsat.' }),
      h('div', { class: 'form' },
        h('label', { class: 'pole siroke' }, 'Název *', nazev),
        h('label', { class: 'pole' }, 'Značka', znacka),
        h('label', { class: 'pole' }, 'EAN (čárový kód)', ean),
        h('label', { class: 'pole' }, 'Hodnoty se vztahují na', ml)),
      napojPole,
      h('h3', { style: { margin: '14px 0 8px' }, text: 'Výživové hodnoty na 100 g / 100 ml' }), zakl, sedi,
      h('details', { style: { marginTop: '12px' } }, h('summary', { style: { cursor: 'pointer', fontSize: '.9rem' }, text: 'Vitaminy, minerály a další (nepovinné)' }), h('div', { style: { marginTop: '8px' } }, mikro)),
      h('h3', { style: { margin: '14px 0 8px' }, text: 'Porce' }), porceKont, chyby);
    const ulozit = h('button', { class: 'btn primary', type: 'button' }, 'Uložit');
    const pata = h('div', { class: 'sheet-pata' },
      existujici ? h('button', { class: 'btn danger', type: 'button', onclick: async () => {
        if (!(await D.potvrd('Smazat potravinu „' + f.nazev + '“? Záznamy v deníku zůstanou.', { ok: 'Smazat' }))) return;
        delete S.vlastni[f.id];
        S.oblibene = S.oblibene.filter(x => x !== f.id);
        uloz(); obnovIndexUzivatele(); v.zavri(); vykresliPohled();
      } }, '🗑️ Smazat') : null,
      f.ean && !existujici ? h('a', { class: 'btn mini plain', href: 'https://world.openfoodfacts.org/product/' + encodeURIComponent(f.ean), target: '_blank', rel: 'noopener', title: 'Výrobek můžeš doplnit i do Open Food Facts – pomůžeš ostatním' }, '🌐 Doplnit do Open Food Facts') : null,
      h('div', { class: 'vpravo' }, h('button', { class: 'btn', type: 'button', onclick: () => v.zavri() }, 'Zrušit'), ulozit));
    const v = otevriVrstvu({ titulek: existujici ? 'Upravit potravinu' : 'Nová potravina', telo, pata, sirka: '640px' });
    ulozit.addEventListener('click', () => {
      const x = sesbirej();
      const ch = J.overPotravinu(x);
      if (ch.length) { chyby.textContent = ch.join('\n'); return; }
      try {
        const ul = J.ulozVlastni(S, x);
        uloz(); obnovIndexUzivatele(); v.zavri();
        if (poUlozeni) poUlozeni(ul);
        if (pohled === 'potraviny') vykresliPotraviny();
      } catch (e) { chyby.textContent = e.message; }
    });
    kontrola();
    setTimeout(() => (nazev.value ? pole.kcal : nazev).focus(), 30);
  }

  /* ----- editor receptu ----- */
  function editorReceptu(r) {
    r = r || {};
    const existujici = r.id && S.recepty[r.id];
    const suroviny = (r.suroviny || []).map(s => ({ f: s.f, g: s.g }));
    const nazev = h('input', { class: 'vstup', type: 'text', maxlength: '120', value: r.nazev || '' });
    const porci = h('input', { class: 'vstup', type: 'number', min: '1', max: '100', step: '1', value: String(r.porci || 4) });
    const hmotnost = h('input', { class: 'vstup', type: 'number', min: '0', step: '1', placeholder: 'součet surovin', value: r.hmotnost ? String(r.hmotnost) : '' });
    const postup = h('textarea', { class: 'vstup', rows: '4', maxlength: '5000', placeholder: 'Postup (nepovinný)' });
    postup.value = r.postup || '';
    const seznam = h('div', { class: 'suroviny-receptu' });
    const vysledek = h('div', { class: 'vypocet', style: { marginTop: '12px' } });
    const pozn = h('p', { class: 'slabe' });
    function prepocti() {
      const x = J.spocitejRecept({ suroviny, porci: porci.value, hmotnost: hmotnost.value });
      const p = {}; for (const k in x.celkem) p[k] = x.celkem[k] / x.porci;
      vysledek.textContent = '';
      const b = (t, v, d) => h('div', {}, h('b', { text: v }), h('span', { text: t }));
      pridat(vysledek, b('kcal na porci', fc(p.kcal || 0)), b('bílkoviny / porce', fc(p.bilkoviny || 0, 1) + ' g'), b('sacharidy / porce', fc(p.sacharidy || 0, 1) + ' g'), b('tuky / porce', fc(p.tuk || 0, 1) + ' g'));
      pozn.textContent = suroviny.length ? 'Celkem ' + fc(x.celkem.kcal || 0) + ' kcal · syrové suroviny ' + fc(x.syrova) + ' g · hotové jídlo ' + fc(x.hotova) + ' g · porce ' + fc(x.porceG) + ' g · ' + fc(x.na100.kcal || 0) + ' kcal/100 g' +
        (x.neuplne.length ? '. Pozor: u některé suroviny chybí ' + x.neuplne.map(k => J.ZIV[k].n.toLowerCase()).join(', ') + '.' : '') : '';
    }
    function vykresliSuroviny() {
      seznam.textContent = '';
      if (!suroviny.length) seznam.appendChild(h('p', { class: 'slabe', text: 'Přidej suroviny tlačítkem níže.' }));
      suroviny.forEach((s, i) => {
        const g = h('input', { class: 'vstup', type: 'text', inputmode: 'decimal', autocomplete: 'off', value: String(s.g).replace('.', ','), 'aria-label': 'Množství ' + s.f.nazev });
        g.addEventListener('input', () => { s.g = J.cislo(g.value) || 0; prepocti(); });
        seznam.appendChild(h('div', { class: 'radek' },
          h('div', { class: 'nazev', style: { flex: '1', minWidth: '0' } }, h('div', { text: s.f.nazev }), h('div', { class: 'slabe', text: [s.f.znacka, kcalText((s.f.n.kcal || 0) * s.g / 100)].filter(Boolean).join(' · ') })),
          g, h('span', { class: 'slabe', text: jedn(s.f) }),
          h('button', { class: 'btn mini plain', type: 'button', 'aria-label': 'Odebrat ' + s.f.nazev, onclick: () => { suroviny.splice(i, 1); vykresliSuroviny(); } }, '✕')));
      });
      prepocti();
    }
    porci.addEventListener('input', prepocti);
    hmotnost.addEventListener('input', prepocti);
    const telo = h('div', { class: 'sheet-telo' },
      h('div', { class: 'form' },
        h('label', { class: 'pole siroke' }, 'Název receptu *', nazev),
        h('label', { class: 'pole' }, 'Počet porcí', porci),
        h('label', { class: 'pole' }, 'Hmotnost hotového jídla (g)', hmotnost, h('small', { text: 'zvaž po uvaření – zohlední odpar/nasáknutí' }))),
      h('div', { class: 'radek', style: { margin: '14px 0 6px' } }, h('h3', { text: 'Suroviny', style: { marginRight: 'auto' } }),
        zastaraleSnimky(suroviny) ? h('button', { class: 'btn mini', type: 'button', title: 'Některá surovina má mezitím jiné hodnoty – převzít aktuální', onclick: e => {
          aktualizujSnimky(suroviny); e.currentTarget.remove(); vykresliSuroviny(); D.info('Suroviny aktualizovány – nezapomeň recept uložit.');
        } }, '↻ Aktualizovat suroviny (' + zastaraleSnimky(suroviny) + ')') : null,
        h('button', { class: 'btn mini', type: 'button', title: 'Přepočítat množství surovin na jiný počet porcí', onclick: async () => {
          const puv = Math.max(1, Math.round(J.cislo(porci.value) || 1));
          const zadano = J.cislo(await D.zeptej('Přepočítat recept z ' + J.pocet(puv, 'porce', 'porcí', 'porcí') + ' na kolik porcí? (celé číslo)', String(puv)));
          if (!zadano || zadano <= 0 || zadano > 200) return;
          const n = Math.max(1, Math.round(zadano));   // koeficient z celého počtu, jinak by porce vyšla jinak velká
          const k = n / puv;
          for (const s of suroviny) s.g = J.zaokrouhli(s.g * k, 1);
          if (J.cislo(hmotnost.value) > 0) hmotnost.value = String(Math.round(J.cislo(hmotnost.value) * k));
          porci.value = String(n);
          vykresliSuroviny();
        } }, '↔ Přepočítat porce')),
      seznam,
      h('button', { class: 'btn mini', type: 'button', style: { marginTop: '8px' }, onclick: () => otevriPridani({ titulek: 'Přidat surovinu', naVyber: (f, g) => { suroviny.push({ f: J.snimek(f), g: J.zaokrouhli(g, 1) }); vykresliSuroviny(); } }) }, '+ Přidat surovinu'),
      vysledek, pozn, h('h3', { style: { margin: '14px 0 6px' }, text: 'Postup' }), postup);
    const ulozit = h('button', { class: 'btn primary', type: 'button' }, 'Uložit recept');
    const pata = h('div', { class: 'sheet-pata' },
      existujici ? h('button', { class: 'btn danger', type: 'button', onclick: async () => {
        if (!(await D.potvrd('Smazat recept „' + r.nazev + '“? Záznamy v deníku zůstanou.', { ok: 'Smazat' }))) return;
        delete S.recepty[r.id]; uloz(); obnovIndexUzivatele(); v.zavri(); vykresliPohled();
      } }, '🗑️ Smazat') : null,
      h('div', { class: 'vpravo' }, h('button', { class: 'btn', type: 'button', onclick: () => v.zavri() }, 'Zrušit'), ulozit));
    const v = otevriVrstvu({ titulek: existujici ? 'Upravit recept' : 'Nový recept', telo, pata, sirka: '680px' });
    ulozit.addEventListener('click', () => {
      try {
        J.ulozRecept(S, { id: existujici ? r.id : null, nazev: nazev.value, porci: porci.value, hmotnost: hmotnost.value, postup: postup.value, suroviny });
        uloz(); obnovIndexUzivatele(); v.zavri(); vykresliPohled();
        D.info('Recept uložen.');
      } catch (e) { D.chyba(e.message); }
    });
    vykresliSuroviny();
    setTimeout(() => nazev.focus(), 30);
  }

  /* ================= STATISTIKY ================= */
  // nápoje: pitný režim, tekuté kalorie, alkohol (průměry za zapsané dny)
  function kartaNapoju(st) {
    const n = st.napoje;
    const karta = h('div', { class: 'karta napoje-karta' }, h('h2', { style: { marginBottom: '10px' }, text: '🥤 Nápoje a alkohol' }));
    karta.appendChild(h('div', { class: 'cisla' },
      karticka(fc(n.pitny / 1000, 2) + ' l', 'pitný režim denně'),
      karticka(fc(n.kcal) + ' kcal', 'tekuté kalorie denně' + (n.podil >= 0.005 ? ' (' + fc(100 * n.podil) + ' % energie)' : '')),
      karticka(fc(n.cukry) + ' g', 'cukrů z nápojů denně'),
      karticka(fc(n.alk, n.alk < 10 ? 1 : 0) + ' g', 'alkoholu denně · ' + fc(J.standardniNapoje(n.alkTydne), 1) + ' std. nápojů týdně'),
      karticka(n.dnyBezAlk + ' / ' + st.zapsanych, 'dní bez alkoholu'),
      karticka(n.alkMax >= 0.5 ? fc(J.standardniNapoje(n.alkMax), 1) : '–', 'nejvíc std. nápojů za den')));
    if (n.alkTydne >= 0.5) {
      const ga = h('div', {});
      karta.appendChild(h('h3', { style: { margin: '14px 0 6px', fontSize: '.95rem' }, text: 'Alkohol po dnech (standardní nápoje)' }));
      karta.appendChild(ga);
      const data = st.dny.map(d => {
        const dt = J.zKlice(d.k);
        return { k: d.k, v: J.zaokrouhli(J.standardniNapoje(d.s.alk), 1), popis: dt.toLocaleDateString('cs-CZ'), kratce: obdobi <= 31 ? dt.getDate() + '.' + (dt.getMonth() + 1) + '.' : '' };
      });
      kresliPozdeji(() => G.sloupce(ga, data, { jednotka: 'std. nápojů', popis: 'Alkohol po dnech ve standardních nápojích' }));
    }
    karta.appendChild(h('p', { class: 'slabe', style: { marginTop: '10px' }, text: 'Standardní nápoj = 10 g čistého alkoholu (zhruba malé pivo, deci vína nebo panák). Bezpečná dávka alkoholu podle WHO neexistuje. '
      + 'Tekuté kalorie zahrnují všechny nápoje z deníku včetně mléka a alkoholu; do pitného režimu se počítají podle nastavení v Profilu.' }));
    return karta;
  }
  function vykresliStatistiky() {
    const kont = $('#statistiky');
    kont.textContent = '';
    document.querySelectorAll('[data-obdobi]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.obdobi === obdobi)));
    const doK = J.datumKlic(new Date()), od = J.posunDen(doK, -(obdobi - 1));
    $('#statObdobi').textContent = J.zKlice(od).toLocaleDateString('cs-CZ') + ' – ' + J.zKlice(doK).toLocaleDateString('cs-CZ');
    const st = J.statistika(S, od, doK);
    const c = cileDne(doK);
    // čísla
    const vahy = Object.entries(S.vahy).filter(([k]) => k >= od && k <= doK).sort();
    const zmena = vahy.length >= 2 ? vahy[vahy.length - 1][1] - vahy[0][1] : null;
    const prumKcal = st.prumer.kcal;
    // cíl se počítá stejně jako v deníku – včetně pohybu, je-li to zapnuté
    const zapsaneDny = st.dny.filter(d => d.zapsano);
    const prumPohyb = S.nastaveni.pohybKCili && zapsaneDny.length ? zapsaneDny.reduce((a, d) => a + d.s.pohyb, 0) / zapsaneDny.length : 0;
    kont.appendChild(h('div', { class: 'cisla' },
      karticka(st.zapsanych + ' / ' + obdobi, 'dní se záznamem'),
      karticka(st.zapsanych ? fc(prumKcal) + ' kcal' : '–', 'průměrně za zapsaný den'),
      karticka(c.kcal && st.zapsanych ? fc(100 * prumKcal / (c.kcal + prumPohyb)) + ' %' : '–', 'průměr vůči cíli' + (prumPohyb ? ' (vč. pohybu)' : '')),
      karticka(st.zapsanych ? fc(st.prumer.bilkoviny, 0) + ' g' : '–', 'bílkovin denně'),
      karticka(J.pocet(J.serie(S, doK), 'den', 'dny', 'dní'), 'aktuální série'),
      karticka(zmena !== null ? (zmena > 0 ? '+' : '') + fc(zmena, 1) + ' kg' : '–', 'změna hmotnosti')));
    if (!st.zapsanych) {
      kont.appendChild(h('div', { class: 'karta prazdny', text: 'V tomto období zatím nejsou žádné záznamy.' }));
    } else {
      // energie po dnech
      const g1 = h('div', {});
      kont.appendChild(h('div', { class: 'karta' }, h('h2', { style: { marginBottom: '10px' }, text: 'Energie po dnech' }), g1));
      const dataE = st.dny.map(d => {
        const dt = J.zKlice(d.k);
        return { k: d.k, v: d.s.celkem.kcal || 0, popis: dt.toLocaleDateString('cs-CZ'), kratce: obdobi <= 31 ? dt.getDate() + '.' + (dt.getMonth() + 1) + '.' : (dt.getDate() === 1 ? (dt.getMonth() + 1) + '/' + String(dt.getFullYear()).slice(2) : '') };
      });
      kresliPozdeji(() => G.sloupce(g1, dataE, { cil: c.kcal ? Math.round(c.kcal + prumPohyb) : null, jednotka: 'kcal', popis: 'Energie po dnech' }));
      // makra
      const pe = J.podilEnergie(st.prumer);
      const kol = h('div', {});
      kont.appendChild(h('div', { class: 'karta' }, h('h2', { style: { marginBottom: '10px' }, text: 'Průměrné rozložení energie' }),
        h('div', { class: 'radek', style: { gap: '20px' } }, kol,
          h('div', { class: 'legenda', style: { flexDirection: 'column', fontSize: '.88rem', gap: '6px' } },
            ...[['bilkoviny', 'Bílkoviny', '--c-bil'], ['sacharidy', 'Sacharidy', '--c-sach'], ['tuk', 'Tuky', '--c-tuk']].map(([k, n, b]) => {
              const s = h('span', { text: n + ': ' + fc(st.prumer[k], 0) + ' g (' + fc(pe[k]) + ' %)' + (c.makraProcenta ? ' · cíl ' + fc(c.makraProcenta[k]) + ' %' : '') });
              s.style.setProperty('--b', 'var(' + b + ')');
              return s;
            }),
            pe.alk > 0.5 ? (() => { const s = h('span', { text: 'Alkohol: ' + fc(pe.alk) + ' % energie' }); s.style.setProperty('--b', 'var(--c-alk)'); return s; })() : null))));
      G.kolac(kol, [{ v: pe.bilkoviny, barva: 'var(--c-bil)', popis: 'Bílkoviny' }, { v: pe.sacharidy, barva: 'var(--c-sach)', popis: 'Sacharidy' }, { v: pe.tuk, barva: 'var(--c-tuk)', popis: 'Tuky' }, { v: pe.alk, barva: 'var(--c-alk)', popis: 'Alkohol' }],
        { popis: 'Rozložení energie: bílkoviny ' + fc(pe.bilkoviny) + ' %, sacharidy ' + fc(pe.sacharidy) + ' %, tuky ' + fc(pe.tuk) + ' %' + (pe.alk > 0.5 ? ', alkohol ' + fc(pe.alk) + ' %' : '') });
      kont.appendChild(kartaNapoju(st));
      // průměrné živiny
      const pokryti = {};
      for (const z of J.ZIVINY) {
        let e = 0, ez = 0;
        for (const d of st.dny) if (d.zapsano) { const ee = d.s.celkem.kcal || 0; e += ee; ez += ee * (d.s.pokryti[z.k] || 0); }
        pokryti[z.k] = e ? ez / e : 0;
      }
      const cP = c.kcal ? { ...c, kcal: c.kcal + prumPohyb } : c;
      kont.appendChild(h('div', { class: 'karta' }, h('h2', { style: { marginBottom: '10px' }, text: 'Průměrný denní příjem živin' }), tabulkaPlneni(st.prumer, cP, pokryti, 'Průměr/den')));
      // „Odkud to mám?“ – největší zdroje zvolené živiny
      kont.appendChild(kartaZdroju(od, doK));
    }
    kont.appendChild(kartaKalendare(c));
    // odhad skutečného výdeje z posledních 4 týdnů (nezávisle na zvoleném období)
    kont.appendChild(kartaVydeje(doK, c));
    // hmotnost
    const vsechnyVahy = Object.entries(S.vahy).sort();
    const gv = h('div', {});
    const vahaKarta = h('div', { class: 'karta' }, h('h2', { style: { marginBottom: '10px' }, text: 'Hmotnost' }));
    const vObdobi = vsechnyVahy.filter(([k]) => k >= od && k <= doK);
    if (vObdobi.length >= 2) {
      vahaKarta.appendChild(gv);
      const body = vObdobi.map(([k, kg]) => ({ t: J.zKlice(k).getTime(), v: kg, popis: J.zKlice(k).toLocaleDateString('cs-CZ') }));
      kresliPozdeji(() => G.cara(gv, body, { trend: true, jednotka: 'kg', cilV: J.cislo(S.profil.cilVaha), popis: 'Vývoj hmotnosti',
        popisy: [{ t: body[0].t, text: J.zKlice(vObdobi[0][0]).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' }) }, { t: body[body.length - 1].t, text: J.zKlice(vObdobi[vObdobi.length - 1][0]).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' }) }] }));
      vahaKarta.appendChild(h('p', { class: 'slabe', style: { marginTop: '6px' }, text: 'Plná čára = vyhlazený trend (tlumí denní výkyvy vody), tenká = jednotlivá vážení.' }));
    } else vahaKarta.appendChild(h('p', { class: 'slabe', text: 'Graf se zobrazí po aspoň dvou váženích v období. Vážení zapisuj v záložce Profil a cíle.' }));
    vahaKarta.appendChild(h('button', { class: 'btn mini', type: 'button', style: { marginTop: '8px' }, onclick: () => prepni('profil') }, '⚖️ Zapsat hmotnost'));
    kont.appendChild(vahaKarta);
  }
  function kartaVydeje(doK, c) {
    const o = J.odhadVydeje(S, doK, 28);
    const k = h('div', { class: 'karta' }, h('h2', { style: { marginBottom: '8px' }, text: '🔥 Skutečný výdej energie' }));
    if (!o.dostatek) {
      k.appendChild(h('p', { class: 'slabe', text: 'Z posledních 4 týdnů spočítám tvůj skutečný denní výdej z příjmu a vývoje hmotnosti – přesnější než vzorec. ' +
        'Potřebuji aspoň ' + o.potrebaDni + ' zapsaných dní (máš ' + o.zapsano + ') a 4 vážení v rozpětí 2 týdnů (máš ' + o.vazeni + ').' }));
      return k;
    }
    k.appendChild(h('div', { class: 'cisla' },
      karticka(fc(o.vydej, 0) + ' kcal', 'odhad skutečného výdeje'),
      karticka(fc(o.prijem, 0) + ' kcal', 'průměrný příjem'),
      karticka((o.zmenaTydne > 0 ? '+' : '') + fc(o.zmenaTydne, 2) + ' kg', 'změna hmotnosti za týden'),
      c.tdee ? karticka(fc(c.tdee, 0) + ' kcal', 'výdej podle vzorce') : null));
    const tempo = J.cislo(S.profil.tempo) || 0;
    const minimum = S.profil.pohlavi === 'z' ? 1200 : 1500;   // stejné bezpečné minimum jako u výpočtu cíle
    const doporuceno = Math.min(6000, Math.max(minimum, Math.round((o.vydej + tempo * 7700 / 7) / 10) * 10));
    // velký rozdíl proti vzorci obvykle znamená nezapsaná jídla nebo výkyvy vody
    const podezrele = c.tdee && Math.abs(o.vydej - c.tdee) > 0.4 * c.tdee;
    k.appendChild(h('p', { class: 'slabe', style: { marginTop: '8px' }, text: 'Počítá se jen s dny, kdy je zapsáno aspoň 400 kcal; když některé jídlo nezapíšeš, odhad vyjde nižší. ' +
      'Pro tvůj cíl (' + (tempo ? (tempo > 0 ? '+' : '') + fc(tempo, 2) + ' kg týdně' : 'udržení') + ') by odpovídal příjem asi ' + fc(doporuceno) + ' kcal denně' +
      (doporuceno === minimum && o.vydej + tempo * 7700 / 7 < minimum ? ' (omezeno bezpečným minimem – zvolené tempo je při tvém výdeji příliš rychlé)' : '') + '.' }));
    if (podezrele) k.appendChild(h('p', { class: 'warn-text', style: { marginTop: '6px', fontSize: '.86rem' }, text: 'Odhad se od výpočtu podle vzorce liší o víc než 40 % – zkontroluj, jestli zapisuješ všechna jídla, a radši počkej na další data.' }));
    else if (c.kcal && Math.abs(doporuceno - c.kcal) >= 100) {
      k.appendChild(h('button', { class: 'btn mini', type: 'button', style: { marginTop: '6px' }, onclick: () => {
        S.profil.kcalRucne = doporuceno; uloz(); vykresliStatistiky(); D.info('Denní cíl nastaven na ' + fc(doporuceno) + ' kcal (lze vrátit v profilu).');
      } }, 'Použít ' + fc(doporuceno) + ' kcal jako denní cíl'));
    }
    return k;
  }
  // karta „Odkud to mám?“: výběr živiny → potraviny seřazené podle jejího množství za období
  let zdrojeZivina = 'kcal';
  function kartaZdroju(od, doK, vnorena) {
    const karta = h('div', { class: vnorena ? 'sekce' : 'karta' });
    const vyber = h('select', { class: 'vstup', 'aria-label': 'Živina' },
      ...J.ZIVINY.filter(z => z.s === 'zaklad' || S.nastaveni.mikro).map(z => h('option', { value: z.k, selected: z.k === zdrojeZivina ? true : null }, z.n.replace(/^z toho /, ''))));
    const obsah = h('div', {});
    const vykresli = () => {
      zdrojeZivina = vyber.value;
      const z = J.ZIV[zdrojeZivina];
      const x = J.zdrojeZiviny(S, od, doK, zdrojeZivina, 15);
      obsah.textContent = '';
      if (!x.seznam.length) { obsah.appendChild(h('p', { class: 'slabe', text: 'Pro tuto živinu v období nejsou data.' })); return; }
      const fmt = v => zdrojeZivina === 'kcal' ? fc(v) + ' kcal' : fc(v, z.d) + ' ' + z.j;
      const nahore = x.seznam.reduce((s, y) => s + y.hodnota, 0);
      pridat(obsah, h('table', { class: 'tab-ziviny' },
        h('thead', {}, h('tr', {}, h('th', { text: 'Potravina' }), h('th', { text: 'Záznamů' }), h('th', { text: 'Celkem' }), h('th', { text: 'Podíl' }))),
        h('tbody', {}, ...x.seznam.map(y => h('tr', {}, h('td', {}, y.nazev, y.znacka ? h('span', { class: 'slabe', text: ' · ' + y.znacka }) : null),
          h('td', { text: String(y.pocet) }), h('td', { text: fmt(y.hodnota) }), h('td', { text: x.celkem ? fc(100 * y.hodnota / x.celkem) + ' %' : '' }))))),
        x.pocet > x.seznam.length ? h('p', { class: 'slabe', style: { marginTop: '6px' }, text: 'Prvních ' + x.seznam.length + ' z ' + J.pocet(x.pocet, 'potraviny', 'potravin', 'potravin') + ' tvoří ' + fc(100 * nahore / x.celkem) + ' % celkového množství.' }) : null,
        x.pokryti < 0.95 ? h('p', { class: 'slabe', text: 'Údaj je znám jen u potravin s ' + fc(100 * x.pokryti) + ' % přijaté energie – skutečné množství je vyšší.' }) : null);
    };
    vyber.addEventListener('change', vykresli);
    pridat(karta, h('div', { class: 'radek', style: { marginBottom: '10px' } },
      h(vnorena ? 'h3' : 'h2', { text: '🔍 Odkud to mám?', style: { marginRight: 'auto' } }), vyber));
    karta.appendChild(obsah);
    vykresli();
    return karta;
  }
  let kalendarMesic = null;   // 'YYYY-MM' zobrazeného měsíce
  function kartaKalendare(c) {
    const dnes = J.datumKlic(new Date());
    if (!kalendarMesic) kalendarMesic = dnes.slice(0, 7);
    const [rok, mes] = kalendarMesic.split('-').map(Number);
    const karta = h('div', { class: 'karta' });
    const posun = o => {
      const d = new Date(rok, mes - 1 + o, 1);
      kalendarMesic = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      const nova = kartaKalendare(c);
      karta.replaceWith(nova);
      // fokus zpět na stejné tlačítko (klávesnice a čtečky neztratí pozici)
      const tl = nova.querySelector(o < 0 ? '[data-kal="pred"]' : '[data-kal="dalsi"]');
      if (tl && !tl.disabled) tl.focus(); else { const jine = nova.querySelector('[data-kal]:not([disabled])'); if (jine) jine.focus(); }
    };
    const nazev = new Date(rok, mes - 1, 1).toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' });
    pridat(karta, h('div', { class: 'radek', style: { marginBottom: '10px' } },
      h('h2', { text: '📅 Kalendář – ' + nazev, style: { marginRight: 'auto' } }),
      h('button', { class: 'btn mini', type: 'button', 'data-kal': 'pred', 'aria-label': 'Předchozí měsíc', onclick: () => posun(-1) }, '◀'),
      h('button', { class: 'btn mini', type: 'button', 'data-kal': 'dalsi', 'aria-label': 'Další měsíc', disabled: kalendarMesic >= dnes.slice(0, 7), onclick: () => posun(1) }, '▶')));
    const mriz = h('div', { class: 'kalendar', role: 'group', 'aria-label': 'Plnění cíle energie v měsíci ' + nazev });
    for (const d of ['po', 'út', 'st', 'čt', 'pá', 'so', 'ne']) mriz.appendChild(h('div', { class: 'hlavicka', 'aria-hidden': 'true', text: d }));
    const prvni = new Date(rok, mes - 1, 1);
    for (let i = 0; i < (prvni.getDay() + 6) % 7; i++) mriz.appendChild(h('div', {}));
    const dnu = new Date(rok, mes, 0).getDate();
    for (let den = 1; den <= dnu; den++) {
      const k = kalendarMesic + '-' + String(den).padStart(2, '0');
      const s = J.souhrnDne(S, k);
      const cil = c.kcal ? c.kcal + (S.nastaveni.pohybKCili ? s.pohyb : 0) : null;
      const pod = cil && s.pocet ? (s.celkem.kcal || 0) / cil : null;
      const tr = !s.pocet ? 'prazdny-den' : pod === null ? '' : pod < 0.7 ? 'malo' : pod <= 1.1 ? 'ok' : pod <= 1.3 ? 'moc' : 'hodne';
      const popis = J.zKlice(k).toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' }) + (s.pocet ? ': ' + fc(s.celkem.kcal || 0) + ' kcal' + (pod !== null ? ' (' + fc(100 * pod) + ' % cíle)' : '') : ': bez záznamu');
      const b = h('button', { class: 'kal-den ' + tr + (k === dnes ? ' dnes' : ''), type: 'button', title: popis, 'aria-label': popis, disabled: k > dnes },
        h('span', { text: String(den) }), s.pocet ? h('small', { text: fc(s.celkem.kcal || 0) }) : null);
      b.addEventListener('click', () => { aktivniDen = k; prepni('denik'); });
      mriz.appendChild(b);
    }
    pridat(karta, mriz, h('div', { class: 'kal-legenda' },
      ...[['prazdny-den', 'bez záznamu'], ['malo', 'pod 70 % cíle'], ['ok', '70–110 %'], ['moc', '110–130 %'], ['hodne', 'nad 130 %']].map(([t, n]) => h('span', {}, h('i', { class: 'vzorek ' + t }), n))),
      c.kcal ? null : h('p', { class: 'slabe', text: 'Barvy podle plnění se ukážou po nastavení cíle v profilu.' }),
      h('p', { class: 'slabe', style: { marginTop: '6px' }, text: 'Klepnutím na den otevřeš jeho deník. Plnění se počítá vůči dnešnímu cíli (s pohybem daného dne).' }));
    return karta;
  }
  function karticka(hodnota, popis) { return h('div', { class: 'cislo-karta' }, h('b', { text: hodnota }), h('span', { text: popis })); }
  function kresliPozdeji(fn) { requestAnimationFrame(() => fn()); }

  /* ================= PROFIL ================= */
  function vykresliProfil() {
    const f = $('#formProfil');
    const p = S.profil;
    if (!f.pal.options.length) for (const a of J.AKTIVITA) f.pal.appendChild(h('option', { value: String(a.pal) }, a.n + ' – PAL ' + String(a.pal).replace('.', ',')));
    f.pohlavi.value = p.pohlavi || 'm';
    f.narozeni.value = p.narozeni || '';
    f.vyska.value = p.vyska || '';
    const desetinne = v => (v === '' || v === null || v === undefined) ? '' : String(v).replace('.', ',');
    f.vaha.value = desetinne(p.vaha);
    f.pal.value = String(p.pal || 1.4);
    f.tempo.value = String(p.tempo || 0);
    f.cilVaha.value = desetinne(p.cilVaha);
    f.kcalRucne.value = p.kcalRucne || '';
    const m = p.makra || { bilkoviny: 20, tuk: 30, sacharidy: 50 };
    f.mBil.value = m.bilkoviny; f.mTuk.value = m.tuk; f.mSach.value = 100 - m.bilkoviny - m.tuk;
    f.bilkovinyNaKg.value = desetinne(p.bilkovinyNaKg);
    vykresliCile();
    vykresliVahy();
    vykresliJidlaNastaveni();
    $('#nOnline').checked = !!S.nastaveni.online;
    $('#nObrazky').checked = !!S.nastaveni.obrazky;
    $('#nMikro').checked = !!S.nastaveni.mikro;
    $('#nPohyb').checked = !!S.nastaveni.pohybKCili;
    $('#nNapoje').checked = S.nastaveni.napojeDoVody !== false;
    $('#nPitny').value = S.nastaveni.pitnyRezim || 'bezny';
    $('#nPitny').disabled = S.nastaveni.napojeDoVody === false;
    const av = $('#alergenyVolby');
    if (!av.children.length) {
      for (const a of J.ALERGENY) {
        const c = h('input', { type: 'checkbox', value: a.k });
        c.addEventListener('change', ulozAlergeny);
        av.appendChild(h('label', { class: 'prepinac' }, c, ' ' + a.n));
      }
    }
    av.querySelectorAll('input').forEach(c => { c.checked = (S.profil.alergeny || []).includes(c.value); });
    $('#vyhybat').value = S.profil.vyhybat || '';
    const fv = $('#formVaha');
    if (!fv.datum.value) fv.datum.value = J.datumKlic(new Date());
  }
  function ulozProfil(e) {
    const f = $('#formProfil');
    const p = S.profil;
    const zmena = e && e.type === 'change';   // při psaní neopravovat pod rukama, až při opuštění pole
    const chyby = [];
    // při psaní (input) se neplatná rozepsaná hodnota jen neuloží; chyba se ukáže až po opuštění pole
    const rozsah = (pole, min, max, popis) => {
      const v = J.cislo(f[pole].value);
      if (v === null) return '';
      if (v < min || v > max) {
        if (zmena) { chyby.push(popis + ' musí být ' + fc(min) + '–' + fc(max) + '.'); return ''; }
        return p[pole];
      }
      return v;
    };
    p.pohlavi = f.pohlavi.value;
    p.narozeni = f.narozeni.value;
    if (p.narozeni && J.vek(p.narozeni) === null) chyby.push('Datum narození není platné.');
    p.vyska = rozsah('vyska', 100, 250, 'Výška');
    p.vaha = rozsah('vaha', 25, 350, 'Hmotnost');
    p.pal = J.cislo(f.pal.value) || 1.4;
    p.tempo = J.cislo(f.tempo.value) || 0;
    p.cilVaha = rozsah('cilVaha', 25, 350, 'Cílová hmotnost');
    p.kcalRucne = rozsah('kcalRucne', 800, 6000, 'Vlastní cíl energie');
    let bil = Math.round(J.cislo(f.mBil.value) || 20), tuk = Math.round(J.cislo(f.mTuk.value) || 30);
    bil = Math.min(40, Math.max(10, bil)); tuk = Math.min(60, Math.max(15, tuk));
    if (bil + tuk > 90) tuk = 90 - bil;
    p.makra = { bilkoviny: bil, tuk, sacharidy: Math.max(0, 100 - bil - tuk) };
    if (zmena) { f.mBil.value = bil; f.mTuk.value = tuk; }
    f.mSach.value = p.makra.sacharidy;
    p.bilkovinyNaKg = rozsah('bilkovinyNaKg', 0.6, 3, 'Bílkoviny na kg');
    let el = $('#profilChyby');
    if (!el) { el = h('p', { id: 'profilChyby', class: 'chyba-text', role: 'alert', style: { fontSize: '.84rem', marginTop: '10px', whiteSpace: 'pre-line' } }); f.appendChild(el); }
    if (zmena || !chyby.length) el.textContent = chyby.join('\n');
    uloz();
    vykresliCile();
  }

  function ulozAlergeny() {
    S.profil.alergeny = [...$('#alergenyVolby').querySelectorAll('input:checked')].map(c => c.value);
    S.profil.vyhybat = $('#vyhybat').value.slice(0, 300);
    uloz();
    if (hlidaSe() && !DB.slozeni) nactiSlozeni().catch(() => {});
  }
  function vykresliCile() {
    const el = $('#vypocetCilu');
    el.textContent = '';
    const c = cileDne(J.datumKlic(new Date()));
    const p = S.profil;
    el.appendChild(h('h2', { style: { marginBottom: '10px' }, text: 'Tvůj denní cíl' }));
    if (!c.kcal) {
      el.appendChild(h('p', { class: 'slabe', text: 'Vyplň pohlaví, datum narození, výšku a hmotnost – cíl se spočítá automaticky. Nebo zadej vlastní cíl energie.' }));
      return;
    }
    const b = J.bmi(p.vaha, p.vyska);
    el.appendChild(h('div', { class: 'cisla' },
      karticka(fc(c.kcal) + ' kcal', 'denní cíl energie'),
      c.bmr ? karticka(fc(c.bmr) + ' kcal', 'bazální metabolismus') : null,
      c.tdee ? karticka(fc(c.tdee) + ' kcal', 'výdej při tvé aktivitě') : null,
      b ? karticka(fc(b, 1), 'BMI – ' + J.bmiPopis(b)) : null));
    el.appendChild(h('table', { class: 'tab-ziviny', style: { marginTop: '12px' } }, h('tbody', {},
      h('tr', {}, h('td', { text: 'Bílkoviny' }), h('td', { text: fc(c.zivinyCil.bilkoviny) + ' g' + (c.makraProcenta ? ' (' + fc(c.makraProcenta.bilkoviny) + ' %)' : '') }), h('td', { class: 'slabe', text: c.minBilkoviny ? 'min. ' + fc(c.minBilkoviny) + ' g (EFSA 0,83 g/kg)' : '' })),
      h('tr', {}, h('td', { text: 'Sacharidy' }), h('td', { text: fc(c.zivinyCil.sacharidy) + ' g' + (c.makraProcenta ? ' (' + fc(c.makraProcenta.sacharidy) + ' %)' : '') }), h('td', { class: 'slabe', text: 'z toho cukry max. ' + fc(c.limity.cukry) + ' g' })),
      h('tr', {}, h('td', { text: 'Tuky' }), h('td', { text: fc(c.zivinyCil.tuk) + ' g' + (c.makraProcenta ? ' (' + fc(c.makraProcenta.tuk) + ' %)' : '') }), h('td', { class: 'slabe', text: 'nasycené max. ' + fc(c.limity.nasycene) + ' g' })),
      h('tr', {}, h('td', { text: 'Vláknina' }), h('td', { text: fc(c.zivinyCil.vlaknina) + ' g' }), h('td', { class: 'slabe', text: 'EFSA' })),
      h('tr', {}, h('td', { text: 'Sůl' }), h('td', { text: 'max. 5 g' }), h('td', { class: 'slabe', text: 'WHO' })),
      h('tr', {}, h('td', { text: 'Pitný režim' }), h('td', { text: fc((c.vodaMl || 2000) * 0.8 / 1000, 1) + ' l' }), h('td', { class: 'slabe', text: 'nápoje ≈ 80 % celkové vody (EFSA)' })))));
    // odhad dosažení cílové hmotnosti
    // tempo podle skutečného cíle energie (po omezení minimem nebo při vlastním cíli se liší od zvoleného)
    const kg = J.cislo(p.vaha), cil = J.cislo(p.cilVaha);
    const tempo = c.tempoSkutecne !== undefined ? c.tempoSkutecne : (p.kcalRucne ? 0 : J.cislo(p.tempo));
    if (kg && cil && Math.abs(cil - kg) >= 0.3 && tempo !== null && Math.abs(tempo) < 0.05) {
      el.appendChild(h('p', { class: 'warn-text', style: { marginTop: '10px', fontSize: '.86rem' }, text: 'Při tomto cíli energie se hmotnost prakticky nemění (méně než 0,05 kg týdně) – cílové hmotnosti tak nedosáhneš.' }));
    } else if (kg && cil && tempo && Math.sign(cil - kg) === Math.sign(tempo)) {
      const tydnu = Math.abs((cil - kg) / tempo);
      const d = new Date(); d.setDate(d.getDate() + Math.round(tydnu * 7));
      el.appendChild(h('p', { style: { marginTop: '10px', fontSize: '.88rem' } }, '🎯 Cílové hmotnosti ', h('b', { text: fc(cil, 1) + ' kg' }), ' dosáhneš zhruba za ', h('b', { text: J.pocet(Math.max(1, Math.round(tydnu)), 'týden', 'týdny', 'týdnů') }),
        ' (kolem ' + d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' }) + ').'));
    } else if (kg && cil && tempo && Math.sign(cil - kg) !== Math.sign(tempo) && cil !== kg) {
      el.appendChild(h('p', { class: 'warn-text', style: { marginTop: '10px', fontSize: '.86rem' }, text: 'Cílová hmotnost neodpovídá cíli energie (hubnutí × přibírání).' }));
    }
    for (const t of c.poznamky) el.appendChild(h('p', { class: 'warn-text', style: { marginTop: '6px', fontSize: '.86rem' }, text: t }));
    el.appendChild(h('p', { class: 'slabe', style: { marginTop: '10px' }, text: 'Výpočet: bazální metabolismus podle Mifflina–St Jeora × úroveň aktivity (PAL); 1 kg tukové tkáně ≈ 7 700 kcal. Je to odhad – sleduj vývoj hmotnosti a cíl podle něj uprav.' }));
  }
  function vykresliVahy() {
    const ul = $('#seznamVah');
    ul.textContent = '';
    const v = Object.entries(S.vahy).sort().reverse();
    if (!v.length) { ul.appendChild(h('li', { class: 'slabe', text: 'Zatím žádné vážení.' })); return; }
    v.slice(0, 12).forEach(([k, kg], i) => {
      const pred = v[i + 1];
      const roz = pred ? kg - pred[1] : null;
      ul.appendChild(h('li', {}, h('span', { class: 'nazev', text: J.zKlice(k).toLocaleDateString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric' }) }),
        h('b', { text: fc(kg, 1) + ' kg' }), h('span', { class: 'slabe', style: { width: '64px', textAlign: 'right' }, text: roz !== null ? (roz > 0 ? '+' : '') + fc(roz, 1) : '' }),
        h('button', { class: 'btn mini plain', type: 'button', 'aria-label': 'Smazat vážení ' + k, onclick: () => { delete S.vahy[k]; uloz(); vykresliVahy(); } }, '✕')));
    });
    if (v.length > 12) ul.appendChild(h('li', { class: 'slabe', text: 'a dalších ' + (v.length - 12) + ' vážení (viz Statistiky)' }));
  }
  function vykresliJidlaNastaveni() {
    const ul = $('#seznamJidel');
    ul.textContent = '';
    const jj = S.nastaveni.jidla;
    jj.forEach((j, i) => {
      const inp = h('input', { class: 'vstup', type: 'text', maxlength: '40', value: j.nazev, 'aria-label': 'Název jídla', style: { flex: '1' } });
      inp.addEventListener('change', () => { j.nazev = inp.value.trim() || j.nazev; inp.value = j.nazev; uloz(); });
      const vlastni = !J.JIDLA_VYCHOZI.some(x => x.id === j.id);
      ul.appendChild(h('li', {}, h('label', { class: 'prepinac', title: 'Zobrazovat v deníku' },
        (() => { const c = h('input', { type: 'checkbox', 'aria-label': 'Zobrazovat ' + j.nazev }); c.checked = !j.skryto; c.addEventListener('change', () => { j.skryto = !c.checked; uloz(); }); return c; })()),
        inp,
        h('button', { class: 'btn mini plain', type: 'button', disabled: i === 0, 'aria-label': 'Posunout nahoru', onclick: () => { jj.splice(i - 1, 0, jj.splice(i, 1)[0]); uloz(); vykresliJidlaNastaveni(); } }, '↑'),
        h('button', { class: 'btn mini plain', type: 'button', disabled: i === jj.length - 1, 'aria-label': 'Posunout dolů', onclick: () => { jj.splice(i + 1, 0, jj.splice(i, 1)[0]); uloz(); vykresliJidlaNastaveni(); } }, '↓'),
        vlastni ? h('button', { class: 'btn mini plain danger', type: 'button', 'aria-label': 'Smazat jídlo', onclick: async () => {
          const pouzito = Object.values(S.dny).some(d => d.z.some(z => z.j === j.id));
          if (pouzito) { D.chyba('Jídlo už má záznamy v deníku – můžeš ho jen skrýt.'); return; }
          jj.splice(i, 1); uloz(); vykresliJidlaNastaveni();
        } }, '✕') : null));
    });
  }

  /* ================= DATA ================= */
  function stahniSoubor(nazev, obsah, typ) {
    const a = h('a', { href: URL.createObjectURL(new Blob([obsah], { type: typ })), download: nazev });
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function stahniZalohu() {
    J.uklid(S);
    stahniSoubor('denik-jidla-' + J.datumKlic(new Date()) + '.json', J.exportJson(S), 'application/json');
    S.nastaveni.zaloha = J.datumKlic(new Date());
    uloz();
    if (pohled === 'data') vykresliData();
    if (pohled === 'denik') vykresliDenik();
  }
  async function importuj(soubor) {
    let novy;
    try { novy = J.importJson(await soubor.text()); }
    catch (e) { D.chyba(e.message); return; }
    const dnu = Object.values(novy.dny).filter(d => d.z.length).length;
    const zaznamu = Object.values(novy.dny).reduce((s, d) => s + d.z.length, 0);
    const popis = J.pocet(dnu, 'den', 'dny', 'dní') + ', ' + J.pocet(zaznamu, 'záznam', 'záznamy', 'záznamů') + ', ' +
      J.pocet(Object.keys(novy.vlastni).length, 'vlastní potravina', 'vlastní potraviny', 'vlastních potravin') + ', ' +
      J.pocet(Object.keys(novy.recepty).length, 'recept', 'recepty', 'receptů') + ', ' +
      J.pocet(Object.keys(novy.sablony).length, 'uložené jídlo', 'uložená jídla', 'uložených jídel') + ', ' +
      J.pocet(Object.keys(novy.vahy).length, 'vážení', 'vážení', 'vážení');
    // „mám data“ = cokoli, co by se nahrazením ztratilo (nejen dny)
    const mamData = Object.values(S.dny).some(d => d.z.length || d.voda || (d.pohyb && d.pohyb.length) || d.pozn) ||
      Object.keys(S.vlastni).length || Object.keys(S.recepty).length || Object.keys(S.vahy).length || Object.keys(S.sablony).length ||
      S.oblibene.length || S.profil.vaha || S.profil.narozeni || (S.profil.alergeny && S.profil.alergeny.length);
    let nahradit = !mamData;
    if (!mamData) {
      if (!(await D.potvrd('Obnovit zálohu (' + popis + ')?', { ok: 'Obnovit' }))) return;
    } else {
      const slouc = await D.potvrd('Záloha obsahuje: ' + popis + '.\n\nSloučit ji s tím, co už máš? (Duplicitní záznamy se nepřidají, tvůj profil zůstane.)', { ok: 'Sloučit', zrus: 'Jiné možnosti' });
      if (!slouc) {
        if (!(await D.potvrd('Nahradit celý současný deník, profil, potraviny i recepty obsahem zálohy?', { ok: 'Nahradit', zrus: 'Zrušit' }))) return;
        nahradit = true;
      }
    }
    // kopie současného stavu: v úložišti (pro jistotu) a pro tlačítko Vrátit
    const pred = JSON.stringify(S);
    try { localStorage.setItem(KLIC + '_pred_importem', pred); } catch (_) { /* málo místa – zůstane jen Vrátit */ }
    if (nahradit) S = novy;
    const n = nahradit ? zaznamu : J.slucStav(S, novy);
    obnovIndexUzivatele(); vykresliVse();
    ulozSListou((nahradit ? 'Záloha obnovena' : 'Sloučeno, přidáno: ' + J.pocet(n, 'záznam', 'záznamy', 'záznamů')), () => {
      S = J.normalizujStav(JSON.parse(pred)); uloz(true); obnovIndexUzivatele(); vykresliVse();
    });
  }

  function vykresliData() {
    let velikost = 0;
    try { velikost = (localStorage.getItem(KLIC) || '').length; } catch (_) { /* nic */ }
    const dnu = Object.keys(S.dny).filter(k => S.dny[k].z.length).length;
    const zaz = Object.values(S.dny).reduce((s, d) => s + d.z.length, 0);
    const nv = Object.keys(S.vlastni).length, nr = Object.keys(S.recepty).length;
    $('#infoUloziste').textContent = 'Záznamy: ' + J.pocet(zaz, 'záznam', 'záznamy', 'záznamů') + ' (' + J.pocet(dnu, 'den', 'dny', 'dní') + '), vlastní potraviny: ' + nv + ', recepty: ' + nr + '. Zabírá ' + fc(velikost * 2 / 1024, 0) + ' kB.';
    $('#infoZaloha').textContent = (S.nastaveni.zaloha ? 'Poslední záloha: ' + J.zKlice(S.nastaveni.zaloha).toLocaleDateString('cs-CZ') + '. ' : 'Záloha zatím nebyla stažena. ') +
      (trvaleUloziste === true ? 'Prohlížeč úložiště deníku chrání před automatickým smazáním.' : trvaleUloziste === false ? 'Prohlížeč nepovolil trvalé úložiště – data může při nedostatku místa nebo po delší nečinnosti smazat (Safari po 7 dnech). Zálohuj pravidelně, případně přidej stránku na plochu.' : '');
    // odložené kopie (před importem, poškozená data) – jdou stáhnout nebo smazat
    const kopie = $('#kopie');
    kopie.textContent = '';
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !(k.startsWith(KLIC + '_pred_importem') || k.startsWith(KLIC + '_poskozeno_'))) continue;
        const nazev = k.includes('pred_importem') ? 'Stav před posledním importem' : 'Poškozená data z ' + new Date(+k.split('_').pop()).toLocaleString('cs-CZ');
        kopie.appendChild(h('li', {}, h('span', { class: 'nazev', text: nazev }),
          h('button', { class: 'btn mini', type: 'button', onclick: () => stahniSoubor(k + '.json', localStorage.getItem(k) || '', 'application/json') }, '⬇️ Stáhnout'),
          h('button', { class: 'btn mini plain danger', type: 'button', 'aria-label': 'Smazat kopii', onclick: () => { localStorage.removeItem(k); vykresliData(); } }, '✕')));
      }
    } catch (_) { /* nedostupné úložiště */ }
    if (kopie.children.length) kopie.insertBefore(h('li', { class: 'slabe', text: 'Odložené kopie dat:' }), kopie.firstChild);
    const o = $('#oDatech');
    o.textContent = '';
    const m = DB.meta.vyrobky, st = DB.meta.statistika;
    pridat(o, 
      h('h3', { text: '🏷️ Výrobky s čárovým kódem' }),
      h('p', {}, 'Obsahuje informace z databáze ', h('a', { href: 'https://world.openfoodfacts.org', target: '_blank', rel: 'noopener', text: 'Open Food Facts' }),
        ', která je dostupná pod licencí ', h('a', { href: 'https://opendatacommons.org/licenses/odbl/1-0/', target: '_blank', rel: 'noopener', text: 'Open Database License (ODbL)' }),
        '; jednotlivé údaje pod ', h('a', { href: 'https://opendatacommons.org/licenses/dbcl/1-0/', target: '_blank', rel: 'noopener', text: 'DbCL' }),
        ', fotky výrobků pod CC BY-SA. ',
        m ? 'Výřez pro český trh (země prodeje ČR nebo kód 859…) ze dne ' + J.zKlice(m.stazeno).toLocaleDateString('cs-CZ') + ': ' + fc(DB.vyrobky.length) + ' výrobků' + (st ? ', z toho ' + fc(st.zivinami) + ' s nutričními hodnotami' : '') + '. ' : '',
        'Výřez je vyčištěný (vyřazené zjevně chybné hodnoty, označené nekonzistentní) a jako odvozená databáze je k dispozici pod stejnou licencí ODbL: ',
        h('a', { href: DATA + 'vyrobky.json', download: '', text: 'vyrobky.json' }), ', ', h('a', { href: DATA + 'slozeni.json', download: '', text: 'slozeni.json' }), '.'),
      h('p', { class: 'slabe', style: { marginTop: '4px' }, text: 'Údaje do Open Food Facts vkládají dobrovolníci. Chybějící nebo chybný výrobek můžeš opravit přímo na jejich webu – pomůžeš všem.' }),
      h('h3', { style: { marginTop: '12px' }, text: '🥕 Obecné potraviny' }),
      h('p', {}, fc(DB.suroviny.length) + ' základních potravin z ', h('a', { href: 'https://fdc.nal.usda.gov/', target: '_blank', rel: 'noopener', text: 'USDA FoodData Central' }),
        ' (SR Legacy, Foundation Foods; volné dílo CC0). Výběr a české názvy připravil autor aplikace. Hodnoty odpovídají americkým potravinám – u pečiva, uzenin a mléčných výrobků je přesnější konkrétní výrobek.'),
      h('h3', { style: { marginTop: '12px' }, text: '🎯 Referenční hodnoty' }),
      h('p', {}, 'Vitaminy a minerály: ', h('a', { href: 'https://multimedia.efsa.europa.eu/drvs/index.htm', target: '_blank', rel: 'noopener', text: 'EFSA – Dietary Reference Values' }),
        ' (zdroj: Evropský úřad pro bezpečnost potravin). Energie: rovnice Mifflin–St Jeor. Limity cukrů, nasycených tuků a soli: doporučení WHO. Názvy přídatných látek a alergenů: taxonomie Open Food Facts (ODbL).'),
      h('h3', { style: { marginTop: '12px' }, text: '📷 Čtečka kódů' }),
      h('p', {}, 'Nativní BarcodeDetector prohlížeče, jinak ', h('a', { href: 'https://github.com/Sec-ant/zxing-wasm', target: '_blank', rel: 'noopener', text: 'zxing-wasm' }), ' (MIT) postavený na zxing-cpp (Apache 2.0).'),
      h('h3', { style: { marginTop: '12px' }, text: '🔒 Soukromí' }),
      h('p', {}, 'Deník, profil a vlastní potraviny jsou uložené jen v tomto prohlížeči a nikam se neodesílají. Online se posílá jen čárový kód při hledání neznámého výrobku v Open Food Facts a načítají se fotky výrobků – obojí lze vypnout v nastavení.'));
  }

  /* ================= navázání událostí ================= */
  function nastav() {
    document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => prepni(t.dataset.v)));
    $('.tabs').addEventListener('keydown', e => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const t = [...document.querySelectorAll('.tab')];
      const i = t.indexOf(document.activeElement);
      if (i < 0) return;
      const n = t[(i + (e.key === 'ArrowRight' ? 1 : t.length - 1)) % t.length];
      n.focus(); prepni(n.dataset.v);
    });
    $('#denPred').addEventListener('click', () => { aktivniDen = J.posunDen(aktivniDen, -1); vykresliDenik(); });
    $('#denDalsi').addEventListener('click', () => { aktivniDen = J.posunDen(aktivniDen, 1); vykresliDenik(); });
    $('#denDnes').addEventListener('click', () => { aktivniDen = J.datumKlic(new Date()); vykresliDenik(); });
    $('#denMenu').addEventListener('click', e => nabidkaDne(e.currentTarget));
    $('#fabPridat').addEventListener('click', () => otevriPridani({ jidlo: vychoziJidlo() }));
    $('#fabSken').addEventListener('click', () => skenuj({ jidlo: vychoziJidlo() }));
    // přejetí prstem doleva/doprava po deníku = další/předchozí den
    let tx = null, ty = 0, tcas = 0;
    $('#v-denik').addEventListener('touchstart', e => {
      if (e.touches.length !== 1 || e.target.closest('.zaznam, input, textarea, select, .navrhy, .voda-tl')) { tx = null; return; }
      tx = e.touches[0].clientX; ty = e.touches[0].clientY; tcas = Date.now();
    }, { passive: true });
    $('#v-denik').addEventListener('touchend', e => {
      if (tx === null) return;
      const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
      tx = null;
      if (Date.now() - tcas > 600 || Math.abs(dx) < 70 || Math.abs(dy) > 50) return;
      const jidla = $('#jidla');
      jidla.classList.remove('posun-vlevo', 'posun-vpravo');
      void jidla.offsetWidth;
      if (dx < 0) { aktivniDen = J.posunDen(aktivniDen, 1); jidla.classList.add('posun-vlevo'); }
      else { aktivniDen = J.posunDen(aktivniDen, -1); jidla.classList.add('posun-vpravo'); }
      vykresliDenik();
    }, { passive: true });
    $('#denPopis').addEventListener('click', () => {
      const i = $('#denVyber');
      if (i.showPicker) { try { i.showPicker(); return; } catch (_) { /* záloha níže */ } }
      vyberDatum('Přejít na den', aktivniDen).then(k => { if (k) { aktivniDen = k; vykresliDenik(); } });
    });
    $('#denVyber').addEventListener('change', e => { if (J.zKlice(e.target.value)) { aktivniDen = e.target.value; vykresliDenik(); } });
    // Ctrl+Z = Vrátit poslední akci (mimo textová pole, kde patří k editaci textu)
    document.addEventListener('keydown', e => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || !listaVraceni) return;
      const z = e.key === 'z' || e.key === 'Z' || (e.code === 'KeyZ' && !/^[a-zA-Z]$/.test(e.key));
      if (!z || /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName) || document.querySelector('dialog[open]')) return;
      e.preventDefault();
      vratitPosledni();
    });
    document.addEventListener('keydown', e => {
      if (vrstvy.length || otevrenaNabidka || document.querySelector('dialog[open]') || pohled !== 'denik' || e.altKey || e.ctrlKey || e.metaKey) return;
      const akt = document.activeElement;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(akt.tagName) || (akt.closest && akt.closest('.tabs'))) return; // v záložkách šipky přepínají záložky
      if (window.DENIK_CTECKA && DENIK_CTECKA.jeOtevrena()) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); $('#denPred').click(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); $('#denDalsi').click(); }
      else if (e.key === '/' || e.key === '+') { e.preventDefault(); otevriPridani({}); }
    });
    // potraviny
    $('#novaPotravina').addEventListener('click', () => editorPotraviny({}, () => vykresliPotraviny()));
    $('#novyRecept').addEventListener('click', () => editorReceptu({}));
    $('#hledatVlastni').addEventListener('input', vykresliPotraviny);
    const prochazet = () => { clearTimeout(prochazetCasovac); prochazetCasovac = setTimeout(vykresliProchazeni, 120); };
    $('#prochazetDotaz').addEventListener('input', prochazet);
    $('#prochazetSkupina').addEventListener('change', vykresliProchazeni);
    $('#prochazetRazeni').addEventListener('change', vykresliProchazeni);
    // statistiky
    document.querySelectorAll('[data-obdobi]').forEach(b => b.addEventListener('click', () => { obdobi = +b.dataset.obdobi; vykresliStatistiky(); }));
    let rozmer = null;
    // grafy se překreslují jen při změně šířky (na mobilu mění výšku okna i skrývání adresního řádku)
    let sirkaOkna = innerWidth;
    addEventListener('resize', () => {
      clearTimeout(rozmer);
      rozmer = setTimeout(() => { if (innerWidth !== sirkaOkna) { sirkaOkna = innerWidth; if (pohled === 'statistiky') vykresliStatistiky(); } }, 200);
    });
    // profil
    $('#formProfil').addEventListener('input', ulozProfil);
    $('#formProfil').addEventListener('change', ulozProfil);
    $('#formProfil').addEventListener('submit', e => e.preventDefault());
    document.querySelectorAll('[data-makra]').forEach(b => b.addEventListener('click', () => {
      const [bil, tuk] = b.dataset.makra.split(',').map(Number);
      const f = $('#formProfil'); f.mBil.value = bil; f.mTuk.value = tuk; f.bilkovinyNaKg.value = ''; ulozProfil();
    }));
    $('#formVaha').addEventListener('submit', e => {
      e.preventDefault();
      const f = e.target;
      const kg = J.cislo(f.kg.value), k = f.datum.value;
      if (!kg || kg < 25 || kg > 350 || !J.zKlice(k)) { D.chyba('Zadej datum a hmotnost 25–350 kg.'); return; }
      S.vahy[k] = Math.round(kg * 10) / 10;
      // nejnovější vážení = aktuální hmotnost v profilu
      const nejnovejsi = Object.keys(S.vahy).sort().pop();
      if (nejnovejsi === k) { S.profil.vaha = S.vahy[k]; $('#formProfil').vaha.value = String(S.vahy[k]).replace('.', ','); }
      f.kg.value = '';
      uloz(); vykresliVahy(); vykresliCile();
      D.info('Zapsáno ' + fc(kg, 1) + ' kg.');
    });
    $('#pridatJidlo').addEventListener('click', async () => {
      const n = await D.zeptej('Název nového jídla (např. Svačina po tréninku)', '');
      if (!n || !n.trim()) return;
      S.nastaveni.jidla.push({ id: J.noveId('j'), nazev: n.trim().slice(0, 40) });
      uloz(); vykresliJidlaNastaveni();
    });
    const prep = (id, kl, poZmene) => $(id).addEventListener('change', e => { S.nastaveni[kl] = e.target.checked; uloz(); if (poZmene) poZmene(); });
    prep('#nOnline', 'online'); prep('#nObrazky', 'obrazky'); prep('#nMikro', 'mikro'); prep('#nPohyb', 'pohybKCili'); prep('#nNapoje', 'napojeDoVody', () => { $('#nPitny').disabled = S.nastaveni.napojeDoVody === false; vykresliDenik(); });
    $('#nPitny').addEventListener('change', e => { S.nastaveni.pitnyRezim = e.target.value; uloz(); vykresliDenik(); });
    $('#importTl').addEventListener('click', () => $('#importJson').click());
    $('#vyhybat').addEventListener('input', ulozAlergeny);
    $('#tiskStat').addEventListener('click', () => {
      $('#tiskPopis').textContent = 'Přehled za období ' + $('#statObdobi').textContent + ' · vytištěno ' + new Date().toLocaleDateString('cs-CZ');
      setTimeout(() => window.print(), 50);
    });
    // data
    $('#exportJson').addEventListener('click', stahniZalohu);
    $('#importJson').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) importuj(f); });
    $('#exportSouhrny').addEventListener('click', () => {
      if (!Object.keys(S.dny).length) { D.info('Deník je zatím prázdný.'); return; }
      stahniSoubor('denik-jidla-souhrny-' + J.datumKlic(new Date()) + '.csv', J.exportSouhrnyCsv(S), 'text/csv;charset=utf-8');
    });
    // instalace jako aplikace (PWA) – tlačítko jen tam, kde to prohlížeč nabízí
    let instalace = null;
    addEventListener('beforeinstallprompt', e => { e.preventDefault(); instalace = e; $('#instalovat').hidden = false; });
    addEventListener('appinstalled', () => { $('#instalovat').hidden = true; D.info('Deník je nainstalovaný jako aplikace.'); });
    $('#instalovat').addEventListener('click', async () => {
      if (!instalace) return;
      instalace.prompt();
      try { await instalace.userChoice; } catch (_) { /* nic */ }
      instalace = null; $('#instalovat').hidden = true;
    });
    $('#exportCsv').addEventListener('click', () => {
      if (!Object.keys(S.dny).length) { D.info('Deník je zatím prázdný.'); return; }
      stahniSoubor('denik-jidla-' + J.datumKlic(new Date()) + '.csv', J.exportCsv(S), 'text/csv;charset=utf-8');
    });
    $('#tisk').addEventListener('click', () => {
      prepni('denik');
      $('#tiskPopis').textContent = J.popisDne(aktivniDen, J.datumKlic(new Date())) + ' · vytištěno ' + new Date().toLocaleDateString('cs-CZ');
      setTimeout(() => window.print(), 100);
    });
    $('#smazatVse').addEventListener('click', async () => {
      if (!(await D.potvrd('Opravdu smazat celý deník, profil, vlastní potraviny i recepty? Tento krok nejde vrátit.', { ok: 'Pokračovat' }))) return;
      if (!(await D.potvrd('Poslední šance: máš stažené zálohy? Smazat všechno?', { ok: 'Smazat vše' }))) return;
      S = J.novyStav(); uloz(true); obnovIndexUzivatele(); vykresliVse();
      D.info('Všechna data deníku byla smazána.');
    });
    document.addEventListener('denik-data', () => { if (pohled === 'potraviny') vykresliProchazeni(); if (pohled === 'data') vykresliData(); });
    // samostatné okno má smysl jen v iframu rozcestníku
    if (window.top === window) $('#samostatne').remove();
  }

  /* ================= start ================= */
  function start() {
    nastav();
    let v = 'denik';
    try { v = sessionStorage.getItem(KLIC + '_pohled') || 'denik'; } catch (_) { /* nic */ }
    const hash = location.hash.slice(1);
    if (['denik', 'potraviny', 'statistiky', 'profil', 'data'].includes(hash)) v = hash;
    obnovIndexUzivatele();
    if (porovnani.length) vykresliTlacitkoPorovnani();   // porovnání obnovené ze sessionStorage
    prepni(v);
    nactiDatabazi().then(() => {
      if (hlidaSe() && DB.nacteno) nactiSlozeni().then(() => document.dispatchEvent(new Event('denik-data')), () => { slozeniChyba = true; document.dispatchEvent(new Event('denik-data')); });
    });
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('../sw.js').catch(() => {});
      navigator.serviceWorker.ready.then(r => { if (r.active) r.active.postMessage({ typ: 'dotahni', sada: 'potraviny' }); }).catch(() => {});
    }
    // půlnoc a návrat k otevřené stránce (zhasnutý displej, jiná aplikace)
    setInterval(zkontrolujDen, 30000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') zkontrolujDen(); });
    addEventListener('pageshow', zkontrolujDen);
    addEventListener('focus', zkontrolujDen);
    // jednou za den uklidit nepoužité snímky potravin a prázdné dny
    if (S.nastaveni.uklid !== J.datumKlic(new Date())) { J.uklid(S); S.nastaveni.uklid = J.datumKlic(new Date()); uloz(); }
  }

  // pro testy
  window.DENIK = {
    get stav() { return S; }, DB, prepni, otevriPridani, detailPotraviny, zpracujKod, editorPotraviny, editorReceptu,
    vykresliVse, get aktivniDen() { return aktivniDen; }, set aktivniDen(k) { aktivniDen = k; vykresliDenik(); }, uloz,
    // test: simulace půlnoci – stránka „si myslí“, že je včera, a sleduje včerejšek
    _testPulnoc() { znamyDnes = J.posunDen(J.datumKlic(new Date()), -1); aktivniDen = znamyDnes; vykresliDenik(); zkontrolujDen(); },
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();

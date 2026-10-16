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
  // stránka, jádro a aplikace musí být ze stejné verze (při změně kódu zvýšit i v jadro.js a potraviny.html)
  const VERZE_KODU = '2026-10-16p';
  if (!J || J.VERZE_KODU !== VERZE_KODU || window.DENIK_VERZE !== VERZE_KODU) {
    // jednou za minutu se soubory obnoví samy, jinak (smyčka) jen nabídka tlačítkem
    let nedavno = false;
    try { nedavno = Date.now() - (+sessionStorage.getItem(KLIC + '_obnova') || 0) < 60000; sessionStorage.setItem(KLIC + '_obnova', String(Date.now())); } catch (_) { /* nic */ }
    const obnov = window.obnovDenik || (() => location.reload());
    const ukaz = () => {
      const el = document.getElementById('dataStav');
      if (!el) return;
      el.textContent = 'Načetla se nekompletní aktualizace aplikace. ';
      const b = document.createElement('button');
      b.className = 'btn mini'; b.type = 'button'; b.textContent = '↻ Obnovit aplikaci'; b.onclick = obnov;
      el.appendChild(b);
    };
    if (!nedavno) obnov();
    else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ukaz); else ukaz();
    window.DENIK = { spusteno: false, verze: VERZE_KODU };
    return;
  }
  const DATA = 'potraviny/data/';
  const D = typeof Dialog !== 'undefined' ? Dialog : {
    info: t => console.log(t), chyba: t => console.warn(t),
    potvrd: async t => window.confirm(t), zeptej: async (t, v) => window.prompt(t, v),
  };

  /* ================= profily (více lidí na jednom zařízení) ================= */
  // hlavní profil leží ve starém klíči (kompatibilita), další v KLIC + '__' + id
  const KLIC_PROFILY = KLIC + '_profily';
  function nactiProfily() {
    try {
      const x = JSON.parse(localStorage.getItem(KLIC_PROFILY) || 'null');
      if (x && Array.isArray(x.seznam)) {
        const seznam = x.seznam.filter(p => p && typeof p.id === 'string' && /^[a-z0-9]{1,20}$/.test(p.id) && typeof p.jmeno === 'string')
          .map(p => ({ id: p.id, jmeno: p.jmeno.slice(0, 30) || 'Profil' }));
        if (!seznam.some(p => p.id === 'hlavni')) seznam.unshift({ id: 'hlavni', jmeno: 'Já' });
        return { aktivni: seznam.some(p => p.id === x.aktivni) ? x.aktivni : 'hlavni', seznam };
      }
    } catch (_) { /* výchozí */ }
    return { aktivni: 'hlavni', seznam: [{ id: 'hlavni', jmeno: 'Já' }] };
  }
  let PROF = nactiProfily();
  const klicProfilu = id => (id === 'hlavni' ? KLIC : KLIC + '__' + id);
  let klicStavu = klicProfilu(PROF.aktivni);
  const smazaneProfily = new Set();
  // seznam profilů sdílí všechny záložky: před zápisem doplnit profily přidané jinde (smazané tady vynechat)
  function ulozProfily() {
    try {
      const ulozene = nactiProfily();
      for (const p of ulozene.seznam) if (!smazaneProfily.has(p.id) && !PROF.seznam.some(x => x.id === p.id)) PROF.seznam.push(p);
      localStorage.setItem(KLIC_PROFILY, JSON.stringify(PROF));
    } catch (_) { /* nic */ }
  }

  /* ================= stav ================= */
  let poskozeno = false;
  let poskozenyText = null;   // poškozená data, jejichž kopii se nepodařilo odložit – do jejich klíče se zatím nezapisuje
  function nactiStav(klic) {
    poskozeno = false; poskozenyText = null;
    let t = null;
    try {
      t = localStorage.getItem(klic);
      return t ? J.normalizujStav(JSON.parse(t)) : J.novyStav();
    } catch (e) {
      poskozeno = true;
      try { localStorage.setItem(klic + '_poskozeno_' + Date.now(), t || ''); } catch (_) { poskozenyText = t; }
      return J.novyStav();
    }
  }
  let S = nactiStav(klicStavu);
  let ulozTimer = null, chybaUlozeniHlasena = false, trvaleZadano = false;
  let ulozPodListou = false;   // uložení, ke kterému patří právě zobrazená lišta „Vrátit“
  function uloz(hned) {
    // jakákoli další změna zneplatní „Vrátit“ (obnova snímku by ji tiše zahodila)
    if (!ulozPodListou && typeof schovejListu === 'function') schovejListu();
    clearTimeout(ulozTimer); ulozTimer = null;
    const proved = () => {
      ulozTimer = null;
      if (poskozenyText !== null) return;   // nepřepsat poškozená data, dokud je uživatel nestáhne nebo nezahodí
      const zapis = () => localStorage.setItem(klicStavu, JSON.stringify(S));
      try {
        try { zapis(); } catch (e) {
          // plné úložiště: uvolnit, co jde obnovit (mezipaměť výrobků, kopie před importem), a zkusit znovu
          S.cache = {};
          try { for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k && k.startsWith(klicStavu + '_pred_importem')) localStorage.removeItem(k); } } catch (_) { /* nic */ }
          zapis();
        }
        if (chybaUlozeniHlasena) { chybaUlozeniHlasena = false; D.info('Deník se zase ukládá.'); if (typeof vykresliDenik === 'function') vykresliDenik(); }
        if (!trvaleZadano) { trvaleZadano = true; pozadejTrvaleUloziste(); }
      } catch (e) {
        // hlásit opakovaně (nejvýš jednou za minutu) a trvale ukázat pruh v deníku – jinak se práce tiše ztrácí
        const ted = Date.now();
        if (!chybaUlozeniHlasena || ted - chybaUlozeniHlasena > 60000) D.chyba('Deník se nepodařilo uložit – úložiště prohlížeče je plné nebo zakázané. Stáhni si zálohu (záložka Data).');
        const poprve = !chybaUlozeniHlasena;
        chybaUlozeniHlasena = ted;
        if (poprve && typeof vykresliDenik === 'function') vykresliDenik();
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
    if (e.key === KLIC_PROFILY) {
      const a = PROF.aktivni;   // aktivní profil je věc této záložky
      PROF = nactiProfily();
      if (PROF.seznam.some(p => p.id === a)) PROF.aktivni = a;
      vykresliProfily();
      return;
    }
    if (e.key !== klicStavu) return;
    if (!e.newValue) {   // jiná záložka tento profil smazala
      if (klicStavu !== KLIC) {
        clearTimeout(ulozTimer); ulozTimer = null;   // smazaný profil znovu nezakládat
        smazaneProfily.add(PROF.aktivni);
        PROF.seznam = PROF.seznam.filter(p => p.id !== PROF.aktivni);
        PROF.aktivni = '';
        prepniProfil('hlavni');
        D.info('Tento profil byl smazán v jiné záložce – zobrazuji hlavní profil.');
      }
      return;
    }
    schovejListu();
    try {
      const novy = J.normalizujStav(JSON.parse(e.newValue));
      if (ulozTimer) {
        // vlastní změna ještě není uložená: převzít cizí stav a vlastní doplnit sloučením (nic se neztratí)
        clearTimeout(ulozTimer); ulozTimer = null;
        J.slucStav(novy, S);
        S = novy;
        uloz(true);
      } else S = novy;
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
    nacteno: false, chyba: null, vyrobky: [], suroviny: [], doplnky: [], podleEan: new Map(), podleId: new Map(),
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
  // energie se ukládá vždy v kcal; zobrazuje a zadává se v jednotce podle volby (kcal / kJ)
  const KJ = 4.184;
  function jeKJ() { return S.nastaveni.energie === 'kj'; }
  function ej() { return jeKJ() ? 'kJ' : 'kcal'; }
  function E(v) { return Number.isFinite(v) && jeKJ() ? v * KJ : v; }
  function zE(v) { return Number.isFinite(v) && jeKJ() ? v / KJ : v; }   // zadaná hodnota → kcal
  function en(v, d) { return Number.isFinite(v) ? fc(E(v), d || 0) + ' ' + ej() : '–'; }
  function kcalText(v) { return en(v); }
  function ziv(k) { return J.ZIV[k]; }

  /* ================= vrstvy (sheety) ================= */
  const vrstvy = [];
  function otevriVrstvu({ titulek, telo, pata, hlavickaNavic, sirka, priZavreni, trida }) {
    const predFokus = document.activeElement;
    const pozadi = h('div', { class: 'sheet-pozadi' });
    const titulekEl = h('h2', { text: titulek || '' });
    const zavrit = h('button', { class: 'btn ikona plain zavrit', type: 'button', 'aria-label': 'Zavřít', title: 'Zavřít (Esc)' },
      h('span', { class: 'ik-x', 'aria-hidden': 'true', text: '✕' }), h('span', { class: 'ik-zpet', 'aria-hidden': 'true', text: '←' }));
    // na telefonu: menší vrstvy jako vysouvací panel zdola, velké přes celou obrazovku
    const spodni = !trida && sirka && parseInt(sirka, 10) <= 520;
    const sheet = h('div', { class: 'sheet ' + (trida || '') + (spodni ? ' spodni' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': String(titulek || '').replace(/^[^\p{L}\p{N}]+/u, '') },
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
        if (!vrstvy.length) { document.documentElement.style.overflow = ''; if (lista && listaVraceni) zobrazListu(true); historiePoZavreni(); }
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
    historieVrstvy();
    if (spodni) tahniDolu(sheet, sheet.querySelector('.sheet-hl'), () => v.zavri());
    // výchozí fokus: volající ho obvykle nastaví sám (pole); jinak zavírací tlačítko, aby se dialog ohlásil
    setTimeout(() => { if (vrstvy.includes(v) && !sheet.contains(document.activeElement)) zavrit.focus(); }, 60);
    return v;
  }
  /* ----- systémové „Zpět“ (Android, gesto, tlačítko prohlížeče): zavře vrstvu, z jiné sekce vrátí do Deníku ----- */
  // V historii je nejvýš jeden záznam pro otevřené vrstvy a jeden pro sekci mimo Deník.
  // history.back() je asynchronní: dokud nedoběhne, další záznamy se jen řadí do fronty (jinak by se pomíchaly)
  const hist = { vrstva: false, sekce: false, ceka: 0, fronta: [], pojistka: null };
  function pridejZaznam(stav) {
    if (hist.ceka) { hist.fronta.push(stav); return; }
    try { history.pushState({ denik: stav }, ''); } catch (_) { /* nic */ }
  }
  function odeberZaznam() {
    hist.ceka++;
    try { history.back(); } catch (_) { hist.ceka--; return; }
    clearTimeout(hist.pojistka);   // kdyby popstate nepřišel (žádný záznam), fronta se neucpe
    hist.pojistka = setTimeout(() => { if (hist.ceka) { hist.ceka = 0; vyprazdniFrontu(); } }, 600);
  }
  function vyprazdniFrontu() {
    while (hist.fronta.length && !hist.ceka) { try { history.pushState({ denik: hist.fronta.shift() }, ''); } catch (_) { /* nic */ } }
  }
  function historieVrstvy() {
    if (hist.vrstva) return;
    hist.vrstva = true;
    pridejZaznam('vrstva');
  }
  function historiePoZavreni() {
    // zavření tlačítkem: záznam z historie odebrat – až v dalším kroku (hned se může otevřít jiná vrstva)
    setTimeout(() => {
      if (vrstvy.length || !hist.vrstva) return;
      hist.vrstva = false;
      const i = hist.fronta.lastIndexOf('vrstva');
      if (i >= 0) hist.fronta.splice(i, 1); else odeberZaznam();
    }, 0);
  }
  addEventListener('popstate', () => {
    if (hist.ceka) { hist.ceka--; if (!hist.ceka) { clearTimeout(hist.pojistka); vyprazdniFrontu(); } return; }
    if (hist.vrstva) {
      hist.vrstva = false;
      if (otevrenaNabidka) zavriNabidku(true);
      if (vrstvy.length) {
        vrstvy[vrstvy.length - 1].zavri();
        if (vrstvy.length) historieVrstvy();   // pod ní je další vrstva – Zpět ji zavře příště
      }
      return;
    }
    if (hist.sekce) { hist.sekce = false; prepni('denik', true); }
  });
  // stažení vysouvacího panelu prstem dolů ho zavře
  function tahniDolu(sheet, uchyt, zavri) {
    let y0 = null, dy = 0;
    uchyt.addEventListener('touchstart', e => { if (e.touches.length !== 1 || e.target.closest('button,select,input,a')) return; y0 = e.touches[0].clientY; dy = 0; sheet.classList.add('tazeny'); }, { passive: true });
    uchyt.addEventListener('touchmove', e => {
      if (y0 === null) return;
      dy = Math.max(0, e.touches[0].clientY - y0);
      sheet.style.transform = dy ? 'translateY(' + dy + 'px)' : '';
    }, { passive: true });
    const konec = () => {
      if (y0 === null) return;
      y0 = null; sheet.classList.remove('tazeny');
      if (dy > Math.min(120, sheet.offsetHeight * 0.25)) { zavri(); return; }
      sheet.classList.add('vraci'); sheet.style.transform = '';
      setTimeout(() => sheet.classList.remove('vraci'), 220);
    };
    uchyt.addEventListener('touchend', konec);
    uchyt.addEventListener('touchcancel', konec);
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
    if (vrstvy.length) return;   // znamyDnes zůstává – zkusí se znovu po zavření vrstvy (i po spánku přes víc dní)
    znamyDnes = dnes;
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
      // doplňky správce jsou nepovinné – chybějící nebo vadný soubor databázi nezablokuje
      const [v, s, c, d] = await Promise.all([stahni('vyrobky.json'), stahni('suroviny.json'), stahni('ciselniky.json'), stahni('doplnky.json').catch(() => null)]);
      DB.vyrobky = v.radky.map(J.vyrobekZRadku);
      DB.suroviny = s.radky.map(J.surovinaZRadku);
      DB.meta = { vyrobky: v.zdroj, statistika: v.statistika, suroviny: s.zdroj, ciselniky: c.zdroj };
      DB.ciselniky = { aditiva: c.aditiva || {}, alergeny: c.alergeny || {} };
      DB.podleEan.clear(); DB.podleId.clear();
      for (const f of DB.vyrobky) { DB.podleEan.set(f.ean, f); DB.podleId.set(f.id, f); }
      for (const f of DB.suroviny) DB.podleId.set(f.id, f);
      J.nastavPrevody(DB.suroviny);   // poměry syrové/hotové z naměřeného složení
      nactiDoplnky(d);
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
  // doplňky správce: přidají se k databázi, výrobek se stejným EAN z Open Food Facts nahradí (oprava)
  function nactiDoplnky(d) {
    for (const f of DB.doplnky) { DB.podleId.delete(f.id); if (f.ean && DB.podleEan.get(f.ean) === f) DB.podleEan.delete(f.ean); }
    DB.doplnky = []; DB.doplnkyData = [];
    if (d && d.format === J.FORMAT_DOPLNKY && Array.isArray(d.polozky)) {
      for (const x of d.polozky) {
        const ch = J.overDoplnek(x);
        if (ch.length) { console.warn('Doplněk vynechán:', x && x.nazev, ch); continue; }
        DB.doplnkyData.push(x);
        DB.doplnky.push(J.doplnekZDat(x));
      }
    }
    for (const f of DB.vyrobky) if (!DB.podleEan.has(f.ean)) DB.podleEan.set(f.ean, f);
    const eanDopl = new Set();
    for (const f of DB.doplnky) { DB.podleId.set(f.id, f); if (f.ean) { DB.podleEan.set(f.ean, f); eanDopl.add(f.ean); } }
    DB.meta.doplnky = { pocet: DB.doplnky.length, zmeneno: d && d.zmeneno };
    DB.index = J.vytvorIndex(DB.suroviny.concat(DB.doplnky, DB.vyrobky.filter(f => !eanDopl.has(f.ean))));
    if (DB.indexUziv) DB.vse = DB.indexUziv.concat(DB.index);
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
  const TITULY = { denik: 'Deník', potraviny: 'Potraviny a recepty', statistiky: 'Statistiky', profil: 'Profil a cíle', data: 'Data' };
  function prepni(v, zHistorie) {
    if (v === 'statistiky' && pohled !== 'statistiky') kalendarMesic = null;   // kalendář po příchodu na záložku od aktuálního měsíce
    // Zpět ze sekce mimo Deník vrací do Deníku (jako v aplikaci), z Deníku teprve opouští stránku
    if (!zHistorie && !hist.vrstva) {
      try {
        if (v !== 'denik' && !hist.sekce) { hist.sekce = true; pridejZaznam('sekce'); }
        else if (v === 'denik' && hist.sekce) {
          hist.sekce = false;
          const i = hist.fronta.lastIndexOf('sekce');
          if (i >= 0) hist.fronta.splice(i, 1); else odeberZaznam();
        }
      } catch (_) { /* nic */ }
    }
    pohled = v;
    document.body.classList.toggle('pohled-denik', v === 'denik');
    document.body.dataset.pohled = v;
    const ts = $('#titulSekce'); if (ts) ts.textContent = TITULY[v] || '';
    document.querySelectorAll('.tab').forEach(t => { t.setAttribute('aria-selected', String(t.dataset.v === v)); t.tabIndex = t.dataset.v === v ? 0 : -1; });
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
  function vykresliVse() { pouzijPismo(); pouzijEnergii(); vykresliProfily(); vykresliPohled(); }

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
    if (chybaUlozeniHlasena) kont.appendChild(h('div', { class: 'upozorneni', role: 'alert' }, 'Deník se teď neukládá (úložiště prohlížeče je plné nebo zakázané) – změny po obnovení stránky zmizí. ',
      h('button', { class: 'btn mini', type: 'button', onclick: stahniZalohu }, 'Stáhnout zálohu')));
    if (poskozeno && poskozenyText !== null) {
      kont.appendChild(h('div', { class: 'upozorneni', role: 'alert' }, 'Uložená data deníku jsou poškozená a pro jejich kopii není v prohlížeči místo. Dokud je nestáhneš nebo nezahodíš, nic se neukládá. ',
        h('button', { class: 'btn mini', type: 'button', onclick: () => stahniSoubor('denik-poskozena-data.json', poskozenyText, 'application/json') }, 'Stáhnout poškozená data'), ' ',
        h('button', { class: 'btn mini plain', type: 'button', onclick: async () => {
          if (!(await D.potvrd('Zahodit poškozená data a začít s prázdným deníkem?', { ok: 'Zahodit' }))) return;
          poskozenyText = null; uloz(true); vykresliVse();
        } }, 'Zahodit a začít znovu')));
    } else if (poskozeno) kont.appendChild(h('div', { class: 'upozorneni' }, 'Uložená data deníku byla poškozená a nešla načíst. Kopie byla odložena v úložišti prohlížeče (Data → Odložené kopie); začínáš s prázdným deníkem.'));
    upozorneniOnline(kont);
    pripomenutiZalohy(kont);
    nabidkaPlochy(kont);
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
        h('span', { class: 'jidlo-kcal', text: zaznamy.length ? en(s.kcal || 0, 0) : '' }),
        // na telefonu jsou přidání a skenování přímo v záhlaví (patička jídla je skrytá)
        h('button', { class: 'btn ikona plain jen-mobil', type: 'button', 'aria-label': 'Naskenovat do jídla ' + nazevJidla(jid), onclick: () => skenuj({ jidlo: jid }) }, '📷'),
        h('button', { class: 'btn ikona plain jen-mobil', type: 'button', 'aria-label': 'Přidat do jídla ' + nazevJidla(jid), style: { fontSize: '1.5rem', color: 'var(--accent)' }, onclick: () => otevriPridani({ jidlo: jid }) }, '+'),
        h('button', { class: 'btn ikona plain', type: 'button', 'aria-label': 'Další akce – ' + nazevJidla(jid), 'aria-haspopup': 'menu', 'aria-expanded': 'false', text: '⋯',
          onclick: e => nabidkaJidla(e.currentTarget, jid, zaznamy) }));
      karta.appendChild(hl);
      if (zaznamy.length) {
        const ul = h('ul', { class: 'zaznamy', role: 'group', 'aria-label': 'Záznamy jídla' });
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
        h('span', { class: 'jidlo-kcal', title: 'Energie navíc nad klidový výdej', text: soub.pohyb ? '+' + en(soub.pohyb) : '' })));
    if (d.pohyb && d.pohyb.length) {
      const ul = h('ul', { class: 'zaznamy', role: 'group', 'aria-label': 'Záznamy pohybu' });
      for (const p of d.pohyb) {
        const det = popisPohybu(p);
        ul.appendChild(h('li', { class: 'zaznam', tabindex: '0', role: 'button', onclick: () => upravPohyb(p.id),
          onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); upravPohyb(p.id); } } },
        h('div', { class: 'nazev' }, h('div', {}, p.nazev || 'Aktivita'), det ? h('div', { class: 'detail', text: det }) : null),
        h('span', { class: 'kc', text: en(p.kcal) })));
      }
      pohybKarta.appendChild(ul);
    }
    const nedPohyby = J.nedavnePohyby(S, 3).filter(z => !(d.pohyb || []).some(q => (q.kod || q.nazev) === (z.kod || z.nazev)));
    if (nedPohyby.length && !(d.pohyb && d.pohyb.length)) {
      pohybKarta.appendChild(h('div', { class: 'navrhy pohyb-navrhy', role: 'group', 'aria-label': 'Nedávné pohyby' },
        ...nedPohyby.map(z => h('button', { class: 'navrh', type: 'button', title: 'Zapsat znovu – doba a energie se dají upravit', onclick: () => zopakujPohyb(z) },
          '↻ ' + z.nazev + (z.minuty ? ' · ' + fc(z.minuty) + ' min' : '')))));
    }
    if (J.nedavnePohyby(S, 1).length) pohybKarta.appendChild(prehledTydnePohybu(aktivniDen));
    pohybKarta.appendChild(h('div', { class: 'jidlo-pata' },
      h('button', { class: 'btn mini', type: 'button', onclick: () => vyberPohybu(aktivniDen) }, '+ Přidat pohyb'),
      h('button', { class: 'btn mini plain', type: 'button', onclick: () => upravPohybRucne(null, aktivniDen) }, '✎ Ručně (z hodinek)')));
    kont.appendChild(pohybKarta);
    const pozn = h('textarea', { class: 'vstup', placeholder: 'Poznámka ke dni (jak ses cítil, hlad, spánek…)', 'aria-label': 'Poznámka ke dni', maxlength: '2000' });
    pozn.value = d.pozn || '';
    pozn.addEventListener('input', () => { const dd = J.den(S, aktivniDen); dd.pozn = pozn.value; uloz(); });
    kont.appendChild(h('section', { class: 'karta poznamka-dne' }, h('h2', { text: '📝 Poznámka' }), pozn));
    vykresliSouhrn(soub);
  }

  // jednorázové upozornění, co aplikace posílá na internet (soukromí)
  function upozorneniOnline(kont) {
    if (S.nastaveni.infoOnline || (!S.nastaveni.online && !S.nastaveni.obrazky)) return;
    const box = h('div', { class: 'upozorneni info' },
      'Deník zůstává jen v tomto prohlížeči. Fotky výrobků se ale načítají z Open Food Facts a neznámý čárový kód se tam při hledání odešle (služba vidí tvou IP adresu a kód). ',
      h('button', { class: 'btn mini', type: 'button', onclick: () => { S.nastaveni.infoOnline = true; uloz(); box.remove(); } }, 'Rozumím'), ' ',
      h('button', { class: 'btn mini plain', type: 'button', onclick: () => { S.nastaveni.infoOnline = true; S.nastaveni.online = false; S.nastaveni.obrazky = false; uloz(); vykresliVse(); D.info('Fotky i online hledání jsou vypnuté. Zapnout je lze v Profilu.'); } }, 'Vypnout obojí'));
    kont.appendChild(box);
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
    G.kruh(kruh, E(snedeno), cilKcal ? E(cilKcal) : cilKcal, { popis: 'Energie dne', jednotka: ej() });
    if (cilKcal) {
      const zbyva = cilKcal - snedeno;
      pridat(bil, 
        h('div', { class: 'zbyva ' + (zbyva < 0 ? 'chyba-text' : '') }, zbyva >= 0 ? 'Zbývá ' + en(zbyva) : 'Přes cíl o ' + en(-zbyva)),
        h('div', {}, 'Cíl ', h('b', { text: fc(E(c.kcal)) }), ' ' + ej()),
        pohybKcal ? h('div', {}, '+ pohyb ', h('b', { text: fc(E(pohybKcal)) }), ' ' + ej()) : null,
        h('div', {}, 'Snědeno ', h('b', { text: fc(E(snedeno)) }), ' ' + ej()));
    } else {
      pridat(bil, h('div', {}, 'Snědeno ', h('b', { text: fc(E(snedeno)) }), ' ' + ej()),
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
      (soub.celkem.kof || 0) > 0 ? lim('Kofein', 'kof', c.kofeinLimit || 400, null, 0, 'mg', false, 'EFSA: do 400 mg denně je pro dospělé bezpečné, v těhotenství a při kojení do 200 mg. Kofein je uveden jen u části potravin.') : null,
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
        soub.tekute.kcal >= 1 ? 'tekuté kalorie ' + en(soub.tekute.kcal) + (soub.tekute.cukry >= 1 ? ' (cukry ' + fc(soub.tekute.cukry) + ' g)' : '') : ''].filter(Boolean).join(' · ') }) : null,
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
    const ul = h('ul', { class: 'vysledky', role: 'group', 'aria-label': 'Uložená jídla', style: { border: '0' } });
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
  /* ----- profily ----- */
  const profilAktivni = () => PROF.seznam.find(p => p.id === PROF.aktivni) || PROF.seznam[0];
  function priponaProfilu() {
    if (PROF.seznam.length < 2) return '';
    return J.norm(profilAktivni().jmeno).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-';
  }
  function prepniProfil(id) {
    if (id === PROF.aktivni || !PROF.seznam.some(p => p.id === id)) return;
    if (ulozTimer) uloz(true);
    schovejListu();
    zavriVsechnyVrstvy();
    PROF.aktivni = id; ulozProfily();
    klicStavu = klicProfilu(id);
    S = nactiStav(klicStavu);
    aktivniDen = J.datumKlic(new Date());
    obnovIndexUzivatele();
    vykresliVse();
    D.info('Profil: ' + profilAktivni().jmeno);
  }
  async function pridejProfil() {
    const jm = await D.zeptej('Jméno nového profilu (např. Partner, Tomáš)', '');
    if (!jm || !jm.trim()) return;
    const id = 'p' + Date.now().toString(36);
    PROF.seznam.push({ id, jmeno: jm.trim().slice(0, 30) });
    ulozProfily();
    prepniProfil(id);
    prepni('profil');
  }
  async function prejmenujProfil(id) {
    const p = PROF.seznam.find(x => x.id === id);
    const jm = await D.zeptej('Nové jméno profilu', p.jmeno);
    if (!jm || !jm.trim()) return;
    p.jmeno = jm.trim().slice(0, 30); ulozProfily(); vykresliProfily();
  }
  async function smazProfil(id) {
    const p = PROF.seznam.find(x => x.id === id);
    if (!p || id === 'hlavni') return;
    if (!(await D.potvrd('Smazat profil „' + p.jmeno + '“ včetně jeho deníku, vlastních potravin a receptů? (Stáhni si předtím zálohu.)', { ok: 'Smazat profil' }))) return;
    if (PROF.aktivni === id) prepniProfil('hlavni');
    smazaneProfily.add(id);
    PROF.seznam = PROF.seznam.filter(x => x.id !== id); ulozProfily();
    try {
      const pryc = [];
      for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k === klicProfilu(id) || (k && k.startsWith(klicProfilu(id) + '_'))) pryc.push(k); }
      pryc.forEach(k => localStorage.removeItem(k));
    } catch (_) { /* nic */ }
    vykresliProfily();
  }
  function vykresliProfily() {
    const tl = $('#profilTl');
    if (tl) { tl.hidden = PROF.seznam.length < 2; tl.textContent = '👤 ' + profilAktivni().jmeno; }
    const kont = $('#profilySprava');
    if (!kont) return;
    kont.textContent = '';
    const ul = h('ul', { class: 'seznam' });
    for (const p of PROF.seznam) {
      const akt = p.id === PROF.aktivni;
      ul.appendChild(h('li', {},
        h('span', { class: 'nazev', style: { fontWeight: akt ? '700' : null } }, (akt ? '● ' : '○ ') + p.jmeno + (p.id === 'hlavni' ? ' (hlavní)' : '')),
        akt ? h('span', { class: 'slabe', text: 'aktivní' }) : h('button', { class: 'btn mini', type: 'button', onclick: () => prepniProfil(p.id) }, 'Přepnout'),
        h('button', { class: 'btn mini plain', type: 'button', 'aria-label': 'Přejmenovat profil ' + p.jmeno, onclick: () => prejmenujProfil(p.id) }, '✎'),
        p.id !== 'hlavni' ? h('button', { class: 'btn mini plain danger', type: 'button', 'aria-label': 'Smazat profil ' + p.jmeno, onclick: () => smazProfil(p.id) }, '✕') : null));
    }
    pridat(kont, ul, h('button', { class: 'btn mini', type: 'button', style: { marginTop: '6px' }, onclick: pridejProfil }, '+ Přidat profil'),
      h('p', { class: 'slabe', style: { fontSize: '.82rem', marginTop: '6px' }, text: 'Každý profil má vlastní deník, cíle, vlastní potraviny i recepty. Záloha a přenos se týkají aktivního profilu.' }));
  }
  function nabidkaProfilu(btn) {
    nabidka(btn, [...PROF.seznam.map(p => ({ text: (p.id === PROF.aktivni ? '✓ ' : '   ') + p.jmeno, akce: () => prepniProfil(p.id) })), '-',
      { text: '👥 Spravovat profily…', akce: () => { prepni('profil'); setTimeout(() => { const k = $('#profilySprava'); if (k) k.scrollIntoView({ block: 'center' }); }, 50); } }]);
  }

  /* ----- velikost písma ----- */
  const PISMA = [['', 'Automaticky'], ['100', 'Malé'], ['112', 'Střední'], ['125', 'Velké'], ['140', 'Největší']];
  function pouzijPismo() {
    const p = S.nastaveni.pismo || '';
    if (p) document.documentElement.dataset.pismo = p; else delete document.documentElement.dataset.pismo;
    try { if (p) localStorage.setItem(KLIC + '_pismo', p); else localStorage.removeItem(KLIC + '_pismo'); } catch (_) { /* nic */ }
    const kont = $('#pismoVolby');
    if (kont) {
      kont.textContent = '';
      for (const [v, n] of PISMA) {
        kont.appendChild(h('button', { class: 'btn mini', type: 'button', 'aria-pressed': String(p === v), 'data-pismo': v,
          style: v ? { fontSize: (+v / 100 * 0.8) + 'em' } : null, onclick: () => nastavPismo(v) }, n));
      }
    }
  }
  function nastavPismo(v) {
    S.nastaveni.pismo = v || undefined;
    if (!v) delete S.nastaveni.pismo;
    uloz(); pouzijPismo();
    kresliPozdeji(() => vykresliPohled());   // grafy a kruh se přepočítají na nový rozměr
  }
  /* ----- jednotka energie ----- */
  function pouzijEnergii() {
    const kont = $('#energieVolby');
    if (kont) {
      kont.textContent = '';
      for (const [v, n] of [['kcal', 'kcal (kilokalorie)'], ['kj', 'kJ (kilojouly)']]) {
        kont.appendChild(h('button', { class: 'btn mini', type: 'button', 'aria-pressed': String((jeKJ() ? 'kj' : 'kcal') === v), 'data-energie': v,
          onclick: () => { if (v === 'kj') S.nastaveni.energie = 'kj'; else delete S.nastaveni.energie; uloz(); pouzijEnergii(); vykresliVse(); } }, n));
      }
    }
    // texty v pevném HTML (řazení procházení)
    const raz = $('#prochazetRazeni');
    if (raz) for (const o of raz.options) {
      if (o.value === 'bilkoviny') o.textContent = 'Nejvíc bílkovin na ' + (jeKJ() ? '1 000 kJ' : '100 kcal');
      if (o.value === 'vlaknina') o.textContent = 'Nejvíc vlákniny na ' + (jeKJ() ? '1 000 kJ' : '100 kcal');
      if (o.value === 'kcal-') o.textContent = 'Nejméně ' + ej() + ' na 100 g';
      if (o.value === 'kcal+') o.textContent = 'Nejvíc ' + ej() + ' na 100 g';
    }
  }
  function nabidkaPisma(btn) {
    nabidka(btn, PISMA.map(([v, n]) => ({ text: (((S.nastaveni.pismo || '') === v) ? '✓ ' : '   ') + n + (v ? ' (' + (v === '112' ? '112,5' : v) + ' %)' : ''), akce: () => nastavPismo(v) })));
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
    if (f.typ === 'd' && f.odhad) z.push(h('span', { class: 'znak w', title: 'Vypočtené nebo odhadnuté hodnoty – nejsou naměřené', text: 'ODHAD' }));
    else if (f.typ === 'd') z.push(h('span', { class: 'znak d', title: 'Doplněno správcem webu do společné databáze', text: 'SPRÁVCE' }));
    if (f.typ === 'r') z.push(h('span', { class: 'znak r', title: 'Recept', text: 'RECEPT' }));
    if (f.typ === 'o') z.push(h('span', { class: 'znak o', title: 'Staženo online z Open Food Facts', text: 'ONLINE' }));
    if (f.priznaky & 2) z.push(h('span', { class: 'znak w', title: 'Výrobek nemá nutriční hodnoty', text: 'BEZ HODNOT' }));
    else if (f.priznaky & 512) z.push(h('span', { class: 'znak w', title: 'Hodnoty v databázi jsou zjevně chybné (např. kJ místo kcal) – použij vlastní kopii podle obalu', text: '⚠ CHYBNÉ HODNOTY' }));
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
    if (f.typ === 'd') c.push(f.odhad ? 'odhadnuté hodnoty, nenaměřené' : 'doplněno správcem');
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
      'aria-label': f.nazev + (f.znacka ? ', ' + f.znacka : '') + (Number.isFinite(kcal) ? ', ' + en(kcal) + ' na 100 ' + jedn(f) : ', bez nutričních hodnot') + popisOdznaku(f) },
      h('div', { class: 'nazev' },
        h('div', {}, ...znakPotraviny(f), dotaz ? zvyrazni(f.nazev, dotaz) : f.nazev),
        det ? h('div', { class: 'detail' }, dotaz ? zvyrazni(det, dotaz) : det) : null),
      f.nutriscore ? h('span', { class: 'nutri ' + f.nutriscore, title: 'Nutri-Score ' + f.nutriscore.toUpperCase(), text: f.nutriscore }) : null,
      h('div', { class: 'kc' }, Number.isFinite(kcal) ? fc(E(kcal)) : '–', h('small', { text: ej() + '/100 ' + jedn(f) })),
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
        const filtrF = filtr === 'vse' ? null : filtr === 's' ? f => f.typ === 's' : filtr === 'v' ? f => f.typ === 'v' || f.typ === 'o' || f.typ === 'd' : f => f.typ === 'm' || f.typ === 'r';
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
    // syrové ↔ hotové: uživatel zvážil opačný stav (80 g syrové rýže, ale zapisuje vařenou)
    const prevod = J.prevodVahy(f);
    let vazeno = prevod ? prevod.stav : null;
    const gramyZadane = () => (J.cislo(vstupM.value) || 0) * jednotky[+vyberJ.value].g;
    const gramy = () => J.zaokrouhli(J.prepocetVahy(f, gramyZadane(), vazeno), 1);
    const prevodInfo = h('div', { class: 'slabe prevod-info', 'aria-live': 'polite' });
    const prevodPrepinac = prevod ? h('div', { class: 'prevod', role: 'group', 'aria-label': 'Jak bylo zváženo' },
      h('span', { class: 'slabe', text: 'Vážil(a) jsem: ' }),
      ...['syrove', 'hotove'].map(st => {
        const b = h('button', { class: 'btn mini', type: 'button', 'data-vazeno': st, 'aria-pressed': String(st === vazeno) },
          st === 'syrove' ? (/such/.test(J.norm(prevod.stav === 'syrove' ? f.nazev : prevod.protejsek)) ? 'suché / syrové' : 'syrové') : 'hotové (uvařené, upečené)');
        b.addEventListener('click', () => { vazeno = st; prevodPrepinac.querySelectorAll('[data-vazeno]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.vazeno === st))); prepocti(); });
        return b;
      })) : null;
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
      if (prevod) {
        prevodInfo.textContent = vazeno === prevod.stav ? '' : '= ' + fc(g) + ' ' + j + ' ' + (prevod.stav === 'hotove' ? 'hotové' : 'syrové') +
          ' (syrové : hotové ≈ 1 : ' + fc(prevod.faktor, 2) + ', spočteno z naměřeného obsahu ' + (prevod.metoda === 'susina' ? 'sušiny' : 'bílkovin') + ' obou potravin; skutečnost závisí na době vaření)';
      }
      const v = J.zivinyZa(f.n || {}, g);
      vypocet.textContent = '';
      const bunka = (kl, nazev, tr) => h('div', { class: tr || '' }, h('b', { text: kl === 'kcal' ? fc(E(v.kcal), 0) : fc(v[kl], 1) + ' g' }),
        h('span', { text: nazev + (kl === 'kcal' && c.kcal && Number.isFinite(v.kcal) ? ' · ' + fc(100 * v.kcal / c.kcal, 0) + ' % cíle' : '') }));
      pridat(vypocet, bunka('kcal', ej(), 'kc'), bunka('bilkoviny', 'bílkoviny'), bunka('sacharidy', 'sacharidy'), bunka('tuk', 'tuky'));
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
    if (f.typ === 'd' && f.odhad) stitky.appendChild(h('span', { class: 'stitek', title: 'Vypočtené nebo odhadnuté hodnoty – nejsou naměřené', text: '⚠ Odhad, nenaměřeno' }));
    else if (f.typ === 'd') stitky.appendChild(h('span', { class: 'stitek', title: 'Položka společné databáze, kterou doplnil správce webu', text: '🛠️ Doplněno správcem' + (f.zmeneno && J.zKlice(f.zmeneno) ? ' ' + J.zKlice(f.zmeneno).toLocaleDateString('cs-CZ') : '') }));
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
    } else if (f.priznaky & 512) {
      telo.appendChild(h('div', { class: 'upozorneni' }, h('b', { text: 'Hodnoty tohoto výrobku jsou v databázi zjevně chybné' }), ' (energie neodpovídá živinám – často kJ místo kcal). Opiš je z obalu – ',
        h('button', { class: 'btn mini', type: 'button', onclick: () => doplnHodnoty(f) }, '✎ opravit ve vlastní kopii')));
    } else if (f.priznaky & 1 || J.energieSedi(f.n) === false) {
      telo.appendChild(h('div', { class: 'upozorneni' }, 'Hodnoty si navzájem neodpovídají (energie nesedí s makroživinami nebo cukrů je víc než sacharidů). Ověř je na obalu – ',
        h('button', { class: 'btn mini', type: 'button', onclick: () => doplnHodnoty(f) }, 'opravit ve vlastní kopii')));
    }
    if (f.typ === 'd' && f.odhad) telo.appendChild(h('div', { class: 'upozorneni' }, h('b', { text: 'Odhad – hodnoty nejsou naměřené. ' }),
      f.znacka === 'odhad z receptury' ? 'Jsou vypočtené z typické receptury, skutečné jídlo se může výrazně lišit.' : 'Jde o odhad podle běžných výrobků; konkrétní výrobek najdeš podle čárového kódu nebo etikety.',
      (() => {
        const m = J.namerenaVarianta(f, DB.suroviny);
        if (!m || !Number.isFinite(f.n.kcal)) return null;
        const roz = Math.round((f.n.kcal - m.n.kcal) / m.n.kcal * 100);
        return h('div', { style: { marginTop: '6px' } }, 'Hodnota z databáze: ', h('b', { text: m.nazev }), ' – ' + en(m.n.kcal) + '/100 ' + jedn(m) + ' (' + (m.zdroj || 'USDA') + '), odhad se liší o ' + (roz > 0 ? '+' : '') + roz + ' %. ',
          h('button', { class: 'btn mini', type: 'button', onclick: () => {
            if (volby.rezim === 'upravit' && volby.zaznam) {
              // v upravovaném záznamu odhad nahradit naměřenou potravinou (stejné jídlo, den a množství)
              const z0 = volby.zaznam, den = volby.den;
              v.zavri();
              sVracenim('Nahrazeno: ' + m.nazev, () => {
                const zz = J.najdiZaznam(S, den, z0.id);
                if (!zz) return;
                J.smazZaznam(S, den, zz.id);
                J.pridejZaznam(S, den, zz.j, m, zz.g);
              });
              return;
            }
            v.zavri();
            detailPotraviny(m, volby.rezim === 'nahled' ? { rezim: 'nahled' } : { ...volby });
          } }, 'Použít tuto'));
      })()));
    if (f.ml) telo.appendChild(infoNapoje(f, druh));
    const spolecna = f.typ === 'm' && f.ean ? DB.doplnky.find(x => x.ean === f.ean) : null;
    if (spolecna) telo.appendChild(h('div', { class: 'upozorneni info' }, 'Ve společné databázi je teď i „' + spolecna.nazev + '“ od správce. Při skenování se dál používá tvoje verze. ',
      h('button', { class: 'btn mini', type: 'button', onclick: () => detailPotraviny(spolecna, { rezim: 'nahled' }) }, 'Zobrazit společnou')));
    if (f.typ === 's') telo.appendChild(h('div', { class: 'upozorneni info', text: 'Obecná potravina podle americké databáze USDA – u konkrétního výrobku se hodnoty mohou lišit (zejména pečivo a uzeniny).' }));
    if (f.typ === 'o') telo.appendChild(h('div', { class: 'upozorneni info', text: 'Staženo online z Open Food Facts ' + (f.stazeno ? J.zKlice(f.stazeno).toLocaleDateString('cs-CZ') : '') + '. Údaje vkládají dobrovolníci – při pochybnosti porovnej s obalem.' }));

    let tlacitkoHlavni = h('button', { class: 'btn primary', type: 'button' });
    let tlacitkoDalsi = null;
    if (rezim !== 'nahled' && !bezHodnot) {
      telo.appendChild(h('div', { class: 'mnozstvi' }, vstupM, vyberJ));
      if (prevodPrepinac) { telo.appendChild(prevodPrepinac); telo.appendChild(prevodInfo); }
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
        // porce se pamatuje jen u přímého zadání (u přepočtu ze syrové váhy by neseděla)
        const porce = +vyberJ.value > 0 && (!prevod || vazeno === prevod.stav) ? { n: jednotky[+vyberJ.value].nazev, pocet: J.cislo(vstupM.value) } : null;
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
      if (f.typ === 'm' && !bezHodnot) pol.push({ text: '📮 Navrhnout do společné databáze', akce: () => navrhniDoplnek(S.vlastni[f.id] || f) });
      if (f.typ === 'm' && S.nastaveni.spravce) pol.push({ text: '🛠️ Exportovat pro společnou databázi', akce: () => exportDoplnkuDialog([f.id]) });
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
  /* ----- společná databáze: návrh od uživatele, export správce ----- */
  const KONTAKT = 'hdm@seznam.cz';
  const GITHUB_NAVRH = 'https://github.com/Lavionus/site/issues/new';
  function navrhniDoplnek(f) {
    const x = J.doplnekZVlastni(f);
    delete x.zmeneno;
    const chyby = J.overDoplnek({ ...x, zmeneno: '' });
    const json = JSON.stringify({ format: J.FORMAT_DOPLNKY, verze: 1, polozky: [x] }, null, 1);
    const predmet = 'Návrh do Deníku jídla: ' + f.nazev + (f.znacka ? ' (' + f.znacka + ')' : '');
    const text = 'Dobrý den,\nnavrhuji doplnit do společné databáze Deníku jídla tuto potravinu (hodnoty z etikety na 100 ' + jedn(f) + '):\n\n' + json + '\n';
    const pole = h('textarea', { class: 'vstup', readonly: true, rows: '8', style: { width: '100%', fontFamily: 'monospace', fontSize: '.8rem' }, 'aria-label': 'Data návrhu' });
    pole.value = json;
    const telo = h('div', { class: 'sheet-telo' },
      h('p', { text: 'Pošli správci webu svou potravinu. Když ji schválí, uvidí ji v databázi všichni. Tvoje vlastní potravina ti zůstane beze změny.' }),
      chyby.length ? h('div', { class: 'upozorneni', text: 'Než ji pošleš, zkontroluj: ' + chyby.join('; ') + '.' }) : null,
      h('p', { class: 'slabe', style: { margin: '8px 0 6px' }, text: 'Odešlou se jen údaje o potravině (název, značka, kód, živiny, porce) – nic z tvého deníku.' }),
      pole);
    const pata = h('div', { class: 'sheet-pata' },
      h('button', { class: 'btn', type: 'button', onclick: () => { pole.select(); try { navigator.clipboard.writeText(json).then(() => D.info('Zkopírováno.'), () => {}); } catch (_) { document.execCommand('copy'); } } }, '📋 Kopírovat'),
      h('div', { class: 'vpravo' },
        h('a', { class: 'btn', href: GITHUB_NAVRH + '?title=' + encodeURIComponent(predmet) + '&body=' + encodeURIComponent(text), target: '_blank', rel: 'noopener', title: 'Vyžaduje účet na GitHubu' }, '🐙 Na GitHubu'),
        h('a', { class: 'btn primary', href: 'mailto:' + KONTAKT + '?subject=' + encodeURIComponent(predmet) + '&body=' + encodeURIComponent(text) }, '✉️ Poslat e-mailem')));
    otevriVrstvu({ titulek: '📮 Navrhnout do společné databáze', telo, pata, sirka: '560px' });
  }
  // správce: sestaví celý soubor doplnky.json (zveřejněné položky + vlastní potraviny ke sdílení);
  // ten se jen uloží do obsah/potraviny/data/ a nahraje s webem
  function exportDoplnkuDialog(vybrane) {
    const vlastni = Object.values(S.vlastni).sort((a, b) => a.nazev.localeCompare(b.nazev, 'cs'));
    const zverejnene = (DB.doplnkyData || []).slice().sort((a, b) => a.nazev.localeCompare(b.nazev, 'cs'));
    if (!vlastni.length && !zverejnene.length) { D.info('Nejdřív vytvoř potravinu v Mých potravinách.'); return; }
    const volbyV = new Map(), volbyZ = new Map();
    const ulV = h('ul', { class: 'seznam' }), ulZ = h('ul', { class: 'seznam' });
    const idVlastnich = new Set(vlastni.map(f => J.idDoplnku(f))), eanVlastnich = new Set(vlastni.filter(f => f.ean).map(f => f.ean));
    for (const f of vlastni) {
      const ch = J.overDoplnek(J.doplnekZVlastni(f));
      const c = h('input', { type: 'checkbox', checked: !ch.length && (vybrane ? vybrane.includes(f.id) || f.sdilet : f.sdilet) ? true : null, disabled: ch.length ? true : null });
      volbyV.set(f.id, c);
      ulV.appendChild(h('li', {}, h('label', { class: 'prepinac', style: { margin: 0, flex: '1' } }, c, ' ', h('span', { text: f.nazev + (f.znacka ? ' · ' + f.znacka : '') + (f.ean ? ' · EAN ' + f.ean : '') }),
        ch.length ? h('span', { class: 'chyba-text', style: { display: 'block', fontSize: '.8rem' }, text: ch.join('; ') }) : null)));
    }
    for (const x of zverejnene) {
      const c = h('input', { type: 'checkbox', checked: true });
      volbyZ.set(x.id, c);
      const nahradi = idVlastnich.has(x.id) || (x.ean && eanVlastnich.has(x.ean));
      ulZ.appendChild(h('li', {}, h('label', { class: 'prepinac', style: { margin: 0, flex: '1' } }, c, ' ', h('span', { text: x.nazev + (x.znacka ? ' · ' + x.znacka : '') + (x.ean ? ' · EAN ' + x.ean : '') }),
        nahradi ? h('span', { class: 'slabe', style: { display: 'block', fontSize: '.8rem' }, text: 'zaškrtnutá vlastní potravina se stejným kódem ji nahradí' }) : null)));
    }
    const telo = h('div', { class: 'sheet-telo' },
      h('p', { style: { marginBottom: '8px' }, text: 'Vznikne celý soubor doplnky.json. Ulož ho do složky webu obsah/potraviny/data/ (přepiš ten stávající) a nahraj web – po nahrání ho uvidí všichni.' }),
      h('h3', { style: { margin: '10px 0 4px', fontSize: '.95rem' }, text: 'Moje potraviny ke sdílení' }),
      vlastni.length ? ulV : h('p', { class: 'slabe', text: 'Žádné vlastní potraviny.' }),
      zverejnene.length ? h('h3', { style: { margin: '14px 0 4px', fontSize: '.95rem' }, text: 'Už ve společné databázi (odškrtnutím odebereš)' }) : null,
      zverejnene.length ? ulZ : null);
    const ulozit = h('button', { class: 'btn primary', type: 'button' }, '💾 Uložit doplnky.json');
    ulozit.addEventListener('click', async () => {
      const sdilet = vlastni.filter(f => volbyV.get(f.id).checked);
      const ponechat = zverejnene.filter(x => volbyZ.get(x.id).checked);
      const vys = J.sestavDoplnky(ponechat, sdilet);
      if (vys.chyby.length) { D.chyba(vys.chyby.join('\n')); return; }
      // zapamatovat výběr pro příště
      for (const f of vlastni) { if (volbyV.get(f.id).checked) S.vlastni[f.id].sdilet = true; else delete S.vlastni[f.id].sdilet; }
      uloz();
      const json = JSON.stringify(vys.data, null, 1) + '\n';
      let ulozeno = false;
      if (window.showSaveFilePicker) {
        try {
          const soubor = await window.showSaveFilePicker({ suggestedName: 'doplnky.json', types: [{ description: 'Doplňky Deníku jídla', accept: { 'application/json': ['.json'] } }] });
          const w = await soubor.createWritable(); await w.write(json); await w.close();
          ulozeno = true;
        } catch (e) { if (e && e.name === 'AbortError') return; }
      }
      if (!ulozeno) stahniSoubor('doplnky.json', json, 'application/json');
      v.zavri();
      D.info('Soubor doplnky.json obsahuje ' + J.pocet(vys.data.polozky.length, 'položku', 'položky', 'položek') + '. ' +
        (ulozeno ? 'Pokud jsi ho uložil do obsah/potraviny/data/, stačí nahrát web.' : 'Přesuň ho ze Stažených do obsah/potraviny/data/ (přepiš stávající) a nahraj web.'));
    });
    const v = otevriVrstvu({ titulek: '🛠️ Společná databáze – doplnky.json', telo, pata: h('div', { class: 'sheet-pata' }, h('div', { class: 'vpravo' }, h('button', { class: 'btn', type: 'button', onclick: () => v.zavri() }, 'Zavřít'), ulozit)), sirka: '620px' });
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
            text: v === null ? '–' : (rd.k === 'kcal' ? en(v) : fc(v, rd.d) + ' ' + rd.j) }))));
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
      const hodn = z.k === 'kcal' ? (jeKJ() ? fc(n.kcal * KJ) + ' kJ (' + fc(n.kcal) + ' kcal)' : fc(n.kcal) + ' kcal (' + fc(n.kcal * KJ) + ' kJ)') : fc(n[z.k], z.d) + ' ' + z.j;
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
    if (!f.ean || (f.typ !== 'v' && f.typ !== 'd' && !(f.typ === 'm' && DB.podleEan.has(f.ean)))) return;
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
  // zdroj obecné potraviny s licencí (uvedení zdroje je podmínkou licencí)
  function ZDROJE_SUROVIN(f) {
    const z = f.zdroj || 'USDA FoodData Central';
    const pozn = ' – oficiální národní databáze; základní potraviny převážně naměřené, složená jídla často vypočtená z receptury';
    if (/^CIQUAL/.test(z)) return 'ANSES, tabulka složení potravin Ciqual 2025 (Licence Ouverte / Etalab 2.0)' + pozn;
    if (/CoFID/.test(z)) return 'McCance and Widdowson\'s Composition of Foods Integrated Dataset 2021 (contains public sector information licensed under the Open Government Licence v3.0)' + pozn;
    if (/Frida/.test(z)) return '© Food Data (frida.fooddata.dk), verze 5.5, listopad 2025, DTU Food (CC BY 4.0)' + pozn;
    if (/medián etiket/.test(z)) return 'medián údajů z etiket výrobků na českém trhu (Open Food Facts, ODbL)';
    if (/FNDDS/.test(z)) return 'USDA FNDDS 2021–2023 (CC0) – hodnoty vypočtené USDA z typické receptury, ne laboratorně naměřené';
    return 'USDA FoodData Central (CC0)';
  }
  function zdrojPotraviny(f) {
    if (f.typ === 'v') return ['Zdroj: ', h('a', { href: 'https://world.openfoodfacts.org/product/' + encodeURIComponent(f.ean), target: '_blank', rel: 'noopener', text: 'Open Food Facts' }),
      ' (ODbL), údaje k ' + (DB.meta.vyrobky ? DB.meta.vyrobky.stazeno : '') + (f.rok ? ', poslední úprava výrobku ' + f.rok : '') + '. Údaje vkládají dobrovolníci.'];
    if (f.typ === 'o') return ['Zdroj: Open Food Facts (ODbL), staženo online.'];
    if (f.typ === 'd' && f.zdrojText) return [f.zdrojText + (f.odhad ? ' Přesnější je zapsat vlastní recept nebo hodnoty z etikety.' : '')];
    if (f.typ === 'd') return ['Zdroj: doplnil správce webu podle etikety' + (f.zmeneno ? ' (' + J.zKlice(f.zmeneno).toLocaleDateString('cs-CZ') + ')' : '') + '. Chybu můžeš nahlásit správci.'];
    if (f.typ === 's') return ['Zdroj: ' + ZDROJE_SUROVIN(f) + ' – „' + (f.popis || '') + '“. Výběr a český název: autor aplikace.'];
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
      const hod = f && Number.isFinite(f.n[kl]) ? (kl === 'kcal' ? E(f.n[kl]) : f.n[kl]) : null;
      pole[kl] = h('input', { class: 'vstup', type: 'text', inputmode: 'decimal', autocomplete: 'off', 'data-krok': krok || '1', value: hod !== null ? String(J.zaokrouhli(hod, kl === 'kcal' ? 0 : 1)) : '' });
      return h('label', { class: 'pole' }, nazev, pole[kl]);
    };
    const nazev = h('input', { class: 'vstup', type: 'text', maxlength: '80', placeholder: 'např. Oběd v restauraci', value: f ? f.nazev : '' });
    const telo = h('div', { class: 'sheet-telo' },
      h('p', { class: 'slabe', style: { marginBottom: '10px' }, text: 'Pro jídla, která nechceš rozepisovat. Zadej hodnoty za celou porci – stačí energie, nebo jen makroživiny (energie se dopočítá).' }),
      h('div', { class: 'form' }, h('label', { class: 'pole siroke' }, 'Název', nazev),
        vytvor('kcal', 'Energie (' + ej() + ')'), vytvor('bilkoviny', 'Bílkoviny (g)', '0.1'), vytvor('sacharidy', 'Sacharidy (g)', '0.1'), vytvor('tuk', 'Tuky (g)', '0.1')));
    const ulozit = h('button', { class: 'btn primary', type: 'button' }, z ? 'Uložit' : 'Přidat');
    const pata = h('div', { class: 'sheet-pata' },
      z ? h('button', { class: 'btn danger', type: 'button', onclick: () => { v.zavri(); sVracenim('Smazáno: ' + (f ? f.nazev : 'rychlý záznam'), () => J.smazZaznam(S, den, z.id)); } }, '🗑️ Smazat') : null,
      h('div', { class: 'vpravo' }, h('button', { class: 'btn', type: 'button', onclick: () => v.zavri() }, 'Zrušit'), ulozit));
    const v = otevriVrstvu({ titulek: '⚡ Rychlý záznam – ' + nazevJidla(jid), telo, pata, sirka: '480px' });
    ulozit.addEventListener('click', () => {
      const n = {};
      for (const kl in pole) n[kl] = J.cislo(pole[kl].value);
      if (n.kcal !== null) n.kcal = J.zaokrouhli(zE(n.kcal), 1);
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
  // katalog přednastavených pohybů (2024 Adult Compendium) se načte až při prvním použití
  let pohybyKatalog = null, pohybySlib = null;
  function nactiPohyby() {
    if (pohybyKatalog) return Promise.resolve(pohybyKatalog);
    if (!pohybySlib) pohybySlib = stahni('pohyby.json').then(d => (pohybyKatalog = J.pripravPohyby(d))).finally(() => { pohybySlib = null; });
    return pohybySlib;
  }
  // BMR pro výpočet „navíc nad klid“ – s hmotností platnou pro ten den
  function bmrPohybu(den) {
    const kg = J.hmotnostKDni(S, den);
    return J.bmr({ ...S.profil, vaha: kg || S.profil.vaha }, den);
  }
  // délka kroku v metrech: ručně zadaná, jinak odhad 41,4 % výšky (orientační; nejlépe změřit)
  function delkaKroku() {
    const k = J.cislo(S.nastaveni.krok);
    if (k >= 30 && k <= 150) return k / 100;
    const v = J.cislo(S.profil.vyska);
    return v ? Math.round(v * 0.414) / 100 : null;
  }
  function popisPohybu(p) {
    const i = J.intenzitaMet(p.met) || J.INTENZITA.find(x => x.k === p.int);
    return [p.minuty ? fc(p.minuty) + ' min' : '', p.km ? fc(p.km, p.km < 10 ? 2 : 1) + ' km' : '', p.kroky ? J.pocet(p.kroky, 'krok', 'kroky', 'kroků') : '',
      i ? i.n + ' intenzita' : '', p.ruc ? 'energie zadaná ručně' : ''].filter(Boolean).join(' · ');
  }
  function naposledy(k) {
    const r = J.rozdilDni(k, J.datumKlic(new Date())), d = J.zKlice(k);
    return r === 0 ? 'dnes' : r === 1 ? 'včera' : 'naposledy ' + d.getDate() + '. ' + (d.getMonth() + 1) + '.';
  }
  function upozorneniPal() {
    if (!J.dvojiPohyb(S)) return null;
    const box = h('div', { class: 'upozorneni', style: { margin: '8px 14px' } },
      'Úroveň aktivity v profilu (PAL ' + fc(S.profil.pal, 1) + ') už sport zahrnuje. Když pohyb zapisuješ a přičítáš k cíli, zvol PAL podle běžného dne bez sportu (obvykle 1,4) – jinak se výdej započítá dvakrát. ',
      h('button', { class: 'btn mini', type: 'button', onclick: () => { S.profil.pal = 1.4; uloz(); box.remove(); vykresliVse(); D.info('Úroveň aktivity nastavena na PAL 1,4.'); } }, 'Nastavit PAL 1,4'));
    return box;
  }
  // týden proti doporučení WHO (pruh + text); k = libovolný den v týdnu
  function prehledTydnePohybu(k) {
    const od = pondeli(k), t = J.tydenPohybu(S, od, J.posunDen(od, 6));
    const proc = Math.min(100, t.ekvivalent / 150 * 100);
    const pruh = h('div', { class: 'pohyb-pruh', role: 'img', 'aria-label': 'Splněno ' + fc(proc) + ' % týdenního doporučení' }, h('i', {}));
    pruh.firstChild.style.width = proc + '%';
    if (t.splneno) pruh.classList.add('splneno');
    return h('div', { class: 'pohyb-tyden' },
      h('div', { class: 'radek', style: { justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' } },
        h('span', {}, 'Týden: ', h('b', { text: fc(t.ekvivalent) }), ' z 150 min',
          h('span', { class: 'slabe', text: t.vysoka ? ' (' + fc(t.stredni) + ' středně + ' + fc(t.vysoka) + ' intenzivně ×2)' : '' })),
        h('span', { class: 'slabe', text: '💪 posilování ' + t.dnySila + ' ze 2 dnů' })),
      pruh,
      h('div', { class: 'slabe', style: { fontSize: '.78rem' }, text: t.idealni ? 'Doporučení WHO splněno i v rozšířené míře (300 min). Skvělé!' : t.splneno ? 'Minimum WHO splněno. Další zdravotní přínos má až 300 min týdně.' : 'WHO doporučuje 150–300 min středně intenzivního pohybu týdně (minuta intenzivního se počítá dvakrát) a posilování aspoň 2 dny.' }));
  }

  // katalog se načítá asynchronně: dialog otevřít jen tehdy, když se mezitím nezměnil stav ani profil (a jen jednou)
  let pohybOtvira = false;
  async function sKatalogem(fn) {
    if (pohybOtvira) return;
    pohybOtvira = true;
    const S0 = S, k0 = klicStavu;
    let kat = null, chyba = null;
    try { kat = await nactiPohyby(); } catch (e) { chyba = e; } finally { pohybOtvira = false; }
    if (S !== S0 || klicStavu !== k0) return;
    fn(kat, chyba);
  }
  function vyberPohybu(den, hledat) {
    den = den || aktivniDen;
    sKatalogem((kat, chyba) => vyberPohybuK(kat, chyba, den, hledat));
  }
  function vyberPohybuK(kat, chyba, den, hledat) {
    if (chyba) {
      D.chyba('Seznam pohybů se nepodařilo načíst' + (navigator.onLine === false ? ' (jsi offline)' : '') + '. Pohyb můžeš zadat ručně.');
      upravPohybRucne(null, den);
      return;
    }
    const vstup = h('input', { type: 'search', class: 'vstup', placeholder: 'Hledat – chůze, kolo, vysávání…', 'aria-label': 'Hledat pohyb', autocomplete: 'off', enterkeyhint: 'search', spellcheck: 'false' });
    const cipy = h('div', { class: 'cipy', role: 'group', 'aria-label': 'Druh pohybu' });
    const seznam = h('ul', { class: 'vysledky', role: 'group', 'aria-label': 'Pohyby' });
    const kg = J.hmotnostKDni(S, den), bmr = bmrPohybu(den);
    const nedavne = J.nedavnePohyby(S, 10);
    let karta = nedavne.length ? 'nedavne' : 'chuze';
    const info = h('div', { class: 'slabe', style: { padding: '6px 14px' }, 'aria-live': 'polite' });
    const telo = h('div', { style: { display: 'flex', flexDirection: 'column', minHeight: 0, flex: '1' } },
      h('div', { class: 'hledani' }, vstup), upozorneniPal(), cipy, info, seznam);
    const pata = h('div', { class: 'sheet-pata' },
      h('button', { class: 'btn mini', type: 'button', onclick: () => upravPohybRucne(null, den, () => v.zavri()) }, '✎ Zadat ručně (z hodinek)'),
      h('a', { class: 'vpravo slabe', href: kat.url || 'https://pacompendium.com/', target: '_blank', rel: 'noopener', style: { fontSize: '.76rem' }, title: kat.zdroj, text: 'MET: Compendium 2024' }));
    const v = otevriVrstvu({ titulek: '🏃 Přidat pohyb', telo, pata, trida: 'sheet-pridani' });
    function polozka(p, zaznam) {
      const odhad = kg ? J.energiePohybu(p.met, zaznam && zaznam.minuty ? zaznam.minuty : 30, kg, bmr) : null;
      const i = J.intenzitaMet(p.met);
      const detail = zaznam ? popisPohybu(zaznam) + ' · ' + naposledy(zaznam.den)
        : fc(p.met, 1) + ' MET · ' + i.n + (p.nazev.includes('km/h') ? ' · ' + J.tempoMinKm(J.rychlostPohybu(p)) : p.od || p.do ? ' · ' + J.popisRychlosti(p) : '');
      const otevri = () => detailPohybu(kat, p, { den, predvyplnit: zaznam, poUlozeni: () => v.zavri() });
      return h('li', { class: 'vysledek', tabindex: '0', role: 'button', onclick: otevri,
        onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); otevri(); } } },
      h('span', { class: 'pohyb-int int-' + i.k, 'aria-hidden': 'true' }),
      h('div', { class: 'nazev' }, h('div', { text: p.nazev }), h('div', { class: 'detail', text: detail })),
      odhad ? h('span', { class: 'kc' }, en(odhad.navic), h('small', { text: 'za ' + fc(zaznam && zaznam.minuty ? zaznam.minuty : 30) + ' min' })) : null);
    }
    function vykresli() {
      const q = vstup.value.trim();
      cipy.textContent = '';
      const cip = (k, text) => h('button', { class: 'cip', type: 'button', 'aria-pressed': String(!q && karta === k), onclick: () => { karta = k; vstup.value = ''; vykresli(); } }, text);
      if (nedavne.length) cipy.appendChild(cip('nedavne', '🕘 Nedávné'));
      for (const k of kat.kategorie) cipy.appendChild(cip(k.k, k.i + ' ' + k.n));
      seznam.textContent = '';
      let n = 0;
      if (q) {
        for (const p of J.hledejPohyb(kat, q, 40)) { seznam.appendChild(polozka(p)); n++; }
        info.textContent = n ? '' : 'Nic nenalezeno. Zkus jiné slovo nebo zadej pohyb ručně.';
      } else if (karta === 'nedavne') {
        for (const z of nedavne) {
          const p = z.kod && kat.kod[z.kod];
          if (p) { seznam.appendChild(polozka(p, z)); n++; continue; }
          // ruční záznam (z hodinek): otevře ruční formulář s minulými hodnotami
          const otevri = () => upravPohybRucne(null, den, () => v.zavri(), z);
          seznam.appendChild(h('li', { class: 'vysledek', tabindex: '0', role: 'button', onclick: otevri,
            onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); otevri(); } } },
          h('span', { class: 'pohyb-int' + (z.int ? ' int-' + z.int : ''), 'aria-hidden': 'true' }),
          h('div', { class: 'nazev' }, h('div', { text: z.nazev }), h('div', { class: 'detail', text: popisPohybu(z) + ' · ' + naposledy(z.den) })),
          h('span', { class: 'kc', text: en(z.kcal) })));
          n++;
        }
        info.textContent = n ? 'Klepni a uprav dobu – předvyplní se jako minule.' : '';
      } else {
        for (const p of kat.seznam) if (p.kat === karta) { seznam.appendChild(polozka(p)); n++; }
        info.textContent = '';
      }
      if (!kg) info.textContent = 'Pro výpočet energie doplň v Profilu hmotnost (nebo ji zadej v dalším kroku).';
      else if (!info.textContent) info.textContent = 'Energie navíc nad klidový výdej pro ' + fc(kg, 1) + ' kg.';
    }
    let casovac = null;
    vstup.addEventListener('input', () => { clearTimeout(casovac); casovac = setTimeout(vykresli, 120); });
    vstup.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); const prvni = seznam.querySelector('.vysledek'); if (prvni) prvni.click(); } });
    if (hledat) vstup.value = hledat;
    vykresli();
    setTimeout(() => { if (!(window.matchMedia && matchMedia('(pointer:coarse)').matches)) vstup.focus(); }, 30);
  }

  // detail přednastaveného pohybu: tempo, doba / vzdálenost / kroky a živý výpočet energie
  function detailPohybu(kat, p0, volby) {
    const den = volby.den || aktivniDen;
    const z = volby.zaznam || null;          // upravovaný záznam
    const pred = z || volby.predvyplnit || null;
    let p = p0;
    const KROKOVE = ['chuze', 'nordic', 'pas'];
    const SOUSEDNI = { chuze: 'beh', pas: 'beh', nordic: 'beh', beh: 'chuze' };
    const pole = (atr) => h('input', { class: 'vstup', type: 'number', inputmode: 'decimal', ...atr });
    // pole mají jméno z viditelného popisku (label); name slouží jen k rozlišení
    const minuty = pole({ name: 'minuty', min: '1', max: '1440', step: '1', inputmode: 'numeric' });
    const km = pole({ name: 'km', min: '0', max: '1000', step: '0.01' });
    const kroky = pole({ name: 'kroky', min: '0', max: '300000', step: '1', inputmode: 'numeric' });
    const krok = pole({ name: 'krok', min: '30', max: '150', step: '1', inputmode: 'numeric', style: { maxWidth: '6em' } });
    const vaha = pole({ name: 'vaha', min: '25', max: '350', step: '0.1' });
    const rucne = h('input', { type: 'checkbox', name: 'rucne' });
    const kcal = pole({ name: 'kcal', min: '0', max: String(Math.round(E(10000))), step: '1', inputmode: 'numeric' });
    const tempo = h('select', { class: 'vstup', name: 'tempo' });
    const tempoPozn = h('div', { class: 'slabe', style: { fontSize: '.78rem' } });
    const vypocet = h('div', { class: 'pohyb-vypocet' });
    // čtečce obrazovky se hlásí jen souhrn, s prodlevou (ne celá tabulka při každém znaku)
    const hlaseni = h('div', { class: 'sr', 'aria-live': 'polite' });
    let hlaseniCas = null;
    const radaPole = h('div', { class: 'pole siroke' }, h('label', { class: 'pole', style: { margin: 0 } }, 'Tempo', tempo), tempoPozn);
    const krokyPole = h('label', { class: 'pole' }, 'Kroky', kroky);
    const krokPole = h('label', { class: 'pole' }, 'Délka kroku (cm)', krok);
    const kmPole = h('label', { class: 'pole' }, 'Vzdálenost (km)', km);
    const vahaPole = h('label', { class: 'pole' }, 'Hmotnost (kg)', vaha);
    const rucnePole = h('label', { class: 'pole' }, 'Spáleno navíc (' + ej() + ')', kcal);
    const titulek = h('div', { class: 'pohyb-nazev' });
    if (pred) {
      if (pred.minuty) minuty.value = String(Math.round(pred.minuty));
      if (pred.km && !pred.kroky) km.value = String(Math.round(pred.km * 100) / 100);
      if (pred.kroky) kroky.value = String(pred.kroky);
      if (z && z.ruc) { rucne.checked = true; kcal.value = String(Math.round(E(z.kcal))); }
    }
    const dk = delkaKroku();
    if (dk) krok.value = String(Math.round(dk * 100));
    const kgZname = J.hmotnostKDni(S, den);
    if (kgZname) vaha.value = String(kgZname);
    const telo = h('div', { class: 'sheet-telo' },
      titulek, upozorneniPal(),
      h('div', { class: 'form' }, radaPole,
        h('label', { class: 'pole' }, 'Doba (min)', minuty), kmPole, krokyPole, krokPole, vahaPole),
      h('label', { class: 'prepinac', style: { marginTop: '6px' } }, rucne, ' Spálenou energii znám (hodinky, trenažér)'),
      h('div', { class: 'form' }, rucnePole),
      vypocet, hlaseni,
      h('details', { class: 'pohyb-jak' }, h('summary', { text: 'Jak se to počítá?' }),
        h('p', { text: 'Každá činnost má v Compendiu intenzitu v MET – násobek klidového výdeje (zčásti z měření, zčásti odhad autorů). '
          + 'Výdej = MET × tvůj klidový výdej (bazální metabolismus z profilu) × minuty; bez vyplněného profilu se bere standard 3,5 ml O₂ na kg a minutu (ACSM). '
          + 'K dennímu cíli se přičte jen energie navíc nad klidový výdej, protože ten už cíl obsahuje. '
          + 'Ze vzdálenosti a času se spočte rychlost a vybere se odpovídající tempo; z kroků se vzdálenost odhadne podle délky kroku (výchozí odhad je 41,4 % výšky – přesnější je změřit 10 kroků). '
          + 'Skutečný výdej se mezi lidmi liší i o 20 % (kondice, terén, technika).' }),
        h('p', { class: 'slabe' }, 'Zdroj: ', h('a', { href: kat.url || 'https://pacompendium.com/', target: '_blank', rel: 'noopener', text: kat.zdroj || '2024 Adult Compendium of Physical Activities' }), '. ',
          'Intenzita: lehká pod 3 MET, střední 3–5,9 MET, vysoká od 6 MET (WHO).')));
    const ulozit = h('button', { class: 'btn primary', type: 'button' }, z ? 'Uložit' : 'Přidat');
    const pata = h('div', { class: 'sheet-pata' },
      z ? h('button', { class: 'btn danger', type: 'button', onclick: () => { v.zavri(); smazPohyb(den, z); } }, '🗑️ Smazat') : null,
      h('div', { class: 'vpravo' }, h('button', { class: 'btn', type: 'button', onclick: () => v.zavri() }, 'Zrušit'), ulozit));
    const v = otevriVrstvu({ titulek: '🏃 ' + (z ? 'Upravit pohyb' : 'Pohyb'), telo, pata, sirka: '520px' });

    function napln() {
      const rada = p.rada ? kat.rady[p.rada] : null;
      radaPole.hidden = !rada;
      tempo.textContent = '';
      if (rada) for (const x of rada) {
        const rych = J.rychlostPohybu(x);
        tempo.appendChild(h('option', { value: x.kod, selected: x === p ? true : null },
          x.nazev + (x.nazev.includes('km/h') ? '' : ' · ' + J.popisRychlosti(x)) + (p.rada === 'beh' && rych ? ' · ' + J.tempoMinKm(rych) : '')));
      }
      kmPole.hidden = !(p.od || p.do);
      krokyPole.hidden = krokPole.hidden = !KROKOVE.includes(p.rada);
    }
    let r = null;
    function prepocti() {
      const kg = J.cislo(vaha.value);
      vahaPole.hidden = !!kgZname && J.cislo(vaha.value) === kgZname && !vahaPole.dataset.ukazat;
      rucnePole.hidden = !rucne.checked;
      const delka = J.cislo(krok.value) >= 30 && J.cislo(krok.value) <= 150 ? J.cislo(krok.value) / 100 : null;
      r = J.vypoctiPohyb(kat, { pohyb: p, minuty: minuty.value, km: krokyPole.hidden ? km.value : (J.cislo(kroky.value) > 0 ? null : km.value), kroky: krokyPole.hidden ? null : kroky.value, delkaKroku: delka }, kg > 0 ? kg : null, kg > 0 ? J.bmr({ ...S.profil, vaha: kg }, den) : null);
      if (r && r.zmena) { p = r.p; tempo.value = p.kod; }
      const zRychlosti = !!(r && r.km && J.cislo(minuty.value) > 0 && p.rada);
      tempo.disabled = zRychlosti;
      tempoPozn.textContent = zRychlosti ? 'Tempo určeno z rychlosti ' + fc(r.rychlost, 1) + ' km/h' + (p.rada === 'beh' ? ' (' + J.tempoMinKm(r.rychlost) + ')' : '') + '.' : '';
      titulek.textContent = '';
      const i = J.intenzitaMet(p.met);
      pridat(titulek, h('b', { text: p.nazev }), ' ', h('span', { class: 'stitek int-' + i.k, text: fc(p.met, 1) + ' MET · ' + i.n }));
      vypocet.textContent = '';
      const radky = [];
      if (r && r.mimo && SOUSEDNI[p.rada] && kat.rady[SOUSEDNI[p.rada]]) {
        const jiny = SOUSEDNI[p.rada] === 'beh' ? 'běh' : 'chůzi';
        vypocet.appendChild(h('div', { class: 'upozorneni' }, 'Rychlost ' + fc(r.rychlost, 1) + ' km/h je ' + (r.mimo === 'nad' ? 'na tuto činnost vysoká' : 'na tuto činnost nízká') + '. ',
          h('button', { class: 'btn mini', type: 'button', onclick: () => {
            // vzdálenost (i spočtenou z kroků) přenést, aby se tempo nové činnosti vybralo podle rychlosti
            if (r && r.km && !(J.cislo(km.value) > 0)) { km.value = String(Math.round(r.km * 100) / 100); kroky.value = ''; }
            p = kat.rady[SOUSEDNI[p.rada]][0]; napln(); prepocti();
          } }, 'Přepnout na ' + jiny)));
      }
      if (r && r.minuty && !(J.cislo(minuty.value) > 0)) radky.push(['Doba', '≈ ' + fc(r.minuty) + ' min (při ' + fc(r.rychlost, 1) + ' km/h)']);
      if (r && r.kroky && r.km) radky.push(['Vzdálenost', '≈ ' + fc(r.km, 2) + ' km']);
      if (r && r.rychlost && J.cislo(minuty.value) > 0 && r.km) radky.push(['Rychlost', fc(r.rychlost, 1) + ' km/h' + (['beh', 'kolo', 'brusle', 'bezky'].includes(p.rada) || p.kat === 'beh' ? '' : '') + (p.kat === 'beh' ? ' · ' + J.tempoMinKm(r.rychlost) : '')]);
      if (!(kg > 0)) { vahaPole.hidden = false; vahaPole.dataset.ukazat = '1'; radky.push(['Energie', 'doplň hmotnost']); }
      else if (r && r.energie) {
        radky.push(['Výdej celkem', '≈ ' + en(r.energie.brutto)]);
        radky.push(['Z toho navíc nad klid', '≈ ' + en(r.energie.navic)]);
      } else if (!krokyPole.hidden && J.cislo(kroky.value) > 0 && !delka) radky.push(['Kroky', 'doplň délku kroku (nebo výšku v Profilu)']);
      else radky.push(['Energie', 'zadej dobu' + (kmPole.hidden ? '' : ', vzdálenost') + (krokyPole.hidden ? '' : ' nebo kroky')]);
      if (rucne.checked && J.cislo(kcal.value) !== null) radky.push(['Použije se', en(zE(J.cislo(kcal.value))) + ' (tvoje hodnota)']);
      const tab = h('table', { class: 'pohyb-tab' });
      for (const [a, b] of radky) tab.appendChild(h('tr', {}, h('th', { scope: 'row', text: a }), h('td', { text: b })));
      vypocet.appendChild(tab);
      const kc = hodnotaKUlozeni();
      clearTimeout(hlaseniCas);
      hlaseniCas = setTimeout(() => { hlaseni.textContent = kc !== null ? p.nazev + ': ' + (r && r.energie ? 'výdej ' + en(r.energie.brutto) + ', ' : '') + 'navíc ' + en(kc) + '.' : ''; }, 700);
      if (kc !== null) vypocet.appendChild(h('p', { class: 'pohyb-cil' },
        S.nastaveni.pohybKCili ? h('span', {}, 'K cíli dne se přičte ', h('b', { text: en(kc) }), '.') : h('span', { class: 'slabe', text: 'Přičítání pohybu k cíli máš v Profilu vypnuté.' })));
      if (p.met < 2.5) vypocet.appendChild(h('p', { class: 'slabe', style: { fontSize: '.78rem' }, text: 'Lehké běžné činnosti už obvykle zahrnuje úroveň aktivity (PAL) v profilu – zapisuj je jen tehdy, když jich bylo výrazně víc než obvykle.' }));
      if (kg > 0 && kgZname && kg !== kgZname) vypocet.appendChild(h('p', { class: 'slabe', text: 'Počítáno s ' + fc(kg, 1) + ' kg (hodnota v profilu se nemění).' }));
      else if (kg > 0) vypocet.appendChild(h('p', { class: 'slabe', style: { fontSize: '.78rem' } }, 'Počítáno pro ' + fc(kg, 1) + ' kg. ',
        h('button', { class: 'btn mini plain', type: 'button', onclick: () => { vahaPole.dataset.ukazat = '1'; vahaPole.hidden = false; vaha.focus(); } }, 'Změnit')));
    }
    function hodnotaKUlozeni() {
      if (rucne.checked) { const k = zE(J.cislo(kcal.value)); return k !== null && k >= 0 ? k : null; }
      return r && r.energie ? r.energie.navic : null;
    }
    tempo.addEventListener('change', () => { p = kat.kod[tempo.value] || p; prepocti(); });
    // kroky a vzdálenost se vylučují – druhé pole se smaže dřív, než se přepočítá
    kroky.addEventListener('input', () => { if (J.cislo(kroky.value) > 0) km.value = ''; });
    km.addEventListener('input', () => { if (J.cislo(km.value) > 0) kroky.value = ''; });
    for (const x of [minuty, km, kroky, krok, vaha, kcal]) x.addEventListener('input', prepocti);
    rucne.addEventListener('change', () => { prepocti(); if (rucne.checked) kcal.focus(); });
    napln(); prepocti();
    ulozit.addEventListener('click', () => {
      if (!vrstvy.includes(v)) return;
      prepocti();   // nikdy neukládat zastaralý výpočet
      const kc = hodnotaKUlozeni();
      if (!krokyPole.hidden && J.cislo(kroky.value) > 0 && !(J.cislo(krok.value) >= 30 && J.cislo(krok.value) <= 150)) {
        D.chyba('Pro převod kroků zadej délku kroku (30–150 cm) nebo doplň výšku v Profilu.'); krok.focus(); return;
      }
      if (!r || !r.minuty) { D.chyba('Zadej dobu' + (kmPole.hidden ? '' : ' nebo vzdálenost') + '.'); minuty.focus(); return; }
      if (kc === null) {
        if (rucne.checked) { D.chyba('Zadej spálenou energii v ' + ej() + '.'); kcal.focus(); }
        else { D.chyba('Pro výpočet energie zadej hmotnost.'); vahaPole.hidden = false; vaha.focus(); }
        return;
      }
      if (kc > 10000) { D.chyba('Tolik energie se za jeden pohyb spálit nedá – zkontroluj údaje.'); return; }
      const krokCm = J.cislo(krok.value);
      if (!krokyPole.hidden && J.cislo(kroky.value) > 0 && krokCm >= 30 && krokCm <= 150 && Math.round(krokCm) !== Math.round((delkaKroku() || 0) * 100)) S.nastaveni.krok = Math.round(krokCm);
      const x = { id: z ? z.id : J.noveId('p'), nazev: p.nazev, kod: p.kod, met: p.met, minuty: Math.round(r.minuty), kcal: Math.round(kc) };
      if (r.km) x.km = Math.round(r.km * 100) / 100;
      if (r.kroky) x.kroky = Math.round(r.kroky);
      if (r.energie) x.brutto = Math.round(r.energie.brutto);
      if (p.sila) x.sila = true;
      if (rucne.checked) x.ruc = true;
      ulozPohyb(den, z, x);
      v.zavri();
      if (volby.poUlozeni) volby.poUlozeni();
    });
    telo.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') { e.preventDefault(); ulozit.click(); } });
    setTimeout(() => minuty.focus(), 30);
  }
  function ulozPohyb(den, z, x) {
    if (z) {
      // stav mohl být mezitím nahrazen (jiná záložka, Vrátit) – pracovat s aktuálním dnem
      const dd = J.den(S, den);
      const pp = dd.pohyb.find(q => q.id === z.id);
      if (!pp) { D.chyba('Záznam se mezitím změnil nebo byl smazán – úprava se neuložila.'); vykresliDenik(); return; }
      for (const k of Object.keys(pp)) delete pp[k];
      Object.assign(pp, x);
      uloz(); vykresliDenik();
    } else {
      sVracenim('Přidáno: ' + x.nazev + (x.minuty ? ' (' + fc(x.minuty) + ' min)' : ''), () => { J.den(S, den).pohyb.push(x); });
    }
  }
  function smazPohyb(den, z) {
    sVracenim('Smazáno: ' + (z.nazev || 'aktivita'), () => { const dd = S.dny[den]; if (dd) dd.pohyb = dd.pohyb.filter(x => x.id !== z.id); });
  }
  // úprava záznamu: přednastavený pohyb otevře detail, ruční záznam (nebo bez katalogu) ruční formulář
  function upravPohyb(id) {
    const den = aktivniDen;
    const p = id ? J.den(S, den).pohyb.find(x => x.id === id) : null;
    if (!p) { vyberPohybu(den); return; }
    if (!p.kod) { upravPohybRucne(id, den); return; }
    sKatalogem(kat => {
      const pp = J.den(S, den).pohyb.find(x => x.id === id);
      if (!pp) return;
      if (kat && kat.kod[pp.kod]) detailPohybu(kat, kat.kod[pp.kod], { den, zaznam: pp });
      else upravPohybRucne(id, den);
    });
  }
  // ruční záznam: energie z hodinek nebo jiné činnosti, intenzita pro týdenní přehled
  function upravPohybRucne(id, den, poUlozeni, predvyplnit) {
    den = den || aktivniDen;
    const d = J.den(S, den);
    const p = id ? d.pohyb.find(x => x.id === id) : null;
    const q = p || predvyplnit || null;   // hodnoty do polí (úprava, nebo zopakování nedávného)
    const nazev = h('input', { class: 'vstup', type: 'text', maxlength: '60', placeholder: 'např. Běh, kolo, posilovna', value: q ? q.nazev : '' });
    const minuty = h('input', { class: 'vstup', type: 'number', min: '0', max: '1440', step: '1', inputmode: 'numeric', value: q && q.minuty ? String(q.minuty) : '' });
    const kcal = h('input', { class: 'vstup', type: 'number', min: '0', max: String(Math.round(E(10000))), step: '1', inputmode: 'numeric', value: q ? String(Math.round(E(q.kcal))) : '' });
    const celkove = h('input', { type: 'checkbox' });
    const celkPozn = h('p', { class: 'slabe', 'aria-live': 'polite' });
    const klidZa = m => {
      const b = bmrPohybu(den), kg = J.hmotnostKDni(S, den);
      return m > 0 ? (b ? b / 1440 : kg ? 3.5 * kg / 200 : null) * m : null;
    };
    const ukazCelk = () => {
      celkPozn.textContent = '';
      if (!celkove.checked) return;
      const k = zE(J.cislo(kcal.value)), m = J.cislo(minuty.value), kl = klidZa(m);
      celkPozn.textContent = kl === null ? 'Zadej dobu (a hmotnost v profilu) – klidový výdej se odečte za dobu aktivity.'
        : k !== null ? 'Klidový výdej za ' + fc(m) + ' min ≈ ' + en(kl) + ' → k cíli se přičte ' + en(Math.max(0, k - kl)) + '.' : '';
    };
    const intenzita = h('select', { class: 'vstup' }, h('option', { value: '' }, 'neuvedeno'),
      ...J.INTENZITA.map(i => h('option', { value: i.k, selected: q && (q.int === i.k || (!q.int && J.intenzitaMet(q.met) === i)) ? true : null },
        i.n + (i.k === 'lehka' ? ' (procházka, úklid)' : i.k === 'stredni' ? ' (svižná chůze, kolo – zadýchání, ale mluvíš)' : ' (běh – mluvit nejde)'))));
    const telo = h('div', { class: 'sheet-telo' },
      upozorneniPal(),
      p && p.kod ? h('div', { class: 'upozorneni info' }, 'Seznam pohybů teď není k dispozici (offline?) – upravíš jen základní údaje, ostatní zůstanou.') : null,
      h('div', { class: 'form' }, h('label', { class: 'pole siroke' }, 'Aktivita', nazev),
        h('label', { class: 'pole' }, 'Doba (min)', minuty), h('label', { class: 'pole' }, 'Spáleno (' + ej() + ')', kcal),
        h('label', { class: 'pole siroke' }, 'Intenzita (pro týdenní přehled)', intenzita)),
      h('label', { class: 'prepinac', style: { marginTop: '6px' } }, celkove, ' Je to celkový výdej včetně klidového (odečíst klid za dobu aktivity)'),
      celkPozn,
      h('p', { class: 'slabe', style: { marginTop: '10px' }, text: 'Hodinky a aplikace obvykle ukazují zvlášť „aktivní“ a „celkové“ kalorie. Zadej aktivní; máš-li jen celkové, zaškrtni volbu výše a klidový výdej se odečte (jinak by se s cílem započítal dvakrát). Přičítání k cíli lze vypnout v Profilu.' }));
    const ulozit = h('button', { class: 'btn primary', type: 'button' }, p ? 'Uložit' : 'Přidat');
    const pata = h('div', { class: 'sheet-pata' },
      p ? h('button', { class: 'btn danger', type: 'button', onclick: () => { v.zavri(); smazPohyb(den, p); } }, '🗑️ Smazat') : null,
      h('div', { class: 'vpravo' }, h('button', { class: 'btn', type: 'button', onclick: () => v.zavri() }, 'Zrušit'), ulozit));
    const v = otevriVrstvu({ titulek: '🏃 Pohyb – ruční záznam', telo, pata, sirka: '460px' });
    ulozit.addEventListener('click', () => {
      let k = zE(J.cislo(kcal.value));
      if (k === null || k < 0 || k > 10000) { D.chyba('Zadej spálenou energii v ' + ej() + '.'); kcal.focus(); return; }
      const m = J.cislo(minuty.value);
      if (m !== null && (m < 0 || m > 1440)) { D.chyba('Doba musí být 0–1440 minut.'); minuty.focus(); return; }
      let celk = null;
      if (celkove.checked) {
        const kl = klidZa(m);
        if (kl === null) { D.chyba('Pro odečtení klidového výdeje zadej dobu aktivity.'); minuty.focus(); return; }
        celk = k; k = Math.max(0, k - kl);
      }
      // úprava záznamu z katalogu (např. offline bez seznamu pohybů) zachová jeho další údaje
      const x = { ...(p || {}), id: p ? p.id : J.noveId('p'), nazev: nazev.value.trim() || 'Aktivita', kcal: Math.round(k) };
      if (!p || Math.round(k) !== Math.round(p.kcal) || p.ruc) { x.ruc = true; delete x.brutto; }
      if (celk !== null) x.brutto = Math.round(celk);
      if (p && x.nazev !== p.nazev) { delete x.kod; delete x.sila; }
      if (m) x.minuty = Math.round(m); else delete x.minuty;
      if (p && x.minuty !== p.minuty) { delete x.km; delete x.kroky; }
      if (intenzita.value) x.int = intenzita.value; else delete x.int;
      if (x.int && x.met && J.intenzitaMet(x.met).k !== x.int) delete x.met;
      ulozPohyb(den, p, x);
      v.zavri();
      if (poUlozeni) poUlozeni();
    });
    for (const x of [kcal, minuty, celkove]) x.addEventListener(x === celkove ? 'change' : 'input', ukazCelk);
    telo.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') { e.preventDefault(); ulozit.click(); } });
    setTimeout(() => nazev.focus(), 30);
  }
  // rychlé zopakování nedávného pohybu ze záhlaví karty
  function zopakujPohyb(z) {
    if (!z.kod) { upravPohybRucne(null, aktivniDen, null, z); return; }
    sKatalogem(kat => {
      if (kat && kat.kod[z.kod]) detailPohybu(kat, kat.kod[z.kod], { den: aktivniDen, predvyplnit: z });
      else upravPohybRucne(null, aktivniDen, null, z);
    });
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
        h('td', { text: z.k === 'kcal' ? en(v) : Number.isFinite(v) ? fc(v, z.d) + ' ' + z.j : '–' }),
        h('td', { text: cil ? (z.k === 'kcal' ? en(cil) : fc(cil, z.d) + ' ' + z.j) : limit ? 'max. ' + fc(limit, z.d) + ' ' + z.j : '', title: ul ? 'Horní tolerovatelný příjem (EFSA): ' + fc(ul) + ' ' + z.j + (z.k === 'vitA' ? ' – platí jen pro retinol (živočišné zdroje, doplňky), ne pro beta-karoten ze zeleniny' : z.k === 'b9' ? '' : '') : null }),
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
  /* ----- jídelníček na týden a nákupní seznam ----- */
  let planTyden = null;   // pondělí zobrazeného týdne
  function pondeli(k) { const d = J.zKlice(k); return J.posunDen(k, -((d.getDay() + 6) % 7)); }
  function vykresliPlan() {
    const kont = $('#planKarta');
    if (!kont) return;
    if (!planTyden) planTyden = pondeli(J.datumKlic(new Date()));
    const dnes = J.datumKlic(new Date());
    const konec = J.posunDen(planTyden, 6);
    kont.textContent = '';
    const nazevTydne = J.zKlice(planTyden).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' }) + ' – ' + J.zKlice(konec).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' });
    kont.appendChild(h('div', { class: 'radek', style: { marginBottom: '8px' } },
      h('h2', { text: '🗓️ Jídelníček', style: { marginRight: 'auto' } }),
      h('span', { class: 'plan-nav' },
        h('button', { class: 'btn mini', type: 'button', 'aria-label': 'Předchozí týden', onclick: () => { planTyden = J.posunDen(planTyden, -7); vykresliPlan(); } }, '◀'),
        h('span', { class: 'slabe', text: nazevTydne }),
        h('button', { class: 'btn mini', type: 'button', 'aria-label': 'Další týden', onclick: () => { planTyden = J.posunDen(planTyden, 7); vykresliPlan(); } }, '▶'))));
    const c = cileDne(dnes);
    const tyden = h('div', { class: 'plan-tyden' });
    let polozek = 0;
    for (let i = 0; i < 7; i++) {
      const k = J.posunDen(planTyden, i);
      const pol = S.plan[k] || [];
      polozek += pol.length;
      const s = J.souhrnPlanuDne(S, k);
      const den = h('div', { class: 'plan-den' + (k === dnes ? ' dnes' : '') + (k < dnes ? ' minuly' : '') });
      den.appendChild(h('div', { class: 'plan-den-hl' },
        h('b', { text: J.zKlice(k).toLocaleDateString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric' }) }),
        pol.length ? h('span', { class: 'slabe', text: en(s.kcal || 0) + (c.kcal ? ' · ' + fc(100 * (s.kcal || 0) / c.kcal) + ' %' : '') }) : null));
      const ul = h('ul', { class: 'plan-pol' });
      for (const jid of S.nastaveni.jidla.map(j => j.id).concat([...new Set(pol.map(x => x.j))])) {
        for (const x of pol.filter(p => p.j === jid)) {
          if (ul.querySelector('[data-id="' + x.id + '"]')) continue;
          const p = J.rozvinPolozkuPlanu(S, x);
          ul.appendChild(h('li', { 'data-id': x.id },
            h('span', { class: 'slabe plan-jidlo', text: nazevJidla(x.j) }),
            h('span', { class: 'nazev', text: p ? p.nazev + (p.popis ? ' · ' + p.popis : '') : '(smazaný recept či jídlo)' }),
            h('button', { class: 'btn mini plain', type: 'button', 'aria-label': 'Odebrat z jídelníčku', onclick: () => { J.smazZPlanu(S, k, x.id); uloz(); vykresliPlan(); } }, '✕')));
        }
      }
      den.appendChild(ul);
      den.appendChild(h('div', { class: 'radek plan-akce' },
        h('button', { class: 'btn mini', type: 'button', 'aria-label': 'Naplánovat na ' + J.popisDne(k, dnes), onclick: () => naplanuj(k) }, '+ Naplánovat'),
        pol.length ? h('button', { class: 'btn mini plain', type: 'button', title: 'Zapsat naplánovaná jídla do deníku tohoto dne', onclick: () => planDoDeniku(k) }, '✓ Do deníku') : null));
      tyden.appendChild(den);
    }
    kont.appendChild(tyden);
    kont.appendChild(h('div', { class: 'radek', style: { marginTop: '10px' } },
      h('button', { class: 'btn', type: 'button', disabled: !polozek, onclick: () => nakupniSeznamDialog(planTyden, konec) }, '🛒 Nákupní seznam na týden'),
      !polozek ? h('span', { class: 'slabe', text: 'Naplánuj recepty, uložená jídla nebo potraviny – nákupní seznam se sestaví sám.' }) : null));
  }
  function naplanuj(k) {
    const jidlo = h('select', { class: 'vstup', 'aria-label': 'Jídlo' }, ...jidla().map(j => h('option', { value: j.id }, j.nazev)));
    jidlo.value = jidla().some(j => j.id === 'obed') ? 'obed' : (jidla()[0] || {}).id || '';
    const recepty = Object.values(S.recepty).sort((a, b) => a.nazev.localeCompare(b.nazev, 'cs'));
    const sablony = Object.values(S.sablony).sort((a, b) => a.nazev.localeCompare(b.nazev, 'cs'));
    const co = h('select', { class: 'vstup', 'aria-label': 'Co' },
      recepty.length ? h('optgroup', { label: 'Recepty' }, ...recepty.map(r => h('option', { value: 'r:' + r.id }, r.nazev))) : null,
      sablony.length ? h('optgroup', { label: 'Uložená jídla' }, ...sablony.map(s => h('option', { value: 's:' + s.id }, s.nazev))) : null);
    const porci = h('input', { class: 'vstup', type: 'text', inputmode: 'decimal', value: '1', 'aria-label': 'Počet porcí', style: { width: '80px' } });
    const telo = h('div', { class: 'sheet-telo' },
      h('div', { class: 'form' }, h('label', { class: 'pole' }, 'Jídlo', jidlo),
        recepty.length || sablony.length ? h('label', { class: 'pole siroke' }, 'Recept nebo uložené jídlo', co) : null,
        recepty.length || sablony.length ? h('label', { class: 'pole' }, 'Porcí', porci) : null),
      !recepty.length && !sablony.length ? h('p', { class: 'slabe', text: 'Zatím nemáš recepty ani uložená jídla – můžeš naplánovat jednotlivou potravinu.' }) : null);
    const pridatTl = h('button', { class: 'btn primary', type: 'button', disabled: !(recepty.length || sablony.length) ? true : null }, 'Naplánovat');
    pridatTl.addEventListener('click', () => {
      const [druh, ref] = co.value.split(':');
      try { J.pridejDoPlanu(S, k, jidlo.value, { druh, ref, porci: J.cislo(porci.value) || 1 }); uloz(); v.zavri(); vykresliPlan(); } catch (e) { D.chyba(e.message); }
    });
    const potravinaTl = h('button', { class: 'btn', type: 'button' }, '🔎 Potravina…');
    potravinaTl.addEventListener('click', () => otevriPridani({ titulek: 'Naplánovat potravinu', naVyber: (f, g) => {
      try { J.pridejDoPlanu(S, k, jidlo.value, { druh: 'f', f, g }); uloz(); v.zavri(); vykresliPlan(); } catch (e) { D.chyba(e.message); }
    } }));
    const v = otevriVrstvu({ titulek: 'Naplánovat – ' + J.zKlice(k).toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' }), telo,
      pata: h('div', { class: 'sheet-pata' }, potravinaTl, h('div', { class: 'vpravo' }, h('button', { class: 'btn', type: 'button', onclick: () => v.zavri() }, 'Zrušit'), pridatTl)), sirka: '520px' });
  }
  function planDoDeniku(k) {
    const pred = JSON.stringify(S);
    const n = J.zapisPlanDoDeniku(S, k);
    obnovIndexUzivatele();
    ulozSListou('Zapsáno do deníku: ' + J.pocet(n, 'položka', 'položky', 'položek'), () => { S = J.normalizujStav(JSON.parse(pred)); uloz(true); vykresliVse(); });
    vykresliPlan();
  }
  function textMnozstvi(y) {
    const j = y.f.ml ? 'ml' : 'g';
    const z = y.g >= 1000 ? fc(y.g / 1000, 2) + (y.f.ml ? ' l' : ' kg') : fc(y.g) + ' ' + j;
    return y.kusu ? z + ' (≈ ' + y.kusu + ' ks)' : z;
  }
  function nakupniSeznamDialog(od, doK) {
    const seznam = J.nakupniSeznam(S, od, doK);
    const odsk = new Set((S.planNakup && S.planNakup[od]) || []);
    const klic = y => y.f.id || y.f.nazev;
    const ul = h('ul', { class: 'seznam nakup' });
    let skup = null;
    for (const y of seznam) {
      if (y.skupina !== skup) { skup = y.skupina; ul.appendChild(h('li', { class: 'nakup-skupina', text: J.SKUPINY[skup] || 'Ostatní' })); }
      const c = h('input', { type: 'checkbox', checked: odsk.has(klic(y)) ? true : null });
      c.addEventListener('change', () => {
        if (c.checked) odsk.add(klic(y)); else odsk.delete(klic(y));
        S.planNakup = S.planNakup || {}; S.planNakup[od] = [...odsk]; uloz();
        li.classList.toggle('koupeno', c.checked);
      });
      const li = h('li', { class: odsk.has(klic(y)) ? 'koupeno' : '' }, h('label', { class: 'prepinac', style: { margin: 0, flex: '1' } }, c, ' ', h('span', { text: y.f.nazev })), h('b', { text: textMnozstvi(y) }));
      ul.appendChild(li);
    }
    const text = () => 'Nákup ' + J.zKlice(od).toLocaleDateString('cs-CZ') + ' – ' + J.zKlice(doK).toLocaleDateString('cs-CZ') + '\n' +
      seznam.filter(y => !odsk.has(klic(y))).map(y => '☐ ' + y.f.nazev + ' – ' + textMnozstvi(y)).join('\n');
    const pata = h('div', { class: 'sheet-pata' },
      h('button', { class: 'btn', type: 'button', onclick: async () => { try { await navigator.clipboard.writeText(text()); D.info('Seznam zkopírován.'); } catch (_) { D.chyba('Kopírování se nepovedlo.'); } } }, '📋 Kopírovat'),
      navigator.share ? h('button', { class: 'btn', type: 'button', onclick: () => navigator.share({ title: 'Nákupní seznam', text: text() }).catch(() => {}) }, '📤 Sdílet') : null,
      h('div', { class: 'vpravo' }, h('button', { class: 'btn primary', type: 'button', onclick: () => v.zavri() }, 'Hotovo')));
    const v = otevriVrstvu({ titulek: '🛒 Nákupní seznam', telo: h('div', { class: 'sheet-telo' },
      seznam.length ? ul : h('p', { class: 'slabe', text: 'V jídelníčku tohoto týdne nic není.' }),
      h('p', { class: 'slabe', style: { fontSize: '.82rem', marginTop: '8px' }, text: 'Množství jsou sečtená ze surovin receptů a uložených jídel (syrová váha). Odškrtnuté položky si seznam pamatuje.' })), pata, sirka: '520px' });
  }
  function vykresliPotraviny() {
    vykresliPlan();
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
      // na 100 kcal, v kJ na 1 000 kJ
      const naJ = x => jeKJ() ? x * 1000 / (100 * KJ) : x, jJ = jeKJ() ? '/1 000 kJ' : '/100 kcal';
      if (raz === 'bilkoviny') extra = fc(naJ(na100kcal(f, 'bilkoviny')), 1) + ' g bílk.' + jJ;
      if (raz === 'vlaknina') extra = fc(naJ(na100kcal(f, 'vlaknina')), 1) + ' g vlák.' + jJ;
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
        ml: ml.value === '1', n: {}, porce: porce.filter(p => p.n && p.g > 0), puvod: f.puvod, skupina: f.skupina, druh: ml.value === '1' ? druhV.value : '', sdilet: f.sdilet };
      for (const kl in pole) { const v = J.cislo(pole[kl].value); if (v !== null) x.n[kl] = v; }
      if (!Number.isFinite(x.n.kcal)) { const e = J.energieZMaker(x.n); if (e !== null) x.n.kcal = Math.round(e); }
      return x;
    }
    function kontrola() {
      const x = sesbirej();
      const e = J.energieZMaker(x.n);
      sedi.textContent = e !== null && Number.isFinite(J.cislo(pole.kcal.value)) ? 'Energie spočtená z makroživin: ' + en(e) + (J.energieSedi(x.n) === false ? ' – nesedí se zadanou, zkontroluj opis.' : ' ✓') : '';
    }
    zakl.addEventListener('input', kontrola);
    zakl.addEventListener('input', e => e.target.classList.remove('z-fotky'));   // opravené pole už není „z fotky“
    // vyplnění z fotky tabulky výživových údajů (Tesseract.js v prohlížeči)
    const fotoVstup = h('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'sr', tabindex: '-1', 'aria-hidden': 'true' });
    const fotoInfo = h('div', { class: 'slabe foto-info', 'aria-live': 'polite' });
    const fotoTl = h('button', { class: 'btn', type: 'button', title: 'Vyfoť tabulku výživových údajů – hodnoty se přečtou a vyplní' }, '📷 Vyplnit z fotky etikety');
    fotoTl.addEventListener('click', () => fotoVstup.click());
    fotoVstup.addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) vyplnZFotky(f); });
    async function vyplnZFotky(soubor) {
      if (!window.DENIK_ETIKETA) { fotoInfo.textContent = 'Čtení etiket se nepodařilo načíst.'; return; }
      fotoTl.disabled = true;
      fotoInfo.textContent = 'Připravuji čtení textu (poprvé se stahuje asi 8 MB)…';
      try {
        const text = await DENIK_ETIKETA.precti(soubor, (pr, st) => {
          fotoInfo.textContent = (/recogniz/.test(st) ? 'Čtu etiketu… ' : 'Připravuji čtení textu… ') + Math.round(pr * 100) + ' %' + (/pokus/.test(st) ? st.replace(/^[^(]*/, ' ') : '');
        }, txt => J.rozeberEtiketu(txt).nalezeno);
        const v = J.rozeberEtiketu(text);
        fotoInfo.textContent = '';
        if (!v.nalezeno) {
          pridat(fotoInfo, 'Na fotce jsem nenašel tabulku výživových údajů. Vyfoť ji zblízka, rovně, ostře a bez odlesků.');
        } else {
          for (const kl in v.n) if (pole[kl]) { pole[kl].value = String(v.n[kl]).replace('.', ','); pole[kl].classList.add('z-fotky'); }
          if (v.n.kcal !== undefined) kj.value = String(Math.round(v.n.kcal * 4.184));
          if (v.ml && ml.value !== '1') { ml.value = '1'; ml.dispatchEvent(new Event('change')); }
          kontrola();
          pridat(fotoInfo, h('b', { text: 'Z fotky: ' + J.pocet(v.nalezeno, 'hodnota', 'hodnoty', 'hodnot') + '. ' }),
            'Zvýrazněná pole zkontroluj s etiketou' + (v.sedi === false ? ' – energie nesedí s makroživinami, některé číslo je asi špatně přečtené' : '') + '.');
        }
        fotoInfo.appendChild(h('details', {}, h('summary', { text: 'Přečtený text' }), h('pre', { class: 'foto-text', text: text.trim() || '(nic)' })));
      } catch (e) {
        fotoInfo.textContent = 'Fotku se nepodařilo přečíst: ' + (e && e.message || e);
      } finally { fotoTl.disabled = false; }
    }
    window.DENIK._vyplnZFotky = vyplnZFotky;   // pro testy
    const telo = h('div', { class: 'sheet-telo' },
      h('p', { class: 'slabe', style: { marginBottom: '10px' }, text: 'Opiš údaje z etikety – hodnoty na 100 g (nebo 100 ml). Údaje z obalu výrobku, který máš doma, smíš volně zapsat.' }),
      h('div', { class: 'radek', style: { marginBottom: '8px' } }, fotoTl, fotoVstup), fotoInfo,
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
  // vložený text receptu → řádky se spárovanou potravinou a gramy; uživatel zkontroluje a přidá
  function vlozSeznamSurovin(naPridani) {
    const pole = h('textarea', { class: 'vstup', rows: '8', style: { width: '100%' }, 'aria-label': 'Seznam surovin',
      placeholder: '500 g hladké mouky\n2 vejce\n3 lžíce oleje\n½ l mléka\n2 stroužky česneku\nsůl dle chuti' });
    const vysledky = h('div', {});
    let radky = [];
    // obecné suroviny + vlastní potraviny + doplňky mají přednost před výrobky
    let indexSurovin = null;
    const najdi = nazev => {
      if (!indexSurovin) indexSurovin = J.vytvorIndex(DB.suroviny.concat(Object.values(S.vlastni), DB.doplnky || []));
      return J.najdiSurovinu(indexSurovin, DB.vse.length ? DB.vse : DB.indexUziv, nazev);
    };
    function vykresli() {
      vysledky.textContent = '';
      if (!radky.length) return;
      const ul = h('ul', { class: 'seznam vlozene-suroviny' });
      for (const x of radky) {
        const c = h('input', { type: 'checkbox', checked: x.vybrano ? true : null, 'aria-label': 'Přidat ' + x.radek });
        c.addEventListener('change', () => { x.vybrano = c.checked; obnovTl(); });
        const g = h('input', { class: 'vstup', type: 'text', inputmode: 'decimal', value: x.g !== null ? String(x.g).replace('.', ',') : '', placeholder: '?', 'aria-label': 'Gramy ' + x.radek, style: { width: '72px' } });
        g.addEventListener('input', () => { x.g = J.cislo(g.value); x.odhad = false; if (x.f && x.g > 0) { x.vybrano = true; c.checked = true; } obnovTl(); });
        ul.appendChild(h('li', { class: x.f ? '' : 'nenalezeno' }, c,
          h('div', { class: 'nazev', style: { flex: '1', minWidth: '0' } },
            h('div', { text: x.f ? x.f.nazev + (x.f.znacka ? ' · ' + x.f.znacka : '') : 'Nenalezeno: „' + x.nazev + '“' }),
            h('div', { class: 'slabe', text: x.radek + (x.odhad ? ' · množství odhadnuto, zkontroluj' : '') })),
          g, h('span', { class: 'slabe', text: x.f ? jedn(x.f) : 'g' }),
          h('button', { class: 'btn mini plain', type: 'button', title: 'Vybrat jinou potravinu', onclick: () => otevriPridani({ titulek: 'Surovina: ' + x.radek, dotaz: x.nazev,
            naVyber: (f, gg) => { x.f = f; x.g = x.g !== null && !x.odhad ? x.g : J.zaokrouhli(gg, 1); x.odhad = false; x.vybrano = true; vykresli(); } }) }, x.f ? 'Změnit' : 'Vybrat')));
      }
      vysledky.appendChild(ul);
      obnovTl();
    }
    const pridatTl = h('button', { class: 'btn primary', type: 'button' }, 'Přidat do receptu');
    const obnovTl = () => { const n = radky.filter(x => x.vybrano && x.f && x.g > 0).length; pridatTl.textContent = 'Přidat do receptu (' + n + ')'; pridatTl.disabled = !n; };
    const rozpoznat = h('button', { class: 'btn', type: 'button' }, '🔎 Rozpoznat');
    rozpoznat.addEventListener('click', () => {
      if (!DB.nacteno) { D.info('Databáze se ještě načítá, zkus to za chvíli.'); return; }
      radky = J.rozeberSuroviny(pole.value).map(r => {
        const f = najdi(r.nazev);
        const gg = f ? J.gramySuroviny(r, f) : { g: r.g, odhad: false };
        return { ...r, f, g: gg.g, odhad: gg.odhad, vybrano: !!(f && gg.g > 0) };
      });
      if (!radky.length) D.info('V textu jsem nenašel žádné suroviny – dej každou na samostatný řádek.');
      vykresli();
    });
    pridatTl.addEventListener('click', () => {
      const nove = radky.filter(x => x.vybrano && x.f && x.g > 0).map(x => ({ f: x.f, g: J.zaokrouhli(x.g, 1) }));
      if (!nove.length) return;
      naPridani(nove);
      v.zavri();
    });
    pridatTl.disabled = true;
    const telo = h('div', { class: 'sheet-telo' },
      h('p', { class: 'slabe', style: { marginBottom: '6px' }, text: 'Vlož seznam surovin (každou na samostatný řádek). Rozpoznám množství (g, kg, dkg, ml, l, lžíce, lžička, hrnek, kus, stroužek…) a najdu potraviny v databázi.' }),
      pole, h('div', { class: 'radek', style: { margin: '8px 0' } }, rozpoznat), vysledky);
    const v = otevriVrstvu({ titulek: '📋 Vložit seznam surovin', telo, pata: h('div', { class: 'sheet-pata' }, h('div', { class: 'vpravo' }, h('button', { class: 'btn', type: 'button', onclick: () => v.zavri() }, 'Zrušit'), pridatTl)), sirka: '640px' });
    setTimeout(() => pole.focus(), 30);
  }
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
      pridat(vysledek, b(ej() + ' na porci', fc(E(p.kcal || 0))), b('bílkoviny / porce', fc(p.bilkoviny || 0, 1) + ' g'), b('sacharidy / porce', fc(p.sacharidy || 0, 1) + ' g'), b('tuky / porce', fc(p.tuk || 0, 1) + ' g'));
      pozn.textContent = suroviny.length ? 'Celkem ' + en(x.celkem.kcal || 0) + ' · syrové suroviny ' + fc(x.syrova) + ' g · hotové jídlo ' + fc(x.hotova) + ' g · porce ' + fc(x.porceG) + ' g · ' + en(x.na100.kcal || 0) + '/100 g' +
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
      h('div', { class: 'radek', style: { marginTop: '8px' } },
        h('button', { class: 'btn mini', type: 'button', onclick: () => otevriPridani({ titulek: 'Přidat surovinu', naVyber: (f, g) => { suroviny.push({ f: J.snimek(f), g: J.zaokrouhli(g, 1) }); vykresliSuroviny(); } }) }, '+ Přidat surovinu'),
        h('button', { class: 'btn mini', type: 'button', title: 'Vlož seznam surovin z receptu (každá na řádek) – rozpozná množství a najde potraviny', onclick: () => vlozSeznamSurovin(nove => { for (const x of nove) suroviny.push({ f: J.snimek(x.f), g: x.g }); vykresliSuroviny(); }) }, '📋 Vložit seznam surovin')),
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
  /* ----- přehled pro nutričního terapeuta (náhled + tisk / PDF) ----- */
  function zpravaProTerapeuta(od, doK) {
    const st = J.statistika(S, od, doK);
    const c = cileDne(doK);
    const p = S.profil;
    const zapsane = st.dny.filter(d => d.zapsano);
    const kont = $('#zprava');
    kont.textContent = '';
    const datum = k => J.zKlice(k).toLocaleDateString('cs-CZ');
    const sekce = (nadpis, ...obsah) => h('section', { class: 'zprava-sekce' }, h('h2', { text: nadpis }), ...obsah.filter(Boolean));
    const radekTab = (bunky, th) => h('tr', {}, ...bunky.map(b => h(th ? 'th' : 'td', { text: b === null || b === undefined ? '–' : String(b) })));
    const tabulka = (hlava, radky) => h('table', { class: 'zprava-tab' }, h('thead', {}, radekTab(hlava, true)), h('tbody', {}, ...radky.map(rr => radekTab(rr))));
    // hlavička
    const vek = J.vek(p.narozeni, doK);
    const vahy = Object.entries(S.vahy).sort();
    const vahaPosl = vahy.filter(([k]) => k <= doK).pop();
    const kg = vahaPosl ? vahaPosl[1] : J.cislo(p.vaha);
    const bmi = kg && p.vyska ? kg / Math.pow(p.vyska / 100, 2) : null;
    const jmeno = PROF.seznam.length > 1 ? profilAktivni().jmeno : '';
    const alergeny = (p.alergeny || []).map(k => (J.ALERGENY.find(a => a.k === k) || {}).n).filter(Boolean);
    kont.appendChild(h('div', { class: 'zprava-ovladani' },
      h('b', { text: 'Náhled přehledu' }), h('span', { class: 'slabe', text: 'Tisk → „Uložit jako PDF“ vytvoří soubor pro terapeuta.' }),
      h('button', { class: 'btn primary', type: 'button', onclick: () => window.print() }, '🖨️ Tisk / PDF'),
      h('button', { class: 'btn', type: 'button', onclick: zavriZpravu }, 'Zavřít')));
    kont.appendChild(h('header', { class: 'zprava-hlava' },
      h('h1', { text: 'Přehled stravování' + (jmeno ? ' – ' + jmeno : '') }),
      h('p', { text: 'Období ' + datum(od) + ' – ' + datum(doK) + ' · zapsáno ' + J.pocet(zapsane.length, 'den', 'dny', 'dní') + ' z ' + st.dny.length + ' · vytvořeno ' + new Date().toLocaleDateString('cs-CZ') + ' v aplikaci Deník jídla' })));
    kont.appendChild(sekce('Osobní údaje a cíle', tabulka(['Údaj', 'Hodnota'], [
      ['Pohlaví, věk', (p.pohlavi === 'z' ? 'žena' : 'muž') + (vek !== null ? ', ' + vek + ' let' : '')],
      ['Výška', p.vyska ? p.vyska + ' cm' : null],
      ['Hmotnost (poslední)', kg ? fc(kg, 1) + ' kg' + (vahaPosl ? ' (' + datum(vahaPosl[0]) + ')' : '') : null],
      ['BMI', bmi ? fc(bmi, 1) : null],
      ['Cíl', p.cilVaha ? 'cílová hmotnost ' + fc(p.cilVaha, 1) + ' kg, tempo ' + fc(J.cislo(p.tempo) || 0, 2) + ' kg/týden' : (J.cislo(p.tempo) ? 'tempo ' + fc(p.tempo, 2) + ' kg/týden' : 'udržení hmotnosti')],
      ['Denní cíl energie', c.kcal ? en(c.kcal) + (p.kcalRucne ? ' (zadaný ručně)' : ' (Mifflin–St Jeor × PAL ' + fc(p.pal, 2) + ')') : null],
      ['Makroživiny (cíl)', c.makraProcenta ? 'B ' + fc(c.makraProcenta.bilkoviny) + ' % · S ' + fc(c.makraProcenta.sacharidy) + ' % · T ' + fc(c.makraProcenta.tuk) + ' %' : null],
      ['Hlídané alergeny', alergeny.length ? alergeny.join(', ') : 'žádné'],
      ['Vyhýbá se', p.vyhybat || '–'],
    ])));
    if (!zapsane.length) {
      kont.appendChild(h('p', { text: 'V tomto období nejsou žádné záznamy.' }));
    } else {
      const pr = st.prumer, pe = J.podilEnergie(pr), n = st.napoje;
      const pohyb = zapsane.reduce((a, d) => a + d.s.pohyb, 0) / zapsane.length;
      kont.appendChild(sekce('Souhrn (průměr za zapsaný den)', tabulka(['Ukazatel', 'Průměr', 'Cíl / poznámka'], [
        ['Energie', en(pr.kcal || 0), c.kcal ? en(c.kcal) + ' (' + fc(100 * (pr.kcal || 0) / c.kcal) + ' %)' : ''],
        ['Bílkoviny', fc(pr.bilkoviny || 0) + ' g (' + fc(pe.bilkoviny) + ' % energie)', c.zivinyCil.bilkoviny ? fc(c.zivinyCil.bilkoviny) + ' g' + (kg ? ' · ' + fc((pr.bilkoviny || 0) / kg, 2) + ' g/kg' : '') : ''],
        ['Sacharidy', fc(pr.sacharidy || 0) + ' g (' + fc(pe.sacharidy) + ' %)', c.zivinyCil.sacharidy ? fc(c.zivinyCil.sacharidy) + ' g' : ''],
        ['z toho cukry', fc(pr.cukry || 0) + ' g', c.limity.cukry ? 'orientačně max. ' + fc(c.limity.cukry) + ' g (WHO: limit platí pro volné cukry; zde všechny cukry)' : ''],
        ['Tuky', fc(pr.tuk || 0) + ' g (' + fc(pe.tuk) + ' %)', c.zivinyCil.tuk ? fc(c.zivinyCil.tuk) + ' g' : ''],
        ['z toho nasycené', fc(pr.nasycene || 0) + ' g', c.limity.nasycene ? 'max. ' + fc(c.limity.nasycene) + ' g' : ''],
        ['Vláknina', fc(pr.vlaknina || 0, 1) + ' g', c.zivinyCil.vlaknina ? fc(c.zivinyCil.vlaknina) + ' g' : ''],
        ['Sůl', fc(pr.sul || 0, 1) + ' g', 'max. 5 g'],
        ['Pitný režim', fc(n.pitny / 1000, 2) + ' l', c.vodaMl ? 'cca ' + fc(c.vodaMl * 0.8 / 1000, 1) + ' l z nápojů' : ''],
        ['Tekuté kalorie', en(n.kcal), fc(100 * n.podil) + ' % energie'],
        ['Alkohol', fc(n.alk, 1) + ' g/den', fc(J.standardniNapoje(n.alkTydne), 1) + ' standardních nápojů týdně · dní bez alkoholu ' + n.dnyBezAlk + ' z ' + st.zapsanych],
        ['Pohyb (zapsaný, navíc nad klid)', pohyb ? en(pohyb) : '–', (() => {
          const t = J.tydenPohybu(S, od, doK), tydnu = (J.rozdilDni(od, doK) + 1) / 7;
          return t.ekvivalent || t.lehka ? fc(t.ekvivalent / tydnu) + ' min týdně ve středně intenzivním ekvivalentu (WHO 150–300) · posilování ' + fc(t.dnySila / tydnu, 1) + ' dní v týdnu' : '';
        })()],
      ])));
      // graf energie a hmotnosti
      const g1 = h('div', { class: 'zprava-graf' });
      kont.appendChild(sekce('Energie po dnech', g1));
      const dataE = st.dny.map(d => { const dt = J.zKlice(d.k); return { k: d.k, v: E(d.s.celkem.kcal || 0), popis: dt.toLocaleDateString('cs-CZ'), kratce: st.dny.length <= 31 ? dt.getDate() + '.' + (dt.getMonth() + 1) + '.' : (dt.getDate() === 1 ? (dt.getMonth() + 1) + '/' + String(dt.getFullYear()).slice(2) : '') }; });
      const vObd = vahy.filter(([k]) => k >= od && k <= doK);
      let gv = null;
      if (vObd.length >= 2) { gv = h('div', { class: 'zprava-graf' }); kont.appendChild(sekce('Hmotnost', gv, h('p', { class: 'slabe', text: 'Změna za období: ' + (vObd[vObd.length - 1][1] - vObd[0][1] > 0 ? '+' : '') + fc(vObd[vObd.length - 1][1] - vObd[0][1], 1) + ' kg (' + J.pocet(vObd.length, 'vážení', 'vážení', 'vážení') + ').' }))); }
      kresliPozdeji(() => {
        G.sloupce(g1, dataE, { cil: c.kcal ? Math.round(E(c.kcal)) : null, jednotka: ej(), popis: 'Energie po dnech', vyska: 180 });
        if (gv) { const body = vObd.map(([k, v]) => ({ t: J.zKlice(k).getTime(), v, popis: datum(k) })); G.cara(gv, body, { trend: true, jednotka: 'kg', cilV: J.cislo(p.cilVaha), popis: 'Hmotnost', popisy: [{ t: body[0].t, text: datum(vObd[0][0]) }, { t: body[body.length - 1].t, text: datum(vObd[vObd.length - 1][0]) }] }); }
      });
      // rozložení podle jídel
      const jidlaE = {};
      for (const d of zapsane) for (const j in d.s.jidla) jidlaE[j] = (jidlaE[j] || 0) + (d.s.jidla[j].kcal || 0);
      const celkE = Object.values(jidlaE).reduce((a, b) => a + b, 0) || 1;
      kont.appendChild(sekce('Rozložení energie během dne', tabulka(['Jídlo', 'Průměr', 'Podíl'],
        S.nastaveni.jidla.filter(j => jidlaE[j.id]).map(j => [j.nazev, en(jidlaE[j.id] / zapsane.length), fc(100 * jidlaE[j.id] / celkE) + ' %']))));
      // živiny
      const pokryti = {};
      for (const z of J.ZIVINY) { let e = 0, ez = 0; for (const d of zapsane) { const ee = d.s.celkem.kcal || 0; e += ee; ez += ee * (d.s.pokryti[z.k] || 0); } pokryti[z.k] = e ? ez / e : 0; }
      kont.appendChild(sekce('Průměrný denní příjem živin', tabulkaPlneni(st.prumer, c, pokryti, 'Průměr/den')));
      const tipy = J.tipyNaZiviny(S, od, doK, c, [], { mikro: S.nastaveni.mikro, limit: 8 }).tipy;
      if (tipy.length) kont.appendChild(sekce('Dlouhodobě nízký příjem (pod 75 % doporučení)', tabulka(['Živina', 'Průměr', 'Doporučeno', 'Plnění'],
        tipy.map(tp => [tp.n, fc(tp.prumer, tp.d) + ' ' + tp.j, fc(tp.cil, tp.d) + ' ' + tp.j, fc(100 * tp.podil) + ' %']))));
      // nejčastější potraviny
      kont.appendChild(sekce('Hlavní zdroje energie', tabulka(['Potravina', 'Kolikrát', 'Celkem', 'Energie celkem', 'Podíl'],
        st.top.slice(0, 15).map(x => [x.nazev + (x.znacka ? ' · ' + x.znacka : ''), x.pocet + '×', fc(x.g) + ' g', en(x.kcal), fc(100 * x.kcal / (pr.kcal * zapsane.length || 1)) + ' %']))));
      // po dnech
      kont.appendChild(sekce('Přehled po dnech', tabulka(['Datum', ej(), 'B (g)', 'S (g)', 'T (g)', 'Vlák. (g)', 'Pitný r. (l)', 'Pohyb (' + ej() + ')', 'Váha', 'Poznámka'],
        st.dny.filter(d => d.zapsano || S.vahy[d.k] !== undefined).map(d => [J.zKlice(d.k).toLocaleDateString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric' }),
          d.zapsano ? fc(E(d.s.celkem.kcal || 0)) : '', d.zapsano ? fc(d.s.celkem.bilkoviny || 0) : '', d.zapsano ? fc(d.s.celkem.sacharidy || 0) : '', d.zapsano ? fc(d.s.celkem.tuk || 0) : '',
          d.zapsano ? fc(d.s.celkem.vlaknina || 0, 1) : '', fc((d.s.voda + d.s.napoje) / 1000, 2), d.s.pohyb ? fc(E(d.s.pohyb)) : '', S.vahy[d.k] !== undefined ? fc(S.vahy[d.k], 1) : '',
          ((S.dny[d.k] || {}).pozn || '').slice(0, 120)]))));
    }
    kont.appendChild(h('p', { class: 'zprava-pata', text: 'Údaje zapsal uživatel sám. Nutriční hodnoty: Open Food Facts (ODbL), USDA FoodData Central (CC0), CIQUAL 2025 (ANSES, Etalab 2.0), UK CoFID 2021 (OGL v3), Frida 5.5 (DTU Food, CC BY 4.0) a vlastní údaje z etiket; odhady z receptur jsou označené. Referenční hodnoty EFSA a WHO; výdej při pohybu podle 2024 Adult Compendium of Physical Activities (Herrmann a kol., pacompendium.com). Jde o orientační přehled, ne o lékařské vyšetření.' }));
    kont.hidden = false;
    document.body.classList.add('zprava-otevrena');
    scrollTo(0, 0);
  }
  function zavriZpravu() {
    $('#zprava').hidden = true;
    document.body.classList.remove('zprava-otevrena');
  }
  // „Co ti chybí“ – dlouhodobě nízké živiny a čím je doplnit
  function kartaTipu(od, doK, c) {
    const karta = h('div', { class: 'karta tipy-karta' }, h('h2', { style: { marginBottom: '8px' }, text: '💡 Co ti chybí' }));
    const vyloucit = f => { const ai = hlidaSe() ? alergenInfo(f) : null; return !!(ai && (ai.obsahuje.length || ai.slova.length)); };
    const { dni, tipy } = J.tipyNaZiviny(S, od, doK, c, DB.suroviny.concat(DB.doplnky || []), { mikro: S.nastaveni.mikro, vyloucit });
    if (dni < 3) { karta.appendChild(h('p', { class: 'slabe', text: 'Tipy se ukážou, až budou v období aspoň 3 celé zapsané dny.' })); return karta; }
    if (!tipy.length) { karta.appendChild(h('p', { text: 'Za ' + J.pocet(dni, 'zapsaný den', 'zapsané dny', 'zapsaných dní') + ' ti z hlídaných živin nic výrazně nechybí. 👍' }),
      h('p', { class: 'slabe', text: 'Hlídá se vláknina, bílkoviny a hlavní vitaminy a minerály – jen tam, kde potraviny v deníku mají údaje.' })); return karta; }
    const cip = (x, novy, tp) => {
      const ff = potravina(x.f.id) || x.f;
      const mn = fc(x.mnozstvi, x.mnozstvi < 10 ? 1 : 0);
      return h('button', { class: 'navrh' + (novy ? ' novy' : ''), type: 'button', title: (novy ? 'Vyzkoušej: ' : 'Už jíš: ') + ff.nazev,
        onclick: () => detailPotraviny(ff, { rezim: 'pridat', den: aktivniDen, jidlo: () => vychoziJidlo() }) },
        h('span', { text: ff.nazev }), h('small', { text: '+' + mn + ' ' + tp.j + ' / ' + x.porce.n.replace(/ \(.*\)$/, '') }));
    };
    for (const tp of tipy) {
      const jed = tp.j;
      const blok = h('div', { class: 'tip' },
        h('div', { class: 'tip-hl' }, h('b', { text: tp.n }),
          h('span', { class: 'slabe', text: 'průměrně ' + fc(tp.prumer, tp.d) + ' z ' + fc(tp.cil, tp.d) + ' ' + jed + ' denně (' + fc(100 * tp.podil) + ' %)' })),
        h('span', { class: 'minibar', 'aria-hidden': 'true' }, h('i', { class: 'malo', style: { width: Math.min(100, 100 * tp.podil) + '%' } })));
      if (tp.moje.length) blok.appendChild(h('div', { class: 'navrhy' }, h('span', { class: 'slabe tip-popis', text: 'Už jíš – stačí častěji:' }), ...tp.moje.map(x => cip(x, false, tp))));
      if (tp.nove.length) blok.appendChild(h('div', { class: 'navrhy' }, h('span', { class: 'slabe tip-popis', text: 'Zkus přidat:' }), ...tp.nove.map(x => cip(x, true, tp))));
      karta.appendChild(blok);
    }
    karta.appendChild(h('p', { class: 'slabe', style: { marginTop: '8px', fontSize: '.82rem' }, text: 'Průměr za ' + J.pocet(dni, 'zapsaný den', 'zapsané dny', 'zapsaných dní') + ' s aspoň ' + en(400) + '; u jídel bez údaje se dopočítává. Doporučené hodnoty EFSA. Nejde o lékařskou radu – při dlouhodobém nedostatku se poraď s lékařem.' }));
    return karta;
  }
  // nápoje: pitný režim, tekuté kalorie, alkohol (průměry za zapsané dny)
  function kartaNapoju(st) {
    const n = st.napoje;
    const karta = h('div', { class: 'karta napoje-karta' }, h('h2', { style: { marginBottom: '10px' }, text: '🥤 Nápoje a alkohol' }));
    karta.appendChild(h('div', { class: 'cisla' },
      karticka(fc(n.pitny / 1000, 2) + ' l', 'pitný režim denně'),
      karticka(en(n.kcal), 'tekuté kalorie denně' + (n.podil >= 0.005 ? ' (' + fc(100 * n.podil) + ' % energie)' : '')),
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
  // pohyb za období: týdny proti doporučení WHO, rozdělení podle intenzity a nejčastější činnosti
  function kartaPohybu(od, doK) {
    const dny = [];
    for (let k = od; k <= doK; k = J.posunDen(k, 1)) dny.push(k);
    const vse = [];
    for (const k of dny) for (const p of ((S.dny[k] && S.dny[k].pohyb) || [])) vse.push({ k, p });
    if (!vse.length) return null;
    const karta = h('div', { class: 'karta' }, h('h2', { style: { marginBottom: '10px' }, text: '🏃 Pohyb' }));
    const celk = J.tydenPohybu(S, od, doK);
    const tydnu = dny.length / 7;
    karta.appendChild(h('div', { class: 'cisla', style: { marginBottom: '10px' } },
      karticka(fc(celk.stredni + celk.vysoka + celk.lehka + celk.nezname) + ' min', 'pohybu celkem'),
      karticka(fc(celk.ekvivalent / tydnu) + ' min', 'týdně (WHO ekvivalent, cíl 150)'),
      karticka(en(celk.kcal), 'energie navíc celkem'),
      karticka(fc(celk.dnySila / tydnu, 1), 'dnů s posilováním týdně (cíl 2)')));
    // sloupce: po dnech (týden) nebo po týdnech (delší období) – minuty středně intenzivního ekvivalentu
    const g = h('div', {});
    karta.appendChild(g);
    let data, cil;
    if (dny.length <= 14) {
      data = dny.map(k => { const t = J.tydenPohybu(S, k, k), dt = J.zKlice(k); return { k, v: t.stredni + t.vysoka + t.lehka + t.nezname, popis: dt.toLocaleDateString('cs-CZ'), kratce: dt.getDate() + '.' + (dt.getMonth() + 1) + '.' }; });
      cil = null;
    } else {
      data = [];
      for (let k = pondeli(od); k <= doK; k = J.posunDen(k, 7)) {
        const t = J.tydenPohybu(S, k < od ? od : k, J.posunDen(k, 6) > doK ? doK : J.posunDen(k, 6)), dt = J.zKlice(k);
        data.push({ k, v: t.ekvivalent, popis: 'týden od ' + dt.toLocaleDateString('cs-CZ'), kratce: dt.getDate() + '.' + (dt.getMonth() + 1) + '.' });
      }
      cil = 150;
    }
    kresliPozdeji(() => G.sloupce(g, data, { cil, cilMinimum: true, jednotka: 'min', vyska: 160, popis: dny.length <= 14 ? 'Minuty pohybu po dnech' : 'Minuty pohybu po týdnech (WHO ekvivalent; cíl 150)' }));
    // nejčastější činnosti
    const podle = {};
    for (const { p } of vse) {
      const kl = p.kod || p.nazev;
      const x = podle[kl] || (podle[kl] = { nazev: p.nazev, n: 0, min: 0, kcal: 0 });
      x.n++; x.min += J.cislo(p.minuty) || 0; x.kcal += J.cislo(p.kcal) || 0;
    }
    const top = Object.values(podle).sort((a, b) => b.min - a.min || b.n - a.n).slice(0, 6);
    const tab = h('table', { class: 'tab-ziviny', style: { marginTop: '10px' } },
      h('thead', {}, h('tr', {}, h('th', { text: 'Činnost' }), h('th', { text: 'Krát' }), h('th', { text: 'Minut' }), h('th', { text: ej() }))));
    const tb = h('tbody');
    for (const x of top) tb.appendChild(h('tr', {}, h('td', { text: x.nazev }), h('td', { text: fc(x.n) }), h('td', { text: x.min ? fc(x.min) : '–' }), h('td', { text: fc(E(x.kcal)) })));
    tab.appendChild(tb);
    karta.appendChild(tab);
    karta.appendChild(h('p', { class: 'slabe', style: { marginTop: '8px', fontSize: '.8rem' }, text: 'WHO (2020) doporučuje dospělým týdně 150–300 minut středně intenzivního pohybu (3–5,9 MET), nebo 75–150 minut intenzivního (od 6 MET), případně jejich kombinaci – minuta intenzivního se počítá za dvě. K tomu posilování svalů aspoň 2 dny v týdnu. Lehký pohyb se do doporučení nepočítá, ale i ten má smysl.' }));
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
      karticka(st.zapsanych ? en(prumKcal) : '–', 'průměrně za zapsaný den'),
      karticka(c.kcal && st.zapsanych ? fc(100 * prumKcal / (c.kcal + prumPohyb)) + ' %' : '–', 'průměr vůči cíli' + (prumPohyb ? ' (vč. pohybu)' : '')),
      karticka(st.zapsanych ? fc(st.prumer.bilkoviny, 0) + ' g' : '–', 'bílkovin denně'),
      karticka(J.pocet(J.serie(S, doK), 'den', 'dny', 'dní'), 'aktuální série'),
      karticka(zmena !== null ? (zmena > 0 ? '+' : '') + fc(zmena, 1) + ' kg' : '–', 'změna hmotnosti')));
    const kp = kartaPohybu(od, doK);
    if (!st.zapsanych) {
      kont.appendChild(h('div', { class: 'karta prazdny', text: 'V tomto období zatím nejsou žádné záznamy jídla.' }));
      if (kp) kont.appendChild(kp);
    } else {
      // energie po dnech
      const g1 = h('div', {});
      kont.appendChild(h('div', { class: 'karta' }, h('h2', { style: { marginBottom: '10px' }, text: 'Energie po dnech' }), g1));
      const dataE = st.dny.map(d => {
        const dt = J.zKlice(d.k);
        return { k: d.k, v: E(d.s.celkem.kcal || 0), popis: dt.toLocaleDateString('cs-CZ'), kratce: obdobi <= 31 ? dt.getDate() + '.' + (dt.getMonth() + 1) + '.' : (dt.getDate() === 1 ? (dt.getMonth() + 1) + '/' + String(dt.getFullYear()).slice(2) : '') };
      });
      kresliPozdeji(() => G.sloupce(g1, dataE, { cil: c.kcal ? Math.round(E(c.kcal + prumPohyb)) : null, jednotka: ej(), popis: 'Energie po dnech' }));
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
      if (kp) kont.appendChild(kp);
      kont.appendChild(kartaTipu(od, doK, c));
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
      karticka(en(o.vydej, 0), 'odhad skutečného výdeje'),
      karticka(en(o.prijem, 0), 'průměrný příjem'),
      karticka((o.zmenaTydne > 0 ? '+' : '') + fc(o.zmenaTydne, 2) + ' kg', 'změna hmotnosti za týden'),
      c.tdee ? karticka(en(c.tdee, 0), 'výdej podle vzorce') : null));
    const tempo = J.cislo(S.profil.tempo) || 0;
    const minimum = S.profil.pohlavi === 'z' ? 1200 : 1500;   // stejné bezpečné minimum jako u výpočtu cíle
    const doporuceno = Math.min(6000, Math.max(minimum, Math.round((o.vydej + tempo * 7700 / 7) / 10) * 10));
    // velký rozdíl proti vzorci obvykle znamená nezapsaná jídla nebo výkyvy vody
    const podezrele = c.tdee && Math.abs(o.vydej - c.tdee) > 0.4 * c.tdee;
    k.appendChild(h('p', { class: 'slabe', style: { marginTop: '8px' }, text: 'Počítá se jen s dny, kdy je zapsáno aspoň ' + en(400) + '; když některé jídlo nezapíšeš, odhad vyjde nižší. ' +
      'Pro tvůj cíl (' + (tempo ? (tempo > 0 ? '+' : '') + fc(tempo, 2) + ' kg týdně' : 'udržení') + ') by odpovídal příjem asi ' + en(doporuceno) + ' denně' +
      (doporuceno === minimum && o.vydej + tempo * 7700 / 7 < minimum ? ' (omezeno bezpečným minimem – zvolené tempo je při tvém výdeji příliš rychlé)' : '') + '.' }));
    if (podezrele) k.appendChild(h('p', { class: 'warn-text', style: { marginTop: '6px', fontSize: '.86rem' }, text: 'Odhad se od výpočtu podle vzorce liší o víc než 40 % – zkontroluj, jestli zapisuješ všechna jídla, a radši počkej na další data.' }));
    else if (c.kcal && Math.abs(doporuceno - c.kcal) >= 100) {
      k.appendChild(h('button', { class: 'btn mini', type: 'button', style: { marginTop: '6px' }, onclick: () => {
        S.profil.kcalRucne = doporuceno; uloz(); vykresliStatistiky(); D.info('Denní cíl nastaven na ' + en(doporuceno) + ' (lze vrátit v profilu).');
      } }, 'Použít ' + en(doporuceno) + ' jako denní cíl'));
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
      const fmt = v => zdrojeZivina === 'kcal' ? en(v) : fc(v, z.d) + ' ' + z.j;
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
      const popis = J.zKlice(k).toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' }) + (s.pocet ? ': ' + en(s.celkem.kcal || 0) + (pod !== null ? ' (' + fc(100 * pod) + ' % cíle)' : '') : ': bez záznamu');
      const b = h('button', { class: 'kal-den ' + tr + (k === dnes ? ' dnes' : ''), type: 'button', title: popis, 'aria-label': popis, disabled: k > dnes },
        h('span', { text: String(den) }), s.pocet ? h('small', { text: fc(E(s.celkem.kcal || 0)) }) : null);
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
    f.stav.value = p.pohlavi === 'z' && p.stav ? p.stav : '';
    $('#poleStav').hidden = f.pohlavi.value !== 'z';
    if (!f.pohlavi.dataset.stav) { f.pohlavi.dataset.stav = '1'; f.pohlavi.addEventListener('change', () => { $('#poleStav').hidden = f.pohlavi.value !== 'z'; }); }
    f.narozeni.value = p.narozeni || '';
    f.vyska.value = p.vyska || '';
    const desetinne = v => (v === '' || v === null || v === undefined) ? '' : String(v).replace('.', ',');
    f.vaha.value = desetinne(p.vaha);
    f.pal.value = String(p.pal || 1.4);
    f.tempo.value = String(p.tempo || 0);
    f.cilVaha.value = desetinne(p.cilVaha);
    f.kcalRucne.value = p.kcalRucne ? String(Math.round(E(p.kcalRucne) / (jeKJ() ? 10 : 1)) * (jeKJ() ? 10 : 1)) : '';
    f.kcalRucne.min = String(Math.round(E(800))); f.kcalRucne.max = String(Math.round(E(6000)));
    $('#kcalRucneJ').textContent = ej();
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
    if (p.pohlavi === 'z' && f.stav.value) p.stav = f.stav.value; else delete p.stav;
    p.narozeni = f.narozeni.value;
    if (p.narozeni && J.vek(p.narozeni) === null) chyby.push('Datum narození není platné.');
    p.vyska = rozsah('vyska', 100, 250, 'Výška');
    p.vaha = rozsah('vaha', 25, 350, 'Hmotnost');
    p.pal = J.cislo(f.pal.value) || 1.4;
    p.tempo = J.cislo(f.tempo.value) || 0;
    p.cilVaha = rozsah('cilVaha', 25, 350, 'Cílová hmotnost');
    p.kcalRucne = (() => {   // zadává se ve zvolené jednotce, ukládá v kcal
      const v = J.cislo(f.kcalRucne.value);
      if (v === null) return '';
      const k = Math.round(zE(v));
      if (k < 800 || k > 6000) {
        if (zmena) { chyby.push('Vlastní cíl energie musí být ' + en(800) + ' – ' + en(6000) + '.'); return ''; }
        return p.kcalRucne;
      }
      return k;
    })();
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
      karticka(en(c.kcal), 'denní cíl energie'),
      c.bmr ? karticka(en(c.bmr), 'bazální metabolismus') : null,
      c.tdee ? karticka(en(c.tdee), 'výdej při tvé aktivitě') : null,
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
    el.appendChild(h('p', { class: 'slabe', style: { marginTop: '10px' }, text: 'Výpočet: bazální metabolismus podle Mifflina–St Jeora × úroveň aktivity (PAL); 1 kg tukové tkáně ≈ ' + en(7700) + '. Je to odhad – sleduj vývoj hmotnosti a cíl podle něj uprav.' }));
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
  /* ----- přenos animovaným QR kódem (prenos.js) ----- */
  let qrVysilac = null;
  async function qrOdeslat() {
    const UI = window.DENIK_PRENOS_UI;
    if (!UI) { D.chyba('Přenos se nepodařilo načíst.'); return; }
    J.uklid(S);
    const text = J.exportJson(S);
    const platno = h('canvas', { class: 'qr-platno', role: 'img', 'aria-label': 'Animovaný QR kód s daty deníku' });
    const info = h('div', { class: 'slabe', 'aria-live': 'polite', style: { textAlign: 'center', marginTop: '6px' } });
    const rychlost = h('select', { class: 'vstup', 'aria-label': 'Rychlost' }, ...[[4, 'pomalu (4/s)'], [6, 'středně (6/s)'], [10, 'rychle (10/s)']].map(([v, n]) => h('option', { value: String(v), selected: v === 6 ? true : null }, n)));
    const hustota = h('select', { class: 'vstup', 'aria-label': 'Velikost kódů' },
      h('option', { value: '500' }, 'větší kódy – kratší přenos'), h('option', { value: '250' }, 'menší kódy – snáz se čtou'));
    if (innerWidth < 600) hustota.value = '250';   // z malého displeje čte webkamera hůř
    const telo = h('div', { class: 'sheet-telo qr-telo' },
      h('p', { text: 'Na druhém zařízení otevři Deník jídla → Data → 📷 Přijmout přes QR a namiř kameru na tento kód. Nemusí chytit každý snímek – přenos se dokončí sám.' }),
      h('div', { class: 'qr-ram' }, platno), info,
      h('div', { class: 'radek', style: { justifyContent: 'center', marginTop: '8px' } }, rychlost, hustota));
    let beh = 0;   // pořadí spuštění: starší (nebo po zavření dokončené) spuštění se hned zastaví
    const v = otevriVrstvu({ titulek: '📡 Odeslat přes QR', telo, sirka: '640px', priZavreni: () => { beh++; if (qrVysilac) qrVysilac.zastav(); qrVysilac = null; } });
    const rozmer = () => Math.max(200, Math.min(telo.clientWidth - 8, innerHeight * 0.62));
    const spust = async () => {
      const moje = ++beh;
      if (qrVysilac) qrVysilac.zastav();
      qrVysilac = null;
      try {
        const vys = await UI.odesli(text, { platno, rozmer, blok: +hustota.value, fps: +rychlost.value,
          naSnimek: (i, K) => { info.textContent = 'Snímek ' + i + ' · dat ' + fc(qrVysilac ? qrVysilac.bajtu / 1024 : 0, 1) + ' kB v ' + J.pocet(K, 'bloku', 'blocích', 'blocích') + ' · přenos zhruba ' + fc(Math.ceil(K * 1.3 / +rychlost.value)) + ' s'; } });
        if (moje !== beh || !vrstvy.includes(v)) { vys.zastav(); return; }
        qrVysilac = vys;
      } catch (e) { if (moje === beh) info.textContent = e.message; }
    };
    window.DENIK._qrVysilac = () => qrVysilac;   // pro testy
    rychlost.addEventListener('change', () => { if (qrVysilac) qrVysilac.rychlost(+rychlost.value); });
    hustota.addEventListener('change', spust);
    await spust();
    return v;
  }
  async function qrPrijmout() {
    const UI = window.DENIK_PRENOS_UI;
    if (!UI) { D.chyba('Přenos se nepodařilo načíst.'); return; }
    const video = h('video', { class: 'qr-video', playsinline: true, muted: true, autoplay: true });
    const pruh = h('i', {});
    const info = h('div', { 'aria-live': 'polite', style: { textAlign: 'center', marginTop: '6px' }, text: 'Spouštím kameru…' });
    const telo = h('div', { class: 'sheet-telo qr-telo' },
      h('p', { class: 'slabe', text: 'Namiř kameru na animovaný QR kód na druhém zařízení (Data → 📡 Odeslat přes QR). Drž ji klidně, kód může zabírat i jen část obrazu.' }),
      h('div', { class: 'qr-ram' }, video),
      h('div', { class: 'qr-prubeh', role: 'progressbar', 'aria-label': 'Průběh přenosu', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0' }, pruh), info);
    let prijem = null, zavreno = false;
    const v = otevriVrstvu({ titulek: '📷 Přijmout přes QR', telo, sirka: '640px', priZavreni: () => { zavreno = true; if (prijem) prijem.zastav(); prijem = null; } });
    const naStav = s => {
      if (!s.K) return;
      const pr = Math.min(100, Math.round(100 * s.mam / s.K));
      pruh.style.width = pr + '%';
      telo.querySelector('.qr-prubeh').setAttribute('aria-valuenow', String(pr));
      info.textContent = 'Přijato ' + pr + ' % (' + s.mam + ' z ' + s.K + ' bloků)';
    };
    const naHotovo = async txt => {
      zavibruj(40);
      v.zavri();
      await importuj(new Blob([txt], { type: 'application/json' }));
    };
    window.DENIK._qrPrijem = { naStav, naHotovo };   // pro testy
    try {
      const p = await UI.prijmi({ video, naStav, naHotovo, naChybu: e => { info.textContent = e.message; }, zruseno: () => zavreno });
      if (zavreno) { p.zastav(); return; }   // dialog se zavřel během dotazu na kameru
      prijem = p;
      if (!info.textContent.startsWith('Přijato')) info.textContent = 'Hledám QR kód…';
    } catch (e) {
      info.textContent = e && e.name === 'NotAllowedError' ? 'Kamera není povolená – povol ji v nastavení prohlížeče.' : 'Kameru se nepodařilo spustit (' + (e && e.message || e) + ').';
    }
    return v;
  }
  // záloha přes systémové sdílení (Rychlé sdílení, Bluetooth, AirDrop, e-mail…); jinde se stáhne
  async function posliZalohu() {
    J.uklid(S);
    const nazev = 'denik-jidla-' + priponaProfilu() + J.datumKlic(new Date()) + '.json';
    const soubor = new File([J.exportJson(S)], nazev, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [soubor] })) {
      try {
        await navigator.share({ files: [soubor], title: 'Deník jídla – záloha', text: 'Záloha Deníku jídla. Na druhém zařízení: Data → Obnovit ze zálohy → Sloučit.' });
        S.nastaveni.zaloha = J.datumKlic(new Date()); uloz(); vykresliData();
      } catch (e) { if (e && e.name !== 'AbortError') D.chyba('Sdílení se nepovedlo: ' + e.message); }
      return;
    }
    stahniZalohu();
    D.info('Tento prohlížeč neumí sdílet soubory, záloha se proto stáhla. Přenes ji do druhého zařízení a tam dej Data → Obnovit ze zálohy.');
  }
  function stahniZalohu() {
    J.uklid(S);
    stahniSoubor('denik-jidla-' + priponaProfilu() + J.datumKlic(new Date()) + '.json', J.exportJson(S), 'application/json');
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
    try { localStorage.setItem(klicStavu + '_pred_importem', pred); } catch (_) { /* málo místa – zůstane jen Vrátit */ }
    if (nahradit) S = novy;
    const n = nahradit ? zaznamu : J.slucStav(S, novy);
    obnovIndexUzivatele(); vykresliVse();
    ulozSListou((nahradit ? 'Záloha obnovena' : 'Sloučeno, přidáno: ' + J.pocet(n, 'záznam', 'záznamy', 'záznamů')), () => {
      S = J.normalizujStav(JSON.parse(pred)); uloz(true); obnovIndexUzivatele(); vykresliVse();
    });
  }

  function vykresliSpravce() {
    // sekce pro správce je vidět jen po otevření adresy s #spravce (nebo když už je režim zapnutý)
    const sekce = $('#sekceSpravce');
    if (sekce) sekce.hidden = !(S.nastaveni.spravce || location.hash === '#spravce');
    const c = $('#nSpravce');
    if (c) c.checked = !!S.nastaveni.spravce;
    const tl = $('#exportDoplnku');
    if (tl) tl.hidden = !S.nastaveni.spravce;
  }
  function vykresliData() {
    vykresliSpravce();
    let velikost = 0;
    try { velikost = (localStorage.getItem(klicStavu) || '').length; } catch (_) { /* nic */ }
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
        if (!k || !(k.startsWith(klicStavu + '_pred_importem') || k.startsWith(klicStavu + '_poskozeno_'))) continue;
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
      DB.doplnky.length ? h('h3', { style: { marginTop: '12px' }, text: '🛠️ Doplňky správce' }) : null,
      DB.doplnky.length ? h('p', {}, fc(DB.doplnky.length) + ' potravin doplnil nebo opravil správce webu podle etiket' + (DB.meta.doplnky && DB.meta.doplnky.zmeneno ? ' (naposledy ' + J.zKlice(DB.meta.doplnky.zmeneno).toLocaleDateString('cs-CZ') + ')' : '') + ': ',
        h('a', { href: DATA + 'doplnky.json', download: '', text: 'doplnky.json' }), '. Výrobek se stejným kódem z Open Food Facts nahrazují.') : null,
      h('h3', { style: { marginTop: '12px' }, text: '🥕 Obecné potraviny' }),
      h('p', {}, fc(DB.suroviny.length) + ' obecných potravin z oficiálních databází; výběr a české názvy připravil autor aplikace:'),
      h('ul', { style: { margin: '4px 0 0 18px' } },
        h('li', {}, h('a', { href: 'https://fdc.nal.usda.gov/', target: '_blank', rel: 'noopener', text: 'USDA FoodData Central' }), ' – SR Legacy, Foundation Foods a FNDDS 2021–2023 (volné dílo CC0). FNDDS = hotová jídla, hodnoty USDA vypočtené z receptur.'),
        h('li', {}, 'ANSES. 2025. ', h('a', { href: 'https://doi.org/10.57745/RDMHWY', target: '_blank', rel: 'noopener', text: 'Table de composition nutritionnelle des aliments Ciqual 2025' }), ' (Licence Ouverte / Etalab 2.0).'),
        h('li', {}, 'McCance and Widdowson\'s ', h('a', { href: 'https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid', target: '_blank', rel: 'noopener', text: 'Composition of Foods Integrated Dataset 2021' }),
          ' – contains public sector information licensed under the Open Government Licence v3.0.'),
        h('li', {}, '© Food Data (', h('a', { href: 'https://frida.fooddata.dk', target: '_blank', rel: 'noopener', text: 'frida.fooddata.dk' }), '), version 5.5, November 2025, DTU National Food Institute (CC BY 4.0).'),
        h('li', {}, 'Mediány z etiket výrobků na českém trhu (Open Food Facts, ODbL) – jen při ≥ 5 výrobcích a malém rozptylu.')),
      h('p', { class: 'slabe', style: { marginTop: '4px' }, text: 'Hodnoty odpovídají potravinám v zemi původu databáze; u konkrétního výrobku je přesnější jeho etiketa. Položky se značkou ODHAD (vypočtené z receptury nebo odhadnuté) nejsou naměřené.' }),
      h('h3', { style: { marginTop: '12px' }, text: '🎯 Referenční hodnoty' }),
      h('p', {}, 'Vitaminy a minerály: ', h('a', { href: 'https://multimedia.efsa.europa.eu/drvs/index.htm', target: '_blank', rel: 'noopener', text: 'EFSA – Dietary Reference Values' }),
        ' (zdroj: Evropský úřad pro bezpečnost potravin). Energie: rovnice Mifflin–St Jeor. Limity cukrů, nasycených tuků a soli: doporučení WHO. Názvy přídatných látek a alergenů: taxonomie Open Food Facts (ODbL).'),
      h('h3', { style: { marginTop: '12px' }, text: '📷 Čtečka kódů' }),
      h('p', {}, 'Nativní BarcodeDetector prohlížeče, jinak ', h('a', { href: 'https://github.com/Sec-ant/zxing-wasm', target: '_blank', rel: 'noopener', text: 'zxing-wasm' }), ' (MIT) postavený na zxing-cpp (Apache 2.0).'),
      h('h3', { style: { marginTop: '12px' }, text: '🔒 Soukromí' }),
      h('p', {}, 'Deník, profil a vlastní potraviny jsou uložené jen v tomto prohlížeči a nikam se neodesílají. Online se posílá jen čárový kód při hledání neznámého výrobku v Open Food Facts a načítají se fotky výrobků – obojí lze vypnout v nastavení.'));
  }

  /* ================= přidání na plochu ================= */
  let instalacePrompt = null;
  function zarizeni() {
    const ua = navigator.userAgent || '';
    const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    return {
      ios, android: /Android/.test(ua),
      safari: ios && !/CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser/.test(ua),
      firefox: /Firefox|FxiOS/.test(ua), samsung: /SamsungBrowser/.test(ua), edge: /Edg\//.test(ua),
      dotyk: !!(window.matchMedia && matchMedia('(pointer:coarse)').matches),
    };
  }
  function jeNaPlose() {
    return !!((window.matchMedia && (matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || matchMedia('(display-mode: minimal-ui)').matches)) || navigator.standalone === true);
  }
  function ukazTlacitkaPlochy() {
    const na = jeNaPlose();
    $('#plochaTl').hidden = na || !zarizeni().dotyk;   // v hlavičce jen na telefonu a tabletu
    $('#instalovat').hidden = na;
    const info = $('#instalovatInfo');
    if (info && na) info.textContent = 'Deník máš otevřený jako aplikaci z plochy.';
  }
  async function pridatNaPlochu() {
    // v rozcestníku (iframe) prohlížeč přidat na plochu nedovolí – otevřít Deník samostatně a návod ukázat tam
    if (window.top !== window) {
      const telo = h('div', { class: 'sheet-telo' },
        h('p', { text: 'Deník je teď otevřený uvnitř rozcestníku webu a odtud ho prohlížeč na plochu přidat neumí. Otevři ho samostatně – návod se ukáže hned. Data zůstanou stejná.' }));
      const pata = h('div', { class: 'sheet-pata' }, h('div', { class: 'vpravo' },
        h('button', { class: 'btn', type: 'button', onclick: () => v.zavri() }, 'Zrušit'),
        h('a', { class: 'btn primary', href: 'potraviny.html#plocha', target: '_blank', rel: 'noopener', onclick: () => v.zavri() }, 'Otevřít Deník samostatně')));
      const v = otevriVrstvu({ titulek: '📲 Přidat na plochu', telo, pata, sirka: '460px' });
      return;
    }
    if (instalacePrompt) {
      const p = instalacePrompt;
      instalacePrompt = null;
      // prompt() bez gesta uživatele (nebo podruhé) se odmítne – pak návod
      try { await p.prompt(); const v = await p.userChoice; if (v && v.outcome === 'accepted') return; if (v && v.outcome === 'dismissed') return; } catch (_) { /* návod níž */ }
    }
    navodPlocha();
  }
  function navodPlocha() {
    const z = zarizeni();
    const kroky = (...k) => h('ol', { class: 'navod-kroky' }, ...k.map(x => h('li', {}, ...[].concat(x))));
    const b = t => h('b', { text: t });
    const telo = h('div', { class: 'sheet-telo navod-plocha' });
    if (z.ios) {
      telo.appendChild(h('h3', { text: z.safari ? 'iPhone / iPad – Safari' : 'iPhone / iPad' }));
      telo.appendChild(kroky(
        ['Klepni na tlačítko ', b('Sdílet'), ' (čtvereček se šipkou nahoru) – v Safari dole uprostřed, na iPadu nahoře vpravo' + (z.safari ? '' : '; v Chromu a Edge je vpravo v adresním řádku') + '.'],
        ['V nabídce sjeď níž a vyber ', b('Přidat na plochu'), '.'],
        ['Potvrď ', b('Přidat'), ' vpravo nahoře. Na ploše se objeví ikona 🥗 Deník jídla.']));
      if (!z.safari) telo.appendChild(h('p', { class: 'slabe', text: 'Ve starších verzích iOS (před 16.4) jde přidat na plochu jen ze Safari – otevři tuto stránku tam.' }));
      telo.appendChild(h('div', { class: 'upozorneni' }, h('b', { text: 'Pozor na data: ' }),
        'Deník na ploše má na iPhonu vlastní úložiště, oddělené od Safari – co máš zapsané tady, se tam samo nepřenese. ',
        'Stáhni si zálohu a po prvním otevření z plochy ji obnov (Data → Obnovit ze zálohy), nebo použij přenos přes QR.',
        h('div', { style: { marginTop: '8px' } }, h('button', { class: 'btn mini', type: 'button', onclick: posliZalohu }, '📤 Uložit zálohu'))));
    } else if (z.android) {
      if (z.samsung) {
        telo.appendChild(h('h3', { text: 'Android – Samsung Internet' }));
        telo.appendChild(kroky(['Klepni na nabídku ', b('☰'), ' dole vpravo.'], ['Vyber ', b('Přidat stránku na'), ' → ', b('Domovská obrazovka'), '.'], ['Potvrď ', b('Přidat'), '.']));
      } else if (z.firefox) {
        telo.appendChild(h('h3', { text: 'Android – Firefox' }));
        telo.appendChild(kroky(['Klepni na nabídku ', b('⋮'), ' (tři tečky).'], ['Vyber ', b('Přidat na domovskou obrazovku'), ' (nebo ', b('Nainstalovat'), ').'], ['Potvrď ', b('Přidat'), '.']));
      } else {
        telo.appendChild(h('h3', { text: 'Android – Chrome' + (z.edge ? ' / Edge' : '') }));
        telo.appendChild(kroky(['Klepni na nabídku ', b('⋮'), ' (tři tečky vpravo nahoře).'], ['Vyber ', b('Přidat na plochu'), ' nebo ', b('Nainstalovat aplikaci'), '.'], ['Potvrď ', b('Instalovat'), ' / ', b('Přidat'), '.']));
      }
      telo.appendChild(h('p', { class: 'slabe', text: 'Na Androidu sdílí aplikace z plochy data s prohlížečem – zápisy zůstanou.' }));
    } else {
      telo.appendChild(h('h3', { text: 'Počítač' }));
      telo.appendChild(kroky(
        ['V Chromu nebo Edge klepni na ikonu ', b('instalace'), ' vpravo v adresním řádku (monitor se šipkou), případně nabídka ⋮ → ', b('Uložit a sdílet'), ' → ', b('Nainstalovat stránku jako aplikaci'), '.'],
        ['V ostatních prohlížečích si stránku ulož do záložek: ', b('Ctrl + D'), ' (na Macu ⌘ + D).']));
      telo.appendChild(h('p', { class: 'slabe', text: 'Na telefon se Deník dostane stejně: otevři na něm tuto stránku a dej Přidat na plochu. Data přeneseš přes Data → Přenos přes QR.' }));
    }
    telo.appendChild(h('p', { class: 'slabe', style: { marginTop: '10px' }, text: 'Deník z plochy se otevírá jako samostatná aplikace, funguje i bez internetu a prohlížeč jeho data spolehlivěji chrání před smazáním.' }));
    const pata = h('div', { class: 'sheet-pata' }, h('div', { class: 'vpravo' }, h('button', { class: 'btn primary', type: 'button', onclick: () => v.zavri() }, 'Rozumím')));
    const v = otevriVrstvu({ titulek: '📲 Přidat Deník na plochu', telo, pata, sirka: '480px' });
    S.nastaveni.infoPlocha = true; uloz();
  }
  // jednorázová nabídka v deníku: na telefonu, po pár dnech používání
  function nabidkaPlochy(kont) {
    if (S.nastaveni.infoPlocha || jeNaPlose() || !zarizeni().dotyk) return;
    if (Object.values(S.dny).filter(d => d.z.length).length < 3) return;
    const box = h('div', { class: 'upozorneni info' }, '📲 Přidej si Deník na plochu – otevřeš ho jedním klepnutím jako aplikaci, i bez internetu. ',
      h('button', { class: 'btn mini', type: 'button', onclick: () => { box.remove(); pridatNaPlochu(); } }, 'Přidat na plochu'), ' ',
      h('button', { class: 'btn mini plain', type: 'button', onclick: () => { S.nastaveni.infoPlocha = true; uloz(); box.remove(); } }, 'Ne, díky'));
    kont.appendChild(box);
  }

  /* ================= navázání událostí ================= */
  function nastav() {
    document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => prepni(t.dataset.v)));
    $('.tabs').addEventListener('keydown', e => {
      if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return;
      const t = [...document.querySelectorAll('.tab')];
      const i = t.indexOf(document.activeElement);
      if (i < 0) return;
      e.preventDefault();
      const n = e.key === 'Home' ? t[0] : e.key === 'End' ? t[t.length - 1] : t[(i + (e.key === 'ArrowRight' ? 1 : t.length - 1)) % t.length];
      n.focus(); prepni(n.dataset.v);
    });
    $('#denPred').addEventListener('click', () => { aktivniDen = J.posunDen(aktivniDen, -1); vykresliDenik(); });
    $('#denDalsi').addEventListener('click', () => { aktivniDen = J.posunDen(aktivniDen, 1); vykresliDenik(); });
    $('#denDnes').addEventListener('click', () => { aktivniDen = J.datumKlic(new Date()); vykresliDenik(); });
    $('#denMenu').addEventListener('click', e => nabidkaDne(e.currentTarget));
    $('#pismoTl').addEventListener('click', e => nabidkaPisma(e.currentTarget));
    $('#profilTl').addEventListener('click', e => nabidkaProfilu(e.currentTarget));
    addEventListener('hashchange', () => { if (location.hash === '#spravce') { prepni('data'); vykresliSpravce(); $('#sekceSpravce').open = true; } });
    $('#poslatZalohu').addEventListener('click', posliZalohu);
    $('#qrOdeslat').addEventListener('click', qrOdeslat);
    $('#qrPrijmout').addEventListener('click', qrPrijmout);
    $('#nSpravce').addEventListener('change', e => { if (e.target.checked) S.nastaveni.spravce = true; else delete S.nastaveni.spravce; uloz(); vykresliSpravce(); });
    $('#exportDoplnku').addEventListener('click', () => exportDoplnkuDialog(null));
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
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || !listaVraceni || vrstvy.length) return;   // s otevřenou vrstvou je lišta skrytá
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
    $('#zpravaTl').addEventListener('click', () => { const doK = J.datumKlic(new Date()); zpravaProTerapeuta(J.posunDen(doK, -(obdobi - 1)), doK); });
    addEventListener('keydown', e => { if (e.key === 'Escape' && document.body.classList.contains('zprava-otevrena') && !vrstvy.length) zavriZpravu(); });
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
    // přidání na plochu / instalace (PWA): systémová nabídka, kde ji prohlížeč má, jinak návod pro dané zařízení
    addEventListener('beforeinstallprompt', e => { e.preventDefault(); instalacePrompt = e; });
    addEventListener('appinstalled', () => { instalacePrompt = null; S.nastaveni.infoPlocha = true; uloz(); ukazTlacitkaPlochy(); D.info('Deník je na ploše. Otevírej ho ikonou 🥗 Deník jídla.'); });
    $('#instalovat').addEventListener('click', pridatNaPlochu);
    $('#plochaTl').addEventListener('click', pridatNaPlochu);
    ukazTlacitkaPlochy();
    $('#exportCsv').addEventListener('click', () => {
      if (!Object.keys(S.dny).length) { D.info('Deník je zatím prázdný.'); return; }
      stahniSoubor('denik-jidla-' + priponaProfilu() + J.datumKlic(new Date()) + '.csv', J.exportCsv(S), 'text/csv;charset=utf-8');
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
    // výška horní lišty – datum deníku se přilepí těsně pod ni
    const hl = $('.hlava');
    if (hl && window.ResizeObserver) new ResizeObserver(() => document.documentElement.style.setProperty('--hlava-v', hl.offsetHeight + 'px')).observe(hl);
    vykresliProfily();
    pouzijPismo();
    pouzijEnergii();
    nastav();
    let v = 'denik';
    try { v = sessionStorage.getItem(KLIC + '_pohled') || 'denik'; } catch (_) { /* nic */ }
    const hash = location.hash.slice(1);
    if (['denik', 'potraviny', 'statistiky', 'profil', 'data'].includes(hash)) v = hash;
    if (hash === 'plocha') setTimeout(() => { history.replaceState(null, '', location.pathname); pridatNaPlochu(); }, 300);
    if (hash === 'spravce') { v = 'data'; setTimeout(() => { const s = $('#sekceSpravce'); if (s) s.open = true; }, 0); }
    obnovIndexUzivatele();
    if (porovnani.length) vykresliTlacitkoPorovnani();   // porovnání obnovené ze sessionStorage
    // databáze se stahuje hned – i kdyby vykreslení selhalo, nečeká se na ni zbytečně
    const db = nactiDatabazi();
    try {
      prepni(v);
    } catch (e) {
      console.error(e);
      const ukaz = () => {
        const el = $('#dataStav');
        el.textContent = 'Aplikace narazila na chybu (' + e.message + '). ';
        el.appendChild(h('button', { class: 'btn mini', type: 'button', onclick: () => (window.obnovDenik || (() => location.reload()))() }, '↻ Obnovit aplikaci'));
      };
      ukaz();
      db.then(ukaz);   // hlášku o načtené databázi nepřepsat – aplikace stejně nefunguje
      window.DENIK.spusteno = false;
      return;
    }
    window.DENIK.spusteno = true;
    db.then(() => {
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
    spusteno: false, verze: VERZE_KODU,
    _doplnky(d) { nactiDoplnky(d); vykresliPohled(); },   // test: podvržený soubor doplňků
    get stav() { return S; }, DB, prepni, otevriPridani, detailPotraviny, zpracujKod, editorPotraviny, editorReceptu,
    vykresliVse, get aktivniDen() { return aktivniDen; }, set aktivniDen(k) { aktivniDen = k; vykresliDenik(); }, uloz,
    // test: simulace půlnoci – stránka „si myslí“, že je včera, a sleduje včerejšek
    _testPulnoc() { znamyDnes = J.posunDen(J.datumKlic(new Date()), -1); aktivniDen = znamyDnes; vykresliDenik(); zkontrolujDen(); },
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();

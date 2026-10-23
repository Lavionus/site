/* ============================================================
   Písmolijna – ui/stav.js
   Stav aplikace (window.PSLAPP): otevřený font, aktuální glyf,
   výběr v mřížce, události, historie zpět/znovu a automatické
   ukládání projektů do IndexedDB `webapp_pismolijna`.
   ============================================================ */
(function () {
  'use strict';
  const P = window.PSL;
  const A = window.PSLAPP = {
    font: null,
    projektId: null,
    pohled: 'znaky',
    aktualni: null,          // název glyfu v editoru
    vyber: new Set(),        // vybrané glyfy v mřížce
    schranka: null,          // {druh:'obrysy'|'glyfy', data}
    nastaveni: {}
  };

  /* ---------- události ---------- */
  const posluchaci = {};
  A.na = function (udalost, fn) { (posluchaci[udalost] = posluchaci[udalost] || []).push(fn); };
  A.vyhlas = function (udalost, data) {
    for (const fn of posluchaci[udalost] || []) {
      try { fn(data); } catch (e) { console.error(udalost, e); }
    }
  };

  /* ---------- nastavení (localStorage, chráněno try/catch) ---------- */
  const KLIC_NAST = 'webapp_pismolijna_nastaveni';
  try { A.nastaveni = JSON.parse(localStorage.getItem(KLIC_NAST) || '{}') || {}; } catch (e) { A.nastaveni = {}; }
  A.uložNastaveni = A.ulozNastaveni = function () {
    try { localStorage.setItem(KLIC_NAST, JSON.stringify(A.nastaveni)); } catch (e) { /* plné nebo zakázané úložiště */ }
  };

  /* ---------- zprávy ---------- */
  let zpravaCas = 0;
  A.zprava = function (text, chyba) {
    const el = document.getElementById('zprava');
    el.textContent = text; el.hidden = false;
    el.classList.toggle('chyba', !!chyba);
    clearTimeout(zpravaCas);
    zpravaCas = setTimeout(() => { el.hidden = true; }, chyba ? 6000 : 2800);
  };

  /* ---------- historie ----------
     Záznam = {popis, klic, cas, pred, po}; pred/po jsou snímky jen té části
     fontu, které se změna týká (glyfy podle jména, kerning, info…). */
  const zasobnik = [], vpred = [];
  const LIMIT = 300;
  const CASTI = ['kerning', 'skupiny', 'ligatury', 'info', 'vodidla'];

  function snimek(rozsah, jmena) {
    const f = A.font, s = { poradi: f.poradi.slice(), glyfy: {} };
    for (const n of jmena) s.glyfy[n] = f.glyfy[n] ? P.klonuj(f.glyfy[n]) : null;
    for (const c of CASTI) if (rozsah[c] || rozsah.cely) s[c] = P.klonuj(f[c]);
    return s;
  }
  function obnov(s) {
    const f = A.font;
    for (const n in s.glyfy) {
      if (s.glyfy[n]) f.glyfy[n] = P.klonuj(s.glyfy[n]); else delete f.glyfy[n];
    }
    f.poradi = s.poradi.slice();
    for (const c of CASTI) if (s[c] !== undefined) f[c] = P.klonuj(s[c]);
  }

  /* Provede změnu fn() a zapíše ji do historie.
     rozsah: {glyfy: [jména] | '*', kerning, skupiny, ligatury, info, vodidla, cely}
     klic: změny se stejným klíčem do 1,5 s se slučují (posouvání šipkami, tažení). */
  A.zmen = function (popis, rozsah, fn, klic) {
    const f = A.font;
    if (!f) return;
    const vse = rozsah.glyfy === '*' || rozsah.cely;
    let jmena = vse ? f.poradi.slice() : (rozsah.glyfy || []).slice();
    const pred = snimek(rozsah, jmena);
    let vysledek;
    try { vysledek = fn(); }
    catch (e) { obnov(pred); console.error(e); A.zprava('Chyba: ' + e.message, true); A.vyhlas('zmena', { glyfy: jmena, vse: true }); return; }
    // nově vzniklé a zaniklé glyfy
    const predSet = new Set(pred.poradi), poSet = new Set(f.poradi);
    for (const n of f.poradi) if (!predSet.has(n) && !(n in pred.glyfy)) { pred.glyfy[n] = null; jmena.push(n); }
    for (const n of pred.poradi) if (!poSet.has(n) && !(n in pred.glyfy)) console.warn('Smazaný glyf mimo rozsah historie:', n);
    const po = snimek(rozsah, jmena);
    const ted = Date.now(), vrch = zasobnik[zasobnik.length - 1];
    if (klic && vrch && vrch.klic === klic && ted - vrch.cas < 1500) { vrch.po = po; vrch.cas = ted; }
    else {
      zasobnik.push({ popis, klic, cas: ted, pred, po });
      if (zasobnik.length > LIMIT) zasobnik.shift();
    }
    vpred.length = 0;
    A.oznacZmenu({ glyfy: jmena, vse: vse || !!rozsah.cely, rozsah });
    return vysledek;
  };

  A.zpet = function () {
    const z = zasobnik.pop();
    if (!z) { A.zprava('Není co vracet.'); return; }
    obnov(z.pred); vpred.push(z);
    A.oznacZmenu({ glyfy: Object.keys(z.pred.glyfy), vse: true });
    A.zprava('Zpět: ' + z.popis);
  };
  A.znovu = function () {
    const z = vpred.pop();
    if (!z) { A.zprava('Není co opakovat.'); return; }
    obnov(z.po); zasobnik.push(z);
    A.oznacZmenu({ glyfy: Object.keys(z.po.glyfy), vse: true });
    A.zprava('Znovu: ' + z.popis);
  };
  A.lzeZpet = () => zasobnik.length > 0;
  A.lzeZnovu = () => vpred.length > 0;
  A.vymazHistorii = function () { zasobnik.length = 0; vpred.length = 0; };

  /* Po každé změně: překreslit a naplánovat uložení. */
  A.oznacZmenu = function (co) {
    if (A.aktualni && !A.font.glyfy[A.aktualni]) A.aktualni = null;
    for (const n of Array.from(A.vyber)) if (!A.font.glyfy[n]) A.vyber.delete(n);
    A.vyhlas('zmena', co || { vse: true });
    naplanujUlozeni();
  };

  /* ---------- otevření fontu ---------- */
  A.otevriFont = function (font, projektId) {
    A.font = P.normalizuj(font);
    A.projektId = projektId || ('p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
    A.aktualni = null; A.vyber.clear();
    A.vymazHistorii();
    try { localStorage.setItem('webapp_pismolijna_posledni', A.projektId); } catch (e) { /* nevadí */ }
    A.vyhlas('font');
    A.vyhlas('zmena', { vse: true });
    naplanujUlozeni(true);
  };

  /* ---------- IndexedDB ---------- */
  const DB = 'webapp_pismolijna';
  let dbSlib = null;
  function db() {
    if (dbSlib) return dbSlib;
    dbSlib = new Promise((ok, chyba) => {
      let r;
      try { r = indexedDB.open(DB, 1); } catch (e) { chyba(e); return; }
      r.onupgradeneeded = () => { r.result.createObjectStore('projekty', { keyPath: 'id' }); };
      r.onsuccess = () => ok(r.result);
      r.onerror = () => chyba(r.error);
    });
    return dbSlib;
  }
  function tx(mod, fn) {
    return db().then(d => new Promise((ok, chyba) => {
      const t = d.transaction('projekty', mod), st = t.objectStore('projekty');
      const r = fn(st);
      t.oncomplete = () => ok(r && r.result);
      t.onerror = () => chyba(t.error);
      t.onabort = () => chyba(t.error);
    }));
  }
  A.projekty = function () {
    return tx('readonly', st => st.getAll()).then(seznam => (seznam || []).map(p => ({
      id: p.id, nazev: p.nazev, zmeneno: p.zmeneno, glyfu: p.glyfu
    })).sort((a, b) => b.zmeneno - a.zmeneno)).catch(() => []);
  };
  A.nactiProjekt = function (id) { return tx('readonly', st => st.get(id)).then(p => p && p.font); };
  A.smazProjekt = function (id) { return tx('readwrite', st => st.delete(id)); };

  let casUlozeni = 0, ukladam = false, znovuUlozit = false;
  function naplanujUlozeni(hned) {
    const el = document.getElementById('ulozeno');
    if (el) el.textContent = 'neuloženo…';
    clearTimeout(casUlozeni);
    casUlozeni = setTimeout(ulozHned, hned ? 50 : 1200);
  }
  function ulozHned() {
    if (!A.font) return;
    if (ukladam) { znovuUlozit = true; return; }
    ukladam = true;
    const f = A.font;
    const zaznam = {
      id: A.projektId, nazev: f.info.rodina + ' ' + f.info.styl, zmeneno: Date.now(),
      glyfu: f.poradi.filter(n => !P.glyfJePrazdny(f.glyfy[n])).length, font: f
    };
    tx('readwrite', st => st.put(zaznam)).then(() => {
      const el = document.getElementById('ulozeno');
      if (el) el.textContent = 'uloženo v prohlížeči';
    }).catch(e => {
      const el = document.getElementById('ulozeno');
      if (el) el.textContent = 'neuloženo!';
      console.warn('Ukládání selhalo', e);
    }).finally(() => {
      ukladam = false;
      if (znovuUlozit) { znovuUlozit = false; naplanujUlozeni(); }
    });
  }
  A.ulozHned = ulozHned;
  window.addEventListener('beforeunload', () => { if (A.font) ulozHned(); });
  window.addEventListener('pagehide', () => { if (A.font) ulozHned(); });

  /* ---------- pomocníci ---------- */
  A.stahni = function (data, nazev, typ) {
    const blob = data instanceof Blob ? data : new Blob([data], { type: typ || 'application/octet-stream' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = nazev;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };
  A.nazevSouboru = function () {
    const i = A.font.info;
    return ((i.rodina || 'pismo') + '-' + (i.styl || 'Regular')).replace(/[^A-Za-z0-9_-]+/g, '');
  };
  A.el = function (tag, vlastnosti, deti) {
    const e = document.createElement(tag);
    if (vlastnosti) for (const k in vlastnosti) {
      const v = vlastnosti[k];
      if (k === 'text') e.textContent = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (k === 'class') e.className = v;
      else if (v === true) e.setAttribute(k, '');
      else if (v !== false && v != null) e.setAttribute(k, v);
    }
    for (const d of [].concat(deti || [])) if (d != null) e.append(d.nodeType ? d : String(d));
    return e;
  };
  /* Barvy z CSS proměnných (mění se s tématem). */
  A.barvy = function () {
    const cs = getComputedStyle(document.documentElement);
    const v = n => cs.getPropertyValue(n).trim();
    const svetle = document.documentElement.getAttribute('data-theme') === 'light';
    return {
      svetle,
      pozadi: v('--bg-deep'), panel: v('--bg-panel'), text: v('--text'), slaby: v('--text-faint'), muted: v('--text-muted'),
      okraj: v('--border'), akcent: v('--accent'), nebezpeci: v('--danger'), ok: v('--ok'), varovani: v('--warn'),
      vypln: svetle ? 'rgba(30,40,60,.13)' : 'rgba(220,230,255,.14)',
      plna: svetle ? '#1c232d' : '#e4e8f0',
      obrys: svetle ? '#1c232d' : '#e9edf5',
      metrika: svetle ? 'rgba(40,98,187,.55)' : 'rgba(106,166,253,.5)',
      komponenta: svetle ? 'rgba(150,80,20,.85)' : 'rgba(240,170,90,.9)',
      kotva: svetle ? '#b5352a' : '#f07575'
    };
  };
})();

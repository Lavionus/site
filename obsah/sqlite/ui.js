/* ============================================================
   SQLite prohlížeč – uživatelské rozhraní.
   S databází mluví jen zprávami přes Web Worker (sqlite/worker.js).
   ============================================================ */
(function () {
  'use strict';
  const J = window.SqlJadro;
  const $ = id => document.getElementById(id);
  const LS = 'webapp_sqlite_';
  const MB = 1024 * 1024;
  function lsGet(k, d) { try { const v = localStorage.getItem(LS + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) { /* plné nebo zakázané úložiště */ } }

  /** Vytvoří prvek: el('button', {class:'x', text:'..', onclick}, děti…) */
  function el(tag, a, ...deti) {
    const e = document.createElement(tag);
    for (const k in (a || {})) {
      const v = a[k];
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (k === 'dataset') Object.assign(e.dataset, v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const d of deti.flat()) if (d !== null && d !== undefined && d !== false) e.append(d.nodeType ? d : String(d));
    return e;
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const fc = (n, d) => J.formatCislo(n, d);
  function stahni(blob, nazev) {
    const a = el('a', { href: URL.createObjectURL(blob), download: nazev });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);
  }
  function zakladJmena(n) { const m = /^(.*?)(\.[^.]+)?$/.exec(n || 'databaze'); return { zaklad: m[1] || 'databaze', pripona: m[2] || '.sqlite' }; }

  // ======================= Worker =======================
  let worker = null, pripraven = null, dalsiId = 1, zdroj = null;
  const cekajici = new Map();
  let busyCasovac = null, busyStart = 0, busyTyp = '';
  function startWorker() {
    try { worker = new Worker('sqlite/worker.js'); } catch (e) {
      $('stavNacteni').textContent = 'Web Worker nelze spustit (' + e.message + '). Otevřete stránku přes http(s), ne jako soubor.';
      return;
    }
    pripraven = new Promise((res, rej) => cekajici.set(0, { res, rej, typ: 'start' }));
    worker.onmessage = e => {
      const m = e.data, c = cekajici.get(m.id);
      if (!c) return;
      cekajici.delete(m.id);
      if (m.ok) c.res(m.vysledek); else c.rej(new Error(m.chyba));
      aktualizujBusy();
    };
    worker.onerror = e => {
      if (e.preventDefault) e.preventDefault();
      const chyba = new Error('Chyba workeru: ' + (e.message || 'skript se nenačetl (otevřete stránku přes http/https)'));
      for (const c of cekajici.values()) c.rej(chyba);
      cekajici.clear(); aktualizujBusy();
    };
    pripraven.then(() => { $('stavNacteni').textContent = 'SQLite připraveno. Soubor zůstává jen ve vašem počítači.'; },
      e => { $('stavNacteni').textContent = e.message; });
  }
  async function volej(typ, data, prenos) {
    await pripraven;
    const id = dalsiId++;
    return new Promise((res, rej) => {
      cekajici.set(id, { res, rej, typ });
      worker.postMessage({ id, typ, data }, prenos || []);
      aktualizujBusy();
    });
  }
  const POPIS = { otevri: 'Otevírám databázi', dotaz: 'Provádím SQL', prohlizej: 'Načítám data', velikosti: 'Počítám velikosti', exportDb: 'Exportuji databázi',
    exportTabulky: 'Exportuji tabulku', dumpSql: 'Vytvářím SQL výpis', kontrola: 'Kontroluji databázi', pocty: 'Počítám řádky', statistikaSloupcu: 'Počítám statistiku sloupců', demo: 'Vytvářím ukázku' };
  function aktualizujBusy() {
    const aktivni = [...cekajici.entries()].filter(([id]) => id !== 0);
    if (!aktivni.length) { clearInterval(busyCasovac); busyCasovac = null; $('zaneprazdneno').hidden = true; return; }
    busyTyp = aktivni[aktivni.length - 1][1].typ;
    if (!busyCasovac) {
      busyStart = performance.now();
      busyCasovac = setInterval(() => {
        const t = performance.now() - busyStart;
        if (t < 400) return;
        $('zaneprazdneno').hidden = false;
        $('zanText').textContent = (POPIS[busyTyp] || 'Pracuji') + '… ' + J.formatCas(t);
      }, 100);
    }
  }
  $('bPrerusit').addEventListener('click', async () => {
    if (!(await Dialog.potvrd('Přerušit probíhající operaci? Databázový worker se ukončí a databáze se znovu načte z původního zdroje – všechny neexportované změny v paměti se ztratí.', { ok: 'Přerušit' }))) return;
    worker.terminate();
    for (const [id, c] of cekajici) if (id !== 0) c.rej(new Error('Operace přerušena.'));
    cekajici.clear(); aktualizujBusy();
    startWorker();
    try {
      if (zdroj && zdroj.typ === 'soubor') { const buf = await zdroj.file.arrayBuffer(); poOtevreni(await volej('otevri', { data: buf, nazev: zdroj.file.name }, [buf])); }
      else if (zdroj && zdroj.typ === 'demo') poOtevreni(await volej('demo'));
      else if (zdroj) poOtevreni(await volej('nova'));
      Dialog.info('Databáze znovu načtena z původního zdroje.');
    } catch (e) { Dialog.chyba(e.message); }
  });

  // ======================= Stav aplikace =======================
  const S = { schema: null, pocty: {}, vybrany: null, zalozka: 'data', stav: null, info: null, sqlVysledek: null, dataZastarala: false, erPlatne: false, statPlatne: false };
  const nast = Object.assign({ bezpecnyRezim: true, ciziKlice: true, jenCteni: false, maxRadku: 50000, stranka: 100, csv: 'std' }, lsGet('nastaveni', {}));
  function ulozNastaveni() { lsSet('nastaveni', nast); }
  function csvMoznosti() { return nast.csv === 'excel' ? { oddelovac: ';', bom: true, desetinnaCarka: true, ochranaVzorcu: true } : {}; }

  // ======================= Otevření =======================
  async function maNeulozene() {
    if (!S.stav || !S.stav.otevrena) return false;
    if (!(S.stav.transakce || S.stav.upraveno)) return false;
    return !(await Dialog.potvrd('Aktuální databáze má neexportované změny. Po otevření jiné se ztratí. Pokračovat?', { ok: 'Zahodit a otevřít' }));
  }
  async function otevriSoubor(file) {
    if (!file) return;
    if (file.size > 1536 * MB) { Dialog.chyba('Soubor má ' + J.formatBajty(file.size) + '. Prohlížeč (WebAssembly, max. 2 GB paměti) tak velkou databázi neudrží – použijte desktopový nástroj (sqlite3, DB Browser for SQLite).'); return; }
    if (file.size > 300 * MB && !(await Dialog.potvrd('Soubor má ' + J.formatBajty(file.size) + '. Celá databáze se načte do paměti prohlížeče; na slabších zařízeních může karta spadnout. Pokračovat?', { ok: 'Načíst' }))) return;
    if (await maNeulozene()) return;
    try {
      $('stavNacteni').textContent = 'Čtu soubor…';
      const buf = await file.arrayBuffer();
      let otisk = null;
      try { if (crypto.subtle) otisk = [...new Uint8Array(await crypto.subtle.digest('SHA-256', buf))].map(b => b.toString(16).padStart(2, '0')).join(''); } catch (e) { /* nezabezpečený kontext */ }
      const info = await volej('otevri', { data: buf, nazev: file.name }, [buf]);
      zdroj = { typ: 'soubor', file, otisk };
      poOtevreni(info);
    } catch (e) { Dialog.chyba('Soubor nelze otevřít: ' + e.message); $('stavNacteni').textContent = e.message; }
  }
  async function otevriDemo() {
    if (await maNeulozene()) return;
    try { const i = await volej('demo'); zdroj = { typ: 'demo' }; poOtevreni(i); } catch (e) { Dialog.chyba(e.message); }
  }
  async function otevriNovou() {
    if (await maNeulozene()) return;
    try { const i = await volej('nova'); zdroj = { typ: 'nova' }; poOtevreni(i); if (S.zalozka !== 'sql') prepniZalozku('sql'); } catch (e) { Dialog.chyba(e.message); }
  }
  async function poOtevreni(info) {
    S.info = info; S.schema = info.schema; S.pocty = {}; S.vybrany = null; S.sqlVysledek = null; S.erPlatne = false; S.statPlatne = false;
    S.erPozice = lsGet('er_' + info.nazev, null);
    $('uvod').hidden = true; $('aplikace').hidden = false;
    $('nazevDb').textContent = info.nazev;
    $('velikostDb').textContent = info.zdroj === 'soubor' ? J.formatBajty(info.velikost) : '(' + info.zdroj + ', jen v paměti)';
    for (const u of info.upozorneni || []) Dialog.info('⚠️ ' + u);
    $('zpravy').innerHTML = ''; $('vysledekObal').hidden = true;
    await volej('nastav', { bezpecnyRezim: nast.bezpecnyRezim, ciziKlice: nast.ciziKlice, jenCteni: nast.jenCteni, maxRadku: nast.maxRadku }).then(aktualizujStav);
    vykresliObjekty();
    const prvni = S.schema.tabulky.find(t => t.typ === 'table' && !t.systemova) || S.schema.tabulky[0];
    if (prvni) vyberObjekt(prvni.nazev, prvni.typ, true);
    else { $('dataNadpis').textContent = 'Databáze je prázdná – vytvořte tabulku v záložce SQL'; $('dataMrizka').innerHTML = ''; }
    obnovZalozku();
    nactiPocty();
  }
  async function nactiPocty() {
    try { S.pocty = await volej('pocty'); vykresliObjekty(); } catch (e) { /* nevadí */ }
  }
  async function obnovSchema() {
    S.schema = await volej('schema');
    S.erPlatne = false; S.statPlatne = false;
    if (S.vybrany && !S.schema.objekty.some(o => o.nazev === S.vybrany.nazev)) S.vybrany = null;
    vykresliObjekty();
    nactiPocty();
  }

  $('bOtevrit').addEventListener('click', () => $('soubor').click());
  $('bJiny').addEventListener('click', () => $('soubor').click());
  $('soubor').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; otevriSoubor(f); });
  $('bDemo').addEventListener('click', otevriDemo);
  $('bNova').addEventListener('click', otevriNovou);
  const zona = $('zona');
  ['dragenter', 'dragover'].forEach(t => document.addEventListener(t, e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { e.preventDefault(); zona.classList.add('nad'); } }));
  ['dragleave', 'drop'].forEach(t => document.addEventListener(t, e => { if (t === 'dragleave' && e.relatedTarget) return; zona.classList.remove('nad'); }));
  document.addEventListener('drop', e => {
    if (!e.dataTransfer || !e.dataTransfer.files.length) return;
    e.preventDefault();
    otevriSoubor(e.dataTransfer.files[0]);
  });
  window.addEventListener('beforeunload', e => { if (S.stav && (S.stav.transakce || S.stav.upraveno)) { e.preventDefault(); e.returnValue = ''; } });

  // ======================= Stav transakce =======================
  function aktualizujStav(st) {
    if (!st || !st.otevrena) return;
    S.stav = st;
    const tx = st.transakce;
    $('txPanel').hidden = !tx;
    if (tx) {
      let t = st.autoTx ? 'Neuložená transakce: ' + (st.zmenVTx == null ? '?' : fc(st.zmenVTx)) + ' změněných řádků' + (st.schemaZmeneno ? ' + změna schématu' : '') : 'Otevřená transakce (vaše BEGIN)';
      $('txText').textContent = t;
      $('bZpet').disabled = !st.upravy.length;
      $('bZpet').title = st.upravy.length ? 'Vrátit: ' + st.upravy[st.upravy.length - 1] : 'Žádná úprava z tabulky k vrácení';
    }
    const s = $('stavDb');
    if (tx) { s.textContent = 'neuloženo v transakci'; s.className = 'stitek warn'; }
    else if (st.upraveno) { s.textContent = 'změněno v paměti – exportujte'; s.className = 'stitek warn'; }
    else { s.textContent = 'beze změn'; s.className = 'stitek ok'; }
    if (st.nastaveni && st.nastaveni.jenCteni) { s.textContent += ' · jen pro čtení'; }
  }
  $('bCommit').addEventListener('click', async () => {
    try {
      aktualizujStav(await volej('commit'));
      Dialog.info('Potvrzeno v databázi v paměti. Do souboru se změny dostanou až exportem (💾).');
      await obnovSchema(); obnovData();
    } catch (e) { Dialog.chyba(e.message); }
  });
  $('bRollback').addEventListener('click', async () => {
    if (!(await Dialog.potvrd('Vrátit všechny změny v otevřené transakci (ROLLBACK)?', { ok: 'Vrátit vše' }))) return;
    try { aktualizujStav(await volej('rollback')); Dialog.info('Změny vráceny.'); await obnovSchema(); obnovData(); }
    catch (e) { Dialog.chyba(e.message); }
  });
  $('bZpet').addEventListener('click', async () => {
    try { const r = await volej('zpet'); aktualizujStav(r.stav); Dialog.info('Vráceno: ' + r.vraceno); obnovData(); }
    catch (e) { Dialog.chyba(e.message); }
  });

  // ======================= Export =======================
  async function zajistiBezTransakce(ucel) {
    if (!S.stav || !S.stav.transakce) return true;
    const ano = await Dialog.potvrd('Je otevřená transakce s neuloženými změnami. ' + ucel + ' vyžaduje její ukončení. Potvrdit ji (COMMIT)?', { ok: 'Potvrdit a pokračovat', zrus: 'Zrušit' });
    if (!ano) return false;
    aktualizujStav(await volej('commit'));
    return true;
  }
  $('bExportDb').addEventListener('click', async () => {
    $('menuExport').open = false;
    try {
      if (!(await zajistiBezTransakce('Export'))) return;
      const r = await volej('exportDb');
      const { zaklad, pripona } = zakladJmena(S.info.nazev);
      const jm = zaklad + (S.info.zdroj === 'soubor' ? '-upraveno' : '') + pripona;
      stahni(new Blob([r.data], { type: 'application/vnd.sqlite3' }), jm);
      Dialog.info('Uloženo jako nový soubor „' + jm + '" (' + J.formatBajty(r.data.length) + '). Původní soubor zůstává beze změny.');
      aktualizujStav(await volej('stav'));
    } catch (e) { Dialog.chyba(e.message); }
  });
  $('bExportSql').addEventListener('click', async () => {
    $('menuExport').open = false;
    try { const r = await volej('dumpSql'); stahni(r.blob, zakladJmena(S.info.nazev).zaklad + '.sql'); }
    catch (e) { Dialog.chyba(e.message); }
  });
  $('bExportSchema').addEventListener('click', () => {
    $('menuExport').open = false;
    const txt = S.schema.objekty.filter(o => o.sql).map(o => o.sql + ';').join('\n\n') + '\n';
    stahni(new Blob([txt], { type: 'application/sql;charset=utf-8' }), zakladJmena(S.info.nazev).zaklad + '-schema.sql');
  });
  document.addEventListener('click', e => { const m = $('menuExport'); if (m.open && !m.contains(e.target)) m.open = false; });

  // ======================= Nastavení =======================
  $('bNastaveni').addEventListener('click', () => { const n = $('nastaveni'); n.hidden = !n.hidden; $('bNastaveni').setAttribute('aria-expanded', String(!n.hidden)); });
  $('nBezpecny').checked = nast.bezpecnyRezim; $('nCizi').checked = nast.ciziKlice; $('nJenCteni').checked = nast.jenCteni;
  $('nMaxRadku').value = String(nast.maxRadku); $('nStranka').value = String(nast.stranka); $('nCsv').value = nast.csv;
  async function zmenaNastaveni() {
    nast.bezpecnyRezim = $('nBezpecny').checked; nast.ciziKlice = $('nCizi').checked; nast.jenCteni = $('nJenCteni').checked;
    nast.maxRadku = Number($('nMaxRadku').value); nast.stranka = Number($('nStranka').value); nast.csv = $('nCsv').value;
    ulozNastaveni();
    if (S.stav && S.stav.transakce && $('nCizi').checked !== S.stav.nastaveni.ciziKlice) Dialog.info('Změna vynucování cizích klíčů se projeví až po ukončení transakce.');
    try { if (S.info) { aktualizujStav(await volej('nastav', { bezpecnyRezim: nast.bezpecnyRezim, ciziKlice: nast.ciziKlice, jenCteni: nast.jenCteni, maxRadku: nast.maxRadku })); obnovData(); } }
    catch (e) { Dialog.chyba(e.message); }
  }
  ['nBezpecny', 'nCizi', 'nJenCteni', 'nMaxRadku', 'nStranka', 'nCsv'].forEach(id => $(id).addEventListener('change', zmenaNastaveni));

  // ======================= Seznam objektů =======================
  function vykresliObjekty() {
    const h = $('hledatObjekt').value.trim().toLowerCase();
    const kont = $('seznamObjektu'); kont.innerHTML = '';
    const ob = S.schema.objekty.filter(o => !h || o.nazev.toLowerCase().includes(h) || (o.tabulka || '').toLowerCase().includes(h));
    const skupiny = [
      ['Tabulky', o => o.typ === 'table' && !/^sqlite_/i.test(o.nazev), '▦'],
      ['Pohledy', o => o.typ === 'view', '👁'],
      ['Indexy', o => o.typ === 'index', '⚡'],
      ['Triggery', o => o.typ === 'trigger', '⚙'],
      ['Systémové', o => o.typ === 'table' && /^sqlite_/i.test(o.nazev), '⛭']
    ];
    for (const [nazev, f, ikona] of skupiny) {
      const pol = ob.filter(f);
      if (!pol.length) continue;
      const otevreno = lsGet('sk_' + nazev, nazev !== 'Indexy' && nazev !== 'Systémové' && nazev !== 'Triggery');
      const d = el('details', { open: otevreno || !!h }, el('summary', { text: nazev + ' (' + pol.length + ')' }));
      d.addEventListener('toggle', () => { if (!h) lsSet('sk_' + nazev, d.open); });
      const ul = el('ul');
      for (const o of pol) {
        const t = S.schema.tabulky.find(x => x.nazev === o.nazev);
        let poc = '';
        if (o.typ === 'table' && S.pocty[o.nazev] != null) poc = fc(S.pocty[o.nazev]);
        else if (o.typ === 'index' || o.typ === 'trigger') poc = o.tabulka;
        const aktivni = S.vybrany && S.vybrany.nazev === o.nazev;
        ul.append(el('li', null, el('button', {
          type: 'button', class: aktivni ? 'aktivni' : '', title: o.nazev + (t && t.bezRowid ? ' (WITHOUT ROWID)' : '') + (t && t.strict ? ' (STRICT)' : '') + (t && t.virtualni ? ' (virtuální)' : ''),
          onclick: () => vyberObjekt(o.nazev, o.typ)
        }, el('span', { class: 'jm', text: ikona + ' ' + o.nazev }), el('span', { class: 'poc', text: poc }))));
      }
      d.append(ul); kont.append(d);
    }
    if (!kont.children.length) kont.append(el('p', { class: 'napoveda', text: h ? 'Nic nenalezeno.' : 'Databáze neobsahuje žádné objekty.' }));
  }
  $('hledatObjekt').addEventListener('input', vykresliObjekty);

  function vyberObjekt(nazev, typ, tiche) {
    S.vybrany = { nazev, typ };
    vykresliObjekty();
    if (typ === 'table' || typ === 'view') {
      zobrazTabulku(nazev);
      if (!tiche && S.zalozka !== 'data' && S.zalozka !== 'struktura') prepniZalozku('data');
    } else if (!tiche && S.zalozka !== 'struktura') prepniZalozku('struktura');
    if (S.zalozka === 'struktura') vykresliStrukturu();
  }

  // ======================= Záložky =======================
  document.querySelectorAll('.zalozky button').forEach(b => b.addEventListener('click', () => prepniZalozku(b.dataset.z)));
  function prepniZalozku(z) {
    S.zalozka = z;
    document.querySelectorAll('.zalozky button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.z === z)));
    for (const id of ['data', 'sql', 'struktura', 'er', 'stat']) $('z-' + id).hidden = id !== z;
    obnovZalozku();
  }
  function obnovZalozku() {
    if (!S.schema) return;
    if (S.zalozka === 'data' && S.dataZastarala) obnovData();
    if (S.zalozka === 'struktura') vykresliStrukturu();
    if (S.zalozka === 'er' && !S.erPlatne) vykresliEr(false);
    if (S.zalozka === 'stat' && !S.statPlatne) vykresliStatistiky();
    if (S.zalozka === 'sql') { zvyrazni(); }
  }

  // ======================= Mřížka (tabulka dat) =======================
  function vykresliHodnotu(td, v) {
    td.className = '';
    td.textContent = '';
    if (v === null || v === undefined) { td.classList.add('null'); td.textContent = 'NULL'; return; }
    if (typeof v === 'number' || typeof v === 'bigint') { td.classList.add('cislo'); td.textContent = String(v).replace('.', ','); return; }
    if (typeof v === 'object' && v.t === 'blob') {
      const typ = v.obr ? '🖼 ' + v.obr.split('/')[1].toUpperCase() : 'BLOB';
      td.append(el('span', { class: 'blob', title: 'BLOB ' + fc(v.n) + ' B, začátek: ' + v.hex + (v.n > 48 ? '…' : '') }, typ + ' · ' + J.formatBajty(v.n)));
      return;
    }
    if (typeof v === 'object' && v.t === 'dlouhy') {
      td.append(v.s.slice(0, 300), el('span', { class: 'dlouhy', text: ' … (' + fc(v.n) + ' znaků)' }));
      td.title = v.s.slice(0, 1000);
      return;
    }
    const s = String(v);
    td.textContent = s.length > 300 ? s.slice(0, 300) + '…' : s;
    if (s.length > 40 || s.includes('\n')) td.title = s.slice(0, 1000);
  }

  class Mrizka {
    /** m: {nacti(p) → {sloupce, typy?, radky, celkem, klice?, editovatelna?, duvod?}, vyber, pk:Set, onEdit(r, c)} */
    constructor(kont, m) {
      this.k = kont; this.m = m;
      this.offset = 0; this.limit = nast.stranka; this.razeni = []; this.filtry = {}; this.hledat = ''; this.vybrane = new Set();
      this.data = null; this.klicHlavy = null; this.cekani = null;
      kont.innerHTML = '';
      this.lista = el('div', { class: 'mrizka-lista' });
      this.inHledat = el('input', { type: 'search', class: 'hledat', placeholder: 'Hledat ve všech sloupcích…', 'aria-label': 'Hledat ve všech sloupcích' });
      this.inHledat.addEventListener('input', () => this.odlozene(() => { this.hledat = this.inHledat.value; this.offset = 0; this.obnov(); }));
      this.strankovani = el('div', { class: 'strankovani' });
      this.lista.append(this.inHledat, this.strankovani);
      this.obal = el('div', { class: 'tabulka-obal', tabindex: '-1' });
      this.tab = el('table', { class: 'data' });
      this.obal.append(this.tab);
      this.info = el('div', { class: 'info-radek' });
      kont.append(this.lista, this.obal, this.info);
      this.tab.addEventListener('keydown', e => this.klavesy(e));
    }
    odlozene(fn) { clearTimeout(this.cekani); this.cekani = setTimeout(fn, 280); }
    async obnov() {
      const moje = this.pozadavek = (this.pozadavek || 0) + 1;
      try {
        const d = await this.m.nacti({ offset: this.offset, limit: this.limit, razeni: this.razeni, filtry: this.filtry, hledat: this.hledat });
        if (moje !== this.pozadavek) return;
        this.data = d;
        if (d.radky.length === 0 && this.offset > 0 && d.celkem > 0) { this.offset = Math.max(0, Math.floor((d.celkem - 1) / this.limit) * this.limit); return this.obnov(); }
        this.vykresli();
      } catch (e) {
        if (moje !== this.pozadavek) return;
        this.info.textContent = 'Chyba: ' + e.message;
        this.info.style.color = 'var(--danger)';
      }
    }
    vykresli() {
      const d = this.data;
      const klic = JSON.stringify([d.sloupce, d.typy || null]);
      if (klic !== this.klicHlavy) { this.vykresliHlavu(); this.klicHlavy = klic; }
      else this.oznacRazeni();
      const tb = el('tbody');
      d.radky.forEach((r, i) => {
        const tr = el('tr', { dataset: { r: i } });
        if (this.m.vyber) {
          const k = JSON.stringify(d.klice[i]);
          const cb = el('input', { type: 'checkbox', 'aria-label': 'Vybrat řádek' });
          cb.checked = this.vybrane.has(k);
          if (cb.checked) tr.classList.add('vybrany');
          cb.addEventListener('change', () => { if (cb.checked) this.vybrane.add(k); else this.vybrane.delete(k); tr.classList.toggle('vybrany', cb.checked); this.m.poVyberu && this.m.poVyberu(this.vybrane.size); });
          tr.append(el('td', { class: 'vyber' }, cb));
        } else tr.append(el('td', { class: 'vyber cislo-radku', text: String(this.offset + i + 1) }));
        r.forEach((v, c) => {
          const td = el('td', { tabindex: '-1', dataset: { c } });
          vykresliHodnotu(td, v);
          td.dataset.c = c;
          if (d.editovatelna && !(d.generovane && d.generovane[c])) {
            td.classList.add('edit');
            td.addEventListener('dblclick', () => this.m.onEdit(i, c, td));
          }
          tr.append(td);
        });
        tb.append(tr);
      });
      const stare = this.tab.querySelector('tbody');
      if (stare) stare.replaceWith(tb); else this.tab.append(tb);
      if (!d.radky.length) {
        const tr = el('tr', null, el('td', { colspan: d.sloupce.length + 1, class: 'prazdne', text: Object.keys(this.filtry).some(k => this.filtry[k]) || this.hledat ? 'Žádný řádek neodpovídá filtru.' : 'Žádné řádky.' }));
        tb.append(tr);
      }
      // stránkování
      const celkem = d.celkem;
      const stran = Math.max(1, Math.ceil(celkem / this.limit));
      const str = Math.floor(this.offset / this.limit) + 1;
      const s = this.strankovani; s.innerHTML = '';
      const jdi = o => { this.offset = Math.max(0, Math.min((stran - 1) * this.limit, o)); this.obnov(); };
      const inp = el('input', { type: 'number', min: 1, max: stran, value: str, 'aria-label': 'Stránka' });
      inp.addEventListener('change', () => jdi((Math.max(1, Math.min(stran, inp.value | 0)) - 1) * this.limit));
      s.append(
        el('button', { type: 'button', class: 'male', 'aria-label': 'První stránka', disabled: str <= 1, onclick: () => jdi(0) }, '⏮'),
        el('button', { type: 'button', class: 'male', 'aria-label': 'Předchozí stránka', disabled: str <= 1, onclick: () => jdi(this.offset - this.limit) }, '◀'),
        inp, ' / ' + fc(stran),
        el('button', { type: 'button', class: 'male', 'aria-label': 'Další stránka', disabled: str >= stran, onclick: () => jdi(this.offset + this.limit) }, '▶'),
        el('button', { type: 'button', class: 'male', 'aria-label': 'Poslední stránka', disabled: str >= stran, onclick: () => jdi((stran - 1) * this.limit) }, '⏭')
      );
      const od = celkem ? this.offset + 1 : 0, doo = this.offset + d.radky.length;
      this.info.style.color = '';
      this.info.textContent = 'Řádky ' + fc(od) + '–' + fc(doo) + ' z ' + fc(celkem) + (d.doplnek ? ' · ' + d.doplnek : '') +
        (d.editovatelna ? ' · Dvojklik nebo Enter na buňce = úprava' : (d.duvod ? ' · Jen ke čtení: ' + d.duvod : ''));
    }
    vykresliHlavu() {
      const d = this.data;
      const th = el('thead');
      const tr1 = el('tr'), tr2 = el('tr', { class: 'filtry' });
      if (this.m.vyber) {
        const vse = el('input', { type: 'checkbox', 'aria-label': 'Vybrat vše na stránce' });
        vse.addEventListener('change', () => {
          this.data.klice.forEach(k => { const s = JSON.stringify(k); if (vse.checked) this.vybrane.add(s); else this.vybrane.delete(s); });
          this.vykresli(); this.m.poVyberu && this.m.poVyberu(this.vybrane.size);
        });
        tr1.append(el('th', { class: 'vyber' }, vse));
      } else tr1.append(el('th', { class: 'vyber', text: '#' }));
      tr2.append(el('th', { class: 'vyber' }));
      d.sloupce.forEach((s, i) => {
        const pk = this.m.pk && this.m.pk.has(s);
        const b = el('button', { type: 'button', class: 'razeni', title: 'Řadit (Shift = další úroveň řazení)', dataset: { i } }, pk ? el('span', { class: 'klic', text: '🔑 ' }) : null, s, el('span', { class: 'sipka' }));
        b.addEventListener('click', e => this.prepniRazeni(i, e.shiftKey));
        tr1.append(el('th', { scope: 'col' }, b, d.typy && d.typy[i] ? el('span', { class: 'typ', text: d.typy[i] }) : null));
        const f = el('input', { type: 'text', placeholder: 'filtr', 'aria-label': 'Filtr sloupce ' + s, title: 'text = obsahuje; =x, !=x, >x, >=x, <x, <=x; NULL, !NULL' });
        f.value = this.filtry[i] || '';
        f.addEventListener('input', () => this.odlozene(() => { this.filtry[i] = f.value; this.offset = 0; this.obnov(); }));
        tr2.append(el('th', null, f));
      });
      th.append(tr1, tr2);
      this.tab.innerHTML = '';
      this.tab.append(th);
      requestAnimationFrame(() => { this.tab.style.setProperty('--vyska-hlavy', tr1.getBoundingClientRect().height + 'px'); });
      this.oznacRazeni();
    }
    oznacRazeni() {
      this.tab.querySelectorAll('thead .razeni').forEach(b => {
        const i = Number(b.dataset.i);
        const r = this.razeni.findIndex(x => x.sloupec === i);
        b.querySelector('.sipka').textContent = r < 0 ? '' : (this.razeni[r].smer === 'asc' ? ' ▲' : ' ▼') + (this.razeni.length > 1 ? (r + 1) : '');
        b.closest('th').setAttribute('aria-sort', r < 0 ? 'none' : this.razeni[r].smer === 'asc' ? 'ascending' : 'descending');
      });
    }
    prepniRazeni(i, pridat) {
      const ix = this.razeni.findIndex(x => x.sloupec === i);
      if (!pridat) {
        const puv = ix >= 0 ? this.razeni[ix].smer : null;
        this.razeni = puv === null ? [{ sloupec: i, smer: 'asc' }] : puv === 'asc' ? [{ sloupec: i, smer: 'desc' }] : [];
      } else if (ix < 0) this.razeni.push({ sloupec: i, smer: 'asc' });
      else if (this.razeni[ix].smer === 'asc') this.razeni[ix].smer = 'desc';
      else this.razeni.splice(ix, 1);
      this.offset = 0; this.obnov();
    }
    klavesy(e) {
      const td = e.target.closest && e.target.closest('td[data-c]');
      if (!td) return;
      const tr = td.parentElement, c = Number(td.dataset.c);
      let cil = null;
      if (e.key === 'ArrowRight') cil = tr.querySelector('td[data-c="' + (c + 1) + '"]');
      else if (e.key === 'ArrowLeft') cil = tr.querySelector('td[data-c="' + (c - 1) + '"]');
      else if (e.key === 'ArrowDown') cil = tr.nextElementSibling && tr.nextElementSibling.querySelector('td[data-c="' + c + '"]');
      else if (e.key === 'ArrowUp') cil = tr.previousElementSibling && tr.previousElementSibling.querySelector('td[data-c="' + c + '"]');
      else if ((e.key === 'Enter' || e.key === 'F2') && td.classList.contains('edit')) { e.preventDefault(); this.m.onEdit(Number(tr.dataset.r), c, td); return; }
      if (cil) { e.preventDefault(); cil.focus(); }
    }
  }
  // první buňka dostupná tabulátorem
  document.addEventListener('focusin', e => {
    if (e.target.classList && e.target.classList.contains('tabulka-obal')) {
      const td = e.target.querySelector('td[data-c]'); if (td) td.focus();
    }
  });

  // ======================= Záložka Data =======================
  let mrizkaData = null, tabData = null;
  function zobrazTabulku(nazev) {
    const t = S.schema.tabulky.find(x => x.nazev === nazev);
    if (!t) return;
    tabData = t;
    S.dataZastarala = false;
    const poc = S.pocty[nazev];
    $('dataNadpis').textContent = (t.typ === 'view' ? '👁 ' : '▦ ') + nazev;
    const edit = t.klic.typ !== 'zadny';
    $('bNovyRadek').disabled = !(t.typ === 'table' && !t.virtualni) || nast.jenCteni;
    $('bSmazat').disabled = true;
    for (const id of ['bExpCsv', 'bExpJson', 'bStatSl', 'bDoSql']) $(id).disabled = false;
    $('statSloupcu').innerHTML = '';
    const pk = new Set(t.klic.typ === 'pk' ? t.klic.sloupce : t.sloupce.filter(s => s.pk).map(s => s.nazev));
    mrizkaData = new Mrizka($('dataMrizka'), {
      vyber: edit,
      pk,
      nacti: p => volej('prohlizej', Object.assign({ tabulka: nazev }, p)).then(d => {
        if (d.celkem != null && !p.hledat && !Object.values(p.filtry).some(Boolean)) { S.pocty[nazev] = d.celkem; }
        d.doplnek = [t.bezRowid ? 'WITHOUT ROWID, klíč ' + t.klic.sloupce.join(', ') : '', t.strict ? 'STRICT' : '', J.formatCas(d.cas)].filter(Boolean).join(' · ');
        return d;
      }),
      poVyberu: n => { $('bSmazat').disabled = !n || nast.jenCteni; $('bSmazat').textContent = '🗑 Smazat vybrané' + (n ? ' (' + n + ')' : ''); },
      onEdit: (r, c, td) => upravBunku(r, c, td)
    });
    mrizkaData.obnov();
    void poc;
  }
  function obnovData() {
    if (S.zalozka !== 'data') { S.dataZastarala = true; return; }
    S.dataZastarala = false;
    if (tabData && S.schema.tabulky.some(t => t.nazev === tabData.nazev)) {
      const t = S.schema.tabulky.find(x => x.nazev === tabData.nazev);
      if (JSON.stringify(t.sloupce) !== JSON.stringify(tabData.sloupce) || JSON.stringify(t.klic) !== JSON.stringify(tabData.klic)) zobrazTabulku(t.nazev);
      else { tabData = t; mrizkaData && mrizkaData.obnov(); }
    }
  }

  // --- úprava buňky ---
  let dlgVysledek = null;
  function dlgCekej(dlg) {
    return new Promise(res => {
      dlgVysledek = res;
      dlg.showModal();
    });
  }
  $('formBunka').addEventListener('submit', e => { e.preventDefault(); $('dlgBunka').close(); dlgVysledek && dlgVysledek(true); });
  $('bunkaZrusit').addEventListener('click', () => { $('dlgBunka').close(); dlgVysledek && dlgVysledek(false); });
  $('dlgBunka').addEventListener('cancel', () => { dlgVysledek && dlgVysledek(false); });
  $('bunkaHodnota').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); $('formBunka').requestSubmit(); } });
  let souborBunky = null;
  $('bunkaTyp').addEventListener('change', () => {
    const t = $('bunkaTyp').value;
    $('bunkaHodnota').disabled = t === 'null' || t === 'blob';
    if (t === 'blob') $('bunkaSoubor').click();
    $('bunkaInfo').textContent = t === 'blob' ? (souborBunky ? souborBunky.name + ' (' + J.formatBajty(souborBunky.size) + ')' : 'vyberte soubor') : '';
  });
  $('bunkaSoubor').addEventListener('change', e => { souborBunky = e.target.files[0] || null; e.target.value = ''; $('bunkaInfo').textContent = souborBunky ? souborBunky.name + ' (' + J.formatBajty(souborBunky.size) + ')' : 'vyberte soubor'; });

  function prevedHodnotu(typ, text) {
    if (typ === 'null') return null;
    if (typ === 'text') return text;
    if (typ === 'integer') {
      const t = text.trim().replace(/\s/g, '');
      if (!/^[+-]?\d+$/.test(t)) throw new Error('„' + text + '" není celé číslo.');
      const b = BigInt(t);
      if (b > 9223372036854775807n || b < -9223372036854775808n) throw new Error('Číslo je mimo rozsah 64bitového celého čísla SQLite.');
      return b <= BigInt(Number.MAX_SAFE_INTEGER) && b >= BigInt(Number.MIN_SAFE_INTEGER) ? Number(b) : b;
    }
    if (typ === 'real') {
      const t = text.trim().replace(/\s/g, '').replace(',', '.');
      if (t === '' || isNaN(Number(t))) throw new Error('„' + text + '" není číslo.');
      return Number(t);
    }
    if (typ === 'hex') {
      const t = text.replace(/^x'|'$|^0x|\s/gi, '');
      if (!/^([0-9a-f]{2})*$/i.test(t)) throw new Error('Hex musí mít sudý počet znaků 0–9, A–F.');
      return new Uint8Array(t.match(/../g) ? t.match(/../g).map(h => parseInt(h, 16)) : []);
    }
    throw new Error('Neznámý typ.');
  }
  function afinita(typ) {
    const t = String(typ || '').toUpperCase();
    if (t.includes('INT')) return 'INTEGER';
    if (/CHAR|CLOB|TEXT/.test(t)) return 'TEXT';
    if (t.includes('BLOB') || t === '') return 'BLOB';
    if (/REAL|FLOA|DOUB/.test(t)) return 'REAL';
    return 'NUMERIC';
  }
  async function upravBunku(r, c, td) {
    if (nast.jenCteni) { Dialog.info('Je zapnutý režim jen pro čtení (Nastavení).'); return; }
    const d = mrizkaData.data, t = tabData, sloupec = d.sloupce[c], klic = d.klice[r];
    let v = d.radky[r][c];
    try { if (v && typeof v === 'object' && v.t === 'dlouhy') v = await volej('hodnota', { tabulka: t.nazev, klic, sloupec }); }
    catch (e) { Dialog.chyba(e.message); return; }
    const jeBlob = v && typeof v === 'object' && (v.t === 'blob' || v instanceof Uint8Array);
    const typ = jeBlob ? 'blob' : J.typHodnoty(v);
    $('bunkaNadpis').textContent = t.nazev + '.' + sloupec;
    const decl = d.typy[c] || '(bez typu)';
    $('bunkaInfo').textContent = '';
    $('bunkaPozn').innerHTML = 'Deklarovaný typ <code>' + esc(decl) + '</code> (afinita ' + afinita(d.typy[c]) + (t.strict ? ', STRICT' : '') +
      '). Změna se provede parametrizovaným <code>UPDATE … WHERE ' + esc(t.klic.typ === 'rowid' ? t.klic.alias : t.klic.sloupce.join(', ')) + '</code> v transakci. <kbd>Ctrl</kbd>+<kbd>Enter</kbd> uloží.';
    souborBunky = null;
    $('bunkaTyp').value = typ === 'blob' ? 'blob' : typ;
    $('bunkaHodnota').value = typ === 'null' ? '' : typ === 'blob' ? '' : String(v);
    $('bunkaHodnota').disabled = typ === 'null' || typ === 'blob';
    if (typ === 'blob') $('bunkaInfo').textContent = 'současná hodnota: BLOB ' + J.formatBajty(v.n) + ' – vyberte soubor nebo změňte typ';
    $('bunkaStahnout').hidden = !(typ === 'blob' || typ === 'text');
    $('bunkaStahnout').onclick = () => stahniHodnotu(t.nazev, klic, sloupec);
    const ok = await dlgCekej($('dlgBunka'));
    if (!ok) { td && td.focus(); return; }
    let hodnota;
    try {
      const ty = $('bunkaTyp').value;
      if (ty === 'blob') {
        if (!souborBunky) { if (typ === 'blob') return; throw new Error('Nevybrali jste soubor.'); }
        if (souborBunky.size > 256 * MB) throw new Error('Soubor je pro BLOB v prohlížeči příliš velký.');
        hodnota = new Uint8Array(await souborBunky.arrayBuffer());
      } else hodnota = prevedHodnotu(ty, $('bunkaHodnota').value);
      const res = await volej('upravBunku', { tabulka: t.nazev, klic, sloupec, hodnota });
      d.radky[r][c] = res.hodnota; d.klice[r] = res.klic;
      if (td) { vykresliHodnotu(td, res.hodnota); td.classList.add('zmeneno', 'edit'); td.focus(); }
      aktualizujStav(res.stav);
    } catch (e) { Dialog.chyba('Úprava neproběhla: ' + e.message); }
  }
  async function stahniHodnotu(tabulka, klic, sloupec) {
    try {
      const v = await volej('hodnota', { tabulka, klic, sloupec });
      if (v instanceof Uint8Array) {
        const typ = J.typObrazku(v);
        stahni(new Blob([v], { type: typ || 'application/octet-stream' }), tabulka + '_' + sloupec + (typ ? '.' + typ.split('/')[1] : '.bin'));
      } else stahni(new Blob([v == null ? '' : String(v)], { type: 'text/plain;charset=utf-8' }), tabulka + '_' + sloupec + '.txt');
    } catch (e) { Dialog.chyba(e.message); }
  }

  // --- nový řádek ---
  $('bNovyRadek').addEventListener('click', async () => {
    const t = tabData; if (!t) return;
    const pole = $('novyPole'); pole.innerHTML = '';
    $('novyNadpis').textContent = 'Nový řádek – ' + t.nazev;
    const vstupy = [];
    for (const s of t.sloupce.filter(x => !x.skryty && !x.generovany)) {
      const auto = s.pk && afinita(s.typ) === 'INTEGER' && t.sloupce.filter(x => x.pk).length === 1 && !t.bezRowid;
      const maDef = s.vychozi !== null || auto || !s.nenull;
      const inp = el('input', { type: 'text', 'aria-label': s.nazev, placeholder: auto ? 'automaticky' : s.vychozi !== null ? 'výchozí: ' + s.vychozi : (s.nenull ? 'povinné' : 'NULL') });
      const vych = el('input', { type: 'checkbox', 'aria-label': 'Použít výchozí hodnotu' });
      vych.checked = maDef;
      inp.addEventListener('input', () => { vych.checked = inp.value === '' && maDef; });
      pole.append(el('label', { text: s.nazev + ' ', title: s.typ }, el('span', { class: 'napoveda', text: (s.typ || '') + (s.pk ? ' PK' : '') + (s.nenull ? ' NOT NULL' : '') })), inp,
        el('label', { class: 'zaskrt', style: 'align-items:center' }, vych, 'výchozí'));
      vstupy.push({ s, inp, vych });
    }
    const ok = await new Promise(res => {
      const f = $('formNovy'), dlg = $('dlgNovy');
      const sub = e => { e.preventDefault(); konec(true); };
      const zr = () => konec(false);
      const can = () => konec(false);
      function konec(v) { f.removeEventListener('submit', sub); $('novyZrusit').removeEventListener('click', zr); dlg.removeEventListener('cancel', can); if (dlg.open) dlg.close(); res(v); }
      f.addEventListener('submit', sub); $('novyZrusit').addEventListener('click', zr); dlg.addEventListener('cancel', can);
      dlg.showModal();
      const prv = vstupy.find(v => !v.vych.checked) || vstupy[0]; if (prv) prv.inp.focus();
    });
    if (!ok) return;
    const hodnoty = {};
    for (const v of vstupy) if (!v.vych.checked) hodnoty[v.s.nazev] = v.inp.value === '' && !v.s.nenull ? null : v.inp.value;
    try {
      const r = await volej('vlozRadek', { tabulka: t.nazev, hodnoty });
      aktualizujStav(r.stav);
      Dialog.info('Řádek vložen' + (r.rowid != null ? ' (rowid ' + r.rowid + ')' : '') + ' – v transakci.');
      mrizkaData.obnov(); nactiPocty();
    } catch (e) { Dialog.chyba('Vložení selhalo: ' + e.message); }
  });
  $('bSmazat').addEventListener('click', async () => {
    const klice = [...mrizkaData.vybrane].map(k => JSON.parse(k));
    if (!klice.length) return;
    if (!(await Dialog.potvrd('Smazat ' + klice.length + ' vybraných řádků z „' + tabData.nazev + '"? (V transakci – lze vrátit.)', { ok: 'Smazat' }))) return;
    try {
      const r = await volej('smazRadky', { tabulka: tabData.nazev, klice });
      aktualizujStav(r.stav);
      mrizkaData.vybrane.clear(); $('bSmazat').disabled = true; $('bSmazat').textContent = '🗑 Smazat vybrané';
      Dialog.info('Smazáno ' + r.smazano + ' řádků.');
      mrizkaData.obnov(); nactiPocty();
    } catch (e) { Dialog.chyba('Mazání selhalo: ' + e.message); }
  });
  async function exportTabulky(format) {
    try {
      const m = mrizkaData;
      const r = await volej('exportTabulky', { tabulka: tabData.nazev, format, moznosti: format === 'csv' ? csvMoznosti() : {}, filtry: m.filtry, hledat: m.hledat, razeni: m.razeni });
      stahni(r.blob, tabData.nazev + '.' + format);
      Dialog.info('Exportováno ' + fc(r.radku) + ' řádků' + (m.hledat || Object.values(m.filtry).some(Boolean) ? ' (podle filtru)' : '') + '.');
    } catch (e) { Dialog.chyba(e.message); }
  }
  $('bExpCsv').addEventListener('click', () => exportTabulky('csv'));
  $('bExpJson').addEventListener('click', () => exportTabulky('json'));
  $('bDoSql').addEventListener('click', () => {
    nastavEditor('SELECT * FROM ' + J.q(tabData.nazev) + ' LIMIT 100;');
    prepniZalozku('sql'); $('edText').focus();
  });
  $('bStatSl').addEventListener('click', async () => {
    const k = $('statSloupcu');
    try {
      const r = await volej('statistikaSloupcu', { tabulka: tabData.nazev });
      k.innerHTML = '';
      k.append(el('h3', { text: 'Statistika sloupců – ' + r.tabulka + ' (' + fc(r.celkem) + ' řádků)' }));
      const g = el('div', { class: 'stat-sloupce' });
      const hv = v => v === null ? 'NULL' : typeof v === 'object' ? (v.t === 'blob' ? 'BLOB ' + J.formatBajty(v.n) : v.s + '…') : String(v).replace(/^(-?\d+)\.(\d+)$/, '$1,$2');
      for (const s of r.sloupce) {
        const typy = Object.entries(s.typy).filter(([, n]) => n).map(([t, n]) => t + ' ' + fc(n)).join(', ') || '–';
        g.append(el('div', { class: 'karta' }, el('b', { text: s.nazev }), ' ', el('span', { class: 'napoveda', text: s.typ || '(bez typu)' }),
          el('dl', null,
            el('dt', { text: 'vyplněno' }), el('dd', { text: fc(s.nenull) + (s.celkem ? ' (' + fc(100 * s.nenull / s.celkem, 1) + ' %)' : '') }),
            el('dt', { text: 'NULL' }), el('dd', { text: fc(s.null) }),
            el('dt', { text: 'různých' }), el('dd', { text: fc(s.ruznych) }),
            el('dt', { text: 'min / max' }), el('dd', { text: hv(s.min) + ' / ' + hv(s.max) }),
            s.prumer != null ? [el('dt', { text: 'průměr' }), el('dd', { text: fc(s.prumer, 4) })] : null,
            el('dt', { text: 'typy' }), el('dd', { text: typy }),
            s.prumDelka != null ? [el('dt', { text: 'délka' }), el('dd', { text: 'Ø ' + fc(s.prumDelka, 1) + ', max ' + fc(s.maxDelka) })] : null,
            el('dt', { text: 'nejčastější' }), el('dd', { text: s.nejcastejsi.map(([v, n]) => hv(v) + ' ×' + fc(n)).join('; ') })
          )));
      }
      k.append(g);
      k.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) { Dialog.chyba(e.message); }
  });

  // ======================= SQL editor =======================
  const ed = $('edText'), edZ = $('edZvyr'), edC = $('edCisla');
  function zvyrazni() {
    const t = ed.value;
    if (t.length > 300000) { edZ.textContent = t + '\n'; }
    else edZ.innerHTML = J.tokenizuj(t).map(k => k.t === 'ws' || k.t === 'op' ? esc(k.s) : '<span class="t-' + k.t + '">' + esc(k.s) + '</span>').join('') + '\n';
    const radku = t.split('\n').length;
    if (edC.childElementCount !== radku) edC.innerHTML = Array.from({ length: radku }, (_, i) => '<div>' + (i + 1) + '</div>').join('');
    synchronizujScroll();
  }
  function synchronizujScroll() { edZ.scrollTop = ed.scrollTop; edZ.scrollLeft = ed.scrollLeft; edC.scrollTop = ed.scrollTop; }
  let ulozEditor = null;
  ed.addEventListener('input', () => { zvyrazni(); clearTimeout(ulozEditor); ulozEditor = setTimeout(() => lsSet('editor', ed.value), 400); });
  ed.addEventListener('scroll', synchronizujScroll);
  ed.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); e.shiftKey ? spustKurzor() : spustVse(); return; }
    if (e.key === 'Tab' && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      const z = ed.selectionStart, k = ed.selectionEnd;
      ed.setRangeText('  ', z, k, 'end'); ed.dispatchEvent(new Event('input'));
    }
  });
  function nastavEditor(t) { ed.value = t; zvyrazni(); lsSet('editor', t); }
  ed.value = lsGet('editor', '-- Napište SQL a stiskněte Ctrl+Enter.\nSELECT name, type FROM sqlite_schema ORDER BY type, name;');
  zvyrazni();
  $('bSpustit').addEventListener('click', spustVse);
  $('bSpustitKurzor').addEventListener('click', spustKurzor);
  function spustVse() {
    const z = ed.selectionStart, k = ed.selectionEnd;
    spust(z !== k ? ed.value.slice(z, k) : ed.value);
  }
  function spustKurzor() {
    const p = J.prikazNaPozici(ed.value, ed.selectionStart);
    if (!p) { Dialog.info('Žádný příkaz.'); return; }
    ed.setSelectionRange(p.z, p.k); ed.focus();
    spust(p.sql);
  }
  async function spust(sql) {
    if (!sql.trim() || !S.info) return;
    const zp = $('zpravy');
    zp.innerHTML = '';
    let r;
    try { r = await volej('dotaz', { sql, maxRadku: nast.maxRadku }); }
    catch (e) { zp.append(el('li', { class: 'chyba', text: e.message })); return; }
    for (const p of r.prikazy) {
      const kratce = p.sql.length > 120 ? p.sql.slice(0, 120) + '…' : p.sql;
      const co = p.sloupce.length ? fc(p.radku) + ' řádků' + (p.oriznuto ? ' (zkráceno limitem ' + fc(nast.maxRadku) + ')' : '') : (p.zmeneno ? 'změněno ' + fc(p.zmeneno) + ' řádků' : 'provedeno');
      zp.append(el('li', { class: p.oriznuto ? 'warn' : '' }, '✔ ', el('code', { text: kratce }), ' — ' + co + ' · ' + J.formatCas(p.cas)));
    }
    if (r.chyba) zp.append(el('li', { class: 'chyba', text: '✖ Chyba v ' + (r.prikazy.length + 1) + '. příkazu: ' + r.chyba + (r.prikazy.length ? ' (předchozí příkazy proběhly)' : '') }));
    aktualizujStav(r.stav);
    if (r.stav.transakce && r.stav.autoTx && (r.zmeny || r.schemaZmena)) zp.append(el('li', { class: 'warn', text: '⏳ Změny čekají v transakci – nahoře je potvrďte (COMMIT) nebo vraťte (ROLLBACK).' }));
    pridejHistorii({ sql, ok: !r.chyba, ms: r.cas, radku: r.vysledek ? r.vysledek.celkem : null, chyba: r.chyba });
    if (r.schemaZmena) await obnovSchema();
    if (r.zmeny || r.schemaZmena) { S.dataZastarala = true; S.statPlatne = false; nactiPocty(); }
    if (r.vysledek) zobrazVysledek(r.vysledek);
    $('sqlInfo').textContent = 'Celkem ' + J.formatCas(r.cas);
  }

  // --- výsledek dotazu ---
  let mrizkaSql = null, graf = null;
  function zobrazVysledek(v) {
    S.sqlVysledek = v;
    $('vysledekObal').hidden = false;
    prepniPodzalozku(S.podzalozka === 'plan' ? 'tab' : (S.podzalozka || 'tab'));
    let prvni = v;
    mrizkaSql = new Mrizka($('sqlMrizka'), {
      vyber: false,
      nacti: p => {
        if (prvni && p.offset === 0 && p.limit === 100 && !p.razeni.length && !p.hledat) { const d = prvni; prvni = null; return Promise.resolve(Object.assign({}, d, { celkem: d.filtrovano, doplnek: popisVysledku(v) })); }
        prvni = null;
        return volej('stranka', Object.assign({ id: v.id }, p)).then(d => Object.assign(d, { sloupce: v.sloupce, celkem: d.filtrovano, doplnek: popisVysledku(v) }));
      }
    });
    mrizkaSql.obnov();
    // export výsledku
    const lista = mrizkaSql.lista;
    lista.append(
      el('button', { type: 'button', class: 'male', onclick: () => exportVysledku('csv') }, '⬇ CSV'),
      el('button', { type: 'button', class: 'male', onclick: () => exportVysledku('json') }, '⬇ JSON')
    );
    S.grafNavrh = null;
    if (S.podzalozka === 'graf') kresliGraf(true);
  }
  function popisVysledku(v) {
    return (v.oriznuto ? '⚠️ zkráceno na ' + fc(v.celkem) + ' řádků (limit v Nastavení)' : 'načteno ' + fc(v.celkem)) + ' · ~' + J.formatBajty(v.pamet) + ' v paměti workeru';
  }
  async function exportVysledku(format) {
    const m = mrizkaSql;
    try {
      const r = await volej('exportVysledku', { id: S.sqlVysledek.id, format, moznosti: format === 'csv' ? csvMoznosti() : {}, filtry: m.filtry, hledat: m.hledat, razeni: m.razeni });
      stahni(r.blob, 'vysledek.' + format);
      if (r.oriznuto) Dialog.info('Pozor: výsledek byl zkrácen limitem řádků – exportováno jen ' + fc(r.radku) + ' řádků. Celou tabulku exportujte ze záložky Data.');
    } catch (e) { Dialog.chyba(e.message); }
  }
  document.querySelectorAll('.podzalozky button').forEach(b => b.addEventListener('click', () => prepniPodzalozku(b.dataset.pz)));
  function prepniPodzalozku(z) {
    S.podzalozka = z;
    document.querySelectorAll('.podzalozky button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.pz === z)));
    for (const id of ['tab', 'graf', 'plan']) $('pz-' + id).hidden = id !== z;
    if (z === 'graf') kresliGraf(!S.grafNavrh);
  }

  // --- plán dotazu ---
  $('bPlan').addEventListener('click', async () => {
    const z = ed.selectionStart, k = ed.selectionEnd;
    const p = z !== k ? { sql: ed.value.slice(z, k) } : J.prikazNaPozici(ed.value, z);
    if (!p) { Dialog.info('Žádný příkaz.'); return; }
    const o = $('planObsah');
    $('vysledekObal').hidden = false;
    prepniPodzalozku('plan');
    try {
      const r = await volej('plan', { sql: p.sql });
      o.innerHTML = '';
      o.append(el('pre', { class: 'ddl', text: r.prikaz }));
      const strom = uzly => el('ul', null, uzly.map(u => el('li', null, el('span', { class: 'uzel', text: u.detail }), u.varovani ? el('span', { class: 'var', text: '⚠️ ' + u.varovani }) : null, u.deti.length ? strom(u.deti) : null)));
      o.append(el('h3', { text: 'EXPLAIN QUERY PLAN' }), r.strom.length ? strom(r.strom) : el('p', { class: 'napoveda', text: 'Plán je prázdný (příkaz nečte tabulky).' }));
      o.append(el('p', { class: 'napoveda', html: '<b>SCAN</b> = průchod celou tabulkou, <b>SEARCH</b> = vyhledání přes index nebo rowid, <b>COVERING INDEX</b> = data stačí z indexu, <b>TEMP B-TREE</b> = dočasné řazení. Plán vychází ze statistik (<code>ANALYZE</code>), pokud v databázi jsou.' }));
      if (r.opkody) {
        const det = el('details', null, el('summary', { text: 'Bajtkód VDBE (EXPLAIN) – ' + fc(r.opkody.celkem) + ' instrukcí' }));
        const tb = el('table', { class: 'prehled mono' }, el('thead', null, el('tr', null, r.opkody.sloupce.map(s => el('th', { text: s })))),
          el('tbody', null, r.opkody.radky.map(rr => el('tr', null, rr.map(v => el('td', { text: v === null ? '' : String(v) }))))));
        det.append(el('div', { class: 'obal-tab' }, tb));
        o.append(det);
      }
      if (r.dalsich) o.append(el('p', { class: 'napoveda', text: 'Plán je jen pro první příkaz výběru (' + r.dalsich + ' dalších nezahrnuto).' }));
    } catch (e) { o.innerHTML = ''; o.append(el('p', { class: 'napoveda', style: 'color:var(--danger)', text: e.message })); }
  });

  // --- šablony ---
  $('sablony').addEventListener('change', () => {
    const v = $('sablony').value; $('sablony').value = '';
    if (!v || !S.schema) return;
    const tabs = S.schema.tabulky.filter(t => t.typ === 'table' && !t.systemova);
    const t = (S.vybrany && tabs.find(x => x.nazev === S.vybrany.nazev)) || tabs[0];
    const T = t ? J.q(t.nazev) : 'tabulka';
    const sl = t ? t.sloupce.filter(s => !s.skryty).map(s => s.nazev) : ['sloupec'];
    const fk = t && t.fk[0];
    const sablony = {
      select: 'SELECT ' + sl.slice(0, 6).map(J.q).join(', ') + '\nFROM ' + T + '\nWHERE 1 = 1\nORDER BY 1\nLIMIT 100;',
      join: fk ? 'SELECT a.*, b.*\nFROM ' + T + ' AS a\nJOIN ' + J.q(fk.table) + ' AS b ON b.' + J.q(fk.to || 'rowid') + ' = a.' + J.q(fk.from) + '\nLIMIT 100;' : '-- Tabulka ' + (t ? t.nazev : '') + ' nemá cizí klíč.\nSELECT *\nFROM ' + T + ' AS a\nJOIN jina AS b ON b.id = a.jina_id\nLIMIT 100;',
      group: 'SELECT ' + J.q(sl[Math.min(1, sl.length - 1)]) + ', count(*) AS pocet\nFROM ' + T + '\nGROUP BY 1\nORDER BY pocet DESC\nLIMIT 50;',
      cte: 'WITH vyber AS (\n  SELECT * FROM ' + T + ' LIMIT 1000\n)\nSELECT count(*) FROM vyber;',
      okno: 'SELECT ' + J.q(sl[0]) + ',\n  row_number() OVER (ORDER BY ' + J.q(sl[0]) + ') AS poradi,\n  count(*) OVER () AS celkem\nFROM ' + T + '\nLIMIT 100;',
      tabulky: "SELECT m.name AS tabulka, p.cid, p.name AS sloupec, p.type AS typ, p.\"notnull\", p.pk\nFROM sqlite_schema AS m\nJOIN pragma_table_info(m.name) AS p\nWHERE m.type = 'table'\nORDER BY m.name, p.cid;",
      index: 'CREATE INDEX ' + J.q('ix_' + (t ? t.nazev : 't') + '_' + sl[0]) + '\n  ON ' + T + ' (' + J.q(sl[0]) + ');'
    };
    const z = ed.selectionStart;
    const pred = ed.value.slice(0, z), za = ed.value.slice(ed.selectionEnd);
    const vlozit = (pred && !pred.endsWith('\n') ? '\n\n' : '') + sablony[v] + '\n';
    ed.value = pred + vlozit + za;
    ed.setSelectionRange(pred.length + vlozit.length, pred.length + vlozit.length);
    ed.focus(); ed.dispatchEvent(new Event('input'));
  });

  // --- historie ---
  function historie() { return lsGet('historie', []); }
  function pridejHistorii(z) {
    let h = historie();
    const i = h.findIndex(x => x.sql === z.sql);
    let hv = false;
    if (i >= 0) { hv = h[i].hvezda; h.splice(i, 1); }
    h.unshift({ sql: z.sql.slice(0, 20000), kdy: Date.now(), ms: Math.round(z.ms), ok: z.ok, radku: z.radku, chyba: z.chyba ? String(z.chyba).slice(0, 300) : null, hvezda: hv, db: S.info && S.info.nazev });
    // max 300 položek, oblíbené se nemažou
    const obl = h.filter(x => x.hvezda), ost = h.filter(x => !x.hvezda).slice(0, Math.max(0, 300 - obl.length));
    h = h.filter(x => x.hvezda || ost.includes(x));
    lsSet('historie', h);
    vykresliHistorii();
  }
  function vykresliHistorii() {
    const q = $('hledatHist').value.trim().toLowerCase();
    const ul = $('historie'); ul.innerHTML = '';
    const h = historie();
    const vyber = h.filter(x => !q || x.sql.toLowerCase().includes(q)).sort((a, b) => (b.hvezda - a.hvezda) || (b.kdy - a.kdy)).slice(0, 100);
    for (const z of vyber) {
      const d = new Date(z.kdy);
      const kdy = d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' }) + ' ' + d.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
      const li = el('li', { class: z.ok ? '' : 'chyba' },
        el('button', { type: 'button', class: 'sql', title: 'Klik = vložit do editoru, dvojklik = vložit a spustit' + (z.chyba ? '\nChyba: ' + z.chyba : ''), onclick: () => nastavEditor(z.sql), ondblclick: () => { nastavEditor(z.sql); spust(z.sql); } }, z.sql),
        el('div', { class: 'meta' },
          el('span', { text: kdy + ' · ' + J.formatCas(z.ms) + (z.ok ? (z.radku != null ? ' · ' + fc(z.radku) + ' ř.' : '') : ' · ✖ chyba') }),
          el('span', null,
            el('button', { type: 'button', title: z.hvezda ? 'Odebrat z oblíbených' : 'Oblíbené', 'aria-label': 'Oblíbené', onclick: () => { const hh = historie(); const x = hh.find(y => y.kdy === z.kdy && y.sql === z.sql); if (x) x.hvezda = !x.hvezda; lsSet('historie', hh); vykresliHistorii(); } }, z.hvezda ? '⭐' : '☆'),
            el('button', { type: 'button', title: 'Smazat z historie', 'aria-label': 'Smazat z historie', onclick: () => { lsSet('historie', historie().filter(y => !(y.kdy === z.kdy && y.sql === z.sql))); vykresliHistorii(); } }, '✕'))));
      ul.append(li);
    }
    if (!vyber.length) ul.append(el('li', { class: 'napoveda', style: 'padding:6px', text: q ? 'Nic nenalezeno.' : 'Zatím prázdná.' }));
  }
  $('hledatHist').addEventListener('input', vykresliHistorii);
  $('bSmazHist').addEventListener('click', async () => {
    if (!(await Dialog.potvrd('Vymazat historii dotazů (kromě oblíbených)?', { ok: 'Vymazat' }))) return;
    lsSet('historie', historie().filter(x => x.hvezda)); vykresliHistorii();
  });
  vykresliHistorii();

  // ======================= Graf =======================
  const PALETA = {
    light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'],
    dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767']
  };
  function jeSvetle() { return document.documentElement.dataset.theme === 'light'; }
  function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
  ['gTyp', 'gX', 'gAg', 'gMax'].forEach(id => $(id).addEventListener('change', () => kresliGraf(false)));
  async function kresliGraf(prvni) {
    const v = S.sqlVysledek;
    if (!v) return;
    if (!window.Chart) { $('gInfo').textContent = 'Knihovna grafů se ještě nenačetla.'; return; }
    const m = mrizkaSql || {};
    if (prvni || !S.grafNavrh) {
      // naplnit volby podle návrhu
      const r0 = await volej('dataGrafu', { id: v.id, filtry: m.filtry, hledat: m.hledat, razeni: m.razeni, graf: { max: 1 } }).catch(() => null);
      if (!r0) return;
      S.grafNavrh = r0.navrh;
      $('gX').innerHTML = ''; v.sloupce.forEach((s, i) => $('gX').append(el('option', { value: i, text: s })));
      $('gX').value = String(r0.navrh.x);
      const gy = $('gY'); gy.innerHTML = '';
      v.sloupce.forEach((s, i) => {
        const cb = el('input', { type: 'checkbox', value: i });
        cb.checked = r0.navrh.y[0] === i; // jedna řada = jedna osa; další sloupce s jiným měřítkem by zanikly
        cb.addEventListener('change', () => kresliGraf(false));
        gy.append(el('label', { title: r0.navrh.ciselne[i] ? 'číselný sloupec' : 'nečíselný – hodnoty se vynechají' }, cb, s + (r0.navrh.ciselne[i] ? '' : ' (text)')));
      });
      $('gTyp').value = r0.navrh.typ;
    }
    const y = [...$('gY').querySelectorAll('input:checked')].map(c => Number(c.value));
    let typ = $('gTyp').value;
    const ag = $('gAg').value;
    if (!y.length && ag !== 'pocet') { if (graf) { graf.destroy(); graf = null; } $('gInfo').textContent = 'Vyberte alespoň jeden sloupec hodnot (Y), nebo zvolte seskupení „počet".'; return; }
    let r;
    try {
      r = await volej('dataGrafu', { id: v.id, filtry: m.filtry, hledat: m.hledat, razeni: m.razeni, graf: { x: Number($('gX').value), y: y.length ? y : [Number($('gX').value)], agregace: ag, max: Number($('gMax').value), typ } });
    } catch (e) { $('gInfo').textContent = e.message; return; }
    const barvy = PALETA[jeSvetle() ? 'light' : 'dark'];
    const text = cssVar('--text-muted'), mrizka = cssVar('--border'), plocha = cssVar('--bg-input');
    let datasets, labels = r.popisky;
    let rady = r.rady.slice(0, 8);
    if (typ === 'pie') {
      rady = rady.slice(0, 1);
      // koláč: nejvýš 7 výsečí + „Ostatní", záporné hodnoty nedávají smysl
      let par = labels.map((l, i) => [l, rady[0].data[i]]).filter(p => p[1] != null && p[1] > 0);
      par.sort((a, b) => b[1] - a[1]);
      if (par.length > 8) { const zb = par.slice(7).reduce((s, p) => s + p[1], 0); par = par.slice(0, 7).concat([['Ostatní', zb]]); }
      labels = par.map(p => p[0]);
      datasets = [{ label: rady[0].nazev, data: par.map(p => p[1]), backgroundColor: barvy.slice(0, par.length), borderColor: plocha, borderWidth: 2 }];
    } else {
      datasets = rady.map((d, i) => ({
        label: d.nazev, data: d.data, borderColor: barvy[i], backgroundColor: typ === 'line' ? barvy[i] : barvy[i] + (typ === 'scatter' ? 'cc' : ''),
        borderWidth: typ === 'bar' ? 0 : 2, borderRadius: typ === 'bar' ? 4 : 0, maxBarThickness: 48,
        pointRadius: typ === 'scatter' ? 4 : (d.data.length > 60 ? 0 : 3), pointHoverRadius: 6, tension: 0, spanGaps: false
      }));
    }
    if (graf) graf.destroy();
    const fmt = n => typeof n === 'number' ? n.toLocaleString('cs-CZ', { maximumFractionDigits: 4 }) : n;
    graf = new Chart($('graf'), {
      type: typ, data: { labels: typ === 'scatter' ? undefined : labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false, locale: 'cs-CZ', normalized: true,
        interaction: typ === 'scatter' || typ === 'pie' ? { mode: 'nearest', intersect: true } : { mode: 'index', intersect: false },
        plugins: {
          legend: { display: datasets.length > 1 || typ === 'pie', labels: { color: text } },
          title: { display: datasets.length === 1 && typ !== 'pie', text: datasets[0] ? datasets[0].label : '', color: text },
          tooltip: { callbacks: { label: c => (c.dataset.label ? c.dataset.label + ': ' : '') + (typ === 'scatter' ? '(' + fmt(c.parsed.x) + '; ' + fmt(c.parsed.y) + ')' : fmt(typ === 'pie' ? c.parsed : c.parsed.y)) } }
        },
        scales: typ === 'pie' ? {} : {
          x: { type: typ === 'scatter' ? 'linear' : 'category', ticks: { color: text, maxRotation: 60, autoSkip: true }, grid: { color: mrizka, display: typ === 'scatter' }, title: { display: true, text: v.sloupce[Number($('gX').value)], color: text } },
          y: { ticks: { color: text, callback: val => fmt(val) }, grid: { color: mrizka }, beginAtZero: typ === 'bar' }
        }
      }
    });
    $('gInfo').textContent = 'Z ' + fc(r.pocetVstupnich) + ' řádků' + (r.oriznuto ? ', zobrazeno prvních ' + fc(Number($('gMax').value)) + ' bodů/kategorií' : '') +
      (r.vynechano ? ', vynecháno ' + fc(r.vynechano) + ' nečíselných nebo NULL hodnot' : '') + (r.rady.length > 8 ? ', zobrazeno jen 8 řad' : '') + '. Graf respektuje filtr a řazení tabulky výsledku.';
  }
  $('gPng').addEventListener('click', () => { if (graf) { const a = el('a', { href: graf.toBase64Image('image/png', 1), download: 'graf.png' }); document.body.append(a); a.click(); a.remove(); } });
  new MutationObserver(() => { if (graf && !$('pz-graf').hidden) kresliGraf(false); if (S.zalozka === 'er') vykresliErSvg(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // ======================= Struktura =======================
  function sqlHtml(sql) { return J.tokenizuj(sql || '').map(k => k.t === 'ws' || k.t === 'op' ? esc(k.s) : '<span class="t-' + k.t + '">' + esc(k.s) + '</span>').join(''); }
  function blokDdl(sql) {
    const pre = el('pre', { class: 'ddl', html: sqlHtml(sql || '-- (bez SQL – vytvořeno automaticky)') });
    const b = el('button', { type: 'button', class: 'male', onclick: () => { navigator.clipboard && navigator.clipboard.writeText(sql || '').then(() => Dialog.info('Zkopírováno.'), () => Dialog.chyba('Schránka není dostupná.')); } }, '📋 Kopírovat');
    return [pre, b];
  }
  function vykresliStrukturu() {
    const k = $('strukturaObsah'); k.innerHTML = '';
    const ob = S.vybrany && S.schema.objekty.find(o => o.nazev === S.vybrany.nazev);
    k.append(el('div', { class: 'rada', style: 'margin-bottom:10px' },
      el('button', { type: 'button', onclick: () => { S.vybrany = null; vykresliObjekty(); vykresliStrukturu(); } }, '📜 Celé schéma')));
    if (!ob) {
      k.append(el('h2', { text: 'Celé schéma (' + S.schema.objekty.length + ' objektů, verze schématu ' + S.schema.verze + ')' }));
      k.append(...blokDdl(S.schema.objekty.filter(o => o.sql).map(o => o.sql + ';').join('\n\n')));
      return;
    }
    const t = S.schema.tabulky.find(x => x.nazev === ob.nazev);
    k.append(el('h2', { text: ({ table: 'Tabulka', view: 'Pohled', index: 'Index', trigger: 'Trigger' })[ob.typ] + ' ' + ob.nazev }));
    if (t) {
      const vl = [t.bezRowid ? 'WITHOUT ROWID' : null, t.strict ? 'STRICT' : null, t.virtualni ? 'virtuální' : null, t.systemova ? 'systémová' : null,
        t.typ === 'table' ? 'klíč pro úpravy: ' + (t.klic.typ === 'rowid' ? t.klic.alias : t.klic.typ === 'pk' ? 'PRIMARY KEY (' + t.klic.sloupce.join(', ') + ')' : 'žádný – ' + t.klic.duvod) : null,
        S.pocty[t.nazev] != null ? fc(S.pocty[t.nazev]) + ' řádků' : null].filter(Boolean);
      k.append(el('p', { class: 'rada' }, vl.map(v => el('span', { class: 'stitek', text: v }))));
      const g = el('div', { class: 'mrizka2' });
      const sl = el('table', { class: 'prehled' }, el('thead', null, el('tr', null, ['#', 'Sloupec', 'Typ', 'NOT NULL', 'Výchozí', 'PK'].map(h => el('th', { text: h })))),
        el('tbody', null, t.sloupce.map(s => el('tr', null,
          el('td', { text: s.cid }), el('td', null, el('b', { text: s.nazev }), s.generovany ? el('span', { class: 'stitek', text: 'generovaný' }) : null, s.skryty ? el('span', { class: 'stitek', text: 'skrytý' }) : null),
          el('td', { class: 'mono', text: s.typ || '–' }), el('td', { text: s.nenull ? 'ano' : '' }), el('td', { class: 'mono', text: s.vychozi == null ? '' : s.vychozi }), el('td', { text: s.pk ? s.pk : '' })))));
      g.append(el('div', null, el('h3', { text: 'Sloupce (' + t.sloupce.length + ')' }), el('div', { class: 'obal-tab' }, sl)));
      const prava = el('div');
      prava.append(el('h3', { text: 'Cizí klíče (' + new Set(t.fk.map(f => f.id)).size + ')' }));
      if (t.fk.length) {
        const h = S.schema.er.hrany.filter(x => x.z === t.nazev);
        prava.append(el('ul', { class: 'napoveda', style: 'padding-left:18px' }, h.map(x => el('li', null, el('code', { text: '(' + x.zSloupce.join(', ') + ') → ' + x.do + '(' + x.doSloupce.join(', ') + ')' }),
          ' ON DELETE ' + x.onDelete + ', ON UPDATE ' + x.onUpdate, x.chybi ? el('b', { style: 'color:var(--danger)', text: ' – cílová tabulka neexistuje!' }) : null))));
      } else prava.append(el('p', { class: 'napoveda', text: 'Žádné deklarované.' }));
      const odkazy = S.schema.er.hrany.filter(x => x.do === t.nazev && x.z !== t.nazev);
      if (odkazy.length) prava.append(el('h3', { text: 'Odkazují sem' }), el('ul', { class: 'napoveda', style: 'padding-left:18px' }, odkazy.map(x => el('li', null, el('code', { text: x.z + '(' + x.zSloupce.join(', ') + ')' })))));
      prava.append(el('h3', { text: 'Indexy (' + t.indexy.length + ')' }));
      if (t.indexy.length) prava.append(el('table', { class: 'prehled' }, el('tbody', null, t.indexy.map(ix => el('tr', null,
        el('td', null, el('b', { text: ix.nazev })), el('td', { class: 'mono', text: ix.sloupce.map(s => (s.nazev == null ? '<výraz>' : s.nazev) + (s.sestupne ? ' DESC' : '')).join(', ') }),
        el('td', { text: [ix.unikatni ? 'UNIQUE' : '', ({ c: 'CREATE INDEX', u: 'z UNIQUE', pk: 'z PRIMARY KEY' })[ix.puvod] || ix.puvod, ix.castecny ? 'částečný' : ''].filter(Boolean).join(', ') }))))));
      else prava.append(el('p', { class: 'napoveda', text: 'Žádné.' }));
      const trig = S.schema.objekty.filter(o => o.typ === 'trigger' && o.tabulka === t.nazev);
      if (trig.length) prava.append(el('h3', { text: 'Triggery' }), el('p', null, trig.map(o => el('button', { type: 'button', class: 'male', onclick: () => vyberObjekt(o.nazev, o.typ) }, '⚙ ' + o.nazev))));
      g.append(prava);
      k.append(g);
    } else if (ob.tabulka) {
      k.append(el('p', null, 'Patří k tabulce ', el('button', { type: 'button', class: 'male', onclick: () => vyberObjekt(ob.tabulka, 'table') }, ob.tabulka)));
    }
    k.append(el('h3', { text: 'DDL' }), ...blokDdl(ob.sql));
  }

  // ======================= ER diagram =======================
  const NS = 'http://www.w3.org/2000/svg';
  function sv(tag, a, ...deti) {
    const e = document.createElementNS(NS, tag);
    for (const k in (a || {})) if (a[k] !== undefined && a[k] !== null) { if (k === 'text') e.textContent = a[k]; else e.setAttribute(k, a[k]); }
    for (const d of deti.flat()) if (d) e.append(d);
    return e;
  }
  const ER = { vb: null, model: null, roz: null, svg: null };
  const RADEK = 20, HLAVA = 28, MAXSL = 40;
  function erModelZobrazeny() {
    const jenKlice = $('erKlice').checked, samostatne = $('erSamostatne').checked;
    const m = S.schema.er;
    const fkSl = new Map();
    for (const h of m.hrany) { if (!fkSl.has(h.z)) fkSl.set(h.z, new Set()); h.zSloupce.forEach(s => fkSl.get(h.z).add(s)); }
    const sVazbou = new Set(m.hrany.flatMap(h => [h.z, h.do]));
    const uzly = m.uzly.filter(u => samostatne || sVazbou.has(u.nazev)).map(u => {
      const fk = fkSl.get(u.nazev) || new Set();
      const cil = new Set(m.hrany.filter(h => h.do === u.nazev).flatMap(h => h.doSloupce));
      let sl = u.sloupce.map(s => Object.assign({}, s, { fk: fk.has(s.nazev) }));
      if (jenKlice) sl = sl.filter(s => s.pk || s.fk || cil.has(s.nazev));
      return { nazev: u.nazev, typ: u.typ, sloupce: sl, vse: u.sloupce.length };
    });
    const jm = new Set(uzly.map(u => u.nazev));
    return { uzly, hrany: m.hrany.filter(h => jm.has(h.z) && jm.has(h.do)) };
  }
  function vykresliEr(znovu) {
    S.erPlatne = true;
    ER.model = erModelZobrazeny();
    const roz = J.erRozlozeni(ER.model, { radek: RADEK, hlava: HLAVA, maxSloupcu: MAXSL, sirka: 220 });
    if (!znovu && S.erPozice) for (const n in roz.pozice) if (S.erPozice[n]) { roz.pozice[n].x = S.erPozice[n].x; roz.pozice[n].y = S.erPozice[n].y; }
    ER.roz = roz;
    // šířka boxu podle nejdelšího textu
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.font = '12px ' + (cssVar('--font') || 'sans-serif');
    for (const u of ER.model.uzly) {
      const p = roz.pozice[u.nazev];
      let w = 0;
      ctx.font = 'bold 13px ' + (cssVar('--font') || 'sans-serif'); w = Math.max(w, ctx.measureText(u.nazev).width + 24);
      ctx.font = '12px ' + (cssVar('--font') || 'sans-serif');
      for (const s of u.sloupce.slice(0, MAXSL)) w = Math.max(w, ctx.measureText(s.nazev).width + ctx.measureText(s.typ || '').width * 0.92 + 56);
      p.w = Math.min(340, Math.max(150, Math.ceil(w)));
      p.h = HLAVA + Math.min(u.sloupce.length, MAXSL) * RADEK + (u.sloupce.length > MAXSL || (u.sloupce.length < u.vse && $('erKlice').checked) ? RADEK : 0) + 6;
    }
    $('erInfo').textContent = ER.model.uzly.length + ' tabulek, ' + ER.model.hrany.length + ' vazeb' + (S.schema.er.hrany.length ? '' : ' – databáze nemá deklarované cizí klíče');
    vykresliErSvg();
    if (znovu || !S.erPozice) erPrizpusob();
  }
  function vykresliErSvg() {
    if (!ER.model) return;
    const obal = $('erObal');
    const svg = sv('svg', { xmlns: NS, role: 'img', 'aria-label': 'ER diagram databáze' });
    const gH = sv('g'), gU = sv('g');
    svg.append(gH, gU);
    ER.gH = gH;
    kresliHrany();
    const poz = ER.roz.pozice;
    for (const u of ER.model.uzly) {
      const p = poz[u.nazev];
      const g = sv('g', { class: 'er-box' + (u.typ === 'chybi' ? ' chybi' : ''), transform: 'translate(' + p.x + ',' + p.y + ')', 'data-n': u.nazev, tabindex: 0 });
      g.append(sv('title', { text: u.nazev + (u.typ === 'chybi' ? ' – tabulka neexistuje (odkazuje na ni cizí klíč)' : '') }));
      g.append(sv('rect', { class: 'telo', width: p.w, height: p.h, rx: 6 }));
      g.append(sv('rect', { class: 'hlava', width: p.w, height: HLAVA, rx: 6 }));
      g.append(sv('rect', { class: 'hlava', y: HLAVA - 6, width: p.w, height: 6 }));
      g.append(sv('text', { class: 'nazev', x: 10, y: 18, text: u.nazev }));
      u.sloupce.slice(0, MAXSL).forEach((s, i) => {
        const y = HLAVA + i * RADEK + 14;
        if (s.pk || s.fk) g.append(sv('text', { class: s.pk ? 'pk' : 'typ', x: 8, y, text: s.pk ? 'PK' : 'FK', style: s.fk && !s.pk ? 'fill:var(--accent);font-weight:700' : null }));
        g.append(sv('text', { x: 32, y, text: s.nazev }));
        g.append(sv('text', { class: 'typ', x: p.w - 8, y, 'text-anchor': 'end', text: (s.typ || '').toLowerCase() }));
      });
      const skryto = u.vse - Math.min(u.sloupce.length, MAXSL);
      if (skryto > 0) g.append(sv('text', { class: 'typ', x: 32, y: HLAVA + Math.min(u.sloupce.length, MAXSL) * RADEK + 14, text: '… a ' + skryto + ' dalších sloupců' }));
      gU.append(g);
    }
    obal.innerHTML = ''; obal.append(svg);
    ER.svg = svg;
    if (ER.vb) nastavVb();
    erInterakce(svg);
  }
  function kresliHrany() {
    const poz = ER.roz.pozice;
    const radekY = (u, sl) => {
      const i = u.sloupce.findIndex(s => s.nazev === sl);
      const p = poz[u.nazev];
      return i < 0 || i >= MAXSL ? p.y + HLAVA / 2 : p.y + HLAVA + i * RADEK + RADEK / 2 + 1;
    };
    const uzelPodle = new Map(ER.model.uzly.map(u => [u.nazev, u]));
    const gH = ER.gH;
    gH.innerHTML = '';
    for (const h of ER.model.hrany) {
      const uc = uzelPodle.get(h.z), up = uzelPodle.get(h.do);
      const c = poz[h.z], p = poz[h.do];
      const y1 = radekY(uc, h.zSloupce[0]), y2 = radekY(up, h.doSloupce[0]);
      let d, x1, x2, s1, s2;
      if (h.sama) {
        x1 = c.x + c.w; x2 = c.x + c.w;
        d = 'M' + x1 + ',' + y1 + ' C' + (x1 + 60) + ',' + y1 + ' ' + (x2 + 60) + ',' + y2 + ' ' + x2 + ',' + y2;
        s1 = 1; s2 = 1;
      } else {
        const vlevo = c.x + c.w / 2 > p.x + p.w / 2;
        x1 = vlevo ? c.x : c.x + c.w; x2 = vlevo ? p.x + p.w : p.x;
        s1 = vlevo ? -1 : 1; s2 = vlevo ? 1 : -1;
        const dx = Math.max(40, Math.abs(x2 - x1) / 2);
        d = 'M' + x1 + ',' + y1 + ' C' + (x1 + s1 * dx) + ',' + y1 + ' ' + (x2 + s2 * dx) + ',' + y2 + ' ' + x2 + ',' + y2;
      }
      // vrana noha (mnoho) u závislé tabulky, čárka (jeden) u odkazované
      const noha = 'M' + (x1 + s1 * 12) + ',' + y1 + ' L' + x1 + ',' + (y1 - 6) + ' M' + (x1 + s1 * 12) + ',' + y1 + ' L' + x1 + ',' + (y1 + 6) + ' M' + (x1 + s1 * 12) + ',' + y1 + ' L' + x1 + ',' + y1;
      const jedna = 'M' + (x2 + s2 * 8) + ',' + (y2 - 6) + ' L' + (x2 + s2 * 8) + ',' + (y2 + 6);
      const tit = h.z + '(' + h.zSloupce.join(', ') + ') → ' + h.do + '(' + h.doSloupce.join(', ') + ')  ON DELETE ' + h.onDelete + ', ON UPDATE ' + h.onUpdate;
      const g = sv('g', { 'data-z': h.z, 'data-do': h.do },
        sv('title', { text: tit }),
        sv('path', { d, class: 'er-hrana' + (h.chybi ? ' chybi' : '') }),
        sv('path', { d: d, stroke: 'transparent', 'stroke-width': 10, fill: 'none' }),
        sv('path', { d: noha + ' ' + jedna, class: 'er-hrana' + (h.chybi ? ' chybi' : '') }));
      gH.append(g);
    }
  }
  function nastavVb() { const v = ER.vb; ER.svg.setAttribute('viewBox', v.x + ' ' + v.y + ' ' + v.w + ' ' + v.h); }
  function erPrizpusob() {
    if (!ER.svg) return;
    const poz = Object.values(ER.roz.pozice);
    if (!poz.length) { ER.vb = { x: 0, y: 0, w: 800, h: 400 }; nastavVb(); return; }
    const x0 = Math.min(...poz.map(p => p.x)) - 30, y0 = Math.min(...poz.map(p => p.y)) - 30;
    const x1 = Math.max(...poz.map(p => p.x + p.w)) + 90, y1 = Math.max(...poz.map(p => p.y + p.h)) + 30;
    const r = ER.svg.getBoundingClientRect();
    const asp = (r.width || 800) / (r.height || 500);
    let w = x1 - x0, h = y1 - y0;
    if (w / h > asp) h = w / asp; else w = h * asp;
    ER.vb = { x: x0 - (w - (x1 - x0)) / 2, y: y0 - (h - (y1 - y0)) / 2, w, h };
    nastavVb();
  }
  function erZoom(f, cx, cy) {
    const v = ER.vb; if (!v) return;
    const nw = Math.min(20000, Math.max(150, v.w * f)), k = nw / v.w;
    cx = cx == null ? v.x + v.w / 2 : cx; cy = cy == null ? v.y + v.h / 2 : cy;
    ER.vb = { x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k, w: nw, h: v.h * k };
    nastavVb();
  }
  function erBod(svg, e) { const r = svg.getBoundingClientRect(), v = ER.vb; return { x: v.x + (e.clientX - r.left) / r.width * v.w, y: v.y + (e.clientY - r.top) / r.height * v.h }; }
  function erInterakce(svg) {
    let tah = null;
    svg.addEventListener('pointerdown', e => {
      const box = e.target.closest('.er-box');
      const b = erBod(svg, e);
      if (box) { const p = ER.roz.pozice[box.dataset.n]; tah = { typ: 'uzel', n: box.dataset.n, dx: b.x - p.x, dy: b.y - p.y }; }
      else tah = { typ: 'pan', x: e.clientX, y: e.clientY, vb: Object.assign({}, ER.vb) };
      svg.setPointerCapture(e.pointerId); svg.classList.add('tahne');
    });
    svg.addEventListener('pointermove', e => {
      if (!tah) return;
      if (tah.typ === 'uzel') {
        const b = erBod(svg, e), p = ER.roz.pozice[tah.n];
        p.x = Math.round(b.x - tah.dx); p.y = Math.round(b.y - tah.dy);
        tah.pohyb = true;
        const box = svg.querySelector('.er-box[data-n="' + CSS.escape(tah.n) + '"]');
        if (box) box.setAttribute('transform', 'translate(' + p.x + ',' + p.y + ')');
        kresliHrany();
      } else {
        const r = svg.getBoundingClientRect();
        ER.vb.x = tah.vb.x - (e.clientX - tah.x) / r.width * tah.vb.w;
        ER.vb.y = tah.vb.y - (e.clientY - tah.y) / r.height * tah.vb.h;
        nastavVb();
      }
    });
    const konec = () => {
      if (tah && tah.typ === 'uzel' && tah.pohyb) {
        S.erPozice = {}; for (const n in ER.roz.pozice) S.erPozice[n] = { x: ER.roz.pozice[n].x, y: ER.roz.pozice[n].y };
        lsSet('er_' + S.info.nazev, S.erPozice);
      }
      tah = null; svg.classList.remove('tahne');
    };
    svg.addEventListener('pointerup', konec); svg.addEventListener('pointercancel', konec);
    svg.addEventListener('wheel', e => { e.preventDefault(); const b = erBod(svg, e); erZoom(e.deltaY > 0 ? 1.15 : 1 / 1.15, b.x, b.y); }, { passive: false });
    // zvýraznění vazeb tabulky
    svg.addEventListener('pointerover', e => {
      const box = e.target.closest('.er-box');
      svg.querySelectorAll('.zvyraznena, .zvyrazneny').forEach(x => x.classList.remove('zvyraznena', 'zvyrazneny'));
      if (!box) return;
      const n = box.dataset.n;
      svg.querySelectorAll('g[data-z]').forEach(g => { if (g.dataset.z === n || g.dataset.do === n) g.querySelectorAll('.er-hrana').forEach(p => p.classList.add('zvyraznena')); });
      box.classList.add('zvyrazneny');
    });
    svg.addEventListener('dblclick', e => { const box = e.target.closest('.er-box'); if (box && S.schema.tabulky.some(t => t.nazev === box.dataset.n)) { vyberObjekt(box.dataset.n, 'table'); prepniZalozku('struktura'); } });
  }
  $('erFit').addEventListener('click', erPrizpusob);
  $('erPlus').addEventListener('click', () => erZoom(1 / 1.25));
  $('erMinus').addEventListener('click', () => erZoom(1.25));
  $('erRozlozit').addEventListener('click', () => { S.erPozice = null; try { localStorage.removeItem(LS + 'er_' + S.info.nazev); } catch (e) { /* nic */ } vykresliEr(true); });
  $('erKlice').addEventListener('change', () => vykresliEr(false));
  $('erSamostatne').addEventListener('change', () => vykresliEr(false));
  $('erSvg').addEventListener('click', () => {
    if (!ER.svg) return;
    const k = ER.svg.cloneNode(true);
    const poz = Object.values(ER.roz.pozice);
    const x0 = Math.min(...poz.map(p => p.x)) - 20, y0 = Math.min(...poz.map(p => p.y)) - 20;
    const w = Math.max(...poz.map(p => p.x + p.w)) + 80 - x0, h = Math.max(...poz.map(p => p.y + p.h)) + 20 - y0;
    k.setAttribute('viewBox', x0 + ' ' + y0 + ' ' + w + ' ' + h); k.setAttribute('width', w); k.setAttribute('height', h);
    const c = n => cssVar(n);
    const styl = document.createElementNS(NS, 'style');
    styl.textContent = `svg{background:${c('--bg-input')};font-family:${c('--font')}}
.er-box rect.telo{fill:${c('--er-box')};stroke:${c('--border-strong')}} .er-box rect.hlava{fill:${c('--er-hlava')}}
.er-box.chybi rect.telo{stroke-dasharray:4 3;stroke:${c('--danger')}} .er-box text{fill:${c('--text')};font-size:12px}
.er-box text.nazev{font-weight:700;font-size:13px} .er-box text.typ{fill:${c('--text-faint')};font-size:11px} .er-box text.pk{fill:${c('--warn')};font-weight:700}
.er-hrana{fill:none;stroke:${c('--er-hrana')};stroke-width:1.6} .er-hrana.chybi{stroke:${c('--danger')};stroke-dasharray:5 4}`;
    k.insertBefore(styl, k.firstChild);
    k.querySelectorAll('[style*="var(--accent)"]').forEach(t => t.setAttribute('style', 'fill:' + c('--accent') + ';font-weight:700'));
    stahni(new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(k)], { type: 'image/svg+xml' }), zakladJmena(S.info.nazev).zaklad + '-er.svg');
  });
  window.addEventListener('resize', () => { if (S.zalozka === 'er' && ER.vb) { const r = ER.svg.getBoundingClientRect(); ER.vb.h = ER.vb.w / ((r.width || 1) / (r.height || 1)); nastavVb(); } });

  // ======================= Statistiky =======================
  async function vykresliStatistiky() {
    S.statPlatne = true;
    const k = $('statObsah'); k.innerHTML = '';
    let st;
    try { st = await volej('statistiky'); } catch (e) { k.append(el('p', { text: e.message })); return; }
    const h = st.info.hlavicka;
    const radky = [
      ['Soubor', st.info.nazev + (st.info.zdroj !== 'soubor' ? ' (' + st.info.zdroj + ', jen v paměti)' : '')],
      st.info.zdroj === 'soubor' ? ['Velikost původního souboru', J.formatBajty(st.info.velikost) + ' (' + fc(st.info.velikost) + ' B)'] : null,
      zdroj && zdroj.otisk ? ['SHA-256 původního souboru', el('code', { class: 'mono', style: 'word-break:break-all', text: zdroj.otisk })] : null,
      ['Velikost databáze v paměti', J.formatBajty(st.velikostStranky * st.pocetStranek) + ' = ' + fc(st.pocetStranek) + ' stránek × ' + fc(st.velikostStranky) + ' B'],
      ['Volné stránky (freelist)', fc(st.freelist) + ' (' + J.formatBajty(st.freelist * st.velikostStranky) + (st.pocetStranek ? ', ' + fc(100 * st.freelist / st.pocetStranek, 1) + ' %' : '') + ')' + (st.freelist > 0 ? ' – uvolní VACUUM' : '')],
      ['Kódování textu', st.kodovani],
      ['Režim žurnálu', st.journal + (h && h.wal ? ' (soubor byl ve WAL, otevřen bez -wal)' : '')],
      ['auto_vacuum', ['NONE', 'FULL', 'INCREMENTAL'][st.autoVacuum] || st.autoVacuum],
      ['user_version / application_id', st.userVersion + ' / ' + st.applicationId + (st.applicationId ? ' (0x' + (st.applicationId >>> 0).toString(16) + ')' : '')],
      ['Verze schématu', st.verzeSchematu],
      h ? ['Naposledy zapsal', 'SQLite ' + h.verzeSqlite + ' (formát schématu ' + h.formatSchematu + ', čítač změn ' + fc(h.citacZmen) + ')'] : null,
      ['Engine v prohlížeči', 'SQLite ' + st.verzeSqlite + ' (sql.js, WebAssembly)'],
      ['Cizí klíče vynucovány', st.ciziKlice ? 'ano' : 'ne']
    ].filter(Boolean);
    const g = el('div', { class: 'mrizka2' });
    g.append(el('div', null, el('h2', { text: 'Databáze' }), el('table', { class: 'prehled' }, el('tbody', null, radky.map(([a, b]) => el('tr', null, el('th', { text: a }), el('td', null, b)))))));
    const kontroly = el('div');
    const vystup = el('ul', { class: 'zpravy' });
    const kontrola = async (typ, popis) => {
      vystup.innerHTML = '';
      try {
        const r = await volej('kontrola', { typ });
        if (typ === 'fk') vystup.append(el('li', { class: r.radky.length ? 'chyba' : '', text: r.radky.length ? popis + ': ' + r.radky.length + ' porušení' : popis + ': bez porušení ✔' }), r.radky.slice(0, 100).map(x => el('li', { class: 'chyba', text: x[0] + ' rowid ' + x[1] + ' → ' + x[2] })));
        else vystup.append(r.radky.map(x => el('li', { class: x[0] === 'ok' ? '' : 'chyba', text: popis + ': ' + x[0] })));
      } catch (e) { vystup.append(el('li', { class: 'chyba', text: e.message })); }
    };
    kontroly.append(el('h2', { text: 'Kontroly a údržba' }),
      el('div', { class: 'rada' },
        el('button', { type: 'button', onclick: () => kontrola('quick', 'quick_check') }, 'Rychlá kontrola'),
        el('button', { type: 'button', onclick: () => kontrola('integrity', 'integrity_check') }, 'Úplná kontrola integrity'),
        el('button', { type: 'button', onclick: () => kontrola('fk', 'foreign_key_check') }, 'Kontrola cizích klíčů'),
        el('button', {
          type: 'button', title: 'Zkompaktuje databázi v paměti (projeví se v exportu)', onclick: async () => {
            if (!(await zajistiBezTransakce('VACUUM'))) return;
            const r = await volej('dotaz', { sql: 'VACUUM' }).catch(e => ({ chyba: e.message }));
            if (r.chyba) Dialog.chyba(r.chyba); else { aktualizujStav(r.stav); Dialog.info('VACUUM hotov – změna se projeví v exportu.'); vykresliStatistiky(); }
          }
        }, '🧹 VACUUM')),
      vystup,
      el('p', { class: 'napoveda', text: 'Kontroly jen čtou. VACUUM přestaví databázi v paměti (původní soubor se nemění).' }));
    g.append(kontroly);
    k.append(g);
    // velikosti
    const vel = el('div');
    k.append(el('h2', { style: 'margin-top:16px', text: 'Velikosti tabulek a indexů' }), vel);
    const spocitej = async () => {
      vel.innerHTML = '';
      try {
        const v = await volej('velikosti');
        vykresliVelikosti(vel, v, st);
      } catch (e) {
        vel.append(el('p', { class: 'napoveda', style: 'color:var(--warn)', text: e.message }), el('button', { type: 'button', onclick: async () => { if (await zajistiBezTransakce('Výpočet velikostí')) spocitej(); } }, 'Potvrdit transakci a spočítat'));
      }
    };
    spocitej();
    k.append(el('details', { style: 'margin-top:14px' }, el('summary', { text: 'Volby překladu SQLite (' + st.volby.length + ')' }), el('p', { class: 'mono napoveda', text: st.volby.join(' · ') })));
  }
  function vykresliVelikosti(k, v, st) {
    const obj = v.objekty.filter(o => o.stranky > 0 || o.root);
    const celkB = (v.celkem || st.pocetStranek) * (v.velikostStranky || st.velikostStranky);
    obj.sort((a, b) => b.stranky - a.stranky);
    const max = Math.max(1, ...obj.map(o => o.stranky));
    k.append(el('p', { class: 'napoveda', text: v.metoda === 'dbstat'
      ? 'Zdroj: virtuální tabulka dbstat.'
      : 'Tento build sql.js neobsahuje virtuální tabulku dbstat. Velikosti jsou proto spočítané vlastním průchodem B-stromů obrazu databáze (podle specifikace formátu souboru): stránky listů, vnitřní stránky i stránky přetečení. Je to přesné na stránku, stejně jako dbstat.' }));
    const tb = el('table', { class: 'prehled' },
      el('thead', null, el('tr', null, ['Objekt', 'Typ', 'Stránek', 'Velikost', '', 'Podíl', 'Záznamů', 'Ø B/záznam', 'Zaplnění', 'Přetečení'].map((h, i) => el('th', { class: i >= 2 && i !== 4 ? 'cislo' : '', text: h })))),
      el('tbody', null, obj.map(o => el('tr', null,
        el('td', null, el('b', { text: o.nazev }), o.typ === 'index' && o.tabulka ? el('span', { class: 'napoveda', text: ' (' + o.tabulka + ')' }) : null),
        el('td', { text: ({ table: 'tabulka', index: 'index' })[o.typ] || o.typ }),
        el('td', { class: 'cislo', text: fc(o.stranky) }),
        el('td', { class: 'cislo', text: J.formatBajty(o.bajty) }),
        el('td', { style: 'width:120px' }, el('div', { class: 'pruh' + (o.typ === 'index' ? ' idx' : ''), style: 'width:' + (100 * o.stranky / max).toFixed(1) + '%' })),
        el('td', { class: 'cislo', text: fc(100 * o.bajty / celkB, 1) + ' %' }),
        el('td', { class: 'cislo', text: fc(o.bunky) }),
        el('td', { class: 'cislo', text: o.bunky ? fc(o.payload / o.bunky, 1) : '–' }),
        el('td', { class: 'cislo', text: o.bajty ? fc(100 * (1 - o.nevyuzito / o.bajty), 0) + ' %' : '–' }),
        el('td', { class: 'cislo', text: o.preteceni ? fc(o.preteceni) : '' })))));
    k.append(el('div', { class: 'obal-tab' }, tb));
    if (v.metoda === 'btree') {
      // součty po tabulkách (tabulka + její indexy)
      const sk = new Map();
      for (const o of v.objekty) { const t = o.tabulka || o.nazev; sk.set(t, (sk.get(t) || 0) + o.bajty); }
      const top = [...sk.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
      k.append(el('h3', { text: 'Tabulka včetně indexů' }), el('table', { class: 'prehled' }, el('tbody', null, top.map(([t, b]) => el('tr', null, el('td', { text: t }), el('td', { class: 'cislo', text: J.formatBajty(b) }), el('td', { class: 'cislo', text: fc(100 * b / celkB, 1) + ' %' }))))));
      k.append(el('p', { class: 'napoveda', text: 'Celkem ' + fc(v.celkem) + ' stránek: ' + fc(v.freelist) + ' volných (freelist)' + (v.ostatni ? ', ' + fc(v.ostatni) + ' ostatních (pointer map / zamykací stránka)' : '') + '. ' + (v.chyby.length ? 'Nalezené nesrovnalosti: ' + v.chyby.slice(0, 5).join('; ') : 'Struktura B-stromů bez nesrovnalostí.') }));
    }
  }

  // ======================= Start =======================
  startWorker();
})();

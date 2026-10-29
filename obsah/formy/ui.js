/* Formy na odlévání – ovládání stránky: formulář, historie, načtení modelu, stavba přes manifold, náhled, výsledky, export. */
/* global FORMY, FORMY_GEO, FORMY_NAHLED, KRAB, Dialog, Tvary, TrubkyGui */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const KLIC = 'webapp_formy_projekt';
  const fmt = FORMY.fmt;

  /* ---------- manifold ---------- */
  function nactiSkript(src) {
    return new Promise((ok, chyba) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => chyba(new Error('nelze načíst ' + src)); document.head.appendChild(s); });
  }
  async function nactiManifold() {
    globalThis.MANIFOLD_URL = new URL('lib/manifold/manifold.klasicky.js', location.href).href;
    if (!globalThis.ManifoldModule) await nactiSkript('lib/manifold/manifold.klasicky.js');
    const w = await globalThis.ManifoldModule({ locateFile: f => new URL('lib/manifold/' + f, location.href).href });
    w.setup();
    return w;
  }

  /* ---------- úložiště modelu (IndexedDB – síť bývá velká) ---------- */
  const IDB = {
    otevri() { return new Promise((ok, ch) => { const r = indexedDB.open('webapp_formy', 1); r.onupgradeneeded = () => r.result.createObjectStore('modely'); r.onsuccess = () => ok(r.result); r.onerror = () => ch(r.error); }); },
    async uloz(z) { try { const db = await this.otevri(); db.transaction('modely', 'readwrite').objectStore('modely').put(z, 'posledni'); } catch (e) { /* bez úložiště */ } },
    async nacti() {
      try { const db = await this.otevri(); return await new Promise(ok => { const r = db.transaction('modely').objectStore('modely').get('posledni'); r.onsuccess = () => ok(r.result || null); r.onerror = () => ok(null); }); }
      catch (e) { return null; }
    },
  };

  /* ---------- stav a historie ---------- */
  let p, w = null, vysledek = null, priprava = null, souborModel = null;   // souborModel = {nazev, sit, kroky, format}
  const ukazky = new Map();
  const zpet = [], znovu = [];
  function nactiUlozeny() {
    try { const t = localStorage.getItem(KLIC); if (t) return FORMY.normalizuj(JSON.parse(t)).p; } catch (e) { /* poškozeno */ }
    return FORMY.normalizuj({}).p;
  }
  function uloz() { try { localStorage.setItem(KLIC, JSON.stringify(p)); } catch (e) { /* plné úložiště */ } }
  function zmen(fn, slouceni) {
    const pred = JSON.stringify(p);
    fn(p);
    p = FORMY.normalizuj(p).p;
    if (JSON.stringify(p) === pred) return;
    const posl = zpet[zpet.length - 1];
    if (!(slouceni && posl && posl.klic === slouceni && Date.now() - posl.cas < 1200)) zpet.push({ stav: pred, klic: slouceni, cas: Date.now() });
    else posl.cas = Date.now();
    if (zpet.length > 100) zpet.shift();
    znovu.length = 0;
    po();
  }
  function krokHistorie(z, do_) {
    if (!z.length) return;
    do_.push({ stav: JSON.stringify(p), cas: 0 });
    p = FORMY.normalizuj(JSON.parse(z.pop().stav)).p;
    naplnFormular(); po();
  }
  function po() { $('btnZpet').disabled = !zpet.length; $('btnZnovu').disabled = !znovu.length; uloz(); naplnFormular(); naplanuj(); }

  /* ---------- formulář ---------- */
  $('f_zdroj').innerHTML = Object.entries(FORMY.UKAZKY).map(([k, n]) => `<option value="${k}">Ukázka: ${n}</option>`).join('') + '<option value="soubor">Vlastní model (STL / 3MF)</option>';
  $('f_material').innerHTML = Object.entries(FORMY.MATERIALY).map(([k, m]) => `<option value="${k}">${m.nazev} – ${fmt(m.hustota, 2)} g/cm³</option>`).join('');
  $('f_tMat').innerHTML = Object.entries(FORMY.TISK_MATERIALY).map(([k, m]) => `<option value="${k}">${m.nazev}</option>`).join('');
  const pole = [...document.querySelectorAll('[data-p]')];
  function naplnFormular() {
    for (const el of pole) {
      let h = FORMY.vezmi(p, el.dataset.p);
      if (el.id === 'f_rovina' && p.rovina.rezim !== 'rucne' && priprava) h = Math.round((priprava.h - priprava.bbox[2]) * 100) / 100;
      if (el.type === 'checkbox') el.checked = !!h;
      else if (document.activeElement !== el) el.value = el.dataset.typ === 'text' ? (h ?? '') : String(h).replace('.', ',');
      el.classList.remove('spatne');
    }
    $('f_rovina').disabled = p.rovina.rezim === 'rucne' ? false : true;
    $('gRozmer').hidden = p.model.zdroj === 'soubor';
    document.querySelectorAll('[data-rezimy]').forEach(d => { d.hidden = !d.dataset.rezimy.split(' ').includes(p.rezim); });
    document.querySelectorAll('#rezimy [data-rezim]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.rezim === p.rezim)));
    $('dRovina').hidden = p.rezim === 'box';
    $('nRovina').textContent = p.rezim === 'otevrena' ? 'Hladina (zanoření)' : 'Dělicí rovina';
    const m = FORMY.MATERIALY[p.material];
    $('materialPozn').textContent = m.pozn ? m.nazev + ': ' + m.pozn + '.' : '';
    $('souborInfo').textContent = souborModel ? `${souborModel.nazev} – ${souborModel.format}, ${(souborModel.sit.idx.length / 3).toLocaleString('cs-CZ')} trojúhelníků` : (p.model.zdroj === 'soubor' ? 'Žádný model – nahrajte STL nebo 3MF.' : '');
    souhrny();
  }
  function souhrny() {
    const S = TrubkyGui.souhrn;
    S('sModel', p.model.zdroj === 'soubor' ? (souborModel ? souborModel.nazev : 'chybí') : FORMY.UKAZKY[p.model.zdroj] + ' ' + fmt(p.model.rozmer) + ' mm', true);
    S('sRezim', FORMY.REZIMY[p.rezim], true);
    S('sRovina', priprava ? fmt(priprava.h - priprava.bbox[2], 1) + ' mm' : '', true);
    S('sForma', `${p.forma.tvar === 'kvadr' ? 'kvádr' : 'obrys'}, ${fmt(p.forma.stena)} mm`, true);
    S('sZamky', p.zamky.pocet ? `${p.zamky.pocet} × Ø ${fmt(p.zamky.prumer)}, vůle ${fmt(p.zamky.vule, 2)}` : 'bez', !!p.zamky.pocet);
    S('sVtok', `Ø ${fmt(p.vtok.prumer)} + ${p.vzduch.pocet} odvzd.`, true);
    S('sSrouby', p.srouby.pocet ? `${p.srouby.pocet} × M${fmt(p.srouby.prumer)}` : 'bez', !!p.srouby.pocet);
    S('sBox', `odstup ${fmt(p.box.odstup)} mm`, true);
    S('sOtevrena', `${p.otevrena.nx} × ${p.otevrena.ny} dutin`, true);
  }
  for (const el of pole) {
    const akce = () => {
      const c = el.dataset.p;
      let h;
      if (el.type === 'checkbox') h = el.checked;
      else if (el.dataset.typ === 'text') h = el.value;
      else {
        h = FORMY.cislo(el.value, NaN);
        el.classList.toggle('spatne', !Number.isFinite(h));
        if (!Number.isFinite(h)) return;
      }
      zmen(x => {
        FORMY.poloz(x, c, h);
        // přepnutí na ruční rovinu převezme navrženou výšku
        if (c === 'rovina.rezim' && h === 'rucne' && priprava) x.rovina.vyska = Math.round((priprava.h - priprava.bbox[2]) * 10) / 10;
      }, c);
    };
    el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', akce);
    if (el.tagName === 'INPUT' && el.type !== 'checkbox' && el.dataset.typ !== 'text') {
      el.addEventListener('change', () => {
        const psano = FORMY.cislo(el.value, NaN), h = FORMY.vezmi(p, el.dataset.p), r = FORMY.ROZSAHY[el.dataset.p];
        el.value = String(h).replace('.', ',');
        if (r && Number.isFinite(psano) && Math.abs(psano - h) > 1e-9) {
          el.classList.remove('zvyrazni'); void el.offsetWidth; el.classList.add('zvyrazni');
          Dialog.info(`${el.labels[0] ? el.labels[0].textContent : 'Hodnota'}: povoleno ${fmt(r[0], 2)}–${fmt(r[1], 2)}, použito ${fmt(h, 2)}.`);
        }
      });
      el.addEventListener('keydown', e => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        const h = FORMY.cislo(el.value, NaN); if (!Number.isFinite(h)) return;
        e.preventDefault();
        const krok = (e.shiftKey ? 10 : e.altKey ? 0.1 : 1) * (e.key === 'ArrowUp' ? 1 : -1);
        el.value = fmt(Math.round((h + krok) * 1000) / 1000, 3);
        el.dispatchEvent(new Event('input'));
      });
    }
  }
  // přepnutí na ruční rovinu převezme navrženou výšku
  $('f_rovRezim').addEventListener('change', () => {
    if (p.rovina.rezim === 'rucne' && priprava) zmen(x => { x.rovina.vyska = Math.round((priprava.h - priprava.bbox[2]) * 10) / 10; });
  }, true);
  document.querySelectorAll('#rezimy [data-rezim]').forEach(b => b.addEventListener('click', () => zmen(x => { x.rezim = b.dataset.rezim; })));

  /* ---------- načtení modelu ---------- */
  async function nactiModelSoubor(f) {
    const st = $('stav3d'); st.textContent = `Načítám ${f.name}…`; st.classList.remove('chyba');
    try {
      const buf = await f.arrayBuffer();
      const surova = /\.3mf$/i.test(f.name) ? await FORMY.nacti3mf(buf) : FORMY.nactiStl(buf);
      if (!(surova.idx ? surova.idx.length : surova.poz.length / 3)) throw new Error('Soubor neobsahuje žádné trojúhelníky.');
      const r = FORMY.pripravSit(surova);
      souborModel = { nazev: f.name, sit: r.sit, kroky: r.kroky, format: surova.format };
      IDB.uloz({ nazev: f.name, format: surova.format, poz: r.sit.poz, idx: r.sit.idx, kroky: r.kroky });
      if (p.model.zdroj !== 'soubor') zmen(x => { x.model.zdroj = 'soubor'; x.model.meritko = 100; }); else { naplnFormular(); naplanuj(); }
      if (!r.tesnost.uzavrena) Dialog.chyba(`Model „${f.name}“ není uzavřený ani po opravě (${r.tesnost.okraj} okrajových a ${r.tesnost.nevar} nevarietních hran). Forma z něj nepůjde postavit – opravte ho ve sliceru (PrusaSlicer: Opravit model) nebo v Meshmixeru.`);
    } catch (e) { st.textContent = 'Model se nenačetl: ' + e.message; st.classList.add('chyba'); Dialog.chyba('Model se nenačetl: ' + e.message); }
  }
  $('btnModel').addEventListener('click', () => $('souborModel').click());
  $('btnModel2').addEventListener('click', () => $('souborModel').click());
  $('souborModel').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) nactiModelSoubor(f); });
  const cc = $('canvas-container');
  cc.addEventListener('dragover', e => { e.preventDefault(); cc.classList.add('pretahni'); });
  cc.addEventListener('dragleave', () => cc.classList.remove('pretahni'));
  cc.addEventListener('drop', e => {
    e.preventDefault(); cc.classList.remove('pretahni');
    const f = [...e.dataTransfer.files].find(x => /\.(stl|3mf)$/i.test(x.name));
    if (f) nactiModelSoubor(f); else Dialog.chyba('Přetáhněte soubor .stl nebo .3mf.');
  });

  function zdrojovaSit() {
    if (p.model.zdroj === 'soubor') return souborModel ? souborModel.sit : null;
    const k = p.model.zdroj + '|' + p.model.rozmer;
    if (!ukazky.has(k)) { if (ukazky.size > 6) ukazky.clear(); ukazky.set(k, FORMY_GEO.ukazka(w, p.model.zdroj, p.model.rozmer)); }
    return ukazky.get(k);
  }

  /* ---------- stavba ---------- */
  const nahled = FORMY_NAHLED.vytvorNahled($('platno'));
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  let casovac = 0;
  function naplanuj() { clearTimeout(casovac); casovac = setTimeout(prepocitej, 180); }
  const BARVY_STAVU = [[0.25, 0.68, 0.35], [0.88, 0.63, 0.19], [0.85, 0.25, 0.23], [0.6, 0.63, 0.66]];
  function prepocitej() {
    nahled.barvy(css('--border-strong'), css('--border'), css('--text'));
    const st = $('stav3d');
    if (!w) return;
    let chyba = null;
    priprava = null; vysledek = null;
    try {
      const src = zdrojovaSit();
      if (!src) throw new Error('Nahrajte model STL nebo 3MF (Soubor → Nahrát model, nebo přetáhněte do náhledu).');
      priprava = FORMY.priprava(p, src);
      vysledek = FORMY_GEO.postav(w, p, priprava.dutina, priprava.h);
    } catch (e) { chyba = e.message || String(e); }
    st.textContent = chyba || ''; st.classList.toggle('chyba', !!chyba);
    const info = vysledek ? Object.assign({}, vysledek.info, {
      podkosy: priprava.podkosy, trojuhelniku: priprava.dutina.idx.length / 3,
      opravy: p.model.zdroj === 'soubor' && souborModel ? souborModel.kroky : null,
    }) : { chyba };
    if (vysledek) {
      const nT = priprava.dutina.idx.length / 3, bp = new Float32Array(3 * nT), bz = new Float32Array(3 * nT);
      const s = priprava.podkosy.stav;
      for (let t = 0; t < nT; t++) { const c = BARVY_STAVU[s[t]]; bp.set(c, 3 * t); bz.set([0.79, 0.64, 0.15], 3 * t); }
      nahled.nastav({ dily: vysledek.dily, tiskDily: FORMY_GEO.tiskoveRozlozeni(vysledek.dily), dutina: priprava.dutina, barvyPloch: p.rezim === 'box' ? null : bp, barvyZaklad: bz,
        kopie: vysledek.info.kopie, rovina: p.rezim === 'box' ? { box: vysledek.info.box } : { h: vysledek.info.h } });
    } else nahled.nastav({ chyba });
    $('legenda').hidden = !vysledek || p.rezim === 'box' || !nahled.stav.podkosy || nahled.stav.tisk;
    naplnFormular();
    vypis(FORMY.kontroly(p, info));
    vypisVysledky();
    exportMenu();
  }

  /* ---------- výsledky ---------- */
  const dlazdice = (popis, cislo, dalsi) => `<div class="dlazdice"><div class="popis">${popis}</div><div class="cislo">${cislo}</div>${dalsi ? `<div class="dalsi">${dalsi}</div>` : ''}</div>`;
  const ml = v => fmt(v / 1000, v < 10000 ? 1 : 0) + ' ml';
  function vypisVysledky() {
    if (!vysledek) { $('vysledky').innerHTML = ''; $('vMaterial').innerHTML = ''; $('tabDily').innerHTML = ''; TrubkyGui.souhrn('sDily', ''); return; }
    const i = vysledek.info, b = priprava.bbox, mat = FORMY.MATERIALY[p.material], out = [], om = [];
    const tisk = vysledek.dily.reduce((s, d) => { const o = FORMY.odhadTisku(d.objem, d.plocha, p.tisk); s.g += o.g; s.h += o.hodin; return s; }, { g: 0, h: 0 });
    const vse = vysledek.dily.map(d => d.bbox).reduce((a, c) => [Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.min(a[2], c[2]), Math.max(a[3], c[3]), Math.max(a[4], c[4]), Math.max(a[5], c[5])]);
    out.push(dlazdice('Model (dutina)', `${fmt(b[3] - b[0])} × ${fmt(b[4] - b[1])} × ${fmt(b[5] - b[2])} mm`, `objem ${ml(i.objemDutiny)}${p.smrsteni ? ` · zvětšeno o ${fmt(p.smrsteni, 2)} %` : ''}`));
    out.push(dlazdice(p.rezim === 'box' ? 'Box celkem' : 'Forma celkem', `${fmt(vse[3] - vse[0])} × ${fmt(vse[4] - vse[1])} × ${fmt(vse[5] - vse[2])} mm`, `${vysledek.dily.length} ${vysledek.dily.length === 1 ? 'díl' : 'díly'}`));
    out.push(dlazdice('Tisk (hrubě)', `${fmt(tisk.g, 0)} g ${FORMY.TISK_MATERIALY[p.tisk.material].nazev}`, `≈ ${fmt(tisk.h, 1)} h při výplni ${fmt(p.tisk.vypln, 0)} %`));
    if (p.rezim !== 'box') {
      const pk = priprava.podkosy;
      out.push(dlazdice(p.rezim === 'otevrena' ? 'Hladina' : 'Dělicí rovina', `${fmt(i.h - b[2], 1)} mm od spodku`, `průřez ${fmt(FORMY.prurez(priprava.dutina, i.h) / 100, 1)} cm²`));
      out.push(dlazdice('Podkosy', `<span class="${pk.aPodkos > 0.002 * pk.plocha ? 'chyba-t' : 'ok-t'}">${fmt(pk.plocha ? 100 * pk.aPodkos / pk.plocha : 0, 1)} %</span>`, `malý úkos ${fmt(pk.plocha ? 100 * pk.aMaly / pk.plocha : 0, 0)} % plochy`));
    }
    if (p.rezim === 'dvoudilna') out.push(dlazdice('Zámky / šrouby / odvzd.', `${i.zamky.length} / ${i.srouby.length} / ${i.vzduch.length}`, `vtok Ø ${fmt(p.vtok.prumer)} mm, výška horního dílu ${fmt(i.vyskaHorni)} mm`));
    if (p.rezim === 'box') out.push(dlazdice('Lázeň silikonu', `${fmt(i.box.L)} × ${fmt(i.box.W)} mm`, `hladina ${fmt(i.box.fill - i.box.zPl)} mm nad osazením`));
    $('vysledky').innerHTML = out.join('');

    // spotřeba
    const V = p.rezim === 'box' ? i.objemSilikonu : i.objemOdlitku;
    const matKlic = p.rezim === 'box' && !/^silikon/.test(p.material) ? 'silikon' : p.material;
    const sp = FORMY.spotreba(V, matKlic, p.rezerva);
    om.push(dlazdice(p.rezim === 'box' ? 'Silikon na formu' : 'Odlitek' + (p.rezim === 'otevrena' && i.kopie.length > 1 ? ` (${i.kopie.length} ks)` : ''), `${fmt(sp.ml, 1)} ml`, `${fmt(sp.g, 0)} g · s rezervou ${fmt(sp.gR, 0)} g (${fmt(sp.mlR, 0)} ml)`));
    if (sp.slozky) om.push(dlazdice('Namíchat', sp.slozky.map(s => `${fmt(s.g, 0)} g`).join(' + '), sp.slozky.map(s => s.nazev).join(' + ') + ` (${FORMY.MATERIALY[matKlic].pomer.join(' : ')})`));
    if (p.rezim === 'dvoudilna') om.push(dlazdice('Z toho vtok a kanálky', ml(i.objemKanalu), 'materiál navíc, po ztuhnutí odříznout'));
    if (p.rezim === 'box') om.push(dlazdice('Odlitek ze silikonové formy', ml(i.objemOdlitku), 'objem jednoho kusu (dutina silikonu)'));
    $('vMaterial').innerHTML = om.join('');

    // díly
    const rad = vysledek.dily.map((d, k) => {
      const o = FORMY.odhadTisku(d.objem, d.plocha, p.tisk), bb = d.bbox;
      return `<tr><td><span class="tecka" style="background:${d.barva}"></span>${d.nazev}</td><td class="ks">${fmt(bb[3] - bb[0], 0)} × ${fmt(bb[4] - bb[1], 0)} × ${fmt(bb[5] - bb[2], 0)}</td>
        <td class="ks">${fmt(o.g, 0)} g</td><td class="ks">${fmt(o.hodin, 1)} h</td><td class="ks"><button class="tl" type="button" data-stl="${k}">⬇ STL</button></td></tr>`;
    }).join('');
    $('tabDily').innerHTML = `<table class="tabulka"><thead><tr><th>Díl</th><th class="ks">mm</th><th class="ks">filament</th><th class="ks">čas</th><th></th></tr></thead><tbody>${rad}</tbody></table>
      <p class="napoveda">${p.rezim === 'dvoudilna' ? 'Horní díl se tiskne převrácený dělicí plochou dolů, dolní dnem dolů s čepy nahoru.' : 'Díly se tisknou dnem dolů, jak jsou v náhledu.'}</p>`;
    $('tabDily').querySelectorAll('[data-stl]').forEach(bt => bt.addEventListener('click', () => exportDil(+bt.dataset.stl)));
    TrubkyGui.souhrn('sDily', String(vysledek.dily.length));
  }
  function vypis(H) {
    const ul = $('hlaseni'); ul.innerHTML = '';
    for (const x of H) {
      const li = document.createElement('li'); li.className = x.typ; li.textContent = x.text;
      if (x.pole && $(x.pole)) {
        li.classList.add('skok'); li.tabIndex = 0;
        const kam = document.createElement('span'); kam.className = 'kam'; kam.textContent = '→ ' + ($(x.pole).labels[0] ? $(x.pole).labels[0].textContent : 'pole');
        li.appendChild(kam);
        const jdi = () => skokNaPole(x.pole);
        li.addEventListener('click', jdi); li.addEventListener('keydown', e => { if (e.key === 'Enter') jdi(); });
      }
      ul.appendChild(li);
    }
    const ch = H.filter(x => x.typ === 'chyba').length, va = H.filter(x => x.typ === 'varovani').length;
    const od = $('stavOdznak');
    od.className = 'odznak ' + (ch ? 'chyba' : va ? 'mez' : 'ok');
    od.textContent = ch ? `✖ ${ch} ${ch === 1 ? 'chyba' : 'chyby'}` : va ? `⚠ ${va} upozornění` : '✔ v pořádku';
    TrubkyGui.souhrn('sKontrola', ch ? `${ch}✖` : va ? `${va}⚠` : '✔');
    TrubkyGui.oznacChybu('boxForma', ch > 0);
  }
  function skokNaPole(id) {
    const el = $(id), box = el.closest('[data-box]');
    if (box) TrubkyGui.ukazBox(box.dataset.box);
    const d = el.closest('details'); if (d) d.open = true;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.focus({ preventScroll: true });
    el.classList.remove('zvyrazni'); void el.offsetWidth; el.classList.add('zvyrazni');
  }

  /* ---------- export ---------- */
  const jmenoSouboru = pripona => ((p.nazev || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/^_|_$/g, '') || 'forma') + pripona;
  function stahni(data, nazev, typ) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type: typ }));
    a.download = nazev; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  const lzeExport = () => { if (!vysledek) { Dialog.chyba('Forma není sestavená: ' + ($('stav3d').textContent || 'chybí model')); return false; } return true; };
  const tiskove = () => FORMY_GEO.tiskoveRozlozeni(vysledek.dily);
  function exportStl() { if (lzeExport()) stahni(KRAB.stlBinarni(tiskove(), 'formy - github_site'), jmenoSouboru('.stl'), 'model/stl'); }
  function exportDil(k) {
    if (!lzeExport()) return;
    const d = FORMY_GEO.tiskoveRozlozeni([vysledek.dily[k]]);
    stahni(KRAB.stlBinarni(d, 'formy - ' + d[0].jmeno), jmenoSouboru('_' + d[0].jmeno + '.stl'), 'model/stl');
  }
  function exportMenu() {
    const el = $('exportDilu'); el.innerHTML = '';
    if (!vysledek) return;
    vysledek.dily.forEach((d, k) => {
      const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
      b.innerHTML = `⬇ ${d.nazev} <span class="pozn">STL</span>`; b.addEventListener('click', () => exportDil(k)); el.appendChild(b);
    });
  }
  $('btnStl').addEventListener('click', exportStl);
  $('btn3mf').addEventListener('click', () => { if (lzeExport()) stahni(KRAB.soubor3mf(tiskove(), p.nazev || 'Forma'), jmenoSouboru('.3mf'), 'model/3mf'); });
  $('btnPng').addEventListener('click', () => { fetch(nahled.png()).then(r => r.blob()).then(b => stahni(b, jmenoSouboru('.png'))); });

  /* ---------- projekt ---------- */
  $('btnUlozit').addEventListener('click', () => stahni(FORMY.ulozProjekt(p, souborModel && souborModel.sit, souborModel && souborModel.nazev), jmenoSouboru('.json'), 'application/json'));
  $('btnNacist').addEventListener('click', () => $('soubor').click());
  $('soubor').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try {
      const r = FORMY.nactiProjekt(await f.text());
      if (r.model) {
        const s = FORMY.pripravSit(r.model.sit);
        souborModel = { nazev: r.model.nazev, sit: s.sit, kroky: s.kroky, format: 'z projektu' };
        IDB.uloz({ nazev: r.model.nazev, format: 'z projektu', poz: s.sit.poz, idx: s.sit.idx, kroky: s.kroky });
      }
      zmen(x => { Object.keys(x).forEach(k => delete x[k]); Object.assign(x, r.p); });
      naplanuj();
      Dialog.info(r.hlaseni.length ? 'Projekt načten, upraveno: ' + r.hlaseni.join('; ') + '.' : 'Projekt načten.');
    } catch (err) { Dialog.chyba(err.message); }
  });
  $('btnVychozi').addEventListener('click', async () => {
    if (!await Dialog.potvrd('Vrátit všechny parametry na výchozí hodnoty?')) return;
    zmen(x => { Object.keys(x).forEach(k => delete x[k]); Object.assign(x, FORMY.normalizuj({}).p); });
  });

  /* ---------- lišta, nabídky, klávesy ---------- */
  TrubkyGui.pripoj({ klic: 'webapp_formy_gui', pohled: j => nahled.pohled(j) });
  for (const v of FORMY.PREDVOLBY) {
    const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
    b.innerHTML = `${v.nazev}<span class="pozn">${v.popis}</span>`;
    b.addEventListener('click', () => zmen(x => {
      const n = FORMY.normalizuj({}).p, nazev = x.nazev;
      const slij = (c, z) => { for (const k of Object.keys(z)) { if (z[k] && typeof z[k] === 'object') slij(c[k], z[k]); else c[k] = z[k]; } };
      slij(n, v.p); Object.keys(x).forEach(k => delete x[k]); Object.assign(x, n, { nazev: nazev === 'Forma' ? v.nazev : nazev });
    }));
    $('seznamPredvoleb').appendChild(b);
  }
  $('btnZpet').addEventListener('click', () => krokHistorie(zpet, znovu));
  $('btnZnovu').addEventListener('click', () => krokHistorie(znovu, zpet));
  function prepinac(id, co) {
    $(id).addEventListener('click', () => {
      const h = $(id).getAttribute('aria-pressed') !== 'true';
      $(id).setAttribute('aria-pressed', String(h)); nahled.prepni(co, h);
      $('legenda').hidden = !vysledek || p.rezim === 'box' || !nahled.stav.podkosy || nahled.stav.tisk;
    });
  }
  prepinac('tPruhledna', 'pruhledna'); prepinac('tPodkosy', 'podkosy'); prepinac('tRovina', 'rovina'); prepinac('tHrany', 'hrany'); prepinac('tTisk', 'tisk');
  $('rRozlozit').addEventListener('input', e => { $('oRozlozit').textContent = e.target.value + ' mm'; nahled.prepni('rozlozit', +e.target.value); });
  $('stavOdznak').addEventListener('click', () => TrubkyGui.otevriZalozku('kontrola'));
  $('btnZavritNap').addEventListener('click', () => $('napoveda').close());
  document.addEventListener('keydown', e => {
    const a = document.activeElement;
    const vPoli = a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || (a.tagName === 'INPUT' && !/checkbox|range|radio|button/.test(a.type));
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && !vPoli && k === 'z') { e.preventDefault(); krokHistorie(e.shiftKey ? znovu : zpet, e.shiftKey ? zpet : znovu); return; }
    if ((e.ctrlKey || e.metaKey) && !vPoli && k === 'y') { e.preventDefault(); krokHistorie(znovu, zpet); return; }
    if ((e.ctrlKey || e.metaKey) && k === 's') { e.preventDefault(); exportStl(); return; }
    if (e.key === 'F1') { e.preventDefault(); $('napoveda').showModal(); return; }
    if (vPoli || e.ctrlKey || e.metaKey || e.altKey || $('napoveda').open) return;
    const pohledy = { 1: 'iso', 2: 'shora', 3: 'zepredu', 4: 'zboku' };
    if (pohledy[k]) nahled.pohled(pohledy[k]);
    else if (k === 'f') $('tPruhledna').click(); else if (k === 'u') $('tPodkosy').click(); else if (k === 'r') $('tRovina').click();
    else if (k === 'h') $('tHrany').click(); else if (k === 'm') $('tTisk').click();
  });
  new MutationObserver(() => { if (vysledek) nahled.barvy(css('--border-strong'), css('--border'), css('--text')); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  if (typeof Tvary !== 'undefined') Tvary.pripoj({
    klic: 'webapp_formy_tvary', typ: 'formy', nazev: 'Formy', kontejner: $('tvary'),
    parametry: () => FORMY.kopie(p),
    pouzij: q => {
      const r = FORMY.normalizuj(q).p;
      zmen(x => { Object.keys(x).forEach(k => delete x[k]); Object.assign(x, r); });
      if (r.model.zdroj === 'soubor' && !souborModel) Dialog.info('Uložená forma je pro vlastní model – nahrajte jeho STL / 3MF.');
    },
    popis: q => `${q.nazev || 'Forma'} – ${FORMY.REZIMY[q.rezim] || ''}, ${q.model.zdroj === 'soubor' ? 'vlastní model' : (FORMY.UKAZKY[q.model.zdroj] || '') + ' ' + fmt(q.model.rozmer) + ' mm'}`,
  });

  /* ---------- start ---------- */
  p = nactiUlozeny();
  naplnFormular();
  (async () => {
    const z = await IDB.nacti();
    if (z && z.poz && z.idx) souborModel = { nazev: z.nazev, sit: { poz: new Float32Array(z.poz), idx: new Uint32Array(z.idx) }, kroky: z.kroky || [], format: z.format || 'STL' };
    try { w = await nactiManifold(); }
    catch (e) {
      const st = $('stav3d'); st.textContent = 'Geometrické jádro (manifold-3d) se nenačetlo: ' + (e && e.message || e) + ' – forma ani export nejsou k dispozici.'; st.classList.add('chyba');
      vypis([{ typ: 'chyba', text: 'manifold-3d se nenačetl – zkuste stránku obnovit nebo jiný prohlížeč.' }]);
      return;
    }
    $('stav3d').textContent = '';
    prepocitej();
  })();
  window.FORMY_UI = { get p() { return p; }, get vysledek() { return vysledek; }, get priprava() { return priprava; }, get w() { return w; }, nahled, zmen, prepocitej, nactiModelSoubor };
})();

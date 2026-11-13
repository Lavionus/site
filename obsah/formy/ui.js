/* Formy na odlévání – ovládání stránky nad společným zapojením gen3d/aplikace.js:
   tady jen to, co je pro formy zvláštní (nahrání modelu do IndexedDB, režimy, rovina, výsledky, spotřeba, díly). */
/* global FORMY, FORMY_GEO, FORMY_NAHLED, KRAB, G3D, Dialog, TrubkyGui */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const fmt = FORMY.fmt;
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  /* ---------- úložiště modelu (IndexedDB – síť bývá velká) ---------- */
  const IDB = {
    otevri() { return new Promise((ok, ch) => { const r = indexedDB.open('webapp_formy', 1); r.onupgradeneeded = () => r.result.createObjectStore('modely'); r.onsuccess = () => ok(r.result); r.onerror = () => ch(r.error); }); },
    async uloz(z) { try { const db = await this.otevri(); db.transaction('modely', 'readwrite').objectStore('modely').put(z, 'posledni'); } catch (e) { /* bez úložiště */ } },
    async nacti() {
      try { const db = await this.otevri(); return await new Promise(ok => { const r = db.transaction('modely').objectStore('modely').get('posledni'); r.onsuccess = () => ok(r.result || null); r.onerror = () => ok(null); }); }
      catch (e) { return null; }
    },
  };

  /* ---------- stav ---------- */
  let p, w = null, vysledek = null, priprava = null, souborModel = null;   // souborModel = {nazev, sit, kroky, format}
  const ukazky = new Map();
  const nahled = FORMY_NAHLED.vytvorNahled($('platno'));

  $('f_zdroj').innerHTML = Object.entries(FORMY.UKAZKY).map(([k, n]) => `<option value="${k}">Ukázka: ${n}</option>`).join('') + '<option value="soubor">Vlastní model (STL / 3MF)</option>';
  $('f_material').innerHTML = Object.entries(FORMY.MATERIALY).map(([k, m]) => `<option value="${k}">${m.nazev} – ${fmt(m.hustota, 2)} g/cm³</option>`).join('');
  $('f_tMat').innerHTML = Object.entries(FORMY.TISK_MATERIALY).map(([k, m]) => `<option value="${k}">${m.nazev}</option>`).join('');

  // číslo mimo rozsah: po potvrzení ukázat, s čím model počítá (poslouchá dřív než aplikace.js)
  document.querySelectorAll('input[data-p]:not([data-typ])').forEach(el => el.addEventListener('change', () => {
    const psano = G3D.ctiCislo(el.value), r = FORMY.ROZSAHY[el.dataset.p];
    if (!r || !Number.isFinite(psano)) return;
    setTimeout(() => {
      const h = FORMY.vezmi(app.p, el.dataset.p);
      if (Math.abs(psano - h) < 1e-9) return;
      el.classList.remove('zvyrazni'); void el.offsetWidth; el.classList.add('zvyrazni');
      Dialog.info(`${el.labels[0] ? el.labels[0].textContent : 'Hodnota'}: povoleno ${fmt(r[0], 2)}–${fmt(r[1], 2)}, použito ${fmt(h, 2)}.`);
    });
  }));
  // přepnutí na ruční rovinu převezme navrženou výšku (jedním krokem zpět)
  $('f_rovRezim').addEventListener('change', e => {
    if (e.target.value !== 'rucne' || !priprava) return;
    e.stopImmediatePropagation();
    app.zmen(x => { x.rovina.rezim = 'rucne'; x.rovina.vyska = Math.round((priprava.h - priprava.bbox[2]) * 10) / 10; });
    app.naplnFormular();
  });

  const app = G3D.aplikace({
    typ: 'formy', nazev: 'Formy', klic: 'webapp_formy', soubor: 'forma',
    normalizuj: FORMY.normalizuj, vychozi: () => FORMY.normalizuj({}).p, vezmi: FORMY.vezmi, poloz: FORMY.poloz,
    // projekt nese i síť vlastního modelu (base64)
    ulozProjekt: q => FORMY.ulozProjekt(q, souborModel && souborModel.sit, souborModel && souborModel.nazev),
    nactiProjekt: text => {
      const r = FORMY.nactiProjekt(text);
      if (r.model) {
        const s = FORMY.pripravSit(r.model.sit);
        souborModel = { nazev: r.model.nazev, sit: s.sit, kroky: s.kroky, format: 'z projektu' };
        IDB.uloz({ nazev: r.model.nazev, format: 'z projektu', poz: s.sit.poz, idx: s.sit.idx, kroky: s.kroky });
      }
      return r;
    },
    popis: q => `${q.nazev || 'Forma'} – ${FORMY.REZIMY[q.rezim] || ''}, ${q.model.zdroj === 'soubor' ? 'vlastní model' : (FORMY.UKAZKY[q.model.zdroj] || '') + ' ' + fmt(q.model.rozmer) + ' mm'}`,
    viditelnost: () => viditelnost(), poNaplneni: () => rovinaDoPole(),
    prepocitej: () => prepocitej(), zpozdeni: 180,
    png: () => nahled.png(), pohled: j => nahled.pohled(j),
    exportStl: () => exportStl(),
    doModelare: () => (lzeExport() ? { data: KRAB.soubor3mf(tiskove(), app.p.nazev || 'Forma'), pripona: '.3mf' } : null),
    zkratky: { f: 'tPruhledna', u: 'tPodkosy', r: 'tRovina', h: 'tHrany', m: 'tTisk', p: 'tPrevisy', x: 'tRez', l: 'tPravitka' },
    zmenaTematu: () => { if (vysledek) nahled.barvy(css('--border-strong'), css('--border'), css('--text'), css('--bg-panel')); },
  });

  /* ---------- formulář ---------- */
  // automatická rovina: pole ukazuje navrženou výšku
  function rovinaDoPole() {
    if (app.p.rovina.rezim !== 'rucne' && priprava) $('f_rovina').value = String(Math.round((priprava.h - priprava.bbox[2]) * 100) / 100).replace('.', ',');
  }
  function viditelnost() {
    p = app.p;
    $('f_rovina').disabled = p.rovina.rezim !== 'rucne';
    $('gRozmer').hidden = p.model.zdroj === 'soubor';
    document.querySelectorAll('[data-rezimy]').forEach(d => { d.hidden = !d.dataset.rezimy.split(' ').includes(p.rezim); });
    document.querySelectorAll('#rezimy [data-rezim]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.rezim === p.rezim)));
    $('dRovina').hidden = p.rezim === 'box';
    $('nRovina').textContent = p.rezim === 'otevrena' ? 'Hladina (zanoření)' : 'Dělicí rovina';
    const m = FORMY.MATERIALY[p.material];
    $('materialPozn').textContent = m.pozn ? m.nazev + ': ' + m.pozn + '.' : '';
    $('souborInfo').textContent = souborModel ? `${souborModel.nazev} – ${souborModel.format}, ${(souborModel.sit.idx.length / 3).toLocaleString('cs-CZ')} trojúhelníků` : (p.model.zdroj === 'soubor' ? 'Žádný model – nahrajte STL nebo 3MF.' : '');
    // sdílený odkaz nese jen parametry – síť vlastního modelu se do adresy nevejde
    $('poznSdilet').textContent = p.model.zdroj === 'soubor' ? 'jen parametry – vlastní model se nepřenese' : 'celé nastavení v adrese';
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
  document.querySelectorAll('#rezimy [data-rezim]').forEach(b => b.addEventListener('click', () => { app.zmen(x => { x.rezim = b.dataset.rezim; }); app.naplnFormular(); }));

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
      if (app.p.model.zdroj !== 'soubor') { app.zmen(x => { x.model.zdroj = 'soubor'; x.model.meritko = 100; }); app.naplnFormular(); } else { viditelnost(); app.prepocitej(); }
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
  const BARVY_STAVU = [[0.25, 0.68, 0.35], [0.88, 0.63, 0.19], [0.85, 0.25, 0.23], [0.6, 0.63, 0.66]];
  function prepocitej() {
    p = app.p;
    nahled.barvy(css('--border-strong'), css('--border'), css('--text'), css('--bg-panel'));
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
    legendy();
    rovinaDoPole(); souhrny();
    // hlášení jádra {typ, text, pole: id prvku} → společný formát {uroven, text, pole: [cesta]}
    app.hlaseni(FORMY.kontroly(p, info).map(x => ({ uroven: x.typ, text: x.text, pole: x.pole && $(x.pole) ? [$(x.pole).dataset.p] : [] })), { boxy: ['boxForma', 'boxOdlitek'] });
    vypisVysledky();
    exportMenu();
  }
  function legendy() {
    $('legenda').hidden = !vysledek || app.p.rezim === 'box' || !nahled.stav.podkosy || nahled.stav.tisk;
    $('legPrevisy').hidden = !(vysledek && nahled.stav.tisk && nahled.stav.previsy);
    $('legRez').hidden = !nahled.stav.rez;
  }

  /* ---------- výsledky ---------- */
  const dlazdice = G3D.dlazdice;
  const ml = v => fmt(v / 1000, v < 10000 ? 1 : 0) + ' ml';
  function vypisVysledky() {
    if (!vysledek) { $('vysledky').innerHTML = ''; $('vMaterial').innerHTML = ''; $('tabDily').innerHTML = ''; TrubkyGui.souhrn('sKusovnik', ''); return; }
    const i = vysledek.info, b = priprava.bbox, mat = FORMY.MATERIALY[p.material], out = [], om = [];
    const tisk = vysledek.dily.reduce((s, d) => { const o = FORMY.odhadTisku(d.objem, d.plocha, p.tisk); s.g += o.g; s.h += o.hodin; return s; }, { g: 0, h: 0 });
    const vse = vysledek.dily.map(d => d.bbox).reduce((a, c) => [Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.min(a[2], c[2]), Math.max(a[3], c[3]), Math.max(a[4], c[4]), Math.max(a[5], c[5])]);
    out.push(dlazdice('Model (dutina)', `${fmt(b[3] - b[0])} × ${fmt(b[4] - b[1])} × ${fmt(b[5] - b[2])} mm`, `objem ${ml(i.objemDutiny)}${p.smrsteni ? ` · zvětšeno o ${fmt(p.smrsteni, 2)} %` : ''}`));
    out.push(dlazdice(p.rezim === 'box' ? 'Box celkem' : 'Forma celkem', `${fmt(vse[3] - vse[0])} × ${fmt(vse[4] - vse[1])} × ${fmt(vse[5] - vse[2])} mm`, `${vysledek.dily.length} ${vysledek.dily.length === 1 ? 'díl' : 'díly'}`));
    out.push(dlazdice('Tisk (hrubě)', `${fmt(tisk.g, 0)} g ${FORMY.TISK_MATERIALY[p.tisk.material].nazev}`, `≈ ${fmt(tisk.h, 1)} h při výplni ${fmt(p.tisk.vypln, 0)} %, filament ${fmt(tisk.g / FORMY.TISK_MATERIALY[p.tisk.material].hustota / (Math.PI * 0.875 * 0.875), 1)} m`));
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
    TrubkyGui.souhrn('sKusovnik', String(vysledek.dily.length));
  }
  /* ---------- export ---------- */
  const lzeExport = () => { if (!vysledek) { Dialog.chyba('Forma není sestavená: ' + ($('stav3d').textContent || 'chybí model')); return false; } return true; };
  const tiskove = () => FORMY_GEO.tiskoveRozlozeni(vysledek.dily);
  function exportStl() { if (lzeExport()) app.stahni(KRAB.stlBinarni(tiskove(), 'formy - github_site'), app.jmeno('.stl'), 'model/stl'); }
  function exportDil(k) {
    if (!lzeExport()) return;
    const d = FORMY_GEO.tiskoveRozlozeni([vysledek.dily[k]]);
    app.stahni(KRAB.stlBinarni(d, 'formy - ' + d[0].jmeno), app.jmeno('_' + d[0].jmeno + '.stl'), 'model/stl');
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
  $('btn3mf').addEventListener('click', () => { if (lzeExport()) app.stahni(KRAB.soubor3mf(tiskove(), app.p.nazev || 'Forma'), app.jmeno('.3mf'), 'model/3mf'); });

  /* ---------- lišta, nabídky ---------- */
  TrubkyGui.pripoj({ klic: 'webapp_formy_gui', pohled: j => nahled.pohled(j) });
  for (const v of FORMY.PREDVOLBY) {
    const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
    b.innerHTML = `${v.nazev}<span class="pozn">${v.popis}</span>`;
    b.addEventListener('click', () => {
      const n = FORMY.normalizuj({}).p, nazev = app.p.nazev;
      const slij = (c, z) => { for (const k of Object.keys(z)) { if (z[k] && typeof z[k] === 'object') slij(c[k], z[k]); else c[k] = z[k]; } };
      slij(n, v.p); n.nazev = nazev === 'Forma' ? v.nazev : nazev;
      app.nahrad(n);
    });
    $('seznamPredvoleb').appendChild(b);
  }
  for (const [id, co] of [['tPruhledna', 'pruhledna'], ['tPodkosy', 'podkosy'], ['tRovina', 'rovina'], ['tHrany', 'hrany'], ['tTisk', 'tisk'], ['tRez', 'rez']]) {
    app.prepinac(id, h => { nahled.prepni(co, h); legendy(); });
  }
  app.prepinac('tPrevisy', h => { nahled.prepni('previsy', h); legendy(); }, true);
  app.prepinac('tPravitka', h => nahled.prepni('pravitka', h), true);
  $('rRozlozit').addEventListener('input', e => { $('oRozlozit').textContent = e.target.value + ' mm'; nahled.prepni('rozlozit', +e.target.value); });

  /* ---------- start ---------- */
  p = app.p;
  const zOdkazu = /[#&]p=/.test(location.hash);
  (async () => {
    const z = await IDB.nacti();
    if (z && z.poz && z.idx) souborModel = { nazev: z.nazev, sit: { poz: new Float32Array(z.poz), idx: new Uint32Array(z.idx) }, kroky: z.kroky || [], format: z.format || 'STL' };
    await app.start({
      manifold: {
        ok: x => { w = x; $('stav3d').textContent = ''; prepocitej(); },
        chyba: e => {
          const st = $('stav3d'); st.textContent = 'Geometrické jádro (manifold-3d) se nenačetlo: ' + (e && e.message || e) + ' – forma ani export nejsou k dispozici.'; st.classList.add('chyba');
          app.hlaseni([], { chybaStavby: 'manifold-3d se nenačetl – zkuste stránku obnovit nebo jiný prohlížeč.' });
        },
      },
    });
    if (zOdkazu && app.p.model.zdroj === 'soubor') Dialog.info('Sdílený návrh je pro vlastní model – ten se odkazem nepřenáší. Nahrajte jeho STL / 3MF (Soubor → Nahrát model).' + (souborModel ? ` Zatím se použije váš poslední model „${souborModel.nazev}“.` : ''));
  })();
  window.FORMY_UI = { get p() { return app.p; }, get vysledek() { return vysledek; }, get priprava() { return priprava; }, get w() { return w; }, nahled, zmen: app.zmen, prepocitej, nactiModelSoubor, app };
})();

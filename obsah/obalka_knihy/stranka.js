/* ============================================================
   obalka_knihy/stranka.js – rozhraní stránky Obálka knihy k tisku
   (formulář ↔ návrh, náhled, ukládání, export, písma, obrázky).
   ============================================================ */
(function () {
  'use strict';
  const O = window.OBALKA, K = window.OBALKA_KRESBA;
  const $ = id => document.getElementById(id);
  const KLIC = 'webapp_obalka_knihy', KLIC_NAST = 'webapp_obalka_knihy_nast';
  const kopie = x => JSON.parse(JSON.stringify(x));
  // texty mimo DOM (plátno náhledu) – přes I18N, když je stránka přeložená
  const T = (s, p) => (window.I18N && I18N.t ? I18N.t(s, p) : s.replace(/\{(\w+)\}/g, (_, k) => p[k]));
  const cislo = (x, d = 1) => (+x).toLocaleString('cs-CZ', { minimumFractionDigits: d, maximumFractionDigits: d });

  /* ---------- stav ---------- */
  function slij(cil, zdroj) {          // doplní chybějící klíče z výchozího návrhu
    for (const k in zdroj) {
      if (zdroj[k] && typeof zdroj[k] === 'object' && !Array.isArray(zdroj[k])) cil[k] = slij(cil[k] && typeof cil[k] === 'object' ? cil[k] : {}, zdroj[k]);
      else if (!(k in cil)) cil[k] = zdroj[k];
    }
    return cil;
  }
  const novyNavrh = () => kopie(O.VYCHOZI);
  let ulozeny = null;
  try { ulozeny = JSON.parse(localStorage.getItem(KLIC) || 'null'); } catch (e) { ulozeny = null; }
  let navrh = slij((ulozeny && ulozeny.navrh) || {}, O.VYCHOZI);
  let aktualni = { id: (ulozeny && ulozeny.id) || null, nazev: (ulozeny && ulozeny.nazev) || '' };
  let nast = { vod: { orez: true, spadavka: true, bezpecna: true, hrbet: true, drazky: true, kdp: true, popisky: true }, exp: { voditka: false, znacky: false }, zoom: 0 };
  try { nast = slij(JSON.parse(localStorage.getItem(KLIC_NAST) || '{}'), nast); } catch (e) { /* výchozí */ }
  const ulozNast = () => localStorage.setItem(KLIC_NAST, JSON.stringify(nast));

  /* ---------- IndexedDB: obrázky a pojmenované návrhy ---------- */
  let dbSlib = null;
  function db() {
    if (dbSlib) return dbSlib;
    dbSlib = new Promise((ok, chyba) => {
      const r = indexedDB.open(KLIC, 1);
      r.onupgradeneeded = () => {
        r.result.createObjectStore('obrazky', { keyPath: 'id' });
        r.result.createObjectStore('navrhy', { keyPath: 'id' });
      };
      r.onsuccess = () => ok(r.result);
      r.onerror = () => chyba(r.error);
    });
    return dbSlib;
  }
  async function tx(store, rezim, f) {
    const d = await db();
    return new Promise((ok, chyba) => {
      const t = d.transaction(store, rezim), s = t.objectStore(store);
      const r = f(s);
      t.oncomplete = () => ok(r && 'result' in r ? r.result : undefined);
      t.onerror = () => chyba(t.error);
    });
  }
  const idbVloz = (store, z) => tx(store, 'readwrite', s => s.put(z));
  const idbVem = (store, id) => tx(store, 'readonly', s => s.get(id));
  const idbVse = store => tx(store, 'readonly', s => s.getAll());
  const idbSmaz = (store, id) => tx(store, 'readwrite', s => s.delete(id));
  const noveId = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  /* ---------- obrázky v paměti ---------- */
  const obrazky = {};          // id → HTMLImageElement
  const obrUrl = {};
  async function nactiObrazek(id) {
    if (!id || obrazky[id]) return;
    const z = await idbVem('obrazky', id).catch(() => null);
    if (!z) return;
    await new Promise(ok => {
      const img = new Image();
      obrUrl[id] = URL.createObjectURL(z.blob);
      img.onload = () => { obrazky[id] = img; ok(); };
      img.onerror = () => ok();
      img.src = obrUrl[id];
    });
  }
  const pouzitaObr = n => [n.obrArch.id, n.obrPredni.id, n.logo.id].filter(Boolean);
  async function nactiObrazkyNavrhu() { await Promise.all(pouzitaObr(navrh).map(nactiObrazek)); }
  /* smaže obrázky, které nepoužívá aktuální ani žádný uložený návrh */
  async function uklidObrazky() {
    try {
      const pouzite = new Set(pouzitaObr(navrh));
      for (const z of await idbVse('navrhy')) pouzitaObr(slij(z.navrh, O.VYCHOZI)).forEach(i => pouzite.add(i));
      const vse = await tx('obrazky', 'readonly', s => s.getAllKeys());
      for (const id of vse) if (!pouzite.has(id)) {
        await idbSmaz('obrazky', id);
        if (obrUrl[id]) URL.revokeObjectURL(obrUrl[id]);
        delete obrazky[id]; delete obrUrl[id];
      }
    } catch (e) { /* úklid není kritický */ }
  }

  /* ---------- písma ---------- */
  const EXTRA = [
    { id: 'lserif', nazev: 'Liberation Serif', url: 'fonty/LiberationSerif-Regular.ttf' },
    { id: 'lserif-i', nazev: 'Liberation Serif Italic', url: 'fonty/LiberationSerif-Italic.ttf' },
    { id: 'lsans', nazev: 'Liberation Sans', url: 'lib/pdflib/LiberationSans-Regular.ttf' },
    { id: 'lsans-i', nazev: 'Liberation Sans Italic', url: 'fonty/LiberationSans-Italic.ttf' },
  ];
  const pisma = {};            // id → opentype.Font
  const pismaSlib = {};
  const pismaChyba = {};
  let systemova = [];          // [{id, nazev, data: FontData}]
  function nactiPismo(id) {
    if (pismaSlib[id]) return pismaSlib[id];
    let p;
    const ex = EXTRA.find(e => e.id === id);
    if (ex) p = fetch(ex.url).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); }).then(b => opentype.parse(b));
    else if (id.startsWith('sys:')) {
      const s = systemova.find(x => x.id === id);
      p = s ? s.data.blob().then(b => b.arrayBuffer()).then(b => opentype.parse(b)) : Promise.reject(new Error('Systémové písmo není načtené – zvolte v nabídce „Text knihy“ Načíst systémová písma.'));
    } else p = FONTY.opentype(id);
    pismaSlib[id] = p.then(f => { pisma[id] = f; return f; }, e => { pismaChyba[id] = e.message || String(e); delete pismaSlib[id]; throw e; });
    return pismaSlib[id];
  }
  async function naplnPisma() {
    let sez = [];
    try { sez = await FONTY.seznam(); } catch (e) { sez = FONTY.KATALOG.slice(); }
    const skupiny = [['Knižní', EXTRA.map(e => ({ id: e.id, nazev: e.nazev }))]];
    const druhy = {};
    for (const f of sez) {
      if (f.druh === 'pismo') continue;            // runy, hieroglyfy… na obálku nepatří
      const d = f.vlastni ? 'vlastni' : f.druh;
      (druhy[d] = druhy[d] || []).push(f);
    }
    for (const d of Object.keys(FONTY.DRUHY)) if (druhy[d]) skupiny.push([FONTY.DRUHY[d], druhy[d]]);
    if (systemova.length) skupiny.push(['Systémová', systemova]);
    document.querySelectorAll('select.vyber-pisma').forEach(sel => {
      const hodn = ziskej(sel.dataset.k);
      sel.innerHTML = '';
      for (const [nadpis, pol] of skupiny) {
        const g = document.createElement('optgroup'); g.label = nadpis;
        for (const f of pol) { const o = document.createElement('option'); o.value = f.id; o.textContent = f.nazev; o.setAttribute('data-i18n', 'ne'); g.appendChild(o); }
        sel.appendChild(g);
      }
      if (![...sel.options].some(o => o.value === hodn)) {
        const o = document.createElement('option'); o.value = hodn; o.textContent = hodn + ' (nedostupné)'; sel.appendChild(o);
      }
      sel.value = hodn;
    });
  }

  /* ---------- formulář ---------- */
  function ziskej(cesta) { return cesta.split('.').reduce((o, k) => (o == null ? o : o[k]), navrh); }
  function nastav(cesta, h) {
    const c = cesta.split('.'), posl = c.pop();
    c.reduce((o, k) => o[k], navrh)[posl] = h;
  }
  const TEXTY = [['nazev', 'Název'], ['podtitul', 'Podtitul'], ['autor', 'Autor']];
  function sestavTextyPredni() {
    $('textyPredni').innerHTML = TEXTY.map(([k, popis], i) => `
      ${i ? '<div class="podsekce"></div>' : ''}
      <label class="pole" style="grid-template-columns:1fr"><span>${popis}</span><textarea data-k="${k}.text" rows="${k === 'nazev' ? 2 : 1}" data-i18n="ne"></textarea></label>
      <label class="pole"><span>Písmo</span><select data-k="${k}.pismo" class="vyber-pisma"></select></label>
      <div class="pole"><span>Velikost a barva</span><div class="radek"><input type="number" data-k="${k}.velikost" min="4" max="200" step="0.5" aria-label="Velikost písma"> <span class="jedn">pt</span>
        <input type="color" data-k="${k}.barva" aria-label="Barva"></div></div>
      <div class="pole"><span>Odshora</span><div class="radek"><input type="number" data-k="${k}.y" min="0" max="98" step="0.5" aria-label="Odshora"> <span class="jedn">%</span>
        <select data-k="${k}.zarovnani" aria-label="Zarovnání"><option value="stred">Na střed</option><option value="vlevo">Vlevo</option><option value="vpravo">Vpravo</option></select></div></div>
      <div class="pole"><span>Prostrkání, řádky</span><div class="radek"><input type="number" data-k="${k}.prostrkani" min="-100" max="800" step="10" aria-label="Prostrkání" title="Prostrkání v tisícinách em"> <span class="jedn">/1000 em</span>
        <input type="number" data-k="${k}.radkovani" min="0.7" max="3" step="0.05" aria-label="Řádkování" title="Řádkování víceřádkového textu" style="width:64px"></div></div>`).join('');
  }
  function doFormulare() {
    document.querySelectorAll('[data-k]').forEach(el => {
      const h = ziskej(el.dataset.k);
      if (el.type === 'checkbox') el.checked = !!h;
      else if (el.tagName === 'SELECT' && el.classList.contains('vyber-pisma') && ![...el.options].some(o => o.value === h)) naplnPisma();
      else el.value = h ?? '';
    });
    obrazkyDoPanelu();
    prepinaniPoli();
  }
  function prepinaniPoli() {
    const k = navrh.kniha;
    $('poleVlastniPapir').hidden = k.papir !== 'vlastni';
    $('poleTloustka').hidden = k.papir !== 'vlastni';
    $('poleMekka').hidden = k.vazba === 'pevna';
    $('polePevna').hidden = k.vazba !== 'pevna';
    const prechod = navrh.pozadi.typ === 'prechod';
    $('barva2').hidden = $('uhel').hidden = !prechod;
    document.querySelectorAll('[data-k="kniha.sirka"],[data-k="kniha.vyska"]').forEach(el => { el.disabled = k.format !== 'vlastni'; });
  }
  /* reakce na změnu, které mění i jiná pole (předvolby) */
  function predvolby(cesta) {
    const k = navrh.kniha;
    if (cesta === 'kniha.format' && O.FORMATY[k.format].sirka) { k.sirka = +O.FORMATY[k.format].sirka.toFixed(2); k.vyska = +O.FORMATY[k.format].vyska.toFixed(2); }
    if (cesta === 'kniha.tiskarna') {
      const t = O.TISKARNY[k.tiskarna];
      k.spad = +t.spad.toFixed(3); k.bezpecna = +t.bezpecna.toFixed(3); k.pridavek = t.pridavek;
      if (k.tiskarna === 'kdp') {
        if (O.PAPIRY[k.papir].typ !== 'kdp') k.papir = 'kdp_kremovy';
        if (k.vazba === 'pevna') { k.vazba = 'mekka'; Dialog.info('Pevnou vazbu KDP počítá jinak – pro ni použijte šablonu z KDP. Přepnuto na brožuru.'); }
      }
    }
    if (cesta === 'kniha.vazba' && k.vazba === 'pevna' && k.tiskarna === 'kdp') {
      k.tiskarna = 'obecna'; const t = O.TISKARNY.obecna; k.spad = t.spad; k.bezpecna = t.bezpecna; k.pridavek = t.pridavek;
      Dialog.info('Pevná vazba se počítá pro obecnou tiskárnu (KDP má vlastní šablony).');
    }
    if (cesta === 'kniha.papir' && k.papir !== 'vlastni') {
      const p = O.PAPIRY[k.papir];
      if (p.typ === 'list') { k.gramaz = p.gramaz; k.objemnost = p.objemnost; k.tloustka = 0; }
    }
  }
  function priZmene(e) {
    const el = e.target.closest('[data-k]');
    if (!el) return;
    let h = el.type === 'checkbox' ? el.checked : el.value;
    if (el.type === 'number' || el.type === 'range') { h = parseFloat(String(h).replace(',', '.')); if (!isFinite(h)) return; }
    nastav(el.dataset.k, h);
    if (e.type === 'change' || el.tagName === 'SELECT') {
      predvolby(el.dataset.k);
      if (el.tagName === 'SELECT') doFormulare();
    }
    prepinaniPoli();
    zmena();
  }

  /* ---------- historie (zpět / znovu) ---------- */
  const historie = [JSON.stringify(navrh)];
  let hPoz = 0, hCasovac = null;
  function zapisHistorii() {
    const s = JSON.stringify(navrh);
    if (s === historie[hPoz]) return;
    historie.splice(hPoz + 1); historie.push(s);
    if (historie.length > 100) historie.shift();
    hPoz = historie.length - 1; tlacitkaHistorie();
  }
  function tlacitkaHistorie() { $('btnZpet').disabled = hPoz <= 0; $('btnZnovu').disabled = hPoz >= historie.length - 1; }
  async function krokHistorie(d) {
    clearTimeout(hCasovac); zapisHistorii();
    const n = hPoz + d;
    if (n < 0 || n >= historie.length) return;
    hPoz = n; navrh = JSON.parse(historie[n]);
    tlacitkaHistorie(); doFormulare(); await nactiObrazkyNavrhu(); zmena(true);
  }

  let ulozCasovac = null;
  function zmena(bezHistorie) {
    prekresli();
    clearTimeout(ulozCasovac);
    ulozCasovac = setTimeout(() => localStorage.setItem(KLIC, JSON.stringify({ navrh, id: aktualni.id, nazev: aktualni.nazev })), 300);
    if (!bezHistorie) { clearTimeout(hCasovac); hCasovac = setTimeout(zapisHistorii, 400); }
  }

  /* ---------- náhled ---------- */
  let scena = null, kNahled = 1, kreslim = false;
  function prekresli() {
    if (kreslim) return;
    kreslim = true;
    requestAnimationFrame(() => { kreslim = false; vykresli(); });
  }
  function vykresli() {
    const sc = K.sestav(navrh, { pisma, obrazky });
    const cekat = [...new Set(sc.cekaNaPisma)].filter(id => !pismaChyba[id]);
    if (cekat.length) Promise.allSettled(cekat.map(nactiPismo)).then(prekresli);
    scena = sc;
    const a = sc.a, obal = $('platnoObal'), c = $('nahled');
    const dpr = window.devicePixelRatio || 1;
    if (nast.zoom > 0) kNahled = nast.zoom * 96 / 25.4;
    else kNahled = Math.max(0.3, Math.min((obal.clientWidth - 36) / a.sirka, (obal.clientHeight - 36) / a.vyska));
    obal.classList.toggle('zvetseno', nast.zoom > 0);
    const w = Math.round(a.sirka * kNahled), h = Math.round(a.vyska * kNahled);
    c.style.width = w + 'px'; c.style.height = h + 'px';
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const ctx = c.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, c.width, c.height);
    ctx.setTransform(kNahled * dpr, 0, 0, kNahled * dpr, 0, 0);
    K.kresliRaster(ctx, sc);
    K.kresliVektory(ctx, sc);
    if (nast.vod.spadavka) K.kresliSpad(ctx, sc);
    K.kresliVoditka(ctx, sc, nast.vod, 1 / kNahled);
    if (nast.vod.popisky) popisky(ctx, sc);
    c.classList.toggle('tahni', !!(navrh.obrPredni.id && obrazky[navrh.obrPredni.id]));
    vypisInfo(sc);
  }
  function popisky(ctx, sc) {
    const a = sc.a, k = kNahled;
    ctx.save();
    ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
    ctx.font = '11px system-ui, sans-serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    const stitek = (text, xmm, ymm) => {
      const w = ctx.measureText(text).width + 10, x = xmm * k, y = ymm * k;
      ctx.fillStyle = 'rgba(0,0,0,.62)'; ctx.fillRect(x - w / 2, y - 8, w, 16);
      ctx.fillStyle = '#fff'; ctx.fillText(text, x, y);
    };
    const y = a.vyska - a.spad / 2;
    stitek(T('Zadní {w} mm', { w: cislo(a.zadni.w) }), a.zadni.x + a.zadni.w / 2, y);
    stitek(T('Přední {w} mm', { w: cislo(a.predni.w) }), a.predni.x + a.predni.w / 2, y);
    if (a.hrbet.w * k > 50) stitek(T('Hřbet {w}', { w: cislo(a.hrbet.w) }), a.hrbet.x + a.hrbet.w / 2, y);
    ctx.restore();
  }
  function vypisInfo(sc) {
    const R = sc.R, a = sc.a, k = navrh.kniha, kdp = k.tiskarna === 'kdp';
    const pal = mm => cislo(O.mmNaPalce(mm), 3) + '"';
    let s = `<span>Arch <b>${cislo(a.sirka, 2)} × ${cislo(a.vyska, 2)} mm</b>${kdp ? ' (' + pal(a.sirka) + ' × ' + pal(a.vyska) + ')' : ''}</span>`;
    s += `<span>Hřbet <b>${cislo(a.hrbet.w, 2)} mm</b>${kdp ? ' (' + pal(a.hrbet.w) + ')' : ''}</span>`;
    s += a.vazba === 'pevna' ? `<span>Deska <b>${cislo(a.deska.w)} × ${cislo(a.deska.h)} mm</b></span><span>Obtah <b>${cislo(a.spad)} mm</b></span>`
      : `<span>Spadávka <b>${cislo(a.spad, 2)} mm</b></span>`;
    s += `<span>Bezpečná zóna <b>${cislo(R.bezpecna, 2)} mm</b></span>`;
    $('rozmery').innerHTML = s;
    // výsledek v panelu
    const papir = R.papir;
    const tl = papir.typ === 'kdp' ? `${papir.naStranu}" na stranu (KDP)` : `list ${cislo(O.tloustkaListu(papir), 0)} µm`;
    $('vysledekKniha').innerHTML = `Hřbet bloku <b>${cislo(R.hrbetBloku, 2)} mm</b> (${tl})` +
      (+k.pridavek ? ` + přídavek ${cislo(k.pridavek)} mm` : '') + ` = <b>${cislo(R.hrbet, 2)} mm</b>` +
      (a.vazba === 'pevna' ? `<br>Hřbet desek <b>${cislo(a.hrbetDesek, 2)} mm</b>` : '') +
      `<br>Arch <b>${cislo(a.sirka, 2)} × ${cislo(a.vyska, 2)} mm</b>` +
      (kdp ? `<br><span class="mala">KDP: ${pal(a.sirka)} × ${pal(a.vyska)}, hřbet ${pal(a.hrbet.w)}</span>` : '');
    // ISBN
    const ri = sc.info.isbn, st = $('isbnStav');
    const CHYBY = { znaky: 'ISBN obsahuje nepovolené znaky.', predpona: 'ISBN-13 musí začínat 978 nebo 979.', delka: 'ISBN má 10 nebo 13 číslic.' };
    if (ri.chyba === 'prazdne') st.innerHTML = 'Bez ISBN se čárový kód nekreslí.';
    else if (ri.platne) st.innerHTML = `<span class="ok">✓ Platné ISBN-${ri.typ}.</span> EAN-13: <b>${ri.isbn13}</b>` + (ri.typ === 10 ? ' (převedeno z ISBN-10)' : ri.isbn10 ? `, ISBN-10: ${ri.isbn10}` : '');
    else if (ri.chyba === 'kontrolni') st.innerHTML = `<span class="chyba">✗ Chybná kontrolní číslice – správně je ${ri.ocekavana}.</span>`;
    else st.innerHTML = `<span class="chyba">✗ ${CHYBY[ri.chyba] || 'Neplatné ISBN.'}</span>`;
    const hi = sc.info.hrbetTextVyska;
    $('hrbetInfo').textContent = hi ? `výška textu ${cislo(hi, 1)} mm z ${cislo(a.hrbet.w, 1)} mm` : '';
    // upozornění
    const z = O.kontrola({ tiskarna: k.tiskarna, papir: k.papir, strany: +k.strany, hrbet: a.hrbet.w, maHrbetText: sc.info.maHrbetText,
      hrbetTextVyska: sc.info.hrbetTextVyska || 0, hrbetTextDelka: sc.info.hrbetTextDelka || 0, vyska: a.hrbet.h, bezpecna: R.bezpecna });
    const JMENA = { nazev: 'Název', podtitul: 'Podtitul', autor: 'Autor', hrbet: 'Hřbet', anotace: 'Anotace' };
    for (const [co, zn] of Object.entries(sc.chybi)) z.push({ uroven: 'chyba', text: `${JMENA[co]}: zvolené písmo nemá znaky ${zn.join(' ')} – vyberte jiné.` });
    for (const co of new Set(sc.info.siroky || [])) z.push({ uroven: 'varovani', text: `${JMENA[co]} přesahuje bezpečnou zónu – zmenšete písmo nebo zalomte řádek.` });
    if (sc.info.anotaceKonec > sc.info.anotaceDno) z.push({ uroven: 'chyba', text: 'Anotace přetéká přes spodní okraj zadní strany.' });
    if (sc.kod && sc.info.anotaceKonec > sc.kod.y && navrh.isbn.pozice) z.push({ uroven: 'varovani', text: 'Anotace zasahuje do výšky čárového kódu – zkontrolujte, že se nepřekrývají.' });
    if (dopl().length && dopl().length !== 5) z.push({ uroven: 'chyba', text: 'Doplněk EAN-5 musí mít 5 číslic.' });
    if (+navrh.isbn.zvetseni < 80) z.push({ uroven: 'varovani', text: 'Čárový kód menší než 80 % nemusí jít spolehlivě přečíst.' });
    for (const r of sc.raster) if (r.druh === 'obr' || r.druh === 'logo') {
      const iw = r.img.naturalWidth || r.img.width, wmm = r.druh === 'obr' ? r.kam.w : r.w;
      const dpi = iw / (wmm / 25.4);
      if (dpi < 200) z.push({ uroven: dpi < 150 ? 'chyba' : 'varovani', text: `${r.druh === 'logo' ? 'Logo' : r.predni ? 'Obrázek přední strany' : 'Obrázek přes arch'} má v tisku jen ${Math.round(dpi)} DPI (doporučeno 300).` });
    }
    for (const [id, ch] of Object.entries(pismaChyba)) if (JSON.stringify(navrh).includes(`"${id}"`)) z.push({ uroven: 'chyba', text: `Písmo ${id}: ${ch}` });
    $('upozorneni').innerHTML = z.map(x => `<div class="${x.uroven}">${x.text.replace(/</g, '&lt;')}</div>`).join('');
  }
  const dopl = () => String(navrh.isbn.doplnek || '').replace(/\D/g, '');

  /* tažení obrázku přední strany v náhledu */
  let tah = null;
  $('nahled').addEventListener('pointerdown', e => {
    const img = obrazky[navrh.obrPredni.id];
    if (!img || !scena) return;
    const r = e.currentTarget.getBoundingClientRect(), x = (e.clientX - r.left) / kNahled, y = (e.clientY - r.top) / kNahled;
    const b = scena.boxPredni;
    if (x < b.x || x > b.x + b.w || y < b.y || y > b.y + b.h) return;
    const kam = K.umisteniObr(img, b, navrh.obrPredni);
    tah = { x: e.clientX, y: e.clientY, px: +navrh.obrPredni.posX, py: +navrh.obrPredni.posY, dw: kam.w - b.w, dh: kam.h - b.h };
    e.currentTarget.setPointerCapture(e.pointerId);
  });
  $('nahled').addEventListener('pointermove', e => {
    if (!tah) return;
    const omez = v => Math.max(-100, Math.min(100, v));
    if (tah.dw > 0.01) navrh.obrPredni.posX = Math.round(omez(tah.px - (e.clientX - tah.x) / kNahled / tah.dw * 200));
    if (tah.dh > 0.01) navrh.obrPredni.posY = Math.round(omez(tah.py - (e.clientY - tah.y) / kNahled / tah.dh * 200));
    document.querySelectorAll('[data-k^="obrPredni.pos"]').forEach(el => { el.value = ziskej(el.dataset.k); });
    zmena();
  });
  const konecTahu = () => { tah = null; };
  $('nahled').addEventListener('pointerup', konecTahu);
  $('nahled').addEventListener('pointercancel', konecTahu);

  /* ---------- obrázky v panelu ---------- */
  const NAZVY_OBR = { obrArch: 'obrázek přes arch', obrPredni: 'obrázek přední strany', logo: 'logo' };
  function obrazkyDoPanelu() {
    document.querySelectorAll('[data-obr]').forEach(el => {
      const kde = el.dataset.obr, id = navrh[kde].id;
      el.innerHTML = (id && obrUrl[id] ? `<img src="${obrUrl[id]}" alt="">` : '') +
        `<button class="tl" data-nahraj="${kde}">📂 ${id ? 'Vyměnit' : 'Nahrát'} ${NAZVY_OBR[kde]}</button>` +
        (id ? `<button class="tl" data-odeber="${kde}" aria-label="Odebrat" title="Odebrat">✕</button>` : '');
    });
  }
  let cilObr = null;
  document.addEventListener('click', e => {
    const n = e.target.closest('[data-nahraj]'), o = e.target.closest('[data-odeber]');
    if (n) { cilObr = n.dataset.nahraj; $('souborObr').value = ''; $('souborObr').click(); }
    if (o) { navrh[o.dataset.odeber].id = null; obrazkyDoPanelu(); zmena(); uklidObrazky(); }
  });
  $('souborObr').addEventListener('change', async e => {
    const f = e.target.files[0];
    if (!f || !cilObr) return;
    try {
      const id = noveId('o');
      await idbVloz('obrazky', { id, blob: f, nazev: f.name });
      await nactiObrazek(id);
      if (!obrazky[id]) throw new Error('Obrázek se nepodařilo přečíst.');
      Object.assign(navrh[cilObr], { id }, cilObr === 'logo' ? {} : { zoom: 1, posX: 0, posY: 0 });
      doFormulare(); zmena();
    } catch (er) { Dialog.chyba('Obrázek nejde uložit: ' + er.message); }
  });

  /* ---------- nabídky ---------- */
  function zavriNabidky() {
    document.querySelectorAll('.nabidka:not([hidden])').forEach(n => { n.hidden = true; });
    document.querySelectorAll('[data-nabidka][aria-expanded="true"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
  }
  document.querySelectorAll('[data-nabidka]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    const n = $(b.dataset.nabidka), bylo = !n.hidden;
    zavriNabidky();
    if (bylo) return;
    n.hidden = false; b.setAttribute('aria-expanded', 'true');
    const r = b.getBoundingClientRect();
    n.style.top = (r.bottom + 4) + 'px';
    n.style.left = Math.max(6, Math.min(r.left, innerWidth - n.offsetWidth - 6)) + 'px';
  }));
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-prikaz]');
    if (b && !b.disabled) { e.stopPropagation(); zavriNabidky(); const p = PRIKAZY[b.dataset.prikaz]; if (p) p(); return; }
    const v = e.target.closest('[data-vod]');
    if (v) { nast.vod[v.dataset.vod] = !nast.vod[v.dataset.vod]; ulozNast(); prepinace(); prekresli(); return; }
    const x = e.target.closest('[data-exp]');
    if (x) { nast.exp[x.dataset.exp] = !nast.exp[x.dataset.exp]; ulozNast(); prepinace(); return; }
    if (!e.target.closest('.nabidka')) zavriNabidky();
  });
  addEventListener('resize', () => { zavriNabidky(); prekresli(); });
  function prepinace() {
    document.querySelectorAll('[data-vod]').forEach(b => b.setAttribute('aria-pressed', String(!!nast.vod[b.dataset.vod])));
    document.querySelectorAll('[data-exp]').forEach(b => b.setAttribute('aria-pressed', String(!!nast.exp[b.dataset.exp])));
  }
  document.querySelectorAll('dialog [data-zavrit]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
  document.querySelectorAll('dialog.okno').forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));

  /* seznam k výběru v okně → Promise<hodnota|null> */
  function vyberZeSeznamu(nadpis, polozky, prazdne) {
    return new Promise(ok => {
      const d = $('dlgSeznam'); let hotovo = false;
      $('dlgSeznamNadpis').textContent = nadpis;
      const obsah = $('dlgSeznamObsah'); obsah.innerHTML = '';
      if (!polozky.length) obsah.innerHTML = `<div class="prazdne">${prazdne}</div>`;
      for (const p of polozky) {
        const r = document.createElement('div'); r.className = 'polozka';
        r.innerHTML = (p.nahled ? `<img src="${p.nahled}" alt="">` : '') + '<div class="popis"><b data-i18n="ne"></b><span data-i18n="ne"></span></div>';
        r.querySelector('b').textContent = p.nazev; r.querySelector('span').textContent = p.popis || '';
        const b = document.createElement('button'); b.className = 'tl hlavni-tl'; b.textContent = p.tlacitko || 'Vybrat';
        b.onclick = () => { hotovo = true; d.close(); ok(p.hodnota); };
        r.appendChild(b);
        if (p.smazat) {
          const s = document.createElement('button'); s.className = 'tl'; s.textContent = '🗑'; s.title = 'Smazat'; s.setAttribute('aria-label', 'Smazat');
          s.onclick = async () => { if (await p.smazat()) r.remove(); };
          r.appendChild(s);
        }
        obsah.appendChild(r);
      }
      d.onclose = () => { if (!hotovo) ok(null); };
      d.showModal();
    });
  }
  function stahni(blob, jmeno) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = jmeno;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  const jmenoSouboru = pripona => {
    const z = (navrh.nazev.text || 'obalka').split('\n')[0].normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').toLowerCase() || 'obalka';
    return `obalka_${z}.${pripona}`;
  };
  const cekej = () => new Promise(r => setTimeout(r, 30));
  async function hotovaScena() {
    await nactiObrazkyNavrhu();
    let sc = K.sestav(navrh, { pisma, obrazky });
    const cekat = [...new Set(sc.cekaNaPisma)];
    if (cekat.length) { await Promise.allSettled(cekat.map(nactiPismo)); sc = K.sestav(navrh, { pisma, obrazky }); }
    const chybi = [...new Set(sc.cekaNaPisma)];
    if (chybi.length) throw new Error('Nepodařilo se načíst písmo: ' + chybi.join(', '));
    return sc;
  }
  function vodExportu() { return nast.exp.voditka ? { orez: true, hrbet: true, drazky: true, bezpecna: true, kdp: true } : null; }

  async function nahledProUlozeni() {
    const sc = await hotovaScena();
    const c = K.platno(sc, 25.4 * 240 / sc.a.sirka, { vektory: true });
    const u = c.toDataURL('image/jpeg', 0.75); c.width = c.height = 0; return u;
  }
  async function ulozDoDb(nazev, id) {
    const z = { id: id || noveId('n'), nazev, navrh: kopie(navrh), upraveno: Date.now(), nahled: await nahledProUlozeni().catch(() => '') };
    await idbVloz('navrhy', z);
    aktualni = { id: z.id, nazev };
    $('nazevNavrhu').textContent = nazev;
    zmena(true);
    Dialog.info(`Návrh „${nazev}“ je uložený (i s obrázky).`);
  }

  const PRIKAZY = {
    async novy() {
      if (!await Dialog.potvrd('Začít nový návrh? Neuložené změny aktuálního návrhu se zahodí.', { ok: 'Nový návrh' })) return;
      navrh = novyNavrh(); aktualni = { id: null, nazev: '' }; $('nazevNavrhu').textContent = '';
      doFormulare(); zmena(); uklidObrazky();
    },
    async ulozit() {
      if (!aktualni.id) return PRIKAZY.ulozitJako();
      try { await ulozDoDb(aktualni.nazev, aktualni.id); } catch (e) { Dialog.chyba('Uložení selhalo: ' + e.message); }
    },
    async ulozitJako() {
      const n = await Dialog.zeptej('Název návrhu', aktualni.nazev || navrh.nazev.text.split('\n')[0] || 'Obálka', { ok: 'Uložit' });
      if (!n || !n.trim()) return;
      try { await ulozDoDb(n.trim(), null); } catch (e) { Dialog.chyba('Uložení selhalo: ' + e.message); }
    },
    async otevrit() {
      const vse = (await idbVse('navrhy').catch(() => [])).sort((a, b) => b.upraveno - a.upraveno);
      const id = await vyberZeSeznamu('📂 Uložené návrhy', vse.map(z => ({
        nazev: z.nazev, popis: new Date(z.upraveno).toLocaleString('cs-CZ'), nahled: z.nahled, hodnota: z.id, tlacitko: 'Otevřít',
        smazat: async () => {
          if (!await Dialog.potvrd(`Smazat návrh „${z.nazev}“?`, { ok: 'Smazat' })) return false;
          await idbSmaz('navrhy', z.id);
          if (aktualni.id === z.id) { aktualni = { id: null, nazev: '' }; $('nazevNavrhu').textContent = ''; }
          uklidObrazky(); return true;
        },
      })), 'Zatím žádný uložený návrh. Uložte ho přes Soubor → Uložit (Ctrl+S).');
      if (!id) return;
      const z = await idbVem('navrhy', id);
      if (!z) return;
      navrh = slij(z.navrh, O.VYCHOZI); aktualni = { id: z.id, nazev: z.nazev }; $('nazevNavrhu').textContent = z.nazev;
      await nactiObrazkyNavrhu(); doFormulare(); zmena();
    },
    async zalohaVen() {
      const obr = {};
      for (const id of pouzitaObr(navrh)) {
        const z = await idbVem('obrazky', id).catch(() => null);
        if (z) obr[id] = { nazev: z.nazev, data: await new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(z.blob); }) };
      }
      stahni(new Blob([JSON.stringify({ format: 'obalka_knihy', verze: 1, nazev: aktualni.nazev, navrh, obrazky: obr })], { type: 'application/json' }), jmenoSouboru('json'));
    },
    zalohaDovnitr() { $('souborNavrh').value = ''; $('souborNavrh').click(); },
    zpet: () => krokHistorie(-1),
    znovu: () => krokHistorie(1),
    async pdf() {
      const b = document.querySelector('.hlavni-tl[data-prikaz="pdf"]'); b.disabled = true; const puv = b.textContent; b.textContent = '⏳ PDF…';
      try {
        await cekej();
        if (!window.jspdf) throw new Error('knihovna jsPDF se nenačetla');
        const sc = await hotovaScena();
        const doc = K.pdf(window.jspdf.jsPDF, sc, { voditka: vodExportu(), znacky: nast.exp.znacky, dpi: 300, nazev: navrh.nazev.text.replace(/\n/g, ' '), autor: navrh.autor.text });
        stahni(doc.output('blob'), jmenoSouboru('pdf'));
        Dialog.info(`PDF ${cislo(sc.a.sirka, 2)} × ${cislo(sc.a.vyska, 2)} mm je hotové.`);
      } catch (e) { Dialog.chyba('PDF se nepodařilo vytvořit: ' + e.message); }
      finally { b.disabled = false; b.textContent = puv; }
    },
    async png() {
      try {
        await cekej();
        const sc = await hotovaScena();
        const c = K.platno(sc, 300, { vektory: true, voditka: vodExportu() });
        const blob = await new Promise(ok => c.toBlob(ok, 'image/png'));
        c.width = c.height = 0;
        if (!blob) throw new Error('prohlížeči došla paměť na plátno');
        const u8 = O.pngSDpi(new Uint8Array(await blob.arrayBuffer()), 300);
        stahni(new Blob([u8], { type: 'image/png' }), jmenoSouboru('png'));
      } catch (e) { Dialog.chyba('PNG se nepodařilo vytvořit: ' + e.message); }
    },
    async sablona() {
      try {
        const sc = await hotovaScena();
        const prazdna = Object.assign({}, sc, { raster: [{ druh: 'barva', x: 0, y: 0, w: sc.a.sirka, h: sc.a.vyska, barva: '#ffffff' }], vektory: [] });
        const doc = K.pdf(window.jspdf.jsPDF, prazdna, { voditka: { orez: true, hrbet: true, drazky: true, bezpecna: true, kdp: true }, znacky: nast.exp.znacky, nazev: 'Šablona obálky' });
        stahni(doc.output('blob'), jmenoSouboru('sablona.pdf').replace('.sablona.pdf', '_sablona.pdf'));
      } catch (e) { Dialog.chyba('Šablonu se nepodařilo vytvořit: ' + e.message); }
    },
    async mojeKnihy() {
      try {
        const r = await fetch('../moje_knihy/seznam.json', { cache: 'no-store' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const knihy = (await r.json()).knihy || [];
        const k = await vyberZeSeznamu('📚 Moje knihy', knihy.map(k => ({ nazev: k.nazev, popis: `${k.autor ? k.autor + ' · ' : ''}${(k.slov || 0).toLocaleString('cs-CZ')} slov`, hodnota: k })), 'Ve složce moje_knihy není žádná kniha.');
        if (k) prevezmiKnihu(k.nazev, k.autor, '', k.slov);
      } catch (e) { Dialog.chyba('Seznam „Moje knihy“ se nepodařilo načíst: ' + e.message); }
    },
    async kroniky() {
      try {
        const dila = await (await fetch('knihy/dila.json')).json();
        const pol = [];
        for (const d of dila) {
          const knihy = await (await fetch(d.data + 'knihy.json')).json().catch(() => []);
          for (const k of knihy) {
            const slov = (k.kapitoly || []).reduce((s, c) => s + (c.slov || 0), 0);
            pol.push({ nazev: k.nazev, popis: `${d.nazev} · ${slov.toLocaleString('cs-CZ')} slov`, hodnota: { nazev: k.nazev.replace(/^[IVXLC]+\.\s+/, ''), podtitul: k.podtitul || '', slov } });
          }
        }
        const k = await vyberZeSeznamu('📜 Kroniky', pol, 'Žádné knihy.');
        if (k) prevezmiKnihu(k.nazev, '', k.podtitul, k.slov);
      } catch (e) { Dialog.chyba('Kroniky se nepodařilo načíst: ' + e.message); }
    },
    anotaceSoubor() { $('souborText').value = ''; $('souborText').click(); },
    vlastniPismo() { $('souborPismo').value = ''; $('souborPismo').click(); },
    async systemovaPisma() {
      if (!window.queryLocalFonts) return Dialog.chyba('Tenhle prohlížeč nedovolí stránce číst systémová písma (umí to Chrome a Edge). Písmo můžete přidat jako soubor: Text knihy → Přidat vlastní písmo.');
      try {
        const vse = await window.queryLocalFonts();
        systemova = vse.map(f => ({ id: 'sys:' + f.postscriptName, nazev: f.fullName, data: f })).sort((a, b) => a.nazev.localeCompare(b.nazev, 'cs'));
        await naplnPisma();
        Dialog.info(`Načteno ${systemova.length} systémových písem – najdete je na konci výběru písma.`);
      } catch (e) { Dialog.chyba('Přístup k systémovým písmům byl odmítnut.'); }
    },
    async cenaEan5() {
      const t = await Dialog.zeptej('Cena pro doplněk EAN-5, např. „USD 19.95“ (měny USD, CAD, GBP, AUD, NZD). Prázdné = 90000 (bez ceny).', 'USD 19.95', { ok: 'Použít' });
      if (t === null) return;
      try {
        const m = t.trim().match(/^([A-Za-z]{3})\s*([\d.,]+)$/);
        navrh.isbn.doplnek = !t.trim() ? '90000' : m ? O.cenaNaEan5(m[1].toUpperCase(), m[2].replace(',', '.')) : (() => { throw new Error('Zadejte měnu a částku, např. USD 19.95'); })();
        doFormulare(); zmena();
      } catch (e) { Dialog.chyba(e.message); }
    },
    hrbetZNazvu() {
      const n = navrh.nazev.text.replace(/\s*\n\s*/g, ' ').trim(), a = navrh.autor.text.trim();
      navrh.hrbet.text = [a, n].filter(Boolean).join(' · ');
      doFormulare(); zmena();
    },
    vsechnaVoditka() {
      const zap = !Object.values(nast.vod).every(Boolean);
      for (const k in nast.vod) nast.vod[k] = zap;
      ulozNast(); prepinace(); prekresli();
    },
    napoveda() { $('dlgNapoveda').showModal(); },
  };
  function prevezmiKnihu(nazev, autor, podtitul, slov) {
    navrh.nazev.text = nazev;
    if (autor) navrh.autor.text = autor;
    if (podtitul) navrh.podtitul.text = podtitul;
    if (slov) navrh.kniha.strany = O.odhadStran(slov, navrh.kniha.sirka, navrh.kniha.vyska);
    if (navrh.hrbet.text) PRIKAZY.hrbetZNazvu();
    doFormulare(); zmena();
    Dialog.info(slov ? `Převzato. Počet stran odhadnut na ${navrh.kniha.strany} (≈ ${slov.toLocaleString('cs-CZ')} slov) – po sazbě ho upřesněte.` : 'Převzato.');
  }
  $('souborText').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    const t = (await f.text()).replace(/\r/g, '')
      .replace(/^#+\s*/gm, '').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*\n]+)\*/g, '$1').replace(/^\s*\*\s*$/gm, '')
      .replace(/\n{3,}/g, '\n\n').trim();
    // odstavce oddělené prázdným řádkem → jeden řádek na odstavec
    navrh.anotace.text = t.split(/\n\s*\n/).map(o => o.replace(/\s*\n\s*/g, ' ')).join('\n');
    doFormulare(); zmena();
  });
  $('souborPismo').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    try { const z = await FONTY.pridej(f); await naplnPisma(); Dialog.info(`Písmo „${z.nazev}“ je přidané – najdete ho ve skupině Vlastní fonty.`); }
    catch (er) { Dialog.chyba(er.message); }
  });
  $('souborNavrh').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (d.format !== 'obalka_knihy' || !d.navrh) throw new Error('Soubor není návrh obálky.');
      for (const [id, o] of Object.entries(d.obrazky || {})) {
        const blob = await (await fetch(o.data)).blob();
        await idbVloz('obrazky', { id, blob, nazev: o.nazev || id });
      }
      navrh = slij(d.navrh, O.VYCHOZI); aktualni = { id: null, nazev: d.nazev || '' };
      $('nazevNavrhu').textContent = aktualni.nazev;
      await nactiObrazkyNavrhu(); doFormulare(); zmena();
      Dialog.info('Návrh načten. Do seznamu uložených ho přidáte přes Uložit.');
    } catch (er) { Dialog.chyba('Návrh nejde načíst: ' + er.message); }
  });

  /* ---------- klávesy ---------- */
  document.addEventListener('keydown', e => {
    const vPoli = e.target.closest('input, textarea, select');
    const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (ctrl && k === 's') { e.preventDefault(); return PRIKAZY.ulozit(); }
    if (ctrl && k === 'o') { e.preventDefault(); return PRIKAZY.otevrit(); }
    if (ctrl && k === 'e') { e.preventDefault(); return PRIKAZY.pdf(); }
    if (ctrl && !vPoli && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); return krokHistorie(1); }
    if (ctrl && !vPoli && k === 'z') { e.preventDefault(); return krokHistorie(-1); }
    if (e.key === 'F1') { e.preventDefault(); return PRIKAZY.napoveda(); }
    if (e.key === 'Escape') zavriNabidky();
    if (!vPoli && !ctrl && !e.altKey && k === 'g') PRIKAZY.vsechnaVoditka();
  });

  /* ---------- start ---------- */
  function naplnVyber(id, obj) {
    $(id).innerHTML = Object.entries(obj).map(([k, v]) => `<option value="${k}">${v.nazev}</option>`).join('');
  }
  naplnVyber('selTiskarna', O.TISKARNY); naplnVyber('selFormat', O.FORMATY); naplnVyber('selPapir', O.PAPIRY);
  sestavTextyPredni();
  document.querySelectorAll('select.vyber-pisma').forEach(sel => { const o = document.createElement('option'); o.value = ziskej(sel.dataset.k); o.textContent = '…'; sel.appendChild(o); });
  $('panel').addEventListener('input', priZmene);
  $('panel').addEventListener('change', priZmene);
  $('zoom').value = String(nast.zoom);
  $('zoom').addEventListener('change', e => { nast.zoom = +e.target.value; ulozNast(); prekresli(); });
  $('nazevNavrhu').textContent = aktualni.nazev;
  if (!window.queryLocalFonts) $('btnSysPisma').title = 'Umí jen Chrome a Edge';
  prepinace(); tlacitkaHistorie(); doFormulare();
  if (typeof ResizeObserver === 'function') new ResizeObserver(() => prekresli()).observe($('platnoObal'));
  ['lsans', navrh.nazev.pismo, navrh.anotace.pismo].forEach(id => nactiPismo(id).catch(() => {}));
  naplnPisma().then(doFormulare);
  nactiObrazkyNavrhu().then(() => { obrazkyDoPanelu(); prekresli(); });
  prekresli();
  window.__obalka = { get navrh() { return navrh; }, set navrh(n) { navrh = slij(n, O.VYCHOZI); doFormulare(); zmena(); }, get scena() { return scena; }, PRIKAZY, hotovaScena, pisma, obrazky };
})();

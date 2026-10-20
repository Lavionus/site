/* ============================================================
   stencil/ui.js – rozhraní stránky „Šablona na sprej“
   Výpočty v stencil/jadro.js (STENCIL), výstupy v stencil/vystup.js.
   Nastavení a ruční můstky: localStorage `webapp_stencil`,
   obrázek: IndexedDB `webapp_stencil` (úložiště `data`, klíč `obrazek`).
   ============================================================ */
(function () {
  'use strict';
  const S = window.STENCIL, V = window.STENCIL_VYSTUP;
  const el = id => document.getElementById(id);
  const KLIC = 'webapp_stencil';

  const VYCHOZI = {
    zdroj: 'obrazek', text: 'STENCIL ART', font: 'bebas', zarovnani: 'center', prostrk: 0, radkovani: 1.1,
    sirka: 300, vyska: 200, pomer: true, okraj: 15, rozliseni: 750,
    jas: 0, kontrast: 0, gama: 1, rozmazani: 0.3,
    vrstev: 1, prahAuto: true, prahyVrstev: [128, 100, 75, 50], kumulativni: true, inverze: false, vyhlazeni: 0.5, minPlocha: 6,
    mustkyAuto: true, smerMustku: 'nejkratsi', mustkuNaOstrov: 2, sirkaMustku: 3,
    kontrolaTenkych: true, limitTenkych: 2, zjednoduseni: 0.7, vyhlazeniVektoru: 1,
    registrace: true, exVrstvy: 'vse', svgStyl: 'vypln', pngDpi: 300, papir: '210x297', orientace: 'auto', papirW: 210, papirH: 297, okrajTisku: 8, preklad: 10,
    barvy: [null, null, null, null], pohled: 'sablona', vrstva: 0, ukazObrysy: false, ukazPodklad: false, podkladNastriku: 'bila',
    rucni: [[], [], [], []],
  };
  let st = nactiNastaveni();

  function nactiNastaveni() {
    let o = {};
    try { o = JSON.parse(localStorage.getItem(KLIC) || '{}') || {}; } catch (e) { o = {}; }
    const s = Object.assign(JSON.parse(JSON.stringify(VYCHOZI)), o);
    if (!Array.isArray(s.rucni) || s.rucni.length !== 4) s.rucni = [[], [], [], []];
    if (!Array.isArray(s.barvy)) s.barvy = [null, null, null, null];
    return s;
  }
  let casUlozeni = 0;
  function uloz() {
    clearTimeout(casUlozeni);
    casUlozeni = setTimeout(() => { try { localStorage.setItem(KLIC, JSON.stringify(st)); } catch (e) { /* plné nebo zakázané úložiště */ } }, 250);
  }

  /* ---------- IndexedDB pro obrázek ---------- */
  let dbSlib = null;
  function db() {
    if (dbSlib) return dbSlib;
    dbSlib = new Promise((ok, chyba) => {
      try {
        const r = indexedDB.open('webapp_stencil', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('data');
        r.onsuccess = () => ok(r.result);
        r.onerror = () => chyba(r.error);
      } catch (e) { chyba(e); }
    });
    dbSlib.catch(() => { dbSlib = null; });
    return dbSlib;
  }
  function idb(rezim, prace) {
    return db().then(d => new Promise((ok, chyba) => {
      const tx = d.transaction('data', rezim), r = prace(tx.objectStore('data'));
      tx.oncomplete = () => ok(r && 'result' in r ? r.result : undefined);
      tx.onerror = () => chyba(tx.error);
    }));
  }
  const ulozObrazek = (blob, nazev) => idb('readwrite', s => s.put({ blob, nazev, cas: Date.now() }, 'obrazek')).catch(() => {});
  const nactiObrazek = () => idb('readonly', s => s.get('obrazek')).catch(() => null);
  const smazObrazek = () => idb('readwrite', s => s.delete('obrazek')).catch(() => {});

  /* ---------- stav výpočtu ---------- */
  let obrazek = null;          // {img, sirka, vyska, nazev}
  let textZdroj = null;        // {sirka, vyska, kresli(ctx,w,h)} nebo {chyba}
  let raster = null, rasterKlic = '';
  let vysl = null;             // výsledek S.zpracuj
  let casVypoctu = 0;
  const pohled = { s: 1, tx: 0, ty: 0, prizpusobit: true };
  let vybrany = -1;            // index ručního můstku v aktuální vrstvě
  let nastroj = 'vyber';
  const historie = [];

  /* ---------- pomocné ---------- */
  const cislo = (v, d) => { const x = parseFloat(String(v).replace(',', '.')); return isFinite(x) ? x : d; };
  const fmt = (x, d) => (Math.round(x * Math.pow(10, d || 0)) / Math.pow(10, d || 0)).toLocaleString('cs-CZ');
  function zdroj() { return st.zdroj === 'text' ? (textZdroj && !textZdroj.chyba ? textZdroj : null) : obrazek; }
  function pocetVrstev() { return Math.max(1, Math.min(4, st.vrstev | 0)); }

  /* ---------- formulářové prvky ↔ stav ---------- */
  const CISLA = ['sirka', 'vyska', 'okraj', 'prostrk', 'radkovani', 'papirW', 'papirH', 'okrajTisku', 'preklad'];
  const POSUVY = { jas: v => fmt(v), kontrast: v => fmt(v), gama: v => fmt(v, 2), rozmazani: v => fmt(v, 1) + ' mm', vyhlazeni: v => fmt(v, 1) + ' mm',
    minPlocha: v => fmt(v) + ' mm²', sirkaMustku: v => fmt(v, 1) + ' mm', limitTenkych: v => fmt(v, 1) + ' mm', zjednoduseni: v => fmt(v, 1), vyhlazeniVektoru: v => fmt(v) };
  const ZASKRT = ['pomer', 'prahAuto', 'kumulativni', 'inverze', 'mustkyAuto', 'kontrolaTenkych', 'registrace', 'ukazObrysy', 'ukazPodklad'];
  const VYBERY = ['zarovnani', 'rozliseni', 'smerMustku', 'mustkuNaOstrov', 'exVrstvy', 'svgStyl', 'pngDpi', 'papir', 'orientace', 'podkladNastriku'];
  // co jen překreslí, co přepočítá
  const JEN_KRESLIT = ['ukazObrysy', 'ukazPodklad', 'podkladNastriku'];
  const BEZ_VYPOCTU = ['exVrstvy', 'svgStyl', 'pngDpi', 'papir', 'orientace', 'papirW', 'papirH', 'okrajTisku', 'preklad', 'registrace'];

  function doFormulare() {
    for (const k of CISLA) el(k).value = st[k];
    for (const k of Object.keys(POSUVY)) { el(k).value = st[k]; vypisPosuv(k); }
    for (const k of ZASKRT) el(k).checked = !!st[k];
    for (const k of VYBERY) el(k).value = String(st[k]);
    el('text').value = st.text;
    nastavPrepinac('druhZdroje', st.zdroj);
    nastavPrepinac('vrstev', String(st.vrstev));
    nastavPrepinac('pohled', st.pohled);
    el('zdrojObrazek').hidden = st.zdroj !== 'obrazek';
    el('zdrojText').hidden = st.zdroj !== 'text';
    el('vlastniPapir').hidden = st.papir !== 'vlastni';
    el('rKumul').hidden = pocetVrstev() < 2;
    el('rPodkladNastriku').hidden = st.pohled !== 'nastrik';
    el('legenda').hidden = st.pohled !== 'sablona';
    kresliPrahy(); kresliBarvyVrstev(); kresliVyberVrstvy();
  }
  function vypisPosuv(k) { const o = document.querySelector(`output[for="${k}"]`); if (o) o.textContent = POSUVY[k](+el(k).value); }
  function nastavPrepinac(id, h) { el(id).querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.h === h))); }

  function navazFormular() {
    for (const k of CISLA) el(k).addEventListener('input', () => {
      const v = cislo(el(k).value, st[k]);
      st[k] = v;
      if ((k === 'sirka' || k === 'vyska') && st.pomer && zdroj()) {
        const z = zdroj(), p = z.vyska / z.sirka;
        if (k === 'sirka') { st.vyska = Math.round(v * p * 10) / 10; el('vyska').value = st.vyska; }
        else { st.sirka = Math.round(v / p * 10) / 10; el('sirka').value = st.sirka; }
      }
      zmena(k);
    });
    for (const k of Object.keys(POSUVY)) el(k).addEventListener('input', () => { st[k] = +el(k).value; vypisPosuv(k); zmena(k); });
    for (const k of ZASKRT) el(k).addEventListener('change', () => {
      st[k] = el(k).checked;
      if (k === 'pomer' && st.pomer) srovnejPomer();
      zmena(k);
    });
    for (const k of VYBERY) el(k).addEventListener('change', () => {
      const v = el(k).value;
      st[k] = /^(rozliseni|mustkuNaOstrov|pngDpi)$/.test(k) ? +v : v;
      if (k === 'papir') el('vlastniPapir').hidden = v !== 'vlastni';
      if (k === 'podkladNastriku') stena = null;
      zmena(k);
    });
    el('text').addEventListener('input', () => { st.text = el('text').value; pripravText(); });
    for (const k of ['zarovnani', 'prostrk', 'radkovani']) el(k).addEventListener(k === 'zarovnani' ? 'change' : 'input', () => pripravText());
    el('druhZdroje').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (st.zdroj === b.dataset.h) return;
      st.zdroj = b.dataset.h; nastavPrepinac('druhZdroje', st.zdroj);
      novaPredloha();
      el('zdrojObrazek').hidden = st.zdroj !== 'obrazek';
      el('zdrojText').hidden = st.zdroj !== 'text';
      el('kObraz').open = st.zdroj === 'obrazek';
      if (st.zdroj === 'text') pripravText(); else { srovnejPomer(); pohled.prizpusobit = true; zmena('zdroj'); }
    });
    el('vrstev').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      st.vrstev = +b.dataset.h; nastavPrepinac('vrstev', b.dataset.h);
      if (st.vrstva >= st.vrstev) st.vrstva = 0;
      el('rKumul').hidden = pocetVrstev() < 2;
      kresliPrahy(); kresliBarvyVrstev(); kresliVyberVrstvy();
      zmena('vrstev');
    });
    el('pohled').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      st.pohled = b.dataset.h; nastavPrepinac('pohled', st.pohled);
      if (st.pohled === 'nastrik' && pocetVrstev() > 1) st.vrstva = -1;
      el('rPodkladNastriku').hidden = st.pohled !== 'nastrik';
      el('legenda').hidden = st.pohled !== 'sablona';
      kresliVyberVrstvy();
      obrazNahledu = null; kresli(); uloz();
    });
  }

  function srovnejPomer() {
    const z = zdroj(); if (!z || !st.pomer) return;
    st.vyska = Math.round(st.sirka * z.vyska / z.sirka * 10) / 10;
    el('vyska').value = st.vyska;
  }

  let casZmeny = 0;
  function zmena(k) {
    uloz();
    if (JEN_KRESLIT.includes(k)) { obrazNahledu = null; kresli(); return; }
    if (BEZ_VYPOCTU.includes(k)) { infoListy(); kresli(); return; }
    naplanujVypocet();
  }
  function naplanujVypocet(hned) {
    clearTimeout(casZmeny);
    el('pocitam').hidden = !zdroj();
    casZmeny = setTimeout(prepocitej, hned ? 0 : 140);
  }

  /* ---------- prahy, histogram, barvy vrstev ---------- */
  const NAZVY_VRSTEV = ['světlá', 'střední', 'tmavší', 'nejtmavší'];
  function nazevVrstvy(i, n) { return n === 1 ? 'Šablona' : `Vrstva ${i + 1} (${i === n - 1 ? 'nejtmavší' : NAZVY_VRSTEV[i]})`; }
  function kresliPrahy() {
    const n = pocetVrstev(), box = el('prahy');
    box.innerHTML = '';
    for (let j = 0; j < n; j++) {
      const id = 'prah' + j;
      box.insertAdjacentHTML('beforeend', `<label class="pop" for="${id}">${n === 1 ? 'Práh – tmavší než' : nazevVrstvy(j, n) + ' – tmavší než'}</label>
        <div class="posuv"><input type="range" id="${id}" min="1" max="254" value="${st.prahyVrstev[j]}"><output for="${id}">${st.prahyVrstev[j]}</output></div>`);
    }
    for (let j = 0; j < n; j++) el('prah' + j).addEventListener('input', e => {
      st.prahyVrstev[j] = +e.target.value;
      e.target.nextElementSibling.textContent = e.target.value;
      if (st.prahAuto) { st.prahAuto = false; el('prahAuto').checked = false; }
      zmena('prah');
    });
  }
  function kresliHistogram() {
    const c = el('histogram'), dpr = window.devicePixelRatio || 1, w = c.clientWidth || 300, h = c.clientHeight || 60;
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    const x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, h);
    if (!vysl) return;
    const hi = vysl.hist; let mx = 0;
    for (let i = 0; i < 256; i++) mx = Math.max(mx, hi[i]);
    const cs = getComputedStyle(document.documentElement);
    x.fillStyle = cs.getPropertyValue('--text-faint').trim() || '#888';
    for (let i = 0; i < 256; i++) {
      const v = Math.sqrt(hi[i] / (mx || 1)) * (h - 4);
      x.fillRect(i / 256 * w, h - v, Math.max(1, w / 256), v);
    }
    const n = pocetVrstev();
    x.lineWidth = 2;
    for (let j = 0; j < n; j++) {
      const t = vysl.prahy[n - 1 - j];
      x.strokeStyle = barvaVrstvy(j); x.beginPath(); x.moveTo((t + 0.5) / 256 * w, 0); x.lineTo((t + 0.5) / 256 * w, h); x.stroke();
    }
    x.strokeStyle = cs.getPropertyValue('--accent').trim(); x.lineWidth = 1; x.setLineDash([3, 3]);
    x.strokeRect(0.5, 0.5, w - 1, h - 1);
  }
  let barvyAuto = ['#111111', '#555555', '#999999', '#cccccc'];
  function barvaVrstvy(j) { return st.barvy[j] || barvyAuto[j] || '#000000'; }
  function kresliBarvyVrstev() {
    const n = pocetVrstev(), box = el('barvyVrstev');
    box.innerHTML = '<label class="pop">Barvy sprejů (pro náhled a PDF)</label>';
    for (let j = 0; j < n; j++) {
      box.insertAdjacentHTML('beforeend', `<div class="vrstva-radek"><span>${j + 1}.</span><span>${nazevVrstvy(j, n)}</span><input type="color" id="barva${j}" value="${barvaVrstvy(j)}" aria-label="Barva vrstvy ${j + 1}"></div>`);
    }
    box.insertAdjacentHTML('beforeend', '<div class="tlacitka"><button type="button" class="btn btn-sec" id="barvyZnovu">↺ Barvy podle předlohy</button></div>');
    for (let j = 0; j < n; j++) el('barva' + j).addEventListener('input', e => { st.barvy[j] = e.target.value; obrazNahledu = null; kresli(); kresliHistogram(); uloz(); });
    el('barvyZnovu').addEventListener('click', () => { st.barvy = [null, null, null, null]; kresliBarvyVrstev(); obrazNahledu = null; kresli(); kresliHistogram(); uloz(); });
  }
  function kresliVyberVrstvy() {
    const n = pocetVrstev(), box = el('vrstvaVyber');
    box.hidden = n < 2 && st.pohled !== 'nastrik';
    let h = '';
    if (st.pohled === 'nastrik' && n > 1) h += `<button type="button" data-h="-1" aria-pressed="${st.vrstva < 0}" title="Všechny vrstvy">vše</button>`;
    if (st.pohled !== 'nastrik' && st.vrstva < 0) st.vrstva = 0;
    for (let j = 0; j < n; j++) h += `<button type="button" data-h="${j}" aria-pressed="${st.vrstva === j}" title="${nazevVrstvy(j, n)} (${j + 1})">${j + 1}</button>`;
    box.innerHTML = n < 2 ? '' : h;
  }
  el('vrstvaVyber').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    vyberVrstvu(+b.dataset.h);
  });
  function vyberVrstvu(j) {
    st.vrstva = j; vybrany = -1; kresliVyberVrstvy(); obrazNahledu = null; kresli(); obnovStav(); uloz();
  }

  /* ---------- zdroj: obrázek ---------- */
  function nactiSoubor(f) {
    if (!f) return;
    if (!/^image\//.test(f.type) && !/\.(png|jpe?g|gif|webp|bmp|svg|avif)$/i.test(f.name || '')) { Dialog.chyba('Tohle není obrázek.'); return; }
    otevriBlob(f, f.name || 'obrázek').then(ok => { if (ok) ulozObrazek(f, f.name || 'obrázek'); });
  }
  // nová předloha: ruční můstky staré předlohy by ležely jinde → zpět na automatiku
  function novaPredloha() {
    const n = st.rucni.reduce((a, b) => a + b.length, 0);
    if (!n && st.mustkyAuto) return;
    zaloha();
    st.rucni = [[], [], [], []]; st.mustkyAuto = true; el('mustkyAuto').checked = true; vybrany = -1;
    if (n) Dialog.info('Nová předloha: ruční můstky odstraněny (Ctrl+Z vrátí), můstky zase navrhuje automatika.');
  }
  function otevriBlob(blob, nazev) {
    return new Promise(ok => {
      const url = URL.createObjectURL(blob), img = new Image();
      img.onload = () => {
        if (obrazek && obrazek.url) URL.revokeObjectURL(obrazek.url);
        obrazek = { img, sirka: img.naturalWidth || 300, vyska: img.naturalHeight || 300, nazev, url };
        novaPredloha();
        el('infoObrazek').textContent = `${nazev} · ${img.naturalWidth} × ${img.naturalHeight} px`;
        if (st.zdroj !== 'obrazek') { st.zdroj = 'obrazek'; doFormulare(); }
        srovnejPomer(); pohled.prizpusobit = true; rasterKlic = '';
        naplanujVypocet(true); ok(true);
      };
      img.onerror = () => { URL.revokeObjectURL(url); Dialog.chyba('Obrázek se nepodařilo otevřít.'); ok(false); };
      img.src = url;
    });
  }
  function ukazkovyObrazek() {
    const c = document.createElement('canvas'); c.width = 900; c.height = 600;
    const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, 900, 600);
    // slunce s přechodem (vhodné na víc vrstev)
    const SX = 250, SY = 245;
    const g = x.createRadialGradient(SX, SY, 20, SX, SY, 150);
    g.addColorStop(0, '#d9d9d9'); g.addColorStop(0.55, '#8a8a8a'); g.addColorStop(1, '#2a2a2a');
    x.fillStyle = g; x.beginPath(); x.arc(SX, SY, 140, 0, Math.PI * 2); x.fill();
    x.strokeStyle = '#222'; x.lineWidth = 16;
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; x.beginPath(); x.moveTo(SX + Math.cos(a) * 160, SY + Math.sin(a) * 160); x.lineTo(SX + Math.cos(a) * 210, SY + Math.sin(a) * 210); x.stroke(); }
    // kroužek a hvězda
    x.lineWidth = 34; x.beginPath(); x.arc(680, 200, 110, 0, Math.PI * 2); x.stroke();
    x.fillStyle = '#222'; x.beginPath();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? 26 : 62, a = -Math.PI / 2 + i * Math.PI / 5; x.lineTo(680 + Math.cos(a) * r, 200 + Math.sin(a) * r); }
    x.fill();
    x.font = 'bold 170px "Arial Black", Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'alphabetic';
    x.fillStyle = '#1b1b1b'; x.fillText('ABO', 640, 560);
    c.toBlob(b => { if (b) { otevriBlob(b, 'ukázka.png').then(ok => { if (ok) ulozObrazek(b, 'ukázka.png'); }); } }, 'image/png');
  }

  /* ---------- zdroj: text (opentype) ---------- */
  let fonty = [], vyberFontu = null, cisloTextu = 0;
  function pripravFonty() {
    if (!window.FONTY) return;
    vyberFontu = FONTY.vyberFontu(el('font'), {
      ukazka: () => (st.text || 'STENCIL').split('\n')[0] || 'STENCIL',
      poznamka: f => f.druh === 'sablona' ? 'šablonové' : '',
      onZmena: id => { st.font = id; uloz(); pripravText(); },
      onNahrat: () => el('souborFontu').click(),
      onSmazat: async f => {
        if (!(await Dialog.potvrd(`Smazat font „${f.nazev}“? Zmizí i z ostatních stránek s písmy.`))) return;
        await FONTY.smaz(f.id); await obnovFonty(); pripravText();
      },
    });
    el('souborFontu').addEventListener('change', async () => {
      const f = el('souborFontu').files[0]; el('souborFontu').value = '';
      if (!f) return;
      try { const z = await FONTY.pridej(f); st.font = z.id; await obnovFonty(); pripravText(); Dialog.info('Font „' + z.nazev + '“ uložen'); }
      catch (e) { Dialog.chyba(e.message || String(e)); }
    });
    obnovFonty();
  }
  async function obnovFonty() {
    try { fonty = await FONTY.seznam(); } catch (e) { fonty = FONTY.KATALOG.map(f => Object.assign({ vlastni: false }, f)); }
    if (!fonty.some(f => f.id === st.font)) st.font = 'bebas';
    vyberFontu.nastav(fonty, st.font);
  }
  async function pripravText() {
    st.zarovnani = el('zarovnani').value; st.prostrk = cislo(el('prostrk').value, 0); st.radkovani = cislo(el('radkovani').value, 1.1);
    uloz();
    if (st.zdroj !== 'text') return;
    const beh = ++cisloTextu;
    let font;
    try { font = await FONTY.opentype(st.font); }
    catch (e) { if (beh !== cisloTextu) return; textZdroj = { chyba: e.message || String(e) }; vysl = null; kresli(); obnovStav(); return; }
    if (beh !== cisloTextu) return;
    if (vyberFontu) vyberFontu.obnovUkazky();
    textZdroj = sestavText(font, st.text || ' ', st);
    rasterKlic = '';
    srovnejPomer(); pohled.prizpusobit = true;
    naplanujVypocet(true);
  }
  // rozvrhne řádky textu do cest Path2D (jednotky = body písma při velikosti 100)
  function sestavText(font, text, o) {
    const vel = 100, radky = String(text).replace(/\r/g, '').split('\n');
    const scale = vel / font.unitsPerEm, mez = (o.prostrk || 0) / 100 * vel;
    const vyskaRadku = vel * (o.radkovani || 1.1);
    const casti = [];
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    radky.forEach((radek, ri) => {
      const glyfy = font.stringToGlyphs(radek);
      let x = 0; const y = ri * vyskaRadku, cesty = [];
      glyfy.forEach((g, i) => {
        const p = g.getPath(x, y, vel);
        cesty.push(p.toPathData(2));
        x += g.advanceWidth * scale + mez;
        if (i < glyfy.length - 1) x += font.getKerningValue(g, glyfy[i + 1]) * scale;
      });
      casti.push({ cesty, sirka: x - (glyfy.length ? mez : 0), y });
    });
    const maxS = Math.max(...casti.map(c => c.sirka), 1);
    // posun řádků podle zarovnání a výpočet obálky
    const mer = document.createElement('canvas').getContext('2d');
    for (const c of casti) {
      c.dx = o.zarovnani === 'center' ? (maxS - c.sirka) / 2 : o.zarovnani === 'right' ? maxS - c.sirka : 0;
      c.path = new Path2D(c.cesty.join(' '));
    }
    // obálka z vlastních obrysů (body cest)
    for (const c of casti) for (const d of c.cesty) {
      const cisla = d.match(/-?\d*\.?\d+(?:e-?\d+)?/g) || [];
      for (let i = 0; i + 1 < cisla.length; i += 2) {
        const X = +cisla[i] + c.dx, Y = +cisla[i + 1];
        if (X < x0) x0 = X; if (X > x1) x1 = X; if (Y < y0) y0 = Y; if (Y > y1) y1 = Y;
      }
    }
    void mer;
    if (!isFinite(x0)) { x0 = 0; y0 = -vel; x1 = vel; y1 = 0; }
    const m = Math.max(2, 0.03 * Math.max(x1 - x0, y1 - y0));
    x0 -= m; y0 -= m; x1 += m; y1 += m;
    return {
      sirka: x1 - x0, vyska: y1 - y0, nazev: 'text',
      kresli(ctx, w, h) {
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
        ctx.save(); ctx.scale(w / (x1 - x0), h / (y1 - y0)); ctx.translate(-x0, -y0);
        ctx.fillStyle = '#000';
        for (const c of casti) { ctx.save(); ctx.translate(c.dx, 0); ctx.fill(c.path); ctx.restore(); }
        ctx.restore();
      },
    };
  }

  /* ---------- rastr a výpočet ---------- */
  function rastruj() {
    const z = zdroj(); if (!z) return null;
    const sirMm = Math.max(5, st.sirka), vysMm = Math.max(5, st.vyska);
    const pxNaMm = st.rozliseni / Math.max(sirMm, vysMm);
    const w = Math.max(8, Math.round(sirMm * pxNaMm)), h = Math.max(8, Math.round(vysMm * pxNaMm));
    const klic = [st.zdroj, z === obrazek ? obrazek.url : JSON.stringify([st.text, st.font, st.zarovnani, st.prostrk, st.radkovani]), w, h].join('|');
    if (klic === rasterKlic && raster) return raster;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.fillStyle = '#fff'; x.fillRect(0, 0, w, h);
    if (z === obrazek) { x.imageSmoothingQuality = 'high'; x.drawImage(obrazek.img, 0, 0, w, h); }
    else z.kresli(x, w, h);
    const rgba = x.getImageData(0, 0, w, h).data;
    raster = { w, h, pxNaMm: w / sirMm, pxNaMmY: h / vysMm, rgba, g: S.sedotisk(rgba, w, h), canvas: c };
    rasterKlic = klic;
    return raster;
  }
  function nastaveniVypoctu(r) {
    return {
      pxNaMm: (r.pxNaMm + r.pxNaMmY) / 2, jas: st.zdroj === 'text' ? 0 : st.jas, kontrast: st.zdroj === 'text' ? 0 : st.kontrast, gama: st.zdroj === 'text' ? 1 : st.gama,
      rozmazani: st.zdroj === 'text' ? 0 : st.rozmazani,
      prahAuto: st.prahAuto, prahy: st.prahyVrstev.slice(0, pocetVrstev()), vrstev: pocetVrstev(), kumulativni: st.kumulativni, inverze: st.inverze,
      okraj: st.okraj, vyhlazeni: st.vyhlazeni, minPlocha: st.minPlocha,
      sirkaMustku: st.sirkaMustku, mustkyAuto: st.mustkyAuto, mustkuNaOstrov: st.mustkuNaOstrov, smerMustku: st.smerMustku,
      kontrolaTenkych: st.kontrolaTenkych, limitTenkych: st.limitTenkych, zjednoduseni: st.zjednoduseni, vyhlazeniVektoru: st.vyhlazeniVektoru,
    };
  }
  function prepocitej() {
    const r = rastruj();
    el('pocitam').hidden = true;
    if (!r) { vysl = null; obrazNahledu = null; kresli(); obnovStav(); return; }
    const t0 = performance.now();
    try {
      vysl = S.zpracuj(r.g, r.w, r.h, nastaveniVypoctu(r), st.rucni);
    } catch (e) { console.error(e); Dialog.chyba('Výpočet selhal: ' + (e.message || e)); vysl = null; }
    casVypoctu = performance.now() - t0;
    if (vysl && st.prahAuto) {
      const n = pocetVrstev();
      for (let j = 0; j < n; j++) { st.prahyVrstev[j] = vysl.prahy[n - 1 - j]; const s = el('prah' + j); if (s) { s.value = st.prahyVrstev[j]; s.nextElementSibling.textContent = s.value; } }
    }
    spocitejBarvyAuto();
    if (vybrany >= (st.rucni[st.vrstva] || []).length) vybrany = -1;
    obrazNahledu = null;
    if (pohled.prizpusobit) prizpusob();
    kresli(); kresliHistogram(); obnovStav(); infoListy();
  }
  function spocitejBarvyAuto() {
    if (!vysl || !raster) return;
    const n = pocetVrstev(), t = vysl.prahy, g = raster.g, rgba = raster.rgba, sum = [];
    for (let j = 0; j < n; j++) sum.push([0, 0, 0, 0]);
    for (let i = 0; i < g.length; i++) {
      const v = g[i];
      for (let j = 0; j < n; j++) {
        const horni = t[n - 1 - j], dolni = j === n - 1 ? -1 : t[n - 2 - j];
        if (v <= horni && v > dolni) { const s = sum[j]; s[0] += rgba[i * 4]; s[1] += rgba[i * 4 + 1]; s[2] += rgba[i * 4 + 2]; s[3]++; break; }
      }
    }
    const hex = c => '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
    barvyAuto = sum.map((s, j) => n === 1 ? '#111111' : s[3] ? hex([s[0] / s[3], s[1] / s[3], s[2] / s[3]]) : ['#111111', '#555555', '#999999', '#cccccc'][j]);
    for (let j = 0; j < n; j++) { const i = el('barva' + j); if (i && !st.barvy[j]) i.value = barvaVrstvy(j); }
  }

  /* ---------- náhled ---------- */
  const platno = el('platno'), ctx = platno.getContext('2d');
  let obrazNahledu = null, stena = null;
  const MAT = [47, 127, 159], OSTROV = [229, 57, 53], TENKE = [255, 152, 0], MUSTEK = [255, 213, 79];

  function velikostPlatna() {
    const r = el('obalPlatna').getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    const w = Math.max(10, Math.round(r.width)), h = Math.max(10, Math.round(r.height));
    if (platno.width !== Math.round(w * dpr) || platno.height !== Math.round(h * dpr)) { platno.width = Math.round(w * dpr); platno.height = Math.round(h * dpr); }
    return { w, h, dpr };
  }
  function prizpusob() {
    if (!vysl) return;
    const { w, h } = velikostPlatna();
    const s = Math.min((w - 24) / vysl.W, (h - 24) / vysl.H);
    pohled.s = s > 0 ? s : 1; pohled.tx = (w - vysl.W * pohled.s) / 2; pohled.ty = (h - vysl.H * pohled.s) / 2;
    pohled.prizpusobit = true;
  }
  function vytvorObrazNahledu() {
    const W = vysl.W, H = vysl.H, pad = vysl.pad, c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d'), im = x.createImageData(W, H), d = im.data;
    const n = vysl.vrstvy.length, L = Math.max(0, Math.min(n - 1, st.vrstva));
    const rw = raster.w, rgba = raster.rgba;
    const podklad = (X, Y) => { const xx = X - pad, yy = Y - pad; if (xx < 0 || yy < 0 || xx >= rw || yy >= raster.h) return null; return (yy * rw + xx) * 4; };
    if (st.pohled === 'original') {
      for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) {
        const i = (Y * W + X) * 4, p = podklad(X, Y);
        if (p == null) { d[i] = d[i + 1] = d[i + 2] = 225; } else { d[i] = rgba[p]; d[i + 1] = rgba[p + 1]; d[i + 2] = rgba[p + 2]; }
        d[i + 3] = 255;
      }
    } else if (st.pohled === 'nastrik') {
      const zed = dejStenu(W, H);
      d.set(zed);
      const vrstvy = st.vrstva < 0 || n === 1 ? vysl.vrstvy.map((_, j) => j) : [L];
      for (const j of vrstvy) {
        const m = vysl.vrstvy[j].finalni, f = new Float32Array(W * H);
        for (let i = 0; i < f.length; i++) f[i] = m[i] ? 1 : 0;
        const a = S.rozmaz(f, W, H, 0.6 + 0.004 * Math.max(W, H) / 10);
        const [cr, cg, cb] = V.hexRgb(barvaVrstvy(j));
        let sem = 12345 + j * 977;
        for (let i = 0; i < f.length; i++) {
          let al = a[i]; if (al <= 0.01) continue;
          sem = (sem * 1103515245 + 12345) & 0x7fffffff;
          al = Math.min(1, al * (0.86 + 0.14 * (sem / 0x7fffffff)));
          const k = i * 4;
          d[k] = d[k] * (1 - al) + cr * al; d[k + 1] = d[k + 1] * (1 - al) + cg * al; d[k + 2] = d[k + 2] * (1 - al) + cb * al;
        }
      }
    } else {
      const v = vysl.vrstvy[L], fin = v.finalni, mas = v.maska, ten = v.tenka.mapa, lab = v.stitky;
      const nep = new Set(v.nepodlozene.map(o => o.id));
      for (let i = 0; i < W * H; i++) {
        const k = i * 4; let c;
        if (fin[i]) {
          if (st.ukazPodklad) { const X = i % W, p = podklad(X, (i - X) / W); if (p != null) { d[k] = 255 - (255 - rgba[p]) * 0.45; d[k + 1] = 255 - (255 - rgba[p + 1]) * 0.45; d[k + 2] = 255 - (255 - rgba[p + 2]) * 0.45; d[k + 3] = 255; continue; } }
          d[k] = d[k + 1] = d[k + 2] = 255; d[k + 3] = 255; continue;
        }
        if (lab[i] >= 0 && nep.has(lab[i])) c = OSTROV;
        else if (ten[i]) c = TENKE;
        else if (mas[i]) c = MUSTEK;
        else c = MAT;
        d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2]; d[k + 3] = 255;
      }
      // registrační otvory
      for (const z of znackyPx()) for (let Y = Math.floor(z.y - z.r); Y <= Math.ceil(z.y + z.r); Y++) for (let X = Math.floor(z.x - z.r); X <= Math.ceil(z.x + z.r); X++) {
        if (X < 0 || Y < 0 || X >= W || Y >= H || (X + 0.5 - z.x) ** 2 + (Y + 0.5 - z.y) ** 2 > z.r * z.r) continue;
        const k = (Y * W + X) * 4; d[k] = d[k + 1] = d[k + 2] = 255;
      }
    }
    x.putImageData(im, 0, 0);
    return c;
  }
  function dejStenu(W, H) {
    if (stena && stena.W === W && stena.H === H && stena.typ === st.podkladNastriku) return stena.data;
    const d = new Uint8ClampedArray(W * H * 4), typ = st.podkladNastriku;
    let sem = 99;
    const rnd = () => { sem = (sem * 1103515245 + 12345) & 0x7fffffff; return sem / 0x7fffffff; };
    const zaklad = { bila: [244, 243, 238], beton: [168, 168, 162], cihly: [160, 72, 52], karton: [196, 160, 112], cerna: [30, 30, 32] }[typ] || [240, 240, 240];
    const cihla = Math.max(6, Math.round(H / 14));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      let k = 1 + (rnd() - 0.5) * (typ === 'beton' ? 0.16 : typ === 'bila' ? 0.03 : 0.08);
      let c = zaklad;
      if (typ === 'cihly') {
        const r = Math.floor(y / cihla), off = r % 2 ? cihla : 0, sp = (x + off) % (cihla * 2);
        if (y % cihla < Math.max(1, cihla / 8) || sp < Math.max(1, cihla / 8)) c = [200, 196, 186];
        else k *= 0.92 + 0.16 * ((Math.sin(r * 12.9 + Math.floor((x + off) / (cihla * 2)) * 78.2) + 1) / 2);
      }
      if (typ === 'karton' && (y % 7 === 0)) k *= 0.97;
      d[i] = c[0] * k; d[i + 1] = c[1] * k; d[i + 2] = c[2] * k; d[i + 3] = 255;
    }
    stena = { W, H, typ, data: d };
    return d;
  }
  function znackyPx() {
    if (!vysl || !st.registrace || pocetVrstev() < 2) return [];
    const okrajMm = vysl.pad / vysl.pxNaMm;
    if (okrajMm < 4) return [];
    const r = Math.min(2.5, okrajMm / 4) * vysl.pxNaMm, s = vysl.pad / 2;
    return [[s, s], [vysl.W - s, s], [vysl.W - s, vysl.H - s], [s, vysl.H - s]].map(([x, y]) => ({ x, y, r }));
  }
  // můstky aktuální vrstvy v px: ruční (upravitelné) + automatické
  function mustkyPx(L) {
    if (!vysl) return { rucni: [], auto: [] };
    const v = vysl.vrstvy[L]; if (!v) return { rucni: [], auto: [] };
    return { rucni: v.mustkyRucni, auto: v.mustkyAuto };
  }
  function kresli() {
    const { w, h, dpr } = velikostPlatna();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, platno.width, platno.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    el('prazdno').hidden = !!vysl;
    if (st.zdroj === 'text' && textZdroj && textZdroj.chyba) { el('prazdno').hidden = false; el('prazdno').textContent = textZdroj.chyba; }
    if (!vysl) return;
    if (!obrazNahledu) obrazNahledu = vytvorObrazNahledu();
    const s = pohled.s;
    ctx.imageSmoothingEnabled = s < 2;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 10;
    ctx.drawImage(obrazNahledu, pohled.tx, pohled.ty, vysl.W * s, vysl.H * s);
    ctx.restore();
    const L = Math.max(0, st.vrstva), v = vysl.vrstvy[L];
    const P = (x, y) => [pohled.tx + x * s, pohled.ty + y * s];
    if (st.pohled === 'sablona' && v) {
      // okraj motivu (kde končí obrázek a začíná rám)
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
      ctx.strokeRect(pohled.tx + vysl.pad * s, pohled.ty + vysl.pad * s, vysl.w * s, vysl.h * s);
      ctx.setLineDash([]);
      if (st.ukazObrysy) {
        ctx.strokeStyle = '#d500f9'; ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (const p of v.obrysy) { const [x0, y0] = P(p[0][0], p[0][1]); ctx.moveTo(x0, y0); for (let i = 1; i < p.length; i++) { const [x, y] = P(p[i][0], p[i][1]); ctx.lineTo(x, y); } ctx.closePath(); }
        ctx.stroke();
      }
      // nepodložené ostrůvky – kroužek, aby byly vidět i drobné
      ctx.strokeStyle = '#e53935'; ctx.lineWidth = 2; ctx.setLineDash([5, 3]);
      for (const o of v.nepodlozene.slice(0, 300)) {
        const [x0, y0, x1, y1] = o.bbox, [cx, cy] = P((x0 + x1 + 1) / 2, (y0 + y1 + 1) / 2);
        ctx.beginPath(); ctx.arc(cx, cy, Math.max(10, Math.hypot(x1 - x0 + 1, y1 - y0 + 1) / 2 * s + 5), 0, Math.PI * 2); ctx.stroke();
      }
      ctx.setLineDash([]);
      if (v.tenka.pocet && s < 3) {
        ctx.strokeStyle = '#ff9800'; ctx.lineWidth = 1.5;
        for (const m of v.tenka.mista.slice(0, 300)) { const [cx, cy] = P(m.x + 0.5, m.y + 0.5); ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2); ctx.stroke(); }
      }
      // můstky
      const { rucni, auto } = mustkyPx(L);
      const akc = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#6aa6fd';
      const kresliMustek = (b, druh, i) => {
        const [ax, ay] = P(b.ax + 0.5, b.ay + 0.5), [bx, by] = P(b.bx + 0.5, b.by + 0.5);
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(20,20,20,.55)'; ctx.lineWidth = Math.max(3, b.s * s) + 2;
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
        ctx.strokeStyle = 'rgb(255,213,79)'; ctx.lineWidth = Math.max(2, b.s * s);
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
        ctx.lineCap = 'butt';
        if (druh === 'rucni' && i === vybrany) {
          ctx.strokeStyle = akc; ctx.lineWidth = 2; ctx.setLineDash([]);
          ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
          for (const [hx, hy] of [[ax, ay], [bx, by]]) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(hx, hy, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
        } else if (druh === 'auto') {
          ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
          ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); ctx.setLineDash([]);
        }
      };
      auto.forEach((b, i) => kresliMustek(b, 'auto', i));
      rucni.forEach((b, i) => kresliMustek(b, 'rucni', i));
      if (tazeni && tazeni.typ === 'novy') kresliMustek(tazeni.b, 'novy', -1);
    }
    el('nSmazat').disabled = vybrany < 0;
  }

  /* ---------- stav a hlášení ---------- */
  function obnovStav() {
    const box = el('stav'), hl = el('hlaseni');
    if (!vysl) { box.innerHTML = zdroj() ? '' : '<span>Zatím bez předlohy.</span>'; hl.innerHTML = ''; el('infoVelikost').textContent = ''; return; }
    const n = vysl.vrstvy.length, L = Math.max(0, st.vrstva), v = vysl.vrstvy[L];
    const listW = vysl.W / vysl.pxNaMm, listH = vysl.H / vysl.pxNaMm;
    el('infoVelikost').textContent = `Celý list šablony ${fmt(st.sirka + 2 * st.okraj)} × ${fmt(st.vyska + 2 * st.okraj)} mm · výpočet ${vysl.W} × ${vysl.H} px (${fmt(vysl.pxNaMm, 2)} px/mm, detail ${fmt(1 / vysl.pxNaMm, 2)} mm).`;
    void listW; void listH;
    let h = '';
    h += `<span>${n > 1 ? 'Vrstva <b>' + (L + 1) + '/' + n + '</b>' : '<b>Šablona</b>'}</span>`;
    h += `<span>ostrůvků <b>${v.puvodniOstrovy}</b></span>`;
    h += v.nepodlozene.length ? `<span class="zle">nepodložených ${v.nepodlozene.length}</span>` : `<span class="dobre">vše podloženo ✓</span>`;
    h += `<span>můstků <b>${v.mustkyRucni.length + v.mustkyAuto.length}</b>${v.mustkyAuto.length ? ' (auto ' + v.mustkyAuto.length + ')' : ''}</span>`;
    if (st.kontrolaTenkych) h += v.tenka.pocet ? `<span class="pozor">tenkých míst ${v.tenka.pocet}</span>` : '<span class="dobre">bez tenkých míst</span>';
    h += `<span>obrysů <b>${v.obrysy.length}</b></span>`;
    h += `<span>${fmt(casVypoctu)} ms</span>`;
    box.innerHTML = h;
    // hlášení přes všechny vrstvy
    const zpr = [];
    vysl.vrstvy.forEach((x, j) => {
      const kde = n > 1 ? `Vrstva ${j + 1}: ` : '';
      if (x.nepodlozene.length) zpr.push({ t: 'zle', text: `${kde}${x.nepodlozene.length} ${x.nepodlozene.length === 1 ? 'ostrůvek nemá' : 'ostrůvků nemá'} můstek – při vyříznutí vypadne.`, j, akce: [['Ukázat', () => ukazMisto(j, x.nepodlozene, 'o')], ['Navrhnout můstky', () => doplnMustky(j)]] });
      if (st.kontrolaTenkych && x.tenka.pocet) zpr.push({ t: 'pozor', text: `${kde}${x.tenka.pocet} ${x.tenka.pocet === 1 ? 'tenké místo' : x.tenka.pocet < 5 ? 'tenká místa' : 'tenkých míst'} užší než ${fmt(st.limitTenkych, 1)} mm.`, j, akce: [['Ukázat', () => ukazMisto(j, x.tenka.mista, 't')]] });
      if (x.obrysy.length > 4000) zpr.push({ t: 'pozor', text: `${kde}${x.obrysy.length} obrysů – na řezání hodně. Zvyšte „Odstranit drobnosti“ nebo rozmazání.` });
    });
    if (n > 1 && st.registrace && st.okraj < 4) zpr.push({ t: 'pozor', text: 'Rám je užší než 4 mm – registrační otvory se nevejdou. Rozšiřte rám.' });
    if (st.okraj < 5) zpr.push({ t: 'pozor', text: 'Úzký rám: šablona se snadno pomačká a sprej přestříká okraj. Doporučeno aspoň 10–20 mm.' });
    if (st.sirkaMustku < st.limitTenkych && st.kontrolaTenkych) zpr.push({ t: 'pozor', text: `Můstky (${fmt(st.sirkaMustku, 1)} mm) jsou užší než nejmenší šířka materiálu – kontrola je označí jako tenké.` });
    hl.innerHTML = '';
    for (const z of zpr) {
      const d = document.createElement('div'); d.className = 'h-' + z.t;
      d.innerHTML = `<span>${z.t === 'zle' ? '⛔' : '⚠️'} ${z.text}</span>`;
      for (const [txt, fn] of z.akce || []) { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-sec'; b.textContent = txt; b.onclick = fn; d.appendChild(b); }
      hl.appendChild(d);
    }
  }
  const ukazovane = { o: 0, t: 0 };
  function ukazMisto(j, seznam, druh) {
    if (!seznam.length) return;
    if (st.vrstva !== j) { st.vrstva = j; kresliVyberVrstvy(); obrazNahledu = null; }
    if (st.pohled !== 'sablona') { st.pohled = 'sablona'; nastavPrepinac('pohled', 'sablona'); el('legenda').hidden = false; el('rPodkladNastriku').hidden = true; obrazNahledu = null; }
    const i = ukazovane[druh]++ % seznam.length, m = seznam[i];
    const cx = m.bbox ? (m.bbox[0] + m.bbox[2]) / 2 : m.x, cy = m.bbox ? (m.bbox[1] + m.bbox[3]) / 2 : m.y;
    const { w, h } = velikostPlatna();
    const vel = m.bbox ? Math.max(m.bbox[2] - m.bbox[0], m.bbox[3] - m.bbox[1]) : 10;
    pohled.s = Math.max(pohled.s, Math.min(8, Math.min(w, h) / Math.max(30, vel * 4)));
    pohled.tx = w / 2 - cx * pohled.s; pohled.ty = h / 2 - cy * pohled.s; pohled.prizpusobit = false;
    kresli(); obnovStav();
  }

  /* ---------- úpravy můstků ---------- */
  function zaloha() { historie.push(JSON.stringify({ r: st.rucni, a: st.mustkyAuto })); if (historie.length > 60) historie.shift(); }
  function zpet() {
    const z = historie.pop(); if (!z) return;
    const o = JSON.parse(z); st.rucni = o.r; st.mustkyAuto = o.a; el('mustkyAuto').checked = o.a; vybrany = -1; uloz(); naplanujVypocet(true);
  }
  const naNorm = b => S.mustekNaNorm(b, vysl.pad, vysl.w, vysl.h, vysl.pxNaMm);
  // první ruční zásah: automatické můstky se převezmou do ručních a automatika se vypne
  function prevezmiAuto() {
    if (!st.mustkyAuto || !vysl) return;
    vysl.vrstvy.forEach((v, j) => { for (const b of v.mustkyAuto) st.rucni[j].push(naNorm(b)); v.mustkyRucni = v.mustkyRucni.concat(v.mustkyAuto); v.mustkyAuto = []; });
    st.mustkyAuto = false; el('mustkyAuto').checked = false;
    Dialog.info('Automatické můstky převzaty do ručních úprav, automatika vypnuta.');
  }
  function doplnMustky(j, bod) {
    if (!vysl) return;
    zaloha();
    const vrstvy = j == null ? vysl.vrstvy.map((_, i) => i) : [j];
    let pridano = 0;
    for (const i of vrstvy) {
      const v = vysl.vrstvy[i];
      const nove = S.navrhniMustky(v.finalni, vysl.W, vysl.H, { sirka: Math.max(2, st.sirkaMustku * vysl.pxNaMm), naOstrov: st.mustkuNaOstrov, smer: st.smerMustku, jenOstrov: bod });
      for (const b of nove) st.rucni[i].push(naNorm(b));
      pridano += nove.length;
    }
    if (!pridano) { historie.pop(); Dialog.info('Všechny ostrůvky už jsou podložené.'); return; }
    uloz(); naplanujVypocet(true);
  }
  el('doplnit').addEventListener('click', () => doplnMustky(null));
  el('smazatRucni').addEventListener('click', async () => {
    const n = st.rucni.reduce((s, a) => s + a.length, 0);
    if (!n) { Dialog.info('Žádné ruční můstky nejsou.'); return; }
    if (!(await Dialog.potvrd(`Smazat všech ${n} ručních můstků ve všech vrstvách?`))) return;
    zaloha(); st.rucni = [[], [], [], []]; vybrany = -1; uloz(); naplanujVypocet(true);
  });
  function smazVybrany() {
    if (vybrany < 0) return;
    zaloha(); st.rucni[st.vrstva].splice(vybrany, 1); vybrany = -1; uloz(); naplanujVypocet(true);
  }
  el('nSmazat').addEventListener('click', smazVybrany);
  function nastavNastroj(n) {
    nastroj = n; el('nVyber').setAttribute('aria-pressed', String(n === 'vyber')); el('nMustek').setAttribute('aria-pressed', String(n === 'mustek'));
    platno.classList.toggle('kreslit', n === 'mustek');
  }
  el('nVyber').addEventListener('click', () => nastavNastroj('vyber'));
  el('nMustek').addEventListener('click', () => nastavNastroj(nastroj === 'mustek' ? 'vyber' : 'mustek'));

  /* ---------- myš a dotyk ---------- */
  const ukazatele = new Map();
  let tazeni = null, stipnuti = null;
  const naMrizku = (cx, cy) => [(cx - pohled.tx) / pohled.s - 0.5, (cy - pohled.ty) / pohled.s - 0.5];
  function bodUdalosti(e) { const r = platno.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  function vzdUsecky(px, py, b) {
    const dx = b.bx - b.ax, dy = b.by - b.ay, l2 = dx * dx + dy * dy;
    let t = l2 ? ((px - b.ax) * dx + (py - b.ay) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t));
    return Math.hypot(b.ax + t * dx - px, b.ay + t * dy - py);
  }
  function najdiMustek(gx, gy) {
    const { rucni, auto } = mustkyPx(Math.max(0, st.vrstva)), tol = 10 / pohled.s;
    let nej = null, nd = Infinity;
    rucni.forEach((b, i) => { const d = vzdUsecky(gx, gy, b) - b.s / 2; if (d < tol && d < nd) { nd = d; nej = { druh: 'rucni', i }; } });
    if (!nej) auto.forEach((b, i) => { const d = vzdUsecky(gx, gy, b) - b.s / 2; if (d < tol && d < nd) { nd = d; nej = { druh: 'auto', i }; } });
    return nej;
  }
  platno.addEventListener('pointerdown', e => {
    if (!vysl) return;
    try { platno.setPointerCapture(e.pointerId); } catch (_) { /* syntetická událost */ }
    const [cx, cy] = bodUdalosti(e);
    ukazatele.set(e.pointerId, [cx, cy]);
    if (ukazatele.size === 2) {
      // dva prsty: zrušit rozdělanou úpravu a přiblížovat
      if (tazeni && tazeni.typ === 'novy') tazeni = null;
      const [a, b] = [...ukazatele.values()];
      stipnuti = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), mx: (a[0] + b[0]) / 2, my: (a[1] + b[1]) / 2, s: pohled.s, tx: pohled.tx, ty: pohled.ty };
      tazeni = null; kresli(); return;
    }
    if (ukazatele.size > 2) return;
    const [gx, gy] = naMrizku(cx, cy);
    const L = Math.max(0, st.vrstva);
    if (st.pohled === 'sablona' && nastroj === 'mustek') {
      const b = { ax: gx, ay: gy, bx: gx, by: gy, s: Math.max(2, st.sirkaMustku * vysl.pxNaMm) };
      tazeni = { typ: 'novy', b, x0: cx, y0: cy };
      return;
    }
    if (st.pohled === 'sablona') {
      // úchyty vybraného můstku
      const { rucni } = mustkyPx(L);
      if (vybrany >= 0 && rucni[vybrany]) {
        const b = rucni[vybrany], tol = 12 / pohled.s;
        if (Math.hypot(gx - b.ax, gy - b.ay) < tol) { tazeni = { typ: 'konec', k: 'a', x0: cx, y0: cy }; zaloha(); return; }
        if (Math.hypot(gx - b.bx, gy - b.by) < tol) { tazeni = { typ: 'konec', k: 'b', x0: cx, y0: cy }; zaloha(); return; }
      }
      const z = najdiMustek(gx, gy);
      if (z) {
        zaloha();
        if (z.druh === 'auto') {
          const pocetRucnich = mustkyPx(L).rucni.length;
          prevezmiAuto();
          vybrany = pocetRucnich + z.i;
        } else vybrany = z.i;
        const b = mustkyPx(L).rucni[vybrany];
        tazeni = { typ: 'posun', x0: cx, y0: cy, puv: Object.assign({}, b), pohnuto: false };
        kresli(); return;
      }
      if (vybrany >= 0) { vybrany = -1; kresli(); }
    }
    tazeni = { typ: 'pohled', x0: cx, y0: cy, tx: pohled.tx, ty: pohled.ty, gx, gy, pohnuto: false };
  });
  platno.addEventListener('pointermove', e => {
    if (!ukazatele.has(e.pointerId)) return;
    const [cx, cy] = bodUdalosti(e);
    ukazatele.set(e.pointerId, [cx, cy]);
    if (stipnuti && ukazatele.size === 2) {
      const [a, b] = [...ukazatele.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]), mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      const s = Math.max(0.05, Math.min(40, stipnuti.s * d / (stipnuti.d || 1)));
      pohled.tx = mx - (stipnuti.mx - stipnuti.tx) * s / stipnuti.s; pohled.ty = my - (stipnuti.my - stipnuti.ty) * s / stipnuti.s; pohled.s = s;
      pohled.prizpusobit = false; kresli(); return;
    }
    if (!tazeni) return;
    const [gx, gy] = naMrizku(cx, cy);
    const L = Math.max(0, st.vrstva);
    if (tazeni.typ === 'pohled') {
      if (Math.hypot(cx - tazeni.x0, cy - tazeni.y0) > 4) tazeni.pohnuto = true;
      pohled.tx = tazeni.tx + cx - tazeni.x0; pohled.ty = tazeni.ty + cy - tazeni.y0; pohled.prizpusobit = false; kresli();
    } else if (tazeni.typ === 'novy') {
      tazeni.b.bx = gx; tazeni.b.by = gy; kresli();
    } else if (tazeni.typ === 'konec') {
      const b = mustkyPx(L).rucni[vybrany]; if (!b) return;
      if (tazeni.k === 'a') { b.ax = gx; b.ay = gy; } else { b.bx = gx; b.by = gy; }
      kresli();
    } else if (tazeni.typ === 'posun') {
      const b = mustkyPx(L).rucni[vybrany]; if (!b) return;
      const dx = (cx - tazeni.x0) / pohled.s, dy = (cy - tazeni.y0) / pohled.s;
      if (Math.hypot(cx - tazeni.x0, cy - tazeni.y0) > 3) tazeni.pohnuto = true;
      b.ax = tazeni.puv.ax + dx; b.ay = tazeni.puv.ay + dy; b.bx = tazeni.puv.bx + dx; b.by = tazeni.puv.by + dy;
      kresli();
    }
  });
  function konecUkazatele(e) {
    if (!ukazatele.has(e.pointerId)) return;
    ukazatele.delete(e.pointerId);
    if (stipnuti) { if (ukazatele.size < 2) stipnuti = null; tazeni = null; return; }
    const t = tazeni; tazeni = null;
    if (!t || !vysl) return;
    const L = Math.max(0, st.vrstva);
    if (t.typ === 'novy') {
      const b = t.b;
      if (Math.hypot(b.bx - b.ax, b.by - b.ay) * pohled.s < 6) { kresli(); return; }
      zaloha(); prevezmiAuto();
      st.rucni[L].push(naNorm(b)); vybrany = st.rucni[L].length - 1;
      uloz(); naplanujVypocet(true); return;
    }
    if (t.typ === 'konec' || t.typ === 'posun') {
      const b = mustkyPx(L).rucni[vybrany];
      if (b) st.rucni[L][vybrany] = naNorm(b);
      if (t.typ === 'posun' && !t.pohnuto) { kresli(); uloz(); return; }
      uloz(); naplanujVypocet(true); return;
    }
    if (t.typ === 'pohled' && !t.pohnuto && st.pohled === 'sablona') {
      // klepnutí na nepodložený ostrůvek → navrhnout mu můstek
      const v = vysl.vrstvy[L], X = Math.round(t.gx), Y = Math.round(t.gy);
      if (X >= 0 && Y >= 0 && X < vysl.W && Y < vysl.H) {
        const p = Y * vysl.W + X, lab = v.stitky[p];
        if (!v.finalni[p] && lab >= 0 && v.nepodlozene.some(o => o.id === lab)) { prevezmiAuto(); doplnMustky(L, p); }
      }
    }
  }
  platno.addEventListener('pointerup', konecUkazatele);
  platno.addEventListener('pointercancel', e => { tazeni = null; konecUkazatele(e); kresli(); });
  platno.addEventListener('wheel', e => {
    if (!vysl) return;
    e.preventDefault();
    const [cx, cy] = bodUdalosti(e);
    priblizit(Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015)), cx, cy);
  }, { passive: false });
  function priblizit(k, cx, cy) {
    if (!vysl) return;
    const { w, h } = velikostPlatna();
    if (cx == null) { cx = w / 2; cy = h / 2; }
    const s = Math.max(0.05, Math.min(40, pohled.s * k));
    pohled.tx = cx - (cx - pohled.tx) * s / pohled.s; pohled.ty = cy - (cy - pohled.ty) * s / pohled.s; pohled.s = s;
    pohled.prizpusobit = false; kresli();
  }
  el('zVetsi').addEventListener('click', () => priblizit(1.4));
  el('zMensi').addEventListener('click', () => priblizit(1 / 1.4));
  el('zCele').addEventListener('click', () => { prizpusob(); kresli(); });
  new ResizeObserver(() => { if (pohled.prizpusobit) prizpusob(); kresli(); }).observe(el('obalPlatna'));

  document.addEventListener('keydown', e => {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if (document.querySelector('dialog[open]')) return;
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { e.preventDefault(); zpet(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const cisla = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3 };
    if (e.code in cisla) { if (cisla[e.code] < pocetVrstev()) { vyberVrstvu(cisla[e.code]); e.preventDefault(); } return; }
    if (e.code === 'Delete' || e.code === 'Backspace') { if (vybrany >= 0) { smazVybrany(); e.preventDefault(); } return; }
    if (e.code === 'Escape') { vybrany = -1; tazeni = null; nastavNastroj('vyber'); kresli(); return; }
    if (e.code === 'KeyB') { nastavNastroj('mustek'); return; }
    if (e.code === 'KeyV') { nastavNastroj('vyber'); return; }
    if (e.code === 'Digit0' || e.code === 'Numpad0') { prizpusob(); kresli(); return; }
    if (e.code === 'Equal' || e.code === 'NumpadAdd') { priblizit(1.4); return; }
    if (e.code === 'Minus' || e.code === 'NumpadSubtract') { priblizit(1 / 1.4); return; }
  });

  /* ---------- vstup souborů ---------- */
  const zona = el('zona');
  zona.addEventListener('click', () => el('soubor').click());
  zona.addEventListener('keydown', e => { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); el('soubor').click(); } });
  el('soubor').addEventListener('change', () => { nactiSoubor(el('soubor').files[0]); el('soubor').value = ''; });
  el('ukazka').addEventListener('click', ukazkovyObrazek);
  ['dragenter', 'dragover'].forEach(t => document.addEventListener(t, e => { if ([...(e.dataTransfer && e.dataTransfer.types || [])].includes('Files')) { e.preventDefault(); zona.classList.add('nad'); } }));
  ['dragleave', 'drop'].forEach(t => document.addEventListener(t, () => zona.classList.remove('nad')));
  document.addEventListener('drop', e => {
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!f) return;
    e.preventDefault();
    if (/^(font\/|application\/(x-)?font)/.test(f.type) || /\.(ttf|otf|woff)$/i.test(f.name)) return;
    nactiSoubor(f);
  });
  document.addEventListener('paste', e => {
    const t = e.target;
    const polozky = [...(e.clipboardData && e.clipboardData.items || [])];
    const obr = polozky.find(i => i.kind === 'file' && /^image\//.test(i.type));
    if (!obr) return;
    if (t && t.tagName === 'TEXTAREA' && !obr) return;
    e.preventDefault();
    const f = obr.getAsFile();
    if (f) nactiSoubor(new File([f], 'ze schránky.' + (f.type.split('/')[1] || 'png'), { type: f.type }));
  });

  /* ---------- export ---------- */
  function dataVystupu() {
    if (!vysl) return null;
    const n = vysl.vrstvy.length;
    return V.data(vysl, {
      sirkaMm: st.sirka, vyskaMm: st.vyska, registrace: st.registrace && n > 1,
      nazvy: vysl.vrstvy.map((_, j) => nazevVrstvy(j, n)), barvy: vysl.vrstvy.map((_, j) => barvaVrstvy(j)),
    });
  }
  function vrstvyExportu(d) { return st.exVrstvy === 'aktualni' ? [Math.max(0, Math.min(d.vrstvy.length - 1, st.vrstva))] : d.vrstvy.map((_, i) => i); }
  function nazevSouboru(pr) {
    const d = new Date(), dd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const zakl = st.zdroj === 'text' ? (st.text || 'text').split('\n')[0].normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '_').slice(0, 24) : (obrazek && obrazek.nazev || 'obrazek').replace(/\.[^.]+$/, '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '_').slice(0, 24);
    return `sablona_${zakl || 'motiv'}_${dd}.${pr}`;
  }
  function stahni(obsah, nazev, typ) {
    const blob = obsah instanceof Blob ? obsah : new Blob([obsah], { type: typ });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nazev;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  async function predExportem() {
    if (!vysl) { Dialog.chyba('Nejdřív vložte obrázek nebo text.'); return false; }
    const nep = vysl.vrstvy.reduce((s, v) => s + v.nepodlozene.length, 0);
    if (nep && !(await Dialog.potvrd(`Šablona má ${nep} nepodložených ostrůvků – po vyříznutí vypadnou. Přesto exportovat?`, { ok: 'Exportovat' }))) return false;
    return true;
  }
  el('exSvg').addEventListener('click', async () => {
    if (!(await predExportem())) return;
    const d = dataVystupu();
    stahni(V.svg(d, { vrstvy: vrstvyExportu(d), styl: st.svgStyl }), nazevSouboru('svg'), 'image/svg+xml');
  });
  el('exDxf').addEventListener('click', async () => {
    if (!(await predExportem())) return;
    const d = dataVystupu();
    stahni(V.dxf(d, { vrstvy: vrstvyExportu(d) }), nazevSouboru('dxf'), 'application/dxf');
  });
  el('exPng').addEventListener('click', async () => {
    if (!(await predExportem())) return;
    const d = dataVystupu(), vr = vrstvyExportu(d), dpi = st.pngDpi, mezera = 10;
    let k = dpi / 25.4;
    const sirMm = vr.length * d.sirka + (vr.length - 1) * mezera;
    const max = 16000;
    if (sirMm * k > max || d.vyska * k > max || sirMm * k * d.vyska * k > 2.4e8) {
      k = Math.min(max / sirMm, max / d.vyska, Math.sqrt(2.4e8 / (sirMm * d.vyska)));
      Dialog.info(`Šablona je na ${dpi} DPI moc velká – PNG bude v ${Math.floor(k * 25.4)} DPI.`);
    }
    const c = document.createElement('canvas'); c.width = Math.round(sirMm * k); c.height = Math.round(d.vyska * k);
    const x = c.getContext('2d');
    vr.forEach((i, n) => {
      const dx = n * (d.sirka + mezera);
      const p = new Path2D();
      p.rect(dx * k, 0, d.sirka * k, d.vyska * k);
      for (const o of V.obrysyVrstvy(d, i)) { p.moveTo((o[0][0] + dx) * k, o[0][1] * k); for (let q = 1; q < o.length; q++) p.lineTo((o[q][0] + dx) * k, o[q][1] * k); p.closePath(); }
      x.fillStyle = '#000'; x.fill(p, 'evenodd');
    });
    c.toBlob(b => { if (b) stahni(b, nazevSouboru('png')); else Dialog.chyba('PNG se nepodařilo vytvořit (moc velké?).'); }, 'image/png');
  });
  let pismoSlib = null;
  function nactiPismo() {
    if (window.FONTY_JS && window.FONTY_JS['LiberationSans-Regular.ttf']) return Promise.resolve(window.FONTY_JS['LiberationSans-Regular.ttf']);
    if (pismoSlib) return pismoSlib;
    pismoSlib = new Promise(ok => {
      const s = document.createElement('script'); s.src = 'stitky_panely/fonty/LiberationSans-Regular.ttf.js';
      s.onload = () => ok((window.FONTY_JS || {})['LiberationSans-Regular.ttf'] || null);
      s.onerror = () => { pismoSlib = null; ok(null); };
      document.head.appendChild(s);
    });
    return pismoSlib;
  }
  function papir() {
    if (st.papir === 'vlastni') return { w: Math.max(50, st.papirW), h: Math.max(50, st.papirH) };
    const [w, h] = st.papir.split('x').map(Number); return { w, h };
  }
  function infoListy() {
    if (!vysl) { el('infoListy').textContent = ''; return; }
    const d = { sirka: st.sirka + 2 * st.okraj, vyska: st.vyska + 2 * st.okraj };
    const L = V.listy(d.sirka, d.vyska, papir(), { okraj: st.okrajTisku, preklad: st.preklad, orientace: st.orientace });
    const vr = st.exVrstvy === 'aktualni' ? 1 : pocetVrstev();
    el('infoListy').textContent = `Na vrstvu ${L.listy.length} ${L.listy.length === 1 ? 'list' : L.listy.length < 5 ? 'listy' : 'listů'} (${L.sloupcu} × ${L.radku}, ${L.papir.w > L.papir.h ? 'na šířku' : 'na výšku'}), celkem ${1 + vr * L.listy.length} stran včetně úvodní s kontrolním čtvercem 50 mm.`;
  }
  el('exPdf').addEventListener('click', async () => {
    if (!(await predExportem())) return;
    if (!window.jspdf) { Dialog.chyba('Knihovna jsPDF se nenačetla.'); return; }
    const pismo = await nactiPismo();
    if (!pismo) Dialog.info('Písmo se nepodařilo načíst – PDF bude bez diakritiky.');
    const d = dataVystupu();
    try {
      const doc = V.pdf(window.jspdf.jsPDF, d, { papir: papir(), okraj: st.okrajTisku, preklad: st.preklad, orientace: st.orientace, vrstvy: vrstvyExportu(d), pismo,
        nazev: 'Šablona: ' + (st.zdroj === 'text' ? (st.text || '').split('\n')[0].slice(0, 40) : (obrazek && obrazek.nazev) || 'motiv') });
      stahni(doc.output('blob'), nazevSouboru('pdf'));
    } catch (e) { console.error(e); Dialog.chyba('PDF se nepodařilo vytvořit: ' + (e.message || e)); }
  });
  el('novy').addEventListener('click', async () => {
    if (!(await Dialog.potvrd('Začít nový projekt? Smaže se uložený obrázek, ruční můstky i nastavení.', { ok: 'Nový projekt' }))) return;
    try { localStorage.removeItem(KLIC); } catch (e) { /* nic */ }
    await smazObrazek();
    location.reload();
  });

  /* ---------- start ---------- */
  doFormulare();
  navazFormular();
  nastavNastroj('vyber');
  pripravFonty();
  el('kObraz').open = st.zdroj === 'obrazek';
  window.addEventListener('resize', () => kresliHistogram());
  (async () => {
    if (st.zdroj === 'text') { await pripravText(); }
    const z = await nactiObrazek();
    if (z && z.blob) {
      const zdrojBylText = st.zdroj === 'text';
      await new Promise(ok => {
        const url = URL.createObjectURL(z.blob), img = new Image();
        img.onload = () => { obrazek = { img, sirka: img.naturalWidth, vyska: img.naturalHeight, nazev: z.nazev || 'obrázek', url }; el('infoObrazek').textContent = `${obrazek.nazev} · ${img.naturalWidth} × ${img.naturalHeight} px`; ok(); };
        img.onerror = () => ok();
        img.src = url;
      });
      if (!zdrojBylText) naplanujVypocet(true);
    } else if (st.zdroj === 'obrazek') { kresli(); obnovStav(); }
  })();

  // pro testy a ladění
  window.STENCIL_UI = { stav: () => st, vysledek: () => vysl, prepocitej, ukazkovyObrazek, doplnMustky, pohled, vyberVrstvu, dataVystupu };
})();

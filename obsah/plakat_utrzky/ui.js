/* Plakát s útržky – ovládání stránky: formulář, náhled, export, ukládání. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const KLIC = 'webapp_plakat_utrzky';
  const KLIC_AKT = 'webapp_plakat_utrzky_akt';
  const KLIC_NAHLED = 'webapp_plakat_utrzky_nahled';
  const D = typeof Dialog !== 'undefined' ? Dialog : null;
  const info = (t) => (D ? D.info(t) : console.log(t));
  const chyba = (t) => (D ? D.chyba(t) : console.error(t));

  let S = PU.vychoziStav();
  let aktId = null;            // id uloženého plakátu, který je otevřený
  let rezimNahledu = 'plakat';
  let posledni = null;         // { plakat, list, obrazky }

  /* ---------------- IndexedDB ---------------- */
  let dbSlib = null;
  function db() {
    if (dbSlib) return dbSlib;
    dbSlib = new Promise((ok, ko) => {
      if (!window.indexedDB) return ko(new Error('IndexedDB není k dispozici'));
      const r = indexedDB.open(KLIC, 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains('obrazky')) d.createObjectStore('obrazky', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('plakaty')) d.createObjectStore('plakaty', { keyPath: 'id' });
      };
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ko(r.error);
    });
    dbSlib.catch(() => { dbSlib = null; });
    return dbSlib;
  }
  async function dbOp(store, rezim, fn) {
    const d = await db();
    return new Promise((ok, ko) => {
      const tx = d.transaction(store, rezim), st = tx.objectStore(store);
      const r = fn(st);
      tx.oncomplete = () => ok(r && 'result' in r ? r.result : undefined);
      tx.onerror = () => ko(tx.error);
      tx.onabort = () => ko(tx.error);
    });
  }
  const dbGet = (s, id) => dbOp(s, 'readonly', st => st.get(id));
  const dbPut = (s, v) => dbOp(s, 'readwrite', st => st.put(v));
  const dbDel = (s, id) => dbOp(s, 'readwrite', st => st.delete(id));
  const dbVse = (s) => dbOp(s, 'readonly', st => st.getAll());
  const noveId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  /* ---------------- obrázky ---------------- */
  const obrCache = new Map();   // id → Promise<HTMLImageElement>
  function obrazek(id) {
    if (!id) return Promise.resolve(null);
    if (obrCache.has(id)) return obrCache.get(id);
    const p = (async () => {
      const z = await dbGet('obrazky', id).catch(() => null);
      if (!z || !z.blob) return null;
      const url = URL.createObjectURL(z.blob);
      const im = new Image(); im.src = url;
      await im.decode();
      return im;
    })();
    obrCache.set(id, p);
    p.catch(() => obrCache.delete(id));
    return p;
  }
  async function zmensiObrazek(soubor) {
    const url = URL.createObjectURL(soubor);
    try {
      const im = new Image(); im.src = url; await im.decode();
      const max = 2400, k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
      const w = Math.max(1, Math.round(im.naturalWidth * k)), h = Math.max(1, Math.round(im.naturalHeight * k));
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(im, 0, 0, w, h);
      const png = /png|gif|webp/.test(soubor.type) && soubor.size < 4e6;
      const blob = await new Promise(ok => c.toBlob(ok, png ? 'image/png' : 'image/jpeg', 0.9));
      return { blob, w, h };
    } finally { URL.revokeObjectURL(url); }
  }
  async function pouzitObrazek(blob, w, h) {
    const id = 'img_' + noveId();
    await dbPut('obrazky', { id, blob, w, h });
    const stare = S.obrazek.id;
    S.obrazek = Object.assign({}, S.obrazek, { id, sirkaPx: w, vyskaPx: h, zoom: 1, posunX: 0, posunY: 0 });
    if (stare) uklidObrazek(stare);
  }
  /* smaže obrázek z IndexedDB, když na něj nic neodkazuje */
  async function uklidObrazek(id) {
    if (!id || id === S.obrazek.id) return;
    try {
      const vse = await dbVse('plakaty');
      if (vse.some(p => p.stav && p.stav.obrazek && p.stav.obrazek.id === id)) return;
      await dbDel('obrazky', id); obrCache.delete(id);
    } catch (e) { /* nevadí */ }
  }
  /* výřez pro rámeček (mm) → plátno; pozadí vyplní barvou plakátu (průhledné PNG) */
  const vyrezCache = new Map();
  function vyrezObrazku(im, ram, s, pozadi, dpi) {
    const ob = s.obrazek;
    const kl = [ob.id, ram.w.toFixed(2), ram.h.toFixed(2), ob.prizpusobeni, ob.zoom, ob.posunX, ob.posunY, ob.sedy, pozadi, dpi].join('|');
    if (vyrezCache.has(kl)) return vyrezCache.get(kl);
    const v = ob.prizpusobeni === 'cely' ? { sx: 0, sy: 0, sw: im.naturalWidth, sh: im.naturalHeight }
      : PU.vyrez(im.naturalWidth, im.naturalHeight, ram.w, ram.h, ob.zoom, ob.posunX, ob.posunY);
    const cil = Math.min(2600, Math.max(64, Math.round(ram.w / 25.4 * dpi)));
    const cw = Math.min(cil, Math.round(v.sw)) || 1, ch = Math.max(1, Math.round(cw * ram.h / ram.w));
    const c = document.createElement('canvas'); c.width = cw; c.height = ch;
    const g = c.getContext('2d');
    g.fillStyle = pozadi; g.fillRect(0, 0, cw, ch);
    if (ob.sedy) g.filter = 'grayscale(1)';
    g.drawImage(im, v.sx, v.sy, v.sw, v.sh, 0, 0, cw, ch);
    const r = { canvas: c, data: c.toDataURL('image/jpeg', 0.9), format: 'JPEG', verze: vyrezCache.size + 1, v };
    if (vyrezCache.size > 12) vyrezCache.clear();
    vyrezCache.set(kl, r);
    return r;
  }

  /* ---------------- stav ↔ formulář ---------------- */
  function cti(cesta) { return cesta.split('.').reduce((o, k) => (o == null ? o : o[k]), S); }
  function nastav(cesta, hodnota) {
    const c = cesta.split('.'); let o = S;
    for (let i = 0; i < c.length - 1; i++) o = o[c[i]];
    o[c[c.length - 1]] = hodnota;
  }
  function hodnotaPole(el) {
    if (el.type === 'checkbox') return el.checked;
    if (el.type === 'range') return +el.value;
    if (el.type === 'number') {
      if (el.dataset.k === 'utrzky.vyska') return el.value === '' ? 'auto' : +el.value;
      return el.value === '' ? 0 : +el.value;
    }
    if (el.dataset.k === 'utrzky.pocet' || el.dataset.k === 'tisk.kusu') return el.value === 'auto' ? 'auto' : +el.value;
    return el.value;
  }
  function doFormulare() {
    for (const el of document.querySelectorAll('[data-k]')) {
      const v = cti(el.dataset.k);
      if (el.type === 'checkbox') el.checked = !!v;
      else if (el.dataset.k === 'utrzky.vyska') el.value = v === 'auto' ? '' : v;
      else el.value = v == null ? '' : v;
    }
    for (const sk of document.querySelectorAll('[data-volba]')) {
      const v = cti(sk.dataset.volba);
      for (const b of sk.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.h === String(v)));
    }
    for (const b of $('predvolby').querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.h === S.predvolba));
    viditelnost();
  }
  function viditelnost() {
    $('obVlastni').classList.toggle('skryt', S.format.papir !== 'vlastni');
    $('obList').classList.toggle('skryt', S.tisk.list === 'stejny');
    $('fKusu').disabled = S.tisk.list === 'stejny';
    $('obQrVlastni').classList.toggle('skryt', S.utrzky.miniQr !== 'vlastni');
    $('obObrazek').classList.toggle('skryt', !S.obrazek.id);
    $('obOrez').classList.toggle('skryt', S.obrazek.prizpusobeni === 'cely');
    $('bObrazekPryc').disabled = !S.obrazek.id;
    $('vPodil').textContent = '(' + S.obrazek.podil + ' %)';
    $('vZoom').textContent = '(' + (+S.obrazek.zoom).toFixed(2) + '×)';
    $('fQrObsah').disabled = $('fQrPopisek').disabled = !S.qr.zapnuto;
  }

  function naplnVolby() {
    const pv = $('predvolby');
    for (const [k, p] of Object.entries(PU.PREDVOLBY)) {
      const b = document.createElement('button'); b.type = 'button'; b.dataset.h = k; b.textContent = p.nazev;
      b.addEventListener('click', () => pouzijPredvolbu(k)); pv.appendChild(b);
    }
    const vr = $('volbyRozlozeni');
    Object.entries(PU.ROZLOZENI).forEach(([k, n], i) => {
      const b = document.createElement('button'); b.type = 'button'; b.dataset.h = k; b.textContent = n.replace(/ \(.*\)/, ''); b.title = n + ' (Alt+' + (i + 1) + ')';
      vr.appendChild(b);
    });
    const vs = $('volbySchema');
    for (const [k, s] of Object.entries(PU.SCHEMATA)) {
      const b = document.createElement('button'); b.type = 'button'; b.dataset.h = k;
      b.innerHTML = `<span class="vzorek" style="background:${s.akcent};box-shadow:inset 0 0 0 3px ${s.pozadi}"></span>${s.nazev}`;
      vs.appendChild(b);
    }
    const opt = (sel, pary) => { for (const [v, t] of pary) { const o = document.createElement('option'); o.value = v; o.textContent = t; sel.appendChild(o); } };
    opt($('fPismoN'), PU.PISMA_NADPISU.map(k => [k, PU.PISMA[k].nazev]));
    opt($('fPismoT'), PU.PISMA_TEXTU.map(k => [k, PU.PISMA[k].nazev]));
    opt($('fPapir'), Object.entries(PU.FORMATY).map(([k, f]) => [k, f.w ? `${f.nazev} (${f.w}×${f.h} mm)` : 'vlastní rozměr']));
    opt($('fList'), Object.entries(PU.LISTY));
    opt($('fKusu'), [['auto', 'co nejvíc'], [1, '1'], [2, '2'], [3, '3'], [4, '4'], [6, '6'], [8, '8']]);
    const poc = [['auto', 'auto']]; for (let i = 4; i <= 20; i++) poc.push([i, String(i)]);
    opt($('fPocet'), poc);
  }

  async function pouzijPredvolbu(k) {
    const p = PU.PREDVOLBY[k]; if (!p) return;
    const puv = PU.PREDVOLBY[S.predvolba];
    const upraveno = !puv || ['stitek', 'nadpis', 'podnadpis', 'text', 'cena'].some(f => String(S[f] || '') !== String(puv[f] || ''));
    if (upraveno && D && !(await D.potvrd(`Nahradit štítek, nadpis a text šablonou „${p.nazev}“?`, { ok: 'Nahradit', zrus: 'Ponechat' }))) {
      S.predvolba = k; S.stitek = p.stitek; doFormulare(); zmena(); return;
    }
    S.predvolba = k;
    for (const f of ['stitek', 'nadpis', 'podnadpis', 'text', 'cena']) S[f] = p[f];
    if (p.schema) S.schema = p.schema;
    if (p.popisUtrzku) S.utrzky.popis = p.popisUtrzku;
    doFormulare(); zmena();
  }

  /* ---------------- přepočet a náhled ---------------- */
  let casovac = 0, beh = 0;
  function zmena(hned) {
    ulozRozpracovane();
    viditelnost();
    clearTimeout(casovac);
    casovac = setTimeout(prekresli, hned ? 0 : 140);
  }
  function qrPlakatu() {
    if (!S.qr.zapnuto) return null;
    let t = String(S.qr.obsah || '').trim();
    if (!t) t = PU.obsahQrUtrzku(Object.assign({}, S.utrzky, { miniQr: 'telefon' }));
    return t ? PU.qrMatice(window.qrcode, t, 'M') : null;
  }
  async function sestav(dpiObrazku) {
    const klice = PUP.potrebne(S);
    await PUP.nactiVse(klice);
    const im = S.obrazek.id ? await obrazek(S.obrazek.id) : null;
    const qrU = S.utrzky.miniQr !== 'zadne' ? PU.qrMatice(window.qrcode, PU.obsahQrUtrzku(S.utrzky), 'L') : null;
    const plakat = PU.rozvrhni(S, PUP.metriky, { obrazek: im ? { w: im.naturalWidth, h: im.naturalHeight } : null, qr: qrPlakatu(), qrUtrzku: qrU });
    if (S.qr.zapnuto && !plakat.prim.some(p => p.t === 'qr' && p.m > 0.3)) plakat.varovani.push('QR kód nemá obsah – zadejte odkaz nebo telefon.');
    if (S.utrzky.miniQr !== 'zadne' && !qrU) plakat.varovani.push('Mini QR nemá obsah (chybí telefon / e-mail / text).');
    const list = PU.sestavList(plakat, S.tisk);
    const obrazky = {};
    const pObr = plakat.prim.find(p => p.t === 'obraz');
    if (im && pObr) obrazky.foto = vyrezObrazku(im, pObr, S, plakat.barvy.pozadi, dpiObrazku || 220);
    return { plakat, list, obrazky, im, pObr };
  }
  async function prekresli() {
    const muj = ++beh;
    let r;
    try { r = await sestav(); } catch (e) { chyba('Náhled selhal: ' + e.message); console.error(e); return; }
    if (muj !== beh) return;
    posledni = r;
    const cil = rezimNahledu === 'list' ? r.list : r.plakat;
    $('nahled').innerHTML = PUV.svg(cil, { obrazky: { foto: r.obrazky.foto } });
    const svg = $('nahled').firstChild;
    svg.removeAttribute('width'); svg.removeAttribute('height');
    const img = svg.querySelector('image'); if (img) img.dataset.id = 'foto';
    prizpusobNahled();
    infoPanely(r);
  }
  function prizpusobNahled() {
    if (!posledni) return;
    const cil = rezimNahledu === 'list' ? posledni.list : posledni.plakat;
    const pl = $('plocha'), cs = getComputedStyle(pl);
    const dostW = pl.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const maxH = parseFloat(cs.maxHeight) || 900;
    const dostH = (isFinite(maxH) ? maxH : 900) - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 2;
    const w = Math.max(120, Math.min(dostW, dostH * cil.w / cil.h));
    $('nahled').style.width = Math.floor(w) + 'px';
  }
  const mm = (v) => (Math.round(v * 10) / 10).toLocaleString('cs-CZ');
  function infoPanely(r) {
    const p = r.plakat, U = p.info.utrzky, roz = r.list.rozlozeni;
    $('infoUtrzky').innerHTML = `<b>${U.n}</b> útržků po <b>${mm(U.sirka)} mm</b>, výška ${mm(U.vyska)} mm, písmo <b>${U.velPt.toFixed(1)} pt</b>` +
      (U.seznam[0] && U.seznam[0].qr ? `, mini QR ${mm(U.seznam[0].qr.vel)} mm` : '');
    const nazL = S.tisk.list === 'stejny' ? `${mm(roz.W)} × ${mm(roz.H)} mm` : `${S.tisk.list} ${roz.W > roz.H ? 'na šířku' : 'na výšku'}`;
    $('infoList').innerHTML = S.tisk.list === 'stejny'
      ? `Plakát ${mm(p.w)} × ${mm(p.h)} mm, tisk 1:1 na stejný formát.`
      : (roz.kusy.length ? `<b>${roz.kusy.length}×</b> na ${nazL}, měřítko <b>${Math.round(roz.meritko * 1000) / 10} %</b> (kus ${mm(p.w * roz.meritko)} × ${mm(p.h * roz.meritko)} mm)` : '<span style="color:var(--danger)">Plakát se na list nevejde.</span>');
    $('infoNahled').innerHTML = `${rezimNahledu === 'list' ? 'List ' + mm(r.list.w) + ' × ' + mm(r.list.h) + ' mm' : 'Plakát ' + mm(p.w) + ' × ' + mm(p.h) + ' mm'}` +
      (p.info.text ? ` · text ${p.info.text.velPt.toFixed(1)} pt` : '') + (p.info.nadpisVel ? ` · nadpis ${PU.mmNaPt(p.info.nadpisVel).toFixed(0)} pt` : '');
    const v = p.varovani.slice();
    if (roz.meritko && roz.meritko < 1) v.push(`Na listu je plakát zmenšen na ${Math.round(roz.meritko * 100)} % – kvůli okraji tiskárny a ořezovým značkám.`);
    if (S.tisk.list !== 'stejny' && !roz.kusy.length) v.push('Plakát se na zvolený list nevejde.');
    $('varovani').innerHTML = v.map(t => `<div>${t.replace(/</g, '&lt;')}</div>`).join('');
  }

  /* tažení obrázku v náhledu = posun výřezu */
  (function tazeni() {
    let t = null;
    $('nahled').addEventListener('pointerdown', (e) => {
      if (!(e.target instanceof SVGImageElement) || !posledni || !posledni.im || S.obrazek.prizpusobeni === 'cely') return;
      const svg = $('nahled').firstChild, vb = svg.viewBox.baseVal, rc = svg.getBoundingClientRect();
      const pObr = posledni.pObr, im = posledni.im;
      const v = PU.vyrez(im.naturalWidth, im.naturalHeight, pObr.w, pObr.h, S.obrazek.zoom, 0, 0);
      const mmNaPx = vb.width / rc.width;
      const skala = rezimNahledu === 'list' && posledni.list.rozlozeni.kusy[0] ? posledni.list.rozlozeni.kusy[0].s : 1;
      const volnoX = (im.naturalWidth - v.sw) / 2 * (pObr.w / v.sw) * skala, volnoY = (im.naturalHeight - v.sh) / 2 * (pObr.h / v.sh) * skala;
      t = { x: e.clientX, y: e.clientY, px: S.obrazek.posunX, py: S.obrazek.posunY, mmNaPx, volnoX, volnoY };
      e.target.setPointerCapture(e.pointerId); e.preventDefault();
    });
    $('nahled').addEventListener('pointermove', (e) => {
      if (!t) return;
      const dx = (e.clientX - t.x) * t.mmNaPx, dy = (e.clientY - t.y) * t.mmNaPx;
      const omez = (v) => Math.max(-1, Math.min(1, Math.round(v * 100) / 100));
      if (t.volnoX > 0.01) S.obrazek.posunX = omez(t.px - dx / t.volnoX);
      if (t.volnoY > 0.01) S.obrazek.posunY = omez(t.py - dy / t.volnoY);
      $('fPosX').value = S.obrazek.posunX; $('fPosY').value = S.obrazek.posunY;
      zmena();
    });
    const konec = () => { t = null; };
    $('nahled').addEventListener('pointerup', konec); $('nahled').addEventListener('pointercancel', konec);
  })();

  /* ---------------- výstupy ---------------- */
  function nazevSouboru(pripona) {
    const z = (S.nazev || S.nadpis || 'plakat').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'plakat';
    return `${z}.${pripona}`;
  }
  function stahni(blob, nazev) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nazev;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  async function pracuj(tl, text, fn) {
    tl.disabled = true; const puv = tl.textContent; tl.textContent = text;
    try { await fn(); } catch (e) { chyba(e.message || String(e)); console.error(e); }
    finally { tl.disabled = false; tl.textContent = puv; }
  }
  async function vytvorPdf() {
    if (!window.jspdf) throw new Error('Knihovna jsPDF se nenačetla.');
    const r = await sestav(300);
    return PUV.pdf(window.jspdf.jsPDF, [r.list], { pisma: PUP.proPdf(), obrazky: r.obrazky, nazev: S.nadpis || 'Plakát s útržky' });
  }
  async function vytvorPng(dpi) {
    const r = await sestav(dpi);
    const cil = rezimNahledu === 'list' ? r.list : r.plakat;
    let mer = dpi / 25.4;
    const max = 9000; if (Math.max(cil.w, cil.h) * mer > max) mer = max / Math.max(cil.w, cil.h);
    const c = document.createElement('canvas'); c.width = Math.round(cil.w * mer); c.height = Math.round(cil.h * mer);
    const g = c.getContext('2d');
    PUV.platno(g, cil, mer, { obrazky: { foto: r.obrazky.foto && r.obrazky.foto.canvas } });
    return c;
  }
  async function tisk() {
    const r = await sestav(300);
    const L = r.list;
    let st = $('stylTisku');
    if (!st) { st = document.createElement('style'); st.id = 'stylTisku'; document.head.appendChild(st); }
    st.textContent = `@page{size:${L.w}mm ${L.h}mm;margin:0}@media print{#tisk svg{width:${L.w}mm;height:${L.h}mm}}`;
    $('tisk').innerHTML = PUV.svg(L, { obrazky: { foto: r.obrazky.foto } });
    await document.fonts.ready;
    setTimeout(() => window.print(), 60);
  }

  /* ---------------- ukládání ---------------- */
  function ulozRozpracovane() {
    try { localStorage.setItem(KLIC, JSON.stringify(S)); if (aktId) localStorage.setItem(KLIC_AKT, aktId); else localStorage.removeItem(KLIC_AKT); } catch (e) { /* plné úložiště / soukromý režim */ }
  }
  function nactiRozpracovane() {
    try {
      const t = localStorage.getItem(KLIC);
      if (t) S = PU.normalizuj(JSON.parse(t));
      aktId = localStorage.getItem(KLIC_AKT) || null;
      const n = localStorage.getItem(KLIC_NAHLED); if (n === 'list' || n === 'plakat') rezimNahledu = n;
    } catch (e) { S = PU.vychoziStav(); }
  }
  async function miniatura() {
    const r = await sestav(60);
    const c = document.createElement('canvas'), mer = 200 / r.plakat.w;
    c.width = 200; c.height = Math.round(r.plakat.h * mer);
    PUV.platno(c.getContext('2d'), r.plakat, mer, { obrazky: { foto: r.obrazky.foto && r.obrazky.foto.canvas } });
    return c.toDataURL('image/jpeg', 0.8);
  }
  async function uloz(jakoNovy) {
    if (!String(S.nazev || '').trim()) {
      const n = D ? await D.zeptej('Název plakátu', S.nadpis || 'Plakát') : (S.nadpis || 'Plakát');
      if (n == null) return;
      S.nazev = String(n).trim() || 'Plakát'; $('fNazev').value = S.nazev;
    }
    if (jakoNovy || !aktId) aktId = noveId();
    await dbPut('plakaty', { id: aktId, nazev: S.nazev, stav: JSON.parse(JSON.stringify(S)), zmeneno: Date.now(), nahled: await miniatura() });
    ulozRozpracovane();
    info('Uloženo: ' + S.nazev);
    seznam();
  }
  async function seznam() {
    const el = $('ulozene');
    let vse = [];
    try { vse = await dbVse('plakaty'); } catch (e) { el.innerHTML = '<p class="prazdne">Úložiště prohlížeče není dostupné.</p>'; return; }
    vse.sort((a, b) => b.zmeneno - a.zmeneno);
    if (!vse.length) { el.innerHTML = '<p class="prazdne">Zatím nic uloženého.</p>'; return; }
    el.innerHTML = '';
    for (const p of vse) {
      const d = document.createElement('div'); d.className = 'ul-pol' + (p.id === aktId ? ' akt' : '');
      const img = document.createElement('img'); img.src = p.nahled || ''; img.alt = p.nazev; img.title = 'Otevřít';
      const nz = document.createElement('div'); nz.className = 'nz'; nz.textContent = p.nazev; nz.title = p.nazev;
      const dt = document.createElement('div'); dt.className = 'dt'; dt.textContent = new Date(p.zmeneno).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      const tl = document.createElement('div'); tl.className = 'tl';
      const bO = document.createElement('button'); bO.className = 'btn btn-sec'; bO.textContent = 'Otevřít';
      const bS = document.createElement('button'); bS.className = 'btn btn-sec'; bS.textContent = 'Smazat';
      const otevri = async () => { S = PU.normalizuj(p.stav); aktId = p.id; doFormulare(); zmena(true); seznam(); info('Otevřeno: ' + p.nazev); };
      img.addEventListener('click', otevri); bO.addEventListener('click', otevri);
      bS.addEventListener('click', async () => {
        if (D && !(await D.potvrd(`Smazat plakát „${p.nazev}“?`, { ok: 'Smazat', zrus: 'Zpět' }))) return;
        await dbDel('plakaty', p.id);
        if (aktId === p.id) { aktId = null; ulozRozpracovane(); }
        if (p.stav && p.stav.obrazek) await uklidObrazek(p.stav.obrazek.id);
        seznam();
      });
      tl.append(bO, bS); d.append(img, nz, dt, tl); el.appendChild(d);
    }
  }
  async function novy() {
    if (D && !(await D.potvrd('Začít nový plakát? Neuložené změny rozpracovaného plakátu se zahodí.', { ok: 'Nový', zrus: 'Zpět' }))) return;
    const stare = S.obrazek.id;
    S = PU.vychoziStav(); aktId = null;
    if (stare) uklidObrazek(stare);
    doFormulare(); zmena(true); seznam();
  }
  function blobNaDataUrl(blob) { return new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => ko(r.error); r.readAsDataURL(blob); }); }
  async function exportJson() {
    const out = { format: 'plakat_utrzky', verze: 1, stav: S, obrazek: null };
    if (S.obrazek.id) { const z = await dbGet('obrazky', S.obrazek.id).catch(() => null); if (z) out.obrazek = { data: await blobNaDataUrl(z.blob), w: z.w, h: z.h }; }
    stahni(new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' }), nazevSouboru('json'));
  }
  async function importJson(soubor) {
    let d;
    try { d = JSON.parse(await soubor.text()); } catch (e) { chyba('Soubor není platný JSON.'); return; }
    if (!d || d.format !== 'plakat_utrzky' || !d.stav) { chyba('Soubor není plakát s útržky.'); return; }
    const novyS = PU.normalizuj(d.stav);
    novyS.obrazek.id = '';
    S = novyS; aktId = null;
    if (d.obrazek && /^data:image\//.test(d.obrazek.data || '')) {
      try { const blob = await (await fetch(d.obrazek.data)).blob(); const ob = Object.assign({}, S.obrazek); await pouzitObrazek(blob, d.obrazek.w, d.obrazek.h); Object.assign(S.obrazek, { zoom: ob.zoom, posunX: ob.posunX, posunY: ob.posunY }); }
      catch (e) { chyba('Obrázek z JSON se nepodařilo načíst.'); }
    }
    doFormulare(); zmena(true);
    info('Načteno z JSON' + (S.nazev ? ': ' + S.nazev : ''));
  }

  /* ---------------- události ---------------- */
  function navaz() {
    document.querySelectorAll('[data-k]').forEach(el => {
      const ev = el.tagName === 'SELECT' || el.type === 'checkbox' ? 'change' : 'input';
      el.addEventListener(ev, () => {
        let v = hodnotaPole(el);
        if (el.dataset.k === 'format.papir' && v === 'vlastni') { const r = PU.rozmer(S.format); S.format.w = r.w; S.format.h = r.h; }
        nastav(el.dataset.k, v);
        if (el.dataset.k === 'format.papir' && v === 'vlastni') { $('fW').value = S.format.w; $('fH').value = S.format.h; }
        zmena();
      });
    });
    document.querySelectorAll('[data-volba]').forEach(sk => sk.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      nastav(sk.dataset.volba, b.dataset.h);
      if (sk.dataset.volba === 'format.orientace' && S.format.papir === 'vlastni') { const w = S.format.w; S.format.w = S.format.h; S.format.h = w; $('fW').value = S.format.w; $('fH').value = S.format.h; }
      for (const x of sk.querySelectorAll('button')) x.setAttribute('aria-pressed', String(x === b));
      zmena();
    }));
    $('volbaNahled').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      rezimNahledu = b.dataset.n;
      try { localStorage.setItem(KLIC_NAHLED, rezimNahledu); } catch (er) { /* */ }
      for (const x of $('volbaNahled').querySelectorAll('button')) x.setAttribute('aria-pressed', String(x === b));
      zmena(true);
    });
    // formátování textu
    const ta = $('fText');
    const obal = (pred, za) => {
      const a = ta.selectionStart, b = ta.selectionEnd, t = ta.value;
      const vyb = t.slice(a, b) || 'tučně';
      ta.value = t.slice(0, a) + pred + vyb + za + t.slice(b);
      ta.setSelectionRange(a + pred.length, a + pred.length + vyb.length); ta.focus();
      S.text = ta.value; zmena();
    };
    $('bTucne').addEventListener('click', () => obal('**', '**'));
    ta.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.code === 'KeyB') { e.preventDefault(); obal('**', '**'); } });
    $('bOdrazka').addEventListener('click', () => {
      const t = ta.value, a = t.lastIndexOf('\n', ta.selectionStart - 1) + 1;
      let b = t.indexOf('\n', Math.max(ta.selectionEnd - (ta.selectionEnd > ta.selectionStart ? 1 : 0), a)); if (b < 0) b = t.length;
      const blok = t.slice(a, b).split('\n');
      const vse = blok.every(r => /^\s*[-•]\s/.test(r));
      const novy = blok.map(r => vse ? r.replace(/^\s*[-•]\s+/, '') : (r.trim() ? '- ' + r.replace(/^\s*[-•]\s+/, '') : r)).join('\n');
      ta.value = t.slice(0, a) + novy + t.slice(b);
      ta.setSelectionRange(a, a + novy.length); ta.focus();
      S.text = ta.value; zmena();
    });
    // obrázek
    $('bObrazek').addEventListener('click', () => $('soubObrazek').click());
    $('soubObrazek').addEventListener('change', async (e) => {
      const f = e.target.files[0]; e.target.value = '';
      if (!f) return;
      try { const z = await zmensiObrazek(f); await pouzitObrazek(z.blob, z.w, z.h); doFormulare(); zmena(true); }
      catch (er) { chyba('Obrázek se nepodařilo načíst: ' + er.message); }
    });
    $('bObrazekPryc').addEventListener('click', () => { const id = S.obrazek.id; S.obrazek.id = ''; S.obrazek.sirkaPx = S.obrazek.vyskaPx = 0; uklidObrazek(id); doFormulare(); zmena(true); });
    // výstupy
    $('bPdf').addEventListener('click', () => pracuj($('bPdf'), 'PDF…', async () => { const d = await vytvorPdf(); stahni(d.output('blob'), nazevSouboru('pdf')); }));
    $('bPng').addEventListener('click', () => pracuj($('bPng'), 'PNG…', async () => {
      const c = await vytvorPng(+$('fDpi').value);
      const blob = await new Promise(ok => c.toBlob(ok, 'image/png'));
      stahni(blob, nazevSouboru('png'));
    }));
    $('bTisk').addEventListener('click', () => pracuj($('bTisk'), 'Tisk…', tisk));
    $('bUlozit').addEventListener('click', () => pracuj($('bUlozit'), 'Ukládám…', () => uloz(false)));
    $('bUlozitJako').addEventListener('click', () => pracuj($('bUlozitJako'), 'Ukládám…', () => uloz(true)));
    $('bNovy').addEventListener('click', novy);
    $('bExportJson').addEventListener('click', () => pracuj($('bExportJson'), '…', exportJson));
    $('bImportJson').addEventListener('click', () => $('soubJson').click());
    $('soubJson').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) importJson(f); });
    // zkratky
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') { e.preventDefault(); $('bUlozit').click(); }
      else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyP') { e.preventDefault(); $('bTisk').click(); }
      else if (e.altKey && !e.ctrlKey && /^Digit[1-4]$/.test(e.code)) {
        const k = Object.keys(PU.ROZLOZENI)[+e.code.slice(5) - 1];
        if (k) { e.preventDefault(); S.rozlozeni = k; doFormulare(); zmena(); }
      }
    });
    window.addEventListener('resize', () => { clearTimeout(navaz.rt); navaz.rt = setTimeout(prizpusobNahled, 100); });
    window.addEventListener('afterprint', () => { $('tisk').innerHTML = ''; });
  }

  /* ---------------- start ---------------- */
  naplnVolby();
  nactiRozpracovane();
  for (const x of $('volbaNahled').querySelectorAll('button')) x.setAttribute('aria-pressed', String(x.dataset.n === rezimNahledu));
  doFormulare();
  navaz();
  $('nahled').innerHTML = '<div style="padding:40px;color:#555;font:14px sans-serif;line-height:1.4">Načítám písma…</div>';
  zmena(true);
  seznam();
  window.PlakatApp = { stav: () => S, nastavStav: (s) => { S = PU.normalizuj(s); doFormulare(); zmena(true); }, posledni: () => posledni, vytvorPdf, vytvorPng, pouzitObrazek: async (blob, w, h) => { await pouzitObrazek(blob, w, h); doFormulare(); zmena(true); }, uloz, seznam };
})();

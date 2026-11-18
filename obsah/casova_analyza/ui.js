/* Časová analýza záznamů – rozhraní: případy v IndexedDB, import, osa (canvas), mapa (Leaflet), analýzy. */
(function () {
'use strict';
const J = window.CasovaAnalyzaJadro;
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const KLIC = 'webapp_casova_analyza';
if (window.self === window.top) document.body.classList.add('samostatne');

/* ---------- nastavení (localStorage) ---------- */
function nastCti() { try { return JSON.parse(localStorage.getItem(KLIC + '_nast')) || {}; } catch (e) { return {}; } }
const nast = Object.assign({ tz: J.TZ_VYCHOZI, podklad: 'zakladni', posledni: '' }, nastCti());
function nastUloz() { try { localStorage.setItem(KLIC + '_nast', JSON.stringify(nast)); } catch (e) { /* plné úložiště */ } }

/* ---------- IndexedDB ---------- */
let dbSlib = null;
function db() {
  if (!dbSlib) dbSlib = new Promise((ok, chyba) => {
    const r = indexedDB.open(KLIC, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('pripady', { keyPath: 'id' });
    r.onsuccess = () => ok(r.result);
    r.onerror = () => chyba(r.error);
  });
  return dbSlib;
}
async function dbOp(rezim, fn) {
  const d = await db();
  return new Promise((ok, chyba) => {
    const tx = d.transaction('pripady', rezim), s = tx.objectStore('pripady');
    const r = fn(s);
    tx.oncomplete = () => ok(r && r.result);
    tx.onerror = () => chyba(tx.error);
  });
}
const dbVsechny = () => dbOp('readonly', s => s.getAll());
const dbCti = id => dbOp('readonly', s => s.get(id));
const dbSmaz = id => dbOp('readwrite', s => s.delete(id));
function bezT(p) { // t/k se dopočítávají – neukládat
  return Object.assign({}, p, { zaznamy: p.zaznamy.map(r => { const o = Object.assign({}, r); delete o.t; delete o.k; return o; }), upraveno: Date.now() });
}
let ulozTimer = null;
function uloz() {
  clearTimeout(ulozTimer);
  ulozTimer = setTimeout(() => dbOp('readwrite', s => s.put(bezT(pripad))).catch(e => Dialog.chyba('Uložení selhalo: ' + e.message)), 400);
}

/* ---------- stav ---------- */
let pripad = J.prazdny();
let vysledky = [];             // [{ druh, nadpis, parametry, polozky:[{text,t,k,lat,lon}] }]
let vrstvyOsy = {};            // osoba → [{od,do,druh,barva,popis}]
let poZdroji = {};             // zdroj → seřazené záznamy
let mezeryZdroju = {};         // zdroj → mezery (pro osu)
let pohled = { od: 0, do: 1 }, kurzor = 0;
let zalozka = 'zdroje';
let hledani = '', shody = [];   // hledání na ose (sdílené s tabulkou záznamů)
const tz = () => nast.tz;

function indexuj() {
  poZdroji = {};
  for (const z of pripad.zdroje) poZdroji[z.id] = [];
  for (const r of pripad.zaznamy) (poZdroji[r.zdroj] || (poZdroji[r.zdroj] = [])).push(r);
  mezeryZdroju = {};
  for (const z of pripad.zdroje) mezeryZdroju[z.id] = J.mezery(poZdroji[z.id], z.format === 'CSV' || z.format === 'EXIF' || z.format === 'ruční' ? 1e9 : 60);
  $('seznamOsob').innerHTML = J.osoby(pripad).map(o => `<option value="${esc(o)}">`).join('');
  $('nazevPripadu').textContent = pripad.nazev;
  spocitejShody();
}
function spocitejShody() {
  shody = hledani.trim() ? pripad.zaznamy.filter(r => !zdrojById(r.zdroj).skryty && J.shoda(r, zdrojById(r.zdroj), hledani)) : [];
  $('hledejPocet').textContent = hledani.trim() ? shody.length + ' shod' : '';
}
function celyRozsah() {
  const r = J.rozsah(pripad.zaznamy.filter(x => !zdrojById(x.zdroj).skryty));
  if (!r) return { od: Date.now() - 86400000, do: Date.now() };
  const okraj = Math.max(60000, (r.do - r.od) * 0.03);
  return { od: r.od - okraj, do: r.do + okraj };
}
const zdrojById = id => pripad.zdroje.find(z => z.id === id) || {};

function zmena(opts) { // po každé změně dat
  J.prepocitej(pripad); indexuj(); uloz();
  if (opts && opts.cely) { pohled = celyRozsah(); kurzor = pohled.od + (pohled.do - pohled.od) / 2; }
  prekresli(opts && opts.cely);
}
function prekresli(prizpusobMapu) {
  $('uvod').hidden = pripad.zaznamy.length > 0;
  $('pocZdroje').textContent = pripad.zdroje.length || '';
  $('pocVysl').textContent = vysledky.length || '';
  $('pocPozn').textContent = pripad.poznamky.length || '';
  $('pocMista').textContent = pripad.mista.length || '';
  kresliOsu(); obnovMapu(prizpusobMapu); kresliMista(); kresliAnalyzuNaMape(); obnovKurzor(); kresliPanel();
}

/* ---------- případy ---------- */
async function otevri(p) {
  pripad = J.migruj(p); vysledky = []; vrstvyOsy = {};
  nast.posledni = pripad.id; nastUloz();
  indexuj(); pohled = celyRozsah(); kurzor = pohled.od + (pohled.do - pohled.od) / 2;
  if (Array.isArray(pripad.autoAnalyzy)) {   // ukázka: analýzy, které předvádí
    for (const [d, f] of pripad.autoAnalyzy) if (ANALYZY[d]) spust(d, f, true);
    const al = pripad.autoAnalyzy.find(([d]) => d === 'alibi');
    if (al) kurzor = al[1].tUtc;
    zalozka = 'vysledky';
  }
  prekresli(true);
}
const ID_PRIPAD17 = 'pripad17';   // modelový případ 17/2026 (?pripad=17) – vlastní záznam, data uživatele nepřepisuje
async function start() {
  let p = null;
  if (window.ModelovyPripad && window.ModelovyPripad.aktivni) {
    const posledni = nast.posledni;
    try { p = await dbCti(ID_PRIPAD17); } catch (e) { /* bez IndexedDB se jen neuloží */ }
    const novy = !p;
    if (novy) { p = J.ukazkaPodle('pripad17'); p.id = ID_PRIPAD17; }
    await otevri(p);
    if (novy) uloz();
    nast.posledni = posledni; nastUloz();   // bez ?pripad=17 se dál otevírá případ uživatele
    return;
  }
  try { if (nast.posledni) p = await dbCti(nast.posledni); if (!p) { const v = await dbVsechny(); v.sort((a, b) => (b.upraveno || 0) - (a.upraveno || 0)); p = v.find(x => x.id !== ID_PRIPAD17) || v[0]; } }
  catch (e) { Dialog.chyba('IndexedDB není dostupná – data se neuloží. (' + e.message + ')'); }
  await otevri(p || J.prazdny());
}
async function seznamPripadu() {
  const v = (await dbVsechny()).sort((a, b) => (b.upraveno || 0) - (a.upraveno || 0));
  $('seznamPripadu').innerHTML = v.length ? v.map(p => `<div class="karta" style="--pruh:${p.id === pripad.id ? 'var(--accent)' : 'var(--border-strong)'}">
    <h3><span>${esc(p.nazev)}</span>${p.id === pripad.id ? '<span class="meta">otevřený</span>' : ''}</h3>
    <div class="meta">${esc(p.spis || '')} · zdrojů ${p.zdroje.length}, záznamů ${p.zaznamy.length} · upraveno ${J.formatCas(p.upraveno || p.vytvoreno, tz())}</div>
    <div class="akce"><button type="button" class="btn mini" data-otevri="${p.id}">Otevřít</button><button type="button" class="btn mini danger" data-smaz-pripad="${p.id}">🗑️ Smazat</button></div></div>`).join('')
    : '<div class="prazdno">Zatím žádné uložené případy.</div>';
}
$('seznamPripadu').addEventListener('click', async e => {
  const o = e.target.closest('[data-otevri]'), s = e.target.closest('[data-smaz-pripad]');
  if (o) { $('dlgPripady').close(); await otevri(await dbCti(o.dataset.otevri)); }
  if (s) {
    if (!await Dialog.potvrd('Smazat případ i se všemi záznamy z tohoto prohlížeče? Nelze vrátit.')) return;
    await dbSmaz(s.dataset.smazPripad);
    if (s.dataset.smazPripad === pripad.id) await otevri(J.prazdny());
    seznamPripadu();
  }
});

/* ---------- stažení souboru ---------- */
function stahni(nazev, obsah, typ) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([obsah], { type: typ || 'text/plain;charset=utf-8' }));
  a.download = nazev; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const souborove = s => String(s || 'pripad').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w-]+/g, '_').slice(0, 40);

/* ---------- import ---------- */
async function sha256(buf) {
  if (!crypto.subtle) return '';
  const h = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
}
function dekodujText(buf) {
  const u = new TextDecoder('utf-8', { fatal: false }).decode(buf);
  if (!u.includes('�')) return u;
  return new TextDecoder('windows-1250').decode(buf); // starší výpisy operátorů
}
async function importuj(soubory) {
  soubory = [...soubory];
  if (!soubory.length) return;
  const fotky = soubory.filter(f => /\.jpe?g$/i.test(f.name) || f.type === 'image/jpeg');
  for (const f of soubory.filter(x => !fotky.includes(x))) {
    try { await importujText(f); } catch (e) { Dialog.chyba(f.name + ': ' + e.message); }
  }
  if (fotky.length) await importujFotky(fotky);
}
async function importujText(f) {
  const buf = await f.arrayBuffer();
  const text = dekodujText(buf);
  let r = J.nactiText(f.name, text);
  if (r.typ === 'csv') {
    const vys = await mapujCsv(f.name, r);
    if (!vys) return;
    r = Object.assign(r, J.zCsv(r.csv, vys.mapovani, vys.vychoziTyp));
  }
  if (!r.zaznamy.length) { Dialog.chyba(f.name + ': nenalezeny žádné záznamy s časem.' + (r.varovani.length ? ' (' + r.varovani.join('; ') + ')' : '')); return; }
  const format = { gpx: 'GPX', kml: 'KML', geojson: 'GeoJSON', takeout: 'Takeout', csv: 'CSV' }[r.typ] || r.typ;
  await novyZdroj({ nazev: f.name, format, hash: await sha256(buf), velikost: f.size, varovani: r.varovani }, r.zaznamy);
}
async function importujFotky(fotky) {
  const zaz = [], varovani = [], hashe = [];
  let posunNavrh = null, velikost = 0;
  for (const f of fotky) {
    const buf = await f.arrayBuffer();
    velikost += f.size;
    const r = J.zExif(J.ctiExif(buf), f.name);
    if (!r.zaznamy.length) { varovani.push(f.name + ': ' + r.varovani.join(', ')); continue; }
    if (r.varovani.length) varovani.push(f.name + ': ' + r.varovani.join(', '));
    if (r.gpsUtc && r.naivniCas != null && posunNavrh == null) posunNavrh = { naiv: r.naivniCas, gps: r.gpsUtc };
    zaz.push(...r.zaznamy);
    hashe.push(f.name + ' ' + (await sha256(buf)).slice(0, 16) + '…');
  }
  if (!zaz.length) { Dialog.chyba('Žádná fotka nemá čas pořízení v EXIF.' + (varovani.length ? ' ' + varovani.slice(0, 3).join('; ') : '')); return; }
  await novyZdroj({ nazev: fotky.length === 1 ? fotky[0].name : 'Fotografie (' + zaz.length + ')', format: 'EXIF', zarizeni: 'fotoaparát', velikost,
    hash: fotky.length === 1 ? (await sha256(await fotky[0].arrayBuffer())) : '', varovani: varovani.concat(fotky.length > 1 ? ['otisky: ' + hashe.join(', ')] : []) }, zaz, posunNavrh);
}
async function novyZdroj(zdroj, zaznamy, posunNavrh) {
  const naivnich = zaznamy.filter(z => z.naiv).length;
  const rz = J.rozsah(zaznamy.map(z => ({ t: z.t0, k: z.k0 })));
  const info = `<b>${esc(zdroj.nazev)}</b> (${esc(zdroj.format)}) – ${zaznamy.length} záznamů` +
    (rz ? `, ${J.formatCas(rz.od, 'UTC', 'datum')} – ${J.formatCas(rz.do, 'UTC', 'datum')}` : '') +
    (naivnich ? `<br><span class="varov">⚠️ ${naivnich} časů je bez údaje o pásmu – zkontrolujte pásmo níže.</span>` : '<br>Všechny časy nesou pásmo (UTC) – pásmo níže se jich netýká.') +
    (zdroj.varovani && zdroj.varovani.length ? '<br><span class="varov">' + esc(zdroj.varovani.slice(0, 4).join('; ')) + '</span>' : '');
  const z = Object.assign({ osoba: J.osoby(pripad)[0] || 'Osoba 1', tz: tz(), posun: 0 }, zdroj);
  if (posunNavrh) {
    const s = J.posunZGps(posunNavrh.naiv, posunNavrh.gps, z.tz);
    z.posunInfo = `Fotka nese i čas GPS (UTC). Podle něj se hodiny fotoaparátu liší o ${s} s (${J.formatTrvani(s)}) – posun předvyplněn.`;
    if (Math.abs(s) > 5 && Math.abs(s) < 86400 * 3) z.posun = s;
  }
  const vys = await upravZdroj(z, info + (z.posunInfo ? '<br>📡 ' + esc(z.posunInfo) : ''), true);
  if (!vys) return;
  J.pridejZdroj(pripad, vys, zaznamy);
  zmena({ cely: true });
  Dialog.info(`Načteno ${zaznamy.length} záznamů ze zdroje ${vys.nazev}.`);
}
function datumNaWall(v) { // hodnota datetime-local → nástěnný čas (ms jako UTC)
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(v || '');
  return m ? Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)) : null;
}
function wallNaDatum(t, pasmo) { // UTC → hodnota datetime-local v pásmu
  const c = J.isoCas(t, pasmo); return c.slice(0, 19);
}
function upravZdroj(z, info, novy) {
  const d = $('dlgZdroj'), f = d.querySelector('form');
  $('dlgZdrojTitul').textContent = novy ? '📥 Nový zdroj dat' : '✏️ Úprava zdroje';
  $('dlgZdrojInfo').innerHTML = info || '';
  $('dlgZdrojInfo').hidden = !info;
  f.osoba.value = z.osoba || ''; f.zarizeni.value = z.zarizeni || ''; f.nazev.value = z.nazev || '';
  f.tz.value = z.tz || tz(); f.posun.value = z.posun || 0;
  f.barva.value = z.barva || J.BARVY[pripad.zdroje.length % J.BARVY.length];
  f.posunA.value = ''; f.posunB.value = '';
  d.returnValue = '';
  d.showModal();
  return new Promise(ok => d.addEventListener('close', () => {
    if (d.returnValue !== 'ok') return ok(null);
    if (!J.platnePasmo(f.tz.value.trim())) { Dialog.chyba('Neznámé časové pásmo „' + f.tz.value + '“ – použito ' + tz() + '.'); }
    ok(Object.assign(z, { osoba: f.osoba.value.trim() || 'Osoba', zarizeni: f.zarizeni.value.trim(), nazev: f.nazev.value.trim() || z.nazev,
      tz: J.platnePasmo(f.tz.value.trim()) ? f.tz.value.trim() : tz(), posun: Math.round(+String(f.posun.value).replace(',', '.') || 0), barva: f.barva.value }));
  }, { once: true }));
}
$('spocitejPosun').addEventListener('click', () => {
  const f = $('dlgZdroj').querySelector('form');
  const a = datumNaWall(f.posunA.value), b = datumNaWall(f.posunB.value);
  if (a == null || b == null) return Dialog.chyba('Vyplňte oba časy.');
  f.posun.value = Math.round((b - a) / 1000);
});

/* CSV: dialog mapování */
const POLE_NAZVY = { cas: 'Datum a čas', datum: 'Datum', hodina: 'Čas', typ: 'Typ (hovor/SMS/data)', smer: 'Směr', protistrana: 'Protistrana (číslo)', trvani: 'Trvání', lat: 'Zeměpisná šířka', lon: 'Zeměpisná délka', acc: 'Přesnost / poloměr buňky (m)', azimut: 'Azimut antény (°)', svazek: 'Šířka svazku antény (°)', popis: 'Popis / BTS / adresa' };
function mapujCsv(nazev, r) {
  const d = $('dlgCsv'), f = d.querySelector('form');
  $('dlgCsvTitul').textContent = '📊 Sloupce CSV – ' + nazev;
  const moznosti = '<option value="">—</option>' + r.csv.hlavicka.map((h, i) => `<option value="${i}">${esc(h || 'sloupec ' + (i + 1))}</option>`).join('');
  $('csvMapovani').innerHTML = Object.entries(POLE_NAZVY).map(([k, n]) => `<label class="pole">${n}<select class="vstup" data-pole="${k}">${moznosti}</select></label>`).join('');
  for (const [k, i] of Object.entries(r.mapovani)) $('csvMapovani').querySelector(`[data-pole="${k}"]`).value = i;
  f.vychoziTyp.innerHTML = ['hovor', 'sms', 'data', 'poloha', 'udalost'].map(t => `<option value="${t}">${J.TYPY[t].ikona} ${J.TYPY[t].nazev}</option>`).join('');
  $('csvNahled').innerHTML = `<table><thead><tr>${r.csv.hlavicka.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${r.csv.radky.slice(0, 6).map(x => `<tr>${x.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  d.returnValue = ''; d.showModal();
  return new Promise(ok => d.addEventListener('close', () => {
    if (d.returnValue !== 'ok') return ok(null);
    const mapovani = {};
    $('csvMapovani').querySelectorAll('[data-pole]').forEach(s => { if (s.value !== '') mapovani[s.dataset.pole] = +s.value; });
    if (mapovani.cas == null && mapovani.datum == null) { Dialog.chyba('Bez sloupce s datem nelze záznamy umístit v čase.'); return ok(null); }
    ok({ mapovani, vychoziTyp: f.vychoziTyp.value });
  }, { once: true }));
}

/* tažení souborů */
let tahPocet = 0;
addEventListener('dragenter', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { tahPocet++; document.body.classList.add('tahne'); } });
addEventListener('dragleave', () => { if (--tahPocet <= 0) { tahPocet = 0; document.body.classList.remove('tahne'); } });
addEventListener('dragover', e => e.preventDefault());
addEventListener('drop', e => { e.preventDefault(); tahPocet = 0; document.body.classList.remove('tahne'); if (e.dataTransfer.files.length) importuj(e.dataTransfer.files); });
$('souborImport').addEventListener('change', e => { importuj(e.target.files); e.target.value = ''; });

/* ---------- časová osa (canvas) ---------- */
const osa = $('osa');
let LEVY = 128;
const OSA_H = 24, RADEK = 22;
let radky = [];
function sestavRadky() {
  radky = [];
  for (const o of J.osoby(pripad)) {
    radky.push({ druh: 'osoba', osoba: o });
    for (const z of pripad.zdroje.filter(x => x.osoba === o)) radky.push({ druh: 'zdroj', z });
  }
}
const KROKY = [1, 5, 15, 30, 60, 300, 600, 900, 1800, 3600, 7200, 10800, 21600, 43200, 86400, 172800, 604800, 2592000].map(s => s * 1000);
function kresliOsu() {
  sestavRadky();
  LEVY = (osa.clientWidth || 600) < 500 ? 92 : 128;
  const dpr = window.devicePixelRatio || 1;
  const w = osa.clientWidth || 600, h = OSA_H + Math.max(1, radky.length) * RADEK + 6;
  if (osa.width !== Math.round(w * dpr) || osa.height !== Math.round(h * dpr)) { osa.width = Math.round(w * dpr); osa.height = Math.round(h * dpr); osa.style.height = h + 'px'; }
  const g = osa.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cs = getComputedStyle(document.body);
  const barva = n => cs.getPropertyValue(n).trim();
  g.fillStyle = barva('--bg-panel'); g.fillRect(0, 0, w, h);
  const W = w - LEVY, x = t => LEVY + (t - pohled.od) / (pohled.do - pohled.od) * W;
  // mřížka a popisky
  const msNaPx = (pohled.do - pohled.od) / W;
  const krok = KROKY.find(k => k / msNaPx >= 90) || KROKY[KROKY.length - 1];
  const posun = J.posunPasma(tz(), pohled.od) * 60000;
  g.font = '11px system-ui,sans-serif'; g.textBaseline = 'middle';
  let t = Math.ceil((pohled.od + posun) / krok) * krok - posun;
  if (krok >= 86400000) t = J.naUtc(Math.ceil((pohled.od + posun) / 86400000) * 86400000, tz());
  for (; t <= pohled.do; t += krok) {
    const X = x(t);
    g.strokeStyle = barva('--border'); g.beginPath(); g.moveTo(X + .5, OSA_H - 4); g.lineTo(X + .5, h); g.stroke();
    g.fillStyle = barva('--text-muted');
    const c = J.formatCas(t, tz());
    const pul = c.split(' ');
    const txt = krok >= 86400000 ? J.formatCas(t, tz(), 'datum') : krok < 60000 ? pul[3] : pul[3].slice(0, 5) + (c.includes(' 00:00:') ? ' ' + pul[0] + pul[1] : '');
    g.fillText(txt, X + 3, 11);
  }
  // poznámky
  g.fillStyle = barva('--warn');
  for (const n of pripad.poznamky) { const X = x(n.t); if (X < LEVY || X > w) continue; g.beginPath(); g.moveTo(X - 5, OSA_H - 9); g.lineTo(X + 5, OSA_H - 9); g.lineTo(X, OSA_H - 2); g.fill(); }
  // řádky
  const shodySet = new Set(shody);
  radky.forEach((r, i) => {
    const y = OSA_H + i * RADEK;
    if (r.druh === 'osoba') { g.fillStyle = barva('--bg-elevated'); g.fillRect(0, y, w, RADEK); }
    g.strokeStyle = barva('--border'); g.beginPath(); g.moveTo(0, y + RADEK + .5); g.lineTo(w, y + RADEK + .5); g.stroke();
    g.save(); g.beginPath(); g.rect(LEVY, y, W, RADEK); g.clip();
    if (r.druh === 'osoba') {
      for (const v of vrstvyOsy[r.osoba] || []) {
        const a = Math.max(LEVY, x(v.od)), b = Math.min(w, x(v.do));
        if (b < LEVY || a > w) continue;
        const carka = v.druh === 'alibi' || v.druh === 'rozpor';
        g.globalAlpha = carka ? 1 : .55; g.fillStyle = v.barva;
        if (carka) g.fillRect(x(v.od) - 1, v.druh === 'rozpor' ? y + RADEK / 2 : y, 3, v.druh === 'rozpor' ? RADEK / 2 : RADEK);
        else if (v.druh === 'navsteva') g.fillRect(a, y + RADEK - 6, Math.max(3, b - a), 4);
        else g.fillRect(a, y + (v.druh === 'soubeh' ? 2 : 6), Math.max(2, b - a), v.druh === 'soubeh' ? 6 : RADEK - 10);
        g.globalAlpha = 1;
      }
    } else {
      const z = r.z;
      // mezery
      g.fillStyle = barva('--danger'); g.globalAlpha = .18;
      for (const m of mezeryZdroju[z.id] || []) { const a = x(m.od), b = x(m.do); if (b < LEVY || a > w) continue; g.fillRect(a, y + 2, b - a, RADEK - 4); }
      g.globalAlpha = z.skryty ? .3 : 1;
      const zaz = poZdroji[z.id] || [];
      let i0 = lb(zaz, pohled.od - 864e5);
      let posledniX = -9;
      for (let k = i0; k < zaz.length && zaz[k].t <= pohled.do; k++) {
        const q = zaz[k], X = x(q.t);
        if (q.k != null && q.k > q.t) { g.fillStyle = z.barva; g.globalAlpha = (z.skryty ? .3 : 1) * .45; g.fillRect(X, y + 5, Math.max(2, x(q.k) - X), RADEK - 10); g.globalAlpha = z.skryty ? .3 : 1; }
        if (q.dulezite) { g.fillStyle = barva('--warn'); g.font = '11px system-ui,sans-serif'; g.fillText('★', X - 4, y + 4); }
        if (hledani && shodySet.has(q)) { g.strokeStyle = barva('--accent'); g.lineWidth = 2; g.beginPath(); g.arc(X, y + RADEK / 2, 6.5, 0, 7); g.stroke(); g.lineWidth = 1; }
        if (q.typ === 'poloha') {
          if (X - posledniX < 1) continue;
          posledniX = X; g.fillStyle = z.barva; g.fillRect(Math.round(X), y + 7, 1, RADEK - 14);
        } else {
          g.fillStyle = z.barva; g.beginPath(); g.arc(X, y + RADEK / 2, 4, 0, 7); g.fill();
          g.strokeStyle = barva('--bg-panel'); g.lineWidth = 1; g.stroke();
        }
      }
      g.globalAlpha = 1;
    }
    g.restore();
    // popisek
    g.fillStyle = r.druh === 'osoba' ? barva('--bg-elevated') : barva('--bg-panel'); g.fillRect(0, y, LEVY - 2, RADEK);
    g.fillStyle = r.druh === 'osoba' ? barva('--text') : barva('--text-muted');
    g.font = (r.druh === 'osoba' ? '600 ' : '') + '11.5px system-ui,sans-serif';
    let text = r.druh === 'osoba' ? '👤 ' + r.osoba : '   ' + (r.z.zarizeni || r.z.nazev);
    if (r.druh === 'zdroj') { g.fillStyle = r.z.barva; g.fillRect(8, y + 7, 8, 8); g.fillStyle = barva('--text-muted'); text = (r.z.zarizeni || r.z.nazev); }
    const X0 = r.druh === 'zdroj' ? 21 : 5;
    while (text.length > 3 && g.measureText(text).width > LEVY - X0 - 6) text = text.slice(0, -2);
    g.fillText(text !== (r.druh === 'osoba' ? '👤 ' + r.osoba : (r.z.zarizeni || r.z.nazev)) ? text + '…' : text, X0, y + RADEK / 2 + 1);
  });
  // kurzor
  const K = x(kurzor);
  if (K >= LEVY && K <= w) { g.strokeStyle = barva('--danger'); g.lineWidth = 2; g.beginPath(); g.moveTo(K, 0); g.lineTo(K, h); g.stroke(); g.lineWidth = 1; }
}
function lb(a, t) { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m].t < t) lo = m + 1; else hi = m; } return lo; }
const tZX = X => pohled.od + (X - LEVY) / ((osa.clientWidth || 600) - LEVY) * (pohled.do - pohled.od);
function zoom(f, stred) {
  const s = stred == null ? kurzor : stred, d = pohled.do - pohled.od;
  const nd = Math.min(Math.max(d * f, 20000), 3 * 365 * 864e5);
  const r = (s - pohled.od) / d;
  pohled = { od: s - nd * r, do: s - nd * r + nd };
  zmenaPohledu();
}
let pohledTimer = null;
function zmenaPohledu() { kresliOsu(); clearTimeout(pohledTimer); pohledTimer = setTimeout(() => { obnovMapu(); if (zalozka === 'zaznamy') kresliPanel(); }, 160); }
osa.addEventListener('wheel', e => {
  e.preventDefault();
  const r = osa.getBoundingClientRect();
  if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) { const d = (pohled.do - pohled.od) * (e.deltaX || e.deltaY) / 1000; pohled = { od: pohled.od + d, do: pohled.do + d }; return zmenaPohledu(); }
  zoom(e.deltaY > 0 ? 1.25 : 0.8, tZX(e.clientX - r.left));
}, { passive: false });
let tah = null;
osa.addEventListener('pointerdown', e => { tah = { x: e.clientX, od: pohled.od, do: pohled.do, pohnul: false }; osa.setPointerCapture(e.pointerId); });
osa.addEventListener('pointermove', e => {
  if (!tah) return;
  const dx = e.clientX - tah.x;
  if (Math.abs(dx) > 3) tah.pohnul = true;
  if (!tah.pohnul) return;
  const d = dx / ((osa.clientWidth || 600) - LEVY) * (tah.do - tah.od);
  pohled = { od: tah.od - d, do: tah.do - d }; zmenaPohledu();
});
osa.addEventListener('pointerup', e => {
  if (tah && !tah.pohnul) {
    const r = osa.getBoundingClientRect(), X = e.clientX - r.left;
    if (X > LEVY) nastavKurzor(tZX(X));
    else { const i = Math.floor((e.clientY - r.top - OSA_H) / RADEK); const rr = radky[i]; if (rr && rr.druh === 'zdroj') { zalozka = 'zdroje'; kresliPanel(); } }
  }
  tah = null;
});
$('zoomDo').onclick = () => zoom(0.5);
$('zoomVen').onclick = () => zoom(2);
$('celaOsa').onclick = () => { pohled = celyRozsah(); kresliOsu(); obnovMapu(true); if (zalozka === 'zaznamy') kresliPanel(); };
addEventListener('resize', () => { kresliOsu(); zavriNabidky(); if (mapa) mapa.invalidateSize(); });

function nastavKurzor(t, posunPohled) {
  kurzor = t;
  if (posunPohled && (t < pohled.od || t > pohled.do)) { const d = pohled.do - pohled.od; pohled = { od: t - d / 2, do: t + d / 2 }; zmenaPohledu(); }
  else kresliOsu();
  obnovKurzor();
}
function krok(smer) {
  const v = pripad.zaznamy.filter(r => !zdrojById(r.zdroj).skryty);
  const r = smer > 0 ? v.find(x => x.t > kurzor + 500) : [...v].reverse().find(x => x.t < kurzor - 500);
  if (r) nastavKurzor(r.t, true);
}
$('krokZpet').onclick = () => krok(-1);
$('krokVpred').onclick = () => krok(1);
// přehrávání
let hraje = false, posledniSnimek = 0;
function smycka(cas) {
  if (!hraje) return;
  const dt = posledniSnimek ? (cas - posledniSnimek) / 1000 : 0; posledniSnimek = cas;
  const kon = celyRozsah().do;
  kurzor += dt * +$('rychlost').value * 1000;
  if (kurzor >= kon) { kurzor = kon; prepniHrani(false); }
  if (kurzor > pohled.do) { const d = pohled.do - pohled.od; pohled = { od: kurzor - d * 0.1, do: kurzor + d * 0.9 }; zmenaPohledu(); }
  kresliOsu(); obnovKurzor();
  requestAnimationFrame(smycka);
}
function prepniHrani(ano) {
  hraje = ano == null ? !hraje : ano;
  $('hraj').textContent = hraje ? '⏸' : '▶';
  if (hraje) { posledniSnimek = 0; requestAnimationFrame(smycka); }
}
$('hraj').onclick = () => prepniHrani();

/* ---------- mapa ---------- */
let mapa = null, vrstvaData = null, vrstvaKurzor = null, vrstvaAnalyza = null, vybirani = null;
const PODKLADY = [
  { klic: 'zakladni', nazev: 'Základní (OSM Německo)', url: 'https://{s}.tile.openstreetmap.de/{z}/{x}/{y}.png', o: { maxZoom: 18, subdomains: 'abc', attribution: '© přispěvatelé <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, dlaždice openstreetmap.de' } },
  { klic: 'hot', nazev: 'Základní (OSM France HOT)', url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', o: { maxZoom: 19, subdomains: 'abc', attribution: '© přispěvatelé <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, styl HOT, hosting OSM France' } },
  { klic: 'topo', nazev: 'Topografická (Esri)', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', o: { maxZoom: 19, attribution: 'Podklad © Esri a dodavatelé (World Topo Map)' } },
  { klic: 'letecka', nazev: 'Letecká (Esri)', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', o: { maxZoom: 19, attribution: 'Snímky © Esri, Maxar, Earthstar Geographics a další' } },
  { klic: 'zadny', nazev: '🔒 Bez podkladu (nic se nestahuje)', url: '', o: { maxZoom: 19 } }
];
const ZALOHA = { zakladni: 'hot', hot: 'topo', topo: 'zakladni', letecka: 'topo' };
function vytvorMapu() {
  if (typeof L === 'undefined') { $('mapa').innerHTML = '<p style="padding:12px">Knihovna map se nenačetla.</p>'; return; }
  mapa = L.map('mapa', { zoomControl: true }).setView([49.8, 15.5], 7);
  const vrstvy = {}, podle = {};
  for (const p of PODKLADY) {
    const v = p.url ? L.tileLayer(p.url, Object.assign({}, p.o)) : L.layerGroup();
    v._klic = p.klic; vrstvy[p.nazev] = v; podle[p.klic] = v;
    if (!p.url) continue;
    let chyb = 0, ok = 0;
    v.on('add', () => { chyb = 0; ok = 0; });
    v.on('tileload', () => { ok++; });
    v.on('tileerror', () => {
      chyb++;
      if (chyb >= 6 && ok === 0 && mapa.hasLayer(v) && ZALOHA[p.klic]) {
        mapa.removeLayer(v); podle[ZALOHA[p.klic]].addTo(mapa);
        Dialog.info(`Podklad „${p.nazev}“ se nenačítá – přepnuto na záložní.`);
      }
    });
  }
  (podle[nast.podklad] || podle.zakladni).addTo(mapa);
  mapa.on('baselayerchange', e => { nast.podklad = e.layer._klic; nastUloz(); });
  L.control.layers(vrstvy, null, { collapsed: true }).addTo(mapa);
  L.control.scale({ imperial: false }).addTo(mapa);
  vrstvaData = L.layerGroup().addTo(mapa);
  vrstvaAnalyza = L.layerGroup().addTo(mapa);
  vrstvaKurzor = L.layerGroup().addTo(mapa);
  mapa.on('click', e => {
    if (!vybirani) return;
    const f = vybirani; vybirani = null;
    $('mapa').classList.remove('vyber-mapy'); $('hlaskaMapa').hidden = true;
    f(e.latlng);
  });
}
function popisZaznamu(r) {
  const z = zdrojById(r.zdroj), T = J.TYPY[r.typ];
  return `<b>${T.ikona} ${esc(T.nazev)}</b> · ${esc(z.osoba)}${z.zarizeni ? ' (' + esc(z.zarizeni) + ')' : ''}<br>${J.formatCas(r.t, tz())}${r.k != null ? ' – ' + J.formatCas(r.k, tz(), 'cas') + ' (' + J.formatTrvani((r.k - r.t) / 1000) + ')' : ''}` +
    (r.smer ? '<br>' + (r.smer === 'in' ? '⬅ příchozí' : '➡ odchozí') : '') + (r.protistrana ? ' ' + esc(r.protistrana) : '') + (r.trvani != null && r.typ !== 'data' ? ', ' + J.formatTrvani(r.trvani) : '') +
    (r.popis ? '<br>' + esc(r.popis) : '') + (r.lat != null ? `<br><span style="opacity:.7">${r.lat.toFixed(5)}, ${r.lon.toFixed(5)}${r.acc ? ' ±' + Math.round(r.acc) + ' m' : ''}${r.azimut != null ? ' · azimut ' + Math.round(r.azimut) + '°, svazek ' + (r.svazek || 120) + '°' : ''}</span>` : '') +
    (J.KOMUNIKACE[r.typ] && r.lat != null ? '<br><span style="opacity:.7">poloha antény BTS, ne telefonu</span>' : '') + (r.dulezite ? '<br>★ označeno' : '') +
    `<br><span style="opacity:.7">zdroj: ${esc(z.nazev)}</span>`;
}
function obnovMapu(prizpusob) {
  if (!mapa) return;
  vrstvaData.clearLayers();
  const vyrez = $('jenVyrez').checked, od = vyrez ? pohled.od : -Infinity, dO = vyrez ? pohled.do : Infinity;
  const meze = [];
  for (const z of pripad.zdroje) {
    if (z.skryty) continue;
    const zaz = poZdroji[z.id] || [];
    const body = zaz.filter(r => r.typ === 'poloha' && r.t >= od && r.t <= dO);
    const krok = Math.max(1, Math.ceil(body.length / 4000));
    const cara = [];
    for (let i = 0; i < body.length; i += krok) cara.push([body[i].lat, body[i].lon]);
    if (cara.length > 1) L.polyline(cara, { color: z.barva, weight: 3, opacity: .75 }).addTo(vrstvaData);
    if (cara.length) meze.push(...cara.filter((_, i) => i % 10 === 0 || i === cara.length - 1));
    if (cara.length === 1) L.circleMarker(cara[0], { radius: 3, color: z.barva }).addTo(vrstvaData);
    let n = 0;
    for (const r of zaz) {
      if (r.typ === 'poloha' || r.lat == null || (r.k != null ? r.k : r.t) < od || r.t > dO) continue;
      if (++n > 600) break;
      const m = L.circleMarker([r.lat, r.lon], { radius: r.typ === 'navsteva' ? 8 : 6, color: '#000', weight: 1, fillColor: z.barva, fillOpacity: .9 }).addTo(vrstvaData);
      if (r.azimut != null && $('vysece').checked) L.polygon(J.vysec(r.lat, r.lon, r.azimut, r.svazek || 120, r.acc || J.VYCHOZI_POLOMER_BTS), { color: z.barva, weight: 1, fillOpacity: .07, dashArray: '4 4', interactive: false }).addTo(vrstvaData);
      else if (r.acc && r.acc > 60 && (r.azimut == null)) L.circle([r.lat, r.lon], { radius: r.acc, color: z.barva, weight: 1, fill: false, dashArray: '3 4', interactive: false }).addTo(vrstvaData);
      m.bindPopup(() => popisZaznamu(r) + tlacitkaPopupu(r));
      m.bindTooltip(J.TYPY[r.typ].ikona + ' ' + J.formatCas(r.t, tz(), 'cas'));
      meze.push([r.lat, r.lon]);
    }
  }
  for (const m of prizpusob ? pripad.mista : []) meze.push([m.lat, m.lon]);
  if (prizpusob && meze.length) mapa.fitBounds(L.latLngBounds(meze).pad(0.1), { maxZoom: 16 });
}
const tlacitkaPopupu = r => `<br><button type="button" class="btn mini" data-kurzor="${r.t}">⏱ na osu</button> <button type="button" class="btn mini" data-oznac="${r.id}">${r.dulezite ? '★ zrušit označení' : '⭐ označit'}</button>`;
document.addEventListener('click', e => {
  const b = e.target.closest('[data-kurzor]'); if (b) nastavKurzor(+b.dataset.kurzor, true);
  const o = e.target.closest('[data-oznac]');
  if (o) { const r = pripad.zaznamy.find(x => x.id === o.dataset.oznac); if (r) { oznac(r); if (mapa) mapa.closePopup(); } }
}, true); // capture: bubliny Leafletu zastavují šíření kliknutí
function oznac(r, stav) {
  r.dulezite = stav == null ? !r.dulezite : stav;
  uloz(); spocitejShody(); kresliOsu(); if (zalozka === 'zaznamy') kresliPanel();
}
// zájmová místa – trvalá vrstva
let vrstvaMista = null;
function kresliMista() {
  if (!mapa) return;
  if (!vrstvaMista) vrstvaMista = L.layerGroup().addTo(mapa);
  vrstvaMista.clearLayers();
  for (const m of pripad.mista) {
    L.circle([m.lat, m.lon], { radius: m.R, color: barvaCss('--accent'), weight: 2, dashArray: '2 5', fillOpacity: .05, interactive: false }).addTo(vrstvaMista);
    L.marker([m.lat, m.lon], { icon: L.divIcon({ className: '', html: '<div class="znacka-misto">📍</div>', iconSize: [20, 20], iconAnchor: [10, 19] }) })
      .bindTooltip(esc(m.nazev) + ' (' + J.formatVzd(m.R) + ')').bindPopup(`<b>📍 ${esc(m.nazev)}</b><br>${m.lat.toFixed(5)}, ${m.lon.toFixed(5)} · okruh ${J.formatVzd(m.R)}${m.popis ? '<br>' + esc(m.popis) : ''}`).addTo(vrstvaMista);
  }
}
const barvaCss = n => getComputedStyle(document.body).getPropertyValue(n).trim();
function obnovKurzor() {
  $('kurzorText').textContent = J.formatCas(kurzor, tz());
  $('kurzorTz').textContent = tz();
  if (!mapa) return;
  vrstvaKurzor.clearLayers();
  for (const o of J.osoby(pripad)) {
    const body = J.bodyOsoby(pripad, o, true);
    const p = J.polohaVCase(body, kurzor, 30);
    if (!p) continue;
    const z = pripad.zdroje.find(x => x.osoba === o && !x.skryty) || {};
    const zkr = o.split(/\s+/).map(s => s[0]).join('').slice(0, 2).toUpperCase();
    if (p.acc > 30) L.circle([p.lat, p.lon], { radius: p.acc, color: z.barva, weight: 1, fillOpacity: .08, interactive: false }).addTo(vrstvaKurzor);
    L.marker([p.lat, p.lon], { icon: L.divIcon({ className: '', html: `<div class="znacka-osoba" style="background:${z.barva};width:26px;height:26px;line-height:22px;opacity:${p.odhad ? .8 : 1}">${esc(zkr)}</div>`, iconSize: [26, 26], iconAnchor: [13, 13] }), zIndexOffset: 1000 })
      .bindTooltip(`${esc(o)}<br>${J.formatCas(kurzor, tz(), 'cas')}${p.odhad ? ' (dopočteno mezi body' + (p.mezera ? ' vzdálenými ' + J.formatTrvani(p.mezera) : '') + ')' : ''}`).addTo(vrstvaKurzor);
  }
}
function vyberVMape(f) {
  if (!mapa) return;
  vybirani = f; $('mapa').classList.add('vyber-mapy'); clearTimeout(hlaskaT); $('hlaskaMapa').textContent = 'Klikněte do mapy na místo (Esc = zrušit)'; $('hlaskaMapa').hidden = false;
}

/* ---------- panel ---------- */
document.querySelector('.zalozky').addEventListener('click', e => {
  const b = e.target.closest('[data-zal]'); if (!b) return;
  zalozka = b.dataset.zal; kresliPanel();
});
let filtrTyp = '';
function nastavHledani(q) {
  hledani = q; if ($('hledej').value !== q) $('hledej').value = q;
  spocitejShody(); kresliOsu();
}
function kresliPanel() {
  document.querySelectorAll('[data-zal]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.zal === zalozka)));
  const P = $('panelTelo');
  if (zalozka === 'zdroje') {
    P.innerHTML = pripad.zdroje.length ? pripad.zdroje.map(z => {
      const zaz = poZdroji[z.id] || [], rz = J.rozsah(zaz), naiv = zaz.filter(r => r.naiv).length;
      const mez = (mezeryZdroju[z.id] || []).length;
      return `<div class="karta${z.skryty ? ' skryty' : ''}" style="--pruh:${z.barva}" data-zdroj="${z.id}">
        <h3><span>${esc(z.nazev)}</span><span class="meta">${esc(z.format)}</span></h3>
        <div class="meta">👤 ${esc(z.osoba)}${z.zarizeni ? ' · 📱 ' + esc(z.zarizeni) : ''}<br>
        ${zaz.length} záznamů${rz ? ' · ' + J.formatCas(rz.od, tz()) + ' – ' + J.formatCas(rz.do, tz()) : ''}<br>
        🕐 ${naiv ? `${naiv}× bez pásma → ${esc(z.tz)}` : 'časy s pásmem'} · posun hodin ${z.posun ? (z.posun > 0 ? '+' : '') + z.posun + ' s' : '0'}${mez ? ` · <span class="varov">${mez} mezer &gt; 1 h</span>` : ''}
        ${z.hash ? `<br><span title="SHA-256 původního souboru">#️⃣ ${z.hash.slice(0, 20)}…</span>` : ''}
        ${z.varovani.length ? `<br><span class="varov">⚠️ ${esc(z.varovani.slice(0, 3).join('; '))}</span>` : ''}</div>
        <div class="akce"><button class="btn mini" data-z-akce="uprav">✏️ Upravit</button><button class="btn mini" data-z-akce="skryj">${z.skryty ? '👁 Zobrazit' : '🙈 Skrýt'}</button><button class="btn mini" data-z-akce="zoom">🔍 Na osu</button><button class="btn mini danger" data-z-akce="smaz">🗑️</button></div></div>`;
    }).join('') + `<p class="info">Pásmo a posun hodin u zdroje mění čas všech jeho záznamů. Typický posun: telefon s ručně nastaveným časem, fotoaparát po výměně baterie, kamerový systém.</p>`
      : '<div class="prazdno">Žádné zdroje. Použijte 📥 Import nebo přetáhněte soubory do okna.</div>';
  } else if (zalozka === 'zaznamy') {
    const tl = J.TYPY;
    const shSet = new Set(shody);
    const v = pripad.zaznamy.filter(r => (r.k != null ? r.k : r.t) >= pohled.od && r.t <= pohled.do && (!filtrTyp || r.typ === filtrTyp) && !zdrojById(r.zdroj).skryty &&
      (!hledani.trim() || shSet.has(r)));
    const max = 400;
    P.innerHTML = `<div class="radek-f"><select class="vstup" id="fTyp" aria-label="Typ záznamu"><option value="">Všechny typy</option>${Object.entries(tl).map(([k, t]) => `<option value="${k}"${k === filtrTyp ? ' selected' : ''}>${t.ikona} ${t.nazev}</option>`).join('')}</select>
      <input class="vstup" id="fText" type="search" placeholder="🔍 číslo, popis, osoba, ⭐" value="${esc(hledani)}" aria-label="Hledat v záznamech"></div>
      <p class="meta" style="font-size:.76rem;color:var(--text-muted);margin:0 0 6px">${v.length} záznamů ve výřezu osy${v.length > max ? ` (zobrazeno prvních ${max} – přibližte osu)` : ''}. Klik = kurzor a mapa, ⭐ = označit do chronologie.</p>
      ${v.length ? `<table><thead><tr><th>Čas</th><th>Kdo</th><th>Co</th><th aria-label="Označení">⭐</th></tr></thead><tbody>${v.slice(0, max).map(r => {
        const z = zdrojById(r.zdroj);
        return `<tr data-zaznam="${r.id}"><td class="cas">${J.formatCas(r.t, tz(), 'cas')}<br><span style="color:var(--text-muted)">${J.formatCas(r.t, tz(), 'datum')}</span></td>
          <td><span class="tecka" style="background:${z.barva}"></span>${esc(z.osoba)}</td>
          <td>${tl[r.typ].ikona} ${r.smer === 'in' ? '⬅' : r.smer === 'out' ? '➡' : ''} ${esc(r.protistrana)}${r.trvani != null && r.typ !== 'data' ? ' · ' + J.formatTrvani(r.trvani) : ''}${r.k != null && r.typ !== 'hovor' ? ' · ' + J.formatTrvani((r.k - r.t) / 1000) : ''} ${esc(r.popis)}${r.lat != null && r.typ !== 'poloha' ? ' 📍' : ''}${r.acc ? ' ±' + Math.round(r.acc) + ' m' : ''}</td>
          <td><button type="button" class="hv${r.dulezite ? ' ano' : ''}" data-hv="${r.id}" title="${r.dulezite ? 'Zrušit označení' : 'Označit jako důležité'}" aria-pressed="${r.dulezite}">⭐</button></td></tr>`;
      }).join('')}</tbody></table>` : '<div class="prazdno">Ve výřezu nejsou žádné záznamy.</div>'}`;
    $('fTyp').onchange = e => { filtrTyp = e.target.value; kresliPanel(); };
    $('fText').oninput = e => { nastavHledani(e.target.value); clearTimeout(kresliPanel.t); kresliPanel.t = setTimeout(() => { kresliPanel(); const i = $('fText'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 300); };
  } else if (zalozka === 'vysledky') {
    const u = pripad.ukazkaInfo;
    const info = u ? `<div class="ukazka-info"><h4><span>${esc(u.ikona || '🧪')} Ukázka: ${esc(u.nazev)}</span><button class="btn mini" data-prikaz="galerie" title="Další ukázky">🧪</button></h4>
      <b>Vyzkoušejte:</b><ul>${u.vyzkousej.map(x => `<li>${esc(x)}</li>`).join('')}</ul><b>Analýza najde:</b> ${esc(u.najde)}</div>` : '';
    P.innerHTML = info + (vysledky.length ? vysledky.map((v, vi) => `<div class="vysl"><h3>${esc(v.nadpis)}</h3><div class="param">${esc(v.parametry || '')}</div>
      ${v.verdikt ? `<div class="verdikt ${v.verdikt}">${J.VERDIKTY[v.verdikt]}</div>` : ''}
      ${v.akce ? `<div class="akce-v"><button type="button" class="btn mini primary" data-pouzij="${vi}">${esc(v.akce.text)}</button></div>` : ''}
      ${v.html || ''}
      <ul>${v.polozky.length ? v.polozky.map((p, pi) => `<li data-vysl="${vi}:${pi}">${esc(p.text)}</li>`).join('') : '<li style="cursor:default;color:var(--text-muted)">žádné nálezy</li>'}</ul></div>`).join('')
      : '<div class="prazdno">Spusťte analýzu z menu 🔬 Analýza. Výsledky se zobrazí zde, na ose (řádek osoby) a v mapě, a vstoupí do protokolu.</div>');
  } else if (zalozka === 'mista') {
    P.innerHTML = `<div class="radek-f"><button class="btn primary" data-prikaz="noveMisto">➕ Přidat místo</button><button class="btn" data-analyza="mista">🔎 Vyhodnotit návštěvy</button></div>` +
      (pripad.mista.length ? pripad.mista.map(m => `<div class="karta" style="--pruh:var(--accent)" data-misto="${m.id}">
        <h3><span>📍 ${esc(m.nazev)}</span><span class="meta">${J.formatVzd(m.R)}</span></h3>
        <div class="meta">${m.lat.toFixed(5)}, ${m.lon.toFixed(5)}${m.popis ? '<br>' + esc(m.popis) : ''}</div>
        <div class="akce"><button class="btn mini" data-m-akce="mapa">🗺️ Na mapu</button><button class="btn mini" data-m-akce="alibi">🎯 Alibi zde</button><button class="btn mini" data-m-akce="uprav">✏️ Upravit</button><button class="btn mini danger" data-m-akce="smaz">🗑️</button></div></div>`).join('')
        : '<div class="prazdno">Zájmová místa (bydliště, místo činu, bankomat…) se kreslí na mapě a analýza „Návštěvy zájmových míst“ najde, kdy u nich kdo byl. Přidejte místo tlačítkem výše a klikněte do mapy.</div>');
  } else {
    const pz = [...pripad.poznamky].sort((a, b) => a.t - b.t);
    P.innerHTML = `<button class="btn primary" data-prikaz="poznamka" style="margin-bottom:8px">📝 Poznámka v čase kurzoru</button>` + (pz.length ? pz.map(n => `<div class="karta" style="--pruh:var(--warn)" data-pozn="${n.id}">
      <h3><span style="font-variant-numeric:tabular-nums">${J.formatCas(n.t, tz())}</span><span><button class="btn mini" data-pozn-akce="jdi" title="Na osu">⏱</button> <button class="btn mini" data-pozn-akce="uprav" title="Upravit">✏️</button> <button class="btn mini danger" data-pozn-akce="smaz" title="Smazat">🗑️</button></span></h3>
      <div style="white-space:pre-wrap">${esc(n.text)}</div></div>`).join('') : '<div class="prazdno">Poznámky se vážou k času (na ose žlutý trojúhelník) a vstupují do protokolu.</div>');
  }
}
$('panelTelo').addEventListener('click', async e => {
  const hv = e.target.closest('[data-hv]');
  if (hv) { const r = pripad.zaznamy.find(x => x.id === hv.dataset.hv); if (r) oznac(r); return; }
  const pu = e.target.closest('[data-pouzij]');
  if (pu) { const v = vysledky[+pu.dataset.pouzij]; if (v && v.akce) await v.akce.fn(); return; }
  const ma = e.target.closest('[data-m-akce]');
  if (ma) {
    const m = pripad.mista.find(x => x.id === ma.closest('[data-misto]').dataset.misto); if (!m) return;
    const a = ma.dataset.mAkce;
    if (a === 'mapa' && mapa) mapa.setView([m.lat, m.lon], Math.max(mapa.getZoom(), 16));
    else if (a === 'alibi') otevriAnalyzu('alibi', { misto: m.lat.toFixed(6) + ', ' + m.lon.toFixed(6), R: m.R });
    else if (a === 'uprav') otevriMisto(m);
    else if (a === 'smaz' && await Dialog.potvrd(`Odebrat zájmové místo „${m.nazev}“?`)) { pripad.mista = pripad.mista.filter(x => x !== m); zmena(); }
    return;
  }
  const tr = e.target.closest('[data-zaznam]');
  if (tr) {
    const r = pripad.zaznamy.find(x => x.id === tr.dataset.zaznam); if (!r) return;
    nastavKurzor(r.t, true);
    if (r.lat != null && mapa) { mapa.setView([r.lat, r.lon], Math.max(mapa.getZoom(), 15)); L.popup().setLatLng([r.lat, r.lon]).setContent(popisZaznamu(r) + tlacitkaPopupu(r)).openOn(mapa); }
    return;
  }
  const za = e.target.closest('[data-z-akce]');
  if (za) {
    const z = zdrojById(za.closest('[data-zdroj]').dataset.zdroj), a = za.dataset.zAkce;
    if (a === 'uprav') { const n = await upravZdroj(Object.assign({}, z), '', false); if (n) { Object.assign(z, n); zmena(); } }
    else if (a === 'skryj') { z.skryty = !z.skryty; zmena(); }
    else if (a === 'zoom') { const rz = J.rozsah(poZdroji[z.id] || []); if (rz) { const o = Math.max(60000, (rz.do - rz.od) * .03); pohled = { od: rz.od - o, do: rz.do + o }; kresliOsu(); obnovMapu(true); } }
    else if (a === 'smaz') { if (await Dialog.potvrd(`Odebrat zdroj „${z.nazev}“ a jeho ${(poZdroji[z.id] || []).length} záznamů z případu?`)) { J.smazZdroj(pripad, z.id); zmena(); } }
    return;
  }
  const v = e.target.closest('[data-vysl]');
  if (v) {
    const [a, b] = v.dataset.vysl.split(':').map(Number), p = vysledky[a].polozky[b];
    if (p.t != null) {
      if (p.k != null && p.k > p.t) { const o = Math.max(300000, (p.k - p.t) * .5); pohled = { od: p.t - o, do: p.k + o }; zmenaPohledu(); }
      nastavKurzor(p.t, true);
    }
    if (p.lat != null && mapa) mapa.setView([p.lat, p.lon], Math.max(mapa.getZoom(), 15));
    return;
  }
  const pa = e.target.closest('[data-pozn-akce]');
  if (pa) {
    const n = pripad.poznamky.find(x => x.id === pa.closest('[data-pozn]').dataset.pozn);
    if (pa.dataset.poznAkce === 'jdi') nastavKurzor(n.t, true);
    else if (pa.dataset.poznAkce === 'smaz') { if (await Dialog.potvrd('Smazat poznámku?')) { pripad.poznamky = pripad.poznamky.filter(x => x !== n); zmena(); } }
    else { const t = await Dialog.zeptej('Text poznámky', n.text); if (t != null && t.trim()) { n.text = t.trim().slice(0, 2000); zmena(); } }
  }
});

/* ---------- analýzy ---------- */
const osobyMoznosti = vyb => J.osoby(pripad).map(o => `<option${o === vyb ? ' selected' : ''}>${esc(o)}</option>`).join('');
const zdrojeSPolohou = () => pripad.zdroje.filter(z => (poZdroji[z.id] || []).some(r => r.lat != null && !J.KOMUNIKACE[r.typ]));
const ANALYZY = {
  pobyty: { titul: '🏠 Pobyty a přesuny', telo: () => `<p class="info" style="margin:0">Pobyt = body, které zůstaly v okruhu R po dobu aspoň T (algoritmus stay points). Mezi pobyty se spočítá přesun.</p>
    <div class="radek"><label class="pole">Okruh R (m)<input class="vstup" name="vzd" type="number" min="10" value="150"></label><label class="pole">Minimální doba T (min)<input class="vstup" name="min" type="number" min="1" value="10"></label></div>
    <label class="pole">Osoba<select class="vstup" name="osoba"><option value="">všechny</option>${osobyMoznosti()}</select></label>` },
  rychlosti: { titul: '🚀 Nemožné rychlosti', telo: () => `<p class="info" style="margin:0">Hledá sousední body jedné osoby, mezi nimiž by musela cestovat rychleji než limit. Od vzdálenosti se odečte přesnost obou bodů a 20 m.</p>
    <label class="pole">Limit (km/h)<input class="vstup" name="limit" type="number" min="10" value="250"></label>` },
  mezery: { titul: '🕳️ Mezery v datech', telo: () => `<p class="info" style="margin:0">Úseky bez jakéhokoli záznamu delší než práh, pro každé zařízení zvlášť (kromě fotek, ručních zápisů a výpisů bez polohových záznamů).</p>
    <label class="pole">Práh (min)<input class="vstup" name="prah" type="number" min="1" value="60"></label>` },
  soubeh: { titul: '👥 Souběh dvou osob', telo: () => `<div class="radek"><label class="pole">Osoba A<select class="vstup" name="a">${osobyMoznosti(J.osoby(pripad)[0])}</select></label><label class="pole">Osoba B<select class="vstup" name="b">${osobyMoznosti(J.osoby(pripad)[1])}</select></label></div>
    <div class="radek"><label class="pole">Vzdálenost nejvýše R (m)<input class="vstup" name="R" type="number" min="5" value="200"></label><label class="pole">Časový rozdíl bodů nejvýše (min)<input class="vstup" name="dt" type="number" min="0.1" step="0.1" value="5"></label></div>` },
  alibi: { titul: '🎯 Ověření alibi', telo: f => `<label class="pole">Osoba<select class="vstup" name="osoba">${osobyMoznosti(f.osoba)}</select></label>
    <div class="radek"><label class="pole">Čas T (pásmo ${esc(tz())})<input class="vstup" type="datetime-local" step="1" name="t" required value="${f.t || wallNaDatum(kurzor, tz())}"></label><label class="pole">Okno ± (min)<input class="vstup" name="okno" type="number" min="1" value="${f.okno || 15}"></label></div>
    <label class="pole">Místo (šířka, délka)<span class="spolu"><input class="vstup" name="misto" required placeholder="50.0705, 14.4040" value="${esc(f.misto || '')}"><button type="button" class="btn" data-vyber="dlgAnalyza" title="Vybrat v mapě">📍</button></span></label>
    ${pripad.mista.length ? `<label class="pole">…nebo zájmové místo<select class="vstup" data-vyber-misto><option value="">—</option>${pripad.mista.map(m => `<option value="${m.lat.toFixed(6)}, ${m.lon.toFixed(6)}|${m.R}">${esc(m.nazev)}</option>`).join('')}</select></label>` : ''}
    <label class="pole">Okruh R (m)<input class="vstup" name="R" type="number" min="5" value="${f.R || 300}"></label>` },
  mista: { titul: '📍 Návštěvy zájmových míst', telo: () => `<p class="info" style="margin:0">Pro každé zájmové místo (záložka 📍 Místa) najde úseky, kdy byla osoba v jeho okruhu. Bod jistě mimo okruh návštěvu ukončí, výpadek dat kratší než mezera ji nepřeruší.</p>
    <div class="radek"><label class="pole">Minimální doba (min, 0 = i průjezd)<input class="vstup" name="min" type="number" min="0" value="0"></label><label class="pole">Spojit přes výpadek dat do (min)<input class="vstup" name="mezera" type="number" min="1" value="20"></label></div>
    <label class="pole">Osoba<select class="vstup" name="osoba"><option value="">všechny</option>${osobyMoznosti()}</select></label>` },
  opakovana: { titul: '🔁 Opakovaná místa', telo: () => `<p class="info" style="margin:0">Pobyty blíž než 250 m se sloučí do míst. Domov = místo s nejvíce časem v noci (22–6 h), práce = nejvíce času v pracovní dny 8–18 h. Ukáže i rozložení pobytů po hodinách dne.</p>
    <div class="radek"><label class="pole">Okruh pobytu R (m)<input class="vstup" name="vzd" type="number" min="10" value="150"></label><label class="pole">Minimální pobyt T (min)<input class="vstup" name="min" type="number" min="1" value="15"></label></div>
    <label class="pole">Osoba<select class="vstup" name="osoba"><option value="">všechny</option>${osobyMoznosti()}</select></label>` },
  vzorce: { titul: '🗓️ Denní a týdenní vzorce', telo: () => `<p class="info" style="margin:0">Tabulka dnů v týdnu × hodin: kde osoba v danou hodinu nejčastěji bývá (barva a písmeno místa) a kolik dat tam je (sytost). Na mapu se přidá mřížka s časem stráveným v každém čtverci.</p>
    <label class="pole">Osoba<select class="vstup" name="osoba">${osobyMoznosti(J.osoby(pripad)[0])}</select></label>` },
  konzistence: { titul: '🧩 Konzistence zdrojů', telo: () => `<p class="info" style="margin:0">Polohy z výpisu operátora (BTS), fotek a ručních zápisů se porovnají s polohou GPS téže osoby z jiného zařízení ve stejném okamžiku. U buněk s azimutem se ověřuje výseč antény. Rozpor ukazuje na jiné zařízení, chybný čas nebo podvrženou polohu.</p>
    <div class="radek"><label class="pole">Tolerance (m)<input class="vstup" name="tol" type="number" min="0" value="100"></label><label class="pole">GPS nejdál (min) od záznamu<input class="vstup" name="maxMin" type="number" min="1" value="10"></label></div>
    <label class="pole">Osoba<select class="vstup" name="osoba"><option value="">všechny</option>${osobyMoznosti()}</select></label>` },
  posun: { titul: '⏱️ Odhad posunu hodin', telo: () => `<p class="info" style="margin:0">Najde posun hodin zdroje, při kterém jeho polohy nejlépe sedí na trasu z ostatních zařízení téže osoby (medián vzdáleností). Posun o celé hodiny obvykle znamená špatně zvolené pásmo.</p>
    <label class="pole">Zdroj k ověření<select class="vstup" name="zdroj">${zdrojeSPolohou().map(z => `<option value="${z.id}">${esc(z.osoba + ' – ' + (z.zarizeni || z.nazev))}</option>`).join('')}</select></label>
    <label class="pole">Hledat v rozsahu ± (h)<input class="vstup" name="max" type="number" min="0.1" max="26" step="0.5" value="3"></label>` }
};
let druhAnalyzy = '', alibiForm = {};
function otevriAnalyzu(druh, predvyplnit) {
  if (!J.osoby(pripad).length) return Dialog.chyba('Nejdřív importujte data.');
  if (druh === 'soubeh' && J.osoby(pripad).length < 2) return Dialog.chyba('Souběh potřebuje aspoň dvě osoby (zdroje s různým jménem osoby).');
  if (druh === 'mista' && !pripad.mista.length) return Dialog.chyba('Nejdřív přidejte zájmové místo (záložka 📍 Místa nebo ✚ Přidat → Zájmové místo).');
  if (druh === 'posun' && zdrojeSPolohou().length < 2) return Dialog.chyba('Odhad posunu potřebuje aspoň dva zdroje s polohami (zdroj k ověření a referenční trasu).');
  druhAnalyzy = druh;
  $('dlgAnalyzaTitul').textContent = ANALYZY[druh].titul;
  $('dlgAnalyzaTelo').innerHTML = ANALYZY[druh].telo(predvyplnit || {});
  const d = $('dlgAnalyza'); d.returnValue = ''; d.showModal();
}
$('dlgAnalyzaTelo').addEventListener('change', e => {
  if (!e.target.matches('[data-vyber-misto]') || !e.target.value) return;
  const [ll, R] = e.target.value.split('|'), f = $('dlgAnalyza').querySelector('form');
  f.elements.misto.value = ll; f.elements.R.value = R;
});
$('dlgAnalyza').addEventListener('close', () => {
  if ($('dlgAnalyza').returnValue !== 'ok') return;
  const f = $('dlgAnalyza').querySelector('form');
  spust(druhAnalyzy, Object.fromEntries([...f.elements].filter(e => e.name).map(e => [e.name, e.value])));
});
let posledniVstup = null;
function pridejVysledek(v) {
  v.vstup = posledniVstup;
  vysledky = vysledky.filter(x => x.klic !== v.klic);
  vysledky.push(v);
  zalozka = 'vysledky';
}
function vrstvaOsoby(o, druh, polozky) {
  vrstvyOsy[o] = (vrstvyOsy[o] || []).filter(x => x.druh !== druh).concat(polozky);
}
const ll = (p) => p.lat.toFixed(5) + ', ' + p.lon.toFixed(5);
const posunText = s => (s > 0 ? '+' : s < 0 ? '−' : '') + J.formatTrvani(Math.abs(s));
// souvislé úseky hodin nad polovinou maxima, např. „8–16 h, 22–6 h“
function hlavniHodiny(h) {
  const max = Math.max(...h); if (!max) return '–';
  const ano = h.map(v => v >= max * 0.5), out = [];
  for (let i = 0; i < 24; i++) if (ano[i] && !ano[(i + 23) % 24]) { let j = i; while (ano[(j + 1) % 24] && j - i < 23) j++; out.push(i + '–' + ((j + 1) % 24) + ' h'); }
  return out.length ? out.join(', ') : '0–24 h';
}
const ZNAK_MISTA = c => c.stitek === 'domov' ? 'D' : c.stitek === 'práce' ? 'P' : '';
function tabulkaMist(cm) { // místa × hodiny
  const max = Math.max(1, ...cm.flatMap(c => c.hodiny));
  return `<div class="tepl-obal"><table class="tepl" data-i18n="ne"><thead><tr><th class="r"></th>${[...Array(24)].map((_, h) => `<th>${h % 3 ? '' : h}</th>`).join('')}</tr></thead><tbody>${cm.slice(0, 9).map((c, i) =>
    `<tr><th class="r" title="${esc(c.stitek)}">${i + 1}${ZNAK_MISTA(c) ? ' ' + ZNAK_MISTA(c) : ''}</th>${c.hodiny.map((v, h) => `<td title="${h}:00–${h + 1}:00 · ${Math.round(v)} min" style="background:color-mix(in srgb,${J.BARVY[i % J.BARVY.length]} ${Math.round(v / max * 85)}%,transparent)"></td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function tabulkaVzorcu(v, cm) { // dny × hodiny, barva = převládající místo
  return `<div class="tepl-obal"><table class="tepl" data-i18n="ne"><thead><tr><th class="r"></th>${[...Array(24)].map((_, h) => `<th>${h % 3 ? '' : h}</th>`).join('')}</tr></thead><tbody>${v.matice.map((r, d) =>
    `<tr><th class="r">${J.DNY[d]}</th>${r.map((min, h) => {
      const dm = v.dominanta[d][h], c = dm && dm.i >= 0 ? cm[dm.i] : null;
      const barva = c ? J.BARVY[dm.i % J.BARVY.length] : 'var(--text-muted)';
      const znak = c ? (ZNAK_MISTA(c) || String(dm.i + 1)) : (min ? '·' : '');
      return `<td title="${J.DNY[d]} ${h}:00 · ${Math.round(min)} min${c ? ' · ' + (dm.i + 1) + ' ' + c.stitek : min ? ' · jinde / v pohybu' : ''}" style="background:color-mix(in srgb,${barva} ${Math.round(Math.sqrt(min / (v.max || 1)) * 70)}%,transparent);color:var(--text)">${znak}</td>`;
    }).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function spust(druh, f, tichy) {
  const cs = getComputedStyle(document.body), barva = n => cs.getPropertyValue(n).trim();
  posledniVstup = [druh, Object.assign({}, f)];
  const proOsoby = () => f.osoba ? [f.osoba] : J.osoby(pripad);
  if (druh === 'pobyty') {
    const o = { vzd: +f.vzd || 150, min: +f.min || 10 };
    for (const os of proOsoby()) {
      const cist = J.bezSkoku(J.bodyOsoby(pripad, os, true), 250), body = cist.body, pob = J.pobyty(body, o), pres = J.presuny(body, pob);
      const pol = [];
      pob.forEach((s, i) => {
        pol.push({ text: `🏠 ${J.formatCas(s.od, tz())} – ${J.formatCas(s.do, tz(), 'cas')} (${J.formatTrvani((s.do - s.od) / 1000)}) · ${ll(s)} · ${s.n} bodů${s.mezera ? ' · ⚠️ uvnitř mezera ' + J.formatTrvani(s.mezera / 1000) : ''}`, t: s.od, k: s.do, lat: s.lat, lon: s.lon });
        const p = pres[i];
        if (p) pol.push({ text: `   🚶 přesun ${J.formatTrvani((p.do - p.od) / 1000)}, trasa ${J.formatVzd(p.delka)} (vzdušnou čarou ${J.formatVzd(p.primo)})${p.rychlost != null ? ', průměr ' + p.rychlost.toFixed(1).replace('.', ',') + ' km/h' : ''}`, t: p.od, k: p.do, lat: p.kam.lat, lon: p.kam.lon });
      });
      pridejVysledek({ klic: 'pobyty:' + os, druh, nadpis: 'Pobyty a přesuny – ' + os, parametry: `R = ${o.vzd} m, T ≥ ${o.min} min; ${pob.length} pobytů` + (cist.vyrazeno ? `; vyřazeno ${cist.vyrazeno} odlehlých bodů (skok > 250 km/h)` : ''), polozky: pol });
      vrstvaOsoby(os, 'pobyt', pob.map(s => ({ druh: 'pobyt', od: s.od, do: s.do, barva: barva('--accent'), lat: s.lat, lon: s.lon, R: o.vzd, osoba: os })));
    }
  } else if (druh === 'rychlosti') {
    const lim = +f.limit || 250;
    for (const os of J.osoby(pripad)) {
      const nr = J.nemozneRychlosti(J.bodyOsoby(pripad, os, true), lim);
      pridejVysledek({ klic: 'rychlosti:' + os, druh, nadpis: 'Nemožné rychlosti – ' + os, parametry: `limit ${lim} km/h; nálezů ${nr.length}`,
        polozky: nr.map(x => ({ text: `🚀 ${J.formatCas(x.a.t, tz())} → ${J.formatCas(x.b.t, tz(), 'cas')}: ${J.formatVzd(x.vzd)} za ${J.formatTrvani(x.dt)} = ${isFinite(x.kmh) ? Math.round(x.kmh) + ' km/h' : '∞'} (${zdrojById(x.a.zdroj).zarizeni || zdrojById(x.a.zdroj).nazev}${x.a.zdroj !== x.b.zdroj ? ' / ' + (zdrojById(x.b.zdroj).zarizeni || zdrojById(x.b.zdroj).nazev) : ''})`, t: x.a.t, k: x.b.t, lat: x.b.lat, lon: x.b.lon })),
        cary: nr.slice(0, 200).map(x => ({ a: [x.a.lat, x.a.lon], b: [x.b.lat, x.b.lon], text: '🚀 ' + Math.round(x.kmh) + ' km/h' })) });
    }
  } else if (druh === 'mezery') {
    const prah = +f.prah || 60;
    const pol = [];
    for (const z of pripad.zdroje) {
      // fotky, ruční zápisy a čisté výpisy komunikace mají mezery přirozeně
      if (z.format === 'EXIF' || z.format === 'ruční' || !(poZdroji[z.id] || []).some(r => r.typ === 'poloha' || r.typ === 'navsteva')) continue;
      for (const m of J.mezery(poZdroji[z.id], prah)) pol.push({ text: `🕳️ ${z.osoba} · ${z.zarizeni || z.nazev}: ${J.formatCas(m.od, tz())} – ${J.formatCas(m.do, tz())} (${J.formatTrvani(m.trvani)})`, t: m.od, k: m.do });
    }
    pol.sort((a, b) => a.t - b.t);
    pridejVysledek({ klic: 'mezery', druh, nadpis: 'Mezery v datech', parametry: `práh ${prah} min; nálezů ${pol.length}`, polozky: pol });
  } else if (druh === 'soubeh') {
    if (f.a === f.b) return Dialog.chyba('Vyberte dvě různé osoby.');
    const o = { R: +f.R || 200, dt: +f.dt || 5 };
    const sb = J.soubeh(J.bodyOsoby(pripad, f.a, true), J.bodyOsoby(pripad, f.b, true), o);
    pridejVysledek({ klic: 'soubeh:' + f.a + '|' + f.b, druh, nadpis: `Souběh ${f.a} × ${f.b}`, parametry: `R ≤ ${o.R} m, Δt ≤ ${o.dt} min; intervalů ${sb.length}`,
      polozky: sb.map(s => ({ text: `👥 ${J.formatCas(s.od, tz())} – ${J.formatCas(s.do, tz(), 'cas')} (${J.formatTrvani((s.do - s.od) / 1000)}), nejblíže ${J.formatVzd(s.minVzd)} u ${ll(s)}, ${s.n} shod${s.jiste ? '' : ' · jen bez započtení přesnosti'}`, t: s.od, k: s.do, lat: s.lat, lon: s.lon })) });
    for (const os of [f.a, f.b]) vrstvaOsoby(os, 'soubeh', sb.map(s => ({ druh: 'soubeh', od: s.od, do: s.do, barva: barva('--warn'), lat: s.lat, lon: s.lon })));
  } else if (druh === 'alibi') {
    const misto = J.parsujLatLng(f.misto), wall = f.tUtc != null ? 0 : datumNaWall(f.t);
    if (!misto || wall == null) return Dialog.chyba('Zadejte platný čas a místo (např. 50.0705, 14.4040).');
    const t = f.tUtc != null ? +f.tUtc : J.naUtc(wall, tz()), o = { t, R: +f.R || 300, okno: +f.okno || 15, lat: misto.lat, lon: misto.lon };
    const r = J.alibi(J.bodyOsoby(pripad, f.osoba, true), o);
    const pol = [{ text: r.text, t }];
    if (r.interpolace) pol.push({ text: `📐 poloha v čase T (dopočtená): ${ll(r.interpolace)}, ${J.formatVzd(r.vzdInterp)} od místa`, t, lat: r.interpolace.lat, lon: r.interpolace.lon });
    for (const k of r.kandidati.slice(0, 40)) pol.push({ text: `📍 ${J.formatCas(k.bod.t, tz(), 'cas')} (${k.dt >= 0 ? '+' : '−'}${J.formatTrvani(Math.abs(k.dt))}) · ${J.formatVzd(k.vzd)} od místa${k.bod.acc ? ' ±' + Math.round(k.bod.acc) + ' m' : ''} · ${zdrojById(k.bod.zdroj).zarizeni || zdrojById(k.bod.zdroj).nazev}`, t: k.bod.t, lat: k.bod.lat, lon: k.bod.lon });
    const mm = pripad.mista.find(m => J.vzdalenost(m, misto) < 5);
    pridejVysledek({ klic: 'alibi:' + f.osoba + ':' + t + ':' + ll(misto), druh, nadpis: `Alibi – ${f.osoba}, ${J.formatCas(t, tz())}${mm ? ', ' + mm.nazev : ''}`, parametry: `místo ${ll(misto)}, R = ${J.formatVzd(o.R)}, okno ±${o.okno} min`, verdikt: r.verdikt, polozky: pol, misto, R: o.R });
    vrstvaOsoby(f.osoba, 'alibi', (vrstvyOsy[f.osoba] || []).filter(x => x.druh === 'alibi').concat([{ druh: 'alibi', od: t, do: t, barva: barva(r.verdikt === 'uvnitr' ? '--ok' : r.verdikt === 'mimo' ? '--danger' : '--warn') }]));
    if (!tichy) nastavKurzor(t, true);
  } else if (druh === 'mista') {
    if (!pripad.mista.length) return Dialog.chyba('Nejdřív přidejte zájmové místo.');
    const o = { min: +f.min || 0, mezera: +f.mezera || 20 };
    for (const os of proOsoby()) {
      const nv = J.navstevyMist(J.bodyOsoby(pripad, os, true), pripad.mista, o);
      const pol = nv.map(v => ({ text: `📍 ${v.misto.nazev}: ${J.formatCas(v.od, tz())}${v.do > v.od ? ' – ' + J.formatCas(v.do, tz(), 'cas') + ' (' + J.formatTrvani((v.do - v.od) / 1000) + ')' : ' (průjezd, 1 bod)'} · ${v.n} bodů, nejblíže ${J.formatVzd(v.minVzd)}`, t: v.od, k: v.do, lat: v.misto.lat, lon: v.misto.lon }));
      for (const m of pripad.mista) if (!nv.some(v => v.misto === m)) pol.push({ text: `○ ${m.nazev}: žádná návštěva`, lat: m.lat, lon: m.lon });
      pridejVysledek({ klic: 'mista:' + os, druh, nadpis: 'Návštěvy zájmových míst – ' + os, parametry: `míst ${pripad.mista.length}, min. doba ${o.min} min, spojení přes výpadek ≤ ${o.mezera} min; návštěv ${nv.length}`, polozky: pol });
      vrstvaOsoby(os, 'navsteva', nv.map(v => ({ druh: 'navsteva', od: v.od, do: Math.max(v.do, v.od + 60000), barva: barva('--ok') })));
    }
  } else if (druh === 'opakovana') {
    const o = { vzd: +f.vzd || 150, min: +f.min || 15 };
    for (const os of proOsoby()) {
      const cm = J.castaMista(J.bezSkoku(J.bodyOsoby(pripad, os, true), 250).body, tz(), o);
      const ik = { domov: '🏠', 'práce': '💼', 'opakované': '🔁', 'jednorázové': '•' };
      pridejVysledek({ klic: 'opakovana:' + os, druh, nadpis: 'Opakovaná místa – ' + os, parametry: `pobyt R = ${o.vzd} m, T ≥ ${o.min} min, sloučení do 250 m; míst ${cm.length}`,
        html: cm.length ? tabulkaMist(cm) : '',
        polozky: cm.map((c, i) => ({ text: `${i + 1}. ${ik[c.stitek]} ${c.stitek} · ${c.navstev}× ve ${c.dny} dnech, celkem ${J.formatTrvani(c.celkem / 1000)} · obvykle ${hlavniHodiny(c.hodiny)} · ${ll(c)}`, t: c.pobyty[0].od, lat: c.lat, lon: c.lon })),
        kruhy: cm.slice(0, 9).map((c, i) => ({ lat: c.lat, lon: c.lon, R: 250, barva: J.BARVY[i % J.BARVY.length], text: (i + 1) + ' ' + c.stitek + ' · ' + c.navstev + '×' })) });
    }
  } else if (druh === 'vzorce') {
    const os = f.osoba || J.osoby(pripad)[0];
    const body = J.bezSkoku(J.bodyOsoby(pripad, os, true), 250).body;
    const cm = J.castaMista(body, tz(), { vzd: 150, min: 15 });
    const v = J.vzorce(body, tz(), { mista: cm });
    const leg = cm.slice(0, 9).map((c, i) => `${ZNAK_MISTA(c) || i + 1} = ${c.stitek} (${ll(c)})`).join(' · ');
    const hod = v.matice.reduce((a, r) => a.map((x, h) => x + r[h]), new Array(24).fill(0));
    pridejVysledek({ klic: 'vzorce:' + os, druh, nadpis: 'Denní a týdenní vzorce – ' + os, parametry: `dní s daty ${v.dny}; buňka = převládající místo v danou hodinu (sytost = množství dat); mřížka na mapě ${v.bunky.length} čtverců po 250 m`,
      html: tabulkaVzorcu(v, cm) + `<div class="param">${esc(leg || 'žádná opakovaná místa')} · „·“ = jinde nebo v pohybu</div>`,
      polozky: [{ text: `🕐 Nejvíc dat v hodinách: ${hlavniHodiny(hod)}` }].concat(v.bunky.slice(0, 5).map((b, i) => ({ text: `▦ ${i + 1}. čtverec ${(b.lat + b.dlat / 2).toFixed(4)}, ${(b.lon + b.dlon / 2).toFixed(4)}: ${J.formatTrvani(b.w * 60)}`, lat: b.lat + b.dlat / 2, lon: b.lon + b.dlon / 2 }))),
      mrizka: { bunky: v.bunky.slice(0, 600), max: v.maxBunka } });
  } else if (druh === 'konzistence') {
    const o = { tol: f.tol === '' || f.tol == null ? 100 : +f.tol, maxMin: +f.maxMin || 10 };
    for (const os of proOsoby()) {
      const k = J.konzistence(pripad, os, o);
      if (!k.length && f.osoba == null) continue;
      const roz = k.filter(x => x.stav === 'rozpor'), bez = k.filter(x => x.stav === 'bez'), ok = k.filter(x => x.stav === 'ok');
      const popis = r => `${J.TYPY[r.typ].ikona} ${J.TYPY[r.typ].nazev}${r.protistrana ? ' ' + r.protistrana : ''} (${zdrojById(r.zdroj).zarizeni || zdrojById(r.zdroj).nazev})`;
      const pol = roz.map(x => ({ text: `⚠️ ${J.formatCas(x.r.t, tz())} ${popis(x.r)}: GPS ${J.formatVzd(x.vzd)} od ${x.r.azimut != null ? 'antény, mimo výseč' : J.KOMUNIKACE[x.r.typ] ? 'antény' : 'udané polohy'} (mez ${J.formatVzd(x.limit)})`, t: x.r.t, lat: x.gps.lat, lon: x.gps.lon }))
        .concat(bez.map(x => ({ text: `❔ ${J.formatCas(x.r.t, tz())} ${popis(x.r)}: do ±${o.maxMin} min není GPS z jiného zařízení`, t: x.r.t, lat: x.r.lat, lon: x.r.lon })))
        .concat(ok.length ? [{ text: `✅ ${ok.length} záznamů souhlasí s polohou GPS` }] : []);
      pridejVysledek({ klic: 'konzistence:' + os, druh, nadpis: 'Konzistence zdrojů – ' + os, parametry: `tolerance ${o.tol} m, GPS do ±${o.maxMin} min; porovnáno ${k.length}: souhlasí ${ok.length}, rozpor ${roz.length}, bez GPS ${bez.length}`,
        polozky: pol, cary: roz.map(x => ({ a: [x.r.lat, x.r.lon], b: [x.gps.lat, x.gps.lon], text: '⚠️ ' + J.formatCas(x.r.t, tz(), 'cas') + ' · ' + J.formatVzd(x.vzd) })) });
      vrstvaOsoby(os, 'rozpor', roz.map(x => ({ druh: 'rozpor', od: x.r.t, do: x.r.t, barva: barva('--danger') })));
    }
  } else if (druh === 'posun') {
    const z = zdrojById(f.zdroj);
    if (!z.id) return Dialog.chyba('Vyberte zdroj.');
    const vse = J.bodyOsoby(pripad, z.osoba, true);
    const r = J.odhadniPosun(vse.filter(b => b.zdroj !== z.id), J.bodyOsoby(pripad, z.osoba, false).filter(b => b.zdroj === z.id), { max: Math.min(26, +f.max || 3) * 3600 });
    const nazev = z.zarizeni || z.nazev, pol = [];
    let akce = null;
    if (!r) pol.push({ text: 'Nelze odhadnout – zdroj se s trasou ostatních zařízení časově nepřekrývá (ani v zadaném rozsahu).' });
    else {
      const zlepseni = r.median0 == null || r.median < r.median0 * 0.5;
      pol.push({ text: `⏱️ Nejlepší shoda při posunu ${posunText(r.posun)} (${r.posun} s): medián vzdálenosti od trasy ${J.formatVzd(r.median)}${r.median0 != null ? ', bez posunu ' + J.formatVzd(r.median0) : ''}; porovnáno ${r.n} z ${r.celkem} bodů.` });
      if (r.pasmo) pol.push({ text: `🌐 Posun o celé hodiny (${r.pasmo > 0 ? '+' : ''}${r.pasmo} h) – zařízení mělo nejspíš nastavené jiné časové pásmo než ${z.tz}. Opravit lze posunem, nebo změnou pásma zdroje.` });
      if (Math.abs(r.posun) < 5 || !zlepseni) pol.push({ text: '✅ Hodiny zdroje odpovídají ostatním zařízením (posun nepřinese zlepšení).' });
      else akce = { text: `✅ Použít posun ${posunText(r.posun)} u zdroje ${nazev}`, fn: () => { z.posun += r.posun; zmena(); prepocitejVysledky(); Dialog.info(`Posun hodin zdroje „${nazev}“ je nyní ${posunText(z.posun)}. Analýzy byly přepočteny.`); } };
    }
    pridejVysledek({ klic: 'posun:' + z.id, druh, nadpis: 'Odhad posunu hodin – ' + nazev, parametry: `rozsah ±${Math.min(26, +f.max || 3)} h; současný posun zdroje ${z.posun ? posunText(z.posun) : '0'}, pásmo ${z.tz}`, polozky: pol, akce });
  }
  if (!tichy) { kresliAnalyzuNaMape(); prekresli(); }
}
function prepocitejVysledky() {
  const vs = [...new Map(vysledky.filter(v => v.vstup).map(v => [JSON.stringify(v.vstup), v.vstup])).values()];
  vysledky = []; vrstvyOsy = {};
  for (const [d, f] of vs) spust(d, f, true);
  prekresli();
}
function kresliAnalyzuNaMape() {
  if (!mapa) return;
  vrstvaAnalyza.clearLayers();
  for (const [os, v] of Object.entries(vrstvyOsy)) for (const x of v) {
    if (x.druh === 'pobyt') L.circle([x.lat, x.lon], { radius: x.R, color: zdrojById((pripad.zdroje.find(z => z.osoba === os) || {}).id).barva || '#888', weight: 1, fillOpacity: .12 })
      .bindTooltip(`🏠 ${esc(os)}: ${J.formatCas(x.od, tz(), 'cas')} – ${J.formatCas(x.do, tz(), 'cas')}`).addTo(vrstvaAnalyza);
    if (x.druh === 'soubeh') L.circleMarker([x.lat, x.lon], { radius: 10, color: barvaCss('--warn'), weight: 3, fill: false }).bindTooltip('👥 souběh ' + J.formatCas(x.od, tz())).addTo(vrstvaAnalyza);
  }
  for (const v of vysledky) {
    if (v.druh === 'alibi') {
      const c = barvaCss({ uvnitr: '--ok', mimo: '--danger', nejiste: '--warn', nelze: '--text-muted' }[v.verdikt]);
      L.circle([v.misto.lat, v.misto.lon], { radius: v.R, color: c, weight: 2, dashArray: '6 4', fillOpacity: .06 }).bindTooltip('🎯 ' + esc(v.nadpis)).addTo(vrstvaAnalyza);
    }
    for (const k of v.kruhy || []) L.circle([k.lat, k.lon], { radius: k.R, color: k.barva, weight: 2, fillOpacity: .1 }).bindTooltip(esc(k.text)).addTo(vrstvaAnalyza);
    for (const c of v.cary || []) {
      L.polyline([c.a, c.b], { color: barvaCss('--danger'), weight: 2, dashArray: '5 5' }).bindTooltip(esc(c.text)).addTo(vrstvaAnalyza);
      L.circleMarker(c.b, { radius: 5, color: barvaCss('--danger'), weight: 2, fillOpacity: .3 }).bindTooltip(esc(c.text) + ' · GPS').addTo(vrstvaAnalyza);
    }
    if (v.mrizka) for (const b of v.mrizka.bunky) {
      const q = Math.sqrt(b.w / (v.mrizka.max || 1));
      L.rectangle([[b.lat, b.lon], [b.lat + b.dlat, b.lon + b.dlon]], { stroke: false, fillColor: barvaCss('--danger'), fillOpacity: 0.08 + q * 0.5 })
        .bindTooltip('▦ ' + J.formatTrvani(b.w * 60)).addTo(vrstvaAnalyza);
    }
  }
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-vyber]'); if (!b) return;
  const dlg = $(b.dataset.vyber), f = dlg.querySelector('form');
  if (b.dataset.vyber === 'dlgAnalyza') alibiForm = Object.fromEntries([...f.elements].filter(x => x.name).map(x => [x.name, x.value]));
  const rucni = b.dataset.vyber !== 'dlgAnalyza' ? Object.fromEntries([...f.elements].filter(x => x.name).map(x => [x.name, x.value])) : null;
  dlg.returnValue = 'vyber'; dlg.close();
  vyberVMape(latlng => {
    const s = latlng.lat.toFixed(6) + ', ' + latlng.lng.toFixed(6);
    if (b.dataset.vyber === 'dlgMisto') otevriMisto(upravovaneMisto, Object.assign(rucni, { poloha: s }));
    else if (rucni) { otevriRucni(Object.assign(rucni, { poloha: s })); }
    else otevriAnalyzu('alibi', Object.assign(alibiForm, { misto: s }));
  });
});

/* ---------- ruční událost ---------- */
function otevriRucni(pred) {
  const d = $('dlgRucni'), f = d.querySelector('form');
  f.typ.innerHTML = Object.entries(J.TYPY).filter(([k]) => k !== 'presun').map(([k, t]) => `<option value="${k}">${t.ikona} ${t.nazev}</option>`).join('');
  pred = pred || {};
  f.osoba.value = pred.osoba || J.osoby(pripad)[0] || ''; f.typ.value = pred.typ || 'udalost';
  f.od.value = pred.od || wallNaDatum(kurzor || Date.now(), tz()); f.do.value = pred.do || '';
  f.poloha.value = pred.poloha || ''; f.acc.value = pred.acc || ''; f.popis.value = pred.popis || '';
  d.returnValue = ''; d.showModal();
}
$('dlgRucni').addEventListener('close', () => {
  const d = $('dlgRucni'); if (d.returnValue !== 'ok') return;
  const f = d.querySelector('form');
  const od = datumNaWall(f.od.value), dO = datumNaWall(f.do.value);
  if (od == null) return Dialog.chyba('Zadejte čas.');
  const p = f.poloha.value.trim() ? J.parsujLatLng(f.poloha.value) : null;
  if (f.poloha.value.trim() && !p) return Dialog.chyba('Polohu se nepodařilo přečíst (např. 50.0705, 14.4040).');
  const osoba = f.osoba.value.trim() || 'Osoba';
  let z = pripad.zdroje.find(x => x.format === 'ruční' && x.osoba === osoba);
  const zaz = { t0: J.naUtc(od, tz()), naiv: false, k0: dO != null ? J.naUtc(dO, tz()) : null, typ: f.typ.value, lat: p && p.lat, lon: p && p.lon, acc: f.acc.value ? +f.acc.value : null, popis: f.popis.value.trim() };
  if (!z) J.pridejZdroj(pripad, { nazev: 'Ruční záznamy – ' + osoba, osoba, zarizeni: 'ruční zápis', format: 'ruční', tz: 'UTC' }, [zaz]);
  else pripad.zaznamy.push(J.zaznam(Object.assign(zaz, { zdroj: z.id })));
  const prvni = pripad.zaznamy.length === 1;
  zmena({ cely: prvni });
  nastavKurzor(zaz.t0, true);
  Dialog.info('Událost přidána.');
});

/* ---------- protokol a exporty ---------- */
function protokolText() {
  return J.protokol(pripad, tz(), vysledky.map(v => ({ nadpis: v.nadpis + (v.verdikt ? ' – ' + J.VERDIKTY[v.verdikt].replace(/^\S+\s/, '') : ''), parametry: v.parametry, radky: v.polozky.map(p => p.text.trim()) })));
}
async function hashProtokolu() { $('protokolHash').textContent = (await sha256(new TextEncoder().encode($('protokolText').value))) || 'nedostupné (vyžaduje HTTPS)'; }
$('protokolText').addEventListener('input', () => { clearTimeout(hashProtokolu.t); hashProtokolu.t = setTimeout(hashProtokolu, 300); });
$('protokolUloz').onclick = async () => {
  const text = $('protokolText').value, h = await sha256(new TextEncoder().encode(text));
  stahni('protokol_' + souborove(pripad.nazev) + '.txt', text + (h ? '\n\n' + '-'.repeat(40) + '\nSHA-256 (UTF-8) textu nad touto čarou: ' + h + '\n' : ''));
};
$('protokolTisk').onclick = () => { $('tisk').textContent = $('protokolText').value; print(); };
function geoPridavne() {
  const f = [];
  for (const [os, v] of Object.entries(vrstvyOsy)) for (const x of v) if (x.lat != null)
    f.push({ type: 'Feature', properties: { druh: x.druh, osoba: os, od: new Date(x.od).toISOString(), do: new Date(x.do).toISOString(), mistni_od: J.isoCas(x.od, tz()) }, geometry: { type: 'Point', coordinates: [+x.lon.toFixed(6), +x.lat.toFixed(6)] } });
  return f;
}

/* ---------- příkazy ---------- */
const PRIKAZY = {
  import: () => $('souborImport').click(),
  rucni: () => otevriRucni(),
  poznamka: async () => {
    const t = await Dialog.zeptej('Poznámka k času ' + J.formatCas(kurzor, tz()), '');
    if (t == null || !t.trim()) return;
    pripad.poznamky.push({ id: J.novyId('n'), t: kurzor, text: t.trim().slice(0, 2000), osoba: '' });
    zalozka = 'poznamky'; zmena();
  },
  pripady: async () => { await seznamPripadu(); $('dlgPripady').showModal(); },
  novy: async () => {
    const n = await Dialog.zeptej('Název nového případu', 'Případ ' + J.formatCas(Date.now(), tz(), 'datum'));
    if (n == null) return;
    const p = J.prazdny(n.trim() || 'Nový případ'); await otevri(p); uloz();
  },
  prejmenuj: async () => {
    const n = await Dialog.zeptej('Název případu', pripad.nazev); if (n == null) return;
    const s = await Dialog.zeptej('Číslo jednací / spisová značka (nepovinné)', pripad.spis || '');
    const z = s == null ? null : await Dialog.zeptej('Zpracovatel (jméno, útvar – do protokolu, nepovinné)', pripad.zpracovatel || '');
    pripad.nazev = n.trim() || pripad.nazev; if (s != null) pripad.spis = s.trim().slice(0, 80); if (z != null) pripad.zpracovatel = z.trim().slice(0, 120);
    zmena();
  },
  ukazka: () => otevriUkazku('setkani'),
  zaloha: () => stahni('casova_analyza_' + souborove(pripad.nazev) + '.json', JSON.stringify(bezT(pripad)), 'application/json'),
  obnov: () => $('souborZaloha').click(),
  smazPripad: async () => {
    if (!await Dialog.potvrd(`Smazat případ „${pripad.nazev}“ se všemi ${pripad.zaznamy.length} záznamy z tohoto prohlížeče? Nelze vrátit.`)) return;
    await dbSmaz(pripad.id).catch(() => {}); clearTimeout(ulozTimer);
    const v = await dbVsechny().catch(() => []);
    await otevri(v[0] || J.prazdny());
  },
  vsechnyAnalyzy: () => {
    if (!J.osoby(pripad).length) return Dialog.chyba('Nejdřív importujte data.');
    spust('pobyty', { vzd: 150, min: 10, osoba: '' }, true); spust('rychlosti', { limit: 250 }, true); spust('mezery', { prah: 60 }, true);
    prekresli();
  },
  smazVysledky: () => { vysledky = []; vrstvyOsy = {}; kresliAnalyzuNaMape(); prekresli(); },
  protokol: () => { $('protokolText').value = protokolText(); $('protokolHash').textContent = '…'; $('dlgProtokol').showModal(); hashProtokolu(); },
  kml: () => stahni(souborove(pripad.nazev) + '.kml', J.exportKml(pripad, tz()), 'application/vnd.google-earth.kml+xml'),
  galerie: () => { kresliGalerii(); $('dlgGalerie').showModal(); },
  noveMisto: () => otevriMisto(null),
  overHash: () => $('souborOvereni').click(),
  pruvodce: () => pruvodce(0),
  zkratky: () => $('dlgZkratky').showModal(),
  csv: () => stahni('zaznamy_' + souborove(pripad.nazev) + '.csv', J.exportCsv(pripad, tz()), 'text/csv;charset=utf-8'),
  csvVyrez: () => stahni('zaznamy_vyrez_' + souborove(pripad.nazev) + '.csv', J.exportCsv(pripad, tz(), r => (r.k != null ? r.k : r.t) >= pohled.od && r.t <= pohled.do), 'text/csv;charset=utf-8'),
  geojson: () => stahni(souborove(pripad.nazev) + '.geojson', J.exportGeoJson(pripad, tz(), geoPridavne()), 'application/geo+json'),
  napoveda: () => $('dlgNapoveda').showModal()
};
$('souborZaloha').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    if (!Array.isArray(d.zdroje)) throw new Error('není to záloha Časové analýzy');
    const p = J.migruj(d);
    const exist = await dbCti(p.id).catch(() => null);
    if (exist && !await Dialog.potvrd(`Případ „${exist.nazev}“ už v prohlížeči je. Přepsat ho zálohou?`)) p.id = J.novyId('p');
    await otevri(p); uloz();
    Dialog.info(`Načteno: ${p.zdroje.length} zdrojů, ${p.zaznamy.length} záznamů.`);
  } catch (err) { Dialog.chyba('Zálohu nelze načíst: ' + err.message); }
});

/* ---------- nabídky a klávesy ---------- */
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
  const p = e.target.closest('[data-prikaz]');
  if (p) { e.stopPropagation(); zavriNabidky(); return PRIKAZY[p.dataset.prikaz](); }
  const a = e.target.closest('[data-analyza]');
  if (a) { zavriNabidky(); return otevriAnalyzu(a.dataset.analyza); }
  if (!e.target.closest('.nabidka')) zavriNabidky();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { zavriNabidky(); if (!$('pruvodce').hidden && !document.querySelector('dialog[open]')) pruvodce(-1); if (vybirani) { vybirani = null; $('mapa').classList.remove('vyber-mapy'); $('hlaskaMapa').hidden = true; } }
  if (e.target.closest('input,textarea,select,dialog') || e.ctrlKey || e.metaKey || e.altKey) return;
  if (document.querySelector('dialog[open]')) return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (k === ' ') { e.preventDefault(); prepniHrani(); }
  else if (k === 'ArrowRight') { e.preventDefault(); krok(1); }
  else if (k === 'ArrowLeft') { e.preventDefault(); krok(-1); }
  else if (k === '+') zoom(0.5);
  else if (k === '-') zoom(2);
  else if (k === '0') $('celaOsa').click();
  else if (k === '/') { e.preventDefault(); $('hledej').focus(); $('hledej').select(); }
  else if (k === 'm') oznacUKurzoru();
  else if (k === 'n') PRIKAZY.poznamka();
  else if (k === 'g') PRIKAZY.galerie();
  else if (k === 'p') PRIKAZY.protokol();
  else if (k === '?') PRIKAZY.zkratky();
});
$('jenVyrez').addEventListener('change', () => obnovMapu(true));
$('vysece').addEventListener('change', () => obnovMapu());

/* pásmo zobrazení */
const zakladniTz = ['Europe/Prague', 'UTC', 'Europe/Bratislava', 'Europe/London', 'Europe/Berlin', 'Europe/Kyiv', 'America/New_York'];
let vsechnaTz = [];
try { vsechnaTz = Intl.supportedValuesOf('timeZone'); } catch (e) { /* starší prohlížeč */ }
const prohlizecTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
$('seznamTz').innerHTML = [...new Set([...zakladniTz, prohlizecTz, '+01:00', '+02:00', ...vsechnaTz])].filter(Boolean).map(t => `<option value="${esc(t)}">`).join('');
$('zobrazTz').value = nast.tz;
$('zobrazTz').addEventListener('change', e => {
  const v = e.target.value.trim();
  if (!J.platnePasmo(v)) { Dialog.chyba('Neznámé časové pásmo „' + v + '“.'); e.target.value = nast.tz; return; }
  nast.tz = v; nastUloz(); prekresli();
});
// téma – znovu vykreslit plátno
new MutationObserver(() => kresliOsu()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });

/* ---------- galerie ukázek ---------- */
function kresliGalerii() {
  $('galerie').innerHTML = J.UKAZKY.map(u => `<div class="uk"><h3>${u.ikona} ${esc(u.nazev)}</h3><div class="co">${esc(u.popis)}</div>
    <div><b>Vyzkoušejte:</b><ul>${u.vyzkousej.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
    <div class="najde"><b>Analýza najde:</b> ${esc(u.najde)}</div>
    <button type="button" class="btn primary" data-ukazka="${u.klic}">▶ Otevřít ukázku</button></div>`).join('');
}
$('uvodUkazky').innerHTML = J.UKAZKY.map(u => `<button type="button" class="btn" data-ukazka="${u.klic}" title="${esc(u.popis)}">${u.ikona} ${esc(u.nazev)}</button>`).join('');
async function otevriUkazku(klic) {
  if ($('dlgGalerie').open) $('dlgGalerie').close();
  if (pripad.zaznamy.length && !pripad.ukazkaInfo && !await Dialog.potvrd('Otevřít ukázku jako nový případ? Současný případ zůstane uložený (menu Případ → Případy).')) return;
  const p = J.ukazkaPodle(klic); if (!p) return;
  await otevri(p); uloz();
}
document.addEventListener('click', e => { const u = e.target.closest('[data-ukazka]'); if (u) otevriUkazku(u.dataset.ukazka); });

/* ---------- zájmová místa ---------- */
let upravovaneMisto = null;
function otevriMisto(m, pred) {
  upravovaneMisto = m;
  const d = $('dlgMisto'), f = d.querySelector('form');
  $('dlgMistoTitul').textContent = m ? '✏️ Zájmové místo' : '📍 Nové zájmové místo';
  pred = pred || (m ? { nazev: m.nazev, poloha: m.lat.toFixed(6) + ', ' + m.lon.toFixed(6), R: m.R, popis: m.popis } : {});
  f.nazev.value = pred.nazev || ''; f.poloha.value = pred.poloha || ''; f.R.value = pred.R || 100; f.popis.value = pred.popis || '';
  d.returnValue = ''; d.showModal();
  if (!pred.poloha && !m) { f.nazev.focus(); }
}
$('dlgMisto').addEventListener('close', () => {
  const d = $('dlgMisto'); if (d.returnValue !== 'ok') return;
  const f = d.querySelector('form'), p = J.parsujLatLng(f.poloha.value);
  if (!p) return Dialog.chyba('Polohu se nepodařilo přečíst (např. 50.0705, 14.4040).');
  const n = J.normMisto({ id: upravovaneMisto && upravovaneMisto.id, nazev: f.nazev.value.trim() || 'Místo', lat: p.lat, lon: p.lon, R: +f.R.value, popis: f.popis.value.trim() });
  if (upravovaneMisto) Object.assign(upravovaneMisto, n); else pripad.mista.push(n);
  zalozka = 'mista'; zmena();
});

/* ---------- ověření otisku souboru ---------- */
$('souborOvereni').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  const h = await sha256(await f.arrayBuffer());
  if (!h) return Dialog.chyba('Výpočet SHA-256 není v tomto prostředí dostupný (vyžaduje HTTPS nebo localhost).');
  const z = pripad.zdroje.find(x => x.hash === h) || pripad.zdroje.find(x => x.varovani.some(v => v.includes(h.slice(0, 16))));
  if (z) Dialog.info(`✅ Soubor „${f.name}“ odpovídá zdroji „${z.nazev}“ (SHA-256 ${h}). Od importu nebyl změněn.`);
  else Dialog.info(`⚠️ Soubor „${f.name}“ (SHA-256 ${h}) neodpovídá žádnému zdroji tohoto případu – buď nebyl importován, nebo byl od importu změněn.`);
});

/* ---------- hledání na ose a označování ---------- */
$('hledej').addEventListener('input', e => { nastavHledani(e.target.value); if (zalozka === 'zaznamy') { clearTimeout(kresliPanel.t); kresliPanel.t = setTimeout(kresliPanel, 300); } });
function skocNaShodu(smer) {
  if (!shody.length) return;
  const r = smer > 0 ? (shody.find(x => x.t > kurzor + 500) || shody[0]) : ([...shody].reverse().find(x => x.t < kurzor - 500) || shody[shody.length - 1]);
  nastavKurzor(r.t, true);
  if (r.lat != null && mapa) { mapa.setView([r.lat, r.lon], Math.max(mapa.getZoom(), 14)); L.popup().setLatLng([r.lat, r.lon]).setContent(popisZaznamu(r) + tlacitkaPopupu(r)).openOn(mapa); }
  $('hledejPocet').textContent = (shody.indexOf(r) + 1) + ' / ' + shody.length;
}
$('hledej').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); skocNaShodu(e.shiftKey ? -1 : 1); } else if (e.key === 'Escape') { nastavHledani(''); e.target.blur(); } });
$('shodaVpred').onclick = () => skocNaShodu(1);
$('shodaZpet').onclick = () => skocNaShodu(-1);
function oznacUKurzoru() {
  const v = pripad.zaznamy.filter(r => !zdrojById(r.zdroj).skryty && r.t >= pohled.od && r.t <= pohled.do);
  const blizko = a => a.reduce((n, r) => !n || Math.abs(r.t - kurzor) < Math.abs(n.t - kurzor) ? r : n, null);
  let r = blizko(v.filter(x => x.typ !== 'poloha'));   // přednost mají události; polohový bod jen když je událost daleko
  if (!r || Math.abs(r.t - kurzor) > (pohled.do - pohled.od) * 0.02) r = blizko(v) || r;
  if (!r) return Dialog.chyba('Ve výřezu osy není žádný záznam.');
  oznac(r); nastavKurzor(r.t);
  const z = zdrojById(r.zdroj);
  hlaska(`${r.dulezite ? '⭐ Označeno' : 'Označení zrušeno'}: ${J.TYPY[r.typ].nazev}, ${J.formatCas(r.t, tz())}, ${z.osoba}`);
}
$('oznacKurzor').onclick = oznacUKurzoru;
let hlaskaT = null;
function hlaska(text) {
  const h = $('hlaskaMapa'); h.textContent = text; h.hidden = false;
  clearTimeout(hlaskaT); hlaskaT = setTimeout(() => { if (!vybirani) h.hidden = true; }, 2500);
}

/* ---------- průvodce ---------- */
const KROKY_PRUVODCE = [
  { titul: '1. Data', cil: '[data-prikaz="import"].hlavni-tl', text: 'Načtěte soubory tlačítkem 📥 Import nebo je přetáhněte do okna: GPX, KML, GeoJSON, Google Takeout, CSV výpisy operátora, fotky JPEG. U každého zdroje zadáte osobu a zařízení. Soubory se nikam neodesílají.', akce: ['🧪 Raději ukázka', () => PRIKAZY.galerie()] },
  { titul: '2. Čas a pásma', cil: '[data-zal="zdroje"]', text: 'V záložce 📚 Zdroje zkontrolujte pásmo a posun hodin každého zdroje. Časy bez pásma (výpisy, EXIF) se převádějí podle pásma zdroje. Analýza ⏱️ Odhad posunu hodin posun najde sama.', akce: ['📚 Otevřít Zdroje', () => { zalozka = 'zdroje'; kresliPanel(); }] },
  { titul: '3. Osa a mapa', cil: '#osaObal', text: 'Kolečko myši na ose přibližuje, tažení posouvá, klik nastaví kurzor. ▶ přehraje pohyb na mapě. Hledání nad osou zvýrazní shody (zkuste číslo nebo typ:hovor), Enter mezi nimi skáče.' },
  { titul: '4. Analýzy', cil: '[data-nabidka="nabAnalyza"]', text: 'V menu 🔬 Analýza: pobyty, nemožné rychlosti, mezery, souběh dvou osob, alibi, návštěvy zájmových míst, opakovaná místa, denní vzorce, konzistence GPS × BTS × fotky a odhad posunu hodin. Výsledky se ukážou vpravo, na ose i v mapě.' },
  { titul: '5. Místa a označení', cil: '[data-zal="mista"]', text: 'V záložce 📍 Místa si zadejte zájmová místa (bydliště, místo činu…) – kliknutím do mapy. Důležité záznamy označte ⭐ (tabulka, bublina na mapě, klávesa M). Označené záznamy a poznámky tvoří chronologii.', akce: ['📍 Otevřít Místa', () => { zalozka = 'mista'; kresliPanel(); }] },
  { titul: '6. Protokol', cil: '[data-nabidka="nabExport"]', text: 'V menu 📤 Export je protokol s otisky SHA-256 zdrojů, chronologií, výsledky, metodikou a omezeními (TXT s otiskem, tisk) a exporty CSV, GeoJSON a KML.' }
];
let krokPruvodce = 0;
function pruvodce(i) {
  document.querySelectorAll('.zvyrazni').forEach(x => x.classList.remove('zvyrazni'));
  if (i < 0 || i >= KROKY_PRUVODCE.length) { $('pruvodce').hidden = true; return; }
  krokPruvodce = i;
  const k = KROKY_PRUVODCE[i];
  $('prTitul').textContent = '🧭 ' + k.titul; $('prKrok').textContent = (i + 1) + ' / ' + KROKY_PRUVODCE.length;
  $('prText').textContent = k.text;
  $('prZpet').disabled = i === 0;
  $('prDal').textContent = i === KROKY_PRUVODCE.length - 1 ? 'Hotovo ✓' : 'Další ▶';
  $('prAkce').hidden = !k.akce; if (k.akce) $('prAkce').textContent = k.akce[0];
  $('pruvodce').hidden = false;
  const c = document.querySelector(k.cil);
  if (c) { void c.offsetWidth; c.classList.add('zvyrazni'); c.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
}
$('prDal').onclick = () => pruvodce(krokPruvodce + 1);
$('prZpet').onclick = () => pruvodce(krokPruvodce - 1);
$('prZavri').onclick = () => pruvodce(-1);
$('prAkce').onclick = () => { const k = KROKY_PRUVODCE[krokPruvodce]; if (k.akce) k.akce[1](); };

vytvorMapu();
start();
window.CASOVA_ANALYZA_APP = { otevri, importuj, pripad: () => pripad, vysledky: () => vysledky, spust, PRIKAZY, nastavKurzor, otevriUkazku, mapa: () => mapa, shody: () => shody };
})();

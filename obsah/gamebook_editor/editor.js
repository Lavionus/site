/* Editor gamebooků – rozhraní (graf, formuláře, kontrola, hraní na zkoušku, projekty v IndexedDB).
   Logika bez DOM je v gamebook_editor/jadro.js (GamebookEditorJadro), hraje engine gamebook/jadro.js (GamebookJadro). */
(function () {
'use strict';
const E = window.GamebookEditorJadro, J = window.GamebookJadro;
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const KLIC = 'webapp_gamebook_editor';
const W = 168, H = 58;
const VESTAVENE = {
  pribeh: { soubor: 'gamebook/pribeh.js', nazev: 'Hlubina pod Černou horou' },
  pribeh_praha: { soubor: 'gamebook/pribeh_praha.js', nazev: 'Stín nad Zlatou uličkou' },
  pribeh_jan: { soubor: 'gamebook/pribeh_jan.js', nazev: 'Svatojánská noc' }
};
const NAZVY_VL = { obratnost: 'Obratnost', zdravi: 'Zdraví', stesti: 'Štěstí', olej: 'Olej', zlato: 'Zlato' };
const IKONA_TYPU = { start: '▶', boj: '⚔', zkouska: '🎲', vyhra: '🏆', prohra: '💀', neutral: '🚪', scena: '', chybi: '?' };
const NAZEV_TYPU = { start: 'start', boj: 'souboj', zkouska: 'zkouška', vyhra: 'dobrý konec', prohra: 'zlý konec', neutral: 'neutrální konec', scena: 'scéna' };
const DRUH_SIPKY = { cil: 'sZ', uspech: 'sOk', vyhra: 'sOk', neuspech: 'sNe', prohra: 'sNe', utek: 'sVar' };
if (window.self === window.top) document.body.classList.add('samostatne');

/* ---------- nastavení ---------- */
let nast = { posledni: null, smer: 'dolu', minimapa: true, legenda: true, sousede: true, zalozka: 'scena', sledovat: true };
try { Object.assign(nast, JSON.parse(localStorage.getItem(KLIC)) || {}); } catch (e) { /* poškozené nastavení */ }
const ulozNast = () => { try { localStorage.setItem(KLIC, JSON.stringify(nast)); } catch (e) { /* plné úložiště */ } };

/* ---------- IndexedDB ---------- */
let dbSlib = null;
function db() {
  return dbSlib || (dbSlib = new Promise((ok, ko) => {
    const r = indexedDB.open(KLIC, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('projekty', { keyPath: 'id' });
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  }));
}
async function dbTx(rezim, fn) {
  const d = await db();
  return new Promise((ok, ko) => {
    const t = d.transaction('projekty', rezim);
    const r = fn(t.objectStore('projekty'));
    t.oncomplete = () => ok(r && r.result);
    t.onerror = () => ko(t.error);
  });
}
const dbVsechny = () => dbTx('readonly', s => s.getAll());
const dbNacti = id => dbTx('readonly', s => s.get(id));
const dbUloz = pr => dbTx('readwrite', s => s.put(pr));
const dbSmaz = id => dbTx('readwrite', s => s.delete(id));

/* ---------- stav ---------- */
let proj = null, P = null;        // projekt a jeho příběh
let vybrana = null;
let pohled = { x: 0, y: 0, k: 1 };
const hist = new E.Historie(150);
let analyza = { vlastni: [], engine: [] }, problemy = {};
let hledany = '', nalezy = [], nalezIdx = -1;
let filtrNalezu = 'vse';
let simulace = null;
const hra = { nast: { od: '', seed: 1, predmety: null, priznaky: [] }, st: null, p: null, posledni: null };

const snimek = () => JSON.stringify({ pribeh: P, pozice: proj.pozice });
let tZapis = 0, tUloz = 0, rafKresli = 0, zmenaDat = false;
function zapisHistorie() { clearTimeout(tZapis); tZapis = 0; if (proj) hist.zapis(snimek()); tlacitkaHistorie(); }
function zmena(o) {
  o = o || {};
  clearTimeout(tZapis);
  if (o.hned) zapisHistorie(); else tZapis = setTimeout(zapisHistorie, 600);
  simulace = null;
  kresliPozdeji(true);
  ulozPozdeji();
  if (o.panel) vykresliPanel();
}
function ulozPozdeji() {
  clearTimeout(tUloz);
  $('nazevProjektu').textContent = proj.nazev + ' · ukládám…';
  tUloz = setTimeout(ulozHned, 700);
}
async function ulozHned() {
  clearTimeout(tUloz);
  if (!proj) return;
  proj.upraveno = Date.now();
  try { await dbUloz(proj); $('nazevProjektu').textContent = proj.nazev + ' · uloženo'; }
  catch (e) { $('nazevProjektu').textContent = proj.nazev + ' · neuloženo!'; Dialog.chyba('Projekt se nepodařilo uložit: ' + e.message); }
}
function tlacitkaHistorie() { $('btnZpet').disabled = !hist.lzeZpet(); $('btnZnovu').disabled = !hist.lzeZnovu(); }
function obnov(s) {
  if (!s) return;
  const d = JSON.parse(s);
  proj.pribeh = P = d.pribeh; proj.pozice = d.pozice;
  if (vybrana && !P.sceny[vybrana]) vybrana = null;
  simulace = null;
  kresliPozdeji(true); vykresliPanel(); ulozPozdeji(); tlacitkaHistorie();
}
function zpet() { if (tZapis) zapisHistorie(); obnov(hist.zpet()); }
function znovu() { if (tZapis) zapisHistorie(); obnov(hist.znovu()); }

/* =========================================================
   Projekty
   ========================================================= */
function novyProjektObj(pribeh, o) {
  o = o || {};
  return { id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), nazev: o.nazev || pribeh.nazev || 'Nový příběh',
    pribeh, pozice: E.rozloz(pribeh, { smer: nast.smer }), hlavicka: o.hlavicka || '', globalni: o.globalni || 'GAMEBOOK_PRIBEH',
    vytvoreno: Date.now(), upraveno: Date.now() };
}
async function otevri(pr) {
  if (proj) { if (tZapis) zapisHistorie(); await ulozHned(); }
  proj = pr; P = pr.pribeh;
  if (!proj.pozice) proj.pozice = {};
  nast.posledni = pr.id; ulozNast();
  vybrana = P.sceny[P.start] ? P.start : Object.keys(P.sceny)[0] || null;
  hra.st = null; hra.nast = { od: '', seed: 1, predmety: null, priznaky: [] }; simulace = null;
  hist.vymaz(snimek()); tlacitkaHistorie();
  $('nazevProjektu').textContent = proj.nazev;
  document.title = '🧭 ' + proj.nazev + ' – Editor gamebooků';
  kresliHned(true);
  prizpusob();
  if (pohled.k < 0.45 && proj.pozice[P.start]) {   // velký graf: čitelné měřítko u startu místo drobného celku
    const r = svg.getBoundingClientRect(), q = proj.pozice[P.start];
    pohled.k = 0.75; pohled.x = r.width / 2 - q.x * pohled.k; pohled.y = 40 - (q.y - H / 2) * pohled.k;
    nastavPohled();
  }
  vykresliPanel();
}
async function vytvorAOtevri(pribeh, o) {
  const pr = novyProjektObj(pribeh, o);
  await dbUloz(pr);
  await otevri(pr);
  return pr;
}
async function importVestaveny(klic) {
  const v = VESTAVENE[klic];
  try {
    const r = await fetch(v.soubor);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = E.nactiSoubor(await r.text());
    await vytvorAOtevri(d.pribeh, { nazev: d.pribeh.nazev || v.nazev, hlavicka: d.hlavicka, globalni: d.globalni });
    Dialog.info('Načteno: ' + proj.nazev + ' (' + Object.keys(P.sceny).length + ' scén)');
  } catch (e) { Dialog.chyba('Příběh se nepodařilo načíst: ' + e.message); }
}
async function importText(text, jmeno) {
  try {
    const d = E.nactiSoubor(text);
    await vytvorAOtevri(d.pribeh, { nazev: d.pribeh.nazev || jmeno, hlavicka: d.hlavicka, globalni: d.globalni });
    Dialog.info('Načteno ze souboru: ' + Object.keys(P.sceny).length + ' scén');
  } catch (e) { Dialog.chyba('Soubor nejde načíst: ' + e.message); }
}
async function seznamProjektu() {
  const vse = (await dbVsechny()).sort((a, b) => b.upraveno - a.upraveno);
  $('seznamProjektu').innerHTML = vse.map(pr => `<li class="${pr.id === proj.id ? 'aktualni' : ''}">
    <span class="nazev" data-otevrit="${esc(pr.id)}">${esc(pr.nazev)}<small>${Object.keys(pr.pribeh.sceny || {}).length} scén · ${new Date(pr.upraveno).toLocaleString('cs-CZ')}</small></span>
    <button type="button" class="btn mini" data-otevrit="${esc(pr.id)}">Otevřít</button>
    <button type="button" class="btn mini nebezpecne" data-smazat="${esc(pr.id)}" aria-label="Smazat projekt">🗑</button></li>`).join('') || '<li>Žádné projekty.</li>';
}
$('seznamProjektu').addEventListener('click', async e => {
  const o = e.target.closest('[data-otevrit]'), s = e.target.closest('[data-smazat]');
  if (o) { const pr = await dbNacti(o.dataset.otevrit); $('dlgProjekty').close(); if (pr) otevri(pr); }
  else if (s) {
    const pr = await dbNacti(s.dataset.smazat);
    if (!pr || !(await Dialog.potvrd('Smazat projekt „' + pr.nazev + '“? Nejde to vrátit.', { ok: 'Smazat', zrus: 'Ponechat' }))) return;
    await dbSmaz(pr.id);
    if (pr.id === proj.id) { proj = null; const zbyle = (await dbVsechny()).sort((a, b) => b.upraveno - a.upraveno); if (zbyle.length) await otevri(zbyle[0]); else await vytvorAOtevri(E.prazdnyPribeh()); }
    seznamProjektu();
  }
});

function stahni(obsah, jmeno, typ) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([obsah], { type: typ }));
  a.download = jmeno;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const jmenoSouboru = () => 'pribeh_' + String(P.id || 'novy').replace(/[^\w-]+/g, '_');
const exportJs = () => E.doJs(P, { hlavicka: proj.hlavicka, globalni: proj.globalni });

/* =========================================================
   Graf
   ========================================================= */
const svg = $('graf'), svet = $('svet');
function kresliPozdeji(data) { if (data) zmenaDat = true; if (!rafKresli) rafKresli = requestAnimationFrame(() => { rafKresli = 0; kresliHned(zmenaDat); }); }
function kresliHned(data) {
  zmenaDat = false;
  if (!proj) return;
  const ids = Object.keys(P.sceny);
  const chybi = ids.filter(id => !proj.pozice[id]);
  if (chybi.length) {
    const r = E.rozloz(P, { smer: nast.smer });
    if (chybi.length > ids.length / 2) proj.pozice = r;
    else chybi.forEach(id => { proj.pozice[id] = volneMisto(vybrana && proj.pozice[vybrana] ? proj.pozice[vybrana] : r[id]); });
  }
  for (const id of Object.keys(proj.pozice)) if (!P.sceny[id]) delete proj.pozice[id];
  if (data) obnovAnalyzu();
  kresliUzly(); kresliHrany(); kresliMinimapu(); nastavPohled();
}
function volneMisto(od) {
  let x = od.x, y = od.y + H + 40;
  const obsazeno = (a, b) => Object.values(proj.pozice).some(q => Math.abs(q.x - a) < W + 10 && Math.abs(q.y - b) < H + 10);
  for (let i = 0; i < 60 && obsazeno(x, y); i++) x += (i % 2 ? -1 : 1) * (i + 1) * (W + 20) / 2;
  return { x: Math.round(x), y: Math.round(y) };
}
function obnovAnalyzu() {
  analyza = E.analyzuj(P, J);
  problemy = {};
  for (const n of analyza.vlastni) if (n.scena && n.uroven !== 'info') problemy[n.scena] = problemy[n.scena] === 'chyba' || n.uroven === 'chyba' ? 'chyba' : 'varovani';
  for (const n of analyza.engine) if (n.scena) problemy[n.scena] = 'chyba';
  const chyb = analyza.vlastni.filter(n => n.uroven === 'chyba').length + analyza.engine.length;
  const var_ = analyza.vlastni.filter(n => n.uroven === 'varovani').length;
  $('znackaKontrola').innerHTML = chyb ? `<span class="znacka" title="Chyby">${chyb}</span>` : var_ ? `<span class="znacka var" title="Varování">${var_}</span>` : '<span class="znacka ok">✓</span>';
  // našeptávače
  $('dlSceny').innerHTML = Object.keys(P.sceny).map(id => `<option value="${esc(id)}">${esc(String(P.sceny[id].text || '').slice(0, 50))}</option>`).join('');
  $('dlPredmety').innerHTML = Object.keys(P.predmety || {}).map(k => `<option value="${esc(k)}">${esc(P.predmety[k].nazev || '')}</option>`).join('');
  $('dlPriznaky').innerHTML = E.priznaky(P).map(k => `<option value="${esc(k)}"></option>`).join('');
  $('dlObr').innerHTML = [...new Set(Object.values(P.sceny).map(s => s.obr).filter(Boolean))].sort().map(k => `<option value="${esc(k)}"></option>`).join('');
  hledej(hledany, true);
  if (nast.zalozka === 'kontrola') vykresliPanel();
}
function radkyTextu(t) {
  const s = String(t || '').replace(/\s+/g, ' ').trim();
  if (s.length <= 26) return [s, ''];
  let i = s.lastIndexOf(' ', 26); if (i < 12) i = 26;
  const a = s.slice(0, i), b = s.slice(i).trim();
  return [a, b.length > 26 ? b.slice(0, 25) + '…' : b];
}
function kresliUzly() {
  const sousede = new Set();
  if (vybrana && nast.sousede) for (const h of E.hrany(P)) { if (h.z === vybrana) sousede.add(h.do); if (h.do === vybrana) sousede.add(h.z); }
  const sNalezy = new Set(nalezy);
  const vpravo = nast.smer === 'vpravo';
  let h = '';
  for (const id of Object.keys(P.sceny)) {
    const s = P.sceny[id], q = proj.pozice[id], typ = E.typUzlu(P, id);
    const [r1, r2] = radkyTextu(s.text);
    const tlum = hledany && !sNalezy.has(id);
    const nadpis = (IKONA_TYPU[typ] ? IKONA_TYPU[typ] + ' ' : '') + id + (s.konec != null ? ' · ' + (((P.konce || {})[s.konec] || {}).nazev || s.konec) : '');
    const ux = vpravo ? W / 2 : 0, uy = vpravo ? 0 : H / 2;
    h += `<g class="uzel t-${typ}${id === vybrana ? ' vybrany' : ''}${sousede.has(id) ? ' soused' : ''}${sNalezy.has(id) && hledany ? ' nalez' : ''}${tlum ? ' tlumeny' : ''}" data-id="${esc(id)}" transform="translate(${q.x},${q.y})">
      <title>${esc(id)}: ${esc(String(s.text || '').slice(0, 200))}</title>
      <rect class="tvar" x="${-W / 2}" y="${-H / 2}" width="${W}" height="${H}" rx="8"/>
      <rect class="pruh" x="${-W / 2 + 1}" y="${-H / 2 + 6}" width="4" height="${H - 12}" rx="2"/>
      <text class="uid" x="${-W / 2 + 10}" y="${-H / 2 + 17}">${esc(nadpis.length > 24 ? nadpis.slice(0, 23) + '…' : nadpis)}</text>
      <text class="utext" x="${-W / 2 + 10}" y="${-H / 2 + 34}">${esc(r1)}</text>
      <text class="utext" x="${-W / 2 + 10}" y="${-H / 2 + 48}">${esc(r2)}</text>
      ${problemy[id] ? `<text class="${problemy[id] === 'chyba' ? 'chyba-znak' : 'var-znak'}" x="${W / 2 - 18}" y="${-H / 2 + 17}">⚠</text>` : ''}
      ${s.konec == null ? `<circle class="uchyt" cx="${ux}" cy="${uy}" r="8"/><text class="uchyt-plus" x="${ux - 4}" y="${uy + 4}">+</text>` : ''}
    </g>`;
  }
  $('gUzly').innerHTML = h;
}
function kresliHrany() {
  const vpravo = nast.smer === 'vpravo';
  const H_ = E.hrany(P);
  const pocet = {}, poradi = {};
  for (const h of H_) pocet[h.z] = (pocet[h.z] || 0) + 1;
  let out = '';
  for (const h of H_) {
    const a = proj.pozice[h.z]; if (!a) continue;
    const i = poradi[h.z] = (poradi[h.z] || 0) + 1, n = pocet[h.z];
    const rozptyl = (i - 1 - (n - 1) / 2) * Math.min(16, (vpravo ? H - 16 : W - 40) / Math.max(1, n));
    const aktivni = nast.sousede && vybrana && (h.z === vybrana || h.do === vybrana);
    const b = proj.pozice[h.do];
    let d, tr = '';
    if (vpravo) {
      const sx = a.x + W / 2, sy = a.y + rozptyl;
      if (!b) { d = `M${sx},${sy} L${sx + 40},${sy}`; tr = `<text class="chybi-cil" x="${sx + 44}" y="${sy + 4}">${esc(h.do)}?</text>`; }
      else if (h.do === h.z) d = `M${sx},${sy} C${sx + 50},${sy - 50} ${a.x},${a.y - H / 2 - 50} ${a.x},${a.y - H / 2}`;
      else { const tx = b.x - W / 2, ty = b.y, dx = Math.max(30, Math.abs(tx - sx) / 2); d = `M${sx},${sy} C${sx + dx},${sy} ${tx - dx},${ty} ${tx},${ty}`; }
    } else {
      const sx = a.x + rozptyl, sy = a.y + H / 2;
      if (!b) { d = `M${sx},${sy} L${sx},${sy + 36}`; tr = `<text class="chybi-cil" x="${sx + 4}" y="${sy + 34}">${esc(h.do)}?</text>`; }
      else if (h.do === h.z) d = `M${sx},${sy} C${sx + 30},${sy + 50} ${a.x + W / 2 + 50},${a.y} ${a.x + W / 2},${a.y}`;
      else { const tx = b.x, ty = b.y - H / 2, dy = Math.max(30, Math.abs(ty - sy) / 2); d = `M${sx},${sy} C${sx},${sy + dy} ${tx},${ty - dy} ${tx},${ty}`; }
    }
    const sip = aktivni ? 'sAkt' : !b ? 'sNe' : DRUH_SIPKY[h.druh];
    out += `<path class="hrana d-${h.druh}${h.podm ? ' podm' : ''}${aktivni ? ' aktivni' : ''}${!b ? ' d-neuspech' : ''}" d="${d}" marker-end="url(#${sip})"><title>${esc(h.z)} → ${esc(h.do)} (${esc(E.popisVolby(P.sceny[h.z], h.volba))})</title></path>${tr}`;
  }
  $('gHrany').innerHTML = out;
}
function nastavPohled() {
  svet.setAttribute('transform', `translate(${pohled.x},${pohled.y}) scale(${pohled.k})`);
  svg.classList.toggle('daleko', pohled.k < 0.4);
  $('meritko').textContent = Math.round(pohled.k * 100) + ' %';
  kresliMinimapu();
}
function hranice() {
  const q = Object.values(proj.pozice);
  if (!q.length) return { x0: -100, y0: -100, x1: 100, y1: 100 };
  return { x0: Math.min(...q.map(p => p.x)) - W / 2 - 20, y0: Math.min(...q.map(p => p.y)) - H / 2 - 20, x1: Math.max(...q.map(p => p.x)) + W / 2 + 20, y1: Math.max(...q.map(p => p.y)) + H / 2 + 40 };
}
function prizpusob() {
  if (!proj) return;
  const r = svg.getBoundingClientRect(), b = hranice();
  if (!r.width) return;
  pohled.k = Math.max(0.08, Math.min(1.3, Math.min(r.width / (b.x1 - b.x0), r.height / (b.y1 - b.y0))));
  pohled.x = (r.width - (b.x1 + b.x0) * pohled.k) / 2;
  pohled.y = (r.height - (b.y1 + b.y0) * pohled.k) / 2;
  nastavPohled();
}
function naScenu(id, k) {
  const q = proj.pozice[id]; if (!q) return;
  const r = svg.getBoundingClientRect();
  if (k) pohled.k = k;
  else if (pohled.k < 0.55) pohled.k = 0.8;
  pohled.x = r.width / 2 - q.x * pohled.k;
  pohled.y = r.height / 2 - q.y * pohled.k;
  nastavPohled();
}
function viditelna(id) {
  const q = proj.pozice[id], r = svg.getBoundingClientRect();
  if (!q) return true;
  const x = q.x * pohled.k + pohled.x, y = q.y * pohled.k + pohled.y;
  return x > 20 && y > 20 && x < r.width - 20 && y < r.height - 20;
}
function zoomKolem(f, cx, cy) {
  const k = Math.max(0.05, Math.min(3, pohled.k * f));
  pohled.x = cx - (cx - pohled.x) * k / pohled.k;
  pohled.y = cy - (cy - pohled.y) * k / pohled.k;
  pohled.k = k;
  nastavPohled();
}
const naSvet = (cx, cy) => { const r = svg.getBoundingClientRect(); return { x: (cx - r.left - pohled.x) / pohled.k, y: (cy - r.top - pohled.y) / pohled.k }; };

/* ---------- myš a dotyk ---------- */
const prsty = new Map();
let tah = null;
svg.addEventListener('pointerdown', e => {
  if (e.button > 0) return;
  prsty.set(e.pointerId, { x: e.clientX, y: e.clientY });
  try { svg.setPointerCapture(e.pointerId); } catch (er) { /* syntetická událost */ }
  if (prsty.size === 2) { const [a, b] = [...prsty.values()]; tah = { druh: 'stisk', d: Math.hypot(a.x - b.x, a.y - b.y), k: pohled.k }; return; }
  const uchyt = e.target.closest('.uchyt'), uzel = e.target.closest('.uzel');
  const w = naSvet(e.clientX, e.clientY);
  if (uchyt && uzel) tah = { druh: 'spoj', z: uzel.dataset.id, sx: e.clientX, sy: e.clientY, pohyb: false };
  else if (uzel) { const q = proj.pozice[uzel.dataset.id]; tah = { druh: 'uzel', id: uzel.dataset.id, dx: w.x - q.x, dy: w.y - q.y, sx: e.clientX, sy: e.clientY, pohyb: false }; }
  else { tah = { druh: 'posun', sx: e.clientX, sy: e.clientY, px: pohled.x, py: pohled.y, pohyb: false }; svg.classList.add('tazeni'); }
});
svg.addEventListener('pointermove', e => {
  if (!prsty.has(e.pointerId) || !tah) return;
  prsty.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (tah.druh === 'stisk' && prsty.size === 2) {
    const [a, b] = [...prsty.values()], r = svg.getBoundingClientRect();
    zoomKolem(tah.k * Math.hypot(a.x - b.x, a.y - b.y) / tah.d / pohled.k, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
    return;
  }
  if (!tah.pohyb && Math.hypot(e.clientX - tah.sx, e.clientY - tah.sy) < 4) return;
  tah.pohyb = true;
  if (tah.druh === 'posun') { pohled.x = tah.px + e.clientX - tah.sx; pohled.y = tah.py + e.clientY - tah.sy; nastavPohled(); }
  else if (tah.druh === 'uzel') {
    const w = naSvet(e.clientX, e.clientY);
    proj.pozice[tah.id] = { x: Math.round(w.x - tah.dx), y: Math.round(w.y - tah.dy) };
    kresliPozdeji(false);
  } else if (tah.druh === 'spoj') {
    const a = proj.pozice[tah.z], w = naSvet(e.clientX, e.clientY);
    const sx = nast.smer === 'vpravo' ? a.x + W / 2 : a.x, sy = nast.smer === 'vpravo' ? a.y : a.y + H / 2;
    $('gNova').innerHTML = `<path class="hrana nova" d="M${sx},${sy} L${w.x},${w.y}" marker-end="url(#sAkt)"/>`;
  }
});
async function konecTahu(e) {
  prsty.delete(e.pointerId);
  svg.classList.remove('tazeni');
  const t = tah; tah = null;
  if (!t || t.druh === 'stisk') return;
  if (t.druh === 'uzel') {
    if (t.pohyb) zmena({ hned: true });
    else vyber(t.id);
  } else if (t.druh === 'spoj') {
    $('gNova').innerHTML = '';
    if (!t.pohyb) { vyber(t.z); return; }
    const cil = document.elementFromPoint(e.clientX, e.clientY);
    const uzel = cil && cil.closest && cil.closest('.uzel');
    let id;
    if (uzel) id = uzel.dataset.id;
    else { const w = naSvet(e.clientX, e.clientY); id = E.noveId(P); P.sceny[id] = { text: '' }; proj.pozice[id] = { x: Math.round(w.x), y: Math.round(w.y) }; }
    const s = P.sceny[t.z];
    (s.volby = s.volby || []).push({ text: uzel ? '' : 'Pokračovat', cil: id });
    vybrana = t.z;
    zmena({ hned: true });
    prepniZalozku('scena');
    setTimeout(() => { const v = document.querySelectorAll('.volba'); const posl = v[v.length - 1]; if (posl) { posl.scrollIntoView({ block: 'nearest' }); const i = posl.querySelector('input'); if (i) i.focus(); } }, 30);
  }
}
svg.addEventListener('pointerup', konecTahu);
svg.addEventListener('pointercancel', e => { prsty.delete(e.pointerId); tah = null; $('gNova').innerHTML = ''; svg.classList.remove('tazeni'); });
svg.addEventListener('wheel', e => {
  e.preventDefault();
  const r = svg.getBoundingClientRect();
  zoomKolem(Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015)), e.clientX - r.left, e.clientY - r.top);
}, { passive: false });
svg.addEventListener('dblclick', e => {
  const uzel = e.target.closest('.uzel');
  if (uzel) { vyber(uzel.dataset.id); prepniZalozku('scena'); const t = document.querySelector('[data-k="text"]'); if (t) t.focus(); return; }
  const w = naSvet(e.clientX, e.clientY);
  novaScena({ poz: { x: Math.round(w.x), y: Math.round(w.y) } });
});

/* ---------- minimapa ---------- */
const mm = $('minimapa');
let mmT = null;
function barva(v) { return getComputedStyle(document.body).getPropertyValue(v).trim() || '#888'; }
function kresliMinimapu() {
  mm.hidden = !nast.minimapa;
  if (!nast.minimapa || !proj) return;
  const dpr = window.devicePixelRatio || 1, cw = mm.clientWidth, ch = mm.clientHeight;
  if (!cw) return;
  if (mm.width !== Math.round(cw * dpr)) { mm.width = Math.round(cw * dpr); mm.height = Math.round(ch * dpr); }
  const c = mm.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, cw, ch);
  const b = hranice();
  const k = Math.min((cw - 8) / (b.x1 - b.x0), (ch - 8) / (b.y1 - b.y0));
  const ox = (cw - (b.x1 - b.x0) * k) / 2 - b.x0 * k, oy = (ch - (b.y1 - b.y0) * k) / 2 - b.y0 * k;
  mmT = { k, ox, oy };
  const B = { start: barva('--accent'), vyhra: barva('--ok'), prohra: barva('--danger'), neutral: barva('--text-muted'), boj: barva('--warn'), zkouska: barva('--accent'), scena: barva('--text-faint'), chybi: barva('--danger') };
  for (const id of Object.keys(P.sceny)) {
    const q = proj.pozice[id]; if (!q) continue;
    c.fillStyle = id === vybrana ? barva('--text') : B[E.typUzlu(P, id)];
    c.fillRect(q.x * k + ox - Math.max(1.5, W * k / 2), q.y * k + oy - Math.max(1, H * k / 2), Math.max(3, W * k), Math.max(2, H * k));
  }
  const r = svg.getBoundingClientRect();
  c.strokeStyle = barva('--accent'); c.lineWidth = 1.5;
  c.strokeRect((-pohled.x / pohled.k) * k + ox, (-pohled.y / pohled.k) * k + oy, r.width / pohled.k * k, r.height / pohled.k * k);
}
function mmPosun(e) {
  if (!mmT) return;
  const r = mm.getBoundingClientRect(), s = svg.getBoundingClientRect();
  const wx = (e.clientX - r.left - mmT.ox) / mmT.k, wy = (e.clientY - r.top - mmT.oy) / mmT.k;
  pohled.x = s.width / 2 - wx * pohled.k; pohled.y = s.height / 2 - wy * pohled.k;
  nastavPohled();
}
mm.addEventListener('pointerdown', e => { try { mm.setPointerCapture(e.pointerId); } catch (er) { /* syntetická */ } mmPosun(e); mm.onpointermove = mmPosun; });
mm.addEventListener('pointerup', () => { mm.onpointermove = null; });
new MutationObserver(() => kresliMinimapu()).observe(document.documentElement, { attributes: true });
new MutationObserver(() => kresliMinimapu()).observe(document.body, { attributes: true, attributeFilter: ['class', 'data-theme'] });
addEventListener('resize', () => { kresliMinimapu(); zavriNabidky(); });

/* ---------- hledání ---------- */
const bezDia = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function hledej(q, tiche) {
  hledany = q.trim();
  const n = bezDia(hledany);
  nalezy = !n ? [] : Object.keys(P.sceny).filter(id => bezDia(id) === n || bezDia(P.sceny[id].text).includes(n) || (P.sceny[id].volby || []).some(v => bezDia(v.text).includes(n)));
  if (!tiche) { nalezIdx = -1; kresliPozdeji(false); }
}
$('hledat').addEventListener('input', e => hledej(e.target.value));
$('hledat').addEventListener('keydown', e => {
  if (e.key === 'Enter' && nalezy.length) { nalezIdx = (nalezIdx + 1) % nalezy.length; vyber(nalezy[nalezIdx]); naScenu(nalezy[nalezIdx]); }
  if (e.key === 'Escape') { e.target.value = ''; hledej(''); e.target.blur(); }
});

/* =========================================================
   Výběr a úpravy scén
   ========================================================= */
function vyber(id) {
  vybrana = id;
  if (nast.zalozka !== 'hra') nast.zalozka = 'scena';
  kresliPozdeji(false);
  vykresliPanel();
  if (id && !viditelna(id)) naScenu(id);
}
function novaScena(o) {
  o = o || {};
  const id = E.noveId(P);
  P.sceny[id] = { text: o.text || '' };
  proj.pozice[id] = o.poz || volneMisto(vybrana && proj.pozice[vybrana] ? proj.pozice[vybrana] : { x: 0, y: 0 });
  if (o.bezVyberu) { zmena({ hned: true }); return id; }
  vybrana = id; nast.zalozka = 'scena';
  zmena({ hned: true, panel: true });
  if (!viditelna(id)) naScenu(id);
  setTimeout(() => { const t = document.querySelector('[data-k="text"]'); if (t) t.focus(); }, 30);
  return id;
}
async function prejmenujScenu() {
  if (!vybrana) return;
  const nove = await Dialog.zeptej('Nové id scény (odkazy na ni se přepíšou):', vybrana, { ok: 'Přejmenovat' });
  if (nove == null || nove.trim() === vybrana) return;
  if (!/^[\w-]+$/.test(nove.trim())) return Dialog.chyba('Id smí obsahovat jen písmena bez diakritiky, číslice, _ a -.');
  try {
    const st = vybrana, n = E.prejmenujScenu(P, st, nove.trim());
    proj.pozice[nove.trim()] = proj.pozice[st]; delete proj.pozice[st];
    vybrana = nove.trim();
    zmena({ hned: true, panel: true });
    Dialog.info('Přejmenováno, upraveno odkazů: ' + n);
  } catch (e) { Dialog.chyba(e.message); }
}
async function smazScenu() {
  if (!vybrana || !P.sceny[vybrana]) return;
  const odk = E.odkazyNa(P, vybrana);
  const txt = 'Smazat scénu ' + vybrana + '?' + (odk.length ? '\nVede na ni ' + odk.length + ' odkazů – zůstanou viset a kontrola je ukáže.' : '');
  if (!(await Dialog.potvrd(txt, { ok: 'Smazat', zrus: 'Ponechat' }))) return;
  delete P.sceny[vybrana]; delete proj.pozice[vybrana];
  vybrana = odk.find(o => o.scena && P.sceny[o.scena]) ? odk.find(o => o.scena && P.sceny[o.scena]).scena : null;
  zmena({ hned: true, panel: true });
}
function duplikujScenu() {
  if (!vybrana) return;
  const id = E.noveId(P);
  P.sceny[id] = E.kopie(P.sceny[vybrana]);
  const q = proj.pozice[vybrana];
  proj.pozice[id] = { x: q.x + 30, y: q.y + 30 };
  vybrana = id;
  zmena({ hned: true, panel: true });
}
async function precisluj() {
  if (!(await Dialog.potvrd('Přečíslovat všechny scény 1, 2, 3… v pořadí čtení grafu (shora dolů, zleva doprava)? Start dostane číslo 1, odkazy se přepíšou.', { ok: 'Přečíslovat', zrus: 'Zrušit' }))) return;
  const ids = Object.keys(P.sceny).sort((a, b) => a === P.start ? -1 : b === P.start ? 1 : (proj.pozice[a].y - proj.pozice[b].y) || (proj.pozice[a].x - proj.pozice[b].x));
  const docasne = ids.map((id, i) => { const t = '__docasne_' + i; E.prejmenujScenu(P, id, t); proj.pozice[t] = proj.pozice[id]; delete proj.pozice[id]; return t; });
  docasne.forEach((t, i) => { const n = String(i + 1); E.prejmenujScenu(P, t, n); proj.pozice[n] = proj.pozice[t]; delete proj.pozice[t]; if (vybrana === ids[i]) vybrana = n; });
  zmena({ hned: true, panel: true });
}

/* ---------- cesty v datech ---------- */
function ctiCestu(o, cesta) { return cesta.split('.').reduce((a, k) => a == null ? undefined : a[k], o); }
function nastavCestu(koren, cesta, hodnota) {
  const casti = cesta.split('.');
  const rodice = [koren];
  let o = koren;
  for (let i = 0; i < casti.length - 1; i++) {
    const k = casti[i];
    if (o[k] == null || typeof o[k] !== 'object') o[k] = /^\d+$/.test(casti[i + 1]) ? [] : {};
    o = o[k]; rodice.push(o);
  }
  E.nastav(o, casti[casti.length - 1], hodnota);
  for (let i = casti.length - 2; i >= 0; i--) {
    const par = rodice[i], v = par[casti[i]];
    if (!Array.isArray(par) && v && typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length) delete par[casti[i]];
    else break;
  }
}
function koren(el) {
  const k = el.closest('[data-koren]');
  const d = k ? k.dataset.koren : 'scena';
  if (d === 'pribeh') return P;
  if (d === 'projekt') return proj;
  if (d === 'hra') return hra.nast;
  return P.sceny[vybrana];
}

/* ---------- komponenty formulářů ---------- */
const val = (o, c) => { const v = ctiCestu(o, c); return v == null ? '' : v; };
function pole(popis, html, cls) { return `<label class="pole${cls ? ' ' + cls : ''}"><span>${popis}</span>${html}</label>`; }
function vstup(o, cesta, t, attr) { return `<input class="vstup" data-k="${cesta}" data-t="${t || 'str'}" value="${esc(val(o, cesta))}" ${attr || ''}>`; }
function cislo(o, cesta, attr) { return `<input class="vstup" type="number" inputmode="numeric" data-k="${cesta}" data-t="num" value="${esc(val(o, cesta))}" ${attr || ''}>`; }
function cilHtml(o, cesta, ph, bezNove) {
  const v = val(o, cesta);
  const vadne = v !== '' && !P.sceny[v];
  return `<div class="cil-radek"><input class="vstup${vadne ? ' vadne' : ''}" data-k="${cesta}" data-t="id" list="dlSceny" value="${esc(v)}" placeholder="${esc(ph || 'id scény')}" autocomplete="off">
    <button type="button" class="btn mini" data-akce="jdi" data-cil="${esc(v)}" title="Přejít na scénu" aria-label="Přejít na scénu"${v && P.sceny[v] ? '' : ' disabled'}>→</button>
    ${bezNove ? '' : `<button type="button" class="btn mini" data-akce="novaCil" data-k="${cesta}" title="Vytvořit novou scénu a napojit" aria-label="Vytvořit novou scénu">✚</button>`}</div>`;
}
function chipsHtml(o, cesta, zdroj, ph, poleVzdy) {
  const hodn = [].concat(val(o, cesta) || []).filter(x => x !== '');
  const znam = zdroj === 'predmety' ? x => !!(P.predmety || {})[x] : () => true;
  return `<div class="chips" data-k="${cesta}" data-pole="${poleVzdy ? 1 : ''}" data-i18n="ne">${hodn.map((x, i) => `<span class="chip${znam(x) ? '' : ' nezname'}" title="${esc(zdroj === 'predmety' ? ((P.predmety || {})[x] || {}).nazev || 'neznámý předmět' : x)}">${esc(x)}<button type="button" data-akce="odeberChip" data-i="${i}" aria-label="Odebrat">×</button></span>`).join('')}
    <input list="${zdroj === 'predmety' ? 'dlPredmety' : 'dlPriznaky'}" data-chip="1" placeholder="${esc(ph || '+ přidat')}" autocomplete="off"></div>`;
}
function souhrnEfektu(e) {
  if (!e || !Object.keys(e).length) return 'žádné';
  const c = [];
  for (const v of E.VLASTNOSTI) if (e[v]) c.push(NAZVY_VL[v] + ' ' + (e[v] > 0 ? '+' : '') + e[v]);
  [].concat(e.predmet || []).forEach(x => c.push('+' + x));
  [].concat(e.odeber || []).forEach(x => c.push('−' + x));
  [].concat(e.priznak || []).forEach(x => c.push('⚑' + x));
  return c.join(', ');
}
function souhrnPodminky(pk) {
  if (!pk || !Object.keys(pk).length) return 'žádná';
  const c = [];
  [].concat(pk.ma || []).forEach(x => c.push('má ' + x));
  [].concat(pk.nema || []).forEach(x => c.push('nemá ' + x));
  [].concat(pk.priznak || []).forEach(x => c.push('⚑' + x));
  [].concat(pk.bez || []).forEach(x => c.push('bez ⚑' + x));
  if (pk.zlato != null) c.push('zlato ≥ ' + pk.zlato);
  return c.join(', ');
}
function efektyHtml(o, c) {
  return `<div class="radek-5">${E.VLASTNOSTI.map(v => pole(NAZVY_VL[v], cislo(o, c + '.' + v, 'placeholder="±0"'))).join('')}</div>
    ${pole('Získá předměty', chipsHtml(o, c + '.predmet', 'predmety'))}
    ${pole('Ztratí předměty', chipsHtml(o, c + '.odeber', 'predmety'))}
    ${pole('Nastaví příznaky', chipsHtml(o, c + '.priznak', 'priznaky'))}`;
}
function pokudHtml(o, c) {
  return `<div class="radek">${pole('Musí mít předmět', chipsHtml(o, c + '.ma', 'predmety'))}${pole('Nesmí mít předmět', chipsHtml(o, c + '.nema', 'predmety'))}</div>
    <div class="radek">${pole('Musí mít příznak', chipsHtml(o, c + '.priznak', 'priznaky'))}${pole('Nesmí mít příznak', chipsHtml(o, c + '.bez', 'priznaky'))}</div>
    ${pole('Zlata aspoň', cislo(o, c + '.zlato', 'min="0"'))}`;
}
function bojHtml(o, c) {
  return `<div class="radek">${pole('Soupeř', vstup(o, c + '.jmeno', 'str', 'data-i18n="ne"'))}${pole('Obratnost', cislo(o, c + '.obratnost', 'min="0"'))}${pole('Zdraví', cislo(o, c + '.zdravi', 'min="1"'))}</div>
    ${pole('Při výhře', cilHtml(o, c + '.vyhra'))}
    ${pole('Při prohře', cilHtml(o, c + '.prohra', 'výchozí: scéna smrti (' + (P.smrt || '?') + ')'))}
    ${pole('Útěk (−2 zdraví)', cilHtml(o, c + '.utek', 'bez možnosti útěku'))}`;
}
function druhVolby(v) { return v.zkouska ? 'zkouska' : v.boj ? 'boj' : 'cil'; }
function volbaHtml(s, i) {
  const v = s.volby[i], c = 'volby.' + i, d = druhVolby(v);
  let telo;
  if (d === 'cil') telo = pole('Cíl', cilHtml(s, c + '.cil'));
  else if (d === 'zkouska') telo = `${pole('Zkouška vlastnosti (2 kostky ≤ hodnota)', `<select class="vstup" data-k="${c}.zkouska.co" data-t="str">${E.VLASTNOSTI.map(x => `<option value="${x}"${v.zkouska.co === x ? ' selected' : ''}>${NAZVY_VL[x]}</option>`).join('')}</select>`)}
    <div class="radek">${pole('Úspěch', cilHtml(s, c + '.zkouska.uspech'))}${pole('Neúspěch', cilHtml(s, c + '.zkouska.neuspech'))}</div>`;
  else telo = bojHtml(s, c + '.boj');
  const maPodm = v.pokud && Object.keys(v.pokud).length, maEf = v.efekty && Object.keys(v.efekty).length;
  return `<div class="volba" data-volba="${i}">
    <div class="volba-hlava"><span class="cislo">${i + 1}.</span><input class="vstup" data-k="${c}.text" data-t="str" value="${esc(v.text || '')}" placeholder="Text volby" data-i18n="ne">
      <select class="vstup" style="flex:0 0 auto;width:auto" data-akce="druhVolby" data-i="${i}" aria-label="Druh volby">
        <option value="cil"${d === 'cil' ? ' selected' : ''}>→ cíl</option><option value="zkouska"${d === 'zkouska' ? ' selected' : ''}>🎲 zkouška</option><option value="boj"${d === 'boj' ? ' selected' : ''}>⚔ souboj</option></select></div>
    ${telo}
    <details class="blok"${maPodm ? ' open' : ''}><summary>Podmínka: <span data-i18n="ne">${esc(souhrnPodminky(v.pokud))}</span></summary>${pokudHtml(s, c + '.pokud')}</details>
    <details class="blok"${maEf ? ' open' : ''}><summary>Efekty volby: <span data-i18n="ne">${esc(souhrnEfektu(v.efekty))}</span></summary>${efektyHtml(s, c + '.efekty')}</details>
    <div class="volba-akce">
      <button type="button" class="btn mini" data-akce="volbaNahoru" data-i="${i}" title="Posunout nahoru" aria-label="Posunout nahoru"${i ? '' : ' disabled'}>↑</button>
      <button type="button" class="btn mini" data-akce="volbaDolu" data-i="${i}" title="Posunout dolů" aria-label="Posunout dolů"${i < s.volby.length - 1 ? '' : ' disabled'}>↓</button>
      <button type="button" class="btn mini" data-akce="volbaKopie" data-i="${i}" title="Duplikovat volbu">⧉</button>
      <button type="button" class="btn mini nebezpecne" data-akce="volbaSmaz" data-i="${i}" title="Smazat volbu">🗑</button>
    </div></div>`;
}

/* =========================================================
   Panel
   ========================================================= */
function prepniZalozku(z) { nast.zalozka = z; ulozNast(); vykresliPanel(); }
document.querySelector('.zalozky').addEventListener('click', e => { const b = e.target.closest('[data-zalozka]'); if (b) prepniZalozku(b.dataset.zalozka); });
function vykresliPanel() {
  document.querySelectorAll('[data-zalozka]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.zalozka === nast.zalozka)));
  if (!proj) return;
  const t = $('teloPanelu');
  const top = t.scrollTop;
  const f = { scena: panelScena, kontrola: panelKontrola, hra: panelHra, pribeh: panelPribeh }[nast.zalozka] || panelScena;
  t.innerHTML = f();
  t.scrollTop = top;
}
function panelScena() {
  const s = vybrana && P.sceny[vybrana];
  if (!s) return `<div class="prazdne">Vyber scénu v grafu, nebo vytvoř novou.<br><br><button class="btn hlavni" data-akce="novaScena">✚ Nová scéna</button></div>`;
  const typ = E.typUzlu(P, vybrana);
  const stitky = [];
  if (vybrana === P.start) stitky.push('<span class="stitek s-start">▶ start</span>');
  if (vybrana === P.smrt) stitky.push('<span class="stitek s-prohra">scéna smrti</span>');
  if (vybrana === P.tma) stitky.push('<span class="stitek s-prohra">scéna tmy</span>');
  if (typ !== 'scena' && typ !== 'start') stitky.push(`<span class="stitek s-${typ}">${IKONA_TYPU[typ]} ${NAZEV_TYPU[typ]}</span>`);
  const odk = E.odkazyNa(P, vybrana);
  const obr = s.obr ? `<img class="nahled-obr" src="${esc((P.obrazky || 'gamebook/obr/') + s.obr)}.webp" alt="" onerror="this.hidden=true">` : '';
  const prob = analyza.vlastni.filter(n => n.scena === vybrana && n.uroven !== 'info').concat(analyza.engine.filter(n => n.scena === vybrana).map(n => ({ uroven: 'chyba', text: n.text })));
  const slov = (String(s.text || '').match(/\S+/g) || []).length;
  return `<div data-koren="scena">
  <div class="h-sceny"><h2 data-i18n="ne">Scéna ${esc(vybrana)}</h2>
    <button class="btn mini" data-akce="prejmenovatScenu" title="Přejmenovat (F2)" aria-label="Přejmenovat scénu">✎</button>${stitky.join('')}
    <span style="flex:1"></span><button class="btn mini" data-akce="hratOdtud" title="Hrát od této scény (P)">▶ Hrát odtud</button></div>
  ${prob.length ? `<ul class="nalezy">${prob.map(n => `<li class="u-${n.uroven}"><span class="ik">${n.uroven === 'chyba' ? '⛔' : '⚠'}</span><span>${esc(n.text)}</span></li>`).join('')}</ul>` : ''}
  <div class="radek">
    ${pole('Obrázek (obr)', vstup(s, 'obr', 'str', 'list="dlObr" placeholder="bez obrázku"'))}
    ${pole('Konec příběhu', `<select class="vstup" data-k="konec" data-t="str"><option value="">— není konec —</option>${Object.keys(P.konce || {}).map(k => `<option data-i18n="ne" value="${esc(k)}"${s.konec === k ? ' selected' : ''}>${esc(k)} – ${esc(P.konce[k].nazev || '')}</option>`).join('')}${s.konec != null && !(P.konce || {})[s.konec] ? `<option value="${esc(s.konec)}" selected>${esc(s.konec)} (neznámý)</option>` : ''}</select>`)}
  </div>
  ${obr}
  <label class="pole"><span>Text scény (odstavce odděl prázdným řádkem)</span><textarea class="vstup" data-k="text" data-t="str" rows="10" data-i18n="ne">${esc(s.text || '')}</textarea><span class="pocet-slov" id="pocetSlov">${slov} slov</span></label>
  <details class="blok"${s.efekty && Object.keys(s.efekty).length ? ' open' : ''}><summary>Efekty při první návštěvě: <span data-i18n="ne">${esc(souhrnEfektu(s.efekty))}</span></summary>${efektyHtml(s, 'efekty')}</details>
  <details class="blok"${s.boj ? ' open' : ''}><summary>Souboj hned při vstupu${s.boj ? ': <span data-i18n="ne">' + esc(s.boj.jmeno || '') + '</span>' : ''}</summary>
    <label class="zatrzitko"><input type="checkbox" data-akce="prepBoj"${s.boj ? ' checked' : ''}> Scéna začíná soubojem</label>${s.boj ? bojHtml(s, 'boj') : ''}</details>
  <div class="sekce">Volby (${(s.volby || []).length})</div>
  ${s.konec != null && !(s.volby || []).length ? '<p class="popis-pole">Koncová scéna nemá volby – hra tu skončí.</p>' : (s.volby || []).map((v, i) => volbaHtml(s, i)).join('')}
  ${s.konec == null ? `<div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn" data-akce="pridatVolbu">✚ Volba</button><button class="btn" data-akce="pridatVolbuNova">✚ Volba do nové scény</button></div>` : ''}
  <div class="sekce">Odkazy sem (${odk.length})</div>
  <div class="odkazy">${odk.length ? odk.map(o => o.scena ? `<button class="odkaz" data-akce="jdi" data-cil="${esc(o.scena)}">${esc(o.scena)}</button> <span data-i18n="ne">${esc(o.kde)}</span>` : `<b>${esc(o.kde)}</b>`).join('<br>') : 'Žádná scéna sem nevede.'}</div>
  <details class="blok" style="margin-top:14px"><summary>{ } Surový JSON scény (pokročilé)</summary>
    <textarea class="vstup surovy" id="surovyScena" spellcheck="false" data-i18n="ne">${esc(JSON.stringify(s, null, 2))}</textarea>
    <div style="margin-top:5px"><button class="btn" data-akce="pouzitSurovyScena">Použít JSON</button></div></details>
  <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:14px">
    <button class="btn" data-akce="duplikovatScenu">⧉ Duplikovat</button>
    <button class="btn" data-akce="nastavitStart"${vybrana === P.start ? ' disabled' : ''}>▶ Nastavit jako start</button>
    <button class="btn nebezpecne" data-akce="smazatScenu">🗑 Smazat scénu</button></div>
  </div>`;
}

function panelKontrola() {
  const st = E.statistiky(P);
  const n = analyza.vlastni;
  const pocty = { chyba: 0, varovani: 0, info: 0 };
  n.forEach(x => pocty[x.uroven]++);
  const filtr = n.filter(x => filtrNalezu === 'vse' || x.uroven === filtrNalezu);
  const odkazId = id => `<button class="odkaz" data-akce="jdi" data-cil="${esc(id)}">${esc(id)}</button>`;
  const tile = (h, t) => `<div class="stat"><b>${h}</b><span>${t}</span></div>`;
  const f = x => x == null ? '–' : (Math.round(x * 10) / 10).toLocaleString('cs-CZ');
  let sim = '';
  if (simulace) {
    const celk = simulace.her;
    const radky = Object.entries(simulace.konce).sort((a, b) => b[1] - a[1]).map(([id, k]) => {
      const typ = ((P.konce || {})[(P.sceny[id] || {}).konec] || {}).typ || '';
      return `<div class="sloupec"><span>${odkazId(id)} <span data-i18n="ne">${esc(((P.konce || {})[(P.sceny[id] || {}).konec] || {}).nazev || '')}</span></span><div class="bar ${typ}" style="width:${Math.max(2, 100 * k / celk)}%"></div><span>${Math.round(100 * k / celk)} %</span></div>`;
    }).join('');
    const uv = Object.entries(simulace.uvizl);
    const ch = Object.entries(simulace.chyby);
    sim = `<p class="popis-pole">Odehráno ${celk} náhodných her (náhodné volby, souboje do konce, léčení při nízkém zdraví). Průměrná délka hry: ${f(simulace.prumerTahu)} scén.</p>
      <div class="sloupce">${radky}</div>
      ${uv.length ? `<p><b>⛔ Hráč uvízl</b> (žádná dostupná volba): ${uv.map(([id, k]) => odkazId(id) + ' ×' + k).join(', ')}</p>` : ''}
      ${simulace.zacykleni ? `<p><b>⚠ Zacyklení:</b> ${simulace.zacykleni} her nedošlo ke konci ani po 400 krocích.</p>` : ''}
      ${ch.length ? `<p><b>⛔ Chyby enginu:</b> ${ch.map(([m, k]) => esc(m) + ' ×' + k).join('; ')}</p>` : ''}
      ${!uv.length && !ch.length && !simulace.zacykleni ? '<p>✓ Všechny hry došly ke konci.</p>' : ''}`;
  }
  return `<div class="statistiky">
    ${tile(st.scen, 'scén')}${tile(st.koncu, 'konců')}${tile(`${st.konceTyp.vyhra} / ${st.konceTyp.neutral} / ${st.konceTyp.prohra}`, 'dobré / neutrální / zlé')}
    ${tile(st.voleb, 'voleb')}${tile(st.zkousek, 'zkoušek')}${tile(st.soubojuu, 'soubojů')}
    ${tile(st.podminenych, 'podmíněných voleb')}${tile(st.predmetu, 'předmětů')}${tile(st.slov.toLocaleString('cs-CZ'), 'slov')}
    ${tile(f(st.prumernaCesta), 'průměrná cesta ke konci')}${tile(st.nejdelsiCesta ? st.nejdelsiCesta.delka : '–', 'nejdelší cesta')}${tile(st.nejkratsiVyhra ? st.nejkratsiVyhra.delka : '–', 'nejkratší cesta k výhře')}
  </div>
  <p class="popis-pole">Cesty se počítají v krocích (volbách) od startu. Průměr = průměr nejkratších cest ke všem dosažitelným koncům; nejdelší cesta nepoužije žádnou scénu dvakrát.</p>
  ${st.nejdelsiCesta ? `<details class="blok"><summary>Nejdelší cesta (${st.nejdelsiCesta.delka} kroků)</summary><div class="cesta" data-i18n="ne">${st.nejdelsiCesta.cesta.map(odkazId).join(' → ')}</div></details>` : ''}
  <div class="sekce">Nálezy kontroly (${n.length})</div>
  <div class="filtr-nalezu">${[['vse', 'Vše ' + n.length], ['chyba', '⛔ Chyby ' + pocty.chyba], ['varovani', '⚠ Varování ' + pocty.varovani], ['info', 'ℹ Info ' + pocty.info]].map(([k, t]) => `<button class="tl" data-akce="filtr" data-f="${k}" aria-pressed="${filtrNalezu === k}">${t}</button>`).join('')}</div>
  ${filtr.length ? `<ul class="nalezy">${filtr.map(x => `<li class="u-${x.uroven}" ${x.scena ? `data-akce="jdi" data-cil="${esc(x.scena)}"` : ''}><span class="ik">${x.uroven === 'chyba' ? '⛔' : x.uroven === 'varovani' ? '⚠' : 'ℹ'}</span><span class="sc" data-i18n="ne">${esc(x.scena || '')}</span><span>${esc(x.text)}</span></li>`).join('')}</ul>` : '<p>✓ Nic k hlášení.</p>'}
  <div class="sekce">Kontrola enginu – validuj (${analyza.engine.length})</div>
  ${analyza.engine.length ? `<ul class="nalezy">${analyza.engine.map(x => `<li class="u-chyba" ${x.scena ? `data-akce="jdi" data-cil="${esc(x.scena)}"` : ''}><span class="ik">⛔</span><span data-i18n="ne">${esc(x.text)}</span></li>`).join('')}</ul>` : '<p>✓ Engine nemá výhrady – příběh jde hrát.</p>'}
  <div class="sekce">Simulace</div>
  <button class="btn hlavni" data-akce="simulovat">🎲 Odehrát 500 náhodných her</button>
  ${sim}`;
}

/* ---------- hraní na zkoušku ---------- */
function popisPodm(pk) { return 'podmínka: ' + souhrnPodminky(pk); }
function panelHra() {
  const n = hra.nast;
  if (!n.od || !P.sceny[n.od]) n.od = vybrana && P.sceny[vybrana] ? vybrana : P.start;
  if (n.predmety == null) n.predmety = [].concat((P.zacatek || {}).predmety || []);
  const nastaveni = `<div data-koren="hra">
    <div class="radek">${pole('Začít ve scéně', cilHtml(n, 'od', '', true))}${pole('Seed kostek', cislo(n, 'seed'))}</div>
    <div class="radek-5">${E.VLASTNOSTI.map(v => pole(NAZVY_VL[v], cislo(n, v, 'placeholder="náhodně" min="0"'))).join('')}</div>
    ${pole('Předměty v torbě', chipsHtml(n, 'predmety', 'predmety', '+ předmět', true))}
    ${pole('Příznaky', chipsHtml(n, 'priznaky', 'priznaky', '+ příznak', true))}
    <div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn hlavni" data-akce="startHry">▶ Spustit od scény ${esc(n.od)}</button>
    <button class="btn" data-akce="hraVybrana">◎ Od vybrané scény</button><button class="btn" data-akce="hraVychozi">↺ Výchozí stav</button></div>
    <label class="zatrzitko" style="margin-top:8px"><input type="checkbox" data-akce="sledovat"${nast.sledovat ? ' checked' : ''}> Sledovat hru v grafu</label></div>`;
  if (!hra.st) return `<p class="popis-pole">Hra běží přímo enginem webových gamebooků (GamebookJadro) nad aktuálním příběhem. Prázdné vlastnosti se hodí kostkou jako v nové hře.</p>` + nastaveni;
  const st = hra.st, p = hra.p, s = p.sceny[st.scena];
  const NZ = Object.assign({}, NAZVY_VL, p.nazvy || {});
  const vl = ['zdravi', 'obratnost', 'stesti', 'olej'].map(v => `<span>${esc(NZ[v])}: <b>${st[v]}/${st[v + 'Max']}</b></span>`).join('') + `<span>${esc(NZ.zlato)}: <b>${st.zlato}</b></span>`;
  const pocty = {};
  st.predmety.forEach(x => { pocty[x] = (pocty[x] || 0) + 1; });
  const predm = Object.keys(pocty).map(x => { const d = p.predmety[x] || { nazev: x }; return `<span class="chip" title="${esc(d.popis || '')}">${esc(d.nazev)}${pocty[x] > 1 ? ' ×' + pocty[x] : ''}${d.pouziti && !st.konec ? `<button type="button" data-akce="hraPouzij" data-x="${esc(x)}" title="Použít">✓</button>` : ''}</span>`; }).join('');
  let h = `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px"><button class="btn" data-akce="startHry">⟲ Znovu</button><button class="btn" data-akce="hraNastaveni">⚙ Nastavení</button><button class="btn" data-akce="jdi" data-cil="${esc(st.scena)}">✎ Upravit scénu ${esc(st.scena)}</button></div>
    <div class="hra-stav">${vl}</div>
    <div class="hra-predmety" data-i18n="ne">${predm || '<span class="popis-pole">Torba je prázdná.</span>'}${st.priznaky.map(x => `<span class="stitek">⚑ ${esc(x)}</span>`).join('')}</div>`;
  const pos = hra.posledni;
  if (pos && pos.zkouska) { const z = pos.zkouska; h += `<div class="hra-hod ${z.ok ? 'ok' : 'ne'}">🎲 Zkouška ${esc(NAZVY_VL[z.co] || z.co)}: ${z.hod[0]} + ${z.hod[1]} = <b>${z.soucet}</b> ${z.ok ? '≤' : '>'} ${z.hodnota} → <b>${z.ok ? 'úspěch' : 'neúspěch'}</b></div>`; }
  if (pos && pos.kolo) { const k = pos.kolo; h += `<div class="hra-hod ${k.vysledek === 'zasah' ? 'ok' : k.vysledek === 'zraneni' ? 'ne' : ''}">⚔ Kolo ${k.kolo}: ty ${k.ja} proti ${k.on} – ${k.vysledek === 'zasah' ? 'zasáhneš' : k.vysledek === 'zraneni' ? 'zasáhne tě' : 'nikdo nezasáhl'}${k.konec ? (k.konec === 'vyhra' ? ' · souboj vyhrán' : ' · souboj prohrán') : ''}</div>`; }
  const zm = ((pos && pos.zmeny) || []).concat(st.posledniZmeny || []).filter(z => z.o);
  if (zm.length) h += `<div class="hra-hod" data-i18n="ne">${zm.map(z => z.co === 'predmet' ? (z.o > 0 ? '+ ' : '− ') + ((p.predmety[z.x] || {}).nazev || z.x) : (NZ[z.co] || z.co) + ' ' + (z.o > 0 ? '+' : '') + z.o).map(esc).join(' · ')}</div>`;
  if (st.konec) { const k = (p.konce || {})[s.konec] || {}; h += `<div class="hra-konec ${esc(k.typ || '')}">${k.typ === 'vyhra' ? '🏆' : k.typ === 'prohra' ? '💀' : '🚪'} Konec: <span data-i18n="ne">${esc(k.nazev || s.konec)}</span></div>`; }
  h += `<div class="popis-pole">Scéna <b>${esc(st.scena)}</b></div>`;
  if (s.obr) h += `<img class="hra-obr" src="${esc((p.obrazky || 'gamebook/obr/') + s.obr)}.webp" alt="" onerror="this.hidden=true">`;
  h += `<div class="hra-text" data-i18n="ne">${String(s.text || '').split(/\n\n+/).map(o => `<p>${esc(o)}</p>`).join('')}</div>`;
  if (st.boj) {
    const b = st.boj;
    h += `<div class="hra-hod">⚔ Souboj: <span data-i18n="ne">${esc(b.jmeno)}</span> – zdraví ${b.zdravi}/${b.zdraviMax}, obratnost ${b.obratnost}</div>
      <div class="hra-volby"><button class="btn hlavni" data-akce="hraKolo">⚔ Bojovat (kolo ${b.kolo + 1})</button>${b.utek ? '<button class="btn" data-akce="hraUtek">🏃 Utéct (−2 zdraví)</button>' : ''}<button class="btn" data-akce="hraDobojuj">⏩ Dobojovat</button></div>`;
  } else if (!st.konec) {
    const dost = new Set(J.volby(st, p).map(o => o.i));
    h += `<div class="hra-volby">${(s.volby || []).map((v, i) => `<button class="btn${dost.has(i) ? '' : ''}" data-akce="hraVolba" data-i="${i}"${dost.has(i) ? '' : ' disabled'}><span data-i18n="ne">${esc(v.text || '(bez textu)')}</span>${!dost.has(i) ? `<span class="pozn" data-i18n="ne">${esc(popisPodm(v.pokud))}</span>` : v.zkouska ? `<span class="pozn">🎲 zkouška: ${esc(NAZVY_VL[v.zkouska.co] || v.zkouska.co)}</span>` : ''}</button>`).join('')}</div>`;
    if (!dost.size) h += '<p class="hra-konec prohra">⛔ Žádná volba není dostupná – hráč tu uvízl.</p>';
  } else h += '<div class="hra-volby"><button class="btn hlavni" data-akce="startHry">⟲ Hrát znovu se stejným nastavením</button></div>';
  h += `<div class="hra-denik">Deník: <span data-i18n="ne">${st.denik.map(id => `<button class="odkaz" data-akce="jdi" data-cil="${esc(id)}">${esc(id)}</button>`).join(' → ')}</span></div>`;
  return h;
}
function startHry() {
  const n = hra.nast;
  hra.p = E.kopie(P);
  hra.posledni = null;
  try {
    hra.st = E.hraOd(hra.p, J, n.od || P.start, { seed: +n.seed || 1, predmety: n.predmety, priznaky: n.priznaky, obratnost: n.obratnost, zdravi: n.zdravi, stesti: n.stesti, olej: n.olej, zlato: n.zlato });
  } catch (e) { hra.st = null; Dialog.chyba('Hru nejde spustit: ' + e.message); }
  nast.zalozka = 'hra';
  sledujHru();
  vykresliPanel();
}
function sledujHru() {
  if (!hra.st || !nast.sledovat || !P.sceny[hra.st.scena]) return;
  vybrana = hra.st.scena;
  kresliPozdeji(false);
  if (!viditelna(vybrana)) naScenu(vybrana);
}
function krokHry(fn) {
  try { hra.posledni = fn() || null; }
  catch (e) { Dialog.chyba('Engine: ' + e.message); }
  sledujHru(); vykresliPanel();
}

/* ---------- příběh: vlastnosti, předměty, konce ---------- */
function panelPribeh() {
  const pr = P.predmety || {}, ko = P.konce || {};
  const pocetKoncu = k => Object.values(P.sceny).filter(s => s.konec === k).length;
  return `<div data-koren="pribeh">
  <div class="sekce" id="secVlastnosti">Název a vzhled</div>
  <div class="radek">${pole('Název', vstup(P, 'nazev', 'str', 'data-i18n="ne"'))}${pole('Ikona', vstup(P, 'ikona', 'str', 'style="max-width:90px"'))}</div>
  ${pole('Podtitul', vstup(P, 'podtitul', 'str', 'data-i18n="ne"'))}
  <div class="radek">${pole('Id příběhu', vstup(P, 'id'))}${pole('Klíč uložené hry (localStorage)', vstup(P, 'klic', 'str', 'placeholder="webapp_hra_gamebook_…"'))}</div>
  <div class="radek">${pole('Složka obrázků', vstup(P, 'obrazky', 'str', 'placeholder="gamebook/obr/"'))}${pole('Obrázek titulní strany', vstup(P, 'uvodObr', 'str', 'list="dlObr"'))}</div>
  ${pole('Pravidlo na titulní straně (smí obsahovat &lt;b&gt;)', `<textarea class="vstup" data-k="pravidlo" data-t="str" rows="3" style="min-height:60px" data-i18n="ne">${esc(P.pravidlo || '')}</textarea>`)}
  <div class="radek">${pole('Popisek oleje', vstup(P, 'nazvy.olej', 'str', 'placeholder="🪔 Olej v kahanu"'))}${pole('Popisek zlata', vstup(P, 'nazvy.zlato', 'str', 'placeholder="🪙 Groše"'))}</div>
  <div class="sekce">Start a začátek hry</div>
  <div class="radek">${pole('Start', cilHtml(P, 'start'))}${pole('Scéna smrti (zdraví 0)', cilHtml(P, 'smrt'))}${pole('Scéna tmy (olej 0)', cilHtml(P, 'tma'))}</div>
  <div class="radek">${pole('Předmět, který svítí místo oleje', `<select class="vstup" data-k="svetlo" data-t="str"><option value="">— žádný —</option>${Object.keys(pr).map(k => `<option data-i18n="ne" value="${esc(k)}"${P.svetlo === k ? ' selected' : ''}>${esc(pr[k].nazev || k)}</option>`).join('')}</select>`)}
    ${pole('Olej na začátku', cislo(P, 'zacatek.olej', 'min="0" placeholder="10"'))}${pole('Zlato na začátku', cislo(P, 'zacatek.zlato', 'min="0" placeholder="0"'))}</div>
  ${pole('Předměty na začátku', chipsHtml(P, 'zacatek.predmety', 'predmety', '+ předmět', true))}

  <div class="sekce" id="secPredmety">Předměty (${Object.keys(pr).length})</div>
  ${Object.keys(pr).map(k => { const u = E.pouziti(P, k); return `<div class="polozka"><div class="polozka-hlava"><code data-i18n="ne">${esc(k)}</code>
      <button class="btn mini" data-akce="prejmenovatPredmet" data-x="${esc(k)}" title="Přejmenovat klíč všude">✎</button>
      <button class="btn mini nebezpecne" data-akce="smazatPredmet" data-x="${esc(k)}" title="Smazat předmět">🗑</button><span class="pocet">ve scénách: ${u.length}×</span></div>
    <div class="radek">${pole('Název (s emoji)', vstup(P, 'predmety.' + k + '.nazev', 'str', 'data-i18n="ne"'))}${pole('Popis', vstup(P, 'predmety.' + k + '.popis', 'str', 'data-i18n="ne"'))}</div>
    <details class="blok"${pr[k].pouziti ? ' open' : ''}><summary>Použití z torby: <span data-i18n="ne">${esc(souhrnEfektu(pr[k].pouziti))}</span></summary>
      <div class="radek-5">${E.VLASTNOSTI.map(v => pole(NAZVY_VL[v], cislo(P, 'predmety.' + k + '.pouziti.' + v, 'placeholder="±0"'))).join('')}</div>
      <label class="zatrzitko"><input type="checkbox" data-k="predmety.${esc(k)}.spotrebni" data-t="bool"${pr[k].spotrebni ? ' checked' : ''}> Použitím se spotřebuje</label></details>
    ${u.length ? `<details class="blok"><summary>Kde se používá</summary><div class="odkazy">${u.map(o => `<button class="odkaz" data-akce="jdi" data-cil="${esc(o.scena)}">${esc(o.scena)}</button> <span data-i18n="ne">${esc(o.kde)}</span>`).join('<br>')}</div></details>` : ''}
    </div>`; }).join('')}
  <button class="btn" data-akce="novyPredmet">✚ Nový předmět</button>

  <div class="sekce" id="secKonce">Typy konců (${Object.keys(ko).length})</div>
  ${Object.keys(ko).map(k => `<div class="polozka"><div class="polozka-hlava"><code data-i18n="ne">${esc(k)}</code>
      <button class="btn mini" data-akce="prejmenovatKonec" data-x="${esc(k)}" title="Přejmenovat klíč všude">✎</button>
      <button class="btn mini nebezpecne" data-akce="smazatKonec" data-x="${esc(k)}" title="Smazat typ konce">🗑</button><span class="pocet">scén: ${pocetKoncu(k)}</span></div>
    <div class="radek">${pole('Název', vstup(P, 'konce.' + k + '.nazev', 'str', 'data-i18n="ne"'))}
      ${pole('Druh', `<select class="vstup" data-k="konce.${esc(k)}.typ" data-t="str">${[['vyhra', '🏆 dobrý'], ['neutral', '🚪 neutrální'], ['prohra', '💀 zlý']].map(([v, t]) => `<option value="${v}"${ko[k].typ === v ? ' selected' : ''}>${t}</option>`).join('')}</select>`)}
      ${pole('Popis', vstup(P, 'konce.' + k + '.popis', 'str', 'data-i18n="ne"'))}</div></div>`).join('')}
  <button class="btn" data-akce="novyKonec">✚ Nový typ konce</button>
  </div>
  <div data-koren="projekt">
  <div class="sekce">Export</div>
  ${pole('Komentář na začátku souboru .js', `<textarea class="vstup surovy" style="min-height:80px" data-k="hlavicka" data-t="str" placeholder="/* … */ (prázdné = vytvoří se samo)" data-i18n="ne">${esc(proj.hlavicka || '')}</textarea>`)}
  ${pole('Globální proměnná v prohlížeči (window.…)', vstup(proj, 'globalni', 'str', 'placeholder="GAMEBOOK_PRIBEH"'))}
  <p class="popis-pole">Stránky gamebooků čtou <code>window.GAMEBOOK_PRIBEH</code> – nech výchozí, pokud nepíšeš vlastní obálku.</p>
  </div>
  <div class="sekce" id="secSurovy">Celý příběh jako JSON (pokročilé)</div>
  <textarea class="vstup surovy" id="surovyPribeh" spellcheck="false" data-i18n="ne">${esc(JSON.stringify(P, null, 2))}</textarea>
  <div style="margin-top:5px;display:flex;gap:6px;flex-wrap:wrap"><button class="btn" data-akce="pouzitSurovyPribeh">Použít JSON</button><button class="btn" data-akce="obnovSurovyPribeh">↺ Načíst aktuální</button></div>`;
}

/* ---------- události panelu ---------- */
const telo = $('teloPanelu');
function zapisPole(el) {
  const o = koren(el); if (!o) return false;
  const t = el.dataset.t;
  let v = el.value;
  if (t === 'num') {
    if (v.trim() === '') v = undefined;
    else { v = Number(v); if (!Number.isFinite(v)) { el.classList.add('vadne'); return false; } }
    el.classList.remove('vadne');
  } else if (t === 'id') v = v.trim();
  else if (t === 'bool') v = el.checked ? true : undefined;
  if (o === hra.nast) { if (v === undefined || v === '') delete o[el.dataset.k]; else o[el.dataset.k] = v; return false; }
  nastavCestu(o, el.dataset.k, v);
  return true;
}
telo.addEventListener('input', e => {
  const el = e.target;
  if (!el.dataset.k || el.dataset.t === 'id' || el.tagName === 'SELECT' || el.type === 'checkbox') return;
  if (zapisPole(el)) {
    zmena();
    if (el.dataset.k === 'text' && $('pocetSlov')) $('pocetSlov').textContent = (el.value.match(/\S+/g) || []).length + ' slov';
    if (el.dataset.k === 'nazev' && koren(el) === P) { /* název příběhu ≠ název projektu */ }
  } else if (nast.zalozka === 'hra' && !hra.st && el.dataset.k === 'od') vykresliPanel();
});
telo.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.chip) return pridejChip(el);
  const a = el.dataset.akce;
  if (a === 'druhVolby') {
    const v = P.sceny[vybrana].volby[+el.dataset.i];
    const cil = v.cil || (v.zkouska && v.zkouska.uspech) || (v.boj && v.boj.vyhra) || '';
    delete v.cil; delete v.zkouska; delete v.boj;
    if (el.value === 'cil') v.cil = cil;
    else if (el.value === 'zkouska') v.zkouska = { co: 'obratnost', uspech: cil, neuspech: '' };
    else v.boj = { jmeno: 'Soupeř', obratnost: 7, zdravi: 8, vyhra: cil };
    return zmena({ hned: true, panel: true });
  }
  if (a === 'prepBoj') {
    const s = P.sceny[vybrana];
    if (el.checked) s.boj = { jmeno: 'Soupeř', obratnost: 7, zdravi: 8, vyhra: '' }; else delete s.boj;
    return zmena({ hned: true, panel: true });
  }
  if (a === 'sledovat') { nast.sledovat = el.checked; ulozNast(); return; }
  if (!el.dataset.k) return;
  if (el.dataset.t === 'id' && el.closest('[data-koren="hra"]')) { hra.nast[el.dataset.k] = el.value.trim(); return vykresliPanel(); }
  if (zapisPole(el)) zmena({ hned: true, panel: el.tagName === 'SELECT' || el.dataset.t === 'id' || el.type === 'checkbox' });
});
telo.addEventListener('keydown', e => {
  if (e.target.dataset.chip && e.key === 'Enter') { e.preventDefault(); pridejChip(e.target); }
  if (e.target.dataset.chip && e.key === 'Backspace' && !e.target.value) {
    const b = e.target.closest('.chips').querySelectorAll('[data-akce="odeberChip"]');
    if (b.length) b[b.length - 1].click();
  }
});
function hodnotyChips(ch) { return [].concat(ctiCestu(koren(ch), ch.dataset.k) || []); }
function ulozChips(ch, hodn) {
  const o = koren(ch);
  const v = ch.dataset.pole ? hodn : (hodn.length === 0 ? undefined : hodn.length === 1 ? hodn[0] : hodn);
  if (o === hra.nast) { hra.nast[ch.dataset.k] = hodn; vykresliPanel(); return; }
  if (ch.dataset.pole && !hodn.length) nastavCestu(o, ch.dataset.k, []); else nastavCestu(o, ch.dataset.k, v);
  zmena({ hned: true, panel: true });
}
function pridejChip(inp) {
  const nove = inp.value.split(/[,;]/).map(x => x.trim()).filter(Boolean);
  if (!nove.length) return;
  const ch = inp.closest('.chips');
  const k = ch.dataset.k;
  ulozChips(ch, hodnotyChips(ch).concat(nove));
  setTimeout(() => { const n = telo.querySelector(`.chips[data-k="${CSS.escape(k)}"] input`); if (n) n.focus(); }, 0);
}
telo.addEventListener('click', async e => {
  const b = e.target.closest('[data-akce]');
  if (!b || b.disabled || b.tagName === 'SELECT' || b.type === 'checkbox') return;
  const a = b.dataset.akce, s = vybrana && P.sceny[vybrana], i = +b.dataset.i;
  switch (a) {
    case 'odeberChip': { const ch = b.closest('.chips'); const h = hodnotyChips(ch); h.splice(i, 1); ulozChips(ch, h); break; }
    case 'jdi': if (P.sceny[b.dataset.cil]) { const z = nast.zalozka; vyber(b.dataset.cil); if (z === 'hra') { nast.zalozka = 'scena'; vykresliPanel(); } naScenu(b.dataset.cil); } break;
    case 'novaCil': {
      const o = koren(b);
      if (o === hra.nast) break;
      const id = novaScena({ bezVyberu: true, text: '' });
      nastavCestu(o, b.dataset.k, id);
      zmena({ hned: true, panel: true });
      break;
    }
    case 'novaScena': novaScena(); break;
    case 'pridatVolbu': (s.volby = s.volby || []).push({ text: '', cil: '' }); zmena({ hned: true, panel: true }); fokusPosledniVolba(); break;
    case 'pridatVolbuNova': { const id = novaScena({ bezVyberu: true }); (s.volby = s.volby || []).push({ text: 'Pokračovat', cil: id }); zmena({ hned: true, panel: true }); fokusPosledniVolba(); break; }
    case 'volbaNahoru': case 'volbaDolu': { const j = a === 'volbaNahoru' ? i - 1 : i + 1; [s.volby[i], s.volby[j]] = [s.volby[j], s.volby[i]]; zmena({ hned: true, panel: true }); break; }
    case 'volbaKopie': s.volby.splice(i + 1, 0, E.kopie(s.volby[i])); zmena({ hned: true, panel: true }); break;
    case 'volbaSmaz': s.volby.splice(i, 1); if (!s.volby.length) delete s.volby; zmena({ hned: true, panel: true }); break;
    case 'prejmenovatScenu': prejmenujScenu(); break;
    case 'duplikovatScenu': duplikujScenu(); break;
    case 'smazatScenu': smazScenu(); break;
    case 'nastavitStart': prikaz('nastavitStart'); break;
    case 'hratOdtud': hra.nast.od = vybrana; startHry(); break;
    case 'pouzitSurovyScena': {
      try {
        const d = JSON.parse($('surovyScena').value);
        if (!d || typeof d !== 'object' || Array.isArray(d)) throw new Error('Scéna musí být objekt.');
        if (d.volby != null && !Array.isArray(d.volby)) throw new Error('„volby“ musí být pole.');
        P.sceny[vybrana] = d; zmena({ hned: true, panel: true }); Dialog.info('Scéna nahrazena.');
      } catch (er) { Dialog.chyba('Neplatný JSON: ' + er.message); }
      break;
    }
    case 'pouzitSurovyPribeh': {
      try {
        const d = JSON.parse($('surovyPribeh').value);
        const v = E.kontrolaTvaru(d); if (v) throw new Error(v);
        proj.pribeh = P = d; if (vybrana && !P.sceny[vybrana]) vybrana = null;
        zmena({ hned: true, panel: true }); Dialog.info('Příběh nahrazen.');
      } catch (er) { Dialog.chyba('Neplatný JSON: ' + er.message); }
      break;
    }
    case 'obnovSurovyPribeh': $('surovyPribeh').value = JSON.stringify(P, null, 2); break;
    case 'filtr': filtrNalezu = b.dataset.f; vykresliPanel(); break;
    case 'simulovat': b.disabled = true; b.textContent = '🎲 Hraju…'; setTimeout(() => { simulace = E.simuluj(E.kopie(P), J, { her: 500, seed: 7 }); vykresliPanel(); }, 20); break;
    case 'startHry': startHry(); break;
    case 'hraNastaveni': hra.st = null; vykresliPanel(); break;
    case 'hraVybrana': hra.nast.od = vybrana || P.start; vykresliPanel(); break;
    case 'hraVychozi': hra.nast = { od: hra.nast.od, seed: 1, predmety: null, priznaky: [] }; vykresliPanel(); break;
    case 'hraVolba': krokHry(() => J.zvol(hra.st, hra.p, i)); break;
    case 'hraKolo': krokHry(() => ({ kolo: J.koloBoje(hra.st, hra.p) })); break;
    case 'hraDobojuj': krokHry(() => { let k; for (let n = 0; hra.st.boj && n < 200; n++) k = J.koloBoje(hra.st, hra.p); return { kolo: k }; }); break;
    case 'hraUtek': krokHry(() => { J.utec(hra.st, hra.p); return null; }); break;
    case 'hraPouzij': krokHry(() => ({ zmeny: J.pouzij(hra.st, hra.p, b.dataset.x) })); break;
    case 'novyPredmet': {
      const k = await Dialog.zeptej('Klíč nového předmětu (bez diakritiky, např. klic_brana):', '', { ok: 'Přidat' });
      if (!k) break;
      if (!/^[\w-]+$/.test(k.trim())) { Dialog.chyba('Klíč smí obsahovat jen písmena bez diakritiky, číslice, _ a -.'); break; }
      P.predmety = P.predmety || {};
      if (P.predmety[k.trim()]) { Dialog.chyba('Předmět už existuje.'); break; }
      P.predmety[k.trim()] = { nazev: k.trim(), popis: '' };
      zmena({ hned: true, panel: true });
      break;
    }
    case 'prejmenovatPredmet': case 'prejmenovatKonec': {
      const st = b.dataset.x;
      const k = await Dialog.zeptej('Nový klíč (přepíše se všude v příběhu):', st, { ok: 'Přejmenovat' });
      if (!k || k.trim() === st) break;
      if (!/^[\w-]+$/.test(k.trim())) { Dialog.chyba('Klíč smí obsahovat jen písmena bez diakritiky, číslice, _ a -.'); break; }
      try { const n = (a === 'prejmenovatPredmet' ? E.prejmenujPredmet : E.prejmenujKonec)(P, st, k.trim()); zmena({ hned: true, panel: true }); Dialog.info('Upraveno míst: ' + n); }
      catch (er) { Dialog.chyba(er.message); }
      break;
    }
    case 'smazatPredmet': {
      const u = E.pouziti(P, b.dataset.x);
      if (!(await Dialog.potvrd('Smazat předmět „' + b.dataset.x + '“?' + (u.length ? ' Používá se na ' + u.length + ' místech – kontrola je pak ukáže.' : ''), { ok: 'Smazat', zrus: 'Ponechat' }))) break;
      delete P.predmety[b.dataset.x]; zmena({ hned: true, panel: true });
      break;
    }
    case 'novyKonec': {
      const k = await Dialog.zeptej('Klíč nového typu konce (bez diakritiky):', '', { ok: 'Přidat' });
      if (!k) break;
      if (!/^[\w-]+$/.test(k.trim())) { Dialog.chyba('Klíč smí obsahovat jen písmena bez diakritiky, číslice, _ a -.'); break; }
      P.konce = P.konce || {};
      if (P.konce[k.trim()]) { Dialog.chyba('Typ konce už existuje.'); break; }
      P.konce[k.trim()] = { nazev: k.trim(), typ: 'neutral', popis: '' };
      zmena({ hned: true, panel: true });
      break;
    }
    case 'smazatKonec': {
      if (!(await Dialog.potvrd('Smazat typ konce „' + b.dataset.x + '“?', { ok: 'Smazat', zrus: 'Ponechat' }))) break;
      delete P.konce[b.dataset.x]; zmena({ hned: true, panel: true });
      break;
    }
  }
});
function fokusPosledniVolba() {
  setTimeout(() => { const v = telo.querySelectorAll('.volba'); const p = v[v.length - 1]; if (p) { p.scrollIntoView({ block: 'nearest' }); p.querySelector('input').focus(); } }, 20);
}

/* =========================================================
   Lišta, nabídky, příkazy
   ========================================================= */
function zavriNabidky() {
  document.querySelectorAll('.nabidka:not([hidden])').forEach(n => { n.hidden = true; });
  document.querySelectorAll('[data-nabidka][aria-expanded="true"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
}
document.querySelectorAll('[data-nabidka]').forEach(b => b.addEventListener('click', e => {
  e.stopPropagation();
  const n = $(b.dataset.nabidka), bylo = !n.hidden;
  zavriNabidky();
  if (bylo) return;
  prepinace();
  n.hidden = false; b.setAttribute('aria-expanded', 'true');
  const r = b.getBoundingClientRect();
  n.style.top = (r.bottom + 4) + 'px';
  n.style.left = Math.max(6, Math.min(r.left, innerWidth - n.offsetWidth - 6)) + 'px';
}));
document.addEventListener('click', e => {
  const v = e.target.closest('[data-vestaveny]');
  if (v) { zavriNabidky(); return importVestaveny(v.dataset.vestaveny); }
  const b = e.target.closest('.lista [data-prikaz], .nabidka [data-prikaz], .zoom [data-prikaz]');
  if (b && !b.disabled) { e.stopPropagation(); zavriNabidky(); return prikaz(b.dataset.prikaz); }
  if (!e.target.closest('.nabidka')) zavriNabidky();
});
function prepinace() {
  $('prepDolu').setAttribute('aria-pressed', String(nast.smer === 'dolu'));
  $('prepVpravo').setAttribute('aria-pressed', String(nast.smer === 'vpravo'));
  $('prepMinimapa').setAttribute('aria-pressed', String(nast.minimapa));
  $('prepLegenda').setAttribute('aria-pressed', String(nast.legenda));
  $('prepSousede').setAttribute('aria-pressed', String(nast.sousede));
  $('legenda').hidden = !nast.legenda;
}
function rozloz() { proj.pozice = E.rozloz(P, { smer: nast.smer }); zmena({ hned: true }); kresliHned(false); prizpusob(); }
function sekcePribehu(id) { prepniZalozku('pribeh'); setTimeout(() => { const el = $(id); if (el) el.scrollIntoView({ block: 'start' }); }, 20); }
async function prikaz(p) {
  switch (p) {
    case 'novaScena': return novaScena();
    case 'novaVolba': if (vybrana) { const s = P.sceny[vybrana]; (s.volby = s.volby || []).push({ text: '', cil: '' }); nast.zalozka = 'scena'; zmena({ hned: true, panel: true }); fokusPosledniVolba(); } return;
    case 'duplikovatScenu': return duplikujScenu();
    case 'prejmenovatScenu': return prejmenujScenu();
    case 'smazatScenu': return smazScenu();
    case 'nastavitStart': if (vybrana) { P.start = vybrana; zmena({ hned: true, panel: true }); } return;
    case 'precislovat': return precisluj();
    case 'zpet': return zpet();
    case 'znovu': return znovu();
    case 'prizpusob': return prizpusob();
    case 'naVybranou': return vybrana && naScenu(vybrana);
    case 'priblizit': case 'oddalit': { const r = svg.getBoundingClientRect(); return zoomKolem(p === 'priblizit' ? 1.25 : 0.8, r.width / 2, r.height / 2); }
    case 'rozlozit': return rozloz();
    case 'smerDolu': case 'smerVpravo': nast.smer = p === 'smerDolu' ? 'dolu' : 'vpravo'; ulozNast(); prepinace(); return rozloz();
    case 'prepMinimapa': nast.minimapa = !nast.minimapa; ulozNast(); prepinace(); return kresliMinimapu();
    case 'prepLegenda': nast.legenda = !nast.legenda; ulozNast(); return prepinace();
    case 'prepSousede': nast.sousede = !nast.sousede; ulozNast(); prepinace(); return kresliPozdeji(false);
    case 'kontrola': return prepniZalozku('kontrola');
    case 'hratOdVybrane': hra.nast.od = vybrana || P.start; return startHry();
    case 'hratOdStartu': hra.nast.od = P.start; return startHry();
    case 'pribehVlastnosti': return sekcePribehu('secVlastnosti');
    case 'pribehPredmety': return sekcePribehu('secPredmety');
    case 'pribehKonce': return sekcePribehu('secKonce');
    case 'pribehSurovy': return sekcePribehu('secSurovy');
    case 'napoveda': return $('dlgPomoc').showModal();
    case 'otevritProjekt': await seznamProjektu(); return $('dlgProjekty').showModal();
    case 'novyProjekt': return vytvorAOtevri(E.prazdnyPribeh(), { nazev: 'Nový příběh' });
    case 'prejmenovatProjekt': {
      const n = await Dialog.zeptej('Název projektu:', proj.nazev, { ok: 'Uložit' });
      if (n && n.trim()) { proj.nazev = n.trim(); ulozHned(); }
      return;
    }
    case 'duplikovatProjekt': {
      const pr = Object.assign(E.kopie(proj), { id: 'p' + Date.now().toString(36), nazev: proj.nazev + ' (kopie)', vytvoreno: Date.now() });
      await dbUloz(pr); await otevri(pr); return Dialog.info('Vytvořena kopie projektu.');
    }
    case 'smazatProjekt': {
      if (!(await Dialog.potvrd('Smazat projekt „' + proj.nazev + '“? Nejde to vrátit.', { ok: 'Smazat', zrus: 'Ponechat' }))) return;
      const id = proj.id; clearTimeout(tUloz); proj = null;
      await dbSmaz(id);
      const zbyle = (await dbVsechny()).sort((a, b) => b.upraveno - a.upraveno);
      return zbyle.length ? otevri(zbyle[0]) : vytvorAOtevri(E.prazdnyPribeh(), { nazev: 'Nový příběh' });
    }
    case 'nacistSoubor': return $('soubor').click();
    case 'exportJs': return stahni(exportJs(), jmenoSouboru() + '.js', 'text/javascript');
    case 'exportJson': return stahni(E.doJson(P), jmenoSouboru() + '.json', 'application/json');
    case 'kopirovatJs':
      try { await navigator.clipboard.writeText(exportJs()); Dialog.info('Zkopírováno do schránky.'); }
      catch (e) { Dialog.chyba('Schránka není dostupná – použij stažení souboru.'); }
      return;
  }
}
$('soubor').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = '';
  if (f) importText(await f.text(), f.name.replace(/\.(js|json)$/i, ''));
});
let dropCit = 0;
addEventListener('dragenter', e => { if ([...(e.dataTransfer.types || [])].includes('Files')) { dropCit++; $('drop').classList.add('zobraz'); } });
addEventListener('dragleave', () => { if (--dropCit <= 0) { dropCit = 0; $('drop').classList.remove('zobraz'); } });
addEventListener('dragover', e => e.preventDefault());
addEventListener('drop', async e => {
  e.preventDefault(); dropCit = 0; $('drop').classList.remove('zobraz');
  const f = e.dataTransfer.files[0];
  if (f) importText(await f.text(), f.name.replace(/\.(js|json)$/i, ''));
});

/* ---------- klávesy ---------- */
addEventListener('keydown', e => {
  const t = e.target, vPoli = t.closest && t.closest('input, textarea, select, [contenteditable]');
  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && e.key.toLowerCase() === 's') { e.preventDefault(); if (tZapis) zapisHistorie(); ulozHned(); Dialog.info('Uloženo.'); return; }
  if (e.key === 'Escape' && document.querySelector('.nabidka:not([hidden])')) return zavriNabidky();
  if (e.key === 'F1') { e.preventDefault(); return prikaz('napoveda'); }
  if (document.querySelector('dialog[open]')) return;
  if (vPoli) return;
  if (ctrl && !e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); return zpet(); }
  if (ctrl && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) { e.preventDefault(); return znovu(); }
  if (ctrl && e.key.toLowerCase() === 'd') { e.preventDefault(); return duplikujScenu(); }
  if (ctrl || e.altKey) return;
  const k = e.key;
  if (k === 'n' || k === 'N') { e.preventDefault(); return novaScena(); }
  if (k === 'Delete') return smazScenu();
  if (k === 'F2') { e.preventDefault(); return prejmenujScenu(); }
  if (k === 'f' || k === 'F') return prizpusob();
  if (k === 'c' || k === 'C') return vybrana && naScenu(vybrana);
  if (k === 'l' || k === 'L') return rozloz();
  if (k === 'p' || k === 'P') return prikaz('hratOdVybrane');
  if (k === '/') { e.preventDefault(); return $('hledat').focus(); }
  if (k === '+' || k === '=') return prikaz('priblizit');
  if (k === '-' || k === '−') return prikaz('oddalit');
  if (k === '?') return prikaz('napoveda');
});
addEventListener('beforeunload', () => { if (tZapis) zapisHistorie(); if (proj && tUloz) ulozHned(); });

/* ---------- start ---------- */
(async function start() {
  prepinace();
  try {
    let pr = nast.posledni ? await dbNacti(nast.posledni) : null;
    if (!pr) { const vse = (await dbVsechny()).sort((a, b) => b.upraveno - a.upraveno); pr = vse[0]; }
    if (pr) await otevri(pr);
    else await importVestaveny('pribeh');
  } catch (e) {
    Dialog.chyba('Úložiště projektů není dostupné (' + e.message + ') – práce se neuloží.');
    const pr = novyProjektObj(E.prazdnyPribeh());
    proj = pr; P = pr.pribeh; vybrana = P.start; hist.vymaz(snimek()); kresliHned(true); prizpusob(); vykresliPanel();
  }
})();
window.GamebookEditor = { get projekt() { return proj; }, get pribeh() { return P; }, vyber, prikaz, startHry, get hra() { return hra; }, get pohled() { return pohled; }, analyza: () => analyza };
})();

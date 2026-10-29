/* ============================================================
   GENERÁTOR KARET – uživatelské rozhraní
   Stav: P = otevřený projekt (šablona + data + nastavení archu).
   Projekty a obrázky v IndexedDB „webapp_karty_generator“,
   v localStorage jen poslední projekt a pohled.
   ============================================================ */
(function () {
'use strict';
const K = window.KARTY, KR = window.KARTY_KRESBA, VY = window.KARTY_VYSTUP, PREDLOHY = window.KARTY_PREDLOHY;
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const KLIC_STAV = 'webapp_karty_generator_stav';
const DB_JMENO = 'webapp_karty_generator';

let P = null;                      // otevřený projekt
const stav = { pohled: 'navrh', strana: 'lic', vybrana: null, radek: 0 };

/* ---------- IndexedDB ---------- */
let dbSlib = null;
function db() {
  if (!dbSlib) dbSlib = new Promise((ok, chyba) => {
    const r = indexedDB.open(DB_JMENO, 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore('projekty', { keyPath: 'id' });
      r.result.createObjectStore('obrazky', { keyPath: 'jmeno' });
    };
    r.onsuccess = () => ok(r.result); r.onerror = () => chyba(r.error);
  });
  return dbSlib;
}
async function idb(store, akce, hodnota) {
  const d = await db();
  return new Promise((ok, chyba) => {
    const t = d.transaction(store, akce === 'get' || akce === 'getAll' ? 'readonly' : 'readwrite');
    const r = t.objectStore(store)[akce](hodnota);
    r.onsuccess = () => ok(r.result); r.onerror = () => chyba(r.error);
  });
}
function ctiStav() { try { return JSON.parse(localStorage.getItem(KLIC_STAV)) || {}; } catch (e) { return {}; } }
function zapisStav(zmena) { try { localStorage.setItem(KLIC_STAV, JSON.stringify(Object.assign(ctiStav(), zmena))); } catch (e) { /* plné úložiště nevadí */ } }

/* ---------- písma (OFL z obsah/fonty) ---------- */
const PISMA = [
  ['sans-serif', 'Bezpatkové (systém)'], ['serif', 'Patkové (systém)'], ['monospace', 'Strojové (systém)'],
  ['Liberation Sans Bold', 'LiberationSans-Bold.ttf'], ['Liberation Serif Bold', 'LiberationSerif-Bold.ttf'],
  ['Bebas Neue', 'BebasNeue-Regular.ttf'], ['Anton', 'Anton-Regular.ttf'], ['Cinzel Decorative', 'CinzelDecorative-Bold.ttf'],
  ['MedievalSharp', 'MedievalSharp.ttf'], ['Marcellus', 'Marcellus-Regular.ttf'], ['Fondamento', 'Fondamento-Regular.ttf'],
  ['Pirata One', 'PirataOne-Regular.ttf'], ['Uncial Antiqua', 'UncialAntiqua-Regular.ttf'], ['Bangers', 'Bangers-Regular.ttf'],
  ['Luckiest Guy', 'LuckiestGuy-Regular.ttf'], ['Lobster', 'Lobster-Regular.ttf'], ['Patrick Hand', 'PatrickHand-Regular.ttf'],
  ['Special Elite', 'SpecialElite-Regular.ttf'], ['Righteous', 'Righteous-Regular.ttf'], ['Press Start 2P', 'PressStart2P-Regular.ttf'],
  ['VT323', 'VT323-Regular.ttf'], ['Space Mono', 'SpaceMono-Bold.ttf']
];
const SOUBOR_PISMA = new Map(PISMA.filter(p => p[1].endsWith('.ttf')).map(p => p));
const nactenaPisma = new Map();
function zajistiPisma(pr = P) {
  const pouzite = new Set();
  [...pr.lic.vrstvy, ...pr.rub.vrstvy].forEach(v => { if (v.pismo) pouzite.add(v.pismo); });
  pr.podminky.forEach(p => { if (p.vlastnost === 'pismo') pouzite.add(p.nastav); });
  const sliby = [];
  pouzite.forEach(r => {
    const soubor = SOUBOR_PISMA.get(r);
    if (!soubor) return;
    if (!nactenaPisma.has(r)) {
      const ff = new FontFace(r, `url(fonty/${soubor})`);
      nactenaPisma.set(r, ff.load().then(f => { document.fonts.add(f); }).catch(() => {}));
    }
    sliby.push(nactenaPisma.get(r));
  });
  return Promise.all(sliby);
}

/* ---------- knihovna obrázků ---------- */
const obrazky = new Map();          // jméno → { blob, bmp }
async function nactiKnihovnu() {
  const vse = await idb('obrazky', 'getAll');
  for (const z of vse) {
    try { obrazky.set(z.jmeno, { blob: z.blob, bmp: await createImageBitmap(z.blob) }); } catch (e) { /* poškozený obrázek přeskočit */ }
  }
}
async function pridejObrazky(soubory) {
  let n = 0;
  for (const f of soubory) {
    if (!/^image\//.test(f.type)) continue;
    try {
      const bmp = await createImageBitmap(f);
      const blob = new Blob([await f.arrayBuffer()], { type: f.type });
      await idb('obrazky', 'put', { jmeno: f.name, blob, typ: f.type });
      obrazky.set(f.name, { blob, bmp });
      n++;
    } catch (e) { Dialog.chyba('Obrázek ' + f.name + ' nejde načíst.'); }
  }
  if (n) { Dialog.info(`Do knihovny přidáno ${n} ${n === 1 ? 'obrázek' : n < 5 ? 'obrázky' : 'obrázků'}.`); prekresli(); if (stav.pohled === 'tisk') obnovTisk(); }
  return n;
}
function obrazekPodleJmena(src) {
  const j = K.najdiObrazek(src, [...obrazky.keys()]);
  return j ? obrazky.get(j).bmp : null;
}

/* ---------- historie a ukládání ---------- */
let zpet = [], vpred = [], cekaZaznam = false, casUlozeni = null;
function zaznam() {           // volat PŘED změnou; rychlé série změn se slijí do jednoho kroku
  if (!cekaZaznam) {
    zpet.push(JSON.stringify(P)); if (zpet.length > 80) zpet.shift();
    vpred = []; cekaZaznam = true;
    setTimeout(() => { cekaZaznam = false; }, 700);
  }
  ulozPozdeji();
  tlacitkaHistorie();
}
function tlacitkaHistorie() { $('tlZpet').disabled = !zpet.length; $('tlVpred').disabled = !vpred.length; }
function krokHistorie(z, do_) {
  if (!z.length) return;
  do_.push(JSON.stringify(P));
  P = JSON.parse(z.pop());
  cekaZaznam = false;
  obnovVse(); ulozPozdeji(); tlacitkaHistorie();
}
function ulozPozdeji() { clearTimeout(casUlozeni); casUlozeni = setTimeout(ulozTed, 600); }
async function ulozTed() {
  clearTimeout(casUlozeni);
  try { await idb('projekty', 'put', { id: P.id, nazev: P.nazev, upraveno: Date.now(), projekt: P }); zapisStav({ posledni: P.id }); }
  catch (e) { Dialog.chyba('Projekt se nepodařilo uložit: ' + e.message); }
}
function otevriProjekt(p, bezHistorie) {
  P = p;
  if (!P.id) P.id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  if (!bezHistorie) { zpet = []; vpred = []; }
  stav.vybrana = null; stav.radek = 0; stav.strana = 'lic';
  obnovVse(); tlacitkaHistorie(); ulozTed();
}

/* ---------- vyhodnocení a kreslení karty ---------- */
function poradiRadku(i, pr = P) {
  const b = K.balicek(pr.data);
  return { poradi: Math.max(1, b.findIndex(k => k.radek === i) + 1), celkem: b.length };
}
function strana(kt, i, pr = P) {
  const radek = i >= 0 && i < pr.data.radky.length ? K.radekObjekt(pr.data, i) : {};
  return K.vyhodnotStranu(pr[kt], pr.podminky, radek, poradiRadku(i, pr));
}
/* nové plátno s kartou; o = { mm, spadavka, rohy, voditka, vybrana, otocit } */
function platnoKarty(kt, i, o, pr = P) {
  const b = o.spadavka ? (+pr.karta.spadavka || 0) : 0;
  const c = document.createElement('canvas');
  c.width = Math.round((pr.karta.w + 2 * b) * o.mm); c.height = Math.round((pr.karta.h + 2 * b) * o.mm);
  const vysl = KR.kresli(c.getContext('2d'), strana(kt, i, pr), pr.karta, Object.assign({ obrazek: obrazekPodleJmena }, o));
  return { platno: o.otocit ? KR.otoc(c) : c, vysl };
}
function natocRub(kt, c) {
  return kt === 'rub' && K.rubVzhuruNohama(K.rozloz(P.karta, P.arch), P.arch.preklapeni) ? KR.otoc180(c) : c;
}
async function kartaProExport(kt, i, spadavka) {
  await zajistiPisma();
  return natocRub(kt, platnoKarty(kt, i, { mm: (+P.arch.dpi || 300) / 25.4, spadavka, rohy: true, otocit: P.arch.otocit }).platno);
}

/* ---------- NÁVRH: náhled ---------- */
const platno = $('platno');
let metrika = null;       // převod px ↔ mm pro myš
async function prekresli() {
  if (!P || stav.pohled !== 'navrh') return;
  await zajistiPisma();
  const obal = $('platnoObal'), b = +P.karta.spadavka || 0;
  const cw = P.karta.w + 2 * b, ch = P.karta.h + 2 * b;
  const dostupW = Math.max(160, obal.clientWidth - 28), dostupH = Math.max(220, obal.clientHeight - 28);
  const meritko = Math.min(dostupW / cw, dostupH / ch, 9), dpr = window.devicePixelRatio || 1;
  platno.width = Math.round(cw * meritko * dpr); platno.height = Math.round(ch * meritko * dpr);
  platno.style.width = (cw * meritko) + 'px'; platno.style.height = (ch * meritko) + 'px';
  const pocet = P.data.radky.length;
  if (stav.radek >= pocet) stav.radek = Math.max(0, pocet - 1);
  const i = pocet ? stav.radek : -1;
  const ctx = platno.getContext('2d');
  const vysl = KR.kresli(ctx, strana(stav.strana, i), P.karta, { mm: meritko * dpr, spadavka: true, voditka: $('ukazVoditka').checked, vybrana: stav.vybrana, obrazek: obrazekPodleJmena });
  metrika = { meritko, b };
  $('cisloKarty').textContent = pocet ? `řádek ${i + 1} / ${pocet}` : 'bez dat';
  const zpravy = [];
  if (vysl.pretekaji.length) zpravy.push('⚠ text přetéká (' + vysl.pretekaji.map(id => (najdiVrstvu(id) || {}).nazev || id).join(', ') + ')');
  if (vysl.chybi.length) zpravy.push('🖼 chybí obrázek: ' + vysl.chybi.join(', '));
  if (P.rubRezim === 'ne' && stav.strana === 'rub') zpravy.push('Rub je vypnutý (Karta → Rub).');
  $('stavKarty').textContent = zpravy.join(' · ');
}
function najdiVrstvu(id) { return P.lic.vrstvy.find(v => v.id === id) || P.rub.vrstvy.find(v => v.id === id); }
function vrstvyStrany() { return P[stav.strana].vrstvy; }
function vybrana() { return vrstvyStrany().find(v => v.id === stav.vybrana) || null; }

/* myš v náhledu: výběr, posun, změna velikosti */
let tah = null;
function bodMm(e) {
  const r = platno.getBoundingClientRect();
  return { x: (e.clientX - r.left) / metrika.meritko - metrika.b, y: (e.clientY - r.top) / metrika.meritko - metrika.b };
}
const zaokr = (n, krok) => Math.round(n / krok) * krok;
platno.addEventListener('pointerdown', e => {
  if (!metrika) return;
  const m = bodMm(e), v = vybrana(), uchyt = 8 / metrika.meritko;
  if (v && v.typ !== 'ramecek' && !+v.otoceni && Math.abs(m.x - (v.x + v.w)) < uchyt && Math.abs(m.y - (v.y + v.h)) < uchyt) {
    tah = { druh: 'velikost', v, m, x: v.w, y: v.h };
  } else {
    const zasah = [...vrstvyStrany()].reverse().find(z => z.typ !== 'ramecek' && !z.skryta && m.x >= z.x && m.x <= z.x + z.w && m.y >= z.y && m.y <= z.y + z.h);
    stav.vybrana = zasah ? zasah.id : null;
    obnovVrstvy(); obnovVlastnosti();
    if (zasah) tah = { druh: 'posun', v: zasah, m, x: zasah.x, y: zasah.y };
    prekresli();
  }
  if (tah) { try { platno.setPointerCapture(e.pointerId); } catch (_) { /* syntetická událost */ } tah.zaznamenano = false; }
});
platno.addEventListener('pointermove', e => {
  if (!metrika) return;
  const m = bodMm(e);
  if (!tah) {
    const v = vybrana(), uchyt = 8 / metrika.meritko;
    platno.style.cursor = v && v.typ !== 'ramecek' && Math.abs(m.x - (v.x + v.w)) < uchyt && Math.abs(m.y - (v.y + v.h)) < uchyt ? 'nwse-resize' : 'default';
    return;
  }
  const dx = m.x - tah.m.x, dy = m.y - tah.m.y;
  if (!tah.zaznamenano) { if (Math.hypot(dx, dy) < 0.4) return; zaznam(); tah.zaznamenano = true; }
  const krok = e.shiftKey ? 0.1 : 0.5;
  if (tah.druh === 'posun') { tah.v.x = zaokr(tah.x + dx, krok); tah.v.y = zaokr(tah.y + dy, krok); }
  else { tah.v.w = Math.max(1, zaokr(tah.x + dx, krok)); tah.v.h = Math.max(1, zaokr(tah.y + dy, krok)); }
  prekresli(); obnovPolohu();
});
platno.addEventListener('pointerup', () => { tah = null; });
platno.addEventListener('pointercancel', () => { tah = null; });

/* ---------- NÁVRH: panel karty ---------- */
function poleBarvy(hodnota, data) {
  const hex = /^#[0-9a-f]{6}$/i.test(hodnota || '') ? hodnota : '#000000';
  return `<div class="barva"><input class="vstup" type="text" value="${esc(hodnota)}" ${data} placeholder="#rrggbb, {sloupec} nebo prázdné" style="flex:1"><input type="color" value="${hex}" ${data} data-picker="1" aria-label="Vybrat barvu"></div>`;
}
function obnovKartu() {
  const k = P.karta;
  $('kFormat').value = K.FORMATY[k.format] ? k.format : 'vlastni';
  $('kW').value = k.w; $('kH').value = k.h; $('kB').value = k.spadavka; $('kS').value = k.bezpecna; $('kR').value = k.zaobleni;
  $('kRub').value = P.rubRezim;
  $('kPozadi').innerHTML = poleBarvy(P[stav.strana].pozadi, 'data-pozadi="1"');
  $('nazevProjektu').textContent = P.nazev;
  document.title = '🎴 ' + P.nazev + ' – Generátor karet';
}
$('kFormat').innerHTML = Object.entries(K.FORMATY).map(([k, f]) => `<option value="${k}">${f.n}</option>`).join('');
$('kFormat').addEventListener('change', e => {
  zaznam();
  const f = K.FORMATY[e.target.value];
  P.karta.format = e.target.value;
  if (f.w) { P.karta.w = f.w; P.karta.h = f.h; }
  obnovKartu(); prekresli();
});
[['kW', 'w'], ['kH', 'h'], ['kB', 'spadavka'], ['kS', 'bezpecna'], ['kR', 'zaobleni']].forEach(([id, k]) => $(id).addEventListener('input', e => {
  const v = parseFloat(e.target.value);
  if (isNaN(v) || ((k === 'w' || k === 'h') && v < 10)) return;
  zaznam(); P.karta[k] = v;
  if (k === 'w' || k === 'h') { P.karta.format = 'vlastni'; $('kFormat').value = 'vlastni'; }
  prekresli();
}));
$('kRub').addEventListener('change', e => { zaznam(); P.rubRezim = e.target.value; prekresli(); });
$('kPozadi').addEventListener('input', e => {
  zaznam(); P[stav.strana].pozadi = e.target.value;
  const druhe = $('kPozadi').querySelector(e.target.dataset.picker ? 'input[type=text]' : 'input[type=color]');
  if (e.target.dataset.picker) druhe.value = e.target.value; else if (/^#[0-9a-f]{6}$/i.test(e.target.value)) druhe.value = e.target.value;
  prekresli();
});

/* ---------- NÁVRH: seznam vrstev ---------- */
const IKONY_TYPU = { text: '🔤', ikona: '⭐', obrazek: '🖼', tvar: '⬛', ramecek: '🔲' };
function obnovVrstvy() {
  $('stranaVrstev').textContent = stav.strana === 'lic' ? '· líc' : '· rub';
  const vr = vrstvyStrany();
  $('seznamVrstev').innerHTML = vr.length ? [...vr].map((v, i) => ({ v, i })).reverse().map(({ v, i }) =>
    `<li data-id="${v.id}" class="${v.id === stav.vybrana ? 'vybrana' : ''}${v.skryta === true ? ' skryta' : ''}" tabindex="0">
      <span aria-hidden="true">${IKONY_TYPU[v.typ]}</span><span class="jm">${esc(v.nazev || v.typ)}</span>
      <button data-akce="nahoru" title="Výš (navrch)" aria-label="Posunout výš" ${i === vr.length - 1 ? 'disabled' : ''}>▲</button>
      <button data-akce="dolu" title="Níž" aria-label="Posunout níž" ${i === 0 ? 'disabled' : ''}>▼</button>
      <button data-akce="oko" title="Skrýt / zobrazit" aria-label="Skrýt nebo zobrazit">${v.skryta === true ? '🙈' : '👁'}</button></li>`).join('')
    : '<li class="napoveda-mala">Zatím žádné vrstvy – přidej je tlačítkem ➕.</li>';
}
$('seznamVrstev').addEventListener('click', e => {
  const li = e.target.closest('li[data-id]');
  if (!li) return;
  const vr = vrstvyStrany(), i = vr.findIndex(v => v.id === li.dataset.id), akce = e.target.closest('button')?.dataset.akce;
  if (akce === 'nahoru' && i < vr.length - 1) { zaznam(); [vr[i], vr[i + 1]] = [vr[i + 1], vr[i]]; }
  else if (akce === 'dolu' && i > 0) { zaznam(); [vr[i], vr[i - 1]] = [vr[i - 1], vr[i]]; }
  else if (akce === 'oko') { zaznam(); vr[i].skryta = vr[i].skryta === true ? false : true; }
  stav.vybrana = li.dataset.id;
  obnovVrstvy(); obnovVlastnosti(); prekresli();
});
$('seznamVrstev').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.dataset.id) e.target.click(); });

function pridejVrstvu(typ) {
  zaznam();
  const k = P.karta, prepis = {};
  if (typ !== 'ramecek') {                       // nová vrstva doprostřed bezpečné zóny
    const s = +k.bezpecna || 0, d = K.VYCHOZI_VRSTVY[typ];
    prepis.w = Math.min(d.w, k.w - 2 * s); prepis.h = Math.min(d.h, k.h - 2 * s);
    prepis.x = (k.w - prepis.w) / 2; prepis.y = (k.h - prepis.h) / 2;
    if (typ === 'text') prepis.text = P.data.sloupce[0] && !K.SLOUPCE_POCTU.includes(P.data.sloupce[0].toLowerCase()) ? '{' + P.data.sloupce[0] + '}' : 'Text';
  }
  const v = K.novaVrstva(typ, prepis);
  if (typ === 'ramecek') vrstvyStrany().unshift(v); else vrstvyStrany().push(v);
  stav.vybrana = v.id;
  ukazPohled('navrh'); obnovVrstvy(); obnovVlastnosti(); prekresli();
}
function duplikuj() {
  const v = vybrana(); if (!v) return;
  zaznam();
  const n = Object.assign(K.kopie(v), { id: K.noveId(v.typ.slice(0, 2)), nazev: (v.nazev || v.typ) + ' (kopie)' });
  if (n.typ !== 'ramecek') { n.x += 2; n.y += 2; }
  const vr = vrstvyStrany(); vr.splice(vr.indexOf(v) + 1, 0, n);
  stav.vybrana = n.id; obnovVrstvy(); obnovVlastnosti(); prekresli();
}
function smazVrstvu() {
  const v = vybrana(); if (!v) return;
  zaznam();
  const vr = vrstvyStrany(); vr.splice(vr.indexOf(v), 1);
  P.podminky = P.podminky.filter(p => p.vrstva !== v.id);
  stav.vybrana = null; obnovVrstvy(); obnovVlastnosti(); obnovPodminky(); prekresli();
}

/* ---------- NÁVRH: vlastnosti vrstvy ---------- */
const ANO_NE = { 'true': 'ano', 'false': 'ne' };
const POLE = {
  poloha: [['x', 'X mm', 'cislo'], ['y', 'Y mm', 'cislo'], ['w', 'Šířka mm', 'cislo'], ['h', 'Výška mm', 'cislo'], ['otoceni', 'Otočení °', 'cislo']],
  text: [['text', 'Text', 'textarea'], ['pismo', 'Písmo', 'pismo'], ['velikost', 'Velikost pt', 'cislo'], ['minVelikost', 'Min. velikost pt', 'cislo'],
    ['prizpusobit', 'Zmenšit písmo, aby se text vešel', 'bool'], ['tucne', 'Tučně', 'bool'], ['kurziva', 'Kurzíva', 'bool'], ['barva', 'Barva', 'barva'],
    ['zarovnani', 'Zarovnání', 'vyber', { vlevo: 'vlevo', stred: 'na střed', vpravo: 'vpravo' }],
    ['svisle', 'Svisle', 'vyber', { nahore: 'nahoru', stred: 'na střed', dole: 'dolů' }],
    ['radkovani', 'Řádkování', 'cislo'], ['obrys', 'Obrys písma', 'barva'], ['obrysSila', 'Obrys mm', 'cislo'], ['skrytPrazdne', 'Skrýt, když je prázdný', 'bool']],
  ikona: [['text', 'Emoji / symbol', 'text'], ['barva', 'Barva symbolu', 'barva'], ['pismo', 'Písmo', 'pismo'], ['skrytPrazdne', 'Skrýt, když je prázdná', 'bool']],
  obrazek: [['src', 'Obrázek', 'obrazek'], ['prizpusobeni', 'Přizpůsobení', 'vyber', { vyplnit: 'vyplnit (ořízne)', cely: 'celý (s okraji)', roztahnout: 'roztáhnout' }],
    ['zaobleni', 'Zaoblení mm', 'cislo'], ['pruhlednost', 'Krytí 0–1', 'cislo'], ['skrytPrazdne', 'Skrýt bez jména', 'bool']],
  tvar: [['druh', 'Tvar', 'vyber', { obdelnik: 'obdélník', elipsa: 'elipsa', kosoctverec: 'kosočtverec', sestiuhelnik: 'šestiúhelník', hvezda: 'hvězda' }],
    ['vypln', 'Výplň', 'barva'], ['obrys', 'Obrys', 'barva'], ['obrysSila', 'Obrys mm', 'cislo'], ['zaobleni', 'Zaoblení mm', 'cislo'], ['pruhlednost', 'Krytí 0–1', 'cislo']],
  ramecek: [['odsazeni', 'Od ořezu mm', 'cislo'], ['sila', 'Síla mm', 'cislo'], ['barva', 'Barva', 'barva'], ['zaobleni', 'Zaoblení mm', 'cislo'], ['dvojity', 'Dvojitá linka', 'bool']]
};
function cipyPromennych(k) {
  return `<div class="cipy" data-pro="${k}">${P.data.sloupce.map(s => `<button class="cip" type="button" data-vlozit="{${esc(s)}}">{${esc(s)}}</button>`).join('')}</div>`;
}
function htmlPole(def, hodnota) {
  const [k, nazev, typ, moznosti] = def, d = `data-k="${k}" data-typ="${typ}"`, id = 'vl_' + k;
  if (typ === 'bool') return `<label class="zaskrt"><input type="checkbox" ${d} ${hodnota === true ? 'checked' : ''}> ${nazev}</label>`;
  let vstup;
  if (typ === 'cislo') vstup = `<input id="${id}" class="vstup" type="number" step="${k === 'otoceni' ? 15 : k === 'pruhlednost' || k === 'radkovani' ? 0.05 : 0.5}" value="${esc(hodnota)}" ${d}>`;
  else if (typ === 'textarea') vstup = `<textarea id="${id}" class="vstup" rows="3" ${d}>${esc(hodnota)}</textarea>`;
  else if (typ === 'barva') vstup = poleBarvy(hodnota, d);
  else if (typ === 'vyber') vstup = `<select id="${id}" class="vstup" ${d}>${Object.entries(moznosti).map(([h, n]) => `<option value="${h}" ${h === hodnota ? 'selected' : ''}>${n}</option>`).join('')}</select>`;
  else if (typ === 'pismo') {
    const vlastni = PISMA.some(p => p[0] === hodnota) ? '' : `<option selected>${esc(hodnota)}</option>`;
    vstup = `<select id="${id}" class="vstup" ${d}>${vlastni}${PISMA.map(([r, s]) => `<option value="${esc(r)}" ${r === hodnota ? 'selected' : ''} style="font-family:${esc(KR.rodina(r))}">${esc(s.endsWith('.ttf') ? r : s)}</option>`).join('')}</select>`;
  } else if (typ === 'obrazek') vstup = `<div class="barva"><input id="${id}" class="vstup" type="text" value="${esc(hodnota)}" ${d} placeholder="{obrazek} nebo jméno souboru" style="flex:1" list="seznamObrazku"><button class="btn mini" type="button" data-vybratObr="1" title="Nahrát a použít obrázek ze souboru">📂</button></div>`;
  else vstup = `<input id="${id}" class="vstup" type="text" value="${esc(hodnota)}" ${d}>`;
  const cipy = typ === 'textarea' || typ === 'obrazek' || (typ === 'text' && k === 'text') ? cipyPromennych(k) : '';
  return `<div class="pole"><label for="${id}">${nazev}</label>${vstup}</div>${cipy ? `<div style="margin-left:104px">${cipy}</div>` : ''}`;
}
function obnovVlastnosti() {
  const v = vybrana(), el = $('vlastnosti');
  if (!v) { el.innerHTML = '<p class="napoveda-mala">Vyber vrstvu v seznamu nebo kliknutím do náhledu.</p>'; return; }
  let h = htmlPole(['nazev', 'Název vrstvy', 'text'], v.nazev);
  h += POLE[v.typ].map(d => htmlPole(d, v[d[0]])).join('');
  if (v.typ !== 'ramecek') h += '<h3>Poloha</h3>' + POLE.poloha.map(d => htmlPole(d, v[d[0]])).join('');
  h += `<datalist id="seznamObrazku">${[...obrazky.keys()].map(j => `<option value="${esc(j)}">`).join('')}</datalist>`;
  h += `<div style="display:flex;gap:6px;margin-top:8px"><button class="btn mini" data-prikaz="duplikovat">⧉ Duplikovat</button><button class="btn mini danger" data-prikaz="smazatVrstvu">🗑 Smazat</button></div>`;
  el.innerHTML = h;
}
function obnovPolohu() {
  const v = vybrana(); if (!v) return;
  ['x', 'y', 'w', 'h'].forEach(k => { const e = $('vl_' + k); if (e && document.activeElement !== e) e.value = v[k]; });
}
function hodnotaVstupu(e) {
  const t = e.dataset.typ;
  if (t === 'bool') return e.checked;
  if (t === 'cislo') { const n = parseFloat(e.value); return isNaN(n) ? null : n; }
  return e.value;
}
$('vlastnosti').addEventListener('input', e => {
  const v = vybrana(), k = e.target.dataset.k;
  if (!v || !k) return;
  const h = hodnotaVstupu(e.target);
  if (h === null) return;
  zaznam(); v[k] = h;
  if (e.target.type === 'color') e.target.parentNode.querySelector('input[type=text]').value = h;
  else if (e.target.dataset.typ === 'barva' && /^#[0-9a-f]{6}$/i.test(h)) e.target.parentNode.querySelector('input[type=color]').value = h;
  if (k === 'nazev') obnovVrstvy();
  if (k === 'pismo') zajistiPisma().then(prekresli);
  prekresli();
});
$('vlastnosti').addEventListener('click', e => {
  const cip = e.target.closest('[data-vlozit]');
  if (cip) {
    const k = cip.parentNode.dataset.pro, vst = $('vlastnosti').querySelector(`[data-k="${k}"]:not([type=color])`);
    const a = vst.selectionStart ?? vst.value.length, b = vst.selectionEnd ?? vst.value.length;
    vst.value = k === 'src' ? cip.dataset.vlozit : vst.value.slice(0, a) + cip.dataset.vlozit + vst.value.slice(b);
    vst.dispatchEvent(new Event('input', { bubbles: true })); vst.focus();
    return;
  }
  if (e.target.closest('[data-vybratObr]')) {
    vyberObrazkuProVrstvu = vybrana(); $('souborObrazky').click();
  }
});
let vyberObrazkuProVrstvu = null;

/* ---------- NÁVRH: podmíněné styly ---------- */
function cileVrstvy() {
  const out = [['karta', '🃏 Karta (pozadí)']];
  ['text', 'ikona', 'obrazek', 'tvar', 'ramecek'].forEach(t => out.push(['*' + t, IKONY_TYPU[t] + ' všechny: ' + t]));
  ['lic', 'rub'].forEach(s => P[s].vrstvy.forEach(v => out.push([v.id, (s === 'lic' ? 'Líc: ' : 'Rub: ') + IKONY_TYPU[v.typ] + ' ' + (v.nazev || v.typ)])));
  return out;
}
function vlastnostiCile(cil) {
  if (cil === 'karta') return [['pozadi', 'Pozadí', 'barva']];
  const typ = cil[0] === '*' ? cil.slice(1) : (najdiVrstvu(cil) || {}).typ;
  if (!typ) return [];
  return [['skryta', 'Skrýt', 'bool'], ...POLE[typ], ...(typ === 'ramecek' ? [] : POLE.poloha)];
}
function obnovPodminky() {
  const el = $('podminky');
  if (!P.podminky.length) { el.innerHTML = '<p class="napoveda-mala">Žádná pravidla.</p>'; return; }
  const sl = P.data.sloupce, cile = cileVrstvy();
  el.innerHTML = P.podminky.map((p, i) => {
    const vl = vlastnostiCile(p.vrstva), def = vl.find(d => d[0] === p.vlastnost);
    const nastav = def && def[2] === 'bool'
      ? `<select class="vstup" data-p="nastav" data-typ="bool">${Object.entries(ANO_NE).map(([h, n]) => `<option value="${h}" ${String(p.nastav === true || p.nastav === 'ano') === h ? 'selected' : ''}>${n}</option>`).join('')}</select>`
      : def && def[2] === 'vyber'
        ? `<select class="vstup" data-p="nastav">${Object.entries(def[3]).map(([h, n]) => `<option value="${h}" ${h === p.nastav ? 'selected' : ''}>${n}</option>`).join('')}</select>`
        : def && def[2] === 'barva' ? poleBarvy(p.nastav, 'data-p="nastav"').replace('style="flex:1"', 'style="flex:1;min-width:0"')
        : `<input class="vstup" data-p="nastav" value="${esc(p.nastav)}" ${def && def[2] === 'cislo' ? 'type="number" step="0.5" data-typ="cislo"' : ''}>`;
    return `<div class="podm" data-i="${i}">
      <div class="cele"><b style="font-size:.74rem">Když</b><select class="vstup" data-p="sloupec" aria-label="Sloupec">${(sl.includes(p.sloupec) ? sl : [p.sloupec, ...sl]).map(s => `<option ${s === p.sloupec ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>
        <button class="btn mini danger" data-smazat="1" title="Smazat pravidlo" aria-label="Smazat pravidlo">✕</button></div>
      <select class="vstup" data-p="op" aria-label="Podmínka">${Object.entries(K.OPERATORY).map(([o, n]) => `<option value="${o}" ${o === p.op ? 'selected' : ''}>${n}</option>`).join('')}</select>
      <input class="vstup" data-p="hodnota" value="${esc(p.hodnota)}" aria-label="Hodnota" ${p.op === 'prazdne' || p.op === 'neprazdne' ? 'disabled' : ''}>
      <span class="sipka">→ nastav</span>
      <select class="vstup" data-p="vrstva" aria-label="Vrstva">${cile.map(([h, n]) => `<option value="${esc(h)}" ${h === p.vrstva ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
      <select class="vstup" data-p="vlastnost" aria-label="Vlastnost">${vl.map(d => `<option value="${d[0]}" ${d[0] === p.vlastnost ? 'selected' : ''}>${d[1]}</option>`).join('')}</select>
      <div class="cele">${nastav}</div></div>`;
  }).join('');
}
$('pridatPodminku').addEventListener('click', () => {
  zaznam();
  const v = vybrana();
  const cil = v ? v.id : 'karta';
  const vl = vlastnostiCile(cil);
  const vlastnost = (vl.find(d => d[2] === 'barva') || vl[0])[0];
  P.podminky.push({ sloupec: P.data.sloupce.find(s => /typ|druh|kategorie|vzacnost/i.test(s)) || P.data.sloupce[0] || '', op: '=', hodnota: '', vrstva: cil, vlastnost, nastav: vlastnost === 'skryta' ? true : '#c0392b' });
  obnovPodminky(); prekresli();
});
function zmenaPodminky(e) {
  const box = e.target.closest('.podm'); if (!box) return;
  const p = P.podminky[+box.dataset.i], k = e.target.dataset.p;
  if (e.target.closest('[data-smazat]') && e.type === 'click') { zaznam(); P.podminky.splice(+box.dataset.i, 1); obnovPodminky(); prekresli(); return; }
  if (!k || e.type === 'click') return;
  zaznam();
  let h = e.target.value;
  if (e.target.dataset.typ === 'bool') h = h === 'true';
  else if (e.target.dataset.typ === 'cislo') h = parseFloat(h) || 0;
  p[k] = h;
  if (k === 'nastav' && e.target.type === 'color') box.querySelector('[data-p="nastav"][type=text]').value = h;
  if (k === 'vrstva') { const vl = vlastnostiCile(h); if (!vl.some(d => d[0] === p.vlastnost)) p.vlastnost = (vl.find(d => d[2] === 'barva') || vl[0] || [''])[0]; }
  if (k === 'vrstva' || k === 'vlastnost' || k === 'op') obnovPodminky();
  if (p.vlastnost === 'pismo') zajistiPisma().then(prekresli);
  prekresli();
}
$('podminky').addEventListener('change', zmenaPodminky);
$('podminky').addEventListener('input', e => { if (e.target.tagName === 'INPUT') zmenaPodminky(e); });
$('podminky').addEventListener('click', zmenaPodminky);

/* strana a karta */
document.querySelectorAll('[data-strana]').forEach(b => b.addEventListener('click', () => prepniStranu(b.dataset.strana)));
function prepniStranu(s) {
  stav.strana = s;
  document.querySelectorAll('[data-strana]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.strana === s)));
  if (!vybrana()) stav.vybrana = null;
  obnovKartu(); obnovVrstvy(); obnovVlastnosti(); prekresli();
}
function posunKartu(d) {
  const n = P.data.radky.length; if (!n) return;
  stav.radek = (stav.radek + d + n) % n; prekresli();
}
$('predKarta').addEventListener('click', () => posunKartu(-1));
$('dalsiKarta').addEventListener('click', () => posunKartu(1));
$('ukazVoditka').addEventListener('change', prekresli);

/* ---------- DATA: mřížka ---------- */
function obnovData() {
  const d = P.data, kopii = K.balicek(d).filter(k => k.radek >= 0).length;
  $('dataInfo').textContent = `${d.radky.length} řádků · ${d.sloupce.length} sloupců · ${kopii} karet k tisku` +
    (K.sloupecPoctu(d) < 0 ? ' (bez sloupce „pocet“ = 1 kopie)' : '');
  let h = '<thead><tr><th class="cislo">#</th>' + d.sloupce.map((s, j) =>
    `<th><div class="hl"><input value="${esc(s)}" data-hlavicka="${j}" aria-label="Název sloupce ${j + 1}"><button data-smazSloupec="${j}" title="Smazat sloupec" aria-label="Smazat sloupec">✕</button></div></th>`).join('') + '</tr></thead><tbody>';
  h += d.radky.map((r, i) => `<tr class="${i === stav.radek ? 'aktivni' : ''}"><td class="cislo"><button data-ukaz="${i}" title="Ukázat kartu v návrhu">${i + 1}</button><button data-smazRadek="${i}" title="Smazat řádek" aria-label="Smazat řádek">✕</button></td>` +
    d.sloupce.map((_, j) => `<td><input value="${esc(r[j])}" data-r="${i}" data-s="${j}" aria-label="Řádek ${i + 1}, ${esc(d.sloupce[j])}"></td>`).join('') + '</tr>').join('');
  $('mrizka').innerHTML = h + '</tbody>';
}
const mrizka = $('mrizka');
mrizka.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.r != null) { zaznam(); P.data.radky[+t.dataset.r][+t.dataset.s] = t.value; }
});
mrizka.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.hlavicka == null) return;
  const j = +t.dataset.hlavicka, stare = P.data.sloupce[j], nove = t.value.trim();
  if (!nove || nove === stare) { t.value = stare; return; }
  if (P.data.sloupce.some((s, k) => k !== j && s.toLowerCase() === nove.toLowerCase())) { Dialog.chyba('Sloupec „' + nove + '“ už existuje.'); t.value = stare; return; }
  zaznam();
  prejmenujSloupec(stare, nove);
  P.data.sloupce[j] = nove;
  obnovData();
  Dialog.info(`Sloupec přejmenován, proměnné {${stare}} v šabloně upraveny.`);
});
function prejmenujSloupec(stare, nove) {
  const re = new RegExp('\\{\\s*' + stare.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*(\\||\\})', 'gi');
  ['lic', 'rub'].forEach(s => {
    if (typeof P[s].pozadi === 'string') P[s].pozadi = P[s].pozadi.replace(re, '{' + nove + '$1');
    P[s].vrstvy.forEach(v => { for (const k in v) if (typeof v[k] === 'string') v[k] = v[k].replace(re, '{' + nove + '$1'); });
  });
  P.podminky.forEach(p => { if (String(p.sloupec).toLowerCase() === stare.toLowerCase()) p.sloupec = nove; if (typeof p.nastav === 'string') p.nastav = p.nastav.replace(re, '{' + nove + '$1'); });
}
mrizka.addEventListener('click', async e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.ukaz != null) { stav.radek = +b.dataset.ukaz; ukazPohled('navrh'); return; }
  if (b.dataset.smazradek != null) { zaznam(); P.data.radky.splice(+b.dataset.smazradek, 1); obnovData(); return; }
  if (b.dataset.smazsloupec != null) {
    const j = +b.dataset.smazsloupec;
    if (!await Dialog.potvrd(`Smazat sloupec „${P.data.sloupce[j]}“ i s hodnotami?`)) return;
    zaznam(); P.data.sloupce.splice(j, 1); P.data.radky.forEach(r => r.splice(j, 1)); obnovData();
  }
});
/* vložení bloku z Excelu / Tabulek (TSV) od buňky */
mrizka.addEventListener('paste', e => {
  const t = e.target; if (t.dataset.r == null) return;
  const text = (e.clipboardData || window.clipboardData).getData('text');
  if (!/[\t\n]/.test(text.replace(/\r?\n$/, ''))) return;
  e.preventDefault(); zaznam();
  const blok = K.parseCSV(text, '\t'), r0 = +t.dataset.r, s0 = +t.dataset.s;
  blok.forEach((radek, i) => radek.forEach((h, j) => {
    while (P.data.sloupce.length <= s0 + j) { P.data.sloupce.push('sloupec' + (P.data.sloupce.length + 1)); P.data.radky.forEach(r => r.push('')); }
    while (P.data.radky.length <= r0 + i) P.data.radky.push(P.data.sloupce.map(() => ''));
    P.data.radky[r0 + i][s0 + j] = h;
  }));
  obnovData();
  Dialog.info(`Vloženo ${blok.length} × ${Math.max(...blok.map(r => r.length))} buněk.`);
});
function pridejRadek() {
  zaznam();
  P.data.radky.push(P.data.sloupce.map((s, j) => K.SLOUPCE_POCTU.includes(s.toLowerCase()) ? '1' : ''));
  obnovData();
  const posl = mrizka.querySelector(`input[data-r="${P.data.radky.length - 1}"]`);
  if (posl) { posl.focus(); posl.scrollIntoView({ block: 'nearest' }); }
}
async function pridejSloupec() {
  const jm = await Dialog.zeptej('Název nového sloupce (bude to proměnná {název}):', 'sloupec' + (P.data.sloupce.length + 1));
  if (!jm || !jm.trim()) return;
  if (P.data.sloupce.some(s => s.toLowerCase() === jm.trim().toLowerCase())) return Dialog.chyba('Takový sloupec už je.');
  zaznam(); P.data.sloupce.push(jm.trim()); P.data.radky.forEach(r => r.push('')); obnovData();
}

/* ---------- import a export dat ---------- */
async function importujData(soubor) {
  let pole;
  try {
    if (/\.(xlsx|xls|ods)$/i.test(soubor.name)) {
      const XLSX = await VY.nactiSkript('lib/xlsx/xlsx.full.min.js', 'XLSX');
      const kniha = XLSX.read(await soubor.arrayBuffer(), { type: 'array' });
      const list = kniha.Sheets[kniha.SheetNames[0]];
      pole = XLSX.utils.sheet_to_json(list, { header: 1, raw: false, defval: '' }).filter(r => r.some(v => String(v).trim() !== ''));
    } else pole = K.parseCSV(await soubor.text());
  } catch (e) { return Dialog.chyba('Soubor nejde přečíst: ' + e.message); }
  nahradData(K.tabulkaZPoli(pole), soubor.name);
}
async function nahradData(t, odkud) {
  if (!t.sloupce.length || !t.radky.length) return Dialog.chyba('V tabulce nejsou žádná data (první řádek = hlavička).');
  const ma = P.data.radky.length > 1 || P.data.radky.some(r => r.some(v => v && v !== '1' && v !== 'Karta'));
  if (ma && !await Dialog.potvrd(`Nahradit současná data (${P.data.radky.length} řádků) tabulkou z „${odkud}“ (${t.radky.length} řádků, ${t.sloupce.length} sloupců)?`)) return;
  zaznam();
  P.data = t; stav.radek = 0;
  obnovVse();
  const chybi = K.chybejiciSloupce(P);
  if (chybi.length) Dialog.chyba('Načteno, ale šablona používá proměnné, které v tabulce nejsou: ' + chybi.map(s => '{' + s + '}').join(', '));
  else Dialog.info(`Načteno ${t.radky.length} řádků.`);
}
async function vlozitZeSchranky() {
  let text = '';
  try { text = await navigator.clipboard.readText(); } catch (e) { /* bez oprávnění */ }
  if (!text.trim()) return Dialog.info('Schránka je prázdná nebo nepřístupná. Zkopíruj tabulku (včetně hlavičky) a vlož ji Ctrl+V do první buňky v pohledu Data.');
  nahradData(K.tabulkaZPoli(K.parseCSV(text)), 'schránky');
}
const jmenoSouboru = s => (String(s || 'karty').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'karty').toLowerCase();

/* ---------- projekt: JSON ---------- */
function pouziteObrazky() {
  const jmena = new Set(), vse = [...obrazky.keys()];
  const radky = P.data.radky.length ? P.data.radky.map((_, i) => i) : [-1];
  radky.forEach(i => ['lic', 'rub'].forEach(s => strana(s, i).vrstvy.forEach(v => {
    if (v.typ === 'obrazek') { const j = K.najdiObrazek(v.src, vse); if (j) jmena.add(j); }
  })));
  return [...jmena];
}
const blobNaDataUrl = b => new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(b); });
async function exportJson(sObrazky) {
  const out = { typ: 'karty_generator', verze: 1, projekt: Object.assign({}, P, { id: undefined }) };
  if (sObrazky) {
    out.obrazky = [];
    for (const j of pouziteObrazky()) out.obrazky.push({ jmeno: j, data: await blobNaDataUrl(obrazky.get(j).blob) });
  }
  VY.stahni(new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' }), jmenoSouboru(P.nazev) + '.json');
}
async function importJson(soubor) {
  try {
    const o = JSON.parse(await soubor.text());
    const p = K.normalizuj(o.projekt || o);
    delete p.id;
    if (Array.isArray(o.obrazky)) {
      const f = [];
      for (const z of o.obrazky) { const b = await (await fetch(z.data)).blob(); f.push(new File([b], z.jmeno, { type: b.type })); }
      await pridejObrazky(f);
    }
    otevriProjekt(p);
    Dialog.info('Projekt „' + p.nazev + '“ načten.');
  } catch (e) { Dialog.chyba('Soubor nejde načíst jako projekt: ' + e.message); }
}

/* ---------- dialogy: předlohy, projekty, obrázky ---------- */
function otevriOkno(id) { const d = $(id); if (!d.open) d.showModal(); }
document.querySelectorAll('dialog.okno').forEach(d => {
  d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-zavrit]')) d.close(); });
});
function ukazPredlohy() {
  const el = $('seznamPredloh');
  el.innerHTML = PREDLOHY.map((p, i) => `<button data-predloha="${i}"><canvas width="10" height="10"></canvas><b>${esc(p.nazev)}</b><span>${esc(p.popis)}</span></button>`).join('') +
    '<button data-predloha="-1"><b>📄 Prázdná karta</b><span>poker 63 × 88 mm, bez vrstev</span></button>';
  otevriOkno('oknoPredlohy');
  // miniatury: dočasně přepnout P na předlohu a nakreslit první řádek
  el.querySelectorAll('[data-predloha]').forEach(async b => {
    const i = +b.dataset.predloha; if (i < 0) return;
    const pr = K.normalizuj(PREDLOHY[i].vytvor());
    await zajistiPisma(pr);
    const c = b.querySelector('canvas'), mm = 110 / Math.max(pr.karta.w, pr.karta.h);
    const r = platnoKarty('lic', 0, { mm, rohy: true }, pr);
    c.width = r.platno.width; c.height = r.platno.height; c.getContext('2d').drawImage(r.platno, 0, 0);
  });
}
$('seznamPredloh').addEventListener('click', e => {
  const b = e.target.closest('[data-predloha]'); if (!b) return;
  const i = +b.dataset.predloha;
  $('oknoPredlohy').close();
  ulozTed();
  const p = i < 0 ? K.novyProjekt() : K.normalizuj(PREDLOHY[i].vytvor());
  if (i < 0) { p.lic.vrstvy = [K.novaVrstva('ramecek'), K.novaVrstva('text')]; }
  delete p.id;
  otevriProjekt(p);
  ukazPohled('navrh');
});
async function ukazProjekty() {
  const vse = (await idb('projekty', 'getAll')).sort((a, b) => b.upraveno - a.upraveno);
  $('seznamProjektu').innerHTML = vse.map(z => `<div><span class="jm"><b>${esc(z.nazev)}</b>${z.id === P.id ? ' <small style="display:inline">(otevřený)</small>' : ''}
    <small>${new Date(z.upraveno).toLocaleString('cs-CZ')} · ${z.projekt.data.radky.length} řádků · ${esc(K.FORMATY[z.projekt.karta.format]?.n || z.projekt.karta.w + ' × ' + z.projekt.karta.h)}</small></span>
    <button class="btn mini primary" data-otevrit="${z.id}">Otevřít</button><button class="btn mini danger" data-smazat="${z.id}" ${z.id === P.id ? 'disabled' : ''}>🗑</button></div>`).join('')
    || '<p>Žádné uložené projekty.</p>';
  otevriOkno('oknoProjekty');
}
$('seznamProjektu').addEventListener('click', async e => {
  const o = e.target.closest('[data-otevrit]'), s = e.target.closest('[data-smazat]');
  if (o) { await ulozTed(); const z = await idb('projekty', 'get', o.dataset.otevrit); $('oknoProjekty').close(); otevriProjekt(Object.assign(K.normalizuj(z.projekt), { id: z.id })); }
  if (s) {
    const z = await idb('projekty', 'get', s.dataset.smazat);
    if (await Dialog.potvrd(`Smazat projekt „${z.nazev}“? Nejde to vrátit.`)) { await idb('projekty', 'delete', s.dataset.smazat); ukazProjekty(); }
  }
});
function ukazObrazky() {
  const vse = [...obrazky.keys()].sort((a, b) => a.localeCompare(b, 'cs'));
  $('galerie').innerHTML = vse.map(j => `<figure><img alt="" data-jmeno="${esc(j)}"><figcaption>${esc(j)}</figcaption><button data-smazObr="${esc(j)}" title="Smazat" aria-label="Smazat ${esc(j)}">✕</button></figure>`).join('') || '<p class="napoveda-mala">Knihovna je prázdná.</p>';
  $('galerie').querySelectorAll('img').forEach(img => {
    const u = URL.createObjectURL(obrazky.get(img.dataset.jmeno).blob);
    img.src = u; img.onload = () => URL.revokeObjectURL(u);
  });
  // jména z dat, ke kterým obrázek chybí
  const chybi = new Set();
  (P.data.radky.length ? P.data.radky.map((_, i) => i) : []).forEach(i => ['lic', 'rub'].forEach(s => {
    if (s === 'rub' && P.rubRezim === 'ne') return;
    strana(s, i).vrstvy.forEach(v => { if (v.typ === 'obrazek' && v.src && !obrazekPodleJmena(v.src)) chybi.add(v.src); });
  }));
  $('chybiObrazky').textContent = chybi.size ? 'Chybí obrázky pro: ' + [...chybi].slice(0, 40).join(', ') + (chybi.size > 40 ? ' …' : '') : '';
  otevriOkno('oknoObrazky');
}
$('galerie').addEventListener('click', async e => {
  const b = e.target.closest('[data-smazobr]'); if (!b) return;
  const j = b.dataset.smazobr;
  if (!await Dialog.potvrd(`Smazat obrázek „${j}“ z knihovny?`)) return;
  await idb('obrazky', 'delete', j); obrazky.delete(j); ukazObrazky(); prekresli();
});
$('nahratObrazky').addEventListener('click', () => { vyberObrazkuProVrstvu = null; $('souborObrazky').click(); });
$('souborObrazky').addEventListener('change', async e => {
  const f = [...e.target.files]; e.target.value = '';
  const n = await pridejObrazky(f);
  if (n && vyberObrazkuProVrstvu && f[0]) { zaznam(); vyberObrazkuProVrstvu.src = f[0].name; obnovVlastnosti(); prekresli(); }
  vyberObrazkuProVrstvu = null;
  if ($('oknoObrazky').open) ukazObrazky();
});
$('souborData').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) importujData(f); });
$('souborJson').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) importJson(f); });

/* ---------- TISK ---------- */
function rozlozeni() {
  const L = K.rozloz(P.karta, P.arch);
  const karty = K.balicek(P.data);
  return { L, karty, listy: K.listy(karty, L, P.arch) };
}
function obnovFormularTisku() {
  const a = P.arch;
  $('aPapir').value = a.papir; $('aOrient').value = a.orientace; $('aOkraj').value = a.okraj; $('aMezera').value = a.mezera;
  $('aOtocit').checked = !!a.otocit; $('aZnacky').checked = !!a.znacky; $('aObrys').checked = !!a.obrysRezu;
  $('aPreklap').value = a.preklapeni; $('aPosX').value = a.posunX; $('aPosY').value = a.posunY;
  $('aDpi').value = String(a.dpi); $('aPngB').checked = !!a.pngSpadavka;
}
$('aPapir').innerHTML = Object.entries(K.PAPIRY).map(([k, p]) => `<option value="${k}">${p.n} (${p.w} × ${p.h} mm)</option>`).join('');
[['aPapir', 'papir'], ['aOrient', 'orientace'], ['aOkraj', 'okraj', 1], ['aMezera', 'mezera', 1], ['aOtocit', 'otocit', 2], ['aZnacky', 'znacky', 2], ['aObrys', 'obrysRezu', 2],
 ['aPreklap', 'preklapeni'], ['aPosX', 'posunX', 1], ['aPosY', 'posunY', 1], ['aDpi', 'dpi', 1], ['aPngB', 'pngSpadavka', 2]].forEach(([id, k, typ]) => {
  $(id).addEventListener(typ === 2 ? 'change' : 'input', e => {
    let h = typ === 2 ? e.target.checked : e.target.value;
    if (typ === 1) { h = parseFloat(h); if (isNaN(h)) return; }
    zaznam(); P.arch[k] = h; obnovTisk();
  });
});
let casTisku = null;
function obnovTisk() { clearTimeout(casTisku); casTisku = setTimeout(kresliTisk, 120); }
function kontrola() {
  // přetékající texty a chybějící obrázky přes všechny řádky (měří se, nekreslí)
  const pretek = [], chybi = new Set(), c = document.createElement('canvas').getContext('2d');
  const radky = P.data.radky.length ? P.data.radky.map((_, i) => i) : [-1];
  radky.slice(0, 2000).forEach(i => (P.rubRezim === 'ne' ? ['lic'] : ['lic', 'rub']).forEach(s => {
    if (s === 'rub' && P.rubRezim === 'spolecny' && i !== radky[0]) return;
    const st = strana(s, i);
    st.vrstvy.forEach(v => {
      if (v.typ === 'obrazek' && v.src && !obrazekPodleJmena(v.src)) chybi.add(v.src);
      if (v.typ !== 'text') return;
      const pismo = px => `${v.kurziva ? 'italic ' : ''}${v.tucne ? 'bold ' : ''}${px}px ${KR.rodina(v.pismo)}`;
      const mer = (t, sz) => { c.font = pismo(sz * 10); return c.measureText(t).width / 10; };
      const r = K.prizpusob(v.text, v.w, v.h, { max: (+v.velikost || 12) * K.PT_MM, min: (+v.minVelikost || 4) * K.PT_MM, radkovani: +v.radkovani || 1.15, prizpusobit: v.prizpusobit !== false }, mer);
      if (r.preteka) pretek.push(`řádek ${i + 1}${s === 'rub' ? ' (rub)' : ''}: ${v.nazev || 'text'}`);
    });
  }));
  return { pretek, chybi: [...chybi] };
}
async function kresliTisk() {
  if (stav.pohled !== 'tisk') return;
  await zajistiPisma();
  const { L, karty, listy } = rozlozeni();
  const pap = K.PAPIRY[P.arch.papir];
  const stran = listy.length * (P.rubRezim === 'ne' ? 1 : 2);
  const kt = kontrola(), chybiSl = K.chybejiciSloupce(P);
  let h = '';
  if (!L.naList) h = '<span class="varovani">Karta se na papír nevejde – zmenši okraj, spadávku nebo zvol větší papír.</span>';
  else {
    h = `<b>${karty[0].radek < 0 ? 1 : karty.length}</b> karet · <b>${L.sl} × ${L.ra}</b> = ${L.naList} na list (${pap.n} ${L.pw > L.ph ? 'na šířku' : 'na výšku'})<br>` +
      `<b>${listy.length}</b> ${listy.length === 1 ? 'list' : listy.length < 5 ? 'listy' : 'listů'}` + (P.rubRezim !== 'ne' ? ` = ${stran} stran (líc + rub)` : '') +
      `<br>Karta ${P.karta.w} × ${P.karta.h} mm, spadávka ${P.karta.spadavka} mm`;
  }
  if (karty[0].radek < 0) h += '<span class="varovani">Tabulka dat je prázdná – tiskne se jedna karta ze šablony.</span>';
  if (chybiSl.length) h += `<span class="varovani">Chybí sloupce: ${chybiSl.map(esc).join(', ')}</span>`;
  if (kt.pretek.length) h += `<span class="varovani">⚠ Přetéká text (${kt.pretek.length}): ${kt.pretek.slice(0, 6).map(esc).join('; ')}${kt.pretek.length > 6 ? ' …' : ''}</span>`;
  if (kt.chybi.length) h += `<span class="varovani">🖼 Chybí obrázky: ${kt.chybi.slice(0, 10).map(esc).join(', ')}${kt.chybi.length > 10 ? ' …' : ''}</span>`;
  $('souhrn').innerHTML = h;
  // náhled prvních dvou listů
  const el = $('archy'); el.innerHTML = '';
  if (!L.naList) return;
  const sirka = Math.min(420, Math.max(220, (el.clientWidth - 60) / (P.rubRezim === 'ne' ? 1 : 2)));
  const mm = sirka / L.pw, dpr = window.devicePixelRatio || 1, cache = new Map();
  const karta = (s, i) => {
    const k = s === 'rub' && P.rubRezim === 'spolecny' ? 'rub' : s + i;
    if (!cache.has(k)) cache.set(k, natocRub(s, platnoKarty(s, i, { mm: mm * dpr * 1.5, spadavka: true, rohy: true, otocit: P.arch.otocit }).platno));
    return cache.get(k);
  };
  for (let li = 0; li < Math.min(2, listy.length); li++) {
    for (const s of P.rubRezim === 'ne' ? ['lic'] : ['lic', 'rub']) {
      const c = document.createElement('canvas');
      c.width = Math.round(L.pw * mm * dpr); c.height = Math.round(L.ph * mm * dpr);
      c.style.width = (L.pw * mm) + 'px'; c.style.height = (L.ph * mm) + 'px';
      const x = c.getContext('2d'), k = mm * dpr;
      x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
      const dx = s === 'rub' ? +P.arch.posunX || 0 : 0, dy = s === 'rub' ? +P.arch.posunY || 0 : 0;
      listy[li][s].forEach(p => x.drawImage(karta(s, p.karta.radek), p.x * k, p.y * k, L.cw * k, L.ch * k));
      if (P.arch.obrysRezu && s === 'lic') {
        x.strokeStyle = '#888'; x.lineWidth = 1;
        listy[li].lic.forEach(p => { x.beginPath(); x.roundRect((p.x + L.b) * k, (p.y + L.b) * k, L.w * k, L.h * k, (+P.karta.zaobleni || 0) * k); x.stroke(); });
      }
      if (P.arch.znacky) {
        x.strokeStyle = '#000'; x.lineWidth = Math.max(1, 0.25 * k);
        K.orezoveZnacky(L).forEach(z => { x.beginPath(); x.moveTo((z.x1 + dx) * k, (z.y1 + dy) * k); x.lineTo((z.x2 + dx) * k, (z.y2 + dy) * k); x.stroke(); });
      }
      const fig = document.createElement('figure');
      fig.appendChild(c);
      fig.appendChild(document.createTextNode(`List ${li + 1} – ${s === 'lic' ? 'líc' : 'rub (zrcadlený)'}`));
      el.appendChild(fig);
    }
  }
  if (listy.length > 2) el.insertAdjacentHTML('beforeend', `<p class="napoveda-mala" style="width:100%;text-align:center">… a dalších ${listy.length - 2} listů</p>`);
}

/* běh exportu s ukazatelem průběhu */
let bezi = false;
async function export_(druh) {
  if (bezi) return;
  const { L, listy } = rozlozeni();
  if (druh !== 'zip' && druh !== 'png' && !L.naList) return Dialog.chyba('Karta se na papír nevejde.');
  bezi = true;
  const pr = $('prubeh'); pr.hidden = false; pr.firstElementChild.style.width = '0';
  const prubeh = f => { pr.firstElementChild.style.width = Math.round(f * 100) + '%'; };
  try {
    await zajistiPisma();
    if (druh === 'pdf') {
      Dialog.info('Připravuji PDF…');
      const b = await VY.pdf({ P, L, listy, prubeh, karta: (s, i) => kartaProExport(s, i, true) });
      VY.stahni(b, jmenoSouboru(P.nazev) + '.pdf');
    } else if (druh === 'tisk') {
      await VY.tisk({ P, L, listy, prubeh, karta: (s, i) => kartaProExport(s, i, true) });
    } else if (druh === 'zip') {
      Dialog.info('Připravuji PNG…');
      const b = await VY.pngZip({ P, prubeh, karta: async (s, i) => { await zajistiPisma(); return platnoKarty(s, i, { mm: (+P.arch.dpi || 300) / 25.4, spadavka: !!P.arch.pngSpadavka, rohy: true }).platno; } });
      VY.stahni(b, jmenoSouboru(P.nazev) + '_png.zip');
    } else if (druh === 'png') {
      const s = P.rubRezim === 'ne' ? 'lic' : stav.strana, i = P.data.radky.length ? stav.radek : -1;
      const c = platnoKarty(s, i, { mm: (+P.arch.dpi || 300) / 25.4, spadavka: !!P.arch.pngSpadavka, rohy: true }).platno;
      VY.stahni(await VY.doBlobu(c, 'image/png'), `${jmenoSouboru(P.nazev)}_${i + 1}${s === 'rub' ? '_rub' : ''}.png`);
    }
  } catch (e) { Dialog.chyba('Export selhal: ' + e.message); console.error(e); }
  finally { bezi = false; setTimeout(() => { pr.hidden = true; }, 600); }
}

/* ---------- pohledy ---------- */
function ukazPohled(p) {
  stav.pohled = p;
  zapisStav({ pohled: p });
  document.querySelectorAll('[data-pohled]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.pohled === p)));
  $('pohledNavrh').hidden = p !== 'navrh'; $('pohledData').hidden = p !== 'data'; $('pohledTisk').hidden = p !== 'tisk';
  if (p === 'navrh') { obnovKartu(); obnovVrstvy(); obnovVlastnosti(); obnovPodminky(); prekresli(); }
  if (p === 'data') obnovData();
  if (p === 'tisk') { obnovFormularTisku(); kresliTisk(); }
}
document.querySelectorAll('[data-pohled]').forEach(b => b.addEventListener('click', () => ukazPohled(b.dataset.pohled)));
function obnovVse() {
  if (!P.lic.vrstvy.some(v => v.id === stav.vybrana) && !P.rub.vrstvy.some(v => v.id === stav.vybrana)) stav.vybrana = null;
  obnovKartu();
  ukazPohled(stav.pohled);
}

/* ---------- příkazy, nabídky, klávesy ---------- */
const PRIKAZY = {
  predlohy: ukazPredlohy,
  prazdny: () => { ulozTed(); const p = K.novyProjekt(); p.lic.vrstvy = [K.novaVrstva('ramecek'), K.novaVrstva('text')]; otevriProjekt(p); ukazPohled('navrh'); },
  otevrit: ukazProjekty,
  prejmenovat: async () => { const n = await Dialog.zeptej('Název projektu:', P.nazev); if (n && n.trim()) { zaznam(); P.nazev = n.trim(); obnovKartu(); } },
  kopie: async () => { await ulozTed(); const p = K.kopie(P); delete p.id; p.nazev += ' (kopie)'; otevriProjekt(p); Dialog.info('Uloženo jako „' + p.nazev + '“.'); },
  expJson: () => exportJson(false), expJsonObr: () => exportJson(true), impJson: () => $('souborJson').click(),
  'v-text': () => pridejVrstvu('text'), 'v-ikona': () => pridejVrstvu('ikona'), 'v-obrazek': () => pridejVrstvu('obrazek'),
  'v-tvar': () => pridejVrstvu('tvar'), 'v-ramecek': () => pridejVrstvu('ramecek'),
  duplikovat: duplikuj, smazatVrstvu: smazVrstvu,
  licNaRub: async () => {
    if (!await Dialog.potvrd('Nahradit vrstvy rubu kopií vrstev líce?')) return;
    zaznam(); P.rub.vrstvy = P.lic.vrstvy.map(v => Object.assign(K.kopie(v), { id: K.noveId(v.typ.slice(0, 2)) })); P.rub.pozadi = P.lic.pozadi;
    if (P.rubRezim === 'ne') P.rubRezim = 'data';
    prepniStranu('rub');
  },
  impData: () => $('souborData').click(), vlozitData: vlozitZeSchranky,
  expCsv: () => VY.stahni(new Blob(['﻿' + K.doCSV(P.data, ';')], { type: 'text/csv' }), jmenoSouboru(P.nazev) + '.csv'),
  obrazky: ukazObrazky, pridatRadek: pridejRadek, pridatSloupec: pridejSloupec,
  pdf: () => export_('pdf'), tisk: () => export_('tisk'), zip: () => export_('zip'), pngJedna: () => export_('png'),
  zpet: () => krokHistorie(zpet, vpred), vpred: () => krokHistorie(vpred, zpet),
  napoveda: () => otevriOkno('oknoNapoveda')
};
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
  if (b && !b.disabled) { e.stopPropagation(); zavriNabidky(); const f = PRIKAZY[b.dataset.prikaz]; if (f) f(); return; }
  if (!e.target.closest('.nabidka')) zavriNabidky();
});
addEventListener('resize', () => { zavriNabidky(); prekresli(); if (stav.pohled === 'tisk') obnovTisk(); });

document.addEventListener('keydown', e => {
  const vPoli = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.querySelector('dialog[open]');
  const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
  if (e.key === 'Escape') { zavriNabidky(); return; }
  if (ctrl && k === 's') { e.preventDefault(); ulozTed().then(() => Dialog.info('Uloženo v prohlížeči.')); return; }
  if (ctrl && k === 'o') { e.preventDefault(); ukazProjekty(); return; }
  if (ctrl && k === 'p') { e.preventDefault(); export_('pdf'); return; }
  if (e.key === 'F1') { e.preventDefault(); otevriOkno('oknoNapoveda'); return; }
  if (vPoli) return;
  if (ctrl && k === 'z') { e.preventDefault(); e.shiftKey ? PRIKAZY.vpred() : PRIKAZY.zpet(); return; }
  if (ctrl && k === 'y') { e.preventDefault(); PRIKAZY.vpred(); return; }
  if (ctrl && k === 'd') { e.preventDefault(); duplikuj(); return; }
  if (ctrl || e.altKey) return;
  if (k === '1' || k === '2' || k === '3') { ukazPohled(['navrh', 'data', 'tisk'][+k - 1]); return; }
  if (stav.pohled !== 'navrh') return;
  if (k === 't') { pridejVrstvu('text'); e.preventDefault(); return; }
  if (k === 'r') { prepniStranu(stav.strana === 'lic' ? 'rub' : 'lic'); return; }
  if (e.key === 'PageDown') { posunKartu(1); e.preventDefault(); return; }
  if (e.key === 'PageUp') { posunKartu(-1); e.preventDefault(); return; }
  const v = vybrana();
  if (!v) return;
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); smazVrstvu(); return; }
  const krok = e.shiftKey ? 5 : 0.5, sm = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
  if (sm && v.typ !== 'ramecek') { e.preventDefault(); zaznam(); v.x = +(v.x + sm[0] * krok).toFixed(2); v.y = +(v.y + sm[1] * krok).toFixed(2); obnovPolohu(); prekresli(); }
});

/* přetažení souborů */
let hloubka = 0;
addEventListener('dragenter', e => { if (e.dataTransfer?.types?.includes('Files')) { hloubka++; $('pretahni').hidden = false; } });
addEventListener('dragleave', () => { if (--hloubka <= 0) { hloubka = 0; $('pretahni').hidden = true; } });
addEventListener('dragover', e => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); });
addEventListener('drop', async e => {
  if (!e.dataTransfer?.files?.length) return;
  e.preventDefault(); hloubka = 0; $('pretahni').hidden = true;
  const f = [...e.dataTransfer.files];
  const obr = f.filter(x => /^image\//.test(x.type)), json = f.find(x => /\.json$/i.test(x.name)), tab = f.find(x => /\.(csv|tsv|txt|xlsx|xls|ods)$/i.test(x.name));
  if (obr.length) { await pridejObrazky(obr); if ($('oknoObrazky').open) ukazObrazky(); }
  if (json) await importJson(json);
  if (tab) await importujData(tab);
  if (!obr.length && !json && !tab) Dialog.chyba('Tenhle typ souboru neumím (CSV, TSV, XLSX, ODS, JSON, obrázky).');
});

/* ---------- start ---------- */
async function start() {
  try { await nactiKnihovnu(); } catch (e) { Dialog.chyba('IndexedDB není dostupná – projekty se neuloží.'); }
  const st = ctiStav();
  stav.pohled = ['navrh', 'data', 'tisk'].includes(st.pohled) ? st.pohled : 'navrh';
  let z = null;
  try { if (st.posledni) z = await idb('projekty', 'get', st.posledni); } catch (e) { /* bez úložiště */ }
  if (z) {
    try { otevriProjekt(Object.assign(K.normalizuj(z.projekt), { id: z.id })); } catch (e) { z = null; }
  }
  if (!z) { const p = K.normalizuj(PREDLOHY.find(x => x.id === 'rpg').vytvor()); otevriProjekt(p); }
}
window.KARTY_APP = { get P() { return P; }, stav, importujData, nahradData, pridejObrazky, ukazPohled, prekresli, export_, prikaz: id => PRIKAZY[id] && PRIKAZY[id](), otevriProjekt };
start();
})();

/* ============================================================
   Tisk knížky doma – rozhraní (ES modul kvůli PDF.js).
   Logika vyřazení je v jadro.js (window.BROZURA); tady jen načtení
   PDF, nastavení, náhled archů (vygenerované PDF vykreslené pdf.js)
   a ukládání. Nastavení v localStorage, poslední PDF v IndexedDB.
   ============================================================ */
import * as pdfjsLib from '../lib/pdfjs/pdf.min.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('../lib/pdfjs/pdf.worker.min.mjs', import.meta.url).href;

const J = window.BROZURA, PDFLib = window.PDFLib;
const $ = id => document.getElementById(id);
const KLIC = 'webapp_brozura_nast';
const PDFJS_VOLBY = { cMapUrl: 'lib/pdfjs/cmaps/', cMapPacked: true, standardFontDataUrl: 'lib/pdfjs/standard_fonts/', isEvalSupported: false };
const f1 = x => (Math.round(x * 10) / 10).toLocaleString('cs-CZ');
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let nast = (() => { try { return J.normalizuj(JSON.parse(localStorage.getItem(KLIC))); } catch (e) { return J.normalizuj({}); } })();
const ulozNast = () => { try { localStorage.setItem(KLIC, JSON.stringify(nast)); } catch (e) { /* plné úložiště */ } };

const S = { nazev: '', bajty: null, doc: null, plan: null, arch: 0, rozmery: [] };

/* ---------- IndexedDB: poslední PDF ---------- */
function db() {
  return new Promise((ok, chyba) => {
    const r = indexedDB.open('webapp_brozura', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('soubory');
    r.onsuccess = () => ok(r.result); r.onerror = () => chyba(r.error);
  });
}
async function idb(rezim, fn) {
  const d = await db();
  return new Promise((ok, chyba) => {
    const t = d.transaction('soubory', rezim), r = fn(t.objectStore('soubory'));
    t.oncomplete = () => { ok(r && r.result); d.close(); }; t.onerror = () => { chyba(t.error); d.close(); };
  });
}
const ulozPosledni = () => idb('readwrite', s => s.put({ nazev: S.nazev, bajty: S.bajty }, 'posledni')).catch(() => {});
const smazPosledni = () => idb('readwrite', s => s.delete('posledni')).catch(() => {});

/* ---------- písmo do PDF (čeština v popiscích) ---------- */
let pismoP = null;
const pismo = () => pismoP || (pismoP = fetch('lib/pdflib/LiberationSans-Regular.ttf').then(r => r.arrayBuffer())
  .then(b => ({ fontkit: window.fontkit, bajty: b })).catch(() => null));

/* ---------- načtení PDF ---------- */
function prubeh(text) {
  const d = document.createElement('div'); d.className = 'prubeh';
  d.innerHTML = `<div>${esc(text)}</div>`; document.body.appendChild(d);
  return () => d.remove();
}

async function nactiPdf(bajty, nazev, ulozit = true) {
  let doc;
  try { doc = await PDFLib.PDFDocument.load(bajty, { ignoreEncryption: true }); }
  catch (e) { Dialog.chyba('Soubor se nepodařilo otevřít jako PDF: ' + e.message); return; }
  if (doc.isEncrypted) { Dialog.chyba('PDF je zašifrované (chráněné heslem) – nejdřív ho uložte bez ochrany.'); return; }
  if (!doc.getPageCount()) { Dialog.chyba('PDF nemá žádné strany.'); return; }
  Object.assign(S, { nazev, bajty, doc, arch: 0, rozmery: doc.getPages().map((_, i) => J.rozmerStrany(doc, i)) });
  $('souborNazev').textContent = `${nazev} · ${doc.getPageCount()} str.`;
  if (ulozit) ulozPosledni();
  prepocitej();
}

async function otevritSoubor(f) {
  if (!f) return;
  if (!/pdf$/i.test(f.type) && !/\.pdf$/i.test(f.name)) { Dialog.chyba('Vyberte soubor PDF.'); return; }
  const konec = prubeh('Načítám PDF…');
  try { await nactiPdf(new Uint8Array(await f.arrayBuffer()), f.name); } finally { konec(); }
}

/* ---------- nastavení ve formuláři ---------- */
function vyplnFormular() {
  document.querySelectorAll('[data-v]').forEach(el => {
    const v = nast[el.dataset.v];
    if (el.type === 'checkbox') el.checked = !!v;
    else if (el !== document.activeElement || el.tagName === 'SELECT') el.value = el.tagName === 'INPUT' ? String(v).replace('.', ',') : String(v);
  });
  document.querySelectorAll('[data-jen]').forEach(el => { el.hidden = !el.dataset.jen.split(' ').includes(nast.rezim); });
  document.querySelectorAll('[data-jen-vystup]').forEach(el => { el.hidden = el.dataset.jenVystup !== nast.vystup; });
  document.querySelectorAll('[data-prikaz^="rezim-"],[data-prikaz^="arch-"],[data-prikaz^="meritko-"]').forEach(b => {
    const [k, v] = b.dataset.prikaz.split('-');
    b.setAttribute('aria-pressed', String(nast[k] === v));
  });
}
function nastav(zmena) {
  nast = J.normalizuj(Object.assign({}, nast, zmena));
  ulozNast(); vyplnFormular(); prepocitej();
}
$('nastaveni').addEventListener('change', e => {
  const el = e.target.closest('[data-v]'); if (!el) return;
  nastav({ [el.dataset.v]: el.type === 'checkbox' ? el.checked : el.value });   // čísla (i s čárkou) převádí jádro
  if (el.tagName === 'INPUT' && el.type !== 'checkbox') el.value = String(nast[el.dataset.v]).replace('.', ',');
});

/* ---------- přepočet a zobrazení ---------- */
function prepocitej() {
  const ma = !!S.doc;
  document.querySelectorAll('[data-potreba="pdf"]').forEach(b => { b.disabled = !ma; });
  $('prazdne').hidden = ma; $('vysledek').hidden = !ma;
  if (!ma) { S.plan = null; return; }
  S.plan = J.plan(S.doc.getPageCount(), S.rozmery[0], nast);
  S.arch = Math.min(S.arch, S.plan.archy.length - 1);
  kresliSouhrn(); kresliTabulku(); nahled();
}

function kresliSouhrn() {
  const p = S.plan, g = p.g, o = p.volby;
  const polozky = [
    `Stran v PDF: <b>${p.n}</b>`,
    `doplněno prázdných: <b>${p.prazdnych}</b>`,
    `archů papíru: <b>${p.archy.length}</b>`,
    o.rezim === 'slozky' ? `složek: <b>${p.slozek}</b>` : '',
    `arch ${J.ARCHY[o.arch].nazev.split(' ')[0]} <b>${g.W > g.H ? 'na šířku' : 'na výšku'}</b>`,
    `měřítko <b>${f1(g.m * 100)} %</b>`,
    `strana knihy po ořezu <b>${f1(p.kniha.s)} × ${f1(p.kniha.v)} mm</b>`,
    `tloušťka bloku <b>≈ ${f1(p.tloustka)} mm</b>`,
    p.posunMax ? `creep nejvnitřnějšího listu <b>${(Math.round(p.posunMax * 100) / 100).toLocaleString('cs-CZ')} mm</b>` : ''
  ].filter(Boolean);
  $('souhrn').innerHTML = polozky.map(t => `<span>${t}</span>`).join('');
  const rot = g.rotaceRubu;
  const v = [...p.varovani];
  const zdrojRot = S.doc.getPages().some(pg => pg.getRotation().angle % 360);
  if (zdrojRot) v.push('Některé strany PDF mají nastavené otočení – vloží se neotočené. Uložte PDF bez otočení stran.');
  const jine = J.ruzneRozmery(S.rozmery);
  if (jine.length) v.push(`Strany ${jine.slice(0, 8).map(i => i + 1).join(', ')}${jine.length > 8 ? '…' : ''} mají jiný rozměr než první strana – vystředí se a oříznou na rozměr listu.`);
  let html = v.map(t => `<p class="varovani">⚠ ${esc(t)}</p>`).join('');
  const odhad = !o.spadavka && J.odhadSpadavky(S.rozmery[0]);
  if (odhad) html += `<p class="varovani info">💡 Strany PDF mají ${f1(p.zdrojova.s)} × ${f1(p.zdrojova.v)} mm – vypadá to na formát ${f1(odhad.s)} × ${f1(odhad.v)} mm se spadávkou ${f1(odhad.spadavka)} mm (např. ze Sazby knihy). <button class="tl" type="button" data-prikaz="pouzijSpadavku" data-mm="${odhad.spadavka}">✂ Odříznout spadávku</button></p>`;
  $('varovani').innerHTML = html;
  const hrana = o.preklapeni === 'dlouha' ? 'po dlouhé hraně' : 'po krátké hraně';
  $('poznOtoceni').textContent = rot
    ? `Rub je v PDF otočený o 180°, aby při obracení ${hrana} stál stejně jako líc.`
    : `Při obracení ${hrana} se rub neotáčí.`;
  $('poznRub').textContent = rot ? 'Rub je v náhledu vzhůru nohama – tak ho tiskárna potřebuje.' : '';
  $('slSlozka').hidden = o.rezim !== 'slozky';
}

function kresliTabulku() {
  const p = S.plan, sl = p.volby.rezim === 'slozky';
  $('prehled').tBodies[0].innerHTML = J.prehled(p).map((r, i) =>
    `<tr data-arch="${i}" tabindex="0"${i === S.arch ? ' class="aktivni"' : ''}><td>${r.cislo}</td>${sl ? `<td>${r.slozka}</td>` : ''}<td class="str">${esc(r.lic)}</td><td class="str">${esc(r.rub)}</td></tr>`).join('');
  $('vyberArchu').innerHTML = p.archy.map((a, i) => `<option value="${i}">${i + 1} / ${p.archy.length}</option>`).join('');
  $('vyberArchu').value = S.arch;
}
$('prehled').addEventListener('click', e => { const tr = e.target.closest('tr[data-arch]'); if (tr) jdiNa(+tr.dataset.arch); });
$('prehled').addEventListener('keydown', e => { const tr = e.target.closest('tr[data-arch]'); if (tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); jdiNa(+tr.dataset.arch); } });
$('vyberArchu').addEventListener('change', e => jdiNa(+e.target.value));
// přejetí prstem po náhledu = další / předchozí arch (tablet)
{
  let x0 = null, y0 = 0;
  const archy = document.querySelector('.archy');
  archy.addEventListener('touchstart', e => { if (e.touches.length === 1) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; } else x0 = null; }, { passive: true });
  archy.addEventListener('touchend', e => {
    if (x0 === null) return;
    const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0; x0 = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > 2 * Math.abs(dy)) jdiNa(S.arch + (dx < 0 ? 1 : -1));
  }, { passive: true });
}

function jdiNa(i) {
  if (!S.plan) return;
  S.arch = Math.max(0, Math.min(S.plan.archy.length - 1, i));
  $('vyberArchu').value = S.arch;
  document.querySelectorAll('#prehled tr[data-arch]').forEach(tr => tr.classList.toggle('aktivni', +tr.dataset.arch === S.arch));
  nahled();
}

let nahledCislo = 0, nahledCasovac = 0;
function nahled() { clearTimeout(nahledCasovac); nahledCasovac = setTimeout(kresliNahled, 60); }
async function kresliNahled() {
  const moje = ++nahledCislo, p = S.plan, a = p.archy[S.arch];
  const sl = p.volby.rezim === 'slozky' ? ` · složka ${a.slozka + 1}/${p.slozek}, list ${a.list + 1}/${a.listu}` : '';
  $('nahledTitul').textContent = `Arch ${a.cislo} z ${p.archy.length}${sl}`;
  $('popisLic').textContent = J.popisStrany(a.lic);
  $('popisRub').textContent = J.popisStrany(a.rub);
  try {
    const bajty = await J.sestavPdf(PDFLib, S.doc, p, { archy: [S.arch], pismo: await pismo(), nazev: S.nazev });
    if (moje !== nahledCislo) return;
    const d = await pdfjsLib.getDocument({ data: bajty, ...PDFJS_VOLBY }).promise;
    for (const [i, cil] of [[1, 'platnoLic'], [2, 'platnoRub']]) {
      const str = await d.getPage(i);
      const sirka = Math.max(200, $(cil).clientWidth - 16);
      const v1 = str.getViewport({ scale: 1 });
      const dpr = window.devicePixelRatio || 1, mer = Math.min(sirka / v1.width, 520 / v1.height);
      const vp = str.getViewport({ scale: mer * dpr });
      const c = document.createElement('canvas');
      c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      c.style.width = Math.round(vp.width / dpr) + 'px';
      c.setAttribute('role', 'img');
      c.setAttribute('aria-label', `${i === 1 ? 'Líc' : 'Rub'}: ${J.popisStrany(i === 1 ? a.lic : a.rub)}`);
      await str.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
      if (moje !== nahledCislo) { d.destroy(); return; }
      $(cil).replaceChildren(c);
    }
    d.destroy();
  } catch (e) {
    console.error(e);
    $('platnoLic').textContent = 'Náhled se nepodařilo vykreslit: ' + e.message;
  }
}
let sirkaPred = 0;
new ResizeObserver(() => { const w = $('platnoLic').clientWidth; if (S.plan && Math.abs(w - sirkaPred) > 30) { sirkaPred = w; nahled(); } }).observe($('platnoLic'));

/* ---------- ukládání ---------- */
function stahni(bajty, jmeno, typ = 'application/pdf') {
  const url = URL.createObjectURL(new Blob([bajty], { type: typ }));
  const a = document.createElement('a'); a.href = url; a.download = jmeno;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
const zaklad = () => (S.nazev || 'kniha').replace(/\.pdf$/i, '');
const pripona = () => ({ sesitek: 'sesitek', slozky: 'slozky', lepena: 'listy', ctyri: '4na-list' }[nast.rezim]) + '-' + nast.arch;

async function sestav(volby) {
  const konec = prubeh('Skládám archy do PDF…');
  try { return await J.sestavPdf(PDFLib, S.doc, S.plan, { pismo: await pismo(), nazev: zaklad(), ...volby }); }
  catch (e) { Dialog.chyba('PDF se nepodařilo vytvořit: ' + e.message); return null; }
  finally { konec(); }
}
async function ulozit(oddelene) {
  if (!S.plan) return;
  if (oddelene) {
    const lic = await sestav({ strany: 'lic' }); if (!lic) return;
    stahni(lic, `${zaklad()}-archy-${pripona()}-1-lice.pdf`);
    // druhé stažení až po dalším klepnutí – Safari na iPadu jinak druhý soubor zahodí
    if (!(await Dialog.potvrd('Líce jsou uložené. Uložit i ruby?', { ok: 'Uložit ruby', zrus: 'Později' }))) return;
    const rub = await sestav({ strany: 'rub' }); if (!rub) return;
    stahni(rub, `${zaklad()}-archy-${pripona()}-2-ruby.pdf`);
    Dialog.info('Uloženo: líce a ruby zvlášť. Nejdřív vytiskněte líce, pak stoh obraťte a vytiskněte ruby.');
  } else {
    const b = await sestav({}); if (!b) return;
    stahni(b, `${zaklad()}-archy-${pripona()}.pdf`);
    Dialog.info(`Uloženo ${S.plan.archy.length * 2} stran PDF (${S.plan.archy.length} archů). Tiskněte oboustranně, 100 %.`);
  }
}
async function ulozitVybrane() {
  if (!S.plan) return;
  const pocet = S.plan.archy.length;
  const text = await Dialog.zeptej(`Které archy uložit? (1–${pocet}, např. 1, 3-5)`, String(S.arch + 1), { ok: 'Uložit' });
  if (text === null) return;
  let archy;
  try { archy = J.rozsahArchu(text, pocet); } catch (e) { Dialog.chyba(e.message); return; }
  const b = await sestav({ archy }); if (!b) return;
  stahni(b, `${zaklad()}-archy-${String(text).replace(/[^\d-]+/g, '_')}.pdf`);
  Dialog.info(`Uloženo ${archy.length} archů (${archy.length * 2} stran PDF).`);
}
// iPad / telefon: sdílecí nabídka systému (Tisk, Uložit do Souborů, AirDrop…)
const umiSdilet = () => { try { return !!(navigator.canShare && navigator.canShare({ files: [new File([new Uint8Array(1)], 'x.pdf', { type: 'application/pdf' })] })); } catch (e) { return false; } };
async function sdilet() {
  if (!S.plan) return;
  const b = await sestav({}); if (!b) return;
  const f = new File([b], `${zaklad()}-archy-${pripona()}.pdf`, { type: 'application/pdf' });
  try { await navigator.share({ files: [f], title: f.name }); }
  catch (e) { if (e.name !== 'AbortError') Dialog.chyba('Sdílení se nepodařilo: ' + e.message); }
}

/* ---------- příkazy ---------- */
const otevriOkno = id => { const d = $(id); if (!d.open) d.showModal(); };
function navod() {
  const r = nast.rezim;
  document.querySelectorAll('#oknoNavod [data-rezimy]').forEach(el => { el.hidden = !el.dataset.rezimy.split(' ').includes(r); });
  otevriOkno('oknoNavod');
}
const PRIKAZY = {
  otevrit: () => $('vstupSoubor').click(),
  ukazka: async () => {
    const konec = prubeh('Připravuji ukázkovou knihu…');
    try {
      const a6 = nast.rezim === 'ctyri';
      await nactiPdf(await J.ukazkovePdf(PDFLib, a6 ? 16 : 22, a6 ? { s: 105, v: 148 } : { s: 148, v: 210 }), a6 ? 'ukázka-A6.pdf' : 'ukázka-A5.pdf');
    } finally { konec(); }
  },
  ulozit: () => ulozit(nast.vystup === 'oddelene'),
  ulozitOddelene: () => ulozit(true),
  ulozitVybrane,
  sdilet,
  pouzijSpadavku: () => { const b = document.querySelector('[data-prikaz="pouzijSpadavku"]'); if (b) nastav({ spadavka: +b.dataset.mm }); },
  ulozitPrehled: () => S.plan && stahni(new TextEncoder().encode(J.prehledText(S.plan, S.nazev)), `${zaklad()}-prehled-archu.txt`, 'text/plain;charset=utf-8'),
  zavrit: async () => {
    if (!(await Dialog.potvrd('Zavřít PDF? Nastavení zůstane.', { ok: 'Zavřít', zrus: 'Ponechat' }))) return;
    Object.assign(S, { nazev: '', bajty: null, doc: null, plan: null });
    $('souborNazev').textContent = ''; smazPosledni(); prepocitej();
  },
  predchozi: () => jdiNa(S.arch - 1),
  dalsi: () => jdiNa(S.arch + 1),
  navod,
  napoveda: () => otevriOkno('oknoNapoveda'),
  vychozi: () => nastav(J.VYCHOZI)
};
for (const r of Object.keys(J.REZIMY)) PRIKAZY['rezim-' + r] = () => nastav({ rezim: r });
for (const a of Object.keys(J.ARCHY)) PRIKAZY['arch-' + a] = () => nastav({ arch: a });
PRIKAZY['meritko-zachovat'] = () => nastav({ meritko: 'zachovat' });
PRIKAZY['meritko-prizpusobit'] = () => nastav({ meritko: 'prizpusobit' });

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
  if (!e.target.closest('.nabidka')) zavriNabidky();
});
addEventListener('resize', zavriNabidky);
document.querySelectorAll('dialog [data-zavrit]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));

$('vstupSoubor').addEventListener('change', e => { otevritSoubor(e.target.files[0]); e.target.value = ''; });
let tahy = 0;
addEventListener('dragenter', e => { if (e.dataTransfer?.types.includes('Files')) { tahy++; document.body.classList.add('pretahuji'); } });
addEventListener('dragleave', () => { if (--tahy <= 0) { tahy = 0; document.body.classList.remove('pretahuji'); } });
addEventListener('dragover', e => e.preventDefault());
addEventListener('drop', e => {
  e.preventDefault(); tahy = 0; document.body.classList.remove('pretahuji');
  const f = e.dataTransfer?.files?.[0]; if (f) otevritSoubor(f);
});

addEventListener('keydown', e => {
  if (document.querySelector('dialog[open]') && e.key !== 'F1') return;
  const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
  if (ctrl && k === 'o') { e.preventDefault(); return PRIKAZY.otevrit(); }
  if (ctrl && k === 's') { e.preventDefault(); return PRIKAZY.ulozit(); }
  if (e.key === 'F1') { e.preventDefault(); return PRIKAZY.napoveda(); }
  if (e.key === 'Escape') return zavriNabidky();
  if (ctrl || e.altKey || /^(input|select|textarea)$/i.test(e.target.tagName)) return;
  if (e.key === 'ArrowLeft') { e.preventDefault(); PRIKAZY.predchozi(); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); PRIKAZY.dalsi(); }
  else if (k === 'n') navod();
});

if (window.self === window.top) document.body.classList.add('samostatne');
if (umiSdilet()) document.querySelectorAll('[data-prikaz="sdilet"]').forEach(b => { b.hidden = false; });
vyplnFormular();
prepocitej();
idb('readonly', s => s.get('posledni')).then(z => { if (z && z.bajty && !S.doc) nactiPdf(z.bajty, z.nazev, false); }).catch(() => {});
window.BROZURA_UI = { S, nastav, PRIKAZY };   // pro testy

/* ============================================================
   PDF dílna – uživatelské rozhraní (ES modul kvůli PDF.js).
   Model: S.stranky = [{id, zdroj, index, otoceni, puvod}] odkazují do
   neměnných zdrojů S.zdroje (bajty PDF). Přeřazení, otočení, mazání
   mění jen seznam; úpravy obsahu (vodoznak, podpis…) vytvoří z dotčených
   stránek nový zdroj a odkazy přesměrují. Zpět/Znovu = snímky seznamu.
   ============================================================ */
import * as pdfjsLib from '../lib/pdfjs/pdf.min.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('../lib/pdfjs/pdf.worker.min.mjs', import.meta.url).href;

const J = window.PDFDILNA;
const $ = id => document.getElementById(id);
const PREFIX = 'webapp_pdf_dilna_';
const PDFJS_VOLBY = { cMapUrl: 'lib/pdfjs/cmaps/', cMapPacked: true, standardFontDataUrl: 'lib/pdfjs/standard_fonts/', isEvalSupported: false };

function nactiLS(k, vychozi) { try { return JSON.parse(localStorage.getItem(PREFIX + k)) ?? vychozi; } catch (e) { return vychozi; } }
const nast = Object.assign({ vel: 'M', obrazky: 'a4', nastroje: {} }, nactiLS('nast', {}));
function ulozNast() { try { localStorage.setItem(PREFIX + 'nast', JSON.stringify(nast)); } catch (e) { /* plné úložiště */ } }

const S = {
  zdroje: new Map(),     // id → {id, nazev, bajty, doc (pdf-lib), pdfjs (Promise)}
  stranky: [],
  soubory: [],           // původ stránek: [{nazev, barva}] – jen pro popisky
  meta: {},
  vyber: new Set(),
  kotva: null,
  zpet: [], vpred: [],
  nahledy: new Map(),    // 'zdroj:index' → URL obrázku
};
let citac = 0;
const noveId = p => p + Date.now().toString(36) + (citac++).toString(36);
const klic = s => s.zdroj + ':' + s.index;
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const kB = n => n > 1048576 ? (n / 1048576).toFixed(2).replace('.', ',') + ' MB' : Math.max(1, Math.round(n / 1024)) + ' kB';
const BARVY = [210, 25, 140, 280, 50, 330, 175, 95];
const barvaSouboru = i => `hsl(${BARVY[i % BARVY.length]} 65% 52%)`;

/* ---------- zdroje ---------- */

function pridejZdroj(bajty, nazev, id) {
  id = id || noveId('z');
  S.zdroje.set(id, { id, nazev, bajty, doc: null, pdfjs: null });
  return id;
}
async function pdfLibDoc(zid) {
  const z = S.zdroje.get(zid);
  if (!z.doc) z.doc = await J.nacti(z.bajty);
  return z.doc;
}
async function mapaDoku(stranky) {
  const m = new Map();
  for (const s of stranky) if (!m.has(s.zdroj)) m.set(s.zdroj, await pdfLibDoc(s.zdroj));
  return m;
}
function pdfjsDoc(zid) {
  const z = S.zdroje.get(zid);
  if (!z.pdfjs) z.pdfjs = pdfjsLib.getDocument({ data: z.bajty.slice(), ...PDFJS_VOLBY }).promise;
  return z.pdfjs;
}
// uvolní načtené dokumenty zdrojů, na které nic neodkazuje (bajty zůstanou kvůli Zpět)
function uklidZdroje() {
  const pouzite = new Set(S.stranky.map(s => s.zdroj));
  for (const z of S.zdroje.values()) {
    if (pouzite.has(z.id)) continue;
    if (z.pdfjs) { z.pdfjs.then(d => d.destroy()).catch(() => {}); z.pdfjs = null; }
    z.doc = null;
  }
}

let fontP = null;
const fontBajty = () => fontP || (fontP = fetch('lib/pdflib/LiberationSans-Regular.ttf').then(r => r.arrayBuffer()));
async function pismo(doc) {
  doc.registerFontkit(window.fontkit);
  return doc.embedFont(await fontBajty(), { subset: true });
}

/* ---------- zpět / znovu ---------- */

const snimek = popis => ({ popis, stranky: S.stranky.map(s => ({ ...s })), meta: { ...S.meta } });
function zmena(popis, fn) {
  S.zpet.push(snimek(popis));
  if (S.zpet.length > 60) S.zpet.shift();
  S.vpred = [];
  fn();
  poZmene();
}
function obnov(sn) {
  S.stranky = sn.stranky; S.meta = sn.meta;
  const ids = new Set(S.stranky.map(s => s.id));
  S.vyber = new Set([...S.vyber].filter(id => ids.has(id)));
}
function zpet() {
  const sn = S.zpet.pop(); if (!sn) return;
  S.vpred.push(snimek(sn.popis)); obnov(sn); poZmene();
  Dialog.info('↶ Vráceno: ' + sn.popis);
}
function vpred() {
  const sn = S.vpred.pop(); if (!sn) return;
  S.zpet.push(snimek(sn.popis)); obnov(sn); poZmene();
  Dialog.info('↷ Znovu: ' + sn.popis);
}
function poZmene() { prekresli(); ulozPraci(); uklidZdroje(); }

/* ---------- průběh ---------- */

let prubehEl = null;
function prubeh(text, podil) {
  if (text == null) { prubehEl?.remove(); prubehEl = null; return; }
  if (!prubehEl) {
    prubehEl = document.createElement('div'); prubehEl.className = 'prubeh';
    prubehEl.innerHTML = '<div><span></span><progress max="1"></progress></div>';
    document.body.appendChild(prubehEl);
  }
  prubehEl.querySelector('span').textContent = text;
  const p = prubehEl.querySelector('progress');
  if (podil == null) p.removeAttribute('value'); else p.value = podil;
}
const chvilka = () => new Promise(r => setTimeout(r, 0));

/* ---------- načítání souborů ---------- */

const canvasBajty = (c, typ, q) => new Promise((ok, ko) => c.toBlob(b => b ? b.arrayBuffer().then(a => ok(new Uint8Array(a))) : ko(new Error('Obrázek se nepodařilo převést')), typ, q));

// obrázek → {data, typ: 'png'|'jpg'} použitelný v pdf-lib (WebP a JPEG s EXIF otočením přes plátno)
async function obrazekProPdf(u8, typ) {
  const orient = typ === 'jpg' ? J.exifOrientace(u8) : 1;
  if (typ !== 'webp' && orient === 1) return { data: u8, typ };
  const bmp = await createImageBitmap(new Blob([u8]));   // EXIF otočení použije prohlížeč
  const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
  c.getContext('2d').drawImage(bmp, 0, 0);
  let pruhledny = false;
  if (typ === 'webp') {   // průhlednost zkusit na zmenšenině – fotky bez ní jdou do JPEG (menší)
    const m = document.createElement('canvas'); m.width = m.height = 64;
    const mc = m.getContext('2d'); mc.drawImage(bmp, 0, 0, 64, 64);
    const d = mc.getImageData(0, 0, 64, 64).data;
    for (let i = 3; i < d.length; i += 4) if (d[i] < 255) { pruhledny = true; break; }
  }
  bmp.close();
  return pruhledny ? { data: await canvasBajty(c, 'image/png'), typ: 'png' } : { data: await canvasBajty(c, 'image/jpeg', 0.92), typ: 'jpg' };
}

async function nactiSoubory(soubory) {
  soubory = [...soubory];
  if (!soubory.length) return;
  const nove = [];
  let prvniMeta = null;
  try {
    for (const [i, f] of soubory.entries()) {
      prubeh(`Načítám ${f.name}…`, i / soubory.length);
      let zid = null;
      try {
        const u8 = new Uint8Array(await f.arrayBuffer());
        const typ = J.typSouboru(u8);
        let bajty;
        if (typ === 'pdf') bajty = u8;
        else if (typ) { const o = await obrazekProPdf(u8, typ); bajty = await J.obrazekNaPdf(o.data, o.typ, { rezim: nast.obrazky }); }
        else { Dialog.chyba(`${f.name}: nepodporovaný typ (umím PDF, JPG, PNG, WebP)`); continue; }
        zid = pridejZdroj(bajty, f.name);
        const doc = await pdfLibDoc(zid);
        if (typ === 'pdf' && !prvniMeta) prvniMeta = J.cteniMeta(doc);
        const puvod = S.soubory.push({ nazev: f.name, barva: barvaSouboru(S.soubory.length) }) - 1;
        for (let k = 0; k < doc.getPageCount(); k++) nove.push({ id: noveId('s'), zdroj: zid, index: k, otoceni: 0, puvod, str: k + 1 });
      } catch (e) {
        if (zid) S.zdroje.delete(zid);
        Dialog.chyba(`${f.name}: ${e.message || e}`);
      }
    }
  } finally { prubeh(null); }
  if (!nove.length) return;
  zmena(`Přidáno ${nove.length} str.`, () => {
    if (!S.stranky.length && prvniMeta) S.meta = { nazev: prvniMeta.nazev, autor: prvniMeta.autor, predmet: prvniMeta.predmet, klicova: prvniMeta.klicova };
    S.stranky.push(...nove);
  });
  Dialog.info(`Přidáno ${nove.length} ${nove.length === 1 ? 'stránka' : nove.length < 5 ? 'stránky' : 'stránek'}`);
}

/* ---------- mřížka náhledů ---------- */

const plocha = $('plocha'), mrizka = $('mrizka');
const pozorovatel = new IntersectionObserver(zaznamy => {
  for (const z of zaznamy) {
    if (!z.isIntersecting) continue;
    pozorovatel.unobserve(z.target);
    const s = stranka(z.target.dataset.id);
    if (s) zaradNahled(s);
  }
}, { root: plocha, rootMargin: '400px' });

const stranka = id => S.stranky.find(s => s.id === id);
const vybrane = () => S.stranky.filter(s => S.vyber.has(s.id));

function obrazekKarty(url, otoceni) {
  const img = document.createElement('img');
  img.src = url; img.alt = ''; img.draggable = false;
  if (otoceni) {
    img.style.transform = `rotate(${otoceni}deg)`;
    if (otoceni % 180) { img.style.maxWidth = '133%'; img.style.maxHeight = '75%'; }
  }
  return img;
}

function karta(s, i) {
  const k = document.createElement('div');
  k.className = 'karta' + (S.vyber.has(s.id) ? ' vybrana' : '');
  k.dataset.id = s.id; k.tabIndex = 0;
  const sb = S.soubory[s.puvod];
  if (sb) k.style.setProperty('--sb', sb.barva);
  k.setAttribute('aria-label', `Stránka ${i + 1}`);
  const obr = document.createElement('div'); obr.className = 'obr';
  const url = S.nahledy.get(klic(s));
  if (url) obr.appendChild(obrazekKarty(url, s.otoceni));
  else { obr.innerHTML = '<div class="nacitam"></div>'; pozorovatel.observe(k); }
  k.appendChild(obr);
  k.insertAdjacentHTML('beforeend', `<div class="popis"><b>${i + 1}</b><span title="${esc(sb ? sb.nazev : '')}">${esc(sb ? sb.nazev : '')} · ${s.str || s.index + 1}</span></div>
    <div class="akce-k"><button type="button" data-akce="otocVpravo" title="Otočit doprava" aria-label="Otočit doprava">⟳</button><button type="button" data-akce="duplikovat" title="Duplikovat" aria-label="Duplikovat">⧉</button><button type="button" data-akce="smazat" title="Smazat" aria-label="Smazat">🗑</button></div>`);
  return k;
}

function prekresli() {
  const ma = S.stranky.length > 0;
  $('prazdne').hidden = ma; $('prace').hidden = !ma;
  pozorovatel.disconnect();
  mrizka.dataset.vel = nast.vel;
  const frag = document.createDocumentFragment();
  S.stranky.forEach((s, i) => frag.appendChild(karta(s, i)));
  mrizka.replaceChildren(frag);
  const pouzite = [...new Set(S.stranky.map(s => s.puvod))];
  $('soubory').innerHTML = pouzite.map(p => S.soubory[p] ? `<span class="soubor-stitek" style="--sb:${S.soubory[p].barva}" title="${esc(S.soubory[p].nazev)}">${esc(S.soubory[p].nazev)}</span>` : '').join('');
  oznacVyber();
}

function oznacVyber() {
  for (const k of mrizka.children) k.classList.toggle('vybrana', S.vyber.has(k.dataset.id));
  const n = S.stranky.length, v = S.vyber.size;
  $('pocet').textContent = n ? `${n} str.` : '';
  $('infoVyber').textContent = n ? (v ? `Vybráno ${v} z ${n} – přetáhni myší jinam, nebo použij nástroje` : `${n} stránek – klik vybere, Ctrl/Shift přidá, tažením přeřadíš`) : '';
  document.querySelectorAll('[data-potreba]').forEach(b => {
    b.disabled = b.dataset.potreba === 'vyber' ? !v : !n;
  });
  $('tlZpet').disabled = !S.zpet.length; $('tlVpred').disabled = !S.vpred.length;
  $('tlZpet').title = S.zpet.length ? `Zpět: ${S.zpet.at(-1).popis} (Ctrl+Z)` : 'Zpět (Ctrl+Z)';
  $('tlVpred').title = S.vpred.length ? `Znovu: ${S.vpred.at(-1).popis} (Ctrl+Y)` : 'Znovu (Ctrl+Y)';
  document.querySelectorAll('[data-prikaz^="vel-"]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.prikaz === 'vel-' + nast.vel)));
  document.querySelector('[data-prikaz="obrA4"]').setAttribute('aria-pressed', String(nast.obrazky === 'a4'));
  document.querySelector('[data-prikaz="obrVelikost"]').setAttribute('aria-pressed', String(nast.obrazky !== 'a4'));
}

/* náhledy se kreslí po jednom (šetří paměť), jen viditelné */
const fronta = [];
let fronteBezi = false;
function zaradNahled(s) {
  const k = klic(s);
  if (S.nahledy.has(k) || fronta.some(f => f.k === k)) return;
  fronta.push({ k, zdroj: s.zdroj, index: s.index });
  pustFrontu();
}
async function pustFrontu() {
  if (fronteBezi) return;
  fronteBezi = true;
  while (fronta.length) {
    const f = fronta.shift();
    try {
      const page = await (await pdfjsDoc(f.zdroj)).getPage(f.index + 1);
      const c = await vykresli(page, 300, 300, page.rotate, 1);
      const b = await canvasBajty(c, 'image/jpeg', 0.85);
      S.nahledy.set(f.k, URL.createObjectURL(new Blob([b], { type: 'image/jpeg' })));
      for (const k of mrizka.children) {
        const s = stranka(k.dataset.id);
        if (s && klic(s) === f.k) k.querySelector('.obr').replaceChildren(obrazekKarty(S.nahledy.get(f.k), s.otoceni));
      }
    } catch (e) { console.warn('náhled', e); }
  }
  fronteBezi = false;
}

// vykreslí stránku PDF.js do nového plátna, aby se vešla do maxW×maxH CSS px
async function vykresli(page, maxW, maxH, rotace, dpr) {
  dpr = dpr || Math.min(devicePixelRatio || 1, 2);
  const v0 = page.getViewport({ scale: 1, rotation: rotace });
  const meritko = Math.min(maxW / v0.width, maxH / v0.height);
  const vp = page.getViewport({ scale: meritko * dpr, rotation: rotace });
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(vp.width)); c.height = Math.max(1, Math.round(vp.height));
  c.style.width = Math.round(vp.width / dpr) + 'px'; c.style.height = Math.round(vp.height / dpr) + 'px';
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  return c;
}
// stránka ze seznamu tak, jak bude vypadat (včetně otočení)
async function vykresliStranku(s, maxW, maxH) {
  const page = await (await pdfjsDoc(s.zdroj)).getPage(s.index + 1);
  return vykresli(page, maxW, maxH, (page.rotate + s.otoceni) % 360);
}

/* ---------- výběr a přetahování ---------- */

let typUkazatele = 'mouse', potlacKlik = false;
function klikNaKartu(id, e) {
  const multi = e.ctrlKey || e.metaKey || typUkazatele === 'touch';
  if (e.shiftKey && S.kotva && stranka(S.kotva)) {
    const a = S.stranky.findIndex(s => s.id === S.kotva), b = S.stranky.findIndex(s => s.id === id);
    if (!multi) S.vyber.clear();
    for (let i = Math.min(a, b); i <= Math.max(a, b); i++) S.vyber.add(S.stranky[i].id);
  } else if (multi) {
    S.vyber.has(id) ? S.vyber.delete(id) : S.vyber.add(id);
    S.kotva = id;
  } else {
    S.vyber = new Set([id]); S.kotva = id;
  }
  kurzor = id;
  oznacVyber();
}

mrizka.addEventListener('click', e => {
  if (potlacKlik) { potlacKlik = false; return; }
  const k = e.target.closest('.karta'); if (!k) return;
  const akce = e.target.closest('[data-akce]');
  if (akce) {
    if (!S.vyber.has(k.dataset.id)) { S.vyber = new Set([k.dataset.id]); S.kotva = k.dataset.id; }
    return PRIKAZY[akce.dataset.akce]();
  }
  klikNaKartu(k.dataset.id, e);
});
mrizka.addEventListener('dblclick', e => { const k = e.target.closest('.karta'); if (k && !e.target.closest('[data-akce]')) nahled(k.dataset.id); });
plocha.addEventListener('click', e => { if (!e.target.closest('.karta,button,.panel-vyber') && S.vyber.size) { S.vyber.clear(); oznacVyber(); } });

let tah = null;
mrizka.addEventListener('pointerdown', e => {
  typUkazatele = e.pointerType;
  const k = e.target.closest('.karta');
  if (!k || e.button !== 0 || e.pointerType === 'touch' || e.target.closest('[data-akce]')) return;
  tah = { id: k.dataset.id, x: e.clientX, y: e.clientY, aktivni: false, cil: undefined, duch: null };
});
addEventListener('pointermove', e => {
  if (!tah) return;
  if (!tah.aktivni) {
    if (Math.hypot(e.clientX - tah.x, e.clientY - tah.y) < 6) return;
    tah.aktivni = true;
    if (!S.vyber.has(tah.id)) { S.vyber = new Set([tah.id]); S.kotva = tah.id; oznacVyber(); }
    for (const k of mrizka.children) if (S.vyber.has(k.dataset.id)) k.classList.add('tazena');
    tah.duch = document.createElement('div'); tah.duch.className = 'duch';
    tah.duch.textContent = S.vyber.size === 1 ? '1 stránka' : `${S.vyber.size} stránek`;
    document.body.appendChild(tah.duch);
  }
  tah.duch.style.left = (e.clientX + 14) + 'px'; tah.duch.style.top = (e.clientY + 10) + 'px';
  mrizka.querySelectorAll('.cil-pred,.cil-za').forEach(k => k.classList.remove('cil-pred', 'cil-za'));
  const k = document.elementFromPoint(e.clientX, e.clientY)?.closest('.karta');
  if (k) {
    const r = k.getBoundingClientRect(), pred = e.clientX < r.left + r.width / 2;
    k.classList.add(pred ? 'cil-pred' : 'cil-za');
    tah.cil = pred ? k.dataset.id : (k.nextElementSibling ? k.nextElementSibling.dataset.id : null);
  }
  const rp = plocha.getBoundingClientRect();   // posun plochy u okraje
  if (e.clientY < rp.top + 40) plocha.scrollTop -= 20;
  else if (e.clientY > rp.bottom - 40) plocha.scrollTop += 20;
});
function konecTahu() {
  if (!tah) return;
  const t = tah; tah = null;
  if (!t.aktivni) return;
  potlacKlik = true; setTimeout(() => { potlacKlik = false; }, 0);
  t.duch.remove();
  mrizka.querySelectorAll('.tazena,.cil-pred,.cil-za').forEach(k => k.classList.remove('tazena', 'cil-pred', 'cil-za'));
  if (t.cil === undefined) return;
  const novy = J.presun(S.stranky, S.vyber, t.cil);
  if (novy.some((s, i) => s !== S.stranky[i])) zmena('Přesun stránek', () => { S.stranky = novy; });
}
addEventListener('pointerup', konecTahu);
addEventListener('pointercancel', konecTahu);

/* ---------- operace se stránkami ---------- */

function otoc(delta) {
  const v = vybrane(); if (!v.length) return;
  zmena('Otočení', () => { for (const s of S.stranky) if (S.vyber.has(s.id)) s.otoceni = (s.otoceni + delta + 360) % 360; });
}
function smazat() {
  const n = S.vyber.size; if (!n) return;
  zmena(`Smazání ${n} str.`, () => { S.stranky = S.stranky.filter(s => !S.vyber.has(s.id)); S.vyber.clear(); });
  Dialog.info(`Smazáno ${n} – Ctrl+Z vrátí`);
}
function duplikovat() {
  if (!S.vyber.size) return;
  const nove = new Set();
  zmena('Duplikování', () => {
    S.stranky = S.stranky.flatMap(s => {
      if (!S.vyber.has(s.id)) return [s];
      const k = { ...s, id: noveId('s') }; nove.add(k.id);
      return [s, k];
    });
    S.vyber = nove;
  });
}
function posun(smer) {
  if (!S.vyber.size) return;
  const idx = S.stranky.map((s, i) => S.vyber.has(s.id) ? i : -1).filter(i => i >= 0);
  let cil;
  if (smer < 0) { if (idx[0] === 0) return; cil = S.stranky[idx[0] - 1].id; }
  else { const l = idx.at(-1); if (l === S.stranky.length - 1) return; cil = S.stranky[l + 2] ? S.stranky[l + 2].id : null; }
  zmena('Přesun stránek', () => { S.stranky = J.presun(S.stranky, S.vyber, cil); });
  mrizka.querySelector('.karta.vybrana')?.scrollIntoView({ block: 'nearest' });
}
async function vlozPrazdnou() {
  let w = J.A4[0], h = J.A4[1];
  const v = vybrane(), vzor = v.at(-1) || S.stranky.at(-1);
  if (vzor) {
    const r = J.vizualni((await pdfLibDoc(vzor.zdroj)).getPage(vzor.index));
    [w, h] = vzor.otoceni % 180 ? [r.h, r.w] : [r.w, r.h];
  }
  const zid = pridejZdroj(await J.prazdna(w, h), 'prázdná');
  const puvod = S.soubory.findIndex(s => s.nazev === 'prázdné stránky');
  const p = puvod >= 0 ? puvod : S.soubory.push({ nazev: 'prázdné stránky', barva: 'var(--border-strong)' }) - 1;
  const nova = { id: noveId('s'), zdroj: zid, index: 0, otoceni: 0, puvod: p, str: 1 };
  const za = v.length ? S.stranky.indexOf(v.at(-1)) + 1 : S.stranky.length;
  zmena('Prázdná stránka', () => { S.stranky.splice(za, 0, nova); S.vyber = new Set([nova.id]); S.kotva = nova.id; });
}
function obratit() {
  const v = S.vyber.size > 1;
  zmena('Obrácení pořadí', () => {
    if (!v) { S.stranky.reverse(); return; }
    const poz = S.stranky.map((s, i) => S.vyber.has(s.id) ? i : -1).filter(i => i >= 0);
    const obr = poz.map(i => S.stranky[i]).reverse();
    poz.forEach((i, k) => { S.stranky[i] = obr[k]; });
  });
}
function vyberPodle(fn) { S.vyber = new Set(S.stranky.filter(fn).map(s => s.id)); oznacVyber(); }
async function vybratRozsah() {
  const t = await Dialog.zeptej('Vybrat stránky (např. 1-3,5,8-):', '1-3');
  if (t == null) return;
  try {
    const sk = J.rozsahy(t, S.stranky.length).flat();
    vyberPodle((s, i) => sk.includes(i));
  } catch (e) { Dialog.chyba(e.message); }
}

/* ---------- export ---------- */

function zakladNazvu() {
  const pdf = S.soubory.filter((s, i) => S.stranky.some(p => p.puvod === i));
  const z = pdf.length === 1 ? pdf[0].nazev.replace(/\.[^.]+$/, '') : (pdf.length ? 'spojeno' : 'dokument');
  return z.replace(/[\\/:*?"<>|]+/g, '_');
}
function stahni(bajty, nazev, typ) {
  const url = URL.createObjectURL(new Blob([bajty], { type: typ || 'application/pdf' }));
  const a = document.createElement('a'); a.href = url; a.download = nazev;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
async function sestavBajty(stranky) {
  const doc = await J.sestav(await mapaDoku(stranky), stranky);
  return J.uloz(doc, S.meta.smazat ? { smazat: true } : S.meta);
}
async function exportuj(jenVybrane) {
  const st = jenVybrane ? vybrane() : S.stranky;
  if (!st.length) return;
  prubeh('Sestavuji PDF…');
  try {
    const b = await sestavBajty(st);
    stahni(b, zakladNazvu() + (jenVybrane ? '_vyber' : '_upraveno') + '.pdf');
    Dialog.info(`Uloženo: ${st.length} str., ${kB(b.length)}`);
  } catch (e) { Dialog.chyba('Export selhal: ' + (e.message || e)); }
  finally { prubeh(null); }
}

/* ---------- okno nástroje ---------- */

const okno = $('okno');
let poZavreniOkna = null;
function otevriOkno(titul, teloHtml, { male = false } = {}) {
  $('oknoTitul').textContent = titul;
  $('oknoTelo').innerHTML = teloHtml;
  $('oknoPata').innerHTML = '';
  okno.classList.toggle('male', male);
  if (!okno.open) okno.showModal();
  return { telo: $('oknoTelo'), pata: $('oknoPata') };
}
function zavriOkno() { if (okno.open) okno.close(); }
okno.addEventListener('close', () => { const f = poZavreniOkna; poZavreniOkna = null; if (f) f(); });
$('oknoZavrit').onclick = zavriOkno;
function tlacitkoPaty(pata, text, akce, hlavni) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'btn' + (hlavni ? ' primary' : ''); b.textContent = text; b.onclick = akce;
  pata.appendChild(b); return b;
}

// hodnoty formuláře podle atributu name (čísla jako čísla, zaškrtávátka jako bool)
function hodnoty(form) {
  const o = {};
  form.querySelectorAll('[name]').forEach(el => {
    if (el.type === 'file') return;
    if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; return; }
    o[el.name] = el.type === 'checkbox' ? el.checked : (el.type === 'number' || el.type === 'range') ? Number(el.value) : el.value;
  });
  return o;
}
function vyplnFormular(form, o) {
  for (const [k, v] of Object.entries(o || {})) {
    form.querySelectorAll(`[name="${k}"]`).forEach(el => {
      if (el.type === 'file') return;
      if (el.type === 'radio') el.checked = el.value === v;
      else if (el.type === 'checkbox') el.checked = !!v;
      else el.value = v;
    });
  }
}

const ROZSAH_HTML = `<label>Použít na <select name="rozsah"><option value="vse">všechny stránky</option><option value="vybrane">vybrané stránky</option></select></label>`;
const cilPodleRozsahu = o => (o.rozsah === 'vybrane' && S.vyber.size) ? vybrane() : S.stranky.slice();

// z dotčených stránek vytvoří nový zdroj s upraveným obsahem a odkazy na ně přesměruje
async function upravObsah(popis, cil, fn) {
  if (!cil.length) return false;
  prubeh(popis + '…');
  try {
    const doc = await J.sestav(await mapaDoku(cil), cil);
    const vysl = (await fn(doc, cil)) || doc;
    const bajty = await vysl.save({ useObjectStreams: true });
    const zid = pridejZdroj(bajty, popis);
    const poradi = new Map(cil.map((s, k) => [s.id, k]));
    zmena(popis, () => {
      S.stranky = S.stranky.map(s => poradi.has(s.id) ? { ...s, zdroj: zid, index: poradi.get(s.id), otoceni: 0 } : s);
    });
    return true;
  } catch (e) {
    Dialog.chyba(popis + ' selhalo: ' + (e.message || e));
    return false;
  } finally { prubeh(null); }
}

/* Nástroj s živým náhledem: def = {id, titul, formular, cil(o)?, proved(doc, o, cil), poPouziti?} */
function nastroj(def) {
  const { telo, pata } = otevriOkno(def.titul, `<div class="formular" id="fNastroj">${def.formular}</div>
    <div><div class="nahled-plocha" id="nPlocha"><span class="stav" id="nStav">Náhled…</span></div>
    <div class="navigace"><button type="button" class="tl ik" id="nPred" aria-label="Předchozí stránka">◀</button><span id="nInfo"></span><button type="button" class="tl ik" id="nDalsi" aria-label="Další stránka">▶</button></div></div>`);
  const form = telo.querySelector('#fNastroj');
  const roz = form.querySelector('[name=rozsah]');
  if (roz) roz.value = S.vyber.size && S.vyber.size < S.stranky.length ? 'vybrane' : 'vse';
  vyplnFormular(form, nast.nastroje[def.id]);
  if (roz && !S.vyber.size) roz.value = 'vse';
  def.priprav?.(form);
  let poz = 0, token = 0, casovac = null;
  const cil = () => (def.cil || cilPodleRozsahu)(hodnoty(form));
  async function obnov() {
    const t = ++token;
    const c = cil(); poz = Math.max(0, Math.min(poz, c.length - 1));
    const s = c[poz];
    $('nInfo').textContent = c.length ? `str. ${S.stranky.indexOf(s) + 1} (${poz + 1}/${c.length} upravovaných)` : 'žádná stránka';
    if (!s) return;
    $('nStav').textContent = 'Počítám náhled…';
    try {
      const doc = await J.sestav(await mapaDoku([s]), [s]);
      const vysl = (await def.proved(doc, hodnoty(form), [s], true)) || doc;
      const bajty = await vysl.save(), velikost = bajty.length;   // PDF.js buffer předá workeru (odpojí ho)
      if (t !== token) return;
      const pdf = await pdfjsLib.getDocument({ data: bajty, ...PDFJS_VOLBY }).promise;
      const page = await pdf.getPage(1);
      const pl = $('nPlocha');
      const c2 = await vykresli(page, Math.max(200, pl.clientWidth - 24), Math.min(innerHeight * 0.62, 900), page.rotate);
      pdf.destroy();
      if (t !== token || !okno.open) return;
      pl.querySelector('canvas')?.remove(); pl.appendChild(c2);
      $('nStav').textContent = def.velikostVNahledu ? `Tato stránka po úpravě: ${kB(velikost)}` : '';
    } catch (e) { if (t === token) $('nStav').textContent = '⚠ ' + (e.message || e); }
  }
  const naplanuj = () => { clearTimeout(casovac); casovac = setTimeout(obnov, 350); };
  form.addEventListener('input', naplanuj);
  form.addEventListener('change', naplanuj);
  $('nPred').onclick = () => { poz--; obnov(); };
  $('nDalsi').onclick = () => { poz++; obnov(); };
  pata.insertAdjacentHTML('beforeend', '<span class="mezera"></span>');
  tlacitkoPaty(pata, 'Zrušit', zavriOkno);
  tlacitkoPaty(pata, 'Použít', async () => {
    const o = hodnoty(form);
    if (def.over) { const ch = def.over(o); if (ch) return Dialog.chyba(ch); }
    nast.nastroje[def.id] = o; ulozNast();
    const c = cil();
    zavriOkno();
    const pred = def.poPouziti ? await sestavBajty(S.stranky).then(b => b.length).catch(() => 0) : 0;
    if (await upravObsah(def.titul.replace(/^\S+\s/, ''), c, (doc, cc) => def.proved(doc, o, cc, false)) && def.poPouziti) def.poPouziti(pred);
  }, true);
  obnov();
}

/* ---------- jednotlivé nástroje ---------- */

const POZICE = [['nahore-vlevo', 'nahoře vlevo'], ['nahore-stred', 'nahoře uprostřed'], ['nahore-vpravo', 'nahoře vpravo'],
  ['dole-vlevo', 'dole vlevo'], ['dole-stred', 'dole uprostřed'], ['dole-vpravo', 'dole vpravo']];
const poziceHtml = vych => POZICE.map(([v, t]) => `<option value="${v}"${v === vych ? ' selected' : ''}>${t}</option>`).join('');
const ZNACKY = '<p class="pozn">Značky: <code>{n}</code> číslo stránky, <code>{celkem}</code> počet, <code>{datum}</code> dnešní datum, <code>{nazev}</code> název dokumentu (metadata), <code>{soubor}</code> název souboru.</p>';

async function souborObrazku(input) {
  const f = input.files[0]; if (!f) return null;
  const u8 = new Uint8Array(await f.arrayBuffer());
  const typ = J.typSouboru(u8);
  if (!['jpg', 'png', 'webp'].includes(typ)) throw new Error('Obrázek musí být JPG, PNG nebo WebP');
  return obrazekProPdf(u8, typ);
}

function vodoznak() {
  let obr = null;
  nastroj({
    id: 'vodoznak', titul: '💧 Vodoznak',
    formular: `<label>Druh <select name="druh"><option value="text">Text</option><option value="obrazek">Obrázek (logo)</option></select></label>
      <label data-druh="text">Text (může mít více řádků) <textarea name="text">DŮVĚRNÉ</textarea></label>
      <label data-druh="obrazek">Obrázek (PNG s průhledností je nejlepší) <input type="file" name="soubor" accept="image/png,image/jpeg,image/webp"></label>
      <div class="dva"><label data-druh="text">Velikost písma (bodů) <input type="number" name="velikost" value="72" min="6" max="400"></label>
        <label data-druh="text">Barva <input type="color" name="barva" value="#c62828"></label>
        <label data-druh="obrazek">Šířka (% stránky) <input type="number" name="sirka" value="50" min="5" max="100"></label></div>
      <label>Krytí: <output id="vPr">25 %</output><input type="range" name="pruhlednost" min="5" max="100" value="25"></label>
      <div class="dva"><label>Úhel (°) <input type="number" name="uhel" value="45" min="-180" max="180"></label>
        <label data-druh="text">Rozmístění <select name="pozice"><option value="stred">uprostřed</option><option value="nahore">nahoře</option><option value="dole">dole</option><option value="dlazdice">dlaždice přes celou stránku</option></select></label></div>
      ${ROZSAH_HTML}<p class="pozn">Text se vkládá písmem Liberation Sans s českou diakritikou a zůstane označitelný.</p>`,
    priprav(form) {
      const prepni = () => {
        const d = form.querySelector('[name=druh]').value;
        form.querySelectorAll('[data-druh]').forEach(el => { el.hidden = el.dataset.druh !== d; });
        form.querySelector('#vPr').textContent = form.querySelector('[name=pruhlednost]').value + ' %';
      };
      form.addEventListener('input', prepni); prepni();
      form.querySelector('[name=soubor]').addEventListener('change', async e => {
        try { obr = await souborObrazku(e.target); } catch (er) { obr = null; Dialog.chyba(er.message); }
        form.dispatchEvent(new Event('change'));
      });
    },
    over: o => o.druh === 'obrazek' ? (obr ? '' : 'Vyber obrázek vodoznaku') : (o.text.trim() ? '' : 'Napiš text vodoznaku'),
    async proved(doc, o) {
      if (o.druh === 'obrazek') {
        if (obr) await J.vodoznakObrazek(doc, obr.data, obr.typ, { velikost: o.sirka / 100, pruhlednost: o.pruhlednost / 100, uhel: o.uhel });
      } else if (o.text.trim()) {
        J.vodoznak(doc, await pismo(doc), { text: o.text, velikost: o.velikost, barva: o.barva, pruhlednost: o.pruhlednost / 100,
          uhel: o.uhel, pozice: o.pozice, dlazdice: o.pozice === 'dlazdice' });
      }
    },
  });
}

function cislovani() {
  nastroj({
    id: 'cislovani', titul: '🔢 Číslování stránek',
    formular: `<label>Formát <input type="text" name="format" value="{n} / {celkem}"></label>
      <p class="pozn">Např. <code>{n}</code>, <code>Strana {n} z {celkem}</code>, <code>– {n} –</code></p>
      <label>Pozice <select name="pozice">${poziceHtml('dole-stred')}</select></label>
      <div class="dva"><label>Číslovat od stránky <input type="number" name="od" value="1" min="1"></label>
        <label>První číslo <input type="number" name="start" value="1" min="0"></label></div>
      <div class="dva"><label>Velikost písma <input type="number" name="velikost" value="10" min="5" max="72"></label>
        <label>Okraj (mm) <input type="number" name="okraj" value="10" min="0" max="100" step="0.5"></label></div>
      <label>Barva <input type="color" name="barva" value="#222222"></label>
      <p class="pozn">Stránky před „od stránky“ (např. titulní) zůstanou bez čísla. {celkem} = poslední použité číslo.</p>`,
    cil: o => S.stranky.slice(Math.max(0, (o.od || 1) - 1)),
    over: o => (o.od || 1) > S.stranky.length ? 'Dokument tolik stránek nemá' : '',
    async proved(doc, o, cil) {
      const od = Math.max(1, o.od || 1), celkem = o.start + S.stranky.length - od;
      const cisla = cil.map(s => ({ n: o.start + S.stranky.indexOf(s) - (od - 1), celkem }));
      J.textyNaOkraj(doc, await pismo(doc), [{ text: o.format, pozice: o.pozice }],
        { velikost: o.velikost, barva: o.barva, okrajMm: o.okraj, cisla, nazev: S.meta.nazev, soubor: zakladNazvu() });
    },
  });
}

function zahlavi() {
  const pole = POZICE.map(([v, t]) => `<label>${t[0].toUpperCase() + t.slice(1)} <input type="text" name="t_${v}"></label>`);
  nastroj({
    id: 'zahlavi', titul: '📑 Záhlaví a zápatí',
    formular: `<div class="dva">${pole.join('')}</div>${ZNACKY}
      <div class="dva"><label>Velikost písma <input type="number" name="velikost" value="9" min="5" max="72"></label>
        <label>Okraj (mm) <input type="number" name="okraj" value="10" min="0" max="100" step="0.5"></label></div>
      <label>Barva <input type="color" name="barva" value="#444444"></label>${ROZSAH_HTML}`,
    over: o => POZICE.some(([v]) => (o['t_' + v] || '').trim()) ? '' : 'Vyplň aspoň jedno pole',
    async proved(doc, o, cil) {
      const polozky = POZICE.map(([v]) => ({ text: o['t_' + v], pozice: v })).filter(p => p.text);
      if (!polozky.length) return;
      const cisla = cil.map(s => ({ n: S.stranky.indexOf(s) + 1, celkem: S.stranky.length }));
      J.textyNaOkraj(doc, await pismo(doc), polozky, { velikost: o.velikost, barva: o.barva, okrajMm: o.okraj, cisla, nazev: S.meta.nazev || '', soubor: zakladNazvu() });
    },
  });
  vyplnFormular($('fNastroj'), nast.nastroje.zahlavi || { 't_dole-vpravo': '{n} / {celkem}', 't_nahore-vlevo': '{soubor}' });
}

function orez() {
  nastroj({
    id: 'orez', titul: '✂ Oříznout okraje',
    formular: `<p class="pozn">Kolik milimetrů ubrat z každé strany (tak, jak stránku vidíš).</p>
      <div class="dva"><label>Nahoře <input type="number" name="horni" value="10" min="0" step="0.5"></label>
        <label>Dole <input type="number" name="dolni" value="10" min="0" step="0.5"></label>
        <label>Vlevo <input type="number" name="levy" value="10" min="0" step="0.5"></label>
        <label>Vpravo <input type="number" name="pravy" value="10" min="0" step="0.5"></label></div>
      ${ROZSAH_HTML}<p class="pozn">Ořez mění viditelnou oblast stránky (MediaBox/CropBox). Obsah mimo ni zůstává v souboru – pro skutečné odstranění použij zmenšení velikosti (rastrování).</p>`,
    proved(doc, o) { J.orez(doc, o); },
  });
}

function naA4() {
  nastroj({
    id: 'naA4', titul: '📐 Změnit velikost na A4',
    formular: `<p class="pozn">Každá stránka se zmenší nebo zvětší, aby se vešla na A4 (na výšku nebo na šířku podle svého tvaru), a vycentruje se.</p>
      <label>Okraj (mm) <input type="number" name="okraj" value="0" min="0" max="60" step="0.5"></label>${ROZSAH_HTML}`,
    proved: (doc, o) => J.naA4(doc, { okrajMm: o.okraj }),
  });
}

function zmensit() {
  nastroj({
    id: 'zmensit', titul: '🗜 Zmenšit velikost souboru', velikostVNahledu: true,
    formular: `<p class="varovani">⚠ Stránky se převedou na obrázky JPEG. <b>Text pak už nepůjde označit, kopírovat ani vyhledat</b>, odkazy a formulářová pole zmizí. Vhodné pro skeny a dokumenty k odeslání e-mailem.</p>
      <label>Rozlišení <select name="dpi"><option value="72">72 DPI – obrazovka, nejmenší</option><option value="100">100 DPI – e-mail</option><option value="150" selected>150 DPI – běžný tisk</option><option value="200">200 DPI</option><option value="300">300 DPI – kvalitní tisk</option></select></label>
      <label>Kvalita JPEG: <output id="zKv">70 %</output><input type="range" name="kvalita" min="30" max="95" value="70"></label>
      <label class="radek"><input type="checkbox" name="seda"> Ve stupních šedi</label>
      ${ROZSAH_HTML}`,
    priprav(form) {
      const kv = () => { form.querySelector('#zKv').textContent = form.querySelector('[name=kvalita]').value + ' %'; };
      form.addEventListener('input', kv); kv();
    },
    async proved(doc, o, cil, jenNahled) {
      const bajty = await doc.save();
      const pdf = await pdfjsLib.getDocument({ data: bajty, ...PDFJS_VOLBY }).promise;
      const strany = [], dpi = Number(o.dpi) || 150;
      try {
        for (let i = 1; i <= pdf.numPages; i++) {
          if (!jenNahled) { prubeh(`Převádím stránku ${i} z ${pdf.numPages}…`, (i - 1) / pdf.numPages); await chvilka(); }
          const page = await pdf.getPage(i);
          const vp = page.getViewport({ scale: dpi / 72 });
          const c = document.createElement('canvas');
          c.width = Math.round(vp.width); c.height = Math.round(vp.height);
          const ctx = c.getContext('2d');
          ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
          await page.render({ canvasContext: ctx, viewport: vp }).promise;
          if (o.seda) {
            const d = ctx.getImageData(0, 0, c.width, c.height), p = d.data;
            for (let k = 0; k < p.length; k += 4) p[k] = p[k + 1] = p[k + 2] = 0.299 * p[k] + 0.587 * p[k + 1] + 0.114 * p[k + 2];
            ctx.putImageData(d, 0, 0);
          }
          strany.push({ data: await canvasBajty(c, 'image/jpeg', o.kvalita / 100), w: vp.width * 72 / dpi, h: vp.height * 72 / dpi });
          c.width = c.height = 0;
          page.cleanup();
        }
      } finally { pdf.destroy(); }
      return J.pdfZJpegu(strany);
    },
    async poPouziti(pred) {
      const po = await sestavBajty(S.stranky).then(b => b.length).catch(() => 0);
      if (pred && po) Dialog.info(`Velikost dokumentu: ${kB(pred)} → ${kB(po)} (${po < pred ? '−' : '+'}${Math.abs(Math.round((1 - po / pred) * 100))} %)`);
    },
  });
}

async function metadata() {
  const m = S.meta;
  const { telo, pata } = otevriOkno('🏷 Metadata dokumentu', `<div class="formular" id="fMeta">
    <label>Název <input type="text" name="nazev"></label>
    <label>Autor <input type="text" name="autor"></label>
    <label>Předmět <input type="text" name="predmet"></label>
    <label>Klíčová slova (oddělená čárkou) <input type="text" name="klicova"></label>
    <label class="radek"><input type="checkbox" name="smazat"> Při exportu odstranit všechna metadata (Info i XMP)</label>
    <p class="pozn">Metadata se zapíšou při exportu. Původní hodnoty se převzaly z prvního otevřeného PDF.</p></div>`, { male: true });
  const form = telo.querySelector('#fMeta');
  vyplnFormular(form, { ...m, klicova: Array.isArray(m.klicova) ? m.klicova.join(', ') : (m.klicova || '').split(' ').filter(Boolean).join(', ') });
  const zamkni = () => form.querySelectorAll('input[type=text]').forEach(i => { i.disabled = form.querySelector('[name=smazat]').checked; });
  form.addEventListener('change', zamkni); zamkni();
  pata.insertAdjacentHTML('beforeend', '<span class="mezera"></span>');
  tlacitkoPaty(pata, 'Zrušit', zavriOkno);
  tlacitkoPaty(pata, 'Uložit', () => {
    const o = hodnoty(form);
    zavriOkno();
    zmena('Metadata', () => { S.meta = o; });
    Dialog.info(o.smazat ? 'Metadata se při exportu odstraní' : 'Metadata nastavena');
  }, true);
}

function rozdelit() {
  const n = S.stranky.length;
  const { telo, pata } = otevriOkno('✂ Rozdělit dokument', `<div class="formular" id="fRoz">
    <label class="radek"><input type="radio" name="rezim" value="poN" checked> Po <input type="number" name="n" value="1" min="1" max="${n}" style="width:80px"> stránkách</label>
    <label class="radek"><input type="radio" name="rezim" value="rozsahy"> Podle rozsahů <input type="text" name="rozsahy" placeholder="1-3,5,8-" style="flex:1"></label>
    <p class="pozn">Každá skupina oddělená čárkou je jeden soubor. <code>8-</code> = od 8. do konce, <code>5-3</code> = pozpátku.</p>
    <label class="radek"><input type="radio" name="rezim" value="jednotlive"> Každá stránka zvlášť</label>
    <p class="pozn" id="rozInfo"></p></div>`, { male: true });
  const form = telo.querySelector('#fRoz');
  vyplnFormular(form, nast.nastroje.rozdelit);
  const skupiny = () => {
    const o = hodnoty(form);
    if (o.rezim === 'rozsahy') return J.rozsahy(o.rozsahy, n);
    return o.rezim === 'jednotlive' ? J.jednotlive(n) : J.poN(n, o.n);
  };
  const info = () => {
    try {
      const sk = skupiny();
      const popis = sk.slice(0, 6).map(g => g.length === 1 ? g[0] + 1 : `${g[0] + 1}–${g.at(-1) + 1}`).join(', ') + (sk.length > 6 ? ', …' : '');
      $('rozInfo').textContent = `Vznikne ${sk.length} ${sk.length === 1 ? 'soubor' : sk.length < 5 ? 'soubory' : 'souborů'}: ${popis}` + (sk.length > 1 ? ' (stáhnou se jako ZIP)' : '');
    } catch (e) { $('rozInfo').textContent = '⚠ ' + e.message; }
  };
  form.addEventListener('input', info); info();
  pata.insertAdjacentHTML('beforeend', '<span class="mezera"></span>');
  tlacitkoPaty(pata, 'Zrušit', zavriOkno);
  tlacitkoPaty(pata, 'Rozdělit a stáhnout', async () => {
    let sk;
    try { sk = skupiny(); } catch (e) { return Dialog.chyba(e.message); }
    nast.nastroje.rozdelit = hodnoty(form); ulozNast();
    zavriOkno();
    const zaklad = zakladNazvu(), cifry = String(n).length, polozky = [];
    try {
      for (const [i, g] of sk.entries()) {
        prubeh(`Vytvářím soubor ${i + 1} z ${sk.length}…`, i / sk.length); await chvilka();
        const od = String(g[0] + 1).padStart(cifry, '0'), po = String(g.at(-1) + 1).padStart(cifry, '0');
        polozky.push({ name: `${zaklad}_${g.length === 1 ? od : od + '-' + po}.pdf`, data: await sestavBajty(g.map(k => S.stranky[k])) });
      }
      if (polozky.length === 1) stahni(polozky[0].data, polozky[0].name);
      else stahni(J.zip(polozky), zaklad + '_rozdeleno.zip', 'application/zip');
      Dialog.info(`Hotovo: ${polozky.length} ${polozky.length === 1 ? 'soubor' : 'souborů'}`);
    } catch (e) { Dialog.chyba('Rozdělení selhalo: ' + (e.message || e)); }
    finally { prubeh(null); }
  }, true);
}

/* ---------- podpis a razítko: umístění na náhledu stránky ---------- */

// ořízne průhledné okraje plátna, vrátí nové plátno (nebo null, když je prázdné)
function orizni(c) {
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    if (d[(y * c.width + x) * 4 + 3] > 10) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) return null;
  const p = 4, o = document.createElement('canvas');
  o.width = x1 - x0 + 1 + 2 * p; o.height = y1 - y0 + 1 + 2 * p;
  o.getContext('2d').drawImage(c, x0 - p, y0 - p, o.width, o.height, 0, 0, o.width, o.height);
  return o;
}

async function umisteni(druh) {
  const jePodpis = druh === 'podpis';
  const uloz = nast.nastroje[druh] || {};
  const ulozenyPodpis = jePodpis ? await idb('get', 'podpis').catch(() => null) : null;
  const formular = jePodpis ? `
    <div class="zalozky" role="tablist">
      <button type="button" class="tl" data-zal="kreslit" aria-pressed="true">✏️ Nakreslit</button>
      <button type="button" class="tl" data-zal="nahrat" aria-pressed="false">🖼 Obrázek</button>
      ${ulozenyPodpis ? '<button type="button" class="tl" data-zal="ulozeny" aria-pressed="false">💾 Uložený</button>' : ''}
    </div>
    <div data-panel="kreslit"><canvas class="kresleni" id="kPlatno" width="900" height="300" aria-label="Plocha pro podpis myší nebo prstem"></canvas>
      <div class="dva" style="margin-top:6px"><label>Barva <select name="barva"><option value="#111111">černá</option><option value="#1a3fa8">modrá</option></select></label>
      <label>Tloušťka <input type="range" name="tloustka" min="2" max="12" value="5"></label></div>
      <button type="button" class="btn" id="kSmazat" style="margin-top:6px">Vymazat</button></div>
    <div data-panel="nahrat" hidden><label>Sken nebo fotka podpisu <input type="file" id="pSoubor" accept="image/png,image/jpeg,image/webp"></label>
      <label class="radek"><input type="checkbox" name="bezPozadi" checked> Odstranit bílé pozadí</label></div>
    <div data-panel="ulozeny" hidden><p class="pozn">Použije se podpis uložený v tomto prohlížeči.</p></div>
    <label class="radek"><input type="checkbox" name="zapamatovat"> Zapamatovat podpis v tomto prohlížeči</label>
    <button type="button" class="btn" id="pNahled">↻ Zobrazit podpis na stránce</button>`
    : `<label>Text razítka <textarea name="text">SCHVÁLENO\n{datum}</textarea></label>
    <div class="dva"><label>Datum pro {datum} <input type="date" name="datum"></label><label>Barva <input type="color" name="barva" value="#1a3fa8"></label></div>
    <label class="radek"><input type="checkbox" name="ramecek" checked> Rámeček</label>`;
  const { telo, pata } = otevriOkno(jePodpis ? '✍️ Podpis' : '🔖 Razítko', `<div class="formular" id="fUm">${formular}
    <label>Vložit na <select name="kam"><option value="tato">zobrazenou stránku</option><option value="vybrane">vybrané stránky</option><option value="vse">všechny stránky</option></select></label>
    <p class="pozn">Rámeček na náhledu posuň myší nebo prstem, za kulatý úchyt zvětšíš.</p></div>
    <div><div class="nahled-plocha"><div class="umisteni" id="uPlocha"></div></div>
    <div class="navigace"><button type="button" class="tl ik" id="uPred" aria-label="Předchozí stránka">◀</button><span id="uInfo"></span><button type="button" class="tl ik" id="uDalsi" aria-label="Další stránka">▶</button></div></div>`);
  const form = telo.querySelector('#fUm');
  vyplnFormular(form, uloz);
  if (!jePodpis) form.querySelector('[name=datum]').value = new Date().toISOString().slice(0, 10);
  form.querySelector('[name=kam]').value = S.vyber.size > 1 ? 'vybrane' : 'tato';

  let poz = Math.max(0, S.stranky.findIndex(s => S.vyber.has(s.id)));
  let ram = jePodpis ? { fx: 0.58, fy: 0.78, fw: 0.3, fh: 0.08 } : { fx: 0.6, fy: 0.06, fw: 0.3, fh: 0.09 };
  let pomer = 1 / 3;           // výška/šířka obrázku podpisu
  let podpisPng = null;        // bajty PNG
  const plochaU = $('uPlocha');
  let platno = null, ramEl = null;

  // --- kreslení podpisu ---
  let zalozka = 'kreslit', nahranyPodpis = null;
  if (jePodpis) {
    const kp = $('kPlatno'), kc = kp.getContext('2d');
    let kresli = null;
    const bod = e => { const r = kp.getBoundingClientRect(); return [(e.clientX - r.left) * kp.width / r.width, (e.clientY - r.top) * kp.height / r.height]; };
    kp.addEventListener('pointerdown', e => {
      kp.setPointerCapture(e.pointerId); kresli = bod(e);
      kc.strokeStyle = form.querySelector('[name=barva]').value; kc.lineWidth = Number(form.querySelector('[name=tloustka]').value);
      kc.lineCap = kc.lineJoin = 'round';
      kc.beginPath(); kc.arc(kresli[0], kresli[1], kc.lineWidth / 2, 0, 7); kc.fillStyle = kc.strokeStyle; kc.fill();
    });
    kp.addEventListener('pointermove', e => {
      if (!kresli) return;
      const b = bod(e);
      kc.beginPath(); kc.moveTo(...kresli); kc.quadraticCurveTo(kresli[0], kresli[1], (kresli[0] + b[0]) / 2, (kresli[1] + b[1]) / 2); kc.lineTo(...b); kc.stroke();
      kresli = b;
    });
    const konec = () => { if (kresli) { kresli = null; pripravPodpis(); } };
    kp.addEventListener('pointerup', konec); kp.addEventListener('pointercancel', konec);
    $('kSmazat').onclick = () => { kc.clearRect(0, 0, kp.width, kp.height); podpisPng = null; vykresliRam(); };
    telo.querySelectorAll('[data-zal]').forEach(b => b.onclick = () => {
      zalozka = b.dataset.zal;
      telo.querySelectorAll('[data-zal]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      telo.querySelectorAll('[data-panel]').forEach(p => { p.hidden = p.dataset.panel !== zalozka; });
      pripravPodpis();
    });
    $('pSoubor').onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      try { nahranyPodpis = await createImageBitmap(f); } catch (er) { return Dialog.chyba('Obrázek se nepodařilo načíst'); }
      pripravPodpis();
    };
    form.querySelector('[name=bezPozadi]').onchange = () => pripravPodpis();
    $('pNahled').onclick = () => pripravPodpis();
  }

  async function pripravPodpis() {
    let c = null;
    if (zalozka === 'kreslit') c = orizni($('kPlatno'));
    else if (zalozka === 'nahrat' && nahranyPodpis) {
      c = document.createElement('canvas');
      const m = Math.min(1, 1600 / nahranyPodpis.width);
      c.width = Math.round(nahranyPodpis.width * m); c.height = Math.round(nahranyPodpis.height * m);
      const ctx = c.getContext('2d'); ctx.drawImage(nahranyPodpis, 0, 0, c.width, c.height);
      if (form.querySelector('[name=bezPozadi]').checked) {
        const d = ctx.getImageData(0, 0, c.width, c.height), p = d.data;
        for (let i = 0; i < p.length; i += 4) {
          const jas = (p[i] + p[i + 1] + p[i + 2]) / 3;   // světlé → průhledné, s měkkým přechodem
          p[i + 3] = Math.min(p[i + 3], Math.max(0, Math.min(255, (225 - jas) * 255 / 60)));
        }
        ctx.putImageData(d, 0, 0);
      }
      c = orizni(c);
    } else if (zalozka === 'ulozeny' && ulozenyPodpis) {
      const bmp = await createImageBitmap(new Blob([ulozenyPodpis], { type: 'image/png' }));
      c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
      c.getContext('2d').drawImage(bmp, 0, 0);
    }
    if (!c) { podpisPng = null; vykresliRam(); return; }
    podpisPng = await canvasBajty(c, 'image/png');
    const novyPomer = c.height / c.width;
    if (platno) ram.fh = ram.fw * novyPomer * platno.clientWidth / platno.clientHeight;
    pomer = novyPomer;
    vykresliRam();
  }

  // náhled razítka vykreslený plátnem do rámečku (přibližně jako ve výsledném PDF)
  function kresliRazitko(cv, w, h) {
    const o = hodnoty(form), dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = Math.max(1, w * dpr); cv.height = Math.max(1, h * dpr);
    const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
    const datum = o.datum ? J.datumCesky(new Date(o.datum + 'T12:00')) : J.datumCesky();
    const radky = J.nahradZnacky(o.text, { datum }).split('\n');
    ctx.font = '100px "Liberation Sans", Arial, sans-serif';
    const nejsirsi = Math.max(...radky.map(t => ctx.measureText(t).width / 100), 0.01);
    const pad = Math.min(w, h) * 0.08;
    const vel = Math.max(4, Math.min((w - 2 * pad) / nejsirsi, (h - 2 * pad) / (radky.length * 1.2)));
    ctx.fillStyle = ctx.strokeStyle = o.barva; ctx.font = `${vel}px "Liberation Sans", Arial, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (o.ramecek) { ctx.lineWidth = Math.max(1, vel / 10); ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth); }
    radky.forEach((t, k) => ctx.fillText(t, w / 2, h / 2 + (k - (radky.length - 1) / 2) * vel * 1.2));
  }

  function vykresliRam() {
    if (!platno) return;
    const W = platno.clientWidth, H = platno.clientHeight;
    ram.fw = Math.min(Math.max(ram.fw, 0.03), 1); ram.fh = Math.min(Math.max(ram.fh, 0.02), 1);
    ram.fx = Math.min(Math.max(ram.fx, 0), 1 - ram.fw); ram.fy = Math.min(Math.max(ram.fy, 0), 1 - ram.fh);
    if (!ramEl) {
      ramEl = document.createElement('div'); ramEl.className = 'ram';
      ramEl.innerHTML = jePodpis ? '<img alt="podpis"><div class="uchyt"></div>' : '<canvas></canvas><div class="uchyt"></div>';
      plochaU.appendChild(ramEl);
      zapniTazeni();
    }
    Object.assign(ramEl.style, { left: ram.fx * W + 'px', top: ram.fy * H + 'px', width: ram.fw * W + 'px', height: ram.fh * H + 'px' });
    if (jePodpis) {
      const img = ramEl.querySelector('img');
      if (img.dataset.zdroj !== String(podpisPng?.length)) {
        if (img.src) URL.revokeObjectURL(img.src);
        img.dataset.zdroj = String(podpisPng?.length);
        if (podpisPng) img.src = URL.createObjectURL(new Blob([podpisPng], { type: 'image/png' })); else img.removeAttribute('src');
      }
    } else {
      const cv = ramEl.querySelector('canvas'); cv.style.width = '100%'; cv.style.height = '100%';
      kresliRazitko(cv, ram.fw * W, ram.fh * H);
    }
  }

  function zapniTazeni() {
    let start = null;
    ramEl.addEventListener('pointerdown', e => {
      e.preventDefault(); ramEl.setPointerCapture(e.pointerId);
      start = { x: e.clientX, y: e.clientY, r: { ...ram }, zmena: e.target.classList.contains('uchyt') };
    });
    ramEl.addEventListener('pointermove', e => {
      if (!start) return;
      const W = platno.clientWidth, H = platno.clientHeight;
      const dx = (e.clientX - start.x) / W, dy = (e.clientY - start.y) / H;
      if (start.zmena) {
        ram.fw = start.r.fw + dx;
        ram.fh = jePodpis ? ram.fw * pomer * W / H : start.r.fh + dy;
      } else { ram.fx = start.r.fx + dx; ram.fy = start.r.fy + dy; }
      vykresliRam();
    });
    const konec = () => { start = null; };
    ramEl.addEventListener('pointerup', konec); ramEl.addEventListener('pointercancel', konec);
  }

  async function zobrazStranku() {
    poz = Math.max(0, Math.min(poz, S.stranky.length - 1));
    const s = S.stranky[poz];
    $('uInfo').textContent = `stránka ${poz + 1} / ${S.stranky.length}`;
    const pl = plochaU.parentElement;
    const c = await vykresliStranku(s, Math.max(200, pl.clientWidth - 24), Math.min(innerHeight * 0.6, 900));
    if (!okno.open) return;
    platno?.remove(); platno = c;
    plochaU.insertBefore(c, plochaU.firstChild);
    if (jePodpis && platno) ram.fh = ram.fw * pomer * platno.clientWidth / platno.clientHeight;
    vykresliRam();
  }
  $('uPred').onclick = () => { poz--; zobrazStranku(); };
  $('uDalsi').onclick = () => { poz++; zobrazStranku(); };
  form.addEventListener('input', () => { if (!jePodpis) vykresliRam(); });

  pata.insertAdjacentHTML('beforeend', '<span class="mezera"></span>');
  tlacitkoPaty(pata, 'Zrušit', zavriOkno);
  tlacitkoPaty(pata, jePodpis ? 'Vložit podpis' : 'Vložit razítko', async () => {
    const o = hodnoty(form);
    if (jePodpis && !podpisPng) await pripravPodpis();
    if (jePodpis && !podpisPng) return Dialog.chyba(zalozka === 'nahrat' ? 'Vyber obrázek podpisu' : 'Nejdřív se podepiš do bílého pole');
    if (!jePodpis && !o.text.trim()) return Dialog.chyba('Napiš text razítka');
    const cil = o.kam === 'vse' ? S.stranky.slice() : o.kam === 'vybrane' && S.vyber.size ? vybrane() : [S.stranky[poz]];
    const box = { ...ram }, png = podpisPng;
    const { kam, ...zbytek } = o;
    nast.nastroje[druh] = { ...zbytek, datum: undefined }; ulozNast();
    if (jePodpis && o.zapamatovat) idb('put', 'podpis', png).catch(() => {});
    zavriOkno();
    const datum = o.datum ? J.datumCesky(new Date(o.datum + 'T12:00')) : undefined;
    await upravObsah(jePodpis ? 'Podpis' : 'Razítko', cil, async (doc, cc) => {
      const idx = cc.map((_, k) => k);
      if (jePodpis) await J.vlozObrazek(doc, idx, png, 'png', box);
      else J.razitko(doc, await pismo(doc), idx, box, { text: o.text, barva: o.barva, ramecek: o.ramecek, datum });
    });
  }, true);
  requestAnimationFrame(() => { zobrazStranku(); if (jePodpis && ulozenyPodpis && !uloz.vlastni) telo.querySelector('[data-zal="ulozeny"]')?.click(); });
}

/* ---------- zvětšený náhled ---------- */

function nahled(id) {
  let poz = Math.max(0, S.stranky.findIndex(s => s.id === (id || [...S.vyber][0])));
  const { telo, pata } = otevriOkno('🔍 Náhled', '<div style="grid-column:1/-1"><div class="nahled-plocha" id="zPlocha"></div></div>');
  const info = document.createElement('span');
  const pred = tlacitkoPaty(pata, '◀ Předchozí', () => { poz--; ukaz(); });
  pata.appendChild(info);
  const dal = tlacitkoPaty(pata, 'Další ▶', () => { poz++; ukaz(); });
  pata.insertAdjacentHTML('beforeend', '<span class="mezera"></span>');
  tlacitkoPaty(pata, 'Zavřít', zavriOkno, true);
  let token = 0;
  async function ukaz() {
    poz = Math.max(0, Math.min(poz, S.stranky.length - 1));
    const t = ++token, s = S.stranky[poz];
    info.textContent = `${poz + 1} / ${S.stranky.length}`;
    pred.disabled = poz === 0; dal.disabled = poz === S.stranky.length - 1;
    const pl = $('zPlocha');
    const c = await vykresliStranku(s, Math.max(200, pl.clientWidth - 24), innerHeight * 0.72);
    if (t !== token || !okno.open) return;
    pl.replaceChildren(c);
    S.vyber = new Set([s.id]); S.kotva = s.id; oznacVyber();
  }
  const klavesy = e => {
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); poz++; ukaz(); }
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); poz--; ukaz(); }
  };
  okno.addEventListener('keydown', klavesy);
  poZavreniOkna = () => okno.removeEventListener('keydown', klavesy);
  requestAnimationFrame(ukaz);
}

/* ---------- ukázka a nápověda ---------- */

async function ukazka() {
  prubeh('Vytvářím ukázku…');
  try {
    const { PDFDocument, rgb } = window.PDFLib;
    const doc = await PDFDocument.create();
    const f = await pismo(doc);
    const barvy = [rgb(0.85, 0.33, 0.31), rgb(0.26, 0.52, 0.96), rgb(0.2, 0.66, 0.33), rgb(0.98, 0.74, 0.02), rgb(0.6, 0.4, 0.8), rgb(0.3, 0.7, 0.75)];
    for (let i = 0; i < 6; i++) {
      const naSirku = i === 4, [w, h] = naSirku ? [J.A4[1], J.A4[0]] : J.A4;
      const p = doc.addPage([w, h]);
      p.drawRectangle({ x: 0, y: h - 110, width: w, height: 110, color: barvy[i] });
      p.drawText(`Ukázková stránka ${i + 1}`, { x: 50, y: h - 70, size: 30, font: f, color: rgb(1, 1, 1) });
      const text = ['Příliš žluťoučký kůň úpěl ďábelské ódy.', 'Tuhle stránku můžeš otočit, přesunout, smazat nebo podepsat.',
        naSirku ? 'Tato stránka je na šířku.' : 'Zkus vodoznak, číslování nebo rozdělení dokumentu.'];
      text.forEach((t, k) => p.drawText(t, { x: 50, y: h - 170 - k * 26, size: 14, font: f, color: rgb(0.15, 0.15, 0.15) }));
      for (let k = 0; k < 12; k++) p.drawRectangle({ x: 50, y: h - 280 - k * 22, width: (w - 100) * (0.5 + 0.5 * Math.abs(Math.sin(i * 3 + k))), height: 8, color: rgb(0.85, 0.85, 0.87) });
      p.drawText(String(i + 1), { x: w - 70, y: 40, size: 48, font: f, color: barvy[i] });
    }
    doc.setTitle('Ukázkový dokument'); doc.setAuthor('PDF dílna');
    const b = await doc.save();
    prubeh(null);
    await nactiSoubory([new File([b], 'ukazka.pdf', { type: 'application/pdf' })]);
  } finally { prubeh(null); }
}

function napoveda() {
  const { pata } = otevriOkno('❓ Nápověda – PDF dílna', `<div class="pomoc" style="grid-column:1/-1">
    <p>🔒 Vše probíhá jen v tomto prohlížeči, soubory se nikam neodesílají. Rozpracovaná práce (soubory, pořadí stránek) se ukládá do IndexedDB prohlížeče a po znovuotevření se obnoví; <b>Soubor → Zavřít vše</b> ji smaže.</p>
    <h3>Jak na to</h3>
    <ul><li>Přetáhni do okna PDF i obrázky (JPG, PNG, WebP – každý obrázek bude jedna stránka). Více souborů = spojení do jednoho.</li>
    <li>Klik vybere stránku, <kbd>Ctrl</kbd>+klik přidá/odebere, <kbd>Shift</kbd>+klik vybere úsek. Na dotykovém displeji klepnutí výběr přepíná.</li>
    <li>Vybrané stránky přetáhni myší na nové místo (i mezi stránky z různých souborů – barevný proužek ukazuje původ).</li>
    <li>Nástroje (vodoznak, číslování, podpis…) mají náhled a jdou vrátit přes <b>Zpět</b>.</li>
    <li><b>Export</b> uloží výsledné PDF, <b>Rozdělit</b> stáhne více PDF v ZIPu.</li></ul>
    <h3>Klávesové zkratky</h3>
    <table><tr><td><kbd>Ctrl+O</kbd></td><td>přidat soubory</td></tr><tr><td><kbd>Ctrl+S</kbd></td><td>exportovat PDF</td></tr>
    <tr><td><kbd>Ctrl+Z</kbd> / <kbd>Ctrl+Y</kbd></td><td>zpět / znovu</td></tr><tr><td><kbd>Ctrl+A</kbd>, <kbd>Esc</kbd></td><td>vybrat vše / zrušit výběr</td></tr>
    <tr><td><kbd>←</kbd> <kbd>→</kbd></td><td>pohyb po stránkách (se <kbd>Shift</kbd> rozšíří výběr)</td></tr>
    <tr><td><kbd>Alt+←</kbd> <kbd>Alt+→</kbd></td><td>posunout vybrané</td></tr>
    <tr><td><kbd>R</kbd> / <kbd>Shift+R</kbd></td><td>otočit doprava / doleva</td></tr><tr><td><kbd>D</kbd></td><td>duplikovat</td></tr>
    <tr><td><kbd>Delete</kbd></td><td>smazat vybrané</td></tr><tr><td><kbd>B</kbd></td><td>vložit prázdnou stránku</td></tr>
    <tr><td><kbd>Enter</kbd></td><td>zvětšený náhled</td></tr><tr><td><kbd>F1</kbd></td><td>tato nápověda</td></tr></table>
    <h3>Omezení</h3>
    <ul><li><b>Šifrovaná PDF</b> (s heslem i jen s ochranou proti úpravám) knihovna pdf-lib neotevře – odemkni je jinde (např. tisk do PDF) a nahraj znovu.</li>
    <li>pdf-lib <b>neumí výsledek zašifrovat</b> ani nastavit heslo.</li>
    <li><b>Formuláře XFA</b> (dynamické formuláře z Adobe LiveCycle) neumí vyplnit ani zobrazit. Běžná pole AcroForm se zobrazí, ale po úpravě stránek už nemusí jít vyplňovat.</li>
    <li>Záložky (osnova) a odkazy uvnitř dokumentu se při sestavení nepřenesou.</li>
    <li>Zmenšení velikosti převádí stránky na obrázky JPEG – text pak nejde označit ani vyhledat.</li>
    <li>Ořez mění viditelnou oblast; obsah mimo ni zůstává v souboru.</li></ul>
    <p class="pozn" style="color:var(--text-faint);font-size:.78rem">Knihovny: pdf-lib 1.17.1 + fontkit (MIT), PDF.js 4.10 (Apache 2.0), písmo Liberation Sans (OFL).</p></div>`);
  pata.insertAdjacentHTML('beforeend', '<span class="mezera"></span>');
  tlacitkoPaty(pata, 'Zavřít', zavriOkno, true);
}

async function zavritVse() {
  if (!await Dialog.potvrd('Zavřít všechny stránky a začít znovu? Uložená rozpracovaná práce se smaže (nejde vrátit).')) return;
  for (const z of S.zdroje.values()) z.pdfjs?.then(d => d.destroy()).catch(() => {});
  for (const u of S.nahledy.values()) URL.revokeObjectURL(u);
  Object.assign(S, { zdroje: new Map(), stranky: [], soubory: [], meta: {}, vyber: new Set(), kotva: null, zpet: [], vpred: [], nahledy: new Map() });
  fronta.length = 0;
  prekresli();
  idb('delete', 'prace').catch(() => {});
}

/* ---------- IndexedDB: rozpracovaná práce a podpis ---------- */

let dbP = null;
function idb(akce, k, v) {
  dbP = dbP || new Promise((ok, ko) => {
    const r = indexedDB.open('webapp_pdf_dilna', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('data');
    r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error);
  });
  return dbP.then(db => new Promise((ok, ko) => {
    const tx = db.transaction('data', akce === 'get' ? 'readonly' : 'readwrite'), st = tx.objectStore('data');
    const r = akce === 'get' ? st.get(k) : akce === 'put' ? st.put(v, k) : st.delete(k);
    r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error);
  }));
}
let ulozCas = null;
function ulozPraci() {
  clearTimeout(ulozCas);
  ulozCas = setTimeout(() => {
    if (!S.stranky.length) { idb('delete', 'prace').catch(() => {}); return; }
    const pouzite = [...new Set(S.stranky.map(s => s.zdroj))];
    idb('put', 'prace', {
      verze: 1, stranky: S.stranky, meta: S.meta, soubory: S.soubory,
      zdroje: pouzite.map(id => { const z = S.zdroje.get(id); return { id, nazev: z.nazev, bajty: z.bajty }; }),
    }).catch(e => console.warn('Uložení práce selhalo', e));
  }, 800);
}
async function obnovPraci() {
  try {
    const r = await idb('get', 'prace');
    if (!r || !r.stranky?.length) return;
    for (const z of r.zdroje) pridejZdroj(z.bajty, z.nazev, z.id);
    S.stranky = r.stranky; S.meta = r.meta || {}; S.soubory = r.soubory || [];
    prekresli();
    Dialog.info(`Obnovena rozpracovaná práce (${S.stranky.length} str.). Soubor → Zavřít vše začne znovu.`);
  } catch (e) { console.warn('Obnovení práce selhalo', e); }
}

/* ---------- příkazy, nabídky, klávesy ---------- */

const PRIKAZY = {
  otevrit: () => $('vstupSoubor').click(),
  ukazka, export: () => exportuj(false), exportVybrane: () => exportuj(true), rozdelit, metadata, zavritVse,
  zpet, vpred,
  vybratVse: () => vyberPodle(() => true), vybratLiche: () => vyberPodle((s, i) => i % 2 === 0),
  vybratSude: () => vyberPodle((s, i) => i % 2 === 1), vybratRozsah, zrusitVyber: () => vyberPodle(() => false),
  otocVpravo: () => otoc(90), otocVlevo: () => otoc(-90), smazat, duplikovat,
  posunVlevo: () => posun(-1), posunVpravo: () => posun(1), prazdna: vlozPrazdnou, obratit,
  nahled: () => nahled(), napoveda,
  podpis: () => umisteni('podpis'), razitko: () => umisteni('razitko'),
  vodoznak, cislovani, zahlavi, orez, naA4, zmensit,
  obrA4: () => { nast.obrazky = 'a4'; ulozNast(); oznacVyber(); },
  obrVelikost: () => { nast.obrazky = 'obrazek'; ulozNast(); oznacVyber(); },
  'vel-S': () => velikost('S'), 'vel-M': () => velikost('M'), 'vel-L': () => velikost('L'),
};
function velikost(v) { nast.vel = v; ulozNast(); mrizka.dataset.vel = v; oznacVyber(); }

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

$('vstupSoubor').addEventListener('change', e => { nactiSoubory(e.target.files); e.target.value = ''; });

// přetažení souborů do okna
let hloubka = 0;
const nesouSoubory = e => [...(e.dataTransfer?.types || [])].includes('Files');
addEventListener('dragenter', e => { if (nesouSoubory(e)) { hloubka++; document.body.classList.add('pretahuji'); } });
addEventListener('dragleave', e => { if (nesouSoubory(e) && --hloubka <= 0) { hloubka = 0; document.body.classList.remove('pretahuji'); } });
addEventListener('dragover', e => { if (nesouSoubory(e)) e.preventDefault(); });
addEventListener('drop', e => {
  if (!nesouSoubory(e)) return;
  e.preventDefault(); hloubka = 0; document.body.classList.remove('pretahuji');
  if (okno.open) return;
  nactiSoubory(e.dataTransfer.files);
});

let kurzor = null;   // stránka, na které stojí klávesnice (u Shift+šipek se liší od kotvy)
function fokus(i, rozsir) {
  if (!S.stranky.length) return;
  i = Math.max(0, Math.min(i, S.stranky.length - 1));
  const id = S.stranky[i].id;
  kurzor = id;
  if (rozsir && S.kotva) {
    const a = S.stranky.findIndex(s => s.id === S.kotva);
    S.vyber = new Set(S.stranky.slice(Math.min(a, i), Math.max(a, i) + 1).map(s => s.id));
  } else { S.vyber = new Set([id]); S.kotva = id; }
  oznacVyber();
  const k = mrizka.querySelector(`[data-id="${id}"]`);
  k?.focus({ preventScroll: true }); k?.scrollIntoView({ block: 'nearest' });
}
addEventListener('keydown', e => {
  if (okno.open || document.querySelector('dialog[open]')) return;
  if (e.target.closest('input,textarea,select')) return;
  const ctrl = e.ctrlKey || e.metaKey, k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const spust = (id, ...a) => { e.preventDefault(); PRIKAZY[id](...a); };
  if (ctrl) {
    if (k === 'o') return spust('otevrit');
    if (k === 's') return spust('export');
    if (k === 'z') return spust(e.shiftKey ? 'vpred' : 'zpet');
    if (k === 'y') return spust('vpred');
    if (k === 'a' && S.stranky.length) return spust('vybratVse');
    return;
  }
  if (e.key === 'F1') return spust('napoveda');
  if (e.key === 'Escape') { zavriNabidky(); return spust('zrusitVyber'); }
  if (!S.stranky.length || e.altKey && !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    const d = e.key === 'ArrowLeft' ? -1 : 1;
    if (e.altKey) return spust(d < 0 ? 'posunVlevo' : 'posunVpravo');
    e.preventDefault();
    const akt = S.stranky.findIndex(s => s.id === kurzor);
    return fokus(akt < 0 ? 0 : akt + d, e.shiftKey);
  }
  if (e.key === 'Home') return fokus(0, e.shiftKey);
  if (e.key === 'End') return fokus(S.stranky.length - 1, e.shiftKey);
  if (e.key === 'Delete' || e.key === 'Backspace') return spust('smazat');
  if (e.key === 'Enter' && S.vyber.size) return spust('nahled');
  if (k === 'r') return spust(e.shiftKey ? 'otocVlevo' : 'otocVpravo');
  if (k === 'd') return spust('duplikovat');
  if (k === 'b') return spust('prazdna');
});

if (window.self === window.top) document.body.classList.add('samostatne');
window.PDF_DILNA_UI = { S, nactiSoubory, upravObsah, sestavBajty, PRIKAZY };   // pro testy
prekresli();
obnovPraci();

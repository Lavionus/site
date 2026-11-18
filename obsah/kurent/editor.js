/* Čtení kurentu – přepisový editor nad vlastním skenem (DOM).
   window.KurentEditor(U) → { prepis, opust, prikaz, mojeRadky, klavesa }.
   Data: IndexedDB „webapp_kurent“: projekty (keyPath id, bez obrázku) + obrazky (klíč = id projektu, Blob originálu). */
(function () {
'use strict';
window.KurentEditor = function (U) {
const { $, esc, J } = U;
const MAX_STRANA = 4800;            // delší strana zpracovaného obrázku (paměť)

/* ---------- IndexedDB ---------- */
let dbP = null;
function db() {
  if (!dbP) dbP = new Promise((ok, chyba) => {
    const r = indexedDB.open('webapp_kurent', 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains('projekty')) d.createObjectStore('projekty', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('obrazky')) d.createObjectStore('obrazky');
    };
    r.onsuccess = () => ok(r.result); r.onerror = () => chyba(r.error);
  });
  return dbP;
}
async function tx(stores, rezim, fn) {
  const d = await db();
  return new Promise((ok, chyba) => {
    const t = d.transaction(stores, rezim); let req;
    try { req = fn(t); } catch (e) { chyba(e); return; }
    t.oncomplete = () => ok(req && 'result' in req ? req.result : undefined);
    t.onerror = () => chyba(t.error); t.onabort = () => chyba(t.error);
  });
}
const dbVsechny = () => tx('projekty', 'readonly', t => t.objectStore('projekty').getAll());
const dbProjekt = id => tx('projekty', 'readonly', t => t.objectStore('projekty').get(id));
const dbUloz = p => tx('projekty', 'readwrite', t => t.objectStore('projekty').put(p));
const dbObrazek = id => tx('obrazky', 'readonly', t => t.objectStore('obrazky').get(id));
const dbUlozObrazek = (id, b) => tx('obrazky', 'readwrite', t => t.objectStore('obrazky').put(b, id));
const dbSmaz = id => tx(['projekty', 'obrazky'], 'readwrite', t => { t.objectStore('projekty').delete(id); t.objectStore('obrazky').delete(id); });

/* ---------- obrázek: otočení a úpravy ---------- */
function otocit(bmp, u) {
  const s = Math.min(1, MAX_STRANA / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * s), h = Math.round(bmp.height * s);
  const rad = (u.otoceni + u.sklon) * Math.PI / 180, cs = Math.abs(Math.cos(rad)), sn = Math.abs(Math.sin(rad));
  const c = document.createElement('canvas');
  c.width = Math.round(w * cs + h * sn); c.height = Math.round(w * sn + h * cs);
  const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
  x.translate(c.width / 2, c.height / 2); x.rotate(rad); x.imageSmoothingQuality = 'high';
  x.drawImage(bmp, -w / 2, -h / 2, w, h);
  return c;
}
const bezUprav = u => !u.jas && !u.kontrast && u.cerna === 0 && u.bila === 255 && u.gama === 1 && !u.inverze && !u.seda;
function upravit(zdroj, u) {
  if (bezUprav(u)) return zdroj;
  const c = document.createElement('canvas'); c.width = zdroj.width; c.height = zdroj.height;
  const x = c.getContext('2d'); x.drawImage(zdroj, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height); J.upravPixely(d.data, u); x.putImageData(d, 0, 0);
  return c;
}

/* ---------- stav ---------- */
let P = null, bmp = null, otoc = null, uprav = null, akt = 0, oznac = false;
const V = { z: 1, x: 0, y: 0 };
let hist = J.novaHistorie(), histT = 0, ulozT = 0, ulozeno = true, ro = null, kresliRaf = 0, fitNutny = true;
const snimek = () => JSON.stringify({ nazev: P.nazev, meta: P.meta, radky: P.radky, upravy: P.upravy });

async function otevri(id) {
  let p = id ? await dbProjekt(id) : null;
  if (!p && !id) { const vse = await dbVsechny(); vse.sort((a, b) => b.zmeneno - a.zmeneno); p = vse[0] || null; }
  P = J.normalizujProjekt(p || {});
  if (!p) await dbUloz(P);
  U.nast.projekt = P.id; U.ulozNast();
  bmp = null; otoc = uprav = null; akt = 0;
  const blob = p ? await dbObrazek(P.id) : null;
  if (blob) { try { bmp = await createImageBitmap(blob); } catch (e) { bmp = null; } }
  if (bmp) { otoc = otocit(bmp, P.upravy); uprav = upravit(otoc, P.upravy); }
  hist = J.novaHistorie(); J.historieZapis(hist, snimek());
  ulozeno = true; fitNutny = true;
}
/* řádky z jiné části stránky (šablona zápisu) – přidají se na konec přepisu */
function pridejCekajici() {
  const t = U.cekajiciRadky; U.cekajiciRadky = null;
  if (!t || !t.length) return;
  if (P.radky.length && !P.radky[P.radky.length - 1].t && !P.radky[P.radky.length - 1].r) P.radky.pop();
  akt = P.radky.length;
  for (const x of t) P.radky.push({ id: J.noveId(), t: x });
  zmena(true);
}

/* ---------- vykreslení pohledu ---------- */
const ZNAKY = ['ſ', 'ß', 'ä', 'ö', 'ü', 'á', 'č', 'ď', 'é', 'ě', 'í', 'ň', 'ř', 'š', 'ť', 'ú', 'ů', 'ý', 'ž', 'æ', 'œ', '†', '∞', '½', '¼', '¾'];
async function prepis() {
  const o = U.obsah;
  o.innerHTML = '<p class="tip">Načítám projekt…</p>';
  try { if (!P || P.id !== U.nast.projekt) await otevri(U.nast.projekt); }
  catch (e) { o.innerHTML = `<p class="tip">IndexedDB není dostupná (${esc(e.message || e)}) – přepisy nelze ukládat.</p>`; return; }
  if (U.nast.pohled !== 'prepis') return;
  pridejCekajici();
  const u = P.upravy;
  const posuv = (id, nazev, min, max, krok, hod) => `<label>${nazev} <input type="range" data-uprava="${id}" min="${min}" max="${max}" step="${krok}" value="${hod}"><output>${hod}</output></label>`;
  o.innerHTML = `<div class="ed">
    <div class="ed-lista">
      <button class="btn mini" id="eProjekty" title="Projekty přepisů (Ctrl+O)">📂 Projekty</button>
      <button class="btn mini ed-nazev" id="eNazev" title="Přejmenovat projekt">${esc(P.nazev)}</button>
      <label class="btn mini" title="Nahrát sken (lze i přetáhnout nebo vložit Ctrl+V)">🖼️ Sken<input type="file" accept="image/*" id="eSoubor" hidden></label>
      <span class="ed-sk">
        <button class="btn mini" data-ed="oddal" title="Oddálit (−)">−</button><button class="btn mini" data-ed="prizpusob" title="Celý obrázek (0)" id="eZoom">100 %</button><button class="btn mini" data-ed="priblis" title="Přiblížit (+)">+</button>
      </span>
      <span class="ed-sk"><button class="btn mini" data-ed="vlevo" title="Otočit doleva">⟲</button><button class="btn mini" data-ed="vpravo" title="Otočit doprava (R)">⟳</button></span>
      <button class="btn mini" id="eOznac" aria-pressed="${oznac}" title="Tažením označte oblast aktuálního řádku (M)">▭ Označit řádek</button>
      <button class="btn mini" id="eUpravyTl" aria-pressed="false" title="Jas, kontrast, úrovně, inverze">🎚 Obraz</button>
      <button class="btn mini" data-ed="inverze" title="Inverze (I)">◐</button>
      <span class="ed-sk"><button class="btn mini" data-ed="zpet" id="eZpet" title="Zpět (Ctrl+Z)">↶</button><button class="btn mini" data-ed="znovu" id="eZnovu" title="Znovu (Ctrl+Y)">↷</button></span>
      <button class="btn mini" data-nabidka="nabExport" title="Export přepisu">💾 Export ▾</button>
    </div>
    <div class="panel ed-upravy" id="eUpravy" hidden>
      ${posuv('jas', 'Jas', -100, 100, 1, u.jas)}${posuv('kontrast', 'Kontrast', -100, 100, 1, u.kontrast)}
      ${posuv('cerna', 'Černý bod', 0, 254, 1, u.cerna)}${posuv('bila', 'Bílý bod', 1, 255, 1, u.bila)}
      ${posuv('gama', 'Střední tóny', 0.2, 3, 0.05, u.gama)}${posuv('sklon', 'Narovnat °', -15, 15, 0.25, u.sklon)}
      <label><input type="checkbox" data-uprava="inverze" ${u.inverze ? 'checked' : ''}> Inverze</label>
      <label><input type="checkbox" data-uprava="seda" ${u.seda ? 'checked' : ''}> Odstíny šedi</label>
      <button class="btn mini" data-ed="auto" title="Černý a bílý bod podle histogramu">✨ Automaticky</button>
      <button class="btn mini" data-ed="reset">↺ Výchozí</button>
    </div>
    <div class="ed-telo">
      <div class="ed-obraz${oznac ? ' oznac' : ''}" id="eObraz"><canvas id="ePlatno" aria-label="Sken"></canvas>
        <div class="ed-prazdne" id="ePrazdne" ${bmp ? 'hidden' : ''}><p><b>Nahrajte sken matriky</b></p><p>tlačítkem 🖼️ Sken, přetažením souboru sem nebo vložením ze schránky (Ctrl+V).</p><p class="pozn">Obrázek zůstává jen ve vašem prohlížeči (IndexedDB).</p></div>
      </div>
      <div class="ed-prepis">
        <canvas id="eLupa" class="ed-lupa" hidden aria-label="Zvětšený řádek"></canvas>
        <div class="ed-znaky" aria-label="Vložit znak">
          <button class="btn mini" data-vloz="[?]" title="Nečitelné místo (F2 obalí výběr jako nejistý)">[?]</button><button class="btn mini" data-vloz="[…]" title="Vynechaný úsek">[…]</button><button class="btn mini" data-ed="dalsiNejiste" title="Další nejisté místo (F3)">⏭ [?]</button>
          ${ZNAKY.map(z => `<button class="btn mini zn" data-vloz="${z}">${z}</button>`).join('')}
        </div>
        <ol class="ed-radky" id="eRadky"></ol>
        <div class="ed-stav" id="eStav"></div>
        <details class="ed-meta"><summary>Údaje o prameni</summary>
          ${J.META_POLE.map(([k, n]) => `<label>${esc(n)}<input class="vstup" data-meta="${k}" value="${esc(P.meta[k])}" data-i18n="ne"></label>`).join('')}
        </details>
      </div>
    </div></div>`;
  napoj();
  kresliRadky();
  if (fitNutny) { prizpusob(); fitNutny = false; } else prizpusobPlatno();
  lupa();
  stav();
}

function napoj() {
  $('eProjekty').onclick = projekty;
  $('eNazev').onclick = prejmenuj;
  $('eSoubor').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) nahraj(f); };
  $('eOznac').onclick = () => prepniOznac();
  $('eUpravyTl').onclick = e => { const p = $('eUpravy'); p.hidden = !p.hidden; e.currentTarget.setAttribute('aria-pressed', String(!p.hidden)); prizpusobPlatno(); };
  $('eUpravy').addEventListener('input', e => {
    const k = e.target.dataset.uprava; if (!k) return;
    const v = e.target.type === 'checkbox' ? e.target.checked : +e.target.value;
    if (e.target.nextElementSibling && e.target.nextElementSibling.tagName === 'OUTPUT') e.target.nextElementSibling.textContent = v;
    nastavUpravu(k, v);
  });
  U.obsah.querySelector('.ed').addEventListener('click', e => {
    const b = e.target.closest('[data-ed]'); if (b) return prikaz(b.dataset.ed);
    const v = e.target.closest('[data-vloz]'); if (v) return vloz(v.dataset.vloz);
  });
  U.obsah.querySelectorAll('[data-meta]').forEach(i => i.addEventListener('input', () => { P.meta[i.dataset.meta] = i.value; zmena(); }));
  const ob = $('eObraz');
  ob.addEventListener('dragover', e => { e.preventDefault(); ob.classList.add('tazeni'); });
  ob.addEventListener('dragleave', () => ob.classList.remove('tazeni'));
  ob.addEventListener('drop', e => { e.preventDefault(); ob.classList.remove('tazeni'); const f = [...e.dataTransfer.files].find(x => /^image\//.test(x.type)); if (f) nahraj(f); });
  const c = $('ePlatno');
  c.addEventListener('pointerdown', ukazDolu); c.addEventListener('pointermove', ukazPohyb);
  c.addEventListener('pointerup', ukazNahoru); c.addEventListener('pointercancel', ukazNahoru);
  c.addEventListener('wheel', e => { if (!uprav) return; e.preventDefault(); const r = c.getBoundingClientRect(); zoomNa(V.z * Math.pow(1.0015, -e.deltaY), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  ro = new ResizeObserver(() => requestAnimationFrame(prizpusobPlatno)); ro.observe(ob);
}
function opust() { if (ro) { ro.disconnect(); ro = null; } ulozHned(); }

/* ---------- řádky přepisu ---------- */
function kresliRadky() {
  const ol = $('eRadky'); if (!ol) return;
  ol.innerHTML = P.radky.map((r, i) => `<li class="${i === akt ? 'akt' : ''}" data-i="${i}"><span class="c">${i + 1}</span>
    <input class="vstup" value="${esc(r.t)}" spellcheck="false" aria-label="Řádek ${i + 1}" data-i18n="ne">
    <button class="btn mini oz${r.r ? ' ma' : ''}" data-oblast="${i}" title="${r.r ? 'Oblast označena – kliknutím zrušíte' : 'Bez oblasti: zapněte ▭ a táhněte přes řádek ve skenu'}">${r.r ? '▭' : '·'}</button></li>`).join('');
  ol.querySelectorAll('input').forEach(inp => {
    const i = () => +inp.parentElement.dataset.i;
    inp.addEventListener('focus', () => nastavAkt(i(), false));
    inp.addEventListener('input', () => { P.radky[i()].t = inp.value; zmena(); stav(); });
    inp.addEventListener('keydown', e => klavesaRadku(e, inp, i()));
  });
  ol.querySelectorAll('[data-oblast]').forEach(b => b.onclick = () => {
    const r = P.radky[+b.dataset.oblast];
    if (r.r) { delete r.r; zmena(true); kresliRadky(); kresli(); lupa(); } else { nastavAkt(+b.dataset.oblast, true); if (!oznac) prepniOznac(); }
  });
}
function vstupRadku(i) { const ol = $('eRadky'); return ol && ol.querySelector(`li[data-i="${i}"] input`); }
function nastavAkt(i, fokus) {
  i = Math.max(0, Math.min(P.radky.length - 1, i));
  const zmenen = i !== akt; akt = i;
  const ol = $('eRadky');
  if (ol) ol.querySelectorAll('li').forEach(li => li.classList.toggle('akt', +li.dataset.i === i));
  if (fokus) { const inp = vstupRadku(i); if (inp) { inp.focus({ preventScroll: true }); inp.scrollIntoView({ block: 'nearest' }); } }
  if (zmenen) ukazOblast(P.radky[i].r);
  kresli(); lupa();
}
function klavesaRadku(e, inp, i) {
  if (e.key === 'Enter' && !e.isComposing) {
    e.preventDefault();
    const zbytek = inp.value.slice(inp.selectionEnd);
    P.radky[i].t = inp.value.slice(0, inp.selectionStart);
    P.radky.splice(i + 1, 0, { id: J.noveId(), t: zbytek });
    zmena(true); kresliRadky(); nastavAkt(i + 1, true);
    const n = vstupRadku(i + 1); if (n) n.setSelectionRange(0, 0);
  } else if (e.key === 'Backspace' && inp.selectionStart === 0 && inp.selectionEnd === 0 && i > 0) {
    e.preventDefault();
    const pred = P.radky[i - 1], delka = pred.t.length;
    pred.t += P.radky[i].t; if (!pred.r && P.radky[i].r) pred.r = P.radky[i].r;
    P.radky.splice(i, 1); zmena(true); kresliRadky(); nastavAkt(i - 1, true);
    const n = vstupRadku(i - 1); if (n) n.setSelectionRange(delka, delka);
  } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    e.preventDefault();
    const pos = inp.selectionStart; nastavAkt(i + (e.key === 'ArrowUp' ? -1 : 1), true);
    const n = vstupRadku(akt); if (n) n.setSelectionRange(pos, pos);
  }
}
function vloz(text) {
  let inp = document.activeElement && document.activeElement.closest && document.activeElement.closest('#eRadky input');
  if (!inp) inp = vstupRadku(akt);
  if (!inp) return;
  const a = inp.selectionStart ?? inp.value.length, b = inp.selectionEnd ?? a;
  inp.setRangeText(text, a, b, 'end'); inp.focus();
  P.radky[+inp.parentElement.dataset.i].t = inp.value; zmena(true); stav();
}
/* F2: výběr → [výběr?], bez výběru vloží [?] */
function oznacNejiste() {
  const inp = document.activeElement && document.activeElement.closest && document.activeElement.closest('#eRadky input') || vstupRadku(akt);
  if (!inp) return;
  const a = inp.selectionStart, b = inp.selectionEnd;
  if (a !== b) { inp.setRangeText('[' + inp.value.slice(a, b) + '?]', a, b, 'end'); inp.focus(); P.radky[+inp.parentElement.dataset.i].t = inp.value; zmena(true); stav(); }
  else vloz('[?]');
}
function dalsiNejiste() {
  const vse = J.nejista(P.radky); if (!vse.length) return U.toast('Žádná nejistá místa.');
  const inp = document.activeElement && document.activeElement.closest && document.activeElement.closest('#eRadky input');
  const odR = inp ? +inp.parentElement.dataset.i : akt, odP = inp ? inp.selectionEnd : -1;
  const dalsi = vse.find(n => n.radek > odR || (n.radek === odR && n.pozice >= odP)) || vse[0];
  nastavAkt(dalsi.radek, true);
  const n = vstupRadku(dalsi.radek); if (n) n.setSelectionRange(dalsi.pozice, dalsi.pozice + dalsi.delka);
}
function stav() {
  const s = $('eStav'); if (!s) return;
  const n = J.nejista(P.radky).length, obl = P.radky.filter(r => r.r).length;
  s.innerHTML = `${P.radky.length} ř. · ${obl} s oblastí · <span class="${n ? 'nej' : ''}">${n} nejistých míst</span> · ${ulozeno ? 'uloženo ✓' : 'ukládám…'}`;
  const z = $('eZpet'), y = $('eZnovu');
  if (z) z.disabled = hist.i <= 0; if (y) y.disabled = hist.i >= hist.s.length - 1;
}

/* ---------- změny, ukládání, historie ---------- */
function zmena(hned) {
  P.zmeneno = Date.now(); ulozeno = false;
  clearTimeout(ulozT); ulozT = setTimeout(ulozHned, 700);
  clearTimeout(histT);
  if (hned) zapisHistorii(); else histT = setTimeout(zapisHistorii, 600);
}
function zapisHistorii() { clearTimeout(histT); histT = 0; if (P) J.historieZapis(hist, snimek()); stav(); }
function ulozHned() {
  clearTimeout(ulozT); if (!P || ulozeno) return;
  const p = JSON.parse(JSON.stringify(P));
  dbUloz(p).then(() => { ulozeno = true; stav(); }).catch(e => U.toast('Uložení selhalo: ' + (e.message || e)));
}
function obnov(s) {
  if (s == null) return;
  const o = JSON.parse(s), jineUpravy = JSON.stringify(o.upravy) !== JSON.stringify(P.upravy), jineOtoceni = o.upravy.otoceni !== P.upravy.otoceni || o.upravy.sklon !== P.upravy.sklon;
  Object.assign(P, o); P.zmeneno = Date.now(); ulozeno = false; clearTimeout(ulozT); ulozT = setTimeout(ulozHned, 400);
  akt = Math.min(akt, P.radky.length - 1);
  if (bmp && jineOtoceni) otoc = otocit(bmp, P.upravy);
  if (bmp && jineUpravy) uprav = upravit(otoc, P.upravy);
  prepis().then(() => nastavAkt(akt, true));
}
function zpet() { if (histT) zapisHistorii(); obnov(J.historieZpet(hist)); }
function znovu() { obnov(J.historieZnovu(hist)); }

/* ---------- úpravy obrazu ---------- */
let upravRaf = 0;
async function nastavUpravu(k, v) {
  if ((k === 'sklon') && P.radky.some(r => r.r) && !nastavUpravu.varovano) {
    nastavUpravu.varovano = true;
    U.toast('Pozor: narovnání posune označené oblasti řádků.');
  }
  P.upravy[k] = v; zmena();
  if (!bmp) return;
  cancelAnimationFrame(upravRaf);
  upravRaf = requestAnimationFrame(() => {
    if (k === 'sklon') otoc = otocit(bmp, P.upravy);
    uprav = upravit(otoc, P.upravy); kresli(); lupa();
  });
}
async function otoc90(smer) {
  if (!bmp) return;
  if (P.radky.some(r => r.r) && !await Dialog.potvrd('Otočení zneplatní označené oblasti řádků. Oblasti smazat a otočit?')) return;
  P.radky.forEach(r => delete r.r);
  P.upravy.otoceni = ((P.upravy.otoceni + smer * 90) % 360 + 360) % 360;
  otoc = otocit(bmp, P.upravy); uprav = upravit(otoc, P.upravy);
  zmena(true); kresliRadky(); prizpusob(); lupa(); fitNutny = false;
}
function autoUpravy() {
  if (!otoc) return;
  const x = otoc.getContext('2d'), d = x.getImageData(0, 0, otoc.width, otoc.height).data;
  Object.assign(P.upravy, J.autoUrovne(d)); zmena(true);
  uprav = upravit(otoc, P.upravy); prepis();
}

/* ---------- plátno: zobrazení, posun, zoom, oblasti ---------- */
function prizpusobPlatno() {
  const c = $('ePlatno'), ob = $('eObraz'); if (!c || !ob) return;
  const dpr = devicePixelRatio || 1, w = ob.clientWidth, h = ob.clientHeight;
  c.style.width = w + 'px'; c.style.height = h + 'px';
  c.width = Math.max(1, Math.round(w * dpr)); c.height = Math.max(1, Math.round(h * dpr));
  kresli();
}
function prizpusob() {
  prizpusobPlatno();
  const ob = $('eObraz'); if (!ob || !uprav) return;
  const w = ob.clientWidth, h = ob.clientHeight;
  V.z = Math.min(w / uprav.width, h / uprav.height) * 0.98 || 1;
  V.x = (w - uprav.width * V.z) / 2; V.y = (h - uprav.height * V.z) / 2;
  kresli();
}
function zoomNa(z, sx, sy) {
  z = Math.max(0.03, Math.min(12, z));
  V.x = sx - (sx - V.x) * z / V.z; V.y = sy - (sy - V.y) * z / V.z; V.z = z; kresli();
}
function zoomStred(f) { const ob = $('eObraz'); if (ob) zoomNa(V.z * f, ob.clientWidth / 2, ob.clientHeight / 2); }
/* posune pohled tak, aby oblast řádku byla vidět (zachová zvětšení, případně oddálí) */
function ukazOblast(r) {
  const ob = $('eObraz'); if (!r || !ob || !uprav) return;
  const w = ob.clientWidth, h = ob.clientHeight;
  if (r[2] * V.z > w * 0.96) V.z = w * 0.96 / r[2];
  const sx = r[0] * V.z + V.x, sy = r[1] * V.z + V.y;
  if (sx < 0 || sx + r[2] * V.z > w) V.x = (w - r[2] * V.z) / 2 - r[0] * V.z;
  if (sy < h * 0.1 || sy + r[3] * V.z > h * 0.9) V.y = h * 0.35 - r[1] * V.z;
}
function barva(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#3b82f6'; }
let tazeny = null;
function kresli() {
  cancelAnimationFrame(kresliRaf);
  kresliRaf = requestAnimationFrame(() => {
    const c = $('ePlatno'); if (!c) return;
    const x = c.getContext('2d'), dpr = devicePixelRatio || 1;
    x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, c.width, c.height);
    const z = $('eZoom'); if (z) z.textContent = Math.round(V.z * 100) + ' %';
    if (!uprav) return;
    x.setTransform(dpr * V.z, 0, 0, dpr * V.z, dpr * V.x, dpr * V.y);
    x.imageSmoothingEnabled = V.z < 2; x.imageSmoothingQuality = 'high';
    x.drawImage(uprav, 0, 0);
    const ak = barva('--accent'), lw = 1.5 / V.z;
    x.font = `${12 / V.z}px system-ui, sans-serif`; x.textBaseline = 'top';
    P.radky.forEach((r, i) => {
      if (!r.r) return;
      const [a, b, w, h] = r.r;
      x.lineWidth = i === akt ? lw * 2 : lw; x.strokeStyle = ak;
      if (i === akt) { x.fillStyle = ak + '2e'; x.fillRect(a, b, w, h); }
      x.strokeRect(a, b, w, h);
      x.fillStyle = ak; x.fillRect(a - 22 / V.z, b, 20 / V.z, 15 / V.z);
      x.fillStyle = '#fff'; x.fillText(String(i + 1), a - 20 / V.z, b + 1.5 / V.z);
    });
    if (tazeny && tazeny.rect) { x.setLineDash([6 / V.z, 4 / V.z]); x.lineWidth = lw * 1.5; x.strokeStyle = ak; x.strokeRect(...tazeny.rect); x.setLineDash([]); }
  });
}
function lupa() {
  const c = $('eLupa'); if (!c) return;
  const r = P.radky[akt] && P.radky[akt].r;
  if (!r || !uprav) { c.hidden = true; return; }
  c.hidden = false;
  const dpr = devicePixelRatio || 1, w = c.clientWidth || c.parentElement.clientWidth;
  const okraj = Math.round(r[3] * 0.25), sx = Math.max(0, r[0] - okraj), sy = Math.max(0, r[1] - okraj);
  const sw = Math.min(uprav.width - sx, r[2] + 2 * okraj), sh = Math.min(uprav.height - sy, r[3] + 2 * okraj);
  const h = Math.min(180, Math.max(40, w * sh / sw));
  c.style.height = h + 'px'; c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
  const k = Math.min(c.width / sw, c.height / sh);
  x.imageSmoothingQuality = 'high';
  x.drawImage(uprav, sx, sy, sw, sh, (c.width - sw * k) / 2, (c.height - sh * k) / 2, sw * k, sh * k);
}
const body = new Map(); let pinch = null;
const naObraz = (c, e) => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left - V.x) / V.z, (e.clientY - r.top - V.y) / V.z]; };
function ukazDolu(e) {
  if (!uprav) return;
  const c = e.currentTarget; try { c.setPointerCapture(e.pointerId); } catch (_) { /* syntetická událost */ }
  body.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (body.size === 2) { const [a, b] = [...body.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: V.z }; tazeny = null; return; }
  const [ix, iy] = naObraz(c, e);
  tazeny = { sx: e.clientX, sy: e.clientY, x0: V.x, y0: V.y, ix, iy, oznac: oznac && e.button === 0, pohnuto: false, typ: e.pointerType };
}
function ukazPohyb(e) {
  if (!body.has(e.pointerId)) return;
  body.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const c = e.currentTarget;
  if (pinch && body.size === 2) {
    const [a, b] = [...body.values()], r = c.getBoundingClientRect();
    zoomNa(pinch.z * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top); return;
  }
  if (!tazeny) return;
  if (Math.abs(e.clientX - tazeny.sx) + Math.abs(e.clientY - tazeny.sy) > 4) tazeny.pohnuto = true;
  if (tazeny.oznac) {
    const [ix, iy] = naObraz(c, e);
    const x0 = Math.max(0, Math.min(tazeny.ix, ix)), y0 = Math.max(0, Math.min(tazeny.iy, iy));
    tazeny.rect = [x0, y0, Math.min(uprav.width, Math.max(tazeny.ix, ix)) - x0, Math.min(uprav.height, Math.max(tazeny.iy, iy)) - y0];
  } else { V.x = tazeny.x0 + e.clientX - tazeny.sx; V.y = tazeny.y0 + e.clientY - tazeny.sy; }
  kresli();
}
function ukazNahoru(e) {
  body.delete(e.pointerId);
  if (pinch) { if (body.size < 2) pinch = null; return; }
  const t = tazeny; tazeny = null; if (!t) return;
  if (t.oznac && t.rect && t.rect[2] * V.z > 6 && t.rect[3] * V.z > 4) {
    P.radky[akt].r = t.rect.map(Math.round);
    const dalsi = akt + 1;
    if (dalsi >= P.radky.length) P.radky.push({ id: J.noveId(), t: '' });
    zmena(true); kresliRadky(); nastavAkt(dalsi, t.typ === 'mouse'); stav();
  } else if (!t.pohnuto) {
    const i = P.radky.findIndex(r => r.r && t.ix >= r.r[0] && t.ix <= r.r[0] + r.r[2] && t.iy >= r.r[1] && t.iy <= r.r[1] + r.r[3]);
    if (i >= 0) nastavAkt(i, t.typ === 'mouse');
  }
  kresli();
}
function prepniOznac() { oznac = !oznac; const b = $('eOznac'); if (b) b.setAttribute('aria-pressed', String(oznac)); const ob = $('eObraz'); if (ob) ob.classList.toggle('oznac', oznac); }

/* ---------- soubory ---------- */
async function nahraj(f) {
  let novy;
  try { novy = await createImageBitmap(f); } catch (e) { return Dialog.chyba('Obrázek se nepodařilo načíst (podporované jsou JPEG, PNG, WebP, GIF, BMP; HEIC a PDF ne).'); }
  if (bmp) { P = J.normalizujProjekt({}); U.nast.projekt = P.id; U.ulozNast(); hist = J.novaHistorie(); }
  if (P.nazev === 'Bez názvu') P.nazev = f.name ? f.name.replace(/\.[^.]+$/, '') : 'Vložený obrázek';
  try { await dbUlozObrazek(P.id, f); await dbUloz(JSON.parse(JSON.stringify(P))); }
  catch (e) { Dialog.chyba('Obrázek se nevešel do úložiště prohlížeče: ' + (e.message || e)); }
  bmp = novy; otoc = otocit(bmp, P.upravy); uprav = upravit(otoc, P.upravy); akt = 0;
  J.historieZapis(hist, snimek()); ulozeno = true; fitNutny = true;
  prepis();
}
async function prejmenuj() {
  const n = await Dialog.zeptej('Název projektu:', P.nazev); if (n == null || !n.trim()) return;
  P.nazev = n.trim(); zmena(true); const b = $('eNazev'); if (b) b.textContent = P.nazev;
}
function stahni(nazev, data, typ) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type: typ }));
  a.download = nazev; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const souborNazev = p => (p.nazev || 'prepis').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80);
/* obrázek pro export: upravený sken zmenšený na max. stranu, JPEG */
async function exportObrazek(max) {
  if (!uprav) return null;
  const k = Math.min(1, max / Math.max(uprav.width, uprav.height));
  const c = document.createElement('canvas'); c.width = Math.round(uprav.width * k); c.height = Math.round(uprav.height * k);
  const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(uprav, 0, 0, c.width, c.height);
  const b = await new Promise(ok => c.toBlob(ok, 'image/jpeg', 0.86));
  return { data: new Uint8Array(await b.arrayBuffer()), sirka: c.width, vyska: c.height, typ: 'jpeg', url: c.toDataURL('image/jpeg', 0.86) };
}
function nactiSkript(src) {
  return new Promise((ok, chyba) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => chyba(new Error('nelze načíst ' + src)); document.head.appendChild(s); });
}
async function exportPdf() {
  ulozHned();
  try {
    if (!window.jspdf) await nactiSkript('lib/jspdf.umd.min.js');
    const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
    let uni = false;
    try {
      const buf = await (await fetch('fonty/LiberationSerif-Regular.ttf')).arrayBuffer();
      let s = ''; const u8 = new Uint8Array(buf); for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
      doc.addFileToVFS('LS.ttf', btoa(s)); doc.addFont('LS.ttf', 'LS', 'normal'); doc.setFont('LS', 'normal'); uni = true;
    } catch (e) { doc.setFont('times', 'normal'); }
    const W = 210, M = 15, sirka = W - 2 * M;
    let y = M;
    doc.setFontSize(15); doc.text(P.nazev, M, y + 5); y += 11; doc.setFontSize(9.5);
    for (const [k, n] of J.META_POLE) if (P.meta[k]) { const t = doc.splitTextToSize(`${n}: ${P.meta[k]}`, sirka); doc.text(t, M, y); y += 4.3 * t.length; }
    const o = await exportObrazek(2400);
    if (o) {
      y += 2;
      let w = sirka, h = w * o.vyska / o.sirka;
      if (h > 297 - y - M) { h = 297 - y - M; w = h * o.sirka / o.vyska; }
      doc.addImage(o.url, 'JPEG', M + (sirka - w) / 2, y, w, h);
      doc.addPage(); y = M;
    }
    doc.setFontSize(12); doc.text('Přepis', M, y + 4); y += 10; doc.setFontSize(10.5);
    const radek = 5.2, sirC = 10;
    P.radky.forEach((r, i) => {
      const t = r.t || ' ', zalom = doc.getTextWidth(t) > sirka - sirC;
      const casti = zalom ? doc.splitTextToSize(t, sirka - sirC) : [t];
      if (y + radek * casti.length > 297 - M) { doc.addPage(); y = M; }
      doc.setTextColor(130); doc.text(String(i + 1), M, y); doc.setTextColor(0);
      if (zalom) { doc.text(casti, M + sirC, y); y += radek * casti.length; return; }
      let x = M + sirC;
      for (const u of J.useky(t)) {
        const w = doc.getTextWidth(u.t);
        if (u.n) { doc.setFillColor(255, 236, 140); doc.rect(x, y - 3.6, w, 4.6, 'F'); }
        doc.text(u.t, x, y); x += w;
      }
      y += radek;
    });
    y += 4; if (y > 297 - M) { doc.addPage(); y = M; }
    doc.setFontSize(8.5); doc.setTextColor(110);
    doc.text(uni ? 'Značky: [?] nečitelné, [slovo?] nejisté čtení, […] vynechaný úsek.' : 'Znacky: [?] necitelne, [slovo?] nejiste cteni, [...] vynechany usek.', M, y);
    stahni(souborNazev(P) + '.pdf', doc.output('blob'));
  } catch (e) { Dialog.chyba('PDF se nepodařilo vytvořit: ' + (e.message || e)); }
}
async function exportZaloha() {
  ulozHned();
  const blob = await dbObrazek(P.id);
  const obrazek = blob ? await new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(blob); }) : null;
  stahni(souborNazev(P) + '.kurent.json', JSON.stringify(Object.assign({ format: 'kurent-projekt', verze: 1 }, P, { obrazek }), null, 1), 'application/json');
}
async function importZaloha() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
  inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return;
    try {
      const o = JSON.parse(await f.text());
      if (!o || o.format !== 'kurent-projekt') throw new Error('není to záloha projektu přepisu');
      const p = J.normalizujProjekt(Object.assign({}, o, { id: J.noveId() }));
      await dbUloz(p);
      if (typeof o.obrazek === 'string' && o.obrazek.startsWith('data:image/')) await dbUlozObrazek(p.id, await (await fetch(o.obrazek)).blob());
      U.nast.projekt = p.id; U.ulozNast(); P = null; zavriDialog(); prepis();
    } catch (e) { Dialog.chyba('Import selhal: ' + (e.message || e)); }
  };
  inp.click();
}

/* ---------- dialog projektů ---------- */
function zavriDialog() { const d = $('dlgProjekty'); if (d && d.open) d.close(); }
async function projekty() {
  ulozHned();
  let d = $('dlgProjekty');
  if (!d) {
    d = document.createElement('dialog'); d.className = 'okno siroke'; d.id = 'dlgProjekty';
    d.innerHTML = `<form method="dialog"><header>📂 Projekty přepisů</header><div class="telo" id="pSeznam"></div>
      <footer><button type="button" class="btn" id="pImport">📥 Načíst zálohu…</button><button type="button" class="btn primary" id="pNovy">✚ Nový projekt</button><button class="btn" value="x">Zavřít</button></footer></form>`;
    document.body.appendChild(d);
    d.querySelector('#pNovy').onclick = async () => { const p = J.normalizujProjekt({}); await dbUloz(p); U.nast.projekt = p.id; U.ulozNast(); P = null; d.close(); prepis(); };
    d.querySelector('#pImport').onclick = importZaloha;
    d.querySelector('#pSeznam').addEventListener('click', async e => {
      const b = e.target.closest('[data-p]'); if (!b) return;
      const id = b.dataset.id;
      if (b.dataset.p === 'otevrit') { U.nast.projekt = id; U.ulozNast(); P = null; d.close(); prepis(); }
      else if (b.dataset.p === 'smazat') {
        const p = await dbProjekt(id);
        if (!await Dialog.potvrd(`Smazat projekt „${p.nazev}“ včetně obrázku? Nelze vrátit.`)) return;
        await dbSmaz(id);
        if (P && P.id === id) { P = null; U.nast.projekt = null; U.ulozNast(); d.close(); return prepis(); }
        seznam();
      }
    });
  }
  async function seznam() {
    const vse = (await dbVsechny()).sort((a, b) => b.zmeneno - a.zmeneno);
    $('pSeznam').innerHTML = vse.length ? `<div class="tab-obal"><table><thead><tr><th>Název</th><th>Řádků</th><th>[?]</th><th>Změněno</th><th></th></tr></thead><tbody>${vse.map(p => `<tr${P && p.id === P.id ? ' class="akt"' : ''}>
      <td data-i18n="ne"><b>${esc(p.nazev)}</b><br><span class="pozn">${esc([p.meta && p.meta.fond, p.meta && p.meta.kniha, p.meta && p.meta.folio].filter(Boolean).join(' · '))}</span></td>
      <td>${p.radky.filter(r => r.t).length}</td><td>${J.nejista(p.radky).length}</td><td class="pozn">${new Date(p.zmeneno).toLocaleString('cs-CZ')}</td>
      <td style="white-space:nowrap"><button type="button" class="btn mini" data-p="otevrit" data-id="${esc(p.id)}">Otevřít</button> <button type="button" class="btn mini danger" data-p="smazat" data-id="${esc(p.id)}" aria-label="Smazat">🗑</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="tip">Zatím žádné projekty.</p>';
  }
  await seznam();
  d.showModal();
}

/* ---------- příkazy a klávesy ---------- */
function prikaz(id) {
  const A = {
    oddal: () => zoomStred(1 / 1.25), priblis: () => zoomStred(1.25), prizpusob, vlevo: () => otoc90(-1), vpravo: () => otoc90(1),
    inverze: () => { nastavUpravu('inverze', !P.upravy.inverze); const c = U.obsah.querySelector('[data-uprava="inverze"]'); if (c) c.checked = P.upravy.inverze; },
    auto: autoUpravy, reset: () => { const ot = P.upravy.otoceni; P.upravy = Object.assign({}, J.UPRAVY_VYCHOZI, { otoceni: ot }); if (bmp) { otoc = otocit(bmp, P.upravy); uprav = upravit(otoc, P.upravy); } zmena(true); prepis(); },
    zpet, znovu, dalsiNejiste, oznac: prepniOznac, projekty,
    'exp-txt': () => { ulozHned(); stahni(souborNazev(P) + '.txt', J.exportTxt(P), 'text/plain;charset=utf-8'); },
    'exp-docx': async () => { ulozHned(); stahni(souborNazev(P) + '.docx', J.docx(P, await exportObrazek(2000)), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'); },
    'exp-docx-text': () => { ulozHned(); stahni(souborNazev(P) + '.docx', J.docx(P, null), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'); },
    'exp-pdf': exportPdf, 'exp-json': exportZaloha, 'imp-json': importZaloha,
    'exp-schranka': async () => { try { await navigator.clipboard.writeText(J.exportTxt(P, { hlavicka: false, cisla: false })); U.toast('Přepis zkopírován.'); } catch (e) { Dialog.chyba('Schránka není dostupná.'); } }
  };
  if (!P && id !== 'projekty') return;
  if (A[id]) A[id]();
}
/* globální klávesy, když je otevřený editor; vrací true, pokud klávesu zpracoval */
function klavesa(e) {
  if (!P || !$('eRadky')) return false;
  const vPoli = e.target.matches && e.target.matches('input,textarea,select'), vRadku = !!(e.target.closest && e.target.closest('#eRadky'));
  const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
  if (ctrl && !e.altKey && (k === 'z' || k === 'y')) {
    if (vPoli && !vRadku) return false;
    e.preventDefault(); (k === 'y' || e.shiftKey) ? znovu() : zpet(); return true;
  }
  if (ctrl && k === 's') { e.preventDefault(); ulozHned(); U.toast('Uloženo.'); return true; }
  if (ctrl && k === 'o') { e.preventDefault(); projekty(); return true; }
  if (e.key === 'F2') { e.preventDefault(); oznacNejiste(); return true; }
  if (e.key === 'F3') { e.preventDefault(); dalsiNejiste(); return true; }
  if (vPoli || ctrl || e.altKey) return false;
  const A = { '+': () => zoomStred(1.25), '=': () => zoomStred(1.25), '-': () => zoomStred(0.8), '0': prizpusob, r: () => otoc90(1), i: () => prikaz('inverze'), m: prepniOznac };
  if (A[e.key] || A[k]) { e.preventDefault(); (A[e.key] || A[k])(); return true; }
  return false;
}
function vlozeni(e) {
  if (!$('eRadky')) return;
  const f = [...(e.clipboardData && e.clipboardData.files || [])].find(x => /^image\//.test(x.type));
  if (f) { e.preventDefault(); nahraj(f); }
}

/* ---------- výřezy řádků pro cvičení „Moje řádky“ ---------- */
async function mojeRadky(max) {
  const vysl = [];
  let vse; try { vse = await dbVsechny(); } catch (e) { return vysl; }
  for (const p0 of vse) {
    const p = J.normalizujProjekt(p0);
    const radky = p.radky.filter(r => r.r && r.t.trim() && !J.nejista([r]).length);
    if (!radky.length) continue;
    const blob = await dbObrazek(p.id); if (!blob) continue;
    let b; try { b = await createImageBitmap(blob); } catch (e) { continue; }
    const obr = upravit(otocit(b, p.upravy), p.upravy);
    for (const r of radky) {
      const [x, y, w, h] = r.r, k = Math.min(1, 900 / w);
      const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
      c.getContext('2d').drawImage(obr, x, y, w, h, 0, 0, c.width, c.height);
      vysl.push({ id: `r:${p.id}:${r.id}`, typ: 'radek', text: r.t.trim(), obrazek: c.toDataURL('image/jpeg', 0.85), popis: p.nazev, jazyk: '', alt: [] });
      if (vysl.length >= (max || 200)) return vysl;
    }
  }
  return vysl;
}

document.addEventListener('paste', vlozeni);
addEventListener('pagehide', () => ulozHned());
document.addEventListener('visibilitychange', () => { if (document.hidden) ulozHned(); });
return { prepis, opust, prikaz, mojeRadky, klavesa, nahraj };
};
})();

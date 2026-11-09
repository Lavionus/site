/* Nástěnka scén – rozhraní (pohledy, tažení, editor, ukládání do IndexedDB). Logika je v jadro.js. */
(function () {
'use strict';
const J = window.NastenkaJadro;
const $ = id => document.getElementById(id);
const KLIC = 'webapp_nastenka_scen';
const STAV_IKONA = { napad: '💡', rozepsano: '✍️', hotovo: '✅' };
const NAZVY_BAREV = { '': 'bez barvy', cervena: 'červená', oranzova: 'oranžová', zluta: 'žlutá', zelena: 'zelená', tyrkys: 'tyrkysová', modra: 'modrá', fialova: 'fialová', ruzova: 'růžová', seda: 'šedá' };
const plocha = $('plocha');

let projekty = [];          // všechny projekty (celé objekty)
let p = null;               // aktivní projekt
const hist = new J.Historie(150);
let nast = Object.assign({ aktivni: '', pohled: 'nastenka', kompakt: false, cisla: true, grafSlova: false, obarvit: 'barva', velikost: 'M' }, cti());
const filtr = { text: '', postava: '', stitek: '', stav: '', ids: null, popis: '' };
let viditelne = null;       // Set id scén odpovídajících filtru, null = bez filtru
let otevrena = null;        // id scény v editoru
let fokusPo = null;         // {typ, id} – kam vrátit fokus po překreslení

function cti() { try { return JSON.parse(localStorage.getItem(KLIC)) || {}; } catch (e) { return {}; } }
function ulozNast() { try { localStorage.setItem(KLIC, JSON.stringify(nast)); } catch (e) { /* plné úložiště */ } }
function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function desetinne(n) { return Number(n || 0).toLocaleString('cs-CZ', { maximumFractionDigits: 1 }); }
function cis(n) { return Number(n || 0).toLocaleString('cs-CZ'); }
function hlas(t) { $('hlasatel').textContent = t; }

// ---------- IndexedDB ----------
let dbSlib = null;
function db() {
  if (!dbSlib) dbSlib = new Promise((ok, chyba) => {
    const r = indexedDB.open(KLIC, 2);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains('projekty')) d.createObjectStore('projekty', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('verze')) d.createObjectStore('verze', { keyPath: 'id' });
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => chyba(r.error);
  });
  return dbSlib;
}
async function dbOperace(rezim, fn, store) {
  const d = await db();
  return new Promise((ok, chyba) => {
    const tx = d.transaction(store || 'projekty', rezim), st = tx.objectStore(store || 'projekty');
    const r = fn(st);
    tx.oncomplete = () => ok(r && r.result);
    tx.onerror = () => chyba(tx.error);
  });
}
const dbVse = () => dbOperace('readonly', st => st.getAll());
const dbUloz = proj => dbOperace('readwrite', st => st.put(proj));
const dbSmaz = id => dbOperace('readwrite', st => st.delete(id));
const verzeVse = () => dbOperace('readonly', st => st.getAll(), 'verze');
const verzeUloz = v => dbOperace('readwrite', st => st.put(v), 'verze');
const verzeSmaz = id => dbOperace('readwrite', st => st.delete(id), 'verze');

let casUlozeni = 0;
function naplanujUlozeni() {
  clearTimeout(casUlozeni);
  const proj = p;
  casUlozeni = setTimeout(() => dbUloz(proj).catch(e => Dialog.chyba('Uložení selhalo: ' + e.message)), 350);
}
function ulozHned() { clearTimeout(casUlozeni); if (p) dbUloz(p).catch(() => {}); }
addEventListener('pagehide', ulozHned);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') ulozHned(); });

// ---------- změny s historií ----------
function zmena(fn, bezPrekresleni) {
  hist.zapis(p);
  const r = fn();
  p.upraveno = new Date().toISOString();
  naplanujUlozeni();
  if (!bezPrekresleni) vykresli();
  return r;
}
function vratStav(stav) {
  if (!stav) return;
  Object.keys(p).forEach(k => delete p[k]);
  Object.assign(p, stav);
  naplanujUlozeni();
  vykresli();
  if (otevrena) { if (J.najdi(p, otevrena)) naplnEditor(); else zavriEditor(); }
}
function zpet() { vratStav(hist.zpet(p)); }
function vpred() { vratStav(hist.vpred(p)); }

// ---------- projekty ----------
async function nactiProjekty() {
  try { projekty = (await dbVse()).map(x => { try { return J.normalizujProjekt(x); } catch (e) { return null; } }).filter(Boolean); }
  catch (e) { projekty = []; Dialog.chyba('IndexedDB není dostupná – práce se neuloží. ' + e.message); }
  projekty.sort((a, b) => String(b.upraveno).localeCompare(String(a.upraveno)));
  p = projekty.find(x => x.id === nast.aktivni) || projekty[0];
  if (!p) { p = J.novyProjekt('Můj román'); projekty.push(p); naplanujUlozeni(); }
  nast.aktivni = p.id; ulozNast();
}
function prepniProjekt(proj) {
  if (p && p !== proj) dbUloz(p);
  p = proj; nast.aktivni = p.id; ulozNast();
  hist.vymaz(); zavriEditor();
  vycistiFiltr(true);
  vykresli();
}
function pridejProjekt(proj) {
  projekty.unshift(proj);
  dbUloz(proj);
  prepniProjekt(proj);
}
async function novyProjekt() {
  const n = await Dialog.zeptej('Název nového projektu (knihy)', 'Nový román', { ok: 'Vytvořit' });
  if (n == null) return;
  pridejProjekt(J.novyProjekt(n.trim() || 'Nový román'));
  J.pridejSloupec(p, 'Kapitola 1'); naplanujUlozeni(); vykresli();
}
async function prejmenujProjekt() {
  const n = await Dialog.zeptej('Název projektu', p.nazev, { ok: 'Přejmenovat' });
  if (n == null || !n.trim()) return;
  zmena(() => { p.nazev = n.trim(); });
}
function duplikujProjekt() {
  const k = J.normalizujProjekt(JSON.parse(JSON.stringify(p)));
  k.id = J.noveId('p'); k.nazev = p.nazev + ' (kopie)'; k.vytvoreno = k.upraveno = new Date().toISOString();
  pridejProjekt(k);
  Dialog.info('Projekt zduplikován.');
}
async function smazProjekt() {
  if (!await Dialog.potvrd(`Smazat projekt „${p.nazev}“ se všemi ${p.sceny.length} scénami? Tohle nejde vrátit – případně si nejdřív uložte zálohu.`, { ok: 'Smazat', zrus: 'Ponechat' })) return;
  const id = p.id;
  clearTimeout(casUlozeni);
  projekty = projekty.filter(x => x.id !== id);
  await dbSmaz(id).catch(() => {});
  p = null;
  if (!projekty.length) projekty.push(J.novyProjekt('Můj román'));
  prepniProjekt(projekty[0]);
  naplanujUlozeni();
}

// ---------- ukázkový projekt ----------
function ukazka() {
  const u = J.novyProjekt('Ukázka – Most přes Ohři');
  const a = J.pridejSloupec(u, '1. dějství'), b = J.pridejSloupec(u, '2. dějství'), c = J.pridejSloupec(u, '3. dějství');
  const sc = (sl, nazev, shrnuti, pov, postavy, misto, cas, stav, cil, slov, napeti, stitky, barva, beat) =>
    J.pridejScenu(u, sl.id, { nazev, shrnuti, pov, postavy, misto, cas, stav, cilSlov: cil, slov, napeti, stitky, barva, beat });
  sc(a, 'Povodeň na prahu', 'Věra balí, když přijde starosta a chce její člun.', 'Věra', ['Valeš'], 'Přívoz', '12. 11. 2024 17:00', 'hotovo', 1500, 1620, 3, ['voda'], 'modra', 'Úvod');
  sc(a, 'Dcera v sušárně', 'Za tratí zůstala Koutná – a s ní Věřina dcera.', 'Věra', ['Koutná', 'Ema'], 'Sušárna', '12. 11. 2024 19:30', 'rozepsano', 1800, 900, 5, ['voda', 'noc'], 'modra', 'Rozněcující událost');
  sc(a, 'Starý průkaz', 'Retrospektiva: Věra před dvaceti lety mění jméno.', 'Věra', [], 'Úřad v Chebu', '3. 4. 2004', 'napad', 1200, 0, 4, ['tajemství'], 'fialova');
  sc(b, 'Proti proudu', 'Plavba přes zatopený sad, člun naráží na plot.', 'Věra', ['Valeš'], 'Sad', '12. 11. 2024 21:00', 'rozepsano', 2500, 1400, 7, ['voda', 'noc', 'akce'], 'cervena', 'První zlom');
  sc(b, 'Valeš ví', 'Starosta poznal Věřin průkaz. Mlčí, ale chce protislužbu.', 'Valeš', ['Věra'], 'Tělocvična', '13. 11. 2024 6:00', 'napad', 1500, 0, 6, ['tajemství'], 'fialova', 'Střed');
  sc(b, 'Ema odchází', 'Dcera zjistí pravdu a odejde s hasiči.', 'Ema', ['Věra'], 'Škola', '13. 11. 2024 10:00', 'napad', 1800, 0, 8, [], 'cervena');
  sc(c, 'Třetí břeh', 'Věra se vrací pro Koutnou sama; hráz povolí.', 'Věra', ['Koutná'], 'Hráz', '13. 11. 2024 22:00', 'napad', 3000, 0, 10, ['voda', 'akce'], 'cervena', 'Vyvrcholení');
  sc(c, 'Ráno po vodě', 'Bahno, ticho a nové jméno, které si Věra nechá.', 'Ema', ['Věra', 'Valeš'], 'Přívoz', '16. 11. 2024', 'napad', 1200, 0, 3, [], 'zelena', 'Rozuzlení');
  pridejProjekt(u);
}

// ---------- filtr ----------
function aktivniFiltr() { return !!(filtr.text.trim() || filtr.postava || filtr.stitek || filtr.stav || filtr.ids); }
function prepocitejFiltr() {
  viditelne = aktivniFiltr() ? J.filtruj(p, filtr) : null;
  if (viditelne && filtr.ids) { const ids = new Set(filtr.ids); viditelne = new Set([...viditelne].filter(id => ids.has(id))); }
  $('filtrPruh').hidden = !viditelne;
  if (viditelne) $('filtrInfo').textContent = `Odpovídá ${viditelne.size} z ${p.sceny.length} scén`;
  $('filtrKontrola').hidden = !filtr.ids;
  $('filtrKontrola').textContent = filtr.popis;
}
function vycistiFiltr(tise) {
  filtr.text = filtr.postava = filtr.stitek = filtr.stav = filtr.popis = ''; filtr.ids = null;
  $('hledat').value = ''; $('fPostava').value = ''; $('fStitek').value = ''; $('fStav').value = '';
  if (!tise) vykresli();
}
const skryta = id => viditelne && !viditelne.has(id);

function naplnSelect(sel, polozky, prvni) {
  const v = sel.value;
  sel.innerHTML = `<option value="">${esc(prvni)}</option>` + polozky.map(x => `<option value="${esc(x)}" data-i18n="ne">${esc(x)}</option>`).join('');
  sel.value = polozky.indexOf(v) >= 0 ? v : '';
  if (sel.value !== v) { if (sel === $('fPostava')) filtr.postava = ''; else filtr.stitek = ''; }
}
function naplnSeznamy() {
  const postavy = J.vsechnyPostavy(p), stitky = J.vsechnyStitky(p).map(x => x.nazev);
  naplnSelect($('fPostava'), postavy, '👤 Postava');
  naplnSelect($('fStitek'), stitky, '🏷 Štítek');
  const opt = a => a.map(x => `<option value="${esc(x)}">`).join('');
  $('dlPostavy').innerHTML = opt(postavy);
  $('dlStitky').innerHTML = opt(stitky);
  $('dlMista').innerHTML = opt([...new Set(p.sceny.map(s => s.misto).filter(Boolean))]);
}

// ---------- vykreslení ----------
let cisloSceny = new Map(), povBarvy = new Map();
const STAV_BARVA = { napad: 'seda', rozepsano: 'oranzova', hotovo: 'zelena' };
function barvaKarty(s) {
  if (nast.obarvit === 'pov') return povBarvy.get(s.pov) || '';
  if (nast.obarvit === 'stav') return STAV_BARVA[s.stav];
  return s.barva;
}
function legendaBarev() {
  if (nast.obarvit === 'barva') return '';
  const pol = nast.obarvit === 'pov' ? [...povBarvy].map(([j, b]) => `<span><i data-barva="${b}"></i><span data-i18n="ne">${esc(j)}</span></span>`)
    : Object.keys(STAV_BARVA).map(k => `<span><i data-barva="${STAV_BARVA[k]}"></i>${STAV_IKONA[k]} ${J.STAVY[k]}</span>`);
  return `<div class="legenda-barev">${nast.obarvit === 'pov' ? '<b>Barva = POV postava:</b>' : '<b>Barva = stav:</b>'} ${pol.join('')}</div>`;
}
function vykresli() {
  if (!p) return;
  cisloSceny = new Map(J.poradi(p).map((s, i) => [s.id, i + 1]));
  povBarvy = new Map([...new Set(J.poradi(p).map(s => s.pov).filter(Boolean))].map((j, i) => [j, J.BARVY[1 + i % (J.BARVY.length - 1)]]));
  naplnSeznamy();
  prepocitejFiltr();
  $('btnProjekt').textContent = '📚 ' + p.nazev + ' ▾';
  $('tiskTitul').textContent = p.nazev;
  document.title = '🗂️ ' + p.nazev + ' – Nástěnka scén';
  $('btnZpet').disabled = !hist.lzeZpet; $('btnVpred').disabled = !hist.lzeVpred;
  $('mnPrepocitat').disabled = !(p.rukopis && p.rukopis.typ);
  document.querySelectorAll('[data-obarvit]').forEach(b => b.setAttribute('aria-pressed', b.dataset.obarvit === nast.obarvit));
  document.querySelectorAll('[data-velikost]').forEach(b => b.setAttribute('aria-pressed', b.dataset.velikost === nast.velikost));
  $('mnKompakt').setAttribute('aria-pressed', nast.kompakt); $('mnCisla').setAttribute('aria-pressed', nast.cisla); $('mnGrafSlova').setAttribute('aria-pressed', nast.grafSlova);
  document.querySelectorAll('[data-pohled]').forEach(b => b.setAttribute('aria-pressed', b.dataset.pohled === nast.pohled));
  const sx = plocha.scrollLeft, sy = plocha.scrollTop;
  const scrollSloupcu = {};
  plocha.querySelectorAll('.sloupec').forEach(el => { scrollSloupcu[el.dataset.id] = el.querySelector('.sl-telo').scrollTop; });
  if (!p.sceny.length && !p.sloupce.length || (!p.sceny.length && nast.pohled !== 'nastenka')) plocha.innerHTML = prazdnyHtml();
  else ({ nastenka: kresliNastenku, osnova: kresliOsnovu, osa: kresliOsu, postavy: kresliPruhy, napeti: kresliNapeti }[nast.pohled] || kresliNastenku)();
  plocha.scrollLeft = sx; plocha.scrollTop = sy;
  plocha.querySelectorAll('.sloupec').forEach(el => { if (scrollSloupcu[el.dataset.id]) el.querySelector('.sl-telo').scrollTop = scrollSloupcu[el.dataset.id]; });
  if (fokusPo) {
    const sel = fokusPo.typ === 'sloupec' ? `.sloupec[data-id="${fokusPo.id}"] .sl-hlava` : fokusPo.typ === 'bod' ? `.bod[data-id="${fokusPo.id}"]` : `[data-id="${fokusPo.id}"].karta, tr[data-id="${fokusPo.id}"]`;
    const el = plocha.querySelector(sel);
    if (el) { el.focus({ preventScroll: true }); el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
    fokusPo = null;
  }
}
let casPrekresleni = 0;
function vykresliPozdeji() { clearTimeout(casPrekresleni); casPrekresleni = setTimeout(vykresli, 150); }

function prazdnyHtml() {
  return `<div class="prazdne"><div style="font-size:2.4rem">🗂️</div>
    <p><b>Projekt „<span data-i18n="ne">${esc(p.nazev)}</span>“ je prázdný.</b><br>Začněte šablonou struktury, importem osnovy z Markdownu, nebo přidejte první scénu.</p>
    <div class="akce"><button class="btn primary" data-prikaz="sablona">🧭 Šablona struktury</button>
    <button class="btn" data-prikaz="importMd">📥 Import z Markdownu</button>
    <button class="btn" data-prikaz="novaScena">✚ První scéna</button>
    <button class="btn" data-prikaz="ukazka">✨ Ukázkový projekt</button></div></div>`;
}

function slovaHtml(s) {
  if (s.cilSlov) {
    const pr = s.slov / s.cilSlov * 100;
    return `<span title="Skutečná / cílová délka">${cis(s.slov)} / ${cis(s.cilSlov)}</span><span class="ukaz${pr > 110 ? ' pres' : ''}"><i style="width:${Math.min(100, pr).toFixed(0)}%"></i></span>`;
  }
  return s.slov ? `<span title="Skutečná délka">${cis(s.slov)} sl.</span><span style="flex:1"></span>` : '<span style="flex:1"></span>';
}

function kartaHtml(s, tazitelna) {
  const meta = [];
  if (s.pov) meta.push(`<span title="POV postava">👁 ${esc(s.pov)}</span>`);
  if (s.postavy.length) meta.push(`<span title="Další postavy">👥 ${esc(s.postavy.join(', '))}</span>`);
  if (s.misto) meta.push(`<span title="Místo">📍 ${esc(s.misto)}</span>`);
  if (s.cas) meta.push(`<span title="Čas v příběhu">🕒 ${esc(s.cas)}</span>`);
  const chipy = (s.beat ? `<span class="chip beat" title="Beat struktury">◆ ${esc(s.beat)}</span>` : '') + s.stitky.filter(t => t !== 'beat' || !s.beat).map(t => `<span class="chip">#${esc(t)}</span>`).join('');
  const c = cisloSceny.get(s.id);
  return `<article class="karta${skryta(s.id) ? ' ztlumena' : ''}" tabindex="0" data-id="${s.id}" data-barva="${barvaKarty(s)}" aria-label="Scéna ${c}: ${esc(s.nazev)}">
    <div class="k-hlava">${nast.cisla ? `<span class="k-cislo">${c}</span>` : ''}<h3 data-i18n="ne">${esc(s.nazev || 'Bez názvu')}</h3>${tazitelna ? '<button class="uchop" tabindex="-1" aria-hidden="true" title="Přetáhnout">⠿</button>' : ''}</div>
    ${s.shrnuti ? `<div class="shrnuti" data-i18n="ne">${esc(s.shrnuti)}</div>` : ''}
    ${meta.length ? `<div class="meta" data-i18n="ne">${meta.join('')}</div>` : ''}
    ${chipy ? `<div class="stitky" data-i18n="ne">${chipy}</div>` : ''}
    <div class="pata"><span class="stav stav-${s.stav}">${STAV_IKONA[s.stav]} ${J.STAVY[s.stav]}</span>${slovaHtml(s)}<span title="Napětí (0–10)">⚡${s.napeti}</span></div>
  </article>`;
}

// ---------- pohled: nástěnka ----------
function kresliNastenku() {
  plocha.innerHTML = legendaBarev() + `<div class="korek vel-${nast.velikost}${nast.kompakt ? ' kompakt' : ''}" id="korek">` + p.sloupce.map(c => {
    const sc = J.scenySloupce(p, c.id);
    const slov = sc.reduce((a, s) => a + s.slov, 0), cil = sc.reduce((a, s) => a + s.cilSlov, 0);
    return `<section class="sloupec" data-id="${c.id}">
      <div class="sl-hlava" tabindex="0" aria-label="Sloupec ${esc(c.nazev)}">
        <button class="uchop" tabindex="-1" aria-hidden="true" title="Přetáhnout sloupec">⠿</button>
        <span class="sl-nazev" title="Dvojklikem přejmenovat" data-i18n="ne">${esc(c.nazev)}</span>
        <span class="sl-info" title="Scén · slov / cíl">${sc.length} · ${cis(slov)}${cil ? ' / ' + cis(cil) : ''}</span>
        <button class="tl" data-sl-menu="${c.id}" title="Možnosti sloupce" aria-label="Možnosti sloupce" style="padding:1px 6px">⋯</button>
      </div>
      <div class="sl-telo">${sc.map(s => kartaHtml(s, true)).join('')}</div>
      <div class="sl-pata"><button class="btn mini" data-nova-do="${c.id}">✚ Scéna</button></div>
    </section>`;
  }).join('') + `<button class="sl-novy" data-prikaz="novySloupec">✚ Nový sloupec</button></div>`;
}

// ---------- pohled: osnova ----------
function kresliOsnovu() {
  const st = J.statistiky(p);
  plocha.innerHTML = legendaBarev() + '<div class="list">' + p.sloupce.map((c, ci) => {
    const sc = J.scenySloupce(p, c.id), sst = st.sloupce[ci];
    return `<h2><span data-i18n="ne">${esc(c.nazev)}</span> <small><span>${sc.length} scén · ${cis(sst.slov)} slov</span>${sst.cil ? ` <span>· cíl ${cis(sst.cil)}</span>` : ''} <span>· hotovo ${sst.hotovo}</span></small></h2>
      <div class="obal-tab"><table class="osnova"><colgroup><col class="w-c"><col><col class="w-p"><col class="w-m"><col class="w-t"><col class="w-s"><col class="w-n"><col class="w-e"></colgroup><thead><tr><th>#</th><th>Scéna</th><th>POV</th><th>Místo</th><th>Čas</th><th>Stav</th><th style="text-align:right">Slova / cíl</th><th style="text-align:right">⚡</th></tr></thead><tbody>
      ${sc.map(s => `<tr class="radek${skryta(s.id) ? ' ztlumena' : ''}" tabindex="0" data-id="${s.id}" data-barva="${barvaKarty(s)}">
        <td class="c">${cisloSceny.get(s.id)}</td>
        <td data-i18n="ne"><b>${esc(s.nazev)}</b>${s.shrnuti ? `<div class="sh">${esc(s.shrnuti)}</div>` : ''}</td>
        <td data-i18n="ne">${esc(s.pov)}</td><td data-i18n="ne">${esc(s.misto)}</td><td data-i18n="ne">${esc(s.cas)}</td>
        <td><span class="stav stav-${s.stav}">${STAV_IKONA[s.stav]} ${J.STAVY[s.stav]}</span></td>
        <td class="n">${cis(s.slov)}${s.cilSlov ? ' / ' + cis(s.cilSlov) : ''}</td><td class="n">${s.napeti}</td></tr>`).join('') || '<tr><td colspan="8" style="color:var(--text-faint)">Žádné scény</td></tr>'}
      </tbody></table></div>`;
  }).join('') + `<p class="napoveda-txt" style="margin-top:16px"><span>Celkem ${st.scen} scén, ${cis(st.slov)} slov.</span>${st.cil ? ` <span>Cíl: ${cis(st.cil)} slov.</span>` : ''} <span>Pořadí měníte Alt+↑/↓ na řádku nebo tažením na nástěnce.</span></p></div>`;
}

// ---------- pohled: časová osa ----------
function miniKarta(s, extra) {
  return `<article class="karta${skryta(s.id) ? ' ztlumena' : ''}" tabindex="0" data-id="${s.id}" data-barva="${barvaKarty(s)}">
    <div class="k-hlava"><span class="k-cislo">${cisloSceny.get(s.id)}</span><h3 data-i18n="ne">${esc(s.nazev)}</h3></div>
    ${extra || ''}
    <div class="meta" data-i18n="ne">${s.misto ? `<span>📍 ${esc(s.misto)}</span>` : ''}${s.postavy.length ? `<span>👥 ${esc(s.postavy.join(', '))}</span>` : ''}</div>
  </article>`;
}
function kresliOsu() {
  const o = J.casovaOsa(p);
  const sloupecNazev = id => (p.sloupce.find(c => c.id === id) || {}).nazev || '';
  const povy = [...new Set(o.polozky.map(x => x.scena.pov))].sort((a, b) => !a - !b || a.localeCompare(b, 'cs'));
  let h = '';
  if (o.polozky.length) {
    h += `<div class="osa" style="grid-template-columns:auto repeat(${povy.length},230px)">
      <div class="hl">Čas v příběhu</div>${povy.map(v => `<div class="hl" data-i18n="ne">${v ? '👁 ' + esc(v) : '— bez POV'}</div>`).join('')}`;
    o.polozky.forEach((x, i) => {
      const r = i + 2, col = povy.indexOf(x.scena.pov) + 2;
      const extra = `<div class="meta"><span data-i18n="ne">${esc(sloupecNazev(x.scena.sloupec))}</span>${x.retro ? '<span class="retro" title="Čte se později, ale děje se dřív než předchozí scény">↶ retrospektiva</span>' : ''}</div>`;
      h += `<div class="cas" style="grid-row:${r};grid-column:1" data-i18n="ne">${esc(x.scena.cas)}</div>
        <div style="grid-row:${r};grid-column:${col}">${miniKarta(x.scena, extra)}</div>`;
    });
    h += '</div>';
  } else h += '<div class="prazdne">Žádná scéna nemá rozpoznaný čas v příběhu. Zadejte ho na kartičce, např. <b>3. den 14:00</b> nebo <b>12. 5. 1888</b>.</div>';
  if (o.bezCasu.length) {
    h += `<div class="osa-bez"><h2 style="font-size:.95rem">Bez rozpoznaného času (${o.bezCasu.length})</h2><div class="karty">` +
      o.bezCasu.map(x => miniKarta(x.scena, x.scena.cas ? `<div class="meta"><span data-i18n="ne">🕒 ${esc(x.scena.cas)}</span></div>` : '')).join('') + '</div></div>';
  }
  plocha.innerHTML = h;
}

// ---------- pohled: pruhy postav ----------
function kresliPruhy() {
  const pr = J.pruhyPostav(p);
  if (!pr.postavy.length) { plocha.innerHTML = '<div class="prazdne">Žádná scéna zatím nemá POV ani další postavy. Doplňte je v editoru kartičky.</div>'; return; }
  const zac = new Set(p.sloupce.map(c => (J.scenySloupce(p, c.id)[0] || {}).id));
  let h = '<div class="pruhy-obal"><div class="obal-tab"><table class="pruhy"><thead><tr class="kap"><th class="jm"></th>';
  for (const c of p.sloupce) { const n = J.scenySloupce(p, c.id).length; if (n) h += `<th colspan="${n}" title="${esc(c.nazev)}" data-i18n="ne">${esc(c.nazev)}</th>`; }
  h += '</tr><tr class="cis"><th class="jm">Postava</th>' + pr.sceny.map((s, i) => `<th class="${zac.has(s.id) ? 'zac' : ''}" title="${esc(s.nazev)}">${i + 1}</th>`).join('') + '</tr></thead><tbody>';
  for (const po of pr.postavy) {
    if (filtr.postava && filtr.postava !== po.jmeno) continue;
    const kde = new Map(po.vyskyty.map(v => [v.i, v.pov]));
    h += `<tr><th class="jm" title="${esc(po.jmeno)}: ${po.celkem} scén, z toho ${po.pov} jako POV; nejdelší mezera ${po.mezera} scén"><span data-i18n="ne">${esc(po.jmeno)}</span><small>${po.celkem}× · POV ${po.pov}</small></th>`;
    pr.sceny.forEach((s, i) => {
      const t = kde.has(i) ? (kde.get(i) ? 'ano pov' : 'ano') : (i > po.prvni && i < po.posledni ? 'spoj' : '');
      h += `<td class="${t}${zac.has(s.id) ? ' zac' : ''}" data-id="${s.id}" title="${i + 1}. ${esc(s.nazev)}${s.pov ? ' · POV ' + esc(s.pov) : ''}"></td>`;
    });
    h += '</tr>';
  }
  h += `</tbody></table></div>
    <div class="legenda"><span><i class="pov"></i>POV postava scény</span><span><i></i>postava ve scéně</span><span>Světlý pruh = postava je v ději, ale mimo scénu.</span></div>
    <div class="obal-tab"><table class="stat-tab" style="max-width:720px"><thead><tr><th>Postava</th><th>Scén</th><th>POV</th><th>První</th><th>Poslední</th><th>Nejdelší mezera</th><th>Slov z jejího POV</th></tr></thead><tbody>
    ${pr.postavy.map(po => `<tr><td data-i18n="ne">${esc(po.jmeno)}</td><td>${po.celkem}</td><td>${po.pov}</td><td>${po.prvni + 1}</td><td>${po.posledni + 1}</td><td>${po.mezera}</td><td>${cis(po.slovPov)}</td></tr>`).join('')}
    </tbody></table></div></div>`;
  plocha.innerHTML = h;
}

// ---------- pohled: napětí a statistiky ----------
const GRAF = { H: 320, L: 36, R: 16, T: 54, B: 26 };
function grafSvg(sirka) {
  const body = J.krivkaNapeti(p, nast.grafSlova);
  const n = body.length;
  const W = Math.max(sirka, n * (nast.grafSlova ? 14 : 30) + GRAF.L + GRAF.R);
  const pw = W - GRAF.L - GRAF.R, ph = GRAF.H - GRAF.T - GRAF.B;
  // šířka úseku bodu: podle pořadí 1, podle slov délka scény
  const sir = b => nast.grafSlova ? Math.max(b.scena.slov || b.scena.cilSlov, 1) : 1;
  const celkem = n ? body[n - 1].x + sir(body[n - 1]) : 1;
  const X = v => GRAF.L + v / celkem * pw;
  const Y = v => GRAF.T + (10 - v) / 10 * ph;
  let h = `<svg class="graf" width="${W}" height="${GRAF.H}" viewBox="0 0 ${W} ${GRAF.H}" role="img" aria-label="Graf napětí přes scény">`;
  // pásma sloupců
  p.sloupce.forEach((c, ci) => {
    const b = body.filter(x => x.scena.sloupec === c.id);
    if (!b.length) return;
    const x0 = X(b[0].x), x1 = X(b[b.length - 1].x + sir(b[b.length - 1]));
    if (ci % 2 === 0) h += `<rect class="pasmo" x="${x0}" y="4" width="${x1 - x0}" height="${ph + GRAF.T - 4}"/>`;
    h += `<text class="pasmo-txt" x="${x0 + 4}" y="18" data-i18n="ne">${esc(zkrat(c.nazev, Math.max(3, Math.floor((x1 - x0) / 7))))}</text>`;
  });
  for (let v = 0; v <= 10; v += 2) h += `<line class="mrizka" x1="${GRAF.L}" x2="${W - GRAF.R}" y1="${Y(v)}" y2="${Y(v)}"/><text class="osa-txt" x="${GRAF.L - 8}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`;
  const bx = b => X(b.x + sir(b) / 2);
  if (n) {
    const cesta = body.map((b, i) => (i ? 'L' : 'M') + bx(b).toFixed(1) + ' ' + Y(b.y).toFixed(1)).join(' ');
    h += `<path class="plocha" d="${cesta} L${bx(body[n - 1]).toFixed(1)} ${Y(0)} L${bx(body[0]).toFixed(1)} ${Y(0)} Z"/><path class="cara" d="${cesta}"/>`;
    for (const b of body) {
      if (b.scena.beat && n <= 60) h += `<text class="beat-txt" transform="translate(${bx(b).toFixed(1)} ${(Y(b.y) - 10).toFixed(1)}) rotate(-30)" data-i18n="ne">◆ ${esc(zkrat(b.scena.beat.replace(/\s*\(.*\)$/, ''), 22))}</text>`;
    }
    for (const b of body) {
      h += `<rect class="zasah" data-id="${b.scena.id}" x="${(bx(b) - 9).toFixed(1)}" y="${GRAF.T}" width="18" height="${ph}"/>`;
      h += `<circle class="bod${skryta(b.scena.id) ? ' ztlumena' : ''}" tabindex="0" data-id="${b.scena.id}" cx="${bx(b).toFixed(1)}" cy="${Y(b.y).toFixed(1)}" r="5.5" aria-label="${esc(b.scena.nazev)}: napětí ${b.y}"/>`;
    }
  }
  h += `<text class="osa-txt" x="${GRAF.L}" y="${GRAF.H - 6}">${nast.grafSlova ? 'délka v pořadí čtení (slova, u nenapsaných cíl) →' : 'scény v pořadí čtení →'}</text></svg>`;
  return h;
}
function zkrat(t, n) { t = String(t); return t.length > n ? t.slice(0, n - 1) + '…' : t; }

function kresliNapeti() {
  const st = J.statistiky(p);
  const povy = Object.entries(st.pov).sort((a, b) => b[1] - a[1]);
  const maxPov = povy.length ? povy[0][1] : 1;
  plocha.innerHTML = `<div class="graf-obal">
    <div class="graf-hlava"><h2>📈 Napětí a gradace</h2>
      <div class="prepinac" style="width:auto"><button type="button" data-graf="poradi" aria-pressed="${!nast.grafSlova}">po scénách</button><button type="button" data-graf="slova" aria-pressed="${nast.grafSlova}">podle délky</button></div></div>
    <div class="graf-plocha" id="grafPlocha"></div>
    <p class="napoveda-txt">Bod táhněte nahoru/dolů nebo ho vyberte Tabem a měňte šipkami ↑/↓; Enter otevře scénu. Svislé pásy jsou sloupce, ◆ beaty šablony.</p>
    <div class="dlazdice">
      <div><b>${st.scen}</b><span>scén ve ${st.sloupcu} sloupcích</span></div>
      <div><b>${cis(st.slov)}</b><span>slov napsáno</span>${st.cil ? `<span> · cíl ${cis(st.cil)}</span>` : ''}</div>
      <div><b>${desetinne(st.plneni)} %</b><span>plnění cílů scén</span></div>
      <div><b>${desetinne(st.hotovoProc)} %</b><span>scén hotovo (${st.stavy.hotovo}) · ✍️ ${st.stavy.rozepsano} · 💡 ${st.stavy.napad}</span></div>
      <div><b>${desetinne(st.prumerNapeti)}</b><span>průměrné napětí</span></div>
      <div><b>${st.bezPov} / ${st.bezCasu}</b><span>scén bez POV / bez času</span></div>
    </div>
    <div class="dva">
      <div><h3>Po sloupcích</h3><div class="obal-tab"><table class="stat-tab"><thead><tr><th>Sloupec</th><th>Scén</th><th>Hotovo</th><th>Slov</th><th>Cíl</th><th>%</th></tr></thead><tbody>
        ${st.sloupce.map(c => `<tr><td data-i18n="ne">${esc(c.nazev)}</td><td>${c.scen}</td><td>${c.hotovo}</td><td>${cis(c.slov)}</td><td>${cis(c.cil)}</td><td>${c.cil ? Math.round(c.slov / c.cil * 100) : '–'}</td></tr>`).join('')}
      </tbody></table></div></div>
      <div><h3>Scény podle POV</h3>${povy.map(([j, n]) => `<div class="pruh-pov"><span data-i18n="ne">${esc(j)}</span><span class="ukaz"><i style="width:${n / maxPov * 100}%"></i></span><span>${n}</span></div>`).join('') || '<p class="napoveda-txt">Žádná scéna nemá POV.</p>'}</div>
    </div></div>`;
  kresliGraf();
}
function kresliGraf() {
  const gp = $('grafPlocha');
  if (gp) gp.innerHTML = grafSvg(gp.clientWidth - 2) + '<div class="bublina" id="bublina" hidden></div>';
}
function ukazBublinu(id, el) {
  const s = J.najdi(p, id), b = $('bublina');
  if (!s || !b) return;
  b.innerHTML = `<b data-i18n="ne">${cisloSceny.get(id)}. ${esc(s.nazev)}</b><span>⚡ ${s.napeti}${s.pov ? ' · 👁 ' : ''}<span data-i18n="ne">${esc(s.pov)}</span> · ${cis(s.slov)} sl.</span>`;
  b.hidden = false;
  const gp = $('grafPlocha'), r = el.getBoundingClientRect(), g = gp.getBoundingClientRect();
  b.style.left = Math.min(r.left - g.left + gp.scrollLeft + 12, gp.scrollWidth - b.offsetWidth - 4) + 'px';
  b.style.top = Math.max(4, r.top - g.top - b.offsetHeight - 6) + 'px';
}

// ---------- editor scény ----------
const POLE = { eNazev: 'nazev', eShrnuti: 'shrnuti', ePov: 'pov', ePostavy: 'postavy', eMisto: 'misto', eCas: 'cas', eCil: 'cilSlov', eSlov: 'slov', eNapeti: 'napeti', eStitky: 'stitky', eBeat: 'beat', ePoznamky: 'poznamky' };
let editSnimek = null;
$('eBarvy').innerHTML = J.BARVY.map(b => `<button type="button" data-b="${b}" data-barva="${b}" class="${b ? '' : 'bez'}" title="${NAZVY_BAREV[b]}" aria-label="${NAZVY_BAREV[b]}"></button>`).join('');

function otevriEditor(id) {
  if (!J.najdi(p, id)) return;
  otevrena = id;
  naplnEditor();
  $('editorBg').classList.add('zobraz');
  setTimeout(() => { if (otevrena) $('eNazev').focus(); }, 30);
}
function naplnEditor() {
  const s = J.najdi(p, otevrena);
  for (const [el, k] of Object.entries(POLE)) {
    const v = s[k];
    if (document.activeElement !== $(el)) $(el).value = Array.isArray(v) ? v.join(', ') : v;
  }
  $('eNapetiV').textContent = s.napeti;
  $('eStav').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.stav === s.stav));
  $('eBarvy').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.b === s.barva));
  $('eSloupec').innerHTML = p.sloupce.map(c => `<option value="${c.id}">${esc(c.nazev)}</option>`).join('');
  $('eSloupec').value = s.sloupec;
  const ve = J.scenySloupce(p, s.sloupec);
  $('eKde').textContent = `Scéna č. ${cisloSceny.get(s.id) || ''} · ${ve.indexOf(s) + 1}. ve sloupci`;
  editSnimek = JSON.stringify(p);
}
function zavriEditor() {
  if (!otevrena) return;
  const id = otevrena;
  potvrdEditaci();
  otevrena = null;
  $('editorBg').classList.remove('zobraz');
  vykresli();
  const el = plocha.querySelector(`[data-id="${id}"].karta, tr[data-id="${id}"]`);
  if (el) el.focus({ preventScroll: true });
}
// zapsat do historie stav před úpravou textových polí (jedna položka historie na jedno pole)
function potvrdEditaci() {
  if (editSnimek && editSnimek !== JSON.stringify(p)) { hist.zapis(JSON.parse(editSnimek)); $('btnZpet').disabled = false; }
  editSnimek = JSON.stringify(p);
}
$('editor').addEventListener('input', e => {
  const k = POLE[e.target.id];
  const s = J.najdi(p, otevrena);
  if (!k || !s) return;
  s[k] = e.target.value;
  J.normalizujScenu(s);
  if (k === 'napeti') $('eNapetiV').textContent = s.napeti;
  p.upraveno = new Date().toISOString();
  naplanujUlozeni();
  vykresliPozdeji();
});
$('editor').addEventListener('change', e => { if (POLE[e.target.id]) { potvrdEditaci(); vykresliPozdeji(); } });
$('eStav').addEventListener('click', e => {
  const b = e.target.closest('[data-stav]'); if (!b) return;
  potvrdEditaci(); zmena(() => { J.najdi(p, otevrena).stav = b.dataset.stav; }); naplnEditor();
});
$('eBarvy').addEventListener('click', e => {
  const b = e.target.closest('[data-b]'); if (!b) return;
  potvrdEditaci(); zmena(() => { J.najdi(p, otevrena).barva = b.dataset.b; }); naplnEditor();
});
$('eSloupec').addEventListener('change', e => {
  potvrdEditaci(); zmena(() => J.presunScenu(p, otevrena, e.target.value, null)); naplnEditor();
});
$('eNahoru').onclick = () => { potvrdEditaci(); zmena(() => J.posunScenu(p, otevrena, 'nahoru')); naplnEditor(); };
$('eDolu').onclick = () => { potvrdEditaci(); zmena(() => J.posunScenu(p, otevrena, 'dolu')); naplnEditor(); };
$('eDuplikovat').onclick = () => { potvrdEditaci(); const k = zmena(() => J.duplikujScenu(p, otevrena)); if (k) { otevrena = k.id; naplnEditor(); Dialog.info('Scéna zduplikována.'); } };
$('eSmazat').onclick = () => smazScenu(otevrena);
$('eZavrit').onclick = zavriEditor;
$('editorBg').addEventListener('click', e => { if (e.target === $('editorBg')) zavriEditor(); });

async function smazScenu(id) {
  const s = J.najdi(p, id); if (!s) return;
  if (!await Dialog.potvrd(`Smazat scénu „${s.nazev}“? (Jde vrátit přes Zpět.)`, { ok: 'Smazat', zrus: 'Ponechat' })) return;
  if (otevrena === id) { potvrdEditaci(); otevrena = null; $('editorBg').classList.remove('zobraz'); }
  const poradi = J.poradi(p), i = poradi.indexOf(s);
  const dalsi = poradi[i + 1] || poradi[i - 1];
  if (dalsi) fokusPo = { typ: 'karta', id: dalsi.id };
  zmena(() => J.smazScenu(p, id));
  hlas('Scéna smazána');
}

function novaScena(idSloupce) {
  if (!p.sloupce.length) zmena(() => J.pridejSloupec(p, 'Kapitola 1'), true);
  const sl = idSloupce || (document.activeElement && document.activeElement.closest && (document.activeElement.closest('.sloupec') || {}).dataset || {}).id || (J.najdi(p, otevrena) || {}).sloupec || p.sloupce[p.sloupce.length - 1].id;
  const s = zmena(() => J.pridejScenu(p, sl, { nazev: 'Nová scéna' }));
  if (nast.pohled !== 'nastenka' && nast.pohled !== 'osnova') { nast.pohled = 'nastenka'; ulozNast(); vykresli(); }
  const el = plocha.querySelector(`.karta[data-id="${s.id}"]`);
  if (el) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  otevriEditor(s.id);
  $('eNazev').select();
}
async function novySloupec(index) {
  const n = await Dialog.zeptej('Název sloupce (dějství nebo kapitola)', 'Kapitola ' + (p.sloupce.length + 1), { ok: 'Přidat' });
  if (n == null) return;
  if (nast.pohled !== 'nastenka') { nast.pohled = 'nastenka'; ulozNast(); }
  const c = zmena(() => J.pridejSloupec(p, n.trim() || 'Kapitola', index));
  fokusPo = { typ: 'sloupec', id: c.id }; vykresli();
}
async function prejmenujSloupec(id) {
  const c = p.sloupce.find(x => x.id === id); if (!c) return;
  const n = await Dialog.zeptej('Název sloupce', c.nazev, { ok: 'Přejmenovat' });
  if (n == null || !n.trim()) return;
  fokusPo = { typ: 'sloupec', id };
  zmena(() => J.prejmenujSloupec(p, id, n.trim()));
}
async function smazSloupec(id) {
  const c = p.sloupce.find(x => x.id === id); if (!c) return;
  const n = J.scenySloupce(p, id).length;
  if (n) {
    const i = p.sloupce.indexOf(c);
    const kam = p.sloupce.length > 1 ? `Scény (${n}) se přesunou do sloupce „${p.sloupce[Math.max(0, i - 1)].nazev}“` : `Smažou se i jeho scény (${n})`;
    if (!await Dialog.potvrd(`Smazat sloupec „${c.nazev}“? ${kam}. Jde vrátit přes Zpět.`, { ok: 'Smazat sloupec', zrus: 'Ponechat' })) return;
  } else if (!await Dialog.potvrd(`Smazat prázdný sloupec „${c.nazev}“?`, { ok: 'Smazat', zrus: 'Ponechat' })) return;
  zmena(() => J.smazSloupec(p, id));
}

// ---------- tažení myší a prstem ----------
let tah = null, prave = false;
plocha.addEventListener('pointerdown', e => {
  if (e.button !== 0 || nast.pohled !== 'nastenka') return;
  const uchop = e.target.closest('.uchop');
  const karta = e.target.closest('.korek .karta');
  const hlava = uchop && e.target.closest('.sl-hlava');
  if (hlava) return zacniTah(e, hlava.closest('.sloupec'), 'sloupec');
  if (!karta) return;
  if (e.pointerType !== 'mouse' && !uchop) return;   // na dotyku jen za úchyt, jinak se posouvá plocha
  zacniTah(e, karta, 'karta');
});
function zacniTah(e, el, druh) {
  tah = { el, druh, id: el.dataset.id, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, bezi: false, pid: e.pointerId };
  if (e.pointerType !== 'mouse') { e.preventDefault(); spustTah(); }
  addEventListener('pointermove', tahPohyb);
  addEventListener('pointerup', tahKonec);
  addEventListener('pointercancel', tahZrus);
}
function spustTah() {
  tah.bezi = true;
  const r = tah.el.getBoundingClientRect();
  tah.dx = tah.x0 - r.left; tah.dy = tah.y0 - r.top;
  const duch = (tah.druh === 'sloupec' ? tah.el.querySelector('.sl-hlava') : tah.el).cloneNode(true);
  duch.classList.add('duch'); duch.removeAttribute('tabindex');
  duch.style.width = r.width + 'px';
  if (tah.druh === 'sloupec') duch.style.background = 'var(--bg-panel)';
  document.body.appendChild(duch);
  tah.duch = duch;
  tah.el.classList.add(tah.druh === 'sloupec' ? 'tazeny' : 'tazena');
  if (tah.druh === 'karta') {
    tah.misto = document.createElement('div');
    tah.misto.className = 'misto-drop';
    tah.misto.style.height = r.height + 'px';
    tah.el.after(tah.misto);
  }
  document.body.style.userSelect = 'none';
  tah.rolovani = setInterval(autoRoluj, 16);
  polozDucha();
}
function polozDucha() { tah.duch.style.left = (tah.x - tah.dx) + 'px'; tah.duch.style.top = (tah.y - tah.dy) + 'px'; }
function tahPohyb(e) {
  if (!tah || e.pointerId !== tah.pid) return;
  tah.x = e.clientX; tah.y = e.clientY;
  if (!tah.bezi) { if (Math.hypot(tah.x - tah.x0, tah.y - tah.y0) < 6) return; spustTah(); }
  e.preventDefault();
  polozDucha();
  umistiCil();
}
function umistiCil() {
  const pod = document.elementFromPoint(tah.x, tah.y);
  const sl = pod && pod.closest('.sloupec');
  if (tah.druh === 'karta') {
    if (!sl) return;
    const telo = sl.querySelector('.sl-telo');
    const karty = [...telo.querySelectorAll('.karta:not(.tazena)')];
    // karty pod značkou dopadu jsou o její výšku níž – počítat s polohou, jako by značka nebyla (jinak značka „uteče“ a nejde pustit za poslední kartu)
    const posun = tah.misto.parentElement === telo ? tah.misto.offsetHeight + 8 : 0;
    const pred = karty.find(k => {
      const r = k.getBoundingClientRect();
      const dole = posun && (tah.misto.compareDocumentPosition(k) & Node.DOCUMENT_POSITION_FOLLOWING);
      return tah.y < r.top - (dole ? posun : 0) + r.height / 2;
    });
    if (pred) { if (pred.previousElementSibling !== tah.misto) telo.insertBefore(tah.misto, pred); }
    else if (telo.lastElementChild !== tah.misto) telo.appendChild(tah.misto);
  } else {
    const sloupce = [...plocha.querySelectorAll('.sloupec')];
    let index = sloupce.findIndex(s => { const r = s.getBoundingClientRect(); return tah.x < r.left + r.width / 2; });
    if (index < 0) index = sloupce.length;
    tah.cilIndex = index;
    sloupce.forEach((s, i) => s.classList.toggle('cil-sl', i === Math.min(index, sloupce.length - 1) && s !== tah.el));
  }
}
function autoRoluj() {
  if (!tah) return;
  const r = plocha.getBoundingClientRect(), okraj = 50, krok = 14;
  if (tah.x < r.left + okraj) plocha.scrollLeft -= krok; else if (tah.x > r.right - okraj) plocha.scrollLeft += krok;
  const pod = document.elementFromPoint(tah.x, tah.y);
  const telo = pod && pod.closest('.sloupec') && pod.closest('.sloupec').querySelector('.sl-telo');
  if (telo) {
    const t = telo.getBoundingClientRect();
    if (tah.y < t.top + 30) telo.scrollTop -= krok; else if (tah.y > t.bottom - 30) telo.scrollTop += krok;
  }
  if (tah.y > r.bottom - 30) plocha.scrollTop += krok; else if (tah.y < r.top + 20) plocha.scrollTop -= krok;
}
function uklidTah() {
  removeEventListener('pointermove', tahPohyb); removeEventListener('pointerup', tahKonec); removeEventListener('pointercancel', tahZrus);
  if (tah && tah.bezi) {
    clearInterval(tah.rolovani);
    tah.duch.remove(); if (tah.misto) tah.misto.remove();
    tah.el.classList.remove('tazena', 'tazeny');
    plocha.querySelectorAll('.cil-sl').forEach(s => s.classList.remove('cil-sl'));
    document.body.style.userSelect = '';
  }
}
function tahKonec(e) {
  if (!tah || e.pointerId !== tah.pid) return;
  const t = tah;
  if (t.bezi) {
    prave = true; setTimeout(() => { prave = false; }, 0);
    if (t.druh === 'karta') {
      const telo = t.misto.parentElement, sl = telo.closest('.sloupec').dataset.id;
      // index v cílovém sloupci bez tažené scény = počet ostatních kartiček před značkou
      const deti = [...telo.children];
      const kam = deti.slice(0, deti.indexOf(t.misto)).filter(k => k.classList.contains('karta') && !k.classList.contains('tazena')).length;
      uklidTah(); tah = null;
      fokusPo = { typ: 'karta', id: t.id };
      zmena(() => J.presunScenu(p, t.id, sl, kam));
    } else {
      const i = p.sloupce.findIndex(c => c.id === t.id);
      let cil = t.cilIndex == null ? i : t.cilIndex;
      if (cil > i) cil--;
      uklidTah(); tah = null;
      fokusPo = { typ: 'sloupec', id: t.id };
      if (cil !== i) zmena(() => J.presunSloupec(p, t.id, cil)); else vykresli();
    }
    return;
  }
  uklidTah(); tah = null;
}
function tahZrus() { uklidTah(); tah = null; vykresli(); }

// ---------- kliknutí v ploše ----------
plocha.addEventListener('click', e => {
  if (prave) return;
  const nova = e.target.closest('[data-nova-do]');
  if (nova) return novaScena(nova.dataset.novaDo);
  const menu = e.target.closest('[data-sl-menu]');
  if (menu) { e.stopPropagation(); return menuSloupce(menu); }
  const graf = e.target.closest('[data-graf]');
  if (graf) { nast.grafSlova = graf.dataset.graf === 'slova'; ulozNast(); return vykresli(); }
  if (e.target.closest('.uchop')) return;
  const sc = e.target.closest('.karta[data-id], tr[data-id], td[data-id]');
  if (sc) otevriEditor(sc.dataset.id);
});
plocha.addEventListener('dblclick', e => {
  const n = e.target.closest('.sl-nazev');
  if (n) prejmenujSloupec(n.closest('.sloupec').dataset.id);
});

function menuSloupce(btn) {
  const id = btn.dataset.slMenu, i = p.sloupce.findIndex(c => c.id === id);
  let n = $('nabSloupec');
  if (!n) { n = document.createElement('div'); n.id = 'nabSloupec'; n.className = 'nabidka'; n.hidden = true; document.body.appendChild(n); }
  n.innerHTML = `<button class="tl" data-sa="prejmenovat">✏️ Přejmenovat…</button>
    <button class="tl" data-sa="scena">✚ Nová scéna sem</button>
    <button class="tl" data-sa="vlevo" ${i === 0 ? 'disabled' : ''}>◀ Posunout vlevo <kbd>Alt+←</kbd></button>
    <button class="tl" data-sa="vpravo" ${i === p.sloupce.length - 1 ? 'disabled' : ''}>▶ Posunout vpravo <kbd>Alt+→</kbd></button>
    <button class="tl" data-sa="vlozit">➕ Vložit sloupec za tento…</button>
    <hr><button class="tl" data-sa="smazat" style="color:var(--danger)">🗑 Smazat sloupec…</button>`;
  n.onclick = ev => {
    const b = ev.target.closest('[data-sa]'); if (!b || b.disabled) return;
    zavriNabidky();
    const a = b.dataset.sa;
    if (a === 'prejmenovat') prejmenujSloupec(id);
    else if (a === 'scena') novaScena(id);
    else if (a === 'vlevo' || a === 'vpravo') { fokusPo = { typ: 'sloupec', id }; zmena(() => J.presunSloupec(p, id, i + (a === 'vlevo' ? -1 : 1))); }
    else if (a === 'vlozit') novySloupec(i + 1);
    else if (a === 'smazat') smazSloupec(id);
  };
  otevriNabidku(n, btn);
}

// ---------- klávesnice v ploše ----------
plocha.addEventListener('keydown', e => {
  const k = e.key;
  const karta = e.target.closest('.karta[data-id], tr[data-id]');
  const hlava = e.target.classList.contains('sl-hlava') ? e.target : null;
  const bod = e.target.classList && e.target.classList.contains('bod') ? e.target : null;
  if (bod) {
    const s = J.najdi(p, bod.dataset.id);
    if (k === 'ArrowUp' || k === 'ArrowDown') {
      e.preventDefault();
      const v = Math.max(0, Math.min(10, s.napeti + (k === 'ArrowUp' ? 1 : -1)));
      if (v !== s.napeti) { fokusPo = { typ: 'bod', id: s.id }; zmena(() => { s.napeti = v; }); hlas('Napětí ' + v); }
    } else if (k === 'Enter') { e.preventDefault(); otevriEditor(s.id); }
    return;
  }
  if (hlava) {
    const id = hlava.closest('.sloupec').dataset.id, i = p.sloupce.findIndex(c => c.id === id);
    if (e.altKey && (k === 'ArrowLeft' || k === 'ArrowRight')) {
      e.preventDefault();
      const j = i + (k === 'ArrowLeft' ? -1 : 1);
      if (j >= 0 && j < p.sloupce.length) { fokusPo = { typ: 'sloupec', id }; zmena(() => J.presunSloupec(p, id, j)); hlas('Sloupec na pozici ' + (j + 1)); }
    } else if (k === 'Enter' || k === 'F2') { e.preventDefault(); prejmenujSloupec(id); }
    else if (k === 'ArrowDown') { e.preventDefault(); const c = hlava.closest('.sloupec').querySelector('.karta'); if (c) c.focus(); }
    else if (k === 'ArrowLeft' || k === 'ArrowRight') {
      e.preventDefault();
      const sl = plocha.querySelectorAll('.sl-hlava')[i + (k === 'ArrowLeft' ? -1 : 1)]; if (sl) sl.focus();
    }
    return;
  }
  if (!karta) return;
  const id = karta.dataset.id;
  if (k === 'Enter') { e.preventDefault(); return otevriEditor(id); }
  if (k === 'Delete') { e.preventDefault(); return smazScenu(id); }
  const smery = { ArrowUp: 'nahoru', ArrowDown: 'dolu', ArrowLeft: 'vlevo', ArrowRight: 'vpravo' };
  if (!smery[k]) return;
  e.preventDefault();
  if (e.altKey) {
    if (nast.pohled !== 'nastenka' && nast.pohled !== 'osnova') return;
    if (nast.pohled === 'osnova' && (k === 'ArrowLeft' || k === 'ArrowRight')) return;
    fokusPo = { typ: 'karta', id };
    if (zmena(() => J.posunScenu(p, id, smery[k]))) {
      const s = J.najdi(p, id), c = p.sloupce.find(x => x.id === s.sloupec);
      hlas(`Scéna přesunuta: ${c.nazev}, pozice ${J.scenySloupce(p, c.id).indexOf(s) + 1}`);
    }
    return;
  }
  // pohyb fokusu
  if (nast.pohled === 'nastenka') {
    const sl = karta.closest('.sloupec'), ve = [...sl.querySelectorAll('.karta')], i = ve.indexOf(karta);
    if (k === 'ArrowUp') (ve[i - 1] || sl.querySelector('.sl-hlava')).focus();
    else if (k === 'ArrowDown') { if (ve[i + 1]) ve[i + 1].focus(); }
    else {
      let s2 = k === 'ArrowLeft' ? sl.previousElementSibling : sl.nextElementSibling;
      while (s2 && s2.classList.contains('sloupec') && !s2.querySelector('.karta')) s2 = k === 'ArrowLeft' ? s2.previousElementSibling : s2.nextElementSibling;
      if (s2 && s2.classList.contains('sloupec')) { const kk = s2.querySelectorAll('.karta'); kk[Math.min(i, kk.length - 1)].focus(); }
    }
  } else {
    const vse = [...plocha.querySelectorAll('.karta[data-id], tr[data-id]')], i = vse.indexOf(karta);
    const j = (k === 'ArrowUp' || k === 'ArrowLeft') ? i - 1 : i + 1;
    if (vse[j]) { vse[j].focus(); vse[j].scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
  }
});

// graf: tažení bodu, bublina
plocha.addEventListener('pointerover', e => { const b = e.target.closest('.bod, .zasah'); if (b && !grafTah) ukazBublinu(b.dataset.id, plocha.querySelector(`.bod[data-id="${b.dataset.id}"]`)); });
plocha.addEventListener('pointerout', e => { if (e.target.closest('.bod, .zasah') && $('bublina') && !grafTah) $('bublina').hidden = true; });
plocha.addEventListener('focusin', e => { if (e.target.classList && e.target.classList.contains('bod')) ukazBublinu(e.target.dataset.id, e.target); });
let grafTah = null;
plocha.addEventListener('pointerdown', e => {
  const b = e.target.closest('.bod, .zasah');
  if (!b || e.button !== 0) return;
  e.preventDefault();
  grafTah = { id: b.dataset.id, snimek: JSON.stringify(p), y0: e.clientY, pohnul: false };
  $('grafPlocha').setPointerCapture(e.pointerId);
});
plocha.addEventListener('pointermove', e => {
  if (!grafTah) return;
  if (Math.abs(e.clientY - grafTah.y0) > 3) grafTah.pohnul = true;
  if (!grafTah.pohnul) return;
  const svg = plocha.querySelector('svg.graf'); if (!svg) return;
  const r = svg.getBoundingClientRect();
  const v = Math.max(0, Math.min(10, Math.round(10 - (e.clientY - r.top - GRAF.T) / (GRAF.H - GRAF.T - GRAF.B) * 10)));
  const s = J.najdi(p, grafTah.id);
  if (s && s.napeti !== v) {
    s.napeti = v;
    const sl = $('grafPlocha').scrollLeft;
    kresliGraf(); $('grafPlocha').scrollLeft = sl;
    ukazBublinu(s.id, plocha.querySelector(`.bod[data-id="${s.id}"]`));
  }
});
plocha.addEventListener('pointerup', () => {
  if (!grafTah) return;
  const t = grafTah; grafTah = null;
  if (!t.pohnul) return otevriEditor(t.id);
  if (t.snimek !== JSON.stringify(p)) {
    hist.zapis(JSON.parse(t.snimek)); naplanujUlozeni(); prave = true; setTimeout(() => { prave = false; }, 0);
    fokusPo = { typ: 'bod', id: t.id }; vykresli();
  }
});
plocha.addEventListener('pointercancel', () => {
  if (!grafTah) return;
  const t = grafTah; grafTah = null;
  if (t.snimek !== JSON.stringify(p)) vratStav(JSON.parse(t.snimek));
});
addEventListener('resize', () => { if (nast.pohled === 'napeti') kresliGraf(); });

// ---------- nabídky lišty ----------
function zavriNabidky() {
  document.querySelectorAll('.nabidka:not([hidden])').forEach(n => { n.hidden = true; });
  document.querySelectorAll('[data-nabidka][aria-expanded="true"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
}
function otevriNabidku(n, b) {
  const bylo = !n.hidden;
  zavriNabidky();
  if (bylo) return;
  n.hidden = false; b.setAttribute('aria-expanded', 'true');
  const r = b.getBoundingClientRect();
  n.style.top = (r.bottom + 4) + 'px';
  n.style.left = Math.max(6, Math.min(r.left, innerWidth - n.offsetWidth - 6)) + 'px';
  const prvni = n.querySelector('button:not(:disabled)'); if (prvni) prvni.focus({ preventScroll: true });
}
document.querySelectorAll('[data-nabidka]').forEach(b => b.addEventListener('click', e => {
  e.stopPropagation();
  if (b.dataset.nabidka === 'nabProjekt') naplnNabidkuProjektu();
  otevriNabidku($(b.dataset.nabidka), b);
}));
function naplnNabidkuProjektu() {
  $('seznamProjektu').innerHTML = projekty.map(x => `<button class="tl${x === p ? ' aktivni' : ''}" data-projekt="${x.id}">📚 ${esc(x.nazev)}<span class="pocet-sc">${x.sceny.length} scén</span></button>`).join('');
}
$('seznamProjektu').addEventListener('click', e => {
  const b = e.target.closest('[data-projekt]'); if (!b) return;
  zavriNabidky();
  const x = projekty.find(q => q.id === b.dataset.projekt);
  if (x && x !== p) prepniProjekt(x);
});
document.addEventListener('click', e => {
  const b = e.target.closest('[data-prikaz]');
  if (b && !b.disabled) { e.stopPropagation(); zavriNabidky(); return prikaz(b.dataset.prikaz); }
  const v = e.target.closest('[data-pohled]');
  if (v) { nast.pohled = v.dataset.pohled; ulozNast(); return vykresli(); }
  const ob = e.target.closest('[data-obarvit]');
  if (ob) { nast.obarvit = ob.dataset.obarvit; ulozNast(); zavriNabidky(); return vykresli(); }
  const ve = e.target.closest('[data-velikost]');
  if (ve) { nast.velikost = ve.dataset.velikost; ulozNast(); zavriNabidky(); return vykresli(); }
  if (!e.target.closest('.nabidka')) zavriNabidky();
  const z = e.target.closest('[data-zavri]'); if (z) zavriModal(z.dataset.zavri);
});
addEventListener('resize', zavriNabidky);

const PRIKAZY = {
  novaScena: () => novaScena(), novySloupec: () => novySloupec(), zpet, vpred,
  novyProjekt, prejmenovatProjekt: prejmenujProjekt, duplikovatProjekt: duplikujProjekt, smazatProjekt: smazProjekt,
  sablona: () => otevriModal('sabBg'), ukazka,
  importMd: () => otevriMd('import'), rukopis: () => otevriMd('slova'), prepocitat,
  exportMd: () => stahni(J.exportMarkdown(p), nazevSouboru() + '.md', 'text/markdown'),
  kopirovatMd: () => navigator.clipboard.writeText(J.exportMarkdown(p)).then(() => Dialog.info('Kostra rukopisu zkopírována.'), () => Dialog.chyba('Schránka není dostupná.')),
  zalohaProjekt: () => stahni(JSON.stringify(J.zaloha([p]), null, 1), nazevSouboru() + '.nastenka.json', 'application/json'),
  zalohaVse: () => { if (p) dbUloz(p); stahni(JSON.stringify(J.zaloha(projekty), null, 1), 'nastenka_scen_zaloha_' + new Date().toISOString().slice(0, 10) + '.json', 'application/json'); },
  importJson: () => $('jsonSoubor').click(),
  tisk: () => { zavriNabidky(); setTimeout(() => print(), 50); },
  vynulovatSlova: async () => { if (await Dialog.potvrd('Vynulovat skutečný počet slov u všech scén projektu?', { ok: 'Vynulovat', zrus: 'Zrušit' })) zmena(() => p.sceny.forEach(s => { s.slov = 0; })); },
  kompakt: () => { nast.kompakt = !nast.kompakt; ulozNast(); vykresli(); },
  kontrola: () => otevriKontrolu(), verze: () => otevriVerze(),
  cisla: () => { nast.cisla = !nast.cisla; ulozNast(); vykresli(); },
  grafSlova: () => { nast.grafSlova = !nast.grafSlova; ulozNast(); vykresli(); },
  vycistitFiltr: () => vycistiFiltr(),
  napoveda: () => otevriModal('napovedaBg')
};
function prikaz(id) { const f = PRIKAZY[id]; if (f) f(); }

function nazevSouboru() { return (p.nazev || 'nastenka').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/^_|_$/g, '') || 'nastenka'; }
function stahni(text, jmeno, typ) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: typ + ';charset=utf-8' }));
  a.download = jmeno; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ---------- filtr: ovládání ----------
$('hledat').addEventListener('input', e => { filtr.text = e.target.value; vykresliPozdeji(); });
$('fPostava').addEventListener('change', e => { filtr.postava = e.target.value; vykresli(); });
$('fStitek').addEventListener('change', e => { filtr.stitek = e.target.value; vykresli(); });
$('fStav').addEventListener('change', e => { filtr.stav = e.target.value; vykresli(); });

// ---------- modální okna ----------
function otevriModal(id) { zavriNabidky(); $(id).classList.add('zobraz'); const f = $(id).querySelector('button, input, textarea'); if (f) setTimeout(() => f.focus(), 30); }
function zavriModal(id) { $(id).classList.remove('zobraz'); }
document.querySelectorAll('.modal-bg').forEach(m => m.addEventListener('click', e => { if (e.target === m) zavriModal(m.id); }));

// šablony
$('sabSeznam').innerHTML = Object.entries(J.SABLONY).map(([k, s]) => {
  const n = s.sloupce.reduce((a, c) => a + c[1].length, 0);
  return `<button class="btn" data-sab="${k}"><b>${esc(s.nazev)}</b><small>${s.sloupce.map(c => esc(c[0])).join(' · ')}</small><small>${n} beatů</small></button>`;
}).join('');
$('sabSeznam').addEventListener('click', async e => {
  const b = e.target.closest('[data-sab]'); if (!b) return;
  zavriModal('sabBg');
  const sab = J.SABLONY[b.dataset.sab];
  if (!p.sceny.length) {
    zmena(() => { p.sloupce = []; J.pouzijSablonu(p, b.dataset.sab); });
  } else {
    const n = await Dialog.zeptej('Název nového projektu', 'Nový román – ' + sab.nazev, { ok: 'Vytvořit' });
    if (n == null) return;
    pridejProjekt(J.pouzijSablonu(J.novyProjekt(n.trim() || sab.nazev), b.dataset.sab));
  }
  nast.pohled = 'nastenka'; ulozNast(); vykresli();
  Dialog.info(`Šablona „${sab.nazev}“ vložena.`);
});
$('sabZavrit').onclick = () => zavriModal('sabBg');

// ---------- Markdown: import osnovy / počítání slov z rukopisu ----------
let mdRezim = 'import';
function otevriMd(rezim) {
  mdRezim = rezim;
  $('mdTitul').textContent = rezim === 'import' ? '📥 Import osnovy z Markdownu' : '📖 Načíst rukopis a spočítat slova';
  $('mdPopis').innerHTML = rezim === 'import'
    ? 'Vytvoří <b>nový projekt</b>: nadpisy <code>#</code> budou sloupce, <code>##</code> a předěly <code>*</code> scény. Kostra exportovaná z nástěnky obnoví i údaje kartiček.'
    : `Spočítá skutečná slova scén projektu „<span data-i18n="ne">${esc(p.nazev)}</span>“ podle nadpisů rukopisu. Ostatní údaje kartiček se nemění; jde to vrátit přes Zpět.`;
  $('mdVysledek').hidden = true;
  otevriModal('mdBg');
}
$('mdZalozky').addEventListener('click', e => {
  const b = e.target.closest('[data-zal]'); if (!b) return;
  $('mdZalozky').querySelectorAll('[data-zal]').forEach(x => x.setAttribute('aria-pressed', x === b));
  document.querySelectorAll('[data-zal-obsah]').forEach(o => { o.hidden = o.dataset.zalObsah !== b.dataset.zal; });
  if (b.dataset.zal === 'moje') nactiMojeKnihy();
  if (b.dataset.zal === 'kroniky') nactiKroniky();
});
$('mdZavrit').onclick = () => zavriModal('mdBg');
$('mdSoubor').addEventListener('change', async e => {
  const soubory = [...e.target.files].sort((a, b) => a.name.localeCompare(b.name, 'cs', { numeric: true }));
  if (!soubory.length) return;
  const texty = await Promise.all(soubory.map(f => f.text()));
  e.target.value = '';
  pouzijMd(texty.join('\n\n'), soubory.length === 1 ? soubory[0].name.replace(/\.\w+$/, '') : 'Import', null);
});
$('mdTextOk').onclick = () => { const t = $('mdText').value; if (t.trim()) pouzijMd(t, 'Importovaná osnova', null); };

async function nactiJson(url) { const r = await fetch(url, { cache: 'no-cache' }); if (!r.ok) throw new Error(r.status + ' ' + url); return r.json(); }
async function nactiText(url) { const r = await fetch(url, { cache: 'no-cache' }); if (!r.ok) throw new Error(r.status + ' ' + url); return r.text(); }

async function nactiMojeKnihy() {
  const el = $('mdMoje');
  el.innerHTML = '<p class="napoveda-txt">Načítám…</p>';
  try {
    const s = await nactiJson('../moje_knihy/seznam.json');
    el.innerHTML = (s.knihy || []).map(k => `<button class="btn" data-moje="${esc(k.id)}">${esc(k.nazev)}<small>${k.slov ? cis(k.slov) + ' slov' : ''}</small></button>`).join('') || '<p class="napoveda-txt">Složka Moje knihy je prázdná.</p>';
    el.onclick = e => { const b = e.target.closest('[data-moje]'); if (b) zdrojMoje(s.knihy.find(k => k.id === b.dataset.moje)); };
  } catch (err) { el.innerHTML = '<p class="napoveda-txt">Složka <code>moje_knihy/</code> není dostupná (na webu ji mívá jen autor).</p>'; }
}
async function textMoje(k) { return (await Promise.all(k.soubory.map(f => nactiText('../moje_knihy/' + f)))).join('\n\n'); }
async function zdrojMoje(k) {
  try { pouzijMd(await textMoje(k), k.nazev, { typ: 'moje', id: k.id, nazev: k.nazev }); }
  catch (e) { Dialog.chyba('Knihu se nepodařilo načíst: ' + e.message); }
}

async function nactiKroniky() {
  const el = $('mdKroniky');
  el.innerHTML = '<p class="napoveda-txt">Načítám…</p>';
  try {
    const dila = await nactiJson('knihy/dila.json');
    const polozky = [];
    for (const d of dila) {
      try { (await nactiJson(d.data + 'knihy.json')).forEach(k => polozky.push({ d, k })); } catch (e) { /* dílo bez knih */ }
    }
    el.innerHTML = polozky.map((x, i) => `<button class="btn" data-kr="${i}">${esc(x.d.nazev)} › ${esc(x.k.nazev)}<small>${x.k.kapitoly.length} kapitol · ${cis(x.k.kapitoly.reduce((a, c) => a + (c.slov || 0), 0))} slov</small></button>`).join('') || '<p class="napoveda-txt">Žádné knihy.</p>';
    el.onclick = e => { const b = e.target.closest('[data-kr]'); if (b) { const x = polozky[b.dataset.kr]; zdrojKroniky(x.d, x.k); } };
  } catch (err) { el.innerHTML = '<p class="napoveda-txt">Kroniky se nepodařilo načíst.</p>'; }
}
async function textKroniky(data, kniha) {
  const knihy = await nactiJson(data + 'knihy.json');
  const k = knihy.find(x => x.id === kniha);
  if (!k) throw new Error('kniha nenalezena');
  return (await Promise.all(k.kapitoly.map(c => nactiText(data + k.id + '/' + c.soubor)))).join('\n\n');
}
async function zdrojKroniky(d, k) {
  try { pouzijMd(await textKroniky(d.data, k.id), k.nazev, { typ: 'kroniky', data: d.data, kniha: k.id, nazev: d.nazev + ' › ' + k.nazev }); }
  catch (e) { Dialog.chyba('Knihu se nepodařilo načíst: ' + e.message); }
}

function pouzijMd(text, nazev, zdroj) {
  if (mdRezim === 'import') {
    const nove = J.importMarkdown(text, nazev);
    if (!nove.sceny.length) return Dialog.chyba('V textu nejsou žádné scény (nadpisy # / ## ani text).');
    if (zdroj) nove.rukopis = zdroj;
    zavriModal('mdBg');
    pridejProjekt(nove);
    nast.pohled = 'nastenka'; ulozNast(); vykresli();
    Dialog.info(`Importováno ${nove.sloupce.length} sloupců a ${nove.sceny.length} scén.`);
    return;
  }
  spocitej(text, zdroj);
}
function spocitej(text, zdroj) {
  let v;
  zmena(() => { v = J.spocitejRukopis(p, text); if (zdroj) p.rukopis = zdroj; });
  const sez = (pole, max) => pole.slice(0, max).map(x => `<li data-i18n="ne">${esc(x)}</li>`).join('') + (pole.length > max ? `<li>… a dalších ${pole.length - max}</li>` : '');
  $('mdVysledek').hidden = false;
  $('mdVysledek').innerHTML = `<b>Spárováno ${v.sparovano} z ${p.sceny.length} scén, celkem ${cis(v.slov)} slov.</b>
    ${v.nesparovaneSceny.length ? `<div style="margin-top:6px"><span>Scény bez textu v rukopisu (${v.nesparovaneSceny.length}):</span><ul>${sez(v.nesparovaneSceny, 30)}</ul></div>` : ''}
    ${v.nesparovanyText.length ? `<div style="margin-top:6px"><span>Text rukopisu bez kartičky (${v.nesparovanyText.length}):</span><ul>${sez(v.nesparovanyText, 30)}</ul></div>` : ''}`;
  if (!$('mdBg').classList.contains('zobraz')) Dialog.info(`Spárováno ${v.sparovano} z ${p.sceny.length} scén, ${cis(v.slov)} slov.`);
}
async function prepocitat() {
  const z = p.rukopis; if (!z) return;
  try {
    const text = z.typ === 'moje' ? await textMoje((await nactiJson('../moje_knihy/seznam.json')).knihy.find(k => k.id === z.id)) : await textKroniky(z.data, z.kniha);
    spocitej(text, z);
  } catch (e) { Dialog.chyba('Zdroj „' + (z.nazev || '') + '“ se nepodařilo načíst: ' + e.message); }
}

// ---------- kontrola osnovy ----------
let kontrolaVysledek = [];
function otevriKontrolu() {
  kontrolaVysledek = J.kontrola(p);
  $('kontrolaSeznam').innerHTML = kontrolaVysledek.length ? kontrolaVysledek.map((x, i) => `<div class="kontrola-pol ${x.uroven}">
      <span class="ikona">${x.uroven === 'pozor' ? '⚠️' : 'ℹ️'}</span><span class="txt-k">${esc(x.text)}</span>
      ${x.sceny.length ? `<button class="btn mini" data-kontrola="${i}">Ukázat (${x.sceny.length})</button>` : ''}</div>`).join('')
    : '<p class="kontrola-ok">✅ Osnova je v pořádku – kontrola nic nenašla.</p>';
  otevriModal('kontrolaBg');
}
$('kontrolaSeznam').addEventListener('click', e => {
  const b = e.target.closest('[data-kontrola]'); if (!b) return;
  const x = kontrolaVysledek[b.dataset.kontrola];
  zavriModal('kontrolaBg');
  vycistiFiltr(true);
  filtr.ids = x.sceny; filtr.popis = x.text;
  if (nast.pohled !== 'nastenka' && nast.pohled !== 'osnova') { nast.pohled = 'nastenka'; ulozNast(); }
  vykresli();
  const el = plocha.querySelector(`.karta[data-id="${x.sceny[0]}"], tr[data-id="${x.sceny[0]}"]`);
  if (el) { el.scrollIntoView({ block: 'nearest', inline: 'center' }); el.focus({ preventScroll: true }); }
});

// ---------- verze projektu (snímky v IndexedDB) ----------
async function otevriVerze() {
  $('verzeNazev').value = '';
  await vykresliVerze();
  otevriModal('verzeBg');
}
async function vykresliVerze() {
  let vse = [];
  try { vse = (await verzeVse()).filter(v => v.projekt === p.id).sort((a, b) => b.cas.localeCompare(a.cas)); } catch (e) { /* bez IndexedDB */ }
  $('verzeSeznam').innerHTML = vse.length ? vse.map(v => `<div class="verze-pol">
      <div><b data-i18n="ne">${esc(v.nazev)}</b><small>${new Date(v.cas).toLocaleString('cs-CZ')} · ${v.data.sceny.length} scén · ${cis(v.data.sceny.reduce((a, s) => a + (s.slov || 0), 0))} slov</small></div>
      <button class="btn mini" data-verze-obnov="${v.id}">↩ Obnovit</button><button class="btn mini danger" data-verze-smaz="${v.id}" aria-label="Smazat verzi">🗑</button></div>`).join('')
    : '<p class="napoveda-txt">Zatím žádná uložená verze.</p>';
}
$('verzeUlozit').onclick = async () => {
  const nazev = $('verzeNazev').value.trim() || 'Verze ' + new Date().toLocaleString('cs-CZ');
  try { await verzeUloz({ id: J.noveId('v'), projekt: p.id, nazev, cas: new Date().toISOString(), data: JSON.parse(JSON.stringify(p)) }); }
  catch (e) { return Dialog.chyba('Verzi se nepodařilo uložit: ' + e.message); }
  $('verzeNazev').value = '';
  await vykresliVerze();
  Dialog.info('Verze uložena.');
};
$('verzeSeznam').addEventListener('click', async e => {
  const ob = e.target.closest('[data-verze-obnov]'), sm = e.target.closest('[data-verze-smaz]');
  if (!ob && !sm) return;
  const v = (await verzeVse()).find(x => x.id === (ob || sm).dataset[ob ? 'verzeObnov' : 'verzeSmaz']);
  if (!v) return;
  if (sm) {
    if (!await Dialog.potvrd(`Smazat verzi „${v.nazev}“?`, { ok: 'Smazat', zrus: 'Ponechat' })) return;
    await verzeSmaz(v.id); return vykresliVerze();
  }
  if (!await Dialog.potvrd(`Obnovit projekt do stavu verze „${v.nazev}“? Současný stav jde vrátit přes Zpět.`, { ok: 'Obnovit', zrus: 'Zrušit' })) return;
  const data = J.normalizujProjekt(JSON.parse(JSON.stringify(v.data)));
  zavriModal('verzeBg');
  if (otevrena) zavriEditor();
  zmena(() => { const id = p.id; Object.keys(p).forEach(k => delete p[k]); Object.assign(p, data, { id }); });
  Dialog.info('Verze obnovena.');
});

// ---------- import JSON ----------
$('jsonSoubor').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  let nove;
  try { nove = J.nactiZalohu(await f.text()); } catch (err) { return Dialog.chyba(err.message); }
  let posledni = null;
  for (const x of nove) {
    const stary = projekty.find(q => q.id === x.id);
    if (stary) {
      const prepsat = await Dialog.potvrd(`Projekt „${x.nazev}“ už existuje. Přepsat ho zálohou, nebo načíst jako kopii?`, { ok: 'Přepsat', zrus: 'Jako kopii' });
      if (prepsat) { Object.keys(stary).forEach(k => delete stary[k]); Object.assign(stary, x); dbUloz(stary); posledni = stary; if (stary === p) hist.vymaz(); continue; }
      x.id = J.noveId('p'); x.nazev += ' (kopie)';
    }
    projekty.unshift(x); dbUloz(x); posledni = x;
  }
  if (posledni) prepniProjekt(posledni);
  Dialog.info(`Načteno projektů: ${nove.length}.`);
});

// ---------- klávesové zkratky ----------
document.addEventListener('keydown', e => {
  if (document.querySelector('dialog[open]')) return;       // otevřený Dialog.potvrd/zeptej má Escape pro sebe
  const k = e.key, ctrl = e.ctrlKey || e.metaKey;
  const pise = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
  if (k === 'Escape') {
    if (document.querySelector('.nabidka:not([hidden])')) return zavriNabidky();
    const m = document.querySelector('.modal-bg.zobraz'); if (m) return zavriModal(m.id);
    if (otevrena) return zavriEditor();
    if (aktivniFiltr()) { vycistiFiltr(); if (pise) e.target.blur(); }
    return;
  }
  if (ctrl && !e.altKey) {
    const kk = k.toLowerCase();
    if (kk === 'z' && !e.shiftKey && !pise) { e.preventDefault(); return zpet(); }
    if ((kk === 'y' || (kk === 'z' && e.shiftKey)) && !pise) { e.preventDefault(); return vpred(); }
    if (kk === 'f') { e.preventDefault(); return $('hledat').focus(); }
    if (kk === 's') { e.preventDefault(); return prikaz('zalohaProjekt'); }
    if (kk === 'o') { e.preventDefault(); return prikaz('importMd'); }
    if (kk === 'p') { e.preventDefault(); return prikaz('tisk'); }
    return;
  }
  if (pise || e.altKey || document.querySelector('.modal-bg.zobraz') || otevrena) return;
  if (k === '/') { e.preventDefault(); $('hledat').focus(); }
  else if (k === 'F1') { e.preventDefault(); prikaz('napoveda'); }
  else if (k === 'k' || k === 'K') { e.preventDefault(); otevriKontrolu(); }
  else if (k === 'n' || k === 'N') { e.preventDefault(); e.shiftKey ? novySloupec() : novaScena(); }
  else if ('12345'.includes(k) && k.length === 1) { nast.pohled = ['nastenka', 'osnova', 'osa', 'postavy', 'napeti'][+k - 1]; ulozNast(); vykresli(); }
});

// ---------- start ----------
if (window.self === window.top) document.body.classList.add('samostatne');
nactiProjekty().then(() => { vykresli(); window.NastenkaApp = { get p() { return p; }, vykresli, otevriEditor, zavriEditor, hist, nast, prikaz, filtr, ukazka, spocitej, otevriMd, pouzijMd }; });
})();

/* ============================================================
   Hromadný tisk štítků – rozhraní stránky
   Stav projektu P (arch, data, návrh) se průběžně ukládá do
   IndexedDB (záznam „_aktualni“); předvolby (kalibrace, moje
   archy, karta) do localStorage webapp_stitky_hromadne_predvolby.
   ============================================================ */
(function () {
'use strict';
const S = window.STITKY, V = window.STITKY_VYKRES;
const $ = id => document.getElementById(id);
const KLIC_PRED = 'webapp_stitky_hromadne_predvolby';
const DB_JMENO = 'webapp_stitky_hromadne';
const MAX_RADKU_MRIZKY = 1000, MAX_ARCHU_NAHLEDU = 12;
const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const cs = (x, d = 2) => String(Math.round(x * 10 ** d) / 10 ** d).replace('.', ',');

/* ---------- předvolby ---------- */
let pred = { kalibrace: { dx: 0, dy: 0 }, mojeArchy: [], karta: 'arch', obrysy: false };
try { Object.assign(pred, JSON.parse(localStorage.getItem(KLIC_PRED)) || {}); } catch (e) { /* bez předvoleb */ }
const ulozPred = () => { try { localStorage.setItem(KLIC_PRED, JSON.stringify(pred)); } catch (e) { /* plné úložiště */ } };

/* ---------- IndexedDB ---------- */
let dbSlib = null;
function db() {
  if (!dbSlib) dbSlib = new Promise((ok, ko) => {
    const r = indexedDB.open(DB_JMENO, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('projekty', { keyPath: 'id' });
    r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error);
  });
  return dbSlib;
}
async function dbOp(rezim, fn) {
  const d = await db();
  return new Promise((ok, ko) => {
    const tx = d.transaction('projekty', rezim), st = tx.objectStore('projekty');
    const r = fn(st);
    tx.oncomplete = () => ok(r && r.result); tx.onerror = () => ko(tx.error);
  });
}
const dbUloz = zaz => dbOp('readwrite', st => st.put(zaz));
const dbNacti = id => dbOp('readonly', st => st.get(id));
const dbVse = () => dbOp('readonly', st => st.getAll());
const dbSmaz = id => dbOp('readwrite', st => st.delete(id));

/* ---------- projekt ---------- */
function prazdnyProjekt() {
  return {
    verze: 1, id: null, nazev: 'Bez názvu',
    arch: { ...S.ARCHY.find(a => a.id === 'z3474') },
    data: { rezim: 'tabulka', hlavicka: ['jmeno', 'ulice', 'psc', 'mesto'], radky: [['', '', '', '']], kopie: 1, start: 1, vyber: '', datum: '',
      cislovani: { od: 1, krok: 1, pocet: 24, nuly: 4, predpona: '', pripona: '' } },
    navrh: { odsazeni: 3, ramecek: { tl: 0, zaobleni: 0, odsazeni: 0, barva: '#000000' }, prvky: [
      { typ: 'text', x: 0, y: 0, w: 100, h: 100, text: '{jmeno}\n{ulice}\n{psc} {mesto}', velikost: 11, min: 6, zar: 'L', svisle: 'M', prvniTucne: true, radkovani: 1.2 }] },
  };
}
function zPredlohy(klic) {
  const pr = S.PREDLOHY[klic], p = prazdnyProjekt();
  p.nazev = pr.nazev.replace(/^\S+\s/, '');
  p.arch = { ...S.ARCHY.find(a => a.id === pr.arch) };
  p.navrh = JSON.parse(JSON.stringify(pr.navrh));
  p.navrh.ramecek = Object.assign({ tl: 0, zaobleni: 0, odsazeni: 0, barva: '#000000' }, p.navrh.ramecek);
  Object.assign(p.data, JSON.parse(JSON.stringify(pr.data)));
  p.data.cislovani = Object.assign(prazdnyProjekt().data.cislovani, pr.data.cislovani || {});
  return p;
}
let P = prazdnyProjekt();
let vybrany = 0, nahledZaz = 0, ulozeniCasovac = null;

function zmena(co) {
  clearTimeout(ulozeniCasovac);
  ulozeniCasovac = setTimeout(() => dbUloz({ id: '_aktualni', projekt: P, cas: Date.now() }).catch(() => {}), 500);
  planujVykres(co);
}

/* ---------- písmo a měření ---------- */
const platno = document.createElement('canvas').getContext('2d');
const mira = new Map();
let pismoNacteno = false;
function mer(text, s, tucne) {
  const k = (tucne ? 'b' : 'n') + text;
  let w = mira.get(k);
  if (w == null) {
    platno.font = `${tucne ? 'bold ' : ''}100px ${V.PISMO}, 'Liberation Sans', Arial, sans-serif`;
    w = platno.measureText(text).width / 100;
    if (mira.size > 20000) mira.clear();
    mira.set(k, w);
  }
  return w * s;
}
async function nactiPisma() {
  try {
    const f = [new FontFace(V.PISMO, 'url(lib/pdflib/LiberationSans-Regular.ttf)', { weight: 'normal' }),
      new FontFace(V.PISMO, 'url(fonty/LiberationSans-Bold.ttf)', { weight: 'bold' })];
    for (const x of f) { await x.load(); document.fonts.add(x); }
    pismoNacteno = true;
  } catch (e) { console.warn('Písmo Liberation Sans se nenačetlo, měří se náhradním.', e); }
  mira.clear();
}
let pdfPisma = null;
async function pismaProPdf() {
  if (pdfPisma) return pdfPisma;
  const b64 = async url => {
    const buf = new Uint8Array(await (await fetch(url)).arrayBuffer());
    let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return btoa(s);
  };
  try { pdfPisma = { r: await b64('lib/pdflib/LiberationSans-Regular.ttf'), b: await b64('fonty/LiberationSans-Bold.ttf') }; }
  catch (e) { pdfPisma = null; }
  return pdfPisma;
}

/* ---------- QR ---------- */
qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
const qrCache = new Map();
function qr(text, ec) {
  const k = ec + '|' + text;
  if (qrCache.has(k)) return qrCache.get(k);
  let v = null;
  try {
    const q = qrcode(0, ec); q.addData(text, 'Byte'); q.make();
    const n = q.getModuleCount(), m = [];
    for (let r = 0; r < n; r++) { const rr = []; for (let c = 0; c < n; c++) rr.push(q.isDark(r, c)); m.push(rr); }
    v = { n, tmavy: (r, c) => m[r][c] };
  } catch (e) { v = null; }
  if (qrCache.size > 3000) qrCache.clear();
  qrCache.set(k, v);
  return v;
}
const nastroje = { mer, qr };

/* ---------- záznamy a výpočet rozložení ---------- */
function datumPole() { return P.data.datum.trim() || S.datumCs(new Date()); }
function zaznamy() {
  const d = P.data, c = d.cislovani, datum = datumPole();
  if (d.rezim === 'cislovani') {
    return S.cislovani(c).map((cis, i) => ({ cislo: cis, poradi: String(i + 1), datum }));
  }
  const cisla = S.cislovani({ ...c, pocet: d.radky.length });
  return d.radky.map((r, i) => Object.assign({ poradi: String(i + 1), cislo: cisla[i], datum }, S.zaznamMapa(d.hlavicka, r)));
}
let posledni = null;   // { zaz, archy, vyber, primCache }
function rozlozeni() {
  const zaz = zaznamy(), d = P.data;
  const vyb = S.vyberZaznamu(d.vyber, zaz.length);
  const archy = S.zkontrolujArch(P.arch).chyby.length ? [] : S.rozdelNaArchy(zaz.length, d.kopie, d.start, S.naArch(P.arch), vyb.indexy);
  posledni = { zaz, archy, vyb, prim: new Map(), varovani: new Map() };
  return posledni;
}
function primZaznamu(i) {
  const L = posledni;
  if (!L.prim.has(i)) {
    const st = S.sestavStitek(P.navrh, L.zaz[i], P.arch.w, P.arch.h, nastroje);
    L.prim.set(i, st.prim);
    if (st.varovani.length) L.varovani.set(i, st.varovani);
  }
  return L.prim.get(i);
}
function vsechnaVarovani() { // sestaví všechny použité štítky, aby se ukázala všechna varování
  const L = posledni, pouzite = new Set();
  for (const a of L.archy) for (const it of a) pouzite.add(it.zaznam);
  for (const i of pouzite) primZaznamu(i);
  return L.varovani;
}

/* ---------- překreslování ---------- */
let vykresCasovac = null, vykresCo = new Set();
function planujVykres(co = 'vse') {
  vykresCo.add(co);
  clearTimeout(vykresCasovac);
  vykresCasovac = setTimeout(() => { const c = vykresCo; vykresCo = new Set(); vykresli(c); }, 60);
}
function vykresli(co) {
  const vse = co.has('vse');
  rozlozeni();
  if (vse || co.has('arch')) vykresliArch();
  if (vse || co.has('dataForm')) naplnData();
  if (vse || co.has('tabulka')) vykresliTabulku();
  if (vse || co.has('navrhForm')) { naplnNavrh(); vykresliPrvky(); vykresliVlastnosti(); }
  vykresliCipy();
  vykresliCislovaniUkazku();
  vykresliEditor();
  vykresliNahled();
  vykresliSouhrn();
  $('nazevProjektu').textContent = P.nazev + (P.id ? '' : ' (neuloženo)');
}

function vykresliSouhrn() {
  const L = posledni, stitku = L.archy.reduce((s, a) => s + a.length, 0);
  const vr = vsechnaVarovani().size;
  $('souhrn').innerHTML = `${cs(P.arch.w, 1)} × ${cs(P.arch.h, 1)} mm · <b>${L.zaz.length}</b> záznamů · <b>${stitku}</b> štítků · <b>${L.archy.length}</b> ${L.archy.length === 1 ? 'arch' : L.archy.length >= 2 && L.archy.length <= 4 ? 'archy' : 'archů'}` +
    (vr ? ` · <span class="var" data-karta-skok="nahled">⚠ ${vr} se varováním</span>` : '');
}

/* ---------- ① ARCH ---------- */
const ARCH_POLE = { aW: 'w', aH: 'h', aSl: 'sl', aRa: 'ra', aOkL: 'okL', aOkH: 'okH', aMezX: 'mezX', aMezY: 'mezY', aZaobleni: 'zaobleni', aPapirW: 'papirW', aPapirH: 'papirH' };
function vsechnyArchy() { return [...pred.mojeArchy, ...S.ARCHY]; }
function naplnVyberArchu() {
  const q = $('archHledat').value.trim().toLowerCase().replace(',', '.');
  const m = q.match(/^(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)$/);
  const filtr = a => !q || (m ? Math.abs(a.w - m[1]) <= 0.6 && Math.abs(a.h - m[2]) <= 0.6 : (S.nazevArchu(a) + ' ' + (a.nazev || '')).toLowerCase().replace(/,/g, '.').includes(q));
  const skup = {};
  for (const a of vsechnyArchy().filter(filtr)) (skup[a.mujArch ? 'Moje archy' : a.vyrobce] ||= []).push(a);
  let h = '<option value="">— vlastní rozměry —</option>';
  for (const [n, archy] of Object.entries(skup))
    h += `<optgroup label="${esc(n)}">` + archy.map(a => `<option value="${esc(a.id)}">${esc(a.mujArch ? a.nazev + ' · ' + S.nazevArchu({ ...a, kody: '' }) : S.nazevArchu(a))}</option>`).join('') + '</optgroup>';
  $('archVyber').innerHTML = h;
  $('archVyber').value = vsechnyArchy().some(a => a.id === P.arch.id) && filtr(P.arch) ? P.arch.id : '';
}
function vykresliArch() {
  const a = P.arch;
  naplnVyberArchu();
  $('aPapir').value = a.papir || 'a4';
  for (const [id, k] of Object.entries(ARCH_POLE)) if (document.activeElement !== $(id)) $(id).value = a[k] ?? '';
  if ($('aPapirW').value === '') { $('aPapirW').value = 210; $('aPapirH').value = 297; }
  document.querySelectorAll('[data-vlastni]').forEach(e => e.hidden = a.papir !== 'vlastni');
  $('kalDx').value = pred.kalibrace.dx; $('kalDy').value = pred.kalibrace.dy;
  $('btnSmazMujArch').hidden = !a.mujArch;
  const k = S.zkontrolujArch(a);
  const shody = k.chyby.length ? [] : S.najdiArch(a.w, a.h).filter(x => x.id !== a.id);
  $('archHlaseni').innerHTML = k.chyby.map(c => `<div class="chyba">✖ ${esc(c)}</div>`).join('') + k.varovani.map(c => `<div class="var">⚠ ${esc(c)}</div>`).join('') +
    (!k.chyby.length ? `<div class="ok">✓ ${S.naArch(a)} štítků na archu</div>` : '') +
    (shody.length ? `<div class="pozn">Stejný rozměr mají i: ${shody.slice(0, 4).map(x => esc(x.vyrobce + ' ' + x.kody + ' (' + x.sl + '×' + x.ra + ')')).join(', ')}</div>` : '');
  $('archZdroj').textContent = a.overit ? '⚠ Rozměry z katalogu výrobce – před velkým tiskem ověřte podle balení nebo zkušebním tiskem.' : a.mujArch ? 'Váš uložený arch.' : 'Vlastní rozměry.';
  const p = S.papirArchu(a);
  $('archSvg').innerHTML = k.chyby.length && !(p.w > 0) ? '' : V.svgArchu(a, [], { papir: p, naznacit: true, idPredpona: 'g' });
  $('archPopis').textContent = `Papír ${cs(p.w, 1)} × ${cs(p.h, 1)} mm · rozteč ${cs(a.w + (+a.mezX || 0))} × ${cs(a.h + (+a.mezY || 0))} mm · okraje L ${cs(a.okL)} / H ${cs(a.okH)} mm`;
}
function nastavArch(id) {
  const a = vsechnyArchy().find(x => x.id === id);
  if (!a) return;
  P.arch = JSON.parse(JSON.stringify(a));
  zmena('arch');
}
$('archVyber').addEventListener('change', e => { if (e.target.value) nastavArch(e.target.value); else { P.arch = { ...P.arch, id: '', overit: false, mujArch: false, kody: '', vyrobce: 'vlastní' }; zmena('arch'); } });
$('archHledat').addEventListener('input', () => {
  naplnVyberArchu();
  const prvni = $('archVyber').querySelector('optgroup option');
  if (prvni && $('archVyber').value === '' && $('archHledat').value.trim()) { $('archVyber').value = prvni.value; nastavArch(prvni.value); }
});
for (const [id, k] of Object.entries(ARCH_POLE)) $(id).addEventListener('input', e => {
  const v = parseFloat(e.target.value);
  if (!isFinite(v)) return;
  P.arch[k] = v;
  if (P.arch.id) Object.assign(P.arch, { id: '', overit: false, mujArch: false, kody: '', vyrobce: 'vlastní' });
  zmena('arch');
});
$('aPapir').addEventListener('change', e => {
  P.arch.papir = e.target.value;
  if (P.arch.papir === 'vlastni' && !(P.arch.papirW > 0)) { P.arch.papirW = 210; P.arch.papirH = 297; }
  Object.assign(P.arch, { id: '', overit: false, mujArch: false, kody: '', vyrobce: 'vlastní' });
  zmena('arch');
});
$('btnSoumerne').onclick = () => { P.arch = S.dopocitejOkraje({ ...P.arch, okL: null, okH: null }); zmena('arch'); };
$('btnMujArch').onclick = async () => {
  const k = S.zkontrolujArch(P.arch);
  if (k.chyby.length) return Dialog.chyba('Arch má chyby: ' + k.chyby.join(' '));
  const n = await Dialog.zeptej('Název archu (např. kód z balení):', P.arch.kody ? `${P.arch.vyrobce} ${P.arch.kody}` : `Arch ${cs(P.arch.w, 1)}×${cs(P.arch.h, 1)}`);
  if (!n) return;
  const a = { ...P.arch, id: 'm' + Date.now().toString(36), nazev: n.trim(), mujArch: true, vyrobce: 'Moje archy', kody: '', overit: false };
  pred.mojeArchy.push(a); ulozPred();
  P.arch = { ...a }; zmena('arch');
  Dialog.info('Arch uložen mezi „Moje archy“.');
};
$('btnSmazMujArch').onclick = async () => {
  if (!(await Dialog.potvrd(`Smazat arch „${P.arch.nazev}“ z mých archů?`))) return;
  pred.mojeArchy = pred.mojeArchy.filter(a => a.id !== P.arch.id); ulozPred();
  Object.assign(P.arch, { id: '', mujArch: false, vyrobce: 'vlastní' }); zmena('arch');
};
['kalDx', 'kalDy'].forEach(id => $(id).addEventListener('input', () => {
  pred.kalibrace = { dx: parseFloat($('kalDx').value) || 0, dy: parseFloat($('kalDy').value) || 0 }; ulozPred();
}));

/* ---------- ② DATA ---------- */
function naplnData() {
  const d = P.data, c = d.cislovani;
  document.querySelectorAll('#rezim button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.rezim === d.rezim)));
  $('tabulkaObal').hidden = d.rezim !== 'tabulka';
  $('cPocetObal').hidden = d.rezim !== 'cislovani';
  const nast = (id, v) => { if (document.activeElement !== $(id)) $(id).value = v; };
  nast('dKopie', d.kopie); nast('nKopie', d.kopie); nast('dStart', d.start); nast('nStart', d.start); nast('dVyber', d.vyber); nast('dDatum', d.datum);
  $('dDatum').placeholder = S.datumCs(new Date());
  nast('cPredpona', c.predpona); nast('cOd', c.od); nast('cKrok', c.krok); nast('cNuly', c.nuly); nast('cPripona', c.pripona); nast('cPocet', c.pocet);
  $('nObrysy').checked = !!pred.obrysy;
}
function vykresliCislovaniUkazku() {
  const c = P.data.cislovani, n = P.data.rezim === 'cislovani' ? c.pocet : P.data.radky.length;
  const u = S.cislovani({ ...c, pocet: Math.min(n, 4) });
  $('cUkazka').textContent = u.length ? u.join(', ') + (n > 4 ? ' … ' + S.cislovani({ ...c, od: c.od + (n - 1) * c.krok, pocet: 1 })[0] : '') : '—';
  $('cPozn').textContent = P.data.rezim === 'cislovani' ? 'Štítky vzniknou jen z číslování – v návrhu použijte pole {cislo}.' : 'V režimu tabulky dostane každý řádek své číslo v poli {cislo} (počet = počet řádků).';
  const vyb = posledni.vyb;
  $('dVyber').style.borderColor = vyb.chyby.length ? 'var(--danger)' : '';
}
document.querySelectorAll('#rezim button').forEach(b => b.onclick = () => { P.data.rezim = b.dataset.rezim; zmena('dataForm'); });
const DATA_POLE = { dKopie: ['kopie', 'cislo'], nKopie: ['kopie', 'cislo'], dStart: ['start', 'cislo'], nStart: ['start', 'cislo'], dVyber: ['vyber'], dDatum: ['datum'] };
for (const [id, [k, typ]] of Object.entries(DATA_POLE)) $(id).addEventListener('input', e => {
  let v = e.target.value;
  if (typ) { v = Math.floor(+v); if (!(v >= 1)) return; if (k === 'start') v = Math.min(v, S.naArch(P.arch)); }
  P.data[k] = v; zmena('dataForm');
});
const CIS_POLE = { cPredpona: 'predpona', cOd: 'od', cKrok: 'krok', cNuly: 'nuly', cPripona: 'pripona', cPocet: 'pocet' };
for (const [id, k] of Object.entries(CIS_POLE)) $(id).addEventListener('input', e => {
  const v = id === 'cPredpona' || id === 'cPripona' ? e.target.value : Number(e.target.value);
  if (typeof v === 'number' && !isFinite(v)) return;
  P.data.cislovani[k] = v; zmena('dataForm');
});
$('nObrysy').onchange = e => { pred.obrysy = e.target.checked; ulozPred(); };

function vykresliTabulku() {
  const d = P.data, n = Math.min(d.radky.length, MAX_RADKU_MRIZKY);
  let h = '<thead><tr><th class="c">#</th>' + d.hlavicka.map((x, i) =>
    `<th><div class="radek" style="flex-wrap:nowrap;gap:0"><input data-h="${i}" value="${esc(x)}" aria-label="Název sloupce ${i + 1}"><button class="x" data-smaz-sl="${i}" title="Smazat sloupec">✕</button></div></th>`).join('') + '</tr></thead><tbody>';
  for (let r = 0; r < n; r++)
    h += `<tr><td class="c">${r + 1}<button class="x" data-smaz-r="${r}" title="Smazat řádek">✕</button></td>` + d.hlavicka.map((_, c) => `<td><input data-r="${r}" data-c="${c}" value="${esc(d.radky[r][c] ?? '')}"></td>`).join('') + '</tr>';
  $('tabulka').innerHTML = h + '</tbody>';
  $('tabInfo').textContent = `${d.radky.length} řádků × ${d.hlavicka.length} sloupců` + (d.radky.length > n ? ` – zobrazeno prvních ${n}, tisknou se všechny` : '');
}
$('tabulka').addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.h != null) { P.data.hlavicka[+t.dataset.h] = t.value; zmena('navrhForm'); return; }
  if (t.dataset.r != null) { P.data.radky[+t.dataset.r][+t.dataset.c] = t.value; zmena(); }
});
$('tabulka').addEventListener('click', e => {
  const sl = e.target.closest('[data-smaz-sl]'), r = e.target.closest('[data-smaz-r]');
  if (sl) { const i = +sl.dataset.smazSl; if (P.data.hlavicka.length < 2) return; P.data.hlavicka.splice(i, 1); P.data.radky.forEach(x => x.splice(i, 1)); zmena('tabulka'); }
  if (r) { P.data.radky.splice(+r.dataset.smazR, 1); if (!P.data.radky.length) P.data.radky.push(P.data.hlavicka.map(() => '')); zmena('tabulka'); }
});
// vložení bloku z tabulkového procesoru do mřížky od buňky
$('tabulka').addEventListener('paste', e => {
  const t = e.target, text = e.clipboardData.getData('text/plain');
  if (!/[\t\n]/.test(text.replace(/\r?\n$/, ''))) return;
  e.preventDefault();
  const blok = S.parseCSV(text, '\t');
  if (t.dataset.h != null) { // do hlavičky: celý blok jako nová tabulka s hlavičkou
    nahradTabulku(blok, true); return;
  }
  const r0 = +t.dataset.r, c0 = +t.dataset.c, d = P.data;
  blok.forEach((radek, i) => {
    while (d.radky.length <= r0 + i) d.radky.push(d.hlavicka.map(() => ''));
    radek.forEach((v, j) => {
      while (d.hlavicka.length <= c0 + j) { d.hlavicka.push('sloupec' + (d.hlavicka.length + 1)); d.radky.forEach(x => x.push('')); }
      d.radky[r0 + i][c0 + j] = v;
    });
  });
  zmena('tabulka');
});
$('btnRadek').onclick = () => { P.data.radky.push(P.data.hlavicka.map(() => '')); zmena('tabulka'); };
$('btnSloupec').onclick = () => { P.data.hlavicka.push('sloupec' + (P.data.hlavicka.length + 1)); P.data.radky.forEach(r => r.push('')); zmena('tabulka'); };
$('btnHlavDoDat').onclick = () => { const d = P.data; d.radky.unshift([...d.hlavicka]); d.hlavicka = d.hlavicka.map((_, i) => 'sloupec' + (i + 1)); zmena('tabulka'); };
$('btnDatDoHlav').onclick = () => { const d = P.data; if (!d.radky.length) return; nahradTabulku([d.radky[0], ...d.radky.slice(1)], true); };

function nahradTabulku(radky, sHlavickou, zprava) {
  const t = S.pripravTabulku(radky, sHlavickou);
  P.data.hlavicka = t.hlavicka;
  P.data.radky = t.radky.length ? t.radky : [t.hlavicka.map(() => '')];
  P.data.rezim = 'tabulka';
  zmena('vse');
  if (zprava) Dialog.info(zprava);
}
function nactiTabulkuText(text, nazev) {
  const odd = S.detekujOddelovac(text);
  const radky = S.parseCSV(text, odd);
  if (!radky.length) return Dialog.chyba('Soubor neobsahuje žádná data.');
  const hl = S.odhadniHlavicku(radky);
  nahradTabulku(radky, hl, `Načteno ${radky.length - (hl ? 1 : 0)} řádků z ${nazev} (oddělovač ${odd === '\t' ? 'tabulátor' : '„' + odd + '“'}, hlavička: ${hl ? 'ano' : 'ne'}).`);
  prepniKartu('data');
}
let xlsxSlib = null;
function nactiXlsx() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (!xlsxSlib) xlsxSlib = new Promise((ok, ko) => {
    const s = document.createElement('script'); s.src = 'lib/xlsx/xlsx.full.min.js';
    s.onload = () => ok(window.XLSX); s.onerror = () => { xlsxSlib = null; ko(new Error('Knihovnu XLSX se nepodařilo načíst.')); };
    document.head.appendChild(s);
  });
  return xlsxSlib;
}
async function importujSoubor(f) {
  const jm = f.name.toLowerCase();
  try {
    if (/\.(xlsx|xls|ods|xlsm)$/.test(jm)) {
      const X = await nactiXlsx();
      const wb = X.read(await f.arrayBuffer(), { type: 'array', cellDates: true });
      let list = wb.SheetNames[0];
      if (wb.SheetNames.length > 1) {
        const neprazdne = wb.SheetNames.filter(n => wb.Sheets[n]['!ref']);
        list = neprazdne[0] || list;
        if (neprazdne.length > 1) Dialog.info(`Sešit má ${neprazdne.length} listů, načten první: „${list}“.`);
      }
      const radky = X.utils.sheet_to_json(wb.Sheets[list], { header: 1, raw: false, defval: '', dateNF: 'd. m. yyyy' })
        .map(r => r.map(v => v == null ? '' : String(v))).filter(r => r.some(v => v.trim()));
      if (!radky.length) return Dialog.chyba('List je prázdný.');
      const hl = S.odhadniHlavicku(radky);
      nahradTabulku(radky, hl, `Načteno ${radky.length - (hl ? 1 : 0)} řádků z listu „${list}“ (hlavička: ${hl ? 'ano' : 'ne'}).`);
      prepniKartu('data');
    } else if (/\.json$/.test(jm)) {
      nactiProjektJson(await f.text());
    } else if (f.type.startsWith('image/')) {
      await vlozObrazek(f);
    } else {
      const buf = await f.arrayBuffer();
      let text = new TextDecoder('utf-8').decode(buf);
      if (text.includes('�')) text = new TextDecoder('windows-1250').decode(buf); // starý Excel CSV
      nactiTabulkuText(text, f.name);
    }
  } catch (e) { Dialog.chyba('Soubor se nepodařilo načíst: ' + e.message); }
}
$('souborData').onchange = e => { if (e.target.files[0]) importujSoubor(e.target.files[0]); e.target.value = ''; };

/* ---------- ③ NÁVRH ---------- */
const TYPY = { text: '🔤 Text', qr: '▣ QR kód', kod: '║ Čárový kód', obr: '🖼️ Obrázek' };
const VYCHOZI = {
  text: { typ: 'text', x: 0, y: 0, w: 100, h: 30, text: 'Text {poradi}', velikost: 12, min: 5, zar: 'L', svisle: 'M', radkovani: 1.15 },
  qr: { typ: 'qr', x: 0, y: 0, w: 40, h: 100, text: '{cislo}', ec: 'M', zar: 'L', tiche: 1 },
  kod: { typ: 'kod', x: 0, y: 60, w: 100, h: 40, text: '{cislo}', format: 'code128', cisla: true },
  obr: { typ: 'obr', x: 70, y: 0, w: 30, h: 40, zar: 'R' },
};
function popisPrvku(p) {
  if (p.typ === 'obr') return TYPY.obr + (p.data ? '' : ' (nevložen)');
  if (p.typ === 'kod') return '║ ' + ({ ean13: 'EAN-13', ean8: 'EAN-8', code128: 'Code 128' }[p.format] || p.format) + ' ' + p.text;
  return (p.typ === 'qr' ? '▣ ' : '🔤 ') + String(p.text || '').replace(/\n/g, ' ⏎ ');
}
function naplnNavrh() {
  const n = P.navrh, r = n.ramecek;
  const nast = (id, v) => { if (document.activeElement !== $(id)) $(id).value = v; };
  nast('nOdsazeni', n.odsazeni); nast('nRamTl', r.tl || 0); nast('nRamR', r.zaobleni || 0); nast('nRamOd', r.odsazeni || 0); $('nRamBarva').value = r.barva || '#000000';
}
$('nOdsazeni').addEventListener('input', e => { const v = parseFloat(e.target.value); if (v >= 0) { P.navrh.odsazeni = v; zmena(); } });
[['nRamTl', 'tl'], ['nRamR', 'zaobleni'], ['nRamOd', 'odsazeni'], ['nRamBarva', 'barva']].forEach(([id, k]) => $(id).addEventListener('input', e => {
  const v = k === 'barva' ? e.target.value : parseFloat(e.target.value);
  if (k !== 'barva' && !(v >= 0)) return;
  P.navrh.ramecek[k] = v; zmena();
}));
function vykresliPrvky() {
  const pr = P.navrh.prvky;
  if (vybrany >= pr.length) vybrany = pr.length - 1;
  $('prvky').innerHTML = pr.map((p, i) => `<div class="pr${p.skryty ? ' skryty' : ''}" data-i="${i}" aria-selected="${i === vybrany}" tabindex="0">` +
    `<span class="n">${esc(popisPrvku(p))}</span>` +
    `<button class="x" data-akce="nahoru" title="Posunout výš v seznamu (kreslí se dřív)">▲</button><button class="x" data-akce="dolu" title="Posunout níž (kreslí se navrch)">▼</button>` +
    `<button class="x" data-akce="skryt" title="Skrýt / zobrazit">${p.skryty ? '◌' : '👁'}</button><button class="x" data-akce="kopie" title="Duplikovat">⧉</button><button class="x" data-akce="smaz" title="Smazat (Delete)">✕</button></div>`).join('') ||
    '<p class="pozn">Štítek je prázdný – přidejte prvek tlačítky výše.</p>';
}
$('prvky').addEventListener('click', e => {
  const r = e.target.closest('.pr'); if (!r) return;
  const i = +r.dataset.i, a = e.target.closest('[data-akce]')?.dataset.akce, pr = P.navrh.prvky;
  if (a === 'smaz') { pr.splice(i, 1); }
  else if (a === 'kopie') { pr.splice(i + 1, 0, JSON.parse(JSON.stringify(pr[i]))); vybrany = i + 1; }
  else if (a === 'skryt') pr[i].skryty = !pr[i].skryty;
  else if (a === 'nahoru' && i > 0) { [pr[i - 1], pr[i]] = [pr[i], pr[i - 1]]; vybrany = i - 1; }
  else if (a === 'dolu' && i < pr.length - 1) { [pr[i + 1], pr[i]] = [pr[i], pr[i + 1]]; vybrany = i + 1; }
  else vybrany = i;
  zmena('navrhForm');
});
document.querySelectorAll('[data-pridat]').forEach(b => b.onclick = () => {
  const t = b.dataset.pridat;
  P.navrh.prvky.push(JSON.parse(JSON.stringify(VYCHOZI[t])));
  vybrany = P.navrh.prvky.length - 1;
  zmena('navrhForm');
  if (t === 'obr') $('souborObr').click();
});

function vykresliVlastnosti() {
  const p = P.navrh.prvky[vybrany], el = $('vlastnosti');
  if (!p) { el.innerHTML = ''; return; }
  const VYCH = { radkovani: 1.15, tiche: 1, min: 4 };
  const cislo = (k, n, krok = 1, min = 0, max = 999) => `<label class="p">${n}<input type="number" data-v="${k}" value="${p[k] ?? VYCH[k] ?? ''}" step="${krok}" min="${min}" max="${max}"></label>`;
  const zar = (k, vol) => `<div class="segment" data-seg="${k}">` + vol.map(([v, n, t]) => `<button data-hod="${v}" aria-pressed="${(p[k] || vol[0][0]) === v}" title="${t}">${n}</button>`).join('') + '</div>';
  let h = `<h3>${TYPY[p.typ]}</h3>`;
  if (p.typ === 'text') {
    h += `<label class="p">Text (pole ve složených závorkách, Enter = nový řádek)<textarea data-v="text" rows="3" id="vText">${esc(p.text)}</textarea></label>
      <div class="mrizka" style="margin-top:6px">${cislo('velikost', 'Písmo nejvýš (pt)', 0.5, 2, 200)}${cislo('min', 'Zmenšit nejvýš na (pt)', 0.5, 1, 200)}${cislo('radkovani', 'Řádkování', 0.05, 0.7, 3)}
      <label class="p">Barva<input type="color" data-v="barva" value="${esc(p.barva || '#000000')}"></label></div>
      <div class="radek" style="margin-top:6px">${zar('zar', [['L', '⯇', 'Vlevo'], ['C', '≡', 'Na střed'], ['R', '⯈', 'Vpravo']])}${zar('svisle', [['T', '⯅', 'Nahoru'], ['M', '⬌', 'Doprostřed'], ['B', '⯆', 'Dolů']])}</div>
      <div class="radek" style="margin-top:6px"><label class="z"><input type="checkbox" data-c="tucne"${p.tucne ? ' checked' : ''}> tučně</label>
      <label class="z"><input type="checkbox" data-c="prvniTucne"${p.prvniTucne ? ' checked' : ''}> 1. řádek tučně</label>
      <label class="z"><input type="checkbox" data-c="zalamovat"${p.zalamovat ? ' checked' : ''}> zalamovat slova</label></div>`;
  } else if (p.typ === 'qr') {
    h += `<label class="p">Obsah QR (text, odkaz, pole)<textarea data-v="text" rows="2" id="vText">${esc(p.text)}</textarea></label>
      <div class="mrizka" style="margin-top:6px"><label class="p">Oprava chyb<select data-v="ec">${['L', 'M', 'Q', 'H'].map(x => `<option${p.ec === x ? ' selected' : ''}>${x}</option>`).join('')}</select></label>
      ${cislo('tiche', 'Tichá zóna (moduly)', 1, 0, 8)}<label class="p">Barva<input type="color" data-v="barva" value="${esc(p.barva || '#000000')}"></label></div>
      <div class="radek" style="margin-top:6px">${zar('zar', [['L', '⯇', 'Vlevo'], ['C', '≡', 'Na střed'], ['R', '⯈', 'Vpravo']])}</div>
      <p class="pozn">Norma doporučuje tichou zónu 4 moduly; na štítcích obvykle stačí 1–2, pokud okolo nic není.</p>`;
  } else if (p.typ === 'kod') {
    h += `<div class="mrizka"><label class="p">Typ kódu<select data-v="format"><option value="ean13"${p.format === 'ean13' ? ' selected' : ''}>EAN-13</option><option value="ean8"${p.format === 'ean8' ? ' selected' : ''}>EAN-8</option><option value="code128"${p.format === 'code128' ? ' selected' : ''}>Code 128</option></select></label>
      <label class="p">Barva<input type="color" data-v="barva" value="${esc(p.barva || '#000000')}"></label>
      <label class="p cela">Obsah (pole nebo číslo)<input type="text" data-v="text" id="vText" value="${esc(p.text)}"></label></div>
      <label class="z" style="margin-top:6px"><input type="checkbox" data-c="cisla"${p.cisla !== false ? ' checked' : ''}> číslice pod kódem</label>
      <p class="pozn">${p.format === 'code128' ? 'Code 128: písmena bez diakritiky, číslice a znaky ASCII.' : `EAN: ${p.format === 'ean8' ? 7 : 12} číslic, kontrolní se dopočítá.`} Kód se roztáhne na šířku rámečku – pro spolehlivé čtení dejte modulu aspoň 0,25 mm.</p>`;
  } else if (p.typ === 'obr') {
    h += `<div class="radek"><button class="tl mala" id="vObrBtn">📂 ${p.data ? 'Vyměnit' : 'Vložit'} obrázek…</button>${zar('zar', [['L', '⯇', 'Vlevo'], ['C', '≡', 'Na střed'], ['R', '⯈', 'Vpravo']])}</div>
      <p class="pozn">${p.data ? `Obrázek ${p.pw} × ${p.ph} px, uložen v projektu.` : 'Obrázek (logo) se uloží do projektu. Lze ho i přetáhnout na stránku.'}</p>`;
  }
  h += `<h3>Poloha (% vnitřní plochy)</h3><div class="mrizka" style="grid-template-columns:repeat(4,minmax(0,1fr))">${cislo('x', 'X', 0.5, -50, 150)}${cislo('y', 'Y', 0.5, -50, 150)}${cislo('w', 'Šířka', 0.5, 1, 200)}${cislo('h', 'Výška', 0.5, 1, 200)}</div>`;
  el.innerHTML = h;
  const ob = $('vObrBtn'); if (ob) ob.onclick = () => $('souborObr').click();
}
$('vlastnosti').addEventListener('input', e => {
  const p = P.navrh.prvky[vybrany], t = e.target; if (!p) return;
  if (t.dataset.v) {
    const k = t.dataset.v;
    if (t.type === 'number') { const v = parseFloat(t.value); if (!isFinite(v)) return; p[k] = v; }
    else p[k] = t.value;
    if (k === 'format') { zmena('navrhForm'); return; }
    vykresliPrvky(); zmena();
  } else if (t.dataset.c) { p[t.dataset.c] = t.checked; zmena(); }
});
$('vlastnosti').addEventListener('click', e => {
  const b = e.target.closest('[data-hod]'); if (!b) return;
  const p = P.navrh.prvky[vybrany]; p[b.closest('[data-seg]').dataset.seg] = b.dataset.hod;
  b.parentElement.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  zmena();
});
function vykresliCipy() {
  const pole = [...(P.data.rezim === 'tabulka' ? P.data.hlavicka.map(S.klic) : []), 'poradi', 'cislo', 'datum'];
  const h = [...new Set(pole)].map(k => `<button data-pole="${esc(k)}">{${esc(k)}}</button>`).join('');
  if ($('cipy').innerHTML !== h) $('cipy').innerHTML = h;
}
$('cipy').addEventListener('click', e => {
  const b = e.target.closest('[data-pole]'); if (!b) return;
  const p = P.navrh.prvky[vybrany];
  if (!p || p.typ === 'obr') return Dialog.info('Nejdřív vyberte textový, QR nebo čárový prvek.');
  const ta = $('vText'), vloz = '{' + b.dataset.pole + '}';
  if (ta) {
    const a = ta.selectionStart ?? ta.value.length, z = ta.selectionEnd ?? a;
    ta.value = ta.value.slice(0, a) + vloz + ta.value.slice(z);
    ta.focus(); ta.selectionStart = ta.selectionEnd = a + vloz.length;
    p.text = ta.value;
  } else p.text = (p.text || '') + vloz;
  vykresliPrvky(); zmena();
});

async function vlozObrazek(f) {
  const url = await new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => ko(r.error); r.readAsDataURL(f); });
  const img = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ko(new Error('obrázek nelze přečíst')); i.src = url; });
  const max = 1200, k = Math.min(1, max / Math.max(img.naturalWidth || 300, img.naturalHeight || 300));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round((img.naturalWidth || 300) * k)); c.height = Math.max(1, Math.round((img.naturalHeight || 300) * k));
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const jpeg = /jpe?g/i.test(f.type);
  const data = c.toDataURL(jpeg ? 'image/jpeg' : 'image/png', 0.9);
  let p = P.navrh.prvky[vybrany];
  if (!p || p.typ !== 'obr') { p = JSON.parse(JSON.stringify(VYCHOZI.obr)); P.navrh.prvky.push(p); vybrany = P.navrh.prvky.length - 1; }
  Object.assign(p, { data, pw: c.width, ph: c.height });
  zmena('navrhForm');
  prepniKartu('navrh');
}
$('souborObr').onchange = e => { if (e.target.files[0]) vlozObrazek(e.target.files[0]).catch(x => Dialog.chyba(x.message)); e.target.value = ''; };

// editor jednoho štítku s tažením prvků
function vykresliEditor() {
  const L = posledni, a = P.arch;
  if (!(a.w > 0 && a.h > 0)) { $('editor').innerHTML = ''; return; }
  if (nahledZaz >= L.zaz.length) nahledZaz = Math.max(0, L.zaz.length - 1);
  const st = L.zaz.length ? S.sestavStitek(P.navrh, L.zaz[nahledZaz], a.w, a.h, nastroje) : { prim: [], varovani: [] };
  const od = +P.navrh.odsazeni || 0, iw = a.w - 2 * od, ih = a.h - 2 * od;
  let ram = '';
  if ($('ukazRamy').checked) {
    ram = `<rect class="vnitrni" x="${od}" y="${od}" width="${iw}" height="${ih}"/>`;
    P.navrh.prvky.forEach((p, i) => {
      if (p.skryty) return;
      const x = od + iw * p.x / 100, y = od + ih * p.y / 100, w = iw * p.w / 100, h = ih * p.h / 100, u = Math.min(a.w, a.h) * 0.06;
      ram += `<rect class="box${i === vybrany ? ' vybrany' : ''}" data-i="${i}" x="${x}" y="${y}" width="${w}" height="${h}"/>` +
        (i === vybrany ? `<rect class="uchyt" data-uchyt="${i}" x="${x + w - u / 2}" y="${y + h - u / 2}" width="${u}" height="${u}"/>` : '');
    });
  }
  const svg = V.svgStitku(st.prim, a.w, a.h, { obrys: true, zaobleni: a.zaobleni || 0 }).replace('</svg>', ram + '</svg>');
  $('editor').innerHTML = svg;
  $('zazInfo').textContent = L.zaz.length ? `záznam ${nahledZaz + 1} / ${L.zaz.length}` : 'žádné záznamy';
  $('navrhHlaseni').innerHTML = st.varovani.map(v => `<div class="var">⚠ ${esc(v)}</div>`).join('');
}
$('zazPred').onclick = () => { nahledZaz = Math.max(0, nahledZaz - 1); vykresliEditor(); };
$('zazDal').onclick = () => { nahledZaz = Math.min(posledni.zaz.length - 1, nahledZaz + 1); vykresliEditor(); };
$('ukazRamy').onchange = () => vykresliEditor();
let tah = null;
function bodMm(e, svg) { const m = svg.getScreenCTM().inverse(), b = new DOMPoint(e.clientX, e.clientY).matrixTransform(m); return b; }
$('editor').addEventListener('pointerdown', e => {
  const svg = $('editor').querySelector('svg'); if (!svg) return;
  const u = e.target.closest('[data-uchyt]'), b = e.target.closest('[data-i]');
  if (!u && !b) return;
  const i = +(u ? u.dataset.uchyt : b.dataset.i);
  if (i !== vybrany) { vybrany = i; vykresliPrvky(); vykresliVlastnosti(); }
  const p = P.navrh.prvky[i], od = +P.navrh.odsazeni || 0;
  tah = { i, uchyt: !!u, start: bodMm(e, svg), puv: { ...p }, kx: 100 / (P.arch.w - 2 * od), ky: 100 / (P.arch.h - 2 * od), svg };
  try { svg.setPointerCapture(e.pointerId); } catch (x) { /* syntetická událost */ }
  e.preventDefault();
});
$('editor').addEventListener('pointermove', e => {
  if (!tah) return;
  const b = bodMm(e, tah.svg), p = P.navrh.prvky[tah.i];
  const dx = (b.x - tah.start.x) * tah.kx, dy = (b.y - tah.start.y) * tah.ky, zaokr = v => Math.round(v * 2) / 2;
  if (tah.uchyt) { p.w = Math.max(2, zaokr(tah.puv.w + dx)); p.h = Math.max(2, zaokr(tah.puv.h + dy)); }
  else { p.x = zaokr(tah.puv.x + dx); p.y = zaokr(tah.puv.y + dy); }
  vykresliEditor();
});
const konecTahu = () => { if (tah) { tah = null; vykresliVlastnosti(); zmena(); } };
$('editor').addEventListener('pointerup', konecTahu);
$('editor').addEventListener('pointercancel', konecTahu);

/* ---------- ④ NÁHLED ---------- */
function polozkyArchu(a) { return a.map(it => ({ slot: it.slot, prim: primZaznamu(it.zaznam) })); }
function vykresliNahled() {
  if ($('kartaNahled').hidden) return;
  const L = posledni, p = S.papirArchu(P.arch), n = Math.min(L.archy.length, MAX_ARCHU_NAHLEDU);
  let h = '';
  if (!L.archy.length) {
    h = `<figure>${V.svgArchu(P.arch, [], { papir: p, naznacit: true, idPredpona: 'n0', zvyraznit: P.data.start - 1 })}<figcaption>${S.zkontrolujArch(P.arch).chyby.length ? 'Arch má chybné rozměry – opravte je na kartě Arch.' : 'Žádné štítky k tisku.'}</figcaption></figure>`;
  }
  for (let i = 0; i < n; i++)
    h += `<figure>${V.svgArchu(P.arch, polozkyArchu(L.archy[i]), { papir: p, naznacit: true, idPredpona: 'n' + i, zvyraznit: i === 0 ? P.data.start - 1 : -1 })}<figcaption>Arch ${i + 1} / ${L.archy.length} · ${L.archy[i].length} štítků</figcaption></figure>`;
  $('archy').innerHTML = h;
  $('archyPozn').textContent = L.archy.length > n ? `Náhled ukazuje prvních ${n} archů, tisk i PDF obsahují všech ${L.archy.length}.` : '';
  const v = vsechnaVarovani();
  $('nVarovani').innerHTML = v.size ? `<details${v.size < 6 ? ' open' : ''}><summary style="cursor:pointer;color:var(--warn);font-size:.84rem">⚠ Varování u ${v.size} záznamů</summary><ul class="varovani">` +
    [...v.entries()].sort((x, y) => x[0] - y[0]).slice(0, 200).map(([i, t]) => `<li>záznam ${i + 1}: ${esc(t.join('; '))}</li>`).join('') + '</ul></details>' : '';
}
$('archy').addEventListener('click', e => {
  const svg = e.target.closest('figure:first-child svg'); if (!svg) return;
  const b = bodMm(e, svg), a = P.arch;
  for (let i = 0; i < S.naArch(a); i++) {
    const q = S.poziceStitku(a, i);
    if (b.x >= q.x && b.x <= q.x + q.w && b.y >= q.y && b.y <= q.y + q.h) { P.data.start = i + 1; zmena('dataForm'); return; }
  }
});

/* ---------- tisk a PDF ---------- */
function stylTisku(p) {
  let st = $('stylTisku');
  if (!st) { st = document.createElement('style'); st.id = 'stylTisku'; document.head.appendChild(st); }
  st.textContent = `@page{size:${p.w}mm ${p.h}mm;margin:0}#tisk .list{width:${p.w}mm;height:${p.h}mm}`;
}
function overProTisk() {
  const k = S.zkontrolujArch(P.arch);
  if (k.chyby.length) { Dialog.chyba('Arch má chybné rozměry: ' + k.chyby.join(' ')); prepniKartu('arch'); return false; }
  rozlozeni();
  if (!posledni.archy.length) { Dialog.chyba('Není co tisknout – tabulka je prázdná nebo výběr nic neobsahuje.'); return false; }
  return true;
}
async function pripravTisk(zkusebni) {
  if (!zkusebni && !overProTisk()) return false;
  if (zkusebni && S.zkontrolujArch(P.arch).chyby.length) { Dialog.chyba('Arch má chybné rozměry.'); return false; }
  if (!pismoNacteno) await nactiPisma();
  const p = S.papirArchu(P.arch);
  stylTisku(p);
  const archy = zkusebni ? [[]] : posledni.archy;
  $('tisk').innerHTML = archy.map((a, i) => `<div class="list">${V.svgArchu(P.arch, polozkyArchu(a), { papir: p, mm: true, idPredpona: 't' + i,
    kalibrace: pred.kalibrace, obrysy: zkusebni || pred.obrysy, krize: zkusebni })}</div>`).join('');
  return true;
}
async function tiskni(zkusebni) {
  if (!(await pripravTisk(zkusebni))) return;
  Dialog.info('V dialogu tisku zvolte měřítko 100 % (skutečná velikost) a okraje „Žádné“.');
  await new Promise(r => setTimeout(r, 150));
  window.print();
  setTimeout(() => { $('tisk').innerHTML = ''; }, 1000);
}
let jspdfSlib = null;
function nactiJspdf() {
  if (window.jspdf) return Promise.resolve(window.jspdf);
  if (!jspdfSlib) jspdfSlib = new Promise((ok, ko) => {
    const s = document.createElement('script'); s.src = 'lib/jspdf.umd.min.js';
    s.onload = () => ok(window.jspdf); s.onerror = () => { jspdfSlib = null; ko(new Error('Knihovna jsPDF se nenačetla.')); };
    document.head.appendChild(s);
  });
  return jspdfSlib;
}
async function vytvorPdf(zkusebni) {
  if (!zkusebni && !overProTisk()) return null;
  const { jsPDF } = await nactiJspdf();
  const p = S.papirArchu(P.arch), pisma = await pismaProPdf();
  const doc = new jsPDF({ unit: 'mm', format: [p.w, p.h], orientation: p.w > p.h ? 'l' : 'p', compress: true });
  if (pisma) {
    doc.addFileToVFS('LiberationSans-Regular.ttf', pisma.r); doc.addFont('LiberationSans-Regular.ttf', 'LS', 'normal');
    doc.addFileToVFS('LiberationSans-Bold.ttf', pisma.b); doc.addFont('LiberationSans-Bold.ttf', 'LSB', 'normal');
  } else Dialog.chyba('Písmo se nenačetlo – PDF použije Helveticu bez české diakritiky.');
  const archy = zkusebni ? [[]] : posledni.archy, o = { kalibrace: pred.kalibrace, obrysy: zkusebni || pred.obrysy, pismo: !!pisma };
  archy.forEach((a, i) => {
    if (i) doc.addPage([p.w, p.h], p.w > p.h ? 'l' : 'p');
    V.pdfArch(doc, P.arch, polozkyArchu(a), o);
    if (zkusebni) {
      doc.setDrawColor(0); doc.setLineWidth(0.2);
      const dx = +pred.kalibrace.dx || 0, dy = +pred.kalibrace.dy || 0;
      for (const [x, y] of [[10, 10], [p.w - 10, 10], [10, p.h - 10], [p.w - 10, p.h - 10]]) { doc.line(x - 4 + dx, y + dy, x + 4 + dx, y + dy); doc.line(x + dx, y - 4 + dy, x + dx, y + 4 + dy); }
    }
  });
  return doc;
}
async function ulozPdf(zkusebni) {
  try {
    const doc = await vytvorPdf(zkusebni);
    if (!doc) return;
    const jm = (zkusebni ? 'zkusebni_obrysy_' : '') + (P.nazev || 'stitky').replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 50);
    doc.save(jm + '.pdf');
    Dialog.info(`PDF uloženo (${doc.getNumberOfPages()} ${doc.getNumberOfPages() === 1 ? 'strana' : 'stran'}). Tiskněte ve „Skutečné velikosti“.`);
  } catch (e) { Dialog.chyba('PDF se nepodařilo vytvořit: ' + e.message); }
}

/* ---------- projekty ---------- */
async function ulozit(jako) {
  if (jako || !P.id) {
    const n = await Dialog.zeptej('Název projektu:', P.nazev);
    if (!n) return;
    P.nazev = n.trim(); P.id = 'p' + Date.now().toString(36);
  }
  try {
    await dbUloz({ id: P.id, nazev: P.nazev, projekt: P, cas: Date.now() });
    zmena('vse');
    Dialog.info(`Projekt „${P.nazev}“ uložen.`);
  } catch (e) { Dialog.chyba('Uložení selhalo: ' + e.message); }
}
async function otevrit() {
  const vse = (await dbVse()).filter(z => z.id !== '_aktualni').sort((a, b) => b.cas - a.cas);
  $('seznamProjektu').innerHTML = vse.length ? vse.map(z => `<div class="pj"><div class="n"><b>${esc(z.nazev)}</b><br><small>${new Date(z.cas).toLocaleString('cs-CZ')} · ${esc(S.nazevArchu(z.projekt.arch))} · ${z.projekt.data.rezim === 'cislovani' ? z.projekt.data.cislovani.pocet + ' čísel' : z.projekt.data.radky.length + ' řádků'}</small></div>` +
    `<button class="tl mala" data-otevri="${esc(z.id)}">Otevřít</button><button class="tl mala" data-smaz-proj="${esc(z.id)}" aria-label="Smazat">🗑️</button></div>`).join('') : '<p class="pozn">Zatím žádné uložené projekty. Uložte rozpracovaný projekt přes 💾 Uložit.</p>';
  $('dlgProjekty').showModal();
}
$('seznamProjektu').addEventListener('click', async e => {
  const o = e.target.closest('[data-otevri]'), s = e.target.closest('[data-smaz-proj]');
  if (o) { const z = await dbNacti(o.dataset.otevri); if (z) { nastavProjekt(z.projekt); $('dlgProjekty').close(); Dialog.info(`Otevřen projekt „${z.nazev}“.`); } }
  if (s) { if (await Dialog.potvrd('Smazat uložený projekt?')) { await dbSmaz(s.dataset.smazProj); otevrit(); } }
});
function nastavProjekt(p) {
  const z = prazdnyProjekt();
  P = { ...z, ...p, arch: { ...z.arch, ...p.arch }, data: { ...z.data, ...p.data, cislovani: { ...z.data.cislovani, ...(p.data || {}).cislovani } },
    navrh: { ...z.navrh, ...p.navrh, ramecek: { ...z.navrh.ramecek, ...((p.navrh || {}).ramecek || {}) } } };
  if (!Array.isArray(P.data.radky) || !P.data.radky.length) P.data.radky = [P.data.hlavicka.map(() => '')];
  vybrany = 0; nahledZaz = 0;
  zmena('vse');
}
function nactiProjektJson(text) {
  let j;
  try { j = JSON.parse(text); } catch (e) { return Dialog.chyba('Soubor není platný JSON.'); }
  const p = j && j.typ === 'stitky_hromadne' ? j.projekt : null;
  if (!p || !p.arch || !p.navrh) return Dialog.chyba('Soubor není projekt Hromadného tisku štítků.');
  p.id = null;
  nastavProjekt(p);
  Dialog.info(`Načten projekt „${p.nazev}“ – uložte ho, pokud ho chcete mít v seznamu.`);
}
function stahni(blob, jm) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = jm;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
$('souborJson').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (f) nactiProjektJson(await f.text()); };

/* ---------- předlohy ---------- */
$('seznamPredloh').innerHTML = Object.entries(S.PREDLOHY).map(([k, p]) => `<button class="tl" data-predloha="${k}">${esc(p.nazev)}</button>`).join('');
$('seznamPredloh').addEventListener('click', async e => {
  const b = e.target.closest('[data-predloha]'); if (!b) return;
  zavriNabidky();
  if (!(await Dialog.potvrd('Načíst předlohu? Současný návrh, arch a data se nahradí (uložené projekty zůstanou).'))) return;
  nastavProjekt(zPredlohy(b.dataset.predloha));
  prepniKartu('nahled');
});

/* ---------- příkazy, nabídky, karty ---------- */
const PRIKAZY = {
  novy: async () => { if (await Dialog.potvrd('Začít nový prázdný projekt? Neuložené změny se ztratí.')) { nastavProjekt(prazdnyProjekt()); prepniKartu('arch'); } },
  otevrit, ulozit: () => ulozit(false), ulozitJako: () => ulozit(true),
  prejmenovat: async () => { const n = await Dialog.zeptej('Nový název projektu:', P.nazev); if (n) { P.nazev = n.trim(); if (P.id) await dbUloz({ id: P.id, nazev: P.nazev, projekt: P, cas: Date.now() }); zmena(); } },
  exportJson: () => stahni(new Blob([JSON.stringify({ typ: 'stitky_hromadne', verze: 1, projekt: P }, null, 1)], { type: 'application/json' }), (P.nazev || 'stitky').replace(/[^\p{L}\p{N}_-]+/gu, '_') + '.json'),
  importJson: () => $('souborJson').click(),
  importData: () => $('souborData').click(),
  vlozitSchranku: async () => {
    let t = '';
    try { t = await navigator.clipboard.readText(); } catch (e) { return Dialog.chyba('Prohlížeč nepovolil čtení schránky. Klepněte do buňky tabulky a vložte Ctrl+V.'); }
    if (!t.trim()) return Dialog.chyba('Schránka je prázdná.');
    nactiTabulkuText(t, 'schránky');
  },
  exportCsv: () => {
    const d = P.data;
    stahni(new Blob(['﻿' + S.doCSV([d.hlavicka, ...d.radky], ';')], { type: 'text/csv;charset=utf-8' }), (P.nazev || 'stitky').replace(/[^\p{L}\p{N}_-]+/gu, '_') + '.csv');
  },
  smazatPrazdne: () => { const d = P.data, n = d.radky.length; d.radky = d.radky.filter(r => r.some(v => String(v).trim())); if (!d.radky.length) d.radky.push(d.hlavicka.map(() => '')); Dialog.info(`Odstraněno ${n - d.radky.length} prázdných řádků.`); zmena('tabulka'); },
  vymazatData: async () => { if (await Dialog.potvrd('Vymazat celou tabulku (hlavička zůstane)?')) { P.data.radky = [P.data.hlavicka.map(() => '')]; zmena('tabulka'); } },
  tisk: () => tiskni(false), pdf: () => ulozPdf(false),
  zkusebni: () => tiskni(true), zkusebniPdf: () => ulozPdf(true),
  kalibrace: () => { prepniKartu('arch'); $('kalDx').focus(); },
  napoveda: () => $('dlgNapoveda').showModal(),
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
  if (b && !b.disabled) { e.preventDefault(); e.stopPropagation(); zavriNabidky(); return PRIKAZY[b.dataset.prikaz] && PRIKAZY[b.dataset.prikaz](); }
  const sk = e.target.closest('[data-karta-skok]'); if (sk) prepniKartu(sk.dataset.kartaSkok);
  if (!e.target.closest('.nabidka')) zavriNabidky();
});
addEventListener('resize', zavriNabidky);
document.querySelectorAll('dialog [data-zavrit]').forEach(b => b.onclick = () => b.closest('dialog').close());

const KARTY = { arch: 'kartaArch', data: 'kartaData', navrh: 'kartaNavrh', nahled: 'kartaNahled' };
function prepniKartu(k) {
  if (!KARTY[k]) k = 'arch';
  for (const [n, id] of Object.entries(KARTY)) $(id).hidden = n !== k;
  document.querySelectorAll('[data-karta]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.karta === k)));
  pred.karta = k; ulozPred();
  planujVykres();
}
document.querySelectorAll('[data-karta]').forEach(b => b.onclick = () => prepniKartu(b.dataset.karta));

document.addEventListener('keydown', e => {
  const vPoli = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && !e.shiftKey && !e.altKey) {
    const k = e.key.toLowerCase();
    if (k === 's') { e.preventDefault(); return PRIKAZY.ulozit(); }
    if (k === 'o') { e.preventDefault(); return otevrit(); }
    if (k === 'p') { e.preventDefault(); return tiskni(false); }
    if (k === 'e') { e.preventDefault(); return ulozPdf(false); }
  }
  if (e.key === 'F1') { e.preventDefault(); return PRIKAZY.napoveda(); }
  if (e.key === 'Escape') zavriNabidky();
  if (vPoli || ctrl || e.altKey || document.querySelector('dialog[open]')) return;
  if (/^[1-4]$/.test(e.key)) { prepniKartu(['arch', 'data', 'navrh', 'nahled'][+e.key - 1]); return; }
  if (!$('kartaNavrh').hidden && P.navrh.prvky[vybrany]) {
    const p = P.navrh.prvky[vybrany], k = e.shiftKey ? 5 : 0.5;
    const pohyb = { ArrowLeft: [-k, 0], ArrowRight: [k, 0], ArrowUp: [0, -k], ArrowDown: [0, k] }[e.key];
    if (pohyb) { e.preventDefault(); p.x = Math.round((p.x + pohyb[0]) * 2) / 2; p.y = Math.round((p.y + pohyb[1]) * 2) / 2; vykresliVlastnosti(); zmena(); }
    if (e.key === 'Delete') { e.preventDefault(); P.navrh.prvky.splice(vybrany, 1); zmena('navrhForm'); }
  }
});

/* ---------- přetažení souborů ---------- */
let prekryv = null, hloubka = 0;
addEventListener('dragenter', e => {
  if (![...e.dataTransfer.types].includes('Files')) return;
  hloubka++;
  if (!prekryv) { prekryv = document.createElement('div'); prekryv.className = 'prekryv'; prekryv.textContent = '📥 Pusťte tabulku (CSV, XLSX), obrázek nebo projekt (JSON)'; document.body.appendChild(prekryv); }
});
addEventListener('dragleave', () => { if (--hloubka <= 0 && prekryv) { prekryv.remove(); prekryv = null; hloubka = 0; } });
addEventListener('dragover', e => e.preventDefault());
addEventListener('drop', e => {
  e.preventDefault(); hloubka = 0; if (prekryv) { prekryv.remove(); prekryv = null; }
  const f = e.dataTransfer.files[0]; if (f) importujSoubor(f);
});

/* ---------- start ---------- */
if (window.self === window.top) document.body.classList.add('samostatne');
window.STITKY_UI = { get P() { return P; }, nastavProjekt, zPredlohy, prepniKartu, nactiTabulkuText, importujSoubor, vytvorPdf, pripravTisk, rozlozeni, vykresli: () => vykresli(new Set(['vse'])) };
(async () => {
  prepniKartu(pred.karta);
  vykresli(new Set(['vse']));
  await nactiPisma();
  try {
    const z = await dbNacti('_aktualni');
    if (z && z.projekt) { nastavProjekt(z.projekt); return; }
  } catch (e) { /* IndexedDB nedostupná – jedeme bez ní */ }
  nastavProjekt(zPredlohy('adresa'));
})();
})();

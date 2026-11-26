/* Rozhraní výukové stránky Excel – vzorce. Nad XLV (jadro.js) a XLV_LEKCE (lekce.js). */
(function () {
'use strict';
const X = window.XLV, LEKCE = window.XLV_LEKCE;
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const KLIC = 'webapp_excel_vzorce';
const VYCHOZI = { jazyk: 'cs', lekce: LEKCE[0].id, rezim: 'lekce', hotovo: {}, listy: {}, piskoviste: null };

/* ---------- stav a ukládání ---------- */
let stav;
try { stav = Object.assign({}, VYCHOZI, JSON.parse(localStorage.getItem(KLIC) || '{}')); } catch (e) { stav = { ...VYCHOZI }; }
if (!LEKCE.some(l => l.id === stav.lekce)) stav.lekce = LEKCE[0].id;
function uloz() { try { localStorage.setItem(KLIC, JSON.stringify(stav)); } catch (e) { /* plné úložiště – pokrok se neuloží */ } }

const aktLekce = () => LEKCE.find(l => l.id === stav.lekce);
const jaz = () => stav.jazyk;

function listZLekce(lk) {
  const l = new X.List(lk.list.bunky, { jazyk: 'en', radku: lk.list.radku, sloupcu: lk.list.sloupcu });
  l.prepniJazyk(jaz());
  return l;
}
/* list s uloženými úpravami studenta */
function obnovList(ulozeny, zaklad) {
  if (!ulozeny) return zaklad;
  const u = new X.List({}, { jazyk: ulozeny.jazyk });
  u.bunky = { ...ulozeny.bunky };
  u.prepniJazyk(jaz());
  zaklad.bunky = u.bunky;
  for (const a of Object.keys(u.bunky)) { const p = X.rozeberAdresu(a); if (p) { zaklad.radku = Math.max(zaklad.radku, p.r); zaklad.sloupcu = Math.max(zaklad.sloupcu, p.c); } }
  zaklad.cache = new Map();
  return zaklad;
}
function ulozList() {
  const z = { jazyk: list.jazyk, bunky: list.bunky };
  if (stav.rezim === 'piskoviste') stav.piskoviste = z; else stav.listy[stav.lekce] = z;
  uloz();
}

/* ---------- dílna: proměnné ---------- */
let list = null;          /* X.List */
let vybrana = 'A1';
let edit = false;         /* píše se do řádku vzorců */
let uk = null;            /* {s, e} – adresa vložená ukazováním myší */
let kotva = null, tahUk = false;
let schranka = null;
let vypln = null;         /* tažení úchytu: {z, cile[]} */
const vstup = $('vzorec'), zvyr = $('zvyr'), mrizka = $('mrizka');

function rozmer() {
  if (stav.rezim === 'piskoviste') return { R: Math.max(30, list.radku + 3), C: Math.max(12, list.sloupcu + 2) };
  return { R: list.radku + 2, C: list.sloupcu + 1 };
}
function cileLekce() {
  if (stav.rezim !== 'lekce') return new Map();
  const lk = aktLekce(), m = new Map();
  for (const u of lk.ulohy) m.set(u.cil, !!stav.hotovo[lk.id + '/' + u.id]);
  return m;
}

/* ---------- mřížka ---------- */
function zobrazHodnotu(a) {
  let t = list.zobraz(a);
  const v = list.hodnota(a);
  if (typeof v === 'number' && /\d{11,}/.test(t.replace(/[,.]/, ''))) t = X.fmtCislo(parseFloat(v.toPrecision(10)), list.jazyk);
  return t;
}
function kresliMrizku() {
  const { R, C } = rozmer(), cile = cileLekce();
  let h = '<thead><tr><th class="roh"></th>';
  for (let c = 1; c <= C; c++) h += `<th data-c="${c}">${X.cisloNaSloupec(c)}</th>`;
  h += '</tr></thead><tbody>';
  for (let r = 1; r <= R; r++) {
    h += `<tr><th data-r="${r}">${r}</th>`;
    for (let c = 1; c <= C; c++) {
      const a = X.adresa(r, c), raw = list.surova(a);
      let v = list.hodnota(a);
      if (X.jePole(v)) v = v.h[0][0];
      const tr = [];
      if (typeof v === 'number') tr.push('cis'); else if (typeof v === 'boolean') tr.push('log'); else if (X.jeChyba(v)) tr.push('chy');
      else if (typeof v === 'string' && r === 1 && raw && !raw.startsWith('=')) tr.push('hl');
      if (raw.startsWith('=')) tr.push('vz');
      if (cile.has(a)) { tr.push('cil'); if (cile.get(a)) tr.push('hotova'); }
      const tit = raw.startsWith('=') ? raw : X.jeChyba(v) ? X.CHYBY[v.kod].popis : '';
      h += `<td data-a="${a}" class="${tr.join(' ')}"${tit ? ` title="${esc(tit)}"` : ''}>${esc(zobrazHodnotu(a))}</td>`;
    }
    h += '</tr>';
  }
  mrizka.innerHTML = h + '</tbody>';
  oznac();
}
const td = a => mrizka.querySelector(`td[data-a="${a}"]`);
function oznac() {
  mrizka.querySelectorAll('td.vybr,td.ref,td.vypln').forEach(t => { t.classList.remove('vybr', 'ref', 'vypln'); t.style.removeProperty('--rb'); });
  mrizka.querySelectorAll('th.akt').forEach(t => t.classList.remove('akt'));
  const text = vstup.value;
  X.odkazyVeVzorci(text, list.jazyk).forEach((o, i) => {
    for (let r = o.r1; r <= o.r2; r++) for (let c = o.c1; c <= o.c2; c++) {
      const t = td(X.adresa(r, c)); if (t) { t.classList.add('ref'); t.style.setProperty('--rb', `var(--r${i % 6})`); }
    }
  });
  if (vypln) vypln.cile.forEach(a => td(a)?.classList.add('vypln'));
  const t = td(vybrana), p = X.rozeberAdresu(vybrana);
  if (t) t.classList.add('vybr');
  mrizka.querySelector(`thead th[data-c="${p.c}"]`)?.classList.add('akt');
  mrizka.querySelector(`tbody th[data-r="${p.r}"]`)?.classList.add('akt');
  umistiUchyt();
}
function umistiUchyt() {
  const u = $('uchyt'), t = td(vybrana);
  if (!t) { u.hidden = true; return; }
  u.hidden = false;
  u.style.left = (t.offsetLeft + t.offsetWidth - 6) + 'px';
  u.style.top = (t.offsetTop + t.offsetHeight - 6) + 'px';
}

/* ---------- řádek vzorců: obarvení a nápověda ---------- */
function obarvi(text, jazyk, sOdkazy = true) {
  if (!text.startsWith('=')) return esc(text);
  const tr = new Array(text.length).fill('');
  for (const k of X.tokenyProZvyrazneni(text, jazyk)) {
    const c = k.t === 'name' && /^(TRUE|FALSE|PRAVDA|NEPRAVDA)$/.test(k.v) ? 'k-num'
      : { fn: 'k-fn', str: 'k-str', num: 'k-num', err: 'k-err', chyba: 'k-chyba', op: 'k-op', name: 'k-err' }[k.t];
    if (c) for (let i = k.s; i < Math.min(k.e, text.length); i++) tr[i] = c;
  }
  if (sOdkazy) X.odkazyVeVzorci(text, jazyk).forEach((o, i) => { for (let j = o.s; j < o.e; j++) tr[j] = 'k-r' + (i % 6); });
  let h = '', i = 0;
  while (i < text.length) {
    let j = i; while (j < text.length && tr[j] === tr[i]) j++;
    const kus = esc(text.slice(i, j));
    h += tr[i] ? `<span class="${tr[i]}">${kus}</span>` : kus;
    i = j;
  }
  return h;
}
function prekresliVstup() {
  zvyr.innerHTML = obarvi(vstup.value, list.jazyk) + ' ';
  zvyr.scrollLeft = vstup.scrollLeft;
}
function syntaxeHtml(en, arg) {
  const f = X.FUNKCE[en], odd = X.oddelovac(jaz()) + ' ';
  const a = f.args.map((n, i) => {
    const opak = n.endsWith('…'), akt = arg === i || (opak && arg >= i) || (i === f.args.length - 1 && arg >= f.args.length && opak);
    return akt ? `<b>${esc(n)}</b>` : esc(n);
  });
  return `<span class="syntaxe">${esc(X.nazevFunkce(en, jaz()))}(${a.join(odd)})</span>`;
}
let navrhy = [];
function napoveda() {
  const box = $('napovedaFn');
  navrhy = [];
  if (!edit || !vstup.value.startsWith('=')) { box.innerHTML = ''; return; }
  const n = X.napovedaKurzoru(vstup.value, vstup.selectionStart, list.jazyk);
  let h = '';
  if (n && n.zacatek) {
    navrhy = X.navrhyFunkci(n.zacatek, list.jazyk);
    if (navrhy.length) h = navrhy.map((en, i) => `<button class="btn mini navrh" data-navrh="${en}" title="${esc(X.FUNKCE[en].popis)}">${esc(X.nazevFunkce(en, jaz()))}</button>`).join('') + ' <span>Tab = doplnit první</span>';
  }
  if (!h && n && n.jmeno) {
    if (n.en) h = syntaxeHtml(n.en, n.arg) + ' – ' + esc(X.FUNKCE[n.en].popis);
    else h = `<span class="chyba">Funkci „${esc(n.jmeno)}“ neznám – překlep? (Výsledkem by byla chyba ${esc(X.CHYBY.NAME[jaz()])})</span>`;
  }
  box.innerHTML = h;
}
function doplnNavrh(en) {
  const k = vstup.selectionStart, v = vstup.value;
  const m = /([A-Za-zÀ-ž][\wÀ-ž.]*)$/.exec(v.slice(0, k));
  const z = m ? k - m[1].length : k, jm = X.nazevFunkce(en, jaz()) + '(';
  vstup.value = v.slice(0, z) + jm + v.slice(k);
  vstup.setSelectionRange(z + jm.length, z + jm.length);
  vstup.focus(); edit = true; uk = null;
  poPsani();
}
function poPsani() { prekresliVstup(); napoveda(); oznac(); }

/* ---------- výběr a potvrzení ---------- */
function vyber(a, sRozkladem = true) {
  vybrana = a;
  vstup.value = list.surova(a);
  edit = false; uk = null;
  $('nazevBunky').textContent = a;
  prekresliVstup(); napoveda(); oznac();
  const t = td(a); if (t) t.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  if (sRozkladem) rozkladBunky();
}
function info(t) { $('infoDilny').innerHTML = t; }
function potvrd() {
  const v = vstup.value;
  if (v.startsWith('=')) {
    try { X.rozeber(v, list.jazyk); }
    catch (e) {
      info(`<span style="color:var(--danger)">⚠ ${esc(e.message)}</span> – opravte vzorec, nebo Esc pro zrušení.`);
      vstup.focus();
      if (e.pozice !== undefined) vstup.setSelectionRange(e.pozice, Math.min(e.pozice + 1, v.length));
      return false;
    }
  }
  if (v !== list.surova(vybrana)) {
    list.nastav(vybrana, v);
    ulozList();
    info('');
  }
  edit = false; uk = null;
  kresliMrizku();
  return true;
}
function zrus() { vstup.value = list.surova(vybrana); edit = false; uk = null; info(''); prekresliVstup(); napoveda(); oznac(); mrizka.focus(); }
function posunVyber(dr, dc) {
  const p = X.rozeberAdresu(vybrana), { R, C } = rozmer();
  vyber(X.adresa(Math.min(R, Math.max(1, p.r + dr)), Math.min(C, Math.max(1, p.c + dc))));
}

/* ukazování myší při psaní vzorce */
function lzeUkazovat() {
  if (!edit || !vstup.value.startsWith('=')) return false;
  const k = vstup.selectionStart;
  if (uk && k === uk.e) return true;
  return /[=(;,+\-*/^&<>:]\s*$/.test(vstup.value.slice(0, k));
}
function vlozAdresu(text) {
  const v = vstup.value, k = vstup.selectionStart;
  const s = uk && k === uk.e ? uk.s : k, e = uk && k === uk.e ? uk.e : vstup.selectionEnd;
  vstup.value = v.slice(0, s) + text + v.slice(e);
  uk = { s, e: s + text.length };
  vstup.setSelectionRange(uk.e, uk.e);
  poPsani();
}
function oblastText(a, b) {
  if (a === b) return a;
  const p = X.rozeberAdresu(a), q = X.rozeberAdresu(b);
  return X.adresa(Math.min(p.r, q.r), Math.min(p.c, q.c)) + ':' + X.adresa(Math.max(p.r, q.r), Math.max(p.c, q.c));
}

mrizka.addEventListener('mousedown', e => {
  const t = e.target.closest('td[data-a]'); if (!t) return;
  if (lzeUkazovat()) {
    e.preventDefault();
    kotva = t.dataset.a; tahUk = true;
    vlozAdresu(kotva);
    return;
  }
  if (edit && !potvrd()) { e.preventDefault(); return; }
  e.preventDefault();
  mrizka.focus();
  vyber(t.dataset.a);
});
mrizka.addEventListener('mouseover', e => {
  if (!tahUk) return;
  const t = e.target.closest('td[data-a]'); if (t) vlozAdresu(oblastText(kotva, t.dataset.a));
});
document.addEventListener('mouseup', () => { tahUk = false; });
mrizka.addEventListener('dblclick', e => {
  const t = e.target.closest('td[data-a]'); if (!t) return;
  vstup.focus(); vstup.setSelectionRange(vstup.value.length, vstup.value.length); edit = true; poPsani();
});

mrizka.addEventListener('keydown', e => {
  const k = e.key;
  if (e.ctrlKey || e.metaKey) {
    if (k === 'c' || k === 'C') { schranka = vybrana; info(`Zkopírováno ${vybrana}. Vyberte cíl a stiskněte Ctrl+V.`); e.preventDefault(); }
    else if ((k === 'v' || k === 'V') && schranka) { vlozKopii(schranka, [vybrana]); e.preventDefault(); }
    return;
  }
  const pohyb = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1], Enter: [e.shiftKey ? -1 : 1, 0], Tab: [0, e.shiftKey ? -1 : 1] }[k];
  if (pohyb) { e.preventDefault(); posunVyber(...pohyb); return; }
  if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); vstup.value = ''; potvrd(); vyber(vybrana); return; }
  if (k === 'F2') { e.preventDefault(); vstup.focus(); edit = true; vstup.setSelectionRange(vstup.value.length, vstup.value.length); poPsani(); return; }
  if (k.length === 1 && !e.altKey) { e.preventDefault(); vstup.value = k; vstup.focus(); vstup.setSelectionRange(1, 1); edit = true; uk = null; poPsani(); }
});

vstup.addEventListener('focus', () => { edit = true; napoveda(); });
vstup.addEventListener('input', () => { edit = true; uk = null; poPsani(); });
['keyup', 'click', 'scroll', 'select'].forEach(t => vstup.addEventListener(t, () => { zvyr.scrollLeft = vstup.scrollLeft; if (t !== 'scroll') napoveda(); }));
vstup.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); if (potvrd()) { mrizka.focus(); posunVyber(e.shiftKey ? -1 : 1, 0); } }
  else if (e.key === 'Tab') {
    e.preventDefault();
    if (navrhy.length && !e.shiftKey) return doplnNavrh(navrhy[0]);
    if (potvrd()) { mrizka.focus(); posunVyber(0, e.shiftKey ? -1 : 1); }
  }
  else if (e.key === 'Escape') { e.preventDefault(); zrus(); }
  else if (e.key === 'F4') {
    e.preventDefault();
    const r = X.prepniAbsolutni(vstup.value, vstup.selectionStart);
    if (r) { vstup.value = r.text; vstup.setSelectionRange(r.kurzor, r.kurzor); uk = null; poPsani(); }
  }
});
$('napovedaFn').addEventListener('mousedown', e => {
  const b = e.target.closest('[data-navrh]'); if (b) { e.preventDefault(); doplnNavrh(b.dataset.navrh); }
});

/* ---------- kopírování (úchyt, Ctrl+V) ---------- */
function vlozKopii(z, cile) {
  const pred = list.surova(z);
  cile.forEach(a => { if (a !== z) list.kopiruj(z, a); });
  ulozList(); kresliMrizku();
  cile.forEach(a => td(a)?.classList.add('blik'));
  if (pred.startsWith('=')) {
    const ukazka = cile.filter(a => a !== z).slice(0, 3).map(a => `<code>${a}: ${esc(list.surova(a))}</code>`).join(', ');
    info(`Zkopírováno z ${z} (<code>${esc(pred)}</code>) → ${ukazka}${cile.length > 4 ? ' …' : ''}. Relativní odkazy se posunuly, ukotvené ($) ne.`);
  } else info(`Zkopírována hodnota z ${z}.`);
}
const uchyt = $('uchyt');
uchyt.addEventListener('pointerdown', e => {
  if (edit && !potvrd()) return;
  e.preventDefault();
  try { uchyt.setPointerCapture(e.pointerId); } catch (er) { /* syntetická událost */ }
  vypln = { z: vybrana, cile: [] };
});
uchyt.addEventListener('pointermove', e => {
  if (!vypln) return;
  const t = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('td[data-a]'); if (!t) return;
  const p = X.rozeberAdresu(vypln.z), q = X.rozeberAdresu(t.dataset.a), cile = [];
  if (Math.abs(q.r - p.r) >= Math.abs(q.c - p.c)) for (let r = Math.min(p.r, q.r); r <= Math.max(p.r, q.r); r++) cile.push(X.adresa(r, p.c));
  else for (let c = Math.min(p.c, q.c); c <= Math.max(p.c, q.c); c++) cile.push(X.adresa(p.r, c));
  vypln.cile = cile; oznac();
});
uchyt.addEventListener('pointerup', () => {
  if (!vypln) return;
  const { z, cile } = vypln; vypln = null;
  if (cile.length > 1) vlozKopii(z, cile); else oznac();
});
uchyt.addEventListener('dblclick', () => {
  const p = X.rozeberAdresu(vybrana), cile = [vybrana];
  const soused = p.c > 1 ? p.c - 1 : p.c + 1;
  for (let r = p.r + 1; list.surova(X.adresa(r, soused)) !== ''; r++) cile.push(X.adresa(r, p.c));
  if (cile.length > 1) vlozKopii(vybrana, cile);
});
new ResizeObserver(() => umistiUchyt()).observe($('mrizkaObal'));

/* ---------- rozklad vzorce ---------- */
let rz = null, zalozka = 'kroky', prehravani = null;
const NAZVY_UZLU = { num: 'číslo', str: 'text', bool: 'logická hodnota', err: 'chybová hodnota', ref: 'odkaz na buňku', range: 'oblast buněk',
  jmeno: 'neznámý název', prazdny: 'vynechaný argument', un: 'znaménko', pct: 'procento',
  op: { '+': 'sčítání', '-': 'odčítání', '*': 'násobení', '/': 'dělení', '^': 'mocnina', '&': 'spojení textů', '=': 'porovnání =', '<>': 'porovnání ≠', '<': 'porovnání <', '>': 'porovnání >', '<=': 'porovnání ≤', '>=': 'porovnání ≥' } };
const lit = v => X.literal(X.jePole(v) && !v.r1 ? v.h[0][0] : v, list.jazyk);

function rozkladBunky() {
  const raw = list.surova(vybrana);
  if (raw.startsWith('=')) return nastavRozklad(raw, { zdroj: 'bunka' });
  zastavPrehravani();
  rz = null;
  $('rzZdroj').textContent = '';
  let t;
  const v = list.hodnota(vybrana);
  if (!raw) t = `Buňka ${vybrana} je prázdná. Napište do ní hodnotu nebo vzorec začínající <kbd>=</kbd>.`;
  else if (typeof v === 'number' && list.jeDatum(vybrana)) t = `Buňka ${vybrana} obsahuje <b>datum</b> ${esc(list.zobraz(vybrana))}. Excel si ho pamatuje jako číslo dne <code>${v}</code>.`;
  else if (typeof v === 'number') t = `Buňka ${vybrana} obsahuje <b>číslo</b> ${esc(list.zobraz(vybrana))} (zarovnané doprava).`;
  else if (typeof v === 'boolean') t = `Buňka ${vybrana} obsahuje <b>logickou hodnotu</b> ${esc(list.zobraz(vybrana))}.`;
  else t = `Buňka ${vybrana} obsahuje <b>text</b> (zarovnaný doleva). S textem se nedá počítat – <code>${esc(vybrana)}+1</code> by dalo chybu ${esc(X.CHYBY.VALUE[jaz()])}.`;
  $('rzTelo').innerHTML = `<p class="rz-prazdne">${t}</p><p class="rz-prazdne">Vyberte buňku se vzorcem (mají zelený roh), nebo klikněte na ukázku vzorce ve výkladu.</p>`;
}
function nastavRozklad(vzorec, o = {}) {
  zastavPrehravani();
  try {
    const r = list.kroky(vzorec);
    rz = { ...r, vzorec, zdroj: o.zdroj || 'bunka', i: o.konec ? r.kroky.length : 0 };
  } catch (e) { rz = { vzorec, zdroj: o.zdroj, chybaZapisu: e.message }; }
  kresliRozklad();
}
function kresliRozklad() {
  document.querySelectorAll('.rz-hlava .zal').forEach(b => b.setAttribute('aria-selected', String(b.dataset.zal === zalozka)));
  if (!rz) return rozkladBunky();
  $('rzZdroj').innerHTML = rz.zdroj === 'ukazka'
    ? `ukázka <button class="btn mini" id="btnVlozUkazku" title="Vloží ukázkový vzorec do vybrané buňky">Vložit do ${vybrana}</button>`
    : `buňka ${vybrana}`;
  const telo = $('rzTelo');
  if (rz.chybaZapisu) { telo.innerHTML = `<div class="vyraz">${obarvi(rz.vzorec, list.jazyk)}</div><div class="chyba-box">⚠ Chyba zápisu: ${esc(rz.chybaZapisu)}</div>`; return; }
  telo.innerHTML = zalozka === 'kroky' ? htmlKroky() : zalozka === 'strom' ? htmlStrom() : htmlFunkce();
  telo.querySelector('.kroky li.akt')?.scrollIntoView({ block: 'nearest' });
}
function htmlKroky() {
  const { kroky, strom } = rz, n = kroky.length, i = rz.i;
  const hodnoty = new Map(kroky.slice(0, i).map(k => [k.uzel, k.hodnota]));
  const posl = kroky[i - 1]?.uzel, dalsi = kroky[i]?.uzel;
  const obal = (u, x, jeH) => jeH ? `<span class="${u === posl ? 'nove' : 'hod'}">${x}</span>` : u === dalsi ? `<span class="dalsi">${x}</span>` : x;
  const vyraz = '=' + X.vykresli(strom, { jazyk: list.jazyk, hodnoty, esc, obal });
  let h = `<div class="vyraz${i === n ? ' konec' : ''}">${vyraz}</div>`;
  if (!n) return h + `<p class="popis-kroku">Ve vzorci není co vyhodnocovat – výsledek je rovnou <code>${esc(lit(rz.vysledek))}</code>.</p>`;
  h += `<div class="rz-ovl">
    <button class="btn mini" data-krok="0" title="Na začátek" ${i === 0 ? 'disabled' : ''}>⏮</button>
    <button class="btn mini" data-krok="${i - 1}" title="O krok zpět" ${i === 0 ? 'disabled' : ''}>◀</button>
    <button class="btn hlavni mini" data-krok="${i + 1}" title="Vyhodnotit podtrženou část" ${i === n ? 'disabled' : ''}>Vyhodnotit ▶</button>
    <button class="btn mini" data-krok="${n}" title="Rovnou výsledek" ${i === n ? 'disabled' : ''}>⏭</button>
    <button class="btn mini" id="btnPrehraj" title="Přehrát všechny kroky">${prehravani ? '⏸ Zastavit' : '▶▶ Přehrát'}</button>
    <span class="cit">krok ${i} z ${n}</span></div>`;
  let p = i === 0 ? 'Výchozí vzorec. <b>Podtržená</b> část se vyhodnotí jako první – Excel počítá zevnitř ven a zleva doprava.'
    : `<b>Krok ${i}:</b> ${esc(kroky[i - 1].popis)}`;
  if (dalsi) p += `<br><span style="color:var(--text-muted)">Další na řadě: <span class="co">${esc(X.vykresli(dalsi, { jazyk: list.jazyk }))}</span></span>`;
  else p += `<br><b>Výsledek: <span class="co">${esc(lit(rz.vysledek))}</span></b>`;
  h += `<div class="popis-kroku">${p}</div>`;
  if (X.jeChyba(rz.vysledek) || (X.jePole(rz.vysledek) && X.jeChyba(rz.vysledek.h[0][0]))) {
    const ch = X.jePole(rz.vysledek) ? rz.vysledek.h[0][0] : rz.vysledek;
    const prvni = kroky.findIndex(k => X.jeChyba(k.hodnota) && !(k.uzel.t === 'ref'));
    h += `<div class="chyba-box"><b>${esc(X.CHYBY[ch.kod][jaz()])}</b> – ${esc(X.CHYBY[ch.kod].popis)}${prvni >= 0 ? ` Chyba vznikla v <a href="#" data-krok="${prvni + 1}">kroku ${prvni + 1}</a>.` : ''}</div>`;
  }
  h += '<ol class="kroky">' + kroky.map((k, j) =>
    `<li data-krok="${j + 1}" class="${j === i - 1 ? 'akt' : ''}"><code>${esc(X.vykresli(k.uzel, { jazyk: list.jazyk }))}</code> → <span class="vys">${esc(lit(k.hodnota))}</span> <span class="ppis">${esc(k.popis)}</span></li>`).join('') + '</ol>';
  if (X.jePole(rz.vysledek) && !rz.vysledek.r1) h += '<p class="rz-prazdne">Výsledkem je pole hodnot. Excel 365 by ho „rozlil“ do sousedních buněk, tady se v buňce ukazuje první hodnota.</p>';
  return h;
}
function nazevArgumentu(f, i) {
  const a = f.args;
  if (i < a.length) return a[i].replace(/[[\]…]/g, '');
  const opak = a.filter(x => x.endsWith('…')).length || 1;
  const vzor = a[a.length - opak + ((i - a.length) % opak)];
  const zaklad = vzor.replace(/[[\]…]/g, '').replace(/\d+$/, '');
  return zaklad + (/\d/.test(vzor) ? Math.floor(i / opak) + 1 : '');
}
function htmlStrom() {
  const vse = new Map(rz.kroky.map((k, j) => [k.uzel, { v: k.hodnota, j }]));
  function uzel(u, stitek) {
    if (u.t === 'zav') return uzel(u.x, stitek ? stitek + ' (v závorce)' : 'v závorce');
    let typ = u.t === 'op' ? NAZVY_UZLU.op[u.op] : NAZVY_UZLU[u.t], deti = [];
    if (u.t === 'fn') {
      const f = u.en && X.FUNKCE[u.en];
      typ = f ? `funkce ${X.nazevFunkce(u.en, jaz())} – ${f.popis.replace(/\.$/, '')}` : `neznámá funkce ${u.jmeno}`;
      deti = u.args.map((x, i) => [x, f ? nazevArgumentu(f, i) : (i + 1) + '. argument']);
    } else if (u.t === 'op') deti = [[u.l, 'vlevo'], [u.r, 'vpravo']];
    else if (u.t === 'un' || u.t === 'pct') deti = [[u.x, 'hodnota']];
    const z = vse.get(u);
    const list_ = ['num', 'str', 'bool', 'err', 'prazdny'].includes(u.t);
    const hod = z ? `<span class="hod">= ${esc(lit(z.v))}</span>` : list_ ? '' : '<span class="nevyh">nevyhodnoceno (větev se nepočítala)</span>';
    return `<div class="uzel t-${u.t}"><div class="uzel-h"${z ? ` data-krok="${z.j}"` : ''}>${stitek ? `<span class="arg">${esc(stitek)}</span>` : ''}<code>${obarvi('=' + X.vykresli(u, { jazyk: list.jazyk }), list.jazyk, false).replace(/^=/, '')}</code><span class="typ">${esc(typ)}</span>${hod}</div>${deti.length ? deti.map(([d, s]) => uzel(d, s)).join('') : ''}</div>`;
  }
  return `<p class="rz-prazdne" style="margin-top:0">Každý řádek je část vzorce, odsazené řádky jsou její argumenty. Kliknutím na řádek přejdete na jeho krok.</p><div class="strom">${uzel(rz.strom, '')}</div>`;
}
function htmlFunkce() {
  const { fn } = X.rozborStromu(rz.strom);
  if (!fn.size) return '<p class="rz-prazdne">Vzorec nepoužívá žádnou funkci, jen operátory a odkazy.</p>';
  return [...fn].map(en => {
    const f = X.FUNKCE[en];
    return `<div class="fn-karta"><div class="syn">${syntaxeHtml(en, -1)}</div><div>${esc(f.popis)}</div>
      <div style="font-size:.78rem;color:var(--text-muted)">${esc(f.kat)} · česky <b>${esc(f.cs)}</b>, anglicky <b>${esc(f.en)}</b> · argumenty v [hranatých závorkách] jsou nepovinné</div></div>`;
  }).join('');
}
function zastavPrehravani() { if (prehravani) { clearInterval(prehravani); prehravani = null; } }
$('rozklad').addEventListener('click', e => {
  const z = e.target.closest('[data-zal]');
  if (z) { zalozka = z.dataset.zal; return kresliRozklad(); }
  if (e.target.id === 'btnVlozUkazku' && rz) { vstup.value = rz.vzorec; potvrd(); vyber(vybrana); return; }
  if (e.target.id === 'btnPrehraj') {
    if (prehravani) { zastavPrehravani(); return kresliRozklad(); }
    if (rz.i >= rz.kroky.length) rz.i = 0;
    prehravani = setInterval(() => { rz.i++; if (rz.i >= rz.kroky.length) zastavPrehravani(); kresliRozklad(); }, 1100);
    return kresliRozklad();
  }
  const k = e.target.closest('[data-krok]');
  if (k && rz && !rz.chybaZapisu) {
    e.preventDefault(); zastavPrehravani();
    rz.i = Math.max(0, Math.min(rz.kroky.length, +k.dataset.krok));
    if (k.classList.contains('uzel-h')) zalozka = 'kroky';
    kresliRozklad();
  }
});

/* ---------- výklad lekce ---------- */
function zpracuj(t) {
  return t
    .replace(/<table class="tab">/g, '<div class="tabulka-obal"><table class="tab">').replace(/<\/table>/g, '</table></div>')
    .replace(/\[\[@([A-Z]+\d+)\]\]/g, (m, a) => `<button class="adr" data-adr="${a}" title="Vybrat buňku ${a} v listu">${a}</button>`)
    .replace(/\[\[(=[\s\S]*?)\]\](?!\])/g, (m, f) => cip(f))
    .replace(/\{;\}/g, X.oddelovac(jaz()))
    .replace(/\{([A-Z][A-Z.]*)\}/g, (m, en) => X.FUNKCE[en] ? `<b class="fn">${esc(X.nazevFunkce(en, jaz()))}</b>` : m);
}
function cip(f) {
  const v = X.prelozVzorec(f, 'en', jaz());
  return `<button class="vz" data-vz="${esc(v)}" title="Rozložit v dílně">${obarvi(v, jaz(), false)}</button>`;
}
const klic = u => stav.lekce + '/' + u.id;
function pocty(lk) { return { hot: lk.ulohy.filter(u => stav.hotovo[lk.id + '/' + u.id]).length, vse: lk.ulohy.length }; }
function kresliPostup() {
  let hot = 0, vse = 0;
  LEKCE.forEach(l => { const p = pocty(l); hot += p.hot; vse += p.vse; });
  $('postup').innerHTML = `Splněno <b>${hot}</b> / ${vse} úloh`;
}
function kresliVyklad() {
  const v = $('vyklad');
  if (stav.rezim === 'piskoviste') { v.innerHTML = htmlPiskoviste(); return; }
  const lk = aktLekce(), i = LEKCE.indexOf(lk);
  let h = `<div class="podtitul">Lekce ${i + 1} z ${LEKCE.length}</div><h2>${lk.emoji} ${esc(lk.nazev)}</h2>
    <div class="cile"><b>Po lekci budete umět:</b><ul>${lk.cile.map(c => `<li>${esc(c)}</li>`).join('')}</ul></div>`;
  h += zpracuj(lk.text);
  if (lk.predpovez.length) {
    h += `<div class="oddil"><h3>🤔 Co vrátí vzorec?</h3><p>Nejdřív si výsledek tipněte, pak ověřte. Vzorce počítají s daty z listu vpravo.</p><div class="predpovedi">`;
    lk.predpovez.forEach((p, j) => { h += htmlPredpoved(lk, p, j); });
    h += '</div></div>';
  }
  if (lk.ulohy.length) {
    h += `<div class="oddil"><h3>✍️ Úlohy</h3><p>Vzorec napište do vyznačené (šrafované) buňky v listu a pak klikněte na <b>Zkontrolovat</b>.
      Kontrola vzorec vyzkouší i se změněnými daty.</p>`;
    lk.ulohy.forEach((u, j) => { h += htmlUloha(u, j); });
    h += '</div>';
  }
  const pred = LEKCE[i - 1], dal = LEKCE[i + 1];
  h += `<div class="nav-lekce">${pred ? `<button class="btn" data-lekce="${pred.id}">◀ ${esc(pred.nazev)}</button>` : '<span></span>'}
    ${dal ? `<button class="btn hlavni" data-lekce="${dal.id}">${esc(dal.nazev)} ▶</button>` : '<button class="btn hlavni" data-rezim-tl="piskoviste">🧪 Do pískoviště</button>'}</div>`;
  v.innerHTML = h;
}
function htmlUloha(u, j) {
  const hot = !!stav.hotovo[klic(u)];
  return `<div class="uloha${hot ? ' hotovo' : ''}" data-uloha="${u.id}">
    <div class="u-hlava"><span>Úloha ${j + 1} · buňka <button class="adr" data-adr="${u.cil}">${u.cil}</button>${u.kopirovat ? ` · kopírovat do ${u.kopirovat}` : ''}</span>${hot ? '<span class="ok">✓ splněno</span>' : ''}</div>
    <div class="u-zad">${zpracuj(u.zadani)}</div>
    <div class="u-akce">
      <button class="btn hlavni mini" data-akce="zkontroluj">✔ Zkontrolovat</button>
      <button class="btn mini" data-akce="napoveda" ${u.napovedy?.length ? '' : 'disabled'}>💡 Nápověda</button>
      <button class="btn mini" data-akce="reseni">👁 Ukázat řešení</button>
    </div>
    <div class="u-napovedy" data-n="0"></div><div class="u-vysl"></div></div>`;
}
function htmlPredpoved(lk, p, j) {
  const k = `p:${lk.id}:${j}`, hot = !!stav.hotovo[k];
  const otazka = p.z
    ? `Buňka <b>${p.z}</b> obsahuje ${cip(p.vzorec)}. Zkopírujete ji do <b>${p.na}</b>. Jaký vzorec tam bude?`
    : `Co vrátí ${cip(p.vzorec)}?`;
  return `<div class="predp${hot ? ' spravne' : ''}" data-predp="${j}"><div class="otazka">${otazka}</div>
    <div class="radek"><input class="vstup" placeholder="${p.z ? 'vzorec, např. =A1' : 'výsledek'}" aria-label="Odpověď"><button class="btn mini" data-akce="over">Ověřit</button></div><div class="vysl">${hot ? '✓ už jste uhodli' : ''}</div></div>`;
}
function htmlPiskoviste() {
  const ukazky = ['=SUM(A1:A5)', '=AVERAGE(A1:A5)', '=IF(A1>10,"velké","malé")', '=REPT("■",A1)', '=TEXT(TODAY(),"dddd d. mmmm yyyy")',
    '=DATE(2026,12,24)-TODAY()', '=UPPER(LEFT("excel",1))&MID("excel",2,10)', '=SUMPRODUCT(A1:A3,B1:B3)', '=CHOOSE(WEEKDAY(TODAY(),2),"po","út","st","čt","pá","so","ne")'];
  return `<h2>🧪 Pískoviště</h2>
    <p>Volný list na zkoušení čehokoli. Obsah se ukládá v tomto prohlížeči. Vpravo nahoře můžete načíst list kterékoli lekce
    a pokračovat v něm po svém.</p>
    <div class="tip">Každý vzorec v listu se po výběru buňky rozloží v dílně – <b>krok za krokem</b>, jako <i>Vyhodnotit vzorec</i> v Excelu.</div>
    <h3>Nápady na vyzkoušení</h3>
    <p>Klikněte na ukázku – rozloží se v dílně a tlačítkem „Vložit do…“ ji dostanete do vybrané buňky.</p>
    <p>${ukazky.map(u => cip(u)).join(' ')}</p>
    <h3>Ovládání</h3>
    <ul><li>Psaní: vyberte buňku a pište; <kbd>Enter</kbd> potvrdí, <kbd>Esc</kbd> zruší.</li>
    <li>Ukazování: při psaní vzorce klikněte na buňku nebo tažením označte oblast.</li>
    <li><kbd>F4</kbd> přepíná $ u adresy pod kurzorem. <kbd>F2</kbd> upraví buňku.</li>
    <li>Kopírování: čtvereček v rohu buňky, nebo <kbd>Ctrl+C</kbd> / <kbd>Ctrl+V</kbd>.</li>
    <li>Text začínající číslicí uložíte jako text apostrofem: <code>'007</code>.</li></ul>
    <p>Přehled všech funkcí je v <button class="btn mini" data-rezim-tl="tahak">📚 Taháku</button>.</p>`;
}
function rozsahAdres(o) {
  const [a, b] = o.split(':'), p = X.rozeberAdresu(a), q = X.rozeberAdresu(b || a), out = [];
  for (let r = p.r; r <= q.r; r++) for (let c = p.c; c <= q.c; c++) out.push(X.adresa(r, c));
  return out;
}
function zkontrolujUlohu(u, karta) {
  if (edit && !potvrd()) return;
  const r = X.zkontroluj(list, u, list.surova(u.cil));
  const box = karta.querySelector('.u-vysl');
  box.innerHTML = `<div class="zprava ${r.ok ? 'ok' : 'ne'}">${r.ok ? '🎉 ' : '✗ '}${esc(r.zprava)}</div>`;
  if (!r.ok) { vyber(u.cil); return; }
  stav.hotovo[klic(u)] = true; uloz();
  if (u.kopirovat) rozsahAdres(u.kopirovat).forEach(a => { if (a !== u.cil && !list.surova(a)) list.kopiruj(u.cil, a); });
  ulozList(); kresliMrizku(); vyber(u.cil);
  karta.classList.add('hotovo');
  if (!karta.querySelector('.ok')) karta.querySelector('.u-hlava').insertAdjacentHTML('beforeend', '<span class="ok">✓ splněno</span>');
  kresliPostup(); kresliMenu();
}
function overPredpoved(lk, j, karta) {
  const p = lk.predpovez[j], odp = karta.querySelector('input').value.trim(), box = karta.querySelector('.vysl');
  if (!odp) { box.textContent = 'Napište odpověď.'; return; }
  const vz = X.prelozVzorec(p.vzorec, 'en', jaz());
  let ok, spravne;
  if (p.z) {
    const a = X.rozeberAdresu(p.z), b = X.rozeberAdresu(p.na);
    spravne = X.posunVzorec(vz, b.r - a.r, b.c - a.c, jaz());
    const norm = s => { try { return '=' + X.vykresli(X.rozeber(s.startsWith('=') ? s : '=' + s, jaz()), { jazyk: jaz() }); } catch (e) { return s.replace(/\s/g, '').toUpperCase(); } };
    ok = norm(odp) === spravne;
  } else {
    let v = list.kroky(vz).vysledek;
    if (X.jePole(v)) v = v.h[0][0];
    spravne = X.literal(v, jaz());
    if (X.jeChyba(v)) ok = [X.CHYBY[v.kod].cs, X.CHYBY[v.kod].en].includes(odp.toUpperCase().replace(/\s/g, ''));
    else {
      let o = list.konstanta(odp.replace(/^"(.*)"$/s, '$1'));
      if (typeof v === 'number' && typeof o === 'number') ok = Math.abs(o - v) < 1e-9 || (/[.,]\d/.test(odp) && Math.abs(o - v) < 0.006);
      else ok = o === v;
    }
  }
  box.innerHTML = ok ? `✓ Správně: <code>${esc(spravne)}</code>` : `✗ Správně je <code>${esc(spravne)}</code>. <a href="#" data-akce="postup">Ukázat postup</a>`;
  if (ok) { stav.hotovo[`p:${lk.id}:${j}`] = true; uloz(); karta.classList.add('spravne'); }
  else karta.classList.remove('spravne');
}
function ukazDilnu() { if (matchMedia('(max-width:980px)').matches) $('dilna').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
$('vyklad').addEventListener('click', e => {
  const vz = e.target.closest('button.vz');
  if (vz) { nastavRozklad(vz.dataset.vz, { zdroj: 'ukazka' }); ukazDilnu(); return; }
  const ad = e.target.closest('[data-adr]');
  if (ad) { if (edit && !potvrd()) return; vyber(ad.dataset.adr); td(ad.dataset.adr)?.classList.add('blik'); mrizka.focus({ preventScroll: true }); ukazDilnu(); return; }
  const lk = e.target.closest('[data-lekce]');
  if (lk) return otevriLekci(lk.dataset.lekce);
  const rt = e.target.closest('[data-rezim-tl]');
  if (rt) return nastavRezim(rt.dataset.rezimTl);
  const a = e.target.closest('[data-akce]'); if (!a) return;
  const lekce = aktLekce();
  const karta = a.closest('.uloha'), kp = a.closest('.predp');
  if (kp) {
    const j = +kp.dataset.predp;
    if (a.dataset.akce === 'over') overPredpoved(lekce, j, kp);
    if (a.dataset.akce === 'postup') { e.preventDefault(); nastavRozklad(X.prelozVzorec(lekce.predpovez[j].vzorec, 'en', jaz()), { zdroj: 'ukazka' }); ukazDilnu(); }
    return;
  }
  if (!karta) return;
  const u = lekce.ulohy.find(x => x.id === karta.dataset.uloha);
  const akce = a.dataset.akce;
  if (akce === 'zkontroluj') zkontrolujUlohu(u, karta);
  else if (akce === 'napoveda') {
    const box = karta.querySelector('.u-napovedy'), n = +box.dataset.n;
    if (n < u.napovedy.length) { box.insertAdjacentHTML('beforeend', `<p>💡 ${zpracuj(u.napovedy[n])}</p>`); box.dataset.n = n + 1; }
    if (n + 1 >= u.napovedy.length) a.disabled = true;
  } else if (akce === 'reseni') {
    karta.querySelector('.u-vysl').innerHTML = `<div class="zprava">Jedno z možných řešení: ${cip(u.reseni)}
      <button class="btn mini" data-akce="vloz">Vložit do ${u.cil}</button><br><small>Správných zápisů bývá víc – kontrola hodnotí výsledek, ne přesný text.</small></div>`;
  } else if (akce === 'vloz') {
    list.nastav(u.cil, X.prelozVzorec(u.reseni, 'en', jaz())); ulozList(); kresliMrizku(); vyber(u.cil);
  }
});
$('vyklad').addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.matches('.predp input')) { e.preventDefault(); const k = e.target.closest('.predp'); overPredpoved(aktLekce(), +k.dataset.predp, k); }
});

/* ---------- tahák ---------- */
const KATEGORIE = ['Matematika', 'Statistika', 'Logické', 'Podmíněné', 'Vyhledávání', 'Text', 'Datum', 'Informační'];
function kresliTahak(filtr = '') {
  const f = filtr.trim().toLowerCase();
  let h = `<h2>📚 Tahák funkcí</h2><div class="filtr"><input class="vstup" id="tahakFiltr" type="search" placeholder="Hledat funkci (česky, anglicky, popis)…" value="${esc(filtr)}" style="flex:1;min-width:200px"></div>
    <p>Zápis odpovídá přepínači <b>Zápis vzorců</b>: argumenty se v českém Excelu oddělují středníkem <code>;</code>, v anglickém čárkou <code>,</code>.
    Argumenty v [hranatých závorkách] jsou nepovinné. Tlačítko 🧪 otevře funkci v pískovišti.</p>`;
  for (const kat of KATEGORIE) {
    const fns = Object.values(X.FUNKCE).filter(x => x.kat === kat && (!f || [x.cs, x.en, x.popis].some(t => t.toLowerCase().includes(f))));
    if (!fns.length) continue;
    h += `<h3>${esc(kat)}</h3><div class="tabulka-obal"><table class="tab"><tr><th>Česky</th><th>Anglicky</th><th>Zápis</th><th>Co dělá</th><th></th></tr>` +
      fns.map(x => `<tr><td class="nz">${esc(x.cs)}</td><td class="nz">${esc(x.en)}</td><td class="syn">${syntaxeHtml(x.en, -1)}</td><td>${esc(x.popis)}</td>
        <td><button class="btn mini" data-zkus="${x.en}" title="Zkusit v pískovišti">🧪</button></td></tr>`).join('') + '</table></div>';
  }
  if (!f || 'chyba error'.includes(f)) {
    h += '<h3>Chybové hodnoty</h3><div class="tabulka-obal"><table class="tab"><tr><th>Česky</th><th>Anglicky</th><th>Význam</th></tr>' +
      Object.values(X.CHYBY).map(c => `<tr><td class="nz">${esc(c.cs)}</td><td class="nz">${esc(c.en)}</td><td>${esc(c.popis)}</td></tr>`).join('') + '</table></div>';
  }
  const t = $('tahak'); t.innerHTML = h;
  const vst = $('tahakFiltr'); vst.addEventListener('input', () => { const k = vst.selectionStart; kresliTahak(vst.value); const n = $('tahakFiltr'); n.focus(); n.setSelectionRange(k, k); });
}
$('tahak').addEventListener('click', e => {
  const b = e.target.closest('[data-zkus]'); if (!b) return;
  nastavRezim('piskoviste');
  let a = 'A1';
  for (let r = 1; r < 200 && list.surova(a); r++) a = 'A' + (r + 1);
  vyber(a);
  vstup.value = '=' + X.nazevFunkce(b.dataset.zkus, jaz()) + '(';
  vstup.focus(); vstup.setSelectionRange(vstup.value.length, vstup.value.length); edit = true; poPsani();
});

/* ---------- režimy, lekce, menu ---------- */
function kresliMenu() {
  $('nabLekce').innerHTML = LEKCE.map((l, i) => {
    const p = pocty(l);
    return `<button class="tl${l.id === stav.lekce && stav.rezim === 'lekce' ? ' aktivni' : ''}" data-lekce="${l.id}">${i + 1}. ${l.emoji} ${esc(l.nazev)}<span class="n${p.hot === p.vse ? ' plne' : ''}">${p.hot === p.vse ? '✓' : p.hot + '/' + p.vse}</span></button>`;
  }).join('');
  const i = LEKCE.indexOf(aktLekce());
  $('nazevLekceLista').textContent = ` ${i + 1}. ${aktLekce().nazev}`;
  $('btnPred').disabled = i === 0;
  $('btnDalsi').disabled = i === LEKCE.length - 1;
}
function otevriLekci(id) {
  if (edit) potvrd();
  stav.lekce = id; uloz();
  nastavRezim('lekce');
  window.scrollTo(0, 0); $('vyklad').scrollTop = 0;
}
function nastavRezim(r) {
  zastavPrehravani();
  stav.rezim = r; uloz();
  document.querySelectorAll('[data-rezim]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.rezim === r)));
  const tahak = r === 'tahak';
  $('tahak').hidden = !tahak; $('vyklad').hidden = tahak; $('dilna').hidden = tahak;
  $('rozlozeni').classList.toggle('jen-dilna', r === 'piskoviste');
  kresliMenu(); kresliPostup();
  if (tahak) { kresliTahak(); return; }
  if (r === 'piskoviste') {
    list = obnovList(stav.piskoviste, new X.List({}, { jazyk: jaz(), radku: 1, sloupcu: 1 }));
    $('popisListu').textContent = 'Pískoviště – volný list';
    $('nactiData').hidden = false;
  } else {
    const lk = aktLekce();
    list = obnovList(stav.listy[lk.id], listZLekce(lk));
    $('popisListu').textContent = `List lekce: ${lk.nazev}`;
    $('nactiData').hidden = true;
  }
  info('');
  kresliVyklad();
  kresliMrizku();
  let start = 'A1';
  if (r === 'lekce') {
    const lk = aktLekce();
    start = Object.keys(lk.list.bunky).find(a => String(lk.list.bunky[a]).startsWith('=')) || lk.ulohy[0]?.cil || 'A1';
  }
  vyber(start);
}
$('btnPred').addEventListener('click', () => { const i = LEKCE.indexOf(aktLekce()); if (i > 0) otevriLekci(LEKCE[i - 1].id); });
$('btnDalsi').addEventListener('click', () => { const i = LEKCE.indexOf(aktLekce()); if (i < LEKCE.length - 1) otevriLekci(LEKCE[i + 1].id); });
document.querySelectorAll('[data-rezim]').forEach(b => b.addEventListener('click', () => { if (edit) potvrd(); nastavRezim(b.dataset.rezim); }));
$('nabLekce').addEventListener('click', e => { const b = e.target.closest('[data-lekce]'); if (b) { zavriNabidky(); otevriLekci(b.dataset.lekce); } });

function zavriNabidky() {
  document.querySelectorAll('.nabidka:not([hidden])').forEach(n => { n.hidden = true; });
  document.querySelectorAll('[data-nabidka]').forEach(b => b.setAttribute('aria-expanded', 'false'));
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
document.addEventListener('click', e => { if (!e.target.closest('.nabidka')) zavriNabidky(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') zavriNabidky(); });
addEventListener('resize', zavriNabidky);

$('jazyk').value = stav.jazyk;
$('jazyk').addEventListener('change', () => {
  if (edit) potvrd();
  stav.jazyk = $('jazyk').value;
  if (list) { list.prepniJazyk(stav.jazyk); ulozList(); }
  uloz();
  if (stav.rezim === 'tahak') return kresliTahak($('tahakFiltr')?.value || '');
  kresliVyklad(); kresliMrizku(); vyber(vybrana);
});

const obnov = $('btnObnov');
let obnovCas = null;
obnov.addEventListener('click', () => {
  if (!obnovCas) {
    obnov.textContent = '↺ Opravdu smazat úpravy? Klikněte znovu';
    obnovCas = setTimeout(() => { obnov.textContent = '↺ Obnovit list'; obnovCas = null; }, 3500);
    return;
  }
  clearTimeout(obnovCas); obnovCas = null; obnov.textContent = '↺ Obnovit list';
  if (stav.rezim === 'piskoviste') stav.piskoviste = null; else delete stav.listy[stav.lekce];
  uloz(); nastavRezim(stav.rezim);
  info('List je ve výchozím stavu.');
});
const nacti = $('nactiData');
nacti.innerHTML = '<option value="">📥 Načíst list lekce…</option>' + LEKCE.map((l, i) => `<option value="${l.id}">${i + 1}. ${esc(l.nazev)}</option>`).join('');
nacti.addEventListener('change', () => {
  const lk = LEKCE.find(l => l.id === nacti.value); nacti.value = '';
  if (!lk) return;
  list = listZLekce(lk); ulozList(); kresliMrizku(); vyber('A1');
  info(`Načten list lekce „${esc(lk.nazev)}“. Původní obsah pískoviště byl nahrazen.`);
});
$('btnNapoveda').addEventListener('click', () => $('dlgNapoveda').showModal());

nastavRezim(stav.rezim);
window.XLV_UI = { get list() { return list; }, vyber, potvrd, nastavRezim, otevriLekci, nastavRozklad, get rz() { return rz; } };
})();

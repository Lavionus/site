/* Rozhraní výukové stránky Excel – vzorce. Nad XLV (jadro.js), XLV_LEKCE (lekce.js) a XLV_ROZBOR (rozbor.js). */
(function () {
'use strict';
const X = window.XLV, LEKCE = window.XLV_LEKCE, RB = window.XLV_ROZBOR;
const $ = id => document.getElementById(id);
const tvar = (n, a, b, c) => { const w = n === 1 ? a : n > 1 && n < 5 ? b : c; return `${n} ${window.I18N && I18N.t ? I18N.t(w) : w}`; };   /* 1 úloha, 3 úlohy, 5 úloh */
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const KLIC = 'webapp_excel_vzorce';
const VYCHOZI = { jazyk: 'cs', lekce: LEKCE[0].id, rezim: 'lekce', hotovo: {}, listy: {}, piskoviste: null, rozbor: null };

/* ---------- stav a ukládání ---------- */
let stav;
try { stav = Object.assign({}, VYCHOZI, JSON.parse(localStorage.getItem(KLIC) || '{}')); } catch (e) { stav = { ...VYCHOZI }; }
if (!LEKCE.some(l => l.id === stav.lekce) && !(String(stav.lekce).startsWith('sada:') && (stav.sady || []).some(x => 'sada:' + x.id === stav.lekce))) stav.lekce = LEKCE[0].id;
/* návštěvník v jiném jazyce než češtině dostane výchozí anglický zápis vzorců */
try { if (!JSON.parse(localStorage.getItem(KLIC) || '{}').jazyk && window.I18N && I18N.jazyk && I18N.jazyk !== 'cs') stav.jazyk = 'en'; } catch (e) { /* bez úložiště */ }
if (!['lekce', 'piskoviste', 'tahak', 'rozbor', 'procvic', 'ucitel'].includes(stav.rezim)) stav.rezim = 'lekce';
let varovaniUloziste = false;
function uloz() {
  try { localStorage.setItem(KLIC, JSON.stringify(stav)); }
  catch (e) {   /* plné úložiště: jednou upozornit, jinak by se tiše přestalo ukládat */
    if (!varovaniUloziste) { varovaniUloziste = true; setTimeout(() => window.Dialog && Dialog.chyba('Úložiště prohlížeče je plné – změny se neukládají. Smažte staré zálohy v 📁 Soubor → Moje sešity, nebo sešit stáhněte jako .xlsx.'), 0); }
  }
}

const aktLekce = () => LEKCE.find(l => l.id === stav.lekce) || sadaJakoLekce(stav.lekce) || LEKCE[0];
const jaz = () => stav.jazyk;

function listZLekce(lk) {
  const l = new X.List(lk.list.bunky, { jazyk: 'en', radku: lk.list.radku, sloupcu: lk.list.sloupcu });
  l.prepniJazyk(jaz());
  return l;
}
/* list s uloženými úpravami (buňky, formáty, šířky sloupců) */
function obnovList(ulozeny, zaklad) {
  if (!ulozeny) return zaklad;
  const u = new X.List({}, { jazyk: ulozeny.jazyk });
  u.bunky = { ...ulozeny.bunky };
  u.prepniJazyk(jaz());
  zaklad.bunky = u.bunky;
  if (ulozeny.format) zaklad.format = { ...ulozeny.format };
  zaklad.sirky = { ...(ulozeny.sirky || {}) };
  zaklad.kukatko = [...(ulozeny.kukatko || [])];
  for (const a of Object.keys(u.bunky)) { const p = X.rozeberAdresu(a); if (p) { zaklad.radku = Math.max(zaklad.radku, p.r); zaklad.sloupcu = Math.max(zaklad.sloupcu, p.c); } }
  zaklad.cache = new Map();
  return zaklad;
}
/* sešit z uložených dat: nový formát {listy:[…]} i starý (jeden list) */
function sesitZDat(d, zaklad) {
  if (d && d.listy) return X.Sesit.obnov(d, jaz());
  const s = new X.Sesit(jaz());
  s.pridejList('List1', obnovList(d, zaklad));
  return s;
}
const dataSesitu = () => ({ ...sesit.serializuj(), aktivni: Math.max(0, sesit.listy.indexOf(list)) });
function ulozList() {
  if (stav.rezim === 'tahak') return;   /* v taháku není aktivní žádný list */
  const z = dataSesitu();
  if (stav.rezim === 'procvic') { if (pv.uloha) pv.uloha.data = z; return; }
  if (stav.rezim === 'ucitel') { const sa = aktSada(); if (sa) sa.data = z; uloz(); return; }
  if (stav.rezim === 'piskoviste') stav.piskoviste = z;
  else if (stav.rezim === 'rozbor') stav.rozbor = { ...(stav.rozbor || {}), list: z };
  else stav.listy[stav.lekce] = z;
  uloz();
}

/* ---------- dílna: proměnné ---------- */
let sesit = null;         /* X.Sesit */
let list = null;          /* aktivní X.List sešitu */
let vybrana = 'A1';       /* aktivní buňka */
let konec = 'A1';         /* druhý roh výběru (oblast vybrana:konec) */
let edit = false;         /* píše se do řádku vzorců */
let uk = null;            /* {s, e} – adresa vložená ukazováním myší */
let kotva = null, tahUk = false, tahVyb = false, tahSirka = null;
let schranka = null;      /* {o, vyjmout, text, bunky, format} */
let vypln = null;         /* tažení úchytu */
let zobrazVzorce = false;
let historie = [], vpred = [];
const vstup = $('vzorec'), zvyr = $('zvyr'), mrizka = $('mrizka');

function rozmer() {
  if (stav.rezim === 'piskoviste' || stav.rezim === 'rozbor') return { R: Math.max(30, list.radku + 3), C: Math.max(12, list.sloupcu + 2) };
  return { R: list.radku + 2, C: list.sloupcu + 1 };
}
function cileLekce() {
  if (stav.rezim === 'ucitel') { const sa = aktSada(); return new Map((sa ? sa.ulohy : []).map(u => [u.cil, true])); }
  if (stav.rezim === 'procvic') return pv.uloha ? new Map([[pv.uloha.cil, !!pv.uloha.vysledek?.ok]]) : new Map();
  if (stav.rezim !== 'lekce') return new Map();
  const lk = aktLekce(), m = new Map();
  for (const u of lk.ulohy) m.set(u.cil, !!stav.hotovo[lk.id + '/' + u.id]);
  return m;
}
/* oblast výběru */
function obl(a = vybrana, b = konec) {
  const p = X.rozeberAdresu(a), q = X.rozeberAdresu(b);
  return { r1: Math.min(p.r, q.r), c1: Math.min(p.c, q.c), r2: Math.max(p.r, q.r), c2: Math.max(p.c, q.c) };
}
function adresy(o) { const out = []; for (let r = o.r1; r <= o.r2; r++) for (let c = o.c1; c <= o.c2; c++) out.push(X.adresa(r, c)); return out; }
const jednaBunka = o => o.r1 === o.r2 && o.c1 === o.c2;
const textObl = o => X.adresa(o.r1, o.c1) + (jednaBunka(o) ? '' : ':' + X.adresa(o.r2, o.c2));

/* ---------- Zpět / Znovu: každá změna listu jde přes zmena() ---------- */
const snimek = () => ({ data: JSON.stringify(dataSesitu()) });
function aktualizujZpet() {
  const z = $('btnZpet'), n = $('btnZnovu');
  z.disabled = !historie.length; n.disabled = !vpred.length;
  z.title = historie.length ? `Zpět: ${historie[historie.length - 1].popis} (Ctrl+Z)` : 'Zpět (Ctrl+Z)';
  n.title = vpred.length ? `Znovu: ${vpred[vpred.length - 1].popis} (Ctrl+Y)` : 'Znovu (Ctrl+Y)';
}
function resetHistorie() { historie = []; vpred = []; aktualizujZpet(); }
function zmena(popis, fn) {
  historie.push({ ...snimek(), popis });
  /* historie: nejvýš 200 kroků a ~30 MB snímků (velké importované listy) */
  let vel = historie.reduce((x, h) => x + h.data.length, 0);
  while (historie.length > 1 && (historie.length > 200 || vel > 3e7)) vel -= historie.shift().data.length;
  vpred = [];
  if (sipky.length) { sipky = []; hranice = null; }   /* po změně listu šipky zmizí jako v Excelu */
  fn();
  list.zneplatni();
  ulozList(); kresliMrizku(); aktualizujZpet();
}
function obnovSnimek(s) {
  const d = JSON.parse(s.data);
  sesit = X.Sesit.obnov(d, jaz());
  list = sesit.listy[Math.min(d.aktivni || 0, sesit.listy.length - 1)];
  ulozList(); kresliZalozkyListu(); kresliMrizku(); vyber(vybrana, true, konec);
}
function zpet() {
  if (!historie.length) return info('Není co vrátit.');
  const s = historie.pop(); vpred.push({ ...snimek(), popis: s.popis });
  obnovSnimek(s); info(`↶ Vráceno: ${esc(s.popis)}`); aktualizujZpet();
}
function znovu() {
  if (!vpred.length) return info('Není co opakovat.');
  const s = vpred.pop(); historie.push({ ...snimek(), popis: s.popis });
  obnovSnimek(s); info(`↷ Znovu: ${esc(s.popis)}`); aktualizujZpet();
}

/* ---------- mřížka ---------- */
function zobrazHodnotu(a) {
  let t = list.zobraz(a);
  const v = list.hodnota(a);
  if (typeof v === 'number' && !list.format[a] && /\d{11,}/.test(t.replace(/[,.]/, ''))) t = X.fmtCislo(parseFloat(v.toPrecision(10)), list.jazyk);
  return t;
}
const stylSirky = c => (list.sirky && list.sirky[c] ? `width:${list.sirky[c]}px;min-width:${list.sirky[c]}px;max-width:${list.sirky[c]}px;` : '');
function kresliMrizku() {
  const { R, C } = rozmer(), cile = cileLekce(), pf = list.pravidla && list.pravidla.length ? list.podmineneStyly() : new Map();
  mrizka.classList.toggle('zobraz-vzorce', zobrazVzorce);
  let h = '<thead><tr><th class="roh" title="Vybrat vše (Ctrl+A)"></th>';
  for (let c = 1; c <= C; c++) h += `<th data-c="${c}" style="${stylSirky(c)}">${X.cisloNaSloupec(c)}<span class="sirka" data-sirka="${c}" title="Táhněte pro šířku sloupce, dvojklik = podle obsahu"></span></th>`;
  h += '</tr></thead><tbody>';
  for (let r = 1; r <= R; r++) {
    h += `<tr><th data-r="${r}">${r}</th>`;
    for (let c = 1; c <= C; c++) {
      const a = X.adresa(r, c), raw = list.surova(a), f = list.format[a] || {};
      let v = list.hodnota(a);
      const tr = [];
      if (X.jePole(v)) { if (v.rozlitiZ) tr.push('rozl-zdroj'); v = v.h[0][0]; }
      else if (!raw && v !== null && v !== undefined) tr.push('rozl');
      const ukazVzorec = zobrazVzorce && raw.startsWith('=');
      if (ukazVzorec) tr.push('vzt');
      else if (typeof v === 'number') tr.push('cis'); else if (typeof v === 'boolean') tr.push('log'); else if (X.jeChyba(v)) tr.push('chy');
      else if (typeof v === 'string' && r === 1 && raw && !raw.startsWith('=')) tr.push('hl');
      if (raw.startsWith('=')) tr.push('vz');
      if (f.b) tr.push('tuc');
      if (cile.has(a)) { tr.push('cil'); if (cile.get(a)) tr.push('hotova'); }
      const tit = raw.startsWith('=') ? raw : X.jeChyba(v) ? X.CHYBY[v.kod].popis : '';
      let zarov = f.z ? `text-align:${{ l: 'left', c: 'center', r: 'right' }[f.z]};` : '';
      const ps = pf.get(a);
      if (ps) {
        if (ps.styl) tr.push('pf-' + ps.styl);
        if (ps.skala !== undefined) zarov += `background:hsla(${Math.round(ps.skala * 120)},70%,50%,.32);`;
        if (ps.pruh !== undefined) zarov += `background-image:linear-gradient(90deg,color-mix(in srgb,var(--r0) 38%,transparent) ${Math.round(ps.pruh * 100)}%,transparent ${Math.round(ps.pruh * 100)}%);`;
      }
      h += `<td data-a="${a}" data-k="${c}" class="${tr.join(' ')}" style="${stylSirky(c)}${zarov}"${tit ? ` title="${esc(tit)}"` : ''}>${esc(ukazVzorec ? raw : zobrazHodnotu(a))}</td>`;
    }
    h += '</tr>';
  }
  mrizka.innerHTML = h + '</tbody>';
  tdMapa = new Map(); mrizka.querySelectorAll('td[data-a]').forEach(t => tdMapa.set(t.dataset.a, t));
  oznac();
  if (stav.rezim === 'rozbor') aktualizujVysledekRozboru();
  kresliSipky(); obnovAudit();
}
let tdMapa = new Map();
const td = a => tdMapa.get(a);
function oznac() {
  mrizka.querySelectorAll('td.vybr,td.ref,td.vypln,td.obl,td.kop').forEach(t => { t.classList.remove('vybr', 'ref', 'vypln', 'obl', 'kop'); t.style.removeProperty('--rb'); });
  mrizka.querySelectorAll('th.akt').forEach(t => t.classList.remove('akt'));
  X.odkazyVeVzorci(vstup.value, list.jazyk).forEach((o, i) => {
    for (let r = o.r1; r <= o.r2; r++) for (let c = o.c1; c <= o.c2; c++) {
      const t = td(X.adresa(r, c)); if (t) { t.classList.add('ref'); t.style.setProperty('--rb', `var(--r${i % 6})`); }
    }
  });
  if (vypln) vypln.cile.forEach(a => td(a)?.classList.add('vypln'));
  if (schranka) adresy(schranka.o).forEach(a => td(a)?.classList.add('kop'));
  const o = obl();
  if (!jednaBunka(o)) adresy(o).forEach(a => td(a)?.classList.add('obl'));
  td(vybrana)?.classList.add('vybr');
  for (let c = o.c1; c <= o.c2; c++) mrizka.querySelector(`thead th[data-c="${c}"]`)?.classList.add('akt');
  for (let r = o.r1; r <= o.r2; r++) mrizka.querySelector(`tbody th[data-r="${r}"]`)?.classList.add('akt');
  umistiUchyt();
  stavovyRadek();
}
function umistiUchyt() {
  const u = $('uchyt'), o = obl(), t = td(X.adresa(o.r2, o.c2));
  if (!t) { u.hidden = true; return; }
  u.hidden = false;
  u.style.left = (t.offsetLeft + t.offsetWidth - 6) + 'px';
  u.style.top = (t.offsetTop + t.offsetHeight - 6) + 'px';
}
function stavovyRadek() {
  const el = $('stavRadek'), o = obl();
  if (jednaBunka(o)) { el.textContent = ''; return; }
  let n = 0; const cis = [];
  for (const a of adresy(o)) {
    let v = list.hodnota(a); if (X.jePole(v)) v = v.h[0][0];
    if (v !== null && v !== undefined && v !== '') n++;
    if (typeof v === 'number') cis.push(v);
  }
  const f = x => X.fmtCislo(parseFloat(x.toPrecision(10)), list.jazyk);
  const s = cis.reduce((a, b) => a + b, 0);
  el.innerHTML = `<b>${textObl(o)}</b> · Počet: ${n}` + (cis.length ? ` · Součet: ${f(s)} · Průměr: ${f(s / cis.length)} · Min: ${f(Math.min(...cis))} · Max: ${f(Math.max(...cis))}` : '');
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
    if (navrhy.length) h = navrhy.map(en => `<button class="btn mini navrh" data-navrh="${en}" title="${esc(X.FUNKCE[en].popis)}">${esc(X.nazevFunkce(en, jaz()))}</button>`).join('') + ' <span>Tab = doplnit první</span>';
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
function vyber(a, sRozkladem = true, kon = a) {
  vybrana = a; konec = kon;
  vstup.value = list.surova(a);
  const zr = vstup.value ? null : list.rozliti(a).zdroj;
  vstup.placeholder = zr ? `↳ rozlito ze vzorce v ${zr}: ${list.surova(zr)}` : 'Hodnota nebo vzorec začínající =';
  edit = false; uk = null;
  $('nazevBunky').textContent = textObl(obl());
  prekresliVstup(); napoveda(); oznac();
  td(kon)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  if (sRozkladem) rozkladBunky();
  aktualizujFormat();
}
function rozsirNa(b) {
  konec = b;
  $('nazevBunky').textContent = textObl(obl());
  oznac();
  td(b)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
function info(t) { $('infoDilny').innerHTML = t; }
function potvrd() {
  const v = vstup.value;
  if (v.startsWith('=') && list.format[vybrana]?.t !== 'text') {
    try { X.rozeber(v, list.jazyk); }
    catch (e) {
      info(`<span style="color:var(--danger)">⚠ ${esc(e.message)}</span> – opravte vzorec, nebo Esc pro zrušení.`);
      vstup.focus();
      if (e.pozice !== undefined) vstup.setSelectionRange(e.pozice, Math.min(e.pozice + 1, v.length));
      return false;
    }
  }
  edit = false; uk = null;
  if (v !== list.surova(vybrana)) { info(''); zmena(`zápis do ${vybrana}`, () => list.nastav(vybrana, v)); }
  else kresliMrizku();
  return true;
}
function zrus() { vstup.value = list.surova(vybrana); edit = false; uk = null; info(''); prekresliVstup(); napoveda(); oznac(); mrizka.focus(); }
function posunVyber(dr, dc) {
  const p = X.rozeberAdresu(vybrana), { R, C } = rozmer();
  vyber(X.adresa(Math.min(R, Math.max(1, p.r + dr)), Math.min(C, Math.max(1, p.c + dc))));
}
function smazOblast() {
  const o = obl(), ad = adresy(o).filter(a => list.surova(a) !== '');
  if (!ad.length) return;
  zmena(`smazání ${textObl(o)}`, () => ad.forEach(a => list.nastav(a, '')));
  vyber(vybrana, true, konec);
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
function oblastText(a, b) { return textObl(obl(a, b)); }

mrizka.addEventListener('mousedown', e => {
  if (e.target.closest('[data-sirka]')) return;
  const h = e.target.closest('th');
  if (h) {
    if (edit && !potvrd()) return;
    e.preventDefault(); mrizka.focus();
    const { R, C } = rozmer();
    if (h.classList.contains('roh')) vyber('A1', true, X.adresa(R, C));
    else if (h.dataset.c) vyber(X.adresa(1, +h.dataset.c), true, X.adresa(R, +h.dataset.c));
    else if (h.dataset.r) vyber(X.adresa(+h.dataset.r, 1), true, X.adresa(+h.dataset.r, C));
    return;
  }
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
  if (e.shiftKey) rozsirNa(t.dataset.a);
  else { vyber(t.dataset.a); tahVyb = true; }
});
mrizka.addEventListener('mouseover', e => {
  const t = e.target.closest('td[data-a]'); if (!t) return;
  if (tahUk) vlozAdresu(oblastText(kotva, t.dataset.a));
  else if (tahVyb && t.dataset.a !== konec) rozsirNa(t.dataset.a);
});
document.addEventListener('mouseup', () => { tahUk = false; tahVyb = false; });
mrizka.addEventListener('dblclick', e => {
  const g = e.target.closest('[data-sirka]');
  if (g) return sirkaPodleObsahu(+g.dataset.sirka);
  const t = e.target.closest('td[data-a]'); if (!t) return;
  vstup.focus(); vstup.setSelectionRange(vstup.value.length, vstup.value.length); edit = true; poPsani();
});

/* šířka sloupců */
mrizka.addEventListener('pointerdown', e => {
  const g = e.target.closest('[data-sirka]'); if (!g) return;
  e.preventDefault(); e.stopPropagation();
  tahSirka = { c: +g.dataset.sirka, x: e.clientX, w: g.parentElement.offsetWidth, puvodni: list.sirky?.[+g.dataset.sirka], pred: { ...snimek(), popis: 'šířka sloupce' } };
});
function nastavSirku(c, w) {
  list.sirky = { ...(list.sirky || {}), [c]: Math.round(w) };
  mrizka.querySelectorAll(`thead th[data-c="${c}"], td[data-k="${c}"]`).forEach(el => {
    el.style.width = el.style.minWidth = el.style.maxWidth = Math.round(w) + 'px';
  });
}
document.addEventListener('pointermove', e => {
  if (!tahSirka) return;
  nastavSirku(tahSirka.c, Math.max(30, Math.min(600, tahSirka.w + e.clientX - tahSirka.x)));
  umistiUchyt();
});
document.addEventListener('pointerup', () => {
  if (!tahSirka) return;
  if (list.sirky?.[tahSirka.c] !== tahSirka.puvodni) { historie.push(tahSirka.pred); vpred = []; }   /* jen klik bez tažení do historie nepatří */
  tahSirka = null;
  ulozList(); aktualizujZpet(); umistiUchyt();
});
function sirkaPodleObsahu(c) {
  const cv = document.createElement('canvas').getContext('2d');
  cv.font = getComputedStyle(td('A1') || mrizka).font;
  let w = 40;
  mrizka.querySelectorAll(`td[data-k="${c}"]`).forEach(t => { w = Math.max(w, cv.measureText(t.textContent).width + 18); });
  zmena('šířka sloupce podle obsahu', () => { list.sirky = { ...(list.sirky || {}), [c]: Math.round(Math.min(w, 480)) }; });
}

/* klávesnice v listu */
mrizka.addEventListener('keydown', e => {
  const k = e.key, ctrl = e.ctrlKey || e.metaKey;
  if (ctrl) {
    const kl = k.toLowerCase();
    if (kl === 'z') { e.preventDefault(); if (e.shiftKey) znovu(); else zpet(); }
    else if (kl === 'y') { e.preventDefault(); znovu(); }
    else if (kl === 'a') { e.preventDefault(); const { R, C } = rozmer(); vyber('A1', true, X.adresa(R, C)); }
    else if (kl === 'b') { e.preventDefault(); prepniFormat('b'); }
    else if (e.code === 'Backquote') { e.preventDefault(); prepniVzorce(); }
    return;   /* Ctrl+C / X / V obslouží události copy / cut / paste */
  }
  const pohyb = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1], Enter: [e.shiftKey ? -1 : 1, 0], Tab: [0, e.shiftKey ? -1 : 1] }[k];
  if (pohyb) {
    e.preventDefault();
    if (e.shiftKey && k.startsWith('Arrow')) {
      const q = X.rozeberAdresu(konec), { R, C } = rozmer();
      rozsirNa(X.adresa(Math.min(R, Math.max(1, q.r + pohyb[0])), Math.min(C, Math.max(1, q.c + pohyb[1]))));
    } else posunVyber(...pohyb);
    return;
  }
  if (k === 'Escape' && schranka) { schranka = null; oznac(); info(''); return; }
  if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); smazOblast(); return; }
  if (k === 'F2') { e.preventDefault(); vstup.focus(); edit = true; vstup.setSelectionRange(vstup.value.length, vstup.value.length); poPsani(); return; }
  if (k.length === 1 && !e.altKey) { e.preventDefault(); konec = vybrana; vstup.value = k; vstup.focus(); vstup.setSelectionRange(1, 1); edit = true; uk = null; poPsani(); }
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

/* ---------- schránka: oblasti s posunem odkazů, výměna s Excelem jako text s tabulátory ---------- */
const vListu = () => document.activeElement === mrizka;
function zkopiruj(e, vyjmout) {
  if (!vListu()) return;
  e.preventDefault();
  const o = obl(), bunky = {}, format = {};
  adresy(o).forEach(a => { bunky[a] = list.surova(a); if (list.format[a]) format[a] = list.format[a]; });
  const text = Array.from({ length: o.r2 - o.r1 + 1 }, (_, i) => Array.from({ length: o.c2 - o.c1 + 1 }, (_, j) => list.zobraz(X.adresa(o.r1 + i, o.c1 + j))).join('\t')).join('\n');
  schranka = { o, vyjmout, text, bunky, format, list };
  e.clipboardData.setData('text/plain', text);
  oznac();
  info(`${vyjmout ? '✂ Vyjmuto' : '📋 Zkopírováno'} ${textObl(o)} – vyberte cíl a vložte Ctrl+V. ${vyjmout ? 'Obsah se přesune beze změny odkazů.' : 'Relativní odkazy ve vzorcích se posunou.'}`);
}
document.addEventListener('copy', e => zkopiruj(e, false));
document.addEventListener('cut', e => zkopiruj(e, true));
document.addEventListener('paste', e => {
  if (!vListu()) return;
  e.preventDefault();
  const text = e.clipboardData.getData('text/plain');
  if (schranka && text === schranka.text) vlozSchranku();
  else if (text) vlozText(text);
});
function vlozSchranku() {
  const s = schranka, src = s.o, h = src.r2 - src.r1 + 1, w = src.c2 - src.c1 + 1, cil = obl();
  const vys = cil.r2 - cil.r1 + 1, sir = cil.c2 - cil.c1 + 1;
  const tr = !s.vyjmout && vys % h === 0 ? vys / h : 1, tc = !s.vyjmout && sir % w === 0 ? sir / w : 1;
  zmena(`${s.vyjmout ? 'přesun' : 'vložení'} ${textObl(src)} → ${X.adresa(cil.r1, cil.c1)}`, () => {
    const nove = {};
    for (let ti = 0; ti < tr; ti++) for (let tj = 0; tj < tc; tj++) for (let dr = 0; dr < h; dr++) for (let dc = 0; dc < w; dc++) {
      const z = X.adresa(src.r1 + dr, src.c1 + dc), r = cil.r1 + ti * h + dr, c = cil.c1 + tj * w + dc;
      const zdrojL = s.list && sesit.listy.includes(s.list) ? s.list : list;
      let raw = s.vyjmout ? zdrojL.surova(z) : (s.bunky[z] || '');   /* přesun bere aktuální obsah zdroje */
      if (raw.startsWith('=') && !s.vyjmout) { try { raw = X.posunVzorec(raw, r - (src.r1 + dr), c - (src.c1 + dc), list.jazyk); } catch (er) { /* chybný vzorec beze změny */ } }
      nove[X.adresa(r, c)] = { raw, f: s.vyjmout ? zdrojL.format[z] : s.format[z] };
    }
    /* přesun: vymaže se zdroj na listu, odkud se vyjímalo (může to být jiný list) */
    const zdroj = s.list && sesit.listy.includes(s.list) ? s.list : list;
    if (s.vyjmout) adresy(src).forEach(a => { if (zdroj !== list || !(a in nove)) { zdroj.nastav(a, ''); delete zdroj.format[a]; } });
    for (const [a, x] of Object.entries(nove)) { list.nastav(a, x.raw); if (x.f) list.format[a] = x.f; else delete list.format[a]; }
  });
  const prvni = X.adresa(cil.r1, cil.c1);
  vyber(prvni, true, X.adresa(cil.r1 + tr * h - 1, cil.c1 + tc * w - 1));
  const ukazka = list.surova(prvni).startsWith('=') && !s.vyjmout ? ` V ${prvni} je teď <code>${esc(list.surova(prvni))}</code> (původně <code>${esc(s.bunky[X.adresa(src.r1, src.c1)])}</code>).` : '';
  info(`Vloženo do ${textObl(obl())}.${ukazka}`);
  if (s.vyjmout) schranka = null;
}
function vlozText(text) {
  const radky = text.replace(/\r/g, '').replace(/\n$/, '').split('\n').map(r => r.split('\t'));
  const o = obl();
  zmena('vložení ze schránky', () => radky.forEach((r, i) => r.forEach((v, j) => list.nastav(X.adresa(o.r1 + i, o.c1 + j), v.trim() === '' ? '' : v))));
  vyber(X.adresa(o.r1, o.c1), true, X.adresa(o.r1 + radky.length - 1, o.c1 + Math.max(...radky.map(r => r.length)) - 1));
  info(`Vloženo ${radky.length} × ${Math.max(...radky.map(r => r.length))} buněk ze schránky (hodnoty, jako z Excelu nebo Calcu).`);
}

/* ---------- úchyt: kopírování a řady ---------- */
const uchyt = $('uchyt');
uchyt.addEventListener('pointerdown', e => {
  if (edit && !potvrd()) return;
  e.preventDefault();
  try { uchyt.setPointerCapture(e.pointerId); } catch (er) { /* syntetická událost */ }
  vypln = { o: obl(), cile: [], smer: null, n: 0 };
});
uchyt.addEventListener('pointermove', e => {
  if (!vypln) return;
  const t = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('td[data-a]'); if (!t) return;
  const o = vypln.o, q = X.rozeberAdresu(t.dataset.a);
  const dy = q.r > o.r2 ? q.r - o.r2 : q.r < o.r1 ? q.r - o.r1 : 0;
  const dx = q.c > o.c2 ? q.c - o.c2 : q.c < o.c1 ? q.c - o.c1 : 0;
  const cile = [];
  if (!dy && !dx) { vypln.n = 0; }
  else if (Math.abs(dy) >= Math.abs(dx)) {
    vypln.smer = dy > 0 ? 'd' : 'u'; vypln.n = Math.abs(dy);
    for (let i = 1; i <= vypln.n; i++) for (let c = o.c1; c <= o.c2; c++) cile.push(X.adresa(dy > 0 ? o.r2 + i : o.r1 - i, c));
  } else {
    vypln.smer = dx > 0 ? 'r' : 'l'; vypln.n = Math.abs(dx);
    for (let i = 1; i <= vypln.n; i++) for (let r = o.r1; r <= o.r2; r++) cile.push(X.adresa(r, dx > 0 ? o.c2 + i : o.c1 - i));
  }
  vypln.cile = cile; oznac();
});
uchyt.addEventListener('pointerup', () => {
  if (!vypln) return;
  const { o, smer, n } = vypln; vypln = null;
  if (n > 0) vyplnRadu(o, smer, n); else oznac();
});
uchyt.addEventListener('dblclick', () => {
  const o = obl(), soused = o.c1 > 1 ? o.c1 - 1 : o.c2 + 1;
  let n = 0;
  while (list.surova(X.adresa(o.r2 + n + 1, soused)) !== '' && n < 2000) n++;
  if (n) vyplnRadu(o, 'd', n); else info('Dvojklik na úchyt vyplní dolů tolik řádků, kolik má data sousední sloupec – tady žádná nejsou.');
});
function vyplnRadu(o, smer, n) {
  const svisle = smer === 'd' || smer === 'u', obracene = smer === 'u' || smer === 'l';
  let rada = false;
  zmena(`vyplnění úchytem z ${textObl(o)}`, () => {
    const linky = svisle ? Array.from({ length: o.c2 - o.c1 + 1 }, (_, i) => o.c1 + i) : Array.from({ length: o.r2 - o.r1 + 1 }, (_, i) => o.r1 + i);
    for (const l of linky) {
      let zdroj = svisle ? Array.from({ length: o.r2 - o.r1 + 1 }, (_, i) => X.adresa(o.r1 + i, l)) : Array.from({ length: o.c2 - o.c1 + 1 }, (_, i) => X.adresa(l, o.c1 + i));
      if (obracene) zdroj = zdroj.reverse();
      const raw = zdroj.map(a => list.surova(a));
      const cil = i => {
        const r = svisle ? (smer === 'd' ? o.r2 + i : o.r1 - i) : l, c = svisle ? l : (smer === 'r' ? o.c2 + i : o.c1 - i);
        return r >= 1 && c >= 1 ? X.adresa(r, c) : null;
      };
      const hodnoty = raw.some(x => x.startsWith('=')) ? null : X.pokracujRadu(raw, n, list.jazyk);
      if (hodnoty && hodnoty.some((v, i) => v !== raw[i % raw.length])) rada = true;
      for (let i = 1; i <= n; i++) {
        const a = cil(i); if (!a) continue;
        const z = zdroj[(i - 1) % zdroj.length];
        if (hodnoty) list.nastav(a, hodnoty[i - 1]);
        else {
          const pz = X.rozeberAdresu(z), pa = X.rozeberAdresu(a);
          let x = list.surova(z);
          if (x.startsWith('=')) { try { x = X.posunVzorec(x, pa.r - pz.r, pa.c - pz.c, list.jazyk); } catch (er) { /* beze změny */ } }
          list.nastav(a, x);
        }
        if (list.format[z]) list.format[a] = list.format[z]; else delete list.format[a];
      }
    }
  });
  const nova = smer === 'd' ? { ...o, r2: o.r2 + n } : smer === 'u' ? { ...o, r1: Math.max(1, o.r1 - n) } : smer === 'r' ? { ...o, c2: o.c2 + n } : { ...o, c1: Math.max(1, o.c1 - n) };
  vyber(X.adresa(nova.r1, nova.c1), true, X.adresa(nova.r2, nova.c2));
  const prvni = list.surova(X.adresa(o.r1, o.c1));
  info(prvni.startsWith('=')
    ? `Vzorec zkopírován do ${textObl(nova)}. Relativní odkazy se posunuly, ukotvené ($) ne – projděte si buňky v řádku vzorců.`
    : rada ? `Vyplněna řada v ${textObl(nova)} (čísla, data, dny, měsíce i „Položka 1“ pokračují).`
      : `Hodnoty zkopírovány do ${textObl(nova)}. Tip: označte dvě čísla (1 a 2) a táhněte – vznikne řada.`);
}
new ResizeObserver(() => { umistiUchyt(); kresliSipky(); }).observe($('mrizkaObal'));

/* ---------- formáty buněk ---------- */
const NAZVY_FORMATU = { obecny: 'Obecný', cislo: 'Číslo', mena: 'Měna (Kč)', proc: 'Procenta', datum: 'Datum', text: 'Text' };
function aktualizujFormat() {
  const f = list.format[vybrana] || {};
  $('fmtTyp').value = f.t || 'obecny';
  document.querySelectorAll('[data-fmt]').forEach(b => {
    const k = b.dataset.fmt;
    if (k === 'b') b.setAttribute('aria-pressed', String(!!f.b));
    if (k === 'tis') b.setAttribute('aria-pressed', String(!!(f.tis ?? f.t === 'mena')));
    if (k[0] === 'z') b.setAttribute('aria-pressed', String(f.z === k[1]));
  });
}
function nastavFormat(popis, uprav) {
  if (edit && !potvrd()) return;   /* rozepsaný vzorec se nejdřív potvrdí */
  const o = obl();
  zmena(`${popis} (${textObl(o)})`, () => adresy(o).forEach(a => {
    const f = { ...(list.format[a] || {}) };
    uprav(f, a);
    Object.keys(f).forEach(k => { if (f[k] === undefined || f[k] === false) delete f[k]; });
    if (f.t === 'obecny') delete f.t;
    if (Object.keys(f).length) list.format[a] = f; else delete list.format[a];
  }));
  vyber(vybrana, true, konec);
}
function vychoziMista(a) {
  const v = list.hodnota(a), f = list.format[a] || {};
  if (f.d !== undefined) return f.d;
  if (f.t === 'mena' || f.t === 'cislo') return 2;
  if (typeof v !== 'number') return 0;
  const t = String(parseFloat((f.t === 'proc' ? v * 100 : v).toPrecision(12)));
  return t.includes('.') ? t.split('.')[1].length : 0;
}
function prepniFormat(k) {
  const prvni = list.format[vybrana] || {};
  if (k === 'b') return nastavFormat(prvni.b ? 'zrušení tučného' : 'tučné písmo', f => { f.b = !prvni.b; });
  if (k === 'tis') { const zap = !(prvni.tis ?? prvni.t === 'mena'); return nastavFormat('oddělovač tisíců', f => { f.tis = zap; if (!f.t) f.t = 'cislo'; if (f.d === undefined) f.d = 0; }); }
  if (k === 'vic' || k === 'mene') return nastavFormat(k === 'vic' ? 'přidání desetinného místa' : 'ubrání desetinného místa', (f, a) => {
    f.d = Math.max(0, Math.min(10, vychoziMista(a) + (k === 'vic' ? 1 : -1)));
  });
  if (k[0] === 'z') return nastavFormat('zarovnání', f => { f.z = prvni.z === k[1] ? undefined : k[1]; });
  if (k === 'vymaz') return nastavFormat('vymazání formátu', f => { Object.keys(f).forEach(x => delete f[x]); });
}
$('fmtTyp').innerHTML = Object.entries(NAZVY_FORMATU).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
$('fmtTyp').addEventListener('change', () => {
  const t = $('fmtTyp').value;
  nastavFormat(`formát ${NAZVY_FORMATU[t]}`, f => { f.t = t; if (t === 'datum' || t === 'text' || t === 'obecny') delete f.d; });
  if (t === 'text' && list.surova(vybrana).startsWith('=')) info('⚠ Formát Text: vzorec se teď zobrazuje jako text a nepočítá se. Přesně tohle se v Excelu stává, když buňka má formát Text dřív, než do ní napíšete vzorec.');
  mrizka.focus();
});
document.querySelectorAll('[data-fmt]').forEach(b => b.addEventListener('click', () => { prepniFormat(b.dataset.fmt); mrizka.focus(); }));
function prepniVzorce() {
  zobrazVzorce = !zobrazVzorce;
  $('btnVzorce').setAttribute('aria-pressed', String(zobrazVzorce));
  kresliMrizku();
  info(zobrazVzorce ? 'Zobrazují se vzorce místo výsledků (Ctrl+` nebo tlačítko vrátí výsledky).' : '');
}
$('btnVzorce').addEventListener('click', prepniVzorce);
$('btnZpet').addEventListener('click', () => { zpet(); mrizka.focus(); });
$('btnZnovu').addEventListener('click', () => { znovu(); mrizka.focus(); });
document.addEventListener('keydown', e => {
  /* Zpět/Znovu i mimo list (kromě psaní do polí) */
  if (!(e.ctrlKey || e.metaKey) || e.target === mrizka || e.target.matches?.('input,textarea,select') || stav.rezim === 'tahak' || document.querySelector('dialog[open]')) return;
  const kl = e.key.toLowerCase();
  if (kl === 'z') { e.preventDefault(); if (e.shiftKey) znovu(); else zpet(); }
  else if (kl === 'y') { e.preventDefault(); znovu(); }
});

/* ---------- rozklad vzorce ---------- */
let rz = null, zalozka = 'kroky', prehravani = null;
const NAZVY_UZLU = { num: 'číslo', str: 'text', bool: 'logická hodnota', err: 'chybová hodnota', ref: 'odkaz na buňku', range: 'oblast buněk',
  jmeno: 'neznámý název', prazdny: 'vynechaný argument', un: 'znaménko', pct: 'procento',
  op: { '+': 'sčítání', '-': 'odčítání', '*': 'násobení', '/': 'dělení', '^': 'mocnina', '&': 'spojení textů', '=': 'porovnání =', '<>': 'porovnání ≠', '<': 'porovnání <', '>': 'porovnání >', '<=': 'porovnání ≤', '>=': 'porovnání ≥' } };
const lit = v => X.literal(X.jePole(v) && !v.r1 ? v.h[0][0] : v, list.jazyk);

function rozkladBunky() {
  const raw = list.surova(vybrana), fmt = list.format[vybrana] || {};
  if (raw.startsWith('=') && fmt.t !== 'text') return nastavRozklad(raw, { zdroj: 'bunka' });
  if (AUDIT_ZAL.includes(zalozka)) { zastavPrehravani(); rz = null; return obnovAudit(); }
  zastavPrehravani();
  rz = null;
  $('rzZdroj').textContent = '';
  let t;
  const v = list.hodnota(vybrana);
  if (raw.startsWith('=')) t = `⚠ Buňka ${vybrana} má formát <b>Text</b>, proto se vzorec <code>${esc(raw)}</code> nepočítá a zobrazuje se jako obyčejný text. V Excelu je to častá past: změňte formát na Obecný a vzorec znovu potvrďte (F2, Enter).`;
  else if (!raw && list.rozliti(vybrana).zdroj) { const z = list.rozliti(vybrana).zdroj; t = `Buňka ${vybrana} je prázdná, ale ukazuje <b>${esc(list.zobraz(vybrana))}</b> – je to část <b>rozlitého pole</b> ze vzorce v buňce <button class="adr" data-jdi="${z}">${z}</button> (<code>${esc(list.surova(z))}</code>). Vzorec vrací víc hodnot a Excel 365 je „rozleje“ do sousedních buněk.`; }
  else if (!raw) t = `Buňka ${vybrana} je prázdná. Napište do ní hodnotu nebo vzorec začínající <kbd>=</kbd>.`;
  else if (typeof v === 'number' && list.jeDatum(vybrana)) t = `Buňka ${vybrana} obsahuje <b>datum</b> ${esc(list.zobraz(vybrana))}. Excel si ho pamatuje jako číslo dne <code>${v}</code>.`;
  else if (typeof v === 'number') t = `Buňka ${vybrana} obsahuje <b>číslo</b> ${esc(list.zobraz(vybrana))} (zarovnané doprava).`;
  else if (typeof v === 'boolean') t = `Buňka ${vybrana} obsahuje <b>logickou hodnotu</b> ${esc(list.zobraz(vybrana))}.`;
  else t = `Buňka ${vybrana} obsahuje <b>text</b> (zarovnaný doleva). S textem se nedá počítat – <code>${esc(vybrana)}+1</code> by dalo chybu ${esc(X.CHYBY.VALUE[jaz()])}.`;
  const pfs = list.pravidla && list.pravidla.length ? list.podmineneStyly().get(vybrana) : null;
  if (pfs) t += `<br>🎨 Buňku obarvilo podmíněné formátování: ${pfs.pravidla.map(i => esc(popisPravidla(list.pravidla[i]))).join('; ')}.`;
  if (typeof v === 'number' && (fmt.t || fmt.d !== undefined || fmt.tis) && list.zobraz(vybrana) !== X.fmtCislo(v, jaz())) {
    t += `<br>Formát <b>${NAZVY_FORMATU[fmt.t || 'obecny']}</b> mění jen <i>vzhled</i>: zobrazuje se „${esc(list.zobraz(vybrana))}“, ale uloženo je <code>${esc(X.fmtCislo(v, jaz()))}</code> – s touto hodnotou počítají vzorce.`;
  }
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
  if (AUDIT_ZAL.includes(zalozka)) return obnovAudit();
  if (!rz) return rozkladBunky();
  $('rzZdroj').innerHTML = (rz.zdroj === 'ukazka'
    ? `ukázka <button class="btn mini" id="btnVlozUkazku" title="Vloží ukázkový vzorec do vybrané buňky">Vložit do ${vybrana}</button>`
    : `buňka ${vybrana}`) + (stav.rezim !== 'rozbor' && !rz.chybaZapisu ? ' <button class="btn mini" id="btnRozbor" title="Slovní vysvětlení, postup, rady a předvedení">🔬 Podrobný rozbor</button>' : '');
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
  let h = `<div class="vyraz${i === n ? ' konec' : ''}" data-i18n="ne">${vyraz}</div>`;
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
    `<li data-krok="${j + 1}" class="${j === i - 1 ? 'akt' : ''}"><code>${esc(X.vykresli(k.uzel, { jazyk: list.jazyk }))}</code> → <span class="vys" data-i18n="ne">${esc(lit(k.hodnota))}</span> <span class="ppis">${esc(k.popis)}</span></li>`).join('') + '</ol>';
  if (X.jePole(rz.vysledek) && !rz.vysledek.r1) h += '<p class="rz-prazdne">Výsledkem je pole hodnot – v listu se „rozlije“ do sousedních buněk (dynamické pole Excelu 2021/365). Když je v cestě neprázdná buňka, vznikne chyba #ROZLITÍ!.</p>';
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
    const hod = z ? `<span class="hod" data-i18n="ne">= ${esc(lit(z.v))}</span>` : list_ ? '' : '<span class="nevyh">nevyhodnoceno (větev se nepočítala)</span>';
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
  if (z) { zastavPrehravani(); zalozka = z.dataset.zal; return kresliRozklad(); }
  if (e.target.id === 'btnVlozUkazku' && rz) { vstup.value = rz.vzorec; potvrd(); vyber(vybrana); return; }
  if (e.target.id === 'btnRozbor' && rz) {
    const bunka = rz.zdroj === 'bunka' ? vybrana : X.adresa(1, Math.min(list.sloupcu + 2, 26));
    return rozebrat(rz.vzorec, { zList: list, bunka });
  }
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
  return `<button class="vz" data-i18n="ne" data-vz="${esc(v)}" title="Rozložit v dílně">${obarvi(v, jaz(), false)}</button>`;
}
const klic = u => stav.lekce + '/' + u.id;
function pocty(lk) { return { hot: lk.ulohy.filter(u => stav.hotovo[lk.id + '/' + u.id]).length, vse: lk.ulohy.length }; }
function kresliPostup() {
  let hot = 0, vse = 0;
  LEKCE.forEach(l => { const p = pocty(l); hot += p.hot; vse += p.vse; });
  $('postup').innerHTML = `✓ <b>${hot}</b>/${vse}`; $('postup').title = `Splněno ${hot} z ${vse} úloh v lekcích`;
}
function kresliVyklad() {
  const v = $('vyklad');
  if (stav.rezim === 'piskoviste') { v.innerHTML = htmlPiskoviste(); return; }
  if (stav.rezim === 'rozbor') {
    try { v.innerHTML = htmlRozbor(); }
    catch (e) { stav.rozbor = null; uloz(); v.innerHTML = htmlRozbor(); info('⚠ Tento vzorec se rozebrat nepodařilo.'); }
    return;
  }
  if (stav.rezim === 'procvic') { v.innerHTML = htmlProcvic(); return; }
  if (stav.rezim === 'ucitel') { v.innerHTML = htmlUcitel(); return; }
  const lk = aktLekce(), i = LEKCE.indexOf(lk);
  let h = `<div class="podtitul">${i < 0 ? 'Vlastní sada úloh' : `Lekce ${i + 1} z ${LEKCE.length}`}</div><h2>${lk.emoji} ${esc(lk.nazev)}</h2>
    ${lk.cile.length ? `<div class="cile"><b>Po lekci budete umět:</b><ul>${lk.cile.map(c => `<li>${esc(c)}</li>`).join('')}</ul></div>` : ''}`;
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
  if (i >= 0) h += `<div class="nav-lekce">${pred ? `<button class="btn" data-lekce="${pred.id}">◀ ${esc(pred.nazev)}</button>` : '<span></span>'}
    ${dal ? `<button class="btn hlavni" data-lekce="${dal.id}">${esc(dal.nazev)} ▶</button>` : '<button class="btn hlavni" data-rezim-tl="piskoviste">🧪 Do pískoviště</button>'}</div>`;
  v.innerHTML = h;
}
/* zadání z vlastních sad je text od uživatele: nejdřív escapovat, pak teprve značky [[@A1]], [[=…]], {FN} */
function zpracujBezpecne(t) {
  const zpet = x => x.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  return esc(t)
    .replace(/\[\[@([A-Z]+\d+)\]\]/g, (m, a) => `<button class="adr" data-adr="${a}" title="Vybrat buňku ${a} v listu">${a}</button>`)
    .replace(/\[\[(=[\s\S]*?)\]\](?!\])/g, (m, f) => cip(zpet(f)))
    .replace(/\{;\}/g, X.oddelovac(jaz()))
    .replace(/\{([A-Z][A-Z.]*)\}/g, (m, en) => X.FUNKCE[en] ? `<b class="fn">${esc(X.nazevFunkce(en, jaz()))}</b>` : m);
}
function htmlUloha(u, j) {
  const hot = !!stav.hotovo[klic(u)];
  return `<div class="uloha${hot ? ' hotovo' : ''}" data-uloha="${esc(u.id)}">
    <div class="u-hlava"><span>Úloha ${j + 1} · buňka <button class="adr" data-adr="${esc(u.cil)}">${esc(u.cil)}</button>${u.kopirovat ? ` · kopírovat do ${esc(u.kopirovat)}` : ''}</span>${hot ? '<span class="ok">✓ splněno</span>' : ''}</div>
    <div class="u-zad">${u.sada ? zpracujBezpecne(u.zadani) : zpracuj(u.zadani)}</div>
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
  const [a, b] = String(o || '').split(':'), p = X.rozeberAdresu(a), q = X.rozeberAdresu(b || a), out = [];
  if (!p || !q) return out;   /* neplatná oblast (např. z importu) nesmí shodit stránku */
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
  const chybi = u.kopirovat ? rozsahAdres(u.kopirovat).filter(a => a !== u.cil && !list.surova(a)) : [];
  if (chybi.length) zmena(`dokopírování vzorce z ${u.cil}`, () => chybi.forEach(a => list.kopiruj(u.cil, a)));
  vyber(u.cil);
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
    zmena(`vložení řešení do ${u.cil}`, () => list.nastav(u.cil, X.prelozVzorec(u.reseni, 'en', jaz()))); vyber(u.cil);
  }
});
$('vyklad').addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.matches('.predp input')) { e.preventDefault(); const k = e.target.closest('.predp'); overPredpoved(aktLekce(), +k.dataset.predp, k); }
});

/* ---------- tahák ---------- */
const KATEGORIE = ['Matematika', 'Statistika', 'Logické', 'Podmíněné', 'Vyhledávání', 'Dynamická pole', 'Text', 'Datum', 'Finanční', 'Informační'];
function kresliTahak(filtr = '') {
  const f = filtr.trim().toLowerCase();
  let h = `<h2>📚 Tahák funkcí</h2><div class="filtr"><input class="vstup" id="tahakFiltr" type="search" placeholder="Hledat funkci (česky, anglicky, popis)…" value="${esc(filtr)}" style="flex:1;min-width:200px"></div>
    <p>Zápis odpovídá přepínači <b>Zápis vzorců</b>: argumenty se v českém Excelu oddělují středníkem <code>;</code>, v anglickém čárkou <code>,</code>.
    Argumenty v [hranatých závorkách] jsou nepovinné. Tlačítko 🧪 otevře funkci v pískovišti.</p>`;
  for (const kat of KATEGORIE) {
    const fns = Object.values(X.FUNKCE).filter(x => x.kat === kat && (!f || [x.cs, x.en, x.popis].some(t => t.toLowerCase().includes(f))));
    if (!fns.length) continue;
    h += `<h3>${esc(kat)}</h3><div class="tabulka-obal"><table class="tab"><tr><th>Česky</th><th>Anglicky</th><th>Zápis</th><th>Co dělá</th><th></th></tr>` +
      fns.map(x => `<tr><td class="nz" data-i18n="ne">${esc(x.cs)}</td><td class="nz" data-i18n="ne">${esc(x.en)}</td><td class="syn">${syntaxeHtml(x.en, -1)}</td><td>${esc(x.popis)}</td>
        <td><button class="btn mini" data-zkus="${x.en}" title="Zkusit v pískovišti">🧪</button></td></tr>`).join('') + '</table></div>';
  }
  if (!f || 'chyba error'.includes(f)) {
    h += '<h3>Chybové hodnoty</h3><div class="tabulka-obal"><table class="tab"><tr><th>Česky</th><th>Anglicky</th><th>Význam</th></tr>' +
      Object.values(X.CHYBY).map(c => `<tr><td class="nz" data-i18n="ne">${esc(c.cs)}</td><td class="nz" data-i18n="ne">${esc(c.en)}</td><td>${esc(c.popis)}</td></tr>`).join('') + '</table></div>';
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
  const sadyMenu = sady().filter(x => x.ulohy.length);   /* prázdné sady (rozpracované) do menu nepatří */
  if (sadyMenu.length) $('nabLekce').innerHTML += '<hr><div class="titulek">Vlastní sady úloh</div>' + sadyMenu.map(x => {
    const lk = { id: 'sada:' + x.id, ulohy: x.ulohy }, p = pocty(lk);
    return `<button class="tl${lk.id === stav.lekce && stav.rezim === 'lekce' ? ' aktivni' : ''}" data-lekce="${lk.id}">📝 ${esc(x.nazev)}<span class="n${p.hot === p.vse && p.vse ? ' plne' : ''}">${p.hot}/${p.vse}</span></button>`;
  }).join('');
  const i = LEKCE.indexOf(aktLekce());
  $('nazevLekceLista').textContent = i < 0 ? ` 📝 ${aktLekce().nazev}` : ` ${i + 1}. ${aktLekce().nazev}`;
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
  if (r !== 'procvic' && pv.zkouska) { clearInterval(pv.casovac); pv.zkouska = null; pv.uloha = null; }   /* odchod ze zkoušky ji ukončí */
  $('btnObnov').hidden = r === 'ucitel';
  stav.rezim = r; uloz();
  document.querySelectorAll('[data-rezim]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.rezim === r)));
  const tahak = r === 'tahak';
  $('tahak').hidden = !tahak; $('vyklad').hidden = tahak; $('dilna').hidden = tahak;
  $('rozlozeni').classList.toggle('jen-dilna', r === 'piskoviste');
  kresliMenu(); kresliPostup();
  if (tahak) { kresliTahak(); return; }
  resetHistorie(); schranka = null; sipky = []; hranice = null;
  if (r === 'piskoviste') {
    sesit = sesitZDat(stav.piskoviste, new X.List({}, { jazyk: jaz(), radku: 1, sloupcu: 1 }));
    list = sesit.listy[Math.min(stav.piskoviste?.aktivni || 0, sesit.listy.length - 1)];
    $('popisListu').textContent = 'Pískoviště – volný list';
    $('nactiData').hidden = false;
  } else if (r === 'ucitel') {
    if (!aktSada()) { if (sady().length) stav.ucitelSada = sady()[0].id; else novaSada(); }
    sesit = sesitZDat(aktSada().data, new X.List({}, { jazyk: jaz(), radku: 1, sloupcu: 1 }));
    list = sesit.listy[0];
    $('popisListu').textContent = `Sada „${aktSada().nazev}“ – data a vzorová řešení`;
    $('nactiData').hidden = true;
  } else if (r === 'procvic') {
    if (!pv.uloha && !pv.souhrn) novaUloha();
    sesit = sesitZDat(pv.uloha?.data, new X.List({}, { jazyk: jaz(), radku: 1, sloupcu: 1 }));
    list = sesit.listy[0];
    $('popisListu').textContent = pv.zkouska ? 'Zkouška – list úlohy' : 'Procvičování – list úlohy';
    $('nactiData').hidden = true;
  } else if (r === 'rozbor') {
    sesit = sesitZDat(stav.rozbor?.list, new X.List({}, { jazyk: jaz(), radku: 1, sloupcu: 1 }));
    list = sesit.listy[0];
    $('popisListu').textContent = 'Rozbor – ukázková data můžete přepisovat';
    $('nactiData').hidden = true;
  } else {
    const lk = aktLekce();
    sesit = sesitZDat(stav.listy[lk.id], listZLekce(lk));
    list = sesit.listy[0];
    $('popisListu').textContent = `List lekce: ${lk.nazev}`;
    $('nactiData').hidden = true;
  }
  info('');
  kresliZalozkyListu();
  kresliVyklad();
  kresliMrizku();
  let start = 'A1';
  if (r === 'lekce') {
    const lk = aktLekce();
    start = Object.keys(lk.list.bunky).find(a => String(lk.list.bunky[a]).startsWith('=')) || lk.ulohy[0]?.cil || 'A1';
  }
  if (r === 'rozbor' && stav.rozbor?.bunka) start = stav.rozbor.bunka;
  if (r === 'procvic' && pv.uloha) start = pv.uloha.cil;
  vyber(start);
}
$('btnPred').addEventListener('click', () => { const i = LEKCE.indexOf(aktLekce()); if (i > 0) otevriLekci(LEKCE[i - 1].id); });
$('btnDalsi').addEventListener('click', () => { const i = LEKCE.indexOf(aktLekce()); if (i < LEKCE.length - 1) otevriLekci(LEKCE[i + 1].id); });
document.querySelectorAll('[data-rezim]').forEach(b => b.addEventListener('click', () => { if (edit && !potvrd()) return; nastavRezim(b.dataset.rezim); }));
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
  if (edit && !potvrd()) { $('jazyk').value = stav.jazyk; return; }
  if (stav.rozbor?.vzorec) stav.rozbor.vzorec = X.prelozVzorec(stav.rozbor.vzorec, stav.jazyk, $('jazyk').value);
  stav.jazyk = $('jazyk').value;
  /* v taháku není aktivní list – uložené listy se přeloží až při načtení */
  if (stav.rezim === 'tahak') { uloz(); return kresliTahak($('tahakFiltr')?.value || ''); }
  if (sesit) { sesit.prepniJazyk(stav.jazyk); ulozList(); }
  uloz();
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
  if (stav.rezim === 'procvic') { if (pv.uloha) { const v = pv.uloha.vysledek; pv.uloha.data = null; const l = new X.List(pv.uloha.bunky, { jazyk: 'en' }); l.prepniJazyk(jaz()); pv.uloha.data = { jazyk: jaz(), listy: [{ nazev: 'List1', bunky: l.bunky, format: l.format }] }; pv.uloha.vysledek = v; } nastavRezim('procvic'); info('List úlohy je ve výchozím stavu.'); return; }
  if (stav.rezim === 'rozbor') { if (stav.rozbor?.vzorec) rozebrat(stav.rozbor.vzorec, { seme: stav.rozbor.seme }); info('Ukázková data jsou znovu vygenerovaná.'); return; }
  if (stav.rezim === 'piskoviste') stav.piskoviste = null; else delete stav.listy[stav.lekce];
  uloz(); nastavRezim(stav.rezim);
  info('List je ve výchozím stavu.');
});
const nacti = $('nactiData');
nacti.innerHTML = '<option value="">📥 Načíst list lekce…</option>' + LEKCE.map((l, i) => `<option value="${l.id}">${i + 1}. ${esc(l.nazev)}</option>`).join('');
nacti.addEventListener('change', () => {
  if (edit && !potvrd()) { nacti.value = ''; return; }
  const lk = LEKCE.find(l => l.id === nacti.value); nacti.value = '';
  if (!lk) return;
  const l = listZLekce(lk), nazev = sesit.volnyNazev(lk.nazev.replace(/[^\wÀ-ž]+/g, '').slice(0, 14) || 'Lekce');
  zmena(`načtení listu lekce`, () => { sesit.pridejList(nazev, l); list = l; });
  kresliZalozkyListu(); vyber('A1');
  info(`List lekce „${esc(lk.nazev)}“ je v pískovišti jako nový list ${esc(nazev)}.`);
});
$('btnNapoveda').addEventListener('click', () => $('dlgNapoveda').showModal());
/* průvodce stránkou: sám při první návštěvě, ručně tlačítkem 🧭 */
function spustPruvodce() {
  if (!window.XLV_PRUVODCE || XLV_PRUVODCE.aktivni) return;
  zavriNabidky();
  if (stav.rezim !== 'lekce') nastavRezim('lekce');
  XLV_PRUVODCE.spust({ priZavreni: () => { stav.pruvodce = true; uloz(); } });
}
$('btnPruvodce').addEventListener('click', spustPruvodce);
$('btnPruvodceZNapovedy').addEventListener('click', () => { $('dlgNapoveda').close(); spustPruvodce(); });

/* ---------- audit: šipky, závislosti, kontrola listu, kukátko ---------- */
const AUDIT_ZAL = ['zavislosti', 'chyby', 'kukatko'];
let sipky = [], hranice = null;   /* hranice = {druh: 'pred'|'nasl', zdroj, fronta[], videne} */
const klicHrany = (o, na) => `${o.r1},${o.c1},${o.r2},${o.c2}>${na}`;
function bunkyObdelniku(o, max = 400) {
  const out = [];
  for (let r = o.r1; r <= o.r2; r++) for (let c = o.c1; c <= o.c2; c++) { out.push(X.adresa(r, c)); if (out.length >= max) return out; }
  return out;
}
const jeChybaV = a => { let v = list.hodnota(a); if (X.jePole(v)) v = v.h[0][0]; return X.jeChyba(v); };
function pridejUroven(druh) {
  if (!hranice || hranice.druh !== druh || hranice.zdroj !== vybrana) {
    if (!hranice || hranice.zdroj !== vybrana) sipky = [];
    hranice = { druh, zdroj: vybrana, fronta: [vybrana], videne: new Set([vybrana]) };
  }
  const klice = new Set(sipky.map(s => s.klic)), nova = [];
  let pridano = 0;
  const pridej = (o, na) => { const k = klicHrany(o, na); if (!klice.has(k)) { klice.add(k); sipky.push({ klic: k, z: o, na }); pridano++; } };
  for (const a of hranice.fronta) {
    if (druh === 'pred') {
      for (const o of list.predchudci(a)) {
        if (o.list && o.list.toUpperCase() !== list.nazev.toUpperCase()) continue;
        pridej(o, a);
        for (const b of bunkyObdelniku(o)) if (list.surova(b).startsWith('=') && !hranice.videne.has(b)) { hranice.videne.add(b); nova.push(b); }
      }
    } else {
      const p = X.rozeberAdresu(a);
      for (const b of list.naslednici(a)) {
        pridej({ r1: p.r, c1: p.c, r2: p.r, c2: p.c }, b);
        if (!hranice.videne.has(b)) { hranice.videne.add(b); nova.push(b); }
      }
    }
  }
  hranice.fronta = nova;
  kresliSipky();
  const co = druh === 'pred' ? 'předchůdců' : 'následníků';
  info(pridano
    ? `Šipky ${co} buňky ${hranice.zdroj}: +${pridano}. ${nova.length ? 'Dalším kliknutím přidáte další úroveň.' : 'Další úroveň už není.'}${sipky.some(s => s.chyba) ? ' Červená šipka = odtud přichází chyba.' : ''}`
    : `${hranice.zdroj}: žádní další ${druh === 'pred' ? 'předchůdci (buňka nemá vzorec s odkazy, nebo už jsou všechny zobrazené)' : 'následníci (na buňku už neodkazuje další vzorec)'}.`);
}
function smazSipky() { sipky = []; hranice = null; kresliSipky(); }
function kresliSipky() {
  let svg = $('sipky');
  if (!sipky.length || !list) { if (svg) svg.remove(); return; }
  if (!svg) {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'sipky'; svg.setAttribute('class', 'sipky'); svg.setAttribute('aria-hidden', 'true');
    $('mrizkaVnitrek').appendChild(svg);
  }
  svg.setAttribute('width', mrizka.offsetWidth); svg.setAttribute('height', mrizka.offsetHeight);
  let h = '<defs><marker id="hrot" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="10" markerHeight="10" orient="auto"><path d="M0,0L10,5L0,10z"/></marker>'
    + '<marker id="hrotCh" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="10" markerHeight="10" orient="auto"><path d="M0,0L10,5L0,10z"/></marker></defs>';
  for (const s of sipky) {
    const tA = td(X.adresa(s.z.r1, s.z.c1)), tB = td(X.adresa(s.z.r2, s.z.c2)), tN = td(s.na);
    if (!tA || !tB || !tN) continue;
    s.chyba = bunkyObdelniku(s.z).some(jeChybaV);
    const x1 = tA.offsetLeft, y1 = tA.offsetTop, x2 = tB.offsetLeft + tB.offsetWidth, y2 = tB.offsetTop + tB.offsetHeight;
    const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2, tx = tN.offsetLeft + tN.offsetWidth / 2, ty = tN.offsetTop + tN.offsetHeight / 2;
    const d = Math.hypot(tx - cx, ty - cy) || 1, kx = tx - (tx - cx) / d * 7, ky = ty - (ty - cy) / d * 7;
    const oblast = s.z.r1 !== s.z.r2 || s.z.c1 !== s.z.c2;
    h += `<g${s.chyba ? ' class="chyba"' : ''}>${oblast ? `<rect x="${x1 + 2}" y="${y1 + 2}" width="${x2 - x1 - 4}" height="${y2 - y1 - 4}"/>` : ''}`
      + `<circle cx="${cx}" cy="${cy}" r="3.5"/><line x1="${cx}" y1="${cy}" x2="${kx}" y2="${ky}" marker-end="url(#${s.chyba ? 'hrotCh' : 'hrot'})"/></g>`;
  }
  svg.innerHTML = h;
}
function bfs(start, sousede) {
  const uroven = new Map([[start, 0]]), fronta = [start];
  while (fronta.length) {
    const x = fronta.shift(), d = uroven.get(x);
    if (d >= 12 || uroven.size > 600) continue;
    for (const y of sousede(x)) if (!uroven.has(y)) { uroven.set(y, d + 1); fronta.push(y); }
  }
  uroven.delete(start);
  return uroven;
}
const odkazAdr = a => `<button class="adr" data-jdi="${esc(a)}">${esc(a)}</button>`;
function seznamUrovni(mapa) {
  const po = {};
  for (const [a, d] of mapa) (po[d] = po[d] || []).push(a);
  return Object.keys(po).map(d => `<li>úroveň ${d}: ${po[d].slice(0, 40).map(odkazAdr).join(' ')}${po[d].length > 40 ? ' …' : ''}</li>`).join('');
}
function htmlZavislosti() {
  const a = vybrana, raw = list.surova(a), pred = list.predchudci(a), nasl = list.naslednici(a);
  let h = `<div class="audit"><h4>⇠ Předchůdci ${a} – na co vzorec odkazuje</h4>`;
  if (!pred.length) h += `<p class="rz-prazdne">${raw.startsWith('=') ? 'Vzorec neodkazuje na žádnou buňku.' : 'Buňka neobsahuje vzorec – je to vstupní hodnota.'}</p>`;
  else {
    h += '<ul class="audit-seznam">' + pred.map(o => {
      const jedna = o.r1 === o.r2 && o.c1 === o.c2, t = textObl(o), prvni = X.adresa(o.r1, o.c1);
      if (o.list && o.list.toUpperCase() !== list.nazev.toUpperCase()) return `<li>list <b>${esc(o.list)}</b>: <code>${t}</code> = <code>${esc(lit(list.kroky('=' + X.textListu(o.list) + '!' + t).vysledek))}</code></li>`;
      return `<li${bunkyObdelniku(o).some(jeChybaV) ? ' class="t-chyba"' : ''}>${odkazAdr(prvni)}${jedna ? '' : `<code>${t}</code>`} ${jedna ? `= <code>${esc(list.zobraz(prvni) || '∅ prázdná')}</code>${list.surova(prvni).startsWith('=') ? ` <span class="rz-prazdne">(vzorec ${esc(list.surova(prvni))})</span>` : ''}` : `oblast ${(o.r2 - o.r1 + 1) * (o.c2 - o.c1 + 1)} buněk`}</li>`;
    }).join('') + '</ul>';
    const neprimi = bfs(a, x => list.predchudci(x).flatMap(o => bunkyObdelniku(o, 200)).filter(b => list.surova(b) !== ''));
    if (neprimi.size) h += `<p class="rz-prazdne">Výsledek celkem závisí na ${neprimi.size} buňkách (i nepřímo, přes další vzorce):</p><ul class="audit-seznam">${seznamUrovni(neprimi)}</ul>`;
  }
  h += `<h4>Následníci ${a} ⇢ – které vzorce na buňce závisí</h4>`;
  if (!nasl.length) h += '<p class="rz-prazdne">Na tuto buňku neodkazuje žádný vzorec – její změna nic dalšího nepřepočítá.</p>';
  else {
    const vsichni = bfs(a, x => list.naslednici(x));
    h += `<p class="rz-prazdne">Když změníte ${a}, přepočítá se ${vsichni.size} ${vsichni.size === 1 ? 'buňka' : vsichni.size < 5 ? 'buňky' : 'buněk'}:</p><ul class="audit-seznam">${seznamUrovni(vsichni)}</ul>`;
  }
  return h + `<div class="rb-akce"><button class="btn mini" data-sipky="pred">⇠◻ Šipky předchůdců</button><button class="btn mini" data-sipky="nasl">◻⇢ Šipky následníků</button>${sipky.length ? '<button class="btn mini" data-sipky="smaz">✕ Odstranit šipky</button>' : ''}</div></div>`;
}
function htmlKontrola(n) {
  if (!n.length) return '<div class="audit"><p>✅ V listu nejsou žádné chyby ani podezřelá místa.</p><p class="rz-prazdne">Kontrola hledá chybové hodnoty i s jejich původem, vzorce, které se liší od sousedů ve sloupci, a vzorce v buňkách s formátem Text.</p></div>';
  return `<div class="audit"><p class="rz-prazdne">Nalezeno ${n.length}. U převzatých chyb je vidět celý řetěz až k buňce, kde chyba vznikla – opravte vždy tu poslední.</p><ul class="audit-seznam">` + n.map(x => {
    const titul = x.typ === 'chyba' ? `<b>${esc(X.CHYBY[x.kod][jaz()])}</b>` : x.typ === 'nekonzistentni' ? '<b>Nekonzistentní vzorec</b>' : '<b>Vzorec jako text</b>';
    const puvod = x.puvod && x.puvod.length > 1
      ? `<div class="puvod">Původ: ${x.puvod.map(p => odkazAdr(p.adresa)).join(' ← ')} – ${esc(x.text)}</div>`
      : `<div class="puvod">${esc(x.text)}</div>`;
    return `<li class="t-${x.typ}">${odkazAdr(x.adresa)} ${titul} <button class="btn mini" data-rozloz="${x.adresa}">Rozložit</button>${puvod}</li>`;
  }).join('') + '</ul></div>';
}
function htmlKukatko() {
  const k = list.kukatko || [];
  let h = `<div class="audit"><p class="rz-prazdne">Kukátko ukazuje hodnoty sledovaných buněk, i když jsou mimo obrazovku – změňte vstupy a sledujte dopad na výsledky.</p>
    <button class="btn mini" data-kuk="pridej">＋ Sledovat ${textObl(obl())}</button>`;
  if (k.length) h += '<table class="kuk"><tr><th>Buňka</th><th>Hodnota</th><th>Vzorec</th><th></th></tr>' + k.map(a =>
    `<tr><td class="h">${odkazAdr(a)}</td><td>${esc(list.zobraz(a) || '∅')}</td><td><code>${esc(list.surova(a))}</code></td><td><button class="btn mini" data-kuk="smaz" data-a="${a}" aria-label="Přestat sledovat ${a}">✕</button></td></tr>`).join('') + '</table>';
  else h += '<p class="rz-prazdne">Zatím nesledujete žádnou buňku.</p>';
  return h + '</div>';
}
function obnovAudit() {
  if (!list) return;
  const n = list.kontrola();
  $('pocetChyb').textContent = n.length || '';
  if (!AUDIT_ZAL.includes(zalozka)) return;
  $('rzZdroj').textContent = zalozka === 'zavislosti' ? `buňka ${vybrana}` : zalozka === 'chyby' ? 'celý list' : `${(list.kukatko || []).length} sledovaných`;
  $('rzTelo').innerHTML = zalozka === 'zavislosti' ? htmlZavislosti() : zalozka === 'chyby' ? htmlKontrola(n) : htmlKukatko();
}
$('rozklad').addEventListener('click', e => {
  const j = e.target.closest('[data-jdi]');
  if (j) { if (edit && !potvrd()) return; vyber(j.dataset.jdi); td(j.dataset.jdi)?.classList.add('blik'); return; }
  const rl = e.target.closest('[data-rozloz]');
  if (rl) { zalozka = 'kroky'; vyber(rl.dataset.rozloz); return; }
  const sp = e.target.closest('[data-sipky]');
  if (sp) { if (sp.dataset.sipky === 'smaz') { smazSipky(); obnovAudit(); } else { pridejUroven(sp.dataset.sipky); obnovAudit(); } return; }
  const kk = e.target.closest('[data-kuk]');
  if (kk) {
    const k = list.kukatko || [];
    zmena(kk.dataset.kuk === 'pridej' ? 'přidání do kukátka' : 'odebrání z kukátka', () => {
      list.kukatko = kk.dataset.kuk === 'pridej' ? [...new Set([...k, ...adresy(obl()).slice(0, 30)])].slice(0, 60) : k.filter(a => a !== kk.dataset.a);
    });
  }
});
$('btnAuditPred').addEventListener('click', () => { pridejUroven('pred'); obnovAudit(); mrizka.focus(); });
$('btnAuditNasl').addEventListener('click', () => { pridejUroven('nasl'); obnovAudit(); mrizka.focus(); });
$('btnAuditSmaz').addEventListener('click', () => { smazSipky(); obnovAudit(); info(''); mrizka.focus(); });

/* ---------- struktura listu: řádky a sloupce, řazení, najít a nahradit ---------- */
/* souvislá oblast dat kolem buňky (jako Ctrl+A v Excelu) */
function oblastKolem(a) {
  const p = X.rozeberAdresu(a), plne = (r, c) => r >= 1 && c >= 1 && list.surova(X.adresa(r, c)) !== '';
  const o = { r1: p.r, c1: p.c, r2: p.r, c2: p.c };
  for (let zmena_ = true, n = 0; zmena_ && n < 200; n++) {
    zmena_ = false;
    const radekPlny = r => { for (let c = o.c1; c <= o.c2; c++) if (plne(r, c)) return true; return false; };
    const sloupecPlny = c => { for (let r = o.r1; r <= o.r2; r++) if (plne(r, c)) return true; return false; };
    if (o.r1 > 1 && radekPlny(o.r1 - 1)) { o.r1--; zmena_ = true; }
    if (radekPlny(o.r2 + 1)) { o.r2++; zmena_ = true; }
    if (o.c1 > 1 && sloupecPlny(o.c1 - 1)) { o.c1--; zmena_ = true; }
    if (sloupecPlny(o.c2 + 1)) { o.c2++; zmena_ = true; }
  }
  return o;
}
function strukturaAkce(druh) {
  zavriNabidky();
  if (edit && !potvrd()) return;
  const o = obl(), nR = o.r2 - o.r1 + 1, nC = o.c2 - o.c1 + 1;
  const sl = c => X.cisloNaSloupec(c);
  if (druh === 'vlozR') { zmena(`vložení ${nR} řádků nad ${o.r1}`, () => list.zmenStrukturu('r', o.r1, nR)); vyber(vybrana, true, konec); info(`Vloženo ${nR} ${nR === 1 ? 'řádek' : 'řádků'} nad řádek ${o.r1}. Odkazy ve vzorcích pod nimi se posunuly – podívejte se na ně (ƒx vzorce).`); }
  else if (druh === 'smazR') { zmena(`odstranění řádků ${o.r1}–${o.r2}`, () => list.zmenStrukturu('r', o.r1, -nR)); vyber(X.adresa(o.r1, o.c1)); info(`Odstraněny řádky ${o.r1}–${o.r2}. Vzorce, které na ně odkazovaly, ukazují ${X.CHYBY.REF[jaz()]} – kontrola listu (🐞) je najde.`); }
  else if (druh === 'vlozC') { zmena(`vložení ${nC} sloupců před ${sl(o.c1)}`, () => list.zmenStrukturu('c', o.c1, nC)); vyber(vybrana, true, konec); info(`Vloženo ${nC} ${nC === 1 ? 'sloupec' : 'sloupců'} před sloupec ${sl(o.c1)}. Odkazy ve vzorcích se posunuly.`); }
  else if (druh === 'smazC') { zmena(`odstranění sloupců ${sl(o.c1)}–${sl(o.c2)}`, () => list.zmenStrukturu('c', o.c1, -nC)); vyber(X.adresa(o.r1, o.c1)); info(`Odstraněny sloupce ${sl(o.c1)}–${sl(o.c2)}. Odkazy na ně se změnily na ${X.CHYBY.REF[jaz()]}.`); }
  else if (druh === 'seradA' || druh === 'seradZ') {
    let oo = jednaBunka(o) ? oblastKolem(vybrana) : o;
    const klicC = X.rozeberAdresu(vybrana).c;
    /* hlavička: první řádek je text a pod ním jsou čísla */
    const h1 = list.hodnota(X.adresa(oo.r1, klicC)), h2 = list.hodnota(X.adresa(oo.r1 + 1, klicC));
    const hlavicka = oo.r2 > oo.r1 && typeof h1 === 'string' && (typeof h2 !== 'string' || oo.r1 === 1);
    if (hlavicka) oo = { ...oo, r1: oo.r1 + 1 };
    if (oo.r2 <= oo.r1) return info('Není co řadit – vyberte oblast s daty.');
    zmena(`seřazení ${textObl(oo)}`, () => list.serad(oo, klicC, druh === 'seradA'));
    vyber(X.adresa(oo.r1, oo.c1), true, X.adresa(oo.r2, oo.c2));
    info(`Seřazeno ${textObl(oo)} podle sloupce ${sl(klicC)} ${druh === 'seradA' ? 'vzestupně' : 'sestupně'}${hlavicka ? ' (první řádek je hlavička, zůstal na místě)' : ''}. Vzorce se posunuly se svým řádkem.`);
  }
  else if (druh === 'hledat') otevriHledani();
}
$('nabStruktura').addEventListener('click', e => { const b = e.target.closest('[data-str]'); if (b) strukturaAkce(b.dataset.str); });
mrizka.addEventListener('contextmenu', e => {
  const h = e.target.closest('th'); if (!h || h.classList.contains('roh')) return;
  e.preventDefault();
  const o = obl();
  if (h.dataset.c && !(+h.dataset.c >= o.c1 && +h.dataset.c <= o.c2 && o.r1 === 1)) vyber(X.adresa(1, +h.dataset.c), true, X.adresa(rozmer().R, +h.dataset.c));
  if (h.dataset.r && !(+h.dataset.r >= o.r1 && +h.dataset.r <= o.r2 && o.c1 === 1)) vyber(X.adresa(+h.dataset.r, 1), true, X.adresa(+h.dataset.r, rozmer().C));
  const n = $('nabStruktura');
  zavriNabidky(); n.hidden = false;
  n.style.top = Math.min(e.clientY, innerHeight - n.offsetHeight - 6) + 'px';
  n.style.left = Math.min(e.clientX, innerWidth - n.offsetWidth - 6) + 'px';
});
function otevriHledani() {
  const d = $('dlgHledat');
  if (!d.open) d.show();
  $('hlText').focus(); $('hlText').select();
}
const volbyHledani = () => ({ vzorce: $('hlVzorce').checked, cela: $('hlCela').checked, velikost: $('hlVelikost').checked });
function vypisNalezy(adr, nadpis) {
  $('hlVysledky').innerHTML = `<li><b>${esc(nadpis)}</b></li>` + adr.slice(0, 200).map(a => `<li><button class="adr" data-jdi="${esc(a)}">${esc(a)}</button> <code>${esc(list.surova(a))}</code></li>`).join('');
}
$('hlNajdi').addEventListener('click', () => {
  const adr = list.hledej($('hlText').value, volbyHledani());
  vypisNalezy(adr, adr.length ? `Nalezeno ${adr.length}` : 'Nic nenalezeno');
  if (adr.length) vyber(adr[0]);
});
$('hlNahrad').addEventListener('click', () => {
  const t = $('hlText').value; if (!t) return;
  let adr = [];
  zmena(`nahrazení „${t}“`, () => { adr = list.nahrad(t, $('hlNove').value, volbyHledani()); });
  vypisNalezy(adr, `Nahrazeno v ${adr.length} buňkách (Ctrl+Z vrátí)`);
  vyber(vybrana, true, konec);
});
$('hlText').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('hlNajdi').click(); } });
$('hlZavri').addEventListener('click', () => $('dlgHledat').close());
$('hlVysledky').addEventListener('click', e => { const b = e.target.closest('[data-jdi]'); if (b && !(edit && !potvrd())) vyber(b.dataset.jdi); });
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && (e.key === 'h' || e.key === 'H' || e.key === 'f' || e.key === 'F') && stav.rezim !== 'tahak' && !e.target.matches('textarea')) { e.preventDefault(); otevriHledani(); }
});

/* ---------- listy sešitu a názvy ---------- */
function kresliZalozkyListu() {
  const el = $('listyZal');
  el.hidden = stav.rezim !== 'piskoviste';
  if (el.hidden) return;
  el.innerHTML = sesit.listy.map((l, i) => `<button role="tab" data-list="${i}" aria-selected="${l === list}" title="Dvojklik = přejmenovat">${esc(l.nazev)}${l === list && sesit.listy.length > 1 ? `<span class="smaz" data-smaz-list="${i}" title="Odstranit list" role="button" aria-label="Odstranit list ${esc(l.nazev)}">×</span>` : ''}</button>`).join('')
    + '<button class="pridat" data-novy-list title="Přidat list" aria-label="Přidat list">＋</button>';
}
function prepniList(i) {
  if (edit && !potvrd()) return;
  list = sesit.listy[i]; sipky = []; hranice = null;
  ulozList(); kresliZalozkyListu(); kresliMrizku(); vyber('A1');
}
$('listyZal').addEventListener('click', async e => {
  const sm = e.target.closest('[data-smaz-list]');
  if (sm) {
    e.stopPropagation();
    const l = sesit.listy[+sm.dataset.smazList];
    if (!await Dialog.potvrd(`Odstranit list „${l.nazev}“? Odkazy na něj se změní na ${X.CHYBY.REF[jaz()]}.`)) return;
    zmena(`odstranění listu ${l.nazev}`, () => { sesit.smazList(l.nazev); list = sesit.listy[0]; });
    kresliZalozkyListu(); vyber('A1');
    return;
  }
  if (e.target.closest('[data-novy-list]')) {
    const n = sesit.volnyNazev();
    zmena(`nový list ${n}`, () => { list = sesit.pridejList(n); });
    kresliZalozkyListu(); vyber('A1');
    info(`Přidán list ${esc(n)}. Na jeho buňky se z jiného listu odkážete <code>${esc(n)}!A1</code>.`);
    return;
  }
  const b = e.target.closest('[data-list]');
  if (b && sesit.listy[+b.dataset.list] !== list) prepniList(+b.dataset.list);
});
$('listyZal').addEventListener('dblclick', async e => {
  const b = e.target.closest('[data-list]'); if (!b) return;
  const l = sesit.listy[+b.dataset.list];
  const novy = (await Dialog.zeptej('Nový název listu:', l.nazev) || '').trim();
  if (!novy || novy === l.nazev) return;
  if (/[\\/?*[\]:!]/.test(novy) || novy.length > 31) return Dialog.chyba('Název listu nesmí obsahovat \\ / ? * [ ] : ! a může mít nejvýš 31 znaků.');
  if (sesit.list(novy)) return Dialog.chyba(`List „${novy}“ už existuje.`);
  zmena(`přejmenování listu na ${novy}`, () => sesit.prejmenujList(l.nazev, novy));
  kresliZalozkyListu(); vyber(vybrana, true, konec);
  info(`List přejmenován na ${esc(novy)} – odkazy ve vzorcích ostatních listů se přepsaly.`);
});
/* správce názvů */
function kresliNazvy() {
  const n = Object.entries(sesit.nazvy);
  $('nazvySeznam').innerHTML = n.length ? '<table><tr><th>Název</th><th>Odkazuje na</th><th>Hodnota</th><th></th></tr>' + n.map(([k, d]) => {
    let v = '';
    try { const r = list.kroky('=' + k).vysledek; v = X.jePole(r) ? `oblast ${r.h.length}×${r.h[0].length}` : lit(r); } catch (er) { v = '?'; }
    return `<tr><td><b>${esc(k)}</b></td><td><code>${esc(d)}</code></td><td><code>${esc(v)}</code></td><td><button class="btn mini" data-uprav-nazev="${esc(k)}" title="Upravit">✎</button> <button class="btn mini" data-smaz-nazev="${esc(k)}" aria-label="Smazat název ${esc(k)}">×</button></td></tr>`;
  }).join('') + '</table>' : '<p class="rz-prazdne">Zatím žádné názvy.</p>';
}
$('btnNazvy').addEventListener('click', () => {
  const o = obl(), abs = (r, c) => '$' + X.cisloNaSloupec(c) + '$' + r;
  $('nzDef').value = '=' + X.textListu(list.nazev) + '!' + abs(o.r1, o.c1) + (jednaBunka(o) ? '' : ':' + abs(o.r2, o.c2));
  $('nzNazev').value = ''; $('nzZprava').textContent = '';
  kresliNazvy(); $('dlgNazvy').showModal(); $('nzNazev').focus();
});
$('nzPridej').addEventListener('click', () => {
  const n = $('nzNazev').value.trim(), d = $('nzDef').value.trim();
  const ch = sesit.platnyNazev(n) || (!d ? 'Vyplňte, na co název odkazuje.' : null);
  if (ch) { $('nzZprava').textContent = '⚠ ' + ch; return; }
  try { X.rozeber(d.startsWith('=') ? d : '=' + d, jaz()); } catch (er) { $('nzZprava').textContent = '⚠ ' + er.message; return; }
  zmena(`název ${n}`, () => { sesit.nazvy[n.toUpperCase()] = d.startsWith('=') ? d : '=' + d; });
  $('nzNazev').value = ''; $('nzZprava').textContent = `Název ${n.toUpperCase()} uložen – použijte ho ve vzorci, např. =${n.toUpperCase()}*2.`;
  kresliNazvy(); vyber(vybrana, true, konec);
});
$('nazvySeznam').addEventListener('click', e => {
  const sm = e.target.closest('[data-smaz-nazev]');
  if (sm) { zmena(`smazání názvu ${sm.dataset.smazNazev}`, () => { delete sesit.nazvy[sm.dataset.smazNazev]; }); kresliNazvy(); return; }
  const up = e.target.closest('[data-uprav-nazev]');
  if (up) { $('nzNazev').value = up.dataset.upravNazev; $('nzDef').value = sesit.nazvy[up.dataset.upravNazev]; $('nzDef').focus(); }
});
$('nzZavri').addEventListener('click', () => $('dlgNazvy').close());

/* ---------- soubory: moje sešity, import/export Excelu a CSV, sdílení ---------- */
const prazdnySesit = d => !d || !(d.listy || [{ bunky: d.bunky }]).some(l => Object.keys(l.bunky || {}).length);
function zalohujPiskoviste() {
  if (prazdnySesit(stav.piskoviste)) return null;
  /* stejný obsah už v Mých sešitech je – žádná další záloha */
  const json = JSON.stringify(stav.piskoviste);
  if (Object.values(stav.sesity || {}).some(x => JSON.stringify(x) === json)) return null;
  const d = new Date(), z = `Záloha ${d.getDate()}. ${d.getMonth() + 1}. ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  let n = z; for (let i = 2; stav.sesity && stav.sesity[n]; i++) n = `${z} (${i})`;
  stav.sesity = { ...(stav.sesity || {}), [n]: stav.piskoviste };
  const zalohy = Object.keys(stav.sesity).filter(k => k.startsWith('Záloha '));   /* nejvýš 5 nejnovějších záloh */
  while (zalohy.length > 5) delete stav.sesity[zalohy.shift()];
  return n;
}
function otevriVPiskovisti(data, popis) {
  if (edit && !potvrd()) return;
  if (stav.rezim === 'piskoviste') ulozList();
  const z = zalohujPiskoviste();
  stav.piskoviste = data; uloz();
  nastavRezim('piskoviste');
  info(`${popis}${z ? ` Předchozí obsah pískoviště je uložený v Mých sešitech jako „${esc(z)}“.` : ''}`);
}
function kresliMojeSesity() {
  const n = Object.keys(stav.sesity || {});
  $('mojeSesity').innerHTML = n.length ? n.map(k => `<div class="radek-sesitu"><button class="tl" data-otevri-sesit="${esc(k)}">📗 ${esc(k)}</button><button class="tl ik" data-smaz-sesit="${esc(k)}" title="Smazat" aria-label="Smazat sešit ${esc(k)}">×</button></div>`).join('')
    : '<div class="prazdne">zatím žádné</div>';
}
$('btnSoubor').addEventListener('mousedown', kresliMojeSesity);
let xlsxSlib = null;
function nactiXLSX() {
  if (window.XLSX) return Promise.resolve();
  return xlsxSlib || (xlsxSlib = new Promise((ok, ch) => {
    const sc = document.createElement('script'); sc.src = 'lib/xlsx/xlsx.full.min.js';
    sc.onload = ok; sc.onerror = () => { xlsxSlib = null; ch(new Error('Knihovnu pro Excel se nepodařilo načíst.')); };
    document.head.appendChild(sc);
  }));
}
function stahni(blob, nazev) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nazev;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const KODY_CHYB = { NULL: 0, DIV0: 7, VALUE: 15, REF: 23, NAME: 29, NUM: 36, NA: 42, CIRC: 15, SPILL: 15, CALC: 15 };
function formatNaZ(f) {
  if (!f || !f.t && f.d === undefined && !f.tis) return null;
  const des = d => (d > 0 ? '.' + '0'.repeat(d) : '');
  switch (f.t) {
    case 'mena': return `#,##0${des(f.d ?? 2)} "Kč"`;
    case 'proc': return `0${des(f.d ?? 0)}%`;
    case 'datum': return 'd.m.yyyy';
    case 'text': return '@';
    default: return (f.tis ? '#,##0' : '0') + des(f.d ?? (f.t === 'cislo' ? 2 : 0));
  }
}
function zNaFormat(z) {
  if (!z || z === 'General') return null;
  if (z === '@') return { t: 'text' };
  if (window.XLSX && XLSX.SSF.is_date(z)) return { t: 'datum' };
  const d = (/\.(0+)/.exec(z) || [, ''])[1].length;
  if (/Kč|€|\$/.test(z)) return { t: 'mena', d, tis: /#,##0/.test(z) };
  if (/%/.test(z)) return { t: 'proc', d };
  if (/0/.test(z)) return { t: 'cislo', d, tis: /#,##0/.test(z) || undefined };
  return null;
}
function sesitNaWorkbook() {
  const wb = XLSX.utils.book_new();
  for (const l of sesit.listy) {
    const ws = {}; let maxR = 1, maxC = 1;
    for (const [a, raw] of Object.entries(l.bunky)) {
      const p = X.rozeberAdresu(a); if (!p) continue;
      maxR = Math.max(maxR, p.r); maxC = Math.max(maxC, p.c);
      let v = l.hodnota(a); if (X.jePole(v)) v = v.h[0][0];
      const cell = {};
      if (raw.startsWith('=') && l.format[a]?.t !== 'text') cell.f = X.prelozVzorec(raw, l.jazyk, 'en').slice(1);
      if (typeof v === 'number') { cell.t = 'n'; cell.v = v; }
      else if (typeof v === 'boolean') { cell.t = 'b'; cell.v = v; }
      else if (X.jeChyba(v)) { cell.t = 'e'; cell.v = KODY_CHYB[v.kod] ?? 15; }
      else { cell.t = 's'; cell.v = v === null || v === undefined ? '' : String(v); }
      const z = formatNaZ(l.format[a]); if (z) cell.z = z;
      ws[XLSX.utils.encode_cell({ r: p.r - 1, c: p.c - 1 })] = cell;
    }
    ws['!ref'] = 'A1:' + X.adresa(maxR, maxC);
    if (l.sirky && Object.keys(l.sirky).length) ws['!cols'] = Array.from({ length: maxC }, (_, i) => (l.sirky[i + 1] ? { wpx: l.sirky[i + 1] } : {}));
    XLSX.utils.book_append_sheet(wb, ws, l.nazev.slice(0, 31));
  }
  const nazvy = Object.entries(sesit.nazvy);
  if (nazvy.length) wb.Workbook = { Names: nazvy.map(([n, d]) => ({ Name: n, Ref: X.prelozVzorec(d, jaz(), 'en').slice(1) })) };
  return wb;
}
async function exportXlsx() {
  await nactiXLSX();
  const wb = sesitNaWorkbook();
  XLSX.writeFile(wb, (stav.rezim === 'lekce' ? 'lekce-' + stav.lekce : 'sesit') + '.xlsx');
  info('Sešit stažen jako .xlsx – otevře se v Excelu i Calcu se vzorci. Tučné písmo a barvy se nepřenášejí.');
}
function exportCsv() {
  const odd = jaz() === 'en' ? ',' : ';';
  let maxR = 0, maxC = 0;
  for (const a of Object.keys(list.bunky)) { const p = X.rozeberAdresu(a); maxR = Math.max(maxR, p.r); maxC = Math.max(maxC, p.c); }
  const pole = t => /["\n\r]/.test(t) || t.includes(odd) ? '"' + t.replace(/"/g, '""') + '"' : t;
  const text = Array.from({ length: maxR }, (_, r) => Array.from({ length: maxC }, (_, c) => pole(list.zobraz(X.adresa(r + 1, c + 1)))).join(odd)).join('\r\n');
  stahni(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }), list.nazev + '.csv');
  info(`List ${esc(list.nazev)} stažen jako CSV (hodnoty, oddělovač „${odd}“). Vzorce CSV neukládá – na ně je .xlsx.`);
}
async function importSoubor(soubor) {
  try {
    await nactiXLSX();
    const wb = XLSX.read(await soubor.arrayBuffer(), { cellFormula: true, cellNF: true, cellDates: false });
    const s = new X.Sesit('en');
    let oriznuto = false, bunek = 0;
    for (const nazev of wb.SheetNames) {
      const ws = wb.Sheets[nazev], l = new X.List({}, { jazyk: 'en' });
      if (ws['!ref']) {
        const rozsah = XLSX.utils.decode_range(ws['!ref']);
        for (let r = rozsah.s.r; r <= rozsah.e.r; r++) for (let c = rozsah.s.c; c <= rozsah.e.c; c++) {
          const cell = ws[XLSX.utils.encode_cell({ r, c })]; if (!cell) continue;
          if (r >= 500 || c >= 52 || bunek > 20000) { oriznuto = true; continue; }
          const a = X.adresa(r + 1, c + 1);
          let raw;
          if (cell.f) raw = '=' + cell.f.replace(/_xlfn\.|_xlws\.|_xlpm\./g, '');
          else if (cell.t === 'n') raw = String(cell.v);
          else if (cell.t === 'b') raw = cell.v ? 'TRUE' : 'FALSE';
          else if (cell.t === 'e') raw = cell.w || '#N/A';
          else { raw = String(cell.v ?? ''); if (/^[\d\s.,%+-]+$/.test(raw) || /^\d{1,2}\.\s*\d{1,2}\.\s*\d{4}$/.test(raw)) raw = "'" + raw; }
          if (raw === '') continue;
          l.bunky[a] = raw; bunek++;
          const f = zNaFormat(cell.z); if (f) l.format[a] = f;
          l.radku = Math.max(l.radku, r + 1); l.sloupcu = Math.max(l.sloupcu, c + 1);
        }
      }
      if (ws['!cols']) { l.sirky = {}; ws['!cols'].forEach((x, i) => { if (x && x.wpx) l.sirky[i + 1] = Math.round(x.wpx); }); }
      s.pridejList(nazev.replace(/[\\/?*[\]:!]/g, '_').slice(0, 31) || s.volnyNazev(), l);
    }
    for (const n of wb.Workbook?.Names || []) if (n.Sheet === undefined && n.Name && n.Ref && !n.Name.startsWith('_')) s.nazvy[n.Name.toUpperCase()] = '=' + n.Ref;
    if (!s.listy.length) s.pridejList('List1');
    s.prepniJazyk(jaz());
    const nezname = new Set();
    s.listy.forEach(l => Object.values(l.bunky).forEach(raw => { if (raw.startsWith('=')) (raw.match(/[A-Z][A-Z0-9.]*(?=\()/gi) || []).forEach(f => { if (!X.ALIAS[f.toUpperCase()]) nezname.add(f.toUpperCase()); }); }));
    otevriVPiskovisti({ ...s.serializuj(), aktivni: 0 }, `Otevřen soubor ${esc(soubor.name)}: ${tvar(s.listy.length, 'list', 'listy', 'listů')}, ${tvar(bunek, 'buňka', 'buňky', 'buněk')}.${oriznuto ? ' Velký soubor byl oříznut na 500 řádků × 52 sloupců.' : ''}${nezname.size ? ` ⚠ Funkce, které tato výuková verze nezná (ukážou ${esc(X.CHYBY.NAME[jaz()])}): ${esc([...nezname].slice(0, 12).join(', '))}.` : ''}`);
  } catch (e) {
    Dialog.chyba('Soubor se nepodařilo otevřít: ' + e.message);
  }
}
/* sdílení: komprese do odkazu */
const b64url = u8 => btoa(String.fromCharCode(...u8)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const zB64url = t => Uint8Array.from(atob(t.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
async function zabal(obj) {
  const proud = new Blob([JSON.stringify(obj)]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return b64url(new Uint8Array(await new Response(proud).arrayBuffer()));
}
async function rozbal(t) {
  const proud = new Blob([zB64url(t)]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return JSON.parse(await new Response(proud).text());
}
async function sdilet() {
  const kod = await zabal(dataSesitu());
  const url = location.href.split('#')[0] + '#sesit=' + kod;
  if (url.length > 60000) return Dialog.chyba('Sešit je na odkaz moc velký – použijte export do .xlsx.');
  try { await navigator.clipboard.writeText(url); info(`🔗 Odkaz (${url.length} znaků) je ve schránce. Kdo ho otevře, uvidí tento sešit ve svém pískovišti.`); }
  catch (e) { await Dialog.zeptej('Zkopírujte odkaz:', url); }
}
async function nactiZOdkazu() {
  const m = /#sesit=([\w-]+)/.exec(location.hash); if (!m) return false;
  try {
    const d = await rozbal(m[1]);
    history.replaceState(null, '', location.href.split('#')[0]);
    otevriVPiskovisti(d, 'Otevřen sdílený sešit z odkazu.');
    return true;
  } catch (e) { Dialog.chyba('Odkaz na sešit je poškozený.'); return false; }
}
$('nabSoubor').addEventListener('click', async e => {
  const os = e.target.closest('[data-otevri-sesit]'), sm = e.target.closest('[data-smaz-sesit]');
  if (sm) { e.stopPropagation(); const k = sm.dataset.smazSesit; if (await Dialog.potvrd(`Smazat uložený sešit „${k}“?`)) { delete stav.sesity[k]; uloz(); kresliMojeSesity(); } return; }
  zavriNabidky();
  if (os) return otevriVPiskovisti(stav.sesity[os.dataset.otevriSesit], `Otevřen sešit „${esc(os.dataset.otevriSesit)}“.`);
  const b = e.target.closest('[data-soubor]'); if (!b) return;
  const akce = b.dataset.soubor;
  try {
    if (akce === 'novy') otevriVPiskovisti(null, 'Nový prázdný sešit.');
    else if (akce === 'ulozit') {
      if (stav.rezim !== 'piskoviste') return info('Pod jménem se ukládá pískoviště – přepněte do něj (nebo stáhněte .xlsx).');
      const n = (await Dialog.zeptej('Název sešitu:', 'Můj sešit') || '').trim(); if (!n) return;
      ulozList(); stav.sesity = { ...(stav.sesity || {}), [n]: stav.piskoviste }; uloz();
      info(`Sešit uložen jako „${esc(n)}“ (📁 Soubor → Moje sešity).`);
    }
    else if (akce === 'import') $('souborVstup').click();
    else if (akce === 'xlsx') await exportXlsx();
    else if (akce === 'csv') exportCsv();
    else if (akce === 'sdilet') await sdilet();
  } catch (er) { Dialog.chyba(er.message); }
});
$('souborVstup').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) importSoubor(f); });

/* ---------- procvičování a zkouška ---------- */
const PV = window.XLV_PROCVIC;
const pv = { uloha: null, zkouska: null, souhrn: null, casovac: null };
const OBTIZNOST = { 1: 'lehká', 2: 'střední', 3: 'těžká' };
function stavProcvic() { return stav.procvic || (stav.procvic = { temata: Object.keys(PV.TEMATA), obtiznost: 2, stat: {}, historie: [] }); }
function novaUloha() {
  const sp = stavProcvic();
  const u = PV.vygeneruj(sp.temata, sp.obtiznost);
  const l = new X.List(u.bunky, { jazyk: 'en' }); l.prepniJazyk(jaz());
  pv.uloha = { ...u, data: { jazyk: jaz(), listy: [{ nazev: 'List1', bunky: l.bunky, format: l.format }] }, napoveda: 0, zapocteno: false, vysledek: null };
}
const mmss = ms => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
function htmlProcvic() {
  const sp = stavProcvic(), u = pv.uloha, z = pv.zkouska;
  let h = `<h2>🎯 Procvičování</h2><p>Úlohy se generují s náhodnými daty, takže žádné dvě nejsou stejné. Vzorec napište do šrafované buňky v listu vpravo a zkontrolujte – kontrola ho vyzkouší i se změněnými daty.</p>`;
  if (!z) h += `<div class="pv-nastaveni"><b>Témata</b><div class="pv-temata">${Object.entries(PV.TEMATA).map(([k, n]) => `<label><input type="checkbox" data-pv-tema="${k}"${sp.temata.includes(k) ? ' checked' : ''}> ${esc(n)}</label>`).join('')}</div>
    <label>Obtížnost <select class="tl" id="pvObtiznost">${[1, 2, 3].map(o => `<option value="${o}"${sp.obtiznost === o ? ' selected' : ''}>${OBTIZNOST[o]}</option>`).join('')}</select></label>
    <div class="rb-akce"><button class="btn hlavni" data-pv="nova">🎲 Nová úloha</button><button class="btn" data-pv="zkouska">⏱ Zkouška (8 úloh na čas)</button></div></div>`;
  else h += `<div class="pv-zkouska"><span>Zkouška: úloha ${z.i + 1} z ${z.n} · správně ${z.vysledky.filter(x => x.ok).length}</span><span><span id="pvCas">${mmss(Date.now() - z.start)}</span> <button class="btn mini" data-pv="ukoncit">⏹ Ukončit</button></span></div>`;
  if (pv.souhrn) {
    const s = pv.souhrn;
    h += `<div class="uloha hotovo"><div class="u-hlava">Výsledek zkoušky</div><div class="pv-vysledek">${s.ok} / ${s.n} správně (${Math.round(100 * s.ok / s.n)} %) · ${mmss(s.cas)}</div>
      <ul>${s.vysledky.map(v => `<li>${v.ok ? '✅' : '❌'} ${esc(PV.TEMATA[v.tema])}</li>`).join('')}</ul>
      <div class="rb-akce"><button class="btn hlavni" data-pv="zkouska">⏱ Nová zkouška</button><button class="btn" data-pv="konec">Zpět k tréninku</button></div></div>`;
  } else if (u) {
    h += `<div class="uloha${u.vysledek?.ok ? ' hotovo' : ''}" data-pv-uloha><div class="u-hlava"><span>${esc(PV.TEMATA[u.tema])} · ${OBTIZNOST[u.uroven]} · buňka <button class="adr" data-adr="${u.cil}">${u.cil}</button></span></div>
      <div class="u-zad">${zpracuj(u.zadani)}</div>
      <div class="u-akce">
        <button class="btn hlavni mini" data-pv="kontrola"${z && u.vysledek ? ' disabled' : ''}>✔ Zkontrolovat</button>
        ${z ? '' : `<button class="btn mini" data-pv="napoveda"${u.napoveda >= (u.napovedy || []).length ? ' disabled' : ''}>💡 Nápověda</button><button class="btn mini" data-pv="reseni">👁 Řešení</button>`}
        <button class="btn mini" data-pv="dalsi">${z ? (z.i + 1 < z.n ? 'Další úloha ▶' : 'Dokončit zkoušku ▶') : '⏭ Další úloha'}</button>
      </div>
      <div class="u-napovedy">${(u.napovedy || []).slice(0, u.napoveda).map(t => `<p>💡 ${zpracuj(t)}</p>`).join('')}</div>
      <div class="u-vysl">${u.vysledek ? `<div class="zprava ${u.vysledek.ok ? 'ok' : 'ne'}">${u.vysledek.ok ? '🎉 ' : '✗ '}${esc(u.vysledek.zprava)}</div>` : ''}${u.ukazReseni ? `<div class="zprava">Jedno z možných řešení: ${cip(u.reseni)}</div>` : ''}</div></div>`;
  }
  /* statistika */
  const st = Object.entries(sp.stat).filter(([, v]) => v.celkem);
  if (st.length) {
    h += '<h3>📊 Úspěšnost podle témat</h3><table class="pv-stat">' + st.map(([k, v]) => {
      const p = Math.round(100 * v.ok / v.celkem), slabe = p < 70 && v.celkem >= 2;
      return `<tr><td>${esc(PV.TEMATA[k] || k)}</td><td><div class="pv-pruh${slabe ? ' slabe' : ''}"><i style="width:${p}%"></i></div></td><td>${v.ok}/${v.celkem} (${p} %)</td><td>${slabe ? `<button class="btn mini" data-pv-jen="${k}">Procvičit</button>` : ''}</td></tr>`;
    }).join('') + '</table>';
    const slaba = st.filter(([, v]) => v.celkem >= 2 && v.ok / v.celkem < 0.7).map(([k]) => PV.TEMATA[k]);
    h += slaba.length ? `<p>⚠️ <b>Slabá místa:</b> ${esc(slaba.join(', '))} – zopakujte příslušnou lekci a procvičte.</p>` : '<p>✅ Žádné slabé místo (pod 70 %).</p>';
  }
  if (sp.historie.length) h += '<h3>⏱ Poslední zkoušky</h3><ul>' + sp.historie.slice(-5).reverse().map(x => `<li>${esc(x.datum)}: ${x.ok}/${x.n} (${Math.round(100 * x.ok / x.n)} %) za ${mmss(x.cas)}</li>`).join('') + '</ul>';
  return h;
}
function zapocti(ok) {
  const u = pv.uloha; if (!u || u.zapocteno) return;
  u.zapocteno = true;
  const sp = stavProcvic(), s = sp.stat[u.tema] || (sp.stat[u.tema] = { ok: 0, celkem: 0 });
  s.celkem++; if (ok) s.ok++;
  if (pv.zkouska) pv.zkouska.vysledky.push({ tema: u.tema, ok });
  uloz();
}
function dalsiUlohaPV() {
  const z = pv.zkouska;
  if (z) {
    if (!pv.uloha.zapocteno) zapocti(false);
    z.i++;
    if (z.i >= z.n) {
      clearInterval(pv.casovac);
      const ok = z.vysledky.filter(x => x.ok).length, cas = Date.now() - z.start, d = new Date();
      pv.souhrn = { ok, n: z.n, cas, vysledky: z.vysledky };
      const sp = stavProcvic(); sp.historie.push({ datum: `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`, ok, n: z.n, cas }); sp.historie = sp.historie.slice(-20); uloz();
      pv.zkouska = null; pv.uloha = null;
      return nastavRezim('procvic');
    }
  }
  novaUloha(); nastavRezim('procvic');
}
$('vyklad').addEventListener('change', e => {
  if (stav.rezim !== 'procvic') return;
  const sp = stavProcvic();
  if (e.target.matches('[data-pv-tema]')) { sp.temata = [...document.querySelectorAll('[data-pv-tema]:checked')].map(x => x.dataset.pvTema); uloz(); }
  if (e.target.id === 'pvObtiznost') { sp.obtiznost = +e.target.value; uloz(); }
});
$('vyklad').addEventListener('click', e => {
  if (stav.rezim !== 'procvic') return;
  const jen = e.target.closest('[data-pv-jen]');
  if (jen) { stavProcvic().temata = [jen.dataset.pvJen]; uloz(); pv.souhrn = null; novaUloha(); return nastavRezim('procvic'); }
  const b = e.target.closest('[data-pv]'); if (!b) return;
  const a = b.dataset.pv, u = pv.uloha;
  if (a === 'nova') { if (!stavProcvic().temata.length) return info('Vyberte aspoň jedno téma.'); pv.souhrn = null; novaUloha(); nastavRezim('procvic'); }
  else if (a === 'zkouska') {
    if (!stavProcvic().temata.length) return info('Vyberte aspoň jedno téma.');
    pv.souhrn = null; pv.zkouska = { i: 0, n: 8, vysledky: [], start: Date.now() };
    clearInterval(pv.casovac);
    pv.casovac = setInterval(() => { const el = $('pvCas'); if (el && pv.zkouska) el.textContent = mmss(Date.now() - pv.zkouska.start); }, 1000);
    novaUloha(); nastavRezim('procvic');
  }
  else if (a === 'konec') { pv.souhrn = null; nastavRezim('procvic'); }
  else if (a === 'ukoncit') { clearInterval(pv.casovac); pv.zkouska = null; pv.souhrn = null; novaUloha(); nastavRezim('procvic'); info('Zkouška byla ukončena bez hodnocení.'); }
  else if (a === 'kontrola' && u) {
    if (edit && !potvrd()) return;
    u.vysledek = X.zkontroluj(list, u, list.surova(u.cil));
    zapocti(u.vysledek.ok);
    kresliVyklad(); kresliMrizku(); vyber(u.cil);
  }
  else if (a === 'napoveda' && u) { u.napoveda++; kresliVyklad(); }
  else if (a === 'reseni' && u) { u.ukazReseni = true; if (!u.zapocteno) zapocti(false); kresliVyklad(); }
  else if (a === 'dalsi') dalsiUlohaPV();
});

/* ---------- učitelský režim: vlastní sady úloh ---------- */
const sady = () => stav.sady || (stav.sady = []);
const aktSada = () => sady().find(x => x.id === stav.ucitelSada) || null;
function novaSada() {
  const s = { id: 's' + Date.now().toString(36), nazev: 'Nová sada úloh', popis: '', ulohy: [], data: null };
  sady().push(s); stav.ucitelSada = s.id; uloz(); return s;
}
/* list pro žáka: buňky v anglickém zápisu, cílové buňky úloh vyprázdněné */
function bunkyProZaka(s) {
  const d = s.data || { listy: [{ nazev: 'List1', bunky: {} }] };
  const l = new X.List({}, { jazyk: d.jazyk || jaz() }); l.bunky = { ...d.listy[0].bunky }; l.format = { ...(d.listy[0].format || {}) };
  for (const u of s.ulohy) { const c = u.kopirovat ? rozsahAdres(u.kopirovat) : [u.cil]; c.concat(u.cil).forEach(a => delete l.bunky[a]); }
  l.prepniJazyk('en');
  const b = { ...l.bunky };
  for (const [a, f] of Object.entries(l.format)) if (b[a] !== undefined) b[a] = { v: b[a], f };
  return b;
}
function sadaJakoLekce(id) {
  if (!String(id).startsWith('sada:')) return null;
  const s = sady().find(x => x.id === id.slice(5)); if (!s) return null;
  try {
    return { id, sada: true, emoji: '📝', nazev: s.nazev, cile: [], text: s.popis ? `<p>${esc(s.popis).replace(/\n/g, '<br>')}</p>` : '', list: { bunky: bunkyProZaka(s) }, predpovez: [], ulohy: s.ulohy.map(u => ({ ...u, sada: true, napovedy: [] })) };
  } catch (e) { return null; }   /* poškozená sada nesmí shodit stránku */
}
const exportSady = s => ({ format: 'excel-vzorce-sada', verze: 1, nazev: s.nazev, popis: s.popis, bunky: bunkyProZaka(s), ulohy: s.ulohy, data: s.data });
const jeAdresa = a => typeof a === 'string' && /^[A-Z]{1,3}[1-9]\d{0,6}$/i.test(a);
const jeOblast = o => typeof o === 'string' && /^[A-Z]{1,3}[1-9]\d{0,6}:[A-Z]{1,3}[1-9]\d{0,6}$/i.test(o);
/* import sady (soubor nebo odkaz = nedůvěryhodný vstup): ověřit každou položku */
function importSady(d) {
  if (!d || d.format !== 'excel-vzorce-sada' || !Array.isArray(d.ulohy)) throw new Error('Soubor není sada úloh z této stránky.');
  const lzeRozebrat = f => { try { X.rozeber(f, 'en'); return true; } catch (e) { return false; } };
  const ulohy = d.ulohy.filter(u => u && jeAdresa(u.cil) && typeof u.reseni === 'string' && u.reseni.startsWith('=') && lzeRozebrat(u.reseni)).slice(0, 100)
    .map((u, i) => ({ id: /^[\w-]{1,40}$/.test(u.id) ? u.id : 'u' + i, cil: u.cil.toUpperCase(), reseni: u.reseni.slice(0, 2000), zadani: String(u.zadani || '').slice(0, 3000),
      kopirovat: jeOblast(u.kopirovat) ? u.kopirovat.toUpperCase() : undefined, vyzaduje: Array.isArray(u.vyzaduje) ? u.vyzaduje.filter(f => X.FUNKCE[f]) : undefined, absolutni: !!u.absolutni }));
  const nazev = String(d.nazev || 'Sada').slice(0, 100), popis = String(d.popis || '').slice(0, 3000);
  /* stejná sada (třeba opakovaně otevřený odkaz) se nepřidá znovu */
  const otisk = JSON.stringify([nazev, popis, ulohy.map(u => [u.cil, u.reseni, u.zadani, u.kopirovat || ''])]);
  const stejna = sady().find(x => x.otisk === otisk);
  if (stejna) return stejna;
  const s = { id: 's' + Date.now().toString(36), nazev, popis, ulohy, otisk };
  if (d.data && Array.isArray(d.data.listy)) s.data = { ...X.Sesit.obnov(d.data, jaz()).serializuj(), aktivni: 0 };
  else {
    const b = {};
    for (const [a, v] of Object.entries(d.bunky && typeof d.bunky === 'object' ? d.bunky : {})) if (jeAdresa(a) && v !== null && v !== undefined) b[a.toUpperCase()] = typeof v === 'object' ? { v: String(v.v ?? ''), f: v.f } : String(v);
    const l = new X.List(b, { jazyk: 'en' }); ulohy.forEach(u => l.nastav(u.cil, u.reseni)); l.prepniJazyk(jaz());
    s.data = { ...X.Sesit.obnov({ jazyk: jaz(), listy: [{ nazev: 'List1', bunky: l.bunky, format: l.format }] }, jaz()).serializuj(), aktivni: 0 };
  }
  sady().push(s); uloz(); return s;
}
function htmlUcitel() {
  const s = aktSada();
  let h = `<h2>👩‍🏫 Učitelský režim</h2><p>Sestavte vlastní sadu úloh: v listu vpravo připravte data, do cílových buněk napište vzorová řešení a každou z nich přidejte jako úlohu. Žák pak sadu dostane jako lekci – cílové buňky budou prázdné a kontrola ověří jeho vzorec i na změněných datech.</p>
    <h3>Moje sady</h3><ul class="uc-sady">${sady().map(x => `<li class="${x === s ? 'akt' : ''}"><b>${esc(x.nazev)}</b> <span class="rz-prazdne">${tvar(x.ulohy.length, 'úloha', 'úlohy', 'úloh')}</span>
      <button class="btn mini" data-uc="upravit" data-id="${x.id}">✎ Upravit</button><button class="btn mini" data-uc="zak" data-id="${x.id}">▶ Jako žák</button>
      <button class="btn mini" data-uc="json" data-id="${x.id}">📤 JSON</button><button class="btn mini" data-uc="odkaz" data-id="${x.id}">🔗 Odkaz</button><button class="btn mini" data-uc="smazat" data-id="${x.id}" aria-label="Smazat sadu">🗑</button></li>`).join('') || '<li>Zatím žádná sada.</li>'}</ul>
    <div class="rb-akce"><button class="btn" data-uc="nova">➕ Nová sada</button><button class="btn" data-uc="import">📥 Importovat sadu (JSON)</button></div>`;
  if (!s) return h;
  h += `<h3>Úpravy sady</h3>
    <label class="uc-pole">Název <input class="vstup" data-uc-pole="nazev" value="${esc(s.nazev)}"></label>
    <label class="uc-pole">Úvodní text pro žáky <textarea class="vstup" rows="3" data-uc-pole="popis">${esc(s.popis)}</textarea></label>
    <div class="rb-akce"><button class="btn hlavni" data-uc="pridat">➕ Přidat úlohu z vybrané buňky (${vybrana})</button><button class="btn" data-uc="overit">✔ Ověřit sadu</button></div>
    <div id="ucZprava"></div>`;
  s.ulohy.forEach((u, i) => {
    const fn = (() => { try { return [...X.rozborStromu(X.rozeber(u.reseni, 'en')).fn]; } catch (e) { return []; } })();
    h += `<div class="uc-uloha"><div class="radek"><b>Úloha ${i + 1}</b> · buňka <button class="adr" data-jdi-uc="${u.cil}">${u.cil}</button> · řešení <code>${esc(X.prelozVzorec(u.reseni, 'en', jaz()))}</code>
        <button class="btn mini" data-uc="smazU" data-i="${i}" aria-label="Smazat úlohu ${i + 1}">🗑</button></div>
      <label class="uc-pole">Zadání <textarea class="vstup" rows="2" data-u="${i}" data-upole="zadani">${esc(u.zadani)}</textarea></label>
      <div class="radek"><label>Kopírovat do <input class="vstup" size="9" placeholder="např. D2:D9" data-u="${i}" data-upole="kopirovat" value="${esc(u.kopirovat || '')}"></label>
        <label><input type="checkbox" data-u="${i}" data-upole="absolutni"${u.absolutni ? ' checked' : ''}> vyžadovat $</label>
        ${fn.map(f => `<label><input type="checkbox" data-u="${i}" data-upole="vyzaduje" data-fn="${f}"${(u.vyzaduje || []).includes(f) ? ' checked' : ''}> vyžadovat ${esc(X.nazevFunkce(f, jaz()))}</label>`).join('')}</div></div>`;
  });
  if (!s.ulohy.length) h += '<p class="rz-prazdne">Sada zatím nemá úlohy. Napište do buňky vzorové řešení (vzorec), vyberte ji a klikněte na „Přidat úlohu z vybrané buňky“.</p>';
  return h;
}
$('vyklad').addEventListener('input', e => {
  if (stav.rezim !== 'ucitel') return;
  const s = aktSada(); if (!s) return;
  const t = e.target;
  if (t.dataset.ucPole) { s[t.dataset.ucPole] = t.value; uloz(); return; }
  if (t.dataset.upole && t.type !== 'checkbox') {
    const u = s.ulohy[+t.dataset.u];
    if (t.dataset.upole === 'zadani') u.zadani = t.value;
    if (t.dataset.upole === 'kopirovat') { const v = t.value.trim().toUpperCase(); u.kopirovat = jeOblast(v) ? v : undefined; t.classList.toggle('neplatne', !!v && !u.kopirovat); }
    uloz();
  }
});
$('vyklad').addEventListener('change', e => {
  if (stav.rezim !== 'ucitel' || e.target.type !== 'checkbox') return;
  const s = aktSada(), t = e.target, u = s && s.ulohy[+t.dataset.u]; if (!u) return;
  if (t.dataset.upole === 'absolutni') u.absolutni = t.checked;
  if (t.dataset.upole === 'vyzaduje') { const v = new Set(u.vyzaduje || []); if (t.checked) v.add(t.dataset.fn); else v.delete(t.dataset.fn); u.vyzaduje = [...v]; }
  uloz();
});
$('vyklad').addEventListener('click', async e => {
  if (stav.rezim !== 'ucitel') return;
  const j = e.target.closest('[data-jdi-uc]'); if (j) { if (!(edit && !potvrd())) vyber(j.dataset.jdiUc); return; }
  const b = e.target.closest('[data-uc]'); if (!b) return;
  const a = b.dataset.uc, x = b.dataset.id ? sady().find(q => q.id === b.dataset.id) : aktSada();
  try {
    if (a === 'nova') { novaSada(); nastavRezim('ucitel'); }
    else if (a === 'upravit') { stav.ucitelSada = x.id; uloz(); nastavRezim('ucitel'); }
    else if (a === 'smazat') {
      if (await Dialog.potvrd(`Smazat sadu „${x.nazev}“?`)) {
        stav.sady = sady().filter(q => q !== x);
        if (stav.ucitelSada === x.id) stav.ucitelSada = null;
        if (stav.lekce === 'sada:' + x.id) stav.lekce = LEKCE[0].id;   /* smazaná sada nesmí zůstat aktivní lekcí */
        uloz(); nastavRezim('ucitel');
      }
    }
    else if (a === 'zak') { stav.lekce = 'sada:' + x.id; delete stav.listy['sada:' + x.id]; uloz(); nastavRezim('lekce'); }
    else if (a === 'json') stahni(new Blob([JSON.stringify(exportSady(x), null, 1)], { type: 'application/json' }), 'sada-' + x.nazev.replace(/[^\wÀ-ž]+/g, '-') + '.json');
    else if (a === 'odkaz') {
      const url = location.href.split('#')[0] + '#sada=' + await zabal(exportSady(x));
      try { await navigator.clipboard.writeText(url); info(`🔗 Odkaz na sadu „${esc(x.nazev)}“ je ve schránce (${url.length} znaků). Žák ho otevře a sada se mu objeví v menu lekcí.`); } catch (er) { await Dialog.zeptej('Zkopírujte odkaz:', url); }
    }
    else if (a === 'import') $('sadaVstup').click();
    else if (a === 'pridat') {
      if (edit && !potvrd()) return;
      const raw = list.surova(vybrana);
      if (!raw.startsWith('=')) return info('Do vybrané buňky nejdřív napište vzorové řešení (vzorec začínající =).');
      if (x.ulohy.some(u => u.cil === vybrana)) return info(`Buňka ${vybrana} už je cílem úlohy.`);
      x.ulohy.push({ id: 'u' + Date.now().toString(36), cil: vybrana, reseni: X.prelozVzorec(raw, jaz(), 'en'), zadani: `Do [[@${vybrana}]] spočítejte …`, kopirovat: vybrana !== konec ? textObl(obl()) : undefined });
      uloz(); kresliVyklad(); kresliMrizku();
      info(`Úloha přidána. Upravte zadání vlevo – [[@${vybrana}]] se žákovi zobrazí jako klikací odkaz na buňku.`);
    }
    else if (a === 'smazU') { x.ulohy.splice(+b.dataset.i, 1); uloz(); kresliVyklad(); kresliMrizku(); }
    else if (a === 'overit') {
      const lk = sadaJakoLekce('sada:' + x.id), l = listZLekce(lk);
      const v = lk.ulohy.map((u, i) => { const r = X.zkontroluj(l, u, X.prelozVzorec(u.reseni, 'en', jaz())); return `<li>${r.ok ? '✅' : '❌'} Úloha ${i + 1} (${u.cil}): ${esc(r.zprava)}</li>`; });
      $('ucZprava').innerHTML = v.length ? `<ul class="audit-seznam">${v.join('')}</ul>` : '<p>Sada nemá úlohy.</p>';
    }
  } catch (er) { Dialog.chyba(er.message); }
});
$('sadaVstup').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { const s = importSady(JSON.parse(await f.text())); stav.ucitelSada = s.id; uloz(); nastavRezim('ucitel'); info(`Importována sada „${esc(s.nazev)}“ (${tvar(s.ulohy.length, 'úloha', 'úlohy', 'úloh')}).`); }
  catch (er) { Dialog.chyba('Sadu se nepodařilo načíst: ' + er.message); }
});
async function nactiSaduZOdkazu() {
  const m = /#sada=([\w-]+)/.exec(location.hash); if (!m) return;
  try {
    const s = importSady(await rozbal(m[1]));
    history.replaceState(null, '', location.href.split('#')[0]);
    stav.lekce = 'sada:' + s.id; uloz(); nastavRezim('lekce');
    info(`Otevřena sada úloh „${esc(s.nazev)}“ – najdete ji i v menu 📘 Lekce.`);
  } catch (er) { Dialog.chyba('Odkaz na sadu úloh je poškozený.'); }
}

/* ---------- podmíněné formátování ---------- */
const TYPY_PF = {
  vetsi: ['Hodnota je větší než', 1], mensi: ['Hodnota je menší než', 1], mezi: ['Hodnota je mezi', 2], rovno: ['Hodnota se rovná', 1],
  obsahuje: ['Text obsahuje', 1], top: ['Nejvyšších N hodnot', 1], nadprumer: ['Nad průměrem oblasti', 0], duplicita: ['Duplicitní hodnoty', 0],
  vzorec: ['Vlastní vzorec (PRAVDA = obarvit)', 1], pruh: ['Datové pruhy (délka podle hodnoty)', 0], skala: ['Barevná škála (červená → zelená)', 0],
};
const NAZEV_STYLU = { cervena: 'červeně', zelena: 'zeleně', zluta: 'žlutě', modra: 'modře', tucne: 'tučně' };
function popisPravidla(p) {
  const t = TYPY_PF[p.typ]; if (!t) return p.typ;
  const h = t[1] === 2 ? ` ${p.h1} a ${p.h2}` : t[1] === 1 ? ` ${p.h1}` : '';
  return `${p.oblast}: ${t[0].toLowerCase()}${h}${p.typ === 'pruh' || p.typ === 'skala' ? '' : ' → ' + (NAZEV_STYLU[p.styl] || '')}`;
}
function kresliPravidla() {
  const pr = list.pravidla || [];
  $('pfSeznam').innerHTML = pr.length ? '<ul>' + pr.map((p, i) => `<li><span>${esc(popisPravidla(p))}</span><button class="btn mini" data-smaz-pf="${i}" aria-label="Smazat pravidlo">×</button></li>`).join('') + '</ul>' : '<p class="rz-prazdne">Tento list zatím nemá žádná pravidla.</p>';
}
function aktualizujFormularPF() {
  const typ = $('pfTyp').value, n = TYPY_PF[typ][1];
  $('pfH1l').hidden = n < 1; $('pfH2l').hidden = n < 2; $('pfStyll').hidden = typ === 'pruh' || typ === 'skala';
  $('pfH1t').textContent = typ === 'top' ? 'Kolik hodnot (N)' : typ === 'vzorec' ? 'Vzorec' : typ === 'obsahuje' ? 'Text' : 'Hodnota';
  $('pfNapoveda').innerHTML = typ === 'vzorec'
    ? `Vzorec napište pro <b>první buňku oblasti</b>, pro ostatní se posune jako při kopírování. Např. <code>=$C2="ano"</code> obarví celé řádky, kde je ve sloupci C „ano“ ($ drží sloupec).`
    : n ? 'Hodnota může být číslo, text, nebo odkaz na buňku (=F1) – pak se pravidlo změní se změnou buňky.' : '';
}
$('pfTyp').innerHTML = Object.entries(TYPY_PF).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join('');
$('pfTyp').addEventListener('change', aktualizujFormularPF);
$('btnPodm').addEventListener('click', () => {
  $('pfOblast').value = textObl(obl()); $('pfZprava').textContent = '';
  kresliPravidla(); aktualizujFormularPF(); $('dlgPodm').showModal();
});
$('pfPridej').addEventListener('click', () => {
  const p = { oblast: $('pfOblast').value.trim().toUpperCase().replace(/\$/g, ''), typ: $('pfTyp').value, h1: $('pfH1').value.trim(), h2: $('pfH2').value.trim(), styl: $('pfStyl').value };
  try { const st = X.rozeber('=' + p.oblast, jaz()); if (st.t !== 'range' && st.t !== 'ref') throw 0; } catch (e) { $('pfZprava').textContent = '⚠ Oblast zadejte jako A1:B10.'; return; }
  const n = TYPY_PF[p.typ][1];
  if ((n >= 1 && !p.h1) || (n >= 2 && !p.h2)) { $('pfZprava').textContent = '⚠ Vyplňte hodnotu pravidla.'; return; }
  if (p.typ === 'vzorec') { try { X.rozeber(p.h1.startsWith('=') ? p.h1 : '=' + p.h1, jaz()); } catch (e) { $('pfZprava').textContent = '⚠ ' + e.message; return; } }
  if (n < 2) delete p.h2; if (n < 1) delete p.h1;
  zmena('podmíněné formátování', () => { list.pravidla = [...(list.pravidla || []), p]; });
  kresliPravidla(); $('pfZprava').textContent = 'Pravidlo přidáno: ' + popisPravidla(p);
});
$('pfSeznam').addEventListener('click', e => {
  const b = e.target.closest('[data-smaz-pf]'); if (!b) return;
  zmena('smazání pravidla', () => { list.pravidla = list.pravidla.filter((_, i) => i !== +b.dataset.smazPf); });
  kresliPravidla();
});
$('pfZavri').addEventListener('click', () => $('dlgPodm').close());

/* ---------- rozbor vlastního vzorce ---------- */
const PRIKLADY = [
  ['Podmínka se dvěma kritérii', '=IF(AND(B2>=50,C2="ano"),"postupuje","nepostupuje")'],
  ['Vyhledání ceny podle kódu', '=VLOOKUP(F1,A2:C6,3,FALSE)'],
  ['Hledání „doleva“', '=INDEX(A2:A7,MATCH(F1,B2:B7,0))'],
  ['Součet se dvěma podmínkami', '=SUMIFS(C2:C9,A2:A9,"Novák",B2:B9,"Brno")'],
  ['Podíl splňujících podmínku', '=COUNTIF(C2:C9,">"&F1)/COUNTA(C2:C9)'],
  ['Cena s DPH na haléře', '=ROUND(B2*(1+B3),2)'],
  ['Křestní jméno z celého jména', '=LEFT(A2,FIND(" ",A2)-1)'],
  ['Ošetřené dělení', '=IFERROR(B1/B2,0)'],
  ['Známka podle bodů', '=IFS(B2>=90,1,B2>=75,2,B2>=60,3,B2>=45,4,TRUE,5)'],
  ['Datum slovy', '=TEXT(B4,"dddd")&" "&DAY(B4)&". "&MONTH(B4)&"."'],
  ['Častá chyba: SVYHLEDAT bez 4. argumentu', '=VLOOKUP(E1,A1:B5,2)'],
  ['Častá chyba: řetězené porovnání', '=IF(10<B2<20,"uvnitř","venku")'],
];
function htmlRozbor() {
  const r = stav.rozbor || {};
  return `<h2>🔬 Rozbor vzorce</h2>
    <p>Vložte libovolný vzorec – z Excelu, z návodu, od kolegy. Zápis může být český (<code>KDYŽ(…;…)</code>) i anglický
    (<code>IF(…,…)</code>), rovnítko na začátku není nutné. Stránka ho přečte, slovy vysvětlí, rozloží na kroky,
    upozorní na typické chyby a <b>předvede ho na ukázkových datech</b> v listu vpravo.</p>
    <div class="rb-vstup">
      <textarea id="rbVzorec" class="vstup" rows="3" spellcheck="false" aria-label="Vzorec k rozboru" placeholder="např. =SVYHLEDAT(F1;A2:C6;3;NEPRAVDA)">${esc(r.vzorec || r.vstup || '')}</textarea>
      <div class="rb-akce">
        <button class="btn hlavni" data-rb="rozebrat" title="Ctrl+Enter">🔬 Rozebrat</button>
        <select class="tl" id="rbPriklad" aria-label="Příklady vzorců"><option value="">💡 Příklady…</option>${PRIKLADY.map(([n, f], i) => `<option value="${i}">${esc(n)}</option>`).join('')}</select>
      </div>
    </div>
    <div id="rbVysledek">${r.vzorec || r.chyba ? htmlVysledkuRozboru() : ''}</div>`;
}
function htmlVysledkuRozboru() {
  const r = stav.rozbor;
  if (r.chyba) {
    const c = r.chyba, t = c.vzorec || r.vstup || '', p = Math.min(c.pozice ?? t.length, t.length);
    return `<div class="chyba-box"><b>Vzorec se nedá přečíst:</b> ${esc(c.chyba)}${c.rada ? '<br>💡 ' + esc(c.rada) : ''}</div>
      <div class="vyraz">${esc(t.slice(0, p))}<span class="k-chyba">${esc(t.slice(p, p + 1) || ' ')}</span>${esc(t.slice(p + 1))}</div>
      <p class="rz-prazdne">Zkontrolujte závorky, uvozovky a oddělovače argumentů: v českém Excelu středník <code>;</code>, v anglickém čárka <code>,</code>.</p>`;
  }
  const vz = r.vzorec, cs = X.prelozVzorec(vz, jaz(), 'cs'), en = X.prelozVzorec(vz, jaz(), 'en');
  const strom = X.rozeber(vz, jaz());
  const v = RB.vysvetli(strom, jaz()), rd = RB.rady(strom, jaz()), { fn } = X.rozborStromu(strom);
  const kop = t => `<button class="btn mini" data-rb="kopiruj" data-text="${esc(t)}" title="Zkopírovat">📋</button>`;
  let h = `<div class="rb-zapis">
      <div><span class="rb-stitek">🇨🇿 český Excel</span><code>${obarvi(cs, 'cs', false)}</code>${kop(cs)}</div>
      <div><span class="rb-stitek">🇬🇧 anglický Excel</span><code>${obarvi(en, 'en', false)}</code>${kop(en)}</div></div>`;
  if (r.rozpoznano && r.rozpoznano !== jaz()) h += `<p class="rz-prazdne">Rozpoznal jsem ${r.rozpoznano === 'en' ? 'anglický' : 'český'} zápis. V listu je převedený podle přepínače <b>Zápis vzorců</b>.</p>`;
  h += `<h3>📖 Co vzorec dělá</h3><p class="rb-souhrn"${v.souhrn ? ' data-i18n="ne"' : ''}>${v.souhrn ? (RB.anglicky() ? 'The formula ' : 'Vzorec ') + esc(v.souhrn) + '.' : 'Vzorec je delší, rozepsaný je v postupu níže.'}</p>
    <p>Výsledek v buňce <button class="adr" data-adr="${r.bunka}">${r.bunka}</button>: <span id="rbVysl"></span></p>
    <h3>🪜 Postup zevnitř ven</h3>
    <p class="rz-prazdne">Excel nejdřív spočítá vnitřní části. Číslo v kroužku odkazuje na výsledek dřívějšího kroku. Kliknutím na krok ho uvidíte v rozkladu vpravo.</p>
    <ol class="rb-postup" id="rbPostup"></ol>`;
  if (fn.size) h += '<h3>🧰 Použité funkce</h3>' + [...fn].map(e => `<div class="fn-karta"><div class="syn">${syntaxeHtml(e, -1)}</div><div>${esc(X.FUNKCE[e].popis)}</div></div>`).join('');
  h += '<h3>⚠️ Na co si dát pozor</h3>' + (rd.length
    ? '<ul class="rb-rady">' + rd.map(x => `<li class="rb-${x.typ}">${{ chyba: '❌', pozor: '⚠️', tip: '💡' }[x.typ]} ${esc(x.text)}</li>`).join('') + '</ul>'
    : '<p>✅ Žádné typické chyby jsem nenašel.</p>');
  h += `<h3>🧪 Předvedení na datech</h3>
    <p>${r.zListu ? 'Použil jsem data z listu, ze kterého vzorec pochází.' : 'Buňky, na které vzorec odkazuje, jsem vyplnil <b>ukázkovými daty</b> podle toho, jak je vzorec používá (text, datum, tabulka k vyhledání…).'}
    Vzorec je v buňce <b>${r.bunka}</b>, buňky, na které odkazuje, jsou v listu barevně orámované. <b>Přepište data</b> a sledujte, jak se mění výsledek i jednotlivé kroky.</p>
    <div class="rb-akce"><button class="btn hlavni" data-rb="prehraj">▶▶ Přehrát výpočet</button>${r.zListu ? '' : '<button class="btn" data-rb="jina">🎲 Jiná ukázková data</button>'}</div>`;
  return h;
}
function htmlPostupRozboru() {
  const r = stav.rozbor;
  let k; try { k = list.kroky(r.vzorec); } catch (e) { return ''; }
  const v = RB.vysvetli(k.strom, jaz()), hod = new Map(k.kroky.map(x => [x.uzel, x.hodnota]));
  return v.kroky.map(s => {
    const val = hod.has(s.uzel) ? `<span class="rb-hod" data-i18n="ne">= ${esc(lit(hod.get(s.uzel)))}</span>` : '<span class="nevyh">nevyhodnoceno – tato větev se nepočítala</span>';
    return `<li data-rb="krok" data-s="${s.uzel.s}" data-e="${s.uzel.e}" title="Ukázat v rozkladu"><b data-i18n="ne">${esc(s.nazev)}</b> – <span data-i18n="ne">${esc(s.text).replace(/⟦(\d+)⟧/g, '<span class="rb-odk">$1</span>')}</span> ${val}</li>`;
  }).join('');
}
function aktualizujVysledekRozboru() {
  const r = stav.rozbor; if (!r?.bunka || r.chyba) return;
  const raw = list.surova(r.bunka);
  if (raw.startsWith('=') && raw !== r.vzorec) { try { X.rozeber(raw, jaz()); r.vzorec = raw; uloz(); kresliVyklad(); } catch (e) { /* rozepsaný vzorec */ } }
  const el = $('rbVysl'); if (el) el.innerHTML = `<b>${esc(list.zobraz(r.bunka) || '(prázdné)')}</b>`;
  const p = $('rbPostup'); if (p) { try { p.innerHTML = htmlPostupRozboru(); } catch (e) { p.innerHTML = ''; } }
}
function spustPrehravani() {
  if (!rz || rz.chybaZapisu || !rz.kroky.length) return;
  zastavPrehravani(); zalozka = 'kroky'; rz.i = 0;
  prehravani = setInterval(() => { rz.i++; if (rz.i >= rz.kroky.length) zastavPrehravani(); kresliRozklad(); }, 1100);
  kresliRozklad();
}
function rozebrat(text, o = {}) {
  if (edit) potvrd();
  const r = RB.rozpoznej(text, jaz());
  if (r.chyba) {
    stav.rozbor = { ...(stav.rozbor || {}), vstup: text, chyba: r, vzorec: null };
    uloz();
    if (stav.rezim !== 'rozbor') nastavRezim('rozbor'); else kresliVyklad();
    return;
  }
  const vz = r.jazyk === jaz() ? r.vzorec : X.prelozVzorec(r.vzorec, r.jazyk, jaz());
  const strom = X.rozeber(vz, jaz());
  const seme = o.seme ?? 1;
  let l, bunka;
  if (o.zList) { l = new X.List({}, { jazyk: jaz() }); l.bunky = { ...o.zList.bunky }; l.format = { ...o.zList.format }; l.sirky = { ...(o.zList.sirky || {}) }; bunka = o.bunka; }
  else { l = new X.List(RB.ukazkovaData(strom, seme), { jazyk: jaz() }); bunka = RB.bunkaProVzorec(strom); }
  l.nastav(bunka, vz);
  /* odkazy na jiné listy (List2!A1): ukázková data dostanou i ty listy, jinak by vyšlo #REF! */
  const cizi = new Set();
  if (!o.zList) (function p(u) { if (!u) return; [u, u.a, u.b].forEach(x => x && x.list && cizi.add(x.list)); (u.args || []).forEach(p); p(u.l); p(u.r); p(u.x); })(strom);
  const data = { ...l.bunky }; delete data[bunka];
  const listy = [{ nazev: 'List1', bunky: l.bunky, format: l.format, sirky: l.sirky || {} }, ...[...cizi].filter(n => n.toLowerCase() !== 'list1').slice(0, 5).map(n => ({ nazev: n, bunky: { ...data }, format: {} }))];
  stav.rozbor = { vstup: text, vzorec: vz, rozpoznano: r.jazyk, bunka, seme, zListu: !!o.zList, list: { jazyk: jaz(), nazvy: o.zList && sesit ? { ...sesit.nazvy } : {}, listy } };
  uloz();
  nastavRezim('rozbor');
  spustPrehravani();
}
$('vyklad').addEventListener('click', e => {
  const b = e.target.closest('[data-rb]'); if (!b || stav.rezim !== 'rozbor') return;
  const r = stav.rozbor, akce = b.dataset.rb;
  if (akce === 'rozebrat') rozebrat($('rbVzorec').value);
  else if (akce === 'jina' && r?.vzorec) rozebrat(r.vzorec, { seme: (r.seme || 1) + 1 });
  else if (akce === 'prehraj' && r?.bunka) { vyber(r.bunka); spustPrehravani(); ukazDilnu(); }
  else if (akce === 'kopiruj') {
    const t = b.dataset.text;
    (navigator.clipboard?.writeText(t) || Promise.reject()).then(() => { b.textContent = '✓'; setTimeout(() => { b.textContent = '📋'; }, 1200); }, () => info('Kopírování se nepodařilo – označte vzorec myší.'));
  } else if (akce === 'krok' && r?.bunka) {
    vyber(r.bunka);
    if (rz && !rz.chybaZapisu) {
      const i = rz.kroky.findIndex(k => k.uzel.s === +b.dataset.s && k.uzel.e === +b.dataset.e);
      zastavPrehravani(); zalozka = 'kroky'; rz.i = i >= 0 ? i + 1 : rz.kroky.length; kresliRozklad();
    }
    ukazDilnu();
  }
});
$('vyklad').addEventListener('change', e => {
  if (e.target.id !== 'rbPriklad' || e.target.value === '') return;
  const f = X.prelozVzorec(PRIKLADY[+e.target.value][1], 'en', jaz());
  rozebrat(f);
});
$('vyklad').addEventListener('keydown', e => {
  if (e.target.id === 'rbVzorec' && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); rozebrat(e.target.value); }
});

try { nastavRezim(stav.rezim); }
catch (e) {   /* poškozený uložený stav: vrátit se na první lekci, aby stránka nezůstala mrtvá */
  console.error(e);
  stav.rezim = 'lekce'; stav.lekce = LEKCE[0].id; stav.rozbor = null; delete stav.listy[LEKCE[0].id]; uloz();
  nastavRezim('lekce');
  info('⚠ Uložený stav stránky byl poškozený – otevřela se první lekce.');
}
nactiZOdkazu(); nactiSaduZOdkazu();
if (!stav.pruvodce && !/#(sesit|sada)=/.test(location.hash)) setTimeout(spustPruvodce, 600);
window.XLV_UI = { spustPruvodce, get pv() { return pv; }, importSoubor, exportXlsx, sesitNaWorkbook, nactiXLSX, zabal, rozbal, nactiZOdkazu, get list() { return list; }, vyber, potvrd, nastavRezim, otevriLekci, nastavRozklad, rozebrat, zpet, znovu, vyplnRadu, prepniFormat, get rz() { return rz; }, get vyberObl() { return textObl(obl()); } };
})();

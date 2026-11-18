/* Časová osa případu – rozhraní: seznam, plavecké dráhy, editor záznamu, importy a exporty. Logika v jadro.js. */
(function () {
'use strict';
const J = window.CaseTimelineJadro;
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
if (window.self === window.top) document.body.classList.add('samostatne');

// modelový případ (?pripad=17) má vlastní úložiště – data uživatele zůstanou netknutá
const MP = window.ModelovyPripad && ModelovyPripad.aktivni ? MODELOVY_PRIPAD : null;
const KEY_UZIV = 'vysetrovani_timeline', KEY_UZIV_CASE = 'vysetrovani_timeline_case';   // historické názvy (bez webapp_), kvůli starým datům
const KEY = MP ? KEY_UZIV + '_pripad' + MP.id : KEY_UZIV;
const KEY_CASE = MP ? KEY_UZIV_CASE + '_pripad' + MP.id : KEY_UZIV_CASE;
const KEY_EVID = MP ? 'vysetrovani_evidence_pripad' + MP.id : 'vysetrovani_evidence';
const KEY_POHLED = 'webapp_case_timeline_pohled';

function ctiJson(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
let items = [];
{
  const raw = ctiJson(KEY);
  if (MP && raw === null) {
    items = J.zModelovehoPripadu(MP);
    localStorage.setItem(KEY_CASE, MP.cislo + ' – ' + MP.nazev);
  } else {
    const platne = Array.isArray(raw) ? raw.filter(x => x && typeof x === 'object') : [];
    items = J.nacti(platne).items;
    // starší zápis modelového případu (jen čas, typ, popis) → doplnit osoby, zdroj a jistotu
    if (MP && Array.isArray(raw)) {
      const mp = Object.fromEntries(J.zModelovehoPripadu(MP).map(x => [x.id, x]));
      items = items.map((it, i) => mp[it.id] && !('jistota' in platne[i]) ? Object.assign({}, mp[it.id], { desc: it.desc, time: it.time || mp[it.id].time }) : it);
    }
  }
  // zpět zapsat jen převedená data (pole / modelový případ); nečitelný obsah úložiště nepřepisovat, dokud uživatel nic nezmění
  if (MP || Array.isArray(raw)) try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) { /* plné úložiště */ }
}
$('caseName').value = localStorage.getItem(KEY_CASE) || '';
$('caseName').addEventListener('input', () => { if (!veSpisu()) localStorage.setItem(KEY_CASE, $('caseName').value); });

// se zvoleným spisem (S2): záznamy = entity `udalost`, stopy spisu se ukazují jako důkazy v čase zajištění (jen ke čtení);
// vlastní úložiště osy zůstává netknuté
let N = null;
const veSpisu = () => !!(N && N.pripad);
const snimek = new Map();
let spisSeznamy = { osoby: [], mista: [], stopy: [] };
const klicJmena = t => String(t || '').trim().toLowerCase().replace(/\s+/g, ' ');
function doSpisu() {
  const kopie = items.filter(it => !it.zeStopy && it.time);
  N.zapis(async (S, pripad) => {
    const mapa = async typ => new Map((await S.seznam(typ, { pripad })).map(e => [klicJmena(e.nazev), e.id]));
    const os = await mapa('osoba'), mi = await mapa('misto'), o = { nastroj: 'case_timeline' };
    await SpisNapojeni.zapisZmeny(snimek, kopie, {
      klic: J.klicZaznamu,
      uloz: async it => {
        for (const jm of it.osoby) if (!os.has(klicJmena(jm))) os.set(klicJmena(jm), (await S.uloz({ typ: 'osoba', nazev: jm, data: {}, pripad }, o)).id);
        if (it.misto && !mi.has(klicJmena(it.misto))) {
          const d = it.lat != null ? { lat: it.lat, lon: it.lon } : {};
          mi.set(klicJmena(it.misto), (await S.uloz({ typ: 'misto', nazev: it.misto, data: d, pripad }, o)).id);
        }
        const e = await S.entita(it.id);
        await S.uloz(Object.assign(J.doSpisu(it, e, j => os.get(klicJmena(j)), j => mi.get(klicJmena(j))), { pripad }), o);
      },
      smaz: id => S.smaz(id, o)
    });
  });
}
async function zeSpisu(pripad) {
  const vse = await SPIS.seznam(null, { pripad }), jmena = new Map(vse.map(e => [e.id, e.nazev]));
  const jm = id => jmena.get(id) || '';
  const udalosti = vse.filter(e => e.typ === 'udalost').map(e => J.zeSpisu(e, jm));
  const stopy = vse.filter(e => e.typ === 'stopa');
  spisSeznamy = { osoby: vse.filter(e => e.typ === 'osoba').map(e => e.nazev), mista: vse.filter(e => e.typ === 'misto').map(e => e.nazev), stopy };
  snimek.clear(); udalosti.forEach(it => snimek.set(it.id, J.klicZaznamu(it)));
  return udalosti.concat(stopy.map(J.zeStopy));
}

const stav = Object.assign({ pohled: 'seznam', filtr: '' }, ctiJson(KEY_POHLED) || {});
if (!['seznam', 'drahy'].includes(stav.pohled)) stav.pohled = 'seznam';
if (!['', 'bez', 'overeno'].includes(stav.filtr)) stav.filtr = '';
let vyrez = null, zvyraznene = new Set(), rozp = [];

function uloz() {
  if (veSpisu()) { render(); doSpisu(); return; }
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) { Dialog.chyba('Uložení selhalo: ' + e.message); }
  render();
}
const ulozPohled = () => { try { localStorage.setItem(KEY_POHLED, JSON.stringify(stav)); } catch (e) { /* nevadí */ } };
const viditelne = () => items.filter(it => !stav.filtr || (stav.filtr === 'bez' ? it.jistota !== 'tvrzeni' : it.jistota === 'overeno'));

/* ---------- vykreslení ---------- */
function stitekJistoty(j) { const d = J.JISTOTY[j]; return `<span class="jist ${j}" title="${esc(d.popis)}">${d.ikona} ${esc(d.nazev)}</span>`; }

function render() {
  const vid = viditelne();
  rozp = J.rozpory(items);   // rozpory vždy ze všech záznamů – filtr je jen pohled
  const vRozporu = J.idsRozporu(rozp);
  const osoby = new Set(items.flatMap(it => it.osoby));
  const poc = j => items.filter(it => it.jistota === j).length;
  $('souhrn').innerHTML = `<span class="chip">${items.length} záznamů</span><span class="chip">${osoby.size} osob</span>`
    + Object.keys(J.JISTOTY).map(j => `<span class="chip" title="${esc(J.JISTOTY[j].popis)}">${J.JISTOTY[j].ikona} <span>${esc(J.JISTOTY[j].nazev)}</span> <b>${poc(j)}</b></span>`).join('')
    + (rozp.length ? `<span class="chip roz">⚠ ${rozp.length} rozporů</span>` : '');
  $('panelRozporu').hidden = !rozp.length;
  $('pocRozporu').textContent = rozp.length;
  const byId = Object.fromEntries(items.map(x => [x.id, x]));
  $('seznamRozporu').innerHTML = rozp.map((r, i) => `<li data-rozpor="${i}"><span class="druh">${r.druh === 'tvrzeni' ? 'tvrzení × záznam' : 'poloha'}</span> · ${esc(J.formatCas(J.naCas(r.od)))} – ${esc(r.text)}`
    + `<br><small>${esc(J.formatKdy(byId[r.a]))} × ${esc(J.formatKdy(byId[r.b]))}</small></li>`).join('');
  $('empty').hidden = items.length > 0;
  $('pohledSeznam').hidden = stav.pohled !== 'seznam' || !items.length;
  $('pohledDrahy').hidden = stav.pohled !== 'drahy' || !items.length;
  $('tlSeznam').setAttribute('aria-pressed', stav.pohled === 'seznam');
  $('tlDrahy').setAttribute('aria-pressed', stav.pohled === 'drahy');
  $('filtr').value = stav.filtr;
  if (stav.pohled === 'seznam') kresliSeznam(vid, vRozporu); else kresliDrahy(vid, vRozporu);
  obnovSeznamy();
}

function kresliSeznam(vid, vRozporu) {
  $('timeline').innerHTML = J.serad(vid).map(it => {
    const t = J.TYPY[it.type], zdroj = J.popisZdroje(it);
    return `<div class="item t-${it.type} ${it.jistota}${vRozporu.has(it.id) ? ' rozpor' : ''}${zvyraznene.has(it.id) ? ' zvyrazneny' : ''}" data-id="${esc(it.id)}" tabindex="0">
      <div class="item-head"><span class="item-time">${esc(J.formatKdy(it))}</span>
        <span class="item-tags">${vRozporu.has(it.id) ? '<span class="roz-znak">⚠ rozpor</span>' : ''}${stitekJistoty(it.jistota)}<span class="item-tag">${t.ikona} ${esc(t.nazev)}</span></span></div>
      <div class="item-desc" data-i18n="ne">${esc(it.desc)}</div>
      ${it.osoby.length || it.misto || zdroj ? `<div class="item-meta">${it.osoby.length ? `<span><b>Osoby:</b> <span data-i18n="ne">${esc(it.osoby.join(', '))}</span></span>` : ''}
        ${it.misto ? `<span><b>Místo:</b> <span data-i18n="ne">${esc(it.misto)}</span></span>` : ''}${zdroj ? `<span><b>Zdroj:</b> ${esc(zdroj)}</span>` : ''}</div>` : ''}
    </div>`;
  }).join('');
}

function kresliDrahy(vid, vRozporu) {
  const cel = J.rozsah(vid) || J.rozsah(items);
  if (!cel) { $('drahy').innerHTML = '<div class="empty">Žádný záznam nemá čas.</div>'; return; }
  if (!vyrez) vyrez = cel;
  const box = $('drahy');
  const hl = innerWidth <= 600 ? 84 : 150;
  const sirka = Math.max(120, box.clientWidth - hl - 2);
  const zn = J.znacky(vyrez.od, vyrez.do, Math.max(2, Math.floor(sirka / 90)));
  const k = sirka / (vyrez.do - vyrez.od), X = t => (t - vyrez.od) * k;
  const mrizka = zn.map(z => `<span class="mrizka" style="left:${X(z.t)}px"></span>`).join('');
  let html = `<div class="draha osa"><div class="hl"></div><div class="stopa">${zn.map(z => `<span class="znacka" style="left:${X(z.t)}px">${esc(z.popis)}</span>`).join('')}</div></div>`;
  for (const d of J.drahy(vid)) {
    const r = J.rozvrhni(d.polozky, vyrez, sirka, 130), byId = Object.fromEntries(d.polozky.map(x => [x.id, x]));
    const pasy = rozp.filter(x => d.osoba && x.osoby.includes(d.osoba)).map(x => `<span class="roz-pas" style="left:${X(x.od)}px;width:${Math.max(2, (x.do - x.od) * k)}px" title="${esc(x.text)}"></span>`).join('');
    const bloky = r.polozky.map(p => {
      const it = byId[p.id], dl = p.w >= 70, bod = p.w < 10;
      const sir = dl ? p.w : Math.max(p.w, 12) + 130;
      const left = bod ? p.x + p.w / 2 - 6 : p.x;
      return `<div class="blok t-${it.type} ${it.jistota}${dl ? ' dlouhy' : ''}${bod ? ' bod' : ''}${vRozporu.has(it.id) ? ' rozpor' : ''}${zvyraznene.has(it.id) ? ' zvyrazneny' : ''}" data-id="${esc(it.id)}"
        style="left:${left}px;top:${4 + p.radek * 26}px;width:${sir}px" title="${esc(J.formatKdy(it) + ' · ' + J.JISTOTY[it.jistota].nazev + '\n' + it.desc + (it.misto ? '\n📍 ' + it.misto : ''))}">
        <span class="pas"${dl || !bod ? ` style="width:${dl ? p.w : Math.max(p.w, 10)}px"` : ''}></span><span class="stitek" data-i18n="ne">${vRozporu.has(it.id) ? '⚠ ' : ''}${esc(J.TYPY[it.type].ikona + ' ' + (it.misto && it.type === 'poloha' ? it.misto : it.desc))}</span></div>`;
    }).join('');
    html += `<div class="draha${d.osoba ? '' : ' spolecna'}"><div class="hl"${d.osoba ? ' data-i18n="ne"' : ''}>${d.osoba ? esc(d.osoba) : 'Společná dráha'}<small>${d.polozky.length} záz.</small></div>
      <div class="stopa" style="height:${8 + r.radku * 26}px">${mrizka}${pasy}${bloky}</div></div>`;
  }
  box.style.setProperty('--hl', hl + 'px');
  box.innerHTML = html;
  $('vyrez').textContent = J.formatCas(J.naCas(vyrez.od)) + ' – ' + J.formatCas(J.naCas(vyrez.do));
  $('legenda').innerHTML = Object.keys(J.JISTOTY).map(j => `<span class="blok t-udalost ${j}"><span class="pas" style="width:26px"></span>${esc(J.JISTOTY[j].nazev)}</span>`).join('')
    + '<span class="blok t-udalost rozpor"><span class="pas" style="width:26px"></span>rozpor</span>'
    + Object.keys(J.TYPY).map(t => `<span class="blok t-${t} bod"><span class="pas"></span>${J.TYPY[t].ikona} ${esc(J.TYPY[t].nazev)}</span>`).join('');
}

/* ---------- zoom a posun drah ---------- */
function nastavVyrez(v) { vyrez = v; render(); }
document.querySelector('.drahy-ovl').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || !vyrez) return;
  if (b.dataset.zoom === 'cele') nastavVyrez(null);
  else if (b.dataset.zoom) nastavVyrez(J.zoom(vyrez, +b.dataset.zoom));
  else if (b.dataset.posun) { const d = (vyrez.do - vyrez.od) * +b.dataset.posun; nastavVyrez({ od: vyrez.od + d, do: vyrez.do + d }); }
});
const casNaX = (stopa, clientX) => { const r = stopa.getBoundingClientRect(); return vyrez.od + (clientX - r.left) / r.width * (vyrez.do - vyrez.od); };
$('drahy').addEventListener('wheel', e => {
  const s = e.target.closest('.stopa'); if (!s || !vyrez || !(e.ctrlKey || e.metaKey)) return;
  e.preventDefault();
  nastavVyrez(J.zoom(vyrez, e.deltaY > 0 ? 1.25 : 0.8, casNaX(s, e.clientX)));
}, { passive: false });
let tah = null;
$('drahy').addEventListener('pointerdown', e => {
  const s = e.target.closest('.stopa'); if (!s || !vyrez || e.target.closest('.blok') || e.button) return;
  tah = { x: e.clientX, v: vyrez, w: s.getBoundingClientRect().width, posunuto: false };
  $('drahy').classList.add('tahne');
});
addEventListener('pointermove', e => {
  if (!tah || tah.konec) return;
  const dx = e.clientX - tah.x; if (Math.abs(dx) < 3 && !tah.posunuto) return;
  tah.posunuto = true;
  const d = -dx / tah.w * (tah.v.do - tah.v.od);
  vyrez = { od: tah.v.od + d, do: tah.v.do + d };
  cancelAnimationFrame(tah.raf); tah.raf = requestAnimationFrame(render);
});
const konecTahu = () => { if (tah && !tah.konec) { tah.konec = true; $('drahy').classList.remove('tahne'); setTimeout(() => { tah = null; }); } };   // click po tažení ještě ignorovat
// stopa se při tažení překresluje (záchyt ukazatele zaniká) → konec tahu hlídat na okně
addEventListener('pointerup', konecTahu);
addEventListener('pointercancel', konecTahu);
let sirkaOkna = innerWidth;
addEventListener('resize', () => { if (innerWidth !== sirkaOkna && stav.pohled === 'drahy') { sirkaOkna = innerWidth; render(); } });

/* ---------- editor záznamu ---------- */
let upravovany = null, zakladUpravy = null;   // klíč záznamu při otevření editoru (změna jinde = střet)
$('fType').innerHTML = Object.entries(J.TYPY).map(([k, t]) => `<option value="${k}">${t.ikona} ${esc(t.nazev)}</option>`).join('');
$('fZdroj').innerHTML = Object.entries(J.ZDROJE).map(([k, t]) => `<option value="${k}">${esc(t)}</option>`).join('');
$('fJistota').innerHTML = Object.entries(J.JISTOTY).map(([k, j]) => `<label title="${esc(j.popis)}"><input type="radio" name="jistota" value="${k}"> <span class="jist ${k}">${j.ikona} ${esc(j.nazev)}</span></label>`).join('');
const jistotaRuky = { v: false };   // uživatel jistotu zvolil sám → změna typu ji nepřepíše
$('fJistota').addEventListener('change', () => { jistotaRuky.v = true; });
$('fType').addEventListener('change', () => { if (!jistotaRuky.v) nastavJistotu(J.jistotaZTypu($('fType').value)); });
function nastavJistotu(j) { const r = document.querySelector(`#fJistota input[value="${j}"]`); if (r) r.checked = true; }
function obnovSeznamy() {
  const osoby = [...new Set(items.flatMap(it => it.osoby).concat(veSpisu() ? spisSeznamy.osoby : MP ? MP.osoby.map(o => o.jmeno) : []))];
  $('rychleOsoby').innerHTML = osoby.map(o => `<button type="button" class="btn mini" data-osoba="${esc(o)}" data-i18n="ne">+ ${esc(o)}</button>`).join('');
  const mista = [...new Set(items.map(it => it.misto).filter(Boolean).concat(veSpisu() ? spisSeznamy.mista : MP ? Object.values(MP.mista).map(m => m.nazev) : []))];
  $('seznamMist').innerHTML = mista.map(m => `<option value="${esc(m)}">`).join('');
  const ev = veSpisu() ? spisSeznamy.stopy.map(e => ({ num: e.data.cislo, desc: e.nazev })) : ctiJson(KEY_EVID);
  const stopy = (Array.isArray(ev) ? ev : []).filter(e => e && e.num);
  $('seznamStop').innerHTML = stopy.map(e => `<option value="${esc(e.num)}">${esc(String(e.desc || '').slice(0, 60))}</option>`).join('');
}
$('rychleOsoby').addEventListener('click', e => {
  const b = e.target.closest('[data-osoba]'); if (!b) return;
  e.preventDefault();
  const v = $('fOsoby').value.split(',').map(s => s.trim()).filter(Boolean);
  if (!v.includes(b.dataset.osoba)) v.push(b.dataset.osoba);
  $('fOsoby').value = v.join(', ');
});
function otevriEditor(it) {
  upravovany = it || null;
  zakladUpravy = it ? J.klicZaznamu(it) : null;
  const z = it || J.normalizuj({ type: 'udalost' });
  $('dlgZaznamTitul').textContent = it ? 'Upravit záznam' : 'Nový záznam';
  $('fTime').value = z.time ? z.time.slice(0, 16) : ''; $('fEnd').value = z.end ? z.end.slice(0, 16) : ''; $('fTol').value = z.tol || 0;
  $('fType').value = z.type; nastavJistotu(z.jistota); jistotaRuky.v = !!it;
  $('fOsoby').value = z.osoby.join(', '); $('fMisto').value = z.misto; $('fZdroj').value = z.zdroj; $('fStopa').value = z.stopa;
  $('fZdrojText').value = z.zdrojText; $('fDesc').value = z.desc;
  $('btnSmazZaznam').hidden = !it;
  $('dlgZaznam').showModal();
  $('fDesc').focus();
}
$('formZaznam').addEventListener('submit', async e => {
  const desc = $('fDesc').value.trim();
  if (!desc) { e.preventDefault(); $('fDesc').focus(); return; }
  if ($('fEnd').value && $('fTime').value && $('fEnd').value <= $('fTime').value) { e.preventDefault(); Dialog.info('Konec rozsahu musí být po začátku.'); return; }
  if (veSpisu() && !$('fTime').value) { e.preventDefault(); $('fTime').focus(); Dialog.info('Ve spisu musí mít záznam čas (aspoň odhad – nejistotu zapište do pole ±).'); return; }
  const z = J.normalizuj(Object.assign({}, upravovany || {}, {
    id: upravovany ? upravovany.id : undefined,
    time: $('fTime').value, end: $('fEnd').value, tol: $('fTol').value, type: $('fType').value,
    jistota: (document.querySelector('#fJistota input:checked') || {}).value, osoby: $('fOsoby').value, misto: $('fMisto').value,
    zdroj: $('fZdroj').value, stopa: $('fStopa').value, zdrojText: $('fZdrojText').value, desc
  }));
  if (upravovany && $('fMisto').value.trim() !== upravovany.misto) { delete z.lat; delete z.lon; }   // jiné místo → staré souřadnice neplatí
  // záznam mezitím změnila / smazala jiná záložka nebo nástroj (spis) – nepřepsat potichu cizí změnu
  const ted = upravovany && items.find(x => x.id === upravovany.id);
  if (upravovany && (!ted || J.klicZaznamu(ted) !== zakladUpravy)) {
    e.preventDefault();
    const ok = await Dialog.potvrd(ted ? 'Záznam byl mezitím změněn jinde (jiná záložka nebo nástroj). Uložením se tamty změny přepíšou vaší verzí. Uložit přesto?'
      : 'Záznam byl mezitím smazán (v jiné záložce nebo jiném nástroji). Uložit váš záznam jako nový?', { ok: ted ? 'Přepsat' : 'Uložit jako nový', zrus: 'Zpět k úpravám' });
    if (!ok) return;
    if (!ted) { z.id = J.novyId(); upravovany = null; }
    $('dlgZaznam').close();
  }
  items = upravovany ? items.map(x => x.id === upravovany.id ? z : x) : items.concat(z);
  uloz();
});
$('btnZrusZaznam').onclick = () => $('dlgZaznam').close();
$('btnSmazZaznam').onclick = async () => {
  if (!upravovany || !await Dialog.potvrd('Smazat tento záznam z časové osy?')) return;
  items = items.filter(x => x.id !== upravovany.id);
  $('dlgZaznam').close(); uloz();
};
document.addEventListener('click', e => {
  const z = e.target.closest('.item[data-id], .blok[data-id]');
  if (z && !(tah && tah.posunuto)) {
    const it = items.find(x => x.id === z.dataset.id);
    if (it && it.zeStopy) { if (window.SpisKarta) SpisKarta.otevri(it.id, { nastroj: 'case_timeline' }); }
    // S4: ve spisu klik otevře kartu entity (kde všude je, vazby); úprava na ose tlačítkem v kartě
    else if (it && veSpisu() && window.SpisKarta) SpisKarta.otevri(it.id, { nastroj: 'case_timeline', akce: [{ text: '✏️ Upravit na ose', fn: () => otevriEditor(it) }] });
    else if (it) otevriEditor(it);
  }
});
$('timeline').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.dataset.id) e.target.click(); });
$('seznamRozporu').addEventListener('click', e => {
  const li = e.target.closest('[data-rozpor]'); if (!li) return;
  const r = rozp[+li.dataset.rozpor];
  zvyraznene = new Set([r.a, r.b]);
  if (stav.pohled === 'drahy') { const okraj = Math.max(900000, (r.do - r.od) * 2); vyrez = { od: r.od - okraj, do: r.do + okraj }; }
  render();
  const el = document.querySelector(`[data-id="${CSS.escape(r.a)}"]`);
  if (el && stav.pohled === 'seznam') el.scrollIntoView({ block: 'center', behavior: 'smooth' });
});

/* ---------- importy ---------- */
async function vlozImport(nove, odkud) {
  let bezCasu = 0;
  if (veSpisu()) {   // ve spisu: čas povinný, id jen z povolených znaků (stejné id → stejný výsledek, opakovaný import nezdvojí)
    bezCasu = nove.filter(x => !x.time).length;
    const ven = [];
    for (const x of nove.filter(x => x.time)) {
      const y = Object.assign({}, x, { id: SpisNapojeni.bezpecneId(x.id) }), e = await SPIS.entita(y.id);
      // stopa spisu (export osy obsahuje i stopy) je na ose sama – nepřepsat ji událostí
      if (e && e.pripad === N.pripad && e.typ === 'stopa') continue;
      // id jiného případu, jiné entity než události nebo smazané události → nové id (jinak přepis cizích dat / chyba zápisu)
      if (e && (e.pripad !== N.pripad || e.typ !== 'udalost' || e.smazano)) y.id = J.novyId();
      ven.push(y);
    }
    nove = ven;
  }
  const d = J.bezDuplicit(items, nove), r = J.slouc(items, d.nove);
  items = r.items; uloz();
  Dialog.info(`${odkud}: přidáno ${r.pridano}, aktualizováno ${r.nahrazeno} záznamů` + (d.preskoceno ? `, ${d.preskoceno} už na ose bylo (stejný typ, čas a osoba) – přeskočeno.` : '.')
    + (bezCasu ? ` ${bezCasu} záznamů bez času se do spisu nepřevzalo (čas je ve spisu povinný).` : ''));
}
function importEvidence() {
  if (veSpisu()) return Dialog.info('Stopy spisu jsou na ose samy – jako důkazy v čase zajištění. Upravují se v Evidenčním deníku nebo ve spisu.');
  let ev = ctiJson(KEY_EVID);
  if (!Array.isArray(ev) && MP) ev = MP.dukazy.map(d => ({ time: d.kdy, num: 'D-0' + d.c, desc: d.nazev + ' (' + d.druh + ')', place: d.misto }));
  if (!Array.isArray(ev) || !ev.length) return Dialog.info('Evidenční deník v tomto prohlížeči je prázdný.');
  vlozImport(J.zEvidence(ev), 'Evidenční deník');
}
function nactiSkript(src) {
  return new Promise((ok, chyba) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => chyba(new Error('nelze načíst ' + src)); document.head.appendChild(s); });
}
// stejné úložiště jako Časová analýza (stejný origin, IndexedDB webapp_casova_analyza verze 1, store 'pripady');
// název je složený, aby ho _test/nastaveni_klice.py nepřipsal této stránce – data patří Časové analýze
const CA_KLIC = ['webapp', 'casova', 'analyza'].join('_');
function caPripady() {
  return new Promise((ok, chyba) => {
    const r = indexedDB.open(CA_KLIC, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('pripady', { keyPath: 'id' });
    r.onerror = () => chyba(r.error);
    r.onsuccess = () => {
      const d = r.result, q = d.transaction('pripady', 'readonly').objectStore('pripady').getAll();
      q.onsuccess = () => { d.close(); ok(q.result || []); };
      q.onerror = () => { d.close(); chyba(q.error); };
    };
  });
}
let caNabidka = [];
async function importCA() {
  try {
    if (!window.CasovaAnalyzaJadro) await nactiSkript('casova_analyza/jadro.js');
    const CA = window.CasovaAnalyzaJadro;
    const v = (await caPripady()).sort((a, b) => (b.upraveno || 0) - (a.upraveno || 0));
    caNabidka = v.map(p => ({ p, nazev: p.nazev, info: (p.spis ? p.spis + ' · ' : '') + (p.zdroje || []).length + ' zdrojů, ' + (p.zaznamy || []).length + ' záznamů' }));
    if (MP && !v.some(p => p.id === 'pripad17')) caNabidka.unshift({ vytvor: () => Object.assign(CA.ukazkaPripad17(MP), { id: 'pripad17' }), nazev: 'Modelový případ 17/2026 – alibi L. Fialy', info: 'zatím neotevřen v Časové analýze – data se vytvoří ze spisu' });
    if (!caNabidka.length) return Dialog.info('V tomto prohlížeči není uložený žádný případ Časové analýzy. Otevřete nástroj Časová analýza, importujte data a vraťte se.');
    $('caSeznam').innerHTML = caNabidka.map((c, i) => `<label><input type="radio" name="caPripad" value="${i}"${i ? '' : ' checked'}><span><span data-i18n="ne">${esc(c.nazev)}</span><br><small>${esc(c.info)}</small></span></label>`).join('');
    $('dlgCA').showModal();
  } catch (e) { Dialog.chyba('Časovou analýzu nelze přečíst: ' + e.message); }
}
$('caZrus').onclick = () => $('dlgCA').close();
$('caOk').onclick = () => {
  const CA = window.CasovaAnalyzaJadro, c = caNabidka[+(document.querySelector('[name=caPripad]:checked') || {}).value || 0];
  const p = CA.migruj(c.vytvor ? c.vytvor() : c.p);
  const tz = (ctiJson(CA_KLIC + '_nast') || {}).tz || CA.TZ_VYCHOZI;
  const nove = J.zCasoveAnalyzy(p, CA, tz, { pobyty: $('caPobyty').checked, komunikace: $('caKom').checked, dulezite: $('caDul').checked, vzd: +$('caVzd').value || 150, min: +$('caMin').value || 10 });
  $('dlgCA').close();
  vlozImport(nove, 'Časová analýza');
};
$('fileImport').onchange = () => {
  const f = $('fileImport').files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = async () => {
    try {
      const d = J.nacti(JSON.parse(r.result));
      $('fileImport').value = '';
      let nahradit = !items.length && !veSpisu();
      if (!nahradit && !veSpisu()) nahradit = await Dialog.potvrd(`Soubor má ${d.items.length} záznamů. Nahradit jimi současnou osu (${items.length})? Zrušit = sloučit (stejná id se přepíší).`);
      if (d.case && !veSpisu() && (nahradit || !$('caseName').value)) { $('caseName').value = d.case; localStorage.setItem(KEY_CASE, d.case); }
      if (nahradit) { items = d.items; uloz(); } else vlozImport(d.items, 'JSON');
    } catch (e) { $('fileImport').value = ''; Dialog.chyba('Neplatný soubor JSON. ' + e.message); }
  };
  r.readAsText(f);
};

/* ---------- exporty ---------- */
function stahni(text, typ, pripona) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: typ }));
  a.download = (($('caseName').value || 'casova_osa').replace(/[^\w\-]+/g, '_')) + pripona;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function pripravTisk() {
  const roz = J.idsRozporu(rozp), vid = J.serad(viditelne());
  const byId = Object.fromEntries(items.map(x => [x.id, x]));
  $('tisk').innerHTML = `<h1 data-i18n="ne">${esc($('caseName').value || 'Časová osa případu')}</h1>
    <div class="meta">Časová osa případu · vyhotoveno ${esc(J.formatCas(J.naCas(Date.now() - new Date().getTimezoneOffset() * 60000)))} · ${vid.length} záznamů${stav.filtr ? ' (filtr: ' + esc($('filtr').selectedOptions[0].textContent) + ')' : ''} · jistota: ✔ ověřeno, ◐ pravděpodobné, ? tvrzení – nepotvrzeno</div>
    ${rozp.length ? `<h2>⚠ Rozpory k prověření (${rozp.length})</h2><ul>${rozp.map(r => `<li>${esc(r.text)} — ${esc(J.formatKdy(byId[r.a]))} × ${esc(J.formatKdy(byId[r.b]))}</li>`).join('')}</ul>` : ''}
    <h2>Chronologie</h2>
    <table><thead><tr><th>Čas</th><th>Jistota</th><th>Typ</th><th>Osoby</th><th>Popis</th><th>Místo</th><th>Zdroj</th></tr></thead><tbody>
    ${vid.map(it => `<tr class="${it.jistota}${roz.has(it.id) ? ' rozpor' : ''}"><td>${esc(J.formatKdy(it))}</td><td>${J.JISTOTY[it.jistota].ikona} ${esc(J.JISTOTY[it.jistota].nazev)}</td>
      <td>${esc(J.TYPY[it.type].nazev)}</td><td data-i18n="ne">${esc(it.osoby.join(', '))}</td><td data-i18n="ne">${roz.has(it.id) ? '⚠ ' : ''}${esc(it.desc)}</td><td data-i18n="ne">${esc(it.misto)}</td><td>${esc(J.popisZdroje(it))}</td></tr>`).join('')}
    </tbody></table>
    <p class="meta" style="margin-top:8pt">Rozpor = dvojice záznamů téže osoby s překrývajícím se časem (vč. nejistoty) a různým místem; je podnětem k prověření, ne závěrem.</p>`;
}
addEventListener('beforeprint', pripravTisk);

/* ---------- nabídky a příkazy ---------- */
const PRIKAZY = {
  pridat: () => otevriEditor(null),
  importCA, importEvidence,
  importJson: () => $('fileImport').click(),
  exportJson: () => stahni(J.exportJson($('caseName').value, items), 'application/json', '.json'),
  exportCsv: () => stahni('﻿' + J.exportCsv(items), 'text/csv;charset=utf-8', '.csv'),
  tisk: () => { pripravTisk(); window.print(); },
  nazev: () => { $('caseName').focus(); $('caseName').select(); },
  smazat: async () => {
    if (!await Dialog.potvrd(veSpisu() ? 'Opravdu smazat všechny události časové osy ve spisu? (Stopy zůstanou, smazané události jdou ve spisu obnovit.)' : 'Opravdu smazat všechny záznamy časové osy?')) return;
    items = items.filter(it => it.zeStopy); vyrez = null; uloz();
  },
  prevodDoSpisu: () => {
    const raw = ctiJson(KEY), vlastni = Array.isArray(raw) ? J.nacti(raw.filter(x => x && typeof x === 'object')).items : [];
    const sCasem = vlastni.filter(it => it.time);
    return N.prevod(sCasem.length, `${sCasem.length} záznamů vlastní časové osy` + (vlastni.length - sCasem.length ? ` (${vlastni.length - sCasem.length} bez času se převést nedá)` : ''), async (S, pripad) => {
      const mapa = async typ => new Map((await S.seznam(typ, { pripad })).map(e => [klicJmena(e.nazev), e.id]));
      const os = await mapa('osoba'), mi = await mapa('misto'), o = { nastroj: 'case_timeline' };
      let nove = 0;
      for (const it of sCasem) {
        const id = SpisNapojeni.bezpecneId(pripad + '.ct.' + it.id);
        if (await S.entita(id)) continue;
        for (const jm of it.osoby) if (!os.has(klicJmena(jm))) os.set(klicJmena(jm), (await S.uloz({ typ: 'osoba', nazev: jm, data: {}, pripad }, o)).id);
        if (it.misto && !mi.has(klicJmena(it.misto))) mi.set(klicJmena(it.misto), (await S.uloz({ typ: 'misto', nazev: it.misto, data: it.lat != null ? { lat: it.lat, lon: it.lon } : {}, pripad }, o)).id);
        await S.uloz(Object.assign(J.doSpisu(Object.assign({}, it, { id }), null, j => os.get(klicJmena(j)), j => mi.get(klicJmena(j))), { pripad }), o);
        nove++;
      }
      return `Do spisu převedeno ${nove} záznamů` + (sCasem.length - nove ? `, ${sCasem.length - nove} tam už bylo.` : '.');
    });
  },
  metoda: () => $('dlgMetoda').showModal()
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
  const p = e.target.closest('[data-prikaz]');
  if (p) { e.stopPropagation(); zavriNabidky(); return PRIKAZY[p.dataset.prikaz](); }
  const v = e.target.closest('[data-pohled]');
  if (v) { stav.pohled = v.dataset.pohled; ulozPohled(); render(); return; }
  if (!e.target.closest('.nabidka')) zavriNabidky();
});
$('filtr').addEventListener('change', () => { stav.filtr = $('filtr').value; ulozPohled(); render(); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') zavriNabidky();
  if (e.target.closest('input,textarea,select,dialog') || e.ctrlKey || e.metaKey || e.altKey || document.querySelector('dialog[open]')) return;
  if (e.key === 'n' || e.key === 'N') { e.preventDefault(); otevriEditor(null); }
});

render();

/* ---------- jednotný spis (S2) ---------- */
N = SpisNapojeni.pripoj({
  nastroj: 'case_timeline', lista: $('spisMisto'),
  naZmenu: async (pripad, jiny) => {
    if (pripad) {
      items = await zeSpisu(pripad);
      $('caseName').value = N.nazev; $('caseName').readOnly = true;
    } else if (jiny) {
      const raw = ctiJson(KEY);
      items = Array.isArray(raw) ? J.nacti(raw.filter(x => x && typeof x === 'object')).items : [];
      snimek.clear(); $('caseName').value = localStorage.getItem(KEY_CASE) || ''; $('caseName').readOnly = false;
    }
    if (jiny) { vyrez = null; zvyraznene = new Set(); }
    $('miPrevod').hidden = !pripad;
    render();
  }
});
/* S4: skok z karty – ?entita=<id> zvýrazní záznam (událost / stopu), u osoby všechny její záznamy */
function zvyrazniEntitu(id, e) {
  const jmeno = e && e.typ === 'osoba' ? e.nazev : null;
  zvyraznene = new Set(items.filter(x => x.id === id || (jmeno && x.osoby.includes(jmeno))).map(x => x.id));
  const prvni = J.serad(items).find(x => zvyraznene.has(x.id));
  if (prvni && stav.pohled === 'drahy') vyrez = J.rozsah([prvni]) || vyrez;
  render();
  const el = prvni && document.querySelector(`[data-id="${CSS.escape(prvni.id)}"]`);
  if (el) el.scrollIntoView({ block: 'center' });
}
SpisOdkazy.zde('case_timeline', async p => zvyrazniEntitu(p.entita, await SPIS.entita(p.entita)));
N.hotovo.then(async () => {
  const c = await SpisOdkazy.cil();
  if (!c) return;
  if (c.prepnuto) await N.obnov();
  zvyrazniEntitu(c.e.id, c.e);
});
window.CaseTimelineUI = { get items() { return items; }, get vyrez() { return vyrez; }, render, get spis() { return N.pripad; }, hotovo: () => N.hotovo, get zvyraznene() { return [...zvyraznene]; } };
})();

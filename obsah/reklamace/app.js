/* Reklamační protokol – rozhraní (logika lhůt v jadro.js). */
(function () {
'use strict';
const J = window.ReklamaceJadro;
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const D = J.formatDatum;
const dnes = () => J.dnesIso();
if (window.self === window.top) document.body.classList.add('samostatne');

let data = J.prazdna();
try { data = J.migruj(JSON.parse(localStorage.getItem(J.KLIC))); } catch (e) { data = J.prazdna(); }
let role = 'prodejce', filtrSouhrn = '';
try { role = localStorage.getItem(J.KLIC + '_role') === 'spotrebitel' ? 'spotrebitel' : 'prodejce'; } catch (e) {}

function uloz() {
  try { localStorage.setItem(J.KLIC, JSON.stringify(data)); }
  catch (e) { Dialog.chyba('Data se nepodařilo uložit (plné úložiště?)'); }
}

/* ---------- fotky v IndexedDB ---------- */
const Fotky = (function () {
  let p = null;
  function db() {
    return p || (p = new Promise((res, rej) => {
      const o = indexedDB.open('webapp_reklamace', 1);
      o.onupgradeneeded = () => o.result.createObjectStore('fotky', { keyPath: 'id' });
      o.onsuccess = () => res(o.result); o.onerror = () => rej(o.error);
    }));
  }
  async function tx(rezim, fn) {
    const d = await db();
    return new Promise((res, rej) => {
      const t = d.transaction('fotky', rezim), r = fn(t.objectStore('fotky'));
      t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error);
    });
  }
  const url = new Map();
  return {
    uloz: f => tx('readwrite', s => s.put(f)),
    nacti: id => tx('readonly', s => s.get(id)),
    smaz: id => { if (url.has(id)) { URL.revokeObjectURL(url.get(id)); url.delete(id); } return tx('readwrite', s => s.delete(id)); },
    vse: () => tx('readonly', s => s.getAll()),
    vymaz: () => tx('readwrite', s => s.clear()),
    async url(id) {
      if (url.has(id)) return url.get(id);
      const f = await this.nacti(id).catch(() => null);
      if (!f) return '';
      const u = URL.createObjectURL(f.blob); url.set(id, u); return u;
    }
  };
})();
async function zmensi(soubor) {
  const bmp = await createImageBitmap(soubor);
  const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close && bmp.close();
  return new Promise(res => c.toBlob(res, 'image/jpeg', 0.85));
}

/* ---------- vykreslení ---------- */
const mojeReklamace = () => data.reklamace.filter(r => r.role === role);

function textLhuty(r, l) {
  switch (l.stavLhuty) {
    case 'bezi': case 'brzy': return `⏳ Vyřídit do <b>${D(l.vyrizeniDo)}</b> · ${J.popisZbyva(l.zbyva)}`;
    case 'prosla': return `⛔ Lhůta vyřízení uplynula <b>${D(l.vyrizeniDo)}</b> · ${J.popisZbyva(l.zbyva)}`;
    case 'vcas': return `✅ Vyřízeno ${D(r.vyrizeni.datum)} – v lhůtě`;
    case 'pozde': return `⚠️ Vyřízeno ${D(r.vyrizeni.datum)} – po lhůtě (měla být do ${D(l.vyrizeniDo)})`;
  }
  return J.uzavrena(r) ? `Uzavřeno ${D(r.vyrizeni.datum)}` : 'Bez zákonné lhůty vyřízení (kupující podnikatel)';
}

function karta(r) {
  const l = J.lhutyVSeznamu(data.reklamace, r, dnes());
  const trida = J.uzavrena(r) && l.stavLhuty === 'bez' ? 'uzavrena' : l.stavLhuty;
  const protistrana = role === 'prodejce' ? r.kupujici.jmeno : r.prodavajici.jmeno;
  const prodl = l.konecOdpovednosti ? `Vady lze uplatnit do ${D(l.novyKonec || l.konecOdpovednosti)}${l.dnyNeuzivani + l.predchozi ? ` (+${l.dnyNeuzivani + l.predchozi} dní za dobu reklamací${J.uzavrena(r) ? '' : ', zatím'})` : ''}` : '';
  return `<article class="karta ${trida}" data-id="${esc(r.id)}">
    <h3><span>${esc(r.zbozi || 'Bez označení zboží')}</span><small>${esc(r.cislo)}</small></h3>
    <div class="lhuta">${textLhuty(r, l)}</div>
    <div class="meta">
      <span class="znacka">${J.STAVY[r.stav]}</span>
      ${protistrana ? `<span>${role === 'prodejce' ? '👤' : '🏪'} ${esc(protistrana)}</span>` : ''}
      <span>${r.kupujiciTyp === 'podnikatel' ? '🏢 B2B' : '🙋 spotřebitel'}</span>
      <span>uplatněno ${D(r.datumUplatneni)}</span>
      ${r.sn ? `<span>SN ${esc(r.sn)}</span>` : ''}
      ${r.fotky.length ? `<span>📷 ${r.fotky.length}</span>` : ''}
      ${l.vcasUplatneno === false ? '<span class="znacka" style="border-color:var(--danger)">uplatněno po lhůtě pro vady</span>' : ''}
    </div>
    ${r.vada ? `<div class="vada">${esc(r.vada)}</div>` : ''}
    ${prodl ? `<div class="meta">${prodl}${l.domnenka ? ' · domněnka 1 roku ✔' : ''}</div>` : ''}
    ${role === 'spotrebitel' && l.stavLhuty === 'prosla' ? `<div class="upozorneni">Prodávající reklamaci nevyřídil v zákonné lhůtě. Můžete <b>odstoupit od smlouvy</b> a žádat vrácení peněz, nebo přiměřenou slevu. <button class="btn mini" data-akce="odstoupeni">✉️ Dopis o odstoupení</button></div>` : ''}
    ${role === 'prodejce' && l.stavLhuty === 'prosla' ? '<div class="upozorneni">Zákonná lhůta uplynula – kupující může odstoupit od smlouvy nebo žádat slevu.</div>' : ''}
    <div class="akce">
      <button class="btn mini" data-akce="upravit">✎ Upravit</button>
      <button class="btn mini" data-akce="prijeti" title="Potvrzení o uplatnění reklamace (A4)">🖨️ Přijetí</button>
      ${J.uzavrena(r) ? '<button class="btn mini" data-akce="vyrizeni" title="Potvrzení o vyřízení reklamace (A4)">🖨️ Vyřízení</button>' : ''}
      ${role === 'spotrebitel' ? '<button class="btn mini" data-akce="dopis" title="Dopis s uplatněním vady">✉️ Dopis</button>' : ''}
    </div>
  </article>`;
}

function vykresli() {
  document.querySelectorAll('[data-role]').forEach(b => b.setAttribute('aria-pressed', b.dataset.role === role));
  const d = dnes(), moje = mojeReklamace();
  const sh = J.souhrn(moje, d);
  const dl = (f, cislo, popis) => `<button class="dlazdice ${f}" data-filtr="${f}" aria-pressed="${filtrSouhrn === f}"><b>${cislo}</b><span>${popis}</span></button>`;
  let h = `<div class="souhrn">${dl('otevrene', sh.otevrene, '📥 otevřené')}${dl('brzy', sh.brzy, `⏰ lhůta do ${J.BRZY_DNI} dní`)}${dl('prosla', sh.prosle, '⛔ po lhůtě')}${dl('vyrizeno', sh.vyrizene, '✅ vyřízené')}${dl('zamitnuto', sh.zamitnute, '⛔ zamítnuté')}</div>`;
  h += `<p class="role-info">${role === 'prodejce'
    ? '🏪 Přijaté reklamace od zákazníků – číselná řada ' + esc(data.nastaveni.prefix) + '-ROK-číslo. Údaje firmy do protokolu: <i>Soubor → Moje údaje</i>.'
    : '🙋 Moje reklamace u obchodů – hlídání 30denní lhůty, dopis s uplatněním vady a odstoupení po marné lhůtě.'}</p>`;
  if (!moje.length) {
    h += `<div class="prazdno">Zatím žádná reklamace.<br><button class="btn primary" data-prikaz="nova">✚ Nová reklamace</button></div>`;
    $('obsah').innerHTML = h; return;
  }
  let sez = J.filtruj(moje, { text: $('hledat').value, stav: $('filtrStav').value });
  if (filtrSouhrn === 'otevrene') sez = sez.filter(r => !J.uzavrena(r));
  else if (filtrSouhrn === 'brzy' || filtrSouhrn === 'prosla') sez = sez.filter(r => J.lhuty(r, d).stavLhuty === filtrSouhrn);
  else if (filtrSouhrn) sez = sez.filter(r => r.stav === filtrSouhrn);
  h += sez.length ? `<div class="seznam">${J.serad(sez, d).map(karta).join('')}</div>` : '<div class="prazdno">Filtru nic neodpovídá.</div>';
  $('obsah').innerHTML = h;
}

/* ---------- dialog reklamace ---------- */
function otevri(dlg) {
  return new Promise(res => {
    dlg.addEventListener('close', () => res(dlg.returnValue), { once: true });
    dlg.returnValue = '';
    dlg.showModal();
  });
}
const OS = ['jmeno', 'adresa', 'ico', 'telefon', 'email'];
const f = $('dlgRek').querySelector('form');
f.zpusobUplatneni.innerHTML = Object.entries(J.UPLATNENI).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
f.pozadavek.innerHTML = Object.entries(J.POZADAVKY).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
f.stav.innerHTML = Object.entries(J.STAVY).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
f.v_zpusob.innerHTML += Object.entries(J.ZPUSOBY).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');

let prac = null;   // { r, fotky, nove:Set, smazane:Set }
function zFormulare() {
  const o = Object.assign({}, prac.r, {
    cislo: f.cislo.value, datumUplatneni: f.datumUplatneni.value, zpusobUplatneni: f.zpusobUplatneni.value, kupujiciTyp: f.kupujiciTyp.value,
    kupujici: Object.fromEntries(OS.map(k => [k, f['k_' + k].value])),
    prodavajici: Object.fromEntries(OS.map(k => [k, f['p_' + k].value])),
    zbozi: f.zbozi.value, sn: f.sn.value, doklad: f.doklad.value, cena: f.cena.value, datumKoupe: f.datumKoupe.value, datumPrevzeti: f.datumPrevzeti.value,
    pouzite: f.pouzite.checked, lhutaMesice: f.lhutaMesice.value, zarukaMesice: f.zarukaMesice.value,
    vada: f.vada.value, pozadavek: f.pozadavek.value, dohodnutaLhuta: f.dohodnutaLhuta.value, prislusenstvi: f.prislusenstvi.value, stavZbozi: f.stavZbozi.value,
    vecPredana: f.vecPredana.checked, stav: f.stav.value, posudek: f.posudek.value,
    vyrizeni: { datum: f.v_datum.value, zpusob: f.v_zpusob.value, popis: f.v_popis.value, castka: f.v_castka.value },
    datumVraceni: f.datumVraceni.value, poznamka: f.poznamka.value, fotky: prac.fotky
  });
  if (!f.datumPrevzeti.value) o.datumPrevzeti = '';
  return J.normReklamace(o);
}
function doFormulare(r) {
  f.cislo.value = r.cislo; f.datumUplatneni.value = r.datumUplatneni; f.zpusobUplatneni.value = r.zpusobUplatneni; f.kupujiciTyp.value = r.kupujiciTyp;
  OS.forEach(k => { f['k_' + k].value = r.kupujici[k]; f['p_' + k].value = r.prodavajici[k]; });
  f.zbozi.value = r.zbozi; f.sn.value = r.sn; f.doklad.value = r.doklad; f.cena.value = r.cena == null ? '' : String(r.cena).replace('.', ',');
  f.datumKoupe.value = r.datumKoupe; f.datumPrevzeti.value = r.datumPrevzeti !== r.datumKoupe ? r.datumPrevzeti : '';
  f.pouzite.checked = r.pouzite; f.lhutaMesice.value = r.lhutaMesice; f.zarukaMesice.value = r.zarukaMesice || '';
  f.vada.value = r.vada; f.pozadavek.value = r.pozadavek; f.dohodnutaLhuta.value = r.dohodnutaLhuta; f.prislusenstvi.value = r.prislusenstvi; f.stavZbozi.value = r.stavZbozi;
  f.vecPredana.checked = r.vecPredana; f.stav.value = r.stav; f.posudek.value = r.posudek;
  f.v_datum.value = r.vyrizeni.datum; f.v_zpusob.value = r.vyrizeni.zpusob; f.v_popis.value = r.vyrizeni.popis;
  f.v_castka.value = r.vyrizeni.castka == null ? '' : String(r.vyrizeni.castka).replace('.', ',');
  f.datumVraceni.value = r.datumVraceni; f.poznamka.value = r.poznamka;
  $('dlgHistorie').innerHTML = r.historie.map(h => `<li>${D(h.datum)} – ${esc(h.text)}</li>`).join('');
}
function obnovInfo() {
  const r = zFormulare(), d = dnes();
  const spotr = r.kupujiciTyp === 'spotrebitel';
  $('poleKIco').hidden = spotr;
  f.lhutaMesice.disabled = spotr && !r.pouzite;
  if (spotr && !r.pouzite) f.lhutaMesice.value = 24;
  const seznam = data.reklamace.filter(x => x.id !== r.id).concat(r);
  const l = J.lhutyVSeznamu(seznam, r, d);
  const radky = [];
  if (l.vyrizeniDo) radky.push(`⏳ Vyřídit do <b>${D(l.vyrizeniDo)}</b>${r.dohodnutaLhuta ? ' (dohodnutá lhůta)' : ' (30 dní, § 19 odst. 3 ZOS; konec na volný den se posouvá)'}${l.zbyva != null ? ' · ' + J.popisZbyva(l.zbyva) : ''}.`);
  else radky.push('Kupující podnikatel: zákonná 30denní lhůta neplatí – zadejte dohodnutou, pokud nějaká je.');
  if (l.konecOdpovednosti) {
    radky.push(`📅 Lhůta pro uplatnění vad: do <b>${D(l.konecOdpovednosti)}</b> (${r.lhutaMesice} měs. od převzetí${l.predchozi ? `, + ${l.predchozi} dní z dřívějších reklamací téhož výrobního čísla` : ''}).` +
      (l.konecZaruky ? ` Smluvní záruka do <b>${D(l.konecZaruky)}</b>.` : ''));
    radky.push(l.vcasUplatneno ? '✅ Reklamace uplatněna včas.' : '⚠️ Reklamace uplatněna <b>po uplynutí lhůty</b> pro vady.');
    if (spotr) radky.push(l.domnenka ? '⚖️ Vada se projevila do 1 roku od převzetí → má se za to, že existovala už při převzetí (§ 2161 odst. 5 OZ).' : '⚖️ Po 1 roce od převzetí musí kupující doložit, že vada existovala už při převzetí.');
    if (l.dnyNeuzivani) radky.push(`🔧 Kupující nemůže věc užívat ${l.dnyNeuzivani} dní → lhůta pro vady se posouvá na <b>${D(l.novyKonec)}</b>${l.novyKonecZaruky ? `, záruka na ${D(l.novyKonecZaruky)}` : ''} (§ 2165 odst. 4 OZ).`);
  } else radky.push('Zadejte datum koupě nebo převzetí – spočítá se lhůta pro vady.');
  $('dlgLhuty').innerHTML = radky.join('<br>');
  $('dlgLhuty').classList.toggle('chyba', l.vcasUplatneno === false || l.stavLhuty === 'prosla');
}
async function vykresliFotky() {
  const h = [];
  for (const id of prac.fotky) {
    const u = await Fotky.url(id);
    if (u) h.push(`<div class="fotka"><img src="${u}" alt="Fotka vady" data-nahled="${esc(id)}"><button type="button" class="btn mini danger" data-smaz-foto="${esc(id)}" aria-label="Odebrat fotku">✕</button></div>`);
  }
  $('dlgFotky').innerHTML = h.join('') || '<span>žádné</span>';
}
$('dlgPridatFoto').onclick = () => $('souborFoto').click();
$('souborFoto').onchange = async e => {
  const soubory = [...e.target.files]; e.target.value = '';
  for (const s of soubory) {
    try {
      const blob = await zmensi(s), id = J.novyId();
      await Fotky.uloz({ id, blob, nazev: s.name });
      prac.fotky.push(id); prac.nove.add(id);
    } catch (er) { Dialog.chyba('Fotku „' + s.name + '“ se nepodařilo načíst.'); }
  }
  vykresliFotky();
};
$('dlgFotky').addEventListener('click', e => {
  const s = e.target.closest('[data-smaz-foto]');
  if (s) { prac.fotky = prac.fotky.filter(x => x !== s.dataset.smazFoto); prac.smazane.add(s.dataset.smazFoto); return vykresliFotky(); }
  const n = e.target.closest('[data-nahled]');
  if (n) { $('nahled').querySelector('img').src = n.src; $('nahled').hidden = false; }
});
$('nahled').onclick = () => { $('nahled').hidden = true; };
f.addEventListener('input', obnovInfo);
f.addEventListener('change', obnovInfo);
f.addEventListener('submit', e => {
  if (!e.submitter || e.submitter.value !== 'ok') return;
  const chyba = !f.zbozi.value.trim() ? 'Vyplňte označení zboží.' : !J.jeDatum(f.datumUplatneni.value) ? 'Vyplňte datum uplatnění.' :
    (f.datumKoupe.value && f.datumUplatneni.value < f.datumKoupe.value) ? 'Datum uplatnění je před datem koupě.' :
    (f.stav.value === 'zamitnuto' && !f.v_popis.value.trim()) ? 'Zamítnutí musí být odůvodněno (§ 19 odst. 2 ZOS) – vyplňte popis.' : '';
  if (chyba) { e.preventDefault(); Dialog.chyba(chyba); }
});

async function upravReklamaci(r) {
  const novy = !r;
  if (novy) {
    const n = data.nastaveni, uplatneno = dnes();
    r = J.normReklamace({
      role, datumUplatneni: uplatneno,
      cislo: J.dalsiCislo(mojeReklamace(), role === 'prodejce' ? n.prefix : 'MOJE', uplatneno.slice(0, 4)),
      prodavajici: role === 'prodejce' ? n.firma : {}, kupujici: role === 'spotrebitel' ? n.ja : {}
    });
  }
  prac = { r, fotky: r.fotky.slice(), nove: new Set(), smazane: new Set() };
  $('dlgRekTitul').textContent = novy ? '✚ Nová reklamace' : '✎ Reklamace ' + r.cislo;
  $('fsProdavajici').hidden = role === 'prodejce';
  $('dlgRekSmaz').hidden = novy;
  doFormulare(r); obnovInfo(); vykresliFotky();
  $('dlgRekSmaz').onclick = async () => {
    if (!await Dialog.potvrd(`Smazat reklamaci ${r.cislo} včetně fotek?`)) return;
    for (const id of new Set(r.fotky.concat(prac.fotky))) await Fotky.smaz(id).catch(() => {});
    data.reklamace = data.reklamace.filter(x => x.id !== r.id); uloz(); prac = null;
    $('dlgRek').close('smazano'); vykresli();
  };
  const v = await otevri($('dlgRek'));
  if (!prac) return;
  if (v !== 'ok') { for (const id of prac.nove) await Fotky.smaz(id).catch(() => {}); prac = null; return; }
  const nova = zFormulare();
  if (J.uzavrena(nova) && !nova.vyrizeni.datum) nova.vyrizeni.datum = dnes();
  if (role === 'prodejce' && !nova.prodavajici.jmeno) nova.prodavajici = J.normOsoba(data.nastaveni.firma);
  if (novy) nova.historie.push({ datum: nova.datumUplatneni, text: 'reklamace uplatněna' });
  else if (r.stav !== nova.stav) nova.historie.push({ datum: dnes(), text: 'stav: ' + J.STAVY[nova.stav].replace(/^\S+\s/, '') });
  for (const id of prac.smazane) await Fotky.smaz(id).catch(() => {});
  if (novy) data.reklamace.push(nova); else data.reklamace = data.reklamace.map(x => x.id === nova.id ? nova : x);
  prac = null; uloz(); vykresli();
  Dialog.info('Uloženo.');
}

/* ---------- tisk ---------- */
const radek = (k, v) => v === '' || v == null ? '' : `<tr><th>${k}</th><td>${v}</td></tr>`;
const osobaHtml = o => esc(J.osobaText(o));
async function tiskni(html, cekatNaObrazky) {
  $('tisk').innerHTML = html;
  if (cekatNaObrazky) await Promise.all([...$('tisk').querySelectorAll('img')].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
  print();
}
async function fotkyHtml(r) {
  const u = (await Promise.all(r.fotky.map(id => Fotky.url(id)))).filter(Boolean);
  return u.length ? `<h2>Fotodokumentace vady</h2><div class="tfotky">${u.map(x => `<img src="${x}" alt="">`).join('')}</div>` : '';
}
function hlavicka(r, nadpis) {
  const p = r.prodavajici;
  const prov = r.role === 'prodejce' && data.nastaveni.provozovna ? '\nProvozovna: ' + data.nastaveni.provozovna : '';
  return `<div class="hlava"><div><h1>${nadpis}</h1><div class="osoba" style="border:0;padding:0;min-height:0">${osobaHtml(p)}${esc(prov)}</div></div>
    <div class="cislo">č. ${esc(r.cislo)}</div></div>`;
}
const zapati = () => `<div class="zapati">Vystaveno ${D(dnes())} · lhůty podle zák. 89/2012 Sb. a 634/1992 Sb. ve znění k 16. 11. 2026 · Reklamační protokol</div>`;

async function tiskPrijeti(r) {
  const l = J.lhutyVSeznamu(data.reklamace, r, dnes()), spotr = r.kupujiciTyp === 'spotrebitel';
  const html = `${hlavicka(r, 'Potvrzení o uplatnění reklamace')}
  <h2>Kupující</h2><div class="osoba">${osobaHtml(r.kupujici) || '&nbsp;'}\n${spotr ? 'spotřebitel' : 'podnikatel'}</div>
  <h2>Reklamované zboží</h2><table>
    ${radek('Zboží', esc(r.zbozi))}${radek('Výrobní / sériové číslo', esc(r.sn))}${radek('Doklad o koupi', esc(r.doklad))}
    ${radek('Cena', r.cena != null ? esc(J.castkaText(r.cena)) : '')}${radek('Datum koupě', D(r.datumKoupe))}${radek('Datum převzetí', r.datumPrevzeti !== r.datumKoupe ? D(r.datumPrevzeti) : '')}
    ${radek('Reklamace uplatněna', D(r.datumUplatneni) + ' – ' + J.UPLATNENI[r.zpusobUplatneni])}
    ${radek('Předané příslušenství', esc(r.prislusenstvi))}${radek('Stav zboží při převzetí', esc(r.stavZbozi))}
  </table>
  <h2>Popis vady (obsah reklamace)</h2><div class="text">${esc(r.vada)}</div>
  <table style="margin-top:2mm">${radek('Požadovaný způsob vyřízení', esc(J.POZADAVKY[r.pozadavek]))}
    ${radek('Lhůta pro vyřízení', l.vyrizeniDo ? D(l.vyrizeniDo) + (r.dohodnutaLhuta ? ' (dohodnutá lhůta)' : ' (30 dnů od uplatnění, § 19 odst. 3 zák. 634/1992 Sb.)') : 'dle dohody smluvních stran')}
  </table>
  ${await fotkyHtml(r)}
  ${spotr ? `<p class="poucka">Poučení: Reklamace včetně odstranění vady musí být vyřízena a kupující o tom informován nejpozději do 30 dnů od uplatnění, nedohodne-li se s prodávajícím na delší lhůtě; po jejím marném uplynutí může kupující od smlouvy odstoupit nebo požadovat přiměřenou slevu. Projeví-li se vada do jednoho roku od převzetí, má se za to, že věc byla vadná již při převzetí (§ 2161 odst. 5 OZ). Po dobu, kdy kupující nemůže věc užívat kvůli oprávněné reklamaci, lhůta pro uplatnění vad neběží (§ 2165 odst. 4 OZ). Kupující má právo na náhradu účelně vynaložených nákladů (§ 1924 OZ).</p>` : ''}
  <div class="podpisy"><div>za prodávajícího (jméno, podpis, razítko)</div><div>kupující</div></div>${zapati()}`;
  tiskni(html, r.fotky.length);
}
function tiskVyrizeni(r) {
  const l = J.lhutyVSeznamu(data.reklamace, r, dnes()), zam = r.stav === 'zamitnuto';
  const doba = r.vyrizeni.datum ? J.rozdilDni(r.datumUplatneni, r.vyrizeni.datum) : null;
  const html = `${hlavicka(r, 'Potvrzení o vyřízení reklamace')}
  <h2>Kupující</h2><div class="osoba">${osobaHtml(r.kupujici) || '&nbsp;'}</div>
  <h2>Reklamace</h2><table>
    ${radek('Zboží', esc(r.zbozi))}${radek('Výrobní / sériové číslo', esc(r.sn))}${radek('Reklamace uplatněna', D(r.datumUplatneni))}
    ${radek('Popis vady', esc(r.vada))}${radek('Požadovaný způsob', esc(J.POZADAVKY[r.pozadavek]))}
  </table>
  <h2>Výsledek</h2><table>
    ${radek('Rozhodnutí', zam ? '<b>reklamace zamítnuta</b>' : '<b>reklamace uznána</b>')}
    ${radek('Způsob vyřízení', zam ? '' : esc(J.ZPUSOBY[r.vyrizeni.zpusob] || ''))}
    ${radek('Datum vyřízení', D(r.vyrizeni.datum))}${radek('Doba vyřízení', doba != null ? doba + ' dní' : '')}
    ${radek('Vyřízeno v lhůtě', l.stavLhuty === 'vcas' ? 'ano' : l.stavLhuty === 'pozde' ? 'ne (lhůta do ' + D(l.vyrizeniDo) + ')' : '')}
    ${radek('Vrácená částka / sleva', r.vyrizeni.castka != null ? esc(J.castkaText(r.vyrizeni.castka)) : '')}
    ${radek('Posudek / vyjádření', esc(r.posudek))}
  </table>
  <h2>${zam ? 'Odůvodnění zamítnutí' : 'Popis vyřízení (provedená oprava, vyměněné díly…)'}</h2><div class="text">${esc(r.vyrizeni.popis)}</div>
  ${!zam && l.konecOdpovednosti && l.dnyNeuzivani ? `<p class="poucka">Po dobu ${l.dnyNeuzivani} dní, kdy kupující nemohl věc užívat, lhůta pro uplatnění práv z vadného plnění neběžela (§ 2165 odst. 4 OZ). Vady lze uplatnit do ${D(l.novyKonec)}${l.novyKonecZaruky ? ', smluvní záruka trvá do ' + D(l.novyKonecZaruky) : ''}.</p>` : ''}
  ${zam && r.kupujiciTyp === 'spotrebitel' ? '<p class="poucka">Nesouhlasí-li kupující se zamítnutím, může se obrátit na soud nebo využít mimosoudní řešení spotřebitelského sporu u České obchodní inspekce (adr.coi.cz).</p>' : ''}
  <div class="podpisy"><div>za prodávajícího (jméno, podpis, razítko)</div><div>převzal kupující (datum, podpis)</div></div>${zapati()}`;
  tiskni(html);
}
async function ukazDopis(nadpis, text) {
  $('dlgDopisTitul').textContent = nadpis;
  $('dopisText').value = text;
  $('dopisKopie').onclick = async () => {
    try { await navigator.clipboard.writeText($('dopisText').value); Dialog.info('Zkopírováno.'); }
    catch (e) { $('dopisText').select(); Dialog.chyba('Schránka není dostupná – text je označený, zkopírujte Ctrl+C.'); }
  };
  $('dopisTisk').onclick = () => tiskni(`<div class="dopis">${esc($('dopisText').value)}</div>`);
  otevri($('dlgDopis'));
  $('dopisText').scrollTop = 0; $('dopisText').setSelectionRange(0, 0);
}

/* ---------- soubor ---------- */
function stahni(jmeno, obsah, typ) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([obsah], { type: typ }));
  a.download = jmeno; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const naDataUrl = blob => new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });

const PRIKAZY = {
  nova: () => upravReklamaci(null),
  napoveda: () => otevri($('dlgNapoveda')),
  udaje: async () => {
    const dlg = $('dlgUdaje'), g = dlg.querySelector('form'), n = data.nastaveni;
    OS.forEach(k => { if (g['f_' + k]) g['f_' + k].value = n.firma[k]; if (g['j_' + k]) g['j_' + k].value = n.ja[k]; });
    g.provozovna.value = n.provozovna; g.prefix.value = n.prefix;
    if (await otevri(dlg) !== 'ok') return;
    data = J.migruj(Object.assign({}, data, { nastaveni: {
      prefix: g.prefix.value, provozovna: g.provozovna.value,
      firma: Object.fromEntries(OS.map(k => [k, g['f_' + k] ? g['f_' + k].value : ''])),
      ja: Object.fromEntries(OS.map(k => [k, g['j_' + k] ? g['j_' + k].value : '']))
    } }));
    uloz(); vykresli();
  },
  csv: () => stahni('reklamace-' + (role === 'prodejce' ? 'prijate' : 'moje') + '-' + dnes() + '.csv', J.csv(mojeReklamace(), dnes()), 'text/csv'),
  zaloha: async () => {
    const fotky = [];
    for (const x of await Fotky.vse().catch(() => [])) fotky.push({ id: x.id, nazev: x.nazev, data: await naDataUrl(x.blob) });
    stahni('reklamace-zaloha-' + dnes() + '.json', JSON.stringify({ aplikace: 'reklamace', data, fotky }), 'application/json');
  },
  obnov: () => $('souborImport').click(),
  smazVse: async () => {
    if (!await Dialog.potvrd('Opravdu smazat všechny reklamace (obě role), fotky i nastavení? Doporučujeme nejdřív zálohu.')) return;
    data = J.prazdna(); uloz(); await Fotky.vymaz().catch(() => {}); vykresli();
  }
};
$('souborImport').onchange = async e => {
  const s = e.target.files[0]; e.target.value = '';
  if (!s) return;
  let z;
  try { z = JSON.parse(await s.text()); } catch (er) { return Dialog.chyba('Soubor není platný JSON.'); }
  if (!z || z.aplikace !== 'reklamace' || !z.data) return Dialog.chyba('Tohle není záloha Reklamačního protokolu.');
  const m = J.migruj(z.data);
  if (!await Dialog.potvrd(`Záloha obsahuje ${m.reklamace.length} reklamací a ${(z.fotky || []).length} fotek. Nahradit jimi současná data?`)) return;
  await Fotky.vymaz().catch(() => {});
  for (const x of z.fotky || []) {
    try { await Fotky.uloz({ id: String(x.id), nazev: x.nazev || '', blob: await (await fetch(x.data)).blob() }); } catch (er) {}
  }
  data = m; uloz(); vykresli(); Dialog.info('Obnoveno.');
};

/* ---------- nabídky a události ---------- */
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
  if (!e.target.closest('.nabidka')) zavriNabidky();
  const ro = e.target.closest('[data-role]');
  if (ro) { role = ro.dataset.role; filtrSouhrn = ''; try { localStorage.setItem(J.KLIC + '_role', role); } catch (er) {} return vykresli(); }
  const fl = e.target.closest('[data-filtr]');
  if (fl) { filtrSouhrn = filtrSouhrn === fl.dataset.filtr ? '' : fl.dataset.filtr; return vykresli(); }
  const a = e.target.closest('[data-akce]');
  if (!a) return;
  const r = data.reklamace.find(x => x.id === a.closest('[data-id]').dataset.id); if (!r) return;
  const akce = a.dataset.akce;
  if (akce === 'upravit') upravReklamaci(r);
  else if (akce === 'prijeti') tiskPrijeti(r);
  else if (akce === 'vyrizeni') tiskVyrizeni(r);
  else if (akce === 'dopis') ukazDopis('✉️ Uplatnění reklamace – dopis', J.dopisUplatneni(r, dnes()));
  else if (akce === 'odstoupeni') ukazDopis('✉️ Odstoupení od smlouvy', J.dopisOdstoupeni(r, dnes()));
});
addEventListener('resize', zavriNabidky);
document.addEventListener('keydown', e => { if (e.key === 'Escape') { zavriNabidky(); $('nahled').hidden = true; } });
$('hledat').addEventListener('input', vykresli);
$('filtrStav').addEventListener('change', vykresli);
addEventListener('storage', e => { if (e.key === J.KLIC) { data = J.migruj(JSON.parse(e.newValue || 'null')); vykresli(); } });

vykresli();
window.REKLAMACE_APP = { data: () => data, vykresli, upravReklamaci, tiskPrijeti, tiskVyrizeni };
})();

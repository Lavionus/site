/* Staré mapy – rozhraní (mapy, porovnání, časová osa, měření, poznámky, export, místa).
   Jádro bez DOM: jadro.js (STMAPY). Vlastní skeny a georeference: georef.js (window.SMSken). */
'use strict';
const S = window.STMAPY;
const $ = id => document.getElementById(id);
const KLIC_STAV = 'webapp_stare_mapy_stav', KLIC_MISTA = 'webapp_stare_mapy_mista';
const KLIC_KRESBA = 'webapp_stare_mapy_kresba', KLIC_NAST = 'webapp_stare_mapy_nastaveni';
const VYCHOZI = { z: 15, lat: 50.08690, lon: 14.42080, a: 'ortofoto', b: 'vm2', rezim: 'opona', pruhlednost: 70, opona: 50 };
const nacti = (k, v) => { try { const x = JSON.parse(localStorage.getItem(k)); return x == null ? v : x; } catch (e) { return v; } };
const zapis = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* plné úložiště – nevadí */ } };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* vlastní skeny (doplní georef.js) – vrstvy { id: 'sken:…', typ: 'sken', … } */
const vlastni = [];
const vsechny = () => [...S.VRSTVY, ...vlastni];
const najdi = id => vsechny().find(v => v.id === id) || null;
const nast = Object.assign({ kresba: true, souradnice: true, jenZde: true, sbaleno: false }, nacti(KLIC_NAST, {}));

let stav = Object.assign({}, VYCHOZI);
let lupaR = 110, lupaBod = null;

/* ---------- vrstvy ---------- */
const chybyVrstev = {};
async function pripravDef(def) {
  if (def.urovne || !def.capabilities) return def;
  const r = await fetch(def.capabilities);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const cap = S.parsujWmts(await r.text());
  const sada = cap.sady[def.sada];
  if (!sada || !sada.urovne.length) throw new Error('služba nemá očekávanou mřížku dlaždic');
  def.urovne = sada.urovne;
  return def;
}
function vytvorVrstvu(def) {
  const opt = { attribution: def.atribuce, maxZoom: 20, crossOrigin: 'anonymous' };
  if (def.bounds) opt.bounds = L.latLngBounds([def.bounds[1], def.bounds[0]], [def.bounds[3], def.bounds[2]]);
  if (def.minZoom) opt.minZoom = def.minZoom;
  let v;
  if (def.typ === 'xyz') v = L.tileLayer(def.url, Object.assign(opt, { maxNativeZoom: def.maxZoom, subdomains: 'abc' }));
  else if (def.typ === 'wms') v = L.tileLayer.wms(def.url, Object.assign(opt, { layers: def.vrstvy, format: 'image/png', transparent: !!def.pruhledna, version: '1.3.0', styles: '' }));
  else if (def.typ === 'arcgis') v = L.tileLayer.arcgis(def, opt);
  else if (def.typ === 'sken') v = window.SMSken.vrstva(def, opt);
  else v = L.gridLayer.jtsk(Object.assign(opt, { sablona: def.sablona, sada: def.sada, urovne: def.urovne, maxUroven: def.maxUroven }));
  let chyb = 0, cas = 0, prepnuto = false;
  v.on('tileerror', () => {
    chyb++; clearTimeout(cas);
    if (def.zaloha && !prepnuto && chyb >= 3) { prepnuto = true; v.setUrl(def.zaloha); chyb = 0; return; }
    cas = setTimeout(() => { if (chyb >= 3) { chybyVrstev[def.id] = true; ukazStav(); } chyb = 0; }, 1500);
  });
  v.on('load', () => { if (chybyVrstev[def.id]) { delete chybyVrstev[def.id]; ukazStav(); } });
  return v;
}
function ukazStav(text) {
  const vadne = Object.keys(chybyVrstev).map(id => (najdi(id) || { nazev: id }).nazev);
  $('stav').textContent = text || (vadne.length ? '⚠️ Část dlaždic se nenačetla: ' + vadne.join(', ') + '. Server může být přetížený nebo jste offline – zkuste to za chvíli.' : '');
}

/* ---------- mapy ---------- */
const kresbaRenderer = L.canvas({ padding: 0.3 });
const mapa = L.map('mapa', { zoomControl: true, minZoom: 5, maxZoom: 20, worldCopyJump: false, renderer: kresbaRenderer }).setView([stav.lat, stav.lon], stav.z);
mapa.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');
L.control.scale({ imperial: false }).addTo(mapa);
let mapa2 = null, vrstvaA = null, vrstvaB = null, vrstvaB2 = null, tecka = null, tecka2 = null;

let verzeVrstev = 0;
async function nastavVrstvy() {
  const verze = ++verzeVrstev;
  ukazStav('');
  const defA = najdi(stav.a), defB = najdi(stav.b);
  try { await Promise.all([pripravDef(defA), pripravDef(defB)]); }
  catch (e) { ukazStav('⚠️ Službu se nepodařilo načíst (' + e.message + '). Zkontrolujte připojení.'); }
  if (verze !== verzeVrstev) return;              // mezitím přišla novější volba map
  for (const v of [vrstvaA, vrstvaB, vrstvaB2]) if (v) v.remove();
  vrstvaA = vrstvaB = vrstvaB2 = null;
  const hotova = d => d.typ !== 'wmts' || d.urovne;
  if (hotova(defA)) vrstvaA = vytvorVrstvu(defA).addTo(mapa);
  if (hotova(defB)) {
    if (stav.rezim === 'vedle') { vrstvaB2 = vytvorVrstvu(defB).addTo(zajistiMapu2()); }
    else { vrstvaB = vytvorVrstvu(defB).addTo(mapa); vrstvaB.bringToFront(); }
  }
  pouzijRezim();
  kresliOsu();
}

function zajistiMapu2() {
  if (mapa2) return mapa2;
  $('mapa2').hidden = false;
  mapa2 = L.map('mapa2', { zoomControl: false, minZoom: 5, maxZoom: 20 }).setView(mapa.getCenter(), mapa.getZoom());
  mapa2.attributionControl.setPrefix(false);
  let vede = null;
  const sync = (z, na) => () => {
    if (vede && vede !== z) return;
    vede = z; na.setView(z.getCenter(), z.getZoom(), { animate: false }); vede = null;
  };
  mapa.on('move zoom', sync(mapa, mapa2)); mapa2.on('move zoom', sync(mapa2, mapa));
  const styl = { radius: 5, color: '#fff', weight: 2, fillColor: '#e0312b', fillOpacity: 1, interactive: false };
  tecka = L.circleMarker([0, 0], styl); tecka2 = L.circleMarker([0, 0], styl);
  mapa.on('mousemove', e => { tecka2.setLatLng(e.latlng).addTo(mapa2); tecka.remove(); });
  mapa2.on('mousemove', e => { tecka.setLatLng(e.latlng).addTo(mapa); tecka2.remove(); ukazSouradnice(e.latlng); });
  mapa.on('mouseout', () => tecka2.remove()); mapa2.on('mouseout', () => tecka.remove());
  return mapa2;
}

/* ---------- režimy porovnání ---------- */
function pouzijRezim() {
  const r = stav.rezim, vedle = r === 'vedle';
  document.querySelectorAll('[data-rezim]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.rezim === r)));
  $('plocha').classList.toggle('vedle', vedle);
  if (mapa2) { $('mapa2').hidden = !vedle; }
  $('stitek2').hidden = !vedle;
  if (vedle) { const a = najdi(stav.a), b = najdi(stav.b); $('stitek2').textContent = a.nazev + '  ⟷  ' + b.nazev + ' (' + b.rok + ')'; }
  $('opona').hidden = r !== 'opona';
  $('lupaKruh').hidden = r !== 'lupa' || !lupaBod;
  $('posuvnik').disabled = vedle;
  const pop = { prekryv: 'Průhlednost', opona: 'Opona', lupa: 'Velikost lupy', vedle: 'Vedle sebe' }[r] || '';
  $('posuvnikPopis').textContent = pop;
  const hod = r === 'prekryv' ? stav.pruhlednost : r === 'opona' ? stav.opona : r === 'lupa' ? Math.round((lupaR - 50) / 2.5) : 50;
  $('posuvnik').value = hod;
  $('posuvnikHodnota').textContent = r === 'lupa' ? lupaR * 2 + ' px' : vedle ? '' : Math.round(hod) + ' %';
  if (vrstvaB) vrstvaB.setOpacity(r === 'prekryv' ? stav.pruhlednost / 100 : 1);
  setTimeout(() => { mapa.invalidateSize(); if (mapa2) mapa2.invalidateSize(); orizni(); }, 0);
  ulozStav();
}
function orizni() {
  if (!vrstvaB) return;
  const el = vrstvaB.getContainer();
  if (!el) return;
  const vel = mapa.getSize(), nw = mapa.containerPointToLayerPoint([0, 0]);
  el.style.clip = ''; el.style.clipPath = '';
  if (stav.rezim === 'opona') {
    const x = vel.x * stav.opona / 100;
    $('opona').style.left = x + 'px';
    el.style.clip = `rect(${nw.y}px, ${nw.x + x}px, ${nw.y + vel.y}px, ${nw.x}px)`;
  } else if (stav.rezim === 'lupa') {
    if (!lupaBod) { el.style.clipPath = 'circle(0px at 0 0)'; return; }
    el.style.clipPath = `circle(${lupaR}px at ${nw.x + lupaBod.x}px ${nw.y + lupaBod.y}px)`;
    const k = $('lupaKruh');
    k.hidden = false;
    Object.assign(k.style, { left: (lupaBod.x - lupaR) + 'px', top: (lupaBod.y - lupaR) + 'px', width: 2 * lupaR + 'px', height: 2 * lupaR + 'px' });
  }
}
mapa.on('move zoomend viewreset resize', orizni);
mapa.on('moveend', () => { ulozStav(); kresliOsu(); });
mapa.on('mousemove', e => { if (stav.rezim === 'lupa') { lupaBod = e.containerPoint; orizni(); } ukazSouradnice(e.latlng); });
mapa.on('mouseout', () => { if (stav.rezim === 'lupa') { lupaBod = null; $('lupaKruh').hidden = true; orizni(); } });
mapa.getContainer().addEventListener('touchmove', e => {
  if (stav.rezim !== 'lupa' || e.touches.length !== 1) return;
  const r = mapa.getContainer().getBoundingClientRect();
  lupaBod = L.point(e.touches[0].clientX - r.left, e.touches[0].clientY - r.top - lupaR * 0.6);
  orizni();
}, { passive: true });

/* tažení opony */
(function () {
  const o = $('opona');
  let tahne = false;
  const pohyb = e => {
    if (!tahne) return;
    const r = $('mapa').getBoundingClientRect();
    stav.opona = Math.max(0, Math.min(100, (e.clientX - r.left) / r.width * 100));
    $('posuvnik').value = stav.opona; $('posuvnikHodnota').textContent = Math.round(stav.opona) + ' %';
    orizni();
  };
  o.addEventListener('pointerdown', e => { tahne = true; o.setPointerCapture(e.pointerId); e.preventDefault(); });
  o.addEventListener('pointermove', pohyb);
  o.addEventListener('pointerup', () => { tahne = false; ulozStav(); });
  o.addEventListener('pointercancel', () => { tahne = false; });
  L.DomEvent.disableClickPropagation(o);
})();

function nastavPosuvnik(v) {
  v = Math.max(0, Math.min(100, Number(v)));
  $('posuvnik').value = v;
  if (stav.rezim === 'prekryv') { stav.pruhlednost = v; if (vrstvaB) vrstvaB.setOpacity(v / 100); $('posuvnikHodnota').textContent = v + ' %'; }
  else if (stav.rezim === 'opona') { stav.opona = v; $('posuvnikHodnota').textContent = v + ' %'; orizni(); }
  else if (stav.rezim === 'lupa') {
    lupaR = Math.round(50 + v * 2.5); $('posuvnikHodnota').textContent = lupaR * 2 + ' px';
    if (!lupaBod) lupaBod = mapa.getSize().divideBy(2);
    orizni();
  }
}
$('posuvnik').addEventListener('input', e => nastavPosuvnik(e.target.value));
$('posuvnik').addEventListener('change', ulozStav);
L.DomEvent.disableClickPropagation($('panel')); L.DomEvent.disableScrollPropagation($('panel'));
L.DomEvent.disableClickPropagation($('kresliPruh'));
$('sbalit').onclick = () => {
  nast.sbaleno = !nast.sbaleno; zapis(KLIC_NAST, nast); sbalPanel();
};
function sbalPanel() {
  $('panel').classList.toggle('sbaleny', nast.sbaleno);
  $('sbalit').textContent = nast.sbaleno ? '▴' : '▾';
  $('sbalit').setAttribute('aria-expanded', String(!nast.sbaleno));
}

/* ---------- výběr map a časová osa ---------- */
function naplnVybery() {
  const serazene = vsechny().sort((x, y) => x.razeni - y.razeni);
  const html = Object.entries(S.OBLASTI).map(([kod, nazev]) => {
    const v = serazene.filter(x => (x.oblast || 'vlastni') === kod);
    return v.length ? `<optgroup label="${esc(nazev)}">` + v.map(x => `<option value="${esc(x.id)}">${esc(x.rok)} – ${esc(x.nazev)}</option>`).join('') + '</optgroup>' : '';
  }).join('');
  $('vyberA').innerHTML = html; $('vyberB').innerHTML = html;
  $('vyberA').value = stav.a; $('vyberB').value = stav.b;
  kresliOsu();
}
function vrstvyNaOse() {
  const c = mapa.getCenter();
  const s = nast.jenZde ? S.vrstvyVBode(vsechny(), c.lat, c.lng) : vsechny();
  return s.filter(v => v.id === stav.b || v.id === stav.a || v.oblast !== 'dnes' || v.id === 'ortofoto' || v.id === 'osm');
}
const kratky = v => v.nazev.replace(/ \(.*\)$/, '').replace(' – Speciální mapa', ' (Speciální)').replace(/^(Praha|Vídeň|Slovensko|Sasko|Štýrsko) – /, '');
function kresliOsu() {
  const seznam = vrstvyNaOse().sort((x, y) => x.razeni - y.razeni);
  $('osa').innerHTML = seznam.map(v => `<button class="tl" data-osa="${esc(v.id)}" aria-pressed="${v.id === stav.b}" title="${esc(v.nazev)} – ${esc(v.meritko)}">${esc(v.rok)}<small>${esc(kratky(v))}</small></button>`).join('');
  const akt = $('osa').querySelector('[aria-pressed="true"]');
  if (akt) akt.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  // pravítko let: lineární od nejstarší mapy po dnešek
  const roky = seznam.map(v => v.razeni), r0 = Math.min(...roky, 1900), r1 = 2026;
  const x = r => ((r - r0) / Math.max(1, r1 - r0) * 100).toFixed(2) + '%';
  const desetileti = [];
  const krok = r1 - r0 > 200 ? 50 : 25;
  for (let r = Math.ceil(r0 / krok) * krok; r <= r1; r += krok) desetileti.push(r);
  $('pravitko').innerHTML = desetileti.map(r => `<span class="rok" style="left:${x(r)}">${r}</span>`).join('') +
    seznam.map(v => `<button class="tecka${v.id === stav.b ? ' aktivni' : v.id === stav.a ? ' spodni' : ''}" data-osa="${esc(v.id)}" style="left:${x(Math.min(v.razeni, r1))}" title="${esc(v.rok)} – ${esc(v.nazev)}" tabindex="-1"></button>`).join('');
  const b = najdi(stav.b);
  $('osaInfo').textContent = b ? `Nahoře: ${b.rok} – ${b.nazev} (${b.meritko})` : '';
  $('osaStarsi').disabled = !S.sousedNaOse(seznam, stav.b, -1);
  $('osaNovejsi').disabled = !S.sousedNaOse(seznam, stav.b, 1);
}
function posunOsu(smer) {
  const id = S.sousedNaOse(vrstvyNaOse(), stav.b, smer);
  if (id) zmenMapy(stav.a === id ? stav.b : stav.a, id);
}
function zmenMapy(a, b) {
  stav.a = a; stav.b = b;
  $('vyberA').value = a; $('vyberB').value = b;
  nastavVrstvy();
}
$('vyberA').onchange = e => zmenMapy(e.target.value, stav.b);
$('vyberB').onchange = e => zmenMapy(stav.a, e.target.value);
$('prohodit').onclick = () => zmenMapy(stav.b, stav.a);
$('osaStarsi').onclick = () => posunOsu(-1);
$('osaNovejsi').onclick = () => posunOsu(1);
const klikOsa = e => { const b = e.target.closest('[data-osa]'); if (b) zmenMapy(stav.a === b.dataset.osa ? stav.b : stav.a, b.dataset.osa); };
$('osa').addEventListener('click', klikOsa);
$('pravitko').addEventListener('click', klikOsa);
function nastavRezim(r) {
  const bylo = stav.rezim;
  stav.rezim = r;
  if ((bylo === 'vedle') !== (r === 'vedle')) nastavVrstvy(); else pouzijRezim();
}
document.querySelectorAll('[data-rezim]').forEach(b => b.onclick = () => nastavRezim(b.dataset.rezim));

/* ---------- stav v adrese ---------- */
function aktualniStav() {
  const c = mapa.getCenter();
  return Object.assign({}, stav, { z: mapa.getZoom(), lat: c.lat, lon: c.lng });
}
function ulozStav() {
  const h = S.stavDoHashe(aktualniStav());
  zapis(KLIC_STAV, h);
  try { history.replaceState(null, '', location.pathname + location.search + h); } catch (e) { /* sandbox */ }
}
window.addEventListener('hashchange', () => {
  const s = S.hashNaStav(location.hash, vsechny().map(v => v.id));
  if (s.lat == null) return;
  const zmena = s.a && s.a !== stav.a || s.b && s.b !== stav.b || s.rezim && s.rezim !== stav.rezim;
  Object.assign(stav, s);
  mapa.setView([s.lat, s.lon], s.z);
  if (zmena) { naplnVybery(); nastavVrstvy(); } else pouzijRezim();
});
$('sdilet').onclick = async () => {
  const url = location.href.split('#')[0] + S.stavDoHashe(aktualniStav());
  const sken = [stav.a, stav.b].some(id => id.startsWith('sken:'));
  try { await navigator.clipboard.writeText(url); Dialog.info('Odkaz zkopírován do schránky.' + (sken ? ' Pozor: vlastní sken je jen ve vašem prohlížeči, příjemce uvidí místo něj výchozí mapu.' : '')); }
  catch (e) { await Dialog.zeptej('Zkopírujte odkaz:', url); }
};

/* ---------- souřadnice kurzoru ---------- */
let posledniSour = null;
function ukazSouradnice(ll) {
  if (!nast.souradnice) return;
  posledniSour = ll;
  const f = S.formatSouradnice(ll.lat, ll.lng);
  const m = Math.round(S.meritkoObrazovky(mapa.getZoom(), ll.lat) / 10) * 10;
  $('souradnice').textContent = `${f.wgs}  ·  S-JTSK ${f.jtsk}  ·  1 : ${m.toLocaleString('cs-CZ')}`;
}
$('souradnice').onclick = async () => {
  if (!posledniSour) return;
  const f = S.formatSouradnice(posledniSour.lat, posledniSour.lng);
  try { await navigator.clipboard.writeText(f.wgs + '\n' + f.jtsk); Dialog.info('Souřadnice zkopírovány.'); } catch (e) { /* nic */ }
};

/* ---------- hledání (Nominatim: max. 1 dotaz/s, jen po Enteru, bez automatického doplňování) ---------- */
let hledanyNazev = '', posledniDotaz = 0;
$('hledatForm').addEventListener('submit', async e => {
  e.preventDefault();
  const q = $('hledat').value.trim();
  if (!q) return;
  const sour = S.parsujSouradnice(q);
  if (sour) { mapa.setView([sour.lat, sour.lon], Math.max(mapa.getZoom(), 16)); znackaHledani(sour.lat, sour.lon); return; }
  const n = $('nabVysledky');
  n.innerHTML = '<div class="prazdne">Hledám…</div>'; otevriNabidku(n, $('hledat'));
  const cekat = posledniDotaz + 1100 - Date.now();
  if (cekat > 0) await new Promise(ok => setTimeout(ok, cekat));
  posledniDotaz = Date.now();
  try {
    const r = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&accept-language=cs&countrycodes=cz,sk,at,de,pl,hu&q=' + encodeURIComponent(q));
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const vysl = await r.json();
    n.innerHTML = vysl.length
      ? vysl.map((v, i) => `<button class="tl" data-vysledek="${i}">📍 ${esc(v.display_name)}</button>`).join('') + '<div class="prazdne" style="font-size:.72rem">Hledání: Nominatim, © přispěvatelé OpenStreetMap</div>'
      : '<div class="prazdne">Nic nenalezeno. Zkuste jiný tvar názvu.</div>';
    n.onclick = ev => {
      const b = ev.target.closest('[data-vysledek]'); if (!b) return;
      const v = vysl[b.dataset.vysledek];
      zavriNabidky();
      if (v.boundingbox) mapa.fitBounds([[+v.boundingbox[0], +v.boundingbox[2]], [+v.boundingbox[1], +v.boundingbox[3]]], { maxZoom: 17 });
      else mapa.setView([+v.lat, +v.lon], 16);
      hledanyNazev = v.display_name.split(',')[0];
      znackaHledani(+v.lat, +v.lon);
    };
  } catch (er) {
    n.innerHTML = '<div class="prazdne">⚠️ Hledání se nepodařilo (' + esc(er.message) + '). Jste online?</div>';
  }
});
let znacka = null;
function znackaHledani(lat, lon) {
  if (znacka) znacka.remove();
  znacka = L.circleMarker([lat, lon], { radius: 9, color: '#e0312b', weight: 3, fill: false, interactive: false }).addTo(mapa);
  setTimeout(() => { if (znacka) { znacka.remove(); znacka = null; } }, 8000);
}

/* ---------- nabídky ---------- */
function zavriNabidky() {
  document.querySelectorAll('.nabidka:not([hidden])').forEach(n => { n.hidden = true; });
  document.querySelectorAll('[data-nabidka][aria-expanded="true"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
}
function otevriNabidku(n, kotva) {
  zavriNabidky();
  n.hidden = false;
  const r = kotva.getBoundingClientRect();
  n.style.top = (r.bottom + 4) + 'px';
  n.style.left = Math.max(6, Math.min(r.left, innerWidth - n.offsetWidth - 6)) + 'px';
}
document.querySelectorAll('[data-nabidka]').forEach(b => b.addEventListener('click', e => {
  e.stopPropagation();
  const n = $(b.dataset.nabidka), bylo = !n.hidden;
  if (bylo) return zavriNabidky();
  if (n.id === 'nabMista') kresliMista(); else if (n.id === 'nabJinde') kresliJinde();
  otevriNabidku(n, b); b.setAttribute('aria-expanded', 'true');
}));
document.addEventListener('click', e => { if (!e.target.closest('.nabidka') && !e.target.closest('#hledatForm')) zavriNabidky(); });

function kresliJinde() {
  const c = mapa.getCenter(), z = mapa.getZoom();
  $('nabJinde').innerHTML = '<div class="titulek">Tato poloha v původních prohlížečích</div>' +
    S.ODKAZY.map(o => `<a class="tl" href="${esc(o.url(c.lat, c.lng, z, hledanyNazev))}" target="_blank" rel="noopener">↗ ${esc(o.nazev)}</a>`).join('') +
    '<hr><div class="prazdne" style="font-size:.76rem">Tyto mapy sem nelze vložit (licence, předplatné, přihlašovací token nebo souhlas s podmínkami), proto jen odkaz. Oldmaps, Chartae antiquae a geoportál Jihočeského kraje polohu z odkazu nepřebírají; David Rumsey hledá podle názvu naposledy hledaného místa.</div>';
}

/* záložky míst */
let mista = nacti(KLIC_MISTA, []);
if (!Array.isArray(mista)) mista = [];
function kresliMista() {
  const n = $('nabMista');
  n.innerHTML = '<button class="tl" id="pridatMisto">➕ Uložit toto místo…</button><hr>' +
    (mista.length ? mista.map((m, i) => `<div class="misto"><button class="tl" data-misto="${i}" title="${esc(najdi(m.b) ? najdi(m.b).nazev : '')}">⭐ ${esc(m.nazev)}</button><button class="tl" data-smaz-misto="${i}" title="Smazat" aria-label="Smazat ${esc(m.nazev)}">✕</button></div>`).join('')
      : '<div class="prazdne">Zatím žádná uložená místa.</div>');
}
$('nabMista').addEventListener('click', async e => {
  e.stopPropagation();
  if (e.target.closest('#pridatMisto')) {
    zavriNabidky();
    const c = mapa.getCenter();
    const nazev = await Dialog.zeptej('Název místa', hledanyNazev || `${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}`);
    if (!nazev || !nazev.trim()) return;
    const s = aktualniStav();
    mista.push({ nazev: nazev.trim().slice(0, 80), hash: S.stavDoHashe(s), b: s.b });
    zapis(KLIC_MISTA, mista); Dialog.info('Místo uloženo.');
    return;
  }
  const sm = e.target.closest('[data-smaz-misto]');
  if (sm) {
    const m = mista[sm.dataset.smazMisto];
    if (!await Dialog.potvrd(`Smazat místo „${m.nazev}“?`)) return;
    mista.splice(sm.dataset.smazMisto, 1); zapis(KLIC_MISTA, mista); kresliMista(); return;
  }
  const b = e.target.closest('[data-misto]');
  if (b) { zavriNabidky(); location.hash = mista[b.dataset.misto].hash; }
});

/* ---------- kresba: poznámky a měření se Zpět/Znovu ---------- */
let kresba = nacti(KLIC_KRESBA, null);
if (!kresba || !Array.isArray(kresba.poznamky) || !Array.isArray(kresba.mereni)) kresba = { poznamky: [], mereni: [] };
const historie = S.Historie(100);
const vrstvaKresby = L.layerGroup().addTo(mapa);
const BARVA = '#d6312b';
function zmenKresbu(fn) {
  historie.uloz(kresba);
  fn();
  ulozKresbu();
}
function ulozKresbu() {
  zapis(KLIC_KRESBA, kresba);
  kresliKresbu();
  $('zpet').disabled = !historie.lzeZpet(); $('znovu').disabled = !historie.lzeZnovu();
}
function zpet() { const k = historie.zpet(kresba); if (k) { kresba = k; ulozKresbu(); } }
function znovu() { const k = historie.znovu(kresba); if (k) { kresba = k; ulozKresbu(); } }
$('zpet').onclick = zpet; $('znovu').onclick = znovu;
const popisMereni = m => m.typ === 'plocha'
  ? `${S.formatPlocha(S.plocha(m.body))} · obvod ${S.formatDelka(S.delkaLinie([...m.body, m.body[0]]))}`
  : S.formatDelka(S.delkaLinie(m.body));
function kresliKresbu() {
  vrstvaKresby.clearLayers();
  if (!nast.kresba) return;
  for (const m of kresba.mereni) {
    const ll = m.body.map(b => [b.lat, b.lon]);
    const tvar = m.typ === 'plocha' ? L.polygon(ll, { color: BARVA, weight: 2.5, fillOpacity: 0.15 }) : L.polyline(ll, { color: BARVA, weight: 3 });
    const plo = m.typ === 'plocha';
    tvar.bindTooltip(esc((m.nazev ? m.nazev + ': ' : '') + popisMereni(m)), { permanent: true, direction: plo ? 'center' : 'right', offset: plo ? [0, 0] : [8, 0], className: 'popis-mereni' });
    tvar.bindPopup(() => popupKresby('mereni', m));
    vrstvaKresby.addLayer(tvar);
    if (!plo) tvar.openTooltip(ll[ll.length - 1]);      // délku ukázat u koncového bodu, ať se nepřekrývá s plochou
  }
  for (const p of kresba.poznamky) {
    const z = L.circleMarker([p.lat, p.lon], { radius: 7, color: '#fff', weight: 2, fillColor: BARVA, fillOpacity: 1 });
    if (p.nazev) z.bindTooltip(esc(p.nazev), { permanent: true, direction: 'right', offset: [8, 0], className: 'popis-mereni' });
    z.bindPopup(() => popupKresby('poznamka', p));
    vrstvaKresby.addLayer(z);
  }
}
function popupKresby(druh, x) {
  const d = document.createElement('div');
  d.innerHTML = druh === 'poznamka'
    ? `<b>📌 ${esc(x.nazev || 'Poznámka')}</b>${x.text ? '<div style="white-space:pre-wrap">' + esc(x.text) + '</div>' : ''}<div style="font-size:.74rem;color:var(--text-muted)">${esc(S.formatSouradnice(x.lat, x.lon).wgs)}</div>`
    : `<b>${x.typ === 'plocha' ? '⬠' : '📏'} ${esc(x.nazev || (x.typ === 'plocha' ? 'Plocha' : 'Délka'))}</b><div>${esc(popisMereni(x))}</div><div style="font-size:.74rem;color:var(--text-muted)">${x.body.length} bodů</div>`;
  d.insertAdjacentHTML('beforeend', '<div class="radek-tl"><button class="tl" data-a="upravit">✎ Upravit</button><button class="tl" data-a="smazat">🗑 Smazat</button></div>');
  d.onclick = async e => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    mapa.closePopup();
    const seznam = druh === 'poznamka' ? 'poznamky' : 'mereni';
    if (b.dataset.a === 'smazat') { zmenKresbu(() => { kresba[seznam] = kresba[seznam].filter(y => y.id !== x.id); }); return; }
    const nazev = await Dialog.zeptej('Název', x.nazev || '');
    if (nazev === null || nazev === undefined) return;
    let text = x.text;
    if (druh === 'poznamka') { text = await Dialog.zeptej('Text poznámky (nepovinný)', x.text || ''); if (text === null || text === undefined) text = x.text; }
    zmenKresbu(() => { const y = kresba[seznam].find(z => z.id === x.id); if (y) { y.nazev = String(nazev).slice(0, 120); if (druh === 'poznamka') y.text = String(text || '').slice(0, 2000); } });
  };
  return d;
}

/* režim kreslení */
let kresli = null;            // { typ: 'linie'|'plocha'|'poznamka', body: [], docasna }
function zacniKreslit(typ) {
  ukonciKresleni(false);
  if (stav.rezim === 'vedle') nastavRezim('opona');
  kresli = { typ, body: [], docasna: null };
  mapa.doubleClickZoom.disable();
  mapa.getContainer().classList.add('kreslim');
  $('kresliPruh').hidden = false;
  $('kresliHotovo').hidden = typ === 'poznamka';
  aktualizujKresleni();
}
function aktualizujKresleni(kurzor) {
  if (!kresli) return;
  if (kresli.docasna) kresli.docasna.remove();
  const body = kursorBody(kurzor);
  const ll = body.map(b => [b.lat, b.lon]);
  kresli.docasna = kresli.typ === 'plocha' && body.length >= 3 ? L.polygon(ll, { color: BARVA, dashArray: '6 5', weight: 2, fillOpacity: 0.1, interactive: false })
    : L.polyline(ll, { color: BARVA, dashArray: '6 5', weight: 2.5, interactive: false });
  kresli.docasna.addTo(mapa);
  const t = kresli.typ === 'poznamka' ? '📌 Klikněte do mapy, kam poznámku umístit.'
    : kresli.typ === 'plocha' ? `⬠ ${body.length >= 3 ? S.formatPlocha(S.plocha(body)) + ' · obvod ' + S.formatDelka(S.delkaLinie([...body, body[0]])) : 'Klikejte vrcholy plochy'}`
      : `📏 ${body.length >= 2 ? S.formatDelka(S.delkaLinie(body)) : 'Klikejte body trasy'}`;
  $('kresliText').textContent = t + (kresli.typ !== 'poznamka' ? ' – dvojklik nebo Enter ukončí, Backspace vrátí bod, Esc zruší' : ' Esc zruší.');
}
const kursorBody = k => k ? [...kresli.body, { lat: k.lat, lon: k.lng }] : kresli.body;
async function ukonciKresleni(ulozit) {
  if (!kresli) return;
  const k = kresli; kresli = null;
  if (k.docasna) k.docasna.remove();
  mapa.doubleClickZoom.enable();
  mapa.getContainer().classList.remove('kreslim');
  $('kresliPruh').hidden = true;
  if (!ulozit) return;
  const min = k.typ === 'plocha' ? 3 : 2;
  if (k.body.length < min) return;
  zmenKresbu(() => kresba.mereni.push({ id: S.noveId(), typ: k.typ, body: k.body, nazev: '' }));
}
mapa.on('click', async e => {
  if (!kresli) return;
  if (kresli.typ === 'poznamka') {
    const ll = e.latlng;
    ukonciKresleni(false);
    const nazev = await Dialog.zeptej('Název poznámky', '');
    if (nazev === null || nazev === undefined) return;
    const text = await Dialog.zeptej('Text poznámky (nepovinný)', '');
    zmenKresbu(() => kresba.poznamky.push({ id: S.noveId(), lat: ll.lat, lon: ll.lng, nazev: String(nazev).slice(0, 120), text: String(text || '').slice(0, 2000) }));
    return;
  }
  const b = { lat: e.latlng.lat, lon: e.latlng.lng }, p = kresli.body[kresli.body.length - 1];
  if (p && mapa.latLngToContainerPoint([p.lat, p.lon]).distanceTo(e.containerPoint) < 4) return;   // druhý klik dvojkliku
  kresli.body.push(b);
  aktualizujKresleni();
});
mapa.on('dblclick', () => { if (kresli && kresli.typ !== 'poznamka') ukonciKresleni(true); });
mapa.on('mousemove', e => { if (kresli && kresli.body.length) aktualizujKresleni(e.latlng); });
$('kresliHotovo').onclick = () => ukonciKresleni(true);
$('kresliZrusit').onclick = () => ukonciKresleni(false);

/* ---------- soubory: GeoJSON, záloha ---------- */
function stahni(nazev, data, typ) {
  const blob = data instanceof Blob ? data : new Blob([data], { type: typ || 'application/octet-stream' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = nazev;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const dnes = () => new Date().toISOString().slice(0, 10);
function exportGeojson() {
  if (!kresba.poznamky.length && !kresba.mereni.length) return Dialog.info('Zatím nemáte žádné poznámky ani měření.');
  stahni(`stare_mapy_kresba_${dnes()}.geojson`, JSON.stringify(S.kresbaNaGeoJSON(kresba), null, 1), 'application/geo+json');
}
function nactiSoubor(input) {
  return new Promise(ok => {
    input.value = '';
    input.onchange = () => ok(input.files[0] || null);
    input.click();
  });
}
async function importGeojson() {
  const f = await nactiSoubor($('souborGeojson'));
  if (!f) return;
  try {
    const k = S.geoJsonNaKresbu(JSON.parse(await f.text()));
    if (!k.poznamky.length && !k.mereni.length) return Dialog.chyba('V souboru nejsou žádné body, linie ani plochy.');
    zmenKresbu(() => { kresba.poznamky.push(...k.poznamky); kresba.mereni.push(...k.mereni); });
    const vse = [...k.poznamky.map(p => [p.lat, p.lon]), ...k.mereni.flatMap(m => m.body.map(b => [b.lat, b.lon]))];
    mapa.fitBounds(vse, { maxZoom: 17, padding: [40, 40] });
    Dialog.info(`Načteno: ${k.poznamky.length} poznámek, ${k.mereni.length} linií a ploch. Souřadnice se čtou jako WGS 84 (EPSG:4326).`);
  } catch (e) { Dialog.chyba('Soubor se nepodařilo načíst: ' + e.message); }
}
async function smazatKresbu() {
  if (!kresba.poznamky.length && !kresba.mereni.length) return;
  if (!await Dialog.potvrd('Smazat všechny poznámky a měření? (Jde vrátit tlačítkem Zpět.)')) return;
  zmenKresbu(() => { kresba = { poznamky: [], mereni: [] }; });
}
async function zaloha() {
  const skeny = await window.SMSken.export();
  const data = { format: 'stare_mapy', verze: 1, datum: new Date().toISOString(), stav: aktualniStav(), mista, kresba, skeny };
  stahni(`stare_mapy_zaloha_${dnes()}.json`, JSON.stringify(data), 'application/json');
}
async function obnova() {
  const f = await nactiSoubor($('souborZaloha'));
  if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    if (d.format !== 'stare_mapy') throw new Error('není to záloha Starých map');
    if (!await Dialog.potvrd(`Obnovit zálohu z ${String(d.datum || '').slice(0, 10)}? Místa a kresba se nahradí, skeny se přidají (stejné se přepíšou).`)) return;
    if (Array.isArray(d.mista)) { mista = d.mista.filter(m => m && m.nazev && m.hash); zapis(KLIC_MISTA, mista); }
    if (d.kresba && Array.isArray(d.kresba.poznamky) && Array.isArray(d.kresba.mereni)) zmenKresbu(() => { kresba = d.kresba; });
    const n = await window.SMSken.import(d.skeny || []);
    Dialog.info(`Obnoveno: ${mista.length} míst, ${kresba.poznamky.length} poznámek, ${kresba.mereni.length} měření, ${n} skenů.`);
  } catch (e) { Dialog.chyba('Zálohu se nepodařilo obnovit: ' + e.message); }
}

/* ---------- export výřezu do PNG ---------- */
function kresliDlazdice(ctx, vrstva, kontejnerMapy, o) {
  if (!vrstva || !vrstva.getContainer || !vrstva.getContainer()) return;
  const k = vrstva.getContainer(), op = Number(getComputedStyle(k).opacity);
  const rm = kontejnerMapy.getBoundingClientRect();
  ctx.save();
  ctx.beginPath(); ctx.rect(rm.left - o.left, rm.top - o.top, rm.width, rm.height); ctx.clip();
  if (o.klip) o.klip(ctx, rm.left - o.left, rm.top - o.top);
  ctx.globalAlpha = isFinite(op) ? op : 1;
  for (const t of k.querySelectorAll('img.leaflet-tile-loaded, canvas.leaflet-tile')) {
    const r = t.getBoundingClientRect();
    if (r.width && r.height) ctx.drawImage(t, r.left - o.left, r.top - o.top, r.width, r.height);
  }
  ctx.restore();
}
async function exportPng() {
  const plocha = $('plocha'), rp = plocha.getBoundingClientRect();
  const W = Math.round(rp.width), H = Math.round(rp.height);
  const defA = najdi(stav.a), defB = najdi(stav.b);
  const zdroje = [...new Set([defB, defA].filter(Boolean).map(d => S.bezHtml(d.atribuce)))];
  const c0 = mapa.getCenter(), m = Math.round(S.meritkoObrazovky(mapa.getZoom(), c0.lat) / 10) * 10;
  const nadpis = stav.rezim === 'vedle' ? `${defA.nazev} (${defA.rok})  ⟷  ${defB.nazev} (${defB.rok})`
    : `${defB.nazev} (${defB.rok}) / ${defA.nazev} (${defA.rok})`;
  const radky = [nadpis, `Střed ${S.formatSouradnice(c0.lat, c0.lng).wgs} · S-JTSK ${S.formatSouradnice(c0.lat, c0.lng).jtsk} · přibližně 1 : ${m.toLocaleString('cs-CZ')} · ${new Date().toLocaleDateString('cs-CZ')}`,
    'Zdroje: ' + zdroje.join(' · '), 'Staré mapy – lavionus.github.io/site'];
  const c = document.createElement('canvas'), ctx = c.getContext('2d');
  ctx.font = '13px system-ui, sans-serif';
  // zalomení řádků podle šířky
  const zalom = t => { const s = t.split(' '), r = []; let l = ''; for (const w of s) { const z = l ? l + ' ' + w : w; if (ctx.measureText(z).width > W - 20 && l) { r.push(l); l = w; } else l = z; } if (l) r.push(l); return r; };
  const text = radky.flatMap(zalom);
  c.width = W; c.height = H + 10 + text.length * 17;
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
  const o = { left: rp.left, top: rp.top };
  kresliDlazdice(ctx, vrstvaA, mapa.getContainer(), o);
  if (stav.rezim === 'vedle') kresliDlazdice(ctx, vrstvaB2, mapa2.getContainer(), o);
  else {
    const vel = mapa.getSize();
    const klip = stav.rezim === 'opona' ? (g, x, y) => { g.beginPath(); g.rect(x, y, vel.x * stav.opona / 100, vel.y); g.clip(); }
      : stav.rezim === 'lupa' ? (g, x, y) => { g.beginPath(); if (lupaBod) g.arc(x + lupaBod.x, y + lupaBod.y, lupaR, 0, 2 * Math.PI); g.clip(); } : null;
    kresliDlazdice(ctx, vrstvaB, mapa.getContainer(), Object.assign({ klip }, o));
    if (stav.rezim === 'opona') { ctx.fillStyle = '#d6312b'; ctx.fillRect(vel.x * stav.opona / 100 - 1.5, 0, 3, vel.y); }
  }
  // kresba (plátno Leafletu) + popisky
  if (nast.kresba) {
    for (const k of mapa.getPane('overlayPane').querySelectorAll('canvas')) {
      const r = k.getBoundingClientRect(); ctx.drawImage(k, r.left - o.left, r.top - o.top, r.width, r.height);
    }
    ctx.font = '12px system-ui, sans-serif'; ctx.textBaseline = 'middle';
    const stitek = (t, p, stred) => {
      const w = ctx.measureText(t).width + 10, x = stred ? p.x - w / 2 : p.x + 10;
      ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fillRect(x, p.y - 9, w, 18); ctx.strokeStyle = '#888'; ctx.strokeRect(x, p.y - 9, w, 18);
      ctx.fillStyle = '#111'; ctx.fillText(t, x + 5, p.y);
    };
    for (const mm of kresba.mereni) {
      const posl = mm.body[mm.body.length - 1];
      const bod = mm.typ === 'plocha' ? L.latLngBounds(mm.body.map(x => [x.lat, x.lon])).getCenter() : L.latLng(posl.lat, posl.lon);
      stitek((mm.nazev ? mm.nazev + ': ' : '') + popisMereni(mm), mapa.latLngToContainerPoint(bod), mm.typ === 'plocha');
    }
    for (const p of kresba.poznamky) if (p.nazev) stitek(p.nazev, mapa.latLngToContainerPoint([p.lat, p.lon]), false);
  }
  ctx.fillStyle = '#f2f2f2'; ctx.fillRect(0, H, W, c.height - H);
  ctx.fillStyle = '#111'; ctx.font = '13px system-ui, sans-serif'; ctx.textBaseline = 'top';
  text.forEach((t, i) => { ctx.font = (i === 0 ? 'bold ' : '') + '13px system-ui, sans-serif'; ctx.fillText(t, 10, H + 6 + i * 17); });
  try {
    const blob = await new Promise((ok, chyba) => { try { c.toBlob(b => b ? ok(b) : chyba(new Error('prázdný obrázek')), 'image/png'); } catch (e) { chyba(e); } });
    stahni(`stare_mapy_${dnes()}.png`, blob);
  } catch (e) {
    Dialog.chyba('Obrázek se nepodařilo vytvořit (' + e.message + '). Některý server neposlal dlaždice s povolením CORS – zkuste jinou mapu.');
  }
}

/* ---------- příkazy, přepínače a klávesy ---------- */
const PRIKAZY = {
  exportPng, exportGeojson, importGeojson, zaloha, obnova, smazatKresbu,
  merDelka: () => zacniKreslit('linie'), merPlocha: () => zacniKreslit('plocha'), poznamka: () => zacniKreslit('poznamka'),
  georef: () => window.SMSken.otevriEditor(), skeny: () => window.SMSken.otevriSeznam()
};
document.querySelectorAll('[data-prikaz]').forEach(b => b.addEventListener('click', () => { zavriNabidky(); PRIKAZY[b.dataset.prikaz](); }));
function pouzijNastaveni() {
  document.querySelectorAll('[data-prep]').forEach(b => b.setAttribute('aria-pressed', String(!!nast[b.dataset.prep])));
  $('souradnice').hidden = !nast.souradnice;
  kresliKresbu(); kresliOsu(); sbalPanel();
}
document.querySelectorAll('[data-prep]').forEach(b => b.addEventListener('click', e => {
  e.stopPropagation();
  nast[b.dataset.prep] = !nast[b.dataset.prep]; zapis(KLIC_NAST, nast); pouzijNastaveni();
}));
document.addEventListener('keydown', e => {
  if (!$('georef').hidden) return;                                 // editor skenu má vlastní klávesy
  if (e.key === 'Escape') { zavriNabidky(); if (kresli) ukonciKresleni(false); return; }
  if (document.querySelector('dialog[open]')) return;
  const vPoli = e.target.closest('input, textarea, select, [contenteditable]');
  if ((e.ctrlKey || e.metaKey) && !vPoli) {
    const k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey) { e.preventDefault(); zpet(); } else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); znovu(); }
    return;
  }
  if (vPoli || e.altKey || e.ctrlKey || e.metaKey) return;
  if (kresli && e.key === 'Enter') { e.preventDefault(); ukonciKresleni(true); return; }
  if (kresli && e.key === 'Backspace') { e.preventDefault(); kresli.body.pop(); aktualizujKresleni(); return; }
  const akce = {
    '1': () => nastavRezim('prekryv'), '2': () => nastavRezim('opona'), '3': () => nastavRezim('lupa'), '4': () => nastavRezim('vedle'),
    ',': () => posunOsu(-1), '.': () => posunOsu(1), x: () => $('prohodit').click(),
    m: PRIKAZY.merDelka, p: PRIKAZY.merPlocha, n: PRIKAZY.poznamka, g: PRIKAZY.georef, e: exportPng,
    '/': () => $('hledat').focus(), '?': () => $('dlgNapoveda').showModal(),
    PageUp: () => { nastavPosuvnik(Number($('posuvnik').value) + 5); ulozStav(); },
    PageDown: () => { nastavPosuvnik(Number($('posuvnik').value) - 5); ulozStav(); }
  }[e.key.length === 1 ? e.key.toLowerCase() : e.key];
  if (akce) { e.preventDefault(); akce(); }
});

/* ---------- dialogy ---------- */
function kresliInfo() {
  const serazene = vsechny().sort((x, y) => x.razeni - y.razeni);
  const karty = Object.entries(S.OBLASTI).map(([kod, nazev]) => {
    const v = serazene.filter(x => (x.oblast || 'vlastni') === kod);
    return v.length ? `<div class="oblast-nadpis">${esc(nazev)}</div>` + v.map(x => `<div class="karta"><b><a href="#" data-info-vrstva="${esc(x.id)}">${esc(x.nazev)}</a></b>
      <div class="meta">${esc(x.rok)} · ${esc(x.meritko)} · ${esc(x.zdroj)}</div>
      <div>${esc(x.popis)}</div>
      <div class="lic">Licence: ${esc(x.licence)} · ${x.typ === 'sken' ? esc(x.atribuce) : x.atribuce}</div></div>`).join('') : '';
  }).join('');
  $('infoTelo').innerHTML = '<p>Všechny vložené mapy jsou veřejné prohlížecí služby; dostupnost, CORS a podmínky užití ověřeny 16.–17. 11. 2026. Kliknutím na název mapu zobrazíte nahoře. Mapy mimo střed obrazovky na časové ose nejsou.</p>' + karty +
    `<h3>Mapy dostupné jen odkazem (🔗 Jinde)</h3>
    <ul>
      <li><b>Císařské otisky a originální mapy stabilního katastru</b> (1824–1843, 1 : 2 880), <b>Státní mapa odvozená 1 : 5 000</b> (SMO-5, od 50. let), <b>topografické mapy S-1952</b> 1 : 10 000–1 : 200 000 a <b>archivní ortofota ČÚZK po letech</b> (od 1998) – Archiv ČÚZK; jeho služby vyžadují přihlašovací token a WMS archivních ortofot je podmíněna souhlasem s podmínkami, sem je proto vložit nelze. Bezešvou mapu otisků Jihočeského kraje nabízí krajský geoportál, jeho podmínky ale vkládání do cizích stránek nepovolují.</li>
      <li><b>Mapire / Arcanum</b> (I. a II. vojenské mapování, katastry celé monarchie) – placené předplatné, vkládání do cizích webů podmínky nedovolují.</li>
      <li><b>Old Maps Online</b> a <b>David Rumsey Map Collection</b> – vyhledávače starých map z knihoven celého světa; jednotlivé mapy mají různé licence, proto jen hledání.</li>
    </ul>
    <h3>Upozornění k licencím</h3>
    <p>Chartae antiquae (VÚGTK a HÚ AV ČR) zveřejňuje adresy služeb přímo u map, licenci ale výslovně neuvádí – vrstvy jsou vloženy s plnou atribucí. U slovenských ŠMO 5 platí otevřená data ÚGKK SR (CC BY 4.0), u konkrétní služby to výslovně uvedeno není.</p>
    <h3>Další služby</h3>
    <p>Hledání míst: <a href="https://nominatim.openstreetmap.org/" target="_blank" rel="noopener">Nominatim</a> (podle pravidel služby nejvýš 1 dotaz za sekundu, jen po Enteru), data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">přispěvatelé OpenStreetMap</a> (ODbL). Mapová knihovna Leaflet (BSD-2).</p>`;
}
$('oMapach').onclick = () => { kresliInfo(); $('dlgInfo').showModal(); };
$('infoTelo').addEventListener('click', e => {
  const a = e.target.closest('[data-info-vrstva]'); if (!a) return;
  e.preventDefault(); $('dlgInfo').close();
  const v = najdi(a.dataset.infoVrstva);
  zmenMapy(stav.a === v.id ? stav.b : stav.a, v.id);
  if (v.bounds && !S.vrstvyVBode([v], mapa.getCenter().lat, mapa.getCenter().lng).length)
    mapa.setView([(v.bounds[1] + v.bounds[3]) / 2, (v.bounds[0] + v.bounds[2]) / 2], Math.max(mapa.getZoom(), v.oblast === 'praha' || v.oblast === 'at' ? 13 : 10));
});
$('napoveda').onclick = () => $('dlgNapoveda').showModal();
document.querySelectorAll('[data-zavrit]').forEach(b => b.onclick = () => b.closest('dialog').close());
document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));

/* ---------- start: nejdřív vlastní skeny (kvůli id v odkazu), pak stav ---------- */
window.StareMapy = {
  mapa, najdi, vsechny, stav: () => stav, zmenMapy, naplnVybery, nastavVrstvy, vlastni,
  get kresba() { return kresba; }, zacniKreslit, ukonciKresleni, exportPng, nastavRezim, posunOsu
};
addEventListener('DOMContentLoaded', async function start() {
  try { await window.SMSken.nactiVse(); } catch (e) { /* IndexedDB nedostupná – jedeme bez skenů */ }
  const ids = vsechny().map(v => v.id);
  Object.assign(stav, S.hashNaStav(nacti(KLIC_STAV, ''), ids), S.hashNaStav(location.hash, ids));
  if (!najdi(stav.a)) stav.a = VYCHOZI.a;
  if (!najdi(stav.b)) stav.b = VYCHOZI.b;
  mapa.setView([stav.lat, stav.lon], stav.z, { animate: false });
  naplnVybery();
  pouzijNastaveni();
  ulozKresbu();
  nastavVrstvy();
});

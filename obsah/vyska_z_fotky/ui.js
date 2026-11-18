/* Výška osoby z fotky – rozhraní (plátno, nástroje, panel, galerie ukázek, protokol). Výpočty v jadro.js (window.VYSKA). */
(function () {
'use strict';
const V = window.VYSKA;
const $ = id => document.getElementById(id);
const PREFIX = 'webapp_vyska_z_fotky_';
// modelový případ 17/2026 (?pripad=17): vlastní záznam v IndexedDB, rozpracovaný případ uživatele zůstane nedotčený
const REZIM17 = !!(window.ModelovyPripad && window.ModelovyPripad.aktivni);
const KLIC_DB = REZIM17 ? 'pripad17' : 'pripad';
if (window.self === window.top) document.body.classList.add('samostatne');

const BARVY = { svisle: '#ff4d4d', vodA: '#3ddc84', vodB: '#4da3ff', horizont: '#ffd23f', reference: '#ff9f1a', osoba: '#e35bff' };
const NAZVY_SAD = { svisle: 'Svislé', vodA: 'Směr A', vodB: 'Směr B' };
const RADY = {
  posun: 'Táhněte obraz nebo body. Klik na bod = výběr, šipky ho posunou, Delete smaže. Kolečko = zoom.',
  svisle: 'Svislá úsečka: klikněte na <b>začátek</b> a pak na <b>konec</b> svislé hrany (roh zdi, zárubeň, sloup).',
  vodA: 'Směr A: dvě kliknutí na <b>vodorovnou čáru na zemi</b> (spára dlažby, obrubník). Všechny čáry A musí být ve skutečnosti rovnoběžné.',
  vodB: 'Směr B: vodorovné čáry na zemi v <b>jiném směru</b> než A (ideálně kolmém).',
  horizont: 'Horizont: dva body na úběžnici země. Použijte jen tehdy, když nejde zakreslit směry A a B.',
  reference: 'Reference: <b>1.</b> pata (bod na zemi) → <b>2.</b> vrchol svislého objektu se známou výškou.',
  osoba: 'Osoba: <b>1.</b> bod na zemi přesně pod temenem → <b>2.</b> temeno hlavy.'
};
/* Meze metody – jediný zdroj pro panel „📐 Metoda a meze“ (vysetrovani/metoda.js) i protokol. */
const MEZE = [
  'Je to odhad, ne identifikace. Výška pomůže osobu spíš vyloučit nebo zúžit okruh; shoda výšky nic neprokazuje.',
  'Předpoklady modelu: rovná vodorovná zem mezi referencí a osobou, svislá osoba i reference, dírková kamera. Schody, svah, obrubník nebo nakloněná zárubeň vnesou chybu, kterou interval nezachytí.',
  'Zkreslení objektivu je opraveno jen jednoduchým radiálním modelem (k1) se středem uprostřed snímku. Oříznutý nebo digitálně stabilizovaný záznam, rybí oko a rolling shutter model neumí.',
  'Interval Monte Carlo zahrnuje jen zadanou nejistotu kliknutí, tolerance referencí, nejistotu k1 a rozsahy korekcí. Nezahrnuje systematické chyby (špatně zvolená reference, nesvislá hrana, bod paty mimo zem), kompresní artefakty ani rozmazání pohybem.',
  'Postoj, chůze a obuv mění výšku temene o několik centimetrů; korekce jsou orientační rozsahy, které musí zpracovatel posoudit pro konkrétní záznam. Účes a pokrývka hlavy temeno zakrývají.',
  'Určení temene a bodu na zemi přesně pod ním je nejslabší článek: u kráčející osoby nebo při zakrytých nohou se bod paty odhaduje.',
  'Sloučení měření předpokládá, že jde o tutéž osobu se stejnou obuví; korekce se v každém měření vzorkují nezávisle.',
  'Rozlišení: pokud 1 px odpovídá víc než ~1 cm, je výsledek hrubý. Přesnost klesá u osob daleko od reference a blízko horizontu. Pohyb osoby nebo kamery a komprese záznamu rozmazávají hrany.',
  'Studie uvádějí za dobrých podmínek chyby jednotlivých měření řádově 1–3 cm, u běžných záznamů z kamer často 3–6 cm i víc. Pro soudní účely je potřeba znalecký posudek, ideálně s rekonstrukcí na místě (figurant známé výšky ve stejném místě a stejnou kamerou).'
];
const OMEZENI = '<ul>' + MEZE.map(t => `<li>${t}</li>`).join('') + '</ul>';
if (window.MetodaPanel) MetodaPanel.nastav({
  nastroj: 'vyska_z_fotky',
  princip: [
    'Jednosnímková metrologie (single view metrology): perspektivní snímek roviny země a svislého směru nese dost informace, aby se poměry výšek svislých úseků stojících na zemi daly změřit bez znalosti parametrů kamery.',
    'Rovnoběžné přímky se na snímku sbíhají do úběžníku. Z hran svislých objektů se určí úběžník svislic v, ze dvou svazků vodorovných čar na zemi dva úběžníky, jejichž spojnice je horizont l (úběžnice roviny země).',
    'Jediná neznámá je metrický faktor α. Určí se z referenčního objektu známé výšky stojícího na zemi; pak se z téhož vzorce spočítá výška osoby. Totéž lze ekvivalentně vyjádřit dvojpoměrem čtyř bodů na svislici (pata, temeno, přenesený vrchol reference, úběžník v).'
  ],
  vzorce: [
    'α·Z = ‖b × t‖ / ( |l·b| · ‖v × t‖ ), kde b = pata, t = vrchol (homogenní souřadnice, odzkreslené)',
    'α z referencí: α = Σ wᵢ·fᵢ/Hᵢ / Σ wᵢ, kde wᵢ = 1 / (rel. rozptyl tolerance + citlivost na 1 px)',
    'výška osoby = f(b, t) / α + Σ korekcí (obuv, postoj, chůze, pokrývka hlavy)',
    'odzkreslení: p = c + (p′ − c)·(1 + k1·r²), r normováno polovinou úhlopříčky',
    'úběžník = vlastní vektor nejmenšího vlastního čísla matice Σ w·l·lᵀ ze všech úseček sady',
    'nejistota: Monte Carlo (výchozí 2000 vzorků) – body ± N(0, σ), k1 ± N(0, σk1), výšky referencí v toleranci, korekce rovnoměrně v rozsahu; 95% interval = 2,5. a 97,5. percentil',
    'více měření jedné osoby: vážený průměr, váhy GLS z kovariance Monte Carlo (korelace měření ze stejného snímku)'
  ],
  predpoklady: [
    'Svislé hrany použité pro úběžník jsou opravdu svislé (zdi, zárubně, sloupy).',
    'Čáry směru A (i B) jsou ve skutečnosti rovnoběžné a leží ve vodorovné rovině země.',
    'Reference i osoba stojí na téže rovině – bez schodů, obrubníku či svahu mezi nimi.',
    'Osoba stojí vzpřímeně a temeno leží svisle nad zakresleným bodem na zemi.',
    'Kamera se chová jako dírková komora, kromě radiálního zkreslení k1 se středem uprostřed neoříznutého snímku.'
  ],
  meze: MEZE,
  literatura: [
    'A. Criminisi, I. Reid, A. Zisserman: Single View Metrology. International Journal of Computer Vision 40(2), 2000.',
    'A. Criminisi: Accurate Visual Metrology from Single and Multiple Uncalibrated Images. Springer, 2001.',
    'R. Hartley, A. Zisserman: Multiple View Geometry in Computer Vision. 2. vydání, Cambridge University Press, 2004.'
  ]
});

/* ---------- stav ---------- */
let pripad = V.prazdnyPripad();
let aktivni = 0;
const obrazky = new Map(); // id snímku → {img, url}
const blobs = new Map();   // id snímku → obrázek (pro Zpět i po výměně případu)
const sede = new Map();    // id snímku → jas pro přichytávání
const pohled = { s: 1, ox: 0, oy: 0 };
let nastroj = 'svisle';
let rozprac = null;  // {typ, body: [p1]}
let tazeni = null;   // {bod, dokonci} | {pan, x, y, ox, oy}
let vybrano = null;  // {typ, idx}
let vybranyBod = null; // pole [x, y] vybraného bodu (šipky)
let prichyt = null;  // {p, druh: 'bod'|'roh'}
let vysledek = null, vysledekPlny = null, citl = null;
let lupaZap = nactiPref('lupa', true), pomocneZap = nactiPref('pomocne', true), prichytZap = nactiPref('prichyt', true);
const ukaz = { x: 0, y: 0, vidi: false };

function nactiPref(k, d) { try { const v = localStorage.getItem(PREFIX + k); return v == null ? d : v === '1'; } catch (e) { return d; } }
function ulozPref(k, v) { try { localStorage.setItem(PREFIX + k, v ? '1' : '0'); } catch (e) { /* nic */ } }
const sn = () => pripad.snimky[aktivni] || null;
const fmt = (x, d = 1) => x == null || !isFinite(x) ? '–' : x.toFixed(d).replace('.', ',').replace('-', '−');
const fmtZ = (x, d = 1) => (x > 0 ? '+' : '') + fmt(x, d);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cislo = (x, d) => { const n = parseFloat(String(x).replace(',', '.')); return isFinite(n) ? n : d; };
const css = n => getComputedStyle(document.body).getPropertyValue(n).trim();
const metaUkazky = () => pripad.ukazka && V.UKAZKY.find(u => u.id === pripad.ukazka.id);
const registruj = s => { if (s && s.obrazek) blobs.set(s.id, s.obrazek); };

/* ---------- úložiště (IndexedDB, obrázky jako Blob) + historie Zpět/Znovu ---------- */
let dbP = null;
function db() {
  if (!dbP) dbP = new Promise((ok, chyba) => {
    const r = indexedDB.open('webapp_vyska_z_fotky', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('data');
    r.onsuccess = () => ok(r.result); r.onerror = () => chyba(r.error);
  });
  return dbP;
}
const historie = { zpet: [], vpred: [], posledni: null };
const serializuj = () => JSON.stringify(pripad, (k, v) => k === 'obrazek' ? undefined : v);
function zapisHistorii() {
  const t = serializuj();
  if (t === historie.posledni) return;
  if (historie.posledni != null) { historie.zpet.push(historie.posledni); if (historie.zpet.length > 100) historie.zpet.shift(); }
  historie.vpred = []; historie.posledni = t; tlacitkaHistorie();
}
function tlacitkaHistorie() { $('tlZpet').disabled = !historie.zpet.length; $('tlVpred').disabled = !historie.vpred.length; }
function obnov(t) {
  pripad.snimky.forEach(registruj);
  const d = V.migruj(JSON.parse(t));
  d.snimky.forEach(s => { const b = blobs.get(s.id); if (b) s.obrazek = b; });
  pripad = d; historie.posledni = serializuj();
  aktivni = Math.min(aktivni, Math.max(0, pripad.snimky.length - 1)); vybrano = null; vybranyBod = null; rozprac = null;
  prepocet(false); vykresliPanel(); aktualizujStav(); kresli(); uloz(); tlacitkaHistorie();
}
function zpet() { if (!historie.zpet.length) return; zapisHistorii(); if (!historie.zpet.length) return; historie.vpred.push(historie.posledni); obnov(historie.zpet.pop()); }
function vpred() { if (!historie.vpred.length) return; historie.zpet.push(historie.posledni); obnov(historie.vpred.pop()); }

let casUlozeni = 0;
function uloz() {
  clearTimeout(casUlozeni);
  casUlozeni = setTimeout(async () => {
    zapisHistorii();
    try { const d = await db(); d.transaction('data', 'readwrite').objectStore('data').put(pripad, KLIC_DB); }
    catch (e) { Dialog.chyba('Uložení se nepovedlo: ' + e.message); }
  }, 400);
}
async function nacti() {
  try {
    const d = await db();
    const v = await new Promise((ok, ch) => { const r = d.transaction('data').objectStore('data').get(KLIC_DB); r.onsuccess = () => ok(r.result); r.onerror = () => ch(r.error); });
    if (v) { pripad = V.migruj(v); pripad.snimky.forEach(registruj); }
  } catch (e) { Dialog.chyba('Nepodařilo se načíst uložená data (IndexedDB).'); }
  historie.posledni = serializuj();
}

function obrazekSnimku(s) {
  if (!s || !s.obrazek) return null;
  let o = obrazky.get(s.id);
  if (!o) {
    const img = new Image();
    const url = s.obrazek instanceof Blob ? URL.createObjectURL(s.obrazek) : String(s.obrazek);
    img.onload = () => kresli();
    img.src = url;
    o = { img, url }; obrazky.set(s.id, o);
  }
  return o.img.complete && o.img.naturalWidth ? o.img : null;
}
function zahodObrazky() { obrazky.forEach(o => { if (o.url.startsWith('blob:')) URL.revokeObjectURL(o.url); }); obrazky.clear(); sede.clear(); }

/* ---------- plátno ---------- */
const platno = $('platno'), ctx = platno.getContext('2d'), lupa = $('lupa'), lctx = lupa.getContext('2d');
function velikost() {
  const r = $('platnoObal').getBoundingClientRect(), dpr = devicePixelRatio || 1;
  platno.width = Math.max(1, Math.round(r.width * dpr)); platno.height = Math.max(1, Math.round(r.height * dpr));
  kresli();
}
function prizpusob() {
  const s = sn(); if (!s) return;
  const r = $('platnoObal').getBoundingClientRect();
  pohled.s = Math.min(r.width / s.sirka, r.height / s.vyska) * 0.97;
  pohled.ox = (r.width - s.sirka * pohled.s) / 2; pohled.oy = (r.height - s.vyska * pohled.s) / 2;
  kresli();
}
const naObraz = (x, y) => [(x - pohled.ox) / pohled.s, (y - pohled.oy) / pohled.s];
const vysledekSnimku = s => vysledek && vysledek.snimky.find(q => q.sn === s);

/* Vykreslení snímku s překryvy do libovolného kontextu (plátno, lupa, protokol). T = {s, ox, oy} */
function kresliScenu(c, T, s, volby) {
  volby = volby || {};
  const img = obrazekSnimku(s);
  c.save(); c.translate(T.ox, T.oy); c.scale(T.s, T.s);
  c.imageSmoothingEnabled = T.s < 3;
  if (img) c.drawImage(img, 0, 0, s.sirka, s.vyska);
  else { c.fillStyle = '#555'; c.fillRect(0, 0, s.sirka, s.vyska); }
  c.restore();
  const P = p => [T.ox + p[0] * T.s, T.oy + p[1] * T.s];
  const r0 = vysledekSnimku(s);
  const k = r0 ? r0.z.kal : V.kalibrace(s);
  const sirka = volby.tloustka || 1;
  const cara = (body, barva, w, dash) => {
    if (body.length < 2) return;
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
    c.setLineDash((dash || []).map(x => x * sirka));
    for (const [st, ww] of [['rgba(0,0,0,.65)', w + 2.2], [barva, w]]) {
      c.strokeStyle = st; c.lineWidth = ww * sirka; c.beginPath();
      body.forEach((p, i) => { const q = P(p); i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); }); c.stroke();
    }
    c.restore();
  };
  const bodZ = (p, barva, vyb) => {
    const q = P(p), r = (vyb ? 6 : 4.5) * sirka;
    c.save(); c.lineWidth = 1.2 * sirka;
    c.strokeStyle = 'rgba(0,0,0,.8)'; c.beginPath(); c.arc(q[0], q[1], r + 1, 0, 7); c.stroke();
    c.strokeStyle = barva; c.beginPath(); c.arc(q[0], q[1], r, 0, 7); c.stroke();
    c.beginPath(); c.moveTo(q[0] - r - 3, q[1]); c.lineTo(q[0] - 1.5, q[1]); c.moveTo(q[0] + 1.5, q[1]); c.lineTo(q[0] + r + 3, q[1]);
    c.moveTo(q[0], q[1] - r - 3); c.lineTo(q[0], q[1] - 1.5); c.moveTo(q[0], q[1] + 1.5); c.lineTo(q[0], q[1] + r + 3); c.stroke();
    c.restore();
  };
  const popisek = (p, text, barva) => {
    const q = P(p); c.save();
    c.font = `600 ${12 * sirka}px system-ui,sans-serif`;
    const w = c.measureText(text).width + 8 * sirka, h = 17 * sirka;
    c.fillStyle = 'rgba(0,0,0,.72)'; c.fillRect(q[0] + 8 * sirka, q[1] - h - 2, w, h);
    c.fillStyle = barva; c.fillText(text, q[0] + 12 * sirka, q[1] - 6 * sirka); c.restore();
  };
  // přímka v odzkresleném prostoru → lomená čára ve skutečném snímku
  const zk = p => V.zkresli(p, s.k1, s.sirka, s.vyska), od = p => V.odzkresli(p, s.k1, s.sirka, s.vyska);
  const usek = (a, b, n = 32) => { const r = []; for (let i = 0; i <= n; i++) r.push(zk([a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n])); return r; };
  const diag = Math.hypot(s.sirka, s.vyska);
  const smerK = (p, v) => { // jednotkový směr od bodu p (odzkresleného) k homogennímu úběžníku v
    const d = [v[0] - p[0] * v[2], v[1] - p[1] * v[2]], n = Math.hypot(d[0], d[1]) || 1;
    return [d[0] / n, d[1] / n];
  };

  if (pomocneZap && !volby.bezPomocnych) {
    c.save(); c.beginPath(); c.rect(T.ox, T.oy, s.sirka * T.s, s.vyska * T.s); c.clip();
    for (const typ of ['svisle', 'vodA', 'vodB']) {
      const u = typ === 'svisle' ? k.vs : typ === 'vodA' ? k.vA : k.vB;
      if (!u) continue;
      const vk = u.v[2] ? V.kart(u.v) : null;
      for (const sg of s[typ]) {
        const a = od(sg[0]), b = od(sg[1]);
        const dal = vk && Math.hypot(vk[0] - a[0], vk[1] - a[1]) < Math.hypot(vk[0] - b[0], vk[1] - b[1]) ? b : a;
        if (vk && Math.hypot(vk[0] - a[0], vk[1] - a[1]) < 4 * diag) cara(usek(dal, vk), BARVY[typ], 0.8, [5, 5]);
        else { const d = smerK(a, u.v); cara(usek([a[0] - d[0] * diag, a[1] - d[1] * diag], [a[0] + d[0] * diag, a[1] + d[1] * diag]), BARVY[typ], 0.8, [5, 5]); }
      }
    }
    if (k.l && Math.abs(k.l[1]) > 1e-9) {
      const y = x => -(k.l[0] * x + k.l[2]) / k.l[1];
      const a = [-0.3 * s.sirka, y(-0.3 * s.sirka)], b = [1.3 * s.sirka, y(1.3 * s.sirka)];
      cara(usek(a, b, 60), BARVY.horizont, 1.4, [10, 6]);
      const lb = zk([0.02 * s.sirka, y(0.02 * s.sirka)]);
      if (lb[1] > 0 && lb[1] < s.vyska) popisek(lb, 'horizont', BARVY.horizont);
    }
    c.restore();
  }
  const jeVyb = (typ, i) => vybrano && vybrano.typ === typ && vybrano.idx === i;
  for (const typ of ['svisle', 'vodA', 'vodB']) s[typ].forEach((sg, i) => {
    cara(sg, BARVY[typ], jeVyb(typ, i) ? 3.2 : 2); sg.forEach(p => bodZ(p, BARVY[typ], jeVyb(typ, i)));
  });
  if (s.horizont) { cara(s.horizont, BARVY.horizont, 2.4); s.horizont.forEach(p => bodZ(p, BARVY.horizont, jeVyb('horizont', 0))); }
  const svislice = (x, barva) => {
    if (!x.b || !k.v) return;
    const b = od(x.b), d = smerK(b, k.v), t = x.t ? od(x.t) : null;
    let L = t ? Math.hypot(t[0] - b[0], t[1] - b[1]) * 1.15 : diag * 0.15;
    if (k.v[2]) { const vk = V.kart(k.v), dv = Math.hypot(vk[0] - b[0], vk[1] - b[1]); if (dv < L) L = dv; }
    const sm = t && (d[0] * (t[0] - b[0]) + d[1] * (t[1] - b[1])) < 0 ? -1 : 1;
    cara(usek(b, [b[0] + sm * d[0] * L, b[1] + sm * d[1] * L]), barva, 1, [3, 4]);
  };
  const vyskaMereni = x => {
    if (!r0 || r0.z.chyby.length) return null;
    const m = r0.mereni.find(q => q.m.id === x.id); return m ? fmt(m.geom) + ' cm' : null;
  };
  s.reference.forEach((r, i) => {
    const barva = r.pouzit === false ? '#9a9a9a' : BARVY.reference;
    svislice(r, barva);
    if (r.b && r.t) cara([r.b, r.t], barva, jeVyb('reference', i) ? 3.5 : 2.4, r.pouzit === false ? [6, 4] : null);
    [r.b, r.t].forEach(p => p && bodZ(p, barva, jeVyb('reference', i)));
    if (r.t) popisek(r.t, `${r.nazev}: ${fmt(r.vyska)} cm`, barva);
  });
  s.mereni.forEach((m, i) => {
    const barva = m.pouzit === false ? '#9a9a9a' : BARVY.osoba;
    svislice(m, barva);
    if (m.b && m.t) cara([m.b, m.t], barva, jeVyb('mereni', i) ? 3.5 : 2.4);
    [m.b, m.t].forEach(p => p && bodZ(p, barva, jeVyb('mereni', i)));
    const h = vyskaMereni(m);
    if (m.t) popisek(m.t, m.nazev + (h ? ': ' + h : ''), barva);
  });
  if (rozprac && !volby.bezRozprac) {
    const barva = BARVY[rozprac.typ];
    rozprac.body.forEach(p => bodZ(p, barva, true));
    if (rozprac.typ === 'reference' || rozprac.typ === 'osoba') svislice({ b: rozprac.body[0] }, barva);
  }
  if (prichyt && !volby.bezRozprac) { // cíl přichycení
    const q = P(prichyt.p), r = 9 * sirka;
    c.save(); c.lineWidth = 2 * sirka; c.strokeStyle = 'rgba(0,0,0,.8)';
    c.strokeRect(q[0] - r - 1, q[1] - r - 1, 2 * r + 2, 2 * r + 2);
    c.strokeStyle = prichyt.druh === 'bod' ? '#00e5ff' : '#7dff4d'; c.strokeRect(q[0] - r, q[1] - r, 2 * r, 2 * r); c.restore();
  }
}

function kresli() {
  const dpr = devicePixelRatio || 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = css('--bg-deep') || '#111';
  ctx.fillRect(0, 0, platno.width, platno.height);
  const s = sn();
  $('prazdna').hidden = !!s;
  if (!s) { lupa.hidden = true; return; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  kresliScenu(ctx, pohled, s);
  kresliLupu();
}

function kresliLupu() {
  const s = sn();
  const zobraz = lupaZap && s && ukaz.vidi && (tazeni && tazeni.bod || nastroj !== 'posun');
  lupa.hidden = !zobraz;
  if (!zobraz) return;
  const W = lupa.width, ip = naObraz(ukaz.x, ukaz.y);
  const Z = Math.max(pohled.s * 4, 3);
  lctx.setTransform(1, 0, 0, 1, 0, 0); lctx.fillStyle = '#000'; lctx.fillRect(0, 0, W, W);
  kresliScenu(lctx, { s: Z, ox: W / 2 - ip[0] * Z, oy: W / 2 - ip[1] * Z }, s, { tloustka: 0.8 });
  lctx.strokeStyle = 'rgba(255,255,255,.9)'; lctx.lineWidth = 1;
  lctx.beginPath(); lctx.moveTo(W / 2, 0); lctx.lineTo(W / 2, W / 2 - 6); lctx.moveTo(W / 2, W / 2 + 6); lctx.lineTo(W / 2, W);
  lctx.moveTo(0, W / 2); lctx.lineTo(W / 2 - 6, W / 2); lctx.moveTo(W / 2 + 6, W / 2); lctx.lineTo(W, W / 2); lctx.stroke();
  const r = $('platnoObal').getBoundingClientRect();
  lupa.classList.toggle('vpravo', ukaz.x < r.width / 2 && ukaz.y < 200);
}

/* ---------- body, výběr a přichytávání ---------- */
function vsechnyBody(s) {
  const r = [];
  for (const typ of ['svisle', 'vodA', 'vodB']) s[typ].forEach((sg, i) => sg.forEach(p => r.push({ p, typ, idx: i })));
  if (s.horizont) s.horizont.forEach(p => r.push({ p, typ: 'horizont', idx: 0 }));
  s.reference.forEach((x, i) => [x.b, x.t].forEach(p => p && r.push({ p, typ: 'reference', idx: i })));
  s.mereni.forEach((x, i) => [x.b, x.t].forEach(p => p && r.push({ p, typ: 'mereni', idx: i })));
  return r;
}
function najdiBod(x, y, tol, vyjma) {
  const s = sn(); if (!s) return null;
  let nej = null, nd = tol;
  for (const b of vsechnyBody(s)) {
    if (b.p === vyjma) continue;
    const d = Math.hypot(b.p[0] * pohled.s + pohled.ox - x, b.p[1] * pohled.s + pohled.oy - y);
    if (d < nd) { nd = d; nej = b; }
  }
  return nej;
}
function sedaSnimku(s) {
  let g = sede.get(s.id); if (g) return g;
  const img = obrazekSnimku(s); if (!img) return null;
  const c = document.createElement('canvas'); c.width = s.sirka; c.height = s.vyska;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, s.sirka, s.vyska);
  const d = x.getImageData(0, 0, s.sirka, s.vyska).data, a = new Uint8Array(s.sirka * s.vyska);
  for (let i = 0; i < a.length; i++) a[i] = d[4 * i] * 0.299 + d[4 * i + 1] * 0.587 + d[4 * i + 2] * 0.114;
  g = { a }; sede.set(s.id, g); return g;
}
// cíl přichycení pro bod p (souřadnice snímku) v místě obrazovky sx, sy; typ = co se kreslí
function najdiPrichyt(p, sx, sy, typ, vyjma, shift) {
  const s = sn();
  if (!prichytZap || shift || !s) return null;
  const b = najdiBod(sx, sy, 10, vyjma);
  if (b) return { p: [b.p[0], b.p[1]], druh: 'bod' };
  if (typ === 'osoba' || typ === 'mereni') return null; // temeno ani patu osoby k rohům nepřitahovat
  const g = sedaSnimku(s); if (!g) return null;
  const r = Math.max(2, Math.min(12, Math.round(9 / pohled.s)));
  const k = V.rohVOkoli(g.a, s.sirka, s.vyska, p[0], p[1], r, 60);
  return k ? { p: [k.x, k.y], druh: 'roh' } : null;
}
function smazVybrane() {
  const s = sn(); if (!s || !vybrano) return;
  if (vybrano.typ === 'horizont') s.horizont = null;
  else s[vybrano.typ].splice(vybrano.idx, 1);
  vybrano = null; vybranyBod = null; zmena(true);
}

/* ---------- ovládání myší a dotykem ---------- */
const ukazatele = new Map();
let stipnuti = null;
platno.addEventListener('pointerdown', e => {
  const s = sn(); if (!s) return;
  const r = platno.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  ukazatele.set(e.pointerId, [x, y]);
  platno.setPointerCapture(e.pointerId);
  if (ukazatele.size === 2) { // štípnutí – zruší rozpracovaný bod tohoto tahu
    if (tazeni && tazeni.novy) { rozprac.body.pop(); if (!rozprac.body.length) rozprac = null; }
    tazeni = null; prichyt = null;
    const [a, b] = [...ukazatele.values()];
    stipnuti = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), s: pohled.s, ox: pohled.ox, oy: pohled.oy, c: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] };
    kresli(); return;
  }
  if (e.button !== 0 && e.pointerType === 'mouse') { tazeni = { pan: true, x, y, ox: pohled.ox, oy: pohled.oy }; return; }
  ukaz.x = x; ukaz.y = y; ukaz.vidi = true;
  const p = naObraz(x, y);
  if (nastroj === 'posun') {
    const h = najdiBod(x, y, e.pointerType === 'touch' ? 22 : 12);
    if (h) { tazeni = { bod: h.p, typ: h.typ, dx: h.p[0] - p[0], dy: h.p[1] - p[1] }; vybrano = { typ: h.typ, idx: h.idx }; vybranyBod = h.p; vykresliPanel(); }
    else { tazeni = { pan: true, x, y, ox: pohled.ox, oy: pohled.oy }; if (vybrano) { vybrano = null; vybranyBod = null; vykresliPanel(); } }
  } else {
    if (!rozprac || rozprac.typ !== nastroj) rozprac = { typ: nastroj, body: [] };
    rozprac.body.push(p);
    tazeni = { bod: p, typ: nastroj, dx: 0, dy: 0, novy: true, dokonci: rozprac.body.length === 2 };
    prichyt = najdiPrichyt(p, x, y, nastroj, p, e.shiftKey);
  }
  aktualizujStav(); kresli();
});
platno.addEventListener('pointermove', e => {
  const r = platno.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  if (ukazatele.has(e.pointerId)) ukazatele.set(e.pointerId, [x, y]);
  if (stipnuti && ukazatele.size === 2) {
    const [a, b] = [...ukazatele.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
    const c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], ns = Math.min(40, Math.max(0.05, stipnuti.s * d / stipnuti.d));
    pohled.s = ns;
    pohled.ox = c[0] - (stipnuti.c[0] - stipnuti.ox) * ns / stipnuti.s;
    pohled.oy = c[1] - (stipnuti.c[1] - stipnuti.oy) * ns / stipnuti.s;
    kresli(); return;
  }
  ukaz.x = x; ukaz.y = y; ukaz.vidi = e.pointerType !== 'touch' || !!tazeni;
  if (tazeni && tazeni.pan) { pohled.ox = tazeni.ox + x - tazeni.x; pohled.oy = tazeni.oy + y - tazeni.y; prichyt = null; }
  else if (tazeni && tazeni.bod) {
    const p = naObraz(x, y); tazeni.bod[0] = p[0] + tazeni.dx; tazeni.bod[1] = p[1] + tazeni.dy;
    prichyt = najdiPrichyt(tazeni.bod, tazeni.bod[0] * pohled.s + pohled.ox, tazeni.bod[1] * pohled.s + pohled.oy, tazeni.typ, tazeni.bod, e.shiftKey);
    if (!tazeni.novy) prepocet(true);
  } else if (sn() && nastroj !== 'posun' && e.pointerType !== 'touch') prichyt = najdiPrichyt(naObraz(x, y), x, y, nastroj, null, e.shiftKey);
  else prichyt = null;
  kresli();
});
async function konecTahu(e) {
  ukazatele.delete(e.pointerId);
  if (ukazatele.size < 2) stipnuti = null;
  const t = tazeni; tazeni = null;
  if (e.pointerType === 'touch') ukaz.vidi = false;
  if (t && t.bod && prichyt) { t.bod[0] = prichyt.p[0]; t.bod[1] = prichyt.p[1]; }
  prichyt = null;
  if (t && t.bod && t.dokonci) await dokonci();
  else if (t && t.bod && !t.novy) zmena(false);
  kresli();
}
platno.addEventListener('pointerup', konecTahu);
platno.addEventListener('pointercancel', konecTahu);
platno.addEventListener('pointerleave', () => { if (!tazeni) { ukaz.vidi = false; prichyt = null; kresli(); } });
platno.addEventListener('contextmenu', e => e.preventDefault());
platno.addEventListener('wheel', e => {
  e.preventDefault();
  const r = platno.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  zoom(Math.exp(-e.deltaY * 0.0015), x, y);
}, { passive: false });
function zoom(f, x, y) {
  const r = $('platnoObal').getBoundingClientRect();
  if (x == null) { x = r.width / 2; y = r.height / 2; }
  const ns = Math.min(40, Math.max(0.05, pohled.s * f));
  pohled.ox = x - (x - pohled.ox) * ns / pohled.s; pohled.oy = y - (y - pohled.oy) * ns / pohled.s; pohled.s = ns;
  kresli();
}

async function dokonci() {
  const s = sn(), r = rozprac; rozprac = null;
  if (!s || !r || r.body.length < 2) return;
  const [a, b] = r.body;
  if (r.typ in NAZVY_SAD) s[r.typ].push([a, b]);
  else if (r.typ === 'horizont') s.horizont = [a, b];
  else if (r.typ === 'reference') {
    const t = await Dialog.zeptej('Známá výška reference v cm (od paty k vrcholu):', '205');
    if (t == null) { aktualizujStav(); kresli(); return; }
    const h = cislo(t, 0);
    if (!(h > 0)) { Dialog.chyba('Výška musí být kladné číslo v cm.'); aktualizujStav(); kresli(); return; }
    s.reference.push({ id: V.noveId(), nazev: 'Reference ' + (s.reference.length + 1), vyska: h, tol: 0.5, b: a, t: b, pouzit: true });
  } else if (r.typ === 'osoba') {
    const posl = pripad.snimky.flatMap(x => x.mereni).pop();
    const os = posl ? posl.osoba : 'A';
    s.mereni.push({ id: V.noveId(), nazev: 'Osoba ' + os + ' – měření ' + (s.mereni.length + 1), osoba: os, b: a, t: b, korekce: [], pouzit: true });
  }
  zmena(true);
}

/* ---------- výpočet ---------- */
let casMC = 0, casCitl = 0, kolo = 0;
function prepocet(rychle) {
  const vahy = {};
  if (vysledekPlny) vysledekPlny.mereni.forEach(m => { if (m.vahaRaw != null) vahy[m.m.id] = m.vahaRaw; });
  vysledek = V.vyhodnot(pripad, { n: 0, vahy });
  clearTimeout(casMC); clearTimeout(casCitl);
  if (rychle) return;
  const moje = ++kolo;
  casMC = setTimeout(() => {
    vysledekPlny = V.vyhodnot(pripad);
    vysledek = vysledekPlny;
    vykresliVysledek(); vykresliPodezrele(); vykresliPruvodce(); kresli();
    citl = null; vykresliCitlivost();
    casCitl = setTimeout(() => {
      if (moje !== kolo) return;
      citl = vysledekPlny.osoby.length ? V.citlivost(pripad, { n: 400, plny: vysledekPlny }) : [];
      vykresliCitlivost();
    }, 30);
  }, 250);
}
function zmena(struktura) {
  prepocet(false);
  if (struktura) vykresliPanel(); else { vykresliVysledek(); vykresliPruvodce(); }
  aktualizujStav(); kresli(); uloz();
}

/* ---------- panel ---------- */
function vykresliPanel() {
  vykresliPruvodce(); vykresliUkazkuInfo(); vykresliVysledek(); vykresliCitlivost(); vykresliPodezrele();
  vykresliMereni(); vykresliReference(); vykresliKalibraci();
  for (const el of document.querySelectorAll('[data-pripad]')) if (document.activeElement !== el) el.value = pripad[el.dataset.pripad] ?? '';
  const sel = $('volbaSnimku');
  sel.innerHTML = pripad.snimky.length ? pripad.snimky.map((s, i) => `<option value="${i}"${i === aktivni ? ' selected' : ''}>${esc(s.nazev)}</option>`).join('') : '<option>— žádný snímek —</option>';
}

/* Průvodce postupem: stav kroků z rozpracovaného případu, tlačítko vybere nástroj. */
function vykresliPruvodce() {
  const s = sn(), el = $('pruvodce');
  const kal = s ? (vysledekSnimku(s) || {}).z : null, k = kal ? kal.kal : s ? V.kalibrace(s) : null;
  const refs = s ? s.reference.filter(r => r.b && r.t) : [], mer = s ? s.mereni.filter(m => m.b && m.t) : [];
  const varov = varovani().filter(w => !w.chyba).length;
  const kroky = [
    { nazev: 'Snímek', ok: !!s, info: s ? `${s.nazev} · ${s.sirka} × ${s.vyska} px` : 'otevřete fotku nebo ukázku', prikaz: s ? null : 'galerie', tl: '🧪' },
    { nazev: 'Svislé hrany', ok: s && s.svisle.length >= 2, info: s ? `${s.svisle.length} úseček (min. 2, lépe 3 a víc daleko od sebe)` : '', nastroj: 'svisle', klavesa: '1' },
    { nazev: 'Horizont (směry A a B)', ok: !!(k && k.l), info: k && k.l ? `${k.zdrojH} · A ${s.vodA.length}, B ${s.vodB.length}` : s ? `A ${s.vodA.length}, B ${s.vodB.length} úseček (každý směr min. 2)` : '', nastroj: s && s.vodA.length < 2 ? 'vodA' : 'vodB', klavesa: s && s.vodA.length < 2 ? '2' : '3' },
    { nazev: 'Zkreslení objektivu (volitelné)', ok: s && (s.k1 !== 0 || [s.svisle, s.vodA, s.vodB].every(x => x.length < 3)), volitelne: true, info: s ? `k1 = ${fmt(s.k1, 3)}${s.k1Sigma ? ' ± ' + fmt(s.k1Sigma, 3) : ''}` : '', prikaz: 'odhadK1', tl: '🎯' },
    { nazev: 'Reference známé výšky', ok: refs.length >= 1, info: `${refs.length} zakreslených (lépe 2 a víc – navzájem se kontrolují)`, nastroj: 'reference', klavesa: 'R' },
    { nazev: 'Osoba – pata a temeno', ok: mer.length >= 1, info: `${mer.length} měření`, nastroj: 'osoba', klavesa: 'O' },
    { nazev: 'Korekce obuvi a postoje', ok: mer.length > 0 && mer.every(m => m.korekce.length), volitelne: true, info: mer.length ? `${mer.filter(m => m.korekce.length).length} z ${mer.length} měření má korekce` : 'až po změření osoby', otevri: 'mereni' },
    { nazev: 'Kontrola a protokol', ok: !!(vysledek && vysledek.osoby.length) && !varov, info: vysledek && vysledek.osoby.length ? (varov ? `${varov} upozornění ve výsledku` : 'bez upozornění') : 'čeká na výsledek', prikaz: 'protokol', tl: '📄' }
  ];
  const ted = kroky.findIndex(x => !x.ok && !x.volitelne);
  el.innerHTML = `<ol class="kroky">${kroky.map((x, i) => `<li class="${i === ted ? 'ted' : ''}">
    <span class="st" aria-hidden="true">${x.ok ? '✅' : x.volitelne ? '◻️' : i === ted ? '👉' : '⬜'}</span>
    <span><span class="k-nazev">${i + 1}. ${esc(x.nazev)}</span><br><span class="k-info">${esc(x.info || '')}</span></span>
    ${x.nastroj ? `<button class="btn mini" data-krok-nastroj="${x.nastroj}" title="Vybrat nástroj (${x.klavesa})">${x.klavesa}</button>` : x.prikaz ? `<button class="btn mini" data-prikaz="${x.prikaz}" title="Spustit">${x.tl}</button>` : x.otevri ? '<button class="btn mini" data-krok-otevri="mereni" title="Otevřít Měření osoby">🧍</button>' : '<span></span>'}
  </li>`).join('')}</ol>`;
}

function vykresliUkazkuInfo() {
  const u = metaUkazky(), d = $('dUkazka');
  d.hidden = !u;
  if (!u) return;
  $('ukazkaInfo').innerHTML = `<div><b>${u.ikona} ${esc(u.nazev)}</b></div><p class="muted" style="margin:0">${esc(u.popis)}</p>
    <ul>${u.ukoly.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
    <div class="radek-tl"><button class="btn mini" data-ukazka="${u.id}">↺ Načíst znovu</button><button class="btn mini" data-prikaz="galerie">🧪 Další ukázky</button></div>`;
}

function varovani() {
  const v = [];
  if (!vysledek) return v;
  for (const r of vysledek.snimky) {
    const s = r.sn, k = r.z.kal, jm = pripad.snimky.length > 1 ? `[${s.nazev}] ` : '';
    for (const e of r.z.chyby) v.push({ chyba: true, t: jm + e });
    if (!k) continue;
    for (const [typ, u] of [['svisle', k.vs], ['vodA', !s.horizont && k.vA], ['vodB', !s.horizont && k.vB]]) {
      if (!u) continue;
      if (u.n < 3) v.push({ t: `${jm}${NAZVY_SAD[typ]}: jen ${u.n} úsečky – úběžník nelze zkontrolovat, doporučeny aspoň 3.` });
      u.odchylky.forEach((o, i) => { if (o > 1.5) v.push({ t: `${jm}${NAZVY_SAD[typ]} č. ${i + 1} míří ${fmt(o)}° mimo společný úběžník – zkontrolujte ji, nebo zkreslení k1.` }); });
    }
    if (!r.z.chyby.length && s.reference.filter(x => x.pouzit !== false).length === 1) v.push({ t: `${jm}Jen jedna použitá reference – přidejte druhou, výsledky se navzájem zkontrolují.` });
    (r.z.kontrola || []).forEach(q => { if (q.pouzit && Math.abs(q.chyba) > Math.max(2, 3 * q.sigma)) v.push({ t: `${jm}${q.r.nazev}: z ostatních referencí vychází ${fmt(q.zmereno)} cm místo ${fmt(q.r.vyska)} cm (z = ${fmt(q.z)}). Některá reference nebo kalibrace je chybná – zvažte její vyřazení.` }); });
    r.mereni.forEach(m => { if (m.cmPx > 1.2) v.push({ t: `${jm}${m.m.nazev}: 1 px ≈ ${fmt(m.cmPx)} cm – nízké rozlišení, výsledek je hrubý.` }); });
    s.mereni.forEach(m => { if (!m.korekce.length && m.b && m.t) v.push({ t: `${jm}${m.nazev}: bez korekcí (obuv, postoj). Výsledek je výška temene nad zemí, ne tělesná výška.` }); });
  }
  return v;
}

const stitekOsoby = id => `<span class="osoba-stitek">${esc(id)}</span>`;
function vykresliVysledek() {
  const el = $('vysledek');
  if (!pripad.snimky.length) { el.innerHTML = '<p class="muted">Otevřete fotku nebo ukázkovou scénu.</p>'; return; }
  const v = vysledek;
  let h = '';
  if (v && v.osoby.length) {
    const vic = v.osoby.length > 1;
    for (const o of v.osoby) {
      const st = o.stat;
      h += `<div class="osoba-blok">${vic || o.id !== 'A' ? `<div>${stitekOsoby(o.id)}<span class="muted">osoba ${esc(o.id)}</span></div>` : ''}
        <div class="vysledek-hlavni">${fmt(o.vysledek)} cm ${st ? `<small>± ${fmt(st.sd)} cm (1σ)</small>` : '<small>počítám nejistotu…</small>'}</div>`;
      if (st) h += `<div class="muted">95% interval: <b>${fmt(st.p025)} – ${fmt(st.p975)} cm</b> · ${o.mereni.length > 1 ? `vážený průměr ${o.mereni.length} měření · ` : ''}${v.N} vzorků Monte Carlo</div>`;
      if (o.pravda != null) h += `<div class="pravda">Pravda ukázkové scény: ${fmt(o.pravda)} cm → odchylka ${fmtZ(o.vysledek - o.pravda, 2)} cm${st ? (st.p025 <= o.pravda && o.pravda <= st.p975 ? ' · v intervalu ✔' : ' · mimo interval ✖') : ''}</div>`;
      if (st) h += `<canvas class="histogram" data-osoba="${esc(o.id)}" aria-label="Rozdělení výsledku Monte Carlo"></canvas>`;
      h += '</div>';
    }
    h += `<div class="tab-obal"><table><thead><tr><th>Měření</th><th class="c">Geom.</th><th class="c">Kor.</th><th class="c">Výška</th><th class="c">±σ</th><th class="c">Váha</th><th class="c">cm/px</th></tr></thead><tbody>`;
    for (const m of v.mereni) h += `<tr class="${m.pouzit ? '' : 'vyrazeno'}"><td>${vic ? stitekOsoby(m.osoba) : ''}${esc(m.m.nazev)}</td><td class="c">${fmt(m.geom)}</td><td class="c">${fmt(m.korekce)}</td><td class="c"><b>${fmt(m.vyska)}</b></td><td class="c">${m.stat ? fmt(m.stat.sd) : '…'}</td><td class="c">${m.pouzit && m.vaha != null ? Math.round(m.vaha * 100) + ' %' : '—'}</td><td class="c">${fmt(m.cmPx, 2)}</td></tr>`;
    h += '</tbody></table></div>';
  } else h += '<p class="muted">Zatím žádné hotové měření. Postup: svislé čáry → směry A, B → reference → osoba (viz 🧭 Průvodce).</p>';
  for (const w of varovani()) h += `<div class="${w.chyba ? 'chyba-txt' : 'varovani'}">${esc(w.t)}</div>`;
  el.innerHTML = h;
  el.querySelectorAll('canvas.histogram').forEach(c => { const o = v.osoby.find(q => q.id === c.dataset.osoba); if (o) kresliHistogram(c, o); });
}

function kresliHistogram(c, o, barvy) {
  const dpr = devicePixelRatio || 1, W = c.clientWidth || 340, H = c.clientHeight || 110;
  c.width = W * dpr; c.height = H * dpr;
  const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const B = barvy || { osa: css('--text-muted'), sl: css('--accent'), int: css('--warn'), ok: css('--ok'), pod: css('--danger') };
  const hs = o.histogram, st = o.stat; if (!hs) return;
  const max = Math.max(...hs.h);
  const pod = pripad.podezreli.filter(p => p.vyska > 0 && (pripad.porovnat || (vysledek.osoby[0] || {}).id) === o.id);
  let od = hs.od, do_ = hs.od + hs.sirka * hs.h.length;
  for (const v of [o.pravda, ...pod.map(p => p.vyska)]) if (v != null && isFinite(v)) { od = Math.min(od, v - 1); do_ = Math.max(do_, v + 1); }
  const x = val => 8 + (val - od) / (do_ - od) * (W - 16), dol = H - 18;
  g.fillStyle = B.sl;
  hs.h.forEach((n, i) => { const x0 = x(hs.od + i * hs.sirka), x1 = x(hs.od + (i + 1) * hs.sirka); const hh = n / max * (dol - 12); g.fillRect(x0, dol - hh, Math.max(1, x1 - x0 - 1), hh); });
  g.strokeStyle = B.int; g.lineWidth = 1.5; g.setLineDash([4, 3]);
  for (const q of [st.p025, st.p975]) { g.beginPath(); g.moveTo(x(q), 10); g.lineTo(x(q), dol); g.stroke(); }
  g.setLineDash([]);
  g.font = '10px system-ui,sans-serif'; g.textAlign = 'center';
  for (const p of pod) { g.strokeStyle = g.fillStyle = B.pod; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x(p.vyska), 10); g.lineTo(x(p.vyska), dol); g.stroke(); g.fillText(p.jmeno.slice(0, 10), Math.min(W - 24, Math.max(24, x(p.vyska))), 9); }
  if (o.pravda != null) { g.strokeStyle = B.ok; g.lineWidth = 2; g.beginPath(); g.moveTo(x(o.pravda), 10); g.lineTo(x(o.pravda), dol); g.stroke(); }
  g.fillStyle = B.osa; g.font = '11px system-ui,sans-serif';
  [st.p025, st.median, st.p975].forEach(q => g.fillText(fmt(q), Math.min(W - 18, Math.max(18, x(q))), H - 4));
}

function vykresliCitlivost() {
  const el = $('citlivost');
  if (!vysledek || !vysledek.osoby.length) { el.innerHTML = '<p class="muted">Až bude změřená osoba, ukáže se, který vstup nejvíc rozšiřuje interval.</p>'; return; }
  if (!citl) { el.innerHTML = '<p class="muted">Počítám citlivost (Monte Carlo po jednotlivých zdrojích)…</p>'; return; }
  const vic = citl.length > 1;
  el.innerHTML = citl.map(c => `<div class="sloupce">${vic ? `<div>${stitekOsoby(c.id)}</div>` : ''}
    ${c.zdroje.map(z => `<div class="sloupec"><span>${esc(z.nazev)}</span><span class="c">±${fmt(z.sd, 2)} · ${Math.round(z.podil * 100)} %</span><div class="pruh"><span style="width:${(z.podil * 100).toFixed(1)}%"></span></div></div>`).join('')}
    <div class="muted">Celkem σ = ${fmt(c.celkem, 2)} cm (součet dílčích ${fmt(c.slozene, 2)} cm). Zpřesněte vstup s největším podílem: víc čar, přiblížení při klikání, přesnější reference, užší korekce.</div></div>`).join('');
}

function vykresliPodezrele() {
  const el = $('podezreli');
  const osoby = vysledek ? vysledek.osoby : [];
  const cil = osoby.find(o => o.id === pripad.porovnat) || osoby[0];
  let h = `<p class="muted" style="margin:0">Výška podezřelých (z dokladu, měření) a její přesnost. Verdikt: |z| ≤ 2 nelze vyloučit, 2–3 málo pravděpodobné, nad 3 vyloučen. Shoda nic neprokazuje.</p>`;
  if (osoby.length > 1) h += `<label class="pole">Porovnat s osobou<select class="vstup" data-porovnat>${osoby.map(o => `<option value="${esc(o.id)}"${o === cil ? ' selected' : ''}>${esc(o.id)}</option>`).join('')}</select></label>`;
  if (pripad.podezreli.length) h += `<div class="pod-radek muted" style="font-size:.7rem"><span>Jméno</span><span>Výška cm</span><span>± cm</span><span></span></div>`;
  h += pripad.podezreli.map((p, i) => `<div class="pod-radek"><input class="vstup" data-pod="jmeno" data-i="${i}" value="${esc(p.jmeno)}" aria-label="Jméno podezřelého">
    <input class="vstup" type="number" step="0.5" min="0" data-pod="vyska" data-i="${i}" value="${p.vyska}" aria-label="Výška (cm)">
    <input class="vstup" type="number" step="0.5" min="0" data-pod="tol" data-i="${i}" value="${p.tol}" aria-label="Přesnost ± (cm)">
    <button class="btn mini" data-smaz-pod="${i}" title="Odebrat podezřelého" aria-label="Odebrat podezřelého">✖</button></div>`).join('');
  h += '<div class="radek-tl"><button class="btn mini" data-pridej-pod>➕ Přidat podezřelého</button></div>';
  if (cil && cil.stat && pripad.podezreli.length) {
    h += `<div class="tab-obal"><table><thead><tr><th>Podezřelý</th><th class="c">Výška</th><th class="c">Rozdíl</th><th class="c">z</th><th>Verdikt</th></tr></thead><tbody>${pripad.podezreli.map(p => {
      const r = V.porovnej(cil, p);
      return r ? `<tr><td>${esc(p.jmeno)}</td><td class="c">${fmt(p.vyska)} ± ${fmt(p.tol)}</td><td class="c">${fmtZ(r.d)}</td><td class="c">${fmt(r.z, 1)}</td><td class="verdikt-${r.verdikt}">${V.VERDIKTY[r.verdikt]}</td></tr>` : `<tr><td>${esc(p.jmeno)}</td><td colspan="4" class="muted">zadejte výšku</td></tr>`;
    }).join('')}</tbody></table></div><p class="muted" style="margin:0">Odhad osoby ${esc(cil.id)}: ${fmt(cil.vysledek)} ± ${fmt(cil.stat.sd)} cm. Rozdíl = podezřelý − odhad, z = rozdíl / √(σ² + tol²).</p>`;
  } else if (pripad.podezreli.length) h += '<p class="muted">Porovnání bude po dokončení měření osoby.</p>';
  el.innerHTML = h;
}

function vykresliMereni() {
  const s = sn(), el = $('mereni');
  if (!s) { el.innerHTML = ''; return; }
  const r = vysledekSnimku(s);
  let h = '';
  if (!s.mereni.length) h += '<p class="muted">Nástrojem 🧍 Osoba klikněte na bod na zemi pod temenem a pak na temeno.</p>';
  s.mereni.forEach((m, i) => {
    const vy = r && r.mereni.find(q => q.m.id === m.id);
    h += `<div class="polozka${vybrano && vybrano.typ === 'mereni' && vybrano.idx === i ? ' vybrana' : ''}" data-typ="mereni" data-idx="${i}">
      <div class="hlava"><span class="znak" style="background:${BARVY.osoba}"></span><input class="vstup" data-pole="nazev" value="${esc(m.nazev)}" aria-label="Název měření">
      <button class="btn mini danger" data-smaz="mereni" data-idx="${i}" title="Smazat měření" aria-label="Smazat měření">🗑️</button></div>
      <div class="hlava"><label class="pole" style="flex:1">Osoba (stejné označení = sloučit)<input class="vstup" data-pole="osoba" maxlength="16" value="${esc(m.osoba)}"></label>
      <label class="zatrz"><input type="checkbox" data-pole="pouzit"${m.pouzit !== false ? ' checked' : ''}> použít</label></div>
      <div class="muted">${!m.b || !m.t ? 'Neúplné.' : vy ? `Temeno nad zemí <b>${fmt(vy.geom)} cm</b> · korekce ${fmt(vy.korekce)} · <b>${fmt(vy.vyska)} cm</b>${vy.stat ? ` (95 %: ${fmt(vy.stat.p025)}–${fmt(vy.stat.p975)})` : ''}` : 'Čeká na kalibraci.'}</div>
      ${m.korekce.length ? '<div class="korekce muted" style="font-size:.7rem"><span>Korekce (cm)</span><span>od</span><span>do</span><span></span></div>' : ''}
      ${m.korekce.map((k, j) => `<div class="korekce"><input class="vstup" data-kor="nazev" data-j="${j}" value="${esc(k.nazev)}" aria-label="Název korekce">
        <input class="vstup" type="number" step="0.5" data-kor="od" data-j="${j}" value="${k.od}" aria-label="Od (cm)">
        <input class="vstup" type="number" step="0.5" data-kor="do" data-j="${j}" value="${k.do}" aria-label="Do (cm)">
        <button class="btn mini" data-smaz-kor="${j}" title="Odebrat korekci" aria-label="Odebrat korekci">✖</button></div>`).join('')}
      <select class="vstup" data-pridej-kor aria-label="Přidat korekci"><option value="">+ Přidat korekci…</option>
        ${V.PREDVOLBY.map((p, j) => `<option value="${j}">${esc(p.nazev)} (${fmt(p.od)} až ${fmt(p.do)})</option>`).join('')}<option value="vlastni">Vlastní…</option></select>
    </div>`;
  });
  h += '<p class="muted">Korekce se přičítají k výšce temene. Záporná = odečíst (podpatek, čepice). V Monte Carlo se berou rovnoměrně z rozsahu od–do. Měření se stejnou osobou se sloučí (i z jiných snímků).</p>';
  el.innerHTML = h;
}

function vykresliReference() {
  const s = sn(), el = $('reference');
  if (!s) { el.innerHTML = ''; return; }
  const r = vysledekSnimku(s);
  let h = '';
  if (!s.reference.length) h += '<p class="muted">Nástrojem 🚪 Reference klikněte na patu a vrchol svislého objektu se známou výškou (zárubeň dveří, výška obkladu, značka na sloupu, auto).</p>';
  s.reference.forEach((x, i) => {
    const k = r && (r.z.kontrola || []).find(q => q.r.id === x.id);
    const vaha = r && r.z.refs && r.z.refs.find(q => q.r.id === x.id);
    const spatne = k && x.pouzit !== false && Math.abs(k.chyba) > Math.max(2, 3 * k.sigma);
    h += `<div class="polozka${vybrano && vybrano.typ === 'reference' && vybrano.idx === i ? ' vybrana' : ''}" data-typ="reference" data-idx="${i}">
      <div class="hlava"><span class="znak" style="background:${BARVY.reference}"></span><input class="vstup" data-pole="nazev" value="${esc(x.nazev)}" aria-label="Název reference">
      <label class="zatrz"><input type="checkbox" data-pole="pouzit"${x.pouzit !== false ? ' checked' : ''}> použít</label>
      <button class="btn mini danger" data-smaz="reference" data-idx="${i}" title="Smazat referenci" aria-label="Smazat referenci">🗑️</button></div>
      <div class="mrizka"><label class="pole">Výška (cm)<input class="vstup" type="number" step="0.1" min="0" data-pole="vyska" value="${x.vyska}"></label>
      <label class="pole">Přesnost ± (cm)<input class="vstup" type="number" step="0.1" min="0" data-pole="tol" value="${x.tol}"></label></div>
      ${vaha && vaha.pouzit ? `<div class="muted">Váha v kombinaci: <b>${Math.round((vaha.vaha || 0) * 100)} %</b></div>` : x.pouzit === false ? '<div class="muted">Vyřazená – do výpočtu nevstupuje.</div>' : ''}
      ${k ? `<div class="${spatne ? 'chyba-txt' : 'muted'}">Kontrola z ostatních referencí: <b>${fmt(k.zmereno)} cm</b> (rozdíl ${fmtZ(k.chyba)} cm, z = ${fmt(k.z)})${spatne ? ' – vybočuje!' : ''}</div>` : ''}
    </div>`;
  });
  h += '<p class="muted">Reference musí stát svisle na stejné rovině země jako osoba. Kombinují se váženě: přesnější a lépe rozlišené mají větší váhu. Rozměry změřte na místě, typizované hodnoty (zárubeň 197/210 cm) jen orientačně.</p>';
  el.innerHTML = h;
}

function vykresliKalibraci() {
  const s = sn(), el = $('kalibrace');
  if (!s) { el.innerHTML = ''; return; }
  const k = (vysledekSnimku(s) || {}).z;
  const kal = k ? k.kal : V.kalibrace(s);
  const radek = (typ, u) => `<span><span class="znak" style="background:${BARVY[typ]}"></span>${NAZVY_SAD[typ]}</span>
    <span class="muted">${s[typ].length} úseček${u ? ` · odchylka max ${fmt(Math.max(...u.odchylky), 2)}°` : ''}</span>
    <button class="btn mini" data-smaz-sadu="${typ}" ${s[typ].length ? '' : 'disabled'} title="Smazat všechny úsečky sady" aria-label="Smazat sadu ${NAZVY_SAD[typ]}">✖</button>`;
  el.innerHTML = `<div class="sady">${radek('svisle', kal.vs)}${radek('vodA', kal.vA)}${radek('vodB', kal.vB)}
    <span><span class="znak" style="background:${BARVY.horizont}"></span>Horizont</span><span class="muted">${kal.l ? kal.zdrojH : 'chybí'}</span>
    <button class="btn mini" data-smaz-horizont ${s.horizont ? '' : 'disabled'} title="Smazat ručně zakreslený horizont" aria-label="Smazat horizont">✖</button></div>
    <div class="mrizka">
      <label class="pole">Zkreslení k1<input class="vstup" type="number" step="0.005" min="-0.5" max="0.5" data-sn="k1" value="${s.k1}"></label>
      <label class="pole">Nejistota k1 ±σ<input class="vstup" type="number" step="0.005" min="0" max="0.2" data-sn="k1Sigma" value="${s.k1Sigma}"></label>
      <label class="pole">Nejistota kliknutí σ (px)<input class="vstup" type="number" step="0.1" min="0" max="20" data-sn="sigmaPx" value="${s.sigmaPx}"></label>
    </div>
    <div class="radek-tl"><button class="btn mini" data-prikaz="odhadK1">🎯 Odhadnout k1 z čar</button></div>
    <p class="muted">k1 &gt; 0 opravuje soudkovité zkreslení (širokoúhlé kamery), k1 &lt; 0 poduškovité. Odhad hledá k1, při kterém se úsečky každé sady nejlépe sbíhají do jednoho bodu – potřebuje aspoň 3 úsečky v sadě rozprostřené po snímku, ideálně i u okrajů. Nejistotu k1 Monte Carlo započítá.</p>
    <p class="muted">σ = typická chyba umístění bodu. U ostrého snímku 0,5–1 px, u rozmazaného záznamu z kamery 2–4 px.</p>
    <p class="muted">Snímek ${s.sirka} × ${s.vyska} px${kal.v ? ` · úběžník svislic ${kal.v[2] && Math.abs(kal.v[2]) > 1e-7 ? `[${V.kart(kal.v).map(x => Math.round(x)).join(', ')}]` : 'v nekonečnu'}` : ''}</p>`;
}

/* události panelu */
$('panel').addEventListener('input', e => {
  const t = e.target, s = sn();
  if (t.dataset.pripad) {
    pripad[t.dataset.pripad] = t.dataset.pripad === 'mcN' ? Math.min(20000, Math.max(200, Math.round(cislo(t.value, 2000)))) : t.value;
    if (t.dataset.pripad === 'mcN') prepocet(false);
    uloz(); return;
  }
  if (t.dataset.pod) {
    const p = pripad.podezreli[+t.dataset.i]; if (!p) return;
    p[t.dataset.pod] = t.dataset.pod === 'jmeno' ? t.value : Math.max(0, cislo(t.value, 0));
    vykresliVysledek(); vykresliPodezreleTabulku(); uloz(); return;
  }
  if (t.hasAttribute('data-porovnat')) { pripad.porovnat = t.value; vykresliPodezrele(); vykresliVysledek(); uloz(); return; }
  if (!s) return;
  if (t.dataset.sn) { s[t.dataset.sn] = t.dataset.sn === 'k1' ? cislo(t.value, 0) : Math.max(0, cislo(t.value, t.dataset.sn === 'sigmaPx' ? 1 : 0)); return zmenaVstupu(); }
  const pol = t.closest('.polozka'); if (!pol) return;
  const x = s[pol.dataset.typ][+pol.dataset.idx];
  if (t.dataset.pole === 'pouzit') { x.pouzit = t.checked; return zmena(true); }
  if (t.dataset.pole === 'osoba') { x.osoba = V.osobaId(t.value); return zmenaVstupu(); }
  if (t.dataset.pole) { x[t.dataset.pole] = t.dataset.pole === 'nazev' ? t.value : Math.max(0, cislo(t.value, 0)); return zmenaVstupu(); }
  if (t.dataset.kor) { const k = x.korekce[+t.dataset.j]; k[t.dataset.kor] = t.dataset.kor === 'nazev' ? t.value : cislo(t.value, 0); return zmenaVstupu(); }
});
// tabulku podezřelých překreslit bez ztráty fokusu v polích
function vykresliPodezreleTabulku() {
  const a = document.activeElement, sel = a && a.dataset && a.dataset.pod ? `[data-pod="${a.dataset.pod}"][data-i="${a.dataset.i}"]` : null, poz = a && a.selectionStart;
  vykresliPodezrele();
  if (sel) { const n = $('podezreli').querySelector(sel); if (n) { n.focus(); try { n.setSelectionRange(poz, poz); } catch (e) { /* number */ } } }
}
function zmenaVstupu() { prepocet(false); vykresliVysledek(); vykresliPruvodce(); kresli(); uloz(); }
$('panel').addEventListener('change', async e => {
  const t = e.target, s = sn();
  if (t.dataset.kor === 'od' || t.dataset.kor === 'do') { // meze vždy od ≤ do
    const x = s.mereni[+t.closest('.polozka').dataset.idx], k = x.korekce[+t.dataset.j];
    if (k.od > k.do) { [k.od, k.do] = [k.do, k.od]; zmena(true); }
    return;
  }
  if (t.dataset.pole === 'osoba' || t.dataset.sn) { vykresliPanel(); return; }
  if (!t.hasAttribute('data-pridej-kor') || !s) return;
  const x = s.mereni[+t.closest('.polozka').dataset.idx], v = t.value;
  if (v === 'vlastni') {
    const n = await Dialog.zeptej('Název korekce (rozsah od–do pak upravíte):', 'Korekce');
    if (n) x.korekce.push({ nazev: n, od: 0, do: 0 });
  } else if (v !== '') x.korekce.push(Object.assign({}, V.PREDVOLBY[+v]));
  zmena(true);
});
$('panel').addEventListener('click', async e => {
  const t = e.target;
  const kn = t.closest('[data-krok-nastroj]');
  if (kn) { nastavNastroj(kn.dataset.krokNastroj); return; }
  if (t.closest('[data-krok-otevri]')) { const d = $('mereni').closest('details'); d.open = true; d.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); return; }
  const uk = t.closest('[data-ukazka]');
  if (uk) { nactiUkazku(uk.dataset.ukazka); return; }
  if (t.closest('[data-pridej-pod]')) { pripad.podezreli.push({ id: V.noveId(), jmeno: 'Podezřelý ' + (pripad.podezreli.length + 1), vyska: 175, tol: 1 }); vykresliPodezrele(); vykresliVysledek(); uloz(); return; }
  const sp = t.closest('[data-smaz-pod]');
  if (sp) { pripad.podezreli.splice(+sp.dataset.smazPod, 1); vykresliPodezrele(); vykresliVysledek(); uloz(); return; }
  const s = sn(); if (!s) return;
  const sm = t.closest('[data-smaz]');
  if (sm) {
    const x = s[sm.dataset.smaz][+sm.dataset.idx];
    if (await Dialog.potvrd(`Smazat „${x.nazev}“?`)) { s[sm.dataset.smaz].splice(+sm.dataset.idx, 1); vybrano = null; vybranyBod = null; zmena(true); }
    return;
  }
  const sk = t.closest('[data-smaz-kor]');
  if (sk) { s.mereni[+sk.closest('.polozka').dataset.idx].korekce.splice(+sk.dataset.smazKor, 1); return zmena(true); }
  const ss = t.closest('[data-smaz-sadu]');
  if (ss) { if (await Dialog.potvrd(`Smazat všechny úsečky sady ${NAZVY_SAD[ss.dataset.smazSadu]}?`)) { s[ss.dataset.smazSadu] = []; vybrano = null; vybranyBod = null; zmena(true); } return; }
  if (t.closest('[data-smaz-horizont]')) { s.horizont = null; return zmena(true); }
  const pol = t.closest('.polozka');
  if (pol && !t.closest('input,select,button,label')) { vybrano = { typ: pol.dataset.typ, idx: +pol.dataset.idx }; vybranyBod = null; vykresliPanel(); aktualizujStav(); kresli(); }
});

/* ---------- nástroje, stavový řádek ---------- */
function nastavNastroj(n) {
  nastroj = n; if (rozprac && rozprac.typ !== n) rozprac = null;
  prichyt = null;
  document.querySelectorAll('[data-nastroj]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.nastroj === n)));
  platno.classList.toggle('posun', n === 'posun');
  aktualizujStav(); kresli();
}
function aktualizujStav() {
  let t = RADY[nastroj];
  if (rozprac && rozprac.body.length === 1) t = rozprac.typ === 'reference' || rozprac.typ === 'osoba'
    ? 'Teď klikněte na <b>vrchol</b> (temeno) – čárkovaná svislice ukazuje směr. Esc = zrušit.' : 'Teď klikněte na <b>druhý konec</b> úsečky. Esc = zrušit.';
  $('rada').innerHTML = sn() ? t : 'Otevřete fotku nebo ukázkovou scénu.';
  $('tlZrusit').hidden = !rozprac;
  $('tlSmazVybrane').hidden = !vybrano;
}
document.querySelectorAll('[data-nastroj]').forEach(b => b.addEventListener('click', () => nastavNastroj(b.dataset.nastroj)));
$('tlZrusit').onclick = () => { rozprac = null; aktualizujStav(); kresli(); };
$('tlSmazVybrane').onclick = smazVybrane;
function prepniSnimek(i) {
  if (i < 0 || i >= pripad.snimky.length) return;
  aktivni = i; vybrano = null; vybranyBod = null; rozprac = null; vykresliPanel(); prizpusob(); aktualizujStav();
}
$('volbaSnimku').onchange = e => prepniSnimek(+e.target.value || 0);

/* ---------- snímky ---------- */
function nactiObrazek(blob) {
  return new Promise((ok, chyba) => {
    const url = URL.createObjectURL(blob), img = new Image();
    img.onload = () => ok({ img, url }); img.onerror = () => { URL.revokeObjectURL(url); chyba(new Error('obrázek nejde načíst')); };
    img.src = url;
  });
}
async function pridejSnimek(blob, nazev) {
  let o;
  try { o = await nactiObrazek(blob); } catch (e) { return Dialog.chyba('Soubor se nepodařilo načíst jako obrázek.'); }
  const s = V.prazdnySnimek(nazev, o.img.naturalWidth, o.img.naturalHeight);
  s.obrazek = blob; registruj(s);
  obrazky.set(s.id, o);
  pripad.snimky.push(s); aktivni = pripad.snimky.length - 1;
  vybrano = null; vybranyBod = null; rozprac = null;
  prepocet(false); vykresliPanel(); prizpusob(); aktualizujStav(); uloz();
}
$('souborFoto').onchange = async e => {
  const f = e.target.files[0]; e.target.value = '';
  if (f) { await pridejSnimek(f, f.name.replace(/\.[^.]+$/, '')); nastavNastroj('svisle'); }
};

/* ---------- ukázkové scény ---------- */
// vykreslí syntetickou scénu; m = měřítko (1 = plné rozlišení se šumem kamery)
function kresliSyntetiku(k, prvky, m) {
  const c = document.createElement('canvas'); c.width = Math.round(k.sirka * m); c.height = Math.round(k.vyska * m);
  const g = c.getContext('2d'); g.scale(m, m);
  const obloha = g.createLinearGradient(0, 0, 0, k.vyska);
  if (k.noc) { obloha.addColorStop(0, '#05070d'); obloha.addColorStop(1, '#141a26'); }
  else { obloha.addColorStop(0, '#9fc0dd'); obloha.addColorStop(1, '#dfe8ef'); }
  g.fillStyle = obloha; g.fillRect(0, 0, k.sirka, k.vyska);
  const deleny = body => { const r = []; body.forEach((a, i) => { const b = body[(i + 1) % body.length]; for (let j = 0; j < 16; j++) r.push(V.promitni(k, a.map((x, q) => x + (b[q] - x) * j / 16))); }); return r; };
  for (const p of prvky) {
    if (p.typ === 'plocha') {
      const b = deleny(p.body); g.beginPath(); b.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.closePath();
      g.fillStyle = p.barva; g.fill(); if (p.obrys) { g.strokeStyle = p.obrys; g.lineWidth = 1.5; g.stroke(); }
    } else {
      const [a, b] = p.body; g.beginPath();
      for (let j = 0; j <= 24; j++) { const q = V.promitni(k, a.map((x, i) => x + (b[i] - x) * j / 24)); j ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }
      g.strokeStyle = p.barva; g.lineWidth = p.sirka; g.stroke();
    }
  }
  if (k.noc) { // noční záznam: světlo z přístřešku shora, okraje do tmy, časová značka kamery
    const sv = g.createRadialGradient(k.sirka * 0.55, k.vyska * 0.45, k.vyska * 0.1, k.sirka * 0.55, k.vyska * 0.45, k.sirka * 0.75);
    sv.addColorStop(0, 'rgba(255,240,200,0.06)'); sv.addColorStop(1, 'rgba(0,0,10,0.55)');
    g.fillStyle = sv; g.fillRect(0, 0, k.sirka, k.vyska);
    g.font = '600 22px monospace'; g.fillStyle = 'rgba(235,235,235,0.85)'; g.textBaseline = 'top';
    g.fillText('CAM 02  2026-11-15  02:21:07', 18, k.vyska - 40);
  }
  if (m === 1) { // lehký šum jako u kamerového záznamu
    const d = g.getImageData(0, 0, k.sirka, k.vyska), r = V.rng(5), a = k.noc ? 22 : 14;
    for (let i = 0; i < d.data.length; i += 4) { const n = (r() - 0.5) * a; d.data[i] += n; d.data[i + 1] += n; d.data[i + 2] += n; }
    g.putImageData(d, 0, 0);
  }
  return c;
}
const naBlob = c => new Promise(ok => c.toBlob(ok, 'image/png'));
async function nactiUkazku(id) {
  const meta = V.UKAZKY.find(u => u.id === id); if (!meta) return;
  if (pripad.snimky.length && !await Dialog.potvrd(`Načíst ukázku „${meta.nazev}“ místo otevřeného případu? (Ctrl+Z ji vrátí zpět.)`)) return;
  const u = V.vytvorUkazku(id);
  const obr = await Promise.all(u.sceny.map(sc => naBlob(kresliSyntetiku(sc.kamera, sc.prvky, 1))));
  zapisHistorii(); pripad.snimky.forEach(registruj);
  zahodObrazky();
  u.pripad.snimky.forEach((s, i) => { s.obrazek = obr[i]; registruj(s); });
  pripad = u.pripad; aktivni = 0; vybrano = null; vybranyBod = null; rozprac = null; vysledekPlny = null; citl = null;
  if ($('dlgUkazky').open) $('dlgUkazky').close();
  $('dUkazka').open = true;
  if (u.pripad.podezreli.length) $('dPodezreli').open = true;
  if (id !== 'cviceni') $('dCitlivost').open = true;
  prepocet(false); vykresliPanel(); prizpusob(); nastavNastroj(id === 'cviceni' ? 'svisle' : 'posun'); uloz();
}
let galerieHotova = false;
function otevriGalerii() {
  const el = $('galerie');
  if (!galerieHotova) {
    el.innerHTML = V.UKAZKY.map(u => `<article class="karta-uk"><canvas data-nahled="${u.id}" width="360" height="240" aria-label="Náhled scény"></canvas>
      <div class="telo-k"><h3>${u.ikona} ${esc(u.nazev)}</h3><p class="muted">${esc(u.popis)}</p>
      <div><b style="font-size:.78rem">Co si vyzkoušet:</b><ul>${u.ukoly.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
      <button class="btn primary" data-ukazka="${u.id}">▶ Otevřít ukázku</button></div></article>`).join('');
    galerieHotova = true;
    setTimeout(() => el.querySelectorAll('canvas[data-nahled]').forEach(c => { // náhledy postupně, ať dialog naskočí hned
      const u = V.vytvorUkazku(c.dataset.nahled), sc = u.sceny[0];
      const n = kresliSyntetiku(sc.kamera, sc.prvky, 360 / sc.kamera.sirka);
      const g = c.getContext('2d'), h = n.height * c.width / n.width;
      g.fillStyle = '#222'; g.fillRect(0, 0, c.width, c.height); g.drawImage(n, 0, (c.height - h) / 2, c.width, h);
    }), 30);
  }
  $('dlgUkazky').showModal();
}
$('galerie').addEventListener('click', e => { const b = e.target.closest('[data-ukazka]'); if (b) nactiUkazku(b.dataset.ukazka); });
$('uvodUkazky').innerHTML = V.UKAZKY.map(u => `<button class="tl" data-ukazka="${u.id}" title="${esc(u.popis)}">${u.ikona} ${esc(u.nazev)}</button>`).join('');
$('uvodUkazky').addEventListener('click', e => { const b = e.target.closest('[data-ukazka]'); if (b) nactiUkazku(b.dataset.ukazka); });

/* ---------- export / import ---------- */
const naDataUrl = b => new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(b); });
function zDataUrl(u) {
  const [hl, data] = String(u).split(','), typ = (hl.match(/data:([^;]+)/) || [])[1] || 'image/png';
  const bin = atob(data), a = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return new Blob([a], { type: typ });
}
async function exportuj() {
  if (!pripad.snimky.length) return Dialog.info('Není co uložit.');
  const kopie = Object.assign({}, pripad, { snimky: await Promise.all(pripad.snimky.map(async s => Object.assign({}, s, { obrazek: s.obrazek instanceof Blob ? await naDataUrl(s.obrazek) : s.obrazek }))) });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(kopie)], { type: 'application/json' }));
  a.download = `vyska_${(pripad.cj || pripad.nazev || 'pripad').replace(/[^\w\-]+/g, '_')}.json`;
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
$('souborImport').onchange = async e => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  let d;
  try { d = JSON.parse(await f.text()); } catch (er) { return Dialog.chyba('Soubor není platný JSON.'); }
  if (!d || !Array.isArray(d.snimky)) return Dialog.chyba('Tohle není uložený případ Výšky z fotky.');
  if (pripad.snimky.length && !await Dialog.potvrd('Nahradit současný případ načteným?')) return;
  const m = V.migruj(d);
  m.snimky.forEach(s => { if (typeof s.obrazek === 'string' && s.obrazek.startsWith('data:')) s.obrazek = zDataUrl(s.obrazek); registruj(s); });
  zapisHistorii(); pripad.snimky.forEach(registruj); zahodObrazky();
  pripad = m; aktivni = 0; vybrano = null; vybranyBod = null; rozprac = null; vysledekPlny = null;
  prepocet(false); vykresliPanel(); prizpusob(); aktualizujStav(); uloz();
};

/* ---------- protokol ---------- */
function snimekSPrekryvy(s) {
  const sc = Math.min(1, 1400 / s.sirka), c = document.createElement('canvas');
  c.width = Math.round(s.sirka * sc); c.height = Math.round(s.vyska * sc);
  kresliScenu(c.getContext('2d'), { s: sc, ox: 0, oy: 0 }, s, { bezRozprac: true, tloustka: Math.max(1, s.sirka / 1100) });
  return c.toDataURL('image/jpeg', 0.88);
}
const bodTxt = p => p ? `${fmt(p[0])}; ${fmt(p[1])}` : '—';
function protokol() {
  if (!pripad.snimky.length) return Dialog.info('Nejdřív otevřete snímek a změřte osobu.');
  const v = vysledekPlny || V.vyhodnot(pripad); vysledek = v;
  const ci = citl || (v.osoby.length ? V.citlivost(pripad, { n: 400, plny: v }) : []);
  const d = new Date().toLocaleString('cs-CZ');
  const u = metaUkazky();
  let h = `<h2>Protokol – odhad výšky osoby z fotografie</h2>
  <table><tbody><tr><th>Případ</th><td>${esc(pripad.nazev || '—')}</td></tr><tr><th>Č. j.</th><td>${esc(pripad.cj || '—')}</td></tr>
  <tr><th>Zpracovatel</th><td>${esc(pripad.zpracovatel || '—')}</td></tr><tr><th>Vyhotoveno</th><td>${d}</td></tr>
  <tr><th>Podklady</th><td>${pripad.snimky.length} ${pripad.snimky.length === 1 ? 'snímek' : 'snímky/snímků'}: ${pripad.snimky.map(s => esc(s.nazev)).join(', ')}</td></tr>
  ${pripad.poznamka ? `<tr><th>Poznámka</th><td>${esc(pripad.poznamka).replace(/\n/g, '<br>')}</td></tr>` : ''}
  ${u ? `<tr><th>Ukázka</th><td>Syntetická scéna se známou pravdou: ${esc(u.nazev)}</td></tr>` : ''}</tbody></table>
  <h3>1. Výsledek</h3>`;
  if (v.osoby.length && v.stat) {
    h += '<div class="souhrn">';
    for (const o of v.osoby) {
      const hc = document.createElement('canvas'); hc.style.cssText = 'width:340px;height:110px;position:fixed;left:-9999px'; document.body.appendChild(hc);
      kresliHistogram(hc, o, { osa: '#333', sl: '#4a74b8', int: '#b06d00', ok: '#177540', pod: '#b3261e' });
      h += `<div><div>Osoba <b>${esc(o.id)}</b></div><div class="velke">${fmt(o.vysledek)} cm</div>
        <div>σ = ${fmt(o.stat.sd)} cm · 95% interval <b>${fmt(o.stat.p025)} – ${fmt(o.stat.p975)} cm</b></div>
        <div class="mala">${o.mereni.length > 1 ? `vážený průměr ${o.mereni.length} měření` : '1 měření'} · ${v.N} simulací Monte Carlo${o.pravda != null ? ` · pravda ukázky ${fmt(o.pravda)} cm (odchylka ${fmtZ(o.vysledek - o.pravda, 2)})` : ''}</div>
        <img src="${hc.toDataURL()}" alt="Histogram výsledku" style="border:0;margin-top:4px"></div>`;
      hc.remove();
    }
    h += '</div><p class="mala">Histogram: rozdělení výsledku z Monte Carlo, čárkovaně 95% interval' + (pripad.podezreli.length ? ', červeně výšky podezřelých' : '') + '. Interval nezahrnuje systematické chyby – viz Omezení.</p>';
  } else h += '<p>Žádné dokončené měření.</p>';
  const cil = v.osoby.find(o => o.id === pripad.porovnat) || v.osoby[0];
  if (pripad.podezreli.length && cil && cil.stat) {
    h += `<h3>2. Porovnání s podezřelými (osoba ${esc(cil.id)})</h3><table><thead><tr><th>Podezřelý</th><th>Výška</th><th>Rozdíl</th><th>z</th><th>Verdikt</th></tr></thead><tbody>${pripad.podezreli.map(p => {
      const r = V.porovnej(cil, p);
      return r ? `<tr><td>${esc(p.jmeno)}</td><td>${fmt(p.vyska)} ± ${fmt(p.tol)} cm</td><td>${fmtZ(r.d)} cm</td><td>${fmt(r.z, 1)}</td><td><b>${V.VERDIKTY[r.verdikt]}</b></td></tr>` : '';
    }).join('')}</tbody></table><p class="mala">z = (výška podezřelého − odhad) / √(σ² + tol²). |z| ≤ 2: nelze vyloučit; 2–3: málo pravděpodobné; &gt; 3: vyloučen. Shoda výšky není důkazem totožnosti.</p>`;
  }
  if (ci.length) {
    h += `<h3>${pripad.podezreli.length ? 3 : 2}. Rozbor nejistoty (citlivostní analýza)</h3>`;
    for (const c of ci) h += `<table style="margin-bottom:6px"><thead><tr><th>Zdroj nejistoty${ci.length > 1 ? ` – osoba ${esc(c.id)}` : ''}</th><th>σ (cm)</th><th>Podíl na rozptylu</th></tr></thead><tbody>${c.zdroje.map(z =>
      `<tr><td>${esc(z.nazev)}</td><td>${fmt(z.sd, 2)}</td><td><span class="pruh" style="width:${Math.round(z.podil * 120)}px"></span> ${Math.round(z.podil * 100)} %</td></tr>`).join('')}
      <tr><td><b>Celkem (všechny zdroje současně)</b></td><td><b>${fmt(c.celkem, 2)}</b></td><td class="mala">součet dílčích ${fmt(c.slozene, 2)} cm</td></tr></tbody></table>`;
  }
  let kap = (pripad.podezreli.length ? 3 : 2) + (ci.length ? 1 : 0);
  v.snimky.forEach((r, i) => {
    const s = r.sn, k = r.z.kal;
    const ub = u2 => u2 ? (Math.abs(u2.v[2]) > 1e-7 ? `[${V.kart(u2.v).map(x => Math.round(x)).join('; ')}]` : 'v nekonečnu') : '—';
    h += `<h3>${kap}.${i + 1} Snímek: ${esc(s.nazev)}</h3><img src="${snimekSPrekryvy(s)}" alt="Snímek s vyznačeným měřením">
    <table><tbody><tr><th>Rozměr</th><td>${s.sirka} × ${s.vyska} px</td><th>Nejistota kliknutí σ</th><td>${fmt(s.sigmaPx, 1)} px</td></tr>
    <tr><th>Zkreslení k1</th><td>${fmt(s.k1, 3)}${s.k1Sigma ? ' ± ' + fmt(s.k1Sigma, 3) : ''}</td><th>Horizont</th><td>${k && k.l ? k.zdrojH : 'chybí'}</td></tr>
    <tr><th>Svislé úsečky</th><td>${s.svisle.length} · úběžník ${ub(k && k.vs)}${k && k.vs ? ` · max. odchylka ${fmt(Math.max(...k.vs.odchylky), 2)}°` : ''}</td><th>Směr A / B</th><td>${s.vodA.length} / ${s.vodB.length} úseček</td></tr></tbody></table>`;
    if (r.z.chyby.length) h += `<p><b>Nelze vyhodnotit:</b> ${r.z.chyby.map(esc).join(' ')}</p>`;
    if (s.reference.length) h += `<table style="margin-top:8px"><thead><tr><th>Reference</th><th>Známá výška</th><th>Přesnost</th><th>Použita / váha</th><th>Kontrola z ostatních</th></tr></thead><tbody>${s.reference.map(x => {
      const q = (r.z.kontrola || []).find(y => y.r.id === x.id), w = r.z.refs && r.z.refs.find(y => y.r.id === x.id);
      return `<tr><td>${esc(x.nazev)}</td><td>${fmt(x.vyska)} cm</td><td>± ${fmt(x.tol)} cm</td><td>${x.pouzit === false ? 'vyřazena' : w && w.vaha != null ? Math.round(w.vaha * 100) + ' %' : 'ano'}</td><td>${q ? `${fmt(q.zmereno)} cm (${fmtZ(q.chyba)}; z = ${fmt(q.z)})` : '—'}</td></tr>`; }).join('')}</tbody></table>`;
    if (r.mereni.length) h += `<table style="margin-top:8px"><thead><tr><th>Měření</th><th>Osoba</th><th>Temeno nad zemí</th><th>Korekce</th><th>Výška</th><th>95% interval</th><th>cm/px</th><th>Váha</th></tr></thead><tbody>${r.mereni.map(m =>
      `<tr><td>${esc(m.m.nazev)}</td><td>${esc(m.osoba)}</td><td>${fmt(m.geom)} cm</td><td>${m.m.korekce.length ? m.m.korekce.map(k2 => `${esc(k2.nazev)}: ${fmt(k2.od)} až ${fmt(k2.do)}`).join('<br>') : 'žádné'}</td><td><b>${fmt(m.vyska)} cm</b></td><td>${m.stat ? `${fmt(m.stat.p025)} – ${fmt(m.stat.p975)}` : '—'}</td><td>${fmt(m.cmPx, 2)}</td><td>${m.pouzit ? (m.vaha != null ? Math.round(m.vaha * 100) + ' %' : '—') : 'vyřazeno'}</td></tr>`).join('')}</tbody></table>`;
  });
  kap++;
  const vr = varovani().filter(w => !w.chyba);
  if (vr.length) { h += `<h3>${kap}. Upozornění</h3><ul>${vr.map(w => `<li>${esc(w.t)}</li>`).join('')}</ul>`; kap++; }
  h += `<h3>${kap}. Metodika</h3><ol>
  <li>Body byly zakresleny v původním snímku a opraveny o radiální zkreslení (k1, střed snímku, poloměr = polovina úhlopříčky).</li>
  <li>Úběžník svislic a úběžníky dvou vodorovných směrů na zemi určeny metodou nejmenších čtverců ze všech zakreslených úseček (vlastní vektor matice Σ w·l·lᵀ). Horizont = spojnice vodorovných úběžníků, případně ručně zakreslená přímka.</li>
  <li>Metrický faktor α určen z referenčních objektů známé výšky: α·Z = ‖b×t‖ / (|l·b|·‖v×t‖) (Criminisi a kol. 2000), ekvivalentní dvojpoměru na svislici osoby. Více referencí: vážený průměr α s vahou 1 / (relativní rozptyl tolerance + citlivost na kliknutí); každá reference zkontrolována ostatními (rozdíl a z-skóre).</li>
  <li>Výška osoby = výška temene nad bodem na zemi (temeno promítnuto na svislici paty) + součet korekcí na obuv, postoj, fázi chůze a pokrývku hlavy.</li>
  <li>Nejistota: Monte Carlo (${v.N} vzorků) – každý bod posunut o náhodnou chybu N(0, σ), k1 o N(0, σk1), výšky referencí rovnoměrně v toleranci, korekce rovnoměrně v zadaném rozsahu.</li>
  <li>Více měření téže osoby (i z různých snímků) sloučeno váženým průměrem s vahami z kovarianční matice Monte Carlo (zobecněné nejmenší čtverce, záporné váhy vynulovány) – korelace měření ze stejného snímku je tak zohledněna.</li>
  <li>Citlivostní analýza: Monte Carlo s jediným zapnutým zdrojem nejistoty; podíl = rozptyl zdroje / součet rozptylů.</li></ol>
  <h3>${kap + 1}. Omezení metody</h3>${OMEZENI}
  <h3>Příloha: souřadnice zakreslených bodů (px, původní snímek)</h3>`;
  v.snimky.forEach(r => {
    const s = r.sn, sady = [['Svislé', s.svisle], ['Směr A', s.vodA], ['Směr B', s.vodB]].concat(s.horizont ? [['Horizont', [s.horizont]]] : []);
    h += `<p><b>${esc(s.nazev)}</b></p><table class="mala"><thead><tr><th>Prvek</th><th>Bod 1 (x; y)</th><th>Bod 2 (x; y)</th></tr></thead><tbody>
      ${sady.flatMap(([n, a]) => a.map((sg, i) => `<tr><td>${n} ${i + 1}</td><td>${bodTxt(sg[0])}</td><td>${bodTxt(sg[1])}</td></tr>`)).join('')}
      ${s.reference.map(x => `<tr><td>Reference: ${esc(x.nazev)}</td><td>pata ${bodTxt(x.b)}</td><td>vrchol ${bodTxt(x.t)}</td></tr>`).join('')}
      ${s.mereni.map(x => `<tr><td>Osoba ${esc(x.osoba)}: ${esc(x.nazev)}</td><td>pata ${bodTxt(x.b)}</td><td>temeno ${bodTxt(x.t)}</td></tr>`).join('')}</tbody></table>`;
  });
  h += `<div class="podpis"><span>Datum: ………………………</span><span>Podpis zpracovatele: ………………………………</span></div>`;
  $('protokol').innerHTML = h;
  $('protokolObal').hidden = false;
}

/* ---------- příkazy, nabídky, klávesy ---------- */
const PRIKAZY = {
  otevrit: () => $('souborFoto').click(),
  galerie: otevriGalerii,
  ukazka: () => nactiUkazku('zaklad'),
  export: exportuj,
  import: () => $('souborImport').click(),
  protokol,
  tisk: () => window.print(),
  zavriProtokol: () => { $('protokolObal').hidden = true; },
  zpet, vpred,
  async novy() {
    if (!await Dialog.potvrd('Smazat celý případ včetně snímků? Uložte si ho předtím do JSON (Ctrl+Z ho ještě vrátí).')) return;
    zapisHistorii(); pripad.snimky.forEach(registruj); zahodObrazky();
    pripad = V.prazdnyPripad(); aktivni = 0; vybrano = null; vybranyBod = null; rozprac = null; vysledekPlny = null;
    prepocet(false); vykresliPanel(); aktualizujStav(); kresli(); uloz();
  },
  async prejmenuj() {
    const s = sn(); if (!s) return;
    const n = await Dialog.zeptej('Název snímku:', s.nazev);
    if (n) { s.nazev = n; zmena(true); }
  },
  async smazSadu() {
    const s = sn(); if (!s) return;
    if (await Dialog.potvrd('Smazat všechny svislé, vodorovné čáry a horizont tohoto snímku? Reference a měření zůstanou.')) { s.svisle = []; s.vodA = []; s.vodB = []; s.horizont = null; zmena(true); }
  },
  async odeberSnimek() {
    const s = sn(); if (!s) return;
    if (!await Dialog.potvrd(`Odebrat snímek „${s.nazev}“ i s jeho měřeními?`)) return;
    registruj(s);
    pripad.snimky.splice(aktivni, 1); aktivni = Math.max(0, aktivni - 1); vybrano = null; vybranyBod = null; rozprac = null;
    zmena(true); prizpusob();
  },
  prizpusob,
  zoomPlus: () => zoom(1.4), zoomMinus: () => zoom(1 / 1.4),
  lupa() { lupaZap = !lupaZap; ulozPref('lupa', lupaZap); $('tlLupa').setAttribute('aria-pressed', String(lupaZap)); kresli(); },
  pomocne() { pomocneZap = !pomocneZap; ulozPref('pomocne', pomocneZap); $('tlPomocne').setAttribute('aria-pressed', String(pomocneZap)); kresli(); },
  prichyt() { prichytZap = !prichytZap; ulozPref('prichyt', prichytZap); $('tlPrichyt').setAttribute('aria-pressed', String(prichytZap)); prichyt = null; kresli(); },
  odhadK1() {
    const s = sn(); if (!s) return;
    const k1 = V.odhadK1(s);
    if (k1 == null) return Dialog.chyba('K odhadu je potřeba aspoň jedna sada se 3 a více úsečkami.');
    const pred = s.k1; s.k1 = k1; zmena(true);
    Dialog.info(`Odhad k1 = ${fmt(k1, 3)} (předtím ${fmt(pred, 3)}). Zkontrolujte, že se odchylky úseček zmenšily; nejistotu odhadu můžete zadat do pole „Nejistota k1“.`);
  },
  napoveda: () => $('dlgNapoveda').showModal(),
  zkratky: () => $('dlgZkratky').showModal()
};
document.querySelectorAll('dialog [data-zavri]').forEach(b => { b.onclick = () => b.closest('dialog').close(); });

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
  if (p) { e.stopPropagation(); zavriNabidky(); return PRIKAZY[p.dataset.prikaz](p); }
  if (!e.target.closest('.nabidka')) zavriNabidky();
});
addEventListener('resize', () => { zavriNabidky(); velikost(); });
document.addEventListener('keydown', e => {
  if ((e.target.closest && e.target.closest('input,textarea,select')) || document.querySelector('dialog[open]') || !e.key) return;
  const k = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && !e.altKey) {
    if (k === 'z' && !e.shiftKey) { e.preventDefault(); zpet(); }
    else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); vpred(); }
    return;
  }
  if (e.altKey) return;
  if (vybranyBod && k.startsWith('arrow')) {
    e.preventDefault();
    const d = e.shiftKey ? 5 : 0.5;
    if (k === 'arrowleft') vybranyBod[0] -= d; else if (k === 'arrowright') vybranyBod[0] += d;
    else if (k === 'arrowup') vybranyBod[1] -= d; else vybranyBod[1] += d;
    zmena(false); return;
  }
  const n = { v: 'posun', 1: 'svisle', 2: 'vodA', 3: 'vodB', 4: 'horizont', r: 'reference', o: 'osoba' }[k];
  if (n) { nastavNastroj(n); return; }
  if (k === 'f') prizpusob();
  else if (k === 'g') otevriGalerii();
  else if (k === 'p') protokol();
  else if (k === 'l') PRIKAZY.lupa();
  else if (k === 'm') PRIKAZY.prichyt();
  else if (k === 'h') PRIKAZY.pomocne();
  else if (e.key === '?') PRIKAZY.zkratky();
  else if (k === 'pageup') { e.preventDefault(); prepniSnimek(aktivni - 1); }
  else if (k === 'pagedown') { e.preventDefault(); prepniSnimek(aktivni + 1); }
  else if (k === 'escape') { zavriNabidky(); if (!$('protokolObal').hidden) $('protokolObal').hidden = true; rozprac = null; vybrano = null; vybranyBod = null; prichyt = null; vykresliPanel(); aktualizujStav(); kresli(); }
  else if ((k === 'delete' || k === 'backspace') && vybrano) { e.preventDefault(); smazVybrane(); }
});
addEventListener('message', e => { if (e.data && e.data.tema) setTimeout(() => { kresli(); vykresliVysledek(); }, 50); });

/* ---------- start ---------- */
$('tlLupa').setAttribute('aria-pressed', String(lupaZap));
$('tlPomocne').setAttribute('aria-pressed', String(pomocneZap));
$('tlPrichyt').setAttribute('aria-pressed', String(prichytZap));
new ResizeObserver(velikost).observe($('platnoObal'));
(async () => {
  await nacti();
  // ?pripad=17 bez rozpracované práce v záznamu případu → otevřít ukázku z kamery čerpací stanice
  if (REZIM17 && !pripad.snimky.length) await nactiUkazku('pripad17');
  prepocet(false); vykresliPanel(); nastavNastroj(pripad.snimky.length ? 'posun' : 'svisle');
  velikost(); prizpusob(); tlacitkaHistorie();
})();
window.VYSKA_APP = { pripad: () => pripad, pohled: () => Object.assign({}, pohled), aktivni: () => aktivni, nactiUkazku, otevriGalerii, protokol, prizpusob, vysledek: () => vysledek, citlivost: () => citl, nastavNastroj, zpet, vpred, PRIKAZY };
})();

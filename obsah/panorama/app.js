/* Skládání panoramat – uživatelské rozhraní (výpočty dělá panorama/worker.js nad jadro.js + slozeni.js). */
'use strict';
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
if (window.self === window.top) document.body.classList.add('samostatne');
const KLIC = 'webapp_panorama_nastaveni';
const MOBIL = matchMedia('(pointer:coarse)').matches && Math.min(screen.width, screen.height) < 900;
const LIMIT_MPX = MOBIL ? 16 : 100, LIMIT_STRANA = 16384;
const KOULE = p => p !== 'rovina';

/* ---------- stav ---------- */
let snimky = [];          // { id, nazev, soubor, plnaW, plnaH, nahled (canvas), mini, exif, pouzit }
let aktivni = [];         // id snímků poslaných do posledního výpočtu (index = index ve workeru)
let upravy = {};          // id → { dx, dy, uhel } (rovina, px celé fotky) | { Q: rotace 3×3 v pano } (koule)
let kb = [];              // kontrolní body: [{ a: id, b: id, body: [[xa, ya, xb, yb, rucni]] }] v px celé fotky
let chyby = new Map();    // kb záznam → pole chyb bodů (px celé fotky) z poslední optimalizace
let pohled = { yaw: 0, pitch: 0, roll: 0 };
let zarovnano = null, nahled = null, vybrany = null, pocitam = false, dalsiId = 1;
let projekt = { id: null, nazev: '' }, zmeneno = false;
const N = Object.assign({ projekce: 'valec', model: '', ohnisko: '', nahled: '900', body: '700', zisky: true, vyrovnat: true, orez: true, obrysy: true, prechod: 6,
  prolnuti: 'multi', sev: 'vaha', ohniskoRezim: 'spolecne', doladit: true, xmp: true },
  (() => { try { return JSON.parse(localStorage.getItem(KLIC)) || {}; } catch (e) { return {}; } })());
function ulozN() { try { localStorage.setItem(KLIC, JSON.stringify(N)); } catch (e) {} }
const oznacZmenu = () => { zmeneno = true; };

/* ---------- Zpět / Znovu: snímky stavu, který mění uživatel ---------- */
const hist = { zpet: [], znovu: [] };
const snimekStavu = () => JSON.stringify({ kb, upravy, pohled, pouzit: snimky.filter(s => s.pouzit).map(s => s.id) });
function zapamatuj() {
  hist.zpet.push(snimekStavu()); if (hist.zpet.length > 100) hist.zpet.shift();
  hist.znovu = []; oznacZmenu(); tlacitkaHistorie();
}
function tlacitkaHistorie() { $('tlZpet').disabled = !hist.zpet.length; $('tlZnovu').disabled = !hist.znovu.length; }
function obnov(z, do_) {
  if (!z.length) return;
  const predKb = JSON.stringify(kb), predPouzit = snimky.filter(s => s.pouzit).map(s => s.id).join();
  do_.push(snimekStavu());
  const s = JSON.parse(z.pop());
  kb = s.kb; upravy = s.upravy; pohled = s.pohled;
  snimky.forEach(x => { x.pouzit = s.pouzit.includes(x.id); });
  tlacitkaHistorie(); vyplnPohled(); vykresliPas();
  if (predPouzit !== s.pouzit.join()) { $('stavText').textContent = 'Výběr snímků se změnil – klikněte na ▶ Složit.'; return; }
  if (JSON.stringify(kb) !== predKb && zarovnano) optimalizuj(); else prekresli();
}

/* ---------- worker ---------- */
let worker = null, poHotovo = null, po360 = null;
function W() {
  if (worker) return worker;
  worker = new Worker('panorama/worker.js');
  worker.onmessage = e => zprava(e.data);
  worker.onerror = e => { konecVypoctu(); $('eVytvorit').disabled = false; Dialog.chyba('Výpočet selhal: ' + (e.message || 'chyba workeru')); };
  return worker;
}
function zprava(m) {
  if (m.typ === 'prubeh') return ukazPrubeh(m.text, m.podil);
  if (m.typ === 'chyba') { konecVypoctu(); $('eVytvorit').disabled = false; return Dialog.chyba(m.zprava); }
  if (m.typ === 'zarovnano') return prijmiZarovnani(m);
  if (m.typ === 'nahled') { konecVypoctu(); nahled = m.prazdny ? null : m; kresliNahled(); return; }
  if (m.typ === 'equi360') { konecVypoctu(); if (stavPoVypoctu) $('stavText').innerHTML = stavPoVypoctu; if (po360) po360(m); return; }
  if (m.typ === 'chciSnimek') return posliSnimek(m.i);
  if (m.typ === 'hotovo') { konecVypoctu(); if (poHotovo) poHotovo(m); }
}
function ukazPrubeh(text, podil) { $('prubeh').hidden = false; $('prubeh').value = podil || 0; $('stavText').textContent = text; }
function konecVypoctu() {
  pocitam = false; $('prubeh').hidden = true; $('tlSloz').disabled = false;
  if (cekaOpt) { cekaOpt = false; cekaPrekresleni = null; return optimalizuj(true); }
  if (cekaPrekresleni) { const r = cekaPrekresleni; cekaPrekresleni = null; prekresli(r === 'rychle'); }
}

/* ---------- načtení fotek ---------- */
async function pridejSoubory(seznam, exifVychozi) {
  const chybne = [];
  for (const f of seznam) {
    if (!/^image\//.test(f.type) && !/\.(jpe?g|png|webp|avif|bmp|gif)$/i.test(f.name || '')) { chybne.push(f.name); continue; }
    ukazPrubeh('Načítám ' + f.name, 0);
    try {
      let ex = exifVychozi || {};
      if (!exifVychozi) try { ex = PANO.exif(await f.slice(0, 262144).arrayBuffer()); } catch (e) { ex = {}; }
      const s = { id: dalsiId++, nazev: f.name || 'snímek', soubor: f, exif: ex, pouzit: true };
      await pripravNahled(s);
      snimky.push(s);
    } catch (e) { chybne.push(f.name); }
  }
  $('prubeh').hidden = true;
  if (chybne.length) Dialog.chyba('Tyto soubory se nepodařilo načíst (prohlížeč je neumí dekódovat, např. HEIC): ' + chybne.join(', '));
  zarovnano = null; nahled = null; oznacZmenu();
  vykresliPas(); kresliNahled();
  $('stavText').textContent = snimky.length ? `${snimky.length} fotek. Klikněte na ▶ Složit.` : 'Žádné fotky.';
}
async function pripravNahled(s) {
  const bmp = await createImageBitmap(s.soubor, { imageOrientation: 'from-image' });
  s.plnaW = bmp.width; s.plnaH = bmp.height;
  const max = +N.nahled, k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.max(2, Math.round(bmp.width * k)); c.height = Math.max(2, Math.round(bmp.height * k));
  const cx = c.getContext('2d', { willReadFrequently: true });
  cx.imageSmoothingQuality = 'high';
  cx.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  s.nahled = c; s.nahledMax = max; s.sedy = null;
  if (!s.mini) {
    const m = document.createElement('canvas'), km = 160 / Math.max(c.width, c.height);
    m.width = Math.round(c.width * km); m.height = Math.round(c.height * km);
    m.getContext('2d').drawImage(c, 0, 0, m.width, m.height);
    s.mini = m.toDataURL('image/jpeg', 0.75);
  }
}
/* ohnisko v px celé fotky: ruční → EXIF → (odhad) 28 mm */
function ohniskoPlne(s) {
  if (+N.ohnisko > 0) return { f: PANO.zEkv35(s.plnaW, s.plnaH, +N.ohnisko), zdroj: 'ruční' };
  if (zarovnano && zarovnano.f) { const i = aktivni.indexOf(s.id); if (i >= 0 && zarovnano.f[i]) return { f: zarovnano.f[i], zdroj: 'optimalizace' }; }
  const f = PANO.ohniskoPx(s.plnaW, s.plnaH, s.exif);
  return f ? { f, zdroj: 'EXIF' } : { f: PANO.zEkv35(s.plnaW, s.plnaH, 28), zdroj: 'odhad' };
}

/* ---------- pás snímků ---------- */
function poradiSnimku() {
  const r = {};
  if (!nahled) return r;
  nahled.obrysy.map(o => ({ id: aktivni[o.i], x: o.body.reduce((s, p) => s + p[0], 0) / o.body.length, y: o.body.reduce((s, p) => s + p[1], 0) / o.body.length }))
    .sort((a, b) => (a.x - b.x) || (a.y - b.y)).forEach((o, i) => { r[o.id] = i + 1; });
  return r;
}
function vykresliPas() {
  const por = poradiSnimku();
  const spoj = id => { if (!zarovnano) return true; const i = aktivni.indexOf(id); return i < 0 || zarovnano.spojene[i]; };
  $('pas').innerHTML = snimky.map(s => {
    const f = ohniskoPlne(s), mm = PANO.ekv35(s.plnaW, s.plnaH, f.f);
    return `<div class="karta${s.pouzit ? '' : ' vypnuta'}${vybrany === s.id ? ' vybrana' : ''}${s.pouzit && !spoj(s.id) ? ' nespojena' : ''}" data-karta="${s.id}" title="${esc(s.nazev)}">
      ${por[s.id] ? `<span class="cislo">${por[s.id]}</span>` : ''}
      <img src="${s.mini}" alt="">
      <div class="jm">${esc(s.nazev)}</div>
      <div class="meta">${s.plnaW}×${s.plnaH} · ${mm.toFixed(1)} mm (${f.zdroj})</div>
      <div class="radek"><label class="zatrh" style="font-size:.74rem"><input type="checkbox" data-pouzit="${s.id}"${s.pouzit ? ' checked' : ''}> použít</label>
      <button class="pryc" type="button" data-odeber="${s.id}" title="Odebrat" aria-label="Odebrat">✕</button></div>
    </div>`;
  }).join('');
  $('uvod').hidden = snimky.length > 0 && !!nahled;
  const s = snimky.find(x => x.id === vybrany), u = s && upravy[s.id];
  $('uVybrany').textContent = s ? `Vybraný snímek: ${s.nazev}` + (u ? ' (ručně posunutý)' : '')
    : 'Vyberte snímek kliknutím v náhledu nebo v pásu. Ctrl+tažení ho posune, šipky (Shift = ×10) a [ ] ho posunou/otočí.';
}

/* ---------- výpočet ---------- */
const ix = id => aktivni.indexOf(id);
function nastaveniProWorker() {
  const odhad = !(+N.ohnisko > 0) && !snimky.some(s => s.pouzit && PANO.ohniskoPx(s.plnaW, s.plnaH, s.exif));
  return {
    projekce: N.projekce, model: N.model, maxBody: +N.body, vyrovnat: N.vyrovnat, ohnisko: N.ohniskoRezim, odhadOhniska: odhad,
    zisky: N.zisky, orez: N.orez, prechod: +N.prechod, prolnuti: N.prolnuti, sev: N.sev, pohled,
    upravy: aktivni.map(id => {
      const u = upravy[id];
      if (!u) return null;
      return KOULE(N.projekce) ? (u.Q ? { Q: u.Q } : null) : (u.Q ? null : u);
    })
  };
}
const kbProWorker = (jenRucni) => kb.filter(r => ix(r.a) >= 0 && ix(r.b) >= 0 && r.body.length)
  .map(r => ({ a: ix(r.a), b: ix(r.b), body: jenRucni ? r.body.filter(q => q[4]) : r.body })).filter(r => r.body.length);
async function pripravData() {
  const pouzite = snimky.filter(s => s.pouzit);
  for (const s of pouzite) if (s.nahledMax !== +N.nahled) { ukazPrubeh('Připravuji náhled ' + s.nazev, 0); await pripravNahled(s); }
  aktivni = pouzite.map(s => s.id);
  return pouzite.map(s => {
    const c = s.nahled, d = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data;
    const f0 = +N.ohnisko > 0 || PANO.ohniskoPx(s.plnaW, s.plnaH, s.exif) ? ohniskoBezOpt(s) : PANO.zEkv35(s.plnaW, s.plnaH, 28);
    return { w: c.width, h: c.height, plnaW: s.plnaW, plnaH: s.plnaH, f: f0 * c.width / s.plnaW, rgba: d };
  });
}
function ohniskoBezOpt(s) { return +N.ohnisko > 0 ? PANO.zEkv35(s.plnaW, s.plnaH, +N.ohnisko) : PANO.ohniskoPx(s.plnaW, s.plnaH, s.exif); }
/* bezHledani = použít uložené kontrolní body (otevřený projekt) */
async function sloz(bezHledani) {
  if (pocitam) return;
  const pouzite = snimky.filter(s => s.pouzit);
  if (pouzite.length < 2) return Dialog.info(snimky.length < 2 ? 'Přidejte aspoň dvě fotky.' : 'Zapněte aspoň dva snímky.');
  pocitam = true; $('tlSloz').disabled = true;
  let data;
  try { data = await pripravData(); } catch (e) { konecVypoctu(); return Dialog.chyba('Fotku se nepodařilo znovu načíst.'); }
  ukazPrubeh('Hledám body…', 0);
  const zprava = { typ: 'zarovnej', snimky: data, nast: nastaveniProWorker(), rucni: kbProWorker(true) };
  if (bezHledani === true) zprava.kb = kbProWorker(false);
  W().postMessage(zprava, data.map(d => d.rgba.buffer));
}
function optimalizuj(teply) {
  if (!zarovnano) return sloz();
  if (pocitam) { cekaOpt = true; return; }
  pocitam = true;
  W().postMessage({ typ: 'optimalizuj', kb: kbProWorker(false), nast: nastaveniProWorker(), teply: !!teply });
}
let cekaOpt = false, stavPoVypoctu = '';
let cekaPrekresleni = null;
function prekresli(rychle) {
  if (!zarovnano && !pocitam) return;
  if (pocitam) { if (cekaPrekresleni !== 'plne') cekaPrekresleni = rychle ? 'rychle' : 'plne'; return; }
  pocitam = true;
  W().postMessage({ typ: 'prekresli', nast: nastaveniProWorker(), rychle: !!rychle });
}
function prijmiZarovnani(m) {
  zarovnano = m;
  kb = m.kb.map(e => ({ a: aktivni[e.a], b: aktivni[e.b], body: e.body }));
  chyby = new Map();
  m.chyby.forEach((c, i) => { if (kb[i]) chyby.set(kb[i], c); });
  $('tlOpt').disabled = false; $('tlBody').disabled = false;
  ukazInfo();
}
function tridaChyby(px) { return px == null ? '' : px < 2 ? 'dobre' : px < 5 ? 'stredni' : 'spatne'; }
function ukazInfo() {
  const z = zarovnano, jm = i => esc((snimky.find(s => s.id === aktivni[i]) || {}).nazev || '?');
  const nesp = z.spojene.map((v, i) => v ? null : jm(i)).filter(Boolean);
  $('info').hidden = false;
  const fmm = z.f ? z.f.map((f, i) => { const s = snimky.find(x => x.id === aktivni[i]); return PANO.ekv35(s.plnaW, s.plnaH, f); }) : [];
  const fTxt = fmm.length ? (Math.max(...fmm) - Math.min(...fmm) < 0.05 ? fmm[0].toFixed(2) + ' mm' : fmm.map(v => v.toFixed(1)).join(', ') + ' mm') : '–';
  const hrany = z.hrany.slice().sort((a, b) => (b.rms || 0) - (a.rms || 0));
  $('infoObsah').innerHTML = `<div>${KOULE(N.projekce) ? `Sférický model · ohnisko (ekv. 35 mm): ${fTxt} · iterací optimalizace: ${z.iter || 0}` : 'Rovinná mozaika'} · výpočet ${(z.ms / 1000).toFixed(1)} s</div>
    <div class="tab-obal"><table><tr><th>Dvojice</th><th>Bodů</th><th>z toho ručních</th><th>Chyba RMS</th><th>Max</th><th></th></tr>${hrany.map(h =>
      `<tr data-dvojice="${aktivni[h.a]},${aktivni[h.b]}"><td>${jm(h.a)} ↔ ${jm(h.b)}</td><td>${h.n}</td><td>${h.rucne || ''}</td><td class="${tridaChyby(h.rms)}">${h.rms == null ? '–' : h.rms.toFixed(2) + ' px'}</td><td>${h.max.toFixed(1)} px</td><td>${h.pouzita ? 'kostra' : ''}</td></tr>`).join('')}</table></div>
    ${z.statistika ? `<div>Zamítnuté dvojice (RANSAC): ${z.statistika.filter(s => !s.inl && s.kandidat >= 12).map(s => `${jm(s.a)} ↔ ${jm(s.b)} (${s.kandidat})`).join(', ') || 'žádné'}</div>` : ''}`;
  $('kvalita').className = 'kvalita ' + tridaChyby(z.rms);
  $('kvalita').textContent = z.rms == null ? '' : `Chyba zarovnání ${z.rms.toFixed(2)} px (max ${z.max.toFixed(1)})`;
  stavPoVypoctu = nesp.length
    ? `<span class="varovani">Nespojené snímky: ${nesp.join(', ')}. Přidejte kontrolní body (📍), zkuste jiné ohnisko nebo snímek vypněte.</span>`
    : `Spojeno ${z.spojene.length - nesp.length} snímků` + (projekt.nazev ? ` · projekt „${esc(projekt.nazev)}"` : '') + '.';
  $('stavText').innerHTML = stavPoVypoctu;
  vykresliPas();
}

/* ---------- náhled ---------- */
function kresliNahled() {
  $('platna').hidden = !nahled;
  $('uvod').hidden = !!nahled;
  $('tlExport').disabled = !nahled;
  if (!nahled) { $('rozmer').textContent = ''; return; }
  if (stavPoVypoctu && !nahled.rychle) $('stavText').innerHTML = stavPoVypoctu;
  const p = $('platno'), v = $('vrstva');
  if (p.width !== nahled.W || p.height !== nahled.H) { p.width = v.width = nahled.W; p.height = v.height = nahled.H; }
  p.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(nahled.rgba), nahled.W, nahled.H), 0, 0);
  const u = nahled.uhly || {};
  $('rozmer').textContent = `${nahled.plnyW} × ${nahled.plnyH} px (${(nahled.plnyW * nahled.plnyH / 1e6).toFixed(1)} Mpx)` + (u.sirka ? ` · ${u.sirka}° × ${u.vyska || '?'}°` : '');
  $('pUhly').textContent = u.sirka ? `Záběr ${u.sirka}° × ${u.vyska}°` + (nahled.obtoc ? ' – celých 360°' : '') : '';
  if (!tah) kresliVrstvu();
  if (!nahled.rychle) vykresliPas();
}
function kresliVrstvu(t) {
  const v = $('vrstva'), c = v.getContext('2d');
  c.clearRect(0, 0, v.width, v.height);
  if (!nahled) return;
  const sk = Math.max(1, nahled.W / (v.clientWidth || nahled.W)), lw = 1.5 * sk;
  const o = nahled.orez;
  if (o) {
    c.fillStyle = 'rgba(0,0,0,.45)';
    c.fillRect(0, 0, v.width, o.y); c.fillRect(0, o.y + o.h, v.width, v.height - o.y - o.h);
    c.fillRect(0, o.y, o.x, o.h); c.fillRect(o.x + o.w, o.y, v.width - o.x - o.w, o.h);
  }
  const por = poradiSnimku(), akc = getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#2862bb';
  const posuny = nahled.obtoc ? [-nahled.W, 0, nahled.W] : [0];
  for (const ob of nahled.obrysy) {
    const id = aktivni[ob.i], vyb = id === vybrany;
    if (!N.obrysy && !vyb) continue;
    const dx = vyb && t && t.snimek ? t.dx : 0, dy = vyb && t && t.snimek ? t.dy : 0;
    for (const s of posuny) {
      c.beginPath();
      ob.body.forEach(([x, y], i) => i ? c.lineTo(x + dx + s, y + dy) : c.moveTo(x + dx + s, y + dy));
      c.closePath();
      c.setLineDash(vyb ? [] : [6 * sk, 4 * sk]);
      c.lineWidth = vyb ? lw * 2 : lw; c.strokeStyle = vyb ? akc : 'rgba(255,255,255,.85)';
      c.stroke();
    }
    let cx = ob.body.reduce((s, p) => s + p[0], 0) / ob.body.length + dx;
    const cy = ob.body.reduce((s, p) => s + p[1], 0) / ob.body.length + dy;
    if (nahled.obtoc) cx = ((cx % nahled.W) + nahled.W) % nahled.W;
    c.setLineDash([]);
    c.font = `bold ${Math.round(16 * sk)}px system-ui,sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 4 * sk; c.strokeStyle = 'rgba(0,0,0,.7)'; c.strokeText(por[id] || '', cx, cy);
    c.fillStyle = vyb ? akc : '#fff'; c.fillText(por[id] || '', cx, cy);
  }
}
function bodPlatna(e) {
  const v = $('vrstva'), r = v.getBoundingClientRect();
  return [(e.clientX - r.left) * v.width / r.width, (e.clientY - r.top) * v.height / r.height];
}
function uvnitr(pt, poly) {
  let in_ = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) in_ = !in_;
  }
  return in_;
}
function snimkyPod(pt) {
  const r = [];
  for (const o of nahled.obrysy) {
    const posuny = nahled.obtoc ? [-nahled.W, 0, nahled.W] : [0];
    if (posuny.some(s => uvnitr([pt[0] - s, pt[1]], o.body))) r.push(aktivni[o.i]);
  }
  return r;
}
/* tažení: pohled (koule) nebo snímek (Ctrl, nebo rovina) */
let tah = null, tahCas = 0;
$('vrstva').addEventListener('pointerdown', e => {
  if (!nahled || e.button > 0) return;
  const pt = bodPlatna(e), pod = snimkyPod(pt);
  const snimek = (e.ctrlKey || e.metaKey || !KOULE(N.projekce)) && pod.length;
  if (snimek && !pod.includes(vybrany)) vybrany = pod[pod.length - 1];
  tah = { x: pt[0], y: pt[1], dx: 0, dy: 0, id: e.pointerId, presun: false, snimek, pod, start: { ...pohled } };
  $('vrstva').setPointerCapture(e.pointerId); $('vrstva').classList.add('tahne');
});
$('vrstva').addEventListener('pointermove', e => {
  if (!tah || e.pointerId !== tah.id) return;
  const pt = bodPlatna(e);
  tah.dx = pt[0] - tah.x; tah.dy = pt[1] - tah.y;
  if (Math.hypot(tah.dx, tah.dy) > 3) tah.presun = true;
  if (!tah.presun) return;
  if (tah.snimek || !KOULE(N.projekce)) { kresliVrstvu(tah); return; }
  // pohled v reálném čase: rychlý náhled
  pohled = { ...tah.start, ...uhelZTahu(tah) };
  vyplnPohled();
  const t = performance.now();
  if (t - tahCas > 60) { tahCas = t; prekresli(true); }
});
function uhelZTahu(t) {
  const k = nahled.k, st = 180 / Math.PI;
  return N.projekce === 'stereo' || N.projekce === 'primo'
    ? { yaw: zaokr(tah.start.yaw + t.dx / k * st * 0.5), pitch: zaokr(Math.max(-90, Math.min(90, tah.start.pitch - t.dy / k * st * 0.5))) }
    : { yaw: zaokr(tah.start.yaw + t.dx / k * st), pitch: zaokr(Math.max(-90, Math.min(90, tah.start.pitch - t.dy / k * st))) };
}
const zaokr = v => Math.round(((v + 540) % 360 - 180) * 10) / 10;
$('vrstva').addEventListener('pointerup', e => {
  if (!tah || e.pointerId !== tah.id) return;
  const t = tah; tah = null; $('vrstva').classList.remove('tahne');
  if (!t.presun) {
    vybrany = t.pod.length ? (t.pod.includes(vybrany) && t.pod.length > 1 ? t.pod[(t.pod.indexOf(vybrany) + 1) % t.pod.length] : t.pod[t.pod.length - 1]) : null;
    kresliVrstvu(); vykresliPas(); return;
  }
  if (t.snimek && vybrany) {
    zapamatuj();
    posunSnimku(vybrany, t.dx / nahled.k, t.dy / nahled.k);
    prekresli(); vykresliPas(); return;
  }
  const novy = { ...pohled };
  pohled = t.start; zapamatuj(); pohled = novy;
  prekresli();
});
/* posun snímku o (dX, dY) v jednotkách roviny projekce */
function posunSnimku(id, dX, dY) {
  if (KOULE(N.projekce)) {
    const u = upravy[id] || (upravy[id] = {}), Q = u.Q || PANO.I3();
    u.Q = PANO.nas(PANO.nas(PANO.rotY(dX), PANO.rotX(-dY)), Q);
  } else {
    const u = upravy[id] || (upravy[id] = { dx: 0, dy: 0, uhel: 0 }), m = nahled.kPlny;
    u.dx = (u.dx || 0) + dX * m; u.dy = (u.dy || 0) + dY * m;
  }
}
function otocSnimek(id, stupne) {
  if (KOULE(N.projekce)) {
    if (!zarovnano || !zarovnano.R) return;
    const i = ix(id), u = upravy[id] || (upravy[id] = {}), Q = u.Q || PANO.I3();
    const Pm = PANO.nas(PANO.pohledU(pohled.yaw, pohled.pitch, pohled.roll), zarovnano.Rv);
    const osa = PANO.mv(Q, PANO.mv(Pm, PANO.mtv(zarovnano.R[i], [0, 0, 1])));
    u.Q = PANO.nas(PANO.rod(osa.map(v => v * stupne * PANO.RAD)), Q);
  } else {
    const u = upravy[id] || (upravy[id] = { dx: 0, dy: 0, uhel: 0 });
    u.uhel = (u.uhel || 0) + stupne;
  }
}
function uprav(co, smer, nasobek = 1) {
  if (!vybrany) return Dialog.info('Nejdřív vyberte snímek v náhledu nebo v pásu.');
  if (!nahled) return;
  zapamatuj();
  const k = +$('uKrok').value * nasobek;
  if (co === 'uhel') otocSnimek(vybrany, smer * k / 10);
  else { const d = smer * k * (nahled.W / ($('vrstva').clientWidth || nahled.W)) / nahled.k; posunSnimku(vybrany, co === 'dx' ? d : 0, co === 'dy' ? d : 0); }
  prekresli(); vykresliPas();
}

/* ---------- pohled ---------- */
function vyplnPohled() { $('pYaw').value = pohled.yaw; $('pPitch').value = pohled.pitch; $('pRoll').value = pohled.roll; }
['pYaw', 'pPitch', 'pRoll'].forEach(id => {
  const kl = { pYaw: 'yaw', pPitch: 'pitch', pRoll: 'roll' }[id];
  $(id).addEventListener('input', () => { pohled = { ...pohled, [kl]: +$(id).value || 0 }; prekresli(true); });
  $(id).addEventListener('focus', () => { $(id).dataset.pred = snimekStavu(); });
  $(id).addEventListener('change', () => {
    if ($(id).dataset.pred) { hist.zpet.push($(id).dataset.pred); hist.znovu = []; oznacZmenu(); tlacitkaHistorie(); delete $(id).dataset.pred; }
    prekresli();
  });
});
function vyrovnat() {
  if (!zarovnano) return;
  zapamatuj();
  pohled = { yaw: 0, pitch: N.projekce === 'stereo' ? 0 : 0, roll: 0 };
  vyplnPohled();
  if (!N.vyrovnat) { N.vyrovnat = true; $('nVyrovnat').checked = true; ulozN(); }
  optimalizuj(true);
}

/* ---------- export obrázku ---------- */
function moznostiMeritka() {
  const sel = $('eMeritko'), w = nahled.plnyW, h = nahled.plnyH;
  const volby = [1, 0.75, 0.5, 0.35, 0.25, 0.15];
  const vejde = m => w * m * h * m / 1e6 <= LIMIT_MPX && Math.max(w, h) * m <= LIMIT_STRANA;
  const prvni = volby.find(vejde) || 0.1;
  sel.innerHTML = volby.map(m => `<option value="${m}"${m === prvni ? ' selected' : ''}>${Math.round(m * 100)} % – ${Math.round(w * m)} × ${Math.round(h * m)} px (${(w * m * h * m / 1e6).toFixed(1)} Mpx)${vejde(m) ? '' : ' ⚠️'}</option>`).join('');
  const equi = N.projekce === 'equi';
  $('eXmp').disabled = !equi; $('eXmp').checked = equi && N.xmp;
  $('eXmpPozn').textContent = equi ? (nahled.obtoc && !nahled.orez ? 'Celá šířka 360°.' : 'Výřez – prohlížeče ho umístí podle GPano (CroppedArea…).') : 'Metadata 360° jen u sférické projekce (equirectangular).';
  odhad();
}
function odhad() {
  const m = +$('eMeritko').value, w = Math.round(nahled.plnyW * m), h = Math.round(nahled.plnyH * m);
  const nejvetsi = Math.max(...snimky.filter(s => aktivni.includes(s.id)).map(s => s.plnaW * s.plnaH));
  const mb = (w * h * 5 * 2 + nejvetsi * 4 * 4) / 1048576;
  $('eOdhad').textContent = `Výsledek ${w} × ${h} px, potřeba paměti zhruba ${Math.round(mb)} MB. Skládá se po jednom snímku z originálů.`;
  const nad = w * h / 1e6 > LIMIT_MPX || Math.max(w, h) > LIMIT_STRANA;
  $('eVarovani').hidden = !nad;
  $('eVarovani').textContent = nad ? `Pozor: přes ${LIMIT_MPX} Mpx nebo ${LIMIT_STRANA} px na stranu – prohlížeč nemusí takové plátno vytvořit nebo dojde paměť. Zvolte menší rozlišení.` : '';
}
let urlVysledku = null, posledniVysledek = null;
async function exportuj() {
  if (!nahled || pocitam) return;
  if (!$('eVarovani').hidden && !await Dialog.potvrd('Rozlišení je nad doporučeným limitem a výpočet může selhat nebo zamrznout kartu. Pokračovat?')) return;
  const typ = $('eTyp').value, m = +$('eMeritko').value;
  pocitam = true; $('eVytvorit').disabled = true;
  $('eVysledek').hidden = true; $('eStahnout').hidden = true; $('eDo360').hidden = true;
  poHotovo = r => {
    $('eVytvorit').disabled = false;
    if (urlVysledku) URL.revokeObjectURL(urlVysledku);
    urlVysledku = URL.createObjectURL(r.blob); posledniVysledek = r;
    const jm = (projekt.nazev || 'panorama').replace(/[\\/:*?"<>|]+/g, '_') + '_' + new Date().toISOString().slice(0, 10) + (typ === 'image/png' ? '.png' : '.jpg');
    $('eVysledek').innerHTML = `<img src="${urlVysledku}" alt="Hotové panorama"><div style="text-align:center;margin-top:6px">${r.W} × ${r.H} px · ${(r.blob.size / 1048576).toFixed(1)} MB${r.gpano ? ' · s metadaty 360°' : ''}</div>`;
    $('eVysledek').hidden = false;
    const a = $('eStahnout'); a.href = urlVysledku; a.download = jm; a.hidden = false;
    $('eDo360').hidden = !r.gpano;
    $('stavText').textContent = 'Panorama je hotové.';
  };
  N.xmp = $('eXmp').checked; ulozN();
  W().postMessage({ typ: 'finalni', nast: nastaveniProWorker(), meritko: m, format: typ, kvalita: +$('eKvalita').value, orez: N.orez ? nahled.orez : null, xmp: $('eXmp').checked && !$('eXmp').disabled });
}
async function posliSnimek(i) {
  const s = snimky.find(x => x.id === aktivni[i]);
  try {
    const bmp = await createImageBitmap(s.soubor, { imageOrientation: 'from-image' });
    worker.postMessage({ typ: 'snimek', bitmap: bmp }, [bmp]);
  } catch (e) {
    konecVypoctu(); $('eVytvorit').disabled = false;
    Dialog.chyba('Fotku ' + s.nazev + ' se nepodařilo načíst v plném rozlišení (málo paměti?).');
    worker.terminate(); worker = null; zarovnano = null; nahled = null; kresliNahled();
  }
}

/* ---------- editor kontrolních bodů ---------- */
let bCeka = null, bVyb = -1;
const BARVA = px => px == null ? '#ffffff' : px < 3 ? '#2ecc40' : px < 10 ? '#ff9f1a' : '#ff4136';
function naplnBody(a, b) {
  const ak = snimky.filter(s => s.pouzit), opt = ak.map(s => `<option value="${s.id}">${esc(s.nazev)}</option>`).join('');
  $('bA').innerHTML = opt; $('bB').innerHTML = opt;
  if (a == null) {
    const nej = seznamDvojic()[0];
    if (nej) { a = nej.a; b = nej.b; } else { a = vybrany && ak.some(s => s.id === vybrany) ? vybrany : ak[0].id; b = (ak.find(s => s.id !== a) || ak[0]).id; }
  }
  $('bA').value = a; $('bB').value = b;
  bCeka = null; bVyb = -1;
  naplnDvojice(); kresliBody();
}
function seznamDvojic() {
  const r = kb.filter(z => z.body.length && snimky.some(s => s.id === z.a && s.pouzit) && snimky.some(s => s.id === z.b && s.pouzit)).map(z => {
    const c = (chyby.get(z) || []).filter(x => x != null), rms = c.length ? Math.sqrt(c.reduce((s, x) => s + x * x, 0) / c.length) : null;
    return { a: z.a, b: z.b, n: z.body.length, rms };
  });
  return r.sort((x, y) => (y.rms || 0) - (x.rms || 0));
}
function naplnDvojice() {
  const jm = id => esc((snimky.find(s => s.id === id) || {}).nazev || '?'), a = +$('bA').value, b = +$('bB').value;
  const sez = seznamDvojic();
  $('bDvojice').innerHTML = '<option value="">– vyberte dvojici –</option>' + sez.map(d =>
    `<option value="${d.a},${d.b}"${(d.a === a && d.b === b) || (d.a === b && d.b === a) ? ' selected' : ''}>${jm(d.a)} ↔ ${jm(d.b)} · ${d.n} b. · ${d.rms == null ? 'nový' : d.rms.toFixed(1) + ' px'}</option>`).join('');
  const celk = kb.reduce((s, z) => s + z.body.length, 0);
  $('bSouhrn').textContent = `${celk} bodů v ${sez.length} dvojicích` + (zarovnano && zarovnano.rms != null ? ` · chyba ${zarovnano.rms.toFixed(2)} px` : '');
}
/* záznam dvojice v pořadí A, B (otočený = body prohozené) */
function zaznamBody(vytvor) {
  const a = +$('bA').value, b = +$('bB').value;
  let z = kb.find(r => r.a === a && r.b === b);
  if (z) return { z, otoc: false };
  z = kb.find(r => r.a === b && r.b === a);
  if (z) return { z, otoc: true };
  if (!vytvor) return null;
  z = { a, b, body: [] }; kb.push(z);
  return { z, otoc: false };
}
const bodAB = (q, otoc) => otoc ? [q[2], q[3], q[0], q[1], q[4]] : q;
function kresliBody() {
  const r = zaznamBody(false), body = r ? r.z.body : [], ch = r ? chyby.get(r.z) || [] : [];
  [['bA', 'bPlA', 0], ['bB', 'bPlB', 2]].forEach(([sel, pl, o]) => {
    const s = snimky.find(x => x.id === +$(sel).value), c = $(pl);
    if (!s) return;
    if (c.width !== s.nahled.width || c.height !== s.nahled.height) { c.width = s.nahled.width; c.height = s.nahled.height; }
    const cx = c.getContext('2d'), k = s.nahled.width / s.plnaW, rr = Math.max(4, c.width / 140);
    cx.drawImage(s.nahled, 0, 0);
    const kresli = (x, y, i, barva, vyb, ruc) => {
      cx.beginPath(); cx.arc(x * k, y * k, vyb ? rr * 1.8 : rr, 0, 7); cx.lineWidth = rr / 2; cx.strokeStyle = '#000'; cx.stroke();
      cx.strokeStyle = barva; cx.lineWidth = vyb ? rr / 1.5 : rr / 3; cx.stroke();
      if (ruc || vyb) { cx.font = `bold ${Math.round(rr * 2.4)}px system-ui,sans-serif`; cx.fillStyle = barva; cx.fillText(String(i), x * k + rr * 1.4, y * k - rr); }
    };
    body.forEach((q0, i) => { const q = bodAB(q0, r.otoc); kresli(q[o], q[o + 1], i + 1, q[4] && ch[i] == null ? '#ffffff' : BARVA(ch[i]), i === bVyb, q[4]); });
    if (bCeka && o === 0) kresli(bCeka[0], bCeka[1], body.length + 1, '#ffffff', true, true);
  });
  const vybTxt = bVyb >= 0 && body[bVyb] ? ` Vybraný bod ${bVyb + 1}: ${body[bVyb][4] ? 'ruční' : 'automatický'}${ch[bVyb] != null ? `, chyba ${ch[bVyb].toFixed(1)} px` : ''}.` : '';
  $('bStav').textContent = `${body.length} bodů.` + vybTxt + (bCeka ? ' Teď klikněte na stejné místo vpravo (B).' : '');
  $('bSmazVybrany').disabled = bVyb < 0;
}
function sedyNahledu(s) {
  if (!s.sedy) { const c = s.nahled; s.sedy = PANO.sedy({ w: c.width, h: c.height, d: c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data }); }
  return s.sedy;
}
function klikBody(e, strana) {
  const sa = snimky.find(x => x.id === +$('bA').value), sb = snimky.find(x => x.id === +$('bB').value);
  const s = strana ? sb : sa, c = e.currentTarget, r = c.getBoundingClientRect();
  if (!sa || !sb || sa === sb) return Dialog.info('Vyberte dva různé snímky.');
  const x = (e.clientX - r.left) / r.width * s.plnaW, y = (e.clientY - r.top) / r.height * s.plnaH;
  // výběr existujícího bodu
  const zz = zaznamBody(false), o = strana ? 2 : 0, tol = 14 / r.width * s.plnaW;
  if (zz && !bCeka) {
    let nej = -1, d = tol;
    zz.z.body.forEach((q0, i) => { const q = bodAB(q0, zz.otoc), dd = Math.hypot(q[o] - x, q[o + 1] - y); if (dd < d) { d = dd; nej = i; } });
    if (nej >= 0) { bVyb = nej === bVyb ? -1 : nej; kresliBody(); return; }
  }
  bVyb = -1;
  if (!strana) bCeka = [x, y];
  else if (bCeka) {
    let xb = x, yb = y;
    if (N.doladit) {
      const ka = sa.nahled.width / sa.plnaW, kbb = sb.nahled.width / sb.plnaW;
      const d = PANO.dolad(sedyNahledu(sa), bCeka[0] * ka, bCeka[1] * ka, sedyNahledu(sb), x * kbb, y * kbb, { hledat: 6 });
      if (d.ncc > 0.7) { xb = d.x / kbb; yb = d.y / kbb; }
    }
    zapamatuj();
    const { z, otoc } = zaznamBody(true);
    z.body.push(otoc ? [xb, yb, bCeka[0], bCeka[1], 1] : [bCeka[0], bCeka[1], xb, yb, 1]);
    bCeka = null; naplnDvojice();
  } else return Dialog.info('Nejdřív klikněte do levého snímku (A).');
  kresliBody();
}
function smazVybrany() {
  const zz = zaznamBody(false);
  if (!zz || bVyb < 0) return;
  zapamatuj();
  zz.z.body.splice(bVyb, 1);
  const c = chyby.get(zz.z); if (c) c.splice(bVyb, 1);
  bVyb = -1; naplnDvojice(); kresliBody();
}
$('bPlA').addEventListener('click', e => klikBody(e, 0));
$('bPlB').addEventListener('click', e => klikBody(e, 1));
$('bA').addEventListener('change', () => { bCeka = null; bVyb = -1; naplnDvojice(); kresliBody(); });
$('bB').addEventListener('change', () => { bCeka = null; bVyb = -1; naplnDvojice(); kresliBody(); });
$('bDvojice').addEventListener('change', () => { const v = $('bDvojice').value; if (!v) return; const [a, b] = v.split(',').map(Number); $('bA').value = a; $('bB').value = b; bCeka = null; bVyb = -1; kresliBody(); });
$('bSmazVybrany').addEventListener('click', smazVybrany);
$('bSmazDvojici').addEventListener('click', async () => {
  const zz = zaznamBody(false);
  if (!zz || !zz.z.body.length || !await Dialog.potvrd(`Smazat všech ${zz.z.body.length} bodů této dvojice?`)) return;
  zapamatuj(); zz.z.body = []; bCeka = null; bVyb = -1; naplnDvojice(); kresliBody();
});
$('bVycistit').addEventListener('click', () => {
  const prah = +$('bPrah').value || 10;
  let n = 0;
  const pred = snimekStavu();
  for (const z of kb) {
    const c = chyby.get(z);
    if (!c) continue;
    const nove = [], nc = [];
    z.body.forEach((q, i) => { if (c[i] != null && c[i] > prah) n++; else { nove.push(q); nc.push(c[i]); } });
    z.body = nove; chyby.set(z, nc);
  }
  if (n) { hist.zpet.push(pred); hist.znovu = []; oznacZmenu(); tlacitkaHistorie(); }
  Dialog.info(n ? `Smazáno ${n} bodů s chybou nad ${prah} px. Klikněte na 🎯 Optimalizovat.` : `Žádný bod nemá chybu nad ${prah} px.`);
  bVyb = -1; naplnDvojice(); kresliBody();
});
$('dlgBody').addEventListener('close', () => { if ($('dlgBody').returnValue === 'hotovo') optimalizuj(true); });
$('dlgBody').addEventListener('keydown', e => { if ((e.key === 'Delete' || e.key === 'Backspace') && !e.target.closest('input,select')) { e.preventDefault(); smazVybrany(); } });
function otevriBody(a, b) {
  if (snimky.filter(s => s.pouzit).length < 2) return Dialog.info('Potřebujete aspoň dvě fotky.');
  $('dlgBody').returnValue = ''; $('dlgBody').showModal(); naplnBody(a, b);
}

/* ---------- prohlížeč 360° ---------- */
const v360 = { src: null, g: null, yaw: 0, pitch: 0, fov: 90, ceka: false };
function kresli360() {
  if (v360.ceka) return;
  v360.ceka = true;
  requestAnimationFrame(() => {
    v360.ceka = false;
    const c = $('pl360');
    if (!$('dlg360').open || !v360.src) return;
    const r = c.getBoundingClientRect(), k = Math.min(1, 900 / Math.max(1, r.width));
    const w = Math.max(64, Math.round(r.width * k)), h = Math.max(48, Math.round(r.height * k));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const cx = c.getContext('2d'), out = cx.createImageData(w, h);
    PANO.pohled360(v360.src, v360.g, v360, { w, h, d: out.data });
    cx.putImageData(out, 0, 0);
    $('v360FovTxt').textContent = Math.round(v360.fov) + '°';
  });
}
function nastav360(src, g, popis) {
  v360.src = src; v360.g = g; v360.yaw = 0; v360.pitch = 0;
  $('v360Info').textContent = popis || '';
  kresli360();
}
function panoramaDo360() {
  if (!zarovnano || !KOULE(N.projekce)) return Dialog.info('Prohlížeč 360° ukáže složené sférické panorama – nejdřív složte fotky (projekce jiná než Rovina), nebo otevřete soubor.');
  if (pocitam) return Dialog.info('Počkejte, až doběhne výpočet.');
  pocitam = true;
  po360 = m => nastav360({ w: m.W, h: m.H, d: m.rgba }, m.gpano, `${m.W} × ${m.H} px náhled`);
  W().postMessage({ typ: 'equi360', nast: nastaveniProWorker() });
}
async function soubor360(f) {
  try {
    const bajty = new Uint8Array(await f.slice(0, 1 << 20).arrayBuffer()), g = PANO.ctiGPano(bajty);
    const bmp = await createImageBitmap(f), k = Math.min(1, 8192 / bmp.width, 4096 / bmp.height);
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); bmp.close();
    const src = { w: c.width, h: c.height, d: c.getContext('2d').getImageData(0, 0, c.width, c.height).data };
    const gk = g && { ...g, plnaW: g.plnaW * k, plnaH: g.plnaH * k, vlevo: g.vlevo * k, nahore: g.nahore * k };
    if (!g && Math.abs(c.width / c.height - 2) > 0.05) Dialog.info('Obrázek nemá metadata GPano ani poměr stran 2:1 – zobrazím ho jako celou kouli, může být zkreslený.');
    nastav360(src, gk, `${esc(f.name)}${g ? ' · GPano' : ''}`);
  } catch (e) { Dialog.chyba('Obrázek se nepodařilo otevřít.'); }
}
{
  const c = $('pl360');
  let t = null;
  c.addEventListener('pointerdown', e => { t = { x: e.clientX, y: e.clientY, yaw: v360.yaw, pitch: v360.pitch, id: e.pointerId }; c.setPointerCapture(e.pointerId); });
  c.addEventListener('pointermove', e => {
    if (!t || e.pointerId !== t.id) return;
    const s = v360.fov / c.getBoundingClientRect().width;
    v360.yaw = t.yaw - (e.clientX - t.x) * s; v360.pitch = Math.max(-89, Math.min(89, t.pitch + (e.clientY - t.y) * s));
    kresli360();
  });
  c.addEventListener('pointerup', () => { t = null; });
  c.addEventListener('wheel', e => { e.preventDefault(); v360.fov = Math.max(30, Math.min(120, v360.fov * (e.deltaY > 0 ? 1.08 : 1 / 1.08))); $('v360Fov').value = v360.fov; kresli360(); }, { passive: false });
  $('v360Fov').addEventListener('input', () => { v360.fov = +$('v360Fov').value; kresli360(); });
  $('dlg360').addEventListener('keydown', e => {
    const m = { ArrowLeft: [-5, 0], ArrowRight: [5, 0], ArrowUp: [0, -5], ArrowDown: [0, 5] }[e.key];
    if (!m || e.target.closest('input')) return;
    e.preventDefault(); v360.yaw += m[0]; v360.pitch = Math.max(-89, Math.min(89, v360.pitch + m[1])); kresli360();
  });
  $('v360Panorama').addEventListener('click', panoramaDo360);
  $('v360Soubor').addEventListener('click', () => $('soubor360').click());
  $('soubor360').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) soubor360(f); });
  addEventListener('resize', () => { if ($('dlg360').open) kresli360(); });
}
function otevri360() {
  $('dlg360').showModal();
  if (!v360.src && zarovnano && KOULE(N.projekce)) panoramaDo360(); else kresli360();
}

/* ---------- projekty: IndexedDB (i s fotkami), soubor .panorama, Hugin .pto ---------- */
const DB = { jmeno: 'webapp_panorama', sklad: 'projekty' };
function db() {
  return new Promise((ok, chyba) => {
    const r = indexedDB.open(DB.jmeno, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(DB.sklad, { keyPath: 'id', autoIncrement: true });
    r.onsuccess = () => ok(r.result); r.onerror = () => chyba(r.error);
  });
}
async function dbAkce(rezim, f) {
  const d = await db();
  return new Promise((ok, chyba) => {
    const t = d.transaction(DB.sklad, rezim), q = f(t.objectStore(DB.sklad));
    t.oncomplete = () => { d.close(); ok(q && q.result); }; t.onerror = () => { d.close(); chyba(t.error); };
  });
}
function stavProjektu() {
  return {
    nazev: projekt.nazev, cas: Date.now(), verze: 1,
    nastaveni: { projekce: N.projekce, model: N.model, ohnisko: N.ohnisko, ohniskoRezim: N.ohniskoRezim, zisky: N.zisky, vyrovnat: N.vyrovnat, orez: N.orez, prechod: N.prechod, prolnuti: N.prolnuti, sev: N.sev },
    kb: kb.map(z => ({ a: snimky.findIndex(s => s.id === z.a), b: snimky.findIndex(s => s.id === z.b), body: z.body })).filter(z => z.a >= 0 && z.b >= 0 && z.body.length),
    upravy: Object.fromEntries(Object.entries(upravy).map(([id, u]) => [snimky.findIndex(s => s.id === +id), u]).filter(([i]) => i >= 0)),
    pohled, mini: miniNahledu()
  };
}
function miniNahledu() {
  if (!nahled) return snimky[0] ? snimky[0].mini : '';
  const c = document.createElement('canvas'), k = 240 / nahled.W;
  c.width = 240; c.height = Math.max(1, Math.round(nahled.H * k));
  c.getContext('2d').drawImage($('platno'), 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.7);
}
async function ulozProjekt(jako) {
  if (!snimky.length) return Dialog.info('Projekt je prázdný – přidejte fotky.');
  if (jako || !projekt.id) {
    const n = await Dialog.zeptej('Název projektu', projekt.nazev || ('Panorama ' + new Date().toLocaleDateString('cs-CZ')));
    if (n == null) return;
    projekt.nazev = n.trim() || 'Panorama';
    if (jako) projekt.id = null;
  }
  const z = { ...stavProjektu(), fotky: snimky.map(s => ({ nazev: s.nazev, blob: s.soubor, exif: s.exif, pouzit: s.pouzit })) };
  if (projekt.id) z.id = projekt.id;
  try {
    ukazPrubeh('Ukládám projekt…', 0.5);
    projekt.id = await dbAkce('readwrite', st => st.put(z));
    zmeneno = false; $('prubeh').hidden = true;
    $('stavText').textContent = `Projekt „${projekt.nazev}" uložen v prohlížeči.`;
  } catch (e) { $('prubeh').hidden = true; Dialog.chyba('Projekt se nepodařilo uložit (málo místa v prohlížeči?): ' + (e && e.message || e)); }
}
async function seznamProjektu() {
  let vse = [];
  try { vse = await dbAkce('readonly', st => st.getAll()); } catch (e) { return Dialog.chyba('Úložiště prohlížeče není dostupné.'); }
  vse.sort((a, b) => b.cas - a.cas);
  $('seznamProj').innerHTML = vse.length ? vse.map(p => `<div class="proj"><img src="${p.mini || ''}" alt=""><div class="jm"><b>${esc(p.nazev)}</b><span>${p.fotky.length} fotek · ${new Date(p.cas).toLocaleString('cs-CZ')}</span></div>
    <button class="btn mini primary" type="button" data-otevri="${p.id}">Otevřít</button><button class="btn mini" type="button" data-smaz="${p.id}" aria-label="Smazat">🗑️</button></div>`).join('')
    : '<div style="color:var(--text-muted)">Zatím žádný uložený projekt.</div>';
  if (!$('dlgProjekty').open) $('dlgProjekty').showModal();
}
$('seznamProj').addEventListener('click', async e => {
  const o = e.target.closest('[data-otevri]'), s = e.target.closest('[data-smaz]');
  if (o) {
    if (zmeneno && snimky.length && !await Dialog.potvrd('Současný projekt má neuložené změny. Otevřít jiný?')) return;
    const p = await dbAkce('readonly', st => st.get(+o.dataset.otevri));
    $('dlgProjekty').close();
    nactiProjekt(p, p.fotky.map(f => ({ soubor: new File([f.blob], f.nazev, { type: f.blob.type }), ...f })), p.id);
  } else if (s && await Dialog.potvrd('Smazat projekt z prohlížeče?')) {
    await dbAkce('readwrite', st => st.delete(+s.dataset.smaz));
    if (projekt.id === +s.dataset.smaz) projekt.id = null;
    seznamProjektu();
  }
});
function vycisti() {
  stavPoVypoctu = '';
  snimky = []; aktivni = []; upravy = {}; kb = []; chyby = new Map(); zarovnano = null; nahled = null; vybrany = null;
  pohled = { yaw: 0, pitch: 0, roll: 0 }; hist.zpet = []; hist.znovu = []; tlacitkaHistorie(); vyplnPohled();
  $('info').hidden = true; $('kvalita').textContent = ''; $('tlOpt').disabled = true; $('tlBody').disabled = true;
  $('stavText').textContent = 'Žádné fotky.'; vykresliPas(); kresliNahled();
}
async function nactiProjekt(p, fotky, id) {
  vycisti();
  projekt = { id: id || null, nazev: p.nazev || '' };
  Object.assign(N, p.nastaveni || {}); ulozN(); vyplnNastaveni();
  for (const f of fotky) {
    try {
      const s = { id: dalsiId++, nazev: f.nazev, soubor: f.soubor, exif: f.exif || {}, pouzit: f.pouzit !== false };
      ukazPrubeh('Načítám ' + f.nazev, 0); await pripravNahled(s); snimky.push(s);
    } catch (e) { Dialog.chyba('Fotku ' + f.nazev + ' se nepodařilo načíst.'); }
  }
  const idPodle = i => snimky[i] && snimky[i].id;
  kb = (p.kb || []).map(z => ({ a: idPodle(z.a), b: idPodle(z.b), body: z.body })).filter(z => z.a && z.b);
  upravy = {};
  for (const [i, u] of Object.entries(p.upravy || {})) if (idPodle(+i)) upravy[idPodle(+i)] = u;
  pohled = p.pohled || { yaw: 0, pitch: 0, roll: 0 }; vyplnPohled();
  zmeneno = false; vykresliPas();
  $('stavText').textContent = `Projekt „${projekt.nazev}" načten.`;
  if (snimky.filter(s => s.pouzit).length >= 2) sloz(kb.length > 0);
}
async function exportProjekt() {
  if (!snimky.length) return Dialog.info('Projekt je prázdný.');
  ukazPrubeh('Připravuji soubor projektu…', 0.3);
  const fotky = [];
  for (const s of snimky) fotky.push({ nazev: s.nazev, exif: s.exif, pouzit: s.pouzit, typ: s.soubor.type, data: await new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(s.soubor); }) });
  const json = JSON.stringify({ format: 'panorama-projekt', ...stavProjektu(), fotky });
  $('prubeh').hidden = true;
  stahni(new Blob([json], { type: 'application/json' }), (projekt.nazev || 'panorama').replace(/[\\/:*?"<>|]+/g, '_') + '.panorama');
}
async function importProjekt(f) {
  try {
    const p = JSON.parse(await f.text());
    if (p.format !== 'panorama-projekt' || !Array.isArray(p.fotky)) throw new Error('neznámý formát');
    const fotky = await Promise.all(p.fotky.map(async x => ({ ...x, soubor: new File([await (await fetch(x.data)).blob()], x.nazev, { type: x.typ || 'image/jpeg' }) })));
    nactiProjekt(p, fotky, null);
  } catch (e) { Dialog.chyba('Soubor není projekt panoramatu: ' + (e && e.message || e)); }
}
function exportPto() {
  if (!zarovnano || !zarovnano.R || !nahled) return Dialog.info('Export pro Hugin potřebuje složené sférické panorama (projekce jiná než Rovina).');
  const Pm = PANO.nas(PANO.pohledU(pohled.yaw, pohled.pitch, pohled.roll), zarovnano.Rv);
  const obr = aktivni.map((id, i) => {
    const s = snimky.find(x => x.id === id), R = zarovnano.R[i];
    let Rp = R ? PANO.nas(R, PANO.tr(Pm)) : PANO.I3();
    if (R && upravy[id] && upravy[id].Q) Rp = PANO.nas(Rp, PANO.tr(upravy[id].Q));
    return { nazev: s.nazev, w: s.plnaW, h: s.plnaH, f: zarovnano.f[i], R: Rp };
  });
  const body = kbProWorker(false), hfov = N.projekce === 'equi' || N.projekce === 'valec' || N.projekce === 'mercator' ? nahled.plnyW / nahled.kPlny / PANO.RAD : 120;
  const t = PANO.pto(obr, body, { projekce: N.projekce, W: nahled.plnyW, H: nahled.plnyH, hfov: Math.min(360, hfov) });
  stahni(new Blob([t], { type: 'text/plain' }), (projekt.nazev || 'panorama').replace(/[\\/:*?"<>|]+/g, '_') + '.pto');
}
function stahni(blob, jmeno) {
  const a = document.createElement('a'), u = URL.createObjectURL(blob);
  a.href = u; a.download = jmeno; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 5000);
}

/* ---------- ukázky: vykreslená krajina (equirect) nafocená otáčející se kamerou ---------- */
function kresliKrajinu(W, H) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'), r = PANO.prng(42), hor = H * 0.5;
  // obtáčení: každý tvar se kreslí i posunutý o ±W
  const tri = f => { for (const s of [-W, 0, W]) { x.save(); x.translate(s, 0); f(); x.restore(); } };
  const nebe = x.createLinearGradient(0, 0, 0, hor);
  nebe.addColorStop(0, '#1d4f9c'); nebe.addColorStop(1, '#cfe3f5');
  x.fillStyle = nebe; x.fillRect(0, 0, W, hor);
  x.fillStyle = '#fff4c2'; x.beginPath(); x.arc(W * 0.62, H * 0.3, 30, 0, 7); x.fill();
  for (let i = 0; i < 60; i++) {
    const cx = r() * W, cy = H * (0.08 + r() * 0.36), sk = 0.6 + (cy / hor);
    const pa = []; for (let k = 0; k < 6; k++) pa.push([(r() - 0.5) * 90 * sk, (r() - 0.5) * 16 * sk, (30 + r() * 40) * sk, (10 + r() * 12) * sk]);
    const al = 0.55 + r() * 0.35;
    tri(() => { x.fillStyle = `rgba(255,255,255,${al})`; for (const [a, b, c2, d] of pa) { x.beginPath(); x.ellipse(cx + a, cy + b, c2, d, 0, 0, 7); x.fill(); } });
  }
  const hrbet = (zaklad, amp, barva, hrub) => {
    x.fillStyle = barva; x.beginPath(); x.moveTo(0, H);
    let y = zaklad, v = 0;
    const body = [];
    for (let i = 0; i <= W; i += 6) { v = v * 0.85 + (r() - 0.5) * hrub; y = Math.max(zaklad - amp, Math.min(zaklad + amp * 0.3, y + v)); body.push(y); }
    // konec navazuje na začátek (obtáčení 360°): rozdíl rozprostřít po celé délce
    const n = body.length - 1, rozdil = body[0] - body[n];
    for (let i = 0; i <= n; i++) body[i] += rozdil * i / n;
    body.forEach((yy, i) => x.lineTo(i * 6, yy)); x.lineTo(W, H); x.fill();
  };
  x.fillStyle = '#5d7a6a'; x.fillRect(0, hor - 4, W, H - hor + 4);   // podklad, aby pod hřbety nezůstal průhledný pruh
  hrbet(hor - 30, 90, '#8a9bb5', 9); hrbet(hor - 8, 60, '#5d7a6a', 8); hrbet(hor + 10, 30, '#4f7a3a', 6);
  x.fillStyle = '#6f9a48'; x.fillRect(0, hor + 22, W, H - hor - 22);
  const zem = x.createLinearGradient(0, hor + 22, 0, H); zem.addColorStop(0, 'rgba(0,0,0,0)'); zem.addColorStop(1, 'rgba(60,80,30,.6)');
  x.fillStyle = zem; x.fillRect(0, hor + 22, W, H - hor - 22);
  for (let i = 0; i < 900; i++) { const px = r() * W, py = hor + 30 + r() * (H - hor - 40), s = 2 + r() * 5; x.fillStyle = r() < 0.5 ? '#5d8a3a' : '#86b058'; x.fillRect(px, py, s, s * 0.6); }
  for (let i = 0; i < 4; i++) { const ex = r() * W, ey = hor + 60 + r() * 120, rx = 120 + r() * 160; tri(() => { x.fillStyle = '#5a8fc0'; x.beginPath(); x.ellipse(ex, ey, rx, rx * 0.15, 0, 0, 7); x.fill(); }); }
  for (let i = 0; i < 320; i++) {
    const tx = r() * W, ty = hor + 24 + r() * (H * 0.3), s = 8 + 30 * ((ty - hor) / (H * 0.3)), zel = r() < 0.5 ? '#2f5d2a' : '#3e7a34';
    tri(() => { x.fillStyle = '#5b3a1e'; x.fillRect(tx - s * 0.08, ty, s * 0.16, s * 0.4); x.fillStyle = zel; x.beginPath(); x.moveTo(tx, ty - s * 1.4); x.lineTo(tx - s * 0.55, ty + s * 0.05); x.lineTo(tx + s * 0.55, ty + s * 0.05); x.fill(); });
  }
  for (let i = 0; i < 40; i++) {
    const hx = r() * W, hy = hor + 40 + r() * H * 0.2, s = 22 + r() * 26, bar = i % 3;
    tri(() => {
      x.fillStyle = ['#e8dcc0', '#f2efe8', '#d9b48a'][bar]; x.fillRect(hx, hy - s * 0.7, s * 1.3, s * 0.7);
      x.fillStyle = ['#a33b2b', '#6b4b3a', '#8a2f2f'][bar]; x.beginPath(); x.moveTo(hx - 4, hy - s * 0.7); x.lineTo(hx + s * 0.65, hy - s * 1.25); x.lineTo(hx + s * 1.3 + 4, hy - s * 0.7); x.fill();
      x.fillStyle = '#33414f'; x.fillRect(hx + s * 0.2, hy - s * 0.5, s * 0.25, s * 0.25); x.fillRect(hx + s * 0.8, hy - s * 0.5, s * 0.25, s * 0.25);
    });
  }
  // jemná struktura (kamínky, listí, chomáče v oblacích) – skutečné fotky mají detailů dost, kreslená krajina ne
  for (let i = 0; i < 60000; i++) {
    const px = r() * W, py = r() * H, s = 1 + r() * 3, nad = py < hor;
    x.fillStyle = nad ? `rgba(255,255,255,${0.05 + r() * 0.12})` : (r() < 0.5 ? `rgba(30,40,20,${0.15 + r() * 0.25})` : `rgba(230,220,170,${0.1 + r() * 0.2})`);
    x.fillRect(px, py, s, s);
  }
  x.fillStyle = '#ddd'; x.fillRect(W * 0.8, hor - 90, 22, 120); x.beginPath(); x.moveTo(W * 0.8 - 4, hor - 90); x.lineTo(W * 0.8 + 11, hor - 150); x.lineTo(W * 0.8 + 26, hor - 90); x.fillStyle = '#7a2f25'; x.fill();
  return x.getImageData(0, 0, W, H);
}
async function ukazkaZ(pozice, w, h, f, nazev) {
  if (snimky.length && !await Dialog.potvrd('Nahradit současné fotky ukázkou?')) return false;
  vycisti(); projekt = { id: null, nazev };
  ukazPrubeh('Kreslím ukázkovou krajinu…', 0);
  await new Promise(r => setTimeout(r, 30));
  const tex = kresliKrajinu(4096, 2048), t = { w: tex.width, h: tex.height, d: tex.data }, soubory = [];
  const rnd = PANO.prng(7);
  for (let j = 0; j < pozice.length; j++) {
    const [yaw, pitch] = pozice[j];
    ukazPrubeh('Fotím ukázkový snímek ' + (j + 1), j / pozice.length);
    await new Promise(r => setTimeout(r, 0));
    const R = PANO.rotKamery(yaw + (rnd() - 0.5) * 2, pitch + (rnd() - 0.5) * 2, (rnd() - 0.5) * 2);
    const im = PANO.pohledZKoule(t, f, R, w, h, 0.92 + rnd() * 0.16);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').putImageData(new ImageData(im.d, w, h), 0, 0);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.92));
    soubory.push(new File([blob], `ukazka_${String(j + 1).padStart(2, '0')}.jpg`, { type: 'image/jpeg' }));
  }
  // zamíchat pořadí; ohnisko dodáme místo EXIFu
  soubory.sort(() => rnd() - 0.5);
  await pridejSoubory(soubory, { ohnisko35: PANO.ekv35(w, h, f) });
  return true;
}
const ukazka = () => ukazkaZ([-100, -60, -20, 20, 60, 100].map(y => [y, 0]), 900, 600, 700, 'Ukázka – řada').then(ok => { if (!ok) return; setN('projekce', 'valec'); return sloz(); });
const ukazka360 = () => ukazkaZ([...Array.from({ length: 7 }, (_, i) => [i * 360 / 7, -22]), ...Array.from({ length: 7 }, (_, i) => [i * 360 / 7 + 25, 22])], 640, 480, 380, 'Ukázka – 360°')
  .then(ok => { if (!ok) return; setN('projekce', 'equi'); return sloz(); });

/* ---------- nabídky, příkazy, zkratky ---------- */
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
const PRIKAZY = {
  pridat: () => $('soubory').click(),
  ukazka, ukazka360,
  novy: async () => { if (snimky.length && zmeneno && !await Dialog.potvrd('Zahodit neuložené změny a začít nový projekt?')) return; vycisti(); projekt = { id: null, nazev: '' }; zmeneno = false; },
  otevrit: seznamProjektu,
  ulozit: () => ulozProjekt(false),
  ulozitJako: () => ulozProjekt(true),
  exportProjekt, importProjekt: () => $('souborProjekt').click(), exportPto,
  odebratVse: async () => {
    if (!snimky.length || !await Dialog.potvrd('Odebrat všechny fotky z panoramatu?')) return;
    vycisti();
  },
  sloz, optimalizuj: () => optimalizuj(true),
  body: () => otevriBody(),
  vyrovnat,
  export: () => { if (!nahled) return; moznostiMeritka(); $('eVysledek').hidden = true; $('eStahnout').hidden = true; $('eDo360').hidden = true; $('dlgExport').showModal(); },
  prohlizec: otevri360,
  napoveda: () => $('dlgNavod').showModal(),
  zpet: () => obnov(hist.zpet, hist.znovu),
  znovu: () => obnov(hist.znovu, hist.zpet),
  uprava: b => {
    const [co, s] = b.dataset.u.split(',');
    if (co === 'nula') { if (vybrany && upravy[vybrany]) { zapamatuj(); delete upravy[vybrany]; prekresli(); vykresliPas(); } return; }
    uprav(co, +s);
  },
  nulaVse: () => { if (!Object.keys(upravy).length) return; zapamatuj(); upravy = {}; prekresli(); vykresliPas(); }
};
document.addEventListener('click', async e => {
  const p = e.target.closest('[data-prikaz]');
  if (p) {
    const vNabidce = p.closest('.nabidka');
    e.stopPropagation();
    if (!vNabidce || p.dataset.prikaz !== 'uprava') zavriNabidky();
    return PRIKAZY[p.dataset.prikaz](p);
  }
  if (!e.target.closest('.nabidka')) zavriNabidky();
  const r = e.target.closest('tr[data-dvojice]');
  if (r) { const [a, b] = r.dataset.dvojice.split(',').map(Number); return otevriBody(a, b); }
  const od = e.target.closest('[data-odeber]');
  if (od) {
    const id = +od.dataset.odeber;
    snimky = snimky.filter(s => s.id !== id); delete upravy[id]; kb = kb.filter(r => r.a !== id && r.b !== id); oznacZmenu();
    if (vybrany === id) vybrany = null;
    $('stavText').textContent = 'Snímek odebrán – klikněte na ▶ Složit.';
    vykresliPas(); return;
  }
  const k = e.target.closest('[data-karta]');
  if (k && !e.target.closest('input,label')) { vybrany = +k.dataset.karta; vykresliPas(); kresliVrstvu(); }
});
$('pas').addEventListener('change', e => {
  const c = e.target.closest('[data-pouzit]');
  if (!c) return;
  const s = snimky.find(x => x.id === +c.dataset.pouzit);
  s.pouzit = !c.checked; zapamatuj(); s.pouzit = c.checked; vykresliPas();
  $('stavText').textContent = 'Výběr snímků se změnil – klikněte na ▶ Složit.';
});
$('soubory').addEventListener('change', e => { const f = [...e.target.files]; e.target.value = ''; if (f.length) pridejSoubory(f); });
$('souborProjekt').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) importProjekt(f); });
const PROJ_KLAVESY = { 1: 'valec', 2: 'equi', 3: 'mercator', 4: 'stereo', 5: 'primo', 6: 'rovina' };
document.addEventListener('keydown', e => {
  const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
  if (ctrl && k === 's') { e.preventDefault(); return ulozProjekt(e.shiftKey); }
  if (ctrl && k === 'o') { e.preventDefault(); return seznamProjektu(); }
  if (ctrl && k === 'i') { e.preventDefault(); return $('soubory').click(); }
  if (document.querySelector('dialog[open]') || e.target.closest('input,select,textarea')) return;
  if (ctrl && k === 'z' && !e.shiftKey) { e.preventDefault(); return PRIKAZY.zpet(); }
  if (ctrl && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); return PRIKAZY.znovu(); }
  if (ctrl && e.key === 'Enter') { e.preventDefault(); return sloz(); }
  if (ctrl || e.altKey) return;
  if (e.key === 'F1' || e.key === '?') { e.preventDefault(); return PRIKAZY.napoveda(); }
  if (k === 'o') return optimalizuj(true);
  if (k === 'k') return zarovnano && otevriBody();
  if (k === 'h') return vyrovnat();
  if (k === 'e') return PRIKAZY.export();
  if (k === 'v') return otevri360();
  if (PROJ_KLAVESY[e.key]) return setN('projekce', PROJ_KLAVESY[e.key], true);
  if (!vybrany || !nahled) return;
  const n = e.shiftKey ? 10 : 1, mapa = { ArrowLeft: ['dx', -1], ArrowRight: ['dx', 1], ArrowUp: ['dy', -1], ArrowDown: ['dy', 1], '[': ['uhel', -1], ']': ['uhel', 1] };
  const a = mapa[e.key];
  if (a) { e.preventDefault(); uprav(a[0], a[1], n / 5); }
});
// přetažení souborů
['dragenter', 'dragover'].forEach(t => document.addEventListener(t, e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { e.preventDefault(); document.body.classList.add('tazeni'); } }));
['dragleave', 'drop'].forEach(t => document.addEventListener(t, e => { if (t === 'dragleave' && e.relatedTarget) return; document.body.classList.remove('tazeni'); }));
document.addEventListener('drop', e => {
  e.preventDefault();
  const f = [...(e.dataTransfer && e.dataTransfer.files || [])];
  const proj = f.find(x => /\.panorama$/i.test(x.name));
  if (proj) return importProjekt(proj);
  if (f.length) pridejSoubory(f);
});
addEventListener('beforeunload', e => { if (zmeneno && snimky.length) { e.preventDefault(); e.returnValue = ''; } });

/* ---------- nastavení ---------- */
const POLE = { nProjekce: 'projekce', nModel: 'model', nOhnisko: 'ohnisko', nOhniskoRezim: 'ohniskoRezim', nNahled: 'nahled', nBody: 'body', nZisky: 'zisky', nVyrovnat: 'vyrovnat',
  nOrez: 'orez', nObrysy: 'obrysy', nPrechod: 'prechod', nProlnuti: 'prolnuti', nSev: 'sev', nDoladit: 'doladit' };
function vyplnNastaveni() {
  for (const [id, kl] of Object.entries(POLE)) { const el = $(id); if (el.type === 'checkbox') el.checked = !!N[kl]; else el.value = N[kl]; }
  $('nPrechodTxt').textContent = N.prechod + ' %';
  $('nPrechodPole').hidden = N.prolnuti !== 'linear';
}
/* změna nastavení a co po ní přepočítat */
function setN(kl, hodnota, zUI) {
  const pred = N[kl];
  N[kl] = hodnota; ulozN(); vyplnNastaveni();
  if (zUI === undefined) return;
  if (kl === 'obrysy') return kresliVrstvu();
  if (kl === 'doladit') return;
  if (kl === 'projekce') {
    if (KOULE(pred) !== KOULE(hodnota)) { if (zarovnano) { upravy = {}; sloz(); } return; }
    if (hodnota === 'stereo' && pred !== 'stereo') { pohled = { ...pohled, pitch: 0 }; vyplnPohled(); }
    return prekresli();
  }
  if (['zisky', 'orez', 'prechod', 'prolnuti', 'sev'].includes(kl)) return prekresli();
  if (['vyrovnat', 'ohniskoRezim'].includes(kl)) return zarovnano && optimalizuj(kl === 'vyrovnat');
  if (kl === 'ohnisko') vykresliPas();
  if (zarovnano) $('stavText').textContent = 'Nastavení se změnilo – klikněte na ▶ Složit.';
}
for (const [id, kl] of Object.entries(POLE)) {
  const el = $(id);
  el.addEventListener(el.type === 'range' ? 'input' : 'change', () => setN(kl, el.type === 'checkbox' ? el.checked : el.type === 'range' ? +el.value : el.value, true));
}
vyplnNastaveni(); vyplnPohled();
$('eMeritko').addEventListener('change', odhad);
$('eVytvorit').addEventListener('click', exportuj);
$('eDo360').addEventListener('click', async () => {
  if (!posledniVysledek) return;
  $('dlgExport').close();
  $('dlg360').showModal();
  await soubor360(new File([posledniVysledek.blob], 'panorama.jpg', { type: posledniVysledek.blob.type }));
});
$('dlgExport').addEventListener('close', () => { if (urlVysledku && !$('dlg360').open) { URL.revokeObjectURL(urlVysledku); urlVysledku = null; } });
addEventListener('resize', () => kresliVrstvu());
vykresliPas();

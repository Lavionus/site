/* ============================================================
   pozadi/stranka.js – uživatelské rozhraní Odstranění pozadí.
   Výpočty jsou v jadro.js (window.POZADI), tady jen plátno, nástroje,
   AI model (onnxruntime-web, wasm) a výstup.
   ============================================================ */
(function () {
'use strict';
const P = window.POZADI;
const $ = id => document.getElementById(id);
const KLIC = 'webapp_pozadi_nastaveni';
const ONNX = 'lib/onnx/';
const VELIKOST_WASM = 11210254, VELIKOST_MODELU = 4574861;   // pro průběh, když server nepošle délku

// ---------- nastavení ----------
const VYCHOZI = {
  aiZjemnit: true, aiOstrovy: true, aiOstrost: 30,
  chBarva: '#14c81e', chTol: 40, chMek: 25, chPresvit: 70,
  stVel: 30, stTvr: 60, huTol: 28, huRezim: 'odebrat', huSouvisle: true,
  hrPosun: -1, hrFeather: 2,
  vyPozadi: 'pruhledne', vyBarva: '#ffffff', vyRozm: 18, vyOrez: false, vyOkraj: 20,
  vyStin: false, vyStinRozm: 24, vyStinX: 8, vyStinY: 14, vyStinPruh: 45, vyFormat: 'png', vyKval: 92,
};
let nast = { ...VYCHOZI };
try { Object.assign(nast, JSON.parse(localStorage.getItem(KLIC) || '{}')); } catch (e) { /* poškozené nastavení – výchozí */ }
const ulozNast = () => { try { localStorage.setItem(KLIC, JSON.stringify(nast)); } catch (e) { /* plné úložiště */ } };

// ---------- stav ----------
const S = {
  w: 0, h: 0, nazev: 'obrazek', orig: null, maska: null,
  zdroj: null, vyrez: null, vyrezCtx: null, nahled: null, nahledCtx: null, nahledPlatny: false,
  zpet: [], vpred: [], zobraz: 'vysledek', nastroj: 'obnovit',
  zoom: 1, ox: 0, oy: 0, mys: null, mezernik: false,
  chromaPouzito: false, chromaZivy: false, bbox: undefined,
  vlastniPozadi: null, rozmazane: null, rozmazaneKlic: '', ai: null,
};
const platno = $('platno'), ctx = platno.getContext('2d'), plocha = $('plocha');

// ---------- načtení obrázku ----------
async function nactiObrazek(zdroj, nazev) {
  let bmp;
  try { bmp = zdroj instanceof ImageBitmap ? zdroj : await createImageBitmap(zdroj); }
  catch (e) { Dialog.chyba('Obrázek se nepodařilo načíst (nepodporovaný formát?).'); return; }
  const v = P.pracovniVelikost(bmp.width, bmp.height);
  const c = document.createElement('canvas'); c.width = v.w; c.height = v.h;
  const cx = c.getContext('2d', { willReadFrequently: true });
  cx.drawImage(bmp, 0, 0, v.w, v.h);
  S.w = v.w; S.h = v.h; S.zdroj = c; S.orig = cx.getImageData(0, 0, v.w, v.h);
  S.maska = new Uint8Array(v.w * v.h).fill(255);
  S.nazev = (nazev || 'obrazek').replace(/\.[^.]+$/, '') || 'obrazek';
  S.zpet = []; S.vpred = []; S.chromaPouzito = false; S.chromaZivy = false; S.rozmazane = null;
  S.vyrez = document.createElement('canvas'); S.vyrez.width = v.w; S.vyrez.height = v.h; S.vyrezCtx = S.vyrez.getContext('2d');
  S.nahled = document.createElement('canvas'); S.nahled.width = v.w; S.nahled.height = v.h; S.nahledCtx = S.nahled.getContext('2d');
  $('prazdno').hidden = true; $('stav').hidden = false;
  obnov(); prizpusob(); tlacitkaHistorie();
  if (v.zmenseno) Dialog.info(`Obrázek je velký (${bmp.width}×${bmp.height}), pracuje se v ${v.w}×${v.h} px.`);
}
const maObraz = () => { if (S.orig) return true; Dialog.info('Nejdřív otevřete obrázek.'); return false; };

// ---------- vrstvy ----------
/** Přepočet vrstvy výsledku (a náhledu masky) v obdélníku b. */
function obnov(b) {
  if (!S.orig) return;
  b = b ? orizni(b) : { x: 0, y: 0, w: S.w, h: S.h };
  S.bbox = undefined;
  if (!b) return prekresli();
  const o = S.orig.data, m = S.maska, w = S.w;
  const klic = S.chromaPouzito && nast.chPresvit > 0 ? P.hexNaRgb(nast.chBarva) : null, sila = nast.chPresvit / 100;
  const id = new ImageData(b.w, b.h), d = id.data;
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
    const i = (y + b.y) * w + x + b.x, j = (y * b.w + x) * 4, k = i * 4;
    let r = o[k], g = o[k + 1], bl = o[k + 2];
    if (klic && m[i]) [r, g, bl] = P.odstranPresvit(r, g, bl, klic, sila);
    d[j] = r; d[j + 1] = g; d[j + 2] = bl; d[j + 3] = m[i];
  }
  S.vyrezCtx.putImageData(id, b.x, b.y);
  if (S.zobraz === 'maska' || S.zobraz === 'prekryv') obnovNahled(S.nahledPlatny ? b : null);
  else S.nahledPlatny = false;
  prekresli();
}
function obnovNahled(b) {
  b = b || { x: 0, y: 0, w: S.w, h: S.h };
  const o = S.orig.data, m = S.maska, w = S.w, maska = S.zobraz === 'maska';
  const id = new ImageData(b.w, b.h), d = id.data;
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
    const i = (y + b.y) * w + x + b.x, j = (y * b.w + x) * 4, k = i * 4;
    if (maska) { d[j] = d[j + 1] = d[j + 2] = m[i]; }
    else {   // překryv: pozadí přebarvené červeně
      const a = m[i] / 255, c = 1 - a;
      d[j] = o[k] * a + (o[k] * 0.4 + 255 * 0.6) * c;
      d[j + 1] = o[k + 1] * a + o[k + 1] * 0.4 * c;
      d[j + 2] = o[k + 2] * a + o[k + 2] * 0.4 * c;
    }
    d[j + 3] = 255;
  }
  S.nahledCtx.putImageData(id, b.x, b.y);
  S.nahledPlatny = true;
}
function orizni(b) {
  const x0 = Math.max(0, Math.floor(b.x)), y0 = Math.max(0, Math.floor(b.y));
  const x1 = Math.min(S.w, Math.ceil(b.x + b.w)), y1 = Math.min(S.h, Math.ceil(b.y + b.h));
  return x1 > x0 && y1 > y0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
}
function vystupniObdelnik() {
  if (!nast.vyOrez) return { x: 0, y: 0, w: S.w, h: S.h };
  if (S.bbox === undefined) S.bbox = P.vystupniObdelnik(S.maska, S.w, S.h, true, Math.max(0, +nast.vyOkraj || 0));
  return S.bbox;
}

// ---------- pozadí výstupu ----------
function rozmazaneCanvas() {
  const klic = nast.vyRozm + '|' + S.w;
  if (S.rozmazane && S.rozmazaneKlic === klic) return S.rozmazane;
  const k = Math.min(1, 1024 / Math.max(S.w, S.h));
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(S.w * k)); c.height = Math.max(1, Math.round(S.h * k));
  const cx = c.getContext('2d'), r = nast.vyRozm / 1000 * Math.max(c.width, c.height);
  cx.drawImage(S.zdroj, 0, 0, c.width, c.height);              // podklad – okraje po rozmazání neztmavnou
  if ('filter' in cx) { cx.filter = `blur(${r}px)`; cx.drawImage(S.zdroj, 0, 0, c.width, c.height); cx.filter = 'none'; }
  else {                                                         // Safari bez ctx.filter: rozmazání zmenšením
    const t = document.createElement('canvas'); t.width = Math.max(1, Math.round(c.width / r)); t.height = Math.max(1, Math.round(c.height / r));
    t.getContext('2d').drawImage(S.zdroj, 0, 0, t.width, t.height);
    cx.imageSmoothingQuality = 'high'; cx.drawImage(t, 0, 0, c.width, c.height);
  }
  S.rozmazane = c; S.rozmazaneKlic = klic;
  return c;
}
/** Nakreslí zvolené pozadí do obdélníku r (souřadnice obrázku). */
function kresliPozadi(cx, r) {
  if (nast.vyPozadi === 'barva') { cx.fillStyle = nast.vyBarva; cx.fillRect(r.x, r.y, r.w, r.h); }
  else if (nast.vyPozadi === 'rozmazane') {
    const x0 = Math.min(0, r.x), y0 = Math.min(0, r.y);
    cx.drawImage(rozmazaneCanvas(), x0, y0, Math.max(S.w, r.x + r.w) - x0, Math.max(S.h, r.y + r.h) - y0);
  } else if (nast.vyPozadi === 'obrazek' && S.vlastniPozadi) {
    const b = S.vlastniPozadi, k = Math.max(r.w / b.width, r.h / b.height);   // vyplnit (cover)
    cx.drawImage(b, r.x + (r.w - b.width * k) / 2, r.y + (r.h - b.height * k) / 2, b.width * k, b.height * k);
  }
}
const pruhledne = () => nast.vyPozadi === 'pruhledne' || (nast.vyPozadi === 'obrazek' && !S.vlastniPozadi);
/** Vyřez se stínem; meritko = kolik pixelů plátna na pixel obrázku (stín se transformací neškáluje). */
function kresliVyrez(cx, meritko) {
  if (nast.vyStin) {
    const d = Math.max(S.w, S.h) / 1000 * meritko;
    cx.save();
    cx.shadowColor = `rgba(0,0,0,${nast.vyStinPruh / 100})`;
    cx.shadowBlur = nast.vyStinRozm * d; cx.shadowOffsetX = nast.vyStinX * d; cx.shadowOffsetY = nast.vyStinY * d;
    cx.drawImage(S.vyrez, 0, 0);
    cx.restore();
  } else cx.drawImage(S.vyrez, 0, 0);
}

// ---------- kreslení plátna ----------
let snimek = 0;
function prekresli() { if (!snimek) snimek = requestAnimationFrame(kresli); }
let vzorek = null;
function sachovnice() {
  if (vzorek) return vzorek;
  const c = document.createElement('canvas'); c.width = c.height = 16;
  const x = c.getContext('2d');
  x.fillStyle = '#cfcfcf'; x.fillRect(0, 0, 16, 16); x.fillStyle = '#9a9a9a'; x.fillRect(0, 0, 8, 8); x.fillRect(8, 8, 8, 8);
  return (vzorek = ctx.createPattern(c, 'repeat'));
}
function kresli() {
  snimek = 0;
  const dpr = window.devicePixelRatio || 1, cw = plocha.clientWidth, ch = plocha.clientHeight;
  if (platno.width !== Math.round(cw * dpr) || platno.height !== Math.round(ch * dpr)) { platno.width = Math.round(cw * dpr); platno.height = Math.round(ch * dpr); }
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, platno.width, platno.height);
  if (!S.orig) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const z = S.zoom;
  if (S.zobraz === 'vysledek') {
    const r = vystupniObdelnik();
    if (pruhledne()) {
      ctx.fillStyle = sachovnice();
      ctx.fillRect(S.ox + r.x * z, S.oy + r.y * z, r.w * z, r.h * z);
    }
  }
  ctx.save();
  ctx.translate(S.ox, S.oy); ctx.scale(z, z);
  ctx.imageSmoothingEnabled = z < 2;
  if (S.zobraz === 'original') ctx.drawImage(S.zdroj, 0, 0);
  else if (S.zobraz === 'maska' || S.zobraz === 'prekryv') {
    if (!S.nahledPlatny) obnovNahled();
    ctx.drawImage(S.nahled, 0, 0);
  } else {
    const r = vystupniObdelnik();
    ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
    if (!pruhledne()) kresliPozadi(ctx, r);
    kresliVyrez(ctx, z * dpr);
    ctx.restore();
    if (nast.vyOrez) {
      ctx.setLineDash([6 / z, 4 / z]); ctx.lineWidth = 1 / z; ctx.strokeStyle = 'rgba(128,128,128,.9)';
      ctx.strokeRect(r.x, r.y, r.w, r.h); ctx.setLineDash([]);
    }
  }
  ctx.restore();
  // kurzor štětce
  if (S.mys && (S.nastroj === 'obnovit' || S.nastroj === 'vymazat') && !S.mezernik) {
    const r = nast.stVel / 2 * z;
    ctx.beginPath(); ctx.arc(S.mys.x, S.mys.y, Math.max(1, r), 0, Math.PI * 2);
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.stroke();
    ctx.lineWidth = 0.8; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.stroke();
  }
  const jmena = { posun: 'posun', obnovit: 'obnovit', vymazat: 'vymazat', hulka: 'hůlka', kapatko: 'kapátko' };
  $('stav').textContent = `${S.w}×${S.h} px · ${Math.round(z * 100)} % · ${jmena[S.nastroj]}`;
}

// ---------- pohled ----------
function prizpusob() {
  if (!S.orig) return;
  const cw = plocha.clientWidth, ch = plocha.clientHeight, okraj = 24;
  S.zoom = Math.min((cw - okraj * 2) / S.w, (ch - okraj * 2) / S.h, 4);
  if (!(S.zoom > 0)) S.zoom = 0.1;
  S.ox = (cw - S.w * S.zoom) / 2; S.oy = (ch - S.h * S.zoom) / 2;
  prekresli();
}
function zoomNa(z, sx, sy) {
  if (!S.orig) return;
  z = Math.min(32, Math.max(0.02, z));
  if (sx === undefined) { sx = plocha.clientWidth / 2; sy = plocha.clientHeight / 2; }
  S.ox = sx - (sx - S.ox) * z / S.zoom; S.oy = sy - (sy - S.oy) * z / S.zoom; S.zoom = z;
  prekresli();
}
const naObraz = (sx, sy) => ({ x: (sx - S.ox) / S.zoom, y: (sy - S.oy) / S.zoom });

// ---------- historie ----------
function zapamatuj() {
  S.zpet.push(S.maska.slice());
  const max = P.hloubkaHistorie(S.w, S.h);
  while (S.zpet.length > max) S.zpet.shift();
  S.vpred = []; S.chromaZivy = false;
  tlacitkaHistorie();
}
function zpet() {
  if (!S.zpet.length) return;
  S.vpred.push(S.maska); S.maska = S.zpet.pop(); S.chromaZivy = false; obnov(); tlacitkaHistorie();
}
function znovu() {
  if (!S.vpred.length) return;
  S.zpet.push(S.maska); S.maska = S.vpred.pop(); S.chromaZivy = false; obnov(); tlacitkaHistorie();
}
function tlacitkaHistorie() { $('tlZpet').disabled = !S.zpet.length; $('tlZnovu').disabled = !S.vpred.length; }
/** Operace nad celou maskou s historií. */
async function operace(text, fn) {
  if (!maObraz()) return;
  await prace(text, () => { zapamatuj(); S.maska = fn(S.maska); obnov(); });
}
async function prace(text, fn) {
  $('praceText').textContent = text; $('praceInfo').hidden = false;
  await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
  try { return await fn(); } finally { $('praceInfo').hidden = true; }
}

// ---------- AI model ----------
async function stahni(url, ocek, prubeh) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  const celkem = +r.headers.get('content-length') || ocek;
  if (!r.body) { const b = new Uint8Array(await r.arrayBuffer()); prubeh(b.length, celkem); return b; }
  const cteni = r.body.getReader(), kusy = []; let n = 0;
  for (;;) {
    const { done, value } = await cteni.read();
    if (done) break;
    kusy.push(value); n += value.length; prubeh(n, celkem);
  }
  const ven = new Uint8Array(n); let o = 0;
  for (const k of kusy) { ven.set(k, o); o += k.length; }
  return ven;
}
function nactiSkript(src) {
  return new Promise((ok, chyba) => {
    const s = document.createElement('script'); s.src = src; s.onload = ok;
    s.onerror = () => chyba(new Error('Nepodařilo se načíst ' + src)); document.head.appendChild(s);
  });
}
function aiStav(text, podil) {
  $('aiPrubeh').hidden = false; $('aiStav').textContent = text;
  if (podil !== undefined) $('aiPruh').style.width = Math.round(podil * 100) + '%';
}
async function pripravAi() {
  if (S.ai) return S.ai;
  $('sekAi').open = true;
  if (!window.ort) { aiStav('Načítám běhové prostředí…', 0); await nactiSkript(ONNX + 'ort.wasm.min.js'); }
  let a = 0, b = 0;
  const mb = x => (x / 1048576).toFixed(1).replace('.', ',');
  const ukaz = () => aiStav(`Stahuji model a prostředí: ${mb(a + b)} / ${mb(VELIKOST_WASM + VELIKOST_MODELU)} MB`, (a + b) / (VELIKOST_WASM + VELIKOST_MODELU));
  const [wasm, model] = await Promise.all([
    stahni(ONNX + 'ort-wasm-simd-threaded.wasm', VELIKOST_WASM, n => { a = n; ukaz(); }),
    stahni(ONNX + 'u2netp.onnx', VELIKOST_MODELU, n => { b = n; ukaz(); }),
  ]);
  aiStav('Spouštím model…', 1);
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.wasmPaths = new URL(ONNX, location.href).href;
  ort.env.wasm.wasmBinary = wasm.buffer;
  S.ai = await ort.InferenceSession.create(model, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
  return S.ai;
}
async function spustAi() {
  if (!maObraz()) return;
  let ses;
  try { ses = await pripravAi(); }
  catch (e) { console.error(e); aiStav('Chyba: ' + e.message); Dialog.chyba('AI model se nepodařilo načíst: ' + e.message); return; }
  await prace('✨ Hledám objekt…', async () => {
    const t0 = performance.now(), S320 = 320;
    aiStav('Počítám masku…', 1);
    const vstup = new ort.Tensor('float32', P.tenzor(S.orig.data, S.w, S.h, S320), [1, 3, S320, S320]);
    const vysl = await ses.run({ [ses.inputNames[0]]: vstup });
    const mala = P.normalizujMasku(vysl[ses.outputNames[0]].data);
    let m = nast.aiZjemnit ? P.zjemniPodleObrazu(S.orig.data, S.w, S.h, mala, S320, S320) : P.prevzorkujMasku(mala, S320, S320, S.w, S.h);
    if (nast.aiOstrost > 0) { const k = nast.aiOstrost * 1.2; m = P.urovne(m, k, 255 - k); }
    if (nast.aiOstrovy) m = P.vycistiOstrovy(m, S.w, S.h, Math.max(16, Math.round(S.w * S.h * 0.0005)));
    zapamatuj(); S.maska = m; obnov();
    aiStav(`Hotovo za ${((performance.now() - t0) / 1000).toFixed(1).replace('.', ',')} s. Doladit můžete štětcem.`, 1);
  });
}

// ---------- klíčování barvou ----------
function chromaMaska() { return P.chromaKlic(S.orig.data, S.w, S.h, P.hexNaRgb(nast.chBarva), nast.chTol, nast.chMek); }
async function pouzijChroma() {
  if (!maObraz()) return;
  await prace('🟩 Klíčuji…', () => { zapamatuj(); S.maska = chromaMaska(); S.chromaPouzito = true; S.chromaZivy = true; obnov(); });
}
let casChroma = 0;
function chromaZive(presvitJen) {
  if (!S.orig || !(S.chromaZivy || (presvitJen && S.chromaPouzito))) return;
  clearTimeout(casChroma);
  casChroma = setTimeout(() => { if (S.chromaZivy && !presvitJen) S.maska = chromaMaska(); obnov(); }, 120);
}

// ---------- výstup ----------
function vytvorVystup() {
  const r = vystupniObdelnik();
  const c = document.createElement('canvas'); c.width = r.w; c.height = r.h;
  const cx = c.getContext('2d');
  cx.translate(-r.x, -r.y);
  if (nast.vyFormat === 'jpeg' && pruhledne()) { cx.fillStyle = '#ffffff'; cx.fillRect(r.x, r.y, r.w, r.h); }
  if (!pruhledne()) kresliPozadi(cx, r);
  kresliVyrez(cx, 1);
  return c;
}
const naBlob = (c, typ, q) => new Promise((ok, chyba) => c.toBlob(b => b ? ok(b) : chyba(new Error('Prohlížeč neumí ' + typ)), typ, q));
function stahniBlob(b, jmeno) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = jmeno;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
async function ulozit() {
  if (!maObraz()) return;
  await prace('💾 Ukládám…', async () => {
    const typ = 'image/' + nast.vyFormat;
    try {
      const b = await naBlob(vytvorVystup(), typ, nast.vyKval / 100);
      if (b.type !== typ) Dialog.info('Prohlížeč formát nepodporuje, ukládám PNG.');
      stahniBlob(b, `${S.nazev}-bez-pozadi.${b.type.split('/')[1]}`);
    } catch (e) { Dialog.chyba('Uložení selhalo: ' + e.message); }
  });
}
async function kopirovat() {
  if (!maObraz()) return;
  try {
    const b = await naBlob(vytvorVystup(), 'image/png');
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]);
    Dialog.info('Výsledek je ve schránce (PNG).');
  } catch (e) { Dialog.chyba('Kopírování do schránky prohlížeč nepovolil.'); }
}
async function ulozitMasku() {
  if (!maObraz()) return;
  const c = document.createElement('canvas'); c.width = S.w; c.height = S.h;
  const cx = c.getContext('2d'), id = cx.createImageData(S.w, S.h);
  for (let i = 0; i < S.maska.length; i++) { id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = S.maska[i]; id.data[i * 4 + 3] = 255; }
  cx.putImageData(id, 0, 0);
  stahniBlob(await naBlob(c, 'image/png'), `${S.nazev}-maska.png`);
}
async function nactiMasku(soubor) {
  if (!maObraz()) return;
  try {
    const bmp = await createImageBitmap(soubor);
    const c = document.createElement('canvas'); c.width = S.w; c.height = S.h;
    const cx = c.getContext('2d', { willReadFrequently: true });
    cx.drawImage(bmp, 0, 0, S.w, S.h);
    const d = cx.getImageData(0, 0, S.w, S.h).data, m = new Uint8Array(S.w * S.h);
    for (let i = 0; i < m.length; i++) m[i] = Math.round((0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) * d[i * 4 + 3] / 255);
    zapamatuj(); S.maska = m; obnov();
  } catch (e) { Dialog.chyba('Masku se nepodařilo načíst.'); }
}

// ---------- ukázkové obrázky (kreslené, bez souborů) ----------
function sum(cx, w, h, sila) {
  const id = cx.getImageData(0, 0, w, h), d = id.data;
  let s = 12345;
  for (let i = 0; i < d.length; i += 4) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const n = (s / 0x7fffffff - 0.5) * sila;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  cx.putImageData(id, 0, 0);
}
function ukazka() {
  const w = 1200, h = 900, c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  let g = x.createLinearGradient(0, 0, 0, h * 0.62); g.addColorStop(0, '#d9d2c5'); g.addColorStop(1, '#b9b0a0');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  g = x.createLinearGradient(0, h * 0.62, 0, h); g.addColorStop(0, '#8a6a4a'); g.addColorStop(1, '#5e452e');
  x.fillStyle = g; x.fillRect(0, h * 0.62, w, h);
  for (let i = 0; i < 9; i++) { x.strokeStyle = 'rgba(40,25,10,.12)'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, h * 0.64 + i * 36); x.bezierCurveTo(w * .3, h * .66 + i * 30, w * .7, h * .6 + i * 40, w, h * 0.65 + i * 36); x.stroke(); }
  // stíny
  x.filter = 'blur(18px)'; x.fillStyle = 'rgba(0,0,0,.45)';
  x.beginPath(); x.ellipse(430, 735, 190, 34, 0, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.ellipse(820, 742, 150, 30, 0, 0, Math.PI * 2); x.fill();
  x.filter = 'none';
  // hrnek
  g = x.createLinearGradient(270, 0, 590, 0); g.addColorStop(0, '#1d4f8f'); g.addColorStop(.35, '#4f8fd8'); g.addColorStop(1, '#173d70');
  x.lineWidth = 34; x.strokeStyle = '#2b62a8'; x.beginPath(); x.ellipse(590, 560, 70, 95, 0, -Math.PI / 2, Math.PI / 2); x.stroke();
  x.fillStyle = g; x.beginPath(); x.moveTo(270, 420); x.lineTo(590, 420); x.lineTo(575, 720); x.quadraticCurveTo(430, 760, 285, 720); x.closePath(); x.fill();
  x.fillStyle = '#123766'; x.beginPath(); x.ellipse(430, 420, 160, 30, 0, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#3b2314'; x.beginPath(); x.ellipse(430, 424, 142, 22, 0, 0, Math.PI * 2); x.fill();
  // pomeranč
  g = x.createRadialGradient(780, 560, 20, 820, 600, 160); g.addColorStop(0, '#ffc14d'); g.addColorStop(.6, '#f08a12'); g.addColorStop(1, '#a8510a');
  x.fillStyle = g; x.beginPath(); x.arc(820, 600, 150, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#3f7a1f'; x.beginPath(); x.ellipse(860, 452, 60, 22, -0.5, 0, Math.PI * 2); x.fill();
  x.strokeStyle = '#4a3012'; x.lineWidth = 8; x.beginPath(); x.moveTo(820, 455); x.lineTo(830, 435); x.stroke();
  sum(x, w, h, 10);
  return nactiCanvas(c, 'ukazka-zatisi');
}
function ukazkaZelena() {
  const w = 1000, h = 750, c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, 650); g.addColorStop(0, '#2fd14a'); g.addColorStop(1, '#108a26');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.filter = 'blur(30px)'; x.fillStyle = 'rgba(0,40,0,.35)'; x.beginPath(); x.ellipse(560, 700, 260, 50, 0, 0, Math.PI * 2); x.fill(); x.filter = 'none';
  // postavička: tělo, hlava, vlasy z tenkých tahů (test měkké hrany a přesvitu)
  x.fillStyle = '#c0392b'; x.beginPath(); x.moveTo(380, 720); x.quadraticCurveTo(400, 430, 500, 420); x.quadraticCurveTo(600, 430, 620, 720); x.fill();
  x.fillStyle = '#f2c6a0'; x.beginPath(); x.arc(500, 330, 95, 0, Math.PI * 2); x.fill();
  x.strokeStyle = '#5a3a1a'; x.lineWidth = 2.2;
  for (let i = 0; i < 160; i++) {
    const a = Math.PI * (1.05 + 0.9 * i / 160), r = 92;
    x.beginPath(); x.moveTo(500 + Math.cos(a) * r * 0.6, 330 + Math.sin(a) * r * 0.6);
    x.quadraticCurveTo(500 + Math.cos(a) * r * 1.25, 330 + Math.sin(a) * r * 1.3, 500 + Math.cos(a + 0.15) * r * 1.45, 330 + Math.sin(a + 0.15) * r * 1.4 + 10);
    x.stroke();
  }
  x.fillStyle = '#ffffff'; x.globalAlpha = .55; x.fillRect(470, 500, 60, 140); x.globalAlpha = 1;   // poloprůhledná cedulka
  sum(x, w, h, 8);
  return nactiCanvas(c, 'ukazka-zelene-platno');
}
async function nactiCanvas(c, nazev) { return nactiObrazek(await createImageBitmap(c), nazev); }

// ---------- příkazy ----------
const PRIKAZY = {
  otevrit: () => $('soubor').click(),
  vlozit: vlozZeSchranky,
  ukazka: () => ukazka(),
  ukazkaZelena: () => ukazkaZelena(),
  ulozit, kopirovat, ulozitMasku,
  nacistMasku: () => maObraz() && $('souborMaska').click(),
  vlastniPozadi: () => $('souborPozadi').click(),
  zpet, znovu,
  ai: spustAi,
  chroma: pouzijChroma,
  invert: () => operace('🔁 Invertuji…', m => m.map(v => 255 - v)),
  vseObjekt: () => operace('…', m => m.fill(255)),
  vsePozadi: () => operace('…', m => m.fill(0)),
  zuzit: () => operace('➖ Zužuji…', m => P.posunHranu(m, S.w, S.h, -1)),
  rozsirit: () => operace('➕ Rozšiřuji…', m => P.posunHranu(m, S.w, S.h, 1)),
  posunHrany: () => operace('Posouvám hranu…', m => P.posunHranu(m, S.w, S.h, nast.hrPosun)),
  feather: () => operace('🌫 Zjemňuji hranu…', m => P.rozmaz(m, S.w, S.h, nast.hrFeather)),
  primknout: () => operace('🎯 Přimykám hranu…', m => P.zjemniPodleObrazu(S.orig.data, S.w, S.h, m, S.w, S.h)),
  ostrovy: () => operace('🧹 Čistím…', m => P.vycistiOstrovy(m, S.w, S.h, Math.max(16, Math.round(S.w * S.h * 0.0005)))),
  zobrVysledek: () => zobraz('vysledek'), zobrMaska: () => zobraz('maska'),
  zobrPrekryv: () => zobraz('prekryv'), zobrOriginal: () => zobraz('original'),
  prizpusobit: prizpusob,
  zoom100: () => zoomNa(1 / (window.devicePixelRatio || 1)),
  priblizit: () => zoomNa(S.zoom * 1.25), oddalit: () => zoomNa(S.zoom / 1.25),
  napoveda: () => { $('napovedaBg').hidden = false; },
};
function prikaz(id) { zavriNabidky(); const p = PRIKAZY[id]; if (p) p(); }
function zobraz(rezim) {
  S.zobraz = rezim; S.nahledPlatny = false;
  document.querySelectorAll('[data-zobraz]').forEach(b => b.setAttribute('aria-pressed', b.dataset.zobraz === rezim));
  prekresli();
}
function nastroj(n) {
  S.nastroj = n;
  document.querySelectorAll('[data-nastroj]').forEach(b => b.setAttribute('aria-pressed', b.dataset.nastroj === n));
  platno.style.cursor = n === 'posun' ? 'grab' : n === 'kapatko' || n === 'hulka' ? 'crosshair' : 'none';
  if (n === 'kapatko') $('sekChroma').open = true;
  prekresli();
}
async function vlozZeSchranky() {
  try {
    for (const it of await navigator.clipboard.read()) {
      const typ = it.types.find(t => t.startsWith('image/'));
      if (typ) return nactiObrazek(await it.getType(typ), 'vlozeny');
    }
    Dialog.info('Ve schránce není obrázek.');
  } catch (e) { Dialog.info('Vložte obrázek klávesami Ctrl+V.'); }
}

// nabídky lišty
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
  if (b && !b.disabled) { e.stopPropagation(); return prikaz(b.dataset.prikaz); }
  const n = e.target.closest('[data-nastroj]');
  if (n) { zavriNabidky(); return nastroj(n.dataset.nastroj); }
  const hu = e.target.closest('[data-hulka]');
  if (hu) { nast.huRezim = hu.dataset.hulka; ulozNast(); return synchronizuj(); }
  if (e.target.closest('[data-zavrit]') || e.target.classList.contains('modal-bg')) { $('napovedaBg').hidden = true; return; }
  if (!e.target.closest('.nabidka')) zavriNabidky();
});
addEventListener('resize', () => { zavriNabidky(); prekresli(); });
new ResizeObserver(() => prekresli()).observe(plocha);

// ---------- ovládací prvky panelu ----------
const PRVKY = ['aiZjemnit', 'aiOstrovy', 'aiOstrost', 'chBarva', 'chTol', 'chMek', 'chPresvit', 'stVel', 'stTvr', 'huTol', 'huSouvisle',
  'hrPosun', 'hrFeather', 'vyPozadi', 'vyBarva', 'vyRozm', 'vyOrez', 'vyOkraj', 'vyStin', 'vyStinRozm', 'vyStinX', 'vyStinY', 'vyStinPruh', 'vyFormat', 'vyKval'];
const JEDNOTKY = { aiOstrost: '', chPresvit: ' %', stVel: ' px', stTvr: ' %', hrPosun: ' px', hrFeather: ' px', vyStinPruh: ' %', vyKval: ' %' };
function synchronizuj() {
  for (const id of PRVKY) {
    const el = $(id);
    if (el.type === 'checkbox') el.checked = !!nast[id]; else el.value = nast[id];
    const o = $(id + 'V'); if (o) o.textContent = nast[id] + (JEDNOTKY[id] || '');
  }
  document.querySelectorAll('[data-hulka]').forEach(b => b.setAttribute('aria-pressed', b.dataset.hulka === nast.huRezim));
  $('rBarva').hidden = nast.vyPozadi !== 'barva'; $('rRozm').hidden = nast.vyPozadi !== 'rozmazane'; $('rObr').hidden = nast.vyPozadi !== 'obrazek';
  $('stinVolby').hidden = !nast.vyStin; $('rKval').hidden = nast.vyFormat === 'png';
}
for (const id of PRVKY) {
  const el = $(id);
  el.addEventListener('input', () => {
    nast[id] = el.type === 'checkbox' ? el.checked : el.type === 'range' || el.type === 'number' ? +el.value : el.value;
    ulozNast(); synchronizuj();
    if (id === 'chTol' || id === 'chMek') chromaZive(false);
    else if (id === 'chBarva') chromaZive(false);
    else if (id === 'chPresvit') chromaZive(true);
    else if (id === 'vyOrez' || id === 'vyOkraj') { S.bbox = undefined; prekresli(); }
    else if (id.startsWith('vy') || id === 'stVel') prekresli();
  });
}
synchronizuj();

// ---------- soubory, přetažení, vložení ----------
$('soubor').onchange = e => { const f = e.target.files[0]; if (f) nactiObrazek(f, f.name); e.target.value = ''; };
$('souborMaska').onchange = e => { const f = e.target.files[0]; if (f) nactiMasku(f); e.target.value = ''; };
$('souborPozadi').onchange = async e => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  try { S.vlastniPozadi = await createImageBitmap(f); $('vyObrNazev').textContent = f.name; prekresli(); }
  catch (err) { Dialog.chyba('Obrázek pozadí se nepodařilo načíst.'); }
};
addEventListener('dragover', e => { e.preventDefault(); plocha.classList.add('pretah'); });
addEventListener('dragleave', e => { if (!e.relatedTarget) plocha.classList.remove('pretah'); });
addEventListener('drop', e => {
  e.preventDefault(); plocha.classList.remove('pretah');
  const f = [...(e.dataTransfer.files || [])].find(f => f.type.startsWith('image/'));
  if (f) nactiObrazek(f, f.name); else Dialog.info('Přetáhněte soubor s obrázkem.');
});
addEventListener('paste', e => {
  const it = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'));
  if (it) { e.preventDefault(); nactiObrazek(it.getAsFile(), 'vlozeny'); }
});

// ---------- myš a dotyk na plátně ----------
const ukazatele = new Map();
let tazeni = null;   // {typ:'posun'|'stetec'|'stipnuti', ...}
function bod(e) { const r = platno.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
platno.addEventListener('contextmenu', e => e.preventDefault());
platno.addEventListener('pointerdown', e => {
  if (!S.orig) return;
  try { platno.setPointerCapture(e.pointerId); } catch (err) { /* syntetická událost */ }
  const p = bod(e); ukazatele.set(e.pointerId, p);
  if (ukazatele.size === 2) {                         // dva prsty: přiblížení a posun, rozdělaný tah se vrátí
    if (tazeni && tazeni.typ === 'stetec') zpet();
    const [a, b] = [...ukazatele.values()];
    tazeni = { typ: 'stipnuti', d: Math.hypot(a.x - b.x, a.y - b.y), s: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
    return;
  }
  if (ukazatele.size > 2) return;
  const ip = naObraz(p.x, p.y);
  if (S.nastroj === 'posun' || e.button === 1 || e.button === 2 || S.mezernik) {
    tazeni = { typ: 'posun', p }; platno.style.cursor = 'grabbing'; return;
  }
  if (e.button !== 0) return;
  if (S.nastroj === 'obnovit' || S.nastroj === 'vymazat') {
    zapamatuj();
    tazeni = { typ: 'stetec', posl: ip };
    obnov(P.stetec(S.maska, S.w, S.h, ip.x, ip.y, nast.stVel / 2, nast.stTvr / 100, S.nastroj));
  } else if (S.nastroj === 'hulka') {
    if (ip.x < 0 || ip.y < 0 || ip.x >= S.w || ip.y >= S.h) return;
    const rezim = e.altKey ? (nast.huRezim === 'pridat' ? 'odebrat' : 'pridat') : nast.huRezim;
    const v = P.hulka(S.orig.data, S.w, S.h, ip.x, ip.y, nast.huTol, nast.huSouvisle);
    zapamatuj();
    obnov(P.pouzijVyber(S.maska, S.w, v, rezim));
  } else if (S.nastroj === 'kapatko') {
    const x = Math.floor(ip.x), y = Math.floor(ip.y);
    if (x < 0 || y < 0 || x >= S.w || y >= S.h) return;
    const i = (y * S.w + x) * 4, d = S.orig.data;
    nast.chBarva = P.rgbNaHex(d[i], d[i + 1], d[i + 2]); ulozNast(); synchronizuj();
    Dialog.info(`Barva klíče ${nast.chBarva} – klikněte na „Použít klíčování“.`);
    chromaZive(false);
  }
});
platno.addEventListener('pointermove', e => {
  const p = bod(e);
  S.mys = p;
  if (ukazatele.has(e.pointerId)) ukazatele.set(e.pointerId, p);
  if (!tazeni) return prekresli();
  if (tazeni.typ === 'stipnuti' && ukazatele.size >= 2) {
    const [a, b] = [...ukazatele.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y), s = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    S.ox += s.x - tazeni.s.x; S.oy += s.y - tazeni.s.y;
    zoomNa(S.zoom * d / Math.max(1, tazeni.d), s.x, s.y);
    tazeni.d = d; tazeni.s = s;
  } else if (tazeni.typ === 'posun') {
    S.ox += p.x - tazeni.p.x; S.oy += p.y - tazeni.p.y; tazeni.p = p; prekresli();
  } else if (tazeni.typ === 'stetec') {
    const ip = naObraz(p.x, p.y), a = tazeni.posl;
    obnov(P.tah(S.maska, S.w, S.h, a.x, a.y, ip.x, ip.y, nast.stVel / 2, nast.stTvr / 100, S.nastroj));
    tazeni.posl = ip;
  }
});
function konecTazeni(e) {
  ukazatele.delete(e.pointerId);
  if (tazeni && tazeni.typ === 'stipnuti' && ukazatele.size) return;
  tazeni = null; nastroj(S.nastroj);
}
platno.addEventListener('pointerup', konecTazeni);
platno.addEventListener('pointercancel', konecTazeni);
platno.addEventListener('pointerleave', () => { S.mys = null; prekresli(); });
platno.addEventListener('wheel', e => {
  if (!S.orig) return;
  e.preventDefault();
  const p = bod(e);
  zoomNa(S.zoom * Math.pow(1.0015, -e.deltaY * (e.deltaMode === 1 ? 30 : 1)), p.x, p.y);
}, { passive: false });

// ---------- klávesnice ----------
addEventListener('keydown', e => {
  const t = e.target, psani = t.matches && t.matches('input:not([type=range]):not([type=checkbox]):not([type=color]),select,textarea');
  const ctrl = e.ctrlKey || e.metaKey, k = e.key;
  if (k === 'Escape') { zavriNabidky(); $('napovedaBg').hidden = true; return; }
  if (k === 'F1') { e.preventDefault(); return prikaz('napoveda'); }
  if (ctrl) {
    const kl = k.toLowerCase();
    if (kl === 'z' && e.shiftKey) { e.preventDefault(); return znovu(); }
    if (kl === 'z') { e.preventDefault(); return zpet(); }
    if (kl === 'y') { e.preventDefault(); return znovu(); }
    if (kl === 's') { e.preventDefault(); return ulozit(); }
    if (kl === 'o') { e.preventDefault(); return prikaz('otevrit'); }
    if (k === '1') { e.preventDefault(); return prikaz('zoom100'); }
    if (k === '+' || k === '=') { e.preventDefault(); return prikaz('priblizit'); }
    if (k === '-') { e.preventDefault(); return prikaz('oddalit'); }
    return;
  }
  if (psani || e.altKey) return;
  if (k === ' ') { e.preventDefault(); if (!S.mezernik) { S.mezernik = true; platno.style.cursor = 'grab'; prekresli(); } return; }
  const mapa = { p: 'posun', o: 'obnovit', e: 'vymazat', w: 'hulka', k: 'kapatko' };
  if (mapa[k.toLowerCase()]) return nastroj(mapa[k.toLowerCase()]);
  const pr = { a: 'ai', i: 'invert', 0: 'prizpusobit', 1: 'zobrVysledek', 2: 'zobrMaska', 3: 'zobrPrekryv', 4: 'zobrOriginal', '+': 'rozsirit', '-': 'zuzit' };
  if (pr[k.toLowerCase()] !== undefined) { e.preventDefault(); return prikaz(pr[k.toLowerCase()]); }
  if (k === '[' || k === ']') {
    nast.stVel = Math.max(1, Math.min(400, Math.round(nast.stVel * (k === ']' ? 1.15 : 1 / 1.15)) + (k === ']' ? 1 : 0)));
    ulozNast(); synchronizuj(); prekresli();
  }
});
addEventListener('keyup', e => { if (e.key === ' ') { S.mezernik = false; nastroj(S.nastroj); } });

if (window.self === window.top) document.body.classList.add('samostatne');
nastroj('obnovit'); zobraz('vysledek'); tlacitkaHistorie();

// pro testy
window.POZADI_APP = { S, nast, nactiObrazek, nactiCanvas, ukazka, ukazkaZelena, spustAi, pouzijChroma, prikaz, vytvorVystup, obnov };
})();

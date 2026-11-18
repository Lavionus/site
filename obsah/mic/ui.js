/* Stopy tiskárny (MIC) – rozhraní: prohlížeč se zoomem, rozbor po pruzích, inspektor, ruční dekodér,
   porovnání výtisků, protokol a exporty. Výpočty v MIC (jadro.js). */
'use strict';
const $ = id => document.getElementById(id);
const ZRUSENO = Symbol('zrušeno');
const pauza = () => new Promise(r => setTimeout(r, 0));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const dva = n => String(n).padStart(2, '0');
const cislo = (x, des = 2) => x.toFixed(des).replace('.', ',');
const css = jm => getComputedStyle(document.documentElement).getPropertyValue(jm).trim();
// iOS Safari má plátno omezené na ~16,7 Mpx; jinde se větší obrázek zmenší kvůli paměti
const JE_IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const MAX_ZDROJ = JE_IOS ? 16e6 : 60e6;

let zdroj = null;              // { canvas, ctx, w, h, nazev, dpi, sha, soubor, bajty }
let oblast = null;             // oblast rozboru { x, y, w, h }
let rozb = null;               // výsledek MIC.rozborPruhy + posun, ms, citlivost
let vyber = null;              // { h: výsledek Xerox, k: index výskytu }
let beh = 0;                   // čítač běhů (nový rozbor ruší starý)
const pohledy = new Map();     // druh → canvas (plné rozlišení)
let aktPlatno = null;          // co se právě kreslí

// ---------- záložky, nabídky ----------
document.querySelectorAll('[data-zalozka]').forEach(b => b.onclick = () => prepniZalozku(b.dataset.zalozka));
function prepniZalozku(jm) {
  document.querySelectorAll('[data-zalozka]').forEach(x => x.setAttribute('aria-pressed', x.dataset.zalozka === jm ? 'true' : 'false'));
  document.querySelectorAll('.strana').forEach(s => { s.hidden = s.id !== 'str' + jm; });
  if (jm === 'Rozbor') velikostPlatna();
}
function zavriNabidky() { document.querySelectorAll('.nabidka').forEach(n => { n.hidden = true; }); }
document.querySelectorAll('[data-nabidka]').forEach(b => b.addEventListener('click', e => {
  e.stopPropagation();
  const n = $(b.dataset.nabidka), bylo = !n.hidden;
  zavriNabidky(); if (bylo || b.disabled) return;
  n.hidden = false;
  const r = b.getBoundingClientRect();
  n.style.top = (r.bottom + 4) + 'px';
  n.style.left = Math.max(6, Math.min(r.left, innerWidth - n.offsetWidth - 6)) + 'px';
}));
document.addEventListener('click', e => { if (!e.target.closest('.nabidka')) zavriNabidky(); });
addEventListener('resize', zavriNabidky);
document.querySelectorAll('[data-ukazka]').forEach(b => b.onclick = () => { zavriNabidky(); nactiUkazku(b.dataset.ukazka); });
document.querySelectorAll('[data-export]').forEach(b => b.onclick = () => { zavriNabidky(); exportuj(b.dataset.export); });

$('btnOtevrit').onclick = $('btnOtevrit2').onclick = () => $('soubor').click();
$('btnFoto').onclick = () => $('fotak').click();
$('btnUkazka2').onclick = () => nactiUkazku('xerox');
$('soubor').onchange = e => { if (e.target.files[0]) nactiSoubor(e.target.files[0]); e.target.value = ''; };
$('fotak').onchange = e => { if (e.target.files[0]) nactiSoubor(e.target.files[0], true); e.target.value = ''; };
$('btnNapoveda').onclick = () => $('napoveda').showModal();
$('napovedaZavrit').onclick = () => $('napoveda').close();
$('btnProtokol').onclick = tiskniProtokol;

const prohl = $('prohlizec');
['dragenter', 'dragover'].forEach(t => prohl.addEventListener(t, e => { e.preventDefault(); $('uvod').classList.add('nad'); }));
['dragleave', 'drop'].forEach(t => prohl.addEventListener(t, () => $('uvod').classList.remove('nad')));
prohl.addEventListener('drop', e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) nactiSoubor(f); });
document.addEventListener('paste', e => {
  const f = [...(e.clipboardData?.files || [])].find(x => x.type.startsWith('image/'));
  if (f) { prepniZalozku('Rozbor'); nactiSoubor(f); }
});

$('pohled').onchange = () => prepniPohled();
$('btnZnacky').onclick = () => { prepniTl($('btnZnacky')); kresli(); };
$('btnOblast').onclick = () => { prepniTl($('btnOblast')); $('plocha').classList.toggle('vyber', jeZapnuto($('btnOblast'))); };
$('btnCelaStr').onclick = () => { if (zdroj) { oblast = { x: 0, y: 0, w: zdroj.w, h: zdroj.h }; spustRozbor(); } };
$('dpi').onchange = () => { if (zdroj) { zdroj.dpi = +$('dpi').value || 600; spustRozbor(); } };
$('citlivost').onchange = () => { if (zdroj) spustRozbor(); };
$('btnOddalit').onclick = () => zoomStred(1 / 1.5);
$('btnPriblizit').onclick = () => zoomStred(1.5);
$('btnCely').onclick = () => { prizpusob(); kresli(); };
$('btn11').onclick = () => { zoomNa(1 / devicePixelRatio / V.s, platnoW() / 2, platnoH() / 2); };
const prepniTl = b => b.setAttribute('aria-pressed', jeZapnuto(b) ? 'false' : 'true');
const jeZapnuto = b => b.getAttribute('aria-pressed') === 'true';

function stav(t) { $('stav').textContent = t; }
function ukazPrubeh(p) { const e = $('prubeh'); e.hidden = p === null; if (p !== null) e.value = p; }

// ---------- načtení ----------
function dpiZHlavicky(buf) {
  const v = new DataView(buf);
  try {
    if (v.getUint16(0) === 0xFFD8 && v.getUint16(2) === 0xFFE0 && v.getUint32(6) === 0x4A464946) {   // JFIF
      const jedn = v.getUint8(13), x = v.getUint16(14);
      if (jedn === 1 && x > 1) return x;
      if (jedn === 2 && x > 1) return Math.round(x * 2.54);
    }
    if (v.getUint32(0) === 0x89504E47) {                      // PNG: blok pHYs
      let o = 8;
      while (o + 12 < v.byteLength) {
        const len = v.getUint32(o), typ = v.getUint32(o + 4);
        if (typ === 0x70485973 && v.getUint8(o + 16) === 1) return Math.round(v.getUint32(o + 8) * 0.0254);
        if (typ === 0x49444154) break;
        o += 12 + len;
      }
    }
  } catch { /* neúplná hlavička */ }
  return null;
}

async function sha256(buf) {
  if (!crypto.subtle) return null;
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', buf));
  return [...h].map(b => b.toString(16).padStart(2, '0')).join('');
}

function noveP(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error(`prohlížeč nevytvořil plátno ${w}×${h} px (příliš velký obrázek)`);
  return { c, ctx };
}

// soubor → { canvas, ctx, dpi, sha, zmenseno } (sdílí Rozbor i Porovnání)
async function souborNaPlatno(f) {
  const buf = await f.arrayBuffer(), sha = await sha256(buf);
  let dpi = null, canvas, ctx, zmenseno = false;
  if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) ({ canvas, ctx, dpi } = await pdfNaPlatno(buf));
  else {
    dpi = dpiZHlavicky(buf);
    const bmp = await createImageBitmap(new Blob([buf], { type: f.type }));
    let w = bmp.width, h = bmp.height;
    if (w * h > MAX_ZDROJ) { const k = Math.sqrt(MAX_ZDROJ / (w * h)); w = Math.floor(w * k); h = Math.floor(h * k); zmenseno = true; dpi = dpi ? Math.round(dpi * k) : null; }
    ({ c: canvas, ctx } = noveP(w, h));
    ctx.drawImage(bmp, 0, 0, w, h); bmp.close();
  }
  return { canvas, ctx, dpi, sha, zmenseno, bajty: buf.byteLength };
}

let pdfjs = null;
async function pdfNaPlatno(buf, strana) {
  if (!pdfjs) {
    pdfjs = await import(new URL('lib/pdfjs/pdf.min.mjs', location.href).href);
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('lib/pdfjs/pdf.worker.min.mjs', location.href).href;
  }
  const dok = await pdfjs.getDocument({ data: new Uint8Array(buf.slice(0)) }).promise;
  try { return await pdfStrana(dok, strana); } finally { dok.destroy(); }
}
async function pdfStrana(dok, strana) {
  let c = strana || 1;
  if (!strana && dok.numPages > 1) {
    const odp = await Dialog.zeptej(`PDF má ${dok.numPages} stran. Kterou rozebrat?`, '1');
    if (odp === null) throw ZRUSENO;
    c = Math.min(dok.numPages, Math.max(1, parseInt(odp, 10) || 1));
  }
  const str = await dok.getPage(c), z = str.getViewport({ scale: 1 });
  const dpi = Math.min(600, Math.floor(72 * Math.sqrt(Math.min(40e6, MAX_ZDROJ) / (z.width * z.height))));
  const vp = str.getViewport({ scale: dpi / 72 }), { c: canvas, ctx } = noveP(Math.round(vp.width), Math.round(vp.height));
  await str.render({ canvasContext: ctx, viewport: vp }).promise;
  return { canvas, ctx, dpi };
}

let nacitani = 0;
async function nactiSoubor(f, zFotaku) {
  const muj = ++nacitani;
  stav('Načítám ' + f.name + '…');
  try {
    const p = await souborNaPlatno(f);
    if (muj !== nacitani) { p.canvas.width = p.canvas.height = 0; return; }   // mezitím otevřen jiný soubor
    if (p.dpi && p.dpi >= 72 && p.dpi <= 4800) $('dpi').value = p.dpi;
    else {
      $('dpi').value = 600;
      Dialog.info(zFotaku ? 'U fotky není rozlišení známé – milimetry jsou jen odhad (DPI nastavte ručně).' : 'Soubor neuvádí rozlišení – předpokládám 600 dpi (lze změnit v liště).');
    }
    if (p.zmenseno) Dialog.info('Obrázek je velmi velký, pro rozbor byl zmenšen.');
    nastavZdroj(p.canvas, p.ctx, f.name, { sha: p.sha, soubor: f, bajty: p.bajty });
  } catch (e) {
    if (muj !== nacitani) return;
    if (e === ZRUSENO) { stav('Zrušeno.'); return; }
    console.error(e);
    Dialog.chyba('Soubor nejde otevřít: ' + (e.message || e) + (/tiff?$/i.test(f.name) ? ' (TIFF prohlížeč neumí – uložte sken jako PNG)' : ''));
    stav('Načtení se nepovedlo.');
  }
}

let ukazkaCislo = 0;
function nactiUkazku(druh) {
  ++nacitani;
  prepniZalozku('Rozbor');
  const ted = new Date(), serie = String(10000000 + Math.floor(Math.random() * 89999999));
  const kod = { minuta: ted.getMinutes(), hodina: ted.getHours(), den: ted.getDate(), mesic: ted.getMonth() + 1, rok: ted.getFullYear() % 100, serie };
  const img = druh === 'jiny' ? ukazkaJiny()
    : MIC.ukazka({ kod, w: 2400, h: 1800, seed: ++ukazkaCislo * 7919, otocit: druh === 'otoceny', uhel: druh === 'otoceny' ? -0.8 : 0.4 });
  const { c, ctx } = noveP(img.w, img.h);
  ctx.putImageData(new ImageData(img.data, img.w, img.h), 0, 0);
  $('dpi').value = 600;
  nastavZdroj(c, ctx, druh === 'jiny' ? 'ukázka – jiný výrobce' : `ukázka (smyšlené sériové číslo ${serie})`, {});
}

// souvislá mřížka s náhodnou dlaždicí – jako tiskárny s neveřejným kódováním
function ukazkaJiny() {
  const w = 2000, h = 1500, data = new Uint8ClampedArray(w * h * 4), p = 12, A = 32, B = 16;
  for (let i = 0; i < w * h; i++) { const z = 244 + Math.random() * 10; data[i * 4] = data[i * 4 + 1] = z; data[i * 4 + 2] = z - 2; data[i * 4 + 3] = 255; }
  const dl = Array.from({ length: A * B }, () => Math.random() < 0.1);
  for (let j = 0; j * p < h; j++) for (let i = 0; i * p < w; i++) {
    if (!dl[(j % B) * A + (i % A)]) continue;
    const X = i * p + 5, Y = j * p + 5;
    for (let y = Y - 3; y <= Y + 3; y++) for (let x = X - 3; x <= X + 3; x++) {
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const a = Math.exp(-((x - X) ** 2 + (y - Y) ** 2) / 2.4), k = (y * w + x) * 4;
      data[k + 1] -= a * 8; data[k + 2] -= a * 90;
    }
  }
  return { w, h, data };
}

function nastavZdroj(canvas, ctx, nazev, extra) {
  zdroj = { canvas, ctx, w: canvas.width, h: canvas.height, nazev, dpi: +$('dpi').value || 600, sha: null, ...extra };
  oblast = { x: 0, y: 0, w: zdroj.w, h: zdroj.h };
  $('uvod').hidden = true; $('plocha').hidden = false; $('info').hidden = false; $('kartaPrehled').hidden = false;
  velikostPlatna(); prizpusob();
  spustRozbor();
}

// ---------- rozbor ----------
async function spustRozbor() {
  const muj = ++beh, ob = { ...oblast }, z = zdroj;
  rozb = null; vyber = null; pohledy.clear(); rozpracovane.clear(); aktPlatno = z.canvas;
  $('vysledky').innerHTML = ''; $('kartaInspektor').hidden = true;
  ['btnProtokol', 'btnExport'].forEach(id => { $(id).disabled = true; });
  $('btnCelaStr').disabled = ob.w === z.w && ob.h === z.h;
  stav('Hledám žluté tečky…'); ukazPrubeh(0); kresli();
  const t0 = performance.now();
  try {
    const r = await MIC.rozborPruhy((y0, y1) => z.ctx.getImageData(ob.x, ob.y + y0, ob.w, y1 - y0).data, ob.w, ob.h,
      { dpi: z.dpi, citlivost: +$('citlivost').value },
      async p => { if (muj !== beh) throw ZRUSENO; ukazPrubeh(p * 0.9); await pauza(); });
    if (muj !== beh) return;
    r.posun = { x: ob.x, y: ob.y }; r.oblast = ob; r.ms = Math.round(performance.now() - t0); r.citlivost = +$('citlivost').value;
    rozb = r;
  } catch (e) {
    if (e === ZRUSENO) return;
    console.error(e); ukazPrubeh(null); stav('Rozbor selhal: ' + (e.message || e)); return;
  }
  stav(`${z.nazev} · ${z.w}×${z.h} px · ${z.dpi} dpi` + (ob.w < z.w || ob.h < z.h ? ` · oblast ${ob.w}×${ob.h}` : '') + ` · ${rozb.ms} ms`);
  ['btnProtokol', 'btnExport'].forEach(id => { $(id).disabled = false; });
  $('porovAktualni').disabled = false;
  vypisVysledky();
  await prepniPohled();
  ukazPrubeh(null);
}

// ---------- pohledy (plné rozlišení, generované po pruzích) ----------
const POHLEDY = ['zvyrazneno', 'original', 'modry', 'mapa', 'vycisteno'];
const rozpracovane = new Map();     // druh → Promise (jeden výpočet téhož pohledu najednou)
let pohledTok = 0;                  // přepnutí pohledu ruší rozpracovaný pohled, který už nikdo nechce
async function prepniPohled() {
  const druh = $('pohled').value, muj = beh, tok = ++pohledTok;
  if (!zdroj) return;
  if (druh === 'original' || !rozb) { aktPlatno = zdroj.canvas; kresli(); return; }
  const c = await vytvorPohled(druh, muj, tok);
  if (c && muj === beh && $('pohled').value === druh) { aktPlatno = c; kresli(); }
}

function vytvorPohled(druh, muj, tok) {
  if (pohledy.has(druh)) return Promise.resolve(pohledy.get(druh));
  if (rozpracovane.has(druh)) return rozpracovane.get(druh);
  const pr = generujPohled(druh, muj, tok).finally(() => rozpracovane.delete(druh));
  rozpracovane.set(druh, pr);
  return pr;
}

async function generujPohled(druh, muj, tok) {
  const z = zdroj, w = z.w, h = z.h, prah = rozb.prah, r = Math.max(4, Math.round(10 * z.dpi / 600)), okraj = r + 4;
  const pruh = Math.max(64, Math.floor(4e6 / w)), { c, ctx } = noveP(w, h);
  const ukazovat = $('prubeh').hidden;
  if (ukazovat) ukazPrubeh(0);
  const zrusit = () => muj !== beh || (tok !== undefined && tok !== pohledTok);
  for (let y = 0; y < h; y += pruh) {
    if (zrusit()) { c.width = c.height = 0; if (ukazovat) ukazPrubeh(null); return null; }
    const y0 = Math.max(0, y - okraj), y1 = Math.min(h, y + pruh + okraj), hh = y1 - y0;
    const img = z.ctx.getImageData(0, y0, w, hh), dt = img.data;
    if (druh === 'modry') {
      for (let k = 0; k < dt.length; k += 4) { const v = Math.max(0, Math.min(255, (dt[k + 2] - 140) * 255 / 115)); dt[k] = dt[k + 1] = dt[k + 2] = v; }
    } else {
      const d = MIC.zlutostRozdil(dt, w, hh, r);
      if (druh === 'zvyrazneno') img.data.set(MIC.zvyrazni(d, prah, w, hh));
      else if (druh === 'vycisteno') MIC.vycisti(dt, d, prah, w, hh);
      else if (druh === 'mapa') {
        for (let i = 0, k = 0; i < d.length; i++, k += 4) {
          const sedy = (dt[k] + dt[k + 1] + dt[k + 2]) / 3 * 0.35 + 160, t = Math.max(0, Math.min(1, d[i] / (2.5 * prah)));
          if (t < 0.12) { dt[k] = dt[k + 1] = dt[k + 2] = sedy; continue; }
          dt[k] = 255; dt[k + 1] = 230 * (1 - t * 0.9); dt[k + 2] = 40 * (1 - t);
        }
      }
    }
    ctx.putImageData(img, 0, y0, 0, y - y0, w, Math.min(pruh, h - y));
    if (ukazovat) ukazPrubeh(Math.min(1, (y + pruh) / h));
    await pauza();
  }
  if (ukazovat) ukazPrubeh(null);
  if (zrusit()) { c.width = c.height = 0; return null; }
  if (pohledy.size >= (w * h > 20e6 ? 1 : 3)) pohledy.delete(pohledy.keys().next().value);   // šetřit paměť
  pohledy.set(druh, c);
  return c;
}

// ---------- prohlížeč ----------
const plocha = $('plocha'), pctx = plocha.getContext('2d');
const V = { s: 1, ox: 0, oy: 0 };      // s = CSS px na pixel obrázku, ox/oy = bod obrázku v levém horním rohu
const platnoW = () => plocha.clientWidth, platnoH = () => plocha.clientHeight;
function velikostPlatna() {
  if (plocha.hidden) return;
  const w = platnoW(), h = platnoH();
  if (!w || !h) return;
  plocha.width = Math.round(w * devicePixelRatio); plocha.height = Math.round(h * devicePixelRatio);
  kresli();
}
new ResizeObserver(velikostPlatna).observe(prohl);
function prizpusob() {
  if (!zdroj) return;
  const w = platnoW() || 800, h = platnoH() || 600;
  V.s = Math.min(w / zdroj.w, h / zdroj.h) * 0.98;
  V.ox = -(w / V.s - zdroj.w) / 2; V.oy = -(h / V.s - zdroj.h) / 2;
}
function zoomNa(f, cx, cy) {
  if (!zdroj || !isFinite(f) || f <= 0) return;
  const ix = V.ox + cx / V.s, iy = V.oy + cy / V.s;
  const min = Math.min(platnoW() / zdroj.w, platnoH() / zdroj.h) * 0.25;
  V.s = Math.max(min, Math.min(40, V.s * f));
  V.ox = ix - cx / V.s; V.oy = iy - cy / V.s;
  kresli();
}
const zoomStred = f => zoomNa(f, platnoW() / 2, platnoH() / 2);
function vycentruj(x, y, s) { if (s) V.s = s; V.ox = x - platnoW() / 2 / V.s; V.oy = y - platnoH() / 2 / V.s; kresli(); }

let planovano = false;
function kresli() {
  if (planovano) return;
  planovano = true;
  requestAnimationFrame(() => {
    planovano = false; vykresli(pctx, plocha.width, plocha.height, devicePixelRatio); kresliPrehled();
    if (zdroj && !tah) $('info').textContent = `${Math.round(V.s * devicePixelRatio * 100)} %`;
  });
}

// vykreslí výhled do libovolného kontextu (obrazovka i export PNG)
function vykresli(ctx, cw, ch, dpr) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = css('--bg-deep') || '#222'; ctx.fillRect(0, 0, cw, ch);
  if (!zdroj || !aktPlatno) return;
  const s = V.s * dpr;
  ctx.setTransform(s, 0, 0, s, -V.ox * s, -V.oy * s);
  ctx.imageSmoothingEnabled = V.s * dpr < 1.5;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(aktPlatno, 0, 0);
  const px = 1 / s;                                    // tloušťka 1 fyzického pixelu v souřadnicích obrázku
  const x0 = V.ox, y0 = V.oy, x1 = V.ox + cw / s, y1 = V.oy + ch / s;
  if (oblast && (oblast.w < zdroj.w || oblast.h < zdroj.h)) {
    ctx.strokeStyle = css('--danger') || 'red'; ctx.lineWidth = 2 * px; ctx.setLineDash([8 * px, 6 * px]);
    ctx.strokeRect(oblast.x, oblast.y, oblast.w, oblast.h); ctx.setLineDash([]);
  }
  if (rozb && jeZapnuto($('btnZnacky'))) kresliZnacky(ctx, s, px, x0, y0, x1, y1);
  if (tah && tah.rezim === 'vyber') {
    ctx.strokeStyle = css('--accent') || '#38f'; ctx.lineWidth = 2 * px; ctx.setLineDash([6 * px, 4 * px]);
    const r = obdelnikTahu(); ctx.strokeRect(r.x, r.y, r.w, r.h); ctx.setLineDash([]);
  }
}

function kresliZnacky(ctx, s, px, x0, y0, x1, y1) {
  const r = rozb, m = r.mrizka, dx = r.posun.x, dy = r.posun.y;
  ctx.save(); ctx.translate(dx, dy);
  const zakl = m ? Math.min(m.px, m.py) * 0.42 : 4;
  const kruzky = zakl * V.s >= 3;                      // při oddálení by se kroužky slévaly → jen body
  const rad = Math.max(zakl, 3 * px);
  const na = new Path2D(), mimo = new Path2D(), id = r.sl ? r.sl.id : null, bod = 1.5 * px;
  r.tecky.forEach((t, i) => {
    if (t.x + dx < x0 - rad || t.x + dx > x1 + rad || t.y + dy < y0 - rad || t.y + dy > y1 + rad) return;
    const p = id && id[i] >= 0 ? na : mimo;
    if (kruzky) { p.moveTo(t.x + rad, t.y); p.arc(t.x, t.y, rad, 0, 2 * Math.PI); } else p.rect(t.x - bod, t.y - bod, 2 * bod, 2 * bod);
  });
  if (kruzky) {
    ctx.lineWidth = Math.max(1.5 * px, rad / 5);
    ctx.strokeStyle = 'rgba(128,128,128,.8)'; ctx.stroke(mimo);
    ctx.strokeStyle = css('--accent') || '#38f'; ctx.stroke(na);
  } else {
    ctx.fillStyle = 'rgba(128,128,128,.8)'; ctx.fill(mimo);
    ctx.fillStyle = css('--accent') || '#38f'; ctx.fill(na);
  }
  const x = hlavniKod();
  if (x && m) {
    const barva = css('--danger') || '#d33';
    x.mista.forEach((mi, k) => {
      const roh = rohyMista(mi), vybrany = vyber && vyber.h === x && vyber.k === k;
      ctx.beginPath(); roh.forEach((p, q) => q ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath();
      if (vybrany) { ctx.fillStyle = 'rgba(255,60,60,.15)'; ctx.fill(); }
      ctx.strokeStyle = barva; ctx.lineWidth = (vybrany ? 4 : 2) * px;
      ctx.setLineDash(mi.doplneno ? [6 * px, 4 * px] : []); ctx.stroke();
    });
    ctx.setLineDash([]);
  }
  ctx.restore();
}

// rohy rámečku výskytu (souřadnice oblasti)
function rohyMista(mi) {
  const sl = rozb.sl.slozky[mi.slozka], m = rozb.mrizka;
  return [[-.5, -.5], [mi.w - .5, -.5], [mi.w - .5, mi.h - .5], [-.5, mi.h - .5]].map(([a, b]) => MIC.bunkaNaObraz(sl, m, mi.i + a, mi.j + b));
}
const hlavniKod = () => rozb && rozb.xerox[0] && rozb.xerox[0].jistota !== 'nízká' ? rozb.xerox[0] : null;

// ---------- myš, dotyk, klávesy ----------
let tah = null; const ukazatele = new Map();
const bodObrazu = e => { const r = plocha.getBoundingClientRect(); const cx = e.clientX - r.left, cy = e.clientY - r.top; return { cx, cy, x: V.ox + cx / V.s, y: V.oy + cy / V.s }; };
function obdelnikTahu(t = tah) {
  const x = Math.min(t.x0, t.x1), y = Math.min(t.y0, t.y1);
  return { x, y, w: Math.abs(t.x1 - t.x0), h: Math.abs(t.y1 - t.y0) };
}
plocha.addEventListener('pointerdown', e => {
  if (!zdroj) return;
  plocha.setPointerCapture(e.pointerId);
  ukazatele.set(e.pointerId, bodObrazu(e));
  if (ukazatele.size === 2) { tah = { rezim: 'pinch', d: vzdalPinch() }; return; }
  const b = bodObrazu(e);
  tah = { rezim: e.shiftKey || jeZapnuto($('btnOblast')) ? 'vyber' : 'posun', sx: e.clientX, sy: e.clientY, cx: b.cx, cy: b.cy, x0: b.x, y0: b.y, x1: b.x, y1: b.y, pohnul: false };
  if (tah.rezim === 'posun') plocha.classList.add('tahne');
});
function vzdalPinch() { const [a, b] = [...ukazatele.values()]; return { d: Math.hypot(a.cx - b.cx, a.cy - b.cy), cx: (a.cx + b.cx) / 2, cy: (a.cy + b.cy) / 2 }; }
plocha.addEventListener('pointermove', e => {
  const b = bodObrazu(e);
  if (zdroj) $('info').textContent = `${Math.round(V.s * devicePixelRatio * 100)} % · x ${Math.round(b.x)}, y ${Math.round(b.y)}`;
  if (!tah) return;
  if (ukazatele.has(e.pointerId)) ukazatele.set(e.pointerId, b);
  if (tah.rezim === 'pinch') {
    if (ukazatele.size < 2) return;
    const n = vzdalPinch();
    if (tah.d.d < 1) { tah.d = n; return; }
    zoomNa(n.d / tah.d.d, n.cx, n.cy);
    V.ox -= (n.cx - tah.d.cx) / V.s; V.oy -= (n.cy - tah.d.cy) / V.s; tah.d = n; kresli(); return;
  }
  if (Math.hypot(e.clientX - tah.sx, e.clientY - tah.sy) > 4) tah.pohnul = true;
  if (tah.rezim === 'posun') { V.ox -= (b.cx - tah.cx) / V.s; V.oy -= (b.cy - tah.cy) / V.s; tah.cx = b.cx; tah.cy = b.cy; }
  else { tah.x1 = b.x; tah.y1 = b.y; }
  kresli();
});
function konecTahu(e) {
  ukazatele.delete(e.pointerId);
  if (!tah) return;
  const t = tah;
  if (t.rezim === 'pinch') { if (ukazatele.size === 0) tah = null; return; }
  tah = null; plocha.classList.remove('tahne');
  if (!t.pohnul) { klikNaPlochu(t.x0, t.y0); kresli(); return; }
  if (t.rezim === 'vyber') {
    const r = obdelnikTahu(t);
    const x = Math.max(0, Math.round(r.x)), y = Math.max(0, Math.round(r.y));
    const w = Math.min(zdroj.w, Math.round(r.x + r.w)) - x, h = Math.min(zdroj.h, Math.round(r.y + r.h)) - y;
    if (w < 64 || h < 64) { Dialog.info('Oblast je příliš malá (min. 64 × 64 px).'); kresli(); return; }
    oblast = { x, y, w, h };
    if (jeZapnuto($('btnOblast'))) $('btnOblast').click();
    spustRozbor();
  }
  kresli();
}
plocha.addEventListener('pointerup', konecTahu);
plocha.addEventListener('pointercancel', konecTahu);
plocha.addEventListener('wheel', e => { e.preventDefault(); const b = bodObrazu(e); zoomNa(Math.pow(1.0018, -e.deltaY * (e.deltaMode ? 30 : 1)), b.cx, b.cy); }, { passive: false });
plocha.addEventListener('dblclick', e => {
  const b = bodObrazu(e), cil = 1 / devicePixelRatio;
  if (V.s < cil * 0.95) zoomNa(cil / V.s, b.cx, b.cy); else { prizpusob(); kresli(); }
});
plocha.addEventListener('pointerleave', () => { if (zdroj) $('info').textContent = `${Math.round(V.s * devicePixelRatio * 100)} %`; });

function klikNaPlochu(x, y) {
  const h = hlavniKod();
  if (!h) return;
  const px = x - rozb.posun.x, py = y - rozb.posun.y;
  const k = h.mista.findIndex(mi => uvnitr(rohyMista(mi), px, py));
  if (k >= 0) vyberVyskyt(h, k, false);
}
function uvnitr(poly, x, y) {
  let v = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) v = !v;
  }
  return v;
}

document.addEventListener('keydown', e => {
  if (e.target.closest('input, select, textarea, dialog')) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') { e.preventDefault(); $('soubor').click(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p' && rozb) { e.preventDefault(); tiskniProtokol(); return; }
  if (e.key === 'F1') { e.preventDefault(); $('napoveda').showModal(); return; }
  if ($('strRozbor').hidden || !zdroj || e.ctrlKey || e.metaKey || e.altKey) return;
  const krok = 80 / V.s;
  const akce = {
    '+': () => zoomStred(1.5), '=': () => zoomStred(1.5), '-': () => zoomStred(1 / 1.5),
    '0': () => { prizpusob(); kresli(); }, '1': () => $('btn11').click(),
    ArrowLeft: () => { V.ox -= krok; kresli(); }, ArrowRight: () => { V.ox += krok; kresli(); },
    ArrowUp: () => { V.oy -= krok; kresli(); }, ArrowDown: () => { V.oy += krok; kresli(); },
    m: () => $('btnZnacky').click(),
    v: () => { $('pohled').value = POHLEDY[(POHLEDY.indexOf($('pohled').value) + 1) % POHLEDY.length]; prepniPohled(); },
  }[e.key.length === 1 ? e.key.toLowerCase() : e.key];
  if (akce) { e.preventDefault(); akce(); }
});

// ---------- přehled stránky ----------
let prehledObr = null;
function kresliPrehled() {
  const c = $('prehled');
  if (!zdroj || $('kartaPrehled').hidden) return;
  const k = Math.min(1, 360 / zdroj.w), w = Math.max(1, Math.round(zdroj.w * k)), h = Math.max(1, Math.round(zdroj.h * k));
  if (!prehledObr || prehledObr.zdroj !== zdroj) {
    const { c: pc, ctx } = noveP(w, h); ctx.drawImage(zdroj.canvas, 0, 0, w, h);
    prehledObr = { zdroj, pc };
  }
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  const ctx = c.getContext('2d');
  ctx.drawImage(prehledObr.pc, 0, 0);
  if (oblast && (oblast.w < zdroj.w || oblast.h < zdroj.h)) { ctx.strokeStyle = css('--danger') || 'red'; ctx.lineWidth = 2; ctx.strokeRect(oblast.x * k, oblast.y * k, oblast.w * k, oblast.h * k); }
  ctx.strokeStyle = css('--accent') || '#38f'; ctx.lineWidth = 2;
  ctx.strokeRect(V.ox * k, V.oy * k, platnoW() / V.s * k, platnoH() / V.s * k);
}
function prehledNaBod(e) {
  const r = $('prehled').getBoundingClientRect(), k = zdroj.w / r.width;
  vycentruj((e.clientX - r.left) * k, (e.clientY - r.top) * k);
}
$('prehled').addEventListener('pointerdown', e => { if (!zdroj) return; $('prehled').setPointerCapture(e.pointerId); prehledNaBod(e); });
$('prehled').addEventListener('pointermove', e => { if (zdroj && e.buttons) prehledNaBod(e); });

// ---------- výsledky ----------
const mm = px => cislo(px * 25.4 / zdroj.dpi) + ' mm';
const rok4 = r => r < 70 ? 2000 + r : 1900 + r;
const vyskytu = n => n === 1 ? 'výskyt' : n < 5 ? 'výskyty' : 'výskytů';

function vypisVysledky() {
  const r = rozb, m = r.mrizka, x = hlavniKod(), out = [];
  const naMrizce = r.sl ? r.sl.slozky.reduce((s, sl) => s + sl.pocet, 0) : 0;
  if (x) {
    out.push(`<div class="karta verdikt kod"><h3>🔴 Nalezen čitelný kód (typ Xerox DocuColor)</h3>
      <p>Datum a čas tisku podle hodin tiskárny:</p>
      <p class="velke">${x.den}. ${x.mesic}. ${rok4(x.rok)} &nbsp; ${x.hodina}:${dva(x.minuta)}</p>
      <p>Sériové číslo tiskárny:</p>
      <p class="velke" style="letter-spacing:.08em">${esc(x.serie)}</p>
      <p>Jistota: <span class="stitek ${x.jistota === 'vysoká' ? 'vysoka' : 'stredni'}">${x.jistota}</span>
      <span class="mala">– bez rozporu sedí na ${x.podpora} ${vyskytu(x.podpora)} vzoru, přečteno ${x.pocet}× (${x.presne}× bez doplnění)</span></p>
      <div class="radek"><button class="tl" id="btnPrvni">🔎 Ukázat výskyt</button><button class="tl" id="btnDoDek">🧮 Do dekodéru</button></div>
      <p class="mala">Rok je uložen bez století. Hodina může být v UTC nebo podle špatně nastavených hodin. Sériové číslo může mít jen 6 platných číslic (úvodní 00).</p>
    </div>`);
    out.push(`<div class="karta"><h3>Dekódovaná mřížka 15 × 8</h3><canvas class="matice" id="matice"></canvas>
      <p class="mala">Orientace na skenu: ${esc(x.orientace)}. Horní řada a levý sloupec jsou parita, čísla dole jsou hodnoty sloupců.</p>
      <div class="obal-tab"><table class="udaje">${tabulkaXerox(x)}</table></div></div>`);
  } else if (r.xerox.length) {
    out.push(`<div class="karta verdikt nasel"><h3>🟠 Pravděpodobně vzor Xerox DocuColor – nečitelný</h3>
      <p>Mřížka teček obsahuje okna se správnou paritou typu Xerox DocuColor, ale žádné čtení nemá dost opory, aby šlo věřit. Nejčastěji je kód zakrytý tiskem.</p>
      <p>Zkuste rozebrat oblast s prázdným papírem (▭ Oblast), sken s vyšším rozlišením, nebo bity opište v 🧮 Dekodéru. Nejlepší slabé čtení je dole.</p></div>`);
  } else if (m && naMrizce >= 30) {
    out.push(`<div class="karta verdikt nasel"><h3>🟡 Tečky tiskárny nalezeny</h3>
      <p>Na snímku je <b>pravidelná mřížka žlutých teček</b> – stránku nejspíš tiskla barevná laserová tiskárna nebo kopírka se sledovacím kódem.</p>
      <p>Kódování tohoto vzoru není veřejně popsané (nejde o typ Xerox DocuColor), takže z něj nejde přečíst sériové číslo ani čas. Struktura je níže; dva výtisky porovná záložka 🗂️ Porovnání.</p></div>`);
  } else if (r.tecky.length >= 20) {
    out.push(`<div class="karta verdikt nasel"><h3>🟠 Žluté body bez pravidelné mřížky</h3>
      <p>Našlo se ${r.tecky.length} žlutých bodů, ale netvoří pravidelný vzor. Může jít o šum, barevný tisk, nebo je snímek pro tečky málo ostrý.</p>
      <p>Zkuste sken v 600 dpi do PNG, oblast s prázdným papírem nebo vyšší citlivost.</p></div>`);
  } else {
    out.push(`<div class="karta verdikt nic"><h3>🟢 Žluté tečky nenalezeny</h3>
      <p>Na rozebírané části žádný vzor teček není. Možné důvody:</p>
      <ul><li>stránku tiskla černobílá laserová nebo inkoustová tiskárna,</li>
      <li>snímek má malé rozlišení nebo je z JPEG / fotky z mobilu,</li>
      <li>skener „vyčistil" pozadí, nebo jde o oblast plnou černého tisku.</li></ul>
      <p class="mala">Absence teček není důkaz, že výtisk nic nekóduje.</p></div>`);
  }
  out.push(`<div class="karta"><h3>Měření</h3><table class="udaje">${tabulkaMereni()}</table></div>`);
  const p = r.perioda;
  if (p && p.dlazdice && !x) {
    out.push(`<div class="karta"><h3>Opakující se dlaždice</h3>
      <p>Vzor se opakuje každých <b>${p.a} × ${p.b}</b> buněk mřížky${p.transponovano ? ' (svisle × vodorovně)' : ''}${p.c ? ` (další řada posunutá o ${p.c})` : ''}${m ? ` – tj. ${mm(p.a * (p.transponovano ? m.py : m.px))} × ${mm(p.b * (p.transponovano ? m.px : m.py))}` : ''}.</p>
      <canvas class="matice" id="dlazdice"></canvas>
      <p class="mala">Zachyceno ${Math.round(100 * p.skoreA)} % / ${Math.round(100 * p.skoreB)} % opakování. Dlaždice je složená ze všech opakování (většinové hlasování), takže zakryté tečky doplní.</p></div>`);
  }
  const dalsi = r.xerox.slice(x ? 1 : 0, 6);
  if (dalsi.length) {
    out.push(`<div class="karta"><h3>Další (slabší) čtení</h3><p class="mala">Okna se správnou paritou, ale s malou oporou v ostatních výskytech – nejspíš náhoda nebo poškozená tečka.</p><table class="udaje">
      ${dalsi.map(h => `<tr><td>${h.den}. ${h.mesic}. ${h.rok} ${h.hodina}:${dva(h.minuta)}</td><td>${esc(h.serie)} <span class="stitek nizka">${h.podpora}×</span></td></tr>`).join('')}</table></div>`);
  }
  $('vysledky').innerHTML = out.join('');
  if (x) {
    kresliMatici($('matice'), x.bity, 15, 8, { hodnoty: x.val, parita: true });
    $('btnPrvni').onclick = () => vyberVyskyt(x, 0, true);
    $('btnDoDek').onclick = () => { dekNastav(x.bity); prepniZalozku('Dekoder'); };
  }
  if ($('dlazdice')) kresliMatici($('dlazdice'), p.dlazdice, p.a, p.b, {});
}

function tabulkaXerox(x) {
  return `<tr><td>Minuta (sl. 2)</td><td>${x.minuta}</td></tr>
    <tr><td>Hodina (sl. 5)</td><td>${x.hodina}</td></tr>
    <tr><td>Den / měsíc / rok (sl. 6–8)</td><td>${x.den} / ${x.mesic} / ${x.rok}</td></tr>
    <tr><td>Oddělovač (sl. 10)</td><td>${x.val[9]}${x.oddelovac ? ' ✓' : ' (neobvyklé – čekalo by se 127)'}</td></tr>
    <tr><td>Sériové číslo (sl. 14–11)</td><td>${[13, 12, 11, 10].map(c => dva(x.val[c])).join(' ')}</td></tr>
    <tr><td>Sloupec 15</td><td>${x.sloupec15}</td></tr>
    <tr><td>Nevyužité (sl. 3, 4, 9)</td><td>${x.nevyuzite.join(', ')}</td></tr>`;
}

function tabulkaMereni() {
  const r = rozb, m = r.mrizka;
  const naMrizce = r.sl ? r.sl.slozky.reduce((s, sl) => s + sl.pocet, 0) : 0;
  return `<tr><td>Žluté body</td><td>${r.tecky.length}${r.zahozeno ? ` <span class="mala">(+${r.zahozeno} větších skvrn vyřazeno)</span>` : ''}</td></tr>
    <tr><td>Z toho na mřížce</td><td>${naMrizce}${r.sl ? ` <span class="mala">v ${r.sl.slozky.length} skupinách</span>` : ''}</td></tr>
    ${m ? `<tr><td>Rozteč mřížky</td><td>${cislo(m.px)} × ${cislo(m.py)} px<br><span class="mala">${mm(m.px)} × ${mm(m.py)} při ${zdroj.dpi} dpi</span></td></tr>
    <tr><td>Natočení skenu</td><td>${cislo(m.uhel * 180 / Math.PI)}°</td></tr>
    <tr><td>Pravidelnost</td><td>${Math.round(50 * (m.kx + m.ky))} %</td></tr>` : ''}
    <tr><td>Práh žlutosti</td><td>${cislo(r.prah, 1)} <span class="mala">(šum ${cislo(r.sigma, 1)})</span></td></tr>`;
}

function kresliMatici(c, bity, W, H, o) {
  const b = Math.max(8, Math.min(20, Math.floor(320 / W))), dole = o.hodnoty ? 18 : 4;
  c.width = W * b + 8; c.height = H * b + 8 + dole;
  const ctx = c.getContext('2d');
  const barva = jm => o.tisk ? { '--bg-elevated': '#ffffff', '--border': '#999999', '--text': '#000000', '--danger': '#c00000' }[jm] : css(jm);
  ctx.fillStyle = barva('--bg-elevated') || '#eee'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = barva('--border') || '#999'; ctx.lineWidth = 1;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = 4 + i * b, y = 4 + j * b, k = j * W + i;
    if (o.parita && (i === 0 || j === 0)) { ctx.fillStyle = 'rgba(128,128,128,.18)'; ctx.fillRect(x, y, b, b); }
    ctx.strokeRect(x + .5, y + .5, b - 1, b - 1);
    const stavB = o.stavy ? o.stavy[k] : bity[k] ? 1 : 0;   // 1 tečka, 2 doplněno, 3 navíc
    if (stavB === 1) { ctx.fillStyle = '#e0b400'; ctx.beginPath(); ctx.arc(x + b / 2, y + b / 2, b * 0.32, 0, 7); ctx.fill(); }
    else if (stavB === 2) { ctx.strokeStyle = barva('--danger') || 'red'; ctx.setLineDash([2, 2]); ctx.beginPath(); ctx.arc(x + b / 2, y + b / 2, b * 0.3, 0, 7); ctx.stroke(); ctx.setLineDash([]); ctx.strokeStyle = barva('--border') || '#999'; }
    else if (stavB === 3) { ctx.strokeStyle = barva('--danger') || 'red'; ctx.beginPath(); ctx.moveTo(x + 3, y + 3); ctx.lineTo(x + b - 3, y + b - 3); ctx.moveTo(x + b - 3, y + 3); ctx.lineTo(x + 3, y + b - 3); ctx.stroke(); ctx.strokeStyle = barva('--border') || '#999'; }
  }
  if (o.hodnoty) {
    ctx.fillStyle = barva('--text') || '#000'; ctx.font = `${Math.max(7, b * 0.5)}px sans-serif`; ctx.textAlign = 'center';
    o.hodnoty.forEach((v, i) => { if (i) ctx.fillText(v, 4 + i * b + b / 2, H * b + 18); });
  }
}

// ---------- inspektor výskytu ----------
function vyberVyskyt(h, k, posunout) {
  vyber = { h, k };
  const mi = h.mista[k], sl = rozb.sl.slozky[mi.slozka], o = MIC.ORIENTACE.find(q => q.nazev === h.orientace);
  const stavy = new Uint8Array(120), videne = new Uint8Array(120);
  for (let q = 0; q < 120; q++) {
    const [di, dj] = o.mapa[q], x = mi.i - sl.imin + di, y = mi.j - sl.jmin + dj;
    const g = x >= 0 && y >= 0 && x < sl.W && y < sl.H ? sl.G[y * sl.W + x] : 0;
    videne[q] = g; stavy[q] = g && h.bity[q] ? 1 : !g && h.bity[q] ? 2 : g ? 3 : 0;
  }
  vyber.videne = videne;
  kresliMatici($('inspMatice'), h.bity, 15, 8, { parita: true, stavy });
  const chybi = stavy.filter(v => v === 2).length;
  $('inspPopis').textContent = chybi ? `Doplněno podle parity: ${chybi} ${chybi === 1 ? 'tečka' : 'tečky'} (čárkovaný kroužek) – leží pod tmavým tiskem.` : 'Všechny tečky přečteny přímo ze skenu.';
  $('inspPoradi').textContent = `${k + 1} / ${h.mista.length}`;
  $('kartaInspektor').hidden = false;
  if (posunout) {
    const roh = rohyMista(mi), cx = roh.reduce((s, p) => s + p.x, 0) / 4 + rozb.posun.x, cy = roh.reduce((s, p) => s + p.y, 0) / 4 + rozb.posun.y;
    const sir = Math.hypot(roh[1].x - roh[0].x, roh[1].y - roh[0].y), vys = Math.hypot(roh[3].x - roh[0].x, roh[3].y - roh[0].y);
    vycentruj(cx, cy, Math.min(platnoW() / (sir * 1.8), platnoH() / (vys * 1.8), 40));
  } else kresli();
}
$('inspPred').onclick = () => { if (vyber) vyberVyskyt(vyber.h, (vyber.k - 1 + vyber.h.mista.length) % vyber.h.mista.length, true); };
$('inspDalsi').onclick = () => { if (vyber) vyberVyskyt(vyber.h, (vyber.k + 1) % vyber.h.mista.length, true); };
$('inspDoDek').onclick = () => { if (vyber) { dekNastav(vyber.videne); prepniZalozku('Dekoder'); } };

// ---------- ruční dekodér ----------
let dek = new Uint8Array(120), dekNavrh = -1;
(function stavMrizkuDek() {
  const g = $('mrizkaDek'), html = ['<span></span>'];
  for (let c = 0; c < 15; c++) html.push(`<span class="hl">${c + 1}</span>`);
  html.push('<span></span>');
  for (let r = 0; r < 8; r++) {
    html.push(`<span class="hl">${r === 0 ? 'P' : 2 ** (7 - r)}</span>`);
    for (let c = 0; c < 15; c++) html.push(`<button data-k="${r * 15 + c}" class="${r === 0 || c === 0 ? 'par' : ''}" aria-label="řada ${r + 1}, sloupec ${c + 1}"></button>`);
    html.push(`<span class="stav-p" id="dekR${r}"></span>`);
  }
  html.push('<span class="hl">Σ</span>');
  for (let c = 0; c < 15; c++) html.push(`<span class="stav-p" id="dekS${c}"></span>`);
  html.push('<span></span>');
  g.innerHTML = html.join('');
  g.addEventListener('click', e => { const b = e.target.closest('button[data-k]'); if (b) { dek[+b.dataset.k] ^= 1; dekObnov(); } });
})();
function dekNastav(bity) { dek = Uint8Array.from(bity); dekObnov(); }
function dekObnov() {
  const p = MIC.xeroxParita(dek), spS = [], spR = [];
  p.sloupce.forEach((ok, c) => { if (!ok) spS.push(c); });
  p.radky.forEach((ok, r) => { if (!ok) spR.push(r); });
  dekNavrh = spS.length === 1 && spR.length === 1 ? spR[0] * 15 + spS[0] : spS.length === 1 && spR.length === 0 ? spS[0] : -1;
  document.querySelectorAll('#mrizkaDek button[data-k]').forEach(b => {
    const k = +b.dataset.k, r = Math.floor(k / 15), c = k % 15;
    b.classList.toggle('je', !!dek[k]);
    b.classList.toggle('spatne', !p.sloupce[c] || !p.radky[r]);
    b.classList.toggle('navrh', k === dekNavrh);
    b.setAttribute('aria-pressed', dek[k] ? 'true' : 'false');
    b.setAttribute('aria-label', `řada ${r + 1}, sloupec ${c + 1}` + (k === dekNavrh ? ' – navržená oprava parity' : !p.sloupce[c] || !p.radky[r] ? ' – chyba parity' : ''));
  });
  for (let r = 0; r < 8; r++) $('dekR' + r).textContent = r === 0 ? '' : p.radky[r] ? '✓' : '✗';
  const val = MIC.xeroxHodnoty(dek);
  for (let c = 0; c < 15; c++) $('dekS' + c).textContent = p.sloupce[c] ? (c ? val[c] : '✓') : '✗';
  $('dekOpravit').disabled = dekNavrh < 0;
  const x = { ...MIC.xeroxDekoduj(val), val }, prazdne = !dek.some(Boolean);
  $('dekVysledek').innerHTML = prazdne ? '<tr><td>Mřížka je prázdná – klikejte na buňky, nebo zakódujte údaje vpravo.</td></tr>' :
    `<tr><td>Parita</td><td>${p.ok ? '<span class="stitek ok">v pořádku</span>' : `<span class="stitek vysoka">chyba</span> <span class="mala">${spS.length} sl. / ${spR.length} ř.</span>`}</td></tr>
    <tr><td>Hodnoty</td><td>${x.platne ? '<span class="stitek ok">věrohodné</span>' : '<span class="stitek stredni">mimo rozsah</span>'}</td></tr>
    <tr><td>Datum a čas</td><td><b>${x.den}. ${x.mesic}. ${rok4(x.rok)} ${x.hodina}:${dva(x.minuta)}</b></td></tr>
    <tr><td>Sériové číslo</td><td><b>${esc(x.serie)}</b></td></tr>` + tabulkaXerox(x);
}
$('dekVymazat').onclick = () => dekNastav(new Uint8Array(120));
$('dekOpravit').onclick = () => { if (dekNavrh >= 0) { dek[dekNavrh] ^= 1; dekObnov(); } };
$('dekRotace').onclick = () => { const n = new Uint8Array(120); for (let k = 0; k < 120; k++) n[119 - k] = dek[k]; dekNastav(n); };
$('dekZrcadlo').onclick = () => { const n = new Uint8Array(120); for (let r = 0; r < 8; r++) for (let c = 0; c < 15; c++) n[r * 15 + 14 - c] = dek[r * 15 + c]; dekNastav(n); };
$('dekZRozboru').onclick = () => { const x = hlavniKod() || (rozb && rozb.xerox[0]); if (x) dekNastav(x.bity); else Dialog.info('Rozbor zatím žádný kód nenašel.'); };
$('kodVytvor').onclick = () => {
  const t = $('kodCas').value ? new Date($('kodCas').value) : new Date(), serie = $('kodSerie').value.replace(/\D/g, '');
  const s15 = Math.max(0, Math.min(127, parseInt($('kodS15').value, 10) || 0));
  dekNastav(MIC.xeroxMatice({ minuta: t.getMinutes(), hodina: t.getHours(), den: t.getDate(), mesic: t.getMonth() + 1, rok: t.getFullYear() % 100, serie: serie || '0', sloupec15: s15 }));
};
(() => { const t = new Date(); t.setSeconds(0, 0); $('kodCas').value = new Date(t - t.getTimezoneOffset() * 60000).toISOString().slice(0, 16); dekObnov(); })();

// ---------- porovnání výtisků ----------
const dokumenty = [];
let porovBezi = false;
$('porovPridat').onclick = () => $('souborPorov').click();
$('souborPorov').onchange = e => { pridejSoubory([...e.target.files]); e.target.value = ''; };
$('porovVymazat').onclick = () => { dokumenty.length = 0; vypisPorovnani(); };
$('porovAktualni').onclick = () => { if (rozb) { dokumenty.push(souhrn(zdroj, rozb)); vypisPorovnani(); } };
const drop = $('porovDrop');
['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('nad'); }));
['dragleave', 'drop'].forEach(t => drop.addEventListener(t, () => drop.classList.remove('nad')));
drop.addEventListener('drop', e => { e.preventDefault(); pridejSoubory([...e.dataTransfer.files]); });

function souhrn(z, r) {
  const k = Math.min(1, 120 / z.w), { c, ctx } = noveP(Math.max(1, Math.round(z.w * k)), Math.max(1, Math.round(z.h * k)));
  ctx.drawImage(z.canvas, 0, 0, c.width, c.height);
  const x = r.xerox[0] && r.xerox[0].jistota !== 'nízká' ? r.xerox[0] : null;
  return {
    nazev: z.nazev, sha: z.sha, soubor: z.soubor, w: z.w, h: z.h, dpi: z.dpi, nahled: c.toDataURL('image/jpeg', 0.7),
    tecek: r.tecky.length, roztec: r.mrizka ? [r.mrizka.px * 25.4 / z.dpi, r.mrizka.py * 25.4 / z.dpi] : null,
    xerox: x && { serie: x.serie, s15: x.sloupec15, cas: `${x.den}. ${x.mesic}. ${rok4(x.rok)} ${x.hodina}:${dva(x.minuta)}`, jistota: x.jistota },
    perioda: !x && r.perioda && r.perioda.dlazdice ? r.perioda : null,
  };
}

async function pridejSoubory(soubory) {
  if (porovBezi) { Dialog.info('Počkejte, až doběhne předchozí rozbor.'); return; }
  porovBezi = true;
  try {
    for (let n = 0; n < soubory.length; n++) {
      const f = soubory[n];
      $('porovStav').textContent = `Rozebírám ${n + 1}/${soubory.length}: ${f.name}…`;
      $('porovPrubeh').hidden = false; $('porovPrubeh').value = 0;
      try {
        const p = await souborNaPlatno(f), dpi = p.dpi && p.dpi >= 72 ? p.dpi : +$('dpi').value || 600;
        const r = await MIC.rozborPruhy((y0, y1) => p.ctx.getImageData(0, y0, p.canvas.width, y1 - y0).data, p.canvas.width, p.canvas.height,
          { dpi, citlivost: +$('citlivost').value }, async q => { $('porovPrubeh').value = q; await pauza(); });
        dokumenty.push(souhrn({ canvas: p.canvas, w: p.canvas.width, h: p.canvas.height, nazev: f.name, sha: p.sha, soubor: f, dpi }, r));
        p.canvas.width = p.canvas.height = 0;          // uvolnit paměť
      } catch (e) {
        if (e !== ZRUSENO) { console.error(e); Dialog.chyba(`${f.name}: ${e.message || e}`); }
      }
      vypisPorovnani();
    }
  } finally {
    porovBezi = false; $('porovPrubeh').hidden = true; $('porovStav').textContent = '';
  }
}

// vztah dvou dokumentů: { uroven 0–3, text }
function vztah(a, b) {
  if (a.xerox && b.xerox) return a.xerox.serie === b.xerox.serie && a.xerox.s15 === b.xerox.s15
    ? { uroven: 3, text: 'stejné sériové číslo' } : { uroven: 0, text: 'jiné sériové číslo' };
  if (a.xerox || b.xerox) return { uroven: 0, text: 'jiný typ vzoru' };
  if (!a.perioda || !b.perioda) return { uroven: -1, text: 'nelze porovnat' };
  const ra = a.roztec && [...a.roztec].sort(), rb = b.roztec && [...b.roztec].sort();
  if (ra && rb && (Math.abs(ra[0] - rb[0]) > 0.03 * ra[0] || Math.abs(ra[1] - rb[1]) > 0.03 * ra[1])) return { uroven: 0, text: 'jiná rozteč mřížky' };
  const p = MIC.podobnostDlazdic(a.perioda, b.perioda);
  if (!p.podobnost) return { uroven: 0, text: 'jiná velikost dlaždice' };
  const pc = Math.round(p.podobnost * 100) + ' %' + (p.otoc ? ' (list otočený)' : '');
  return p.podobnost >= 0.9 ? { uroven: 3, text: 'shoda ' + pc } : p.podobnost >= 0.7 ? { uroven: 2, text: 'shoda ' + pc } : { uroven: 0, text: 'shoda ' + pc };
}

function vypisPorovnani() {
  $('porovVymazat').disabled = !dokumenty.length;
  // skupiny tiskáren: spojit dokumenty s úrovní ≥ 2
  const skup = dokumenty.map((_, i) => i), koren = i => skup[i] === i ? i : (skup[i] = koren(skup[i]));
  for (let i = 0; i < dokumenty.length; i++) for (let j = i + 1; j < dokumenty.length; j++)
    if (vztah(dokumenty[i], dokumenty[j]).uroven >= 2) skup[koren(j)] = koren(i);
  const cisla = new Map(), barvy = ['#ffd54f', '#81d4fa', '#a5d6a7', '#f48fb1', '#ce93d8', '#ffab91', '#b0bec5', '#e6ee9c'];
  const skupina = i => { const k = koren(i); if (!cisla.has(k)) cisla.set(k, cisla.size); return cisla.get(k); };
  $('porovTabulka').innerHTML = !dokumenty.length ? '' :
    `<tr><th>Tisk.</th><th></th><th>Soubor</th><th>Vzor</th><th>Sériové č. / dlaždice</th><th>Čas tisku</th><th>Rozteč</th><th>SHA-256</th></tr>` +
    dokumenty.map((d, i) => {
      const s = skupina(i);
      return `<tr data-i="${i}" title="Otevřít v Rozboru"><td><span class="skupina" style="background:${barvy[s % barvy.length]}">${s + 1}</span></td>
        <td class="nahl"><img src="${d.nahled}" alt=""></td><td>${esc(d.nazev)}<br><span class="mala">${d.w}×${d.h} px, ${d.dpi} dpi, ${d.tecek} bodů</span></td>
        <td>${d.xerox ? 'Xerox DocuColor' : d.perioda ? 'jiný výrobce' : d.tecek >= 20 ? 'nejasný' : 'bez teček'}</td>
        <td>${d.xerox ? `<b>${esc(d.xerox.serie)}</b> <span class="stitek ${d.xerox.jistota === 'vysoká' ? 'vysoka' : 'stredni'}">${d.xerox.jistota}</span>` : d.perioda ? `${d.perioda.a} × ${d.perioda.b}${d.perioda.c ? ' / ' + d.perioda.c : ''}` : '–'}</td>
        <td>${d.xerox ? d.xerox.cas : '–'}</td>
        <td>${d.roztec ? cislo(d.roztec[0]) + ' mm' : '–'}</td>
        <td class="mala" title="${d.sha || ''}">${d.sha ? d.sha.slice(0, 12) + '…' : '–'}</td></tr>`;
    }).join('');
  document.querySelectorAll('#porovTabulka tr[data-i]').forEach(tr => tr.onclick = () => {
    const d = dokumenty[+tr.dataset.i];
    if (d.soubor) { prepniZalozku('Rozbor'); nactiSoubor(d.soubor); } else Dialog.info('U tohoto dokumentu není uložený soubor (ukázka).');
  });
  if (dokumenty.length < 2) { $('porovMatice').innerHTML = dokumenty.length ? '<p class="mala">Přidejte aspoň dva výtisky.</p>' : ''; return; }
  const zn = { '-1': '–', 0: '✗', 2: '≈', 3: '✓' };
  $('porovMatice').innerHTML = `<h2>Shoda dvojic</h2><div class="obal-tab"><table class="udaje"><tr><th></th>${dokumenty.map((_, i) => `<th>${i + 1}</th>`).join('')}</tr>` +
    dokumenty.map((a, i) => `<tr><th>${i + 1}</th>${dokumenty.map((b, j) => {
      if (i === j) return '<td></td>';
      const v = vztah(a, b);
      return `<td title="${esc(v.text)}"><span class="stitek ${v.uroven === 3 ? 'ok' : v.uroven === 2 ? 'stredni' : 'nizka'}">${zn[v.uroven]}</span> <span class="mala">${esc(v.text)}</span></td>`;
    }).join('')}</tr>`).join('') + '</table></div>' +
    `<p class="mala">✓ stejná tiskárna · ≈ pravděpodobně stejná (liší se část dlaždice, např. čas tisku) · ✗ různé · – nelze porovnat. Číslo v prvním sloupci tabulky výše = odhadnutá tiskárna.</p>`;
}

// ---------- protokol a exporty ----------
function datumRozboru() { const t = new Date(); return `${t.getDate()}. ${t.getMonth() + 1}. ${t.getFullYear()} ${t.getHours()}:${dva(t.getMinutes())}`; }

async function naRozbor() {          // snímek výhledu potřebuje viditelné plátno
  if (!$('strRozbor').hidden && platnoW()) return;
  prepniZalozku('Rozbor');
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
}
function snimekPohledu() {
  const w = Math.min(1600, platnoW() * 2), h = Math.round(w * platnoH() / platnoW()), { c, ctx } = noveP(w, h);
  vykresli(ctx, w, h, w / platnoW());
  return c;
}

function protokolHTML() {
  const r = rozb, z = zdroj, x = hlavniKod(), ob = r.oblast;
  const verdikt = x ? `Nalezen čitelný kód typu Xerox DocuColor: tisk ${x.den}. ${x.mesic}. ${rok4(x.rok)} ${x.hodina}:${dva(x.minuta)}, sériové číslo ${esc(x.serie)}, jistota ${x.jistota} (${x.podpora} ${vyskytu(x.podpora)}).`
    : r.mrizka && r.sl && r.sl.slozky.length ? 'Nalezena pravidelná mřížka žlutých teček (kódování není veřejně popsané).'
      : r.tecky.length >= 20 ? 'Žluté body bez pravidelné mřížky.' : 'Žluté tečky nenalezeny.';
  const matice = x ? (() => { const c = document.createElement('canvas'); kresliMatici(c, x.bity, 15, 8, { hodnoty: x.val, parita: true, tisk: true }); return c.toDataURL(); })() : '';
  return `<div style="font-family:system-ui,sans-serif;color:#000;background:#fff;max-width:800px;margin:0 auto;padding:10px">
    <h1 style="font-size:20px;margin:0 0 4px">Protokol o rozboru sledovacích teček tiskárny (MIC)</h1>
    <p style="margin:0 0 12px;font-size:12px;color:#555">Vytvořeno ${datumRozboru()} nástrojem „Stopy tiskárny (MIC)" – rozbor proběhl v prohlížeči, soubor nebyl nikam odeslán.</p>
    <table style="border-collapse:collapse;width:100%;font-size:13px" border="1" cellpadding="5">
      <tr><td style="width:34%">Soubor</td><td>${esc(z.nazev)}</td></tr>
      <tr><td>Velikost souboru</td><td>${z.bajty ? z.bajty.toLocaleString('cs') + ' B' : '–'}</td></tr>
      <tr><td>SHA-256</td><td style="font-family:monospace;font-size:11px;word-break:break-all">${z.sha || '– (ukázka nebo nedostupné)'}</td></tr>
      <tr><td>Rozměr obrazu</td><td>${z.w} × ${z.h} px, ${z.dpi} dpi</td></tr>
      <tr><td>Oblast rozboru</td><td>${ob.w === z.w && ob.h === z.h ? 'celá stránka' : `x ${ob.x}, y ${ob.y}, ${ob.w} × ${ob.h} px`}</td></tr>
      <tr><td>Citlivost</td><td>${r.citlivost} × šum (práh ${cislo(r.prah, 1)})</td></tr>
      <tr><td>Doba výpočtu</td><td>${r.ms} ms</td></tr>
    </table>
    <h2 style="font-size:16px;margin:16px 0 6px">Závěr</h2><p style="font-size:14px">${verdikt}</p>
    ${x ? `<table style="border-collapse:collapse;width:100%;font-size:13px" border="1" cellpadding="5">${tabulkaXerox(x)}</table>
      <p><img src="${matice}" alt="mřížka" style="max-width:100%"></p>` : ''}
    <h2 style="font-size:16px;margin:16px 0 6px">Měření</h2>
    <table style="border-collapse:collapse;width:100%;font-size:13px" border="1" cellpadding="5">${tabulkaMereni()}</table>
    ${r.perioda && r.perioda.dlazdice && !x ? `<p style="font-size:13px">Perioda vzoru ${r.perioda.a} × ${r.perioda.b} buněk${r.perioda.c ? `, posun řad ${r.perioda.c}` : ''}.</p>` : ''}
    <h2 style="font-size:16px;margin:16px 0 6px">Výhled při vytvoření protokolu</h2>
    <p><img src="${snimekPohledu().toDataURL('image/jpeg', 0.85)}" alt="výhled" style="max-width:100%;border:1px solid #999"></p>
    <h2 style="font-size:16px;margin:16px 0 6px">Metoda a omezení</h2>
    <p style="font-size:12px">Tečky se hledají jako místa se zvýšenou žlutostí ((R+G)/2 − B) proti místnímu pozadí. Mřížka (úhel, rozteč) se odhaduje z polohy teček, kód Xerox DocuColor se čte podle popisu EFF (15 × 8, lichá parita) a ověřuje přiložením na všechny výskyty. Čas pochází z hodin tiskárny a může být nepřesný nebo v UTC; rok je bez století. Sériové číslo spojí s majitelem jen výrobce nebo prodejce. Nenalezení teček neprokazuje, že výtisk žádný kód nenese.</p>
  </div>`;
}

async function tiskniProtokol() {
  if (!rozb) return;
  await naRozbor();
  $('protokol').innerHTML = protokolHTML();
  setTimeout(() => print(), 50);
}

function stahni(blob, nazev) {
  if (!blob) { Dialog.chyba('Soubor se nepodařilo vytvořit (málo paměti?).'); return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = nazev; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
const zaklad = () => zdroj.nazev.replace(/\.[^.]+$/, '').replace(/[^\wÀ-ſ-]+/g, '_').slice(0, 60) || 'sken';
const doBlob = c => new Promise(r => c.toBlob(r, 'image/png'));

async function exportuj(co) {
  if (!rozb) return;
  if (co === 'pohled' || co === 'protokol') await naRozbor();
  if (co === 'cisty') {
    const puvodni = $('stav').textContent;
    stav('Čistím celý obrázek…');
    const c = await vytvorPohled('vycisteno', beh);
    if (!c) { stav(puvodni); return; }
    stahni(await doBlob(c), zaklad() + '_bez_tecek.png');
    stav('Uloženo. Ověřte výsledek: otevřete uložený soubor a pusťte na něj rozbor.');
  } else if (co === 'pohled') stahni(await doBlob(snimekPohledu()), zaklad() + '_pohled.png');
  else if (co === 'protokol') {
    stahni(new Blob([`<!DOCTYPE html><html lang="cs"><head><meta charset="utf-8"><title>Protokol MIC – ${esc(zdroj.nazev)}</title></head><body>${protokolHTML()}</body></html>`], { type: 'text/html' }), zaklad() + '_protokol.html');
  } else if (co === 'json') stahni(new Blob([JSON.stringify(dataJson(), null, 2)], { type: 'application/json' }), zaklad() + '_mic.json');
  else if (co === 'zprava') {
    try { await navigator.clipboard.writeText(zprava()); Dialog.info('Zpráva zkopírována do schránky'); }
    catch { Dialog.chyba('Schránka není dostupná'); }
  }
}

function dataJson() {
  const r = rozb, m = r.mrizka;
  return {
    nastroj: 'Stopy tiskárny (MIC)', vytvoreno: new Date().toISOString(),
    soubor: { nazev: zdroj.nazev, sha256: zdroj.sha, bajty: zdroj.bajty || null, sirka: zdroj.w, vyska: zdroj.h, dpi: zdroj.dpi },
    oblast: r.oblast, citlivost: r.citlivost, prah: r.prah, sum: r.sigma,
    tecek: r.tecky.length, vyrazeno: r.zahozeno,
    mrizka: m && { roztecPx: [m.px, m.py], roztecMm: [m.px * 25.4 / zdroj.dpi, m.py * 25.4 / zdroj.dpi], uhelStupne: m.uhel * 180 / Math.PI, pravidelnost: (m.kx + m.ky) / 2 },
    skupiny: r.sl ? r.sl.slozky.length : 0,
    xerox: r.xerox.slice(0, 5).map(h => ({
      serie: h.serie, minuta: h.minuta, hodina: h.hodina, den: h.den, mesic: h.mesic, rok: h.rok, sloupec15: h.sloupec15,
      hodnotySloupcu: h.val, oddelovac: h.oddelovac, orientace: h.orientace, jistota: h.jistota, podpora: h.podpora, cteni: h.pocet, presne: h.presne,
      vyskyty: h.mista.map(mi => { const roh = rohyMista(mi); return roh.map(p => [Math.round(p.x + r.posun.x), Math.round(p.y + r.posun.y)]); }),
    })),
    perioda: r.perioda && r.perioda.dlazdice ? { a: r.perioda.a, b: r.perioda.b, posun: r.perioda.c, dlazdice: Array.from(r.perioda.dlazdice).join('') } : null,
    tecky: r.tecky.slice(0, 20000).map(t => [Math.round((t.x + r.posun.x) * 10) / 10, Math.round((t.y + r.posun.y) * 10) / 10]),
  };
}

function zprava() {
  const r = rozb, m = r.mrizka, x = hlavniKod(), radky = ['Rozbor sledovacích teček tiskárny (MIC)', 'Soubor: ' + zdroj.nazev];
  if (zdroj.sha) radky.push('SHA-256: ' + zdroj.sha);
  radky.push(`Rozměr: ${zdroj.w}×${zdroj.h} px, ${zdroj.dpi} dpi`, 'Žluté body: ' + r.tecky.length);
  if (m) radky.push(`Mřížka: ${cislo(m.px)} × ${cislo(m.py)} px (${mm(m.px)} × ${mm(m.py)}), natočení ${cislo(m.uhel * 180 / Math.PI)}°`);
  if (x) {
    radky.push(`Kód Xerox DocuColor: tisk ${x.den}. ${x.mesic}. ${rok4(x.rok)} ${x.hodina}:${dva(x.minuta)}, sériové číslo ${x.serie}, jistota ${x.jistota} (${x.podpora} ${vyskytu(x.podpora)})`);
    radky.push('Hodnoty sloupců 1–15: ' + x.val.join(', '));
  } else if (r.perioda && r.perioda.dlazdice) radky.push(`Vzor jiného typu, perioda ${r.perioda.a} × ${r.perioda.b} buněk`);
  else radky.push('Čitelný kód nenalezen.');
  return radky.join('\n');
}

/* ============================================================
   vektorizace/ui.js – ovládání stránky Vektorizace
   (jádro: vektorizace/jadro.js, trasování ve Workeru vektorizace/worker.js)
   ============================================================ */
(function () {
  'use strict';
  const V = window.VEKTORIZACE;
  const $ = id => document.getElementById(id);
  const KLIC = 'webapp_vektorizace_nastaveni';
  const DB_JMENO = 'webapp_vektorizace', DB_STORE = 'soubory';
  const MAX_STRANA = 3000;        // větší obrázek se při načtení zmenší
  const MAX_ZPRAC = 4.5e6;        // max. pixelů po zvětšení

  if (window.top === window) document.body.classList.add('samostatne');

  /* ---------- nastavení ---------- */
  const VYCHOZI = {
    rezim: 'cb', styl: 'vypln', zvetseni: 'auto', rozmazani: 0,
    otsu: true, prah: 128, invert: false,
    barev: 6, kvantizace: 'kmeans', vrstveni: 'stoh', bezPozadi: false,
    skvrny: 4, krivky: '1', tolerance: 0.5, uhel: 45, osmi: true,
    sirkaMm: 100, tloustka: 0.3, des: '2', rel: true, jednaCesta: false, tolDxf: 0.05,
    pohled: 'vedle', uzly: false, obrysy: false, sachovnice: true
  };
  let nast = Object.assign({}, VYCHOZI);
  try { Object.assign(nast, JSON.parse(localStorage.getItem(KLIC) || '{}')); } catch (e) { /* poškozené nastavení */ }
  const ulozNast = () => { try { localStorage.setItem(KLIC, JSON.stringify(nast)); } catch (e) { /* plné úložiště */ } };

  /* ---------- stav ---------- */
  let zdroj = null;          // { canvas, w, h, nazev, data (ImageData) }
  let orez = null;           // {x,y,w,h} v pixelech zdroje
  let vys = null;            // výsledek jádra
  let svgText = '';
  let kres = null;           // { vrstvy:[Path2D], uzly:Float32Array }
  let pracuje = false;
  const pohled = { zoom: 1, ox: 0, oy: 0, posuv: 0.5 };

  /* ---------- formulář ---------- */
  const POLE = ['rezim', 'styl', 'zvetseni', 'rozmazani', 'otsu', 'prah', 'invert', 'barev', 'kvantizace', 'vrstveni', 'bezPozadi',
    'skvrny', 'krivky', 'tolerance', 'uhel', 'osmi', 'sirkaMm', 'tloustka', 'des', 'rel', 'jednaCesta', 'tolDxf'];
  const VYSTUPNI = new Set(['sirkaMm', 'tloustka', 'des', 'rel', 'jednaCesta', 'tolDxf']);
  function doFormulare() {
    for (const k of POLE) {
      const el = $(k); if (!el) continue;
      if (el.type === 'checkbox') el.checked = !!nast[k]; else el.value = nast[k];
    }
    popisky();
  }
  function popisky() {
    $('rozmazaniH').textContent = (+nast.rozmazani).toFixed(1) + ' px';
    $('prahH').textContent = nast.otsu ? (vys && vys.prah != null ? vys.prah + ' (Otsu)' : 'Otsu') : nast.prah;
    $('prah').disabled = nast.otsu;
    if (nast.otsu && vys && vys.prah != null) $('prah').value = vys.prah;
    $('barevH').textContent = nast.barev;
    $('skvrnyH').textContent = nast.skvrny + ' px';
    $('toleranceH').textContent = (+nast.tolerance).toFixed(1) + ' px';
    $('uhelH').textContent = nast.uhel >= 180 ? 'bez rohů' : nast.uhel + '°';
    $('skvrnyL').textContent = nast.rezim === 'stred' ? 'Skvrny a krátké výběžky do' : nast.rezim === 'barvy' ? 'Sloučit oblasti menší než' : 'Potlačit skvrny menší než';
    $('sekPrah').hidden = nast.rezim === 'barvy';
    $('sekBarvy').hidden = nast.rezim !== 'barvy';
    $('styl').disabled = nast.rezim === 'stred';
    const R = rozmeryZprac();
    $('vyskaMm').value = R && nast.sirkaMm > 0 ? +(nast.sirkaMm * R.H / R.W).toFixed(2) : '';
    $('vyskaMm').disabled = !(nast.sirkaMm > 0);
    document.querySelectorAll('[data-prikaz^="pohled-"]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.prikaz === 'pohled-' + nast.pohled)));
    document.querySelectorAll('[data-prikaz="uzly"]').forEach(b => b.setAttribute('aria-pressed', String(!!nast.uzly)));
    document.querySelectorAll('[data-prikaz="obrysy"]').forEach(b => b.setAttribute('aria-pressed', String(!!nast.obrysy)));
    document.querySelectorAll('[data-prikaz="sachovnice"]').forEach(b => b.setAttribute('aria-pressed', String(!!nast.sachovnice)));
  }
  for (const k of POLE) {
    const el = $(k); if (!el) continue;
    const ud = el.type === 'range' ? 'input' : 'change';
    el.addEventListener(ud, () => {
      nast[k] = el.type === 'checkbox' ? el.checked : (el.type === 'range' || el.type === 'number') ? +el.value : el.value;
      if (k === 'rezim' && nast.rezim === 'stred') nast.styl = 'vypln';
      ulozNast(); popisky();
      if (VYSTUPNI.has(k)) { obnovSvg(); kresli(); } else spust();
    });
  }
  $('vyskaMm').addEventListener('change', () => {
    const R = rozmeryZprac(), v = +$('vyskaMm').value;
    if (R && v > 0) { nast.sirkaMm = +(v * R.W / R.H).toFixed(3); $('sirkaMm').value = nast.sirkaMm; ulozNast(); obnovSvg(); }
  });
  $('btnVychozi').onclick = async () => {
    if (!await Dialog.potvrd('Vrátit všechna nastavení na výchozí hodnoty?')) return;
    const p = nast.pohled; nast = Object.assign({}, VYCHOZI, { pohled: p }); ulozNast(); doFormulare(); spust();
  };

  /* ---------- rozměry zpracování ---------- */
  function faktorZvetseni(w, h) {
    let k = nast.zvetseni === 'auto' ? (Math.max(w, h) < 500 ? Math.min(4, Math.ceil(800 / Math.max(w, h))) : 1) : +nast.zvetseni;
    while (k > 1 && w * h * k * k > MAX_ZPRAC) k--;
    return Math.max(1, k);
  }
  function rozmeryZprac() {
    if (!zdroj) return null;
    const r = orez || { x: 0, y: 0, w: zdroj.w, h: zdroj.h }, k = faktorZvetseni(r.w, r.h);
    return { W: Math.round(r.w * k), H: Math.round(r.h * k), k, r };
  }

  /* ---------- trasování (worker) ---------- */
  let worker = null, uloha = 0, casovac = 0;
  function novyWorker() {
    try { worker = new Worker('vektorizace/worker.js'); worker.onmessage = prijato; worker.onerror = () => { worker = null; }; }
    catch (e) { worker = null; }
  }
  function volbyJadra() {
    const R = rozmeryZprac();
    return {
      rezim: nast.rezim, styl: nast.rezim === 'stred' ? 'vypln' : nast.styl,
      orez: orez, zvetseni: R.k, rozmazani: +nast.rozmazani,
      prah: nast.otsu ? 'otsu' : +nast.prah, invert: !!nast.invert,
      barev: +nast.barev, kvantizace: nast.kvantizace, vrstveni: nast.vrstveni, bezPozadi: !!nast.bezPozadi,
      skvrny: +nast.skvrny, tolerance: +nast.tolerance, uhel: +nast.uhel, krivky: nast.krivky === '1', osmi: !!nast.osmi
    };
  }
  function spust() {
    if (!zdroj) return;
    clearTimeout(casovac);
    casovac = setTimeout(spustTed, 120);
  }
  function spustTed() {
    if (!zdroj) return;
    const id = ++uloha, volby = volbyJadra();
    if (pracuje && worker) { worker.terminate(); worker = null; }   // starou úlohu zahodit
    pracuje = true; stav();
    if (!worker) novyWorker();
    const kopie = new Uint8ClampedArray(zdroj.data.data);
    if (worker) worker.postMessage({ id, data: kopie, w: zdroj.w, h: zdroj.h, volby }, [kopie.buffer]);
    else setTimeout(() => {   // záloha bez workeru
      try { const t0 = Date.now(); const v = V.vektorizuj(kopie, zdroj.w, zdroj.h, volby); v.ms = Date.now() - t0; prijato({ data: { id, vys: v } }); }
      catch (err) { prijato({ data: { id, chyba: String(err.message || err) } }); }
    }, 0);
  }
  function prijato(e) {
    const { id, vys: v, chyba } = e.data;
    if (id !== uloha) return;
    pracuje = false;
    if (chyba) { Dialog.chyba('Trasování selhalo: ' + chyba); stav(); return; }
    const prvni = !vys || vys.w !== v.w || vys.h !== v.h;
    vys = v;
    pripravKresbu();
    obnovSvg();
    popisky(); paleta();
    if (prvni) prizpusob();
    kresli();
    document.body.dataset.hotovo = String(id);
  }
  function pripravKresbu() {
    const vrstvy = [], uzly = [];
    for (const v of vys.vrstvy) {
      const p = new Path2D();
      for (const t of v.tvary) for (const s of t.smycky) {
        p.addPath(new Path2D(V.dCesty(s, 3, false)));
        uzly.push(s.p0[0], s.p0[1], 1);
        for (let i = 0; i < s.s.length; i++) { const u = s.s[i]; uzly.push(u[u.length - 2], u[u.length - 1], s.r[i] ? 1 : 0); }
      }
      for (const c of v.cary) {
        p.addPath(new Path2D(V.dCesty(c, 3, false)));
        uzly.push(c.p0[0], c.p0[1], 1);
        for (const u of c.s) uzly.push(u[u.length - 2], u[u.length - 1], 0);
      }
      vrstvy.push(p);
    }
    kres = { vrstvy, uzly: new Float32Array(uzly) };
  }
  function volbySvg() {
    return { des: +nast.des, rel: !!nast.rel, sirkaMm: +nast.sirkaMm || 0, jednaCesta: !!nast.jednaCesta, tloustkaMm: +nast.tloustka || 0.3 };
  }
  function obnovSvg() {
    if (!vys) return;
    svgText = V.doSVG(vys, volbySvg());
    stav();
  }
  function paleta() {
    const el = $('paleta'); el.innerHTML = '';
    if (!vys || !vys.paleta) return;
    for (const v of vys.vrstvy) { const s = document.createElement('span'); s.style.background = v.barva; s.title = v.barva; el.appendChild(s); }
  }
  const kB = n => n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1).replace('.', ',') + ' kB' : (n / 1048576).toFixed(2).replace('.', ',') + ' MB';
  const cs = n => n.toLocaleString('cs-CZ');
  function stav() {
    const el = $('stav');
    if (!zdroj) { el.innerHTML = '<span>Žádný obrázek</span>'; return; }
    const R = rozmeryZprac(), c = [];
    c.push(`<span title="${esc(zdroj.nazev)}">🖼 <b>${esc(zkrat(zdroj.nazev, 28))}</b> ${zdroj.w}×${zdroj.h}</span>`);
    if (R.k > 1 || orez) c.push(`<span>zpracování ${R.W}×${R.H}${R.k > 1 ? ' (×' + R.k + ')' : ''}</span>`);
    if (pracuje) c.push('<span class="prace">⏳ trasuji…</span>');
    if (vys) {
      c.push(`<span>cest <b>${cs(vys.stat.cest)}</b></span>`, `<span>uzlů <b>${cs(vys.stat.uzlu)}</b></span>`);
      if (vys.vrstvy.length > 1) c.push(`<span>vrstev <b>${vys.vrstvy.length}</b></span>`);
      c.push(`<span>SVG <b>${kB(new Blob([svgText]).size)}</b></span>`);
      if (nast.sirkaMm > 0) c.push(`<span>📏 ${fmt(nast.sirkaMm)} × ${fmt(nast.sirkaMm * vys.h / vys.w)} mm</span>`);
      c.push(`<span>${vys.ms} ms</span>`);
    }
    el.innerHTML = c.join('');
  }
  const fmt = x => (+x.toFixed(1)).toLocaleString('cs-CZ');
  const zkrat = (s, n) => s.length > n ? s.slice(0, n - 1) + '…' : s;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- načtení obrázku ---------- */
  async function nactiBlob(blob, nazev, tichy) {
    let bmp;
    try { bmp = await createImageBitmap(blob); }
    catch (e) {
      if (!tichy) Dialog.chyba('Soubor se nepodařilo načíst jako obrázek.' + (/svg/i.test(blob.type) ? ' SVG už je vektor.' : ''));
      return false;
    }
    let w = bmp.width, h = bmp.height, zmenseno = false;
    if (Math.max(w, h) > MAX_STRANA) { const k = MAX_STRANA / Math.max(w, h); w = Math.round(w * k); h = Math.round(h * k); zmenseno = true; }
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bmp, 0, 0, w, h);
    zdroj = { canvas: c, w, h, nazev: nazev || 'obrazek', data: ctx.getImageData(0, 0, w, h) };
    orez = null; vys = null; kres = null;
    $('prazdne').hidden = true;
    orezInfo(); vys = null; popisky(); stav();
    spustTed();
    if (zmenseno && !tichy) Dialog.info(`Velký obrázek zmenšen na ${w}×${h} px.`);
    if (!tichy) ulozDoDb(blob, nazev);
    return true;
  }
  async function nactiSoubor(f) {
    if (!f) return;
    if (!/^image\//.test(f.type) && !/\.(png|jpe?g|webp|gif|bmp|avif|ico)$/i.test(f.name)) { Dialog.chyba('Tohle není obrázek: ' + f.name); return; }
    await nactiBlob(f, f.name.replace(/\.[^.]+$/, ''));
  }

  /* ---------- IndexedDB: poslední obrázek ---------- */
  function db() {
    return new Promise((ok, ko) => {
      const r = indexedDB.open(DB_JMENO, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(DB_STORE);
      r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error);
    });
  }
  async function ulozDoDb(blob, nazev) {
    try { const d = await db(); d.transaction(DB_STORE, 'readwrite').objectStore(DB_STORE).put({ blob, nazev, kdy: Date.now() }, 'posledni'); }
    catch (e) { /* bez IndexedDB se jen nepamatuje */ }
  }
  async function nactiZDb() {
    try {
      const d = await db();
      const z = await new Promise(ok => { const r = d.transaction(DB_STORE).objectStore(DB_STORE).get('posledni'); r.onsuccess = () => ok(r.result); r.onerror = () => ok(null); });
      if (z && z.blob) await nactiBlob(z.blob, z.nazev, true);
    } catch (e) { /* nic */ }
  }
  async function zapomenout() {
    try { const d = await db(); d.transaction(DB_STORE, 'readwrite').objectStore(DB_STORE).delete('posledni'); } catch (e) { /* nic */ }
    zdroj = null; vys = null; kres = null; orez = null; svgText = '';
    $('prazdne').hidden = false; orezInfo(); paleta(); stav(); kresli();
  }

  /* ---------- ukázky (kreslené na plátně, žádné soubory) ---------- */
  function ukazka(druh) {
    const c = document.createElement('canvas'), x = c.getContext('2d');
    if (druh === 'logo') {
      c.width = 640; c.height = 400; x.fillStyle = '#fff'; x.fillRect(0, 0, 640, 400);
      x.fillStyle = '#111';
      x.beginPath(); x.arc(150, 200, 120, 0, Math.PI * 2); x.arc(150, 200, 82, 0, Math.PI * 2, true); x.fill();
      x.beginPath();
      for (let i = 0; i < 10; i++) { const r = i % 2 ? 30 : 70, a = -Math.PI / 2 + i * Math.PI / 5; x.lineTo(150 + r * Math.cos(a), 200 + r * Math.sin(a)); }
      x.fill();
      x.font = 'bold 92px sans-serif'; x.textBaseline = 'middle'; x.fillText('Vektor', 290, 165);
      x.font = 'italic 44px serif'; x.fillText('bitmapa → SVG', 296, 255);
      x.fillRect(296, 292, 300, 8);
      nast.rezim = 'cb';
    } else if (druh === 'barvy') {
      c.width = 640; c.height = 420;
      x.fillStyle = '#9fd4f5'; x.fillRect(0, 0, 640, 420);
      x.fillStyle = '#ffd23f'; x.beginPath(); x.arc(520, 90, 50, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#4c9a2a'; x.beginPath(); x.moveTo(0, 300); x.bezierCurveTo(160, 200, 300, 260, 400, 280); x.bezierCurveTo(500, 300, 580, 230, 640, 250); x.lineTo(640, 420); x.lineTo(0, 420); x.fill();
      x.fillStyle = '#2f6b1a'; x.beginPath(); x.moveTo(0, 360); x.bezierCurveTo(200, 320, 400, 380, 640, 340); x.lineTo(640, 420); x.lineTo(0, 420); x.fill();
      x.fillStyle = '#d6452f'; x.fillRect(120, 220, 150, 110);
      x.fillStyle = '#6b3a1e'; x.beginPath(); x.moveTo(105, 225); x.lineTo(195, 150); x.lineTo(285, 225); x.fill();
      x.fillStyle = '#ffffff'; x.fillRect(140, 245, 36, 36); x.fillRect(214, 245, 36, 36);
      x.fillStyle = '#6b3a1e'; x.fillRect(181, 280, 28, 50);
      nast.rezim = 'barvy'; nast.barev = 7;
    } else {
      c.width = 600; c.height = 400; x.fillStyle = '#fff'; x.fillRect(0, 0, 600, 400);
      x.strokeStyle = '#151515'; x.lineWidth = 9; x.lineCap = 'round'; x.lineJoin = 'round';
      x.beginPath(); for (let t = 0; t < 26; t += 0.05) { const r = 4 + t * 4.2; x.lineTo(150 + r * Math.cos(t * 1.1), 190 + r * Math.sin(t * 1.1)); } x.stroke();
      x.beginPath(); for (let X = 300; X <= 560; X += 4) x.lineTo(X, 110 + 40 * Math.sin((X - 300) / 30)); x.stroke();
      x.beginPath(); x.moveTo(310, 330); x.lineTo(360, 210); x.lineTo(410, 330); x.moveTo(330, 280); x.lineTo(390, 280); x.stroke();
      x.beginPath(); x.moveTo(450, 330); x.bezierCurveTo(440, 200, 560, 200, 545, 260); x.bezierCurveTo(530, 320, 470, 300, 520, 340); x.stroke();
      nast.rezim = 'stred';
    }
    nast.styl = 'vypln'; ulozNast(); doFormulare();
    c.toBlob(b => nactiBlob(b, 'ukazka-' + druh));
  }

  /* ---------- ořez ---------- */
  let orezRezim = false, orezTah = null;
  function orezInfo() {
    $('orezInfo').textContent = orez ? `Ořez ${orez.w}×${orez.h} px od (${orez.x}, ${orez.y}).` : 'Celý obrázek.';
    $('btnOrezZrus').disabled = !orez;
    $('btnOrez').setAttribute('aria-pressed', String(orezRezim));
    $('oknoA').classList.toggle('orez', orezRezim);
  }
  function prepniOrez(zap) {
    if (!zdroj) return;
    orezRezim = zap; orezTah = null;
    if (zap && nast.pohled !== 'vedle') { nast.pohled = 'vedle'; popisky(); }
    rozvrzeni(); orezInfo(); kresli();
    if (zap) Dialog.info('Tažením na originálu vyberte oblast. Esc = zrušit.');
  }
  $('btnOrez').onclick = () => prepniOrez(!orezRezim);
  $('btnOrezZrus').onclick = () => { orez = null; orezInfo(); popisky(); vys = null; spustTed(); };
  // transformace pro ořez: celý zdroj vycentrovaný v plátně A
  function orezMeritko() {
    const c = $('platnoA'), W = c.clientWidth, H = c.clientHeight, k = Math.min(W / zdroj.w, H / zdroj.h) * 0.94;
    return { k, ox: (W - zdroj.w * k) / 2, oy: (H - zdroj.h * k) / 2 };
  }

  /* ---------- náhled ---------- */
  const plA = $('platnoA'), plB = $('platnoB');
  function rozvrzeni() {
    const jedno = nast.pohled !== 'vedle' && !orezRezim;
    $('oknoA').hidden = jedno;
    $('oknoB').hidden = orezRezim;
    $('posuv').hidden = !jedno;
    $('posuvTxt').textContent = nast.pohled === 'prolnuti' ? 'Originál ↔ vektor' : 'Originál | vektor';
    $('stitekB').textContent = jedno ? (nast.pohled === 'prolnuti' ? 'Prolnutí' : 'Originál | Vektor') : 'Vektor';
    $('stitekA').textContent = orezRezim ? 'Ořez – táhněte myší' : 'Originál';
  }
  function velikostPlatna(c) {
    const d = devicePixelRatio || 1, w = Math.max(1, Math.round(c.clientWidth * d)), h = Math.max(1, Math.round(c.clientHeight * d));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    return d;
  }
  function prizpusob() {
    const R = rozmeryZprac(); if (!R) return;
    const W = plB.clientWidth || 400, H = plB.clientHeight || 300;
    pohled.zoom = Math.min(W / R.W, H / R.H) * 0.94;
    pohled.ox = (W - R.W * pohled.zoom) / 2; pohled.oy = (H - R.H * pohled.zoom) / 2;
  }
  function sachovnice(ctx, w, h) {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
    if (!nast.sachovnice) return;
    ctx.fillStyle = '#e6e6e6';
    const k = 10;
    for (let y = 0; y < h; y += k) for (let x = (y / k) % 2 ? k : 0; x < w; x += 2 * k) ctx.fillRect(x, y, k, k);
  }
  function kresliOriginal(ctx, R) {
    ctx.imageSmoothingEnabled = pohled.zoom < 2;
    ctx.drawImage(zdroj.canvas, R.r.x, R.r.y, R.r.w, R.r.h, 0, 0, R.W, R.H);
  }
  function kresliVektor(ctx) {
    if (!kres) return;
    const z = pohled.zoom;
    vys.vrstvy.forEach((v, i) => {
      const p = kres.vrstvy[i];
      if (v.cary.length) {
        ctx.strokeStyle = v.barva; ctx.lineWidth = V.tloustkaPx(vys, volbySvg(), true); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(p);
      } else if (vys.styl === 'cary') {
        ctx.strokeStyle = v.barva; ctx.lineWidth = Math.max(1.2 / z, V.tloustkaPx(vys, volbySvg(), false)); ctx.stroke(p);
      } else {
        ctx.fillStyle = v.barva; ctx.fill(p, 'evenodd');
      }
    });
    if (nast.obrysy && vys.styl !== 'cary') {
      ctx.strokeStyle = '#e8318a'; ctx.lineWidth = 1 / z;
      for (const p of kres.vrstvy) ctx.stroke(p);
    }
    if (nast.uzly) {
      const u = kres.uzly, n = Math.min(u.length / 3, 80000), a = 4 / z;
      ctx.lineWidth = 1 / z;
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#1a6be0';
      const roh = new Path2D(), hl = new Path2D();
      for (let i = 0; i < n; i++) {
        const x = u[i * 3], y = u[i * 3 + 1];
        if (u[i * 3 + 2]) roh.rect(x - a / 2, y - a / 2, a, a);
        else { hl.moveTo(x + a / 2, y); hl.arc(x, y, a / 2, 0, Math.PI * 2); }
      }
      ctx.fill(hl); ctx.stroke(hl);
      ctx.fillStyle = '#e8318a'; ctx.fill(roh);
    }
  }
  function kresli() {
    rozvrzeni();
    for (const c of [plA, plB]) {
      if (c.offsetParent === null) continue;
      const d = velikostPlatna(c), ctx = c.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, c.width, c.height);
      if (!zdroj) continue;
      if (c === plA && orezRezim) {
        const m = orezMeritko();
        ctx.setTransform(d * m.k, 0, 0, d * m.k, d * m.ox, d * m.oy);
        ctx.drawImage(zdroj.canvas, 0, 0);
        const r = orezTah ? normRect(orezTah) : orez;
        if (r) {
          ctx.fillStyle = 'rgba(0,0,0,.45)';
          ctx.beginPath(); ctx.rect(0, 0, zdroj.w, zdroj.h); ctx.rect(r.x, r.y + r.h, r.w, -r.h); ctx.fill('evenodd');
          ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2 / m.k; ctx.setLineDash([6 / m.k, 4 / m.k]); ctx.strokeRect(r.x, r.y, r.w, r.h); ctx.setLineDash([]);
        }
        continue;
      }
      const R = rozmeryZprac();
      ctx.setTransform(d * pohled.zoom, 0, 0, d * pohled.zoom, d * pohled.ox, d * pohled.oy);
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, R.W, R.H); ctx.clip();
      if (c === plA) kresliOriginal(ctx, R);
      else if (nast.pohled === 'vedle') { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); sachovnice(ctx, c.width, c.height); ctx.restore(); kresliVektor(ctx); }
      else if (nast.pohled === 'prolnuti') {
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); sachovnice(ctx, c.width, c.height); ctx.restore();
        kresliOriginal(ctx, R);
        ctx.globalAlpha = pohled.posuv; kresliVektor(ctx); ctx.globalAlpha = 1;
      } else {   // posuvník: vlevo originál, vpravo vektor
        const xd = (c.clientWidth * pohled.posuv - pohled.ox) / pohled.zoom;
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); sachovnice(ctx, c.width, c.height); ctx.restore();
        kresliVektor(ctx);
        ctx.save(); ctx.beginPath(); ctx.rect(0, 0, Math.max(0, xd), R.H); ctx.clip(); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, R.W, R.H); kresliOriginal(ctx, R); ctx.restore();
        ctx.restore();
        ctx.setTransform(d, 0, 0, d, 0, 0);
        const X = c.clientWidth * pohled.posuv;
        ctx.strokeStyle = '#1a6be0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X, 0); ctx.lineTo(X, c.clientHeight); ctx.stroke();
        ctx.fillStyle = '#1a6be0'; ctx.beginPath(); ctx.arc(X, c.clientHeight / 2, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('⇔', X, c.clientHeight / 2);
        continue;
      }
      ctx.restore();
      ctx.strokeStyle = 'rgba(128,128,128,.6)'; ctx.lineWidth = 1 / pohled.zoom; ctx.strokeRect(0, 0, R.W, R.H);
    }
  }
  const normRect = t => {
    const x = Math.max(0, Math.min(t.x0, t.x1)), y = Math.max(0, Math.min(t.y0, t.y1));
    const x2 = Math.min(zdroj.w, Math.max(t.x0, t.x1)), y2 = Math.min(zdroj.h, Math.max(t.y0, t.y1));
    return { x: Math.round(x), y: Math.round(y), w: Math.round(x2 - x), h: Math.round(y2 - y) };
  };
  $('posuvHod').addEventListener('input', e => { pohled.posuv = e.target.value / 100; kresli(); });

  /* lupa a posun (myš, dotyk – dva prsty) */
  const ukaz = new Map();
  let tah = null;
  function lupa(f, cx, cy) {
    const z = Math.max(0.02, Math.min(64, pohled.zoom * f)); f = z / pohled.zoom;
    pohled.ox = cx - (cx - pohled.ox) * f; pohled.oy = cy - (cy - pohled.oy) * f; pohled.zoom = z;
    kresli();
  }
  for (const c of [plA, plB]) {
    c.addEventListener('wheel', e => {
      if (!zdroj || (orezRezim && c === plA)) return;
      e.preventDefault();
      const r = c.getBoundingClientRect();
      lupa(Math.exp(-e.deltaY * (e.deltaMode ? 0.05 : 0.0015)), e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
    c.addEventListener('pointerdown', e => {
      if (!zdroj) return;
      c.setPointerCapture(e.pointerId);
      const r = c.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      ukaz.set(e.pointerId, { x, y });
      if (orezRezim && c === plA) {
        const m = orezMeritko(), sx = (x - m.ox) / m.k, sy = (y - m.oy) / m.k;
        orezTah = { x0: sx, y0: sy, x1: sx, y1: sy }; return;
      }
      if (c === plB && nast.pohled === 'posuvnik' && Math.abs(x - c.clientWidth * pohled.posuv) < 14) { tah = { posuv: true }; return; }
      tah = { x, y, ox: pohled.ox, oy: pohled.oy };
      c.classList.add('tahne');
    });
    c.addEventListener('pointermove', e => {
      const r = c.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      if (orezTah && c === plA) { const m = orezMeritko(); orezTah.x1 = (x - m.ox) / m.k; orezTah.y1 = (y - m.oy) / m.k; kresli(); return; }
      if (!ukaz.has(e.pointerId)) return;
      const pred = ukaz.get(e.pointerId); ukaz.set(e.pointerId, { x, y });
      if (ukaz.size === 2) {   // štípnutí
        const [a, b] = [...ukaz.values()], jiny = [...ukaz.entries()].find(([k]) => k !== e.pointerId)[1];
        const d1 = Math.hypot(pred.x - jiny.x, pred.y - jiny.y), d2 = Math.hypot(a.x - b.x, a.y - b.y);
        if (d1 > 5) lupa(d2 / d1, (a.x + b.x) / 2, (a.y + b.y) / 2);
        tah = null; return;
      }
      if (!tah) return;
      if (tah.posuv) { pohled.posuv = Math.max(0, Math.min(1, x / c.clientWidth)); $('posuvHod').value = Math.round(pohled.posuv * 100); kresli(); return; }
      pohled.ox = tah.ox + x - tah.x; pohled.oy = tah.oy + y - tah.y; kresli();
    });
    const konec = e => {
      ukaz.delete(e.pointerId); c.classList.remove('tahne'); tah = null;
      if (orezTah && c === plA) {
        const r = normRect(orezTah); orezTah = null;
        if (r.w >= 4 && r.h >= 4) { orez = r; orezRezim = false; orezInfo(); vys = null; popisky(); spustTed(); }
        kresli();
      }
    };
    c.addEventListener('pointerup', konec); c.addEventListener('pointercancel', konec);
    c.addEventListener('dblclick', () => { if (!orezRezim) { prizpusob(); kresli(); } });
  }
  new ResizeObserver(() => kresli()).observe($('plocha'));

  /* ---------- export ---------- */
  function stahni(obsah, nazev, typ) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(obsah instanceof Blob ? obsah : new Blob([obsah], { type: typ }));
    a.download = nazev; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  const jmeno = pripona => (zdroj ? zdroj.nazev : 'vektor').replace(/[\\/:*?"<>|]+/g, '_') + pripona;
  function maVysledek() { if (!vys) { Dialog.info(zdroj ? 'Ještě se trasuje…' : 'Nejdřív otevřete obrázek.'); return false; } return true; }
  async function exportPng() {
    if (!maVysledek()) return;
    const navrh = nast.sirkaMm > 0 ? Math.round(nast.sirkaMm / 25.4 * 300) : vys.w * 2;
    const t = await Dialog.zeptej('Šířka PNG v pixelech' + (nast.sirkaMm > 0 ? ' (návrh = 300 DPI)' : ''), String(Math.min(navrh, 8000)));
    if (t == null) return;
    const W = Math.max(16, Math.min(10000, Math.round(+t) || 0)), H = Math.round(W * vys.h / vys.w);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      c.getContext('2d').drawImage(img, 0, 0, W, H);
      c.toBlob(b => stahni(b, jmeno('.png')), 'image/png');
    };
    img.onerror = () => Dialog.chyba('Náhled PNG se nepodařilo vykreslit.');
    img.src = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml' }));
  }

  /* ---------- nabídky a příkazy ---------- */
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
    if (b && !b.disabled) { e.stopPropagation(); zavriNabidky(); return prikaz(b.dataset.prikaz); }
    if (!e.target.closest('.nabidka')) zavriNabidky();
  });
  addEventListener('resize', zavriNabidky);

  async function vlozZeSchranky() {
    try {
      const polozky = await navigator.clipboard.read();
      for (const p of polozky) for (const t of p.types) if (t.startsWith('image/')) { await nactiBlob(await p.getType(t), 'schranka'); return; }
      Dialog.info('Ve schránce není obrázek.');
    } catch (e) { Dialog.info('Vložte obrázek klávesami Ctrl+V.'); }
  }

  function prikaz(p) {
    switch (p) {
      case 'otevrit': $('soubor').click(); break;
      case 'vlozit': vlozZeSchranky(); break;
      case 'ukazka-logo': ukazka('logo'); break;
      case 'ukazka-barvy': ukazka('barvy'); break;
      case 'ukazka-kresba': ukazka('kresba'); break;
      case 'zapomenout': zapomenout(); break;
      case 'pohled-vedle': case 'pohled-posuvnik': case 'pohled-prolnuti':
        nast.pohled = p.slice(7); if (orezRezim) orezRezim = false;
        pohled.posuv = nast.pohled === 'prolnuti' ? 0.6 : 0.5; $('posuvHod').value = pohled.posuv * 100;
        ulozNast(); popisky(); orezInfo(); rozvrzeni(); prizpusob(); kresli(); break;
      case 'uzly': nast.uzly = !nast.uzly; ulozNast(); popisky(); kresli(); break;
      case 'obrysy': nast.obrysy = !nast.obrysy; ulozNast(); popisky(); kresli(); break;
      case 'sachovnice': nast.sachovnice = !nast.sachovnice; ulozNast(); popisky(); kresli(); break;
      case 'prizpusobit': prizpusob(); kresli(); break;
      case 'lupa-1': { const c = plB; lupa(1 / pohled.zoom, c.clientWidth / 2, c.clientHeight / 2); break; }
      case 'exp-svg': if (maVysledek()) stahni(svgText, jmeno('.svg'), 'image/svg+xml'); break;
      case 'exp-dxf': if (maVysledek()) {
        const d = V.doDXF(vys, { sirkaMm: +nast.sirkaMm || 0, tolMm: +nast.tolDxf || 0.05 });
        stahni(d.text, jmeno('.dxf'), 'application/dxf');
        Dialog.info(`DXF: ${cs(d.pocet)} polyline` + (nast.sirkaMm > 0 ? ', jednotky mm.' : ', jednotky = pixely (nastavte šířku v mm).'));
      } break;
      case 'exp-png': exportPng(); break;
      case 'kop-svg': if (maVysledek()) navigator.clipboard.writeText(svgText).then(() => Dialog.info('SVG zkopírováno.'), () => Dialog.chyba('Schránka není dostupná.')); break;
      case 'napoveda': $('napoveda').hidden = false; $('zavriNapovedu').focus(); break;
    }
  }
  $('zavriNapovedu').onclick = () => { $('napoveda').hidden = true; };
  $('napoveda').addEventListener('click', e => { if (e.target === $('napoveda')) $('napoveda').hidden = true; });
  $('soubor').onchange = e => { nactiSoubor(e.target.files[0]); e.target.value = ''; };

  /* drag & drop a vložení */
  let hloubka = 0;
  addEventListener('dragenter', e => { if ([...e.dataTransfer.types].includes('Files')) { hloubka++; $('pretahni').hidden = false; e.preventDefault(); } });
  addEventListener('dragleave', () => { if (--hloubka <= 0) { hloubka = 0; $('pretahni').hidden = true; } });
  addEventListener('dragover', e => e.preventDefault());
  addEventListener('drop', e => {
    e.preventDefault(); hloubka = 0; $('pretahni').hidden = true;
    const f = [...(e.dataTransfer.files || [])].find(f => /^image\//.test(f.type)) || e.dataTransfer.files[0];
    if (f) nactiSoubor(f);
  });
  addEventListener('paste', e => {
    const it = [...(e.clipboardData ? e.clipboardData.items : [])].find(i => i.type.startsWith('image/'));
    if (it) { e.preventDefault(); nactiBlob(it.getAsFile(), 'schranka'); }
  });

  /* klávesy */
  addEventListener('keydown', e => {
    const vPoli = /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement && document.activeElement.tagName) && document.activeElement.type !== 'range' && document.activeElement.type !== 'checkbox';
    if (e.key === 'Escape') {
      if (!$('napoveda').hidden) { $('napoveda').hidden = true; return; }
      if (document.querySelector('.nabidka:not([hidden])')) return zavriNabidky();
      if (orezRezim) { prepniOrez(false); return; }
    }
    if (e.ctrlKey || e.metaKey) {
      const k = e.key.toLowerCase();
      if (k === 'o') { e.preventDefault(); prikaz('otevrit'); }
      else if (k === 's') { e.preventDefault(); prikaz(e.shiftKey ? 'exp-dxf' : 'exp-svg'); }
      return;
    }
    if (vPoli || e.altKey) return;
    const mapa = { '1': 'pohled-vedle', '2': 'pohled-posuvnik', '3': 'pohled-prolnuti', 'u': 'uzly', 'o': 'obrysy', 'f': 'prizpusobit', '0': 'lupa-1', 'F1': 'napoveda' };
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (mapa[k]) { e.preventDefault(); prikaz(mapa[k]); }
    else if (k === '+' || k === '=') lupa(1.25, plB.clientWidth / 2, plB.clientHeight / 2);
    else if (k === '-') lupa(0.8, plB.clientWidth / 2, plB.clientHeight / 2);
    else if (k === 'c' && zdroj) prepniOrez(!orezRezim);
  });

  /* ---------- start ---------- */
  doFormulare(); rozvrzeni(); kresli();
  nactiZDb();

  // pro testy
  window.VEKT_APP = { prikaz, ukazka, nactiBlob, stav: () => ({ vys, svgText, nast, orez, zdroj: zdroj && { w: zdroj.w, h: zdroj.h } }), nastav: (k, v) => { nast[k] = v; doFormulare(); spust(); }, setOrez: r => { orez = r; orezInfo(); vys = null; spustTed(); } };
})();

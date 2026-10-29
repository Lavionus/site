/* ============================================================
   puzzle_generator/ui.js – ovládání stránky, náhled, exporty, hra.
   Geometrie je v jadro.js (window.PUZZLE), tisk ve vystup.js.
   ============================================================ */
(function () {
  'use strict';
  const P = window.PUZZLE, V = window.PUZZLE_VYSTUP;
  const $ = id => document.getElementById(id);
  const KLIC = 'webapp_puzzle_generator_nastaveni';
  const VYCHOZI = {
    sirkaCm: 30, vyskaCm: 20, rezim: 'celkem', celkem: 24, sloupce: 6, radky: 4, druh: 'klasicke',
    tvar: 'klasicky', velikost: 10, nahodnost: 50, seed: 1, polomer: 0, whimsy: 'srdce', whimsyVel: 55,
    laser: 'vlasova', laserBarva: '#ff0000', laserTl: 0.01, cislaGrav: false,
    papir: '210x297', orientace: 'auto', okrajTisk: 10, dpiTisk: '300', caraTisk: 'cerna', caraTl: 0.3, rub: true, uvod: true,
    zoom: 1, cx: 0.5, cy: 0.5, zobrFoto: true, zobrCisla: false, zobrRub: false, zobrListy: false,
  };
  let st = Object.assign({}, VYCHOZI);
  try { Object.assign(st, JSON.parse(localStorage.getItem(KLIC) || '{}')); } catch (e) { /* poškozené nastavení */ }
  const uloz = () => { try { localStorage.setItem(KLIC, JSON.stringify(st)); } catch (e) { /* plné úložiště */ } };

  if (window.self === window.top) document.body.classList.add('samostatne');

  /* ---------- IndexedDB ---------- */
  let dbSlib = null;
  function db() {
    if (dbSlib) return dbSlib;
    dbSlib = new Promise((ok, chyba) => {
      const r = indexedDB.open('webapp_puzzle_generator', 1);
      r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('soubory'); d.createObjectStore('hry', { keyPath: 'id' }); };
      r.onsuccess = () => ok(r.result); r.onerror = () => chyba(r.error);
    });
    return dbSlib;
  }
  async function dbOp(store, rezim, fn) {
    const d = await db();
    return new Promise((ok, chyba) => {
      const t = d.transaction(store, rezim), s = t.objectStore(store), r = fn(s);
      t.oncomplete = () => ok(r && r.result); t.onerror = () => chyba(t.error);
    });
  }

  /* ---------- fotka ---------- */
  let foto = null, fotoNazev = '';
  async function nastavFoto(blob, nazev, ulozit) {
    try {
      const bmp = await createImageBitmap(blob);
      foto = bmp; fotoNazev = nazev || 'fotka';
      if (ulozit !== false) dbOp('soubory', 'readwrite', s => s.put({ blob, nazev: fotoNazev }, 'fotka')).catch(() => {});
      prekresli(); info();
    } catch (e) { Dialog.chyba('Obrázek se nepodařilo načíst (podporované jsou JPEG, PNG, WebP, GIF…).'); }
  }
  async function ukazkovaFotka() {
    const c = document.createElement('canvas'); c.width = 2400; c.height = 1600;
    const x = c.getContext('2d'), g = P.rng(17, 3);
    let gr = x.createLinearGradient(0, 0, 0, 1000); gr.addColorStop(0, '#2b5fa8'); gr.addColorStop(0.6, '#f2a65a'); gr.addColorStop(1, '#f7d488');
    x.fillStyle = gr; x.fillRect(0, 0, 2400, 1600);
    x.fillStyle = '#fff3c4'; x.beginPath(); x.arc(1650, 640, 120, 0, 7); x.fill();
    for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(255,255,255,${0.15 + g() * 0.25})`; x.beginPath(); x.ellipse(g() * 2400, g() * 450, 80 + g() * 160, 18 + g() * 20, 0, 0, 7); x.fill(); }
    const hory = [['#5b4a6b', 760, 260], ['#3f4f6e', 860, 200], ['#2f5d50', 980, 120]];
    for (const [barva, zaklad, amp] of hory) {
      x.fillStyle = barva; x.beginPath(); x.moveTo(0, 1600);
      for (let px = 0; px <= 2400; px += 40) x.lineTo(px, zaklad - amp * (0.5 + 0.5 * Math.sin(px / 260 + zaklad) * Math.cos(px / 610)) - g() * 25);
      x.lineTo(2400, 1600); x.fill();
    }
    gr = x.createLinearGradient(0, 1080, 0, 1600); gr.addColorStop(0, '#3d7fb5'); gr.addColorStop(1, '#173a5c');
    x.fillStyle = gr; x.fillRect(0, 1080, 2400, 520);
    x.fillStyle = 'rgba(255,240,190,.55)'; for (let i = 0; i < 26; i++) x.fillRect(1560 + (g() - 0.5) * 200, 1100 + i * 18, 60 + g() * 120, 4);
    for (let i = 0; i < 60; i++) {   // stromy na břehu
      const tx = g() * 2400, ty = 1040 + g() * 50, h = 80 + g() * 120;
      x.fillStyle = ['#1d3b2a', '#24492f', '#2f5a35'][i % 3]; x.beginPath(); x.moveTo(tx, ty - h); x.lineTo(tx - h * 0.28, ty); x.lineTo(tx + h * 0.28, ty); x.fill();
    }
    x.fillStyle = '#c0392b'; x.fillRect(560, 1190, 180, 34); x.fillStyle = '#fbeee0'; x.beginPath(); x.moveTo(600, 1190); x.lineTo(650, 1060); x.lineTo(700, 1190); x.fill();
    const blob = await new Promise(ok => c.toBlob(ok, 'image/jpeg', 0.92));
    await nastavFoto(blob, 'ukázka – jezero.jpg');
  }

  /* ---------- puzzle podle nastavení ---------- */
  let p = null, cestyRez = [], obrysCesta = null;
  function parametry() {
    const W = st.sirkaCm * 10, H = st.vyskaCm * 10;
    let s = st.sloupce, r = st.radky;
    if (st.rezim === 'celkem' && st.druh !== 'ctverce') { const m = P.mrizka(st.celkem, W, H); s = m.sloupce; r = m.radky; }
    return { sirka: W, vyska: H, sloupce: s, radky: r, druh: st.druh, tvar: st.tvar, velikost: st.velikost / 100, nahodnost: st.nahodnost / 100,
      polomer: st.polomer, whimsy: st.whimsy, whimsyVel: st.whimsyVel / 100, seed: st.seed };
  }
  function generuj() {
    p = P.generuj(parametry());
    const R = P.retezy(p);
    cestyRez = R.map(r => new Path2D(P.svgDRetez(p, r)));
    obrysCesta = new Path2D();
    for (const r of R) if (r.odkazy.every(([h]) => p.hrany[h].druh === 'okraj')) obrysCesta.addPath(new Path2D(P.svgDRetez(p, r)));
    prekresli(); info();
  }
  let casovac = null;
  const pozdeji = () => { clearTimeout(casovac); casovac = setTimeout(() => { uloz(); generuj(); }, 120); };

  /* ---------- ovládací prvky ---------- */
  const fmt = (x, d) => Number(x).toLocaleString('cs-CZ', { maximumFractionDigits: d == null ? 1 : d });
  for (const [k, v] of Object.entries(P.TVARY)) $('tvar').add(new Option(v.nazev, k));
  for (const [k, v] of Object.entries(P.WHIMSY)) $('whimsy').add(new Option(v, k));
  for (const [k, v] of Object.entries(P.PRESETY_LASER)) $('laser').add(new Option(v.nazev, k));
  $('laser').add(new Option('vlastní', 'vlastni'));
  const POLE = ['sirkaCm', 'vyskaCm', 'celkem', 'sloupce', 'radky', 'tvar', 'velikost', 'nahodnost', 'seed', 'polomer', 'whimsy', 'whimsyVel',
    'laser', 'laserBarva', 'laserTl', 'cislaGrav', 'papir', 'orientace', 'okrajTisk', 'dpiTisk', 'caraTisk', 'caraTl', 'rub', 'uvod', 'zoom'];
  function doFormulare() {
    for (const k of POLE) { const e = $(k); if (e.type === 'checkbox') e.checked = !!st[k]; else e.value = st[k]; }
    for (const [skup, klic] of [['druh', 'druh'], ['rezim', 'rezim']]) $(skup).querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.h === st[klic])));
    $('velikostOut').textContent = fmt(st.velikost) + ' %';
    $('nahodnostOut').textContent = st.nahodnost + ' %';
    $('polomerOut').textContent = st.polomer + ' mm';
    $('zoomOut').textContent = fmt(st.zoom, 2) + '×';
    const ctverce = st.druh === 'ctverce';
    $('bCelkem').hidden = st.rezim !== 'celkem' || ctverce; $('bMrizka').hidden = st.rezim === 'celkem' && !ctverce;
    $('rezim').hidden = ctverce;
    $('kZamky').querySelectorAll('input,select,button').forEach(e => { e.disabled = ctverce; });
    $('bWhimsy').hidden = st.druh !== 'whimsy';
    const max = ctverce ? 4 : 60, min = ctverce ? 2 : 1;
    for (const k of ['sloupce', 'radky']) { $(k).max = max; $(k).min = min; }
    document.querySelectorAll('[data-prikaz^="druh-"]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.prikaz === 'druh-' + st.druh)));
    for (const k of ['foto', 'cisla', 'rub', 'listy']) document.querySelectorAll(`[data-prikaz="zobr-${k}"]`).forEach(b => b.setAttribute('aria-pressed', String(!!st['zobr' + k[0].toUpperCase() + k.slice(1)])));
  }
  function zFormulare(e) {
    const k = e.target.id;
    if (!POLE.includes(k)) return;
    const el = e.target;
    if (el.type === 'checkbox') st[k] = el.checked;
    else if (el.type === 'number' || el.type === 'range') { const v = parseFloat(el.value); if (!isFinite(v)) return; st[k] = v; }
    else st[k] = el.value;
    if (k === 'sirkaCm' || k === 'vyskaCm') { st[k] = Math.max(3, Math.min(300, st[k])); $('predvolba').value = ''; }
    if (k === 'celkem') st.celkem = Math.max(2, Math.min(2000, Math.round(st.celkem)));
    if (k === 'sloupce' || k === 'radky') st[k] = Math.max(1, Math.min(60, Math.round(st[k])));
    if (k === 'laser' && P.PRESETY_LASER[st.laser]) { st.laserBarva = P.PRESETY_LASER[st.laser].barva; st.laserTl = P.PRESETY_LASER[st.laser].tloustka; }
    if (k === 'laserBarva' || k === 'laserTl') st.laser = 'vlastni';
    if (e.type === 'change') doFormulare();
    else { $('velikostOut').textContent = fmt(st.velikost) + ' %'; $('nahodnostOut').textContent = st.nahodnost + ' %'; $('polomerOut').textContent = st.polomer + ' mm'; $('zoomOut').textContent = fmt(st.zoom, 2) + '×'; }
    if (['laser', 'laserBarva', 'laserTl', 'cislaGrav', 'dpiTisk', 'caraTisk', 'caraTl', 'rub', 'uvod'].includes(k)) { uloz(); info(); if (k === 'laser') doFormulare(); return; }
    if (k === 'zoom' || ['papir', 'orientace', 'okrajTisk'].includes(k)) { uloz(); prekresli(); info(); return; }
    pozdeji();
  }
  document.querySelector('.panel').addEventListener('input', zFormulare);
  document.querySelector('.panel').addEventListener('change', zFormulare);
  $('predvolba').addEventListener('change', e => {
    if (!e.target.value) return;
    const [w, h] = e.target.value.split('x').map(Number); st.sirkaCm = w; st.vyskaCm = h; doFormulare(); pozdeji();
  });
  for (const skup of ['druh', 'rezim']) $(skup).addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    nastavDruh(skup, b.dataset.h);
  });
  function nastavDruh(klic, h) {
    st[klic] = h;
    if (klic === 'druh' && h === 'ctverce') { st.sloupce = Math.max(2, Math.min(4, st.sloupce)); st.radky = Math.max(2, Math.min(4, st.radky)); }
    if (klic === 'rezim' && h === 'mrizka') { const o = parametry(); st.sloupce = o.sloupce; st.radky = o.radky; }
    doFormulare(); pozdeji();
  }

  /* ---------- náhled ---------- */
  const platno = $('nahled'), ctx = platno.getContext('2d');
  let pohled = { s: 1, ox: 0, oy: 0 };
  const css = n => getComputedStyle(document.body).getPropertyValue(n).trim();
  function vyrez() {
    if (!foto) return null;
    const v = P.vyrez(foto.width, foto.height, p.sirka / p.vyska, st.zoom, st.cx, st.cy);
    return v;
  }
  function papir() { const [w, h] = st.papir.split('x').map(Number); return { w, h }; }
  function prekresli() {
    if (!p) return;
    const dpr = window.devicePixelRatio || 1, r = platno.getBoundingClientRect();
    platno.width = Math.max(1, Math.round(r.width * dpr)); platno.height = Math.max(1, Math.round(r.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, r.width, r.height);
    const okraj = 24, s = Math.min((r.width - 2 * okraj) / p.sirka, (r.height - 2 * okraj) / p.vyska);
    pohled = { s, ox: (r.width - p.sirka * s) / 2, oy: (r.height - p.vyska * s) / 2 };
    ctx.save(); ctx.translate(pohled.ox, pohled.oy);
    // podklad tvaru (zaoblené rohy) – ořez podle obrysu
    const obrys = new Path2D();
    obrys.addPath(obrysCesta, new DOMMatrix([s, 0, 0, s, 0, 0]));
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 12;
    ctx.fillStyle = '#ffffff'; ctx.fill(obrys); ctx.restore();
    const v = vyrez();
    if (st.zobrRub) {
      ctx.save(); ctx.translate(p.sirka * s, 0); ctx.scale(-s, s);
      ctx.strokeStyle = '#9aa0a6'; ctx.lineWidth = 1 / s;
      for (const c of cestyRez) ctx.stroke(c);
      ctx.restore();
      ctx.fillStyle = '#202124'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `600 ${Math.max(7, P.vyskaCisla(p) * s)}px Arial, sans-serif`;
      for (const k of p.kusy) ctx.fillText(k.cislo, (p.sirka - k.stred[0]) * s, k.stred[1] * s);
    } else {
      if (v && st.zobrFoto) { ctx.save(); ctx.clip(obrys); ctx.drawImage(foto, v.x, v.y, v.w, v.h, 0, 0, p.sirka * s, p.vyska * s); ctx.restore(); }
      ctx.save(); ctx.scale(s, s); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      const naFotce = v && st.zobrFoto;
      if (naFotce) { ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 2.4 / s; for (const c of cestyRez) ctx.stroke(c); }
      ctx.strokeStyle = naFotce ? 'rgba(255,255,255,.95)' : '#d0021b'; ctx.lineWidth = (naFotce ? 1 : 1.2) / s;
      for (const c of cestyRez) ctx.stroke(c);
      ctx.restore();
      if (st.zobrCisla) {
        ctx.font = `600 ${Math.max(7, P.vyskaCisla(p) * s * 0.8)}px Arial, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.fillStyle = '#1a1a1a';
        for (const k of p.kusy) { ctx.strokeText(k.cislo, k.stred[0] * s, k.stred[1] * s); ctx.fillText(k.cislo, k.stred[0] * s, k.stred[1] * s); }
      }
    }
    if (st.zobrListy) {
      const L = P.listy(p.sirka, p.vyska, papir(), { okraj: st.okrajTisk, orientace: st.orientace });
      ctx.setLineDash([6, 4]); ctx.strokeStyle = css('--accent') || '#2862bb'; ctx.lineWidth = 1.5;
      ctx.font = '600 13px Arial, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      for (const l of L.listy) {
        const lx = st.zobrRub ? p.sirka - l.x - l.w : l.x;
        ctx.strokeRect(lx * s, l.y * s, l.w * s, l.h * s);
        ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(lx * s + 3, l.y * s + 3, 28, 18);
        ctx.fillStyle = '#fff'; ctx.fillText(l.oznaceni, lx * s + 6, l.y * s + 5);
      }
      ctx.setLineDash([]);
    }
    ctx.restore();
  }
  new ResizeObserver(() => prekresli()).observe($('obalNahled'));

  // posun výřezu tažením, přiblížení kolečkem
  let tah = null;
  platno.addEventListener('pointerdown', e => {
    if (!foto || !p) return;
    tah = { x: e.clientX, y: e.clientY, cx: st.cx, cy: st.cy }; platno.setPointerCapture(e.pointerId); platno.classList.add('tahne');
  });
  platno.addEventListener('pointermove', e => {
    if (!tah) return;
    const v = vyrez(), k = v.w / (p.sirka * pohled.s);   // px fotky na px obrazovky
    const x = tah.cx * foto.width - (e.clientX - tah.x) * k * (st.zobrRub ? -1 : 1), y = tah.cy * foto.height - (e.clientY - tah.y) * k;
    const n = P.vyrez(foto.width, foto.height, p.sirka / p.vyska, st.zoom, x / foto.width, y / foto.height);
    st.cx = (n.x + n.w / 2) / foto.width; st.cy = (n.y + n.h / 2) / foto.height;
    prekresli();
  });
  const konecTahu = () => { if (!tah) return; tah = null; platno.classList.remove('tahne'); uloz(); info(); };
  platno.addEventListener('pointerup', konecTahu); platno.addEventListener('pointercancel', konecTahu);
  platno.addEventListener('wheel', e => {
    if (!foto) return;
    e.preventDefault();
    st.zoom = Math.max(1, Math.min(4, st.zoom * Math.exp(-e.deltaY * 0.0015)));
    const v = vyrez(); st.cx = (v.x + v.w / 2) / foto.width; st.cy = (v.y + v.h / 2) / foto.height;
    $('zoom').value = st.zoom; $('zoomOut').textContent = fmt(st.zoom, 2) + '×';
    prekresli(); info(); clearTimeout(casovac); casovac = setTimeout(uloz, 300);
  }, { passive: false });

  /* ---------- informace ---------- */
  function info() {
    if (!p) return;
    const n = p.kusy.length;
    const casti = [`<b>${n}</b> dílků (${p.sloupce} × ${p.radky}${p.whimsy ? ' + whimsy' : ''})`, `puzzle <b>${fmt(p.sirka / 10)} × ${fmt(p.vyska / 10)} cm</b>`, `dílek ≈ ${fmt(p.cw, 0)} × ${fmt(p.ch, 0)} mm`];
    if (p.kolize) casti.push(`<span class="zle">${p.kolize} kolizí zámků – zmenšete zámky</span>`);
    const v = vyrez();
    let fotoTxt = 'Bez fotky se generuje jen řezací šablona.';
    if (v) {
      const d = P.dpi(v.w, p.sirka), h = P.hodnotDpi(d);
      const slovo = { dobre: '✓ výborné pro tisk', pozor: '⚠ použitelné, ostrost znatelně slabší', zle: '✗ málo – fotka bude rozmazaná' }[h];
      casti.push(`fotka <span class="${h}">${Math.round(d)} DPI ${slovo}</span>`);
      fotoTxt = `<b>${fotoNazev.replace(/[<&]/g, '')}</b> – ${foto.width} × ${foto.height} px, výřez ${Math.round(v.w)} × ${Math.round(v.h)} px → <span class="${h}">${Math.round(d)} DPI</span> v rozměru ${fmt(p.sirka / 10)} × ${fmt(p.vyska / 10)} cm.`
        + (h !== 'dobre' ? ` Pro 240 DPI by puzzle mělo mít nejvýš ${fmt(v.w / 240 * 2.54)} cm na šířku.` : '');
    }
    $('stav').innerHTML = casti.join(' · ');
    $('infoFoto').innerHTML = fotoTxt;
    $('infoDilky').textContent = st.druh === 'ctverce' ? `Dětské puzzle: ${p.sloupce} × ${p.radky} čtverců bez zámků (2–4 v každém směru).`
      : `Mřížka ${p.sloupce} × ${p.radky} = ${p.sloupce * p.radky} dílků${p.whimsy ? ' + 1 tvar uprostřed' : ''}, dílek ${fmt(p.cw, 0)} × ${fmt(p.ch, 0)} mm.`;
    const L = P.listy(p.sirka, p.vyska, papir(), { okraj: st.okrajTisk, orientace: st.orientace });
    const stran = L.listy.length * (st.rub ? 2 : 1) + (st.uvod ? 1 : 0);
    $('infoListy').textContent = `${L.listy.length} ${L.listy.length === 1 ? 'list' : L.listy.length < 5 ? 'listy' : 'listů'} ${L.papir.w > L.papir.h ? 'na šířku' : 'na výšku'} (${L.sloupcu} × ${L.radku}), PDF bude mít ${stran} stran${stran === 1 ? 'u' : ''}.`;
  }

  /* ---------- exporty ---------- */
  const nazevSouboru = (ext, pripona) => `puzzle_${p.kusy.length}dilku_${fmt(p.sirka / 10)}x${fmt(p.vyska / 10)}cm${pripona || ''}.${ext}`.replace(/,/g, '_');
  function stahni(blob, nazev) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nazev;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  // výřez fotky v rozlišení pro tisk (max. ~40 Mpx)
  function vyrezPlatno(dpi) {
    const v = vyrez(); if (!v) return null;
    let w = Math.round(p.sirka / 25.4 * dpi), h = Math.round(p.vyska / 25.4 * dpi);
    const k = Math.min(1, Math.sqrt(40e6 / (w * h)), 14000 / Math.max(w, h));
    w = Math.max(1, Math.round(w * k)); h = Math.max(1, Math.round(h * k));
    if (w > v.w * 1.0001) { w = Math.round(v.w); h = Math.round(v.h); }   // nezvětšovat nad skutečné pixely
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(foto, v.x, v.y, v.w, v.h, 0, 0, w, h);
    return c;
  }
  const BARVY_TISK = { cerna: [0, 0, 0], bila: [255, 255, 255], seda: [128, 128, 128] };
  let pismoSlib = null;
  function nactiPismo() {
    if (window.FONTY_JS && window.FONTY_JS['LiberationSans-Regular.ttf']) return Promise.resolve(window.FONTY_JS['LiberationSans-Regular.ttf']);
    if (pismoSlib) return pismoSlib;
    pismoSlib = new Promise(ok => {
      const s = document.createElement('script'); s.src = 'stitky_panely/fonty/LiberationSans-Regular.ttf.js';
      s.onload = () => ok((window.FONTY_JS || {})['LiberationSans-Regular.ttf'] || null);
      s.onerror = () => { pismoSlib = null; ok(null); };
      document.head.appendChild(s);
    });
    return pismoSlib;
  }
  async function varovaniDpi() {
    const v = vyrez(); if (!v) return true;
    const d = P.dpi(v.w, p.sirka);
    if (d >= 150) return true;
    return Dialog.potvrd(`Fotka má ve zvolené velikosti jen ${Math.round(d)} DPI a v tisku bude rozmazaná.\nPokračovat i tak?`);
  }
  const EXPORTY = {
    svg() {
      stahni(new Blob([P.svgRez(p, { barva: st.laserBarva, tloustka: st.laserTl, cisla: st.cislaGrav })], { type: 'image/svg+xml' }), nazevSouboru('svg', '_rez'));
      Dialog.info('SVG uloženo – rozměr 1:1 v mm, každá hrana jen jednou.');
    },
    svgRub() { stahni(new Blob([P.svgRub(p)], { type: 'image/svg+xml' }), nazevSouboru('svg', '_rub')); },
    dxf() { stahni(new Blob([P.dxf(p, { cisla: st.cislaGrav })], { type: 'application/dxf' }), nazevSouboru('dxf', '_rez')); },
    async pdf() {
      if (!window.jspdf) return Dialog.chyba('Knihovna jsPDF se nenačetla.');
      if (!(await varovaniDpi())) return;
      Dialog.info('Připravuji PDF…');
      await new Promise(r => setTimeout(r, 30));
      const pismo = await nactiPismo(), c = vyrezPlatno(+st.dpiTisk);
      const doc = V.pdf(window.jspdf.jsPDF, p, { papir: papir(), okraj: st.okrajTisk, orientace: st.orientace, foto: c ? c.toDataURL('image/jpeg', 0.9) : null,
        lic: true, rub: st.rub, uvod: st.uvod, cara: { rgb: BARVY_TISK[st.caraTisk], tl: st.caraTl }, pismo, nazev: 'Puzzle ' + p.kusy.length + ' dílků' });
      stahni(doc.output('blob'), nazevSouboru('pdf'));
    },
    async png(rub) {
      if (!rub && !(await varovaniDpi())) return;
      const dpi = +st.dpiTisk, c0 = rub ? null : vyrezPlatno(dpi);
      let mer = c0 ? c0.width / p.sirka : dpi / 25.4;
      mer = Math.min(mer, Math.sqrt(40e6 / (p.sirka * p.vyska)));
      const c = document.createElement('canvas'); c.width = Math.round(p.sirka * mer); c.height = Math.round(p.vyska * mer);
      V.kresli(c.getContext('2d'), p, { mer, foto: c0, cara: rub ? '#b0b0b0' : 'rgb(' + BARVY_TISK[st.caraTisk].join(',') + ')', tl: (rub ? 0.15 : st.caraTl) * mer, cisla: rub, rub, barvaCisel: '#000' });
      c.toBlob(b => b ? stahni(b, nazevSouboru('png', rub ? '_rub' : '')) : Dialog.chyba('PNG je příliš velké.'), 'image/png');
    },
  };

  /* ---------- příkazy, nabídky, klávesy ---------- */
  const PRIKAZY = {
    otevrit: () => $('soubor').click(),
    ukazka: () => ukazkovaFotka(),
    async odebrat() { foto = null; fotoNazev = ''; dbOp('soubory', 'readwrite', s => s.delete('fotka')).catch(() => {}); prekresli(); info(); },
    novyTvar: () => { st.seed = 1 + Math.floor(Math.random() * 999998); doFormulare(); pozdeji(); },
    prohodit: () => { [st.sirkaCm, st.vyskaCm] = [st.vyskaCm, st.sirkaCm]; [st.sloupce, st.radky] = [st.radky, st.sloupce]; doFormulare(); pozdeji(); },
    podleFotky: () => { if (!foto) return Dialog.info('Nejdřív nahrajte fotku.'); st.vyskaCm = Math.round(st.sirkaCm * foto.height / foto.width * 10) / 10; st.zoom = 1; doFormulare(); pozdeji(); },
    async vychozi() { if (await Dialog.potvrd('Vrátit všechna nastavení na výchozí?')) { st = Object.assign({}, VYCHOZI); doFormulare(); pozdeji(); } },
    svg: () => EXPORTY.svg(), svgRub: () => EXPORTY.svgRub(), dxf: () => EXPORTY.dxf(), pdf: () => EXPORTY.pdf(),
    png: () => EXPORTY.png(false), pngRub: () => EXPORTY.png(true),
    hrat: () => hraZacni(), ulozeneHry: () => seznamHer(),
    napoveda: () => $('dlgNapoveda').showModal(),
  };
  for (const d of ['klasicke', 'whimsy', 'ctverce']) PRIKAZY['druh-' + d] = () => nastavDruh('druh', d);
  for (const k of ['foto', 'cisla', 'rub', 'listy']) PRIKAZY['zobr-' + k] = () => { const kl = 'zobr' + k[0].toUpperCase() + k.slice(1); st[kl] = !st[kl]; uloz(); doFormulare(); prekresli(); };
  function prikaz(id) { zavriNabidky(); const f = PRIKAZY[id]; if (f && p) f(); }
  function zavriNabidky() {
    document.querySelectorAll('.nabidka:not([hidden])').forEach(n => { n.hidden = true; });
    document.querySelectorAll('[data-nabidka][aria-expanded="true"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
  }
  document.querySelectorAll('[data-nabidka]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    const n = $(b.dataset.nabidka), bylo = !n.hidden;
    zavriNabidky(); if (bylo) return;
    n.hidden = false; b.setAttribute('aria-expanded', 'true');
    const r = b.getBoundingClientRect();
    n.style.top = (r.bottom + 4) + 'px';
    n.style.left = Math.max(6, Math.min(r.left, innerWidth - n.offsetWidth - 6)) + 'px';
  }));
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-prikaz]');
    if (b && !b.disabled) { e.stopPropagation(); return prikaz(b.dataset.prikaz); }
    if (e.target.closest('[data-zavrit]')) return e.target.closest('dialog').close();
    if (!e.target.closest('.nabidka')) zavriNabidky();
  });
  addEventListener('resize', zavriNabidky);
  document.addEventListener('keydown', e => {
    const vPoli = /INPUT|SELECT|TEXTAREA/.test(document.activeElement && document.activeElement.tagName);
    if (G) return hraKlavesa(e);
    if (document.querySelector('dialog[open]')) return;
    const ctrl = e.ctrlKey || e.metaKey;
    if (e.key === 'Escape') return zavriNabidky();
    if (e.key === 'F1') { e.preventDefault(); return prikaz('napoveda'); }
    if (ctrl && e.key.toLowerCase() === 'o') { e.preventDefault(); return prikaz('otevrit'); }
    if (ctrl && e.key.toLowerCase() === 'e') { e.preventDefault(); return prikaz('svg'); }
    if (ctrl && e.key.toLowerCase() === 'p') { e.preventDefault(); return prikaz('pdf'); }
    if (vPoli || ctrl || e.altKey) return;
    if (e.key === 'r' || e.key === 'R') prikaz('novyTvar');
    if (e.key === 'g' || e.key === 'G') prikaz('hrat');
  });

  /* ---------- soubory: výběr, přetažení, schránka ---------- */
  $('zona').addEventListener('click', () => $('soubor').click());
  $('zona').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('soubor').click(); } });
  $('soubor').addEventListener('change', e => { const f = e.target.files[0]; if (f) { st.zoom = 1; st.cx = st.cy = 0.5; doFormulare(); nastavFoto(f, f.name); } e.target.value = ''; });
  document.addEventListener('dragover', e => { if ([...e.dataTransfer.types].includes('Files')) { e.preventDefault(); document.body.classList.add('nad'); } });
  document.addEventListener('dragleave', e => { if (!e.relatedTarget) document.body.classList.remove('nad'); });
  document.addEventListener('drop', e => {
    document.body.classList.remove('nad');
    const f = [...(e.dataTransfer.files || [])].find(f => f.type.startsWith('image/'));
    if (!f) return; e.preventDefault();
    st.zoom = 1; st.cx = st.cy = 0.5; doFormulare(); nastavFoto(f, f.name);
  });
  document.addEventListener('paste', e => {
    if (G) return;
    const it = [...(e.clipboardData && e.clipboardData.items || [])].find(i => i.type.startsWith('image/'));
    if (it) { st.zoom = 1; st.cx = st.cy = 0.5; doFormulare(); nastavFoto(it.getAsFile(), 'ze schránky.png'); }
  });

  /* ============================================================
     HRA
     ============================================================ */
  let G = null;
  const hp = $('hraPlatno'), hctx = hp.getContext('2d'), testCtx = document.createElement('canvas').getContext('2d');
  async function hraZacni(zaznam) {
    zavriNabidky();
    let obr, o, stav, id;
    if (zaznam) {
      try { obr = await createImageBitmap(zaznam.obrazek); } catch (e) { return Dialog.chyba('Uloženou hru se nepodařilo otevřít.'); }
      o = zaznam.o; stav = zaznam.stav; id = zaznam.id;
    } else {
      if (!foto) await ukazkovaFotka();
      if (!foto) return;
      o = parametry();
      if (p.kusy.length > 600 && !(await Dialog.potvrd(`Puzzle má ${p.kusy.length} dílků – na obrazovce to bude náročné. Pokračovat?`))) return;
      const c = vyrezPlatno(150), k = Math.min(1, 2400 / Math.max(c.width, c.height));
      const m = document.createElement('canvas'); m.width = Math.round(c.width * k); m.height = Math.round(c.height * k);
      m.getContext('2d').drawImage(c, 0, 0, m.width, m.height);
      obr = m; id = 'hra-' + Date.now();
    }
    const pz = P.generuj(o);
    if (!stav) stav = P.hraNova(pz, 1 + Math.floor(Math.random() * 1e6));
    G = { id, obrBlob: zaznam ? zaznam.obrazek : null, o, p: pz, hra: stav, obr, sousede: P.sousede(pz), cesty: [], sprity: [], predloha: false, okraje: false, zmena: false, hotovo: P.hotovo(stav), tah: null };
    G.tol = Math.max(2, 0.18 * pz.L0);
    pripravSprity();
    $('hra').hidden = false; document.documentElement.style.overflow = 'hidden'; $('hraCelkem').textContent = pz.kusy.length;
    $('hraNahled').setAttribute('aria-pressed', 'false'); $('hraOkraje').setAttribute('aria-pressed', 'false');
    hraVse(); hraInfo();
    G.tik = setInterval(() => { if (!G.hotovo && !document.hidden) { G.hra.cas++; hraInfo(); } }, 1000);
    G.auto = setInterval(() => { if (G && G.zmena) hraUloz(true); }, 15000);
  }
  function pripravSprity() {
    const pz = G.p, sp = Math.min(6, 2400 / Math.max(pz.sirka, pz.vyska)) * Math.min(2, window.devicePixelRatio || 1);
    G.sp = sp;
    G.okrajove = pz.kusy.map(k => k.obrys.some(([h]) => pz.hrany[h].druh === 'okraj'));
    pz.kusy.forEach((k, i) => {
      const cesta = new Path2D(P.svgDKus(pz, i));
      const body = P.body(P.cesta(pz, k.obrys), 6);
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const [x, y] of body) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      x0 -= 1; y0 -= 1; x1 += 1; y1 += 1;
      const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil((x1 - x0) * sp)); c.height = Math.max(1, Math.ceil((y1 - y0) * sp));
      const x = c.getContext('2d');
      x.scale(sp, sp); x.translate(-x0, -y0);
      x.save(); x.clip(cesta); x.drawImage(G.obr, 0, 0, pz.sirka, pz.vyska); x.restore();
      x.lineJoin = 'round';
      x.save(); x.clip(cesta);
      x.translate(0.25, 0.25); x.strokeStyle = 'rgba(0,0,0,.45)'; x.lineWidth = 0.9; x.stroke(cesta);
      x.translate(-0.5, -0.5); x.strokeStyle = 'rgba(255,255,255,.45)'; x.lineWidth = 0.7; x.stroke(cesta);
      x.restore();
      G.cesty[i] = cesta; G.sprity[i] = { c, x0, y0, w: x1 - x0, h: y1 - y0 };
    });
  }
  function hraVse() {
    const r = $('hraObal').getBoundingClientRect(), pz = G.p;
    let x0 = 0, y0 = 0, x1 = pz.sirka, y1 = pz.vyska;
    G.hra.kusy.forEach((k, i) => { const s = G.sprity[i]; x0 = Math.min(x0, s.x0 + k.ox); y0 = Math.min(y0, s.y0 + k.oy); x1 = Math.max(x1, s.x0 + s.w + k.ox); y1 = Math.max(y1, s.y0 + s.h + k.oy); });
    const s = Math.min((r.width - 20) / (x1 - x0), (r.height - 20) / (y1 - y0));
    G.v = { s, tx: (r.width - (x1 - x0) * s) / 2 - x0 * s, ty: (r.height - (y1 - y0) * s) / 2 - y0 * s };
    hraKresli();
  }
  function hraKresli() {
    if (!G) return;
    const dpr = window.devicePixelRatio || 1, r = $('hraObal').getBoundingClientRect();
    if (hp.width !== Math.round(r.width * dpr) || hp.height !== Math.round(r.height * dpr)) { hp.width = Math.round(r.width * dpr); hp.height = Math.round(r.height * dpr); }
    const x = hctx, pz = G.p, v = G.v;
    x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, r.width, r.height);
    x.translate(v.tx, v.ty); x.scale(v.s, v.s);
    // deska
    x.fillStyle = css('--bg-panel') || '#fff'; x.strokeStyle = css('--border-strong') || '#999'; x.lineWidth = 1.5 / v.s;
    x.fillRect(0, 0, pz.sirka, pz.vyska); x.strokeRect(0, 0, pz.sirka, pz.vyska);
    if (G.predloha) { x.globalAlpha = 0.28; x.drawImage(G.obr, 0, 0, pz.sirka, pz.vyska); x.globalAlpha = 1; }
    const poradi = G.hra.kusy.map((k, i) => i).sort((a, b) => G.hra.kusy[a].z - G.hra.kusy[b].z);
    const tazena = G.tah && G.tah.g != null ? G.tah.g : null;
    for (const i of poradi) {
      const k = G.hra.kusy[i], s = G.sprity[i];
      if (G.okraje && !G.okrajove[i] && !(k.ox === 0 && k.oy === 0)) continue;
      if (k.g === tazena) { x.save(); x.shadowColor = 'rgba(0,0,0,.45)'; x.shadowBlur = 10; x.shadowOffsetY = 4; }
      x.drawImage(s.c, s.x0 + k.ox, s.y0 + k.oy, s.w, s.h);
      if (k.g === tazena) x.restore();
    }
  }
  function hraInfo() {
    const c = G.hra.cas, m = Math.floor(c / 60), s = c % 60, h = Math.floor(m / 60);
    $('hraCas').textContent = (h ? h + ':' + String(m % 60).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
    $('hraMisto').textContent = P.naMiste(G.hra);
  }
  const svet = e => { const r = hp.getBoundingClientRect(); return [(e.clientX - r.left - G.v.tx) / G.v.s, (e.clientY - r.top - G.v.ty) / G.v.s]; };
  function zasah(w) {
    const poradi = G.hra.kusy.map((k, i) => i).sort((a, b) => G.hra.kusy[b].z - G.hra.kusy[a].z);
    for (const i of poradi) {
      const k = G.hra.kusy[i], s = G.sprity[i];
      if (G.okraje && !G.okrajove[i] && !(k.ox === 0 && k.oy === 0)) continue;
      const lx = w[0] - k.ox, ly = w[1] - k.oy;
      if (lx < s.x0 || ly < s.y0 || lx > s.x0 + s.w || ly > s.y0 + s.h) continue;
      if (testCtx.isPointInPath(G.cesty[i], lx, ly)) return i;
    }
    return -1;
  }
  hp.addEventListener('pointerdown', e => {
    if (!G) return;
    hp.setPointerCapture(e.pointerId);
    const w = svet(e), i = zasah(w);
    if (i >= 0 && !P.pevna(G.hra, G.hra.kusy[i].g) && !G.hotovo) {
      const g = G.hra.kusy[i].g, zmax = Math.max(...G.hra.kusy.map(k => k.z));
      let n = 1; for (const k of G.hra.kusy) if (k.g === g) k.z = zmax + n++;
      G.tah = { g, w };
    } else G.tah = { pan: true, x: e.clientX, y: e.clientY, tx: G.v.tx, ty: G.v.ty };
    hraKresli();
  });
  hp.addEventListener('pointermove', e => {
    if (!G || !G.tah) { if (G) hp.style.cursor = zasah(svet(e)) >= 0 ? 'grab' : 'default'; return; }
    if (G.tah.pan) { G.v.tx = G.tah.tx + e.clientX - G.tah.x; G.v.ty = G.tah.ty + e.clientY - G.tah.y; return hraKresli(); }
    const w = svet(e), dx = w[0] - G.tah.w[0], dy = w[1] - G.tah.w[1];
    for (const k of G.hra.kusy) if (k.g === G.tah.g) { k.ox += dx; k.oy += dy; }
    G.tah.w = w; hp.style.cursor = 'grabbing';
    hraKresli();
  });
  const hraPust = () => {
    if (!G || !G.tah) return;
    const t = G.tah; G.tah = null;
    if (!t.pan) {
      const r = P.prichyt(G.hra, G.p, G.sousede, t.g, G.tol);
      G.hra.tahu++; G.zmena = true;
      if (r.spojeni || r.deska) zvuk();
      if (P.hotovo(G.hra) && !G.hotovo) {
        G.hotovo = true;
        for (const k of G.hra.kusy) { k.ox = 0; k.oy = 0; }
        hraInfo(); hraKresli();
        dbOp('hry', 'readwrite', s => s.delete(G.id)).catch(() => {});
        G.zmena = false;
        Dialog.info(`🎉 Hotovo! ${G.p.kusy.length} dílků za ${$('hraCas').textContent} (${G.hra.tahu} tahů).`);
      }
      hraInfo();
    }
    hraKresli();
  };
  hp.addEventListener('pointerup', hraPust); hp.addEventListener('pointercancel', hraPust);
  hp.addEventListener('wheel', e => {
    if (!G) return; e.preventDefault();
    const r = hp.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, k = Math.exp(-e.deltaY * 0.0015);
    G.v.tx = mx - (mx - G.v.tx) * k; G.v.ty = my - (my - G.v.ty) * k; G.v.s *= k; hraKresli();
  }, { passive: false });
  new ResizeObserver(() => { if (G) hraKresli(); }).observe($('hraObal'));
  let audio = null;
  function zvuk() {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime;
      o.frequency.value = 660; g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      o.connect(g).connect(audio.destination); o.start(t); o.stop(t + 0.13);
    } catch (e) { /* bez zvuku */ }
  }
  function hraRozhazet() {
    const volne = [], hotove = new Set();
    G.hra.kusy.forEach((k, i) => { if (!hotove.has(k.g) && !P.pevna(G.hra, k.g)) { hotove.add(k.g); volne.push(i); } });
    const mista = P.rozmisteni(G.p, volne.length, Date.now() >>> 0);
    volne.forEach((i, n) => {
      const k = G.hra.kusy[i], st0 = G.p.kusy[i].stred, dx = mista[n][0] - st0[0] - k.ox, dy = mista[n][1] - st0[1] - k.oy, skup = k.g;
      for (const q of G.hra.kusy) if (q.g === skup) { q.ox += dx; q.oy += dy; }
    });
    G.zmena = true; hraVse();
  }
  async function hraUloz(tise) {
    if (!G || G.hotovo) return;
    const blob = await new Promise(ok => (G.obr.convertToBlob ? G.obr.convertToBlob({ type: 'image/jpeg', quality: 0.88 }).then(ok) : G.obr.toBlob ? G.obr.toBlob(ok, 'image/jpeg', 0.88) : ok(null)));
    if (!G.obrBlob && blob) G.obrBlob = blob;
    const zaznam = { id: G.id, datum: Date.now(), o: G.o, stav: G.hra, obrazek: G.obrBlob || blob, celkem: G.p.kusy.length, naMiste: P.naMiste(G.hra) };
    try { await dbOp('hry', 'readwrite', s => s.put(zaznam)); G.zmena = false; if (!tise) Dialog.info('Hra uložena v prohlížeči.'); }
    catch (e) { if (!tise) Dialog.chyba('Hru se nepodařilo uložit (plné úložiště?).'); }
  }
  async function hraKonec() {
    if (!G) return;
    if (G.zmena && !G.hotovo) await hraUloz(true);
    clearInterval(G.tik); clearInterval(G.auto);
    G = null; $('hra').hidden = true; document.documentElement.style.overflow = '';
  }
  $('hraKonec').addEventListener('click', hraKonec);
  $('hraUlozit').addEventListener('click', () => hraUloz(false));
  $('hraUklid').addEventListener('click', hraRozhazet);
  $('hraCelek').addEventListener('click', hraVse);
  const prepni = (tl, klic) => { G[klic] = !G[klic]; $(tl).setAttribute('aria-pressed', String(G[klic])); hraKresli(); };
  $('hraNahled').addEventListener('click', () => prepni('hraNahled', 'predloha'));
  $('hraOkraje').addEventListener('click', () => prepni('hraOkraje', 'okraje'));
  function hraKlavesa(e) {
    if (document.querySelector('dialog[open]')) return;
    const ctrl = e.ctrlKey || e.metaKey;
    if (e.key === 'Escape') { e.preventDefault(); return hraKonec(); }
    if (ctrl && e.key.toLowerCase() === 's') { e.preventDefault(); return hraUloz(false); }
    if (ctrl || e.altKey) return;
    if (e.key === 'h' || e.key === 'H') prepni('hraNahled', 'predloha');
    if (e.key === 'e' || e.key === 'E') prepni('hraOkraje', 'okraje');
    if (e.key === '0') hraVse();
  }
  addEventListener('beforeunload', () => { if (G && G.zmena) hraUloz(true); });

  async function seznamHer() {
    let hry = [];
    try { hry = await dbOp('hry', 'readonly', s => s.getAll()) || []; } catch (e) { /* bez IndexedDB */ }
    hry.sort((a, b) => b.datum - a.datum);
    const el = $('seznamHer'); el.innerHTML = '';
    if (!hry.length) el.innerHTML = '<p class="note">Zatím žádná rozehraná hra. Spusťte 🎮 Hrát – hra se průběžně ukládá.</p>';
    for (const h of hry) {
      const r = document.createElement('div'); r.className = 'radek';
      const img = document.createElement('img'); img.alt = ''; img.src = URL.createObjectURL(h.obrazek);
      const t = document.createElement('div');
      const m = Math.floor(h.stav.cas / 60);
      t.innerHTML = `<b>${h.celkem} dílků</b> · ${h.naMiste} na místě<br><small>${new Date(h.datum).toLocaleString('cs-CZ')} · čas ${m}:${String(h.stav.cas % 60).padStart(2, '0')}</small>`;
      const b = document.createElement('div'); b.style.cssText = 'display:flex;gap:4px;flex-wrap:wrap';
      const pokr = document.createElement('button'); pokr.className = 'btn primary'; pokr.textContent = '▶ Pokračovat';
      pokr.onclick = () => { $('dlgHry').close(); hraZacni(h); };
      const sm = document.createElement('button'); sm.className = 'btn'; sm.textContent = '🗑'; sm.title = 'Smazat';
      sm.onclick = async () => { if (await Dialog.potvrd('Smazat uloženou hru?')) { await dbOp('hry', 'readwrite', s => s.delete(h.id)); seznamHer(); } };
      b.append(pokr, sm); r.append(img, t, b); el.appendChild(r);
    }
    if (!$('dlgHry').open) $('dlgHry').showModal();
  }

  /* ---------- start ---------- */
  doFormulare();
  generuj();
  dbOp('soubory', 'readonly', s => s.get('fotka')).then(z => { if (z && z.blob && !foto) nastavFoto(z.blob, z.nazev, false); }).catch(() => {});
  window.PUZZLE_UI = { st: () => st, puzzle: () => p, ukazka: ukazkovaFotka, prikaz, hra: () => G, generuj: () => { uloz(); generuj(); }, nastav: o => { Object.assign(st, o); doFormulare(); uloz(); generuj(); } };
})();

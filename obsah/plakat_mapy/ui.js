/* plakat_mapy/ui.js – ovládání stránky Plakát mapy (náhled, panely, hledání, export, ukládání). */
(function () {
  'use strict';
  const P = window.PLAKAT;
  const $ = id => document.getElementById(id);
  const KLIC_POSLEDNI = 'webapp_plakat_mapy_posledni';
  const KLIC_ULOZENE = 'webapp_plakat_mapy_ulozene';
  const LIMIT_PLOCHY = 150e6;          // px plakátu – víc 2D plátno v prohlížeči spolehlivě neunese

  /* ---------- stav ---------- */
  let N = vychozi();
  function vychozi() {
    const n = JSON.parse(JSON.stringify(P.VYCHOZI));
    n.pal = P.kopiePalety(n.paleta);
    n.znackaPoloha = Object.assign({}, n.mesto);
    n.datum = mistniDatum(new Date());
    n.pasmo = -new Date().getTimezoneOffset() / 60;
    n.mezMag = 5.5;
    return n;
  }
  function mistniDatum(d) {
    const p = x => String(x).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  function ctiLS(k, vych) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : vych; } catch (e) { return vych; } }
  function pisLS(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  const ulozPrubezne = (() => { let t; return () => { clearTimeout(t); t = setTimeout(() => pisLS(KLIC_POSLEDNI, N), 400); }; })();

  /* ---------- mapa ---------- */
  let mapa = null, limitGL = 4096;
  function maWebGL() {
    try {
      const c = document.createElement('canvas'), gl = c.getContext('webgl2') || c.getContext('webgl');
      if (!gl) return false;
      const vp = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
      limitGL = Math.min(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), gl.getParameter(gl.MAX_TEXTURE_SIZE), vp[0], vp[1]);
      const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
      return true;
    } catch (e) { return false; }
  }
  const styl = () => P.generujStyl(N.pal, { popisky: N.popisky });

  function zalozMapu() {
    if (typeof maplibregl === 'undefined' || !maWebGL()) {
      $('mapa').innerHTML = '<div class="bezgl">Mapa potřebuje WebGL, které tento prohlížeč nemá zapnuté. Režim Hvězdná obloha funguje i bez něj.</div>';
      return;
    }
    mapa = new maplibregl.Map({
      container: 'mapa', style: styl(), center: [N.mesto.lon, N.mesto.lat], zoom: N.zoom, bearing: N.natoceni,
      attributionControl: false, fadeDuration: 0, maxZoom: 19, canvasContextAttributes: { antialias: true },
    });
    mapa.on('move', () => {
      const c = mapa.getCenter();
      N.mesto = { lat: c.lat, lon: c.lng }; N.zoom = mapa.getZoom(); N.natoceni = mapa.getBearing();
      synchronizujVyrez(); prekresli(false);
    });
    mapa.on('moveend', ulozPrubezne);
    mapa.on('error', e => { stav('Mapové dlaždice se nepodařilo načíst' + (navigator.onLine ? '' : ' (jste offline)') + '.'); console.warn(e && e.error); });
    mapa.on('idle', () => stav(''));
  }
  function stav(t) { $('stav').textContent = t; }
  function restyl() { if (mapa) mapa.setStyle(styl()); prekresli(); ulozPrubezne(); }

  /* ---------- náhled ---------- */
  let rNahled = null, cekaKresleni = false;
  const dpr = () => Math.min(3, window.devicePixelRatio || 1);
  function rozmerMm() { return P.rozmeryMm(N.format, N.orientace, N.vlastni); }
  function textSouradnic() {
    const b = N.rezim === 'mapa' && N.znacka !== 'zadna' && N.znackaPoloha ? N.znackaPoloha : N.mesto;
    return P.formatSouradnic(b.lat, b.lon);
  }
  const Nx = () => Object.assign({}, N, { textSouradnic: textSouradnic(), znacka: N.rezim === 'hvezdy' ? 'zadna' : N.znacka });

  function rozmistiNahled() {
    const main = $('hlavni'), mm = rozmerMm();
    const sirka = Math.max(120, main.clientWidth - 36), vyska = Math.max(160, main.clientHeight - 36);
    const m = Math.min(sirka / mm.s, vyska / mm.v);
    const w = Math.round(mm.s * m), h = Math.round(mm.v * m);
    const pl = $('plakat'); pl.style.width = w + 'px'; pl.style.height = h + 'px';
    for (const id of ['podklad', 'prekryv']) { const c = $(id); c.width = Math.round(w * dpr()); c.height = Math.round(h * dpr()); }
    rNahled = P.rozvrzeni(Nx(), w, h);
    const t = rNahled.tvar, md = $('mapa');
    Object.assign(md.style, { left: t.x + 'px', top: t.y + 'px', width: t.w + 'px', height: t.h + 'px',
      clipPath: N.tvar === 'obdelnik' ? 'none' : `path('${P.cestaTvaru(N.tvar, { x: 0, y: 0, w: t.w, h: t.h })}')` });
    md.style.visibility = N.rezim === 'mapa' ? 'visible' : 'hidden';
    if (mapa) mapa.resize();
    const px = P.rozmeryPx(mm, 300);
    $('nahledInfo').textContent = `${mm.s} × ${mm.v} mm · při 300 DPI ${px.w} × ${px.h} px`;
  }

  function prekresli(rozmistit = true) {
    if (cekaKresleni) { if (rozmistit) cekaKresleni = 'rozmistit'; return; }
    cekaKresleni = rozmistit ? 'rozmistit' : true;
    requestAnimationFrame(() => {
      const r = cekaKresleni === 'rozmistit'; cekaKresleni = false;
      if (r || !rNahled) rozmistiNahled(); else rNahled = P.rozvrzeni(Nx(), rNahled.W, rNahled.H);
      for (const id of ['podklad', 'prekryv']) {
        const ctx = $(id).getContext('2d');
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, $(id).width, $(id).height);
        ctx.setTransform(dpr(), 0, 0, dpr(), 0, 0);
        if (id === 'podklad') kresliPodklad(ctx, rNahled);
        else kresliPrekryv(ctx, rNahled, pinNahled());
      }
    });
  }
  function pinNahled() {
    if (!mapa || !N.znackaPoloha) return null;
    const p = mapa.project([N.znackaPoloha.lon, N.znackaPoloha.lat]);
    return { x: rNahled.tvar.x + p.x, y: rNahled.tvar.y + p.y };
  }

  /* ---------- kreslení plakátu (společné pro náhled i export) ---------- */
  const rodiny = { titulek: 'sans-serif', podtitulek: 'serif' };
  function kresliPodklad(ctx, r) {
    ctx.fillStyle = N.pal.plakat; ctx.fillRect(0, 0, r.W, r.H);
    if (N.rezim === 'hvezdy') kresliOblohu(ctx, r.tvar);
    else if (!mapa) { ctx.fillStyle = N.pal.pozadi; ctx.fill(new Path2D(P.cestaTvaru(N.tvar, r.tvar))); }
  }

  function kresliPrekryv(ctx, r, pin) {
    const pal = N.pal, k = r.k;
    if (r.prechod) {
      const g = ctx.createLinearGradient(0, r.prechod.y, 0, r.prechod.y + r.prechod.h);
      g.addColorStop(0, pruhledna(pal.plakat, 0)); g.addColorStop(0.45, pruhledna(pal.plakat, 0.85)); g.addColorStop(1, pruhledna(pal.plakat, 0.95));
      ctx.fillStyle = g; ctx.fillRect(r.prechod.x, r.prechod.y, r.prechod.w, r.prechod.h);
    }
    if (r.pruh) { ctx.fillStyle = pruhledna(pal.plakat, 0.9); ctx.fillRect(r.pruh.x, r.pruh.y, r.pruh.w, r.pruh.h); }
    if (r.ramecek) {
      ctx.strokeStyle = pal.text; ctx.lineWidth = r.ramecek.tloustka; ctx.lineJoin = 'round';
      ctx.stroke(new Path2D(P.cestaTvaru(N.tvar, r.tvar)));
      if (r.ramecek.druh === 'dvojity') {
        const d = r.ramecek.mezera + r.ramecek.tloustka, t = r.tvar;
        ctx.stroke(new Path2D(P.cestaTvaru(N.tvar, { x: t.x - d, y: t.y - d, w: t.w + 2 * d, h: t.h + 2 * d })));
      }
    }
    const zn = N.rezim === 'hvezdy' ? 'zadna' : N.znacka;
    if (pin && zn !== 'zadna' && uvnitr(pin, r.tvar)) {
      ctx.save(); ctx.clip(new Path2D(P.cestaTvaru(N.tvar, r.tvar)));
      kresliZnacku(ctx, zn, pin.x, pin.y, 0.045 * k, pal.pin, pal.plakat);
      ctx.restore();
    }
    ctx.fillStyle = pal.text; ctx.strokeStyle = pal.text; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    for (const t of r.texty) {
      if (t.druh === 'cara') {
        ctx.lineWidth = t.tloustka; ctx.beginPath(); ctx.moveTo(t.x - t.delka / 2, t.y); ctx.lineTo(t.x + t.delka / 2, t.y); ctx.stroke();
        continue;
      }
      const rod = t.druh === 'titulek' ? rodiny.titulek : rodiny.podtitulek;
      let vel = t.velikost;
      const nastav = () => { ctx.font = `${vel}px "${rod}", sans-serif`; ctx.letterSpacing = (t.prolozeni * vel / t.velikost).toFixed(2) + 'px'; };
      nastav();
      const max = r.W * 0.88, sir = ctx.measureText(t.text).width;
      if (sir > max) { vel *= max / sir; nastav(); }
      ctx.fillText(t.text, t.x + t.prolozeni * vel / t.velikost / 2, t.y);
    }
    ctx.letterSpacing = '0px';
    const a = r.atribuce;
    ctx.font = `${a.velikost}px sans-serif`; ctx.textAlign = 'right'; ctx.globalAlpha = 0.75;
    ctx.fillText(N.rezim === 'hvezdy' ? P.ATRIBUCE_OBLOHA : P.ATRIBUCE, a.x, a.y);
    ctx.globalAlpha = 1;
  }
  const uvnitr = (p, o) => p.x >= o.x && p.x <= o.x + o.w && p.y >= o.y && p.y <= o.y + o.h;
  function pruhledna(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  }
  function kresliZnacku(ctx, druh, x, y, s, barva, vypln) {
    ctx.fillStyle = barva; ctx.strokeStyle = barva;
    if (druh === 'pin') {
      const rr = s * 0.32, cy = y - s * 0.72;
      ctx.beginPath(); ctx.moveTo(x, y);
      ctx.bezierCurveTo(x - rr * 0.6, y - s * 0.3, x - rr, cy + rr * 0.5, x - rr, cy);
      ctx.arc(x, cy, rr, Math.PI, 0);
      ctx.bezierCurveTo(x + rr, cy + rr * 0.5, x + rr * 0.6, y - s * 0.3, x, y);
      ctx.fill();
      ctx.fillStyle = vypln; ctx.beginPath(); ctx.arc(x, cy, rr * 0.42, 0, 7); ctx.fill();
    } else if (druh === 'kruh') {
      ctx.lineWidth = s * 0.08; ctx.beginPath(); ctx.arc(x, y, s * 0.3, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, s * 0.09, 0, 7); ctx.fill();
    } else if (druh === 'srdce') {
      ctx.fill(new Path2D(P.cestaTvaru('srdce', { x: x - s * 0.35, y: y - s * 0.68, w: s * 0.7, h: s * 0.7 })));
    } else if (druh === 'hvezda') {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const rr = i % 2 ? s * 0.15 : s * 0.38, u = -Math.PI / 2 + i * Math.PI / 5;
        ctx.lineTo(x + rr * Math.cos(u), y + rr * Math.sin(u));
      }
      ctx.closePath(); ctx.fill();
    }
  }

  /* ---------- hvězdná obloha ---------- */
  let nebeData = null, nebeNacita = null, nebeCache = null;
  function nactiNebe() {
    if (nebeData || nebeNacita) return nebeNacita;
    nebeNacita = new Promise((ok, chyba) => {
      const s = document.createElement('script'); s.src = 'dalekohled/data.js';
      s.onload = () => { nebeData = window.DALEK_DATA; ok(); prekresli(); };
      s.onerror = () => { nebeNacita = null; chyba(new Error('katalog hvězd se nenačetl')); };
      document.head.appendChild(s);
    });
    return nebeNacita;
  }
  function casOblohy() {
    const m = /^(\d+)-(\d+)-(\d+)T(\d+):(\d+)/.exec(N.datum || '');
    if (!m) return Date.now();
    return Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5]) - (+N.pasmo || 0) * 3600e3;
  }
  function vypoctiNebe() {
    const ms = casOblohy(), klic = [ms, N.mesto.lat.toFixed(3), N.mesto.lon.toFixed(3), N.mezMag].join('|');
    if (nebeCache && nebeCache.klic === klic) return nebeCache;
    nebeCache = { klic, hvezdy: P.hvezdyNaObloze(nebeData.H, ms, N.mesto.lat, N.mesto.lon, +N.mezMag || 5.5),
      cary: P.caryNaObloze(nebeData.SOUHVEZDI, ms, N.mesto.lat, N.mesto.lon) };
    return nebeCache;
  }
  function kresliOblohu(ctx, o) {
    const pal = N.pal;
    ctx.save();
    ctx.clip(new Path2D(P.cestaTvaru(N.tvar, o)));
    ctx.fillStyle = pal.obloha; ctx.fillRect(o.x, o.y, o.w, o.h);
    const cx = o.x + o.w / 2, cy = o.y + o.h / 2, R = Math.min(o.w, o.h) / 2 * (N.tvar === 'kruh' ? 1 : 0.94);
    if (!nebeData) {
      ctx.fillStyle = pal.hvezdy; ctx.font = `${R * 0.06}px sans-serif`; ctx.textAlign = 'center';
      ctx.fillText('Načítám katalog hvězd…', cx, cy); ctx.restore(); nactiNebe(); return;
    }
    const n = vypoctiNebe();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.clip();
    ctx.strokeStyle = pal.hvezdy;
    if (N.mrizka) {
      ctx.globalAlpha = 0.22; ctx.lineWidth = Math.max(0.5, R * 0.0016);
      for (const h of [30, 60]) { const rr = P.projekce(h, 0).y * -R; ctx.beginPath(); ctx.arc(cx, cy, rr, 0, 7); ctx.stroke(); }
      for (let az = 0; az < 360; az += 30) { const p = P.projekce(0, az); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + p.x * R, cy + p.y * R); ctx.stroke(); }
    }
    if (N.souhvezdi) {
      ctx.globalAlpha = 0.5; ctx.lineWidth = Math.max(0.5, R * 0.0022); ctx.beginPath();
      for (const [x1, y1, x2, y2] of n.cary) { ctx.moveTo(cx + x1 * R, cy + y1 * R); ctx.lineTo(cx + x2 * R, cy + y2 * R); }
      ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.fillStyle = pal.hvezdy;
    for (const h of n.hvezdy) {
      ctx.beginPath(); ctx.arc(cx + h.x * R, cy + h.y * R, Math.max(0.35, P.polomerHvezdy(h.mag, R)), 0, 7); ctx.fill();
    }
    ctx.restore();
    if (N.tvar !== 'kruh') {          // obzor a světové strany
      ctx.save(); ctx.clip(new Path2D(P.cestaTvaru(N.tvar, o)));
      ctx.strokeStyle = pal.hvezdy; ctx.globalAlpha = 0.6; ctx.lineWidth = Math.max(0.6, R * 0.003);
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();
      if (N.tvar === 'obdelnik') {
        ctx.fillStyle = pal.hvezdy; ctx.font = `${R * 0.035}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const d = R * 1.03;
        [['S', 0, -d], ['J', 0, d], ['V', -d, 0], ['Z', d, 0]].forEach(([t, x, y]) => ctx.fillText(t, cx + x, cy + y));
        ctx.textBaseline = 'alphabetic';
      }
      ctx.restore();
    }
  }

  /* ---------- písma ---------- */
  async function nactiPisma() {
    if (typeof FONTY === 'undefined') return;
    const seznam = (await FONTY.seznam()).filter(f => f.pismo === 'latinka');
    FONTY.naplnVyber($('pismo'), seznam, N.pismo);
    FONTY.naplnVyber($('pismoPodtitulku'), seznam, N.pismoPodtitulku);
    await Promise.all([pouzijPismo('titulek', N.pismo), pouzijPismo('podtitulek', N.pismoPodtitulku)]);
  }
  async function pouzijPismo(kde, id) {
    try { rodiny[kde] = await FONTY.rodina(id); } catch (e) { rodiny[kde] = kde === 'titulek' ? 'sans-serif' : 'serif'; }
    prekresli(false);
  }

  /* ---------- panel: synchronizace ---------- */
  function segment(id, klic, poZmene) {
    const el = $(id);
    el.addEventListener('click', e => {
      const b = e.target.closest('button[data-h]'); if (!b) return;
      N[klic] = b.dataset.h; oznacSegment(id, N[klic]); poZmene ? poZmene() : null; prekresli(); ulozPrubezne();
    });
  }
  function oznacSegment(id, h) { $(id).querySelectorAll('button[data-h]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.h === h))); }
  function posuvnik(id, klic, fmt, poZmene) {
    const el = $(id), ukaz = () => { $(id + 'H').textContent = fmt(+el.value); };
    el.addEventListener('input', () => { N[klic] = +el.value; ukaz(); poZmene ? poZmene() : prekresli(); ulozPrubezne(); });
    return ukaz;
  }
  function synchronizujVyrez() {
    $('zoom').value = N.zoom; $('zoomH').textContent = N.zoom.toFixed(1);
    $('natoceni').value = Math.round(N.natoceni); $('natoceniH').textContent = Math.round(N.natoceni) + '°';
    if (document.activeElement !== $('souradnice')) $('souradnice').value = N.mesto.lat.toFixed(5) + ', ' + N.mesto.lon.toFixed(5);
  }
  function nastavUI() {
    oznacSegment('rezim', N.rezim); oznacSegment('orientace', N.orientace); oznacSegment('tvar', N.tvar); oznacSegment('rozlozeniText', N.rozlozeni);
    document.querySelectorAll('[data-jen]').forEach(e => { e.hidden = e.dataset.jen !== N.rezim; });
    $('format').value = N.format; $('vlastniPole').hidden = N.format !== 'vlastni';
    $('vlS').value = N.vlastni.s; $('vlV').value = N.vlastni.v;
    for (const k of ['okraj', 'velikostTextu', 'prolozeni', 'mezMag']) { $(k).value = N[k]; $(k).dispatchEvent(new Event('ukaz')); }
    $('tloustka').value = N.pal.tloustka || 1; $('tloustkaH').textContent = (+$('tloustka').value).toFixed(2) + '×';
    $('ramecek').value = N.ramecek; $('znacka').value = N.znacka;
    $('titulek').value = N.titulek; $('podtitulek').value = N.podtitulek;
    $('souradniceText').checked = N.souradnice; $('velkaPismena').checked = N.velkaPismena;
    $('popisky').checked = N.popisky; $('prepPopisky').setAttribute('aria-pressed', String(N.popisky));
    $('souhvezdi').checked = N.souhvezdi; $('mrizka').checked = N.mrizka;
    $('datum').value = N.datum; $('pasmo').value = String(N.pasmo);
    if ($('pismo').options.length) { $('pismo').value = N.pismo; $('pismoPodtitulku').value = N.pismoPodtitulku; }
    kresliPalety(); kresliEditor(); synchronizujVyrez();
  }

  /* ---------- palety a editor barev ---------- */
  function kresliPalety() {
    const el = $('palety'); el.innerHTML = '';
    for (const p of P.PALETY) {
      const b = document.createElement('button');
      b.className = 'paleta'; b.type = 'button'; b.setAttribute('aria-pressed', String(N.paleta === p.id));
      const pr = [p.pozadi, p.voda || p.pozadi, p.zelen || p.pozadi, p.silnice.hlavni, p.text];
      b.innerHTML = `<i class="vzor" style="background:linear-gradient(90deg,${pr.map((c, i) => `${c} ${i * 20}% ${(i + 1) * 20}%`).join(',')})"></i><span></span>`;
      b.querySelector('span').textContent = p.nazev;
      b.addEventListener('click', () => { N.paleta = p.id; N.pal = P.kopiePalety(p.id); kresliPalety(); kresliEditor(); $('tloustka').value = 1; $('tloustkaH').textContent = '1.00×'; restyl(); });
      el.appendChild(b);
    }
  }
  const POLOZKY = [
    ['plakat', 'Pozadí plakátu'], ['text', 'Text'], ['pozadi', 'Pozadí mapy', 0, 'mapa'], ['voda', 'Voda', 1, 'mapa'], ['zelen', 'Zeleň a parky', 1, 'mapa'],
    ['budovy', 'Budovy', 1, 'mapa'], ['zeleznice', 'Železnice', 1, 'mapa'],
    ...P.TRIDY.map(t => ['silnice.' + t, P.NAZVY_TRID[t], 1, 'mapa', true]),
    ['pin', 'Značka', 0, 'mapa'], ['obloha', 'Obloha', 0, 'hvezdy'], ['hvezdy', 'Hvězdy a čáry', 0, 'hvezdy'],
  ];
  function kresliEditor() {
    const el = $('barvy'); el.innerHTML = '';
    const pal = N.pal;
    for (const [klic, nazev, lzeSkryt, rezim, sirka] of POLOZKY) {
      if (rezim && rezim !== N.rezim) continue;
      const [a, b] = klic.split('.');
      const ziskej = () => b ? pal[a][b] : pal[a];
      const nastav = v => { if (b) pal[a][b] = v; else pal[a] = v; };
      const posledni = ziskej() || (P.PALETY.find(p => p.id === N.paleta.replace(/^vlastni:/, '')) || {})[a] || '#888888';
      const lab = document.createElement('span'); lab.className = 'nazev'; lab.textContent = nazev;
      const barva = document.createElement('input'); barva.type = 'color'; barva.setAttribute('aria-label', nazev);
      barva.value = ziskej() || (typeof posledni === 'string' ? posledni : posledni[b]) || '#888888';
      barva.disabled = !ziskej();
      barva.addEventListener('input', () => { nastav(barva.value); N.paleta = vlastniPaleta(); restyl(); });
      const extra = document.createElement('span'); extra.className = 'radek';
      if (lzeSkryt) {
        const ch = document.createElement('input'); ch.type = 'checkbox'; ch.checked = !!ziskej(); ch.title = 'Zobrazit vrstvu'; ch.setAttribute('aria-label', 'Zobrazit ' + nazev);
        ch.addEventListener('change', () => { nastav(ch.checked ? barva.value : null); barva.disabled = !ch.checked; N.paleta = vlastniPaleta(); restyl(); });
        extra.appendChild(ch);
      }
      if (sirka) {
        const r = document.createElement('input'); r.type = 'range'; r.min = 0.2; r.max = 3; r.step = 0.05; r.value = pal.sirky[b] || 1;
        r.title = 'Tloušťka třídy'; r.setAttribute('aria-label', 'Tloušťka – ' + nazev); r.style.flex = '1';
        r.addEventListener('input', () => { pal.sirky[b] = +r.value; N.paleta = vlastniPaleta(); restyl(); });
        extra.appendChild(r);
      }
      el.append(lab, barva, extra);
    }
  }
  function vlastniPaleta() { kresliPalety(); return 'vlastni:' + (N.paleta || '').replace(/^vlastni:/, ''); }

  /* ---------- hledání (Nominatim: jen po potvrzení, nejvýš 1 dotaz/s, výsledky v paměti) ---------- */
  const cacheHledani = new Map();
  let fronta = Promise.resolve(), posledniDotaz = 0;
  function nominatim(q) {
    if (cacheHledani.has(q)) return Promise.resolve(cacheHledani.get(q));
    const prace = fronta.then(async () => {
      const cekat = posledniDotaz + 1100 - Date.now();
      if (cekat > 0) await new Promise(r => setTimeout(r, cekat));
      posledniDotaz = Date.now();
      // prohlížeč posílá Referer stránky; vlastní User-Agent ani e-mail se z prohlížeče neposílají
      const r = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&addressdetails=1&accept-language=cs&q=' + encodeURIComponent(q));
      if (!r.ok) throw new Error('Nominatim odpověděl ' + r.status);
      const data = await r.json();
      cacheHledani.set(q, data);
      return data;
    });
    fronta = prace.catch(() => {});
    return prace;
  }
  async function hledej(q) {
    q = q.trim(); if (!q) return;
    const s = P.ctiSouradnice(q);
    if (s) { presun(s.lat, s.lon, null, true); $('vysledky').hidden = true; return; }
    const box = $('vysledky'), r = $('hledatForm').getBoundingClientRect();
    Object.assign(box.style, { top: (r.bottom + 4) + 'px', left: r.left + 'px', width: r.width + 'px' });
    box.hidden = false; box.innerHTML = '<div class="pozn" style="padding:6px 9px">Hledám…</div>';
    try {
      const data = await nominatim(q);
      box.innerHTML = '';
      if (!data.length) { box.innerHTML = '<div class="pozn" style="padding:6px 9px">Nic nenalezeno.</div>'; return; }
      for (const v of data) {
        const b = document.createElement('button'); b.type = 'button';
        b.innerHTML = '<b></b><br><small></small>';
        b.querySelector('b').textContent = v.name || v.display_name.split(',')[0];
        b.querySelector('small').textContent = v.display_name;
        b.addEventListener('click', () => vyberVysledek(v));
        box.appendChild(b);
      }
      box.firstChild.focus();
    } catch (e) {
      box.innerHTML = ''; const d = document.createElement('div'); d.className = 'pozn varovani'; d.style.padding = '6px 9px';
      d.textContent = 'Hledání selhalo: ' + e.message; box.appendChild(d);
    }
  }
  function vyberVysledek(v) {
    $('vysledky').hidden = true;
    const lat = +v.lat, lon = +v.lon, a = v.address || {};
    N.titulek = v.name || v.display_name.split(',')[0];
    const zeme = a.country && a.country !== N.titulek ? a.country : '';
    N.podtitulek = zeme;
    $('titulek').value = N.titulek; $('podtitulek').value = N.podtitulek;
    const bb = v.boundingbox && v.boundingbox.map(Number);
    presun(lat, lon, bb, true);
  }
  function presun(lat, lon, bb, znacku) {
    N.mesto = { lat, lon };
    if (znacku) N.znackaPoloha = { lat, lon };
    if (mapa) {
      if (bb && bb[0] !== bb[1]) mapa.fitBounds([[bb[2], bb[0]], [bb[3], bb[1]]], { maxZoom: 15, padding: 30, bearing: N.natoceni, duration: 0 });
      else mapa.jumpTo({ center: [lon, lat], zoom: Math.max(N.zoom, 12) });
      mapa.jumpTo({ center: [lon, lat] });
    }
    synchronizujVyrez(); prekresli(); ulozPrubezne();
  }

  /* ---------- export ---------- */
  async function vykresliMapuDo(ctx, o, detail) {
    const t = rNahled.tvar, cssW = t.w * detail, cssH = cssW * o.h / o.w, pr = o.w / cssW;
    const div = document.createElement('div');
    div.style.cssText = `position:fixed;left:-100000px;top:0;width:${cssW}px;height:${cssH}px;`;
    document.body.appendChild(div);
    const limit = Math.max(Math.ceil(o.w), Math.ceil(o.h)) + 2;
    const m = new maplibregl.Map({ container: div, style: styl(), center: mapa.getCenter(), zoom: mapa.getZoom() + Math.log2(detail),
      bearing: mapa.getBearing(), pixelRatio: pr, interactive: false, attributionControl: false, fadeDuration: 0,
      maxCanvasSize: [limit, limit], canvasContextAttributes: { preserveDrawingBuffer: true, antialias: false } });
    try {
      await new Promise((ok, chyba) => {
        const t = setTimeout(() => chyba(new Error('Vykreslení mapy trvá příliš dlouho (dlaždice se nenačetly).')), 180000);
        m.once('idle', () => { clearTimeout(t); ok(); });
      });
      const c = m.getCanvas();
      if (c.width < Math.floor(o.w) - 2) throw new Error(`Grafická karta vykreslila jen ${c.width} px místo ${Math.round(o.w)} px. Zvolte nižší DPI.`);
      ctx.save(); ctx.clip(new Path2D(P.cestaTvaru(N.tvar, o)));
      ctx.drawImage(c, o.x, o.y, o.w, o.h);
      ctx.restore();
      if (!N.znackaPoloha) return null;
      const p = m.project([N.znackaPoloha.lon, N.znackaPoloha.lat]);
      return { x: o.x + p.x * pr, y: o.y + p.y * pr };
    } finally { m.remove(); div.remove(); }
  }

  /** Vytvoří plátno plakátu v daném DPI. Vrací {canvas, dpi}. */
  async function plakatNaPlatno(dpi, detail, prubeh = () => {}) {
    const mm = rozmerMm();
    let px = P.rozmeryPx(mm, dpi), r = P.rozvrzeni(Nx(), px.w, px.h);
    const strana = Math.max(r.tvar.w, r.tvar.h);
    if ((N.rezim === 'mapa' && mapa && strana > limitGL) || px.w * px.h > LIMIT_PLOCHY) {
      const nove = Math.max(30, Math.floor(dpi * Math.min(N.rezim === 'mapa' ? limitGL / strana : 1, Math.sqrt(LIMIT_PLOCHY / (px.w * px.h))) * 0.98));
      const ano = await Dialog.potvrd(`Plakát ${px.w} × ${px.h} px při ${dpi} DPI přesahuje možnosti prohlížeče (WebGL do ${limitGL} px, plátno do ${Math.round(LIMIT_PLOCHY / 1e6)} Mpx). Exportovat v ${nove} DPI?`);
      if (!ano) return null;
      dpi = nove; px = P.rozmeryPx(mm, dpi); r = P.rozvrzeni(Nx(), px.w, px.h);
    }
    const canvas = document.createElement('canvas'); canvas.width = px.w; canvas.height = px.h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Prohlížeč nevytvořil plátno této velikosti.');
    if (document.fonts) await Promise.all([rodiny.titulek, rodiny.podtitulek].map(f => document.fonts.load(`20px "${f}"`).catch(() => {})));
    if (N.rezim === 'hvezdy') await nactiNebe();
    prubeh(`Kreslím podklad ${px.w} × ${px.h} px…`);
    kresliPodklad(ctx, r);
    let pin = null;
    if (N.rezim === 'mapa' && mapa) { prubeh('Vykresluji mapu v plném rozlišení (stahují se dlaždice)…'); pin = await vykresliMapuDo(ctx, r.tvar, detail); }
    kresliPrekryv(ctx, r, pin);
    return { canvas, dpi };
  }

  function nazevSouboru(pripona, dpi) {
    const z = (N.titulek || 'plakat').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'plakat';
    return `plakat-${z}-${dpi}dpi.${pripona}`;
  }
  function stahni(blob, jmeno) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = jmeno;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  let jspdfNacita = null;
  function nactiJsPdf() {
    if (window.jspdf) return Promise.resolve();
    return jspdfNacita || (jspdfNacita = new Promise((ok, chyba) => {
      const s = document.createElement('script'); s.src = 'lib/jspdf.umd.min.js'; s.onload = ok;
      s.onerror = () => { jspdfNacita = null; chyba(new Error('jsPDF se nenačetl')); }; document.head.appendChild(s);
    }));
  }
  let exFormat = 'png', exportBezi = false;
  function exInfo() {
    const mm = rozmerMm(), px = P.rozmeryPx(mm, +$('exDpi').value);
    $('exInfo').textContent = `${mm.s} × ${mm.v} mm → ${px.w} × ${px.h} px (${(px.w * px.h / 1e6).toFixed(1)} Mpx).` +
      (N.rezim === 'mapa' ? ` Limit WebGL tohoto prohlížeče: ${limitGL} px.` : '');
  }
  async function spustExport() {
    if (exportBezi) return;
    exportBezi = true; $('exStart').disabled = true;
    const prubeh = t => { $('exPrubeh').textContent = t; };
    try {
      const v = await plakatNaPlatno(+$('exDpi').value, +$('exDetail').value, prubeh);
      if (!v) { prubeh(''); return; }
      prubeh('Ukládám soubor…');
      if (exFormat === 'png') {
        const blob = await new Promise(ok => v.canvas.toBlob(ok, 'image/png'));
        if (!blob) throw new Error('PNG se nepodařilo vytvořit (málo paměti?).');
        stahni(blob, nazevSouboru('png', v.dpi));
      } else {
        await nactiJsPdf();
        const mm = rozmerMm();
        const doc = new window.jspdf.jsPDF({ orientation: mm.s > mm.v ? 'landscape' : 'portrait', unit: 'mm', format: [mm.s, mm.v], compress: true });
        doc.setProperties({ title: N.titulek || 'Plakát mapy', creator: 'Plakát mapy' });
        doc.addImage(v.canvas.toDataURL('image/jpeg', 0.93), 'JPEG', 0, 0, mm.s, mm.v, undefined, 'FAST');
        stahni(doc.output('blob'), nazevSouboru('pdf', v.dpi));
      }
      prubeh(`Hotovo: ${v.canvas.width} × ${v.canvas.height} px, ${v.dpi} DPI.`);
      v.canvas.width = v.canvas.height = 0;
    } catch (e) {
      prubeh(''); Dialog.chyba('Export selhal: ' + e.message);
    } finally { exportBezi = false; $('exStart').disabled = false; }
  }

  /* ---------- ukládání ---------- */
  async function uloz() {
    const seznam = ctiLS(KLIC_ULOZENE, []);
    let z = N.idUlozeni && seznam.find(x => x.id === N.idUlozeni);
    if (!z) {
      const nazev = await Dialog.zeptej('Název plakátu', N.titulek || 'Plakát');
      if (nazev == null) return;
      N.idUlozeni = 'p' + Date.now().toString(36);
      z = { id: N.idUlozeni, nazev: nazev.trim() || 'Plakát' }; seznam.unshift(z);
    }
    z.cas = Date.now(); z.n = JSON.parse(JSON.stringify(N));
    if (pisLS(KLIC_ULOZENE, seznam)) Dialog.info('Uloženo: ' + z.nazev); else Dialog.chyba('Úložiště prohlížeče je plné.');
    ulozPrubezne();
  }
  function ukazUlozene() {
    const seznam = ctiLS(KLIC_ULOZENE, []), el = $('seznamUlozenych');
    el.innerHTML = seznam.length ? '' : '<p class="pozn">Zatím nic uloženého. Plakát uložíte přes Soubor → Uložit (Ctrl+S).</p>';
    for (const z of seznam) {
      const d = document.createElement('div'); d.className = 'polozka';
      d.innerHTML = '<b></b><small></small><button class="tl" data-a="otevrit">Otevřít</button><button class="tl" data-a="smazat" title="Smazat">🗑</button>';
      d.querySelector('b').textContent = z.nazev;
      d.querySelector('small').textContent = new Date(z.cas).toLocaleString('cs-CZ', { dateStyle: 'short', timeStyle: 'short' });
      d.addEventListener('click', async e => {
        const a = e.target.closest('[data-a]'); if (!a) return;
        if (a.dataset.a === 'otevrit') { nacti(z.n); $('dlgUlozene').close(); }
        else if (await Dialog.potvrd(`Smazat plakát „${z.nazev}“?`)) {
          pisLS(KLIC_ULOZENE, ctiLS(KLIC_ULOZENE, []).filter(x => x.id !== z.id)); ukazUlozene();
        }
      });
      el.appendChild(d);
    }
    if (!$('dlgUlozene').open) $('dlgUlozene').showModal();
  }
  function nacti(n) {
    const v = vychozi();
    N = Object.assign(v, n || {});
    if (!N.pal || !N.pal.silnice) N.pal = P.kopiePalety(N.paleta);
    N.pal = Object.assign(P.kopiePalety('cernobily'), N.pal);
    if (!N.mesto || !isFinite(N.mesto.lat)) N.mesto = v.mesto;
    nastavUI();
    if ($('pismo').options.length) { pouzijPismo('titulek', N.pismo); pouzijPismo('podtitulek', N.pismoPodtitulku); }
    if (mapa) { mapa.setStyle(styl()); mapa.jumpTo({ center: [N.mesto.lon, N.mesto.lat], zoom: N.zoom, bearing: N.natoceni }); }
    if (N.rezim === 'hvezdy') nactiNebe();
    prekresli(); ulozPrubezne();
  }
  async function nactiSoubor(f) {
    try {
      const d = JSON.parse(await f.text());
      if (!d || d.typ !== 'plakat_mapy' || !d.n) throw new Error('Soubor není nastavení Plakátu mapy.');
      delete d.n.idUlozeni; nacti(d.n); Dialog.info('Nastavení načteno');
    } catch (e) { Dialog.chyba('Nepodařilo se načíst: ' + e.message); }
  }

  /* ---------- příkazy, nabídky, klávesy ---------- */
  const PRIKAZY = {
    novy: async () => { if (await Dialog.potvrd('Začít nový plakát? Neuložené změny se ztratí.')) { const m = N.mesto; nacti(Object.assign(vychozi(), { mesto: m, znackaPoloha: m })); } },
    ulozit: uloz,
    ulozene: ukazUlozene,
    export: () => { exInfo(); $('exPrubeh').textContent = ''; $('dlgExport').showModal(); },
    jsonVen: () => { const d = Object.assign({}, N); delete d.idUlozeni; stahni(new Blob([JSON.stringify({ typ: 'plakat_mapy', verze: 1, n: d }, null, 1)], { type: 'application/json' }), nazevSouboru('json', 'nastaveni').replace('-nastavenidpi', '-nastaveni')); },
    jsonDovnitr: () => $('soubor').click(),
    popisky: () => { N.popisky = !N.popisky; $('popisky').checked = N.popisky; $('prepPopisky').setAttribute('aria-pressed', String(N.popisky)); restyl(); },
    vodorovne: () => { if (mapa) mapa.setBearing(0); N.natoceni = 0; synchronizujVyrez(); ulozPrubezne(); },
    znackaStred: () => { N.znackaPoloha = Object.assign({}, N.mesto); if (N.znacka === 'zadna') { N.znacka = 'pin'; $('znacka').value = 'pin'; } prekresli(false); ulozPrubezne(); },
    naZnacku: () => { if (N.znackaPoloha && mapa) mapa.jumpTo({ center: [N.znackaPoloha.lon, N.znackaPoloha.lat] }); },
    napoveda: () => $('dlgNapoveda').showModal(),
    zdroje: () => $('dlgZdroje').showModal(),
  };
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
    if (b && !b.disabled) { e.stopPropagation(); zavriNabidky(); PRIKAZY[b.dataset.prikaz](); return; }
    if (!e.target.closest('.nabidka')) zavriNabidky();
    if (!e.target.closest('.hledat')) $('vysledky').hidden = true;
  });
  document.querySelectorAll('[data-zavri]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
  document.addEventListener('keydown', e => {
    const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (ctrl && k === 's') { e.preventDefault(); uloz(); }
    else if (ctrl && k === 'e') { e.preventDefault(); PRIKAZY.export(); }
    else if (e.key === 'Escape') { zavriNabidky(); $('vysledky').hidden = true; }
    else if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); $('hledat').focus(); }
  });

  /* ---------- drag & drop ---------- */
  let pretah = null;
  addEventListener('dragover', e => {
    if (![...(e.dataTransfer.types || [])].includes('Files')) return;
    e.preventDefault();
    if (!pretah) { pretah = document.createElement('div'); pretah.className = 'pretahni'; pretah.textContent = 'Pusťte soubor .json s nastavením plakátu'; document.body.appendChild(pretah); }
  });
  addEventListener('dragleave', e => { if (!e.relatedTarget && pretah) { pretah.remove(); pretah = null; } });
  addEventListener('drop', e => {
    if (pretah) { pretah.remove(); pretah = null; }
    const f = e.dataTransfer.files && e.dataTransfer.files[0]; if (!f) return;
    e.preventDefault(); nactiSoubor(f);
  });
  $('soubor').addEventListener('change', e => { const f = e.target.files[0]; if (f) nactiSoubor(f); e.target.value = ''; });

  /* ---------- napojení ovládacích prvků ---------- */
  function napoj() {
    for (const [id, f] of Object.entries(P.FORMATY)) $('format').add(new Option(f.nazev, id));
    for (let h = -12; h <= 14; h++) $('pasmo').add(new Option('UTC' + (h < 0 ? '−' + -h : '+' + h), String(h)));
    for (const h of [5.5, 5.75, 9.5]) $('pasmo').add(new Option('UTC+' + String(h).replace('.', ','), String(h)));
    segment('rezim', 'rezim', () => { nastavUI(); if (N.rezim === 'hvezdy') nactiNebe(); else if (mapa) mapa.resize(); });
    segment('orientace', 'orientace'); segment('tvar', 'tvar'); segment('rozlozeniText', 'rozlozeni');
    const ukazy = {
      okraj: posuvnik('okraj', 'okraj', v => v.toFixed(1) + ' %'),
      velikostTextu: posuvnik('velikostTextu', 'velikostTextu', v => v.toFixed(2) + '×'),
      prolozeni: posuvnik('prolozeni', 'prolozeni', v => v.toFixed(2)),
      mezMag: posuvnik('mezMag', 'mezMag', v => v.toFixed(1) + ' mag'),
    };
    for (const [k, f] of Object.entries(ukazy)) $(k).addEventListener('ukaz', f);
    $('zoom').addEventListener('input', () => { N.zoom = +$('zoom').value; if (mapa) mapa.setZoom(N.zoom); synchronizujVyrez(); });
    $('natoceni').addEventListener('input', () => { N.natoceni = +$('natoceni').value; if (mapa) mapa.setBearing(N.natoceni); synchronizujVyrez(); });
    $('tloustka').addEventListener('input', () => { N.pal.tloustka = +$('tloustka').value; $('tloustkaH').textContent = N.pal.tloustka.toFixed(2) + '×'; N.paleta = vlastniPaleta(); restyl(); });
    $('format').addEventListener('change', () => { N.format = $('format').value; $('vlastniPole').hidden = N.format !== 'vlastni'; prekresli(); ulozPrubezne(); });
    for (const id of ['vlS', 'vlV']) $(id).addEventListener('change', () => { N.vlastni = { s: +$('vlS').value, v: +$('vlV').value }; prekresli(); ulozPrubezne(); });
    const zmena = (id, klic, prop = 'value', poZmene) => $(id).addEventListener(prop === 'checked' ? 'change' : 'input', () => {
      N[klic] = $(id)[prop]; (poZmene || prekresli)(); ulozPrubezne();
    });
    zmena('ramecek', 'ramecek'); zmena('znacka', 'znacka');
    zmena('titulek', 'titulek'); zmena('podtitulek', 'podtitulek');
    zmena('souradniceText', 'souradnice', 'checked'); zmena('velkaPismena', 'velkaPismena', 'checked');
    zmena('souhvezdi', 'souhvezdi', 'checked'); zmena('mrizka', 'mrizka', 'checked');
    zmena('popisky', 'popisky', 'checked', () => { $('prepPopisky').setAttribute('aria-pressed', String(N.popisky)); restyl(); });
    zmena('datum', 'datum'); zmena('pasmo', 'pasmo', 'value', () => { N.pasmo = +N.pasmo; prekresli(false); });
    $('pismo').addEventListener('change', () => { N.pismo = $('pismo').value; pouzijPismo('titulek', N.pismo); ulozPrubezne(); });
    $('pismoPodtitulku').addEventListener('change', () => { N.pismoPodtitulku = $('pismoPodtitulku').value; pouzijPismo('podtitulek', N.pismoPodtitulku); ulozPrubezne(); });
    $('datumDoTextu').addEventListener('click', () => {
      const d = new Date(casOblohy() + (+N.pasmo || 0) * 3600e3);
      N.podtitulek = d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) + ', ' +
        d.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
      $('podtitulek').value = N.podtitulek; prekresli(); ulozPrubezne();
    });
    const naSour = () => {
      const s = P.ctiSouradnice($('souradnice').value);
      if (!s) return Dialog.chyba('Souřadnice nerozumím. Zkuste např. 50.0755, 14.4378');
      presun(s.lat, s.lon, null, true);
    };
    $('naSouradnice').addEventListener('click', naSour);
    $('souradnice').addEventListener('keydown', e => { if (e.key === 'Enter') naSour(); });
    $('hledatForm').addEventListener('submit', e => { e.preventDefault(); hledej($('hledat').value); });
    $('exFormat').addEventListener('click', e => { const b = e.target.closest('button[data-h]'); if (b) { exFormat = b.dataset.h; oznacSegment('exFormat', exFormat); } });
    $('exDpi').addEventListener('change', exInfo);
    $('exStart').addEventListener('click', spustExport);
    $('exZavrit').addEventListener('click', () => $('dlgExport').close());
    $('ulZavrit').addEventListener('click', () => $('dlgUlozene').close());
    new ResizeObserver(() => prekresli()).observe($('hlavni'));
  }

  /* ---------- start ---------- */
  const ulozeny = ctiLS(KLIC_POSLEDNI, null);
  if (ulozeny) { N = Object.assign(vychozi(), ulozeny); if (!N.pal || !N.pal.silnice) N.pal = P.kopiePalety(N.paleta); }
  napoj();
  nastavUI();
  zalozMapu();
  if (N.rezim === 'hvezdy') nactiNebe();
  nactiPisma().catch(e => console.warn('písma', e));
  prekresli();

  // pro testy a ladění
  window.PLAKAT_UI = { get N() { return N; }, get mapa() { return mapa; }, get limitGL() { return limitGL; }, nacti, plakatNaPlatno, hledej, presun };
})();

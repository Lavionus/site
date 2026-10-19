/* ============================================================
   epidemie/ui_citlivost.js – záložka „Citlivost“: teplotní mapa výsledku přes dva parametry.
   ============================================================ */
(function () {
  'use strict';
  const App = window.EpiApp, M = window.EpiModel, $ = App.$;
  const { f, fc, fp, esc } = App;
  const n = () => App.nast;

  const PARAMETRY = {
    p: { nazev: 'pravděpodobnost přenosu p', min: 0.01, max: 0.15 },
    c: { nazev: 'kontaktní míra c', min: 2, max: 25 },
    infekcni: { nazev: 'infekční období [dní]', min: 1, max: 14 },
    inkubace: { nazev: 'latence [dní]', min: 0.5, max: 14 },
    podilA: { nazev: 'podíl asymptomatických', min: 0, max: 0.8, proc: true },
    rA: { nazev: 'infekčnost asymptomatických', min: 0, max: 1, proc: true },
    izolacePodil: { nazev: 'podíl izolovaných', min: 0, max: 1, proc: true },
    izolaceZpozdeni: { nazev: 'zpoždění izolace [dní]', min: 0, max: 6 },
    ockovaniPodil: { nazev: 'proočkovanost na začátku', min: 0, max: 0.9, proc: true },
    ucinnost: { nazev: 'účinnost vakcíny', min: 0.3, max: 1, proc: true },
    kampanDavky100k: { nazev: 'dávek/den na 100 tis.', min: 0, max: 1500 },
    imunitaDny: { nazev: 'doba imunity [dní]', min: 60, max: 730 },
    sila1: { nazev: 'síla 1. zásahu na ose', min: 0, max: 1, proc: true, zasah: true },
    od1: { nazev: 'začátek 1. zásahu [den]', min: 0, max: 150, zasah: true }
  };
  const METRIKY = {
    podil: { nazev: 'celkem nakažených', f: (s) => s.podilNakazenych, fmt: (x) => fp(x) },
    vrchol: { nazev: 'vrchol infekčních (% populace)', f: (s) => s.vrcholI.hodnota / s.N, fmt: (x) => fp(x, 2) },
    den: { nazev: 'den vrcholu infekčních', f: (s) => s.vrcholI.t, fmt: (x) => 'den ' + f(x, 0) },
    umrti: { nazev: 'úmrtí na 100 tis.', f: (s) => s.umrti / s.N * 1e5, fmt: (x) => f(x, 1), zav: true },
    jip: { nazev: 'vrchol JIP na 100 tis.', f: (s) => s.vrcholC.hodnota / s.N * 1e5, fmt: (x) => f(x, 1), zav: true },
    nadkap: { nazev: 'dní nad kapacitou JIP', f: (s) => s.dnyNadKapC, fmt: (x) => f(x, 0) + ' d', zav: true }
  };
  const opt = (o, sel) => Object.entries(o).map(([k, v]) => `<option value="${k}"${k === sel ? ' selected' : ''}>${esc(v.nazev)}</option>`).join('');
  $('#ci-volby').innerHTML = `
    <div><label class="popisek" for="ci-x">Osa X</label><select id="ci-x">${opt(PARAMETRY, 'c')}</select></div>
    <div class="mrizka2"><div><label class="popisek" for="ci-xmin">X od</label><input type="text" inputmode="decimal" id="ci-xmin"></div><div><label class="popisek" for="ci-xmax">X do</label><input type="text" inputmode="decimal" id="ci-xmax"></div></div>
    <div><label class="popisek" for="ci-y">Osa Y</label><select id="ci-y">${opt(PARAMETRY, 'izolacePodil')}</select></div>
    <div class="mrizka2"><div><label class="popisek" for="ci-ymin">Y od</label><input type="text" inputmode="decimal" id="ci-ymin"></div><div><label class="popisek" for="ci-ymax">Y do</label><input type="text" inputmode="decimal" id="ci-ymax"></div></div>
    <div><label class="popisek" for="ci-m">Výsledek</label><select id="ci-m">${opt(METRIKY, 'podil')}</select></div>
    <div><label class="popisek" for="ci-res">Rozlišení</label><select id="ci-res"><option>10</option><option selected>20</option><option>30</option><option>40</option></select></div>`;
  const zobr = (k, v) => (PARAMETRY[k].proc ? v * 100 : v).toLocaleString('cs-CZ', { maximumFractionDigits: 3, useGrouping: false });
  const cti = (k, s) => { const v = Number(String(s).replace(/\s/g, '').replace(',', '.')); return PARAMETRY[k].proc ? v / 100 : v; };
  function meze(osa) { const k = $('#ci-' + osa).value; $('#ci-' + osa + 'min').value = zobr(k, PARAMETRY[k].min); $('#ci-' + osa + 'max').value = zobr(k, PARAMETRY[k].max); }
  meze('x'); meze('y');
  $('#ci-x').addEventListener('change', () => meze('x'));
  $('#ci-y').addEventListener('change', () => meze('y'));

  const pl = $('#tepl'), ctx = pl.getContext('2d');
  let vys = null, bezi = false, prerusit = false, kurzor = null;

  function nastavParametr(par, k, v) {
    if (PARAMETRY[k].zasah) {
      if (!par.zasahy.length) par.zasahy.push({ typ: 'vse', od: 20, do: 80, sila: 0.5 });
      const z = par.zasahy[0];
      if (k === 'sila1') z.sila = v; else { const d = z.do - z.od; z.od = v; z.do = v + d; }
    } else if (k === 'kampanDavky100k') par.kampanDavky = v * par.N / 1e5;   // parametry modelu už jsou přepočtené na absolutní počty
    else par[k] = v;
  }

  async function spocti() {
    if (bezi) return;
    App.chyba('#ci-chyba', '');
    const kx = $('#ci-x').value, ky = $('#ci-y').value, km = $('#ci-m').value, res = Number($('#ci-res').value);
    const x0 = cti(kx, $('#ci-xmin').value), x1 = cti(kx, $('#ci-xmax').value), y0 = cti(ky, $('#ci-ymin').value), y1 = cti(ky, $('#ci-ymax').value);
    if (![x0, x1, y0, y1].every(Number.isFinite) || x1 <= x0 || y1 <= y0) { App.chyba('#ci-chyba', 'Zadejte rozsahy, kde „od“ < „do“.'); return; }
    if (kx === ky) { App.chyba('#ci-chyba', 'Zvolte pro osy dva různé parametry.'); return; }
    if (METRIKY[km].zav && !n().zavaznost) { App.chyba('#ci-chyba', 'Tento výsledek vyžaduje zapnuté sledování hospitalizací (Závažnost a nemocnice).'); return; }
    const zaklad = App.parModel();
    zaklad.krok = Math.max(zaklad.krok, 0.5);
    bezi = true; prerusit = false;
    $('#b-ci').disabled = true; $('#b-ci-stop').hidden = false; $('#ci-prubeh').hidden = false;
    const pruh = $('#ci-prubeh > div');
    const hod = [], R = [];
    let cas = performance.now(), chyba = null;
    const t0 = performance.now();
    for (let j = 0; j < res && !prerusit; j++) {
      hod.push([]); R.push([]);
      for (let i = 0; i < res; i++) {
        const par = JSON.parse(JSON.stringify(zaklad));
        nastavParametr(par, kx, x0 + (x1 - x0) * i / (res - 1));
        nastavParametr(par, ky, y0 + (y1 - y0) * j / (res - 1));
        try {
          const v = M.simuluj(par, { bezRt: true });
          hod[j].push(METRIKY[km].f(v.souhrn));
          const S0 = v.st.pop.map(x => x * (1 - v.par.ockovaniPodil * v.par.ucinnost));
          R[j].push(M.spektralniPolomer(M.maticeDalsichGeneraci(v.par, v.st, 0, S0, true)));
        } catch (e) { hod[j].push(NaN); R[j].push(NaN); chyba = e.message; }
        if (performance.now() - cas > 40) { pruh.style.width = ((j * res + i + 1) / (res * res) * 100).toFixed(1) + '%'; await App.pauza(); cas = performance.now(); if (prerusit) break; }
      }
    }
    bezi = false;
    $('#b-ci').disabled = false; $('#b-ci-stop').hidden = true; $('#ci-prubeh').hidden = true;
    if (prerusit) return;
    if (chyba) App.chyba('#ci-chyba', 'Některé kombinace nejsou platné: ' + chyba);
    vys = { kx, ky, km, res, x0, x1, y0, y1, hod, R, cas: (performance.now() - t0) / 1000 };
    const plat = hod.flat().filter(Number.isFinite);
    vys.min = Math.min(...plat); vys.max = Math.max(...plat);
    $('#ci-min').textContent = METRIKY[km].fmt(vys.min);
    $('#ci-maxp').textContent = METRIKY[km].fmt(vys.max);
    $('#ci-metrika').textContent = '· ' + METRIKY[km].nazev;
    $('#ci-info').textContent = `${res}×${res} = ${res * res} simulací za ${f(vys.cas, 1)} s (krok RK4 ${f(zaklad.krok, 2)} dne). Najetím myší zobrazíte hodnotu.`;
    kresli();
  }
  $('#b-ci').addEventListener('click', spocti);
  $('#b-ci-stop').addEventListener('click', () => { prerusit = true; });

  function hex(c) { const m = /^#?([0-9a-f]{6})$/i.exec(c.trim()); if (!m) return [128, 128, 128]; const v = parseInt(m[1], 16); return [v >> 16 & 255, v >> 8 & 255, v & 255]; }
  function kresli() {
    const w = pl.clientWidth, h = pl.clientHeight;
    if (!w || !h) return;
    const dpr = window.devicePixelRatio || 1;
    if (pl.width !== Math.round(w * dpr) || pl.height !== Math.round(h * dpr)) { pl.width = Math.round(w * dpr); pl.height = Math.round(h * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const css = getComputedStyle(document.documentElement), bar = v => css.getPropertyValue(v).trim();
    ctx.font = '12px ' + (bar('--font') || 'sans-serif');
    if (!vys) { ctx.fillStyle = bar('--text-muted'); ctx.fillText('Zvolte parametry a stiskněte „Spočítat mapu“.', 10, 24); return; }
    const L = 58, T = 8, Rm = 10, B = 44;
    const sw = w - L - Rm, sh = h - T - B;
    const a = hex(bar('--mapa-0')), b = hex(bar('--mapa-1'));
    const res = vys.res, cw = sw / res, ch = sh / res;
    const rozsah = vys.max - vys.min || 1;
    for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) {
      const v = vys.hod[j][i];
      if (!Number.isFinite(v)) { ctx.fillStyle = bar('--bg-control'); }
      else { const t = (v - vys.min) / rozsah; ctx.fillStyle = `rgb(${a.map((x, k) => Math.round(x + (b[k] - x) * t)).join(',')})`; }
      ctx.fillRect(L + i * cw, T + sh - (j + 1) * ch, Math.ceil(cw), Math.ceil(ch));
    }
    // hranice R(0) = 1
    ctx.strokeStyle = bar('--text'); ctx.lineWidth = 2.5; ctx.beginPath();
    for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) {
      const r = vys.R[j][i] - 1;
      if (i + 1 < res && r * (vys.R[j][i + 1] - 1) < 0) { const x = L + (i + 1) * cw; ctx.moveTo(x, T + sh - (j + 1) * ch); ctx.lineTo(x, T + sh - j * ch); }
      if (j + 1 < res && r * (vys.R[j + 1][i] - 1) < 0) { const y = T + sh - (j + 1) * ch; ctx.moveTo(L + i * cw, y); ctx.lineTo(L + (i + 1) * cw, y); }
    }
    ctx.stroke();
    // osy
    ctx.fillStyle = bar('--text-muted'); ctx.strokeStyle = bar('--border');
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (let k = 0; k <= 4; k++) {
      const xv = vys.x0 + (vys.x1 - vys.x0) * k / 4, px = L + cw / 2 + (sw - cw) * k / 4;
      ctx.fillText(zobr(vys.kx, xv) + (PARAMETRY[vys.kx].proc ? ' %' : ''), px, T + sh + 4);
    }
    ctx.fillText(PARAMETRY[vys.kx].nazev, L + sw / 2, T + sh + 22);
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (let k = 0; k <= 4; k++) {
      const yv = vys.y0 + (vys.y1 - vys.y0) * k / 4, py = T + sh - ch / 2 - (sh - ch) * k / 4;
      ctx.fillText(zobr(vys.ky, yv) + (PARAMETRY[vys.ky].proc ? ' %' : ''), L - 6, py);
    }
    ctx.save(); ctx.translate(12, T + sh / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center'; ctx.fillText(PARAMETRY[vys.ky].nazev, 0, 0); ctx.restore();
    // aktuální nastavení
    const akt = (k) => PARAMETRY[k].zasah ? (n().zasahy[0] ? (k === 'sila1' ? n().zasahy[0].sila : n().zasahy[0].od) : NaN) : n()[k];
    const ax = akt(vys.kx), ay = akt(vys.ky);
    if (ax >= vys.x0 && ax <= vys.x1 && ay >= vys.y0 && ay <= vys.y1) {
      const px = L + cw / 2 + (sw - cw) * (ax - vys.x0) / (vys.x1 - vys.x0), py = T + sh - ch / 2 - (sh - ch) * (ay - vys.y0) / (vys.y1 - vys.y0);
      ctx.strokeStyle = bar('--c-i'); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(px - 7, py - 7); ctx.lineTo(px + 7, py + 7); ctx.moveTo(px + 7, py - 7); ctx.lineTo(px - 7, py + 7); ctx.stroke();
    }
    if (kurzor) {
      const { i, j } = kurzor;
      const v = vys.hod[j][i];
      ctx.strokeStyle = bar('--text'); ctx.lineWidth = 2; ctx.strokeRect(L + i * cw, T + sh - (j + 1) * ch, cw, ch);
      const xv = vys.x0 + (vys.x1 - vys.x0) * i / (res - 1), yv = vys.y0 + (vys.y1 - vys.y0) * j / (res - 1);
      const radky = [`${PARAMETRY[vys.kx].nazev}: ${zobr(vys.kx, xv)}${PARAMETRY[vys.kx].proc ? ' %' : ''}`, `${PARAMETRY[vys.ky].nazev}: ${zobr(vys.ky, yv)}${PARAMETRY[vys.ky].proc ? ' %' : ''}`,
        `${METRIKY[vys.km].nazev}: ${METRIKY[vys.km].fmt(v)}`, `R na začátku: ${f(vys.R[j][i], 2)}`];
      const sir = Math.max(...radky.map(r => ctx.measureText(r).width)) + 16, vy = radky.length * 16 + 8;
      let bx = L + (i + 1) * cw + 6; if (bx + sir > w) bx = L + i * cw - sir - 6; bx = Math.max(2, bx);
      let by = T + sh - (j + 1) * ch; by = Math.max(2, Math.min(h - vy - 2, by));
      ctx.fillStyle = bar('--bg-elevated'); ctx.strokeStyle = bar('--border'); ctx.lineWidth = 1;
      ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(bx, by, sir, vy, 6); else ctx.rect(bx, by, sir, vy); ctx.fill(); ctx.stroke();
      ctx.fillStyle = bar('--text'); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      radky.forEach((r, k) => ctx.fillText(r, bx + 8, by + 12 + k * 16));
    }
    pl._mer = { L, T, sw, sh, cw, ch };
  }
  function najed(px, py) {
    if (!vys || !pl._mer) return;
    const { L, T, sh, cw, ch } = pl._mer;
    const i = Math.floor((px - L) / cw), j = Math.floor((T + sh - py) / ch);
    kurzor = (i >= 0 && j >= 0 && i < vys.res && j < vys.res) ? { i, j } : null;
    kresli();
  }
  pl.addEventListener('pointermove', (e) => { const r = pl.getBoundingClientRect(); najed(e.clientX - r.left, e.clientY - r.top); });
  pl.addEventListener('pointerdown', (e) => { const r = pl.getBoundingClientRect(); najed(e.clientX - r.left, e.clientY - r.top); });
  pl.addEventListener('pointerleave', () => { kurzor = null; kresli(); });
  pl.addEventListener('keydown', (e) => {
    if (!vys) return;
    const k = kurzor || { i: 0, j: 0 };
    const posun = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
    if (!posun) return;
    e.preventDefault();
    kurzor = { i: Math.max(0, Math.min(vys.res - 1, k.i + posun[0])), j: Math.max(0, Math.min(vys.res - 1, k.j + posun[1])) };
    kresli();
  });
  $('#b-ci-png').addEventListener('click', () => {
    const c = document.createElement('canvas'); c.width = pl.width; c.height = pl.height;
    const x = c.getContext('2d'); x.fillStyle = getComputedStyle(pl).getPropertyValue('--bg-panel').trim(); x.fillRect(0, 0, c.width, c.height); x.drawImage(pl, 0, 0);
    c.toBlob(b => b && App.stahni('epidemie_citlivost.png', b));
  });
  new ResizeObserver(() => kresli()).observe(pl);
  new MutationObserver(() => kresli()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  App.zalozky.citlivost = { aktivuj() { kresli(); }, zmena() { /* mapa se přepočítá ručně */ } };
  App.citlivost = { spocti, get vys() { return vys; } };
})();

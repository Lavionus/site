/* ============================================================
   krajky/ui.js – ovládání stránky krajky.html.
   Stav = jeden objekt parametrů (KRAJKY.vychozi()), ukládá se do
   localStorage 'webapp_krajky'; pojmenované krajky přes tvary.js.
   ============================================================ */
(function () {
  'use strict';
  const K = window.KRAJKY, V = window.KRAJKY_VYSTUP;
  const $ = id => document.getElementById(id);
  const KLIC = 'webapp_krajky';

  let p = K.vychozi(), seed = 1;
  let model = null, mustek = null, klin = null;
  const zobraz = { mustek: true, meritko: true, nakres: true, klin: 0 };
  try { const s = JSON.parse(localStorage.getItem(KLIC) || 'null'); if (s && s.p) { p = Object.assign(K.vychozi(), s.p); seed = s.seed || 1; Object.assign(zobraz, s.zobraz || {}); } } catch (e) { /* poškozený stav – výchozí */ }
  if (!p.barva) p.barva = '#f4efe3';
  if (!p.podklad) p.podklad = '#7a2335';

  /* ---------- předlohy ---------- */
  const k = (motiv, nasobek, vaha, x) => Object.assign({ motiv, nasobek, vaha, rady: 1, strida: false, posun: false, otoc: false, vypln: 0.85 }, x || {});
  const PREDLOHY = {
    decka: [
      { nazev: '🌼 Klasická dečka', p: K.vychozi() },
      { nazev: '❄️ Sněhová vločka (vystřihovánka na 8)', p: { symetrie: 8, stred: { typ: 'hvezda', polomer: 14, nasobek: 1 }, okraj: { typ: 'spicky', vyska: 10, nasobek: 2, diry: false },
        kruhy: [k('listek', 1, 1.4, { vypln: 0.6 }), k('kosoctverec', 2, 0.8, { posun: true }), k('hvezda', 2, 0.9), k('kapka', 4, 1.2, { vypln: 0.75 })] } },
      { nazev: '⛪ Rozeta jako katedrální okno', p: { symetrie: 12, stred: { typ: 'kvet', polomer: 16, nasobek: 1 }, okraj: { typ: 'pikoty', vyska: 8, nasobek: 2, diry: false },
        kruhy: [k('kapka', 1, 1), k('krouzek', 2, 0.5, { posun: true }), k('oblouk', 2, 1.6), k('trojlistek', 2, 0.8, { posun: true })] } },
      { nazev: '🕸 Síťková dečka', p: { symetrie: 16, stred: { typ: 'kruh', polomer: 12, nasobek: 1 }, okraj: { typ: 'oblouky', vyska: 8, nasobek: 2, diry: true },
        kruhy: [k('kvet', 1, 0.8), k('kosoctverec', 2, 2.2, { rady: 4, strida: true, vypln: 0.8 }), k('srdce', 2, 0.8, { posun: true })] } },
      { nazev: '🪭 Vějířky', p: { symetrie: 10, stred: { typ: 'kvet', polomer: 20, nasobek: 1 }, okraj: { typ: 'vlnky', vyska: 7, nasobek: 2, diry: true },
        kruhy: [k('vejir', 1, 1.3), k('oval', 2, 0.6, { posun: true }), k('vejir', 2, 1.3, { posun: true }), k('krouzek', 4, 0.5)] } },
    ],
    pas: [
      { nazev: '〰️ Obloučkový lem', p: { symetrie: 10, pas: { delka: 300, vyska: 45 }, okraj: { typ: 'oblouky', vyska: 9, nasobek: 1, diry: true },
        kruhy: [k('krouzek', 2, 0.6), k('oblouk', 1, 1.4)] } },
      { nazev: '❤️ Srdíčková stuha', p: { symetrie: 12, pas: { delka: 300, vyska: 35 }, okraj: { typ: 'vlnky', vyska: 6, nasobek: 1, diry: false },
        kruhy: [k('srdce', 1, 1), k('kosoctverec', 2, 0.5, { rady: 1 })] } },
      { nazev: '🏠 Okraj police (pikoty)', p: { symetrie: 8, pas: { delka: 400, vyska: 60 }, okraj: { typ: 'pikoty', vyska: 12, nasobek: 1, diry: true },
        kruhy: [k('kosoctverec', 3, 0.8, { rady: 2, strida: true }), k('kapka', 1, 1.4, { otoc: true })] } },
    ],
    podvinek: [
      { nazev: '🟪 Plátno – pro začátek', q: { roztec: 3, uhel: 45, velikost: 4, pudice: 1, opakovani: 4, motivy: ['platno'], vejir: true } },
      { nazev: '🕷 Pavouci', q: { roztec: 3, uhel: 45, velikost: 4, pudice: 1, opakovani: 4, motivy: ['pavouk'], vejir: true } },
      { nazev: '🔀 Plátno a půlhod střídavě', q: { roztec: 2.5, uhel: 45, velikost: 3, pudice: 1, opakovani: 6, motivy: ['platno', 'pulhod'], vejir: true } },
      { nazev: '🎀 Plátno, pavouk, půlhod', q: { roztec: 3, uhel: 45, velikost: 6, pudice: 2, opakovani: 3, motivy: ['platno', 'pavouk', 'pulhod'], vejir: true } },
    ],
  };

  /* ---------- formulář ↔ parametry ---------- */
  const naplnSelect = (el, mapa) => { el.innerHTML = Object.entries(mapa).map(([h, n]) => `<option value="${h}">${n}</option>`).join(''); };
  naplnSelect($('stredTyp'), K.STREDY);
  naplnSelect($('okrajTyp'), Object.fromEntries(Object.entries(K.OKRAJE).map(([h, o]) => [h, o.nazev])));
  const motivyPodv = Object.assign({ '': '—' }, Object.fromEntries(Object.entries(K.PODVINEK_MOTIVY).map(([h, o]) => [h, o.nazev])));
  ['mot1', 'mot2', 'mot3'].forEach(id => naplnSelect($(id), motivyPodv));
  $('mot1').querySelector('option[value=""]').remove();

  const POLE = [   // id, cesta v p, číslo?
    ['prumer', 'prumer', 1], ['symetrie', 'symetrie', 1], ['symetrieP', 'symetrie', 1], ['delka', 'pas.delka', 1], ['vyska', 'pas.vyska', 1],
    ['mustek', 'mustek', 1], ['stredTyp', 'stred.typ'], ['stredR', 'stred.polomer', 1], ['stredN', 'stred.nasobek', 1],
    ['okrajTyp', 'okraj.typ'], ['okrajV', 'okraj.vyska', 1], ['okrajN', 'okraj.nasobek', 1], ['okrajD', 'okraj.diry', 'chk'],
    ['roztec', 'podvinek.roztec', 1], ['uhel', 'podvinek.uhel', 1], ['velikost', 'podvinek.velikost', 1], ['pudice', 'podvinek.pudice', 1],
    ['opakovani', 'podvinek.opakovani', 1], ['vejir', 'podvinek.vejir', 'chk'], ['barva', 'barva'], ['podklad', 'podklad'],
  ];
  const ziskej = (cesta) => cesta.split('.').reduce((o, c) => o && o[c], p);
  const nastav = (cesta, v) => { const c = cesta.split('.'), posl = c.pop(); c.reduce((o, x) => o[x], p)[posl] = v; };

  function doFormulare() {
    for (const [id, cesta, typ] of POLE) {
      const v = ziskej(cesta);
      if (typ === 'chk') $(id).checked = !!v; else $(id).value = v;
    }
    const m = p.podvinek.motivy || ['platno'];
    $('mot1').value = m[0] || 'platno'; $('mot2').value = m[1] || ''; $('mot3').value = m[2] || '';
    document.querySelectorAll('#druhy [data-druh]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.druh === p.druh)));
    const rez = p.druh !== 'podvinek';
    document.querySelectorAll('[data-jen]').forEach(el => {
      const j = el.dataset.jen;
      el.hidden = !(j === p.druh || (j === 'rez' && rez));
    });
    vykresliPasy();
  }
  for (const [id, cesta, typ] of POLE) {
    $(id).addEventListener('input', () => {
      const el = $(id);
      if (typ === 'chk') nastav(cesta, el.checked);
      else if (typ) { const v = parseFloat(el.value); if (!isFinite(v)) return; nastav(cesta, v); }
      else nastav(cesta, el.value);
      prepocet(id === 'prumer' || id === 'delka' || id === 'vyska' || id === 'roztec' || id === 'opakovani');
    });
  }
  ['mot1', 'mot2', 'mot3'].forEach(id => $(id).addEventListener('input', () => {
    p.podvinek.motivy = [$('mot1').value, $('mot2').value, $('mot3').value].filter(Boolean);
    prepocet();
  }));

  /* ---------- editor pásů ---------- */
  const moznostiMotivu = Object.entries(K.MOTIVY).map(([h, m]) => `<option value="${h}">${m.nazev}</option>`).join('');
  function vykresliPasy() {
    const el = $('pasy');
    el.innerHTML = p.kruhy.map((r, i) => `
      <div class="pas" data-i="${i}">
        <div class="pas-hlava"><b>${i + 1}.</b><span data-info></span><span class="mezera"></span>
          <button data-akce="nahoru" ${i ? '' : 'disabled'} title="Blíž ke středu" aria-label="Posunout nahoru">↑</button>
          <button data-akce="dolu" ${i < p.kruhy.length - 1 ? '' : 'disabled'} title="Dál od středu" aria-label="Posunout dolů">↓</button>
          <button data-akce="smazat" title="Odebrat pás" aria-label="Odebrat pás">✕</button></div>
        <label class="pop">Motiv</label><select data-k="motiv">${moznostiMotivu}</select>
        <div class="mrizka3">
          <div><label class="pop">Násobek</label><input type="number" data-k="nasobek" min="1" max="60" step="1" value="${r.nasobek}"></div>
          <div><label class="pop">Váha</label><input type="number" data-k="vaha" min="0.1" max="10" step="0.1" value="${r.vaha}"></div>
          <div><label class="pop">Řady</label><input type="number" data-k="rady" min="1" max="6" step="1" value="${r.rady}"></div>
        </div>
        <label class="pop">Šířka otvoru: <span data-vypln>${Math.round(r.vypln * 100)} %</span></label>
        <input type="range" data-k="vypln" min="0.2" max="1" step="0.01" value="${r.vypln}">
        <div class="volby">
          <label class="chk"><input type="checkbox" data-k="strida" ${r.strida ? 'checked' : ''}> střídat řady</label>
          <label class="chk"><input type="checkbox" data-k="posun" ${r.posun ? 'checked' : ''}> posunout o ½</label>
          <label class="chk"><input type="checkbox" data-k="otoc" ${r.otoc ? 'checked' : ''}> otočit</label>
        </div>
      </div>`).join('');
    el.querySelectorAll('.pas').forEach(d => { d.querySelector('[data-k="motiv"]').value = p.kruhy[+d.dataset.i].motiv; });
    popisPasu();
  }
  function popisPasu() {
    if (!model || !model.pasma) return;
    document.querySelectorAll('#pasy .pas').forEach(d => {
      const i = +d.dataset.i, r = p.kruhy[i], pm = model.pasma[i];
      if (!r) return;
      d.querySelector('[data-info]').textContent = pm ? ` ${p.symetrie * Math.max(1, Math.round(r.nasobek))} × ${r.rady > 1 ? r.rady + ' řady' : ''} · ${(pm.do - pm.od).toFixed(1)} mm` : '';
    });
  }
  $('pasy').addEventListener('input', e => {
    const d = e.target.closest('.pas'), kl = e.target.dataset.k;
    if (!d || !kl) return;
    const r = p.kruhy[+d.dataset.i];
    if (e.target.type === 'checkbox') r[kl] = e.target.checked;
    else if (kl === 'motiv') r[kl] = e.target.value;
    else { const v = parseFloat(e.target.value); if (!isFinite(v)) return; r[kl] = v; }
    if (kl === 'vypln') d.querySelector('[data-vypln]').textContent = Math.round(r.vypln * 100) + ' %';
    prepocet();
  });
  $('pasy').addEventListener('click', e => {
    const b = e.target.closest('[data-akce]');
    if (!b) return;
    const i = +b.closest('.pas').dataset.i, a = p.kruhy;
    if (b.dataset.akce === 'smazat') a.splice(i, 1);
    else { const j = b.dataset.akce === 'nahoru' ? i - 1 : i + 1; [a[i], a[j]] = [a[j], a[i]]; }
    vykresliPasy(); prepocet();
  });
  $('pridatPas').addEventListener('click', () => {
    const posl = p.kruhy[p.kruhy.length - 1];
    p.kruhy.push({ motiv: 'krouzek', nasobek: posl ? posl.nasobek * 2 : 2, vaha: 0.6, rady: 1, strida: false, posun: true, otoc: false, vypln: 0.8 });
    vykresliPasy(); prepocet();
  });

  /* ---------- výpočet ---------- */
  let casovac = 0;
  function prepocet(prizpusobit) {
    try { localStorage.setItem(KLIC, JSON.stringify({ p, seed, zobraz })); } catch (e) { /* plné úložiště – nevadí */ }
    clearTimeout(casovac);
    casovac = setTimeout(() => {
      if (p.druh === 'podvinek') { model = K.podvinek(p.podvinek); mustek = null; klin = null; }
      else {
        model = K.sestav(p);
        mustek = K.mustky(model);
        klin = zobraz.klin && p.druh === 'decka' ? K.klin(p, model, zobraz.klin) : null;
      }
      if (prizpusobit) pohled = null;
      popisPasu(); stav(); kresli();
    }, 60);
  }
  const cs = (x, d) => Number(x).toLocaleString('cs-CZ', { maximumFractionDigits: d == null ? 1 : d });
  function stav() {
    const s = [], i = model.info, h = [];
    if (model.druh === 'podvinek') {
      s.push(`<span>Podvinek <b>${cs(model.sirka)} × ${cs(model.vyska)} mm</b></span>`, `<span>špendlíků <b>${i.spendliku}</b></span>`,
        `<span>motiv <b>${i.velikost} kroků</b></span>`, `<span>rapport <b>${cs(i.delkaRapportu)} mm</b></span>`, `<span>mřížka <b>${cs(i.dx, 2)} × ${cs(i.dy, 2)} mm</b></span>`);
      if (p.podvinek.motivy.includes('pavouk') && p.podvinek.velikost % 2) h.push('Pavouk potřebuje sudou velikost motivu – použito ' + i.velikost + '.');
    } else {
      s.push(`<span>${model.druh === 'decka' ? 'Dečka ⌀' : 'Pás'} <b>${model.druh === 'decka' ? cs(model.sirka) : cs(model.sirka) + ' × ' + cs(model.vyska)} mm</b></span>`,
        `<span>otvorů <b>${i.otvoru}</b></span>`, `<span>délka řezu <b>${cs(i.rez, 2)} m</b></span>`, `<span>prolomení <b>${cs(i.prolomeni * 100, 0)} %</b></span>`);
      const ok = mustek.min >= i.mustek * 0.98;
      s.push(`<span>nejužší můstek <b class="${ok ? 'dobre' : 'zle'}">${isFinite(mustek.min) ? cs(mustek.min, 2) + ' mm' : '–'}</b></span>`);
      if (!ok && isFinite(mustek.min)) h.push(`Nejužší místo (${cs(mustek.min, 2)} mm) je užší než zadaný můstek – červený kroužek v náhledu.`);
      h.push(...model.varovani);
      if (klin && !klin.ok) h.push(klin.duvod);
    }
    $('stav').innerHTML = s.join('');
    $('hlaseni').innerHTML = h.map(t => `<div>⚠️ ${t.replace(/[<&]/g, '')}</div>`).join('');
    const lg = $('legenda');
    lg.hidden = model.druh !== 'podvinek' || !zobraz.nakres;
    lg.innerHTML = Object.entries(K.PODVINEK_MOTIVY).filter(([h]) => h !== 'pudice').map(([h, m]) => `<span><i style="background:${m.barva}"></i>${m.nazev}</span>`).join('') + '<span><i style="background:#000"></i>půdice, kraj</span>';
  }

  /* ---------- náhled ---------- */
  const cv = $('platno'), ctx = cv.getContext('2d');
  let pohled = null;   // {s: px/mm, x, y: posun v px}
  function prizpusob() {
    let x0 = 0, y0 = 0, x1 = model.sirka, y1 = model.vyska;
    if (klin && klin.ok) { x0 = y0 = Infinity; x1 = y1 = -Infinity; for (const [x, y] of klin.cesta) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } }
    const w = cv.clientWidth, h = cv.clientHeight, s = Math.min(w / (x1 - x0), h / (y1 - y0)) * 0.94;
    pohled = { s, x: (w - (x1 - x0) * s) / 2 - x0 * s, y: (h - (y1 - y0) * s) / 2 - y0 * s };
  }
  function kresli() {
    if (!model) return;
    const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    if (!pohled) prizpusob();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const podv = model.druh === 'podvinek';
    ctx.fillStyle = podv ? '#e9e6df' : p.podklad; ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.translate(pohled.x, pohled.y); ctx.scale(pohled.s, pohled.s);
    if (podv) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, model.sirka, model.vyska); }
    V.canvas(ctx, V.primitiva(model, { styl: 'nahled', barva: p.barva, klin, nakres: zobraz.nakres }), 1 / pohled.s);
    if (zobraz.mustek && mustek && isFinite(mustek.min) && !(klin && klin.ok)) {
      ctx.beginPath(); ctx.arc(mustek.x, mustek.y, Math.max(2.5, 9 / pohled.s), 0, Math.PI * 2);
      ctx.strokeStyle = '#e53935'; ctx.lineWidth = 2 / pohled.s; ctx.stroke();
    }
    ctx.restore();
    if (zobraz.meritko) {
      const d = 10 * pohled.s, x = 12, y = h - 14;
      ctx.fillStyle = podv ? '#222' : kontrast(p.podklad); ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + d, y); ctx.moveTo(x, y - 4); ctx.lineTo(x, y + 4); ctx.moveTo(x + d, y - 4); ctx.lineTo(x + d, y + 4); ctx.stroke();
      ctx.font = '12px sans-serif'; ctx.fillText('10 mm', x + d + 6, y + 4);
    }
  }
  const kontrast = hex => { const [r, g, b] = window.STENCIL_VYSTUP.hexRgb(hex); return (0.299 * r + 0.587 * g + 0.114 * b) > 140 ? '#111' : '#f5f5f5'; };
  new ResizeObserver(() => { pohled = null; kresli(); }).observe(cv);
  const zoom = (f, cx, cy) => {
    if (!pohled) return;
    cx = cx == null ? cv.clientWidth / 2 : cx; cy = cy == null ? cv.clientHeight / 2 : cy;
    const s = Math.max(0.2, Math.min(200, pohled.s * f)), k2 = s / pohled.s;
    pohled = { s, x: cx - (cx - pohled.x) * k2, y: cy - (cy - pohled.y) * k2 };
    kresli();
  };
  cv.addEventListener('wheel', e => { e.preventDefault(); const r = cv.getBoundingClientRect(); zoom(e.deltaY < 0 ? 1.2 : 1 / 1.2, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  const doteky = new Map(); let tah = null;
  cv.addEventListener('pointerdown', e => {
    try { cv.setPointerCapture(e.pointerId); } catch (er) { /* syntetická událost */ }
    doteky.set(e.pointerId, [e.clientX, e.clientY]); tah = null;
  });
  cv.addEventListener('pointermove', e => {
    if (!doteky.has(e.pointerId) || !pohled) return;
    const [px, py] = doteky.get(e.pointerId);
    if (doteky.size === 2) {
      const [a, b] = [...doteky.values()], d0 = Math.hypot(a[0] - b[0], a[1] - b[1]);
      doteky.set(e.pointerId, [e.clientX, e.clientY]);
      const [c2, d2] = [...doteky.values()], d1 = Math.hypot(c2[0] - d2[0], c2[1] - d2[1]), r = cv.getBoundingClientRect();
      if (d0 > 0) zoom(d1 / d0, (c2[0] + d2[0]) / 2 - r.left, (c2[1] + d2[1]) / 2 - r.top);
      return;
    }
    doteky.set(e.pointerId, [e.clientX, e.clientY]);
    pohled.x += e.clientX - px; pohled.y += e.clientY - py; tah = 1; kresli();
  });
  const pust = e => { doteky.delete(e.pointerId); };
  cv.addEventListener('pointerup', pust); cv.addEventListener('pointercancel', pust);
  cv.addEventListener('dblclick', () => { pohled = null; kresli(); });

  /* ---------- export ---------- */
  function stahni(data, jmeno, typ) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type: typ }));
    a.download = jmeno; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  const jmenoSouboru = () => {
    const n = sbirka && sbirka.aktivni();
    return (n || ({ decka: 'decka', pas: 'lemovka', podvinek: 'podvinek' })[p.druh]).replace(/[^\p{L}\p{N}._-]+/gu, '_');
  };
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
  function popisRadky() {
    const i = model.info;
    if (model.druh === 'podvinek') {
      const q = p.podvinek;
      return [`Torchon, rozteč ${cs(q.roztec)} mm, úhel ${q.uhel}°, motiv ${i.velikost} kroků: ${q.motivy.map(m => K.PODVINEK_MOTIVY[m].nazev).join(' / ')}`,
        `Opakování ${i.opakovani}, délka rapportu ${cs(i.delkaRapportu)} mm, špendlíků ${i.spendliku}`];
    }
    return [`${model.druh === 'decka' ? `Dečka ⌀ ${cs(model.sirka)} mm` : `Pás ${cs(model.sirka)} × ${cs(model.vyska)} mm`}, četnost ${p.symetrie}, můstek ${cs(p.mustek)} mm (naměřeno nejméně ${cs(mustek.min, 2)} mm)`,
      `Otvorů ${i.otvoru}, délka řezu ${cs(i.rez, 2)} m, prolomení ${cs(i.prolomeni * 100, 0)} %`];
  }
  async function pdf(F) {
    if (!window.jspdf) return Dialog.chyba('Knihovna jsPDF se nenačetla.');
    const pismo = await nactiPismo();
    let kl = null, postup;
    if (F) {
      kl = K.klin(p, model, F);
      if (!kl.ok) return Dialog.chyba(kl.duvod);
      postup = [`Čtvercový papír o straně aspoň ${cs(model.sirka)} mm přeložte napůl, znovu napůl a pak úhlopříčně (8 vrstev${F === 16 ? ', ještě jednou napůl = 16' : ''}).`,
        `Vytištěnou výseč ${cs(kl.uhel, 1)}° přiložte špičkou do rohu se středem papíru, modré čárkované hrany na ohyby.`,
        'Vystřihněte šedé plochy uvnitř i vše vně obrysu přes všechny vrstvy, papír opatrně rozložte a vyžehlete.'];
    } else if (model.druh === 'podvinek') postup = ['Podvinek připevněte na herdulku, body propíchněte šídlem a podle nákresu paličkujte.',
      'Barvy: fialová plátno, zelená půlhod, červená pavouk, černá půdice a kraj.'];
    else postup = ['Vyřízněte bílé plochy podél černé čáry (otvory i okolí obrysu), šedý materiál ponechte.'];
    let prim = V.primitiva(model, { styl: 'tisk', klin: kl, nakres: zobraz.nakres }), mod = model;
    if (kl) {
      const xs = kl.cesta.map(b => b[0]), ys = kl.cesta.map(b => b[1]);
      ({ model: mod, prim } = V.vyrez(model, prim, Math.min(...xs) - 1, Math.min(...ys) - 1, Math.max(...xs) + 1, Math.max(...ys) + 1));
    }
    const [w, h] = $('papir').value.split('x').map(Number);
    const doc = V.pdf(window.jspdf.jsPDF, mod, prim, { papir: { w, h }, okraj: +$('okrajTisku').value || 10, nazev: F ? `Vystřihovánka – papír složený na ${F}` : ({ decka: 'Krajková dečka', pas: 'Krajková lemovka', podvinek: 'Podvinek – torchon' })[p.druh],
      radky: popisRadky(), postup, pismo });
    stahni(doc.output('blob'), jmenoSouboru() + (F ? '_vystrihovanka' + F : '') + '.pdf');
  }
  function png() {
    const dpi = 300, s = dpi / 25.4, max = 12000;
    const k2 = Math.min(s, max / model.sirka, max / model.vyska);
    const c2 = document.createElement('canvas'); c2.width = Math.ceil(model.sirka * k2); c2.height = Math.ceil(model.vyska * k2);
    const x = c2.getContext('2d'); x.scale(k2, k2);
    if (model.druh === 'podvinek') { x.fillStyle = '#fff'; x.fillRect(0, 0, model.sirka, model.vyska); }
    V.canvas(x, V.primitiva(model, { styl: 'nahled', barva: p.barva, klin, nakres: zobraz.nakres }), 0);
    c2.toBlob(b => b ? stahni(b, jmenoSouboru() + '.png') : Dialog.chyba('Obrázek je moc velký.'), 'image/png');
  }

  /* ---------- nabídky a příkazy ---------- */
  const PRIKAZY = {
    nahodny: () => { seed++; p = K.nahodny(seed, p); doFormulare(); prepocet(); },
    pdf: () => pdf(0), klin8: () => pdf(8), klin16: () => pdf(16),
    svg: () => stahni(V.svg(model, V.primitiva(model, { styl: 'nahled', barva: p.barva, klin, nakres: zobraz.nakres }), popisRadky().join('; ')), jmenoSouboru() + '.svg', 'image/svg+xml'),
    svgRez: () => stahni(V.svg(model, V.primitiva(model, { styl: 'rez' }), popisRadky().join('; ')), jmenoSouboru() + '_rez.svg', 'image/svg+xml'),
    dxf: () => stahni(V.dxf(model), jmenoSouboru() + '.dxf', 'application/dxf'),
    png,
    ukMustek: () => { zobraz.mustek = !zobraz.mustek; },
    ukMeritko: () => { zobraz.meritko = !zobraz.meritko; },
    ukNakres: () => { zobraz.nakres = !zobraz.nakres; },
    ukKlin0: () => { zobraz.klin = 0; }, ukKlin8: () => { zobraz.klin = 8; }, ukKlin16: () => { zobraz.klin = 16; },
    prizpusob: () => { pohled = null; kresli(); },
    pribliz: () => zoom(1.4), oddal: () => zoom(1 / 1.4),
    napoveda: () => $('napoveda').showModal(),
    zavritNapovedu: () => $('napoveda').close(),
  };
  function stavPrepinacu() {
    const m = { ukMustek: zobraz.mustek, ukMeritko: zobraz.meritko, ukNakres: zobraz.nakres, ukKlin0: !zobraz.klin, ukKlin8: zobraz.klin === 8, ukKlin16: zobraz.klin === 16 };
    for (const [id, v] of Object.entries(m)) document.querySelectorAll(`[data-prikaz="${id}"]`).forEach(b => b.setAttribute('aria-pressed', String(v)));
  }
  function predlohy() {
    $('nabPredlohy').innerHTML = `<div class="titulek">${({ decka: 'Dečky', pas: 'Lemovky', podvinek: 'Podvinky' })[p.druh]}</div>` +
      PREDLOHY[p.druh].map((x, i) => `<button class="tl" data-predloha="${i}">${x.nazev}</button>`).join('');
  }
  $('nabPredlohy').addEventListener('click', e => {
    const b = e.target.closest('[data-predloha]'); if (!b) return;
    const x = PREDLOHY[p.druh][+b.dataset.predloha];
    if (x.q) p.podvinek = JSON.parse(JSON.stringify(x.q));
    else { const n = JSON.parse(JSON.stringify(x.p)); delete n.druh; delete n.prumer; delete n.mustek; Object.assign(p, n); }
    zavriNabidky(); doFormulare(); prepocet(true);
  });
  function zavriNabidky() {
    document.querySelectorAll('.nabidka:not([hidden])').forEach(n => { n.hidden = true; });
    document.querySelectorAll('[data-nabidka][aria-expanded="true"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
  }
  document.querySelectorAll('[data-nabidka]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    const n = $(b.dataset.nabidka), bylo = !n.hidden;
    zavriNabidky();
    if (bylo) return;
    if (n.id === 'nabPredlohy') predlohy();
    n.hidden = false; b.setAttribute('aria-expanded', 'true');
    const r = b.getBoundingClientRect();
    n.style.top = (r.bottom + 4) + 'px';
    n.style.left = Math.max(6, Math.min(r.left, innerWidth - n.offsetWidth - 6)) + 'px';
  }));
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-prikaz]');
    if (b && !b.disabled && !b.hidden) {
      e.stopPropagation();
      const zustan = b.classList.contains('prep');
      if (!zustan) zavriNabidky();
      PRIKAZY[b.dataset.prikaz]();
      if (zustan) { stavPrepinacu(); prepocet(b.dataset.prikaz.startsWith('ukKlin')); }
      return;
    }
    if (!e.target.closest('.nabidka')) zavriNabidky();
  });
  addEventListener('resize', zavriNabidky);
  $('druhy').addEventListener('click', e => {
    const b = e.target.closest('[data-druh]'); if (!b || b.dataset.druh === p.druh) return;
    p.druh = b.dataset.druh; doFormulare(); prepocet(true);
  });
  addEventListener('keydown', e => {
    if (e.target.closest('input,select,textarea') || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'F1') { e.preventDefault(); PRIKAZY.napoveda(); }
    else if (e.code === 'KeyR') PRIKAZY.nahodny();
    else if (e.key === 'Escape') zavriNabidky();
  });

  /* ---------- moje krajky ---------- */
  const sbirka = window.Tvary ? Tvary.pripoj({
    klic: 'webapp_krajky_tvary', typ: 'krajky', nazev: 'Krajky', kontejner: $('tvary'),
    parametry: () => JSON.parse(JSON.stringify(p)),
    pouzij: (x) => { p = Object.assign(K.vychozi(), x); doFormulare(); prepocet(true); },
    popis: (x) => x.druh === 'podvinek' ? `podvinek ${x.podvinek.roztec} mm, ${x.podvinek.opakovani}×` : x.druh === 'pas' ? `lemovka ${x.pas.delka} × ${x.pas.vyska} mm` : `dečka ⌀ ${x.prumer} mm, ${x.symetrie}×`,
  }) : null;

  doFormulare(); stavPrepinacu(); prepocet(true);
})();

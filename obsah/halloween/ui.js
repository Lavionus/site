/* ============================================================
   halloween/ui.js – ovládání stránky halloween.html.
   Pole formuláře se na parametry váží atributem data-p="režim.klíč".
   Kreslení a exporty bere z krajky/vystup.js (KRAJKY_VYSTUP).
   ============================================================ */
(function () {
  'use strict';
  const H = window.HALLOWEEN, V = window.KRAJKY_VYSTUP, KR = window.KRAJKY;
  const $ = id => document.getElementById(id);
  const KLIC = 'webapp_halloween';

  let p = H.vychozi(), model = null;
  const zobraz = { meritko: true, mustek: true };
  try {
    const s = JSON.parse(localStorage.getItem(KLIC) || 'null');
    if (s && s.p) { const v = H.vychozi(); for (const k of Object.keys(v)) if (s.p[k] && typeof v[k] === 'object') Object.assign(v[k], s.p[k]); else if (s.p[k] != null) v[k] = s.p[k]; p = v; }
    if (s && s.zobraz) Object.assign(zobraz, s.zobraz);
  } catch (e) { /* poškozený stav – výchozí */ }

  /* ---------- formulář ---------- */
  const naplnSelect = (el, mapa) => { el.innerHTML = Object.entries(mapa).map(([h, n]) => `<option value="${h}">${n}</option>`).join(''); };
  naplnSelect($('dyOci'), H.OCI); naplnSelect($('dyNos'), H.NOS); naplnSelect($('dyUsta'), H.USTA);
  naplnSelect($('gMotiv'), Object.fromEntries(Object.entries(H.SILUETY).map(([h, s]) => [h, s.nazev])));
  $('slMotivy').innerHTML = Object.entries(H.SILUETY).map(([h, s]) => `<label class="chk"><input type="checkbox" value="${h}"> ${s.nazev}</label>`).join('');
  const ziskej = c => c.split('.').reduce((o, k) => o && o[k], p);
  const nastav = (c, v) => { const a = c.split('.'), posl = a.pop(); a.reduce((o, k) => o[k], p)[posl] = v; };

  function doFormulare() {
    document.querySelectorAll('[data-p]').forEach(el => {
      const v = ziskej(el.dataset.p);
      if (el.type === 'checkbox') el.checked = !!v; else el.value = v;
    });
    document.querySelectorAll('#slMotivy input').forEach(el => { el.checked = p.siluety.motivy.includes(el.value); });
    [$('barva').value, $('podklad').value] = p.barvy[p.druh];
    document.querySelectorAll('#druhy [data-druh]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.druh === p.druh)));
    document.querySelectorAll('[data-jen]').forEach(el => { el.hidden = el.dataset.jen !== p.druh; });
  }
  document.querySelectorAll('[data-p]').forEach(el => el.addEventListener('input', () => {
    if (el.type === 'checkbox') nastav(el.dataset.p, el.checked);
    else if (el.type === 'number' || el.type === 'range') { const v = parseFloat(el.value); if (!isFinite(v)) return; nastav(el.dataset.p, v); }
    else nastav(el.dataset.p, el.value);
    prepocet(el.type !== 'range' && el.type !== 'checkbox');
  }));
  $('slMotivy').addEventListener('input', () => {
    p.siluety.motivy = [...document.querySelectorAll('#slMotivy input:checked')].map(e => e.value);
    prepocet();
  });
  for (const [id, i] of [['barva', 0], ['podklad', 1]]) $(id).addEventListener('input', () => { p.barvy[p.druh][i] = $(id).value; prepocet(); });

  /* ---------- výpočet ---------- */
  let casovac = 0;
  function prepocet(prizpusobit) {
    try { localStorage.setItem(KLIC, JSON.stringify({ p, zobraz })); } catch (e) { /* plné úložiště */ }
    clearTimeout(casovac);
    casovac = setTimeout(() => {
      try { model = H.sestav(p); }
      catch (e) { model = { druh: p.druh, sirka: 100, vyska: 100, cesty: [], otevrene: [], pomocne: [], varovani: ['Výpočet selhal: ' + e.message], info: {} }; }
      if (prizpusobit) pohled = null;
      stav(); kresli();
    }, 60);
  }
  const cs = (x, d) => Number(x).toLocaleString('cs-CZ', { maximumFractionDigits: d == null ? 1 : d });
  function stav() {
    const s = [`<span>${p.druh === 'siluety' ? 'Plocha listu' : 'Rozměr'} <b>${cs(model.sirka)} × ${cs(model.vyska)} mm</b></span>`], i = model.info;
    if (p.druh === 'pavucina') s.push(`<span>vláken <b>${i.vlaken}</b></span>`, `<span>délka vláken <b>${cs(i.delkaVlaken, 2)} m</b></span>`);
    if (p.druh === 'dyne') s.push(`<span>otvorů <b>${i.otvoru}</b></span>`, `<span>šířka obličeje <b>${cs(i.sirkaDyne)} mm</b></span>`,
      `<span>nejužší můstek <b class="${i.nejuzsi >= p.dyne.mustek * 0.98 ? 'dobre' : 'zle'}">${isFinite(i.nejuzsi) ? cs(i.nejuzsi) + ' mm' : '–'}</b></span>`);
    if (p.druh === 'girlanda') s.push(`<span>pruh papíru <b>${cs(i.delkaPapiru)} × ${cs(p.girlanda.vyska)} mm</b></span>`, `<span>dílů <b>${i.panelu}</b></span>`);
    if (p.druh === 'siluety') s.push(`<span>siluet <b>${i.kusu}</b></span>`);
    $('stav').innerHTML = s.join('');
    $('hlaseni').innerHTML = model.varovani.map(t => `<div>⚠️ ${String(t).replace(/[<&]/g, '')}</div>`).join('');
    $('legenda').hidden = p.druh !== 'girlanda';
  }

  function primitiva(m, styl) {
    const o = [], barva = p.barvy[p.druh][0];
    if (styl === 'rez') {
      if (m.cesty.length) o.push({ t: 'cary', cesty: m.cesty, barva: '#ff0000', w: 0.1 });
      if (m.otevrene.length) o.push({ t: 'cary', cesty: m.otevrene, barva: '#ff0000', w: 0.1, otevrene: true });
      return o;
    }
    if (m.cesty.length) o.push(styl === 'tisk' ? { t: 'plocha', cesty: m.cesty, vypln: m.otevrene.length ? '#000000' : '#d2d2d2', cara: '#000000', w: 0.25 } : { t: 'plocha', cesty: m.cesty, vypln: barva });
    if (m.otevrene.length) o.push({ t: 'cary', cesty: m.otevrene, barva: styl === 'tisk' ? '#000000' : barva, w: m.sirkaCary, otevrene: true });
    for (const x of m.pomocne || []) o.push(Object.assign({ t: 'cary' }, x));
    return o;
  }

  /* ---------- náhled ---------- */
  const cv = $('platno'), ctx = cv.getContext('2d');
  let pohled = null;
  function prizpusob() {
    const w = cv.clientWidth, h = cv.clientHeight, s = Math.min(w / model.sirka, h / model.vyska) * 0.92;
    pohled = { s, x: (w - model.sirka * s) / 2, y: (h - model.vyska * s) / 2 };
  }
  const kontrast = hex => { const [r, g, b] = window.STENCIL_VYSTUP.hexRgb(hex); return (0.299 * r + 0.587 * g + 0.114 * b) > 140 ? '#111' : '#f5f5f5'; };
  function kresli() {
    if (!model) return;
    const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    if (!pohled) prizpusob();
    const podklad = p.barvy[p.druh][1];
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = podklad; ctx.fillRect(0, 0, w, h);
    ctx.save(); ctx.translate(pohled.x, pohled.y); ctx.scale(pohled.s, pohled.s);
    if (p.druh === 'siluety') {   // obrys listu
      ctx.setLineDash([4 / pohled.s, 3 / pohled.s]); ctx.strokeStyle = kontrast(podklad); ctx.lineWidth = 1 / pohled.s;
      ctx.strokeRect(0, 0, model.sirka, model.vyska); ctx.setLineDash([]);
    }
    V.canvas(ctx, primitiva(model, 'nahled'), 1 / pohled.s);
    const b = model.info && model.info.kde;
    if (zobraz.mustek && b && isFinite(b.min)) {
      ctx.beginPath(); ctx.arc(b.x, b.y, Math.max(3, 9 / pohled.s), 0, Math.PI * 2);
      ctx.strokeStyle = '#d32f2f'; ctx.lineWidth = 2 / pohled.s; ctx.stroke();
    }
    ctx.restore();
    if (zobraz.meritko) {
      const d = 10 * pohled.s, x = 12, y = h - 14;
      ctx.strokeStyle = ctx.fillStyle = kontrast(podklad); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + d, y); ctx.moveTo(x, y - 4); ctx.lineTo(x, y + 4); ctx.moveTo(x + d, y - 4); ctx.lineTo(x + d, y + 4); ctx.stroke();
      ctx.font = '12px sans-serif'; ctx.fillText('10 mm', x + d + 6, y + 4);
    }
  }
  new ResizeObserver(() => { pohled = null; kresli(); }).observe(cv);
  const zoom = (f, cx, cy) => {
    if (!pohled) return;
    cx = cx == null ? cv.clientWidth / 2 : cx; cy = cy == null ? cv.clientHeight / 2 : cy;
    const s = Math.max(0.05, Math.min(200, pohled.s * f)), k = s / pohled.s;
    pohled = { s, x: cx - (cx - pohled.x) * k, y: cy - (cy - pohled.y) * k };
    kresli();
  };
  cv.addEventListener('wheel', e => { e.preventDefault(); const r = cv.getBoundingClientRect(); zoom(e.deltaY < 0 ? 1.2 : 1 / 1.2, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  const doteky = new Map();
  cv.addEventListener('pointerdown', e => { try { cv.setPointerCapture(e.pointerId); } catch (er) { /* syntetická událost */ } doteky.set(e.pointerId, [e.clientX, e.clientY]); });
  cv.addEventListener('pointermove', e => {
    if (!doteky.has(e.pointerId) || !pohled) return;
    const [px, py] = doteky.get(e.pointerId);
    if (doteky.size === 2) {
      const [a, b] = [...doteky.values()], d0 = Math.hypot(a[0] - b[0], a[1] - b[1]);
      doteky.set(e.pointerId, [e.clientX, e.clientY]);
      const [c, d] = [...doteky.values()], d1 = Math.hypot(c[0] - d[0], c[1] - d[1]), r = cv.getBoundingClientRect();
      if (d0 > 0) zoom(d1 / d0, (c[0] + d[0]) / 2 - r.left, (c[1] + d[1]) / 2 - r.top);
      return;
    }
    doteky.set(e.pointerId, [e.clientX, e.clientY]);
    pohled.x += e.clientX - px; pohled.y += e.clientY - py; kresli();
  });
  const pust = e => doteky.delete(e.pointerId);
  cv.addEventListener('pointerup', pust); cv.addEventListener('pointercancel', pust);
  cv.addEventListener('dblclick', () => { pohled = null; kresli(); });

  /* ---------- export ---------- */
  const NAZVY = { pavucina: 'pavucina', dyne: 'dyne_sablona', girlanda: 'girlanda', siluety: 'siluety' };
  function stahni(data, jmeno, typ) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type: typ }));
    a.download = jmeno; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  const jmeno = () => ((sbirka && sbirka.aktivni()) || NAZVY[p.druh]).replace(/[^\p{L}\p{N}._-]+/gu, '_');
  const kRezu = () => (p.druh === 'girlanda' && model.sablona) ? model.sablona : model;   // girlanda: řeže se šablona jednoho dílu
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
  const POSTUP = {
    pavucina: ['Vystřihněte šedé mezery mezi vlákny (nejdřív uprostřed, pak k okraji), nakonec obrys.', 'Čárovou pavučinu nakreslete fixem nebo perem plotru po černých čarách.'],
    dyne: ['Vystřihněte obrys dýně, přilepte šablonu páskou na dýni a obrysy bílých otvorů propíchejte špendlíkem po 2–3 mm.', 'Šablonu sundejte a řežte podle teček; šedá dužina zůstává.'],
    girlanda: ['Pruh papíru o výšce dílu složte harmonikově na šířku dílu (modré čárkované = ohyby).', 'Šablonu přiložte na vrchní díl, stříhejte všemi vrstvami, zelené úseky na ohybech nestříhejte.'],
    siluety: ['Vytiskněte na černý papír nebo přeneste na černý karton, vystřihněte podél čar a nalepte na okno.'],
  };
  async function pdf() {
    if (!window.jspdf) return Dialog.chyba('Knihovna jsPDF se nenačetla.');
    const pismo = await nactiPismo(), m = kRezu();
    let papir;
    if (p.druh === 'siluety') {   // list siluet přesně na zvolený formát
      const [w, h] = p.siluety.list.split('x').map(Number);
      papir = { w, h };
    } else { const [w, h] = $('papir').value.split('x').map(Number); papir = { w, h }; }
    const okraj = p.druh === 'siluety' ? p.siluety.okraj : (+$('okrajTisku').value || 10);
    const nazvy = { pavucina: 'Pavučina', dyne: 'Šablona na dýni', girlanda: 'Girlanda – šablona dílu', siluety: 'Halloweenské siluety' };
    const radky = [`Rozměr ${cs(m.sirka)} × ${cs(m.vyska)} mm`];
    if (p.druh === 'girlanda') radky.push(`Pruh papíru ${cs(model.info.delkaPapiru)} × ${cs(p.girlanda.vyska)} mm, ${model.info.panelu} dílů po ${cs(p.girlanda.sirka)} mm`);
    if (p.druh === 'dyne') radky.push(`Nejužší můstek dužiny ${cs(model.info.nejuzsi)} mm`);
    const doc = V.pdf(window.jspdf.jsPDF, m, primitiva(m, 'tisk'), { papir, okraj, preklad: 10, nazev: nazvy[p.druh], radky, postup: POSTUP[p.druh], pismo });
    stahni(doc.output('blob'), jmeno() + '.pdf');
  }
  function png() {
    const s = 300 / 25.4, m = model, k = Math.min(s, 12000 / m.sirka, 12000 / m.vyska);
    const c = document.createElement('canvas'); c.width = Math.ceil(m.sirka * k); c.height = Math.ceil(m.vyska * k);
    const x = c.getContext('2d'); x.scale(k, k);
    V.canvas(x, primitiva(m, 'nahled'), 0);
    c.toBlob(b => b ? stahni(b, jmeno() + '.png') : Dialog.chyba('Obrázek je moc velký.'), 'image/png');
  }

  /* ---------- příkazy a nabídky ---------- */
  const PRIKAZY = {
    nahodny: () => { p = Object.assign(p, H.nahodny(p)); doFormulare(); prepocet(true); },
    pdf, png,
    svg: () => stahni(V.svg(model, primitiva(model, 'nahled'), 'Halloween'), jmeno() + '.svg', 'image/svg+xml'),
    svgRez: () => { const m = kRezu(); stahni(V.svg(m, primitiva(m, 'rez'), 'Halloween – řez'), jmeno() + '_rez.svg', 'image/svg+xml'); },
    dxf: () => stahni(V.dxf(kRezu()), jmeno() + '.dxf', 'application/dxf'),
    ukMeritko: () => { zobraz.meritko = !zobraz.meritko; },
    ukMustek: () => { zobraz.mustek = !zobraz.mustek; },
    prizpusob: () => { pohled = null; kresli(); },
    pribliz: () => zoom(1.4), oddal: () => zoom(1 / 1.4),
    napoveda: () => $('napoveda').showModal(),
    zavritNapovedu: () => $('napoveda').close(),
  };
  const stavPrepinacu = () => {
    document.querySelector('[data-prikaz="ukMeritko"]').setAttribute('aria-pressed', String(zobraz.meritko));
    document.querySelector('[data-prikaz="ukMustek"]').setAttribute('aria-pressed', String(zobraz.mustek));
  };
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
    if (b && !b.disabled) {
      e.stopPropagation();
      const prep = b.classList.contains('prep');
      if (!prep) zavriNabidky();
      PRIKAZY[b.dataset.prikaz]();
      if (prep) { stavPrepinacu(); prepocet(); }
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

  const sbirka = window.Tvary ? Tvary.pripoj({
    klic: 'webapp_halloween_tvary', typ: 'halloween', nazev: 'Halloween', kontejner: $('tvary'),
    parametry: () => JSON.parse(JSON.stringify(p)),
    pouzij: x => { const v = H.vychozi(); for (const k of Object.keys(v)) if (x[k] && typeof v[k] === 'object') Object.assign(v[k], x[k]); else if (x[k] != null) v[k] = x[k]; p = v; doFormulare(); prepocet(true); },
    popis: x => ({ pavucina: 'pavučina', dyne: 'dýně', girlanda: 'girlanda', siluety: 'siluety' })[x.druh] || x.druh,
  }) : null;

  doFormulare(); stavPrepinacu(); prepocet(true);
})();

/* Krabice z kartonu (FEFCO) – ovládání stránky */
(function () {
  'use strict';
  const K = window.KrabiceFefco, VY = window.KrabiceVystup;
  const $ = (id) => document.getElementById(id);
  const KLIC = 'webapp_krabice_fefco', KLIC_PV = 'webapp_krabice_fefco_predvolby';
  const VYCHOZI_UI = { jenVyroba: false, format: 'A4', orientace: 'auto', prekryv: 10, sirkaListu: 210, vyskaListu: 297 };
  const VYCHOZI_KARTON = { D: 60, S: 40, V: 120, material: 'K05', t: 0.5, g: 350 };
  const VYCHOZI_VLNA = { D: 300, S: 200, V: 150, material: 'B', t: 3, g: 520 };
  const POLE = ['D', 'S', 'V', 't', 'g', 'chlopen', 'presah', 'vule', 'hloubkaVika', 'vyskaPerf'];
  const ZASKRT = ['perforace', 'koty', 'popis', 'vlna', 'plnyTeleskop'];

  let S = Object.assign({}, K.VYCHOZI, VYCHOZI_UI);
  try { const u = JSON.parse(localStorage.getItem(KLIC) || 'null'); if (u && typeof u === 'object') S = Object.assign(S, u); } catch (e) { /* bez úložiště */ }
  let vysl = null, nahled3d = null, pohled2d = null, uzivZoom = false, posledniTyp = null;

  /* ---------- naplnění výběrů ---------- */
  const selTyp = $('typ');
  for (const [skup, nazev] of [['vlna', 'Vlnitá lepenka – kódy FEFCO'], ['karton', 'Karton – skládačky']]) {
    const og = document.createElement('optgroup'); og.label = nazev;
    for (const T of K.TYPY.filter(x => x.skup === skup)) { const o = document.createElement('option'); o.value = T.kod; o.textContent = T.nazev; og.appendChild(o); }
    selTyp.appendChild(og);
  }
  const selMat = $('material');
  for (const m of K.MATERIALY) { const o = document.createElement('option'); o.value = m.id; o.textContent = `${m.nazev} – ${String(m.t).replace('.', ',')} mm`; selMat.appendChild(o); }
  { const o = document.createElement('option'); o.value = 'vlastni'; o.textContent = 'vlastní (zadejte tloušťku a gramáž)'; selMat.appendChild(o); }

  function doFormulare() {
    selTyp.value = S.typ; selMat.value = K.MATERIALY.some(m => m.id === S.material) ? S.material : 'vlastni';
    for (const k of POLE) $(k).value = S[k];
    for (const k of ZASKRT) $(k).checked = !!S[k];
    $('spoj').value = S.spoj; $('jenVyroba').checked = !!S.jenVyroba;
    $('format').value = S.format; $('orientace').value = S.orientace; $('prekryv').value = S.prekryv;
    $('sirkaListu').value = S.sirkaListu; $('vyskaListu').value = S.vyskaListu;
  }
  function zFormulare() {
    S.typ = selTyp.value; S.material = selMat.value;
    for (const k of POLE) { const v = parseFloat(String($(k).value).replace(',', '.')); if (isFinite(v)) S[k] = v; }
    for (const k of ZASKRT) S[k] = $(k).checked;
    S.spoj = $('spoj').value; S.jenVyroba = $('jenVyroba').checked;
    S.format = $('format').value; S.orientace = $('orientace').value;
    for (const k of ['prekryv', 'sirkaListu', 'vyskaListu']) { const v = parseFloat($(k).value); if (isFinite(v)) S[k] = v; }
  }
  function uloz() { try { localStorage.setItem(KLIC, JSON.stringify(S)); } catch (e) { /* plné / zakázané úložiště */ } }

  /* ---------- viditelnost voleb podle typu ---------- */
  function viditelnost() {
    const T = K.typPodle(S.typ);
    $('popisTypu').textContent = T.popis;
    $('boxPresah').hidden = !T.presah;
    $('boxVicko').hidden = !T.vicko;
    $('boxTeleskop').hidden = S.typ !== '0320';
    $('boxHloubka').hidden = S.typ === '0320' && S.plnyTeleskop;
    $('boxPerf').hidden = !/^020/.test(S.typ);
    $('boxPerfV').hidden = !S.perforace;
    $('boxV').hidden = !!T.bezV;
    $('lD').textContent = S.typ === 'POL' ? 'Délka D' : 'Délka D';
    $('lV').textContent = S.typ === 'POL' ? 'Tloušťka V' : 'Výška V';
    $('boxVlastniList').hidden = S.format !== 'vlastni';
  }

  /* ---------- přepočet ---------- */
  let casovac = 0;
  function prepocti(okamzite) {
    clearTimeout(casovac);
    if (!okamzite) { casovac = setTimeout(() => prepocti(true), 60); return; }
    viditelnost();
    try { vysl = K.sestav(S); }
    catch (e) { $('chyby').hidden = false; $('chyby').textContent = 'Chyba výpočtu: ' + e.message; return; }
    const chyby = vysl.chyby.slice();
    if (S.typ === '0427' && S.V < 15) chyby.push('Výška pod 15 mm je pro 0427 nepraktická.');
    if (vysl.P.t >= 1 && K.typPodle(S.typ).skup === 'karton') chyby.push('Skládačky jsou navržené pro tenký karton (do 1 mm) – u vlnité lepenky zvolte typ FEFCO.');
    if (vysl.P.t < 1 && K.typPodle(S.typ).skup === 'vlna') chyby.push('Kódy FEFCO jsou pro vlnitou lepenku – tloušťka pod 1 mm je neobvyklá.');
    $('chyby').hidden = !chyby.length; $('chyby').textContent = chyby.join(' ');
    kresli2d(S.typ !== posledniTyp);
    if (nahled3d) {
      if (vysl.bez3d) { nahled3d.nastav(null); $('plocha3d').dataset.zprava = '1'; zprava3d('Zakřivený tvar polštářku se ve 3D neskládá – použijte 2D náhled.'); }
      else { zprava3d(''); nahled3d.nastav(vysl); nahled3d.slozeni(+$('slozeni').value / 1000); }
    }
    posledniTyp = S.typ;
    info(); uloz();
  }
  function zprava3d(t) {
    let z = $('zprava3d');
    if (!z) { z = document.createElement('div'); z.id = 'zprava3d'; z.style.cssText = 'position:relative;z-index:1;padding:20px;max-width:360px'; $('plocha3d').appendChild(z); }
    z.textContent = t; z.hidden = !t;
    const c = $('plocha3d').querySelector('canvas'); if (c) c.style.visibility = t ? 'hidden' : 'visible';
  }

  const f = (v) => K.fmt(v);
  function info() {
    const v = vysl, P = v.P, T = v.typ, m = K.MATERIALY.find(x => x.id === P.material);
    const rozm = (o, bezV) => o ? `${f(o.D)} × ${f(o.S)}${bezV || !o.V ? '' : ' × ' + f(o.V)} mm` : '–';
    const radky = [
      ['Typ', T.nazev],
      ['Vnitřní rozměr', rozm({ D: P.D, S: P.S, V: P.V }, T.bezV)],
      ['Výrobní (mezi bigy)', rozm(v.vyrobni)],
      ['Vnější (orientačně)', rozm(v.vnejsi)],
      ['Přířez', v.prirezy.map(p => `${p.nazev}: ${f(p.sirka)} × ${f(p.vyska)} mm`).join('<br>')],
      ['Celkový formát desky', `${f(v.sirka)} × ${f(v.vyska)} mm`],
      ['Plocha materiálu', `${(Math.round(v.plochaM2 * 1000) / 1000).toString().replace('.', ',')} m²`],
      ['Hmotnost (≈)', `${f(v.hmotnostG)} g`],
      ['Materiál', `${m ? m.nazev : 'vlastní'}, t = ${f(P.t)} mm, ${f(P.g)} g/m²`],
      ['Směr vlny', T.vlnaSvisle ? 'svisle – rovnoběžně s výškou krabice' : 'napříč dlouhou osou přířezu (viz šipka)']
    ];
    $('info').innerHTML = radky.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('');
    $('poznamka').textContent = v.poznamka || '';
    try {
      const sc = VY.scena(v), r = VY.rozvrhListu(sc, { format: S.format, orientace: S.orientace, prekryv: S.prekryv, sirkaListu: S.sirkaListu, vyskaListu: S.vyskaListu });
      $('listyInfo').textContent = `PDF: ${r.n} ${r.n === 1 ? 'list' : r.n < 5 ? 'listy' : 'listů'} ${S.format === 'vlastni' ? f(r.pw) + '×' + f(r.ph) : S.format} ${r.pw > r.ph ? 'na šířku' : 'na výšku'} (${r.nx} × ${r.ny}) + úvodní list s legendou a kontrolním čtvercem 50 mm.`;
    } catch (e) { $('listyInfo').textContent = ''; }
  }

  /* ---------- 2D náhled (SVG s posunem a zoomem) ---------- */
  function kresli2d(prizpusob) {
    const s = VY.svg(vysl, { nahled: true }).replace(/^<\?xml[^>]*>\s*/, '');
    const host = $('plocha2d'), nap = host.querySelector('.napoveda2d');
    host.innerHTML = s; host.appendChild(nap);
    const svg = host.querySelector('svg');
    svg.removeAttribute('width'); svg.removeAttribute('height');
    const st = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    st.textContent = 'path{vector-effect:non-scaling-stroke;stroke-width:1.3px}#CREASE path{stroke-dasharray:7 4}#PERF path{stroke-dasharray:2 3}#DIM path,#GLUE path,#FLUTE path{stroke-width:.8px}';
    svg.insertBefore(st, svg.firstChild);
    const vb = svg.viewBox.baseVal, zakl = { x: vb.x, y: vb.y, w: vb.width, h: vb.height };
    if (prizpusob || !uzivZoom || !pohled2d) { pohled2d = Object.assign({}, zakl); uzivZoom = false; }
    pohled2d.zakl = zakl;
    nastavVB();
  }
  function nastavVB() {
    const svg = $('plocha2d').querySelector('svg'); if (!svg || !pohled2d) return;
    svg.setAttribute('viewBox', `${pohled2d.x} ${pohled2d.y} ${pohled2d.w} ${pohled2d.h}`);
  }
  function meritko() { const h = $('plocha2d'); return Math.max(pohled2d.w / h.clientWidth, pohled2d.h / h.clientHeight); }
  function zoom(k, cx, cy) {
    if (!pohled2d) return;
    const h = $('plocha2d'), m = meritko();
    // bod pod kurzorem (v souřadnicích viewBoxu) zůstane na místě
    const ox = pohled2d.x + pohled2d.w / 2 - (h.clientWidth / 2) * m, oy = pohled2d.y + pohled2d.h / 2 - (h.clientHeight / 2) * m;
    const px = cx == null ? pohled2d.x + pohled2d.w / 2 : ox + cx * m, py = cy == null ? pohled2d.y + pohled2d.h / 2 : oy + cy * m;
    const nw = Math.max(5, Math.min(pohled2d.zakl.w * 20, pohled2d.w * k)), kk = nw / pohled2d.w;
    pohled2d.x = px - (px - pohled2d.x) * kk; pohled2d.y = py - (py - pohled2d.y) * kk; pohled2d.w = nw; pohled2d.h *= kk;
    uzivZoom = true; nastavVB();
  }
  {
    const h = $('plocha2d'); let tah = null; const ukaz = new Map(); let pinch = 0;
    h.addEventListener('wheel', (e) => { e.preventDefault(); const r = h.getBoundingClientRect(); zoom(Math.exp(e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
    h.addEventListener('pointerdown', (e) => { h.setPointerCapture(e.pointerId); ukaz.set(e.pointerId, [e.clientX, e.clientY]); tah = [e.clientX, e.clientY]; h.classList.add('tahne'); });
    h.addEventListener('pointermove', (e) => {
      if (!ukaz.has(e.pointerId) || !pohled2d) return;
      ukaz.set(e.pointerId, [e.clientX, e.clientY]);
      if (ukaz.size === 2) {
        const [a, b] = [...ukaz.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), r = h.getBoundingClientRect();
        if (pinch) zoom(pinch / d, (a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top);
        pinch = d; return;
      }
      const m = meritko(); pohled2d.x -= (e.clientX - tah[0]) * m; pohled2d.y -= (e.clientY - tah[1]) * m; tah = [e.clientX, e.clientY];
      uzivZoom = true; nastavVB();
    });
    const konec = (e) => { ukaz.delete(e.pointerId); if (ukaz.size < 2) pinch = 0; if (!ukaz.size) h.classList.remove('tahne'); };
    h.addEventListener('pointerup', konec); h.addEventListener('pointercancel', konec);
  }
  const fit2d = () => { if (pohled2d) { pohled2d = Object.assign({ zakl: pohled2d.zakl }, pohled2d.zakl); uzivZoom = false; nastavVB(); } };
  $('z2dFit').onclick = fit2d; $('z2dPlus').onclick = () => zoom(1 / 1.3); $('z2dMinus').onclick = () => zoom(1.3);

  /* ---------- 3D ---------- */
  nahled3d = window.KrabiceNahled3D ? window.KrabiceNahled3D.vytvor($('plocha3d')) : null;
  const sl = $('slozeni');
  sl.addEventListener('input', () => { $('slozeniHod').textContent = Math.round(sl.value / 10) + ' %'; if (nahled3d && !vysl.bez3d) nahled3d.slozeni(sl.value / 1000); });
  let anim = 0;
  $('prehrat').onclick = () => {
    if (anim) { cancelAnimationFrame(anim); anim = 0; $('prehrat').textContent = '▶ Složit'; return; }
    const zpet = +sl.value >= 999, start = performance.now(), od = zpet ? 0 : +sl.value / 1000, dur = 3500 * (1 - od);
    $('prehrat').textContent = '⏸ Stop';
    const krok = (ts) => {
      const x = Math.min(1, od + (ts - start) / Math.max(dur, 1) * (1 - od));
      sl.value = Math.round(x * 1000); sl.dispatchEvent(new Event('input'));
      if (x < 1) anim = requestAnimationFrame(krok); else { anim = 0; $('prehrat').textContent = '▶ Složit'; }
    };
    if (zpet) { sl.value = 0; sl.dispatchEvent(new Event('input')); }
    anim = requestAnimationFrame(krok);
  };
  $('pohled3d').onclick = () => nahled3d && nahled3d.pohled();

  /* ---------- formulář ---------- */
  selTyp.addEventListener('change', () => {
    const pred = K.typPodle(S.typ).skup, nov = K.typPodle(selTyp.value).skup;
    zFormulare();
    if (pred !== nov) { Object.assign(S, nov === 'karton' ? VYCHOZI_KARTON : VYCHOZI_VLNA); doFormulare(); }
    prepocti(true);
  });
  selMat.addEventListener('change', () => {
    const m = K.MATERIALY.find(x => x.id === selMat.value);
    if (m) { $('t').value = m.t; $('g').value = m.g; if (!S.chlopen) $('chlopen').value = 0; }
    zFormulare(); prepocti();
  });
  for (const k of ['t', 'g']) $(k).addEventListener('input', () => {
    const m = K.MATERIALY.find(x => x.id === selMat.value);
    if (m && (Math.abs(m.t - parseFloat($('t').value)) > 1e-9 || Math.abs(m.g - parseFloat($('g').value)) > 1e-9)) selMat.value = 'vlastni';
  });
  for (const el of document.querySelectorAll('input, select')) {
    if (el === selTyp || el === selMat || el === sl) continue;
    el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', () => { zFormulare(); prepocti(); });
  }

  /* ---------- předvolby ---------- */
  function nactiPV() { try { const l = JSON.parse(localStorage.getItem(KLIC_PV) || '[]'); return Array.isArray(l) ? l : []; } catch (e) { return []; } }
  function ulozPV(l) { try { localStorage.setItem(KLIC_PV, JSON.stringify(l)); } catch (e) { Dialog.chyba('Předvolbu se nepodařilo uložit.'); } }
  const PARAM = ['typ', 'D', 'S', 'V', 'material', 't', 'g', 'spoj', 'chlopen', 'presah', 'vule', 'hloubkaVika', 'plnyTeleskop', 'perforace', 'vyskaPerf'];
  function kresliPV() {
    const l = nactiPV(), ul = $('predvolby'); ul.innerHTML = '';
    if (!l.length) { ul.innerHTML = '<li class="prazdne" style="border:none">Zatím žádné – nastavte krabici a uložte ji.</li>'; return; }
    l.forEach((pv, i) => {
      const li = document.createElement('li');
      const n = document.createElement('span'); n.className = 'pv-nazev'; n.tabIndex = 0; n.setAttribute('role', 'button');
      n.innerHTML = '';
      const b = document.createElement('b'); b.textContent = pv.nazev; n.appendChild(b);
      const sm = document.createElement('small'); sm.textContent = `  ${pv.P.typ} · ${f(pv.P.D)}×${f(pv.P.S)}×${f(pv.P.V)} · t ${f(pv.P.t)}`; n.appendChild(sm);
      const nacti = () => { Object.assign(S, pv.P); doFormulare(); prepocti(true); Dialog.info('Načteno: ' + pv.nazev); };
      n.onclick = nacti; n.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); nacti(); } };
      const x = document.createElement('button'); x.textContent = '✕'; x.title = 'Smazat předvolbu'; x.setAttribute('aria-label', 'Smazat ' + pv.nazev);
      x.onclick = async () => { if (await Dialog.potvrd('Smazat předvolbu „' + pv.nazev + '“?')) { const l2 = nactiPV(); l2.splice(i, 1); ulozPV(l2); kresliPV(); } };
      li.appendChild(n); li.appendChild(x); ul.appendChild(li);
    });
  }
  $('ulozPredvolbu').onclick = async () => {
    const nazev = await Dialog.zeptej('Název předvolby', `${S.typ} ${f(S.D)}×${f(S.S)}×${f(S.V)}`);
    if (!nazev) return;
    const P = {}; for (const k of PARAM) P[k] = S[k];
    const l = nactiPV().filter(x => x.nazev !== nazev); l.unshift({ nazev: nazev.slice(0, 60), P }); ulozPV(l.slice(0, 50)); kresliPV();
    Dialog.info('Předvolba uložena');
  };
  $('vychozi').onclick = async () => {
    if (!(await Dialog.potvrd('Vrátit všechna nastavení na výchozí hodnoty?'))) return;
    S = Object.assign({}, K.VYCHOZI, VYCHOZI_UI); doFormulare(); prepocti(true);
  };

  /* ---------- export ---------- */
  function nazevSouboru(pr) { return `krabice_${S.typ}_${Math.round(S.D)}x${Math.round(S.S)}x${Math.round(S.V)}.${pr}`; }
  function stahni(obsah, nazev, typ) {
    const blob = obsah instanceof Blob ? obsah : new Blob([obsah], { type: typ });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nazev;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  const vrstvyExportu = () => S.jenVyroba ? ['CUT', 'CREASE', 'PERF'] : null;
  $('btnSvg').onclick = () => stahni(VY.svg(vysl, { vrstvy: vrstvyExportu() }), nazevSouboru('svg'), 'image/svg+xml');
  $('btnDxf').onclick = () => stahni(VY.dxf(vysl, { vrstvy: vrstvyExportu() }), nazevSouboru('dxf'), 'application/dxf');
  let pismoSlib = null;
  function nactiPismo() {
    if (window.FONTY_JS && window.FONTY_JS['LiberationSans-Regular.ttf']) return Promise.resolve(window.FONTY_JS['LiberationSans-Regular.ttf']);
    if (pismoSlib) return pismoSlib;
    pismoSlib = new Promise((ok) => {
      const s = document.createElement('script'); s.src = 'stitky_panely/fonty/LiberationSans-Regular.ttf.js';
      s.onload = () => ok((window.FONTY_JS || {})['LiberationSans-Regular.ttf'] || null);
      s.onerror = () => { pismoSlib = null; ok(null); };
      document.head.appendChild(s);
    });
    return pismoSlib;
  }
  $('btnPdf').onclick = async () => {
    const b = $('btnPdf'), puv = b.textContent; b.disabled = true; b.textContent = 'Připravuji PDF…';
    try {
      if (!window.jspdf) throw new Error('knihovna jsPDF se nenačetla');
      const pismo = await nactiPismo();
      if (!pismo) Dialog.info('Písmo se nenačetlo – PDF bude bez diakritiky.');
      const doc = VY.pdf(window.jspdf.jsPDF, vysl, { format: S.format, orientace: S.orientace, prekryv: S.prekryv, sirkaListu: S.sirkaListu, vyskaListu: S.vyskaListu, pismo });
      stahni(doc.output('blob'), nazevSouboru('pdf'));
    } catch (e) { Dialog.chyba('Chyba PDF: ' + e.message); }
    finally { b.disabled = false; b.textContent = puv; }
  };

  /* ---------- klávesy (mimo vstupní pole) ---------- */
  document.addEventListener('keydown', (e) => {
    if (e.target.closest && e.target.closest('input, select, textarea')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'Digit0' || e.code === 'Numpad0') { fit2d(); e.preventDefault(); }
    else if (e.code === 'Equal' || e.code === 'NumpadAdd') { zoom(1 / 1.3); e.preventDefault(); }
    else if (e.code === 'Minus' || e.code === 'NumpadSubtract') { zoom(1.3); e.preventDefault(); }
  });

  doFormulare(); kresliPV(); prepocti(true);
  window.KrabiceUI = { stav: () => S, vysledek: () => vysl, prepocti: () => prepocti(true), nastav: (o) => { Object.assign(S, o); doFormulare(); prepocti(true); } };
})();

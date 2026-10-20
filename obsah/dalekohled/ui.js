/* dalekohled/ui.js – ovládání simulátoru „Hvězdářský dalekohled“ */
(function () {
  'use strict';
  const D = window.DALEK, DATA = window.DALEK_DATA, OK = window.DALEK_OKULAR, OB = window.DALEK_OBLOHA, A = window.ASTRO;
  const $ = id => document.getElementById(id);
  const RAD = Math.PI / 180;
  const KLIC = 'webapp_dalekohled';

  const DALEKOHLEDY = [
    { id: 'galileo', nazev: 'Galileův dalekohled 1609 (replika, 20×)', D: 26, F: 980, typ: 'galileo', vada: 'cocka', obstrukce: 0, pevneZvetseni: 20, pevnePole: 0.25, montaz: 'az', diag: 0 },
    { id: 'r70', nazev: 'Refraktor 70/700 (začátečnický)', D: 70, F: 700, typ: 'refraktor', vada: 'achromat', obstrukce: 0, montaz: 'az', diag: 1 },
    { id: 'r102', nazev: 'Refraktor 102/1000 achromát', D: 102, F: 1000, typ: 'refraktor', vada: 'achromat', obstrukce: 0, montaz: 'eq', diag: 1 },
    { id: 'apo80', nazev: 'Apochromát 80/480', D: 80, F: 480, typ: 'refraktor', vada: 'apo', obstrukce: 0, montaz: 'eq', diag: 1 },
    { id: 'n114', nazev: 'Newton 114/900', D: 114, F: 900, typ: 'newton', vada: 'zadna', obstrukce: 0.25, montaz: 'eq', diag: 0 },
    { id: 'd150', nazev: 'Dobson 150/1200', D: 150, F: 1200, typ: 'newton', vada: 'zadna', obstrukce: 0.22, montaz: 'az', diag: 0 },
    { id: 'd200', nazev: 'Dobson 200/1200', D: 200, F: 1200, typ: 'newton', vada: 'zadna', obstrukce: 0.22, montaz: 'az', diag: 0 },
    { id: 'd300', nazev: 'Dobson 300/1500', D: 300, F: 1500, typ: 'newton', vada: 'zadna', obstrukce: 0.2, montaz: 'az', diag: 0 },
    { id: 'sct8', nazev: 'Schmidt-Cassegrain 203/2032 (GoTo)', D: 203, F: 2032, typ: 'sct', vada: 'zadna', obstrukce: 0.34, montaz: 'az', diag: 1, sledovani: true },
    { id: 'mak127', nazev: 'Maksutov 127/1500', D: 127, F: 1500, typ: 'mak', vada: 'zadna', obstrukce: 0.3, montaz: 'eq', diag: 1, sledovani: true },
    { id: 'triedr', nazev: 'Triedr 10×50', D: 50, F: 200, typ: 'triedr', vada: 'achromat', obstrukce: 0, pevneZvetseni: 10, pevnePole: 6.5, montaz: 'az', diag: 0 },
    { id: 'vlastni', nazev: 'Vlastní…', D: 200, F: 1000, typ: 'newton', vada: 'zadna', obstrukce: 0.22, montaz: 'az', diag: 0 },
  ];
  const OKULARY = [
    { f: 40, afov: 43, n: 'Plössl' }, { f: 32, afov: 52, n: 'Plössl' }, { f: 25, afov: 52, n: 'Plössl' }, { f: 20, afov: 68, n: 'širokoúhlý' },
    { f: 15, afov: 52, n: 'Plössl' }, { f: 12, afov: 52, n: 'Plössl' }, { f: 10, afov: 52, n: 'Plössl' }, { f: 8, afov: 68, n: 'širokoúhlý' },
    { f: 6, afov: 60, n: 'planetární' }, { f: 5, afov: 60, n: 'planetární' }, { f: 4, afov: 58, n: 'planetární' }, { f: 3, afov: 58, n: 'planetární' },
  ];
  const MISTA = [
    ['Praha', 50.087, 14.421, 250], ['Brno', 49.195, 16.608, 230], ['Ostrava', 49.835, 18.292, 220], ['Plzeň', 49.738, 13.373, 310],
    ['České Budějovice', 48.975, 14.474, 390], ['Hradec Králové', 50.209, 15.833, 235], ['Liberec', 50.767, 15.056, 380],
    ['Olomouc', 49.594, 17.251, 220], ['Ondřejov (observatoř)', 49.910, 14.781, 530], ['Jizerka (tmavá obloha)', 50.820, 15.333, 860],
    ['Bratislava', 48.148, 17.107, 140], ['Vlastní', null, null, 300],
  ];

  /* ---------- stav ---------- */
  const S = {
    dal: 'd200', vlastni: { D: 200, F: 1000, typ: 'newton', vada: 'zadna', obstrukce: 0.22 },
    montaz: 'az', diag: 0, sledovani: false, okular: 2, barlow: 1, fokus: 0, fokusCil: 0,
    misto: 0, lat: 50.087, lon: 14.421, vyska: 250,
    seeing: 2.5, bortle: 4, lupa: 1, zornice: 7, popisky: true, rychlost: 1, mapaPole: 70, pohyb: 64,
    zalozka: 'planety', jenNad: true,
  };
  try { Object.assign(S, JSON.parse(localStorage.getItem(KLIC) || '{}')); } catch (e) { /* bez uložení */ }
  const uloz = () => { try { const { fokusCil, ...u } = S; localStorage.setItem(KLIC, JSON.stringify(u)); } catch (e) { /* nevadí */ } };

  // čas simulace
  let jd0 = D ? A.jdZData(new Date()) : 0, t0 = performance.now();
  const jdTed = () => jd0 + (performance.now() - t0) / 86400000 * S.rychlost;
  const nastavJd = jd => { jd0 = jd; t0 = performance.now(); };

  // směr dalekohledu: c (J2000) při sledování, jinak {alt, az}
  let smer = { alt: 35, az: 180 }, cJ2000 = null;

  const misto = () => ({ lat: S.lat, lon: S.lon, vyska: S.vyska });
  const dalekohled = () => {
    const p = DALEKOHLEDY.find(d => d.id === S.dal) || DALEKOHLEDY[6];
    return p.id === 'vlastni' ? { ...p, ...S.vlastni } : p;
  };
  const okular = () => OKULARY[Math.max(0, Math.min(OKULARY.length - 1, S.okular))];

  /* ---------- ovládací prvky ---------- */
  const selDal = $('selDalekohled');
  DALEKOHLEDY.forEach(d => selDal.add(new Option(d.nazev, d.id)));
  const selOk = $('selOkular');
  const naplnOkulary = () => {
    selOk.innerHTML = '';
    const dal = dalekohled();
    OKULARY.forEach((o, i) => {
      const M = dal.F * S.barlow / o.f;
      selOk.add(new Option(`${o.f} mm ${o.n} ${o.afov}° – ${Math.round(M)}×`, i));
    });
    selOk.value = S.okular;
    selOk.disabled = !!dal.pevneZvetseni;
    $('selBarlow').disabled = !!dal.pevneZvetseni;
  };
  const selMisto = $('selMisto');
  MISTA.forEach((m, i) => selMisto.add(new Option(m[0], i)));

  function nahodnyFokus() {
    // každý okulár má ohnisko jinde (nejsou parfokální); triedr a Galileo jsou zaostřené
    const dal = dalekohled();
    S.fokusCil = dal.pevneZvetseni ? 0 : Math.round((Math.random() * 2.4 - 1.2) * 100) / 100;
  }
  function doFormulare() {
    selDal.value = S.dal;
    const v = S.dal === 'vlastni';
    $('vlastni').hidden = !v;
    $('inD').value = S.vlastni.D; $('inF').value = S.vlastni.F; $('selTyp').value = S.vlastni.typ;
    $('selVada').value = S.vlastni.vada; $('inObstr').value = S.vlastni.obstrukce;
    $('vObstr').textContent = Math.round(S.vlastni.obstrukce * 100) + ' %';
    $('selMontaz').value = S.montaz; $('selDiag').value = String(S.diag);
    $('chkSledovani').checked = S.sledovani;
    naplnOkulary();
    $('selBarlow').value = String(S.barlow);
    $('inFokus').value = S.fokus;
    selMisto.value = S.misto;
    $('inLat').value = S.lat; $('inLon').value = S.lon;
    $('inSeeing').value = S.seeing; $('vSeeing').textContent = S.seeing.toFixed(1) + '″';
    $('selBortle').value = S.bortle; $('selZornice').value = S.zornice;
    $('chkPopisky').checked = S.popisky;
    $('selRychlost').value = String(S.rychlost);
    $('inMapaPole').value = S.mapaPole; $('vMapaPole').textContent = S.mapaPole + '°';
    $('selPohyb').value = String(S.pohyb);
    $('selLupa').value = String(S.lupa);
  }
  function zmenaDalekohledu() {
    const d = DALEKOHLEDY.find(x => x.id === S.dal);
    if (d && d.id !== 'vlastni') { S.montaz = d.montaz; S.diag = d.diag; prepniSledovani(!!d.sledovani); }
    if (d && d.pevneZvetseni) S.barlow = 1;
    nahodnyFokus(); S.fokus = 0;
    doFormulare(); uloz();
  }
  selDal.addEventListener('change', () => { S.dal = selDal.value; zmenaDalekohledu(); });
  for (const [id, k, f] of [['inD', 'D', Number], ['inF', 'F', Number], ['selTyp', 'typ', String], ['selVada', 'vada', String], ['inObstr', 'obstrukce', Number]]) {
    $(id).addEventListener('input', () => {
      const v = f($(id).value);
      if (f === Number && !(v >= 0)) return;
      S.vlastni[k] = v;
      if (k === 'typ') { S.vlastni.vada = v === 'refraktor' ? 'achromat' : 'zadna'; S.vlastni.obstrukce = v === 'refraktor' ? 0 : v === 'newton' ? 0.22 : 0.33; S.diag = v === 'newton' ? 0 : 1; }
      doFormulare(); uloz();
    });
  }
  $('selMontaz').addEventListener('change', e => { S.montaz = e.target.value; uloz(); });
  $('selDiag').addEventListener('change', e => { S.diag = +e.target.value; uloz(); });
  $('chkSledovani').addEventListener('change', e => { prepniSledovani(e.target.checked); uloz(); });
  selOk.addEventListener('change', () => { S.okular = +selOk.value; nahodnyFokus(); uloz(); });
  $('selBarlow').addEventListener('change', e => { S.barlow = +e.target.value; naplnOkulary(); nahodnyFokus(); uloz(); });
  $('inFokus').addEventListener('input', e => { S.fokus = +e.target.value; });
  $('btnZaostrit').addEventListener('click', () => { S.fokus = S.fokusCil; $('inFokus').value = S.fokus; });
  selMisto.addEventListener('change', () => {
    S.misto = +selMisto.value; const m = MISTA[S.misto];
    if (m[1] !== null) { S.lat = m[1]; S.lon = m[2]; S.vyska = m[3]; }
    doFormulare(); uloz(); prepocetCilu(true);
  });
  for (const id of ['inLat', 'inLon']) $(id).addEventListener('change', () => {
    const la = +$('inLat').value, lo = +$('inLon').value;
    if (la >= -90 && la <= 90 && lo >= -180 && lo <= 180) { S.lat = la; S.lon = lo; S.misto = MISTA.length - 1; selMisto.value = S.misto; uloz(); prepocetCilu(true); }
  });
  $('btnGeo').addEventListener('click', () => {
    if (!navigator.geolocation) return zprava('Prohlížeč neumí zjistit polohu.');
    navigator.geolocation.getCurrentPosition(p => {
      S.lat = Math.round(p.coords.latitude * 1000) / 1000; S.lon = Math.round(p.coords.longitude * 1000) / 1000;
      S.misto = MISTA.length - 1; doFormulare(); uloz(); prepocetCilu(true);
    }, () => zprava('Poloha není k dispozici (zamítnuto nebo nedostupné).'));
  });
  // čas
  const lokalniText = d => {
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  };
  $('inCas').addEventListener('change', e => {
    const d = new Date(e.target.value);
    if (!isNaN(d)) { nastavJd(A.jdZData(d)); prepocetCilu(true); }
  });
  $('selRychlost').addEventListener('change', e => { nastavJd(jdTed()); S.rychlost = +e.target.value; uloz(); });
  $('btnTed').addEventListener('click', () => { nastavJd(A.jdZData(new Date())); S.rychlost = 1; $('selRychlost').value = '1'; prepocetCilu(true); });
  $('btnNoc').addEventListener('click', () => { const d = new Date(); d.setHours(22, 0, 0, 0); nastavJd(A.jdZData(d)); prepocetCilu(true); });
  $('btnHodPlus').addEventListener('click', () => { nastavJd(jdTed() + 1 / 24); prepocetCilu(true); });
  $('btnDenPlus').addEventListener('click', () => { nastavJd(jdTed() + 1); prepocetCilu(true); });
  // podmínky
  $('inSeeing').addEventListener('input', e => { S.seeing = +e.target.value; $('vSeeing').textContent = S.seeing.toFixed(1) + '″'; uloz(); });
  $('selBortle').addEventListener('change', e => { S.bortle = +e.target.value; uloz(); });
  $('selZornice').addEventListener('change', e => { S.zornice = +e.target.value; uloz(); });
  $('chkPopisky').addEventListener('change', e => { S.popisky = e.target.checked; uloz(); });
  $('inMapaPole').addEventListener('input', e => { S.mapaPole = +e.target.value; $('vMapaPole').textContent = S.mapaPole + '°'; uloz(); });
  $('selPohyb').addEventListener('change', e => { S.pohyb = +e.target.value; uloz(); });
  $('selLupa').addEventListener('change', e => { S.lupa = +e.target.value; uloz(); });
  $('chkJenNad').addEventListener('change', e => { S.jenNad = e.target.checked; prepocetCilu(true); });
  for (const b of document.querySelectorAll('#zalozkyCilu button')) b.addEventListener('click', () => {
    S.zalozka = b.dataset.k; uloz();
    for (const x of document.querySelectorAll('#zalozkyCilu button')) x.setAttribute('aria-selected', String(x === b));
    prepocetCilu(true);
  });

  let zpravaDo = 0;
  function zprava(t, nebezpeci) {
    const z = $('zprava'); z.textContent = t; z.className = nebezpeci ? 'nebezpeci' : '';
    zpravaDo = performance.now() + (nebezpeci ? 1500 : 6000);
  }

  /* ---------- směr dalekohledu ---------- */
  function aktualniC(jd, prec) {
    if (S.sledovani && cJ2000) return cJ2000;
    return D.zObzoru(smer.alt, smer.az, jd, misto(), prec);
  }
  function nastavC(c, jd, prec) {
    if (S.sledovani) cJ2000 = D.unit(c);
    const o = D.naObzor(D.unit(c), jd, misto(), prec);
    smer = { alt: o.alt, az: o.az };
    if (S.sledovani) cJ2000 = D.unit(c);
  }
  function prepniSledovani(zap) {
    const jd = jdTed();
    const c = aktualniC(jd);
    S.sledovani = zap;
    if (zap) cJ2000 = c; else { const o = D.naObzor(c, jd, misto()); smer = { alt: o.alt, az: o.az }; }
    $('chkSledovani').checked = zap;
  }
  function namir(v) {
    const jd = jdTed();
    if (S.sledovani) cJ2000 = D.unit(v);
    const o = D.naObzor(D.unit(v), jd, misto());
    smer = { alt: o.alt, az: o.az };
  }
  // posun o (dx, dy) obrazovkových px zorného pole → změna směru
  let posledni = null;      // poslední stav kreslení (k, A, c)
  function posunObrazem(dxPx, dyPx) {
    if (!posledni) return;
    const { k, A: M, c } = posledni;
    // obrazovka = k·M·[x_w, y_n] ⇒ [x_w, y_n] = M⁻¹·obrazovka / k
    const det = M[0] * M[3] - M[1] * M[2];
    const xw = (M[3] * dxPx - M[1] * dyPx) / det / k, yn = (-M[2] * dxPx + M[0] * dyPx) / det / k;
    const b = D.baze(c);
    const nc = D.unit(D.add(c, D.add(D.mul(b.x, xw / 206265), D.mul(b.y, yn / 206265))));
    nastavC(nc, posledni.jd, posledni.prec);
  }

  /* ---------- okulár: tažení a klávesy ---------- */
  const cv = $('okular'), mapa = $('mapa');
  let tah = null;
  cv.addEventListener('pointerdown', e => {
    tah = { x: e.clientX, y: e.clientY };
    try { cv.setPointerCapture(e.pointerId); } catch (er) { /* syntetická událost */ }
    cv.classList.add('tahne'); cv.focus();
  });
  cv.addEventListener('pointermove', e => {
    if (!tah) return;
    const dpr = cv.width / cv.clientWidth;
    // „chytit oblohu“: obraz jde s prstem ⇒ dalekohled opačně
    posunObrazem(-(e.clientX - tah.x) * dpr, -(e.clientY - tah.y) * dpr);
    tah = { x: e.clientX, y: e.clientY };
  });
  const konecTahu = () => { tah = null; cv.classList.remove('tahne'); };
  cv.addEventListener('pointerup', konecTahu); cv.addEventListener('pointercancel', konecTahu);
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    const dal = dalekohled(); if (dal.pevneZvetseni) return;
    S.okular = Math.max(0, Math.min(OKULARY.length - 1, S.okular + (e.deltaY > 0 ? -1 : 1)));
    selOk.value = S.okular; nahodnyFokus(); uloz();
  }, { passive: false });
  const drzene = new Set();
  let shift = false;
  document.addEventListener('keydown', e => {
    if (e.target.matches('input, select, textarea')) return;
    shift = e.shiftKey;
    const smerKlav = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (smerKlav) { drzene.add(e.key); e.preventDefault(); return; }
    if (e.key === '+' || e.code === 'NumpadAdd' || e.key === '=') { if (S.okular < OKULARY.length - 1) { S.okular++; selOk.value = S.okular; nahodnyFokus(); } e.preventDefault(); }
    else if (e.key === '-' || e.code === 'NumpadSubtract') { if (S.okular > 0) { S.okular--; selOk.value = S.okular; nahodnyFokus(); } e.preventDefault(); }
    else if (e.code === 'Comma') { S.fokus = Math.max(-2.5, S.fokus - 0.03); $('inFokus').value = S.fokus; }
    else if (e.code === 'Period') { S.fokus = Math.min(2.5, S.fokus + 0.03); $('inFokus').value = S.fokus; }
    else if (e.key.toLowerCase() === 'l') { S.popisky = !S.popisky; $('chkPopisky').checked = S.popisky; }
    else if (e.key.toLowerCase() === 'z') { const L = [1, 1.5, 2, 3, 4, 6]; S.lupa = L[(L.indexOf(S.lupa) + 1) % L.length]; $('selLupa').value = String(S.lupa); uloz(); }
    else if (e.code === 'Space') { e.preventDefault(); nastavJd(jdTed()); S.rychlost = S.rychlost ? 0 : 1; $('selRychlost').value = String(S.rychlost); }
  });
  document.addEventListener('keyup', e => { drzene.delete(e.key); shift = e.shiftKey; });
  window.addEventListener('blur', () => drzene.clear());
  // tlačítka ručního ovladače (držení)
  for (const b of document.querySelectorAll('.ovladac button[data-smer]')) {
    const k = 'btn' + b.dataset.smer;
    const start = e => { e.preventDefault(); drzene.add(k); };
    const stop = () => drzene.delete(k);
    b.addEventListener('pointerdown', start); b.addEventListener('pointerup', stop); b.addEventListener('pointerleave', stop); b.addEventListener('pointercancel', stop);
  }
  $('btnStred').addEventListener('click', () => {
    if (posledni && posledni.nejblizsi) namir(posledni.nejblizsi.v);
  });
  function pohybOvladacem(dt) {
    let dx = 0, dy = 0;
    for (const k of drzene) {
      const s = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[k] || (k.startsWith('btn') ? k.slice(3).split(',').map(Number) : null);
      if (s) { dx += s[0]; dy += s[1]; }
    }
    if (!dx && !dy || !posledni) return;
    // rychlost v ″/s (násobek hvězdné rychlosti 15″/s) → px
    const rychl = S.pohyb * 15.04 * (shift ? 8 : 1);
    const px = rychl * dt * posledni.k;
    // šipka nahoru posune pohled nahoru = obraz jde dolů
    posunObrazem(dx * px, dy * px);
  }

  /* ---------- mapa oblohy ---------- */
  const mapaOb = OB.vytvor(mapa);
  mapa.addEventListener('click', e => {
    const r = mapa.getBoundingClientRect(), dpr = mapa.width / r.width;
    const X = (e.clientX - r.left) * dpr, Y = (e.clientY - r.top) * dpr;
    const p = mapaOb.nejblizsi(X, Y, 12 * dpr);
    if (p) { namir(p.v); zprava('Namířeno: ' + p.jmeno); return; }
    const h = mapaOb.zpet(X, Y);
    const jd = jdTed();
    namir(D.zObzoru(h.alt, h.az, jd, misto()));
  });
  mapa.addEventListener('mousemove', e => {
    const r = mapa.getBoundingClientRect(), dpr = mapa.width / r.width;
    const p = mapaOb.nejblizsi((e.clientX - r.left) * dpr, (e.clientY - r.top) * dpr, 12 * dpr);
    mapa.title = p ? p.jmeno : '';
  });
  mapa.addEventListener('wheel', e => {
    e.preventDefault();
    S.mapaPole = Math.max(10, Math.min(180, Math.round(S.mapaPole * (e.deltaY > 0 ? 1.15 : 1 / 1.15))));
    $('inMapaPole').value = S.mapaPole; $('vMapaPole').textContent = S.mapaPole + '°';
  }, { passive: false });

  /* ---------- seznam cílů ---------- */
  const fmtCas = jd => jd === null ? '–' : A.dataZJd(jd).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
  const fmtMag = m => (m < 0 ? '−' : '') + Math.abs(m).toFixed(1);
  const fmtUhel = s => s >= 3600 ? (s / 3600).toFixed(2).replace('.', ',') + '°' : s >= 60 ? (s / 60).toFixed(1).replace('.', ',') + '′' : s.toFixed(1).replace('.', ',') + '″';
  const TYPY = { gc: 'kulová hvězdokupa', oc: 'otevřená hvězdokupa', s: 'spirální galaxie', e: 'eliptická galaxie', i: 'nepravidelná galaxie', sd: 'galaxie', pn: 'planetární mlhovina', sfr: 'emisní mlhovina', rn: 'reflexní mlhovina', snr: 'pozůstatek supernovy', pos: 'skupina hvězd', en: 'emisní mlhovina' };
  let cileCas = 0, cileSeznam = [];
  function prepocetCilu(hned) {
    const nyni = performance.now();
    if (!hned && nyni - cileCas < 4000) return;
    cileCas = nyni;
    const jd = jdTed(), m = misto(), prec = D.precese(A.utNaJde(jd));
    const radky = [];
    if (S.zalozka === 'planety') {
      for (const k of D.KLICE_TELES) {
        const t = D.teleso(k, jd, m, prec);
        radky.push({ jmeno: t.jmeno, popis: `${fmtMag(t.mag)} mag · ${fmtUhel(2 * t.rUhel)}`, alt: t.obzor.alt, v: t.v });
      }
    } else if (S.zalozka === 'dvojhvezdy') {
      for (const [idx, jm, sl] of DATA.DVOJHVEZDY) {
        const v = D.v3(DATA.H[idx * 4], DATA.H[idx * 4 + 1]);
        radky.push({ jmeno: jm, popis: `${fmtMag(DATA.H[idx * 4 + 2])}/${fmtMag(sl[0][0])} mag · ${sl.map(x => x[2].toFixed(1).replace('.', ',') + '″').join(', ')}`, alt: D.naObzor(v, jd, m, prec).alt, v });
      }
    } else if (S.zalozka === 'dso') {
      for (const o of DATA.MESSIER) {
        const v = D.v3(o[1], o[2]);
        radky.push({ jmeno: o[0] + (o[8] ? ' ' + o[8] : ''), popis: `${TYPY[o[3]] || o[3]} · ${fmtMag(+o[4])} mag`, alt: D.naObzor(v, jd, m, prec).alt, v });
      }
    } else {
      for (const [i, jm] of Object.entries(DATA.JMENA)) {
        const v = D.v3(DATA.H[i * 4], DATA.H[i * 4 + 1]);
        radky.push({ jmeno: jm, popis: `${fmtMag(DATA.H[i * 4 + 2])} mag · ${DATA.BAYER[i] || ''}`, alt: D.naObzor(v, jd, m, prec).alt, v, mag: DATA.H[i * 4 + 2] });
      }
      radky.sort((a, b) => a.mag - b.mag);
    }
    cileSeznam = radky.filter(r => !S.jenNad || r.alt > 0);
    const tab = $('tabCile');
    tab.innerHTML = '';
    for (const r of cileSeznam) {
      const tr = tab.insertRow();
      if (r.alt <= 0) tr.className = 'pod';
      tr.insertCell().innerHTML = `<b>${r.jmeno}</b><br><span style="color:var(--text-faint)">${r.popis}</span>`;
      const c = tr.insertCell(); c.className = 'r'; c.textContent = r.alt > 0 ? Math.round(r.alt) + '°' : 'pod obzorem';
      tr.title = 'Namířit dalekohled';
      tr.addEventListener('click', () => { namir(r.v); zprava('Namířeno: ' + r.jmeno + (r.alt < 0 ? ' – je ale pod obzorem.' : '')); });
    }
    if (!cileSeznam.length) tab.insertRow().insertCell().textContent = 'Nic z tohoto seznamu teď není nad obzorem.';
    $('cileNadpis').textContent = `${cileSeznam.length} nad obzorem`.replace(/^(\d+) nad obzorem$/, S.jenNad ? '$1 nad obzorem' : '$1 položek');
  }

  /* ---------- hlavní smyčka ---------- */
  let mapaPosl = { t: 0 };
  let posledniT = performance.now(), infoCas = 0, vychodCache = { klic: '', jd: 0, data: null };
  function velikostPlatna(c, maxCss) {
    const r = c.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.min(1200, Math.round(Math.min(r.width, maxCss || 9999) * dpr));
    if (w > 0 && (c.width !== w || c.height !== w)) { c.width = w; c.height = w; }
    return w / Math.max(1, r.width);
  }
  function orientace(c, jd, prec, dal) {
    const b = D.baze(c);
    const zen = D.zObzoru(90, 0, jd, misto(), prec);
    let zx = D.dot(zen, b.x), zy = D.dot(zen, b.y);
    const zl = Math.hypot(zx, zy);
    if (zl < 1e-6) { zx = 0; zy = 1; } else { zx /= zl; zy /= zl; }
    let th = 0;
    if (S.montaz === 'az' || dal.typ === 'triedr' || dal.typ === 'galileo') th = -Math.PI / 2 - Math.atan2(-zy, zx);
    const co = Math.cos(th), si = Math.sin(th);
    // R·B0 = [[c, s], [s, −c]]
    let M = [co, si, si, -co];
    let zrcadlo = false, otoc = false;
    if (dal.typ === 'newton') otoc = true;
    else if (dal.typ === 'refraktor' || dal.typ === 'sct' || dal.typ === 'mak') { if (S.diag) zrcadlo = true; else otoc = true; }
    if (zrcadlo) M = [-M[0], -M[1], M[2], M[3]];
    if (otoc) M = M.map(x => -x);
    const zs = [M[0] * zx + M[1] * zy, M[2] * zx + M[3] * zy];
    const zsl = Math.hypot(zs[0], zs[1]) || 1;
    return { A: M, zenit: [zs[0] / zsl, zs[1] / zsl], zrcadlo, otoc };
  }

  function snimek() {
    const nyni = performance.now();
    const dt = Math.min(0.1, (nyni - posledniT) / 1000);
    posledniT = nyni;
    pohybOvladacem(dt);
    const jd = jdTed();
    const m = misto();
    const prec = D.precese(A.utNaJde(jd));
    const dal = dalekohled(), ok = okular();
    const o = D.optika(dal, ok, S.barlow);
    const c = aktualniC(jd, prec);
    const obz = D.naObzor(c, jd, m, prec);
    if (!S.sledovani) { /* směr držíme v alt/az */ } else smer = { alt: obz.alt, az: obz.az };
    const altStred = S.sledovani ? obz.alt : smer.alt;

    // tělesa
    const telesa = ['slunce', ...D.KLICE_TELES].map(k => D.teleso(k, jd, m, prec));
    const slunce = telesa[0], mesic = telesa[1];
    for (const t of telesa) if (t.klic !== 'slunce') t.povrchJas = t.mag + 2.5 * Math.log10(Math.PI * t.rUhel * t.rUhel * t.zplosteni * Math.max(0.02, t.k));
    const hS = slunce.obzor.alt;
    const sb = D.jasOblohy({ bortle: S.bortle, hSlunce: hS, mesic: { alt: mesic.obzor.alt, k: mesic.k, uhel: D.uhel(mesic.v, c) } }, altStred);
    const sbOk = D.jasPozadi(sb, o, S.zornice);
    const lm = D.mezniVelikost(o, dal, sb, altStred, S.zornice);
    const X = D.vzdusnaHmota(altStred);
    const seeingEf = S.seeing * Math.pow(Math.min(X, 10), 0.6) * (dal.typ === 'triedr' ? 1 : 1);
    // rozostření: posun ohniska ε (mm) → úhlový průměr kroužku ε·D/F² (rad)
    const Fe = dal.F * S.barlow;
    const eps = dal.pevneZvetseni ? 0 : Math.abs(S.fokus - S.fokusCil);
    const rozost = eps * dal.D / (Fe * Fe) * 206265;
    const CAidx = (dal.F / dal.D) / (dal.D / 25.4);
    const barevnaVada = dal.vada === 'cocka' ? 1.6 : dal.vada === 'achromat' ? Math.max(0, Math.min(1, (5 - CAidx) / 4)) : 0;
    const orient = orientace(c, jd, prec, dal);
    const sluncVzd = D.uhel(slunce.v, c);

    const dprO = velikostPlatna(cv);
    const vysledek = OK.kresli({
      cv, jd, misto: m, prec, c, dal, o, lm, sbOk, hSlunce: hS, seeing: seeingEf, difrakce: 1.03 * 0.55e-3 / dal.D * 206265,
      rayleigh: 138 / dal.D, rozostreni: rozost, lupa: S.lupa, orient, telesa, popisky: S.popisky, dt, dpr: dprO, barevnaVada,
      disperze: D.disperze(altStred), altStred, extinkce: X - 1,
      jasPozadiPosun: x => x + 5 * Math.log10(Math.max(1, S.zornice / o.pupila)),
      slunce: { vPoli: hS > -1 && sluncVzd < o.pole / 2 + 0.3 }, cestaTextur: 'dalekohled/tex/',
    });
    posledni = { k: vysledek.k || 1, A: orient.A, c, jd, prec, seeing: seeingEf };
    // kompas v rohu
    if (!vysledek.oslneni) kompas(cv, orient, dprO, c, prec, jd);
    // nejbližší objekt ke středu
    let nejbl = null, nd = Infinity;
    for (const t of vysledek.telesa || []) { const d = D.uhel(t.t.v, c); if (d < nd) { nd = d; nejbl = { jmeno: t.t.jmeno, v: t.t.v, t: t.t }; } }
    for (const v of vysledek.viditelne || []) {
      if (v.typ === 'dso') { const vv = D.v3(v.o[1], v.o[2]); const d = D.uhel(vv, c); if (d < nd) { nd = d; nejbl = { jmeno: v.o[0], v: vv, o: v.o }; } }
      else if (v.typ === 'hvezda' && v.i >= 0) { const vv = D.v3(DATA.H[v.i * 4], DATA.H[v.i * 4 + 1]); const d = D.uhel(vv, c) + 0.002 * (v.m - 3); if (d < nd) { nd = d; nejbl = { jmeno: DATA.JMENA[v.i] || DATA.BAYER[v.i] || 'hvězda', v: vv, i: v.i }; } }
    }
    posledni.nejblizsi = nejbl;

    // lišty
    $('lsZvetseni').textContent = `${Math.round(o.M)}× · pole ${fmtUhel(o.pole * 3600)} · mez ${lm.toFixed(1).replace('.', ',')} mag`;
    $('lsSmer').textContent = `výška ${altStred.toFixed(1).replace('.', ',')}° · azimut ${Math.round(S.sledovani ? obz.az : smer.az)}°`;
    $('lsCas').textContent = A.dataZJd(jd).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    $('lsObjekt').textContent = nejbl && nd < o.pole ? nejbl.jmeno : '';

    // mapa
    const dprM = velikostPlatna(mapa);
    const mez = D.nelm(sb);
    const smerMapy = S.sledovani ? obz : smer;
    const zmena = !mapaPosl.smer || Math.abs(mapaPosl.smer.alt - smerMapy.alt) + Math.abs(mapaPosl.smer.az - smerMapy.az) > 0.05 || mapaPosl.fov !== S.mapaPole || mapaPosl.w !== mapa.width;
    if (zmena || nyni - mapaPosl.t > 350) {
      mapaPosl = { t: nyni, smer: { ...smerMapy }, fov: S.mapaPole, w: mapa.width };
      mapaOb.st.fov = S.mapaPole;
      mapaOb.kresli({ jd, misto: m, prec, smer: S.sledovani ? obz : smer, telesa, hSlunce: hS, poleOk: o.pole, poleHledacku: 6, lmOko: mez, dpr: dprM });
    }

    // varování
    if (hS > -1 && sluncVzd < 12) zprava(sluncVzd < o.pole / 2 + 0.3 ? '☀ Dalekohled míří na Slunce! Ve skutečnosti by to znamenalo okamžité a trvalé poškození zraku.' : '⚠ Dalekohled míří blízko Slunce – ve skutečnosti nebezpečné!', true);
    else if (altStred < 0 && performance.now() > zpravaDo) zprava('Dalekohled míří pod obzor.');
    else if (performance.now() > zpravaDo && $('zprava').textContent) { $('zprava').textContent = ''; $('zprava').className = ''; }

    // panely (méně často)
    if (nyni - infoCas > 400) {
      infoCas = nyni;
      panelOptiky(dal, o, lm, sb, sbOk, seeingEf, X, eps, rozost);
      panelObjektu(nejbl, nd, o, jd, m, prec);
      $('inCas').value === lokalniText(A.dataZJd(jd)) || document.activeElement === $('inCas') || ($('inCas').value = lokalniText(A.dataZJd(jd)));
      const tma = hS < -18 ? 'astronomická noc' : hS < -12 ? 'astronomický soumrak' : hS < -6 ? 'nautický soumrak' : hS < -0.8 ? 'občanský soumrak' : 'den';
      $('casInfo').innerHTML = `Slunce ${hS.toFixed(0)}° (${tma}) · Měsíc ${mesic.obzor.alt > 0 ? Math.round(mesic.obzor.alt) + '° nad obzorem' : 'pod obzorem'}, osvětlen z ${Math.round(mesic.k * 100)} %`;
      $('podminkyInfo').innerHTML = `Jas oblohy ve směru dalekohledu <b>${sb.toFixed(1).replace('.', ',')} mag/″²</b>, okem vidíte hvězdy do <b>${mez.toFixed(1).replace('.', ',')} mag</b>. Vzdušná hmota ${X.toFixed(1).replace('.', ',')}, seeing v tomto směru ${seeingEf.toFixed(1).replace('.', ',')}″.`;
      $('mapaInfo').textContent = `Mapa: zenit nahoře, ${S.mapaPole}° na šířku.`;
      prepocetCilu(false);
    }
    requestAnimationFrame(snimek);
  }

  function kompas(cv, orient, dpr, c, prec, jd) {
    const ctx = cv.getContext('2d');
    const M = orient.A;
    const n = [M[1], M[3]], e = [-M[0], -M[2]];        // sever = [0,1], východ = [−1,0] v (x_w, y_n)
    const x0 = cv.width - 46 * dpr, y0 = cv.height - 70 * dpr, L = 24 * dpr;
    ctx.save();
    ctx.lineWidth = 1.5 * dpr; ctx.font = `bold ${11 * dpr}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const [v, t, col] of [[n, 'S', '#ff8a7a'], [e, 'V', '#9ecbff'], [orient.zenit, 'Z', '#c8e6a0']]) {
      if (t === 'Z' && S.montaz === 'az') continue;
      ctx.strokeStyle = col; ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + v[0] * L, y0 + v[1] * L); ctx.stroke();
      ctx.fillText(t, x0 + v[0] * (L + 8 * dpr), y0 + v[1] * (L + 8 * dpr));
    }
    ctx.restore();
    void c; void prec; void jd;
  }

  function radek(a, b) { return `<div><span>${a}</span><span>${b}</span></div>`; }
  function panelOptiky(dal, o, lm, sb, sbOk, seeingEf, X, eps, rozost) {
    $('optika').innerHTML = [
      radek('Zvětšení', Math.round(o.M) + '×'),
      radek('Skutečné zorné pole', fmtUhel(o.pole * 3600)),
      radek('Výstupní pupila', o.pupila.toFixed(2).replace('.', ',') + ' mm'),
      radek('Světelnost', 'f/' + o.svetelnost.toFixed(1).replace('.', ',')),
      radek('Rozlišení (Dawes)', o.dawes.toFixed(2).replace('.', ',') + '″'),
      radek('Sběr světla proti oku', Math.round(o.sbirani) + '×'),
      radek('Mezní hvězdná velikost', lm.toFixed(1).replace('.', ',') + ' mag'),
      radek('Rozumné zvětšení', `${Math.round(o.minZvetseni)}–${Math.round(o.maxZvetseni)}×`),
    ].join('');
    const p = [];
    if (o.M > o.maxZvetseni) p.push('<span class="varovani">Prázdné zvětšení – víc než 2× průměr v mm, obraz už jen roste a tmavne.</span>');
    if (o.pupila > S.zornice + 0.05) p.push('<span class="varovani">Výstupní pupila je větší než zornice – část světla se ztrácí' + (dal.obstrukce ? ' a ve dne uvidíte stín sekundáru' : '') + '.</span>');
    if (seeingEf > o.dawes * 2 && o.M > 150) p.push(`Seeing ${seeingEf.toFixed(1).replace('.', ',')}″ je horší než rozlišení dalekohledu – větší zvětšení nepomůže.`);
    if (rozost > 1.5 * Math.max(seeingEf, o.dawes)) p.push('<span class="varovani">Obraz je rozostřený – použijte zaostřování.</span>');
    if (dal.vada === 'achromat' && o.M > 30) p.push('Achromát: kolem jasných objektů fialový lem (barevná vada).');
    if (dal.typ === 'galileo') p.push('Galileův dalekohled: jednoduchá čočka s velkou barevnou vadou a zorné pole jen čtvrt stupně.');
    $('optikaPozn').innerHTML = p.join('<br>');
    $('vFokus').textContent = eps < 0.02 ? 'zaostřeno' : (S.fokus - S.fokusCil > 0 ? 'za ohniskem ' : 'před ohniskem ') + eps.toFixed(2).replace('.', ',') + ' mm';
    void sb; void sbOk; void X;
  }

  function vychodZapad(klic, fce, jd) {
    if (vychodCache.klic === klic && Math.abs(vychodCache.jd - jd) < 0.02) return vychodCache.data;
    const data = D.prechody(fce, jd, klic === 'Slunce' || klic === 'Měsíc' ? -0.833 : -0.5667);
    vychodCache = { klic, jd, data };
    return data;
  }
  function panelObjektu(n, nd, o, jd, m, prec) {
    const el = $('infoObjekt');
    if (!n || nd > Math.max(o.pole, 0.5)) { el.innerHTML = '<div><span>Ve středu zorného pole není žádný pojmenovaný objekt.</span><span></span></div>'; return; }
    const r = [];
    const rd = D.raDec(D.mxv(prec, n.v));
    const hms = x => { const h = x / 15; const hh = Math.floor(h), mm = Math.floor((h - hh) * 60), ss = Math.round(((h - hh) * 60 - mm) * 60); return `${hh}h ${String(mm).padStart(2, '0')}m ${String(ss % 60).padStart(2, '0')}s`; };
    const dms = x => { const s = x < 0 ? '−' : '+', a = Math.abs(x), d = Math.floor(a), mm = Math.floor((a - d) * 60); return `${s}${d}° ${String(mm).padStart(2, '0')}′`; };
    r.push(radek('<b>' + n.jmeno + '</b>', ''));
    if (n.t) {
      const t = n.t;
      r.push(radek('Jasnost', fmtMag(t.mag) + ' mag'));
      r.push(radek('Úhlový průměr', fmtUhel(2 * t.rUhel)));
      r.push(radek('Vzdálenost', t.klic === 'mesic' ? Math.round(t.D * D.AU).toLocaleString('cs-CZ') + ' km' : t.D.toFixed(3).replace('.', ',') + ' au (' + (t.D * D.AU / 1e6).toFixed(0) + ' mil. km)'));
      r.push(radek('Osvětlený podíl disku', Math.round(t.k * 100) + ' %'));
      if (t.klic === 'saturn') r.push(radek('Sklon prstenců k Zemi', t.B.toFixed(1).replace('.', ',') + '°'));
      if (t.klic === 'mars' || t.klic === 'jupiter') r.push(radek('Centrální poledník', Math.round((360 - t.cm) % 360) + '° (západní délka' + (t.klic === 'jupiter' ? ', Systém II' : '') + ')'));
      if (t.klic === 'mesic') r.push(radek('Librace (délka, šířka)', `${((t.cm + 180) % 360 - 180).toFixed(1).replace('.', ',')}°, ${t.De.toFixed(1).replace('.', ',')}°`));
      if (t.mesice) {
        const ms = window.DALEK_TELESA.mesiceJupiteru(t);
        r.push(radek('Měsíce (″ od středu)', ms.map(x => `${x.jmeno} ${x.x > 0 ? 'Z' : 'V'} ${Math.abs(x.x * t.rUhel).toFixed(0)}${x.zakryt ? ' (za Jupiterem)' : x.zatmeni ? ' (zatmění)' : x.z > 0 && Math.abs(x.x) < 1 && Math.abs(x.y) < 1 ? ' (přechod)' : ''}${x.stin ? ' + stín na disku' : ''}`).join(', ')));
      }
      const v = vychodZapad(t.jmeno, j => D.teleso(t.klic, j, m).obzor.alt, jd);
      r.push(radek('Východ / kulminace / západ', `${fmtCas(v.vychod)} / ${fmtCas(v.kulminace)} / ${fmtCas(v.zapad)}`));
    } else if (n.o) {
      const ob = n.o;
      r.push(radek('Typ', TYPY[ob[3]] || ob[3]));
      r.push(radek('Katalog', ob[9] || ''));
      r.push(radek('Jasnost', fmtMag(+ob[4]) + ' mag'));
      r.push(radek('Rozměr', ob[5] === ob[6] ? ob[5] + '′' : `${ob[5]}′ × ${ob[6]}′`));
      const v = vychodZapad(ob[0], j => D.naObzor(n.v, j, m).alt, jd);
      r.push(radek('Východ / kulminace / západ', `${fmtCas(v.vychod)} / ${fmtCas(v.kulminace)} / ${fmtCas(v.zapad)}`));
    } else if (n.i !== undefined) {
      r.push(radek('Označení', DATA.BAYER[n.i] || '—'));
      r.push(radek('Jasnost', fmtMag(DATA.H[n.i * 4 + 2]) + ' mag'));
      r.push(radek('Barevný index B−V', DATA.H[n.i * 4 + 3].toFixed(2).replace('.', ',')));
      const dv = DATA.DVOJHVEZDY.find(x => x[0] === n.i);
      if (dv) {
        r.push(radek('Dvojhvězda', dv[2].map(s => `${fmtMag(s[0])} mag, ${s[2].toString().replace('.', ',')}″, PA ${s[3]}°`).join('; ')));
        const sep = Math.min(...dv[2].map(s => s[2]));
        const dal = dalekohled();
        const mez = Math.max(116 / dal.D, posledni.seeing || 0);
        const zdanlive = sep * o.M / 60;           // zdánlivá vzdálenost v ′ (oko rozliší ~1–2′)
        let t;
        if (sep < 116 / dal.D * 0.9) t = '<span class="chyba">ne – pod rozlišovací mezí dalekohledu</span>';
        else if (sep < mez * 0.8) t = '<span class="varovani">ne – rozmazává seeing</span>';
        else if (zdanlive < 1.5) t = '<span class="varovani">zvyšte zvětšení (zdánlivě jen ' + zdanlive.toFixed(1).replace('.', ',') + '′)</span>';
        else t = '<span class="ok">ano</span>' + (posledni.k * sep < 6 ? ' (na obrazovce použijte lupu)' : '');
        r.push(radek('Rozlišitelná nyní', t));
      }
    }
    r.push(radek('Rektascenze / deklinace', `${hms(rd.ra)} / ${dms(rd.dec)}`));
    el.innerHTML = r.join('');
  }

  /* ---------- start ---------- */
  nahodnyFokus(); S.fokus = S.fokusCil;      // na začátku zaostřeno, rozostří se až výměnou okuláru
  doFormulare();
  // výchozí cíl: nejjasnější planeta nad obzorem v noci, jinak Měsíc
  (function vychoziCil() {
    let jd = jdTed();
    const m = misto();
    // ve dne začít dnešní nocí (Slunce aspoň 12° pod obzorem)
    const hSl = j => D.teleso('slunce', j, m).obzor.alt;
    if (hSl(jd) > -12) {
      let j = jd;
      for (let i = 0; i < 24 * 6 && hSl(j) > -12; i++) j += 1 / 144;
      if (hSl(j) <= -12) {
        nastavJd(j + 1 / 48);
        jd = jdTed();
        setTimeout(() => zprava('Teď je světlo, simulace proto začíná dnešní nocí v ' + fmtCas(jd) + '. Tlačítko „Teď“ vrátí skutečný čas.'), 50);
      }
    }
    const sl = D.teleso('slunce', jd, m);
    const kand = D.KLICE_TELES.map(k => D.teleso(k, jd, m)).filter(t => t.obzor.alt > 12 && D.uhel(t.v, sl.v) > 25).sort((a, b) => a.mag - b.mag);
    const vyber = kand.find(t => t.klic !== 'mesic') || kand[0];
    if (vyber) { namir(vyber.v); if (!S.sledovani) { /* alt/az */ } }
    else namir(D.zObzoru(40, 180, jd, m));
    if (S.sledovani) cJ2000 = vyber ? vyber.v : cJ2000;
  })();
  prepocetCilu(true);
  // přednačíst texturu Měsíce a planet (na pozadí)
  for (const k of ['jupiter', 'saturn', 'mars', 'venuse', 'merkur', 'mesic']) window.DALEK_TELESA.nactiTexturu(k, 'dalekohled/tex/' + k + '.jpg');
  requestAnimationFrame(snimek);
  window.DALEK_UI = { S, namir, jdTed, nastavJd, posunObrazem, smer: () => smer, prepniSledovani, posledni: () => posledni, dalekohled, okular, zmenaDalekohledu, doFormulare };
})();

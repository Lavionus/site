/* dalekohled/ui.js – jádro aplikace „Hvězdářský dalekohled“: stav, čas, směr dalekohledu,
   vybavení, hlavní smyčka (okulár, mapa, karta objektu), nástroje v okuláru, sdílení.
   Ostatní moduly (hledani, planovac, ukazy, panely, denik) používají window.DALEK_APP. */
(function () {
  'use strict';
  const D = window.DALEK, DATA = window.DALEK_DATA, OK = window.DALEK_OKULAR, OB = window.DALEK_OBLOHA, A = window.ASTRO;
  const K = window.DALEK_KAT, V = window.DALEK_VYBAVA;
  const $ = id => document.getElementById(id);
  const RAD = Math.PI / 180;
  const KLIC = 'webapp_dalekohled';

  const MISTA = [
    ['Praha', 50.087, 14.421, 250], ['Brno', 49.195, 16.608, 230], ['Ostrava', 49.835, 18.292, 220], ['Plzeň', 49.738, 13.373, 310],
    ['České Budějovice', 48.975, 14.474, 390], ['Hradec Králové', 50.209, 15.833, 235], ['Liberec', 50.767, 15.056, 380],
    ['Olomouc', 49.594, 17.251, 220], ['Ondřejov (observatoř)', 49.910, 14.781, 530], ['Jizerka (tmavá obloha)', 50.820, 15.333, 860],
    ['Úpice (hvězdárna)', 50.512, 16.012, 410], ['Kleť (observatoř)', 48.863, 14.284, 1070], ['Bratislava', 48.148, 17.107, 140],
    ['Vlastní', null, null, 300],
  ];

  /* ---------- stav ---------- */
  const S = {
    dal: 'd200', montaz: 'az', diag: 0, sledovani: false, okular: 'p25', barlow: '1', fokus: 0, fokusCil: 0,
    rezim: 'okular', kamera: 'asi2600', expozice: 30, barlowK: '1', filtr: 'zadny',
    misto: 0, lat: 50.087, lon: 14.421, vyska: 250,
    seeing: 2.5, bortle: 4, zornice: 7, popisky: true, rychlost: 1, mapaPole: 70, mapaMez: 5.5, pohyb: 64, lupa: 1,
    kriz: false, sit: false, sipka: true, nocni: false,
    mRovnik: false, mEkliptika: true, mTelrad: false, mOkulary: false, mDso: true,
    cil: null, seznam: [], zalozka: 'planovac', grs: 75,
  };
  try { Object.assign(S, JSON.parse(localStorage.getItem(KLIC) || '{}')); } catch (e) { /* bez uložení */ }
  // starší uložený stav (číselné okuláry, barlow jako číslo)
  if (typeof S.okular === 'number') S.okular = 'p25';
  if (typeof S.barlow === 'number') S.barlow = '1';
  const uloz = () => { try { const { fokusCil, ...u } = S; localStorage.setItem(KLIC, JSON.stringify(u)); } catch (e) { /* nevadí */ } };

  // čas simulace
  let jd0 = A.jdZData(new Date()), t0 = performance.now();
  const jdTed = () => jd0 + (performance.now() - t0) / 86400000 * S.rychlost;
  const nastavJd = jd => { jd0 = jd; t0 = performance.now(); prepocet(); };

  // směr dalekohledu: c (J2000) při sledování, jinak {alt, az}
  let smer = { alt: 35, az: 180 }, cJ2000 = null;
  // střed mapy: null = sleduje dalekohled
  let mapaStred = null;

  const misto = () => ({ lat: S.lat, lon: S.lon, vyska: S.vyska });
  const dalekohled = () => V.dalekohled(S.dal);
  const okular = () => V.okular(S.okular);
  const fotoRezim = () => S.rezim === 'kamera' && !dalekohled().pevneZvetseni;
  const barlowK = () => V.prislusenstvi(fotoRezim() ? S.barlowK : S.barlow).k;

  // posluchači změn (moduly se přepočítají při změně času, místa, vybavení)
  const posluchaci = [];
  let prepocetCas = null;
  function prepocet() {
    clearTimeout(prepocetCas);
    prepocetCas = setTimeout(() => { for (const f of posluchaci) try { f(); } catch (e) { console.error(e); } }, 120);
  }

  /* ---------- ovládací prvky ---------- */
  const selDal = $('selDalekohled'), selOk = $('selOkular'), selMisto = $('selMisto');
  function naplnVybavu() {
    selDal.innerHTML = '';
    const skup = { n: document.createElement('optgroup'), v: document.createElement('optgroup') };
    skup.n.label = 'Předvolby'; skup.v.label = 'Moje dalekohledy';
    for (const d of V.dalekohledy()) skup[d.vlastni ? 'v' : 'n'].appendChild(new Option(d.nazev, d.id));
    selDal.appendChild(skup.n); if (skup.v.children.length) selDal.appendChild(skup.v);
    selDal.value = dalekohled().id;
    naplnOkulary();
    for (const id of ['selBarlow', 'selBarlowK']) {
      const s = $(id); s.innerHTML = '';
      for (const p of V.PRISLUSENSTVI) s.add(new Option(p.n, p.id));
    }
    $('selBarlow').value = S.barlow; $('selBarlowK').value = S.barlowK;
    const sk = $('selKamera'); sk.innerHTML = '';
    for (const k of V.kamery()) sk.add(new Option(k.n + (k.vlastni ? ' (vlastní)' : ''), k.id));
    sk.value = V.kamera(S.kamera).id;
    const sf = $('selFiltr'); sf.innerHTML = '';
    for (const f of V.FILTRY) sf.add(new Option(f.n, f.id));
    sf.value = S.filtr;
  }
  function naplnOkulary() {
    selOk.innerHTML = '';
    const dal = dalekohled();
    const seznam = V.okulary();
    if (!seznam.find(o => o.id === S.okular) && seznam.length) S.okular = seznam[Math.min(2, seznam.length - 1)].id;
    for (const o of seznam) {
      const M = dal.F * V.prislusenstvi(S.barlow).k / o.f;
      selOk.add(new Option(`${String(o.f).replace('.', ',')} mm ${o.n} ${o.afov}° – ${Math.round(M)}×`, o.id));
    }
    selOk.value = S.okular;
    selOk.disabled = !!dal.pevneZvetseni;
    $('selBarlow').disabled = !!dal.pevneZvetseni;
  }
  MISTA.forEach((m, i) => selMisto.add(new Option(m[0], i)));

  function nahodnyFokus() {
    const dal = dalekohled();
    S.fokusCil = dal.pevneZvetseni ? 0 : Math.round((Math.random() * 2.4 - 1.2) * 100) / 100;
  }
  function doFormulare() {
    naplnVybavu();
    $('selMontaz').value = S.montaz; $('selDiag').value = String(S.diag);
    $('chkSledovani').checked = S.sledovani;
    $('inFokus').value = S.fokus;
    selMisto.value = S.misto;
    $('inLat').value = S.lat; $('inLon').value = S.lon;
    $('inSeeing').value = S.seeing; $('vSeeing').textContent = S.seeing.toFixed(1).replace('.', ',') + '″';
    $('selBortle').value = S.bortle; $('selZornice').value = S.zornice;
    $('selRychlost').value = String(S.rychlost);
    $('inMapaPole').value = S.mapaPole; $('vMapaPole').textContent = S.mapaPole + '°';
    $('inMapaMez').value = S.mapaMez; $('vMapaMez').textContent = String(S.mapaMez).replace('.', ',') + ' mag';
    $('selPohyb').value = String(S.pohyb);
    $('selLupa').value = String(S.lupa);
    $('inExpozice').value = S.expozice;
    const fr = fotoRezim();
    $('rezOkular').setAttribute('aria-pressed', String(!fr)); $('rezKamera').setAttribute('aria-pressed', String(fr));
    $('blokOkular').hidden = fr; $('blokKamera').hidden = !fr;
    const tg = { tPopisky: S.popisky, tKriz: S.kriz, tSit: S.sit, tMereni: mereni.zap, tSipka: S.sipka, btnNocni: S.nocni, mRovnik: S.mRovnik, mEkliptika: S.mEkliptika, mTelrad: S.mTelrad, mOkulary: S.mOkulary, mDso: S.mDso };
    for (const [id, v] of Object.entries(tg)) $(id).setAttribute('aria-pressed', String(!!v));
    document.body.classList.toggle('nocni', !!S.nocni);
  }
  function zmenaDalekohledu() {
    const d = dalekohled();
    if (!d.vlastni || d.montaz) { S.montaz = d.montaz || 'az'; S.diag = d.diag || 0; prepniSledovani(!!d.sledovani); }
    if (d.pevneZvetseni) { S.barlow = '1'; if (S.rezim === 'kamera') S.rezim = 'okular'; }
    nahodnyFokus(); S.fokus = S.fokusCil;
    doFormulare(); uloz(); prepocet();
  }
  selDal.addEventListener('change', () => { S.dal = selDal.value; zmenaDalekohledu(); });
  $('selMontaz').addEventListener('change', e => { S.montaz = e.target.value; uloz(); });
  $('selDiag').addEventListener('change', e => { S.diag = +e.target.value; uloz(); });
  $('chkSledovani').addEventListener('change', e => { prepniSledovani(e.target.checked); uloz(); });
  selOk.addEventListener('change', () => { S.okular = selOk.value; nahodnyFokus(); uloz(); prepocet(); });
  $('selBarlow').addEventListener('change', e => { S.barlow = e.target.value; naplnOkulary(); nahodnyFokus(); uloz(); prepocet(); });
  $('selBarlowK').addEventListener('change', e => { S.barlowK = e.target.value; uloz(); prepocet(); });
  $('selKamera').addEventListener('change', e => { S.kamera = e.target.value; uloz(); prepocet(); });
  $('selFiltr').addEventListener('change', e => { S.filtr = e.target.value; uloz(); prepocet(); });
  $('inExpozice').addEventListener('input', e => { const v = +e.target.value; if (v > 0) { S.expozice = v; uloz(); prepocet(); } });
  $('rezOkular').addEventListener('click', () => { S.rezim = 'okular'; doFormulare(); uloz(); prepocet(); });
  $('rezKamera').addEventListener('click', () => {
    if (dalekohled().pevneZvetseni) return zprava('Tento přístroj nemá výměnný okulár – kameru k němu nepřipojíte.');
    S.rezim = 'kamera'; doFormulare(); uloz(); prepocet();
  });
  $('inFokus').addEventListener('input', e => { S.fokus = +e.target.value; });
  $('btnZaostrit').addEventListener('click', () => { S.fokus = S.fokusCil; $('inFokus').value = S.fokus; });
  $('odkazVybava').addEventListener('click', e => { e.preventDefault(); otevriZalozku('vybava'); $('panel-vybava').scrollIntoView({ behavior: 'smooth' }); });
  selMisto.addEventListener('change', () => {
    S.misto = +selMisto.value; const m = MISTA[S.misto];
    if (m[1] !== null) { S.lat = m[1]; S.lon = m[2]; S.vyska = m[3]; }
    doFormulare(); uloz(); prepocet();
  });
  for (const id of ['inLat', 'inLon']) $(id).addEventListener('change', () => {
    const la = +$('inLat').value, lo = +$('inLon').value;
    if (la >= -90 && la <= 90 && lo >= -180 && lo <= 180) { S.lat = la; S.lon = lo; S.misto = MISTA.length - 1; selMisto.value = S.misto; uloz(); prepocet(); }
  });
  $('btnGeo').addEventListener('click', () => {
    if (!navigator.geolocation) return zprava('Prohlížeč neumí zjistit polohu.');
    navigator.geolocation.getCurrentPosition(p => {
      S.lat = Math.round(p.coords.latitude * 1000) / 1000; S.lon = Math.round(p.coords.longitude * 1000) / 1000;
      if (p.coords.altitude) S.vyska = Math.round(p.coords.altitude);
      S.misto = MISTA.length - 1; doFormulare(); uloz(); prepocet();
    }, () => zprava('Poloha není k dispozici (zamítnuto nebo nedostupné).'));
  });
  // čas
  const lokalniText = d => {
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  };
  $('inCas').addEventListener('change', e => { const d = new Date(e.target.value); if (!isNaN(d)) nastavJd(A.jdZData(d)); });
  $('selRychlost').addEventListener('change', e => { jd0 = jdTed(); t0 = performance.now(); S.rychlost = +e.target.value; uloz(); });
  const ted = () => { nastavJd(A.jdZData(new Date())); S.rychlost = 1; $('selRychlost').value = '1'; };
  $('btnTed').addEventListener('click', ted);
  $('btnNoc').addEventListener('click', () => { const d = A.dataZJd(jdTed()); d.setHours(22, 0, 0, 0); nastavJd(A.jdZData(d)); });
  $('btnCasPlus').addEventListener('click', () => nastavJd(jdTed() + 1 / 24));
  $('btnCasMinus').addEventListener('click', () => nastavJd(jdTed() - 1 / 24));
  $('btnDenPlus').addEventListener('click', () => nastavJd(jdTed() + 1));
  $('btnDenMinus').addEventListener('click', () => nastavJd(jdTed() - 1));
  $('btnTma').addEventListener('click', () => {
    const n = D.noc(D.poledne(jdTed() - 0.3, misto()), misto());
    if (n.astroKonec) nastavJd(n.astroKonec); else if (n.nautickyKonec) nastavJd(n.nautickyKonec); else zprava('Slunce tu dnes neklesne pod −12° (letní noc / polární den).');
  });
  const pauza = () => { jd0 = jdTed(); t0 = performance.now(); S.rychlost = S.rychlost ? 0 : 1; $('selRychlost').value = String(S.rychlost); };
  $('btnPauza').addEventListener('click', pauza);
  // podmínky
  $('inSeeing').addEventListener('input', e => { S.seeing = +e.target.value; $('vSeeing').textContent = S.seeing.toFixed(1).replace('.', ',') + '″'; uloz(); });
  $('selBortle').addEventListener('change', e => { S.bortle = +e.target.value; uloz(); prepocet(); });
  $('selZornice').addEventListener('change', e => { S.zornice = +e.target.value; uloz(); prepocet(); });
  $('inMapaPole').addEventListener('input', e => { S.mapaPole = +e.target.value; $('vMapaPole').textContent = S.mapaPole + '°'; uloz(); });
  $('inMapaMez').addEventListener('input', e => { S.mapaMez = +e.target.value; $('vMapaMez').textContent = String(S.mapaMez).replace('.', ',') + ' mag'; uloz(); });
  $('selPohyb').addEventListener('change', e => { S.pohyb = +e.target.value; uloz(); });
  $('selLupa').addEventListener('change', e => { S.lupa = +e.target.value; uloz(); });
  // přepínače
  const prepinac = (id, klic, po) => $(id).addEventListener('click', () => { S[klic] = !S[klic]; $(id).setAttribute('aria-pressed', String(S[klic])); uloz(); if (po) po(); });
  prepinac('tPopisky', 'popisky'); prepinac('tKriz', 'kriz'); prepinac('tSit', 'sit'); prepinac('tSipka', 'sipka');
  prepinac('btnNocni', 'nocni', () => document.body.classList.toggle('nocni', S.nocni));
  for (const id of ['mRovnik', 'mEkliptika', 'mTelrad', 'mOkulary', 'mDso']) prepinac(id, id, () => { mapaPosl.t = 0; });
  $('tMereni').addEventListener('click', () => { mereni.zap = !mereni.zap; mereni.a = mereni.b = null; $('tMereni').setAttribute('aria-pressed', String(mereni.zap)); cv.classList.toggle('meri', mereni.zap); });
  $('mZpet').addEventListener('click', () => { mapaStred = null; mapaPosl.t = 0; });

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
    mapaStred = null;
  }
  // výběr cíle (z hledání, mapy, plánovače…); namirit = rovnou na něj otočit dalekohled
  function vyber(id, namirit = true) {
    const o = K.objekt(id);
    if (!o) return;
    S.cil = id; uloz();
    if (namirit) {
      const v = K.smer(id, jdTed(), misto());
      namir(v);
      const alt = D.naObzor(v, jdTed(), misto()).alt;
      zprava('Namířeno: ' + o.nazev + (alt < 0 ? ' – je ale pod obzorem.' : ''));
    }
    infoCas = 0;
    for (const f of posluchaciCile) try { f(id); } catch (e) { console.error(e); }
  }
  const posluchaciCile = [];
  // posun o (dx, dy) obrazovkových px zorného pole → změna směru
  let posledni = null;      // poslední stav kreslení
  function posunObrazem(dxPx, dyPx) {
    if (!posledni) return;
    const { k, A: M, c } = posledni;
    const det = M[0] * M[3] - M[1] * M[2];
    const xw = (M[3] * dxPx - M[1] * dyPx) / det / k, yn = (-M[2] * dxPx + M[0] * dyPx) / det / k;
    const b = D.baze(c);
    const nc = D.unit(D.add(c, D.add(D.mul(b.x, xw / 206265), D.mul(b.y, yn / 206265))));
    nastavC(nc, posledni.jd, posledni.prec);
    posledni.c = nc;
  }

  /* ---------- okulár: tažení, měření, klávesy ---------- */
  const cv = $('okular'), mapa = $('mapa');
  const mereni = { zap: false, a: null, b: null, tahne: false };
  let tah = null;
  const bodPlatna = e => { const r = cv.getBoundingClientRect(), dpr = cv.width / r.width; return [(e.clientX - r.left) * dpr, (e.clientY - r.top) * dpr]; };
  function prichyt(x, y) {
    // přichytit k nejbližší hvězdě do 12 px
    if (!posledni || !posledni.vysledek) return null;
    const dpr = cv.width / cv.getBoundingClientRect().width;
    let best = null, bd = 12 * dpr;
    for (const h of posledni.vysledek.hvezdy || []) { const d = Math.hypot(h.x - x, h.y - y); if (d < bd) { bd = d; best = h; } }
    return best ? { v: best.v, jmeno: best.jmeno || (best.i >= 0 ? (DATA.JMENA[best.i] || DATA.BAYER[best.i]) : null) } : { v: posledni.vysledek.zpet(x, y) };
  }
  cv.addEventListener('pointerdown', e => {
    try { cv.setPointerCapture(e.pointerId); } catch (er) { /* syntetická událost */ }
    cv.focus();
    if (mereni.zap) {
      const [x, y] = bodPlatna(e);
      mereni.a = prichyt(x, y); mereni.b = mereni.a; mereni.tahne = true;
      return;
    }
    tah = { x: e.clientX, y: e.clientY };
    cv.classList.add('tahne');
  });
  cv.addEventListener('pointermove', e => {
    if (mereni.zap && mereni.tahne) { const [x, y] = bodPlatna(e); mereni.b = prichyt(x, y); return; }
    if (!tah) return;
    const dpr = cv.width / cv.clientWidth;
    posunObrazem(-(e.clientX - tah.x) * dpr, -(e.clientY - tah.y) * dpr);
    tah = { x: e.clientX, y: e.clientY };
  });
  const konecTahu = () => { tah = null; mereni.tahne = false; cv.classList.remove('tahne'); };
  cv.addEventListener('pointerup', konecTahu); cv.addEventListener('pointercancel', konecTahu);
  function zmenOkular(smerZmeny) {
    const seznam = V.okulary(); const i = seznam.findIndex(o => o.id === S.okular);
    const n = Math.max(0, Math.min(seznam.length - 1, i + smerZmeny));
    if (n !== i && seznam[n]) { S.okular = seznam[n].id; selOk.value = S.okular; nahodnyFokus(); uloz(); prepocet(); }
  }
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    if (dalekohled().pevneZvetseni || fotoRezim()) return;
    zmenOkular(e.deltaY > 0 ? -1 : 1);
  }, { passive: false });
  const drzene = new Set();
  let shift = false;
  document.addEventListener('keydown', e => {
    if (e.target.matches('input, select, textarea') || !$('paleta').hidden) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    shift = e.shiftKey;
    const smerKlav = { ArrowLeft: 1, ArrowRight: 1, ArrowUp: 1, ArrowDown: 1 }[e.key];
    if (smerKlav) { drzene.add(e.key); e.preventDefault(); return; }
    const k = e.key.toLowerCase();
    if (e.key === '+' || e.code === 'NumpadAdd' || e.key === '=') { zmenOkular(1); e.preventDefault(); }
    else if (e.key === '-' || e.code === 'NumpadSubtract') { zmenOkular(-1); e.preventDefault(); }
    else if (e.code === 'Comma') { S.fokus = Math.max(-2.5, S.fokus - 0.03); $('inFokus').value = S.fokus; }
    else if (e.code === 'Period') { S.fokus = Math.min(2.5, S.fokus + 0.03); $('inFokus').value = S.fokus; }
    else if (k === 'l') $('tPopisky').click();
    else if (k === 'k') $('tKriz').click();
    else if (k === 'g') $('tSit').click();
    else if (k === 'm') $('tMereni').click();
    else if (k === 'n') $('btnNocni').click();
    else if (k === 'z') { const L = [1, 1.5, 2, 3, 4, 6]; S.lupa = L[(L.indexOf(S.lupa) + 1) % L.length]; $('selLupa').value = String(S.lupa); uloz(); }
    else if (e.code === 'Space') { e.preventDefault(); pauza(); }
  });
  document.addEventListener('keyup', e => { drzene.delete(e.key); shift = e.shiftKey; });
  window.addEventListener('blur', () => drzene.clear());
  for (const b of document.querySelectorAll('.ovladac button[data-smer]')) {
    const k = 'btn' + b.dataset.smer;
    const start = e => { e.preventDefault(); drzene.add(k); };
    const stop = () => drzene.delete(k);
    b.addEventListener('pointerdown', start); b.addEventListener('pointerup', stop); b.addEventListener('pointerleave', stop); b.addEventListener('pointercancel', stop);
  }
  $('btnStred').addEventListener('click', () => { if (S.cil) vyber(S.cil, true); else if (posledni && posledni.nejblizsi) namir(posledni.nejblizsi.v); });
  $('btnNamirit').addEventListener('click', () => { if (S.cil) vyber(S.cil, true); });
  function pohybOvladacem(dt) {
    let dx = 0, dy = 0;
    for (const k of drzene) {
      const s = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[k] || (k.startsWith('btn') ? k.slice(3).split(',').map(Number) : null);
      if (s) { dx += s[0]; dy += s[1]; }
    }
    if ((!dx && !dy) || !posledni) return;
    const px = S.pohyb * 15.04 * (shift ? 8 : 1) * dt * posledni.k;
    posunObrazem(dx * px, dy * px);
  }

  /* ---------- mapa: klik = namířit, tah = posun mapy, kolečko = zoom ---------- */
  const mapaOb = OB.vytvor(mapa);
  let mapaTah = null;
  const bodMapy = e => { const r = mapa.getBoundingClientRect(), dpr = mapa.width / r.width; return [(e.clientX - r.left) * dpr, (e.clientY - r.top) * dpr, dpr]; };
  mapa.addEventListener('pointerdown', e => {
    try { mapa.setPointerCapture(e.pointerId); } catch (er) { /* nic */ }
    const [x, y] = bodMapy(e);
    mapaTah = { x, y, x0: x, y0: y, posun: false, stred: { ...(mapaStred || mapaOb.st.stred) } };
  });
  mapa.addEventListener('pointermove', e => {
    const [x, y, dpr] = bodMapy(e);
    if (!mapaTah) { const p = mapaOb.nejblizsi(x, y, 12 * dpr); mapa.title = p ? p.jmeno : ''; return; }
    if (Math.hypot(x - mapaTah.x0, y - mapaTah.y0) > 6 * dpr) mapaTah.posun = true;
    if (mapaTah.posun) {
      // posun středu mapy: rozdíl obzorníkových souřadnic pod kurzorem
      const a = mapaOb.zpet(mapaTah.x, mapaTah.y), b = mapaOb.zpet(x, y);
      const st = mapaStred || { ...mapaOb.st.stred };
      st.az = ((st.az - (b.az - a.az)) % 360 + 360) % 360;
      st.alt = Math.max(-20, Math.min(89, st.alt - (b.alt - a.alt)));
      mapaStred = st; mapaOb.st.stred = st;
      mapaTah.x = x; mapaTah.y = y;
      kresliMapu(true);
    }
  });
  mapa.addEventListener('pointerup', e => {
    if (!mapaTah) return;
    const posun = mapaTah.posun; mapaTah = null;
    if (posun) return;
    const [x, y, dpr] = bodMapy(e);
    const p = mapaOb.nejblizsi(x, y, 12 * dpr);
    if (p && p.id) { vyber(p.id, true); return; }
    const h = mapaOb.zpet(x, y);
    namir(D.zObzoru(h.alt, h.az, jdTed(), misto()));
  });
  mapa.addEventListener('wheel', e => {
    e.preventDefault();
    S.mapaPole = Math.max(2, Math.min(180, Math.round(S.mapaPole * (e.deltaY > 0 ? 1.15 : 1 / 1.15))));
    $('inMapaPole').value = S.mapaPole; $('vMapaPole').textContent = S.mapaPole + '°';
    kresliMapu(true);
  }, { passive: false });

  /* ---------- formátování ---------- */
  const fmtCas = jd => jd === null || jd === undefined ? '–' : A.dataZJd(jd).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
  const fmtDatumCas = jd => A.dataZJd(jd).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
  const fmtMag = K.fmtMag, fmtUhel = K.fmtUhel;
  const c1 = (x, d = 1) => (+x).toFixed(d).replace('.', ',').replace('-', '−');

  /* ---------- výpočet stavu snímku ---------- */
  function velikostPlatna(c) {
    const r = c.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.min(1200, Math.round(r.width * dpr));
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
    let M = [co, si, si, -co];
    let zrcadlo = false, otoc = false;
    // kamera: obraz bez zrcadlení (jak ho uloží software)
    if (fotoRezim()) { /* bez optického převrácení */ }
    else if (dal.typ === 'newton') otoc = true;
    else if (dal.typ === 'refraktor' || dal.typ === 'sct' || dal.typ === 'mak') { if (S.diag) zrcadlo = true; else otoc = true; }
    if (zrcadlo) M = [-M[0], -M[1], M[2], M[3]];
    if (otoc) M = M.map(x => -x);
    const zs = [M[0] * zx + M[1] * zy, M[2] * zx + M[3] * zy];
    const zsl = Math.hypot(zs[0], zs[1]) || 1;
    return { A: M, zenit: [zs[0] / zsl, zs[1] / zsl], zrcadlo, otoc };
  }
  // mezní hvězdná velikost kamery (přibližný model: šum oblohy, plocha objektivu, expozice)
  function mezKamery(dal, kam, F, sb, seeing, t, alt) {
    const meritko = 206.265 * kam.pixel / F;
    const fwhm = Math.max(seeing, 2 * meritko);
    // signál ~ D²·t, šum oblohy ~ sqrt(jas·plocha hvězdy·D²·t) → mez roste o 1,25·log t a 2,5·log D a s tmavší oblohou
    let lm = 15.0 + 2.5 * Math.log10((dal.D / 100) ** 2 * (1 - (dal.obstrukce || 0) ** 2)) * 1.0 + 1.25 * Math.log10(t / 30) + 0.5 * (sb - 20) - 1.25 * Math.log10(fwhm / 2.5);
    lm -= 0.25 * (D.vzdusnaHmota(alt) - 1);
    if (!kam.barevna) lm += 0.4;
    return Math.min(21.5, lm);
  }

  let mapaPosl = { t: 0 };
  let posledniT = performance.now(), infoCas = 0, vychodCache = { klic: '', jd: 0, data: null };
  let ramec = null;        // sdílený stav posledního snímku pro moduly

  function snimek() {
    try { snimekVnitrni(); } catch (e) { console.error(e); }
    requestAnimationFrame(snimek);
  }
  function snimekVnitrni() {
    const nyni = performance.now();
    const dt = Math.min(0.1, (nyni - posledniT) / 1000);
    posledniT = nyni;
    pohybOvladacem(dt);
    const jd = jdTed();
    const m = misto();
    const prec = D.precese(A.utNaJde(jd));
    const dal = dalekohled(), ok = okular();
    const foto = fotoRezim();
    const kam = foto ? V.kamera(S.kamera) : null;
    const kB = barlowK();
    let o = D.optika(dal, ok, kB);
    const Fe = dal.F * kB;
    if (foto) {
      const w = 2 * Math.atan(kam.sirka / 2 / Fe) / RAD, h = 2 * Math.atan(kam.vyska / 2 / Fe) / RAD;
      o = { ...o, pole: Math.hypot(w, h), poleW: w, poleH: h, M: dal.D, pupila: 1 };
    }
    const c = aktualniC(jd, prec);
    const obz = D.naObzor(c, jd, m, prec);
    if (S.sledovani) smer = { alt: obz.alt, az: obz.az };
    const altStred = S.sledovani ? obz.alt : smer.alt;
    const filtr = V.filtr(S.filtr);

    const telesa = ['slunce', ...D.KLICE_TELES].map(k => D.teleso(k, jd, m, prec));
    const slunce = telesa[0], mesic = telesa[1];
    for (const t of telesa) if (t.klic !== 'slunce') t.povrchJas = t.mag + 2.5 * Math.log10(Math.PI * t.rUhel * t.rUhel * t.zplosteni * Math.max(0.02, t.k));
    const hS = slunce.obzor.alt;
    const sb0 = D.jasOblohy({ bortle: S.bortle, hSlunce: hS, mesic: { alt: mesic.obzor.alt, k: mesic.k, uhel: D.uhel(mesic.v, c) } }, altStred);
    const sb = sb0 + filtr.pozadi;
    const sbOk = foto ? sb : D.jasPozadi(sb, o, S.zornice);
    const X = D.vzdusnaHmota(altStred);
    const seeingEf = S.seeing * Math.pow(Math.min(X, 10), 0.6);
    const lm = foto ? mezKamery(dal, kam, Fe, sb, seeingEf, S.expozice, altStred) : D.mezniVelikost(o, dal, sb, altStred, S.zornice);
    const eps = dal.pevneZvetseni ? 0 : Math.abs(S.fokus - S.fokusCil);
    const rozost = eps * dal.D / (Fe * Fe) * 206265;
    const CAidx = (dal.F / dal.D) / (dal.D / 25.4);
    const barevnaVada = dal.vada === 'cocka' ? 1.6 : dal.vada === 'achromat' ? Math.max(0, Math.min(1, (5 - CAidx) / 4)) : 0;
    const orient = orientace(c, jd, prec, dal);
    const sluncVzd = D.uhel(slunce.v, c);
    // stopy hvězd bez pointace během expozice (posun k západu)
    let stopa = null;
    if (foto && !S.sledovani) {
      const drift = 15.041 * Math.cos(D.raDec(c).dec * RAD) * Math.min(S.expozice, 600);
      stopa = [orient.A[0] * drift, orient.A[2] * drift];       // ve ″, převede se na px níže
    }

    const dprO = velikostPlatna(cv);
    const kamRozmer = foto ? { sirka: o.poleW * 3600, vyska: o.poleH * 3600 } : null;
    const stav = {
      cv, jd, misto: m, prec, c, dal, o, lm, sbOk: foto ? sb : sbOk, hSlunce: hS, seeing: foto ? seeingEf * 0.75 : seeingEf,
      difrakce: 1.03 * 0.55e-3 / dal.D * 206265, rayleigh: 138 / dal.D, rozostreni: rozost, lupa: S.lupa, orient, telesa,
      popisky: S.popisky, dt, dpr: dprO, barevnaVada: foto ? barevnaVada * 0.5 : barevnaVada,
      disperze: D.disperze(altStred), altStred, extinkce: X - 1, filtr, sit: S.sit,
      jasPozadiPosun: foto ? (x => x) : (x => x + 5 * Math.log10(Math.max(1, S.zornice / o.pupila))),
      slunce: { vPoli: hS > -1 && sluncVzd < o.pole / 2 + 0.3 && !filtr.slunecni }, cestaTextur: 'dalekohled/tex/',
      kamera: kamRozmer, foto: foto ? { expozice: S.expozice } : null,
    };
    if (stopa) {
      const kk = Math.min(cv.width, cv.height) * 0.94 * S.lupa / Math.max(kamRozmer.sirka, kamRozmer.vyska);
      stav.stopa = [stopa[0] * kk, stopa[1] * kk];
    }
    const vysledek = OK.kresli(stav);
    posledni = { k: vysledek.k || 1, A: orient.A, c, jd, prec, seeing: seeingEf, vysledek };
    if (!vysledek.oslneni) {
      kompas(cv, orient, dprO);
      if (S.kriz) kriz(cv, vysledek, dprO, o);
      if (S.sipka && S.cil) sipkaKCili(cv, vysledek, dprO, jd, m, c, o);
      if (mereni.a) kresliMereni(cv, vysledek, dprO);
    }
    // nejbližší objekt ke středu
    let nejbl = null, nd = Infinity;
    for (const t of vysledek.telesa || []) { const d = D.uhel(t.t.v, c); if (d < nd) { nd = d; nejbl = { id: 'p:' + t.t.klic, jmeno: t.t.jmeno, v: t.t.v }; } }
    for (const v of vysledek.viditelne || []) {
      if (v.typ === 'dso') { const vv = D.v3(v.o[1], v.o[2]); const d = D.uhel(vv, c); if (d < nd) { nd = d; nejbl = { id: 'd:' + v.o[0], jmeno: v.o[0], v: vv }; } }
    }
    for (const h of vysledek.hvezdy || []) {
      if (h.i < 0 || h.m > 7) continue;
      const d = D.uhel(h.v, c) + 0.002 * (h.m - 3);
      if (d < nd) { nd = d; nejbl = { id: 'h:' + h.i, jmeno: DATA.JMENA[h.i] || DATA.BAYER[h.i] || 'HR ' + DATA.HR[h.i], v: h.v }; }
    }
    posledni.nejblizsi = nd < o.pole / 2 ? nejbl : null;

    ramec = { jd, misto: m, prec, dal, ok, o, c, obz, altStred, telesa, slunce, mesic, hS, sb, sbOk, lm, X, seeingEf, foto, kam, Fe, filtr, eps, rozost };

    // lišty
    $('lsZvetseni').textContent = foto
      ? `${kam.n.replace(/\s*\(.*\)/, '')} · ${fmtUhel(o.poleW * 3600)} × ${fmtUhel(o.poleH * 3600)} · ${c1(206.265 * kam.pixel / Fe, 2)}″/px · ${S.expozice} s`
      : `${Math.round(o.M)}× · pole ${fmtUhel(o.pole * 3600)} · mez ${c1(lm)} mag`;
    $('lsSmer').textContent = `výška ${c1(altStred)}° · azimut ${Math.round(S.sledovani ? obz.az : smer.az)}°`;
    $('lsCas').textContent = A.dataZJd(jd).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    $('lsObjekt').textContent = posledni.nejblizsi ? posledni.nejblizsi.jmeno : '';
    $('lsCasHlavni').textContent = A.dataZJd(jd).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + (S.rychlost === 0 ? ' ⏸' : S.rychlost > 1 ? ' ' + S.rychlost + '×' : '');
    $('btnPauza').textContent = S.rychlost ? '⏸' : '▶';

    kresliMapu(false);

    // varování
    if (hS > -1 && sluncVzd < 12 && !filtr.slunecni) zprava(sluncVzd < o.pole / 2 + 0.3 ? '☀ Dalekohled míří na Slunce! Ve skutečnosti by to znamenalo okamžité a trvalé poškození zraku.' : '⚠ Dalekohled míří blízko Slunce – ve skutečnosti nebezpečné!', true);
    else if (altStred < 0 && performance.now() > zpravaDo) zprava('Dalekohled míří pod obzor.');
    else if (performance.now() > zpravaDo && $('zprava').textContent) { $('zprava').textContent = ''; $('zprava').className = ''; }

    if (nyni - infoCas > 500) {
      infoCas = nyni;
      panelOptiky();
      panelObjektu();
      if (document.activeElement !== $('inCas')) $('inCas').value = lokalniText(A.dataZJd(jd));
      const tma = hS < -18 ? 'astronomická noc' : hS < -12 ? 'astronomický soumrak' : hS < -6 ? 'nautický soumrak' : hS < -0.8 ? 'občanský soumrak' : 'den';
      const im = D.infoMesice(jd, m);
      $('casInfo').innerHTML = `Slunce ${c1(hS, 0)}° (${tma}) · Měsíc ${mesic.obzor.alt > 0 ? Math.round(mesic.obzor.alt) + '° nad obzorem' : 'pod obzorem'}, ${Math.round(mesic.k * 100)} % (${c1(im.stari)} d)`;
      $('podminkyInfo').innerHTML = `Jas oblohy ve směru dalekohledu <b>${c1(sb0)} mag/″²</b>${filtr.pozadi ? ` (s filtrem ${c1(sb)})` : ''}, okem do <b>${c1(D.nelm(sb0))} mag</b>. Vzdušná hmota ${c1(X)}, seeing v tomto směru ${c1(seeingEf)}″.`;
    }
  }

  function kresliMapu(hned) {
    if (!ramec) return;
    const nyni = performance.now();
    const smerDal = S.sledovani ? ramec.obz : smer;
    const stred = mapaStred || smerDal;
    const zmena = hned || !mapaPosl.smer || Math.abs(mapaPosl.smer.alt - stred.alt) + Math.abs(mapaPosl.smer.az - stred.az) > 0.05 || mapaPosl.fov !== S.mapaPole || mapaPosl.w !== mapa.width || mapaPosl.mez !== S.mapaMez;
    if (!zmena && nyni - mapaPosl.t < 400) return;
    const dprM = velikostPlatna(mapa);
    mapaPosl = { t: nyni, smer: { ...stred }, fov: S.mapaPole, w: mapa.width, mez: S.mapaMez };
    mapaOb.st.fov = S.mapaPole;
    const r = ramec;
    mapaOb.kresli({
      jd: r.jd, misto: r.misto, prec: r.prec, stred, smerDal, telesa: r.telesa, hSlunce: r.hS, poleOk: r.o.pole, poleHledacku: 6,
      mez: S.mapaMez, dpr: dprM, rovnik: S.mRovnik, ekliptika: S.mEkliptika, telrad: S.mTelrad, dso: S.mDso,
      polaOkularu: S.mOkulary && !r.foto ? V.okulary().map(ok => D.optika(r.dal, ok, barlowK()).pole) : null,
      ramecek: r.foto ? [r.o.poleW, r.o.poleH] : null,
      cilV: S.cil ? K.smer(S.cil, r.jd, r.misto) : null,
    });
  }

  /* ---------- překryvy okuláru ---------- */
  function kompas(cv, orient, dpr) {
    const ctx = cv.getContext('2d');
    const M = orient.A;
    const n = [M[1], M[3]], e = [-M[0], -M[2]];
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
  }
  function kriz(cv, r, dpr, o) {
    // osvětlený záměrný kříž s ryskami po 1′ / 10′ (podle pole)
    const ctx = cv.getContext('2d');
    const { cx, cy, k } = r;
    const pole = o.pole * 3600;
    const krok = [1, 2, 5, 10, 30, 60, 120, 300, 600, 1800].find(x => x * 10 >= pole / 2) || 1800;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,60,40,0.75)'; ctx.fillStyle = 'rgba(255,90,70,0.85)'; ctx.lineWidth = dpr;
    ctx.beginPath(); ctx.moveTo(cx - r.R, cy); ctx.lineTo(cx - 6 * dpr, cy); ctx.moveTo(cx + 6 * dpr, cy); ctx.lineTo(cx + r.R, cy);
    ctx.moveTo(cx, cy - r.R); ctx.lineTo(cx, cy - 6 * dpr); ctx.moveTo(cx, cy + 6 * dpr); ctx.lineTo(cx, cy + r.R); ctx.stroke();
    for (let i = 1; i * krok * k < r.R; i++) {
      const d = i * krok * k, l = (i % 5 ? 3 : 6) * dpr;
      ctx.beginPath(); ctx.moveTo(cx + d, cy - l); ctx.lineTo(cx + d, cy + l); ctx.moveTo(cx - d, cy - l); ctx.lineTo(cx - d, cy + l);
      ctx.moveTo(cx - l, cy + d); ctx.lineTo(cx + l, cy + d); ctx.moveTo(cx - l, cy - d); ctx.lineTo(cx + l, cy - d); ctx.stroke();
    }
    ctx.font = `${10 * dpr}px system-ui, sans-serif`;
    ctx.fillText('rysky po ' + fmtUhel(krok), cx + 8 * dpr, cy - 8 * dpr);
    ctx.restore();
  }
  function sipkaKCili(cv, r, dpr, jd, m, c, o) {
    const v = K.smer(S.cil, jd, m); if (!v) return;
    const d = D.uhel(v, c);
    if (d < o.pole / 2 * 0.9) return;
    const p = r.proj(v);
    const ctx = cv.getContext('2d');
    // směr na obrazovce: pro vzdálené cíle přes tečnou rovinu
    let dx, dy;
    if (p) { dx = p[0] - r.cx; dy = p[1] - r.cy; }
    else {
      const b = D.baze(c), xw = D.dot(v, b.x), yn = D.dot(v, b.y);
      dx = posledni.A[0] * xw + posledni.A[1] * yn; dy = posledni.A[2] * xw + posledni.A[3] * yn;
    }
    const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const rr = Math.min(r.R, Math.min(cv.width, cv.height) / 2) - 26 * dpr;
    const x = r.cx + dx * rr, y = r.cy + dy * rr;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(Math.atan2(dy, dx));
    ctx.fillStyle = 'rgba(125,255,176,0.9)';
    ctx.beginPath(); ctx.moveTo(14 * dpr, 0); ctx.lineTo(-6 * dpr, -8 * dpr); ctx.lineTo(-6 * dpr, 8 * dpr); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.fillStyle = 'rgba(125,255,176,0.95)'; ctx.font = `${11 * dpr}px system-ui, sans-serif`;
    ctx.textAlign = dx > 0.3 ? 'right' : dx < -0.3 ? 'left' : 'center';
    const o2 = K.objekt(S.cil);
    ctx.fillText(`${o2 ? o2.nazev.split(' – ')[0] : ''} ${fmtUhel(d * 3600)}`, x - dx * 22 * dpr, y - dy * 22 * dpr + 4 * dpr);
    ctx.restore();
  }
  function kresliMereni(cv, r, dpr) {
    const pa = r.proj(mereni.a.v), pb = r.proj(mereni.b.v);
    if (!pa || !pb) return;
    const ctx = cv.getContext('2d');
    const sep = D.uhel(mereni.a.v, mereni.b.v) * 3600;
    const PA = D.pozicniUhel(mereni.a.v, mereni.b.v);
    ctx.save();
    ctx.strokeStyle = '#ffe24a'; ctx.fillStyle = '#ffe24a'; ctx.lineWidth = 1.5 * dpr;
    ctx.beginPath(); ctx.moveTo(pa[0], pa[1]); ctx.lineTo(pb[0], pb[1]); ctx.stroke();
    for (const p of [pa, pb]) { ctx.beginPath(); ctx.arc(p[0], p[1], 5 * dpr, 0, 2 * Math.PI); ctx.stroke(); }
    ctx.font = `bold ${12 * dpr}px system-ui, sans-serif`;
    const t = `${fmtUhel(sep)} · PA ${c1(PA)}°`;
    const tx = (pa[0] + pb[0]) / 2 + 10 * dpr, ty = (pa[1] + pb[1]) / 2 - 10 * dpr;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; const w = ctx.measureText(t).width;
    ctx.fillRect(tx - 4 * dpr, ty - 13 * dpr, w + 8 * dpr, 18 * dpr);
    ctx.fillStyle = '#ffe24a'; ctx.fillText(t, tx, ty);
    ctx.restore();
    $('lsObjekt').textContent = `měření: ${fmtUhel(sep)}, PA ${c1(PA)}°` + (mereni.a.jmeno && mereni.b.jmeno && mereni.a.jmeno !== mereni.b.jmeno ? ` (${mereni.a.jmeno} → ${mereni.b.jmeno})` : '');
  }

  /* ---------- panely: optika, objekt ---------- */
  function radek(a, b) { return `<div><span>${a}</span><span>${b}</span></div>`; }
  function panelOptiky() {
    const r = ramec; if (!r) return;
    const { dal, o, lm, seeingEf, eps, rozost } = r;
    if (r.foto) {
      const af = D.astrofoto(r.kam, r.Fe, dal.D, seeingEf, D.raDec(r.c).dec, S.sledovani);
      $('optika').innerHTML = [
        radek('Ohnisko / světelnost', `${Math.round(r.Fe)} mm · f/${c1(r.Fe / dal.D)}`),
        radek('Zorné pole čipu', `${fmtUhel(o.poleW * 3600)} × ${fmtUhel(o.poleH * 3600)}`),
        radek('Měřítko', c1(af.meritko, 2) + '″/px'),
        radek('Vzorkování seeingu', c1(af.vzorkovani, 1) + ' px/FWHM'),
        radek('Bez pointace max.', af.tMax < 1 ? c1(af.tMax, 2) + ' s (1 px)' : c1(af.tMax, 1) + ' s (1 px)'),
        radek('Mezní velikost snímku', c1(lm) + ' mag'),
      ].join('');
      const p = [af.doporuceni];
      if (!S.sledovani && S.expozice > af.tMax * 3) p.push('<span class="varovani">Bez motorového sledování se hvězdy protáhnou do čárek.</span>');
      if (S.sledovani && S.montaz === 'az' && S.expozice > 30) p.push('<span class="varovani">Azimutální montáž: při dlouhé expozici se pole otáčí (rotace pole) – použijte paralaktickou.</span>');
      $('optikaPozn').innerHTML = p.join('<br>');
      $('vFokus').textContent = eps < 0.02 ? 'zaostřeno' : 'mimo ohnisko ' + c1(eps, 2) + ' mm';
      return;
    }
    $('optika').innerHTML = [
      radek('Zvětšení', Math.round(o.M) + '×'),
      radek('Skutečné zorné pole', fmtUhel(o.pole * 3600)),
      radek('Výstupní pupila', c1(o.pupila, 2) + ' mm'),
      radek('Světelnost', 'f/' + c1(o.svetelnost)),
      radek('Rozlišení (Dawes)', c1(o.dawes, 2) + '″'),
      radek('Sběr světla proti oku', Math.round(o.sbirani) + '×'),
      radek('Mezní hvězdná velikost', c1(lm) + ' mag'),
      radek('Rozumné zvětšení', `${Math.round(o.minZvetseni)}–${Math.round(o.maxZvetseni)}×`),
    ].join('');
    const p = [];
    if (o.M > o.maxZvetseni) p.push('<span class="varovani">Prázdné zvětšení – víc než 2× průměr v mm, obraz už jen roste a tmavne.</span>');
    if (o.pupila > S.zornice + 0.05) p.push('<span class="varovani">Výstupní pupila je větší než zornice – část světla se ztrácí' + (dal.obstrukce ? ' a ve dne uvidíte stín sekundáru' : '') + '.</span>');
    if (seeingEf > o.dawes * 2 && o.M > 150) p.push(`Seeing ${c1(seeingEf)}″ je horší než rozlišení dalekohledu – větší zvětšení nepomůže.`);
    if (rozost > 1.5 * Math.max(seeingEf, o.dawes)) p.push('<span class="varovani">Obraz je rozostřený – použijte zaostřování.</span>');
    if (dal.vada === 'achromat' && o.M > 30) p.push('Achromát: kolem jasných objektů fialový lem (barevná vada).');
    if (dal.typ === 'galileo') p.push('Galileův dalekohled: jednoduchá čočka s velkou barevnou vadou a zorné pole jen čtvrt stupně.');
    if (r.filtr.id !== 'zadny') p.push(`Filtr ${r.filtr.n}: pozadí −${c1(r.filtr.pozadi)} mag, hvězdy −${c1(r.filtr.hvezdy)} mag, emisní mlhoviny −${c1(r.filtr.emisni)} mag.`);
    $('optikaPozn').innerHTML = p.join('<br>');
    $('vFokus').textContent = eps < 0.02 ? 'zaostřeno' : (S.fokus - S.fokusCil > 0 ? 'za ohniskem ' : 'před ohniskem ') + c1(eps, 2) + ' mm';
  }

  function vychodZapad(klic, fce, jd, h0) {
    if (vychodCache.klic === klic && Math.abs(vychodCache.jd - jd) < 0.02) return vychodCache.data;
    const data = D.prechody(fce, jd, h0);
    vychodCache = { klic, jd, data };
    return data;
  }
  function panelObjektu() {
    const r = ramec; if (!r) return;
    const el = $('infoObjekt');
    const id = S.cil || (posledni.nejblizsi && posledni.nejblizsi.id);
    $('objektStav').textContent = S.cil ? 'vybraný cíl' : id ? 've středu pole' : '';
    if (!id) { el.innerHTML = '<div class="info">Vyberte objekt v mapě, v plánovači nebo hledáním (Ctrl+K).</div>'; return; }
    const ob = K.objekt(id); if (!ob) return;
    const { jd, misto: m, prec, o } = r;
    const v = K.smer(id, jd, m);
    const rdD = D.raDec(D.mxv(prec, v)), rdJ = D.raDec(v);
    const obz = D.naObzor(v, jd, m, prec);
    const lst = A.gast(jd) + m.lon;
    let H = ((lst - rdD.ra) % 360 + 540) % 360 - 180;
    const souh = D.souhvezdi(v);
    let typ = '', h = '';
    const u = [];
    if (ob.druh === 'p') {
      const t = D.teleso(ob.klic, jd, m, prec);
      typ = ob.klic === 'mesic' ? 'Měsíc' : ob.klic === 'slunce' ? 'hvězda – Slunce' : 'planeta';
      u.push(radek('Jasnost', fmtMag(t.mag) + ' mag'));
      u.push(radek('Úhlový průměr', fmtUhel(2 * t.rUhel) + (t.zplosteni < 0.99 ? ` × ${fmtUhel(2 * t.rUhel * t.zplosteni)}` : '')));
      u.push(radek('Vzdálenost', ob.klic === 'mesic' ? Math.round(t.D * D.AU).toLocaleString('cs-CZ') + ' km' : c1(t.D, 3) + ' au · světlo ' + c1(t.D * 8.317, 1) + ' min'));
      if (ob.klic !== 'slunce') {
        u.push(radek('Fáze / fázový úhel', `${Math.round(t.k * 100)} % · ${c1(t.fazovyUhel)}°`));
        u.push(radek('Elongace od Slunce', c1(D.uhel(t.v, r.slunce.v)) + '° ' + (((D.raDec(t.v).ra - D.raDec(r.slunce.v).ra + 540) % 360 - 180) > 0 ? 'východně (večer)' : 'západně (ráno)')));
        if (t.povrchJas !== undefined) u.push(radek('Povrchový jas', c1(t.povrchJas) + ' mag/″²'));
      }
      if (t.P !== undefined && ob.klic !== 'mesic') u.push(radek('Poziční úhel osy / sklon', `${c1(t.P)}° / ${c1(t.De)}°`));
      if (ob.klic === 'saturn') u.push(radek('Sklon prstenců B', c1(t.B) + '°'));
      if (ob.klic === 'jupiter') {
        const cm2 = (360 - t.cm) % 360, cm1 = (cm2 + 7.6 * 0 + ((877.8169088 - 870.1869088) * (A.utNaJde(jd) - 2451545)) + 23.75) % 360;
        u.push(radek('Centrální poledník II / I', `${c1(cm2)}° / ${c1((cm1 + 360) % 360)}°`));
        const gr = D.pruchodyGRS(jd - 0.05, jd + 0.5, S.grs, m);
        if (gr.length) u.push(radek(`Rudá skvrna (λ ${S.grs}°) přejde`, gr.slice(0, 2).map(fmtCas).join(', ')));
        const ms = D.mesiceJupiteru(t);
        for (const x of ms) u.push(radek(x.jmeno, `${x.x > 0 ? 'Z' : 'V'} ${c1(Math.abs(x.x), 1)} R · ${fmtMag(x.mag)} mag${x.zakryt ? ' · za Jupiterem' : x.zatmeni ? ' · v zatmění' : x.prechod ? ' · přechod' : ''}${x.stin ? ' · stín na disku' : ''}`));
      }
      if (ob.klic === 'mars') u.push(radek('Centrální poledník', c1((360 - t.cm) % 360) + '° z. d.'));
      if (ob.klic === 'mesic') {
        const im = D.infoMesice(jd, m);
        u.push(radek('Stáří / kolongituda', `${c1(im.stari)} d / ${c1(im.kolongituda)}°`));
        u.push(radek('Librace (délka, šířka)', `${c1(im.librL)}°, ${c1(im.librB)}°`));
      }
      const vz = vychodZapad(id, j => D.teleso(ob.klic, j, m).obzor.alt, jd, ob.klic === 'mesic' ? 0.125 : ob.klic === 'slunce' ? -0.833 : -0.5667);
      u.push(radek('Východ · kulminace · západ', `${fmtCas(vz.vychod)} · ${fmtCas(vz.kulminace)} (${c1(vz.maxVyska, 0)}°) · ${fmtCas(vz.zapad)}`));
    } else if (ob.druh === 'd') {
      const x = ob.o;
      typ = (K.TYPY[x[3]] || x[3]) + (x[10] && x[10].startsWith('N:') ? ' · ' + x[10].slice(2) : '');
      if (x[10] === 'M' && x[9]) u.push(radek('Katalog', x[9]));
      u.push(radek('Jasnost', fmtMag(+x[4]) + ' mag'));
      u.push(radek('Rozměr', K.fmtRozmer(x)));
      if (['s', 'e', 'i', 'sd', 'gc', 'pn', 'sfr', 'rn', 'snr'].includes(x[3]) && x[4] < 90) {
        const vd = D.viditelnostDSO(x, o.M, r.sbOk, y => y + 5 * Math.log10(Math.max(1, S.zornice / o.pupila)), r.X - 1, r.filtr);
        u.push(radek('Povrchový jas', c1(vd.sb) + ' mag/″²'));
        u.push(radek('Viditelnost teď', vd.vis > 0.6 ? '<span class="ok">dobře</span>' : vd.vis > 0.15 ? '<span class="varovani">slabě</span>' : '<span class="chyba">neviditelný</span>'));
      }
      const vz = vychodZapad(id, j => D.naObzor(v, j, m).alt, jd, -0.5667);
      u.push(radek('Východ · kulminace · západ', `${fmtCas(vz.vychod)} · ${fmtCas(vz.kulminace)} (${c1(vz.maxVyska, 0)}°) · ${fmtCas(vz.zapad)}`));
    } else if (ob.druh === 'h') {
      const i = ob.i;
      typ = 'hvězda' + (DATA.PROMENNE[i] ? ' · proměnná ' + DATA.PROMENNE[i] : '');
      u.push(radek('Označení', [DATA.BAYER[i], 'HR ' + DATA.HR[i], DATA.HD[i] ? 'HD ' + DATA.HD[i] : ''].filter(Boolean).join(' · ')));
      if (DATA.JMENA_EN[i] && DATA.JMENA_EN[i] !== ob.nazev) u.push(radek('Mezinárodní jméno', DATA.JMENA_EN[i]));
      u.push(radek('Jasnost V / B−V', `${fmtMag(DATA.H[i * 4 + 2])} mag / ${c1(DATA.H[i * 4 + 3], 2)}`));
      const dv = DATA.DVOJHVEZDY.find(x => x[0] === i);
      if (dv) {
        u.push(radek('Dvojhvězda', dv[2].map(s => `${fmtMag(s[0])} mag, ${c1(s[2], 1)}″, PA ${s[3]}°`).join('; ')));
        const sep = Math.min(...dv[2].map(s => s[2]));
        const mez = Math.max(116 / r.dal.D, r.seeingEf);
        const zdanlive = sep * o.M / 60;
        let t;
        if (sep < 116 / r.dal.D * 0.9) t = '<span class="chyba">ne – pod rozlišovací mezí</span>';
        else if (sep < mez * 0.8) t = '<span class="varovani">ne – rozmazává seeing</span>';
        else if (zdanlive < 1.5) t = '<span class="varovani">zvyšte zvětšení</span>';
        else t = '<span class="ok">ano</span>' + (posledni.k * sep < 6 ? ' (zapněte lupu)' : '');
        u.push(radek('Rozlišitelná nyní', t));
      }
      const vz = vychodZapad(id, j => D.naObzor(v, j, m).alt, jd, -0.5667);
      u.push(radek('Východ · kulminace · západ', `${fmtCas(vz.vychod)} · ${fmtCas(vz.kulminace)} (${c1(vz.maxVyska, 0)}°) · ${fmtCas(vz.zapad)}`));
    } else typ = 'bod na obloze';
    h += `<div class="objekt-nazev">${ob.nazev}</div><div class="objekt-typ">${typ}${souh ? ' · ' + K.souhvezdiJmeno(souh) : ''}</div>`;
    const vzd = D.uhel(v, r.c);
    const p = [
      radek('Výška · azimut', obz.alt < -1 ? `<span class="chyba">${c1(obz.alt)}° (pod obzorem)</span> · ${c1(obz.az)}°` : `${c1(obz.alt)}° · ${c1(obz.az)}°`),
      radek('Vzdušná hmota', obz.alt > 0 ? c1(D.vzdusnaHmota(obz.alt), 2) : '–'),
      radek('α, δ (J2000)', `${K.fmtRa(rdJ.ra)} ${K.fmtDec(rdJ.dec)}`),
      radek('α, δ (datum)', `${K.fmtRa(rdD.ra)} ${K.fmtDec(rdD.dec)}`),
      radek('Hodinový úhel', (H < 0 ? '−' : '+') + K.fmtRa(Math.abs(H)).replace(/,\ds$/, 's')),
      radek('Od středu pole', fmtUhel(vzd * 3600)),
    ];
    el.innerHTML = h + '<div class="udaje">' + u.join('') + p.join('') + '</div>';
    $('btnDoSeznamu').textContent = S.seznam.includes(id) ? '★ V seznamu' : '☆ Do seznamu';
  }
  $('btnDoSeznamu').addEventListener('click', () => {
    const id = S.cil || (posledni && posledni.nejblizsi && posledni.nejblizsi.id);
    if (!id) return;
    if (S.seznam.includes(id)) S.seznam = S.seznam.filter(x => x !== id); else S.seznam.push(id);
    uloz(); infoCas = 0; prepocet();
  });

  /* ---------- záložky pracovního panelu ---------- */
  function otevriZalozku(p) {
    S.zalozka = p; uloz();
    for (const b of document.querySelectorAll('#zalozky button')) b.setAttribute('aria-selected', String(b.dataset.p === p));
    for (const el of document.querySelectorAll('.pracovni .panel')) el.hidden = el.id !== 'panel-' + p;
    for (const f of posluchaciZalozek) try { f(p); } catch (e) { console.error(e); }
  }
  const posluchaciZalozek = [];
  for (const b of document.querySelectorAll('#zalozky button')) b.addEventListener('click', () => otevriZalozku(b.dataset.p));

  /* ---------- sdílení a export ---------- */
  function odkaz() {
    const c = aktualniC(jdTed()), rd = D.raDec(c);
    const p = new URLSearchParams({
      t: A.dataZJd(jdTed()).toISOString().slice(0, 16), lat: S.lat, lon: S.lon, ra: rd.ra.toFixed(4), dec: rd.dec.toFixed(4),
      dal: S.dal, ok: S.okular, b: S.barlow, f: S.filtr, sd: S.sledovani ? 1 : 0,
    });
    if (S.cil) p.set('cil', S.cil);
    if (S.rezim === 'kamera') { p.set('kam', S.kamera); p.set('exp', S.expozice); }
    return location.origin + location.pathname + '#' + p.toString();
  }
  $('btnSdilet').addEventListener('click', async () => {
    const u = odkaz();
    try { await navigator.clipboard.writeText(u); zprava('Odkaz na tento pohled je ve schránce.'); }
    catch (e) { history.replaceState(null, '', u); zprava('Odkaz je v adresním řádku – zkopírujte ho.'); }
  });
  $('btnSnimek').addEventListener('click', () => {
    cv.toBlob(b => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = 'okular-' + A.dataZJd(jdTed()).toISOString().slice(0, 16).replace(/[:T]/g, '-') + '.png';
      a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    });
  });
  function nactiOdkaz() {
    if (!location.hash || location.hash.length < 5) return false;
    const p = new URLSearchParams(location.hash.slice(1));
    if (!p.get('ra')) return false;
    if (p.get('t')) { const d = new Date(p.get('t') + 'Z'); if (!isNaN(d)) { jd0 = A.jdZData(d); t0 = performance.now(); } }
    if (p.get('lat')) { S.lat = +p.get('lat'); S.lon = +p.get('lon'); S.misto = MISTA.length - 1; }
    if (p.get('dal')) S.dal = p.get('dal');
    if (p.get('ok')) S.okular = p.get('ok');
    if (p.get('b')) S.barlow = p.get('b');
    if (p.get('f')) S.filtr = p.get('f');
    S.sledovani = p.get('sd') === '1';
    if (p.get('kam')) { S.rezim = 'kamera'; S.kamera = p.get('kam'); S.expozice = +p.get('exp') || 30; } else S.rezim = 'okular';
    S.cil = p.get('cil') || null;
    const v = D.v3(+p.get('ra'), +p.get('dec'));
    cJ2000 = v;
    const o = D.naObzor(v, jdTed(), misto()); smer = { alt: o.alt, az: o.az };
    S.rychlost = 0;
    return true;
  }

  /* ---------- start ---------- */
  const zOdkazu = nactiOdkaz();
  nahodnyFokus(); S.fokus = S.fokusCil;
  doFormulare();
  if (!zOdkazu) (function vychoziCil() {
    let jd = jdTed();
    const m = misto();
    const hSl = j => D.teleso('slunce', j, m).obzor.alt;
    if (hSl(jd) > -12) {
      let j = jd;
      for (let i = 0; i < 24 * 6 && hSl(j) > -12; i++) j += 1 / 144;
      if (hSl(j) <= -12) {
        jd0 = j + 1 / 48; t0 = performance.now();
        jd = jdTed();
        setTimeout(() => zprava('Teď je světlo, simulace proto začíná dnešní nocí v ' + fmtCas(jd) + '. Tlačítko „Teď“ vrátí skutečný čas.'), 50);
      }
    }
    if (S.cil && K.objekt(S.cil) && D.naObzor(K.smer(S.cil, jd, m), jd, m).alt > 5) { vyber(S.cil, true); return; }
    const sl = D.teleso('slunce', jd, m);
    const kand = D.KLICE_TELES.map(k => D.teleso(k, jd, m)).filter(t => t.obzor.alt > 12 && D.uhel(t.v, sl.v) > 25).sort((a, b) => a.mag - b.mag);
    const v = kand.find(t => t.klic !== 'mesic') || kand[0];
    if (v) vyber('p:' + v.klic, true); else namir(D.zObzoru(40, 180, jd, m));
  })();
  otevriZalozku(S.zalozka || 'planovac');
  for (const k of ['jupiter', 'saturn', 'mars', 'venuse', 'merkur', 'mesic']) window.DALEK_TELESA.nactiTexturu(k, 'dalekohled/tex/' + k + '.jpg');
  requestAnimationFrame(snimek);

  window.DALEK_APP = window.DALEK_UI = {
    S, MISTA, uloz, jdTed, nastavJd, misto, dalekohled, okular, barlowK, fotoRezim, namir, vyber, zprava, prepocet,
    posunObrazem, smer: () => smer, prepniSledovani, posledni: () => posledni, ramec: () => ramec, doFormulare, zmenaDalekohledu,
    naZmenu: f => posluchaci.push(f), naCil: f => posluchaciCile.push(f), naZalozku: f => posluchaciZalozek.push(f),
    otevriZalozku, fmtCas, fmtDatumCas, c1, radek, odkaz, mapaOb, aktualniC, naplnVybavu,
  };
})();

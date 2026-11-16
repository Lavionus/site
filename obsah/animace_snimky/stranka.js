/* ============================================================
   animace_snimky/stranka.js – rozhraní stránky „Animace snímek po snímku“.
   Snímek = { id, drzeni, pozadi: V, kresba: V, podklad: V|null },
   vrstva V = { c: canvas, blob: PNG pro IndexedDB (null = změněno), ver }.
   Logika časové osy, slupky, výplně a sprite sheetu je v jadro.js (ANIMSN),
   kodér GIF a ZIP ze stránky animace_gif (ANIMACE_GIF + její worker).
   ============================================================ */
(function () {
  'use strict';
  const J = window.ANIMSN, A = window.ANIMACE_GIF;
  const $ = id => document.getElementById(id);
  const LS = 'webapp_animace_snimky_nastaveni', LS_POSL = 'webapp_animace_snimky_posledni';
  const DB_JMENO = 'webapp_animace_snimky', DB_STORE = 'projekty';
  const PALETA = ['#222222', '#ffffff', '#7a7a7a', '#e0303a', '#f08a24', '#f5d33b', '#3fa34d', '#2a9bd8', '#2f4fd0', '#8a3fc4', '#e46aa6', '#8b5a2b', '#f2c9a0'];
  if (window.top === window.self) document.body.classList.add('samostatne');

  // ---------- nastavení (localStorage) ----------
  const N = Object.assign({
    nastroj: 'stetec', barva: '#222222', velikost: 6, kryti: 100, tlakRezim: 'sirka', tlakMin: 15, vyhlazeni: 30, jenPero: false,
    tolerance: 32, rozsireni: 1, cibule: true, cibPred: 2, cibZa: 1, cibKryti: 35, cibBarvaPred: '#e0303a', cibBarvaZa: '#2a8f3c',
    cibBarevne: true, cibSmycka: false, podkladKryti: 40, vzorky: [],
  }, (() => { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch { return {}; } })());
  const ulozN = () => { try { localStorage.setItem(LS, JSON.stringify(N)); } catch { /* plné nebo zakázané úložiště */ } };

  // ---------- projekt ----------
  let P = J.normProjekt({});
  let snimky = [], pozadiSdil = null, akt = 0, aktVrstva = 'kresba', projektId = null;
  const vid = { kresba: true, pozadi: true, podklad: true };
  const hist = new J.Historie(80);
  const novyId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  function platno(w, h) { const c = document.createElement('canvas'); c.width = w || P.sirka; c.height = h || P.vyska; return c; }
  const novaV = () => ({ c: platno(), blob: null, ver: 0 });
  const novySnimek = () => ({ id: novyId(), drzeni: 1, pozadi: novaV(), kresba: novaV(), podklad: null });
  const vrstvaPozadi = s => P.pozadiSdilene && pozadiSdil ? pozadiSdil : s.pozadi;
  const vrstva = (s, jm) => jm === 'pozadi' ? vrstvaPozadi(s) : s.kresba;
  const aktSn = () => snimky[akt];
  const aktV = () => vrstva(aktSn(), aktVrstva);
  function kopie(c) { const k = platno(c.width, c.height); k.getContext('2d').drawImage(c, 0, 0); return k; }
  const cislo = (x, d) => x.toFixed(d).replace('.', ',');

  // ---------- zobrazení ----------
  const pl = $('platno'), ctx = pl.getContext('2d'), obal = $('platnoObal');
  let zoom = 1, kurzor = null, tah = null, vyber = null, schranka = null, akce = null;
  let cibC = null, cibNeplatna = true, prehrava = false, hrajeIdx = 0, planVykresleni = false;

  function vykresliBrzy() { if (!planVykresleni) { planVykresleni = true; requestAnimationFrame(vykresli); } }
  function cibuleCanvas() {
    if (!cibNeplatna && cibC) return cibC;
    if (!cibC || cibC.width !== P.sirka || cibC.height !== P.vyska) cibC = platno();
    const c = cibC.getContext('2d');
    c.clearRect(0, 0, P.sirka, P.vyska);
    const tmp = platno(), t = tmp.getContext('2d');
    for (const e of J.cibule(akt, snimky.length, { pred: N.cibPred, za: N.cibZa, kryti: N.cibKryti / 100, smycka: N.cibSmycka })) {
      const k = snimky[e.index].kresba.c;
      c.globalAlpha = e.alfa;
      if (N.cibBarevne) {
        t.globalCompositeOperation = 'source-over'; t.clearRect(0, 0, P.sirka, P.vyska); t.drawImage(k, 0, 0);
        t.globalCompositeOperation = 'source-in'; t.fillStyle = e.smer < 0 ? N.cibBarvaPred : N.cibBarvaZa; t.fillRect(0, 0, P.sirka, P.vyska);
        c.drawImage(tmp, 0, 0);
      } else c.drawImage(k, 0, 0);
    }
    c.globalAlpha = 1;
    cibNeplatna = false;
    return cibC;
  }
  function vykresli() {
    planVykresleni = false;
    if (!snimky.length) return;
    ctx.clearRect(0, 0, P.sirka, P.vyska);
    if (!P.pruhledne) { ctx.fillStyle = P.barvaPozadi; ctx.fillRect(0, 0, P.sirka, P.vyska); }
    if (prehrava) {
      const s = snimky[hrajeIdx];
      if (vid.pozadi) ctx.drawImage(vrstvaPozadi(s).c, 0, 0);
      if (vid.kresba) ctx.drawImage(s.kresba.c, 0, 0);
      return;
    }
    const s = aktSn();
    if (vid.podklad && s.podklad) { ctx.globalAlpha = N.podkladKryti / 100; ctx.drawImage(s.podklad.c, 0, 0); ctx.globalAlpha = 1; }
    for (const jm of ['pozadi', 'kresba']) {
      if (jm === 'kresba' && N.cibule && snimky.length > 1) ctx.drawImage(cibuleCanvas(), 0, 0);
      if (!vid[jm]) continue;
      ctx.drawImage(vrstva(s, jm).c, 0, 0);
      if (jm !== aktVrstva) continue;
      if (tah) { ctx.globalAlpha = tah.alfa; ctx.drawImage(tah.c, 0, 0); ctx.globalAlpha = 1; }
      if (vyber && vyber.plovouci) ctx.drawImage(vyber.plovouci, vyber.r.x, vyber.r.y);
    }
    const lw = 1 / zoom;
    if (vyber) {
      ctx.save(); ctx.lineWidth = lw; ctx.setLineDash([4 * lw, 4 * lw]);
      ctx.strokeStyle = '#000'; ctx.strokeRect(vyber.r.x, vyber.r.y, vyber.r.w, vyber.r.h);
      ctx.strokeStyle = '#fff'; ctx.lineDashOffset = 4 * lw; ctx.strokeRect(vyber.r.x, vyber.r.y, vyber.r.w, vyber.r.h);
      ctx.restore();
    }
    if (kurzor && !akce && (N.nastroj === 'stetec' || N.nastroj === 'guma')) {
      const r = Math.max(N.velikost / 2, 1.5 * lw);
      ctx.save(); ctx.beginPath(); ctx.arc(kurzor.x, kurzor.y, r, 0, Math.PI * 2);
      ctx.lineWidth = 2 * lw; ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.stroke();
      ctx.lineWidth = lw; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.stroke(); ctx.restore();
    }
  }

  function nastavZoom(z, kotva) {
    const stary = zoom;
    zoom = Math.min(32, Math.max(0.05, z));
    pl.style.width = P.sirka * zoom + 'px'; pl.style.height = P.vyska * zoom + 'px';
    pl.classList.toggle('pixel', zoom >= 2);
    $('stavZoom').textContent = Math.round(zoom * 100) + ' %';
    if (kotva) {   // bod pod kurzorem zůstane na místě
      const k = zoom / stary;
      obal.scrollLeft = (obal.scrollLeft + kotva.x) * k - kotva.x;
      obal.scrollTop = (obal.scrollTop + kotva.y) * k - kotva.y;
    }
    vykresliBrzy();
  }
  function zoomFit() {
    const w = obal.clientWidth - 34, h = obal.clientHeight - 34;
    nastavZoom(Math.max(0.05, Math.min(w / P.sirka, h / P.vyska, P.sirka <= 256 ? 16 : 1)));
  }

  // ---------- časová osa ----------
  const osa = $('osa');
  let planMini = new Set(), casMini = null;
  function miniatura(s, c) {
    const t = c.getContext('2d');
    t.clearRect(0, 0, c.width, c.height);
    t.fillStyle = P.pruhledne ? '#ffffff' : P.barvaPozadi; t.fillRect(0, 0, c.width, c.height);
    t.imageSmoothingQuality = 'medium';
    t.drawImage(vrstvaPozadi(s).c, 0, 0, c.width, c.height);
    t.drawImage(s.kresba.c, 0, 0, c.width, c.height);
  }
  function vykresliOsu() {
    osa.innerHTML = '';
    const vys = 54, sir = Math.max(30, Math.min(130, Math.round(vys * P.sirka / P.vyska)));
    snimky.forEach((s, i) => {
      const el = document.createElement('div');
      el.className = 'snimek'; el.draggable = true; el.dataset.i = i;
      const c = document.createElement('canvas'); c.width = sir * 2; c.height = vys * 2; c.style.width = sir + 'px';
      const cis = document.createElement('span'); cis.className = 'cislo'; cis.textContent = i + 1;
      const d = document.createElement('label'); d.className = 'drz'; d.title = 'Držení – kolik snímků FPS obrázek trvá';
      d.innerHTML = '⏱<input type="number" class="vstup" min="1" max="99">';
      d.querySelector('input').value = s.drzeni;
      el.append(c, cis, d);
      osa.appendChild(el);
      miniatura(s, c);
    });
    const plus = document.createElement('button');
    plus.className = 'snimek pridat'; plus.dataset.prikaz = 'pridat'; plus.title = 'Nový prázdný snímek na konec'; plus.textContent = '+';
    plus.dataset.konec = '1';
    osa.appendChild(plus);
    oznacAkt();
  }
  function obnovMiniatury(v) {
    snimky.forEach((s, i) => { if (!v || s.kresba === v || vrstvaPozadi(s) === v || s.podklad === v) planMini.add(i); });
    clearTimeout(casMini);
    casMini = setTimeout(() => {
      for (const i of planMini) { const el = osa.children[i]; if (el && snimky[i]) miniatura(snimky[i], el.querySelector('canvas')); }
      planMini.clear();
    }, 120);
  }
  function oznacAkt() {
    [...osa.children].forEach((el, i) => el.classList.toggle('aktualni', i === akt));
    const cel = J.casovaOsa(snimky.map(s => s.drzeni), P.fps), pol = cel.polozky[akt];
    $('osaInfo').textContent = `Snímek ${akt + 1}/${snimky.length} · ${cislo(pol.start / 1000, 2)} s · celkem ${cislo(cel.celkem / 1000, 2)} s`;
    const el = osa.children[akt];
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  function nastavAkt(i) {
    if (!snimky.length) return;
    potvrdVyber();
    akt = Math.max(0, Math.min(snimky.length - 1, i));
    cibNeplatna = true;
    oznacAkt(); vykresliBrzy();
  }

  // ---------- historie ----------
  function aktualizujTlacitka() {
    $('tlZpet').disabled = !hist.lzeZpet(); $('tlZnovu').disabled = !hist.lzeZnovu();
  }
  function zmenaVrstvy(v) {
    v.blob = null; v.ver++;
    obnovMiniatury(v); planujUlozeni(); aktualizujTlacitka(); vykresliBrzy();
  }
  function zaznamPx(v, predC, rect, snimekId) {
    const r = J.orizni(rect, P.sirka, P.vyska);
    if (!r) return;
    const pred = predC.getContext('2d').getImageData(r.x, r.y, r.w, r.h);
    const po = v.c.getContext('2d').getImageData(r.x, r.y, r.w, r.h);
    const id = snimekId || aktSn().id, s = snimky.find(x => x.id === id);
    hist.zaznam({ typ: 'px', v, r, pred, po, snimekId: id, vrstva: s && s.kresba === v ? 'kresba' : 'pozadi' });
    zmenaVrstvy(v);
  }
  const stavStruktury = () => ({ seznam: snimky.map(s => ({ s, d: s.drzeni })), akt });
  function zmenStrukturu(fn) {
    potvrdVyber();
    const pred = stavStruktury();
    fn();
    hist.zaznam({ typ: 'str', pred, po: stavStruktury() });
    poStrukture();
  }
  function obnovStrukturu(st) {
    snimky = st.seznam.map(x => { x.s.drzeni = x.d; return x.s; });
    akt = Math.min(st.akt, snimky.length - 1);
    poStrukture();
  }
  function poStrukture() { cibNeplatna = true; vykresliOsu(); planujUlozeni(); vykresliBrzy(); aktualizujTlacitka(); }
  function vratZaznam(z, zpet) {
    if (z.typ === 'str') return obnovStrukturu(zpet ? z.pred : z.po);
    z.v.c.getContext('2d').putImageData(zpet ? z.pred : z.po, z.r.x, z.r.y);
    const i = snimky.findIndex(s => s.id === z.snimekId);
    if (i >= 0 && i !== akt) { akt = i; oznacAkt(); }
    if (z.vrstva !== aktVrstva) nastavVrstvu(z.vrstva);
    cibNeplatna = true;
    zmenaVrstvy(z.v);
  }
  function zpet() { if (akce) return; potvrdVyber(); const z = hist.zpet(); if (z) vratZaznam(z, true); aktualizujTlacitka(); }
  function znovu() { if (akce) return; potvrdVyber(); const z = hist.znovu(); if (z) vratZaznam(z, false); aktualizujTlacitka(); }

  // ---------- operace se snímky ----------
  const pridatSnimek = (konec) => zmenStrukturu(() => { const i = konec ? snimky.length : akt + 1; snimky.splice(i, 0, novySnimek()); akt = i; });
  function duplikovat() {
    zmenStrukturu(() => {
      const s = aktSn(), n = novySnimek();
      n.drzeni = s.drzeni;
      n.kresba.c.getContext('2d').drawImage(s.kresba.c, 0, 0);
      n.pozadi.c.getContext('2d').drawImage(s.pozadi.c, 0, 0);
      if (s.podklad) n.podklad = { c: kopie(s.podklad.c), blob: s.podklad.blob, ver: 0 };
      snimky.splice(akt + 1, 0, n); akt++;
    });
  }
  function smazat() {
    zmenStrukturu(() => {
      if (snimky.length === 1) { snimky = [novySnimek()]; akt = 0; Dialog.info('Poslední snímek nahrazen prázdným.'); return; }
      snimky.splice(akt, 1); akt = Math.min(akt, snimky.length - 1);
    });
  }
  const posun = d => { const k = akt + d; if (k < 0 || k >= snimky.length) return; zmenStrukturu(() => { snimky = J.presun(snimky, akt, k); akt = k; }); };
  const obratit = () => zmenStrukturu(() => { snimky.reverse(); akt = snimky.length - 1 - akt; });
  async function drzeniVse() {
    const t = await Dialog.zeptej('Držení všech snímků (1–99 snímků FPS):', String(aktSn().drzeni));
    if (t === null) return;
    const d = Math.round(Number(t));
    if (!(d >= 1 && d <= 99)) return Dialog.chyba('Zadejte celé číslo 1–99.');
    zmenStrukturu(() => snimky.forEach(s => { s.drzeni = d; }));
  }

  // ---------- kreslení ----------
  function bod(e) {
    const r = pl.getBoundingClientRect();
    return { x: (e.clientX - r.left) * P.sirka / r.width, y: (e.clientY - r.top) * P.vyska / r.height };
  }
  const tlak = e => e.pointerType === 'pen' ? (e.pressure > 0 ? e.pressure : 0.5) : 1;
  function segment(a, b, t) {
    const c = (akce.guma ? akce.v.c : tah.c).getContext('2d');
    const w = J.sirkaTahu(N.velikost, t, N.tlakRezim, N.tlakMin / 100);
    c.save();
    if (akce.guma) c.globalCompositeOperation = 'destination-out';
    c.strokeStyle = N.barva; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x + (a.x === b.x && a.y === b.y ? 0.01 : 0), b.y); c.stroke();
    c.restore();
    akce.rect = J.sjednot(akce.rect, { x: Math.min(a.x, b.x) - w / 2 - 2, y: Math.min(a.y, b.y) - w / 2 - 2, w: Math.abs(b.x - a.x) + w + 4, h: Math.abs(b.y - a.y) + w + 4 });
  }
  function zacniTah(e, b, guma) {
    const v = aktV();
    akce = { typ: 'tah', id: e.pointerId, guma, v, pred: kopie(v.c), rect: null, posl: b, hl: b, t: tlak(e), snimekId: aktSn().id };
    if (!guma) tah = { c: platno(), alfa: N.kryti / 100 };
    segment(b, b, akce.t);
  }
  function pokracujTah(e) {
    const evs = (e.getCoalescedEvents && e.getCoalescedEvents()) || [];
    const k = N.vyhlazeni / 100;
    for (const ev of evs.length ? evs : [e]) {
      const b = bod(ev), t = tlak(ev);
      const hl = { x: akce.hl.x + (b.x - akce.hl.x) * (1 - k), y: akce.hl.y + (b.y - akce.hl.y) * (1 - k) };
      segment(akce.hl, hl, (akce.t + t) / 2);
      akce.hl = hl; akce.t = t; akce.posl = b;
    }
  }
  function dokonciTah() {
    const a = akce; akce = null;
    if (Math.hypot(a.posl.x - a.hl.x, a.posl.y - a.hl.y) > 0.5) { akce = a; segment(a.hl, a.posl, a.t); akce = null; }
    if (!a.guma) {
      const c = a.v.c.getContext('2d');
      c.globalAlpha = tah.alfa; c.drawImage(tah.c, 0, 0); c.globalAlpha = 1;
      tah = null;
      if (!PALETA.includes(N.barva) && N.vzorky[0] !== N.barva) { N.vzorky = [N.barva, ...N.vzorky.filter(x => x !== N.barva)].slice(0, 8); kresliVzorky(); ulozN(); }
    }
    zaznamPx(a.v, a.pred, a.rect, a.snimekId);
  }
  function zrusAkci() {
    if (!akce) return;
    if (akce.typ === 'tah') {
      if (akce.guma) { const c = akce.v.c.getContext('2d'); c.clearRect(0, 0, P.sirka, P.vyska); c.drawImage(akce.pred, 0, 0); }
      tah = null;
    }
    akce = null; vykresliBrzy();
  }
  function slozeno(s) {
    const c = platno(), t = c.getContext('2d');
    if (vid.pozadi) t.drawImage(vrstvaPozadi(s).c, 0, 0);
    if (vid.kresba) t.drawImage(s.kresba.c, 0, 0);
    return c;
  }
  function vyplnit(b) {
    const v = aktV(), W = P.sirka, H = P.vyska;
    const vzor = slozeno(aktSn()).getContext('2d').getImageData(0, 0, W, H).data;
    const vc = v.c.getContext('2d'), img = vc.getImageData(0, 0, W, H), pred = kopie(v.c);
    const r = J.vypln(vzor, img.data, W, H, b.x, b.y, J.hexNaRgba(N.barva, N.kryti / 100), N.tolerance, N.rozsireni);
    if (!r) return;
    vc.putImageData(img, 0, 0);
    zaznamPx(v, pred, r);
  }
  function kapatko(b) {
    const x = Math.floor(b.x), y = Math.floor(b.y);
    if (x < 0 || y < 0 || x >= P.sirka || y >= P.vyska) return;
    const c = platno(1, 1), t = c.getContext('2d');
    if (!P.pruhledne) { t.fillStyle = P.barvaPozadi; t.fillRect(0, 0, 1, 1); }
    t.drawImage(slozeno(aktSn()), -x, -y);
    const d = t.getImageData(0, 0, 1, 1).data;
    if (d[3] === 0) return;
    nastavBarvu(J.rgbNaHex(d[0], d[1], d[2]));
  }

  // ---------- výběr ----------
  function zvedni() {
    if (!vyber || vyber.plovouci) return;
    const v = aktV(), r = vyber.r;
    vyber.v = v; vyber.pred = kopie(v.c); vyber.puvodni = Object.assign({}, r); vyber.snimekId = aktSn().id;
    vyber.plovouci = platno(r.w, r.h);
    vyber.plovouci.getContext('2d').drawImage(v.c, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
    v.c.getContext('2d').clearRect(r.x, r.y, r.w, r.h);
  }
  function potvrdVyber() {
    if (!vyber) return;
    const v = vyber;
    vyber = null;
    if (v.plovouci) {
      v.v.c.getContext('2d').drawImage(v.plovouci, v.r.x, v.r.y);
      zaznamPx(v.v, v.pred, J.sjednot(v.puvodni, v.r), v.snimekId);
    }
    vykresliBrzy();
  }
  function kopirovat() {
    if (!vyber) return Dialog.info('Nejdřív něco vyberte nástrojem Výběr (M) nebo Ctrl+A.');
    const r = vyber.r, c = platno(r.w, r.h);
    c.getContext('2d').drawImage(vyber.plovouci || aktV().c, ...(vyber.plovouci ? [0, 0] : [r.x, r.y, r.w, r.h, 0, 0, r.w, r.h]));
    schranka = { c, x: r.x, y: r.y };
  }
  function smazatVyber() {
    if (!vyber) return;
    if (vyber.plovouci) { vyber.plovouci.getContext('2d').clearRect(0, 0, vyber.r.w, vyber.r.h); potvrdVyber(); return; }
    const v = aktV(), pred = kopie(v.c);
    v.c.getContext('2d').clearRect(vyber.r.x, vyber.r.y, vyber.r.w, vyber.r.h);
    zaznamPx(v, pred, vyber.r);
  }
  function vlozit() {
    if (!schranka) return Dialog.info('Schránka je prázdná – nejdřív zkopírujte výběr (Ctrl+C).');
    potvrdVyber();
    const v = aktV(), r = { x: schranka.x, y: schranka.y, w: schranka.c.width, h: schranka.c.height };
    vyber = { r, v, pred: kopie(v.c), puvodni: Object.assign({}, r), plovouci: kopie(schranka.c), snimekId: aktSn().id };
    nastavNastroj('vyber', true);
    vykresliBrzy();
  }
  function zrcadlitVyber() {
    if (!vyber) return;
    zvedni();
    const c = platno(vyber.r.w, vyber.r.h), t = c.getContext('2d');
    t.translate(c.width, 0); t.scale(-1, 1); t.drawImage(vyber.plovouci, 0, 0);
    vyber.plovouci = c; vykresliBrzy();
  }
  const vUvnitr = (b, r) => b.x >= r.x && b.y >= r.y && b.x < r.x + r.w && b.y < r.y + r.h;

  // ---------- ukazatel (myš, pero, dotyk) ----------
  const ukazatele = new Map();
  let videnoPero = false;
  function stredDotyku() { let x = 0, y = 0; for (const u of ukazatele.values()) { x += u.x; y += u.y; } return { x: x / ukazatele.size, y: y / ukazatele.size }; }
  function zacniPosun(id) { const s = stredDotyku(); akce = { typ: 'pan', id, sx: s.x, sy: s.y, sl: obal.scrollLeft, st: obal.scrollTop }; }
  pl.addEventListener('pointerdown', e => {
    if (prehrava) prehrat(false);
    zavriNabidky();
    if (e.pointerType === 'pen') videnoPero = true;
    ukazatele.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (e.pointerType === 'touch' && ukazatele.size === 2) { zrusAkci(); zacniPosun(e.pointerId); return; }
    if (akce || e.button === 2) return;
    e.preventDefault();
    try { pl.setPointerCapture(e.pointerId); } catch { /* nic */ }
    const jenPosun = e.button === 1 || (e.pointerType === 'touch' && N.jenPero && videnoPero);
    let n = jenPosun ? 'ruka' : N.nastroj;
    if (e.altKey && (n === 'stetec' || n === 'vypln')) n = 'kapatko';
    const b = bod(e);
    if (n === 'ruka') return zacniPosun(e.pointerId);
    if (n === 'kapatko') { kapatko(b); akce = { typ: 'kapatko', id: e.pointerId }; return; }
    if (n === 'vypln') return vyplnit(b);
    if (n === 'stetec' || n === 'guma') { potvrdVyber(); zacniTah(e, b, n === 'guma'); vykresliBrzy(); return; }
    if (n === 'vyber') {
      if (vyber && vUvnitr(b, vyber.r)) { zvedni(); akce = { typ: 'posunVyberu', id: e.pointerId, b0: b, r0: Object.assign({}, vyber.r) }; }
      else { potvrdVyber(); akce = { typ: 'novyVyber', id: e.pointerId, b0: b }; }
      vykresliBrzy();
    }
  });
  pl.addEventListener('pointermove', e => {
    if (ukazatele.has(e.pointerId)) ukazatele.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const b = bod(e);
    kurzor = e.pointerType === 'touch' ? null : b;
    $('stavPozice').textContent = `${Math.floor(b.x)}, ${Math.floor(b.y)} px`;
    if (!akce) { if (N.nastroj === 'stetec' || N.nastroj === 'guma') vykresliBrzy(); return; }
    if (akce.typ === 'pan') {
      const s = stredDotyku();
      obal.scrollLeft = akce.sl - (s.x - akce.sx); obal.scrollTop = akce.st - (s.y - akce.sy);
      return;
    }
    if (e.pointerId !== akce.id) return;
    if (akce.typ === 'tah') pokracujTah(e);
    else if (akce.typ === 'kapatko') kapatko(b);
    else if (akce.typ === 'novyVyber') vyber = { r: J.obdelnik(Math.round(akce.b0.x), Math.round(akce.b0.y), Math.round(b.x), Math.round(b.y)) };
    else if (akce.typ === 'posunVyberu') { vyber.r.x = akce.r0.x + Math.round(b.x - akce.b0.x); vyber.r.y = akce.r0.y + Math.round(b.y - akce.b0.y); }
    vykresliBrzy();
  });
  function konecUkazatele(e) {
    ukazatele.delete(e.pointerId);
    if (!akce) return;
    if (akce.typ === 'pan') { if (!ukazatele.size) akce = null; else if (ukazatele.size === 1) zacniPosun(akce.id); return; }
    if (e.pointerId !== akce.id) return;
    if (e.type === 'pointercancel' && akce.typ === 'tah') return zrusAkci();
    if (akce.typ === 'tah') dokonciTah();
    else if (akce.typ === 'novyVyber') {
      akce = null;
      vyber = vyber && J.orizni(vyber.r, P.sirka, P.vyska) ? { r: J.orizni(vyber.r, P.sirka, P.vyska) } : null;
    } else akce = null;
    vykresliBrzy();
  }
  pl.addEventListener('pointerup', konecUkazatele);
  pl.addEventListener('pointercancel', konecUkazatele);
  pl.addEventListener('pointerleave', () => { kurzor = null; vykresliBrzy(); });
  pl.addEventListener('contextmenu', e => e.preventDefault());
  obal.addEventListener('wheel', e => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const r = obal.getBoundingClientRect();
    nastavZoom(zoom * Math.pow(1.0015, -e.deltaY), { x: e.clientX - r.left, y: e.clientY - r.top });
  }, { passive: false });

  // ---------- nástroje a panel ----------
  const NAZVY_NASTROJU = { stetec: 'Štětec', guma: 'Guma', vypln: 'Výplň', vyber: 'Výběr a posun', kapatko: 'Kapátko', ruka: 'Posun pohledu' };
  function nastavNastroj(n, bezPotvrzeni) {
    if (!NAZVY_NASTROJU[n]) n = 'stetec';
    if (n !== 'vyber' && !bezPotvrzeni) potvrdVyber();
    N.nastroj = n; ulozN();
    document.querySelectorAll('[data-nastroj]').forEach(b => b.setAttribute('aria-pressed', b.dataset.nastroj === n));
    document.querySelectorAll('.panel [data-pro]').forEach(el => { el.hidden = !el.dataset.pro.split(' ').includes(n); });
    $('nadpisStetec').textContent = n === 'guma' ? 'Guma' : 'Štětec';
    $('stavNastroj').textContent = NAZVY_NASTROJU[n] + ' · ' + (aktVrstva === 'kresba' ? 'vrstva Kresba' : 'vrstva Pozadí');
    pl.classList.toggle('ruka', n === 'ruka');
    vykresliBrzy();
  }
  function nastavVrstvu(jm) {
    potvrdVyber();
    aktVrstva = jm;
    document.querySelectorAll('.vrstva').forEach(el => el.classList.toggle('aktivni', el.dataset.vrstva === jm));
    nastavNastroj(N.nastroj);
  }
  function nastavBarvu(h) { N.barva = h; $('barva').value = h; ulozN(); }
  function kresliVzorky() {
    const el = $('vzorky');
    el.innerHTML = '';
    for (const b of [...PALETA, ...N.vzorky]) {
      const t = document.createElement('button');
      t.style.background = b; t.title = b; t.setAttribute('aria-label', 'Barva ' + b);
      t.addEventListener('click', () => nastavBarvu(b));
      el.appendChild(t);
    }
  }
  const POSUVNIKY = [
    ['velikost', 'velikostHodn', v => v + ' px'], ['kryti', 'krytiHodn', v => v + ' %'], ['tlakMin', 'tlakMinHodn', v => v + ' %'],
    ['vyhlazeni', 'vyhlazHodn', v => v + ' %'], ['tolerance', 'tolHodn', v => v], ['rozsireni', 'rozHodn', v => v + ' px'],
    ['cibKryti', 'cibKrytiHodn', v => v + ' %'], ['podkladKryti', 'podkladHodn', v => v + ' %'],
  ];
  function napojPanel() {
    for (const [id, hodn, f] of POSUVNIKY) {
      const el = $(id);
      el.value = N[id]; $(hodn).textContent = f(N[id]);
      el.addEventListener('input', () => { N[id] = +el.value; $(hodn).textContent = f(N[id]); ulozN(); cibNeplatna = true; vykresliBrzy(); });
    }
    for (const id of ['cibPred', 'cibZa']) {
      $(id).value = N[id];
      $(id).addEventListener('change', () => { N[id] = Math.max(0, Math.min(10, Math.round(+$(id).value) || 0)); $(id).value = N[id]; ulozN(); cibNeplatna = true; vykresliBrzy(); });
    }
    for (const id of ['cibBarvaPred', 'cibBarvaZa']) { $(id).value = N[id]; $(id).addEventListener('input', () => { N[id] = $(id).value; ulozN(); cibNeplatna = true; vykresliBrzy(); }); }
    for (const id of ['cibBarevne', 'cibSmycka', 'jenPero']) { $(id).checked = N[id]; $(id).addEventListener('change', () => { N[id] = $(id).checked; ulozN(); cibNeplatna = true; vykresliBrzy(); }); }
    $('tlakRezim').value = N.tlakRezim;
    $('tlakRezim').addEventListener('change', () => { N.tlakRezim = $('tlakRezim').value; ulozN(); });
    $('barva').value = N.barva;
    $('barva').addEventListener('input', () => nastavBarvu($('barva').value));
    document.querySelectorAll('[data-nastroj]').forEach(b => b.addEventListener('click', () => nastavNastroj(b.dataset.nastroj)));
    document.querySelectorAll('.vrstva').forEach(el => el.addEventListener('click', e => { if (e.target.tagName !== 'INPUT') nastavVrstvu(el.dataset.vrstva); }));
    for (const [id, jm] of [['vidKresba', 'kresba'], ['vidPozadi', 'pozadi'], ['vidPodklad', 'podklad']]) $(id).addEventListener('change', () => { vid[jm] = $(id).checked; vykresliBrzy(); });
    $('pozadiSdilene').addEventListener('change', async () => {
      const zap = $('pozadiSdilene').checked;
      potvrdVyber();
      if (zap && !pozadiSdil) { pozadiSdil = novaV(); pozadiSdil.c.getContext('2d').drawImage(aktSn().pozadi.c, 0, 0); }
      P.pozadiSdilene = zap;
      hist.vymaz(); aktualizujTlacitka();
      Dialog.info(zap ? 'Pozadí je společné pro všechny snímky (převzato z aktuálního). Vlastní pozadí snímků se vrátí po vypnutí.' : 'Každý snímek má zase vlastní pozadí.');
      poStrukture();
    });
    $('fps').addEventListener('change', () => { P.fps = Math.max(1, Math.min(60, Math.round(+$('fps').value) || 12)); $('fps').value = P.fps; oznacAkt(); planujUlozeni(); });
    $('rezim').addEventListener('change', () => { P.rezim = $('rezim').value; planujUlozeni(); });
    kresliVzorky();
  }

  // časová osa: klik, držení, přetažení
  osa.addEventListener('click', e => {
    const el = e.target.closest('.snimek');
    if (!el || el.dataset.konec || e.target.tagName === 'INPUT') return;
    if (prehrava) prehrat(false);
    nastavAkt(+el.dataset.i);
  });
  osa.addEventListener('change', e => {
    if (e.target.tagName !== 'INPUT') return;
    const i = +e.target.closest('.snimek').dataset.i, d = Math.max(1, Math.min(99, Math.round(+e.target.value) || 1));
    if (snimky[i].drzeni === d) { e.target.value = d; return; }
    zmenStrukturu(() => { snimky[i].drzeni = d; });
  });
  let tazeny = -1;
  osa.addEventListener('dragstart', e => { const el = e.target.closest('.snimek'); if (!el) return; tazeny = +el.dataset.i; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', String(tazeny)); } catch { /* nic */ } });
  const cilTazeni = e => {
    const el = e.target.closest('.snimek:not(.pridat)');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { el, i: +el.dataset.i, za: e.clientX > r.left + r.width / 2 };
  };
  const zrusOznaceni = () => osa.querySelectorAll('.cil-pred,.cil-za').forEach(x => x.classList.remove('cil-pred', 'cil-za'));
  osa.addEventListener('dragover', e => {
    if (tazeny < 0) return;
    const c = cilTazeni(e); e.preventDefault(); zrusOznaceni();
    if (c) c.el.classList.add(c.za ? 'cil-za' : 'cil-pred');
  });
  osa.addEventListener('drop', e => {
    e.preventDefault(); zrusOznaceni();
    const c = cilTazeni(e), od = tazeny; tazeny = -1;
    if (!c || od < 0) return;
    let kam = c.i + (c.za ? 1 : 0);
    if (od < kam) kam--;
    if (kam !== od) zmenStrukturu(() => { snimky = J.presun(snimky, od, kam); akt = kam; });
  });
  osa.addEventListener('dragend', () => { tazeny = -1; zrusOznaceni(); });

  // ---------- přehrávání ----------
  let t0 = 0, rafId = 0;
  function prehrat(zap) {
    if (zap === undefined) zap = !prehrava;
    if (zap === prehrava) return;
    if (zap) { potvrdVyber(); zrusAkci(); }
    prehrava = zap;
    $('tlPrehrat').textContent = zap ? '⏸' : '▶';
    $('tlPrehrat').setAttribute('aria-label', zap ? 'Zastavit' : 'Přehrát');
    if (zap) { t0 = performance.now(); rafId = requestAnimationFrame(krok); }
    else { cancelAnimationFrame(rafId); [...osa.children].forEach(el => el.classList.remove('hraje')); vykresliBrzy(); }
  }
  function krok(ted) {
    if (!prehrava) return;
    const r = J.snimekVCase(snimky.map(s => s.drzeni), P.fps, P.rezim, ted - t0);
    if (r.index !== hrajeIdx || !osa.querySelector('.hraje')) {
      const st = osa.children[hrajeIdx]; if (st) st.classList.remove('hraje');
      hrajeIdx = r.index;
      const el = osa.children[hrajeIdx]; if (el) el.classList.add('hraje');
    }
    vykresli();
    if (r.konec) { prehrat(false); return; }
    rafId = requestAnimationFrame(krok);
  }

  // ---------- podklad (rotoskopie) ----------
  function podkladZObrazu(zdroj, w, h) {
    const v = novaV(), t = v.c.getContext('2d');
    const m = Math.min(P.sirka / w, P.vyska / h);
    t.drawImage(zdroj, (P.sirka - w * m) / 2, (P.vyska - h * m) / 2, w * m, h * m);
    return v;
  }
  function vlozPodklady(seznam) {
    zmenStrukturu(() => {
      seznam.forEach((v, k) => {
        const i = akt + k;
        if (i >= snimky.length) snimky.push(novySnimek());
        snimky[i].podklad = v;
      });
    });
    vid.podklad = true; $('vidPodklad').checked = true;
    vykresliBrzy();
  }
  async function podkladFoto(soubory) {
    if (!soubory.length) return;
    const seznam = [];
    for (const f of [...soubory].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))) {
      try { const bm = await createImageBitmap(f); seznam.push(podkladZObrazu(bm, bm.width, bm.height)); bm.close(); }
      catch { Dialog.chyba(`Obrázek ${f.name} nejde přečíst.`); }
    }
    if (!seznam.length) return;
    if (seznam.length === 1 && snimky.length > 1 && await Dialog.potvrd('Použít fotku jako podklad pro všechny snímky? (Ne = jen pro aktuální snímek.)')) {
      snimky.forEach(s => { s.podklad = seznam[0]; });
      vid.podklad = true; $('vidPodklad').checked = true; planujUlozeni(); obnovMiniatury(); vykresliBrzy();
      return;
    }
    vlozPodklady(seznam);
    if (seznam.length > 1) Dialog.info(`Podklad vložen do ${seznam.length} snímků od aktuálního.`);
  }
  async function podkladVideo(f) {
    const url = URL.createObjectURL(f), v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
    try {
      await new Promise((res, rej) => { v.onloadeddata = res; v.onerror = () => rej(new Error('Prohlížeč toto video neumí přehrát.')); });
      const n = Math.min(300, Math.max(1, Math.floor(v.duration * P.fps)));
      if (!await Dialog.potvrd(`Video trvá ${cislo(v.duration, 1)} s → ${n} snímků při ${P.fps} FPS${n === 300 ? ' (omezeno na 300)' : ''}. Podklady se vloží od aktuálního snímku, chybějící snímky vzniknou. Pokračovat?`)) return;
      const seznam = [];
      for (let i = 0; i < n; i++) {
        await new Promise(res => { v.onseeked = res; v.currentTime = Math.min(v.duration - 0.001, (i + 0.5) / P.fps); });
        seznam.push(podkladZObrazu(v, v.videoWidth, v.videoHeight));
        $('stavPozice').textContent = `Video: ${i + 1}/${n}`;
      }
      vlozPodklady(seznam);
      Dialog.info(`Z videa vzniklo ${n} podkladů.`);
    } catch (e) { Dialog.chyba(e.message || String(e)); }
    finally { URL.revokeObjectURL(url); }
  }
  function podkladDoPozadi() {
    const s = aktSn();
    if (!s.podklad) return Dialog.info('Aktuální snímek nemá podklad.');
    const v = vrstvaPozadi(s), pred = kopie(v.c), t = v.c.getContext('2d');
    t.globalCompositeOperation = 'destination-over'; t.drawImage(s.podklad.c, 0, 0); t.globalCompositeOperation = 'source-over';
    zaznamPx(v, pred, { x: 0, y: 0, w: P.sirka, h: P.vyska });
  }
  async function podkladOdebrat(vse) {
    if (vse && !await Dialog.potvrd('Odebrat podklad ze všech snímků?')) return;
    (vse ? snimky : [aktSn()]).forEach(s => { s.podklad = null; });
    planujUlozeni(); vykresliBrzy();
  }

  // ---------- ukládání (IndexedDB, JSON) ----------
  let db = null;
  function otevriDB() {
    if (db) return Promise.resolve(db);
    return new Promise((res, rej) => {
      const r = indexedDB.open(DB_JMENO, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(DB_STORE, { keyPath: 'id' });
      r.onsuccess = () => { db = r.result; res(db); };
      r.onerror = () => rej(r.error);
    });
  }
  function dbOp(rezim, fn) {
    return otevriDB().then(d => new Promise((res, rej) => {
      const tx = d.transaction(DB_STORE, rezim), r = fn(tx.objectStore(DB_STORE));
      tx.oncomplete = () => res(r && r.result); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error);
    }));
  }
  const pngBlob = c => new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('PNG se nepodařilo vytvořit.')), 'image/png'));
  async function vrstvaBlob(v) {
    if (v.blob) return v.blob;
    const ver = v.ver, b = await pngBlob(v.c);
    if (v.ver === ver) v.blob = b;
    return b;
  }
  async function nahledBlob() {
    const c = platno(160, Math.max(1, Math.round(160 * P.vyska / P.sirka)));
    miniatura(snimky[0], c);
    return pngBlob(c);
  }
  async function serializuj() {
    const meta = Object.assign({}, P); delete meta.snimky;
    return {
      id: projektId, meta, zmeneno: Date.now(), nahled: await nahledBlob(), pocet: snimky.length,
      pozadiSdil: pozadiSdil ? await vrstvaBlob(pozadiSdil) : null,
      snimky: await Promise.all(snimky.map(async s => ({
        id: s.id, drzeni: s.drzeni, pozadi: await vrstvaBlob(s.pozadi), kresba: await vrstvaBlob(s.kresba), podklad: s.podklad ? await vrstvaBlob(s.podklad) : null,
      }))),
    };
  }
  let casUlozeni = null, ukladam = false, dbChyba = false;
  function planujUlozeni() { clearTimeout(casUlozeni); casUlozeni = setTimeout(ulozNyni, 1500); }
  async function ulozNyni(hlasit) {
    clearTimeout(casUlozeni);
    if (ukladam) { planujUlozeni(); return; }
    ukladam = true;
    try {
      const z = await serializuj();
      await dbOp('readwrite', st => st.put(z));
      try { localStorage.setItem(LS_POSL, projektId); } catch { /* nic */ }
      if (hlasit) Dialog.info('Projekt uložen v prohlížeči.');
    } catch (e) {
      if (!dbChyba || hlasit) Dialog.chyba('Uložení do prohlížeče selhalo (' + (e && e.message || e) + '). Stáhněte si projekt jako JSON.');
      dbChyba = true;
    } finally { ukladam = false; }
  }
  async function nactiVrstvu(zdroj, v) {
    if (!zdroj) return v;
    const t = v.c.getContext('2d');
    if (zdroj instanceof Blob) {
      const bm = await createImageBitmap(zdroj); t.drawImage(bm, 0, 0); bm.close();
      v.blob = zdroj;
    } else {
      const img = new Image(); img.src = zdroj; await img.decode(); t.drawImage(img, 0, 0);
    }
    return v;
  }
  async function nactiProjekt(z) {
    prehrat(false); zrusAkci(); vyber = null;
    const meta = Object.assign({}, z.meta, { snimky: z.snimky });
    P = J.normProjekt(meta);
    const sn = z.snimky && z.snimky.length ? z.snimky : [{}];
    const nove = [];
    for (let i = 0; i < sn.length; i++) {
      const s = novySnimek();
      s.id = sn[i].id || s.id; s.drzeni = P.snimky[i].drzeni;
      await nactiVrstvu(sn[i].pozadi, s.pozadi);
      await nactiVrstvu(sn[i].kresba, s.kresba);
      if (sn[i].podklad) s.podklad = await nactiVrstvu(sn[i].podklad, novaV());
      nove.push(s);
    }
    pozadiSdil = z.pozadiSdil ? await nactiVrstvu(z.pozadiSdil, novaV()) : null;
    delete P.snimky;
    snimky = nove; akt = 0; projektId = z.id || novyId();
    hist.vymaz();
    poNacteni();
  }
  function poNacteni() {
    pl.width = P.sirka; pl.height = P.vyska;
    $('fps').value = P.fps; $('rezim').value = P.rezim; $('pozadiSdilene').checked = P.pozadiSdilene;
    $('nazevProjektu').textContent = P.nazev + ` · ${P.sirka}×${P.vyska}`;
    document.title = '🎞️ ' + P.nazev + ' – Animace snímek po snímku';
    cibNeplatna = true;
    vykresliOsu(); aktualizujTlacitka(); zoomFit();
  }
  function novyProjekt(meta) {
    prehrat(false); zrusAkci(); vyber = null;
    P = J.normProjekt(meta); delete P.snimky;
    snimky = [novySnimek()]; pozadiSdil = null; akt = 0; projektId = novyId();
    hist.vymaz(); poNacteni(); ulozNyni();
  }
  const blobNaDataUrl = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(b); });
  async function jsonUloz() {
    potvrdVyber();
    const z = await serializuj();
    const prevod = b => b ? blobNaDataUrl(b) : null;
    const out = {
      format: 'animace_snimky', verze: J.VERZE, meta: z.meta, pozadiSdil: await prevod(z.pozadiSdil),
      snimky: await Promise.all(z.snimky.map(async s => ({ id: s.id, drzeni: s.drzeni, pozadi: await prevod(s.pozadi), kresba: await prevod(s.kresba), podklad: await prevod(s.podklad) }))),
    };
    stahni(JSON.stringify(out), nazevSouboru() + '.json', 'application/json');
  }
  async function jsonNacti(f) {
    try {
      const d = JSON.parse(await f.text());
      if (d.format !== 'animace_snimky' || !Array.isArray(d.snimky)) throw new Error('Soubor není projekt této stránky.');
      await ulozNyni();
      await nactiProjekt({ id: novyId(), meta: d.meta, snimky: d.snimky, pozadiSdil: d.pozadiSdil });
      ulozNyni();
      Dialog.info(`Načteno: ${P.nazev} (${snimky.length} snímků).`);
    } catch (e) { Dialog.chyba('Projekt nejde načíst: ' + (e.message || e)); }
  }
  async function seznamProjektu() {
    const el = $('seznamProjektu');
    el.innerHTML = '<p class="napoveda-mala">Načítám…</p>';
    let vse = [];
    try { vse = await dbOp('readonly', st => st.getAll()); } catch (e) { el.innerHTML = ''; el.textContent = 'Úložiště prohlížeče není dostupné.'; return; }
    vse.sort((a, b) => b.zmeneno - a.zmeneno);
    el.innerHTML = '';
    for (const z of vse) {
      const r = document.createElement('div');
      r.className = 'projekt' + (z.id === projektId ? ' aktualni' : '');
      const img = document.createElement('img'); img.alt = '';
      if (z.nahled) { img.src = URL.createObjectURL(z.nahled); img.onload = () => URL.revokeObjectURL(img.src); }
      const p = document.createElement('div'); p.className = 'popis';
      const b = document.createElement('b'); b.textContent = z.meta.nazev; b.dataset.i18n = 'ne';
      const s = document.createElement('span');
      s.textContent = `${z.meta.sirka}×${z.meta.vyska} · ${z.pocet || z.snimky.length} snímků · ${new Date(z.zmeneno).toLocaleString('cs-CZ')}`;
      p.append(b, s);
      const ot = document.createElement('button'); ot.className = 'btn mini'; ot.textContent = z.id === projektId ? 'Otevřený' : 'Otevřít'; ot.disabled = z.id === projektId;
      ot.addEventListener('click', async () => { await ulozNyni(); await nactiProjekt(z); try { localStorage.setItem(LS_POSL, z.id); } catch { /* nic */ } $('dProjekty').close(); });
      const sm = document.createElement('button'); sm.className = 'btn mini'; sm.textContent = '🗑'; sm.title = 'Smazat projekt'; sm.setAttribute('aria-label', 'Smazat projekt');
      sm.addEventListener('click', async () => {
        if (!await Dialog.potvrd(`Smazat projekt „${z.meta.nazev}“? Nejde vrátit.`)) return;
        await dbOp('readwrite', st => st.delete(z.id));
        if (z.id === projektId) novyProjekt({});
        seznamProjektu();
      });
      r.append(img, p, ot, sm);
      el.appendChild(r);
    }
    if (!vse.length) el.innerHTML = '<p class="napoveda-mala">Zatím žádné uložené projekty.</p>';
  }

  // ---------- nový projekt / vlastnosti ----------
  let rezimDialogu = 'novy';
  function otevriNovy(vlastnosti) {
    rezimDialogu = vlastnosti ? 'vlastnosti' : 'novy';
    const m = vlastnosti ? P : J.normProjekt({});
    $('dNovyNadpis').textContent = vlastnosti ? '⚙ Vlastnosti projektu' : '📄 Nový projekt';
    $('nOk').textContent = vlastnosti ? 'Použít' : 'Vytvořit';
    $('nPozn').hidden = !vlastnosti;
    $('nNazev').value = vlastnosti ? P.nazev : 'Animace';
    $('nSirka').value = m.sirka; $('nVyska').value = m.vyska; $('nFps').value = m.fps; $('nBarva').value = m.barvaPozadi; $('nPruhledne').checked = m.pruhledne;
    const kl = m.sirka + 'x' + m.vyska;
    $('nPredvolby').value = [...$('nPredvolby').options].some(o => o.value === kl) ? kl : 'vlastni';
    otevriOkno('dNovy');
  }
  $('nPredvolby').addEventListener('change', () => { const v = $('nPredvolby').value; if (v === 'vlastni') return; const [w, h] = v.split('x'); $('nSirka').value = w; $('nVyska').value = h; });
  $('nOk').addEventListener('click', async () => {
    const m = { nazev: $('nNazev').value.trim() || 'Animace', sirka: +$('nSirka').value, vyska: +$('nVyska').value, fps: +$('nFps').value, barvaPozadi: $('nBarva').value, pruhledne: $('nPruhledne').checked };
    $('dNovy').close();
    if (rezimDialogu === 'novy') { await ulozNyni(); novyProjekt(Object.assign(m, { rezim: 'smycka' })); return; }
    potvrdVyber();
    const n = J.normProjekt(Object.assign({}, P, m));
    const zmenaRozmeru = n.sirka !== P.sirka || n.vyska !== P.vyska;
    Object.assign(P, { nazev: n.nazev, fps: n.fps, barvaPozadi: n.barvaPozadi, pruhledne: n.pruhledne });
    if (zmenaRozmeru) {
      P.sirka = n.sirka; P.vyska = n.vyska;
      const prevzorkuj = v => { if (!v) return; const c = platno(); c.getContext('2d').drawImage(v.c, 0, 0); v.c = c; v.blob = null; v.ver++; };
      snimky.forEach(s => { prevzorkuj(s.pozadi); prevzorkuj(s.kresba); prevzorkuj(s.podklad); });
      prevzorkuj(pozadiSdil);
      hist.vymaz();
    }
    poNacteni(); ulozNyni();
  });

  // ---------- ukázka ----------
  function ukazka() {
    novyProjekt({ nazev: 'Skákající míč', sirka: 640, vyska: 360, fps: 12, barvaPozadi: '#fdf8ee' });
    P.pozadiSdilene = true; $('pozadiSdilene').checked = true;
    pozadiSdil = novaV();
    const b = pozadiSdil.c.getContext('2d');
    b.fillStyle = '#cfe8f7'; b.fillRect(0, 0, 640, 300); b.fillStyle = '#9bc97a'; b.fillRect(0, 300, 640, 60);
    b.strokeStyle = '#4d7a35'; b.lineWidth = 3; b.beginPath(); b.moveTo(0, 300); b.lineTo(640, 300); b.stroke();
    const N0 = 12, sn = [];
    for (let i = 0; i < N0; i++) {
      const s = novySnimek(), t = i / N0, c = s.kresba.c.getContext('2d');
      const f = (t * 2) % 1, x = 80 + t * 480, y = 266 - 4 * f * (1 - f) * 190;   // dva skoky, parabola
      const naZemi = f === 0, sx = naZemi ? 1.2 : 1 - 0.1 * Math.abs(1 - 2 * f), sy = naZemi ? 0.82 : 1 + 0.1 * Math.abs(1 - 2 * f);
      c.save(); c.translate(x, 300 - (300 - y) - 34 * (sy - 1)); c.scale(sx, sy);
      c.fillStyle = '#e0303a'; c.beginPath(); c.arc(0, 0, 34, 0, Math.PI * 2); c.fill();
      c.lineWidth = 4; c.strokeStyle = '#222'; c.stroke();
      c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.arc(-11, -12, 9, 0, Math.PI * 2); c.fill();
      c.restore();
      sn.push(s);
    }
    snimky = sn; akt = 0;
    hist.vymaz(); poNacteni(); ulozNyni();
  }

  // ---------- export ----------
  let formatExportu = 'gif';
  const nazevSouboru = () => (($('eNazev') && $('eNazev').value.trim()) || P.nazev || 'animace').replace(/[\\/:*?"<>|]+/g, '_');
  function stahni(data, nazev, typ) {
    const blob = data instanceof Blob ? data : new Blob([data], { type: typ });
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = nazev; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  function snimekExport(s, m, pruhl, sudy) {
    let w = Math.max(1, Math.round(P.sirka * m)), h = Math.max(1, Math.round(P.vyska * m));
    if (sudy) { w += w % 2; h += h % 2; }
    const c = platno(w, h), t = c.getContext('2d');
    if (!pruhl) { t.fillStyle = P.barvaPozadi; t.fillRect(0, 0, w, h); }
    t.imageSmoothingEnabled = m < 1;
    t.drawImage(vrstvaPozadi(s).c, 0, 0, Math.round(P.sirka * m), Math.round(P.vyska * m));
    t.drawImage(s.kresba.c, 0, 0, Math.round(P.sirka * m), Math.round(P.vyska * m));
    return c;
  }
  function otevriExport() {
    prehrat(false); potvrdVyber();
    $('eNazev').value = P.nazev.replace(/[\\/:*?"<>|]+/g, '_') || 'animace';
    $('ePingpong').checked = P.rezim === 'pingpong';
    $('ePruhledne').checked = P.pruhledne;
    $('eOpak').value = P.rezim === 'jednou' ? '1' : '0';
    nastavFormat(formatExportu);
    otevriOkno('dExport');
  }
  async function nastavFormat(f) {
    formatExportu = f;
    document.querySelectorAll('[data-format]').forEach(b => b.setAttribute('aria-pressed', b.dataset.format === f));
    document.querySelectorAll('#dExport [data-pro]').forEach(el => { el.hidden = !el.dataset.pro.split(' ').includes(f); });
    const sek = J.sekvence(snimky.map(s => s.drzeni), P.fps, 'smycka'), del = sek.reduce((a, x) => a + x.delka, 0);
    let t = `${snimky.length} snímků, ${P.sirka}×${P.vyska} px, ${cislo(del / 1000, 2)} s při ${P.fps} FPS.`;
    if (f === 'mp4' || f === 'webm') {
      const k = await kodek(f);
      t += k ? ` Kodek ${k.toUpperCase()}. Video nemá průhlednost – použije se barva pozadí.` : ' Tento prohlížeč neumí video kódovat (chybí WebCodecs) – použijte GIF.';
    }
    if (f === 'gif') t += ' GIF má nejvýš 256 barev a délku snímku v setinách sekundy.';
    if (f === 'sprite') t += ' Snímky v mřížce, délky (držení) v JSON.';
    $('eInfo').textContent = t;
  }
  async function kodek(f, w, h) {
    const MB = window.Mediabunny;
    if (!MB) return null;
    const sez = f === 'mp4' ? ['avc', 'hevc', 'vp9', 'av1'] : ['vp9', 'vp8', 'av1'];
    try { return await MB.getFirstEncodableVideoCodec(sez, { width: w || 640, height: h || 360 }); } catch { return null; }
  }
  function gifVeWorkeru(data, volby, ukaz) {
    let w = null;
    try { w = new Worker('animace_gif/worker.js'); } catch { w = null; }
    if (!w) return Promise.resolve(A.kodujGif(data, Object.assign({}, volby, { priPrubehu: ukaz })));
    return new Promise((res, rej) => {
      w.onmessage = e => {
        if (e.data.prubeh !== undefined) return ukaz(e.data.prubeh);
        w.terminate();
        if (e.data.chyba) rej(new Error(e.data.chyba)); else res(e.data.hotovo);
      };
      w.onerror = e => { w.terminate(); rej(new Error(e.message || 'Chyba kodéru GIF')); };
      w.postMessage({ id: 1, typ: 'gif', snimky: data, volby });
    });
  }
  let exportBezi = false;
  async function exportovat() {
    if (exportBezi) return;
    exportBezi = true; $('eOk').disabled = true;
    const pr = $('ePrubeh'); pr.hidden = false;
    const ukaz = p => { pr.firstElementChild.style.width = Math.round(p * 100) + '%'; };
    ukaz(0);
    const f = formatExportu, m = +$('eMeritko').value, nazev = nazevSouboru(), t0 = performance.now();
    const drz = snimky.map(s => s.drzeni), sek = J.sekvence(drz, P.fps, $('ePingpong').checked ? 'pingpong' : 'smycka');
    const pruhl = $('ePruhledne').checked;
    try {
      let data, soubor;
      if (f === 'gif') {
        const cache = new Map();
        const obr = i => { if (!cache.has(i)) { const c = snimekExport(snimky[i], m, pruhl); cache.set(i, { sirka: c.width, vyska: c.height, data: c.getContext('2d').getImageData(0, 0, c.width, c.height).data }); } return cache.get(i); };
        const sn = sek.map(x => ({ obr: obr(x.index), delka: x.delka }));
        data = await gifVeWorkeru(sn, { barev: +$('eBarev').value, dither: $('eDither').checked, prehrani: +$('eOpak').value, paleta: 'globalni', metoda: 'mediancut', optimalizace: true, prah: 128 }, p => ukaz(p * 0.98));
        soubor = nazev + '.gif'; data = new Blob([data], { type: 'image/gif' });
      } else if (f === 'mp4' || f === 'webm') {
        data = await kodujVideo(f, sek, m, ukaz); soubor = nazev + '.' + f;
      } else if (f === 'sprite') {
        const prvni = snimekExport(snimky[0], m, pruhl);
        const roz = J.mrizkaSprite(snimky.length, prvni.width, prvni.height, { sloupcu: +$('eSloupcu').value || 0, mezera: +$('eMezera').value || 0, mocninaDvou: $('eMocnina').checked });
        if (roz.sirka > 16384 || roz.vyska > 16384) throw new Error(`List by měl ${roz.sirka}×${roz.vyska} px – víc, než prohlížeč zvládne (16384). Zmenšete měřítko nebo nastavte počet sloupců.`);
        const c = platno(roz.sirka, roz.vyska), t = c.getContext('2d');
        snimky.forEach((s, i) => { t.drawImage(i ? snimekExport(s, m, pruhl) : prvni, roz.pozice[i].x, roz.pozice[i].y); ukaz((i + 1) / snimky.length * 0.8); });
        const png = await pngBlob(c);
        if ($('eJson').checked) {
          const js = J.jsonSprite(roz, prvni.width, prvni.height, drz.map(d => J.delkaSnimku(d, P.fps)), nazev + '.png', 'snimek_');
          data = new Blob([A.zip([{ name: nazev + '.png', data: new Uint8Array(await png.arrayBuffer()) }, { name: nazev + '.json', data: JSON.stringify(js, null, 2) }])], { type: 'application/zip' });
          soubor = nazev + '_sprite.zip';
        } else { data = png; soubor = nazev + '_sprite.png'; }
      } else {
        const polozky = [], meta = [], cislic = Math.max(3, String(snimky.length).length);
        for (let i = 0; i < snimky.length; i++) {
          const jm = 'snimek_' + String(i + 1).padStart(cislic, '0') + '.png';
          polozky.push({ name: jm, data: new Uint8Array(await (await pngBlob(snimekExport(snimky[i], m, pruhl))).arrayBuffer()) });
          meta.push({ soubor: jm, drzeni: drz[i], delka_ms: Math.round(J.delkaSnimku(drz[i], P.fps)) });
          ukaz((i + 1) / snimky.length);
        }
        polozky.push({ name: 'snimky.json', data: JSON.stringify({ fps: P.fps, rezim: P.rezim, snimky: meta }, null, 2) });
        data = new Blob([A.zip(polozky)], { type: 'application/zip' }); soubor = nazev + '_snimky.zip';
      }
      ukaz(1);
      stahni(data, soubor);
      Dialog.info(`Uloženo ${soubor} – ${velikostTxt(data.size)} za ${cislo((performance.now() - t0) / 1000, 1)} s.`);
    } catch (e) {
      Dialog.chyba('Export selhal: ' + (e.message || e));
    } finally {
      exportBezi = false; $('eOk').disabled = false;
      setTimeout(() => { pr.hidden = true; }, 600);
    }
  }
  const velikostTxt = b => b < 1024 ? b + ' B' : b < 1048576 ? cislo(b / 1024, 0) + ' kB' : cislo(b / 1048576, 1) + ' MB';
  async function kodujVideo(f, sek, m, ukaz) {
    const MB = window.Mediabunny;
    if (!MB) throw new Error('Knihovna Mediabunny se nenačetla.');
    const vz = snimekExport(snimky[0], m, false, true), W = vz.width, H = vz.height;
    const k = await kodek(f, W, H);
    if (!k) throw new Error('Prohlížeč neumí kódovat video tohoto formátu. Použijte GIF.');
    const c = platno(W, H), t = c.getContext('2d');
    const output = new MB.Output({ format: f === 'mp4' ? new MB.Mp4OutputFormat() : new MB.WebMOutputFormat(), target: new MB.BufferTarget() });
    const zdroj = new MB.CanvasSource(c, { codec: k, bitrate: MB['QUALITY_' + $('eKvalita').value] });
    output.addVideoTrack(zdroj);
    await output.start();
    const opak = Math.max(1, Math.min(50, +$('eSmycek').value || 1)), celkem = sek.length * opak;
    let cas = 0, n = 0;
    for (let o = 0; o < opak; o++) for (const x of sek) {
      t.drawImage(snimekExport(snimky[x.index], m, false, true), 0, 0);
      await zdroj.add(cas / 1000, x.delka / 1000);
      cas += x.delka;
      ukaz(++n / celkem * 0.95);
    }
    zdroj.close();
    await output.finalize();
    return new Blob([output.target.buffer], { type: f === 'mp4' ? 'video/mp4' : 'video/webm' });
  }

  // ---------- nabídky, příkazy, klávesy ----------
  function otevriOkno(id) { zavriNabidky(); prehrat(false); const d = $(id); if (!d.open) d.showModal(); }
  document.querySelectorAll('[data-zavrit]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
  document.querySelectorAll('[data-format]').forEach(b => b.addEventListener('click', () => nastavFormat(b.dataset.format)));
  $('eOk').addEventListener('click', exportovat);
  $('souborFoto').addEventListener('change', e => { podkladFoto(e.target.files); e.target.value = ''; });
  $('souborVideo').addEventListener('change', e => { if (e.target.files[0]) podkladVideo(e.target.files[0]); e.target.value = ''; });
  $('souborJson').addEventListener('change', e => { if (e.target.files[0]) jsonNacti(e.target.files[0]); e.target.value = ''; });

  const PRIKAZY = {
    novy: () => { if ($('dProjekty').open) $('dProjekty').close(); otevriNovy(false); },
    projekty: () => { otevriOkno('dProjekty'); seznamProjektu(); },
    ulozit: () => { potvrdVyber(); ulozNyni(true); },
    vlastnosti: () => otevriNovy(true),
    jsonUloz, jsonNacti: () => $('souborJson').click(),
    ukazka: async () => { await ulozNyni(); ukazka(); },
    zpet, znovu,
    vybratVse: () => { potvrdVyber(); vyber = { r: { x: 0, y: 0, w: P.sirka, h: P.vyska } }; nastavNastroj('vyber', true); },
    kopirovat, vyjmout: () => { kopirovat(); smazatVyber(); }, vlozit, smazatVyber, zrcadlitVyber, zrusitVyber: potvrdVyber,
    vymazatVrstvu: () => { potvrdVyber(); const v = aktV(), pred = kopie(v.c); v.c.getContext('2d').clearRect(0, 0, P.sirka, P.vyska); zaznamPx(v, pred, { x: 0, y: 0, w: P.sirka, h: P.vyska }); },
    pridat: () => pridatSnimek(false), pridatKonec: () => pridatSnimek(true), duplikovat, smazat,
    vlevo: () => posun(-1), vpravo: () => posun(1), obratit, drzeniVse,
    podkladFoto: () => $('souborFoto').click(), podkladVideo: () => $('souborVideo').click(),
    podkladDoPozadi, podkladOdebrat: () => podkladOdebrat(false), podkladOdebratVse: () => podkladOdebrat(true),
    cibule: () => { N.cibule = !N.cibule; ulozN(); $('tlCibule').setAttribute('aria-pressed', N.cibule); vykresliBrzy(); },
    zoomFit, zoom1: () => nastavZoom(1), zoomPlus: () => nastavZoom(zoom * 1.25), zoomMinus: () => nastavZoom(zoom / 1.25),
    export: otevriExport, napoveda: () => otevriOkno('dNapoveda'),
    prehrat: () => prehrat(), prvni: () => { prehrat(false); nastavAkt(0); }, posledni: () => { prehrat(false); nastavAkt(snimky.length - 1); },
    predchozi: () => { prehrat(false); nastavAkt(akt - 1); }, dalsi: () => { prehrat(false); nastavAkt(akt + 1); },
  };
  function prikaz(id, el) { zavriNabidky(); if (id === 'pridat' && el && el.dataset.konec) id = 'pridatKonec'; const p = PRIKAZY[id]; if (p) p(); }
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
    if (b && !b.disabled) { e.stopPropagation(); return prikaz(b.dataset.prikaz, b); }
    if (!e.target.closest('.nabidka')) zavriNabidky();
  });
  addEventListener('resize', zavriNabidky);

  document.addEventListener('keydown', e => {
    if (document.querySelector('dialog[open]')) return;
    const tag = e.target.tagName, k = e.key, ctrl = e.ctrlKey || e.metaKey;
    if (k === 'Escape') { zavriNabidky(); if (akce) zrusAkci(); else potvrdVyber(); return; }
    if ((tag === 'INPUT' && !['range', 'checkbox', 'color', 'button'].includes(e.target.type)) || tag === 'SELECT' || tag === 'TEXTAREA') return;
    const kl = k.toLowerCase();
    let hotovo = true;
    if (ctrl) {
      if (kl === 'z' && !e.shiftKey) zpet();
      else if (kl === 'y' || (kl === 'z' && e.shiftKey)) znovu();
      else if (kl === 's') PRIKAZY.ulozit();
      else if (kl === 'e') otevriExport();
      else if (kl === 'd') duplikovat();
      else if (kl === 'a') PRIKAZY.vybratVse();
      else if (kl === 'c') { if (vyber) kopirovat(); else hotovo = false; }
      else if (kl === 'x') { if (vyber) PRIKAZY.vyjmout(); else hotovo = false; }
      else if (kl === 'v') vlozit();
      else hotovo = false;
    } else if (e.altKey && (k === 'ArrowLeft' || k === 'ArrowRight')) posun(k === 'ArrowLeft' ? -1 : 1);
    else if (vyber && k.startsWith('Arrow')) {
      zvedni();
      const d = e.shiftKey ? 10 : 1;
      if (k === 'ArrowLeft') vyber.r.x -= d; else if (k === 'ArrowRight') vyber.r.x += d; else if (k === 'ArrowUp') vyber.r.y -= d; else vyber.r.y += d;
      vykresliBrzy();
    }
    else if (k === ',' || k === 'ArrowLeft') PRIKAZY.predchozi();
    else if (k === '.' || k === 'ArrowRight') PRIKAZY.dalsi();
    else if (k === ' ') prehrat();
    else if (k === 'Home') PRIKAZY.prvni();
    else if (k === 'End') PRIKAZY.posledni();
    else if (k === 'Delete' || k === 'Backspace') { if (e.shiftKey) smazat(); else if (vyber) smazatVyber(); else hotovo = false; }
    else if (k === 'F1' || k === '?') otevriOkno('dNapoveda');
    else if (k === '[' || k === ']') { N.velikost = Math.max(1, Math.min(120, Math.round(N.velikost * (k === '[' ? 0.8 : 1.25)) + (k === ']' && N.velikost < 4 ? 1 : 0))); $('velikost').value = N.velikost; $('velikostHodn').textContent = N.velikost + ' px'; ulozN(); vykresliBrzy(); }
    else if (k === '+' || k === '=') PRIKAZY.zoomPlus();
    else if (k === '-') PRIKAZY.zoomMinus();
    else if (k === '0') zoomFit();
    else if (k === '1') nastavZoom(1);
    else if (e.altKey || e.shiftKey && kl !== '?') hotovo = false;
    else if ({ b: 1, e: 1, g: 1, m: 1, i: 1, h: 1 }[kl]) nastavNastroj({ b: 'stetec', e: 'guma', g: 'vypln', m: 'vyber', i: 'kapatko', h: 'ruka' }[kl]);
    else if (kl === 'n') pridatSnimek(false);
    else if (kl === 'o') PRIKAZY.cibule();
    else if (kl === 'l') nastavVrstvu(aktVrstva === 'kresba' ? 'pozadi' : 'kresba');
    else hotovo = false;
    if (hotovo) e.preventDefault();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && casUlozeni) ulozNyni(); });

  // ---------- start ----------
  async function start() {
    napojPanel();
    $('tlCibule').setAttribute('aria-pressed', N.cibule);
    nastavVrstvu('kresba');
    let posl = null;
    try { posl = localStorage.getItem(LS_POSL); } catch { /* nic */ }
    let z = null;
    try { if (posl) z = await dbOp('readonly', st => st.get(posl)); } catch { dbChyba = true; }
    if (z) await nactiProjekt(z);
    else novyProjekt({});
  }
  window.ANIMSN_APP = { get snimky() { return snimky; }, get akt() { return akt; }, get P() { return P; }, prikaz: id => prikaz(id), nastavAkt, nastavNastroj, hist };
  start();
})();

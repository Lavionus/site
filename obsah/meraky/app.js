/* Měřáky z telefonu – rozhraní (výpočty v jadro.js). */
(function () {
  'use strict';
  const J = window.MERAKY, $ = id => document.getElementById(id);
  const C = J.cislo;
  const KLIC = 'webapp_meraky_nastaveni';
  const VYCHOZI = {
    zalozka: 'prehled', kal: { x: 0, y: 0, lat: 0, sklon: 0 }, hrana: 'dlouha',
    dbPosun: 110, vaha: 'A', casK: 0.125, spekVaha: 'Z',
    luxFaktor: 1, clona: 1.8, kamera: 'user',
    str: { f: 10, znacek: 1, strida: 10, zdroj: 'displej' }
  };
  let nast = nacti();
  function nacti() {
    let d = {};
    try { d = JSON.parse(localStorage.getItem(KLIC) || '{}') || {}; } catch (e) { d = {}; }
    return Object.assign({}, VYCHOZI, d, { kal: Object.assign({}, VYCHOZI.kal, d.kal), str: Object.assign({}, VYCHOZI.str, d.str) });
  }
  function uloz() { try { localStorage.setItem(KLIC, JSON.stringify(nast)); } catch (e) { /* plné úložiště – nevadí */ } }
  const barvy = () => { const s = getComputedStyle(document.documentElement), g = n => s.getPropertyValue(n).trim();
    return { text: g('--text'), muted: g('--text-muted'), border: g('--border'), accent: g('--accent'), ok: g('--ok'), warn: g('--warn'), panel: g('--bg-panel'), danger: g('--danger') }; };
  function platno(c, pomer) {
    const dpr = window.devicePixelRatio || 1, w = c.clientWidth || 300, h = Math.round(w * pomer);
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); c.style.height = h + 'px'; }
    const x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, h);
    return { x, w, h };
  }
  const minSek = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
  const fmtHz = f => f == null ? '—' : f < 1000 ? C(f, 1) + ' Hz' : C(f / 1000, 3) + ' kHz';

  /* ---------- záložky ---------- */
  let zalozka = nast.zalozka;
  /* Moduly přístrojů (poloha.js, pohyb.js…): {start, stop, zapis} podle id panelu. */
  const MODULY = {};
  const ZVUKOVE = ['hluk', 'spektrum', 'ladicka'];
  const panelPohyb = z => { const p = document.querySelector(`[data-panel="${z}"]`); return !!(p && p.hasAttribute('data-pohyb')); };
  function prepni(z) {
    if (!document.querySelector(`[data-panel="${z}"]`)) z = 'prehled';
    const pred = zalozka;
    zalozka = z; nast.zalozka = z; uloz();
    const panel = document.querySelector(`[data-panel="${z}"]`), kat = panel.dataset.kat;
    document.querySelectorAll('.lista [data-zalozka]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.zalozka === z)));
    document.querySelectorAll('.lista [data-kat]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.kat === kat)));
    document.querySelectorAll('.nabidka [data-zalozka]').forEach(b => { b.style.fontWeight = b.dataset.zalozka === z ? '700' : ''; });
    document.querySelectorAll('[data-panel]').forEach(p => { p.hidden = p.dataset.panel !== z; });
    if (pred !== z && MODULY[pred] && MODULY[pred].stop) MODULY[pred].stop();
    if (panelPohyb(z)) startPohyb();
    if (!ZVUKOVE.includes(z)) stopZvuk();
    else if (Z.ctx && Z.demo && Z.demoLad !== (z === 'ladicka')) startZvuk(true);   // ladička má vlastní ukázku
    if (z !== 'svetlo') stopSvetlo();
    if (z !== 'strobo') stopStrobo();
    if (MODULY[z] && MODULY[z].start) MODULY[z].start();
    if (z === 'denik') kresliDenik();
    hlaskaSenzory();
  }

  /* ---------- senzory pohybu ---------- */
  const P = { rot: null, u: null, uOri: null, znam: null, motion: false, posledni: 0, demo: false, spusteno: false, stav: null, poloha: null, raw: {} };
  function startPohyb() {
    if (P.spusteno) return;
    P.spusteno = true;
    const povolit = typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function';
    if (povolit) { P.stav = 'povolit'; P.demo = true; } else poslouchej();
    setTimeout(() => { if (!P.posledni) { P.demo = true; if (!P.stav) P.stav = 'chybi'; hlaskaSenzory(); } }, 1500);
    requestAnimationFrame(smyckaPohyb);
  }
  function poslouchej() {
    addEventListener('deviceorientation', naOrientaci);
    addEventListener('devicemotion', naPohyb);
  }
  async function povolSenzory() {
    try {
      const r = await DeviceOrientationEvent.requestPermission();
      if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') await DeviceMotionEvent.requestPermission();
      if (r === 'granted') {
        P.stav = null; poslouchej();
        setTimeout(() => { if (!P.posledni) { P.stav = 'chybi'; hlaskaSenzory(); } }, 1500);
      } else P.stav = 'odmitnuto';
    } catch (e) { P.stav = 'odmitnuto'; }
    hlaskaSenzory();
  }
  function prijmi(v) {
    const bylDemo = P.demo || P.stav;
    P.posledni = performance.now(); P.demo = false; P.stav = null;
    P.u = J.normuj(J.vyhlad(P.u, v, 0.15)) || v;
    if (bylDemo) hlaskaSenzory();
  }
  function naOrientaci(e) {
    if (e.beta == null || e.gamma == null) return;
    P.uOri = J.zOrientace(e.beta, e.gamma);
    if (!P.motion) prijmi(P.uOri);
  }
  const odberPohybu = [];   // moduly chtějí celou událost devicemotion (zrychlení, gyroskop)
  function naPohyb(e) {
    for (const f of odberPohybu) f(e);
    const g = e.accelerationIncludingGravity;
    if (!g || g.x == null) return;
    const v = [g.x, g.y, g.z];
    if (P.uOri) { const s = J.znamenkoGravitace(v, P.uOri); if (s) P.znam = s; }
    const n = J.normuj(v.map(x => x * (P.znam || 1)));
    if (!n) return;
    P.motion = true; prijmi(n);
  }
  function demoU() {
    const t = performance.now() / 1000;
    return J.zOrientace(0.9 * Math.sin(t / 4), 0.25 + 0.6 * Math.sin(t / 2.7));
  }
  function hlaskaSenzory() {
    const pohyb = panelPohyb(zalozka);
    let t = '';
    if (pohyb && P.stav === 'povolit') t = 'Na tomto zařízení je potřeba přístup k senzorům pohybu povolit. Do té doby běží ukázkový režim.';
    else if (pohyb && P.stav === 'chybi') t = 'Senzor náklonu nebyl nalezen – jste nejspíš na počítači, nebo prohlížeč přístup nepovolil (stránka musí běžet přes https). Zobrazuji ukázkový režim se simulovanými daty.';
    else if (pohyb && P.stav === 'odmitnuto') t = 'Přístup k senzorům byl odmítnut. Povolit ho můžete v nastavení prohlížeče (Safari: Nastavení → Safari → Pohyb a orientace). Běží ukázkový režim.';
    $('hlaskaSenzory').hidden = !t;
    $('hlaskaSenzoryText').textContent = t;
    $('povolSenzory').hidden = P.stav !== 'povolit';
    document.querySelectorAll('[data-demo="pohyb"]').forEach(e => { e.hidden = !P.demo; });
  }
  const uhelObrazovky = () => (screen.orientation && screen.orientation.angle) || window.orientation || 0;
  function aktualniU() { return P.demo || !P.u ? demoU() : P.u; }
  function smyckaPohyb() {
    requestAnimationFrame(smyckaPohyb);
    if (document.hidden) return;
    if (zalozka === 'vodovaha') kresliVodovahu(aktualniU());
    else if (zalozka === 'sklon') kresliSklon(aktualniU());
  }

  /* ---------- vodováha ---------- */
  let vodZamek = null;
  const meritko = (th, R) => R * Math.min(1, (th / (th + 2.5)) / 0.8);   // 10° = okraj, malé úhly roztažené
  function vodHodnoty(u) {
    const us = J.naObrazovku(u, uhelObrazovky());
    P.poloha = J.polohaTelefonu(us, P.poloha);
    if (P.poloha === 'plocha') {
      const a = J.uhlyNaplocho(us);
      P.raw = { x: a.x, y: a.y };
      const x = a.x - nast.kal.x, y = a.y - nast.kal.y;
      return { typ: 'plocha', x, y, celkem: Math.hypot(x, y) };
    }
    const l = J.uhelLat(us);
    P.raw = { lat: l.uhel };
    const uhel = l.uhel - nast.kal.lat;
    // osa trubice = kolmo na zaokrouhlený směr nahoru (obrazovka, y dolů); bublina k vyššímu konci (−znaménko úhlu)
    const up = [us[0], -us[1]];
    const sn = Math.abs(up[0]) > Math.abs(up[1]) ? [Math.sign(up[0]), 0] : [0, Math.sign(up[1])];
    return { typ: 'hrana', uhel, osa: [-sn[1], sn[0]], strana: -Math.sign(uhel) };
  }
  function kresliVodovahu(u) {
    const h = vodZamek || vodHodnoty(u);
    const { x, w, h: vy } = platno($('platnoVodovaha'), 1), B = barvy();
    const cx = w / 2, cy = vy / 2, R = Math.min(w, vy) / 2 - 14;
    const th = h.typ === 'plocha' ? h.celkem : Math.abs(h.uhel);
    const barva = th < 0.3 ? B.ok : th < 1 ? B.warn : B.accent;
    x.lineWidth = 1.5; x.strokeStyle = B.border; x.fillStyle = B.muted; x.font = '12px system-ui'; x.textAlign = 'center';
    if (h.typ === 'plocha') {
      x.beginPath(); x.arc(cx, cy, R, 0, 7); x.stroke();
      for (const s of [0.5, 1, 2, 5]) { x.beginPath(); x.arc(cx, cy, meritko(s, R), 0, 7); x.stroke(); x.fillText(String(s).replace('.', ',') + '°', cx + meritko(s, R) * 0.71 + 12, cy - meritko(s, R) * 0.71); }
      x.beginPath(); x.moveTo(cx - R, cy); x.lineTo(cx + R, cy); x.moveTo(cx, cy - R); x.lineTo(cx, cy + R); x.stroke();
      const d = h.celkem || 1, r = meritko(h.celkem, R);
      const bx = cx + (-h.x / d) * r, by = cy + (h.y / d) * r;
      x.fillStyle = barva; x.globalAlpha = 0.85; x.beginPath(); x.arc(bx, by, R * 0.13, 0, 7); x.fill(); x.globalAlpha = 1;
      x.strokeStyle = B.text; x.lineWidth = 1; x.beginPath(); x.arc(bx, by, R * 0.13, 0, 7); x.stroke();
    } else {
      const [ox, oy] = h.osa, delka = R, tl = R * 0.16;
      x.save(); x.translate(cx, cy); x.rotate(Math.atan2(oy, ox));
      x.strokeStyle = B.border; x.lineWidth = 2; x.beginPath(); if (x.roundRect) x.roundRect(-delka, -tl, 2 * delka, 2 * tl, tl); else x.rect(-delka, -tl, 2 * delka, 2 * tl); x.stroke();
      x.lineWidth = 1;
      for (const s of [0.5, 1, 2, 5]) for (const z of [-1, 1]) { const p = z * meritko(s, delka - tl); x.beginPath(); x.moveTo(p, -tl); x.lineTo(p, tl); x.stroke(); }
      const p = h.strana * meritko(Math.abs(h.uhel), delka - tl);
      x.fillStyle = barva; x.globalAlpha = 0.85; x.beginPath(); x.ellipse(p, 0, tl * 1.4, tl * 0.75, 0, 0, 7); x.fill(); x.globalAlpha = 1;
      x.restore();
    }
    // hodnoty
    $('vodPoloha').textContent = h.typ === 'plocha' ? 'Naplocho' : 'Na hraně (lať)';
    const v = $('vodVelke');
    v.innerHTML = C(th, th < 10 ? 2 : 1) + '<small>°</small>';
    v.className = 'velke' + (th < 0.3 ? ' ok' : th < 1 ? ' pozor' : '');
    const mm = th >= 89.9 ? '—' : C(Math.tan(th / 57.29578) * 1000, 1);
    $('vodCisla').innerHTML = h.typ === 'plocha'
      ? `<div><b>${C(h.x, 2)}°</b><span>vlevo ↔ vpravo (+ = pravá níž)</span></div><div><b>${C(h.y, 2)}°</b><span>nahoru ↔ dolů (+ = horní níž)</span></div><div><b>${mm}</b><span>mm na 1 m</span></div>`
      : `<div><b>${C(J.stupneNaProcenta(th), 2)} %</b><span>sklon</span></div><div><b>${mm}</b><span>mm na 1 m</span></div>`;
    $('vodHodnoty').classList.toggle('zamceno', !!vodZamek);
  }
  $('vodZamek').addEventListener('click', e => {
    vodZamek = vodZamek ? null : vodHodnoty(aktualniU());
    e.currentTarget.setAttribute('aria-pressed', String(!!vodZamek));
  });
  const pauza = ms => new Promise(r => setTimeout(r, ms));
  async function nulaVodovaha() {
    vodHodnoty(aktualniU());
    if (P.poloha === 'plocha') { nast.kal.x = P.raw.x; nast.kal.y = P.raw.y; } else nast.kal.lat = P.raw.lat;
    uloz(); Dialog.info(P.poloha === 'plocha' ? 'Nula vodováhy nastavena pro polohu naplocho.' : 'Nula vodováhy nastavena pro polohu na hraně.');
  }
  async function otoceniVodovaha() {
    prepni('vodovaha');
    if (!await Dialog.potvrd('Položte telefon na rovnou plochu (naplocho nebo na hranu) a nechte ho v klidu. Pak stiskněte OK.')) return;
    await pauza(700); vodHodnoty(aktualniU());
    const poloha = P.poloha, a = Object.assign({}, P.raw);
    if (!await Dialog.potvrd('Otočte telefon o 180° (naplocho kolem svislé osy, na hraně koncem na druhou stranu) přesně na stejné místo. Pak stiskněte OK.')) return;
    await pauza(700); vodHodnoty(aktualniU());
    if (P.poloha !== poloha) return Dialog.chyba('Telefon změnil polohu (naplocho × na hraně) – kalibrace zrušena.');
    const b = P.raw;
    if (poloha === 'plocha') { nast.kal.x = J.kalibraceOtocenim(a.x, b.x).posun; nast.kal.y = J.kalibraceOtocenim(a.y, b.y).posun; }
    else nast.kal.lat = J.kalibraceOtocenim(a.lat, b.lat).posun;
    uloz();
    const naklon = C(Math.abs(poloha === 'plocha' ? J.kalibraceOtocenim(a.x, b.x).skutecny : J.kalibraceOtocenim(a.lat, b.lat).skutecny), 2);
    Dialog.info('Kalibrace uložena. Skutečný náklon plochy: ' + naklon + '°.');
  }

  /* ---------- sklonoměr a úhloměr ---------- */
  let sklonZamek = null, bodA = null;
  const sklonSurovy = u => J.sklon(u, nast.hrana);
  function kresliSklon(u) {
    const s = sklonZamek != null ? sklonZamek : sklonSurovy(u) - nast.kal.sklon;
    const a = Math.abs(s);
    const v = $('sklonVelke');
    v.innerHTML = C(s, a < 10 ? 2 : 1) + '<small>°</small>';
    v.className = 'velke' + (a < 0.3 ? ' ok' : '');
    $('sklonProc').textContent = a >= 89.9 ? '∞' : C(J.stupneNaProcenta(s), 1) + ' %';
    const p = J.pomer(s);
    $('sklonPomer').textContent = isFinite(p) && p < 10000 ? '1 : ' + C(p, p < 10 ? 2 : 1) : '—';
    $('sklonRel').textContent = bodA == null ? '—' : C(J.rozdilUhlu(bodA, s), 1) + '°';
    $('sklonCara').style.transform = `rotate(${-s}deg)`;
    $('sklonHodnoty').classList.toggle('zamceno', sklonZamek != null);
  }
  $('sklonHrana').value = nast.hrana;
  $('sklonHrana').addEventListener('change', e => { nast.hrana = e.target.value; nast.kal.sklon = 0; bodA = null; uloz(); });
  $('sklonZamek').addEventListener('click', e => {
    sklonZamek = sklonZamek != null ? null : sklonSurovy(aktualniU()) - nast.kal.sklon;
    e.currentTarget.setAttribute('aria-pressed', String(sklonZamek != null));
  });
  $('sklonBodA').addEventListener('click', e => {
    if (bodA != null) { bodA = null; e.currentTarget.textContent = '📍 Úhloměr: zachytit A'; return; }
    bodA = sklonSurovy(aktualniU()) - nast.kal.sklon;
    e.currentTarget.textContent = '✖ Zrušit bod A (' + C(bodA, 1) + '°)';
  });
  function nulaSklon() {
    prepni('sklon');
    nast.kal.sklon = sklonSurovy(aktualniU()); uloz();
    Dialog.info('Nula sklonoměru nastavena.');
  }

  /* ---------- zvuk (hlukoměr + spektrum) ---------- */
  const Z = { gen: 0, startuje: false, ctx: null, stream: null, uzly: [], anZ: null, anA: null, anS: null, timer: 0, demo: false, ms: null, energ: 0, cas: 0, max: -Infinity, min: Infinity, hist: [], posl: 0, spicky: null, preb: 0, L: null };
  function analyzator(n, vyhlazeni) {
    const a = Z.ctx.createAnalyser(); a.fftSize = n; a.smoothingTimeConstant = vyhlazeni; a.minDecibels = -140; a.maxDecibels = 0;
    return a;
  }
  function demoZdroj(ctx) {
    const out = ctx.createGain();
    const osc = (typ, f, g) => { const o = ctx.createOscillator(), z = ctx.createGain(); o.type = typ; o.frequency.value = f; z.gain.value = g; o.connect(z).connect(out); o.start(); Z.uzly.push(o); return z; };
    Z.demoLad = zalozka === 'ladicka';
    if (Z.demoLad) {   // struna A2 o 8 centů výš, s vyššími harmonickými a pomalým doznějím
      const f = 110 * Math.pow(2, 8 / 1200);
      [[1, 0.05], [2, 0.03], [3, 0.015], [4, 0.008]].forEach(([k, g]) => osc('sine', f * k, g));
      return out;
    }
    osc('sine', 440, 0.02); osc('sawtooth', 100, 0.006);
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const sum = ctx.createBufferSource(), gs = ctx.createGain(); sum.buffer = buf; sum.loop = true; gs.gain.value = 0.02;
    sum.connect(gs).connect(out); sum.start(); Z.uzly.push(sum);
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.15; lg.gain.value = 0.017;
    lfo.connect(lg).connect(gs.gain); lfo.start(); Z.uzly.push(lfo);
    return out;
  }
  function hlukInfo(t) { $('hlukInfo').textContent = t || ''; }
  async function startZvuk(demo) {
    stopZvuk();
    const gen = ++Z.gen;   // přepnutí/zastavení během čekání na povolení zvýší Z.gen → tento start se zahodí
    Z.startuje = true;
    try { Z.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { hlukInfo('Prohlížeč nepodporuje Web Audio – měření zvuku není možné.'); return; }
    let src = null;
    if (!demo) {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { hlukInfo('Mikrofon není dostupný (starý prohlížeč nebo stránka bez https). Běží ukázka.'); demo = true; }
      else {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
          if (gen !== Z.gen) { stream.getTracks().forEach(t => t.stop()); return; }
          Z.stream = stream;
          src = Z.ctx.createMediaStreamSource(Z.stream);
          const nazev = Z.stream.getAudioTracks()[0].label || 'výchozí', fs = Z.ctx.sampleRate;
          hlukInfo('Mikrofon: ' + nazev + ', vzorkování ' + fs + ' Hz.');
        } catch (e) { if (gen !== Z.gen) return; hlukInfo('Mikrofon se nepodařilo spustit (' + e.name + ') – nejspíš chybí povolení. Běží ukázka.'); demo = true; }
      }
    }
    if (demo) { src = demoZdroj(Z.ctx); if (!$('hlukInfo').textContent) hlukInfo('Ukázka: simulovaný tón 440 Hz, bzučení 100 Hz a kolísavý šum.'); }
    Z.demo = demo;
    Z.ctx.resume().catch(() => {});   // bez klepnutí může zůstat pozastaveno – nečekat
    if (Z.ctx.state === 'suspended') {
      hlukInfo('Prohlížeč čeká na klepnutí – klepněte kamkoli na stránku a měření se rozběhne.');
      document.addEventListener('pointerdown', () => { if (Z.ctx) Z.ctx.resume().then(() => hlukInfo('')).catch(() => {}); }, { once: true });
    }
    const ticho = Z.ctx.createGain(); ticho.gain.value = 0; ticho.connect(Z.ctx.destination);
    Z.anZ = analyzator(4096, 0); Z.anS = analyzator(8192, 0.5);
    src.connect(Z.anZ); src.connect(Z.anS); Z.anZ.connect(ticho); Z.anS.connect(ticho);
    try {
      const k = J.koeficientyA(Z.ctx.sampleRate), f = Z.ctx.createIIRFilter(k.b, k.a);
      Z.anA = analyzator(4096, 0); src.connect(f); f.connect(Z.anA); Z.anA.connect(ticho);
    } catch (e) { Z.anA = null; }
    Z.zdroj = src;
    $('spekRozliseni').textContent = C(Z.ctx.sampleRate / Z.anS.fftSize, 1);
    Z.startuje = false;
    nulujHluk(); Z.posl = Z.ctx.currentTime; Z.timer = setInterval(merHluk, 50);
    stavZvuk();
  }
  function stopZvuk() {
    Z.gen++; Z.startuje = false;
    if (!Z.ctx) return;
    clearInterval(Z.timer);
    Z.uzly.forEach(u => { try { u.stop(); } catch (e) { /* už stojí */ } }); Z.uzly = [];
    if (Z.stream) Z.stream.getTracks().forEach(t => t.stop());
    Z.ctx.close().catch(() => {});
    Object.assign(Z, { ctx: null, stream: null, anZ: null, anA: null, anS: null, demo: false });
    stavZvuk();
  }
  function stavZvuk() {
    document.querySelectorAll('[data-zvuk-tl]').forEach(b => { b.textContent = Z.ctx && !Z.demo ? '⏹ Zastavit mikrofon' : '🎙️ Spustit mikrofon'; });
    document.querySelectorAll('[data-demo="zvuk"]').forEach(e => { e.hidden = !(Z.ctx && Z.demo); });
  }
  function nulujHluk() { Object.assign(Z, { ms: null, energ: 0, cas: 0, max: -Infinity, min: Infinity, hist: [], preb: 0, zaznam: [], zazE: 0, zazT: 0, start: new Date() }); }
  const cas = new Float32Array(4096);
  function merHluk() {
    if (!Z.ctx) return;
    if (Z.ctx.state !== 'running') { Z.posl = Z.ctx.currentTime; return; }
    const vahaA = nast.vaha === 'A' && Z.anA;
    (vahaA ? Z.anA : Z.anZ).getFloatTimeDomainData(cas);
    const ms = J.stredniKvadrat(cas);
    let spicka = 0;
    Z.anZ.getFloatTimeDomainData(cas);
    for (let i = 0; i < cas.length; i++) { const a = Math.abs(cas[i]); if (a > spicka) spicka = a; }
    const ted = Z.ctx.currentTime, dt = Math.min(2, Math.max(0, ted - Z.posl)); Z.posl = ted;
    Z.ms = J.casoveVazeni(Z.ms, ms, dt, nast.casK);
    const L = J.db(Z.ms) + nast.dbPosun;
    Z.L = L; Z.energ += ms * dt; Z.cas += dt;
    if (spicka > 0.99) Z.preb = 20;
    if (Z.cas > 0.6) { Z.max = Math.max(Z.max, L); Z.min = Math.min(Z.min, L); }
    Z.hist.push(L); if (Z.hist.length > 1200) Z.hist.shift();
    Z.zazE += ms * dt; Z.zazT += dt;
    if (Z.zazT >= 1) { Z.zaznam.push([new Date(), J.db(Z.zazE / Z.zazT) + nast.dbPosun]); Z.zazE = 0; Z.zazT = 0; if (Z.zaznam.length > 43200) Z.zaznam.shift(); }
    if (zalozka !== 'hluk') return;
    const jed = vahaA ? 'dB(A)' : 'dB';
    $('hlukVelke').innerHTML = C(Math.max(0, L), 1) + '<small>' + jed + '</small>';
    const leq = Z.cas > 0 ? J.db(Z.energ / Z.cas) + nast.dbPosun : null;
    $('hlukLeq').textContent = C(leq, 1); $('hlukMax').textContent = C(Z.max, 1); $('hlukMin').textContent = C(Z.min, 1);
    $('hlukCas').textContent = minSek(Z.cas);
    const dlouho = Z.cas >= 10 && leq != null;
    $('hlukLex').textContent = dlouho ? C(J.lex8h(leq, Z.cas), 1) : '—';
    $('hlukDavka').textContent = dlouho ? C(J.davka(leq, Z.cas), J.davka(leq, Z.cas) < 10 ? 2 : 0) + ' %' : '—';
    const dob = J.povolenaDoba(Z.L);
    $('hlukDoba').textContent = dob > 24 ? 'bez omezení' : dob >= 1 ? C(dob, 1) + ' h' : C(dob * 60, dob * 60 < 1 ? 1 : 0) + ' min';
    $('hlukPopis').textContent = Z.preb-- > 0 ? '⚠️ Mikrofon je přebuzený – skutečná hladina je vyšší, než ukazuje.' : '≈ ' + J.popisHladiny(L) + (nast.vaha === 'A' && !Z.anA ? ' · A-filtr prohlížeč nepodporuje, měří se bez vážení' : '');
    kresliGrafHluku(leq);
  }
  function kresliGrafHluku(leq) {
    const { x, w, h } = platno($('platnoHluk'), $('platnoHluk').clientWidth < 500 ? 0.55 : 0.3), B = barvy();
    const lo = 20, hi = 120, y = l => h - 4 - (Math.min(hi, Math.max(lo, l)) - lo) / (hi - lo) * (h - 8);
    x.font = '11px system-ui'; x.fillStyle = B.muted; x.strokeStyle = B.border; x.lineWidth = 1;
    for (let l = 40; l <= 100; l += 20) { x.beginPath(); x.moveTo(30, y(l)); x.lineTo(w, y(l)); x.stroke(); x.fillText(l, 4, y(l) + 4); }
    if (leq != null) { x.setLineDash([5, 4]); x.strokeStyle = B.warn; x.beginPath(); x.moveTo(30, y(leq)); x.lineTo(w, y(leq)); x.stroke(); x.setLineDash([]); }
    x.strokeStyle = B.accent; x.lineWidth = 2; x.beginPath();
    const n = Z.hist.length, sir = w - 30;
    Z.hist.forEach((l, i) => { const px = 30 + sir - (n - 1 - i) * sir / 1199; i ? x.lineTo(px, y(l)) : x.moveTo(px, y(l)); });
    x.stroke();
    x.fillStyle = B.muted; x.fillText('−60 s', 32, h - 6); x.textAlign = 'right'; x.fillText('teď', w - 2, h - 6); x.textAlign = 'left';
  }
  $('hlukVaha').value = nast.vaha; $('hlukCasK').value = String(nast.casK); $('hlukPosun').value = nast.dbPosun;
  $('hlukVaha').addEventListener('change', e => { nast.vaha = e.target.value; uloz(); nulujHluk(); });
  $('hlukCasK').addEventListener('change', e => { nast.casK = +e.target.value; uloz(); });
  $('hlukPosun').addEventListener('change', e => { const v = parseFloat(e.target.value); if (isFinite(v)) { nast.dbPosun = v; uloz(); } else e.target.value = nast.dbPosun; });
  $('hlukNuluj').addEventListener('click', nulujHluk);
  $('hlukCsv').addEventListener('click', () => {
    if (!Z.zaznam || !Z.zaznam.length) return Dialog.info('Zatím není co uložit – spusťte mikrofon a nechte ho aspoň pár sekund měřit.');
    const jed = nast.vaha === 'A' && Z.anA ? 'dB(A)' : 'dB';
    stahni('hluk_' + datumSoubor() + '.csv', J.csv([['čas', 'L (' + jed + ', průměr 1 s)']].concat(Z.zaznam.map(([t, l]) => [t.toLocaleString('cs-CZ'), Math.round(l * 10) / 10]))), 'text/csv');
  });
  async function kalHluk() {
    prepni('hluk');
    if (!Z.ctx || Z.L == null) return Dialog.info('Nejdřív spusťte mikrofon a nechte ho chvíli měřit ustálený zvuk (např. šum nebo tón).');
    const ted = Z.L;
    const v = await Dialog.zeptej('Ustálený zvuk: teď měřím ' + C(ted, 1) + ' dB. Kolik ukazuje referenční hlukoměr (dB, stejné vážení)?', C(ted, 1).replace('−', '-'));
    if (v == null) return;
    const zn = parseFloat(String(v).replace(',', '.'));
    if (!isFinite(zn)) return Dialog.chyba('Zadejte číslo v dB.');
    nast.dbPosun = Math.round((nast.dbPosun + zn - ted) * 10) / 10; uloz();
    $('hlukPosun').value = nast.dbPosun; nulujHluk();
    Dialog.info('Kalibrační posun je nyní ' + C(nast.dbPosun, 1) + ' dB.');
  }

  /* spektrum */
  let spekZamek = false, spekSpicky = true, kurzorF = null;
  const vaha = (f, typ) => typ === 'A' ? J.aVahaDb(f) : typ === 'C' ? J.cVahaDb(f) : 0;
  let spek = null;
  function kresliSpektrum() {
    if (!Z.anS) return;
    const n = Z.anS.frequencyBinCount;
    if (!spek || spek.length !== n) { spek = new Float32Array(n); Z.spicky = null; }
    if (!spekZamek) Z.anS.getFloatFrequencyData(spek);
    const fs = Z.ctx.sampleRate, df = fs / Z.anS.fftSize, typ = nast.spekVaha;
    const v = Float32Array.from(spek, (d, i) => d + (i ? vaha(i * df, typ) : 0) + nast.dbPosun);
    if (!Z.spicky || !spekSpicky) Z.spicky = Float32Array.from(v);
    else if (!spekZamek) for (let i = 0; i < n; i++) Z.spicky[i] = Math.max(Z.spicky[i] - 0.25, v[i]);
    const od = Math.max(1, +$('spekOd').value || 40), doF = Math.max(od + 1, +$('spekDo').value || fs / 2);
    const dom = J.dominantni(v, fs, Z.anS.fftSize, od, doF);
    if (dom) {
      const no = J.nota(dom.f);
      $('spekF').textContent = fmtHz(dom.f);
      $('spekNota').textContent = no ? no.nazev + ' ' + (no.centy >= 0 ? '+' : '−') + Math.abs(no.centy) + ' c' : '—';
      $('spekRpm').textContent = C(dom.f * 60, 0) + ' ot/min';
    }
    if (nast.spekZobr === 'vodopad') return kresliVodopad(v, fs, df, dom);
    if (nast.spekZobr === 'tretiny') return kresliTretiny(spek, fs);
    const { x, w, h } = platno($('platnoSpektrum'), $('platnoSpektrum').clientWidth < 500 ? 0.7 : 0.35), B = barvy();
    const fmin = 20, fmax = Math.min(20000, fs / 2), L = Math.log(fmax / fmin);
    const px = f => 34 + (w - 38) * Math.log(f / fmin) / L;
    const hi = nast.dbPosun, lo = hi - 110, py = d => 4 + (h - 22) * (hi - Math.min(hi, Math.max(lo, d))) / (hi - lo);
    x.font = '11px system-ui'; x.lineWidth = 1; x.strokeStyle = B.border; x.fillStyle = B.muted;
    for (const f of [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000]) if (f <= fmax) {
      x.beginPath(); x.moveTo(px(f), 4); x.lineTo(px(f), h - 18); x.stroke();
      x.textAlign = 'center'; x.fillText(f >= 1000 ? f / 1000 + 'k' : f, px(f), h - 5);
    }
    x.textAlign = 'left';
    for (let d = Math.ceil(lo / 20) * 20; d <= hi; d += 20) { x.beginPath(); x.moveTo(34, py(d)); x.lineTo(w, py(d)); x.stroke(); x.fillText(Math.round(d), 2, py(d) + 4); }
    const cara = (data, barva, sirka) => {
      x.strokeStyle = barva; x.lineWidth = sirka; x.beginPath();
      let prvni = true;
      for (let i = Math.max(1, Math.floor(fmin / df)); i < n; i++) { const f = i * df; if (f > fmax) break; const X = px(f), Y = py(data[i]); prvni ? x.moveTo(X, Y) : x.lineTo(X, Y); prvni = false; }
      x.stroke();
    };
    if (spekSpicky) { x.globalAlpha = 0.45; cara(Z.spicky, B.muted, 1); x.globalAlpha = 1; }
    cara(v, B.accent, 1.6);
    if (dom) {
      x.strokeStyle = B.warn; x.setLineDash([4, 4]); x.beginPath(); x.moveTo(px(dom.f), 4); x.lineTo(px(dom.f), h - 18); x.stroke(); x.setLineDash([]);
      x.fillStyle = B.text; x.textAlign = px(dom.f) > w - 90 ? 'right' : 'left'; x.fillText(' ' + fmtHz(dom.f) + ' ', px(dom.f), 16); x.textAlign = 'left';
    }
    if (kurzorF) {
      x.strokeStyle = B.muted; x.beginPath(); x.moveTo(px(kurzorF), 4); x.lineTo(px(kurzorF), h - 18); x.stroke();
      const i = Math.round(kurzorF / df), no = J.nota(kurzorF);
      $('spekKurzor').textContent = fmtHz(kurzorF) + (i < n ? ' · ' + C(v[i], 0) + ' dB' : '') + (no ? ' · ' + no.nazev : '');
    }
    platnoSpektrumInfo = { w, fmin, L };
  }
  let platnoSpektrumInfo = null;
  /* Vodopád: čas shora dolů, frekvence logaritmicky vodorovně, barva = hladina. Řádky se posouvají v pomocném plátně. */
  const vodopad = document.createElement('canvas');
  function barvaHladiny(t) {   // 0–1 → tma → modrá → zelená → žlutá → bílá (čitelné v obou tématech, plocha je vlastní)
    const k = [[0, 0, 0], [20, 30, 140], [0, 160, 120], [240, 220, 40], [255, 255, 255]], p = Math.min(0.9999, Math.max(0, t)) * 4, i = Math.floor(p), f = p - i;
    return k[i].map((c, j) => Math.round(c + f * (k[i + 1][j] - c)));
  }
  function kresliVodopad(v, fs, df, dom) {
    const c = $('platnoSpektrum'), { x, w, h } = platno(c, c.clientWidth < 500 ? 0.9 : 0.45), B = barvy();
    const sir = Math.max(64, Math.round(w - 34)), vys = Math.max(32, Math.round(h - 18));
    if (vodopad.width !== sir || vodopad.height !== vys) { vodopad.width = sir; vodopad.height = vys; const g = vodopad.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, sir, vys); }
    const g = vodopad.getContext('2d');
    if (!spekZamek) {
      g.drawImage(vodopad, 0, 0, sir, vys - 1, 0, 1, sir, vys - 1);
      const radek = g.createImageData(sir, 1), fmin = 20, fmax = Math.min(20000, fs / 2), L = Math.log(fmax / fmin), hi = nast.dbPosun, lo = hi - 100;
      for (let i = 0; i < sir; i++) {
        const f = fmin * Math.exp(L * i / sir), k = Math.min(v.length - 1, Math.max(1, Math.round(f / df)));
        const [r, gg, b] = barvaHladiny((v[k] - lo) / (hi - lo));
        radek.data.set([r, gg, b, 255], i * 4);
      }
      g.putImageData(radek, 0, 0);
    }
    x.drawImage(vodopad, 34, 0, sir, vys);
    const fmin = 20, fmax = Math.min(20000, fs / 2), L = Math.log(fmax / fmin), px = f => 34 + sir * Math.log(f / fmin) / L;
    x.font = '11px system-ui'; x.fillStyle = B.muted; x.textAlign = 'center';
    for (const f of [50, 100, 200, 500, 1000, 2000, 5000, 10000]) if (f <= fmax) x.fillText(f >= 1000 ? f / 1000 + 'k' : f, px(f), h - 5);
    x.save(); x.translate(12, vys / 2); x.rotate(-Math.PI / 2); x.fillText('čas ↓', 0, 0); x.restore();
    if (dom) { x.strokeStyle = B.warn; x.setLineDash([4, 4]); x.beginPath(); x.moveTo(px(dom.f), 0); x.lineTo(px(dom.f), vys); x.stroke(); x.setLineDash([]); }
    x.textAlign = 'left';
    if (kurzorF) {
      x.strokeStyle = B.text; x.beginPath(); x.moveTo(px(kurzorF), 0); x.lineTo(px(kurzorF), vys); x.stroke();
      const i = Math.round(kurzorF / df), no = J.nota(kurzorF);
      $('spekKurzor').textContent = fmtHz(kurzorF) + (i < v.length ? ' · ' + C(v[i], 0) + ' dB' : '') + (no ? ' · ' + no.nazev : '');
    }
    platnoSpektrumInfo = { w: sir + 38, fmin, L };
  }
  function kresliTretiny(spekRaw, fs) {
    const c = $('platnoSpektrum'), { x, w, h } = platno(c, c.clientWidth < 500 ? 0.8 : 0.35), B = barvy();
    const pasma = J.tretinoveOktavy(spekRaw, fs, Z.anS.fftSize, nast.spekVaha).filter(p => p.db != null);
    const hi = nast.dbPosun, lo = hi - 100, py = d => 4 + (h - 34) * (hi - Math.min(hi, Math.max(lo, d))) / (hi - lo);
    x.font = '11px system-ui'; x.strokeStyle = B.border; x.fillStyle = B.muted; x.lineWidth = 1;
    for (let d = Math.ceil(lo / 20) * 20; d <= hi; d += 20) { x.beginPath(); x.moveTo(30, py(d)); x.lineTo(w, py(d)); x.stroke(); x.fillText(Math.round(d), 2, py(d) + 4); }
    const n = pasma.length, sl = (w - 34) / n;
    pasma.forEach((p, i) => {
      const db0 = p.db + nast.dbPosun, X = 34 + i * sl;
      x.fillStyle = B.accent; x.fillRect(X + 1, py(db0), Math.max(1, sl - 2), h - 30 - py(db0));
      if (i % (sl < 22 ? 3 : 1) === 0) { x.save(); x.fillStyle = B.muted; x.translate(X + sl / 2 + 4, h - 2); x.rotate(-Math.PI / 2.6); x.fillText(p.f >= 1000 ? p.f / 1000 + 'k' : p.f, 0, 0); x.restore(); }
    });
    platnoSpektrumInfo = null;
  }
  $('platnoSpektrum').addEventListener('pointermove', e => {
    if (!platnoSpektrumInfo) return;
    const r = e.currentTarget.getBoundingClientRect(), t = (e.clientX - r.left - 34) / (platnoSpektrumInfo.w - 38);
    kurzorF = t < 0 || t > 1 ? null : platnoSpektrumInfo.fmin * Math.exp(t * platnoSpektrumInfo.L);
  });
  $('platnoSpektrum').addEventListener('pointerleave', () => { kurzorF = null; $('spekKurzor').textContent = '—'; });
  $('spekZobr').value = nast.spekZobr || 'krivka';
  $('spekZobr').addEventListener('change', e => { nast.spekZobr = e.target.value; uloz(); });
  $('spekVaha').value = nast.spekVaha;
  $('spekVaha').addEventListener('change', e => { nast.spekVaha = e.target.value; Z.spicky = null; uloz(); });
  $('spekZamek').addEventListener('click', e => { spekZamek = !spekZamek; e.currentTarget.setAttribute('aria-pressed', String(spekZamek)); });
  $('spekSpicky').addEventListener('click', e => { spekSpicky = !spekSpicky; Z.spicky = null; e.currentTarget.setAttribute('aria-pressed', String(spekSpicky)); });
  (function smyckaSpektra() {
    requestAnimationFrame(smyckaSpektra);
    if (!document.hidden && zalozka === 'spektrum') kresliSpektrum();
  })();

  /* ---------- světlo ---------- */
  const S = { gen: 0, startuje: false, stream: null, track: null, rucni: false, cap: null, t: 0, iso: 0, cekej: 0, timer: 0, senzor: null, demo: false, posledni: null };
  const vzorek = document.createElement('canvas'); vzorek.width = 64; vzorek.height = 48;
  function luxRezim(t, varovani) { const e = $('luxRezim'); e.textContent = t; e.style.color = varovani ? 'var(--warn)' : ''; }
  function zobrazLux(lux, jas, ev, expo, relativni) {
    S.posledni = lux;
    $('luxVelke').innerHTML = (lux == null ? '—' : C(lux, lux < 10 ? 1 : 0)) + '<small>' + (relativni ? 'rel.' : 'lx') + '</small>';
    $('luxJas').textContent = jas == null ? '—' : C(jas * 100, 1);
    $('luxEv').textContent = ev == null ? '—' : C(ev, 1);
    $('luxExpo').textContent = expo || '—';
    $('luxTabulka').querySelectorAll('tr').forEach((tr, i) => {
      const l = J.DOPORUCENI_LUX[i][0], dalsi = J.DOPORUCENI_LUX[i + 1];
      tr.classList.toggle('blizko', !relativni && lux != null && lux >= l * 0.7 && (!dalsi || lux < dalsi[0] * 0.7));
    });
  }
  $('luxTabulka').innerHTML = J.DOPORUCENI_LUX.map(([l, t]) => `<tr><td>${t}</td><td class="cislo">${l.toLocaleString('cs-CZ')}</td></tr>`).join('');
  async function startSvetlo(demo) {
    stopSvetlo();
    S.startuje = !demo;
    $('svetloDemoStitek').hidden = !demo;
    $('luxStart').textContent = '⏹ Zastavit';
    if (demo) {
      S.demo = true; luxRezim('Ukázka se simulovanými hodnotami (kancelář u okna).');
      S.timer = setInterval(() => { const t = performance.now() / 1000, l = 430 + 70 * Math.sin(t / 3); zobrazLux(l * nast.luxFaktor, 0.19, Math.log2(l / 2.5), '1/60 s · ISO 200'); }, 250);
      return;
    }
    if ('AmbientLightSensor' in window) {
      try {
        const s = new window.AmbientLightSensor({ frequency: 4 });
        s.addEventListener('reading', () => zobrazLux(s.illuminance * nast.luxFaktor, null, null, null));
        s.addEventListener('error', () => { s.stop(); S.senzor = null; startKamera(); });
        s.start(); S.senzor = s;
        luxRezim('Měří senzor okolního světla zařízení (nejpřesnější varianta).');
        return;
      } catch (e) { S.senzor = null; }
    }
    startKamera();
  }
  async function startKamera() {
    const gen = ++S.gen;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { luxRezim('Kamera není dostupná (prohlížeč nebo stránka bez https). Zkuste 🧪 Ukázku.', true); $('luxStart').textContent = '📷 Spustit kameru'; return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: nast.kamera, width: { ideal: 320 }, height: { ideal: 240 } } });
      if (gen !== S.gen) { stream.getTracks().forEach(t => t.stop()); return; }
      S.stream = stream;
    } catch (e) { if (gen !== S.gen) return; S.startuje = false; luxRezim('Kameru se nepodařilo spustit (' + e.name + '). Zkontrolujte povolení. Můžete zkusit 🧪 Ukázku.', true); $('luxStart').textContent = '📷 Spustit kameru'; return; }
    S.track = S.stream.getVideoTracks()[0];
    const v = $('luxVideo'); v.srcObject = S.stream; v.hidden = false;
    try { await v.play(); } catch (e) { /* přehraje se po interakci */ }
    const cap = S.track.getCapabilities ? S.track.getCapabilities() : {};
    S.rucni = false;
    if (cap.exposureTime && cap.iso && (cap.exposureMode || []).includes('manual')) {
      S.cap = cap;
      S.t = Math.min(cap.exposureTime.max, Math.max(cap.exposureTime.min, 100));    // jednotky 100 µs → 10 ms
      S.iso = Math.min(cap.iso.max, Math.max(cap.iso.min, 100));
      try { await S.track.applyConstraints({ advanced: [{ exposureMode: 'manual', exposureTime: S.t, iso: S.iso }] }); S.rucni = true; S.cekej = 3; } catch (e) { S.rucni = false; }
    }
    if (gen !== S.gen) return;
    S.startuje = false;
    luxRezim(S.rucni ? 'Pevná expozice řízená stránkou – odhad v luxech z času, ISO a clony (orientační).'
      : 'Prohlížeč nedovolí ruční expozici – automatika kamery vyrovnává jas, takže číslo je jen relativní. Pro lux potřebujete Chrome na Androidu.', !S.rucni);
    S.timer = setInterval(merSvetlo, 250);
  }
  function merSvetlo() {
    const v = $('luxVideo');
    if (!v.videoWidth) return;
    const x = vzorek.getContext('2d', { willReadFrequently: true });
    x.drawImage(v, 0, 0, 64, 48);
    const d = x.getImageData(0, 0, 64, 48).data, jas = J.jasObrazu(d), pre = J.prepal(d);
    if (!S.rucni) return zobrazLux(jas * 1000 * nast.luxFaktor, jas, null, 'automatická', true);
    if (S.cekej > 0) { S.cekej--; return; }
    const cas = S.t * 1e-4;
    const ev = J.ev100(nast.clona, cas, S.iso) + Math.log2(Math.max(jas, 1e-4) / 0.18);
    zobrazLux(J.luxZExpozice(nast.clona, cas, S.iso, jas, nast.luxFaktor), jas, ev, '1/' + Math.round(1 / cas) + ' s · ISO ' + Math.round(S.iso));
    // vlastní automatika: držet obraz mezi tmou a přepalem
    let t = S.t;
    if ((jas > 0.45 || pre > 0.02) && S.t > S.cap.exposureTime.min) t = Math.max(S.cap.exposureTime.min, S.t / 2);
    else if (jas < 0.05 && S.t < S.cap.exposureTime.max) t = Math.min(S.cap.exposureTime.max, S.t * 2);
    if (t !== S.t) { S.t = t; S.cekej = 2; S.track.applyConstraints({ advanced: [{ exposureMode: 'manual', exposureTime: t, iso: S.iso }] }).catch(() => {}); }
  }
  function stopSvetlo() {
    S.gen++; S.startuje = false;
    clearInterval(S.timer);
    if (S.senzor) { try { S.senzor.stop(); } catch (e) { /* nic */ } }
    if (S.stream) S.stream.getTracks().forEach(t => t.stop());
    Object.assign(S, { stream: null, track: null, senzor: null, demo: false, timer: 0 });
    $('luxVideo').hidden = true; $('luxVideo').srcObject = null;
    $('luxStart').textContent = '📷 Spustit kameru'; $('svetloDemoStitek').hidden = true;
  }
  $('luxStart').addEventListener('click', () => (S.timer || S.senzor || S.startuje) ? stopSvetlo() : startSvetlo(false));
  $('luxDemo').addEventListener('click', () => startSvetlo(true));
  $('luxKamera').value = nast.kamera; $('luxClona').value = nast.clona; $('luxFaktor').value = nast.luxFaktor;
  $('luxKamera').addEventListener('change', e => { nast.kamera = e.target.value; uloz(); if (S.stream) startSvetlo(false); });
  $('luxClona').addEventListener('change', e => { const v = parseFloat(e.target.value); if (v > 0.5) { nast.clona = v; uloz(); } else e.target.value = nast.clona; });
  $('luxFaktor').addEventListener('change', e => { const v = parseFloat(e.target.value); if (v > 0) { nast.luxFaktor = v; uloz(); } else e.target.value = nast.luxFaktor; });
  async function kalSvetlo() {
    prepni('svetlo');
    if (S.posledni == null || !(S.timer || S.senzor)) return Dialog.info('Nejdřív spusťte měření (📷 Spustit kameru) a umístěte telefon na místo, kde znáte skutečné osvětlení.');
    const ted = S.posledni;
    const v = await Dialog.zeptej('Teď ukazuji ' + C(ted, 0) + '. Kolik luxů naměřil skutečný luxmetr na stejném místě?', '');
    if (v == null) return;
    const zn = parseFloat(String(v).replace(',', '.'));
    if (!(zn > 0)) return Dialog.chyba('Zadejte kladné číslo v luxech.');
    nast.luxFaktor = Math.round(J.kalibracniFaktor(zn, ted, nast.luxFaktor) * 1e4) / 1e4; uloz();
    $('luxFaktor').value = nast.luxFaktor;
    Dialog.info('Kalibrační faktor je nyní ' + C(nast.luxFaktor, 3) + '.');
  }

  /* ---------- stroboskop ---------- */
  const STR = { gen: 0, bezi: false, raf: 0, timer: 0, t0: 0, stream: null, track: null, svetlo: false, varovano: false };
  let fps = 60;
  (function merFps() {
    const iv = []; let pred = 0;
    (function k(t) { if (pred) iv.push(t - pred); pred = t; if (iv.length < 90) requestAnimationFrame(k); else { fps = J.odhadFps(iv) || 60; infoStrobo(); } })(0);
  })();
  const strF = () => Math.max(0.1, nast.str.f);
  function infoStrobo() {
    const f = strF(), z = nast.str.znacek;
    $('strF').value = Math.round(f * 1000) / 1000;
    $('strRpm').value = Math.round(J.hzNaRpm(f, z) * 10) / 10;
    $('strZnacek').value = z; $('strStrida').value = nast.str.strida; $('strZdroj').value = nast.str.zdroj;
    let t;
    if (nast.str.zdroj === 'displej') {
      const q = J.kvantujNaSnimky(f, fps);
      t = 'Displej ' + fps + ' Hz: blikat lze jen po celých snímcích – skutečně ' + C(q.fSkutecna, 2) + ' Hz (' + q.snimkuNaPeriodu + ' snímků na periodu)'
        + (f > fps / 2 ? '. Nad ' + C(fps / 2, 0) + ' Hz to displej nezvládne.' : Math.abs(q.odchylka) > 0.01 ? '. Pro přesné hodnoty zvolte frekvenci, která dělí ' + fps + '.' : '.');
    } else t = 'Svítilna: přepínání má zpoždění desítky ms, rozumně do 10–15 Hz. Bez záruky přesnosti.';
    $('strInfo').textContent = t;
    $('strKandidati').innerHTML = J.kandidatiRpm(f, z).map(({ k, rpm }) => {
      let popis = 'jedna stojící značka – první shora';
      if (k === 0.5) popis = 'dvě kopie značky naproti sobě';
      else if (k > 1) popis = 'jedna stojící značka (' + k + '× rychlejší)';
      return `<tr${k === 1 ? ' class="blizko"' : ''}><td>${popis}</td><td class="cislo">${C(rpm, rpm < 100 ? 1 : 0)}</td></tr>`;
    }).join('');
  }
  function nastavF(f) { if (f > 0 && isFinite(f)) { nast.str.f = Math.min(1000, f); uloz(); } infoStrobo(); }
  $('strF').addEventListener('change', e => nastavF(parseFloat(e.target.value)));
  $('strRpm').addEventListener('change', e => nastavF(J.rpmNaHz(parseFloat(e.target.value), nast.str.znacek)));
  $('strZnacek').addEventListener('change', e => { const z = Math.max(1, Math.round(+e.target.value) || 1); nast.str.znacek = z; uloz(); infoStrobo(); });
  $('strStrida').addEventListener('change', e => { nast.str.strida = Math.min(50, Math.max(1, +e.target.value || 10)); uloz(); infoStrobo(); });
  $('strZdroj').addEventListener('change', e => { const bezelo = STR.bezi; stopStrobo(); nast.str.zdroj = e.target.value; uloz(); infoStrobo(); if (bezelo) startStrobo(); });
  document.querySelectorAll('[data-krat]').forEach(b => b.addEventListener('click', () => nastavF(strF() * +b.dataset.krat)));
  async function startStrobo() {
    if (!STR.varovano) {
      if (!await Dialog.potvrd('Blikající světlo může u citlivých osob vyvolat epileptický záchvat. Nedívejte se do záblesků dlouho. Pokračovat?')) return;
      STR.varovano = true;
    }
    STR.bezi = true; STR.t0 = performance.now(); $('strStart').textContent = '⏹ Zastavit';
    if (nast.str.zdroj === 'displej') {
      const el = $('zablesky'); el.hidden = false;
      if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
      const k = t => {
        if (!STR.bezi) return;
        const q = J.kvantujNaSnimky(strF(), fps), idx = Math.round((t - STR.t0) * fps / 1000);
        const sviti = idx % q.snimkuNaPeriodu < Math.max(1, Math.round(q.snimkuNaPeriodu * nast.str.strida / 100));
        el.classList.toggle('sviti', sviti);
        STR.raf = requestAnimationFrame(k);
      };
      STR.raf = requestAnimationFrame(k);
      return;
    }
    const gen = ++STR.gen;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (gen !== STR.gen) { stream.getTracks().forEach(t => t.stop()); return; }
      STR.stream = stream;
      STR.track = STR.stream.getVideoTracks()[0];
      const cap = STR.track.getCapabilities ? STR.track.getCapabilities() : {};
      if (!cap.torch) throw new Error('bez svítilny');
    } catch (e) {
      if (gen !== STR.gen) return;
      stopStrobo();
      return Dialog.chyba('Svítilnu tento prohlížeč neumí ovládat (funguje hlavně Chrome na Androidu). Použijte displej.');
    }
    const tik = () => {
      if (!STR.bezi) return;
      const per = 1000 / strF(), sv = per * nast.str.strida / 100, faze = (performance.now() - STR.t0) % per, on = faze < sv;
      if (on !== STR.svetlo) { STR.svetlo = on; STR.track.applyConstraints({ advanced: [{ torch: on }] }).catch(() => {}); }
      STR.timer = setTimeout(tik, Math.max(1, on ? sv - faze : per - faze));
    };
    tik();
  }
  function stopStrobo() {
    STR.gen++;
    if (!STR.bezi && !STR.stream) return;
    STR.bezi = false; cancelAnimationFrame(STR.raf); clearTimeout(STR.timer);
    const el = $('zablesky'); el.hidden = true; el.classList.remove('sviti');
    if (document.fullscreenElement === el) document.exitFullscreen().catch(() => {});
    if (STR.track) STR.track.applyConstraints({ advanced: [{ torch: false }] }).catch(() => {});
    if (STR.stream) setTimeout((s => () => s.getTracks().forEach(t => t.stop()))(STR.stream), 150);
    STR.stream = null; STR.track = null; STR.svetlo = false;
    $('strStart').textContent = '⚡ Spustit';
  }
  $('strStart').addEventListener('click', () => STR.bezi ? stopStrobo() : startStrobo());
  $('zablesky').addEventListener('click', stopStrobo);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && STR.bezi) stopStrobo(); });

  /* ---------- nabídky a příkazy ---------- */
  /* ---------- deník měření ---------- */
  const KLIC_DENIK = 'webapp_meraky_denik';
  let denik = [];
  try { denik = JSON.parse(localStorage.getItem(KLIC_DENIK) || '[]') || []; } catch (e) { denik = []; }
  function ulozDenik() { try { localStorage.setItem(KLIC_DENIK, JSON.stringify(denik)); } catch (e) { Dialog.chyba('Deník se nepodařilo uložit – úložiště prohlížeče je plné.'); } pocetDenik(); }
  const pocetDenik = () => { $('denikPocet').textContent = denik.length ? '(' + denik.length + ')' : ''; };
  const datumSoubor = () => new Date().toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '_');
  function stahni(nazev, obsah, typ) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([obsah], { type: typ + ';charset=utf-8' })); a.download = nazev;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  const NAZVY = {};
  document.querySelectorAll('.nabidka [data-zalozka]').forEach(b => { NAZVY[b.dataset.zalozka] = b.textContent.trim(); });
  /* Hodnoty k zápisu ze starých přístrojů (nové je mají v modulu). */
  const ZAPIS = {
    vodovaha: () => ({ hodnota: $('vodVelke').textContent, detail: $('vodPoloha').textContent + ' · ' + [...$('vodCisla').querySelectorAll('div')].map(d => d.querySelector('b').textContent + ' ' + d.querySelector('span').textContent).join(' · ') }),
    sklon: () => ({ hodnota: $('sklonVelke').textContent, detail: $('sklonProc').textContent + ' · 1 : ' + $('sklonPomer').textContent.replace('1 : ', '') + ($('sklonRel').textContent !== '—' ? ' · od A ' + $('sklonRel').textContent : '') + ' · ' + $('sklonHrana').selectedOptions[0].text }),
    hluk: () => ({ hodnota: $('hlukVelke').textContent, detail: 'Leq ' + $('hlukLeq').textContent + ' · max ' + $('hlukMax').textContent + ' · min ' + $('hlukMin').textContent + ' · ' + $('hlukCas').textContent + ' · LEX,8h ' + $('hlukLex').textContent + (Z.demo ? ' · UKÁZKA' : '') }),
    spektrum: () => ({ hodnota: $('spekF').textContent, detail: $('spekNota').textContent + ' · ' + $('spekRpm').textContent + (Z.demo ? ' · UKÁZKA' : '') }),
    svetlo: () => ({ hodnota: $('luxVelke').textContent, detail: $('luxRezim').textContent.slice(0, 80) + ' · ' + $('luxExpo').textContent }),
    strobo: () => ({ hodnota: C(strF(), 3) + ' Hz', detail: C(J.hzNaRpm(strF(), nast.str.znacek), 1) + ' ot/min · značek ' + nast.str.znacek })
  };
  function zapisDenik(pristroj, hodnota, detail) {
    denik.unshift({ t: Date.now(), p: pristroj, h: hodnota, d: detail || '', n: '' });
    if (denik.length > 1000) denik.length = 1000;
    ulozDenik();
  }
  async function zapis() {
    const f = (MODULY[zalozka] && MODULY[zalozka].zapis) || ZAPIS[zalozka];
    if (!f) return Dialog.info('Otevřete nějaký přístroj – zapíše se jeho aktuální hodnota.');
    const r = f();
    if (!r || r.hodnota == null || /^—/.test(r.hodnota)) return Dialog.info('Přístroj zatím nic nenaměřil.');
    const demo = !!document.querySelector(`[data-panel="${zalozka}"] .demo-stitek:not([hidden])`);
    zapisDenik(NAZVY[zalozka] || zalozka, r.hodnota, (r.detail || '') + (demo && !/UKÁZKA/.test(r.detail || '') ? ' · UKÁZKA' : ''));
    const tl = document.querySelector('[data-prikaz="zapis"]'); tl.textContent = '✔'; setTimeout(() => { tl.innerHTML = '📝<span class="txt"> Zapsat</span>'; }, 900);
  }
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function kresliDenik() {
    $('denikTelo').innerHTML = denik.length ? denik.map((r, i) => `<tr><td style="white-space:nowrap">${esc(new Date(r.t).toLocaleString('cs-CZ'))}</td><td>${esc(r.p)}</td><td class="cislo"><b>${esc(r.h)}</b></td><td class="pozn" style="margin:0">${esc(r.d)}</td><td class="pozn-bunka" contenteditable="plaintext-only" data-i="${i}" data-i18n="ne">${esc(r.n)}</td><td><button class="btn mini" data-smaz="${i}" aria-label="Smazat záznam">✖</button></td></tr>`).join('')
      : '<tr><td colspan="6" class="pozn">Deník je prázdný.</td></tr>';
  }
  $('denikTelo').addEventListener('focusout', e => { const i = e.target.dataset.i; if (i != null && denik[i]) { denik[i].n = e.target.textContent.trim(); ulozDenik(); } });
  $('denikTelo').addEventListener('click', e => { const i = e.target.dataset.smaz; if (i != null) { denik.splice(+i, 1); ulozDenik(); kresliDenik(); } });
  const denikRadky = () => [['čas', 'přístroj', 'hodnota', 'podrobnosti', 'poznámka']].concat(denik.map(r => [new Date(r.t).toLocaleString('cs-CZ'), r.p, r.h, r.d, r.n]));
  $('denikCsv').addEventListener('click', () => denik.length ? stahni('mereni_' + datumSoubor() + '.csv', J.csv(denikRadky()), 'text/csv') : Dialog.info('Deník je prázdný.'));
  $('denikKopie').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(denikRadky().map(r => r.join('\t')).join('\n')); Dialog.info('Zkopírováno – vložíte do tabulky nebo zprávy.'); }
    catch (e) { Dialog.chyba('Schránka není dostupná.'); }
  });
  $('denikSmaz').addEventListener('click', async () => { if (denik.length && await Dialog.potvrd('Smazat všech ' + denik.length + ' záznamů deníku?')) { denik = []; ulozDenik(); kresliDenik(); } });
  pocetDenik();

  /* ---------- displej nezhasíná (Wake Lock) ---------- */
  let zamekDispleje = null, chciDisplej = false;
  async function displej(ano) {
    chciDisplej = ano;
    $('tlDisplej').setAttribute('aria-pressed', String(ano));
    if (ano && !zamekDispleje && navigator.wakeLock && document.visibilityState === 'visible') {
      try { zamekDispleje = await navigator.wakeLock.request('screen'); zamekDispleje.addEventListener('release', () => { zamekDispleje = null; }); }
      catch (e) { chciDisplej = false; $('tlDisplej').setAttribute('aria-pressed', 'false'); Dialog.chyba('Prohlížeč nedovolil držet displej rozsvícený (' + e.name + ').'); }
    } else if (!ano && zamekDispleje) { zamekDispleje.release().catch(() => {}); zamekDispleje = null; }
  }
  $('tlDisplej').addEventListener('click', () => {
    if (!navigator.wakeLock) return Dialog.info('Tento prohlížeč neumí zabránit zhasnutí displeje. Prodlužte dobu do zhasnutí v nastavení telefonu.');
    displej(!chciDisplej);
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && chciDisplej) displej(true); });

  /* ---------- přehled ---------- */
  function senzoryStav() {
    const ano = '✅', mozna = '❔', ne = '❌', https = window.isSecureContext;   // ❔ se nezobrazuje
    const pohyb = typeof DeviceMotionEvent !== 'undefined' && https ? (P.posledni ? ano : mozna) : ne;
    const media = navigator.mediaDevices && navigator.mediaDevices.getUserMedia && https ? mozna : ne;
    return {
      pohyb, media, kompas: typeof DeviceOrientationEvent !== 'undefined' && https ? mozna : ne,
      gps: navigator.geolocation && https ? mozna : ne, vzdy: mozna
    };
  }
  const POPISY = {
    vodovaha: ['🫧', 'naplocho i na hraně', 'pohyb'], sklon: ['📐', 'střechy, rampy, úhel ploch', 'pohyb'], kompas: ['🧭', 'azimut, deklinace, cíl', 'kompas'],
    vyska: ['🌳', 'strom, dům, stožár', 'pohyb'], pravitko: ['📏', 'měření na displeji', 'vzdy'],
    vibrace: ['📳', 'otřesy, frekvence, seismograf', 'pohyb'], otacky: ['💿', 'gramofon, točna', 'pohyb'], kroky: ['🚶', 'kroky, vzdálenost', 'pohyb'], gps: ['🚗', 'rychlost, trasa GPX', 'gps'],
    hluk: ['🔊', 'dB(A), Leq, denní dávka', 'media'], spektrum: ['📊', 'frekvence, vodopád', 'media'], ladicka: ['🎵', 'kytara, housle, chromatická', 'media'], generator: ['🔈', 'tóny, šum, přeladění', 'vzdy'],
    svetlo: ['💡', 'osvětlení v luxech', 'media'], strobo: ['🌀', 'otáčky bliknutím', 'vzdy'], tep: ['❤️', 'puls kamerou', 'media']
  };
  function kresliPrehled() {
    const st = senzoryStav();
    let html = '';
    document.querySelectorAll('.lista [data-nabidka][data-kat]').forEach(k => {
      html += `<div class="kat">${esc(k.textContent.replace('▾', '').trim())}</div>`;
      $(k.dataset.nabidka).querySelectorAll('[data-zalozka]').forEach(b => {
        const z = b.dataset.zalozka, p = POPISY[z] || ['', '', 'vzdy'];
        html += `<button data-zalozka="${z}"><span class="ikona">${p[0]}</span><span>${esc(b.textContent.replace(p[0], '').trim())} ${st[p[2]] === '❔' ? '' : st[p[2]]}</span><small>${esc(p[1])}</small></button>`;
      });
    });
    $('prehledDlazdice').innerHTML = html;
  }
  MODULY.prehled = { start: kresliPrehled };

  const PRIKAZY = {
    napoveda: () => $('dlgNapoveda').showModal(),
    zapis,
    nulaVodovaha: () => { prepni('vodovaha'); nulaVodovaha(); },
    otoceniVodovaha, nulaSklon, kalHluk, kalSvetlo,
    zvukStart: () => ((Z.ctx && !Z.demo) || Z.startuje) ? stopZvuk() : startZvuk(false),
    zvukDemo: () => startZvuk(true),
    zrusKalibrace: async () => {
      if (!await Dialog.potvrd('Vrátit všechny kalibrace (vodováha, sklon, hlukoměr, luxmetr) na výchozí hodnoty?')) return;
      nast.kal = Object.assign({}, VYCHOZI.kal); nast.dbPosun = VYCHOZI.dbPosun; nast.luxFaktor = VYCHOZI.luxFaktor; nast.pxNaMm = null; uloz();
      $('hlukPosun').value = nast.dbPosun; $('luxFaktor').value = nast.luxFaktor;
      Dialog.info('Kalibrace zrušeny.');
    }
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
    const prvni = n.querySelector('button'); if (prvni) prvni.focus();
  }));
  document.addEventListener('keydown', e => {
    const n = document.querySelector('.nabidka:not([hidden])');
    if (!n) return;
    const tl = [...n.querySelectorAll('button')], i = tl.indexOf(document.activeElement);
    if (e.key === 'Escape') { const b = document.querySelector('[data-nabidka][aria-expanded="true"]'); zavriNabidky(); if (b) b.focus(); e.preventDefault(); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { tl[(i + (e.key === 'ArrowDown' ? 1 : tl.length - 1)) % tl.length].focus(); e.preventDefault(); }
  });
  document.addEventListener('click', e => {
    const p = e.target.closest('[data-prikaz]');
    if (p) { e.stopPropagation(); zavriNabidky(); return PRIKAZY[p.dataset.prikaz](); }
    if (!e.target.closest('.nabidka')) zavriNabidky();
    const z = e.target.closest('[data-zalozka]');
    if (z) { zavriNabidky(); prepni(z.dataset.zalozka); }
  });
  $('povolSenzory').addEventListener('click', povolSenzory);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { stopStrobo(); stopZvuk(); stopSvetlo(); } });   // ať nesvítí kontrolka kamery/mikrofonu

  window.MerakyApp = {
    J, $, C, nast, uloz, barvy, platno, minSek, fmtHz, esc, stahni, datumSoubor, zapisDenik, P, Z, odberPohybu,
    prepni, startZvuk, stopZvuk, startSvetlo, startPohyb, aktualniU, uhelObrazovky, hlaskaSenzory,
    get zalozka() { return zalozka; },
    registruj(id, m) { MODULY[id] = m; },
    prikaz(nazev, f) { PRIKAZY[nazev] = f; },
    spust() { infoStrobo(); prepni(zalozka); }
  };
})();

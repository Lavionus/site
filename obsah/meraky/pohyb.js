/* Měřáky – vibrace, otáčky gyroskopem, krokoměr a GPS rychloměr. */
(function () {
  'use strict';
  const M = window.MerakyApp, { J, $, C, nast, uloz, barvy, platno, minSek } = M;
  const ted = () => performance.now();

  /* Ukázková data, když senzor chybí: časovač 100 Hz posílá falešné události devicemotion jen odběratelům tohoto modulu. */
  const odber = [];
  let demoT = 0, demoTimer = 0;
  function demoUdalost() {
    demoT += 0.01;
    const t = demoT, rana = (t % 7) < 0.25 ? Math.exp(-(t % 7) * 12) * 0.9 * Math.sin(2 * Math.PI * 14 * t) : 0;
    const vib = 0.18 * Math.sin(2 * Math.PI * 23.4 * t) + rana;
    const krok = 3 * Math.max(0, Math.sin(2 * Math.PI * 0.9 * t)) ** 3;
    return {
      interval: 10, timeStamp: t * 1000,
      acceleration: { x: 0.4 * vib + (Math.random() - 0.5) * 0.02, y: 0.3 * vib, z: vib + (Math.random() - 0.5) * 0.03 },
      accelerationIncludingGravity: { x: 0.4 * vib, y: 0.3 * vib + 9.81 + krok, z: vib },
      rotationRate: { alpha: 200.4 + 1.5 * Math.sin(2 * Math.PI * 0.555 * t) + (Math.random() - 0.5) * 0.6, beta: 0, gamma: 0 }
    };
  }
  function hlidejDemo() {
    const chce = M.P.demo && ['vibrace', 'otacky', 'kroky'].includes(M.zalozka);
    if (chce && !demoTimer) demoTimer = setInterval(() => { const e = demoUdalost(); odber.forEach(f => f(e)); }, 10);
    if (!chce && demoTimer) { clearInterval(demoTimer); demoTimer = 0; }
  }
  setInterval(hlidejDemo, 500);
  M.odberPohybu.push(e => { if (!M.P.demo) odber.forEach(f => f(e)); });

  /* ---------- 📳 vibrace ---------- */
  nast.vib = Object.assign({ prah: 0.5, osa: 'm' }, nast.vib);
  const VB = { t: [], x: [], y: [], z: [], m: [], fs: null, intervaly: [], zamek: false, udalosti: [], akt: null, raf: 0, grav: null };
  const DELKA = 2048;
  odber.push(e => {
    if (M.zalozka !== 'vibrace' || VB.zamek) return;
    let a = e.acceleration;
    if (!a || a.x == null) {                       // bez „lineárního“ zrychlení: odečíst pomalou gravitaci
      const g = e.accelerationIncludingGravity; if (!g || g.x == null) return;
      VB.grav = VB.grav ? VB.grav.map((v, i) => v + 0.05 * ([g.x, g.y, g.z][i] - v)) : [g.x, g.y, g.z];
      a = { x: g.x - VB.grav[0], y: g.y - VB.grav[1], z: g.z - VB.grav[2] };
    }
    const t = ted(), m = Math.hypot(a.x, a.y, a.z);
    if (e.interval > 0) { VB.intervaly.push(e.interval); if (VB.intervaly.length > 50) VB.intervaly.shift(); }
    VB.t.push(t); VB.x.push(a.x); VB.y.push(a.y); VB.z.push(a.z); VB.m.push(m);
    if (VB.t.length > DELKA) for (const k of ['t', 'x', 'y', 'z', 'm']) VB[k].shift();
    // seismograf: události nad prahem
    if (m >= nast.vib.prah) {
      if (!VB.akt) VB.akt = { zac: new Date(), t0: t, spicka: m, posl: t };
      VB.akt.spicka = Math.max(VB.akt.spicka, m); VB.akt.posl = t;
    } else if (VB.akt && t - VB.akt.posl > 500) {
      VB.udalosti.unshift({ cas: VB.akt.zac, spicka: VB.akt.spicka, trvani: (VB.akt.posl - VB.akt.t0) / 1000 });
      if (VB.udalosti.length > 50) VB.udalosti.pop();
      VB.akt = null; kresliUdalosti();
    }
  });
  function kresliUdalosti() {
    $('vibUdalosti').innerHTML = VB.udalosti.length ? VB.udalosti.map(u => `<tr><td>${u.cas.toLocaleTimeString('cs-CZ')}</td><td class="cislo">${C(u.spicka, 2)}</td><td class="cislo">${C(u.trvani, 1)} s</td></tr>`).join('')
      : '<tr><td colspan="3" class="pozn">zatím nic</td></tr>';
  }
  /* Vzorkování z časů posledních 256 událostí; nahlášený e.interval jen když s nimi souhlasí do 10 % (je přesnější). */
  function vibFs() {
    const n = VB.t.length, k = Math.min(n, 256);
    if (k < 20) return null;
    const zCasu = (k - 1) * 1000 / (VB.t[n - 1] - VB.t[n - k]);
    if (VB.intervaly.length > 5) {
      const s = VB.intervaly.slice().sort((a, b) => a - b), zIntervalu = 1000 / s[s.length >> 1];
      if (Math.abs(zIntervalu / zCasu - 1) < 0.1) return zIntervalu;
    }
    return zCasu;
  }
  function kresliVibrace() {
    const B = barvy(), n = VB.t.length;
    const { x, w, h } = platno($('platnoVibrace'), $('platnoVibrace').clientWidth < 500 ? 0.6 : 0.27);
    const okno = 10000, tKonec = n ? VB.t[n - 1] : ted();
    let i0 = 0; while (i0 < n && VB.t[i0] < tKonec - okno) i0++;
    let max = 0.2; for (let i = i0; i < n; i++) max = Math.max(max, Math.abs(VB.x[i]), Math.abs(VB.y[i]), Math.abs(VB.z[i]), VB.m[i]);
    const roz = Math.pow(2, Math.ceil(Math.log2(max))), py = v => h / 2 - v / roz * (h / 2 - 6), px = t => 34 + (w - 36) * (1 - (tKonec - t) / okno);
    x.font = '11px system-ui'; x.fillStyle = B.muted; x.strokeStyle = B.border; x.lineWidth = 1;
    for (const v of [-roz, -roz / 2, 0, roz / 2, roz]) { x.beginPath(); x.moveTo(34, py(v)); x.lineTo(w, py(v)); x.stroke(); x.fillText(C(v, roz < 2 ? 2 : 1), 0, py(v) + 4); }
    if (nast.vib.prah < roz) { x.strokeStyle = B.danger; x.setLineDash([5, 4]); x.beginPath(); x.moveTo(34, py(nast.vib.prah)); x.lineTo(w, py(nast.vib.prah)); x.stroke(); x.setLineDash([]); }
    const osy = nast.vib.osa === 'm' ? [['m', B.text], ['x', B.danger], ['y', B.ok], ['z', B.accent]] : [[nast.vib.osa, B.accent]];
    for (const [k, barva] of osy) {
      x.strokeStyle = barva; x.lineWidth = k === 'm' ? 1.6 : 1; x.globalAlpha = k === 'm' || nast.vib.osa !== 'm' ? 1 : 0.6; x.beginPath();
      for (let i = i0; i < n; i++) { const X = px(VB.t[i]), Y = py(VB[k][i]); i === i0 ? x.moveTo(X, Y) : x.lineTo(X, Y); }
      x.stroke();
    }
    x.globalAlpha = 1; x.fillStyle = B.muted; x.fillText('−10 s', 36, h - 4); x.textAlign = 'right'; x.fillText('teď', w - 2, h - 4); x.textAlign = 'left';
    if (nast.vib.osa === 'm') { let X = 80; for (const [k, b] of osy) { x.fillStyle = b; x.fillText(k === 'm' ? '|a|' : k, X, 12); X += 28; } }
    // čísla a spektrum z posledních 256/512 vzorků
    const fs = vibFs(); VB.fs = fs;
    const okn = n >= 512 ? 512 : n >= 256 ? 256 : n >= 128 ? 128 : 0;
    let spicka = 0; for (let i = i0; i < n; i++) spicka = Math.max(spicka, VB.m[i]);
    $('vibSpicka').textContent = C(spicka, 2);
    $('vibIntenzita').textContent = J.intenzitaOtresu(spicka);
    $('vibFs').textContent = fs ? C(fs, 0) + ' Hz' : '—';
    const S = platno($('platnoVibSpektrum'), $('platnoVibSpektrum').clientWidth < 500 ? 0.35 : 0.13);
    if (!okn || !fs) { $('vibRms').textContent = '—'; $('vibF').textContent = '—'; return; }
    const sig = Float64Array.from(VB[nast.vib.osa === 'm' ? 'z' : nast.vib.osa].slice(n - okn));
    const sigM = nast.vib.osa === 'm' ? Float64Array.from({ length: okn }, (_, i) => VB.m[n - okn + i]) : sig;
    $('vibRms').textContent = C(nast.vib.osa === 'm'
      ? Math.sqrt(['x', 'y', 'z'].reduce((s, k) => s + J.stredniKvadrat(Float64Array.from(VB[k].slice(n - okn))), 0))
      : J.efektivni(sig), 3);
    // spektrum: u „velikosti“ součet výkonů os (velikost sama zdvojuje frekvenci)
    let amp;
    if (nast.vib.osa === 'm') {
      const A = ['x', 'y', 'z'].map(k => J.amplitudy(Float64Array.from(VB[k].slice(n - okn))));
      amp = A[0].map((_, i) => Math.hypot(A[0][i], A[1][i], A[2][i]));
    } else amp = J.amplitudy(sigM);
    const pk = J.spickaAmplitud(amp, fs, 1);
    $('vibF').textContent = pk && pk.amp > 0.005 ? C(pk.f, 1) + ' Hz (' + C(pk.f * 60, 0) + '/min)' : '—';
    const { x: s, w: sw, h: sh } = S, maxA = Math.max(0.01, ...amp.slice(1)), df = fs / okn;
    s.fillStyle = B.muted; s.font = '11px system-ui';
    const bw = (sw - 34) / (amp.length - 1);
    s.fillStyle = B.accent;
    for (let i = 1; i < amp.length; i++) { const v = amp[i] / maxA * (sh - 18); s.fillRect(34 + (i - 1) * bw, sh - 14 - v, Math.max(1, bw - 0.5), v); }
    s.fillStyle = B.muted; s.textAlign = 'center';
    for (let f = 0; f <= fs / 2; f += fs / 2 > 60 ? 20 : 10) s.fillText(f + (f === 0 ? ' Hz' : ''), 34 + (f / df - 1) * bw + bw / 2, sh - 2);
    s.textAlign = 'left'; s.fillText(C(maxA, 2), 0, 12);
  }
  $('vibOsa').value = nast.vib.osa; $('vibPrah').value = nast.vib.prah;
  $('vibOsa').addEventListener('change', e => { nast.vib.osa = e.target.value; uloz(); });
  $('vibPrah').addEventListener('change', e => { const v = parseFloat(e.target.value); if (v > 0) { nast.vib.prah = v; uloz(); } else e.target.value = nast.vib.prah; });
  $('vibZamek').addEventListener('click', e => { VB.zamek = !VB.zamek; e.currentTarget.setAttribute('aria-pressed', String(VB.zamek)); });
  $('vibNuluj').addEventListener('click', () => { for (const k of ['t', 'x', 'y', 'z', 'm']) VB[k] = []; VB.udalosti = []; VB.akt = null; kresliUdalosti(); });
  M.registruj('vibrace', {
    start() { cancelAnimationFrame(VB.raf); const s = () => { VB.raf = requestAnimationFrame(s); if (!document.hidden) kresliVibrace(); }; s(); hlidejDemo(); },
    stop() { cancelAnimationFrame(VB.raf); hlidejDemo(); },
    zapis: () => ({ hodnota: $('vibRms').textContent + ' m/s² RMS', detail: 'špička ' + $('vibSpicka').textContent + ' m/s² · ' + $('vibF').textContent + ' · osa ' + $('vibOsa').selectedOptions[0].text })
  });

  /* ---------- 💿 otáčky gyroskopem ---------- */
  nast.ot = Object.assign({ osa: 'z', jmen: 'auto' }, nast.ot);
  const OT = { h: [], raf: 0 };
  odber.push(e => {
    if (M.zalozka !== 'otacky') return;
    const r = e.rotationRate; if (!r) return;
    const w = { z: r.alpha, x: r.beta, y: r.gamma }[nast.ot.osa];
    if (w == null) return;
    OT.h.push([ted(), w]); if (OT.h.length > 6000) OT.h.shift();
  });
  function kresliOtacky() {
    const t = ted(), posl = OT.h.filter(([c]) => c > t - 5000).map(([, w]) => w);
    const akt = OT.h.filter(([c]) => c > t - 300).map(([, w]) => w);
    const w = akt.length ? akt.reduce((a, b) => a + b, 0) / akt.length : null;
    const k = J.kolisani(posl.map(J.stSNaRpm));
    $('otVelke').innerHTML = (w == null ? '—' : C(Math.abs(J.stSNaRpm(w)), Math.abs(w) < 600 ? 2 : 1)) + '<small>ot/min' + (w && Math.abs(w) > 3 ? (w > 0 ? ' ↺' : ' ↻') : '') + '</small>';
    $('otStS').textContent = C(w, 1);
    $('otPrumer').textContent = k ? C(Math.abs(k.prumer), 2) : '—';
    $('otKolisani').textContent = k ? C(k.procent, 2) + ' %' : '—';
    let gram = '—';
    if (k && nast.ot.jmen === 'auto' && Math.abs(k.prumer) > 20) {
      const p = Math.abs(k.prumer), jm = J.OTACKY_GRAMOFONU.reduce((a, b) => Math.abs(b - p) < Math.abs(a - p) ? b : a);
      const o = (p / jm - 1) * 100;
      gram = (o >= 0 ? '+' : '−') + C(Math.abs(o), 2) + ' % k ' + (jm === 100 / 3 ? '33⅓' : jm);
    }
    $('otGramofon').textContent = gram;
    const { x, w: sir, h } = platno($('platnoOtacky'), $('platnoOtacky').clientWidth < 500 ? 0.55 : 0.3), B = barvy();
    const data = OT.h.filter(([c]) => c > t - 30000).map(([c, v]) => [c, Math.abs(J.stSNaRpm(v))]);
    if (data.length < 2) return;
    let lo = Infinity, hi = -Infinity; for (const [, v] of data) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    const stred = (lo + hi) / 2, roz = Math.max(0.5, (hi - lo) / 2 * 1.2);
    const py = v => h / 2 - (v - stred) / roz * (h / 2 - 8), px = c => 40 + (sir - 42) * (1 - (t - c) / 30000);
    x.font = '11px system-ui'; x.fillStyle = B.muted; x.strokeStyle = B.border; x.lineWidth = 1;
    for (const v of [stred - roz * 0.8, stred, stred + roz * 0.8]) { x.beginPath(); x.moveTo(40, py(v)); x.lineTo(sir, py(v)); x.stroke(); x.fillText(C(v, 1), 0, py(v) + 4); }
    x.strokeStyle = B.accent; x.lineWidth = 1.5; x.beginPath();
    data.forEach(([c, v], i) => i ? x.lineTo(px(c), py(v)) : x.moveTo(px(c), py(v))); x.stroke();
    x.fillText('−30 s', 42, h - 4);
  }
  $('otOsa').value = nast.ot.osa; $('otJmen').value = nast.ot.jmen;
  $('otOsa').addEventListener('change', e => { nast.ot.osa = e.target.value; OT.h = []; uloz(); });
  $('otJmen').addEventListener('change', e => { nast.ot.jmen = e.target.value; uloz(); });
  $('otNuluj').addEventListener('click', () => { OT.h = []; });
  M.registruj('otacky', {
    start() { cancelAnimationFrame(OT.raf); const s = () => { OT.raf = requestAnimationFrame(s); if (!document.hidden) kresliOtacky(); }; s(); hlidejDemo(); },
    stop() { cancelAnimationFrame(OT.raf); hlidejDemo(); },
    zapis: () => ({ hodnota: $('otPrumer').textContent + ' ot/min', detail: 'kolísání ' + $('otKolisani').textContent + ' · ' + $('otGramofon').textContent })
  });

  /* ---------- 🚶 krokoměr ---------- */
  nast.krok = Object.assign({ delka: 0.72, citlivost: 1.2 }, nast.krok);
  const KR = { bezi: false, st: {}, casy: [], chuze: 0, kal: null };
  function naKrok(e) {
    if (!KR.bezi) return;
    const g = e.accelerationIncludingGravity; if (!g || g.x == null) return;
    const t = M.P.demo ? e.timeStamp : ted();
    if (J.detektorKroku(KR.st, Math.hypot(g.x, g.y, g.z), t, nast.krok.citlivost)) {
      const p = KR.casy[KR.casy.length - 1];
      if (p != null && t - p < 2000) KR.chuze += (t - p) / 1000;
      KR.casy.push(t); if (KR.casy.length > 20) KR.casy.shift();
      kresliKroky();
    }
  }
  odber.push(naKrok);
  function kresliKroky() {
    const n = KR.st.kroky || 0, c = KR.casy;
    $('krokVelke').innerHTML = n + '<small>kroků</small>';
    const d = n * nast.krok.delka;
    $('krokVzd').textContent = d < 1000 ? C(d, 0) + ' m' : C(d / 1000, 2) + ' km';
    const kad = c.length > 4 ? (c.length - 1) * 60000 / (c[c.length - 1] - c[0]) : null;
    $('krokKadence').textContent = kad && kad < 300 ? C(kad, 0) : '—';
    $('krokCas').textContent = minSek(KR.chuze);
    $('krokRychl').textContent = kad && kad < 300 ? C(kad * nast.krok.delka * 60 / 1000, 1) : '—';
  }
  function krokStart(ano) {
    KR.bezi = ano;
    $('krokStart').textContent = ano ? '⏸ Pozastavit' : '▶ Počítat';
    if (ano) M.startPohyb();
    hlidejDemoKroky();
  }
  let demoKroky = 0;
  function hlidejDemoKroky() {   // ukázka krokoměru i mimo jeho záložku, dokud počítá
    const chce = KR.bezi && M.P.demo && M.zalozka !== 'kroky';
    if (chce && !demoKroky) demoKroky = setInterval(() => { for (let i = 0; i < 5; i++) { naKrok(demoUdalost()); } }, 50);
    if (!chce && demoKroky) { clearInterval(demoKroky); demoKroky = 0; }
  }
  $('krokStart').addEventListener('click', () => krokStart(!KR.bezi));
  $('krokNuluj').addEventListener('click', () => { KR.st = {}; KR.casy = []; KR.chuze = 0; kresliKroky(); });
  $('krokDelka').value = nast.krok.delka; $('krokCitlivost').value = String(nast.krok.citlivost);
  $('krokDelka').addEventListener('change', e => { const v = parseFloat(e.target.value); if (v > 0.2 && v < 2) { nast.krok.delka = v; uloz(); kresliKroky(); } else e.target.value = nast.krok.delka; });
  $('krokVyska').addEventListener('change', e => { const v = parseFloat(e.target.value); if (v >= 80 && v <= 230) { nast.krok.delka = J.delkaKroku(v); $('krokDelka').value = nast.krok.delka; uloz(); kresliKroky(); } });
  $('krokCitlivost').addEventListener('change', e => { nast.krok.citlivost = +e.target.value; uloz(); });
  M.prikaz('kalKroky', async () => {
    M.prepni('kroky');
    if (!await Dialog.potvrd('Odměřte si rovný úsek 20 m (pásmo, dlaždice, značky na hřišti). Postavte se na začátek, telefon držte jako při chůzi a stiskněte OK.')) return;
    const bezelo = KR.bezi, start = KR.st.kroky || 0;
    krokStart(true);
    const ok = await Dialog.potvrd('Teď ujděte normální chůzí 20 m a na konci stiskněte OK.');
    const n = (KR.st.kroky || 0) - start;
    krokStart(bezelo);
    if (!ok) return;
    if (n < 8) return Dialog.chyba('Napočítal jsem jen ' + n + ' kroků – zkuste vyšší citlivost nebo telefon v ruce u boku.');
    nast.krok.delka = Math.round(20 / n * 100) / 100; uloz();
    $('krokDelka').value = nast.krok.delka; kresliKroky();
    Dialog.info('Napočítáno ' + n + ' kroků → délka kroku ' + C(nast.krok.delka, 2) + ' m.');
  });
  M.registruj('kroky', {
    start() { kresliKroky(); hlidejDemo(); hlidejDemoKroky(); },
    stop() { hlidejDemo(); setTimeout(hlidejDemoKroky); },
    zapis: () => ({ hodnota: (KR.st.kroky || 0) + ' kroků', detail: $('krokVzd').textContent + ' · ' + $('krokCas').textContent + ' · kadence ' + $('krokKadence').textContent + ' · krok ' + C(nast.krok.delka, 2) + ' m' })
  });

  /* ---------- 🚗 GPS ---------- */
  nast.gpsJed = nast.gpsJed || 'km/h';
  const G = { watch: null, demo: 0, body: [], posl: null, vzd: 0, max: 0, vPohybu: 0, start: null, rych: [], v: null, chyba: '' };
  function nulujGps() { Object.assign(G, { body: [], posl: null, vzd: 0, max: 0, vPohybu: 0, start: G.watch != null || G.demo ? ted() : null, rych: [], v: null }); kresliGps(); }
  function naPolohu(p) {
    const c = p.coords, t = p.timestamp || Date.now();
    const bod = { lat: c.latitude, lon: c.longitude, alt: c.altitude, acc: c.accuracy, t, kurz: c.heading };
    let v = c.speed != null && !isNaN(c.speed) ? c.speed : null;
    if (G.posl) {
      const d = J.haversin(G.posl.lat, G.posl.lon, bod.lat, bod.lon), dt = (t - G.posl.t) / 1000;
      if (J.pricistUsek(d, G.posl.acc, bod.acc)) {
        if (v == null && dt > 0) v = d / dt;
        if (bod.kurz == null || isNaN(bod.kurz)) bod.kurz = J.azimutBodu(G.posl.lat, G.posl.lon, bod.lat, bod.lon);
        G.vzd += d; G.body.push(bod); G.posl = bod;
        if (v > 0.5) G.vPohybu += dt;
      } else if (v == null && dt > 5) v = 0;
    } else if (bod.acc <= 30) { G.posl = bod; G.body.push(bod); }
    if (G.body.length > 20000) G.body.shift();
    G.v = v; G.bod = bod;
    if (v != null) { G.max = Math.max(G.max, v); G.rych.push([ted(), v]); if (G.rych.length > 1800) G.rych.shift(); }
    G.chyba = '';
    kresliGps();
  }
  function naChybu(e) {
    G.chyba = e.code === 1 ? 'Přístup k poloze byl odmítnut – povolte ho v nastavení prohlížeče.' : e.code === 3 ? 'Čekám na signál GPS… (venku pod širým nebem to jde rychleji)' : 'Polohu se nepodařilo zjistit (' + e.message + ').';
    if (e.code === 1) stopGps();
    kresliGps();
  }
  function startGps() {
    if (!navigator.geolocation) return Dialog.chyba('Prohlížeč nemá přístup k poloze (nebo stránka neběží přes https).');
    stopGps(); nulujGps();
    G.watch = navigator.geolocation.watchPosition(naPolohu, naChybu, { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 });
    G.start = ted(); G.chyba = 'Čekám na první polohu…';
    $('gpsStart').textContent = '⏹ Stop'; kresliGps();
  }
  function stopGps() {
    if (G.watch != null) navigator.geolocation.clearWatch(G.watch);
    clearInterval(G.demo); G.watch = null; G.demo = 0;
    $('gpsStart').textContent = '▶ Start'; $('gpsDemo').hidden = true;
  }
  function demoGps() {
    stopGps(); nulujGps(); G.start = ted();
    $('gpsDemo').hidden = false; $('gpsStart').textContent = '⏹ Stop';
    let fi = 0; const t0 = Date.now();
    G.demo = setInterval(() => {
      const s = (Date.now() - t0) / 1000, v = 11 + 4 * Math.sin(s / 9);
      fi += v / 400;
      naPolohu({ timestamp: Date.now(), coords: { latitude: 50.08 + 0.0036 * Math.sin(fi), longitude: 14.42 + 0.0056 * Math.cos(fi), altitude: 250 + 8 * Math.sin(fi * 2), accuracy: 6, speed: v, heading: null } });
    }, 1000);
  }
  function kresliGps() {
    const k = J.JEDNOTKY_RYCHLOSTI[nast.gpsJed], jed = nast.gpsJed;
    $('gpsVelke').innerHTML = (G.v == null ? '—' : C(G.v * k, G.v * k < 10 ? 1 : 0)) + '<small>' + jed + '</small>';
    $('gpsMax').textContent = G.max ? C(G.max * k, 1) + ' ' + jed : '—';
    $('gpsPrumer').textContent = G.vPohybu > 2 ? C(G.vzd / G.vPohybu * k, 1) + ' ' + jed : '—';
    $('gpsVzd').textContent = G.vzd < 1000 ? C(G.vzd, 0) + ' m' : C(G.vzd / 1000, 2) + ' km';
    $('gpsCas').textContent = G.start ? minSek((ted() - G.start) / 1000) : '0:00';
    $('gpsTempo').textContent = J.tempo(G.v) || '—';
    const b = G.bod;
    $('gpsVyska').textContent = b && b.alt != null ? C(b.alt, 0) + ' m' : '—';
    $('gpsKurz').textContent = b && b.kurz != null && !isNaN(b.kurz) && G.v > 0.5 ? Math.round(b.kurz) + '° ' + J.svetovaStrana(b.kurz) : '—';
    $('gpsPresnost').textContent = b ? '±' + C(b.acc, 0) + ' m' : '—';
    $('gpsPoloha').textContent = b ? J.dms(b.lat, 'N', 'S') + ', ' + J.dms(b.lon, 'E', 'W') + ' (' + b.lat.toFixed(6) + ', ' + b.lon.toFixed(6) + ')' : '';
    $('gpsStav').textContent = G.chyba || (G.watch != null || G.demo ? (b && b.acc > 30 ? 'Slabý signál – vzdálenost se nepřičítá.' : 'Měřím.') : 'Stiskněte ▶ Start.');
    const { x, w, h } = platno($('platnoGps'), $('platnoGps').clientWidth < 500 ? 0.5 : 0.25), B = barvy();
    const t = ted(), data = G.rych.filter(([c]) => c > t - 300000);
    const max = Math.max(10 / 3.6, ...data.map(d => d[1])) * k, krok = max > 100 ? 50 : max > 40 ? 20 : max > 15 ? 5 : 2, hi = Math.ceil(max / krok) * krok;
    const py = v => h - 14 - v / hi * (h - 22), px = c => 34 + (w - 36) * (1 - (t - c) / 300000);
    x.font = '11px system-ui'; x.fillStyle = B.muted; x.strokeStyle = B.border; x.lineWidth = 1;
    for (let v = 0; v <= hi; v += krok) { x.beginPath(); x.moveTo(34, py(v)); x.lineTo(w, py(v)); x.stroke(); x.fillText(v, 2, py(v) + 4); }
    x.fillText('−5 min', 36, h - 2);
    if (data.length > 1) { x.strokeStyle = B.accent; x.lineWidth = 2; x.beginPath(); data.forEach(([c, v], i) => i ? x.lineTo(px(c), py(v * k)) : x.moveTo(px(c), py(v * k))); x.stroke(); }
  }
  setInterval(() => { if (M.zalozka === 'gps' && (G.watch != null || G.demo) && !document.hidden) kresliGps(); }, 1000);
  function gpx() {
    if (G.body.length < 2) return Dialog.info('Trasa je zatím prázdná – spusťte ▶ Start a pohněte se.');
    const pts = G.body.map(b => `<trkpt lat="${b.lat.toFixed(7)}" lon="${b.lon.toFixed(7)}">${b.alt != null ? `<ele>${b.alt.toFixed(1)}</ele>` : ''}<time>${new Date(b.t).toISOString()}</time></trkpt>`).join('\n');
    M.stahni('trasa_' + M.datumSoubor() + '.gpx', `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Měřáky z telefonu" xmlns="http://www.topografix.com/GPX/1/1">\n<trk><name>Trasa ${new Date(G.body[0].t).toLocaleString('cs-CZ')}</name><trkseg>\n${pts}\n</trkseg></trk>\n</gpx>\n`, 'application/gpx+xml');
  }
  $('gpsStart').addEventListener('click', () => (G.watch != null || G.demo) ? stopGps() : startGps());
  $('gpsDemoTl').addEventListener('click', demoGps);
  $('gpsNuluj').addEventListener('click', nulujGps);
  $('gpsGpx').addEventListener('click', gpx);
  $('gpsJednotky').value = nast.gpsJed;
  $('gpsJednotky').addEventListener('change', e => { nast.gpsJed = e.target.value; uloz(); kresliGps(); });
  M.registruj('gps', {
    start: kresliGps,
    zapis: () => G.bod ? { hodnota: $('gpsVelke').textContent.replace(nast.gpsJed, ' ' + nast.gpsJed), detail: 'vzdálenost ' + $('gpsVzd').textContent + ' · max ' + $('gpsMax').textContent + ' · výška ' + $('gpsVyska').textContent + ' · ' + G.bod.lat.toFixed(6) + ', ' + G.bod.lon.toFixed(6) + ' ±' + Math.round(G.bod.acc) + ' m' } : null
  });
})();

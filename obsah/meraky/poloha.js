/* Měřáky – kompas, výškoměr a pravítko (výpočty v jadro.js, společné věci v app.js → MerakyApp). */
(function () {
  'use strict';
  const M = window.MerakyApp, { J, $, C, nast, uloz, barvy, platno } = M;

  /* ---------- 🧭 kompas ---------- */
  nast.komp = Object.assign({ sever: 'zem', dekl: J.deklinaceCR(new Date().getFullYear()), cil: null }, nast.komp);
  const K = { posl: 0, mag: null, zdroj: '', zamek: null, poslouchame: false, raf: 0, demo: false, senzorMag: null };
  function naAbsolutni(e) {
    let mag = null;
    if (typeof e.webkitCompassHeading === 'number' && e.webkitCompassHeading >= 0) {
      // iOS: směr horní hrany zařízení; naplocho přičíst natočení obrazovky (na šířku je „nahoře“ jiná hrana)
      mag = J.uhel360(e.webkitCompassHeading + (Math.abs(M.aktualniU()[2]) > 0.7 ? M.uhelObrazovky() : 0)); K.zdroj = 'Kompas zařízení (iOS)' + (e.webkitCompassAccuracy > 0 ? ', přesnost ±' + Math.round(e.webkitCompassAccuracy) + '°' : '') + '.';
    } else if ((e.type === 'deviceorientationabsolute' || e.absolute) && e.alpha != null) {
      const u = M.aktualniU(), naplocho = Math.abs(u[2]) > 0.7;
      mag = naplocho ? J.azimutHrany(e.alpha, M.uhelObrazovky()) : J.azimutKamery(e.alpha, e.beta, e.gamma);
      K.zdroj = 'Absolutní orientace z magnetometru – ' + (naplocho ? 'směr horní hrany (telefon naplocho).' : 'směr zadní kamery (telefon svisle).');
    }
    if (mag == null) return;
    K.mag = J.vyhladUhel(K.mag, mag, 0.25); K.posl = performance.now();
  }
  function startKompas() {
    if (!K.poslouchame) {
      K.poslouchame = true;
      if ('ondeviceorientationabsolute' in window) addEventListener('deviceorientationabsolute', naAbsolutni);
      addEventListener('deviceorientation', naAbsolutni);
    }
    if ('Magnetometer' in window && !K.senzorMag) {
      try {
        const s = new window.Magnetometer({ frequency: 10 });
        s.addEventListener('reading', () => { $('kompMagBlok').hidden = false; $('kompUT').textContent = C(Math.hypot(s.x, s.y, s.z), 1); });
        s.addEventListener('error', () => { K.senzorMag = null; });
        s.start(); K.senzorMag = s;
      } catch (e) { K.senzorMag = null; }
    }
    cancelAnimationFrame(K.raf);
    const smycka = () => { K.raf = requestAnimationFrame(smycka); if (!document.hidden) kresliKompas(); };
    smycka();
  }
  function kresliKompas() {
    K.demo = !K.posl;   // v klidu Chrome nové události neposílá – po první skutečné hodnotě už ukázka nikdy
    let mag = K.mag;
    if (K.demo) { mag = J.uhel360(40 * Math.sin(performance.now() / 5000) + 25); K.zdroj = 'Absolutní orientace (magnetometr) není k dispozici – ukázka. Na počítači kompas chybí; na iPhonu povolte senzory.'; }
    if (K.zamek != null) mag = K.zamek;
    K.zobr = mag;
    $('kompDemo').hidden = !K.demo;
    const zem = J.zemepisny(mag, nast.komp.dekl), hlavni = nast.komp.sever === 'zem' ? zem : mag;
    $('kompVelke').innerHTML = Math.round(hlavni) % 360 + '<small>°</small>';
    $('kompStrana').textContent = J.svetovaStrana(hlavni);
    $('kompMag').textContent = C(mag, 1) + '°';
    $('kompZem').textContent = C(zem, 1) + '°';
    const cil = nast.komp.cil;
    const odch = cil == null ? null : J.rozdilUhlu(hlavni, cil);
    $('kompCilOdch').textContent = odch == null ? '—' : (odch > 0 ? '→ ' : odch < 0 ? '← ' : '') + C(Math.abs(odch), 0) + '°';
    $('kompZdroj').textContent = K.zdroj;
    $('kompHodnoty').classList.toggle('zamceno', K.zamek != null);
    // růžice: sever natočený podle směru, ryska nahoře = směr telefonu
    const { x, w, h } = platno($('platnoKompas'), 1), B = barvy(), cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 22;
    x.save(); x.translate(cx, cy); x.rotate(-hlavni * Math.PI / 180);
    x.strokeStyle = B.border; x.lineWidth = 2; x.beginPath(); x.arc(0, 0, R, 0, 7); x.stroke();
    x.textAlign = 'center'; x.textBaseline = 'middle';
    for (let a = 0; a < 360; a += 5) {
      const dl = a % 90 === 0 ? 16 : a % 30 === 0 ? 11 : a % 10 === 0 ? 7 : 4;
      x.save(); x.rotate(a * Math.PI / 180);
      x.strokeStyle = a === 0 ? B.danger : B.muted; x.lineWidth = a % 30 === 0 ? 2 : 1;
      x.beginPath(); x.moveTo(0, -R); x.lineTo(0, -R + dl); x.stroke();
      if (a % 30 === 0) {
        x.translate(0, -R + 32);
        x.fillStyle = a === 0 ? B.danger : a % 90 === 0 ? B.text : B.muted;
        x.font = (a % 90 === 0 ? '700 ' + Math.round(R / 7) : Math.round(R / 11)) + 'px system-ui';
        x.fillText(a % 90 === 0 ? ['S', 'V', 'J', 'Z'][a / 90] : String(a), 0, 0);
      }
      x.restore();
    }
    if (cil != null) { x.save(); x.rotate(cil * Math.PI / 180); x.fillStyle = B.warn; x.beginPath(); x.moveTo(0, -R - 2); x.lineTo(-9, -R - 18); x.lineTo(9, -R - 18); x.closePath(); x.fill(); x.restore(); }
    // střelka
    x.fillStyle = B.danger; x.beginPath(); x.moveTo(0, -R * 0.62); x.lineTo(-R * 0.07, 0); x.lineTo(R * 0.07, 0); x.closePath(); x.fill();
    x.fillStyle = B.muted; x.beginPath(); x.moveTo(0, R * 0.62); x.lineTo(-R * 0.07, 0); x.lineTo(R * 0.07, 0); x.closePath(); x.fill();
    x.restore();
    x.fillStyle = B.accent; x.beginPath(); x.moveTo(cx, cy - R - 2); x.lineTo(cx - 8, cy - R - 20); x.lineTo(cx + 8, cy - R - 20); x.closePath(); x.fill();
    x.fillStyle = B.panel; x.strokeStyle = B.text; x.lineWidth = 1.5; x.beginPath(); x.arc(cx, cy, 6, 0, 7); x.fill(); x.stroke();
  }
  const hlavniSmer = () => { const m = K.zobr; return m == null ? null : nast.komp.sever === 'zem' ? J.zemepisny(m, nast.komp.dekl) : m; };
  $('kompSever').value = nast.komp.sever;
  $('kompSever').addEventListener('change', e => { nast.komp.sever = e.target.value; uloz(); });
  $('kompDekl').value = nast.komp.dekl;
  $('kompDekl').addEventListener('change', e => { const v = parseFloat(e.target.value); if (isFinite(v) && Math.abs(v) <= 90) { nast.komp.dekl = v; uloz(); } else e.target.value = nast.komp.dekl; });
  const ukazCil = () => { $('kompCil').value = nast.komp.cil == null ? '' : Math.round(nast.komp.cil); };
  ukazCil();
  $('kompCil').addEventListener('change', e => { const v = parseFloat(e.target.value); nast.komp.cil = isFinite(v) ? J.uhel360(v) : null; uloz(); ukazCil(); });
  $('kompZamerit').addEventListener('click', () => { const h = hlavniSmer(); if (h == null) return; nast.komp.cil = h; uloz(); ukazCil(); });
  $('kompZrusCil').addEventListener('click', () => { nast.komp.cil = null; uloz(); ukazCil(); });
  $('kompZamek').addEventListener('click', e => {
    K.zamek = K.zamek != null ? null : K.zobr;
    e.currentTarget.setAttribute('aria-pressed', String(K.zamek != null));
  });
  function stopKompas() {
    cancelAnimationFrame(K.raf);
    if (K.senzorMag) { try { K.senzorMag.stop(); } catch (e) { /* nic */ } K.senzorMag = null; }
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopKompas(); else if (M.zalozka === 'kompas') startKompas(); });
  M.registruj('kompas', {
    start: startKompas,
    stop: stopKompas,
    zapis: () => {
      const h = hlavniSmer();
      return h == null ? null : { hodnota: Math.round(h) + '° ' + J.svetovaStrana(h), detail: (nast.komp.sever === 'zem' ? 'zeměpisný' : 'magnetický') + ' · magnetický ' + C(K.zobr, 1) + '° · deklinace ' + C(nast.komp.dekl, 1) + '°' };
    }
  });

  /* ---------- 🌳 výškoměr ---------- */
  nast.vyska = Object.assign({ metoda: 'oko', oko: 1.6, vzd: 20 }, nast.vyska);
  const V = { pata: null, vrchol: null, stream: null, raf: 0, gen: 0, startuje: false };
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopKameraVyska(); });
  const elevace = () => J.elevaceKamery(M.aktualniU());
  function spocitejVysku() {
    const { pata, vrchol } = V;
    let d = null, H = null;
    if (nast.vyska.metoda === 'oko') {
      if (pata != null) d = J.vzdalenostZVysky(nast.vyska.oko, pata);
      if (d != null && vrchol != null) H = J.vyskaZeVzdalenosti(d, vrchol, pata);
    } else {
      d = nast.vyska.vzd;
      if (vrchol != null) H = pata != null ? J.vyskaZeVzdalenosti(d, vrchol, pata) : d * Math.tan(vrchol / 57.29578) + nast.vyska.oko;
    }
    $('vyskaVelke').innerHTML = (H == null ? '—' : C(H, H < 10 ? 2 : 1)) + '<small>m</small>';
    $('vyskaVzd').textContent = d == null ? (nast.vyska.metoda === 'oko' && pata != null ? 'pata nad obzorem' : '—') : C(d, 1) + ' m';
    $('vyskaUPata').textContent = pata == null ? '—' : C(pata, 1) + '°';
    $('vyskaUVrchol').textContent = vrchol == null ? '—' : C(vrchol, 1) + '°';
    return { H, d };
  }
  function metoda() {
    $('vyskaPoleVzd').hidden = nast.vyska.metoda !== 'vzd';
    $('vyskaPoleOko').hidden = false;
    $('vyskaPoleOko').firstChild.textContent = nast.vyska.metoda === 'oko' ? 'Telefon nad zemí (m)' : 'Telefon nad zemí (m, jen bez paty)';
    spocitejVysku();
  }
  $('vyskaMetoda').value = nast.vyska.metoda; $('vyskaOko').value = nast.vyska.oko; $('vyskaVzdVstup').value = nast.vyska.vzd;
  $('vyskaMetoda').addEventListener('change', e => { nast.vyska.metoda = e.target.value; uloz(); metoda(); });
  $('vyskaOko').addEventListener('change', e => { const v = parseFloat(e.target.value); if (v > 0) { nast.vyska.oko = v; uloz(); } else e.target.value = nast.vyska.oko; spocitejVysku(); });
  $('vyskaVzdVstup').addEventListener('change', e => { const v = parseFloat(e.target.value); if (v > 0) { nast.vyska.vzd = v; uloz(); } else e.target.value = nast.vyska.vzd; spocitejVysku(); });
  $('vyskaPata').addEventListener('click', () => { V.pata = elevace(); spocitejVysku(); });
  $('vyskaVrchol').addEventListener('click', () => { V.vrchol = elevace(); spocitejVysku(); });
  async function kameraVyska() {
    if (V.stream || V.startuje) return stopKameraVyska();
    const gen = ++V.gen; V.startuje = true;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return Dialog.chyba('Kamera není dostupná (prohlížeč nebo stránka bez https). Zaměřujte podél hrany telefonu.');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (gen !== V.gen) return stream.getTracks().forEach(t => t.stop());
      V.stream = stream; V.startuje = false;
    } catch (e) { if (gen !== V.gen) return; V.startuje = false; return Dialog.chyba('Kameru se nepodařilo spustit (' + e.name + '). Zaměřovat jde i bez ní – podél delší hrany telefonu.'); }
    const v = $('vyskaVideo'); v.srcObject = V.stream; v.hidden = false; v.play().catch(() => {});
    $('vyskaKamera').textContent = '⏹ Kamera';
  }
  function stopKameraVyska() {
    V.gen++; V.startuje = false;
    if (V.stream) V.stream.getTracks().forEach(t => t.stop());
    V.stream = null; $('vyskaVideo').hidden = true; $('vyskaVideo').srcObject = null; $('vyskaKamera').textContent = '📷 Kamera';
  }
  $('vyskaKamera').addEventListener('click', kameraVyska);
  M.registruj('vyska', {
    start() {
      metoda();
      cancelAnimationFrame(V.raf);
      const s = () => { V.raf = requestAnimationFrame(s); if (!document.hidden) $('vyskaUhel').textContent = C(elevace(), 1) + '°'; };
      s();
    },
    stop() { cancelAnimationFrame(V.raf); stopKameraVyska(); },
    zapis() {
      const r = spocitejVysku();
      return r.H == null ? null : { hodnota: C(r.H, 2) + ' m', detail: 'vzdálenost ' + C(r.d, 1) + ' m · pata ' + C(V.pata, 1) + '° · vrchol ' + C(V.vrchol, 1) + '°' };
    }
  });

  /* ---------- 📏 pravítko ---------- */
  const odhadPxNaMm = () => (matchMedia('(pointer: coarse)').matches ? 160 : 96) / 25.4;
  const R = { a: 20, b: 200, tah: null, info: null };
  const pxMm = () => nast.pxNaMm || odhadPxNaMm();
  nast.pravJed = nast.pravJed || 'mm';
  function kresliPravitko() {
    const c = $('platnoPravitko'), cela = c.classList.contains('cela-obr');
    const { x, w, h } = platno(c, cela ? innerHeight / Math.max(1, innerWidth) : c.clientWidth < 500 ? 0.6 : 0.25), B = barvy(), k = pxMm();
    R.a = Math.min(Math.max(0, R.a), w); R.b = Math.min(Math.max(0, R.b), w);
    const palce = nast.pravJed === 'in', jed = palce ? 25.4 / 16 : 1;          // krok stupnice v mm
    x.strokeStyle = B.text; x.fillStyle = B.text; x.lineWidth = 1; x.font = '12px system-ui'; x.textAlign = 'center';
    for (let i = 0; i * jed * k <= w; i++) {
      const X = Math.round(i * jed * k) + 0.5;
      const dl = palce ? (i % 16 === 0 ? 0.32 : i % 8 === 0 ? 0.24 : i % 4 === 0 ? 0.17 : i % 2 === 0 ? 0.12 : 0.08) : (i % 10 === 0 ? 0.3 : i % 5 === 0 ? 0.2 : 0.12);
      x.beginPath(); x.moveTo(X, 0); x.lineTo(X, Math.min(h * dl, 30 + h * dl * 0.3)); x.stroke();
      if ((palce && i % 16 === 0) || (!palce && i % 10 === 0)) x.fillText(palce ? i / 16 : i / 10, X, Math.min(h * 0.32, 40) + 14);
    }
    x.textAlign = 'left'; x.fillStyle = B.muted; x.fillText(palce ? 'in' : 'cm', 4, h - 6);
    // čelisti
    const lo = Math.min(R.a, R.b), hi = Math.max(R.a, R.b);
    x.fillStyle = B.accent; x.globalAlpha = 0.12; x.fillRect(lo, 0, hi - lo, h); x.globalAlpha = 1;
    for (const p of [R.a, R.b]) {
      x.strokeStyle = B.accent; x.lineWidth = 2; x.beginPath(); x.moveTo(p, 0); x.lineTo(p, h); x.stroke();
      x.fillStyle = B.accent; x.beginPath(); x.arc(p, h * 0.72, 13, 0, 7); x.fill();
      x.fillStyle = B.panel; x.beginPath(); x.moveTo(p - 5, h * 0.72); x.lineTo(p - 1, h * 0.72 - 4); x.lineTo(p - 1, h * 0.72 + 4); x.fill(); x.beginPath(); x.moveTo(p + 5, h * 0.72); x.lineTo(p + 1, h * 0.72 - 4); x.lineTo(p + 1, h * 0.72 + 4); x.fill();
    }
    const mm = (hi - lo) / k;
    x.fillStyle = B.text; x.font = '700 ' + Math.round(Math.min(32, h / 6)) + 'px system-ui'; x.textAlign = 'center';
    x.fillText(palce ? C(J.mmNaPalce(mm), 3) + '″' : C(mm, 1) + ' mm', Math.min(w - 80, Math.max(80, (lo + hi) / 2)), h * 0.5);
    if (cela) { x.font = '22px system-ui'; x.textAlign = 'right'; x.fillText('✖', w - 12, h - 14); }
    x.textAlign = 'left';
    R.info = { w, h, cela };
    $('pravDelka').textContent = C(mm, 1) + ' mm';
    $('pravPalce').textContent = C(J.mmNaPalce(mm), 3) + '″';
    $('pravMeritko').textContent = C(k, 3);
    $('pravNekal').hidden = !!nast.pxNaMm;
  }
  const c = $('platnoPravitko');
  c.addEventListener('pointerdown', e => {
    const r = c.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
    if (R.info && R.info.cela && px > R.info.w - 50 && py > R.info.h - 50) { celaObr(false); return; }
    R.tah = Math.abs(px - R.a) <= Math.abs(px - R.b) ? 'a' : 'b';
    R[R.tah] = px; c.setPointerCapture(e.pointerId); kresliPravitko();
  });
  c.addEventListener('pointermove', e => { if (!R.tah) return; R[R.tah] = e.clientX - c.getBoundingClientRect().left; kresliPravitko(); });
  c.addEventListener('pointerup', () => { R.tah = null; });
  addEventListener('resize', () => { if (M.zalozka === 'pravitko') kresliPravitko(); });
  function celaObr(ano) {
    c.classList.toggle('cela-obr', ano);
    if (ano && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
    if (!ano && document.fullscreenElement) document.exitFullscreen().catch(() => {});
    requestAnimationFrame(kresliPravitko);
  }
  $('pravCela').addEventListener('click', () => celaObr(true));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && c.classList.contains('cela-obr')) celaObr(false); });
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && c.classList.contains('cela-obr')) celaObr(false); });
  $('pravNula').addEventListener('click', () => { R.a = 0; R.b = Math.min(c.clientWidth - 2, 50 * pxMm()); kresliPravitko(); });
  $('pravJednotky').value = nast.pravJed;
  $('pravJednotky').addEventListener('change', e => { nast.pravJed = e.target.value; uloz(); kresliPravitko(); });
  M.prikaz('kalPravitko', async () => {
    M.prepni('pravitko');
    const k = pxMm(), px = Math.abs(R.b - R.a);
    if (px < 40) return Dialog.info('Nejdřív roztáhněte čelisti: předmět známé délky (platební kartu) přiložte k levé čelisti a pravou dosuňte na jeho konec.');
    const v = await Dialog.zeptej('Kolik milimetrů je skutečně mezi čelistmi? (Platební karta: 85,6 mm delší strana, 54 mm kratší.) Teď ukazuji ' + C(px / k, 1) + ' mm.', '85,6');
    if (v == null) return;
    const mm = parseFloat(String(v).replace(',', '.'));
    if (!(mm >= 5 && mm <= 1000)) return Dialog.chyba('Zadejte délku v milimetrech (5–1000).');
    nast.pxNaMm = Math.round(J.pxNaMm(px, mm) * 1e4) / 1e4; uloz(); kresliPravitko();
    Dialog.info('Kalibrace uložena: ' + C(nast.pxNaMm, 3) + ' px na mm.');
  });
  M.registruj('pravitko', {
    start() { requestAnimationFrame(() => { if (R.b - R.a < 5) R.b = R.a + 50 * pxMm(); kresliPravitko(); }); },
    stop() { if (c.classList.contains('cela-obr')) celaObr(false); },
    zapis() { const mm = Math.abs(R.b - R.a) / pxMm(); return { hodnota: C(mm, 1) + ' mm', detail: C(J.mmNaPalce(mm), 3) + '″' + (nast.pxNaMm ? '' : ' · NEKALIBROVÁNO') }; }
  });
})();

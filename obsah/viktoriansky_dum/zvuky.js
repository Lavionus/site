// Zvuky Viktoriánského domu – vše syntetizované ve Web Audio, žádné zvukové soubory.
// VDUM_ZVUK.efekt('nalezeno'|'vedle'|'napoveda'|'vyhra'), .kulisa(idPokoje|null), .prepni() → zapnuto?, .zapnuto()
const VDUM_ZVUK = (() => {
  const KLIC = 'webapp_hra_viktordum_zvuk';
  let zap = true;
  try { zap = localStorage.getItem(KLIC) !== '0'; } catch { /* bez úložiště zůstane zapnuto */ }
  let ac = null, hlavni = null, sum = null, kulisa = null;

  // kontext vzniká až při první akci uživatele (prohlížeč jinak zvuk nepustí)
  function kontext() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ac = new AC();
      hlavni = ac.createGain(); hlavni.gain.value = .7; hlavni.connect(ac.destination);
      const n = ac.sampleRate * 2;
      sum = ac.createBuffer(1, n, ac.sampleRate);
      const d = sum.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ac.state === 'suspended' && !document.hidden) ac.resume();
    return ac;
  }
  for (const u of ['pointerdown', 'keydown']) addEventListener(u, () => { if (zap) kontext(); }, true);
  document.addEventListener('visibilitychange', () => {
    if (!ac) return;
    if (document.hidden) ac.suspend(); else if (zap) ac.resume();
  });

  // krátký úder filtrovaného šumu (lupnutí ohně, tiknutí, ťuknutí)
  function uder(t, cil, f, q, hlasitost, delka, typ = 'bandpass') {
    const s = ac.createBufferSource(); s.buffer = sum; s.playbackRate.value = .8 + Math.random() * .4;
    const fl = ac.createBiquadFilter(); fl.type = typ; fl.frequency.value = f; fl.Q.value = q;
    const g = ac.createGain();
    g.gain.setValueAtTime(hlasitost, t); g.gain.exponentialRampToValueAtTime(.0001, t + delka);
    s.connect(fl); fl.connect(g); g.connect(cil);
    s.start(t, Math.random() * 1.5, delka + .02);
  }
  function ton(t, cil, f, hlasitost, delka, typ = 'sine', f2 = 0) {
    const o = ac.createOscillator(); o.type = typ;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + delka);
    const g = ac.createGain();
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(hlasitost, t + .008);
    g.gain.exponentialRampToValueAtTime(.0001, t + delka);
    o.connect(g); g.connect(cil);
    o.start(t); o.stop(t + delka + .05);
  }

  const EFEKTY = {
    nalezeno: t => { ton(t, hlavni, 1318, .12, .6); ton(t + .07, hlavni, 1976, .08, .8); ton(t, hlavni, 2637, .03, .5); },
    vedle: t => uder(t, hlavni, 260, .7, .3, .09, 'lowpass'),
    napoveda: t => [880, 1109, 1319, 1760].forEach((f, i) => ton(t + i * .06, hlavni, f, .05, .5)),
    vyhra: t => [523, 659, 784, 1047, 1319].forEach((f, i) => ton(t + i * .11, hlavni, f, .09, .9, 'triangle')),
  };
  function efekt(jmeno) {
    if (!zap || !kontext() || ac.state !== 'running') return;
    EFEKTY[jmeno](ac.currentTime + .01);
  }

  /* Kulisy pokojů: každý zdroj si rozvrhuje události dopředu (plánovač běží 4× za sekundu).
     interval = [min, max] s, nebo pevný krok; udalost(t, cil, n) = n-tá událost v čase t. */
  const ZDROJE = {
    krb: { interval: [.08, .7], udalost: (t, c) => uder(t, c, 1200 + Math.random() * 4000, 2.5, .04 + Math.random() * .1, .012 + Math.random() * .03) },
    hukot: { hukot: [160, .05] },
    hodiny: { interval: 1, udalost: (t, c, n) => uder(t, c, n % 2 ? 2600 : 2100, 8, .09, .025) },
    hodinky: { interval: .4, udalost: (t, c, n) => uder(t, c, n % 2 ? 4200 : 3700, 10, .035, .015) },
    kyvadlo: { interval: .73, udalost: (t, c, n) => uder(t, c, n % 2 ? 1700 : 1500, 6, .05, .03) },
    kapky: { interval: [1.2, 4.5], udalost: (t, c) => ton(t, c, 900 + Math.random() * 700, .05, .12, 'sine', 380) },
    ptaci: { interval: [1.5, 6], udalost: (t, c) => { const f = 2200 + Math.random() * 1600; for (let i = 0; i < 2 + Math.random() * 4; i++) ton(t + i * .11, c, f, .025, .09, 'sine', f * 1.35); } },
    sklep: { hukot: [90, .06] },
  };
  const POKOJE = {
    salon: ['krb', 'hukot', 'hodiny'], knihovna: ['krb', 'hukot'], pracovna: ['krb', 'hukot', 'hodiny'], kulecnik: ['krb', 'hukot'],
    jidelna: ['krb', 'hukot'], hala: ['kyvadlo'], loznice: ['hodiny'], satna: ['hodiny'], sici: ['hodiny'], detsky: ['hodiny'],
    hudebni: ['kyvadlo'], atelier: ['hodiny'], kabinet: ['hodiny'], puda: ['kapky'], hodinar: ['hodiny', 'hodinky', 'kyvadlo'],
    sklep: ['sklep', 'kapky'], koupelna: ['kapky'], kuchyne: ['kapky', 'hodiny'], zahrada: ['ptaci', 'kapky'],
  };
  let planovac = 0;
  function zastavKulisu() {
    if (!kulisa) return;
    const k = kulisa; kulisa = null;
    k.gain.gain.setTargetAtTime(0, ac.currentTime, .3);
    setTimeout(() => { k.gain.disconnect(); k.hukoty.forEach(h => h.stop()); }, 1500);
  }
  function spustKulisu(id) {
    if (!kontext() || ac.state !== 'running' || !POKOJE[id]) return;
    const g = ac.createGain();
    g.gain.setValueAtTime(0, ac.currentTime); g.gain.setTargetAtTime(.8, ac.currentTime, .6);
    g.connect(hlavni);
    const k = { id, gain: g, zdroje: [], hukoty: [] };
    for (const jm of POKOJE[id]) {
      const z = ZDROJE[jm];
      if (z.hukot) {   // tichý trvalý šum (oheň, sklep)
        const s = ac.createBufferSource(); s.buffer = sum; s.loop = true;
        const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = z.hukot[0];
        const hg = ac.createGain(); hg.gain.value = z.hukot[1];
        s.connect(fl); fl.connect(hg); hg.connect(g); s.start();
        k.hukoty.push(s);
      } else k.zdroje.push({ z, dalsi: ac.currentTime + .3 + Math.random(), n: 0 });
    }
    kulisa = k;
  }
  let chtenaKulisa = null;
  function planuj() {
    if (!zap || !ac || ac.state !== 'running') return;
    if (chtenaKulisa !== (kulisa && kulisa.id)) { zastavKulisu(); if (chtenaKulisa) spustKulisu(chtenaKulisa); }
    if (!kulisa) return;
    const do_ = ac.currentTime + 1;
    for (const zd of kulisa.zdroje) {
      while (zd.dalsi < do_) {
        zd.z.udalost(zd.dalsi, kulisa.gain, zd.n++);
        const iv = zd.z.interval;
        zd.dalsi += Array.isArray(iv) ? iv[0] + Math.random() * (iv[1] - iv[0]) : iv;
      }
    }
  }
  function nastavKulisu(id) {
    chtenaKulisa = id;
    if (!planovac) planovac = setInterval(planuj, 250);
  }

  function prepni() {
    zap = !zap;
    try { localStorage.setItem(KLIC, zap ? '1' : '0'); } catch { /* jen pro tuto návštěvu */ }
    if (!zap && ac) { zastavKulisu(); ac.suspend(); }
    if (zap) kontext();
    return zap;
  }
  return { efekt, kulisa: nastavKulisu, prepni, zapnuto: () => zap };
})();

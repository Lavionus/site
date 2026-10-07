// Nad krajinou — zvuk: vše syntetizované přes Web Audio (žádné soubory, žádný ScriptProcessor).
// Motory (4 hlasy, frekvence průchodu listů ∝ otáčkám), šum vrtulí, „bublání“ v proplachu, vítr,
// ptáci / cvrčci podle denní doby, šumění lesa, voda, déšť, nárazy, pípání (arm, baterie), závěrka.
// Posluchač = kamera; v pohledu LOS / volná se motory tlumí vzdáleností (+ mírný Doppler).
// API: D.zvuk.hlasitost(0..1), D.zvuk.ztlum(bool) — uloženo v localStorage 'webapp_dron_zvuk'.
(function (D) {
  'use strict';
  const KLIC = 'webapp_dron_zvuk';
  const PROHLIZEC = typeof window !== 'undefined' && typeof document !== 'undefined';

  // ======================================================================
  // Čistá logika (testuje se v node)
  // ======================================================================
  const Z = {};
  const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  Z.clamp = clamp;

  // zvukové profily typů dronů: fMax = frekvence průchodu listů při plných otáčkách (Hz)
  Z.PROFILY = {
    kamera: { fMax: 240, vlna: 'triangle', harm: 0.45, filtr: 1500, q: 0.8, sum: 0.30, sumNasob: 6, hlas: 0.50 },  // měkké bzučení
    fpv:    { fMax: 860, vlna: 'sawtooth', harm: 0.30, filtr: 5200, q: 2.0, sum: 0.45, sumNasob: 4, hlas: 0.42 },  // agresivní kvílení
    whoop:  { fMax: 700, vlna: 'square',   harm: 0.25, filtr: 3200, q: 5.0, sum: 0.55, sumNasob: 5, hlas: 0.38 },  // bzučivé v kruzích
  };
  Z.profil = typ => Z.PROFILY[typ] || Z.PROFILY.kamera;
  // mírně rozladěné motory → zázněje
  Z.ROZLADENI = [1, 1.0071, 0.9943, 1.0118];
  Z.frekvence = (profil, otacky, i) => profil.fMax * Math.max(0.05, clamp(otacky, 0, 1.2)) * Z.ROZLADENI[i & 3];
  // akustický výkon roste rychle s otáčkami
  Z.hlasitostMotoru = otacky => Math.pow(clamp(otacky, 0, 1.2), 1.6);
  // útlum se vzdáleností (1/r od referenční vzdálenosti)
  Z.utlum = (dist, ref) => { ref = ref || 6; return Math.min(1, ref / Math.max(dist, 1e-3)); };
  // pohlcování vysokých frekvencí vzduchem → mezní frekvence dolní propusti
  Z.mezniVzdalenost = dist => clamp(20000 / (1 + Math.max(0, dist - 5) / 40), 600, 20000);
  // Doppler: vr = rychlost vzdalování zdroje od posluchače (m/s, kladná = vzdaluje se)
  Z.doppler = vr => clamp(343 / (343 + clamp(vr, -120, 120)), 0.8, 1.25);
  // proplach vrtulí: rychlé klesání a nízký plyn → bublání (0..1)
  Z.proplach = (vy, tah) => smooth(1.5, 5, -vy) * (0.35 + 0.65 * smooth(0.6, 0.25, tah));
  // denní doba
  Z.ptaci = h => Math.max(smooth(4.3, 5.8, h) * (1 - smooth(19.5, 21, h)) * (0.45 + 0.55 * Math.max(1 - Math.abs(h - 6.5) / 3, 0)), 0);
  Z.cvrcci = h => Math.max(smooth(18.5, 20.5, h), 1 - smooth(1, 4, h));
  // šum větru od rychlosti letu (vzduchu kolem posluchače)
  Z.vitrRychlost = s => Math.pow(smooth(2, 30, s), 1.3);

  D.ZVUK = Z;

  // ======================================================================
  // Prohlížeč
  // ======================================================================
  let nast = { hlasitost: 0.7, ztlum: false };
  if (PROHLIZEC) {
    try { const u = JSON.parse(localStorage.getItem(KLIC) || 'null'); if (u) nast = { hlasitost: clamp(+u.hlasitost || 0, 0, 1), ztlum: !!u.ztlum }; } catch (e) { /* nic */ }
  }
  const ulozNast = () => { try { localStorage.setItem(KLIC, JSON.stringify(nast)); } catch (e) { /* nic */ } };

  let ac = null, G = null;            // AudioContext a graf uzlů
  let ctxHry = null;
  const stavZ = { pauza: false, skryto: false, armed: false, bateriePip: 0, ambCas: 0, les: 0, voda: 0, ptaciFraze: 0, tahPred: 0, hodina: 12 };

  function vytvorKontext() {
    if (ac) { if (ac.state === 'suspended' && !stavZ.pauza && !stavZ.skryto) ac.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { ac = new AC({ latencyHint: 'interactive' }); } catch (e) { ac = null; return; }
    postavGraf();
    if (ctxHry && ctxHry.dron) postavMotory(ctxHry.dron.typ);
    if (ac.state === 'suspended') ac.resume().catch(() => {});
  }

  function sumBuffer(sekund) {
    const n = Math.floor(ac.sampleRate * sekund), b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0);
    let s = 12345;                                       // deterministický bílý šum
    for (let i = 0; i < n; i++) { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; d[i] = s / 0x3fffffff - 1; }
    return b;
  }
  function zdrojSumu(posun) {
    const s = ac.createBufferSource(); s.buffer = G.sum; s.loop = true; s.start(0, posun % G.sum.duration);
    return s;
  }
  function filtr(typ, f, q) { const b = ac.createBiquadFilter(); b.type = typ; b.frequency.value = f; if (q != null) b.Q.value = q; return b; }
  function zesil(v) { const g = ac.createGain(); g.gain.value = v; return g; }
  function lfo(f, typ) { const o = ac.createOscillator(); o.type = typ || 'sine'; o.frequency.value = f; o.start(); return o; }
  const cil = (param, v, tau) => param.setTargetAtTime(v, ac.currentTime, tau || 0.05);

  function postavGraf() {
    G = {};
    G.sum = sumBuffer(2.3);
    G.master = zesil(nast.ztlum ? 0 : nast.hlasitost);
    G.komp = ac.createDynamicsCompressor();
    G.komp.threshold.value = -14; G.komp.ratio.value = 4; G.komp.attack.value = 0.005; G.komp.release.value = 0.2;
    G.master.connect(G.komp).connect(ac.destination);

    // motory: hlasy → filtr → VCA proplachu → útlum vzdálenosti → vzduch (dolní propust) → panoráma
    G.motorPan = ac.createStereoPanner ? ac.createStereoPanner() : zesil(1);
    G.motorVzduch = filtr('lowpass', 20000, 0.5);
    G.motorUtlum = zesil(0);
    G.vca = zesil(1);
    G.vca.connect(G.motorUtlum).connect(G.motorVzduch).connect(G.motorPan).connect(G.master);
    // bublání proplachu: dvě nesouměřitelná LFO → amplituda VCA
    G.washHloubka = zesil(0);
    lfo(9.3).connect(G.washHloubka); lfo(13.7, 'triangle').connect(G.washHloubka); lfo(4.1).connect(G.washHloubka);
    G.washHloubka.connect(G.vca.gain);
    // šum vrtulí
    G.vrtSum = zdrojSumu(0.1);
    G.vrtFiltr = filtr('bandpass', 1500, 0.9);
    G.vrtZes = zesil(0);
    G.vrtSum.connect(G.vrtFiltr).connect(G.vrtZes).connect(G.vca);

    // vítr kolem posluchače (rychlost letu)
    G.vitrFiltr = filtr('bandpass', 500, 0.6); G.vitrZes = zesil(0);
    zdrojSumu(0.4).connect(G.vitrFiltr).connect(G.vitrZes).connect(G.master);
    // okolí
    G.amb = zesil(1); G.amb.connect(G.master);
    G.ambVitrZes = zesil(0); zdrojSumu(0.7).connect(filtr('lowpass', 380, 0.7)).connect(G.ambVitrZes).connect(G.amb);
    // les: širokopásmové šumění s pomalými poryvy
    G.lesZes = zesil(0); const lesMod = zesil(1); const lm = zesil(0.35); lfo(0.13).connect(lm); lfo(0.31, 'triangle').connect(lm); lm.connect(lesMod.gain);
    zdrojSumu(1.1).connect(filtr('bandpass', 950, 0.35)).connect(lesMod).connect(G.lesZes).connect(G.amb);
    // voda: zurčení (pásmo 1,5–3 kHz s rychlou modulací)
    G.vodaZes = zesil(0); const vMod = zesil(1); const vm = zesil(0.4); lfo(3.1).connect(vm); lfo(7.7, 'triangle').connect(vm); lfo(1.3).connect(vm); vm.connect(vMod.gain);
    zdrojSumu(1.5).connect(filtr('bandpass', 2200, 0.7)).connect(filtr('lowpass', 5000, 0.5)).connect(vMod).connect(G.vodaZes).connect(G.amb);
    // déšť
    G.destZes = zesil(0);
    zdrojSumu(1.9).connect(filtr('highpass', 1200, 0.5)).connect(filtr('lowpass', 9000, 0.5)).connect(G.destZes).connect(G.amb);
    // cvrčci: nosná ~4,5 kHz, rychlé pulzy (28 Hz) v cvrkotech (~2,5 Hz)
    G.cvrcciZes = zesil(0); G.cvrcciZes.connect(G.amb);
    for (const [f, puls, cvrk, pan] of [[4450, 28, 2.4, -0.4], [4720, 31, 2.9, 0.5]]) {
      const nos = lfo(f);
      const brana = zesil(0.5); const bm = zesil(0.5); lfo(puls, 'square').connect(bm); bm.connect(brana.gain);
      const obal = zesil(0.5); const om = zesil(0.5); lfo(cvrk, 'square').connect(om); om.connect(obal.gain);
      const p = ac.createStereoPanner ? ac.createStereoPanner() : zesil(1); if (p.pan) p.pan.value = pan;
      nos.connect(brana).connect(obal).connect(p).connect(G.cvrcciZes);
    }
    // jednorázové efekty
    G.sfx = zesil(1); G.sfx.connect(G.master);
    G.motory = null;
  }

  // čtyři hlasy motorů podle typu dronu
  function postavMotory(typ) {
    if (!ac || !G) return;
    if (G.motory) { for (const m of G.motory.hlasy) { try { m.o1.stop(); m.o2.stop(); } catch (e) { /* nic */ } m.zes.disconnect(); } G.motorFiltr.disconnect(); }
    const P = Z.profil(typ);
    G.motorFiltr = filtr('lowpass', P.filtr, P.q);
    G.motorFiltr.connect(G.vca);
    const hlasy = [];
    for (let i = 0; i < 4; i++) {
      const o1 = ac.createOscillator(); o1.type = P.vlna; o1.frequency.value = P.fMax * 0.1;
      const o2 = ac.createOscillator(); o2.type = 'sine'; o2.frequency.value = P.fMax * 0.2;
      const h = zesil(P.harm), zes = zesil(0);
      o1.connect(zes); o2.connect(h).connect(zes); zes.connect(G.motorFiltr);
      o1.start(); o2.start();
      hlasy.push({ o1, o2, zes });
    }
    G.motory = { typ, P, hlasy };
  }

  // ---------- jednorázové zvuky ----------
  function pip(f, kdy, delka, hl) {
    const t = ac.currentTime + (kdy || 0), o = ac.createOscillator(), g = zesil(0);
    o.type = 'square'; o.frequency.value = f;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(hl || 0.06, t + 0.005); g.gain.setValueAtTime(hl || 0.06, t + delka - 0.01); g.gain.linearRampToValueAtTime(0, t + delka);
    o.connect(filtr('lowpass', 3500, 0.7)).connect(g).connect(G.sfx);
    o.start(t); o.stop(t + delka + 0.02);
  }
  function davkaSumu(kdy, delka, typ, f, hl, q) {
    const t = ac.currentTime + (kdy || 0), s = ac.createBufferSource(), g = zesil(0);
    s.buffer = G.sum;
    g.gain.setValueAtTime(hl, t); g.gain.exponentialRampToValueAtTime(0.0005, t + delka);
    s.connect(filtr(typ, f, q == null ? 0.7 : q)).connect(g).connect(G.sfx);
    s.start(t, Math.random() * 1.5); s.stop(t + delka + 0.05);
  }
  function naraz(sila, havarie) {
    if (!ac || !G) return;
    const u = clamp(sila / 8, 0.15, 1.2) * (G.posledniUtlum != null ? Math.max(0.15, G.posledniUtlum) : 1);
    const t = ac.currentTime, o = ac.createOscillator(), g = zesil(0);
    o.type = 'sine'; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.35);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.7 * u, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.45);
    o.connect(g).connect(G.sfx); o.start(t); o.stop(t + 0.5);
    davkaSumu(0, 0.25, 'lowpass', 900, 0.5 * u);
    if (havarie) { davkaSumu(0.02, 0.12, 'highpass', 2500, 0.35 * u); davkaSumu(0.09, 0.09, 'bandpass', 3800, 0.25 * u, 2); }
  }
  function zaverka() {
    if (!ac || !G) return;
    davkaSumu(0, 0.035, 'highpass', 3000, 0.3, 0.8);
    davkaSumu(0.07, 0.05, 'bandpass', 2200, 0.25, 1.5);
  }
  // ptačí fráze: několik tónů s glissandem
  function ptak(hl) {
    const t0 = ac.currentTime + 0.02, zakl = 2300 + Math.random() * 3200, n = 2 + Math.floor(Math.random() * 6);
    const p = ac.createStereoPanner ? ac.createStereoPanner() : zesil(1); if (p.pan) p.pan.value = Math.random() * 1.6 - 0.8;
    const g = zesil(hl); p.connect(g).connect(G.amb);
    const styl = Math.random();
    let t = t0;
    for (let i = 0; i < n; i++) {
      const d = 0.05 + Math.random() * (styl < 0.5 ? 0.06 : 0.14);
      const o = ac.createOscillator(), e = zesil(0);
      const f1 = zakl * (0.85 + Math.random() * 0.3), f2 = f1 * (styl < 0.33 ? 1.35 : styl < 0.66 ? 0.72 : 1.05);
      o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + d);
      e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(1, t + 0.012); e.gain.linearRampToValueAtTime(0, t + d);
      o.connect(e).connect(p); o.start(t); o.stop(t + d + 0.02);
      t += d + 0.03 + Math.random() * 0.09;
    }
    stavZ.ptaciFraze++;
    setTimeout(() => { stavZ.ptaciFraze--; g.disconnect(); }, (t - t0 + 0.3) * 1000);
  }

  // ---------- okolí (vzorkuje terén jednou za ~0,3 s) ----------
  const _m = [0, 0, 0, 0];
  function vzorkujOkoli(ctx, x, y, z) {
    const t = ctx.teren; if (!t) return;
    let les = 0;
    for (const [dx, dz] of [[0, 0], [35, 0], [-35, 0], [0, 35], [0, -35]]) { t.maska(x + dx, z + dz, _m); les += _m[0]; }
    stavZ.les = les / (5 * 255);
    let dist = Infinity;
    for (const r of [0, 25, 60, 110]) {
      const n = r === 0 ? 1 : 8;
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2, hl = t.hladina(x + Math.cos(a) * r, z + Math.sin(a) * r);
        if (hl > -1e3) { dist = Math.min(dist, Math.hypot(r, Math.max(0, y - hl))); }
      }
      if (dist < Infinity) break;
    }
    stavZ.voda = dist === Infinity ? 0 : clamp(1 - dist / 140, 0, 1);
    stavZ.vyskaNadZemi = y - t.vyska(x, z);
  }

  const _v = [0, 0, 0];
  function update(ctx, dt) {
    ctxHry = ctx;
    // pauza → uspat
    if (ctx.pauza !== stavZ.pauza) {
      stavZ.pauza = ctx.pauza;
      if (ac) { if (ctx.pauza) ac.suspend().catch(() => {}); else if (!stavZ.skryto) ac.resume().catch(() => {}); }
    }
    if (!ac && navigator.getGamepads) {                               // gesto z gamepadu
      try { for (const g of navigator.getGamepads()) if (g && g.buttons && g.buttons.some(b => b && b.pressed)) { vytvorKontext(); break; } } catch (e) { /* nic */ }
    }
    if (!ac || !G || ctx.pauza || ac.state !== 'running') return;
    const d = ctx.dron; if (!d) return;
    if (!G.motory || G.motory.typ !== d.typ) postavMotory(d.typ);
    const K = ctx.kamera, kam = ctx.kam || {}, rezim = kam.rezim || 'chase';
    const lx = K.position.x, ly = K.position.y, lz = K.position.z;
    const dx = d.p[0] - lx, dy = d.p[1] - ly, dz = d.p[2] - lz, dist = Math.hypot(dx, dy, dz);
    const naDronu = rezim === 'fpv' || rezim === 'gimbal';

    // --- motory ---
    let utlum = 1, dop = 1, mezni = 20000, pan = 0;
    if (!naDronu) {
      utlum = Z.utlum(dist, 6);
      mezni = Z.mezniVzdalenost(dist);
      if (rezim === 'los' || rezim === 'volna') {
        const vr = dist > 0.5 ? (d.v[0] * dx + d.v[1] * dy + d.v[2] * dz) / dist : 0;   // vzdalování od posluchače
        dop = Z.doppler(vr);
      }
      if (dist > 0.5 && K.matrixWorldInverse) {                     // panoráma podle polohy dronu v obraze
        const e = K.matrixWorldInverse.elements;
        const cx = e[0] * d.p[0] + e[4] * d.p[1] + e[8] * d.p[2] + e[12];
        pan = clamp(cx / dist, -1, 1) * 0.8;
      }
    }
    G.posledniUtlum = utlum;
    const P = G.motory.P, mot = d.motory || [0, 0, 0, 0];
    const bezi = d.armed !== false;
    let soucet = 0;
    for (let i = 0; i < 4; i++) {
      const ot = bezi ? (mot[i] || 0) : 0, h = G.motory.hlasy[i];
      const f = Z.frekvence(P, ot, i) * dop;
      cil(h.o1.frequency, f, 0.02); cil(h.o2.frequency, f * 2.01, 0.02);
      cil(h.zes.gain, Z.hlasitostMotoru(ot) * P.hlas * 0.25 * (ot > 0.02 ? 1 : 0), 0.03);
      soucet += ot;
    }
    const prum = soucet / 4;
    // průraz plynu: rychlý nárůst tahu krátce přidá šum
    const tah = d.tah || 0, dTah = dt > 0 ? (tah - stavZ.tahPred) / dt : 0; stavZ.tahPred = tah;
    const punch = clamp((dTah - 1.5) / 6, 0, 0.6);
    cil(G.vrtFiltr.frequency, clamp(P.fMax * Math.max(prum, 0.05) * P.sumNasob, 200, 12000), 0.03);
    cil(G.vrtZes.gain, P.sum * Math.pow(prum, 1.3) * (1 + punch * 2), 0.03);
    const wash = bezi && !d.naZemi ? Z.proplach(d.v[1], tah) : 0;
    cil(G.washHloubka.gain, wash * 0.22, 0.1);
    cil(G.motorUtlum.gain, utlum, 0.06);
    cil(G.motorVzduch.frequency, mezni, 0.1);
    if (G.motorPan.pan) cil(G.motorPan.pan, pan, 0.08);

    // --- vítr kolem posluchače ---
    let rychlost = 0;
    if (rezim !== 'los' && rezim !== 'volna') {
      let wx = 0, wy = 0, wz = 0;
      if (ctx.prostredi && ctx.prostredi.vitr) { try { ctx.prostredi.vitr(d.p[0], d.p[1], d.p[2], ctx.cas, _v); wx = _v[0]; wy = _v[1]; wz = _v[2]; } catch (e) { /* nic */ } }
      rychlost = Math.hypot(d.v[0] - wx, d.v[1] - wy, d.v[2] - wz);
    }
    const vw = Z.vitrRychlost(rychlost);
    cil(G.vitrZes.gain, vw * 0.5, 0.15);
    cil(G.vitrFiltr.frequency, 350 + rychlost * 22, 0.2);

    // --- okolí ---
    stavZ.ambCas -= dt;
    if (stavZ.ambCas <= 0) { stavZ.ambCas = 0.3; try { vzorkujOkoli(ctx, lx, ly, lz); } catch (e) { /* teren bez metod */ } }
    const pc = ctx.pocasi || {}, hod = ctx.hodina != null ? ctx.hodina : 12;
    const uZeme = clamp(1 - ((stavZ.vyskaNadZemi || 0) - 15) / 140, 0.08, 1);   // ptáci, cvrčci, voda slyšet jen u země
    const vitrAmb = clamp((pc.vitr || 0) / 12, 0, 1.2);
    const dest = clamp(pc.dest || 0, 0, 1);
    cil(G.ambVitrZes.gain, 0.03 + vitrAmb * 0.16 * (0.5 + 0.5 * (1 - uZeme)), 0.5);
    cil(G.lesZes.gain, stavZ.les * (0.04 + vitrAmb * 0.22) * uZeme, 0.5);
    cil(G.vodaZes.gain, stavZ.voda * 0.14 * uZeme, 0.5);
    cil(G.destZes.gain, dest * 0.22, 0.6);
    cil(G.cvrcciZes.gain, Z.cvrcci(hod) * 0.012 * uZeme * (1 - dest) * (1 - stavZ.les * 0.5), 1);
    const intenzitaPtaku = Z.ptaci(hod) * (0.35 + 0.65 * stavZ.les) * uZeme * (1 - dest * 0.9);
    if (dt > 0 && stavZ.ptaciFraze < 3 && Math.random() < intenzitaPtaku * 0.7 * dt) ptak(0.02 + Math.random() * 0.035 * uZeme);

    // --- pípání: arm/disarm, baterie ---
    const arm = !!d.armed;
    if (arm !== stavZ.armed) {
      stavZ.armed = arm;
      if (arm) { pip(880, 0, 0.09); pip(1320, 0.12, 0.12); } else { pip(1320, 0, 0.09); pip(660, 0.12, 0.14); }
    }
    const b = d.baterie && d.baterie.procent;
    if (arm && b != null && b < 20) {
      stavZ.bateriePip -= dt;
      if (stavZ.bateriePip <= 0) {
        if (b < 10) { pip(2000, 0, 0.07, 0.05); pip(2000, 0.12, 0.07, 0.05); pip(2000, 0.24, 0.07, 0.05); stavZ.bateriePip = 1.6; }
        else { pip(1800, 0, 0.1, 0.04); stavZ.bateriePip = 4; }
      }
    } else stavZ.bateriePip = 0;
  }

  if (PROHLIZEC) {
    const gesto = () => vytvorKontext();
    for (const ud of ['keydown', 'pointerdown', 'touchend', 'mousedown']) addEventListener(ud, gesto, { capture: true, passive: true });
    document.addEventListener('visibilitychange', () => {
      stavZ.skryto = document.hidden;
      if (!ac) return;
      if (document.hidden) ac.suspend().catch(() => {}); else if (!stavZ.pauza) ac.resume().catch(() => {});
    });
  }

  if (D.modul) D.modul('zvuk', {
    poradi: 70,
    popis: 'zvuk',
    init(ctx) {
      ctxHry = ctx;
      D.na('naraz', u => naraz(u && u.sila != null ? u.sila : 4, false));
      D.na('havarie', u => naraz(u && u.sila != null ? Math.max(u.sila, 8) : 10, true));
      D.na('foto', () => zaverka());
      D.na('novyLet', dr => { if (ac && G && dr) postavMotory(dr.typ); stavZ.armed = !!(dr && dr.armed); });
    },
    update,
  });

  D.zvuk = {
    hlasitost(v) {
      if (v == null) return nast.hlasitost;
      nast.hlasitost = clamp(+v || 0, 0, 1); ulozNast();
      if (ac && G) cil(G.master.gain, nast.ztlum ? 0 : nast.hlasitost, 0.03);
      return nast.hlasitost;
    },
    ztlum(b) {
      if (b == null) return nast.ztlum;
      nast.ztlum = !!b; ulozNast();
      if (ac && G) cil(G.master.gain, nast.ztlum ? 0 : nast.hlasitost, 0.03);
      return nast.ztlum;
    },
    // pro ladění a testy
    stav: () => ({ kontext: ac ? ac.state : 'zadny', les: stavZ.les, voda: stavZ.voda, ptaci: stavZ.ptaciFraze, motory: G && G.motory ? G.motory.typ : null }),
    spust: () => vytvorKontext(),
  };
})(globalThis.DRON = globalThis.DRON || {});

/* Dopravní magnát – zvuky a generativní hudba (Web Audio, jen prohlížeč; vše syntetizované).
   MAG.zvuk.hraj(jmeno) – krátký zvuk; MAG.zvuk.hudba(zapnuto, rok) – hudba podle doby
   (do 1960 swing: chodící bas + akordy na 2 a 4 + občasná melodie; potom syntezátorová plocha s arpeggiem).
   Kontext vzniká až po prvním gestu uživatele (pravidla prohlížečů). */
(function (MAG) {
  'use strict';
  let ctx = null, mZvuk = null, mHudba = null;
  const nast = { zvuk: true, hudba: true, hlasitost: 0.6 };
  const naposled = {};

  function kontext() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    mZvuk = ctx.createGain(); mZvuk.connect(ctx.destination);
    mHudba = ctx.createGain(); mHudba.connect(ctx.destination);
    nastavHlasitost();
    document.addEventListener('visibilitychange', () => { if (!ctx) return; if (document.hidden) ctx.suspend(); else ctx.resume(); });
    return ctx;
  }
  function nastavHlasitost() {
    if (!ctx) return;
    mZvuk.gain.value = nast.zvuk ? nast.hlasitost * 0.5 : 0;
    mHudba.gain.value = nast.hudba ? nast.hlasitost * 0.16 : 0;
  }
  // tón: frekvence, začátek (s od teď), délka, typ, hlasitost, výstup
  function ton(f, t0, del, typ = 'sine', vol = 0.3, cil = mZvuk, f2 = null, filtr = null) {
    const t = ctx.currentTime + t0, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = typ; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + del);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.02, del / 4)); g.gain.exponentialRampToValueAtTime(0.0001, t + del);
    let uzel = o;
    if (filtr) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = filtr; o.connect(fl); uzel = fl; }
    uzel.connect(g); g.connect(cil); o.start(t); o.stop(t + del + 0.05);
  }
  function sum(t0, del, vol, f0, f1, typ = 'lowpass') {
    const n = Math.floor(ctx.sampleRate * del), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), t = ctx.currentTime + t0;
    s.buffer = b; f.type = typ; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + del);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + del);
    s.connect(f); f.connect(g); g.connect(mZvuk); s.start(t);
  }
  const ZVUKY = {
    penize: () => { ton(1320, 0, 0.12, 'sine', 0.18); ton(1760, 0.06, 0.2, 'sine', 0.15); },
    stavba: () => { sum(0, 0.18, 0.5, 900, 120); ton(140, 0, 0.12, 'triangle', 0.25); },
    bourani: () => { sum(0, 0.6, 0.6, 1500, 80); ton(70, 0, 0.5, 'sawtooth', 0.12, mZvuk, 40, 300); },
    chyba: () => { ton(160, 0, 0.18, 'square', 0.12, mZvuk, null, 900); ton(120, 0.12, 0.2, 'square', 0.1, mZvuk, null, 700); },
    oslava: () => { [523, 659, 784, 1047].forEach((f, i) => ton(f, i * 0.09, 0.35, 'triangle', 0.2)); },
    noviny: () => { sum(0, 0.12, 0.25, 6000, 2500, 'highpass'); ton(1568, 0.08, 0.6, 'sine', 0.12); },
    klik: () => ton(900, 0, 0.04, 'square', 0.06, mZvuk, null, 2500),
    bus: () => { ton(440, 0, 0.18, 'square', 0.1, mZvuk, null, 1400); ton(554, 0.2, 0.25, 'square', 0.1, mZvuk, null, 1400); },
    nakl: () => ton(330, 0, 0.35, 'sawtooth', 0.1, mZvuk, null, 900),
    vlak: () => { ton(1100, 0, 0.7, 'sine', 0.12, mZvuk, 1060); ton(1480, 0, 0.7, 'sine', 0.06, mZvuk, 1420); },
    diesel: () => { ton(311, 0, 0.6, 'sawtooth', 0.08, mZvuk, null, 1200); ton(370, 0, 0.6, 'sawtooth', 0.08, mZvuk, null, 1200); },
    lod: () => ton(98, 0, 1.2, 'sawtooth', 0.14, mZvuk, null, 500),
    let: () => sum(0, 1.1, 0.3, 300, 2400, 'bandpass'),
    porucha: () => { sum(0, 0.25, 0.4, 3000, 200); ton(90, 0.05, 0.3, 'square', 0.08, mZvuk, 60, 400); },
  };
  function hraj(jm) {
    if (!nast.zvuk || !kontext() || !ZVUKY[jm]) return;
    const t = performance.now();
    if (naposled[jm] && t - naposled[jm] < (jm === 'penize' ? 250 : 80)) return;
    naposled[jm] = t;
    if (ctx.state === 'suspended') ctx.resume();
    ZVUKY[jm]();
  }

  // --- generativní hudba ----------------------------------------------------------------------------------
  let hudbaBezi = false, dalsiTakt = 0, takt = 0, rokHudby = 1950, casovac = null;
  const KROKY = [[0, 4, 7], [9, 0, 4], [5, 9, 0], [7, 11, 2], [2, 5, 9], [7, 11, 2], [0, 4, 7], [0, 4, 7]];   // I vi IV V ii V I I
  const nota = (koren, pultonu, okt) => 440 * 2 ** ((koren + pultonu - 9) / 12 + (okt - 4));
  let koren = 0;
  function naplanujTakt(t) {
    const swing = rokHudby < 1960, tempo = swing ? 104 : 84, doba = 60 / tempo;
    const akord = KROKY[takt % KROKY.length];
    if (takt % 32 === 0) koren = [0, 5, 7, 3][(takt / 32) % 4 | 0];
    const zac = t - ctx.currentTime;
    if (swing) {
      // chodící bas po dobách, akord na 2 a 4, občas melodie z pentatoniky
      const bas = [akord[0], akord[1], akord[2], akord[1] + (takt % 2 ? 2 : -1)];
      bas.forEach((p, i) => ton(nota(koren, p, 2), zac + i * doba, doba * 0.9, 'triangle', 0.5, mHudba));
      for (const i of [1, 3]) for (const p of akord) ton(nota(koren, p, 4), zac + i * doba, doba * 0.45, 'square', 0.05, mHudba, null, 1500);
      if (Math.random() < 0.55) {
        const penta = [0, 2, 4, 7, 9];
        for (let i = 0; i < 4; i++) if (Math.random() < 0.6) ton(nota(koren, penta[(Math.random() * 5) | 0], 5), zac + i * doba + (i % 2 ? doba * 0.33 : 0), doba * 0.6, 'sine', 0.18, mHudba);
      }
    } else {
      // plocha: rozladěné pily přes dolní propust, arpeggio osminami, měkký bas
      for (const p of akord) for (const ladeni of [-6, 6]) {
        const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
        o.type = 'sawtooth'; o.frequency.value = nota(koren, p, 3); o.detune.value = ladeni;
        f.type = 'lowpass'; f.frequency.value = 900;
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.035, t + doba * 1.5); g.gain.linearRampToValueAtTime(0.0001, t + doba * 4.2);
        o.connect(f); f.connect(g); g.connect(mHudba); o.start(t); o.stop(t + doba * 4.3);
      }
      for (let i = 0; i < 8; i++) ton(nota(koren, akord[i % 3], 5 + (i >= 4 ? 1 : 0) * (takt % 2)), zac + i * doba / 2, doba * 0.45, 'sine', 0.1, mHudba);
      ton(nota(koren, akord[0], 2), zac, doba * 3.8, 'sine', 0.4, mHudba);
    }
    takt++;
    return t + 4 * doba;
  }
  function plan() {
    if (!hudbaBezi || !ctx) return;
    if (ctx.state === 'running') while (dalsiTakt < ctx.currentTime + 1.2) dalsiTakt = naplanujTakt(Math.max(dalsiTakt, ctx.currentTime + 0.05));
    casovac = setTimeout(plan, 300);
  }
  function hudba(zapnout, rok) {
    if (rok) rokHudby = rok;
    if (!zapnout || !nast.hudba) { hudbaBezi = false; clearTimeout(casovac); return; }
    if (hudbaBezi || !kontext()) return;
    hudbaBezi = true; dalsiTakt = ctx.currentTime + 0.1; plan();
  }
  function nastav(n) { Object.assign(nast, n); nastavHlasitost(); if (!nast.hudba) hudba(false); }
  function odemkni() { if (kontext() && ctx.state === 'suspended') ctx.resume(); }

  MAG.zvuk = { hraj, hudba, nastav, nast, odemkni, ZVUKY };
})(globalThis.MAG = globalThis.MAG || {});

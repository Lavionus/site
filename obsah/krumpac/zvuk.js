/* Krumpáč – zvuky syntetizované přes WebAudio (žádné soubory). */
var KRUMPAC = (typeof KRUMPAC !== 'undefined') ? KRUMPAC : (typeof global !== 'undefined' && global.KRUMPAC) || {};
if (typeof global !== 'undefined') global.KRUMPAC = KRUMPAC;

KRUMPAC.zvuk = (function () {
  'use strict';
  let ctx = null, hlavni = null, zapnuto = true;
  try { zapnuto = localStorage.getItem('webapp_hra_krumpac_zvuk') !== '0'; } catch { /* soukromé okno */ }

  function priprav() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    hlavni = ctx.createGain(); hlavni.gain.value = 0.35; hlavni.connect(ctx.destination);
  }

  function ton(typ, f0, f1, delka, hlasitost, zpozdeni) {
    if (!ctx || !zapnuto) return;
    const t = ctx.currentTime + (zpozdeni || 0);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = typ; o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + delka);
    g.gain.setValueAtTime(hlasitost, t); g.gain.exponentialRampToValueAtTime(0.001, t + delka);
    o.connect(g); g.connect(hlavni); o.start(t); o.stop(t + delka + 0.02);
  }

  function sum(delka, hlasitost, filtr, zpozdeni) {
    if (!ctx || !zapnuto) return;
    const t = ctx.currentTime + (zpozdeni || 0);
    const n = Math.floor(ctx.sampleRate * delka);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = ctx.createBufferSource(); s.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filtr || 1800;
    const g = ctx.createGain(); g.gain.value = hlasitost;
    s.connect(f); f.connect(g); g.connect(hlavni); s.start(t);
  }

  const ZVUKY = {
    skok: () => ton('square', 260, 520, 0.12, 0.18),
    mach: () => sum(0.08, 0.25, 2500),
    zasah: () => { ton('square', 180, 90, 0.08, 0.25); sum(0.05, 0.2, 900); },
    zabiti: () => { ton('square', 400, 80, 0.25, 0.22); sum(0.12, 0.2, 1200); },
    drahokam: () => { ton('square', 990, null, 0.06, 0.15); ton('square', 1320, null, 0.12, 0.15, 0.06); },
    srdce: () => [523, 659, 784].forEach((f, i) => ton('triangle', f, null, 0.12, 0.25, i * 0.07)),
    skala: () => { sum(0.18, 0.35, 700); ton('triangle', 120, 60, 0.15, 0.3); },
    zraneni: () => ton('sawtooth', 200, 70, 0.3, 0.22),
    pad: () => ton('triangle', 600, 80, 0.5, 0.25),
    smrt: () => [392, 330, 262, 196].forEach((f, i) => ton('square', f, null, 0.18, 0.2, i * 0.16)),
    cil: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => ton('square', f, null, 0.14, 0.18, i * 0.11)),
    kontrola: () => { ton('triangle', 784, null, 0.15, 0.25); ton('triangle', 1175, null, 0.25, 0.2, 0.1); },
    dopad: () => sum(0.05, 0.12, 400),
    cvak: () => ton('sine', 300, 140, 0.08, 0.12),
    pozor: () => { ton('square', 880, null, 0.05, 0.1); ton('square', 1175, null, 0.07, 0.1, 0.05); },
    tres: () => sum(0.4, 0.15, 300),
    krapnik: () => { sum(0.2, 0.35, 900); ton('triangle', 220, 70, 0.18, 0.25); },
    pruzina: () => { ton('sine', 180, 720, 0.22, 0.3); ton('square', 360, 900, 0.12, 0.08); },
    praska: () => sum(0.06, 0.2, 2200),
    rozpad: () => { sum(0.25, 0.3, 600); ton('triangle', 140, 60, 0.2, 0.2); },
    obnova: () => ton('triangle', 330, 440, 0.12, 0.08),
    lava: () => { sum(0.35, 0.3, 3500); ton('sawtooth', 120, 60, 0.3, 0.15); },
    stit: () => { ton('square', 520, 260, 0.12, 0.2); sum(0.06, 0.2, 3000); },
    predmet: () => [660, 880, 1100].forEach((f, i) => ton('square', f, null, 0.08, 0.14, i * 0.05)),
    hod: () => ton('triangle', 700, 300, 0.1, 0.15),
    cink: () => ton('square', 1500, 900, 0.05, 0.08),
    odraz: () => { ton('square', 1800, 1200, 0.06, 0.15); },
    sip: () => ton('triangle', 900, 500, 0.08, 0.12),
    pavouk: () => ton('sine', 600, 200, 0.25, 0.1),
    krtek: () => { sum(0.15, 0.25, 500); },
    plave: () => sum(0.08, 0.12, 900),
    dvojskok: () => ton('square', 520, 1040, 0.12, 0.15),
    tajne: () => [523, 659, 784, 1047, 1319].forEach((f, i) => ton('triangle', f, null, 0.12, 0.2, i * 0.07)),
    lis: () => { sum(0.2, 0.4, 500); ton('square', 90, 50, 0.2, 0.25); },
    lis_jede: () => ton('sawtooth', 200, 120, 0.15, 0.06),
    boss_zasah: () => { ton('square', 220, 110, 0.1, 0.3); sum(0.08, 0.25, 1500); },
    boss_porazen: () => [392, 523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => ton('square', f, null, 0.18, 0.2, i * 0.12)),
    boss_faze: () => [220, 208, 196, 185].forEach((f, i) => ton('sawtooth', f, null, 0.15, 0.18, i * 0.1)),
    boss_rev: () => ton('sawtooth', 160, 90, 0.4, 0.25),
    boss_skok: () => ton('square', 200, 400, 0.2, 0.15),
    naraz: () => { sum(0.3, 0.45, 600); ton('triangle', 100, 40, 0.3, 0.35); },
    dupnuti: () => { sum(0.25, 0.4, 400); ton('triangle', 80, 40, 0.3, 0.35); },
    led: () => ton('triangle', 1600, 1200, 0.1, 0.1),
    hod_kamen: () => ton('triangle', 150, 90, 0.2, 0.25),
    cak: () => sum(0.25, 0.3, 1200),
  };

  function hraj(druh) { const z = ZVUKY[druh]; if (z) z(); }
  function prepni() {
    zapnuto = !zapnuto;
    try { localStorage.setItem('webapp_hra_krumpac_zvuk', zapnuto ? '1' : '0'); } catch { /* nevadí */ }
    return zapnuto;
  }
  return { priprav, hraj, prepni, zapnuto: () => zapnuto, kontext: () => (ctx ? { ctx, hlavni } : null) };
})();

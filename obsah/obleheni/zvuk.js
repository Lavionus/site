/* Ostrov v obležení – zvuk (WebAudio, vše syntetizované, žádné soubory).
   Příboj je smyčka filtrovaného šumu s pomalým kolísáním, zbytek jsou krátké tóny a šumové rány. */
(function (OBL) {
  'use strict';
  let ac = null, hlavni = null, prib = null, ztlumeno = false, sumBuf = null;
  const posledni = {};

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return true; }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      hlavni = ac.createGain(); hlavni.gain.value = ztlumeno ? 0 : 0.6; hlavni.connect(ac.destination);
      sumBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
      const d = sumBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      pribojStart();
      return true;
    } catch (e) { ac = null; return false; }
  }

  function pribojStart() {
    const src = ac.createBufferSource(); src.buffer = sumBuf; src.loop = true;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 520;
    const g = ac.createGain(); g.gain.value = 0.05;
    const lfo = ac.createOscillator(); lfo.frequency.value = 0.13;
    const lg = ac.createGain(); lg.gain.value = 0.035;
    lfo.connect(lg); lg.connect(g.gain);
    src.connect(f); f.connect(g); g.connect(hlavni);
    src.start(); lfo.start();
    prib = g;
  }

  // omezení hustoty stejných zvuků (při 3× rychlosti by jinak praskalo)
  function smi(klic, ms) {
    const t = performance.now();
    if (posledni[klic] && t - posledni[klic] < ms) return false;
    posledni[klic] = t; return true;
  }

  function ton(freq, dur, typ, vol, klouz) {
    if (!ac || ztlumeno) return;
    const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
    o.type = typ || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (klouz) o.frequency.exponentialRampToValueAtTime(Math.max(30, klouz), t + dur);
    g.gain.setValueAtTime(vol || 0.1, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(hlavni); o.start(t); o.stop(t + dur + 0.02);
  }
  function sum(dur, vol, filtr, freq) {
    if (!ac || ztlumeno) return;
    const t = ac.currentTime, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = sumBuf; f.type = filtr || 'lowpass'; f.frequency.value = freq || 800;
    g.gain.setValueAtTime(vol || 0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(hlavni); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.02);
  }

  const ZVUKY = {
    straz: () => smi('sip', 60) && sum(0.07, 0.06, 'highpass', 2500),
    delo: () => smi('delo', 90) && (sum(0.45, 0.28, 'lowpass', 300), ton(70, 0.3, 'sine', 0.15, 40)),
    mozdir: () => smi('mozdir', 120) && (sum(0.3, 0.18, 'lowpass', 500), ton(140, 0.2, 'triangle', 0.06, 70)),
    balista: () => smi('bal', 80) && ton(220, 0.12, 'sawtooth', 0.04, 110),
    musket: () => smi('musk', 50) && sum(0.08, 0.1, 'bandpass', 1600),
    kotel: () => smi('kot', 120) && sum(0.4, 0.1, 'bandpass', 700),
    mag: () => smi('mag', 90) && (ton(900, 0.15, 'square', 0.03, 1800), sum(0.15, 0.06, 'highpass', 3000)),
    salupa: () => smi('delo', 90) && sum(0.3, 0.16, 'lowpass', 400),
    pevnost: () => smi('pev', 120) && sum(0.2, 0.08, 'lowpass', 600),
    vybuch: (velky) => smi('vyb', 70) && (sum(velky ? 0.9 : 0.5, velky ? 0.35 : 0.2, 'lowpass', velky ? 260 : 420), ton(55, 0.4, 'sine', 0.12, 30)),
    splouch: () => smi('spl', 90) && sum(0.35, 0.1, 'bandpass', 900),
    smrtLod: () => smi('slod', 150) && (sum(0.8, 0.18, 'lowpass', 300), ton(180, 0.6, 'triangle', 0.05, 60)),
    smrt: () => smi('smrt', 50) && ton(300 + Math.random() * 80, 0.1, 'triangle', 0.04, 160),
    zlato: () => smi('zl', 70) && ton(1320, 0.07, 'sine', 0.03),
    stavba: () => (ton(330, 0.08, 'triangle', 0.08), setTimeout(() => ton(495, 0.1, 'triangle', 0.08), 70)),
    vylepseni: () => (ton(523, 0.1, 'sine', 0.08), setTimeout(() => ton(784, 0.14, 'sine', 0.08), 90)),
    prodej: () => ton(440, 0.15, 'sine', 0.06, 300),
    chyba: () => ton(160, 0.15, 'square', 0.04),
    zvon: () => { if (!smi('zvon', 2500)) return; [0, 380, 760].forEach(d => setTimeout(() => { ton(880, 0.9, 'sine', 0.06); ton(1320, 0.6, 'sine', 0.02); }, d)); },
    vlna: (boss) => { ton(boss ? 110 : 196, 0.6, 'sawtooth', 0.05, boss ? 90 : 220); setTimeout(() => ton(boss ? 98 : 262, 0.8, 'sawtooth', 0.05), 300); },
    konecVlny: () => [523, 659, 784].forEach((f, i) => setTimeout(() => ton(f, 0.25, 'triangle', 0.07), i * 110)),
    budova: () => smi('bud', 200) && sum(0.25, 0.12, 'lowpass', 500),
    blesk: () => smi('bl', 90) && sum(0.2, 0.12, 'highpass', 2000),
    dech: () => smi('dech', 300) && sum(0.6, 0.14, 'bandpass', 500),
    harpyje: () => smi('harp', 400) && ton(1400, 0.2, 'sawtooth', 0.025, 900),
    povyseni: () => (ton(660, 0.09, 'sine', 0.08), setTimeout(() => ton(880, 0.12, 'sine', 0.08), 90)),
    prohra: () => [392, 330, 262, 196].forEach((f, i) => setTimeout(() => ton(f, 0.5, 'sawtooth', 0.06), i * 260)),
    vyhra: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => ton(f, 0.4, 'triangle', 0.08), i * 160)),
    salva: () => [0, 120, 260, 380].forEach(d => setTimeout(() => sum(0.5, 0.25, 'lowpass', 300), d)),
    zpev: () => { ton(220, 1.4, 'sine', 0.06, 440); sum(1.4, 0.08, 'bandpass', 400); },
    loupez: () => [880, 660, 440].forEach((f, i) => setTimeout(() => ton(f, 0.12, 'square', 0.03), i * 90)),
  };

  function hraj(jmeno, ...a) { if (!ac || ztlumeno) return; const f = ZVUKY[jmeno]; if (f) f(...a); }
  function prepni() {
    ztlumeno = !ztlumeno;
    if (hlavni) hlavni.gain.value = ztlumeno ? 0 : 0.6;
    return ztlumeno;
  }
  function nastavZtlumeni(v) { ztlumeno = !!v; if (hlavni) hlavni.gain.value = ztlumeno ? 0 : 0.6; }
  function bouře(sila) { if (prib) prib.gain.value = 0.05 + sila * 0.03; }

  OBL.zvuk = { init, hraj, prepni, nastavZtlumeni, boure: bouře, ztlumeno: () => ztlumeno };
})(globalThis.OBL = globalThis.OBL || {});

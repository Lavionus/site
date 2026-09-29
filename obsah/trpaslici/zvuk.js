/* ============================================================
   Srdce hory – zvuk.js: zvuky a hudba (Web Audio, vše syntetizované).

   Každý zvuk je funkce (ctx, cil, cas, sila, x) → vlastní uzly, takže
   jde přehrát naživo i vykreslit do OfflineAudioContext (test měří
   hlasitost). Hudba: tichý dron a pentatonika, s hloubkou tmavne.
   AudioContext vzniká až při prvním klepnutí (pravidla prohlížečů).
   ============================================================ */
var TRP = globalThis.TRP = globalThis.TRP || {};

(function (T) {
  'use strict';
  const KLIC = 'webapp_hra_trpaslici_zvuk';
  let ctx = null, hlavni = null, efekty = null, hudbaUzel = null;
  const nast = { zvuk: true, hudba: true, hlasitost: 0.7 };
  try { Object.assign(nast, JSON.parse(localStorage.getItem(KLIC) || '{}')); } catch (e) { /* bez úložiště */ }
  const ulozNast = () => { try { localStorage.setItem(KLIC, JSON.stringify(nast)); } catch (e) { /* nic */ } };

  // --- stavební kameny ---------------------------------------------------------------------
  function sum(c, delka) {
    const b = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * delka)), c.sampleRate), d = b.getChannelData(0);
    let x = 12345;
    for (let i = 0; i < d.length; i++) { x = (x * 1103515245 + 12345) & 0x7fffffff; d[i] = x / 0x3fffffff - 1; }
    const s = c.createBufferSource(); s.buffer = b; return s;
  }
  function obalka(c, cil, t0, utok, doba, max) {
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(max, t0 + utok);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + utok + doba);
    g.connect(cil); return g;
  }
  function ton(c, cil, t0, typ, f, doba, max, f2) {
    const o = c.createOscillator(); o.type = typ; o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + doba);
    o.connect(obalka(c, cil, t0, 0.005, doba, max)); o.start(t0); o.stop(t0 + doba + 0.05);
  }
  function hluk(c, cil, t0, doba, max, typ, f, q) {
    const s = sum(c, doba + 0.05), fl = c.createBiquadFilter();
    fl.type = typ || 'bandpass'; fl.frequency.value = f || 1000; fl.Q.value = q || 1;
    s.connect(fl); fl.connect(obalka(c, cil, t0, 0.004, doba, max)); s.start(t0); s.stop(t0 + doba + 0.05);
  }
  // tvrdost horniny → výška úderu (hlína tupě, žula ostře, runa zvoní)
  const VYSKA = { 1: 380, 2: 330, 3: 900, 4: 1500, 5: 1250, 6: 1750, 10: 1100, 11: 2300, 12: 1000, 13: 500, 14: 2000 };

  const ZVUKY = {
    uder(c, cil, t0, s, mat) {
      const ruda = mat > 100, f = ruda ? 1800 : VYSKA[mat] || 900;
      hluk(c, cil, t0, 0.07, 0.5 * s, 'bandpass', f, 3);
      ton(c, cil, t0, 'triangle', f / 3, 0.06, 0.25 * s, f / 5);
      if (ruda || mat === 11) ton(c, cil, t0 + 0.01, 'sine', ruda ? 2600 : 1900, 0.25, 0.12 * s);
    },
    vykop(c, cil, t0, s) { hluk(c, cil, t0, 0.35, 0.35 * s, 'lowpass', 500, 0.7); ton(c, cil, t0 + 0.05, 'triangle', 140, 0.2, 0.2 * s, 70); },
    sekera(c, cil, t0, s) { ton(c, cil, t0, 'triangle', 210, 0.12, 0.45 * s, 90); hluk(c, cil, t0, 0.08, 0.25 * s, 'bandpass', 700, 2); },
    kladivo(c, cil, t0, s) { ton(c, cil, t0, 'sine', 320, 0.09, 0.5 * s, 150); hluk(c, cil, t0, 0.03, 0.2 * s, 'highpass', 2000, 1); },
    kovadlina(c, cil, t0, s) { for (const [f, a] of [[820, 0.3], [1345, 0.2], [2210, 0.14], [3020, 0.08]]) ton(c, cil, t0, 'sine', f, 0.7, a * s); hluk(c, cil, t0, 0.02, 0.3 * s, 'highpass', 3000, 1); },
    dilna(c, cil, t0, s) { hluk(c, cil, t0, 0.18, 0.25 * s, 'bandpass', 1800, 6); hluk(c, cil, t0 + 0.2, 0.18, 0.22 * s, 'bandpass', 1500, 6); },
    praskani(c, cil, t0, s) { for (let k = 0; k < 7; k++) hluk(c, cil, t0 + k * 0.045 + (k * 37 % 11) / 400, 0.015, 0.45 * s, 'highpass', 2500, 1); },
    zaval(c, cil, t0, s, n) {
      const d = 1.2 + Math.min(1, (n || 4) / 10);
      hluk(c, cil, t0, d, 0.8 * s, 'lowpass', 180, 0.8);
      for (let k = 0; k < 5; k++) ton(c, cil, t0 + k * 0.18, 'sine', 70 - k * 6, 0.3, 0.45 * s, 40);
    },
    voda(c, cil, t0, s) { ton(c, cil, t0, 'sine', 1300, 0.07, 0.25 * s, 650); ton(c, cil, t0 + 0.09, 'sine', 900, 0.05, 0.12 * s, 500); },
    roh(c, cil, t0, s) {
      const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 900; fl.connect(cil);
      for (const [f, a] of [[110, 0.35], [165, 0.25], [220, 0.12]]) {
        const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
        const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(a * s, t0 + 0.5);
        g.gain.setValueAtTime(a * s, t0 + 1.2); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.9);
        o.connect(g); g.connect(fl); o.start(t0); o.stop(t0 + 2);
      }
    },
    boj(c, cil, t0, s, zbran) { hluk(c, cil, t0, 0.09, 0.45 * s, 'bandpass', zbran ? 2400 : 900, 4); if (zbran) ton(c, cil, t0, 'sine', 2100, 0.2, 0.15 * s); },
    zasah(c, cil, t0, s) { hluk(c, cil, t0, 0.1, 0.4 * s, 'lowpass', 600, 1); ton(c, cil, t0, 'triangle', 180, 0.12, 0.25 * s, 120); },
    rev(c, cil, t0, s) { hluk(c, cil, t0, 1.1, 0.6 * s, 'bandpass', 160, 2); ton(c, cil, t0, 'sawtooth', 55, 1.0, 0.3 * s, 35); },
    padl(c, cil, t0, s) { ton(c, cil, t0, 'square', 300, 0.25, 0.15 * s, 90); },
    objev(c, cil, t0, s) { [523, 659, 784, 1047].forEach((f, k) => ton(c, cil, t0 + k * 0.09, 'triangle', f, 0.45, 0.2 * s)); },
    zvonek(c, cil, t0, s) { ton(c, cil, t0, 'sine', 880, 1.2, 0.3 * s); ton(c, cil, t0, 'sine', 1760, 0.8, 0.12 * s); ton(c, cil, t0 + 0.25, 'sine', 660, 1.0, 0.2 * s); },
    smrt(c, cil, t0, s) { [220, 262, 330].forEach(f => ton(c, cil, t0, 'triangle', f, 1.4, 0.15 * s, f * 0.94)); },
    fanfara(c, cil, t0, s) {
      [[262, 0], [330, 0.18], [392, 0.36], [523, 0.54], [659, 0.72], [784, 0.9]].forEach(([f, d]) => {
        ton(c, cil, t0 + d, 'sawtooth', f, 0.9, 0.12 * s); ton(c, cil, t0 + d, 'triangle', f * 2, 0.6, 0.08 * s);
      });
    },
  };

  // --- přehrávání ------------------------------------------------------------------------------
  function probud() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      hlavni = ctx.createGain(); hlavni.gain.value = nast.hlasitost; hlavni.connect(ctx.destination);
      efekty = ctx.createGain(); efekty.gain.value = nast.zvuk ? 1 : 0; efekty.connect(hlavni);
      hudbaUzel = ctx.createGain(); hudbaUzel.gain.value = nast.hudba ? 0.5 : 0; hudbaUzel.connect(hlavni);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  const posledni = {};
  // pan -1..1 a sila 0..1 podle polohy v obraze (mimo obraz se neozve, kromě globálních zvuků)
  function hraj(typ, sila, pan, x) {
    if (!ctx || !nast.zvuk || ctx.state !== 'running' || !ZVUKY[typ]) return false;
    const ted = ctx.currentTime, min = { uder: 0.05, voda: 0.4, praskani: 0.6, boj: 0.06, kladivo: 0.08, dilna: 0.3, kovadlina: 0.12 }[typ] || 0.15;
    if (posledni[typ] && ted - posledni[typ] < min) return false;
    posledni[typ] = ted;
    let cil = efekty;
    if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); p.connect(efekty); cil = p; }
    ZVUKY[typ](ctx, cil, ted + 0.01, sila === undefined ? 1 : sila, x);
    return true;
  }

  // --- hudba: dron + pentatonika, podle hloubky pohledu ---------------------------------------------
  let dron = null, dalsiNota = 0, hloubka = 0;
  const STUPNICE = [0, 3, 5, 7, 10, 12, 15];
  function hudba(hl) {
    if (!ctx || ctx.state !== 'running') return;
    hloubka = hl;
    const zaklad = 110 * Math.pow(2, -Math.min(1.2, Math.max(0, hl) / 120));    // hlouběji = níž
    if (!dron) {
      dron = [ctx.createOscillator(), ctx.createOscillator()];
      const g = ctx.createGain(); g.gain.value = 0.05;
      const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 400;
      dron.forEach((o, k) => { o.type = 'sine'; o.frequency.value = zaklad * (k ? 1.5 : 1); o.detune.value = k ? 4 : -4; o.connect(fl); o.start(); });
      fl.connect(g); g.connect(hudbaUzel); dron.fl = fl;
    }
    dron[0].frequency.setTargetAtTime(zaklad, ctx.currentTime, 2);
    dron[1].frequency.setTargetAtTime(zaklad * 1.5, ctx.currentTime, 2);
    dron.fl.frequency.setTargetAtTime(hl > 100 ? 250 : 450, ctx.currentTime, 3);
    if (ctx.currentTime < dalsiNota) return;
    dalsiNota = ctx.currentTime + 2.5 + Math.random() * 3;
    const f = zaklad * 4 * Math.pow(2, STUPNICE[Math.floor(Math.random() * STUPNICE.length)] / 12);
    const o = ctx.createOscillator(); o.type = hl > 100 ? 'sine' : 'triangle'; o.frequency.value = f;
    const g = ctx.createGain(), t0 = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.06, t0 + 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 4);
    const zp = ctx.createDelay(1); zp.delayTime.value = 0.45; const fb = ctx.createGain(); fb.gain.value = 0.35;
    o.connect(g); g.connect(hudbaUzel); g.connect(zp); zp.connect(fb); fb.connect(zp); zp.connect(hudbaUzel);
    o.start(t0); o.stop(t0 + 4.2);
  }

  function nastav(k, v) {
    nast[k] = v; ulozNast();
    if (!ctx) return;
    if (k === 'zvuk') efekty.gain.value = v ? 1 : 0;
    if (k === 'hudba') hudbaUzel.gain.value = v ? 0.5 : 0;
    if (k === 'hlasitost') hlavni.gain.value = v;
  }
  // test: vykreslí zvuk do OfflineAudioContext a vrátí špičku
  async function zmer(typ, x) {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const c = new OAC(1, 44100 * 2.5, 44100);
    ZVUKY[typ](c, c.destination, 0.01, 1, x);
    const b = await c.startRendering(), d = b.getChannelData(0);
    let spicka = 0; for (let i = 0; i < d.length; i++) spicka = Math.max(spicka, Math.abs(d[i]));
    return spicka;
  }

  T.zvuk = { ZVUKY, nast, probud, hraj, hudba, nastav, zmer, stav: () => ({ ctx: ctx ? ctx.state : 'zadny', hloubka }) };
})(TRP);

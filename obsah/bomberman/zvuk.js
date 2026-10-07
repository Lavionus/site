/* Bomberman – zvuky syntetizované přes Web Audio (žádné soubory). */
var BOMB = globalThis.BOMB || (globalThis.BOMB = {});
(function (B) {
'use strict';

const KLIC = 'webapp_bomberman_ticho';
let ac = null, master = null, sum = null, ticho = false;
try { ticho = localStorage.getItem(KLIC) === '1'; } catch (e) { /* bez úložiště */ }

function init() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  try { ac = new AC(); } catch (e) { ac = null; return; }
  master = ac.createGain(); master.gain.value = ticho ? 0 : 0.28; master.connect(ac.destination);
  sum = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const d = sum.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

function ton(f, t0, dur, typ, vol, f2) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = typ || 'square';
  o.frequency.setValueAtTime(f, t0);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(master);
  o.start(t0); o.stop(t0 + dur + 0.02);
}
function hluk(t0, dur, vol, fc0, fc1) {
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = sum; f.type = 'lowpass';
  f.frequency.setValueAtTime(fc0, t0); f.frequency.exponentialRampToValueAtTime(fc1, t0 + dur);
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f); f.connect(g); g.connect(master);
  s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.02);
}

let posledniVybuch = 0;
const ZVUKY = {
  poloz(t) { ton(180, t, 0.08, 'square', 0.25, 90); },
  vybuch(t) {
    if (t - posledniVybuch < 0.04) return;       // řetěz nemá řvát desetkrát naráz
    posledniVybuch = t;
    hluk(t, 0.55, 0.9, 2400, 60); ton(90, t, 0.35, 'triangle', 0.6, 35);
  },
  predmet(t) { [523, 659, 784, 1047].forEach((f, i) => ton(f, t + i * 0.06, 0.09, 'square', 0.18)); },
  kop(t) { ton(300, t, 0.06, 'triangle', 0.35, 150); },
  smrt(t) { ton(660, t, 0.7, 'square', 0.25, 80); },
  nepritel(t) { ton(880, t, 0.12, 'square', 0.2, 1320); },
  uroven(t) { [392, 523, 659, 784, 659, 784].forEach((f, i) => ton(f, t + i * 0.11, 0.14, 'square', 0.2)); },
  vyhra(t) { [523, 523, 784, 1047].forEach((f, i) => ton(f, t + i * 0.13, i === 3 ? 0.4 : 0.12, 'square', 0.2)); },
  prohra(t) { [392, 330, 262, 196].forEach((f, i) => ton(f, t + i * 0.18, 0.2, 'triangle', 0.3)); },
  zed(t) { ton(70, t, 0.08, 'square', 0.12, 50); },
  cas(t) { [880, 0, 880, 0, 880].forEach((f, i) => f && ton(f, t + i * 0.1, 0.08, 'square', 0.2)); },
  posily(t) { ton(200, t, 0.4, 'sawtooth', 0.2, 600); },
  pauza(t) { ton(700, t, 0.06, 'square', 0.15); ton(500, t + 0.07, 0.06, 'square', 0.15); },
};

function hraj(nazev) {
  if (!ac || ticho || !ZVUKY[nazev]) return;
  try { ZVUKY[nazev](ac.currentTime + 0.01); } catch (e) { /* nevadí */ }
}
function prepniTicho() {
  ticho = !ticho;
  try { localStorage.setItem(KLIC, ticho ? '1' : '0'); } catch (e) { /* nevadí */ }
  if (master) master.gain.value = ticho ? 0 : 0.28;
}

B.Z = { init, hraj, prepniTicho, ticho: () => ticho };

})(BOMB);

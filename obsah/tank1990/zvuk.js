/* Tank 1990 – zvuky syntetizované Web Audio (čtverec, trojúhelník, šum), žádné soubory. */
var TANK = globalThis.TANK || (globalThis.TANK = {});
(function (T) {
'use strict';

const KLIC = 'webapp_hra_tank1990_ticho';
let ac = null, master = null, sum = null, motor = null, ticho = false;
try { ticho = localStorage.getItem(KLIC) === '1'; } catch (e) { /* bez úložiště */ }

function init() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ac = new AC();
  master = ac.createGain(); master.gain.value = ticho ? 0 : 0.3; master.connect(ac.destination);
  sum = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const d = sum.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  // motor: tichý čtverec přes dolní propust, frekvence podle stavu
  const o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
  o.type = 'square'; o.frequency.value = 50; f.type = 'lowpass'; f.frequency.value = 380; g.gain.value = 0;
  o.connect(f); f.connect(g); g.connect(master); o.start();
  motor = { o, g, stav: 0 };
}

function ton(f, t0, dur, typ, vol, f2, drz) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = typ || 'square';
  o.frequency.setValueAtTime(f, t0);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  if (drz) { g.gain.setValueAtTime(vol, t0 + dur * 0.75); g.gain.linearRampToValueAtTime(0.0001, t0 + dur); }
  else g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(master);
  o.start(t0); o.stop(t0 + dur + 0.02);
}
function hluk(t0, dur, vol, fc0, fc1) {
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = sum; f.type = 'lowpass';
  f.frequency.setValueAtTime(fc0, t0); f.frequency.exponentialRampToValueAtTime(fc1, t0 + dur);
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f); f.connect(g); g.connect(master);
  s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.05);
}
const midi = n => 440 * Math.pow(2, (n - 69) / 12);
function melodie(noty, tempo, typ, vol, posun) {
  let t = ac.currentTime + 0.02 + (posun || 0);
  for (const [n, d] of noty) { if (n) ton(midi(n), t, d * tempo, typ, vol, null, true); t += d * tempo; }
}

// úvodní fanfára kola (vlastní skladba v duchu NES)
const UVOD = [[67, 1], [72, 1], [76, 1], [79, 2], [76, 1], [79, 3], [0, 1], [69, 1], [74, 1], [77, 1], [81, 2], [77, 1], [81, 3],
  [0, 1], [71, 1], [76, 1], [79, 1], [83, 2], [79, 1], [84, 6]];
const UVOD_BAS = [[48, 4], [48, 4], [50, 4], [50, 4], [52, 4], [55, 6]];

const ZVUKY = {
  start() { melodie(UVOD, 0.085, 'square', 0.09); melodie(UVOD_BAS, 0.085, 'triangle', 0.18); },
  strela() { const t = ac.currentTime; ton(880, t, 0.09, 'square', 0.07, 220); },
  cihla() { hluk(ac.currentTime, 0.12, 0.35, 3500, 300); },
  ocel() { const t = ac.currentTime; ton(1900, t, 0.08, 'triangle', 0.2, 1700); ton(2600, t, 0.05, 'square', 0.04); },
  stena() { hluk(ac.currentTime, 0.06, 0.2, 2000, 400); },
  pancir() { const t = ac.currentTime; ton(330, t, 0.1, 'square', 0.1, 160); ton(1400, t, 0.05, 'triangle', 0.12); },
  vybuch() { hluk(ac.currentTime, 0.5, 0.6, 2200, 70); },
  vybuchHrac() { const t = ac.currentTime; hluk(t, 0.9, 0.7, 1800, 40); ton(220, t, 0.6, 'square', 0.08, 40); },
  orel() { const t = ac.currentTime; hluk(t, 1.1, 0.8, 1600, 40); ton(180, t, 0.9, 'square', 0.1, 30); },
  bonusObjeven() { melodie([[76, 1], [79, 1], [84, 1], [88, 1]], 0.05, 'square', 0.08); },
  bonus() { melodie([[72, 1], [76, 1], [79, 1], [84, 1], [79, 1], [84, 2]], 0.045, 'square', 0.09); },
  bonusNepritel() { melodie([[64, 1], [60, 1], [57, 1], [52, 2]], 0.06, 'square', 0.09); },
  zivot() { melodie([[79, 1], [83, 1], [86, 1], [91, 2], [86, 1], [91, 3]], 0.06, 'square', 0.1); },
  lodZtracena() { hluk(ac.currentTime, 0.3, 0.4, 900, 200); },
  pauza() { melodie([[84, 1], [88, 1], [91, 1], [96, 2], [0, 2], [84, 1], [88, 1], [91, 1], [96, 2]], 0.05, 'square', 0.08); },
  gameOver() { melodie([[72, 2], [71, 2], [67, 2], [64, 2], [60, 6]], 0.12, 'square', 0.08, 0.6);
    melodie([[48, 4], [43, 4], [36, 6]], 0.12, 'triangle', 0.18, 0.6); },
  tik() { ton(1200, ac.currentTime, 0.03, 'square', 0.06); },
  volba() { ton(660, ac.currentTime, 0.04, 'square', 0.06); },
  editor() { ton(520, ac.currentTime, 0.03, 'triangle', 0.15); },
};

T.Z = {
  init,
  hraj(nazev) { if (!ac || ticho || !ZVUKY[nazev]) return; try { ZVUKY[nazev](); } catch (e) { /* zvuk není kritický */ } },
  /* 0 = ticho, 1 = volnoběh, 2 = jízda */
  motor(stav) {
    if (!motor || motor.stav === stav) return;
    motor.stav = stav;
    const t = ac.currentTime;
    motor.g.gain.setTargetAtTime(stav ? (stav === 2 ? 0.05 : 0.03) : 0, t, 0.03);
    motor.o.frequency.setTargetAtTime(stav === 2 ? 88 : 52, t, 0.05);
  },
  ticho() { return ticho; },
  prepniTicho() {
    ticho = !ticho;
    try { localStorage.setItem(KLIC, ticho ? '1' : '0'); } catch (e) { /* nevadí */ }
    if (master) master.gain.value = ticho ? 0 : 0.3;
    return ticho;
  },
};

})(TANK);

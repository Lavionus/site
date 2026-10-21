/* ============================================================
   Krumpáč – hudba na pozadí: malý chiptune sekvencer přes WebAudio.
   Každý svět má vlastní tóninu, tempo a vzorec (basa, melodie, bicí).
   ============================================================ */
var KRUMPAC = (typeof KRUMPAC !== 'undefined') ? KRUMPAC : (typeof global !== 'undefined' && global.KRUMPAC) || {};
if (typeof global !== 'undefined') global.KRUMPAC = KRUMPAC;

KRUMPAC.hudba = (function (K) {
  'use strict';
  const KLIC = 'webapp_hra_krumpac_hudba';
  let zapnuto = true;
  try { zapnuto = localStorage.getItem(KLIC) !== '0'; } catch { /* soukromé okno */ }

  // noty v půltónech od základního tónu; null = pauza. 16 kroků na takt, 2–4 takty.
  const SKLADBY = {
    1: { tempo: 132, zaklad: 45, typMel: 'square', // Důl: veselý moll, poskakující
      basa: [0, null, 0, null, 7, null, 0, null, 5, null, 5, null, 7, null, 3, null, 0, null, 0, null, 7, null, 10, null, 8, null, 7, null, 5, null, 3, null],
      melodie: [12, null, 15, 17, 19, null, 17, 15, 12, null, 10, 12, 15, null, null, null, 12, null, 15, 17, 19, null, 22, 19, 17, null, 15, 17, 12, null, null, null],
      bici: 'k.h.s.h.k.h.s.hk' },
    2: { tempo: 96, zaklad: 50, typMel: 'triangle', // Led: pomalé zvonky
      basa: [0, null, null, null, 7, null, null, null, 3, null, null, null, 5, null, null, null],
      melodie: [24, 19, 15, 12, 22, 19, 15, 10, 24, 20, 15, 12, 26, 22, 19, 15],
      bici: '....h.......h...' },
    3: { tempo: 104, zaklad: 43, typMel: 'sine', // Voda: snivé arpeggio
      basa: [0, null, null, 0, null, null, 5, null, 3, null, null, 3, null, null, 7, null],
      melodie: [12, 15, 19, 24, 19, 15, 12, 15, 10, 14, 17, 22, 17, 14, 10, 14],
      bici: 'k.......s.......' },
    4: { tempo: 150, zaklad: 40, typMel: 'sawtooth', // Kovárna: tlačící basa
      basa: [0, 0, 12, 0, 0, 12, 0, 10, 0, 0, 12, 0, 3, 5, 7, 10],
      melodie: [null, null, 12, null, null, 15, null, 12, null, null, 17, null, 15, null, 12, null],
      bici: 'k.h.s.hkk.h.s.hh' },
    boss: { tempo: 160, zaklad: 41, typMel: 'square', // napětí
      basa: [0, 0, 1, 0, 0, 0, 1, 0, 6, 6, 7, 6, 0, 0, 1, 0],
      melodie: [12, null, 13, null, 12, null, 18, null, 19, null, 18, null, 13, null, 12, null],
      bici: 'k.hsk.hsk.hsk.ss' },
    mapa: { tempo: 90, zaklad: 48, typMel: 'triangle', // klidná mapa
      basa: [0, null, null, null, 5, null, null, null, 7, null, null, null, 5, null, null, null],
      melodie: [12, null, 16, null, 19, null, 16, null, 17, null, 21, null, 19, null, 16, null],
      bici: '................' },
  };

  let ctx = null, vystup = null, aktualni = null, krok = 0, pristi = 0, casovac = null;
  const f = n => 440 * Math.pow(2, (n - 69) / 12);

  function nota(typ, freq, kdy, delka, hlas) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = typ; o.frequency.value = freq;
    g.gain.setValueAtTime(0, kdy); g.gain.linearRampToValueAtTime(hlas, kdy + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0008, kdy + delka);
    o.connect(g); g.connect(vystup); o.start(kdy); o.stop(kdy + delka + 0.02);
  }
  function buben(druh, kdy) {
    if (druh === 'k') { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(140, kdy); o.frequency.exponentialRampToValueAtTime(45, kdy + 0.12);
      g.gain.setValueAtTime(0.5, kdy); g.gain.exponentialRampToValueAtTime(0.001, kdy + 0.15); o.connect(g); g.connect(vystup); o.start(kdy); o.stop(kdy + 0.16); return; }
    const n = Math.floor(ctx.sampleRate * (druh === 's' ? 0.12 : 0.04));
    const buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = ctx.createBufferSource(); s.buffer = buf;
    const fl = ctx.createBiquadFilter(); fl.type = druh === 's' ? 'bandpass' : 'highpass'; fl.frequency.value = druh === 's' ? 1800 : 7000;
    const g = ctx.createGain(); g.gain.value = druh === 's' ? 0.25 : 0.12;
    s.connect(fl); fl.connect(g); g.connect(vystup); s.start(kdy);
  }

  function planuj() {
    if (!ctx || !aktualni) return;
    const sk = SKLADBY[aktualni], krokDelka = 60 / sk.tempo / 4;
    while (pristi < ctx.currentTime + 0.15) {
      const b = sk.basa[krok % sk.basa.length], m = sk.melodie[krok % sk.melodie.length], d = sk.bici[krok % sk.bici.length];
      if (b !== null && b !== undefined) nota('triangle', f(sk.zaklad + b), pristi, krokDelka * 1.8, 0.32);
      if (m !== null && m !== undefined) nota(sk.typMel, f(sk.zaklad + m), pristi, krokDelka * 1.4, sk.typMel === 'sawtooth' ? 0.06 : 0.09);
      if (d && d !== '.') buben(d, pristi);
      pristi += krokDelka; krok++;
    }
  }

  function hraj(co) {
    const k = K.zvuk && K.zvuk.kontext();
    if (k && !ctx) { ctx = k.ctx; vystup = ctx.createGain(); vystup.gain.value = 0.18; vystup.connect(k.hlavni); }
    const nove = zapnuto ? co : null;
    if (nove === aktualni && (casovac || !nove || !ctx)) return;   // už hraje (nebo ještě není zvuk povolen)
    aktualni = nove; krok = 0;
    if (ctx) pristi = ctx.currentTime + 0.05;
    clearInterval(casovac); casovac = null;
    if (aktualni && ctx) casovac = setInterval(planuj, 50);
  }
  let posledni = null;
  function prepni() {
    zapnuto = !zapnuto;
    try { localStorage.setItem(KLIC, zapnuto ? '1' : '0'); } catch { /* nevadí */ }
    const co = posledni; aktualni = '__'; hraj(co);
    return zapnuto;
  }
  return { hraj: co => { posledni = co; hraj(co); }, prepni, zapnuto: () => zapnuto, SKLADBY };
})(KRUMPAC);

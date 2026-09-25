/* ============================================================
   podzemi_zvuk.js – zvuky Nekonečného podzemí, syntetizované
   přes Web Audio (žádné nahrávky).

   Každý zvuk je funkce (ac, bus, t, R), takže se dá vyrobit živě
   i v OfflineAudioContext a změřit v testu (PodzemiZvuk.zmer).
   Prohlížeč pustí zvuk až po akci uživatele – stránka proto volá
   `odemkni()` při prvním stisku klávesy či dotyku.
   ============================================================ */
const PodzemiZvuk = (function () {
  'use strict';
  const KLIC = 'webapp_hra_podzemi_zvuk';
  let ac = null, bus = null, zapnuto = true, casovac = 0;
  try { zapnuto = localStorage.getItem(KLIC) !== '0'; } catch { /* nevadí */ }

  // --- pomůcky --------------------------------------------------
  const sumy = new WeakMap();
  function sum(a) {
    let b = sumy.get(a);
    if (!b) {
      b = a.createBuffer(1, a.sampleRate * 2, a.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      sumy.set(a, b);
    }
    return b;
  }
  function impuls(a, delka, utlum) {
    const n = Math.round(a.sampleRate * delka), b = a.createBuffer(2, n, a.sampleRate);
    for (let k = 0; k < 2; k++) {
      const d = b.getChannelData(k);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, utlum) * (i < a.sampleRate * 0.012 ? i / (a.sampleRate * 0.012) : 1);
    }
    return b;
  }
  // sběrnice: suchá cesta + dozvuk kamenné chodby, na konci kompresor proti přebuzení
  function sestav(a, cil) {
    const hlavni = a.createGain(); hlavni.gain.value = 2.2;
    const komp = a.createDynamicsCompressor();
    komp.threshold.value = -8; komp.ratio.value = 8; komp.attack.value = 0.003; komp.release.value = 0.25;
    hlavni.connect(komp); komp.connect(cil);
    const konv = a.createConvolver(); konv.buffer = impuls(a, 2.6, 3.2);
    const mokry = a.createGain(); mokry.gain.value = 0.55;
    mokry.connect(konv); konv.connect(hlavni);
    // dva kanály se společným dozvukem: efekty (hráč, souboj) a prostředí (zvuky na pozadí)
    const kanal = () => {
      const vol = a.createGain(), volW = a.createGain();
      vol.connect(hlavni); volW.connect(mokry);
      return { suchy: vol, mokry: volW, nastav: v => { vol.gain.value = v; volW.gain.value = v; } };
    };
    const efekty = kanal();
    efekty.prostredi = kanal();
    return efekty;
  }
  const PROSTREDI = ['kapka', 'krumpac', 'zvon', 'bublani', 'duneni', 'podivno', 'prasknuti', 'bouchnuti', 'sepot'];
  let hlasEfekty = 1, hlasProstredi = 0.7;
  // výstup jednoho zvuku: hlasitost → (vzdálenost = dolní propust) → panoráma → suchý / dozvuk
  function vystup(a, b, o) {
    o = Object.assign({ pan: 0, dozvuk: 0.25, hlas: 1, dalka: 0 }, o);
    const g = a.createGain(); g.gain.value = o.hlas;
    let uzel = g;
    if (o.dalka) {
      const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = o.dalka;
      g.connect(lp); uzel = lp;
    }
    const p = a.createStereoPanner(); p.pan.value = o.pan;
    uzel.connect(p);
    const d = a.createGain(); d.gain.value = 1 - o.dozvuk * 0.7; p.connect(d); d.connect(b.suchy);
    const w = a.createGain(); w.gain.value = o.dozvuk; p.connect(w); w.connect(b.mokry);
    return g;
  }
  function sumZdroj(a, t, delka, cil, filtr, f, q) {
    const s = a.createBufferSource(); s.buffer = sum(a);
    s.loopStart = 0; s.loop = true;
    const fl = a.createBiquadFilter(); fl.type = filtr; fl.frequency.value = f; if (q) fl.Q.value = q;
    s.connect(fl); fl.connect(cil);
    s.start(t, Math.random() * 1.5); s.stop(t + delka + 0.05);
    return fl;
  }
  function obalka(a, t, vrchol, nabeh, dozneni) {
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vrchol, t + nabeh);
    g.gain.exponentialRampToValueAtTime(0.0001, t + nabeh + dozneni);
    return g;
  }
  function dunivy(a, t, f0, f1, delka, hlas, cil) {
    const o = a.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + delka);
    const g = obalka(a, t, hlas, 0.004, delka);
    o.connect(g); g.connect(cil); o.start(t); o.stop(t + delka + 0.05);
  }
  function cvak(a, t, f, hlas, delka, cil) {
    const g = obalka(a, t, hlas, 0.001, delka);
    sumZdroj(a, t, delka + 0.01, g, 'bandpass', f, 1.2);
    g.connect(cil);
  }

  // --- zvuky ----------------------------------------------------
  const ZVUKY = {
    // krok: tlumený dopad + drť pod botou
    krok(a, b, t, R, o) {
      const tichy = o && o.tichy;
      const out = vystup(a, b, { pan: (R() - 0.5) * 0.25, dozvuk: 0.22, hlas: tichy ? 0.35 : 1 });
      const g = obalka(a, t, 0.55, 0.004, 0.11);
      sumZdroj(a, t, 0.13, g, 'lowpass', 420 + R() * 260, 0.8);
      g.connect(out);
      if (!tichy) dunivy(a, t, 120 + R() * 20, 50, 0.09, 0.4, out);
      const s = obalka(a, t + 0.012, 0.09, 0.003, 0.05);
      sumZdroj(a, t + 0.012, 0.06, s, 'highpass', 2500 + R() * 1500);
      s.connect(out);
      const povrch = o && o.povrch;
      if (povrch === 'voda') {                      // čvachtnutí: bublinky a šplouchnutí
        const e = obalka(a, t + 0.02, 0.3, 0.02, 0.18);
        sumZdroj(a, t + 0.02, 0.22, e, 'bandpass', 1100 + R() * 500, 1.5);
        e.connect(out);
        for (let i = 0; i < 3; i++) {
          const tt = t + 0.05 + R() * 0.12, b2 = a.createOscillator(); b2.type = 'sine';
          b2.frequency.setValueAtTime(500 + R() * 400, tt); b2.frequency.exponentialRampToValueAtTime(1200 + R() * 600, tt + 0.04);
          const eb = obalka(a, tt, 0.08, 0.004, 0.05);
          b2.connect(eb); eb.connect(out); b2.start(tt); b2.stop(tt + 0.08);
        }
      } else if (povrch === 'hlina') {              // měkčí, hlubší dopad
        dunivy(a, t, 90, 45, 0.12, 0.25, out);
      } else if (povrch === 'lava') {               // syknutí rozpálené skály
        const e = obalka(a, t + 0.03, 0.08, 0.05, 0.25);
        sumZdroj(a, t + 0.03, 0.3, e, 'highpass', 5000);
        e.connect(out);
      }
    },
    // otočka: jen šoupnutí
    otocka(a, b, t, R) {
      const out = vystup(a, b, { dozvuk: 0.15, hlas: 0.7 });
      const g = obalka(a, t, 0.5, 0.04, 0.16);
      sumZdroj(a, t, 0.22, g, 'bandpass', 1400 + R() * 600, 0.7);
      g.connect(out);
    },
    // náraz do zdi
    naraz(a, b, t, R) {
      const out = vystup(a, b, { dozvuk: 0.3 });
      dunivy(a, t, 90, 38, 0.18, 0.8, out);
      const g = obalka(a, t, 0.5, 0.002, 0.12);
      sumZdroj(a, t, 0.14, g, 'lowpass', 320, 0.7);
      g.connect(out);
      cvak(a, t + 0.05 + R() * 0.05, 2600, 0.05, 0.02, out);
    },
    // skřípot dveří: trhaný kov (stick-slip), hučení mechanismu, na konci žuchnutí
    dvere(a, b, t, R, o) {
      const out = vystup(a, b, { pan: o && o.pan !== undefined ? o.pan : (R() - 0.5) * 0.3, dozvuk: 0.4, hlas: 0.8 * ((o && o.hlas) || 1) });
      const delka = 0.85;
      const osc = a.createOscillator(); osc.type = 'sawtooth';
      const krivka = new Float32Array(48);
      let f = 170 + R() * 60;
      for (let i = 0; i < krivka.length; i++) { f = Math.max(120, Math.min(340, f + (R() - 0.45) * 40)); krivka[i] = f; }
      osc.frequency.setValueCurveAtTime(krivka, t, delka);
      const bp1 = a.createBiquadFilter(); bp1.type = 'bandpass'; bp1.frequency.value = 950; bp1.Q.value = 5;
      const bp2 = a.createBiquadFilter(); bp2.type = 'bandpass'; bp2.frequency.value = 2300; bp2.Q.value = 7;
      const trhani = a.createGain(); trhani.gain.setValueAtTime(0, t);
      // zrnka: rychlé záchvěvy různé síly jako kov drhnoucí o kov
      for (let tt = t; tt < t + delka; tt += 0.016 + R() * 0.022) {
        const h = (0.15 + R() * 0.5) * Math.sin(Math.PI * (tt - t) / delka + 0.2);
        trhani.gain.setValueAtTime(Math.max(0, h), tt);
        trhani.gain.setTargetAtTime(0.02, tt + 0.004, 0.006);
      }
      trhani.gain.setValueAtTime(0, t + delka);
      osc.connect(bp1); osc.connect(bp2); bp1.connect(trhani); bp2.connect(trhani);
      const hl = a.createGain(); hl.gain.value = 0.45; trhani.connect(hl); hl.connect(out);
      osc.start(t); osc.stop(t + delka + 0.05);
      // mechanismus a řetěz
      const m = a.createGain();
      m.gain.setValueAtTime(0.0001, t); m.gain.exponentialRampToValueAtTime(0.3, t + 0.08);
      m.gain.setValueAtTime(0.3, t + delka - 0.1); m.gain.exponentialRampToValueAtTime(0.0001, t + delka);
      sumZdroj(a, t, delka, m, 'lowpass', 170, 1.5);
      m.connect(out);
      for (let k = 0; k < 7; k++) cvak(a, t + 0.05 + R() * (delka - 0.1), 3200 + R() * 1500, 0.05, 0.015, out);
      dunivy(a, t + delka, 110, 45, 0.2, 0.6, out);
    },
    // sestup po schodech: kroky, každý níž a s delší ozvěnou
    sestup(a, b, t, R) {
      for (let i = 0; i < 5; i++) {
        const out = vystup(a, b, { dozvuk: 0.2 + i * 0.1, hlas: 1 - i * 0.14, dalka: 2400 - i * 350 });
        const tt = t + i * 0.26;
        const g = obalka(a, tt, 0.5, 0.004, 0.12);
        sumZdroj(a, tt, 0.14, g, 'lowpass', 480 - i * 40, 0.8);
        g.connect(out);
        dunivy(a, tt, 115 - i * 8, 45, 0.1, 0.4, out);
      }
    },
    // šepot: šum přes formanty po slabikách, z náhodné strany a daleko
    sepot(a, b, t, R) {
      const out = vystup(a, b, { pan: (R() < 0.5 ? -1 : 1) * (0.4 + R() * 0.5), dozvuk: 0.75, hlas: 0.55, dalka: 5200 });
      const SAMOHLASKY = [[700, 1150], [400, 2000], [300, 2300], [450, 850], [350, 750]];
      let tt = t;
      const slabik = 5 + (R() * 5 | 0);
      for (let i = 0; i < slabik; i++) {
        const delka = 0.1 + R() * 0.16;
        const env = a.createGain();
        env.gain.setValueAtTime(0.0001, tt);
        env.gain.exponentialRampToValueAtTime(0.35 + R() * 0.25, tt + 0.035);
        env.gain.setValueAtTime(0.3, tt + delka * 0.7);
        env.gain.exponentialRampToValueAtTime(0.0001, tt + delka);
        if (R() < 0.3) {
          sumZdroj(a, tt, delka, env, 'highpass', 4200 + R() * 1500);      // sykavka „s", „š"
        } else {
          const [f1, f2] = SAMOHLASKY[R() * SAMOHLASKY.length | 0];
          sumZdroj(a, tt, delka, env, 'bandpass', f1 * (0.9 + R() * 0.2), 6);
          const g2 = a.createGain(); g2.gain.value = 0.7; g2.connect(env);
          sumZdroj(a, tt, delka, g2, 'bandpass', f2 * (0.9 + R() * 0.2), 8);
        }
        env.connect(out);
        tt += delka + (R() < 0.25 ? 0.18 + R() * 0.25 : 0.02 + R() * 0.05);
      }
    },
    // vzdálené prasknutí: ostrá lupnutí kamene nebo kosti, ztlumená dálkou
    prasknuti(a, b, t, R) {
      const out = vystup(a, b, { pan: (R() - 0.5) * 1.6, dozvuk: 0.8, hlas: 1.8, dalka: 3200 });
      const n = 2 + (R() * 4 | 0);
      let tt = t;
      for (let i = 0; i < n; i++) {
        cvak(a, tt, 1400 + R() * 1400, i === 0 ? 0.9 : 0.3 + R() * 0.3, 0.025 + R() * 0.02, out);
        tt += 0.02 + R() * 0.09;
      }
    },
    // pád a bouchnutí: těžký dopad, pak se sype kamení
    bouchnuti(a, b, t, R) {
      const out = vystup(a, b, { pan: (R() - 0.5) * 1.6, dozvuk: 0.8, hlas: 0.9, dalka: 1400 });
      dunivy(a, t, 70, 30, 0.5, 0.9, out);
      const g = obalka(a, t, 0.6, 0.006, 0.45);
      sumZdroj(a, t, 0.5, g, 'lowpass', 260, 0.8);
      g.connect(out);
      const kaminku = 5 + (R() * 7 | 0);
      for (let i = 0; i < kaminku; i++) {
        const tt = t + 0.25 + Math.pow(R(), 1.6) * 1.1;
        cvak(a, tt, 2000 + R() * 2500, 0.12 * (1 - (tt - t) / 1.5), 0.012, out);
      }
    },

    // --- souboj -------------------------------------------------
    // máchnutí zbraní: šum s rychle stoupajícím pásmem
    mach(a, b, t, R) {
      const out = vystup(a, b, { dozvuk: 0.15, hlas: 0.9 });
      const g = obalka(a, t, 0.4, 0.05, 0.14);
      const f = sumZdroj(a, t, 0.22, g, 'bandpass', 500, 1.4);
      f.frequency.setValueAtTime(500 + R() * 200, t);
      f.frequency.exponentialRampToValueAtTime(2600, t + 0.16);
      g.connect(out);
    },
    // zásah: máchnutí + masitý úder
    zasah(a, b, t, R, o) {
      ZVUKY.mach(a, b, t, R);
      const out = vystup(a, b, { pan: (o && o.pan) || 0, dozvuk: 0.25 });
      const tt = t + 0.08;
      dunivy(a, tt, 150, 60, 0.13, 0.7, out);
      const g = obalka(a, tt, 0.5, 0.002, 0.09);
      sumZdroj(a, tt, 0.1, g, 'lowpass', 900, 0.9);
      g.connect(out);
      cvak(a, tt + 0.005, 1700 + R() * 500, 0.25, 0.03, out);
    },
    // hráč dostal ránu: úder a zachrčení
    zranen(a, b, t, R) {
      const out = vystup(a, b, { dozvuk: 0.2 });
      dunivy(a, t, 105, 45, 0.16, 0.8, out);
      const g = obalka(a, t, 0.45, 0.002, 0.12);
      sumZdroj(a, t, 0.13, g, 'lowpass', 520, 0.8);
      g.connect(out);
      const o = a.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(125 + R() * 20, t + 0.03); o.frequency.exponentialRampToValueAtTime(82, t + 0.24);
      const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 750;
      const e = obalka(a, t + 0.03, 0.22, 0.03, 0.2);
      o.connect(lp); lp.connect(e); e.connect(out); o.start(t + 0.03); o.stop(t + 0.3);
    },
    // potvora padla
    smrtPotvory(a, b, t, R, o) {
      const out = vystup(a, b, { pan: (o && o.pan) || 0, dozvuk: 0.4 });
      const g = obalka(a, t, 0.45, 0.01, 0.35);
      const f = sumZdroj(a, t, 0.4, g, 'lowpass', 1400, 1.2);
      f.frequency.setValueAtTime(1400, t); f.frequency.exponentialRampToValueAtTime(180, t + 0.35);
      g.connect(out);
      dunivy(a, t + 0.18, 85, 35, 0.3, 0.7, out);
      for (let k = 0; k < 4; k++) cvak(a, t + 0.2 + R() * 0.3, 1500 + R() * 2000, 0.08, 0.02, out);
    },
    // nová úroveň: vzestupné arpeggio
    uroven(a, b, t) {
      const out = vystup(a, b, { dozvuk: 0.5, hlas: 0.8 });
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
        const o = a.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
        const e = obalka(a, t + i * 0.09, 0.28, 0.01, 0.6);
        o.connect(e); e.connect(out); o.start(t + i * 0.09); o.stop(t + i * 0.09 + 0.7);
      });
    },
    // smrt hráče: umíráček a hluboký tón
    smrt(a, b, t) {
      const out = vystup(a, b, { dozvuk: 0.6, hlas: 0.9 });
      for (const [nasobek, hlas, delka] of [[1, 0.45, 2.8], [2.76, 0.2, 1.6], [5.4, 0.1, 0.9], [0.5, 0.35, 2.4]]) {
        const o = a.createOscillator(); o.type = 'sine'; o.frequency.value = 110 * nasobek;
        const e = obalka(a, t, hlas, 0.005, delka);
        o.connect(e); e.connect(out); o.start(t); o.stop(t + delka + 0.1);
      }
    },

    // --- předměty -----------------------------------------------
    // truhla: vrznutí víka a žuchnutí
    truhla(a, b, t, R, o) {
      const out = vystup(a, b, { pan: (o && o.pan) || 0, dozvuk: 0.3 });
      const s = a.createOscillator(); s.type = 'sawtooth';
      s.frequency.setValueAtTime(260, t); s.frequency.linearRampToValueAtTime(380 + R() * 60, t + 0.35);
      const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1300; bp.Q.value = 6;
      const e = a.createGain(); e.gain.setValueAtTime(0, t);
      for (let tt = t; tt < t + 0.38; tt += 0.02 + R() * 0.02) { e.gain.setValueAtTime(0.2 + R() * 0.35, tt); e.gain.setTargetAtTime(0.02, tt + 0.004, 0.006); }
      e.gain.setValueAtTime(0, t + 0.4);
      s.connect(bp); bp.connect(e); e.connect(out); s.start(t); s.stop(t + 0.42);
      dunivy(a, t + 0.42, 130, 55, 0.15, 0.6, out);
      cvak(a, t + 0.43, 2000, 0.15, 0.03, out);
    },
    // zlato: cinkání mincí
    zlato(a, b, t, R) {
      const out = vystup(a, b, { dozvuk: 0.3, hlas: 0.7 });
      for (let i = 0; i < 6; i++) {
        const tt = t + i * 0.045 + R() * 0.03, f = 2600 + R() * 1800;
        for (const [nas, h] of [[1, 0.2], [2.7, 0.08]]) {
          const s = a.createOscillator(); s.type = 'sine'; s.frequency.value = f * nas;
          const e = obalka(a, tt, h, 0.002, 0.18);
          s.connect(e); e.connect(out); s.start(tt); s.stop(tt + 0.22);
        }
      }
    },
    // šustnutí při braní a ukládání věcí
    sebrat(a, b, t, R) {
      const out = vystup(a, b, { dozvuk: 0.1, hlas: 0.8 });
      const e = obalka(a, t, 0.3, 0.03, 0.14);
      sumZdroj(a, t, 0.2, e, 'bandpass', 2200 + R() * 800, 0.8);
      e.connect(out);
    },
    // nasazení: kovové cvaknutí a zazvonění
    nasadit(a, b, t, R) {
      const out = vystup(a, b, { dozvuk: 0.25, hlas: 0.8 });
      cvak(a, t, 3200, 0.4, 0.03, out);
      for (const f of [880 + R() * 60, 1870]) {
        const s = a.createOscillator(); s.type = 'triangle'; s.frequency.value = f;
        const e = obalka(a, t + 0.01, 0.12, 0.002, 0.35);
        s.connect(e); e.connect(out); s.start(t + 0.01); s.stop(t + 0.4);
      }
    },
    // jídlo: tři křupnutí
    jist(a, b, t, R) {
      const out = vystup(a, b, { dozvuk: 0.1 });
      for (let i = 0; i < 3; i++) {
        const tt = t + i * 0.22;
        const e = obalka(a, tt, 0.35, 0.005, 0.08);
        sumZdroj(a, tt, 0.1, e, 'bandpass', 1500 + R() * 1000, 1.5);
        e.connect(out);
        dunivy(a, tt, 200, 120, 0.06, 0.2, out);
      }
    },
    // pití: bublání
    pit(a, b, t, R) {
      const out = vystup(a, b, { dozvuk: 0.15 });
      for (let i = 0; i < 5; i++) {
        const tt = t + i * 0.09 + R() * 0.03;
        const s = a.createOscillator(); s.type = 'sine';
        s.frequency.setValueAtTime(300 + R() * 150, tt); s.frequency.exponentialRampToValueAtTime(700 + R() * 300, tt + 0.06);
        const e = obalka(a, tt, 0.3, 0.005, 0.07);
        s.connect(e); e.connect(out); s.start(tt); s.stop(tt + 0.1);
      }
    },
    // účinek dobrého lektvaru: třpytivý tón
    kouzlo(a, b, t) {
      const out = vystup(a, b, { dozvuk: 0.55, hlas: 0.6 });
      [1318.5, 1760, 2093, 2637].forEach((f, i) => {
        const s = a.createOscillator(); s.type = 'sine'; s.frequency.value = f;
        const e = obalka(a, t + i * 0.06, 0.15, 0.01, 0.5);
        s.connect(e); e.connect(out); s.start(t + i * 0.06); s.stop(t + i * 0.06 + 0.55);
      });
    },
    // luk: brnknutí tětivy a svist šípu
    luk(a, b, t, R) {
      const out = vystup(a, b, { dozvuk: 0.25 });
      const s = a.createOscillator(); s.type = 'triangle';
      s.frequency.setValueAtTime(190, t); s.frequency.exponentialRampToValueAtTime(140, t + 0.25);
      const e = obalka(a, t, 0.45, 0.002, 0.25);
      s.connect(e); e.connect(out); s.start(t); s.stop(t + 0.3);
      const g = obalka(a, t + 0.02, 0.25, 0.02, 0.2);
      const f = sumZdroj(a, t + 0.02, 0.25, g, 'bandpass', 3000, 3);
      f.frequency.setValueAtTime(3500, t + 0.02); f.frequency.exponentialRampToValueAtTime(1200, t + 0.24);
      g.connect(out);
    },
    // kručení v břiše
    hlad(a, b, t, R) {
      const out = vystup(a, b, { dozvuk: 0.1, hlas: 0.9 });
      const s = a.createOscillator(); s.type = 'sawtooth';
      const krivka = new Float32Array(24);
      for (let i = 0; i < krivka.length; i++) krivka[i] = 70 + Math.sin(i * 0.9) * 25 + R() * 15;
      s.frequency.setValueCurveAtTime(krivka, t, 0.9);
      const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380; lp.Q.value = 4;
      const e = a.createGain();
      e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(0.5, t + 0.15);
      e.gain.setValueAtTime(0.4, t + 0.7); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      s.connect(lp); lp.connect(e); e.connect(out); s.start(t); s.stop(t + 0.95);
    },

    // --- tajemství a pasti ----------------------------------------
    // tajné dveře: skřípění kamene o kámen
    tajne(a, b, t, R, o) {
      const out = vystup(a, b, { pan: (o && o.pan) || 0, dozvuk: 0.45 });
      const e = a.createGain();
      e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(0.6, t + 0.1);
      e.gain.setValueAtTime(0.5, t + 0.9); e.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
      const f = sumZdroj(a, t, 1.25, e, 'bandpass', 260, 1.2);
      f.frequency.setValueAtTime(220, t); f.frequency.linearRampToValueAtTime(420, t + 1.1);
      e.connect(out);
      for (let k = 0; k < 10; k++) cvak(a, t + R() * 1.1, 900 + R() * 900, 0.15, 0.02, out);
      dunivy(a, t + 1.15, 90, 40, 0.3, 0.7, out);
    },
    // cvaknutí mechanismu, když si pasti všimneš
    pastOdhalena(a, b, t, R, o) {
      const out = vystup(a, b, { pan: (o && o.pan) || 0, dozvuk: 0.2 });
      cvak(a, t, 2600, 0.5, 0.02, out);
      cvak(a, t + 0.09, 1900, 0.35, 0.02, out);
    },
    // propadnutí jámou: svist a tvrdý dopad
    jama(a, b, t, R) {
      const out = vystup(a, b, { dozvuk: 0.5 });
      const g = obalka(a, t, 0.5, 0.05, 0.6);
      const f = sumZdroj(a, t, 0.7, g, 'bandpass', 1500, 1);
      f.frequency.setValueAtTime(1800, t); f.frequency.exponentialRampToValueAtTime(250, t + 0.6);
      g.connect(out);
      dunivy(a, t + 0.65, 80, 30, 0.35, 1, out);
      for (let k = 0; k < 6; k++) cvak(a, t + 0.7 + R() * 0.5, 1500 + R() * 2000, 0.12, 0.015, out);
    },
    // šipka ze zdi: cvak a ostrý svist
    sipka(a, b, t, R) {
      const out = vystup(a, b, { pan: (R() - 0.5) * 1.4, dozvuk: 0.2 });
      cvak(a, t, 2200, 0.4, 0.015, out);
      const g = obalka(a, t + 0.02, 0.4, 0.01, 0.12);
      const f = sumZdroj(a, t + 0.02, 0.15, g, 'bandpass', 5000, 4);
      f.frequency.setValueAtTime(5500, t + 0.02); f.frequency.exponentialRampToValueAtTime(2500, t + 0.14);
      g.connect(out);
    },
    // gong poplachu: kovové nesouzvučné parciály, dlouhé doznění
    gong(a, b, t) {
      const out = vystup(a, b, { dozvuk: 0.7, hlas: 0.9 });
      for (const [f, h, d] of [[98, 0.5, 3.5], [196 * 1.07, 0.25, 2.5], [311, 0.2, 2], [466, 0.12, 1.5], [739, 0.06, 1]]) {
        const s = a.createOscillator(); s.type = 'sine'; s.frequency.setValueAtTime(f * 1.02, t); s.frequency.exponentialRampToValueAtTime(f, t + 0.3);
        const e = obalka(a, t, h, 0.01, d);
        s.connect(e); e.connect(out); s.start(t); s.stop(t + d + 0.1);
      }
    },
    // padající kámen
    kamen(a, b, t, R) {
      const out = vystup(a, b, { dozvuk: 0.4 });
      for (let k = 0; k < 5; k++) cvak(a, t + k * 0.04 + R() * 0.03, 800 + R() * 900, 0.2, 0.03, out);
      dunivy(a, t + 0.25, 75, 30, 0.35, 0.65, out);
      const g = obalka(a, t + 0.25, 0.35, 0.004, 0.3);
      sumZdroj(a, t + 0.25, 0.32, g, 'lowpass', 500, 0.8);
      g.connect(out);
    },
    // požehnání: durový akord jako vzdálený chór
    oltarDobre(a, b, t) {
      const out = vystup(a, b, { dozvuk: 0.75, hlas: 0.7 });
      for (const f of [261.6, 329.6, 392, 523.3]) for (const ladeni of [-3, 3]) {
        const s = a.createOscillator(); s.type = 'sawtooth'; s.frequency.value = f; s.detune.value = ladeni;
        const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
        const e = a.createGain();
        e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(0.06, t + 0.4);
        e.gain.setValueAtTime(0.06, t + 1.2); e.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
        s.connect(lp); lp.connect(e); e.connect(out); s.start(t); s.stop(t + 2.3);
      }
    },
    // kletba: disonantní klesající tóny
    oltarZly(a, b, t) {
      const out = vystup(a, b, { dozvuk: 0.7, hlas: 0.8 });
      for (const [f0, f1] of [[220, 110], [233, 104], [311, 150]]) {
        const s = a.createOscillator(); s.type = 'sawtooth';
        s.frequency.setValueAtTime(f0, t); s.frequency.exponentialRampToValueAtTime(f1, t + 1.4);
        const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
        const e = obalka(a, t, 0.12, 0.08, 1.4);
        s.connect(lp); lp.connect(e); e.connect(out); s.start(t); s.stop(t + 1.6);
      }
    },
    // klíč v zámku
    odemceni(a, b, t, R) {
      const out = vystup(a, b, { dozvuk: 0.25 });
      cvak(a, t, 3000, 0.3, 0.02, out);
      cvak(a, t + 0.12, 2400, 0.35, 0.025, out);
      cvak(a, t + 0.3, 1600, 0.5, 0.04, out);
      dunivy(a, t + 0.3, 180, 90, 0.1, 0.4, out);
    },
    // otočení stránky
    stranka(a, b, t, R) {
      const out = vystup(a, b, { dozvuk: 0.1, hlas: 0.8 });
      for (let i = 0; i < 2; i++) {
        const tt = t + i * 0.22;
        const g = obalka(a, tt, 0.3, 0.04, 0.16);
        const f = sumZdroj(a, tt, 0.22, g, 'bandpass', 3000, 0.6);
        f.frequency.setValueAtTime(2000 + R() * 500, tt); f.frequency.linearRampToValueAtTime(5000, tt + 0.18);
        g.connect(out);
      }
    },

    // --- kouzla a bossové -----------------------------------------
    ohnivaKoule(a, b, t, R) {
      const out = vystup(a, b, { dozvuk: 0.4 });
      const g = obalka(a, t, 0.45, 0.05, 0.4);
      const f = sumZdroj(a, t, 0.45, g, 'bandpass', 600, 1.2);
      f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(1800, t + 0.35);
      g.connect(out);
      const tt = t + 0.4;
      dunivy(a, tt, 90, 30, 0.5, 0.55, out);
      const v = obalka(a, tt, 0.35, 0.005, 0.5);
      sumZdroj(a, tt, 0.55, v, 'lowpass', 900, 0.7);
      v.connect(out);
    },
    blesk(a, b, t, R) {
      const out = vystup(a, b, { dozvuk: 0.5 });
      for (let i = 0; i < 18; i++) cvak(a, t + R() * 0.25, 2000 + R() * 5000, 0.3, 0.01, out);
      const g = obalka(a, t, 0.5, 0.002, 0.3);
      sumZdroj(a, t, 0.32, g, 'highpass', 1500);
      g.connect(out);
      dunivy(a, t + 0.05, 70, 35, 0.6, 0.6, out);
    },
    leceniKouzlo(a, b, t) {
      const out = vystup(a, b, { dozvuk: 0.6, hlas: 0.7 });
      [523.3, 659.3, 784, 1046.5].forEach((f, i) => {
        const o = a.createOscillator(); o.type = 'sine'; o.frequency.value = f;
        const e = obalka(a, t + i * 0.03, 0.12, 0.15, 0.9);
        o.connect(e); e.connect(out); o.start(t + i * 0.03); o.stop(t + 1.2);   // start zároveň s obálkou, jinak krátce zazní naplno
      });
    },
    teleport(a, b, t, R) {
      const out = vystup(a, b, { dozvuk: 0.6 });
      const o = a.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(200, t); o.frequency.exponentialRampToValueAtTime(2400, t + 0.5);
      const e = obalka(a, t, 0.3, 0.1, 0.45);
      o.connect(e); e.connect(out); o.start(t); o.stop(t + 0.6);
      const g = obalka(a, t, 0.25, 0.2, 0.4);
      sumZdroj(a, t, 0.6, g, 'highpass', 4000);
      g.connect(out);
    },
    kouzloPotvory(a, b, t, R, o) {
      const out = vystup(a, b, { pan: (o && o.pan) || 0, dozvuk: 0.4, hlas: Math.max(0.4, (o && o.hlas) || 1) });
      const s = a.createOscillator(); s.type = 'square';
      s.frequency.setValueAtTime(900, t); s.frequency.exponentialRampToValueAtTime(180, t + 0.3);
      const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2000;
      const e = obalka(a, t, 0.25, 0.01, 0.3);
      s.connect(lp); lp.connect(e); e.connect(out); s.start(t); s.stop(t + 0.35);
    },
    privolani(a, b, t, R, o) {
      const out = vystup(a, b, { pan: (o && o.pan) || 0, dozvuk: 0.7 });
      for (const [f0, f1] of [[110, 330], [116, 348]]) {
        const s = a.createOscillator(); s.type = 'sawtooth';
        s.frequency.setValueAtTime(f0, t); s.frequency.exponentialRampToValueAtTime(f1, t + 0.8);
        const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
        const e = obalka(a, t, 0.12, 0.2, 0.7);
        s.connect(lp); lp.connect(e); e.connect(out); s.start(t); s.stop(t + 1);
      }
    },
    bossRev(a, b, t, R, o) {
      const out = vystup(a, b, { pan: (o && o.pan) || 0, dozvuk: 0.6 });
      const s = a.createOscillator(); s.type = 'sawtooth';
      s.frequency.setValueAtTime(95, t); s.frequency.linearRampToValueAtTime(130, t + 0.4); s.frequency.exponentialRampToValueAtTime(60, t + 1.3);
      const f1 = a.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 420; f1.Q.value = 2;
      const e = obalka(a, t, 0.6, 0.15, 1.2);
      s.connect(f1); f1.connect(e); e.connect(out); s.start(t); s.stop(t + 1.5);
      const g = obalka(a, t, 0.35, 0.2, 1);
      sumZdroj(a, t, 1.25, g, 'lowpass', 500, 1);
      g.connect(out);
    },
    bossPadl(a, b, t) {
      const out = vystup(a, b, { dozvuk: 0.6, hlas: 0.8 });
      [[392, 0], [523.3, 0.18], [659.3, 0.36], [784, 0.54], [1046.5, 0.72]].forEach(([f, d]) => {
        for (const typ of ['triangle', 'square']) {
          const o = a.createOscillator(); o.type = typ; o.frequency.value = f;
          const e = obalka(a, t + d, typ === 'square' ? 0.05 : 0.22, 0.01, d === 0.72 ? 1.4 : 0.35);
          o.connect(e); e.connect(out); o.start(t + d); o.stop(t + d + 1.5);
        }
      });
    },
    bariera(a, b, t) {
      const out = vystup(a, b, { dozvuk: 0.4, hlas: 0.8 });
      const s = a.createOscillator(); s.type = 'sawtooth'; s.frequency.value = 58;
      const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600;
      const e = obalka(a, t, 0.35, 0.03, 0.5);
      s.connect(lp); lp.connect(e); e.connect(out); s.start(t); s.stop(t + 0.6);
      for (let i = 0; i < 5; i++) cvak(a, t + i * 0.08, 5000, 0.08, 0.01, out);
    },

    // --- zvuky prostředí (na pozadí) ---------------------------------
    kapka(a, b, t, R) {
      const out = vystup(a, b, { pan: (R() - 0.5) * 1.6, dozvuk: 0.8, hlas: 0.7, dalka: 5000 });
      const s = a.createOscillator(); s.type = 'sine';
      s.frequency.setValueAtTime(900 + R() * 900, t); s.frequency.exponentialRampToValueAtTime(2200 + R() * 800, t + 0.05);
      const e = obalka(a, t, 0.35, 0.002, 0.08);
      s.connect(e); e.connect(out); s.start(t); s.stop(t + 0.1);
    },
    krumpac(a, b, t, R) {
      const out = vystup(a, b, { pan: (R() - 0.5) * 1.6, dozvuk: 0.85, hlas: 0.6, dalka: 3000 });
      for (let i = 0; i < 3 + (R() * 3 | 0); i++) {
        const tt = t + i * (0.55 + R() * 0.1);
        for (const [f, h] of [[1800 + R() * 200, 0.3], [3700, 0.12]]) {
          const s = a.createOscillator(); s.type = 'triangle'; s.frequency.value = f;
          const e = obalka(a, tt, h, 0.001, 0.15);
          s.connect(e); e.connect(out); s.start(tt); s.stop(tt + 0.2);
        }
      }
    },
    zvon(a, b, t) {
      const out = vystup(a, b, { pan: (Math.random() - 0.5), dozvuk: 0.9, hlas: 0.45, dalka: 2500 });
      for (const [n, h, d] of [[1, 0.4, 3], [2.4, 0.15, 2], [3.9, 0.08, 1.4]]) {
        const s = a.createOscillator(); s.type = 'sine'; s.frequency.value = 196 * n;
        const e = obalka(a, t, h, 0.005, d);
        s.connect(e); e.connect(out); s.start(t); s.stop(t + d + 0.1);
      }
    },
    bublani(a, b, t, R) {
      const out = vystup(a, b, { pan: (R() - 0.5) * 1.4, dozvuk: 0.5, hlas: 0.6, dalka: 1500 });
      for (let i = 0; i < 4; i++) {
        const tt = t + i * 0.18 + R() * 0.1;
        const s = a.createOscillator(); s.type = 'sine';
        s.frequency.setValueAtTime(80 + R() * 40, tt); s.frequency.exponentialRampToValueAtTime(200 + R() * 80, tt + 0.08);
        const e = obalka(a, tt, 0.5, 0.005, 0.1);
        s.connect(e); e.connect(out); s.start(tt); s.stop(tt + 0.15);
      }
    },
    duneni(a, b, t, R) {
      const out = vystup(a, b, { dozvuk: 0.7, hlas: 1.8, dalka: 400 });
      const e = a.createGain();
      e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(1.2, t + 0.8);
      e.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
      sumZdroj(a, t, 2.7, e, 'lowpass', 120, 1);
      e.connect(out);
    },
    podivno(a, b, t, R) {
      const out = vystup(a, b, { pan: (R() - 0.5) * 1.8, dozvuk: 0.9, hlas: 0.7 });
      const s = a.createOscillator(); s.type = 'sine';
      const f = 300 + R() * 500;
      s.frequency.setValueAtTime(f, t); s.frequency.linearRampToValueAtTime(f * (R() < 0.5 ? 0.66 : 1.5), t + 1.8);
      const lfo = a.createOscillator(); lfo.frequency.value = 5 + R() * 4;
      const lg = a.createGain(); lg.gain.value = f * 0.05; lfo.connect(lg); lg.connect(s.frequency);
      const e = obalka(a, t, 0.2, 0.5, 1.4);
      s.connect(e); e.connect(out); s.start(t); s.stop(t + 2); lfo.start(t); lfo.stop(t + 2);
    },

    // --- světlo a mechanismy ----------------------------------------
    zapaleni(a, b, t, R) {
      const out = vystup(a, b, { dozvuk: 0.2 });
      const g = obalka(a, t, 0.4, 0.06, 0.3);
      const f = sumZdroj(a, t, 0.4, g, 'bandpass', 700, 0.8);
      f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(1600, t + 0.3);
      g.connect(out);
      for (let i = 0; i < 8; i++) cvak(a, t + 0.1 + R() * 0.5, 2500 + R() * 2500, 0.12, 0.01, out);
    },
    zhasnuti(a, b, t) {
      const out = vystup(a, b, { dozvuk: 0.3 });
      const e = a.createGain();
      e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(0.4, t + 0.05);
      e.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
      sumZdroj(a, t, 0.85, e, 'highpass', 3000);
      e.connect(out);
    },
    paka(a, b, t, R) {
      const out = vystup(a, b, { dozvuk: 0.6 });
      cvak(a, t, 1500, 0.5, 0.04, out);
      dunivy(a, t + 0.05, 140, 70, 0.2, 0.5, out);
      for (let i = 0; i < 14; i++) cvak(a, t + 0.3 + i * 0.07 + R() * 0.02, 1800 + R() * 1200, 0.18, 0.02, out);   // řetěz
      dunivy(a, t + 1.4, 90, 35, 0.4, 0.7, out);
    },

    // --- hlasy potvor (když si tě všimnou) ------------------------
    hlas_krysa(a, b, t, R, o) {
      const out = vystup(a, b, { pan: (o && o.pan) || 0, dozvuk: 0.35, hlas: (o && o.hlas) || 1 });
      for (let i = 0; i < 3; i++) {
        const tt = t + i * (0.07 + R() * 0.04);
        const s = a.createOscillator(); s.type = 'sine';
        s.frequency.setValueAtTime(2300 + R() * 300, tt); s.frequency.exponentialRampToValueAtTime(3300 + R() * 400, tt + 0.05);
        const e = obalka(a, tt, 0.18, 0.005, 0.05);
        s.connect(e); e.connect(out); s.start(tt); s.stop(tt + 0.08);
      }
    },
    hlas_had(a, b, t, R, o) {
      const out = vystup(a, b, { pan: (o && o.pan) || 0, dozvuk: 0.3, hlas: (o && o.hlas) || 1 });
      const e = a.createGain();
      e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(0.35, t + 0.12);
      e.gain.setValueAtTime(0.3, t + 0.55); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      sumZdroj(a, t, 0.95, e, 'highpass', 3600 + R() * 800, 0.7);
      e.connect(out);
    },
    hlas_pavouk(a, b, t, R, o) {
      const out = vystup(a, b, { pan: (o && o.pan) || 0, dozvuk: 0.3, hlas: (o && o.hlas) || 1 });
      let tt = t;
      for (let i = 0; i < 9; i++) { cvak(a, tt, 3500 + R() * 1500, 0.22, 0.012, out); tt += 0.02 + R() * 0.02; }
      const e = obalka(a, t, 0.08, 0.02, 0.2);
      sumZdroj(a, t, 0.25, e, 'bandpass', 900, 2);
      e.connect(out);
    },
    hlas_goblin(a, b, t, R, o) {
      const out = vystup(a, b, { pan: (o && o.pan) || 0, dozvuk: 0.3, hlas: (o && o.hlas) || 1 });
      for (let i = 0; i < 2; i++) {
        const tt = t + i * 0.22, delka = 0.16 + R() * 0.06;
        const s = a.createOscillator(); s.type = 'sawtooth';
        s.frequency.setValueAtTime(165 + R() * 30, tt); s.frequency.exponentialRampToValueAtTime(105, tt + delka);
        const f1 = a.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 650; f1.Q.value = 3;
        const f2 = a.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1150; f2.Q.value = 5;
        const e = obalka(a, tt, 0.5, 0.02, delka);
        s.connect(f1); s.connect(f2); f1.connect(e); f2.connect(e); e.connect(out);
        s.start(tt); s.stop(tt + delka + 0.05);
      }
    },
    hlas_kostlivec(a, b, t, R, o) {
      const out = vystup(a, b, { pan: (o && o.pan) || 0, dozvuk: 0.45, hlas: (o && o.hlas) || 1 });
      let tt = t;
      for (let i = 0; i < 14; i++) {
        cvak(a, tt, 1300 + R() * 1400, 0.75 * (1 - i / 16), 0.022, out);
        tt += 0.018 + R() * 0.03;
      }
    },
  };

  // --- živé přehrávání -----------------------------------------
  function odemkni() {
    if (!zapnuto) return;
    try {
      if (!ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ac = new AC();
        bus = sestav(ac, ac.destination);
        bus.nastav(hlasEfekty); bus.prostredi.nastav(hlasProstredi);
        planujAtmosferu();
      }
      if (ac.state === 'suspended') ac.resume();
    } catch { ac = null; }
  }
  function hraj(druh, o) {
    if (!zapnuto || !ac || ac.state !== 'running' || !ZVUKY[druh]) return;
    // zvuky na pozadí jdou kanálem prostředí (vlastní hlasitost), ostatní kanálem efektů
    const kanal = PROSTREDI.includes(druh) && !(o && o.pan !== undefined) ? bus.prostredi : bus;
    try { ZVUKY[druh](ac, kanal, ac.currentTime + 0.01, Math.random, o); } catch { /* zvuk není pro hru nutný */ }
  }

  // náhodné zvuky z hlubin podle prostředí: [zvuk, váha], rozestup v sekundách
  const ATMOSFERA = {
    'Kamenné kobky':    { zvuky: [['prasknuti', 4], ['bouchnuti', 3], ['sepot', 2.5]], od: 15, do: 40 },
    'Zatopené jeskyně': { zvuky: [['kapka', 8], ['sepot', 1.5], ['bouchnuti', 1.5]], od: 4, do: 14 },
    'Trpasličí doly':   { zvuky: [['krumpac', 4], ['bouchnuti', 3], ['prasknuti', 2]], od: 12, do: 30 },
    'Krypta':           { zvuky: [['sepot', 4], ['zvon', 2], ['prasknuti', 2]], od: 12, do: 30 },
    'Lávové podzemí':   { zvuky: [['bublani', 5], ['duneni', 3], ['prasknuti', 2]], od: 6, do: 18 },
    'Podivno':          { zvuky: [['podivno', 5], ['sepot', 3], ['zvon', 1]], od: 8, do: 22 },
  };
  let prostredi = 'Kamenné kobky';
  function nastavProstredi(nazev) {
    if (!ATMOSFERA[nazev] || nazev === prostredi) return;
    prostredi = nazev;
    if (ac) planujAtmosferu();
  }
  function planujAtmosferu() {
    clearTimeout(casovac);
    const A = ATMOSFERA[prostredi];
    casovac = setTimeout(() => {
      if (!document.hidden) {
        const soucet = A.zvuky.reduce((x, z) => x + z[1], 0);
        let r = Math.random() * soucet;
        for (const [z, v] of A.zvuky) { r -= v; if (r <= 0) { hraj(z); break; } }
      }
      planujAtmosferu();
    }, (A.od + Math.random() * (A.do - A.od)) * 1000);
  }

  function hlasitost(efekty, prostredi) {
    hlasEfekty = efekty; hlasProstredi = prostredi;
    if (bus) { bus.nastav(efekty); bus.prostredi.nastav(prostredi); }
  }

  function nastav(zap) {
    zapnuto = !!zap;
    try { localStorage.setItem(KLIC, zapnuto ? '1' : '0'); } catch { /* nevadí */ }
    if (zapnuto) odemkni();
    else if (ac && ac.state === 'running') ac.suspend();
  }

  // test: vyrobí zvuk offline a vrátí špičku a RMS
  async function zmer(druh, o) {
    const oc = new OfflineAudioContext(2, 44100 * 3.5, 44100);
    const b = sestav(oc, oc.destination);
    let s = 7;
    const R = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    ZVUKY[druh](oc, b, 0.05, R, o);
    const buf = await oc.startRendering();
    let spicka = 0, sq = 0, nan = false;
    for (let k = 0; k < 2; k++) {
      const d = buf.getChannelData(k);
      for (let i = 0; i < d.length; i++) { const v = d[i]; if (v !== v) nan = true; spicka = Math.max(spicka, Math.abs(v)); sq += v * v; }
    }
    return { druh, spicka: +spicka.toFixed(3), rms: +Math.sqrt(sq / (buf.length * 2)).toFixed(4), nan };
  }

  return {
    odemkni, hraj, nastav, zmer, nastavProstredi, hlasitost,
    get zapnuto() { return zapnuto; },
    get bezi() { return !!ac && ac.state === 'running'; },
    druhy: Object.keys(ZVUKY),
  };
})();

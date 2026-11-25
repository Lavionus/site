/* ============================================================
   podzemi_zvuk.js – zvuky Nekonečného podzemí, syntetizované
   přes Web Audio (žádné nahrávky).

   Každý zvuk je funkce (ac, bus, t, R), takže se dá vyrobit živě
   i v OfflineAudioContext a změřit v testu (PodzemiZvuk.zmer).
   Prohlížeč pustí zvuk až po akci uživatele – stránka proto volá
   `odemkni()` při prvním stisku klávesy či dotyku.

   Zásady (20. 11. 2026): filtrovaný šum místo holých pil a čtverců,
   rychlý náběh + exponenciální doznění, vrstvy (dopad + šum + materiál),
   R() mění výšku a barvu při každém přehrání, nic nad ~6 kHz
   (celou sběrnici navíc jemně ořezává dolní propust).
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
  // dozvuk kamenné chodby: pár raných odrazů od stěn, pak hustý ocas, ve kterém výšky doznívají dřív než basy
  function impuls(a, delka, utlum) {
    const sr = a.sampleRate, n = Math.round(sr * delka), b = a.createBuffer(2, n, sr);
    for (let k = 0; k < 2; k++) {
      const d = b.getChannelData(k);
      let lp = 0;
      for (let i = 0; i < n; i++) {
        const x = i / n;
        lp += (0.8 - 0.68 * x) * (Math.random() * 2 - 1 - lp);
        d[i] = lp * Math.pow(1 - x, utlum) * (i < sr * 0.02 ? i / (sr * 0.02) : 1);
      }
      for (let r = 0; r < 7; r++) {
        const j = Math.round(sr * (0.007 + r * 0.011 + Math.random() * 0.006)), h = (0.55 - r * 0.06) * (Math.random() < 0.5 ? -1 : 1);
        for (let m = 0; m < 24 && j + m < n; m++) d[j + m] += h * (1 - m / 24);
      }
    }
    return b;
  }
  // sběrnice: suchá cesta + dozvuk, pak jemné ořezání extrémů (pod 30 Hz, nad ~7 kHz), kompresor a měkký omezovač
  function sestav(a, cil) {
    const hlavni = a.createGain(); hlavni.gain.value = 2.2;
    const hp = a.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 30; hp.Q.value = 0.6;
    const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6800; lp.Q.value = 0.54;   // dvě propusti = Butterworth 4. řádu
    const lp2 = a.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = 6800; lp2.Q.value = 1.31;
    const komp = a.createDynamicsCompressor();      // pozor: kompresor sám přidává zisk podle prahu – měnit jen s přeměřením hudby
    komp.threshold.value = -8; komp.ratio.value = 8; komp.attack.value = 0.003; komp.release.value = 0.25;
    const omez = a.createWaveShaper();               // měkké koleno: do 0,6 lineárně, výš se plynule stáčí pod 0,97
    const k = new Float32Array(2049);
    for (let i = 0; i < k.length; i++) { const x = i / 1024 - 1, ax = Math.abs(x); k[i] = ax < 0.6 ? x : Math.sign(x) * (0.6 + 0.37 * Math.tanh((ax - 0.6) / 0.37)); }
    omez.curve = k; omez.oversample = '2x';
    hlavni.connect(hp); hp.connect(lp); lp.connect(lp2); lp2.connect(komp); komp.connect(omez); omez.connect(cil);
    const konv = a.createConvolver(); konv.buffer = impuls(a, 2.4, 2.6);
    const predzpozdeni = a.createDelay(0.1); predzpozdeni.delayTime.value = 0.018;
    const tlum = a.createBiquadFilter(); tlum.type = 'lowpass'; tlum.frequency.value = 4200;   // kámen pohltí výšky
    const mokry = a.createGain(); mokry.gain.value = 0.5;
    mokry.connect(predzpozdeni); predzpozdeni.connect(tlum); tlum.connect(konv); konv.connect(hlavni);
    // tři kanály se společným dozvukem: efekty (hráč, souboj), prostředí (zvuky na pozadí) a hudba
    const kanal = () => {
      const vol = a.createGain(), volW = a.createGain();
      vol.connect(hlavni); volW.connect(mokry);
      return { suchy: vol, mokry: volW, nastav: v => { vol.gain.value = v; volW.gain.value = v; } };
    };
    const efekty = kanal();
    efekty.prostredi = kanal();
    efekty.hudba = kanal();
    return efekty;
  }
  const PROSTREDI = ['kapka', 'krumpac', 'zvon', 'bublani', 'duneni', 'podivno', 'prasknuti', 'bouchnuti', 'sepot'];
  let hlasEfekty = 1, hlasProstredi = 0.7, hlasHudba = 0.25;
  // výstup jednoho zvuku: hlasitost → (vzdálenost = dolní propust) → panoráma → suchý / dozvuk
  function vystup(a, b, o) {
    o = Object.assign({ pan: 0, dozvuk: 0.25, hlas: 1, dalka: 0 }, o);
    const g = a.createGain(); g.gain.value = o.hlas;
    let uzel = g;
    if (o.dalka) {
      const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = o.dalka;
      g.connect(lp); uzel = lp;
    }
    const p = a.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, o.pan));
    uzel.connect(p);
    const d = a.createGain(); d.gain.value = 1 - o.dozvuk * 0.7; p.connect(d); d.connect(b.suchy);
    const w = a.createGain(); w.gain.value = o.dozvuk; p.connect(w); w.connect(b.mokry);
    return g;
  }
  // výstup zvuku potvory / události v prostoru (pan a hlas ze stránky)
  const vProstoru = (a, b, o, R, dozvuk, hlas) => vystup(a, b, {
    pan: o && o.pan !== undefined ? o.pan : (R() - 0.5) * 0.3, dozvuk,
    hlas: (hlas || 1) * ((o && o.hlas) || 1), dalka: o && o.dalka,
  });
  const kolem = (R, x, r) => x * (1 + (R() - 0.5) * 2 * r);   // náhodná odchylka ±r
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
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vrchol), t + nabeh);
    g.gain.exponentialRampToValueAtTime(0.0001, t + nabeh + dozneni);
    return g;
  }
  // obálka s výdrží: náběh, držení (lehce klesá), doznění
  function obalkaDrz(a, t, vrchol, nabeh, drzet, dozneni) {
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vrchol, t + nabeh);
    g.gain.linearRampToValueAtTime(vrchol * 0.75, t + nabeh + drzet);
    g.gain.exponentialRampToValueAtTime(0.0001, t + nabeh + drzet + dozneni);
    return g;
  }
  // šumová vrstva s obálkou (a volitelným posunem filtru f → f1)
  function sumVrstva(a, t, cil, filtr, f, q, hlas, nabeh, dozneni, f1) {
    const g = obalka(a, t, hlas, nabeh, dozneni);
    const fl = sumZdroj(a, t, nabeh + dozneni + 0.02, g, filtr, f, q);
    if (f1) { fl.frequency.setValueAtTime(f, t); fl.frequency.exponentialRampToValueAtTime(f1, t + nabeh + dozneni); }
    g.connect(cil);
    return fl;
  }
  // jednoduchý tón s obálkou (volitelně klouže na f1 a jde přes dolní propust)
  function ton(a, t, f, hlas, nabeh, delka, cil, typ, f1, jas) {
    const o = a.createOscillator(); o.type = typ || 'sine';
    o.frequency.setValueAtTime(f, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + nabeh + delka);
    const e = obalka(a, t, hlas, nabeh, delka);
    if (jas) { const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = jas; o.connect(lp); lp.connect(e); }
    else o.connect(e);
    e.connect(cil); o.start(t); o.stop(t + nabeh + delka + 0.05);
    return o;
  }
  function dunivy(a, t, f0, f1, delka, hlas, cil) { ton(a, t, f0, hlas, 0.004, delka, cil, 'sine', f1); }
  function cvak(a, t, f, hlas, delka, cil) {
    const g = obalka(a, t, hlas, 0.001, delka);
    sumZdroj(a, t, delka + 0.01, g, 'bandpass', Math.min(f, 5200), 1.2);
    g.connect(cil);
  }
  // dopad těla / předmětu: hluboký „thump" + tlumený šum
  function dopad(a, t, cil, R, sila, jas) {
    dunivy(a, t, kolem(R, 105, 0.12), 42, 0.13 + 0.08 * sila, 0.55 * sila, cil);
    sumVrstva(a, t, cil, 'lowpass', kolem(R, jas || 420, 0.2), 0.7, 0.42 * sila, 0.003, 0.09 + 0.06 * sila);
  }
  // kov: nesouzvučné alikvoty (zvon/čepel) se zázněji, krátké cinknutí na začátku
  function kov(a, t, f, hlas, delka, cil, R) {
    for (const [n, h, d] of [[1, 1, 1], [1.004, 0.5, 0.9], [2.76, 0.5, 0.55], [5.4, 0.25, 0.35], [8.93, 0.12, 0.22]]) {
      const ff = f * n * (1 + (R() - 0.5) * 0.006);
      if (ff > 6000) continue;
      ton(a, t, ff, hlas * h * 0.5, 0.002, delka * d, cil);
    }
    cvak(a, t, Math.min(f * 2.2, 4800), hlas * 0.35, 0.008, cil);
  }
  // zvonek / celesta: harmonické alikvoty, měkký kulatý tón
  function zvonek(a, t, f, hlas, delka, cil, nabeh) {
    for (const [n, h, d] of [[1, 1, 1], [2, 0.28, 0.5], [3, 0.09, 0.3], [4.2, 0.04, 0.2]]) {
      if (f * n > 6000) continue;
      ton(a, t, f * n, hlas * h, nabeh || 0.004, delka * d, cil);
    }
  }
  // dřevo: krátký šumový impuls přes úzké rezonance prken + tupý tón
  function drevo(a, t, f, hlas, delka, cil, R) {
    sumVrstva(a, t, cil, 'bandpass', f, 9, hlas * 2.2, 0.002, delka);
    sumVrstva(a, t, cil, 'bandpass', f * kolem(R, 2.3, 0.05), 7, hlas * 1.1, 0.001, delka * 0.55);
    ton(a, t, f, hlas * 0.45, 0.002, delka * 0.7, cil, 'sine', f * 0.85);
  }
  // drť: rozsypané cvaknutí (kamínky, třísky, střepy) hustší na začátku a slábnoucí
  function drt(a, t, n, delka, f0, f1, hlas, cil, R, delkaZrna) {
    for (let i = 0; i < n; i++) {
      const x = Math.pow(R(), 1.7), tt = t + x * delka;
      cvak(a, tt, f0 + R() * (f1 - f0), hlas * (1 - 0.8 * x) * (0.4 + 0.6 * R()), (delkaZrna || 0.014) * (0.6 + R() * 0.8), cil);
    }
  }
  // praskání ohně: nepravidelná lupnutí + šumění plamene
  function praskani(a, t, delka, hustota, hlas, cil, R) {
    sumVrstva(a, t, cil, 'bandpass', kolem(R, 600, 0.2), 0.8, hlas * 0.5, delka * 0.25, delka * 0.75);
    for (let tt = t + R() * 0.03; tt < t + delka; tt += (0.02 + R() * 0.09) / hustota) {
      cvak(a, tt, 1200 + R() * 2600, hlas * (0.3 + R() * 0.7), 0.004 + R() * 0.01, cil);
    }
  }
  // hlas stvoření: zdroj (pila/trojúhelník + dech) → chrapot (AM) → formanty → obálka
  // p = { f: [f0, f1, …], delka, formanty: [[f, Q, zisk]…], dech, chrapot: [Hz, hloubka], vibrato: [Hz, podíl], typ, hlas, nabeh }
  function hlasStvury(a, t, p, cil) {
    const d = p.delka, nabeh = p.nabeh || 0.025;
    const env = obalkaDrz(a, t, p.hlas, nabeh, d * 0.5, Math.max(0.03, d * 0.5 - nabeh));
    const vstup = a.createGain();
    let am = vstup;
    if (p.chrapot) {                                  // chrapot = rychlé kolísání síly (vrčení, chrochtání)
      am = a.createGain(); am.gain.value = 1 - p.chrapot[1] / 2;
      const l = a.createOscillator(); l.frequency.value = p.chrapot[0];
      const lg = a.createGain(); lg.gain.value = p.chrapot[1] / 2;
      l.connect(lg); lg.connect(am.gain); vstup.connect(am); l.start(t); l.stop(t + d + 0.05);
    }
    const o = a.createOscillator(); o.type = p.typ || 'sawtooth';
    const f = p.f;
    o.frequency.setValueAtTime(f[0], t);
    for (let i = 1; i < f.length; i++) o.frequency.exponentialRampToValueAtTime(f[i], t + d * i / (f.length - 1));
    if (p.vibrato) {
      const l = a.createOscillator(); l.frequency.value = p.vibrato[0];
      const lg = a.createGain(); lg.gain.value = f[0] * p.vibrato[1];
      l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + d + 0.05);
    }
    const tonG = a.createGain(); tonG.gain.value = 1 - (p.dech || 0) * 0.6;
    o.connect(tonG); tonG.connect(vstup); o.start(t); o.stop(t + d + 0.05);
    if (p.dech) { const g = a.createGain(); g.gain.value = p.dech * 2; sumZdroj(a, t, d, g, 'lowpass', 3500); g.connect(vstup); }
    const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3800;
    for (const [ff, q, z] of p.formanty) {
      const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = ff; bp.Q.value = q;
      const g = a.createGain(); g.gain.value = z;
      am.connect(bp); bp.connect(g); g.connect(lp);
    }
    lp.connect(env); env.connect(cil);
  }

  // --- zvuky ----------------------------------------------------
  const ZVUKY = {
    // krok: pata (tlumený dopad) a špička (drť pod botou), povrch mění barvu
    krok(a, b, t, R, o) {
      const tichy = o && o.tichy, povrch = o && o.povrch;
      const out = vystup(a, b, { pan: (R() - 0.5) * 0.25, dozvuk: 0.22, hlas: tichy ? 0.15 : 0.4 });   // kroky jen tiše v pozadí
      const mekky = povrch === 'hlina' || povrch === 'voda';
      sumVrstva(a, t, out, 'lowpass', kolem(R, mekky ? 300 : 460, 0.2), 0.8, 0.55, 0.004, 0.1);
      if (!tichy) dunivy(a, t, kolem(R, mekky ? 95 : 120, 0.1), 48, 0.09, 0.35, out);
      const tt = t + 0.035 + R() * 0.02;                          // špička: krátké šoupnutí
      if (!mekky) sumVrstva(a, tt, out, 'bandpass', kolem(R, 2200, 0.3), 1.1, 0.14, 0.006, 0.05);
      if (povrch === 'voda') {                      // čvachtnutí: šplouchnutí a bublinky
        sumVrstva(a, t + 0.015, out, 'bandpass', kolem(R, 900, 0.25), 1.3, 0.3, 0.015, 0.16, 1600);
        for (let i = 0; i < 3; i++) {
          const tb = t + 0.05 + R() * 0.12;
          ton(a, tb, 450 + R() * 350, 0.07, 0.004, 0.045, out, 'sine', 1000 + R() * 500);
        }
      } else if (povrch === 'hlina') {              // měkčí, hlubší dopad a mlasknutí
        dunivy(a, t, 85, 42, 0.12, 0.22, out);
        sumVrstva(a, t + 0.04, out, 'bandpass', kolem(R, 700, 0.2), 2, 0.12, 0.01, 0.06);
      } else if (povrch === 'lava') {               // syknutí rozpálené skály
        sumVrstva(a, t + 0.03, out, 'bandpass', kolem(R, 3400, 0.15), 0.9, 0.1, 0.04, 0.28);
      }
    },
    // náraz do zdi: tupá rána, cinknutí výstroje a trocha sypajícího se prachu
    naraz(a, b, t, R) {
      const out = vystup(a, b, { dozvuk: 0.3, pan: (R() - 0.5) * 0.2 });
      dopad(a, t, out, R, 1.3, 340);
      kov(a, t + 0.01, kolem(R, 1250, 0.1), 0.08, 0.25, out, R);
      drt(a, t + 0.06, 4, 0.35, 1400, 2600, 0.05, out, R);
    },
    // skřípot dveří: trhaný kov (stick-slip) přes rezonance, hučení mechanismu, na konci žuchnutí a cvaknutí závory
    dvere(a, b, t, R, o) {
      const out = vystup(a, b, { pan: o && o.pan !== undefined ? o.pan : (R() - 0.5) * 0.3, dozvuk: 0.4, hlas: 0.8 * ((o && o.hlas) || 1) });
      const delka = kolem(R, 0.85, 0.12);
      const osc = a.createOscillator(); osc.type = 'sawtooth';
      const krivka = new Float32Array(48);
      let f = 150 + R() * 60;
      for (let i = 0; i < krivka.length; i++) { f = Math.max(110, Math.min(300, f + (R() - 0.45) * 32)); krivka[i] = f; }
      osc.frequency.setValueCurveAtTime(krivka, t, delka);
      const bp1 = a.createBiquadFilter(); bp1.type = 'bandpass'; bp1.frequency.value = kolem(R, 820, 0.1); bp1.Q.value = 4;
      const bp2 = a.createBiquadFilter(); bp2.type = 'bandpass'; bp2.frequency.value = kolem(R, 1750, 0.1); bp2.Q.value = 5;
      const g2 = a.createGain(); g2.gain.value = 0.5;
      const trhani = a.createGain(); trhani.gain.setValueAtTime(0, t);
      for (let tt = t; tt < t + delka; tt += 0.018 + R() * 0.024) {
        const h = (0.15 + R() * 0.45) * Math.sin(Math.PI * (tt - t) / delka + 0.2);
        trhani.gain.setValueAtTime(Math.max(0, h), tt);
        trhani.gain.setTargetAtTime(0.03, tt + 0.004, 0.008);
      }
      trhani.gain.setValueAtTime(0, t + delka);
      osc.connect(bp1); osc.connect(bp2); bp1.connect(trhani); bp2.connect(g2); g2.connect(trhani);
      const hl = a.createGain(); hl.gain.value = 0.38; trhani.connect(hl); hl.connect(out);
      osc.start(t); osc.stop(t + delka + 0.05);
      // mechanismus: hučení a řetěz
      const m = obalkaDrz(a, t, 0.3, 0.08, delka - 0.2, 0.12);
      sumZdroj(a, t, delka, m, 'lowpass', 160, 1.5);
      m.connect(out);
      for (let k = 0; k < 6; k++) kov(a, t + 0.05 + R() * (delka - 0.1), 1500 + R() * 900, 0.04, 0.08, out, R);
      dopad(a, t + delka, out, R, 1.2, 300);
      cvak(a, t + delka + 0.01, 1800, 0.12, 0.02, out);
    },
    // sestup po schodech: kroky, každý níž a s delší ozvěnou
    sestup(a, b, t, R) {
      for (let i = 0; i < 5; i++) {
        const out = vystup(a, b, { dozvuk: 0.2 + i * 0.1, hlas: 1 - i * 0.14, dalka: 2400 - i * 350 });
        const tt = t + i * kolem(R, 0.26, 0.06);
        dopad(a, tt, out, R, 0.6, 460 - i * 40);
        sumVrstva(a, tt + 0.03, out, 'bandpass', kolem(R, 1900, 0.2), 1.2, 0.08, 0.005, 0.05);
      }
    },
    // šepot: šum přes formanty po slabikách, z náhodné strany a daleko
    sepot(a, b, t, R) {
      const out = vystup(a, b, { pan: (R() < 0.5 ? -1 : 1) * (0.4 + R() * 0.5), dozvuk: 0.75, hlas: 0.55, dalka: 4500 });
      const SAMOHLASKY = [[700, 1150], [400, 2000], [300, 2300], [450, 850], [350, 750]];
      let tt = t;
      const slabik = 5 + (R() * 5 | 0), posun = kolem(R, 1, 0.12);   // každý šeptající má jinou „hlavu"
      for (let i = 0; i < slabik; i++) {
        const delka = 0.1 + R() * 0.16;
        const env = obalkaDrz(a, tt, 0.35 + R() * 0.25, 0.035, delka * 0.5, delka * 0.5);
        if (R() < 0.3) {
          sumZdroj(a, tt, delka, env, 'bandpass', 3600 + R() * 1200, 1.4);      // sykavka „s", „š"
        } else {
          const [f1, f2] = SAMOHLASKY[R() * SAMOHLASKY.length | 0];
          sumZdroj(a, tt, delka, env, 'bandpass', f1 * posun * (0.9 + R() * 0.2), 6);
          const g2 = a.createGain(); g2.gain.value = 0.7; g2.connect(env);
          sumZdroj(a, tt, delka, g2, 'bandpass', f2 * posun * (0.9 + R() * 0.2), 8);
        }
        env.connect(out);
        tt += delka + (R() < 0.25 ? 0.18 + R() * 0.25 : 0.02 + R() * 0.05);
      }
    },
    // vzdálené prasknutí: lupnutí kamene nebo kosti s tupým tělem, ztlumené dálkou
    prasknuti(a, b, t, R) {
      const out = vystup(a, b, { pan: (R() - 0.5) * 1.6, dozvuk: 0.8, hlas: 1.6, dalka: 3000 });
      const n = 2 + (R() * 4 | 0);
      let tt = t;
      for (let i = 0; i < n; i++) {
        cvak(a, tt, 1200 + R() * 1400, i === 0 ? 0.8 : 0.25 + R() * 0.3, 0.02 + R() * 0.02, out);
        if (i === 0) dunivy(a, tt, kolem(R, 220, 0.2), 90, 0.06, 0.3, out);
        tt += 0.02 + R() * 0.09;
      }
    },
    // pád a bouchnutí: těžký dopad, pak se sype kamení
    bouchnuti(a, b, t, R) {
      const out = vystup(a, b, { pan: (R() - 0.5) * 1.6, dozvuk: 0.8, hlas: 0.9, dalka: 1400 });
      dunivy(a, t, kolem(R, 70, 0.15), 30, 0.5, 0.9, out);
      sumVrstva(a, t, out, 'lowpass', 260, 0.8, 0.6, 0.006, 0.45);
      drt(a, t + 0.2, 6 + (R() * 7 | 0), 1.1, 1200, 3000, 0.13, out, R);
      sumVrstva(a, t + 0.25, out, 'bandpass', 1500, 0.7, 0.05, 0.2, 0.7);     // prach a písek
    },

    // --- souboj -------------------------------------------------
    // máchnutí zbraní: šum v pásmu, které stoupne a zase klesne (průlet kolem ucha)
    mach(a, b, t, R) {
      const out = vystup(a, b, { dozvuk: 0.15, hlas: 0.9, pan: (R() - 0.5) * 0.4 });
      const d = kolem(R, 0.2, 0.15), f0 = kolem(R, 450, 0.2), vrch = kolem(R, 1700, 0.2);
      const g = obalka(a, t, 0.7, d * 0.55, d * 0.6);
      const f = sumZdroj(a, t, d * 1.2, g, 'bandpass', f0, 1.8);
      f.frequency.setValueAtTime(f0, t);
      f.frequency.exponentialRampToValueAtTime(vrch, t + d * 0.55);
      f.frequency.exponentialRampToValueAtTime(f0 * 1.3, t + d * 1.15);
      g.connect(out);
      sumVrstva(a, t, out, 'lowpass', 380, 0.7, 0.25, d * 0.5, d * 0.5);   // tlak vzduchu
    },
    // zásah: máchnutí + masitý úder (dunění, mlasknutí, krátké křupnutí)
    zasah(a, b, t, R, o) {
      ZVUKY.mach(a, b, t, R);
      const out = vystup(a, b, { pan: (o && o.pan) || 0, dozvuk: 0.25 });
      const tt = t + 0.08;
      dunivy(a, tt, kolem(R, 140, 0.15), 55, 0.14, 0.7, out);
      sumVrstva(a, tt, out, 'lowpass', kolem(R, 800, 0.2), 0.9, 0.5, 0.002, 0.09);
      sumVrstva(a, tt + 0.006, out, 'bandpass', kolem(R, 650, 0.2), 3, 0.35, 0.004, 0.07, 380);   // mlasknutí
      cvak(a, tt + 0.004, 1500 + R() * 500, 0.16, 0.025, out);
      // účinnost zásahu je slyšet: slabina = jasné zazvonění navíc, odolnost = tupé zadunění, imunita = kovové cinknutí
      const u = o && o.ucinnost;
      if (u > 1) { cvak(a, tt + 0.03, 2600 + R() * 300, 0.2, 0.06, out); cvak(a, tt + 0.09, 3400 + R() * 300, 0.14, 0.07, out); }
      else if (u === 0) cvak(a, tt + 0.02, 900 + R() * 100, 0.22, 0.12, out);
      else if (u < 1) dunivy(a, tt + 0.02, kolem(R, 70, 0.1), 40, 0.2, 0.6, out);
    },
    // hráč dostal ránu: úder a zachrčení „uh"
    zranen(a, b, t, R) {
      const out = vystup(a, b, { dozvuk: 0.2 });
      dopad(a, t, out, R, 1.2, 520);
      const f0 = kolem(R, 135, 0.1);
      hlasStvury(a, t + 0.03, { f: [f0, f0 * 1.08, f0 * 0.7], delka: kolem(R, 0.24, 0.15), formanty: [[520, 5, 1.6], [1000, 6, 1], [2500, 8, 0.3]],
        dech: 0.35, chrapot: [kolem(R, 34, 0.2), 0.4], hlas: 0.5, nabeh: 0.02 }, out);
    },
    // potvora padla: zachroptění, pád těla, rozsypaná výstroj
    smrtPotvory(a, b, t, R, o) {
      const out = vystup(a, b, { pan: (o && o.pan) || 0, dozvuk: 0.4 });
      const f0 = kolem(R, 160, 0.25);
      hlasStvury(a, t, { f: [f0, f0 * 1.1, f0 * 0.55], delka: kolem(R, 0.4, 0.15), formanty: [[600, 4, 1.4], [1100, 5, 0.8], [2300, 7, 0.25]],
        dech: 0.5, chrapot: [kolem(R, 28, 0.2), 0.6], hlas: 0.32, nabeh: 0.03 }, out);
      dopad(a, t + 0.22 + R() * 0.06, out, R, 1.4, 360);
      drt(a, t + 0.25, 4, 0.3, 1300, 2800, 0.09, out, R);
    },
    // nová úroveň: vzestupné arpeggio zvonků a jemný třpyt
    uroven(a, b, t, R) {
      const out = vystup(a, b, { dozvuk: 0.5, hlas: 0.55 });
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => zvonek(a, t + i * 0.09, f, 0.26, 0.9, out));
      sumVrstva(a, t + 0.3, out, 'bandpass', 3500, 1.5, 0.04, 0.2, 0.6);
    },
    // smrt hráče: dva údery umíráčku (zvonové alikvoty) a temný tón
    smrt(a, b, t) {
      const out = vystup(a, b, { dozvuk: 0.6, hlas: 0.65 });
      for (const [dt, sila] of [[0, 1], [1.3, 0.7]]) {
        for (const [n, h, d] of [[0.5, 0.35, 2.8], [1, 0.4, 2.2], [1.19, 0.18, 1.6], [1.5, 0.12, 1.3], [2, 0.14, 1.1], [2.98, 0.06, 0.7]]) {
          ton(a, t + dt, 110 * n * (1 + (n === 1 ? 0 : 0.003)), h * sila, 0.004, d, out);
        }
        dunivy(a, t + dt, 90, 60, 0.12, 0.3 * sila, out);
      }
      ton(a, t, 55, 0.18, 0.6, 2.4, out, 'triangle', 49, 300);
    },

    // --- předměty -----------------------------------------------
    // truhla: vrznutí dřevěného víka, žuchnutí a cvaknutí kování
    truhla(a, b, t, R, o) {
      const out = vystup(a, b, { pan: (o && o.pan) || 0, dozvuk: 0.3 });
      const d = kolem(R, 0.38, 0.12);
      const s = a.createOscillator(); s.type = 'sawtooth';
      s.frequency.setValueAtTime(kolem(R, 190, 0.1), t); s.frequency.linearRampToValueAtTime(260 + R() * 60, t + d);
      const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = kolem(R, 900, 0.1); bp.Q.value = 4;
      const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
      const e = a.createGain(); e.gain.setValueAtTime(0, t);
      for (let tt = t; tt < t + d; tt += 0.02 + R() * 0.02) { e.gain.setValueAtTime(0.15 + R() * 0.3, tt); e.gain.setTargetAtTime(0.02, tt + 0.004, 0.007); }
      e.gain.setValueAtTime(0, t + d + 0.02);
      s.connect(bp); bp.connect(lp); lp.connect(e); e.connect(out); s.start(t); s.stop(t + d + 0.05);
      drevo(a, t + d + 0.04, kolem(R, 190, 0.1), 0.35, 0.14, out, R);
      dopad(a, t + d + 0.04, out, R, 0.9, 380);
      kov(a, t + d + 0.05, kolem(R, 1600, 0.08), 0.06, 0.2, out, R);
    },
    // zlato: cinkání mincí, které se sesypou do měšce
    zlato(a, b, t, R) {
      const out = vystup(a, b, { dozvuk: 0.3, hlas: 0.7 });
      const n = 5 + (R() * 3 | 0);
      for (let i = 0; i < n; i++) {
        const tt = t + i * 0.045 + R() * 0.035;
        kov(a, tt, 1700 + R() * 1300, 0.28 * (1 - i / (n + 2)), 0.22, out, R);
      }
      sumVrstva(a, t + 0.02, out, 'bandpass', 1400, 1, 0.08, 0.03, 0.2);   // šustnutí měšce
    },
    // šustnutí při braní a ukládání věcí: dvě zrnka látky/kůže
    sebrat(a, b, t, R) {
      const out = vystup(a, b, { dozvuk: 0.1, hlas: 0.8 });
      sumVrstva(a, t, out, 'bandpass', kolem(R, 1600, 0.25), 0.9, 0.3, 0.025, 0.1);
      sumVrstva(a, t + 0.07 + R() * 0.04, out, 'bandpass', kolem(R, 1100, 0.25), 0.9, 0.2, 0.02, 0.09);
    },
    // nasazení: šustnutí kůže, cvaknutí přezky a cinknutí kovu
    nasadit(a, b, t, R) {
      const out = vystup(a, b, { dozvuk: 0.25, hlas: 0.8 });
      sumVrstva(a, t, out, 'bandpass', kolem(R, 1300, 0.2), 1, 0.25, 0.03, 0.12);
      cvak(a, t + 0.12, kolem(R, 2400, 0.15), 0.3, 0.015, out);
      kov(a, t + 0.13, kolem(R, 900, 0.06), 0.18, 0.4, out, R);
    },
    // přehození zbraní: švihnutí, pak drnknutí tětivy (luk) nebo zazvonění čepele
    prehozeni(a, b, t, R, o) {
      const out = vystup(a, b, { dozvuk: 0.2, hlas: 0.7 });
      sumVrstva(a, t, out, 'bandpass', 600, 1.8, 0.4, 0.06, 0.1, 1800);
      const t2 = t + 0.13;
      if (o && o.luk) ZVUKY_POM.tetiva(a, t2, kolem(R, 160, 0.08), 0.4, out);
      else { cvak(a, t2, 3200, 0.2, 0.012, out); kov(a, t2, kolem(R, 1450, 0.06), 0.22, 0.7, out, R); }
    },
    // kování: dva zvonivé údery kladiva o kovadlinu
    kovani(a, b, t, R) {
      const out = vystup(a, b, { dozvuk: 0.35, hlas: 0.75 });
      for (const [dt, sila] of [[0, 1], [kolem(R, 0.24, 0.1), 0.7]]) {
        kov(a, t + dt, kolem(R, 1180, 0.03), 0.45 * sila, 0.9, out, R);
        dunivy(a, t + dt, 180, 90, 0.05, 0.25 * sila, out);
      }
    },
    // šaman léčí spojence: stoupající třpyt s měkkým náběhem
    leceniPotvory(a, b, t, R) {
      const out = vystup(a, b, { dozvuk: 0.4, hlas: 0.55 });
      [660, 880, 1170, 1560].forEach((f, i) => zvonek(a, t + i * 0.06, f * kolem(R, 1, 0.01), 0.16, 0.45, out, 0.02));
    },
    // splněný úkol: krátká fanfára měkkého žesťového tónu (pila, filtr se při náběhu otevře)
    ukol(a, b, t, R) {
      const out = vystup(a, b, { dozvuk: 0.35, hlas: 0.6 });
      [[523, 0], [659, 0.1], [784, 0.2], [1047, 0.32], [784, 0.5]].forEach(([f, dt]) => ZVUKY_POM.zest(a, t + dt, f, 0.16, dt >= 0.5 ? 0.55 : 0.16, out));
    },
    // jídlo: tři křupnutí a žvýkání
    jist(a, b, t, R) {
      const out = vystup(a, b, { dozvuk: 0.1 });
      for (let i = 0; i < 3; i++) {
        const tt = t + i * kolem(R, 0.22, 0.1);
        drt(a, tt, 5, 0.05, 1100, 2400, 0.3, out, R, 0.012);
        sumVrstva(a, tt, out, 'lowpass', 500, 1, 0.2, 0.005, 0.07);
        dunivy(a, tt, 180, 110, 0.06, 0.18, out);
      }
    },
    // pití: polknutí (klouzavé „glok") a bublinky
    pit(a, b, t, R) {
      const out = vystup(a, b, { dozvuk: 0.15 });
      for (let i = 0; i < 4; i++) {
        const tt = t + i * kolem(R, 0.13, 0.15);
        ton(a, tt, 240 + R() * 80, 0.3, 0.008, 0.07, out, 'sine', 520 + R() * 160);
        sumVrstva(a, tt, out, 'lowpass', 420, 1.5, 0.15, 0.01, 0.06);
      }
    },
    // účinek dobrého lektvaru: třpytivé zvonky a vzdušný šum
    kouzlo(a, b, t, R) {
      const out = vystup(a, b, { dozvuk: 0.55, hlas: 0.6 });
      [1318.5, 1760, 2093, 2637].forEach((f, i) => zvonek(a, t + i * kolem(R, 0.06, 0.2), f, 0.14, 0.6, out, 0.01));
      sumVrstva(a, t, out, 'bandpass', 3000, 1.2, 0.05, 0.15, 0.4);
    },
    // luk: brnknutí tětivy a svist šípu
    luk(a, b, t, R) {
      const out = vystup(a, b, { dozvuk: 0.25 });
      ZVUKY_POM.tetiva(a, t, kolem(R, 140, 0.08), 0.5, out);
      sumVrstva(a, t + 0.02, out, 'bandpass', kolem(R, 2600, 0.15), 2.5, 0.25, 0.02, 0.2, 900);
    },
    // kručení v břiše: tlumené bublavé vrčení
    hlad(a, b, t, R) {
      const out = vystup(a, b, { dozvuk: 0.1, hlas: 0.6 });
      const s = a.createOscillator(); s.type = 'sawtooth';
      const krivka = new Float32Array(24);
      for (let i = 0; i < krivka.length; i++) krivka[i] = 65 + Math.sin(i * 0.9) * 20 + R() * 15;
      s.frequency.setValueCurveAtTime(krivka, t, 0.9);
      const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300; lp.Q.value = 3;
      const e = obalkaDrz(a, t, 0.35, 0.15, 0.5, 0.25);
      s.connect(lp); lp.connect(e); e.connect(out); s.start(t); s.stop(t + 0.95);
      for (let i = 0; i < 3; i++) ton(a, t + 0.2 + R() * 0.6, 160 + R() * 80, 0.12, 0.01, 0.06, out, 'sine', 320 + R() * 100);
    },

    // --- tajemství a pasti ----------------------------------------
    // tajné dveře: skřípění kamene o kámen (zrnité tření) a dosednutí
    tajne(a, b, t, R, o) {
      const out = vystup(a, b, { pan: (o && o.pan) || 0, dozvuk: 0.45 });
      const e = obalkaDrz(a, t, 0.55, 0.1, 0.8, 0.3);
      const zrno = a.createGain(); zrno.gain.setValueAtTime(0.5, t);
      for (let tt = t; tt < t + 1.15; tt += 0.03 + R() * 0.05) zrno.gain.setValueAtTime(0.35 + R() * 0.65, tt);
      const f = sumZdroj(a, t, 1.25, zrno, 'bandpass', 240, 1.4);
      f.frequency.setValueAtTime(kolem(R, 220, 0.1), t); f.frequency.linearRampToValueAtTime(kolem(R, 420, 0.1), t + 1.1);
      zrno.connect(e); e.connect(out);
      sumVrstva(a, t, out, 'lowpass', 90, 1, 0.4, 0.2, 0.9);
      drt(a, t, 10, 1.1, 900, 2000, 0.13, out, R);
      dopad(a, t + 1.15, out, R, 1.5, 300);
    },
    // cvaknutí mechanismu, když si pasti všimneš
    pastOdhalena(a, b, t, R, o) {
      const out = vystup(a, b, { pan: (o && o.pan) || 0, dozvuk: 0.2 });
      cvak(a, t, kolem(R, 2400, 0.1), 0.45, 0.018, out);
      cvak(a, t + 0.09, kolem(R, 1700, 0.1), 0.35, 0.02, out);
      kov(a, t + 0.09, kolem(R, 1900, 0.05), 0.06, 0.25, out, R);
    },
    // propadnutí jámou: svist, tvrdý dopad, sypání
    jama(a, b, t, R) {
      const out = vystup(a, b, { dozvuk: 0.5 });
      sumVrstva(a, t, out, 'bandpass', 1500, 1, 0.45, 0.05, 0.6, 250);
      dopad(a, t + 0.65, out, R, 2, 300);
      dunivy(a, t + 0.65, 70, 30, 0.35, 0.6, out);
      drt(a, t + 0.7, 7, 0.6, 1200, 2800, 0.12, out, R);
    },
    // šipka ze zdi: cvak, svist a zabodnutí
    sipka(a, b, t, R) {
      const out = vystup(a, b, { pan: (R() - 0.5) * 1.4, dozvuk: 0.2 });
      cvak(a, t, 2200, 0.35, 0.015, out);
      sumVrstva(a, t + 0.02, out, 'bandpass', kolem(R, 3600, 0.1), 3, 0.4, 0.01, 0.13, 1500);
      drevo(a, t + 0.16, kolem(R, 420, 0.1), 0.18, 0.07, out, R);
    },
    // gong poplachu: úder paličky, kovové nesouzvučné parciály, dlouhé doznění
    gong(a, b, t, R) {
      const out = vystup(a, b, { dozvuk: 0.7, hlas: 0.65 });
      dunivy(a, t, 120, 70, 0.08, 0.4, out);
      for (const [f, h, d] of [[98, 0.5, 3.5], [99.3, 0.25, 3], [209, 0.25, 2.5], [311, 0.2, 2], [466, 0.12, 1.5], [739, 0.06, 1], [1123, 0.03, 0.7]]) {
        const s = a.createOscillator(); s.type = 'sine'; s.frequency.setValueAtTime(f * 1.02, t); s.frequency.exponentialRampToValueAtTime(f, t + 0.3);
        const e = obalka(a, t, h, 0.012, d);
        s.connect(e); e.connect(out); s.start(t); s.stop(t + d + 0.1);
      }
    },
    // padající kámen: klepání o stěnu a těžký dopad
    kamen(a, b, t, R) {
      const out = vystup(a, b, { dozvuk: 0.4 });
      drt(a, t, 5, 0.2, 700, 1600, 0.25, out, R, 0.03);
      dopad(a, t + 0.25, out, R, 1.6, 480);
      drt(a, t + 0.28, 5, 0.4, 1200, 2600, 0.08, out, R);
    },
    // požehnání: durový akord jako vzdálený chór („á" přes formanty, lehké vibrato)
    oltarDobre(a, b, t, R) {
      const out = vystup(a, b, { dozvuk: 0.75, hlas: 0.7 });
      for (const f of [261.6, 329.6, 392, 523.3]) {
        hlasStvury(a, t + R() * 0.1, { f: [f, f], delka: 2.1, formanty: [[750, 5, 1.6], [1150, 6, 1], [2600, 8, 0.25]], dech: 0.15,
          vibrato: [kolem(R, 5, 0.15), 0.006], hlas: 0.11, nabeh: 0.4 }, out);
      }
    },
    // kletba: disonantní klesající tóny s chvěním a temné hučení
    oltarZly(a, b, t, R) {
      const out = vystup(a, b, { dozvuk: 0.7, hlas: 0.8 });
      for (const [f0, f1] of [[220, 110], [233, 104], [311, 150]]) {
        hlasStvury(a, t, { f: [f0, f1], delka: 1.5, formanty: [[400, 4, 1.4], [800, 5, 1], [1800, 6, 0.3]], chrapot: [kolem(R, 7, 0.2), 0.6], hlas: 0.16, nabeh: 0.1 }, out);
      }
      sumVrstva(a, t, out, 'lowpass', 110, 1, 0.5, 0.3, 1.2);
    },
    // klíč v zámku: zasunutí, cvaky stavítek, otočení západky
    odemceni(a, b, t, R) {
      const out = vystup(a, b, { dozvuk: 0.25 });
      sumVrstva(a, t, out, 'bandpass', 2200, 2, 0.12, 0.02, 0.06);
      cvak(a, t + 0.12, kolem(R, 2400, 0.1), 0.3, 0.018, out);
      cvak(a, t + 0.22, kolem(R, 2100, 0.1), 0.25, 0.018, out);
      cvak(a, t + 0.36, 1500, 0.45, 0.03, out);
      kov(a, t + 0.36, kolem(R, 1300, 0.05), 0.1, 0.3, out, R);
      dunivy(a, t + 0.36, 180, 90, 0.1, 0.35, out);
    },
    // otočení stránky: šustnutí papíru
    stranka(a, b, t, R) {
      const out = vystup(a, b, { dozvuk: 0.1, hlas: 0.8 });
      for (let i = 0; i < 2; i++) {
        const tt = t + i * kolem(R, 0.22, 0.1);
        sumVrstva(a, tt, out, 'bandpass', kolem(R, 1600, 0.2), 0.9, 0.3, 0.04, 0.16, 3200);
        sumVrstva(a, tt + 0.12, out, 'lowpass', 900, 0.8, 0.12, 0.01, 0.08);
      }
    },

    // --- kouzla a bossové -----------------------------------------
    // ohnivá koule: zahučení letu, praskání a výbuch
    ohnivaKoule(a, b, t, R) {
      const out = vystup(a, b, { dozvuk: 0.4 });
      sumVrstva(a, t, out, 'bandpass', 350, 1.2, 0.5, 0.08, 0.35, 1400);
      praskani(a, t, 0.4, 1.5, 0.15, out, R);
      const tt = t + 0.4;
      dunivy(a, tt, kolem(R, 90, 0.1), 30, 0.5, 0.6, out);
      sumVrstva(a, tt, out, 'lowpass', 800, 0.7, 0.45, 0.005, 0.5, 200);
      praskani(a, tt + 0.05, 0.5, 1, 0.12, out, R);
    },
    // blesk: elektrické praskání, zasyčení výboje a hrom
    blesk(a, b, t, R) {
      const out = vystup(a, b, { dozvuk: 0.5 });
      for (let i = 0; i < 16; i++) cvak(a, t + R() * 0.25, 1800 + R() * 3200, 0.25, 0.008, out);
      sumVrstva(a, t, out, 'bandpass', 2800, 0.7, 0.35, 0.002, 0.25);
      const hrom = a.createGain(); hrom.gain.setValueAtTime(0.0001, t + 0.05);
      hrom.gain.exponentialRampToValueAtTime(0.7, t + 0.12);
      for (let tt = t + 0.15; tt < t + 1.1; tt += 0.06 + R() * 0.1) hrom.gain.setTargetAtTime(0.15 + R() * 0.5 * (1.2 - (tt - t)), tt, 0.03);
      hrom.gain.setTargetAtTime(0.0001, t + 1.1, 0.15);
      sumZdroj(a, t + 0.05, 1.8, hrom, 'lowpass', 220, 0.8);
      hrom.connect(out);
    },
    // léčivé kouzlo: měkký durový akord s třpytem
    leceniKouzlo(a, b, t, R) {
      const out = vystup(a, b, { dozvuk: 0.6, hlas: 0.7 });
      [523.3, 659.3, 784, 1046.5].forEach((f, i) => {
        ton(a, t + i * 0.03, f, 0.11, 0.15, 0.9, out);
        ton(a, t + i * 0.03, f * 1.003, 0.05, 0.2, 0.8, out);
      });
      for (let i = 0; i < 5; i++) zvonek(a, t + 0.1 + i * 0.09 + R() * 0.03, [1568, 1760, 2093, 2349, 2637][i], 0.05, 0.3, out);
    },
    // teleport: dvě rozladěné vlny klouzající vzhůru a vír šumu
    teleport(a, b, t, R) {
      const out = vystup(a, b, { dozvuk: 0.6 });
      for (const r of [1, 1.012]) ton(a, t, 220 * r, 0.16, 0.12, 0.45, out, 'triangle', 1500 * r, 2500);
      sumVrstva(a, t, out, 'bandpass', 600, 2, 0.35, 0.25, 0.35, 3500);
      zvonek(a, t + 0.45, 1760, 0.08, 0.5, out);
    },
    // kouzlo potvory: klesající tajemný tón s vírem
    kouzloPotvory(a, b, t, R, o) {
      const out = vystup(a, b, { pan: (o && o.pan) || 0, dozvuk: 0.4, hlas: Math.max(0.4, (o && o.hlas) || 1) });
      const f = kolem(R, 900, 0.12);
      ton(a, t, f, 0.18, 0.02, 0.3, out, 'triangle', f / 5, 1800);
      ton(a, t, f * 1.5, 0.06, 0.02, 0.25, out, 'sine', f / 3);
      sumVrstva(a, t, out, 'bandpass', 2000, 2, 0.2, 0.05, 0.3, 500);
    },
    // přivolání: temné stoupající hučení a šum otevírající se brány
    privolani(a, b, t, R, o) {
      const out = vystup(a, b, { pan: (o && o.pan) || 0, dozvuk: 0.7 });
      for (const [f0, f1] of [[110, 330], [116, 348]]) ton(a, t, f0, 0.18, 0.25, 0.7, out, 'triangle', f1, 1200);
      sumVrstva(a, t, out, 'bandpass', 300, 1.5, 0.3, 0.4, 0.5, 1200);
    },
    // řev bosse: hluboký chraplavý hlas s dechem a dunění
    bossRev(a, b, t, R, o) {
      const out = vystup(a, b, { pan: (o && o.pan) || 0, dozvuk: 0.6 });
      const f0 = kolem(R, 85, 0.15);
      hlasStvury(a, t, { f: [f0, f0 * 1.45, f0 * 1.3, f0 * 0.7], delka: kolem(R, 1.3, 0.1), formanty: [[380, 3, 2], [750, 4, 1.4], [1600, 5, 0.5], [2500, 6, 0.15]],
        dech: 0.45, chrapot: [kolem(R, 26, 0.2), 0.75], vibrato: [5, 0.02], hlas: 0.75, nabeh: 0.12 }, out);
      sumVrstva(a, t, out, 'lowpass', 160, 1, 0.45, 0.2, 1.1);
    },
    // boss padl: vítězná fanfára (žesť + zvonky)
    bossPadl(a, b, t) {
      const out = vystup(a, b, { dozvuk: 0.6, hlas: 0.8 });
      [[392, 0], [523.3, 0.18], [659.3, 0.36], [784, 0.54], [1046.5, 0.72]].forEach(([f, d]) => {
        ZVUKY_POM.zest(a, t + d, f, 0.17, d === 0.72 ? 1.4 : 0.35, out);
        zvonek(a, t + d, f * 2, 0.06, d === 0.72 ? 1.2 : 0.4, out);
      });
    },
    // magická bariéra: elektrické bzučení s chvěním a jiskření
    bariera(a, b, t, R) {
      const out = vystup(a, b, { dozvuk: 0.4, hlas: 0.8 });
      hlasStvury(a, t, { f: [58, 62], delka: 0.55, formanty: [[180, 2, 1.5], [420, 3, 1]], chrapot: [kolem(R, 12, 0.2), 0.7], hlas: 0.35, nabeh: 0.03, typ: 'sawtooth' }, out);
      for (let i = 0; i < 5; i++) cvak(a, t + i * 0.08 + R() * 0.03, 2500 + R() * 1500, 0.08, 0.008, out);
    },

    // --- zvuky prostředí (na pozadí) ---------------------------------
    // kapka: „plink" – sinus rychle vyklouzne nahoru + drobné šplouchnutí
    kapka(a, b, t, R) {
      const out = vystup(a, b, { pan: (R() - 0.5) * 1.6, dozvuk: 0.8, hlas: 0.7, dalka: 4500 });
      const f = 700 + R() * 700;
      ton(a, t, f, 0.32, 0.002, 0.07, out, 'sine', f * (1.9 + R() * 0.6));
      sumVrstva(a, t, out, 'bandpass', 1800, 2, 0.05, 0.001, 0.02);
      if (R() < 0.4) ton(a, t + 0.18 + R() * 0.1, f * 1.3, 0.12, 0.002, 0.05, out, 'sine', f * 2.4);   // druhá kapka
    },
    // vzdálený krumpáč: kov o kámen v pravidelném rytmu
    krumpac(a, b, t, R) {
      const out = vystup(a, b, { pan: (R() - 0.5) * 1.6, dozvuk: 0.85, hlas: 0.6, dalka: 3000 });
      const krok = 0.55 + R() * 0.1;
      for (let i = 0; i < 3 + (R() * 3 | 0); i++) {
        const tt = t + i * krok + R() * 0.04;
        kov(a, tt, 1500 + R() * 200, 0.35, 0.18, out, R);
        drt(a, tt + 0.01, 3, 0.12, 900, 1800, 0.12, out, R);
      }
    },
    // vzdálený zvon: zvonové alikvoty (hum, prima, tercie, kvinta, nominál)
    zvon(a, b, t, R) {
      const out = vystup(a, b, { pan: (R() - 0.5), dozvuk: 0.9, hlas: 0.45, dalka: 2500 });
      const f = kolem(R, 196, 0.04);
      for (const [n, h, d] of [[0.5, 0.25, 3.2], [1, 0.4, 3], [1.19, 0.15, 2], [1.5, 0.1, 1.6], [2, 0.12, 1.4], [2.98, 0.05, 0.9]]) ton(a, t, f * n, h, 0.005, d, out);
    },
    // bublání lávy: líné bubliny a jejich prasknutí
    bublani(a, b, t, R) {
      const out = vystup(a, b, { pan: (R() - 0.5) * 1.4, dozvuk: 0.5, hlas: 0.6, dalka: 1500 });
      for (let i = 0; i < 4; i++) {
        const tt = t + i * 0.18 + R() * 0.1;
        ton(a, tt, 70 + R() * 40, 0.4, 0.01, 0.1, out, 'sine', 180 + R() * 80);
        sumVrstva(a, tt + 0.08, out, 'lowpass', 600, 1, 0.15, 0.003, 0.05);
      }
    },
    // dunění: vzdálené otřesy hory
    duneni(a, b, t, R) {
      const out = vystup(a, b, { dozvuk: 0.7, hlas: 1.8, dalka: 400 });
      const e = a.createGain();
      e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(1.1, t + 0.8);
      e.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
      sumZdroj(a, t, 2.7, e, 'lowpass', 120, 1);
      e.connect(out);
      ton(a, t, kolem(R, 42, 0.1), 0.12, 0.7, 1.8, out, 'sine', 35);
    },
    // podivno: dva rozladěné táhlé tóny s chvěním jako sklo, které zpívá
    podivno(a, b, t, R) {
      const out = vystup(a, b, { pan: (R() - 0.5) * 1.8, dozvuk: 0.9, hlas: 0.7 });
      const f = 300 + R() * 500, cil = f * (R() < 0.5 ? 0.66 : 1.5);
      for (const r of [1, 1.006]) {
        const s = a.createOscillator(); s.type = 'sine';
        s.frequency.setValueAtTime(f * r, t); s.frequency.linearRampToValueAtTime(cil * r, t + 1.8);
        const lfo = a.createOscillator(); lfo.frequency.value = 4 + R() * 3;
        const lg = a.createGain(); lg.gain.value = f * 0.03; lfo.connect(lg); lg.connect(s.frequency);
        const e = obalka(a, t, 0.13, 0.5, 1.4);
        s.connect(e); e.connect(out); s.start(t); s.stop(t + 2); lfo.start(t); lfo.stop(t + 2);
      }
    },

    // --- světlo a mechanismy ----------------------------------------
    // zapálení: škrtnutí, vzplanutí a praskání
    zapaleni(a, b, t, R) {
      const out = vystup(a, b, { dozvuk: 0.2 });
      sumVrstva(a, t, out, 'bandpass', 2200, 1.5, 0.18, 0.005, 0.06);
      sumVrstva(a, t + 0.05, out, 'bandpass', 400, 0.8, 0.45, 0.06, 0.3, 1300);
      praskani(a, t + 0.1, 0.5, 1, 0.13, out, R);
    },
    // zhasnutí: syknutí a obláček kouře
    zhasnuti(a, b, t, R) {
      const out = vystup(a, b, { dozvuk: 0.3 });
      sumVrstva(a, t, out, 'bandpass', kolem(R, 2400, 0.1), 1.3, 0.3, 0.03, 0.6, 1500);
      sumVrstva(a, t, out, 'lowpass', 300, 0.8, 0.25, 0.04, 0.3);
    },
    // páka: zaklapnutí, řinčení řetězu, dosednutí mechanismu
    paka(a, b, t, R) {
      const out = vystup(a, b, { dozvuk: 0.6 });
      cvak(a, t, 1500, 0.45, 0.035, out);
      dopad(a, t + 0.03, out, R, 0.9, 500);
      for (let i = 0; i < 12; i++) kov(a, t + 0.3 + i * 0.075 + R() * 0.02, 1300 + R() * 900, 0.07, 0.1, out, R);   // řetěz
      dopad(a, t + 1.4, out, R, 1.6, 300);
    },

    // --- nové zvuky (20. 11. 2026) -----------------------------------
    // rána do dřevěné bedny / sudu: dutý dřevěný úder
    ranaDrevo(a, b, t, R, o) {
      const out = vProstoru(a, b, o, R, 0.3);
      drevo(a, t, kolem(R, 210, 0.15), 0.45, 0.16, out, R);
      dopad(a, t, out, R, 0.8, 600);
    },
    // rána do kamene: tvrdé ťuknutí, tupé tělo, trocha drti
    ranaKamen(a, b, t, R, o) {
      const out = vProstoru(a, b, o, R, 0.35);
      dopad(a, t, out, R, 1.2, 700);
      cvak(a, t, kolem(R, 1800, 0.15), 0.45, 0.02, out);
      drt(a, t + 0.03, 4, 0.2, 1400, 3000, 0.1, out, R);
    },
    // bedna se rozpadne: praskot prken, třísky, padající desky
    rozbitiDrevo(a, b, t, R, o) {
      const out = vProstoru(a, b, o, R, 0.35);
      for (let i = 0; i < 3; i++) {
        const tt = t + i * (0.02 + R() * 0.03);
        drevo(a, tt, kolem(R, 320, 0.25), 0.4, 0.07, out, R);
        cvak(a, tt, 1600 + R() * 1200, 0.35, 0.012, out);
      }
      dopad(a, t, out, R, 1, 500);
      drt(a, t + 0.03, 14, 0.35, 1500, 3800, 0.18, out, R, 0.01);                // třísky
      for (let i = 0; i < 3; i++) drevo(a, t + 0.18 + i * 0.1 + R() * 0.12, kolem(R, 260, 0.3), 0.22 - i * 0.05, 0.1, out, R);   // dopadající prkna
    },
    // kámen se rozsype: lupnutí, dunivý pád a dlouhé sypání suti
    rozbitiKamen(a, b, t, R, o) {
      const out = vProstoru(a, b, o, R, 0.45);
      cvak(a, t, kolem(R, 1500, 0.15), 0.6, 0.025, out);
      dopad(a, t + 0.01, out, R, 1.8, 400);
      dunivy(a, t + 0.05, 70, 32, 0.4, 0.4, out);
      drt(a, t + 0.05, 22, 0.9, 900, 2800, 0.2, out, R, 0.02);
      sumVrstva(a, t + 0.05, out, 'bandpass', 1100, 0.6, 0.12, 0.08, 0.8);      // písek
    },
    // amfora se roztříští: jasné křupnutí a cinkavé střepy
    rozbitiHlina(a, b, t, R, o) {
      const out = vProstoru(a, b, o, R, 0.35);
      cvak(a, t, kolem(R, 2200, 0.1), 0.6, 0.02, out);
      dopad(a, t, out, R, 0.7, 900);
      for (let i = 0; i < 9; i++) {
        const x = Math.pow(R(), 1.5), tt = t + 0.01 + x * 0.5;
        ton(a, tt, 1800 + R() * 2600, 0.09 * (1 - 0.7 * x), 0.001, 0.03 + R() * 0.05, out);   // keramika krátce zazvoní
        cvak(a, tt, 2000 + R() * 2000, 0.12 * (1 - 0.7 * x), 0.008, out);
      }
    },
    // skok přes jámu: odraz (šoupnutí a výdech), svist, dopad
    skok(a, b, t, R) {
      const out = vystup(a, b, { dozvuk: 0.25, hlas: 0.8 });
      dopad(a, t, out, R, 0.6, 500);
      sumVrstva(a, t + 0.01, out, 'bandpass', kolem(R, 1800, 0.2), 1.2, 0.12, 0.005, 0.06);
      sumVrstva(a, t + 0.02, out, 'bandpass', kolem(R, 900, 0.15), 3, 0.18, 0.02, 0.12);   // „hup"
      sumVrstva(a, t + 0.08, out, 'bandpass', 500, 1.5, 0.25, 0.15, 0.15, 1300);
      const td = t + kolem(R, 0.42, 0.08);
      dopad(a, td, out, R, 1.3, 460);
      sumVrstva(a, td + 0.02, out, 'bandpass', kolem(R, 2000, 0.2), 1.1, 0.12, 0.005, 0.06);
    },
    // uloženo: dva měkké zvonky nahoru (kvarta)
    ulozeno(a, b, t) {
      const out = vystup(a, b, { dozvuk: 0.35, hlas: 0.6 });
      zvonek(a, t, 784, 0.22, 0.5, out, 0.006);
      zvonek(a, t + 0.11, 1046.5, 0.22, 0.8, out, 0.006);
    },
    // načteno: krátký vzestupný rozklad (kvinta, oktáva)
    nacteno(a, b, t) {
      const out = vystup(a, b, { dozvuk: 0.4, hlas: 0.6 });
      [523.3, 784, 1046.5].forEach((f, i) => zvonek(a, t + i * 0.08, f, 0.2, 0.7, out, 0.006));
    },
    // nález: jemné cinknutí s vyšší kvintou
    nalez(a, b, t, R) {
      const out = vystup(a, b, { dozvuk: 0.35, hlas: 0.6 });
      const f = kolem(R, 1568, 0.03);
      zvonek(a, t, f, 0.2, 0.5, out);
      zvonek(a, t + 0.06, f * 1.5, 0.12, 0.6, out);
    },
    // jiskra: syknutí, letící praskání a lupnutí
    jiskra(a, b, t, R) {
      const out = vystup(a, b, { dozvuk: 0.3 });
      sumVrstva(a, t, out, 'bandpass', 1200, 1.5, 0.3, 0.02, 0.2, 3000);
      praskani(a, t, 0.3, 2, 0.15, out, R);
      cvak(a, t + 0.3, 1400, 0.4, 0.03, out);
      dunivy(a, t + 0.3, 160, 60, 0.12, 0.35, out);
    },
    // led: mrazivý svist, sklovité nesouzvučné cinknutí a praskání ledu
    led(a, b, t, R) {
      const out = vystup(a, b, { dozvuk: 0.5 });
      sumVrstva(a, t, out, 'bandpass', 2500, 2, 0.2, 0.1, 0.2, 1200);
      for (const [n, h] of [[1, 0.14], [2.32, 0.08], [3.17, 0.05], [4.1, 0.03]]) ton(a, t + 0.2, kolem(R, 1250, 0.05) * n, h, 0.002, 0.5 / n + 0.1, out);
      drt(a, t + 0.2, 10, 0.4, 2500, 4500, 0.12, out, R, 0.006);
    },
    // jedovatý mrak: syčení plynu a bublání
    jedMrak(a, b, t, R) {
      const out = vystup(a, b, { dozvuk: 0.4 });
      const e = obalkaDrz(a, t, 0.3, 0.15, 0.4, 0.4);
      sumZdroj(a, t, 1, e, 'bandpass', kolem(R, 1600, 0.15), 0.8);
      e.connect(out);
      sumVrstva(a, t, out, 'lowpass', 250, 1, 0.3, 0.2, 0.6);
      for (let i = 0; i < 6; i++) { const tt = t + 0.1 + R() * 0.7; ton(a, tt, 180 + R() * 120, 0.15, 0.008, 0.06, out, 'sine', 420 + R() * 200); }
    },
    // děs: chvějivý disonantní akord klouzající dolů a „výkřik" větru
    des(a, b, t, R) {
      const out = vystup(a, b, { dozvuk: 0.7, hlas: 0.8 });
      for (const f of [311, 330, 466]) {
        hlasStvury(a, t, { f: [f, f * 0.7], delka: 1.2, formanty: [[500, 3, 1.2], [1100, 4, 0.8]], typ: 'triangle', vibrato: [kolem(R, 7, 0.2), 0.02], chrapot: [kolem(R, 9, 0.2), 0.5], hlas: 0.2, nabeh: 0.06 }, out);
      }
      sumVrstva(a, t, out, 'bandpass', 900, 3, 0.25, 0.3, 0.8, 500);
    },
    // spánek: ospalé klesající tóny a měkký výdech
    spanek(a, b, t) {
      const out = vystup(a, b, { dozvuk: 0.6, hlas: 0.6 });
      [880, 784, 659.3, 523.3].forEach((f, i) => zvonek(a, t + i * 0.16, f, 0.14, 0.7, out, 0.04));
      sumVrstva(a, t + 0.1, out, 'lowpass', 900, 0.7, 0.12, 0.3, 0.6);
    },
    // magický štít: stoupající hučení, krystalický třpyt a kovový lesk
    stitMag(a, b, t, R) {
      const out = vystup(a, b, { dozvuk: 0.5, hlas: 0.7 });
      for (const r of [1, 1.5, 2.01]) ton(a, t, 196 * r, 0.1, 0.12, 0.7, out, 'triangle', 262 * r, 1500);
      [1568, 2093, 2637].forEach((f, i) => zvonek(a, t + 0.15 + i * 0.05, f, 0.08, 0.5, out));
      kov(a, t + 0.15, kolem(R, 1100, 0.05), 0.08, 0.6, out, R);
    },
    // otřes: hluboký úder do země, dunění a sypání ze stropu
    otres(a, b, t, R) {
      const out = vystup(a, b, { dozvuk: 0.6 });
      dopad(a, t, out, R, 2, 300);
      dunivy(a, t, 60, 28, 0.9, 0.7, out);
      const e = obalkaDrz(a, t, 0.5, 0.05, 0.5, 0.6);
      sumZdroj(a, t, 1.2, e, 'lowpass', 150, 1);
      e.connect(out);
      drt(a, t + 0.15, 16, 1, 900, 2600, 0.14, out, R, 0.02);
    },
    // zlatý goblin: cinkání mincí a vysoké chichotání „hi-hi-hi"
    zlatyGoblin(a, b, t, R, o) {
      const out = vProstoru(a, b, o, R, 0.3);
      for (let i = 0; i < 5; i++) kov(a, t + i * 0.06 + R() * 0.03, 1900 + R() * 1200, 0.18, 0.2, out, R);
      const n = 3 + (R() * 2 | 0), f0 = kolem(R, 420, 0.1);
      for (let i = 0; i < n; i++) {
        const tt = t + 0.12 + i * kolem(R, 0.11, 0.1), f = f0 * (1 - i * 0.05);
        hlasStvury(a, tt, { f: [f * 1.15, f], delka: 0.085, formanty: [[400, 5, 1], [2300, 7, 1.4], [3000, 8, 0.6]], dech: 0.3, hlas: 0.32, nabeh: 0.01 }, out);
      }
    },
    // přepadení: úder bubnu a disonantní žesťový akord, který se nadme
    prepadeni(a, b, t, R) {
      const out = vystup(a, b, { dozvuk: 0.55, hlas: 0.9 });
      dunivy(a, t, 90, 38, 0.55, 0.9, out);
      sumVrstva(a, t, out, 'lowpass', 500, 0.8, 0.5, 0.003, 0.25);
      for (const f of [146.8, 207.7, 220, 293.7]) ZVUKY_POM.zest(a, t + 0.01, f, 0.11, 1.1, out);   // d – as – a: tritón a malá sekunda
      sumVrstva(a, t, out, 'bandpass', 3000, 0.8, 0.08, 0.4, 0.6);
    },
    // plamen: krátké zapraskání ohně
    plamen(a, b, t, R, o) {
      const out = vProstoru(a, b, o, R, 0.25, 0.9);
      praskani(a, t, 0.45, 1.3, 0.25, out, R);
      sumVrstva(a, t, out, 'lowpass', 350, 0.8, 0.25, 0.08, 0.35);
    },

    // --- hlasy potvor (když si tě všimnou) ------------------------
    // krysa: dvě až čtyři pronikavá pištění s rychlým chvěním a škrábání drápků
    hlas_krysa(a, b, t, R, o) {
      const out = vystup(a, b, { pan: (o && o.pan) || 0, dozvuk: 0.35, hlas: (o && o.hlas) || 1 });
      const n = 2 + (R() * 3 | 0);
      let tt = t;
      for (let i = 0; i < n; i++) {
        const f = 2000 + R() * 700, d = 0.05 + R() * 0.05;
        const s = a.createOscillator(); s.type = 'triangle';
        s.frequency.setValueAtTime(f, tt); s.frequency.linearRampToValueAtTime(f * 1.35, tt + d * 0.4); s.frequency.exponentialRampToValueAtTime(f * 0.9, tt + d);
        const lfo = a.createOscillator(); lfo.frequency.value = 45 + R() * 30;
        const lg = a.createGain(); lg.gain.value = f * 0.05; lfo.connect(lg); lg.connect(s.frequency);
        const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4500;
        const e = obalka(a, tt, 0.2, 0.006, d);
        s.connect(lp); lp.connect(e); e.connect(out); s.start(tt); s.stop(tt + d + 0.05); lfo.start(tt); lfo.stop(tt + d + 0.05);
        tt += d + 0.03 + R() * 0.06;
      }
      drt(a, t, 5, tt - t, 2000, 3500, 0.06, out, R, 0.006);
    },
    // had: nádech a dlouhé syčení s vlnícím se pásmem
    hlas_had(a, b, t, R, o) {
      const out = vystup(a, b, { pan: (o && o.pan) || 0, dozvuk: 0.3, hlas: (o && o.hlas) || 1 });
      const d = kolem(R, 0.9, 0.15);
      const e = obalkaDrz(a, t, 0.32, 0.1, d * 0.5, d * 0.4);
      const f = sumZdroj(a, t, d, e, 'bandpass', 3200, 1.4);
      f.frequency.setValueAtTime(kolem(R, 2700, 0.1), t); f.frequency.linearRampToValueAtTime(kolem(R, 3600, 0.1), t + d * 0.6); f.frequency.linearRampToValueAtTime(3000, t + d);
      e.connect(out);
      sumVrstva(a, t, out, 'bandpass', 2000, 1.5, 0.08, 0.08, d * 0.7);       // hrdelní spodek
    },
    // pavouk: cvakání kusadel, ťapání nohou a tiché chraplavé zasyčení
    hlas_pavouk(a, b, t, R, o) {
      const out = vystup(a, b, { pan: (o && o.pan) || 0, dozvuk: 0.3, hlas: (o && o.hlas) || 1 });
      let tt = t;
      for (let i = 0; i < 8; i++) { cvak(a, tt, 2600 + R() * 1400, 0.3 * (0.6 + R() * 0.4), 0.008, out); drevo(a, tt, 900 + R() * 300, 0.04, 0.02, out, R); tt += (i % 2 ? 0.07 : 0.025) + R() * 0.02; }
      drt(a, t + 0.05, 10, 0.4, 1200, 2200, 0.08, out, R, 0.008);              // nožičky
      sumVrstva(a, t + 0.1, out, 'bandpass', 2800, 1.5, 0.08, 0.05, 0.25);
    },
    // goblin: chrochtavé „grak-gruk" se chrapotem
    hlas_goblin(a, b, t, R, o) {
      const out = vystup(a, b, { pan: (o && o.pan) || 0, dozvuk: 0.3, hlas: (o && o.hlas) || 1 });
      const n = 2 + (R() * 2 | 0), f0 = kolem(R, 175, 0.12);
      for (let i = 0; i < n; i++) {
        const tt = t + i * kolem(R, 0.2, 0.15), d = 0.13 + R() * 0.07, f = f0 * (1 + (R() - 0.5) * 0.2);
        const [f1, f2] = R() < 0.5 ? [650, 1100] : [500, 900];
        hlasStvury(a, tt, { f: [f * 1.15, f, f * 0.7], delka: d, formanty: [[f1, 4, 1.6], [f2, 5, 1], [2400, 7, 0.35]], dech: 0.25,
          chrapot: [kolem(R, 32, 0.2), 0.75], hlas: 0.5, nabeh: 0.015 }, out);
      }
    },
    // kostlivec: chrastění kostí (dřevité rezonance) a cvakání čelistí
    hlas_kostlivec(a, b, t, R, o) {
      const out = vystup(a, b, { pan: (o && o.pan) || 0, dozvuk: 0.45, hlas: (o && o.hlas) || 1 });
      let tt = t;
      for (let i = 0; i < 14; i++) {
        drevo(a, tt, 700 + R() * 900, 0.16 * (1 - i / 18), 0.03, out, R);
        tt += 0.018 + R() * 0.035;
      }
      for (let i = 0; i < 3; i++) { const tc = t + 0.1 + i * 0.09; drevo(a, tc, kolem(R, 1300, 0.08), 0.25, 0.025, out, R); cvak(a, tc, 2000, 0.15, 0.008, out); }
    },
    // ork: hluboké hrdelní zařvání
    hlas_ork(a, b, t, R, o) {
      const out = vystup(a, b, { pan: (o && o.pan) || 0, dozvuk: 0.35, hlas: (o && o.hlas) || 1 });
      const f = kolem(R, 105, 0.12);
      hlasStvury(a, t, { f: [f, f * 1.3, f * 0.75], delka: kolem(R, 0.55, 0.15), formanty: [[550, 4, 1.8], [950, 5, 1.1], [2300, 7, 0.3]],
        dech: 0.35, chrapot: [kolem(R, 24, 0.2), 0.8], hlas: 0.6, nabeh: 0.04 }, out);
    },
    // žabák: dvojí zakvákání (pulzy jako drnčení)
    hlas_zabak(a, b, t, R, o) {
      const out = vystup(a, b, { pan: (o && o.pan) || 0, dozvuk: 0.35, hlas: (o && o.hlas) || 1 });
      for (let i = 0; i < 2; i++) {
        const f = kolem(R, 130, 0.1);
        hlasStvury(a, t + i * kolem(R, 0.28, 0.1), { f: [f, f * 1.1, f * 0.9], delka: 0.2, formanty: [[450, 5, 1.8], [1300, 6, 0.8]], chrapot: [kolem(R, 40, 0.1), 0.95], hlas: 0.55, nabeh: 0.01 }, out);
      }
    },
    // přízrak: vzdušné kvílení s vibratem
    hlas_prizrak(a, b, t, R, o) {
      const out = vystup(a, b, { pan: (o && o.pan) || 0, dozvuk: 0.7, hlas: (o && o.hlas) || 1 });
      const f = kolem(R, 420, 0.15);
      hlasStvury(a, t, { f: [f * 0.8, f * 1.3, f * 0.9], delka: kolem(R, 1.1, 0.15), formanty: [[f * 1.1, 3, 1.4], [800, 4, 0.8], [2600, 6, 0.3]], typ: 'triangle',
        dech: 0.5, vibrato: [kolem(R, 5.5, 0.15), 0.03], hlas: 0.2, nabeh: 0.25 }, out);
    },
    // pes: vrčení a štěknutí
    hlas_pes(a, b, t, R, o) {
      const out = vystup(a, b, { pan: (o && o.pan) || 0, dozvuk: 0.3, hlas: (o && o.hlas) || 1 });
      hlasStvury(a, t, { f: [kolem(R, 95, 0.1), 105, 90], delka: 0.5, formanty: [[350, 3, 1.8], [800, 4, 1]], dech: 0.3, chrapot: [kolem(R, 30, 0.15), 0.85], hlas: 0.45, nabeh: 0.08 }, out);
      const f = kolem(R, 420, 0.1);
      hlasStvury(a, t + 0.55, { f: [f * 0.9, f * 1.2, f * 0.7], delka: 0.12, formanty: [[900, 3, 1.6], [1600, 5, 1], [2600, 7, 0.3]], dech: 0.35, hlas: 0.55, nabeh: 0.008 }, out);
    },
    // golem: skřípění kamene a hluboké zasténání
    hlas_golem(a, b, t, R, o) {
      const out = vystup(a, b, { pan: (o && o.pan) || 0, dozvuk: 0.5, hlas: (o && o.hlas) || 1 });
      const f = kolem(R, 60, 0.1);
      hlasStvury(a, t, { f: [f, f * 1.2, f * 0.9], delka: 0.9, formanty: [[300, 3, 2], [600, 4, 1.2]], chrapot: [kolem(R, 14, 0.2), 0.6], hlas: 0.4, nabeh: 0.15 }, out);
      drt(a, t, 10, 0.8, 800, 1800, 0.12, out, R, 0.025);
    },
    // démon: dvojitý (oktávový) chraplavý řev
    hlas_demon(a, b, t, R, o) {
      const out = vystup(a, b, { pan: (o && o.pan) || 0, dozvuk: 0.5, hlas: (o && o.hlas) || 1 });
      const f = kolem(R, 75, 0.12);
      for (const r of [1, 2.02]) {
        hlasStvury(a, t, { f: [f * r, f * r * 1.4, f * r * 0.8], delka: 0.8, formanty: [[420, 3, 1.8], [900, 4, 1.1], [2000, 6, 0.3]],
          dech: 0.4, chrapot: [kolem(R, 22, 0.2), 0.8], hlas: r === 1 ? 0.5 : 0.22, nabeh: 0.06 }, out);
      }
    },
    // utopenec: bublavé zachrčení přes vodu
    hlas_utopenec(a, b, t, R, o) {
      const out = vystup(a, b, { pan: (o && o.pan) || 0, dozvuk: 0.45, hlas: (o && o.hlas) || 1 });
      const f = kolem(R, 120, 0.12);
      hlasStvury(a, t, { f: [f, f * 0.8], delka: 0.7, formanty: [[400, 4, 1.6], [800, 5, 1]], dech: 0.3, chrapot: [kolem(R, 18, 0.2), 0.9], hlas: 0.45, nabeh: 0.05 }, out);
      for (let i = 0; i < 5; i++) { const tt = t + 0.1 + R() * 0.6; ton(a, tt, 200 + R() * 150, 0.15, 0.006, 0.05, out, 'sine', 500 + R() * 200); }
    },
  };
  ZVUKY.hlas_zlatyGoblin = ZVUKY.zlatyGoblin;

  // pomocné nástroje sdílené několika zvuky (nejsou samostatné zvuky, proto mimo ZVUKY)
  const ZVUKY_POM = {
    // drnknutí tětivy: pila přes zavírající se dolní propust
    tetiva(a, t, f, hlas, cil) {
      const o = a.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(f * 1.04, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
      const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 2;
      lp.frequency.setValueAtTime(2800, t); lp.frequency.exponentialRampToValueAtTime(300, t + 0.25);
      const e = obalka(a, t, hlas, 0.002, 0.3);
      o.connect(lp); lp.connect(e); e.connect(cil); o.start(t); o.stop(t + 0.35);
    },
    // žesť: dvě rozladěné pily, filtr se při náběhu otevře a pak zavře
    zest(a, t, f, hlas, delka, cil) {
      const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1;
      lp.frequency.setValueAtTime(f * 1.2, t); lp.frequency.exponentialRampToValueAtTime(Math.min(4000, f * 5), t + 0.05); lp.frequency.exponentialRampToValueAtTime(f * 1.5, t + delka);
      const e = obalka(a, t, hlas, 0.03, delka);
      for (const r of [-6, 6]) { const o = a.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = r; o.connect(lp); o.start(t); o.stop(t + delka + 0.1); }
      lp.connect(e); e.connect(cil);
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
        bus.nastav(hlasEfekty); bus.prostredi.nastav(hlasProstredi); bus.hudba.nastav(hlasHudba);
        planujAtmosferu();
        casovacHudby = setInterval(tikHudby, 200);
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

  // --- hudba: generativní podkres podle prostředí; v boji zrychlí a přidá bubny ------------------------
  // bordun (kořen a kvinta) + řídká melodie, která se toulá po stupnici prostředí
  const HUDBA = {
    'Kamenné kobky':    { koren: 146.83, stupnice: [0, 2, 3, 5, 7, 9, 10], barva: 'triangle', tempo: 54 },   // D dórská
    'Zatopené jeskyně': { koren: 110.00, stupnice: [0, 3, 5, 7, 10], barva: 'sine', tempo: 48 },              // A moll pentatonika
    'Trpasličí doly':   { koren: 82.41, stupnice: [0, 1, 3, 5, 7, 8, 10], barva: 'square', tempo: 60 },       // E frygická
    'Krypta':           { koren: 130.81, stupnice: [0, 2, 3, 5, 7, 8, 11], barva: 'varhany', tempo: 44 },     // C harmonická moll
    'Lávové podzemí':   { koren: 87.31, stupnice: [0, 1, 4, 5, 7, 8, 10], barva: 'sawtooth', tempo: 58 },     // F frygická dominantní
    'Podivno':          { koren: 123.47, stupnice: [0, 2, 4, 6, 8, 10], barva: 'sine', tempo: 40 },           // celotónová
  };
  const hudba = { biom: 'Kamenné kobky', boj: 0, bojCil: 0, dalsi: 0, doba: 0, ton: 7, dron: null, dronBiom: null };
  let casovacHudby = 0;
  function barvaOsc(a, o, barva) {
    if (barva === 'varhany') o.setPeriodicWave(a.createPeriodicWave(new Float32Array([0, 1, 0.55, 0.35, 0.2, 0.1]), new Float32Array(6)));
    else o.type = barva;
  }
  // tón melodie: dva lehce rozladěné oscilátory (chorus), filtr se během tónu zavírá jako u drnkacího nástroje
  function tonHudby(a, cil, t, f, delka, hlas, barva, jas) {
    const ostra = barva === 'square' || barva === 'sawtooth';
    const j = (jas || 1400) * (ostra ? 0.55 : 1);
    const fl = a.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = 0.7;
    fl.frequency.setValueAtTime(j * 1.4, t); fl.frequency.exponentialRampToValueAtTime(Math.max(180, j * 0.35), t + delka);
    const e = a.createGain();
    e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(hlas * (ostra ? 0.45 : 0.55), t + Math.min(0.1, delka * 0.25));
    e.gain.exponentialRampToValueAtTime(0.0001, t + delka);
    for (const ladeni of [-5, 5]) {
      const o = a.createOscillator(); barvaOsc(a, o, barva); o.frequency.value = f; o.detune.value = ladeni;
      o.connect(fl); o.start(t); o.stop(t + delka + 0.05);
    }
    fl.connect(e); e.connect(cil.suchy); e.connect(cil.mokry);
  }
  // bordun: kořen, kvinta a rozladěný kořen; filtr pomalu dýchá, aby plocha žila
  function dronHudby(a, cil, H, t) {
    const g = a.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.045, t + 3);
    const fl = a.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 480;
    const lfo = a.createOscillator(); lfo.frequency.value = 0.07;
    const lg = a.createGain(); lg.gain.value = 160; lfo.connect(lg); lg.connect(fl.frequency); lfo.start(t);
    const osc = [H.koren / 2, H.koren * 0.75, H.koren / 2 * 1.004].map(f => {
      const o = a.createOscillator(); barvaOsc(a, o, H.barva === 'square' || H.barva === 'sawtooth' ? 'triangle' : H.barva); o.frequency.value = f;
      o.connect(fl); o.start(t); return o;
    });
    osc.push(lfo);
    fl.connect(g); g.connect(cil.suchy); g.connect(cil.mokry);
    return { stop(tt) { g.gain.cancelScheduledValues(tt); g.gain.setValueAtTime(g.gain.value || 0.045, tt); g.gain.exponentialRampToValueAtTime(0.0001, tt + 2.5); osc.forEach(o => o.stop(tt + 2.6)); } };
  }
  // naplánuje doby hudby až do času doKdy (živě po kouscích, v testu celé najednou)
  function planujHudbu(a, cil, doKdy, R) {
    const H = HUDBA[hudba.biom] || HUDBA['Kamenné kobky'];
    if (hudba.dronBiom !== hudba.biom) {
      if (hudba.dron) hudba.dron.stop(a.currentTime);
      hudba.dron = dronHudby(a, cil, H, Math.max(a.currentTime, hudba.dalsi)); hudba.dronBiom = hudba.biom;
    }
    if (hudba.dalsi < a.currentTime) hudba.dalsi = a.currentTime + 0.05;
    while (hudba.dalsi < doKdy) {
      const t = hudba.dalsi, boj = hudba.boj, n = H.stupnice.length;
      const interval = 60 / (H.tempo * (1 + 0.9 * boj));
      // melodie: náhodná procházka po stupnici (v boji hustší a výš)
      if (R() < 0.45 + 0.35 * boj) {
        hudba.ton = Math.max(0, Math.min(n * 2 + 2, hudba.ton + [-2, -1, -1, 1, 1, 2][Math.floor(R() * 6)]));
        const pul = H.stupnice[hudba.ton % n] + 12 * Math.floor(hudba.ton / n);
        tonHudby(a, cil, t, H.koren * Math.pow(2, pul / 12 + (boj > 0.5 ? 1 : 0)), interval * (1.6 + R()), 0.07, H.barva, 1100 + 900 * boj);
      }
      if (hudba.doba % 8 === 0) tonHudby(a, cil, t, H.koren / 2, interval * 6, 0.06, H.barva, 500);   // basový tón každý takt
      // boj: buben (kotel) na sudých dobách, tlumený šustot na lichých
      if (boj > 0.15) {
        if (hudba.doba % 2 === 0) {
          const o = a.createOscillator(); o.type = 'sine';
          o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.22);
          const e = a.createGain(); e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(0.22 * boj, t + 0.005); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
          o.connect(e); e.connect(cil.suchy); o.start(t); o.stop(t + 0.3);
          const z = a.createBufferSource(); z.buffer = sum(a);       // kůže blány
          const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
          const ez = a.createGain(); ez.gain.setValueAtTime(0.0001, t); ez.gain.exponentialRampToValueAtTime(0.08 * boj, t + 0.003); ez.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
          z.connect(lp); lp.connect(ez); ez.connect(cil.suchy); z.start(t, R() * 1.5); z.stop(t + 0.08);
        } else {
          const z = a.createBufferSource(); z.buffer = sum(a);
          const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3200 + R() * 600; bp.Q.value = 1.2;
          const e = a.createGain(); e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(0.045 * boj, t + 0.004); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
          z.connect(bp); bp.connect(e); e.connect(cil.suchy); z.start(t, R() * 1.5); z.stop(t + 0.1);
        }
      }
      hudba.boj += (hudba.bojCil - hudba.boj) * 0.25;               // napětí přichází a odchází plynule
      hudba.doba++; hudba.dalsi = t + interval;
    }
  }
  function tikHudby() {
    if (!ac || ac.state !== 'running' || !zapnuto || hlasHudba <= 0 || document.hidden) return;
    try { planujHudbu(ac, bus.hudba, ac.currentTime + 0.6, Math.random); } catch { /* hudba není pro hru nutná */ }
  }
  // UI hlásí prostředí a napětí (0 = klid, 1 = boj)
  function nastavHudbu(biom, boj) {
    if (HUDBA[biom]) hudba.biom = biom;
    hudba.bojCil = Math.max(0, Math.min(1, boj || 0));
  }
  function hlasitostHudby(v) {
    hlasHudba = v;
    if (bus) bus.hudba.nastav(v);
    if (v <= 0 && hudba.dron && ac) { hudba.dron.stop(ac.currentTime); hudba.dron = null; hudba.dronBiom = null; }
  }
  // test: kousek hudby offline (kolik sekund, prostředí, napětí) – špička a RMS
  async function zmerHudbu(biom, boj, sekund) {
    const oc = new OfflineAudioContext(2, 44100 * (sekund || 8), 44100);
    const b = sestav(oc, oc.destination); b.hudba.nastav(1);
    const zaloha = Object.assign({}, hudba);
    Object.assign(hudba, { biom, boj: boj || 0, bojCil: boj || 0, dalsi: 0.05, doba: 0, ton: 7, dron: null, dronBiom: null });
    let s = 11;
    const R = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    planujHudbu(oc, b.hudba, (sekund || 8) - 0.5, R);
    const pocetDob = hudba.doba;
    Object.assign(hudba, zaloha);
    const buf = await oc.startRendering();
    let spicka = 0, sq = 0, nan = false;
    for (let k = 0; k < 2; k++) {
      const d = buf.getChannelData(k);
      for (let i = 0; i < d.length; i++) { const v = d[i]; if (v !== v) nan = true; spicka = Math.max(spicka, Math.abs(v)); sq += v * v; }
    }
    return { biom, boj, dob: pocetDob, spicka: +spicka.toFixed(3), rms: +Math.sqrt(sq / (buf.length * 2)).toFixed(4), nan };
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
    odemkni, hraj, nastav, zmer, nastavProstredi, hlasitost, nastavHudbu, hlasitostHudby, zmerHudbu,
    get prostrediHudby() { return Object.keys(HUDBA); },
    get zapnuto() { return zapnuto; },
    get bezi() { return !!ac && ac.state === 'running'; },
    druhy: Object.keys(ZVUKY),
  };
})();

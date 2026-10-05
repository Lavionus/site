/* ============================================================
   Síně pod horou – zvuk.js: zvuky, prostředí a hudba (Web Audio,
   vše syntetizované; základ převzatý ze Srdce hory).

   Každý zvuk je funkce (ctx, cil, cas, sila, x) → vlastní uzly, takže
   jde přehrát naživo i vykreslit do OfflineAudioContext (test měří
   hlasitost). Nové proti Srdci hory:
     ozvěna – podle velikosti prostoru, kde se zvuk ozval (malá světnice
              skoro nic, velká síň a jeskyně dutě); hraj(…, {ozvena})
     patra  – zvuk z patra nad / pod pohledem je ztlumený a zastřený
              (dolní propust), vzdálenější patra se neozvou
     prostředí – smyčky šumu: vítr a potok v rokli, hlasy a cinkání
              tržiště, kapání v podzemí; prostredi({…}) nastaví hlasitosti
   Hudba: tichý dron a pentatonika, s hloubkou patra tmavne.
   AudioContext vzniká až při prvním klepnutí (pravidla prohlížečů).
   ============================================================ */
var SIN = globalThis.SIN = globalThis.SIN || {};

(function (S) {
  'use strict';
  const KLIC = 'webapp_hra_sine_zvuk';
  let ctx = null, hlavni = null, efekty = null, hudbaUzel = null, prostrUzel = null;
  const nast = { zvuk: true, hudba: true, hlasitost: 0.7 };
  try { Object.assign(nast, JSON.parse(localStorage.getItem(KLIC) || '{}')); } catch (e) { /* bez úložiště */ }
  const ulozNast = () => { try { localStorage.setItem(KLIC, JSON.stringify(nast)); } catch (e) { /* nic */ } };

  // --- stavební kameny ---------------------------------------------------------------------
  function sumBuffer(c, delka, barva) {
    const b = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * delka)), c.sampleRate), d = b.getChannelData(0);
    let x = 12345, hneda = 0;
    for (let i = 0; i < d.length; i++) {
      x = (x * 1103515245 + 12345) & 0x7fffffff;
      const w = x / 0x3fffffff - 1;
      if (barva === 'hneda') { hneda = (hneda + 0.02 * w) / 1.02; d[i] = hneda * 3.5; } else d[i] = w;
    }
    return b;
  }
  function sum(c, delka) { const s = c.createBufferSource(); s.buffer = sumBuffer(c, delka); return s; }
  function obalka(c, cil, t0, utok, doba, max) {
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, max), t0 + utok);
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
  // výška úderu podle tvrdosti horniny (hlína tupě, žula ostře, runa a obsidián zvoní); x = { tvrdost, ruda }
  const vyskaUderu = x => 260 + 280 * Math.min(6, (x && x.tvrdost) || 2);

  const ZVUKY = {
    uder(c, cil, t0, s, x) {
      const ruda = x && x.ruda, f = vyskaUderu(x);
      hluk(c, cil, t0, 0.07, 0.5 * s, 'bandpass', f, 3);
      ton(c, cil, t0, 'triangle', f / 3, 0.06, 0.25 * s, f / 5);
      if (ruda || (x && x.tvrdost >= 6)) ton(c, cil, t0 + 0.01, 'sine', ruda ? 2600 : 1900, 0.25, 0.12 * s);
    },
    vykop(c, cil, t0, s) { hluk(c, cil, t0, 0.35, 0.35 * s, 'lowpass', 500, 0.7); ton(c, cil, t0 + 0.05, 'triangle', 140, 0.2, 0.2 * s, 70); },
    sekera(c, cil, t0, s) { ton(c, cil, t0, 'triangle', 210, 0.12, 0.45 * s, 90); hluk(c, cil, t0, 0.08, 0.25 * s, 'bandpass', 700, 2); },
    strom(c, cil, t0, s) { hluk(c, cil, t0, 0.9, 0.45 * s, 'lowpass', 700, 0.8); ton(c, cil, t0 + 0.6, 'sine', 90, 0.4, 0.4 * s, 45); },
    kladivo(c, cil, t0, s) { ton(c, cil, t0, 'sine', 320, 0.09, 0.5 * s, 150); hluk(c, cil, t0, 0.03, 0.2 * s, 'highpass', 2000, 1); },
    kovadlina(c, cil, t0, s) { for (const [f, a] of [[820, 0.3], [1345, 0.2], [2210, 0.14], [3020, 0.08]]) ton(c, cil, t0, 'sine', f, 0.7, a * s); hluk(c, cil, t0, 0.02, 0.3 * s, 'highpass', 3000, 1); },
    dilna(c, cil, t0, s) { hluk(c, cil, t0, 0.18, 0.25 * s, 'bandpass', 1800, 6); hluk(c, cil, t0 + 0.2, 0.18, 0.22 * s, 'bandpass', 1500, 6); },
    postaveno(c, cil, t0, s) { ton(c, cil, t0, 'sine', 300, 0.08, 0.4 * s, 160); ton(c, cil, t0 + 0.12, 'sine', 360, 0.1, 0.35 * s, 180); },
    praskani(c, cil, t0, s) { for (let k = 0; k < 7; k++) hluk(c, cil, t0 + k * 0.045 + (k * 37 % 11) / 400, 0.015, 0.45 * s, 'highpass', 2500, 1); },
    zaval(c, cil, t0, s, n) {
      const d = 1.2 + Math.min(1, (n || 4) / 10);
      hluk(c, cil, t0, d, 0.8 * s, 'lowpass', 180, 0.8);
      for (let k = 0; k < 5; k++) ton(c, cil, t0 + k * 0.18, 'sine', 70 - k * 6, 0.3, 0.45 * s, 40);
    },
    voda(c, cil, t0, s) { ton(c, cil, t0, 'sine', 1300, 0.07, 0.25 * s, 650); ton(c, cil, t0 + 0.09, 'sine', 900, 0.05, 0.12 * s, 500); },
    syceni(c, cil, t0, s) { hluk(c, cil, t0, 0.8, 0.4 * s, 'highpass', 3500, 0.7); },
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
    sip(c, cil, t0, s) { hluk(c, cil, t0, 0.12, 0.3 * s, 'bandpass', 3200, 3); ton(c, cil, t0, 'sine', 900, 0.1, 0.08 * s, 500); },
    zasah(c, cil, t0, s) { hluk(c, cil, t0, 0.1, 0.4 * s, 'lowpass', 600, 1); ton(c, cil, t0, 'triangle', 180, 0.12, 0.25 * s, 120); },
    dvere(c, cil, t0, s) { ton(c, cil, t0, 'triangle', 120, 0.15, 0.5 * s, 70); hluk(c, cil, t0, 0.12, 0.35 * s, 'lowpass', 900, 1); },
    netopyr(c, cil, t0, s) { for (let k = 0; k < 3; k++) ton(c, cil, t0 + k * 0.07, 'sine', 3800 + k * 300, 0.04, 0.08 * s, 2600); },
    rev(c, cil, t0, s) { hluk(c, cil, t0, 1.1, 0.6 * s, 'bandpass', 160, 2); ton(c, cil, t0, 'sawtooth', 55, 1.0, 0.3 * s, 35); },
    padl(c, cil, t0, s) { ton(c, cil, t0, 'square', 300, 0.25, 0.15 * s, 90); },
    objev(c, cil, t0, s) { [523, 659, 784, 1047].forEach((f, k) => ton(c, cil, t0 + k * 0.09, 'triangle', f, 0.45, 0.2 * s)); },
    zvonek(c, cil, t0, s) { ton(c, cil, t0, 'sine', 880, 1.2, 0.3 * s); ton(c, cil, t0, 'sine', 1760, 0.8, 0.12 * s); ton(c, cil, t0 + 0.25, 'sine', 660, 1.0, 0.2 * s); },
    smrt(c, cil, t0, s) { [220, 262, 330].forEach(f => ton(c, cil, t0, 'triangle', f, 1.4, 0.15 * s, f * 0.94)); },
    varovani(c, cil, t0, s) { for (const [f, d] of [[740, 0], [554, 0.16]]) ton(c, cil, t0 + d, 'triangle', f, 0.28, 0.25 * s); },
    deska(c, cil, t0, s) { [392, 494, 587, 740].forEach((f, k) => ton(c, cil, t0 + k * 0.22, 'sine', f, 1.2, 0.14 * s)); ton(c, cil, t0, 'sine', 98, 1.6, 0.12 * s); },
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
      prostrUzel = ctx.createGain(); prostrUzel.gain.value = nast.zvuk ? 1 : 0; prostrUzel.connect(hlavni);
      hudbaUzel = ctx.createGain(); hudbaUzel.gain.value = nast.hudba ? 0.5 : 0; hudbaUzel.connect(hlavni);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  // ozvěna: zpožďovací smyčka (delší a hlasitější ve větším prostoru), vede do cíle souběžně se suchým zvukem
  function ozvena(c, cil, mira) {
    const vstup = c.createGain();
    vstup.connect(cil);
    if (!(mira > 0.05)) return vstup;
    const zp = c.createDelay(1), fb = c.createGain(), fl = c.createBiquadFilter(), mokro = c.createGain();
    zp.delayTime.value = 0.06 + 0.2 * mira; fb.gain.value = 0.25 + 0.4 * mira; fl.type = 'lowpass'; fl.frequency.value = 2200 - 1200 * mira;
    mokro.gain.value = 0.35 + 0.35 * mira;
    vstup.connect(zp); zp.connect(fl); fl.connect(fb); fb.connect(zp); fl.connect(mokro); mokro.connect(cil);
    return vstup;
  }
  // míra ozvěny podle počtu polí prostoru (místnost / jeskyně); venku žádná
  const miraOzveny = (pole, venku) => venku ? 0 : Math.max(0, Math.min(1, (Math.log2(Math.max(1, pole)) - 3.5) / 5));
  const posledni = {};
  // o = { pan -1..1, ozvena 0..1, patro: 0 stejné / 1 sousední (ztlumené) }
  function hraj(typ, sila, o, x) {
    if (!ctx || !nast.zvuk || ctx.state !== 'running' || !ZVUKY[typ]) return false;
    o = o || {};
    const ted = ctx.currentTime, min = { uder: 0.05, voda: 0.4, praskani: 0.6, boj: 0.06, sip: 0.08, kladivo: 0.08, dilna: 0.3, kovadlina: 0.12, netopyr: 0.5 }[typ] || 0.15;
    if (posledni[typ] && ted - posledni[typ] < min) return false;
    posledni[typ] = ted;
    let cil = efekty;
    if (o.patro) { const fl = ctx.createBiquadFilter(), g = ctx.createGain(); fl.type = 'lowpass'; fl.frequency.value = 500; g.gain.value = 0.35; fl.connect(g); g.connect(cil); cil = fl; }
    if (o.pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, o.pan)); p.connect(cil); cil = p; }
    cil = ozvena(ctx, cil, o.ozvena || 0);
    ZVUKY[typ](ctx, cil, ted + 0.01, sila === undefined ? 1 : sila, x);
    return true;
  }

  // --- prostředí: smyčky šumu s plynule nastavovanou hlasitostí -------------------------------------
  const smycky = {};
  function smycka(k) {
    if (smycky[k]) return smycky[k];
    const c = ctx, src = c.createBufferSource();
    src.buffer = sumBuffer(c, 4, k === 'vitr' || k === 'potok' ? 'hneda' : 'bila'); src.loop = true;
    const fl = c.createBiquadFilter(), g = c.createGain();
    g.gain.value = 0;
    if (k === 'vitr') { fl.type = 'lowpass'; fl.frequency.value = 500; const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.13; lg.gain.value = 250; lfo.connect(lg); lg.connect(fl.frequency); lfo.start(); }
    else if (k === 'potok') { fl.type = 'bandpass'; fl.frequency.value = 1400; fl.Q.value = 0.6; }
    else if (k === 'trh') { fl.type = 'bandpass'; fl.frequency.value = 650; fl.Q.value = 1.4; const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 2.3; lg.gain.value = 0.4; lfo.connect(lg); lg.connect(g.gain); lfo.start(); }
    else { fl.type = 'lowpass'; fl.frequency.value = 300; }
    src.connect(fl); fl.connect(g); g.connect(prostrUzel); src.start();
    return (smycky[k] = { g, fl });
  }
  let dalsiKapka = 0, dalsiCink = 0;
  // u = { vitr, potok, trh, kapky } 0..1 – volá UI asi jednou za sekundu
  function prostredi(u) {
    if (!ctx || ctx.state !== 'running') return;
    for (const k of ['vitr', 'potok', 'trh']) {
      const cil = Math.max(0, Math.min(1, u[k] || 0)) * { vitr: 0.18, potok: 0.12, trh: 0.05 }[k];
      if (!cil && !smycky[k]) continue;
      smycka(k).g.gain.setTargetAtTime(cil, ctx.currentTime, 0.8);
    }
    const t = ctx.currentTime;
    if (u.kapky > 0 && t > dalsiKapka) { dalsiKapka = t + 1.5 + Math.random() * 4 / u.kapky; const c = ozvena(ctx, prostrUzel, 0.7); ZVUKY.voda(ctx, c, t + 0.02, 0.25 * u.kapky); }
    if (u.trh > 0 && t > dalsiCink) { dalsiCink = t + 2 + Math.random() * 5; ton(ctx, prostrUzel, t + 0.02, 'sine', 1800 + Math.random() * 900, 0.3, 0.025 * u.trh); }
  }

  // --- hudba: dron + pentatonika podle hloubky patra ---------------------------------------------
  let dron = null, dalsiNota = 0, hloubka = 0;
  const STUPNICE = [0, 3, 5, 7, 10, 12, 15];
  function hudba(patro) {
    if (!ctx || ctx.state !== 'running') return;
    hloubka = patro;
    const zaklad = 110 * Math.pow(2, -Math.min(1.2, Math.max(0, patro) / 7));     // hlouběji = níž
    if (!dron) {
      dron = [ctx.createOscillator(), ctx.createOscillator()];
      const g = ctx.createGain(); g.gain.value = 0.05;
      const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 400;
      dron.forEach((o, k) => { o.type = 'sine'; o.frequency.value = zaklad * (k ? 1.5 : 1); o.detune.value = k ? 4 : -4; o.connect(fl); o.start(); });
      fl.connect(g); g.connect(hudbaUzel); dron.fl = fl;
    }
    dron[0].frequency.setTargetAtTime(zaklad, ctx.currentTime, 2);
    dron[1].frequency.setTargetAtTime(zaklad * 1.5, ctx.currentTime, 2);
    dron.fl.frequency.setTargetAtTime(patro >= 6 ? 250 : 450, ctx.currentTime, 3);
    if (ctx.currentTime < dalsiNota) return;
    dalsiNota = ctx.currentTime + 2.5 + Math.random() * 3;
    const f = zaklad * 4 * Math.pow(2, STUPNICE[Math.floor(Math.random() * STUPNICE.length)] / 12);
    const o = ctx.createOscillator(); o.type = patro >= 6 ? 'sine' : 'triangle'; o.frequency.value = f;
    const g = ctx.createGain(), t0 = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.06, t0 + 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 4);
    const zp = ctx.createDelay(1); zp.delayTime.value = 0.45; const fb = ctx.createGain(); fb.gain.value = 0.35;
    o.connect(g); g.connect(hudbaUzel); g.connect(zp); zp.connect(fb); fb.connect(zp); zp.connect(hudbaUzel);
    o.start(t0); o.stop(t0 + 4.2);
  }

  function nastav(k, v) {
    nast[k] = v; ulozNast();
    if (!ctx) return;
    if (k === 'zvuk') { efekty.gain.value = v ? 1 : 0; prostrUzel.gain.value = v ? 1 : 0; }
    if (k === 'hudba') hudbaUzel.gain.value = v ? 0.5 : 0;
    if (k === 'hlasitost') hlavni.gain.value = v;
  }
  // test: vykreslí zvuk (volitelně s ozvěnou) do OfflineAudioContext a vrátí špičku a energii po 0,5 s
  async function zmer(typ, x, ozv) {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const c = new OAC(1, 44100 * 2.5, 44100);
    ZVUKY[typ](c, ozvena(c, c.destination, ozv || 0), 0.01, 1, x);
    const b = await c.startRendering(), d = b.getChannelData(0);
    let spicka = 0, dozvuk = 0;
    for (let i = 0; i < d.length; i++) { spicka = Math.max(spicka, Math.abs(d[i])); if (i > 22050) dozvuk += d[i] * d[i]; }
    return { spicka, dozvuk };
  }

  S.zvuk = { ZVUKY, nast, probud, hraj, hudba, prostredi, nastav, zmer, miraOzveny, stav: () => ({ ctx: ctx ? ctx.state : 'zadny', hloubka, smycky: Object.keys(smycky) }) };
})(SIN);

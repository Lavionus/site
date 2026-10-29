/* Lamamp – zvukový řetězec (WA_ZVUK).
   Režim 'webaudio': <audio> → prolínání → preamp → 10× pásmový filtr → vyvážení → hlasitost → analyzátor → výstup.
   Režim 'primo': <audio> hraje samo (bez EQ a vizualizace) – na iPhonu jediné spolehlivé hraní se zamčeným displejem.
   Dvě „mechaniky“ (A/B) střídavě kvůli prolínání skladeb (crossfade). */
(function () {
  'use strict';

  const PASMA = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];
  const jeIos = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  const zesileni = v => Math.pow(Math.max(0, Math.min(100, v)) / 100, 2);   // hlasitost 0..100 → zesílení (sluchově rovnoměrně)
  const dbNaZes = db => Math.pow(10, db / 20);

  function vytvor({ rezim = jeIos() ? 'primo' : 'webaudio' } = {}) {
    let ctx = null, preamp, filtry = [], panorama, hlas, analyzator;
    let mechaniky = [], aktivni = null;
    const stav = { hlasitost: 75, balance: 0, eq: { zap: false, preamp: 0, pasma: new Array(10).fill(0) } };
    const on = { konec: null, chyba: null, metadata: null, pauza: null, hraje: null };

    function graf() {
      if (ctx) return true;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      preamp = ctx.createGain();
      filtry = PASMA.map(f => { const b = ctx.createBiquadFilter(); b.type = 'peaking'; b.frequency.value = f; b.Q.value = 1.4; return b; });
      panorama = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      hlas = ctx.createGain();
      analyzator = ctx.createAnalyser(); analyzator.fftSize = 2048; analyzator.smoothingTimeConstant = 0.55;
      let uzel = preamp;
      for (const f of [...filtry, panorama, hlas, analyzator]) if (f) { uzel.connect(f); uzel = f; }
      analyzator.connect(ctx.destination);
      if (navigator.audioSession) { try { navigator.audioSession.type = 'playback'; } catch (e) { /* starší Safari */ } }
      pouzijNastaveni();
      return true;
    }

    function novaMechanika(primo) {
      const a = new Audio();
      a.preload = 'auto';
      const m = { audio: a, zdroj: null, prolinani: null, primo };
      a.addEventListener('ended', () => { if (m === aktivni && on.konec) on.konec(); });
      a.addEventListener('error', () => { if (m === aktivni && a.getAttribute('src') && on.chyba) on.chyba(a.error); });
      a.addEventListener('loadedmetadata', () => { if (m === aktivni && on.metadata) on.metadata(a.duration); });
      a.addEventListener('pause', () => { if (m === aktivni && !a.ended && a.getAttribute('src') && on.pauza) on.pauza(); });
      a.addEventListener('playing', () => { if (m === aktivni && on.hraje) on.hraje(); });
      mechaniky.push(m);
      return m;
    }
    // napojení mechaniky na graf (createMediaElementSource jde jen jednou a jen po gestu uživatele)
    function napoj(m) {
      if (m.primo || m.zdroj || rezim !== 'webaudio' || !graf()) return;
      m.zdroj = ctx.createMediaElementSource(m.audio);
      m.prolinani = ctx.createGain();
      m.zdroj.connect(m.prolinani).connect(preamp);
      m.audio.volume = 1;
    }
    const smerovana = m => !!m.zdroj;

    function pouzijNastaveni() {
      for (const m of mechaniky) if (!smerovana(m)) m.audio.volume = zesileni(stav.hlasitost);
      if (!ctx) return;
      const t = ctx.currentTime;
      hlas.gain.setTargetAtTime(zesileni(stav.hlasitost), t, 0.015);
      if (panorama) panorama.pan.setTargetAtTime(stav.balance / 100, t, 0.015);
      const zap = stav.eq.zap;
      preamp.gain.setTargetAtTime(zap ? dbNaZes(stav.eq.preamp) : 1, t, 0.015);
      filtry.forEach((f, i) => f.gain.setTargetAtTime(zap ? stav.eq.pasma[i] : 0, t, 0.015));
    }

    // mechanika pro další zdroj: volná (ne aktivní) a správného druhu
    function volnaMechanika(primo) {
      return mechaniky.find(m => m !== aktivni && m.primo === primo) || novaMechanika(primo);
    }
    function uvolni(m) {
      if (!m) return;
      m.audio.pause();
      m.audio.removeAttribute('src');
      m.audio.load();
    }

    // načtení zdroje do aktivní mechaniky; url = blob: nebo http(s) stream
    function nacti(url, { stream = false } = {}) {
      const primo = rezim === 'primo';
      const m = volnaMechanika(primo);
      if (aktivni && aktivni !== m) uvolni(aktivni);
      aktivni = m;
      if (m.prolinani) { m.prolinani.gain.cancelScheduledValues(ctx.currentTime); m.prolinani.gain.setValueAtTime(1, ctx.currentTime); }
      m.stream = stream;
      if (stream && !primo) m.audio.crossOrigin = 'anonymous'; else m.audio.removeAttribute('crossorigin');
      m.audio.src = url;
      m.audio.volume = smerovana(m) ? 1 : zesileni(stav.hlasitost);
      return m;
    }
    // stream bez CORS hlaviček nejde přes Web Audio – přehraje se přímo (bez EQ a vizualizace)
    function nactiPrimo(url) {
      const m = volnaMechanika(true);
      if (aktivni && aktivni !== m) uvolni(aktivni);
      aktivni = m;
      m.stream = true;
      m.audio.removeAttribute('crossorigin');
      m.audio.src = url;
      m.audio.volume = zesileni(stav.hlasitost);
      return m;
    }

    async function hraj() {
      if (!aktivni) return;
      // Safari: kontext „interrupted“ (hovor, Siri) může resume() nechat viset – nečekat déle než 0,5 s
      if (rezim === 'webaudio') { napoj(aktivni); if (ctx && ctx.state !== 'running') { try { await Promise.race([ctx.resume(), new Promise(h => setTimeout(h, 500))]); } catch (e) { /* bez gesta */ } } }
      await aktivni.audio.play();
    }
    const pauza = () => { if (aktivni) aktivni.audio.pause(); };
    function stop() {
      for (const m of mechaniky) if (m !== aktivni) uvolni(m);
      if (!aktivni) return;
      aktivni.audio.pause();
      try { aktivni.audio.currentTime = 0; } catch (e) { /* stream */ }
    }
    // Shift+V: plynulé ztišení a stop
    function stopZtlumenim(s = 1.5) {
      return new Promise(hotovo => {
        if (!aktivni || aktivni.audio.paused) { stop(); return hotovo(); }
        const m = aktivni;
        if (m.prolinani) {
          m.prolinani.gain.setValueAtTime(m.prolinani.gain.value, ctx.currentTime);
          m.prolinani.gain.linearRampToValueAtTime(0, ctx.currentTime + s);
        }
        const v0 = m.audio.volume, t0 = performance.now();
        const krok = () => {
          const f = Math.min(1, (performance.now() - t0) / (s * 1000));
          if (!m.prolinani) m.audio.volume = v0 * (1 - f);
          if (f < 1 && m === aktivni) requestAnimationFrame(krok);
          else { if (m === aktivni) stop(); if (m.prolinani) m.prolinani.gain.value = 1; m.audio.volume = m.prolinani ? 1 : v0; hotovo(); }
        };
        requestAnimationFrame(krok);
      });
    }
    // prolnutí do další skladby (jen přes Web Audio, jinak obyčejné přepnutí)
    async function prolni(url, s) {
      const stara = aktivni;
      if (!stara || !smerovana(stara) || rezim !== 'webaudio') { nacti(url); return hraj(); }
      const m = volnaMechanika(false);
      m.audio.removeAttribute('crossorigin');
      m.audio.src = url;
      napoj(m);
      const t = ctx.currentTime;
      m.stream = false;
      m.prolinani.gain.cancelScheduledValues(t); m.prolinani.gain.setValueAtTime(0, t); m.prolinani.gain.linearRampToValueAtTime(1, t + s);
      const g0 = stara.prolinani.gain.value;
      stara.prolinani.gain.cancelScheduledValues(t); stara.prolinani.gain.setValueAtTime(g0, t); stara.prolinani.gain.linearRampToValueAtTime(0, t + s);
      aktivni = m;
      setTimeout(() => {
        if (stara === aktivni) return;   // mechanika mezitím znovu použita
        uvolni(stara); stara.prolinani.gain.cancelScheduledValues(ctx.currentTime); stara.prolinani.gain.setValueAtTime(1, ctx.currentTime);
      }, s * 1000 + 100);
      await m.audio.play();
    }

    // odemknutí v gestu uživatele: AudioContext spustit, mechaniky jednou „přehrát“ (WebKit pak dovolí play() i později)
    let odemceno = false;
    function odemkni() {
      if (odemceno) return;
      odemceno = true;
      if (rezim === 'webaudio' && graf() && ctx.state !== 'running') ctx.resume().catch(() => {});
      const TICHO = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
      for (const primo of [true, false]) {
        const m = mechaniky.find(x => x.primo === primo && x !== aktivni) || novaMechanika(primo);
        if (m === aktivni || m.audio.getAttribute('src')) continue;
        m.audio.src = TICHO;
        m.audio.play().then(() => { if (m !== aktivni) uvolni(m); }).catch(() => { if (m !== aktivni) uvolni(m); });
      }
    }

    function nastavRezim(r) {
      if (r === rezim) return;
      const bylo = aktivni && { url: aktivni.audio.getAttribute('src'), cas: aktivni.audio.currentTime, hralo: !aktivni.audio.paused, stream: !!aktivni.stream };
      rezim = r;
      for (const m of mechaniky) uvolni(m);
      aktivni = null;
      if (bylo && bylo.url) {
        const m = nacti(bylo.url, { stream: bylo.stream });
        m.audio.addEventListener('loadedmetadata', () => { try { m.audio.currentTime = bylo.cas; } catch (e) { /* stream */ } }, { once: true });
        if (bylo.hralo) hraj().catch(() => {});
      }
    }

    return {
      on, jeIos,
      get rezim() { return rezim; },
      get ctx() { return ctx; },
      get audio() { return aktivni && aktivni.audio; },
      get cas() { return aktivni ? aktivni.audio.currentTime || 0 : 0; },
      set cas(t) { if (aktivni && isFinite(aktivni.audio.duration)) { try { aktivni.audio.currentTime = Math.max(0, Math.min(t, aktivni.audio.duration - 0.05)); } catch (e) { /* nelze */ } } },
      get delka() { return aktivni ? aktivni.audio.duration : NaN; },
      get hraje() { return !!aktivni && !aktivni.audio.paused && !aktivni.audio.ended; },
      // jde přes Web Audio → funguje EQ, vyvážení a vizualizace
      get smerovano() { return !!aktivni && smerovana(aktivni); },
      nacti, nactiPrimo, hraj, pauza, stop, stopZtlumenim, prolni, nastavRezim, odemkni,
      hlasitost(v) { stav.hlasitost = v; pouzijNastaveni(); },
      balance(v) { stav.balance = v; pouzijNastaveni(); },
      eq(e) { stav.eq = { zap: !!e.zap, preamp: e.preamp, pasma: e.pasma.slice() }; pouzijNastaveni(); },
      // data pro vizualizaci; false = nejsou (přímý režim, nic nehraje)
      spektrum(pole) { if (!analyzator || !this.smerovano) return false; analyzator.getByteFrequencyData(pole); return true; },
      vlna(pole) { if (!analyzator || !this.smerovano) return false; analyzator.getByteTimeDomainData(pole); return true; },
      get frekvenceVzorkovani() { return ctx ? ctx.sampleRate : 44100; },
      get pocetBinu() { return analyzator ? analyzator.frequencyBinCount : 1024; },
      odezvaEq(frekvence) {   // pro test: celková odezva filtrů v dB
        if (!ctx) return null;
        const f = Float32Array.from(frekvence), mag = new Float32Array(f.length), faze = new Float32Array(f.length), soucet = new Float32Array(f.length);
        for (const b of filtry) { b.getFrequencyResponse(f, mag, faze); mag.forEach((m, i) => { soucet[i] += 20 * Math.log10(m); }); }
        return Array.from(soucet);
      }
    };
  }

  window.WA_ZVUK = { vytvor, jeIos, PASMA };
})();

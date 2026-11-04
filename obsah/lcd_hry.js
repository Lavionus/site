/* Společné kreslení a zvuk kapesních LCD her (Retro Vajíčka, Retro Chobotnice).
   Plátno má 3× rozlišení, kreslí se v logických 400 × 300.
   Nesvítící segmenty se kreslí slabě („duchové"), jako na skutečném LCD. */
const LCD = (function () {
  const W = 400, H = 300;
  const TMAVA = '#1d2419', SVETLA = '#b8c3a5';
  const STIN = 0.075, ZAP = 0.9;

  /* sprity: { jmeno: [x, y, w, h] } v archu src (černá/průhledná maska) */
  function plocha(cv, src, sprity, hotovo) {
    const g = cv.getContext('2d');
    g.scale(cv.width / W, cv.height / H);
    const masky = {};
    const obr = new Image();
    obr.onload = () => {
      for (const [k, [x, y, w, h]] of Object.entries(sprity)) {
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const cg = c.getContext('2d');
        cg.drawImage(obr, x, y, w, h, 0, 0, w, h);
        cg.globalCompositeOperation = 'source-in';
        cg.fillStyle = TMAVA; cg.fillRect(0, 0, w, h);
        masky[k] = c;
      }
      hotovo();
    };
    obr.src = src;

    const alfa = on => (on === true ? ZAP : on === false ? STIN : on);

    function smaz() { g.globalAlpha = 1; g.fillStyle = SVETLA; g.fillRect(0, 0, W, H); }

    /* sprite o výšce v; zrcadlit = otočit vodorovně; on = true/false nebo vlastní průhlednost */
    function sprite(jm, x, y, v, zrcadlit, on) {
      const m = masky[jm]; if (!m) return;
      const sirka = v * m.width / m.height;
      g.save(); g.globalAlpha = alfa(on);
      if (zrcadlit) { g.translate(x + sirka, y); g.scale(-1, 1); g.drawImage(m, 0, 0, sirka, v); }
      else g.drawImage(m, x, y, sirka, v);
      g.restore();
    }

    /* libovolný tvar kódem: kresli(g) vyplní cestu barvou LCD */
    function tvar(on, kresli) {
      g.save(); g.globalAlpha = alfa(on); g.fillStyle = TMAVA; g.strokeStyle = TMAVA;
      kresli(g); g.restore();
    }

    function text(t, x, y, on) {
      g.save(); g.font = 'bold 11px monospace'; g.fillStyle = TMAVA; g.globalAlpha = alfa(on);
      g.fillText(t, x, y); g.restore();
    }

    /* sedmisegmentovka s duchy všech segmentů, v = výška číslice */
    const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', ' ': '' };
    function cislice(retez, x, y, v) {
      const s = v * 0.55, t = v * 0.11;
      const segm = { a: [t, 0, s - 2 * t, t], d: [t, v - t, s - 2 * t, t], g: [t, v / 2 - t / 2, s - 2 * t, t],
        f: [0, t, t, v / 2 - 1.5 * t], b: [s - t, t, t, v / 2 - 1.5 * t], e: [0, v / 2 + t / 2, t, v / 2 - 1.5 * t], c: [s - t, v / 2 + t / 2, t, v / 2 - 1.5 * t] };
      g.save(); g.fillStyle = TMAVA;
      [...retez].forEach((ch, i) => {
        const ox = x + i * (s + t * 1.6);
        for (const [k, [a, b, c, d]] of Object.entries(segm)) {
          g.globalAlpha = (SEG[ch] || '').includes(k) ? ZAP : STIN;
          g.fillRect(ox + a, y + b, c, d);
        }
      });
      g.restore();
    }

    return { g, W, H, TMAVA, STIN, ZAP, smaz, sprite, tvar, text, cislice };
  }

  /* Pípák s vypínačem; stav se pamatuje pod klíčem v localStorage. */
  function zvuk(klic, tlacitko) {
    let ac = null, zap = localStorage.getItem(klic) !== '0';
    const ukaz = () => { tlacitko.textContent = zap ? '🔊 Zvuk' : '🔇 Ticho'; };
    tlacitko.onclick = () => { zap = !zap; localStorage.setItem(klic, zap ? '1' : '0'); ukaz(); };
    ukaz();
    return function pip(f, d, typ) {
      if (!zap) return;
      try {
        ac = ac || new AudioContext();
        const o = ac.createOscillator(), z = ac.createGain();
        o.type = typ || 'square'; o.frequency.value = f;
        z.gain.setValueAtTime(0.06, ac.currentTime); z.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + d);
        o.connect(z).connect(ac.destination); o.start(); o.stop(ac.currentTime + d);
      } catch { /* bez zvuku */ }
    };
  }

  /* Krátké „promáčknutí" tlačítka přístroje při stisku klávesy */
  function stiskni(tl) {
    if (!tl) return;
    tl.classList.add('dole'); setTimeout(() => tl.classList.remove('dole'), 110);
  }

  return { plocha, zvuk, stiskni };
})();

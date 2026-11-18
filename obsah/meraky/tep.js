/* Měřáky – tep z prstu přes kameru a svítilnu (fotopletysmografie, výpočet v jadro.js → tepZeSignalu). */
(function () {
  'use strict';
  const M = window.MerakyApp, { J, $, C, barvy, platno } = M;
  const T = { gen: 0, startuje: false, stream: null, track: null, raf: 0, demo: 0, hod: [], cas: [], t0: 0, bpm: [], vysledek: null, posledniVypocet: 0, prst: false };
  const vzorek = document.createElement('canvas'); vzorek.width = 32; vzorek.height = 24;

  function pridej(cerv, zel, t) {
    // prst na objektivu: obraz je skoro celý červený a dost jasný
    T.prst = cerv > 60 && cerv > zel * 1.6;
    if (!T.prst) { T.hod = []; T.cas = []; T.bpm = []; T.t0 = t; T.kanal = null; return; }
    // více krve = méně světla → otočit, ať špička = stah; přesycený červený kanál (svítilna) je plochý → zelený
    if (T.kanal == null && T.hod.length === 0) T.kanal = cerv > 245 ? 'zel' : 'cerv';
    T.hod.push(-(T.kanal === 'zel' ? zel : cerv)); T.cas.push(t);
    while (T.cas.length && T.cas[0] < t - 15) { T.cas.shift(); T.hod.shift(); }
    if (t - T.posledniVypocet > 0.5) {
      T.posledniVypocet = t;
      const r = J.tepZeSignalu(T.hod, T.cas);
      if (r && r.kvalita > 0.3) { T.bpm.push(r.bpm); if (T.bpm.length > 7) T.bpm.shift(); }
      T.kvalita = r ? r.kvalita : 0;
    }
  }
  function kresli() {
    const t = performance.now() / 1000, delka = T.cas.length ? T.cas[T.cas.length - 1] - T.cas[0] : 0;
    const s = T.bpm.slice().sort((a, b) => a - b), bpm = s.length >= 3 && delka >= 8 ? s[s.length >> 1] : null;
    if (T.stream || T.demo) T.vysledek = bpm;        // po zastavení zůstane poslední výsledek
    $('tepVelke').innerHTML = (T.vysledek ? C(T.vysledek, 0) : '—') + '<small>tepů/min</small>';
    $('tepKvalita').textContent = T.prst && T.kvalita != null ? (T.kvalita > 0.6 ? 'dobrá' : T.kvalita > 0.35 ? 'střední' : 'slabá – nehýbejte') : '—';
    $('tepCas').textContent = Math.round(T.prst ? t - T.t0 : 0) + ' s';
    $('tepStav').textContent = !(T.stream || T.demo) ? 'Stiskněte ▶ Měřit a přiložte prst.' : !T.prst ? (T.bezSvetla ? '☝️ Přiložte prst na fotoaparát a namiřte ho proti silnému světlu (lampa, okno) – svítilnu tento prohlížeč nezapne.' : '☝️ Přiložte prst na fotoaparát a svítilnu.') : bpm ? 'Měřím – držte v klidu.' : 'Ladím signál… (asi 10 s)';
    const { x, w, h } = platno($('platnoTep'), $('platnoTep').clientWidth < 500 ? 0.45 : 0.24), B = barvy();
    const n = T.hod.length;
    if (n < 10) return;
    const tKonec = T.cas[n - 1], okno = 6;
    let i0 = 0; while (i0 < n && T.cas[i0] < tKonec - okno) i0++;
    // odečíst klouzavý průměr pro hezčí křivku
    const v = [];
    for (let i = i0; i < n; i++) { let s2 = 0, c = 0; for (let j = Math.max(0, i - 15); j <= Math.min(n - 1, i + 15); j++) { s2 += T.hod[j]; c++; } v.push(T.hod[i] - s2 / c); }
    const max = Math.max(0.5, ...v.map(Math.abs));
    x.strokeStyle = B.danger; x.lineWidth = 2; x.beginPath();
    v.forEach((y, k) => { const X = w * (1 - (tKonec - T.cas[i0 + k]) / okno), Y = h / 2 - y / max * (h / 2 - 6); k ? x.lineTo(X, Y) : x.moveTo(X, Y); });
    x.stroke();
  }
  async function start() {
    stop();
    const gen = ++T.gen; T.startuje = true; $('tepStart').textContent = '⏹ Zastavit';
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return Dialog.chyba('Kamera není dostupná (prohlížeč nebo stránka bez https). Zkuste 🧪 Ukázku.');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 30 } } });
      if (gen !== T.gen) return stream.getTracks().forEach(t => t.stop());
      T.stream = stream; T.startuje = false;
    } catch (e) { if (gen !== T.gen) return; T.startuje = false; return Dialog.chyba('Kameru se nepodařilo spustit (' + e.name + '). Zkontrolujte povolení.'); }
    T.track = T.stream.getVideoTracks()[0];
    const cap = T.track.getCapabilities ? T.track.getCapabilities() : {};
    T.bezSvetla = !cap.torch;
    if (cap.torch) T.track.applyConstraints({ advanced: [{ torch: true }] }).catch(() => { T.bezSvetla = true; });
    const vid = $('tepVideo'); vid.srcObject = T.stream; vid.hidden = false; vid.play().catch(() => {});
    $('tepStart').textContent = '⏹ Zastavit';
    T.t0 = performance.now() / 1000;
    const g = vzorek.getContext('2d', { willReadFrequently: true });
    const smycka = () => {
      T.raf = requestAnimationFrame(smycka);
      if (!vid.videoWidth) return;
      g.drawImage(vid, 0, 0, 32, 24);
      const d = g.getImageData(0, 0, 32, 24).data;
      let r = 0, gg = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; }
      pridej(r / 768, gg / 768, performance.now() / 1000);
      kresli();
    };
    smycka();
  }
  function demo() {
    stop();
    $('tepDemo').hidden = false; $('tepStart').textContent = '⏹ Zastavit';
    T.t0 = performance.now() / 1000;
    T.demo = setInterval(() => {
      const t = performance.now() / 1000, faze = (t * 68 / 60) % 1;
      const puls = Math.exp(-((faze - 0.15) ** 2) / 0.004) + 0.35 * Math.exp(-((faze - 0.45) ** 2) / 0.01);
      pridej(200 - 2.2 * puls + Math.sin(t / 3) + (Math.random() - 0.5) * 0.3, 40, t);
      kresli();
    }, 33);
  }
  function stop() {
    T.gen++; T.startuje = false;
    cancelAnimationFrame(T.raf); clearInterval(T.demo); T.demo = 0;
    if (T.track) T.track.applyConstraints({ advanced: [{ torch: false }] }).catch(() => {});
    if (T.stream) setTimeout((s => () => s.getTracks().forEach(t => t.stop()))(T.stream), 150);
    Object.assign(T, { stream: null, track: null, hod: [], cas: [], bpm: [], prst: false, kvalita: null, kanal: null, bezSvetla: false });
    $('tepVideo').hidden = true; $('tepVideo').srcObject = null; $('tepDemo').hidden = true;
    $('tepStart').textContent = '▶ Měřit';
  }
  $('tepStart').addEventListener('click', () => (T.stream || T.demo || T.startuje) ? stop() : start());
  $('tepDemoTl').addEventListener('click', demo);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  M.registruj('tep', {
    start: kresli,
    stop,
    zapis: () => T.vysledek ? { hodnota: C(T.vysledek, 0) + ' tepů/min', detail: 'kvalita ' + $('tepKvalita').textContent + ' · ' + $('tepCas').textContent } : null
  });
})();

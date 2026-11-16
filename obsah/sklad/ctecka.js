/* Čtečka EAN kamerou (BarcodeDetector, jinak zxing z lib/) nebo opisem čísla – převzato ze Zásob.
   Použití: SkladCtecka(kod => …). */
(function () {
'use strict';
const J = window.SkladJadro;
window.SkladCtecka = (() => {
  const ZXING_JS = 'lib/zxing/zxing-reader.js', ZXING_WASM = 'lib/zxing/zxing_reader.wasm';
  let okno = null, video = null, stavEl = null, proud = null, smycka = null, detektor = null, naKod = null, seance = 0;
  const platno = document.createElement('canvas');
  async function pripravDetektor() {
    if (detektor) return detektor;
    if ('BarcodeDetector' in window) {
      try {
        const podp = await window.BarcodeDetector.getSupportedFormats();
        if (podp.includes('ean_13')) {
          const d = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'].filter(x => podp.includes(x)) });
          return (detektor = { cti: async zdroj => (await d.detect(zdroj)).map(r => r.rawValue) });
        }
      } catch (_) { /* zxing */ }
    }
    await new Promise((ok, chyba) => {
      if (window.ZXingWASM) return ok();
      const s = document.createElement('script'); s.src = ZXING_JS;
      s.onload = () => window.ZXingWASM ? ok() : chyba(new Error('Čtečku se nepodařilo načíst.'));
      s.onerror = () => { s.remove(); chyba(new Error('Čtečku se nepodařilo stáhnout (offline?).')); };
      document.head.appendChild(s);
    });
    const Z = window.ZXingWASM, wasm = new URL(ZXING_WASM, location.href).href;
    Z.prepareZXingModule({ overrides: { locateFile: (c, prefix) => c.endsWith('.wasm') ? wasm : prefix + c } });
    return (detektor = {
      cti: async zdroj => {
        // střední pás obrazu, nejvýš 1280 px široký
        const sw = zdroj.videoWidth * 0.86, sh = zdroj.videoHeight * 0.5, m = Math.min(1, 1280 / sw);
        platno.width = Math.round(sw * m); platno.height = Math.round(sh * m);
        const c = platno.getContext('2d', { willReadFrequently: true });
        c.drawImage(zdroj, (zdroj.videoWidth - sw) / 2, (zdroj.videoHeight - sh) / 2, sw, sh, 0, 0, platno.width, platno.height);
        const r = await Z.readBarcodes(c.getImageData(0, 0, platno.width, platno.height), { formats: ['EAN13', 'EAN8', 'UPCA', 'UPCE'], tryHarder: true, maxNumberOfSymbols: 1 });
        return r.filter(x => x.isValid !== false).map(x => x.text);
      }
    });
  }
  function zprava(t, chyba) { stavEl.textContent = t; stavEl.classList.toggle('chyba', !!chyba); }
  function vytvor() {
    okno = document.createElement('div');
    okno.className = 'ctecka'; okno.hidden = true; okno.setAttribute('role', 'dialog'); okno.setAttribute('aria-modal', 'true'); okno.setAttribute('aria-label', 'Čtečka čárových kódů');
    okno.innerHTML = `<div class="ctecka-hlava"><strong>Naskenuj čárový kód</strong><button type="button" class="btn ctecka-zavri" aria-label="Zavřít čtečku">✕</button></div>
      <div class="ctecka-obraz"><video playsinline muted autoplay></video><div class="ctecka-ramecek" aria-hidden="true"></div></div>
      <p class="ctecka-stav" aria-live="polite">Spouštím kameru…</p>
      <form class="ctecka-rucne"><input type="text" inputmode="numeric" autocomplete="off" maxlength="16" placeholder="nebo opiš číslo pod kódem" aria-label="Číslo čárového kódu" class="vstup"><button type="submit" class="btn">Použít</button></form>`;
    document.body.appendChild(okno);
    video = okno.querySelector('video'); stavEl = okno.querySelector('.ctecka-stav');
    okno.querySelector('.ctecka-zavri').addEventListener('click', zavri);
    okno.querySelector('.ctecka-rucne').addEventListener('submit', e => {
      e.preventDefault();
      const s = e.target.querySelector('input').value.replace(/\D/g, '');
      if (!s) return;
      if (!J.eanKontrola(s)) return zprava('Číslo ' + s + ' nemá platnou kontrolní číslici – zkontroluj opis.', true);
      nalezeno(s);
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && okno && !okno.hidden) { e.preventDefault(); zavri(); } }, true);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && okno && !okno.hidden) zavri(); });
  }
  let posledni = { kod: null, cas: 0 };
  async function cykl() {
    smycka = null;
    if (!okno || okno.hidden) return;
    const moje = seance;
    if (video.readyState >= 2 && video.videoWidth) {
      try {
        for (const t of await detektor.cti(video)) {
          const k = String(t).replace(/\D/g, '');
          if (moje !== seance) return;
          if (!J.eanKontrola(k)) continue;
          const ted = Date.now();   // dvě shodná čtení po sobě = odolnost proti chybě jedné čárky
          if (posledni.kod === k && ted - posledni.cas < 2000) return nalezeno(k);
          posledni = { kod: k, cas: ted };
        }
      } catch (e) { if (moje === seance) zprava('Chyba čtečky: ' + e.message, true); }
    }
    if (moje === seance && okno && !okno.hidden) smycka = setTimeout(cykl, 120);
  }
  function nalezeno(kod) {
    try { if (navigator.vibrate) navigator.vibrate(60); } catch (_) {}
    const cb = naKod; zavri(); if (cb) cb(kod);
  }
  function zastavKameru() { if (proud) { proud.getTracks().forEach(t => t.stop()); proud = null; } if (video) video.srcObject = null; }
  async function otevri(cb) {
    if (!okno) vytvor();
    naKod = cb; const moje = ++seance; posledni = { kod: null, cas: 0 };
    okno.hidden = false; okno.querySelector('.ctecka-rucne input').value = '';
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return zprava(window.isSecureContext === false ? 'Kamera funguje jen přes https. Opiš číslo pod kódem.' : 'Tento prohlížeč neumí kameru. Opiš číslo pod kódem.', true);
    }
    try {
      zprava('Spouštím kameru…');
      const [s] = await Promise.all([navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } }), pripravDetektor()]);
      if (moje !== seance) { s.getTracks().forEach(t => t.stop()); return; }
      proud = s; video.srcObject = s; await video.play().catch(() => {});
      zprava('Namiř kameru na čárový kód'); cykl();
    } catch (e) {
      if (moje !== seance) return;
      const n = e && e.name;
      zprava((n === 'NotAllowedError' || n === 'SecurityError' ? 'Přístup ke kameře je zakázaný – povol ho v prohlížeči.' : n === 'NotFoundError' ? 'Zařízení nemá kameru.' : n === 'NotReadableError' ? 'Kameru používá jiná aplikace.' : (e && e.message) || 'Kameru se nepodařilo spustit.') + ' Číslo můžeš opsat.', true);
      zastavKameru();
    }
  }
  function zavri() {
    if (!okno) return;
    seance++; okno.hidden = true;
    if (smycka) { clearTimeout(smycka); smycka = null; }
    zastavKameru();
  }
  return otevri;
})();
})();

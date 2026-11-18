/* Čtenářský deník – čtečka čárového kódu ISBN (EAN-13 978/979) kamerou nebo z fotky.
   Postup převzatý z Deníku jídla (potraviny/ctecka.js) a Zásob: nativní BarcodeDetector,
   jinak líně načtený zxing-wasm z lib/zxing (MIT, nad zxing-cpp Apache 2.0).
     CtenarCtecka.otevri(kod => …)   kod = platné ISBN-13
     CtenarCtecka.zFotky(soubor) → Promise<ISBN-13|null> */
(function () {
  'use strict';
  const J = window.CtenarJadro;
  const ZXING_JS = 'lib/zxing/zxing-reader.js', ZXING_WASM = 'lib/zxing/zxing_reader.wasm';
  let okno = null, video = null, stavEl = null, proud = null, smycka = null, detektor = null, naKod = null, seance = 0;
  const platno = document.createElement('canvas');

  async function pripravDetektor() {
    if (detektor) return detektor;
    if ('BarcodeDetector' in window) {
      try {
        const podp = await window.BarcodeDetector.getSupportedFormats();
        if (podp.includes('ean_13')) {
          const d = new window.BarcodeDetector({ formats: ['ean_13'] });
          return (detektor = { nativni: true, cti: async zdroj => (await d.detect(zdroj)).map(r => r.rawValue) });
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
      cti: async (zdroj, sirka, vyska, vyrez) => {
        // video: střední pás obrazu; fotka: celý obraz. Nejvýš 1280 px široký.
        const sw = sirka * (vyrez ? 0.86 : 1), sh = vyska * (vyrez ? 0.5 : 1), m = Math.min(1, 1280 / sw);
        platno.width = Math.max(1, Math.round(sw * m)); platno.height = Math.max(1, Math.round(sh * m));
        const c = platno.getContext('2d', { willReadFrequently: true });
        c.drawImage(zdroj, (sirka - sw) / 2, (vyska - sh) / 2, sw, sh, 0, 0, platno.width, platno.height);
        const r = await Z.readBarcodes(c.getImageData(0, 0, platno.width, platno.height), { formats: ['EAN13'], tryHarder: true, maxNumberOfSymbols: 2 });
        return r.filter(x => x.isValid !== false).map(x => x.text);
      }
    });
  }
  const isbn = t => { const s = String(t).replace(/\D/g, ''); return J.isbn13Platne(s) ? s : null; };

  async function zFotky(soubor) {
    const d = await pripravDetektor();
    const obr = await createImageBitmap(soubor);
    try {
      for (const t of await d.cti(obr, obr.width, obr.height, false)) { const k = isbn(t); if (k) return k; }
      return null;
    } finally { obr.close(); }
  }

  function zprava(t, chyba) { stavEl.textContent = t; stavEl.classList.toggle('chyba', !!chyba); }
  function vytvor() {
    okno = document.createElement('div');
    okno.className = 'ctecka'; okno.hidden = true;
    okno.setAttribute('role', 'dialog'); okno.setAttribute('aria-modal', 'true'); okno.setAttribute('aria-label', 'Čtečka ISBN');
    okno.innerHTML = `<div class="ctecka-hlava"><strong>Naskenuj čárový kód ISBN</strong><button type="button" class="btn ctecka-zavri" aria-label="Zavřít čtečku">✕</button></div>
      <div class="ctecka-obraz"><video playsinline muted autoplay></video><div class="ctecka-ramecek" aria-hidden="true"></div></div>
      <p class="ctecka-stav" aria-live="polite">Spouštím kameru…</p>
      <div class="ctecka-ovladani"><button type="button" class="btn ctecka-foto">🖼️ Z fotky</button><input type="file" accept="image/*" hidden></div>
      <form class="ctecka-rucne"><input type="text" inputmode="numeric" autocomplete="off" maxlength="20" placeholder="nebo opiš ISBN (10 nebo 13 znaků)" aria-label="ISBN" class="vstup"><button type="submit" class="btn">Použít</button></form>`;
    document.body.appendChild(okno);
    video = okno.querySelector('video'); stavEl = okno.querySelector('.ctecka-stav');
    okno.querySelector('.ctecka-zavri').addEventListener('click', zavri);
    const soubor = okno.querySelector('input[type=file]');
    okno.querySelector('.ctecka-foto').addEventListener('click', () => soubor.click());
    soubor.addEventListener('change', async () => {
      const f = soubor.files[0]; soubor.value = '';
      if (!f) return;
      zprava('Hledám kód na fotce…');
      try { const k = await zFotky(f); if (k) nalezeno(k); else zprava('Na fotce jsem ISBN nenašel – zkus ostřejší snímek zblízka.', true); }
      catch (e) { zprava(e.message, true); }
    });
    okno.querySelector('.ctecka-rucne').addEventListener('submit', e => {
      e.preventDefault();
      const r = J.rozborIsbn(e.target.querySelector('input').value);
      if (!r.isbn13) return zprava('ISBN: ' + r.chyba + '.', true);
      nalezeno(r.isbn13);
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && okno && !okno.hidden && !document.querySelector('dialog[open]')) { e.preventDefault(); zavri(); } }, true);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && okno && !okno.hidden) zastavKameru(); });
  }
  let posledni = { kod: null, cas: 0 };
  async function cykl() {
    smycka = null;
    if (!okno || okno.hidden) return;
    const moje = seance;
    if (proud && video.readyState >= 2 && video.videoWidth) {
      try {
        let texty;
        if (detektor.nativni) {
          // střední pás i u nativního detektoru – kód vedle (EAN-5 s cenou) se tak méně plete
          const sw = video.videoWidth * 0.86, sh = video.videoHeight * 0.5;
          platno.width = Math.round(sw); platno.height = Math.round(sh);
          platno.getContext('2d').drawImage(video, (video.videoWidth - sw) / 2, (video.videoHeight - sh) / 2, sw, sh, 0, 0, platno.width, platno.height);
          texty = await detektor.cti(platno);
        } else texty = await detektor.cti(video, video.videoWidth, video.videoHeight, true);
        if (moje !== seance) return;
        for (const t of texty) {
          const s = String(t).replace(/\D/g, '');
          if (!isbn(s)) { if (/^\d{13}$/.test(s)) zprava('Kód ' + s + ' není ISBN (knihy mají 978/979). Hledej kód s ISBN na zadní straně.', true); continue; }
          const ted = Date.now();   // dvě shodná čtení po sobě = odolnost proti chybě jedné čárky
          if (posledni.kod === s && ted - posledni.cas < 2000) return nalezeno(s);
          posledni = { kod: s, cas: ted };
        }
      } catch (e) { if (moje === seance) zprava('Chyba čtečky: ' + e.message, true); }
    }
    if (moje === seance && okno && !okno.hidden) smycka = setTimeout(cykl, detektor && detektor.nativni ? 90 : 140);
  }
  function nalezeno(kod) {
    try { if (navigator.vibrate) navigator.vibrate(60); } catch (_) { /* nic */ }
    const cb = naKod; zavri(); if (cb) cb(kod);
  }
  function zastavKameru() { if (proud) { proud.getTracks().forEach(t => t.stop()); proud = null; } if (video) video.srcObject = null; }
  async function otevri(cb) {
    if (!okno) vytvor();
    naKod = cb; const moje = ++seance; posledni = { kod: null, cas: 0 };
    okno.hidden = false; okno.querySelector('.ctecka-rucne input').value = '';
    okno.querySelector('.ctecka-zavri').focus();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return zprava(window.isSecureContext === false ? 'Kamera funguje jen přes https. Vyfoť kód nebo opiš ISBN.' : 'Tento prohlížeč neumí kameru. Vyfoť kód nebo opiš ISBN.', true);
    }
    try {
      zprava('Spouštím kameru…');
      const [s] = await Promise.all([navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } }), pripravDetektor()]);
      if (moje !== seance) { s.getTracks().forEach(t => t.stop()); return; }
      proud = s; video.srcObject = s; await video.play().catch(() => {});
      zprava('Namiř kameru na čárový kód s ISBN (zadní strana obálky)'); cykl();
    } catch (e) {
      if (moje !== seance) return;
      const n = e && e.name;
      zprava((n === 'NotAllowedError' || n === 'SecurityError' ? (window.top !== window ? 'Kamera je v rámu zablokovaná – povol ji, nebo otevři stránku samostatně.' : 'Přístup ke kameře je zakázaný – povol ho v prohlížeči.')
        : n === 'NotFoundError' || n === 'OverconstrainedError' ? 'Zařízení nemá kameru.' : n === 'NotReadableError' ? 'Kameru používá jiná aplikace.' : (e && e.message) || 'Kameru se nepodařilo spustit.') + ' Kód můžeš vyfotit nebo ISBN opsat.', true);
      zastavKameru();
    }
  }
  function zavri() {
    if (!okno) return;
    seance++; okno.hidden = true;
    if (smycka) { clearTimeout(smycka); smycka = null; }
    zastavKameru();
  }
  window.CtenarCtecka = { otevri, zavri, zFotky };
})();

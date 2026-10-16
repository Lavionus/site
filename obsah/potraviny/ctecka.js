/* ============================================================
   potraviny/ctecka.js – čtení čárových kódů (EAN-13/8, UPC) kamerou
   nebo z fotky. Použije nativní BarcodeDetector, kde ho prohlížeč
   umí s formátem EAN; jinak líně načte zxing-wasm (lib/zxing, MIT).

     DENIK_CTECKA.otevri({ naKod: async (kod, sezeni) => true|false, titulek })
        naKod vrací true = hotovo (zavřít), false = číst dál
     DENIK_CTECKA.zavri()
     DENIK_CTECKA.sezeni()  → číslo aktuálního otevření (mění se při každém otevření/zavření)
     DENIK_CTECKA.zFotky(file) → Promise<kód|null>
   ============================================================ */
(function () {
  'use strict';
  const J = window.DENIK_JADRO;
  const FORMATY_NATIVNI = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];
  const FORMATY_ZXING = ['EAN13', 'EAN8', 'UPCA', 'UPCE'];
  const ZXING_JS = 'lib/zxing/zxing-reader.js';
  const ZXING_WASM = 'lib/zxing/zxing_reader.wasm';

  let okno = null, video = null, stavEl = null, proud = null, smycka = null;
  let detektor = null;      // { druh, cti: async (zdroj) → [{text}] }
  let detektorSlib = null;
  let zxingSlib = null;
  // každé otevření a zavření zvýší číslo sezení; asynchronní kroky, které doběhnou
  // po zavření (getUserMedia, online dotaz), podle něj poznají, že už nemají nic dělat
  let seance = 0;

  /* ---------- dekodéry ---------- */
  async function nativni() {
    if (!('BarcodeDetector' in window)) return null;
    try {
      const podp = await window.BarcodeDetector.getSupportedFormats();
      const f = FORMATY_NATIVNI.filter(x => podp.includes(x));
      if (!f.includes('ean_13')) return null;
      const d = new window.BarcodeDetector({ formats: f });
      return { druh: 'nativní', cti: async zdroj => (await d.detect(zdroj)).map(r => ({ text: r.rawValue })) };
    } catch (_) { return null; }
  }
  function nactiZxing() {
    if (zxingSlib) return zxingSlib;
    zxingSlib = new Promise((hotovo, chyba) => {
      if (window.ZXingWASM) return hotovo(window.ZXingWASM);
      const s = document.createElement('script');
      s.src = ZXING_JS;
      s.onload = () => window.ZXingWASM ? hotovo(window.ZXingWASM) : chyba(new Error('Čtečku se nepodařilo načíst.'));
      s.onerror = () => { s.remove(); chyba(new Error('Čtečku se nepodařilo stáhnout (jsi offline?).')); };
      document.head.appendChild(s);
    }).then(Z => {
      const wasm = new URL(ZXING_WASM, location.href).href;
      Z.prepareZXingModule({ overrides: { locateFile: (cesta, prefix) => cesta.endsWith('.wasm') ? wasm : prefix + cesta } });
      return Z;
    }).catch(e => { zxingSlib = null; throw e; }); // příští pokus zkusí načíst znovu
    return zxingSlib;
  }
  async function zxing() {
    const Z = await nactiZxing();
    return {
      druh: 'zxing',
      cti: async obr => (await Z.readBarcodes(obr, { formats: FORMATY_ZXING, tryHarder: true, maxNumberOfSymbols: 1 }))
        .filter(r => r.isValid !== false).map(r => ({ text: r.text })),
    };
  }
  // detektor QR kódů (přenos dat mezi zařízeními): nativní, jinak zxing
  async function qrDetektor() {
    if ('BarcodeDetector' in window) {
      try {
        if ((await window.BarcodeDetector.getSupportedFormats()).includes('qr_code')) {
          const d = new window.BarcodeDetector({ formats: ['qr_code'] });
          return { druh: 'nativní', cti: async zdroj => (await d.detect(zdroj)).map(r => ({ text: r.rawValue })) };
        }
      } catch (_) { /* zxing */ }
    }
    const Z = await nactiZxing();
    return {
      druh: 'zxing',
      cti: async obr => (await Z.readBarcodes(obr, { formats: ['QRCode'], tryHarder: false, maxNumberOfSymbols: 1 }))
        .filter(r => r.isValid !== false).map(r => ({ text: r.text })),
    };
  }
  function pripravDetektor() {
    if (detektor) return Promise.resolve(detektor);
    if (!detektorSlib) {
      detektorSlib = (async () => (await nativni()) || (await zxing()))()
        .then(d => (detektor = d))
        .catch(e => { detektorSlib = null; throw e; });
    }
    return detektorSlib;
  }

  // snímek z videa nebo obrázku → plátno a ImageData (pro zxing); výřez = střední pás
  function snimek(platno, zdroj, sirka, vyska, vyrez) {
    let sx = 0, sy = 0, sw = sirka, sh = vyska;
    if (vyrez) { sw = sirka * 0.86; sh = vyska * 0.5; sx = (sirka - sw) / 2; sy = (vyska - sh) / 2; }
    const meritko = Math.min(1, 1280 / sw);
    platno.width = Math.max(1, Math.round(sw * meritko)); platno.height = Math.max(1, Math.round(sh * meritko));
    const c = platno.getContext('2d', { willReadFrequently: true });
    c.drawImage(zdroj, sx, sy, sw, sh, 0, 0, platno.width, platno.height);
    return c.getImageData(0, 0, platno.width, platno.height);
  }
  // video a fotka mají každé své plátno – souběh by jinak četl cizí obraz
  const platnoVideo = document.createElement('canvas');
  async function precti(platno, zdroj, sirka, vyska, vyrez) {
    const d = await pripravDetektor();
    if (d.druh === 'nativní') {
      if (vyrez) { snimek(platno, zdroj, sirka, vyska, true); return d.cti(platno); }
      return d.cti(zdroj);
    }
    return d.cti(snimek(platno, zdroj, sirka, vyska, vyrez));
  }
  function platny(text) {
    const s = String(text || '').replace(/\D/g, '');
    return J.eanKontrola(s) ? s : null;
  }

  /* ---------- čtení z fotky ---------- */
  async function zFotky(soubor) {
    const obr = await nactiObrazek(soubor);
    const platno = document.createElement('canvas');
    try {
      const w = obr.width, h = obr.height;
      for (const vyrez of [false, true]) {
        const r = await precti(platno, obr, w, h, vyrez);
        for (const x of r) { const k = platny(x.text); if (k) return k; }
      }
      return null;
    } finally {
      if (obr.close) obr.close();
      if (obr._url) URL.revokeObjectURL(obr._url);
    }
  }
  function nactiObrazek(soubor) {
    if (window.createImageBitmap) return createImageBitmap(soubor);
    return new Promise((ok, chyba) => {
      const img = new Image();
      img._url = URL.createObjectURL(soubor);
      img.onload = () => ok(img);
      img.onerror = () => { URL.revokeObjectURL(img._url); chyba(new Error('Obrázek nejde načíst.')); };
      img.src = img._url;
    });
  }

  /* ---------- okno čtečky ---------- */
  function vytvorOkno() {
    okno = document.createElement('div');
    okno.className = 'ctecka';
    okno.hidden = true;
    okno.setAttribute('role', 'dialog');
    okno.setAttribute('aria-modal', 'true');
    okno.setAttribute('aria-label', 'Čtečka čárových kódů');
    okno.innerHTML = `
      <div class="ctecka-hlava">
        <strong class="ctecka-titulek">Naskenuj čárový kód</strong>
        <button type="button" class="btn ctecka-zavri" aria-label="Zavřít čtečku">✕</button>
      </div>
      <div class="ctecka-obraz">
        <video playsinline muted autoplay></video>
        <div class="ctecka-ramecek" aria-hidden="true"><span class="ctecka-laser"></span></div>
      </div>
      <p class="ctecka-stav" aria-live="polite">Spouštím kameru…</p>
      <div class="ctecka-ovladani">
        <button type="button" class="btn ctecka-svetlo" hidden aria-pressed="false">🔦 Svítilna</button>
        <button type="button" class="btn ctecka-kamera" hidden>🔄 Jiná kamera</button>
        <button type="button" class="btn ctecka-foto">🖼️ Z fotky</button>
        <input type="file" accept="image/*" class="ctecka-soubor sr" tabindex="-1" aria-hidden="true">
      </div>
      <form class="ctecka-rucne">
        <input type="text" inputmode="numeric" autocomplete="off" pattern="[0-9 ]*" maxlength="16"
               placeholder="nebo opiš číslo pod kódem" aria-label="Číslo čárového kódu" class="vstup">
        <button type="submit" class="btn primary">Hledat</button>
      </form>`;
    document.body.appendChild(okno);
    video = okno.querySelector('video');
    stavEl = okno.querySelector('.ctecka-stav');
    okno.querySelector('.ctecka-zavri').addEventListener('click', zavri);
    // Escape kdekoli (i když je fokus na videu nebo na body)
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && jeOtevrena() && !document.querySelector('dialog[open]')) { e.preventDefault(); e.stopPropagation(); zavri(); }
    }, true);
    // past fokusu: Tab neodejde do stránky pod čtečkou
    okno.addEventListener('keydown', e => {
      if (e.key !== 'Tab') return;
      const prvky = [...okno.querySelectorAll('button:not([hidden]), input:not([tabindex="-1"])')].filter(x => x.offsetParent !== null);
      if (!prvky.length) return;
      const i = prvky.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); prvky[prvky.length - 1].focus(); }
      else if (!e.shiftKey && i === prvky.length - 1) { e.preventDefault(); prvky[0].focus(); }
    });
    const soubor = okno.querySelector('.ctecka-soubor');
    okno.querySelector('.ctecka-foto').addEventListener('click', () => {
      // na mobilu výběr fotky/fotoaparát skryje stránku – čtečka se kvůli tomu nesmí zavřít
      vybiraFotku = true;
      soubor.click();
      // zrušený výběr nevyvolá change; návrat do okna ano
      addEventListener('focus', () => setTimeout(() => { if (vybiraFotku && !soubor.files.length) { vybiraFotku = false; obnovKameru(); } }, 600), { once: true });
    });
    soubor.addEventListener('change', async e => {
      vybiraFotku = false;
      const f = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!f || zpracovavaKod) { obnovKameru(); return; }
      const moje = seance;
      zprava('Hledám kód na fotce…');
      try {
        const k = await zFotky(f);
        if (moje !== seance) return;
        if (k) await nalezeno(k);
        else { zprava('Na fotce jsem kód nenašel. Zkus ostřejší snímek zblízka a rovně.', true); obnovKameru(); }
      } catch (err) { if (moje === seance) { zprava(err.message, true); obnovKameru(); } }
    });
    okno.querySelector('.ctecka-rucne').addEventListener('submit', async e => {
      e.preventDefault();
      if (zpracovavaKod) return;
      const inp = e.target.querySelector('input');
      const s = inp.value.replace(/\D/g, '');
      if (!s) return;
      if (!J.eanKontrola(s)) { zprava('Číslo ' + s + ' nemá platnou kontrolní číslici – zkontroluj opis.', true); return; }
      inp.value = '';
      await nalezeno(s);
    });
    okno.querySelector('.ctecka-svetlo').addEventListener('click', async e => {
      const t = proud && proud.getVideoTracks()[0];
      if (!t) return;
      const tl = e.currentTarget;
      const zap = tl.getAttribute('aria-pressed') !== 'true';
      try { await t.applyConstraints({ advanced: [{ torch: zap }] }); tl.setAttribute('aria-pressed', String(zap)); }
      catch (_) { zprava('Svítilnu se nepodařilo zapnout.', true); }
    });
    okno.querySelector('.ctecka-kamera').addEventListener('click', prepniKameru);
    // skrytá stránka (přepnutí aplikace, zhasnutý displej) → kameru vypnout; při výběru fotky jen uvolnit kameru
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'hidden' || !jeOtevrena()) return;
      if (vybiraFotku) zastavKameru(); else zavri();
    });
    addEventListener('pagehide', () => { if (jeOtevrena()) zavri(); });
  }

  let volby = null, kamery = [], kameraI = 0, pozastaveno = false, posledni = { kod: null, cas: 0 };
  let ctePrave = false, zpracovavaKod = false, vybiraFotku = false, prepina = false;
  // znovu spustit kameru po výběru fotky (pokud ji mezitím uvolnil systém)
  async function obnovKameru() {
    if (!jeOtevrena() || proud || !navigator.mediaDevices) return;
    const moje = seance;
    try {
      await spustKameru(kamery[kameraI] && kamery[kameraI].deviceId);
      if (moje === seance) { pozastaveno = false; if (!smycka) cykl(); }
    } catch (_) { /* zůstane fotka a ruční zadání */ }
  }

  function zprava(t, chyba) {
    if (!stavEl) return;
    stavEl.textContent = t;
    stavEl.classList.toggle('chyba', !!chyba);
  }

  async function spustKameru(deviceId) {
    const moje = seance;
    zastavKameru();
    const omezeni = {
      audio: false,
      video: deviceId ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
        : { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
    };
    const s = await navigator.mediaDevices.getUserMedia(omezeni);
    if (moje !== seance || !jeOtevrena()) { s.getTracks().forEach(t => t.stop()); throw Object.assign(new Error('zavřeno'), { name: 'Zavreno' }); }
    proud = s;
    video.srcObject = proud;
    await video.play().catch(() => {});
    const t = proud.getVideoTracks()[0];
    const sch = t && t.getCapabilities ? t.getCapabilities() : {};
    const svetlo = okno.querySelector('.ctecka-svetlo');
    svetlo.hidden = !sch.torch;
    svetlo.setAttribute('aria-pressed', 'false');
    try {
      if (sch.focusMode && sch.focusMode.includes('continuous')) await t.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
    } catch (_) { /* nepodstatné */ }
    try {
      kamery = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');
      okno.querySelector('.ctecka-kamera').hidden = kamery.length < 2;
      const nast = t.getSettings ? t.getSettings() : {};
      const i = kamery.findIndex(k => k.deviceId === nast.deviceId);
      if (i >= 0) kameraI = i;
    } catch (_) { /* bez výčtu kamer */ }
  }
  async function prepniKameru() {
    if (kamery.length < 2 || prepina) return;   // dvojklik by spustil dva proudy a jeden by zůstal běžet
    prepina = true;
    const tl = okno.querySelector('.ctecka-kamera');
    tl.disabled = true;
    kameraI = (kameraI + 1) % kamery.length;
    try { await spustKameru(kamery[kameraI].deviceId); zprava('Namiř kameru na čárový kód'); }
    catch (e) { if (e.name !== 'Zavreno') zprava('Kameru se nepodařilo přepnout: ' + e.message, true); }
    finally { prepina = false; tl.disabled = false; }
  }
  function zastavKameru() {
    if (proud) { proud.getTracks().forEach(t => t.stop()); proud = null; }
    if (video) video.srcObject = null;
  }

  async function cykl() {
    smycka = null;
    if (!jeOtevrena()) return;
    const moje = seance;
    if (!pozastaveno && !ctePrave && !zpracovavaKod && video.readyState >= 2 && video.videoWidth) {
      ctePrave = true;
      try {
        const r = await precti(platnoVideo, video, video.videoWidth, video.videoHeight, true);
        if (moje !== seance) return;
        for (const x of r) {
          const k = platny(x.text);
          if (!k) continue;
          const ted = Date.now();
          // dvě shodná čtení za sebou → odolnost proti chybnému přečtení jedné čárky
          if (posledni.kod === k && ted - posledni.cas < 2000) { posledni = { kod: null, cas: 0 }; await nalezeno(k); break; }
          posledni = { kod: k, cas: ted };
        }
      } catch (e) {
        if (moje === seance) { zprava('Chyba čtečky: ' + e.message, true); pozastaveno = true; }
      } finally { ctePrave = false; }
    }
    if (jeOtevrena() && moje === seance && !smycka) smycka = setTimeout(cykl, detektor && detektor.druh === 'nativní' ? 90 : 140);
  }

  async function nalezeno(kod) {
    if (zpracovavaKod) return;
    zpracovavaKod = true;
    const moje = seance;
    pozastaveno = true;
    try { if (navigator.vibrate) navigator.vibrate(60); } catch (_) { /* nic */ }
    pipni();
    zprava('Kód ' + kod + ' – hledám…');
    let hotovo = false;
    try { hotovo = await volby.naKod(kod, moje); } catch (e) { if (moje === seance) zprava(e.message, true); }
    finally { zpracovavaKod = false; }
    if (moje !== seance) return;          // mezitím zavřeno nebo otevřeno znovu
    if (hotovo) zavri();
    else if (jeOtevrena()) setTimeout(() => { if (moje === seance) pozastaveno = false; }, 1200);
  }

  let audio = null;
  function pipni() {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const o = audio.createOscillator(), g = audio.createGain();
      o.frequency.value = 1760; g.gain.value = 0.06;
      o.connect(g); g.connect(audio.destination);
      o.start(); o.stop(audio.currentTime + 0.08);
    } catch (_) { /* bez zvuku */ }
  }

  let predchoziFokus = null;
  async function otevri(v) {
    volby = v || {};
    if (!okno) vytvorOkno();
    if (jeOtevrena()) zavri();
    const moje = ++seance;
    predchoziFokus = document.activeElement;
    okno.querySelector('.ctecka-titulek').textContent = volby.titulek || 'Naskenuj čárový kód';
    okno.hidden = false;
    document.documentElement.classList.add('ctecka-otevrena');
    pozastaveno = false; posledni = { kod: null, cas: 0 }; zpracovavaKod = false;
    okno.querySelector('.ctecka-zavri').focus();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      zprava(window.isSecureContext === false
        ? 'Kamera funguje jen přes zabezpečené připojení (https). Použij fotku nebo opiš číslo.'
        : 'Tento prohlížeč neumí kameru. Použij fotku nebo opiš číslo.', true);
      return;
    }
    try {
      zprava('Spouštím kameru…');
      await Promise.all([spustKameru(), pripravDetektor()]);
      if (moje !== seance) return;
      zprava('Namiř kameru na čárový kód');
      cykl();
    } catch (e) {
      if (moje !== seance || (e && e.name === 'Zavreno')) return;
      const nazev = e && e.name;
      let t = 'Kameru se nepodařilo spustit.';
      if (nazev === 'NotAllowedError' || nazev === 'SecurityError') {
        t = window.top !== window
          ? 'Přístup ke kameře je zablokovaný. Povol kameru v prohlížeči, nebo otevři Deník v samostatném okně (odkaz v patičce).'
          : 'Přístup ke kameře je zakázaný – povol ho v nastavení prohlížeče (ikona zámku u adresy).';
      } else if (nazev === 'NotFoundError' || nazev === 'OverconstrainedError') t = 'Zařízení nemá kameru.';
      else if (nazev === 'NotReadableError') t = 'Kameru právě používá jiná aplikace.';
      else if (e && e.message) t = e.message;
      zprava(t + ' Kód můžeš i vyfotit nebo opsat.', true);
      zastavKameru();
    }
  }
  function zavri() {
    if (!okno) return;
    seance++;
    okno.hidden = true;
    document.documentElement.classList.remove('ctecka-otevrena');
    if (smycka) { clearTimeout(smycka); smycka = null; }
    zastavKameru();
    const f = predchoziFokus; predchoziFokus = null;
    if (f && document.contains(f) && f.focus) try { f.focus(); } catch (_) { /* nic */ }
    if (volby && typeof volby.priZavreni === 'function') try { volby.priZavreni(); } catch (_) { /* nic */ }
  }
  function jeOtevrena() { return !!(okno && !okno.hidden); }

  window.DENIK_CTECKA = { otevri, zavri, zFotky, jeOtevrena, pripravDetektor, qrDetektor, sezeni: () => seance };
})();

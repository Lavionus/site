/* ============================================================
   potraviny/etiketa.js – přečtení tabulky výživových údajů z fotky
   etikety. Tesseract.js (Apache 2.0, lib/tesseract) s českým modelem
   se načte až při prvním použití; fotka se zpracuje jen v prohlížeči.
   Rozbor přečteného textu je v jadro.js (rozeberEtiketu).
   ============================================================ */
(function () {
  'use strict';
  const KNIHOVNA = 'lib/tesseract/';
  let slib = null;
  function nactiTesseract() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (slib) return slib;
    slib = new Promise((ok, chyba) => {
      const s = document.createElement('script');
      s.src = KNIHOVNA + 'tesseract.min.js';
      s.onload = () => (window.Tesseract ? ok(window.Tesseract) : chyba(new Error('Čtení textu se nepodařilo načíst.')));
      s.onerror = () => { s.remove(); slib = null; chyba(new Error('Čtení textu se nepodařilo stáhnout (jsi offline?).')); };
      document.head.appendChild(s);
    });
    return slib;
  }
  // úhel natočení textu: řádky textu dávají v „promítnutí“ podél správného úhlu nejostřejší profil
  function odhadniUhel(sedi, w, h) {
    // sedi: Uint8Array 0/1 (1 = tmavý bod) zmenšeného obrazu
    let nej = 0, nejSkore = -1;
    for (let a = -8; a <= 8.001; a += 0.25) {
      const tg = Math.tan(a * Math.PI / 180);
      const bins = new Float64Array(h + w);
      const posun = Math.ceil(Math.abs(tg) * w);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (sedi[y * w + x]) bins[Math.round(y - x * tg) + posun]++;
      let s = 0; for (const v of bins) s += v * v;
      if (s > nejSkore) { nejSkore = s; nej = a; }
    }
    return nej;
  }
  function otsu(p) {
    const hist = new Array(256).fill(0);
    for (let i = 0; i < p.length; i += 4) hist[p[i] | 0]++;
    const celkem = p.length / 4;
    let suma = 0; for (let i = 0; i < 256; i++) suma += i * hist[i];
    let sB = 0, wB = 0, prah = 128, nej = 0;
    for (let i = 0; i < 256; i++) {
      wB += hist[i]; if (!wB) continue;
      const wF = celkem - wB; if (!wF) break;
      sB += i * hist[i];
      const mB = sB / wB, mF = (suma - sB) / wF, mezi = wB * wF * (mB - mF) * (mB - mF);
      if (mezi > nej) { nej = mezi; prah = i; }
    }
    const svetle = hist.slice(prah + 1).reduce((a, b) => a + b, 0) > celkem / 2;   // tmavý text na světlém?
    return { prah, svetle };
  }
  function seda(x, w, h) {
    const d = x.getImageData(0, 0, w, h), p = d.data;
    for (let i = 0; i < p.length; i += 4) { const g = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]; p[i] = p[i + 1] = p[i + 2] = g; }
    return d;
  }
  // fotka → plátno pro Tesseract: delší strana 1600–2400 px, narovnání, černobílé prahování (Otsu)
  // a odstranění dlouhých vodorovných čar tabulky (slévaly by se s řádky textu)
  async function priprav(soubor) {
    const bmp = await createImageBitmap(soubor);
    const del = Math.max(bmp.width, bmp.height);
    const k = del > 2400 ? 2400 / del : del < 1600 ? 1600 / del : 1;
    const w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
    // 1) úhel z malé černobílé kopie
    const mw = 500, mh = Math.max(1, Math.round(h * mw / w));
    const m = document.createElement('canvas'); m.width = mw; m.height = mh;
    const mx = m.getContext('2d', { willReadFrequently: true });
    mx.drawImage(bmp, 0, 0, mw, mh);
    const md = seda(mx, mw, mh), mo = otsu(md.data);
    const sedi = new Uint8Array(mw * mh);
    for (let i = 0; i < sedi.length; i++) sedi[i] = (md.data[i * 4] > mo.prah) === mo.svetle ? 0 : 1;
    const uhel = odhadniUhel(sedi, mw, mh);
    // 2) narovnaný obraz v plné velikosti
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.fillStyle = '#fff'; x.fillRect(0, 0, w, h);
    x.translate(w / 2, h / 2); x.rotate(-uhel * Math.PI / 180); x.translate(-w / 2, -h / 2);
    x.drawImage(bmp, 0, 0, w, h);
    x.setTransform(1, 0, 0, 1, 0, 0);
    if (bmp.close) bmp.close();
    // 3) prahování
    const d = seda(x, w, h), p = d.data, o = otsu(p);
    for (let i = 0; i < p.length; i += 4) { const g = (p[i] > o.prah) === o.svetle ? 255 : 0; p[i] = p[i + 1] = p[i + 2] = g; }
    // 4) čáry tabulky: tenké vodorovné úseky delší než 5 % šířky (nad i pod nimi je bílo) vymazat;
    //    stejně tak skoro celé tmavé sloupce a řádky (okraje fotky, svislé čáry tabulky)
    const tm = (xx, y) => xx >= 0 && y >= 0 && xx < w && y < h && p[(y * w + xx) * 4] === 0;
    const bily = (xx, y) => { const i = (y * w + xx) * 4; p[i] = p[i + 1] = p[i + 2] = 255; };
    const min = Math.max(20, w * 0.05), tl = Math.max(4, Math.round(h / 250));
    for (let y = 0; y < h; y++) {
      let zac = -1;
      for (let xx = 0; xx <= w; xx++) {
        const t0 = xx < w && tm(xx, y);
        if (t0 && zac < 0) zac = xx;
        if (!t0 && zac >= 0) {
          if (xx - zac > min) {
            let tenka = 0;
            for (let q = zac; q < xx; q++) if (!tm(q, y - tl - 1) && !tm(q, y + tl + 1)) tenka++;
            if (tenka > (xx - zac) * 0.7) for (let q = zac; q < xx; q++) for (let dy = -tl; dy <= tl; dy++) if (y + dy >= 0 && y + dy < h) bily(q, y + dy);
          }
          zac = -1;
        }
      }
    }
    for (let xx = 0; xx < w; xx++) { let n = 0; for (let y = 0; y < h; y++) if (tm(xx, y)) n++; if (n > h * 0.5) for (let y = 0; y < h; y++) bily(xx, y); }
    x.putImageData(d, 0, 0);
    return { platno: c, uhel };
  }
  // soubor (fotka) → nejlépe přečtený text; hodnoceni(text) → počet nalezených údajů (zkouší víc režimů)
  async function precti(soubor, naPrubeh, hodnoceni) {
    const T = await nactiTesseract();
    const abs = cesta => new URL(cesta, location.href).href;   // worker si cesty skládá od svého umístění
    let krok = 0;
    const worker = await T.createWorker('ces', 1, {
      workerPath: abs(KNIHOVNA + 'worker.min.js'), corePath: abs(KNIHOVNA), langPath: abs(KNIHOVNA), gzip: false,
      logger: m => { if (naPrubeh && m && typeof m.progress === 'number') naPrubeh(m.progress, (m.status || '') + (krok > 1 ? ' (' + krok + '. pokus)' : '')); },
    });
    try {
      const { platno } = await priprav(soubor);
      let nejText = '', nejB = -1;
      // PSM 6 = jeden blok řádků (tabulky), 4 = sloupec různě velkých řádků, 11 = roztroušený text
      for (const psm of ['6', '4', '11']) {
        krok++;
        await worker.setParameters({ tessedit_pageseg_mode: psm, preserve_interword_spaces: '1' });
        const vys = await worker.recognize(platno);
        const text = (vys && vys.data && vys.data.text) || '';
        const b = hodnoceni ? hodnoceni(text) : text.length;
        if (b > nejB) { nejB = b; nejText = text; }
        if (!hodnoceni || b >= 7) break;
      }
      return nejText;
    } finally {
      try { await worker.terminate(); } catch (_) { /* nic */ }
    }
  }
  window.DENIK_ETIKETA = { precti, priprav, nactiTesseract };
})();

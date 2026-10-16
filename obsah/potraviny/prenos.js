/* ============================================================
   potraviny/prenos.js – přenos deníku mezi zařízeními animovaným
   QR kódem, bez serveru. Odesílač data zkomprimuje, rozdělí na bloky
   a promítá nekonečnou řadu QR kódů s náhodnými kombinacemi bloků
   (XOR) – fontánový kód. Přijímač nemusí
   zachytit každý snímek ani je mít po sobě: stačí o něco víc snímků,
   než je bloků (náhodný lineární kód, skládá se Gaussovou eliminací).
   Text QR je v base45 (alfanumerický režim QR).
   Jádro (bez DOM) jde testovat v node: require('./prenos.js').
   ============================================================ */
(function (koren, tvorba) {
  const api = tvorba();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else koren.DENIK_PRENOS = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- base45 (RFC 9285) ---------- */
  const B45 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
  const B45_I = new Map([...B45].map((c, i) => [c, i]));
  function base45(bajty) {
    let s = '';
    for (let i = 0; i + 1 < bajty.length; i += 2) {
      let x = bajty[i] * 256 + bajty[i + 1];
      const e = Math.floor(x / 2025); x %= 2025;
      s += B45[x % 45] + B45[Math.floor(x / 45)] + B45[e];
    }
    if (bajty.length % 2) { const x = bajty[bajty.length - 1]; s += B45[x % 45] + B45[Math.floor(x / 45)]; }
    return s;
  }
  function zBase45(s) {
    const n = s.length;
    if (n % 3 === 1) throw new Error('base45: délka');
    const out = new Uint8Array(Math.floor(n / 3) * 2 + (n % 3 === 2 ? 1 : 0));
    let j = 0;
    for (let i = 0; i < n; i += 3) {
      const c = B45_I.get(s[i]), d = B45_I.get(s[i + 1]);
      if (c === undefined || d === undefined) throw new Error('base45: znak');
      if (i + 2 < n) {
        const e = B45_I.get(s[i + 2]);
        if (e === undefined) throw new Error('base45: znak');
        const x = c + d * 45 + e * 2025;
        if (x > 65535) throw new Error('base45: hodnota');
        out[j++] = x >> 8; out[j++] = x & 255;
      } else {
        const x = c + d * 45;
        if (x > 255) throw new Error('base45: hodnota');
        out[j++] = x;
      }
    }
    return out;
  }

  /* ---------- CRC-32 ---------- */
  const CRC_T = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(b) {
    let c = 0xffffffff;
    for (let i = 0; i < b.length; i++) c = CRC_T[(c ^ b[i]) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  /* ---------- pseudonáhoda a rozdělení stupňů (robustní soliton) ---------- */
  function mulberry32(a) {
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // které bloky obsahuje snímek: náhodná hustá kombinace (každý blok s pravděpodobností 1/2), daná číslem
  // snímku a relací – přijímač si ji spočítá sám. Náhodný lineární kód nad GF(2) se s Gaussovou eliminací
  // složí z K + pár snímků bez ohledu na to, které snímky přijímač zachytí.
  function blokySnimku(id, K, relace) {
    if (K === 1) return [0];
    const rnd = mulberry32((relace ^ Math.imul(id + 1, 0x9e3779b1)) >>> 0);
    const vyber = [];
    for (let i = 0; i < K; i++) if (rnd() < 0.5) vyber.push(i);
    if (!vyber.length) vyber.push(Math.floor(rnd() * K));
    return vyber;
  }

  /* ---------- snímek: hlavička 23 B + blok ---------- */
  // 'D' | verze | příznaky | relace u32 | délka u32 | K u16 | velikost bloku u16 | číslo snímku u32 | CRC dat u32
  const MAGIE = 0x44, VERZE = 1, HLAVICKA = 23;
  function zapisU32(b, o, v) { b[o] = v >>> 24; b[o + 1] = (v >>> 16) & 255; b[o + 2] = (v >>> 8) & 255; b[o + 3] = v & 255; }
  function ctiU32(b, o) { return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0; }

  // vysílač: data (Uint8Array) → snimek(i) vrací text QR i-tého snímku
  function vysilac(data, volby) {
    volby = volby || {};
    const B = Math.max(16, Math.min(2000, volby.blok || 500));
    const K = Math.max(1, Math.ceil(data.length / B));
    if (K > 65535) throw new Error('Data jsou na přenos QR kódem příliš velká.');
    const relace = volby.relace !== undefined ? volby.relace >>> 0 : (Math.random() * 4294967296) >>> 0;
    const crc = crc32(data);
    const bloky = [];
    for (let i = 0; i < K; i++) { const b = new Uint8Array(B); b.set(data.subarray(i * B, Math.min(data.length, (i + 1) * B))); bloky.push(b); }
    function snimek(id) {
      const out = new Uint8Array(HLAVICKA + B);
      out[0] = MAGIE; out[1] = VERZE; out[2] = volby.priznaky || 0;
      zapisU32(out, 3, relace); zapisU32(out, 7, data.length);
      out[11] = K >> 8; out[12] = K & 255; out[13] = B >> 8; out[14] = B & 255;
      zapisU32(out, 15, id >>> 0); zapisU32(out, 19, crc);
      for (const j of blokySnimku(id, K, relace)) { const bl = bloky[j]; for (let k = 0; k < B; k++) out[HLAVICKA + k] ^= bl[k]; }
      return base45(out);
    }
    return { K, blok: B, relace, snimek };
  }

  // přijímač: pridej(text) → { stav: 'novy'|'znamy'|'cizi'|'chyba', hotovo, mam, K, data, priznaky }
  // Každý snímek je rovnice nad GF(2) (XOR vybraných bloků). Průběžná Gaussova eliminace: řádek s nejnižším
  // jedničkovým bitem p je „pivot p“; nová rovnice se zredukuje existujícími pivoty. Hodnost K = máme vše.
  function prijimac() {
    let rel = null, K = 0, B = 0, W = 0, delka = 0, crc = 0, priznaky = 0;
    let pivoty = [], hodnost = 0, videno = new Set(), data = null;
    const nejnizsi = m => { for (let w = 0; w < W; w++) if (m[w]) return w * 32 + (31 - Math.clz32(m[w] & -m[w])); return -1; };
    function vloz(maska, blok) {
      for (;;) {
        const p = nejnizsi(maska);
        if (p < 0) return false;                     // nic nového
        const r = pivoty[p];
        if (!r) { pivoty[p] = { m: maska, b: blok }; hodnost++; return true; }
        for (let w = p >> 5; w < W; w++) maska[w] ^= r.m[w];
        for (let k = 0; k < B; k++) blok[k] ^= r.b[k];
      }
    }
    function sestav() {
      const vys = new Array(K);
      for (let p = K - 1; p >= 0; p--) {
        const r = pivoty[p], b = r.b;
        for (let q = p + 1; q < K; q++) if (r.m[q >> 5] & (1 << (q & 31))) { const z = vys[q]; for (let k = 0; k < B; k++) b[k] ^= z[k]; }
        vys[p] = b;
      }
      const vse = new Uint8Array(K * B);
      vys.forEach((z, i) => vse.set(z, i * B));
      return vse.slice(0, delka);
    }
    function pridej(text) {
      if (data) return { stav: 'znamy', hotovo: true, mam: K, K, data, priznaky };
      let b;
      try { b = zBase45(String(text || '').trim()); } catch (_) { return { stav: 'chyba', hotovo: false, mam: hodnost, K }; }
      if (b.length < HLAVICKA + 1 || b[0] !== MAGIE || b[1] !== VERZE) return { stav: 'cizi', hotovo: false, mam: hodnost, K };
      const r = ctiU32(b, 3), kk = (b[11] << 8) | b[12], bb = (b[13] << 8) | b[14], id = ctiU32(b, 15);
      if (b.length !== HLAVICKA + bb || kk < 1 || bb < 1) return { stav: 'chyba', hotovo: false, mam: hodnost, K };
      if (rel !== r) {   // nový přenos (nebo první snímek) – začít znovu
        rel = r; K = kk; B = bb; W = Math.ceil(K / 32); delka = ctiU32(b, 7); crc = ctiU32(b, 19); priznaky = b[2];
        pivoty = new Array(K); hodnost = 0; videno = new Set();
      }
      if (videno.has(id)) return { stav: 'znamy', hotovo: false, mam: hodnost, K };
      videno.add(id);
      const maska = new Uint32Array(W);
      for (const i of blokySnimku(id, K, rel)) maska[i >> 5] |= 1 << (i & 31);
      vloz(maska, b.slice(HLAVICKA));
      if (hodnost === K) {
        const d = sestav();
        if (crc32(d) !== crc) { rel = null; return { stav: 'chyba', hotovo: false, mam: 0, K }; }
        data = d;
        return { stav: 'novy', hotovo: true, mam: K, K, data, priznaky };
      }
      return { stav: 'novy', hotovo: false, mam: hodnost, K };
    }
    return { pridej, get K() { return K; }, get mam() { return hodnost; } };
  }

  /* ---------- komprese (CompressionStream; bez ní se posílá nekomprimovaně) ---------- */
  const KOMPRIMOVANO = 1;
  async function proud(data, Trida, druh) {
    const s = new Blob([data]).stream().pipeThrough(new Trida(druh));
    return new Uint8Array(await new Response(s).arrayBuffer());
  }
  async function zabal(text) {
    const b = new TextEncoder().encode(text);
    if (typeof CompressionStream === 'undefined') return { data: b, priznaky: 0 };
    return { data: await proud(b, CompressionStream, 'deflate-raw'), priznaky: KOMPRIMOVANO };
  }
  async function rozbal(data, priznaky) {
    const b = priznaky & KOMPRIMOVANO ? await proud(data, DecompressionStream, 'deflate-raw') : data;
    return new TextDecoder().decode(b);
  }

  return { base45, zBase45, crc32, blokySnimku, vysilac, prijimac, zabal, rozbal, HLAVICKA };
});

/* ================= rozhraní (jen v prohlížeči) ================= */
(function () {
  'use strict';
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  const P = window.DENIK_PRENOS;
  const QR_JS = 'lib/qrcode/qrcode.js';   // relativně k obsah/potraviny.html
  let qrSlib = null;
  function nactiQr() {
    if (window.qrcode) return Promise.resolve(window.qrcode);
    if (qrSlib) return qrSlib;
    qrSlib = new Promise((ok, chyba) => {
      const s = document.createElement('script');
      s.src = QR_JS;
      s.onload = () => (window.qrcode ? ok(window.qrcode) : chyba(new Error('Knihovnu QR se nepodařilo načíst.')));
      s.onerror = () => { s.remove(); qrSlib = null; chyba(new Error('Knihovnu QR se nepodařilo stáhnout (jsi offline?).')); };
      document.head.appendChild(s);
    });
    return qrSlib;
  }
  // QR text → plátno (bílé okraje 4 moduly, ostré pixely)
  function kresliQr(platno, text, rozmer) {
    const q = window.qrcode(0, 'L');
    q.addData(text, 'Alphanumeric');
    q.make();
    const n = q.getModuleCount(), okraj = 4, celkem = n + 2 * okraj;
    const modul = Math.max(1, Math.floor(rozmer / celkem));
    const px = modul * celkem;
    if (platno.width !== px) { platno.width = px; platno.height = px; }
    const c = platno.getContext('2d');
    c.fillStyle = '#fff'; c.fillRect(0, 0, px, px);
    c.fillStyle = '#000';
    for (let r = 0; r < n; r++) for (let s = 0; s < n; s++) if (q.isDark(r, s)) c.fillRect((s + okraj) * modul, (r + okraj) * modul, modul, modul);
    return n;
  }

  // odesílání: text (záloha JSON) se promítá jako smyčka QR kódů
  async function odesli(text, prvky) {
    await nactiQr();
    const { data, priznaky } = await P.zabal(text);
    const vys = P.vysilac(data, { blok: prvky.blok || 500, priznaky });
    let i = 0, casovac = null, zamek = null;
    const tik = () => {
      kresliQr(prvky.platno, vys.snimek(i), prvky.rozmer());
      i++;
      if (prvky.naSnimek) prvky.naSnimek(i, vys.K);
    };
    const start = fps => { clearInterval(casovac); casovac = setInterval(tik, 1000 / fps); };
    tik(); start(prvky.fps || 6);
    try { if (navigator.wakeLock) zamek = await navigator.wakeLock.request('screen'); } catch (_) { /* nepodstatné */ }
    return {
      K: vys.K, bajtu: data.length, puvodne: new TextEncoder().encode(text).length,
      rychlost: start,
      zastav() { clearInterval(casovac); casovac = null; try { if (zamek) zamek.release(); } catch (_) { /* nic */ } zamek = null; },
      get snimek() { return i; },
      _snimek: id => vys.snimek(id),   // pro testy
    };
  }

  // příjem: kamera → QR detektor → přijímač; naHotovo(text) po složení a kontrole
  async function prijmi(prvky) {
    const det = await window.DENIK_CTECKA.qrDetektor();
    const prij = P.prijimac();
    let bezi = true, proud = null, cteni = false;
    const platno = document.createElement('canvas');
    async function zpracuj(texty) {
      for (const t of texty) {
        const v = prij.pridej(t);
        if (prvky.naStav) prvky.naStav(v);
        if (v.hotovo && v.data) {
          bezi = false;
          zastav();
          try { prvky.naHotovo(await P.rozbal(v.data, v.priznaky)); }
          catch (e) { prvky.naChybu(new Error('Data se nepodařilo rozbalit: ' + e.message)); }
          return;
        }
      }
    }
    async function cykl() {
      if (!bezi) return;
      const video = prvky.video;
      if (!cteni && video.readyState >= 2 && video.videoWidth) {
        cteni = true;
        try {
          let texty;
          if (det.druh === 'nativní') texty = (await det.cti(video)).map(r => r.text);
          else {
            const w = video.videoWidth, h = video.videoHeight;
            if (platno.width !== w) { platno.width = w; platno.height = h; }
            const c = platno.getContext('2d', { willReadFrequently: true });
            c.drawImage(video, 0, 0, w, h);
            texty = (await det.cti(c.getImageData(0, 0, w, h))).map(r => r.text);
          }
          await zpracuj(texty);
        } catch (_) { /* jednotlivý snímek – nevadí */ }
        cteni = false;
      }
      if (bezi) (video.requestVideoFrameCallback ? video.requestVideoFrameCallback(() => cykl()) : setTimeout(cykl, 30));
    }
    function zastav() {
      bezi = false;
      if (proud) { proud.getTracks().forEach(t => t.stop()); proud = null; }
      if (prvky.video) prvky.video.srcObject = null;
    }
    if (prvky.zruseno && prvky.zruseno()) return { zastav() {} };
    proud = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } });
    if (prvky.zruseno && prvky.zruseno()) bezi = false;
    if (!bezi) { proud.getTracks().forEach(t => t.stop()); return { zastav() {} }; }
    prvky.video.srcObject = proud;
    await prvky.video.play().catch(() => {});
    cykl();
    return { zastav, pridej: t => zpracuj([t]) };
  }

  window.DENIK_PRENOS_UI = { nactiQr, kresliQr, odesli, prijmi };
})();

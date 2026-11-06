/* Společná čtečka – lepší hlasy pro předčítání: Piper (espeak-ng + ONNX ve WASM) ve workeru Předčítače.
   window.CTECKA_PIPER. Hlasy se stáhnou jednou do Cache Storage „piper-hlasy“ (stejné jako obsah/predcitac.html,
   takže hlas stažený tam funguje i tady a naopak). Věta → WAV Blob; přehrává čtečka přes <audio>,
   které na rozdíl od speechSynthesis hraje i při zamčené obrazovce. */
(function () {
  'use strict';
  const CACHE = 'piper-hlasy';   // ne „webapp-…“ – ty maže sw.js při nové verzi
  const HF = 'https://huggingface.co/rhasspy/piper-voices/resolve/main/';
  const HONZA = 'https://huggingface.co/Thomcles/Piper-TTS-Czech/resolve/main/';
  const HLASY = [
    { klic: 'cs_CZ-jirka-medium', nazev: 'Jirka', mb: 63, onnx: HF + 'cs/cs_CZ/jirka/medium/cs_CZ-jirka-medium.onnx', json: HF + 'cs/cs_CZ/jirka/medium/cs_CZ-jirka-medium.onnx.json' },
    { klic: 'cs_CZ-honza-medium', nazev: 'Honza', mb: 64, onnx: HONZA + 'medium/model.onnx', json: HONZA + 'medium/model.onnx.json' },
  ];
  // stránka otevřená jako soubor (file://) nesmí spustit worker ani použít Cache Storage
  const lze = location.protocol !== 'file:' && typeof Worker === 'function' && 'caches' in window && typeof WebAssembly === 'object';
  const hlas = klic => HLASY.find(h => h.klic === klic);
  const stazene = new Set();

  async function zjistiStazene() {
    if (!lze) return stazene;
    try {
      const c = await caches.open(CACHE);
      for (const h of HLASY) if (await c.match(h.onnx)) stazene.add(h.klic);
    } catch (e) { /* Cache Storage nedostupná (soukromé okno) */ }
    return stazene;
  }

  async function stahni(klic, prubeh = () => {}) {
    const h = hlas(klic), c = await caches.open(CACHE);
    const r = await fetch(h.onnx);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const celkem = +r.headers.get('Content-Length') || h.mb * 1e6, ctecka = r.body.getReader(), casti = [];
    let n = 0;
    for (;;) {
      const { done, value } = await ctecka.read();
      if (done) break;
      casti.push(value); n += value.length;
      prubeh(Math.min(1, n / celkem));
    }
    const konfig = await fetch(h.json).then(x => { if (!x.ok) throw new Error('HTTP ' + x.status); return x.blob(); });
    await c.put(h.json, new Response(konfig, { headers: { 'Content-Type': 'application/json' } }));
    await c.put(h.onnx, new Response(new Blob(casti), { headers: { 'Content-Type': 'application/octet-stream' } }));
    stazene.add(klic);
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  }

  /* ---------- worker (sdílený s Předčítačem) ---------- */
  let worker = null, idZpravy = 0;
  const cekajici = new Map();
  function zadej(zprava, prenos = []) {
    if (!worker) {
      worker = new Worker('predcitac/worker.js');
      worker.onmessage = ({ data }) => {
        const p = cekajici.get(data.id);
        if (!p) return;
        cekajici.delete(data.id);
        data.typ === 'chyba' ? p.ko(new Error(data.zprava)) : p.ok(data);
      };
      worker.onerror = e => { for (const p of cekajici.values()) p.ko(new Error(e.message || 'Syntéza řeči selhala')); cekajici.clear(); };
    }
    return new Promise((ok, ko) => {
      const id = ++idZpravy;
      cekajici.set(id, { ok, ko });
      worker.postMessage(Object.assign({ id }, zprava), prenos);
    });
  }
  let nacteny = null, konfig = null, nacitani = null;
  function priprav(klic) {
    if (nacteny === klic) return Promise.resolve();
    if (nacitani && nacitani.klic === klic) return nacitani.p;
    const h = hlas(klic);
    const p = (async () => {
      const c = await caches.open(CACHE);
      const j = await c.match(h.json), o = await c.match(h.onnx);
      if (!j || !o) throw new Error('Hlas není stažený.');
      const k = await j.json(), model = await o.arrayBuffer();
      await zadej({ typ: 'hlas', model, konfig: k }, [model]);
      konfig = k; nacteny = klic;
    })();
    nacitani = { klic, p };
    p.finally(() => { if (nacitani && nacitani.p === p) nacitani = null; });
    return p;
  }

  // PCM float → WAV 16 bit s tichem na konci (pauza mezi větami / odstavci)
  function wav(pcm, frekvence, pauzaS) {
    const ticho = Math.round(frekvence * pauzaS), n = pcm.length + ticho;
    const h = new DataView(new ArrayBuffer(44 + n * 2));
    const zapis = (o, s) => { for (let i = 0; i < 4; i++) h.setUint8(o + i, s.charCodeAt(i)); };
    zapis(0, 'RIFF'); h.setUint32(4, 36 + n * 2, true); zapis(8, 'WAVE');
    zapis(12, 'fmt '); h.setUint32(16, 16, true); h.setUint16(20, 1, true); h.setUint16(22, 1, true);
    h.setUint32(24, frekvence, true); h.setUint32(28, frekvence * 2, true); h.setUint16(32, 2, true); h.setUint16(34, 16, true);
    zapis(36, 'data'); h.setUint32(40, n * 2, true);
    for (let i = 0; i < pcm.length; i++) { const v = Math.max(-1, Math.min(1, pcm[i])); h.setInt16(44 + i * 2, v * 32767, true); }
    return new Blob([h.buffer], { type: 'audio/wav' });
  }
  async function veta(klic, text, rychlost = 1, pauzaS = 0.3) {
    await priprav(klic);
    const { pcm } = await zadej({ typ: 'veta', text, rychlost });
    return wav(pcm, konfig.audio.sample_rate, pauzaS);
  }

  window.CTECKA_PIPER = { HLASY, lze, hlas, stazene, zjistiStazene, stahni, priprav, veta };
})();

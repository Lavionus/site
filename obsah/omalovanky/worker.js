/* omalovanky/worker.js – převod mimo hlavní vlákno (UI nezamrzne) */
importScripts('jadro.js');
self.onmessage = e => {
  const { id, data, w, h, nast } = e.data;
  try {
    const vys = self.OmalovankyJadro.zpracuj(data, w, h, nast);
    const prenos = [vys.maska, vys.sed, vys.indexy].filter(Boolean).map(a => a.buffer);
    self.postMessage({ id, vys }, prenos);
  } catch (err) {
    self.postMessage({ id, chyba: String(err && err.message || err) });
  }
};

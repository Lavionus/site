/* vektorizace/worker.js – trasování mimo hlavní vlákno (UI zůstane plynulé) */
importScripts('jadro.js');
self.onmessage = e => {
  const { id, data, w, h, volby } = e.data;
  try {
    const t0 = Date.now();
    const vys = self.VEKTORIZACE.vektorizuj(data, w, h, volby);
    vys.ms = Date.now() - t0;
    self.postMessage({ id, vys });
  } catch (err) {
    self.postMessage({ id, chyba: String(err && err.message || err) });
  }
};

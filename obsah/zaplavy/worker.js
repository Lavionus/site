/* zaplavy/worker.js – prioritní zaplavení (přelivové výšky) mimo hlavní vlákno, aby stránka nezamrzla. */
importScripts('jadro.js');
self.onmessage = e => {
  const { id, sirka, vyska, vysky, zdroje, sousedstvi, okraj } = e.data;
  try {
    const m = { sirka, vyska, vysky: new Float32Array(vysky) };
    const klic = self.ZaplavyJadro.zaplavaPropojena(m, zdroje, sousedstvi, okraj);
    self.postMessage({ id, klic: klic.buffer }, [klic.buffer]);
  } catch (err) { self.postMessage({ id, chyba: String(err && err.message || err) }); }
};

/* Řezný plán – výpočet ve Web Workeru (aby stránka nezamrzla); jádro je stejné jako v hlavním vlákně */
/* global importScripts, RP */
importScripts('jadro.js');
self.onmessage = (e) => {
  const { id, pr, o } = e.data || {};
  try {
    let posl = 0;
    const v = RP.vypocet(pr, Object.assign({}, o, {
      prubeh: (f) => { const t = Date.now(); if (t - posl > 150) { posl = t; self.postMessage({ id, prubeh: f }); } },
    }));
    self.postMessage({ id, v });
  } catch (err) {
    self.postMessage({ id, chyba: String((err && err.message) || err) });
  }
};

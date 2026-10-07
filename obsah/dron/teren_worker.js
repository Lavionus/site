// Nad krajinou — generování krajiny ve Web Workeru (aby stránka nezamrzla).
// spolecne.js kvůli tabulce D.STROMY (bez THREE se z něj načte jen základ).
importScripts('nahoda.js', 'sum.js', 'spolecne.js', 'teren.js');
onmessage = function (e) {
  const { seed, mapa } = e.data;
  try {
    const data = DRON.generujTeren(seed, mapa, p => postMessage({ prubeh: p }));
    const prenos = [];
    (function sber(o) {
      for (const k in o) {
        const v = o[k];
        if (ArrayBuffer.isView(v)) { if (!prenos.includes(v.buffer)) prenos.push(v.buffer); }
        else if (v && typeof v === 'object') sber(v);
      }
    })(data);
    postMessage({ data }, prenos);
  } catch (err) {
    postMessage({ chyba: String(err && err.stack || err) });
  }
};

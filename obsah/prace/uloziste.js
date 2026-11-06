/* Volná místa – IndexedDB „webapp_prace“ (stránka i Worker): klíče meta, mista, stav, detail/NN. */
(function (koren) {
  'use strict';
  let db = null;

  function otevri() {
    if (db) return db;
    db = new Promise((hotovo, chyba) => {
      const r = indexedDB.open('webapp_prace', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('data');
      r.onsuccess = () => hotovo(r.result);
      r.onerror = () => { db = null; chyba(r.error); };
    });
    return db;
  }

  async function cti(klic) {
    const d = await otevri();
    return new Promise((hotovo, chyba) => {
      const r = d.transaction('data').objectStore('data').get(klic);
      r.onsuccess = () => hotovo(r.result);
      r.onerror = () => chyba(r.error);
    });
  }

  /* Vše v jedné transakci – stará data se nahradí naráz, nebo vůbec. */
  async function zapis(polozky) {
    const d = await otevri();
    return new Promise((hotovo, chyba) => {
      const tx = d.transaction('data', 'readwrite');
      const st = tx.objectStore('data');
      for (const k in polozky) st.put(polozky[k], k);
      tx.oncomplete = () => hotovo();
      tx.onerror = tx.onabort = () => chyba(tx.error);
    });
  }

  koren.PRACE_ULOZISTE = { cti, zapis };
})(typeof self !== 'undefined' ? self : this);

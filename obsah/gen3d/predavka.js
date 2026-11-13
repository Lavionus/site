/* ============================================================
   gen3d/predavka.js – předání souboru mezi stránkami přes IndexedDB (webapp_predavka).
   Generátor:  await G3D.predej('modelar', blob, 'jmeno.3mf'); location.href = 'modelar.html#predavka';
   Modelář:    const f = await G3D.prevezmi('modelar');  // File nebo null; záznam se smaže
   Data zůstávají v prohlížeči; starší než hodina se při převzetí zahodí.
   ============================================================ */
(function () {
  'use strict';
  const DB = 'webapp_predavka', STORE = 'soubory';
  function otevri() {
    return new Promise((ok, chyba) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => ok(r.result); r.onerror = () => chyba(r.error);
    });
  }
  function tx(db, rezim, f) {
    return new Promise((ok, chyba) => {
      const t = db.transaction(STORE, rezim), s = t.objectStore(STORE), r = f(s);
      t.oncomplete = () => ok(r && r.result); t.onerror = () => chyba(t.error);
    });
  }
  async function predej(kam, blob, jmeno) {
    const db = await otevri();
    try { await tx(db, 'readwrite', s => s.put({ jmeno, data: blob, cas: Date.now() }, kam)); } finally { db.close(); }
  }
  async function prevezmi(kam) {
    const db = await otevri();
    try {
      const z = await tx(db, 'readonly', s => s.get(kam));
      await tx(db, 'readwrite', s => s.delete(kam));
      if (!z || Date.now() - z.cas > 3600e3) return null;
      return new File([z.data], z.jmeno);
    } finally { db.close(); }
  }
  window.G3D = Object.assign(window.G3D || {}, { predej, prevezmi });
})();

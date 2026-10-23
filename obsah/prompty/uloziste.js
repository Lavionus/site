/* ============================================================
   prompty/uloziste.js – úložiště databanky promptů v IndexedDB
   (localStorage má 5 MB na celý web). Klíč → hodnota v jednom
   storu; kde IndexedDB nejde (soukromé okno ve starších
   prohlížečích), použije se localStorage s prefixem.
   window.PROMPTY_ULOZISTE: cti(klic), pis(klic, hodnota), smaz(klic), druh
   ============================================================ */
(function () {
  'use strict';
  const DB = 'webapp_prompty_db', STORE = 'data', LS = 'webapp_prompty_db_';
  let db = null;

  const otevreni = new Promise(ok => {
    let req;
    try { req = indexedDB.open(DB, 1); } catch (e) { return ok(null); }
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => { db = req.result; ok(db); };
    req.onerror = () => ok(null);
    req.onblocked = () => ok(null);
  });

  function transakce(rezim, fn) {
    return new Promise((ok, chyba) => {
      const tx = db.transaction(STORE, rezim);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => ok(req.result);
      tx.onerror = tx.onabort = () => chyba(tx.error || new Error('Zápis do IndexedDB selhal'));
    });
  }

  const api = {
    druh: 'indexeddb',
    async cti(klic) {
      if (await otevreni) return transakce('readonly', s => s.get(klic));
      const v = localStorage.getItem(LS + klic);
      return v == null ? undefined : JSON.parse(v);
    },
    async pis(klic, hodnota) {
      if (await otevreni) return transakce('readwrite', s => s.put(hodnota, klic));
      localStorage.setItem(LS + klic, JSON.stringify(hodnota));
    },
    async smaz(klic) {
      if (await otevreni) return transakce('readwrite', s => s.delete(klic));
      localStorage.removeItem(LS + klic);
    },
  };
  otevreni.then(d => { if (!d) api.druh = 'localstorage'; });
  window.PROMPTY_ULOZISTE = api;
})();

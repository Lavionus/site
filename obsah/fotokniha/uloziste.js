/* Fotokniha – úložiště v IndexedDB (window.FK_ULOZ).
   knihy: JSON knihy (klíč id); fotky: { id, kniha, nazev, typ, velikost, w, h, orient, datum, original: Blob, nahled: Blob } */
(function () {
  'use strict';
  const DB = 'webapp_fotokniha';
  let dbP = null;
  function db() {
    return dbP || (dbP = new Promise((ok, chyba) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        d.createObjectStore('knihy', { keyPath: 'id' });
        d.createObjectStore('fotky', { keyPath: 'id' }).createIndex('kniha', 'kniha');
      };
      r.onsuccess = () => ok(r.result);
      r.onerror = () => chyba(r.error);
    }));
  }
  async function tx(store, rezim, fn) {
    const d = await db();
    return new Promise((ok, chyba) => {
      const t = d.transaction(store, rezim);
      const vys = fn(t.objectStore(store));
      t.oncomplete = () => ok(vys && 'result' in vys ? vys.result : undefined);
      t.onerror = () => chyba(t.error);
      t.onabort = () => chyba(t.error || new Error('Zápis přerušen (plné úložiště?)'));
    });
  }
  window.FK_ULOZ = {
    seznamKnih: () => tx('knihy', 'readonly', s => s.getAll()),
    nactiKnihu: id => tx('knihy', 'readonly', s => s.get(id)),
    ulozKnihu: k => tx('knihy', 'readwrite', s => s.put(k)),
    async smazKnihu(id) {
      const d = await db();
      return new Promise((ok, chyba) => {
        const t = d.transaction(['knihy', 'fotky'], 'readwrite');
        t.objectStore('knihy').delete(id);
        const f = t.objectStore('fotky');
        f.index('kniha').getAllKeys(id).onsuccess = e => e.target.result.forEach(k => f.delete(k));
        t.oncomplete = () => ok(); t.onerror = () => chyba(t.error);
      });
    },
    ulozFotku: f => tx('fotky', 'readwrite', s => s.put(f)),
    nactiFotku: id => tx('fotky', 'readonly', s => s.get(id)),
    smazFotku: id => tx('fotky', 'readwrite', s => s.delete(id)),
    fotkyKnihy: idKnihy => tx('fotky', 'readonly', s => s.index('kniha').getAll(idKnihy)),
  };
})();

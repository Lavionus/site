/* ============================================================
   Výletní deník – úložiště v IndexedDB (databáze webapp_vyletni_denik)
     vylety  {id, …}                      – metadata výletů (+ statistika, náhled trasy)
     trasy   {vyletId, trasy:[…]}         – plné body tras (mohou být velké)
     fotky   {id, vyletId, obrazek: Blob, nahled: Blob, original: Blob|null, …}
   Bloby se v IndexedDB ukládají přímo (bez base64). Načtení záznamu s Blobem
   nečte bajty obrázku – ty se čtou až při zobrazení.
   ============================================================ */
(function () {
  'use strict';
  const JMENO = 'webapp_vyletni_denik', VERZE = 1;
  let dbSlib = null;

  function otevri() {
    if (dbSlib) return dbSlib;
    dbSlib = new Promise((ok, chyba) => {
      let rq;
      try { rq = indexedDB.open(JMENO, VERZE); } catch (e) { chyba(e); return; }
      rq.onupgradeneeded = () => {
        const db = rq.result;
        if (!db.objectStoreNames.contains('vylety')) db.createObjectStore('vylety', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('trasy')) db.createObjectStore('trasy', { keyPath: 'vyletId' });
        if (!db.objectStoreNames.contains('fotky')) {
          const f = db.createObjectStore('fotky', { keyPath: 'id' });
          f.createIndex('vyletId', 'vyletId', { unique: false });
        }
      };
      rq.onsuccess = () => {
        const db = rq.result;
        db.onversionchange = () => { db.close(); dbSlib = null; };
        ok(db);
      };
      rq.onerror = () => chyba(rq.error || new Error('IndexedDB nelze otevřít'));
      rq.onblocked = () => chyba(new Error('Databázi blokuje jiná otevřená karta s deníkem'));
    });
    dbSlib.catch(() => { dbSlib = null; });
    return dbSlib;
  }

  function prelozChybu(e) {
    if (e && (e.name === 'QuotaExceededError' || /quota/i.test(e.message || ''))) {
      const n = new Error('Úložiště prohlížeče je plné. Smažte nepotřebné fotky (nebo originály), vytvořte zálohu, případně povolte trvalé úložiště.');
      n.name = 'QuotaExceededError';
      return n;
    }
    return e || new Error('Chyba IndexedDB');
  }

  /** Spustí funkci nad transakcí; výsledek je hodnota vrácená funkcí po dokončení transakce. */
  async function tx(sklady, rezim, fn) {
    const db = await otevri();
    return new Promise((ok, chyba) => {
      let t;
      try { t = db.transaction(sklady, rezim); } catch (e) { chyba(prelozChybu(e)); return; }
      let vysledek;
      t.oncomplete = () => ok(vysledek);
      t.onerror = () => chyba(prelozChybu(t.error));
      t.onabort = () => chyba(prelozChybu(t.error || new Error('Transakce přerušena')));
      try {
        const s = Array.isArray(sklady) ? sklady.map(x => t.objectStore(x)) : [t.objectStore(sklady)];
        const r = fn(...s);
        if (r && typeof r.then === 'function') r.then(v => { vysledek = v; }, e => { try { t.abort(); } catch (_) {} chyba(e); });
        else vysledek = r;
      } catch (e) { try { t.abort(); } catch (_) {} chyba(prelozChybu(e)); }
    });
  }
  const pozadavek = rq => new Promise((ok, chyba) => { rq.onsuccess = () => ok(rq.result); rq.onerror = () => chyba(prelozChybu(rq.error)); });

  const U = {
    otevri,
    async vsechnyVylety() { return tx('vylety', 'readonly', s => pozadavek(s.getAll())); },
    async vylet(id) { return tx('vylety', 'readonly', s => pozadavek(s.get(id))); },
    async ulozVylet(v) { v.upraveno = Date.now(); return tx('vylety', 'readwrite', s => { s.put(v); return v; }); },
    async trasy(vyletId) { const r = await tx('trasy', 'readonly', s => pozadavek(s.get(vyletId))); return r ? r.trasy : []; },
    async ulozTrasy(vyletId, trasy) {
      return tx('trasy', 'readwrite', s => { if (trasy && trasy.length) s.put({ vyletId, trasy }); else s.delete(vyletId); });
    },
    async fotkyVyletu(vyletId) {
      const f = await tx('fotky', 'readonly', s => pozadavek(s.index('vyletId').getAll(vyletId)));
      return f.sort((a, b) => (a.poradi || 0) - (b.poradi || 0) || String(a.datum || '').localeCompare(String(b.datum || '')));
    },
    async vsechnyFotky() { return tx('fotky', 'readonly', s => pozadavek(s.getAll())); },
    async fotka(id) { return tx('fotky', 'readonly', s => pozadavek(s.get(id))); },
    async ulozFotku(f) { return tx('fotky', 'readwrite', s => { s.put(f); return f; }); },
    async ulozFotky(pole) { return tx('fotky', 'readwrite', s => { pole.forEach(f => s.put(f)); return pole.length; }); },
    async smazFotku(id) { return tx('fotky', 'readwrite', s => { s.delete(id); }); },
    /** Počet fotek podle výletu – přes kurzor klíčů indexu (nečte bloby). */
    async pocetFotek() {
      return tx('fotky', 'readonly', s => new Promise((ok, chyba) => {
        const v = {}, rq = s.index('vyletId').openKeyCursor();
        rq.onsuccess = () => { const c = rq.result; if (c) { v[c.key] = (v[c.key] || 0) + 1; c.continue(); } else ok(v); };
        rq.onerror = () => chyba(rq.error);
      }));
    },
    async smazVylet(id) {
      return tx(['vylety', 'trasy', 'fotky'], 'readwrite', (sv, st, sf) => new Promise((ok, chyba) => {
        sv.delete(id); st.delete(id);
        const rq = sf.index('vyletId').openKeyCursor(IDBKeyRange.only(id));
        rq.onsuccess = () => { const c = rq.result; if (c) { sf.delete(c.primaryKey); c.continue(); } else ok(); };
        rq.onerror = () => chyba(rq.error);
      }));
    },
    async smazVse() {
      return tx(['vylety', 'trasy', 'fotky'], 'readwrite', (a, b, c) => { a.clear(); b.clear(); c.clear(); });
    },
    async vsechnyTrasy() { return tx('trasy', 'readonly', s => pozadavek(s.getAll())); },

    /** Stav úložiště: {usage, quota, persisted, podporovano} */
    async stav() {
      const v = { usage: null, quota: null, persisted: null, podporovano: !!(navigator.storage && navigator.storage.estimate) };
      try { if (navigator.storage && navigator.storage.estimate) { const e = await navigator.storage.estimate(); v.usage = e.usage; v.quota = e.quota; } } catch (e) {}
      try { if (navigator.storage && navigator.storage.persisted) v.persisted = await navigator.storage.persisted(); } catch (e) {}
      return v;
    },
    async pozadejTrvale() {
      try { if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist(); } catch (e) {}
      return false;
    },
    /** Ověří, že se vejde `bajtu` (s rezervou). Vrací {vejde, volno, potreba} – při neznámém stavu vejde=true. */
    async kontrolaMista(bajtu) {
      const s = await U.stav();
      if (s.usage == null || !s.quota) return { vejde: true, volno: null, potreba: bajtu };
      const volno = s.quota - s.usage;
      return { vejde: volno > bajtu * 1.2 + 20 * 1048576, volno, potreba: bajtu };
    },
  };
  window.ULOZENI = U;
})();

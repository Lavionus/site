/* Lamamp – úložiště v IndexedDB (WA_ULOZ): playlist, uložené skladby (Blob), skiny (.wsz) a vlastní předvolby EQ.
   Drobná nastavení jsou v localStorage (webapp_lamamp_nastaveni). */
(function () {
  'use strict';

  const DB = 'webapp_lamamp', VERZE = 1;
  let spojeni = null;

  function otevri() {
    if (spojeni) return spojeni;
    spojeni = new Promise((hotovo, chyba) => {
      if (!window.indexedDB) return chyba(new Error('Prohlížeč nemá IndexedDB.'));
      const r = indexedDB.open(DB, VERZE);
      // WebKit umí otevření „zaseknout“ (nikdy neskončí) – po 5 s to vzdát, ať menu a přehrávání nečekají napořád
      const limit = setTimeout(() => chyba(new Error('IndexedDB neodpovídá')), 5000);
      r.onblocked = () => {};
      r.onupgradeneeded = () => {
        const db = r.result;
        for (const s of ['kv', 'soubory', 'skiny']) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s);
      };
      r.onsuccess = () => {
        clearTimeout(limit);
        const db = r.result;
        // prohlížeč spojení zavřel (smazaná data, nová verze) → příště otevřít znovu
        db.onclose = db.onversionchange = () => { try { db.close(); } catch (e) { /* už zavřené */ } spojeni = null; };
        hotovo(db);
      };
      r.onerror = () => { clearTimeout(limit); chyba(r.error); };
    });
    spojeni.catch(() => { spojeni = null; });   // nepovedené otevření neblokovat napořád
    return spojeni;
  }
  async function akce(sklad, rezim, fn) {
    const db = await otevri();
    return new Promise((hotovo, chyba) => {
      const tx = db.transaction(sklad, rezim), s = tx.objectStore(sklad);
      const r = fn(s);
      tx.oncomplete = () => hotovo(r && 'result' in r ? r.result : undefined);
      tx.onerror = () => chyba(tx.error);
      tx.onabort = () => chyba(tx.error || new Error('Zápis přerušen (plné úložiště?)'));
    });
  }
  // Druhá záložka s přehrávačem jen čte – zápisy celého seznamu by si navzájem přepisovaly data (viz zamek v app.js).
  let jenCteni = false;
  const zakazano = () => Promise.reject(new Error('jen čtení – přehrávač je otevřený v jiné záložce'));
  const rozepsane = new Set();   // klíče souborů, jejichž zápis právě běží (úklid sirotků je nesmí smazat)
  const cti = (sklad, klic) => akce(sklad, 'readonly', s => s.get(klic));
  const zapis = (sklad, klic, hodnota) => {
    if (jenCteni) return zakazano();
    rozepsane.add(klic);
    return akce(sklad, 'readwrite', s => s.put(hodnota, klic)).finally(() => rozepsane.delete(klic));
  };
  const smaz = (sklad, klic) => jenCteni ? zakazano() : akce(sklad, 'readwrite', s => s.delete(klic));
  const klice = sklad => akce(sklad, 'readonly', s => s.getAllKeys());
  const vymaz = sklad => jenCteni ? zakazano() : akce(sklad, 'readwrite', s => s.clear());
  // Safari/iOS 14–15: File z <input> uložený přímo může být po obnovení stránky nečitelný → uložit jeho obsah jako Blob
  const jeWebKit = /AppleWebKit/.test(navigator.userAgent) && !/Chrome|Chromium|Edg|OPR/.test(navigator.userAgent);
  const proUlozeni = async f => jeWebKit ? new Blob([await f.arrayBuffer()], { type: f.type }) : f;

  // obsazené místo a požadavek na trvalé uložení (Safari jinak maže data po 7 dnech bez návštěvy)
  async function misto() {
    const o = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : null;
    return o ? { pouzito: o.usage || 0, kvota: o.quota || 0 } : null;
  }
  async function trvale() {
    try { return navigator.storage && navigator.storage.persist ? await navigator.storage.persist() : false; } catch (e) { return false; }
  }

  window.WA_ULOZ = {
    otevri, cti, zapis, smaz, klice, vymaz, misto, trvale, proUlozeni, rozepsane,
    get jenCteni() { return jenCteni; }, set jenCteni(v) { jenCteni = !!v; }
  };
})();

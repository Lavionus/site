/* Evidence majetku – úložiště v IndexedDB (databáze webapp_majetek). Přílohy jako Blob přímo v záznamu. */
(function () {
  'use strict';
  const J = window.MajetekJadro;
  const JMENO = 'webapp_majetek';
  const VERZE_DB = 1;                 // verze struktury úložišť IndexedDB (ne datového schématu)
  const STORY = ['polozky', 'lokality', 'mistnosti', 'kategorie', 'prilohy', 'meta'];
  let db = null;

  function req(r) { return new Promise((ok, chyba) => { r.onsuccess = () => ok(r.result); r.onerror = () => chyba(r.error); }); }
  function hotovo(tx) {
    return new Promise((ok, chyba) => {
      tx.oncomplete = () => ok();
      tx.onerror = () => chyba(tx.error || new Error('Transakce selhala.'));
      tx.onabort = () => chyba(tx.error || new Error('Transakce byla přerušena.'));
    });
  }
  function popisChyby(e) {
    const n = e && (e.name || '');
    if (n === 'QuotaExceededError' || /quota/i.test(String(e && e.message))) return 'Úložiště prohlížeče je plné. Uvolněte místo (smažte velké přílohy nebo vysypte koš) nebo stáhněte zálohu.';
    if (n === 'InvalidStateError') return 'Úložiště není dostupné (anonymní okno nebo zakázaná data webu?).';
    return (e && e.message) || String(e);
  }

  function otevri() {
    if (db) return Promise.resolve(db);
    return new Promise((ok, chyba) => {
      if (typeof indexedDB === 'undefined') return chyba(new Error('Prohlížeč nepodporuje IndexedDB – data nelze ukládat.'));
      let r;
      try { r = indexedDB.open(JMENO, VERZE_DB); } catch (e) { return chyba(e); }
      r.onupgradeneeded = e => {
        const d = r.result, stara = e.oldVersion;
        if (stara < 1) {
          const p = d.createObjectStore('polozky', { keyPath: 'id' });
          p.createIndex('smazano', 'smazano');
          d.createObjectStore('lokality', { keyPath: 'id' });
          d.createObjectStore('mistnosti', { keyPath: 'id' });
          d.createObjectStore('kategorie', { keyPath: 'id' });
          d.createObjectStore('prilohy', { keyPath: 'id' }).createIndex('polozkaId', 'polozkaId');
          d.createObjectStore('meta', { keyPath: 'klic' });
        }
        // budoucí změny struktury: if (stara < 2) { … }
      };
      r.onblocked = () => chyba(new Error('Databázi blokuje jiná otevřená karta s touto stránkou. Zavřete ji a načtěte stránku znovu.'));
      r.onsuccess = () => {
        db = r.result;
        db.onversionchange = () => { db.close(); db = null; };
        ok(db);
      };
      r.onerror = () => chyba(r.error);
    });
  }

  async function vse(store) { const d = await otevri(); return req(d.transaction(store).objectStore(store).getAll()); }
  async function meta(klic, vychozi) {
    const d = await otevri();
    const r = await req(d.transaction('meta').objectStore('meta').get(klic));
    return r ? r.hodnota : vychozi;
  }
  async function nastavMeta(klic, hodnota) {
    const d = await otevri(); const tx = d.transaction('meta', 'readwrite');
    tx.objectStore('meta').put({ klic, hodnota }); return hotovo(tx);
  }

  /* Načte vše; při starším datovém schématu záznamy převede přes J.migruj a uloží zpět. */
  async function nactiVse() {
    const d = await otevri();
    const tx = d.transaction(STORY);
    const [polozky, lokality, mistnosti, kategorie, prilohy, metaPole] = await Promise.all(STORY.map(s => req(tx.objectStore(s).getAll())));
    const m = Object.fromEntries(metaPole.map(x => [x.klic, x.hodnota]));
    const stav = { polozky, lokality, mistnosti, kategorie, prilohy, nastaveni: m.nastaveni || {}, schema: m.schema || 0, posledniZaloha: m.posledniZaloha || 0 };
    if (stav.schema && stav.schema < J.SCHEMA) {
      const blob = new Map(prilohy.map(a => [a.id, { blob: a.blob, nahled: a.nahled }]));
      const mg = J.migruj({ schema: stav.schema, polozky, lokality, mistnosti, kategorie, prilohy, nastaveni: stav.nastaveni }, Date.now());
      for (const a of mg.data.prilohy) Object.assign(a, blob.get(a.id) || {});
      await nahradVse(mg.data);
      return nactiVse();
    }
    return stav;
  }

  async function uloz(store, zaznamy) {
    const d = await otevri(); const tx = d.transaction(store, 'readwrite'); const os = tx.objectStore(store);
    for (const z of [].concat(zaznamy)) os.put(z);
    return hotovo(tx);
  }
  async function smaz(store, ids) {
    const d = await otevri(); const tx = d.transaction(store, 'readwrite'); const os = tx.objectStore(store);
    for (const id of [].concat(ids)) os.delete(id);
    return hotovo(tx);
  }
  /* Uložení položky i změn příloh v jedné transakci (buď vše, nebo nic). */
  async function ulozPolozku(p, nove, smazane) {
    const d = await otevri(); const tx = d.transaction(['polozky', 'prilohy'], 'readwrite');
    tx.objectStore('polozky').put(p);
    const pr = tx.objectStore('prilohy');
    for (const a of nove || []) pr.put(a);
    for (const id of smazane || []) pr.delete(id);
    return hotovo(tx);
  }
  async function smazTrvale(ids) {
    const d = await otevri(); const tx = d.transaction(['polozky', 'prilohy'], 'readwrite');
    const pr = tx.objectStore('prilohy'), idx = pr.index('polozkaId');
    for (const id of ids) {
      tx.objectStore('polozky').delete(id);
      idx.openKeyCursor(IDBKeyRange.only(id)).onsuccess = e => { const c = e.target.result; if (c) { pr.delete(c.primaryKey); c.continue(); } };
    }
    return hotovo(tx);
  }
  async function priloha(id) { const d = await otevri(); return req(d.transaction('prilohy').objectStore('prilohy').get(id)); }

  /* Nahradí veškerá data (obnova „nahradit“). Přílohy musí mít vyplněný blob. */
  async function nahradVse(data) {
    const d = await otevri(); const tx = d.transaction(STORY, 'readwrite');
    for (const s of ['polozky', 'lokality', 'mistnosti', 'kategorie', 'prilohy']) {
      const os = tx.objectStore(s); os.clear();
      for (const z of data[s] || []) os.put(z);
    }
    const me = tx.objectStore('meta');
    me.put({ klic: 'schema', hodnota: J.SCHEMA });
    if (data.nastaveni) me.put({ klic: 'nastaveni', hodnota: data.nastaveni });
    return hotovo(tx);
  }
  /* Sloučení podle plánu z J.planSlouceni. */
  async function sloucit(plan) {
    const d = await otevri(); const tx = d.transaction(STORY, 'readwrite');
    for (const p of plan.polozky.pridat.concat(plan.polozky.prepsat)) tx.objectStore('polozky').put(p);
    for (const k of ['lokality', 'mistnosti', 'kategorie']) for (const z of plan.ciselnikyPridat[k]) tx.objectStore(k).put(z);
    for (const a of plan.prilohy.pridat) tx.objectStore('prilohy').put(a);
    tx.objectStore('meta').put({ klic: 'schema', hodnota: J.SCHEMA });
    return hotovo(tx);
  }

  async function odhad() {
    const s = navigator.storage;
    const out = { podpora: !!(s && s.estimate), usage: null, quota: null, trvale: null, podporaTrvale: !!(s && s.persist) };
    try { if (s && s.estimate) { const e = await s.estimate(); out.usage = e.usage; out.quota = e.quota; } } catch (e) { /* nedostupné */ }
    try { if (s && s.persisted) out.trvale = await s.persisted(); } catch (e) { /* nedostupné */ }
    return out;
  }
  async function pozadatTrvale() {
    try { return navigator.storage && navigator.storage.persist ? await navigator.storage.persist() : false; } catch (e) { return false; }
  }

  window.MajetekDB = { otevri, nactiVse, uloz, smaz, ulozPolozku, smazTrvale, priloha, nahradVse, sloucit, meta, nastavMeta, odhad, pozadatTrvale, popisChyby, vse };
})();

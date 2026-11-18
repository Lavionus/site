/* Jádro jednotného spisu (window.SPIS v prohlížeči, module.exports v node).
   Smlouva dat je v docs/plany/Spis_PLAN.md („Smlouva spisu“) – staví na ní další etapy, měnit jen tam i tady.
   Úložiště přes adaptér: IndexedDB `webapp_spis` v prohlížeči, paměťový adaptér v node testech (stejné async API).
   Aktivní případ v localStorage `webapp_spis_aktivni`. Změny se rozesílají ostatním záložkám a iframům
   přes BroadcastChannel `webapp_spis` – odběr SPIS.odebirej(fn). Nic se neodesílá mimo prohlížeč. */
(function (koren) {
  'use strict';

  const DB = 'webapp_spis', KLIC_AKTIVNI = 'webapp_spis_aktivni', KANAL = 'webapp_spis';
  const STORES = ['pripady', 'entity', 'vazby', 'soubory', 'historie'];
  const FORMAT = 'webapp-spis', VERZE = 1;
  const RE_ID = /^[\w.:-]{1,160}$/, RE_SHA = /^[0-9a-f]{64}$/, RE_CAS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?Z?$/;

  /* ---------- typy entit a jejich pole ----------
     d = druh pole: text | dlouhy | cas | cislo | vyber | sha256 | entita (id, typy) | entity (pole id) | soubor (id souboru)
     Pole, která tu nejsou (predani[], exif, anotace…), se zachovávají beze změny – doplní je další etapy. */
  const TYPY = {
    osoba: { nazev: 'Osoba', mnoz: 'Osoby', ikona: '👤', jmeno: 'Jméno a příjmení', pole: [
      { k: 'role', n: 'Role', d: 'text', nab: ['poškozený', 'svědek', 'podezřelý', 'obviněný', 'prověřovaná osoba', 'oznamovatel', 'policista'] },
      { k: 'narozeni', n: 'Narození / věk', d: 'text' },
      { k: 'vyska', n: 'Výška (cm)', d: 'cislo' },
      { k: 'popis', n: 'Popis', d: 'dlouhy' }] },
    stopa: { nazev: 'Stopa', mnoz: 'Stopy', ikona: '🧪', jmeno: 'Název stopy', pole: [
      { k: 'cislo', n: 'Číslo stopy', d: 'text' },
      { k: 'druh', n: 'Druh', d: 'text', nab: ['biologická stopa', 'daktyloskopická stopa', 'trasologická stopa', 'mechanoskopická stopa', 'věcná stopa', 'digitální stopa', 'dopravní stopa'] },
      { k: 'misto', n: 'Místo nálezu', d: 'text' },
      { k: 'zajistil', n: 'Zajistil', d: 'text' },
      { k: 'kdy', n: 'Zajištěno', d: 'cas' },
      { k: 'obal', n: 'Obal / pečeť', d: 'text' },
      { k: 'stav', n: 'Stav', d: 'text' },
      { k: 'sha256', n: 'Otisk SHA-256', d: 'sha256' },
      { k: 'popis', n: 'Popis', d: 'dlouhy' }] },
    misto: { nazev: 'Místo', mnoz: 'Místa', ikona: '📍', jmeno: 'Název místa', pole: [
      { k: 'adresa', n: 'Adresa', d: 'text' },
      { k: 'lat', n: 'Zeměpisná šířka', d: 'cislo' },
      { k: 'lon', n: 'Zeměpisná délka', d: 'cislo' },
      { k: 'popis', n: 'Popis', d: 'dlouhy' }] },
    udalost: { nazev: 'Událost', mnoz: 'Události', ikona: '🕓', jmeno: 'Krátký popis', pole: [
      { k: 'kdy', n: 'Kdy', d: 'cas', povinne: true },
      { k: 'do', n: 'Do', d: 'cas' },
      { k: 'nejistota', n: 'Nejistota (min)', d: 'cislo' },
      { k: 'druh', n: 'Druh záznamu', d: 'vyber', moz: [['udalost', 'událost'], ['dukaz', 'důkaz'], ['svedek', 'výpověď / tvrzení']] },
      { k: 'jistota', n: 'Jistota', d: 'vyber', moz: [['overeno', 'ověřeno'], ['pravdepodobne', 'pravděpodobné'], ['tvrzeni', 'jen tvrzení']] },
      { k: 'osoby', n: 'Osoby', d: 'entity', typy: ['osoba'] },
      { k: 'misto', n: 'Místo', d: 'entita', typy: ['misto'] },
      { k: 'zdroj', n: 'Zdroj informace', d: 'text' },
      { k: 'popis', n: 'Popis', d: 'dlouhy' }] },
    foto: { nazev: 'Fotografie', mnoz: 'Fotografie', ikona: '📷', jmeno: 'Popisek', pole: [
      { k: 'soubor', n: 'Soubor', d: 'soubor' },
      { k: 'sha256', n: 'Otisk SHA-256', d: 'sha256' },
      { k: 'popis', n: 'Popis', d: 'dlouhy' }] },
    dokument: { nazev: 'Dokument', mnoz: 'Dokumenty', ikona: '📄', jmeno: 'Název dokumentu', pole: [
      { k: 'druh', n: 'Druh', d: 'text', nab: ['úřední záznam', 'protokol', 'výpověď', 'znalecký posudek', 'výpis', 'jiný'] },
      { k: 'soubor', n: 'Soubor', d: 'soubor' },
      { k: 'sha256', n: 'Otisk SHA-256', d: 'sha256' },
      { k: 'popis', n: 'Popis', d: 'dlouhy' }] },
    vozidlo: { nazev: 'Vozidlo', mnoz: 'Vozidla', ikona: '🚗', jmeno: 'Označení vozidla', pole: [
      { k: 'rz', n: 'Registrační značka', d: 'text' },
      { k: 'vin', n: 'VIN', d: 'text' },
      { k: 'popis', n: 'Popis', d: 'dlouhy' }] },
    telefon: { nazev: 'Telefon', mnoz: 'Telefony', ikona: '📱', jmeno: 'Označení telefonu', pole: [
      { k: 'cislo', n: 'Telefonní číslo', d: 'text' },
      { k: 'imei', n: 'IMEI', d: 'text' },
      { k: 'popis', n: 'Popis', d: 'dlouhy' }] },
    ucet: { nazev: 'Účet', mnoz: 'Účty', ikona: '🏦', jmeno: 'Označení účtu', pole: [
      { k: 'cislo', n: 'Číslo účtu / IBAN', d: 'text' },
      { k: 'banka', n: 'Banka', d: 'text' },
      { k: 'popis', n: 'Popis', d: 'dlouhy' }] }
  };

  // typy vazeb – [klíč, popisek]; typ vazby je jinak volný text (nástroje si mohou přidat vlastní)
  const VAZBY = [['souvisi', 'souvisí s'], ['drzitel', 'držitel / uživatel'], ['hovor', 'hovor'], ['zna', 'zná se s'],
    ['byl_na', 'byl(a) na místě'], ['nalezeno_na', 'nalezeno na místě'], ['tyka_se', 'týká se'],
    ['potvrzuje', 'potvrzuje'], ['vyvraci', 'vyvrací'], ['platba', 'platba']];
  const nazevVazby = t => (VAZBY.find(v => v[0] === t) || [t, t])[1];

  /* ---------- pomůcky ---------- */
  // časy záznamů rostou přísně (dvě změny v téže milisekundě by zamíchaly historii i slučování)
  let posledniCas = 0;
  const cas = () => { posledniCas = Math.max(Date.now(), posledniCas + 1); return new Date(posledniCas).toISOString(); };
  const kopie = o => JSON.parse(JSON.stringify(o));
  const jeObjekt = o => o !== null && typeof o === 'object' && !Array.isArray(o);
  const bezDiakritiky = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  function noveId(predpona) {
    const n = (koren.crypto && koren.crypto.randomUUID) ? koren.crypto.randomUUID().slice(0, 13) : Math.random().toString(36).slice(2, 15);
    return predpona + '-' + Date.now().toString(36) + '-' + n.replace(/-/g, '');
  }
  async function sha256(data) {
    const buf = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    const h = await koren.crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(h), b => b.toString(16).padStart(2, '0')).join('');
  }
  function naBase64(buf) {
    const u = new Uint8Array(buf);
    if (typeof Buffer !== 'undefined') return Buffer.from(u).toString('base64');
    let s = '';
    for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function zBase64(t) {
    if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(t, 'base64'));
    const s = atob(t), u = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
    return u;
  }
  class ChybaSpisu extends Error { constructor(zprava, chyby) { super(zprava); this.chyby = chyby || []; } }

  /* ---------- validace ---------- */
  // vrací seznam chyb (prázdný = v pořádku); kontroluje tvar, ne existenci odkazovaných entit
  function validuj(e) {
    const ch = [];
    if (!jeObjekt(e)) return ['Záznam není objekt.'];
    if (typeof e.id !== 'string' || !RE_ID.test(e.id)) ch.push('Neplatné id.');
    if (typeof e.pripad !== 'string' || !RE_ID.test(e.pripad)) ch.push('Neplatný případ.');
    const T = TYPY[e.typ];
    if (!T) { ch.push('Neznámý typ záznamu.'); return ch; }
    if (typeof e.nazev !== 'string' || !e.nazev.trim()) ch.push(T.jmeno + ' – povinný údaj.');
    else if (e.nazev.length > 300) ch.push(T.jmeno + ' – nejvýš 300 znaků.');
    for (const k of ['vytvoreno', 'upraveno']) if (e[k] !== undefined && (typeof e[k] !== 'string' || !RE_CAS.test(e[k]))) ch.push('Neplatné datum záznamu.');
    if (e.smazano !== undefined && (typeof e.smazano !== 'string' || !RE_CAS.test(e.smazano))) ch.push('Neplatné datum smazání.');
    if (e.zdroj !== undefined && typeof e.zdroj !== 'string') ch.push('Neplatný zdroj.');
    if (!jeObjekt(e.data)) { ch.push('Chybí údaje záznamu.'); return ch; }
    for (const p of T.pole) {
      const v = e.data[p.k];
      if (v === undefined || v === '' || (Array.isArray(v) && !v.length)) { if (p.povinne) ch.push(p.n + ' – povinný údaj.'); continue; }
      let ok = true;
      switch (p.d) {
        case 'text': case 'dlouhy': ok = typeof v === 'string' && v.length <= 20000; break;
        case 'cas': ok = typeof v === 'string' && RE_CAS.test(v); break;
        case 'cislo': ok = typeof v === 'number' && Number.isFinite(v); break;
        case 'vyber': ok = p.moz.some(m => m[0] === v); break;
        case 'sha256': ok = typeof v === 'string' && RE_SHA.test(v); break;
        case 'entita': case 'soubor': ok = typeof v === 'string' && RE_ID.test(v); break;
        case 'entity': ok = Array.isArray(v) && v.every(x => typeof x === 'string' && RE_ID.test(x)); break;
      }
      if (!ok) ch.push(p.n + ' – neplatná hodnota' + (p.d === 'sha256' ? ' (64 šestnáctkových znaků).' : p.d === 'cas' ? ' (datum a čas).' : '.'));
    }
    return ch;
  }
  function validujVazbu(v) {
    const ch = [];
    if (!jeObjekt(v)) return ['Vazba není objekt.'];
    for (const k of ['id', 'pripad', 'od', 'do']) if (typeof v[k] !== 'string' || !RE_ID.test(v[k])) ch.push('Vazba – neplatné ' + k + '.');
    if (typeof v.typ !== 'string' || !v.typ.trim() || v.typ.length > 60) ch.push('Vazba – chybí typ.');
    if (v.od === v.do) ch.push('Vazba nemůže vést sama na sebe.');
    if (v.popis !== undefined && (typeof v.popis !== 'string' || v.popis.length > 2000)) ch.push('Vazba – neplatný popis.');
    if (v.kdy !== undefined && (typeof v.kdy !== 'string' || !RE_CAS.test(v.kdy))) ch.push('Vazba – neplatný čas.');
    if (v.sila !== undefined && !(Number.isInteger(v.sila) && v.sila >= 1 && v.sila <= 5)) ch.push('Vazba – síla musí být celé číslo 1–5.');
    for (const k of ['vytvoreno', 'upraveno', 'smazano']) if (v[k] !== undefined && (typeof v[k] !== 'string' || !RE_CAS.test(v[k]))) ch.push('Vazba – neplatné datum.');
    return ch;
  }
  function validujPripad(p) {
    const ch = [];
    if (!jeObjekt(p)) return ['Případ není objekt.'];
    if (typeof p.id !== 'string' || !RE_ID.test(p.id)) ch.push('Případ – neplatné id.');
    if (typeof p.nazev !== 'string' || !p.nazev.trim() || p.nazev.length > 300) ch.push('Název případu – povinný údaj (nejvýš 300 znaků).');
    for (const k of ['cislo', 'popis']) if (p[k] !== undefined && (typeof p[k] !== 'string' || p[k].length > 20000)) ch.push('Případ – neplatné ' + k + '.');
    for (const k of ['vytvoreno', 'upraveno']) if (p[k] !== undefined && (typeof p[k] !== 'string' || !RE_CAS.test(p[k]))) ch.push('Případ – neplatné datum.');
    return ch;
  }
  // minimální tvar záznamu při čtení z úložiště – poškozený záznam se přeskočí, stránku neshodí
  function zdravy(store, r) {
    if (!jeObjekt(r) || typeof r.id !== 'string') return false;
    if (store === 'pripady') return typeof r.nazev === 'string';
    if (typeof r.pripad !== 'string') return false;
    if (store === 'entity') return !!TYPY[r.typ] && typeof r.nazev === 'string' && jeObjekt(r.data);
    if (store === 'vazby') return typeof r.od === 'string' && typeof r.do === 'string' && typeof r.typ === 'string';
    if (store === 'historie') return typeof r.kdy === 'string' && typeof r.entita === 'string';
    return true;
  }

  // vyčistí data z formuláře: ořízne text, vynechá prázdné hodnoty, otisk malými písmeny
  function cistiData(typ, data) {
    const d = {};
    for (const [k, v] of Object.entries(data || {})) {
      if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) continue;
      d[k] = typeof v === 'string' ? v.trim() : v;
      if (d[k] === '') delete d[k];
    }
    for (const p of (TYPY[typ] || { pole: [] }).pole) if (p.d === 'sha256' && typeof d[p.k] === 'string') d[p.k] = d[p.k].toLowerCase();
    return d;
  }

  /* ---------- adaptéry úložiště ----------
     cti(store, id) → záznam | null;  vse(store, pripad?) → [záznamy];  zapis([{store, rec} | {store, smaz: id}]) – jedna transakce;
     smazPripad(id) – smaže případ i všechny jeho záznamy. */
  function pametovyAdapter() {
    const D = Object.fromEntries(STORES.map(s => [s, new Map()]));
    return {
      async cti(s, id) { const r = D[s].get(id); return r === undefined ? null : structuredClone(r); },
      async vse(s, pid) { return [...D[s].values()].filter(r => pid === undefined || (r && r.pripad === pid)).map(r => structuredClone(r)); },
      async zapis(ops) { for (const o of ops) { if (o.smaz !== undefined) D[o.store].delete(o.smaz); else D[o.store].set(o.rec.id, structuredClone(o.rec)); } },
      async smazPripad(pid) { D.pripady.delete(pid); for (const s of STORES.slice(1)) for (const [k, r] of D[s]) if (r && r.pripad === pid) D[s].delete(k); }
    };
  }

  function chybaIdb(e) {
    return new ChybaSpisu('Úložiště prohlížeče (IndexedDB) není dostupné – spis nejde načíst ani uložit. Bývá to v soukromém (anonymním) okně nebo při zakázaných datech webů. Otevřete stránku v běžném okně.' + (e && e.message ? ' (' + e.message + ')' : ''));
  }
  function idbAdapter() {
    let db = null;
    const otevri = () => db || (db = new Promise((ok, ko) => {
      let q;
      try { q = indexedDB.open(DB, 1); } catch (e) { return ko(chybaIdb(e)); }
      q.onupgradeneeded = () => {
        const d = q.result;
        for (const s of STORES) if (!d.objectStoreNames.contains(s)) {
          const os = d.createObjectStore(s, { keyPath: 'id' });
          if (s !== 'pripady') os.createIndex('pripad', 'pripad');
        }
      };
      // onclose = prohlížeč spojení zavřel sám (vymazaná data webu) – příště se otevře znovu
      q.onsuccess = () => { const d = q.result; d.onversionchange = () => { d.close(); db = null; }; d.onclose = () => { db = null; }; ok(d); };
      q.onerror = () => ko(chybaIdb(q.error));
      q.onblocked = () => ko(chybaIdb(new Error('databázi drží otevřenou jiná záložka')));
    }).catch(e => { db = null; throw e; }));
    const pozadavek = q => new Promise((ok, ko) => { q.onsuccess = () => ok(q.result); q.onerror = () => ko(q.error); });
    const chybaZapisu = e => e && e.name === 'QuotaExceededError'
      ? new ChybaSpisu('Úložiště prohlížeče je plné – záznam se neuložil. Uvolněte místo (⚙️ Nastavení, velké fotky, staré případy po exportu balíčku).')
      : (e || new Error('zápis přerušen'));
    return {
      async cti(s, id) { const d = await otevri(); const r = await pozadavek(d.transaction(s).objectStore(s).get(id)); return r === undefined ? null : r; },
      async vse(s, pid) {
        const os = (await otevri()).transaction(s).objectStore(s);
        return pozadavek(pid === undefined ? os.getAll() : os.index('pripad').getAll(pid));
      },
      async zapis(ops) {
        if (!ops.length) return;
        const d = await otevri();
        const tx = d.transaction([...new Set(ops.map(o => o.store))], 'readwrite');
        const hotovo = new Promise((ok, ko) => { tx.oncomplete = ok; tx.onerror = () => ko(chybaZapisu(tx.error)); tx.onabort = () => ko(chybaZapisu(tx.error)); });
        hotovo.catch(() => {});
        // chyba při vkládání (např. DataCloneError) nesmí nechat transakci dokončit jen zčásti (záznam bez historie)
        try { for (const o of ops) { const os = tx.objectStore(o.store); if (o.smaz !== undefined) os.delete(o.smaz); else os.put(o.rec); } }
        catch (e) { try { tx.abort(); } catch (x) { /* už ukončená */ } throw e; }
        await hotovo;
      },
      async smazPripad(pid) {
        const d = await otevri();
        const tx = d.transaction(STORES, 'readwrite');
        tx.objectStore('pripady').delete(pid);
        for (const s of STORES.slice(1)) {
          const q = tx.objectStore(s).index('pripad').openKeyCursor(IDBKeyRange.only(pid));
          q.onsuccess = () => { const c = q.result; if (c) { tx.objectStore(s).delete(c.primaryKey); c.continue(); } };
        }
        await new Promise((ok, ko) => { tx.oncomplete = ok; tx.onerror = () => ko(tx.error); tx.onabort = () => ko(tx.error); });
      }
    };
  }

  let A = null;
  const ad = () => A || (A = idbAdapter());
  let poskozenych = 0;
  async function nacti(store, pid) {
    const v = await ad().vse(store, pid);
    const ok = v.filter(r => zdravy(store, r));
    poskozenych += v.length - ok.length;
    return ok;
  }

  /* ---------- aktivní případ ---------- */
  let aktivniPamet = null;
  function aktivni() {
    try { return koren.localStorage ? localStorage.getItem(KLIC_AKTIVNI) : aktivniPamet; } catch (e) { return aktivniPamet; }
  }
  function nastavAktivni(id) {
    aktivniPamet = id || null;
    try { if (koren.localStorage) { if (id) localStorage.setItem(KLIC_AKTIVNI, id); else localStorage.removeItem(KLIC_AKTIVNI); } } catch (e) { /* bez úložiště jen v paměti */ }
  }
  const pid = p => { const id = p || aktivni(); if (!id) throw new ChybaSpisu('Není otevřený žádný případ.'); return id; };

  /* ---------- synchronizace mezi záložkami ---------- */
  const odberatele = new Set();
  let kanal = null;
  function kanalu() {
    if (kanal === null) {
      try {
        kanal = new BroadcastChannel(KANAL);
        kanal.onmessage = e => { if (jeObjekt(e.data) && typeof e.data.druh === 'string') rozesli(e.data); };
      } catch (e) { kanal = false; }
    }
    return kanal;
  }
  function rozesli(ud) { for (const f of odberatele) { try { f(ud); } catch (e) { console.error(e); } } }
  function oznam(ud) {
    rozesli(Object.assign({ mistni: true }, ud));
    const k = kanalu();
    if (k) try { k.postMessage(ud); } catch (e) { /* zavřený kanál */ }
  }
  function odebirej(fn) { kanalu(); odberatele.add(fn); return () => odberatele.delete(fn); }

  /* ---------- historie ---------- */
  // predchozi = `upraveno` verze, ze které změna vyšla – podle řetězu se při importu pozná, zda verze navazují
  function zaznamHistorie(pripad, entita, akce, zmeny, nastroj, kdy, predchozi) {
    const h = { id: noveId('h'), pripad, entita, kdy: kdy || cas(), nastroj: nastroj || 'spis', akce };
    if (predchozi) h.predchozi = predchozi;
    if (zmeny && Object.keys(zmeny).length) h.zmeny = zmeny;
    return h;
  }
  // {pole: [před, po]} – název a jednotlivá pole dat (u vazby typ, popis, kdy)
  // souhrn = true: u polí s objektem/polem jen null („změněno“, bez obsahu) – rozložení nástěnky apod. nenafukuje historii
  function rozdil(stara, nova, klice, souhrn) {
    const z = {};
    // klice = přímá pole (případ); jinak název + jednotlivá pole dat entity
    const hodnota = (o, k) => !o ? undefined : (klice || k === 'nazev') ? o[k] : (o.data || {})[k];
    const vsechny = klice || ['nazev', ...new Set([...Object.keys((stara && stara.data) || {}), ...Object.keys(nova.data || {})])];
    for (const k of vsechny) {
      const a = hodnota(stara, k), b = hodnota(nova, k);
      if (JSON.stringify(a) === JSON.stringify(b)) continue;
      const slozite = x => x !== null && typeof x === 'object';
      z[k] = souhrn && (slozite(a) || slozite(b)) ? null : [a === undefined ? null : a, b === undefined ? null : b];
    }
    return z;
  }

  /* ---------- případy ---------- */
  async function pripady() {
    return (await nacti('pripady')).sort((a, b) => String(b.upraveno || '').localeCompare(String(a.upraveno || '')));
  }
  async function pripad(id) { const p = await ad().cti('pripady', pid(id)); return p && zdravy('pripady', p) ? p : null; }
  async function zalozPripad(udaje, o = {}) {
    const ted = cas();
    const p = { id: o.id || noveId('pripad'), cislo: String(udaje.cislo || '').trim(), nazev: String(udaje.nazev || '').trim(), popis: String(udaje.popis || '').trim(), vytvoreno: ted, upraveno: ted };
    if (udaje.model) p.model = true;
    const ch = validujPripad(p);
    if (ch.length) throw new ChybaSpisu(ch.join(' '), ch);
    await ad().zapis([{ store: 'pripady', rec: p }, { store: 'historie', rec: zaznamHistorie(p.id, p.id, 'zalozeno', null, o.nastroj, ted) }]);
    oznam({ druh: 'pripad', akce: 'zalozeno', id: p.id, pripad: p.id });
    return p;
  }
  async function ulozPripad(udaje, o = {}) {
    const stary = await pripad(udaje.id);
    if (!stary) throw new ChybaSpisu('Případ neexistuje.');
    const p = Object.assign({}, stary, { cislo: String(udaje.cislo ?? stary.cislo ?? '').trim(), nazev: String(udaje.nazev ?? stary.nazev).trim(), popis: String(udaje.popis ?? stary.popis ?? '').trim(), upraveno: cas() });
    const ch = validujPripad(p);
    if (ch.length) throw new ChybaSpisu(ch.join(' '), ch);
    const zmeny = rozdil(stary, p, ['cislo', 'nazev', 'popis']);
    if (!Object.keys(zmeny).length) return stary;
    await ad().zapis([{ store: 'pripady', rec: p }, { store: 'historie', rec: zaznamHistorie(p.id, p.id, 'zmena', zmeny, o.nastroj, p.upraveno) }]);
    oznam({ druh: 'pripad', akce: 'zmena', id: p.id, pripad: p.id });
    return p;
  }
  async function smazPripad(id) {
    await ad().smazPripad(id);
    if (aktivni() === id) nastavAktivni(null);
    oznam({ druh: 'pripad', akce: 'smazano', id, pripad: id });
  }
  // nastaví aktivní případ (null = bez spisu); vrátí případ nebo null
  async function otevri(id) {
    const p = id ? await ad().cti('pripady', id) : null;
    if (id && !p) throw new ChybaSpisu('Případ neexistuje.');
    nastavAktivni(p ? p.id : null);
    oznam({ druh: 'aktivni', id: p ? p.id : null, pripad: p ? p.id : null });
    return p;
  }

  /* ---------- entity ---------- */
  async function entita(id) { const e = await ad().cti('entity', id); return e && zdravy('entity', e) ? e : null; }
  const radici = { udalost: (a, b) => String(a.data.kdy || '').localeCompare(String(b.data.kdy || '')),
    stopa: (a, b) => String(a.data.cislo || '').localeCompare(String(b.data.cislo || ''), 'cs', { numeric: true }) };
  // entity aktivního (nebo zadaného) případu; filtr { hledat, smazane, pripad } nebo funkce
  async function seznam(typ, filtr) {
    const f = typeof filtr === 'function' ? { fn: filtr } : (filtr || {});
    let v = await nacti('entity', pid(f.pripad));
    v = v.filter(e => (!typ || e.typ === typ) && (f.smazane || !e.smazano));
    if (f.hledat) {
      const h = bezDiakritiky(f.hledat).trim().split(/\s+/);
      v = v.filter(e => { const t = bezDiakritiky(e.nazev + ' ' + Object.values(e.data).map(x => typeof x === 'object' ? JSON.stringify(x) : x).join(' ')); return h.every(s => t.includes(s)); });
    }
    if (f.fn) v = v.filter(f.fn);
    return v.sort((a, b) => a.typ !== b.typ ? Object.keys(TYPY).indexOf(a.typ) - Object.keys(TYPY).indexOf(b.typ)
      : (radici[a.typ] ? radici[a.typ](a, b) : 0) || a.nazev.localeCompare(b.nazev, 'cs'));
  }
  // založí nebo upraví entitu; vrátí uloženou (beze změny vrátí původní a nic nezapíše)
  // o = { nastroj, historie: 'souhrn' } – souhrn: změněná složená pole se do historie zapíší bez obsahu (viz rozdil)
  async function uloz(vstup, o = {}) {
    if (!jeObjekt(vstup)) throw new ChybaSpisu('Neplatný záznam.');
    const stara = vstup.id ? await entita(vstup.id) : null;
    const pripadId = pid(vstup.pripad || (stara && stara.pripad));
    if (stara && stara.pripad !== pripadId) throw new ChybaSpisu('Záznam patří k jinému případu.');
    if (stara && vstup.typ && vstup.typ !== stara.typ) throw new ChybaSpisu('Záznam s tímto id je jiného typu.');
    if (stara && stara.smazano && !o.vcetneSmazanych) throw new ChybaSpisu('Záznam je smazaný – nejdřív ho obnov.');
    if (!(await ad().cti('pripady', pripadId))) throw new ChybaSpisu('Případ neexistuje.');
    const ted = cas();
    const e = { id: vstup.id || noveId(vstup.typ || 'e'), pripad: pripadId, typ: stara ? stara.typ : vstup.typ, nazev: String(vstup.nazev || '').trim(),
      data: cistiData(stara ? stara.typ : vstup.typ, vstup.data), zdroj: (stara && stara.zdroj) || vstup.zdroj || o.nastroj || 'spis', vytvoreno: stara ? stara.vytvoreno : ted, upraveno: ted };
    if (stara && stara.smazano) e.smazano = stara.smazano;
    const ch = validuj(e);
    if (ch.length) throw new ChybaSpisu(ch.join(' '), ch);
    const zmeny = rozdil(stara, e, null, o.historie === 'souhrn');
    if (stara && !Object.keys(zmeny).length) return stara;
    const akce = stara ? 'zmena' : 'zalozeno';
    await ad().zapis([{ store: 'entity', rec: e }, { store: 'historie', rec: zaznamHistorie(pripadId, e.id, akce, zmeny, o.nastroj, ted, stara && stara.upraveno) }]);
    oznam({ druh: 'entita', akce, id: e.id, typ: e.typ, pripad: pripadId });
    return e;
  }
  // měkké smazání entity nebo vazby (zůstane v historii, jde obnovit)
  async function smaz(id, o = {}) { return prepniSmazani(id, true, o); }
  async function obnov(id, o = {}) { return prepniSmazani(id, false, o); }
  async function prepniSmazani(id, smazat, o) {
    let store = 'entity', r = await ad().cti('entity', id);
    if (!r) { store = 'vazby'; r = await ad().cti('vazby', id); }
    if (!r || !zdravy(store, r)) throw new ChybaSpisu('Záznam neexistuje.');
    if (!!r.smazano === smazat) return r;
    const ted = cas(), predchozi = r.upraveno;
    if (smazat) r.smazano = ted; else delete r.smazano;
    r.upraveno = ted;
    const akce = smazat ? 'smazano' : 'obnoveno';
    await ad().zapis([{ store, rec: r }, { store: 'historie', rec: zaznamHistorie(r.pripad, id, akce, null, o.nastroj, ted, predchozi) }]);
    oznam({ druh: store === 'entity' ? 'entita' : 'vazba', akce, id, typ: r.typ, pripad: r.pripad });
    return r;
  }

  /* ---------- vazby ---------- */
  async function vazba(od, doId, typ, o = {}) {
    const [a, b] = [await entita(od), await entita(doId)];
    if (!a || !b) throw new ChybaSpisu('Vazba vede na neexistující záznam.');
    if (a.pripad !== b.pripad) throw new ChybaSpisu('Vazba musí spojovat záznamy jednoho případu.');
    if (a.smazano || b.smazano) throw new ChybaSpisu('Vazba nemůže vést na smazaný záznam.');
    const ted = cas();
    const v = { id: o.id || noveId('v'), pripad: a.pripad, od, do: doId, typ: String(typ || '').trim(), vytvoreno: ted, upraveno: ted };
    if (o.popis && String(o.popis).trim()) v.popis = String(o.popis).trim();
    if (o.kdy) v.kdy = o.kdy;
    if (o.sila !== undefined && o.sila !== null) v.sila = o.sila;
    const ch = validujVazbu(v);
    if (ch.length) throw new ChybaSpisu(ch.join(' '), ch);
    await ad().zapis([{ store: 'vazby', rec: v }, { store: 'historie', rec: zaznamHistorie(v.pripad, v.id, 'zalozeno', { typ: [null, v.typ], od: [null, od], do: [null, doId] }, o.nastroj, ted) }]);
    oznam({ druh: 'vazba', akce: 'zalozeno', id: v.id, pripad: v.pripad, od, do: doId });
    return v;
  }
  // úprava existující vazby (S2): zmeny ⊂ {od, do, typ, popis, kdy, sila}; prázdná hodnota pole odebere
  // (od/do/typ jsou povinné). Beze změny nic nezapíše a vrátí původní vazbu.
  async function upravVazbu(id, zmeny, o = {}) {
    const stara = await ad().cti('vazby', id);
    if (!stara || !zdravy('vazby', stara)) throw new ChybaSpisu('Vazba neexistuje.');
    const v = Object.assign({}, stara), POLE = ['od', 'do', 'typ', 'popis', 'kdy', 'sila'];
    for (const k of POLE) {
      if (!jeObjekt(zmeny) || !(k in zmeny)) continue;
      const x = typeof zmeny[k] === 'string' ? zmeny[k].trim() : zmeny[k];
      if (x === undefined || x === null || x === '') delete v[k]; else v[k] = x;
    }
    if (v.od !== stara.od || v.do !== stara.do) {
      const [a, b] = [await entita(v.od), await entita(v.do)];
      if (!a || !b) throw new ChybaSpisu('Vazba vede na neexistující záznam.');
      if (a.pripad !== stara.pripad || b.pripad !== stara.pripad) throw new ChybaSpisu('Vazba musí spojovat záznamy jednoho případu.');
      if (a.smazano || b.smazano) throw new ChybaSpisu('Vazba nemůže vést na smazaný záznam.');
    }
    const ch = validujVazbu(v);
    if (ch.length) throw new ChybaSpisu(ch.join(' '), ch);
    const zm = rozdil(stara, v, POLE);
    if (!Object.keys(zm).length) return stara;
    v.upraveno = cas();
    await ad().zapis([{ store: 'vazby', rec: v }, { store: 'historie', rec: zaznamHistorie(v.pripad, id, 'zmena', zm, o.nastroj, v.upraveno, stara.upraveno) }]);
    oznam({ druh: 'vazba', akce: 'zmena', id, pripad: v.pripad, od: v.od, do: v.do });
    return v;
  }
  // vazby, které vedou z/do entity (bez id = všechny vazby aktivního případu); smazané jen s {smazane:true}
  async function vazby(id, o = {}) {
    const p = id ? (await entita(id) || {}).pripad : pid(o.pripad);
    if (!p) return [];
    return (await nacti('vazby', p)).filter(v => (!id || v.od === id || v.do === id) && (o.smazane || !v.smazano))
      .sort((a, b) => String(a.kdy || a.vytvoreno).localeCompare(String(b.kdy || b.vytvoreno)));
  }

  /* ---------- historie ---------- */
  async function historie(id, o = {}) {
    let p = o.pripad;
    if (!p && id) p = ((await ad().cti('entity', id)) || (await ad().cti('vazby', id)) || (await ad().cti('pripady', id)) || {}).pripad || id;
    return (await nacti('historie', pid(p))).filter(h => !id || h.entita === id).sort((a, b) => b.kdy.localeCompare(a.kdy));
  }

  /* ---------- soubory (bloby) ---------- */
  // uloží soubor k případu; id = případ + otisk, takže stejný obsah se neuloží dvakrát
  async function ulozSoubor(data, meta = {}) {
    const pripadId = pid(meta.pripad);
    const blob = data instanceof Blob ? data : new Blob([data], { type: meta.mime || 'application/octet-stream' });
    const sha = await sha256(await blob.arrayBuffer());
    const id = pripadId + ':' + sha;
    const byl = await ad().cti('soubory', id);
    if (byl) return byl;
    const s = { id, pripad: pripadId, nazev: String(meta.nazev || (data && data.name) || 'soubor').slice(0, 300), mime: blob.type || meta.mime || 'application/octet-stream', velikost: blob.size, sha256: sha, blob, vytvoreno: cas() };
    await ad().zapis([{ store: 'soubory', rec: s }]);
    oznam({ druh: 'soubor', akce: 'zalozeno', id, pripad: pripadId });
    return s;
  }
  async function soubor(id) { const s = await ad().cti('soubory', id); return s && s.blob ? s : null; }

  /* ---------- souhrn ---------- */
  async function souhrn(p) {
    const e = await seznam(null, { pripad: p });
    const pocty = Object.fromEntries(Object.keys(TYPY).map(t => [t, 0]));
    for (const x of e) pocty[x.typ]++;
    return { entity: pocty, celkem: e.length, vazby: (await vazby(null, { pripad: p })).length };
  }

  /* ---------- balíček spisu (export / import) ----------
     { format: 'webapp-spis', verze: 1, exportovano, otisk: SHA-256(JSON.stringify(obsah)),
       obsah: { pripad, entity[], vazby[], historie[], soubory[ {…bez blobu, data: base64} ] } }
     Otisk chrání proti poškození souboru při přenosu, ne proti úmyslné úpravě (lze ho přepočítat) –
     proto import každý záznam ještě validuje a obsah souborů ověřuje proti jejich otisku. */
  async function exportuj(id) {
    const p = await pripad(id);
    if (!p) throw new ChybaSpisu('Případ neexistuje.');
    const soubory = [];
    for (const s of await nacti('soubory', p.id)) {
      if (!s.blob) continue;
      const { blob, ...bez } = s;
      soubory.push(Object.assign(bez, { data: naBase64(await blob.arrayBuffer()) }));
    }
    const obsah = { pripad: p, entity: await nacti('entity', p.id), vazby: await nacti('vazby', p.id), historie: await nacti('historie', p.id), soubory };
    // text obsahu se do balíčku vloží přímo (stejný výsledek jako JSON.stringify celku, jen bez druhé kopie v paměti)
    try {
      const text = JSON.stringify(obsah);
      soubory.length = 0;
      const hlava = JSON.stringify({ format: FORMAT, verze: VERZE, exportovano: cas(), otisk: await sha256(text) });
      return hlava.slice(0, -1) + ',"obsah":' + text + '}';
    } catch (e) {
      if (e instanceof RangeError) throw new ChybaSpisu('Balíček je příliš velký pro jeden soubor (prohlížeč neudrží tak dlouhý text) – soubory případu mají dohromady stovky MB. Zmenšete nebo odeberte velké fotky.');
      throw e;
    }
  }

  async function importuj(text, o = {}) {
    let b;
    try { b = JSON.parse(text); } catch (e) { throw new ChybaSpisu('Soubor není platný JSON – není to balíček spisu, nebo je poškozený.'); }
    if (!jeObjekt(b) || b.format !== FORMAT) throw new ChybaSpisu('Soubor není balíček spisu.');
    if (!Number.isInteger(b.verze) || b.verze < 1 || b.verze > VERZE) throw new ChybaSpisu('Balíček má neznámou verzi formátu (' + String(b.verze).slice(0, 20) + ') – aktualizujte stránku.');
    if (!jeObjekt(b.obsah) || typeof b.otisk !== 'string') throw new ChybaSpisu('Balíček je neúplný.');
    if (await sha256(JSON.stringify(b.obsah)) !== b.otisk) throw new ChybaSpisu('Otisk balíčku nesouhlasí – soubor byl poškozen nebo změněn. Import se neprovedl.');
    const O = b.obsah, P = O.pripad;
    const chP = validujPripad(P);
    if (chP.length) throw new ChybaSpisu('Balíček obsahuje neplatný případ: ' + chP.join(' '));
    for (const k of ['entity', 'vazby', 'historie', 'soubory']) if (!Array.isArray(O[k])) throw new ChybaSpisu('Balíček je neúplný (' + k + ').');

    const vysl = { pripad: P.id, nazev: P.nazev, nove: 0, aktualizovane: 0, stejne: 0, ponechane: 0, konflikty: [], vynechane: [] };
    const vynech = (druh, r, duvod) => vysl.vynechane.push({ druh, id: jeObjekt(r) && typeof r.id === 'string' ? r.id.slice(0, 160) : '?', duvod });
    const ops = [];
    const stary = await ad().cti('pripady', P.id);
    const p = { id: P.id, nazev: P.nazev.trim(), cislo: P.cislo || '', popis: P.popis || '', vytvoreno: P.vytvoreno || cas(), upraveno: P.upraveno || cas() };
    if (P.model === true) p.model = true;
    if (!stary || String(p.upraveno) > String(stary.upraveno || '')) ops.push({ store: 'pripady', rec: p });

    // historie: obě strany – podle ní se pozná, zda jedna verze záznamu jen navazuje na druhou (není konflikt)
    const histDobra = O.historie.filter(h => {
      const ok = jeObjekt(h) && typeof h.id === 'string' && RE_ID.test(h.id) && h.pripad === P.id && typeof h.entita === 'string' && RE_ID.test(h.entita)
        && typeof h.kdy === 'string' && RE_CAS.test(h.kdy) && typeof h.akce === 'string' && h.akce.length <= 40
        && (h.nastroj === undefined || (typeof h.nastroj === 'string' && h.nastroj.length <= 80)) && (h.zmeny === undefined || jeObjekt(h.zmeny))
        && (h.predchozi === undefined || (typeof h.predchozi === 'string' && RE_CAS.test(h.predchozi)));
      if (!ok) vynech('historie', h, 'neplatný záznam historie');
      return ok;
    });
    const mistniHist = await nacti('historie', P.id);
    const rodic = new Map();
    for (const h of [...mistniHist, ...histDobra]) if (h.predchozi) rodic.set(h.entita + '|' + h.kdy, h.predchozi);
    // je verze `stara` předkem verze `nova` (nova z ní vyšla, třeba přes další úpravy)?
    const predek = (id, nova, stara) => { for (let t = nova, n = 0; t && n < 100000; t = rodic.get(id + '|' + t), n++) if (t === stara) return true; return false; };
    const mistniIdHist = new Set(mistniHist.map(h => h.id));
    for (const h of histDobra) if (!mistniIdHist.has(h.id)) ops.push({ store: 'historie', rec: h });

    async function slouc(store, druh, r, chyby) {
      if (chyby.length) return vynech(druh, r, chyby.join(' '));
      if (r.pripad !== P.id) return vynech(druh, r, 'patří k jinému případu');
      const loc = await ad().cti(store, r.id);
      if (loc && loc.pripad !== P.id) return vynech(druh, r, 'id koliduje se záznamem jiného případu');
      if (!loc) { vysl.nove++; return ops.push({ store, rec: r }); }
      if (JSON.stringify(loc) === JSON.stringify(r)) return vysl.stejne++;
      const novejsi = String(r.upraveno || '') > String(loc.upraveno || '');
      // konflikt = obě verze se změnily nezávisle (ani jedna nenavazuje na druhou)
      const navazuje = novejsi ? predek(r.id, r.upraveno, loc.upraveno) : predek(r.id, loc.upraveno, r.upraveno);
      if (!navazuje) vysl.konflikty.push({ druh, id: r.id, nazev: druh === 'entita' ? r.nazev : nazevVazby(r.typ), mistni: loc.upraveno || '', soubor: r.upraveno || '', vyhral: novejsi ? 'soubor' : 'mistni' });
      if (novejsi) { vysl.aktualizovane++; ops.push({ store, rec: r }); } else vysl.ponechane++;
    }
    for (const e of O.entity) await slouc('entity', 'entita', e, validuj(e));
    for (const v of O.vazby) await slouc('vazby', 'vazba', v, validujVazbu(v));
    for (const s of O.soubory) {
      if (!jeObjekt(s) || typeof s.data !== 'string' || typeof s.sha256 !== 'string' || !RE_SHA.test(s.sha256) || s.id !== P.id + ':' + s.sha256) { vynech('soubor', s, 'neplatný záznam souboru'); continue; }
      let u;
      try { u = zBase64(s.data); } catch (e) { vynech('soubor', s, 'poškozená data'); continue; }
      if (await sha256(u) !== s.sha256) { vynech('soubor', s, 'obsah nesouhlasí s otiskem'); continue; }
      if (await ad().cti('soubory', s.id)) { vysl.stejne++; continue; }
      const mime = typeof s.mime === 'string' && /^[\w.+-]+\/[\w.+-]+$/.test(s.mime) ? s.mime : 'application/octet-stream';
      ops.push({ store: 'soubory', rec: { id: s.id, pripad: P.id, nazev: String(s.nazev || 'soubor').slice(0, 300), mime, velikost: u.length, sha256: s.sha256, blob: new Blob([u], { type: mime }), vytvoreno: typeof s.vytvoreno === 'string' && RE_CAS.test(s.vytvoreno) ? s.vytvoreno : cas() } });
      vysl.nove++;
    }
    ops.push({ store: 'historie', rec: zaznamHistorie(P.id, P.id, 'import', { nove: [null, vysl.nove], aktualizovane: [null, vysl.aktualizovane], konflikty: [null, vysl.konflikty.length] }, o.nastroj) });
    await ad().zapis(ops);
    oznam({ druh: 'import', id: P.id, pripad: P.id });
    return vysl;
  }

  /* ---------- modelový případ 17/2026 ----------
     Z window.MODELOVY_PRIPAD (vysetrovani/pripad.js). Pevná id → opakované založení jen doplní chybějící záznamy,
     úpravy uživatele nepřepíše a nic nezdvojí. */
  function modelovaData(M) {
    const p = 'model-' + M.id, ted = cas();
    const E = [], V = [];
    const ent = (id, typ, nazev, data) => E.push({ id: p + '-' + id, pripad: p, typ, nazev, data: cistiData(typ, data), zdroj: 'modelovy-pripad', vytvoreno: ted, upraveno: ted });
    const vaz = (id, od, doId, typ, popis, kdy) => V.push(Object.assign({ id: p + '-' + id, pripad: p, od: p + '-' + od, do: p + '-' + doId, typ, vytvoreno: ted, upraveno: ted }, popis ? { popis } : {}, kdy ? { kdy } : {}));
    const mistoPodleNazvu = {};
    for (const [k, m] of Object.entries(M.mista || {})) { ent('misto-' + k, 'misto', m.nazev, { lat: m.lat, lon: m.lon }); mistoPodleNazvu[m.nazev] = 'misto-' + k; }
    const telefonOsoby = {};
    for (const o of M.osoby || []) {
      ent('osoba-' + o.id, 'osoba', o.jmeno, { role: o.role, popis: o.popis, vyska: o.vyska });
      if (o.telefon) { ent('telefon-' + o.id, 'telefon', o.telefon + ' (' + o.jmeno + ')', { cislo: o.telefon }); vaz('drzi-telefon-' + o.id, 'osoba-' + o.id, 'telefon-' + o.id, 'drzitel'); telefonOsoby[o.id] = 'telefon-' + o.id; }
    }
    for (const v of M.vozidla || []) {
      ent('vozidlo-' + v.id, 'vozidlo', v.rz + ' – ' + v.popis.split(',')[0], { rz: v.rz, popis: v.popis });
      if (v.drzitel) vaz('drzi-vozidlo-' + v.id, 'osoba-' + v.drzitel, 'vozidlo-' + v.id, 'drzitel');
    }
    for (const d of M.dukazy || []) ent('stopa-' + d.c, 'stopa', d.nazev, { cislo: d.c, druh: d.druh, misto: d.misto, zajistil: d.zajistil, kdy: d.kdy, obal: d.obal, stav: d.stav, sha256: d.sha256 });
    (M.udalosti || []).forEach((u, i) => {
      const nazev = u.text.length > 90 ? u.text.slice(0, 88).replace(/\s+\S*$/, '') + '…' : u.text;
      ent('udalost-' + (i + 1), 'udalost', nazev, { kdy: u.kdy, do: u.do, druh: u.typ, jistota: u.jistota, nejistota: u.nejistota,
        osoby: (u.osoby || []).map(o => p + '-osoba-' + o), misto: mistoPodleNazvu[u.misto] ? p + '-' + mistoPodleNazvu[u.misto] : undefined, zdroj: u.zdroj, popis: u.text });
    });
    (M.hovory || []).forEach((h, i) => vaz('hovor-' + (i + 1), telefonOsoby[h.od] || 'osoba-' + h.od, telefonOsoby[h.komu] || 'osoba-' + h.komu, 'hovor', h.s + ' s', h.kdy));
    return { pripad: { id: p, cislo: M.cislo, nazev: M.nazev, popis: M.shrnuti, model: true, vytvoreno: ted, upraveno: ted }, entity: E, vazby: V };
  }
  async function zalozModelovy(M, o = {}) {
    M = M || koren.MODELOVY_PRIPAD;
    if (!M) throw new ChybaSpisu('Data modelového případu nejsou načtená.');
    const D = modelovaData(M), ops = [], nastroj = o.nastroj || 'modelovy-pripad';
    if (!(await ad().cti('pripady', D.pripad.id))) {
      ops.push({ store: 'pripady', rec: D.pripad }, { store: 'historie', rec: zaznamHistorie(D.pripad.id, D.pripad.id, 'zalozeno', null, nastroj) });
    }
    let pridano = 0;
    for (const [store, seznamZ, val] of [['entity', D.entity, validuj], ['vazby', D.vazby, validujVazbu]]) {
      for (const r of seznamZ) {
        const ch = val(r);
        if (ch.length) throw new ChybaSpisu('Modelový případ: ' + r.id + ' – ' + ch.join(' '));
        if (await ad().cti(store, r.id)) continue;
        ops.push({ store, rec: r }, { store: 'historie', rec: zaznamHistorie(r.pripad, r.id, 'zalozeno', null, nastroj, r.vytvoreno) });
        pridano++;
      }
    }
    await ad().zapis(ops);
    if (ops.length) oznam({ druh: 'import', id: D.pripad.id, pripad: D.pripad.id });
    return { pripad: D.pripad.id, pridano };
  }

  /* ---------- drobnosti pro UI (sdílí vyber.js, karta.js, ui.js) ---------- */
  // prvek s atributy a potomky; text jde vždy přes textContent (žádné innerHTML z dat)
  function el(tag, atr, ...deti) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(atr || {})) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'text') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (k === 'dataset') Object.assign(e.dataset, v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const d of deti.flat()) if (d !== null && d !== undefined && d !== false) e.append(d instanceof Node ? d : String(d));
    return e;
  }
  const formatCas = s => {
    if (!s) return '';
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(s);
    if (!m) return String(s);
    // s „Z“ = okamžik uložení (UTC) → místní čas; bez „Z“ = čas zadaný uživatelem tak, jak je
    if (/Z$/.test(s)) { const d = new Date(s); return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }
    return `${+m[3]}. ${+m[2]}. ${m[1]} ${m[4]}:${m[5]}`;
  };
  // otevření stránky webu – v rozcestníku záložkou, samostatně přímo
  function otevriStranku(soubor) {
    let vRozc = false;
    try { vRozc = window.parent !== window && window.parent.location.origin === location.origin; } catch (e) { /* cizí rodič */ }
    if (vRozc) window.parent.postMessage({ otevri: 'obsah/' + soubor }, '*');
    else location.href = soubor;
  }

  const SPIS = {
    DB, KLIC_AKTIVNI, FORMAT, VERZE, TYPY, VAZBY, nazevVazby, ChybaSpisu,
    pametovyAdapter, nastavUloziste(a) { A = a; poskozenych = 0; }, get poskozenych() { return poskozenych; },
    aktivni, otevri, pripady, pripad, zalozPripad, ulozPripad, smazPripad,
    entita, seznam, uloz, smaz, obnov, vazba, upravVazbu, vazby, historie, ulozSoubor, soubor, souhrn,
    validuj, validujVazbu, exportuj, importuj, zalozModelovy, modelovaData, sha256,
    odebirej, zavri() { if (kanal) kanal.close(); kanal = null; odberatele.clear(); },
    el, formatCas, otevriStranku
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = SPIS;
  else koren.SPIS = SPIS;
})(typeof window !== 'undefined' ? window : globalThis);

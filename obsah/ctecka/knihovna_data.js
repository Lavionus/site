/* Čtečka knih – data knihovny bez UI (window.KNIH_DATA): IndexedDB, uložení převedené knihy, pokrok,
   série, knihy z webu (obsah/knihy/vlastni/seznam.json), záloha celé knihovny do ZIP, čtenářský deník.
   IndexedDB webapp_ctecka_knih: „meta“ = údaje o knize (+ obalkaBlob), „obsah“ = {id, md: {soubor: text}, obrazky: {jméno: Blob}}.
   localStorage: webapp_ctecka_knih (nastavení knihovny), webapp_ctecka_knih_<id> (+ _poznamky) = stav čtečky. */
(function (koren) {
  'use strict';
  const J = koren.KRONIKY_JADRO, P = koren.CTECKA_PREVOD;
  const KLIC = 'webapp_ctecka_knih', klicKnihy = id => KLIC + '_' + id;
  const WEB = 'knihy/vlastni/';
  const cti = k => { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch (e) { return {}; } };

  /* ---------- IndexedDB ---------- */
  let dbSlib = null;
  const db = () => dbSlib || (dbSlib = new Promise((ok, ko) => {
    const r = indexedDB.open('webapp_ctecka_knih', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('meta', { keyPath: 'id' }); r.result.createObjectStore('obsah', { keyPath: 'id' }); };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  }));
  const tx = async (store, rezim, fn) => {
    const d = await db();
    return new Promise((ok, ko) => {
      const t = d.transaction(store, rezim), r = fn(t.objectStore(store));
      t.oncomplete = () => ok(r && r.result);
      t.onerror = t.onabort = () => ko(t.error);
    });
  };
  const vsechnyMeta = () => tx('meta', 'readonly', s => s.getAll());
  const metaKnihy = id => tx('meta', 'readonly', s => s.get(id));
  const obsahKnihy = id => tx('obsah', 'readonly', s => s.get(id));
  const ulozMeta = m => tx('meta', 'readwrite', s => s.put(m));
  const ulozObsah = o => tx('obsah', 'readwrite', s => s.put(o));
  async function smazKnihu(id) {
    await tx('meta', 'readwrite', s => s.delete(id));
    await tx('obsah', 'readwrite', s => s.delete(id));
    [klicKnihy(id), klicKnihy(id) + '_poznamky'].forEach(k => localStorage.removeItem(k));
  }
  const noveId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const slug = t => J.normalizuj(String(t || '')).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  const slovMd = md => J.rozeber(md).reduce((s, b) => s + J.slov(b.text), 0);

  // Jména souborů kapitol podle názvu (ne pořadí) – pozice čtení a záložky přežijí vložení kapitoly v nové verzi knihy.
  function kapitolySeJmeny(kapitoly) {
    const pouzite = new Set(), md = {};
    const seznam = kapitoly.map(c => {
      const zaklad = slug(c.nazev) || 'kapitola';
      let s = zaklad, n = 2;
      while (pouzite.has(s)) s = zaklad + '-' + n++;
      pouzite.add(s);
      md[s + '.md'] = c.md;
      return { soubor: s + '.md', nazev: c.nazev, slov: slovMd(c.md) };
    });
    return { seznam, md };
  }

  // kniha z převodníku (P.nactiSoubor / knihaZWebu) → uložená kniha; puvodni = aktualizace existující (id, pokrok, úpravy zůstanou)
  async function ulozKnihu(k, puvodni = null, navic = {}) {
    const { seznam, md } = kapitolySeJmeny(k.kapitoly);
    const odhad = !k.serie && (P.serieZNazvu(k.nazev) || P.serieZNazvu(String(k.soubor || '').replace(/\.[a-z0-9]+$/i, '')));
    const p = puvodni || {};
    const rucne = p.rucne || {};   // co uživatel upravil ručně, aktualizace z webu nepřepíše
    const meta = {
      ...p,
      id: p.id || noveId(),
      nazev: rucne.nazev ? p.nazev : (k.nazev || '').trim() || 'Bez názvu',
      autor: rucne.autor ? p.autor : (k.autor || '').trim(),
      serie: rucne.serie ? p.serie : (k.serie || (odhad && odhad.serie) || ''),
      dil: rucne.serie ? p.dil : (k.serie ? k.dil : odhad ? odhad.dil : null),
      format: k.format, soubor: k.soubor, velikost: k.velikost,
      pridano: p.pridano || Date.now(), otevreno: p.otevreno || 0,
      kapitoly: seznam, slov: seznam.reduce((s, c) => s + c.slov, 0),
      ...(rucne.obalka ? {} : { obalka: k.obalka || null, obalkaBlob: k.obalka ? k.obrazky[k.obalka] : null }),
      ...navic,
    };
    await ulozObsah({ id: meta.id, md, obrazky: k.obrazky || {} });
    await ulozMeta(meta);
    return meta;
  }

  /* ---------- pokrok a stav ---------- */
  const stavKnihy = id => cti(klicKnihy(id));
  function pokrok(m, s = stavKnihy(m.id)) {
    const p = s.pozice && s.pozice.kniha;
    if (!p || !m.slov) return 0;
    const c = m.kapitoly.findIndex(k => k.soubor === p.soubor);
    if (c < 0) return 0;
    return Math.min(1, (m.kapitoly.slice(0, c).reduce((a, k) => a + k.slov, 0) + (p.slov || 0)) / m.slov);
  }
  // ruční označení (m.docteno true/false) má přednost; bez něj je dočtená kniha přečtená do konce
  const docteno = (m, p = pokrok(m)) => m.docteno === true || (m.docteno !== false && p >= 0.999);
  const kapitolaNaPozici = m => { const p = (stavKnihy(m.id).pozice || {}).kniha; const c = p && m.kapitoly.find(k => k.soubor === p.soubor); return c ? c.nazev : ''; };

  /* ---------- knihy z webu (autorovy rukopisy) ---------- */
  // seznam.json generuje tools/vlastni_knihy.py; null = web nedostupný (offline)
  async function seznamWeb(limitMs = 6000) {
    const ac = new AbortController(), t = setTimeout(() => ac.abort(), limitMs);
    try {
      const r = await fetch(WEB + 'seznam.json?t=' + Date.now(), { signal: ac.signal, cache: 'no-cache' });
      if (!r.ok) return r.status === 404 ? [] : null;
      return (await r.json()).knihy || [];
    } catch (e) { return null; } finally { clearTimeout(t); }
  }
  const jmenoSouboru = f => f.split('/').pop().replace(/\.md$/i, '').replace(/^\d+[_\s.-]*/, '').replace(/[_-]+/g, ' ').trim();
  async function knihaZWebu(pol) {
    const nacti = async (f, typ) => {
      const r = await fetch(WEB + f.split('/').map(encodeURIComponent).join('/') + '?h=' + pol.otisk);
      if (!r.ok) throw new Error(`Soubor ${f} na webu chybí (HTTP ${r.status}).`);
      return typ === 'blob' ? r.blob() : r.text();
    };
    const texty = await Promise.all(pol.soubory.map(f => nacti(f)));
    const obr = {};
    await Promise.all([...(pol.obrazky || []), ...(pol.obalka ? [pol.obalka] : [])].map(async f => {
      try { const b = await nacti(f, 'blob'); obr[f.split('/').pop()] = new Blob([b], { type: P.typObrazku(f) || b.type }); } catch (e) { /* chybějící obrázek knihu nezastaví */ }
    }));
    // každý soubor = kapitola; bez vlastního nadpisu dostane jméno souboru
    const casti = texty.map((t, i) => {
      t = t.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
      if (pol.soubory.length > 1) t = t.replace(/^---\n[\s\S]*?\n---\n/, '');
      if (pol.soubory.length > 1 && !/^\s*#\s/.test(t)) t = '# ' + jmenoSouboru(pol.soubory[i]) + '\n\n' + t;
      return t;
    });
    const k = P.zMarkdownu(casti.join('\n\n'), pol.soubory[0], obr);
    const obalka = pol.obalka && obr[pol.obalka.split('/').pop()] ? pol.obalka.split('/').pop() : null;
    if (obalka) k.obrazky[obalka] = obr[obalka];
    return { ...k, nazev: pol.nazev || k.nazev, autor: pol.autor || k.autor, serie: pol.serie || '', dil: pol.dil || null,
      obalka, format: 'web', soubor: pol.id, velikost: pol.slov || 0 };
  }
  const pridejZWebu = async pol => ulozKnihu(await knihaZWebu(pol), null, { web: { id: pol.id, otisk: pol.otisk } });
  // napojené knihy, které se na webu změnily, stáhnout znovu → [názvy aktualizovaných]
  async function aktualizujZWebu(knihy, seznam) {
    if (!seznam) seznam = await seznamWeb();
    if (!seznam) return [];
    const hotovo = [];
    for (const m of knihy) {
      const pol = m.web && seznam.find(x => x.id === m.web.id);
      if (!pol || pol.otisk === m.web.otisk) continue;
      try {
        const nova = await ulozKnihu(await knihaZWebu(pol), m, { web: { id: pol.id, otisk: pol.otisk }, aktualizovano: Date.now() });
        Object.assign(m, nova);
        hotovo.push(m.nazev);
      } catch (e) { /* zkusí se příště */ }
    }
    return hotovo;
  }

  /* ---------- záloha celé knihovny (ZIP bez komprese) ---------- */
  async function zaloha(prubeh = () => {}) {
    const knihy = await vsechnyMeta(), soubory = [], stavy = {};
    for (const [i, m] of knihy.entries()) {
      prubeh(i, knihy.length, m.nazev);
      const o = await obsahKnihy(m.id) || { md: {}, obrazky: {} };
      soubory.push({ name: `knihy/${m.id}/text.json`, data: JSON.stringify(o.md) });
      for (const [jm, b] of Object.entries(o.obrazky || {})) soubory.push({ name: `knihy/${m.id}/obrazky/${jm}`, data: new Uint8Array(await b.arrayBuffer()) });
      if (m.obalkaBlob) soubory.push({ name: `knihy/${m.id}/obalka`, data: new Uint8Array(await m.obalkaBlob.arrayBuffer()) });
      stavy[m.id] = { stav: localStorage.getItem(klicKnihy(m.id)), poznamky: localStorage.getItem(klicKnihy(m.id) + '_poznamky') };
    }
    const metaBez = knihy.map(({ obalkaBlob, ...m }) => ({ ...m, obalkaTyp: obalkaBlob ? obalkaBlob.type : null }));
    soubory.unshift({ name: 'knihovna.json', data: JSON.stringify({ format: 'ctecka-knih-zaloha', verze: 1, cas: Date.now(), nast: cti(KLIC), knihy: metaBez, stavy }) });
    return new Blob([J.zip(soubory)], { type: 'application/zip' });
  }
  // 1. krok: přečíst zálohu a zjistit, kolik knih už v knihovně je
  async function prectiZalohu(soubor) {
    const zip = P.ctiZip(await soubor.arrayBuffer());
    const f = zip.get('knihovna.json');
    const data = f && JSON.parse(new TextDecoder().decode(await f()));
    if (!data || data.format !== 'ctecka-knih-zaloha') throw new Error('Soubor není záloha Čtečky knih.');
    const mam = new Set((await vsechnyMeta()).map(m => m.id));
    return { zip, data, existujici: data.knihy.filter(m => mam.has(m.id)).length };
  }
  // 2. krok: obnovit; prepsat = existující knihy nahradit (jinak přeskočit)
  async function obnovZalohu({ zip, data }, prepsat, prubeh = () => {}) {
    const mam = new Set((await vsechnyMeta()).map(m => m.id));
    let n = 0;
    for (const [i, m] of data.knihy.entries()) {
      prubeh(i, data.knihy.length, m.nazev);
      if (mam.has(m.id) && !prepsat) continue;
      const md = JSON.parse(new TextDecoder().decode(await zip.get(`knihy/${m.id}/text.json`)()));
      const obrazky = {}, predpona = `knihy/${m.id}/obrazky/`;
      for (const [jm, f] of zip) if (jm.startsWith(predpona)) obrazky[jm.slice(predpona.length)] = new Blob([await f()], { type: P.typObrazku(jm) || '' });
      const ob = zip.get(`knihy/${m.id}/obalka`);
      const { obalkaTyp, ...meta } = m;
      meta.obalkaBlob = ob ? new Blob([await ob()], { type: obalkaTyp || 'image/jpeg' }) : null;
      await ulozObsah({ id: m.id, md, obrazky });
      await ulozMeta(meta);
      const s = data.stavy[m.id] || {};
      try {
        if (s.stav) localStorage.setItem(klicKnihy(m.id), s.stav);
        if (s.poznamky) localStorage.setItem(klicKnihy(m.id) + '_poznamky', s.poznamky);
      } catch (e) { /* plné úložiště – kniha je obnovená i bez pokroku */ }
      n++;
    }
    return n;
  }

  /* ---------- čtenářský deník ---------- */
  const rokData = t => t ? new Date(t).getFullYear() : null;
  // statistiky roku: dočtené knihy, slova, čas čtení (ze stavů čtečky po dnech), dočtené po měsících
  function denik(knihy, rok) {
    const doctene = knihy.filter(m => rokData(m.dokonceno) === rok).sort((a, b) => b.dokonceno - a.dokonceno);
    let cas = 0;
    const casMesice = Array(12).fill(0), knihMesice = Array(12).fill(0);
    for (const m of knihy) {
      for (const [den, s] of Object.entries(stavKnihy(m.id).dny || {})) {
        if (+den.slice(0, 4) !== rok) continue;
        cas += s; casMesice[+den.slice(5, 7) - 1] += s;
      }
    }
    doctene.forEach(m => knihMesice[new Date(m.dokonceno).getMonth()]++);
    const roky = [...new Set([new Date().getFullYear(), ...knihy.map(m => rokData(m.dokonceno)).filter(Boolean)])].sort((a, b) => b - a);
    return { doctene, slov: doctene.reduce((s, m) => s + m.slov, 0), cas, casMesice, knihMesice, roky };
  }

  koren.KNIH_DATA = {
    KLIC, klicKnihy, WEB, cti, vsechnyMeta, metaKnihy, obsahKnihy, ulozMeta, ulozObsah, smazKnihu, ulozKnihu, kapitolySeJmeny,
    slovMd, stavKnihy, pokrok, docteno, kapitolaNaPozici, seznamWeb, knihaZWebu, pridejZWebu, aktualizujZWebu,
    zaloha, prectiZalohu, obnovZalohu, denik, slug,
  };
})(window);

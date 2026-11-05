/* Sazba knihy – odkud se bere text: vlastní soubory (IndexedDB), knihy ze Skriptoria, ukázka Kroniky vyhnanství.
   Každý zdroj vrací knihu ve tvaru SAZBA_JADRO (src obrázků = použitelné URL). window.SAZBA_ZDROJE. */
(function () {
  'use strict';
  const J = window.SAZBA_JADRO;
  const absolutni = rel => new URL(rel, location.href).href;
  const bezPripony = s => String(s).replace(/\.[a-z0-9]+$/i, '');
  const zaklad = s => String(s).split(/[\\/]/).pop();

  /* ---------- IndexedDB (jeden objektový sklad klíč → hodnota) ---------- */
  function otevriDb(jmeno, sklad, verze = 1, vytvor = true) {
    return new Promise((ok, chyba) => {
      const r = indexedDB.open(jmeno, verze);
      r.onupgradeneeded = () => { if (vytvor) r.result.createObjectStore(sklad); else r.transaction.abort(); };
      r.onsuccess = () => ok(r.result);
      r.onerror = () => chyba(r.error);
    });
  }
  const dbPrikaz = (db, sklad, rezim, fn) => new Promise((ok, chyba) => {
    const t = db.transaction(sklad, rezim), r = fn(t.objectStore(sklad));
    t.oncomplete = () => ok(r && r.result); t.onerror = () => chyba(t.error);
  });
  let mojeDb = null;
  const db = () => mojeDb || (mojeDb = otevriDb('webapp_sazba', 'kv'));
  const cti = async klic => dbPrikaz(await db(), 'kv', 'readonly', s => s.get(klic));
  const zapis = async (klic, hodnota) => dbPrikaz(await db(), 'kv', 'readwrite', s => hodnota === undefined ? s.delete(klic) : s.put(hodnota, klic));

  /* ---------- HTML (Skriptorium, .html soubory) → bloky ---------- */
  const POVOLENE = { EM: 'em', I: 'em', STRONG: 'strong', B: 'strong', U: 'u', S: 's', SUP: 'sup', SUB: 'sub', BR: 'br', SMALL: 'small' };
  function inline(uzel) {
    let h = '';
    uzel.childNodes.forEach(n => {
      if (n.nodeType === 3) h += J.esc(n.textContent.replace(/\s+/g, ' '));
      else if (n.nodeType === 1 && n.tagName !== 'IMG') {
        const t = POVOLENE[n.tagName];
        h += t === 'br' ? '<br>' : t ? `<${t}>${inline(n)}</${t}>` : inline(n);
      }
    });
    return h;
  }
  function zHtml(html) {
    const bloky = [];
    const projdi = rodic => rodic.childNodes.forEach(n => {
      if (n.nodeType === 3) { if (n.textContent.trim()) bloky.push({ typ: 'p', html: J.esc(n.textContent.trim()) }); return; }
      if (n.nodeType !== 1) return;
      const tag = n.tagName;
      const obr = [...(tag === 'IMG' ? [n] : n.querySelectorAll('img'))];
      if (tag === 'H1') bloky.push({ typ: 'h', html: inline(n).trim(), text: n.textContent.trim() });
      else if (/^H[2-6]$/.test(tag)) bloky.push({ typ: 'h2', html: inline(n).trim() });
      else if (tag === 'HR') bloky.push({ typ: 'hr' });
      else if (tag === 'BLOCKQUOTE') bloky.push({ typ: 'citace', html: inline(n).trim() });
      else if (tag === 'UL' || tag === 'OL') bloky.push({ typ: 'seznam', cislovany: tag === 'OL', polozky: [...n.children].map(li => inline(li).trim()) });
      else if (tag === 'FIGURE' || tag === 'IMG' || (obr.length && !n.textContent.trim())) {
        const popis = n.querySelector && n.querySelector('figcaption');
        obr.forEach(i => bloky.push({ typ: 'img', src: i.getAttribute('src'), popis: popis ? popis.textContent.trim() : (i.getAttribute('alt') || '') }));
      } else if (['DIV', 'SECTION', 'ARTICLE', 'MAIN', 'BODY'].includes(tag) && n.querySelector('p,h1,h2,h3,div,ul,ol,blockquote,figure,hr')) projdi(n);
      else {
        const t = inline(n).trim();
        if (/^(\*\s*){1,3}$|^⁂$|^❦$/.test(n.textContent.trim())) bloky.push({ typ: 'hr' });
        else if (t && t !== '<br>') bloky.push({ typ: 'p', html: t });
        obr.forEach(i => bloky.push({ typ: 'img', src: i.getAttribute('src'), popis: i.getAttribute('alt') || '' }));
      }
    });
    projdi(new DOMParser().parseFromString(html, 'text/html').body);
    return bloky;
  }
  // bloky s nadpisy H1 → kapitoly
  function doKapitol(bloky, vychoziNazev) {
    const kap = [];
    for (const b of bloky) {
      if (b.typ === 'h') kap.push({ nazev: b.text || b.html.replace(/<[^>]+>/g, ''), bloky: [b] });
      else { if (!kap.length) kap.push({ nazev: vychoziNazev, bloky: [] }); kap[kap.length - 1].bloky.push(b); }
    }
    return kap.filter(k => k.bloky.some(b => b.typ !== 'h') || k.nazev);
  }

  /* ---------- knihy společné čtečky (Kroniky vyhnanství, povídky…; ukázka i volání ze čtečky) ----------
     Seznam děl je v knihy/dila.json (generuje tools/knihy_export.py), knihy díla v knihy/<dilo>/knihy.json. */
  const dilaJson = () => fetch('knihy/dila.json', { cache: 'no-cache' }).then(r => r.json());
  const knihyDila = d => fetch(d.data + 'knihy.json', { cache: 'no-cache' }).then(r => r.json());
  const kroniky = {
    async seznam() {
      const dila = await dilaJson();
      const vysl = [];
      for (const d of dila) (await knihyDila(d)).forEach(x => vysl.push({ dilo: d.id, ikona: d.ikona, dilNazev: d.nazev, id: x.id, nazev: x.nazev }));
      return vysl;
    },
    async nacti(id, diloId = 'kroniky') {
      const d = (await dilaJson()).find(x => x.id === diloId);
      if (!d) throw new Error('Neznámé dílo ' + diloId);
      const knihy = await knihyDila(d);
      const k = knihy.find(x => x.id === id) || knihy[0];
      const cesta = src => `${d.data}${k.id}/${src}`;
      const texty = await Promise.all(k.kapitoly.map(c => fetch(cesta(c.soubor)).then(r => {
        if (!r.ok) throw new Error('Kapitolu ' + c.nazev + ' se nepodařilo načíst');
        return r.text();
      })));
      const kapitoly = texty.map((t, i) => {
        const c = J.rozeberMarkdown(t, k.kapitoly[i].nazev)[0] || { bloky: [] };
        c.nazev = k.kapitoly[i].nazev;
        c.bloky.forEach(b => { if (b.typ === 'img') b.src = absolutni(cesta(b.src)); });
        return c;
      });
      const r = J.rozdelNazev(k.nazev);
      return {
        nazev: r.nazev, dil: r.znak, podtitul: k.podtitul, serie: d.nazev, ikona: d.ikona, autor: '', jazyk: 'cs',
        obalka: k.obalka ? absolutni(cesta(k.obalka)) : null, obalkaBarva: '#3b3026', zadniText: '', kapitoly
      };
    }
  };

  /* ---------- Skriptorium (stejný původ → čte jeho IndexedDB, jinak localStorage) ---------- */
  const skriptorium = {
    async data() {
      let s = null;
      try {
        const d = await otevriDb('skriptoriumDB', 'kv', 1, false);
        s = await dbPrikaz(d, 'kv', 'readonly', st => st.get('skriptorium.v1'));
        d.close();
      } catch (e) { /* Skriptorium ještě nikdy neběželo */ }
      if (!s) try { s = JSON.parse(localStorage.getItem('skriptorium.v1') || 'null'); } catch (e) {}
      return s && Array.isArray(s.books) ? s.books.filter(b => !b.deleted) : [];
    },
    async seznam() { return (await this.data()).map(b => ({ id: b.id, nazev: b.title || 'Bez názvu' })); },
    async nacti(id) {
      const b = (await this.data()).find(x => x.id === id);
      if (!b) throw new Error('Knihu ve Skriptoriu jsem nenašel.');
      const c = b.cover || {}, z = b.back || {};
      return {
        nazev: b.title || '', podtitul: b.subtitle || '', serie: '', dil: '', autor: b.author || '',
        jazyk: J.JAZYKY[b.lang] ? b.lang : 'cs', obalka: c.img || null, obalkaBarva: c.bg1 || '#39558c',
        zadniText: z.text || b.desc || '',
        kapitoly: (b.chapters || []).map(ch => ({ nazev: ch.title || '', bloky: zHtml(ch.html || '').map(x => x.typ === 'h' ? { typ: 'h2', html: x.html } : x) }))
      };
    }
  };

  /* ---------- Vlastní kniha: texty a obrázky v IndexedDB ---------- */
  let url = {};   // jméno obrázku → blob URL (uvolní se při dalším sestavení)
  const vlastni = {
    async nacti() { return (await cti('projekt')) || { soubory: [], obrazky: {} }; },
    uloz: p => zapis('projekt', p),
    // soubory z <input type=file> / přetažení → do projektu (texty se přidají na konec, obrázky podle jména)
    async pridej(p, soubory) {
      let textu = 0, obrazku = 0;
      for (const f of soubory) {
        if (/^image\//.test(f.type)) { p.obrazky[zaklad(f.name)] = f; obrazku++; }
        else if (/\.(md|markdown|txt|html?)$/i.test(f.name) || /^text\//.test(f.type)) {
          p.soubory.push({ jmeno: f.name, text: await f.text() }); textu++;
        }
      }
      await this.uloz(p);
      return { textu, obrazku };
    },
    kniha(p) {
      Object.values(url).forEach(u => URL.revokeObjectURL(u));
      url = {};
      const chybi = new Set();
      const kapitoly = [];
      for (const s of p.soubory) {
        const nazev = bezPripony(s.jmeno).replace(/^\d+[_\- .]+/, '').replace(/[_]+/g, ' ');
        const kap = /\.html?$/i.test(s.jmeno) ? doKapitol(zHtml(s.text), nazev) : J.rozeberMarkdown(s.text, nazev);
        kapitoly.push(...kap);
      }
      kapitoly.forEach(k => k.bloky.forEach(b => {
        if (b.typ !== 'img' || /^(https?:|data:|blob:)/.test(b.src)) return;
        const jm = zaklad(decodeURIComponent(b.src));
        if (p.obrazky[jm]) b.src = url[jm] || (url[jm] = URL.createObjectURL(p.obrazky[jm]));
        else { chybi.add(jm); b.src = ''; }
      }));
      return { kniha: { nazev: '', podtitul: '', serie: '', dil: '', autor: '', jazyk: 'cs', obalka: null, obalkaBarva: '#2c3e50', zadniText: '', kapitoly }, chybi: [...chybi] };
    }
  };

  // vlastní obálka (obrázek) k libovolnému zdroji
  const obalka = {
    nacti: klic => cti('obalka:' + klic),
    uloz: (klic, blob) => zapis('obalka:' + klic, blob || undefined)
  };

  window.SAZBA_ZDROJE = { kroniky, skriptorium, vlastni, obalka, zHtml, doKapitol };
})();

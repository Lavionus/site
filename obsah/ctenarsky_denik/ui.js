/* Čtenářský deník – rozhraní. Data: IndexedDB (knihy + obálky), drobnosti v localStorage. */
(function () {
  'use strict';
  const J = window.CtenarJadro;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const dnes = () => J.dnesIso();
  const POLICE_MAPA = Object.fromEntries(J.POLICE.map(p => [p.id, p.nazev]));
  const MESICE = ['led', 'úno', 'bře', 'dub', 'kvě', 'čvn', 'čvc', 'srp', 'zář', 'říj', 'lis', 'pro'];
  if (window.self === window.top) document.body.classList.add('samostatne');

  /* ---------- úložiště ---------- */
  const DB_JMENO = J.KLIC;
  let dbSlib = null;
  function db() {
    if (!dbSlib) dbSlib = new Promise((ok, chyba) => {
      const r = indexedDB.open(DB_JMENO, 1);
      r.onupgradeneeded = () => { r.result.createObjectStore('knihy', { keyPath: 'id' }); r.result.createObjectStore('obalky'); };
      r.onsuccess = () => ok(r.result);
      r.onerror = () => chyba(r.error);
    });
    return dbSlib;
  }
  async function tx(store, rezim, fn) {
    const d = await db();
    return new Promise((ok, chyba) => {
      const t = d.transaction(store, rezim), s = t.objectStore(Array.isArray(store) ? store[0] : store);
      let vysl; const r = fn(s);
      if (r) r.onsuccess = () => { vysl = r.result; };
      t.oncomplete = () => ok(vysl);
      t.onerror = () => chyba(t.error);
      t.onabort = () => chyba(t.error || new Error('Zápis přerušen (plné úložiště?)'));
    });
  }
  const ulozKnihu = k => tx('knihy', 'readwrite', s => s.put(k)).catch(e => Dialog.chyba('Uložení selhalo: ' + e.message));
  const smazKnihuDb = id => tx(['knihy', 'obalky'], 'readwrite', s => { s.transaction.objectStore('obalky').delete(id); return s.delete(id); });
  const ulozObalku = (id, blob) => tx('obalky', 'readwrite', s => s.put(blob, id));
  const smazObalku = id => tx('obalky', 'readwrite', s => s.delete(id));
  const nactiObalku = id => tx('obalky', 'readonly', s => s.get(id));
  function ls(klic, hodnota) {
    try {
      if (hodnota === undefined) return JSON.parse(localStorage.getItem(J.KLIC + '_' + klic));
      localStorage.setItem(J.KLIC + '_' + klic, JSON.stringify(hodnota));
    } catch (e) { return null; }
  }

  let knihy = [];
  const urlObalek = new Map();   // id → objectURL
  async function urlObalky(k) {
    if (!k.obalka) return '';
    if (urlObalek.has(k.id)) return urlObalek.get(k.id);
    const b = await nactiObalku(k.id).catch(() => null);
    const u = b ? URL.createObjectURL(b) : '';
    urlObalek.set(k.id, u);
    return u;
  }
  function zapomenObalku(id) { const u = urlObalek.get(id); if (u) URL.revokeObjectURL(u); urlObalek.delete(id); }
  /* obálky se do karet doplní až po vykreslení (asynchronně z IndexedDB) */
  function doplnObalky(koren) {
    koren.querySelectorAll('[data-obalka]').forEach(async el => {
      const k = knihy.find(x => x.id === el.dataset.obalka);
      const u = k && await urlObalky(k);
      if (u && el.isConnected) el.innerHTML = `<img src="${u}" alt="">`;
    });
  }
  const obalkaHtml = (k, velka) => `<div class="obalka${velka ? ' velka' : ''}"${k.obalka ? ` data-obalka="${esc(k.id)}"` : ''} aria-hidden="true">📕</div>`;

  /* ---------- síť ---------- */
  async function stahni(url, typ) {
    const ac = new AbortController(), t = setTimeout(() => ac.abort(), 15000);
    try {
      const r = await fetch(url, { signal: ac.signal });
      if (r.status === 429) throw new Error('služba hlásí překročený limit dotazů (zkuste později)');
      if (!r.ok) throw Object.assign(new Error('HTTP ' + r.status), { status: r.status });
      return typ === 'blob' ? await r.blob() : await r.json();
    } catch (e) {
      if (e.name === 'AbortError') throw new Error('služba neodpověděla včas');
      if (e instanceof TypeError) throw new Error(navigator.onLine === false ? 'jste offline' : 'služba není dostupná');
      throw e;
    } finally { clearTimeout(t); }
  }
  /* ISBN → { kniha, coverId|obalkaUrl, zdroj } nebo { chyby } */
  async function najdiIsbn(isbn) {
    const chyby = [];
    try {
      const r = J.zOpenLibrary(await stahni(J.urlOLIsbn(isbn)), isbn);
      if (r) return r;
      const h = J.zOpenLibraryHledani(await stahni(J.urlOLHledej('isbn:' + isbn, 1)));
      if (h.length) { h[0].kniha.isbn = isbn; return h[0]; }
      chyby.push('Open Library: nenalezeno');
    } catch (e) { chyby.push('Open Library: ' + e.message); }
    try {
      const r = J.zGoogleBooks(await stahni(J.urlGoogle(isbn)), isbn);
      if (r) return r;
      chyby.push('Google Books: nenalezeno');
    } catch (e) { chyby.push('Google Books: ' + e.message); }
    return { chyby };
  }
  async function stahniObalku(r) {
    const url = r.coverId ? J.urlOLObalka(r.coverId) : r.obalkaUrl;
    if (!url) return null;
    try { const b = await stahni(url, 'blob'); return b.size > 1000 && /^image\//.test(b.type) ? b : null; } catch (e) { return null; }
  }
  /* zmenšení vlastní fotky obálky na max 600 px */
  async function zmensi(soubor) {
    const obr = await createImageBitmap(soubor);
    const m = Math.min(1, 600 / Math.max(obr.width, obr.height));
    const c = document.createElement('canvas');
    c.width = Math.round(obr.width * m); c.height = Math.round(obr.height * m);
    c.getContext('2d').drawImage(obr, 0, 0, c.width, c.height); obr.close();
    return new Promise(ok => c.toBlob(ok, 'image/jpeg', 0.85));
  }

  /* ---------- stav pohledu ---------- */
  let pohled = 'knihovna', police = '', detailId = null, statRok = +dnes().slice(0, 4);
  let razeni = ls('razeni') || 'pridano', stitek = '';
  function otevri(dlg) { if (!dlg.open) dlg.showModal(); }
  function nastavPohled(p, id) {
    pohled = p; detailId = id || null;
    document.querySelectorAll('[data-pohled]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.pohled === pohled)));
    document.querySelectorAll('[data-police]').forEach(b => b.setAttribute('aria-pressed', String(pohled === 'knihovna' && b.dataset.police === police)));
    vykresli();
    $('hlavni').scrollTop = 0;
  }
  function vykresli() {
    obnovDatalisty();
    if (pohled === 'kniha' && knihy.some(k => k.id === detailId)) vykresliDetail();
    else if (pohled === 'statistiky') vykresliStatistiky();
    else if (pohled === 'citaty') vykresliCitaty();
    else { pohled = 'knihovna'; vykresliKnihovnu(); }
    doplnObalky($('obsah'));
  }
  function obnovDatalisty() {
    const v = J.vsechnyStitky(knihy);
    $('dlStitky').innerHTML = v.stitky.map(s => `<option value="${esc(s)}">`).join('');
    $('dlSerie').innerHTML = v.serie.map(s => `<option value="${esc(s)}">`).join('');
  }

  /* ---------- knihovna ---------- */
  const hvezdy = h => h ? `<span class="hvezdy" title="hodnocení ${h} z 5" aria-label="hodnocení ${h} z 5">${'★'.repeat(h)}${'☆'.repeat(5 - h)}</span>` : '';
  function karta(k) {
    const p = J.procento(k);
    return `<article class="karta" data-detail="${esc(k.id)}" tabindex="0" role="button" aria-label="${esc(k.titul)}">
      ${obalkaHtml(k)}
      <div class="info">
        <h3 data-i18n="ne">${esc(k.titul)}</h3>
        <div class="autor" data-i18n="ne">${esc(k.autori.join(', ') || '—')}</div>
        <div class="meta">
          ${pohled === 'knihovna' && !police ? `<span>${esc(POLICE_MAPA[k.police])}</span>` : ''}
          ${k.serie ? `<span class="znacka serie" data-i18n="ne">${esc(k.serie)}${k.serieCislo ? ' #' + esc(k.serieCislo) : ''}</span>` : ''}
          ${k.stran ? `<span>${k.stran} s.</span>` : ''}
          ${hvezdy(k.hodnoceni)}
          ${k.konec && k.police === 'precteno' ? `<span>✓ ${J.formatDatum(k.konec)}</span>` : ''}
          ${k.pujceno ? `<span class="znacka" data-i18n="ne">🤝 ${esc(k.pujceno.komu)}</span>` : ''}
          ${k.stitky.slice(0, 3).map(s => `<span class="znacka" data-i18n="ne">${esc(s)}</span>`).join('')}
        </div>
        ${k.police === 'ctu' ? `<div class="pruh" title="${p} %"><i style="width:${p}%"></i></div>
          <div class="meta"><span>${k.stran ? `s. ${k.strana} / ${k.stran} · ${p} %` : `s. ${k.strana}`}</span></div>
          <div class="akce"><button class="btn mini" data-akce="sezeni" data-id="${esc(k.id)}">➕ Zapsat čtení</button></div>` : ''}
      </div>
    </article>`;
  }
  function vykresliKnihovnu() {
    const rok = +dnes().slice(0, 4);
    const pocet = id => knihy.filter(k => k.police === id).length;
    const vy = J.vyzva(knihy, (ls('vyzva') || {})[rok], rok, dnes());
    const dl = (id, cislo, popis) => `<button class="dlazdice" data-police="${id}" aria-pressed="${police === id}"><b>${cislo}</b><span>${popis}</span></button>`;
    let h = `<div class="souhrn">${dl('ctu', pocet('ctu'), '📖 čtu')}${dl('chci', pocet('chci'), '📋 chci číst')}${dl('precteno', pocet('precteno'), '✅ přečteno')}
      <button class="dlazdice" data-pohled="statistiky"><b>${vy.knih}${vy.cilKnih ? ' / ' + vy.cilKnih : ''}</b><span>🎯 přečteno v roce ${rok}</span></button></div>`;
    if (!knihy.length) {
      $('obsah').innerHTML = h + `<div class="prazdno">Deník je zatím prázdný.<br>
        <button class="btn primary" data-prikaz="sken">📷 Naskenovat ISBN</button><button class="btn" data-prikaz="hledatOnline">🔍 Hledat knihu</button><button class="btn" data-prikaz="rucne">✚ Zadat ručně</button><button class="btn" data-prikaz="importGr">📥 Import z Goodreads</button></div>`;
      return;
    }
    const v = J.vsechnyStitky(knihy);
    const opt = (seznam, nadpis) => seznam.length ? `<optgroup label="${nadpis}">${seznam.map(s => `<option value="${esc(s)}"${s === stitek ? ' selected' : ''}>${esc(s)}</option>`).join('')}</optgroup>` : '';
    const vyber = J.serad(J.filtruj(knihy, { police, stitek, text: $('hledat').value }), razeni);
    h += `<div class="filtry">
      <select class="vstup" id="filtrStitek" aria-label="Štítek, žánr nebo série"><option value="">🏷️ Všechny štítky, žánry a série</option>${opt(v.stitky, 'Štítky')}${opt(v.zanry, 'Žánry')}${opt(v.serie, 'Série')}</select>
      <select class="vstup" id="razeni" aria-label="Řazení">${Object.entries(J.PORADI).map(([id, n]) => `<option value="${id}"${id === razeni ? ' selected' : ''}>↕ ${n}</option>`).join('')}</select>
      <span class="pocet">${vyber.length} ${vyber.length === 1 ? 'kniha' : vyber.length >= 2 && vyber.length <= 4 ? 'knihy' : 'knih'}</span></div>`;
    if (!vyber.length) h += '<div class="prazdno">Filtru nic neodpovídá.</div>';
    else if (!police && razeni === 'pridano' && !stitek && !$('hledat').value) {
      for (const p of ['ctu', 'chci', 'precteno', 'odlozeno']) {
        const r = vyber.filter(k => k.police === p);
        if (r.length) h += `<h2 class="skupina">${esc(POLICE_MAPA[p])} (${r.length})</h2><div class="seznam">${r.map(karta).join('')}</div>`;
      }
    } else h += `<div class="seznam">${vyber.map(karta).join('')}</div>`;
    $('obsah').innerHTML = h;
    $('filtrStitek').onchange = e => { stitek = e.target.value; vykresli(); };
    $('razeni').onchange = e => { razeni = e.target.value; ls('razeni', razeni); vykresli(); };
  }

  /* ---------- detail knihy ---------- */
  const kniha = () => knihy.find(k => k.id === detailId);
  function vykresliDetail() {
    const k = kniha(), p = J.procento(k);
    const od = J.odhadDocteni(k, dnes(), J.tempo(knihy, dnes(), 30));
    const zak = ls('zak') || {};
    const zdroj = k.zdroj === 'openlibrary' ? `<a href="https://openlibrary.org${esc(k.olKey || '/isbn/' + k.isbn)}" target="_blank" rel="noopener">Open Library ↗</a>`
      : k.zdroj === 'google' ? 'Google Books' : k.zdroj === 'goodreads' ? 'import Goodreads' : 'ruční zadání';
    const sezeni = k.sezeni.slice().reverse();
    $('obsah').innerHTML = `
    <div class="det-hlava">
      ${obalkaHtml(k, true)}
      <div class="info">
        <div><button class="btn mini" data-zpet>← Knihovna</button></div>
        <h2 data-i18n="ne">${esc(k.titul)}</h2>
        ${k.podtitul ? `<div class="podtitul" data-i18n="ne">${esc(k.podtitul)}</div>` : ''}
        <div data-i18n="ne">${esc(k.autori.join(', ') || 'autor neuveden')}</div>
        <div class="meta">
          ${k.serie ? `<span>📚 <span data-i18n="ne">${esc(k.serie)}</span>${k.serieCislo ? ' #' + esc(k.serieCislo) : ''}</span>` : ''}
          ${k.rok ? `<span>${k.rok}</span>` : ''}${k.nakladatel ? `<span data-i18n="ne">${esc(k.nakladatel)}</span>` : ''}
          ${k.stran ? `<span>${k.stran} stran</span>` : ''}<span>${esc(k.format)}</span>${k.jazyk ? `<span data-i18n="ne">${esc(k.jazyk)}</span>` : ''}
          ${k.isbn ? `<span>ISBN ${esc(k.isbn)}${J.isbn13na10(k.isbn) ? ' · ' + J.isbn13na10(k.isbn) : ''}</span>` : ''}
          <span>zdroj: ${zdroj}</span>
        </div>
        <div class="meta">${k.zanry.concat(k.stitky).map(s => `<span class="znacka" data-i18n="ne">${esc(s)}</span>`).join('')}</div>
        <div class="radek-akci">
          <select class="vstup" id="detPolice" aria-label="Police">${J.POLICE.map(x => `<option value="${x.id}"${x.id === k.police ? ' selected' : ''}>${x.nazev}</option>`).join('')}</select>
          <span role="group" aria-label="Hodnocení">${[1, 2, 3, 4, 5].map(i => `<button class="hvezda${i <= k.hodnoceni ? ' zap' : ''}" data-hodnoceni="${i}" aria-label="${i} z 5" title="${i} z 5">★</button>`).join('')}</span>
        </div>
        <div class="radek-akci">
          <button class="btn" data-akce="upravit">✎ Upravit údaje</button>
          <button class="btn" data-akce="tiskZapis">🖨️ Zápis do deníku</button>
          <button class="btn danger" data-akce="smazat">🗑️ Smazat</button>
        </div>
      </div>
    </div>
    <div class="mrizka2">
      <section class="sekce"><h3>📈 Průběh čtení</h3>
        <div class="pruh${p === 100 ? ' ok' : ''}"><i style="width:${p}%"></i></div>
        <p class="pozn">${k.stran ? `strana ${k.strana} z ${k.stran} · ${p} %` : `strana ${k.strana} (počet stran není zadaný)`}
          ${od ? ` · zbývá ${od.zbyva} stran, při tempu ${od.tempo.toFixed(1).replace('.', ',')} s./den dočteno asi <b>${J.formatDatum(od.datum)}</b> (${od.dni} d.)` : ''}</p>
        <div class="radek">
          <label class="pole">Začátek čtení<input class="vstup" type="date" data-pole="zacatek" value="${k.zacatek}"></label>
          <label class="pole">Dočteno<input class="vstup" type="date" data-pole="konec" value="${k.konec}"></label>
        </div>
        <div class="akce" style="margin:8px 0"><button class="btn primary" data-akce="sezeni" data-id="${esc(k.id)}">➕ Zapsat čtení</button></div>
        ${sezeni.length ? `<div class="tab-obal"><table><thead><tr><th>Datum</th><th class="cislo">Strany</th><th class="cislo">Přečteno</th><th class="cislo">Minut</th><th></th></tr></thead><tbody>
          ${sezeni.map(s => `<tr><td>${J.formatDatum(s.datum)}</td><td class="cislo">${s.od}–${s.do}</td><td class="cislo">${J.precteneStrany(s)}</td><td class="cislo">${s.minut || ''}</td>
            <td><button class="btn mini danger" data-smaz-sezeni="${esc(s.id)}" aria-label="Smazat sezení" title="Smazat">✕</button></td></tr>`).join('')}
          </tbody></table></div>` : '<p class="pozn">Zatím žádná sezení čtení.</p>'}
      </section>
      <section class="sekce"><h3>🤝 Půjčeno</h3>
        ${k.pujceno ? `<p style="margin:0 0 8px">Půjčeno: <b data-i18n="ne">${esc(k.pujceno.komu)}</b>${k.pujceno.od ? ` od ${J.formatDatum(k.pujceno.od)} (${J.rozdilDni(k.pujceno.od, dnes())} dní)` : ''}</p>
          <button class="btn" data-akce="vraceno">↩️ Vráceno</button>`
        : `<div class="spolu"><input class="vstup" id="pujcKomu" maxlength="80" placeholder="komu" aria-label="Komu"><input class="vstup" id="pujcOd" type="date" value="${dnes()}" aria-label="Od"><button class="btn" data-akce="pujcit">Půjčit</button></div>`}
        <h3 style="margin-top:14px">📝 Poznámky</h3>
        <textarea class="vstup" data-pole="poznamky" rows="6" style="width:100%" placeholder="Dojmy, souvislosti, co si zapamatovat…" aria-label="Poznámky">${esc(k.poznamky)}</textarea>
      </section>
    </div>
    <section class="sekce"><h3>💬 Citáty (${k.citaty.length})</h3>
      ${k.citaty.map(c => `<div class="citat"><blockquote data-i18n="ne">${esc(c.text)}</blockquote><div class="kde">${c.strana ? `s. ${c.strana}` : ''}${c.pozn ? ` · <span data-i18n="ne">${esc(c.pozn)}</span>` : ''}
        <button class="btn mini" data-kopiruj-citat="${esc(c.id)}">📋 Kopírovat</button><button class="btn mini danger" data-smaz-citat="${esc(c.id)}">✕</button></div></div>`).join('')}
      <div class="radek" style="margin-top:8px;grid-template-columns:1fr">
        <textarea class="vstup" id="citText" rows="2" maxlength="4000" placeholder="Text citátu" aria-label="Text citátu"></textarea>
        <div class="spolu"><input class="vstup" id="citStrana" inputmode="numeric" maxlength="6" placeholder="strana" aria-label="Strana" style="flex:0 1 90px"><input class="vstup" id="citPozn" maxlength="1000" placeholder="poznámka (nepovinné)" aria-label="Poznámka k citátu"><button class="btn" data-akce="citat">💬 Přidat citát</button></div>
      </div>
    </section>
    <section class="sekce"><h3>🎒 Školní čtenářský deník</h3>
      <p class="pozn">Vyplněné údaje se vytisknou jako stránka do čtenářského deníku (🖨️ Zápis do deníku; v tisku lze „Uložit jako PDF“). Prázdná pole dostanou linky na ruční dopsání.</p>
      <div class="radek"><label class="pole">Jméno žáka<input class="vstup" id="zakJmeno" maxlength="80" value="${esc(zak.jmeno || '')}"></label><label class="pole">Třída / škola<input class="vstup" id="zakTrida" maxlength="80" value="${esc(zak.trida || '')}"></label></div>
      ${J.SKOLA_POLE.map(([id, nazev]) => `<label class="pole" style="margin-top:8px">${nazev}<textarea class="vstup" data-skola="${id}" rows="${id === 'dej' ? 5 : 2}" maxlength="6000">${esc(k.skola[id])}</textarea></label>`).join('')}
    </section>`;
    $('detPolice').onchange = async e => { J.naPolici(k, e.target.value, dnes()); await ulozKnihu(k); vykresli(); };
    $('obsah').querySelectorAll('[data-pole]').forEach(el => el.addEventListener('change', async () => {
      const pole = el.dataset.pole;
      k[pole] = pole === 'poznamky' ? el.value.slice(0, 20000) : (J.jeDatum(el.value) ? el.value : '');
      await ulozKnihu(k);
      if (pole !== 'poznamky') vykresli();
    }));
    $('obsah').querySelectorAll('[data-skola]').forEach(el => el.addEventListener('change', () => { k.skola[el.dataset.skola] = el.value.slice(0, 6000); ulozKnihu(k); }));
    const ulozZaka = () => ls('zak', { jmeno: $('zakJmeno').value.trim(), trida: $('zakTrida').value.trim() });
    $('zakJmeno').onchange = ulozZaka; $('zakTrida').onchange = ulozZaka;
  }

  /* ---------- statistiky ---------- */
  function sloupce(hodnoty, popis) {
    const max = Math.max(1, ...hodnoty);
    return `<div class="graf" role="img" aria-label="${popis}">${hodnoty.map((v, i) => `<div class="sl" title="${MESICE[i]}: ${v}"><b>${v || ''}</b><i style="height:${v / max * 85}%"></i></div>`).join('')}</div>
      <div class="graf-osa">${MESICE.map(m => `<span>${m}</span>`).join('')}</div>`;
  }
  function vodorovne(seznam) {
    if (!seznam.length) return '<p class="pozn">Zatím nic.</p>';
    const max = seznam[0].pocet;
    return `<div class="vodor">${seznam.map(x => `<span class="jm" title="${esc(x.nazev)}" data-i18n="ne">${esc(x.nazev)}</span><div class="pruh"><i style="width:${x.pocet / max * 100}%"></i></div><b>${x.pocet}</b>`).join('')}</div>`;
  }
  const des = (x, n) => x.toFixed(n == null ? 1 : n).replace('.', ',');
  function vykresliStatistiky() {
    const d = dnes(), rokTed = +d.slice(0, 4);
    const st = J.statistiky(knihy, statRok, d);
    const roky = [...new Set([rokTed, ...st.roky])].sort((a, b) => b - a);
    let vyzvaHtml = '';
    if (statRok) {
      const v = J.vyzva(knihy, (ls('vyzva') || {})[statRok], statRok, d);
      const stavText = !v.cilKnih ? '' : v.knih >= v.cilKnih ? '<span class="ok-txt">🎉 Cíl splněn!</span>'
        : statRok !== rokTed ? '' : v.naskokKnih >= 0 ? `<span class="ok-txt">v předstihu o ${des(v.naskokKnih)} knihy oproti plánu</span>` : `<span class="pozde-txt">za plánem o ${des(-v.naskokKnih)} knihy (plán k dnešku ${des(v.planKnih)})</span>`;
      vyzvaHtml = `<section class="sekce"><h3>🎯 Čtenářská výzva ${statRok}</h3>
        ${v.cilKnih || v.cilStran ? `<div class="vyzva-blok">
          ${v.cilKnih ? `<div>Knihy: <b>${v.knih} / ${v.cilKnih}</b> (${v.procentoKnih} %) ${stavText}</div><div class="pruh${v.procentoKnih >= 100 ? ' ok' : ''}"><i style="width:${v.procentoKnih}%"></i></div>` : ''}
          ${v.cilStran ? `<div>Strany: <b>${v.stran} / ${v.cilStran}</b> (${v.procentoStran} %)</div><div class="pruh${v.procentoStran >= 100 ? ' ok' : ''}"><i style="width:${v.procentoStran}%"></i></div>` : ''}
          </div>` : '<p class="pozn">Výzva pro tento rok není nastavená.</p>'}
        <div class="akce" style="margin-top:8px"><button class="btn" data-akce="vyzva">🎯 ${v.cilKnih || v.cilStran ? 'Upravit cíl' : 'Nastavit cíl'}</button></div></section>`;
    }
    const ctu = knihy.filter(k => k.police === 'ctu');
    const dl = (cislo, popis) => `<div class="dlazdice" style="cursor:default"><b>${cislo}</b><span>${popis}</span></div>`;
    $('obsah').innerHTML = `
      <div class="filtry"><label>Rok <select class="vstup" id="statRok"><option value="0"${!statRok ? ' selected' : ''}>všechny roky</option>${roky.map(r => `<option value="${r}"${r === statRok ? ' selected' : ''}>${r}</option>`).join('')}</select></label></div>
      ${vyzvaHtml}
      <div class="souhrn">${dl(st.knih, 'přečtených knih')}${dl(st.stran.toLocaleString('cs-CZ'), 'stran (přečtené knihy)')}${dl(st.stranSezeni.toLocaleString('cs-CZ'), 'stran podle sezení')}
        ${dl(st.prumerHodnoceni ? des(st.prumerHodnoceni) + ' ★' : '–', 'průměrné hodnocení')}${dl(st.prumerDni ? des(st.prumerDni, 0) : '–', 'dní na knihu (průměr)')}
        ${dl(st.prumerStran ? des(st.prumerStran, 0) : '–', 'stran na knihu')}${dl(des(st.tempo30), 'stran/den za 30 dní')}</div>
      <div class="mrizka2">
        <section class="sekce"><h3>📅 Přečtené knihy po měsících</h3>${sloupce(st.mesice.map(m => m.knihy), 'Knihy po měsících')}</section>
        <section class="sekce"><h3>📄 Přečtené strany po měsících (sezení)</h3>${sloupce(st.mesice.map(m => m.stranySezeni), 'Strany po měsících')}</section>
        <section class="sekce"><h3>🎭 Žánry</h3>${vodorovne(st.zanry)}</section>
        <section class="sekce"><h3>✍️ Autoři</h3>${vodorovne(st.autori)}</section>
        <section class="sekce"><h3>⭐ Hodnocení</h3>${vodorovne([5, 4, 3, 2, 1].map(h => ({ nazev: '★'.repeat(h), pocet: st.hodnoceni[h - 1] })).filter(x => x.pocet).sort((a, b) => b.pocet - a.pocet))}
          ${st.nejdelsi ? `<p class="pozn">Nejdelší kniha: <b data-i18n="ne">${esc(st.nejdelsi.titul)}</b> (${st.nejdelsi.stran} s.)</p>` : ''}</section>
        <section class="sekce"><h3>📖 Rozečtené a odhad dočtení</h3>
          ${ctu.length ? `<div class="tab-obal"><table><thead><tr><th>Kniha</th><th class="cislo">Průběh</th><th class="cislo">Odhad</th></tr></thead><tbody>${ctu.map(k => {
            const od = J.odhadDocteni(k, d, st.tempo30);
            return `<tr><td><a href="#" data-detail="${esc(k.id)}" data-i18n="ne">${esc(k.titul)}</a></td><td class="cislo">${J.procento(k)} %</td><td class="cislo">${od ? J.formatDatum(od.datum) : '–'}</td></tr>`;
          }).join('')}</tbody></table></div>` : '<p class="pozn">Nic rozečteného.</p>'}</section>
      </div>`;
    $('statRok').onchange = e => { statRok = +e.target.value; vykresli(); };
  }

  /* ---------- citáty ---------- */
  function vykresliCitaty() {
    const q = J.bezDiakritiky($('hledat').value);
    const vse = knihy.flatMap(k => k.citaty.map(c => ({ k, c }))).filter(x => !q || J.bezDiakritiky(x.c.text + ' ' + x.k.titul + ' ' + x.k.autori.join(' ') + ' ' + x.c.pozn).includes(q));
    $('obsah').innerHTML = `<div class="filtry"><span>💬 ${vse.length} citátů</span>${vse.length ? '<button class="btn mini" data-akce="kopirujCitaty">📋 Kopírovat vše</button>' : ''}
      <span class="pocet">Pro sbírku citátů s kartičkami a tiskem: <a href="vypisky.html">📌 Výpisky a citáty</a></span></div>` +
      (vse.length ? vse.map(({ k, c }) => `<div class="citat"><blockquote data-i18n="ne">${esc(c.text)}</blockquote><div class="kde">— <a href="#" data-detail="${esc(k.id)}" data-i18n="ne">${esc(k.autori[0] ? k.autori[0] + ': ' : '')}${esc(k.titul)}</a>${c.strana ? `, s. ${c.strana}` : ''}${c.pozn ? ` · <span data-i18n="ne">${esc(c.pozn)}</span>` : ''}</div></div>`).join('')
        : '<div class="prazdno">Žádné citáty. Přidáte je v detailu knihy.</div>');
  }
  const citatText = (k, c) => `„${c.text}“\n— ${k.autori[0] ? k.autori[0] + ': ' : ''}${k.titul}${c.strana ? ', s. ' + c.strana : ''}`;
  async function doSchranky(t) {
    try { await navigator.clipboard.writeText(t); Dialog.info('Zkopírováno do schránky.'); }
    catch (e) { await Dialog.zeptej('Schránka není dostupná – zkopírujte ručně:', t); }
  }

  /* ---------- editor knihy ---------- */
  const fK = $('dlgKniha').querySelector('form');
  fK.format.innerHTML = J.FORMATY.map(f => `<option>${f}</option>`).join('');
  fK.police.innerHTML = J.POLICE.map(p => `<option value="${p.id}">${p.nazev}</option>`).join('');
  let edit = null;   // { kniha, nova, obalka: undefined (beze změny) | Blob | null (smazat), online: {coverId|obalkaUrl} }
  function nastavNahled(url) { $('dlgObalka').innerHTML = url ? `<img src="${esc(url)}" alt="náhled obálky">` : '📕'; }
  async function otevriEditor(k, volby) {
    volby = volby || {};
    edit = { kniha: k, nova: !!volby.nova, obalka: undefined, online: volby.online || null, dalsi: !!volby.dalsi };
    $('dlgKnihaTitul').textContent = edit.nova ? '✚ Nová kniha' : '✎ Upravit knihu';
    $('dlgUlozDalsi').hidden = !(edit.nova && volby.dalsi);
    const z = $('dlgKnihaZprava');
    z.hidden = !volby.zprava; z.innerHTML = volby.zprava || ''; z.classList.toggle('varovani', !!volby.varovani);
    for (const p of ['isbn', 'titul', 'podtitul', 'serie', 'serieCislo', 'rok', 'nakladatel', 'jazyk', 'format', 'police']) fK[p].value = k[p] || '';
    fK.stran.value = k.stran || '';
    fK.autori.value = k.autori.join(', '); fK.zanry.value = k.zanry.join(', '); fK.stitky.value = k.stitky.join(', ');
    if (k.titul === 'Bez názvu') fK.titul.value = '';
    $('dlgIsbnInfo').textContent = '';
    const o = edit.online;
    nastavNahled(o && o.coverId ? J.urlOLObalka(o.coverId) : o && o.obalkaUrl ? o.obalkaUrl : await urlObalky(k));
    otevri($('dlgKniha'));
  }
  fK.isbn.addEventListener('input', () => {
    const r = J.rozborIsbn(fK.isbn.value), s = J.cistIsbn(fK.isbn.value);
    $('dlgIsbnInfo').textContent = !s ? '' : r.isbn13 ? `✓ platné · ISBN-13 ${r.isbn13}${r.isbn10 ? ' · ISBN-10 ' + r.isbn10 : ''}` : (s.length >= 10 ? '✗ ' + r.chyba : '');
  });
  $('dlgNacist').onclick = async () => {
    const r = J.rozborIsbn(fK.isbn.value);
    if (!r.isbn13) return Dialog.chyba('ISBN: ' + r.chyba);
    $('dlgNacist').disabled = true;
    try {
      const n = await najdiIsbn(r.isbn13);
      if (!n.kniha) return Dialog.chyba('Nenalezeno. ' + n.chyby.join(' · '));
      // doplní jen prázdná pole
      for (const p of ['titul', 'podtitul', 'nakladatel', 'jazyk', 'rok', 'stran']) if (!fK[p].value || (p === 'titul' && fK.titul.value === 'Bez názvu')) fK[p].value = n.kniha[p] || '';
      if (!fK.autori.value) fK.autori.value = n.kniha.autori.join(', ');
      if (!fK.zanry.value) fK.zanry.value = n.kniha.zanry.join(', ');
      fK.isbn.value = r.isbn13;
      Object.assign(edit.kniha, { zdroj: n.kniha.zdroj, olKey: n.kniha.olKey });
      if (!edit.kniha.obalka && edit.obalka === undefined && (n.coverId || n.obalkaUrl)) { edit.online = n; nastavNahled(n.coverId ? J.urlOLObalka(n.coverId) : n.obalkaUrl); }
      Dialog.info('Doplněno z ' + (n.kniha.zdroj === 'google' ? 'Google Books' : 'Open Library') + '.');
    } finally { $('dlgNacist').disabled = false; }
  };
  $('dlgSken').onclick = () => CtenarCtecka.otevri(kod => { fK.isbn.value = kod; fK.isbn.dispatchEvent(new Event('input')); });
  $('dlgObalkaNahrat').onclick = () => $('dlgObalkaSoubor').click();
  $('dlgObalkaSoubor').onchange = async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try { edit.obalka = await zmensi(f); edit.online = null; nastavNahled(URL.createObjectURL(edit.obalka)); }
    catch (er) { Dialog.chyba('Obrázek nejde načíst.'); }
  };
  $('dlgObalkaSmaz').onclick = () => { edit.obalka = null; edit.online = null; nastavNahled(''); };
  $('dlgKniha').addEventListener('close', async () => {
    const akce = $('dlgKniha').returnValue;
    $('dlgKniha').returnValue = '';
    if (akce !== 'ok' && akce !== 'dalsi') { edit = null; return; }
    const e = edit; edit = null;
    const r = J.rozborIsbn(fK.isbn.value);
    const k = J.normKniha(Object.assign({}, e.kniha, {
      isbn: r.isbn13 || J.cistIsbn(fK.isbn.value), titul: fK.titul.value, podtitul: fK.podtitul.value, autori: fK.autori.value,
      serie: fK.serie.value, serieCislo: fK.serieCislo.value, rok: fK.rok.value, nakladatel: fK.nakladatel.value, stran: fK.stran.value,
      jazyk: fK.jazyk.value, format: fK.format.value, zanry: fK.zanry.value, stitky: fK.stitky.value
    }));
    if (k.police !== fK.police.value) J.naPolici(k, fK.police.value, dnes());
    if (e.nova) {
      const dup = J.najdiDuplikat(knihy, k);
      if (dup && !await Dialog.potvrd(`V deníku už je „${dup.titul}“. Přidat přesto další exemplář?`)) return;
    }
    // obálka: vlastní soubor > online > beze změny
    let blob = e.obalka;
    if (blob === undefined && e.online) blob = await stahniObalku(e.online);
    if (blob) { await ulozObalku(k.id, blob); k.obalka = true; zapomenObalku(k.id); }
    else if (e.obalka === null) { await smazObalku(k.id); k.obalka = false; zapomenObalku(k.id); }
    const i = knihy.findIndex(x => x.id === k.id);
    if (i >= 0) knihy[i] = k; else knihy.push(k);
    await ulozKnihu(k);
    if (akce === 'dalsi') { vykresli(); Dialog.info('Uloženo: ' + k.titul); return sken(true); }
    nastavPohled('kniha', k.id);
  });

  /* ---------- přidání ---------- */
  async function pridejIsbn(isbn, dalsi) {
    const dup = knihy.find(k => k.isbn === isbn);
    if (dup) {
      if (await Dialog.potvrd(`„${dup.titul}“ už v deníku je (${POLICE_MAPA[dup.police]}). Otevřít ji?`)) nastavPohled('kniha', dup.id);
      return;
    }
    Dialog.info('Hledám ISBN ' + isbn + '…');
    const n = await najdiIsbn(isbn);
    if (n.kniha) {
      const z = n.kniha.zdroj === 'google' ? 'Google Books (Powered by Google)' : '<a href="https://openlibrary.org" target="_blank" rel="noopener">Open Library</a> (CC0)';
      return otevriEditor(n.kniha, { nova: true, online: n, dalsi, zprava: `Údaje načtené z ${z} – zkontrolujte je a doplňte.` });
    }
    otevriEditor(J.normKniha({ isbn, zdroj: 'rucne' }), {
      nova: true, dalsi, varovani: true,
      zprava: `Kniha s ISBN ${isbn} v online katalozích není (u českých vydání běžné) – vyplňte ji ručně, obálku můžete vyfotit. Údaje najdete např. na <a href="https://www.databazeknih.cz/search?q=${isbn}" target="_blank" rel="noopener">Databázi knih ↗</a>.<br><small>${esc(n.chyby.join(' · '))}</small>`
    });
  }
  function sken(dalsi) { CtenarCtecka.otevri(kod => pridejIsbn(kod, dalsi)); }

  let hledaniCislo = 0;
  async function hledejOnline() {
    const q = $('hledatOnline').value.trim();
    if (!q) return;
    const r = J.rozborIsbn(q);
    if (r.isbn13) { $('dlgHledat').close(); return pridejIsbn(r.isbn13); }
    const moje = ++hledaniCislo;
    $('vysledky').innerHTML = '<p class="pozn">Hledám…</p>';
    try {
      const v = J.zOpenLibraryHledani(await stahni(J.urlOLHledej(q, 20)));
      if (moje !== hledaniCislo) return;
      hledejOnline.vysledky = v;
      $('vysledky').innerHTML = v.length ? v.map((x, i) => `<button type="button" class="vysledek" data-vysledek="${i}">
        <div class="obalka">${x.coverId ? `<img src="${J.urlOLObalka(x.coverId).replace('-M.', '-S.')}" alt="" loading="lazy">` : '📕'}</div>
        <span><b data-i18n="ne">${esc(x.kniha.titul)}</b><small data-i18n="ne">${esc(x.kniha.autori.join(', '))}${x.kniha.rok ? ' · ' + x.kniha.rok : ''}${x.kniha.jazyk ? ' · ' + esc(x.kniha.jazyk) : ''}${x.kniha.isbn ? ' · ISBN ' + x.kniha.isbn : ''}</small></span></button>`).join('')
        : '<p class="pozn">Nic nenalezeno. Zkuste jiný tvar názvu nebo jen příjmení autora.</p>';
    } catch (e) { if (moje === hledaniCislo) $('vysledky').innerHTML = `<p class="pozn">Hledání selhalo: ${esc(e.message)}.</p>`; }
  }
  $('hledatOnlineTl').onclick = hledejOnline;
  $('hledatOnline').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); hledejOnline(); } });
  $('vysledky').addEventListener('click', e => {
    const b = e.target.closest('[data-vysledek]');
    if (!b) return;
    const x = hledejOnline.vysledky[+b.dataset.vysledek];
    $('dlgHledat').close();
    otevriEditor(J.normKniha(x.kniha), { nova: true, online: x, zprava: 'Údaje z <a href="https://openlibrary.org" target="_blank" rel="noopener">Open Library</a> (CC0) – vyhledávání vrací dílo, počet stran a rok jsou orientační.' });
  });

  /* ---------- zápis čtení ---------- */
  const fS = $('dlgSezeni').querySelector('form');
  let sezeniKniha = null;
  function popisSezeni() {
    const proc = fS.jednotka.value === 'procenta';
    $('dlgSezeniPopis').firstChild.textContent = proc ? 'Přečteno procent' : 'Dočetl/a jsem na stranu';
    $('dlgSezeniStran').hidden = !(proc && !sezeniKniha.stran);
  }
  function zapisCteni(k) {
    sezeniKniha = k;
    $('dlgSezeniTitul').textContent = '➕ Zapsat čtení – ' + k.titul;
    $('dlgSezeniInfo').textContent = k.stran ? `teď strana ${k.strana} z ${k.stran}` : `teď strana ${k.strana}`;
    fS.reset(); fS.datum.value = dnes(); fS.jednotka.value = 'strana'; popisSezeni();
    otevri($('dlgSezeni'));
  }
  fS.addEventListener('change', e => { if (e.target.name === 'jednotka') popisSezeni(); });
  $('dlgSezeni').addEventListener('close', async () => {
    if ($('dlgSezeni').returnValue !== 'ok') return;
    $('dlgSezeni').returnValue = '';
    const k = sezeniKniha;
    if (+fS.stran.value > 0) k.stran = Math.round(+fS.stran.value);
    const h = Number(String(fS.hodnota.value).replace(',', '.'));
    if (!(h >= 0)) return Dialog.chyba('Zadejte číslo.');
    let strana = h;
    if (fS.jednotka.value === 'procenta') {
      if (!k.stran) return Dialog.chyba('Pro procenta je potřeba znát počet stran.');
      strana = J.stranaZProcent(k, h);
    }
    if (strana < k.strana && !await Dialog.potvrd(`Strana ${strana} je před současnou (${k.strana}). Zapsat přesto (např. čtení od začátku)?`)) return;
    const docteno = J.pridejSezeni(k, { datum: fS.datum.value, strana, minut: fS.minut.value });
    await ulozKnihu(k);
    vykresli();
    if (docteno) Dialog.info('🎉 Dočteno! Kniha je na polici Přečteno – nezapomeňte ohodnotit.');
  });

  /* ---------- tisk zápisů ---------- */
  async function tiskZapisu(seznam) {
    const zak = ls('zak') || {};
    const html = [];
    for (const k of seznam) {
      const u = await urlObalky(k);
      const radek = (n, v) => `<tr><th>${n}</th><td>${v || '&nbsp;'}</td></tr>`;
      html.push(`<article class="zapis"><h1>Čtenářský deník</h1>
        <div class="zak"><span>Jméno: <b>${esc(zak.jmeno || '…………………………')}</b></span><span>Třída: <b>${esc(zak.trida || '…………')}</b></span></div>
        <div class="hlava-zapisu"><table>
          ${radek('Autor', esc(k.autori.join(', ')))}${radek('Název', '<b>' + esc(k.titul) + '</b>' + (k.podtitul ? ' – ' + esc(k.podtitul) : ''))}
          ${radek('Nakladatel, rok', esc([k.nakladatel, k.rok].filter(Boolean).join(', ')))}${radek('Počet stran', k.stran || '')}
          ${radek('Přečteno', [k.zacatek, k.konec].filter(Boolean).map(J.formatDatum).join(' – '))}${radek('Hodnocení', k.hodnoceni ? '★'.repeat(k.hodnoceni) + '☆'.repeat(5 - k.hodnoceni) : '')}
        </table>${u ? `<img src="${u}" alt="">` : ''}</div>
        ${J.SKOLA_POLE.map(([id, n]) => `<h2>${n}</h2>${k.skola[id] ? `<div class="text">${esc(k.skola[id])}</div>` : '<div class="linky"></div>'}`).join('')}
      </article>`);
    }
    $('tisk').innerHTML = html.join('');
    document.documentElement.classList.add('tiskne-zapis');
    await Promise.all([...$('tisk').querySelectorAll('img')].map(i => i.complete ? 0 : new Promise(ok => { i.onload = i.onerror = ok; })));
    print();
  }
  addEventListener('afterprint', () => { document.documentElement.classList.remove('tiskne-zapis'); $('tisk').innerHTML = ''; });

  /* ---------- soubor ---------- */
  function ulozSoubor(jmeno, obsah, typ) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([obsah], { type: typ }));
    a.download = jmeno; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const naDataUrl = b => new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(b); });
  async function pridejHromadne(nove, obalky) {
    for (const k of nove) {
      if (obalky && obalky[k.id]) {
        try { await ulozObalku(k.id, await (await fetch(obalky[k.id])).blob()); k.obalka = true; } catch (e) { k.obalka = false; }
      } else k.obalka = false;
      await ulozKnihu(k);
    }
  }
  $('souborCsv').onchange = async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    let nove;
    try { nove = J.zGoodreads(await f.text()); } catch (er) { return Dialog.chyba(er.message); }
    const unikatni = [];
    for (const k of nove) if (!J.najdiDuplikat(knihy.concat(unikatni), k)) unikatni.push(k);
    if (!unikatni.length) return Dialog.info(`V souboru je ${nove.length} knih, všechny už v deníku jsou.`);
    if (!await Dialog.potvrd(`Importovat ${unikatni.length} knih${nove.length > unikatni.length ? ` (${nove.length - unikatni.length} duplicit přeskočím)` : ''}?`)) return;
    await pridejHromadne(unikatni);
    knihy.push(...unikatni);
    vykresli();
    if (unikatni.some(k => k.isbn) && await Dialog.potvrd('Importováno. Doplnit obálky z Open Library (u knih s ISBN)?')) doplnObalkyOnline();
  };
  $('souborJson').onchange = async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    let z;
    try { z = J.zeZalohy(JSON.parse(await f.text())); } catch (er) { return Dialog.chyba(er.message || 'Soubor není platný JSON.'); }
    if (!await Dialog.potvrd(`Záloha obsahuje ${z.knihy.length} knih. Nahradit jimi celý současný deník?`)) return;
    await tx(['knihy', 'obalky'], 'readwrite', s => { s.transaction.objectStore('obalky').clear(); s.clear(); });
    urlObalek.forEach(u => URL.revokeObjectURL(u)); urlObalek.clear();
    await pridejHromadne(z.knihy, z.obalky);
    ls('vyzva', z.vyzvy);
    knihy = z.knihy;
    nastavPohled('knihovna');
    Dialog.info('Obnoveno.');
  };
  let doplnuje = false;
  async function doplnObalkyOnline() {
    if (doplnuje) return;
    // obálky podle ISBN má Open Library omezené (asi 100 za 5 minut na IP) – proto nejvýš 80 najednou
    const bez = knihy.filter(k => !k.obalka && k.isbn).slice(0, 80);
    if (!bez.length) return Dialog.info('Všechny knihy s ISBN už obálku mají.');
    doplnuje = true;
    let ok = 0;
    try {
      for (const [i, k] of bez.entries()) {
        if (i % 10 === 0) Dialog.info(`Obálky: ${i} / ${bez.length}…`);
        let b = null;
        try { b = await stahni(`https://covers.openlibrary.org/b/isbn/${k.isbn}-M.jpg?default=false`, 'blob'); }
        catch (e) { if (e.status !== 404) { Dialog.chyba('Stahování obálek přerušeno: ' + e.message); break; } }
        if (b && b.size > 1000) { await ulozObalku(k.id, b); k.obalka = true; await ulozKnihu(k); ok++; }
        await new Promise(r => setTimeout(r, 400));
      }
    } finally { doplnuje = false; }
    vykresli();
    Dialog.info(`Doplněno ${ok} obálek z ${bez.length}.`);
  }

  /* ---------- příkazy ---------- */
  const PRIKAZY = {
    sken: () => sken(true),
    hledatOnline: () => { $('vysledky').innerHTML = ''; otevri($('dlgHledat')); $('hledatOnline').focus(); },
    rucne: () => { if ($('dlgHledat').open) $('dlgHledat').close(); otevriEditor(J.normKniha({ zdroj: 'rucne' }), { nova: true }); },
    napoveda: () => otevri($('dlgNapoveda')),
    importGr: () => $('souborCsv').click(),
    exportCsv: () => ulozSoubor('ctenarsky-denik-' + dnes() + '.csv', J.doCsv(knihy), 'text/csv'),
    zaloha: async () => {
      const obalky = {};
      for (const k of knihy) if (k.obalka) { const b = await nactiObalku(k.id).catch(() => null); if (b) obalky[k.id] = await naDataUrl(b); }
      ulozSoubor('ctenarsky-denik-' + dnes() + '.json', JSON.stringify({ aplikace: 'ctenarsky_denik', verze: J.VERZE, knihy, vyzvy: ls('vyzva') || {}, obalky }), 'application/json');
    },
    obnov: () => $('souborJson').click(),
    doplnObalky: doplnObalkyOnline,
    tiskSkola: () => {
      const s = J.serad(knihy.filter(k => Object.values(k.skola).some(Boolean)), 'konec').reverse();
      if (!s.length) return Dialog.info('Žádná kniha nemá vyplněný školní zápis (detail knihy → 🎒 Školní čtenářský deník).');
      tiskZapisu(s);
    },
    smazVse: async () => {
      if (!await Dialog.potvrd('Opravdu smazat celý deník včetně obálek? Doporučujeme nejdřív zálohu.')) return;
      await tx(['knihy', 'obalky'], 'readwrite', s => { s.transaction.objectStore('obalky').clear(); s.clear(); });
      knihy = []; urlObalek.forEach(u => URL.revokeObjectURL(u)); urlObalek.clear();
      nastavPohled('knihovna');
    }
  };
  const AKCE = {
    sezeni: (k) => zapisCteni(k),
    upravit: k => otevriEditor(k),
    tiskZapis: k => tiskZapisu([k]),
    smazat: async k => {
      if (!await Dialog.potvrd(`Smazat „${k.titul}“ i se sezeními, poznámkami a citáty?`)) return;
      await smazKnihuDb(k.id); zapomenObalku(k.id);
      knihy = knihy.filter(x => x.id !== k.id);
      nastavPohled('knihovna');
    },
    pujcit: async k => {
      const komu = $('pujcKomu').value.trim();
      if (!komu) return $('pujcKomu').focus();
      k.pujceno = { komu, od: $('pujcOd').value || dnes() }; await ulozKnihu(k); vykresli();
    },
    vraceno: async k => { k.pujceno = null; await ulozKnihu(k); vykresli(); },
    citat: async k => {
      const c = J.normCitat({ text: $('citText').value, strana: $('citStrana').value, pozn: $('citPozn').value, datum: dnes() });
      if (!c) return $('citText').focus();
      k.citaty.push(c); await ulozKnihu(k); vykresli();
    },
    vyzva: () => {
      const f = $('dlgVyzva').querySelector('form'), c = (ls('vyzva') || {})[statRok] || {};
      $('dlgVyzvaTitul').textContent = '🎯 Čtenářská výzva ' + statRok;
      f.knih.value = c.knih || ''; f.stran.value = c.stran || '';
      otevri($('dlgVyzva'));
    },
    kopirujCitaty: () => doSchranky(knihy.flatMap(k => k.citaty.map(c => citatText(k, c))).join('\n\n'))
  };
  $('dlgVyzva').addEventListener('close', () => {
    if ($('dlgVyzva').returnValue !== 'ok') return;
    $('dlgVyzva').returnValue = '';
    const f = $('dlgVyzva').querySelector('form'), v = ls('vyzva') || {};
    v[statRok] = { knih: Math.max(0, Math.round(+f.knih.value) || 0), stran: Math.max(0, Math.round(+f.stran.value) || 0) };
    ls('vyzva', v); vykresli();
  });

  /* ---------- události ---------- */
  function zavriNabidky() {
    document.querySelectorAll('.nabidka:not([hidden])').forEach(n => { n.hidden = true; });
    document.querySelectorAll('[data-nabidka][aria-expanded="true"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
  }
  document.querySelectorAll('[data-nabidka]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    const n = $(b.dataset.nabidka), bylo = !n.hidden;
    zavriNabidky();
    if (bylo) return;
    n.hidden = false; b.setAttribute('aria-expanded', 'true');
    const r = b.getBoundingClientRect();
    n.style.top = (r.bottom + 4) + 'px';
    n.style.left = Math.max(6, Math.min(r.left, innerWidth - n.offsetWidth - 6)) + 'px';
  }));
  document.addEventListener('click', async e => {
    const t = e.target;
    const p = t.closest('[data-prikaz]');
    if (p) { e.preventDefault(); zavriNabidky(); return PRIKAZY[p.dataset.prikaz](); }
    if (!t.closest('.nabidka')) zavriNabidky();
    const pol = t.closest('[data-police]');
    if (pol) { police = police === pol.dataset.police && pol.classList.contains('dlazdice') ? '' : pol.dataset.police; return nastavPohled('knihovna'); }
    const pv = t.closest('[data-pohled]');
    if (pv) return nastavPohled(pv.dataset.pohled);
    if (t.closest('[data-zpet]')) return nastavPohled('knihovna');
    const a = t.closest('[data-akce]');
    if (a) {
      e.stopPropagation();
      const k = knihy.find(x => x.id === (a.dataset.id || detailId));
      return AKCE[a.dataset.akce](k);
    }
    const hv = t.closest('[data-hodnoceni]');
    if (hv) { const k = kniha(), h = +hv.dataset.hodnoceni; k.hodnoceni = k.hodnoceni === h ? 0 : h; await ulozKnihu(k); return vykresli(); }
    const ss = t.closest('[data-smaz-sezeni]');
    if (ss) { if (await Dialog.potvrd('Smazat toto sezení? Průběh se vrátí na předchozí zápis.')) { J.smazSezeni(kniha(), ss.dataset.smazSezeni); await ulozKnihu(kniha()); vykresli(); } return; }
    const sc = t.closest('[data-smaz-citat]');
    if (sc) { if (await Dialog.potvrd('Smazat citát?')) { const k = kniha(); k.citaty = k.citaty.filter(c => c.id !== sc.dataset.smazCitat); await ulozKnihu(k); vykresli(); } return; }
    const kc = t.closest('[data-kopiruj-citat]');
    if (kc) { const k = kniha(); return doSchranky(citatText(k, k.citaty.find(c => c.id === kc.dataset.kopirujCitat))); }
    const d = t.closest('[data-detail]');
    if (d) { e.preventDefault(); return nastavPohled('kniha', d.dataset.detail); }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') zavriNabidky();
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.karta[data-detail]')) { e.preventDefault(); nastavPohled('kniha', e.target.dataset.detail); }
  });
  addEventListener('resize', zavriNabidky);
  $('hledat').addEventListener('input', () => { if (pohled !== 'citaty' && pohled !== 'knihovna') nastavPohled('knihovna'); else vykresli(); });

  /* ---------- start ---------- */
  (async () => {
    try { knihy = ((await tx('knihy', 'readonly', s => s.getAll())) || []).map(J.normKniha); }
    catch (e) { Dialog.chyba('Úložiště (IndexedDB) není dostupné – data se neuloží. ' + e.message); }
    vykresli();
  })();
  window.CTENAR_APP = { knihy: () => knihy, nastavPohled, vykresli, pridejIsbn, otevriEditor };
})();

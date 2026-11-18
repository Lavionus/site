/* Staré mapy – vlastní skeny: uložení v IndexedDB, vrstva v porovnání, editor vlícovacích bodů
   (Helmert / afinní, odchylky a RMS z jádra STMAPY.georeference). Rozhraní: window.SMSken. */
(function () {
  'use strict';
  const S = window.STMAPY, A = window.StareMapy, $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const DB = 'webapp_stare_mapy', STORE = 'skeny';

  /* ---------- IndexedDB ---------- */
  let dbP = null;
  function db() {
    if (!dbP) dbP = new Promise((ok, chyba) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
      r.onsuccess = () => ok(r.result);
      r.onerror = () => chyba(r.error);
    });
    return dbP;
  }
  async function tx(mod, fn) {
    const d = await db();
    return new Promise((ok, chyba) => {
      const t = d.transaction(STORE, mod), s = t.objectStore(STORE), r = fn(s);
      t.oncomplete = () => ok(r && r.result); t.onerror = () => chyba(t.error); t.onabort = () => chyba(t.error);
    });
  }
  const vsechnySkeny = () => tx('readonly', s => s.getAll());
  const ulozSken = z => tx('readwrite', s => s.put(z));
  const smazSken = id => tx('readwrite', s => s.delete(id));

  /* ---------- registr vrstev ---------- */
  const bitmapy = new Map();          // id → Promise<ImageBitmap>
  const bitmapa = z => {
    if (!bitmapy.has(z.id)) bitmapy.set(z.id, createImageBitmap(z.soubor));
    return bitmapy.get(z.id);
  };
  const METODY = { helmert: 'Helmertova transformace', afinni: 'afinní transformace' };
  function defSkenu(z) {
    const g = S.georeference(z.body, z.metoda);
    if (!g) return null;
    const rok = String(z.rok || '').trim();
    return {
      id: 'sken:' + z.id, nazev: z.nazev || 'Sken', rok: rok || '?', razeni: parseInt(rok, 10) || 1900, typ: 'sken', oblast: 'vlastni',
      meritko: `vlastní sken, RMS ${S.formatDelka(g.rms)}`, bounds: S.rozsahSkenu(g.par, z.sirka, z.vyska), par: g.par, sken: z,
      zdroj: 'vlastní sken – uložený jen v tomto prohlížeči', licence: 'podle zdroje skenu', atribuce: 'Vlastní sken: ' + (z.nazev || 'Sken'),
      popis: `${z.body.length} vlícovacích bodů, ${METODY[g.metoda]}, střední chyba RMS ${S.formatDelka(g.rms)}, rozlišení ${S.formatDelka(g.meritkoPx)} na pixel, ${z.sirka} × ${z.vyska} px.`
    };
  }
  async function nactiVse() {
    const z = await vsechnySkeny();
    A.vlastni.length = 0;
    for (const s of z) { const d = defSkenu(s); if (d) A.vlastni.push(d); }
  }
  async function obnovRegistr() {
    await nactiVse();
    const st = A.stav();
    if (!A.najdi(st.a)) st.a = 'ortofoto';
    if (!A.najdi(st.b)) st.b = 'vm2';
    A.naplnVybery();
    A.nastavVrstvy();
  }
  function vrstva(def, opt) {
    const v = L.gridLayer.sken(Object.assign({}, opt, { par: def.par, obraz: null }));
    bitmapa(def.sken).then(b => { v.options.obraz = b; v.redraw(); }, () => v.fire('tileerror'));
    return v;
  }

  /* ---------- záloha ---------- */
  const naDataUrl = b => new Promise((ok, chyba) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => chyba(r.error); r.readAsDataURL(b); });
  async function exportSkenu() {
    const z = await vsechnySkeny().catch(() => []);
    return Promise.all(z.map(async s => Object.assign({}, s, { soubor: undefined, data: await naDataUrl(s.soubor), typ: s.soubor.type })));
  }
  async function importSkenu(seznam) {
    let n = 0;
    for (const s of seznam) {
      if (!s || !s.id || !/^data:image\//.test(s.data || '') || !Array.isArray(s.body)) continue;
      const soubor = await (await fetch(s.data)).blob();
      const z = { id: String(s.id), nazev: String(s.nazev || 'Sken').slice(0, 80), rok: String(s.rok || '').slice(0, 20), soubor, sirka: +s.sirka, vyska: +s.vyska,
        body: s.body.filter(b => [b.px, b.py, b.lat, b.lon].every(Number.isFinite)), metoda: s.metoda === 'afinni' ? 'afinni' : 'helmert', upraveno: s.upraveno || Date.now() };
      bitmapy.delete(z.id);
      await ulozSken(z); n++;
    }
    if (n) await obnovRegistr();
    return n;
  }

  /* ---------- seznam skenů ---------- */
  async function otevriSeznam() {
    let z = [];
    try { z = await vsechnySkeny(); } catch (e) { return Dialog.chyba('Úložiště prohlížeče (IndexedDB) není dostupné.'); }
    $('skenyTelo').innerHTML = (z.length ? z.map(s => {
      const d = defSkenu(s);
      return `<div class="karta"><b>${esc(s.nazev || 'Sken')}</b> <span class="meta">${esc(s.rok || '')}</span>
        <div class="meta">${d ? esc(d.popis) : 'Zatím bez georeference – doplňte vlícovací body.'}</div>
        <div class="radek-tl">${d ? `<button class="tl" data-s="zobrazit" data-id="${esc(s.id)}">👁 Zobrazit nahoře</button>` : ''}
        <button class="tl" data-s="upravit" data-id="${esc(s.id)}">✎ Upravit body</button>
        ${d ? `<button class="tl" data-s="world" data-id="${esc(s.id)}">⬇ Obrázek + world file</button>` : ''}
        <button class="tl" data-s="smazat" data-id="${esc(s.id)}">🗑 Smazat</button></div></div>`;
    }).join('') : '<p>Zatím nemáte žádné vlastní skeny.</p>') +
      '<p><button class="btn primary" data-s="novy">➕ Nový sken…</button></p><p class="meta" style="font-size:.78rem;color:var(--text-muted)">Skeny jsou uložené jen v tomto prohlížeči (IndexedDB). World file (.jgw/.pgw) je v souřadnicovém systému EPSG:3857 (Web Mercator) – v QGIS nastavte vrstvě tento systém.</p>';
    $('dlgSkeny').showModal();
  }
  $('skenyTelo').addEventListener('click', async e => {
    const b = e.target.closest('[data-s]'); if (!b) return;
    const id = b.dataset.id, akce = b.dataset.s;
    if (akce === 'novy') { $('dlgSkeny').close(); return otevriEditor(); }
    const z = (await vsechnySkeny()).find(s => s.id === id);
    if (!z) return;
    if (akce === 'zobrazit') {
      $('dlgSkeny').close();
      const d = A.najdi('sken:' + id);
      const st = A.stav();
      A.zmenMapy(st.a.startsWith('sken:') ? 'ortofoto' : st.a, d.id);
      A.mapa.fitBounds([[d.bounds[1], d.bounds[0]], [d.bounds[3], d.bounds[2]]]);
    } else if (akce === 'upravit') { $('dlgSkeny').close(); otevriEditor(z); }
    else if (akce === 'world') {
      const g = S.georeference(z.body, z.metoda);
      const pr = /jpe?g/.test(z.soubor.type) ? ['jpg', 'jgw'] : /png/.test(z.soubor.type) ? ['png', 'pgw'] : ['webp', 'wld'];
      const jmeno = (z.nazev || 'sken').replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 50);
      window.stahni(`${jmeno}.${pr[0]}`, z.soubor);
      setTimeout(() => window.stahni(`${jmeno}.${pr[1]}`, S.worldFile(g.par), 'text/plain'), 400);
    } else if (akce === 'smazat') {
      if (!await Dialog.potvrd(`Smazat sken „${z.nazev}“ z prohlížeče?`)) return;
      await smazSken(id); bitmapy.delete(id);
      await obnovRegistr(); otevriSeznam();
    }
  });

  /* ---------- editor vlícovacích bodů ---------- */
  let ed = null, mObraz = null, mMapa = null, podklad = null, nahled = null, vybrany = -1;
  const ikona = (n, ceka) => L.divIcon({ className: 'cislo-bodu' + (ceka ? ' ceka' : ''), html: String(n), iconSize: [22, 22] });
  const vrstvaBodu = { obraz: null, mapa: null };

  function pripravMapy() {
    if (mObraz) return;
    mObraz = L.map('grObraz', { crs: L.CRS.Simple, minZoom: -6, maxZoom: 5, zoomSnap: 0.25, attributionControl: false });
    mMapa = L.map('grMapa', { minZoom: 5, maxZoom: 20 });
    vrstvaBodu.obraz = L.layerGroup().addTo(mObraz);
    vrstvaBodu.mapa = L.layerGroup().addTo(mMapa);
    mObraz.on('click', e => klik({ px: e.latlng.lng, py: -e.latlng.lat }));
    mMapa.on('click', e => klik({ lat: e.latlng.lat, lon: e.latlng.lng }));
    $('grPodklad').onchange = () => nastavPodklad($('grPodklad').value);
  }
  async function nastavPodklad(id) {
    if (podklad) podklad.remove();
    const def = A.najdi(id);
    try { await window.pripravDef(def); } catch (e) { /* chybu ohlásí dlaždice */ }
    podklad = window.vytvorVrstvu(def).addTo(mMapa);
    podklad.bringToBack();
  }
  async function otevriEditor(z) {
    $('georef').hidden = false;
    pripravMapy();
    setTimeout(() => { mObraz.invalidateSize(); mMapa.invalidateSize(); }, 0);
    const st = A.stav();
    $('grPodklad').innerHTML = A.vsechny().filter(v => v.typ !== 'sken').sort((x, y) => y.razeni - x.razeni)
      .map(v => `<option value="${esc(v.id)}">${esc(v.rok)} – ${esc(v.nazev)}</option>`).join('');
    $('grPodklad').value = A.najdi(st.a) && A.najdi(st.a).typ !== 'sken' ? st.a : 'ortofoto';
    nastavPodklad($('grPodklad').value);
    mMapa.setView(A.mapa.getCenter(), A.mapa.getZoom());
    ed = { id: z ? z.id : S.noveId(), soubor: z ? z.soubor : null, sirka: z ? z.sirka : 0, vyska: z ? z.vyska : 0,
      body: z ? z.body.map(b => Object.assign({}, b)) : [], metoda: z ? z.metoda : 'helmert', ceka: null, hist: S.Historie(200), zmeneno: false, obrazVrstva: null, url: null };
    $('grNazev').value = z ? z.nazev : ''; $('grRok').value = z ? z.rok : ''; $('grMetoda').value = z ? z.metoda : 'helmert';
    vybrany = -1;
    if (ed.soubor) await zobrazObraz();
    else { $('grVyzva').hidden = false; if (ed.obrazVrstva) ed.obrazVrstva.remove(); }
    if (z) { const g = S.georeference(ed.body, ed.metoda); if (g) { const r = S.rozsahSkenu(g.par, ed.sirka, ed.vyska); mMapa.fitBounds([[r[1], r[0]], [r[3], r[2]]]); } }
    prekresli();
  }
  async function zobrazObraz() {
    if (ed.url) URL.revokeObjectURL(ed.url);
    ed.url = URL.createObjectURL(ed.soubor);
    mObraz.eachLayer(l => { if (l instanceof L.ImageOverlay) l.remove(); });
    const b = [[-ed.vyska, 0], [0, ed.sirka]];
    ed.obrazVrstva = L.imageOverlay(ed.url, b).addTo(mObraz);
    mObraz.fitBounds(b);
    $('grVyzva').hidden = true;
  }
  $('grNacist').onclick = () => { $('grSoubor').value = ''; $('grSoubor').click(); };
  $('grSoubor').onchange = async () => {
    const f = $('grSoubor').files[0];
    if (!f) return;
    try {
      const bm = await createImageBitmap(f);
      if (bm.width * bm.height > 120e6) { bm.close(); return Dialog.chyba('Obrázek je příliš velký (víc než 120 Mpx). Zmenšete ho, prosím.'); }
      if (ed.body.length && !await Dialog.potvrd('Nahradit obrázek? Vlícovací body zůstanou, ale budou nejspíš ukazovat jinam.')) return;
      ed.soubor = f; ed.sirka = bm.width; ed.vyska = bm.height; ed.zmeneno = true;
      bitmapy.set(ed.id, Promise.resolve(bm));
      if (!$('grNazev').value) $('grNazev').value = f.name.replace(/\.[^.]+$/, '').slice(0, 80);
      await zobrazObraz();
      prekresli();
    } catch (e) { Dialog.chyba('Obrázek se nepodařilo načíst: ' + e.message); }
  };
  function zmen(fn) { ed.hist.uloz(ed.body); fn(); ed.zmeneno = true; prekresli(); }
  function klik(c) {
    if (!ed || !ed.soubor) return;
    if ('px' in c && (c.px < 0 || c.py < 0 || c.px > ed.sirka || c.py > ed.vyska)) return;
    if (ed.ceka && (('px' in c) !== ('px' in ed.ceka))) {
      const bod = Object.assign({}, ed.ceka, c);
      ed.ceka = null;
      zmen(() => ed.body.push(bod));
    } else { ed.ceka = c; prekresli(); }
  }
  function prekresli() {
    if (!ed) return;
    ed.metoda = $('grMetoda').value;
    const g = S.georeference(ed.body, ed.metoda);
    vrstvaBodu.obraz.clearLayers(); vrstvaBodu.mapa.clearLayers();
    const presun = (i, co) => e => {
      const ll = e.target.getLatLng();
      zmen(() => { if (co === 'obraz') Object.assign(ed.body[i], { px: ll.lng, py: -ll.lat }); else Object.assign(ed.body[i], { lat: ll.lat, lon: ll.lng }); });
    };
    ed.body.forEach((b, i) => {
      L.marker([-b.py, b.px], { icon: ikona(i + 1), draggable: true }).on('dragend', presun(i, 'obraz')).addTo(vrstvaBodu.obraz);
      L.marker([b.lat, b.lon], { icon: ikona(i + 1), draggable: true }).on('dragend', presun(i, 'mapa')).addTo(vrstvaBodu.mapa);
    });
    if (ed.ceka) {
      if ('px' in ed.ceka) L.marker([-ed.ceka.py, ed.ceka.px], { icon: ikona('?', true), interactive: false }).addTo(vrstvaBodu.obraz);
      else L.marker([ed.ceka.lat, ed.ceka.lon], { icon: ikona('?', true), interactive: false }).addTo(vrstvaBodu.mapa);
    }
    // náhled
    if (nahled) { nahled.remove(); nahled = null; }
    if (g && $('grNahled').checked && ed.soubor) {
      nahled = L.gridLayer.sken({ par: g.par, obraz: null, opacity: 0.6, zIndex: 5 }).addTo(mMapa);
      const n = nahled;
      bitmapa({ id: ed.id, soubor: ed.soubor }).then(b => { n.options.obraz = b; n.redraw(); });
    }
    $('grUlozit').disabled = !g;
    $('grZpet').disabled = !ed.hist.lzeZpet();
    // tabulka
    const min = S.MIN_BODU[ed.metoda];
    const souhrn = g
      ? `<span>Bodů <b>${ed.body.length}</b></span><span>RMS <b>${S.formatDelka(g.rms)}</b></span><span>rozlišení <b>${S.formatDelka(g.meritkoPx)}/px</b></span><span>natočení <b>${g.natoceni.toFixed(2).replace('.', ',')}°</b></span><span>nadbytečných měření <b>${g.nadbytek}</b>${g.nadbytek === 0 ? ' (odchylky nelze posoudit – přidejte body)' : ''}</span>`
      : `<span>${ed.soubor ? `Přidejte vlícovací body – potřeba aspoň ${min} (máte ${ed.body.length}).` : 'Nejdřív načtěte obrázek.'}</span>`;
    const stavKliku = ed.ceka ? `<span style="color:var(--warn)">Bod ${ed.body.length + 1}: teď klikněte na totéž místo ${'px' in ed.ceka ? 'v dnešní mapě vpravo' : 've skenu vlevo'} (Esc zruší).</span>` : '';
    const prah = g ? Math.max(2 * g.rms, 0.01) : Infinity;
    $('grTabulka').innerHTML = `<div class="souhrn">${souhrn}${stavKliku}</div>` + (ed.body.length ? `<table><thead><tr><th>#</th><th>sken x</th><th>sken y</th><th>zem. šířka</th><th>zem. délka</th><th>odchylka x</th><th>odchylka y</th><th>odchylka</th><th></th></tr></thead><tbody>` +
      ed.body.map((b, i) => {
        const o = g && g.odchylky[i];
        return `<tr data-bod="${i}"${i === vybrany ? ' class="vybrany"' : ''}><td>${i + 1}</td><td>${b.px.toFixed(1)}</td><td>${b.py.toFixed(1)}</td><td>${b.lat.toFixed(6)}</td><td>${b.lon.toFixed(6)}</td>` +
          (o ? `<td>${o.dx.toFixed(2)} m</td><td>${o.dy.toFixed(2)} m</td><td class="${g.nadbytek && o.d > prah ? 'velka' : ''}">${o.d.toFixed(2)} m</td>` : '<td></td><td></td><td></td>') +
          `<td><button class="tl" data-smaz="${i}" title="Smazat bod" aria-label="Smazat bod ${i + 1}">✕</button></td></tr>`;
      }).join('') + '</tbody></table>' : '');
  }
  $('grTabulka').addEventListener('click', e => {
    const s = e.target.closest('[data-smaz]');
    if (s) { zmen(() => ed.body.splice(+s.dataset.smaz, 1)); return; }
    const r = e.target.closest('[data-bod]');
    if (!r) return;
    vybrany = +r.dataset.bod; const b = ed.body[vybrany];
    mObraz.panTo([-b.py, b.px]); mMapa.panTo([b.lat, b.lon]);
    prekresli();
  });
  $('grMetoda').onchange = () => { ed.zmeneno = true; prekresli(); };
  $('grNahled').onchange = prekresli;
  const zpetEd = () => { const b = ed.hist.zpet(ed.body); if (b) { ed.body = b; ed.zmeneno = true; prekresli(); } };
  $('grZpet').onclick = zpetEd;
  $('grUlozit').onclick = async () => {
    const g = S.georeference(ed.body, ed.metoda);
    if (!g) return;
    const z = { id: ed.id, nazev: ($('grNazev').value.trim() || 'Sken').slice(0, 80), rok: $('grRok').value.trim().slice(0, 20), soubor: ed.soubor,
      sirka: ed.sirka, vyska: ed.vyska, body: ed.body, metoda: ed.metoda, upraveno: Date.now() };
    try { await ulozSken(z); }
    catch (e) { return Dialog.chyba('Sken se nepodařilo uložit (' + e.message + '). Možná je plné úložiště prohlížeče.'); }
    ed.zmeneno = false;
    zavri(true);
    await obnovRegistr();
    const st = A.stav();
    A.zmenMapy(st.a.startsWith('sken:') ? 'ortofoto' : st.a, 'sken:' + z.id);
    const r = S.rozsahSkenu(g.par, z.sirka, z.vyska);
    A.mapa.fitBounds([[r[1], r[0]], [r[3], r[2]]]);
    Dialog.info(`Sken uložen (RMS ${S.formatDelka(g.rms)}). Najdete ho mezi mapami ve skupině „Vlastní skeny“.`);
  };
  async function zavri(bezDotazu) {
    if (!ed) return;
    if (!bezDotazu && ed.zmeneno && ed.body.length && !await Dialog.potvrd('Zavřít editor bez uložení změn?')) return;
    if (ed.url) URL.revokeObjectURL(ed.url);
    if (nahled) { nahled.remove(); nahled = null; }
    ed = null;
    $('georef').hidden = true;
  }
  $('grZavrit').onclick = () => zavri(false);
  document.addEventListener('keydown', e => {
    if ($('georef').hidden || !ed || document.querySelector('dialog[open]')) return;
    if (e.key === 'Escape') { if (ed.ceka) { ed.ceka = null; prekresli(); } else zavri(false); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.target.closest('input')) { e.preventDefault(); zpetEd(); }
  });

  window.SMSken = { nactiVse, vrstva, export: exportSkenu, import: importSkenu, otevriEditor, otevriSeznam };
})();

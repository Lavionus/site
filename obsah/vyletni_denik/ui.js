/* ============================================================
   Výletní deník – uživatelské rozhraní
   Závisí na: DENIK (jadro.js), ULOZENI (ulozeni.js), DENIK_TISK (tisk.js), Leaflet (L), Dialog
   ============================================================ */
(function () {
  'use strict';
  const D = window.DENIK, U = window.ULOZENI, T = window.DENIK_TISK;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const PREF = 'webapp_vyletni_denik_';
  const dnes = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const info = t => (window.Dialog ? Dialog.info(t) : console.log(t));
  const chyba = t => (window.Dialog ? Dialog.chyba(t) : console.error(t));
  const potvrd = async (t, v) => (window.Dialog ? Dialog.potvrd(t, v) : false);

  function lsCti(k, vychozi) { try { const v = localStorage.getItem(PREF + k); return v === null ? vychozi : JSON.parse(v); } catch (e) { return vychozi; } }
  function lsPis(k, v) { try { localStorage.setItem(PREF + k, JSON.stringify(v)); } catch (e) {} }

  const nast = Object.assign({ okno: D.VYCHOZI_VYSKY.okno, prah: D.VYCHOZI_VYSKY.prah, max: 2048, format: 'image/webp', original: false, podleCasu: true, posun: 0, dosah: 300, razeni: 'sestupne', pohled: 'karty' }, lsCti('nastaveni', {}));
  const ulozNast = () => lsPis('nastaveni', nast);
  const volbyVysek = () => ({ okno: nast.okno, prah: nast.prah });

  /* ---------- object URL – evidence a úklid ---------- */
  const urlSady = {};
  function url(sada, blob) {
    if (!blob) return '';
    const u = URL.createObjectURL(blob);
    (urlSady[sada] = urlSady[sada] || []).push(u);
    return u;
  }
  function uvolni(sada) { (urlSady[sada] || []).forEach(u => URL.revokeObjectURL(u)); urlSady[sada] = []; }
  function stahni(blob, jmeno) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = jmeno;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  function vyberSoubor(input) { input.value = ''; input.click(); }
  const pauza = ms => new Promise(r => setTimeout(r, ms));

  /* ---------- stav ---------- */
  const S = {
    vylety: [], pocetFotek: {}, zalozka: 'vylety', filtr: Object.assign({ text: '', rok: '', oblast: '', doprava: '', stitek: '' }, lsCti('filtr', {})),
    akt: null,            // {vylet, trasy, fotky}
    kal: { rok: new Date().getFullYear(), mesic: new Date().getMonth() },
    dbOk: true,
  };

  /* =====================================================================
     START
     ===================================================================== */
  async function start() {
    vyplnStatickeVolby();
    navazUdalosti();
    try {
      await U.otevri();
      await nactiVse();
    } catch (e) {
      S.dbOk = false;
      $('chybaDb').hidden = false;
      $('chybaDb').textContent = 'Úložiště IndexedDB není k dispozici (' + (e && e.message || e) + '). Deník nemůže ukládat data – zkuste jiný prohlížeč nebo vypněte anonymní režim.';
    }
    const z = lsCti('zalozka', 'vylety');
    const m = /^#v=([\w-]+)$/.exec(location.hash);
    if (m && S.vylety.some(v => v.id === m[1])) otevriVylet(m[1]);
    else prepniZalozku(['vylety', 'kalendar', 'mapa', 'statistiky', 'zaloha'].includes(z) ? z : 'vylety');
  }
  async function nactiVse() {
    S.vylety = await U.vsechnyVylety();
    S.pocetFotek = await U.pocetFotek();
    obnovVolbyFiltru();
  }

  function vyplnStatickeVolby() {
    $('fDoprava').insertAdjacentHTML('beforeend', D.DOPRAVA.map(d => `<option>${esc(d)}</option>`).join(''));
    $('dDoprava').innerHTML = D.DOPRAVA.map(d => `<label><input type="checkbox" value="${esc(d)}"> ${esc(d)}</label>`).join('');
    $('dHvezdy').innerHTML = [1, 2, 3, 4, 5].map(i => `<button type="button" role="radio" data-h="${i}" aria-label="${i} z 5" aria-checked="false">★</button>`).join('');
    $('optOkno').value = nast.okno; $('optPrah').value = nast.prah;
    $('optMax').value = String(nast.max); $('optFormat').value = nast.format; $('optOriginal').checked = !!nast.original;
    $('optPodleCasu').checked = !!nast.podleCasu; $('optPosun').value = nast.posun; $('optDosah').value = nast.dosah;
    $('razeni').value = nast.razeni; $('pohled').value = nast.pohled;
    $('fText').value = S.filtr.text || '';
  }

  function obnovVolbyFiltru() {
    const roky = [...new Set(S.vylety.map(v => String(v.datumOd || '').slice(0, 4)).filter(r => /^\d{4}$/.test(r)))].sort().reverse();
    const oblasti = [...new Set(S.vylety.map(v => (v.oblast || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'cs'));
    const nastav = (sel, hodnoty, prvni) => {
      const akt = sel.value;
      sel.innerHTML = `<option value="">${prvni}</option>` + hodnoty.map(h => `<option>${esc(h)}</option>`).join('');
      sel.value = hodnoty.includes(akt) ? akt : '';
    };
    nastav($('fRok'), roky, 'všechny');
    nastav($('fOblast'), oblasti, 'všechny');
    if (S.filtr.rok && roky.includes(S.filtr.rok)) $('fRok').value = S.filtr.rok; else S.filtr.rok = $('fRok').value;
    if (S.filtr.oblast && oblasti.includes(S.filtr.oblast)) $('fOblast').value = S.filtr.oblast; else S.filtr.oblast = $('fOblast').value;
    $('fDoprava').value = S.filtr.doprava || '';
    const stitky = [...new Set(S.vylety.flatMap(v => v.stitky || []))].sort((a, b) => a.localeCompare(b, 'cs'));
    nastav($('fStitek'), stitky, 'jakýkoli');
    if (S.filtr.stitek && stitky.includes(S.filtr.stitek)) $('fStitek').value = S.filtr.stitek; else S.filtr.stitek = $('fStitek').value;
    $('stitkySeznam').innerHTML = stitky.map(o => `<option value="${esc(o)}">`).join('');
    $('oblastiSeznam').innerHTML = oblasti.map(o => `<option value="${esc(o)}">`).join('');
    const lide = [...new Set(S.vylety.flatMap(v => v.ucastnici || []))].sort((a, b) => a.localeCompare(b, 'cs'));
    $('ucastniciSeznam').innerHTML = lide.map(o => `<option value="${esc(o)}">`).join('');
  }
  const filtrovane = () => D.seradVylety(D.filtrujVylety(S.vylety, S.filtr), nast.razeni);

  /* =====================================================================
     ZÁLOŽKY
     ===================================================================== */
  async function prepniZalozku(z) {
    if (S.akt) await zavriDetail();
    S.zalozka = z;
    lsPis('zalozka', z);
    document.querySelectorAll('.zalozky button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.z === z)));
    ['vylety', 'kalendar', 'mapa', 'statistiky', 'zaloha', 'detail'].forEach(k => { $('z-' + k).hidden = k !== z; });
    $('filtry').hidden = z === 'zaloha' || z === 'detail';
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    prekresliZalozku();
  }
  function prekresliZalozku() {
    if (S.zalozka === 'vylety') kresliSeznam();
    else if (S.zalozka === 'kalendar') kresliKalendar();
    else if (S.zalozka === 'mapa') kresliMapuVse();
    else if (S.zalozka === 'statistiky') kresliStatistiky();
    else if (S.zalozka === 'zaloha') obnovStavUloziste();
  }

  /* =====================================================================
     SEZNAM VÝLETŮ
     ===================================================================== */
  function miniMapa(v) {
    if (!v.nahled || !v.nahled.length) return '';
    return T.svgMapa(v.nahled, [], [], 320, 140).replace('class="t-mapa"', 'class="t-mapa" preserveAspectRatio="xMidYMid slice"');
  }
  function stitkyVyletu(v) {
    const st = v.statistika, s = [];
    if (v.oblast) s.push(esc(v.oblast));
    if (st && st.delka) s.push(D.km(st.delka));
    if (st && st.maVysky) s.push('↑ ' + D.metry(st.stoupani));
    const f = S.pocetFotek[v.id];
    if (f) s.push(f + ' foto');
    if ((v.body || []).length) s.push(v.body.length + ' míst');
    if (v.hodnoceni) s.push('★'.repeat(v.hodnoceni));
    if (v.pocasi && v.pocasi.dny && v.pocasi.dny[0]) { const p = v.pocasi.dny[0]; s.push(`${p.ikona} ${D.cislo(p.tmax, 0)}\u00a0°C`); }
    return s.map(t => `<span class="stitek">${t}</span>`).join('') + (v.stitky || []).map(t => `<span class="stitek tag">#${esc(t)}</span>`).join('');
  }
  async function kresliSeznam() {
    uvolni('seznam');
    const sez = filtrovane();
    const el = $('seznam');
    el.style.display = '';
    $('pocetVyletu').textContent = S.vylety.length ? `Zobrazeno ${sez.length} z ${S.vylety.length} výletů` : '';
    if (!S.vylety.length) {
      el.innerHTML = `<div class="karta prazdne" style="grid-column: 1 / -1"><div style="font-size: 2.4rem">🥾</div><p>Deník je zatím prázdný.</p>
        <div class="rada" style="justify-content: center"><button class="tl hlavni" type="button" data-akce="novy">+ Nový výlet</button><button class="tl" type="button" data-akce="ukazka">Vložit ukázkové výlety</button></div></div>`;
      return;
    }
    if (!sez.length) { el.innerHTML = '<div class="karta prazdne" style="grid-column: 1 / -1">Filtru neodpovídá žádný výlet.</div>'; return; }
    if (nast.pohled === 'osa') {
      el.style.display = 'block';
      el.innerHTML = D.casovaOsa(sez).map(r => `<h2 class="osa-rok">${r.rok || 'Bez data'}</h2>` + r.mesice.map(m => `<div class="osa-mesic">${m.mesic !== null ? `<h3>${D.MESICE[m.mesic]}</h3>` : ''}` +
        m.vylety.map(v => `<button type="button" class="osa-polozka vylet-karta" data-id="${esc(v.id)}"><div class="obr" data-foto="${esc(v.titulniFoto || '')}">${miniMapa(v) || '🏞️'}</div>
          <div><div class="nazev" style="font-weight: 600">${esc(v.nazev || 'Bez názvu')}</div><div class="male-pismo">${esc(D.rozsahCesky(v))}</div><div class="stitky" style="margin-top: 4px">${stitkyVyletu(v)}</div></div></button>`).join('') + '</div>').join('')).join('');
    } else {
    el.style.display = '';
    el.innerHTML = sez.map(v => `<button type="button" class="vylet-karta" data-id="${esc(v.id)}">
        <div class="obr" data-foto="${esc(v.titulniFoto || '')}">${miniMapa(v) || '🏞️'}</div>
        <div class="telo"><div class="nazev">${esc(v.nazev || 'Bez názvu')}</div><div class="kdy">${esc(D.rozsahCesky(v))}</div>
        <div class="stitky">${stitkyVyletu(v)}</div></div></button>`).join('');
    }
    for (const o of el.querySelectorAll('.obr[data-foto]')) {
      const id = o.dataset.foto;
      if (!id) continue;
      try {
        const f = await U.fotka(id);
        if (f && f.nahled && o.isConnected) o.innerHTML = `<img alt="" src="${url('seznam', f.nahled)}">`;
      } catch (e) {}
    }
  }

  /* =====================================================================
     DETAIL VÝLETU
     ===================================================================== */
  let casovacUlozeni = null, ukladani = Promise.resolve();
  async function novyVylet(datum) {
    if (!S.dbOk) { chyba('Úložiště není k dispozici.'); return; }
    const v = D.novyVylet(datum || dnes());
    try { await U.ulozVylet(v); } catch (e) { chyba(e.message); return; }
    S.vylety.push(v);
    obnovVolbyFiltru();
    await otevriVylet(v.id);
    $('dNazev').focus(); $('dNazev').select();
  }

  async function otevriVylet(id) {
    if (S.akt) await zavriDetail();
    const v = S.vylety.find(x => x.id === id);
    if (!v) return;
    let trasy = [], fotky = [];
    try { trasy = await U.trasy(id); fotky = await U.fotkyVyletu(id); } catch (e) { chyba(e.message); }
    S.akt = { vylet: v, trasy, fotky };
    S.zalozka = 'detail';
    document.querySelectorAll('.zalozky button').forEach(b => b.setAttribute('aria-selected', 'false'));
    ['vylety', 'kalendar', 'mapa', 'statistiky', 'zaloha'].forEach(k => { $('z-' + k).hidden = true; });
    $('z-detail').hidden = false; $('filtry').hidden = true;
    history.replaceState(null, '', '#v=' + id);
    vyplnFormular();
    kresliTrasy();
    kresliMista();
    kresliGalerii();
    zajistiMapuDetailu();
    prekresliMapuDetailu(true);
    kresliStatistikuTrasy();
    $('ulozeno').textContent = '';
    window.scrollTo(0, 0);
  }
  async function zavriDetail() {
    if (!S.akt) return;
    if (casovacUlozeni) { clearTimeout(casovacUlozeni); casovacUlozeni = null; await ulozAkt(); }
    await ukladani;
    rezimMista(false); umistovanaFotka = null;
    uvolni('galerie'); uvolni('mapaDetail');
    S.akt = null;
  }

  function vyplnFormular() {
    const v = S.akt.vylet;
    $('dNadpis').textContent = v.nazev || 'Bez názvu';
    document.querySelectorAll('#formular [data-pole]').forEach(i => { i.value = v[i.dataset.pole] || ''; });
    $('dUcastnici').value = (v.ucastnici || []).join(', ');
    $('dStitky').value = (v.stitky || []).join(', ');
    kresliPocasi();
    $('dDoprava').querySelectorAll('input').forEach(c => { c.checked = (v.doprava || []).includes(c.value); });
    kresliHvezdy();
    kresliNaklady();
  }
  function kresliHvezdy() {
    const h = S.akt.vylet.hodnoceni || 0;
    $('dHvezdy').querySelectorAll('button').forEach(b => { const i = +b.dataset.h; b.classList.toggle('zap', i <= h); b.setAttribute('aria-checked', String(i === h)); });
  }
  function kresliNaklady() {
    const v = S.akt.vylet;
    $('dNaklady').innerHTML = (v.naklady || []).map((n, i) => `<div class="naklady-radek" data-i="${i}">
      <input type="text" data-k="popis" value="${esc(n.popis || '')}" placeholder="položka (jízdenky, vstupné…)" aria-label="Položka">
      <input type="text" inputmode="decimal" data-k="castka" value="${esc(n.castka == null ? '' : String(n.castka).replace('.', ','))}" placeholder="částka" aria-label="Částka">
      <select data-k="mena" aria-label="Měna">${['CZK', 'EUR', 'USD', 'PLN', 'HUF', 'CHF', 'GBP'].map(m => `<option${m === (n.mena || 'CZK') ? ' selected' : ''}>${m}</option>`).join('')}</select>
      <button class="tl male" type="button" data-smaz="${i}" aria-label="Odebrat položku">✕</button></div>`).join('');
    obnovSoucetNakladu();
  }
  function obnovSoucetNakladu() {
    const v = S.akt.vylet, s = D.soucetNakladu(v.naklady);
    const lidi = (v.ucastnici || []).length;
    let t = Object.keys(s).length ? 'Celkem ' + D.naklText(s) : '';
    if (t && lidi > 1) {
      const na = {}; for (const m in s) na[m] = Math.round(s[m] / lidi * 100) / 100;
      t += ` · na osobu (${lidi}) ${D.naklText(na)}`;
    }
    $('dNakladySoucet').textContent = t;
  }

  function planujUlozeni() {
    $('ulozeno').textContent = 'Neuloženo…';
    clearTimeout(casovacUlozeni);
    casovacUlozeni = setTimeout(() => { casovacUlozeni = null; ulozAkt(); }, 500);
  }
  function ulozAkt() {
    if (!S.akt) return Promise.resolve();
    const v = S.akt.vylet;
    ukladani = ukladani.then(() => U.ulozVylet(v)).then(() => {
      $('ulozeno').textContent = 'Uloženo ✓';
      obnovVolbyFiltru();
    }).catch(e => { $('ulozeno').textContent = 'Chyba ukládání'; chyba(e.message); });
    return ukladani;
  }

  /* ---------- odvozené údaje výletu ---------- */
  function vsechnySegmenty(trasy) { return (trasy || []).flatMap(t => t.segmenty); }
  function prepocitej(v, trasy, fotky) {
    const seg = vsechnySegmenty(trasy);
    v.statistika = seg.length ? D.statistikaTrasy(seg, volbyVysek()) : null;
    v.nahled = seg.length ? D.nahledTrasy(seg, 400) : [];
    let bb = v.statistika ? v.statistika.bbox : null;
    bb = D.bboxSjednot(bb, D.bodyBbox(v.body));
    if (fotky) bb = D.bboxSjednot(bb, D.bodyBbox(fotky));
    v.bbox = bb;
  }

  /* ---------- mapa detailu ---------- */
  let mapaD = null, vrstvaD = null, kurzorD = null, rezimPridavani = false, umistovanaFotka = null;
  /* Mapové podklady: hlavní dlaždicový server OSM webové aplikace blokuje (usage policy), CARTO chce klíč.
     Pořadí v ZALOHA_PORADI určuje, kam se automaticky přejde, když dlaždice opakovaně selhávají. */
  const PODKLADY = [
    { klic: 'zakladni', nazev: 'Základní (OSM Německo)', url: 'https://{s}.tile.openstreetmap.de/{z}/{x}/{y}.png', o: { maxZoom: 18, subdomains: 'abc', attribution: '© přispěvatelé <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, dlaždice openstreetmap.de' } },
    { klic: 'hot', nazev: 'Základní (OSM France HOT)', url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', o: { maxZoom: 19, subdomains: 'abc', attribution: '© přispěvatelé <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, styl HOT, hosting OSM France' } },
    { klic: 'turisticka', nazev: 'Turistická (OpenTopoMap)', url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', o: { maxZoom: 17, subdomains: 'abc', attribution: '© OpenStreetMap, SRTM | styl © <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)' } },
    { klic: 'cyklo', nazev: 'Cyklo (CyclOSM)', url: 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png', o: { maxZoom: 19, subdomains: 'abc', attribution: '© OpenStreetMap | styl <a href="https://www.cyclosm.org">CyclOSM</a>, hosting OSM France' } },
    { klic: 'topo', nazev: 'Topografická (Esri)', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', o: { maxZoom: 19, attribution: 'Podklad © Esri a dodavatelé (World Topo Map)' } },
    { klic: 'letecka', nazev: 'Letecká (Esri)', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', o: { maxZoom: 19, attribution: 'Snímky © Esri, Maxar, Earthstar Geographics a další' } },
  ];
  const ZALOHA_PORADI = { zakladni: 'hot', hot: 'topo', turisticka: 'zakladni', cyklo: 'zakladni', topo: 'zakladni', letecka: 'topo' };
  const vsechnyMapy = [];
  function vytvorMapu(id) {
    if (typeof L === 'undefined') { $(id).innerHTML = '<p class="ztlum" style="padding: 12px">Knihovna map se nenačetla.</p>'; return null; }
    const m = L.map(id, { zoomControl: true, worldCopyJump: true });
    const vrstvy = {}, podle = {};
    for (const p of PODKLADY) {
      const v = L.tileLayer(p.url, Object.assign({}, p.o));
      v._klic = p.klic; vrstvy[p.nazev] = v; podle[p.klic] = v;
      // hlídání selhání: ≥ 6 chyb a žádná úspěšná dlaždice od přepnutí → přechod na záložní podklad
      let chyb = 0, ok = 0;
      v.on('add', () => { chyb = 0; ok = 0; });
      v.on('tileload', () => { ok++; });
      v.on('tileerror', () => {
        chyb++;
        if (chyb >= 6 && ok === 0 && m.hasLayer(v) && !m._prepinam) {
          const dalsi = podle[ZALOHA_PORADI[p.klic]];
          if (!dalsi) return;
          m._prepinam = true;
          m.removeLayer(v); dalsi.addTo(m);
          m._prepinam = false;
          info(`Podklad „${p.nazev}“ se nenačítá – přepnuto na „${PODKLADY.find(x => x.klic === dalsi._klic).nazev}“.`);
        }
      });
    }
    const ulozena = lsCti('podklad2', 'zakladni');
    (podle[ulozena] || podle.zakladni).addTo(m);
    L.control.layers(vrstvy, null, { collapsed: true }).addTo(m);
    L.control.scale({ imperial: false }).addTo(m);
    m.on('baselayerchange', e => { if (!m._prepinam && e.layer && e.layer._klic) lsPis('podklad2', e.layer._klic); });
    m.setView([49.8, 15.5], 7);
    m._podklady = podle;
    vsechnyMapy.push(m);
    return m;
  }
  function zajistiMapuDetailu() {
    if (!mapaD) {
      mapaD = vytvorMapu('dMapa');
      if (!mapaD) return;
      vrstvaD = L.layerGroup().addTo(mapaD);
      mapaD.on('click', klikMapaDetailu);
    }
    setTimeout(() => mapaD.invalidateSize(), 50);
  }
  function ikonaMista(cislo) { return L.divIcon({ className: 'znacka-misto', html: String(cislo), iconSize: [24, 24], iconAnchor: [12, 12] }); }
  function prekresliMapuDetailu(prizpusob) {
    if (!mapaD || !S.akt) return;
    vrstvaD.clearLayers(); uvolni('mapaDetail');
    const { vylet: v, trasy, fotky } = S.akt;
    const barva = cssVar('--trasa'), obrys = cssVar('--trasa-obrys'), start = cssVar('--start');
    let bb = null;
    for (const t of trasy) for (const s of t.segmenty) {
      if (!s.length) continue;
      const ll = s.map(b => [b.lat, b.lon]);
      L.polyline(ll, { color: obrys, weight: 7, opacity: 0.7, interactive: false }).addTo(vrstvaD);
      L.polyline(ll, { color: barva, weight: 4, opacity: 0.95 }).bindTooltip(esc(t.nazev || 'Trasa')).addTo(vrstvaD);
      L.circleMarker(ll[0], { radius: 6, color: '#ffffff', weight: 2, fillColor: start, fillOpacity: 1 }).bindTooltip('Start').addTo(vrstvaD);
      L.circleMarker(ll[ll.length - 1], { radius: 6, color: '#ffffff', weight: 2, fillColor: '#222222', fillOpacity: 1 }).bindTooltip('Cíl').addTo(vrstvaD);
      for (const b of s) bb = D.bboxSjednot(bb, [b.lat, b.lon, b.lat, b.lon]);
    }
    (v.body || []).forEach((b, i) => {
      const m = L.marker([b.lat, b.lon], { icon: ikonaMista(i + 1), draggable: true, title: b.nazev })
        .bindPopup(`<b>${esc(b.nazev)}</b>${b.popis ? '<br>' + esc(b.popis) : ''}`).addTo(vrstvaD);
      m.on('dragend', () => { const p = m.getLatLng(); b.lat = +p.lat.toFixed(6); b.lon = +p.lng.toFixed(6); prepocitej(v, trasy, fotky); planujUlozeni(); kresliMista(); });
      bb = D.bboxSjednot(bb, [b.lat, b.lon, b.lat, b.lon]);
    });
    fotky.forEach((f, i) => {
      if (f.lat == null) return;
      const ik = L.divIcon({ className: 'znacka-foto', html: `<img alt="" src="${url('mapaDetail', f.nahled)}">`, iconSize: [38, 38], iconAnchor: [19, 19] });
      L.marker([f.lat, f.lon], { icon: ik, title: f.popis || 'Fotka' }).on('click', () => otevriLightbox(i)).addTo(vrstvaD);
      bb = D.bboxSjednot(bb, [f.lat, f.lon, f.lat, f.lon]);
    });
    if (prizpusob && bb) {
      setTimeout(() => {
        mapaD.invalidateSize();
        if (bb[0] === bb[2] && bb[1] === bb[3]) mapaD.setView([bb[0], bb[1]], 15);
        else mapaD.fitBounds([[bb[0], bb[1]], [bb[2], bb[3]]], { padding: [24, 24], maxZoom: 16 });
      }, 60);
    }
  }
  function rezimMista(zap) {
    rezimPridavani = zap;
    $('btnPridatMisto').setAttribute('aria-pressed', String(zap));
    if (mapaD) mapaD.getContainer().style.cursor = zap || umistovanaFotka ? 'crosshair' : '';
  }
  async function klikMapaDetailu(e) {
    if (!S.akt) return;
    const { vylet: v } = S.akt;
    if (umistovanaFotka) {
      const f = S.akt.fotky.find(x => x.id === umistovanaFotka);
      umistovanaFotka = null; rezimMista(false);
      $('mapaPozn').textContent = 'Poloha fotky nastavena.';
      if (f) { f.lat = +e.latlng.lat.toFixed(6); f.lon = +e.latlng.lng.toFixed(6); f.zdrojPolohy = 'rucne'; await ulozFotkuAObnov(f); }
      return;
    }
    if (!rezimPridavani) return;
    v.body = v.body || [];
    const b = { id: D.novyId('b'), nazev: 'Místo ' + (v.body.length + 1), popis: '', lat: +e.latlng.lat.toFixed(6), lon: +e.latlng.lng.toFixed(6), ele: null };
    v.body.push(b);
    prepocitej(v, S.akt.trasy, S.akt.fotky);
    planujUlozeni();
    rezimMista(false);
    kresliMista(); prekresliMapuDetailu(false); kresliGalerii();
    const inp = document.querySelector(`#dMista [data-bod="${b.id}"] input[data-k="nazev"]`);
    if (inp) { inp.focus(); inp.select(); }
  }

  /* ---------- trasy ---------- */
  function kresliTrasy() {
    const t = S.akt.trasy;
    $('dTrasy').innerHTML = t.map((x, i) => {
      const st = D.statistikaTrasy(x.segmenty, volbyVysek());
      return `<div class="trasa-radek" data-i="${i}"><input type="text" value="${esc(x.nazev || '')}" aria-label="Název trasy" placeholder="Název trasy">
        <span class="male-pismo">${D.km(st.delka)} · ${st.pocetBodu} b.${x.zdroj ? ' · ' + esc(x.zdroj) : ''}</span>
        <button class="tl male" type="button" data-smaz="${i}" aria-label="Odebrat trasu">✕</button></div>`;
    }).join('');
  }
  async function ulozTrasyAObnov(prizpusob) {
    const a = S.akt;
    prepocitej(a.vylet, a.trasy, a.fotky);
    try { await U.ulozTrasy(a.vylet.id, a.trasy); } catch (e) { chyba(e.message); }
    await ulozAkt();
    kresliTrasy(); kresliStatistikuTrasy(); prekresliMapuDetailu(prizpusob);
  }
  async function nactiTextZeSouboru(f) {
    const n = f.name.toLowerCase();
    if (n.endsWith('.kmz')) {
      const z = await otevriZip(f);
      const kml = z.polozky.find(p => /\.kml$/i.test(p.jmeno) && !p.jmeno.includes('/')) || z.polozky.find(p => /\.kml$/i.test(p.jmeno));
      if (!kml) throw new Error('V KMZ chybí soubor .kml');
      return { text: new TextDecoder().decode(await z.data(kml)), jmeno: f.name.replace(/\.kmz$/i, '.kml') };
    }
    return { text: await f.text(), jmeno: f.name };
  }
  async function importujTrasy(soubory) {
    if (!S.akt) return;
    const a = S.akt, v = a.vylet;
    let pridano = 0, bodu = 0;
    for (const f of soubory) {
      try {
        const { text, jmeno } = await nactiTextZeSouboru(f);
        const r = D.nactiTrasu(text, jmeno);
        for (const t of r.trasy) {
          a.trasy.push({ id: D.novyId('t'), nazev: t.nazev || r.nazev || f.name.replace(/\.[^.]+$/, ''), zdroj: f.name, typ: t.typ, segmenty: t.segmenty });
          pridano++;
        }
        if ($('optBodyZGpx').checked && r.body.length) {
          v.body = v.body || [];
          for (const b of r.body) {
            if (v.body.some(x => Math.abs(x.lat - b.lat) < 1e-6 && Math.abs(x.lon - b.lon) < 1e-6)) continue;
            v.body.push({ id: D.novyId('b'), nazev: b.nazev, popis: b.popis || '', lat: b.lat, lon: b.lon, ele: b.ele });
            bodu++;
          }
        }
        if ((!v.nazev || v.nazev === 'Nový výlet') && (r.nazev || (r.trasy[0] && r.trasy[0].nazev))) {
          v.nazev = r.nazev || r.trasy[0].nazev; $('dNazev').value = v.nazev; $('dNadpis').textContent = v.nazev;
        }
        const t0 = r.trasy.flatMap(t => t.segmenty).flat().find(b => b.t);
        if (t0 && (!v.datumOd || v.datumOd === dnes())) {
          const d = new Date(t0.t);
          v.datumOd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          $('dOd').value = v.datumOd;
        }
      } catch (e) { chyba(`${f.name}: ${e.message}`); }
    }
    if (pridano || bodu) {
      await ulozTrasyAObnov(true);
      kresliMista();
      info(`Importováno: ${pridano} ${pridano === 1 ? 'trasa' : pridano > 1 && pridano < 5 ? 'trasy' : 'tras'}${bodu ? `, ${bodu} míst` : ''}.`);
    }
  }
  function trasyZPlanovace() {
    for (const k of ['walkingRoutesData_v9', 'walkingRoutesData_v8', 'walkingRoutesData_v7']) {
      try {
        const s = localStorage.getItem(k);
        if (!s) continue;
        const d = JSON.parse(s);
        if (d && Array.isArray(d.routes)) return d.routes.filter(r => Array.isArray(r.points) && r.points.length);
      } catch (e) {}
    }
    return [];
  }
  async function prevzitZPlanovace() {
    const routes = trasyZPlanovace();
    if (!routes.length) {
      await potvrd('V tomto prohlížeči nejsou žádné trasy ze Správce pěších tras.\n\nNaplánujte trasu v plánovači (trip_planner.html), nebo z něj exportujte GPX (Statistiky → Export GPX) a importujte jej sem.', { ok: 'Rozumím', zrus: 'Zavřít' });
      return;
    }
    const dlg = document.createElement('dialog');
    dlg.className = 'dlg-okno';
    dlg.style.cssText = 'max-width: min(92vw, 480px); padding: 0; border: 1px solid var(--border); border-radius: 10px; background: var(--bg-elevated); color: var(--text)';
    dlg.innerHTML = `<form method="dialog" style="padding: 18px">
      <h2 style="margin-top: 0">Převzít trasu z plánovače</h2>
      <p class="ztlum">Plánovač ukládá jen své body; trasa se proto převezme jako spojnice bodů. Přesnou geometrii po cestách získáte exportem GPX z plánovače (Statistiky → Export GPX). Data plánovače se nemění.</p>
      <div style="max-height: 40vh; overflow: auto">${routes.map((r, i) => `<label style="display: flex; gap: 8px; align-items: center; color: var(--text); font-size: 0.9rem"><input type="checkbox" value="${i}" ${i === 0 ? 'checked' : ''}> ${esc(r.name || 'Trasa ' + (i + 1))} <span class="male-pismo">(${r.points.length} bodů)</span></label>`).join('')}</div>
      <div class="rada mezera" style="justify-content: flex-end"><button class="tl" value="zrus">Zrušit</button><button class="tl hlavni" value="ok">Převzít</button></div></form>`;
    document.body.appendChild(dlg);
    dlg.showModal();
    const vysl = await new Promise(r => dlg.addEventListener('close', () => r(dlg.returnValue), { once: true }));
    const vybrane = [...dlg.querySelectorAll('input:checked')].map(c => routes[+c.value]);
    dlg.remove();
    if (vysl !== 'ok' || !vybrane.length || !S.akt) return;
    const a = S.akt;
    for (const r of vybrane) {
      const seg = r.points.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng)).map(p => ({ lat: p.lat, lon: p.lng, ele: null, t: null }));
      if (seg.length > 1) a.trasy.push({ id: D.novyId('t'), nazev: r.name || 'Z plánovače', zdroj: 'Správce pěších tras', typ: 'planovac', segmenty: [seg] });
      if ($('optBodyZGpx').checked) {
        a.vylet.body = a.vylet.body || [];
        for (const p of r.points) if (p.name && Number.isFinite(p.lat)) a.vylet.body.push({ id: D.novyId('b'), nazev: p.name, popis: p.notes || '', lat: p.lat, lon: p.lng, ele: null });
      }
    }
    await ulozTrasyAObnov(true);
    kresliMista();
    info('Trasa převzata z plánovače.');
  }

  /* ---------- statistika a profil ---------- */
  let profilData = null;
  function kresliStatistikuTrasy() {
    const v = S.akt.vylet, st = v.statistika;
    const el = $('dStat');
    if (!st || !st.pocetBodu) {
      el.innerHTML = '<p class="ztlum">Zatím bez trasy – importujte GPX/KML nebo převezměte trasu z plánovače.</p>';
      $('profilObal').hidden = true; profilData = null; return;
    }
    const r = [['Délka', D.km(st.delka)]];
    if (st.maVysky) {
      r.push(['Stoupání vyhlazené', D.metry(st.stoupani)], ['Klesání vyhlazené', D.metry(st.klesani)],
        ['Stoupání / klesání syrové', D.metry(st.stoupaniSyrove) + ' / ' + D.metry(st.klesaniSyrove)],
        ['Nejnižší / nejvyšší bod', D.metry(st.minEle) + ' / ' + D.metry(st.maxEle)]);
    } else r.push(['Výšky', 'trasa neobsahuje výšky']);
    if (st.maCasy) {
      r.push(['Čas celkem', D.doba(st.casCelkem)], ['Čas v pohybu', D.doba(st.casPohyb)]);
      if (st.casPohyb > 0) r.push(['Průměrná rychlost v pohybu', D.cislo(st.delka / 1000 / (st.casPohyb / 3600000), 1) + ' km/h']);
    }
    r.push(['Počet bodů', D.cislo(st.pocetBodu)]);
    el.innerHTML = `<table class="tab-stat"><tbody>${r.map(x => `<tr><th>${x[0]}</th><td class="c">${x[1]}</td></tr>`).join('')}</tbody></table>
      <p class="male-pismo" style="margin-top: 6px">Vyhlazení: okno ${D.cislo(nast.okno)} m, práh ${D.cislo(nast.prah, 1)} m.</p>`;
    const mz = st.maCasy ? D.mezicasy(vsechnySegmenty(S.akt.trasy), 1000, volbyVysek()) : [];
    $('mezicasyObal').hidden = !mz.length;
    let soucet = 0;
    $('dMezicasy').innerHTML = mz.length ? `<table class="tab-stat"><thead><tr><th>Úsek</th><th class="c">Čas</th><th class="c">Tempo</th><th class="c">Rychlost</th><th class="c">↑</th><th class="c">↓</th><th class="c">Od startu</th></tr></thead><tbody>` +
      mz.map(m => { soucet += m.cas; return `<tr><td>${D.cislo(m.od / 1000, m.od % 1000 ? 1 : 0)}–${D.cislo(m.do / 1000, m.do % 1000 ? 2 : 0)} km</td><td class="c">${D.doba(m.cas)}</td><td class="c">${D.tempo(m.rychlost)}</td><td class="c">${m.rychlost ? D.cislo(m.rychlost * 3.6, 1) + '\u00a0km/h' : '–'}</td><td class="c">${D.metry(m.stoupani)}</td><td class="c">${D.metry(m.klesani)}</td><td class="c">${D.doba(soucet)}</td></tr>`; }).join('') + '</tbody></table>' : '';
    const p = st.maVysky ? D.vyskovyProfil(vsechnySegmenty(S.akt.trasy), volbyVysek()) : [];
    profilData = p.length > 1 ? p : null;
    $('profilObal').hidden = !profilData;
    if (profilData) requestAnimationFrame(() => kresliProfil(null));
  }
  function kresliProfil(kurzorD) {
    const c = $('profil'), p = profilData;
    if (!p || !c.isConnected || c.offsetParent === null) return;
    const dpr = window.devicePixelRatio || 1, w = c.clientWidth, h = c.clientHeight;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const ml = 46, mr = 10, mt = 10, mb = 22;
    const dMax = p[p.length - 1].d || 1;
    let eMin = Infinity, eMax = -Infinity;
    for (const b of p) { eMin = Math.min(eMin, b.ele); eMax = Math.max(eMax, b.ele); }
    if (eMax - eMin < 20) { const s = (eMin + eMax) / 2; eMin = s - 10; eMax = s + 10; }
    const krokE = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000].find(k => (eMax - eMin) / k <= 4) || 1000;
    eMin = Math.floor(eMin / krokE) * krokE; eMax = Math.ceil(eMax / krokE) * krokE;
    const X = d => ml + d / dMax * (w - ml - mr), Y = e => mt + (eMax - e) / (eMax - eMin) * (h - mt - mb);
    const txt = cssVar('--text-muted'), mrz = cssVar('--border');
    g.font = '11px ' + (cssVar('--font') || 'sans-serif'); g.fillStyle = txt; g.strokeStyle = mrz; g.lineWidth = 1;
    g.textAlign = 'right'; g.textBaseline = 'middle';
    for (let e = eMin; e <= eMax + 1e-9; e += krokE) { const y = Math.round(Y(e)) + 0.5; g.beginPath(); g.moveTo(ml, y); g.lineTo(w - mr, y); g.stroke(); g.fillText(D.cislo(e), ml - 5, y); }
    const krokD = [100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000].find(k => dMax / k <= Math.max(3, (w - ml) / 70)) || 100000;
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    for (let d = 0; d <= dMax + 1e-9; d += krokD) if (X(d) < w - mr - 24) g.fillText(D.cislo(d / 1000, krokD < 1000 ? 1 : 0), X(d), h - 6);
    g.textAlign = 'right'; g.fillText('km', w - mr, h - 6);
    // plocha + syrová a vyhlazená čára
    g.beginPath(); g.moveTo(X(0), Y(eMin));
    for (const b of p) g.lineTo(X(b.d), Y(b.eleHladka));
    g.lineTo(X(dMax), Y(eMin)); g.closePath(); g.fillStyle = cssVar('--profil-plocha'); g.fill();
    g.beginPath(); p.forEach((b, i) => (i ? g.lineTo(X(b.d), Y(b.ele)) : g.moveTo(X(b.d), Y(b.ele))));
    g.strokeStyle = cssVar('--profil-syrovy'); g.lineWidth = 1; g.stroke();
    g.beginPath(); p.forEach((b, i) => (i ? g.lineTo(X(b.d), Y(b.eleHladka)) : g.moveTo(X(b.d), Y(b.eleHladka))));
    g.strokeStyle = cssVar('--accent'); g.lineWidth = 2; g.stroke();
    if (kurzorD != null) {
      const b = bodProfilu(kurzorD);
      const x = X(b.d);
      g.strokeStyle = cssVar('--text'); g.lineWidth = 1; g.beginPath(); g.moveTo(x, mt); g.lineTo(x, h - mb); g.stroke();
      g.fillStyle = cssVar('--trasa'); g.beginPath(); g.arc(x, Y(b.eleHladka), 4, 0, Math.PI * 2); g.fill();
    }
    c._mapa = { X, ml, mr, w, dMax };
  }
  function bodProfilu(d) {
    const p = profilData;
    let lo = 0, hi = p.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (p[m].d <= d) lo = m; else hi = m; }
    return Math.abs(p[lo].d - d) <= Math.abs(p[hi].d - d) ? p[lo] : p[hi];
  }
  function pohybProfil(e) {
    const c = $('profil');
    if (!profilData || !c._mapa) return;
    const r = c.getBoundingClientRect(), m = c._mapa;
    const x = Math.max(m.ml, Math.min(m.w - m.mr, e.clientX - r.left));
    const d = (x - m.ml) / (m.w - m.ml - m.mr) * m.dMax;
    const b = bodProfilu(d);
    kresliProfil(d);
    const pp = $('profilPopis');
    pp.hidden = false;
    pp.textContent = `${D.cislo(b.d / 1000, 2)} km · ${D.cislo(b.ele)} m n. m.${b.t ? ' · ' + new Date(b.t).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' }) : ''}${b.v ? ' · ' + D.cislo(b.v * 3.6, 1) + ' km/h (' + D.tempo(b.v) + ')' : ''}`;
    if (mapaD) {
      if (!kurzorD) kurzorD = L.circleMarker([b.lat, b.lon], { radius: 7, color: '#ffffff', weight: 2, fillColor: cssVar('--trasa'), fillOpacity: 1, interactive: false }).addTo(mapaD);
      else kurzorD.setLatLng([b.lat, b.lon]);
    }
  }
  function opustProfil() {
    $('profilPopis').hidden = true; kresliProfil(null);
    if (kurzorD) { kurzorD.remove(); kurzorD = null; }
  }
  async function zmenaVyhlazeni() {
    const o = D.parseCislo($('optOkno').value), p = D.parseCislo($('optPrah').value);
    if (o === null || o < 0 || p === null || p < 0) return;
    nast.okno = Math.min(1000, o); nast.prah = Math.min(50, p); ulozNast();
    if (S.akt) { prepocitej(S.akt.vylet, S.akt.trasy, S.akt.fotky); await ulozAkt(); kresliStatistikuTrasy(); }
    // přepočet ostatních výletů na pozadí
    try {
      const vse = await U.vsechnyTrasy();
      for (const r of vse) {
        const v = S.vylety.find(x => x.id === r.vyletId);
        if (!v || (S.akt && v === S.akt.vylet)) continue;
        v.statistika = D.statistikaTrasy(vsechnySegmenty(r.trasy), volbyVysek());
        await U.ulozVylet(v);
      }
    } catch (e) { chyba(e.message); }
  }

  /* ---------- místa ---------- */
  function kresliMista() {
    const v = S.akt.vylet, body = v.body || [];
    $('pocetMist').textContent = body.length ? `(${body.length})` : '';
    if (!body.length) { $('dMista').innerHTML = '<p class="ztlum">Zatím žádná místa.</p>'; return; }
    $('dMista').innerHTML = body.map((b, i) => `<div class="misto-radek" data-bod="${esc(b.id)}">
      <span class="cislo">${i + 1}</span>
      <div class="misto-pole"><input type="text" data-k="nazev" value="${esc(b.nazev)}" aria-label="Název místa">
        <input type="text" data-k="popis" value="${esc(b.popis || '')}" placeholder="popis" aria-label="Popis místa"></div>
      <div class="rada" style="flex-wrap: nowrap"><button class="tl male" type="button" data-akce="ukaz" title="${D.cislo(b.lat, 5)}, ${D.cislo(b.lon, 5)}">Na mapě</button>
        <button class="tl male" type="button" data-akce="smaz" aria-label="Smazat místo">✕</button></div></div>`).join('');
  }

  /* ---------- fotky ---------- */
  async function doBlobu(zdroj, w, h, typ, kvalita) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(zdroj, 0, 0, w, h);
    let b = await new Promise(r => c.toBlob(r, typ, kvalita));
    if (!b || b.type !== typ) b = await new Promise(r => c.toBlob(r, 'image/jpeg', kvalita));   // Safari neumí zakódovat WebP
    c.width = c.height = 0;
    if (!b) throw new Error('Obrázek se nepodařilo zakódovat');
    return b;
  }
  async function dekoduj(blob) {
    if (window.createImageBitmap) {
      try { return await createImageBitmap(blob, { imageOrientation: 'from-image' }); } catch (e) {}
    }
    return new Promise((ok, err) => {
      const i = new Image(), u = URL.createObjectURL(blob);
      i.onload = () => { URL.revokeObjectURL(u); ok(i); };
      i.onerror = () => { URL.revokeObjectURL(u); err(new Error('Formát obrázku prohlížeč neumí dekódovat (HEIC/RAW?) – převeďte jej na JPEG')); };
      i.src = u;
    });
  }
  const mistniIso = t => { const d = new Date(t), p = x => String(x).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; };

  async function zpracujFotku(soubor, o) {
    let exif = null;
    try { exif = D.ctiExif(await soubor.slice(0, 256 * 1024).arrayBuffer()); } catch (e) { exif = null; }
    const obr = await dekoduj(soubor);
    const w = obr.width || obr.naturalWidth, h = obr.height || obr.naturalHeight;
    const r = o.max ? D.zmensiRozmer(w, h, o.max) : { w, h };
    const obrazek = await doBlobu(obr, r.w, r.h, o.format, 0.86);
    const n = D.zmensiRozmer(w, h, 480);
    const nahled = await doBlobu(obr, n.w, n.h, o.format, 0.78);
    if (obr.close) obr.close();
    const f = { id: D.novyId('f'), vyletId: o.vyletId, popis: '', bodId: null, lat: null, lon: null, ele: null, zdrojPolohy: null,
      datum: null, zdrojData: null, casUTC: null, sirka: r.w, vyska: r.h, obrazek, nahled, original: o.original ? soubor : null,
      nazevSouboru: soubor.name || 'foto', velikostOriginalu: soubor.size, typOriginalu: soubor.type || '', vyrobce: exif ? [exif.vyrobce, exif.model].filter(Boolean).join(' ') : '', pridano: Date.now(), poradi: 0 };
    if (exif && exif.datum) {
      f.datum = exif.datum; f.zdrojData = 'exif';
      f.casUTC = exif.datumUTC != null ? exif.datumUTC : exif.gpsCasUTC != null ? exif.gpsCasUTC : Date.parse(exif.datum);
    } else if (soubor.lastModified) {
      f.datum = mistniIso(soubor.lastModified); f.zdrojData = 'soubor'; f.casUTC = soubor.lastModified;
    }
    if (f.casUTC != null && exif && exif.datumUTC == null && exif.gpsCasUTC == null) f.casUTC -= (o.posun || 0) * 60000;
    if (exif && exif.gps) { f.lat = +exif.gps.lat.toFixed(6); f.lon = +exif.gps.lon.toFixed(6); f.ele = exif.gps.alt; f.zdrojPolohy = 'exif'; }
    else if (o.podleCasu && f.casUTC != null && f.zdrojData === 'exif') {
      const p = D.polohaPodleCasu(vsechnySegmenty(o.trasy), f.casUTC);
      if (p) { f.lat = +p.lat.toFixed(6); f.lon = +p.lon.toFixed(6); f.ele = p.ele; f.zdrojPolohy = 'cas'; }
    }
    return f;
  }

  async function pridejFotky(soubory) {
    if (!S.akt) return;
    soubory = [...soubory].filter(f => /^image\//.test(f.type) || /\.(jpe?g|png|webp|gif|avif|heic|heif)$/i.test(f.name));
    if (!soubory.length) { chyba('Vyberte obrázky (JPEG, PNG, WebP…).'); return; }
    const o = { vyletId: S.akt.vylet.id, max: nast.max, format: nast.format, original: nast.original, podleCasu: nast.podleCasu, posun: nast.posun, trasy: S.akt.trasy };
    const odhad = soubory.reduce((s, f) => s + Math.min(f.size, 1.5e6) + 60e3 + (o.original ? f.size : 0), 0);
    const misto = await U.kontrolaMista(odhad);
    if (!misto.vejde && !(await potvrd(`Fotky zaberou asi ${D.velikostText(odhad)}, volné místo je jen ${D.velikostText(misto.volno)}. Ukládání může selhat. Pokračovat?`, { ok: 'Pokračovat', zrus: 'Zrušit' }))) return;
    const a = S.akt, post = $('postupFotky');
    let hotovo = 0, chyb = 0;
    const zac = a.fotky.length;
    for (const s of soubory) {
      post.textContent = `Zpracovávám ${hotovo + chyb + 1} z ${soubory.length}: ${s.name}`;
      try {
        const f = await zpracujFotku(s, o);
        f.poradi = zac + hotovo;
        const blizko = f.lat != null ? D.nejblizsiBod(a.vylet.body, f.lat, f.lon, nast.dosah) : null;
        if (blizko) f.bodId = blizko.bod.id;
        await U.ulozFotku(f);
        if (S.akt !== a) break;
        a.fotky.push(f);
        hotovo++;
      } catch (e) {
        chyb++;
        chyba(`${s.name}: ${e.message}`);
        if (e.name === 'QuotaExceededError') break;
      }
      await pauza(0);
    }
    post.textContent = `Přidáno ${hotovo} fotek` + (chyb ? `, ${chyb} se nepodařilo` : '') + '.';
    if (S.akt !== a) return;
    const v = a.vylet;
    if (!v.titulniFoto && a.fotky.length) v.titulniFoto = a.fotky[0].id;
    if (!v.datumOd) { const d = a.fotky.map(f => f.datum).filter(Boolean).sort()[0]; if (d) { v.datumOd = d.slice(0, 10); $('dOd').value = v.datumOd; } }
    S.pocetFotek[v.id] = a.fotky.length;
    prepocitej(v, a.trasy, a.fotky);
    await ulozAkt();
    kresliGalerii(); prekresliMapuDetailu(hotovo > 0 && !a.trasy.length);
  }

  function kresliGalerii() {
    uvolni('galerie');
    const a = S.akt, el = $('galerie');
    $('pocetFotek').textContent = a.fotky.length ? `(${a.fotky.length})` : '';
    if (!a.fotky.length) { el.innerHTML = ''; return; }
    const body = a.vylet.body || [];
    const zdroj = { exif: '📍 GPS z EXIFu', cas: '📍 podle času trasy', rucne: '📍 umístěno ručně' };
    el.innerHTML = a.fotky.map((f, i) => `<div class="foto" data-foto="${esc(f.id)}">
      <button class="nahled" type="button" data-akce="zvetsi" aria-label="Zvětšit fotku"><img alt="${esc(f.popis || f.nazevSouboru)}" src="${url('galerie', f.nahled)}" loading="lazy"></button>
      <div class="telo">
        <input type="text" data-k="popis" value="${esc(f.popis || '')}" placeholder="popisek" aria-label="Popisek fotky">
        <select data-k="bodId" aria-label="Místo"><option value="">— bez místa —</option>${body.map((b, j) => `<option value="${esc(b.id)}"${b.id === f.bodId ? ' selected' : ''}>${j + 1}. ${esc(b.nazev)}</option>`).join('')}</select>
        <div class="meta">${f.datum ? esc(f.datum.replace('T', ' ').slice(0, 16)) + (f.zdrojData === 'soubor' ? ' (datum souboru)' : '') : 'bez data'}<br>
          ${f.lat != null ? `<span class="poloha-ok">${zdroj[f.zdrojPolohy] || '📍'}</span>` : 'bez polohy'} · ${f.sirka}×${f.vyska} · ${D.velikostText(f.obrazek ? f.obrazek.size : 0)}${f.original ? ' + originál ' + D.velikostText(f.original.size) : ''}</div>
        <div class="akce">
          <button class="tl male" type="button" data-akce="umisti" title="Umístit kliknutím do mapy">📍</button>
          ${f.lat != null ? '<button class="tl male" type="button" data-akce="bezpolohy" title="Odebrat polohu">⌀</button>' : ''}
          <button class="tl male" type="button" data-akce="titulni" title="Titulní fotka výletu" aria-pressed="${a.vylet.titulniFoto === f.id}">★</button>
          <button class="tl male" type="button" data-akce="vlevo" title="Posunout dopředu"${i === 0 ? ' disabled' : ''}>◀</button>
          <button class="tl male" type="button" data-akce="vpravo" title="Posunout dozadu"${i === a.fotky.length - 1 ? ' disabled' : ''}>▶</button>
          <button class="tl male nebezpeci" type="button" data-akce="smaz" title="Smazat fotku">✕</button>
        </div>
      </div></div>`).join('');
  }
  async function ulozFotkuAObnov(f) {
    try { await U.ulozFotku(f); } catch (e) { chyba(e.message); }
    if (!S.akt) return;
    prepocitej(S.akt.vylet, S.akt.trasy, S.akt.fotky); planujUlozeni();
    kresliGalerii(); prekresliMapuDetailu(false);
  }
  async function akceFotky(f, akce) {
    const a = S.akt, i = a.fotky.indexOf(f);
    if (akce === 'zvetsi') otevriLightbox(i);
    else if (akce === 'umisti') {
      umistovanaFotka = f.id; rezimMista(false); if (mapaD) mapaD.getContainer().style.cursor = 'crosshair';
      $('mapaPozn').textContent = 'Klikněte do mapy na místo, kde fotka vznikla.';
      $('dMapa').scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (akce === 'bezpolohy') { f.lat = f.lon = f.ele = null; f.zdrojPolohy = null; await ulozFotkuAObnov(f); }
    else if (akce === 'titulni') { a.vylet.titulniFoto = f.id; planujUlozeni(); kresliGalerii(); }
    else if (akce === 'vlevo' || akce === 'vpravo') {
      const j = akce === 'vlevo' ? i - 1 : i + 1;
      if (j < 0 || j >= a.fotky.length) return;
      [a.fotky[i], a.fotky[j]] = [a.fotky[j], a.fotky[i]];
      a.fotky.forEach((x, k) => { x.poradi = k; });
      try { await U.ulozFotky(a.fotky); } catch (e) { chyba(e.message); }
      kresliGalerii(); prekresliMapuDetailu(false);
    } else if (akce === 'smaz') {
      if (!(await potvrd('Smazat tuto fotku z deníku?', { ok: 'Smazat', zrus: 'Ponechat' }))) return;
      try { await U.smazFotku(f.id); } catch (e) { chyba(e.message); return; }
      a.fotky.splice(i, 1);
      if (a.vylet.titulniFoto === f.id) a.vylet.titulniFoto = a.fotky.length ? a.fotky[0].id : null;
      S.pocetFotek[a.vylet.id] = a.fotky.length;
      prepocitej(a.vylet, a.trasy, a.fotky); planujUlozeni();
      kresliGalerii(); prekresliMapuDetailu(false);
    }
  }
  async function autoPrirazeni() {
    const a = S.akt;
    if (!a) return;
    if (!(a.vylet.body || []).length) { chyba('Výlet nemá žádná místa.'); return; }
    let n = 0;
    const zmenene = [];
    for (const f of a.fotky) {
      if (f.lat == null) continue;
      const b = D.nejblizsiBod(a.vylet.body, f.lat, f.lon, nast.dosah);
      const id = b ? b.bod.id : null;
      if (id && id !== f.bodId) { f.bodId = id; zmenene.push(f); n++; }
    }
    if (zmenene.length) { try { await U.ulozFotky(zmenene); } catch (e) { chyba(e.message); } }
    kresliGalerii();
    info(n ? `Přiřazeno ${n} fotek.` : 'Žádná fotka s polohou není v dosahu nového místa.');
  }

  /* ---------- lightbox ---------- */
  let lbIndex = 0, lbUrl = null, lbOrigUrl = null;
  function otevriLightbox(i) {
    const a = S.akt;
    if (!a || !a.fotky[i]) return;
    lbIndex = i;
    const f = a.fotky[i];
    if (lbUrl) URL.revokeObjectURL(lbUrl);
    if (lbOrigUrl) { URL.revokeObjectURL(lbOrigUrl); lbOrigUrl = null; }
    lbUrl = URL.createObjectURL(f.obrazek || f.nahled);
    $('lbObr').src = lbUrl; $('lbObr').alt = f.popis || f.nazevSouboru;
    const bod = (a.vylet.body || []).find(b => b.id === f.bodId);
    $('lbPopis').innerHTML = `<b>${esc(f.popis || f.nazevSouboru)}</b><br><span class="male-pismo">${i + 1} / ${a.fotky.length}${f.datum ? ' · ' + esc(f.datum.replace('T', ' ').slice(0, 16)) : ''}${bod ? ' · ' + esc(bod.nazev) : ''}${f.vyrobce ? ' · ' + esc(f.vyrobce) : ''}</span>`;
    const o = $('lbOriginal');
    if (f.original) { lbOrigUrl = URL.createObjectURL(f.original); o.href = lbOrigUrl; o.download = f.nazevSouboru; o.hidden = false; } else o.hidden = true;
    $('lbPred').disabled = i === 0; $('lbDalsi').disabled = i === a.fotky.length - 1;
    if (!$('lightbox').open) $('lightbox').showModal();
  }

  /* =====================================================================
     KALENDÁŘ
     ===================================================================== */
  function kresliKalendar() {
    const { rok, mesic } = S.kal, sez = filtrovane();
    $('kalNadpis').textContent = `${D.MESICE[mesic]} ${rok}`;
    const dn = D.denCislo(dnes());
    let h = D.DNY.map(d => `<div class="dn">${d}</div>`).join('');
    for (const d of D.mesicMrizka(rok, mesic)) {
      const v = D.vyletyVeDni(sez, d.denCislo);
      h += `<div class="den${d.vMesici ? '' : ' mimo'}${d.denCislo === dn ? ' dnes' : ''}" data-den="${d.den}" role="button" tabindex="0" aria-label="${d.cislo}. ${D.MESICE_2P[new Date(d.denCislo * 86400000).getUTCMonth()]}${v.length ? ', ' + v.length + ' výlet' : ''}">
        <span class="c">${d.cislo}</span>${v.map(x => `<button type="button" class="cip" data-id="${esc(x.id)}" title="${esc(x.nazev)}">${esc(x.nazev || 'výlet')}</button>`).join('')}</div>`;
    }
    $('kal').innerHTML = h;
    const vRoce = sez.filter(v => { const r = D.rozsahDni(v); return r; });
    $('rokPas').innerHTML = D.MESICE.map((m, i) => {
      const a = D.denCislo(`${rok}-${String(i + 1).padStart(2, '0')}-01`), b = i === 11 ? D.denCislo(`${rok + 1}-01-01`) - 1 : D.denCislo(`${rok}-${String(i + 2).padStart(2, '0')}-01`) - 1;
      const n = vRoce.filter(v => { const r = D.rozsahDni(v); return r[0] <= b && r[1] >= a; }).length;
      return `<button type="button" data-m="${i}" class="${i === mesic ? 'akt' : ''}" aria-label="${m} ${rok}: ${n} výletů">${D.MESICE_ZKR[i]}<b>${n || '·'}</b></button>`;
    }).join('');
    const a = D.denCislo(`${rok}-${String(mesic + 1).padStart(2, '0')}-01`), b = mesic === 11 ? D.denCislo(`${rok + 1}-01-01`) - 1 : D.denCislo(`${rok}-${String(mesic + 2).padStart(2, '0')}-01`) - 1;
    const vm = D.seradVylety(sez.filter(v => { const r = D.rozsahDni(v); return r && r[0] <= b && r[1] >= a; }), 'vzestupne');
    $('kalSeznam').innerHTML = vm.length ? '<ul style="margin: 0; padding-left: 18px">' + vm.map(v => `<li><button type="button" class="odkaz" data-id="${esc(v.id)}">${esc(v.nazev || 'Bez názvu')}</button> – ${esc(D.rozsahCesky(v))}${v.statistika && v.statistika.delka ? ', ' + D.km(v.statistika.delka) : ''}</li>`).join('') + '</ul>'
      : 'V tomto měsíci žádný výlet. Kliknutím na den můžete výlet založit.';
  }
  function posunMesic(k) {
    let { rok, mesic } = S.kal;
    mesic += k;
    if (mesic < 0) { mesic = 11; rok--; } else if (mesic > 11) { mesic = 0; rok++; }
    S.kal = { rok, mesic }; kresliKalendar();
  }

  /* =====================================================================
     MAPA VŠECH MÍST
     ===================================================================== */
  let mapaV = null, vrstvaV = null, fotkyVse = null, posledniFiltrMapy = '';
  async function kresliMapuVse() {
    if (!mapaV) {
      mapaV = vytvorMapu('mMapa');
      if (!mapaV) return;
      vrstvaV = L.layerGroup().addTo(mapaV);
      mapaV.on('moveend', () => { if ($('optVyrez').checked) kresliSeznamMapy(); });
    }
    setTimeout(() => mapaV.invalidateSize(), 50);
    vrstvaV.clearLayers(); uvolni('mapaVse');
    const sez = filtrovane();
    const barva0 = cssVar('--trasa'), obrys = cssVar('--trasa-obrys'), misto = cssVar('--misto'), foto = cssVar('--foto');
    const podleRoku = $('optBarvyRoku').checked;
    const roky = [...new Set(sez.map(v => String(v.datumOd || '').slice(0, 4)))].sort().reverse();
    const barvaV = v => podleRoku ? cssVar('--rok-' + (roky.indexOf(String(v.datumOd || '').slice(0, 4)) % 6)) : barva0;
    $('mLegenda').innerHTML = podleRoku ? roky.map((r, i) => `<span><i style="background: var(--rok-${i % 6})"></i>${/^\d{4}$/.test(r) ? r : 'bez data'}</span>`).join('') + (roky.length > 6 ? '<span>(barvy se po 6 letech opakují)</span>' : '') : '';
    let bb = null;
    const popup = v => `<b>${esc(v.nazev || 'Bez názvu')}</b><br>${esc(D.rozsahCesky(v))}${v.statistika && v.statistika.delka ? '<br>' + D.km(v.statistika.delka) : ''}<br><a href="#" data-otevri="${esc(v.id)}">Otevřít výlet</a>`;
    for (const v of sez) {
      const barva = barvaV(v);
      for (const l of v.nahled || []) {
        if (l.length < 2) continue;
        L.polyline(l, { color: obrys, weight: 6, opacity: 0.6, interactive: false }).addTo(vrstvaV);
        L.polyline(l, { color: barva, weight: 3.5 }).bindPopup(popup(v)).bindTooltip(esc(v.nazev || '')).addTo(vrstvaV);
      }
      if ($('optMapaMista').checked) for (const b of v.body || []) {
        L.circleMarker([b.lat, b.lon], { radius: 6, color: '#1b1b1b', weight: 1.5, fillColor: misto, fillOpacity: 1 })
          .bindPopup(`<b>${esc(b.nazev)}</b>${b.popis ? '<br>' + esc(b.popis) : ''}<hr style="margin: 4px 0">${popup(v)}`).addTo(vrstvaV);
      }
      // značka výletu (start trasy / první místo / střed) – viditelná i při malém přiblížení
      const zn = v.nahled && v.nahled[0] && v.nahled[0][0] ? v.nahled[0][0] : (v.body && v.body[0] ? [v.body[0].lat, v.body[0].lon] : (v.bbox ? [(v.bbox[0] + v.bbox[2]) / 2, (v.bbox[1] + v.bbox[3]) / 2] : null));
      if (zn) L.circleMarker(zn, { radius: 7, color: '#ffffff', weight: 2, fillColor: barva, fillOpacity: 1 }).bindPopup(popup(v)).bindTooltip(esc(v.nazev || '')).addTo(vrstvaV);
      bb = D.bboxSjednot(bb, v.bbox || (v.statistika && v.statistika.bbox) || D.bodyBbox(v.body));
    }
    if ($('optMapaFotky').checked) {
      try {
        if (!fotkyVse) fotkyVse = await U.vsechnyFotky();
        const ids = new Set(sez.map(v => v.id));
        for (const f of fotkyVse) {
          if (f.lat == null || !ids.has(f.vyletId)) continue;
          const v = S.vylety.find(x => x.id === f.vyletId);
          const m = L.circleMarker([f.lat, f.lon], { radius: 5, color: '#ffffff', weight: 1.5, fillColor: foto, fillOpacity: 1 }).addTo(vrstvaV);
          m.bindPopup(() => `<img alt="" src="${url('mapaVse', f.nahled)}" style="max-width: 220px; max-height: 180px; display: block; border-radius: 4px">${f.popis ? esc(f.popis) + '<br>' : ''}${v ? popup(v) : ''}`, { maxWidth: 240 });
        }
      } catch (e) { chyba(e.message); }
    }
    const klic = JSON.stringify(S.filtr);
    if (bb && (klic !== posledniFiltrMapy || !mapaV._nastaveno)) {
      posledniFiltrMapy = klic; mapaV._nastaveno = true;
      setTimeout(() => { mapaV.invalidateSize(); mapaV.fitBounds([[bb[0], bb[1]], [bb[2], bb[3]]], { padding: [30, 30], maxZoom: 13 }); kresliSeznamMapy(); }, 80);
    } else kresliSeznamMapy();
  }
  function kresliSeznamMapy() {
    let sez = filtrovane();
    const vyrez = $('optVyrez').checked && mapaV;
    if (vyrez) {
      const b = mapaV.getBounds();
      sez = D.filtrujVylety(sez, { bbox: [b.getSouth(), b.getWest(), b.getNorth(), b.getEast()] });
    }
    $('mNadpis').textContent = vyrez ? `Výlety ve výřezu mapy (${sez.length})` : `Výlety na mapě (${sez.length})`;
    $('mSeznam').innerHTML = sez.length ? '<ul style="margin: 0; padding-left: 18px; line-height: 1.7">' + sez.map(v => `<li><button type="button" class="odkaz" data-id="${esc(v.id)}">${esc(v.nazev || 'Bez názvu')}</button> <span class="male-pismo">${esc(D.rozsahCesky(v))}${v.oblast ? ' · ' + esc(v.oblast) : ''}${v.statistika && v.statistika.delka ? ' · ' + D.km(v.statistika.delka) : ''}${!v.bbox ? ' · bez polohy' : ''}</span></li>`).join('') + '</ul>'
      : '<p class="ztlum">Žádný výlet.</p>';
  }

  /* =====================================================================
     STATISTIKY
     ===================================================================== */
  function kresliStatistiky() {
    const sez = filtrovane();
    const roky = D.statistikyPodleLet(sez, S.pocetFotek), s = D.souhrn(roky);
    const bezData = sez.filter(v => !/^\d{4}/.test(v.datumOd || '')).length;
    $('sDlazdice').innerHTML = [
      [s.vyletu, 'výletů' + (bezData ? ` (+${bezData} bez data)` : '')], [s.dni, 'dní na cestách'], [D.km(s.delka), 'nachozeno / najeto (trasy)'],
      [D.metry(s.stoupani), 'stoupání (vyhlazené)'], [s.fotek, 'fotografií'], [D.naklText(s.naklady), 'náklady'],
    ].map(([a, b]) => `<div><b>${a}</b><span>${b}</span></div>`).join('');
    $('sTab').innerHTML = `<thead><tr><th>Rok</th><th class="c">Výletů</th><th class="c">Dní</th><th class="c">Délka</th><th class="c">Stoupání</th><th class="c">Fotek</th><th class="c">Náklady</th><th>Nejdelší</th></tr></thead><tbody>` +
      roky.map(r => `<tr><td>${r.rok}</td><td class="c">${r.vyletu}</td><td class="c">${r.dni}</td><td class="c">${D.km(r.delka)}</td><td class="c">${D.metry(r.stoupani)}</td><td class="c">${r.fotek}</td><td class="c">${D.naklText(r.naklady)}</td><td>${r.nejdelsi ? `<button type="button" class="odkaz" data-id="${esc(r.nejdelsi.id)}">${esc(r.nejdelsi.nazev)}</button>` : '–'}</td></tr>`).join('') +
      (roky.length > 1 ? `<tr><th>Celkem</th><th class="c">${s.vyletu}</th><th class="c">${s.dni}</th><th class="c">${D.km(s.delka)}</th><th class="c">${D.metry(s.stoupani)}</th><th class="c">${s.fotek}</th><th class="c">${D.naklText(s.naklady)}</th><th></th></tr>` : '') + '</tbody>';
    if (!roky.length) $('sTab').innerHTML = '<tbody><tr><td class="ztlum">Žádné výlety s datem.</td></tr></tbody>';
    const ob = {};
    for (const v of sez) { const k = (v.oblast || '').trim() || '(bez oblasti)'; const o = ob[k] || (ob[k] = { n: 0, d: 0, s: 0 }); o.n++; o.d += (v.statistika && v.statistika.delka) || 0; o.s += (v.statistika && v.statistika.stoupani) || 0; }
    $('sOblasti').innerHTML = '<thead><tr><th>Oblast</th><th class="c">Výletů</th><th class="c">Délka</th><th class="c">Stoupání</th></tr></thead><tbody>' +
      Object.entries(ob).sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0], 'cs')).map(([k, o]) => `<tr><td>${k === '(bez oblasti)' ? `<span class="ztlum">${k}</span>` : `<button type="button" class="odkaz" data-oblast="${esc(k)}">${esc(k)}</button>`}</td><td class="c">${o.n}</td><td class="c">${D.km(o.d)}</td><td class="c">${D.metry(o.s)}</td></tr>`).join('') + '</tbody>';
    const dp = {};
    for (const v of sez) for (const d of v.doprava || []) dp[d] = (dp[d] || 0) + 1;
    $('sDoprava').innerHTML = Object.keys(dp).length ? '<tbody>' + Object.entries(dp).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<tr><td>${esc(k)}</td><td class="c">${n}×</td></tr>`).join('') + '</tbody>' : '<tbody><tr><td class="ztlum">Doprava nevyplněna.</td></tr></tbody>';
    const top = (klic, fmt) => {
      const t = sez.filter(v => v.statistika && v.statistika[klic] > 0).sort((a, b) => b.statistika[klic] - a.statistika[klic]).slice(0, 5);
      return t.length ? '<tbody>' + t.map(v => `<tr><td><button type="button" class="odkaz" data-id="${esc(v.id)}">${esc(v.nazev)}</button> <span class="male-pismo">${esc(D.rozsahCesky(v))}</span></td><td class="c">${fmt(v.statistika[klic])}</td></tr>`).join('') + '</tbody>' : '<tbody><tr><td class="ztlum">Žádné trasy.</td></tr></tbody>';
    };
    $('sNejdelsi').innerHTML = top('delka', D.km);
    $('sNejvyssi').innerHTML = top('stoupani', D.metry);
    S.grafRoky = roky.slice().reverse();
    kresliRekordy(sez);
    const rokyVse = [...new Set(sez.map(v => String(v.datumOd || '').slice(0, 4)).filter(x => /^\d{4}$/.test(x)))].sort().reverse();
    const sel = $('sMesicRok'), puv = sel.value;
    sel.innerHTML = '<option value="">všechny roky</option>' + rokyVse.map(x => `<option>${x}</option>`).join('');
    sel.value = rokyVse.includes(puv) ? puv : '';
    S.grafMesice = D.statistikyPoMesicich(sez, sel.value || null);
    kresliPorovnaniVyber();
    requestAnimationFrame(kresliGraf);
  }
  function kresliGraf() {
    const r = S.grafRoky || [];
    sloupcovyGraf($('sGraf'), r.map(x => String(x.rok)), r.map(x => x.delka / 1000), r.map(x => x.vyletu));
    const m = S.grafMesice || [];
    sloupcovyGraf($('sMesice'), m.map(x => D.MESICE_ZKR[x.mesic]), m.map(x => x.delka / 1000), m.map(x => x.vyletu));
    kresliPorovnaniProfil();
  }
  /** Sloupce (km, levá osa) + čára s body (počet, pravá osa). */
  function sloupcovyGraf(c, popisky, km, pocty) {
    if (!c || !c.isConnected || c.offsetParent === null) return;
    const dpr = window.devicePixelRatio || 1, w = c.clientWidth, h = c.clientHeight;
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    g.font = '11px ' + (cssVar('--font') || 'sans-serif');
    const txt = cssVar('--text-muted');
    if (!popisky.length || !pocty.some(n => n > 0)) { g.fillStyle = txt; g.textAlign = 'center'; g.fillText('Žádná data', w / 2, h / 2); return; }
    const ml = 44, mr = 30, mt = 12, mb = 24;
    const maxKm = Math.max(1, ...km), maxN = Math.max(1, ...pocty);
    const krok = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000].find(k => maxKm / k <= 5) || 10000;
    const top = Math.ceil(maxKm / krok) * krok;
    const Y = x => mt + (1 - x / top) * (h - mt - mb);
    g.strokeStyle = cssVar('--border'); g.fillStyle = txt; g.textAlign = 'right'; g.textBaseline = 'middle';
    for (let k = 0; k <= top + 1e-9; k += krok) { const y = Math.round(Y(k)) + 0.5; g.beginPath(); g.moveTo(ml, y); g.lineTo(w - mr, y); g.stroke(); g.fillText(D.cislo(k), ml - 5, y); }
    const sl = (w - ml - mr) / popisky.length, bw = Math.min(46, sl * 0.6);
    const Yn = n => mt + (1 - n / maxN) * (h - mt - mb);
    g.textAlign = 'left';
    for (let n = 0; n <= maxN; n += Math.max(1, Math.ceil(maxN / 4))) g.fillText(String(n), w - mr + 5, Yn(n));
    popisky.forEach((p, i) => {
      const cx = ml + sl * (i + 0.5);
      g.fillStyle = cssVar('--accent');
      if (km[i] > 0) g.fillRect(cx - bw / 2, Y(km[i]), bw, Y(0) - Y(km[i]));
      g.fillStyle = txt; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      if (sl >= 22 || i % 2 === 0) g.fillText(p, cx, h - 6);
    });
    g.strokeStyle = cssVar('--misto'); g.lineWidth = 2; g.beginPath();
    pocty.forEach((n, i) => { const cx = ml + sl * (i + 0.5); i ? g.lineTo(cx, Yn(n)) : g.moveTo(cx, Yn(n)); });
    g.stroke();
    g.fillStyle = cssVar('--misto');
    pocty.forEach((n, i) => { g.beginPath(); g.arc(ml + sl * (i + 0.5), Yn(n), 3.5, 0, Math.PI * 2); g.fill(); });
    g.lineWidth = 1;
  }

  /* ---------- rekordy a porovnání ---------- */
  function kresliRekordy(sez) {
    const r = D.rekordy(sez);
    $('sRekordy').innerHTML = r.length ? r.map(x => `<div><span>${esc(x.nazev)}</span><b>${x.text}</b><button type="button" class="odkaz" data-id="${esc(x.vylet.id)}">${esc(x.vylet.nazev)}</button> <span>${esc(D.rozsahCesky(x.vylet))}</span></div>`).join('')
      : '<p class="ztlum">Rekordy se objeví, až budou výlety mít trasy.</p>';
  }
  const porovnani = { ids: lsCti('porovnani', []), data: [] };
  function kresliPorovnaniVyber() {
    const kandidati = D.seradVylety(S.vylety.filter(v => v.statistika && v.statistika.pocetBodu));
    const el = $('porVyber');
    if (kandidati.length < 2) { el.innerHTML = '<p class="ztlum">Porovnání potřebuje aspoň dva výlety s trasou.</p>'; $('porTab').innerHTML = ''; $('porProfil').hidden = true; $('porLegenda').innerHTML = ''; return; }
    porovnani.ids = porovnani.ids.filter(id => kandidati.some(v => v.id === id));
    if (porovnani.ids.length < 2) porovnani.ids = kandidati.slice(0, 2).map(v => v.id);
    el.innerHTML = [0, 1, 2].map(i => `<label style="margin: 0"><span class="popisek" style="margin-top: 0">Výlet ${i + 1}</span><select data-por="${i}"><option value="">—</option>${kandidati.map(v => `<option value="${esc(v.id)}"${porovnani.ids[i] === v.id ? ' selected' : ''}>${esc(v.nazev)} (${esc(v.datumOd || '?')})</option>`).join('')}</select></label>`).join('');
    nactiPorovnani();
  }
  async function nactiPorovnani() {
    const vy = porovnani.ids.map(id => S.vylety.find(v => v.id === id)).filter(Boolean);
    lsPis('porovnani', porovnani.ids);
    porovnani.data = [];
    for (const v of vy) {
      let profil = [];
      try { const tr = await U.trasy(v.id); profil = D.vyskovyProfil(vsechnySegmenty(tr), volbyVysek()); } catch (e) {}
      porovnani.data.push({ v, profil });
    }
    const st = v => v.statistika || {};
    const radky = [
      ['Datum', v => esc(D.rozsahCesky(v))], ['Délka', v => D.km(st(v).delka)],
      ['Stoupání', v => st(v).maVysky ? D.metry(st(v).stoupani) : '–'], ['Nejvyšší bod', v => st(v).maVysky ? D.metry(st(v).maxEle) : '–'],
      ['Čas celkem', v => st(v).maCasy ? D.doba(st(v).casCelkem) : '–'], ['Čas v pohybu', v => st(v).maCasy ? D.doba(st(v).casPohyb) : '–'],
      ['Průměr v pohybu', v => st(v).casPohyb > 0 ? D.cislo(st(v).delka / (st(v).casPohyb / 3600), 1) + '\u00a0km/h' : '–'],
      ['Tempo', v => st(v).casPohyb > 0 ? D.tempo(st(v).delka / (st(v).casPohyb / 1000)) : '–'],
      ['Stoupání na km', v => st(v).maVysky && st(v).delka ? D.cislo(st(v).stoupani / (st(v).delka / 1000), 0) + '\u00a0m/km' : '–'],
      ['Fotek', v => S.pocetFotek[v.id] || 0], ['Náklady', v => D.naklText(D.soucetNakladu(v.naklady))],
    ];
    $('porTab').innerHTML = `<thead><tr><th></th>${vy.map((v, i) => `<th class="c" style="color: var(--rok-${i})">● ${esc(v.nazev)}</th>`).join('')}</tr></thead><tbody>` +
      radky.map(([n, f]) => `<tr><th>${n}</th>${vy.map(v => `<td class="c">${f(v)}</td>`).join('')}</tr>`).join('') + '</tbody>';
    const maProfil = porovnani.data.some(d => d.profil.length > 1);
    $('porProfil').hidden = !maProfil;
    $('porLegenda').innerHTML = maProfil ? porovnani.data.map((d, i) => `<span><i style="background: var(--rok-${i})"></i>${esc(d.v.nazev)}</span>`).join('') + '<span>výškové profily přes sebe (vodorovně km od startu)</span>' : '';
    requestAnimationFrame(kresliPorovnaniProfil);
  }
  function kresliPorovnaniProfil() {
    const c = $('porProfil');
    if (!c || c.hidden || c.offsetParent === null) return;
    const data = porovnani.data.filter(d => d.profil.length > 1);
    const dpr = window.devicePixelRatio || 1, w = c.clientWidth, h = c.clientHeight;
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    if (!data.length) return;
    const ml = 46, mr = 10, mt = 10, mb = 22;
    const dMax = Math.max(...data.map(d => d.profil[d.profil.length - 1].d)) || 1;
    let eMin = Math.min(...data.map(d => Math.min(...d.profil.map(b => b.eleHladka)))), eMax = Math.max(...data.map(d => Math.max(...d.profil.map(b => b.eleHladka))));
    const krokE = [10, 20, 25, 50, 100, 200, 250, 500, 1000].find(k => (eMax - eMin) / k <= 5) || 1000;
    eMin = Math.floor(eMin / krokE) * krokE; eMax = Math.max(eMin + krokE, Math.ceil(eMax / krokE) * krokE);
    const X = d => ml + d / dMax * (w - ml - mr), Y = e => mt + (eMax - e) / (eMax - eMin) * (h - mt - mb);
    g.font = '11px ' + (cssVar('--font') || 'sans-serif'); g.fillStyle = cssVar('--text-muted'); g.strokeStyle = cssVar('--border');
    g.textAlign = 'right'; g.textBaseline = 'middle';
    for (let e = eMin; e <= eMax + 1e-9; e += krokE) { const y = Math.round(Y(e)) + 0.5; g.beginPath(); g.moveTo(ml, y); g.lineTo(w - mr, y); g.stroke(); g.fillText(D.cislo(e), ml - 5, y); }
    const krokD = [500, 1000, 2000, 5000, 10000, 20000, 50000].find(k => dMax / k <= 8) || 100000;
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    for (let d = 0; d <= dMax; d += krokD) g.fillText(D.cislo(d / 1000, krokD < 1000 ? 1 : 0), X(d), h - 6);
    porovnani.data.forEach((d, i) => {
      if (d.profil.length < 2) return;
      g.strokeStyle = cssVar('--rok-' + i); g.lineWidth = 2; g.beginPath();
      d.profil.forEach((b, k) => (k ? g.lineTo(X(b.d), Y(b.eleHladka)) : g.moveTo(X(b.d), Y(b.eleHladka))));
      g.stroke();
    });
    g.lineWidth = 1;
  }

  /* ---------- síť: počasí (Open-Meteo) a oblast (Nominatim) ---------- */
  async function stahniJson(adresa, limitMs) {
    const c = new AbortController(), t = setTimeout(() => c.abort(), limitMs || 12000);
    try {
      const r = await fetch(adresa, { signal: c.signal, headers: { Accept: 'application/json' } });
      if (!r.ok) throw new Error('server vrátil HTTP ' + r.status);
      return await r.json();
    } catch (e) {
      throw new Error(e.name === 'AbortError' ? 'vypršel čas spojení' : /fetch/i.test(e.message) ? 'bez připojení nebo zablokováno' : e.message);
    } finally { clearTimeout(t); }
  }
  /* Nominatim usage policy: nejvýš 1 dotaz za sekundu, výsledky cachovat, uvádět zdroj. */
  let nominatimRetez = Promise.resolve(), nominatimPosledni = 0;
  function geokoduj(lat, lon) {
    const klic = lat.toFixed(3) + ',' + lon.toFixed(3);
    const cache = lsCti('geokod', {});
    if (Object.prototype.hasOwnProperty.call(cache, klic)) return Promise.resolve(cache[klic]);
    const prace = nominatimRetez.then(async () => {
      const cekat = nominatimPosledni + 1100 - Date.now();
      if (cekat > 0) await pauza(cekat);
      nominatimPosledni = Date.now();
      const o = D.oblastZNominatim(await stahniJson(D.urlNominatim(lat, lon)));
      const c = lsCti('geokod', {}), k = Object.keys(c);
      if (k.length > 300) delete c[k[0]];
      c[klic] = o; lsPis('geokod', c);
      return o;
    });
    nominatimRetez = prace.catch(() => {});
    return prace;
  }
  function stredVyletu(v, fotky) {
    if (v.nahled && v.nahled[0] && v.nahled[0].length) { const l = v.nahled[0]; return l[Math.floor(l.length / 2)]; }
    if (v.body && v.body.length) return [v.body[0].lat, v.body[0].lon];
    const f = (fotky || []).find(x => x.lat != null);
    if (f) return [f.lat, f.lon];
    if (v.bbox) return [(v.bbox[0] + v.bbox[2]) / 2, (v.bbox[1] + v.bbox[3]) / 2];
    return null;
  }
  async function zjistiOblast(v, tiche) {
    const st = stredVyletu(v, S.akt && S.akt.vylet === v ? S.akt.fotky : null);
    if (!st) { if (!tiche) chyba('Výlet zatím nemá polohu – importujte trasu, přidejte místo nebo fotku s GPS.'); return; }
    try {
      const o = await geokoduj(st[0], st[1]);
      if (!o) { if (!tiche) chyba('Pro tuto polohu nebyl nalezen název oblasti.'); return; }
      if (tiche && v.oblast) return;
      v.oblast = o;
      if (S.akt && S.akt.vylet === v) { $('dOblast').value = o; }
      await U.ulozVylet(v); obnovVolbyFiltru();
      if (!tiche) info(`Oblast: ${o} (OpenStreetMap Nominatim)`);
    } catch (e) { if (!tiche) chyba('Oblast se nepodařilo zjistit: ' + e.message); }
  }
  async function nactiPocasi(v, tiche) {
    const st = stredVyletu(v, S.akt && S.akt.vylet === v ? S.akt.fotky : null);
    if (!st) { if (!tiche) chyba('Výlet zatím nemá polohu – počasí nelze určit.'); return; }
    const u = D.urlPocasi(st[0], st[1], v.datumOd, v.datumDo, dnes());
    if (!u) { if (!tiche) chyba(v.datumOd ? 'Počasí je k dispozici jen pro proběhlé výlety (archiv) a posledních 90 dní.' : 'Nejdřív vyplňte datum výletu.'); return; }
    const el = S.akt && S.akt.vylet === v ? $('dPocasi') : null;
    if (el) el.insertAdjacentHTML('beforeend', '<span class="male-pismo" data-nacitam>načítám…</span>');
    try {
      const dny = D.zpracujPocasi(await stahniJson(u.url));
      if (!dny.length) throw new Error('pro tento den zatím nejsou data');
      v.pocasi = { dny, zdroj: u.zdroj, nacteno: Date.now(), lat: st[0], lon: st[1] };
      await U.ulozVylet(v);
    } catch (e) { if (!tiche) chyba('Počasí se nepodařilo načíst: ' + e.message); }
    if (S.akt && S.akt.vylet === v) kresliPocasi();
  }
  function kresliPocasi() {
    const v = S.akt.vylet, p = v.pocasi;
    $('dPocasi').innerHTML = (p && p.dny && p.dny.length
      ? p.dny.map(d => `<span class="den-p" title="${esc(d.den)}">${p.dny.length > 1 ? esc(D.datumCesky(d.den, false)) + ': ' : ''}${d.ikona} ${esc(d.text)}, ${D.cislo(d.tmin, 0)}–${D.cislo(d.tmax, 0)}\u00a0°C${d.srazky ? ', ' + D.cislo(d.srazky, 1) + '\u00a0mm' : ''}${d.vitr !== null ? ', vítr ' + D.cislo(d.vitr, 0) + '\u00a0km/h' : ''}</span>`).join('') +
        `<span class="male-pismo"><a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo.com</a> (${esc(p.zdroj)}, CC BY 4.0) pro ${D.cislo(p.lat, 2)}, ${D.cislo(p.lon, 2)}</span>`
      : '<span class="male-pismo">nenačteno</span>') + ` <button class="tl male" type="button" data-pocasi>${p ? 'Obnovit' : 'Načíst počasí'}</button>`;
  }

  /* ---------- založení výletu ze souborů ---------- */
  const jeTrasa = f => /\.(gpx|kml|kmz)$/i.test(f.name);
  const jeObrazek = f => /^image\//.test(f.type) || /\.(jpe?g|png|webp|gif|avif|heic|heif)$/i.test(f.name);
  async function zalozZeSouboru(soubory) {
    if (!S.dbOk) { chyba('Úložiště není k dispozici.'); return; }
    const trasove = soubory.filter(jeTrasa), obr = soubory.filter(jeObrazek);
    if (!trasove.length && !obr.length) { chyba('Přetáhněte soubory GPX, KML, KMZ nebo fotky.'); return; }
    const importy = [];
    for (const f of trasove) {
      try { const { text, jmeno } = await nactiTextZeSouboru(f); importy.push(D.nactiTrasu(text, jmeno)); } catch (e) { chyba(`${f.name}: ${e.message}`); }
    }
    const meta = [];
    for (const f of obr) {
      try { const e = D.ctiExif(await f.slice(0, 256 * 1024).arrayBuffer()); meta.push({ datum: e && e.datum, lat: e && e.gps ? e.gps.lat : null, lon: e && e.gps ? e.gps.lon : null }); } catch (e) {}
    }
    if (!importy.length && !obr.length) return;
    const n = D.navrhVyletu(importy, meta);
    const v = D.novyVylet(n.datumOd || dnes());
    v.nazev = n.nazev; v.datumDo = n.datumDo;
    try { await U.ulozVylet(v); } catch (e) { chyba(e.message); return; }
    S.vylety.push(v);
    obnovVolbyFiltru();
    await otevriVylet(v.id);
    if (trasove.length) await importujTrasy(trasove);
    if (obr.length) await pridejFotky(obr);
    info('Výlet založen – zjišťuji oblast a počasí…');
    await zjistiOblast(v, true);
    if (v.datumOd && v.datumOd <= dnes()) await nactiPocasi(v, true);
    if (S.akt && S.akt.vylet === v) { kresliPocasi(); $('dOblast').value = v.oblast || ''; }
    S.posledniAuto = { id: v.id, oblast: v.oblast, pocasi: !!v.pocasi };
  }

  /* =====================================================================
     ÚLOŽIŠTĚ, ZÁLOHA, OBNOVA
     ===================================================================== */
  async function obnovStavUloziste() {
    const s = await U.stav();
    const el = $('ulStav'), m = $('ulMira');
    let objem = 0, pocet = 0, orig = 0;
    try { const f = await U.vsechnyFotky(); pocet = f.length; for (const x of f) { objem += (x.obrazek ? x.obrazek.size : 0) + (x.nahled ? x.nahled.size : 0); orig += x.original ? x.original.size : 0; } fotkyVse = f; } catch (e) {}
    const radky = [`${S.vylety.length} výletů, ${pocet} fotek (${D.velikostText(objem)}${orig ? ' + originály ' + D.velikostText(orig) : ''})`];
    if (s.usage != null && s.quota) {
      const p = s.usage / s.quota;
      radky.push(`Využito ${D.velikostText(s.usage)} z ${D.velikostText(s.quota)} (${D.cislo(p * 100, 1)} %) – volno ${D.velikostText(s.quota - s.usage)}.`);
      m.hidden = false; m.firstElementChild.style.width = Math.min(100, Math.max(0.5, p * 100)) + '%'; m.classList.toggle('plno', p > 0.85);
    } else { radky.push('Prohlížeč nesděluje velikost úložiště (navigator.storage.estimate není k dispozici).'); m.hidden = true; }
    el.innerHTML = radky.map(esc).join('<br>');
    $('ulTrvale').textContent = s.persisted === true ? '✓ Úložiště je trvalé – prohlížeč data sám nesmaže.' : s.persisted === false ? 'Úložiště není trvalé (prohlížeč může data při nedostatku místa smazat).' : 'Stav trvalosti nelze zjistit.';
    $('btnTrvale').disabled = s.persisted === true;
  }

  const priponaTypu = t => ({ 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/avif': 'avif', 'image/heic': 'heic' }[t] || 'bin');
  async function vytvorZalohu() {
    const post = $('postupZaloha');
    try {
      post.textContent = 'Připravuji zálohu…';
      const vylety = await U.vsechnyVylety(), trasy = await U.vsechnyTrasy(), fotky = await U.vsechnyFotky();
      const meta = [], soubory = [];
      for (const f of fotky) {
        const m = Object.assign({}, f); delete m.obrazek; delete m.nahled; delete m.original;
        m.soubory = {};
        for (const k of ['obrazek', 'nahled', 'original']) {
          if (!f[k]) continue;
          const cesta = `fotky/${f.id}_${k}.${priponaTypu(f[k].type)}`;
          m.soubory[k] = { cesta, typ: f[k].type || '' };
          soubory.push({ cesta, blob: f[k] });
        }
        meta.push(m);
      }
      const json = new TextEncoder().encode(JSON.stringify({ aplikace: 'vyletni_denik', verze: D.VERZE_ZALOHY, exportovano: new Date().toISOString(),
        nastaveni: { okno: nast.okno, prah: nast.prah }, vylety, trasy, fotky: meta }));
      const z = new D.ZipZapisovac(new Date()), casti = [];
      casti.push(z.pridej('vyletni_denik.json', json.length, D.crc32(json)), json);
      let i = 0;
      for (const s of soubory) {
        if (++i % 5 === 0) { post.textContent = `Balím fotky ${i} / ${soubory.length}…`; await pauza(0); }
        const u8 = new Uint8Array(await s.blob.arrayBuffer());
        casti.push(z.pridej(s.cesta, u8.length, D.crc32(u8)), s.blob);
      }
      casti.push(z.konec());
      const blob = new Blob(casti, { type: 'application/zip' });
      stahni(blob, `vyletni-denik-zaloha-${dnes()}.zip`);
      post.textContent = `Záloha vytvořena: ${vylety.length} výletů, ${fotky.length} fotek, ${D.velikostText(blob.size)}.`;
      lsPis('posledniZaloha', Date.now());
    } catch (e) { post.textContent = ''; chyba('Záloha selhala: ' + e.message); }
  }

  /** Otevře ZIP ze souboru bez načtení celého do paměti. */
  async function otevriZip(file) {
    const odkud = Math.max(0, file.size - 65557);
    const k = D.zipKonec(new Uint8Array(await file.slice(odkud).arrayBuffer()), odkud);
    if (k.offset + k.velikost > file.size) throw new Error('Poškozený ZIP (centrální adresář mimo soubor)');
    const polozky = D.zipAdresar(new Uint8Array(await file.slice(k.offset, k.offset + k.velikost).arrayBuffer()), k.pocet);
    async function rozsah(p) {
      const z = D.zipZacatekDat(new Uint8Array(await file.slice(p.offsetHlavicky, p.offsetHlavicky + 30).arrayBuffer()), p);
      return [z, z + p.komprimovano];
    }
    async function data(p) {
      const [a, b] = await rozsah(p);
      let u8;
      if (p.metoda === 0) u8 = new Uint8Array(await file.slice(a, b).arrayBuffer());
      else if (p.metoda === 8 && typeof DecompressionStream !== 'undefined') {
        const st = file.slice(a, b).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        u8 = new Uint8Array(await new Response(st).arrayBuffer());
      } else throw new Error(`Položku ${p.jmeno} nelze rozbalit (metoda ${p.metoda})`);
      if (D.crc32(u8) !== p.crc) throw new Error('Poškozená data v ZIP (CRC): ' + p.jmeno);
      return u8;
    }
    async function blob(p, typ) {
      if (p.metoda === 0) {
        const [a, b] = await rozsah(p);
        const u8 = new Uint8Array(await file.slice(a, b).arrayBuffer());
        if (D.crc32(u8) !== p.crc) throw new Error('Poškozená data v ZIP (CRC): ' + p.jmeno);
        return new Blob([u8], { type: typ || '' });
      }
      return new Blob([await data(p)], { type: typ || '' });
    }
    return { polozky, data, blob };
  }
  async function obnovZeZalohy(file) {
    const post = $('postupZaloha');
    const rezim = (document.querySelector('input[name="rezimObnovy"]:checked') || {}).value || 'sloucit';
    try {
      post.textContent = 'Čtu zálohu…';
      const z = await otevriZip(file);
      const pj = z.polozky.find(p => p.jmeno === 'vyletni_denik.json');
      if (!pj) throw new Error('V souboru chybí vyletni_denik.json – nejde o zálohu deníku');
      const j = D.overZalohu(JSON.parse(new TextDecoder().decode(await z.data(pj))));
      const misto = await U.kontrolaMista(file.size);
      if (!misto.vejde && !(await potvrd(`Záloha má ${D.velikostText(file.size)}, volné místo je ${D.velikostText(misto.volno)}. Obnova nejspíš selže. Pokračovat?`, { ok: 'Pokračovat', zrus: 'Zrušit' }))) { post.textContent = ''; return; }
      const zprava = rezim === 'nahradit'
        ? `Nahradit VŠECHNA současná data (${S.vylety.length} výletů) obsahem zálohy (${j.vylety.length} výletů, ${j.fotky.length} fotek)?`
        : `Sloučit zálohu (${j.vylety.length} výletů, ${j.fotky.length} fotek) se současnými daty? Výlety se stejným identifikátorem se přepíší verzí ze zálohy.`;
      if (!(await potvrd(zprava, { ok: rezim === 'nahradit' ? 'Nahradit' : 'Sloučit', zrus: 'Zrušit' }))) { post.textContent = ''; return; }
      if (S.akt) await zavriDetail();
      if (rezim === 'nahradit') await U.smazVse();
      for (const v of j.vylety) await U.ulozVylet(v);
      for (const t of j.trasy) await U.ulozTrasy(t.vyletId, t.trasy);
      const mapa = new Map(z.polozky.map(p => [p.jmeno, p]));
      let i = 0, chybi = 0;
      for (const m of j.fotky) {
        if (++i % 5 === 0) { post.textContent = `Obnovuji fotky ${i} / ${j.fotky.length}…`; await pauza(0); }
        const f = Object.assign({}, m); delete f.soubory;
        for (const k of ['obrazek', 'nahled', 'original']) {
          const s = m.soubory && m.soubory[k];
          f[k] = null;
          if (!s) continue;
          const p = mapa.get(s.cesta);
          if (!p) { chybi++; continue; }
          f[k] = await z.blob(p, s.typ);
        }
        if (!f.obrazek && !f.nahled) continue;
        if (!f.obrazek) f.obrazek = f.nahled;
        if (!f.nahled) f.nahled = f.obrazek;
        await U.ulozFotku(f);
      }
      if (j.nastaveni && j.nastaveni.okno != null && rezim === 'nahradit') { nast.okno = j.nastaveni.okno; nast.prah = j.nastaveni.prah; ulozNast(); $('optOkno').value = nast.okno; $('optPrah').value = nast.prah; }
      fotkyVse = null;
      await nactiVse();
      post.textContent = `Obnoveno ${j.vylety.length} výletů a ${j.fotky.length} fotek${chybi ? ` (${chybi} souborů v archivu chybělo)` : ''}.`;
      obnovStavUloziste();
    } catch (e) { post.textContent = ''; chyba('Obnova selhala: ' + e.message); }
  }

  /* =====================================================================
     TISK A EXPORT HTML
     ===================================================================== */
  const blobNaDataUrl = b => new Promise((ok, err) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => err(r.error); r.readAsDataURL(b); });
  function ztenciProfil(p, max) {
    if (p.length <= max) return p;
    const k = p.length / max, v = [];
    for (let i = 0; i < max; i++) v.push(p[Math.floor(i * k)]);
    v.push(p[p.length - 1]);
    return v;
  }
  async function pripravDokument(vylety, foto, proHtml, postEl) {
    const polozky = [];
    let i = 0;
    for (const v of vylety) {
      postEl.textContent = `Připravuji ${++i} / ${vylety.length}: ${v.nazev}`;
      const trasy = await U.trasy(v.id);
      const seg = vsechnySegmenty(trasy);
      const profil = v.statistika && v.statistika.maVysky ? ztenciProfil(D.vyskovyProfil(seg, volbyVysek()), 600) : [];
      const fotky = [];
      if (foto !== 'zadne') {
        for (const f of await U.fotkyVyletu(v.id)) {
          const b = foto === 'plne' ? (f.obrazek || f.nahled) : (f.nahled || f.obrazek);
          const src = proHtml ? await blobNaDataUrl(b) : url('tisk', b);
          const bi = (v.body || []).findIndex(x => x.id === f.bodId);
          fotky.push({ src, popis: f.popis, datum: f.datum, bodCislo: bi >= 0 ? bi + 1 : null, lat: f.lat, lon: f.lon });
        }
      }
      polozky.push({ vylet: v, trasy, profil, fotky });
    }
    const titulek = vylety.length === 1 ? vylety[0].nazev || 'Výlet' : 'Výletní deník';
    return T.dokument(polozky, { titulek, samostatny: proHtml, pocetFotek: S.pocetFotek, vytvoreno: D.datumCesky(dnes()),
      metodaVysek: `Délka: haversine. Stoupání vyhlazené klouzavým průměrem (okno ${D.cislo(nast.okno)} m) s hysterezí ${D.cislo(nast.prah, 1)} m.` });
  }
  function vyletyProExport() {
    const r = (document.querySelector('input[name="rozsahTisku"]:checked') || {}).value;
    return D.seradVylety(r === 'vse' ? S.vylety : D.filtrujVylety(S.vylety, S.filtr), 'vzestupne');
  }
  async function tiskni(vylety, foto) {
    if (!vylety.length) { chyba('Žádné výlety k tisku.'); return; }
    if (S.akt && casovacUlozeni) { clearTimeout(casovacUlozeni); casovacUlozeni = null; await ulozAkt(); }
    const post = S.zalozka === 'zaloha' ? $('postupTisk') : $('ulozeno');
    uvolni('tisk');
    try {
      const html = await pripravDokument(vylety, foto, false, post);
      $('tisk-styl').textContent = T.STYL;
      $('tisk').innerHTML = html;
      await Promise.all([...$('tisk').querySelectorAll('img')].map(i => i.decode ? i.decode().catch(() => {}) : null));
      post.textContent = '';
      window.print();
    } catch (e) { post.textContent = ''; chyba('Tisk selhal: ' + e.message); }
  }
  function poTisku() { $('tisk').innerHTML = ''; uvolni('tisk'); }
  async function exportHtml(vylety, foto) {
    if (!vylety.length) { chyba('Žádné výlety k exportu.'); return; }
    if (S.akt && casovacUlozeni) { clearTimeout(casovacUlozeni); casovacUlozeni = null; await ulozAkt(); }
    const post = S.zalozka === 'zaloha' ? $('postupTisk') : $('ulozeno');
    try {
      const html = await pripravDokument(vylety, foto, true, post);
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const jm = vylety.length === 1 ? (D.normal(vylety[0].nazev).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'vylet') : 'vyletni-denik';
      stahni(blob, `${jm}-${dnes()}.html`);
      post.textContent = `HTML uloženo (${D.velikostText(blob.size)}).`;
    } catch (e) { post.textContent = ''; chyba('Export selhal: ' + e.message); }
  }

  /* =====================================================================
     UKÁZKOVÁ DATA
     ===================================================================== */
  function nahoda(sem) { let s = sem >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function syntetickaTrasa(body, start, rychlostKmH, pauzy, sem) {
    const rnd = nahoda(sem), seg = [];
    let t = start;
    for (let i = 0; i < body.length - 1; i++) {
      const [a, b] = [body[i], body[i + 1]];
      const d = D.vzdalenost(a[0], a[1], b[0], b[1]);
      const n = Math.max(4, Math.round(d / 25));
      for (let k = 0; k < n; k++) {
        const u = k / n;
        const ohyb = Math.sin(u * Math.PI) * 0.0012 * (i % 2 ? 1 : -1);
        const lat = a[0] + u * (b[0] - a[0]) + ohyb * Math.cos(i), lon = a[1] + u * (b[1] - a[1]) + ohyb;
        const ele = a[2] + (b[2] - a[2]) * (u - Math.sin(2 * Math.PI * u) / (2 * Math.PI) * 0.4) + (rnd() - 0.5) * 4;
        seg.push({ lat: +lat.toFixed(6), lon: +lon.toFixed(6), ele: Math.round(ele * 10) / 10, t: Math.round(t) });
        const sklon = (b[2] - a[2]) / d;
        const v = rychlostKmH / 3.6 * (sklon > 0.05 ? 0.65 : sklon < -0.05 ? 1.1 : 1);
        t += d / n / v * 1000;
      }
      if (pauzy[i + 1]) t += pauzy[i + 1];
    }
    const z = body[body.length - 1];
    seg.push({ lat: z[0], lon: z[1], ele: z[2], t: Math.round(t) });
    return seg;
  }
  async function kreslenaFotka(titulek, barvy, sem) {
    const c = document.createElement('canvas'); c.width = 1600; c.height = 1067;
    const g = c.getContext('2d'), rnd = nahoda(sem);
    const gr = g.createLinearGradient(0, 0, 0, c.height); gr.addColorStop(0, barvy[0]); gr.addColorStop(1, barvy[1]);
    g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
    for (let vrstva = 0; vrstva < 3; vrstva++) {
      g.fillStyle = barvy[2 + vrstva]; g.beginPath(); g.moveTo(0, c.height);
      let y = 520 + vrstva * 150;
      for (let x = 0; x <= c.width; x += 40) { y += (rnd() - 0.5) * 70; y = Math.max(250 + vrstva * 120, Math.min(c.height - 120, y)); g.lineTo(x, y); }
      g.lineTo(c.width, c.height); g.closePath(); g.fill();
    }
    g.fillStyle = 'rgba(255,255,255,.92)'; g.font = 'bold 76px sans-serif'; g.fillText(titulek, 60, 120);
    g.font = '34px sans-serif'; g.fillText('ukázková kresba – Výletní deník', 64, 172);
    return new Promise(r => c.toBlob(r, 'image/jpeg', 0.85));
  }
  async function vlozUkazku() {
    if (!S.dbOk) return;
    try {
      // 1) Sněžka z Pece – okruh přes Růžohorky a Obří důl
      const v1 = D.novyVylet('2026-07-14');
      Object.assign(v1, { nazev: 'Sněžka z Pece (ukázka)', oblast: 'Krkonoše', ucastnici: ['Jana', 'Petr'], doprava: ['autobus', 'pěšky'], hodnoceni: 5,
        popis: 'Okruh z Pece pod Sněžkou přes Růžohorky na vrchol Sněžky a zpět Obřím dolem.\n\nNahoře foukalo, výhled až na Ještěd.',
        poznamky: 'Autobus z Trutnova jezdí každou hodinu. Na Sněžce Česká poštovna – platit kartou.',
        naklady: [{ popis: 'autobus Trutnov – Pec (2×2)', castka: 340, mena: 'CZK' }, { popis: 'oběd na Sněžce', castka: 520, mena: 'CZK' }, { popis: 'pohledy a známky', castka: 4.5, mena: 'EUR' }] });
      const body1 = [[50.6917, 15.7333, 830], [50.7203, 15.7353, 1255], [50.7360, 15.7397, 1603], [50.7313, 15.7262, 1435], [50.7180, 15.7230, 1010], [50.6917, 15.7333, 830]];
      const seg1 = syntetickaTrasa(body1, Date.UTC(2026, 6, 14, 6, 30), 4.2, { 2: 40 * 60000 }, 7);
      v1.body = [
        { id: D.novyId('b'), nazev: 'Růžohorky', popis: 'chata, občerstvení', lat: 50.7203, lon: 15.7353, ele: 1255 },
        { id: D.novyId('b'), nazev: 'Sněžka', popis: 'nejvyšší hora Česka, 1 603 m', lat: 50.7360, lon: 15.7397, ele: 1603 },
        { id: D.novyId('b'), nazev: 'Obří důl', popis: 'ledovcový kar', lat: 50.7180, lon: 15.7230, ele: 1010 },
      ];
      const tr1 = [{ id: D.novyId('t'), nazev: 'Pec – Sněžka – Obří důl', zdroj: 'ukázka', typ: 'trk', segmenty: [seg1] }];
      const fotky = [];
      const f1 = await zpracujFotku(new File([await kreslenaFotka('Sněžka', ['#7fb2e5', '#d9ecf7', '#8a9bb0', '#5b6f84', '#3c4f3a'], 3)], 'snezka.jpg', { type: 'image/jpeg' }),
        { vyletId: v1.id, max: 2048, format: nast.format, original: false, podleCasu: false, trasy: tr1 });
      Object.assign(f1, { popis: 'Vrchol Sněžky', bodId: v1.body[1].id, lat: 50.736, lon: 15.7397, zdrojPolohy: 'rucne', datum: '2026-07-14T10:52:00', zdrojData: 'exif', poradi: 0 });
      const f2 = await zpracujFotku(new File([await kreslenaFotka('Obří důl', ['#f3c98b', '#fbe7c6', '#7c9a6d', '#4f6b45', '#2f4a2c'], 11)], 'obri_dul.jpg', { type: 'image/jpeg' }),
        { vyletId: v1.id, max: 2048, format: nast.format, original: false, podleCasu: false, trasy: tr1 });
      Object.assign(f2, { popis: 'Cestou dolů Obřím dolem', bodId: v1.body[2].id, lat: 50.718, lon: 15.723, zdrojPolohy: 'rucne', datum: '2026-07-14T12:40:00', zdrojData: 'exif', poradi: 1 });
      fotky.push(f1, f2);
      v1.titulniFoto = f1.id;
      prepocitej(v1, tr1, fotky);
      // 2) Pálava
      const v2 = D.novyVylet('2025-05-01');
      Object.assign(v2, { nazev: 'Pálava: Děvín (ukázka)', oblast: 'Jižní Morava', ucastnici: ['Jana'], doprava: ['auto', 'pěšky'], hodnoceni: 4,
        popis: 'Z Pavlova na Děvín a dolů do Klentnice. Kvetoucí stepní louky.', naklady: [{ popis: 'parkování Pavlov', castka: 100, mena: 'CZK' }, { popis: 'víno', castka: 380, mena: 'CZK' }] });
      const body2 = [[48.8746, 16.6705, 200], [48.8697, 16.6449, 549], [48.8452, 16.6447, 330]];
      const tr2 = [{ id: D.novyId('t'), nazev: 'Pavlov – Děvín – Klentnice', zdroj: 'ukázka', typ: 'trk', segmenty: [syntetickaTrasa(body2, Date.UTC(2025, 4, 1, 7, 0), 4, {}, 5)] }];
      v2.body = [{ id: D.novyId('b'), nazev: 'Děvín', popis: 'zřícenina hradu Dívčí hrady', lat: 48.8697, lon: 16.6449, ele: 549 }];
      prepocitej(v2, tr2, []);
      // 3) bez trasy – jen místo
      const v3 = D.novyVylet('2026-10-03');
      Object.assign(v3, { nazev: 'Karlštejn s babičkou (ukázka)', datumDo: '2026-10-04', oblast: 'Střední Čechy', ucastnici: ['Jana', 'babička'], doprava: ['vlak'],
        naklady: [{ popis: 'vstupné', castka: 660, mena: 'CZK' }, { popis: 'vlak', castka: 248, mena: 'CZK' }],
        body: [{ id: D.novyId('b'), nazev: 'Hrad Karlštejn', popis: '', lat: 49.9393, lon: 14.1882, ele: null }] });
      prepocitej(v3, [], []);
      for (const v of [v1, v2, v3]) await U.ulozVylet(v);
      await U.ulozTrasy(v1.id, tr1); await U.ulozTrasy(v2.id, tr2);
      await U.ulozFotky(fotky);
      fotkyVse = null;
      await nactiVse();
      info('Vloženy 3 ukázkové výlety.');
      prekresliZalozku();
    } catch (e) { chyba('Ukázku se nepodařilo vložit: ' + e.message); }
  }

  /* =====================================================================
     UDÁLOSTI
     ===================================================================== */
  let shozHloubka = 0;
  function skryjShozVse() { shozHloubka = 0; $('shozVse').hidden = true; }
  function nastavShozVse() {
    const maSoubory = e => e.dataTransfer && [...e.dataTransfer.types].includes('Files');
    document.addEventListener('dragenter', e => {
      if (!maSoubory(e)) return;
      e.preventDefault(); shozHloubka++;
      $('shozVseText').textContent = S.akt ? `přidá trasy a fotky do výletu „${S.akt.vylet.nazev}“` : 'a výlet se založí sám (datum, oblast, počasí)';
      $('shozVse').hidden = false;
    });
    document.addEventListener('dragover', e => { if (maSoubory(e)) e.preventDefault(); });
    document.addEventListener('dragleave', () => { if (--shozHloubka <= 0) skryjShozVse(); });
    document.addEventListener('drop', e => {
      if (!maSoubory(e)) return;
      e.preventDefault(); skryjShozVse();
      const f = [...e.dataTransfer.files];
      if (!f.length) return;
      if (S.akt) {
        const tr = f.filter(jeTrasa), ob = f.filter(jeObrazek);
        (async () => { if (tr.length) await importujTrasy(tr); if (ob.length) await pridejFotky(ob); if (!tr.length && !ob.length) chyba('Podporované jsou soubory GPX, KML, KMZ a obrázky.'); })();
      } else zalozZeSouboru(f);
    });
  }
  function nastavShoz(zona, fn) {
    const el = $(zona);
    let hloubka = 0;
    el.addEventListener('dragenter', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { e.preventDefault(); hloubka++; el.classList.add('nad'); } });
    el.addEventListener('dragover', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
    el.addEventListener('dragleave', () => { if (--hloubka <= 0) { hloubka = 0; el.classList.remove('nad'); } });
    el.addEventListener('drop', e => { e.preventDefault(); e.stopPropagation(); hloubka = 0; skryjShozVse(); el.classList.remove('nad'); if (e.dataTransfer.files.length) fn([...e.dataTransfer.files]); });
  }
  function navazUdalosti() {
    document.querySelectorAll('.zalozky button').forEach(b => b.addEventListener('click', () => prepniZalozku(b.dataset.z)));
    $('btnNovy').addEventListener('click', () => novyVylet());
    // filtry
    let casFiltru = null;
    const zmenaFiltru = () => {
      S.filtr = { text: $('fText').value, rok: $('fRok').value, oblast: $('fOblast').value, doprava: $('fDoprava').value, stitek: $('fStitek').value };
      lsPis('filtr', S.filtr);
      prekresliZalozku();
    };
    $('fText').addEventListener('input', () => { clearTimeout(casFiltru); casFiltru = setTimeout(zmenaFiltru, 200); });
    ['fRok', 'fOblast', 'fDoprava', 'fStitek'].forEach(id => $(id).addEventListener('change', zmenaFiltru));
    $('fZrus').addEventListener('click', () => { ['fText', 'fRok', 'fOblast', 'fDoprava', 'fStitek'].forEach(id => { $(id).value = ''; }); zmenaFiltru(); });
    $('pohled').addEventListener('change', () => { nast.pohled = $('pohled').value; ulozNast(); kresliSeznam(); });
    $('razeni').addEventListener('change', () => { nast.razeni = $('razeni').value; ulozNast(); kresliSeznam(); });
    // seznam a odkazy na výlety
    document.addEventListener('click', e => {
      const t = e.target.closest('[data-id]');
      if (t && (t.classList.contains('vylet-karta') || t.classList.contains('odkaz') || t.classList.contains('cip'))) { e.stopPropagation(); otevriVylet(t.dataset.id); return; }
      const o = e.target.closest('a[data-otevri]');
      if (o) { e.preventDefault(); otevriVylet(o.dataset.otevri); return; }
      const ob = e.target.closest('[data-oblast]');
      if (ob) { $('fOblast').value = ob.dataset.oblast; zmenaFiltru(); return; }
      const ak = e.target.closest('#seznam [data-akce]');
      if (ak) { if (ak.dataset.akce === 'novy') novyVylet(); else vlozUkazku(); }
    });
    // detail – formulář
    $('btnZpet').addEventListener('click', () => prepniZalozku(lsCti('zalozka', 'vylety')));
    document.querySelectorAll('#formular [data-pole]').forEach(i => i.addEventListener('input', () => {
      if (!S.akt) return;
      S.akt.vylet[i.dataset.pole] = i.value;
      if (i.dataset.pole === 'nazev') $('dNadpis').textContent = i.value || 'Bez názvu';
      planujUlozeni();
    }));
    $('dUcastnici').addEventListener('input', () => {
      if (!S.akt) return;
      S.akt.vylet.ucastnici = $('dUcastnici').value.split(',').map(s => s.trim()).filter(Boolean);
      obnovSoucetNakladu(); planujUlozeni();
    });
    $('dDoprava').addEventListener('change', () => {
      if (!S.akt) return;
      S.akt.vylet.doprava = [...$('dDoprava').querySelectorAll('input:checked')].map(c => c.value);
      planujUlozeni();
    });
    $('dHvezdy').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b || !S.akt) return;
      const h = +b.dataset.h;
      S.akt.vylet.hodnoceni = S.akt.vylet.hodnoceni === h ? 0 : h;
      kresliHvezdy(); planujUlozeni();
    });
    $('btnNaklad').addEventListener('click', () => {
      if (!S.akt) return;
      (S.akt.vylet.naklady = S.akt.vylet.naklady || []).push({ popis: '', castka: '', mena: 'CZK' });
      kresliNaklady();
      const r = $('dNaklady').lastElementChild; if (r) r.querySelector('input').focus();
    });
    const zmenaNakladu = e => {
      const r = e.target.closest('.naklady-radek'); if (!r || !S.akt || !e.target.dataset.k) return;
      const n = S.akt.vylet.naklady[+r.dataset.i]; if (!n) return;
      const k = e.target.dataset.k;
      if (k === 'castka') { const c = D.parseCislo(e.target.value); n.castka = c === null ? e.target.value : c; e.target.classList.toggle('chyba', e.target.value.trim() !== '' && c === null); }
      else n[k] = e.target.value;
      obnovSoucetNakladu(); planujUlozeni();
    };
    $('dNaklady').addEventListener('input', zmenaNakladu);
    $('dNaklady').addEventListener('change', zmenaNakladu);
    $('dNaklady').addEventListener('click', e => {
      const b = e.target.closest('[data-smaz]'); if (!b || !S.akt) return;
      S.akt.vylet.naklady.splice(+b.dataset.smaz, 1); kresliNaklady(); planujUlozeni();
    });
    $('btnSmazVylet').addEventListener('click', async () => {
      if (!S.akt) return;
      const v = S.akt.vylet;
      if (!(await potvrd(`Smazat výlet „${v.nazev}“ včetně trasy a ${S.akt.fotky.length} fotek? Nelze vrátit.`, { ok: 'Smazat', zrus: 'Ponechat' }))) return;
      try { await U.smazVylet(v.id); } catch (e) { chyba(e.message); return; }
      if (casovacUlozeni) { clearTimeout(casovacUlozeni); casovacUlozeni = null; }
      S.akt = null; uvolni('galerie');
      S.vylety = S.vylety.filter(x => x.id !== v.id); delete S.pocetFotek[v.id]; fotkyVse = null;
      obnovVolbyFiltru();
      info('Výlet smazán.');
      prepniZalozku('vylety');
    });
    $('btnTiskVylet').addEventListener('click', () => S.akt && tiskni([S.akt.vylet], 'plne'));
    $('btnHtmlVylet').addEventListener('click', () => S.akt && exportHtml([S.akt.vylet], 'plne'));
    // trasy
    $('btnImportTrasy').addEventListener('click', () => vyberSoubor($('souborTrasy')));
    $('souborTrasy').addEventListener('change', e => importujTrasy([...e.target.files]));
    nastavShoz('shozTrasa', fs => importujTrasy(fs.filter(f => /\.(gpx|kml|kmz)$/i.test(f.name))));
    $('btnPlanovac').addEventListener('click', prevzitZPlanovace);
    $('btnExportGpx').addEventListener('click', () => {
      if (!S.akt) return;
      const { vylet: v, trasy } = S.akt;
      if (!trasy.length && !(v.body || []).length) { chyba('Výlet nemá trasu ani místa.'); return; }
      const jm = D.normal(v.nazev).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'vylet';
      stahni(new Blob([D.exportGPX(v, trasy, v.body || [])], { type: 'application/gpx+xml' }), `${jm}.gpx`);
    });
    $('btnPridatMisto').addEventListener('click', () => { umistovanaFotka = null; rezimMista(!rezimPridavani); $('mapaPozn').textContent = rezimPridavani ? 'Klikněte do mapy na místo, které chcete přidat.' : ''; });
    $('dTrasy').addEventListener('input', e => {
      const r = e.target.closest('.trasa-radek'); if (!r || !S.akt) return;
      S.akt.trasy[+r.dataset.i].nazev = e.target.value;
      clearTimeout(r._t); r._t = setTimeout(() => U.ulozTrasy(S.akt.vylet.id, S.akt.trasy).catch(er => chyba(er.message)), 500);
    });
    $('dTrasy').addEventListener('click', async e => {
      const b = e.target.closest('[data-smaz]'); if (!b || !S.akt) return;
      const t = S.akt.trasy[+b.dataset.smaz];
      if (!(await potvrd(`Odebrat trasu „${t.nazev}“ z výletu?`, { ok: 'Odebrat', zrus: 'Ponechat' }))) return;
      S.akt.trasy.splice(+b.dataset.smaz, 1);
      await ulozTrasyAObnov(false);
    });
    $('optOkno').addEventListener('change', zmenaVyhlazeni);
    $('optPrah').addEventListener('change', zmenaVyhlazeni);
    const prof = $('profil');
    prof.addEventListener('pointermove', pohybProfil);
    prof.addEventListener('pointerdown', pohybProfil);
    prof.addEventListener('pointerleave', opustProfil);
    // místa
    $('dMista').addEventListener('input', e => {
      const r = e.target.closest('[data-bod]'); if (!r || !S.akt) return;
      const b = S.akt.vylet.body.find(x => x.id === r.dataset.bod); if (!b) return;
      b[e.target.dataset.k] = e.target.value;
      planujUlozeni();
    });
    $('dMista').addEventListener('change', () => { if (S.akt) { prekresliMapuDetailu(false); kresliGalerii(); } });
    $('dMista').addEventListener('click', async e => {
      const t = e.target.closest('[data-akce]'), r = e.target.closest('[data-bod]'); if (!t || !r || !S.akt) return;
      const v = S.akt.vylet, i = v.body.findIndex(x => x.id === r.dataset.bod); if (i < 0) return;
      if (t.dataset.akce === 'ukaz' && mapaD) { mapaD.setView([v.body[i].lat, v.body[i].lon], Math.max(mapaD.getZoom(), 15)); $('dMapa').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      if (t.dataset.akce === 'smaz') {
        if (!(await potvrd(`Smazat místo „${v.body[i].nazev}“?`, { ok: 'Smazat', zrus: 'Ponechat' }))) return;
        const id = v.body[i].id;
        v.body.splice(i, 1);
        const zm = S.akt.fotky.filter(f => f.bodId === id); zm.forEach(f => { f.bodId = null; });
        if (zm.length) U.ulozFotky(zm).catch(er => chyba(er.message));
        prepocitej(v, S.akt.trasy, S.akt.fotky); planujUlozeni();
        kresliMista(); prekresliMapuDetailu(false); kresliGalerii();
      }
    });
    // fotky
    $('btnFotky').addEventListener('click', () => vyberSoubor($('souborFotky')));
    $('souborFotky').addEventListener('change', e => pridejFotky([...e.target.files]));
    nastavShoz('zonaFotky', pridejFotky);
    $('optMax').addEventListener('change', () => { nast.max = +$('optMax').value; ulozNast(); });
    $('optFormat').addEventListener('change', () => { nast.format = $('optFormat').value; ulozNast(); });
    $('optOriginal').addEventListener('change', () => { nast.original = $('optOriginal').checked; ulozNast(); });
    $('optPodleCasu').addEventListener('change', () => { nast.podleCasu = $('optPodleCasu').checked; ulozNast(); });
    $('optPosun').addEventListener('change', () => { nast.posun = D.parseCislo($('optPosun').value) || 0; ulozNast(); });
    $('optDosah').addEventListener('change', () => { nast.dosah = Math.max(10, D.parseCislo($('optDosah').value) || 300); ulozNast(); });
    $('btnAutoMista').addEventListener('click', autoPrirazeni);
    $('galerie').addEventListener('click', e => {
      const b = e.target.closest('[data-akce]'), k = e.target.closest('[data-foto]'); if (!b || !k || !S.akt) return;
      const f = S.akt.fotky.find(x => x.id === k.dataset.foto); if (f) akceFotky(f, b.dataset.akce);
    });
    $('galerie').addEventListener('change', e => {
      const k = e.target.closest('[data-foto]'); if (!k || !S.akt || !e.target.dataset.k) return;
      const f = S.akt.fotky.find(x => x.id === k.dataset.foto); if (!f) return;
      f[e.target.dataset.k] = e.target.value || (e.target.dataset.k === 'bodId' ? null : '');
      U.ulozFotku(f).catch(er => chyba(er.message));
    });
    // lightbox
    $('lbZavri').addEventListener('click', () => $('lightbox').close());
    $('lbPred').addEventListener('click', () => otevriLightbox(lbIndex - 1));
    $('lbDalsi').addEventListener('click', () => otevriLightbox(lbIndex + 1));
    $('lightbox').addEventListener('keydown', e => { if (e.key === 'ArrowLeft') otevriLightbox(lbIndex - 1); else if (e.key === 'ArrowRight') otevriLightbox(lbIndex + 1); });
    $('lightbox').addEventListener('click', e => { if (e.target === $('lightbox')) $('lightbox').close(); });
    $('lightbox').addEventListener('close', () => { if (lbUrl) { URL.revokeObjectURL(lbUrl); lbUrl = null; } if (lbOrigUrl) { URL.revokeObjectURL(lbOrigUrl); lbOrigUrl = null; } $('lbObr').removeAttribute('src'); });
    // kalendář
    $('kalPred').addEventListener('click', () => posunMesic(-1));
    $('kalDalsi').addEventListener('click', () => posunMesic(1));
    $('kalDnes').addEventListener('click', () => { S.kal = { rok: new Date().getFullYear(), mesic: new Date().getMonth() }; kresliKalendar(); });
    $('rokPas').addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (b) { S.kal.mesic = +b.dataset.m; kresliKalendar(); } });
    const klikDen = async el => {
      const den = el.dataset.den;
      if (await potvrd(`Založit nový výlet na ${D.datumCesky(den)}?`, { ok: 'Založit', zrus: 'Zrušit' })) novyVylet(den);
    };
    $('kal').addEventListener('click', e => { if (e.target.closest('.cip')) return; const d = e.target.closest('.den'); if (d) klikDen(d); });
    $('kal').addEventListener('keydown', e => { const d = e.target.closest('.den'); if (d && e.target === d && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); klikDen(d); } });
    // mapa všech
    $('optVyrez').addEventListener('change', kresliSeznamMapy);
    $('optMapaFotky').addEventListener('change', kresliMapuVse);
    $('optMapaMista').addEventListener('change', kresliMapuVse);
    // úložiště a záloha
    $('btnTrvale').addEventListener('click', async () => {
      const ok = await U.pozadejTrvale();
      info(ok ? 'Úložiště je nyní trvalé.' : 'Prohlížeč žádost zamítl (Chrome povoluje trvalé úložiště zpravidla až u záložek / nainstalovaných webů).');
      obnovStavUloziste();
    });
    $('btnObnovStav').addEventListener('click', obnovStavUloziste);
    $('btnZaloha').addEventListener('click', vytvorZalohu);
    $('btnObnova').addEventListener('click', () => vyberSoubor($('souborZaloha')));
    $('souborZaloha').addEventListener('change', e => { if (e.target.files[0]) obnovZeZalohy(e.target.files[0]); });
    $('btnTisk').addEventListener('click', () => tiskni(vyletyProExport(), $('optTiskFoto').value));
    $('btnHtml').addEventListener('click', () => exportHtml(vyletyProExport(), $('optTiskFoto').value));
    $('btnUkazka').addEventListener('click', vlozUkazku);
    $('btnSmazVse').addEventListener('click', async () => {
      if (!(await potvrd(`Smazat VŠECHNY výlety (${S.vylety.length}), trasy a fotky z tohoto prohlížeče? Doporučujeme nejdřív stáhnout zálohu.`, { ok: 'Pokračovat', zrus: 'Zrušit' }))) return;
      const t = await (window.Dialog ? Dialog.zeptej('Pro potvrzení napište SMAZAT', '') : null);
      if (t !== 'SMAZAT') { info('Mazání zrušeno.'); return; }
      try { await U.smazVse(); } catch (e) { chyba(e.message); return; }
      fotkyVse = null; await nactiVse(); obnovStavUloziste(); info('Všechna data smazána.');
    });
    window.addEventListener('afterprint', poTisku);
    nastavShozVse();
    $('btnZeSouboru').addEventListener('click', () => vyberSoubor($('souborAuto')));
    $('souborAuto').addEventListener('change', e => { const f = [...e.target.files]; if (f.length) zalozZeSouboru(f); });
    $('dStitky').addEventListener('input', () => {
      if (!S.akt) return;
      S.akt.vylet.stitky = [...new Set($('dStitky').value.split(',').map(x => x.trim()).filter(Boolean))];
      planujUlozeni();
    });
    $('btnOblast').addEventListener('click', () => S.akt && zjistiOblast(S.akt.vylet, false));
    $('dPocasi').addEventListener('click', e => { if (e.target.closest('[data-pocasi]') && S.akt) nactiPocasi(S.akt.vylet, false); });
    $('sMesicRok').addEventListener('change', () => { S.grafMesice = D.statistikyPoMesicich(filtrovane(), $('sMesicRok').value || null); kresliGraf(); });
    $('porVyber').addEventListener('change', e => {
      const sel = e.target.closest('[data-por]'); if (!sel) return;
      porovnani.ids[+sel.dataset.por] = sel.value;
      porovnani.ids = porovnani.ids.filter(Boolean);
      kresliPorovnaniVyber();
    });
    $('optBarvyRoku').addEventListener('change', kresliMapuVse);
    let casResize = null;
    window.addEventListener('resize', () => { clearTimeout(casResize); casResize = setTimeout(() => { if (profilData) kresliProfil(null); if (S.zalozka === 'statistiky') kresliGraf(); }, 120); });
    new MutationObserver(() => { if (profilData) kresliProfil(null); if (S.zalozka === 'statistiky') kresliGraf(); if (S.akt) prekresliMapuDetailu(false); else if (S.zalozka === 'mapa' && mapaV) kresliMapuVse(); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    window.addEventListener('pagehide', () => { if (casovacUlozeni) { clearTimeout(casovacUlozeni); casovacUlozeni = null; ulozAkt(); } });
  }

  // pro testy v prohlížeči
  window.DENIK_UI = { stav: S, zalozZeSouboru, nactiPocasi, zjistiOblast, geokoduj, mapy: vsechnyMapy, PODKLADY, nactiVse, otevriVylet, vlozUkazku, importujTrasy, pridejFotky, vytvorZalohu, obnovZeZalohy, otevriZip, prepniZalozku, pripravDokument, zpracujFotku };
  start();
})();

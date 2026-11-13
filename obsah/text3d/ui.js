/* 3D text – ovládání stránky nad společným zapojením gen3d/aplikace.js:
   tady jen to, co je pro 3D text zvláštní (fonty a přepisy, posuvníky s číslem, segmenty, podložka tiskárny, exporty dílů).
   Stav = plochý projekt TEXT3D_PROJEKT.VYCHOZI (dřív localStorage „webapp_text3d“ a odkaz #n=, obojí se načte). */
/* global TEXT3D, TEXT3D_EXPORT, TEXT3D_PROJEKT, CC_NAHLED, FONTY, PREPIS, G3D, Dialog, TrubkyGui, THREE */
(function () {
  'use strict';
  const el = id => document.getElementById(id);
  const TP = TEXT3D_PROJEKT, EXPORT = TEXT3D_EXPORT;
  const css = (n, z) => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || z;
  const REZIMY = {
    pismena: 'Samostatná písmena k nalepení nebo přišroubování na zeď. Háčky a čárky jsou samostatné díly.',
    relief: 'Písmena vystupují z desky – cedulka nebo číslo domu v jednom kusu. Ve 3MF je deska a text zvlášť pro dvoubarevný tisk.',
    ryti: 'Písmena jsou vyrytá do desky. S výplní vznikne rovná dvoubarevná cedulka (výměna filamentu nebo AMS).',
    sablona: 'Písmena jsou prořezaná skrz desku – šablona na sprej. Nejlépe se šablonovým písmem.',
  };
  let fonty = [], posledni = null, geometrie = { text: [], deska: [] }, cekaPrerovnani = true, cisloBehu = 0;
  let hlaseniModelu = [], chybaStavby = '', podlozkaStav = null;
  const stavZobr = { tisk: true };
  // výchozí pohled jako dřív: text čelem, mírně shora a šikmo (dřívější tlačítko „Šikmo“)
  const nahled = CC_NAHLED.vytvorNahled(el('platno'), { pohledy: { iso: [-Math.PI / 2 + 0.5, 0.82] } });

  /* ---------- dřívější uložený stav a odkaz ---------- */
  try {
    const stary = localStorage.getItem('webapp_text3d');
    if (stary && !localStorage.getItem('webapp_text3d_projekt')) {
      localStorage.setItem('webapp_text3d_projekt', stary);
      const o = JSON.parse(stary), z = {};
      if (o.mrizka === false) z.tMrizka = false;
      if (o.panel === false) z.tPanel = true;
      if (Object.keys(z).length && !localStorage.getItem('webapp_text3d_zobrazeni')) localStorage.setItem('webapp_text3d_zobrazeni', JSON.stringify(z));
    }
  } catch (e) { /* bez úložiště */ }

  const app = G3D.aplikace({
    typ: 'text3d', nazev: '3D text', klic: 'webapp_text3d',
    get soubor() { return TP.jmenoSouboru(app.p.text); },
    normalizuj: TP.normalizuj, vychozi: () => G3D.kopie(TP.VYCHOZI), popis: TP.popis,
    viditelnost: q => obnovViditelnost(q),
    poNaplneni: q => vyplnVlastni(q),
    prepocitej: () => prestav(), zpozdeni: 120,
    png: () => nahled.png(), pohled: j => nahled.pohled(j),
    exportStl: () => stahniStl(['deska', 'text'], ''),
    doModelare: () => (posledni && (geometrie.text.length || geometrie.deska.length) ? { data: soubor3mf(), pripona: '.3mf' } : null),
    zkratky: { r: 'tRez', h: 'tHrany', m: 'tTisk', p: 'tPrevisy', l: 'tPravitka', g: 'tMrizka' },
    zmenaTematu: () => prestav(),
  });

  /* ---------- formulář: posuvníky s číslem, segmenty, text, přepis ---------- */
  /** Změna jednoho klíče projektu; slouceni = tažení se slije do jednoho kroku zpět. */
  function nastav(k, h, slouceni, prerovnat) {
    if (prerovnat) cekaPrerovnani = true;
    app.zmen(q => {
      q[k] = h;
      if (k === 'prepis') {   // k písmu rovnou nabídnout font, který ho umí
        const p = PREPIS.SEZNAM.find(x => x.id === h);
        if (p && p.font && fonty.some(f => f.id === p.font)) q.font = p.font;
      }
    }, slouceni);
    app.naplnFormular();
  }
  const JEDNOTKY = { vyska: ' mm', hloubka: ' mm', mezery: ' mm', radkovani: '×', tucnost: ' mm', oblouk: '°' };
  // Posuvník je na hrubé nastavení, číslo vedle něj na přesné (a smí jít i za rozsah posuvníku – např. metrový nápis).
  for (const k of Object.keys(JEDNOTKY)) {
    const span = el(k + 'Hodnota'), [min, max] = TP.MEZE[k];
    const j = document.createElement('span'); j.className = 'jednotka'; j.textContent = JEDNOTKY[k].trim();
    const inp = document.createElement('input');
    inp.type = 'number'; inp.className = 'cislo'; inp.id = k + 'Cislo';
    inp.step = el(k).step; inp.min = min; inp.max = max;
    inp.setAttribute('aria-label', el(k).closest('.form-group').querySelector('label').firstChild.textContent.trim());
    inp.addEventListener('input', () => {
      const v = parseFloat(inp.value);
      if (!isFinite(v)) return;
      nastav(k, Math.max(min, Math.min(max, v)), k);
    });
    span.replaceWith(j, inp);
    el(k).addEventListener('input', () => { const v = parseFloat(el(k).value); if (isFinite(v)) nastav(k, v, k); });
  }
  for (const id of ['zarovnani', 'mereni', 'rezim']) {
    el(id).addEventListener('click', e => {
      const b = e.target.closest('button');
      if (b) nastav(id, b.dataset.v, null, id === 'rezim');
    });
  }
  el('text').addEventListener('input', () => nastav('text', el('text').value, 'text'));
  for (const p of PREPIS.SEZNAM) {
    const o = document.createElement('option'); o.value = p.id; o.textContent = p.nazev; el('prepis').appendChild(o);
  }
  el('prepis').addEventListener('change', () => nastav('prepis', el('prepis').value, null, true));
  // barvy hned při tažení (bez přestavby), do projektu po puštění (change → [data-p])
  const indexDilu = cast => (cast === 'text' && geometrie.deska.length ? 1 : 0);
  el('barvaText').addEventListener('input', () => nahled.vzhled(indexDilu('text'), el('barvaText').value));
  el('barvaDeska').addEventListener('input', () => { if (geometrie.deska.length) nahled.vzhled(0, el('barvaDeska').value); });

  function nastavSegment(id, hodnota) {
    for (const b of el(id).querySelectorAll('button')) b.setAttribute('aria-pressed', b.dataset.v === hodnota ? 'true' : 'false');
  }
  /** Pole mimo [data-p] podle projektu (po načtení, zpět, předvolbě…). */
  function vyplnVlastni(q) {
    if (el('text').value !== q.text) el('text').value = q.text;
    el('prepis').value = q.prepis;
    for (const k of Object.keys(JEDNOTKY)) {
      el(k).value = q[k];
      const inp = el(k + 'Cislo');
      if (inp && document.activeElement !== inp) inp.value = +(+q[k]).toFixed(2);
    }
    nastavSegment('zarovnani', q.zarovnani);
    nastavSegment('mereni', q.mereni);
    nastavSegment('rezim', q.rezim);
    if (fonty.length) vyberFontu.nastav(fonty, q.font);
  }
  function obnovViditelnost(q) {
    const deska = q.rezim !== 'pismena';
    el('deskaVolby').classList.toggle('skryto', !deska);
    el('kolikVolby').classList.toggle('skryto', deska);
    for (const id of ['kolikPrumer', 'kolikHloubka']) el(id).closest('.form-group').classList.toggle('skryto', !q.kolik);
    el('skupinaRyti').classList.toggle('skryto', q.rezim !== 'ryti');
    el('skupinaVypln').classList.toggle('skryto', q.rezim !== 'ryti');
    el('skupinaRohy').classList.toggle('skryto', q.tvar !== 'obdelnik');
    el('otvory').disabled = q.tvar === 'obrys';
    el('tengwarVolby').classList.toggle('skryto', q.prepis !== 'tengwar');
    el('rezimPopis').textContent = REZIMY[q.rezim];
    el('stlDeska').disabled = !deska;
    el('vlastniPodlozka').classList.toggle('skryto', q.tiskarna !== 'vlastni');
    el('rozlozitSkupina').classList.toggle('skryto', !(TP.rozmerPodlozky(q) && q.rezim === 'pismena'));
  }

  /* ---------- fonty ---------- */
  const cilPisma = () => { const p = PREPIS.SEZNAM.find(x => x.id === app.p.prepis); return p && p.vlastniPismo ? p.id : 'latinka'; };
  const vyberFontu = FONTY.vyberFontu(el('font'), {
    ukazka: () => textKTisku() || 'Aa 123',
    poznamka: f => f.typ === 'woff2' ? 'WOFF2 – nejde do 3D' : !f.pro3d ? 'tenké tahy' : '',
    doporucene: cilPisma,
    onZmena: id => nastav('font', id, null, true),
    onNahrat: () => el('souborFontu').click(),
    onSmazat: async f => {
      if (!(await Dialog.potvrd(`Smazat font „${f.nazev}“? Zmizí i z Převodníku písma.`))) return;
      await FONTY.smaz(f.id);
      await obnovFonty();
      cekaPrerovnani = true; prestav();
    },
  });
  async function obnovFonty() {
    fonty = await FONTY.seznam();
    if (!fonty.some(f => f.id === app.p.font)) app.zmen(q => { q.font = 'bebas'; });
    vyberFontu.nastav(fonty, app.p.font);
  }
  el('souborFontu').addEventListener('change', async () => {
    await nahraj([...el('souborFontu').files]);
    el('souborFontu').value = '';
  });
  async function nahraj(soubory) {
    let nove = null;
    for (const f of soubory) {
      try { nove = await FONTY.pridej(f); Dialog.info('Font „' + nove.nazev + '“ uložen'); }
      catch (e) { Dialog.chyba(e.message || String(e)); }
    }
    if (nove) { fonty = await FONTY.seznam(); nastav('font', nove.id, null, true); }
  }
  // přetažení souboru kamkoli na stránku
  let hloubkaTazeni = 0;
  document.addEventListener('dragenter', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { hloubkaTazeni++; document.body.classList.add('tazeni'); } });
  document.addEventListener('dragleave', () => { if (--hloubkaTazeni <= 0) { hloubkaTazeni = 0; document.body.classList.remove('tazeni'); } });
  document.addEventListener('dragover', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
  document.addEventListener('drop', e => {
    if (!e.dataTransfer || !e.dataTransfer.files.length) return;
    e.preventDefault();
    hloubkaTazeni = 0; document.body.classList.remove('tazeni');
    nahraj([...e.dataTransfer.files]);
  });

  /* ---------- přestavba modelu ---------- */
  function textKTisku() {
    const q = app.p;
    if (!q.prepis || q.prepis === 'zadny') return q.text;
    let t = PREPIS.preved(q.prepis, q.text, { tehta: q.tehta });
    // písma psaná zprava doleva (fénické): prohlížeč pořadí obrací sám,
    // rozvržení 3D textu jde ale zleva, takže se řádky otočí tady
    const p = PREPIS.SEZNAM.find(x => x.id === q.prepis);
    if (p && p.rtl) t = t.split('\n').map(r => [...r].reverse().join('')).join('\n');
    return t;
  }
  const POLE_HLASENI = [[/^Některé tahy|tenké tahy/, ['tucnost']], [/^Otvory na kolíky|^U \d+ díl/, ['kolikPrumer']], [/^Otvory na šrouby/, ['okraj']], [/^Šablona se rozpadne/, ['tucnost']]];
  async function prestav() {
    const beh = ++cisloBehu, q = app.p;
    const text = textKTisku();
    vyberFontu.obnovUkazky();
    let font;
    try { font = await FONTY.opentype(q.font); }
    catch (e) {
      if (beh !== cisloBehu) return;
      chybaStavby = 'Písmo nejde načíst: ' + (e.message || String(e));
      posledni = null; zobraz(null); hlas(); return;
    }
    if (beh !== cisloBehu) return;
    let m;
    try { m = TEXT3D.model(font, text, Object.assign({}, q)); chybaStavby = ''; }
    catch (e) {
      console.error(e);
      chybaStavby = 'Model se nepodařilo sestavit: ' + (e.message || e);
      posledni = null; zobraz(null); hlas(); return;
    }
    posledni = m;
    const f = fonty.find(x => x.id === q.font);
    hlaseniModelu = m.hlaseni.map(h => ({ uroven: h.chyba ? 'chyba' : 'varovani', text: h.text, pole: (POLE_HLASENI.find(([r]) => r.test(h.text)) || [0, []])[1] }));
    if (f && !f.pro3d && !f.vlastni) hlaseniModelu.push({ uroven: 'varovani', text: 'Tohle písmo má tenké tahy – na tisk ho zvětšete nebo ztučněte.', pole: ['tucnost'] });
    if (f && f.vlastni) hlaseniModelu.push({ uroven: 'info', text: 'Vlastní font se odkazem ani projektem nepřenese – příjemce uvidí Bebas Neue.', pole: [] });
    const prerovnat = cekaPrerovnani; cekaPrerovnani = false;
    zobraz(m, prerovnat);
    hlas();
  }
  function hlas() {
    const H = hlaseniModelu.slice();
    if (FONTY.ZE_SOUBORU) H.unshift({ uroven: 'chyba', text: FONTY.HLASKA_SOUBOR, pole: [] });
    if (podlozkaStav) H.push({ uroven: podlozkaStav.trida ? 'varovani' : 'info', text: podlozkaStav.text, pole: podlozkaStav.trida === 'nevejde' ? ['vyska'] : ['tiskarna'] });
    app.hlaseni(chybaStavby ? [] : H, { chybaStavby, boxy: ['boxText', 'boxProvedeni'] });
  }

  /* ---------- náhled ---------- */
  // „na zdi“: otočení o 90° kolem X (líc písmen ke kameře zepředu), zase na Z = 0
  function postavit(poz) {
    const P = new Float32Array(poz.length);
    for (let i = 0; i < P.length; i += 3) { P[i] = poz[i]; P[i + 1] = -poz[i + 2]; P[i + 2] = poz[i + 1]; }
    let zmin = Infinity; for (let i = 2; i < P.length; i += 3) zmin = Math.min(zmin, P[i]);
    for (let i = 2; i < P.length; i += 3) P[i] -= zmin;
    return P;
  }
  function obrysPodlozky(W, H, barva) {
    const g = new THREE.Group();
    const body = [[-W / 2, -H / 2], [W / 2, -H / 2], [W / 2, H / 2], [-W / 2, H / 2]].map(([x, y]) => new THREE.Vector3(x, y, 0.05));
    g.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(body), new THREE.LineBasicMaterial({ color: barva })));
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ color: barva, transparent: true, opacity: 0.07, depthWrite: false }));
    pl.position.z = 0.02; g.add(pl);
    return g;
  }
  function zobraz(m, prerovnat) {
    for (const c of ['text', 'deska']) for (const g of geometrie[c]) g.dispose();
    geometrie = { text: [], deska: [] };
    const q = app.p;
    nahled.barvy(css('--border-strong'), css('--border'), css('--text'));
    if (m) for (const cast of ['deska', 'text']) for (const v of m.dily[cast]) { const g = TEXT3D.geometrieVrstvy(v); if (g) geometrie[cast].push(g); }
    const dily = [], obaly = [];
    for (const cast of ['deska', 'text']) {
      if (!geometrie[cast].length) continue;
      const s = TP.naPozIdx(geometrie[cast]);
      obaly.push(G3D.obal(s.poz));
      dily.push({ poz: stavZobr.tisk ? s.poz : postavit(s.poz), idx: s.idx, barva: cast === 'text' ? q.barvaText : q.barvaDeska, cast });
    }
    const prazdno = !dily.length;
    const st = el('stav3d');
    st.textContent = chybaStavby || (prazdno && m ? 'Napište text…' : '');
    st.classList.toggle('chyba', !!chybaStavby);
    // podložka tiskárny
    podlozkaStav = null;
    let navic = null;
    const r = TP.rozmerPodlozky(q);
    const info = el('podlozkaStav');
    info.classList.add('skryto');
    if (r && !prazdno) {
      const b = obaly.reduce((a, o) => [Math.min(a[0], o[0]), Math.min(a[1], o[1]), 0, Math.max(a[3], o[3]), Math.max(a[4], o[4])], [Infinity, Infinity, 0, -Infinity, -Infinity]);
      podlozkaStav = TP.stavPodlozky(b[3] - b[0], b[4] - b[1], q);
      info.textContent = podlozkaStav.text;
      info.classList.remove('skryto', 'nevejde', 'otocit');
      if (podlozkaStav.trida) info.classList.add(podlozkaStav.trida);
      const barva = css(podlozkaStav.trida === 'nevejde' ? '--danger' : podlozkaStav.trida ? '--warn' : '--ok', '#4caf7d');
      if (stavZobr.tisk) navic = obrysPodlozky(r[0], r[1], barva);
    }
    nahled.nastav(prazdno ? null : dily, { tisk: stavZobr.tisk, uhel: 45, navic, novyPohled: prerovnat });
    el('legPrevisy').hidden = !(stavZobr.tisk && nahled.stav.previsy);
    vysledky(m, obaly);
  }
  const box = G3D.dlazdice, fmt = G3D.fmt;
  function vysledky(m, obaly) {
    const q = app.p;
    if (!m || !obaly.length) { el('info').textContent = ''; el('vVysledky').innerHTML = box('Model', chybaStavby ? 'nelze sestavit' : 'prázdný', chybaStavby); kusovnik(null); return; }
    const tri = TEXT3D.trojuhelniky([...geometrie.deska, ...geometrie.text], true);
    const V = Math.abs(TEXT3D.objem(tri));      // mm³
    const b = obaly.reduce((a, o) => a.map((x, i) => (i < 3 ? Math.min(x, o[i]) : Math.max(x, o[i]))));
    const sirka = b[3] - b[0], vyska = b[4] - b[1], tl = b[5] - b[2];
    const f = n => n.toLocaleString('cs-CZ', { maximumFractionDigits: 1 });
    const dilu = q.rezim === 'pismena' ? (m.kusy ? m.kusy.length : 0) : (geometrie.deska.length ? 1 : 0) + (geometrie.text.length ? 1 : 0);
    const otvoru = m.kusy ? m.kusy.reduce((a, k) => a + k.otvory.length, 0) : 0;
    el('info').innerHTML = `Rozměr <span>${f(sirka)} × ${f(vyska)} mm</span> · tloušťka <span>${f(tl)} mm</span>`
      + ` · objem <span>${f(V / 1000)} cm³</span> · PLA při 100 % výplni ≈ <span>${f(V / 1000 * 1.24)} g</span>`
      + (q.rezim === 'pismena' ? ` · samostatných dílů <span>${dilu}</span>` + (otvoru ? ` · otvorů <span>${otvoru}</span>` : '') : '');
    const odh = G3D.odhadTisku(V, 1.24, { dilu: Math.max(1, dilu) });
    let h = box('Rozměry', `${fmt(sirka)} × ${fmt(vyska)} mm`, `tloušťka ${fmt(tl)} mm, leží naplocho`);
    h += box('Objem', `${fmt(V / 1000, 2)} cm³`, 'plný model');
    h += box('Hmotnost', `${fmt(odh.g, odh.g < 10 ? 1 : 0)} g`, `PLA, 100 % výplň (při 20 % zhruba ${fmt(odh.g * 0.45, 0)} g)`);
    h += box('Filament', `${fmt(odh.metru, 2)} m`, 'průměr 1,75 mm, plný model');
    h += box('Doba tisku', `≈ ${odh.minut < 60 ? odh.minut + ' min' : fmt(odh.minut / 60, 1) + ' h'}`, 'hrubý odhad, vrstva 0,2 mm');
    h += box(q.rezim === 'pismena' ? 'Samostatných dílů' : 'Díly', String(dilu), q.rezim === 'pismena' ? (otvoru ? `${otvoru} otvorů na kolíky` : 'písmena, háčky a čárky zvlášť') : 'deska a text');
    el('vVysledky').innerHTML = h;
    kusovnik(m);
  }
  /** Kusovník: samostatná písmena zleva (rozměr, otvory) nebo deska + text. */
  function kusovnik(m) {
    const q = app.p, radky = [];
    const f = n => fmt(n);
    if (m && m.kusy) {
      m.kusy.slice().sort((a, b) => TEXT3D.meze([a.ex]).x0 - TEXT3D.meze([b.ex]).x0).forEach((k, i) => {
        const z = TEXT3D.meze([k.ex]);
        radky.push([`Díl ${i + 1}`, `${f(z.x1 - z.x0)} × ${f(z.y1 - z.y0)} × ${fmt(q.hloubka)} mm`, k.otvory.length ? `${k.otvory.length} × otvor ⌀ ${fmt(q.kolikPrumer)} hl. ${fmt(k.hloubkaOtvoru)}` : '']);
      });
    } else if (m) {
      if (m.desk) { const z = TEXT3D.meze(m.desk.obrys); radky.push(['Deska', `${f(z.x1 - z.x0)} × ${f(z.y1 - z.y0)} × ${fmt(q.deskaTl)} mm`, { relief: 'text na ní', ryti: 'vyrytý text', sablona: 'prořezaná' }[q.rezim] + (q.ramSirka > 0 ? ', rámeček' : '') + (q.otvory && q.tvar !== 'obrys' ? `, ${q.otvory} otvory` : '')]); }
      if (geometrie.text.length) radky.push(['Text', q.rezim === 'ryti' ? 'výplň rytiny' : `výška ${fmt(q.hloubka)} mm nad deskou`, 'druhá barva ve 3MF']);
    }
    const vic = radky.length > 1;
    el('zalKusovnik').hidden = !vic;
    el('sKusovnik').textContent = vic ? String(radky.length) : '';
    if (!vic && el('zalKusovnik').getAttribute('aria-selected') === 'true') TrubkyGui.otevriZalozku('vysledky');
    el('tabKusovnik').innerHTML = '<tr><th>Díl</th><th class="c">Rozměr</th><th>Pozn.</th></tr>' + radky.map(r => `<tr><td>${r[0]}</td><td class="c">${r[1]}</td><td>${r[2]}</td></tr>`).join('');
    TrubkyGui.souhrn('sText', `${String(q.text).split('\n')[0].slice(0, 18)}${(fonty.find(x => x.id === q.font) || {}).nazev ? ' · ' + fonty.find(x => x.id === q.font).nazev : ''}`, true);
    TrubkyGui.souhrn('sRozmery', `${fmt(q.vyska)} mm · tl. ${fmt(q.hloubka)}${q.oblouk ? ` · oblouk ${q.oblouk}°` : ''}`, true);
    TrubkyGui.souhrn('sDeska', { pismena: 'jen písmena', relief: 'na desce', ryti: 'vyrytý', sablona: 'šablona' }[q.rezim] + (q.rezim === 'pismena' && q.kolik ? ` · ${q.kolik}× kolík` : ''), true);
    TrubkyGui.souhrn('sTisk', q.tiskarna ? (TP.rozmerPodlozky(q) || []).join(' × ') + ' mm' : '', !!q.tiskarna);
  }

  /* ---------- stahování ---------- */
  const jmeno = () => (app.p.nazev ? G3D.jmenoSouboru(app.p.nazev, 'text3d', '') : TP.jmenoSouboru(app.p.text));
  function stahniStl(casti, pripona) {
    if (!posledni) { Dialog.chyba(chybaStavby || 'Model se ještě sestavuje.'); return; }
    const geo = casti.flatMap(c => geometrie[c]);
    if (!geo.length) { Dialog.chyba('Model je prázdný.'); return; }
    app.stahni(new Blob([EXPORT.stl(TEXT3D.trojuhelniky(geo), app.p.text)], { type: 'model/stl' }), jmeno() + pripona + '.stl');
  }
  function soubor3mf() {
    const dily = [];
    if (geometrie.deska.length) dily.push({ nazev: 'deska', tri: TEXT3D.trojuhelniky(geometrie.deska), barva: app.p.barvaDeska });
    if (geometrie.text.length) dily.push({ nazev: 'text', tri: TEXT3D.trojuhelniky(geometrie.text), barva: app.p.barvaText });
    return EXPORT.mf3(dily);
  }
  el('btnStl').addEventListener('click', () => stahniStl(['deska', 'text'], ''));
  el('stlText').addEventListener('click', () => stahniStl(['text'], '_text'));
  el('stlDeska').addEventListener('click', () => stahniStl(['deska'], '_deska'));
  el('btn3mf').addEventListener('click', () => {
    if (!posledni || !(geometrie.text.length || geometrie.deska.length)) { Dialog.chyba(chybaStavby || 'Model je prázdný.'); return; }
    app.stahni(soubor3mf(), jmeno() + '.3mf');
  });
  el('zipDily').addEventListener('click', () => {
    if (!posledni) return;
    const q = app.p;
    // každý souvislý kus (obrys s dírami) zvlášť; u desky celé vrstvy
    const soubory = [];
    const vrstvyTextu = posledni.kusy ? [] : posledni.dily.text;
    let n = 0;
    // samostatná písmena: každé i se svými otvory na kolíky
    const kusyZleva = (posledni.kusy || []).slice().sort((a, b) => TEXT3D.meze([a.ex]).x0 - TEXT3D.meze([b.ex]).x0);
    for (const kus of kusyZleva) {
      const geo = TEXT3D.vrstvyKusu([kus], q.hloubka).map(TEXT3D.geometrieVrstvy).filter(Boolean);
      if (!geo.length) continue;
      n++;
      soubory.push({ jmeno: `${jmeno()}_dil${String(n).padStart(2, '0')}.stl`, data: EXPORT.stl(TEXT3D.trojuhelniky(geo), q.text + ' dil ' + n) });
      geo.forEach(g => g.dispose());
    }
    for (const v of vrstvyTextu) {
      const kusy = v.ex.slice().sort((a, b) => TEXT3D.meze([a]).x0 - TEXT3D.meze([b]).x0);
      for (const kus of kusy) {
        const g = TEXT3D.geometrieVrstvy({ ex: [kus], z0: v.z0, z1: v.z1 });
        if (!g) continue;
        n++;
        soubory.push({ jmeno: `${jmeno()}_dil${String(n).padStart(2, '0')}.stl`, data: EXPORT.stl(TEXT3D.trojuhelniky([g]), q.text + ' dil ' + n) });
        g.dispose();
      }
    }
    if (geometrie.deska.length) soubory.push({ jmeno: jmeno() + '_deska.stl', data: EXPORT.stl(TEXT3D.trojuhelniky(geometrie.deska), q.text + ' deska') });
    if (!soubory.length) { Dialog.chyba('Model je prázdný.'); return; }
    app.stahni(EXPORT.zip(soubory), jmeno() + '_dily.zip');
  });
  el('svg').addEventListener('click', () => {
    if (!posledni || !posledni.textEx.length) return;
    app.stahni(EXPORT.svg(posledni.textEx, posledni.desk ? posledni.desk.obrys : null, TEXT3D.SC), jmeno() + '.svg');
  });
  el('rozlozit').addEventListener('click', () => {
    const r = TP.rozmerPodlozky(app.p);
    if (!r || !posledni || !posledni.kusy || !posledni.kusy.length) return;
    const vysl = TP.rozlozNaPodlozky(posledni.kusy, r[0], r[1], 4);
    if (vysl.chyba) { Dialog.chyba(vysl.chyba); return; }
    const soubory = vysl.podlozky.map((kusy, i) => {
      const geo = TEXT3D.vrstvyKusu(kusy, app.p.hloubka).map(TEXT3D.geometrieVrstvy).filter(Boolean);
      const data = EXPORT.stl(TEXT3D.trojuhelniky(geo), app.p.text + ' podlozka ' + (i + 1));
      geo.forEach(g => g.dispose());
      return { jmeno: `${jmeno()}_podlozka${i + 1}.stl`, data };
    });
    if (soubory.length === 1) app.stahni(new Blob([soubory[0].data], { type: 'model/stl' }), soubory[0].jmeno);
    else app.stahni(EXPORT.zip(soubory), jmeno() + '_podlozky.zip');
    Dialog.info(soubory.length === 1 ? 'Všechna písmena se vešla na jednu podložku.' : `Písmena jsou rozložená na ${soubory.length} podložky (ZIP).`);
  });

  /* ---------- nabídky, přepínače ---------- */
  TrubkyGui.pripoj({ klic: 'webapp_text3d_gui', pohled: j => nahled.pohled(j) });
  TP.PREDLOHY.forEach((v, i) => {
    const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
    b.innerHTML = `${v.nazev}<span class="pozn">${v.popis}</span>`;
    b.addEventListener('click', () => { cekaPrerovnani = true; app.nahrad(TP.predvolba(app.p, i, id => fonty.some(f => f.id === id))); });
    el('seznamPredvoleb').appendChild(b);
  });
  el('vycentrovat').addEventListener('click', () => nahled.pohled('ponech'));
  app.prepinac('tHrany', h => nahled.prepni('hrany', h), true);
  app.prepinac('tRez', h => { nahled.prepni('rez', h); el('legRez').hidden = !h; });
  app.prepinac('tPrevisy', h => { nahled.prepni('previsy', h); el('legPrevisy').hidden = !(h && stavZobr.tisk); }, true);
  app.prepinac('tPravitka', h => nahled.prepni('pravitka', h), true);
  app.prepinac('tMrizka', h => nahled.prepni('mrizka', h), true);
  app.prepinac('tPanel', h => document.querySelector('.plocha').classList.toggle('bez-panelu', h), true);
  app.prepinac('tTisk', h => { stavZobr.tisk = h; cekaPrerovnani = true; if (posledni) zobraz(posledni, true); });

  /* ---------- start ---------- */
  el('stav3d').textContent = 'Načítám písmo…';
  (async () => {
    await obnovFonty();
    await app.start();
    // starý odkaz #n=… (před sdílením přes gen3d)
    const m = /[#&]n=([A-Za-z0-9_-]+)/.exec(location.hash);
    if (m) {
      try { cekaPrerovnani = true; app.nahrad(TP.normalizuj(TP.zeStarehoOdkazu(m[1])).p); Dialog.info('Návrh načten z odkazu.'); }
      catch (e) { Dialog.chyba('Odkaz je poškozený – návrh z něj nejde načíst.'); }
      try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* sandbox */ }
    }
  })();
  window.TEXT3D_UI = { get p() { return app.p; }, get model() { return posledni; }, nastav, prestav, nahled, app };
})();

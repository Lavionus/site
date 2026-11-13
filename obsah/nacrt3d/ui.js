/* Z náčrtu do 3D – rozhraní: lišta a nabídky, uložení kresby, napojení papíru a výkladu, kontrola, výběr, tisk do PDF. */
(function (N) {
  'use strict';
  const $ = id => document.getElementById(id);
  const KLIC_NAST = 'webapp_nacrt3d_nastaveni', KLIC_VYKRES = 'webapp_nacrt3d_vykres';
  const nacti = k => { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch (e) { return {}; } };
  const nast = Object.assign({ nastroj: 'ruka', pero: 'obrys', krok: 5, prichyt: true, surove: false, vysledek: true, panel3d: false, material: 'pla', voditka: true }, nacti(KLIC_NAST));
  nast.chyt = Object.assign(Object.fromEntries(Object.keys(N.VOLBY_PRICHYTU).map(k => [k, true])), nast.chyt && typeof nast.chyt === 'object' ? nast.chyt : {});
  // dřív byla pera nástroji (obrys/skrytá/osa) – teď nástroj „ruka“ + pero
  if (['obrys', 'skryta', 'osa'].includes(nast.nastroj)) { nast.pero = nast.nastroj; nast.nastroj = 'ruka'; }
  if (!['obrys', 'skryta', 'osa'].includes(nast.pero)) nast.pero = 'obrys';
  if (![1, 2.5, 5, 10].includes(nast.krok)) nast.krok = 5;
  const NASTROJE = ['vyber', 'ruka', 'usecka', 'obdelnik', 'kruh', 'dira', 'oblouk', 'zaobleni', 'zkoseni', 'odsazeni', 'orez', 'voditko', 'mereni', 'kota', 'guma', 'posun'];
  if (!NASTROJE.includes(nast.nastroj)) nast.nastroj = 'ruka';
  const vykres = Object.assign({ verze: 1, typ: 'plochy', format: 'A4', tloustka: null, prvky: [] }, nacti(KLIC_VYKRES));
  if (!N.TYPY_LISTU[vykres.typ]) vykres.typ = 'plochy';
  if (!N.FORMATY[vykres.format]) vykres.format = 'A4';
  vykres.prvky = N.ocistiPrvky(vykres.prvky);          // úložiště může obsahovat cokoli
  const cislo = v => typeof v === 'number' && isFinite(v) && Math.abs(v) < 1e5;
  vykres.voditka = (Array.isArray(vykres.voditka) ? vykres.voditka : [])
    .filter(v => v && Array.isArray(v.a) && cislo(v.a[0]) && cislo(v.a[1]) && cislo(v.u))
    .map((v, i) => ({ id: typeof v.id === 'string' && /^[\w-]{1,40}$/.test(v.id) ? v.id : 'v' + i, a: [v.a[0], v.a[1]], u: v.u }));
  const ulozNast = () => { try { localStorage.setItem(KLIC_NAST, JSON.stringify(nast)); } catch (e) { /* plné úložiště nevadí */ } };
  let casUlozeni = 0;
  const ulozVykres = () => {
    clearTimeout(casUlozeni);
    casUlozeni = setTimeout(() => {
      try { localStorage.setItem(KLIC_VYKRES, JSON.stringify(vykres)); }
      catch (e) { info('Kresbu se nepodařilo uložit (plné úložiště prohlížeče).'); }
    }, 400);
  };

  // ------------------------------------------------------------ kresliče
  const PISMO = '"Liberation Sans", Arial, Helvetica, sans-serif';
  /** Kreslič na plátno: s = px na mm, (ox, oy) = posun listu v px. */
  N.kreslicPlatna = function (ctx, s, ox = 0, oy = 0) {
    const X = x => ox + x * s, Y = y => oy + y * s;
    const pero = (o, vychozi) => {
      ctx.strokeStyle = o.barva || '#000';
      ctx.lineWidth = Math.max(0.6, (o.sila || vychozi) * s);
      ctx.setLineDash(o.carky ? o.carky.map(v => v * s) : []);
    };
    return {
      obdelnik(x, y, w, h, o = {}) {
        if (o.plny) { ctx.fillStyle = o.barva || '#000'; ctx.fillRect(X(x), Y(y), w * s + 0.3, h * s + 0.3); return; }
        pero(o, 0.3); ctx.strokeRect(X(x), Y(y), w * s, h * s);
      },
      cara(x1, y1, x2, y2, o = {}) { pero(o, 0.3); ctx.beginPath(); ctx.moveTo(X(x1), Y(y1)); ctx.lineTo(X(x2), Y(y2)); ctx.stroke(); },
      kruh(x, y, r, o = {}) {
        ctx.beginPath(); ctx.arc(X(x), Y(y), r * s, 0, 2 * Math.PI);
        if (o.plny) { ctx.fillStyle = o.barva || '#000'; ctx.fill(); } else { pero(o, 0.3); ctx.stroke(); }
      },
      text(x, y, t, o = {}) {
        ctx.fillStyle = o.barva || '#000';
        ctx.font = (o.tucne ? '600 ' : '') + (o.vel || 3) * s + 'px ' + PISMO;
        ctx.textAlign = o.zarovnani || 'left'; ctx.textBaseline = 'alphabetic';
        ctx.fillText(t, X(x), Y(y));
      },
      tecky(body, r, barva) {
        ctx.fillStyle = barva;
        const rp = Math.max(0.7, r * s);
        for (const [x, y] of body) { ctx.beginPath(); ctx.arc(X(x), Y(y), rp, 0, 2 * Math.PI); ctx.fill(); }
      },
    };
  };

  /** Kreslič do jsPDF (jednotky mm). */
  function kreslicPdf(doc, maPismo) {
    const pero = (o, vychozi) => {
      doc.setDrawColor(o.barva || '#000000');
      doc.setLineWidth(o.sila || vychozi);
      doc.setLineDashPattern(o.carky || [], 0);
    };
    return {
      obdelnik(x, y, w, h, o = {}) {
        if (o.plny) { doc.setFillColor(o.barva || '#000000'); doc.rect(x, y, w, h, 'F'); return; }
        pero(o, 0.3); doc.rect(x, y, w, h, 'S');
      },
      cara(x1, y1, x2, y2, o = {}) { pero(o, 0.3); doc.line(x1, y1, x2, y2); },
      kruh(x, y, r, o = {}) {
        if (o.plny) { doc.setFillColor(o.barva || '#000000'); doc.circle(x, y, r, 'F'); return; }
        pero(o, 0.3); doc.circle(x, y, r, 'S');
      },
      text(x, y, t, o = {}) {
        doc.setTextColor(o.barva || '#000000');
        doc.setFont(maPismo ? 'LS' : 'helvetica', !maPismo && o.tucne ? 'bold' : 'normal');
        doc.setFontSize((o.vel || 3) * 72 / 25.4);
        doc.text(maPismo ? t : t.normalize('NFD').replace(/[\u0300-\u036f]/g, ''), x, y, { align: o.zarovnani || 'left' });
      },
      tecky(body, r, barva) {
        doc.setFillColor(barva);
        for (const [x, y] of body) doc.rect(x - r, y - r, 2 * r, 2 * r, 'F');   // čtvereček: v PDF o řád menší než kruh
      },
    };
  }

  let pismoB64 = null;
  async function nactiPismo() {
    if (pismoB64) return pismoB64;
    const b = new Uint8Array(await (await fetch('lib/pdflib/LiberationSans-Regular.ttf')).arrayBuffer());
    let s = '';
    for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    return (pismoB64 = btoa(s));
  }

  /** jsPDF dokument s prázdným listem. */
  async function pdfListu(typ, format) {
    const doc = new window.jspdf.jsPDF({ orientation: 'p', unit: 'mm', format: format.toLowerCase() });
    let maPismo = false;
    try { doc.addFileToVFS('LiberationSans-Regular.ttf', await nactiPismo()); doc.addFont('LiberationSans-Regular.ttf', 'LS', 'normal'); maPismo = true; } catch (e) { /* zůstane Helvetica bez diakritiky */ }
    N.kresliList(N.rozvrh(typ, format), kreslicPdf(doc, maPismo));
    doc.setProperties({ title: 'Z náčrtu do 3D – ' + N.TYPY_LISTU[typ].nazev + ' ' + format });
    return doc;
  }

  async function tiskPdf() {
    const tl = $('btnPdf');
    tl.disabled = true;
    try {
      (await pdfListu(vykres.typ, vykres.format)).save('nacrt3d-' + vykres.typ + '-' + vykres.format + '.pdf');
    } catch (e) {
      Dialog.chyba('PDF se nepodařilo vytvořit: ' + e.message);
    } finally { tl.disabled = false; }
  }

  // ------------------------------------------------------------ papír
  const platno = $('platno'), obal = $('plocha'), pruh = $('pruh');
  const NAPOVEDA_NASTROJU = {
    ruka: 'Ruka: kreslete volně zvoleným perem (obrys / skrytá / osa). Po zvednutí pera se čára srovná a přichytí k mřížce.',
    usecka: N.NASTROJE_TVARU.usecka.napoveda, obdelnik: N.NASTROJE_TVARU.obdelnik.napoveda, kruh: N.NASTROJE_TVARU.kruh.napoveda,
    dira: N.NASTROJE_TVARU.dira.napoveda, oblouk: N.NASTROJE_TVARU.oblouk.napoveda,
    zaobleni: 'Zaoblení: klepněte na roh (oranžové kolečko) a napište poloměr R.',
    odsazeni: 'Odsazení: klepněte na čáru nebo kružnici na tu stranu, kam má jít rovnoběžná kopie, a napište vzdálenost.',
    orez: 'Ořez: klepněte na kus čáry mezi průsečíky – odřízne se. Shift + klepnutí = prodloužit konec k nejbližší čáře.',
    voditko: 'Vodicí linka: klepnutí = vodorovná i svislá bodem, tažení = linka ve směru (po 15°, Alt volně). Smazat gumou.',
    mereni: 'Měření: klepněte na dva body (přichytávají se) – ukáže vzdálenost, Δx, Δy a úhel. Esc zruší.',
    zkoseni: 'Zkosení: klepněte na roh (oranžové kolečko) a napište délku sražení.',
    kota: 'Kóta: táhněte od jednoho bodu ke druhému, pak napište rozměr. Klepnutím na kótu (nebo dvojklikem) ji upravíte.',
    guma: 'Guma: přejeďte přes čáry, které chcete smazat.',
    posun: 'Posun: táhněte list. Zoom kolečkem myši nebo dvěma prsty.',
    vyber: 'Výběr: klepnutí / Shift / rám vybere, tažením posunete, čtverečky upraví body. Ctrl+D kopie, šipky posun, Delete smaže.',
  };
  let infoText = '';
  function info(t) { infoText = t || ''; obnovPruh(); }
  function obnovPruh() {
    const n = vykres.prvky.filter(p => p.druh !== 'kota').length, k = vykres.prvky.filter(p => p.druh === 'kota');
    const bez = k.filter(p => p.hodnota == null).length;
    pruh.textContent = infoText || NAPOVEDA_NASTROJU[nast.nastroj] || '';
    const tvar = (c, a, b, d) => c + ' ' + (c === 1 ? a : c >= 2 && c <= 4 ? b : d);
    // části zvlášť (span) – slovník i18n přeloží každou podle vlastního vzoru
    const el = $('pocty'), cast = t => { const s = document.createElement('span'); s.textContent = t; return s; };
    if (n || k.length) el.replaceChildren(cast(tvar(n, 'čára', 'čáry', 'čar')), ' · ', cast(tvar(k.length, 'kóta', 'kóty', 'kót')), ...(bez ? [' ', cast(`(${bez} bez čísla)`)] : []));
    else el.textContent = N.TYPY_LISTU[vykres.typ].popis;
  }
  const model = {
    vykres, nast,
    vysledek: null, stavKot: new Map(), popisKot: new Map(), vybrane: [],
    verze: 0,
    zmena() { model.verze++; ulozVykres(); obnovTlacitka(); obnovPruh(); naplanujVyklad(); },
    zmenaVyberu() { obnovVyber(); },
    info,
  };
  const papir = N.vytvorPapir(platno, obal, model);

  // ------------------------------------------------------------ výklad kresby a kontrola
  let casVykladu = 0;
  function naplanujVyklad() { clearTimeout(casVykladu); casVykladu = setTimeout(vyloz, 120); }
  function vyloz() {
    if (!nast.panel3d) model.teleso = null;            // se zavřeným panelem se těleso nepřestavuje – staré hlášení pryč
    try {
      model.vysledek = N.zpracuj(vykres);
      // nové kóty s číslem odskočí mimo kresbu (na stranu, kde byly nakreslené); přiřazení se tím nemění
      let posun = false;
      for (const k of vykres.prvky) {
        if (!k.umistit || k.hodnota == null) continue;
        delete k.umistit;
        const m = N.umistiKotu(model.vysledek, k, vykres.prvky);
        if (m) { k.a = m.a; k.b = m.b; if (m.m) k.m = m.m; delete k.tah; posun = true; }
      }
      if (posun) { model.vysledek = N.zpracuj(vykres); ulozVykres(); }
    }
    catch (e) { console.error(e); model.vysledek = { hlaseni: [{ druh: 'chyba', text: 'Výklad kresby selhal: ' + e.message }], koty: [] }; }
    model.geomKot = new Map(model.vysledek.koty.map(k => [k.id, k]));
    model.stavKot = new Map(model.vysledek.koty.map(k => [k.id, k.stav]));
    model.popisKot = new Map(model.vysledek.koty.map(k => [k.id, k.popis]));
    obnovKontrolu(); papir.prekresli();
    // otevřenou tabulku kót obnovit (stav kót), jen když se v ní zrovna nepíše
    if (!$('nabKoty').hidden && !$('nabKoty').contains(document.activeElement)) tabulkaKot();
    naplanujStavbu();
  }
  const IKONA = { chyba: '⛔', varovani: '⚠️', info: 'ℹ️', ok: '✅' };
  function obnovKontrolu() {
    const t = model.teleso, h = ((model.vysledek && model.vysledek.hlaseni) || []).concat(
      t ? (t.chyba ? [{ druh: 'chyba', text: '3D: ' + t.chyba }] : []).concat(t.hlaseni.map(x => Object.assign({}, x, { text: '3D: ' + x.text }))) : []);
    const tl = $('btnKontrola'), nej = h.find(x => x.druh === 'chyba') || h.find(x => x.druh === 'varovani') || h.find(x => x.druh === 'ok') || h[0];
    tl.hidden = !h.length;
    const pocet = h.filter(x => x.druh === 'chyba' || x.druh === 'varovani').length;
    tl.textContent = (nej ? IKONA[nej.druh] : '') + (pocet ? ' ' + pocet : '') + ' Kontrola';
    tl.className = 'tl mini kontrola-' + (nej ? nej.druh : 'ok');
    const sez = $('nabKontrola');
    sez.replaceChildren(...h.map(x => {
      const b = document.createElement('button');
      b.className = 'tl hlaseni-' + x.druh;
      b.textContent = IKONA[x.druh] + ' ' + x.text;
      if (x.prvky && x.prvky.length) b.onclick = () => { zavriNabidky(); if (nast.nastroj !== 'vyber') nastroj('vyber'); papir.vyber(x.prvky[0]); };
      else b.disabled = true;                          // jen informace (volné konce jsou vyznačené oranžově na listu)
      return b;
    }));
  }
  // ------------------------------------------------------------ 3D model (manifold, náhled, údaje, export)
  const MATERIALY = { pla: ['PLA', 1.24], petg: ['PETG', 1.27], abs: ['ABS', 1.04], asa: ['ASA', 1.07], tpu: ['TPU', 1.21], pa: ['PA (nylon)', 1.14], ocel: ['ocel', 7.85], hlinik: ['hliník', 2.70] };
  if (!MATERIALY[nast.material]) nast.material = 'pla';
  const nactiSkript = src => new Promise((ok, ko) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => ko(new Error('nenačteno ' + src)); document.head.appendChild(s); });
  let wasmSlib = null;
  function nactiManifold() {
    return wasmSlib || (wasmSlib = (async () => {
      globalThis.MANIFOLD_URL = new URL('lib/manifold/manifold.klasicky.js', location.href).href;
      if (!globalThis.ManifoldModule) await nactiSkript('lib/manifold/manifold.klasicky.js');
      const w = await globalThis.ManifoldModule({ locateFile: f => new URL('lib/manifold/' + f, location.href).href });
      w.setup();
      return w;
    })().catch(e => { wasmSlib = null; throw e; }));
  }
  let nahled = null, casStavby = 0, celyPohled = true;
  const stav3d = $('stav3d');
  function naplanujStavbu() { if (nast.panel3d) { clearTimeout(casStavby); casStavby = setTimeout(postav, 60); } }
  /** Postaví těleso z aktuálního výkladu; vrací výsledek stavby. */
  // stavby jdou za sebou ve frontě – export tak vždy dostane těleso z aktuální kresby (ne z rozběhnuté starší stavby)
  let fronta = Promise.resolve();
  function postav() { fronta = fronta.then(postavHned, postavHned); return fronta; }
  async function postavHned() {
    try {
      if (!model.vysledek) vyloz();
      if (!wasmSlib) stav3d.textContent = 'Načítám geometrické jádro…';
      const w = await nactiManifold();
      model.teleso = N.postavTeleso(w, vykres, model.vysledek);
    } catch (e) {
      model.teleso = { chyba: 'Geometrické jádro (manifold-3d) se nenačetlo: ' + (e && e.message || e), hlaseni: [] };
    }
    zobrazTeleso(); obnovKontrolu();
    return model.teleso;
  }
  function zobrazTeleso() {
    const r = model.teleso;
    if (!nast.panel3d || !r) return;
    if (!nahled && window.SPOJKY_NAHLED && window.THREE) {
      nahled = SPOJKY_NAHLED.vytvorNahled($('nahled3d'));
      $('nahled3d').querySelector('canvas').setAttribute('aria-label', '3D náhled dílu – tažením otáčíte, kolečkem přibližujete, pravým tlačítkem posouváte');
    }
    stav3d.textContent = r.chyba || '';
    stav3d.classList.toggle('chyba', !!r.chyba);
    if (nahled) nahled.nastav(r.chyba ? null : { poz: r.poz, idx: r.idx, klic: vykres.typ, duchove: [], tisk: { poz: r.poz, tridy: null } });
    if (nahled && celyPohled && !r.chyba) { celyPohled = false; requestAnimationFrame(() => requestAnimationFrame(() => nahled.pohled('iso'))); }   // až má panel svou šířku
    const ud = $('udaje3d');
    if (r.chyba) { ud.replaceChildren(); return; }
    const f = (x, d = 1) => (+x.toFixed(d)).toLocaleString('cs-CZ'), o = r.obalka, hus = MATERIALY[nast.material][1];
    const dl = (popis, hodnota) => { const e = document.createElement('div'); e.className = 'dl'; e.innerHTML = '<span></span><b></b>'; e.firstChild.textContent = popis; e.lastChild.textContent = hodnota; return e; };
    const sel = document.createElement('select');
    sel.setAttribute('aria-label', 'Materiál pro výpočet hmotnosti');
    for (const [k, [n, h]] of Object.entries(MATERIALY)) sel.add(new Option(n + ' ' + String(h).replace('.', ',') + ' g/cm³', k));
    sel.value = nast.material;
    sel.onchange = () => { nast.material = sel.value; ulozNast(); zobrazTeleso(); };
    const hm = dl('Hmotnost', f(r.objem / 1000 * hus, r.objem / 1000 * hus < 100 ? 1 : 0) + ' g');
    hm.appendChild(sel);
    ud.replaceChildren(
      dl('Rozměry (X × Y × Z)', [3, 4, 5].map(i => f(o[i] - o[i - 3], 2)).join(' × ') + ' mm'),
      dl('Objem', f(r.objem / 1000, 2) + ' cm³'), hm,
      dl('Síť', r.idx.length / 3 + ' trojúhelníků' + (r.slozek > 1 ? ' · ' + r.slozek + ' kusy' : '')));
  }
  function prepniPanel() {
    nast.panel3d = !nast.panel3d; ulozNast();
    $('panel3d').hidden = !nast.panel3d;
    $('btn3d').setAttribute('aria-pressed', String(nast.panel3d));
    if (nast.panel3d) { celyPohled = true; postav(); }
  }
  function stahni(data, nazev, typ) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([data], { type: typ }));
    a.download = nazev;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  async function exportuj(fmt) {
    vyloz();
    const r = await postav();
    if (!r || r.chyba) { Dialog.chyba('Model nejde uložit: ' + (r ? r.chyba : 'stavba selhala')); return; }
    const dil = [{ poz: r.poz, idx: r.idx }], jmeno = 'nacrt3d-' + vykres.typ;
    if (fmt === 'stl') stahni(KRAB.stlBinarni(dil, 'Z nacrtu do 3D'), jmeno + '.stl', 'model/stl');
    else if (fmt === 'modelar') {   // předat Modeláři (gen3d/predavka.js) – otevře se s dílem ve scéně
      try { await G3D.predej('modelar', new Blob([KRAB.soubor3mf(dil, 'Díl z náčrtu')]), jmeno + '.3mf'); location.href = 'modelar.html#predavka'; }
      catch (e) { Dialog.chyba('Model se nepodařilo předat Modeláři: ' + e.message); }
    }
    else stahni(KRAB.soubor3mf(dil, 'Díl z náčrtu'), jmeno + '.3mf', 'model/3mf');
  }

  // ------------------------------------------------------------ tabulka kót
  const IKONA_KOTY = { ok: '✅', 'nepřiřazená': '⚠️', rozpor: '⛔', 'bez čísla': '❔' };
  function tabulkaKot() {
    const nab = $('nabKoty'), koty = vykres.prvky.filter(p => p.druh === 'kota');
    if (!koty.length) {
      const d = document.createElement('div'); d.className = 'prazdne';
      d.textContent = 'Zatím žádné kóty. Nástrojem ↔ Kóta (klávesa 4) táhněte mezi dvěma body a napište rozměr.';
      nab.replaceChildren(d); return;
    }
    const pohled = new Map((model.vysledek ? model.vysledek.koty : []).map(k => [k.id, k]));
    const nazvy = Object.fromEntries(N.rozvrh(vykres.typ, vykres.format).ramy.map(r => [r.id, r.nazev.replace(/ \(.*\)$/, '')]));
    const tab = document.createElement('table');
    tab.innerHTML = '<thead><tr><th></th><th>Kóta</th><th>mm</th><th>Pohled</th><th></th></tr></thead>';
    const tb = document.createElement('tbody');
    koty.forEach((k, i) => {
      const v = pohled.get(k.id) || {}, tr = document.createElement('tr');
      const td = t => { const e = document.createElement('td'); if (t != null) e.textContent = t; tr.appendChild(e); return e; };
      td(IKONA_KOTY[v.stav] || '').title = v.stav || '';
      td(/^[⌀R]/.test(v.popis || '') ? v.popis[0] : v.typ === 'vzdalY' ? '↕' : v.typ === 'delka' ? '⤢' : '↔').title = v.popis || '';
      const vst = document.createElement('input');
      vst.type = 'text'; vst.inputMode = 'decimal'; vst.dataset.i = i;
      vst.value = k.hodnota != null ? String(k.hodnota).replace('.', ',') : '';
      vst.setAttribute('aria-label', 'Rozměr kóty ' + (i + 1) + ' v mm');
      const potvrd = () => {
        const h = parseFloat(vst.value.replace(',', '.'));
        if (!(isFinite(h) && h > 0) || h === k.hodnota) { vst.value = k.hodnota != null ? String(k.hodnota).replace('.', ',') : ''; return; }
        papir.zapamatuj(); k.hodnota = Math.round(h * 1000) / 1000; model.zmena(); papir.prekresli();
      };
      vst.addEventListener('change', potvrd);
      vst.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault(); potvrd();
          const dalsi = nab.querySelector(`input[data-i="${i + (e.key === 'ArrowUp' ? -1 : 1)}"]`);
          if (dalsi) { dalsi.focus(); dalsi.select(); }
        }
      });
      td().appendChild(vst);
      td(nazvy[v.pohled] || '–');
      const b = document.createElement('button'); b.className = 'tl mini'; b.textContent = '🎯'; b.title = 'Ukázat kótu na listu';
      b.onclick = () => { zavriNabidky(); if (nast.nastroj !== 'vyber') nastroj('vyber'); papir.vyber(k.id); };
      td().appendChild(b);
      tb.appendChild(tr);
    });
    tab.appendChild(tb);
    const odsad = document.createElement('button');
    odsad.className = 'tl'; odsad.textContent = '↥ Odsadit všechny kóty od kresby';
    odsad.title = 'Přiřazené kóty se přesunou mimo obrys a srovnají za sebe';
    odsad.onclick = () => {
      papir.zapamatuj();
      for (const k of vykres.prvky) if (k.druh === 'kota') k.umistit = true;
      // postupně, ať se další kóta řadí za už přesunuté
      for (const k of vykres.prvky) if (k.umistit) { delete k.umistit; const m = N.umistiKotu(model.vysledek, k, vykres.prvky); if (m) { k.a = m.a; k.b = m.b; if (m.m) k.m = m.m; delete k.tah; } }
      model.zmena(); papir.prekresli();
    };
    nab.replaceChildren(tab, odsad);
  }
  $('btnKoty').addEventListener('click', tabulkaKot, true);   // naplnit před otevřením (zachytávací fáze)

  // ------------------------------------------------------------ výběr a operace s ním
  const vybranePrvky = () => vykres.prvky.filter(q => (model.vybrane || []).includes(q.id));
  function obnovVyber() {
    const sel = vybranePrvky(), panel = $('vyberPanel');
    panel.hidden = !sel.length;
    if (!sel.length) return;
    const p = sel[0], DRUH = { cara: p.zavrena ? 'uzavřená čára' : 'čára', kruh: 'kružnice', kota: 'kóta' };
    $('vyberPopis').textContent = sel.length > 1 ? sel.length + ' prvků' : DRUH[p.druh] + (p.druh === 'kota' ? ' ' + (model.popisKot.get(p.id) || '') : '');
    const cary = sel.filter(q => q.druh !== 'kota');
    panel.querySelectorAll('[data-pero]').forEach(b => { b.hidden = !cary.length; b.setAttribute('aria-pressed', String(cary.length > 0 && cary.every(q => q.pero === b.dataset.pero))); });
    $('btnZrcadlitOsa').hidden = !(N.osaVeVyberu(sel) && sel.length > 1);
  }
  function zmenaVyberem(fn) {
    papir.zapamatuj(); fn(); model.zmena(); obnovVyber(); papir.prekresli();
  }
  function smazVybrane() {
    if (!vybranePrvky().length) return;
    zmenaVyberem(() => { const ids = new Set(model.vybrane); vykres.prvky = vykres.prvky.filter(q => !ids.has(q.id)); model.vybrane = []; });
  }
  function peroVybraneho(pero) {
    const cary = vybranePrvky().filter(q => q.druh !== 'kota' && q.pero !== pero);
    if (cary.length) zmenaVyberem(() => cary.forEach(q => { q.pero = pero; }));
  }
  const sIds = prvky => prvky.map(p => Object.assign({ id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) }, p));
  /** Přidá nové prvky a vybere je. */
  function pridejAVyber(nove) {
    if (!nove.length) return;
    const s = sIds(nove);
    zmenaVyberem(() => { vykres.prvky.push(...s); model.vybrane = s.map(p => p.id); });
    papir.vyber(model.vybrane);
  }
  const OPERACE = {
    kopie: () => pridejAVyber(N.posun(vybranePrvky(), 10, 10)),
    zrcadlitX() {          // ⇋ podle svislé osy přes střed výběru (na místě)
      const sel = vybranePrvky(); if (!sel.length) return;
      const o = N.obalkaPrvku(sel), x = (o[0] + o[2]) / 2, z = N.zrcadli(sel, [x, 0], [x, 1]);
      zmenaVyberem(() => sel.forEach((p, i) => Object.assign(p, z[i], { id: p.id })));
    },
    zrcadlitY() {          // ⇵ podle vodorovné osy přes střed výběru
      const sel = vybranePrvky(); if (!sel.length) return;
      const o = N.obalkaPrvku(sel), y = (o[1] + o[3]) / 2, z = N.zrcadli(sel, [0, y], [1, y]);
      zmenaVyberem(() => sel.forEach((p, i) => Object.assign(p, z[i], { id: p.id })));
    },
    zrcadlitOsa() {        // kopie podle vybrané osy (nakreslit polovinu, druhou dozrcadlit)
      const sel = vybranePrvky(), osa = N.osaVeVyberu(sel);
      if (!osa) { info('Vyberte i osu (čerchovanou úsečku), podle které se má zrcadlit.'); return; }
      pridejAVyber(N.zrcadli(sel.filter(p => p !== osa), [osa.body[0].x, osa.body[0].y], [osa.body[1].x, osa.body[1].y]));
    },
    async pole() {
      const sel = vybranePrvky(); if (!sel.length) return;
      const t = await Dialog.zeptej('Pole kopií: počet ve směru X, počet ve směru Y, rozteč X a rozteč Y v mm (třeba „4 1 15 15“ = 4 kusy po 15 mm vodorovně).', '3 1 20 20');
      if (t == null) return;
      const c = String(t).replace(/,/g, '.').match(/-?\d+(\.\d+)?/g);
      if (!c || c.length < 3) { Dialog.chyba('Napište aspoň 3 čísla: počet X, počet Y a rozteč.'); return; }
      const nx = Math.round(+c[0]), ny = Math.round(+c[1]), dx = +c[2], dy = c.length > 3 ? +c[3] : +c[2];
      if (!(nx >= 1 && ny >= 1 && nx * ny <= 400 && nx * ny > 1)) { Dialog.chyba('Počty musí být 1 až 400 kusů celkem (a víc než jeden).'); return; }
      pridejAVyber(N.pole(sel, nx, ny, dx, dy));
    },
    posun(dx, dy) {
      const sel = vybranePrvky(); if (!sel.length) return;
      const z = N.posun(sel, dx, dy);
      zmenaVyberem(() => sel.forEach((p, i) => Object.assign(p, z[i], { id: p.id })));   // tah i body kóty se posunou s prvkem
    },
  };

  function obnovTlacitka() {
    document.querySelectorAll('[data-nastroj]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.nastroj === nast.nastroj)));
    document.querySelectorAll('[data-kresli-pero]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.kresliPero === nast.pero)));
    document.querySelectorAll('[data-krok]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.krok === nast.krok)));
    const roh = ['zaobleni', 'zkoseni'].includes(nast.nastroj);
    $('btnRoh').setAttribute('aria-pressed', String(roh || ['odsazeni', 'orez'].includes(nast.nastroj)));
    document.querySelectorAll('[data-chyt]').forEach(b => b.setAttribute('aria-pressed', String(nast.chyt[b.dataset.chyt] !== false)));
    $('prepVoditka').setAttribute('aria-pressed', String(nast.voditka !== false));
    $('btnZpet').disabled = !papir.lzeZpet(); $('btnZnovu').disabled = !papir.lzeZnovu();
    $('prepPrichyt').setAttribute('aria-pressed', String(nast.prichyt !== false));
    $('prepSurove').setAttribute('aria-pressed', String(!!nast.surove));
    $('prepVysledek').setAttribute('aria-pressed', String(nast.vysledek !== false));
    $('poleTloustka').hidden = vykres.typ !== 'plochy';
  }
  function nastroj(n) {
    if (n !== 'vyber' && model.vybrane && model.vybrane.length) { model.vybrane = []; obnovVyber(); }
    nast.nastroj = n; ulozNast(); info(''); obnovTlacitka(); papir.nastavKurzor(); papir.prekresli();
  }

  // ------------------------------------------------------------ lišta a nabídky
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
  document.addEventListener('click', e => { if (!e.target.closest('.nabidka')) zavriNabidky(); });

  const PRIKAZY = {
    zpet: () => papir.zpet(),
    znovu: () => papir.znovu(),
    prizpusob: () => papir.prizpusob(),
    priblizit: () => papir.zoom(1.25),
    oddalit: () => papir.zoom(0.8),
    prichyt: () => { nast.prichyt = nast.prichyt === false; ulozNast(); obnovTlacitka(); },
    surove: () => { nast.surove = !nast.surove; ulozNast(); obnovTlacitka(); papir.prekresli(); },
    vysledek: () => { nast.vysledek = nast.vysledek === false; ulozNast(); obnovTlacitka(); papir.prekresli(); },
    voditka: () => { nast.voditka = nast.voditka === false; ulozNast(); obnovTlacitka(); model.verze++; papir.prekresli(); },
    smazatVoditka() {
      if (!vykres.voditka.length) return;
      papir.zapamatuj(); vykres.voditka = []; model.zmena(); papir.prekresli();
    },
    smazatVybrane: smazVybrane,
    rozpoznat() {
      // čáry s uloženým surovým tahem projít znovu rozpoznáním (po vylepšení rozpoznávání nebo se zapnutým přichytáváním)
      const cary = vykres.prvky.filter(p => p.druh !== 'kota' && Array.isArray(p.tah) && p.tah.length > 1);
      if (!cary.length) { info('Žádná čára nemá uložený původní tah (upravené čáry ho ztrácejí).'); return; }
      papir.zapamatuj();
      const hotove = vykres.prvky.filter(p => !cary.includes(p) && p.druh !== 'kota');
      let n = 0;
      vykres.prvky = vykres.prvky.map(p => {
        if (!cary.includes(p)) return p;
        let q = N.rozpoznejTah(p.tah);
        if (q) q = N.prichytPrvek(q, { mrizka: nast.prichyt !== false ? N.MRIZKA : 0, body: N.bodyPrvku(hotove) });
        if (!q) return p;
        const z = Object.assign({ id: p.id, pero: p.pero }, q, { tah: p.tah });
        hotove.push(z); n++;
        return z;
      });
      model.zmena(); papir.prekresli();
      info(`Znovu rozpoznané čáry: ${n}.`);
    },
    panel3d: prepniPanel,
    exportStl: () => exportuj('stl'),
    export3mf: () => exportuj('3mf'),
    doModelare: () => exportuj('modelar'),
    tiskPdf: () => tiskPdf(),
    async smazat() {
      if (!vykres.prvky.length) return;
      if (!await Dialog.potvrd('Smazat celou kresbu? (Jde vrátit tlačítkem Zpět.)')) return;
      papir.zapamatuj(); vykres.prvky = []; model.zmena(); papir.prekresli();
    },
    napoveda: () => $('napoveda').showModal(),
  };
  document.querySelectorAll('[data-prikaz]').forEach(b => b.addEventListener('click', () => { zavriNabidky(); PRIKAZY[b.dataset.prikaz](); }));
  document.querySelectorAll('[data-nastroj]').forEach(b => b.addEventListener('click', () => { zavriNabidky(); nastroj(b.dataset.nastroj); }));
  document.querySelectorAll('[data-kresli-pero]').forEach(b => b.addEventListener('click', () => pero(b.dataset.kresliPero)));
  document.querySelectorAll('[data-krok]').forEach(b => b.addEventListener('click', () => { nast.krok = +b.dataset.krok; ulozNast(); obnovTlacitka(); zavriNabidky(); }));
  document.querySelectorAll('[data-operace]').forEach(b => b.addEventListener('click', () => OPERACE[b.dataset.operace]()));
  // přepínače chytrého přichytávání
  const misto = $('chytVolby');
  for (const [k, popis] of Object.entries(N.VOLBY_PRICHYTU)) {
    const b = document.createElement('button');
    b.className = 'tl prep'; b.dataset.chyt = k; b.textContent = popis;
    b.addEventListener('click', e => { e.stopPropagation(); nast.chyt[k] = nast.chyt[k] === false; ulozNast(); obnovTlacitka(); model.verze++; });
    misto.appendChild(b);
  }

  const KLAVESY = { 4: 'kota', e: 'guma', h: 'posun', v: 'vyber', q: 'ruka', l: 'usecka', o: 'obdelnik', c: 'kruh', d: 'dira', a: 'oblouk', r: 'zaobleni', x: 'zkoseni', p: 'odsazeni', t: 'orez', g: 'voditko', u: 'mereni' };
  const PERA = { 1: 'obrys', 2: 'skryta', 3: 'osa' };
  /** Volba pera; s nekreslicím nástrojem přepne na ruku. */
  function pero(p) {
    nast.pero = p;
    if (['vyber', 'kota', 'guma', 'posun', 'zaobleni', 'zkoseni', 'odsazeni', 'orez', 'voditko', 'mereni'].includes(nast.nastroj)) nastroj('ruka');
    else { ulozNast(); obnovTlacitka(); }
  }
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') zavriNabidky();
    if (e.target.closest && e.target.closest('input, select, textarea, dialog')) return;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); return e.shiftKey ? papir.znovu() : papir.zpet(); }
    if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); return papir.znovu(); }
    if ((e.ctrlKey || e.metaKey) && k === 'd') { e.preventDefault(); return OPERACE.kopie(); }
    if ((e.ctrlKey || e.metaKey) && k === 'a' && nast.nastroj === 'vyber') { e.preventDefault(); return papir.vyber(vykres.prvky.map(p => p.id)); }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const sel = vybranePrvky().length;
    if ((e.key === 'Delete' || e.key === 'Backspace') && sel) { e.preventDefault(); smazVybrane(); }
    else if (sel && e.key.startsWith('Arrow')) {
      e.preventDefault();
      const d = e.shiftKey ? 5 : 1;
      OPERACE.posun(e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0, e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0);
    }
    else if (e.key === 'Escape' && sel) papir.vyber(null);
    else if (PERA[k]) { e.preventDefault(); pero(PERA[k]); }
    else if (KLAVESY[k]) { e.preventDefault(); nastroj(KLAVESY[k]); }
    else if (k === 'f') PRIKAZY.prizpusob();
    else if (k === 'm') prepniPanel();
    else if (k === 'k') { e.preventDefault(); $('btnKoty').click(); const i = $('nabKoty').querySelector('input'); if (i) { i.focus(); i.select(); } }
    else if (k === '+' || k === '=') PRIKAZY.priblizit();
    else if (k === '-') PRIKAZY.oddalit();
    else if (k === 'f1' || k === '?') { e.preventDefault(); PRIKAZY.napoveda(); }
  });

  const selTyp = $('typListu'), selFormat = $('formatListu'), vstTl = $('tloustka');
  for (const [k, t] of Object.entries(N.TYPY_LISTU)) selTyp.add(new Option(t.nazev, k));
  selTyp.value = vykres.typ; selFormat.value = vykres.format;
  vstTl.value = vykres.tloustka != null ? String(vykres.tloustka).replace('.', ',') : '';
  selTyp.onchange = async () => {
    // jiný typ listu má jiné rámečky – kresba by mohla skončit mimo pohledy
    if (vykres.prvky.length && !await Dialog.potvrd('Změnit typ listu? Kresba zůstane, ale rámečky pohledů se změní a čáry mimo ně se nebudou počítat.')) {
      selTyp.value = vykres.typ; return;
    }
    vykres.typ = selTyp.value; model.zmena(); papir.zmenaListu(); obnovTlacitka();
  };
  selFormat.onchange = () => { vykres.format = selFormat.value; model.zmena(); papir.zmenaListu(); };
  vstTl.onchange = () => {
    const v = parseFloat(vstTl.value.replace(',', '.'));
    vykres.tloustka = isFinite(v) && v > 0 ? v : null;
    vstTl.classList.toggle('spatne', vstTl.value.trim() !== '' && vykres.tloustka == null);
    model.zmena(); papir.zmenaPozadi();
  };
  $('btnPdf').onclick = tiskPdf;
  $('napovedaZavrit').onclick = () => $('napoveda').close();
  addEventListener('resize', zavriNabidky);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => papir.zmenaPozadi());
  document.querySelectorAll('[data-pohled3d]').forEach(b => b.addEventListener('click', () => nahled && nahled.pohled(b.dataset.pohled3d)));
  $('panel3d').hidden = !nast.panel3d; $('btn3d').setAttribute('aria-pressed', String(nast.panel3d));
  // three.js a náhled se načítají s defer – po načtení stránky postavit, je-li panel otevřený
  addEventListener('load', () => { if (nast.panel3d) postav(); });
  document.querySelectorAll('#vyberPanel [data-pero]').forEach(b => b.addEventListener('click', () => peroVybraneho(b.dataset.pero)));
  obnovTlacitka(); obnovPruh(); vyloz();

  N.app = { vykres, nast, model, papir, tiskPdf, pdfListu, nastroj, pero, vyloz, postav, prepniPanel, exportuj, OPERACE };
})(N3D);

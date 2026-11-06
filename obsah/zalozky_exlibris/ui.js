/* Záložky do knih a ex libris – ovládání stránky: formulář, písma, náhled, arch, galerie (IndexedDB), výstupy. */
(function () {
  'use strict';
  const ZE = window.ZE, V = window.ZE_VYSTUP, R3 = window.ZE_RAZITKO;
  const $ = id => document.getElementById(id);
  const KLIC = 'webapp_zalozky_exlibris';
  if (window.self === window.top) document.body.classList.add('samostatne');
  const esc = ZE.esc;
  const kopie = o => JSON.parse(JSON.stringify(o));
  const fmt = (x, d = 1) => (Math.round(x * 10 ** d) / 10 ** d).toString().replace('.', ',');

  const PAPIRY = { A4: { w: 210, h: 297 }, A3: { w: 297, h: 420 }, A5: { w: 148, h: 210 }, Letter: { w: 215.9, h: 279.4 }, SRA3: { w: 320, h: 450 } };
  const CITATY = [
    { text: 'Mám-li zahradu a knihovnu, nechybí mi nic.', autor: 'Marcus Tullius Cicero' },
    { text: 'Kniha je zahrada, kterou nosíš v kapse.', autor: 'arabské přísloví' },
    { text: 'Knihy jsou nástroje moudrosti.', autor: 'Jan Amos Komenský' },
    { text: 'Pokoj bez knih je jako tělo bez duše.', autor: 'Marcus Tullius Cicero' },
    { text: 'Čtení je pro ducha tím, čím je cvičení pro tělo.', autor: 'Joseph Addison' },
    { text: 'Vždycky jsem si představoval ráj jako nějakou knihovnu.', autor: 'Jorge Luis Borges' },
    { text: 'Kdo nečte, nežije o nic víc než ten, kdo neumí číst.', autor: 'Mark Twain' },
    { text: 'Dobrá kniha je nejlepší přítel, dnes i navždy.', autor: 'Martin Farquhar Tupper' },
    { text: 'Tady jsem skončil a zítra budu pokračovat.', autor: '' },
  ];
  const TISK_Z = { papir: 'A4', otaceni: 'auto', spadavka: 2, mezera: 4, okraj: 5, dpi: '600', format: 'PNG', znacky: true, obrys: false, oboustranne: true, posunX: 0, posunY: 0 };
  const TISK_E = Object.assign({}, TISK_Z, { spadavka: 0, mezera: 0, oboustranne: false });

  /* ------------------------------------------------------------ stav */
  function vychozi() {
    return { druh: 'zalozka', strana: 'lic', pohled: 'kus', zoom: 1, prep: { kota: true, spadavka: false, rezy: true },
      zalozka: ZE.novaZalozka(), exlibris: ZE.noveExlibris(), tiskZ: kopie(TISK_Z), tiskE: kopie(TISK_E), id: { zalozka: null, exlibris: null }, nazev: { zalozka: '', exlibris: '' } };
  }
  function slouc(zaklad, data) {   // hluboké doplnění chybějících klíčů z výchozího stavu
    if (!data || typeof data !== 'object' || Array.isArray(data)) return zaklad;
    for (const k of Object.keys(data)) {
      if (zaklad[k] && typeof zaklad[k] === 'object' && !Array.isArray(zaklad[k])) zaklad[k] = slouc(zaklad[k], data[k]);
      else if (data[k] !== undefined) zaklad[k] = data[k];
    }
    return zaklad;
  }
  let stav = vychozi();
  try { const t = localStorage.getItem(KLIC); if (t) stav = slouc(vychozi(), JSON.parse(t)); } catch (e) { /* poškozený záznam */ }
  let casUlozeni = 0;
  function ulozStav() { clearTimeout(casUlozeni); casUlozeni = setTimeout(() => { try { localStorage.setItem(KLIC, JSON.stringify(stav)); } catch (e) { /* plné úložiště */ } }, 300); }

  const zal = () => stav.zalozka, exl = () => stav.exlibris;
  const tisk = () => stav.druh === 'zalozka' ? stav.tiskZ : stav.tiskE;
  function koren(pr) { return pr === 'z' ? stav.zalozka : pr === 's' ? stav.zalozka[stav.strana] : pr === 'e' ? stav.exlibris : tisk(); }
  function vezmi(p) { const [pr, ...k] = p.split('.'); return k.reduce((a, x) => (a == null ? a : a[x]), koren(pr)); }
  function poloz(p, v) { const [pr, ...k] = p.split('.'); const l = k.pop(); let o = koren(pr); for (const x of k) { if (o[x] == null || typeof o[x] !== 'object') o[x] = {}; o = o[x]; } o[l] = v; }

  /* ------------------------------------------------------------ IndexedDB: návrhy a obrázky */
  let dbP = null;
  function db() {
    if (!dbP) dbP = new Promise((ok, chyba) => {
      const r = indexedDB.open(KLIC, 1);
      r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains('navrhy')) d.createObjectStore('navrhy', { keyPath: 'id' }); if (!d.objectStoreNames.contains('obrazky')) d.createObjectStore('obrazky', { keyPath: 'id' }); };
      r.onsuccess = () => ok(r.result); r.onerror = () => chyba(r.error);
    });
    return dbP;
  }
  async function dbOp(store, rezim, fn) {
    const d = await db();
    return new Promise((ok, chyba) => {
      const t = d.transaction(store, rezim), s = t.objectStore(store), r = fn(s);
      t.oncomplete = () => ok(r && r.result); t.onerror = () => chyba(t.error);
    });
  }
  const dbVse = s => dbOp(s, 'readonly', x => x.getAll());
  const dbNacti = (s, id) => dbOp(s, 'readonly', x => x.get(id));
  const dbUloz = (s, o) => dbOp(s, 'readwrite', x => x.put(o));
  const dbSmaz = (s, id) => dbOp(s, 'readwrite', x => x.delete(id));
  const noveId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  const obrazky = {};   // id → {url, w, h}
  function idObrazku() {
    const z = zal(), ids = [z.lic.obrazek && z.lic.obrazek.id, z.rub.obrazek && z.rub.obrazek.id, exl().obrazek && exl().obrazek.id];
    return ids.filter(Boolean);
  }
  async function nactiObrazky() {
    for (const id of idObrazku()) if (!obrazky[id]) { try { const o = await dbNacti('obrazky', id); if (o) obrazky[id] = { url: o.url, w: o.w, h: o.h }; } catch (e) { /* bez IndexedDB */ } }
  }

  /* ------------------------------------------------------------ písma */
  const fonty = {}, nacitane = {};
  function pismaPotreba() {
    const s = new Set(['libserif', 'libserifi', 'marcellus', 'pinyon', 'fell']);
    if (stav.druh === 'zalozka') for (const st of [zal().lic, zal().rub]) { s.add(st.pismo); s.add(st.pismo2); }
    else { const e = exl(); s.add(e.pismoNapis); s.add(e.pismoJmeno); s.add(e.pismoMonogram); }
    return [...s].filter(id => ZE.PISMA[id]);
  }
  function nactiPismo(id) {
    if (!nacitane[id]) nacitane[id] = fetch('fonty/' + ZE.PISMA[id].soubor).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then(b => { fonty[id] = opentype.parse(b); }).catch(() => { delete nacitane[id]; });
    return nacitane[id];
  }
  const sazec = async () => { await Promise.all(pismaPotreba().map(nactiPismo)); return ZE.sazec(fonty); };

  /* ------------------------------------------------------------ naplnění voleb */
  const moznosti = (sel, obj, fn) => { $(sel).innerHTML = Object.entries(obj).map(([k, v]) => `<option value="${esc(k)}">${esc(fn ? fn(v) : v)}</option>`).join(''); };
  moznosti('z_rozmer', Object.fromEntries(ZE.ROZMERY_ZALOZKY.map(r => [r.id, r.nazev])));
  moznosti('e_rozmer', Object.fromEntries(ZE.ROZMERY_EXLIBRIS.map(r => [r.id, r.nazev])));
  moznosti('s_sablona', ZE.ZALOZKA_SABLONY);
  for (const id of ['s_pismo', 's_pismo2', 'e_pismoN', 'e_pismoJ', 'e_pismoM']) moznosti(id, ZE.PISMA, p => p.nazev);
  moznosti('s_ramecek', Object.fromEntries(Object.entries(ZE.RAMECKY).filter(([k]) => k !== 'kartus')));
  moznosti('e_ramecek', Object.fromEntries(Object.entries(ZE.RAMECKY).filter(([k]) => k !== 'zadny' && k !== 'kartus')));
  moznosti('s_ozdoba', ZE.OZDOBY);
  moznosti('s_vzor', ZE.VZORY);
  moznosti('e_napis', ZE.NAPISY);
  $('vzorCitat').insertAdjacentHTML('beforeend', CITATY.map((c, i) => `<option value="${i}" data-i18n="ne">${esc(c.text.length > 46 ? c.text.slice(0, 44) + '…' : c.text)}</option>`).join(''));
  $('palety').innerHTML = Object.entries(ZE.PALETY).map(([k, p]) => `<button type="button" class="paleta" data-paleta="${k}" title="${esc(p.nazev)}" aria-label="${esc(p.nazev)}"><span style="background:${p.papir}"></span><span style="background:${p.inkoust}"></span><span style="background:${p.akcent}"></span></button>`).join('');
  $('tiskBarvy').innerHTML = Object.entries(ZE.TISKOVE_BARVY).map(([c, nz]) => `<button type="button" data-tbarva="${c}" style="background:${c}" title="${esc(nz)}" aria-label="${esc(nz)}"></button>`).join('');
  const PAL_NAHLED = { papir: '#fbf7ee', inkoust: '#1f2a36', akcent: '#a8823c' };
  $('eSymbol').innerHTML = Object.entries(ZE.SYMBOLY).map(([k, nz]) => `<button type="button" class="vyber" data-symbol="${k}"><svg viewBox="0 0 100 100">${ZE.symbol(k, 50, 50, 92, PAL_NAHLED).map(p => p.s).join('')}</svg><span>${esc(nz)}</span></button>`).join('');

  /* ------------------------------------------------------------ formulář */
  function naplnFormular() {
    document.querySelectorAll('#panel [data-p]').forEach(el => {
      const v = vezmi(el.dataset.p);
      if (el.type === 'checkbox') el.checked = !!v;
      else if (document.activeElement !== el) el.value = v == null ? '' : String(v);
    });
    const z = zal(), st = z[stav.strana], e = exl(), t = tisk();
    const jeZ = stav.druh === 'zalozka';
    $('formZalozka').hidden = !jeZ; $('formExlibris').hidden = jeZ;
    document.querySelectorAll('[data-druh]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.druh === stav.druh)));
    document.querySelectorAll('[data-pohled]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.pohled === stav.pohled)));
    document.querySelectorAll('[data-prep]').forEach(b => b.setAttribute('aria-pressed', String(!!stav.prep[b.dataset.prep])));
    document.querySelectorAll('[data-strana]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.strana === stav.strana)));
    document.querySelectorAll('[data-paleta]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.paleta === z.paleta)));
    document.querySelectorAll('[data-pro]').forEach(el => { el.hidden = !el.dataset.pro.split(' ').includes(st.sablona); });
    $('zVlastni').hidden = z.rozmer !== 'vlastni';
    $('zOtvor').hidden = !(z.otvor && z.otvor.pouzit);
    $('zKryti').hidden = !(st.obrazek && st.obrazek.umisteni === 'pozadi');
    $('lText').textContent = { citat: 'Citát', kniha: 'Název knihy', minimal: 'Krátký text dole', ramecek: 'Text uprostřed', vzor: 'Text na štítku' }[st.sablona] || 'Text';
    $('lAutor').textContent = { citat: 'Autor', kniha: 'Autor', minimal: 'Popisek nahoře', ramecek: 'Podpis pod textem', vzor: 'Podtitul' }[st.sablona] || 'Autor';
    $('lZdroj').textContent = st.sablona === 'kniha' ? 'Doplněk (rok, edice…)' : 'Dílo (kurzívou)';
    $('seedInfo').textContent = 'varianta ' + st.seed;
    $('btnKopie').textContent = stav.strana === 'lic' ? '⧉ Zkopírovat na rub' : '⧉ Zkopírovat na líc';
    // ex libris
    $('eVlastniNapis').hidden = e.napis !== 'vlastni';
    $('eGenitiv').hidden = !(e.napis === 'zknih' || e.napis === 'zknihovny');
    $('genNavrh').textContent = ZE.genitiv(e.jmeno) || '—';
    $('e_jmeno2').placeholder = ZE.genitiv(e.jmeno);
    $('e_inic').placeholder = ZE.inicialy(e.jmeno);
    $('eVlastni').hidden = e.rozmer !== 'vlastni';
    $('eRamecek').hidden = e.kompozice !== 'ramecek' && e.kompozice !== 'erb';
    $('eMonogram').hidden = e.stred !== 'monogram'; $('eSymbol').hidden = e.stred !== 'symbol'; $('eObrazek').hidden = e.stred !== 'obrazek';
    $('eAkcent').hidden = !e.dvoubarevne;
    document.querySelectorAll('[data-stred]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.stred === e.stred)));
    document.querySelectorAll('[data-symbol]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.symbol === e.symbol)));
    document.querySelectorAll('[data-komp]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.komp === e.kompozice)));
    document.querySelectorAll('[data-mono]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mono === e.monogram)));
    document.querySelectorAll('[data-tbarva]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tbarva.toLowerCase() === String(e.barvy.inkoust).toLowerCase())));
    $('tOboustranne').hidden = !jeZ;
    $('mnRazitko').disabled = jeZ;
    $('mnRazitko').title = jeZ ? 'Jen pro ex libris' : '';
    // souhrny
    const r = jeZ ? ZE.rozmerZalozky(z) : ZE.rozmerExlibris(e);
    $('sRozmer').textContent = `${fmt(r.w)} × ${fmt(r.h)} mm` + (z.otvor.pouzit ? ` · ⌀ ${fmt(z.otvor.prumer)}` : '');
    $('sBarvy').textContent = (ZE.PALETY[z.paleta] || { nazev: 'vlastní' }).nazev;
    $('sStrana').textContent = (stav.strana === 'lic' ? 'líc' : 'rub') + ' · ' + ZE.ZALOZKA_SABLONY[st.sablona];
    $('sNapis').textContent = ZE.textyExlibris(e).nahore + ' · ' + (e.jmeno || '');
    $('sKomp').textContent = ZE.KOMPOZICE[e.kompozice] + ` · ${fmt(r.w)} × ${fmt(r.h)} mm`;
    $('sStred').textContent = e.stred === 'symbol' ? ZE.SYMBOLY[e.symbol] : e.stred === 'monogram' ? (e.inicialy || ZE.inicialy(e.jmeno)) : e.stred === 'obrazek' ? 'obrázek' : '—';
    $('sEBarvy').textContent = e.dvoubarevne ? 'dvoubarevně' : 'jednobarevně';
    $('sTisk').textContent = `${t.papir} · ${t.dpi} DPI`;
  }
  async function nahledyMonogramu() {
    const S = await sazec(), e = exl(), inic = e.inicialy || ZE.inicialy(e.jmeno) || 'AB';
    $('monogramy').innerHTML = Object.entries(ZE.MONOGRAMY).map(([k, nz]) => `<button type="button" class="vyber" data-mono="${k}"><svg viewBox="0 0 100 100">${ZE.monogram(inic, k, 50, 50, 86, PAL_NAHLED, S, { pismo: e.pismoMonogram }).map(p => p.s).join('')}</svg><span>${esc(nz)}</span></button>`).join('');
    const vz = Object.assign(kopie(e), { stred: 'symbol', symbol: e.symbol || 'sova', jmeno: e.jmeno || 'Jan Novák', rozmer: '60x80' });
    $('kompozice').innerHTML = Object.entries(ZE.KOMPOZICE).map(([k, nz]) => {
      const x = Object.assign(kopie(vz), { kompozice: k, rozmer: k === 'pecet' ? '60x60' : '60x80' }, { dvoubarevne: true, barvy: PAL_NAHLED });
      return `<button type="button" class="vyber" data-komp="${k}">${ZE.svg(ZE.kresliExlibris(x, S, {}), { id: 'k' + k }).replace(/width="[^"]+" height="[^"]+"/, '')}<span>${esc(nz)}</span></button>`;
    }).join('');
    naplnFormular();
  }

  /* ------------------------------------------------------------ náhled */
  let token = 0, posledni = null;
  async function prekresli() {
    const muj = ++token;
    await nactiObrazky();
    const S = await sazec();
    if (muj !== token) return;
    const t = tisk(), b = +t.spadavka || 0;
    const pl = $('plocha'), uzky = innerWidth <= 760, vyskaPlochy = uzky ? Math.min(innerHeight * 0.7, 520) : Math.max(300, pl.clientHeight - 110), sirkaPlochy = Math.max(260, pl.clientWidth - 40);
    let varovani = [];
    if (stav.druh === 'zalozka') {
      const z = zal(), kL = ZE.kresliZalozku(z, 'lic', S, obrazky), kR = ZE.kresliZalozku(z, 'rub', S, obrazky);
      posledni = { lic: kL, rub: kR };
      varovani = [...kL.varovani.map(v => 'Líc: ' + v), ...kR.varovani.map(v => 'Rub: ' + v)];
      if (stav.pohled === 'kus') {
        const hh = kL.h + (stav.prep.spadavka ? 2 * b : 0), ww = kL.w + (stav.prep.spadavka ? 2 * b : 0);
        const mer = Math.min(vyskaPlochy / hh, (sirkaPlochy - 40) / (2 * ww), 12) * stav.zoom;
        const kus = (k, strana) => {
          const svg = ZE.svg(k, stav.prep.spadavka ? { spadavka: b, otvor: stav.prep.kota ? 'kota' : 'znacka', obrys: true, id: strana } : { orez: true, otvor: stav.prep.kota ? 'kota' : null, id: strana })
            .replace(/width="[^"]+" height="[^"]+"/, `width="${Math.round(ww * mer)}" height="${Math.round(hh * mer)}"`);
          return `<div class="kus"><div class="obal${stav.strana === strana ? ' aktivni' : ''}" data-vyber-strana="${strana}" title="Upravit ${strana === 'lic' ? 'líc' : 'rub'}">${svg}</div><span class="stitek">${strana === 'lic' ? 'Líc' : 'Rub'}</span></div>`;
        };
        $('pohledKus').innerHTML = `<div class="zalozky">${kus(kL, 'lic')}${kus(kR, 'rub')}</div>` +
          `<p class="info">${fmt(kL.w)} × ${fmt(kL.h)} mm` + (kL.otvor ? ` · otvor na střapec ⌀ ${fmt(kL.otvor.r * 2)} mm, střed ${fmt(kL.otvor.cy)} mm od horní hrany` : '') + '</p>' +
          (varovani.length ? `<p class="varovani">⚠ ${varovani.map(esc).join('<br>⚠ ')}</p>` : '');
      }
    } else {
      const e = exl(), k = ZE.kresliExlibris(e, S, obrazky);
      posledni = { lic: k };
      varovani = k.varovani;
      if (stav.pohled === 'kus') {
        const hh = k.h + (stav.prep.spadavka ? 2 * b : 0), ww = k.w + (stav.prep.spadavka ? 2 * b : 0);
        const mer = Math.min(vyskaPlochy / hh, sirkaPlochy / ww, 9) * stav.zoom;
        const svg = ZE.svg(k, stav.prep.spadavka ? { spadavka: b, obrys: true, id: 'ex' } : { orez: true, id: 'ex' })
          .replace(/width="[^"]+" height="[^"]+"/, `width="${Math.round(ww * mer)}" height="${Math.round(hh * mer)}"`);
        $('pohledKus').innerHTML = `<div class="zalozky"><div class="kus"><div class="obal">${svg}</div></div></div><p class="info">${fmt(k.w)} × ${fmt(k.h)} mm · ${e.dvoubarevne ? 'dvoubarevně' : 'jednobarevně'}${e.tiskPozadi ? '' : ' · barva papíru se netiskne'}</p>` +
          (varovani.length ? `<p class="varovani">⚠ ${varovani.map(esc).join('<br>⚠ ')}</p>` : '');
      }
    }
    $('pohledKus').hidden = stav.pohled !== 'kus'; $('pohledArch').hidden = stav.pohled !== 'arch';
    if (stav.pohled === 'arch') kresliArch(sirkaPlochy, vyskaPlochy);
    $('tiskSouhrn').textContent = souhrnTisku();
  }
  function rozvrh() {
    const t = tisk(), k = posledni.lic;
    return ZE.rozvrh({ papir: PAPIRY[t.papir] || PAPIRY.A4, kus: { w: k.w, h: k.h }, spadavka: +t.spadavka || 0, mezera: +t.mezera || 0, okraj: +t.okraj, znacky: !!t.znacky, otaceni: t.otaceni });
  }
  const bezPozadi = () => stav.druh === 'exlibris' && !exl().tiskPozadi;
  function svgProTisk(kus) { return ZE.svg(kus, { spadavka: +tisk().spadavka || 0, otvor: 'znacka', bezPozadi: bezPozadi(), id: 't' + Math.random().toString(36).slice(2, 6) }); }
  function souhrnTisku() {
    if (!posledni) return '';
    const R = rozvrh();
    if (!R.pocet) return 'Kus se na zvolený papír nevejde – zmenšete okraje nebo zvolte větší papír.';
    return `Na arch ${tisk().papir} se vejde ${R.pocet} ks (${R.sloupcu} × ${R.radku}${R.otoceny ? ', otočené o 90°' : ''}).`;
  }
  function kresliArch(sw, sh) {
    const R = rozvrh(), t = tisk();
    if (!R.pocet) { $('pohledArch').innerHTML = `<p class="varovani">${esc(souhrnTisku())}</p>`; return; }
    const sirka = Math.min(sw, sh * R.papir.w / R.papir.h) * stav.zoom;
    let h = `<div class="arch" style="width:${Math.round(sirka)}px">${V.archSvg(R, svgProTisk(posledni.lic), { rezy: stav.prep.rezy })}</div>`;
    h += `<p class="archinfo">${esc(souhrnTisku())} Spadávka ${fmt(R.spadavka)} mm, mezera ${fmt(R.mezera)} mm. Modrá čárkovaná = okraj tiskárny${stav.prep.rezy ? ', červená = řez' : ''}.</p>`;
    if (stav.druh === 'zalozka' && t.oboustranne) {
      h += `<div class="arch" style="width:${Math.round(sirka)}px">${V.archSvg(R, svgProTisk(posledni.rub), { rub: true, posun: { x: +t.posunX || 0, y: +t.posunY || 0 }, rezy: stav.prep.rezy })}</div>`;
      h += '<p class="archinfo">2. strana – rub (při pohledu na potištěnou stranu jsou kusy zrcadlově rozmístěné).</p>';
    }
    $('pohledArch').innerHTML = h;
  }
  let snimek = 0;
  function zmena(bezFormulare) { ulozStav(); if (!bezFormulare) naplnFormular(); cancelAnimationFrame(snimek); snimek = requestAnimationFrame(() => prekresli().catch(chybaKresleni)); }
  const chybaKresleni = e => { console.error(e); Dialog.chyba('Náhled se nepodařilo vykreslit: ' + e.message); };

  /* ------------------------------------------------------------ události formuláře */
  $('panel').addEventListener('input', e => {
    const el = e.target.closest('[data-p]'); if (!el) return;
    let v = el.type === 'checkbox' ? el.checked : (el.type === 'number' || el.type === 'range') ? parseFloat(String(el.value).replace(',', '.')) : el.value;
    if ((el.type === 'number' || el.type === 'range') && !Number.isFinite(v)) return;
    poloz(el.dataset.p, v);
    if (el.dataset.p.startsWith('z.barvy.')) zal().paleta = 'vlastni';
    if (el.dataset.p === 'z.rozmer' || el.dataset.p === 'e.rozmer') {
      const sez = el.dataset.p === 'z.rozmer' ? ZE.ROZMERY_ZALOZKY : ZE.ROZMERY_EXLIBRIS, r = sez.find(x => x.id === v && x.w), o = el.dataset.p[0] === 'z' ? zal() : exl();
      if (r) { o.sirka = r.w; o.vyska = r.h; }
    }
    if (el.dataset.p === 'e.inicialy' || el.dataset.p === 'e.pismoMonogram' || (el.dataset.p === 'e.jmeno' && !exl().inicialy)) nahledyMonogramu();
    zmena(el.tagName === 'TEXTAREA' || el.type === 'text');
    if (el.tagName === 'TEXTAREA' || el.type === 'text') naplnFormular();
  });
  $('panel').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.strana) { stav.strana = b.dataset.strana; zmena(); }
    else if (b.dataset.paleta) { const z = zal(); z.paleta = b.dataset.paleta; const p = ZE.PALETY[b.dataset.paleta]; z.barvy = { papir: p.papir, inkoust: p.inkoust, akcent: p.akcent }; zmena(); }
    else if (b.dataset.tbarva) { exl().barvy.inkoust = b.dataset.tbarva; zmena(); }
    else if (b.dataset.stred) { exl().stred = b.dataset.stred; if (b.dataset.stred === 'obrazek' && !(exl().obrazek && obrazky[exl().obrazek.id])) $('souborObr').click(); zmena(); }
    else if (b.dataset.symbol) { exl().symbol = b.dataset.symbol; zmena(); }
    else if (b.dataset.komp) { const e2 = exl(); e2.kompozice = b.dataset.komp; if (b.dataset.komp === 'pecet' && e2.rozmer !== 'vlastni' && e2.rozmer !== '60x60') { e2.rozmer = '60x60'; e2.sirka = e2.vyska = 60; } zmena(); }
    else if (b.dataset.mono) { exl().monogram = b.dataset.mono; zmena(); }
  });
  $('vzorCitat').addEventListener('change', e => {
    const c = CITATY[+e.target.value]; e.target.value = '';
    if (!c) return;
    const st = zal()[stav.strana]; st.text = c.text; st.autor = c.autor; st.zdroj = ''; zmena();
  });
  $('plocha').addEventListener('click', e => {
    const o = e.target.closest('[data-vyber-strana]');
    if (o && o.dataset.vyberStrana !== stav.strana) { stav.strana = o.dataset.vyberStrana; zmena(); }
  });
  document.querySelectorAll('[data-druh]').forEach(b => b.addEventListener('click', () => prepniDruh(b.dataset.druh)));
  document.querySelectorAll('[data-pohled]').forEach(b => b.addEventListener('click', () => { stav.pohled = b.dataset.pohled; zmena(); }));
  document.querySelectorAll('[data-prep]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); stav.prep[b.dataset.prep] = !stav.prep[b.dataset.prep]; zmena(); }));
  function prepniDruh(d) { if (stav.druh === d) return; stav.druh = d; zmena(); if (d === 'exlibris') nahledyMonogramu(); }

  /* ------------------------------------------------------------ nabídky lišty */
  function zavriNabidky() {
    document.querySelectorAll('.nabidka:not([hidden])').forEach(x => { x.hidden = true; });
    document.querySelectorAll('[data-nabidka][aria-expanded="true"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
  }
  document.querySelectorAll('[data-nabidka]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    const x = $(b.dataset.nabidka), bylo = !x.hidden;
    zavriNabidky();
    if (bylo) return;
    x.hidden = false; b.setAttribute('aria-expanded', 'true');
    const r = b.getBoundingClientRect();
    x.style.top = (r.bottom + 4) + 'px';
    x.style.left = Math.max(6, Math.min(r.left, innerWidth - x.offsetWidth - 6)) + 'px';
  }));
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-prikaz]');
    if (b && !b.disabled) { e.stopPropagation(); zavriNabidky(); const p = PRIKAZY[b.dataset.prikaz]; if (p) p(); return; }
    if (!e.target.closest('.nabidka')) zavriNabidky();
  });
  addEventListener('resize', () => { zavriNabidky(); zmena(true); });
  document.querySelectorAll('dialog [data-zavrit]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));

  /* ------------------------------------------------------------ příkazy */
  const nazevKusu = () => {
    if (stav.druh === 'exlibris') return 'Ex libris ' + (exl().jmeno || '');
    const st = zal().lic; return (st.text || 'Záložka').split(/\s+/).slice(0, 5).join(' ');
  };
  async function nahledPng() {
    const k = posledni && posledni.lic; if (!k) return '';
    const dpi = Math.min(260 / k.h, 200 / k.w) * 25.4;   // náhled do galerie: nejvýš 260 px na výšku
    const c = await V.rastr(ZE.svg(k, { orez: true }), k.w, k.h, dpi);
    return c.toDataURL('image/png');
  }
  async function ulozit(jakoNovy) {
    const d = stav.druh;
    let id = stav.id[d], nazev = stav.nazev[d];
    if (!id || jakoNovy) {
      const n = await Dialog.zeptej('Název návrhu', nazevKusu().trim(), { ok: 'Uložit' });
      if (n == null) return;
      nazev = n.trim() || nazevKusu(); id = noveId();
    }
    try {
      await prekresli();
      await dbUloz('navrhy', { id, nazev, druh: d, data: kopie(d === 'zalozka' ? zal() : exl()), nahled: await nahledPng(), upraveno: Date.now() });
      stav.id[d] = id; stav.nazev[d] = nazev; ulozStav();
      Dialog.info(`Uloženo do galerie: ${nazev}`);
    } catch (e) { Dialog.chyba('Uložení se nepovedlo: ' + e.message); }
  }
  async function galerie() {
    let vse = [];
    try { vse = (await dbVse('navrhy')).sort((a, b) => b.upraveno - a.upraveno); } catch (e) { Dialog.chyba('Galerie není dostupná: ' + e.message); return; }
    const G = $('galerie');
    G.innerHTML = vse.length ? vse.map(x => `<div class="karta"><img src="${x.nahled || ''}" alt="" data-o="${x.id}" title="Otevřít">` +
      `<span class="jm" data-i18n="ne" title="${esc(x.nazev)}">${x.druh === 'zalozka' ? '🔖' : '🏷'} ${esc(x.nazev)}</span><span class="dt">${new Date(x.upraveno).toLocaleDateString('cs-CZ')}</span>` +
      `<div class="radek-tl"><button class="tl mini" data-o="${x.id}">Otevřít</button><button class="tl mini" data-d="${x.id}" title="Duplikovat" aria-label="Duplikovat">⧉</button><button class="tl mini" data-p="${x.id}" title="Přejmenovat" aria-label="Přejmenovat">✎</button><button class="tl mini" data-s="${x.id}" title="Smazat" aria-label="Smazat">🗑</button></div></div>`).join('')
      : '<p class="prazdne">Zatím nic uloženého. Návrh uložíte přes Soubor → Uložit do galerie (Ctrl+S).</p>';
    if (!$('dlgGalerie').open) $('dlgGalerie').showModal();
    G.onclick = async e => {
      const b = e.target.closest('[data-o],[data-d],[data-p],[data-s]'); if (!b) return;
      const x = vse.find(v => v.id === (b.dataset.o || b.dataset.d || b.dataset.p || b.dataset.s));
      if (b.dataset.o) {
        const zaklad = x.druh === 'zalozka' ? ZE.novaZalozka() : ZE.noveExlibris();
        stav[x.druh] = slouc(zaklad, kopie(x.data)); stav.druh = x.druh; stav.id[x.druh] = x.id; stav.nazev[x.druh] = x.nazev;
        $('dlgGalerie').close(); zmena(); if (x.druh === 'exlibris') nahledyMonogramu();
      } else if (b.dataset.d) { await dbUloz('navrhy', Object.assign(kopie(x), { id: noveId(), nazev: x.nazev + ' (kopie)', upraveno: Date.now() })); galerie(); }
      else if (b.dataset.p) { const n = await Dialog.zeptej('Nový název', x.nazev, { ok: 'Přejmenovat' }); if (n && n.trim()) { x.nazev = n.trim(); await dbUloz('navrhy', x); if (stav.id[x.druh] === x.id) stav.nazev[x.druh] = x.nazev; galerie(); } }
      else if (b.dataset.s) { if (await Dialog.potvrd(`Smazat návrh „${x.nazev}“?`, { ok: 'Smazat' })) { await dbSmaz('navrhy', x.id); if (stav.id[x.druh] === x.id) stav.id[x.druh] = null; galerie(); } }
    };
  }
  async function zalohaVen() {
    const navrhy = await dbVse('navrhy'), obr = await dbVse('obrazky');
    const pouzite = new Set(navrhy.flatMap(x => [x.data.lic && x.data.lic.obrazek && x.data.lic.obrazek.id, x.data.rub && x.data.rub.obrazek && x.data.rub.obrazek.id, x.data.obrazek && x.data.obrazek.id]).filter(Boolean));
    V.stahni(JSON.stringify({ format: KLIC, verze: 1, navrhy, obrazky: obr.filter(o => pouzite.has(o.id)) }), 'zalozky_exlibris_zaloha.json', 'application/json');
  }
  $('souborZaloha').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try {
      const o = JSON.parse(await f.text());
      if (!o || o.format !== KLIC || !Array.isArray(o.navrhy)) throw new Error('soubor není záloha této stránky');
      for (const x of o.obrazky || []) if (x && x.id && x.url) await dbUloz('obrazky', x);
      let pocet = 0;
      for (const x of o.navrhy) if (x && x.id && x.data && (x.druh === 'zalozka' || x.druh === 'exlibris')) { await dbUloz('navrhy', x); pocet++; }
      Dialog.info(`Obnoveno návrhů: ${pocet}`);
      galerie();
    } catch (err) { Dialog.chyba('Zálohu nelze načíst: ' + err.message); }
  });

  async function exportSvg() {
    if (!posledni) return;
    const k = stav.druh === 'zalozka' ? posledni[stav.strana] : posledni.lic;
    const svg = ZE.svg(k, { bezPozadi: bezPozadi() });
    V.stahni(svg, V.jmenoSouboru(nazevKusu()) + (stav.druh === 'zalozka' ? '_' + stav.strana : '') + '.svg', 'image/svg+xml');
  }
  async function exportPng() {
    if (!posledni) return;
    const k = stav.druh === 'zalozka' ? posledni[stav.strana] : posledni.lic, t = tisk(), b = +t.spadavka || 0;
    const c = await V.rastr(ZE.svg(k, { spadavka: b, bezPozadi: bezPozadi() }), k.w + 2 * b, k.h + 2 * b, +t.dpi || 300);
    c.toBlob(bl => V.stahni(bl, V.jmenoSouboru(nazevKusu()) + (stav.druh === 'zalozka' ? '_' + stav.strana : '') + `_${t.dpi}dpi.png`), 'image/png');
  }
  let pdfBezi = false;
  async function exportPdf() {
    if (pdfBezi || !posledni) return;
    const R = rozvrh(), t = tisk();
    if (!R.pocet) { Dialog.chyba(souhrnTisku()); return; }
    pdfBezi = true;
    Dialog.info('Připravuji PDF…');
    try {
      const k = posledni.lic, jeZ = stav.druh === 'zalozka';
      const popis = `${nazevKusu().trim()} · ${R.pocet} ks · ${fmt(k.w)} × ${fmt(k.h)} mm` + (R.spadavka ? ` · spadávka ${fmt(R.spadavka)} mm` : '') +
        (jeZ && k.otvor ? ` · otvor ⌀ ${fmt(k.otvor.r * 2)} mm` : '') + ' · tiskněte v měřítku 100 %';
      const doc = await V.pdf(svgProTisk(k), jeZ && t.oboustranne ? svgProTisk(posledni.rub) : null, R,
        { dpi: +t.dpi || 600, format: t.format, popis, posun: { x: +t.posunX || 0, y: +t.posunY || 0 }, obrys: !!t.obrys });
      doc.save(V.jmenoSouboru(nazevKusu()) + '_arch.pdf');
    } catch (e) { Dialog.chyba('PDF se nepodařilo vytvořit: ' + e.message); }
    finally { pdfBezi = false; }
  }

  /* 3D razítko */
  let posledniRazitko = null;
  function prepoctiRazitko() {
    try {
      const k = posledni.lic, sir = Math.min(150, Math.max(15, parseFloat($('r_sirka').value) || 40));
      posledniRazitko = R3.naRazitko(k, { sirka: sir, zrcadlit: $('r_zrcadlit').checked });
      const r = posledniRazitko;
      $('r_info').textContent = `motiv ${fmt(r.motivSirka)} × ${fmt(r.motivVyska)} mm · ${r.obrysu} obrysů · ${fmt(r.svg.length / 1024, 0)} kB`;
      $('r_varovani').textContent = r.varovani.length ? '⚠ ' + r.varovani.join(' ⚠ ') : '';
    } catch (e) { posledniRazitko = null; $('r_info').textContent = ''; $('r_varovani').textContent = '⚠ ' + e.message; }
  }
  function razitko() {
    if (stav.druh !== 'exlibris') { Dialog.info('3D razítko se vyrábí z ex libris – přepněte na Ex libris.'); return; }
    if (!R3 || !globalThis.MDL || !globalThis.ClipperLib) { Dialog.chyba('Převod na razítko se nenačetl.'); return; }
    $('dlgRazitko').showModal();
    prepoctiRazitko();
  }
  $('r_sirka').addEventListener('input', prepoctiRazitko);
  $('r_zrcadlit').addEventListener('change', prepoctiRazitko);
  $('r_svg').addEventListener('click', () => { if (posledniRazitko) V.stahni(posledniRazitko.svg, V.jmenoSouboru(nazevKusu()) + ($('r_zrcadlit').checked ? '_zrcadlove' : '') + '_razitko.svg', 'image/svg+xml'); });
  $('r_projekt').addEventListener('click', () => {
    if (!posledniRazitko) return;
    if ($('r_zrcadlit').checked) { Dialog.info('Pro stránku Razítko vypněte zrcadlení – Razítko zrcadlí samo.'); return; }
    V.stahni(R3.projektRazitka(posledniRazitko, nazevKusu().trim(), { kulate: exl().kompozice === 'pecet' }), V.jmenoSouboru(nazevKusu()) + '_razitko.json', 'application/json');
  });

  /* obrázek */
  $('souborObr').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try {
      const url = await new Promise((ok, chyba) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => chyba(r.error); r.readAsDataURL(f); });
      const img = await new Promise((ok, chyba) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => chyba(new Error('neznámý formát obrázku')); i.src = url; });
      const k = Math.min(1, 2000 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const pruhledny = /png|webp|gif|svg/.test(f.type);
      const data = pruhledny ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.9);
      const id = noveId();
      obrazky[id] = { url: data, w: c.width, h: c.height };
      try { await dbUloz('obrazky', { id, url: data, w: c.width, h: c.height, nazev: f.name }); } catch (err) { Dialog.chyba('Obrázek se nepodařilo uložit, po obnovení stránky zmizí.'); }
      if (stav.druh === 'zalozka') { const st = zal()[stav.strana]; st.obrazek = Object.assign({}, st.obrazek, { id }); if (st.obrazek.umisteni === 'zadne') st.obrazek.umisteni = st.sablona === 'vzor' ? 'pozadi' : 'nahore'; }
      else { exl().obrazek = { id }; exl().stred = 'obrazek'; }
      zmena();
    } catch (err) { Dialog.chyba('Obrázek nelze načíst: ' + err.message); }
  });

  /* text ze souboru a z knih */
  function nabidniVety(md, zdroj, autor) {
    const st = zal()[stav.strana];
    const vety = ZE.vetyZTextu(md);
    const O = $('knihyObsah');
    if (!vety.length) { O.innerHTML = '<p class="prazdne">V textu nejsou vhodné věty (25–260 znaků).</p>'; return; }
    O.innerHTML = `<p class="pozn">Vyberte větu na záložku (${vety.length}). Text pak můžete upravit.</p><input type="search" id="hledatVetu" class="tl" placeholder="🔍 Hledat ve větách…" aria-label="Hledat ve větách"><div class="vety" id="vety"></div>`;
    const vypis = q => {
      const f = q ? vety.filter(v => v.toLowerCase().includes(q.toLowerCase())) : vety;
      $('vety').innerHTML = f.slice(0, 400).map(v => `<button class="tl" data-veta="${esc(v)}" data-i18n="ne">${esc(v)}</button>`).join('') || '<p class="prazdne">Nic nenalezeno.</p>';
    };
    vypis('');
    $('hledatVetu').addEventListener('input', e => vypis(e.target.value));
    $('vety').onclick = e => {
      const b = e.target.closest('[data-veta]'); if (!b) return;
      st.text = b.dataset.veta; if (zdroj) st.zdroj = zdroj; st.autor = autor || st.autor || '';
      if (st.sablona !== 'citat' && st.sablona !== 'ramecek') st.sablona = 'citat';
      $('dlgKnihy').close(); zmena();
    };
  }
  $('souborText').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    const text = await f.text(), st = zal()[stav.strana];
    if (text.trim().length <= 300 && !text.includes('\n\n')) { st.text = text.trim(); zmena(); return; }
    $('dlgKnihy').showModal();
    nabidniVety(text, f.name.replace(/\.(md|txt)$/i, '').replace(/_/g, ' '), '');
  });
  async function zKnih() {
    const D = $('dlgKnihy'), O = $('knihyObsah'), st = zal()[stav.strana];
    D.showModal();
    O.innerHTML = '<p class="pozn">Načítám…</p>';
    const json = async u => { const r = await fetch(u); if (!r.ok) throw new Error(r.status); return r.json(); };
    const txt = async u => { const r = await fetch(u); if (!r.ok) throw new Error(r.status); return r.text(); };
    let h = `<p class="pozn">${st.sablona === 'kniha' ? 'Kliknutím na knihu se doplní název a autor.' : 'Kliknutím na knihu nebo kapitolu vyberete větu jako citát.'}</p><div class="knihy">`;
    let moje = [], dila = [];
    try {
      moje = (await json('../moje_knihy/seznam.json')).knihy || [];
      h += '<h3>Moje knihy</h3>' + moje.map((k, i) => `<div class="kn"><button class="tl" data-mk="${i}">📖 <span data-i18n="ne">${esc(k.nazev)}</span></button></div>`).join('');
    } catch (e) { h += '<p class="pozn">Moje knihy se nepodařilo načíst.</p>'; }
    try {
      for (const d of await json('knihy/dila.json')) {
        const knihy = await json(d.data + 'knihy.json');
        dila.push({ d, knihy });
        h += `<h3>${esc(d.ikona || '📚')} <span data-i18n="ne">${esc(d.nazev)}</span></h3>` + knihy.map((k, ki) =>
          `<details class="kn"><summary><span data-i18n="ne">${esc(k.nazev)}</span></summary><div class="radek-tl">` +
          (st.sablona === 'kniha' ? `<button class="tl mini" data-kn="${dila.length - 1}|${ki}">Použít název</button>` : '') +
          k.kapitoly.map((c, ci) => `<button class="tl mini" data-kr="${dila.length - 1}|${ki}|${ci}" data-i18n="ne">${esc(c.nazev)}</button>`).join('') + '</div></details>').join('');
      }
    } catch (e) { h += '<p class="pozn">Kroniky se nepodařilo načíst.</p>'; }
    O.innerHTML = h + '</div>';
    O.onclick = async e => {
      const b = e.target.closest('button'); if (!b) return;
      try {
        if (b.dataset.mk !== undefined) {
          const k = moje[+b.dataset.mk];
          if (st.sablona === 'kniha') { st.text = k.nazev; st.autor = k.autor || st.autor || ''; D.close(); zmena(); return; }
          O.innerHTML = '<p class="pozn">Načítám…</p>';
          const texty = await Promise.all(k.soubory.map(s => txt('../moje_knihy/' + s)));
          nabidniVety(texty.join('\n\n'), k.nazev, k.autor || '');
        } else if (b.dataset.kn) {
          const [di, ki] = b.dataset.kn.split('|').map(Number);
          st.text = dila[di].knihy[ki].nazev; st.zdroj = dila[di].d.nazev; D.close(); zmena();
        } else if (b.dataset.kr) {
          const [di, ki, ci] = b.dataset.kr.split('|').map(Number), { d, knihy } = dila[di], k = knihy[ki];
          O.innerHTML = '<p class="pozn">Načítám…</p>';
          nabidniVety(await txt(d.data + k.id + '/' + k.kapitoly[ci].soubor), k.nazev, '');
        }
      } catch (err) { Dialog.chyba('Načtení se nepovedlo: ' + err.message); }
    };
  }

  const PRIKAZY = {
    novy: async () => {
      if (!await Dialog.potvrd(stav.druh === 'zalozka' ? 'Začít novou záložku? Neuložené změny se ztratí.' : 'Začít nové ex libris? Neuložené změny se ztratí.', { ok: 'Nový' })) return;
      if (stav.druh === 'zalozka') stav.zalozka = ZE.novaZalozka(); else stav.exlibris = ZE.noveExlibris();
      stav.id[stav.druh] = null; stav.nazev[stav.druh] = ''; zmena(); if (stav.druh === 'exlibris') nahledyMonogramu();
    },
    ulozit: () => ulozit(false), ulozitJako: () => ulozit(true), galerie,
    zalohaVen: () => zalohaVen().catch(e => Dialog.chyba(e.message)), zalohaDovnitr: () => $('souborZaloha').click(),
    pdf: exportPdf, svg: exportSvg, png: exportPng, razitko,
    obrazek: () => $('souborObr').click(), otevritText: () => $('souborText').click(), zKnih,
    nahoda: () => { const st = zal()[stav.strana]; st.seed = (st.seed % 999) + 1 + Math.floor(Math.random() * 7); zmena(); },
    kopirovatStranu: () => { const z = zal(), cil = stav.strana === 'lic' ? 'rub' : 'lic'; z[cil] = kopie(z[stav.strana]); Dialog.info(stav.strana === 'lic' ? 'Líc zkopírován na rub.' : 'Rub zkopírován na líc.'); zmena(); },
    prohoditStrany: () => { const z = zal(); [z.lic, z.rub] = [z.rub, z.lic]; zmena(); },
    zvetsit: () => { stav.zoom = Math.min(4, stav.zoom * 1.2); zmena(true); },
    zmensit: () => { stav.zoom = Math.max(0.3, stav.zoom / 1.2); zmena(true); },
    prizpusobit: () => { stav.zoom = 1; zmena(true); },
    napoveda: () => $('dlgNapoveda').showModal(),
  };

  /* ------------------------------------------------------------ klávesy */
  document.addEventListener('keydown', e => {
    const vPoli = e.target.closest && e.target.closest('input, textarea, select, [contenteditable]');
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && !e.altKey) {
      const k = e.key.toLowerCase();
      if (k === 's') { e.preventDefault(); PRIKAZY.ulozit(); return; }
      if (k === 'p') { e.preventDefault(); exportPdf(); return; }
      if (k === 'e') { e.preventDefault(); exportSvg(); return; }
    }
    if (e.key === 'F1') { e.preventDefault(); PRIKAZY.napoveda(); return; }
    if (e.key === 'Escape') { zavriNabidky(); return; }
    if (vPoli || ctrl || e.altKey || document.querySelector('dialog[open]')) return;
    const akce = { 1: () => prepniDruh('zalozka'), 2: () => prepniDruh('exlibris'), n: () => { stav.pohled = 'kus'; zmena(); }, a: () => { stav.pohled = 'arch'; zmena(); },
      l: () => { if (stav.druh === 'zalozka') { stav.strana = stav.strana === 'lic' ? 'rub' : 'lic'; zmena(); } }, r: () => { if (stav.druh === 'zalozka' && zal()[stav.strana].sablona === 'vzor') PRIKAZY.nahoda(); },
      g: galerie, '+': PRIKAZY.zvetsit, '=': PRIKAZY.zvetsit, '-': PRIKAZY.zmensit, '0': PRIKAZY.prizpusobit }[e.key.toLowerCase()];
    if (akce) { e.preventDefault(); akce(); }
  });

  window.ZE_APP = { stav: () => stav, prekresli, PRIKAZY, posledni: () => posledni, rozvrh: () => rozvrh() };
  naplnFormular();
  prekresli().then(() => { if (stav.druh === 'exlibris') nahledyMonogramu(); else setTimeout(nahledyMonogramu, 300); }).catch(chybaKresleni);
})();

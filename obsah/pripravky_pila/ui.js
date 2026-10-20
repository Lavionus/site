/* ============================================================
   Přípravky pro pilu a vrtačku – uživatelské rozhraní
   ============================================================ */
(function () {
  'use strict';
  const PP = window.PP, PPV = window.PPV, PPSTL = window.PPSTL;
  const $ = (id) => document.getElementById(id);
  const KLIC = 'webapp_pripravky_pila', KLIC_PROJEKTY = 'webapp_pripravky_pila_projekty';
  const cz = PP.cz;
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const toast = (t, ch) => (window.Dialog ? (ch ? Dialog.chyba(t) : Dialog.info(t)) : console.log(t));
  const REZIMY = Object.keys(PP.REZIMY);
  const NAST = ['vule', 'stul', 'stulZ', 'materialTisk', 'oznaceni', 'papir', 'papirW', 'papirH', 'okraj', 'prekryv', 'kalibX', 'kalibY', 'velke11', 'formatL', 'formatS', 'prorez'];

  /* ---------- stav ---------- */
  function slouc(P, u) {
    if (PP.REZIMY[u.rezim]) P.rezim = u.rezim;
    for (const r of REZIMY) if (u.p && u.p[r]) P.p[r] = Object.assign(P.p[r], u.p[r]);
    P.stroj = Object.assign(P.stroj, u.stroj || {}); P.nast = Object.assign(P.nast, u.nast || {});
    P.nazev = u.nazev || ''; P.vykres = u.vykres || 0;
    return P;
  }
  function nacti() { const P = PP.vychoziProjekt(); try { const u = JSON.parse(localStorage.getItem(KLIC) || 'null'); if (u && u.p) return slouc(P, u); } catch (e) { /* poškozené */ } return P; }
  let S = nacti(), N = null, ulozT = 0, vykresy = [], vybranyDil = null;
  const uloz = () => { clearTimeout(ulozT); ulozT = setTimeout(() => { try { localStorage.setItem(KLIC, JSON.stringify(S)); } catch (e) { /* plné */ } }, 250); };
  const projekty = () => { try { return JSON.parse(localStorage.getItem(KLIC_PROJEKTY) || '{}') || {}; } catch (e) { return {}; } };
  const ulozProjekty = (o) => { try { localStorage.setItem(KLIC_PROJEKTY, JSON.stringify(o)); return true; } catch (e) { toast('Úložiště prohlížeče je plné.', true); return false; } };

  /* ---------- režimy ---------- */
  function vykresliRezimy() {
    let h = '';
    for (const [sk, nazev] of PP.SKUPINY) {
      h += `<div class="skupina">${esc(nazev)}</div><div class="rezimy">`;
      for (const k of REZIMY.filter((q) => PP.REZIMY[q].skupina === sk)) {
        const i = REZIMY.indexOf(k), R = PP.REZIMY[k], kl = i < 9 ? String(i + 1) : i === 9 ? '0' : '';
        h += `<button type="button" data-rezim="${k}" aria-pressed="${k === S.rezim}" title="${esc(R.popis)}${kl ? ' (klávesa ' + kl + ')' : ''}"><span class="ik" aria-hidden="true">${R.ikona}</span>${esc(R.nazev)}${kl ? `<kbd>${kl}</kbd>` : ''}</button>`;
      }
      h += '</div>';
    }
    $('rezimy').innerHTML = h;
  }
  function nastavRezim(k) {
    if (!PP.REZIMY[k] || k === S.rezim) return;
    S.rezim = k; S.vykres = 0; vybranyDil = null;
    for (const b of $('rezimy').querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.rezim === k));
    vykresliPole(); prepocti();
  }
  $('rezimy').addEventListener('click', (e) => { const b = e.target.closest('button[data-rezim]'); if (b) nastavRezim(b.dataset.rezim); });

  /* ---------- formulář ---------- */
  const hodnota = (f) => (f.s ? S.stroj : S.p[S.rezim])[f.k];
  function vykresliPole() {
    const R = PP.REZIMY[S.rezim];
    $('nazevRezimu').textContent = R.nazev; $('popisRezimu').textContent = R.popis;
    let h = '';
    R.pole.forEach((f, i) => {
      if (f.t === 'h') { h += `<div class="cela podnadpis" data-i="${i}">${esc(f.n)}</div>`; return; }
      const id = 'p_' + f.k, v = hodnota(f), sir = f.n.length > 34 ? 'cela' : '';
      const st = f.s ? ' <span class="stroj" title="parametr stroje – sdílený všemi přípravky">⚙</span>' : '';
      if (f.t === 'b') h += `<div class="cela" data-pole="${f.k}"><label class="chk"><input type="checkbox" id="${id}"${v ? ' checked' : ''}> ${esc(f.n)}</label></div>`;
      else if (f.t === 'v') h += `<div class="${sir}" data-pole="${f.k}"><label for="${id}">${esc(f.n)}${st}</label><select id="${id}">${f.m.map(([a, b]) => `<option value="${esc(a)}"${String(v) === String(a) ? ' selected' : ''}>${esc(b)}</option>`).join('')}</select></div>`;
      else h += `<div class="${sir}" data-pole="${f.k}"><label for="${id}">${esc(f.n)}${st}</label><input id="${id}" type="number" inputmode="decimal" value="${esc(v)}"${f.min != null ? ` min="${f.min}"` : ''}${f.max != null ? ` max="${f.max}"` : ''} step="${f.krok || 1}"></div>`;
    });
    $('pole').innerHTML = h;
    viditelnost();
  }
  function viditelnost() {
    const R = PP.REZIMY[S.rezim], n = PP.normalizuj(S.rezim, S.p[S.rezim], S.stroj);
    for (const f of R.pole) { if (!f.k) continue; const el = $('pole').querySelector(`[data-pole="${f.k}"]`); if (el) el.classList.toggle('skryte', !!(f.ukaz && !f.ukaz(n.p, n.s))); }
  }
  $('pole').addEventListener('input', (e) => {
    const el = e.target; if (!el.id || !el.id.startsWith('p_')) return;
    const k = el.id.slice(2), f = PP.REZIMY[S.rezim].pole.find((q) => q.k === k); if (!f) return;
    const cil = f.s ? S.stroj : S.p[S.rezim];
    if (f.t === 'b') cil[k] = el.checked; else if (f.t === 'v') cil[k] = el.value; else { const x = parseFloat(String(el.value).replace(',', '.')); if (isFinite(x)) cil[k] = x; }
    viditelnost(); naplanuj();
  });
  $('pole').addEventListener('change', (e) => { if (e.target.tagName === 'SELECT' || e.target.type === 'checkbox') { viditelnost(); naplanuj(); } });
  function doNastaveni() {
    for (const id of NAST) { const el = $(id); if (!el) continue; if (el.type === 'checkbox') el.checked = !!S.nast[id]; else el.value = S.nast[id]; }
    $('nazevProjektu').value = S.nazev || ''; $('blokPapir').classList.toggle('skryte', S.nast.papir !== 'vlastni');
  }
  for (const id of NAST) {
    const el = $(id); if (!el) continue;
    el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', () => {
      if (el.type === 'checkbox') S.nast[id] = el.checked; else if (el.tagName === 'SELECT') S.nast[id] = el.value;
      else { const x = parseFloat(String(el.value).replace(',', '.')); if (isFinite(x)) S.nast[id] = x; }
      $('blokPapir').classList.toggle('skryte', S.nast.papir !== 'vlastni'); naplanuj();
    });
  }
  $('nazevProjektu').addEventListener('input', () => { S.nazev = $('nazevProjektu').value; uloz(); });

  /* ---------- přepočet ---------- */
  let timer = 0; const naplanuj = () => { clearTimeout(timer); timer = setTimeout(prepocti, 90); };
  function prepocti() {
    try { N = PP.navrh(S); } catch (e) { console.error(e); $('varovani').innerHTML = `<li class="chyba">${esc(e.message)}</li>`; return; }
    vykresy = PPV.vsechnyVykresy(N);
    for (const sk of N.rezny) if (sk.listy.length) vykresy.push({ V: PPV.vykresPlanu(sk), skupina: 'plan' });
    if ((S.vykres || 0) >= vykresy.length) S.vykres = 0;
    $('vysledky').innerHTML = N.vysledky.map((v) => `<tr${v.zv ? ' class="zv"' : ''}><td>${esc(v.n)}</td><td>${esc(v.v)}</td></tr>`).join('');
    $('varovani').innerHTML = N.varovani.map((v) => `<li>${esc(v)}</li>`).join('');
    $('bezpecnost').innerHTML = N.bezpecnost.map((v) => `<li>${esc(v)}</li>`).join('');
    $('vykresyTab').innerHTML = vykresy.map((q, i) => `<button type="button" role="tab" data-v="${i}" aria-selected="${i === S.vykres}">${esc(q.V.nazev)}</button>`).join('');
    vykresliVykres(); vykresliDily(); vykresliKusovnik();
    $('princip').innerHTML = PPPrincip.princip(S.rezim); $('postup').innerHTML = PPPrincip.postup(S.rezim);
    const K = PPV.korekceMeritka(S.nast.kalibX, S.nast.kalibY);
    $('kalibVysl').innerHTML = `X ×${cz(K.kx, 4)}<br>Y ×${cz(K.ky, 4)}`;
    $('infoRezim').textContent = N.info || '';
    sitDilu = {}; aktualizuj3d(); uloz();
  }
  function vykresliVykres() {
    const q = vykresy[S.vykres || 0]; if (!q) { $('vykres').innerHTML = ''; return; }
    const M = PPV.meritkoVykresu(q.V, 260, 170);
    $('vykres').innerHTML = PPV.svgVykres(q.V, { k: M });
    $('popisVykresu').textContent = `${q.V.popis ? q.V.popis + ' · ' : ''}měřítko popisů ${PPV.popisMeritka(M)} · mm`;
  }
  $('vykresyTab').addEventListener('click', (e) => { const b = e.target.closest('button[data-v]'); if (!b) return; S.vykres = +b.dataset.v; for (const x of $('vykresyTab').children) x.setAttribute('aria-selected', String(x === b)); vykresliVykres(); uloz(); });
  function vykresliDily() {
    const r = (d) => (d.druh === 'deska' ? `${cz(d.w, 1)} × ${cz(d.h, 1)} × ${cz(d.tl, 1)}` : d.rozmer.map((x) => cz(x, 1)).join(' × '));
    $('dilyTab').innerHTML = '<tr><th>Díl</th><th>ks</th><th>rozměr (mm)</th><th>materiál / výroba</th><th></th></tr>' + N.dily.filter((d) => !(d.jenNahled && d.druh === 'deska' && !/[Šš]ablona/.test(d.nazev))).map((d) => {
      const tl = d.druh === 'tisk' ? `<button class="btn btn-sec btn-mini" type="button" data-stl="${esc(d.id)}">STL</button>` : `<button class="btn btn-sec btn-mini" type="button" data-dxf="${esc(d.id)}">DXF</button>`;
      return `<tr${d.druh === 'tisk' && d.vejdeSe === false ? ' class="zv"' : ''}><td><b>${esc(d.id)}</b> ${esc(d.nazev)}${d.pozn ? `<div class="mala">${esc(d.pozn)}</div>` : ''}${d.tiskPozn ? `<div class="mala">🖨️ ${esc(d.tiskPozn)}</div>` : ''}</td><td>${d.ks}</td><td>${r(d)}</td><td>${d.druh === 'tisk' ? '3D tisk – ' + esc(d.material) : esc(d.material)}</td><td>${tl}</td></tr>`;
    }).join('');
    $('btnStlVse').disabled = !N.dily.some((d) => d.druh === 'tisk'); $('btnDxf').disabled = !N.dily.some((d) => d.druh === 'deska' && !d.jenNahled);
  }
  function vykresliKusovnik() {
    $('kusovnik').innerHTML = '<tr><th>ks</th><th>položka</th><th>poznámka</th></tr>' + N.kusovnik.map((q) => `<tr><td>${q.ks}</td><td>${esc(q.p)}</td><td>${esc(q.pozn || '')}</td></tr>`).join('');
    const sk = N.rezny.filter((q) => q.listy.length);
    $('rezny').innerHTML = sk.length ? sk.map((q) => `${esc(q.material)} ${cz(q.tl, 1)} mm: <b>${q.listy.length}</b> ${q.listy.length === 1 ? 'formát' : 'formáty'} ${cz(q.L, 0)} × ${cz(q.S, 0)} (využití ${cz(q.vyuziti * 100, 0)} %)${q.nevejde.length ? ` – <span class="chyba">nevejde se: ${q.nevejde.map((k) => esc(k.id)).join(', ')}</span>` : ''}`).join('<br>') : 'Žádné deskové díly.';
  }

  /* ---------- soubory ---------- */
  function stahni(obsah, nazev, typ) {
    const blob = obsah instanceof Blob ? obsah : new Blob([obsah], { type: typ || 'application/octet-stream' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nazev; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  const zaklad = () => String(S.nazev || 'pripravek_' + S.rezim).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'pripravek';
  const nazevSouboru = (pr, x) => `${zaklad()}${x ? '_' + String(x).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_') : ''}.${pr}`;
  let pismoSlib = null;
  function nactiPismo() {
    if (window.FONTY_JS && window.FONTY_JS['LiberationSans-Regular.ttf']) return Promise.resolve(window.FONTY_JS['LiberationSans-Regular.ttf']);
    if (pismoSlib) return pismoSlib;
    pismoSlib = new Promise((ok) => { const s = document.createElement('script'); s.src = 'stitky_panely/fonty/LiberationSans-Regular.ttf.js'; s.onload = () => ok((window.FONTY_JS || {})['LiberationSans-Regular.ttf'] || null); s.onerror = () => { pismoSlib = null; ok(null); }; document.head.appendChild(s); });
    return pismoSlib;
  }
  async function sPrubehem(b, text, fn) {
    const puv = b.textContent; b.disabled = true; b.textContent = text;
    try { await new Promise((r) => setTimeout(r, 20)); return await fn(); } catch (e) { console.error(e); toast('Chyba: ' + e.message, true); return null; } finally { b.disabled = false; b.textContent = puv; }
  }
  async function pdfStahni(jen, b) {
    await sPrubehem(b, 'Připravuji PDF…', async () => {
      if (!window.jspdf) throw new Error('Knihovna jsPDF se nenačetla.');
      const pismo = await nactiPismo(); if (!pismo) toast('Písmo se nepodařilo načíst – PDF bude bez diakritiky.');
      const nazev = (S.nazev ? S.nazev + ' – ' : '') + PP.REZIMY[S.rezim].nazev;
      const st = PPV.strany(N, S.nast, { nazev, jen });
      const doc = PPV.pdf(window.jspdf.jsPDF, st, { pismo, nazev });
      stahni(doc.output('blob'), nazevSouboru('pdf', jen === 'vse' ? '' : jen));
      toast(`PDF: ${st.length} ${st.length === 1 ? 'strana' : st.length < 5 ? 'strany' : 'stran'}. Šablony tiskněte ve skutečné velikosti (100 %).`);
    });
  }
  $('btnPdf').addEventListener('click', (e) => pdfStahni('vse', e.currentTarget));
  $('btnPdfSab').addEventListener('click', (e) => pdfStahni('sablony', e.currentTarget));
  $('btnPdfVyk').addEventListener('click', (e) => pdfStahni('vykresy', e.currentTarget));
  $('btnSvg').addEventListener('click', () => { const q = vykresy[S.vykres || 0]; if (!q) return; stahni(PPV.svgVykres(q.V, { k: PPV.meritkoVykresu(q.V, 260, 170) }), nazevSouboru('svg', q.V.id), 'image/svg+xml'); });
  $('btnDxf').addEventListener('click', () => stahni(PPV.dxfDesek(N.dily), nazevSouboru('dxf', 'desky'), 'application/dxf'));
  $('btnSvgDesky').addEventListener('click', () => stahni(PPV.svgDesek(N.dily), nazevSouboru('svg', 'desky_1-1'), 'image/svg+xml'));
  $('btnJson').addEventListener('click', () => stahni(JSON.stringify({ rezim: S.rezim, vysledky: N.vysledky, kusovnik: N.kusovnik, dily: N.dily.map((d) => ({ id: d.id, nazev: d.nazev, druh: d.druh, ks: d.ks, material: d.material, rozmer: d.druh === 'deska' ? [d.w, d.h, d.tl] : d.rozmer })) }, null, 1), nazevSouboru('json', 'kusovnik'), 'application/json'));

  /* ---------- manifold + STL ---------- */
  let manifoldSlib = null, sitDilu = {};
  function nactiSkript(src) { return new Promise((ok, ch) => { const el = document.createElement('script'); el.src = src; el.onload = ok; el.onerror = () => ch(new Error('nejde načíst ' + src)); document.head.appendChild(el); }); }
  function nactiManifold() {
    if (manifoldSlib) return manifoldSlib;
    manifoldSlib = (async () => {
      globalThis.MANIFOLD_URL = new URL('lib/manifold/manifold.klasicky.js', location.href).href;
      if (!globalThis.ManifoldModule) await nactiSkript('lib/manifold/manifold.klasicky.js');
      let volby;
      if (location.protocol === 'file:') {
        await nactiSkript('lib/manifold/manifold.wasm.js');
        const b = atob(globalThis.MANIFOLD_WASM_B64), bin = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) bin[i] = b.charCodeAt(i);
        delete globalThis.MANIFOLD_WASM_B64; volby = { wasmBinary: bin };
      } else volby = { locateFile: (f) => new URL('lib/manifold/' + f, location.href).href };
      const w = await globalThis.ManifoldModule(volby); w.setup(); return w;
    })();
    manifoldSlib.catch(() => { manifoldSlib = null; });
    return manifoldSlib;
  }
  async function sitDilu1(w, d) { if (!sitDilu[d.id]) sitDilu[d.id] = PPSTL.teleso(w, d); return sitDilu[d.id]; }
  $('dilyTab').addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-stl],button[data-dxf]'); if (!b) return;
    if (b.dataset.dxf) { const d = N.dily.find((x) => x.id === b.dataset.dxf); stahni(PPV.dxfDesek([d]), nazevSouboru('dxf', d.id), 'application/dxf'); return; }
    await sPrubehem(b, '…', async () => {
      const d = N.dily.find((x) => x.id === b.dataset.stl), w = await nactiManifold(), m = await sitDilu1(w, d);
      stahni(new Blob([PPSTL.stlBinarni(m.poz, m.idx, d.nazev)], { type: 'model/stl' }), nazevSouboru('stl', d.id));
      toast(`${d.id}: objem ${cz(m.objem / 1000, 1)} cm³, uzavřené těleso${d.ks > 1 ? `, tiskněte ${d.ks} ×` : ''}.`);
    });
  });
  $('btnStlVse').addEventListener('click', (e) => sPrubehem(e.currentTarget, 'Počítám STL…', async () => {
    const w = await nactiManifold(), site = [];
    for (const d of N.dily.filter((x) => x.druh === 'tisk')) { const m = await sitDilu1(w, d); for (let i = 0; i < (d.ks || 1); i++) site.push(m); }
    const s = PPSTL.spoj(site, 8);
    stahni(new Blob([PPSTL.stlBinarni(s.poz, s.idx, PP.REZIMY[S.rezim].nazev)], { type: 'model/stl' }), nazevSouboru('stl', 'vse'));
    toast(`STL: ${site.length} dílů vedle sebe – na podložce je rozmístěte podle velikosti tiskárny.`);
  }));

  /* ---------- 3D ---------- */
  let pohled3d = null, nacita3d = false;
  async function aktualizuj3d() {
    if (!pohled3d || !N) return;
    pohled3d.aktualizuj(N, sitDilu);
    const tisk = N.dily.filter((d) => d.druh === 'tisk' && d.um && !d.jenStl);
    if (!tisk.length) return;
    const moje = N;
    try {
      const w = await nactiManifold();
      if (moje !== N) return;
      for (const d of tisk) await sitDilu1(w, d);
      if (moje === N) pohled3d.aktualizuj(N, sitDilu);
    } catch (e) { $('stav3d').textContent = 'Sítě tištěných dílů nejsou k dispozici: ' + e.message; }
  }
  function nacti3d() {
    if (pohled3d || nacita3d) return; nacita3d = true;
    const hotovo = () => { try { pohled3d = PP3D.vytvor($('obal3d')); $('stav3d').textContent = ''; aktualizuj3d(); } catch (e) { $('stav3d').textContent = '3D se nepodařilo spustit: ' + e.message; } };
    if (window.THREE) { hotovo(); return; }
    nactiSkript('lib/three.0.160.0.min.js').then(hotovo).catch((e) => { nacita3d = false; $('stav3d').textContent = 'three.js se nenačetl: ' + e.message; });
  }
  new IntersectionObserver((z) => { if (z.some((x) => x.isIntersecting)) nacti3d(); }, { rootMargin: '200px' }).observe($('obal3d'));
  $('b3dHraj').addEventListener('click', () => { if (!pohled3d) return; const h = pohled3d.hraj(); $('b3dHraj').textContent = h ? '⏸ Zastavit' : '▶ Animace'; $('b3dHraj').setAttribute('aria-pressed', String(h)); });
  $('b3dVychozi').addEventListener('click', () => pohled3d && pohled3d.pohled(-35, 32));
  $('b3dShora').addEventListener('click', () => pohled3d && pohled3d.pohled(0, 89));
  $('b3dBok').addEventListener('click', () => pohled3d && pohled3d.pohled(-90, 5));
  $('b3dZepredu').addEventListener('click', () => pohled3d && pohled3d.pohled(180, 8));

  /* ---------- projekty ---------- */
  function vykresliProjekty() {
    const P = projekty(), jm = Object.keys(P).sort((a, b) => a.localeCompare(b, 'cs'));
    $('seznamProjektu').innerHTML = jm.length ? jm.map((j) => `<option value="${esc(j)}">${esc(j)} – ${esc((PP.REZIMY[P[j].rezim] || {}).nazev || '')}</option>`).join('') : '<option value="">– zatím nic –</option>';
  }
  function nactiProjekt(u) { S = slouc(PP.vychoziProjekt(), u); vykresliRezimy(); vykresliPole(); doNastaveni(); prepocti(); }
  $('btnUlozit').addEventListener('click', async () => {
    let jm = (S.nazev || '').trim();
    if (!jm) { jm = await Dialog.zeptej('Název projektu', PP.REZIMY[S.rezim].nazev); if (!jm) return; jm = jm.trim(); S.nazev = jm; $('nazevProjektu').value = jm; }
    const P = projekty();
    if (P[jm] && !(await Dialog.potvrd(`Projekt „${jm}“ už existuje. Přepsat?`))) return;
    P[jm] = JSON.parse(JSON.stringify(S)); P[jm].ulozeno = new Date().toISOString();
    if (ulozProjekty(P)) { vykresliProjekty(); $('seznamProjektu').value = jm; toast('Projekt uložen.'); }
    uloz();
  });
  $('btnNacist').addEventListener('click', () => { const j = $('seznamProjektu').value, P = projekty(); if (P[j]) { nactiProjekt(P[j]); toast('Načteno: ' + j); } });
  $('btnSmazat').addEventListener('click', async () => { const j = $('seznamProjektu').value, P = projekty(); if (!P[j]) return; if (!(await Dialog.potvrd(`Smazat projekt „${j}“?`))) return; delete P[j]; ulozProjekty(P); vykresliProjekty(); });
  $('btnExport').addEventListener('click', () => stahni(JSON.stringify(Object.assign({ aplikace: 'pripravky_pila', exportovano: new Date().toISOString() }, S), null, 1), nazevSouboru('json'), 'application/json'));
  $('btnImport').addEventListener('click', () => $('souborProjekt').click());
  $('souborProjekt').addEventListener('change', async () => {
    const f = $('souborProjekt').files[0]; $('souborProjekt').value = ''; if (!f) return;
    try { const u = JSON.parse(await f.text()); if (!u || !u.p || !PP.REZIMY[u.rezim]) throw new Error('soubor není projekt přípravků'); nactiProjekt(u); toast('Projekt importován.'); } catch (e) { toast('Import se nepodařil: ' + e.message, true); }
  });
  $('btnReset').addEventListener('click', async () => {
    if (!(await Dialog.potvrd('Vrátit parametry přípravků i stroje na výchozí (typické) hodnoty? Uložené projekty zůstanou.'))) return;
    const r = S.rezim; S = PP.vychoziProjekt(r); vykresliRezimy(); vykresliPole(); doNastaveni(); prepocti();
  });
  // předvolby typických strojů (hodnoty jsou typické, ne katalogové)
  const PREDVOLBY = {
    metricka: { drazkaS: 19.05, drazkaH: 9.5, drazkaTyp: 'obd', kotoucD: 254, kerf: 3.0, vyskaMax: 80 },
    tdrazka: { drazkaS: 19.05, drazkaH: 9.5, drazkaTyp: 'T', tSirka: 25.4, tVyska: 4, kotoucD: 254, kerf: 3.0, vyskaMax: 80 },
    mala: { drazkaS: 15.9, drazkaH: 8, drazkaTyp: 'obd', kotoucD: 210, kerf: 2.6, vyskaMax: 60, stulHloubka: 550 },
    hobby: { drazkaS: 16, drazkaH: 7, drazkaTyp: 'T', tSirka: 22, tVyska: 3, kotoucD: 250, kerf: 2.8, vyskaMax: 75 },
  };
  $('predvolba').addEventListener('change', () => { const q = PREDVOLBY[$('predvolba').value]; $('predvolba').value = ''; if (!q) return; Object.assign(S.stroj, q); vykresliPole(); prepocti(); toast('Nastaveny typické hodnoty stroje – změřte a opravte podle svého stolu.'); });

  /* ---------- záložky, klávesy ---------- */
  $('zalozky').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-z]'); if (!b) return;
    for (const x of $('zalozky').children) x.setAttribute('aria-selected', String(x === b));
    for (const p of document.querySelectorAll('.panel')) p.hidden = p.dataset.p !== b.dataset.z;
  });
  document.addEventListener('keydown', (e) => {
    const t = e.target; if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    const m = /^(?:Digit|Numpad)([0-9])$/.exec(e.code);
    if (m) { const i = m[1] === '0' ? 9 : +m[1] - 1; if (REZIMY[i]) { e.preventDefault(); nastavRezim(REZIMY[i]); } }
  });

  vykresliRezimy(); vykresliPole(); doNastaveni(); vykresliProjekty(); prepocti();
  window.PPApp = { get stav() { return S; }, get navrh() { return N; }, nastavRezim, prepocti, nactiManifold, get pohled3d() { return pohled3d; }, get site() { return sitDilu; } };
})();

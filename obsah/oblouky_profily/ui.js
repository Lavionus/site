/* ============================================================
   Šablony oblouků a profilů – uživatelské rozhraní
   ============================================================ */
(function () {
  'use strict';
  const O = window.OBL, R = window.OBLR, V0 = window.OBLV, ST = window.OBLSTL, PR = window.OBLPrincip, P = window.OBLP, KR = window.OBLK;
  const $ = (id) => document.getElementById(id);
  const KLIC = 'webapp_oblouky_profily', KLIC_PROJEKTY = 'webapp_oblouky_profily_projekty';
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const toast = (t, ch) => (window.Dialog ? (ch ? Dialog.chyba(t) : Dialog.info(t)) : console.log(t));
  const REZIMY = R.SKUPINY.flatMap(([sk]) => Object.keys(R.REZIMY).filter((k) => R.REZIMY[k].skupina === sk));
  const NAST_POLE = ['papir', 'okraj', 'prekryv', 'papirW', 'papirH', 'kalibX', 'kalibY', 'popisy', 'ukazListy', 'stlTl', 'stlStul', 'stlVule', 'stlCislo'];

  /* ---------- stav ---------- */
  function slouc(Pv, u) {
    if (R.REZIMY[u.rezim]) Pv.rezim = u.rezim;
    for (const r of Object.keys(R.REZIMY)) if (u.p && u.p[r]) Pv.p[r] = Object.assign(Pv.p[r], u.p[r]);
    Pv.nast = Object.assign(Pv.nast, u.nast || {});
    Pv.nazev = u.nazev || ''; Pv.dil = u.dil || 0;
    return Pv;
  }
  function nacistStav() {
    const Pv = R.vychoziProjekt();
    try { const u = JSON.parse(localStorage.getItem(KLIC) || 'null'); if (u && u.p) return slouc(Pv, u); } catch (e) { /* poškozené úložiště */ }
    return Pv;
  }
  let S = nacistStav(), V = null, ulozTimer = 0, planTimer = 0;
  const uloz = () => { clearTimeout(ulozTimer); ulozTimer = setTimeout(() => { try { localStorage.setItem(KLIC, JSON.stringify(S)); } catch (e) { /* plné úložiště */ } }, 250); };
  const projekty = () => { try { return JSON.parse(localStorage.getItem(KLIC_PROJEKTY) || '{}') || {}; } catch (e) { return {}; } };
  const ulozProjekty = (o) => { try { localStorage.setItem(KLIC_PROJEKTY, JSON.stringify(o)); return true; } catch (e) { toast('Úložiště prohlížeče je plné.', true); return false; } };
  const naplanuj = () => { clearTimeout(planTimer); planTimer = setTimeout(prepocti, 120); };

  /* ---------- režimy ---------- */
  function vykresliRezimy() {
    let h = '';
    for (const [sk, nazev] of R.SKUPINY) {
      h += `<div class="skupina">${nazev}</div><div class="rezimy">`;
      for (const k of REZIMY.filter((q) => R.REZIMY[q].skupina === sk)) {
        const i = REZIMY.indexOf(k), M = R.REZIMY[k], kl = i < 9 ? String(i + 1) : i === 9 ? '0' : '';
        h += `<button type="button" data-rezim="${k}" aria-pressed="${k === S.rezim}" title="${esc(M.popis)}${kl ? ' (klávesa ' + kl + ')' : ''}"><span class="ik" aria-hidden="true">${M.ikona}</span>${esc(M.nazev)}${kl ? `<kbd>${kl}</kbd>` : ''}</button>`;
      }
      h += '</div>';
    }
    $('rezimy').innerHTML = h;
  }
  function nastavRezim(k) {
    if (!R.REZIMY[k] || k === S.rezim) return;
    S.rezim = k; S.dil = 0;
    for (const b of $('rezimy').querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.rezim === k));
    vykresliPole(); prepocti();
  }
  $('rezimy').addEventListener('click', (e) => { const b = e.target.closest('button[data-rezim]'); if (b) nastavRezim(b.dataset.rezim); });

  /* ---------- parametry ---------- */
  function vykresliTab(f, v) {
    const rows = Array.isArray(v) ? v : [];
    let h = '<table><tr><th>#</th>' + f.sloupce.map((s) => `<th>${esc(s.n)}</th>`).join('') + '<th></th></tr>';
    rows.forEach((q, i) => {
      h += `<tr data-i="${i}"><td>${i + 1}</td>`;
      for (const s of f.sloupce) {
        if (s.t === 'b') h += `<td><input type="checkbox" data-k="${s.k}"${q[s.k] ? ' checked' : ''} aria-label="${esc(s.n)} ${i + 1}"></td>`;
        else if (s.t === 'v') h += `<td><select data-k="${s.k}" aria-label="${esc(s.n)} ${i + 1}">${s.m.map(([a, b]) => `<option value="${esc(a)}"${String(q[s.k]) === String(a) ? ' selected' : ''}>${esc(b)}</option>`).join('')}</select></td>`;
        else h += `<td><input type="number" step="0.1" inputmode="decimal" data-k="${s.k}" value="${esc(q[s.k])}" aria-label="${esc(s.n)} ${i + 1}"></td>`;
      }
      h += `<td style="white-space:nowrap"><button class="btn btn-sec" type="button" data-akce="nahoru" title="Posunout nahoru" aria-label="Nahoru ${i + 1}">↑</button> <button class="btn btn-sec" type="button" data-akce="smaz" title="Smazat řádek" aria-label="Smazat ${i + 1}">✕</button></td></tr>`;
    });
    return h + '</table>';
  }
  function vykresliPole() {
    const M = R.REZIMY[S.rezim], p = S.p[S.rezim];
    $('nazevRezimu').textContent = M.nazev;
    $('popisRezimu').textContent = M.popis;
    $('predvolba').innerHTML = '<option value="">– vyberte předvolbu –</option>' + (M.predvolby || []).map((q, i) => `<option value="${i}">${esc(q.n)}</option>`).join('');
    let h = '';
    for (const f of M.pole) {
      const id = 'p_' + f.k, v = p[f.k];
      if (f.t === 'b') h += `<div class="cela" data-pole="${f.k}"><label class="chk"><input type="checkbox" id="${id}"${v ? ' checked' : ''}> ${esc(f.n)}</label></div>`;
      else if (f.t === 'v') h += `<div class="${f.n.length > 30 ? 'cela' : ''}" data-pole="${f.k}"><label for="${id}">${esc(f.n)}</label><select id="${id}">${f.m.map(([a, b]) => `<option value="${esc(a)}"${String(v) === String(a) ? ' selected' : ''}>${esc(b)}</option>`).join('')}</select></div>`;
      else if (f.t === 's') h += `<div class="cela" data-pole="${f.k}"><label for="${id}">${esc(f.n)}</label><input id="${id}" type="text" value="${esc(v)}"></div>`;
      else if (f.t === 'tab') h += `<div class="cela" data-pole="${f.k}"><div class="podnadpis">${esc(f.n)}</div><div class="editor" data-tab="${f.k}">${vykresliTab(f, v)}</div><div class="tlacitka"><button class="btn btn-sec btn-mini" type="button" data-pridat="${f.k}">+ řádek</button>${S.rezim === 'kabriol' && f.k === 'predni' ? '<button class="btn btn-sec btn-mini" type="button" id="btnPrizpusob">Přizpůsobit předlohu polotovaru</button>' : ''}</div></div>`;
      else h += `<div class="${f.n.length > 34 ? 'cela' : ''}" data-pole="${f.k}"><label for="${id}">${esc(f.n)}</label><input id="${id}" type="number" inputmode="decimal" value="${esc(v)}"${f.min != null ? ` min="${f.min}"` : ''}${f.max != null ? ` max="${f.max}"` : ''} step="${f.krok || 1}"></div>`;
    }
    $('pole').innerHTML = h;
    viditelnostPoli();
  }
  function viditelnostPoli() {
    const M = R.REZIMY[S.rezim], p = R.normalizuj(S.rezim, S.p[S.rezim]);
    for (const f of M.pole) { const el = $('pole').querySelector(`[data-pole="${f.k}"]`); if (el) el.classList.toggle('skryte', !!(f.ukaz && !f.ukaz(p))); }
  }
  const pole = (k) => R.REZIMY[S.rezim].pole.find((q) => q.k === k);
  $('pole').addEventListener('input', (e) => {
    const el = e.target, tab = el.closest('[data-tab]');
    if (tab) {
      const f = pole(tab.dataset.tab), tr = el.closest('tr[data-i]'); if (!f || !tr) return;
      const q = S.p[S.rezim][f.k][+tr.dataset.i], k = el.dataset.k, s = f.sloupce.find((x) => x.k === k);
      q[k] = s && s.t === 'b' ? el.checked : s && s.t === 'v' ? el.value : parseFloat(String(el.value).replace(',', '.'));
      naplanuj(); return;
    }
    if (!el.id || !el.id.startsWith('p_')) return;
    const f = pole(el.id.slice(2)); if (!f) return;
    S.p[S.rezim][f.k] = f.t === 'b' ? el.checked : f.t === 'v' || f.t === 's' ? el.value : el.value === '' ? S.p[S.rezim][f.k] : parseFloat(String(el.value).replace(',', '.'));
    viditelnostPoli(); naplanuj();
  });
  $('pole').addEventListener('change', (e) => { if (e.target.tagName === 'SELECT' || e.target.type === 'checkbox') { viditelnostPoli(); naplanuj(); } });
  $('pole').addEventListener('click', (e) => {
    const pr = e.target.closest('[data-pridat]');
    if (pr) { const f = pole(pr.dataset.pridat), p = S.p[S.rezim]; p[f.k] = (p[f.k] || []).concat([f.novy ? f.novy(p) : {}]); vykresliPole(); prepocti(); return; }
    if (e.target.id === 'btnPrizpusob') { S.p.kabriol = P.prizpusobKabriol(S.p.kabriol); vykresliPole(); prepocti(); toast('Předloha přepočtena na délku a průřez polotovaru.'); return; }
    const b = e.target.closest('button[data-akce]'); if (!b) return;
    const tab = b.closest('[data-tab]'), tr = b.closest('tr[data-i]'), i = +tr.dataset.i, arr = S.p[S.rezim][tab.dataset.tab];
    if (b.dataset.akce === 'smaz') arr.splice(i, 1);
    else if (i > 0) [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
    vykresliPole(); prepocti();
  });
  $('predvolba').addEventListener('change', () => {
    const i = $('predvolba').value; if (i === '') return;
    const q = R.REZIMY[S.rezim].predvolby[+i];
    S.p[S.rezim] = Object.assign(JSON.parse(JSON.stringify(R.REZIMY[S.rezim].vychozi)), S.p[S.rezim], JSON.parse(JSON.stringify(q.p)));
    vykresliPole(); prepocti();
  });

  /* ---------- nastavení tisku ---------- */
  function doNastaveni() {
    for (const k of NAST_POLE) { const el = $(k); if (!el) continue; if (el.type === 'checkbox') el.checked = S.nast[k] !== false; else el.value = S.nast[k]; }
    $('blokPapir').classList.toggle('skryte', S.nast.papir !== 'vlastni');
    $('nazevProjektu').value = S.nazev || '';
  }
  for (const k of NAST_POLE) {
    const el = $(k); if (!el) continue;
    el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', () => {
      S.nast[k] = el.type === 'checkbox' ? el.checked : el.tagName === 'SELECT' ? el.value : (el.value === '' ? S.nast[k] : parseFloat(String(el.value).replace(',', '.')));
      $('blokPapir').classList.toggle('skryte', S.nast.papir !== 'vlastni');
      naplanuj();
    });
  }
  $('nazevProjektu').addEventListener('input', () => { S.nazev = $('nazevProjektu').value; uloz(); });

  /* ---------- přepočet a vykreslení ---------- */
  const dil = () => (V && V.dily[Math.min(S.dil || 0, V.dily.length - 1)]) || null;
  function prepocti() {
    try { V = R.vypocti(S.rezim, S.p[S.rezim]); }
    catch (e) { console.error(e); V = { dily: [], hodnoty: [], tabulky: [], kusovnik: [], varovani: ['Chyba výpočtu: ' + e.message], info: '' }; }
    if ((S.dil || 0) >= V.dily.length) S.dil = 0;
    $('info').textContent = V.info || '';
    $('varovani').innerHTML = V.varovani.map((v) => `<li>${esc(v)}</li>`).join('');
    $('dily').innerHTML = V.dily.map((d, i) => `<button type="button" role="tab" data-dil="${i}" aria-selected="${i === S.dil}">${esc(d.id)} – ${esc(d.nazev)}</button>`).join('');
    $('tabHodnoty').innerHTML = V.hodnoty.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('');
    $('tabulky').innerHTML = V.tabulky.length ? V.tabulky.map((t) => `<h3>${esc(t.nazev)}</h3><table><tr>${t.hlavicka.map((x) => `<th>${esc(x)}</th>`).join('')}</tr>${t.radky.map((r) => `<tr>${r.map((x) => `<td>${esc(x)}</td>`).join('')}</tr>`).join('')}</table>`).join('') : '<p class="info">Pro tento režim nejsou další tabulky.</p>';
    $('kusovnik').innerHTML = V.kusovnik.length ? `<table><tr><th>položka</th><th>ks</th><th>rozměr (mm)</th><th>materiál</th><th>poznámka</th></tr>${V.kusovnik.map((r) => `<tr>${r.map((x) => `<td>${esc(x)}</td>`).join('')}</tr>`).join('')}</table><p class="info">Typické hodnoty kování a nářadí jsou orientační – ověřte u svého dodavatele.</p>` : '<p class="info">Kusovník pro tento režim není.</p>';
    $('princip').innerHTML = PR.princip(S.rezim);
    $('postup').innerHTML = PR.postup(S.rezim);
    vykresliNahled();
    aktualizuj3d();
    uloz();
  }
  function vykresliNahled() {
    const d = dil();
    if (!d) { $('nahled').innerHTML = ''; $('rozmerNahled').textContent = ''; $('infoListy').textContent = ''; return; }
    const M = V0.meze(d, S.nast, 2), [pw, ph] = O.rozmerPapiru(S.nast), rv = O.rozvrhListu(M, pw, ph, S.nast);
    let navic = '';
    if (S.nast.ukazListy !== false && !rv.jeden) for (const l of rv.listy) navic += `<rect x="${l.x0}" y="${-l.y1}" width="${l.x1 - l.x0}" height="${l.y1 - l.y0}" fill="none" stroke="#f08a24" stroke-width="${Math.max(0.3, (M.x1 - M.x0) / 600)}" stroke-dasharray="6 4"/>`;
    $('nahled').innerHTML = V0.svg(d, S.nast, { sirkaPx: true, okraj: 4, navic });
    const skut = $('skutecna').checked, svgEl = $('nahled').querySelector('svg');
    $('nahled').classList.toggle('skutecna', skut);
    if (skut && svgEl) svgEl.style.width = ((M.x1 - M.x0 + 8) * 96 / 25.4) + 'px';
    $('rozmerNahled').textContent = `${KR.cz(M.x1 - M.x0, 0)} × ${KR.cz(M.y1 - M.y0, 0)} mm`;
    const papir = S.nast.papir === 'vlastni' ? `${pw} × ${ph} mm` : String(S.nast.papir).toUpperCase();
    $('infoListy').innerHTML = `Díl <b>${esc(d.id)}</b>: ${rv.listy.length === 1 ? '1 list' : `${rv.listy.length} listů (${rv.nx} × ${rv.ny})`} ${papir} ${rv.W > rv.H ? 'na šířku' : 'na výšku'}${rv.jeden ? '' : `, přesah ${KR.cz(rv.g, 0)} mm`}. Celé PDF: ${V.dily.reduce((s, q) => s + O.rozvrhListu(V0.meze(q, S.nast, 2), pw, ph, S.nast).listy.length, 0)} listů šablon + strana hodnot.`;
    $('btnStl').disabled = !d.stl;
    $('infoStl').textContent = d.stl ? 'Deska z obrysu zobrazeného dílu. Větší než tisková plocha se rozdělí na kusy s rybinovými zámky. Doporučeno PETG, 3–4 perimetry.' : (d.proc || 'Tento díl je výkres – STL není k dispozici; přepněte na díl se šablonou.');
  }
  $('skutecna').addEventListener('change', vykresliNahled);
  $('dily').addEventListener('click', (e) => { const b = e.target.closest('[data-dil]'); if (!b) return; S.dil = +b.dataset.dil; for (const x of $('dily').children) x.setAttribute('aria-selected', String(x === b)); vykresliNahled(); uloz(); });

  /* ---------- soubory ---------- */
  function stahni(obsah, nazev, typ) {
    const blob = obsah instanceof Blob ? obsah : new Blob([obsah], { type: typ || 'application/octet-stream' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nazev;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  const zaklad = () => String(S.nazev || 'sablona_' + S.rezim).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'sablona';
  const nazevSouboru = (pripona, id) => `${zaklad()}${id ? '_' + id : ''}.${pripona}`;
  let pismoSlib = null;
  function nactiPismo() {
    if (window.FONTY_JS && window.FONTY_JS['LiberationSans-Regular.ttf']) return Promise.resolve(window.FONTY_JS['LiberationSans-Regular.ttf']);
    if (pismoSlib) return pismoSlib;
    pismoSlib = new Promise((ok) => {
      const s = document.createElement('script'); s.src = 'stitky_panely/fonty/LiberationSans-Regular.ttf.js';
      s.onload = () => ok((window.FONTY_JS || {})['LiberationSans-Regular.ttf'] || null);
      s.onerror = () => { pismoSlib = null; ok(null); };
      document.head.appendChild(s);
    });
    return pismoSlib;
  }
  async function pdfStahnout(jenDil) {
    const b = jenDil ? $('btnPdfDil') : $('btnPdf'), puv = b.textContent; b.disabled = true; b.textContent = 'Připravuji PDF…';
    try {
      if (!window.jspdf) throw new Error('Knihovna jsPDF se nenačetla.');
      const pismo = await nactiPismo();
      if (!pismo) toast('Písmo se nepodařilo načíst – PDF bude bez diakritiky.');
      const nazev = (S.nazev ? S.nazev + ' – ' : '') + R.REZIMY[S.rezim].nazev;
      const st = V0.strany(V, S.nast, { nazev, jenDil: jenDil ? S.dil : null, text: !jenDil, postup: PR.postupText(S.rezim) });
      const doc = V0.pdf(window.jspdf.jsPDF, st, { pismo, nazev });
      stahni(doc.output('blob'), nazevSouboru('pdf', jenDil ? dil().id : ''));
    } catch (e) { console.error(e); toast('Chyba PDF: ' + e.message, true); }
    finally { b.disabled = false; b.textContent = puv; }
  }
  $('btnPdf').addEventListener('click', () => pdfStahnout(false));
  $('btnPdfDil').addEventListener('click', () => pdfStahnout(true));
  $('btnSvg').addEventListener('click', () => { const d = dil(); if (d) stahni(V0.svg(d, S.nast, { okraj: 2 }), nazevSouboru('svg', d.id), 'image/svg+xml'); });
  $('btnDxf').addEventListener('click', () => { const d = dil(); if (d) stahni(V0.dxf(d, S.nast), nazevSouboru('dxf', d.id), 'application/dxf'); });
  $('btnCsv').addEventListener('click', () => { if (V) stahni('﻿' + V0.csv(V), nazevSouboru('csv'), 'text/csv;charset=utf-8'); });

  /* ---------- STL (manifold až na vyžádání) ---------- */
  let manifoldSlib = null;
  function nactiSkript(src) { return new Promise((ok, chyba) => { const el = document.createElement('script'); el.src = src; el.onload = ok; el.onerror = () => chyba(new Error('nejde načíst ' + src)); document.head.appendChild(el); }); }
  function nactiManifold() {
    if (manifoldSlib) return manifoldSlib;
    manifoldSlib = (async () => {
      globalThis.MANIFOLD_URL = new URL('lib/manifold/manifold.klasicky.js', location.href).href;
      if (!globalThis.ManifoldModule) await nactiSkript('lib/manifold/manifold.klasicky.js');
      let volby;
      if (location.protocol === 'file:') {
        await nactiSkript('lib/manifold/manifold.wasm.js');
        const b = atob(globalThis.MANIFOLD_WASM_B64), bin = new Uint8Array(b.length);
        for (let i = 0; i < b.length; i++) bin[i] = b.charCodeAt(i);
        delete globalThis.MANIFOLD_WASM_B64; volby = { wasmBinary: bin };
      } else volby = { locateFile: (f) => new URL('lib/manifold/' + f, location.href).href };
      const w = await globalThis.ManifoldModule(volby); w.setup(); return w;
    })();
    manifoldSlib.catch(() => { manifoldSlib = null; });
    return manifoldSlib;
  }
  $('btnStl').addEventListener('click', async () => {
    const d = dil(); if (!d || !d.stl) return;
    const b = $('btnStl'), puv = b.textContent; b.disabled = true; b.textContent = 'Počítám STL…';
    try {
      await new Promise((r) => setTimeout(r, 20));
      const w = await nactiManifold(), m = ST.sablona(w, d, S.nast);
      stahni(new Blob([ST.stlBinarni(m.poz, m.idx, 'sablona ' + d.id)], { type: 'model/stl' }), nazevSouboru('stl', d.id));
      for (const v of m.varovani) toast(v);
      toast(`STL: ${m.kusu} ${m.kusu === 1 ? 'kus' : m.kusu < 5 ? 'kusy' : 'kusů'} (${m.rozmery.map((q) => q.join(' × ')).join('; ')} mm), tl. ${KR.cz(m.tloustka, 1)} mm, objem ${KR.cz(m.objem / 1000, 1)} cm³ – uzavřené těleso.`);
    } catch (e) { console.error(e); toast('Chyba STL: ' + e.message, true); }
    finally { b.disabled = false; b.textContent = puv; }
  });

  /* ---------- 3D (three.js až když je karta vidět) ---------- */
  let pohled3d = null, nacita3d = false;
  function aktualizuj3d() {
    if (!pohled3d || !V) return;
    pohled3d.aktualizuj(V.teleso || null);
    $('stav3d').textContent = V.teleso ? { vytlac: V.teleso.lista ? 'Úsek lišty s profilem' : V.teleso.stojici ? 'Díl s výřezem' : 'Šablona / díl', rotace: 'Soustružený díl (rotační těleso)', loft: 'Noha po vyřezání ze dvou stran' }[V.teleso.typ] || '' : 'Pro tento režim není 3D model';
  }
  function nacti3d() {
    if (pohled3d || nacita3d) return;
    nacita3d = true;
    const hotovo = () => { try { pohled3d = window.OBL3D.vytvor($('obal3d')); aktualizuj3d(); } catch (e) { $('stav3d').textContent = '3D se nepodařilo spustit: ' + e.message; } };
    if (window.THREE) { hotovo(); return; }
    nactiSkript('lib/three.0.160.0.min.js').then(hotovo).catch((e) => { nacita3d = false; $('stav3d').textContent = 'three.js se nenačetl: ' + e.message; });
  }
  new IntersectionObserver((z) => { if (z.some((x) => x.isIntersecting)) nacti3d(); }, { rootMargin: '200px' }).observe($('obal3d'));
  $('b3dVychozi').addEventListener('click', () => pohled3d && pohled3d.pohled(-35, 28));
  $('b3dShora').addEventListener('click', () => pohled3d && pohled3d.pohled(0, 89));
  $('b3dZepredu').addEventListener('click', () => pohled3d && pohled3d.pohled(0, 2));
  $('b3dBok').addEventListener('click', () => pohled3d && pohled3d.pohled(-90, 2));

  /* ---------- projekty ---------- */
  function vykresliProjekty() {
    const Pj = projekty(), jm = Object.keys(Pj).sort((a, b) => a.localeCompare(b, 'cs'));
    $('seznamProjektu').innerHTML = jm.length ? jm.map((j) => `<option value="${esc(j)}">${esc(j)} – ${esc((R.REZIMY[Pj[j].rezim] || {}).nazev || '')}</option>`).join('') : '<option value="">– zatím nic –</option>';
  }
  $('btnUlozit').addEventListener('click', async () => {
    let jm = (S.nazev || '').trim();
    if (!jm) { jm = await Dialog.zeptej('Název projektu', R.REZIMY[S.rezim].nazev); if (!jm) return; jm = jm.trim(); S.nazev = jm; $('nazevProjektu').value = jm; }
    const Pj = projekty();
    if (Pj[jm] && !(await Dialog.potvrd(`Projekt „${jm}“ už existuje. Přepsat?`))) return;
    Pj[jm] = JSON.parse(JSON.stringify(S)); Pj[jm].ulozeno = new Date().toISOString();
    if (ulozProjekty(Pj)) { vykresliProjekty(); $('seznamProjektu').value = jm; toast('Projekt uložen.'); }
    uloz();
  });
  function nactiProjekt(u) { S = slouc(R.vychoziProjekt(), u); vykresliRezimy(); vykresliPole(); doNastaveni(); prepocti(); }
  $('btnNacist').addEventListener('click', () => { const j = $('seznamProjektu').value, Pj = projekty(); if (!Pj[j]) return; nactiProjekt(Pj[j]); toast('Načteno: ' + j); });
  $('btnSmazat').addEventListener('click', async () => {
    const j = $('seznamProjektu').value, Pj = projekty(); if (!Pj[j]) return;
    if (!(await Dialog.potvrd(`Smazat projekt „${j}“?`))) return;
    delete Pj[j]; ulozProjekty(Pj); vykresliProjekty();
  });
  $('btnExport').addEventListener('click', () => stahni(JSON.stringify(Object.assign({ aplikace: 'oblouky_profily', exportovano: new Date().toISOString() }, JSON.parse(JSON.stringify(S))), null, 1), nazevSouboru('json'), 'application/json'));
  $('btnImport').addEventListener('click', () => $('souborProjekt').click());
  $('souborProjekt').addEventListener('change', async () => {
    const f = $('souborProjekt').files[0]; $('souborProjekt').value = '';
    if (!f) return;
    try {
      const u = JSON.parse(await f.text());
      if (!u || typeof u !== 'object' || !u.p || !R.REZIMY[u.rezim]) throw new Error('soubor není projekt šablon oblouků');
      nactiProjekt(u); toast('Projekt importován.');
    } catch (e) { toast('Import se nepodařil: ' + e.message, true); }
  });
  $('btnReset').addEventListener('click', async () => {
    if (!(await Dialog.potvrd('Vrátit všechny parametry na výchozí hodnoty? (Uložené projekty zůstanou.)'))) return;
    S = R.vychoziProjekt(S.rezim); vykresliRezimy(); vykresliPole(); doNastaveni(); prepocti();
  });

  /* ---------- záložky a klávesy ---------- */
  $('zalozky').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-z]'); if (!b) return;
    for (const x of $('zalozky').children) x.setAttribute('aria-selected', String(x === b));
    for (const p of document.querySelectorAll('.panel')) p.hidden = p.dataset.p !== b.dataset.z;
  });
  document.addEventListener('keydown', (e) => {
    const t = e.target;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    const m = /^(?:Digit|Numpad)([0-9])$/.exec(e.code);
    if (m) { const i = m[1] === '0' ? 9 : +m[1] - 1; if (REZIMY[i]) { e.preventDefault(); nastavRezim(REZIMY[i]); } }
  });

  /* ---------- start ---------- */
  vykresliRezimy(); vykresliPole(); doNastaveni(); vykresliProjekty(); prepocti();
  window.OBLApp = { get stav() { return S; }, get vysledek() { return V; }, nastavRezim, prepocti, nactiManifold, get pohled3d() { return pohled3d; }, vyberDil(i) { S.dil = i; prepocti(); }, predvolba(i) { $('predvolba').value = String(i); $('predvolba').dispatchEvent(new Event('change')); } };
})();

/* ============================================================
   Vrtací šablony – uživatelské rozhraní
   ============================================================ */
(function () {
  'use strict';
  const VS = window.VS, VSV = window.VSV, VSN = window.VSN, VSSTL = window.VSSTL;
  const $ = (id) => document.getElementById(id);
  const KLIC = 'webapp_vrtaci_sablony', KLIC_PROJEKTY = 'webapp_vrtaci_sablony_projekty';
  const cz = (x, d) => (x == null || !isFinite(x) ? '–' : String(Math.round(x * Math.pow(10, d == null ? 2 : d)) / Math.pow(10, d == null ? 2 : d)).replace('.', ',').replace('-', '−'));
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const toast = (t, ch) => (window.Dialog ? (ch ? Dialog.chyba(t) : Dialog.info(t)) : console.log(t));
  const REZIMY = Object.keys(VS.REZIMY);
  const NAST_POLE = ['okrajSablony', 'chlopen', 'dosahRef', 'popisy', 'koty', 'papir', 'okraj', 'prekryv', 'papirW', 'papirH', 'kalibX', 'kalibY',
    'stlTl', 'dorazV', 'dorazS', 'otvor', 'vule', 'pouzdroD', 'pouzdroPres', 'pouzdroDo', 'vedeni', 'vedeniStena', 'stul', 'oznaceni', 'par', 'krouzekV', 'krouzekStena', 'srouubek'];

  /* ---------- stav ---------- */
  function nacistStav() {
    const P = VS.vychoziProjekt();
    try {
      const u = JSON.parse(localStorage.getItem(KLIC) || 'null');
      if (u && u.p) return slouc(P, u);
    } catch (e) { /* poškozené úložiště */ }
    return P;
  }
  function slouc(P, u) {
    if (VS.REZIMY[u.rezim]) P.rezim = u.rezim;
    for (const r of REZIMY) if (u.p && u.p[r]) P.p[r] = Object.assign(P.p[r], u.p[r]);
    P.nast = Object.assign(P.nast, u.nast || {});
    P.nazev = u.nazev || '';
    P.vybranyDil = u.vybranyDil || 0;
    return P;
  }
  let S = nacistStav(), N = null, vybranaDira = null, ulozTimer = 0;
  const uloz = () => { clearTimeout(ulozTimer); ulozTimer = setTimeout(() => { try { localStorage.setItem(KLIC, JSON.stringify(S)); } catch (e) { /* plné úložiště */ } }, 250); };
  const projekty = () => { try { return JSON.parse(localStorage.getItem(KLIC_PROJEKTY) || '{}') || {}; } catch (e) { return {}; } };
  const ulozProjekty = (o) => { try { localStorage.setItem(KLIC_PROJEKTY, JSON.stringify(o)); return true; } catch (e) { toast('Úložiště prohlížeče je plné.', true); return false; } };

  /* ---------- režimy ---------- */
  function vykresliRezimy() {
    let h = '';
    for (const [sk, nazev] of VS.SKUPINY) {
      const r = REZIMY.filter((k) => VS.REZIMY[k].skupina === sk);
      h += `<div class="skupina">${nazev}</div><div class="rezimy">`;
      for (const k of r) {
        const i = REZIMY.indexOf(k), R = VS.REZIMY[k], kl = i < 9 ? String(i + 1) : i === 9 ? '0' : '';
        h += `<button type="button" data-rezim="${k}" aria-pressed="${k === S.rezim}" title="${esc(R.popis)}${kl ? ' (klávesa ' + kl + ')' : ''}"><span class="ik" aria-hidden="true">${R.ikona}</span>${esc(R.nazev)}${kl ? `<kbd>${kl}</kbd>` : ''}</button>`;
      }
      h += '</div>';
    }
    $('rezimy').innerHTML = h;
  }
  function nastavRezim(k) {
    if (!VS.REZIMY[k] || k === S.rezim) return;
    S.rezim = k; S.vybranyDil = 0; vybranaDira = null;
    for (const b of $('rezimy').querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.rezim === k));
    vykresliPole(); prepocti();
  }
  $('rezimy').addEventListener('click', (e) => { const b = e.target.closest('button[data-rezim]'); if (b) nastavRezim(b.dataset.rezim); });

  /* ---------- formulář parametrů režimu ---------- */
  function vykresliPole() {
    const R = VS.REZIMY[S.rezim], p = S.p[S.rezim];
    $('nazevRezimu').textContent = R.nazev;
    $('popisRezimu').textContent = R.popis;
    let h = '';
    for (const f of R.pole) {
      if (f.t === 'body') continue;
      const id = 'p_' + f.k, v = p[f.k];
      if (f.t === 'b') h += `<div class="cela" data-pole="${f.k}"><label class="chk"><input type="checkbox" id="${id}"${v ? ' checked' : ''}> ${esc(f.n)}</label></div>`;
      else if (f.t === 'v') h += `<div class="${f.n.length > 34 ? 'cela' : ''}" data-pole="${f.k}"><label for="${id}">${esc(f.n)}</label><select id="${id}">${f.m.map(([a, b]) => `<option value="${esc(a)}"${String(v) === String(a) ? ' selected' : ''}>${esc(b)}</option>`).join('')}</select></div>`;
      else if (f.t === 's') h += `<div class="cela" data-pole="${f.k}"><label for="${id}">${esc(f.n)}</label><input id="${id}" type="text" value="${esc(v)}"></div>`;
      else h += `<div class="${f.n.length > 40 ? 'cela' : ''}" data-pole="${f.k}"><label for="${id}">${esc(f.n)}</label><input id="${id}" type="number" inputmode="decimal" value="${esc(v)}"${f.min != null ? ` min="${f.min}"` : ''}${f.max != null ? ` max="${f.max}"` : ''} step="${f.krok || 1}"></div>`;
    }
    $('pole').innerHTML = h;
    $('blokBody').classList.toggle('skryte', S.rezim !== 'vlastni');
    if (S.rezim === 'vlastni') vykresliBody();
    viditelnostPoli();
    $('nahled').classList.toggle('klik', S.rezim === 'vlastni');
  }
  function viditelnostPoli() {
    const R = VS.REZIMY[S.rezim], p = VS.normalizuj(S.rezim, S.p[S.rezim]);
    for (const f of R.pole) {
      if (!f.k || f.t === 'body') continue;
      const el = $('pole').querySelector(`[data-pole="${f.k}"]`);
      if (el) el.classList.toggle('skryte', !!(f.ukaz && !f.ukaz(p)));
    }
  }
  $('pole').addEventListener('input', (e) => {
    const el = e.target; if (!el.id || !el.id.startsWith('p_')) return;
    const k = el.id.slice(2), f = VS.REZIMY[S.rezim].pole.find((q) => q.k === k);
    if (!f) return;
    S.p[S.rezim][k] = f.t === 'b' ? el.checked : f.t === 'v' || f.t === 's' ? el.value : el.value === '' ? S.p[S.rezim][k] : parseFloat(String(el.value).replace(',', '.'));
    if (S.rezim === 'pcd' && k === 'preset') {
      const q = VS.PCD_PRESETY.find((x) => x.id === el.value);
      if (q && q.n) { Object.assign(S.p.pcd, { pocet: q.n, D: q.D }, q.d ? { prumer: q.d } : {}, q.vnejsi ? { vnejsi: q.vnejsi } : {}, q.stred != null ? { stred: q.stred } : {}); S.p.pcd.preset = ''; vykresliPole(); }
    }
    if (S.rezim === 'pcd' && ['pocet', 'D', 'prumer', 'vnejsi', 'stred'].includes(k)) S.p.pcd.preset = '';
    viditelnostPoli(); naplanuj();
  });
  $('pole').addEventListener('change', (e) => { if (e.target.tagName === 'SELECT' || e.target.type === 'checkbox') { viditelnostPoli(); naplanuj(); } });

  /* ---------- vlastní body ---------- */
  function vykresliBody() {
    const b = S.p.vlastni.body || [];
    let h = '<tr><th>#</th><th>x</th><th>y</th><th>Ø</th><th>hl.</th><th>popis</th><th></th></tr>';
    b.forEach((q, i) => {
      h += `<tr data-i="${i}"><td>${i + 1}</td>` + ['x', 'y', 'd', 'hl'].map((k) => `<td><input type="number" step="0.1" data-k="${k}" value="${esc(q[k])}" aria-label="${k} bodu ${i + 1}"></td>`).join('')
        + `<td><input type="text" data-k="popis" value="${esc(q.popis || '')}" aria-label="popis bodu ${i + 1}"></td><td><button class="btn btn-sec btn-mini" data-smaz="${i}" type="button" title="Smazat bod" aria-label="Smazat bod ${i + 1}">✕</button></td></tr>`;
    });
    $('tabBody').innerHTML = h;
  }
  $('tabBody').addEventListener('input', (e) => {
    const tr = e.target.closest('tr[data-i]'); if (!tr) return;
    const q = S.p.vlastni.body[+tr.dataset.i], k = e.target.dataset.k;
    q[k] = k === 'popis' ? e.target.value : parseFloat(String(e.target.value).replace(',', '.'));
    naplanuj();
  });
  $('tabBody').addEventListener('click', (e) => {
    const b = e.target.closest('[data-smaz]'); if (!b) return;
    S.p.vlastni.body.splice(+b.dataset.smaz, 1); vykresliBody(); prepocti();
  });
  $('btnBodPridat').addEventListener('click', () => {
    const p = S.p.vlastni, b = p.body || (p.body = []);
    b.push({ x: VS.r2((+p.sirka || 300) / 2), y: VS.r2((+p.vyska || 200) / 2), d: +p.prumer || 5, hl: +p.hl || 0, popis: '' });
    vykresliBody(); prepocti();
  });
  $('btnBodySmazat').addEventListener('click', async () => {
    if (!(S.p.vlastni.body || []).length) return;
    if (!(await Dialog.potvrd('Smazat všechny vlastní body?'))) return;
    S.p.vlastni.body = []; vykresliBody(); prepocti();
  });
  $('btnImportBody').addEventListener('click', () => $('souborBody').click());
  $('souborBody').addEventListener('change', async () => {
    const f = $('souborBody').files[0]; $('souborBody').value = '';
    if (!f) return;
    try {
      const txt = await f.text(), p = S.p.vlastni, vych = { d: +p.prumer || 5, hl: +p.hl || 0 };
      const body = /\.dxf$/i.test(f.name) || /\bENTITIES\b/.test(txt) ? VS.importDXF(txt, vych) : VS.importCSV(txt, vych);
      if (!body.length) { toast('V souboru nejsou žádné body.', true); return; }
      const nahradit = !(p.body || []).length || await Dialog.potvrd(`Načteno ${body.length} bodů. Nahradit stávající body? (Zrušit = přidat k nim)`);
      p.body = nahradit ? body : (p.body || []).concat(body);
      // deska tak velká, aby se body vešly
      const mx = Math.max(...p.body.map((q) => q.x + q.d)), my = Math.max(...p.body.map((q) => q.y + q.d));
      if (mx > p.sirka) p.sirka = Math.ceil(mx + 10); if (my > p.vyska) p.vyska = Math.ceil(my + 10);
      vykresliPole(); prepocti(); toast(`Importováno ${body.length} bodů.`);
    } catch (e) { toast('Import se nepodařil: ' + e.message, true); }
  });

  /* ---------- nastavení šablony / tisku / STL ---------- */
  function doNastaveni() {
    for (const id of NAST_POLE) { const el = $(id); if (!el) continue; if (el.type === 'checkbox') el.checked = !!S.nast[id]; else el.value = S.nast[id]; }
    $('nazevProjektu').value = S.nazev || '';
    viditelnostNast();
  }
  function viditelnostNast() {
    $('blokPapir').classList.toggle('skryte', S.nast.papir !== 'vlastni');
    $('blokPouzdro').classList.toggle('skryte', S.nast.otvor !== 'pouzdro');
  }
  for (const id of NAST_POLE) {
    const el = $(id); if (!el) continue;
    el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', () => {
      if (el.type === 'checkbox') S.nast[id] = el.checked;
      else if (el.tagName === 'SELECT') S.nast[id] = el.value;
      else { const x = parseFloat(String(el.value).replace(',', '.')); if (isFinite(x)) S.nast[id] = x; }
      viditelnostNast(); naplanuj();
    });
  }
  $('nazevProjektu').addEventListener('input', () => { S.nazev = $('nazevProjektu').value; uloz(); });

  /* ---------- přepočet a vykreslení ---------- */
  let timer = 0;
  const naplanuj = () => { clearTimeout(timer); timer = setTimeout(prepocti, 80); };
  const dil = () => (N && N.dily[Math.min(S.vybranyDil || 0, N.dily.length - 1)]) || null;
  let sit3d = null;     // síť přípravku pro 3D (zahodí se po změně)
  function prepocti() {
    try { N = VS.navrh(S); } catch (e) { console.error(e); $('varovani').innerHTML = `<li class="chyba">${esc(e.message)}</li>`; return; }
    sit3d = null;
    if ((S.vybranyDil || 0) >= N.dily.length) S.vybranyDil = 0;
    $('dily').innerHTML = N.dily.map((d, i) => `<button type="button" role="tab" data-dil="${i}" aria-selected="${i === S.vybranyDil}">${esc(d.id)} – ${esc(d.nazev)}</button>`).join('');
    $('info').innerHTML = N.info ? esc(N.info) : '';
    $('varovani').innerHTML = N.varovani.map((v) => `<li>${esc(v)}</li>`).join('');
    vykresliDil();
    const K = VS.korekceMeritka(S.nast.kalibX, S.nast.kalibY);
    $('kalibVysl').innerHTML = K.platne ? `X ×${cz(K.kx, 4)}<br>Y ×${cz(K.ky, 4)}` : '<span class="chyba">mimo 80–120 mm</span>';
    $('princip').innerHTML = VSPrincip.princip(S.rezim);
    $('postup').innerHTML = VSPrincip.postup(S.rezim);
    uloz();
  }
  function vykresliDil() {
    const d = dil();
    if (!d) { $('nahled').innerHTML = '<p class="info" style="padding:12px;color:#555">Žádný díl.</p>'; $('rez').innerHTML = ''; $('nahledSablony').innerHTML = ''; $('tabDiry').innerHTML = ''; return; }
    $('rozmerNahled').textContent = `${cz(d.w, 1)} × ${cz(d.h, 1)} mm${d.t && !d.zed ? ' · tl. ' + cz(d.t, 1) : ''} · ${d.diry.length} ${d.diry.length === 1 ? 'díra' : d.diry.length < 5 ? 'díry' : 'děr'} · ${d.pohled || ''}`;
    $('nahled').innerHTML = VSN.deska(d, S.nast, { vybrana: vybranaDira });
    $('rez').innerHTML = d.diry.length ? VSN.rez(d, S.nast) : '';
    // šablona s listy
    let rv = null;
    if (!d.prehled) {
      const L = VSN.listy(d, S.nast); rv = L.rv;
      $('nahledSablony').innerHTML = L.svg;
      const ob = d.oblast.papir;
      $('infoSablony').textContent = `${cz(ob.x1 - ob.x0, 1)} × ${cz(ob.y1 - ob.y0, 1)} mm · ${rv.listy.length} ${rv.listy.length === 1 ? 'list' : rv.listy.length < 5 ? 'listy' : 'listů'} ${rv.W > rv.H ? 'na šířku' : 'na výšku'}`;
    } else {
      $('nahledSablony').innerHTML = '<p class="info" style="padding:10px;color:#555">Přehled stěny se tiskne zmenšeně (1 list v měřítku). Šablony 1:1 jsou u jednotlivých rámů – vyberte je nahoře.</p>';
      $('infoSablony').textContent = 'přehled v měřítku';
    }
    // informace o listech celého projektu
    const [pw, ph] = VS.rozmerPapiru(S.nast);
    let celkem = 0;
    for (const q of N.dily) celkem += q.prehled ? 1 : VS.rozvrhListu(q.oblast.papir, pw, ph, S.nast, Math.max(0, ...q.diry.map((x) => x.d))).listy.length;
    $('infoListy').innerHTML = `Celý projekt: <b>${celkem}</b> ${celkem === 1 ? 'list' : celkem < 5 ? 'listy' : 'listů'} šablon + tabulka souřadnic.${rv ? ` Vybraný díl: ${rv.listy.length}${rv.listy.length > 1 ? ` (${rv.nx} × ${rv.ny}, přesah ${cz(rv.g, 0)} mm)` : ''}.` : ''}`;
    // tabulka
    const hl = VSV.hlavickyTabulky(d), rows = VSV.radkyTabulky(d, S.nast, true);
    $('tabDiry').innerHTML = `<tr>${hl.map((x) => `<th>${esc(x)}</th>`).join('')}</tr>` + rows.map((r, i) => `<tr data-i="${i}"${i === vybranaDira ? ' style="background:var(--accent-soft)"' : ''}>${r.map((x) => `<td>${esc(x)}</td>`).join('')}</tr>`).join('');
    const sHl = d.diry.find((q) => q.hl);
    $('infoKrouzek').innerHTML = sHl ? `Sloupec „kroužek“ platí pro papírovou šablonu (= hloubka). S přípravkem tloušťky ${cz(+S.nast.stlTl, 1)} mm${+S.nast.vedeni ? ' a vedením ' + cz(+S.nast.vedeni, 1) + ' mm' : ''} nastavte kroužek na <b>hloubka + ${cz((+S.nast.stlTl || 0) + (+S.nast.vedeni || 0), 1)} mm</b> od špičky vrtáku.` : '';
    // STL info
    const otv = [...new Set(d.diry.map((q) => q.d))].sort((a, b) => a - b).map((x) => { const o = VS.otvorPripravku(x, S.nast); return `Ø${cz(x, 1)} → ${o.pouzdro ? 'pouzdro ' : ''}otvor ${cz(o.d, 2)}`; });
    const casti = d.prehled ? [] : VSSTL.casti(d, d.oblast, S.nast);
    $('infoStl').innerHTML = d.prehled ? 'Přehled stěny nemá přípravek – vyberte rám.' : `Otvory: ${otv.join(', ')}. ${casti.length > 1 ? `<span class="varovani">Delší než tisková plocha → ${casti.length} části se sdílenou indexovou dírou.</span>` : ''}${d.kruh ? (d.diry.some((q) => q.typ === 'stred' && q.d >= 6) && +S.nast.dorazV > 0 ? ' Středí se čepem ve středovém otvoru.' : ' Středí se límcem kolem obvodu dílu.') : d.oblast.hrany.length ? ` Dorazy: ${d.oblast.hrany.map((h) => ({ L: 'vlevo', P: 'vpravo', D: 'dole', H: 'nahoře' })[h]).join(', ')}.` : ' Bez dorazů (zeď) – vyrovnejte vodováhou.'}`;
    $('btnStl').disabled = !!d.prehled; $('btnStl3d').disabled = !!d.prehled;
    aktualizuj3d();
  }
  $('dily').addEventListener('click', (e) => { const b = e.target.closest('button[data-dil]'); if (!b) return; S.vybranyDil = +b.dataset.dil; vybranaDira = null; for (const x of $('dily').children) x.setAttribute('aria-selected', String(x === b)); sit3d = null; vykresliDil(); uloz(); });
  $('tabDiry').addEventListener('click', (e) => { const tr = e.target.closest('tr[data-i]'); if (!tr) return; vybranaDira = +tr.dataset.i === vybranaDira ? null : +tr.dataset.i; vykresliDil(); });

  // klik do náhledu: výběr díry, v režimu vlastních bodů přidání
  $('nahled').addEventListener('click', (e) => {
    const svg = $('nahled').querySelector('svg'); if (!svg) return;
    const g = e.target.closest('g[data-i]');
    if (g) { vybranaDira = +g.dataset.i; vykresliDil(); return; }
    if (S.rezim !== 'vlastni') return;
    const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const m = svg.getScreenCTM(); if (!m) return;
    const q = pt.matrixTransform(m.inverse()), p = S.p.vlastni, sn = +p.mrizkaKliku || 0;
    let x = q.x, y = -q.y;
    if (sn > 0) { x = Math.round(x / sn) * sn; y = Math.round(y / sn) * sn; }
    if (x < 0 || y < 0 || x > p.sirka || y > p.vyska) return;
    (p.body || (p.body = [])).push({ x: VS.r2(x), y: VS.r2(y), d: +p.prumer || 5, hl: +p.hl || 0, popis: '' });
    vybranaDira = p.body.length - 1;
    vykresliBody(); prepocti();
  });

  /* ---------- soubory ---------- */
  function stahni(obsah, nazev, typ) {
    const blob = obsah instanceof Blob ? obsah : new Blob([obsah], { type: typ || 'application/octet-stream' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nazev;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  const zaklad = () => String(S.nazev || 'vrtaci_sablona_' + S.rezim).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'vrtaci_sablona';
  const nazevSouboru = (pripona, dilId) => `${zaklad()}${dilId ? '_' + dilId : ''}.${pripona}`;
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
      const nazev = (S.nazev || 'Vrtací šablona') + ' – ' + VS.REZIMY[S.rezim].nazev;
      const st = VSV.strany(N, S.nast, { nazev, jenDil: jenDil ? dil().id : null });
      const doc = VSV.pdf(window.jspdf.jsPDF, st, { pismo, nazev });
      stahni(doc.output('blob'), nazevSouboru('pdf', jenDil ? dil().id : ''));
    } catch (e) { console.error(e); toast('Chyba PDF: ' + e.message, true); }
    finally { b.disabled = false; b.textContent = puv; }
  }
  $('btnPdf').addEventListener('click', () => pdfStahnout(false));
  $('btnPdfDil').addEventListener('click', () => pdfStahnout(true));
  $('btnSvg').addEventListener('click', () => { const d = dil(); if (!d) return; stahni(VSV.svg(VSV.scena(d, S.nast), { okraj: 2 }), nazevSouboru('svg', d.id), 'image/svg+xml'); });
  $('btnDxf').addEventListener('click', () => { const d = dil(); if (!d) return; stahni(VSV.dxf(VSV.scena(d, S.nast)), nazevSouboru('dxf', d.id), 'application/dxf'); });
  $('btnCsv').addEventListener('click', () => { if (!N) return; stahni('﻿' + VSV.csv(N.dily), nazevSouboru('csv'), 'text/csv;charset=utf-8'); });

  /* ---------- STL (manifold se načte až na vyžádání) ---------- */
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
  async function sPrubehem(id, text, fn) {
    const b = $(id), puv = b.textContent; b.disabled = true; b.textContent = text;
    try { await new Promise((r) => setTimeout(r, 20)); return await fn(); } catch (e) { console.error(e); toast('Chyba STL: ' + e.message, true); return null; }
    finally { b.disabled = false; b.textContent = puv; }
  }
  async function sitPripravku(naMiste) {
    const d = dil(), w = await nactiManifold();
    return VSSTL.pripravek(w, d, naMiste ? Object.assign({}, S.nast, { naMiste: true, par: false }) : S.nast);
  }
  $('btnStl').addEventListener('click', () => sPrubehem('btnStl', 'Počítám STL…', async () => {
    const d = dil(), m = await sitPripravku();
    stahni(new Blob([VSSTL.stlBinarni(m.poz, m.idx, 'vrtaci pripravek ' + d.id)], { type: 'model/stl' }), nazevSouboru('stl', d.id + '_pripravek'));
    for (const v of m.varovani) toast(v);
    toast(`Přípravek: ${m.kusu} ${m.kusu === 1 ? 'kus' : m.kusu < 5 ? 'kusy' : 'kusů'}, ${m.otvory.length} otvorů, objem ${cz(m.objem / 1000, 1)} cm³ (uzavřené těleso).`);
  }));
  $('btnStlKrouzky').addEventListener('click', () => sPrubehem('btnStlKrouzky', 'Počítám STL…', async () => {
    const w = await nactiManifold(), m = VSSTL.krouzky(w, N.dily, S.nast);
    stahni(new Blob([VSSTL.stlBinarni(m.poz, m.idx, 'hloubkove krouzky')], { type: 'model/stl' }), nazevSouboru('stl', 'krouzky'));
    toast('Kroužky pro vrtáky ' + m.krouzky.map((k) => 'Ø' + cz(k.vrtak, 1)).join(', ') + '; šroub ' + cz(+S.nast.srouubek, 1) + ' mm zašroubujte do radiálního otvoru.');
  }));
  $('btnStl3d').addEventListener('click', () => sPrubehem('btnStl3d', 'Počítám…', async () => {
    sit3d = await sitPripravku(true);
    aktualizuj3d();
    document.getElementById('obal3d').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }));

  /* ---------- 3D (three.js se načte, až bude karta vidět) ---------- */
  let pohled3d = null, nacita3d = false, prilozit = true;
  function aktualizuj3d() {
    if (!pohled3d) return;
    const d = dil(); if (!d) return;
    let svg = null, sw = 0, sh = 0, oblast = null;
    if (!d.prehled) {
      const sc = VSV.scena(d, S.nast);
      svg = VSV.svg(sc, { okraj: 0 }); sw = sc.x1 - sc.x0; sh = sc.y1 - sc.y0; oblast = { x0: sc.x0, y0: sc.y0, x1: sc.x1, y1: sc.y1 };
    }
    const vlastni = sit3d && d.prehled !== true ? sit3d : null;
    pohled3d.aktualizuj(d, { svg, svgW: sw, svgH: sh, oblast, sit: vlastni && vlastni.casti && vlastni.casti.length === 1 ? vlastni : (vlastni ? vlastni : null), prilozit });
    $('stav3d').textContent = vlastni ? (vlastni.casti.length > 1 ? `Přípravek z 3D tisku – ${vlastni.casti.length} části na místě (v STL vedle sebe)` : 'Přípravek z 3D tisku') : d.prehled ? '' : 'Papírová šablona';
  }
  function nacti3d() {
    if (pohled3d || nacita3d) return;
    nacita3d = true;
    const hotovo = () => { try { pohled3d = VS3D.vytvor($('obal3d')); $('stav3d').textContent = ''; aktualizuj3d(); } catch (e) { $('stav3d').textContent = '3D se nepodařilo spustit: ' + e.message; } };
    if (window.THREE) { hotovo(); return; }
    nactiSkript('lib/three.0.160.0.min.js').then(hotovo).catch((e) => { nacita3d = false; $('stav3d').textContent = 'three.js se nenačetl: ' + e.message; });
  }
  new IntersectionObserver((z) => { if (z.some((x) => x.isIntersecting)) nacti3d(); }, { rootMargin: '200px' }).observe($('obal3d'));
  $('b3dVychozi').addEventListener('click', () => pohled3d && pohled3d.pohled(-30, 38));
  $('b3dShora').addEventListener('click', () => pohled3d && pohled3d.pohled(0, 89));
  $('b3dBok').addEventListener('click', () => pohled3d && pohled3d.pohled(-90, 6));
  $('b3dPrilozit').addEventListener('click', () => { prilozit = !prilozit; $('b3dPrilozit').setAttribute('aria-pressed', String(prilozit)); $('b3dPrilozit').textContent = prilozit ? 'Šablona přiložená' : 'Šablona nad deskou'; aktualizuj3d(); });

  /* ---------- projekty ---------- */
  function vykresliProjekty() {
    const P = projekty(), jm = Object.keys(P).sort((a, b) => a.localeCompare(b, 'cs'));
    $('seznamProjektu').innerHTML = jm.length ? jm.map((j) => `<option value="${esc(j)}">${esc(j)} – ${esc((VS.REZIMY[P[j].rezim] || {}).nazev || '')}</option>`).join('') : '<option value="">– zatím nic –</option>';
  }
  $('btnUlozit').addEventListener('click', async () => {
    let jm = (S.nazev || '').trim();
    if (!jm) { jm = await Dialog.zeptej('Název projektu', VS.REZIMY[S.rezim].nazev); if (!jm) return; jm = jm.trim(); S.nazev = jm; $('nazevProjektu').value = jm; }
    const P = projekty();
    if (P[jm] && !(await Dialog.potvrd(`Projekt „${jm}“ už existuje. Přepsat?`))) return;
    P[jm] = JSON.parse(JSON.stringify(S)); P[jm].ulozeno = new Date().toISOString();
    if (ulozProjekty(P)) { vykresliProjekty(); $('seznamProjektu').value = jm; toast('Projekt uložen.'); }
    uloz();
  });
  function nactiProjekt(u) {
    S = slouc(VS.vychoziProjekt(), u); vybranaDira = null;
    vykresliRezimy(); vykresliPole(); doNastaveni(); prepocti();
  }
  $('btnNacist').addEventListener('click', () => { const j = $('seznamProjektu').value, P = projekty(); if (!P[j]) return; nactiProjekt(P[j]); toast('Načteno: ' + j); });
  $('btnSmazat').addEventListener('click', async () => {
    const j = $('seznamProjektu').value, P = projekty(); if (!P[j]) return;
    if (!(await Dialog.potvrd(`Smazat projekt „${j}“?`))) return;
    delete P[j]; ulozProjekty(P); vykresliProjekty();
  });
  $('btnExport').addEventListener('click', () => {
    const data = Object.assign({ aplikace: 'vrtaci_sablony', exportovano: new Date().toISOString() }, JSON.parse(JSON.stringify(S)));
    stahni(JSON.stringify(data, null, 1), nazevSouboru('json'), 'application/json');
  });
  $('btnImport').addEventListener('click', () => $('souborProjekt').click());
  $('souborProjekt').addEventListener('change', async () => {
    const f = $('souborProjekt').files[0]; $('souborProjekt').value = '';
    if (!f) return;
    try {
      const u = JSON.parse(await f.text());
      if (!u || typeof u !== 'object' || !u.p || !VS.REZIMY[u.rezim]) throw new Error('soubor není projekt vrtacích šablon');
      nactiProjekt(u); toast('Projekt importován.');
    } catch (e) { toast('Import se nepodařil: ' + e.message, true); }
  });
  $('btnReset').addEventListener('click', async () => {
    if (!(await Dialog.potvrd('Vrátit všechny parametry na výchozí hodnoty? (Uložené projekty zůstanou.)'))) return;
    const r = S.rezim; S = VS.vychoziProjekt(r); vykresliRezimy(); vykresliPole(); doNastaveni(); prepocti();
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
  window.VSApp = { get stav() { return S; }, get navrh() { return N; }, nastavRezim, prepocti, nactiManifold, sitPripravku, get pohled3d() { return pohled3d; }, ukazPripravek: () => $('btnStl3d').click() };
})();

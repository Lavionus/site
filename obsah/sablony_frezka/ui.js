/* ============================================================
   Šablony pro horní frézku – uživatelské rozhraní
   ============================================================ */
(function () {
  'use strict';
  const SF = window.SF, SFV = window.SFV, SFN = window.SFN, SFSTL = window.SFSTL, G = window.SFG;
  const $ = (id) => document.getElementById(id);
  const KLIC = 'webapp_sablony_frezka', KLIC_PROJEKTY = 'webapp_sablony_frezka_projekty';
  const cz = (x, d) => (x == null || !isFinite(x) ? '–' : SF.cz(x, d == null ? 2 : d));
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const toast = (t, ch) => (window.Dialog ? (ch ? Dialog.chyba(t) : Dialog.info(t)) : console.log(t));
  const REZIMY = Object.keys(SF.REZIMY);
  const NAST_POLE = ['vedeni', 'Df', 'Dk', 'Dl', 'vyskaKrouzku', 'hloubka', 'tris', 'tlObrobku', 'tlSablony', 'okrajDesky', 'Dz',
    'papir', 'okrajTisku', 'prekryv', 'papirW', 'papirH', 'drahy', 'kalibX', 'kalibY', 'stul', 'vulePuzzle', 'oznaceni'];
  const UKAZKA_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 90"><path d="M50 88C20 62 2 46 2 27 2 12 13 2 27 2c10 0 18 6 23 14C55 8 63 2 73 2c14 0 25 10 25 25 0 19-18 35-48 61z"/></svg>';

  /* ---------- stav ---------- */
  function slouc(P, u) {
    if (SF.REZIMY[u.rezim]) P.rezim = u.rezim;
    for (const r of REZIMY) if (u.p && u.p[r]) P.p[r] = Object.assign(P.p[r], u.p[r]);
    P.nast = Object.assign(P.nast, u.nast || {});
    P.nazev = u.nazev || ''; P.vybranyDil = u.vybranyDil || 0;
    return P;
  }
  function nacistStav() {
    const P = SF.vychoziProjekt();
    try { const u = JSON.parse(localStorage.getItem(KLIC) || 'null'); if (u && u.p) return slouc(P, u); } catch (e) { /* poškozené úložiště */ }
    return P;
  }
  let S = nacistStav(), NV = null, ulozTimer = 0;
  const uloz = () => { clearTimeout(ulozTimer); ulozTimer = setTimeout(() => { try { localStorage.setItem(KLIC, JSON.stringify(S)); } catch (e) { /* plné úložiště (velké SVG) */ } }, 300); };
  const projekty = () => { try { return JSON.parse(localStorage.getItem(KLIC_PROJEKTY) || '{}') || {}; } catch (e) { return {}; } };
  const ulozProjekty = (o) => { try { localStorage.setItem(KLIC_PROJEKTY, JSON.stringify(o)); return true; } catch (e) { toast('Úložiště prohlížeče je plné.', true); return false; } };

  /* ---------- režimy ---------- */
  function vykresliRezimy() {
    let h = '';
    for (const [sk, nazev] of SF.SKUPINY) {
      h += `<div class="skupina">${nazev}</div><div class="rezimy">`;
      for (const k of REZIMY.filter((x) => SF.REZIMY[x].skupina === sk)) {
        const i = REZIMY.indexOf(k), R = SF.REZIMY[k], kl = i < 9 ? String(i + 1) : i === 9 ? '0' : '';
        h += `<button type="button" data-rezim="${k}" aria-pressed="${k === S.rezim}" title="${esc(R.popis)}${kl ? ' (klávesa ' + kl + ')' : ''}"><span class="ik" aria-hidden="true">${R.ikona}</span>${esc(R.nazev)}${kl ? `<kbd>${kl}</kbd>` : ''}</button>`;
      }
      h += '</div>';
    }
    $('rezimy').innerHTML = h;
  }
  function nastavRezim(k) {
    if (!SF.REZIMY[k] || k === S.rezim) return;
    S.rezim = k; S.vybranyDil = 0;
    for (const b of $('rezimy').querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.rezim === k));
    vykresliPole(); prepocti();
  }
  $('rezimy').addEventListener('click', (e) => { const b = e.target.closest('button[data-rezim]'); if (b) nastavRezim(b.dataset.rezim); });

  /* ---------- formulář tvaru ---------- */
  function vykresliPole() {
    const R = SF.REZIMY[S.rezim], p = S.p[S.rezim];
    $('nazevRezimu').textContent = R.nazev; $('popisRezimu').textContent = R.popis;
    let h = '';
    for (const f of R.pole) {
      if (f.t === 'svg') continue;
      const id = 'p_' + f.k, v = p[f.k];
      if (f.t === 'v') h += `<div class="${f.n.length > 30 || f.m.some((m) => m[1].length > 22) ? 'cela' : ''}" data-pole="${f.k}"><label for="${id}">${esc(f.n)}</label><select id="${id}">${f.m.map(([a, b]) => `<option value="${esc(a)}"${String(v) === String(a) ? ' selected' : ''}>${esc(b)}</option>`).join('')}</select></div>`;
      else if (f.t === 'ta') h += `<div class="cela" data-pole="${f.k}"><label for="${id}">${esc(f.n)}</label><textarea id="${id}" rows="2" spellcheck="false">${esc(v)}</textarea></div>`;
      else h += `<div class="${f.n.length > 30 ? 'cela' : ''}" data-pole="${f.k}"><label for="${id}">${esc(f.n)}</label><input id="${id}" type="number" inputmode="decimal" value="${esc(v)}"${f.min != null ? ` min="${f.min}"` : ''}${f.max != null ? ` max="${f.max}"` : ''} step="${f.krok || 1}"></div>`;
    }
    $('pole').innerHTML = h;
    $('blokSvg').classList.toggle('skryte', S.rezim !== 'svg');
    if (S.rezim === 'svg') $('infoSvg').textContent = S.p.svg.svg ? `Načteno ${S.p.svg.nazevSouboru || 'SVG'} (${SF.cz(S.p.svg.svg.length / 1024, 1)} kB).` : 'Zatím žádné SVG.';
    viditelnostPoli();
  }
  function viditelnostPoli() {
    const R = SF.REZIMY[S.rezim], p = SF.normalizuj(S.rezim, S.p[S.rezim]);
    for (const f of R.pole) { const el = $('pole').querySelector(`[data-pole="${f.k}"]`); if (el) el.classList.toggle('skryte', !!(f.ukaz && !f.ukaz(p))); }
  }
  $('pole').addEventListener('input', (e) => {
    const el = e.target; if (!el.id || !el.id.startsWith('p_')) return;
    const k = el.id.slice(2), f = SF.REZIMY[S.rezim].pole.find((q) => q.k === k); if (!f) return;
    const p = S.p[S.rezim];
    if (f.t === 'v' || f.t === 'ta') p[k] = el.value;
    else { const x = parseFloat(String(el.value).replace(',', '.')); if (isFinite(x)) p[k] = x; }
    if (S.rezim === 'drez' && k === 'predvolba' && el.value !== 'vlastni') { Object.assign(p, el.value === 'varna' ? { sirka: 560, vyska: 490, r: 5 } : { sirka: 560, vyska: 490, r: 10 }); vykresliPole(); }
    if (S.rezim === 'drez' && ['sirka', 'vyska', 'r'].includes(k)) { p.predvolba = 'vlastni'; const s = $('p_predvolba'); if (s) s.value = 'vlastni'; }
    viditelnostPoli(); naplanuj();
  });
  $('pole').addEventListener('change', (e) => { if (e.target.tagName === 'SELECT') { viditelnostPoli(); naplanuj(); } });

  // SVG
  $('btnSvgImport').addEventListener('click', () => $('souborSvg').click());
  $('souborSvg').addEventListener('change', async () => {
    const f = $('souborSvg').files[0]; $('souborSvg').value = ''; if (!f) return;
    try {
      const txt = await f.text();
      if (!/<svg[\s>]/i.test(txt)) throw new Error('soubor není SVG');
      S.p.svg.svg = txt; S.p.svg.nazevSouboru = f.name;
      if (txt.length > 400000) toast('SVG je velké – do prohlížeče se možná neuloží (zůstane jen do zavření stránky).');
      vykresliPole(); prepocti();
    } catch (e) { toast('Import SVG se nepodařil: ' + e.message, true); }
  });
  $('btnSvgUkazka').addEventListener('click', () => { S.p.svg.svg = UKAZKA_SVG; S.p.svg.nazevSouboru = 'ukázka – srdce'; vykresliPole(); prepocti(); });

  /* ---------- nastavení ---------- */
  function doNastaveni() {
    for (const id of NAST_POLE) { const el = $(id); if (!el) continue; if (el.type === 'checkbox') el.checked = S.nast[id] !== false; else el.value = S.nast[id] != null ? S.nast[id] : SF.NASTAVENI[id]; }
    $('nazevProjektu').value = S.nazev || '';
    viditelnostNast();
  }
  function viditelnostNast() {
    const loz = S.nast.vedeni === 'lozisko';
    $('blokDk').classList.toggle('skryte', loz); $('blokHk').classList.toggle('skryte', loz); $('blokDl').classList.toggle('skryte', !loz);
    $('blokPapir').classList.toggle('skryte', S.nast.papir !== 'vlastni');
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

  /* ---------- písma (opentype.js se načte jen pro text) ---------- */
  const pisma = {};
  let opentypeSlib = null;
  function nactiSkript(src) { return new Promise((ok, chyba) => { const el = document.createElement('script'); el.src = src; el.onload = ok; el.onerror = () => chyba(new Error('nejde načíst ' + src)); document.head.appendChild(el); }); }
  function nactiPismoTextu(jmeno) {
    if (pisma[jmeno]) return pisma[jmeno];
    pisma[jmeno] = (async () => {
      if (!window.opentype) { opentypeSlib = opentypeSlib || nactiSkript('lib/opentype.min.js'); await opentypeSlib; }
      let buf = null;
      try { if (location.protocol !== 'file:') { const r = await fetch('fonty/' + jmeno); if (r.ok) buf = await r.arrayBuffer(); } } catch (e) { buf = null; }
      if (!buf) {
        if (!(window.FONTY_JS && window.FONTY_JS[jmeno])) await nactiSkript('fonty/js/' + jmeno + '.js');
        const b = atob(window.FONTY_JS[jmeno]), u = new Uint8Array(b.length);
        for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
        buf = u.buffer;
      }
      return window.opentype.parse(buf);
    })();
    pisma[jmeno].catch(() => { delete pisma[jmeno]; });
    return pisma[jmeno];
  }
  let pismoHotove = {};

  /* ---------- přepočet ---------- */
  let timer = 0;
  const naplanuj = () => { clearTimeout(timer); timer = setTimeout(prepocti, 120); };
  const dil = () => (NV && NV.dily[Math.min(S.vybranyDil || 0, NV.dily.length - 1)]) || null;
  function prepocti() {
    const zdroje = {};
    if (S.rezim === 'text') {
      const jm = S.p.text.pismo || SF.PISMA[0][0];
      if (pismoHotove[jm]) zdroje.pismo = pismoHotove[jm];
      else nactiPismoTextu(jm).then((f) => { pismoHotove[jm] = f; if (S.rezim === 'text') prepocti(); }).catch((e) => { $('varovani').innerHTML = `<li class="chyba">Písmo se nenačetlo: ${esc(e.message)}</li>`; });
    }
    try { NV = SF.navrh(S, zdroje); } catch (e) { console.error(e); $('varovani').innerHTML = `<li class="chyba">${esc(e.message)}</li>`; return; }
    if ((S.vybranyDil || 0) >= NV.dily.length) S.vybranyDil = 0;
    $('dily').innerHTML = NV.dily.map((d, i) => `<button type="button" role="tab" data-dil="${i}" aria-selected="${i === S.vybranyDil}">${esc(d.id)} – ${esc(d.nazev)}</button>`).join('');
    $('info').innerHTML = esc(NV.info);
    $('varovani').innerHTML = NV.varovani.map((v) => `<li>${esc(v)}</li>`).join('');
    vykresliDil();
    $('princip').innerHTML = SFPrincip.princip(S.rezim, NV.V);
    $('postup').innerHTML = SFPrincip.postup(S.rezim, NV.V, NV.N);
    $('bezpecnost').innerHTML = SFPrincip.bezpecnost();
    $('tabKusovnik').innerHTML = '<tr><th>Položka</th><th>ks</th><th>Rozměr</th><th>Poznámka</th></tr>' + (NV.dily.length ? SF.kusovnik(NV) : []).map((r) => `<tr><td>${esc(r.polozka)}</td><td class="c">${esc(r.ks)}</td><td>${esc(r.rozmer)}</td><td>${esc(r.pozn)}</td></tr>`).join('');
    uloz();
  }
  function dlazdice(d) {
    const V = NV.V, t = [];
    const add = (n, v) => t.push(`<div>${esc(n)}<b>${v}</b></div>`);
    add('ofset o', cz(V.o, 3) + ' mm');
    if (d && d.druh === 'sablona') {
      const ob = G.obal(d.sab.polys.length ? d.sab.polys : [[[0, 0], [0, 0], [0, 0]]]);
      add(d.kop === 'vnejsi' ? 'šablona (ostrůvek)' : 'otvor šablony', `${cz(ob.w, 2)} × ${cz(ob.h, 2)}`);
      add('min. R šablony', cz(V.Rv, 2) + ' mm');
      add(d.kop === 'vnejsi' ? 'min. R rohu dílu / koutu' : 'min. R rohu kapsy', d.kop === 'vnejsi' ? `${cz(Math.max(0, V.o), 2)} / ${cz(V.Rf, 2)}` : cz(V.Rf, 2) + ' mm');
      add('odchylka řezu (Hausdorff)', isFinite(d.hd.max) ? `<span class="${d.hd.max <= 0.05 ? 'ok' : 'chyba'}">${cz(d.hd.max, 3)} mm</span>` : '–');
    }
    if (NV.par) { add('motýlek R konců / pasu', `${cz(NV.par.rv, 2)} / ${cz(NV.par.rr, 2)}`); add('pár sedí', `<span class="${NV.par.sedi ? 'ok' : 'chyba'}">${NV.par.sedi ? 'ano' : 'ne'} (spára ${cz(NV.par.spara, 3)})</span>`); }
    if (d && d.typ === 'voditko' && d.vypocet) {
      if (d.vypocet.odstupLice != null) { add('líc vodítka od hrany drážky', cz(d.vypocet.odstupLice, 2) + ' mm'); add('průchody', d.vypocet.pruchody + (d.vypocet.pruchody > 1 ? ` (lišta ${cz(d.vypocet.distancni, 2)})` : '')); }
      if (d.vypocet.S != null) add('šířka štěrbiny', cz(d.vypocet.S, 2) + ' mm');
    }
    if (d && d.typ === 'rameno') { add('otvorů pro čep', d.cepy.length); add('rozsah R', `${cz(d.cepy[0][NV.p.stupnice === 'otvor' ? 'otvor' : 'kotouc'], 1)}–${cz(d.cepy[d.cepy.length - 1][NV.p.stupnice === 'otvor' ? 'otvor' : 'kotouc'], 1)}`); }
    add('průchodů', NV.pruchodu);
    return t.join('');
  }
  function vykresliDil() {
    const d = dil();
    $('vypocet').innerHTML = NV ? dlazdice(d) : '';
    if (!d) { for (const id of ['nahled', 'pudorys', 'rezAA']) $(id).innerHTML = '<p class="info" style="padding:12px;color:#555">Není co zobrazit.</p>'; $('rozmerNahled').textContent = ''; $('infoListy').textContent = ''; aktualizuj3d(); return; }
    const ob = d.deska.obal;
    $('rozmerNahled').textContent = `deska ${cz(ob.x1 - ob.x0, 1)} × ${cz(ob.y1 - ob.y0, 1)} mm · ${d.druh === 'sablona' ? (d.kop === 'vnejsi' ? 'vnější kopírování' : 'vnitřní kopírování') : 'přípravek'}`;
    $('nahled').innerHTML = SFN.hlavni(d, S.nast);
    $('pudorys').innerHTML = SFN.pudorys(d, S.nast);
    $('rezAA').innerHTML = SFN.rez(d, S.nast);
    const [pw, ph] = SF.rozmerPapiru(SF.normNast(S.nast));
    let celkem = 0, vybr = null;
    for (const q of NV.dily) { const rv = SF.rozvrhListu(SFV.scena(q, S.nast), pw, ph, S.nast); celkem += rv.listy.length; if (q === d) vybr = rv; }
    $('infoListy').innerHTML = `PDF: <b>${celkem}</b> ${celkem === 1 ? 'list' : celkem < 5 ? 'listy' : 'listů'} šablon + strana s výpočtem a kusovníkem.${vybr && vybr.listy.length > 1 ? ` Díl ${d.id}: ${vybr.nx} × ${vybr.ny} listů s přesahem ${cz(vybr.g, 0)} mm.` : ''}`;
    const st = Math.max(ob.x1 - ob.x0, ob.y1 - ob.y0), S2 = +S.nast.stul || 220;
    $('infoStl').innerHTML = st > S2 ? `Díl ${cz(ob.x1 - ob.x0, 0)} × ${cz(ob.y1 - ob.y0, 0)} mm je větší než tisková plocha – STL se rozdělí na kusy s rybinovým spojem. U velkých šablon je lepší MDF z DXF.` : `Díl ${cz(ob.x1 - ob.x0, 0)} × ${cz(ob.y1 - ob.y0, 0)} mm se vejde na tiskovou plochu.`;
    aktualizuj3d();
  }
  $('dily').addEventListener('click', (e) => { const b = e.target.closest('button[data-dil]'); if (!b) return; S.vybranyDil = +b.dataset.dil; for (const x of $('dily').children) x.setAttribute('aria-selected', String(x === b)); vykresliDil(); uloz(); });

  /* ---------- soubory ---------- */
  function stahni(obsah, nazev, typ) {
    const blob = obsah instanceof Blob ? obsah : new Blob([obsah], { type: typ || 'application/octet-stream' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nazev;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  const zaklad = () => String(S.nazev || 'sablona_frezka_' + S.rezim).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'sablona_frezka';
  const nazevSouboru = (pripona, id) => `${zaklad()}${id ? '_' + id : ''}.${pripona}`;
  let pismoSlib = null;
  function nactiPismo() {
    if (window.FONTY_JS && window.FONTY_JS['LiberationSans-Regular.ttf']) return Promise.resolve(window.FONTY_JS['LiberationSans-Regular.ttf']);
    if (pismoSlib) return pismoSlib;
    pismoSlib = nactiSkript('stitky_panely/fonty/LiberationSans-Regular.ttf.js').then(() => (window.FONTY_JS || {})['LiberationSans-Regular.ttf'] || null).catch(() => { pismoSlib = null; return null; });
    return pismoSlib;
  }
  $('btnPdf').addEventListener('click', async () => {
    const b = $('btnPdf'), puv = b.textContent; b.disabled = true; b.textContent = 'Připravuji PDF…';
    try {
      if (!NV || !NV.dily.length) throw new Error('není co tisknout');
      if (!window.jspdf) throw new Error('Knihovna jsPDF se nenačetla.');
      const pismo = await nactiPismo();
      if (!pismo) toast('Písmo se nepodařilo načíst – PDF bude bez diakritiky.');
      const nazev = (S.nazev || 'Šablona pro horní frézku') + ' – ' + SF.REZIMY[S.rezim].nazev;
      const doc = SFV.pdf(window.jspdf.jsPDF, SFV.strany(NV, S.nast, { nazev }), { pismo, nazev });
      stahni(doc.output('blob'), nazevSouboru('pdf'));
    } catch (e) { console.error(e); toast('Chyba PDF: ' + e.message, true); } finally { b.disabled = false; b.textContent = puv; }
  });
  $('btnSvg').addEventListener('click', () => { const d = dil(); if (!d) return; stahni(SFV.svg(SFV.scena(d, S.nast), { okraj: 2, pozadi: null, laser: true }), nazevSouboru('svg', d.id), 'image/svg+xml'); });
  $('btnDxf').addEventListener('click', () => { const d = dil(); if (!d) return; stahni(SFV.dxf(SFV.scena(d, S.nast)), nazevSouboru('dxf', d.id), 'application/dxf'); });

  /* ---------- STL (manifold až na vyžádání) ---------- */
  let manifoldSlib = null;
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
    const b = $('btnStl'), puv = b.textContent, d = dil(); if (!d) return;
    b.disabled = true; b.textContent = 'Počítám STL…';
    try {
      await new Promise((r) => setTimeout(r, 20));
      const w = await nactiManifold(), m = SFSTL.model(w, d, S.nast);
      stahni(new Blob([SFSTL.stlBinarni(m.poz, m.idx, 'sablona frezka ' + d.id)], { type: 'model/stl' }), nazevSouboru('stl', d.id));
      for (const v of m.varovani) toast(v);
      toast(`STL: ${m.kusu} ${m.kusu === 1 ? 'kus' : m.kusu < 5 ? 'kusy' : 'kusů'}, objem ${cz(m.objem / 1000, 1)} cm³, uzavřené těleso. Rozměry: ${m.rozmery.map((r) => r.map((x) => cz(x, 0)).join('×')).join(', ')} mm.`);
    } catch (e) { console.error(e); toast('Chyba STL: ' + e.message, true); } finally { b.disabled = false; b.textContent = puv; }
  });

  /* ---------- 3D ---------- */
  let pohled3d = null, nacita3d = false;
  function aktualizuj3d() {
    if (!pohled3d) return;
    const d = dil();
    if (d) pohled3d.aktualizuj(d, SF.normNast(S.nast));
    $('stav3d').textContent = d ? (d.pohyb === 'otoc' ? 'Rameno se otáčí kolem čepu' : d.druh === 'sablona' ? 'Kroužek objíždí šablonu, za frézou zůstává řez' : 'Frézka jede po vodítku') : '';
  }
  function nacti3d() {
    if (pohled3d || nacita3d) return;
    nacita3d = true;
    const hotovo = () => { try { pohled3d = SF3D.vytvor($('obal3d')); aktualizuj3d(); } catch (e) { $('stav3d').textContent = '3D se nepodařilo spustit: ' + e.message; } };
    if (window.THREE) { hotovo(); return; }
    nactiSkript('lib/three.0.160.0.min.js').then(hotovo).catch((e) => { nacita3d = false; $('stav3d').textContent = 'three.js se nenačetl: ' + e.message; });
  }
  new IntersectionObserver((z) => { if (z.some((x) => x.isIntersecting)) nacti3d(); }, { rootMargin: '200px' }).observe($('obal3d'));
  $('b3dHraj').addEventListener('click', () => { if (!pohled3d) return; const b = pohled3d.prehraj(); $('b3dHraj').textContent = b ? '⏸ Pauza' : '▶ Přehrát'; $('b3dHraj').setAttribute('aria-pressed', String(b)); });
  $('b3dRychlost').addEventListener('change', () => pohled3d && pohled3d.rychlost(+$('b3dRychlost').value));
  $('b3dVychozi').addEventListener('click', () => pohled3d && pohled3d.pohled(-28, 42));
  $('b3dShora').addEventListener('click', () => pohled3d && pohled3d.pohled(0, 89));
  $('b3dBok').addEventListener('click', () => pohled3d && pohled3d.pohled(0, 4));

  /* ---------- projekty ---------- */
  function vykresliProjekty() {
    const P = projekty(), jm = Object.keys(P).sort((a, b) => a.localeCompare(b, 'cs'));
    $('seznamProjektu').innerHTML = jm.length ? jm.map((j) => `<option value="${esc(j)}">${esc(j)} – ${esc((SF.REZIMY[P[j].rezim] || {}).nazev || '')}</option>`).join('') : '<option value="">– zatím nic –</option>';
  }
  $('btnUlozit').addEventListener('click', async () => {
    let jm = (S.nazev || '').trim();
    if (!jm) { jm = await Dialog.zeptej('Název projektu', SF.REZIMY[S.rezim].nazev); if (!jm) return; jm = jm.trim(); S.nazev = jm; $('nazevProjektu').value = jm; }
    const P = projekty();
    if (P[jm] && !(await Dialog.potvrd(`Projekt „${jm}“ už existuje. Přepsat?`))) return;
    P[jm] = JSON.parse(JSON.stringify(S)); P[jm].ulozeno = new Date().toISOString();
    if (ulozProjekty(P)) { vykresliProjekty(); $('seznamProjektu').value = jm; toast('Projekt uložen.'); }
    uloz();
  });
  function nactiProjekt(u) { S = slouc(SF.vychoziProjekt(), u); vykresliRezimy(); vykresliPole(); doNastaveni(); prepocti(); }
  $('btnNacist').addEventListener('click', () => { const j = $('seznamProjektu').value, P = projekty(); if (!P[j]) return; nactiProjekt(P[j]); toast('Načteno: ' + j); });
  $('btnSmazat').addEventListener('click', async () => {
    const j = $('seznamProjektu').value, P = projekty(); if (!P[j]) return;
    if (!(await Dialog.potvrd(`Smazat projekt „${j}“?`))) return;
    delete P[j]; ulozProjekty(P); vykresliProjekty();
  });
  $('btnExport').addEventListener('click', () => stahni(JSON.stringify(Object.assign({ aplikace: 'sablony_frezka', exportovano: new Date().toISOString() }, JSON.parse(JSON.stringify(S))), null, 1), nazevSouboru('json'), 'application/json'));
  $('btnImport').addEventListener('click', () => $('souborProjekt').click());
  $('souborProjekt').addEventListener('change', async () => {
    const f = $('souborProjekt').files[0]; $('souborProjekt').value = ''; if (!f) return;
    try {
      const u = JSON.parse(await f.text());
      if (!u || typeof u !== 'object' || !u.p || !SF.REZIMY[u.rezim]) throw new Error('soubor není projekt šablon pro frézku');
      nactiProjekt(u); toast('Projekt importován.');
    } catch (e) { toast('Import se nepodařil: ' + e.message, true); }
  });
  $('btnReset').addEventListener('click', async () => {
    if (!(await Dialog.potvrd('Vrátit všechny parametry na výchozí hodnoty? (Uložené projekty zůstanou.)'))) return;
    const r = S.rezim; S = SF.vychoziProjekt(r); vykresliRezimy(); vykresliPole(); doNastaveni(); prepocti();
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
  window.SFApp = { get stav() { return S; }, get navrh() { return NV; }, nastavRezim, prepocti, nactiManifold, get pohled3d() { return pohled3d; } };
})();

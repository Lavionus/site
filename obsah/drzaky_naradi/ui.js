/* ============================================================
   Držáky nářadí a Gridfinity – ovládání stránky (DOM) nad gen3d/aplikace.js
   Stav projektu = S (viz DN.vychoziProjekt) = app.p; zpět/znovu, autosave, projekt JSON, sdílení a klávesy dělá G3D.aplikace.
   Formuláře režimů drží odkazy na podobjekty S – DN.normalizujProjekt proto projekt doplňuje na místě.
   ============================================================ */
/* global DN, DNT, DNV, DNP, DN_NAHLED, KRAB, G3D, Dialog, TrubkyGui */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const KLIC = 'webapp_drzaky_naradi', KLIC_P = 'webapp_drzaky_naradi_projekty';
  const cz = DN.cz, cislo = DN.cislo;
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const REZIMY = [
    { id: 'podlozka', ik: '▦', nazev: 'Podložka' },
    { id: 'krabicky', ik: '📦', nazev: 'Krabičky' },
    { id: 'vlozka', ik: '🔩', nazev: 'Vložka s kapsami' },
    { id: 'lista', ik: '🪵', nazev: 'Lišta a stěna' },
    { id: 'drzaky', ik: '🪛', nazev: 'Držáky na lištu' },
    { id: 'peg', ik: '📌', nazev: 'Pegboard háčky' },
  ];
  const info = (t) => Dialog.info(t), chyba = (t) => Dialog.chyba(t);

  // režimy Shift+1–6 (číslice bez Shiftu patří pohledům) – zachytit dřív než klávesy G3D.aplikace
  window.addEventListener('keydown', (e) => {
    const t = e.target;
    if (!e.shiftKey || e.ctrlKey || e.metaKey || e.altKey || document.querySelector('dialog[open]')) return;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    const m = /^(?:Digit|Numpad)([1-6])$/.exec(e.code);
    if (m) { e.preventDefault(); e.stopPropagation(); nastavRezim(REZIMY[+m[1] - 1].id); }
  }, true);

  // dřív se rozpracovaný návrh ukládal přímo pod KLIC – převést na <klic>_projekt (G3D.aplikace)
  try {
    const stary = localStorage.getItem(KLIC);
    if (stary && !localStorage.getItem(KLIC + '_projekt')) localStorage.setItem(KLIC + '_projekt', stary);
    if (stary) localStorage.removeItem(KLIC);
  } catch (e) { /* bez úložiště */ }

  /* ---------- stav ---------- */
  let S = null;
  const projekty = () => { try { return JSON.parse(localStorage.getItem(KLIC_P) || '{}') || {}; } catch (e) { return {}; } };
  const ulozProjekty = (P) => { try { localStorage.setItem(KLIC_P, JSON.stringify(P)); return true; } catch (e) { chyba('Úložiště prohlížeče je plné.'); return false; } };

  const app = G3D.aplikace({
    typ: 'drzaky_naradi', nazev: 'Držáky nářadí', klic: KLIC, soubor: 'drzaky_naradi',
    normalizuj: (q) => ({ p: DN.normalizujProjekt(q), hlaseni: [] }),
    vychozi: () => DN.normalizujProjekt(Object.assign(DN.vychoziProjekt(), { rezim: S ? S.rezim : 'podlozka' })),
    // projekt JSON ve stejném tvaru jako dřív (Export JSON)
    ulozProjekt: (q) => JSON.stringify(Object.assign({ aplikace: 'drzaky_naradi', exportovano: new Date().toISOString() }, q), null, 1),
    nactiProjekt: (t) => {
      let u;
      try { u = JSON.parse(t); } catch (e) { throw new Error('Soubor není platný JSON.'); }
      if (!u || typeof u !== 'object' || !u.gf || !u.stena) throw new Error('Soubor není projekt držáků nářadí.');
      return { p: DN.normalizujProjekt(u), hlaseni: [] };
    },
    poNaplneni: () => { S = app.p; vykresliRezimy(); vykresliForm(); },
    prepocitej: () => prepocti(),
    png: () => nahled.png(),
    pohled: (j) => pohled3d(j),
    exportStl: () => exportVse('stl'),
    doModelare: async () => { const D = await dilyTisku(); return D && D.length ? { data: KRAB.soubor3mf(D, S.nazev || 'Držáky nářadí'), pripona: '.3mf' } : null; },
    zkratky: { h: 'tHrany', m: 'tTisk', p: 'tPrevisy', r: 'tRez', e: 'tRozlozit', l: 'tPravitka', v: 'tVykres' },
    zmenaTematu: () => { nahled.barvy(css('--border-strong'), css('--border'), css('--text')); naplanuj3d(); },
  });
  S = app.p;
  /** Změna projektu s krokem zpět: f mění S (= app.p, normalizace ho ponechá stejný objekt). */
  function uprav(f, slouceni) { S = app.p; app.zmen(() => { f(); omezVyber(); }, slouceni); S = app.p; }
  /** Změna, po které se překreslí i formulář (přidání, výběr, mazání…). */
  function akce(f) { uprav(f); vykresliRezimy(); vykresliForm(); }

  const krab = () => S.gf.krabicky[S.gf.vybrana] || null;
  const drz = () => S.stena.drzaky[S.stena.vybrany] || null;
  const hakV = () => S.peg.haky[S.peg.vybrany] || null;
  const omezVyber = () => {
    S.gf.vybrana = Math.max(0, Math.min(S.gf.vybrana | 0, S.gf.krabicky.length - 1));
    S.stena.vybrany = Math.max(0, Math.min(S.stena.vybrany | 0, S.stena.drzaky.length - 1));
    S.peg.vybrany = Math.max(0, Math.min(S.peg.vybrany | 0, S.peg.haky.length - 1));
  };

  /* ---------- formuláře ---------- */
  const ziskej = (o, k) => k.split('.').reduce((a, b) => (a == null ? a : a[b]), o);
  function nastavHodnotu(o, k, v) { const c = k.split('.'), p = c.slice(0, -1).reduce((a, b) => (a[b] = a[b] || {}), o); p[c[c.length - 1]] = v; }
  let polePoradi = 0;
  /** def: [{k, l, t:'n'|'chk'|'sel'|'txt'|'skup'|'btn', o (objekt), moz:[[v,l]], min, max, step, cela, akce, out}]
      skupina s out: true a pole za ní jdou do pravého boxu (Tisk a montáž) */
  function vykresliPole(def) {
    const elIn = $('pole'), elOut = $('poleOut'); elIn.innerHTML = ''; elOut.innerHTML = '';
    let el = elIn;
    for (const d of def) {
      if (d.t === 'skup') { el = d.out ? elOut : elIn; const s = document.createElement('div'); s.className = 'skupina'; s.textContent = d.l; el.appendChild(s); continue; }
      const id = 'p' + (++polePoradi), w = document.createElement('div');
      w.className = d.cela || (d.t === 'chk' && d.cela !== false) ? 'cela' : '';
      if (d.t === 'btn') { w.className = 'cela tlacitka'; w.innerHTML = `<button class="btn btn-sec btn-mini" type="button" id="${id}">${esc(d.l)}</button>`; el.appendChild(w); $(id).addEventListener('click', d.akce); continue; }
      const v = ziskej(d.o, d.k);
      if (d.t === 'chk') {
        w.innerHTML = `<label class="chk"><input type="checkbox" id="${id}" ${v ? 'checked' : ''}> ${esc(d.l)}</label>`;
        el.appendChild(w);
        $(id).addEventListener('change', (e) => { uprav(() => nastavHodnotu(d.o, d.k, e.target.checked)); if (d.prekresli) vykresliForm(); });
      } else if (d.t === 'sel') {
        w.innerHTML = `<label for="${id}">${esc(d.l)}</label><select id="${id}">${d.moz.map(([a, b]) => `<option value="${esc(a)}"${String(a) === String(v) ? ' selected' : ''}>${esc(b)}</option>`).join('')}</select>`;
        el.appendChild(w);
        $(id).addEventListener('change', (e) => { uprav(() => nastavHodnotu(d.o, d.k, e.target.value)); if (d.prekresli) vykresliForm(); });
      } else {
        const typ = d.t === 'txt' ? 'text' : 'number';
        w.innerHTML = `<label for="${id}">${esc(d.l)}</label><input id="${id}" type="${typ}"${d.t === 'n' ? ` inputmode="decimal" step="${d.step || 1}"${d.min != null ? ` min="${d.min}"` : ''}${d.max != null ? ` max="${d.max}"` : ''}` : ''} value="${esc(v == null ? '' : v)}"${d.ph ? ` placeholder="${esc(d.ph)}"` : ''}>`;
        el.appendChild(w);
        $(id).addEventListener('input', (e) => {
          let x = e.target.value;
          if (d.t === 'n') { x = cislo(x, NaN); if (!Number.isFinite(x)) return; if (d.min != null) x = Math.max(d.min, x); if (d.max != null) x = Math.min(d.max, x); }
          uprav(() => nastavHodnotu(d.o, d.k, x), 'pole:' + id);   // psaní do jednoho pole = jeden krok zpět
        });
        $(id).addEventListener('change', () => { if (d.prekresli) vykresliForm(); });
      }
    }
  }

  /* ---------- výběr položek (čipy) ---------- */
  function cipy(seznam, vybrany, nazev, naVyber, tlacitka) {
    const el = $('vyberPolozky');
    el.innerHTML = `<div class="cipy" role="tablist">${seznam.map((x, i) => `<button type="button" role="tab" data-i="${i}" aria-selected="${i === vybrany}">${esc(nazev(x, i))}</button>`).join('')}</div>` +
      `<div class="tlacitka" style="margin-top:2px">${tlacitka.map((t, i) => `<button class="btn btn-sec btn-mini" type="button" data-t="${i}">${esc(t.l)}</button>`).join('')}</div>`;
    el.querySelectorAll('button[data-i]').forEach((b) => b.addEventListener('click', () => akce(() => naVyber(+b.dataset.i))));
    el.querySelectorAll('button[data-t]').forEach((b) => b.addEventListener('click', () => tlacitka[+b.dataset.t].akce()));
  }

  /* ---------- formuláře režimů ---------- */
  function formPodlozka() {
    const P = S.gf.podlozka, Z = P.zasuvka;
    $('vyberPolozky').innerHTML = '';
    vykresliPole([
      { t: 'skup', l: 'Mřížka 42 mm' },
      { k: 'nx', l: 'Buněk do šířky', t: 'n', o: P, min: 1, max: 40 },
      { k: 'ny', l: 'Buněk do hloubky', t: 'n', o: P, min: 1, max: 40 },
      { k: 'typ', l: 'Typ podložky', t: 'sel', o: P, moz: [['tenka', 'tenká 5 mm (bez dna)'], ['dno', 's dnem – magnety / vruty']], cela: true, prekresli: true },
      ...(P.typ === 'dno' ? [
        { k: 'dno', l: 'Tloušťka dna (mm)', t: 'n', o: P, min: 1.2, max: 10, step: 0.2 },
        { k: 'magnety', l: 'Magnety 6 × 2 v lůžkách', t: 'chk', o: P, cela: false },
        { k: 'vruty', l: 'Otvory pro vruty do podkladu', t: 'chk', o: P, prekresli: true },
        ...(P.vruty ? [{ k: 'vrutD', l: 'Ø vrutu (typ.)', t: 'n', o: P, min: 2, max: 6, step: 0.5 }, { k: 'vrutHlava', l: 'Ø zápustné hlavy', t: 'n', o: P, min: 4, max: 12, step: 0.5 }] : []),
      ] : []),
      { t: 'skup', l: 'Okrajová výplň (mm) – doplní podložku na rozměr zásuvky' },
      { k: 'okraje.l', l: 'Vlevo', t: 'n', o: P, min: 0, max: 41, step: 0.5 },
      { k: 'okraje.p', l: 'Vpravo', t: 'n', o: P, min: 0, max: 41, step: 0.5 },
      { k: 'okraje.d', l: 'Vpředu', t: 'n', o: P, min: 0, max: 41, step: 0.5 },
      { k: 'okraje.h', l: 'Vzadu', t: 'n', o: P, min: 0, max: 41, step: 0.5 },
      { t: 'skup', l: 'Výpočet ze zásuvky' },
      { k: 'W', l: 'Vnitřní šířka zásuvky', t: 'n', o: Z, min: 40, max: 3000 },
      { k: 'H', l: 'Vnitřní hloubka zásuvky', t: 'n', o: Z, min: 40, max: 3000 },
      { k: 'vule', l: 'Vůle celkem (mm)', t: 'n', o: Z, min: 0, max: 10, step: 0.5 },
      { k: 'zarovnani', l: 'Výplň', t: 'sel', o: Z, moz: [['stred', 'na obě strany'], ['roh', 'jen vpravo a vzadu']] },
      { t: 'btn', l: 'Spočítat ze zásuvky', akce: () => { const r = DN.zeZasuvky(Z.W, Z.H, Z.vule, Z.zarovnani); akce(() => Object.assign(P, { nx: r.nx, ny: r.ny, okraje: r.okraje })); info(`Zásuvka: ${r.nx} × ${r.ny} buněk, výplň ${cz(r.okraje.l + r.okraje.p)} / ${cz(r.okraje.d + r.okraje.h)} mm.`); } },
      { t: 'skup', l: 'Tisková plocha (dělení podložky na díly)', out: true },
      { k: 'tiskX', l: 'Tisková plocha X', t: 'n', o: P, min: 60, max: 1000, step: 5 },
      { k: 'tiskY', l: 'Tisková plocha Y', t: 'n', o: P, min: 60, max: 1000, step: 5 },
    ]);
  }
  function novaKrabicka(n, m) {
    const P = DN.podlozka(S.gf.podlozka), mi = DN.volneMisto(S.gf.krabicky.map(DN.krabicka), P.nx, P.ny, n, m);
    if (!mi) { chyba(`Na podložce už není volné místo ${n} × ${m}.`); return; }
    akce(() => { S.gf.krabicky.push(Object.assign({}, DN.VYCHOZI_KRABICKA, { n, m, gx: mi.gx, gy: mi.gy })); S.gf.vybrana = S.gf.krabicky.length - 1; });
  }
  function cipyKrabicek() {
    cipy(S.gf.krabicky, S.gf.vybrana, (k, i) => `${i + 1}: ${k.n}×${k.m}×${k.u}${k.vlozka ? ' ⬚' : ''}`, (i) => { S.gf.vybrana = i; }, [
      { l: '+ 1×1', akce: () => novaKrabicka(1, 1) },
      { l: '+ 2×1', akce: () => novaKrabicka(2, 1) },
      { l: '+ 2×2', akce: () => novaKrabicka(2, 2) },
      { l: 'Duplikovat', akce: () => { const k = krab(); if (!k) return; const P = DN.podlozka(S.gf.podlozka), mi = DN.volneMisto(S.gf.krabicky.map(DN.krabicka), P.nx, P.ny, k.n, k.m); if (!mi) { chyba('Pro kopii není místo.'); return; } akce(() => { S.gf.krabicky.push(Object.assign(JSON.parse(JSON.stringify(k)), mi)); S.gf.vybrana = S.gf.krabicky.length - 1; }); } },
      { l: 'Smazat', akce: async () => { if (!krab()) return; if (!(await Dialog.potvrd(`Smazat krabičku ${S.gf.vybrana + 1}?`))) return; akce(() => S.gf.krabicky.splice(S.gf.vybrana, 1)); } },
    ]);
  }
  function formKrabicky() {
    cipyKrabicek();
    const k = krab();
    if (!k) { vykresliPole([]); $('pole').innerHTML = '<p class="info cela">Zatím žádná krabička – přidejte ji tlačítkem výše.</p>'; return; }
    vykresliPole([
      { t: 'skup', l: 'Velikost (buňky 42 mm, výška po 7 mm)' },
      { k: 'n', l: 'Šířka N', t: 'n', o: k, min: 1, max: 10 }, { k: 'm', l: 'Hloubka M', t: 'n', o: k, min: 1, max: 10 },
      { k: 'u', l: 'Výška U (× 7 mm)', t: 'n', o: k, min: 2, max: 30 },
      { k: 'nazev', l: 'Poznámka', t: 'txt', o: k, ph: 'např. šrouby M4' },
      { k: 'gx', l: 'Poloha v podložce X (buňka)', t: 'n', o: k, min: 0, max: 39 }, { k: 'gy', l: 'Poloha Y (buňka)', t: 'n', o: k, min: 0, max: 39 },
      ...(k.vlozka ? [{ t: 'skup', l: 'Vnitřek: vložka s kapsami (režim 3)' }, { t: 'btn', l: 'Zrušit vložku → přihrádky', akce: () => akce(() => { k.vlozka = null; }) }] : [
        { t: 'skup', l: 'Přihrádky' },
        { k: 'delX', l: 'Přihrádek do šířky', t: 'n', o: k, min: 1, max: 12 }, { k: 'delY', l: 'Přihrádek do hloubky', t: 'n', o: k, min: 1, max: 12 },
        { k: 'stitek', l: 'Štítek (lišta na popisek vzadu)', t: 'chk', o: k, cela: false },
        { k: 'lopatka', l: 'Lopatka (zaoblení vpředu)', t: 'chk', o: k, cela: false },
        { k: 'stitekHloubka', l: 'Hloubka štítku (mm)', t: 'n', o: k, min: 5, max: 20, step: 0.5 },
        { k: 'stitekUhel', l: 'Podpora štítku (° od vodorovné)', t: 'n', o: k, min: 30, max: 60 },
        { k: 'lopatkaPomer', l: 'Lopatka (podíl výšky)', t: 'n', o: k, min: 0.1, max: 1, step: 0.05 },
        { t: 'btn', l: 'Udělat z krabičky vložku s kapsami', akce: () => akce(() => { k.vlozka = Object.assign({}, DN.VYCHOZI_VLOZKA, { nastroje: [] }); S.rezim = 'vlozka'; }) },
      ]),
      { t: 'skup', l: 'Podstava a lem', out: true },
      { k: 'magnety', l: 'Magnety 6 × 2', t: 'chk', o: k, cela: false }, { k: 'srouby', l: 'Otvory pro šroub M3', t: 'chk', o: k, cela: false },
      { k: 'lem', l: 'Stohovací lem 4,4 mm', t: 'chk', o: k },
    ]);
  }
  function formVlozka() {
    cipyKrabicek();
    const k = krab();
    $('blokNastroje').classList.toggle('skryte', !(k && k.vlozka));
    if (!k) { vykresliPole([]); return; }
    if (!k.vlozka) {
      vykresliPole([{ t: 'btn', l: 'Vytvořit v této krabičce vložku s kapsami', akce: () => akce(() => { k.vlozka = Object.assign({}, DN.VYCHOZI_VLOZKA, { nastroje: DN.SADY.vrtaky.nastroje() }); }) }]);
      return;
    }
    const V = k.vlozka;
    vykresliPole([
      { k: 'n', l: 'Krabička N', t: 'n', o: k, min: 1, max: 10 }, { k: 'm', l: 'Krabička M', t: 'n', o: k, min: 1, max: 10 },
      { k: 'u', l: 'Výška U', t: 'n', o: k, min: 2, max: 30 },
      { t: 'skup', l: 'Kapsy a popisky', out: true },
      { k: 'vule', l: 'Vůle kapsy na Ø / šířce', t: 'n', o: V, min: 0, max: 3, step: 0.05 },
      { k: 'mezera', l: 'Stěna mezi kapsami (≥ 2)', t: 'n', o: V, min: 1.2, max: 15, step: 0.2 },
      { k: 'vyskaPisma', l: 'Výška popisku', t: 'n', o: V, min: 2, max: 10, step: 0.5 },
      { k: 'popisky', l: 'Vyrýt popisky (Liberation Sans, OFL)', t: 'chk', o: V },
    ]);
    vykresliNastroje();
  }
  const SLOUPCE = { valec: ['Ø', '', 'hloubka'], lezici: ['Ø', 'délka', 'hloubka'], sestihran: ['přes plochy', '', 'hloubka'], obdelnik: ['délka', 'šířka', 'hloubka'], obrys: ['–', '', 'hloubka'] };
  const KRATCE = { valec: 'válec', lezici: 'naležato', sestihran: 'šestihran', obdelnik: 'obdélník', obrys: 'obrys' };
  function vykresliNastroje() {
    const k = krab(); if (!k || !k.vlozka) return;
    const N = k.vlozka.nastroje, t = $('tabNastroje');
    const A = (x) => (x.tvar === 'valec' || x.tvar === 'lezici' ? 'd' : x.tvar === 'sestihran' ? 's' : x.tvar === 'obdelnik' ? 'a' : null);
    const B = (x) => (x.tvar === 'lezici' ? 'delka' : x.tvar === 'obdelnik' ? 'b' : null);
    t.innerHTML = '<tr><th>tvar</th><th>A</th><th>B</th><th>hloubka</th><th>popis</th><th>ks</th><th title="zářez na prsty">prst</th><th></th></tr>' + N.map((x, i) => `<tr data-i="${i}">
      <td><select data-k="tvar">${Object.entries(KRATCE).map(([a, b]) => `<option value="${a}"${a === x.tvar ? ' selected' : ''}>${b}</option>`).join('')}</select></td>
      <td>${A(x) ? `<input data-k="${A(x)}" type="number" step="0.1" min="0.5" value="${esc(x[A(x)])}" title="${SLOUPCE[x.tvar][0]}">` : `<span class="info">${x.body ? x.body.length + ' bodů' : '–'}</span>`}</td>
      <td>${B(x) ? `<input data-k="${B(x)}" type="number" step="0.5" min="1" value="${esc(x[B(x)])}" title="${SLOUPCE[x.tvar][1]}">` : ''}</td>
      <td><input data-k="hl" type="number" step="0.5" min="0" value="${esc(x.hl == null ? '' : x.hl)}"></td>
      <td><input data-k="popis" type="text" maxlength="14" value="${esc(x.popis || '')}" style="min-width:56px"></td>
      <td><input data-k="ks" type="number" step="1" min="1" max="200" value="${esc(x.ks || 1)}" style="min-width:40px"></td>
      <td>${x.tvar === 'valec' || x.tvar === 'sestihran' ? '' : `<input data-k="prst" type="checkbox" ${x.prst ? 'checked' : ''} style="width:auto">`}</td>
      <td class="x"><button class="btn btn-sec btn-mini" type="button" data-smaz="${i}" title="odebrat">×</button></td></tr>`).join('');
  }
  $('tabNastroje').addEventListener('input', (e) => {
    const tr = e.target.closest('tr[data-i]'), k = krab(); if (!tr || !k || !k.vlozka) return;
    const i = +tr.dataset.i, kl = e.target.dataset.k;
    if (kl === 'tvar') return;
    let v;
    if (kl === 'popis') v = e.target.value;
    else if (kl === 'prst') v = e.target.checked;
    else { v = cislo(e.target.value, NaN); if (!Number.isFinite(v)) return; }
    uprav(() => { k.vlozka.nastroje[i][kl] = v; }, 'nastroj:' + i + kl);
  });
  $('tabNastroje').addEventListener('change', (e) => {
    const tr = e.target.closest('tr[data-i]'), k = krab(); if (!tr || !k || !k.vlozka) return;
    if (e.target.dataset.k === 'tvar') {
      uprav(() => {
        const x = k.vlozka.nastroje[+tr.dataset.i]; x.tvar = e.target.value;
        if (x.tvar === 'obdelnik') { x.a = x.a || 40; x.b = x.b || 15; }
        if (x.tvar === 'lezici') { x.d = x.d || 6; x.delka = x.delka || 80; }
        if (x.tvar === 'sestihran') x.s = x.s || 6.35;
        if (x.tvar === 'valec') x.d = x.d || 6;
      });
      vykresliNastroje();
    }
  });
  $('tabNastroje').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-smaz]'), k = krab(); if (!b || !k || !k.vlozka) return;
    uprav(() => k.vlozka.nastroje.splice(+b.dataset.smaz, 1)); vykresliNastroje();
  });
  $('sada').innerHTML = Object.entries(DN.SADY).map(([k, v]) => `<option value="${k}">${esc(v.nazev)}</option>`).join('');
  $('btnSada').addEventListener('click', () => { const k = krab(); if (!k || !k.vlozka) return; uprav(() => k.vlozka.nastroje.push(...DN.SADY[$('sada').value].nastroje())); vykresliNastroje(); });
  $('btnNastroj').addEventListener('click', () => { const k = krab(); if (!k || !k.vlozka) return; uprav(() => k.vlozka.nastroje.push({ tvar: 'valec', d: 8, hl: 15, popis: '', ks: 1 })); vykresliNastroje(); });
  $('btnSmazNastroje').addEventListener('click', async () => { const k = krab(); if (!k || !k.vlozka) return; if (!(await Dialog.potvrd('Odebrat všechny nástroje z vložky?'))) return; uprav(() => { k.vlozka.nastroje = []; }); vykresliNastroje(); });
  $('btnNavrhni').addEventListener('click', () => {
    const k = krab(); if (!k || !k.vlozka) return;
    const r = DN.navrhniVelikost(k.vlozka.nastroje, k.vlozka);
    if (!r) { chyba('Nástroje se nevejdou ani do krabičky 7 × 7 – rozdělte je do více krabiček.'); return; }
    akce(() => {
      Object.assign(k, r);
      const P = DN.podlozka(S.gf.podlozka), kol = DN.kontrolaKrabicek(S.gf.krabicky.map(DN.krabicka), P.nx, P.ny);
      if (kol.chyby.length) { const mi = DN.volneMisto(S.gf.krabicky.map(DN.krabicka), P.nx, P.ny, r.n, r.m, S.gf.vybrana); if (mi) Object.assign(k, mi); }
    });
    info(`Navrženo: ${r.n} × ${r.m} × ${r.u}.`);
  });
  $('btnSvgObrys').addEventListener('click', () => $('souborSvg').click());
  $('souborSvg').addEventListener('change', async () => {
    const f = $('souborSvg').files[0]; $('souborSvg').value = ''; const k = krab();
    if (!f || !k || !k.vlozka) return;
    try {
      const obr = DN.parsujSvg(await f.text());
      if (!obr.length) throw new Error('v souboru není cesta, polygon ani obdélník');
      const d = await Dialog.zeptej('Skutečná délka delší strany obrysu (mm)', '150'); if (d == null) return;
      const body = DN.obrysNaMm(obr, cislo(d, 150)); if (!body || body.length < 3) throw new Error('obrys se nepodařilo převést');
      const popis = (await Dialog.zeptej('Popisek kapsy (nepovinné)', f.name.replace(/\.svg$/i, '').slice(0, 12))) || '';
      uprav(() => k.vlozka.nastroje.push({ tvar: 'obrys', body, hl: 12, popis, ks: 1, prst: true }));
      vykresliNastroje(); info(`Obrys: ${body.length} bodů.`);
    } catch (e) { chyba('Import SVG: ' + e.message); }
  });

  function formLista() {
    const L = S.stena.lista;
    $('vyberPolozky').innerHTML = '';
    vykresliPole([
      { t: 'skup', l: 'Profil lišty' },
      { k: 't', l: 'Tloušťka desky', t: 'n', o: L, min: 8, max: 40, step: 0.5 }, { k: 'h', l: 'Výška lišty (dlouhá strana)', t: 'n', o: L, min: 40, max: 300 },
      { k: 'uhel', l: 'Úhel úkosu (°)', t: 'n', o: L, min: 30, max: 60 }, { k: 'prorez', l: 'Prořez kotouče (mm)', t: 'n', o: L, min: 0, max: 8, step: 0.1 },
      { t: 'skup', l: 'Stěna' },
      { k: 'delka', l: 'Délka stěny / lišt', t: 'n', o: L, min: 100, max: 20000, step: 10 }, { k: 'rady', l: 'Počet řad', t: 'n', o: L, min: 1, max: 20 },
      { k: 'hornaHrana', l: 'Horní hrana 1. řady nad podlahou', t: 'n', o: L, min: 100, max: 4000, step: 10 }, { k: 'roztec', l: 'Rozteč řad', t: 'n', o: L, min: 60, max: 1000, step: 5 },
      { t: 'skup', l: 'Montáž na zeď', out: true },
      { k: 'rozpetiVrutu', l: 'Rozteč vrutů (sloupky / hmoždinky)', t: 'n', o: L, min: 100, max: 1200, step: 10 }, { k: 'odsazeniVrutu', l: 'První vrut od kraje', t: 'n', o: L, min: 20, max: 400, step: 5 },
      { k: 'vrut', l: 'Vrut (typický)', t: 'txt', o: L }, { k: 'hmozdinky', l: 'Hmoždinky do zdiva', t: 'chk', o: L, cela: false },
      { t: 'skup', l: 'Deska pro řezný plán', out: true },
      { k: 'desW', l: 'Délka desky', t: 'n', o: L, min: 300, max: 5000, step: 10 }, { k: 'desH', l: 'Šířka desky', t: 'n', o: L, min: 150, max: 3000, step: 10 },
      { k: 'orez', l: 'Ořez okrajů', t: 'n', o: L, min: 0, max: 50 },
      { k: 'protikusy', l: 'Další lišty (protikusy, mm)', t: 'txt', o: L, ph: 'např. 300, 300, 450', cela: true },
    ]);
  }
  const POPISY_P = { sirky: 'Šířky (mm, oddělit čárkou a mezerou)', tl: 'Tloušťka štěrbiny', mezera: 'Mezera mezi štěrbinami', hloubkaPolice: 'Hloubka police (0 = auto)', tlPolice: 'Tloušťka police',
    prumery: 'Průměry dříků', roztec: 'Rozteč', popisy: 'Popisky (čárka + mezera)', rady: 'Řady Ø (řady oddělit |)', vule: 'Vůle otvorů', hloubka: 'Hloubka', schod: 'Výška schodu', naListu: 'S hákem na lištu',
    listy: 'Šířky listů u rukojeti', pocet: 'Počet', sirka: 'Šířka (lišta svěrky / násada)', okraj: 'Okraj po stranách' };
  function formDrzaky() {
    const druhy = Object.entries(DN.DRUHY);
    cipy(S.stena.drzaky, S.stena.vybrany, (d, i) => `${i + 1}: ${DN.DRUHY[d.druh] ? DN.DRUHY[d.druh].nazev.split(' –')[0] : d.druh}`, (i) => { S.stena.vybrany = i; },
      druhy.map(([k, v]) => ({ l: '+ ' + v.nazev.split(' –')[0], akce: () => akce(() => { const rz = DN.rozmistiDrzaky(S.stena.lista, S.stena.drzaky.concat([{ druh: k, rada: 0, p: {} }]), S.stena.nast); S.stena.drzaky.push(rz[rz.length - 1]); S.stena.vybrany = S.stena.drzaky.length - 1; }) }))
        .concat([{ l: 'Rozmístit vše', akce: () => { akce(() => { S.stena.drzaky = DN.rozmistiDrzaky(S.stena.lista, S.stena.drzaky.map((d) => Object.assign({}, d, { rada: d.rada })), S.stena.nast); }); info('Držáky rozmístěny zleva po řadách.'); } },
          { l: 'Smazat', akce: async () => { if (!drz()) return; if (!(await Dialog.potvrd(`Smazat držák ${S.stena.vybrany + 1}?`))) return; akce(() => S.stena.drzaky.splice(S.stena.vybrany, 1)); } }]));
    const d = drz(), N = S.stena.nast;
    const spol = [{ t: 'skup', l: 'Společné pro držáky (3D tisk)', out: true },
      { k: 'vuleHak', l: 'Vůle háku', t: 'n', o: N, min: 0.2, max: 3, step: 0.1 }, { k: 'vuleNastroje', l: 'Vůle pro nástroj', t: 'n', o: N, min: 0, max: 3, step: 0.1 },
      { k: 'hakNad', l: 'Hák nad hranou lišty', t: 'n', o: N, min: 6, max: 60 }, { k: 'zadaPod', l: 'Záda pod hranou lišty', t: 'n', o: N, min: 10, max: 200 },
      { k: 'zada', l: 'Tloušťka zad', t: 'n', o: N, min: 3, max: 15, step: 0.5 }, { k: 'vyskaPisma', l: 'Výška popisků', t: 'n', o: N, min: 3, max: 12, step: 0.5 },
      { k: 'popisky', l: 'Vyrýt popisky', t: 'chk', o: N },
      { k: 'tiskX', l: 'Tisková plocha X', t: 'n', o: N, min: 80, max: 1000, step: 5 }, { k: 'tiskZ', l: 'Max. výška tisku Z', t: 'n', o: N, min: 80, max: 1000, step: 5 }];
    if (!d) { vykresliPole(spol); return; }
    if (!d.p || Object.keys(DN.DRUHY[d.druh].vychozi).some((k) => !(k in d.p))) d.p = Object.assign({}, DN.DRUHY[d.druh].vychozi, d.p || {});
    const vl = Object.keys(DN.DRUHY[d.druh].vychozi).map((k) => {
      const v = DN.DRUHY[d.druh].vychozi[k];
      if (typeof v === 'boolean') return { k, l: POPISY_P[k] || k, t: 'chk', o: d.p };
      if (typeof v === 'string') return { k, l: POPISY_P[k] || k, t: 'txt', o: d.p, cela: true };
      return { k, l: POPISY_P[k] || k, t: 'n', o: d.p, min: 0, max: 1000, step: 0.5 };
    });
    vykresliPole([{ t: 'skup', l: DN.DRUHY[d.druh].nazev + ' – ' + DN.DRUHY[d.druh].popis }, ...vl,
      { k: 'rada', l: 'Řada (0 = horní)', t: 'n', o: d, min: 0, max: 19 }, { k: 'x', l: 'Poloha od levého konce lišty', t: 'n', o: d, min: 0, max: 20000, step: 5 },
      { k: 'nazev', l: 'Poznámka', t: 'txt', o: d, cela: true }, ...spol]);
  }
  function formPeg() {
    cipy(S.peg.haky, S.peg.vybrany, (h, i) => `${i + 1}: ${h.typ === 'J' ? 'J' : 'rovný'} ${cz(cislo(h.delka, 60), 0)}`, (i) => { S.peg.vybrany = i; }, [
      { l: '+ háček', akce: () => akce(() => { const h = hakV(); S.peg.haky.push(Object.assign({}, h || DN.VYCHOZI_HAK, { ks: 1 })); S.peg.vybrany = S.peg.haky.length - 1; }) },
      { l: 'Smazat', akce: async () => { if (!hakV() || S.peg.haky.length < 2) return; if (!(await Dialog.potvrd('Smazat háček?'))) return; akce(() => S.peg.haky.splice(S.peg.vybrany, 1)); } },
    ]);
    const h = hakV(); if (!h) { vykresliPole([]); return; }
    vykresliPole([
      { t: 'skup', l: 'Háček' },
      { k: 'typ', l: 'Tvar', t: 'sel', o: h, moz: [['rovny', 'rovný se zarážkou'], ['J', 'J-hák']] }, { k: 'ks', l: 'Kusů', t: 'n', o: h, min: 1, max: 100 },
      { k: 'delka', l: 'Délka ramene', t: 'n', o: h, min: 15, max: 200 }, { k: 'tlRamene', l: 'Tloušťka ramene', t: 'n', o: h, min: 4, max: 20, step: 0.5 },
      { k: 'sirka', l: 'Šířka háčku (tisk na výšku)', t: 'n', o: h, min: 4, max: 40, step: 0.5 }, { k: 'uhel', l: 'Sklon ramene (°)', t: 'n', o: h, min: 0, max: 30 },
      { k: 'spicka', l: 'Zarážka na konci', t: 'n', o: h, min: 0, max: 30 }, { k: 'polomer', l: 'Poloměr J', t: 'n', o: h, min: 6, max: 60 },
      { t: 'skup', l: 'Děrovaná deska (typické hodnoty – změřte)', out: true },
      { k: '_predvolba', l: 'Předvolba', t: 'sel', o: { _predvolba: '' }, moz: [['', '– vybrat –'], ...Object.entries(DN.PEG_PREDVOLBY).map(([k, v]) => [k, v.nazev])], cela: true },
      { k: 'roztec', l: 'Rozteč děr (mm)', t: 'n', o: h, min: 10, max: 120, step: 0.1 }, { k: 'dira', l: 'Průměr díry', t: 'n', o: h, min: 3, max: 12, step: 0.05 },
      { k: 'deska', l: 'Tloušťka desky', t: 'n', o: h, min: 2, max: 20, step: 0.5 }, { k: 'vule', l: 'Vůle kolíku', t: 'n', o: h, min: 0.1, max: 1.5, step: 0.05 },
    ]);
    const sel = $('poleOut').querySelector('select');
    if (sel) sel.addEventListener('change', () => { const p = DN.PEG_PREDVOLBY[sel.value]; if (!p) return; akce(() => Object.assign(h, { roztec: p.roztec, dira: p.dira, deska: p.deska })); });
  }

  /* ---------- režimy ---------- */
  function vykresliRezimy() {
    $('rezimy').innerHTML = REZIMY.map((r, i) => `<button type="button" data-r="${r.id}" aria-pressed="${r.id === S.rezim}" title="Shift+${i + 1}"><kbd>${i + 1}</kbd><span class="ik">${r.ik}</span>${r.nazev}</button>`).join('');
    $('seznamPredvoleb').innerHTML = REZIMY.map((r, i) => `<button class="pol" role="menuitem" data-r="${r.id}">${r.ik} ${r.nazev}<span class="pozn">${r.id === S.rezim ? '✓ ' : ''}Shift+${i + 1}</span></button>`).join('');
  }
  $('rezimy').addEventListener('click', (e) => { const b = e.target.closest('button[data-r]'); if (b) nastavRezim(b.dataset.r); });
  $('seznamPredvoleb').addEventListener('click', (e) => { const b = e.target.closest('button[data-r]'); if (b) nastavRezim(b.dataset.r); });
  function nastavRezim(r) { if (r !== S.rezim) akce(() => { S.rezim = r; }); }
  function vykresliForm() {
    S = app.p;
    omezVyber();
    const r = REZIMY.find((x) => x.id === S.rezim);
    $('nadpisParam').textContent = r.ik + ' ' + r.nazev;
    $('blokNastroje').classList.add('skryte');
    ({ podlozka: formPodlozka, krabicky: formKrabicky, vlozka: formVlozka, lista: formLista, drzaky: formDrzaky, peg: formPeg })[S.rezim]();
    $('boxTisk').hidden = !$('poleOut').children.length;
  }
  const skupina = () => (['podlozka', 'krabicky', 'vlozka'].includes(S.rezim) ? 'gf' : S.rezim === 'peg' ? 'peg' : 'stena');

  /* ---------- přepočet, výkresy ---------- */
  let aktScena = null, scenaPodl = null;
  function vlozSvg(el, sc, klik) {
    el.innerHTML = DNV.svg(sc, { pozadi: '#ffffff' });
    if (klik) { el.classList.add('klik'); el.onclick = (e) => { const s = el.querySelector('svg').getBoundingClientRect(); klik(sc.x0 + (e.clientX - s.left) / s.width * (sc.x1 - sc.x0), sc.y1 - (e.clientY - s.top) / s.height * (sc.y1 - sc.y0)); }; }
    else { el.classList.remove('klik'); el.onclick = null; }
  }
  function klikNaPodlozku(x, y) {
    const i = Math.floor(x / DN.GF.roztec), j = Math.floor(y / DN.GF.roztec), K = S.gf.krabicky.map(DN.krabicka);
    const q = K.findIndex((k) => i >= k.gx && i < k.gx + k.n && j >= k.gy && j < k.gy + k.m);
    if (q >= 0) { akce(() => { S.gf.vybrana = q; if (S.rezim === 'podlozka') S.rezim = 'krabicky'; }); return; }
    const k = krab(), P = DN.podlozka(S.gf.podlozka);
    if (S.rezim === 'krabicky' && k && i >= 0 && j >= 0 && i + k.n <= P.nx && j + k.m <= P.ny) {
      const zkus = S.gf.krabicky.map(DN.krabicka); zkus[S.gf.vybrana] = DN.krabicka(Object.assign({}, k, { gx: i, gy: j }));
      if (DN.kontrolaKrabicek(zkus, P.nx, P.ny).chyby.some((c) => c.typ === 'kolize')) { chyba('Tam se krabička nevejde – překrývala by jinou.'); return; }
      akce(() => { k.gx = i; k.gy = j; });
    }
  }
  function prepocti() {
    S = app.p;
    const vy = $('vykresy'); vy.className = 'vykresy';
    const P = DN.podlozka(S.gf.podlozka), K = S.gf.krabicky.map(DN.krabicka);
    let inf = '', varov = [], chyby = [];
    const kol = DN.kontrolaKrabicek(K, P.nx, P.ny);
    if (skupina() === 'gf') {
      scenaPodl = DNV.scenaPodlozka(P, S.gf.krabicky, S.rezim === 'podlozka' ? -1 : S.gf.vybrana);
      chyby = kol.chyby.map((c) => c.text);
      if (S.rezim === 'podlozka') {
        aktScena = scenaPodl;
        vy.innerHTML = '<div class="papir" id="v1"></div>'; vlozSvg($('v1'), scenaPodl, klikNaPodlozku);
        const D = P.deleni;
        inf = `<b>${P.nx} × ${P.ny}</b> buněk · vnější rozměr <b>${cz(P.sirka)} × ${cz(P.hloubka)} mm</b> · výška ${cz(P.vyska)} mm<br>Díly: <b>${D.dily.length}</b> (${D.dily.map((d) => d.id + ' ' + cz(d.w, 0) + '×' + cz(d.h, 0)).join(', ')})${D.otoceny ? ' – díly otočené o 90° na tiskové ploše' : ''}<br>Magnety ${P.magnetu} · volných buněk ${kol.volnych}`;
        varov = P.varovani;
        $('nadpisVykres').textContent = 'Podložka – půdorys a dělení na díly'; $('infoVykres').textContent = 'klik na krabičku = výběr';
        $('napovedaVykres').textContent = 'Červeně čárkovaně: dělení na díly podle tiskové plochy (řez po hranách buněk). Zeleně: krabičky v podložce.';
      } else {
        const k = krab(), Kk = k ? DN.krabicka(k) : null;
        vy.className = 'vykresy dva';
        vy.innerHTML = '<div><h3>Krabička – půdorys a řez</h3><div class="papir" id="v1"></div></div><div><h3>Umístění v podložce</h3><div class="papir" id="v2"></div></div>';
        if (Kk) { aktScena = DNV.scenaKrabicka(Kk); vlozSvg($('v1'), aktScena); varov = Kk.varovani.slice(); }
        else { aktScena = scenaPodl; $('v1').innerHTML = '<p class="info">Žádná krabička.</p>'; }
        vlozSvg($('v2'), scenaPodl, klikNaPodlozku);
        if (Kk) {
          inf = `<b>${Kk.n} × ${Kk.m} × ${Kk.u}</b> · ${cz(Kk.sirka)} × ${cz(Kk.hloubka)} mm · výška ${cz(Kk.vyska)} mm + lem (celkem ${cz(Kk.vyskaCelkem)} mm)`;
          if (Kk.vlozka) {
            const V = DN.vlozka(Kk, Kk.vlozka);
            inf += `<br>Kapes <b>${V.kapsy.length}</b>${V.nevesly.length ? `, nevešlo se <b>${V.nevesly.length}</b>` : ''} · plocha ${cz(V.plocha.W)} × ${cz(V.plocha.H)} mm · výplň do ${cz(V.zVypln)} mm`;
            varov = varov.concat(V.varovani);
          } else inf += `<br>Přihrádky ${Kk.delX} × ${Kk.delY} (${cz(Kk.kw)} × ${cz(Kk.kh)} mm), dno ve výšce ${cz(Kk.zDno)} mm`;
          inf += ` · magnetů ${Kk.magnetu}`;
        }
        $('nadpisVykres').textContent = S.rezim === 'vlozka' ? 'Vložka s kapsami' : 'Krabička'; $('infoVykres').textContent = S.rezim === 'krabicky' ? 'klik do volné buňky = přesun' : '';
        $('napovedaVykres').textContent = S.rezim === 'vlozka' ? 'Kapsy jsou rozložené automaticky po řadách; popisky (modře) se vyryjí před kapsu. Čárkovaně plocha pro kapsy (mimo stohovací lem).' : 'Modře: štítek, čárkovaně: lopatka a otvory pro magnety. Řez A–A s profilem podstavy a stohovacím lemem podle specifikace.';
      }
    } else if (skupina() === 'stena') {
      const L = DN.lista(S.stena.lista), R = DN.rezPlan(L), Sw = DN.rozvrzeniSteny(L, S.stena.drzaky, S.stena.nast);
      chyby = Sw.chyby;
      const d = drz(), G = d ? DN.drzak(d, L, S.stena.nast) : null;
      if (S.rezim === 'lista') {
        vy.className = 'vykresy dva';
        vy.innerHTML = '<div class="cela" style="grid-column:1/-1"><h3>Rozvržení stěny (zepředu)</h3><div class="papir" id="v1"></div></div><div><h3>Řezný plán – deska 1</h3><div class="papir" id="v2"></div></div><div><h3>Profil lišty</h3><div class="papir" id="v3"></div></div>';
        aktScena = DNV.scenaStena(Sw); vlozSvg($('v1'), aktScena); vlozSvg($('v2'), DNV.scenaRezPlan(R, 0)); vlozSvg($('v3'), DNV.scenaProfilListy(L, G));
        inf = `Pás <b>${cz(L.sirkaPasu, 1)} mm</b> → 2 lišty ${cz(L.t)} × ${cz(L.h)} (krátká strana ${cz(L.kratka)}) · pásů <b>${R.pasu}</b> · desek <b>${R.desky.length}</b> (${R.naDesku} pásů na desku) · využití ${cz(R.vyuzito, 0)} %<br>Lišt <b>${R.kusy.length}</b>: ${R.kusy.map((k) => cz(k.delka, 0)).join(', ')} mm · vrutů ${Sw.vruty.length}${R.volnaPul ? ' · zbude 1 volná lišta' : ''}`;
        varov = R.varovani;
        $('nadpisVykres').textContent = 'French cleat – stěna, řezný plán, profil'; $('infoVykres').textContent = '';
        $('napovedaVykres').textContent = 'Křížky: vruty. Červeně: šikmý řez uprostřed pásu (z jednoho pásu dvě lišty), na stěně spoje dílů lišty.';
      } else {
        vy.className = 'vykresy dva';
        vy.innerHTML = '<div><h3>Držák – pohled shora a z boku</h3><div class="papir" id="v1"></div></div><div><h3>Na liště (řez)</h3><div class="papir" id="v2"></div></div>';
        if (G) { aktScena = DNV.scenaDrzak(G); vlozSvg($('v1'), aktScena); varov = G.varovani.slice(); } else { aktScena = DNV.scenaStena(Sw); $('v1').innerHTML = '<p class="info">Žádný držák.</p>'; }
        vlozSvg($('v2'), DNV.scenaProfilListy(L, G));
        if (G) inf = `<b>${esc(G.nazev)}</b> · šířka ${cz(G.sirka)} mm · police ${cz(G.hloubka)} mm · výška ${cz(G.zHorni - G.zSpodni)} mm<br>Tisk: <b>${G.orientace === 'hlavou' ? 'horní plochou na podložku' : 'na boku (profil na podložce)'}</b> · rozměr tisku ${cz(G.tisk.x, 0)} × ${cz(G.tisk.y, 0)} × ${cz(G.tisk.z, 0)} mm${G.casti.length > 1 ? ` · ${G.casti.length} díly` : ''}`;
        $('nadpisVykres').textContent = 'Držák na lištu'; $('infoVykres').textContent = '';
        $('napovedaVykres').textContent = 'Zeleně: držák z 3D tisku, dřevo: nástěnná lišta. Hák dosedá na úkos lišty s vůlí; čárkovaně otvory a štěrbiny pro nástroje.';
      }
    } else {
      const h = hakV(), H = h ? DN.hak(h) : null;
      vy.innerHTML = '<div class="papir" id="v1"></div>';
      if (H) { aktScena = DNV.scenaHak(H); vlozSvg($('v1'), aktScena); varov = H.varovani; inf = `Kolík <b>${cz(H.s)} × ${cz(H.s)} mm</b> do díry Ø${cz(H.dira)} · rozteč ${cz(H.roztec)} mm · šířka háčku ${cz(H.w)} mm · tisk naplocho`; }
      $('nadpisVykres').textContent = 'Pegboard háček – bok'; $('infoVykres').textContent = '';
      $('napovedaVykres').textContent = 'Horní kolík s nožkou zapadne za desku, dolní rovný kolík brání pootočení. Kolíky leží při tisku na podložce.';
    }
    $('info').innerHTML = inf;
    app.hlaseni((chyby || []).map((text) => ({ uroven: 'chyba', text })).concat((varov || []).map((text) => ({ uroven: 'varovani', text }))), { boxy: [] });
    const r = REZIMY.find((x) => x.id === S.rezim);
    TrubkyGui.souhrn('sParam', r.nazev, true);
    vykresliKusovnik();
    vypisVysledky();
    obnovDilStl();
    naplanuj3d();
  }

  /* ---------- kusovník, výsledky ---------- */
  const objemy = {};
  function vykresliKusovnik() {
    const rows = DN.kusovnik(S, objemy);
    let sk = '';
    $('tabKusovnik').innerHTML = '<tr><th>Položka</th><th class="c">Množství</th><th>Poznámka</th></tr>' + rows.map((r) => {
      const h = r.skupina !== sk ? `<tr><th colspan="3" style="color:var(--text);padding-top:8px">${esc(r.skupina)}</th></tr>` : ''; sk = r.skupina;
      return h + `<tr><td>${esc(r.polozka)}</td><td class="c">${esc(r.mnozstvi)} ${esc(r.jednotka)}</td><td>${esc(r.pozn)}</td></tr>`;
    }).join('');
  }
  /** Odhad materiálu a doby tisku pro díly zvoleného režimu (objemy z 3D výpočtu). */
  function vypisVysledky() {
    const g = skupina(), re = { gf: /^(podlozka|krabicka\d+)$/, stena: /^(drzak\d+|koncovky)$/, peg: /^hak\d+$/ }[g];
    const V = Object.keys(objemy).filter((k) => re.test(k)).reduce((s, k) => s + objemy[k], 0);
    const dilu = dilyRezimu(g).length;
    if (!V) { $('vVysledky').innerHTML = G3D.dlazdice('Materiál', '…', 'spočítá se se 3D náhledem'); return; }
    const hust = g === 'gf' ? 1.24 : 1.27, mat = g === 'gf' ? 'PLA' : 'PETG', o = G3D.odhadTisku(V, hust, { dilu });
    $('vVysledky').innerHTML = G3D.dlazdice('Dílů k tisku', String(dilu), { gf: 'podložka + krabičky', stena: 'držáky + koncovka lišty', peg: 'háčky' }[g])
      + G3D.dlazdice('Objem', `${cz(V / 1000, 1)} cm³`, 'plné díly (horní mez)')
      + G3D.dlazdice('Hmotnost', `${cz(o.g, 0)} g`, `${mat}, při 30 % výplni zhruba ${cz(o.g * 0.55, 0)} g`)
      + G3D.dlazdice('Filament', `${cz(o.metru, 1)} m`, 'průměr 1,75 mm')
      + G3D.dlazdice('Doba tisku', `≈ ${o.minut < 60 ? o.minut + ' min' : cz(o.minut / 60, 1) + ' h'}`, 'hrubý odhad, vrstva 0,2 mm');
  }

  /* ---------- knihovny na vyžádání ---------- */
  let pismoSlib = null, rytinaSlib = null;
  const nactiManifold = () => app.manifold();
  /** písmo pro vyryté popisky (opentype.js + Liberation Sans Bold, OFL) */
  function nactiRytinu() {
    if (rytinaSlib) return rytinaSlib;
    rytinaSlib = (async () => {
      try {
        if (!window.opentype) await G3D.nactiSkript('lib/opentype.min.js');
        let buf = null;
        try { const r = await fetch('fonty/LiberationSans-Bold.ttf'); if (r.ok) buf = await r.arrayBuffer(); } catch (e) { buf = null; }
        if (!buf) {
          await G3D.nactiSkript('fonty/js/LiberationSans-Bold.ttf.js');
          const b = atob(window.FONTY_JS['LiberationSans-Bold.ttf']), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); buf = u.buffer;
        }
        return window.opentype.parse(buf);
      } catch (e) { console.warn('písmo pro rytinu', e); return null; }
    })();
    return rytinaSlib;
  }
  function nactiPismoPdf() {
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

  /* ---------- sítě dílů (s mezipamětí) ---------- */
  const cache = new Map();
  function zCache(klic, fn) {
    if (cache.has(klic)) return cache.get(klic);
    const v = fn(); cache.set(klic, v);
    if (cache.size > 60) cache.delete(cache.keys().next().value);
    return v;
  }
  const sitPodlozky = (w, dil) => zCache('p' + dil + JSON.stringify(S.gf.podlozka), () => DNT.podlozka(w, S.gf.podlozka, dil || null));
  const sitKrabicky = (w, f, k) => zCache('k' + JSON.stringify(k), () => DNT.krabicka(w, k, f));
  const sitDrzaku = (w, f, d, tisk) => { const G = DN.drzak(d, S.stena.lista, S.stena.nast); return zCache('d' + (tisk ? 't' : '') + JSON.stringify([d, S.stena.lista.t, S.stena.lista.h, S.stena.lista.uhel, S.stena.nast]), () => DNT.drzak(w, G, f, { tisk, nast: S.stena.nast })); };
  const sitListy = (w) => { const L = DN.lista(S.stena.lista); return zCache('l' + JSON.stringify([L.t, L.h, L.uhel, L.delka]), () => DNT.listaSit(w, L, L.delka)); };
  const sitKoncovky = (w) => { const L = DN.lista(S.stena.lista); return zCache('c' + JSON.stringify([L.t, L.h, L.uhel]), () => DNT.koncovka(w, L)); };
  const sitHaku = (w, h, mont) => zCache('h' + (mont ? 'm' : '') + JSON.stringify(h), () => DNT.hak(w, h, { namontovany: mont }));
  function zaznamenejObjemy(w, f) {
    // objemy pro odhad filamentu (bez dělení vybraných dílů)
    try {
      objemy.podlozka = sitPodlozky(w, null).objem;
      S.gf.krabicky.forEach((k, i) => { objemy['krabicka' + i] = sitKrabicky(w, f, k).objem; });
      for (const k of Object.keys(objemy)) if (/^krabicka(\d+)$/.test(k) && +RegExp.$1 >= S.gf.krabicky.length) delete objemy[k];
    } catch (e) { console.warn(e); }
  }

  /* ---------- 3D ---------- */
  const nahled = DN_NAHLED.vytvor($('platno'));
  const stavZobr = { tisk: false, rozlozit: false, vykres: false };
  let t3d = 0, poradi3d = 0, skupina3d = '', prvni3d = true;
  const pohled3d = (j) => { if (stavZobr.vykres) $('tVykres').click(); nahled.pohled(j); };
  function naplanuj3d() { clearTimeout(t3d); t3d = setTimeout(aktualizuj3d, prvni3d ? 0 : 350); }
  const tiskovaSirka = (g) => (g === 'gf' ? S.gf.podlozka.tiskX : g === 'stena' ? S.stena.nast.tiskX : 220) || 220;
  /** Díly zvoleného režimu v tiskové poloze vedle sebe: [{poz, idx, nazev, jmeno, objem}]. */
  async function dilyTisku() {
    const [w, f] = await Promise.all([nactiManifold(), nactiRytinu()]);
    const g = skupina();
    const D = dilyRezimu(g).map((d) => { const m = d.sit(w, f); return { poz: m.poz, idx: m.idx, nazev: d.nazev, jmeno: bezpecne(d.nazev), objem: m.objem }; });
    return G3D.tiskoveRozlozeni(D, 1, 6, tiskovaSirka(g));
  }
  async function aktualizuj3d() {
    const moje = ++poradi3d, st = $('stav3d');
    try {
      const [w, f] = await Promise.all([nactiManifold(), nactiRytinu()]);
      if (moje !== poradi3d) return;
      const ob = [], g = skupina();
      let popis = '';
      if (stavZobr.tisk) {
        const D = await dilyTisku();
        if (moje !== poradi3d) return;
        D.forEach((d, i) => ob.push({ sit: d, barva: [0x3f8f5a, 0x4f86d9, 0xe07a2e, 0x8f9aa6][i % 4] }));
        popis = `Tisková poloha: ${D.length} dílů vedle sebe (podložka ${cz(tiskovaSirka(g), 0)} mm)`;
      } else if (g === 'gf') {
        const P = DN.podlozka(S.gf.podlozka);
        ob.push({ sit: sitPodlozky(w, null), barva: 0x8f9aa6 });
        const z0 = P.sDnem ? P.dnoTl : 0;
        S.gf.krabicky.forEach((k, i) => ob.push({ sit: sitKrabicky(w, f, k), barva: i === S.gf.vybrana && S.rezim !== 'podlozka' ? 0xe07a2e : 0x3f8f5a, posun: [0, 0, z0 + (stavZobr.rozlozit ? 30 + i * 4 : 0)] }));
        popis = `Podložka + ${S.gf.krabicky.length} krabiček${stavZobr.rozlozit ? ' (rozloženo)' : ''}`;
      } else if (g === 'stena') {
        const Sw = DN.rozvrzeniSteny(S.stena.lista, S.stena.drzaky, S.stena.nast), L = Sw.L;
        const zMax = Math.max(...Sw.rady.map((r) => r.zHorni)) + 80, zMin = Math.min(...Sw.rady.map((r) => r.zSpodni)) - 80;
        ob.push({ box: [-30, -12, zMin, L.delka + 30, 0, zMax], barva: 0xd9d4ca, pozadi: true });
        const li = sitListy(w);
        for (const r of Sw.rady) ob.push({ sit: li, barva: 0xc8a26b, posun: [0, 0, r.zSpodni], drevo: true });
        const ko = sitKoncovky(w);
        Sw.umisteni.forEach((u) => { const m = sitDrzaku(w, f, u.d, false); objemy['drzak' + u.q] = m.objem; ob.push({ sit: m, barva: u.q === S.stena.vybrany ? 0xe07a2e : 0x3f8f5a, posun: [L.delka - u.x1, stavZobr.rozlozit ? 40 : 0, Sw.rady[u.r].zHorni + (stavZobr.rozlozit ? 30 : 0)] }); }); /* x od levého konce při pohledu zepředu */
        for (const k of Object.keys(objemy)) if (/^drzak(\d+)$/.test(k) && +RegExp.$1 >= S.stena.drzaky.length) delete objemy[k];
        objemy.koncovky = ko.objem * 2 * L.rady;
        popis = `Stěna ${cz(L.delka, 0)} mm, ${L.rady} řady, ${Sw.umisteni.length} držáků`;
      } else {
        const h = hakV();
        if (h) {
          const H = DN.hak(h), R = H.roztec;
          ob.push({ box: [-3 * R, -H.deska, -3 * R, 4 * R, 0, 2 * R], barva: 0xd9c7a4, pozadi: true });
          S.peg.haky.forEach((hh, i) => { const m = sitHaku(w, hh, true); objemy['hak' + i] = m.objem * Math.max(1, cislo(hh.ks, 1)); ob.push({ sit: m, barva: i === S.peg.vybrany ? 0xe07a2e : 0x3f8f5a, posun: [(i - S.peg.vybrany) * 2 * R - DN.hak(hh).w / 2, stavZobr.rozlozit ? 30 : 0, 0] }); });
        }
        popis = 'Háčky v děrované desce';
      }
      if (g === 'gf') zaznamenejObjemy(w, f);
      if (moje !== poradi3d) return;
      const novyPohled = g !== skupina3d ? 'iso' : false;
      skupina3d = g;
      nahled.nastav(ob, { tisk: stavZobr.tisk, uhel: 45, liceY: g !== 'gf' && !stavZobr.tisk, novyPohled });
      prvni3d = false;
      st.textContent = ''; st.classList.remove('chyba');
      $('karta3d').textContent = popis;
      vykresliKusovnik(); vypisVysledky();
    } catch (e) { console.error(e); st.textContent = '3D se nepodařilo spočítat: ' + (e && e.message || e); st.classList.add('chyba'); }
  }

  /* ---------- soubory ---------- */
  const stahni = (obsah, nazev, typ) => app.stahni(obsah instanceof Blob ? obsah : new Blob([obsah], { type: typ || 'application/octet-stream' }), nazev);
  const bezpecne = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60);
  const zaklad = () => bezpecne(S.nazev || 'drzaky_naradi') || 'drzaky_naradi';
  async function sPrubehem(id, text, fn) {
    const b = $(id), puv = b.innerHTML; b.disabled = true; b.textContent = text;
    try { await new Promise((r) => setTimeout(r, 30)); return await fn(); } catch (e) { console.error(e); chyba('Chyba: ' + e.message); return null; }
    finally { b.disabled = false; b.innerHTML = puv; }
  }
  /** STL díly podle režimu: [{id, nazev, sit()}] */
  function dilyRezimu(g) {
    const out = [];
    if (g === 'gf') {
      const P = DN.podlozka(S.gf.podlozka);
      for (const d of P.deleni.dily) out.push({ id: 'podl_' + d.id, nazev: `Podložka díl ${d.id} (${cz(d.w, 0)}×${cz(d.h, 0)})`, sit: (w) => doPocatku(sitPodlozky(w, d.id)) });
      S.gf.krabicky.forEach((k, i) => out.push({ id: 'krab_' + i, nazev: `Krabička ${i + 1}: ${k.n}×${k.m}×${k.u}${k.vlozka ? ' s kapsami' : ''}`, sit: (w, f) => doPocatku(sitKrabicky(w, f, k)) }));
    } else if (g === 'stena') {
      S.stena.drzaky.forEach((d, i) => out.push({ id: 'drzak_' + i, nazev: `Držák ${i + 1}: ${DN.drzak(d, S.stena.lista, S.stena.nast).nazev}`, sit: (w, f) => sitDrzaku(w, f, d, true) }));
      out.push({ id: 'koncovka', nazev: 'Koncovka lišty (2 ks na řadu)', sit: (w) => sitKoncovky(w) });
    } else S.peg.haky.forEach((h, i) => out.push({ id: 'hak_' + i, nazev: `Háček ${i + 1}: ${h.typ === 'J' ? 'J' : 'rovný'} ${cz(cislo(h.delka, 60), 0)} (${h.ks || 1} ks)`, sit: (w) => sitHaku(w, h, false) }));
    return out;
  }
  function doPocatku(m) {
    const p = new Float32Array(m.poz), mn = m.bbox.min;
    for (let i = 0; i < p.length; i += 3) { p[i] -= mn[0]; p[i + 1] -= mn[1]; p[i + 2] -= mn[2]; }
    return Object.assign({}, m, { poz: p });
  }
  function obnovDilStl() {
    const sel = $('dilStl'), D = dilyRezimu(skupina()), puv = sel.value;
    let vyb = puv;
    if (S.rezim === 'krabicky' || S.rezim === 'vlozka') vyb = 'krab_' + S.gf.vybrana;
    if (S.rezim === 'drzaky') vyb = 'drzak_' + S.stena.vybrany;
    if (S.rezim === 'lista') vyb = 'koncovka';
    if (S.rezim === 'peg') vyb = 'hak_' + S.peg.vybrany;
    sel.innerHTML = D.map((d) => `<option value="${d.id}">${esc(d.nazev)}</option>`).join('');
    if (D.some((d) => d.id === vyb)) sel.value = vyb;
  }
  /** STL / 3MF všech dílů režimu v tiskové poloze. */
  function exportVse(druh) {
    return sPrubehem(druh === 'stl' ? 'btnStl' : 'btn3mf', 'Počítám díly…', async () => {
      const D = await dilyTisku();
      if (!D.length) { chyba('Režim nemá žádné díly k tisku.'); return; }
      const jm = `${zaklad()}_${S.rezim}`;
      if (druh === 'stl') stahni(KRAB.stlBinarni(D, 'drzaky naradi - ' + S.rezim), jm + '.stl', 'model/stl');
      else stahni(KRAB.soubor3mf(D, S.nazev || 'Držáky nářadí'), jm + '.3mf', 'model/3mf');
    });
  }
  $('btnStl').addEventListener('click', () => exportVse('stl'));
  $('btn3mf').addEventListener('click', () => exportVse('3mf'));
  $('btnStlDil').addEventListener('click', () => sPrubehem('btnStlDil', 'Počítám STL…', async () => {
    const [w, f] = await Promise.all([nactiManifold(), nactiRytinu()]);
    const d = dilyRezimu(skupina()).find((x) => x.id === $('dilStl').value); if (!d) return;
    const m = d.sit(w, f);
    stahni(new Blob([DNT.stlBinarni(m.poz, m.idx, d.nazev)], { type: 'model/stl' }), `${zaklad()}_${bezpecne(d.nazev)}.stl`);
    info(`${d.nazev}: ${(m.idx.length / 3).toLocaleString('cs')} trojúhelníků, objem ${cz(m.objem / 1000, 1)} cm³, uzavřené těleso.${f ? '' : ' (bez vyrytých popisků – písmo se nenačetlo)'}`);
  }));
  $('btnZip').addEventListener('click', () => sPrubehem('btnZip', 'Počítám všechny díly…', async () => {
    const [w, f] = await Promise.all([nactiManifold(), nactiRytinu()]);
    const soubory = [];
    for (const g of ['gf', 'stena', 'peg']) for (const d of dilyRezimu(g)) {
      const m = d.sit(w, f);
      soubory.push({ nazev: `${g}/${bezpecne(d.nazev)}.stl`, data: DNT.stlBinarni(m.poz, m.idx, d.nazev) });
      await new Promise((r) => setTimeout(r, 0));
    }
    soubory.push({ nazev: 'kusovnik.csv', data: '﻿' + DNV.csv(DN.kusovnik(S, objemy)) });
    soubory.push({ nazev: 'CTIMNE.txt', data: navodTisku() });
    stahni(new Blob([DNT.zip(soubory)], { type: 'application/zip' }), zaklad() + '_stl.zip');
    info(`ZIP: ${soubory.length - 2} STL + kusovník.`);
  }));
  function navodTisku() {
    return ['Drzaky naradi a Gridfinity - poznamky k tisku', '',
      'gf/: podlozky a krabicky - PLA, vrstva 0,2 mm, bez podpor, krabicky dnem dolu.',
      'stena/: drzaky - PETG, 4 perimetry, vypln >= 30 %. Soubory jsou uz natocene do polohy tisku',
      '        (police hlavou dolu, stupnovity stojanek na boku). Koncovky listy 2 ks na radu.',
      'peg/: hacky - PETG, tisk naplocho, pocet kusu viz nazev souboru.',
      'Magnety 6 x 2 mm vlepit vterinovym lepidlem, polaritu vyzkouset.',
      'Rozmery Gridfinity: gridfinity-rebuilt-openscad (MIT) / gridfinity.xyz.', ''].join('\r\n');
  }
  $('btnSvg').addEventListener('click', () => { if (aktScena) stahni(DNV.svg(aktScena, { pozadi: '#ffffff' }), `${zaklad()}_${S.rezim}.svg`, 'image/svg+xml'); });
  $('btnDxf').addEventListener('click', () => { if (aktScena) stahni(DNV.dxf(aktScena), `${zaklad()}_${S.rezim}.dxf`, 'application/dxf'); });
  const csv = () => stahni('﻿' + DNV.csv(DN.kusovnik(S, objemy)), zaklad() + '_kusovnik.csv', 'text/csv;charset=utf-8');
  $('btnCsv').addEventListener('click', csv); $('btnCsv2').addEventListener('click', csv);
  const papir = () => DN.PAPIRY[$('papir').value] || DN.PAPIRY.a4;
  function vykresyGf() {
    const P = DN.podlozka(S.gf.podlozka), v = [{ scena: DNV.scenaPodlozka(P, S.gf.krabicky, -1), meritko: 'fit', nazev: `Podložka ${P.nx} × ${P.ny} – půdorys a dělení na díly` }];
    S.gf.krabicky.forEach((k, i) => {
      const K = DN.krabicka(k);
      v.push({ scena: DNV.scenaKrabicka(K), meritko: 'fit', nazev: `Krabička ${i + 1}: ${K.n} × ${K.m} × ${K.u}${k.nazev ? ' – ' + k.nazev : ''}` });
      if (K.vlozka) v.push({ scena: DNV.scenaKapsy11(K), meritko: 1, nazev: `Krabička ${i + 1} – kapsy 1:1 (zkuste nástroje položit na papír)` });
    });
    v.push({ scena: DNV.scenaLicovani(8), meritko: 'fit', zvetseni: 8, nazev: 'Detail lícování krabička / podložka' });
    return v;
  }
  function vykresyStena() {
    const L = DN.lista(S.stena.lista), R = DN.rezPlan(L), Sw = DN.rozvrzeniSteny(L, S.stena.drzaky, S.stena.nast);
    const v = [{ scena: DNV.scenaStena(Sw), meritko: 'fit', nazev: 'Rozvržení stěny' }];
    R.desky.forEach((_, i) => v.push({ scena: DNV.scenaRezPlan(R, i), meritko: 'fit', nazev: `Řezný plán – deska ${i + 1}/${R.desky.length}` }));
    const G0 = drz() ? DN.drzak(drz(), L, S.stena.nast) : null;
    v.push({ scena: DNV.scenaProfilListy(L, G0), meritko: 1, nazev: 'Profil lišty 1:1 – šablona pro nastavení úhlu pily' });
    S.stena.drzaky.forEach((d, i) => { const G = DN.drzak(d, L, S.stena.nast); v.push({ scena: DNV.scenaDrzak(G), meritko: 1, nazev: `Držák ${i + 1}: ${G.nazev}` }); });
    S.peg.haky.forEach((h, i) => v.push({ scena: DNV.scenaHak(DN.hak(h)), meritko: 1, nazev: `Pegboard háček ${i + 1}` }));
    return v;
  }
  async function pdfStahnout(id, gf) {
    await sPrubehem(id, 'Připravuji PDF…', async () => {
      if (!window.jspdf) throw new Error('Knihovna jsPDF se nenačetla.');
      const pismo = await nactiPismoPdf();
      if (!pismo) info('Písmo se nepodařilo načíst – PDF bude bez diakritiky.');
      const nazev = (S.nazev || 'Držáky nářadí') + (gf ? ' – Gridfinity' : ' – stěna a držáky');
      const kus = DN.kusovnik(S, objemy).filter((r) => (gf ? /^(Gridfinity|Spojovací|Materiál)/ : /^(Stěna|Držáky|Pegboard|Materiál)/).test(r.skupina));
      const st = DNV.strany(gf ? vykresyGf() : vykresyStena(), papir(), { nazev, kusovnik: kus, poznamky: gf ? ['Rozměry Gridfinity podle gridfinity-rebuilt-openscad (MIT), specifikace gridfinity.xyz. Krabička 42·N − 0,5 mm, výška 7·U + lem 4,4 mm.'] : ['Bezpečnost: šikmý podélný řez na okružní pile jen s rozvíracím klínem, posunovačem a krytem kotouče.'] });
      const doc = DNV.pdf(window.jspdf.jsPDF, st, { pismo, nazev });
      stahni(doc.output('blob'), `${zaklad()}_${gf ? 'gridfinity' : 'stena'}.pdf`);
      info(`PDF: ${st.length} stran.`);
    });
  }
  $('btnPdfGf').addEventListener('click', () => pdfStahnout('btnPdfGf', true));
  $('btnPdfStena').addEventListener('click', () => pdfStahnout('btnPdfStena', false));

  /* ---------- moje projekty (pojmenované v prohlížeči, klíč _projekty) ---------- */
  function vykresliProjekty() {
    const P = projekty(), jm = Object.keys(P).sort((a, b) => a.localeCompare(b, 'cs'));
    $('seznamProjektu').innerHTML = jm.length ? jm.map((j) => `<option value="${esc(j)}">${esc(j)}</option>`).join('') : '<option value="">– zatím nic –</option>';
    $('nazevMoje').value = S.nazev || '';
  }
  $('btnUlozitMoje').addEventListener('click', async () => {
    let jm = ($('nazevMoje').value || S.nazev || '').trim();
    if (!jm) { jm = await Dialog.zeptej('Název projektu', 'Dílna'); if (!jm) return; jm = jm.trim(); }
    if (jm !== S.nazev) { uprav(() => { S.nazev = jm; }); app.naplnFormular(); }
    const P = projekty();
    if (P[jm] && !(await Dialog.potvrd(`Projekt „${jm}“ už existuje. Přepsat?`))) return;
    P[jm] = JSON.parse(JSON.stringify(S)); P[jm].ulozeno = new Date().toISOString();
    if (ulozProjekty(P)) { vykresliProjekty(); $('seznamProjektu').value = jm; info('Projekt uložen.'); }
  });
  $('btnNacistMoje').addEventListener('click', () => { const j = $('seznamProjektu').value, P = projekty(); if (!P[j]) return; app.nahrad(DN.normalizujProjekt(JSON.parse(JSON.stringify(P[j])))); vykresliProjekty(); info('Načteno: ' + j); });
  $('btnSmazat').addEventListener('click', async () => {
    const j = $('seznamProjektu').value, P = projekty(); if (!P[j]) return;
    if (!(await Dialog.potvrd(`Smazat projekt „${j}“?`))) return;
    delete P[j]; ulozProjekty(P); vykresliProjekty();
  });

  /* ---------- nabídky, přepínače, start ---------- */
  $('podzalozky').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-z]'); if (!b) return;
    for (const x of $('podzalozky').children) x.setAttribute('aria-selected', String(x === b));
    for (const p of document.querySelectorAll('.panel[data-panel]')) p.hidden = p.dataset.panel !== b.dataset.z;
  });
  $('princGf').innerHTML = DNP.gridfinity;
  $('princStena').innerHTML = DNP.stena;
  vlozSvg($('detailLicovani'), DNV.scenaLicovani(8));
  const Lc = DN.licovani();
  $('infoLicovani').innerHTML = `Krabička dosedá na horní zkosení 45° (nejmenší vůle ${cz(Math.max(0, Lc.minMezera))} mm), na svislé části je vůle <b>${cz(Lc.mezeraSvisla)} mm</b>, nahoře 41,5 vs 42 mm = <b>${cz(Lc.mezeraNahore)} mm</b> na stranu. Spodek krabičky leží ${cz(Lc.spodekNadDnem)} mm nad dnem lůžka (využije vůli 0,35 mm).`;

  TrubkyGui.pripoj({ klic: KLIC + '_gui', pohled: pohled3d });
  nahled.barvy(css('--border-strong'), css('--border'), css('--text'));
  function ukazNahled() {
    const v2 = stavZobr.vykres && !stavZobr.tisk;
    $('vykresPanel').hidden = !v2;
    $('n2d').setAttribute('aria-pressed', String(v2)); $('n3d').setAttribute('aria-pressed', String(!v2));
    $('legPrevisy').hidden = !(stavZobr.tisk && nahled.stav.previsy);
  }
  app.prepinac('tHrany', (h) => nahled.prepni('hrany', h));
  app.prepinac('tRez', (h) => { nahled.prepni('rez', h); $('legRez').hidden = !h; });
  app.prepinac('tPrevisy', (h) => { nahled.prepni('previsy', h); ukazNahled(); }, true);
  app.prepinac('tPravitka', (h) => nahled.prepni('pravitka', h), true);
  app.prepinac('tRozlozit', (h) => { stavZobr.rozlozit = h; if (!prvni3d) naplanuj3d(); });
  app.prepinac('tTisk', (h) => { stavZobr.tisk = h; ukazNahled(); if (!prvni3d) { skupina3d = ''; naplanuj3d(); } });
  app.prepinac('tVykres', (h) => { stavZobr.vykres = h; ukazNahled(); }, true);
  $('n2d').addEventListener('click', () => { if (stavZobr.tisk) $('tTisk').click(); if (!stavZobr.vykres) $('tVykres').click(); });
  $('n3d').addEventListener('click', () => { if (stavZobr.vykres) $('tVykres').click(); });
  $('btnZobrazVykres').addEventListener('click', () => $('n2d').click());

  vykresliRezimy(); vykresliForm(); vykresliProjekty();
  app.start();
  window.DNApp = { get stav() { return S; }, nastavRezim, prepocti, nactiManifold, nactiRytinu, dilyRezimu, dilyTisku, nahled, aktualizuj3d, vykresyGf, vykresyStena, get objemy() { return objemy; }, app };
})();

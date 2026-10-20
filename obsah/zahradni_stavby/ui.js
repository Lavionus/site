/* ============================================================
   Zahradní stavby ze dřeva – ovládání stránky
   ============================================================ */
(function () {
  'use strict';
  const J = window.ZSJ, V = window.ZSV, O = window.ZSO, P = window.ZSP;
  const $ = (id) => document.getElementById(id);
  const fmt = J.fmt;
  const KLIC = 'webapp_zahradni_stavby', KLIC_PROJ = 'webapp_zahradni_stavby_projekty';
  const toast = (t, chyba) => { try { chyba ? Dialog.chyba(t) : Dialog.info(t); } catch (e) { console.log(t); } };
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const TYPY = ['zahon', 'komposter', 'pergola'];
  const NAZVY = { zahon: 'Vyvýšený záhon', komposter: 'Kompostér', pergola: 'Pergola' };
  const IKONY = {
    zahon: '<rect x="4" y="12" width="40" height="16" fill="#c99a62" stroke="currentColor" stroke-width=".8"/><path d="M4 17h40M4 22h40" stroke="currentColor" stroke-width=".6"/><path d="M6 12q6-9 10 0M18 12q5-10 10 0M30 12q6-8 11 0" fill="#4f9a45"/>',
    komposter: '<rect x="3" y="8" width="42" height="22" fill="none" stroke="currentColor"/><path d="M3 12h42M3 17h42M3 22h42M3 27h42" stroke="#c99a62" stroke-width="3"/><path d="M17 8v22M31 8v22" stroke="currentColor" stroke-width="2"/>',
    pergola: '<path d="M8 32V10M40 32V10" stroke="#a9733f" stroke-width="3"/><path d="M3 9h42" stroke="#a9733f" stroke-width="3"/><path d="M6 5l3 3M12 5l3 3M18 5l3 3M24 5l3 3M30 5l3 3M36 5l3 3" stroke="#d9a66a" stroke-width="2"/><circle cx="41" cy="3" r="2.4" fill="#f2b33d"/>',
  };
  const sel = (o) => Object.entries(o).map(([k, v]) => [k, typeof v === 'string' ? v : v.nazev]);
  // [klíč, popisek, typ, min/možnosti, max, krok, sekce, title]
  const PAR = {
    zahon: [
      ['tvar', 'Tvar', 'sel', [['obdelnik', 'obdélník'], ['L', 'do L'], ['U', 'do U']]],
      ['vyska', 'Výška stěny (mm)', 'num', 100, 1500, 10],
      ['delka', 'Délka (mm)', 'num', 400, 12000, 10],
      ['sirka', 'Šířka / šířka ramene (mm)', 'num', 300, 3000, 10],
      ['delkaB', 'Délka 2. ramene (mm)', 'num', 400, 12000, 10],
      ['_', 'Prkna a sloupky'],
      ['prknoB', 'Šířka prkna (mm)', 'num', 50, 400, 1], ['prknoT', 'Tloušťka prkna (mm)', 'num', 12, 100, 1],
      ['sloupek', 'Sloupek čtvercový (mm)', 'num', 30, 200, 5], ['zapusteni', 'Zapuštění sloupků (mm)', 'num', 0, 1200, 10],
      ['vyztuha', 'Výztuha proti vyboulení', 'sel', [['tahla', 'táhla M8 mezi sloupky'], ['sloupky', 'sloupky vetknuté do země']]],
      ['roztecMax', 'Max. rozteč sloupků (0 = statika)', 'num', 0, 5000, 10],
      ['_', 'Zatížení'],
      ['zemina', 'Náplň (objemová tíha, úhel tření)', 'sel', sel(J.ZEMINY), 0, 0, 'cela'],
      ['pritizeni', 'Přitížení povrchu (kN/m²)', 'num', 0, 20, 0.5], ['limitN', 'Limit průhybu L/N', 'num', 50, 500, 10],
      ['_', 'Vybavení a ergonomie'],
      ['horniLista', 'Horní krycí lišta / sedátko', 'chk'],
      ['listaB', 'Šířka lišty (mm)', 'num', 40, 300, 1], ['listaT', 'Tloušťka lišty (mm)', 'num', 15, 80, 1], ['listaPresah', 'Přesah lišty ven (mm)', 'num', 0, 60, 1],
      ['folie', 'Fólie na stěny', 'sel', [['nopova', 'nopová fólie'], ['pe', 'PE fólie'], ['zadna', 'bez fólie']]],
      ['rezerva', 'Volná výška nad náplní (mm)', 'num', 0, 300, 5],
      ['pletivo', 'Pletivo proti hryzcům na dno', 'chk'],
      ['uzivatel', 'Uživatel', 'sel', sel(J.UZIVATELE)], ['pristup', 'Přístup', 'sel', [['oboustranny', 'z obou stran'], ['jednostranny', 'z jedné strany']]],
      ['nakupNaplne', 'Zeminu a kompost kupuji (do ceny)', 'chk'],
    ],
    komposter: [
      ['komor', 'Počet komor', 'sel', [[1, '1'], [2, '2'], [3, '3']]], ['vyska', 'Výška (mm)', 'num', 200, 2000, 10],
      ['sirkaKomory', 'Šířka komory (mm)', 'num', 300, 3000, 10], ['hloubka', 'Hloubka (mm)', 'num', 300, 3000, 10],
      ['_', 'Lamely a sloupky'],
      ['lamelaB', 'Šířka lamely (mm)', 'num', 40, 300, 1], ['lamelaT', 'Tloušťka lamely (mm)', 'num', 10, 80, 1],
      ['mezera', 'Větrací mezera (mm)', 'num', 0, 80, 1], ['sloupek', 'Sloupek čtvercový (mm)', 'num', 40, 200, 5],
      ['odsazeni', 'Mezera nad zemí (mm)', 'num', 0, 300, 5], ['limitN', 'Limit průhybu L/N', 'num', 50, 500, 10],
      ['_', 'Vyjímatelná čela'],
      ['listaB', 'Tloušťka vodicí lišty (mm)', 'num', 10, 80, 1], ['listaH', 'Hloubka drážky = šířka lišty (mm)', 'num', 10, 100, 1],
      ['vule', 'Vůle v drážce (mm)', 'num', 0, 15, 0.5],
      ['_', 'Kotvení'],
      ['kotveni', 'Kotvení sloupků', 'sel', [['zemni_vrut', 'zemní vruty'], ['kameny', 'na dlaždice / kameny'], ['zapustit', 'zapustit do štěrku']]],
      ['zapusteni', 'Zapuštění (mm)', 'num', 0, 1200, 10],
      ['pletivo', 'Pletivo proti hryzcům na dno', 'chk'],
    ],
    pergola: [
      ['varianta', 'Varianta', 'sel', [['volna', 'volně stojící'], ['u_zdi', 'u zdi (nástěnný trám)']]],
      ['vyska', 'Podchozí výška (mm)', 'num', 1500, 4000, 10],
      ['delka', 'Délka – osy krajních sloupů (mm)', 'num', 1000, 15000, 10], ['hloubka', 'Hloubka – rozpětí krokví (mm)', 'num', 1000, 6000, 10],
      ['pole', 'Počet polí (0 = auto)', 'num', 0, 12, 1], ['snih', 'Sněhová oblast', 'sel', Object.keys(J.SNIH).map((k) => [k, `${k} (${fmt(J.SNIH[k], 1)} kN/m²)`])],
      ['_', 'Sloupy a vaznice'],
      ['sloup', 'Sloup čtvercový (mm)', 'num', 80, 300, 10], ['presahV', 'Přesah vaznice (mm)', 'num', 0, 1500, 10],
      ['vaznB', 'Vaznice šířka (mm)', 'num', 40, 300, 10], ['vaznH', 'Vaznice výška (mm)', 'num', 80, 400, 10],
      ['_', 'Krokve'],
      ['krokB', 'Krokev šířka (mm)', 'num', 30, 200, 5], ['krokH', 'Krokev výška (mm)', 'num', 60, 400, 10],
      ['roztecK', 'Max. rozteč krokví (mm)', 'num', 200, 2000, 10], ['presahK', 'Přesah krokví (mm)', 'num', 0, 1500, 10],
      ['zarez', 'Osedlání (zářez) (mm)', 'num', 0, 100, 1], ['zakonceni', 'Zakončení krokví', 'sel', [['sikme', 'šikmé'], ['oblouk', 'oblouk'], ['rovne', 'rovné']]],
      ['_', 'Lamely (stínění)'],
      ['krytina', 'Zastřešení', 'sel', [['lamely', 'lamely'], ['bez', 'jen krokve (popínavky)']], 0, 0, 'cela'],
      ['lamB', 'Šířka lamely (mm)', 'num', 20, 300, 1], ['lamT', 'Tloušťka lamely (mm)', 'num', 10, 100, 1],
      ['roztecL', 'Rozteč lamel (mm)', 'num', 30, 1000, 1], ['sklon', 'Sklon lamel (°, ± = směr)', 'num', -90, 90, 1],
      ['_', 'Ztužení a kotvení'],
      ['pasky', 'Pásky 45° (vzpěry) ve dvou směrech', 'chk'],
      ['paskaRameno', 'Rameno pásku (mm)', 'num', 200, 1500, 10], ['paskaB', 'Průřez pásku (mm)', 'num', 40, 200, 5],
      ['kotveni', 'Kotvení', 'sel', [['beton', 'betonová patka + patka U'], ['zemni_vrut', 'zemní vrut'], ['dlazba', 'patka s deskou na dlažbu']]],
      ['odsazeni', 'Sloup nad terénem (mm)', 'num', 0, 400, 5],
      ['patkaA', 'Patka – strana (mm)', 'num', 200, 1000, 10], ['patkaH', 'Patka – hloubka (mm)', 'num', 300, 2000, 10],
      ['limitN', 'Limit průhybu L/N', 'num', 50, 500, 10],
    ],
  };
  const VIDITELNE = {
    delkaB: (p) => p.tvar !== 'obdelnik', listaB: (p) => p.typ !== 'zahon' || p.horniLista, listaT: (p) => p.horniLista, listaPresah: (p) => p.horniLista,
    zapusteni: (p) => p.typ !== 'komposter' || p.kotveni === 'zapustit',
    lamB: (p) => p.krytina === 'lamely', lamT: (p) => p.krytina === 'lamely', roztecL: (p) => p.krytina === 'lamely', sklon: (p) => p.krytina === 'lamely',
    paskaRameno: (p) => p.pasky, paskaB: (p) => p.pasky, patkaA: (p) => p.kotveni === 'beton', patkaH: (p) => p.kotveni === 'beton',
    odsazeni: (p) => p.typ !== 'pergola' || p.kotveni !== 'zemni_vrut',
  };
  const SPOL = ['material', 'ochrana', 'prorez', 'orez', 'sirkaGeo', 'delkaGeo', 'orientace', 'datum', 'cas'];

  /* ---------- stav ---------- */
  const zakladP = (t) => { const p = Object.assign({}, J.VYCHOZI[t]); for (const k of SPOL) delete p[k]; delete p.cenaVlastni; return p; };
  const zakladSpol = () => { const s = {}; for (const k of SPOL) s[k] = J.VYCHOZI.zahon[k]; return s; };
  let stav = { typ: 'zahon', p: { zahon: zakladP('zahon'), komposter: zakladP('komposter'), pergola: zakladP('pergola') }, spol: zakladSpol(), ceny: {}, tisk: {}, vykres: {} };
  function nacti() {
    try {
      const s = JSON.parse(localStorage.getItem(KLIC) || 'null');
      if (s && s.p) {
        stav.typ = TYPY.includes(s.typ) ? s.typ : 'zahon';
        for (const t of TYPY) stav.p[t] = Object.assign(zakladP(t), s.p[t] || {});
        stav.spol = Object.assign(zakladSpol(), s.spol || {}); stav.ceny = s.ceny || {}; stav.tisk = s.tisk || {}; stav.vykres = s.vykres || {};
      }
    } catch (e) { /* bez úložiště */ }
  }
  function uloz() { try { localStorage.setItem(KLIC, JSON.stringify(stav)); } catch (e) { /* plné / zakázané */ } }
  const parametry = () => Object.assign({}, stav.p[stav.typ], stav.spol, { typ: stav.typ, cenaVlastni: stav.ceny });
  let S = null, vykresyCache = null;

  /* ---------- formulář ---------- */
  function postavTypy() {
    $('typy').innerHTML = '';
    TYPY.forEach((t, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.dataset.typ = t;
      b.innerHTML = `<svg viewBox="0 0 48 34" aria-hidden="true">${IKONY[t]}</svg>${NAZVY[t]}`; b.title = `${NAZVY[t]} – klávesa ${i + 1}`;
      b.addEventListener('click', () => zvolTyp(t)); $('typy').appendChild(b);
    });
    $('material').innerHTML = Object.entries(J.MATERIALY).map(([k, v]) => `<option value="${k}">${esc(v.nazev)}</option>`).join('');
    $('ochrana').innerHTML = Object.entries(J.OCHRANY).map(([k, v]) => `<option value="${k}">${esc(v.nazev)}</option>`).join('');
  }
  function zvolTyp(t) {
    if (!TYPY.includes(t) || t === stav.typ) return;
    stav.typ = t; naplnFormular(); prepocti();
  }
  function postavParametry() {
    const t = stav.typ, el = $('parametry'); el.innerHTML = '';
    let mrizka = document.createElement('div'); mrizka.className = 'r2'; el.appendChild(mrizka);
    const p = parametry();
    for (const d of PAR[t]) {
      const [k, pop, typ] = d;
      if (k === '_') { const h = document.createElement('h3'); h.className = 'sk'; h.textContent = pop; el.appendChild(h); mrizka = document.createElement('div'); mrizka.className = 'r2'; el.appendChild(mrizka); continue; }
      const box = document.createElement('div'); box.dataset.pole = k; const id = 'p_' + k;
      if (typ === 'chk') { box.className = 'cela'; box.innerHTML = `<label class="chk"><input type="checkbox" id="${id}" data-k="${k}"> ${esc(pop)}</label>`; }
      else if (typ === 'sel') { if (d[6] === 'cela') box.className = 'cela'; box.innerHTML = `<label for="${id}">${esc(pop)}</label><select id="${id}" data-k="${k}">${d[3].map((o) => `<option value="${o[0]}">${esc(o[1])}</option>`).join('')}</select>`; }
      else box.innerHTML = `<label for="${id}">${esc(pop)}</label><input id="${id}" data-k="${k}" type="number" min="${d[3]}" max="${d[4]}" step="${d[5]}">`;
      const inp = box.querySelector('[data-k]');
      if (typ === 'chk') inp.checked = !!p[k]; else inp.value = p[k];
      mrizka.appendChild(box);
    }
    el.querySelectorAll('[data-k]').forEach((inp) => inp.addEventListener(inp.type === 'checkbox' || inp.tagName === 'SELECT' ? 'change' : 'input', () => {
      const k = inp.dataset.k, P0 = stav.p[stav.typ];
      if (inp.type === 'checkbox') P0[k] = inp.checked;
      else if (inp.tagName === 'SELECT') P0[k] = typeof J.VYCHOZI[stav.typ][k] === 'number' ? Number(inp.value) : inp.value;
      else { const v = Number(inp.value); if (inp.value === '' || !Number.isFinite(v)) return; P0[k] = v; }
      if (inp.tagName === 'SELECT' || inp.type === 'checkbox') viditelnost();
      naplanovat();
    }));
    viditelnost();
  }
  function viditelnost() {
    const p = parametry();
    document.querySelectorAll('#parametry [data-pole]').forEach((b) => { const f = VIDITELNE[b.dataset.pole]; b.classList.toggle('skryte', !!f && !f(p)); });
  }
  function naplnFormular() {
    document.querySelectorAll('#typy button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.typ === stav.typ ? 'true' : 'false'));
    $('nadpisParam').innerHTML = `📐 ${NAZVY[stav.typ]} – rozměry <small>mm</small>`;
    postavParametry();
    for (const k of ['material', 'ochrana', 'prorez', 'orez', 'sirkaGeo', 'delkaGeo', 'orientace', 'datum', 'cas']) $(k).value = stav.spol[k];
    $('orientaceTxt').textContent = stav.spol.orientace + '°';
    $('predvolba').innerHTML = Object.entries(J.PREDVOLBY).filter(([, v]) => v.p.typ === stav.typ).map(([k, v]) => `<option value="${k}">${esc(v.nazev)}</option>`).join('');
    const t = stav.tisk || {};
    for (const id of ['papir', 'okraj', 'prekryv', 'papirW', 'papirH']) if (t[id] != null) $(id).value = t[id];
    $('cernobile').checked = !!t.cernobile;
    $('blokPapir').classList.toggle('skryte', $('papir').value !== 'vlastni');
    $('zalSpec').textContent = { zahon: 'Náplň a tlak', komposter: 'Komory', pergola: 'Stínění' }[stav.typ];
    $('btnStl').classList.toggle('skryte', stav.typ !== 'pergola');
    casTxt();
  }
  for (const k of ['material', 'ochrana', 'prorez', 'orez', 'sirkaGeo', 'delkaGeo', 'orientace']) $(k).addEventListener(k === 'material' || k === 'ochrana' ? 'change' : 'input', () => {
    const v = $(k).value;
    if (k === 'material' || k === 'ochrana') stav.spol[k] = v; else { const n = Number(v); if (!Number.isFinite(n) || v === '') return; stav.spol[k] = n; }
    if (k === 'orientace') { $('orientaceTxt').textContent = v + '°'; if (scena) scena.nastavSever(+v); }
    naplanovat();
  });
  const casTxt = () => { const h = +stav.spol.cas; $('casTxt').textContent = `${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`; };
  $('cas').addEventListener('input', () => { stav.spol.cas = +$('cas').value; casTxt(); uloz(); aktualizujSlunce(); });
  $('datum').addEventListener('change', () => { if (!/^\d{4}-\d{2}-\d{2}$/.test($('datum').value)) return; stav.spol.datum = $('datum').value; uloz(); aktualizujSlunce(); if (stav.typ === 'pergola') kresliSpecialni(); });
  $('btnLeto').addEventListener('click', () => { const r = (/^(\d{4})/.exec(stav.spol.datum) || [0, 2026])[1]; stav.spol.datum = `${r}-06-21`; $('datum').value = stav.spol.datum; uloz(); aktualizujSlunce(); if (stav.typ === 'pergola') kresliSpecialni(); });
  for (const id of ['papir', 'okraj', 'prekryv', 'papirW', 'papirH', 'cernobile']) $(id).addEventListener('change', () => {
    stav.tisk = { papir: $('papir').value, okraj: +$('okraj').value, prekryv: +$('prekryv').value, papirW: +$('papirW').value, papirH: +$('papirH').value, cernobile: $('cernobile').checked };
    $('blokPapir').classList.toggle('skryte', $('papir').value !== 'vlastni');
    uloz(); vykresyCache = null; kresliVykresy(); infoTisk();
  });

  /* ---------- přepočet ---------- */
  let casovac = null;
  function naplanovat() { clearTimeout(casovac); casovac = setTimeout(prepocti, 150); }
  function prepocti() {
    try { S = J.sestav(parametry()); } catch (e) { console.error(e); toast('Chyba výpočtu: ' + e.message, true); return; }
    uloz(); vykresyCache = null;
    kresliKontrolu(); kresliVykresy(); kresliKusovnik(); kresliRezy(); kresliCenu(); kresliSpecialni(); kresliPrincip(); infoTisk();
    if (scena) { scena.nastav(S); nastavKrokMax(); }
    aktualizujSlunce();
  }
  const vyuzitiHtml = (v) => `<span class="vyuziti ${v > 1 ? 'ne' : v > 0.85 ? 'var' : 'ok'}">${fmt(v * 100)} %</span><div class="bar"><i style="width:${Math.min(100, v * 100)}%;background:var(${v > 1 ? '--danger' : v > 0.85 ? '--warn' : '--ok'})"></i></div>`;
  function kresliKontrolu() {
    const tiles = [['Cena celkem', fmt(S.cena.celkem) + ' Kč'], ['Řezivo', fmt(S.objemDreva, 3) + ' m³'], ['Hmotnost dřeva', fmt(S.hmotnostDreva) + ' kg']];
    if (S.napln) tiles.push(['Náplň', fmt(S.napln.objem, 2) + ' m³']);
    if (S.komory) tiles.push(['Objem komor', fmt(S.komory.celkem, 2) + ' m³']);
    if (S.typ === 'pergola') { const r = J.prostupSlunce(S.p, J.utcZMistniho(stav.spol.datum, stav.spol.cas, 'praha')); tiles.push(['Zastínění teď', r.nadObzorem ? fmt(r.zastineni * 100) + ' %' : 'noc']); }
    $('souhrn').innerHTML = tiles.map(([a, b]) => `<div>${a}<b>${b}</b></div>`).join('');
    const poradi = ['chyba', 'varovani', 'info', 'ok'];
    const v = S.varovani.slice().sort((a, b) => poradi.indexOf(a.uroven) - poradi.indexOf(b.uroven));
    if (!v.some((x) => x.uroven === 'chyba' || x.uroven === 'varovani')) v.unshift({ uroven: 'ok', text: 'Konstrukce ve zjednodušeném výpočtu vyhovuje.' });
    $('varovani').innerHTML = v.map((q) => `<li class="${q.uroven}">${({ chyba: '⛔ ', varovani: '⚠️ ', info: 'ℹ️ ', ok: '✅ ' })[q.uroven] || ''}${esc(q.text)}</li>`).join('');
    $('tabStatika').innerHTML = '<tr><th>Prvek</th><th>Zatížení / rozpětí</th><th class="c">Využití</th><th>Podrobně</th></tr>' +
      S.statika.map((s) => `<tr><td>${esc(s.prvek)}</td><td>${esc(s.popis)}</td><td class="c">${vyuzitiHtml(s.vyuziti)}</td><td>${esc(s.detail)}</td></tr>`).join('');
    $('udaje').innerHTML = Object.entries(S.info).map(([k, x]) => `<div><span>${esc(k)}</span><span>${esc(x)}</span></div>`).join('');
  }

  /* ---------- výkresy ---------- */
  function papir() {
    const v = $('papir').value;
    return v === 'a3' ? [297, 420] : v === 'letter' ? [215.9, 279.4] : v === 'vlastni' ? [Math.max(100, +$('papirW').value || 210), Math.max(100, +$('papirH').value || 297)] : [210, 297];
  }
  function plochaVykresu() { const [a, b] = papir(), ok = +$('okraj').value || 10; return [Math.max(a, b) - 2 * ok - 4, Math.min(a, b) - 2 * ok - 26]; }
  function vsechnyVykresy() {
    if (vykresyCache) return vykresyCache;
    const L = V.vykresy(S, { papir: plochaVykresu() });
    const sab = [V.sablonaSloupku(S), V.sablonaKrokve(S)].filter(Boolean);
    vykresyCache = { vykresy: L, sablony: sab };
    return vykresyCache;
  }
  function kresliVykresy() {
    if (!S) return;
    const { vykresy, sablony } = vsechnyVykresy(), box = $('vykresVolba'); box.innerHTML = '';
    const polozky = vykresy.map((v) => ({ id: v.id, nazev: v.nazev.split(' – ')[0].split(' (')[0], sc: v })).concat(sablony.map((s, i) => ({ id: 'sab' + i, nazev: '1:1 ' + s.nazev, sc: s, sab: true })));
    let akt = stav.vykres[stav.typ]; if (!polozky.some((q) => q.id === akt)) akt = polozky[0].id;
    for (const q of polozky) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = q.nazev; b.setAttribute('aria-pressed', q.id === akt ? 'true' : 'false');
      b.addEventListener('click', () => { stav.vykres[stav.typ] = q.id; uloz(); kresliVykresy(); }); box.appendChild(b);
    }
    const q = polozky.find((x) => x.id === akt);
    try {
      $('vykres').innerHTML = O.svg(q.sc, { sirkaPx: true, meritko: q.sab, cernobile: $('cernobile').checked });
      if (q.sab) { const s = $('vykres').querySelector('svg'); if (s) { s.style.width = Math.round((q.sc.w + 6) * 3.78) + 'px'; s.style.maxWidth = '100%'; } }
      $('vykresInfo').textContent = q.sab ? `šablona 1:1, ${fmt(q.sc.w)} × ${fmt(q.sc.h)} mm` : `měřítko 1:${q.sc.meritko} pro ${$('papir').value.toUpperCase()}`;
    } catch (e) { console.error(e); $('vykres').textContent = 'Výkres nelze vykreslit: ' + e.message; }
  }

  /* ---------- kusovník, řezy, cena ---------- */
  function kresliKusovnik() {
    $('tabKusovnik').innerHTML = '<tr><th>Díl</th><th class="c">Ks</th><th>Průřez</th><th class="c">Délka</th><th class="c">Celkem m</th><th class="c">Objem</th><th>Poznámka</th></tr>' +
      S.kusovnik.map((e) => `<tr><td>${esc(e.nazev)}</td><td class="c">${e.ks}</td><td>${e.profil.join(' × ')}</td><td class="c">${fmt(e.delka)}</td><td class="c">${fmt(e.celkemDelka / 1000, 2)}</td><td class="c">${fmt(e.objem * 1000, 1)} dm³</td><td>${esc(e.pozn)}</td></tr>`).join('') +
      `<tr><td><b>Celkem</b></td><td class="c"><b>${S.kusovnik.reduce((a, e) => a + e.ks, 0)}</b></td><td></td><td></td><td class="c"><b>${fmt(S.kontrola.delkaKusovnik / 1000, 2)}</b></td><td class="c"><b>${fmt(S.objemDreva * 1000, 1)} dm³</b></td><td>${fmt(S.hmotnostDreva)} kg</td></tr>`;
    $('tabNakup').innerHTML = '<tr><th>Profil</th><th>Obchodní délky</th><th class="c">Koupeno</th><th class="c">Čistě</th><th class="c">Využití</th><th class="c">Objem</th><th class="c">Cena</th></tr>' +
      S.rezy.map((r) => `<tr><td>${r.profil.join(' × ')}</td><td>${Object.entries(r.souhrn).sort((a, b) => b[0] - a[0]).map(([d, n]) => `${n}× ${fmt(d / 1000, d % 1000 ? 1 : 0)} m`).join(', ')}</td><td class="c">${fmt(r.plan.koupeno / 1000, 1)} m</td><td class="c">${fmt(r.plan.cista / 1000, 2)} m</td><td class="c">${fmt(r.plan.cista / Math.max(1, r.plan.koupeno) * 100)} %</td><td class="c">${fmt(r.objem, 3)} m³</td><td class="c">${fmt(r.cena)} Kč</td></tr>`).join('');
    $('tabMaterial').innerHTML = '<tr><th>Položka</th><th class="c">Množství</th><th>Poznámka</th><th class="c">Cena</th></tr>' +
      S.materialy.map((m) => `<tr><td>${esc(m.nazev)}</td><td class="c">${fmt(m.mnozstvi, m.jedn === 'ks' || m.jedn === 'pytel' ? 0 : 2)} ${m.jedn}</td><td>${esc(m.pozn)}</td><td class="c">${fmt(m.cena)} Kč</td></tr>`).join('');
    $('kusInfo').textContent = `Délky jsou hotové (čisté) rozměry dílů. Nákup počítá prořez ${fmt(S.p.prorez, 1)} mm na řez a zaříznutí konce tyče ${fmt(S.p.orez)} mm; obchodní délky 3, 4, 5 a 6 m. Vruty u dřeva ve styku se zemí volte nerezové nebo žárově zinkované; u dubu a akátu jen nerez A2/A4 (třísloviny).`;
  }
  function kresliRezy() {
    $('planRezu').innerHTML = O.svg(V.planRezu(S), { sirkaPx: true });
    const k = S.rezy.reduce((a, r) => a + r.plan.koupeno, 0), c = S.rezy.reduce((a, r) => a + r.plan.cista, 0);
    $('rezyInfo').innerHTML = `Optimalizace 1D (první vhodná / nejlepší vhodná podle klesající délky, pak zkrácení tyčí na nejmenší vyhovující obchodní délku; vybere se varianta s nejmenší koupenou délkou). Celkem koupeno <b>${fmt(k / 1000, 1)} m</b>, z toho díly ${fmt(c / 1000, 1)} m, odpad ${fmt((k - c) / 1000, 1)} m (${fmt((k - c) / Math.max(1, k) * 100)} %). Šrafovaně = zbytek.`;
  }
  function kresliCenu() {
    const klicDrevo = 'drevo_' + S.p.material;
    $('cenaSouhrn').innerHTML = `<div>Řezivo<b>${fmt(S.cena.drevo)} Kč</b></div><div>Materiál<b>${fmt(S.cena.material)} Kč</b></div><div>Celkem<b>${fmt(S.cena.celkem)} Kč</b></div>`;
    let h = '<tr><th>Položka</th><th class="c">Množství</th><th class="c">Jedn. cena (Kč)</th><th class="c">Cena</th></tr>';
    h += `<tr><td>Řezivo – ${esc(J.MATERIALY[S.p.material].nazev)}${S.p.ochrana === 'kdi' ? ' + příplatek KDI 30 %' : ''}</td><td class="c">${fmt(S.rezy.reduce((a, r) => a + r.objem, 0), 3)} m³</td><td class="c"><input type="number" min="0" step="100" data-cena="${klicDrevo}" value="${stav.ceny[klicDrevo] > 0 ? stav.ceny[klicDrevo] : J.MATERIALY[S.p.material].cena}" aria-label="cena za m³"> /m³</td><td class="c">${fmt(S.cena.drevo)} Kč</td></tr>`;
    for (const m of S.materialy) h += `<tr><td>${esc(m.nazev)}<br><small style="color:var(--text-faint)">${esc(m.pozn)}</small></td><td class="c">${fmt(m.mnozstvi, m.jedn === 'ks' || m.jedn === 'pytel' ? 0 : 2)} ${m.jedn}</td><td class="c"><input type="number" min="0" step="0.1" data-cena="${m.klic}" value="${m.cenaJ}" aria-label="jednotková cena"></td><td class="c">${fmt(m.cena)} Kč</td></tr>`;
    $('tabCena').innerHTML = h;
    $('tabCena').querySelectorAll('[data-cena]').forEach((i) => i.addEventListener('change', () => { const v = Number(i.value); if (!Number.isFinite(v) || v < 0) return; stav.ceny[i.dataset.cena] = v; prepocti(); }));
  }
  $('btnCenyReset').addEventListener('click', async () => { if (await Dialog.potvrd('Vrátit všechny ceny na typické hodnoty?')) { stav.ceny = {}; prepocti(); } });

  /* ---------- záložka podle typu ---------- */
  function kresliSpecialni() {
    const el = $('panelSpec');
    if (S.typ === 'zahon') {
      const N = S.napln, zt = S.zemniTlak, p = S.p;
      let h = `<div class="souhrn"><div>Plocha vnitřku<b>${fmt(N.plocha / 1e6, 2)} m²</b></div><div>Výška náplně<b>${fmt(N.vyska)} mm</b></div><div>Objem<b>${fmt(N.objem, 2)} m³</b></div><div>Hmotnost<b>${fmt(N.hmotnost / 1000, 1)} t</b></div><div>Dosypat po 1. roce<b>${fmt(N.dosypat, 2)} m³</b></div></div>`;
      h += `<label class="chk"><input type="checkbox" id="vrstvyAuto" ${p.vrstvyAuto ? 'checked' : ''}> Vrstvy automaticky podle výšky (osevní vrstva ≥ 20 cm)</label>`;
      h += '<div class="tab-obal"><table><tr><th>Vrstva (odspodu)</th><th class="c">Tloušťka mm</th><th class="c">Objem</th><th class="c">Litry</th><th class="c">≈ hmotnost</th><th class="c">sesednutí</th><th></th></tr>';
      N.vrstvy.forEach((v, i) => {
        const posl = i === N.vrstvy.length - 1;
        h += `<tr><td>${p.vrstvyAuto ? esc(v.nazev) : `<select data-vrstva="${i}">${Object.entries(J.VRSTVY).map(([k, x]) => `<option value="${k}"${k === v.id ? ' selected' : ''}>${esc(x.nazev)}</option>`).join('')}</select>`}</td>` +
          `<td class="c">${p.vrstvyAuto || posl ? fmt(v.tl) + (posl && !p.vrstvyAuto ? ' (zbytek)' : '') : `<input type="number" min="0" max="1500" step="5" data-tl="${i}" value="${v.tl}">`}</td>` +
          `<td class="c">${fmt(v.objem, 3)} m³</td><td class="c">${fmt(v.litry)} l</td><td class="c">${fmt(v.hmotnost)} kg</td><td class="c">${fmt(v.sesednuti)} mm</td><td>${!p.vrstvyAuto && N.vrstvy.length > 1 ? `<button class="btn btn-sec" data-smaz="${i}" type="button" aria-label="Odebrat">✕</button>` : ''}</td></tr>`;
      });
      h += '</table></div>' + (p.vrstvyAuto ? '' : '<div class="tlacitka"><button class="btn btn-sec" id="btnVrstvaPridat" type="button">+ Přidat vrstvu</button></div>');
      h += `<h3 style="font-size:.9rem;margin:14px 0 4px">Tlak zeminy na řady prken</h3><p class="info">K0 = 1 − sin ${fmt(zt.phi)}° = ${fmt(zt.K0, 3)}, γ = ${fmt(zt.gama)} kN/m³, přitížení ${fmt(p.pritizeni, 1)} kN/m². Tlak u dna ${fmt(zt.pDole, 2)} kPa, výslednice ${fmt(zt.E, 2)} kN/m ve výšce ${fmt(zt.rameno * 1000)} mm nade dnem.</p>`;
      h += '<div class="tab-obal"><table><tr><th>Řada</th><th class="c">Výška nad zemí</th><th class="c">Zatížení q</th><th class="c">Max. rozpětí</th></tr>' +
        zt.rady.slice().reverse().map((r) => `<tr><td>${r.r + 1}</td><td class="c">${fmt(r.z0)}–${fmt(r.z1)} mm</td><td class="c">${fmt(r.q, 3)} kN/m</td><td class="c">${Number.isFinite(r.Lmax) ? fmt(r.Lmax) + ' mm' : '—'}</td></tr>`).join('') + '</table></div>';
      h += '<div class="tab-obal" style="margin-top:8px"><table><tr><th>Stěna</th><th class="c">Délka</th><th class="c">Polí</th><th class="c">Rozpětí prken</th></tr>' + S.hrany.map((x) => `<tr><td>${x.k + 1}</td><td class="c">${fmt(x.delka)} mm</td><td class="c">${x.pole}</td><td class="c">${fmt(x.rozpeti)} mm</td></tr>`).join('') + '</table></div>';
      el.innerHTML = h;
      $('vrstvyAuto').addEventListener('change', () => { const P0 = stav.p.zahon; P0.vrstvyAuto = $('vrstvyAuto').checked; if (!P0.vrstvyAuto) P0.vrstvy = N.vrstvy.map((v) => ({ id: v.id, tl: v.tl })); prepocti(); });
      el.querySelectorAll('[data-vrstva]').forEach((s) => s.addEventListener('change', () => { stav.p.zahon.vrstvy[+s.dataset.vrstva].id = s.value; prepocti(); }));
      el.querySelectorAll('[data-tl]').forEach((s) => s.addEventListener('change', () => { const v = Number(s.value); if (Number.isFinite(v)) { stav.p.zahon.vrstvy[+s.dataset.tl].tl = v; prepocti(); } }));
      el.querySelectorAll('[data-smaz]').forEach((s) => s.addEventListener('click', () => { stav.p.zahon.vrstvy.splice(+s.dataset.smaz, 1); prepocti(); }));
      const bp = $('btnVrstvaPridat'); if (bp) bp.addEventListener('click', () => { stav.p.zahon.vrstvy.splice(Math.max(0, stav.p.zahon.vrstvy.length - 1), 0, { id: 'listi', tl: 100 }); prepocti(); });
    } else if (S.typ === 'komposter') {
      const K = S.komory, p = S.p;
      el.innerHTML = `<div class="souhrn"><div>Komor<b>${K.pocet}</b></div><div>Objem komory<b>${fmt(K.objem, 2)} m³</b></div><div>Celkem<b>${fmt(K.celkem, 2)} m³</b></div><div>Větrací mezery<b>${fmt(K.podilMezer * 100, 1)} %</b></div></div>` +
        `<div class="navod"><h3>Provoz</h3><ol><li>1. komora: plnit zeleným (dusíkatým) a hnědým (uhlíkatým) materiálem zhruba 1 : 2, vlhkost jako vyždímaná houba.</li><li>Po naplnění (nebo po 2–3 měsících) přeházet do 2. komory – provzdušní se a znovu zahřeje.</li><li>Ve 3. komoře dozrává 6–12 měsíců; zralý kompost prosít.</li></ol>` +
        `<h3>Čela</h3><p>Do každé komory ${S.dily.filter((d) => d.skup === 'celo' && d.komora === 0).length} prken ${p.lamelaT} × ${p.lamelaB} mm, délka ${fmt(p.sirkaKomory - 2 * p.vule)} mm; drážka ${fmt(p.lamelaT + p.vule)} mm. Čela se vkládají shora – při plnění přidávejte, při vybírání vyjměte horní prkna.</p></div>`;
    } else kresliStineni(el);
  }
  function grafDne(dp, cas) {
    const W = 640, H = 230, x0 = 40, x1 = W - 40, y0 = 20, y1 = H - 30, hx = (h) => x0 + (h - 4) / 18 * (x1 - x0), py = (v) => y1 - v * (y1 - y0), ay = (a) => y1 - a / 70 * (y1 - y0);
    let s = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif" font-size="11" role="img" aria-label="Zastínění během dne">`;
    for (let v = 0; v <= 1.001; v += 0.25) s += `<line x1="${x0}" y1="${py(v)}" x2="${x1}" y2="${py(v)}" stroke="currentColor" opacity="0.15"/><text x="${x0 - 4}" y="${py(v) + 4}" text-anchor="end" fill="currentColor">${v * 100} %</text>`;
    for (let h = 4; h <= 22; h += 2) s += `<text x="${hx(h)}" y="${y1 + 16}" text-anchor="middle" fill="currentColor">${h}</text>`;
    for (let a = 0; a <= 70; a += 35) s += `<text x="${x1 + 4}" y="${ay(a) + 4}" fill="#d9480f">${a}°</text>`;
    const cara = (k, f) => dp.body.map((b, i) => `${i ? 'L' : 'M'}${hx(b.hod).toFixed(1)} ${f(b[k]).toFixed(1)}`).join('');
    if (dp.body.length) {
      s += `<path d="${cara('vyska', ay)}" fill="none" stroke="#d9480f" stroke-width="1.6" stroke-dasharray="5 3"/>`;
      s += `<path d="${cara('zastineni', py)}" fill="none" stroke="var(--accent)" stroke-width="2.2"/>`;
      s += `<path d="${cara('lamely', py)}" fill="none" stroke="var(--ok)" stroke-width="1.2" opacity="0.8"/>`;
    }
    s += `<line x1="${hx(cas)}" y1="${y0}" x2="${hx(cas)}" y2="${y1}" stroke="currentColor" stroke-width="1" opacity="0.6"/>`;
    s += `<text x="${x0}" y="12" fill="var(--accent)">zastínění celkem</text><text x="${x0 + 120}" y="12" fill="var(--ok)">jen lamely</text><text x="${x0 + 200}" y="12" fill="#d9480f">výška Slunce (pravá osa)</text>`;
    return s + '</svg>';
  }
  function kresliStineni(el) {
    const p = S.p;
    if (p.krytina !== 'lamely') { el.innerHTML = '<p class="info">Pergola je bez lamel – stíní jen krokve (a popínavé rostliny). Pro výpočet stínění zvolte zastřešení „lamely“.</p>'; return; }
    const dp = J.denniPrubeh(p, stav.spol.datum), tab = J.tabulkaSklonu(p), nav = J.navrhRozteceLamel(p);
    let h = `<div class="souhrn"><div>Vážený průměr dne<b>${fmt(dp.prumer * 100)} %</b></div><div>V pravé poledne<b>${dp.poledne ? fmt(dp.poledne.zastineni * 100) + ' %' : '–'}</b></div><div>Slunce v poledne<b>${dp.poledne ? fmt(dp.poledne.vyska, 1) + '°' : '–'}</b></div></div>`;
    h += `<div class="graf">${grafDne(dp, stav.spol.cas)}</div>`;
    h += `<p class="info">Den ${esc(stav.spol.datum)}, ${fmt(p.sirkaGeo, 2)}° s. š., orientace osy lamel ${p.orientace}° od severu. Průměr je vážený výškou Slunce (≈ ozáření vodorovné plochy). Krokve s roztečí ${fmt(p._roztecKef)} mm se započítávají.</p>`;
    if (nav) h += `<div class="tlacitka"><button class="btn btn-sec" id="btnNavrhL" type="button">Navrhnout rozteč pro plný stín 21. 6. v poledne → ${fmt(nav.roztec)} mm</button></div>`;
    h += `<h3 style="font-size:.9rem;margin:14px 0 4px">Vliv sklonu lamel (rozteč ${fmt(p.roztecL)} mm)</h3><div class="tab-obal"><table><tr><th class="c">Sklon</th><th class="c">21. 6. poledne</th><th class="c">21. 6. průměr</th><th class="c">20. 3. průměr</th><th class="c">21. 12. průměr</th><th></th></tr>` +
      tab.map((r) => `<tr${r.sklon === tab.doporuceny ? ' style="font-weight:600"' : ''}><td class="c">${r.sklon}°</td><td class="c">${fmt(r.letoPoledne * 100)} %</td><td class="c">${fmt(r.letoPrumer * 100)} %</td><td class="c">${fmt(r.rovnodennost * 100)} %</td><td class="c">${fmt(r.zimaPrumer * 100)} %</td><td><button class="btn btn-sec" type="button" data-sklon="${r.sklon}">použít</button>${r.sklon === tab.doporuceny ? ' ← nejvíc stínu v létě a nejméně v zimě' : ''}</td></tr>`).join('') + '</table></div>';
    el.innerHTML = h;
    const bn = $('btnNavrhL'); if (bn) bn.addEventListener('click', () => { stav.p.pergola.roztecL = Math.max(30, Math.floor(nav.roztec)); naplnFormular(); prepocti(); toast(`Rozteč lamel ${stav.p.pergola.roztecL} mm.`); });
    el.querySelectorAll('[data-sklon]').forEach((b) => b.addEventListener('click', () => { stav.p.pergola.sklon = +b.dataset.sklon; naplnFormular(); prepocti(); }));
  }
  function kresliPrincip() {
    const T = P.TEXTY[S.typ];
    $('princip').innerHTML = T.map((o) => `<h3>${o.nadpis}</h3>${o.schema ? `<figure class="schema">${P.SCHEMA[o.schema]()}</figure>` : ''}<p>${o.text}</p>`).join('') +
      '<p class="info">Výpočty jsou zjednodušené (prosté nosníky, typické pevnosti, bez větru a mimořádných zatížení). Nejde o statický posudek; u větších staveb, u zdi domu nebo na hranici pozemku se poraďte se statikem a ověřte, zda stavba nepotřebuje ohlášení.</p>';
    $('ochranaPanel').innerHTML = P.OCHRANA.map((o) => `<h3>${o.nadpis}</h3><p>${o.text}</p>`).join('') +
      `<h3>Tato stavba</h3><p>${esc(J.MATERIALY[S.p.material].nazev)} – třída trvanlivosti ${J.MATERIALY[S.p.material].trv} (EN 350). Ochrana: ${esc(J.OCHRANY[S.p.ochrana].nazev)}. Plocha dřeva ${fmt(S.povrchDreva, 1)} m².</p>`;
    $('postup').innerHTML = `<h3>Nářadí</h3><p>${P.NARADI[S.typ]}</p><h3>${esc(S.nazev)} – krok za krokem</h3><ol>${S.kroky.map((k) => `<li><b>${esc(k.nazev)}.</b> ${esc(k.popis)}</li>`).join('')}</ol>` +
      `<h3>Bezpečnost</h3><ul>${P.BEZPECNOST.map((x) => `<li>${x}</li>`).join('')}</ul>`;
  }
  function infoTisk() {
    if (!S) return;
    const { vykresy, sablony } = vsechnyVykresy(), [pw, ph] = papir(), ok = +$('okraj').value || 10;
    const n = sablony.map((s) => O.rozvrhListu(s, pw, ph, ok, +$('prekryv').value || 12).listy.length);
    $('infoTisk').innerHTML = `PDF: úvodní list (souhrn, statika, čtverec 50 mm), ${vykresy.length} výkresů (${vykresy.map((v) => '1:' + v.meritko).join(', ')}), ${sablony.length ? `šablony 1:1 (${n.join(' + ')} listů), ` : ''}plán řezů, kusovník s cenou a postup.`;
  }

  /* ---------- soubory ---------- */
  function stahni(blob, jmeno) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = jmeno;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  const zaklad = () => ({ zahon: 'zahon', komposter: 'komposter', pergola: 'pergola' }[S.typ]) + '_' + (S.typ === 'komposter' ? S.p.komor + 'x' + S.p.sirkaKomory : fmt(S.p.delka, 0).replace(/\s/g, '') + 'x' + (S.typ === 'pergola' ? S.p.hloubka : S.p.sirka));
  $('btnSvg').addEventListener('click', () => stahni(new Blob([O.svg(O.poskladej(vsechnyVykresy().vykresy, 10), { cernobile: $('cernobile').checked })], { type: 'image/svg+xml' }), zaklad() + '_vykresy.svg'));
  $('btnDxf').addEventListener('click', () => stahni(new Blob([O.dxf(vsechnyVykresy().vykresy)], { type: 'application/dxf' }), zaklad() + '_vykresy.dxf'));
  $('btnSvgSab').addEventListener('click', () => { const s = vsechnyVykresy().sablony; if (!s.length) { toast('Pro tuto stavbu nejsou šablony 1:1.'); return; } stahni(new Blob([O.svg(O.poskladej(s, 12), { meritko: true })], { type: 'image/svg+xml' }), zaklad() + '_sablony_1-1.svg'); });
  $('btnCsv').addEventListener('click', () => {
    const r = [['dil', 'ks', 'prurez_mm', 'delka_mm', 'celkem_m', 'objem_m3', 'poznamka']].concat(S.kusovnik.map((e) => [e.nazev, e.ks, e.profil.join('x'), e.delka, (e.celkemDelka / 1000).toFixed(3), e.objem.toFixed(4), e.pozn]));
    r.push([]); r.push(['nakup_profil', 'obchodni_delky', 'koupeno_m', 'cena_kc']); for (const x of S.rezy) r.push([x.profil.join('x'), Object.entries(x.souhrn).map(([d, n]) => `${n}x${d / 1000}m`).join(' '), (x.plan.koupeno / 1000).toFixed(1), Math.round(x.cena)]);
    r.push([]); r.push(['material', 'mnozstvi', 'jednotka', 'cena_kc', 'poznamka']); for (const m of S.materialy) r.push([m.nazev, m.mnozstvi, m.jedn, Math.round(m.cena), m.pozn]);
    const csv = '﻿' + r.map((x) => x.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    stahni(new Blob([csv], { type: 'text/csv' }), zaklad() + '_kusovnik.csv');
  });
  $('btnStl').addEventListener('click', () => {
    const r = V.profilRozpery(S);
    if (!r) { toast('Rozpěrka má smysl jen pro lamely se sklonem 20–90° a mezerou mezi nimi ≥ 6 mm.', true); return; }
    const m = O.stlHranol(r.poly, r.tloustka, 'rozpera lamel ' + S.p.sklon);
    stahni(new Blob([m.buf], { type: 'model/stl' }), zaklad() + `_rozpera_${Math.abs(S.p.sklon)}st.stl`);
    toast(`STL rozpěrky: ${fmt(r.sirka, 1)} mm na krokvi, výška ${fmt(r.vyska)} mm, tloušťka ${r.tloustka} mm, objem ${fmt(m.objem / 1000, 1)} cm³. Tiskněte naplocho z PETG (venku), 4 perimetry, výplň 40 %. Lamelu přiložte k šikmé ploše a přišroubujte; pro opačný sklon rozpěrku otočte.`);
  });
  function nactiPismo() {
    if (window.FONTY_JS && window.FONTY_JS['LiberationSans-Regular.ttf']) return Promise.resolve(window.FONTY_JS['LiberationSans-Regular.ttf']);
    return new Promise((ok) => {
      const s = document.createElement('script'); s.src = 'stitky_panely/fonty/LiberationSans-Regular.ttf.js';
      s.onload = () => ok((window.FONTY_JS || {})['LiberationSans-Regular.ttf'] || null); s.onerror = () => ok(null);
      document.head.appendChild(s);
    });
  }
  function strankyPdf() {
    const { vykresy, sablony } = vsechnyVykresy();
    const uvod = [`# ${S.nazev}`, ...Object.entries(S.info).map(([a, b]) => `${a}: ${b}`), `Dřevo: ${J.MATERIALY[S.p.material].nazev}, ochrana: ${J.OCHRANY[S.p.ochrana].nazev}.`, `Řezivo ${fmt(S.objemDreva, 3)} m³ (${fmt(S.hmotnostDreva)} kg), odhad ceny ${fmt(S.cena.celkem)} Kč (řezivo ${fmt(S.cena.drevo)} Kč, materiál ${fmt(S.cena.material)} Kč).`];
    uvod.push('# Upozornění'); for (const v of S.varovani) uvod.push((v.uroven === 'chyba' ? '!! ' : v.uroven === 'varovani' ? '! ' : '') + v.text);
    const st = [{ nadpis: 'Zahradní stavby ze dřeva', text: uvod, ctverec: true, tabulka: { hlavicka: ['Prvek', 'Zatížení / rozpětí', 'Využití', 'Podrobně'], sloupce: ['l', 'l', 'r', 'l'], sirky: [42, 62, 16, 70], radky: S.statika.map((s) => [s.prvek, s.popis, fmt(s.vyuziti * 100) + ' %', s.detail]) } }];
    for (const v of vykresy) st.push({ vykres: v, nadpis: v.nazev });
    for (const s of sablony) st.push({ scena: s, nadpis: s.nazev + ' – 1:1', deleni: true });
    st.push({ nadpis: 'Plán řezů z obchodních délek', scena: V.planRezu(S, { sirka: 150 }), zmensit: true });
    st.push({ nadpis: 'Kusovník řeziva', tabulka: { hlavicka: ['Díl', 'Ks', 'Průřez', 'Délka', 'Celkem m', 'Poznámka'], sloupce: ['l', 'r', 'l', 'r', 'r', 'l'], sirky: [58, 10, 24, 18, 20, 60], radky: S.kusovnik.map((e) => [e.nazev, e.ks, e.profil.join(' × '), fmt(e.delka), fmt(e.celkemDelka / 1000, 2), e.pozn]) },
      text: ['# Nákup řeziva', ...S.rezy.map((r) => `${r.profil.join(' × ')} mm: ${Object.entries(r.souhrn).sort((a, b) => b[0] - a[0]).map(([d, n]) => `${n}× ${fmt(d / 1000)} m`).join(', ')} – ${fmt(r.objem, 3)} m³, ${fmt(r.cena)} Kč`), '# Spojovací a ostatní materiál', ...S.materialy.map((m) => `${m.nazev}: ${fmt(m.mnozstvi, m.jedn === 'ks' || m.jedn === 'pytel' ? 0 : 2)} ${m.jedn}${m.pozn ? ' (' + m.pozn + ')' : ''} – ${fmt(m.cena)} Kč`), `Celkem orientačně ${fmt(S.cena.celkem)} Kč. Ceny jsou typické hodnoty, ověřte u dodavatele.`] });
    const strip = (h) => String(h).replace(/<[^>]+>/g, '');
    st.push({ nadpis: 'Postup a ochrana dřeva', text: ['# Nářadí', P.NARADI[S.typ], `# ${S.nazev} – krok za krokem`, ...S.kroky.map((k, i) => `${i + 1}. ${k.nazev}: ${k.popis}`), '# Bezpečnost', ...P.BEZPECNOST.map((x) => '• ' + x), ...P.OCHRANA.flatMap((o) => ['# ' + o.nadpis, strip(o.text)]), '# Jak to funguje', ...P.TEXTY[S.typ].flatMap((o) => ['# ' + o.nadpis, strip(o.text)])] });
    return st;
  }
  $('btnPdf').addEventListener('click', async () => {
    const b = $('btnPdf'), puv = b.textContent; b.disabled = true; b.textContent = 'Připravuji PDF…';
    try {
      if (!window.jspdf) throw new Error('jsPDF se nenačetl');
      const pismo = await nactiPismo();
      const d = new Date(), datum = `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`;
      const doc = O.pdf(window.jspdf.jsPDF, strankyPdf(), { papir: papir(), okraj: +$('okraj').value || 10, prekryv: +$('prekryv').value || 12, pismo, cernobile: $('cernobile').checked, nazev: S.nazev, stavba: ($('nazevProjektu').value || S.nazev), datum });
      stahni(doc.output('blob'), zaklad() + '.pdf');
      toast(`PDF: ${doc.getNumberOfPages()} stran. Tiskněte ve skutečné velikosti (100 %) a ověřte čtverec 50 mm.`);
    } catch (e) { console.error(e); toast('PDF se nepodařilo vytvořit: ' + e.message, true); }
    finally { b.disabled = false; b.textContent = puv; }
  });

  /* ---------- projekty ---------- */
  const projekty = () => { try { return JSON.parse(localStorage.getItem(KLIC_PROJ) || '[]'); } catch (e) { return []; } };
  const ulozProjekty = (L) => { try { localStorage.setItem(KLIC_PROJ, JSON.stringify(L)); return true; } catch (e) { toast('Projekt se nepodařilo uložit (úložiště je plné nebo zakázané).', true); return false; } };
  function nactiProjekt(q) {
    stav.typ = TYPY.includes(q.typ) ? q.typ : 'zahon';
    stav.p[stav.typ] = Object.assign(zakladP(stav.typ), q.p || {});
    if (q.spol) stav.spol = Object.assign(zakladSpol(), q.spol);
    naplnFormular(); prepocti();
  }
  function kresliProjekty() {
    const L = projekty(), ul = $('projekty'); ul.innerHTML = '';
    if (!L.length) { ul.innerHTML = '<li><span style="color:var(--text-faint)">Zatím žádné uložené projekty.</span></li>'; return; }
    L.forEach((q, i) => {
      const li = document.createElement('li');
      li.innerHTML = `<span title="${esc(q.nazev)}">${esc(q.nazev)} <small style="color:var(--text-faint)">· ${NAZVY[q.typ] || ''}</small></span><button type="button" data-a="n">Načíst</button><button type="button" data-a="s" aria-label="Smazat">✕</button>`;
      li.querySelector('[data-a=n]').addEventListener('click', () => { $('nazevProjektu').value = q.nazev; nactiProjekt(q); toast('Načteno: ' + q.nazev); });
      li.querySelector('[data-a=s]').addEventListener('click', async () => { if (await Dialog.potvrd(`Smazat projekt „${q.nazev}“?`)) { const M = projekty(); M.splice(i, 1); ulozProjekty(M); kresliProjekty(); } });
      ul.appendChild(li);
    });
  }
  $('btnUlozit').addEventListener('click', async () => {
    let n = $('nazevProjektu').value.trim();
    if (!n) { n = await Dialog.zeptej('Název projektu', S.nazev); if (!n) return; $('nazevProjektu').value = n; }
    const L = projekty(), i = L.findIndex((q) => q.nazev === n);
    if (i >= 0 && !(await Dialog.potvrd(`Projekt „${n}“ už existuje. Přepsat?`))) return;
    const z = { nazev: n, typ: stav.typ, p: Object.assign({}, stav.p[stav.typ]), spol: Object.assign({}, stav.spol), cas: new Date().toISOString() };
    if (i >= 0) L[i] = z; else L.unshift(z);
    if (ulozProjekty(L)) { kresliProjekty(); toast('Uloženo: ' + n); }
  });
  $('btnPredvolba').addEventListener('click', () => {
    const q = J.PREDVOLBY[$('predvolba').value]; if (!q) return;
    const t = q.p.typ; stav.typ = t;
    const p = Object.assign(zakladP(t), q.p); delete p.typ; delete p.orientace;
    if (q.p.orientace != null) stav.spol.orientace = q.p.orientace;
    stav.p[t] = p; $('nazevProjektu').value = q.nazev; naplnFormular(); prepocti(); toast('Předvolba: ' + q.nazev);
  });
  $('btnExportJson').addEventListener('click', () => stahni(new Blob([JSON.stringify({ typ: 'zahradni_stavby', verze: 1, nazev: $('nazevProjektu').value || S.nazev, stavba: stav.typ, p: stav.p[stav.typ], spol: stav.spol, ceny: stav.ceny, projekty: projekty() }, null, 2)], { type: 'application/json' }), zaklad() + '.json'));
  $('btnImportJson').addEventListener('click', () => $('souborJson').click());
  $('souborJson').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (!d || d.typ !== 'zahradni_stavby' || !d.p) throw new Error('to není soubor této stránky');
      if (d.ceny && typeof d.ceny === 'object') stav.ceny = d.ceny;
      if (Array.isArray(d.projekty) && d.projekty.length && await Dialog.potvrd(`Soubor obsahuje ${d.projekty.length} projektů. Přidat je k uloženým?`)) {
        const L = projekty(); for (const q of d.projekty) if (q && q.p && !L.some((x) => x.nazev === q.nazev)) L.push(q); ulozProjekty(L); kresliProjekty();
      }
      $('nazevProjektu').value = d.nazev || ''; nactiProjekt({ typ: d.stavba, p: d.p, spol: d.spol }); toast('Načteno ze souboru.');
    } catch (er) { toast('Soubor nejde načíst: ' + er.message, true); }
    e.target.value = '';
  });
  $('btnReset').addEventListener('click', async () => {
    if (!(await Dialog.potvrd(`Vrátit parametry stavby „${NAZVY[stav.typ]}“ na výchozí hodnoty?`))) return;
    stav.p[stav.typ] = zakladP(stav.typ); naplnFormular(); prepocti();
  });

  /* ---------- záložky ---------- */
  $('zalozky').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-z]'); if (!b) return;
    document.querySelectorAll('#zalozky button').forEach((x) => x.setAttribute('aria-selected', x === b ? 'true' : 'false'));
    document.querySelectorAll('.panel').forEach((p) => { p.hidden = p.dataset.p !== b.dataset.z; });
  });

  /* ---------- 3D a Slunce ---------- */
  let scena = null, nacita3d = false;
  function nactiSkript(src) { return new Promise((ok, chyba) => { const el = document.createElement('script'); el.src = src; el.onload = ok; el.onerror = () => chyba(new Error('nejde načíst ' + src)); document.head.appendChild(el); }); }
  function nastavKrokMax() {
    if (!S) return;
    const n = S.kroky.length; $('krok').max = n;
    if (+$('krok').value > n || !scena || !scena.prehrava) { if (!scena || !scena.prehrava) $('krok').value = n; }
    popisKroku(+$('krok').value);
    if (scena && !scena.prehrava) scena.nastavT(+$('krok').value);
  }
  function popisKroku(t) {
    if (!S) return;
    const n = S.kroky.length, i = Math.min(n - 1, Math.floor(t));
    $('krokPopis').innerHTML = t >= n ? `<b>Hotovo</b> – ${n} kroků stavby. Posuňte jezdec nebo spusťte ▶ animaci.` : `<b>Krok ${i + 1}/${n}: ${esc(S.kroky[i].nazev)}.</b> ${esc(S.kroky[i].popis)}`;
  }
  function start3d() {
    if (scena || nacita3d) return; nacita3d = true;
    const hotovo = () => {
      try {
        $('obal3d').innerHTML = '';
        scena = window.ZS3D.vytvor($('obal3d'));
        scena.priZmeneT = (t) => { $('krok').value = t; popisKroku(t); };
        if (S) { scena.nastav(S); nastavKrokMax(); aktualizujSlunce(); }
      } catch (e) { console.error(e); $('obal3d').innerHTML = '<div class="info" style="padding:12px">3D nelze zobrazit (WebGL): ' + esc(e.message) + '</div>'; }
    };
    if (window.THREE) hotovo();
    else nactiSkript('lib/three.0.160.0.min.js').then(hotovo).catch((e) => { nacita3d = false; $('stav3d').textContent = 'three.js se nenačetl: ' + e.message; });
  }
  if ('IntersectionObserver' in window) new IntersectionObserver((z) => { if (z.some((q) => q.isIntersecting)) start3d(); }, { rootMargin: '200px' }).observe($('karta3d'));
  else start3d();
  $('krok').addEventListener('input', () => { const t = +$('krok').value; if (scena) { scena.prehraj(false); scena.nastavT(t); } $('btnAnim').innerHTML = '▶ Postavit <kbd>mezera</kbd>'; popisKroku(t); });
  const animuj = () => { if (!scena) return; const h = scena.prehraj(); $('btnAnim').innerHTML = h ? '⏸ Zastavit <kbd>mezera</kbd>' : '▶ Postavit <kbd>mezera</kbd>'; };
  $('btnAnim').addEventListener('click', animuj);
  document.querySelectorAll('[data-pohled]').forEach((b) => b.addEventListener('click', () => scena && scena.pohled(b.dataset.pohled)));
  function aktualizujSlunce() {
    if (!S) return;
    const utc = J.utcZMistniho(stav.spol.datum, stav.spol.cas, 'praha'), Ps = J.polohaSlunce(utc, stav.spol.sirkaGeo, stav.spol.delkaGeo);
    const v = J.smerSlunceLokalne(Ps.vyska, Ps.azimut, stav.spol.orientace);
    let t = `Slunce: výška ${fmt(Ps.vyska, 1)}°, azimut ${fmt(Ps.azimut, 1)}° (${Ps.zdroj})`;
    if (S.typ === 'pergola') {
      const r = J.prostupSlunce(S.p, utc);
      t += r.nadObzorem ? ` · zastínění ${fmt(r.zastineni * 100)} % (lamely ${fmt((r.lamely.zastineni || 0) * 100)} %, krokve ${fmt(r.krokve.zastineni * 100)} %)` : ' · pod obzorem';
    }
    $('slunceInfo').textContent = t;
    if (scena) scena.nastavSlunce(Ps.vyska > 0 ? v : null);
    if (S.typ === 'pergola') { const g = document.querySelector('#panelSpec .graf'); if (g) g.innerHTML = grafDne(J.denniPrubeh(S.p, stav.spol.datum), stav.spol.cas); }
  }

  /* ---------- klávesy ---------- */
  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input,select,textarea,button') && e.code !== 'Escape' || e.ctrlKey || e.metaKey || e.altKey) return;
    const m = /^(Digit|Numpad)([1-3])$/.exec(e.code);
    if (m) { zvolTyp(TYPY[+m[2] - 1]); e.preventDefault(); return; }
    if (e.code === 'Space') { e.preventDefault(); animuj(); }
  });

  /* ---------- start ---------- */
  nacti();
  postavTypy();
  naplnFormular();
  kresliProjekty();
  prepocti();
  window.ZSUI = { get S() { return S; }, get stav() { return stav; }, zvolTyp, prepocti, strankyPdf, get scena() { return scena; }, aktualizujSlunce };
})();

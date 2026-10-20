/* ============================================================
   Šablony truhlářských spojů – ovládání stránky
   ============================================================ */
(function () {
  'use strict';
  const J = window.TSJ, TS = window.TSS, V = window.TSV, ST = window.TSSTL, P = window.TSP;
  const $ = (id) => document.getElementById(id);
  const fmt = J.fmt;
  const KLIC = 'webapp_truhlarske_spoje', KLIC_PROJ = 'webapp_truhlarske_spoje_projekty';
  const toast = (t, chyba) => { try { chyba ? Dialog.chyba(t) : Dialog.info(t); } catch (e) { console.log(t); } };

  /* ---------- výchozí rozměry podle spoje (každý spoj si pamatuje své) ---------- */
  const ROZ = {
    rybina: { tA: 18, tB: 18, sirka: 150, delkaA: 220, delkaB: 200, pocet: 4, cepUzky: 8, pulcep: 7 },
    polokryta: { tA: 12, tB: 20, sirka: 120, delkaA: 300, delkaB: 160, pocet: 3, cepUzky: 6, pulcep: 7, kryti: 6 },
    cinky: { tA: 12, tB: 12, sirka: 100, delkaA: 200, delkaB: 160, prstu: 9 },
    cep: { tA: 30, tB: 30, sirka: 80, sirkaB: 70, delkaA: 250, delkaB: 260, osazeni: 12, dlato: 10 },
    preplatovani: { tA: 20, tB: 20, sirka: 60, sirkaB: 60, delkaA: 220, delkaB: 220 },
    pero: { tA: 18, tB: 18, sirka: 100, sirkaB: 100, delkaA: 300 },
    koliky: { tA: 18, tB: 18, sirka: 300, sirkaB: 120, delkaA: 300, delkaB: 300, vule: 0, presah: 0 },
    lamelo: { tA: 20, tB: 20, sirka: 120, sirkaB: 120, delkaA: 600, delkaB: 300, vule: 0, presah: 0 },
  };
  const VARIANTY = {
    cep: ['cepVarianta', [['slepy', 'slepý s osazením'], ['pruchozi', 'průchozí'], ['kliny', 'průchozí s klínky']]],
    preplatovani: ['plVarianta', [['roh', 'rohové'], ['kriz', 'křížové'], ['T', 'tvaru T']]],
    pero: ['peroVarianta', [['pevne', 'pero z desky'], ['volne', 'volné pero (obě drážky)']]],
    koliky: ['kolVarianta', [['roh', 'roh – čelo na plochu'], ['sparovka', 'spárování hrana na hranu']]],
    lamelo: ['lamVarianta', [['sparovka', 'spárování hrana na hranu'], ['roh', 'roh – čelo na plochu']]],
  };
  // dynamické parametry: [klíč, popisek, typ, min, max, krok, title]
  const PAR = {
    rybina: [['sklonAuto', 'Sklon podle dřeva (1:6 měkké, 1:8 tvrdé)', 'chk'], ['sklon', 'Sklon 1:N', 'num', 3, 20, 0.5], ['pocet', 'Počet ozubů', 'num', 1, 40, 1], ['cepUzky', 'Čep – úzká strana (mm)', 'num', 0.5, 100, 0.5], ['pulcep', 'Krajní půlčep (mm)', 'num', 0.5, 100, 0.5], ['_navrh', 'Navrhnout rozvržení', 'btn']],
    polokryta: [['sklonAuto', 'Sklon podle dřeva (1:6 měkké, 1:8 tvrdé)', 'chk'], ['sklon', 'Sklon 1:N', 'num', 3, 20, 0.5], ['pocet', 'Počet ozubů', 'num', 1, 40, 1], ['cepUzky', 'Čep – úzká strana (mm)', 'num', 0.5, 100, 0.5], ['pulcep', 'Krajní půlčep (mm)', 'num', 0.5, 100, 0.5], ['kryti', 'Krytí čela (mm)', 'num', 0.5, 50, 0.5], ['_navrh', 'Navrhnout rozvržení', 'btn']],
    cinky: [['prstu', 'Počet prstů (lichý = souměrně)', 'num', 2, 81, 1]],
    cep: [['cepTl', 'Tloušťka čepu (0 = 1/3 nebo dláto)', 'num', 0, 100, 0.5], ['osazeni', 'Boční osazení (mm)', 'num', 0, 200, 1], ['hloubkaDlabu', 'Hloubka slepého dlabu (0 = 2/3)', 'num', 0, 500, 1], ['dnoDlabu', 'Rezerva na dně dlabu (mm)', 'num', 0, 10, 0.5], ['rozevreni', 'Rozevření dlabu pro klínky 1:N', 'num', 4, 40, 1], ['licovat', 'Lub lícuje s plochou nohy (jinak vystředěno)', 'chk']],
    preplatovani: [['plHloubka', 'Hloubka plátku (0 = polovina)', 'num', 0, 200, 0.5]],
    pero: [['peroTl', 'Tloušťka pera (0 = 1/3)', 'num', 0, 50, 0.5], ['peroHl', 'Hloubka pera (0 = 1/2 tloušťky)', 'num', 0, 100, 0.5]],
    koliky: [['kolPrumer', 'Průměr kolíku (mm)', 'sel', [[6, '6'], [8, '8'], [10, '10'], [12, '12']]], ['kolDelka', 'Délka kolíku (mm)', 'sel', [[25, '25'], [30, '30'], [35, '35'], [40, '40'], [50, '50'], [60, '60']]], ['kolRoztec', 'Rozteč (mm)', 'num', 10, 1000, 1], ['kolOkraj', 'Krajní kolík od kraje (mm)', 'num', 3, 500, 1]],
    lamelo: [['lamVel', 'Velikost lamely', 'sel', [['0', 'č. 0 (47×15)'], ['10', 'č. 10 (53×19)'], ['20', 'č. 20 (56×23)']]], ['lamRoztec', 'Rozteč (mm)', 'num', 40, 1000, 1], ['lamOkraj', 'Krajní lamela od kraje (mm)', 'num', 10, 500, 1]],
  };
  const POPISKY_ROZMERU = {
    rybina: ['Tloušťka A (ozuby)', 'Tloušťka B (čepy)', 'Šířka prken', '', 'Délka A', 'Délka B'],
    polokryta: ['Tloušťka boku A', 'Tloušťka čela B', 'Šířka (výška zásuvky)', '', 'Délka boku', 'Délka čela'],
    cinky: ['Tloušťka A', 'Tloušťka B', 'Šířka prken', '', 'Délka A', 'Délka B'],
    cep: ['Tloušťka lubu A', 'Tloušťka nohy B', 'Šířka lubu', 'Šířka nohy (hloubka dlabu)', 'Délka lubu (k osazení)', 'Délka nohy'],
    preplatovani: ['Tloušťka (oba díly)', '', 'Šířka A', 'Šířka B', 'Délka A', 'Délka B'],
    pero: ['Tloušťka desek', '', 'Šířka desky A', 'Šířka desky B', 'Délka (náhled)', ''],
    koliky: ['Tloušťka A', 'Tloušťka B', 'Šířka spoje', 'Šířka desky B (spárování)', 'Délka A / spoje', 'Délka B'],
    lamelo: ['Tloušťka A', 'Tloušťka B', 'Šířka desky A', 'Šířka desky B', 'Délka spoje', 'Délka B'],
  };

  /* ---------- ikony spojů ---------- */
  const IKONY = {
    rybina: '<path d="M4 4h12v6l-5 2v6l5 2v6H4z" fill="#a9733f"/><path d="M16 10l-5 2v6l5 2z" fill="none"/><path d="M11 12l5-2h20v14H16l-5-2z" fill="#d9a66a" stroke="currentColor" stroke-width=".8"/>',
    polokryta: '<rect x="4" y="4" width="14" height="22" fill="#a9733f"/><path d="M9 12l4-2h23v12H13l-4-2z" fill="#d9a66a" stroke="currentColor" stroke-width=".8"/>',
    cinky: '<rect x="4" y="4" width="12" height="22" fill="#a9733f"/><path d="M4 8h32v5H4zM4 17h32v5H4z" fill="#d9a66a" stroke="currentColor" stroke-width=".8"/>',
    cep: '<rect x="4" y="2" width="12" height="26" fill="#a9733f"/><path d="M8 12h8V8h20v14H16v-4H8z" fill="#d9a66a" stroke="currentColor" stroke-width=".8"/>',
    preplatovani: '<rect x="4" y="16" width="32" height="8" fill="#d9a66a" stroke="currentColor" stroke-width=".8"/><rect x="14" y="8" width="10" height="8" fill="#a9733f" stroke="currentColor" stroke-width=".8"/><rect x="4" y="12" width="10" height="4" fill="#d9a66a"/>',
    pero: '<path d="M2 8h16v5h5v4h-5v5H2z" fill="#d9a66a" stroke="currentColor" stroke-width=".8"/><path d="M38 8H18v5h5v4h-5v5h20z" fill="#a9733f" stroke="currentColor" stroke-width=".8"/>',
    koliky: '<rect x="2" y="7" width="18" height="16" fill="#d9a66a" stroke="currentColor" stroke-width=".8"/><rect x="20" y="7" width="18" height="16" fill="#a9733f" stroke="currentColor" stroke-width=".8"/><rect x="12" y="13" width="16" height="4" rx="2" fill="#efd9a8" stroke="currentColor" stroke-width=".6"/>',
    lamelo: '<rect x="2" y="7" width="18" height="16" fill="#d9a66a" stroke="currentColor" stroke-width=".8"/><rect x="20" y="7" width="18" height="16" fill="#a9733f" stroke="currentColor" stroke-width=".8"/><ellipse cx="20" cy="15" rx="9" ry="3.5" fill="#efd9a8" stroke="currentColor" stroke-width=".6"/>',
  };

  /* ---------- stav ---------- */
  let stav = { p: Object.assign({}, J.VYCHOZI), poSpojich: {}, tisk: {} };
  function nacti() {
    let ulozeny = false;
    try { const s = JSON.parse(localStorage.getItem(KLIC) || 'null'); if (s && s.p) { stav = Object.assign(stav, s); ulozeny = true; } } catch (e) { /* bez úložiště */ }
    stav.p = Object.assign({}, J.VYCHOZI, ulozeny ? stav.p : ROZ[stav.p.spoj] || {});
    if (!stav.poSpojich) stav.poSpojich = {};
  }
  function uloz() { try { localStorage.setItem(KLIC, JSON.stringify(stav)); } catch (e) { /* plné / zakázané */ } }
  let S = null, aktDil = 'A', sablonyCache = null;

  /* ---------- sestavení ovládacích prvků ---------- */
  function postavTypy() {
    const el = $('typy'); el.innerHTML = '';
    Object.keys(J.SPOJE).forEach((k, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.dataset.spoj = k;
      b.innerHTML = `<svg viewBox="0 0 40 30" aria-hidden="true">${IKONY[k]}</svg>${J.SPOJE[k].nazev.replace(' (krabicový)', '').replace('Rybinový ozub průběžný', 'Rybina průběžná')}`;
      b.title = `${J.SPOJE[k].nazev} (${J.SPOJE[k].kratce}) – klávesa ${i + 1}`;
      b.addEventListener('click', () => zvolSpoj(k));
      el.appendChild(b);
    });
    const m = $('material'); m.innerHTML = Object.entries(J.MATERIALY).map(([k, v]) => `<option value="${k}">${v.nazev}${v.deska ? '' : v.tvrde ? ' – tvrdé' : ' – měkké'}</option>`).join('');
    $('pila').innerHTML = Object.entries(J.PILY).map(([k, v]) => `<option value="${k}">${v.nazev}</option>`).join('');
    $('predvolba').innerHTML = Object.entries(J.PREDVOLBY).map(([k, v]) => `<option value="${k}">${v.nazev}</option>`).join('');
  }
  function zvolSpoj(k) {
    if (k === stav.p.spoj) return;
    stav.poSpojich[stav.p.spoj] = Object.assign({}, stav.p);
    const spol = { material: stav.p.material, pila: stav.p.pila, kerf: stav.p.kerf, dlato: stav.p.dlato };
    stav.p = Object.assign({}, J.VYCHOZI, spol, ROZ[k], stav.poSpojich[k] || {}, { spoj: k });
    naplnFormular(); prepocti();
  }
  function postavParametry() {
    const k = stav.p.spoj, el = $('parSpoje'); el.innerHTML = '';
    const mrizka = document.createElement('div'); mrizka.className = 'r2';
    for (const d of PAR[k] || []) {
      const [kl, pop, typ] = d;
      if (typ === 'chk') {
        const l = document.createElement('label'); l.className = 'chk'; l.innerHTML = `<input type="checkbox" data-k="${kl}"> ${pop}`;
        l.querySelector('input').checked = !!stav.p[kl]; el.appendChild(l); continue;
      }
      if (typ === 'btn') { const b = document.createElement('button'); b.className = 'btn btn-sec'; b.type = 'button'; b.textContent = pop; b.id = 'btnNavrh'; b.style.marginTop = '10px'; el.appendChild(mrizka); el.appendChild(b); continue; }
      const box = document.createElement('div'); const id = 'p_' + kl;
      if (typ === 'sel') box.innerHTML = `<label for="${id}">${pop}</label><select id="${id}" data-k="${kl}">${d[3].map((o) => `<option value="${o[0]}">${o[1]}</option>`).join('')}</select>`;
      else box.innerHTML = `<label for="${id}">${pop}</label><input id="${id}" data-k="${kl}" type="number" min="${d[3]}" max="${d[4]}" step="${d[5]}">`;
      const inp = box.querySelector('[data-k]'); inp.value = stav.p[kl];
      mrizka.appendChild(box);
    }
    if (!mrizka.parentNode) el.appendChild(mrizka);
    el.querySelectorAll('[data-k]').forEach((inp) => inp.addEventListener(inp.type === 'checkbox' || inp.tagName === 'SELECT' ? 'change' : 'input', () => {
      const kl = inp.dataset.k;
      stav.p[kl] = inp.type === 'checkbox' ? inp.checked : inp.tagName === 'SELECT' && isNaN(Number(inp.value)) ? inp.value : (kl === 'lamVel' ? inp.value : Number(inp.value));
      if (kl === 'sklonAuto') zamkniSklon();
      naplanovat();
    }));
    const bn = $('btnNavrh');
    if (bn) bn.addEventListener('click', () => { Object.assign(stav.p, J.navrhRybin(stav.p)); postavParametry(); prepocti(); toast('Rozvržení navrženo podle tloušťky a šířky.'); });
    zamkniSklon();
  }
  function zamkniSklon() {
    const s = document.querySelector('[data-k="sklon"]');
    if (s) { s.disabled = !!stav.p.sklonAuto; if (stav.p.sklonAuto) s.value = J.MATERIALY[stav.p.material].sklon; }
  }
  const POLE = ['material', 'tA', 'tB', 'sirka', 'sirkaB', 'delkaA', 'delkaB', 'pila', 'kerf', 'dlato', 'vule', 'presah', 'pocetSpoju'];
  function naplnFormular() {
    const p = stav.p, k = p.spoj;
    for (const id of POLE) $(id).value = p[id];
    $('kerf').value = p.pila === 'vlastni' ? p.kerf : J.PILY[p.pila].kerf; $('kerf').disabled = p.pila !== 'vlastni';
    document.querySelectorAll('#typy button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.spoj === k ? 'true' : 'false'));
    const va = VARIANTY[k];
    $('blokVarianta').classList.toggle('skryte', !va);
    if (va) { $('varianta').innerHTML = va[1].map((o) => `<option value="${o[0]}">${o[1]}</option>`).join(''); $('varianta').value = p[va[0]]; }
    const pr = POPISKY_ROZMERU[k];
    const lab = [['ltA', 'tA'], ['ltB', 'boxtB'], ['lsirka', 'sirka'], ['lsirkaB', 'boxsirkaB'], ['ldelkaA', 'delkaA'], ['ldelkaB', 'boxdelkaB']];
    lab.forEach(([l, box], i) => {
      if (pr[i]) $(l).textContent = pr[i];
      if (box.startsWith('box')) $(box).classList.toggle('skryte', !pr[i] || (k === 'koliky' && box === 'boxsirkaB' && p.kolVarianta === 'roh') || (k === 'lamelo' && box === 'boxsirkaB' && p.lamVarianta === 'roh') || ((k === 'koliky' || k === 'lamelo') && box === 'boxtB' && (p.kolVarianta === 'sparovka' && k === 'koliky' || p.lamVarianta === 'sparovka' && k === 'lamelo')) || ((k === 'koliky' || k === 'lamelo') && box === 'boxdelkaB' && (k === 'koliky' ? p.kolVarianta : p.lamVarianta) === 'sparovka'));
    });
    postavParametry();
    const t = stav.tisk || {};
    for (const id of ['papir', 'okraj', 'prekryv', 'papirW', 'papirH']) if (t[id] != null) $(id).value = t[id];
    $('cernobile').checked = !!t.cernobile;
    $('blokPapir').classList.toggle('skryte', $('papir').value !== 'vlastni');
  }
  for (const id of POLE) $(id).addEventListener(id === 'material' || id === 'pila' ? 'change' : 'input', () => {
    const v = $(id).value;
    stav.p[id] = id === 'material' || id === 'pila' ? v : Number(v);
    if (id === 'pila') { $('kerf').disabled = v !== 'vlastni'; if (v !== 'vlastni') $('kerf').value = J.PILY[v].kerf; else stav.p.kerf = Number($('kerf').value); }
    if (id === 'material') zamkniSklon();
    naplanovat();
  });
  $('varianta').addEventListener('change', () => { const va = VARIANTY[stav.p.spoj]; if (va) stav.p[va[0]] = $('varianta').value; naplnFormular(); prepocti(); });
  for (const id of ['papir', 'okraj', 'prekryv', 'papirW', 'papirH', 'cernobile']) $(id).addEventListener('change', () => {
    stav.tisk = { papir: $('papir').value, okraj: +$('okraj').value, prekryv: +$('prekryv').value, papirW: +$('papirW').value, papirH: +$('papirH').value, cernobile: $('cernobile').checked };
    $('blokPapir').classList.toggle('skryte', $('papir').value !== 'vlastni');
    uloz(); infoListy(); kresliSablonu();
  });

  /* ---------- přepočet ---------- */
  let casovac = null;
  function naplanovat() { clearTimeout(casovac); casovac = setTimeout(prepocti, 120); }
  function prepocti() {
    try { S = J.sestav(stav.p); }
    catch (e) { console.error(e); toast('Chyba výpočtu: ' + e.message, true); return; }
    stav.p.sklon = S.p.sklon;
    uloz();
    sablonyCache = null;
    if (!S.dily.some((d) => d.id === aktDil) || !S.sablony.some((s) => s.dil === aktDil)) aktDil = S.sablony[0] ? S.sablony[0].dil : 'A';
    kresliKontrolu(); kresliSablonu(); kresliPohledy(); kresliKusovnik(); kresliPrincip(); kresliExporty(); infoListy();
    if (scena) scena.nastav(S);
  }
  const vse = () => { if (!sablonyCache) sablonyCache = TS.vsechnySablony(S, { kerf: S.p.kerf }); return sablonyCache; };

  function kresliKontrolu() {
    const ul = $('varovani'); ul.innerHTML = '';
    const v = S.varovani.length ? S.varovani : [{ uroven: 'ok', text: 'Rozměry spoje jsou v doporučených mezích.' }];
    for (const q of v.slice().sort((a, b) => ['chyba', 'varovani', 'info', 'ok'].indexOf(a.uroven) - ['chyba', 'varovani', 'info', 'ok'].indexOf(b.uroven))) {
      const li = document.createElement('li'); li.className = q.uroven; li.textContent = ({ chyba: '⛔ ', varovani: '⚠️ ', info: 'ℹ️ ', ok: '✅ ' }[q.uroven] || '') + q.text; ul.appendChild(li);
    }
    $('udaje').innerHTML = Object.entries(S.info).map(([k, v]) => `<div><span>${k}</span><span>${v}</span></div>`).join('') +
      S.dily.map((d) => `<div><span>Objem dílu ${d.id}${d.pocet > 1 ? ' (×' + d.pocet + ')' : ''}</span><span>${fmt(d.objem / 1000, 1)} cm³</span></div>`).join('');
    $('objKontrola').textContent = 'Objemová kontrola sestavy probíhá…';
    setTimeout(() => {
      if (!S) return;
      const z = S.zona, obj = (z[1] - z[0]) * (z[3] - z[2]) * (z[5] - z[4]), krok = Math.max(0.6, Math.cbrt(obj / 120000));
      const k = J.objemovaKontrola(S, krok);
      const okK = k.kolize === 0;
      $('objKontrola').innerHTML = `<b class="${okK ? 'stav-ok' : 'stav-chyba'}">${okK ? '✓ Díly se nepronikají' : '✕ Díly se pronikají (' + fmt(k.kolize, 0) + ' mm³)'}</b> · ` +
        `mezery uvnitř obrysu: ${fmt(k.prazdno, 0)} mm³ (vůle, dno dlabu, rezervy v otvorech; z toho mimo záměrné dutiny ${fmt(k.prazdnoMimoDutiny, 0)} mm³) · ` +
        `mimo obrys (přesah): ${fmt(k.mimo, 0)} mm³ · vzorkováno ${k.vzorku.toLocaleString('cs')} bodů po ${fmt(krok, 2)} mm v oblasti spoje.`;
    }, 30);
  }

  function kresliSablonu() {
    const box = $('dilyVolba'); box.innerHTML = '';
    for (const sp of S.sablony) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = sp.nazev; b.setAttribute('aria-pressed', sp.dil === aktDil ? 'true' : 'false');
      b.addEventListener('click', () => { aktDil = sp.dil; kresliSablonu(); }); box.appendChild(b);
    }
    try {
      const i = S.sablony.findIndex((s) => s.dil === aktDil), sc = vse()[Math.max(0, i)];
      $('nahledSablony').innerHTML = V.svg(sc, { sirkaPx: true, meritko: true, cernobile: $('cernobile').checked });
      const svg = $('nahledSablony').querySelector('svg');
      // náhled zhruba 1:1 na obrazovce (96 dpi), ale nejvýš šířka karty
      if (svg) { svg.style.width = Math.round((sc.w + 8) * 3.78) + 'px'; svg.style.maxWidth = '100%'; }
      $('rozmerSablony').textContent = `${fmt(sc.w, 0)} × ${fmt(sc.h, 0)} mm`;
    } catch (e) { console.error(e); $('nahledSablony').textContent = 'Šablonu nelze vykreslit: ' + e.message; }
  }
  function kresliPohledy() {
    const el = $('pohledy'); el.innerHTML = '';
    for (const k of ['y', 'z', 'x']) {
      const d = document.createElement('div'); d.className = 'papir';
      try { d.innerHTML = V.svg(TS.pohled(S, k), { sirkaPx: true, okraj: 2 }); } catch (e) { console.error(e); d.textContent = e.message; }
      el.appendChild(d);
    }
  }
  function kresliKusovnik() {
    const r = S.kusovnik;
    $('tabKusovnik').innerHTML = '<tr><th>Díl</th><th>Název</th><th class="c">Ks</th><th>Rozměr (polotovar)</th><th>Materiál</th><th class="c">Objem</th><th class="c">Hmotnost</th></tr>' +
      r.map((q) => `<tr><td>${q.dil}</td><td>${q.nazev}</td><td class="c">${q.ks}</td><td>${q.rozmer}</td><td>${q.material}</td><td class="c">${fmt(q.objem * 1000, 2)} dm³</td><td class="c">${fmt(q.hmotnost, 2)} kg</td></tr>`).join('') +
      `<tr><td></td><td><b>Celkem</b></td><td></td><td></td><td></td><td class="c"><b>${fmt(r.reduce((a, q) => a + q.objem, 0) * 1000, 2)} dm³</b></td><td class="c"><b>${fmt(r.reduce((a, q) => a + q.hmotnost, 0), 2)} kg</b></td></tr>`;
    $('kusInfo').textContent = 'Rozměry jsou polotovary jednoho konce se spojem (délka × šířka × tloušťka) včetně přesahu; připočtěte prořez na zarovnání. Díl se spoji na obou koncích (bok krabice) počítejte jednou na dva spoje.';
  }
  function kresliPrincip() {
    const k = S.p.spoj, T = P.TEXTY[k];
    $('princip').innerHTML = `<figure class="schema">${P.SCHEMA[k]()}</figure>` +
      `<h3>Proč spoj drží</h3><p>${T.proc}</p><h3>Vlákna a síly</h3><p>${T.vlakna}</p><h3>Kdy ho použít</h3><p>${T.kdy}</p>` +
      P.OBECNE.map((o) => `<h3>${o.nadpis}</h3><p>${o.text}</p>`).join('');
    $('postup').innerHTML = `<h3>${S.nazev} – krok za krokem</h3><ol>${T.postup.map((x) => `<li>${x}</li>`).join('')}</ol>` +
      `<h3>Klíčové míry</h3><ul>${Object.entries(S.info).map(([a, b]) => `<li><b>${a}:</b> ${b}</li>`).join('')}</ul>`;
  }
  function kresliExporty() {
    const t = $('stlTlacitka'); t.innerHTML = '';
    for (const d of S.dily) {
      const b = document.createElement('button'); b.className = 'btn btn-sec'; b.type = 'button'; b.textContent = `STL ${d.id}`; b.title = d.nazev;
      b.addEventListener('click', () => stahniStl([d], 'dil_' + d.id, b)); t.appendChild(b);
    }
    const bv = document.createElement('button'); bv.className = 'btn btn-sec'; bv.type = 'button'; bv.textContent = 'STL sestava'; bv.addEventListener('click', () => stahniStl(S.dily, 'sestava', bv)); t.appendChild(bv);
    const pr = ST.pripravky(S), tp = $('stlPripravky'); tp.innerHTML = '';
    for (const q of pr) { const b = document.createElement('button'); b.className = 'btn btn-sec'; b.type = 'button'; b.textContent = '🖨️ ' + q.nazev; b.addEventListener('click', () => stahniStl([{ telesa: q.telesa }], q.id, b, true)); tp.appendChild(b); }
    $('pripravkyPanel').innerHTML = pr.length ? '<h3>3D tisknutelné přípravky k tomuto spoji</h3><ul>' + pr.map((q) => `<li><b>${q.nazev}</b> – ${q.popis}</li>`).join('') + '</ul><p class="info">Tiskněte z PLA/PETG, 3–4 perimetry, výplň 30 %+. Šikmé plochy ověřte úhloměrem; pro přesnost tiskněte vodicí plochou svisle.</p>'
      : '<p>Pro tento spoj se připravuje jen STL dílů. Přípravky jsou k rybinám (šablona sklonu, vodítko pily), cinkám (vymezovací klíček) a kolíkům (kolíkovací přípravek).</p>';
  }
  function papir() {
    const v = $('papir').value;
    return v === 'a3' ? [297, 420] : v === 'letter' ? [215.9, 279.4] : v === 'vlastni' ? [Math.max(50, +$('papirW').value || 210), Math.max(50, +$('papirH').value || 297)] : [210, 297];
  }
  function infoListy() {
    if (!S) return;
    try {
      const [pw, ph] = papir(), ok = +$('okraj').value || 8;
      const n = vse().map((sc) => V.rozvrhListu(sc, pw, ph, ok, +$('prekryv').value || 12).listy.length);
      $('infoListy').innerHTML = `Šablony: ${n.map((x, i) => `${S.sablony[i].dil} = ${x} ${x === 1 ? 'list' : x < 5 ? 'listy' : 'listů'}`).join(', ')}. PDF má navíc úvodní list s kusovníkem a čtvercem 50 mm, technické pohledy a postup.`;
    } catch (e) { $('infoListy').textContent = ''; }
  }

  /* ---------- soubory ---------- */
  function stahni(blob, jmeno) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = jmeno;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  const zaklad = () => 'spoj_' + S.p.spoj + '_' + fmt(S.p.tA, 1).replace(',', '-') + 'x' + fmt(S.p.sirka, 0);
  $('btnSvg').addEventListener('click', () => stahni(new Blob([V.svg(V.poskladej(vse()), { meritko: true, cernobile: $('cernobile').checked })], { type: 'image/svg+xml' }), zaklad() + '_sablony.svg'));
  $('btnDxf').addEventListener('click', () => stahni(new Blob([V.dxf(V.poskladej(vse()))], { type: 'application/dxf' }), zaklad() + '_sablony.dxf'));
  $('btnSvgProf').addEventListener('click', () => stahni(new Blob([V.svg(V.profily(S), { meritko: true })], { type: 'image/svg+xml' }), zaklad() + '_profily.svg'));
  $('btnDxfProf').addEventListener('click', () => stahni(new Blob([V.dxf(V.profily(S))], { type: 'application/dxf' }), zaklad() + '_profily.dxf'));
  $('btnDxfPohl').addEventListener('click', () => stahni(new Blob([V.dxf(V.poskladej(['y', 'z', 'x'].map((k) => TS.pohled(S, k))))], { type: 'application/dxf' }), zaklad() + '_pohledy.dxf'));

  function nactiPismo() {
    if (window.FONTY_JS && window.FONTY_JS['LiberationSans-Regular.ttf']) return Promise.resolve(window.FONTY_JS['LiberationSans-Regular.ttf']);
    return new Promise((ok) => {
      const s = document.createElement('script'); s.src = 'stitky_panely/fonty/LiberationSans-Regular.ttf.js';
      s.onload = () => ok((window.FONTY_JS || {})['LiberationSans-Regular.ttf'] || null); s.onerror = () => ok(null);
      document.head.appendChild(s);
    });
  }
  function strankyPdf() {
    const p = S.p, mat = J.MATERIALY[p.material];
    const uvod = [
      `# ${S.nazev}`,
      `Materiál: ${mat.nazev} · tloušťky A ${fmt(p.tA)} mm / B ${fmt(p.tB)} mm · šířka ${fmt(p.sirka)} mm · nástroj: ${J.PILY[p.pila].nazev} (řez ${fmt(p.kerf, 2)} mm), dláto ${fmt(p.dlato)} mm · vůle ${fmt(p.vule, 2)} mm · přesah ${fmt(p.presah, 1)} mm.`,
      '# Klíčové míry',
      ...Object.entries(S.info).map(([a, b]) => `${a}: ${b}`),
    ];
    if (S.varovani.length) { uvod.push('# Upozornění'); for (const v of S.varovani) uvod.push((v.uroven === 'chyba' ? '!! ' : v.uroven === 'varovani' ? '! ' : '') + v.text); }
    uvod.push('# Jak šablony použít', 'Tiskněte ve skutečné velikosti (100 %, ne „přizpůsobit stránce“) a zkontrolujte čtverec 50 mm. Plná čára = hrana hotového dílu, šrafovaně s X = odpad (s hloubkou nebo „skrz“), šedý pruh = řez pilou na odpadní straně, čárkovaně = ohyb přes hranu prkna, červený kříž = střed otvoru nebo lamely.');
    const st = [{ nadpis: 'Šablony truhlářských spojů', text: uvod, ctverec: true, tabulka: {
      hlavicka: ['Díl', 'Název', 'Ks', 'Rozměr', 'Materiál', 'Objem dm³'], sloupce: ['l', 'l', 'r', 'l', 'l', 'r'], sirky: [10, 58, 10, 50, 32, 24],
      radky: S.kusovnik.map((q) => [q.dil, q.nazev, q.ks, q.rozmer, q.material, fmt(q.objem * 1000, 2)]),
    } }];
    vse().forEach((sc, i) => st.push({ scena: sc, nadpis: `Šablona ${S.sablony[i].nazev} – ${S.nazev}`, deleni: true }));
    st.push({ scena: V.poskladej(['y', 'z', 'x'].map((k) => TS.pohled(S, k)), 8), nadpis: 'Technické pohledy sestavy', zmensit: true });
    const T = P.TEXTY[p.spoj];
    st.push({ nadpis: 'Postup výroby', text: [`# ${S.nazev}`, ...T.postup.map((x, i) => `${i + 1}. ${x}`), '# Proč spoj drží', T.proc, '# Vlákna a síly', T.vlakna] });
    const pr = ST.pripravky(S);
    if (pr.length) st[st.length - 1].text.push('# 3D tisknutelné přípravky', ...pr.map((q) => `${q.nazev}: ${q.popis}`));
    return st;
  }
  $('btnPdf').addEventListener('click', async () => {
    const b = $('btnPdf'), puv = b.textContent; b.disabled = true; b.textContent = 'Připravuji PDF…';
    try {
      if (!window.jspdf) throw new Error('jsPDF se nenačetl');
      const pismo = await nactiPismo();
      const doc = V.pdf(window.jspdf.jsPDF, strankyPdf(), { papir: papir(), okraj: +$('okraj').value || 8, prekryv: +$('prekryv').value || 12, pismo, cernobile: $('cernobile').checked, nazev: S.nazev });
      stahni(doc.output('blob'), zaklad() + '_sablony.pdf');
      toast(`PDF: ${doc.getNumberOfPages()} stran. Tiskněte ve skutečné velikosti (100 %).`);
    } catch (e) { console.error(e); toast('PDF se nepodařilo vytvořit: ' + e.message, true); }
    finally { b.disabled = false; b.textContent = puv; }
  });

  /* ---------- STL (manifold-3d) ---------- */
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
  async function stahniStl(dily, pr, b, pripravek) {
    const puv = b.textContent; b.disabled = true; b.textContent = 'Počítám STL…';
    try {
      const w = await nactiManifold();
      const site = dily.map((d) => ST.sit(w, d.telesa));
      const m = site.length === 1 ? site[0] : ST.spoj(site);
      const k = ST.kontrolaSite(m.poz, m.idx);
      stahni(new Blob([ST.stlBinarni(m.poz, m.idx, 'truhlarske spoje ' + pr)], { type: 'model/stl' }), zaklad() + '_' + pr + '.stl');
      toast(`STL: ${k.trojuhelniku} trojúhelníků, objem ${fmt(m.objem / 1000, 1)} cm³${k.uzavrena ? ', síť uzavřená' : ' – POZOR: síť není uzavřená'}.` + (pripravek ? '' : ' Díly jsou v poloze sestavy (mm).'));
    } catch (e) { console.error(e); toast('STL se nepodařilo vytvořit: ' + e.message, true); }
    finally { b.disabled = false; b.textContent = puv; }
  }

  /* ---------- projekty ---------- */
  const projekty = () => { try { return JSON.parse(localStorage.getItem(KLIC_PROJ) || '[]'); } catch (e) { return []; } };
  const ulozProjekty = (L) => { try { localStorage.setItem(KLIC_PROJ, JSON.stringify(L)); return true; } catch (e) { toast('Projekt se nepodařilo uložit (úložiště je plné nebo zakázané).', true); return false; } };
  function kresliProjekty() {
    const L = projekty(), ul = $('projekty'); ul.innerHTML = '';
    if (!L.length) { ul.innerHTML = '<li><span style="color:var(--text-faint)">Zatím žádné uložené projekty.</span></li>'; return; }
    L.forEach((q, i) => {
      const li = document.createElement('li');
      li.innerHTML = `<span title="${q.nazev}">${q.nazev} <small style="color:var(--text-faint)">· ${J.SPOJE[q.p.spoj] ? J.SPOJE[q.p.spoj].nazev : ''}</small></span><button type="button" data-a="n">Načíst</button><button type="button" data-a="s" aria-label="Smazat">✕</button>`;
      li.querySelector('[data-a=n]').addEventListener('click', () => { stav.p = Object.assign({}, J.VYCHOZI, q.p); $('nazevProjektu').value = q.nazev; naplnFormular(); prepocti(); toast('Načteno: ' + q.nazev); });
      li.querySelector('[data-a=s]').addEventListener('click', async () => { if (await Dialog.potvrd(`Smazat projekt „${q.nazev}“?`)) { const M = projekty(); M.splice(i, 1); ulozProjekty(M); kresliProjekty(); } });
      ul.appendChild(li);
    });
  }
  $('btnUlozit').addEventListener('click', async () => {
    let n = $('nazevProjektu').value.trim();
    if (!n) { n = await Dialog.zeptej('Název projektu', S.nazev + ' ' + fmt(S.p.tA) + ' mm'); if (!n) return; $('nazevProjektu').value = n; }
    const L = projekty(), i = L.findIndex((q) => q.nazev === n);
    if (i >= 0 && !(await Dialog.potvrd(`Projekt „${n}“ už existuje. Přepsat?`))) return;
    const zaznam = { nazev: n, p: Object.assign({}, stav.p), cas: new Date().toISOString() };
    if (i >= 0) L[i] = zaznam; else L.unshift(zaznam);
    if (ulozProjekty(L)) { kresliProjekty(); toast('Uloženo: ' + n); }
  });
  $('btnPredvolba').addEventListener('click', () => {
    const q = J.PREDVOLBY[$('predvolba').value]; if (!q) return;
    stav.poSpojich[stav.p.spoj] = Object.assign({}, stav.p);
    stav.p = Object.assign({}, J.VYCHOZI, ROZ[q.p.spoj], q.p, { sklonAuto: true });
    $('nazevProjektu').value = q.nazev; naplnFormular(); prepocti(); toast('Předvolba: ' + q.nazev);
  });
  $('btnExportJson').addEventListener('click', () => stahni(new Blob([JSON.stringify({ typ: 'truhlarske_spoje', verze: 1, nazev: $('nazevProjektu').value || S.nazev, p: stav.p, projekty: projekty() }, null, 2)], { type: 'application/json' }), zaklad() + '.json'));
  $('btnImportJson').addEventListener('click', () => $('souborJson').click());
  $('souborJson').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (!d || d.typ !== 'truhlarske_spoje' || !d.p) throw new Error('to není soubor této stránky');
      stav.p = Object.assign({}, J.VYCHOZI, d.p);
      if (Array.isArray(d.projekty) && d.projekty.length && await Dialog.potvrd(`Soubor obsahuje ${d.projekty.length} projektů. Přidat je k uloženým?`)) {
        const L = projekty(); for (const q of d.projekty) if (q && q.p && !L.some((x) => x.nazev === q.nazev)) L.push(q); ulozProjekty(L); kresliProjekty();
      }
      $('nazevProjektu').value = d.nazev || ''; naplnFormular(); prepocti(); toast('Načteno ze souboru.');
    } catch (er) { toast('Soubor nejde načíst: ' + er.message, true); }
    e.target.value = '';
  });
  $('btnReset').addEventListener('click', async () => {
    if (!(await Dialog.potvrd('Vrátit parametry tohoto spoje na výchozí hodnoty?'))) return;
    const k = stav.p.spoj; delete stav.poSpojich[k];
    stav.p = Object.assign({}, J.VYCHOZI, ROZ[k], { spoj: k }); naplnFormular(); prepocti();
  });

  /* ---------- záložky ---------- */
  $('zalozky').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-z]'); if (!b) return;
    document.querySelectorAll('#zalozky button').forEach((x) => x.setAttribute('aria-selected', x === b ? 'true' : 'false'));
    document.querySelectorAll('.panel').forEach((p) => { p.hidden = p.dataset.p !== b.dataset.z; });
  });

  /* ---------- 3D ---------- */
  let scena = null, nacita3d = false;
  function start3d() {
    if (scena || nacita3d) return; nacita3d = true;
    const hotovo = () => {
      try {
        $('obal3d').innerHTML = '';
        scena = window.TS3D.vytvor($('obal3d'));
        scena.priZmeneT = (t) => { $('rozlozeni').value = t; };
        if (S) scena.nastav(S);
      } catch (e) { console.error(e); $('obal3d').innerHTML = '<div class="info" style="padding:12px">3D nelze zobrazit (WebGL): ' + e.message + '</div>'; }
    };
    if (window.THREE) hotovo();
    else nactiSkript('lib/three.0.160.0.min.js').then(hotovo).catch((e) => { nacita3d = false; $('stav3d').textContent = 'three.js se nenačetl: ' + e.message; });
  }
  if ('IntersectionObserver' in window) new IntersectionObserver((z) => { if (z.some((q) => q.isIntersecting)) start3d(); }, { rootMargin: '200px' }).observe($('karta3d'));
  else start3d();
  $('rozlozeni').addEventListener('input', () => { if (scena) { scena.prehraj(false); $('btnAnim').textContent = '▶ Složit / rozložit'; scena.nastavT(+$('rozlozeni').value); } });
  const animuj = () => { if (!scena) return; const h = scena.prehraj(); $('btnAnim').innerHTML = h ? '⏸ Zastavit <kbd>mezera</kbd>' : '▶ Složit / rozložit <kbd>mezera</kbd>'; };
  $('btnAnim').addEventListener('click', animuj);
  $('pruhled').addEventListener('change', () => scena && scena.nastavPruhled($('pruhled').checked));
  $('popisky3d').addEventListener('change', () => scena && scena.popisky($('popisky3d').checked));
  const rez = () => scena && scena.nastavRez($('rezOsa').value || null, +$('rezPoloha').value);
  $('rezOsa').addEventListener('change', rez); $('rezPoloha').addEventListener('input', rez);
  document.querySelectorAll('[data-pohled]').forEach((b) => b.addEventListener('click', () => scena && scena.pohled(b.dataset.pohled)));

  /* ---------- klávesy ---------- */
  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input,select,textarea') || e.ctrlKey || e.metaKey || e.altKey) return;
    const m = /^(Digit|Numpad)([1-8])$/.exec(e.code);
    if (m) { zvolSpoj(Object.keys(J.SPOJE)[+m[2] - 1]); e.preventDefault(); return; }
    if (e.code === 'Space') { e.preventDefault(); animuj(); }
  });

  /* ---------- start ---------- */
  nacti();
  postavTypy();
  naplnFormular();
  kresliProjekty();
  prepocti();
  window.TSUI = { get S() { return S; }, get stav() { return stav; }, zvolSpoj, prepocti, strankyPdf, get scena() { return scena; } };
})();

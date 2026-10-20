/* ============================================================
   Prkénka a lepené vzory – ovládání stránky
   ============================================================ */
(function () {
  'use strict';
  const J = window.PKJ, K = window.PKK, V = window.PKV, P = window.PKP;
  const $ = (id) => document.getElementById(id);
  const fmt = J.fmt;
  const KLIC = 'webapp_prkenka', KLIC_PROJ = 'webapp_prkenka_projekty';
  const toast = (t, chyba) => { try { chyba ? Dialog.chyba(t) : Dialog.info(t); } catch (e) { console.log(t); } };
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  /* ---------- parametry vzorů: [klíč, popisek, typ, min, max, krok, title] ---------- */
  const PAR = {
    podelne: [['sekvence', 'Sekvence pruhů (pozice + šířka mm, „×n“ opakuje)', 'txt'], ['opakovat', 'Opakovat do šířky (poslední pruh se dořízne)', 'chk']],
    sachovnice: [['bunka', 'Velikost pole (mm)', 'num', 10, 120, 1]],
    cihla: [['cihlaDelka', 'Délka cihly (mm)', 'num', 15, 200, 1], ['cihlaVyska', 'Šířka sloupce cihel (mm)', 'num', 10, 120, 1], ['spara', 'Spára z dřeviny C (0 = bez)', 'num', 0, 20, 0.5]],
    kostky: [['kostka', 'Strana kosočtverce (mm)', 'num', 12, 80, 1]],
    chevron: [['chevronUhel', 'Úhel řezu (°)', 'num', 25, 65, 1], ['chevronPruh', 'Šířka pruhu v panelu (mm)', 'num', 4, 80, 1], ['chevronSloupec', 'Šířka pásu (mm)', 'num', 15, 150, 1], ['chevronSled', 'Pořadí pruhů (A, B, C)', 'txt']],
    sachy: [['sachyPole', 'Pole (mm)', 'num', 15, 100, 1], ['sachyOkraj', 'Okraj z dřeviny C (mm)', 'num', 5, 100, 1]],
    vlny: [['vlnyPocet', 'Počet křivek', 'num', 1, 8, 1], ['vlnyAmplituda', 'Amplituda (mm)', 'num', 0, 80, 1], ['vlnyDelka', 'Délka vlny (mm)', 'num', 40, 1200, 5], ['vlnyFaze', 'Fázový posun mezi křivkami (°)', 'num', 0, 180, 5], ['vlnyZilka', 'Tloušťka žilky B (mm)', 'num', 0.5, 10, 0.1], ['vlnyKerf', 'Řez pásové pily (mm)', 'num', 0.3, 3, 0.1]],
    vkladane: [['sekvence', 'Sekvence pruhů podkladu', 'txt'], ['opakovat', 'Opakovat do šířky', 'chk'], ['vklPocet', 'Počet proužků C', 'num', 1, 10, 1], ['vklUhel', 'Úhel proužků k délce (°)', 'num', 20, 90, 1], ['vklZilka', 'Tloušťka proužku (mm)', 'num', 0.5, 15, 0.5]],
  };
  const ROLE = {
    podelne: { A: 'pruhy podle sekvence', B: 'pruhy podle sekvence', C: 'pruhy podle sekvence' },
    sachovnice: { A: 'světlá pole', B: 'tmavá pole' },
    cihla: { A: 'cihly', B: 'cihly (střídavě)', C: 'spára' },
    kostky: { A: 'vršky kostek', B: 'levé stěny', C: 'pravé stěny' },
    chevron: { A: 'pruhy', B: 'pruhy', C: 'pruhy (je-li v pořadí)' },
    sachy: { A: 'světlá pole', B: 'tmavá pole', C: 'okraj' },
    vlny: { A: 'základní deska', B: 'žilky' },
    vkladane: { A: 'podklad', B: 'podklad', C: 'vkládané proužky' },
  };
  const IKONY = {
    podelne: '<rect width="40" height="30" fill="#ecd9b2"/><rect y="6" width="40" height="4" fill="#6e4b33"/><rect y="16" width="40" height="5" fill="#c47f56"/><rect y="25" width="40" height="3" fill="#6e4b33"/>',
    sachovnice: Array.from({ length: 20 }, (_, i) => `<rect x="${(i % 5) * 8}" y="${Math.floor(i / 5) * 7.5}" width="8" height="7.5" fill="${(i % 5 + Math.floor(i / 5)) % 2 ? '#6e4b33' : '#ecd9b2'}"/>`).join(''),
    cihla: '<rect width="40" height="30" fill="#c47f56"/>' + [0, 1, 2, 3, 4].map((c) => [0, 1, 2].map((r) => `<rect x="${c * 8 + 0.7}" y="${r * 10 + (c % 2) * 5 - 5 + 0.7}" width="6.6" height="8.6" fill="${(r + c) % 2 ? '#6e4b33' : '#ecd9b2'}"/>`).join('')).join(''),
    kostky: (() => { let s = '<rect width="40" height="30" fill="#c47f56"/>'; for (let r = -1; r < 4; r++) for (let c = -1; c < 4; c++) { const cx = c * 13.86 + (r & 1 ? 6.93 : 0), cy = r * 12 + 4; const P = (k) => { const u = (90 + 60 * k) * Math.PI / 180; return [cx + 8 * Math.cos(u), cy - 8 * Math.sin(u)]; }; const f = (a) => a.map((q) => q.join(',')).join(' '); s += `<polygon points="${f([[cx, cy], P(5), P(0), P(1)])}" fill="#ecd9b2"/><polygon points="${f([[cx, cy], P(1), P(2), P(3)])}" fill="#c47f56"/><polygon points="${f([[cx, cy], P(3), P(4), P(5)])}" fill="#6e4b33"/>`; } return s; })(),
    chevron: '<rect width="40" height="30" fill="#ecd9b2"/>' + [0, 1, 2].map((i) => `<path d="M0 ${i * 10 + 2}L10 ${i * 10 - 3}L20 ${i * 10 + 2}L30 ${i * 10 - 3}L40 ${i * 10 + 2}V${i * 10 + 7}L30 ${i * 10 + 2}L20 ${i * 10 + 7}L10 ${i * 10 + 2}L0 ${i * 10 + 7}Z" fill="#6e4b33"/>`).join(''),
    sachy: '<rect width="40" height="30" fill="#c47f56"/>' + Array.from({ length: 16 }, (_, i) => `<rect x="${8 + (i % 4) * 6}" y="${3 + Math.floor(i / 4) * 6}" width="6" height="6" fill="${(i % 4 + Math.floor(i / 4)) % 2 ? '#6e4b33' : '#ecd9b2'}"/>`).join(''),
    vlny: '<rect width="40" height="30" fill="#ecd9b2"/><path d="M0 9Q10 3 20 9T40 9M0 20Q10 14 20 20T40 20" stroke="#6e4b33" stroke-width="1.6" fill="none"/>',
    vkladane: '<rect width="40" height="30" fill="#ecd9b2"/><rect y="12" width="40" height="5" fill="#c47f56"/><path d="M8 30L18 0M20 30L30 0" stroke="#6e4b33" stroke-width="2"/>',
  };

  const PREDVOLBY = [
    ['Čelní šachovnice 400 × 300 × 38 (javor / ořešák)', { vzor: 'sachovnice', delka: 400, sirka: 300, tloustka: 38, bunka: 40, drevA: 'javor', drevB: 'orech' }],
    ['Velké čelní prkénko 500 × 350 × 45, pole 50', { vzor: 'sachovnice', delka: 500, sirka: 350, tloustka: 45, bunka: 50, drevA: 'javor', drevB: 'tresen' }],
    ['Cihlová vazba se spárou (javor / třešeň, spára ořešák)', { vzor: 'cihla', delka: 420, sirka: 300, tloustka: 40, cihlaDelka: 70, cihlaVyska: 35, spara: 6, drevA: 'javor', drevB: 'tresen', drevC: 'orech' }],
    ['3D kostky 400 × 300 × 38 (javor / třešeň / ořešák)', { vzor: 'kostky', delka: 400, sirka: 300, tloustka: 38, kostka: 32, drevA: 'javor', drevB: 'tresen', drevC: 'orech' }],
    ['Podélné pruhy 450 × 250 × 30', { vzor: 'podelne', delka: 450, sirka: 250, tloustka: 30, sekvence: 'A40 B12 A40 C20', opakovat: true }],
    ['Chevron 45° (javor / ořešák)', { vzor: 'chevron', delka: 400, sirka: 300, tloustka: 32, chevronUhel: 45, chevronPruh: 20, chevronSloupec: 50, chevronSled: 'AB' }],
    ['Šachovnice na hru 8 × 8 (pole 45, okraj třešeň, tl. 25)', { vzor: 'sachy', tloustka: 25, sachyPole: 45, sachyOkraj: 30, drevA: 'javor', drevB: 'orech', drevC: 'tresen', drazka: false, nozicky: 4, uchyty: 'zadne', hranaTyp: 'zaobleni', hrana: 2 }],
    ['Servírovací podnos s proužky 500 × 200 × 20', { vzor: 'vkladane', delka: 500, sirka: 200, tloustka: 20, sekvence: 'A50 B10', opakovat: true, vklPocet: 4, vklUhel: 60, vklZilka: 4, drazka: false, uchyty: 'otvor', nozicky: 0, hrana: 2, hranaTyp: 'zaobleni' }],
    ['Vlny – javor s ořešákovými žilkami', { vzor: 'vlny', delka: 420, sirka: 280, tloustka: 30, vlnyPocet: 3, vlnyAmplituda: 14, vlnyDelka: 320, vlnyZilka: 3, drevA: 'javor', drevB: 'orech' }],
  ];

  /* ---------- stav ---------- */
  let p = J.normalizuj({});
  let krokI = 0, rezim3d = 'hotove', v = null;
  try { const s = JSON.parse(localStorage.getItem(KLIC) || 'null'); if (s && s.p) { p = J.normalizuj(s.p); krokI = s.krok | 0; rezim3d = s.rezim3d === 'krok' ? 'krok' : 'hotove'; } } catch (e) { /* bez úložiště */ }
  function uloz() { try { localStorage.setItem(KLIC, JSON.stringify({ p, krok: krokI, rezim3d })); } catch (e) { /* plné / zakázané */ } }

  /* ---------- sestavení ovládání ---------- */
  const typy = $('typy');
  for (const [id, vz] of Object.entries(J.VZORY)) {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.vzor = id;
    b.innerHTML = `<svg viewBox="0 0 40 30">${IKONY[id]}</svg>${esc(vz.nazev)}`;
    b.title = `${vz.nazev} (${vz.en}) – klávesa ${vz.klavesa}`;
    b.addEventListener('click', () => { p.vzor = id; krokI = 0; obnovFormular(); prepocitej(); });
    typy.appendChild(b);
  }
  const moznosti = Object.entries(J.DREVINY).map(([id, d]) => `<option value="${id}">${esc(d.nazev)}${d.vhodnost === 'ok' ? '' : d.vhodnost === 'porezni' ? ' (pórézní)' : d.vhodnost === 'alergen' ? ' (⚠ alergen)' : ' (⚠ měkké)'}</option>`).join('');
  $('sloty').innerHTML = ['A', 'B', 'C'].map((s) => `<div class="slot"><b>${s}</b><span class="vz" id="vz${s}"></span><select id="drev${s}" aria-label="Dřevina ${s}">${moznosti}</select><input id="hustota${s}" type="number" min="0" max="1500" step="5" title="hustota kg/m³ (prázdné = typická)" aria-label="Hustota ${s}"><small id="role${s}"></small></div>`).join('');
  $('rychleDreviny').innerHTML = ['A', 'B', 'C'].map((s) => `<div><label for="r3drev${s}">Dřevina ${s}</label><select id="r3drev${s}">${moznosti}</select></div>`).join('');
  $('predvolba').innerHTML = PREDVOLBY.map((q, i) => `<option value="${i}">${esc(q[0])}</option>`).join('');
  $('princip').innerHTML = P.html();

  const CISLA = ['delka', 'sirka', 'tloustka', 'pocetKusu', 'kerf', 'uberPanel', 'uberFinal', 'orezKonce', 'pridavekPruh', 'prorez', 'rohR', 'hrana', 'drazkaOdstup', 'drazkaSirka', 'drazkaHloubka', 'drazkaR', 'uchytDelka', 'uchytHloubka', 'uchytVyska', 'otvorPrumer', 'nozicky', 'nozickyPrumer', 'nozickyOdstup'];
  for (const k of CISLA) { const [a, b] = J.MEZE[k] || []; const el = $(k); if (a !== undefined) { el.min = a; el.max = b; } el.addEventListener('input', () => { const x = parseFloat(el.value); if (Number.isFinite(x)) { p[k] = x; naplanuj(); } }); el.addEventListener('change', () => { obnovFormular(); }); }
  for (const k of ['hranaTyp', 'uchyty']) $(k).addEventListener('change', () => { p[k] = $(k).value; obnovFormular(); prepocitej(); });
  $('drazka').addEventListener('change', () => { p.drazka = $('drazka').checked; obnovFormular(); prepocitej(); });
  for (const s of ['A', 'B', 'C']) {
    $('drev' + s).addEventListener('change', () => { p['drev' + s] = $('drev' + s).value; obnovFormular(); prepocitej(); });
    $('r3drev' + s).addEventListener('change', () => { p['drev' + s] = $('r3drev' + s).value; obnovFormular(); prepocitej(); });
    $('hustota' + s).addEventListener('input', () => { const x = parseFloat($('hustota' + s).value); p['hustota' + s] = Number.isFinite(x) ? x : 0; naplanuj(); });
  }
  $('btnPromichat').addEventListener('click', () => { p.seed = 1 + Math.floor(Math.random() * 1e6); prepocitej(); });
  $('btnProhodit').addEventListener('click', () => { [p.drevA, p.drevB] = [p.drevB, p.drevA]; [p.hustotaA, p.hustotaB] = [p.hustotaB, p.hustotaA]; obnovFormular(); prepocitej(); });

  function parametryVzoru() {
    const box = $('parVzoru'); box.innerHTML = '';
    for (const [k, pop, typ, mi, ma, kr] of PAR[p.vzor]) {
      if (typ === 'chk') {
        const l = document.createElement('label'); l.className = 'chk'; l.innerHTML = `<input type="checkbox" id="pv_${k}"> ${esc(pop)}`; box.appendChild(l);
        const el = l.querySelector('input'); el.checked = !!p[k]; el.addEventListener('change', () => { p[k] = el.checked; prepocitej(); });
      } else {
        const l = document.createElement('label'); l.htmlFor = 'pv_' + k; l.textContent = pop; box.appendChild(l);
        const el = document.createElement('input'); el.id = 'pv_' + k;
        if (typ === 'num') { el.type = 'number'; el.min = mi; el.max = ma; el.step = kr; el.value = p[k]; el.addEventListener('input', () => { const x = parseFloat(el.value); if (Number.isFinite(x)) { p[k] = x; naplanuj(); } }); }
        else { el.type = 'text'; el.value = p[k]; el.maxLength = 400; el.addEventListener('input', () => { p[k] = el.value; naplanuj(); }); }
        box.appendChild(el);
      }
    }
    const pozn = { podelne: 'Zápis: „A40 B12 C20“ = pruh dřeviny A 40 mm, B 12 mm, C 20 mm; „A40×3“ = třikrát. Pruhy se lepí na hranu (stojaté letokruhy).', sachovnice: 'Počet polí se zaokrouhlí z délky a šířky. Lichý počet řad se řeší posunem plátků a ořezem.', cihla: 'Šířka sloupce = výška panelu po hoblování. Spára vznikne z pruhů C v panelu a z plátků desky C mezi sloupci.', kostky: 'Výška kosočtverce = strana × sin 60°. Délka polena podle počtu kusů – každý plátek je jedno prkénko.', chevron: 'Čistá délka pásu = šířka panelu / sin α − pás × cotg α.', sachy: 'Rozměr = 8 × pole + 2 × okraj (délka a šířka z rozměrů se nepoužije). Okraj je také čelní dřevo – žádné křížení vláken.', vlny: 'Šířka základní desky = šířka − počet × (žilka − řez pily).', vkladane: 'Každý proužek prodlouží desku o (proužek − řez) / sin α.' }[p.vzor];
    if (pozn) { const i = document.createElement('p'); i.className = 'info'; i.textContent = pozn; box.appendChild(i); }
  }
  function obnovFormular() {
    p = J.normalizuj(p);
    for (const b of typy.children) b.setAttribute('aria-pressed', String(b.dataset.vzor === p.vzor));
    for (const k of CISLA) if (document.activeElement !== $(k)) $(k).value = p[k];
    $('hranaTyp').value = p.hranaTyp; $('uchyty').value = p.uchyty; $('drazka').checked = p.drazka;
    $('blokDrazka').classList.toggle('skryte', !p.drazka);
    $('blokUchyty').classList.toggle('skryte', p.uchyty !== 'bocni');
    $('blokOtvor').classList.toggle('skryte', p.uchyty !== 'otvor');
    const role = ROLE[p.vzor];
    for (const s of ['A', 'B', 'C']) {
      $('drev' + s).value = p['drev' + s]; $('r3drev' + s).value = p['drev' + s];
      const D = J.DREVINY[p['drev' + s]];
      $('hustota' + s).value = p['hustota' + s] > 0 ? p['hustota' + s] : ''; $('hustota' + s).placeholder = D.hustota;
      $('vz' + s).style.background = `linear-gradient(90deg, ${D.svetla} 0 55%, ${D.tmava} 55% 70%, ${D.svetla} 70%)`;
      $('role' + s).textContent = (role[s] ? role[s] + ' · ' : 'nepoužito · ') + D.pozn;
      $('r3drev' + s).parentNode.style.opacity = role[s] ? '1' : '.45';
    }
    $('delka').disabled = $('sirka').disabled = p.vzor === 'sachy';
    parametryVzoru();
  }

  /* ---------- výpočet a vykreslení ---------- */
  let casovac = null;
  function naplanuj() { clearTimeout(casovac); casovac = setTimeout(prepocitej, 140); }
  function prepocitej() {
    clearTimeout(casovac);
    try { v = J.spocitej(p); } catch (e) { console.error(e); toast('Výpočet selhal: ' + e.message, true); return; }
    p = v.p;
    krokI = Math.max(0, Math.min(v.kroky.length - 1, krokI));
    kresliKroky(); kresliKrok(); kresliVysledek(); kresliTabulky(); kresliVarovani(); infoListy();
    obnov3d();
    uloz();
  }
  function kresliKroky() {
    const box = $('kroky'); box.innerHTML = '';
    v.kroky.forEach((kr, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('aria-pressed', String(i === krokI));
      b.innerHTML = `<div class="nh">${K.nahledKroku(v, kr)}</div><b>${kr.n}.</b> ${esc(kr.nazev)}`;
      b.addEventListener('click', () => { krokI = i; kresliKrok(); oznacKrok(); if (rezim3d === 'krok') obnov3d(true); uloz(); });
      box.appendChild(b);
    });
  }
  function oznacKrok() { [...$('kroky').children].forEach((b, i) => b.setAttribute('aria-pressed', String(i === krokI))); const b = $('kroky').children[krokI]; if (b && b.scrollIntoView) { const box = $('kroky'); box.scrollLeft = b.offsetLeft - box.clientWidth / 2 + b.clientWidth / 2; } }
  function kresliKrok() {
    const kr = v.kroky[krokI];
    $('krokNazev').textContent = `Krok ${kr.n} / ${v.kroky.length}: ${kr.nazev}`;
    $('krokKresba').innerHTML = K.svg(K.scenaKroku(v, kr, { dokonceni: kr.dokonceni ? v.dokonceni : null, textury: kr.kusy.length < 900 }));
    $('krokText').innerHTML = kr.text.map((t) => `<li>${esc(t)}</li>`).join('');
    $('krokBezp').classList.toggle('skryte', !kr.bezpecnost);
    $('krok3dPopis').textContent = `Krok ${kr.n}`;
  }
  function kresliVysledek() {
    $('nazevVysledku').textContent = v.nazev;
    $('vykres').innerHTML = K.svg(K.scenaHotova(v));
    const r = v.rozmer, m = v.hmotnost;
    const radky = [['Hotový rozměr', `${fmt(r.L)} × ${fmt(r.W)} × ${fmt(r.T)} mm`], ['Hmotnost (typická)', `${fmt(m.kg, 2)} kg`], ['Průměrná hustota', `${fmt(m.hustota, 0)} kg/m³`], ['Objem hotového', `${fmt(m.objem * 1e6, 0)} cm³`], ['Vlákno na ploše', v.cel ? 'čelní (end grain)' : 'podélné (edge / face grain)'], ['Kroků výroby', v.kroky.length], ['Lepení', v.kroky.filter((k) => k.typ === 'lepeni').length + '×'], ...Object.entries(v.info)];
    if (v.dokonceni.drazka) radky.push(['Délka drážky (osa)', fmt(v.dokonceni.drazka.delka, 0) + ' mm']);
    $('udaje').innerHTML = radky.map(([a, b]) => `<div><span>${esc(a)}</span><span>${esc(b)}</span></div>`).join('');
    $('infoRozmer').textContent = `výsledek ${fmt(r.L)} × ${fmt(r.W)} × ${fmt(r.T)} mm`;
  }
  function kresliTabulky() {
    const D = J.DREVINY;
    $('tabRezny').innerHTML = '<tr><th>Poz.</th><th>Díl</th><th>Dřevina</th><th class="c">Ks</th><th class="c">Tl.</th><th class="c">Šířka</th><th class="c">Délka</th><th class="c">dm³</th></tr>' +
      v.rezny.map((q, i) => `<tr><td>${i + 1}</td><td>${esc(q.nazev)}</td><td><span class="sw" style="background:${D[q.drevina].svetla}"></span>${q.slot}: ${esc(D[q.drevina].nazev)}</td><td class="c">${q.ks}</td><td class="c">${fmt(q.tl, 2)}</td><td class="c">${fmt(q.sir, 1)}</td><td class="c">${fmt(q.del, 0)}</td><td class="c">${fmt(q.objem * 1000, 2)}</td></tr>`).join('');
    const M = Object.values(v.material);
    $('tabMaterial').innerHTML = '<tr><th>Poz.</th><th>Dřevina</th><th class="c">Délka lišt m</th><th class="c">Objem dm³</th><th class="c">S prořezem dm³</th><th class="c">Hmotnost kg</th></tr>' +
      M.map((m) => `<tr><td>${m.slot}</td><td>${esc(D[m.drevina].nazev)} <small style="color:var(--text-faint)">(${fmt(J.hustota(p, m.slot), 0)} kg/m³)</small></td><td class="c">${fmt(m.delka, 2)}</td><td class="c">${fmt(m.objem * 1000, 2)}</td><td class="c">${fmt(m.nakup * 1000, 2)}</td><td class="c">${fmt(m.hmotnost, 2)}</td></tr>`).join('') +
      `<tr><th></th><th>Celkem</th><th class="c">${fmt(M.reduce((a, m) => a + m.delka, 0), 2)}</th><th class="c">${fmt(M.reduce((a, m) => a + m.objem, 0) * 1000, 2)}</th><th class="c">${fmt(M.reduce((a, m) => a + m.nakup, 0) * 1000, 2)}</th><th class="c">${fmt(M.reduce((a, m) => a + m.hmotnost, 0), 2)}</th></tr>`;
  }
  function kresliVarovani() { $('varovani').innerHTML = v.varovani.map((q) => `<li class="${q.uroven}">${esc(q.text)}</li>`).join(''); }

  /* ---------- 3D ---------- */
  let S3 = null, nacitani3d = null;
  function nactiSkript(src) { return new Promise((ok, chyba) => { const el = document.createElement('script'); el.src = src; el.onload = ok; el.onerror = () => chyba(new Error('nejde načíst ' + src)); document.head.appendChild(el); }); }
  function nacti3d() {
    if (nacitani3d) return nacitani3d;
    nacitani3d = (async () => {
      if (!window.THREE) await nactiSkript('lib/three.0.160.0.min.js');
      $('stav3d').remove();
      S3 = window.PK3D.vytvor($('obal3d'));
      S3.priZmeneT = (t) => { $('t3d').value = t; };
      S3.priKonci = () => { $('btnAnim').textContent = '▶ Přehrát'; };
      obnov3d(true);
    })().catch((e) => { console.error(e); $('stav3d') && ($('stav3d').textContent = '3D se nepodařilo načíst: ' + e.message); });
    return nacitani3d;
  }
  new IntersectionObserver((z) => { if (z.some((x) => x.isIntersecting)) nacti3d(); }, { rootMargin: '200px' }).observe($('obal3d'));
  let posledni3d = null;
  function obnov3d(vynutit) {
    $('r3hotove').setAttribute('aria-pressed', String(rezim3d === 'hotove'));
    $('r3krok').setAttribute('aria-pressed', String(rezim3d === 'krok'));
    $('ovlKrok').style.visibility = rezim3d === 'krok' ? 'visible' : 'hidden';
    if (!S3 || !v) return;
    const klic = rezim3d + '|' + krokI + '|' + JSON.stringify(p);
    if (!vynutit && klic === posledni3d) return;
    posledni3d = klic;
    if (rezim3d === 'hotove') S3.hotove(v);
    else { const kr = v.kroky[krokI]; S3.krok(v, kr, kr.anim ? 0 : 1); $('t3d').value = kr.anim ? 0 : 1; $('btnAnim').textContent = '▶ Přehrát'; if (kr.anim) setTimeout(() => { if (S3 && rezim3d === 'krok') { S3.prehraj(); $('btnAnim').textContent = '⏸ Pauza'; } }, 350); }
  }
  $('r3hotove').addEventListener('click', () => { rezim3d = 'hotove'; obnov3d(); uloz(); });
  $('r3krok').addEventListener('click', () => { rezim3d = 'krok'; obnov3d(); uloz(); });
  $('btnKrok3d').addEventListener('click', () => { rezim3d = 'krok'; obnov3d(true); uloz(); $('karta3d').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  $('t3d').addEventListener('input', () => { if (S3) { S3.zastav(); S3.nastavT(+$('t3d').value); $('btnAnim').textContent = '▶ Přehrát'; } });
  function prepniAnim() {
    if (!S3) return;
    if (rezim3d !== 'krok') { rezim3d = 'krok'; obnov3d(true); return; }
    if (S3.stav.prehrava) { S3.zastav(); $('btnAnim').textContent = '▶ Přehrát'; } else if (S3.prehraj()) $('btnAnim').textContent = '⏸ Pauza';
  }
  $('btnAnim').addEventListener('click', prepniAnim);
  document.querySelectorAll('[data-pohled]').forEach((b) => b.addEventListener('click', () => S3 && S3.pohled(b.dataset.pohled)));
  $('btnPredchozi').addEventListener('click', () => posunKrok(-1));
  $('btnDalsi').addEventListener('click', () => posunKrok(1));
  function posunKrok(d) { krokI = Math.max(0, Math.min(v.kroky.length - 1, krokI + d)); kresliKrok(); oznacKrok(); if (rezim3d === 'krok') obnov3d(true); uloz(); }

  /* ---------- klávesy ---------- */
  document.addEventListener('keydown', (e) => {
    const t = e.target, pole = t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA');
    if (pole || e.ctrlKey || e.metaKey || e.altKey) return;
    const m = /^(Digit|Numpad)([1-8])$/.exec(e.code);
    if (m) { const id = Object.keys(J.VZORY).find((k) => J.VZORY[k].klavesa === +m[2]); if (id) { p.vzor = id; krokI = 0; obnovFormular(); prepocitej(); e.preventDefault(); } return; }
    if (e.code === 'ArrowLeft') { posunKrok(-1); e.preventDefault(); }
    else if (e.code === 'ArrowRight') { posunKrok(1); e.preventDefault(); }
    else if (e.code === 'Space') { prepniAnim(); e.preventDefault(); }
  });

  /* ---------- záložky ---------- */
  $('zalozky').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    for (const x of $('zalozky').children) x.setAttribute('aria-selected', String(x === b));
    document.querySelectorAll('.panel[data-p]').forEach((x) => { x.hidden = x.dataset.p !== b.dataset.z; });
  });

  /* ---------- soubory ---------- */
  function stahni(blob, jmeno) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = jmeno; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
  const zaklad = () => 'prkenko_' + p.vzor + '_' + Math.round(v.rozmer.L) + 'x' + Math.round(v.rozmer.W) + 'x' + Math.round(v.rozmer.T);
  function papir() {
    const t = $('papir').value;
    if (t === 'a3') return [297, 420];
    if (t === 'letter') return [215.9, 279.4];
    if (t === 'vlastni') return [Math.max(80, +$('papirW').value || 210), Math.max(80, +$('papirH').value || 297)];
    return [210, 297];
  }
  function infoListy() {
    $('blokPapir').classList.toggle('skryte', $('papir').value !== 'vlastni');
    const [pw, ph] = papir(), rv = V.rozvrhListu(V.scenaSablony(v), pw, ph, +$('okraj').value || 10, +$('prekryv').value || 12);
    $('infoListy').innerHTML = `Šablona obrysu 1:1: <b>${rv.listy.length}</b> ${rv.listy.length === 1 ? 'list' : rv.listy.length < 5 ? 'listy' : 'listů'} (${rv.nx} × ${rv.ny}, ${rv.W > rv.H ? 'na šířku' : 'na výšku'}). PDF obsahuje i titulní list s řezným seznamem a každý krok postupu s výkresem.`;
  }
  for (const id of ['papir', 'okraj', 'prekryv', 'papirW', 'papirH']) $(id).addEventListener('input', () => v && infoListy());
  $('btnSvg').addEventListener('click', () => stahni(new Blob([V.svgSablony(v)], { type: 'image/svg+xml' }), zaklad() + '_sablona.svg'));
  $('btnSvgCnc').addEventListener('click', () => stahni(new Blob([V.svgCnc(v)], { type: 'image/svg+xml' }), zaklad() + '_cnc.svg'));
  $('btnDxf').addEventListener('click', () => stahni(new Blob([V.dxf(v)], { type: 'application/dxf' }), zaklad() + '.dxf'));
  $('btnCsv').addEventListener('click', () => {
    const D = J.DREVINY, r = [['poz', 'dil', 'drevina', 'ks', 'tloustka_mm', 'sirka_mm', 'delka_mm', 'objem_dm3']];
    v.rezny.forEach((q, i) => r.push([i + 1, q.nazev, D[q.drevina].nazev, q.ks, q.tl.toFixed(2), q.sir.toFixed(1), q.del.toFixed(0), (q.objem * 1000).toFixed(3)]));
    stahni(new Blob(['﻿' + r.map((x) => x.map((c) => /[;"\n]/.test(String(c)) ? '"' + String(c).replace(/"/g, '""') + '"' : c).join(';')).join('\r\n')], { type: 'text/csv' }), zaklad() + '_rezny_seznam.csv');
  });
  function nactiPismo() {
    if (window.FONTY_JS && window.FONTY_JS['LiberationSans-Regular.ttf']) return Promise.resolve(window.FONTY_JS['LiberationSans-Regular.ttf']);
    return new Promise((ok) => { const s = document.createElement('script'); s.src = 'stitky_panely/fonty/LiberationSans-Regular.ttf.js'; s.onload = () => ok((window.FONTY_JS || {})['LiberationSans-Regular.ttf'] || null); s.onerror = () => ok(null); document.head.appendChild(s); });
  }
  $('btnPdf').addEventListener('click', async () => {
    const b = $('btnPdf'), puv = b.textContent; b.disabled = true; b.textContent = 'Připravuji PDF…';
    try {
      if (!window.jspdf) throw new Error('jsPDF se nenačetl');
      const pismo = await nactiPismo();
      const doc = V.pdf(window.jspdf.jsPDF, v, { papir: papir(), okraj: +$('okraj').value || 10, prekryv: +$('prekryv').value || 12, pismo, texty: P.radky() });
      stahni(doc.output('blob'), zaklad() + '_postup.pdf');
      toast(`PDF: ${doc.getNumberOfPages()} stran. Šablonu tiskněte ve skutečné velikosti (100 %).`);
    } catch (e) { console.error(e); toast('PDF se nepodařilo vytvořit: ' + e.message, true); }
    finally { b.disabled = false; b.textContent = puv; }
  });

  /* ---------- předvolby, projekty, JSON ---------- */
  $('btnPredvolba').addEventListener('click', () => { const q = PREDVOLBY[+$('predvolba').value]; if (!q) return; p = J.normalizuj(Object.assign({}, J.VYCHOZI, q[1])); krokI = 0; obnovFormular(); prepocitej(); toast('Předvolba: ' + q[0]); });
  const projekty = () => { try { return JSON.parse(localStorage.getItem(KLIC_PROJ) || '[]'); } catch (e) { return []; } };
  const ulozProjekty = (L) => { try { localStorage.setItem(KLIC_PROJ, JSON.stringify(L)); return true; } catch (e) { toast('Projekt se nepodařilo uložit (úložiště je plné nebo zakázané).', true); return false; } };
  function kresliProjekty() {
    const L = projekty(), ul = $('projekty');
    ul.innerHTML = L.length ? '' : '<li><span style="color:var(--text-faint)">Zatím žádné uložené projekty.</span></li>';
    L.forEach((q, i) => {
      const li = document.createElement('li');
      li.innerHTML = `<span title="${esc(q.nazev)}">${esc(q.nazev)} <small style="color:var(--text-faint)">${esc(J.VZORY[q.p.vzor] ? J.VZORY[q.p.vzor].nazev : '')}</small></span><button type="button">Načíst</button><button type="button" aria-label="Smazat">✕</button>`;
      li.children[1].addEventListener('click', () => { p = J.normalizuj(q.p); krokI = 0; $('nazevProjektu').value = q.nazev; obnovFormular(); prepocitej(); });
      li.children[2].addEventListener('click', async () => { if (await Dialog.potvrd(`Smazat projekt „${q.nazev}“?`)) { const M = projekty(); M.splice(i, 1); ulozProjekty(M); kresliProjekty(); } });
      ul.appendChild(li);
    });
  }
  $('btnUlozit').addEventListener('click', () => {
    const n = $('nazevProjektu').value.trim() || v.nazev, L = projekty(), i = L.findIndex((q) => q.nazev === n);
    const z = { nazev: n, p, datum: new Date().toISOString() };
    if (i >= 0) L[i] = z; else L.unshift(z);
    if (ulozProjekty(L.slice(0, 50))) { kresliProjekty(); toast('Uloženo: ' + n); }
  });
  $('btnExportJson').addEventListener('click', () => stahni(new Blob([JSON.stringify({ format: 'prkenka', verze: 1, nazev: $('nazevProjektu').value || v.nazev, p }, null, 2)], { type: 'application/json' }), zaklad() + '.json'));
  $('btnImportJson').addEventListener('click', () => $('souborJson').click());
  $('souborJson').addEventListener('change', async () => {
    const f = $('souborJson').files[0]; if (!f) return;
    try { const d = JSON.parse(await f.text()); if (!d || !d.p) throw new Error('soubor neobsahuje návrh prkénka'); p = J.normalizuj(d.p); if (d.nazev) $('nazevProjektu').value = d.nazev; krokI = 0; obnovFormular(); prepocitej(); toast('Načteno: ' + (d.nazev || f.name)); }
    catch (e) { toast('Import selhal: ' + e.message, true); }
    $('souborJson').value = '';
  });
  $('btnReset').addEventListener('click', async () => { if (await Dialog.potvrd('Vrátit všechny parametry na výchozí hodnoty?')) { p = J.normalizuj({}); krokI = 0; obnovFormular(); prepocitej(); } });

  obnovFormular(); kresliProjekty(); prepocitej();
  window.PK_UI = { get v() { return v; }, get p() { return p; }, nastav(o) { p = J.normalizuj(Object.assign({}, p, o)); obnovFormular(); prepocitej(); }, krok(i) { krokI = i; kresliKrok(); oznacKrok(); if (rezim3d === 'krok') obnov3d(true); }, rezim(r) { rezim3d = r; obnov3d(true); }, get S3() { return S3; } };
})();

/* Brýlové obroučky – ovládání stránky: formulář, historie, manifold, písmo rytiny, přepočet, výsledky, kontroly, export. */
/* global BRYLE, BRYLE_GEOM, BRYLE_NAHLED, KRAB, Dialog, Tvary, TrubkyGui, FONTY */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const B = BRYLE, fmt = B.fmt;
  const KLIC = 'webapp_bryle_projekt';
  const BARVY = { predni: '#3B6FC9', stranice: '#5585D6', cocka: '#9CC9E6' };

  /* ---------- stav a historie ---------- */
  let p, wasm = null, model = null, chybaStavby = null;
  const zpet = [], znovu = [];
  function hlasPrevod(hl, co) { if (hl && hl.length) setTimeout(() => Dialog.info(`${co} upraven: ${hl.join('; ')}.`), 300); }
  function nactiUlozeny() {
    try {
      const t = localStorage.getItem(KLIC);
      if (t) { const r = B.normalizuj(JSON.parse(t)); hlasPrevod(r.hlaseni, 'Uložený projekt'); return r.p; }
    } catch (e) { /* poškozený záznam */ }
    return B.zPredvolby(0);
  }
  function uloz() { try { localStorage.setItem(KLIC, JSON.stringify(p)); } catch (e) { /* plné úložiště */ } }
  function zmen(fn, slouceni) {
    const pred = JSON.stringify(p);
    fn(p);
    p = B.normalizuj(p).p;
    if (JSON.stringify(p) === pred) return;
    const posl = zpet[zpet.length - 1];
    if (!(slouceni && posl && posl.klic === slouceni && Date.now() - posl.cas < 1200)) zpet.push({ stav: pred, klic: slouceni, cas: Date.now() });
    else posl.cas = Date.now();
    if (zpet.length > 100) zpet.shift();
    znovu.length = 0;
    po();
  }
  function krokHistorie(z, do_) {
    if (!z.length) return;
    do_.push({ stav: JSON.stringify(p), cas: 0 });
    p = B.normalizuj(JSON.parse(z.pop().stav)).p;
    naplnFormular(); po();
  }
  function po() {
    $('btnZpet').disabled = !zpet.length; $('btnZnovu').disabled = !znovu.length;
    uloz(); viditelnost(); naplanuj();
  }
  function nahrad(q) { zmen(x => { Object.keys(x).forEach(k => delete x[k]); Object.assign(x, q); }); naplnFormular(); }

  /* ---------- formulář ---------- */
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const opt = (sel, obj, f) => { $(sel).innerHTML = Object.entries(obj).map(([k, v]) => `<option value="${k}">${esc(f(k, v))}</option>`).join(''); };
  opt('f_profil', B.PROFILY_DRAZKY, (k, v) => v);
  opt('f_pant', B.PANTY, (k, v) => v);
  opt('f_cep', B.CEPY, (k, v) => v.nazev);
  opt('f_tkde', B.KDE_TEXT, (k, v) => v);
  opt('f_mat', B.MATERIALY, (k, v) => `${v.nazev} – ${fmt(v.hustota, 2)} g/cm³`);
  $('segTvar').innerHTML = Object.entries(B.TVARY).map(([k, t]) => `<button type="button" data-tvar-volba="${k}"><span>${t.znak}</span>${esc(t.nazev.replace(' (kapka)', ''))}</button>`).join('');
  document.querySelectorAll('[data-tvar-volba]').forEach(b => b.addEventListener('click', () => { zmen(x => { x.ocnice.tvar = b.dataset.tvarVolba; }); naplnFormular(); }));
  const pole = [...document.querySelectorAll('[data-p]')];
  function naplnFormular() {
    for (const el of pole) {
      const h = B.vezmi(p, el.dataset.p);
      if (el.type === 'checkbox') el.checked = !!h;
      else if (document.activeElement !== el) el.value = el.dataset.typ === 'text' ? (h ?? '') : String(h).replace('.', ',');
      el.classList.remove('spatne');
    }
    viditelnost();
  }
  for (const el of pole) {
    const akce = () => {
      const c = el.dataset.p;
      let h;
      if (el.type === 'checkbox') h = el.checked;
      else if (el.dataset.typ === 'text') h = el.value;
      else {
        h = B.cislo(el.value, NaN);
        el.classList.toggle('spatne', !Number.isFinite(h));
        if (!Number.isFinite(h)) return;
      }
      zmen(x => B.poloz(x, c, h), c);
    };
    el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', akce);
    if (el.tagName === 'INPUT' && el.type === 'text' && el.dataset.typ !== 'text') {
      el.addEventListener('change', () => {
        const psano = B.cislo(el.value, NaN), h = B.vezmi(p, el.dataset.p), roz = B.ROZSAHY[el.dataset.p];
        el.value = String(h).replace('.', ',');
        if (roz && Number.isFinite(psano) && Math.abs(psano - h) > 1e-9) {
          el.classList.remove('zvyrazni'); void el.offsetWidth; el.classList.add('zvyrazni');
          Dialog.info(`${el.labels[0] ? el.labels[0].textContent.trim() : 'Hodnota'}: omezeno na ${fmt(roz[0], 2)}–${fmt(roz[1], 2)}, použito ${fmt(h, 2)}.`);
        }
      });
      // ↑/↓ ± 1, Shift × 10, Alt po 0,1
      el.addEventListener('keydown', e => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        const h = B.cislo(el.value, NaN); if (!Number.isFinite(h)) return;
        e.preventDefault();
        const krok = (e.shiftKey ? 10 : e.altKey ? 0.1 : 1) * (e.key === 'ArrowUp' ? 1 : -1);
        el.value = fmt(Math.round((h + krok) * 1000) / 1000, 3);
        el.dispatchEvent(new Event('input'));
      });
    }
  }

  /** Ukáže jen pole, která pro zvolený tvar / drážku / pant dávají smysl. */
  function viditelnost() {
    const t = B.TVARY[p.ocnice.tvar];
    for (const el of document.querySelectorAll('[data-tvarpole]')) el.hidden = !t.pole.includes(el.dataset.tvarpole);
    for (const el of document.querySelectorAll('[data-ne-tvar]')) el.hidden = el.dataset.neTvar === p.ocnice.tvar;
    for (const el of document.querySelectorAll('[data-pant]')) el.hidden = el.dataset.pant !== p.pant.druh;
    for (const el of document.querySelectorAll('[data-cocky]')) el.hidden = !p.cocky.zapnuto;
    for (const el of document.querySelectorAll('[data-text]')) el.hidden = !p.text.zapnuto;
    document.querySelectorAll('[data-tvar-volba]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tvarVolba === p.ocnice.tvar)));
    const falc = p.drazka.profil === 'falc';
    $('lDsir').textContent = falc ? 'Hloubka polodrážky' : 'Šířka drážky';
    $('lDhl').textContent = falc ? 'Přesah obruby' : 'Hloubka drážky';
    $('pDrazka').textContent = { V: 'Sklo s fazetou se zacvakne do V drážky; pro brýlová skla obvykle šířka 2 mm a hloubka 1 mm (ověřte u optika).',
      U: 'Ploché sklo nebo zkušební čočka tloušťky ≈ šířky drážky. Čočka má po obvodu stejný profil zmenšený o vůli.',
      falc: 'Sklo / plexi se vloží zezadu do polodrážky a přilepí; obruba ho zepředu přesahuje o zadaný přesah.' }[p.drazka.profil];
  }

  /* ---------- manifold a písmo ---------- */
  function nactiSkript(src) {
    return new Promise((ok, ko) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => ko(new Error('nenačteno ' + src)); document.head.appendChild(s); });
  }
  async function nactiManifold() {
    globalThis.MANIFOLD_URL = new URL('lib/manifold/manifold.klasicky.js', location.href).href;
    if (!globalThis.ManifoldModule) await nactiSkript('lib/manifold/manifold.klasicky.js');
    let volby;
    if (location.protocol === 'file:') {
      await nactiSkript('lib/manifold/manifold.wasm.js');
      const s = atob(globalThis.MANIFOLD_WASM_B64), bin = new Uint8Array(s.length);
      for (let i = 0; i < s.length; i++) bin[i] = s.charCodeAt(i);
      delete globalThis.MANIFOLD_WASM_B64;
      volby = { wasmBinary: bin };
    } else volby = { locateFile: f => new URL('lib/manifold/' + f, location.href).href };
    const w = await globalThis.ManifoldModule(volby);
    w.setup();
    return w;
  }
  // písmo rytiny se načte až při prvním zapnutí textu
  let font = null, nacitaniPisma = null, chybaPisma = null, pismoCache = { text: null, data: null };
  function pripravPismo() {
    if (font || nacitaniPisma) return;
    nacitaniPisma = (async () => {
      if (!window.opentype) await nactiSkript('lib/opentype.min.js');
      if (typeof FONTY === 'undefined') await nactiSkript('fonty/fonty.js');   // const FONTY – není na window
      if (!window.KLIC) await nactiSkript('klicenky/jadro.js');
      font = await FONTY.opentype('libsans');
    })().then(() => { chybaPisma = null; naplanuj(); }, e => { chybaPisma = 'Písmo rytiny se nenačetlo: ' + (e && e.message || e); naplanuj(); });   // jen jeden pokus
  }
  function pismo(o) {
    if (!p.text.zapnuto || !font) return null;
    if (pismoCache.text !== o.text) pismoCache = { text: o.text, data: window.KLIC.rozvrhniText(font, o.text) };
    return pismoCache.data;
  }

  /* ---------- přepočet ---------- */
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const nahled = BRYLE_NAHLED.vytvorNahled($('platno'));
  let casovac = null;
  function naplanuj() { clearTimeout(casovac); casovac = setTimeout(prepocitej, 60); }
  function prepocitej() {
    nahled.barvy(css('--border-strong'), css('--border'), css('--text'));
    const o = B.odvozene(p);
    let H = B.kontroly(p, o);
    model = null; chybaStavby = null;
    const st = $('stav3d');
    if (p.text.zapnuto) {
      pripravPismo();
      if (chybaPisma) H.push({ uroven: 'varovani', text: chybaPisma + ' – stranice jsou bez rytiny.', pole: ['text.zapnuto'] });
      else if (!font) H.push({ uroven: 'info', text: 'Načítám písmo rytiny…', pole: [] });
    }
    if (!wasm) { vypis(H, o); return; }
    try {
      const t0 = performance.now();
      const r = BRYLE_GEOM.postav(wasm, p, o, pismo(o));
      const tisknout = r.dily.filter(d => !d.duch);
      for (const d of tisknout) {
        d.rozbor = B.rozborTisku(d, d.role, p);
        const tp = B.tiskovaPoloha(d, d.rozbor.vybrana.R);
        d.tiskPoz = tp.poz; d.ks = KRAB.kontrolaSite(tp.poz, d.idx);
        d.tisk = { poz: null, tridy: B.previsy(tp.poz, d.idx, p.tisk.previs).tridy };
      }
      const roz = B.rozlozNaPodlozku(tisknout.map(d => ({ poz: d.tiskPoz })));
      tisknout.forEach((d, i) => { d.tisk.poz = roz.dily[i].poz; });
      model = { dily: r.dily, tisknout, podlozka: roz, o, cas: performance.now() - t0, klic: p.pant.druh };
      for (const role of ['predni', 'stranice', 'cocka']) {
        const d = tisknout.find(x => x.role === role);
        if (d) H = H.concat(B.kontrolyTisku(role === 'cocka' ? 'Zkušební čočka' : role === 'stranice' ? 'Stranice' : d.nazev, role, d.rozbor, d.plocha));
      }
      H = H.concat(r.upozorneni);
      if (roz.sirka > 250 || roz.hloubka > 250) H.push({ uroven: 'info', text: `Díly zaberou ${fmt(roz.sirka, 0)} × ${fmt(roz.hloubka, 0)} mm – na menší podložku je tiskněte zvlášť (Soubor → STL jednotlivě).`, pole: [] });
      for (const d of tisknout) if (!d.ks.uzavrena) H.push({ uroven: 'chyba', text: `${d.nazev}: síť není uzavřená – export by nemusel jít vytisknout.`, pole: [] });
      for (const d of tisknout) if (d.teles > 1) H.push({ uroven: 'chyba', text: `${d.nazev} se rozpadl na ${d.teles} kusy – zkontrolujte most a koncovky.`, pole: ['most.vyska', 'most.tloustka'] });
    } catch (e) {
      chybaStavby = 'Obroučku nejde sestavit: ' + (e && e.message || e);
      H.push({ uroven: 'chyba', text: chybaStavby, pole: [] });
    }
    st.textContent = chybaStavby || ''; st.classList.toggle('chyba', !!chybaStavby);
    nahled.nastav(model);
    vypis(H, o);
  }

  /* ---------- výpisy ---------- */
  const dl = (popis, cislo, dalsi = '', tr = '') => `<div class="dlazdice"><div class="popis">${popis}</div><div class="cislo ${tr}">${cislo}</div>${dalsi ? `<div class="dalsi">${dalsi}</div>` : ''}</div>`;
  const cas = m => (m < 90 ? fmt(m, 0) + ' min' : fmt(m / 60, 1) + ' h');
  const rozmery = b => `${fmt(b[3] - b[0])} × ${fmt(b[4] - b[1])} × ${fmt(b[5] - b[2])}`;
  function souhrnTisku() {
    const m = model; if (!m) return null;
    let g = 0, min = 0, metru = 0, objem = 0, podpory = false;
    for (const d of m.tisknout) {
      const b = d.ks.bbox, odh = B.odhadTisku(d.objem, d.plocha, b[5] - b[2], p);
      Object.assign(d, { odhad: odh, podpory: B.potrebujePodpory(d.rozbor.vybrana, d.plocha) });
      g += odh.gramy; min += odh.minut; metru += odh.metru; objem += d.objem; podpory = podpory || d.podpory;
    }
    return { g, min, metru, objem, podpory };
  }
  function vypis(H, o) {
    const m = model, s = souhrnTisku(), mat = B.MATERIALY[p.tisk.material];
    let v = '';
    if (m) {
      const pr = m.dily[0], bb = KRAB.kontrolaSite(pr.poz, pr.idx).bbox;
      v += dl('Celková šířka', `${fmt(o.sirkaPredni)} mm`, `mezi stranicemi ${fmt(o.vnitrniSirka)} mm`);
      v += dl('Přední díl', `${fmt(bb[3] - bb[0])} × ${fmt(bb[4] - bb[1])} mm`, `hloubka ${fmt(bb[5] - bb[2])} mm${o.R ? `, obtékání ${fmt(p.predni.wrap)}°` : ''}`);
      v += dl('Hmotnost', `≈ ${fmt(s.g, 1)} g`, `${mat.nazev}, výplň ${fmt(p.tisk.vypln, 0)} %, ${fmt(s.metru, 2)} m filamentu 1,75`);
      v += dl('Doba tisku', `≈ ${cas(s.min)}`, `všechny díly, hrubý odhad (vrstva 0,2 mm)`);
      v += dl('Pant', p.pant.druh === 'cep' ? `čep Ø ${fmt(2 * o.rP, 2)} mm` : 'vcelku', p.pant.druh === 'cep' ? `${o.cep.nazev}; stěna oka ${fmt(o.stenaOka, 2)} mm, oka ${fmt(o.k, 2)} mm` : 'stranice napevno');
      v += dl('Tisk', s.podpory ? 's podporami' : 'bez podpor', m.tisknout.filter(d => d.role !== 'cocka').map(d => `${d.nazev}: ${d.rozbor.vybrana.nazev}`).filter((x, i, a) => a.indexOf(x) === i).slice(0, 2).join('; '), s.podpory ? 'mez-t' : 'ok-t');
    } else v = dl('Model', wasm ? 'nesestaven' : 'načítám…', chybaStavby || '');
    $('vVysledky').innerHTML = v;
    $('sVysledky').textContent = m ? `${fmt(s.g, 1)} g` : '';
    // optické míry
    const r = (a, b, c = '') => `<tr><td>${a}</td><td class="c">${b}</td><td>${c}</td></tr>`;
    $('tabOptika').innerHTML = '<tr><th>Míra</th><th class="c">Hodnota</th><th>Poznámka</th></tr>'
      + r('Označení', esc(o.oznaceni), 'A□DBL-délka stranice, jak se píše na stranici')
      + r('A – šířka skla', `${fmt(o.A)} mm`, 'boxing, dno drážky')
      + r('B – výška skla', `${fmt(o.B)} mm`)
      + r('DBL – most', `${fmt(o.dbl)} mm`)
      + r('Geometrická vzdálenost středů', `${fmt(o.gcd)} mm`, 'A + DBL (rámečkové PD)')
      + r('ED – efektivní průměr', `${fmt(o.ED)} mm`, '2 × nejdelší vzdálenost obrysu od středu')
      + r('Otvor (světlost)', `${fmt(o.A - 2 * o.hd)} × ${fmt(o.B - 2 * o.hd)} mm`, 'viditelný otvor zepředu')
      + (p.opt.pd > 0 ? r('Decentrace', `${fmt(o.decentrace, 1)} mm`, `na oko, PD ${fmt(p.opt.pd)} mm`) + r('Polotovar skla', `≥ Ø ${fmt(Math.ceil(o.mbs))} mm`, 'ED + 2 × decentrace + 2 mm') : '')
      + r('Délka stranice', `${fmt(p.stranice.delka)} mm`, `rovně ${fmt(o.L1)} + koncovka ${fmt(o.Lk)} mm, ohyb ${fmt(p.stranice.ohyb)}°`)
      + r('Pantoskopický sklon', `${fmt(p.stranice.panto)}°`)
      + r('Obtékání', `${fmt(p.predni.wrap)}°`, o.R ? `poloměr ohybu ${fmt(o.R, 0)} mm` : 'rovný přední díl');
    // tisk: díly a orientace
    const selP = $('f_orP'), selS = $('f_orS');
    const naplnSel = (sel, role) => {
      const d = m && m.tisknout.find(x => x.role === role);
      sel.innerHTML = '<option value="auto">automaticky – nejlepší</option>' + (d ? d.rozbor.kandidati.map(k => `<option value="${k.klic}">${esc(k.nazev)}</option>`).join('') : '');
      sel.value = d && d.rozbor.kandidati.some(k => k.klic === p.tisk.orientace[role]) ? p.tisk.orientace[role] : 'auto';
    };
    naplnSel(selP, 'predni'); naplnSel(selS, 'stranice');
    $('tabDily').innerHTML = m ? '<table class="tabulka"><tr><th>Díl</th><th class="c">Rozměry tisku</th><th class="c">Hmotnost</th><th class="c">Čas</th><th>Podpory</th></tr>'
      + m.tisknout.map(d => `<tr><td>${esc(d.nazev)}</td><td class="c">${rozmery(d.ks.bbox)} mm</td><td class="c">${fmt(d.odhad.gramy, 1)} g</td><td class="c">${cas(d.odhad.minut)}</td><td class="${d.podpory ? 'mez-t' : 'ok-t'}">${d.podpory ? 'ano' : 'ne'}</td></tr>`).join('')
      + `<tr><td><b>Podložka</b></td><td class="c">${fmt(m.podlozka.sirka, 0)} × ${fmt(m.podlozka.hloubka, 0)} mm</td><td class="c"><b>${fmt(s.g, 1)} g</b></td><td class="c">${cas(s.min)}</td><td></td></tr></table>` : '';
    $('tabOrientace').innerHTML = m ? ['predni', 'stranice'].map(role => {
      const d = m.tisknout.find(x => x.role === role); if (!d) return '';
      const rb = d.rozbor;
      return `<div class="tab-nadpis">${role === 'predni' ? esc(d.nazev) : 'Stranice'}</div><table class="tabulka"><tr><th>Poloha</th><th class="c">Bez opory</th><th class="c">Mosty</th><th class="c">Podložka</th><th class="c">Výška</th></tr>`
        + rb.kandidati.map(k => `<tr class="klik${k === rb.vybrana ? ' vybrana' : ''}" data-role="${role}" data-klic="${k.klic}" tabindex="0"><td>${k === rb.nejlepsi ? '★ ' : ''}${esc(k.nazev)}</td><td class="c">${fmt(k.volne, 0)} mm²</td><td class="c">${fmt(k.most, 0)} mm²</td><td class="c">${fmt(k.podlozka, 0)} mm²</td><td class="c">${fmt(k.vyska)} mm</td></tr>`).join('') + '</table>';
    }).join('') : '';
    $('sTisk').textContent = m ? (s.podpory ? 's podporami' : 'bez podpor') : '';
    $('pMaterial').textContent = B.MATERIALY[p.tisk.material].pozn;
    // síť
    $('vSit').innerHTML = m ? m.tisknout.map(d => dl(esc(d.nazev), d.ks.uzavrena ? '✔ uzavřená' : '✖ otevřená', `${d.ks.trojuhelniku} trojúhelníků, rod ${d.rod}`, d.ks.uzavrena ? 'ok-t' : 'chyba-t')).join('')
      + dl('Výpočet', `${fmt(m.cas, 0)} ms`, 'stavba + rozbor tisku') : '';
    // karta v rohu
    $('karta3d').innerHTML = m ? `<div class="titul">${esc(B.TVARY[p.ocnice.tvar].nazev)}</div><b>${esc(o.oznaceni)}</b> · šířka <b>${fmt(o.sirkaPredni, 0)}</b> mm<br>`
      + `<b>${fmt(s.g, 1)}</b> g ${mat.nazev} · ${s.podpory ? '<b>s podporami</b>' : 'bez podpor'}` : '';
    $('legenda3d').hidden = !(m && nahled.stav.tisk && nahled.stav.previsy);
    // souhrny oddílů
    TrubkyGui.souhrn('sOcnice', `${fmt(o.A)} × ${fmt(o.B)}`);
    TrubkyGui.souhrn('sMost', `DBL ${fmt(o.dbl)}`);
    TrubkyGui.souhrn('sOpt', p.opt.pd > 0 || p.opt.hlava > 0 ? [p.opt.pd > 0 ? `PD ${fmt(p.opt.pd)}` : '', p.opt.hlava > 0 ? `hlava ${fmt(p.opt.hlava)}` : ''].filter(Boolean).join(', ') : 'nezadáno', p.opt.pd > 0 || p.opt.hlava > 0);
    TrubkyGui.souhrn('sRamecek', `obruba ${fmt(p.predni.obruba)}, ${fmt(o.sirkaPredni, 0)} mm`);
    TrubkyGui.souhrn('sDrazka', p.drazka.profil === 'falc' ? 'polodrážka' : `${p.drazka.profil} ${fmt(o.w)} × ${fmt(o.hd)}`, p.cocky.zapnuto);
    TrubkyGui.souhrn('sPant', p.pant.druh === 'cep' ? o.cep.nazev : 'vcelku');
    TrubkyGui.souhrn('sStranice', `${fmt(p.stranice.delka)} mm`);
    TrubkyGui.souhrn('sText', p.text.zapnuto ? o.text : 'vypnuto', p.text.zapnuto);
    // hlášení
    if (!wasm && !chybaStavby) H = H.concat([{ uroven: 'info', text: 'Načítám geometrické jádro (manifold-3d)…', pole: [] }]);
    const ul = $('hlaseni'); ul.innerHTML = '';
    for (const x of H) {
      const li = document.createElement('li'); li.className = x.uroven + (x.pole.length ? ' skok' : '');
      li.textContent = x.text;
      if (x.pole.length) {
        li.tabIndex = 0;
        const kam = document.createElement('span'); kam.className = 'kam'; kam.textContent = '→ upravit'; li.appendChild(kam);
        li.addEventListener('click', e => { if (e.target.tagName !== 'BUTTON') jdiNaPole(x.pole[0]); });
        li.addEventListener('keydown', e => { if (e.key === 'Enter') jdiNaPole(x.pole[0]); });
      }
      if (x.oprava) {
        const b = document.createElement('button'); b.className = 'tl oprava'; b.textContent = '🔧 ' + x.oprava.text;
        b.addEventListener('click', () => { zmen(q2 => B.poloz(q2, x.oprava.pole, x.oprava.hodnota)); naplnFormular(); });
        li.appendChild(b);
      }
      ul.appendChild(li);
    }
    const nch = H.filter(x => x.uroven === 'chyba').length, nv = H.filter(x => x.uroven === 'varovani').length;
    const od = $('stavOdznak');
    od.className = 'odznak ' + (nch ? 'chyba' : nv ? 'mez' : 'ok');
    od.textContent = nch ? `✖ ${nch}` : nv ? `⚠ ${nv}` : '✔';
    $('sKontrola').textContent = nch ? `${nch} ${nch === 1 ? 'chyba' : nch < 5 ? 'chyby' : 'chyb'}` : nv ? `${nv} varování` : 'v pořádku';
    const boxy = { boxOcnice: false, boxRamecek: false };
    for (const x of H) if (x.uroven === 'chyba') for (const c of x.pole) {
      const el = document.querySelector(`[data-p="${c}"]`), bx = el && el.closest('[data-box]');
      if (bx && bx.id in boxy) boxy[bx.id] = true;
    }
    for (const [id, a] of Object.entries(boxy)) TrubkyGui.oznacChybu(id, a);
  }
  function jdiNaPole(cesta) {
    if (cesta === 'tisk.orientace') cesta = 'tisk.orientace.predni';
    const el = [...document.querySelectorAll(`[data-p="${cesta}"]`)].find(e => !e.closest('[hidden]')) || document.querySelector(`[data-p="${cesta}"]`);
    if (!el) return;
    const det = el.closest('details'); if (det) det.open = true;
    const tel = el.closest('.zalozka-telo'); if (tel) TrubkyGui.otevriZalozku(tel.dataset.telo);
    const bx = el.closest('[data-box]'); TrubkyGui.ukazBox(bx ? bx.dataset.box : 'obecne');
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.focus({ preventScroll: true });
    el.classList.remove('zvyrazni'); void el.offsetWidth; el.classList.add('zvyrazni');
  }
  $('tabOrientace').addEventListener('click', e => {
    const tr = e.target.closest('tr[data-klic]'); if (!tr) return;
    zmen(x => { x.tisk.orientace[tr.dataset.role] = tr.dataset.klic; }); naplnFormular();
  });
  $('tabOrientace').addEventListener('keydown', e => { if (e.key === 'Enter') e.target.click(); });

  /* ---------- nabídky, export ---------- */
  TrubkyGui.pripoj({ klic: 'webapp_bryle_gui', pohled: j => nahled.pohled(j) });
  const seznam = $('seznamPredvoleb');
  B.PREDVOLBY.forEach((v, i) => {
    const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
    b.innerHTML = `${esc(v.nazev)}<span class="pozn">${esc(v.popis)}</span>`;
    b.addEventListener('click', () => nahrad(B.zPredvolby(i)));
    seznam.appendChild(b);
  });
  const jmenoSouboru = pripona => ((p.nazev || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w-]+/g, '_').replace(/^_|_$/g, '') || 'bryle') + pripona;
  function stahni(data, nazev, typ) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type: typ }));
    a.download = nazev; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  /** Díly k exportu (filtr podle role) rozložené na podložce. */
  function kusy(role) {
    if (!model) { Dialog.chyba(chybaStavby || (wasm ? 'Model nelze sestavit – viz záložka Kontrola.' : 'Geometrické jádro se ještě načítá.')); return null; }
    const vyber = model.tisknout.filter(d => !role || d.role === role);
    if (!vyber.length) { Dialog.info(role === 'cocka' ? 'Zkušební čočky nejsou zapnuté (Rámeček → Drážka pro sklo).' : 'Tento díl v projektu není.'); return null; }
    const roz = B.rozlozNaPodlozku(vyber.map(d => ({ poz: d.tiskPoz })));
    return vyber.map((d, i) => ({ jmeno: d.jmeno, nazev: `${p.nazev || 'Brýle'} – ${d.nazev}`, poz: roz.dily[i].poz, idx: d.idx, barva: BARVY[d.role] }));
  }
  function exportStl(role, pripona) { const k = kusy(role); if (k) stahni(KRAB.stlBinarni(k, 'bryle - github_site'), jmenoSouboru(pripona), 'model/stl'); }
  $('btnStl').addEventListener('click', () => exportStl(null, '.stl'));
  $('btnStlPredni').addEventListener('click', () => exportStl('predni', '_predni.stl'));
  $('btnStlStranice').addEventListener('click', () => exportStl('stranice', '_stranice.stl'));
  $('btnStlCocky').addEventListener('click', () => exportStl('cocka', '_cocky.stl'));
  $('btn3mf').addEventListener('click', () => { const k = kusy(null); if (k) stahni(KRAB.soubor3mf(k, p.nazev || 'Brýle'), jmenoSouboru('.3mf'), 'model/3mf'); });
  $('btnPng').addEventListener('click', () => { fetch(nahled.png()).then(r => r.blob()).then(b => stahni(b, jmenoSouboru('.png'))); });
  $('btnUlozit').addEventListener('click', () => stahni(B.ulozProjekt(p), jmenoSouboru('.json'), 'application/json'));
  $('btnNacist').addEventListener('click', () => $('soubor').click());
  $('soubor').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try { const r = B.nactiProjekt(await f.text()); nahrad(r.p); hlasPrevod(r.hlaseni, 'Načtený projekt'); }
    catch (err) { Dialog.chyba(err.message); }
  });
  $('btnVychozi').addEventListener('click', async () => {
    if (await Dialog.potvrd('Vrátit všechny hodnoty na výchozí (první předvolba)?')) nahrad(B.zPredvolby(0));
  });
  $('btnZpet').addEventListener('click', () => krokHistorie(zpet, znovu));
  $('btnZnovu').addEventListener('click', () => krokHistorie(znovu, zpet));
  function prepinac(id, co) {
    const b = $(id);
    b.addEventListener('click', () => {
      const h = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', String(h)); nahled.prepni(co, h);
      $('legenda3d').hidden = !(model && nahled.stav.tisk && nahled.stav.previsy);
    });
  }
  prepinac('tSkla', 'skla'); prepinac('tHrany', 'hrany'); prepinac('tTisk', 'tisk'); prepinac('tPrevisy', 'previsy');
  $('stavOdznak').addEventListener('click', () => TrubkyGui.otevriZalozku('kontrola'));
  $('btnZavritNap').addEventListener('click', () => $('napoveda').close());
  document.addEventListener('keydown', e => {
    const a = document.activeElement;
    const vPoli = a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || (a.tagName === 'INPUT' && !/checkbox|range|radio|button/.test(a.type));
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && !vPoli && k === 'z') { e.preventDefault(); krokHistorie(e.shiftKey ? znovu : zpet, e.shiftKey ? zpet : znovu); return; }
    if ((e.ctrlKey || e.metaKey) && !vPoli && k === 'y') { e.preventDefault(); krokHistorie(znovu, zpet); return; }
    if ((e.ctrlKey || e.metaKey) && k === 's') { e.preventDefault(); exportStl(null, '.stl'); return; }
    if (e.key === 'F1') { e.preventDefault(); $('napoveda').showModal(); return; }
    if (vPoli || e.ctrlKey || e.metaKey || e.altKey || $('napoveda').open) return;
    const pohl = { 1: 'iso', 2: 'zepredu', 3: 'shora', 4: 'zboku' }[k];
    if (pohl) nahled.pohled(pohl);
    else if (k === 'm') $('tTisk').click(); else if (k === 's') $('tSkla').click(); else if (k === 'v') $('tPrevisy').click(); else if (k === 'h') $('tHrany').click();
  });
  new MutationObserver(() => naplanuj()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  if (typeof Tvary !== 'undefined') Tvary.pripoj({
    klic: 'webapp_bryle_tvary', typ: 'bryle', nazev: 'Obroučky', kontejner: $('tvary'),
    parametry: () => B.kopie(p),
    pouzij: q => { const n = B.normalizuj(q); hlasPrevod(n.hlaseni, 'Uložená obroučka'); nahrad(n.p); },
    popis: q => `${q.nazev || 'Brýle'} – ${B.popis(B.normalizuj(q).p)}`,
  });

  /* ---------- start ---------- */
  p = nactiUlozeny();
  naplnFormular();
  prepocitej();
  nactiManifold().then(w => { wasm = w; $('stav3d').textContent = ''; prepocitej(); }).catch(e => {
    chybaStavby = 'Geometrické jádro (manifold-3d) se nenačetlo: ' + (e && e.message || e) + ' – model ani export nejsou k dispozici.';
    const st = $('stav3d'); st.textContent = chybaStavby; st.classList.add('chyba');
    vypis(B.kontroly(p, B.odvozene(p)).concat([{ uroven: 'chyba', text: chybaStavby, pole: [] }]), B.odvozene(p));
  });
  window.BRYLE_UI = { get p() { return p; }, get model() { return model; }, nahled, zmen, naplnFormular, prepocitej, nahrad };
})();

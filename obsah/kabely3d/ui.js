/* Kabelové průchodky a organizéry – ovládání stránky: formulář, typy, předvolby, přepočet, náhled, kontroly, export. */
/* global KAB, KAB_GEOM, KAB_NAHLED, KRAB, Dialog, Tvary, TrubkyGui */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const KLIC = 'webapp_kabely3d_projekt';
  const fmt = KAB.fmt;

  let p, model = null, chybaStavby = null, wasm = null, H = [], tiskova = false;

  /* ---------- stav ---------- */
  function nactiUlozeny() {
    try {
      const t = localStorage.getItem(KLIC);
      if (t) return KAB.normalizuj(JSON.parse(t)).p;
    } catch (e) { /* poškozený záznam */ }
    return KAB.normalizuj(KAB.vychoziProjekt(0)).p;
  }
  function uloz() { try { localStorage.setItem(KLIC, JSON.stringify(p)); } catch (e) { /* plné úložiště */ } }
  function zmen(fn) {
    const pred = JSON.stringify(p);
    fn(p);
    p = KAB.normalizuj(p).p;
    if (JSON.stringify(p) === pred) return;
    uloz(); prepocitej();
  }
  function hlasPrevod(hlaseni, co) { if (hlaseni && hlaseni.length) setTimeout(() => Dialog.info(`${co} upraven: ${hlaseni.join('; ')}.`), 300); }

  /* ---------- formulář ---------- */
  const pole = [...document.querySelectorAll('[data-p]')];
  const zobraz = (el, h) => {
    if (el.dataset.typ === 'kabely') return KAB.textKabely(h);
    if (el.dataset.typ === 'text') return h ?? '';
    return String(h).replace('.', ',');
  };
  function naplnFormular() {
    for (const el of pole) {
      if (document.activeElement !== el) el.value = zobraz(el, KAB.vezmi(p, el.dataset.p));
      el.classList.remove('spatne');
    }
    viditelnost();
  }
  /** Oddíly a pole podle typu ([data-typy]) a podle jiné volby ([data-kdy="cesta=hodnota"]). */
  function viditelnost() {
    document.querySelectorAll('[data-typy]').forEach(el => { el.hidden = !el.dataset.typy.split(' ').includes(p.typ); });
    document.querySelectorAll('[data-kdy]').forEach(el => { const [c, h] = el.dataset.kdy.split('='); el.hidden = KAB.vezmi(p, c) !== h; });
    $('lSvazek').textContent = p.drzak.tvar === 'hacek' ? 'Průměr svazku' : 'Vnitřní šířka';
    $('nadpisTypu').textContent = KAB.TYPY[p.typ].nazev;
    document.querySelectorAll('#paleta button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.typ === p.typ)));
    document.querySelectorAll('#nabTyp .pol').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.typ === p.typ)));
  }
  for (const el of pole) {
    const akce = () => {
      const c = el.dataset.p;
      let h;
      if (el.dataset.typ === 'text') h = el.value;
      else if (el.dataset.typ === 'kabely') h = KAB.ctiKabely(el.value);
      else h = KAB.cislo(el.value, NaN);
      const spatne = el.dataset.typ === 'kabely' ? !h : el.dataset.typ !== 'text' && !Number.isFinite(h);
      el.classList.toggle('spatne', spatne);
      if (spatne) return;
      zmen(x => KAB.poloz(x, c, h));
      if (el.tagName === 'SELECT') viditelnost();
    };
    el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', akce);
    if (el.tagName === 'INPUT') el.addEventListener('change', () => {
      // po potvrzení ukázat hodnotu, se kterou model opravdu počítá (omezení rozsahu)
      const psano = KAB.cislo(el.value, NaN), h = KAB.vezmi(p, el.dataset.p), rozsah = KAB.ROZSAHY[el.dataset.p];
      el.value = zobraz(el, h);
      if (rozsah && Number.isFinite(psano) && Math.abs(psano - h) > 1e-9) {
        el.classList.remove('zvyrazni'); void el.offsetWidth; el.classList.add('zvyrazni');
        Dialog.info(`${el.labels[0] ? el.labels[0].textContent : 'Hodnota'}: povoleno ${fmt(rozsah[0], 2)}–${fmt(rozsah[1], 2)}, použito ${fmt(h, 2)}.`);
      }
    });
  }
  // ↑/↓ v číselném poli: ± 1, Shift × 10, Alt po 0,1
  for (const el of pole) if (el.tagName === 'INPUT' && !el.dataset.typ) el.addEventListener('keydown', e => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    const h = KAB.cislo(el.value, NaN); if (!Number.isFinite(h)) return;
    e.preventDefault();
    const krok = (e.shiftKey ? 10 : e.altKey ? 0.1 : 1) * (e.key === 'ArrowUp' ? 1 : -1);
    el.value = fmt(Math.round((h + krok) * 1000) / 1000, 3);
    el.dispatchEvent(new Event('input'));
  });
  $('f_mat').innerHTML = Object.entries(KAB.MATERIALY).map(([k, m]) => `<option value="${k}">${m.nazev}</option>`).join('');

  /* ---------- typy a předvolby ---------- */
  function nastavTyp(typ) {
    zmen(x => { x.typ = typ; if (!x.nazev || Object.values(KAB.TYPY).some(t => t.nazev === x.nazev)) x.nazev = KAB.TYPY[typ].nazev; });
    naplnFormular();
    TrubkyGui.ukazBox('in');
  }
  for (const [k, t] of Object.entries(KAB.TYPY)) {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.typ = k; b.title = t.nazev;
    b.innerHTML = `<span aria-hidden="true">${t.znak}</span><span>${t.kratce}</span>`;
    b.addEventListener('click', () => nastavTyp(k));
    $('paleta').appendChild(b);
    const m = document.createElement('button'); m.className = 'pol'; m.setAttribute('role', 'menuitemradio'); m.dataset.typ = k;
    m.textContent = `${t.znak} ${t.nazev}`;
    m.addEventListener('click', () => nastavTyp(k));
    $('nabTyp').appendChild(m);
  }
  KAB.PREDVOLBY.forEach((pv, i) => {
    const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
    b.innerHTML = `${KAB.TYPY[pv.p.typ].znak} ${pv.nazev}`; b.title = pv.popis;
    b.addEventListener('click', () => {
      // předvolba přepíše nastavení svého typu (ostatní typy a tisk zůstanou)
      zmen(x => {
        const n = KAB.vychoziProjekt(i);
        x[pv.p.typ] = n[pv.p.typ]; x.kabely = n.kabely; x.sroub = n.sroub; x.typ = n.typ; x.nazev = n.nazev; x.material = n.material;
        if (pv.p.tisk) Object.assign(x.tisk, pv.p.tisk);
      });
      naplnFormular();
    });
    $('nabPredvolby').appendChild(b);
  });
  $('btnVychozi').addEventListener('click', () => {
    zmen(x => { const v = KAB.kopie(KAB.VYCHOZI); x[x.typ] = v[x.typ]; x.kabely = v.kabely; x.sroub = v.sroub; });
    naplnFormular();
  });

  /* ---------- přepočet ---------- */
  const nahled = KAB_NAHLED.vytvorNahled($('platno'));
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  function barvyTematu() { nahled.barvy(css('--text-faint') || '#888', css('--text') || '#222'); }

  let cekaPrepocet = false;
  function prepocitej() {
    if (cekaPrepocet) return; cekaPrepocet = true;
    requestAnimationFrame(() => { cekaPrepocet = false; prepocitejHned(); });
  }
  function prepocitejHned() {
    const o = KAB.odvozene(p);
    H = KAB.kontroly(p, o);
    model = null; chybaStavby = null;
    if (wasm) {
      try { model = KAB_GEOM.postav(wasm, p); } catch (e) { chybaStavby = e.message || String(e); }
    }
    if (nactiManifold.chyba) chybaStavby = nactiManifold.chyba;
    if (chybaStavby) H.unshift({ uroven: 'chyba', text: 'Model nelze sestavit: ' + chybaStavby });
    const st = $('stav3d');
    st.textContent = chybaStavby ? 'Model nelze sestavit: ' + chybaStavby : (wasm ? '' : 'Načítám geometrické jádro…');
    st.classList.toggle('chyba', !!chybaStavby);
    zobrazModel();
    vysledky(o);
    hlaseni();
    pruzne(o);
    souhrny(o);
  }
  function rozlozene() { return KAB.rozlozeni(model.dily.map(d => Object.assign({ nazev: d.nazev, barva: d.barva, jmeno: d.jmeno }, d.tisk)), p.tisk.kusu); }
  function zobrazModel() {
    if (!model) { nahled.nastav(null); return; }
    if (tiskova) nahled.nastav({ dily: rozlozene(), pomocne: [], tisk: true, typ: p.typ });
    else nahled.nastav({ dily: model.dily.map(d => Object.assign({ barva: d.barva }, d.montaz)), pomocne: model.pomocne, tisk: false, typ: p.typ });
  }
  const dlazdice = (popis, cislo, dalsi, tr) => `<div class="dlazdice"><div class="popis">${popis}</div><div class="cislo ${tr || ''}">${cislo}</div>${dalsi ? `<div class="dalsi">${dalsi}</div>` : ''}</div>`;
  const rozmer = b => `${fmt(b[3] - b[0])} × ${fmt(b[4] - b[1])} × ${fmt(b[5] - b[2])}`;
  function vysledky(o) {
    const el = $('vysledky');
    if (!model) { el.innerHTML = ''; $('tDily').innerHTML = ''; $('nabDily').innerHTML = ''; return; }
    const m = KAB.MATERIALY[p.material], n = p.tisk.kusu;
    const bb = rozlozene().map(d => KAB.obal(d.poz)).reduce((a, b) => [0, 1, 2].map(i => Math.min(a[i], b[i])).concat([3, 4, 5].map(i => Math.max(a[i], b[i]))));
    const V = model.dily.reduce((s, d) => s + d.objem, 0) * n;
    const odhad = KAB.odhadTisku(V, bb[5] - bb[2], p);
    const nch = H.filter(x => x.uroven === 'chyba').length, nv = H.filter(x => x.uroven === 'varovani').length;
    let h = dlazdice('Na podložce', rozmer(bb) + ' mm', `${model.dily.length * n} ${model.dily.length * n === 1 ? 'díl' : 'díly'}${bb[3] - bb[0] > 220 || bb[4] - bb[1] > 220 ? ' · <b class="mez-t">větší než 220 mm</b>' : ''}`);
    h += dlazdice('Objem', fmt(V / 1000, 2) + ' cm³', 'plný díl');
    h += dlazdice('Hmotnost', fmt(odhad.hmotnost, 1) + ' g', `${m.nazev}, filament ${fmt(odhad.filament, 2)} m (⌀ 1,75)`);
    h += dlazdice('Doba tisku', odhad.cas >= 60 ? `${Math.floor(odhad.cas / 60)} h ${Math.round(odhad.cas % 60)} min` : `${Math.round(odhad.cas)} min`, `hrubě, tryska ${fmt(p.tisk.tryska, 2)} / vrstva ${fmt(p.tisk.vrstva, 2)}`);
    h += dlazdice('Kontrola', nch ? `${nch} ✖` : nv ? `${nv} ⚠` : 'v pořádku', '', nch ? 'chyba-t' : nv ? 'mez-t' : 'ok-t');
    h += dlazdice('Výpočet', `${model.cas} ms`, 'manifold-3d');
    el.innerHTML = h;
    // díly zvlášť
    const tb = $('tDily'); tb.innerHTML = ''; $('nabDily').innerHTML = '';
    model.dily.forEach((d, i) => {
      const b = KAB.obal(d.tisk.poz), tr = document.createElement('tr');
      tr.innerHTML = `<td><span class="tecka" style="background:${d.barva}"></span>${d.nazev}</td><td class="c">${rozmer(b)}</td><td class="c">${fmt(d.objem / 1000, 2)} cm³</td>`
        + `<td class="c">${fmt(d.objem / 1000 * m.hustota, 1)} g</td><td><button class="tl" data-i="${i}" data-f="stl">STL</button> <button class="tl" data-i="${i}" data-f="3mf">3MF</button></td>`;
      tb.appendChild(tr);
      if (model.dily.length > 1) {
        const bt = document.createElement('button'); bt.className = 'pol'; bt.setAttribute('role', 'menuitem');
        bt.innerHTML = `⬇ STL – jen ${d.nazev.toLowerCase()}`; bt.addEventListener('click', () => exportuj('stl', i));
        $('nabDily').appendChild(bt);
      }
    });
    tb.querySelectorAll('button').forEach(b => b.addEventListener('click', () => exportuj(b.dataset.f, +b.dataset.i)));
    const tipy = {
      pruchodka: 'Kroužek i víčko se tisknou lícem na podložce (obrácené proti montáži) – bez podpor.',
      klip: 'Klip se tiskne naležato, profil na podložce, bez podpor.',
      hreben: p.tisk.poloha === 'bok' ? 'Hřebínek leží na boku – ramena sedel se ohýbají podél vrstev.' : 'Hřebínek leží na základně – ramena sedel se ohýbají napříč vrstvami.',
      drzak: p.tisk.poloha === 'bok' ? 'Držák leží na boku – oblouk se ohýbá podél vrstev.' : 'Držák leží na desce – oblouk visí, může potřebovat podpory.',
      zed: 'Průchodka se tiskne límcem a membránou na podložce.',
    };
    $('napTisk').textContent = tipy[p.typ];
  }
  function hlaseni() {
    const ul = $('hlaseni'); ul.innerHTML = '';
    const poradi = { chyba: 0, varovani: 1, ok: 2, info: 3 };
    for (const x of H.slice().sort((a, b) => poradi[a.uroven] - poradi[b.uroven])) {
      const li = document.createElement('li'); li.className = x.uroven + (x.pole ? ' skok' : '');
      li.textContent = x.text;
      if (x.pole) {
        li.tabIndex = 0;
        const kam = document.createElement('span'); kam.className = 'kam'; kam.textContent = '→ upravit'; li.appendChild(kam);
        li.addEventListener('click', () => jdiNaPole(x.pole));
        li.addEventListener('keydown', e => { if (e.key === 'Enter') jdiNaPole(x.pole); });
      }
      ul.appendChild(li);
    }
    if (!H.length) ul.innerHTML = '<li class="ok">Bez připomínek.</li>';
    const nch = H.filter(x => x.uroven === 'chyba').length, nv = H.filter(x => x.uroven === 'varovani').length;
    const od = $('stavOdznak');
    od.className = 'odznak ' + (nch ? 'chyba' : nv ? 'mez' : 'ok');
    od.textContent = nch ? `✖ ${nch}` : nv ? `⚠ ${nv}` : '✔';
    $('sKontrola').textContent = nch ? `${nch} ✖` : nv ? `${nv} ⚠` : '✔';
    TrubkyGui.oznacChybu('boxParam', nch > 0);
  }
  function pruzne(o) {
    const m = KAB.MATERIALY[p.material], tb = $('tPruzne');
    tb.innerHTML = o.pruzne.length ? '' : '<tr><td colspan="4">Tento díl nemá pružné části.</td></tr>';
    let nejhorsi = 0, maxEps = 0;
    for (const x of o.pruzne) {
      const f = x.napric ? KAB.NAPRIC_VRSTVAMI : 1, dov = m.dov * f, mez = m.mez * f;
      nejhorsi = Math.max(nejhorsi, x.eps / mez); maxEps = Math.max(maxEps, x.eps);
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${x.nazev}${x.napric ? ' <span class="pozn">(napříč vrstvami)</span>' : ''}</td>`
        + `<td class="c ${x.eps > mez ? 'chyba-t' : x.eps > dov ? 'mez-t' : 'ok-t'}">${fmt(100 * x.eps, 1)} %</td><td class="c">${fmt(100 * dov, 1)} %</td><td class="c">${fmt(100 * mez, 1)} %</td>`;
      tb.appendChild(tr);
    }
    $('sPruzne').textContent = o.pruzne.length ? `max ${fmt(100 * maxEps, 1)} %${nejhorsi > 1 ? ' ✖' : ''}` : '';
  }
  function souhrny(o) {
    const q = p.pruchodka, k = p.kabely;
    TrubkyGui.souhrn('sKrouzek', `⌀ ${fmt(q.otvor)} × ${fmt(q.hloubka)} mm, límec ⌀ ${fmt(2 * (q.otvor / 2 + q.limec))}`, true);
    TrubkyGui.souhrn('sViko', `${q.viko.zpusob === 'otocne' ? 'otočné' : 'zacvakávací'}, ${q.viko.vybrani}× vybrání ${fmt(q.viko.vybraniSirka)} mm`, true);
    TrubkyGui.souhrn('sKlip', `deska ${fmt(p.klip.deska)} mm, šířka ${fmt(p.klip.sirka)} mm`, true);
    TrubkyGui.souhrn('sHreben', `${k.seznam.length} sedel, ${p.hreben.uchyceni === 'sroub' ? 'na šrouby' : 'lepený'}`, true);
    TrubkyGui.souhrn('sDrzak', `${p.drzak.tvar === 'hacek' ? 'háček ⌀' : 'kanálek'} ${fmt(p.drzak.svazek)} mm, vstup ${fmt(p.drzak.vstup)} mm`, true);
    TrubkyGui.souhrn('sZed', `${p.zed.uchyceni === 'zacvak' ? 'do panelu' : 'do vývrtu'} ⌀ ${fmt(p.zed.otvor)} mm`, true);
    TrubkyGui.souhrn('sKabely', KAB.textKabely(k.seznam) + ' mm', true);
    TrubkyGui.souhrn('sSroub', `${fmt(p.sroub.prumer)} × hlava ${fmt(p.sroub.hlava)} mm`, true);
    const napoveda = {
      klip: 'Každý kabel má sedlo ⌀ kabel + vůle se vstupem (hrdlem) užším než kabel – kabel se do něj zacvakne.',
      hreben: 'Každý kabel má sedlo ⌀ kabel + vůle se vstupem (hrdlem) užším než kabel – kabel se do něj zacvakne.',
      drzak: 'Nejsilnější kabel ze seznamu určuje, zda se kabel do vstupu zacvakne.',
      zed: 'Použije se první kabel; otvor membrány = poměr hrdla × ⌀ kabelu.',
      pruchodka: 'Nejsilnější kabel ze seznamu se porovnává se šířkou vybrání ve víčku.',
    };
    $('napKabely').textContent = napoveda[p.typ] + (o.rada ? ` Řada sedel je dlouhá ${fmt(o.rada.sirka)} mm.` : '');
  }
  function jdiNaPole(cesta) {
    let el = document.querySelector(`[data-p="${cesta}"]`);
    if (!el || el.closest('[hidden]')) el = $('hlaseni');
    const det = el.closest('details'); if (det) det.open = true;
    const bx = el.closest('[data-box]'); TrubkyGui.ukazBox(bx ? bx.dataset.box : 'obecne');
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    if (el.focus) el.focus({ preventScroll: true });
    el.classList.remove('zvyrazni'); void el.offsetWidth; el.classList.add('zvyrazni');
  }

  /* ---------- export ---------- */
  const jmenoSouboru = (pripona, dil) => ((p.nazev || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/^_|_$/g, '') || 'kabely3d')
    + (dil ? '_' + dil.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() : '') + pripona;
  function stahni(data, nazev, typ) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type: typ }));
    a.download = nazev; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  async function exportuj(format, jenDil) {
    if (!model) { Dialog.chyba(chybaStavby ? 'Model nelze sestavit: ' + chybaStavby : 'Geometrické jádro se ještě načítá.'); return; }
    const nch = H.filter(x => x.uroven === 'chyba').length;
    if (nch && !await Dialog.potvrd(`Kontrola hlásí ${nch} ${nch === 1 ? 'chybu' : nch < 5 ? 'chyby' : 'chyb'}. Díl nemusí jít vytisknout nebo nebude fungovat. Přesto exportovat?`)) return;
    let dily = rozlozene(), dil = null;
    if (jenDil !== undefined) { dil = model.dily[jenDil].nazev; dily = KAB.rozlozeni(dily.filter(d => d.jmeno === model.dily[jenDil].jmeno), 1); }
    if (format === 'stl') stahni(KRAB.stlBinarni(dily, 'kabely3d - github_site'), jmenoSouboru('.stl', dil), 'model/stl');
    else stahni(KRAB.soubor3mf(dily, p.nazev || 'Kabely 3D'), jmenoSouboru('.3mf', dil), 'model/3mf');
  }
  $('btnStl').addEventListener('click', () => exportuj('stl'));
  $('btn3mf').addEventListener('click', () => exportuj('3mf'));
  $('btnPng').addEventListener('click', () => { const a = document.createElement('a'); a.href = nahled.png(); a.download = jmenoSouboru('.png'); a.click(); });
  $('btnUlozit').addEventListener('click', () => stahni(KAB.ulozProjekt(p), jmenoSouboru('.json'), 'application/json'));
  $('btnNacist').addEventListener('click', () => $('soubor').click());
  $('soubor').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try {
      const r = KAB.nactiProjekt(await f.text());
      hlasPrevod(r.hlaseni, 'Projekt');
      zmen(x => { Object.keys(x).forEach(k => delete x[k]); Object.assign(x, r.p); });
      naplnFormular();
    } catch (err) { Dialog.chyba(err.message); }
  });

  /* ---------- zobrazení ---------- */
  function nastavTisk(h) {
    tiskova = h;
    $('tTisk').setAttribute('aria-pressed', String(h)); $('rTisk').setAttribute('aria-pressed', String(h)); $('rMontaz').setAttribute('aria-pressed', String(!h));
    zobrazModel();
  }
  $('tTisk').addEventListener('click', () => nastavTisk(!tiskova));
  $('rTisk').addEventListener('click', () => nastavTisk(true));
  $('rMontaz').addEventListener('click', () => nastavTisk(false));
  for (const [id, co] of [['tPomocne', 'pomocne'], ['tHrany', 'hrany']]) $(id).addEventListener('click', () => {
    const h = $(id).getAttribute('aria-pressed') !== 'true';
    $(id).setAttribute('aria-pressed', String(h)); nahled.prepni(co, h);
  });
  $('stavOdznak').addEventListener('click', () => TrubkyGui.otevriZalozku('kontrola'));
  document.addEventListener('keydown', e => {
    const a = document.activeElement;
    const vPoli = a.tagName === 'SELECT' || (a.tagName === 'INPUT' && a.type !== 'checkbox');
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); exportuj('stl'); return; }
    if (e.key === 'F1') { e.preventDefault(); $('napoveda').showModal(); return; }
    if (vPoli || e.ctrlKey || e.metaKey || e.altKey || $('napoveda').open) return;
    const k = e.key.toLowerCase();
    const pohledy = { 1: 'iso', 2: 'shora', 3: 'zepredu', 4: 'zboku' };
    if (pohledy[k]) nahled.pohled(pohledy[k]);
    else if (k === 'm') nastavTisk(!tiskova); else if (k === 'd') $('tPomocne').click(); else if (k === 'h') $('tHrany').click();
  });
  new MutationObserver(() => { barvyTematu(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  TrubkyGui.pripoj({ klic: 'webapp_kabely3d_gui', pohled: j => nahled.pohled(j) });
  if (typeof Tvary !== 'undefined') Tvary.pripoj({
    klic: 'webapp_kabely3d_tvary', typ: 'kabely3d', nazev: 'Kabely 3D', kontejner: $('tvary'),
    parametry: () => KAB.kopie(p),
    pouzij: q => { const n = KAB.normalizuj(q); hlasPrevod(n.hlaseni, 'Uložené nastavení'); zmen(x => { Object.keys(x).forEach(k => delete x[k]); Object.assign(x, n.p); }); naplnFormular(); },
    popis: q => `${q.nazev || 'Bez názvu'} – ${KAB.popis(KAB.normalizuj(q).p)}`,
  });

  /* ---------- manifold ---------- */
  function nactiSkript(src) {
    return new Promise((ok, chyba) => {
      const el = document.createElement('script'); el.src = src; el.onload = ok;
      el.onerror = () => chyba(new Error('nejde načíst ' + src)); document.head.appendChild(el);
    });
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

  /* ---------- start ---------- */
  p = nactiUlozeny();
  barvyTematu();
  naplnFormular();
  prepocitejHned();
  nactiManifold().then(w => { wasm = w; prepocitejHned(); }).catch(e => {
    nactiManifold.chyba = 'geometrické jádro (manifold-3d) se nenačetlo – ' + (e && e.message || e) + '. Kontroly fungují, model ani export ne.';
    prepocitejHned();
  });
  window.KAB_UI = { get p() { return p; }, get model() { return model; }, zmen, naplnFormular, prepocitej: prepocitejHned, nastavTisk, nastavTyp, exportuj };
})();

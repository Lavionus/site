/* Kabelové průchodky a organizéry – ovládání stránky nad společným zapojením gen3d/aplikace.js:
   tady jen to, co je pro kabely zvláštní (typy dílu, pole kabelů, přepočet, pružné části, díly, montáž/tisk, export). */
/* global KAB, KAB_GEOM, KAB_NAHLED, KRAB, G3D, Dialog, TrubkyGui */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const fmt = KAB.fmt;
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  let p, model = null, chybaStavby = null, wasm = null, chybaManifoldu = null, H = [], tiskova = false;
  const nahled = KAB_NAHLED.vytvorNahled($('platno'));

  // „Výchozí hodnoty typu“: vrátí jen parametry zvoleného typu, kabely a šrouby (ostatní typy a tisk zůstanou)
  const vychoziTypu = q => { const x = KAB.kopie(q), v = KAB.kopie(KAB.VYCHOZI); x[x.typ] = v[x.typ]; x.kabely = v.kabely; x.sroub = v.sroub; return KAB.normalizuj(x).p; };
  let app = null;
  app = G3D.aplikace({
    typ: 'kabely3d', nazev: 'Kabely 3D', klic: 'webapp_kabely3d', soubor: 'kabely3d',
    normalizuj: KAB.normalizuj,
    vychozi: () => (app ? vychoziTypu(app.p) : KAB.normalizuj(KAB.vychoziProjekt(0)).p),
    ulozProjekt: KAB.ulozProjekt, nactiProjekt: KAB.nactiProjekt,
    popis: q => `${q.nazev || 'Bez názvu'} – ${KAB.popis(q)}`,
    vezmi: KAB.vezmi, poloz: KAB.poloz,
    poNaplneni: q => { $('f_ks2').value = KAB.textKabely(q.kabely.seznam); },
    viditelnost: () => viditelnost(),
    prepocitej: () => prepocitej(),
    png: () => nahled.png(), pohled: j => nahled.pohled(j),
    exportStl: () => exportuj('stl'),
    doModelare: async () => (await lzeExport() ? { data: KRAB.soubor3mf(rozlozene(), app.p.nazev || 'Kabely 3D'), pripona: '.3mf' } : null),
    zkratky: { m: 'tTisk', d: 'tPomocne', h: 'tHrany', p: 'tPrevisy', r: 'tRez', l: 'tPravitka' },
    zmenaTematu: () => { barvyTematu(); zobrazModel(); },
  });
  p = app.p;

  /* ---------- formulář ---------- */
  /** Oddíly a pole podle typu ([data-typy]) a podle jiné volby ([data-kdy="cesta=hodnota"]). */
  function viditelnost() {
    p = app.p;
    document.querySelectorAll('[data-typy]').forEach(el => { el.hidden = !el.dataset.typy.split(' ').includes(p.typ); });
    document.querySelectorAll('[data-kdy]').forEach(el => { const [c, h] = el.dataset.kdy.split('='); el.hidden = KAB.vezmi(p, c) !== h; });
    $('lSvazek').textContent = p.drzak.tvar === 'hacek' ? 'Průměr svazku' : 'Vnitřní šířka';
    $('nadpisTypu').textContent = KAB.TYPY[p.typ].nazev;
    document.querySelectorAll('#paleta button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.typ === p.typ)));
    document.querySelectorAll('#seznamTypu .pol').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.typ === p.typ)));
  }
  // seznam kabelů („6; 6; 8“) není číslo – obsluha tady; zachytit dřív, než ho gen3d zpracuje jako číselné pole
  const poleKabelu = $('f_ks2');
  document.addEventListener('change', e => {
    if (e.target !== poleKabelu) return;
    e.stopPropagation();
    const h = KAB.ctiKabely(poleKabelu.value);
    poleKabelu.classList.toggle('spatne', !h);
    if (h) { app.zmen(x => KAB.poloz(x, 'kabely.seznam', h)); poleKabelu.value = KAB.textKabely(app.p.kabely.seznam); }
  }, true);
  // pole se přepočítávají už při psaní (jako dřív); rychlé změny jednoho pole = jeden krok zpět
  document.querySelectorAll('[data-p]').forEach(el => {
    if (el.tagName !== 'INPUT') return;
    el.addEventListener('input', () => {
      const c = el.dataset.p;
      let h;
      if (el.dataset.typ === 'text') h = el.value;
      else if (el.dataset.typ === 'kabely') h = KAB.ctiKabely(el.value);
      else h = G3D.ctiCislo(el.value);
      const spatne = el.dataset.typ === 'kabely' ? !h : el.dataset.typ !== 'text' && !Number.isFinite(h);
      el.classList.toggle('spatne', spatne);
      if (!spatne) app.zmen(x => KAB.poloz(x, c, h), 'pole:' + c);
    });
    if (el.dataset.typ) return;
    // po potvrzení ukázat, s jakou hodnotou model opravdu počítá (omezení rozsahu); napsané se zachytí před gen3d
    el.addEventListener('change', () => { el.dataset.psano = el.value; }, true);
    el.addEventListener('change', () => {
      const psano = G3D.ctiCislo(el.dataset.psano), h = KAB.vezmi(app.p, el.dataset.p), rozsah = KAB.ROZSAHY[el.dataset.p];
      if (!rozsah || !Number.isFinite(psano) || Math.abs(psano - h) < 1e-9) return;
      el.classList.remove('zvyrazni'); void el.offsetWidth; el.classList.add('zvyrazni');
      Dialog.info(`${el.labels[0] ? el.labels[0].textContent : 'Hodnota'}: povoleno ${fmt(rozsah[0], 2)}–${fmt(rozsah[1], 2)}, použito ${fmt(h, 2)}.`);
    });
  });
  $('f_mat').innerHTML = Object.entries(KAB.MATERIALY).map(([k, m]) => `<option value="${k}">${m.nazev}</option>`).join('');

  /* ---------- typy (první skupina Předvoleb) a předvolby ---------- */
  function nastavTyp(typ) {
    app.zmen(x => { x.typ = typ; if (!x.nazev || Object.values(KAB.TYPY).some(t => t.nazev === x.nazev)) x.nazev = KAB.TYPY[typ].nazev; });
    app.naplnFormular();
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
    $('seznamTypu').appendChild(m);
  }
  KAB.PREDVOLBY.forEach((pv, i) => {
    const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
    b.innerHTML = `${KAB.TYPY[pv.p.typ].znak} ${pv.nazev}`; b.title = pv.popis;
    b.addEventListener('click', () => {
      // předvolba přepíše nastavení svého typu (ostatní typy a tisk zůstanou)
      app.zmen(x => {
        const n = KAB.vychoziProjekt(i);
        x[pv.p.typ] = n[pv.p.typ]; x.kabely = n.kabely; x.sroub = n.sroub; x.typ = n.typ; x.nazev = n.nazev; x.material = n.material;
        if (pv.p.tisk) Object.assign(x.tisk, pv.p.tisk);
      });
      app.naplnFormular();
    });
    $('seznamPredvoleb').appendChild(b);
  });

  /* ---------- přepočet ---------- */
  function barvyTematu() { nahled.barvy(css('--text-faint') || '#888', css('--text') || '#222'); }
  let cekaPrepocet = false;
  function prepocitej() {
    if (cekaPrepocet) return; cekaPrepocet = true;
    requestAnimationFrame(() => { cekaPrepocet = false; prepocitejHned(); });
  }
  function prepocitejHned() {
    p = app.p;
    const o = KAB.odvozene(p);
    H = KAB.kontroly(p, o);
    model = null; chybaStavby = null;
    if (wasm) {
      try { model = KAB_GEOM.postav(wasm, p); } catch (e) { chybaStavby = e.message || String(e); }
    }
    if (chybaManifoldu) chybaStavby = chybaManifoldu;
    if (chybaStavby) H.unshift({ uroven: 'chyba', text: 'Model nelze sestavit: ' + chybaStavby });
    const st = $('stav3d');
    st.textContent = chybaStavby ? 'Model nelze sestavit: ' + chybaStavby : (wasm ? '' : 'Načítám geometrické jádro…');
    st.classList.toggle('chyba', !!chybaStavby);
    zobrazModel();
    vysledky(o);
    // hlášení: jádro dává jedno pole jako text, gen3d čeká seznam; bez připomínek = „Bez připomínek.“
    app.hlaseni(H.length ? H.map(x => Object.assign({}, x, { pole: x.pole ? [x.pole] : [] })) : [{ uroven: 'ok', text: 'Bez připomínek.' }], { boxy: ['boxParam'] });
    const nch = H.filter(x => x.uroven === 'chyba').length, nv = H.filter(x => x.uroven === 'varovani').length;
    $('sKontrola').textContent = nch ? `${nch} ✖` : nv ? `${nv} ⚠` : '✔';
    pruzne(o);
    souhrny(o);
  }
  function rozlozene() { return KAB.rozlozeni(model.dily.map(d => Object.assign({ nazev: d.nazev, barva: d.barva, jmeno: d.jmeno }, d.tisk)), app.p.tisk.kusu); }
  function zobrazModel() {
    if (!model) { nahled.nastav(null); return; }
    if (tiskova) nahled.nastav({ dily: rozlozene(), pomocne: [], tisk: true, typ: p.typ, uhel: 45 });
    else nahled.nastav({ dily: model.dily.map(d => Object.assign({ barva: d.barva }, d.montaz)), pomocne: model.pomocne, tisk: false, typ: p.typ });
  }
  const dlazdice = G3D.dlazdice;
  const rozmer = b => `${fmt(b[3] - b[0])} × ${fmt(b[4] - b[1])} × ${fmt(b[5] - b[2])}`;
  function vysledky(o) {
    const el = $('vysledky');
    if (!model) { el.innerHTML = dlazdice('Model', chybaStavby ? 'nelze sestavit' : 'načítám…', chybaStavby || ''); $('tDily').innerHTML = ''; $('nabDily').innerHTML = ''; $('sVysledky').textContent = ''; return; }
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
    $('sVysledky').textContent = `${fmt(odhad.hmotnost, 0)} g`;
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

  /* ---------- export ---------- */
  async function lzeExport() {
    if (!model) { Dialog.chyba(chybaStavby ? 'Model nelze sestavit: ' + chybaStavby : 'Geometrické jádro se ještě načítá.'); return false; }
    const nch = H.filter(x => x.uroven === 'chyba').length;
    return !nch || Dialog.potvrd(`Kontrola hlásí ${nch} ${nch === 1 ? 'chybu' : nch < 5 ? 'chyby' : 'chyb'}. Díl nemusí jít vytisknout nebo nebude fungovat. Přesto exportovat?`);
  }
  async function exportuj(format, jenDil) {
    if (!await lzeExport()) return;
    let dily = rozlozene(), dil = null;
    if (jenDil !== undefined) { dil = model.dily[jenDil].nazev; dily = KAB.rozlozeni(dily.filter(d => d.jmeno === model.dily[jenDil].jmeno), 1); }
    const pripona = '.' + format, jm = dil ? app.jmeno('_' + dil.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() + pripona) : app.jmeno(pripona);
    if (format === 'stl') app.stahni(KRAB.stlBinarni(dily, 'kabely3d - github_site'), jm, 'model/stl');
    else app.stahni(KRAB.soubor3mf(dily, app.p.nazev || 'Kabely 3D'), jm, 'model/3mf');
  }
  $('btnStl').addEventListener('click', () => exportuj('stl'));
  $('btn3mf').addEventListener('click', () => exportuj('3mf'));

  /* ---------- zobrazení ---------- */
  app.prepinac('tTisk', h => {
    tiskova = h;
    $('rTisk').setAttribute('aria-pressed', String(h)); $('rMontaz').setAttribute('aria-pressed', String(!h));
    $('legPrevisy').hidden = !(h && nahled.stav.previsy);
    zobrazModel();
  });
  // přepínač Montáž / Tisk v rohu náhledu = totéž co Zobrazení → Tisková poloha
  $('rTisk').addEventListener('click', () => { if (!tiskova) $('tTisk').click(); });
  $('rMontaz').addEventListener('click', () => { if (tiskova) $('tTisk').click(); });
  app.prepinac('tPomocne', h => nahled.prepni('pomocne', h));
  app.prepinac('tHrany', h => nahled.prepni('hrany', h));
  app.prepinac('tPrevisy', h => { nahled.prepni('previsy', h); $('legPrevisy').hidden = !(h && tiskova); }, true);
  app.prepinac('tRez', h => { nahled.prepni('rez', h); $('legRez').hidden = !h; });
  app.prepinac('tPravitka', h => nahled.prepni('pravitka', h), true);
  TrubkyGui.pripoj({ klic: 'webapp_kabely3d_gui', pohled: j => nahled.pohled(j) });

  /* ---------- start ---------- */
  barvyTematu();
  app.start({
    manifold: {
      ok: w => { wasm = w; prepocitejHned(); },
      chyba: e => { chybaManifoldu = 'geometrické jádro (manifold-3d) se nenačetlo – ' + (e && e.message || e) + '. Kontroly fungují, model ani export ne.'; prepocitejHned(); },
    },
  });
  const nastavTisk = h => { if (h !== tiskova) $('tTisk').click(); };
  window.KAB_UI = { get p() { return app.p; }, get model() { return model; }, zmen: app.zmen, naplnFormular: app.naplnFormular, prepocitej: prepocitejHned, nastavTisk, nastavTyp, exportuj, app };
})();

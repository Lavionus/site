/* Nožičky – ovládání stránky nad společným zapojením gen3d/aplikace.js:
   tady jen to, co je pro nožičky zvláštní (segmenty, viditelnost, předvolby, výsledky, kusovník, exporty po druzích dílů). */
/* global NOZ, NOZ_NAHLED, KRAB, G3D, Dialog, TrubkyGui */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const fmt = NOZ.fmt;
  let p = null, model = null, w = null, chybaStavby = null, chybaJadra = '', stavMs = 0;
  const nahled = NOZ_NAHLED.vytvorNahled($('platno'));
  nahled.stav.sada = false;
  for (const [k, m] of Object.entries(NOZ.MATERIALY)) $('f_mat').add(new Option(m.nazev, k));

  const app = G3D.aplikace({
    typ: 'nozicky', nazev: 'Nožičky a krytky', klic: 'webapp_nozicky', soubor: 'dil',
    normalizuj: NOZ.normalizuj, vychozi: () => NOZ.vychoziProjekt(-1),
    ulozProjekt: NOZ.ulozProjekt, nactiProjekt: NOZ.nactiProjekt,
    vezmi: NOZ.vezmi, poloz: NOZ.poloz,
    popis: q => `${q.nazev || NOZ.TYPY[q.typ] || 'díl'} – ${NOZ.TYPY[q.typ] || ''}, ${q.kusu || 1} ks`,
    viditelnost: () => viditelnost(),
    prepocitej: () => prepocitej(), zpozdeni: 60,
    png: () => nahled.png(), pohled: j => nahled.pohled(j),
    exportStl: () => exStl(vse)(),
    doModelare: () => (lzeExport() ? { data: KRAB.soubor3mf(model.dily, app.p.nazev || 'Nožičky'), pripona: '.3mf' } : null),
    zkratky: { m: 'tTisk', s: 'tTisk', d: 'tDuch', r: 'tRez', h: 'tHrany', p: 'tPrevisy', l: 'tPravitka' },
    zmenaTematu: () => barvyTematu(),
    hlaseniNavic: (li, x) => skokNaSegment(li, x),
  });

  /* ---------- formulář: živá změna při psaní, segmenty, typ dílu ---------- */
  /** Podmínka viditelnosti: "cesta=a|b", "cesta>0"; víc podmínek odděleno středníkem. */
  function plati(vyraz) {
    return vyraz.split(';').every(c => {
      const m = c.match(/^([\w.]+)(=|>)(.*)$/);
      if (!m) return true;
      const h = NOZ.vezmi(p, m[1]);
      return m[2] === '>' ? h > Number(m[3]) : m[3].split('|').includes(String(h));
    });
  }
  function viditelnost() {
    p = app.p;
    document.querySelectorAll('[data-volba]').forEach(g => {
      const h = NOZ.vezmi(p, g.dataset.volba);
      g.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.h === h)));
    });
    document.querySelectorAll('[data-typ-dilu]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.typDilu === p.typ)));
    document.querySelectorAll('[data-pro]').forEach(el => { el.hidden = el.dataset.pro !== p.typ; });
    document.querySelectorAll('[data-kdy]').forEach(el => { el.hidden = !plati(el.dataset.kdy); });
    document.querySelector('[data-pop="pantofle"]').textContent = p.pantofle.profil === 'ctverec' ? 'Strana nohy' : 'Šířka nohy (ve směru sklonu)';
  }
  // číselná a textová pole se přepočítají už při psaní (mez se vynutí až při opuštění pole – to dělá gen3d)
  document.querySelectorAll('input[data-p]').forEach(el => {
    if (el.type === 'checkbox') return;
    el.addEventListener('input', () => {
      const c = el.dataset.p;
      let h;
      if (el.dataset.typ === 'text') h = el.value;
      else {
        h = NOZ.cislo(el.value, NaN);
        const m = NOZ.MEZE[c];
        const spatne = !Number.isFinite(h) || (m && (h < m[0] || h > m[1]));
        el.classList.toggle('spatne', spatne);
        if (spatne) return;
      }
      app.zmen(x => NOZ.poloz(x, c, h), 'psani:' + c);
    });
  });
  document.querySelectorAll('[data-volba]').forEach(g => g.addEventListener('click', e => {
    const b = e.target.closest('button[data-h]');
    if (b) { app.zmen(x => NOZ.poloz(x, g.dataset.volba, b.dataset.h)); app.naplnFormular(); }
  }));
  document.querySelectorAll('[data-typ-dilu]').forEach(b => b.addEventListener('click', () => {
    app.zmen(x => { if (x.nazev === NOZ.TYPY[x.typ] || !x.nazev) x.nazev = NOZ.TYPY[b.dataset.typDilu]; x.typ = b.dataset.typDilu; });
    app.naplnFormular();
  }));

  /* ---------- předvolby ---------- */
  NOZ.PREDVOLBY.forEach((pv, i) => {
    const b = document.createElement('button');
    b.className = 'pol'; b.setAttribute('role', 'menuitem');
    b.innerHTML = `<span></span><small></small>`;
    b.firstChild.textContent = pv.nazev; b.lastChild.textContent = pv.popis;
    b.addEventListener('click', () => app.nahrad(NOZ.vychoziProjekt(i)));
    $('seznamPredvoleb').appendChild(b);
  });

  /* ---------- náhled ---------- */
  const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || '#888';
  const barvyTematu = () => nahled.barvy(css('--border-strong'), css('--border'), css('--text'));

  /* ---------- přepočet ---------- */
  function prepocitej() {
    p = app.p;
    nahled.stav.uhel = p.tisk.previs;
    if (w) {
      const t0 = performance.now();
      try { model = NOZ.postav(w, p); chybaStavby = null; } catch (e) { model = null; chybaStavby = e.message; }
      stavMs = performance.now() - t0;
      if (model) nahled.nastav(model);
    }
    const st = $('stav3d');
    st.classList.toggle('chyba', !!(chybaStavby || chybaJadra));
    st.textContent = chybaJadra || (chybaStavby ? '⚠ ' + chybaStavby : w ? '' : 'Načítám geometrické jádro (manifold)…');
    $('canvas-container').classList.toggle('je-neplatne', !!chybaStavby);
    vypisKontroly();
    vypisVysledky();
  }

  /* ---------- kontroly (formát jádra: pole = jedna cesta nebo null) ---------- */
  function popisPole(cesta) {
    const el = cesta && document.querySelector(`[data-p="${cesta}"]`);
    if (el) { const l = el.id && document.querySelector(`label[for="${el.id}"]`); return l ? l.textContent : (el.closest('label') || {}).textContent; }
    const g = cesta && document.querySelector(`[data-volba="${cesta}"]`);
    return g ? g.getAttribute('aria-label') : '';
  }
  /** Skok na segment (data-volba) – gen3d umí jen pole [data-p]. */
  function skocNa(cesta) {
    const cil = document.querySelector(`[data-volba="${cesta}"]`);
    if (!cil) return;
    const zal = cil.closest('.zalozka-telo');
    if (zal) TrubkyGui.otevriZalozku(zal.dataset.telo);
    else { const bx = cil.closest('[data-box]'); TrubkyGui.ukazBox(bx ? bx.dataset.box : 'obecne'); }
    const od = cil.closest('details'); if (od) od.open = true;
    cil.scrollIntoView({ block: 'center', behavior: 'smooth' });
    cil.classList.remove('zvyrazni'); void cil.offsetWidth; cil.classList.add('zvyrazni');
    const b = cil.querySelector('button'); if (b) b.focus({ preventScroll: true });
  }
  function skokNaSegment(li, x) {
    const c = x.pole[0];
    if (!c) return;
    const kam = li.querySelector('.kam'); if (kam) kam.textContent = '→ ' + (popisPole(c) || c);
    if (!document.querySelector(`[data-p="${c}"]`)) li.addEventListener('click', () => skocNa(c));
  }
  function vypisKontroly() {
    const H = NOZ.kontroly(p).map(x => Object.assign({}, x, { pole: x.pole ? [x.pole] : [] }));
    app.hlaseni(H, { chybaStavby: chybaJadra || (chybaStavby ? 'Díl nelze sestavit: ' + chybaStavby : ''), boxy: ['boxVstup', 'boxVystup'] });
  }

  /* ---------- výsledky ---------- */
  const casText = s => { const m = Math.round(s / 60); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`; };
  const esc = G3D.esc;
  function dlazdice(popis, cislo, dalsi) {
    const d = document.createElement('div'); d.className = 'dlazdice';
    d.innerHTML = '<div class="popis"></div><div class="cislo"></div>' + (dalsi ? '<div class="dalsi"></div>' : '');
    d.children[0].textContent = popis; d.children[1].textContent = cislo; if (dalsi) d.children[2].textContent = dalsi;
    return d;
  }
  function souhrny(o) {
    TrubkyGui.souhrn('sNozicka', `${{ valec: 'válec', kuzel: 'kužel', kopule: 'kopule' }[p.nozicka.tvar]} Ø ${fmt(p.nozicka.d)} × ${fmt(p.nozicka.vyska)}`, true);
    TrubkyGui.souhrn('sUpevneni', { sroub: `šroub Ø ${fmt(p.nozicka.otvor)}`, lepeni: 'lepení', cep: `čep Ø ${fmt(o.cepPrumer || 0, 2)}` }[p.nozicka.upevneni], true);
    TrubkyGui.souhrn('sPantofle', `${p.pantofle.profil === 'kruh' ? 'Ø ' + fmt(p.pantofle.d) : fmt(p.pantofle.a) + (p.pantofle.profil === 'obdelnik' ? ' × ' + fmt(p.pantofle.b) : '')}${p.pantofle.sklon ? ', sklon ' + fmt(p.pantofle.sklon) + '°' : ''}`, true);
    TrubkyGui.souhrn('sKrytka', `${p.krytka.profil === 'kruh' ? 'Ø ' + fmt(p.krytka.d) : fmt(p.krytka.a) + (p.krytka.profil === 'obdelnik' ? ' × ' + fmt(p.krytka.b) : '')} × ${fmt(p.krytka.s)}`, true);
    TrubkyGui.souhrn('sKrytka2', p.krytka.druh === 'vnitrni' ? `do trubky, ${o.pocetLamel || p.krytka.lamel} lamel` : 'přes trubku', true);
    TrubkyGui.souhrn('sPodlozka', p.podlozka.rezim === 'klin' ? `klín ${fmt(p.podlozka.sklon)}°` : `sada ${p.kusu} ks`, true);
    TrubkyGui.souhrn('sSpolecne', `${NOZ.MATERIALY[p.material].nazev}, vůle ${fmt(p.vule, 2)} mm`, true);
    $('sTisk').textContent = `${p.kusu} ks`;
    $('sProtiskluz').textContent = o.protiskluz ? 'zapnuto' : '';
  }
  function vypisVysledky() {
    const v = $('vysledky'); v.textContent = '';
    const tb = $('tDily'); tb.textContent = '';
    const karta = $('karta3d');
    const o = NOZ.odvozene(p);
    souhrny(o);
    if (!model) { karta.textContent = ''; v.appendChild(dlazdice('Model', w || chybaJadra ? 'nelze sestavit' : 'načítám…', chybaJadra || chybaStavby || '')); return; }
    const hl = model.kus.find(d => d.druh === 'hlavni'), b = NOZ.obal(hl.poz);
    const roz = `${fmt(b[3] - b[0])} × ${fmt(b[4] - b[1])} × ${fmt(b[5] - b[2])}`;
    const od = NOZ.odhad(p, model.dily);
    const tiles = [['Rozměry kusu', roz + ' mm', 'v tiskové poloze (X × Y × výška)']];
    const typove = [];
    if (p.typ === 'nozicka') {
      typove.push(['Plocha na podlaze', `Ø ${fmt(2 * o.rPodlahy)} mm`, p.nozicka.tvar === 'kopule' ? 'ploška na vrcholu kopule' : 'bez sražení hrany']);
      typove.push(['Největší převis', `${fmt(o.previs, 0)}°`, o.otoceni ? 'tisk podlahou dolů (čep nahoru)' : 'tisk plochou k nábytku dolů']);
      if (p.nozicka.upevneni === 'sroub') typove.push(['Materiál pod hlavou', `${fmt(o.podHlavou)} mm`, `kužel zahloubení ${fmt(o.kuzelSroubu)} mm`]);
      if (p.nozicka.upevneni === 'cep') typove.push(['Čep', `Ø ${fmt(o.cepPrumer, 2)} × ${fmt(p.nozicka.cepL)} mm`, `do díry Ø ${fmt(p.nozicka.cepD)} mm`]);
    } else if (p.typ === 'pantofle') {
      typove.push(['Vnitřek návleku', `${fmt(o.vnitrni[0], 2)} × ${fmt(o.vnitrni[1], 2)} mm`, 'kolmo k ose nohy, s vůlí']);
      typove.push(['Výška', `${fmt(o.vyska)} mm`, p.pantofle.sklon ? `nejkratší stěna ${fmt(p.pantofle.hloubka)} mm podél nohy` : `dno ${fmt(p.pantofle.dno)} mm`]);
    } else if (p.typ === 'krytka') {
      if (p.krytka.druh === 'vnitrni') {
        typove.push(['Rukáv / zub', `${fmt(o.rukav[0], 2)} / ${fmt(o.zub[0], 2)} mm`, `vnitřek trubky ${fmt(o.vnitrniTrubky[0], 2)} mm`]);
        const vyuz = o.protazeni / o.mat.protazeni;
        typove.push(['Pružnost lamel', `${fmt(100 * vyuz, 0)} %`, `prohnutí ${fmt(100 * o.protazeni, 2)} % z dovolených ${fmt(100 * o.mat.protazeni, 0)} % (${o.mat.nazev}), lamela ${fmt(o.lJazyk)} mm`]);
      } else typove.push(['Vnitřek krytky', `${fmt(o.vnitrni[0], 2)} × ${fmt(o.vnitrni[1], 2)} mm`, 'vnější rozměr trubky + vůle']);
    } else if (p.typ === 'podlozka') {
      if (p.podlozka.rezim === 'klin') {
        typove.push(['Výška klínu', `${fmt(p.podlozka.hMin, 2)} → ${fmt(o.hMax, 2)} mm`, `Δh = ${fmt(o.hMax - p.podlozka.hMin, 2)} mm na ${fmt(o.Lx)} mm`]);
        typove.push(['Sklon', `${fmt(p.podlozka.sklon, 2)}°`, `${fmt(100 * Math.tan(p.podlozka.sklon * Math.PI / 180), 2)} % = ${fmt(1000 * Math.tan(p.podlozka.sklon * Math.PI / 180), 1)} mm/m`]);
      } else typove.push(['Tloušťky sady', o.tloustky.length > 4 ? `${fmt(o.tloustky[0], 2)} … ${fmt(o.tloustky[o.tloustky.length - 1], 2)} mm` : o.tloustky.map(t => fmt(t, 2)).join(' · ') + ' mm', `${o.tloustky.length} ks po ${fmt(p.podlozka.krok, 2)} mm`]);
    }
    tiles.push(...typove);
    tiles.push(['Objem sady', `${fmt(od.objem / 1000, 2)} cm³`, `${model.dily.length} ${model.dily.length < 5 ? 'díly' : 'dílů'}, plné díly`]);
    tiles.push(['Hmotnost sady', `${fmt(od.hmotnost, 0)} g`, (od.hmotnostTpu ? `+ ${fmt(od.hmotnostTpu, 1)} g TPU · ` : '') + `výplň ${fmt(p.tisk.vypln, 0)} %`]);
    tiles.push(['Filament', `${fmt(od.filament, 1)} m`, 'průměr 1,75 mm, se zadanou výplní']);
    tiles.push(['Doba tisku', '≈ ' + casText(od.cas), `${model.dily.length} ${model.dily.length < 5 ? 'díly' : 'dílů'}, hrubý odhad`]);
    for (const t of tiles) v.appendChild(dlazdice(...t));
    // díly jednoho kusu ke stažení (kusovník)
    const kusy = model.kusy.length > 1 ? model.kusy.flat() : model.kus;
    kusy.forEach(d => {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td><span class="tecka"></span><span></span></td><td class="c"></td><td class="c"><button class="tl" type="button">STL</button></td>';
      tr.querySelector('.tecka').style.background = d.barva;
      tr.children[0].lastChild.textContent = d.nazev;
      tr.children[1].textContent = fmt(d.objem / 1000, 2) + ' cm³';
      tr.querySelector('button').addEventListener('click', () => stahniStl([d], d.nazev));
      tr.querySelector('button').setAttribute('aria-label', 'Stáhnout STL – ' + d.nazev);
      tb.appendChild(tr);
    });
    karta.innerHTML = `<b>${esc(p.nazev || NOZ.TYPY[p.typ])}</b><br>${roz} mm<br>${typove[0] ? esc(typove[0][0]) + ': <b>' + esc(typove[0][1]) + '</b>' : ''}`;
  }

  /* ---------- export ---------- */
  const jmeno = () => (app.p.nazev || 'dil').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'dil';
  function lzeExport() {
    if (model) return true;
    Dialog.chyba(chybaStavby ? 'Díl nelze sestavit: ' + chybaStavby : 'Geometrie se ještě počítá.');
    return false;
  }
  function stahniStl(dily, nazev) {
    if (!lzeExport()) return;
    app.stahni(KRAB.stlBinarni(dily, 'nozicky - ' + nazev), nazev.replace(/[\\/:*?"<>|]+/g, '_') + '.stl', 'model/stl');
  }
  const vse = () => true;
  const exStl = filtr => () => {
    if (!lzeExport()) return;
    const d = model.dily.filter(filtr);
    if (!d.length) { Dialog.info('V sadě nejsou žádné vložky – zapněte je v záložce Protiskluz TPU.'); return; }
    stahniStl(d, jmeno() + (filtr === vse ? '' : d[0].druh === 'vlozka' ? ' - vlozky TPU' : ' - hlavni dily'));
  };
  $('btnStl').addEventListener('click', exStl(vse));
  $('btnStl2').addEventListener('click', exStl(vse));
  $('btnStlHlavni').addEventListener('click', exStl(d => d.druh === 'hlavni'));
  $('btnStlVlozky').addEventListener('click', exStl(d => d.druh === 'vlozka'));
  const ex3mf = () => { if (lzeExport()) app.stahni(KRAB.soubor3mf(model.dily, app.p.nazev || 'Nožičky'), jmeno() + '.3mf', 'model/3mf'); };
  $('btn3mf').addEventListener('click', ex3mf); $('btn3mf2').addEventListener('click', ex3mf);

  /* ---------- zobrazení ---------- */
  TrubkyGui.pripoj({ klic: 'webapp_nozicky_gui', pohled: j => nahled.pohled(j) });
  barvyTematu();
  app.prepinac('tHrany', h => nahled.prepni('hrany', h));
  app.prepinac('tTisk', h => nahled.prepni('sada', h));
  app.prepinac('tDuch', h => nahled.prepni('duch', h));
  app.prepinac('tRez', h => { nahled.prepni('rez', h); $('legRez').hidden = !h; });
  app.prepinac('tPrevisy', h => { nahled.prepni('previsy', h); $('legPrevisy').hidden = !h; }, true);
  app.prepinac('tPravitka', h => nahled.prepni('pravitka', h), true);

  /* ---------- start ---------- */
  app.start({
    manifold: {
      ok: m => { w = m; prepocitej(); },
      chyba: e => { chybaJadra = '⚠ Geometrické jádro se nenačetlo (' + (e && e.message || e) + '). Kontroly fungují, náhled a export ne.'; prepocitej(); },
    },
  });
  window.NOZ_UI = { get p() { return app.p; }, get model() { return model; }, get ms() { return stavMs; }, zmen: app.zmen, nahled, skocNa: c => (document.querySelector(`[data-p="${c}"]`) ? app.jdiNaPole(c) : skocNa(c)), app };
})();

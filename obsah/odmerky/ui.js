/* Odměrky – ovládání stránky nad společným zapojením gen3d/aplikace.js:
   tady jen to, co je pro odměrky zvláštní (segmenty, viditelnost, písmo, předvolby, výsledky, kusovník). */
/* global ODM, NOZ_NAHLED, KRAB, FONTY, G3D, Dialog, TrubkyGui */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const fmt = ODM.fmt;
  let p = null, model = null, w = null, font = null, chybaStavby = null, chybaJadra = '', posledniUpozorneni = [];
  const nahled = NOZ_NAHLED.vytvorNahled($('platno'));
  nahled.stav.sada = false;
  for (const [k, m] of Object.entries(ODM.MATERIALY)) $('f_mat').add(new Option(m.nazev, k));
  for (const [k, j] of Object.entries(ODM.JEDNOTKY)) $('f_jedn').add(new Option(j.nazev, k));
  for (const t of ODM.OBSAHY) $('seznamObsahu').appendChild(new Option(t));
  for (const [k, s] of Object.entries(ODM.SUROVINY)) $('f_sur').add(new Option(`${s.nazev} (${fmt(s.gml, 2)} g/ml)`, k));

  const app = G3D.aplikace({
    typ: 'odmerky', nazev: 'Odměrky', klic: 'webapp_odmerky', soubor: 'odmerka',
    normalizuj: ODM.normalizuj, vychozi: () => ODM.vychoziProjekt(-1),
    ulozProjekt: ODM.ulozProjekt, nactiProjekt: ODM.nactiProjekt,
    vezmi: ODM.vezmi, poloz: ODM.poloz,
    popis: q => `${q.nazev || ODM.TYPY[q.typ] || 'odměrka'} – ${q.typ === 'sada' ? (q.sada || {}).seznam : (q.objem || {}).mnozstvi} ${(ODM.JEDNOTKY[q.jednotka] || {}).kratce || ''}`,
    viditelnost: () => viditelnost(),
    prepocitej: () => prepocitej(), zpozdeni: 80,
    png: () => nahled.png(), pohled: j => nahled.pohled(j),
    exportStl: () => exStl(),
    doModelare: () => (lzeExport() ? { data: KRAB.soubor3mf(model.dily, app.p.nazev || 'Odměrky'), pripona: '.3mf' } : null),
    zkratky: { m: 'tTisk', s: 'tTisk', r: 'tRez', h: 'tHrany', p: 'tPrevisy', l: 'tPravitka' },
    zmenaTematu: () => barvyTematu(),
    hlaseniNavic: (li, x) => skokNaSegment(li, x),
  });

  /* ---------- formulář: živá změna při psaní, segmenty, typ ---------- */
  /** Podmínka viditelnosti: "cesta=a|b", "cesta>0", "cesta?" (neprázdné); víc podmínek odděleno středníkem. */
  function plati(vyraz) {
    return vyraz.split(';').every(c => {
      const m = c.match(/^([\w.]+)(=|>|\?)(.*)$/);
      if (!m) return true;
      const h = ODM.vezmi(p, m[1]);
      if (m[2] === '?') return !!String(h ?? '').trim();
      return m[2] === '>' ? h > Number(m[3]) : m[3].split('|').includes(String(h));
    });
  }
  function viditelnost() {
    p = app.p;
    document.querySelectorAll('[data-volba]').forEach(g => {
      const h = ODM.vezmi(p, g.dataset.volba);
      g.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.h === h)));
    });
    document.querySelectorAll('[data-typ-dilu]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.typDilu === p.typ)));
    document.querySelectorAll('[data-pro]').forEach(el => { el.hidden = el.dataset.pro !== p.typ; });
    document.querySelectorAll('[data-kdy]').forEach(el => { el.hidden = !plati(el.dataset.kdy); });
    $('popDelka').textContent = p.rukojet.druh === 'ucho' ? 'Vyložení od stěny' : 'Délka od stěny';
    $('popOkraj').textContent = p.okraj.druh === 'srazeni' ? 'Velikost sražení' : 'Poloměr zaoblení';
  }
  // pole se přepočítají už při psaní (mez se vynutí až při opuštění pole – to dělá gen3d)
  document.querySelectorAll('input[data-p]').forEach(el => {
    if (el.type === 'checkbox') return;
    el.addEventListener('input', () => {
      const c = el.dataset.p;
      let h;
      if (el.dataset.typ === 'text') h = el.value;
      else {
        h = ODM.cislo(el.value, NaN);
        const m = ODM.MEZE[c];
        const spatne = !Number.isFinite(h) || (m && (h < m[0] || h > m[1]));
        el.classList.toggle('spatne', spatne);
        if (spatne) return;
      }
      app.zmen(x => ODM.poloz(x, c, h), 'psani:' + c);
    });
  });
  document.querySelectorAll('[data-volba]').forEach(g => g.addEventListener('click', e => {
    const b = e.target.closest('button[data-h]');
    if (b) { app.zmen(x => ODM.poloz(x, g.dataset.volba, b.dataset.h)); app.naplnFormular(); }
  }));
  document.querySelectorAll('[data-typ-dilu]').forEach(b => b.addEventListener('click', () => {
    app.zmen(x => { if (x.nazev === ODM.TYPY[x.typ] || !x.nazev) x.nazev = ODM.TYPY[b.dataset.typDilu]; x.typ = b.dataset.typDilu; });
    app.naplnFormular();
  }));

  /* ---------- předvolby ---------- */
  ODM.PREDVOLBY.forEach((pv, i) => {
    const b = document.createElement('button');
    b.className = 'pol'; b.setAttribute('role', 'menuitem');
    b.innerHTML = '<span></span><small></small>';
    b.firstChild.textContent = pv.nazev; b.lastChild.textContent = pv.popis;
    b.addEventListener('click', () => app.nahrad(ODM.vychoziProjekt(i)));
    $('seznamPredvoleb').appendChild(b);
  });

  /* ---------- náhled (sdílený s Nožičkami) ---------- */
  const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || '#888';
  const barvyTematu = () => nahled.barvy(css('--border-strong'), css('--border'), css('--text'));

  /* ---------- přepočet ---------- */
  function prepocitej() {
    p = app.p;
    if (w) {
      try { model = ODM.postav(w, p, font); chybaStavby = null; } catch (e) { model = null; chybaStavby = e.message; }
      if (model) nahled.nastav(model);
      posledniUpozorneni = model ? model.upozorneni : posledniUpozorneni.filter(x => !x.pole);
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
    let h = [...ODM.kontroly(p), ...posledniUpozorneni];
    if (posledniUpozorneni.some(x => x.uroven === 'varovani') && h[0].uroven === 'ok') h.shift();
    h = h.map(x => Object.assign({}, x, { pole: x.pole ? [x.pole] : [] }));
    app.hlaseni(h, { chybaStavby: chybaJadra || (chybaStavby ? 'Odměrku nelze sestavit: ' + chybaStavby : ''), boxy: ['boxVstup', 'boxVystup'] });
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
  function vypisVysledky() {
    const v = $('vysledky'); v.textContent = '';
    const tb = $('tDily'); tb.textContent = '';
    const karta = $('karta3d');
    souhrny();
    if (!model) { karta.textContent = ''; v.appendChild(dlazdice('Model', w || chybaJadra ? 'nelze sestavit' : 'načítám…', chybaJadra || chybaStavby || '')); return; }
    const kusy = model.odv.kusy, g = kusy[0], hl = model.kusy[0][0], b = KRAB.obal(hl.poz);
    const roz = `${fmt(b[3] - b[0])} × ${fmt(b[4] - b[1])} × ${fmt(b[5] - b[2])}`;
    const od = ODM.odhad(p, model.dily);
    const tiles = [];
    if (p.typ === 'odmerka') {
      tiles.push(['Objem', `${fmt(g.pol.ml, g.pol.ml < 20 ? 2 : 1)} ml`, g.pol.popis + (g.pol.jednotka === 'g' ? ` (${fmt(ODM.SUROVINY[p.surovina].gml, 2)} g/ml)` : '')]);
      tiles.push(['Dutina', `Ø ${fmt(2 * g.dut.rTop)} × ${fmt(g.dut.h)} mm`, `průměr nahoře × hloubka po ${p.stena.nadmira > 0 ? 'rysku' : 'okraj'}` + (g.dut.rDno ? `, dno Ø ${fmt(2 * g.dut.rDno)}` : '')]);
    } else tiles.push(['Sada', `${kusy.length} odměrek`, kusy.map(k => k.pol.text).join(' · ')]);
    tiles.push(['Rozměry kusu', roz + ' mm', p.typ === 'sada' ? 'největší odměrka s rukojetí' : 's rukojetí (X × Y × výška)']);
    tiles.push(['Přesnost', `± ${fmt(Math.max(...kusy.map(k => k.citlivost)), 1)} %`, 'změna objemu, když tisk vyjde o 0,1 mm jinak']);
    tiles.push(['Materiál', `${fmt(model.dily.reduce((s, d) => s + d.objem, 0) / 1000, 1)} cm³`, 'objem plastu všech kusů (plné stěny)']);
    tiles.push(['Hmotnost', `${fmt(od.hmotnost, 0)} g`, ODM.MATERIALY[p.material].nazev]);
    tiles.push(['Filament', `${fmt(od.filament, 1)} m`, 'průměr 1,75 mm']);
    tiles.push(['Doba tisku', '≈ ' + casText(od.cas), `${model.dily.length} ${model.dily.length === 1 ? 'kus' : model.dily.length < 5 ? 'kusy' : 'kusů'}, hrubý odhad`]);
    for (const t of tiles) v.appendChild(dlazdice(...t));
    kusy.forEach((k, i) => {
      const d = model.kusy[i][0], tr = document.createElement('tr');
      tr.innerHTML = '<td><span class="tecka"></span><span></span></td><td class="c"></td><td class="c"><button class="tl" type="button">STL</button></td>';
      tr.querySelector('.tecka').style.background = d.barva;
      tr.children[0].lastChild.textContent = k.pol.popis + (k.pol.jednotka === 'ml' ? '' : ` = ${fmt(k.pol.ml, k.pol.ml < 20 ? 2 : 1)} ml`);
      tr.children[1].textContent = `${fmt(2 * k.dut.rTop)} × ${fmt(k.dut.h)}`;
      const bt = tr.querySelector('button');
      bt.addEventListener('click', () => stahniStl([d], jmeno() + ' ' + k.pol.text));
      bt.setAttribute('aria-label', 'Stáhnout STL – ' + k.pol.popis);
      tb.appendChild(tr);
    });
    karta.innerHTML = `<b>${esc(p.typ === 'sada' ? p.nazev || 'Sada' : g.pol.popis)}</b><br>${p.typ === 'sada' ? esc(kusy.length + ' odměrek') : `Ø <b>${fmt(2 * g.dut.rTop)}</b> × <b>${fmt(g.dut.h)}</b> mm`}<br>${roz} mm`;
  }
  function souhrny() {
    const t = p.tvar, J = ODM.JEDNOTKY[p.jednotka];
    TrubkyGui.souhrn('sObjem', p.typ === 'sada' ? p.sada.seznam : `${p.objem.mnozstvi} ${J.kratce}`, true);
    TrubkyGui.souhrn('sTvar', { valec: 'válec', kuzel: `kužel ${fmt(t.uhel)}°`, miska: 'miska' }[t.tvar] + (t.urceni === 'prumer' ? `, Ø ${fmt(t.prumer)}` : ''), true);
    TrubkyGui.souhrn('sStena', `${fmt(p.stena.stena)} / ${fmt(p.stena.dno)} mm, ${ODM.MATERIALY[p.material].nazev}`, true);
    TrubkyGui.souhrn('sRukojet', { plocha: `plochá ${fmt(p.rukojet.delka)} mm`, ucho: 'ucho', zadna: 'bez' }[p.rukojet.druh], true);
    TrubkyGui.souhrn('sOkraj', { rovny: 'rovný', zaobleni: `zaoblený ${fmt(p.okraj.velikost, 1)}`, srazeni: `sražený ${fmt(p.okraj.velikost, 1)}` }[p.okraj.druh] + (p.vylevka.pouzit ? ', výlevka' : ''), true);
    $('sPopisek').textContent = [p.popisek.kde === 'nikde' ? '' : p.popisek.kde === 'dno' ? 've dně' : 'na rukojeti', ODM.textObsahu(p)].filter(Boolean).join(' · ');
    $('sStupnice').textContent = p.typ === 'odmerka' && p.stupnice.pouzit ? `po ${p.stupnice.krok}` : '';
    $('sTisk').textContent = p.typ === 'odmerka' ? `${p.kusu} ks` : '';
  }

  /* ---------- export ---------- */
  const jmeno = () => (app.p.nazev || 'odmerka').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'odmerka';
  function lzeExport() {
    if (model) return true;
    Dialog.chyba(chybaStavby ? 'Odměrku nelze sestavit: ' + chybaStavby : 'Geometrie se ještě počítá.');
    return false;
  }
  function stahniStl(dily, nazev) {
    if (!lzeExport()) return;
    app.stahni(KRAB.stlBinarni(dily, 'odmerky - ' + nazev), nazev.replace(/[\\/:*?"<>|]+/g, '_') + '.stl', 'model/stl');
  }
  const exStl = () => { if (lzeExport()) stahniStl(model.dily, jmeno()); };
  const ex3mf = () => { if (lzeExport()) app.stahni(KRAB.soubor3mf(model.dily, app.p.nazev || 'Odměrky'), jmeno() + '.3mf', 'model/3mf'); };
  $('btnStl').addEventListener('click', exStl); $('btnStl2').addEventListener('click', exStl);
  $('btn3mf').addEventListener('click', ex3mf); $('btn3mf2').addEventListener('click', ex3mf);

  /* ---------- zobrazení ---------- */
  TrubkyGui.pripoj({ klic: 'webapp_odmerky_gui', pohled: j => nahled.pohled(j) });
  barvyTematu();
  app.prepinac('tHrany', h => nahled.prepni('hrany', h));
  app.prepinac('tTisk', h => nahled.prepni('sada', h));
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
  FONTY.opentype('libsans').then(f => { font = f; app.prepocitej(); })
    .catch(() => { posledniUpozorneni = [{ uroven: 'varovani', text: 'Písmo se nenačetlo – odměrky budou bez popisků a čísel.', pole: null }]; app.prepocitej(); });
  window.ODM_UI = { get p() { return app.p; }, get model() { return model; }, zmen: app.zmen, nahled, skocNa: c => (document.querySelector(`[data-p="${c}"]`) ? app.jdiNaPole(c) : skocNa(c)), app };
})();

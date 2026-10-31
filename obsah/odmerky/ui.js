/* Odměrky – ovládání stránky: formulář, předvolby, písmo, přepočet přes manifold, výsledky, kontroly, export. */
/* global ODM, NOZ_NAHLED, KRAB, FONTY, Dialog, Tvary, TrubkyGui */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const KLIC = 'webapp_odmerky_projekt';
  const fmt = ODM.fmt;
  let p = null, model = null, w = null, font = null, chybaStavby = null;

  /* ---------- manifold a písmo ---------- */
  function nactiSkript(src) {
    return new Promise((ok, ne) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => ne(new Error('Nelze načíst ' + src)); document.head.appendChild(s); });
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
    const m = await globalThis.ManifoldModule(volby);
    m.setup();
    return m;
  }

  /* ---------- stav ---------- */
  function nactiUlozeny() {
    try { const t = localStorage.getItem(KLIC); if (t) return ODM.normalizuj(JSON.parse(t)).p; } catch (e) { /* poškozený záznam */ }
    return ODM.vychoziProjekt(-1);
  }
  function uloz() { try { localStorage.setItem(KLIC, JSON.stringify(p)); } catch (e) { /* plné nebo zakázané úložiště */ } }
  function zmen(fn) { fn(p); p = ODM.normalizuj(p).p; uloz(); obnovFormular(false); prepocitej(); }

  /* ---------- formulář ---------- */
  const pole = [...document.querySelectorAll('[data-p]')];
  for (const [k, m] of Object.entries(ODM.MATERIALY)) $('f_mat').add(new Option(m.nazev, k));
  for (const [k, j] of Object.entries(ODM.JEDNOTKY)) $('f_jedn').add(new Option(j.nazev, k));
  for (const t of ODM.OBSAHY) $('seznamObsahu').appendChild(new Option(t));
  for (const [k, s] of Object.entries(ODM.SUROVINY)) $('f_sur').add(new Option(`${s.nazev} (${fmt(s.gml, 2)} g/ml)`, k));
  const zobraz = x => String(Math.round(x * 1e4) / 1e4).replace('.', ',');

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
  function obnovFormular(vse = true) {
    for (const el of pole) {
      const h = ODM.vezmi(p, el.dataset.p);
      if (el.type === 'checkbox') el.checked = !!h;
      else if (vse || document.activeElement !== el) { el.value = el.dataset.typ === 'text' ? (h ?? '') : zobraz(h); el.classList.remove('spatne'); }
    }
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
  for (const el of pole) {
    const akce = konecne => {
      const c = el.dataset.p;
      let h;
      if (el.type === 'checkbox') h = el.checked;
      else if (el.dataset.typ === 'text') h = el.value;
      else {
        h = ODM.cislo(el.value, NaN);
        const m = ODM.MEZE[c];
        const spatne = !Number.isFinite(h) || (m && (h < m[0] || h > m[1]));
        el.classList.toggle('spatne', spatne);
        if (!Number.isFinite(h)) return;
        if (spatne && !konecne) return;     // během psaní nevnucovat mez, až při opuštění pole
      }
      zmen(x => ODM.poloz(x, c, h));
      if (konecne) { el.classList.remove('spatne'); obnovFormular(true); }
    };
    el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', () => akce(el.type === 'checkbox' || el.tagName === 'SELECT'));
    if (el.tagName === 'INPUT' && el.type !== 'checkbox') {
      el.addEventListener('change', () => akce(true));
      // šipky ± 1 (Shift × 10, Alt po 0,1)
      if (el.dataset.typ !== 'text') el.addEventListener('keydown', e => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        e.preventDefault();
        const krok = (e.shiftKey ? 10 : e.altKey ? 0.1 : 1) * (e.key === 'ArrowUp' ? 1 : -1);
        const x = ODM.cislo(el.value, ODM.vezmi(p, el.dataset.p));
        el.value = zobraz(Math.round((x + krok) * 100) / 100);
        akce(true);
      });
    }
  }
  document.querySelectorAll('[data-volba]').forEach(g => g.addEventListener('click', e => {
    const b = e.target.closest('button[data-h]');
    if (b) zmen(x => ODM.poloz(x, g.dataset.volba, b.dataset.h));
  }));
  document.querySelectorAll('[data-typ-dilu]').forEach(b => b.addEventListener('click', () => {
    zmen(x => { if (x.nazev === ODM.TYPY[x.typ] || !x.nazev) x.nazev = ODM.TYPY[b.dataset.typDilu]; x.typ = b.dataset.typDilu; });
  }));

  /* ---------- předvolby ---------- */
  ODM.PREDVOLBY.forEach((pv, i) => {
    const b = document.createElement('button');
    b.className = 'pol'; b.setAttribute('role', 'menuitem');
    b.innerHTML = '<span></span><small></small>';
    b.firstChild.textContent = pv.nazev; b.lastChild.textContent = pv.popis;
    b.addEventListener('click', () => { p = ODM.vychoziProjekt(i); uloz(); obnovFormular(); prepocitej(); });
    $('seznamPredvoleb').appendChild(b);
  });

  /* ---------- náhled (sdílený s Nožičkami) ---------- */
  const nahled = NOZ_NAHLED.vytvorNahled($('platno'));
  const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || '#888';
  const barvyTematu = () => nahled.barvy(css('--border-strong'), css('--border'), css('--text'));
  new MutationObserver(barvyTematu).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  function prepinac(id, co) {
    const b = $(id);
    b.setAttribute('aria-pressed', String(nahled.stav[co]));
    b.addEventListener('click', () => { const h = !nahled.stav[co]; nahled.prepni(co, h); b.setAttribute('aria-pressed', String(h)); });
  }
  nahled.stav.sada = false;
  prepinac('tSada', 'sada'); prepinac('tRez', 'rez'); prepinac('tHrany', 'hrany');

  /* ---------- přepočet ---------- */
  let ceka = null, posledniUpozorneni = [];
  function prepocitej() {
    vypisKontroly(ODM.kontroly(p));
    if (!w) return;
    clearTimeout(ceka);
    ceka = setTimeout(() => {
      try { model = ODM.postav(w, p, font); chybaStavby = null; } catch (e) { model = null; chybaStavby = e.message; }
      const st = $('stav3d');
      st.classList.toggle('chyba', !!chybaStavby);
      st.textContent = chybaStavby ? '⚠ ' + chybaStavby : '';
      $('canvas-container').classList.toggle('je-neplatne', !!chybaStavby);
      if (model) nahled.nastav(model);
      posledniUpozorneni = model ? model.upozorneni : [];
      vypisKontroly(ODM.kontroly(p));
      vypisVysledky();
    }, 80);
  }

  /* ---------- kontroly ---------- */
  function popisPole(cesta) {
    const el = cesta && document.querySelector(`[data-p="${cesta}"]`);
    if (el) { const l = el.id && document.querySelector(`label[for="${el.id}"]`); return l ? l.textContent : (el.closest('label') || {}).textContent; }
    const g = cesta && document.querySelector(`[data-volba="${cesta}"]`);
    return g ? g.getAttribute('aria-label') : '';
  }
  function skocNa(cesta) {
    const cil = document.querySelector(`[data-p="${cesta}"]`) || document.querySelector(`[data-volba="${cesta}"]`);
    if (!cil) return;
    const zal = cil.closest('.zalozka-telo');
    if (zal) TrubkyGui.otevriZalozku(zal.dataset.telo);
    else if (cil.closest('.box-in')) TrubkyGui.ukazBox('in');
    const od = cil.closest('details'); if (od) od.open = true;
    const zv = cil.closest('.pole') || cil.closest('.zaskrt') || cil;
    zv.scrollIntoView({ block: 'center', behavior: 'smooth' });
    zv.classList.remove('zvyrazni'); void zv.offsetWidth; zv.classList.add('zvyrazni');
    if (cil.focus) cil.focus({ preventScroll: true });
  }
  function vypisKontroly(h0) {
    const h = [...h0, ...posledniUpozorneni];
    if (posledniUpozorneni.some(x => x.uroven === 'varovani') && h[0].uroven === 'ok') h.shift();
    const ul = $('hlaseni'); ul.textContent = '';
    for (const x of h) {
      const li = document.createElement('li');
      li.className = x.uroven; li.textContent = (x.uroven === 'chyba' ? '✖ ' : x.uroven === 'varovani' ? '⚠ ' : x.uroven === 'ok' ? '✔ ' : 'ℹ ') + x.text;
      if (x.pole) {
        li.classList.add('skok'); li.tabIndex = 0;
        const k = document.createElement('span'); k.className = 'kam'; k.textContent = '→ ' + (popisPole(x.pole) || x.pole); li.appendChild(k);
        li.addEventListener('click', () => skocNa(x.pole));
        li.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); skocNa(x.pole); } });
      }
      ul.appendChild(li);
    }
    const nCh = h.filter(x => x.uroven === 'chyba').length, nVa = h.filter(x => x.uroven === 'varovani').length;
    const od = $('stavOdznak');
    od.className = 'odznak ' + (nCh ? 'chyba' : nVa ? 'mez' : 'ok');
    od.textContent = nCh ? `✖ ${nCh} ${nCh === 1 ? 'chyba' : nCh < 5 ? 'chyby' : 'chyb'}` : nVa ? `⚠ ${nVa} varování` : '✔ v pořádku';
    TrubkyGui.oznacChybu('boxVstup', h.some(x => x.uroven === 'chyba' && x.pole && !/^(tisk|popisek|stupnice|kusu|mezera)/.test(x.pole)));
  }

  /* ---------- výsledky ---------- */
  const casText = s => { const m = Math.round(s / 60); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
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
    if (!model) { karta.textContent = ''; return; }
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
    tiles.push(['Hmotnost', `${fmt(od.hmotnost, 0)} g`, `filament ${fmt(od.filament, 1)} m · ${ODM.MATERIALY[p.material].nazev}`]);
    tiles.push(['Doba tisku', '≈ ' + casText(od.cas), `${model.dily.length} ${model.dily.length === 1 ? 'kus' : model.dily.length < 5 ? 'kusy' : 'kusů'}, hrubý odhad`]);
    for (const t of tiles) v.appendChild(dlazdice(...t));
    kusy.forEach((k, i) => {
      const d = model.kusy[i][0], tr = document.createElement('tr');
      tr.innerHTML = '<td><span class="tecka"></span><span></span></td><td class="c"></td><td class="c"><button class="tl" type="button">STL</button></td>';
      tr.querySelector('.tecka').style.background = d.barva;
      tr.children[0].lastChild.textContent = k.pol.popis + (k.pol.jednotka === "ml" ? "" : ` = ${fmt(k.pol.ml, k.pol.ml < 20 ? 2 : 1)} ml`);
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
  const jmeno = () => (p.nazev || 'odmerka').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'odmerka';
  function stahni(data, nazev, typ) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([data], { type: typ }));
    a.download = nazev; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  function lzeExport() {
    if (model) return true;
    Dialog.chyba(chybaStavby ? 'Odměrku nelze sestavit: ' + chybaStavby : 'Geometrie se ještě počítá.');
    return false;
  }
  function stahniStl(dily, nazev) {
    if (!lzeExport()) return;
    stahni(KRAB.stlBinarni(dily, 'odmerky - ' + nazev), nazev.replace(/[\\/:*?"<>|]+/g, '_') + '.stl', 'model/stl');
  }
  const exStl = () => { if (lzeExport()) stahniStl(model.dily, jmeno()); };
  const ex3mf = () => { if (lzeExport()) stahni(KRAB.soubor3mf(model.dily, p.nazev || 'Odměrky'), jmeno() + '.3mf', 'model/3mf'); };
  $('btnStl').addEventListener('click', exStl); $('btnStl2').addEventListener('click', exStl);
  $('btn3mf').addEventListener('click', ex3mf); $('btn3mf2').addEventListener('click', ex3mf);
  $('btnPng').addEventListener('click', () => { const a = document.createElement('a'); a.href = nahled.png(); a.download = jmeno() + '.png'; a.click(); });
  $('btnUlozit').addEventListener('click', () => stahni(ODM.ulozProjekt(p), jmeno() + '.json', 'application/json'));
  $('btnNacist').addEventListener('click', () => $('soubor').click());
  $('soubor').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try {
      const r = ODM.nactiProjekt(await f.text());
      p = r.p; uloz(); obnovFormular(); prepocitej();
      if (r.hlaseni.length) Dialog.info('Projekt načten s úpravami: ' + r.hlaseni.join('; ') + '.');
    } catch (err) { Dialog.chyba(err.message); }
  });
  $('btnVychozi').addEventListener('click', async () => {
    if (!(await Dialog.potvrd('Vrátit všechna nastavení na výchozí hodnoty?'))) return;
    p = ODM.vychoziProjekt(-1); uloz(); obnovFormular(); prepocitej();
  });

  /* ---------- nápověda, klávesy ---------- */
  $('btnNapoveda').addEventListener('click', () => $('dlgNapoveda').showModal());
  $('btnZavritNap').addEventListener('click', () => $('dlgNapoveda').close());
  $('stavOdznak').addEventListener('click', () => { TrubkyGui.ukazBox('out'); $('hlaseni').scrollIntoView({ block: 'start', behavior: 'smooth' }); });
  document.addEventListener('keydown', e => {
    const a = document.activeElement;
    const vPoli = a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || (a.tagName === 'INPUT' && !/checkbox|range|radio|button/.test(a.type));
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); exStl(); return; }
    if (e.key === 'F1') { e.preventDefault(); $('dlgNapoveda').showModal(); return; }
    if (vPoli || e.ctrlKey || e.metaKey || e.altKey || $('dlgNapoveda').open) return;
    const k = e.key.toLowerCase();
    const pohledy = { 1: 'iso', 2: 'shora', 3: 'zboku', 4: 'zespodu' };
    if (pohledy[k]) nahled.pohled(pohledy[k]);
    else if (k === 's') $('tSada').click(); else if (k === 'r') $('tRez').click(); else if (k === 'h') $('tHrany').click();
  });

  TrubkyGui.pripoj({ klic: 'webapp_odmerky_gui', pohled: j => nahled.pohled(j) });

  if (typeof Tvary !== 'undefined') Tvary.pripoj({
    klic: 'webapp_odmerky_tvary', typ: 'odmerky', nazev: 'Odměrky', kontejner: $('tvary'),
    parametry: () => ODM.kopie(p),
    pouzij: q => { p = ODM.normalizuj(q).p; uloz(); obnovFormular(); prepocitej(); },
    popis: q => `${q.nazev || ODM.TYPY[q.typ] || 'odměrka'} – ${q.typ === 'sada' ? (q.sada || {}).seznam : (q.objem || {}).mnozstvi} ${(ODM.JEDNOTKY[q.jednotka] || {}).kratce || ''}`,
  });

  /* ---------- start ---------- */
  p = nactiUlozeny();
  obnovFormular();
  barvyTematu();
  prepocitej();
  $('stav3d').textContent = 'Načítám geometrické jádro (manifold)…';
  nactiManifold().then(m => { w = m; $('stav3d').textContent = ''; prepocitej(); })
    .catch(e => { const st = $('stav3d'); st.classList.add('chyba'); st.textContent = '⚠ Geometrické jádro se nenačetlo (' + e.message + '). Kontroly fungují, náhled a export ne.'; });
  FONTY.opentype('libsans').then(f => { font = f; prepocitej(); })
    .catch(() => { posledniUpozorneni = [{ uroven: 'varovani', text: 'Písmo se nenačetlo – odměrky budou bez popisků a čísel.', pole: null }]; });
  window.ODM_UI = { get p() { return p; }, get model() { return model; }, zmen, nahled, skocNa };
})();

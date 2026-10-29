/* Nožičky – ovládání stránky: formulář, předvolby, přepočet přes manifold, výsledky, kontroly, export. */
/* global NOZ, NOZ_NAHLED, KRAB, Dialog, Tvary, TrubkyGui */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const KLIC = 'webapp_nozicky_projekt';
  const fmt = NOZ.fmt;
  let p = null, model = null, w = null, chybaStavby = null;

  /* ---------- manifold ---------- */
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
    try { const t = localStorage.getItem(KLIC); if (t) return NOZ.normalizuj(JSON.parse(t)).p; } catch (e) { /* poškozený záznam */ }
    return NOZ.vychoziProjekt(-1);
  }
  function uloz() { try { localStorage.setItem(KLIC, JSON.stringify(p)); } catch (e) { /* plné nebo zakázané úložiště */ } }
  function zmen(fn) { fn(p); p = NOZ.normalizuj(p).p; uloz(); obnovFormular(false); prepocitej(); }

  /* ---------- formulář ---------- */
  const pole = [...document.querySelectorAll('[data-p]')];
  const sel = $('f_mat');
  for (const [k, m] of Object.entries(NOZ.MATERIALY)) sel.add(new Option(m.nazev, k));
  const zobraz = x => String(Math.round(x * 1e4) / 1e4).replace('.', ',');

  /** Podmínka viditelnosti: "cesta=a|b", "cesta>0"; víc podmínek odděleno středníkem. */
  function plati(vyraz) {
    return vyraz.split(';').every(c => {
      const m = c.match(/^([\w.]+)(=|>)(.*)$/);
      if (!m) return true;
      const h = NOZ.vezmi(p, m[1]);
      return m[2] === '>' ? h > Number(m[3]) : m[3].split('|').includes(String(h));
    });
  }
  function obnovFormular(vse = true) {
    for (const el of pole) {
      const h = NOZ.vezmi(p, el.dataset.p);
      if (el.type === 'checkbox') el.checked = !!h;
      else if (vse || document.activeElement !== el) { el.value = el.dataset.typ === 'text' ? (h ?? '') : zobraz(h); el.classList.remove('spatne'); }
    }
    document.querySelectorAll('[data-volba]').forEach(g => {
      const h = NOZ.vezmi(p, g.dataset.volba);
      g.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.h === h)));
    });
    document.querySelectorAll('[data-typ-dilu]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.typDilu === p.typ)));
    document.querySelectorAll('[data-pro]').forEach(el => { el.hidden = el.dataset.pro !== p.typ; });
    document.querySelectorAll('[data-kdy]').forEach(el => { el.hidden = !plati(el.dataset.kdy); });
    const tvar = p.pantofle.profil === 'ctverec' ? 'Strana nohy' : 'Šířka nohy (ve směru sklonu)';
    document.querySelector('[data-pop="pantofle"]').textContent = tvar;
  }
  for (const el of pole) {
    const akce = konecne => {
      const c = el.dataset.p;
      let h;
      if (el.type === 'checkbox') h = el.checked;
      else if (el.dataset.typ === 'text') h = el.value;
      else {
        h = NOZ.cislo(el.value, NaN);
        const m = NOZ.MEZE[c];
        const spatne = !Number.isFinite(h) || (m && (h < m[0] || h > m[1]));
        el.classList.toggle('spatne', spatne);
        if (!Number.isFinite(h)) return;
        if (spatne && !konecne) return;     // během psaní nevnucovat mez, až při opuštění pole
      }
      zmen(x => NOZ.poloz(x, c, h));
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
        const x = NOZ.cislo(el.value, NOZ.vezmi(p, el.dataset.p));
        el.value = zobraz(Math.round((x + krok) * 100) / 100);
        akce(true);
      });
    }
  }
  document.querySelectorAll('[data-volba]').forEach(g => g.addEventListener('click', e => {
    const b = e.target.closest('button[data-h]');
    if (b) zmen(x => NOZ.poloz(x, g.dataset.volba, b.dataset.h));
  }));
  document.querySelectorAll('[data-typ-dilu]').forEach(b => b.addEventListener('click', () => {
    zmen(x => { if (x.nazev === NOZ.TYPY[x.typ] || !x.nazev) x.nazev = NOZ.TYPY[b.dataset.typDilu]; x.typ = b.dataset.typDilu; });
  }));

  /* ---------- předvolby ---------- */
  const seznam = $('seznamPredvoleb');
  NOZ.PREDVOLBY.forEach((pv, i) => {
    const b = document.createElement('button');
    b.className = 'pol'; b.setAttribute('role', 'menuitem');
    b.innerHTML = `<span></span><small></small>`;
    b.firstChild.textContent = pv.nazev; b.lastChild.textContent = pv.popis;
    b.addEventListener('click', () => { p = NOZ.vychoziProjekt(i); uloz(); obnovFormular(); prepocitej(); });
    seznam.appendChild(b);
  });

  /* ---------- náhled ---------- */
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
  prepinac('tSada', 'sada'); prepinac('tDuch', 'duch'); prepinac('tRez', 'rez'); prepinac('tHrany', 'hrany');

  /* ---------- přepočet ---------- */
  let ceka = null;
  function prepocitej() {
    const h = NOZ.kontroly(p);
    vypisKontroly(h);
    if (!w) return;
    clearTimeout(ceka);
    ceka = setTimeout(() => {
      const t0 = performance.now();
      try { model = NOZ.postav(w, p); chybaStavby = null; } catch (e) { model = null; chybaStavby = e.message; }
      const st = $('stav3d');
      st.classList.toggle('chyba', !!chybaStavby);
      st.textContent = chybaStavby ? '⚠ ' + chybaStavby : '';
      $('canvas-container').classList.toggle('je-neplatne', !!chybaStavby);
      if (model) nahled.nastav(model);
      vypisVysledky(performance.now() - t0);
    }, 60);
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
  function vypisKontroly(h) {
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
    od.textContent = nCh ? `✖ ${nCh} ${nCh === 1 ? 'chyba' : nCh < 5 ? 'chyby' : 'chyb'}` : nVa ? `⚠ ${nVa} ${nVa === 1 ? 'varování' : 'varování'}` : '✔ v pořádku';
    TrubkyGui.oznacChybu('boxVstup', h.some(x => x.uroven === 'chyba' && x.pole && !/^(tisk|protiskluz|kusu|mezera)/.test(x.pole)));
  }

  /* ---------- výsledky ---------- */
  const casText = s => { const m = Math.round(s / 60); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`; };
  function dlazdice(popis, cislo, dalsi) {
    const d = document.createElement('div'); d.className = 'dlazdice';
    d.innerHTML = '<div class="popis"></div><div class="cislo"></div>' + (dalsi ? '<div class="dalsi"></div>' : '');
    d.children[0].textContent = popis; d.children[1].textContent = cislo; if (dalsi) d.children[2].textContent = dalsi;
    return d;
  }
  function vypisVysledky(ms) {
    const v = $('vysledky'); v.textContent = '';
    const tb = $('tDily'); tb.textContent = '';
    const karta = $('karta3d');
    if (!model) { karta.textContent = ''; return; }
    const o = NOZ.odvozene(p), hl = model.kus.find(d => d.druh === 'hlavni'), b = NOZ.obal(hl.poz);
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
    tiles.push(['Hmotnost sady', `${fmt(od.hmotnost, 0)} g`, (od.hmotnostTpu ? `+ ${fmt(od.hmotnostTpu, 1)} g TPU · ` : '') + `filament ${fmt(od.filament, 1)} m · výplň ${fmt(p.tisk.vypln, 0)} %`]);
    tiles.push(['Doba tisku', '≈ ' + casText(od.cas), `${model.dily.length} ${model.dily.length < 5 ? 'díly' : 'dílů'}, hrubý odhad`]);
    for (const t of tiles) v.appendChild(dlazdice(...t));
    // díly jednoho kusu ke stažení
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
    // souhrny
    TrubkyGui.souhrn('sNozicka', `${{ valec: 'válec', kuzel: 'kužel', kopule: 'kopule' }[p.nozicka.tvar]} Ø ${fmt(p.nozicka.d)} × ${fmt(p.nozicka.vyska)}`, true);
    TrubkyGui.souhrn('sUpevneni', { sroub: `šroub Ø ${fmt(p.nozicka.otvor)}`, lepeni: 'lepení', cep: `čep Ø ${fmt(o.cepPrumer || 0, 2)}` }[p.nozicka.upevneni], true);
    TrubkyGui.souhrn('sPantofle', `${p.pantofle.profil === 'kruh' ? 'Ø ' + fmt(p.pantofle.d) : fmt(p.pantofle.a) + (p.pantofle.profil === 'obdelnik' ? ' × ' + fmt(p.pantofle.b) : '')}${p.pantofle.sklon ? ', sklon ' + fmt(p.pantofle.sklon) + '°' : ''}`, true);
    TrubkyGui.souhrn('sKrytka', `${p.krytka.profil === 'kruh' ? 'Ø ' + fmt(p.krytka.d) : fmt(p.krytka.a) + (p.krytka.profil === 'obdelnik' ? ' × ' + fmt(p.krytka.b) : '')} × ${fmt(p.krytka.s)}`, true);
    TrubkyGui.souhrn('sKrytka2', p.krytka.druh === 'vnitrni' ? `do trubky, ${o.pocetLamel || p.krytka.lamel} lamel` : 'přes trubku', true);
    TrubkyGui.souhrn('sPodlozka', p.podlozka.rezim === 'klin' ? `klín ${fmt(p.podlozka.sklon)}°` : `sada ${p.kusu} ks`, true);
    TrubkyGui.souhrn('sSpolecne', `${NOZ.MATERIALY[p.material].nazev}, vůle ${fmt(p.vule, 2)} mm`, true);
    $('sTisk').textContent = `${p.kusu} ks`;
    $('sProtiskluz').textContent = o.protiskluz ? 'zapnuto' : '';
    stavMs = ms;
  }
  let stavMs = 0;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- export ---------- */
  const jmeno = () => (p.nazev || 'dil').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'dil';
  function stahni(data, nazev, typ) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([data], { type: typ }));
    a.download = nazev; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  function lzeExport() {
    if (model) return true;
    Dialog.chyba(chybaStavby ? 'Díl nelze sestavit: ' + chybaStavby : 'Geometrie se ještě počítá.');
    return false;
  }
  function stahniStl(dily, nazev) {
    if (!lzeExport()) return;
    stahni(KRAB.stlBinarni(dily, 'nozicky - ' + nazev), nazev.replace(/[\\/:*?"<>|]+/g, '_') + '.stl', 'model/stl');
  }
  const exStl = filtr => () => {
    if (!lzeExport()) return;
    const d = model.dily.filter(filtr);
    if (!d.length) { Dialog.info('V sadě nejsou žádné vložky – zapněte je v záložce Protiskluz TPU.'); return; }
    stahniStl(d, jmeno() + (filtr === vse ? '' : d[0].druh === 'vlozka' ? ' - vlozky TPU' : ' - hlavni dily'));
  };
  const vse = () => true;
  $('btnStl').addEventListener('click', exStl(vse));
  $('btnStl2').addEventListener('click', exStl(vse));
  $('btnStlHlavni').addEventListener('click', exStl(d => d.druh === 'hlavni'));
  $('btnStlVlozky').addEventListener('click', exStl(d => d.druh === 'vlozka'));
  const ex3mf = () => { if (lzeExport()) stahni(KRAB.soubor3mf(model.dily, p.nazev || 'Nožičky'), jmeno() + '.3mf', 'model/3mf'); };
  $('btn3mf').addEventListener('click', ex3mf); $('btn3mf2').addEventListener('click', ex3mf);
  $('btnPng').addEventListener('click', () => { const a = document.createElement('a'); a.href = nahled.png(); a.download = jmeno() + '.png'; a.click(); });
  $('btnUlozit').addEventListener('click', () => stahni(NOZ.ulozProjekt(p), jmeno() + '.json', 'application/json'));
  $('btnNacist').addEventListener('click', () => $('soubor').click());
  $('soubor').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try {
      const r = NOZ.nactiProjekt(await f.text());
      p = r.p; uloz(); obnovFormular(); prepocitej();
      if (r.hlaseni.length) Dialog.info('Projekt načten s úpravami: ' + r.hlaseni.join('; ') + '.');
    } catch (err) { Dialog.chyba(err.message); }
  });
  $('btnVychozi').addEventListener('click', async () => {
    if (!(await Dialog.potvrd('Vrátit všechna nastavení na výchozí hodnoty?'))) return;
    p = NOZ.vychoziProjekt(-1); uloz(); obnovFormular(); prepocitej();
  });

  /* ---------- nápověda, klávesy ---------- */
  $('btnNapoveda').addEventListener('click', () => $('dlgNapoveda').showModal());
  $('btnZavritNap').addEventListener('click', () => $('dlgNapoveda').close());
  $('stavOdznak').addEventListener('click', () => { TrubkyGui.ukazBox('out'); $('hlaseni').scrollIntoView({ block: 'start', behavior: 'smooth' }); });
  document.addEventListener('keydown', e => {
    const a = document.activeElement;
    const vPoli = a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || (a.tagName === 'INPUT' && !/checkbox|range|radio|button/.test(a.type));
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); exStl(vse)(); return; }
    if (e.key === 'F1') { e.preventDefault(); $('dlgNapoveda').showModal(); return; }
    if (vPoli || e.ctrlKey || e.metaKey || e.altKey || $('dlgNapoveda').open) return;
    const k = e.key.toLowerCase();
    const pohledy = { 1: 'iso', 2: 'shora', 3: 'zboku', 4: 'zespodu' };
    if (pohledy[k]) nahled.pohled(pohledy[k]);
    else if (k === 's') $('tSada').click(); else if (k === 'd') $('tDuch').click(); else if (k === 'r') $('tRez').click(); else if (k === 'h') $('tHrany').click();
  });

  TrubkyGui.pripoj({ klic: 'webapp_nozicky_gui', pohled: j => nahled.pohled(j) });

  if (typeof Tvary !== 'undefined') Tvary.pripoj({
    klic: 'webapp_nozicky_tvary', typ: 'nozicky', nazev: 'Nožičky a krytky', kontejner: $('tvary'),
    parametry: () => NOZ.kopie(p),
    pouzij: q => { p = NOZ.normalizuj(q).p; uloz(); obnovFormular(); prepocitej(); },
    popis: q => `${q.nazev || NOZ.TYPY[q.typ] || 'díl'} – ${NOZ.TYPY[q.typ] || ''}, ${q.kusu || 1} ks`,
  });

  /* ---------- start ---------- */
  p = nactiUlozeny();
  obnovFormular();
  barvyTematu();
  prepocitej();
  $('stav3d').textContent = 'Načítám geometrické jádro (manifold)…';
  nactiManifold().then(m => { w = m; $('stav3d').textContent = ''; prepocitej(); })
    .catch(e => { const st = $('stav3d'); st.classList.add('chyba'); st.textContent = '⚠ Geometrické jádro se nenačetlo (' + e.message + '). Kontroly fungují, náhled a export ne.'; });
  window.NOZ_UI = { get p() { return p; }, get model() { return model; }, get ms() { return stavMs; }, zmen, nahled, skocNa };
})();

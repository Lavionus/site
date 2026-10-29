/* Klíčenky a jmenovky – ovládání stránky: formulář, historie, písmo, manifold, náhled, pokyny pro výměnu barvy, dávka, export. */
/* global KLIC, KLIC_NAHLED, KRAB, FONTY, Dialog, Tvary, TrubkyGui */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const KLIC_PROJEKT = 'webapp_klicenky_projekt';
  const fmt = KLIC.fmt;

  /* ---------- stav a historie ---------- */
  let p, model = null, wasm = null, font = null, fontId = null, chybaJadra = '';
  const zpet = [], znovu = [];
  function hlasPrevod(hlaseni, co) { if (hlaseni && hlaseni.length) setTimeout(() => Dialog.info(`${co} upraven: ${hlaseni.join('; ')}.`), 300); }
  function nactiUlozeny() {
    try { const t = localStorage.getItem(KLIC_PROJEKT); if (t) { const r = KLIC.normalizuj(JSON.parse(t)); hlasPrevod(r.hlaseni, 'Uložený projekt'); return r.p; } }
    catch (e) { /* poškozený záznam */ }
    return KLIC.normalizuj({}).p;
  }
  function uloz() { try { localStorage.setItem(KLIC_PROJEKT, JSON.stringify(p)); } catch (e) { /* plné úložiště */ } }
  function zmen(fn, slouceni) {
    const pred = JSON.stringify(p);
    fn(p);
    p = KLIC.normalizuj(p).p;
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
    p = KLIC.normalizuj(JSON.parse(z.pop().stav)).p;
    naplnFormular(); po();
  }
  function po() { $('btnZpet').disabled = !zpet.length; $('btnZnovu').disabled = !znovu.length; uloz(); naplanuj(); }
  function nahrad(q) { zmen(x => { Object.keys(x).forEach(k => delete x[k]); Object.assign(x, q); }); naplnFormular(); }

  /* ---------- formulář ---------- */
  const pole = [...document.querySelectorAll('[data-p]')];
  function viditelnost() {
    document.querySelectorAll('[data-jen]').forEach(el => { el.hidden = !el.dataset.jen.split(' ').includes(p.text.rezim); });
    document.querySelectorAll('[data-tvar]').forEach(el => { el.hidden = !el.dataset.tvar.split(' ').includes(p.podklad.tvar); });
    $('gPevny').hidden = !p.podklad.pevny;
  }
  function naplnFormular() {
    for (const el of pole) {
      const h = KLIC.vezmi(p, el.dataset.p);
      if (el.type === 'checkbox') el.checked = !!h;
      else if (document.activeElement !== el) el.value = el.dataset.typ === 'text' ? String(h ?? '') : String(h).replace('.', ',');
      el.classList.remove('spatne');
    }
    if (vyberPisma) vyberPisma.hodnota = p.text.pismo;
    viditelnost();
  }
  for (const el of pole) {
    const akce = () => {
      const c = el.dataset.p;
      let h;
      if (el.type === 'checkbox') h = el.checked;
      else if (el.dataset.typ === 'text') h = el.value;
      else {
        h = KLIC.cislo(el.value, NaN);
        el.classList.toggle('spatne', !Number.isFinite(h));
        if (!Number.isFinite(h)) return;
      }
      zmen(x => KLIC.poloz(x, c, h), c);
      viditelnost();
    };
    el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' || el.type === 'color' ? 'change' : 'input', akce);
    if (el.tagName === 'INPUT' && el.type === 'text' && el.dataset.typ !== 'text') el.addEventListener('change', () => {
      const psano = KLIC.cislo(el.value, NaN), h = KLIC.vezmi(p, el.dataset.p), r = KLIC.ROZSAHY[el.dataset.p];
      el.value = String(h).replace('.', ',');
      if (Number.isFinite(psano) && Math.abs(psano - h) > 1e-9 && r) {
        el.classList.remove('zvyrazni'); void el.offsetWidth; el.classList.add('zvyrazni');
        Dialog.info(`${el.labels[0] ? el.labels[0].textContent : 'Hodnota'}: omezeno na ${fmt(r[0], 2)}–${fmt(r[1], 2)}, použito ${fmt(h, 2)}.`);
      }
    });
    // ↑/↓ v číselném poli: ± 1, Shift × 10, Alt po 0,1
    if (el.tagName === 'INPUT' && el.type === 'text' && el.dataset.typ !== 'text') el.addEventListener('keydown', e => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      const h = KLIC.cislo(el.value, NaN); if (!Number.isFinite(h)) return;
      e.preventDefault();
      el.value = fmt(Math.round((h + (e.shiftKey ? 10 : e.altKey ? 0.1 : 1) * (e.key === 'ArrowUp' ? 1 : -1)) * 1000) / 1000, 3);
      el.dispatchEvent(new Event('input'));
    });
  }
  $('f_mat').innerHTML = Object.entries(KLIC.MATERIALY).map(([k, m]) => `<option value="${k}">${m.nazev} – ${fmt(m.hustota, 2)} g/cm³</option>`).join('');

  /* ---------- písmo ---------- */
  let fonty = [];
  const vyberPisma = FONTY.vyberFontu($('vyberPisma'), {
    ukazka: () => p.text.obsah || 'Aa 123',
    poznamka: f => f.typ === 'woff2' ? 'WOFF2 – nejde do 3D' : !f.pro3d ? 'tenké tahy' : '',
    doporucene: () => 'latinka',
    onZmena: id => zmen(x => { x.text.pismo = id; }),
  });
  FONTY.seznam().then(s => { fonty = s.filter(f => !f.pismo || f.pismo === 'latinka'); vyberPisma.nastav(fonty, p.text.pismo); }).catch(() => { /* zůstane výchozí */ });
  async function pripravPismo() {
    if (fontId === p.text.pismo && font) return true;
    $('stavPisma').textContent = 'Načítám písmo…';
    try { font = await FONTY.opentype(p.text.pismo); fontId = p.text.pismo; $('stavPisma').textContent = ''; return true; }
    catch (e) {
      $('stavPisma').textContent = 'Písmo se nenačetlo: ' + (e && e.message || e) + (FONTY.ZE_SOUBORU ? ' ' + FONTY.HLASKA_SOUBOR : '');
      font = null; fontId = null; return false;
    }
  }

  /* ---------- manifold ---------- */
  function nactiSkript(src) {
    return new Promise((ok, chyba) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => chyba(new Error('nelze načíst ' + src)); document.head.appendChild(s); });
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

  /* ---------- přepočet ---------- */
  const nahled = KLIC_NAHLED.vytvorNahled($('platno'));
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  let planovano = false, davkaNaPodlozce = false;
  function naplanuj() {
    davkaNaPodlozce = false;
    if (planovano) return;
    planovano = true;
    setTimeout(async () => { planovano = false; await prestav(); }, 60);
  }
  async function prestav() {
    nahled.barvy(css('--border-strong'), css('--text'));
    if (!wasm) { vypis(); return; }
    if (!(await pripravPismo())) { model = { chyba: 'Písmo se nenačetlo – zvolte jiné.' }; vypis(); return; }
    try { model = KLIC.sestav(wasm, font, p); }
    catch (e) { model = { chyba: e.message || String(e) }; }
    model.sit = model.dily ? model.dily.map(d => KRAB.kontrolaSite(d.poz, d.idx)) : [];
    if (!davkaNaPodlozce) nahled.nastav(model.dily ? model.dily.map(d => ({ poz: d.poz, idx: d.idx, barva: barvaDilu(d) })) : null, rovinyVymen());
    vypis();
  }
  const barvaDilu = d => (p.tisk.rezim === 'jedna' && d.role === 'ramecek' ? p.barvy.text : p.barvy[d.role]);
  const rovinyVymen = () => (model && model.odv && p.tisk.rezim === 'jedna' ? model.odv.udalosti.map(u => u.z) : []);

  /* ---------- výpis ---------- */
  const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const box = (popis, cislo, dalsi, tr) => `<div class="dlazdice"><div class="popis">${popis}</div><div class="cislo ${tr || ''}">${cislo}</div>${dalsi ? `<div class="dalsi">${dalsi}</div>` : ''}</div>`;
  const tecka = b => `<span class="tecka" style="background:${b}"></span>`;
  function jdiNaPole(cesta) {
    let el = document.querySelector(`[data-p="${cesta}"]`);
    if (!el) return;
    const det = el.closest('details'); if (det) det.open = true;
    const tel = el.closest('.zalozka-telo'); if (tel) TrubkyGui.otevriZalozku(tel.dataset.telo);
    const bx = el.closest('[data-box]'); TrubkyGui.ukazBox(bx ? bx.dataset.box : 'obecne');
    if (cesta === 'text.pismo') el = $('vyberPisma');
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    if (el.focus) el.focus({ preventScroll: true });
    el.classList.remove('zvyrazni'); void el.offsetWidth; el.classList.add('zvyrazni');
  }
  function vypisPokyny() {
    const el = $('pokyny');
    if (!model || !model.odv) { el.innerHTML = ''; return; }
    const po = KLIC.pokyny(p, model.odv), b = p.barvy;
    const jmBarvy = r => `${tecka(b[r])} ${r === 'text' ? 'barva textu' : 'barva podkladu'}`;
    if (p.tisk.rezim === 'vice') {
      const ext = KLIC.extrudery(b);
      const role = model.dily.map(d => d.role).filter((r, i, a) => a.indexOf(r) === i);
      el.innerHTML = `<h3>Tisk více barvami</h3><ul class="kroky">${role.map(r => `<li>${tecka(b[r])} <b>${KLIC.NAZVY_ROLI[r]}</b> → extruder / slot ${ext[r]}</li>`).join('')}`
        + (model.odv.magnet ? `<li>⏸ Pauza na magnet: před vrstvou <b>${po.kroky.find(k => k.druh === 'pauza').vrstva}</b> (jezdec na <b>${fmt(po.kroky.find(k => k.druh === 'pauza').vyskaVrstvy, 2)} mm</b>)</li>` : '')
        + '</ul><p class="napoveda">Exportujte <b>3MF barevný</b> – díly mají barvu a extruder; slicer výměny naplánuje sám.</p>';
      $('sBarvy').textContent = `${new Set(role.map(r => b[r])).size} barvy`;
      return;
    }
    if (!po.kroky.length) { el.innerHTML = '<p class="napoveda">Žádná výměna filamentu (jen jedna barva).</p>'; $('sBarvy').textContent = '1 barva'; return; }
    el.innerHTML = `<h3>Postup tisku jednou tryskou</h3><ul class="kroky"><li>Začněte filamentem: ${jmBarvy(po.zacatek)}</li>`
      + po.kroky.map(k => `<li${k.naVrstve ? '' : ' class="chyba-t"'}>${k.druh === 'barva' ? '🎨' : '⏸'} Před vrstvou <b>${k.vrstva}</b> – na jezdci sliceru výška <b>${fmt(k.vyskaVrstvy, 2)} mm</b>
          (rozhraní ${fmt(k.z, 2)} mm): ${k.druh === 'barva' ? 'výměna na ' + jmBarvy(model.odv.udalosti.find(u => u.z === k.z && u.druh === 'barva').na) : esc(k.text)}${k.naVrstve ? '' : ' – <b>neleží na hranici vrstvy!</b>'}</li>`).join('')
      + `</ul><h3>Marlin / Prusa (G-code)</h3><pre class="kod">${esc(po.marlin)}</pre><h3>Klipper</h3><pre class="kod">${esc(po.klipper)}</pre>`
      + `<h3>PrusaSlicer – vlastní G-code</h3><pre class="kod">${esc(po.podminka)}</pre>`
      + `<p class="napoveda">Bambu Studio / OrcaSlicer: po slicování pravý klik na svislý jezdec ve výšce ${po.kroky.map(k => fmt(k.vyskaVrstvy, 2)).join(' a ')} mm → „Změnit filament“ / „Přidat pauzu“. Vrstva ${fmt(po.vrstva, 2)} mm, první ${fmt(po.prvni, 2)} mm – ve sliceru musí být stejné.</p>`;
    $('sBarvy').textContent = `${po.kroky.length}× zastavení`;
  }
  function vypis() {
    const st = $('stav3d');
    const chyba = chybaJadra || (model && model.chyba) || '';
    st.textContent = !wasm && !chybaJadra ? 'Načítám geometrické jádro…' : chyba;
    st.classList.toggle('chyba', !!chyba);
    const H = chybaJadra ? [{ uroven: 'chyba', text: chybaJadra, pole: [] }] : KLIC.kontroly(p, model);
    if (model && model.dily) {
      const sit = model.sit, objem = model.dily.reduce((s, d) => s + d.objem, 0), plocha = sit.reduce((s, k) => s + k.plocha, 0);
      const bb = KLIC.obalDilu(model.dily), zmen = p.tisk.rezim === 'jedna' ? model.odv.udalosti.length : (model.odv.magnet ? 1 : 0);
      const o = KLIC.odhad(objem, plocha, p, zmen), mat = KLIC.MATERIALY[p.tisk.material];
      const poRolich = KLIC.ROLE.map(r => [r, model.dily.filter(d => d.role === r).reduce((s, d) => s + d.objem, 0)]).filter(x => x[1] > 0);
      const roz = `${fmt(bb[3] - bb[0])} × ${fmt(bb[4] - bb[1])} × ${fmt(bb[5] - bb[2], 2)}`;
      $('vysledky').innerHTML = box('Rozměr', `${roz} mm`, `písmo ${fmt(model.info.cap, 1)} mm (verzálky)`)
        + box('Hmotnost', `${fmt(o.g, 1)} g`, `${mat.nazev}, ${fmt(o.m, 2)} m filamentu 1,75 mm`)
        + box('Po barvách', poRolich.map(([r, v]) => `${tecka(barvaDilu({ role: r }))} ${fmt(v / Math.max(1e-9, objem) * o.g, 1)} g`).join(' '), poRolich.map(([r]) => KLIC.NAZVY_ROLI[r]).join(' · '))
        + box('Doba tisku', `≈ ${fmt(o.min, 0)} min`, `${model.odv.vrstev} vrstev`)
        + box('Výšky', `${fmt(model.odv.H, 2)} / ${fmt(model.odv.vyska, 2)} mm`, 'podklad / celkem');
      const dobra = sit.every(k => k.uzavrena && k.normalyVen && !k.degenerovanych);
      $('vSit').innerHTML = box('Síť', dobra ? 'uzavřená' : 'vadná', `${model.dily.length} díly, ${sit.reduce((s, k) => s + k.trojuhelniku, 0).toLocaleString('cs-CZ')} trojúhelníků`, dobra ? 'ok-t' : 'chyba-t');
      $('sVysledky').textContent = `${fmt(o.g, 1)} g`;
      $('karta3d').innerHTML = `<b>${esc(p.text.obsah.replace(/\n/g, ' / '))}</b><br><b>${roz}</b> mm · <b>${fmt(o.g, 1)}</b> g<br>${KLIC.NAZVY.rezim[p.text.rezim]} text, ${KLIC.NAZVY.tvar[p.podklad.tvar]}`;
      $('sText').textContent = `${fmt(model.info.cap, 1)} mm`;
      $('sStyl').textContent = KLIC.NAZVY.rezim[p.text.rezim];
      $('sPodklad').textContent = `${KLIC.NAZVY.tvar[p.podklad.tvar]}, ${fmt(model.odv.H, 2)} mm`;
      $('sTvar').textContent = `${fmt(bb[3] - bb[0], 0)} × ${fmt(bb[4] - bb[1], 0)} mm`;
    } else {
      for (const id of ['vysledky', 'vSit', 'karta3d']) $(id).innerHTML = '';
    }
    $('sOcko').textContent = p.ocko.zap || p.podklad.tvar === 'stitek' ? `⌀ ${fmt(p.ocko.prumer)}` : 'ne';
    $('sRamecek').textContent = p.ramecek.zap ? `${fmt(p.ramecek.sirka)} mm` : 'ne';
    $('sMagnet').textContent = p.magnet.zap ? `⌀ ${fmt(p.magnet.prumer)} × ${fmt(p.magnet.vyska)}` : 'ne';
    $('sStojanek').textContent = p.stojanek.zap ? `${fmt(p.stojanek.uhel, 0)}°` : 'ne';
    vypisPokyny();
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
        b.addEventListener('click', () => { zmen(q => KLIC.poloz(q, x.oprava.pole, x.oprava.hodnota)); naplnFormular(); });
        li.appendChild(b);
      }
      ul.appendChild(li);
    }
    const nch = H.filter(x => x.uroven === 'chyba').length, nv = H.filter(x => x.uroven === 'varovani').length;
    const o = $('stavOdznak');
    o.className = 'odznak ' + (nch ? 'chyba' : nv ? 'mez' : 'ok');
    o.textContent = !wasm && !chybaJadra ? '…' : nch ? `✖ ${nch}` : nv ? `⚠ ${nv}` : '✔';
    $('sKontrola').textContent = nch ? `${nch} ${nch === 1 ? 'chyba' : nch < 5 ? 'chyby' : 'chyb'}` : nv ? `${nv} varování` : 'v pořádku';
    $('sDavka').textContent = KLIC.seznamJmen(p.davka.jmena).length ? `${KLIC.seznamJmen(p.davka.jmena).length} ks` : '';
  }

  /* ---------- export ---------- */
  const jmenoSouboru = pripona => (KLIC.bezDiakritiky(p.nazev) || 'klicenka') + pripona;
  function stahni(data, nazev, typ) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type: typ }));
    a.download = nazev; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function lzeExport() {
    if (!model || !model.dily) { Dialog.chyba('Model nelze sestavit: ' + (chybaJadra || (model && model.chyba) || 'jádro se ještě načítá')); return false; }
    if (KLIC.kontroly(p, model).some(h => h.uroven === 'chyba')) Dialog.info('Pozor: kontrola hlásí chyby – export proběhl, ale výrobek nemusí jít vytisknout (záložka Kontrola).');
    return true;
  }
  const jedenKus = () => [{ text: p.text.obsah, dily: model.dily }];
  function exportStl() { if (lzeExport()) stahni(KRAB.stlBinarni(model.dily, 'klicenky - github_site'), jmenoSouboru('.stl'), 'model/stl'); }
  $('btnStl').addEventListener('click', exportStl);
  $('btn3mf').addEventListener('click', () => { if (lzeExport()) stahni(KLIC.soubor3mfBarevny(jedenKus(), p.nazev || 'Klíčenka', p.barvy), jmenoSouboru('.3mf'), 'model/3mf'); });
  $('btnStlBarvy').addEventListener('click', () => {
    if (!lzeExport()) return;
    const b = KLIC.stlPoBarvach(jedenKus(), KLIC.bezDiakritiky(p.nazev) || 'klicenka');
    stahni(KRAB.zip(b.map(x => ({ name: x.name, data: x.data }))), jmenoSouboru('_po_barvach.zip'), 'application/zip');
  });
  $('btnPng').addEventListener('click', () => { fetch(nahled.png()).then(r => r.blob()).then(b => stahni(b, jmenoSouboru('.png'))); });

  /* ---------- dávka ---------- */
  function davka() {
    const st = $('davkaStav'); st.innerHTML = '';
    const pridej = (uroven, text) => { const li = document.createElement('li'); li.className = uroven; li.textContent = text; st.appendChild(li); };
    if (!wasm || !font) { pridej('chyba', 'Geometrické jádro nebo písmo ještě není načtené.'); return null; }
    const jmena = KLIC.seznamJmen(p.davka.jmena);
    if (!jmena.length) { pridej('varovani', 'Seznam jmen je prázdný – napište jedno jméno na řádek.'); jdiNaPole('davka.jmena'); return null; }
    const d = KLIC.sestavDavku(wasm, font, p);
    for (const c of d.chyby) pridej('chyba', `„${c.text}“: ${c.chyba}`);
    if (!d.kusy.length) return null;
    const r = KLIC.rozlozNaPodlozku(d.kusy, p.davka.mezera, p.tisk.podlozka);
    pridej(r.vejde ? 'ok' : 'varovani', `${d.kusy.length} ks na ploše ${fmt(r.rozmer[0], 0)} × ${fmt(r.rozmer[1], 0)} mm` + (r.vejde ? ` – vejde se na podložku ${fmt(p.tisk.podlozka, 0)} mm.` : ` – NEVEJDE se na podložku ${fmt(p.tisk.podlozka, 0)} mm, rozdělte seznam nebo exportujte ZIP po kusech.`));
    return r;
  }
  $('btnDavkaNahled').addEventListener('click', () => {
    const r = davka(); if (!r) return;
    nahled.nastav(r.kusy.flatMap(k => k.dily.map(d => ({ poz: d.poz, idx: d.idx, barva: barvaDilu(d) }))), []);
    davkaNaPodlozce = true; nahled.pohled('shora');
  });
  $('btnDavka3mf').addEventListener('click', () => { const r = davka(); if (r) stahni(KLIC.soubor3mfBarevny(r.kusy, (p.nazev || 'Klíčenky') + ' – dávka', p.barvy), jmenoSouboru('_davka.3mf'), 'model/3mf'); });
  $('btnDavkaStl').addEventListener('click', () => {
    const r = davka(); if (!r) return;
    const b = KLIC.stlPoBarvach(r.kusy, (KLIC.bezDiakritiky(p.nazev) || 'klicenky') + '_davka');
    stahni(KRAB.zip(b.map(x => ({ name: x.name, data: x.data }))), jmenoSouboru('_davka_po_barvach.zip'), 'application/zip');
  });
  $('btnDavkaZip').addEventListener('click', () => {
    const r = davka(); if (!r) return;
    const jmena = new Set();
    const polozky = r.kusy.map((k, i) => {
      let jm = KLIC.bezDiakritiky(k.text) || `kus_${i + 1}`;
      while (jmena.has(jm)) jm += '_' + (i + 1);
      jmena.add(jm);
      return { name: jm + '.3mf', data: KLIC.soubor3mfBarevny(KLIC.rozlozNaPodlozku([k], 0, 1e4).kusy, k.text, p.barvy) };
    });
    stahni(KRAB.zip(polozky), jmenoSouboru('_kusy.zip'), 'application/zip');
  });

  /* ---------- nabídky, předvolby, projekt ---------- */
  TrubkyGui.pripoj({ klic: 'webapp_klicenky_gui', pohled: j => nahled.pohled(j) });
  for (const v of KLIC.PREDVOLBY) {
    const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
    b.innerHTML = `${v.nazev}<span class="pozn">${v.popis}</span>`;
    b.addEventListener('click', () => {
      nahrad(KLIC.pouzijPredvolbu(p, v));
    });
    $('seznamPredvoleb').appendChild(b);
  }
  $('btnUlozit').addEventListener('click', () => stahni(KLIC.ulozProjekt(p), jmenoSouboru('.json'), 'application/json'));
  $('btnNacist').addEventListener('click', () => $('soubor').click());
  $('soubor').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try { const { p: q, hlaseni } = KLIC.nactiProjekt(await f.text()); nahrad(q); if (hlaseni.length) hlasPrevod(hlaseni, 'Projekt'); else Dialog.info('Projekt načten.'); }
    catch (err) { Dialog.chyba(err.message); }
  });
  $('btnVychozi').addEventListener('click', async () => {
    if (await Dialog.potvrd('Vrátit všechny parametry na výchozí hodnoty?')) nahrad(KLIC.normalizuj({}).p);
  });
  $('btnZpet').addEventListener('click', () => krokHistorie(zpet, znovu));
  $('btnZnovu').addEventListener('click', () => krokHistorie(znovu, zpet));
  function prepinac(id, co) {
    const b = $(id);
    b.addEventListener('click', () => { const h = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(h)); nahled.prepni(co, h); });
  }
  prepinac('tHrany', 'hrany'); prepinac('tRoviny', 'roviny');
  $('stavOdznak').addEventListener('click', () => TrubkyGui.otevriZalozku('kontrola'));
  $('btnNapoveda').addEventListener('click', () => $('dlgNapoveda').showModal());
  $('btnZavritNap').addEventListener('click', () => $('dlgNapoveda').close());
  document.addEventListener('keydown', e => {
    const a = document.activeElement;
    const vPoli = a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || (a.tagName === 'INPUT' && !/checkbox|range|radio|button|color/.test(a.type));
    if ((e.ctrlKey || e.metaKey) && !vPoli && e.key.toLowerCase() === 'z') { e.preventDefault(); krokHistorie(e.shiftKey ? znovu : zpet, e.shiftKey ? zpet : znovu); return; }
    if ((e.ctrlKey || e.metaKey) && !vPoli && e.key.toLowerCase() === 'y') { e.preventDefault(); krokHistorie(znovu, zpet); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); exportStl(); return; }
    if (e.key === 'F1') { e.preventDefault(); $('dlgNapoveda').showModal(); return; }
    if (vPoli || e.ctrlKey || e.metaKey || e.altKey || $('dlgNapoveda').open) return;
    const k = e.key.toLowerCase();
    if (k === '1') nahled.pohled('iso'); else if (k === '2') nahled.pohled('shora'); else if (k === '3') nahled.pohled('zboku');
    else if (k === 'h') $('tHrany').click(); else if (k === 'r') $('tRoviny').click();
  });
  new MutationObserver(() => naplanuj()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  if (typeof Tvary !== 'undefined') Tvary.pripoj({
    klic: 'webapp_klicenky_tvary', typ: 'klicenky', nazev: 'Klíčenka', kontejner: $('tvary'),
    parametry: () => KLIC.kopie(p),
    pouzij: q => { const n = KLIC.normalizuj(q); hlasPrevod(n.hlaseni, 'Uložená klíčenka'); nahrad(n.p); },
    popis: q => `${(q.text && q.text.obsah || '').replace(/\n/g, ' / ')} – ${KLIC.NAZVY.tvar[q.podklad && q.podklad.tvar] || ''}, ${KLIC.NAZVY.rezim[q.text && q.text.rezim] || ''}`,
  });

  /* ---------- start ---------- */
  p = nactiUlozeny();
  naplnFormular();
  vypis();
  nactiManifold().then(w => { wasm = w; naplanuj(); }).catch(e => {
    chybaJadra = 'Geometrické jádro (manifold-3d) se nenačetlo: ' + (e && e.message || e) + ' – model ani export nejsou k dispozici.';
    vypis();
  });
  window.__klicenky = { get p() { return p; }, get model() { return model; }, nahled, zmen, prestav, davka, naplnFormular };
})();

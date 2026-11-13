/* Klíčenky a jmenovky – ovládání stránky nad společným zapojením gen3d/aplikace.js (historie, formulář, hlášení, projekt, sdílení, klávesy):
   tady jen písmo, přepočet, pokyny pro výměnu barvy, výsledky, kusovník, dávka a barevné exporty. */
/* global KLIC, KLIC_NAHLED, KRAB, FONTY, G3D, Dialog, TrubkyGui */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const fmt = KLIC.fmt;
  let p, model = null, wasm = null, font = null, fontId = null, chybaJadra = '';
  const nahled = KLIC_NAHLED.vytvorNahled($('platno'));
  let vyberPisma = null;

  const app = G3D.aplikace({
    typ: 'klicenky', nazev: 'Klíčenka', klic: 'webapp_klicenky', soubor: 'klicenka',
    normalizuj: KLIC.normalizuj, vychozi: () => KLIC.normalizuj({}).p, hlasitOpravyUlozeneho: true,
    ulozProjekt: KLIC.ulozProjekt, nactiProjekt: KLIC.nactiProjekt,
    vezmi: KLIC.vezmi, poloz: KLIC.poloz,
    popis: q => `${(q.text && q.text.obsah || '').replace(/\n/g, ' / ')} – ${KLIC.NAZVY.tvar[q.podklad && q.podklad.tvar] || ''}, ${KLIC.NAZVY.rezim[q.text && q.text.rezim] || ''}`,
    viditelnost: () => viditelnost(),
    poNaplneni: q => { if (vyberPisma) vyberPisma.hodnota = q.text.pismo; },
    prepocitej: () => naplanuj(),
    png: () => nahled.png(), pohled: j => nahled.pohled(j),
    exportStl: () => exportStl(),
    doModelare: () => (lzeExport() ? { data: KRAB.soubor3mf(model.dily.map(d => Object.assign({}, d, { barva: barvaDilu(d) })), app.p.nazev || 'Klíčenka'), pripona: '.3mf' } : null),
    zkratky: { h: 'tHrany', r: 'tRoviny', p: 'tPrevisy', l: 'tPravitka' },
    zmenaTematu: () => naplanuj(),
    hlaseniNavic: (li, x) => { if (x.pole[0] === 'text.pismo') li.addEventListener('click', () => jdiNaPismo()); },
  });

  /* ---------- formulář: viditelnost, živá změna při psaní, hlášení o omezení ---------- */
  function viditelnost() {
    p = app.p;
    document.querySelectorAll('[data-jen]').forEach(el => { el.hidden = !el.dataset.jen.split(' ').includes(p.text.rezim); });
    document.querySelectorAll('[data-tvar]').forEach(el => { el.hidden = !el.dataset.tvar.split(' ').includes(p.podklad.tvar); });
    $('gPevny').hidden = !p.podklad.pevny;
  }
  const psano = new Map();   // poslední napsané číslo pole (gen3d ho při change hned přepíše omezenou hodnotou)
  for (const el of document.querySelectorAll('input[data-p], textarea[data-p]')) {
    if (el.type === 'checkbox' || el.type === 'color') continue;
    const cislo = el.dataset.typ !== 'text';
    el.addEventListener('input', () => {
      const c = el.dataset.p;
      let h = el.value;
      if (cislo) {
        h = KLIC.cislo(el.value, NaN);
        el.classList.toggle('spatne', !Number.isFinite(h));
        if (!Number.isFinite(h)) return;
        psano.set(el, h);
      }
      app.zmen(x => KLIC.poloz(x, c, h), c);
      viditelnost();
    });
    if (cislo) el.addEventListener('change', () => {
      const n = psano.get(el); psano.delete(el);
      const h = KLIC.vezmi(app.p, el.dataset.p), r = KLIC.ROZSAHY[el.dataset.p];
      if (Number.isFinite(n) && Math.abs(n - h) > 1e-9 && r) {
        el.classList.remove('zvyrazni'); void el.offsetWidth; el.classList.add('zvyrazni');
        Dialog.info(`${el.labels[0] ? el.labels[0].textContent : 'Hodnota'}: omezeno na ${fmt(r[0], 2)}–${fmt(r[1], 2)}, použito ${fmt(h, 2)}.`);
      }
    });
  }
  $('f_mat').innerHTML = Object.entries(KLIC.MATERIALY).map(([k, m]) => `<option value="${k}">${m.nazev} – ${fmt(m.hustota, 2)} g/cm³</option>`).join('');

  /* ---------- písmo ---------- */
  let fonty = [];
  vyberPisma = FONTY.vyberFontu($('vyberPisma'), {
    ukazka: () => app.p.text.obsah || 'Aa 123',
    poznamka: f => f.typ === 'woff2' ? 'WOFF2 – nejde do 3D' : !f.pro3d ? 'tenké tahy' : '',
    doporucene: () => 'latinka',
    onZmena: id => app.zmen(x => { x.text.pismo = id; }),
  });
  FONTY.seznam().then(s => { fonty = s.filter(f => !f.pismo || f.pismo === 'latinka'); vyberPisma.nastav(fonty, app.p.text.pismo); }).catch(() => { /* zůstane výchozí */ });
  async function pripravPismo() {
    p = app.p;
    if (fontId === p.text.pismo && font) return true;
    $('stavPisma').textContent = 'Načítám písmo…';
    try { font = await FONTY.opentype(p.text.pismo); fontId = p.text.pismo; $('stavPisma').textContent = ''; return true; }
    catch (e) {
      $('stavPisma').textContent = 'Písmo se nenačetlo: ' + (e && e.message || e) + (FONTY.ZE_SOUBORU ? ' ' + FONTY.HLASKA_SOUBOR : '');
      font = null; fontId = null; return false;
    }
  }

  /* ---------- přepočet ---------- */
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  let planovano = false, davkaNaPodlozce = false;
  function naplanuj() {
    davkaNaPodlozce = false;
    if (planovano) return;
    planovano = true;
    setTimeout(async () => { planovano = false; await prestav(); }, 60);
  }
  async function prestav() {
    p = app.p;
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
  /** Písmo nemá pole [data-p] – skok na výběr písma. */
  function jdiNaPismo() {
    const el = $('vyberPisma');
    const det = el.closest('details'); if (det) det.open = true;
    TrubkyGui.ukazBox('in');
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
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
    let o = null;
    if (model && model.dily) {
      const sit = model.sit, objem = model.dily.reduce((s, d) => s + d.objem, 0), plocha = sit.reduce((s, k) => s + k.plocha, 0);
      const bb = KLIC.obalDilu(model.dily), zmen = p.tisk.rezim === 'jedna' ? model.odv.udalosti.length : (model.odv.magnet ? 1 : 0);
      o = KLIC.odhad(objem, plocha, p, zmen); const mat = KLIC.MATERIALY[p.tisk.material];
      const poRolich = KLIC.ROLE.map(r => [r, model.dily.filter(d => d.role === r).reduce((s, d) => s + d.objem, 0)]).filter(x => x[1] > 0);
      const roz = `${fmt(bb[3] - bb[0])} × ${fmt(bb[4] - bb[1])} × ${fmt(bb[5] - bb[2], 2)}`;
      $('vysledky').innerHTML = box('Rozměr', `${roz} mm`, `písmo ${fmt(model.info.cap, 1)} mm (verzálky)`)
        + box('Objem', `${fmt(objem / 1000, 2)} cm³`, `${model.dily.length} díly, plné`)
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
    app.hlaseni(H, { boxy: ['boxText', 'boxTvar'] });
    if (!wasm && !chybaJadra) $('stavOdznak').textContent = '…';
    kusovnik();
    $('sDavka').textContent = KLIC.seznamJmen(p.davka.jmena).length ? `${KLIC.seznamJmen(p.davka.jmena).length} ks` : '';
  }

  /** Kusovník: díly jednoho kusu (podklad, text, rámeček…) s objemem, hmotností a STL zvlášť. */
  function kusovnik() {
    const tb = $('tDily'); tb.innerHTML = '';
    if (!model || !model.dily) return;
    const hust = KLIC.MATERIALY[p.tisk.material].hustota;
    for (const d of model.dily) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${tecka(barvaDilu(d))} ${esc(d.nazev || KLIC.NAZVY_ROLI[d.role] || d.jmeno)}</td><td class="c">${fmt(d.objem / 1000, 2)} cm³</td><td class="c">${fmt(d.objem / 1000 * hust, 1)} g</td><td class="c"><button class="tl" type="button">STL</button></td>`;
      const b = tr.querySelector('button');
      b.setAttribute('aria-label', 'Stáhnout STL – ' + (d.nazev || d.role));
      b.addEventListener('click', () => { if (lzeExport()) stahni(KRAB.stlBinarni([d], 'klicenky - ' + (d.jmeno || d.role)), jmenoSouboru('_' + (KLIC.bezDiakritiky(d.jmeno || d.role) || 'dil') + '.stl'), 'model/stl'); });
      tb.appendChild(tr);
    }
  }

  /* ---------- export ---------- */
  const jmenoSouboru = pripona => (KLIC.bezDiakritiky(app.p.nazev) || 'klicenka') + pripona;
  const stahni = (data, nazev, typ) => app.stahni(data, nazev, typ);
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

  /* ---------- dávka ---------- */
  function davka() {
    const st = $('davkaStav'); st.innerHTML = '';
    const pridej = (uroven, text) => { const li = document.createElement('li'); li.className = uroven; li.textContent = text; st.appendChild(li); };
    if (!wasm || !font) { pridej('chyba', 'Geometrické jádro nebo písmo ještě není načtené.'); return null; }
    const jmena = KLIC.seznamJmen(p.davka.jmena);
    if (!jmena.length) { pridej('varovani', 'Seznam jmen je prázdný – napište jedno jméno na řádek.'); app.jdiNaPole('davka.jmena'); return null; }
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
      app.nahrad(KLIC.pouzijPredvolbu(app.p, v));
    });
    $('seznamPredvoleb').appendChild(b);
  }
  app.prepinac('tHrany', h => nahled.prepni('hrany', h));
  app.prepinac('tRoviny', h => nahled.prepni('roviny', h));
  app.prepinac('tPrevisy', h => { nahled.prepni('previsy', h); $('legPrevisy').hidden = !h; }, true);
  app.prepinac('tPravitka', h => nahled.prepni('pravitka', h), true);

  /* ---------- start ---------- */
  app.start({
    manifold: {
      ok: w => { wasm = w; naplanuj(); },
      chyba: e => { chybaJadra = 'Geometrické jádro (manifold-3d) se nenačetlo: ' + (e && e.message || e) + ' – model ani export nejsou k dispozici.'; vypis(); },
    },
  });
  window.__klicenky = { get p() { return app.p; }, get model() { return model; }, nahled, zmen: app.zmen, prestav, davka, naplnFormular: app.naplnFormular, app };
})();

/* IBC napojení – ovládání stránky: formulář, historie, manifold, přepočet, výsledky, kontroly, export
   (stejná stavba jako spojky/ui.js). */
/* global IBC, IBC_GEOM, IBC_NAHLED, KRAB, Dialog, Tvary, TrubkyGui */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const S = IBC, fmt = S.fmt;
  const KLIC = 'webapp_ibc_projekt';

  /* ---------- stav a historie ---------- */
  let p, wasm = null, model = null, chybaStavby = null;
  const zpet = [], znovu = [];
  function hlasPrevod(hl, co) { if (hl && hl.length) setTimeout(() => Dialog.info(`${co} upraven: ${hl.join('; ')}.`), 300); }
  function nactiUlozeny() {
    try {
      const t = localStorage.getItem(KLIC);
      if (t) { const r = S.normalizuj(JSON.parse(t)); hlasPrevod(r.hlaseni, 'Uložený projekt'); return r.p; }
    } catch (e) { /* poškozený záznam */ }
    return S.zPredvolby(0);
  }
  function uloz() { try { localStorage.setItem(KLIC, JSON.stringify(p)); } catch (e) { /* plné úložiště */ } }
  function zmen(fn, slouceni) {
    const pred = JSON.stringify(p);
    fn(p);
    p = S.normalizuj(p).p;
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
    p = S.normalizuj(JSON.parse(z.pop().stav)).p;
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
  const skupiny = { IBC: 'IBC – hrubé závity', G: 'Trubkové G (ISO 228)', vlastni: 'Vlastní' };
  const volbyZavitu = Object.entries(skupiny).map(([sk, nazev]) => `<optgroup label="${nazev}">`
    + Object.entries(S.ZAVITY).filter(([, z]) => z.skupina === sk).map(([k, z]) => `<option value="${k}">${esc(z.nazev)}</option>`).join('') + '</optgroup>').join('');
  document.querySelectorAll('.vyber-zavitu').forEach(el => { el.innerHTML = volbyZavitu; });
  opt('f_ytyp', S.VYSTUPY, (k, v) => v);
  opt('f_pkonec', S.KONCE_PRUCHODKY, (k, v) => v);
  opt('f_uchop', S.UCHOPY, (k, v) => v);
  opt('f_tes', S.TESNENI, (k, v) => v);
  opt('f_mat', S.MATERIALY, (k, v) => `${v.nazev} – ${fmt(v.hustota, 2)} g/cm³`);
  $('f_hadVolba').innerHTML = '<option value="">– vyberte –</option>' + S.HADICE.map(([n, d]) => `<option value="${d}">${esc(n)} = ${fmt(d, 1)} mm</option>`).join('');
  $('dlTrubky').innerHTML = S.TRUBKY_PVC.map(d => `<option value="${d}">`).join('');
  $('f_hadVolba').addEventListener('change', e => {
    const d = S.cislo(e.target.value, NaN); e.target.value = '';
    if (Number.isFinite(d)) { zmen(x => { x.vystup.hadice = d; }); naplnFormular(); }
  });
  const pole = [...document.querySelectorAll('[data-p]')];
  function naplnFormular() {
    for (const el of pole) {
      const h = S.vezmi(p, el.dataset.p);
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
        h = S.cislo(el.value, NaN);
        el.classList.toggle('spatne', !Number.isFinite(h));
        if (!Number.isFinite(h)) return;
      }
      zmen(x => S.poloz(x, c, h), c);
      // stejné pole může být ve formuláři dvakrát (průchodka sdílí závit a přesah s výstupem)
      for (const jine of pole) if (jine !== el && jine.dataset.p === c && document.activeElement !== jine) jine.value = el.type === 'checkbox' ? jine.value : el.value;
    };
    el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', akce);
    if (el.tagName === 'INPUT' && el.type === 'text' && el.dataset.typ !== 'text') {
      el.addEventListener('change', () => {
        const psano = S.cislo(el.value, NaN), h = S.vezmi(p, el.dataset.p), roz = S.ROZSAHY[el.dataset.p];
        el.value = String(h).replace('.', ',');
        if (roz && Number.isFinite(psano) && Math.abs(psano - h) > 1e-9) {
          el.classList.remove('zvyrazni'); void el.offsetWidth; el.classList.add('zvyrazni');
          Dialog.info(`${el.labels[0] ? el.labels[0].textContent.trim() : 'Hodnota'}: omezeno na ${fmt(roz[0], 2)}–${fmt(roz[1], 2)}, použito ${fmt(h, 2)}.`);
        }
      });
      // ↑/↓ ± 1, Shift × 10, Alt po 0,1
      el.addEventListener('keydown', e => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        const h = S.cislo(el.value, NaN); if (!Number.isFinite(h)) return;
        e.preventDefault();
        const krok = (e.shiftKey ? 10 : e.altKey ? 0.1 : 1) * (e.key === 'ArrowUp' ? 1 : -1);
        el.value = fmt(Math.round((h + krok) * 1000) / 1000, 3);
        el.dispatchEvent(new Event('input'));
      });
    }
  }
  document.querySelectorAll('[data-druh-volba]').forEach(b => b.addEventListener('click', () => {
    zmen(x => {
      x.druh = b.dataset.druhVolba;
      if (x.druh === 'redukce') { x.vystup.typ = 'zavit'; if (x.vystup.zavit === x.vstup.zavit && x.vystup.pohlavi === x.vstup.pohlavi) x.vystup.pohlavi = x.vstup.pohlavi === 'samice' ? 'samec' : 'samice'; }
      if (x.druh === 'zaslepka') x.vstup.pohlavi = 'samice';
    });
    naplnFormular();
  }));

  /** Ukáže jen pole, která pro zvolený druh / výstup dávají smysl. */
  function viditelnost() {
    const pouzity = [p.druh === 'vicko' ? p.vicko.zavit : null, ['adapter', 'redukce', 'zaslepka'].includes(p.druh) ? p.vstup.zavit : null,
      (['adapter', 'redukce'].includes(p.druh) && p.vystup.typ === 'zavit') || (p.druh === 'pruchodka' && p.pruchodka.konec === 'zavit') ? p.vystup.zavit : null];
    for (const el of document.querySelectorAll('[data-pro]')) el.hidden = !el.dataset.pro.split(' ').includes(p.druh);
    for (const el of document.querySelectorAll('[data-vyst]')) el.hidden = !el.dataset.vyst.split(' ').includes(p.vystup.typ);
    for (const el of document.querySelectorAll('[data-konec]')) el.hidden = el.dataset.konec !== p.pruchodka.konec;
    for (const el of document.querySelectorAll('[data-tes]')) el.hidden = el.dataset.tes !== p.telo.tesneni;
    for (const el of document.querySelectorAll('[data-vlastni]')) el.hidden = !pouzity.includes('vlastni');
    document.querySelectorAll('[data-druh-volba]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.druhVolba === p.druh)));
    $('nVstup').textContent = p.druh === 'zaslepka' ? 'Závit výpusti' : 'Vstup – na ventil';
    $('hVystup').textContent = { adapter: 'Výstup a tělo', redukce: 'Druhý závit a tělo', zaslepka: 'Víčko a tělo', pruchodka: 'Konec a těsnění', vicko: 'Otvory a těsnění' }[p.druh];
    // límec navíc jen mezi konci – u vnitřního závitu vstupu je úchop přímo na objímce
    $('f_vuch').closest('.pole').hidden = !['adapter', 'redukce'].includes(p.druh) || p.vstup.pohlavi === 'samice';
    $('lKprum').textContent = p.vicko.typVstupu === 'trn' ? 'Hadice uvnitř' : 'Průměr vstupu';
  }

  /* ---------- manifold ---------- */
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

  /* ---------- přepočet ---------- */
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const nahled = IBC_NAHLED.vytvorNahled($('platno'));
  let casovac = null;
  function naplanuj() { clearTimeout(casovac); casovac = setTimeout(prepocitej, 60); }
  function prepocitej() {
    nahled.barvy(css('--border-strong'), css('--border'), css('--text'));
    const o = S.odvozene(p);
    let H = S.kontroly(p, o);
    model = null; chybaStavby = null;
    const st = $('stav3d');
    if (!wasm) { vypis(H, o); return; }
    try {
      const t0 = performance.now();
      const sit = IBC_GEOM.postav(wasm, p, o);
      const rozbor = S.rozborTisku(sit, p);
      const tisk = S.tiskovaPoloha(sit, rozbor.vybrana.R);
      tisk.tridy = S.previsy(tisk.poz, sit.idx, p.tisk.previs).tridy;
      model = Object.assign(sit, { o, rozbor, tisk, ks: KRAB.kontrolaSite(tisk.poz, sit.idx), cas: performance.now() - t0, klic: p.druh });
      H = H.concat(S.kontrolyTisku(p, o, rozbor, sit.plocha));
      if (!model.ks.uzavrena) H.push({ uroven: 'chyba', text: 'Síť není uzavřená – export by nemusel jít vytisknout.', pole: [] });
    } catch (e) {
      chybaStavby = 'Těleso nejde sestavit: ' + (e && e.message || e);
      H.push({ uroven: 'chyba', text: chybaStavby, pole: [] });
    }
    st.textContent = chybaStavby || ''; st.classList.toggle('chyba', !!chybaStavby);
    nahled.nastav(model);
    vypis(H, o);
  }

  /* ---------- výpisy ---------- */
  const dl = (popis, cislo, dalsi = '', tr = '') => `<div class="dlazdice"><div class="popis">${popis}</div><div class="cislo ${tr}">${cislo}</div>${dalsi ? `<div class="dalsi">${dalsi}</div>` : ''}</div>`;
  const nazevZ = z => esc(z.nazev.split(' –')[0]);
  function dlazdiceKonce(k, kde) {
    if (!k) return '';
    if (k.typ === 'samice') return dl(`${kde}: vnitřní závit`, nazevZ(k.zavit), `Ø ${fmt(2 * k.rMaj, 2)} / ${fmt(2 * k.rMin, 2)} mm (s vůlí), zašroubování ${fmt(k.zasroub)} mm = ${fmt(k.zasroub / k.zavit.p, 1)} chodu, stěna ${fmt(k.stenaZavit, 1)} mm`);
    if (k.typ === 'samec') return dl(`${kde}: vnější závit`, nazevZ(k.zavit), `Ø ${fmt(2 * k.rMaj, 2)} / jádro ${fmt(2 * k.rCore, 2)} mm, délka ${fmt(k.zasroub)} mm, stěna pod závitem ${fmt(k.stenaZavit, 1)} mm`);
    if (k.typ === 'trn') return dl(`${kde}: hadicový trn`, `hadice ${fmt(k.ID, 1)} mm`, `zuby Ø ${fmt(2 * k.rmax, 1)} (+${fmt(k.presah, 0)} %), délka ${fmt(k.delkaTrnu, 0)} mm, stěna ${fmt(k.stenaTrnu, 1)} mm`);
    if (k.typ === 'hrdlo') return dl(`${kde}: hrdlo PVC`, `Ø ${fmt(2 * k.rIn, 1)} mm`, `trubka ${fmt(k.D)} mm, hloubka ${fmt(k.Lh)} mm`);
    if (k.typ === 'gardena') return dl(`${kde}: rychlospojka`, 'Gardena samec', 'zjednodušený profil – neověřeno');
    return '';
  }
  function vypis(H, o) {
    const m = model;
    let v = '';
    const podpory = m && S.potrebujePodpory(m.rozbor.vybrana, m.plocha);
    if (m) {
      const b = m.ks.bbox, odh = S.odhadTisku(m.objem, m.plocha, b[5] - b[2], p), mat = S.MATERIALY[p.tisk.material];
      const rb = o.rb;
      v += dl('Nejužší průchod', rb ? `Ø ${fmt(2 * rb, 1)} mm` : 'uzavřeno', rb ? `průřez ${fmt(Math.PI * rb * rb, 0)} mm²` : 'záslepka');
      v += dl('Rozměry (tisk)', `${fmt(b[3] - b[0])} × ${fmt(b[4] - b[1])} × ${fmt(b[5] - b[2])} mm`, 'šířka × hloubka × výška');
      v += dl('Hmotnost', `≈ ${fmt(odh.gramy, 0)} g`, `${mat.nazev}, výplň ${fmt(p.tisk.vypln, 0)} %, 4 obvody; plný ${fmt(odh.plny, 0)} g`);
      v += dl('Doba tisku', `≈ ${odh.minut < 90 ? fmt(odh.minut, 0) + ' min' : fmt(odh.minut / 60, 1) + ' h'}`, `1 kus, hrubý odhad (vrstva 0,2 mm)${p.tisk.kusu > 1 ? `; ${p.tisk.kusu} ks ≈ ${fmt(odh.minut * p.tisk.kusu / 60, 1)} h` : ''}`);
      if (o.A) { v += dlazdiceKonce(o.A, 'Vstup'); v += dlazdiceKonce(o.B, 'Výstup'); }
      if (o.uchop) v += dl('Úchop', o.uchop.typ === 'sestihran' ? `šestihran ${o.uchop.S} mm` : `${o.uchop.n} žeber`, `Ø těla ${fmt(2 * o.Rk || 2 * o.R, 1)} mm`);
      if (p.druh === 'pruchodka') {
        v += dl('Závit dříku', `Ø ${fmt(o.zavit.d)} × ${fmt(o.zavit.p)}`, `${fmt(o.Lt)} mm, stěna pod závitem ${fmt(o.stenaZavit, 1)} mm`);
        v += dl('Matice', `${o.matice.S} mm`, `výška ${fmt(o.Hm)} mm, otvor Ø ${fmt(2 * o.rMinF, 1)}`);
        v += dl('Příruba', `Ø ${fmt(2 * o.Rf)} mm`, `tloušťka ${fmt(o.tp)} mm${o.dr ? ', drážka O-kroužku' : ''}`);
        if (o.B) v += dlazdiceKonce(o.B, 'Venku');
      }
      if (p.druh === 'vicko') {
        v += dl('Víko', `Ø ${fmt(2 * o.R, 1)} mm`, `závit ${nazevZ(o.zavit)} s vůlí Ø ${fmt(2 * o.rMaj, 1)}, plášť ${fmt(o.H)} mm`);
        v += dl('Otvory', `${o.otvory.length}${o.odvzd ? ' + odvzd.' : ''}`, o.otvory.map(x => `${x.prepad ? 'přepad ' : ''}Ø ${fmt(x.D)}`).join(', ') || '–');
      }
      v += dl('Poloha tisku', m.rozbor.vybrana.nazev, podpory ? `${fmt(m.rozbor.vybrana.volne, 0)} mm² převisů – s podporami` : 'bez podpor', podpory ? 'mez-t' : 'ok-t');
    } else v = dl('Model', wasm ? 'nesestaven' : 'načítám…', chybaStavby || '');
    $('vVysledky').innerHTML = v;
    $('sVysledky').textContent = m && o.rb ? `Ø ${fmt(2 * o.rb, 1)}` : '';
    // tisk
    const sel = $('f_orient'), r = m && m.rozbor;
    sel.innerHTML = '<option value="auto">automaticky – nejlepší</option>' + (r ? r.kandidati.map(k => `<option value="${k.klic}">${esc(k.nazev)}</option>`).join('') : '');
    sel.value = r && r.kandidati.some(k => k.klic === p.tisk.orientace) ? p.tisk.orientace : 'auto';
    $('tabOrientace').innerHTML = r ? '<tr><th>Poloha</th><th class="c">Bez opory</th><th class="c">Mosty a boky</th><th class="c">Podložka</th><th class="c">Výška</th></tr>'
      + r.kandidati.map(k => `<tr class="klik${k === r.vybrana ? ' vybrana' : ''}" data-klic="${k.klic}" tabindex="0"><td>${k === r.nejlepsi ? '★ ' : ''}${esc(k.nazev)}</td><td class="c">${fmt(k.volne, 0)} mm²</td><td class="c">${fmt(k.most, 0)} mm²</td><td class="c">${fmt(k.podlozka, 0)} mm²</td><td class="c">${fmt(k.vyska)} mm</td></tr>`).join('') : '';
    $('sTisk').textContent = m ? (podpory ? 's podporami' : 'bez podpor') : '';
    $('pMaterial').textContent = S.MATERIALY[p.tisk.material].pozn;
    // kusovník
    const kus = S.kusovnik(p, o);
    $('tabKusovnik').innerHTML = kus.length ? '<tr><th class="c">Ks</th><th>Položka</th><th>Poznámka</th></tr>'
      + kus.map(x => `<tr><td class="c">${x.ks * p.tisk.kusu}</td><td>${esc(x.co)}</td><td>${esc(x.pozn || '')}</td></tr>`).join('')
      : '<tr><td>Bez dalšího materiálu.</td></tr>';
    // tabulka závitů
    const pouz = new Set([o.A && o.A.zavit && o.A.zavit.klic, o.B && o.B.zavit && o.B.zavit.klic, p.druh === 'vicko' ? p.vicko.zavit : null]);
    $('tabZavity').innerHTML = '<tr><th>Závit</th><th class="c">Ø vnější</th><th class="c">Stoupání</th><th class="c">Hloubka</th><th class="c">Úhel</th><th>Poznámka</th></tr>'
      + Object.entries(S.ZAVITY).filter(([k]) => k !== 'vlastni').map(([k, z]) => `<tr class="${pouz.has(k) ? 'pouzity' : ''}"><td>${esc(z.nazev)}</td><td class="c">${fmt(z.d, 2)}</td><td class="c">${fmt(z.p, 3)}</td><td class="c">${fmt(z.h, 2)}</td><td class="c">${fmt(2 * z.bok, 0)}°</td><td class="pozn-z">${esc(z.pozn)}</td></tr>`).join('');
    $('pZavity').textContent = `Rozměry v mm, stav k ${S.DATUM_DAT}. Trubkové závity G dle ISO 228-1 (zaoblený profil 55° je v modelu nahrazen lichoběžníkem). Hrubé závity IBC se u výrobců liší – vždy ověřte posuvkou a závitovou měrkou, případně zvolte vlastní závit.`;
    // síť
    $('vSit').innerHTML = m ? dl('Síť', m.ks.uzavrena ? '✔ uzavřená' : '✖ otevřená', `${m.ks.trojuhelniku} trojúhelníků, ${m.ks.hranOkrajovych} okrajových hran, ${m.ks.teles} ${m.ks.teles === 1 ? 'těleso' : 'tělesa'}, ${fmt(m.cas, 0)} ms`, m.ks.uzavrena ? 'ok-t' : 'chyba-t') : '';
    // karta v rohu
    $('karta3d').innerHTML = m ? `<div class="titul">${esc(S.DRUHY[p.druh])}</div><b>${esc(S.popis(p))}</b><br>`
      + `<b>${fmt(S.odhadTisku(m.objem, m.plocha, m.ks.bbox[5] - m.ks.bbox[2], p).gramy, 0)}</b> g ${S.MATERIALY[p.tisk.material].nazev} · ${podpory ? '<b>s podporami</b>' : 'bez podpor'}` : '';
    $('legenda3d').hidden = !(m && nahled.stav.tisk && nahled.stav.previsy);
    // souhrny oddílů
    const kr = k => S.ZAVITY[k].nazev.split(' –')[0];
    TrubkyGui.souhrn('sVstup', `${kr(p.vstup.zavit)} ${p.vstup.pohlavi === 'samice' || p.druh === 'zaslepka' ? 'vnitřní' : 'vnější'}`);
    TrubkyGui.souhrn('sVystup', S.popis(p).split('→ ')[1] || '');
    TrubkyGui.souhrn('sPruchodka', `otvor Ø ${fmt(p.pruchodka.otvor)}`);
    TrubkyGui.souhrn('sKonec', S.KONCE_PRUCHODKY[p.pruchodka.konec].split(' (')[0]);
    TrubkyGui.souhrn('sVicko', kr(p.vicko.zavit));
    TrubkyGui.souhrn('sVlastni', `Ø ${fmt(p.vlastni.d)} × ${fmt(p.vlastni.p)}`);
    TrubkyGui.souhrn('sZavit', `vůle ${fmt(p.zavit.vule, 2)}`);
    TrubkyGui.souhrn('sZaslepka', p.zaslepka.retizek ? 's uchem' : '');
    TrubkyGui.souhrn('sOtvory', `${p.vicko.vstupu}${p.vicko.prepad > 0 ? ' + přepad' : ''}`);
    TrubkyGui.souhrn('sTelo', S.TESNENI[p.telo.tesneni].split(' ')[0].toLowerCase());
    const zv = S.ZAVITY[p.vstup.zavit];
    $('pVstup').textContent = `${zv.pozn}. Data k ${S.DATUM_DAT}.`;
    $('pPruchodka').textContent = p.druh === 'pruchodka' ? `Dřík má tiskový závit Ø ${fmt(o.zavit.d)} × ${fmt(o.zavit.p)} (otvor − 0,6 mm). Délka závitu = stěna + těsnění + matice + 2 mm.` : '';
    $('pVystup').textContent = p.vystup.typ === 'trn' ? 'Trn: zuby o 5–15 % větší než vnitřek hadice, hadici zajistěte sponou za posledním zubem.'
      : p.vystup.typ === 'zavit' ? `${S.ZAVITY[p.vystup.zavit].pozn}.`
        : p.vystup.typ === 'hrdlo' ? 'Hrdlo s vůlí 0,3 mm na průměr; doraz trubky je kuželový (tiskne se bez podpor).'
          : 'Zjednodušený samec spojky typu Gardena – rozměry orientační, originální díl na závit G 3/4″ je přesnější a těsnější.';
    $('pTelo').textContent = o.A && o.A.tesneni ? (o.A.tesneni.typ === 'plocha' ? `Podložka ${fmt(o.A.tesneni.OD, 1)} × ${fmt(o.A.tesneni.ID, 1)} mm leží na dně závitu.` : `O-kroužek ${fmt(o.A.tesneni.ID, 1)} × ${fmt(o.A.tesneni.snura, 1)} v čelní drážce.`) : '';
    // hlášení
    if (!wasm && !chybaStavby) H = H.concat([{ uroven: 'info', text: 'Načítám geometrické jádro (manifold-3d)…', pole: [] }]);
    const ul = $('hlaseni'); ul.innerHTML = '';
    const poradi = { chyba: 0, varovani: 1, ok: 2, info: 3 };
    for (const x of H.slice().sort((a, b) => poradi[a.uroven] - poradi[b.uroven])) {
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
        b.addEventListener('click', () => { zmen(q2 => S.poloz(q2, x.oprava.pole, x.oprava.hodnota)); naplnFormular(); });
        li.appendChild(b);
      }
      ul.appendChild(li);
    }
    const nch = H.filter(x => x.uroven === 'chyba').length, nv = H.filter(x => x.uroven === 'varovani').length;
    const od = $('stavOdznak');
    od.className = 'odznak ' + (nch ? 'chyba' : nv ? 'mez' : 'ok');
    od.textContent = nch ? `✖ ${nch}` : nv ? `⚠ ${nv}` : '✔';
    $('sKontrola').textContent = nch ? `${nch} ${nch === 1 ? 'chyba' : nch < 5 ? 'chyby' : 'chyb'}` : nv ? `${nv} varování` : 'v pořádku';
    const boxy = { boxDil: false, boxVystup: false };
    for (const x of H) if (x.uroven === 'chyba') for (const c of x.pole) {
      const el = [...document.querySelectorAll(`[data-p="${c}"]`)].find(e => !e.closest('[hidden]')), bx = el && el.closest('[data-box]');
      if (bx && bx.id in boxy) boxy[bx.id] = true;
    }
    for (const [id, a] of Object.entries(boxy)) TrubkyGui.oznacChybu(id, a);
  }
  function jdiNaPole(cesta) {
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
    zmen(x => { x.tisk.orientace = tr.dataset.klic; }); naplnFormular();
  });
  $('tabOrientace').addEventListener('keydown', e => { if (e.key === 'Enter') e.target.click(); });

  /* ---------- nabídky, export ---------- */
  TrubkyGui.pripoj({ klic: 'webapp_ibc_gui', pohled: j => nahled.pohled(j) });
  const seznam = $('seznamPredvoleb');
  S.PREDVOLBY.forEach((v, i) => {
    const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
    b.innerHTML = `${esc(v.nazev)}<span class="pozn">${esc(v.popis)}</span>`;
    b.addEventListener('click', () => nahrad(S.zPredvolby(i)));
    seznam.appendChild(b);
  });
  const jmenoSouboru = pripona => ((p.nazev || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/^_|_$/g, '') || 'ibc') + pripona;
  function stahni(data, nazev, typ) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type: typ }));
    a.download = nazev; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function kusy(n) {
    if (!model) { Dialog.chyba(chybaStavby || (wasm ? 'Model nelze sestavit – viz záložka Kontrola.' : 'Geometrické jádro se ještě načítá.')); return null; }
    const d = { poz: model.tisk.poz, idx: model.idx, barva: '#3F8FC9' };
    return KRAB.tiskoveRozlozeni(Array.from({ length: n }, (_, i) => Object.assign({ jmeno: 'ibc', nazev: (p.nazev || 'IBC') + (n > 1 ? ` ${i + 1}` : '') }, d)), 8);
  }
  function exportStl(n) { const k = kusy(n); if (k) stahni(KRAB.stlBinarni(k, 'ibc - github_site'), jmenoSouboru(n > 1 ? `_${n}ks.stl` : '.stl'), 'model/stl'); }
  $('btnStl').addEventListener('click', () => exportStl(p.tisk.kusu));
  $('btnStl1').addEventListener('click', () => exportStl(1));
  $('btn3mf').addEventListener('click', () => { const k = kusy(p.tisk.kusu); if (k) stahni(KRAB.soubor3mf(k, p.nazev || 'IBC'), jmenoSouboru('.3mf'), 'model/3mf'); });
  $('btnPng').addEventListener('click', () => { fetch(nahled.png()).then(r => r.blob()).then(b => stahni(b, jmenoSouboru('.png'))); });
  $('btnUlozit').addEventListener('click', () => stahni(S.ulozProjekt(p), jmenoSouboru('.json'), 'application/json'));
  $('btnNacist').addEventListener('click', () => $('soubor').click());
  $('soubor').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try { const r = S.nactiProjekt(await f.text()); nahrad(r.p); hlasPrevod(r.hlaseni, 'Načtený projekt'); }
    catch (err) { Dialog.chyba(err.message); }
  });
  $('btnVychozi').addEventListener('click', async () => {
    if (await Dialog.potvrd('Vrátit všechny hodnoty na výchozí (první předvolba)?')) nahrad(S.zPredvolby(0));
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
  prepinac('tDuchove', 'duchove'); prepinac('tHrany', 'hrany'); prepinac('tTisk', 'tisk'); prepinac('tPrevisy', 'previsy');
  $('stavOdznak').addEventListener('click', () => TrubkyGui.otevriZalozku('kontrola'));
  $('btnZavritNap').addEventListener('click', () => $('napoveda').close());
  document.addEventListener('keydown', e => {
    const a = document.activeElement;
    const vPoli = a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || (a.tagName === 'INPUT' && !/checkbox|range|radio|button/.test(a.type));
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && !vPoli && k === 'z') { e.preventDefault(); krokHistorie(e.shiftKey ? znovu : zpet, e.shiftKey ? zpet : znovu); return; }
    if ((e.ctrlKey || e.metaKey) && !vPoli && k === 'y') { e.preventDefault(); krokHistorie(znovu, zpet); return; }
    if ((e.ctrlKey || e.metaKey) && k === 's') { e.preventDefault(); exportStl(p.tisk.kusu); return; }
    if (e.key === 'F1') { e.preventDefault(); $('napoveda').showModal(); return; }
    if (vPoli || e.ctrlKey || e.metaKey || e.altKey || $('napoveda').open) return;
    const pohl = { 1: 'iso', 2: 'shora', 3: 'zepredu', 4: 'zboku' }[k];
    if (pohl) nahled.pohled(pohl);
    else if (k === 'm') $('tTisk').click(); else if (k === 'd') $('tDuchove').click(); else if (k === 'v') $('tPrevisy').click(); else if (k === 'h') $('tHrany').click();
  });
  new MutationObserver(() => naplanuj()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  if (typeof Tvary !== 'undefined') Tvary.pripoj({
    klic: 'webapp_ibc_tvary', typ: 'ibc', nazev: 'Adaptéry IBC', kontejner: $('tvary'),
    parametry: () => S.kopie(p),
    pouzij: q => { const n = S.normalizuj(q); hlasPrevod(n.hlaseni, 'Uložený adaptér'); nahrad(n.p); },
    popis: q => `${q.nazev || 'IBC'} – ${S.popis(S.normalizuj(q).p)}`,
  });

  /* ---------- start ---------- */
  p = nactiUlozeny();
  naplnFormular();
  prepocitej();
  nactiManifold().then(w => { wasm = w; $('stav3d').textContent = ''; prepocitej(); }).catch(e => {
    chybaStavby = 'Geometrické jádro (manifold-3d) se nenačetlo: ' + (e && e.message || e) + ' – model ani export nejsou k dispozici.';
    const st = $('stav3d'); st.textContent = chybaStavby; st.classList.add('chyba');
    vypis(S.kontroly(p, S.odvozene(p)).concat([{ uroven: 'chyba', text: chybaStavby, pole: [] }]), S.odvozene(p));
  });
  window.IBC_UI = { get p() { return p; }, get model() { return model; }, nahled, zmen, naplnFormular, prepocitej, nahrad };
})();

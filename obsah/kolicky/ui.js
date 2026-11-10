/* Kolíčky na prádlo – ovládání stránky: formulář, historie, manifold, přepočet, výsledky, mechanika (graf síly),
   kontroly, kusovník, export STL/3MF/SVG, boční profil 1:1, skicář, animace otevírání. */
/* global KOLICKY, KOLICKY_GEOM, KOLICKY_NAHLED, KOLICKY_SKICAR, KRAB, Dialog, Tvary, TrubkyGui */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  window.addEventListener('error', e => {
    const st = $('stav3d'); if (!st) return;
    st.textContent = `Chyba skriptu: ${e.message} (${String(e.filename || '').split('/').slice(-2).join('/')}:${e.lineno}) – zkuste Ctrl+Shift+R.`;
    st.classList.add('chyba');
  });
  const K = KOLICKY, fmt = K.fmt, RAD = K.RAD;
  const KLIC = 'webapp_kolicky_projekt', KLIC_VZHLED = 'webapp_kolicky_vzhled';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- stav a historie ---------- */
  let p, wasm = null, model = null, chybaStavby = null, chybaJadra = null, bezWebgl = false, oPosl = null;
  const zpet = [], znovu = [];
  function hlasPrevod(hl, co) { if (hl && hl.length) setTimeout(() => Dialog.info(`${co} upraven: ${hl.join('; ')}.`), 300); }
  function nactiUlozeny() {
    try {
      const t = localStorage.getItem(KLIC);
      if (t) { const r = K.normalizuj(JSON.parse(t)); hlasPrevod(r.hlaseni, 'Uložený projekt'); return r.p; }
    } catch (e) { /* poškozený záznam */ }
    return K.zPredvolby(0);
  }
  // zápis do localStorage odložený (tažení bodu ve skicáři = desítky změn za sekundu), při odchodu ze stránky hned
  let ulozCas = null;
  function ulozHned() { clearTimeout(ulozCas); ulozCas = null; try { localStorage.setItem(KLIC, JSON.stringify(p)); } catch (e) { /* plné úložiště */ } }
  function uloz() { clearTimeout(ulozCas); ulozCas = setTimeout(ulozHned, 400); }
  window.addEventListener('pagehide', () => { if (ulozCas) ulozHned(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && ulozCas) ulozHned(); });
  function zmen(fn, slouceni) {
    const pred = JSON.stringify(p);
    fn(p);
    p = K.normalizuj(p).p;
    if (JSON.stringify(p) === pred) return;
    const posl = zpet[zpet.length - 1];
    if (!(slouceni && posl && posl.klic === slouceni && Date.now() - posl.cas < 1200)) zpet.push({ stav: pred, klic: slouceni, cas: Date.now() });
    else posl.cas = Date.now();
    if (zpet.length > 150) zpet.shift();
    znovu.length = 0;
    po();
  }
  function krokHistorie(z, do_) {
    if (!z.length) return;
    do_.push({ stav: JSON.stringify(p), cas: 0 });
    p = K.normalizuj(JSON.parse(z.pop().stav)).p;
    if (skicar) skicar.zrusVyber();
    naplnFormular(); po();
  }
  function po() {
    $('btnZpet').disabled = !zpet.length; $('btnZnovu').disabled = !znovu.length;
    uloz(); viditelnost(); naplanuj();
    if (skicar) skicar.kresli();
  }
  function nahrad(q) { zmen(x => { Object.keys(x).forEach(k => delete x[k]); Object.assign(x, q); }); if (skicar) skicar.zrusVyber(); naplnFormular(); }

  /* ---------- formulář ---------- */
  const opt = (sel, obj, f) => { $(sel).innerHTML = Object.entries(obj).map(([k, v]) => `<option value="${k}">${esc(f(k, v))}</option>`).join(''); };
  opt('f_kpred', K.KOVOVE, (k, v) => v.nazev);
  opt('f_cdruh', K.CEPY, (k, v) => v.nazev);
  opt('f_tpred', K.TLACNE, (k, v) => v.nazev);
  opt('f_konec', K.KONCE, (k, v) => v);
  opt('f_cprof', K.PROFILY_CELISTI, (k, v) => v);
  opt('f_mat', K.MATERIALY, (k, v) => `${v.nazev} – ${fmt(v.hustota, 2)} g/cm³`);
  const segment = (id, obj, cesta) => {
    $(id).innerHTML = Object.entries(obj).map(([k, v]) => `<button type="button" data-seg="${cesta}" data-hodnota="${k}" title="${esc(v.popis || '')}"><span aria-hidden="true">${v.znak || ''}</span>${esc(v.nazev || v)}</button>`).join('');
  };
  segment('segPruzina', K.DRUHY, 'pruzina');
  segment('segTvar', K.TVARY, 'telo.tvar');
  segment('segOcka', { kruh: { nazev: 'Kruh', znak: '○' }, elipsa: { nazev: 'Elipsa', znak: '⬭' }, kosoctverec: { nazev: 'Kosočtverec', znak: '◇' }, oval: { nazev: 'Ovál', znak: '⊂⊃' } }, 'ocka.tvar');
  segment('segHacek', { hacek: { nazev: 'Háček', znak: '⌐' }, oko: { nazev: 'Oko', znak: '◯' }, klip: { nazev: 'Klip', znak: '◔' } }, 'hacek.tvar');
  document.querySelectorAll('[data-seg]').forEach(b => b.addEventListener('click', () => {
    zmen(x => (b.dataset.seg === 'pruzina' ? K.prepniDruh(x, b.dataset.hodnota) : K.poloz(x, b.dataset.seg, b.dataset.hodnota))); naplnFormular();
  }));

  const pole = [...document.querySelectorAll('[data-p]')];
  function naplnFormular() {
    for (const el of pole) {
      const h = K.vezmi(p, el.dataset.p);
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
        h = K.cislo(el.value, NaN);
        el.classList.toggle('spatne', !Number.isFinite(h));
        if (!Number.isFinite(h)) return;
      }
      zmen(x => {
        // ruční rozměr pružiny = vlastní pružina
        if (/^kov\.(drat|prumer|zavitu|noha|volnyUhel)$/.test(c) && x.kov.predloha !== 'vlastni') {
          const kv = K.KOVOVE[x.kov.predloha]; Object.assign(x.kov, { drat: kv.drat, prumer: kv.prumer, zavitu: kv.zavitu, noha: kv.noha, volnyUhel: kv.volnyUhel });
          if (Math.abs(kv[c.split('.')[1]] - h) > 1e-9) x.kov.predloha = 'vlastni';
        }
        if (/^tlacna\.(drat|prumer|delka|zavitu)$/.test(c) && x.tlacna.predloha !== 'vlastni') {
          const kv = K.TLACNE[x.tlacna.predloha]; Object.assign(x.tlacna, { drat: kv.drat, prumer: kv.prumer, delka: kv.delka, zavitu: kv.zavitu });
          if (Math.abs(kv[c.split('.')[1]] - h) > 1e-9) x.tlacna.predloha = 'vlastni';
        }
        K.poloz(x, c, h);
        // zapnutá skica bez bodů převezme parametrický obrys
        if (c === 'skica.zapnuta' && h && !x.skica.horni.length && oPosl) {
          x.skica.horni = K.obrysNaSkicu(oPosl.parametricky);
          x.skica.dolni = K.obrysNaSkicu(K.zrcadliY(oPosl.parametricky));
        }
        if (c === 'skica.soumerna' && !h && x.skica.horni.length) x.skica.dolni = x.skica.horni.map(b => (b[2] ? [b[0], -b[1], 1] : [b[0], -b[1]])).reverse();
      }, c);
      if (/^kov\.|^tlacna\.|^skica\./.test(c)) naplnFormular();
    };
    el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', akce);
    if (el.tagName === 'INPUT' && el.type === 'text' && el.dataset.typ !== 'text') {
      el.addEventListener('change', () => {
        const psano = K.cislo(el.value, NaN), h = K.vezmi(p, el.dataset.p), roz = K.ROZSAHY[el.dataset.p];
        el.value = String(h).replace('.', ',');
        if (roz && Number.isFinite(psano) && Math.abs(psano - h) > 1e-9) {
          el.classList.remove('zvyrazni'); void el.offsetWidth; el.classList.add('zvyrazni');
          Dialog.info(`${el.labels[0] ? el.labels[0].textContent.trim() : 'Hodnota'}: omezeno na ${fmt(roz[0], 2)}–${fmt(roz[1], 2)}, použito ${fmt(h, 2)}.`);
        }
      });
      el.addEventListener('keydown', e => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        const h = K.cislo(el.value, NaN); if (!Number.isFinite(h)) return;
        e.preventDefault();
        const krok = (e.shiftKey ? 10 : e.altKey ? 0.1 : 1) * (e.key === 'ArrowUp' ? 1 : -1);
        el.value = fmt(Math.round((h + krok) * 1000) / 1000, 3);
        el.dispatchEvent(new Event('input'));
      });
    }
  }

  /** Ukáže jen pole, která pro zvolenou pružinu / tvar dávají smysl. */
  function viditelnost() {
    const dr = K.DRUHY[p.pruzina], sk = p.skica.zapnuta;
    for (const el of document.querySelectorAll('[data-pruz]')) el.hidden = !el.dataset.pruz.split(' ').includes(p.pruzina);
    for (const el of document.querySelectorAll('[data-ocko-sirka]')) el.hidden = p.ocka.tvar === 'kruh';
    for (const el of document.querySelectorAll('[data-smycka]')) el.hidden = p.oblouk.tvar !== 'smycka';
    $('f_brad').closest('.pole').querySelector('.pozn').textContent = p.oblouk.tvar === 'smycka' ? '0 = 6 mm' : '0 = elipsa';
    for (const el of document.querySelectorAll('[data-hsir]')) el.hidden = !(p.hacek.sirka > 0 && p.hacek.sirka < p.telo.sirka);
    for (const el of document.querySelectorAll('[data-kloub]')) el.hidden = !dr.kloub;
    for (const el of document.querySelectorAll('[data-cep-prumer]')) el.hidden = p.cep.druh === 'filament';
    for (const el of document.querySelectorAll('[data-cep-lis]')) el.hidden = p.cep.druh === 'sroub';
    const pr = p.celisti.profil;
    for (const el of document.querySelectorAll('[data-zuby]')) el.hidden = pr === 'rovne';
    for (const el of document.querySelectorAll('[data-pocet]')) if (!el.hidden) el.hidden = !['zuby', 'vlnky', 'drazka'].includes(pr);
    $('lZpocet').textContent = pr === 'drazka' ? 'Počet per (1–3)' : pr === 'vlnky' ? 'Počet vln' : 'Počet zoubků';
    $('lZhl').textContent = { zuby: 'Výška zoubků', vlnky: 'Výška vln', drazka: 'Výška pera', kulate: 'Vypouklost', zobak: 'Přesah zobáčku', kapsa: 'Hloubka kapsy' }[pr] || 'Výška';
    $('pCelisti').textContent = { zuby: 'Zoubky mají zaoblené vrcholy i dna a boky do 45°; od náběhu plynule vyrůstají, takže látka vjede bez zadrhnutí a vytáhnout ji jde jen otevřením.',
      vlnky: 'Měkké vlny – nepoškodí jemnou látku.', drazka: 'Pero na horní čelisti zapadne do drážky na dolní – drží šňůrky, stuhy i tenké papíry.',
      kulate: 'Čelisti jsou vypouklé a dotýkají se v čáře uprostřed – šetrné k látce, netlačí hranou.', zobak: 'Horní špička přesahuje před dolní – věc z kolíčku nevyklouzne dopředu.',
      kapsa: 'Do kapes v obou čelistech vlepte gumu nebo korek (o 0,4 mm silnější) – drží i hladké a kluzké věci.' }[pr] || '';
    for (const el of document.querySelectorAll('[data-snura]')) el.hidden = !p.celisti.snura;
    for (const el of document.querySelectorAll('[data-magnet]')) el.hidden = p.celisti.magnet === 'zadny';
    for (const el of document.querySelectorAll('[data-hacek]')) el.hidden = !p.hacek.zapnuty;
    for (const el of document.querySelectorAll('[data-htvar]')) el.hidden = el.dataset.htvar !== p.hacek.tvar;
    for (const el of document.querySelectorAll('[data-param]')) el.hidden = sk;
    $('pSkicaTvar').hidden = !sk;
    document.querySelectorAll('[data-seg]').forEach(b => b.setAttribute('aria-pressed', String(K.vezmi(p, b.dataset.seg) === b.dataset.hodnota)));
    $('pPruzina').textContent = dr.popis;
    $('btnNavrh').hidden = !K.PROSTOR[p.pruzina];
    $('lHpr').textContent = p.hacek.tvar === 'oko' ? 'Otvor Ø' : 'Tyč Ø';
    $('skUpravuji').disabled = p.skica.soumerna;
    if (p.skica.soumerna && skicar && skicar.upravuji !== 'horni') { skicar.upravuj('horni'); $('skUpravuji').value = 'horni'; }
    $('skVyzva').hidden = sk;
    for (const el of document.querySelectorAll('[data-podklad]')) el.hidden = !(skicar && skicar.podklad.je);
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
  const TXT_BEZ_WEBGL = 'Prohlížeč nepodporuje WebGL – 3D náhled není k dispozici, výpočty, skicář i export fungují.';
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const nahled = KOLICKY_NAHLED.vytvorNahled($('platno')) || { nastav() {}, pohled() {}, prepni() {}, png: () => '', prekresli() {}, barvy() {}, stav: { rozevreni: 0, rozpad: 0 } };
  let casovac = null;
  function naplanuj() { clearTimeout(casovac); casovac = setTimeout(prepocitej, 40); }
  const BARVY_DILU = { horni: '#3F7BD6', dolni: '#5D8FDC', kolicek: '#3F7BD6', vpruzina: '#3FAE6A', had: '#3FAE6A', cep: '#9AA3AD', tpu: '#E0A030', ocka: '#3FAE6A' };
  /** Díly v tiskové poloze s rozborem převisů. */
  function sestavTisk(r) {
    return r.tisk.map(d => {
      const b = obal(d.poz), poz = new Float32Array(d.poz.length);
      for (let i = 0; i < poz.length; i += 3) { poz[i] = d.poz[i] - (b[0] + b[3]) / 2; poz[i + 1] = d.poz[i + 1] - (b[1] + b[4]) / 2; poz[i + 2] = d.poz[i + 2] - b[2]; }
      const pv = K.previsy(poz, d.idx, 45);
      return Object.assign({}, d, { poz, tridy: pv.tridy, previs: pv, ks: KRAB.kontrolaSite(poz, d.idx) });
    });
  }
  function obal(poz) {
    const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (let i = 0; i < poz.length; i += 3) for (let k = 0; k < 3; k++) { b[k] = Math.min(b[k], poz[i + k]); b[k + 3] = Math.max(b[k + 3], poz[i + k]); }
    return b;
  }
  /** Kusy na podložku (všechny díly × počet kolíčků), rozložené do řad. */
  function kusyNaPodlozku(jen) {
    const out = [], ks = jen ? 1 : p.tisk.kusu;
    for (const d of model.tisk) {
      if (jen && d.dil !== jen) continue;
      for (let i = 0; i < ks; i++) out.push({ jmeno: d.dil, nazev: (p.nazev || 'Kolíček') + ' – ' + d.nazev + (ks > 1 ? ` ${i + 1}` : ''), poz: d.poz, idx: d.idx, tridy: d.tridy,
        role: d.dil === 'dolni' ? 'dolni' : d.dil === 'cep' ? 'cep' : /pruz|had|tpu|ocka/.test(d.dil) ? 'pruzina' : 'horni', barva: BARVY_DILU[d.dil] || '#808080' });
    }
    return rozloz(out, 5);
  }
  function rozloz(dily, mezera, sirka = 220) {
    const s = dily.map(d => ({ d, b: obal(d.poz) })).sort((a, b) => (b.b[3] - b.b[0]) - (a.b[3] - a.b[0]));
    let x = 0, y = 0, rada = 0, maxX = 0;
    const um = s.map(({ d, b }) => {
      const w = b[3] - b[0], h = b[4] - b[1];
      if (x > 0 && x + w > sirka) { x = 0; y += rada + mezera; rada = 0; }
      const pos = [x - b[0], y - b[1], -b[2]];
      x += w + mezera; rada = Math.max(rada, h); maxX = Math.max(maxX, x - mezera);
      return { d, pos };
    });
    const cx = maxX / 2, cy = (y + rada) / 2;
    return um.map(({ d, pos }) => {
      const poz = new Float32Array(d.poz.length);
      for (let i = 0; i < poz.length; i += 3) { poz[i] = d.poz[i] + pos[0] - cx; poz[i + 1] = d.poz[i + 1] + pos[1] - cy; poz[i + 2] = d.poz[i + 2] + pos[2]; }
      return Object.assign({}, d, { poz });
    });
  }
  function prepocitej() {
    nahled.barvy(css('--border-strong'), css('--border'), css('--text'));
    const o = K.odvozene(p);
    oPosl = o;
    let H = K.kontroly(p, o);
    model = null; chybaStavby = chybaJadra;
    if (wasm) {
      try {
        const t0 = performance.now();
        const r = KOLICKY_GEOM.postav(wasm, p, o);
        model = { o, sestava: r.sestava, duchove: r.duchove, rezy: r.rezy, volne: r.volne, volneDuchove: r.volneDuchove, tisk: sestavTisk(r), cas: 0 };
        model.podlozka = kusyNaPodlozku();
        model.cas = performance.now() - t0;
        for (const d of model.tisk) {
          if (!d.ks.uzavrena) H.push({ uroven: 'chyba', text: `Síť dílu „${d.nazev}“ není uzavřená – export by nemusel jít vytisknout.`, pole: [] });
          if (d.ks.teles > 1) H.push({ uroven: 'chyba', text: `Díl „${d.nazev}“ se rozpadl na ${d.ks.teles} kusy – zkontrolujte tvar (skica, háček, zářezy).`, pole: [] });
          if (K.potrebujePodpory({ volne: d.previs.volne, strme: d.previs.strme }, d.plocha)) H.push({ uroven: 'varovani', text: `${d.nazev}: ${fmt(d.previs.volne, 0)} mm² převisů bez opory – tiskněte s podporami.`, pole: [] });
        }
      } catch (e) {
        chybaStavby = 'Těleso nejde sestavit: ' + (e && e.message || e);
        H.push({ uroven: 'chyba', text: chybaStavby, pole: [] });
        model = null;
      }
    }
    const st = $('stav3d');
    st.textContent = chybaStavby || (bezWebgl ? TXT_BEZ_WEBGL : wasm ? '' : st.textContent); st.classList.toggle('chyba', !!chybaStavby);
    if (model) {
      nahled.nastav({ klic: p.pruzina + (p.hacek.zapnuty ? p.hacek.rameno : ''), sestava: model.sestava, tisk: model.podlozka, duchove: model.duchove,
        volne: model.volne, volneDuchove: model.volneDuchove, W: o.W,
        xp: o.xp, thetaMax: o.mech.thetaMax, pruzina: o.jazyk || o.vpruz || o.had || o.ocka || o.oblouk || o.vinuta || o.tpu || o.dratU || o.pasek || null });
    } else nahled.nastav(null);
    vypis(H, o, model);
    if (skicar) skicar.kresli();
  }

  /* ---------- výpisy ---------- */
  const dl = (popis, cislo, dalsi = '', tr = '') => `<div class="dlazdice"><div class="popis">${popis}</div><div class="cislo ${tr}">${cislo}</div>${dalsi ? `<div class="dalsi">${dalsi}</div>` : ''}</div>`;
  const cas = m => (m < 90 ? fmt(m, 0) + ' min' : fmt(m / 60, 1) + ' h');
  const tridaSily = F => (F < 1.5 ? 'chyba-t' : F < 3 ? 'mez-t' : 'ok-t');
  function vypis(H, o, m) {
    const mech = o.mech, mat = K.MATERIALY[p.tisk.material], ks = p.tisk.kusu;
    let v = '', celkem = { g: 0, min: 0 };
    if (m) for (const d of m.tisk) {
      const b = d.ks.bbox, odh = K.odhadTisku(d.objem, d.plocha, b[5] - b[2], p);
      d.odhad = odh; celkem.g += odh.gramy * ks; celkem.min += odh.minut * ks;
    }
    const otev = mech.otevreni(mech.thetaMax);
    v += dl('Kolíček', `${fmt(o.L - o.x0)} × ${fmt(o.W)} mm`, `${K.DRUHY[p.pruzina].nazev.toLowerCase()}`);
    v += dl('Otevření čelistí', `${fmt(otev)} mm`, `rukojeti ${fmt(mech.thetaMax / RAD, 1)}°, páka ${fmt((o.xh - o.xp) / (o.xp - o.xc), 2)} : 1`, otev < 4 ? 'mez-t' : 'ok-t');
    v += dl('Sevření', `${fmt(mech.Fsevreni, 1)} N`, `látka ${fmt(p.tisk.latka)} mm (≈ ${fmt(mech.Fsevreni / 9.81 * 1000, 0)} g)`, tridaSily(mech.Fsevreni));
    v += dl('Stisk prstů', `${fmt(mech.Fprsty, 1)} N`, 'na plné otevření', mech.Fprsty > 45 ? 'mez-t' : 'ok-t');
    if (m) {
      v += dl('Hmotnost', `≈ ${fmt(celkem.g, 1)} g`, `${mat.nazev}, ${ks} ks, výplň ${fmt(p.tisk.vypln, 0)} %`);
      v += dl('Doba tisku', `≈ ${cas(celkem.min)}`, 'všechny díly, hrubý odhad');
      $('tabDily').innerHTML = '<tr><th>Díl</th><th class="c">Ks</th><th class="c">Rozměr na podložce</th><th class="c">Hmotnost</th><th class="c">Čas</th><th>Podpory</th></tr>'
        + m.tisk.map(d => { const b = d.ks.bbox, pp = K.potrebujePodpory({ volne: d.previs.volne, strme: d.previs.strme }, d.plocha);
          return `<tr><td>${esc(d.nazev)}</td><td class="c">${ks}</td><td class="c">${fmt(b[3] - b[0], 0)} × ${fmt(b[4] - b[1], 0)} × ${fmt(b[5] - b[2], 1)} mm</td>`
          + `<td class="c">${fmt(d.odhad.gramy, 1)} g</td><td class="c">${cas(d.odhad.minut)}</td><td class="${pp ? 'mez-t' : 'ok-t'}">${pp ? 'potřebuje' : 'bez podpor'}</td></tr>`; }).join('');
    } else { v += dl('Model', wasm ? 'nesestaven' : 'načítám…', chybaStavby || ''); $('tabDily').innerHTML = ''; }
    $('vVysledky').innerHTML = v;
    $('sVysledky').textContent = `${fmt(mech.Fsevreni, 1)} N`;

    // mechanika
    graf(mech);
    const radky = [];
    const sig = th => (mech.jednotka === '%' ? `${fmt(mech.sigma(th), 0)} %` : `${fmt(mech.sigma(th), 0)} MPa`);
    if (mech.k != null) radky.push(['Tuhost pružiny v ose', `${fmt(mech.k * RAD, 2)} N·mm/°`, 'moment na stupeň rozevření ramen']);
    if (o.dr.kov) radky.push(['Úhel nohou v kolíčku', `${fmt(mech.montaz / RAD, 0)}°`, `volný ${fmt(p.kov.volnyUhel, 0)}° → předpětí ${fmt(mech.predpeti / RAD, 0)}°`]);
    radky.push(['Moment v klidu', `${fmt(mech.M(0), 0)} N·mm`, `sevření bez látky ${fmt(mech.Fklid, 1)} N`]);
    radky.push(['Sevření látky', `${fmt(mech.Fsevreni, 1)} N`, `látka ${fmt(p.tisk.latka)} mm, střed čelistí ${fmt(o.xc)} mm od špičky`]);
    radky.push(['Plné otevření', `${fmt(mech.otevreni(mech.thetaMax))} mm`, `${mech.thetaPruz != null && mech.thetaPruz <= mech.thetaRukojeti ? 'zastaví pružina' : 'zastaví rukojeti'}; prsty ${fmt(mech.Fprsty, 1)} N`]);
    const trida = (a, b) => (a <= b * 0.8 ? 'ok-t' : a <= b ? 'mez-t' : 'chyba-t');
    radky.push([mech.jednotka === '%' ? 'Protažení gumy' : 'Napětí v pružině', `${sig(mech.thetaMax)}`, `dovoleno ${mech.jednotka === '%' ? fmt(mech.dov, 0) + ' %' : fmt(mech.dov, 0) + ' MPa'} (${mech.material || mat.nazev})`, trida(mech.sigma(mech.thetaMax), mech.dov)]);
    radky.push(['Rameno u osy', `${fmt(mech.sigmaRamene, 1)} MPa`, `stěna ${fmt(mech.ramenoH, 1)} mm, ${mat.nazev} snese ≈ ${fmt(mech.dovRamene, 0)} MPa`, trida(mech.sigmaRamene, mech.dovRamene)]);
    if (o.hacek && !o.hacek.chybi) radky.push(['Háček unese', `≈ ${fmt(o.hacek.nosnost, 1)} kg`, `${K.HACKY[o.hacek.tvar]}, chcete ${fmt(p.hacek.zatizeni, 1)} kg`, p.hacek.zatizeni > o.hacek.nosnost ? 'chyba-t' : 'ok-t']);
    $('tabMech').innerHTML = '<tr><th>Veličina</th><th class="c">Hodnota</th><th>Poznámka</th></tr>'
      + radky.map(r => `<tr><td>${esc(r[0])}</td><td class="c ${r[3] || ''}">${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join('');
    $('pMech').textContent = 'Odhad z teorie pružnosti (ohyb nosníku, torzní pružina podle Shigleyho). Skutečná síla tištěné pružiny se liší podle tiskárny a obvodů – berte hodnoty jako srovnání variant.'
      + (o.dr.kov ? ' U recyklované pružiny rozhoduje volný úhel nohou – změřte ho úhloměrem nebo odhadněte z fotky.' : '');
    $('sMechanika').textContent = Number.isFinite(mech.thetaMat) && o.dr.tistena ? '⚠ únava' : `${fmt(otev)} mm`;
    $('pMaterial').textContent = `${mat.pozn} Orientačně: E ≈ ${fmt(mat.E, 0)} MPa, mez ≈ ${mat.mez} MPa, opakovaný ohyb ≈ ${mat.cyklus} MPa (stav ${K.DATUM_DAT}).`;
    $('sTisk').textContent = m ? `${fmt(celkem.g, 0)} g` : '';
    // pružina – poznámky
    if (o.drat) $('pKov').textContent = `Vnitřní Ø cívky ${fmt(o.drat.Di, 2)} mm, délka cívky ${fmt(o.drat.delka, 1)} mm${p.pruzina === 'kov_trmen' ? ` (${(window.I18N && I18N.preloz ? I18N.preloz : x => x)('průchozí cívka přes celou šířku')})` : ''}. ` + (p.pruzina !== 'kov_plast'
      ? 'Volný úhel = úhel mezi nohama vyndané pružiny (u dřevěných kolíčků bývají nohy skoro rovnoběžné, 0–15°).'
      : 'Volný úhel = úhel mezi nohama vyndané pružiny (u plastových kolíčků 30–60°).');
    if (o.guma && !o.guma.chybi) $('pGumicka').textContent = `Obvod drážky ${fmt(o.guma.obvod, 0)} mm → doporučený O‑kroužek ${fmt(o.guma.doporuc)} × ${fmt(o.guma.cs, 1)} mm (protažení ≈ 30 %). `
      + `Teď protažení ${fmt(100 * (mech.eps ? mech.eps(0) : 0), 0)} % v klidu, ${fmt(100 * (mech.eps ? mech.eps(mech.thetaMax) : 0), 0)} % otevřený.`;
    if (o.hacek && !o.hacek.chybi) $('pHacek').textContent = `Háček unese asi ${fmt(o.hacek.nosnost, 1)} kg (${mat.nazev}, ohyb ve vrstvách). Délka kolíčku s háčkem ${fmt(o.L - o.x0, 0)} mm.`;

    // kusovník a montáž
    const kus = K.kusovnik(p, o);
    const dily = o.dily.map(d => ({ ks: d.ks, co: `Tištěný díl: ${d.nazev.toLowerCase()}`, pozn: '' }));
    $('tabKusovnik').innerHTML = '<tr><th class="c">Ks</th><th>Položka</th><th>Poznámka</th></tr>'
      + dily.concat(kus).map(x => `<tr><td class="c">${x.ks}</td><td>${esc(x.co)}</td><td>${esc(x.pozn || '')}</td></tr>`).join('');
    $('pMontaz').innerHTML = '<b>Montáž:</b> ' + esc({
      kov_drevo: 'Ramena přiložte vnitřními stranami k sobě, cívku vložte do zářezů a nohy kleštěmi natáhněte přes vnější strany do drážek až do příčných zářezů u čelistí.',
      kov_plast: 'Pružinu nasaďte na čep mezi oka kloubu, nohy opřete do drážek na rukojetích, ramena srovnejte a čep protlačte (do dolního ramene jde ztuha).',
      omega: 'Bez montáže – po tisku jen několikrát stiskněte, aby se oko rozhýbalo.',
      jazycek: 'Ramena složte oky kloubu k sobě, stiskem rukojetí schovejte jazýček a protlačte čep.',
      listova: 'Složte ramena a protlačte čep. V pružinu stiskněte prsty a konce zasuňte do kapes na rukojetích, špičkou ke kloubu.',
      meandr: 'Složte ramena a protlačte čep. Pružinu stlačte a ploškami zasuňte do kapes na rukojetích.',
      gumicka: 'Složte ramena a protlačte čep. Gumičku natáhněte přes čelisti do drážek.',
      kov_trmen: 'Ramena přiložte k sobě, cívku vložte do zářezu v ose (je osou otáčení) a obě nohy kleštěmi přetáhněte po bocích přes horní a spodní stranu do příčných zářezů u čelistí.',
      tlacna: 'Pružinu zasuňte do jamky v dolní rukojeti, ramena složte (pružina zapadne do horní jamky), stiskněte a protlačte čep.',
      dratU: 'Drát ohněte do U podle bočního profilu 1:1 a ramínka rozevřete o předpětí. Vložte ho do drážek ohybem ke kloubu, složte ramena a protlačte čep.',
      pasek: 'Pásek zasuňte do štěrbiny v dolní rukojeti (kapka vteřinového lepidla), složte ramena, stiskněte a protlačte čep.',
      tpu: 'Váleček z TPU vložte do jamky v dolní rukojeti, složte ramena, stiskněte a protlačte čep.',
      ocka: 'Očka vložte ploškami do kapes na rukojetích, složte ramena, stiskněte a protlačte čep.',
      oblouk: 'Ramena složte, stiskněte (rameno oblouku se zasune pod druhou rukojeť) a protlačte čep.',
    }[p.pruzina]) + (p.cep.druh === 'filament' && o.kloub ? ' Konce filamentu zatavte, aby čep nevypadl.' : '');

    // síť
    $('vSit').innerHTML = m ? m.tisk.map(d => dl('Síť – ' + d.nazev.toLowerCase(), d.ks.uzavrena ? '✔ uzavřená' : '✖ otevřená',
      `${d.ks.trojuhelniku} trojúhelníků, ${d.ks.teles} těleso`, d.ks.uzavrena && d.ks.teles === 1 ? 'ok-t' : 'chyba-t')).join('') + dl('Výpočet', `${fmt(m.cas, 0)} ms`, 'stavba a rozbor tisku') : '';
    $('karta3d').innerHTML = `<div class="titul">${esc(K.DRUHY[p.pruzina].nazev)}</div><b>${esc(fmt(o.L - o.x0) + ' × ' + fmt(o.W) + ' mm')}</b><br>`
      + `sevření <b>${fmt(mech.Fsevreni, 1)} N</b> · otevření <b>${fmt(otev)} mm</b>` + (m ? `<br><b>${fmt(celkem.g, 1)}</b> g ${mat.nazev}` : '');
    $('legenda3d').hidden = !(m && nahled.stav.tisk && nahled.stav.previsy);
    rozevreniText();
    $('legendaVolne').hidden = !(m && nahled.stav.volne && !nahled.stav.tisk);
    $('tPredpeti').textContent = predpetiText(o);
    // souhrny oddílů
    TrubkyGui.souhrn('sTelo', p.skica.zapnuta ? `skica, čep ${fmt(p.telo.cep)}` : `${K.TVARY[p.telo.tvar].nazev}, ${fmt(p.telo.delka)} × ${fmt(p.telo.sirka)}`);
    TrubkyGui.souhrn('sCelisti', [K.PROFILY_CELISTI[p.celisti.profil].split(' ')[0], p.celisti.snura ? `šňůra Ø ${fmt(p.celisti.snuraPrumer)}` : '', p.celisti.magnet !== 'zadny' ? 'magnet' : ''].filter(Boolean).join(', '));
    TrubkyGui.souhrn('sHacek', p.hacek.zapnuty ? `${K.HACKY[p.hacek.tvar].split(' ')[0]} Ø ${fmt(p.hacek.prumer)}` : 'ne', p.hacek.zapnuty);
    if (o.drat) TrubkyGui.souhrn('sKov', `Ø ${fmt(o.drat.d, 2)} / ${fmt(o.drat.D, 1)}, ${fmt(o.drat.n)} z.`);
    if (o.kloub) TrubkyGui.souhrn('sCep', `Ø ${fmt(o.kloub.d, 2)}, ${K.CEPY[p.cep.druh].nazev.split(' ')[0]}`);
    TrubkyGui.souhrn('sOmega', `R ${fmt(p.omega.polomer)} × ${fmt(p.omega.tloustka, 2)}`);
    TrubkyGui.souhrn('sJazycek', `${fmt(p.jazycek.delka)} × ${fmt(p.jazycek.tloustka, 2)}`);
    TrubkyGui.souhrn('sListova', `${fmt(p.listova.delka)} × ${fmt(p.listova.tloustka, 2)}`);
    TrubkyGui.souhrn('sMeandr', `${p.meandr.zavitu}× ${fmt(p.meandr.sirka)} mm`);
    if (o.vinuta && !o.vinuta.chybi) TrubkyGui.souhrn('sTlacna', `${fmt(o.vinuta.d, 2)} × ${fmt(o.vinuta.D, 1)} × ${fmt(o.vinuta.L0)} mm`);
    TrubkyGui.souhrn('sDratU', `Ø ${fmt(p.dratU.drat, 2)} × ${fmt(p.dratU.delka)} mm`);
    TrubkyGui.souhrn('sPasek', `${fmt(p.pasek.tloustka, 2)} × ${fmt(p.pasek.delka)} mm`);
    TrubkyGui.souhrn('sOcka', `${p.ocka.pocet}× ${K.TVARY_OCEK[p.ocka.tvar]}`);
    TrubkyGui.souhrn('sOblouk', `${p.oblouk.rameno === 'horni' ? 'horní' : 'dolní'}, ${fmt(p.oblouk.tloustka, 2)} × ${fmt(p.oblouk.delka)} mm`);
    if (o.oblouk && !o.oblouk.chybi) $('pOblouk').textContent = `Oblouk (${(t => (window.I18N && I18N.preloz ? I18N.preloz(t) : t))({ elipsa: 'elipsa', omega: 'kruhové oko Ω', U: 'tvar U', smycka: 'smyčka' }[o.oblouk.tvar])}): výška ${fmt(2 * o.oblouk.R, 1)} mm, nejmenší poloměr ${fmt(o.oblouk.rMin, 1)} mm, přečnívá ${fmt(o.oblouk.presah, 1)} mm za konec, tloušťka ${fmt(o.oblouk.tb, 2)} mm, šířka ${fmt(o.oblouk.b, 1)} mm; celá pružina ${fmt(o.oblouk.delkaPruziny, 0)} mm, rameno tlačí ${fmt(o.oblouk.xk, 1)} mm od špičky, ustoupit může o ${fmt(o.oblouk.zdvih, 1)} mm.`;
    else if (o.oblouk) $('pOblouk').textContent = '';
    TrubkyGui.souhrn('sTpu', `Ø ${fmt(p.tpu.prumer)}${p.tpu.stena > 0 ? ' trubička' : ''}`);
    if (o.guma && !o.guma.chybi) TrubkyGui.souhrn('sGumicka', `${fmt(o.guma.ID)} × ${fmt(o.guma.cs, 1)}`);
    // exporty jednotlivých dílů
    $('exportDilu').innerHTML = '';
    if (m) for (const d of m.tisk) {
      const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
      b.textContent = `⬇ STL – ${d.nazev.toLowerCase()} (1 kus)`;
      b.addEventListener('click', () => exportStl(d.dil));
      $('exportDilu').appendChild(b);
    }
    // hlášení
    if (!wasm && !chybaStavby) H = H.concat([{ uroven: 'info', text: 'Načítám geometrické jádro (manifold-3d)…', pole: [] }]);
    if (!H.some(h => h.uroven === 'chyba' || h.uroven === 'varovani')) H.unshift({ uroven: 'ok', text: `Vše v pořádku – ${K.popis(p)}.`, pole: [] });
    const ul = $('hlaseni'); ul.innerHTML = '';
    for (const x of H) {
      const li = document.createElement('li'); li.className = x.uroven + (x.pole && x.pole.length ? ' skok' : '');
      li.textContent = x.text;
      if (x.pole && x.pole.length) {
        li.tabIndex = 0;
        const kam = document.createElement('span'); kam.className = 'kam'; kam.textContent = '→ upravit'; li.appendChild(kam);
        li.addEventListener('click', e => { if (e.target.tagName !== 'BUTTON') jdiNaPole(x.pole[0]); });
        li.setAttribute('role', 'button'); li.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); jdiNaPole(x.pole[0]); } });
      }
      if (x.oprava) {
        const b = document.createElement('button'); b.className = 'tl oprava'; b.textContent = '🔧 ' + x.oprava.text;
        b.addEventListener('click', () => {
          if (x.oprava.akce === 'navrh') { navrhni(); return; }
          zmen(q => { for (const [c, h] of Object.entries(x.oprava.zmeny)) K.poloz(q, c, h); }); naplnFormular();
        });
        li.appendChild(b);
      }
      ul.appendChild(li);
    }
    porovnani();
    const nch = H.filter(x => x.uroven === 'chyba').length, nv = H.filter(x => x.uroven === 'varovani').length;
    const od = $('stavOdznak');
    od.className = 'odznak ' + (nch ? 'chyba' : nv ? 'mez' : 'ok');
    od.textContent = nch ? `✖ ${nch}` : nv ? `⚠ ${nv}` : '✔';
    $('sKontrola').textContent = nch ? `${nch} ${nch === 1 ? 'chyba' : nch < 5 ? 'chyby' : 'chyb'}` : nv ? `${nv} varování` : 'v pořádku';
    const boxy = { boxPruzina: false, boxTvar: false };
    for (const x of H) if (x.uroven === 'chyba') for (const c of x.pole || []) {
      const el = document.querySelector(`[data-p="${c}"]`), bx = el && el.closest('[data-box]');
      if (bx && bx.id in boxy) boxy[bx.id] = true;
    }
    for (const [id, a] of Object.entries(boxy)) TrubkyGui.oznacChybu(id, a);
  }

  /** Tabulka: stejný kolíček s každým druhem pružiny. */
  function porovnani() {
    const r = K.porovnejPruziny(p);
    $('tabPorovnani').innerHTML = '<tr><th>Pružina</th><th class="c">Sevření</th><th class="c">Prsty</th><th class="c">Otevření</th><th class="c">Dílů</th><th>Stav</th></tr>'
      + r.map(x => `<tr class="klik${x.druh === p.pruzina ? ' vybrana' : ''}" data-druh="${x.druh}" tabindex="0"${x.druh === p.pruzina ? ' aria-current="true"' : ''}><td><span aria-hidden="true">${K.DRUHY[x.druh].znak}</span> <span>${esc(K.DRUHY[x.druh].nazev)}</span></td>`
        + `<td class="c ${tridaSily(x.Fs)}">${fmt(x.Fs, 1)} N</td><td class="c">${fmt(x.Fp, 1)} N</td><td class="c">${fmt(x.otevreni, 1)} mm</td><td class="c">${x.dilu}</td>`
        + `<td class="${x.chyb ? 'chyba-t' : x.varovani || x.unava ? 'mez-t' : 'ok-t'}">${x.chyb ? `✖ ${x.chyb}` : x.unava ? '⚠ únava' : x.varovani ? `⚠ ${x.varovani}` : '✔'}</td></tr>`).join('');
  }
  $('tabPorovnani').addEventListener('click', e => {
    const tr = e.target.closest('tr[data-druh]'); if (!tr) return;
    zmen(x => K.prepniDruh(x, tr.dataset.druh)); naplnFormular();
  });
  $('tabPorovnani').addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('tr')) { e.preventDefault(); e.target.click(); } });

  /** Návrh tištěné pružiny / gumičky na nejsilnější sevření bez únavy. */
  async function navrhni() {
    const b = $('btnNavrh'); b.disabled = true; const t = b.textContent; b.textContent = '⏳ Počítám…';
    // plné prohledání po dávkách – stránka mezitím kreslí a ukazuje průběh
    const g = K.navrhniKroky(p), p0 = p;
    let k, cas = performance.now();
    while (!(k = g.next()).done) {
      if (performance.now() - cas > 40) {
        b.textContent = `⏳ ${Math.round(100 * k.value.hotovo / k.value.celkem)} %`;
        await new Promise(r => setTimeout(r, 0)); cas = performance.now();
        if (p !== p0) { b.disabled = false; b.textContent = t; return; }   // projekt se mezitím změnil
      }
    }
    const r = k.value;
    b.disabled = false; b.textContent = t;
    if (!r) { Dialog.info('Pro tento kolíček jsem nenašel pružinu, která by vydržela bez únavy a nepřekročila 35 N na prsty. Zkuste delší rukojeti, větší rozevření nebo pružnější materiál (PETG, nylon).'); return; }
    if (!r.zmeny.length) { Dialog.info(`Současná pružina už je nejlepší (${fmt(r.F, 1)} N).`); return; }
    const pole = c => { const el = document.querySelector(`[data-p="${c}"]`), l = el && el.labels && el.labels[0]; return l ? l.childNodes[0].textContent.trim() : c; };
    const hod = v => (typeof v === 'boolean' ? (v ? 'ano' : 'ne') : fmt(v, 2));
    const text = r.zmeny.map(([c, a, n]) => `${pole(c)} ${hod(a)} → ${hod(n)}`).join(', ');
    if (await Dialog.potvrd(`Sevření ${fmt(r.F0, 1)} N → ${fmt(r.F, 1)} N (bez únavy materiálu ${K.MATERIALY[p.tisk.material].nazev}). Změny: ${text}. Použít?`)) { nahrad(r.p); }
  }
  $('btnNavrh').addEventListener('click', navrhni);

  /** Graf: síla čelistí a síla prstů podle otevření čelistí (SVG). */
  function graf(mech) {
    const k = mech.krivka, W = 520, Hh = 210, ml = 44, mr = 14, mt = 12, mb = 34;
    if (!k.length || !(mech.thetaMax > 0)) { $('graf').innerHTML = ''; return; }
    const xmax = Math.max(1, k[k.length - 1].otevreni), ymax0 = Math.max(1, ...k.map(r => Math.max(r.sila, r.prsty)));
    const kr = ymax0 > 20 ? 10 : ymax0 > 8 ? 5 : ymax0 > 4 ? 2 : 1, ymax = Math.ceil(ymax0 * 1.08 / kr) * kr;
    const X = x => ml + (W - ml - mr) * x / xmax, Y = y => mt + (Hh - mt - mb) * (1 - y / ymax);
    let s = `<svg class="graf" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Síla čelistí a prstů podle otevření">`;
    for (let y = 0; y <= ymax + 1e-9; y += kr) s += `<line class="mrz" x1="${ml}" x2="${W - mr}" y1="${Y(y)}" y2="${Y(y)}"/><text x="${ml - 6}" y="${Y(y) + 4}" text-anchor="end">${fmt(y, 0)}</text>`;
    const kx = xmax > 12 ? 2 : xmax > 5 ? 1 : 0.5;
    for (let x = 0; x <= xmax + 1e-9; x += kx) s += `<text x="${X(x)}" y="${Hh - mb + 16}" text-anchor="middle">${fmt(x, 1)}</text>`;
    s += `<line class="osa" x1="${ml}" x2="${W - mr}" y1="${Y(0)}" y2="${Y(0)}"/><line class="osa" x1="${ml}" x2="${ml}" y1="${mt}" y2="${Y(0)}"/>`;
    s += `<text x="${(ml + W - mr) / 2}" y="${Hh - 3}" text-anchor="middle">otevření čelistí [mm]</text><text x="12" y="${(mt + Hh - mb) / 2}" transform="rotate(-90 12 ${(mt + Hh - mb) / 2})" text-anchor="middle">síla [N]</text>`;
    const cara = (f, tr) => `<path class="${tr}" d="M${k.map(r => `${X(r.otevreni).toFixed(1)} ${Y(f(r)).toFixed(1)}`).join('L')}"/>`;
    s += cara(r => r.sila, 'k1') + cara(r => r.prsty, 'k2');
    const mezVid = Number.isFinite(mech.thetaMat) && mech.thetaMat < mech.thetaMax;
    if (mezVid) { const xm = X(mech.otevreni(mech.thetaMat)); s += `<line class="mez" x1="${xm}" x2="${xm}" y1="${mt}" y2="${Y(0)}"/>`; }
    const xl = mech.otevreni(Math.min(mech.thLatka, mech.thetaMax));
    s += `<circle class="bod" cx="${X(xl)}" cy="${Y(mech.Fsevreni)}" r="4"/><text x="${X(xl) + 7}" y="${Y(mech.Fsevreni) - 6}">látka ${fmt(mech.Fsevreni, 1)} N</text>`;
    $('graf').innerHTML = s + '</svg>';
    $('lgMez').hidden = !mezVid;
  }

  function jdiNaPole(cesta) {
    const el = [...document.querySelectorAll(`[data-p="${cesta}"]`)].find(e => !e.closest('[hidden]')) || document.querySelector(`[data-p="${cesta}"]`);
    if (!el) return;
    if (el.closest('#skicar')) { prepniSkicar(true); return; }
    const det = el.closest('details'); if (det) det.open = true;
    const tel = el.closest('.zalozka-telo'); if (tel) TrubkyGui.otevriZalozku(tel.dataset.telo);
    const bx = el.closest('[data-box]'); TrubkyGui.ukazBox(bx ? bx.dataset.box : 'obecne');
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.focus({ preventScroll: true });
    el.classList.remove('zvyrazni'); void el.offsetWidth; el.classList.add('zvyrazni');
  }

  /* ---------- boční profil (SVG 1:1) ---------- */
  function profilSvg(tisk) {
    if (!model) return null;
    const r = model.rezy, o = model.o, vse = [...r.horni, ...r.dolni, ...r.dalsi.flatMap(d => d.polygony)];
    const b = [Infinity, Infinity, -Infinity, -Infinity];
    for (const P of vse) for (const q of P) { b[0] = Math.min(b[0], q[0]); b[1] = Math.min(b[1], q[1]); b[2] = Math.max(b[2], q[0]); b[3] = Math.max(b[3], q[1]); }
    const okraj = 12, x0 = b[0] - okraj, y1 = b[3] + okraj, W = b[2] - b[0] + 2 * okraj, H = b[3] - b[1] + 2 * okraj + 16;
    const n = v => v.toFixed(2), d = P => 'M' + P.map(q => `${n(q[0] - x0)} ${n(y1 - q[1])}`).join('L') + 'Z';
    let g = `<path d="${r.horni.map(d).join('')}" fill="#dce7f8" stroke="#000" stroke-width="0.25" fill-rule="evenodd"/>`
      + `<path d="${r.dolni.map(d).join('')}" fill="#eef3fb" stroke="#000" stroke-width="0.25" fill-rule="evenodd"/>`;
    for (const x of r.dalsi) g += `<path d="${x.polygony.map(d).join('')}" fill="#d8f0de" stroke="#000" stroke-width="0.25" fill-rule="evenodd"/>`;
    for (const du of model.duchove) {
      if (du.druh !== 'kov' && du.druh !== 'guma') continue;
      g += `<path d="M${du.body.map(q => `${n(q[0] - x0)} ${n(y1 - q[1])}`).join('L')}${du.uzavrena ? 'Z' : ''}" fill="none" stroke="#777" stroke-width="${n(Math.max(0.3, 2 * du.r))}" stroke-opacity="0.6"/>`;
    }
    g += `<path d="M${n(o.xp - x0 - 3)} ${n(y1)}h6M${n(o.xp - x0)} ${n(y1 - 3)}v6" stroke="#000" stroke-width="0.2"/>`;
    const ym = H - 6;
    g += `<path d="M${n(4)} ${n(ym)}h50m-50 -2v4m50 -4v4" stroke="#000" stroke-width="0.4" fill="none"/><text x="4" y="${n(ym - 3)}" font-size="3">50 mm – ověřte pravítkem</text>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${n(W)}mm" height="${n(H)}mm" viewBox="0 0 ${n(W)} ${n(H)}" font-family="sans-serif">${g}</svg>`;
    if (tisk && (W > 281 || H > 180)) Dialog.info(`Profil měří ${fmt(W, 0)} × ${fmt(H, 0)} mm – na A4 naležato se celý nevejde.`);
    return svg;
  }
  function tiskniProfil() {
    const svg = profilSvg(true); if (!svg) { maModel(); return; }
    $('profil1').innerHTML = `<div style="font:11pt sans-serif;color:#000;margin-bottom:3mm"><b>Boční profil 1:1 – ${esc(p.nazev || 'kolíček')}</b> · ${esc(K.popis(p))}<br>`
      + 'Kříž = osa čepu / cívky. Přiložte starý kolíček nebo pružinu a ověřte rozměry; šedě drát pružiny.</div>' + svg;
    document.documentElement.classList.add('tisk-profilu');
    const konec = () => { document.documentElement.classList.remove('tisk-profilu'); window.removeEventListener('afterprint', konec); };
    window.addEventListener('afterprint', konec);
    // Safari print() neblokuje – třídu ruší až afterprint / konec tiskového média
    const mq = matchMedia('print'), naMq = e => { if (!e.matches) { konec(); mq.removeEventListener('change', naMq); } };
    mq.addEventListener('change', naMq);
    setTimeout(() => window.print(), 50);
  }

  /* ---------- nabídky, export ---------- */
  TrubkyGui.pripoj({ klic: 'webapp_kolicky_gui', pohled: j => { prepniSkicar(false); nahled.pohled(j); } });
  const seznam = $('seznamPredvoleb');
  K.PREDVOLBY.forEach((v, i) => {
    const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
    b.innerHTML = `${esc(v.nazev)}<span class="pozn">${esc(v.popis)}</span>`;
    b.addEventListener('click', () => nahrad(K.zPredvolby(i)));
    seznam.appendChild(b);
  });
  let vzhled = 'plast';
  try { vzhled = localStorage.getItem(KLIC_VZHLED) || 'plast'; } catch (e) { /* bez úložiště */ }
  if (!KOLICKY_NAHLED.VZHLEDY[vzhled]) vzhled = 'plast';
  nahled.stav.vzhled = vzhled;
  for (const [k, v] of Object.entries(KOLICKY_NAHLED.VZHLEDY)) {
    const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitemradio'); b.dataset.vzhled = k;
    b.textContent = v.nazev; b.setAttribute('aria-checked', String(k === vzhled));
    b.addEventListener('click', () => {
      document.querySelectorAll('[data-vzhled]').forEach(x => x.setAttribute('aria-checked', String(x === b)));
      nahled.prepni('vzhled', k);
      try { localStorage.setItem(KLIC_VZHLED, k); } catch (e) { /* bez úložiště */ }
    });
    $('vzhledy').appendChild(b);
  }
  const jmenoSouboru = pripona => ((p.nazev || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/^_|_$/g, '') || 'kolicek') + pripona;
  function stahni(data, nazev, typ) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type: typ }));
    a.download = nazev; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function maModel() {
    if (model) return true;
    Dialog.chyba(chybaStavby || (wasm ? 'Model nelze sestavit – viz záložka Kontrola.' : 'Geometrické jádro se ještě načítá.'));
    return false;
  }
  function exportStl(jen) {
    if (!maModel()) return;
    stahni(KRAB.stlBinarni(kusyNaPodlozku(jen), 'kolicky - github_site'), jmenoSouboru(jen ? '_' + jen + '.stl' : '.stl'), 'model/stl');
  }
  $('btnStl').addEventListener('click', () => exportStl());
  $('btn3mf').addEventListener('click', () => { if (maModel()) stahni(KRAB.soubor3mf(kusyNaPodlozku(), p.nazev || 'Kolíček'), jmenoSouboru('.3mf'), 'model/3mf'); });
  $('btnPng').addEventListener('click', async () => {
    // ze skicáře nejdřív zpět na 3D (skryté plátno nemá velikost) a počkat dva snímky
    if (!$('skicar').hidden) { prepniSkicar(false); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); }
    const u = nahled.png(); if (u) fetch(u).then(r => r.blob()).then(b => stahni(b, jmenoSouboru('.png')));
  });
  $('btnProfil').addEventListener('click', tiskniProfil);
  $('btnSvg').addEventListener('click', () => { const s = profilSvg(false); if (s) stahni(s, jmenoSouboru('_profil.svg'), 'image/svg+xml'); else maModel(); });
  /* ---------- sdílení odkazem: #k= + deflate + base64url ---------- */
  const b64 = u8 => btoa(String.fromCharCode(...u8)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const zB64 = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  async function proud(data, trida) { return new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(trida)).arrayBuffer()); }
  async function odkaz() {
    const json = new TextEncoder().encode(JSON.stringify(p));
    let kod;
    try { kod = 'z' + b64(await proud(json, new CompressionStream('deflate-raw'))); } catch (e) { kod = 'j' + b64(json); }
    const url = location.href.split('#')[0] + '#k=' + kod;
    let zkopirovano = false;
    try { await navigator.clipboard.writeText(url); zkopirovano = true; } catch (e) { /* bez schránky */ }
    if (zkopirovano) Dialog.info('Odkaz na kolíček je ve schránce – kdo ho otevře, uvidí stejný kolíček.');
    else await Dialog.zeptej('Zkopírujte odkaz na kolíček:', url);
  }
  async function zOdkazu() {
    const m = /#k=([zj])([\w-]+)/.exec(location.hash);
    if (!m) return false;
    try {
      const data = m[1] === 'z' ? await proud(zB64(m[2]), new DecompressionStream('deflate-raw')) : zB64(m[2]);
      const r = K.normalizuj(JSON.parse(new TextDecoder().decode(data)));
      const ted = JSON.stringify(p), stejny = ted === JSON.stringify(r.p) || ted === JSON.stringify(K.zPredvolby(0));
      history.replaceState(null, '', location.href.split('#')[0]);
      if (!stejny && !(await Dialog.potvrd(`Otevřít kolíček z odkazu („${r.p.nazev || 'bez názvu'}“)? Váš rozdělaný kolíček „${p.nazev || 'bez názvu'}“ se nahradí – pokud ho chcete zachovat, zrušte a uložte ho (Soubor → Moje kolíčky), pak odkaz otevřete znovu.`))) return true;
      nahrad(r.p); hlasPrevod(r.hlaseni, 'Kolíček z odkazu');
    } catch (e) { Dialog.chyba('Odkaz na kolíček je poškozený: ' + e.message); }
    history.replaceState(null, '', location.href.split('#')[0]);
    return true;
  }
  $('btnOdkaz').addEventListener('click', odkaz);
  window.addEventListener('hashchange', zOdkazu);
  $('btnUlozit').addEventListener('click', () => stahni(K.ulozProjekt(p), jmenoSouboru('.json'), 'application/json'));
  $('btnNacist').addEventListener('click', () => $('soubor').click());
  $('soubor').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try { const r = K.nactiProjekt(await f.text()); nahrad(r.p); hlasPrevod(r.hlaseni, 'Načtený projekt'); }
    catch (err) { Dialog.chyba(err.message); }
  });
  $('btnVychozi').addEventListener('click', async () => {
    if (await Dialog.potvrd('Vrátit všechny hodnoty na výchozí (první předvolba)?')) nahrad(K.zPredvolby(0));
  });
  $('btnNahodny').addEventListener('click', () => {
    const r = K.nahodnyKolicek(1 + Math.floor(Math.random() * 999998));
    nahrad(r);
    if (rozpadRaf) cancelAnimationFrame(rozpadRaf); rozpadRaf = null;
    nahled.prepni('rozpad', 0); $('f_rozpad').value = 0; $('tRozpad').setAttribute('aria-checked', 'false');
    prepniSkicar(false);
    TrubkyGui.otevriZalozku('vysledky');
  });
  $('btnZpet').addEventListener('click', () => krokHistorie(zpet, znovu));
  $('btnZnovu').addEventListener('click', () => krokHistorie(znovu, zpet));
  function prepinac(id, co) {
    const b = $(id);
    b.addEventListener('click', () => {
      const h = b.getAttribute('aria-checked') !== 'true';
      b.setAttribute('aria-checked', String(h)); nahled.prepni(co, h);
      $('legenda3d').hidden = !(model && nahled.stav.tisk && nahled.stav.previsy);
      $('legendaVolne').hidden = !(model && nahled.stav.volne && !nahled.stav.tisk);
      if (co === 'tisk' && h) animace(false);
    });
  }
  prepinac('tMeritko', 'meritko');
  prepinac('tDuchove', 'duchove'); prepinac('tHrany', 'hrany'); prepinac('tTisk', 'tisk'); prepinac('tPrevisy', 'previsy');

  /** Předpětí slovy pro legendu volné pružiny. */
  function predpetiText(o) {
    const q = { jazycek: p.jazycek.predpeti, listova: p.listova.predpeti, meandr: p.meandr.predpeti, ocka: p.ocka.predpeti, oblouk: p.oblouk.predpeti,
      dratU: p.dratU.predpeti, pasek: p.pasek.predpeti, tpu: p.tpu.predpeti }[p.pruzina];
    if (q != null) return `${fmt(q, 1)} mm`;
    if (p.pruzina === 'tlacna' && o.vinuta && !o.vinuta.chybi) return `${fmt(o.vinuta.L0 - o.vinuta.Li, 1)} mm`;
    if (o.dr.kov && o.mech) return `${fmt(o.mech.predpeti / RAD, 0)}°`;
    if (p.pruzina === 'gumicka' && o.mech.eps) return `${fmt(100 * o.mech.eps(0), 0)} %`;
    return '';
  }
  /* ---------- rozevření a animace ---------- */
  function rozevreniText() {
    const o = oPosl; if (!o) return;
    $('tRozev').textContent = `${fmt(o.mech.otevreni(nahled.stav.rozevreni * o.mech.thetaMax), 1)} mm`;
  }
  $('f_rozev').addEventListener('input', () => { animace(false); nahled.prepni('rozevreni', $('f_rozev').value / 100); rozevreniText(); });
  let animRaf = null;
  function animace(zap) {
    $('tAnimace').setAttribute('aria-checked', String(!!zap));
    if (animRaf) cancelAnimationFrame(animRaf); animRaf = null;
    if (!zap || !model || nahled.stav.tisk || !$('skicar').hidden) { $('tAnimace').setAttribute('aria-checked', 'false'); return; }
    const t0 = performance.now();
    const krok = t => {
      const u = 0.5 - 0.5 * Math.cos((t - t0) / 1400 * Math.PI);
      if (!model || nahled.stav.tisk || !$('skicar').hidden) { animace(false); return; }
      $('f_rozev').value = Math.round(u * 100); nahled.prepni('rozevreni', u); rozevreniText();
      animRaf = requestAnimationFrame(krok);
    };
    animRaf = requestAnimationFrame(krok);
  }
  $('tAnimace').addEventListener('click', () => animace($('tAnimace').getAttribute('aria-checked') !== 'true'));
  $('tVolne').addEventListener('click', () => {
    const h = $('tVolne').getAttribute('aria-checked') !== 'true';
    $('tVolne').setAttribute('aria-checked', String(h)); nahled.prepni('volne', h);
    $('legendaVolne').hidden = !(model && h && !nahled.stav.tisk);
  });
  // rozpad na díly: posuvník a plynulé přepnutí klávesou R / v nabídce
  let rozpadRaf = null;
  function rozpad(cil) {
    if (rozpadRaf) cancelAnimationFrame(rozpadRaf);
    const od = nahled.stav.rozpad, t0 = performance.now();
    const krok = t => {
      const u = Math.min(1, (t - t0) / 500), v = od + (cil - od) * (0.5 - 0.5 * Math.cos(Math.PI * u));
      nahled.prepni('rozpad', v); $('f_rozpad').value = Math.round(v * 100);
      $('tRozpad').setAttribute('aria-checked', String(cil > 0));
      rozpadRaf = u < 1 ? requestAnimationFrame(krok) : null;
    };
    rozpadRaf = requestAnimationFrame(krok);
  }
  $('f_rozpad').addEventListener('input', () => { if (rozpadRaf) cancelAnimationFrame(rozpadRaf); const v = $('f_rozpad').value / 100; nahled.prepni('rozpad', v); $('tRozpad').setAttribute('aria-checked', String(v > 0)); });
  $('tRozpad').addEventListener('click', () => rozpad(nahled.stav.rozpad > 0.5 ? 0 : 1));

  /* ---------- skicář ---------- */
  const skicar = KOLICKY_SKICAR.vytvor({
    platno: $('skicarPlatno'),
    info: t => { $('skPozice').textContent = t; },
    stav: () => ({ p, o: model ? model.o : oPosl, rezy: model ? model.rezy : null, duchove: model ? model.duchove : null }),
    naZmenu: (sk, slouceni) => { zmen(x => { x.skica = sk; }, slouceni); naplnFormular(); },
    naPodklad: () => {
      const pr = skicar && skicar.podklad.hodnota('pruhlednost'), u = skicar && skicar.podklad.hodnota('uhel');
      if (pr != null) $('skPruhl').value = pr;
      if (u != null) $('skUhel').value = fmt(u, 1);
      viditelnost();
    },
  });
  function prepniSkicar(zap) {
    $('skicar').hidden = !zap; $('canvas-container').hidden = zap;
    $('vSkicar').setAttribute('aria-pressed', String(zap)); $('vNahled3d').setAttribute('aria-pressed', String(!zap));
    $('f_rozev').closest('label').hidden = zap; $('f_rozpad').closest('label').hidden = zap;
    document.querySelector('.stred').classList.toggle('skicar-aktivni', zap);
    skicar.aktivuj(zap);
    if (zap) animace(false);
    if (zap) { TrubkyGui.ukazBox('obecne'); requestAnimationFrame(() => skicar.prizpusob()); }
    else nahled.prekresli();
    viditelnost();
  }
  $('vSkicar').addEventListener('click', () => prepniSkicar(true));
  $('vNahled3d').addEventListener('click', () => prepniSkicar(false));
  $('btnSkicar').addEventListener('click', () => prepniSkicar($('skicar').hidden));
  $('btnDoSkicare').addEventListener('click', () => prepniSkicar(true));
  document.querySelectorAll('[data-nastroj]').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('[data-nastroj]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    skicar.nastroj(b.dataset.nastroj);
  }));
  const prevezmi = async () => {
    if (p.skica.zapnuta && p.skica.horni.length && !(await Dialog.potvrd('Přepsat skicu obrysem z parametrů?'))) return;
    skicar.prevezmi(); naplnFormular(); requestAnimationFrame(() => skicar.prizpusob());
  };
  $('skPrevzit').addEventListener('click', prevezmi);
  $('skVyzvaBtn').addEventListener('click', prevezmi);
  $('skSmazBod').addEventListener('click', () => skicar.smazVybrany());
  $('skPrizpusob').addEventListener('click', () => skicar.prizpusob());
  $('skPrichytit').addEventListener('change', e => skicar.prichytit(e.target.checked));
  $('skUpravuji').addEventListener('change', e => skicar.upravuj(e.target.value));
  $('skVlozit').addEventListener('click', () => $('souborPodklad').click());
  $('souborPodklad').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    await skicar.vlozPodklad(f); viditelnost();
    document.querySelector('[data-nastroj="kalibrace"]').click();
    Dialog.info('Fotka vložena. Klikněte na dva body se známou vzdáleností (např. konce kolíčku) a zadejte ji v mm. Nástrojem 🖼 Podklad fotku posunete, Alt + kolečko ji otočí.');
  });
  $('skPruhl').addEventListener('input', e => skicar.podklad.nastav('pruhlednost', +e.target.value));
  $('skUhel').addEventListener('change', e => { const u = K.cislo(e.target.value, 0); e.target.value = fmt(u, 1); skicar.podklad.nastav('uhel', u); });
  $('skSmazPodklad').addEventListener('click', async () => { if (await Dialog.potvrd('Odstranit podklad (fotku)?')) { await skicar.podklad.smaz(); viditelnost(); } });

  $('stavOdznak').addEventListener('click', () => TrubkyGui.otevriZalozku('kontrola'));
  $('btnZavritNap').addEventListener('click', () => $('napoveda').close());
  document.addEventListener('keydown', e => {
    if (document.querySelector('dialog[open]') && e.key !== 'F1') return;   // pod dialogem zkratky nejdou
    const a = document.activeElement;
    const vPoli = a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || (a.tagName === 'INPUT' && !/checkbox|range|radio|button/.test(a.type));
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && !vPoli && k === 'z') { e.preventDefault(); krokHistorie(e.shiftKey ? znovu : zpet, e.shiftKey ? zpet : znovu); return; }
    if ((e.ctrlKey || e.metaKey) && !vPoli && k === 'y') { e.preventDefault(); krokHistorie(znovu, zpet); return; }
    if ((e.ctrlKey || e.metaKey) && k === 's') { e.preventDefault(); exportStl(); return; }
    if (e.key === 'F1') { e.preventDefault(); $('napoveda').showModal(); return; }
    if (vPoli || e.ctrlKey || e.metaKey || e.altKey || $('napoveda').open || a === $('skicarPlatno')) return;
    const c = e.code ? e.code.replace('Digit', '').replace('Numpad', '') : '';
    const pohl = { 1: 'iso', 2: 'zboku', 3: 'shora', 4: 'zepredu' }[c] || { 1: 'iso', 2: 'zboku', 3: 'shora', 4: 'zepredu' }[k];
    if (pohl) { prepniSkicar(false); nahled.pohled(pohl); }
    else if (k === 'k') prepniSkicar($('skicar').hidden);
    else if (k === 'a') $('tAnimace').click();
    else if (k === 'p') $('tVolne').click();
    else if (k === 'l') $('tMeritko').click();
    else if (k === 'n') $('btnNahodny').click();
    else if (k === 'r') $('tRozpad').click();
    else if (k === 'm') $('tTisk').click(); else if (k === 'd') $('tDuchove').click(); else if (k === 'v') $('tPrevisy').click(); else if (k === 'h') $('tHrany').click();
  });
  new MutationObserver(() => naplanuj()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  if (typeof Tvary !== 'undefined') Tvary.pripoj({
    klic: 'webapp_kolicky_tvary', typ: 'kolicky', nazev: 'Kolíčky', kontejner: $('tvary'),
    parametry: () => K.kopie(p),
    pouzij: q => { const n = K.normalizuj(q); hlasPrevod(n.hlaseni, 'Uložený kolíček'); nahrad(n.p); },
    popis: q => `${q.nazev || 'Kolíček'} – ${K.popis(K.normalizuj(q).p)}`,
  });

  /* ---------- start ---------- */
  p = nactiUlozeny();
  try { naplnFormular(); prepocitej(); } catch (e) {
    console.error(e);
    p = K.zPredvolby(0); naplnFormular(); prepocitej();
    setTimeout(() => Dialog.info('Uložený projekt nešel načíst (' + e.message + ') – otevřel se výchozí kolíček.'), 300);
  }
  if (!KOLICKY_NAHLED || !$('platno').querySelector('canvas')) { bezWebgl = true; $('stav3d').textContent = TXT_BEZ_WEBGL; }
  zOdkazu();
  nactiManifold().then(w => { wasm = w; $('stav3d').textContent = bezWebgl ? TXT_BEZ_WEBGL : ''; prepocitej(); }).catch(e => {
    chybaJadra = chybaStavby = 'Geometrické jádro (manifold-3d) se nenačetlo: ' + (e && e.message || e) + ' – model ani export nejsou k dispozici.';
    const st = $('stav3d'); st.textContent = chybaStavby; st.classList.add('chyba');
    const o = K.odvozene(p); vypis(K.kontroly(p, o).concat([{ uroven: 'chyba', text: chybaStavby, pole: [] }]), o, null);
  });
  window.KOLICKY_UI = { get p() { return p; }, get model() { return model; }, nahled, skicar, zmen, naplnFormular, prepocitej, nahrad, prepniSkicar, profilSvg };
})();

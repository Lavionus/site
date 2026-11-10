/* Knob – ovládání stránky: formulář, historie, manifold, přepočet, skica, výkres, kontroly, export. */
/* global KNOB, KNOB_GEOM, KLIKY, KLIKY_NAHLED, EDITOR_PROFILU, KRAB, Dialog, Tvary, TrubkyGui */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const N = KNOB, K = KLIKY, fmt = N.fmt;
  const KLIC = 'webapp_knob_projekt', KLIC_VZHLED = 'webapp_knob_vzhled';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  window.addEventListener('error', e => {
    const st = $('stav3d'); if (!st) return;
    st.textContent = `Chyba skriptu: ${e.message} (${String(e.filename || '').split('/').slice(-2).join('/')}:${e.lineno}) – zkuste Ctrl+Shift+R.`;
    st.classList.add('chyba');
  });

  /* ---------- stav a historie ---------- */
  let p, wasm = null, model = null, chybaStavby = null, chybaJadra = null, posledniO = null, edHlava = null, edKrcek = null;
  const zpet = [], znovu = [];
  function hlasPrevod(hl, co) { if (hl && hl.length) setTimeout(() => Dialog.info(`${co} upraven: ${hl.join('; ')}.`), 300); }
  function nactiUlozeny() {
    try { const t = localStorage.getItem(KLIC); if (t) { const r = N.normalizuj(JSON.parse(t)); hlasPrevod(r.hlaseni, 'Uložený projekt'); return r.p; } } catch (e) { /* poškozený záznam */ }
    return N.zPredvolby(0);
  }
  function uloz() { try { localStorage.setItem(KLIC, JSON.stringify(p)); } catch (e) { /* plné úložiště */ } }
  function zmen(fn, slouceni) {
    const pred = JSON.stringify(p);
    fn(p);
    p = N.normalizuj(p).p;
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
    p = N.normalizuj(JSON.parse(z.pop().stav)).p;
    naplnFormular(); po();
  }
  function po() { $('btnZpet').disabled = !zpet.length; $('btnZnovu').disabled = !znovu.length; uloz(); viditelnost(); naplanuj(); }
  function nahrad(q) { zmen(x => { Object.keys(x).forEach(k => delete x[k]); Object.assign(x, q); }); naplnFormular(); }

  /* ---------- formulář ---------- */
  const opt = (sel, obj, f) => { $(sel).innerHTML = Object.entries(obj).map(([k, v]) => `<option value="${k}">${esc(f(k, v))}</option>`).join(''); };
  opt('f_otyp', N.ZAPUSTENI, (k, v) => v.nazev);
  opt('f_uch', N.UCHYCENI, (k, v) => v);
  opt('f_sv', K.STAVECI, (k, v) => (v ? `${k} (imbus ${fmt(v.klic, 1)})` : 'vlastní průměr'));
  opt('f_npud', K.PUDORYSY, (k, v) => v);
  opt('f_mat', N.MATERIALY, (k, v) => `${v.nazev} – ${fmt(v.hustota, 2)} g/cm³`);
  $('f_hridel').innerHTML = '<option value="">– vyberte –</option>' + N.ROZMERY_ZAPUSTENI.map((r, i) => `<option value="${i}">${esc(r.nazev)}</option>`).join('');
  $('f_hridel').addEventListener('change', e => {
    const r = N.ROZMERY_ZAPUSTENI[e.target.value]; if (!r) return;
    zmen(x => { x.otvor.typ = r.typ; x.otvor.rozmer = r.rozmer; if (r.ploska) x.otvor.ploska = r.ploska; });
    naplnFormular(); e.target.value = '';
  });
  const segment = (id, obj, cesta) => {
    $(id).innerHTML = Object.entries(obj).map(([k, v]) => `<button type="button" data-seg="${cesta}" data-hodnota="${k}"><span aria-hidden="true">${v.znak || ''}</span>${esc(v.nazev)}</button>`).join('');
  };
  segment('segHlava', K.TVARY_KNOBU, 'knob.tvar');
  segment('segKrcek', K.TVARY_KRCKU, 'krcek.tvar');
  document.querySelectorAll('[data-seg]').forEach(b => b.addEventListener('click', () => { zmen(x => K.poloz(x, b.dataset.seg, b.dataset.hodnota)); naplnFormular(); }));

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
      else { h = K.cislo(el.value, NaN); el.classList.toggle('spatne', !Number.isFinite(h)); if (!Number.isFinite(h)) return; }
      zmen(x => {
        K.poloz(x, c, h);
        if (c === 'sroub.prumer') { const v = K.STAVECI[x.sroub.velikost]; if (v && Math.abs(v.d - h) > 1e-9) x.sroub.velikost = 'vlastni'; }
        if (c === 'sroub.uchyceni' && h === 'vrut' && x.sroub.velikost !== 'vlastni') { x.sroub.velikost = 'vlastni'; x.sroub.prumer = 3.5; }   // běžný vrut 3,5 mm
      }, c);
      if (['sroub.velikost', 'sroub.prumer', 'sroub.uchyceni'].includes(c)) naplnFormular();
    };
    el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', akce);
    if (el.tagName === 'INPUT' && el.type === 'text' && el.dataset.typ !== 'text') {
      el.addEventListener('change', () => {
        const psano = K.cislo(el.value, NaN), h = K.vezmi(p, el.dataset.p), roz = N.ROZSAHY[el.dataset.p];
        el.value = String(h).replace('.', ',');
        if (roz && Number.isFinite(psano) && Math.abs(psano - h) > 1e-9) Dialog.info(`${el.labels[0] ? el.labels[0].textContent.trim() : 'Hodnota'}: omezeno na ${fmt(roz[0], 2)}–${fmt(roz[1], 2)}, použito ${fmt(h, 2)}.`);
      });
      el.addEventListener('keydown', e => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        const h = K.cislo(el.value, NaN); if (!Number.isFinite(h)) return;
        e.preventDefault();
        el.value = fmt(Math.round((h + (e.shiftKey ? 10 : e.altKey ? 0.1 : 1) * (e.key === 'ArrowUp' ? 1 : -1)) * 1000) / 1000, 3);
        el.dispatchEvent(new Event('input'));
      });
    }
  }
  function viditelnost() {
    for (const el of document.querySelectorAll('[data-knobtvar]')) el.hidden = el.dataset.knobtvar !== p.knob.tvar;
    for (const el of document.querySelectorAll('[data-pudorys]')) el.hidden = !el.dataset.pudorys.split(' ').includes(p.knob.pudorys);
    for (const el of document.querySelectorAll('[data-krcektvar]')) el.hidden = el.dataset.krcektvar !== p.krcek.tvar;
    for (const el of document.querySelectorAll('[data-otyp]')) el.hidden = el.dataset.otyp !== p.otvor.typ;
    for (const el of document.querySelectorAll('[data-sroub]')) el.hidden = p.sroub.uchyceni === 'zadne';
    for (const el of document.querySelectorAll('[data-zahl]')) el.hidden = !el.dataset.zahl.split(' ').includes(p.sroub.uchyceni);
    for (const el of document.querySelectorAll('[data-knobnevlastni]')) el.hidden = p.knob.tvar === 'vlastni';
    $('oddilSkica').hidden = p.knob.tvar !== 'vlastni';
    document.querySelectorAll('[data-seg]').forEach(b => b.setAttribute('aria-pressed', String(K.vezmi(p, b.dataset.seg) === b.dataset.hodnota)));
    $('lOroz').textContent = N.ZAPUSTENI[p.otvor.typ].popisRozmeru;
    $('lPocet').textContent = p.knob.pudorys === 'hrany' ? 'Počet faset' : 'Počet rýh';
  }

  /* ---------- manifold ---------- */
  function nactiSkript(src) { return new Promise((ok, ko) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => ko(new Error('nenačteno ' + src)); document.head.appendChild(s); }); }
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
    const w = await globalThis.ManifoldModule(volby); w.setup(); return w;
  }

  /* ---------- přepočet ---------- */
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const nahled = KLIKY_NAHLED.vytvorNahled($('platno'));
  $('platno').querySelector('canvas').setAttribute('aria-label', '3D náhled knobu – tažením otáčíte, kolečkem přibližujete, pravým tlačítkem posouváte');
  let casovac = null;
  function naplanuj() { clearTimeout(casovac); casovac = setTimeout(prepocitej, 40); }
  /** Pro náhled „na stojato“: náhled kliky otáčí souřadnice dveří (x, −z, y), tak mu dáme (x, z, −y). */
  const nastojato = poz => { const o = new Float32Array(poz.length); for (let i = 0; i < poz.length; i += 3) { o[i] = poz[i]; o[i + 1] = poz[i + 2]; o[i + 2] = -poz[i + 1]; } return o; };
  function prepocitej() {
    nahled.barvy(css('--border-strong'), css('--border'), css('--text'));
    const o = N.odvozene(p); posledniO = o;
    let H = N.kontroly(p, o);
    if (chybaJadra) H.push({ uroven: 'chyba', text: chybaJadra, pole: [] });
    model = null; chybaStavby = chybaJadra;   // nenačtené jádro zůstává chybou i po dalších úpravách
    if (wasm) {
      try {
        const t0 = performance.now(), sit = KNOB_GEOM.postav(wasm, p, o), rozbor = N.rozborTisku(sit, p, o);
        model = Object.assign(sit, { o, rozbor, ks: KRAB.kontrolaSite(rozbor.vybrana.poz, sit.idx), cas: performance.now() - t0 });
        if (!model.ks.uzavrena) H.push({ uroven: 'chyba', text: 'Síť není uzavřená – export by nemusel jít vytisknout.', pole: [] });
        const v = rozbor.vybrana;
        if (SPOJKY.potrebujePodpory(v, sit.plocha)) H.push({ uroven: 'varovani', text: `V orientaci „${v.nazev}“ visí ${fmt(v.volne, 0)} mm² povrchu bez opory – tiskněte s podporami, nebo zapněte podřez pod hlavou.`, pole: ['knob.podrez', 'tisk.orientace'] });
      } catch (e) { chybaStavby = 'Těleso nejde sestavit: ' + (e && e.message || e); H.push({ uroven: 'chyba', text: chybaStavby, pole: [] }); model = null; }
    }
    const st = $('stav3d'); st.textContent = chybaStavby || (wasm ? '' : 'Načítám geometrické jádro…'); st.classList.toggle('chyba', !!chybaStavby);
    nahled.nastav(model ? { klic: 'knob', montaz: [{ poz: nastojato(model.poz), idx: model.idx, role: 'hlavni' }],
      tisk: [{ poz: model.rozbor.vybrana.poz, idx: model.idx, tridy: model.rozbor.vybrana.tridy, role: 'hlavni' }], duchove: [] } : null);
    vypis(H, o, model);
  }

  /* ---------- výpisy ---------- */
  const dl = (popis, cislo, dalsi = '', tr = '') => `<div class="dlazdice"><div class="popis">${popis}</div><div class="cislo ${tr}">${cislo}</div>${dalsi ? `<div class="dalsi">${dalsi}</div>` : ''}</div>`;
  const cas = m => (m < 90 ? fmt(m, 0) + ' min' : fmt(m / 60, 1) + ' h');
  function vypis(H, o, m) {
    const mat = N.MATERIALY[p.tisk.material], q = p.knob;
    let v = dl('Knob', `Ø ${fmt(2 * o.rMax)} × ${fmt(o.vyska)} mm`, `hlava ${fmt(q.hlava)}, krček ${fmt(p.krcek.delka)}, odsazení ${fmt(o.maOdsazeni ? p.odsazeni.vyska : 0)} mm`);
    v += dl('Krček', `Ø ${fmt(q.krcek)} × ${fmt(p.krcek.delka)} mm`, `${o.krcekF.popis}; pata Ø ${fmt(2 * o.prof.podstava, 1)} mm`);
    v += dl('Odsazení', o.maOdsazeni ? `Ø ${fmt(p.odsazeni.prumer)} × ${fmt(p.odsazeni.vyska)} mm` : 'bez odsazení', o.maOdsazeni ? (o.rO > o.prof.podstava ? 'límec (širší než krček)' : 'čep (užší než krček)') : '');
    v += dl('Zapuštění', o.hloubkaDiry ? `${N.ZAPUSTENI[p.otvor.typ].nazev} ${fmt(p.otvor.rozmer, 2)} × ${fmt(o.hloubkaDiry)} mm` : 'bez otvoru',
      o.hloubkaDiry ? `stěna nejméně ${fmt(o.stena)} mm` : '', o.stena < 1.2 ? 'chyba-t' : o.stena < 2.5 ? 'mez-t' : '');
    if (p.sroub.uchyceni !== 'zadne') v += dl('Jisticí šroubek', `${K.jmenoSroubu(p)}, ${fmt(o.zs)} mm od spodku`, `${fmt(p.sroub.odsazeni)} mm od začátku krčku; ${N.UCHYCENI[p.sroub.uchyceni]}`);
    const pv = N.pevnost(p, o);
    if (pv) v += dl('Otlačení zapuštění', `× ${fmt(pv.k, 1)}`, `moment ${fmt(p.pevnost.moment, 1)} N·m: ${fmt(pv.tlak, 1)} MPa`, pv.k >= 2 ? 'ok-t' : pv.k >= 1.2 ? 'mez-t' : 'chyba-t');
    if (m) {
      const b = m.ks.bbox, odh = N.odhadTisku(m.objem, m.plocha, b[5] - b[2], p);
      v += dl('Hmotnost', `≈ ${fmt(odh.gramy, 0)} g`, `${mat.nazev}, výplň ${fmt(p.tisk.vypln, 0)} %, ${fmt(odh.metru, 1)} m filamentu`);
      v += dl('Doba tisku', `≈ ${cas(odh.minut)}`, 'hrubý odhad (vrstva 0,2 mm)');
      v += dl('Orientace', m.rozbor.vybrana.nazev, SPOJKY.potrebujePodpory(m.rozbor.vybrana, m.plocha) ? 's podporami' : 'bez podpor', SPOJKY.potrebujePodpory(m.rozbor.vybrana, m.plocha) ? 'mez-t' : 'ok-t');
      $('sVysledky').textContent = `≈ ${fmt(odh.gramy, 0)} g`;
      $('karta3d').innerHTML = `<div class="titul">Knob</div><b>${esc(N.popis(p))}</b><br><b>${fmt(odh.gramy, 0)}</b> g ${mat.nazev}`;
    } else { v += dl('Model', wasm ? 'nesestaven' : chybaJadra ? 'nedostupný' : 'načítám…', chybaStavby || ''); $('karta3d').innerHTML = ''; }
    $('vVysledky').innerHTML = v;
    // tisk
    $('tabOrientace').innerHTML = m ? '<tr><th>Poloha</th><th class="c">Bez opory</th><th class="c">Mosty</th><th class="c">Podložka</th><th class="c">Výška</th></tr>'
      + m.rozbor.kandidati.map(k => `<tr class="klik${k === m.rozbor.vybrana ? ' vybrana' : ''}" data-klic="${k.klic}" tabindex="0"><td>${k === m.rozbor.nejlepsi ? '★ ' : ''}${esc(k.nazev)}</td><td class="c">${fmt(k.volne, 0)} mm²</td><td class="c">${fmt(k.most, 0)} mm²</td><td class="c">${fmt(k.podlozka, 0)} mm²</td><td class="c">${fmt(k.vyska)} mm</td></tr>`).join('') : '';
    $('sTisk').textContent = m ? (SPOJKY.potrebujePodpory(m.rozbor.vybrana, m.plocha) ? 's podporami' : 'bez podpor') : '';
    $('pMaterial').textContent = mat.pozn;
    // kusovník
    const kus = N.kusovnik(p, o);
    $('tabKusovnik').innerHTML = '<tr><th class="c">Ks</th><th>Položka</th><th>Poznámka</th></tr><tr><td class="c">1</td><td>Tištěný knob</td><td></td></tr>'
      + kus.map(x => `<tr><td class="c">${x.ks}</td><td class="${x.chyba ? 'chyba-t' : ''}">${esc(x.co)}</td><td>${esc(x.pozn || '')}</td></tr>`).join('');
    $('vSit').innerHTML = m ? dl('Síť', m.ks.uzavrena ? '✔ uzavřená' : '✖ otevřená', `${m.ks.trojuhelniku} trojúhelníků, ${m.ks.teles} těleso, ${fmt(m.cas, 0)} ms`, m.ks.uzavrena ? 'ok-t' : 'chyba-t') : '';
    $('legenda3d').hidden = !(m && nahled.stav.tisk && nahled.stav.previsy);
    // souhrny a popisky
    TrubkyGui.souhrn('sOtvor', o.hloubkaDiry ? `${N.ZAPUSTENI[p.otvor.typ].nazev} ${fmt(p.otvor.rozmer, 2)} × ${fmt(o.hloubkaDiry)}` : 'bez otvoru');
    TrubkyGui.souhrn('sSroub', p.sroub.uchyceni === 'zadne' ? 'bez šroubku' : `${K.jmenoSroubu(p)}, ${fmt(p.sroub.odsazeni)} mm od krčku`);
    TrubkyGui.souhrn('sHlava', `${q.tvar === 'generator' ? `🎲 ${q.seminko}` : K.TVARY_KNOBU[q.tvar].nazev}, Ø ${fmt(q.prumer)}`);
    TrubkyGui.souhrn('sKrcek', `Ø ${fmt(q.krcek)} × ${fmt(p.krcek.delka)}, ${K.TVARY_KRCKU[p.krcek.tvar].nazev.toLowerCase()}`);
    TrubkyGui.souhrn('sOdsazeni', o.maOdsazeni ? `Ø ${fmt(p.odsazeni.prumer)} × ${fmt(p.odsazeni.vyska)}` : 'bez');
    $('pGenerator').textContent = q.tvar === 'generator' ? `Tvar č. ${q.seminko}: ${K.tvarZeSeminka(q.seminko).popis}. Stejné semínko dá vždy stejný tvar.` : '';
    nahledProfilu(o); vykres(o);
    if (edHlava && !$('oddilSkica').hidden && !edHlava.tahne()) { edHlava.kresli(); TrubkyGui.souhrn('sSkica', `${q.vlastni.body.length} bodů`); }
    if (edKrcek && p.krcek.tvar === 'vlastni' && !edKrcek.tahne()) edKrcek.kresli();
    // hlášení
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
        b.addEventListener('click', () => { zmen(q2 => K.poloz(q2, x.oprava.pole, x.oprava.hodnota)); naplnFormular(); });
        li.appendChild(b);
      }
      ul.appendChild(li);
    }
    const nch = H.filter(x => x.uroven === 'chyba').length, nv = H.filter(x => x.uroven === 'varovani').length, od = $('stavOdznak');
    od.className = 'odznak ' + (nch ? 'chyba' : nv ? 'mez' : 'ok');
    od.textContent = nch ? `✖ ${nch}` : nv ? `⚠ ${nv}` : '✔';
    $('sKontrola').textContent = nch ? `${nch} ${nch === 1 ? 'chyba' : nch < 5 ? 'chyby' : 'chyb'}` : nv ? `${nv} varování` : 'v pořádku';
    const boxy = { boxZapusteni: false, boxTvar: false };
    for (const x of H) if (x.uroven === 'chyba') for (const c of x.pole) { const el = document.querySelector(`[data-p="${c}"]`) || document.querySelector(`[data-seg="${c}"]`), bx = el && el.closest('[data-box]'); if (bx && bx.id in boxy) boxy[bx.id] = true; }
    for (const [id, a] of Object.entries(boxy)) TrubkyGui.oznacChybu(id, a);
  }
  function jdiNaPole(cesta) {
    const najdi = sel => [...document.querySelectorAll(sel)].find(e => !e.closest('[hidden]')) || document.querySelector(sel);
    const el = najdi(`[data-p="${cesta}"]`) || najdi(`[data-seg="${cesta}"]`);   // tvary se vybírají segmentovými tlačítky
    if (!el) return;
    const det = el.closest('details'); if (det) det.open = true;
    const tel = el.closest('.zalozka-telo'); if (tel) TrubkyGui.otevriZalozku(tel.dataset.telo);
    const bx = el.closest('[data-box]'); TrubkyGui.ukazBox(bx ? bx.dataset.box : 'obecne');
    el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.focus({ preventScroll: true });
  }
  $('tabOrientace').addEventListener('click', e => { const tr = e.target.closest('tr[data-klic]'); if (tr) { zmen(x => { x.tisk.orientace = tr.dataset.klic; }); naplnFormular(); } });
  $('tabOrientace').addEventListener('keydown', e => { if (e.key === 'Enter') e.target.click(); });

  /* ---------- náhled profilu a výkres ---------- */
  const n = v => (+v).toFixed(2);
  /** Obrys tělesa (r, z) od spodu k vrcholu včetně odsazení – pro 2D pohledy. */
  function obrys(o) {
    const out = [];
    if (o.maOdsazeni) { out.push([o.rO, 0], [o.rO, p.odsazeni.vyska]); }
    for (const b of o.prof.body) out.push(b);
    return out;
  }
  function nahledProfilu(o) {
    const ob = obrys(o), R = Math.max(...ob.map(b => b[0])), H = o.vyska, q = p.knob;
    const bok = [[0, 0]].concat(ob, ob.slice().reverse().map(([r, z]) => [-r, z]));
    const d1 = 'M' + bok.map(([r, z]) => `${n(r)} ${n(H - z)}`).join('L') + 'Z';
    const pud = []; for (let i = 0; i < 144; i++) { const f = 2 * Math.PI * i / 144, rr = q.prumer / 2 * K.pudorysKnobu(q, f, 1); pud.push([rr * Math.cos(f), rr * Math.sin(f)]); }
    const d2 = 'M' + pud.map(([x, y]) => `${n(x)} ${n(y)}`).join('L') + 'Z';
    const P = q.prumer / 2 + 3;
    $('profilSvg').innerHTML = `<figure><figcaption>Zboku</figcaption><svg viewBox="${n(-R - 3)} -3 ${n(2 * R + 6)} ${n(H + 6)}"><path class="tvar" d="${d1}"/></svg></figure>`
      + `<div class="rezy"><figure><figcaption>Půdorys hlavy</figcaption><svg viewBox="${n(-P)} ${n(-P)} ${n(2 * P)} ${n(2 * P)}"><path class="tvar" d="${d2}"/></svg></figure></div>`;
  }
  /** Výkres: vlevo pohled, vpravo řez osou s otvory, kóty od spodní plochy. */
  function vykres(o) {
    const ob = obrys(o), R = Math.max(...ob.map(b => b[0])), H = o.vyska, y = z => H - z;
    const levy = 'M0 ' + n(y(0)) + ob.map(([r, z]) => `L${n(-r)} ${n(y(z))}`).join('') + `L0 ${n(y(H))}Z`;
    const pravy = 'M0 ' + n(y(0)) + ob.map(([r, z]) => `L${n(r)} ${n(y(z))}`).join('') + `L0 ${n(y(H))}Z`;
    let g = `<path class="tvar" d="${levy}"/><path class="rez" d="${pravy}"/>`;
    // zapuštění a šroubek v řezu (pravá polovina)
    if (o.hloubkaDiry > 0) { const a = Math.max(...o.otvor.obrys.map(b => b[0])); g += `<rect class="dira" x="0" y="${n(y(o.zDiry1))}" width="${n(a)}" height="${n(o.zDiry1)}"/>`; }
    if (o.zs !== undefined) { const r = Math.max(o.staveci.d / 2, o.samorez ? o.samorez.predvrt / 2 : 0, o.vrut ? o.vrut.predvrt / 2 : 0); g += `<rect class="dira" x="${n(o.otvor.kSroubu)}" y="${n(y(o.zs) - r)}" width="${n(o.ven - o.otvor.kSroubu)}" height="${n(2 * r)}"/>`; }
    g += `<line class="osa" x1="0" x2="0" y1="${n(-4)}" y2="${n(H + 4)}"/>`;
    // kóty vpravo (výšky od spodku)
    const xk = R + 6, kota = (z, text, x) => { g += `<path class="kota" d="M${n(x - 2)} ${n(y(z))}H${n(x + 1)}"/><text x="${n(x + 2)}" y="${n(y(z) + 0.9)}">${esc(text)}</text>`; };
    g += `<path class="kota" d="M${n(xk)} ${n(y(0))}V${n(y(H))}"/>`;
    kota(0, '0', xk); kota(H, `${fmt(H)} vrchol`, xk);
    if (o.maOdsazeni) kota(p.odsazeni.vyska, `${fmt(p.odsazeni.vyska)} odsazení`, xk);
    kota(o.zHlavy, `${fmt(o.zHlavy)} hlava`, xk);
    if (o.hloubkaDiry > 0) kota(o.zDiry1, `${fmt(o.zDiry1)} zapuštění`, xk + 18);
    if (o.zs !== undefined) kota(o.zs, `${fmt(o.zs)} šroubek`, xk + 18);
    // průměry dole
    g += `<text x="${n(-R)}" y="${n(H + 5)}">hlava Ø ${fmt(p.knob.prumer)} · krček Ø ${fmt(p.knob.krcek)}${o.maOdsazeni ? ` · odsazení Ø ${fmt(p.odsazeni.prumer)}` : ''}</text>`;
    $('vykres').innerHTML = `<svg viewBox="${n(-R - 4)} -4 ${n(2 * R + 50)} ${n(H + 12)}" role="img" aria-label="Výkres knobu">${g}</svg>`;
  }

  /* ---------- nabídky, export ---------- */
  TrubkyGui.pripoj({ klic: 'webapp_knob_gui', pohled: j => nahled.pohled(j) });
  N.PREDVOLBY.forEach((v, i) => {
    const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
    b.innerHTML = `${esc(v.nazev)}<span class="pozn">${esc(v.popis)}</span>`;
    b.addEventListener('click', () => nahrad(N.zPredvolby(i)));
    $('seznamPredvoleb').appendChild(b);
  });
  let vzhled = 'plast';
  try { vzhled = localStorage.getItem(KLIC_VZHLED) || 'plast'; } catch (e) { /* bez úložiště */ }
  if (!KLIKY_NAHLED.VZHLEDY[vzhled]) vzhled = 'plast';
  nahled.stav.vzhled = vzhled; nahled.stav.duchove = false;
  for (const [k, v] of Object.entries(KLIKY_NAHLED.VZHLEDY)) {
    const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitemradio'); b.dataset.vzhled = k;
    b.textContent = v.nazev; b.setAttribute('aria-checked', String(k === vzhled));
    b.addEventListener('click', () => {
      document.querySelectorAll('[data-vzhled]').forEach(x => x.setAttribute('aria-checked', String(x === b)));
      nahled.prepni('vzhled', k);
      try { localStorage.setItem(KLIC_VZHLED, k); } catch (e) { /* bez úložiště */ }
    });
    $('vzhledy').appendChild(b);
  }
  const jmenoSouboru = pripona => ((p.nazev || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/^_|_$/g, '') || 'knob') + pripona;
  function stahni(data, nazev, typ) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type: typ }));
    a.download = nazev; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function dil() {
    if (!model) { Dialog.chyba(chybaStavby || (wasm ? 'Model nelze sestavit – viz záložka Kontrola.' : 'Geometrické jádro se ještě načítá.')); return null; }
    return [{ jmeno: 'knob', nazev: p.nazev || 'Knob', poz: model.rozbor.vybrana.poz, idx: model.idx, barva: '#3F7BD6' }];
  }
  function exportStl() { const d = dil(); if (d) stahni(KRAB.stlBinarni(d, 'knob - github_site'), jmenoSouboru('.stl'), 'model/stl'); }
  $('btnStl').addEventListener('click', exportStl);
  $('btn3mf').addEventListener('click', () => { const d = dil(); if (d) stahni(KRAB.soubor3mf(d, p.nazev || 'Knob'), jmenoSouboru('.3mf'), 'model/3mf'); });
  $('btnPng').addEventListener('click', () => { fetch(nahled.png()).then(r => r.blob()).then(b => stahni(b, jmenoSouboru('.png'))); });
  $('btnUlozit').addEventListener('click', () => stahni(N.ulozProjekt(p), jmenoSouboru('.json'), 'application/json'));
  $('btnNacist').addEventListener('click', () => $('soubor').click());
  $('soubor').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try { const r = N.nactiProjekt(await f.text()); nahrad(r.p); hlasPrevod(r.hlaseni, 'Načtený projekt'); } catch (err) { Dialog.chyba(err.message); }
  });
  $('btnVychozi').addEventListener('click', async () => { if (await Dialog.potvrd('Vrátit všechny hodnoty na výchozí (první předvolba)?')) nahrad(N.zPredvolby(0)); });
  $('btnZpet').addEventListener('click', () => krokHistorie(zpet, znovu));
  $('btnZnovu').addEventListener('click', () => krokHistorie(znovu, zpet));
  $('btnNahodny').addEventListener('click', () => {
    const q = N.nahodnyKnob(p);
    if (!p.nazev || /^Knob/.test(p.nazev)) q.nazev = `Knob ${N.popis(q).split(',')[0]}`;   // vlastní název nechat
    nahrad(q);
  });
  $('btnKostka').addEventListener('click', () => { zmen(x => { x.knob.seminko = 1 + Math.floor(Math.random() * 999998); }); naplnFormular(); });
  $('btnKostkaKrcek').addEventListener('click', () => { zmen(x => { x.krcek.seminko = 1 + Math.floor(Math.random() * 999998); }); naplnFormular(); });
  $('btnDoSkicy').addEventListener('click', () => { zmen(x => { x.knob.vlastni = K.vlastniKnobZTvaru(x); x.knob.tvar = 'vlastni'; }); naplnFormular(); });
  $('btnSkicaVychozi').addEventListener('click', () => { zmen(x => { delete x.knob.vlastni; }); naplnFormular(); });
  $('btnSkicaVyhladit').addEventListener('click', () => {
    zmen(x => { const b = x.knob.vlastni.body, puv = JSON.parse(JSON.stringify(b)); for (let i = 1; i < b.length - 1; i++) b[i].r = Math.round((puv[i - 1].r + 2 * puv[i].r + puv[i + 1].r) / 4 * 1000) / 1000; });
    naplnFormular();
  });
  edHlava = EDITOR_PROFILU.vytvor($('skica'), {
    ziskej: () => ({ body: p.knob.vlastni.body, sx: p.knob.prumer / 2, sy: p.knob.hlava, hlava: true, rMax: 1, ram: [[-p.knob.krcek / 2, -6, p.knob.krcek / 2, 0]] }),
    zapis: b => zmen(x => { x.knob.vlastni = { body: b }; }, 'skica'),
  });
  edKrcek = EDITOR_PROFILU.vytvor($('skicaKrcek'), {
    ziskej: () => ({ body: p.krcek.vlastni.body, sx: p.knob.krcek / 2, sy: Math.max(3, p.krcek.delka), hlava: false, serazene: true, rMin: 0.4, rMax: 3,
      ram: (posledniO && posledniO.maOdsazeni) ? [[-p.odsazeni.prumer / 2, -p.odsazeni.vyska, p.odsazeni.prumer / 2, 0]] : [],
      pevne: (i, n) => (i === 0 ? { u: true } : i === n - 1 ? { u: true, r: true } : null) }),
    zapis: b => zmen(x => { x.krcek.vlastni = { body: b }; }, 'skicaKrcek'),
  });
  $('btnKrcekVychozi').addEventListener('click', () => { zmen(x => { delete x.krcek.vlastni; }); naplnFormular(); });
  $('btnKrcekVyhladit').addEventListener('click', () => {
    zmen(x => { const b = x.krcek.vlastni.body, puv = JSON.parse(JSON.stringify(b)); for (let i = 1; i < b.length - 1; i++) b[i].r = Math.round((puv[i - 1].r + 2 * puv[i].r + puv[i + 1].r) / 4 * 1000) / 1000; });
    naplnFormular();
  });
  function prepinac(id, co) {
    const b = $(id);
    b.addEventListener('click', () => { const h = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(h)); nahled.prepni(co, h); $('legenda3d').hidden = !(model && nahled.stav.tisk && nahled.stav.previsy); });
  }
  prepinac('tHrany', 'hrany'); prepinac('tTisk', 'tisk'); prepinac('tPrevisy', 'previsy');
  $('stavOdznak').addEventListener('click', () => TrubkyGui.otevriZalozku('kontrola'));
  $('btnZavritNap').addEventListener('click', () => $('napoveda').close());
  document.addEventListener('keydown', e => {
    const a = document.activeElement;
    const vPoli = a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || (a.tagName === 'INPUT' && !/checkbox|range|radio|button/.test(a.type));
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && !vPoli && k === 'z') { e.preventDefault(); krokHistorie(e.shiftKey ? znovu : zpet, e.shiftKey ? zpet : znovu); return; }
    if ((e.ctrlKey || e.metaKey) && !vPoli && k === 'y') { e.preventDefault(); krokHistorie(znovu, zpet); return; }
    if ((e.ctrlKey || e.metaKey) && k === 's') { e.preventDefault(); exportStl(); return; }
    if (e.key === 'F1') { e.preventDefault(); $('napoveda').showModal(); return; }
    if (vPoli || e.ctrlKey || e.metaKey || e.altKey || $('napoveda').open) return;
    const pohl = { 1: 'iso', 2: 'shora', 3: 'zepredu', 4: 'zboku' }[e.code ? e.code.replace('Digit', '').replace('Numpad', '') : k];
    if (pohl) nahled.pohled(pohl);
    else if (k === 'r') $('btnNahodny').click();
    else if (k === 'm') $('tTisk').click(); else if (k === 'v') $('tPrevisy').click(); else if (k === 'h') $('tHrany').click();
  });
  new MutationObserver(() => naplanuj()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  if (typeof Tvary !== 'undefined') Tvary.pripoj({
    klic: 'webapp_knob_tvary', typ: 'knob', nazev: 'Knoby', kontejner: $('tvary'),
    parametry: () => K.kopie(p),
    pouzij: q => { const r = N.normalizuj(q); hlasPrevod(r.hlaseni, 'Uložený knob'); nahrad(r.p); },
    popis: q => `${q.nazev || 'Knob'} – ${N.popis(N.normalizuj(q).p)}`,
  });

  /* ---------- start ---------- */
  p = nactiUlozeny();
  try { naplnFormular(); prepocitej(); } catch (e) { console.error(e); p = N.zPredvolby(0); naplnFormular(); prepocitej(); }
  nactiManifold().then(w => { wasm = w; prepocitej(); }).catch(e => {
    chybaJadra = 'Geometrické jádro (manifold-3d) se nenačetlo: ' + (e && e.message || e) + ' – model ani export nejsou k dispozici.';
    prepocitej();
  });
  window.KNOB_UI = { get p() { return p; }, get model() { return model; }, nahled, zmen, naplnFormular, prepocitej, nahrad };
})();

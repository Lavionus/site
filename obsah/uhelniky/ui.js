/* Úhelníky a odsávání – ovládání stránky: formulář, historie, manifold, přepočet, výsledky, kontroly, export.
   3D náhled je společný se spojkami (spojky/nahled.js). */
/* global UHELNIKY, UHELNIKY_GEOM, UHELNIKY_VYKRES, SPOJKY_NAHLED, KRAB, Dialog, Tvary, TrubkyGui */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const U = UHELNIKY, fmt = U.fmt;
  const KLIC = 'webapp_uhelniky_projekt';

  /* ---------- stav a historie ---------- */
  let p, wasm = null, model = null, chybaStavby = null;
  const zpet = [], znovu = [];
  function hlasPrevod(hl, co) { if (hl && hl.length) setTimeout(() => Dialog.info(`${co} upraven: ${hl.join('; ')}.`), 300); }
  function nactiUlozeny() {
    try {
      const t = localStorage.getItem(KLIC);
      if (t) { const r = U.normalizuj(JSON.parse(t)); hlasPrevod(r.hlaseni, 'Uložený projekt'); return r.p; }
    } catch (e) { /* poškozený záznam */ }
    return U.zPredvolby(0);
  }
  function uloz() { try { localStorage.setItem(KLIC, JSON.stringify(p)); } catch (e) { /* plné úložiště */ } }
  function zmen(fn, slouceni) {
    const pred = JSON.stringify(p);
    fn(p);
    p = U.normalizuj(p).p;
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
    p = U.normalizuj(JSON.parse(z.pop().stav)).p;
    naplnFormular(); po();
  }
  function po() {
    $('btnZpet').disabled = !zpet.length; $('btnZnovu').disabled = !znovu.length;
    uloz(); viditelnost(); naplanuj();
  }
  function nahrad(q) { zmen(x => { Object.keys(x).forEach(k => delete x[k]); Object.assign(x, q); }); naplnFormular(); }

  /* ---------- formulář ---------- */
  const opt = (sel, obj, f) => { $(sel).innerHTML = Object.entries(obj).map(([k, v]) => `<option value="${k}">${f(k, v)}</option>`).join(''); };
  opt('f_vyztuha', U.VYZTUHY, (k, v) => v);
  opt('f_hsmer', U.SMERY_HRDLA, (k, v) => v);
  opt('f_usaz', U.USAZENI, (k, v) => v);
  opt('f_zap', U.ZAPUSTENI, (k, v) => v);
  opt('f_smerOv', U.SMERY_OVALU, (k, v) => v);
  opt('f_spoj', U.SPOJE, (k, v) => v);
  opt('f_profil', U.PROFILY_V, (k, v) => v);
  opt('f_profA', U.SMERY_PROFILU, (k, v) => v);
  opt('f_profB', U.SMERY_PROFILU, (k, v) => v);
  opt('f_sroub', U.SROUBY, (k, v) => `${k} (otvor ${fmt(v.otvor)})`);
  $('f_vrut').innerHTML = Object.keys(U.VRUTY).sort((a, b) => a - b).map(k => { const v = U.VRUTY[k]; return `<option value="${k}">${fmt(v.d)} mm (otvor ${fmt(v.otvor)}, hlava ${fmt(v.hlava)})</option>`; }).join('');
  opt('f_mat', U.MATERIALY, (k, v) => `${v.nazev} – ${fmt(v.hustota, 2)} g/cm³`);
  const pole = [...document.querySelectorAll('[data-p]')];
  function naplnFormular() {
    for (const el of pole) {
      const h = U.vezmi(p, el.dataset.p);
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
        h = U.cislo(el.value, NaN);
        el.classList.toggle('spatne', !Number.isFinite(h));
        if (!Number.isFinite(h)) return;
      }
      zmen(x => {
        U.poloz(x, c, h);
        // volba profilu nastaví šroub do T-matice a šířku aspoň na stranu profilu
        if (c === 'otvory.profil' && h !== 'zadny') {
          const pr = U.PROFILY[h];
          Object.assign(x.otvory, { spoj: 'sroub', sroub: pr.sroub, zapust: 'zadne' });
          if (x.uhelnik.sirka < pr.a) x.uhelnik.sirka = pr.a;
        }
      }, c);
      if (c === 'otvory.profil') naplnFormular();
    };
    el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', akce);
    if (el.tagName === 'INPUT' && el.type === 'text' && el.dataset.typ !== 'text') {
      el.addEventListener('change', () => {
        const psano = U.cislo(el.value, NaN), h = U.vezmi(p, el.dataset.p), roz = U.ROZSAHY[el.dataset.p];
        el.value = String(h).replace('.', ',');
        if (roz && Number.isFinite(psano) && Math.abs(psano - h) > 1e-9) {
          el.classList.remove('zvyrazni'); void el.offsetWidth; el.classList.add('zvyrazni');
          Dialog.info(`${el.labels[0] ? el.labels[0].textContent.trim() : 'Hodnota'}: omezeno na ${fmt(roz[0], 2)}–${fmt(roz[1], 2)}, použito ${fmt(h, 2)}.`);
        }
      });
      // ↑/↓ ± 1, Shift × 10, Alt po 0,1
      el.addEventListener('keydown', e => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        const h = U.cislo(el.value, NaN); if (!Number.isFinite(h)) return;
        e.preventDefault();
        const krok = (e.shiftKey ? 10 : e.altKey ? 0.1 : 1) * (e.key === 'ArrowUp' ? 1 : -1);
        el.value = fmt(Math.round((h + krok) * 1000) / 1000, 3);
        el.dispatchEvent(new Event('input'));
      });
    }
  }
  document.querySelectorAll('[data-typ-volba]').forEach(b => b.addEventListener('click', () => {
    zmen(x => {
      x.typ = b.dataset.typVolba;
      // výchozí název podle typu, vlastní název nechat
      const vych = { uhelnik: 'Úhelník', odsavani: 'Odsávání za frézou' };
      if (!x.nazev || Object.values(vych).includes(x.nazev) || U.PREDVOLBY.some(v => v.nazev === x.nazev)) x.nazev = vych[x.typ];
    });
    naplnFormular();
  }));

  /** Ukáže jen pole, která pro zvolený typ dávají smysl. */
  function viditelnost() {
    for (const el of document.querySelectorAll('[data-pro]')) el.hidden = !el.dataset.pro.split(' ').includes(p.typ);
    document.querySelectorAll('[data-typ-volba]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.typVolba === p.typ)));
    $('lDrevo').textContent = p.typ === 'odsavani' ? 'Tloušťka pravítka' : 'Tloušťka dřeva';
    $('lHadice').textContent = p.odsavani.usazeni === 'zasun' ? 'Koncovka zvenku' : 'Hadice uvnitř';
    $('hOtvory').textContent = p.typ === 'odsavani' ? 'Vruty a hrdlo' : 'Upevnění a otvory';
    for (const id of ['f_tz', 'f_vel', 'f_sp']) $(id).closest('.pole').hidden = p.uhelnik.vyztuha === 'zadna';
    $('f_smerOv').closest('.pole').hidden = !(p.otvory.ovalnost > 0);
    const sProfilem = p.typ === 'uhelnik' && p.otvory.profil !== 'zadny';
    for (const el of document.querySelectorAll('[data-spoj]')) el.hidden = el.dataset.spoj !== p.otvory.spoj;
    for (const el of document.querySelectorAll('[data-sprofilem]')) el.hidden = !sProfilem;
    for (const el of document.querySelectorAll('[data-bezprofilu]')) el.hidden = sProfilem;
    $('f_rad').closest('.pole').hidden = p.typ !== 'uhelnik' || sProfilem || !!U.seznam(p.otvory.napric);
    $('lPodA').textContent = p.typ === 'odsavani' ? 'Výšky otvorů v uchu – od stolu' : 'Na rameni A – od rohu';
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
  const nahled = SPOJKY_NAHLED.vytvorNahled($('platno'));
  $('platno').querySelector('canvas').setAttribute('aria-label', '3D náhled dílu – tažením otáčíte, kolečkem přibližujete, pravým tlačítkem posouváte');
  let casovac = null;
  function naplanuj() { clearTimeout(casovac); casovac = setTimeout(prepocitej, 40); }
  function prepocitej() {
    nahled.barvy(css('--border-strong'), css('--border'), css('--text'));
    const o = U.odvozene(p);
    let H = U.kontroly(p, o);
    model = null; chybaStavby = null;
    const st = $('stav3d');
    if (!wasm) { vypis(H, o); return; }
    try {
      const t0 = performance.now();
      const sit = UHELNIKY_GEOM.postav(wasm, p, o);
      const rozbor = U.rozborTisku(sit, p, o);
      const tisk = U.tiskovaPoloha(sit, rozbor.vybrana.R);
      tisk.tridy = U.previsy(tisk.poz, sit.idx, p.tisk.previs).tridy;
      model = Object.assign(sit, { o, rozbor, tisk, ks: KRAB.kontrolaSite(tisk.poz, sit.idx), cas: performance.now() - t0, klic: p.typ });
      H = H.concat(U.kontrolyTisku(p, o, rozbor, sit.plocha));
      if (!model.ks.uzavrena) H.push({ uroven: 'chyba', text: 'Síť není uzavřená – export by nemusel jít vytisknout.', pole: [] });
      if (sit.dilu > 1) H.push({ uroven: 'varovani', text: `Díl se rozpadl na ${sit.dilu} kusy – zkontrolujte rozměry.`, pole: [] });
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
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function vypis(H, o) {
    const m = model;
    let v = '';
    const podpory = m && U.potrebujePodpory(m.rozbor.vybrana, m.plocha);
    if (m) {
      const b = m.ks.bbox, odh = U.odhadTisku(m.objem, m.plocha, b[5] - b[2], p), mat = U.MATERIALY[p.tisk.material];
      v += dl('Rozměry (tisk)', `${fmt(b[3] - b[0])} × ${fmt(b[4] - b[1])} × ${fmt(b[5] - b[2])} mm`, 'šířka × hloubka × výška tisku');
      v += dl('Objem', `${fmt(m.objem / 1000, 1)} cm³`, `plný díl ${fmt(odh.plny, 1)} g`);
      v += dl('Hmotnost', `≈ ${fmt(odh.gramy, 1)} g`, `${mat.nazev}, výplň ${fmt(p.tisk.vypln, 0)} %, ${fmt(odh.metru, 2)} m filamentu 1,75`);
      v += dl('Doba tisku', `≈ ${odh.minut < 90 ? fmt(odh.minut, 0) + ' min' : fmt(odh.minut / 60, 1) + ' h'}`, `1 kus, hrubý odhad (vrstva 0,2 mm)${p.tisk.kusu > 1 ? `; ${p.tisk.kusu} ks ≈ ${fmt(odh.minut * p.tisk.kusu / 60, 1)} h` : ''}`);
      v += dl('Otvory', o.pocetOtvoru ? `${o.pocetOtvoru} × Ø ${fmt(o.otvor.v.otvor, 1)}` : 'žádné', o.pocetOtvoru ? (o.otvor.zap ? `zápustné, kužel Ø ${fmt(2 * (o.otvor.ro + o.otvor.hz), 1)}` : 'pro hlavu dosedající na plochu') + (o.otvor.oval ? `, ovál ${fmt(o.otvor.oval)} mm` : '') : '');
      if (o.typ === 'uhelnik') {
        if (o.pocetOtvoru) v += dl('Otvory od rohu', `${o.ramenoA.x.map(x => fmt(x)).join(' · ')} mm`, `svislé rameno ${o.ramenoB.x.map(x => fmt(x)).join(' · ')} mm; od kraje A ${o.ramenoA.sloupce.map(s => fmt(s.y)).join(' · ')}, B ${o.ramenoB.sloupce.map(s => fmt(s.y)).join(' · ')} mm`);
        if (p.uhelnik.vyztuha !== 'zadna') v += dl('Výztuha', `${fmt(o.ga)} × ${fmt(o.gb)} mm`, `${U.VYZTUHY[p.uhelnik.vyztuha]}, tloušťka ${fmt(o.tz)} mm`);
      } else {
        v += dl('Hrdlo', `Ø ${fmt(2 * o.Ri, 2)} / ${fmt(2 * o.Ro, 2)} mm`, `uvnitř / zvenku, průřez ${fmt(Math.PI * o.Ri * o.Ri / 100, 1)} cm²`);
        v += dl('Okno', `${fmt(o.oknoS)} × ${fmt(o.oknoV)} mm`, `průřez ${fmt(o.oknoS * o.oknoV / 100, 1)} cm²`);
      }
      v += dl('Orientace tisku', m.rozbor.vybrana.nazev, podpory ? `${fmt(m.rozbor.vybrana.volne, 0)} mm² převisů – s podporami` : 'bez podpor', podpory ? 'mez-t' : 'ok-t');
    } else v = dl('Model', wasm ? 'nesestaven' : 'načítám…', chybaStavby || '');
    $('vVysledky').innerHTML = v;
    $('sVysledky').textContent = m ? `${fmt(m.objem / 1000, 1)} cm³` : '';
    // tisk
    const sel = $('f_orient'), r = m && m.rozbor;
    sel.innerHTML = '<option value="auto">automaticky – nejlepší</option>' + (r ? r.kandidati.map(k => `<option value="${k.klic}">${esc(k.nazev)}</option>`).join('') : '');
    sel.value = r && r.kandidati.some(k => k.klic === p.tisk.orientace) ? p.tisk.orientace : 'auto';
    $('tabOrientace').innerHTML = r ? '<tr><th>Poloha</th><th class="c">Bez opory</th><th class="c">Mosty</th><th class="c">Podložka</th><th class="c">Výška</th></tr>'
      + r.kandidati.map(k => `<tr class="klik${k === r.vybrana ? ' vybrana' : ''}" data-klic="${k.klic}" tabindex="0"><td>${k === r.nejlepsi ? '★ ' : ''}${esc(k.nazev)}</td><td class="c">${fmt(k.volne, 0)} mm²</td><td class="c">${fmt(k.most, 0)} mm²</td><td class="c">${fmt(k.podlozka, 0)} mm²</td><td class="c">${fmt(k.vyska)} mm</td></tr>`).join('') : '';
    $('sTisk').textContent = m ? (podpory ? 's podporami' : 'bez podpor') : '';
    $('pMaterial').textContent = U.MATERIALY[p.tisk.material].pozn;
    // kusovník
    const kus = U.kusovnik(p, o);
    $('tabKusovnik').innerHTML = kus.length ? '<tr><th class="c">Ks</th><th>Položka</th><th>Poznámka</th></tr>'
      + kus.map(x => `<tr><td class="c">${x.ks == null ? '' : x.ks * p.tisk.kusu}</td><td class="${x.chyba ? 'chyba-t' : ''}">${esc(x.co)}</td><td>${esc(x.pozn || '')}</td></tr>`).join('')
      : '<tr><td>Bez spojovacího materiálu.</td></tr>';
    $('vSit').innerHTML = m ? dl('Síť', m.ks.uzavrena ? '✔ uzavřená' : '✖ otevřená', `${m.ks.trojuhelniku} trojúhelníků, ${m.ks.hranOkrajovych} okrajových hran, rod ${m.rod}, ${fmt(m.cas, 0)} ms`, m.ks.uzavrena ? 'ok-t' : 'chyba-t') : '';
    $('karta3d').innerHTML = m ? `<div class="titul">${esc(U.TYPY[p.typ])}</div><b>${esc(U.popis(p))}</b><br>`
      + `<b>${fmt(U.odhadTisku(m.objem, m.plocha, m.ks.bbox[5] - m.ks.bbox[2], p).gramy, 1)}</b> g ${U.MATERIALY[p.tisk.material].nazev} · ${podpory ? '<b>s podporami</b>' : 'bez podpor'}` : '';
    $('legenda3d').hidden = !(m && nahled.stav.tisk && nahled.stav.previsy);
    // výkres
    try {
      const vy = UHELNIKY_VYKRES.vykres(p, o, { datum: new Date().toLocaleDateString('cs-CZ') });
      $('vykresNahled').innerHTML = UHELNIKY_VYKRES.svg(vy, { sirkaPx: true });
      $('sVykres').textContent = vy.meritko;
    } catch (e) { $('vykresNahled').textContent = 'Výkres nejde sestavit: ' + (e && e.message || e); $('sVykres').textContent = ''; }
    // souhrny oddílů
    const u = p.uhelnik, q = p.odsavani;
    TrubkyGui.souhrn('sRamena', `${fmt(u.delkaA)} × ${fmt(u.delkaB)} × ${fmt(u.sirka)}`);
    TrubkyGui.souhrn('sVyztuha', U.VYZTUHY[u.vyztuha]);
    TrubkyGui.souhrn('sKomora', `${fmt(q.sirka)} × ${fmt(q.vyska)} × ${fmt(q.hloubka)}`);
    TrubkyGui.souhrn('sPriruba', `okno ${fmt(o.oknoS || 0)} × ${fmt(o.oknoV || 0)}`);
    TrubkyGui.souhrn('sOtvory', `${o.otvor.v.nazev}${o.profil ? ' · ' + p.otvory.profil : ''}${o.pocetOtvoru ? ` · ${o.pocetOtvoru} ks` : ''}`);
    const ruc = ['podelA', 'podelB', 'napric'].some(k => U.seznam(p.otvory[k]));
    TrubkyGui.souhrn('sPolohy', ruc ? 'ručně' : 'automaticky', ruc);
    TrubkyGui.souhrn('sHrdlo', `Ø ${fmt(q.hadice)} ${q.hrdloSmer === 'dozadu' ? '→' : q.hrdloSmer === 'nahoru' ? '↑' : '↗'}`);
    // hlášení
    if (!wasm && !chybaStavby) H = H.concat([{ uroven: 'info', text: 'Načítám geometrické jádro (manifold-3d)…', pole: [] }]);
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
        b.addEventListener('click', () => { zmen(q2 => U.poloz(q2, x.oprava.pole, x.oprava.hodnota)); naplnFormular(); });
        li.appendChild(b);
      }
      ul.appendChild(li);
    }
    const nch = H.filter(x => x.uroven === 'chyba').length, nv = H.filter(x => x.uroven === 'varovani').length;
    const od = $('stavOdznak');
    od.className = 'odznak ' + (nch ? 'chyba' : nv ? 'mez' : 'ok');
    od.textContent = nch ? `✖ ${nch}` : nv ? `⚠ ${nv}` : '✔';
    $('sKontrola').textContent = nch ? `${nch} ${nch === 1 ? 'chyba' : nch < 5 ? 'chyby' : 'chyb'}` : nv ? `${nv} varování` : 'v pořádku';
    const boxy = { boxTyp: false, boxOtvory: false };
    for (const x of H) if (x.uroven === 'chyba') for (const c of x.pole) {
      const el = document.querySelector(`[data-p="${c}"]`), bx = el && el.closest('[data-box]');
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
  TrubkyGui.pripoj({ klic: 'webapp_uhelniky_gui', pohled: j => nahled.pohled(j) });
  const seznam = $('seznamPredvoleb');
  U.PREDVOLBY.forEach((v, i) => {
    const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
    b.innerHTML = `${esc(v.nazev)}<span class="pozn">${esc(v.popis)}</span>`;
    b.addEventListener('click', () => nahrad(U.zPredvolby(i)));
    seznam.appendChild(b);
  });
  const jmenoSouboru = pripona => ((p.nazev || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/^_|_$/g, '') || 'uhelnik') + pripona;
  function stahni(data, nazev, typ) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type: typ }));
    a.download = nazev; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function kusy(n) {
    if (!model) { Dialog.chyba(chybaStavby || (wasm ? 'Model nelze sestavit – viz záložka Kontrola.' : 'Geometrické jádro se ještě načítá.')); return null; }
    const d = { poz: model.tisk.poz, idx: model.idx, barva: '#4F86D9' };
    return KRAB.tiskoveRozlozeni(Array.from({ length: n }, (_, i) => Object.assign({ jmeno: 'uhelnik', nazev: (p.nazev || 'Úhelník') + (n > 1 ? ` ${i + 1}` : '') }, d)), 8);
  }
  function exportStl(n) { const k = kusy(n); if (k) stahni(KRAB.stlBinarni(k, 'uhelniky - github_site'), jmenoSouboru(n > 1 ? `_${n}ks.stl` : '.stl'), 'model/stl'); }
  $('btnStl').addEventListener('click', () => exportStl(p.tisk.kusu));
  $('btnStl1').addEventListener('click', () => exportStl(1));
  $('btn3mf').addEventListener('click', () => { const k = kusy(p.tisk.kusu); if (k) stahni(KRAB.soubor3mf(k, p.nazev || 'Úhelník'), jmenoSouboru('.3mf'), 'model/3mf'); });
  $('btnPng').addEventListener('click', () => { fetch(nahled.png()).then(r => r.blob()).then(b => stahni(b, jmenoSouboru('.png'))); });
  let pismoSlib = null;
  function nactiPismo() {
    if (window.FONTY_JS && window.FONTY_JS['LiberationSans-Regular.ttf']) return Promise.resolve(window.FONTY_JS['LiberationSans-Regular.ttf']);
    if (pismoSlib) return pismoSlib;
    pismoSlib = new Promise(ok => {
      const s = document.createElement('script'); s.src = 'stitky_panely/fonty/LiberationSans-Regular.ttf.js';
      s.onload = () => ok((window.FONTY_JS || {})['LiberationSans-Regular.ttf'] || null);
      s.onerror = () => { pismoSlib = null; ok(null); };
      document.head.appendChild(s);
    });
    return pismoSlib;
  }
  const vykresTed = () => UHELNIKY_VYKRES.vykres(p, U.odvozene(p), { datum: new Date().toLocaleDateString('cs-CZ') });
  async function vykresPdf() {
    try {
      if (!window.jspdf) throw new Error('Knihovna jsPDF se nenačetla.');
      const pismo = await nactiPismo();
      const doc = UHELNIKY_VYKRES.pdf(window.jspdf.jsPDF, vykresTed(), { pismo, nazev: p.nazev || 'Úhelník' });
      stahni(doc.output('blob'), jmenoSouboru('_vykres.pdf'));
      if (!pismo) Dialog.info('Písmo se nepodařilo načíst – PDF je bez diakritiky.');
    } catch (e) { Dialog.chyba('PDF se nepodařilo vytvořit: ' + (e && e.message || e)); }
  }
  const vykresSvg = () => stahni(UHELNIKY_VYKRES.svg(vykresTed()), jmenoSouboru('_vykres.svg'), 'image/svg+xml');
  $('btnVykresPdf').addEventListener('click', vykresPdf); $('btnVykresPdf2').addEventListener('click', vykresPdf);
  $('btnVykresSvg').addEventListener('click', vykresSvg); $('btnVykresSvg2').addEventListener('click', vykresSvg);
  $('btnUlozit').addEventListener('click', () => stahni(U.ulozProjekt(p), jmenoSouboru('.json'), 'application/json'));
  $('btnNacist').addEventListener('click', () => $('soubor').click());
  $('soubor').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try { const r = U.nactiProjekt(await f.text()); nahrad(r.p); hlasPrevod(r.hlaseni, 'Načtený projekt'); }
    catch (err) { Dialog.chyba(err.message); }
  });
  $('btnVychozi').addEventListener('click', async () => {
    if (await Dialog.potvrd('Vrátit všechny hodnoty na výchozí (první předvolba)?')) nahrad(U.zPredvolby(0));
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
    klic: 'webapp_uhelniky_tvary', typ: 'uhelniky', nazev: 'Úhelníky', kontejner: $('tvary'),
    parametry: () => U.kopie(p),
    pouzij: q => { const n = U.normalizuj(q); hlasPrevod(n.hlaseni, 'Uložený úhelník'); nahrad(n.p); },
    popis: q => `${q.nazev || 'Úhelník'} – ${U.popis(U.normalizuj(q).p)}`,
  });

  /* ---------- start ---------- */
  p = nactiUlozeny();
  naplnFormular();
  prepocitej();
  nactiManifold().then(w => { wasm = w; $('stav3d').textContent = ''; prepocitej(); }).catch(e => {
    chybaStavby = 'Geometrické jádro (manifold-3d) se nenačetlo: ' + (e && e.message || e) + ' – model ani export nejsou k dispozici.';
    const st = $('stav3d'); st.textContent = chybaStavby; st.classList.add('chyba');
    vypis(U.kontroly(p, U.odvozene(p)).concat([{ uroven: 'chyba', text: chybaStavby, pole: [] }]), U.odvozene(p));
  });
  window.UHELNIKY_UI = { get p() { return p; }, get model() { return model; }, nahled, zmen, naplnFormular, prepocitej, nahrad };
})();

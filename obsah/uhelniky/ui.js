/* Úhelníky a odsávání – ovládání stránky nad gen3d/aplikace.js (historie, projekt, Moje…, sdílení, klávesy, manifold):
   tady formulář s živou odezvou, přepočet, výsledky, tisk, kusovník, výkres, export.
   3D náhled je společný se spojkami (spojky/nahled.js). */
/* global UHELNIKY, UHELNIKY_GEOM, UHELNIKY_VYKRES, SPOJKY_NAHLED, KRAB, G3D, Dialog, TrubkyGui */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const U = UHELNIKY, fmt = U.fmt;
  let p, wasm = null, model = null, chybaStavby = null;
  const nahled = SPOJKY_NAHLED.vytvorNahled($('platno'));
  $('platno').querySelector('canvas').setAttribute('aria-label', '3D náhled dílu – tažením otáčíte, kolečkem přibližujete, pravým tlačítkem posouváte');
  const app = G3D.aplikace({
    typ: 'uhelniky', nazev: 'Úhelníky', klic: 'webapp_uhelniky', soubor: 'uhelnik',
    normalizuj: U.normalizuj, vychozi: () => U.zPredvolby(0), hlasitOpravyUlozeneho: true,
    ulozProjekt: U.ulozProjekt, nactiProjekt: U.nactiProjekt, vezmi: U.vezmi, poloz: U.poloz,
    popis: q => `${q.nazev || 'Úhelník'} – ${U.popis(q)}`,
    formular: false,   // pole reagují už při psaní (input) – vlastní obsluha níž
    viditelnost: () => viditelnost(),
    prepocitej: () => prepocitej(), zpozdeni: 40,
    png: () => nahled.png(), pohled: j => nahled.pohled(j),
    exportStl: () => exportStl(app.p.tisk.kusu),
    doModelare: () => { const k = kusy(1); return k ? { data: KRAB.soubor3mf(k, app.p.nazev || 'Úhelník'), pripona: '.3mf' } : null; },
    zkratky: { m: 'tTisk', d: 'tDuchove', v: 'tPrevisy', p: 'tPrevisy', h: 'tHrany', l: 'tPravitka' },
    zmenaTematu: () => app.prepocitej(),
  });
  const zmen = (f, sl) => app.zmen(f, sl), nahrad = q => app.nahrad(q), naplnFormular = () => app.naplnFormular();

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
  for (const el of pole) {
    const akce = () => {
      el._posl = el.value;
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
        if (el.value !== el._posl) akce();   // vložení bez psaní (automatické vyplnění, testy)
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
    p = app.p;
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

  /* ---------- přepočet ---------- */
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  function prepocitej() {
    p = app.p;
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
    app.hlaseni(H, { boxy: ['boxTyp', 'boxOtvory'] });
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
  function kusy(n) {
    if (!model) { Dialog.chyba(chybaStavby || (wasm ? 'Model nelze sestavit – viz záložka Kontrola.' : 'Geometrické jádro se ještě načítá.')); return null; }
    const d = { poz: model.tisk.poz, idx: model.idx, barva: '#4F86D9' };
    return KRAB.tiskoveRozlozeni(Array.from({ length: n }, (_, i) => Object.assign({ jmeno: 'uhelnik', nazev: (p.nazev || 'Úhelník') + (n > 1 ? ` ${i + 1}` : '') }, d)), 8);
  }
  function exportStl(n) { const k = kusy(n); if (k) app.stahni(KRAB.stlBinarni(k, 'uhelniky - github_site'), app.jmeno(n > 1 ? `_${n}ks.stl` : '.stl'), 'model/stl'); }
  $('btnStl').addEventListener('click', () => exportStl(app.p.tisk.kusu));
  $('btnStl1').addEventListener('click', () => exportStl(1));
  $('btn3mf').addEventListener('click', () => { const k = kusy(p.tisk.kusu); if (k) app.stahni(KRAB.soubor3mf(k, p.nazev || 'Úhelník'), app.jmeno('.3mf'), 'model/3mf'); });
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
      app.stahni(doc.output('blob'), app.jmeno('_vykres.pdf'));
      if (!pismo) Dialog.info('Písmo se nepodařilo načíst – PDF je bez diakritiky.');
    } catch (e) { Dialog.chyba('PDF se nepodařilo vytvořit: ' + (e && e.message || e)); }
  }
  const vykresSvg = () => app.stahni(UHELNIKY_VYKRES.svg(vykresTed()), app.jmeno('_vykres.svg'), 'image/svg+xml');
  $('btnVykresPdf').addEventListener('click', vykresPdf); $('btnVykresPdf2').addEventListener('click', vykresPdf);
  $('btnVykresSvg').addEventListener('click', vykresSvg); $('btnVykresSvg2').addEventListener('click', vykresSvg);
  document.querySelectorAll('[data-vykres-zobraz]').forEach(b => b.addEventListener('click', () => TrubkyGui.otevriZalozku('vykres')));
  const legenda = () => { $('legenda3d').hidden = !(model && nahled.stav.tisk && nahled.stav.previsy); };
  for (const [id, co] of [['tDuchove', 'duchove'], ['tHrany', 'hrany'], ['tTisk', 'tisk'], ['tPrevisy', 'previsy']]) app.prepinac(id, h => { nahled.prepni(co, h); legenda(); });
  app.prepinac('tPravitka', h => nahled.prepni('pravitka', h), true);

  /* ---------- start ---------- */
  p = app.p;
  app.start({
    manifold: {
      ok: w => { wasm = w; $('stav3d').textContent = ''; prepocitej(); },
      chyba: e => {
        chybaStavby = 'Geometrické jádro (manifold-3d) se nenačetlo: ' + (e && e.message || e) + ' – model ani export nejsou k dispozici.';
        const st = $('stav3d'); st.textContent = chybaStavby; st.classList.add('chyba');
        vypis(U.kontroly(p, U.odvozene(p)).concat([{ uroven: 'chyba', text: chybaStavby, pole: [] }]), U.odvozene(p));
      },
    },
  });
  window.UHELNIKY_UI = { get p() { return app.p; }, get model() { return model; }, nahled, zmen, naplnFormular, prepocitej, nahrad, app };
})();

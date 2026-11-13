/* Spojky – ovládání stránky nad gen3d/aplikace.js (historie, projekt, Moje…, sdílení, klávesy, manifold):
   tady formulář s živou odezvou, přepočet, výsledky, tisk, kusovník, export. */
/* global SPOJKY, SPOJKY_GEOM, SPOJKY_NAHLED, KRAB, G3D, Dialog, TrubkyGui */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const S = SPOJKY, fmt = S.fmt;
  let p, wasm = null, model = null, chybaStavby = null;
  const nahled = SPOJKY_NAHLED.vytvorNahled($('platno'));
  const app = G3D.aplikace({
    typ: 'spojky', nazev: 'Spojky', klic: 'webapp_spojky', soubor: 'spojka',
    normalizuj: S.normalizuj, vychozi: () => S.zPredvolby(0), hlasitOpravyUlozeneho: true,
    ulozProjekt: S.ulozProjekt, nactiProjekt: S.nactiProjekt, vezmi: S.vezmi, poloz: S.poloz,
    popis: q => `${q.nazev || 'Spojka'} – ${S.popis(q)}`,
    formular: false,   // pole reagují už při psaní (input) – vlastní obsluha níž
    poNaplneni: q => { $('f_rada').value = q.profil.rada; },
    viditelnost: () => viditelnost(),
    prepocitej: () => prepocitej(), zpozdeni: 40,
    png: () => nahled.png(), pohled: j => nahled.pohled(j),
    exportStl: () => exportStl(app.p.tisk.kusu),
    doModelare: () => { const k = kusy(1); return k ? { data: KRAB.soubor3mf(k, app.p.nazev || 'Spojka'), pripona: '.3mf' } : null; },
    zkratky: { m: 'tTisk', d: 'tDuchove', v: 'tPrevisy', p: 'tPrevisy', h: 'tHrany', l: 'tPravitka', r: 'tRez' },
    zmenaTematu: () => app.prepocitej(),
    // stejné pole může být ve víc oddílech (spoj.vule) – skok na to viditelné
    hlaseniNavic: (li, x) => { if (x.pole.length) li.addEventListener('click', e => { if (e.target.tagName !== 'BUTTON') { e.stopImmediatePropagation(); jdiNaPole(x.pole[0]); } }, true); },
  });
  const zmen = (f, sl) => app.zmen(f, sl), nahrad = q => app.nahrad(q), naplnFormular = () => app.naplnFormular();

  /* ---------- formulář ---------- */
  const opt = (sel, obj, f) => { $(sel).innerHTML = Object.entries(obj).map(([k, v]) => `<option value="${k}">${f(k, v)}</option>`).join(''); };
  opt('f_druh', S.DRUHY, (k, v) => v);
  opt('f_tvar', S.TVARY_PLOCHY, (k, v) => v);
  opt('f_sroub', S.SROUBY, (k, v) => `${k} (otvor ${fmt(v.otvor)}, hlava ${fmt(v.hlava)})`);
  opt('f_rtvar', S.TVARY_RAMEN, (k, v) => v.nazev);
  opt('f_mat', S.MATERIALY, (k, v) => `${v.nazev} – ${fmt(v.hustota, 2)} g/cm³`);
  const pole = [...document.querySelectorAll('[data-p]')];
  const ROZMERY_RADY = ['profil.a', 'profil.drazka', 'profil.limec', 'profil.hloubka', 'profil.stred', 'profil.dutina'];
  for (const el of pole) {
    const akce = () => {
      el._posl = el.value;
      const c = el.dataset.p;
      let h;
      if (el.type === 'checkbox') h = el.checked;
      else if (el.dataset.typ === 'text') h = el.value;
      else {
        h = S.cislo(el.value, NaN);
        el.classList.toggle('spatne', !Number.isFinite(h));
        if (!Number.isFinite(h)) return;
      }
      zmen(x => {
        S.poloz(x, c, h);
        if (ROZMERY_RADY.includes(c)) { const r = S.PROFILY[x.profil.rada]; if (r && Math.abs(r[c.split('.')[1]] - h) > 1e-9) x.profil.rada = 'vlastni'; }
      }, c);
      if (c.startsWith('profil.')) $('f_rada').value = p.profil.rada;
    };
    el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', akce);
    if (el.tagName === 'INPUT' && el.type === 'text' && el.dataset.typ !== 'text') {
      el.addEventListener('change', () => {
        if (el.value !== el._posl) akce();   // vložení bez psaní (automatické vyplnění, testy)
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
  $('f_rada').addEventListener('change', e => { zmen(x => S.nastavRadu(x, e.target.value)); naplnFormular(); });
  document.querySelectorAll('[data-typ-volba]').forEach(b => b.addEventListener('click', () => { zmen(x => { x.typ = b.dataset.typVolba; }); naplnFormular(); }));

  /** Ukáže jen pole, která pro zvolený typ / druh / tvar dávají smysl. */
  function viditelnost() {
    p = app.p;
    const styl = p.typ === 'lat' ? 'vnejsi' : p.trubka.styl;
    for (const el of document.querySelectorAll('[data-pro]')) el.hidden = !el.dataset.pro.split(' ').includes(p.typ);
    for (const el of document.querySelectorAll('[data-druh]')) el.hidden = !el.dataset.druh.split(' ').includes(p.profil.druh);
    for (const el of document.querySelectorAll('[data-rtvar]')) el.hidden = el.dataset.rtvar !== p.ramena.tvar;
    for (const el of document.querySelectorAll('[data-styl]')) el.hidden = el.dataset.styl !== styl;
    document.querySelectorAll('[data-typ-volba]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.typVolba === p.typ)));
    $('lTl').textContent = { uhelnik: 'Tloušťka ramen', plocha: 'Tloušťka desky', krytka: 'Tloušťka víčka', kostka: 'Stěna pod hlavou šroubu', vzpera: 'Tloušťka patek' }[p.profil.druh] || 'Tloušťka';
    $('lDelka').textContent = { plocha: 'Délka ramene za středem', vzpera: 'Délka vzpěry (osa)', lista: 'Délka lišty' }[p.profil.druh] || 'Délka ramene';
    $('lOtvoru').textContent = { vzpera: 'Otvorů na patce', vnitrni: 'Stavěcích šroubů na rameni' }[p.profil.druh] || 'Otvorů na rameni';
    $('lStena').textContent = styl === 'vnejsi' ? 'Stěna objímky' : 'Stěna čepu';
    $('lRozmer').textContent = p.trubka.prurez === 'kruh' ? 'Vnější průměr' : 'Vnější strana';
    $('lOtvor').textContent = p.typ === 'lat' ? 'Otvor pro šroub skrz lať' : 'Pojistný otvor';
    $('hSpoj').textContent = p.typ === 'profil' ? 'Tvar a výstupky' : 'Ramena a spoj';
  }

  /* ---------- přepočet ---------- */
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  function prepocitej() {
    p = app.p;
    nahled.barvy(css('--border-strong'), css('--border'), css('--text'));
    const o = S.odvozene(p);
    let H = S.kontroly(p, o);
    model = null; chybaStavby = null;
    const st = $('stav3d');
    if (!wasm) { vypis(H, o); return; }
    const zastav = o.ramena && (o.ramena.length === 0 || o.ramena.length > 12 || o.minUhel < 1);
    if (!zastav) {
      try {
        const t0 = performance.now();
        const sit = SPOJKY_GEOM.postav(wasm, p, o);
        const rozbor = S.rozborTisku(sit, p, o);
        const tisk = S.tiskovaPoloha(sit, rozbor.vybrana.R);
        tisk.tridy = S.previsy(tisk.poz, sit.idx, p.tisk.previs).tridy;
        model = Object.assign(sit, { o, rozbor, tisk, ks: KRAB.kontrolaSite(tisk.poz, sit.idx), cas: performance.now() - t0,
          klic: p.typ + (p.typ === 'profil' ? p.profil.druh : '') });
        H = H.concat(S.kontrolyTisku(p, o, rozbor, sit.plocha));
        if (!model.ks.uzavrena) H.push({ uroven: 'chyba', text: 'Síť není uzavřená – export by nemusel jít vytisknout.', pole: [] });
      } catch (e) {
        chybaStavby = 'Těleso nejde sestavit: ' + (e && e.message || e);
        H.push({ uroven: 'chyba', text: chybaStavby, pole: [] });
      }
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
    // výsledky
    let v = '';
    const podpory = m && S.potrebujePodpory(m.rozbor.vybrana, m.plocha);
    if (m) {
      const b = m.ks.bbox, odh = S.odhadTisku(m.objem, m.plocha, b[5] - b[2], p), mat = S.MATERIALY[p.tisk.material];
      v += dl('Rozměry (tisk)', `${fmt(b[3] - b[0])} × ${fmt(b[4] - b[1])} × ${fmt(b[5] - b[2])} mm`, 'šířka × hloubka × výška tisku');
      v += dl('Objem', `${fmt(m.objem / 1000, 1)} cm³`, `plný díl ${fmt(odh.plny, 1)} g`);
      v += dl('Hmotnost', `≈ ${fmt(odh.gramy, 1)} g`, `${mat.nazev}, výplň ${fmt(p.tisk.vypln, 0)} %, ${fmt(odh.metru, 2)} m filamentu 1,75`);
      v += dl('Doba tisku', `≈ ${odh.minut < 90 ? fmt(odh.minut, 0) + ' min' : fmt(odh.minut / 60, 1) + ' h'}`, `1 kus, hrubý odhad (vrstva 0,2 mm)${p.tisk.kusu > 1 ? `; ${p.tisk.kusu} ks ≈ ${fmt(odh.minut * p.tisk.kusu / 60, 1)} h` : ''}`);
      if (o.ramena) {
        v += dl('Ramen', String(o.ramena.length), `nejmenší úhel ${fmt(o.minUhel)}°`);
        v += dl('Odstup dorazu', `${fmt(o.odstup)} mm`, p.spoj.odstup > 0 ? `ručně (potřeba ≥ ${fmt(o.potreba)})` : 'automaticky – trubky se nesrazí');
        const dut = o.styl === 'vnejsi' ? o.dutina : o.cep;
        v += dl(o.styl === 'vnejsi' ? 'Dutina objímky' : 'Čep', dut.typ === 'kruh' ? `Ø ${fmt(2 * dut.r, 2)} mm` : `${fmt(2 * dut.hv, 2)} × ${fmt(2 * dut.hu, 2)} mm`, `hloubka ${fmt(o.L)} mm`);
      } else {
        const r = o.profil;
        const dr = p.profil.druh;
        if (dr === 'vzpera') v += dl('Vzpěra', `${fmt(p.profil.uhel)}° · ${fmt(r.D)} mm`, `tloušťka ${fmt(r.tb)} mm; patky ${fmt(r.patkaH[1] - r.patkaH[0])} a ${fmt(r.patkaV[1] - r.patkaV[0])} mm`)
          + dl('Otvory', `${2 * p.profil.otvoru} × Ø ${fmt(r.otvor, 1)}`, r.otvoryH.length ? `od rohu ${r.otvoryH.map(x => fmt(x)).join(' · ')} / ${r.otvoryV.map(x => fmt(x)).join(' · ')} mm` : '');
        if (dr === 'vnitrni') v += dl('Rameno v drážce', `${fmt(2 * r.hrdlo, 2)} / ${fmt(2 * r.dutinaPul, 2)} mm`, `hrdlo skrz límec / dutina pod ním, hloubka ${fmt(r.dno)} mm`)
          + dl('Otvory pro závit', `${2 * r.otvory.length} × Ø ${fmt(r.zavit, 1)}`, r.otvory.length ? `od rohu ${r.otvory.map(x => fmt(x)).join(' · ')} mm` : '');
        if (dr === 'lista') v += dl('Lišta', `${fmt(2 * r.vicko, 2)} × ${fmt(p.profil.delka)} mm`, `zobáčky ${fmt(2 * r.zobak, 2)} mm do drážky ${fmt(p.profil.drazka)} mm`);
        if (r.otvory && dr !== 'vnitrni') v += dl('Otvory', `${r.otvory.length} × Ø ${fmt(r.otvor, 1)}`, r.otvory.length ? `od rohu ${r.otvory.map(x => fmt(x - (p.profil.druh === 'plocha' ? 0 : 0))).join(', ')} mm` : '');
        if (r.K) v += dl('Kostka', `${fmt(r.K)} mm`, `nejmenší ${r.minKostka} mm (hlavy šroubů)`);
        if (dr !== 'vnitrni' && dr !== 'lista') v += dl('Výstupek', `${fmt(r.sirkaKlice, 2)} × ${fmt(r.vyskaKlice, 2)} mm`, `drážka ${fmt(p.profil.drazka)} − 2 × vůle`);
      }
      v += dl('Orientace tisku', m.rozbor.vybrana.nazev, podpory ? `${fmt(m.rozbor.vybrana.volne, 0)} mm² převisů – s podporami` : 'bez podpor', podpory ? 'mez-t' : 'ok-t');
    } else v = dl('Model', wasm ? 'nesestaven' : 'načítám…', chybaStavby || '');
    $('vVysledky').innerHTML = v;
    $('sVysledky').textContent = m ? `${fmt(m.objem / 1000, 1)} cm³` : '';
    // tabulka ramen
    if (o.ramena && o.ramena.length) {
      const radky = o.ramena.map((r, i) => {
        let nej = 180, s = '';
        o.ramena.forEach((q, j) => { if (j !== i) { const u = Math.acos(Math.max(-1, Math.min(1, S.V.dot(r.d, q.d)))) * 180 / Math.PI; if (u < nej) { nej = u; s = j + 1; } } });
        return `<tr><td>${i + 1}</td><td class="c">${fmt(((r.az % 360) + 360) % 360)}°</td><td class="c">${fmt(r.el)}°</td><td class="c">${fmt(nej)}° (k ${s})</td></tr>`;
      }).join('');
      $('tabRamena').innerHTML = `<table class="tabulka"><tr><th>Rameno</th><th class="c">Azimut</th><th class="c">Sklon</th><th class="c">Nejbližší</th></tr>${radky}</table>`;
    } else $('tabRamena').innerHTML = '';
    // tisk
    const sel = $('f_orient'), r = m && m.rozbor;
    sel.innerHTML = '<option value="auto">automaticky – nejlepší</option>' + (r ? r.kandidati.map(k => `<option value="${k.klic}">${esc(k.nazev)}</option>`).join('') : '');
    sel.value = r && r.kandidati.some(k => k.klic === p.tisk.orientace) ? p.tisk.orientace : 'auto';
    $('tabOrientace').innerHTML = r ? '<tr><th>Poloha</th><th class="c">Bez opory</th><th class="c">Mosty</th><th class="c">Podložka</th><th class="c">Výška</th></tr>'
      + r.kandidati.map(k => `<tr class="klik${k === r.vybrana ? ' vybrana' : ''}" data-klic="${k.klic}" tabindex="0"><td>${k === r.nejlepsi ? '★ ' : ''}${esc(k.nazev)}</td><td class="c">${fmt(k.volne, 0)} mm²</td><td class="c">${fmt(k.most, 0)} mm²</td><td class="c">${fmt(k.podlozka, 0)} mm²</td><td class="c">${fmt(k.vyska)} mm</td></tr>`).join('') : '';
    $('sTisk').textContent = m ? (podpory ? 's podporami' : 'bez podpor') : '';
    $('pMaterial').textContent = S.MATERIALY[p.tisk.material].pozn;
    // kusovník
    const kus = S.kusovnik(p, o);
    $('tabKusovnik').innerHTML = kus.length ? '<tr><th class="c">Ks</th><th>Položka</th><th>Poznámka</th></tr>'
      + kus.map(x => `<tr><td class="c">${x.ks * p.tisk.kusu}</td><td class="${x.chyba ? 'chyba-t' : ''}">${esc(x.co)}</td><td>${esc(x.pozn || '')}</td></tr>`).join('')
      : '<tr><td>Bez spojovacího materiálu.</td></tr>';
    // síť
    $('vSit').innerHTML = m ? dl('Síť', m.ks.uzavrena ? '✔ uzavřená' : '✖ otevřená', `${m.ks.trojuhelniku} trojúhelníků, ${m.ks.hranOkrajovych} okrajových hran, rod ${m.rod}, ${fmt(m.cas, 0)} ms`, m.ks.uzavrena ? 'ok-t' : 'chyba-t') : '';
    // karta v rohu
    $('karta3d').innerHTML = m ? `<div class="titul">${esc(S.TYPY[p.typ])}</div><b>${esc(S.popis(p))}</b><br>`
      + `<b>${fmt(S.odhadTisku(m.objem, m.plocha, m.ks.bbox[5] - m.ks.bbox[2], p).gramy, 1)}</b> g ${S.MATERIALY[p.tisk.material].nazev} · ${podpory ? '<b>s podporami</b>' : 'bez podpor'}` : '';
    $('legenda3d').hidden = !(m && nahled.stav.tisk && nahled.stav.previsy);
    // souhrny oddílů
    const q = p.profil;
    TrubkyGui.souhrn('sProfil', q.rada === 'vlastni' ? `${fmt(q.a)} mm` : q.rada);
    TrubkyGui.souhrn('sDruh', S.DRUHY[q.druh] + (q.druh === 'plocha' ? ' ' + q.tvar : ''));
    TrubkyGui.souhrn('sSrouby', q.sroub);
    TrubkyGui.souhrn('sTrubka', (p.trubka.prurez === 'kruh' ? 'Ø ' : '□ ') + fmt(p.trubka.rozmer));
    TrubkyGui.souhrn('sLat', `${fmt(p.lat.sirka)} × ${fmt(p.lat.vyska)}`);
    TrubkyGui.souhrn('sRamena', o.ramena ? `${o.ramena.length} ramen` : '');
    TrubkyGui.souhrn('sSpoj', `zasunutí ${fmt(p.spoj.zasunuti)}`);
    $('pOdstup').textContent = o.ramena ? `Potřebný odstup dorazu od středu: ${fmt(o.potreba)} mm${o.kritickePary[0] ? ` (rozhoduje dvojice ramen ${o.kritickePary[0].i + 1}–${o.kritickePary[0].j + 1}, úhel ${fmt(o.kritickePary[0].uhel)}°)` : ''}.` : '';
    // hlášení
    if (!wasm && !chybaStavby) H = H.concat([{ uroven: 'info', text: 'Načítám geometrické jádro (manifold-3d)…', pole: [] }]);
    app.hlaseni(H, { boxy: ['boxTyp', 'boxSpoj'] });
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
  TrubkyGui.pripoj({ klic: 'webapp_spojky_gui', pohled: j => nahled.pohled(j) });
  const seznam = $('seznamPredvoleb');
  S.PREDVOLBY.forEach((v, i) => {
    const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
    b.innerHTML = `${esc(v.nazev)}<span class="pozn">${esc(v.popis)}</span>`;
    b.addEventListener('click', () => nahrad(S.zPredvolby(i)));
    seznam.appendChild(b);
  });
  function kusy(n) {
    if (!model) { Dialog.chyba(chybaStavby || (wasm ? 'Model nelze sestavit – viz záložka Kontrola.' : 'Geometrické jádro se ještě načítá.')); return null; }
    const d = { poz: model.tisk.poz, idx: model.idx, barva: '#4F86D9' };
    return KRAB.tiskoveRozlozeni(Array.from({ length: n }, (_, i) => Object.assign({ jmeno: 'spojka', nazev: (p.nazev || 'Spojka') + (n > 1 ? ` ${i + 1}` : '') }, d)), 8);
  }
  function exportStl(n) { const k = kusy(n); if (k) app.stahni(KRAB.stlBinarni(k, 'spojky - github_site'), app.jmeno(n > 1 ? `_${n}ks.stl` : '.stl'), 'model/stl'); }
  $('btnStl').addEventListener('click', () => exportStl(app.p.tisk.kusu));
  $('btnStl1').addEventListener('click', () => exportStl(1));
  $('btn3mf').addEventListener('click', () => { const k = kusy(app.p.tisk.kusu); if (k) app.stahni(KRAB.soubor3mf(k, app.p.nazev || 'Spojka'), app.jmeno('.3mf'), 'model/3mf'); });
  const legenda = () => { $('legenda3d').hidden = !(model && nahled.stav.tisk && nahled.stav.previsy); };
  for (const [id, co] of [['tDuchove', 'duchove'], ['tHrany', 'hrany'], ['tTisk', 'tisk'], ['tPrevisy', 'previsy']]) app.prepinac(id, h => { nahled.prepni(co, h); legenda(); });
  app.prepinac('tPravitka', h => nahled.prepni('pravitka', h), true);
  app.prepinac('tRez', h => { nahled.prepni('rez', h); $('legRez').hidden = !h; });

  /* ---------- start ---------- */
  p = app.p;
  app.start({
    manifold: {
      ok: w => { wasm = w; $('stav3d').textContent = ''; prepocitej(); },
      chyba: e => {
        chybaStavby = 'Geometrické jádro (manifold-3d) se nenačetlo: ' + (e && e.message || e) + ' – model ani export nejsou k dispozici.';
        const st = $('stav3d'); st.textContent = chybaStavby; st.classList.add('chyba');
        vypis(S.kontroly(p, S.odvozene(p)).concat([{ uroven: 'chyba', text: chybaStavby, pole: [] }]), S.odvozene(p));
      },
    },
  });
  window.SPOJKY_UI = { get p() { return app.p; }, get model() { return model; }, nahled, zmen, naplnFormular, prepocitej, nahrad, app };
})();

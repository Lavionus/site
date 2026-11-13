/* ============================================================
   panty/ui.js – ovládání stránky Panty a klouby nad společným zapojením gen3d/aplikace.js
   (historie, projekt JSON, Moje…, sdílení #p=, klávesy, manifold).
   Projekt: PANTY.normalizujStav – {nazev, rezim, hodnoty: {pant, cep, kulovy, pruzny}, podlozka…}
   (localStorage webapp_panty_projekt; starší webapp_panty_stav a webapp_panty_sady se jednou převezmou).
   Formulář se staví podle režimu (data-p="hodnoty.<režim>.<klíč>"), vlastní obsluha změn – živě při psaní.
   Kontrola kolizí je generátor krokovaný po kouscích, aby stránka nezamrzla.
   ============================================================ */
/* global G3D, Dialog, TrubkyGui, KRAB */
(function () {
  'use strict';
  const J = window.PANTY, G = window.PANTY_GEO, S = window.PANTY_SCENA;
  const $ = id => document.getElementById(id);
  const f = J.fmt;
  const TOL = 1e-3;
  const REZIMY = Object.keys(J.REZIMY);

  /* ---------- převzetí starších dat (jednou) ---------- */
  try {
    const stary = localStorage.getItem('webapp_panty_stav');
    if (stary && !localStorage.getItem('webapp_panty_projekt')) localStorage.setItem('webapp_panty_projekt', stary);
    const sady = localStorage.getItem('webapp_panty_sady');
    if (sady && !localStorage.getItem('webapp_panty_tvary')) {
      const polozky = J.prevedSady(JSON.parse(sady));
      if (polozky.length) localStorage.setItem('webapp_panty_tvary', JSON.stringify({ verze: 1, polozky }));
    }
  } catch (e) { /* bez úložiště nebo poškozený záznam */ }

  let w = null, model = null, norm = null, analyza = null, beh = 0, tvary = null, rozm = null, scena3d = false, chybaJadra = '';
  let tisk = false, previsy = true, app = null;
  const poloha = { u: 0, az: 0 };

  /* ---------- projekt ---------- */
  function nactiProjekt(text) {
    let j;
    try { j = JSON.parse(text); } catch (e) { throw new Error('Soubor není platný JSON.'); }
    if (j && j.format === 'webapp_panty') {          // starší export návrhu (jen jeden režim)
      if (!J.REZIMY[j.rezim] || typeof j.hodnoty !== 'object') throw new Error('Soubor neobsahuje návrh pantu.');
      const q = G3D.kopie(app.p);
      q.rezim = j.rezim; q.hodnoty[j.rezim] = Object.assign(J.vychozi(j.rezim), j.hodnoty);
      return J.normalizujStav(q);
    }
    if (j && j.format) throw new Error('Soubor není projekt Panty a klouby.');
    return G3D.nactiProjektJson(text, 'panty', J.normalizujStav, 'Panty a klouby');
  }
  function vychozi() {
    const q = J.vychoziStav();
    if (!app) return q;
    const z = G3D.kopie(app.p);                      // jako dřív: výchozí hodnoty jen zvoleného režimu
    z.hodnoty[z.rezim] = q.hodnoty[z.rezim];
    return z;
  }

  app = G3D.aplikace({
    typ: 'panty', nazev: 'Panty a klouby', klic: 'webapp_panty', soubor: 'pant',
    normalizuj: J.normalizujStav, vychozi, nactiProjekt, formular: false,
    popis: q => `${J.REZIMY[q.rezim].kratce} · ${J.MATERIALY[q.hodnoty[q.rezim].material] ? J.MATERIALY[q.hodnoty[q.rezim].material].nazev : ''}`,
    predNaplnenim: q => { if (formRezim !== q.rezim) postavFormular(q.rezim); },
    viditelnost: () => viditelnost(),
    prepocitej: () => prestav(), zpozdeni: 250,
    png: () => (scena3d ? S.snimek() : null), pohled: j => scena3d && S.pohled(j),
    exportStl: () => exportStl(),
    doModelare: () => { const d = dilyTisku(); return d ? { data: KRAB.soubor3mf(d, app.p.nazev || 'Pant'), pripona: '.3mf' } : null; },
    zkratky: { r: 'tRez', h: 'tHrany', m: 'tTisk', p: 'tPrevisy', l: 'tPravitka', t: 'tPruhledne' },
  });
  const P = () => app.p, H = () => app.p.hodnoty[app.p.rezim];

  /* ---------- formulář ---------- */
  const SKUPINY = ['Rozměry', 'Čep a vůle', 'Zacvaknutí', 'Pásek', 'Pohyb', 'Montáž', 'Montážní otvory', 'Tisk'];
  const VPRAVO = ['Montáž', 'Montážní otvory', 'Tisk'];
  let formRezim = null;
  function postavFormular(r) {
    formRezim = r;
    for (const [id, sk] of [['formTvar', SKUPINY.filter(x => !VPRAVO.includes(x))], ['formUpevneni', VPRAVO]]) {
      const html = [];
      for (const s of sk) {
        const defs = J.PARAMETRY.filter(d => d.skupina === s && d.rezimy.includes(r));
        if (!defs.length) continue;
        html.push(`<details class="oddil" data-oddil="${s}" open><summary><span class="oddil-nazev">${s}</span><span class="souhrn" id="sk${SKUPINY.indexOf(s)}"></span></summary><div class="oddil-telo"><div class="mrizka">`);
        for (const d of defs) {
          const cesta = `hodnoty.${r}.${d.klic}`, eid = 'p_' + d.klic;
          const vstup = d.typ === 'vyber'
            ? `<select id="${eid}" data-p="${cesta}" data-typ="text">${d.volby.map(v => `<option value="${v[0]}">${v[1]}</option>`).join('')}</select>`
            : `<div class="vstup"><input type="text" inputmode="decimal" class="mm" id="${eid}" data-p="${cesta}" aria-describedby="s_${d.klic}">${d.j ? `<span class="jedn">${d.j}</span>` : ''}</div>`;
          html.push(`<div class="pole${d.typ === 'vyber' ? ' cela' : ''}" data-klic="${d.klic}"><label for="${eid}">${d.nazev}</label>${vstup}`
            + `<div class="pole-stav" id="s_${d.klic}" aria-live="polite"></div>${d.napoveda ? `<p class="napoveda">${d.napoveda}</p>` : ''}</div>`);
        }
        html.push('</div></div></details>');
      }
      $(id).innerHTML = html.join('');
    }
    $('popisRezimu').textContent = J.REZIMY[r].popis;
    for (const b of document.querySelectorAll('#rezimy button')) b.setAttribute('aria-pressed', String(b.dataset.rezim === r));
  }
  function viditelnost() {
    const h = H();
    const skryj = (klic, ano) => { const el = document.querySelector(`.pole[data-klic="${klic}"]`); if (el) el.hidden = ano; };
    const bez = !(J.cislo(h.otvoru) > 0);
    skryj('otvorD', bez); skryj('zahloubeni', bez); skryj('otvorOdOsy', bez);
    skryj('hlavaSroubuD', bez || h.zahloubeni === 'zadne');
    skryj('hlavaSroubuH', bez || h.zahloubeni !== 'valec');
    for (const k of ['zarezS', 'zarezH']) skryj(k, !(J.cislo(h.zarezu) > 0));
    $('vlastniW').hidden = $('vlastniD').hidden = P().podlozka !== 'vlastni';
  }
  // živě při psaní (kroky se slijí do jednoho kroku zpět), po opuštění pole se ukáže normalizovaná hodnota
  function zmenaPole(e, konec) {
    const el = e.target.closest('[data-p]');
    if (!el) return;
    const cesta = el.dataset.p;
    let h;
    if (el.dataset.typ === 'text') h = el.value;
    else if (el.tagName === 'SELECT' && !/^-?\d+([.,]\d+)?$/.test(el.value)) h = el.value;
    else { h = G3D.ctiCislo(el.value); if (!Number.isFinite(h)) { el.classList.add('spatne'); return; } }
    el.classList.remove('spatne');
    app.zmen(q => G3D.poloz(q, cesta, h), 'pole:' + cesta);
    if (konec) app.naplnFormular();
  }
  for (const id of ['boxTvar', 'boxUpevneni', 'pohyb', 'nabSoubor']) {
    // zachytávací fáze: dojde i událost bez bublání (dispatchEvent(new Event('change')))
    $(id).addEventListener('input', e => { if (e.target.tagName === 'INPUT') zmenaPole(e, false); }, true);
    $(id).addEventListener('change', e => zmenaPole(e, true), true);
  }

  function ukazStavPoli() {
    for (const el of document.querySelectorAll('.pole-stav')) { el.textContent = ''; el.classList.remove('mez'); }
    for (const el of document.querySelectorAll('#formTvar [data-p], #formUpevneni [data-p]')) el.classList.remove('chyba', 'mez');
    const zapis = (seznam, trida) => {
      for (const c of seznam) {
        const s = $('s_' + c.klic), v = $('p_' + c.klic);
        if (!s || !v) continue;
        s.textContent = (s.textContent ? s.textContent + ' ' : '') + c.text;
        if (trida === 'mez' && !v.classList.contains('chyba')) { s.classList.add('mez'); v.classList.add('mez'); }
        if (trida === 'chyba') { s.classList.remove('mez'); v.classList.add('chyba'); v.classList.remove('mez'); }
      }
    };
    zapis(norm.upozorneni, 'mez');
    zapis(norm.chyby, 'chyba');
  }
  function souhrny() {
    const h = norm.p, r = P().rezim, m = J.MATERIALY[h.material];
    const s = (sk, t) => TrubkyGui.souhrn('sk' + SKUPINY.indexOf(sk), t, true);
    if (r === 'pant' || r === 'cep') {
      s('Rozměry', `${f(h.delka)} × 2·${f(h.sirka)} mm, ${h.clanku} článků ⌀ ${f(h.prumerKloubu)}`);
      s('Čep a vůle', `čep ⌀ ${f(h.prumerCepu)}, vůle ${f(h.vuleR)} / ${f(h.vuleA)}`);
      s('Pohyb', `${f(h.uhelMin, 0)}° … ${f(h.uhelMax, 0)}°`);
    } else if (r === 'kulovy') {
      s('Rozměry', `koule ⌀ ${f(h.kouleD)}, hrdlo ⌀ ${f(h.otvorJamkyD)}, krček ⌀ ${f(h.krcekD)}`);
      s('Zacvaknutí', h.zarezu > 0 ? `${h.zarezu} zářezy × ${f(h.zarezS)} mm` : 'bez zářezů');
      s('Montáž', `deska ${f(h.deskaA)} × ${f(h.deskaT)} mm`);
      s('Pohyb', `náklon ${f(h.naklonMax, 0)}°`);
    } else {
      s('Rozměry', `${f(h.delkaP)} × ${f(2 * h.blokL + h.pasekL)} × ${f(h.blokH)} mm`);
      s('Pásek', `${f(h.pasekT)} × ${f(h.pasekL)} mm`);
      s('Pohyb', `ohyb ${f(h.ohybMin, 0)}° … ${f(h.ohybMax, 0)}°`);
    }
    s('Montážní otvory', h.otvoru > 0 ? `${h.otvoru} × ⌀ ${f(h.otvorD)}, ${{ kuzel: 'kuželové', valec: 'válcové', zadne: 'bez zahloubení' }[h.zahloubeni]}` : 'bez otvorů');
    s('Tisk', `${m.nazev} · tryska ${f(h.tryska)} · vrstva ${f(h.vrstva)}`);
    const pod = rozmeryPodlozky();
    TrubkyGui.souhrn('sPodlozka', `${f(pod.sirka, 0)} × ${f(pod.hloubka, 0)} mm, rozestup ${f(P().rozestup, 1)}`, true);
  }

  /* ---------- přestavba modelu ---------- */
  const zprava3d = t => { const z = $('stav3d'); z.textContent = t || ''; };
  function prestav(resetKamery) {
    const p = P();
    if (formRezim !== p.rezim) { postavFormular(p.rezim); app.naplnFormular(); }
    const staryRezim = model && model.rezim;
    if (staryRezim && staryRezim !== p.rezim) { zastavAnimaci(); resetKamery = true; }
    $('rychlost').value = String(p.rychlost);
    norm = J.normalizuj(p.rezim, H());
    ukazStavPoli(); souhrny();
    if (!w) { kontroly(); return; }
    beh++;                                       // zastaví běžící kontrolu kolizí
    if (norm.chyby.length) {
      uvolniTvary(); if (model) model.uvolni(); model = null; analyza = null; rozm = null;
      zprava3d('Opravte parametry označené červeně – s nimi nejde model sestavit.');
      $('kolize').innerHTML = '<p class="chybovy">Model není sestavený: ' + norm.chyby.map(c => c.text).join(' ') + '</p>';
      $('tabDily').tBodies[0].innerHTML = ''; $('exportDilu').innerHTML = '';
      $('podlozkaSvg').innerHTML = ''; $('podlozkaInfo').textContent = '';
      $('btnStlPodlozka').disabled = true;
      $('polohaStav').className = 'stav-souhrn chyba'; $('polohaStav').textContent = 'Model není sestavený.';
      $('vVysledky').innerHTML = G3D.dlazdice('Model', 'nelze sestavit', 'opravte parametry');
      $('sKolize').textContent = '';
      kontroly();
      return;
    }
    uvolniTvary();
    if (model) model.uvolni();
    analyza = null;
    try { model = G.postav(w, p.rezim, norm.p); }
    catch (e) { model = null; zprava3d('Model se nepodařilo sestavit: ' + (e && e.message || e)); kontroly('Model se nepodařilo sestavit: ' + (e && e.message || e)); return; }
    const po = model.pohyb;
    const sl = $('uhel');
    sl.min = po.min; sl.max = po.max; sl.step = 0.5;
    if (!(poloha.u >= po.min && poloha.u <= po.max) || staryRezim !== model.rezim) poloha.u = po.klid;
    const koule = po.typ === 'koule';
    for (const id of ['azimut', 'azimutHodnota', 'azimutPopisek', 'azimutMisto']) $(id).hidden = !koule;
    sl.setAttribute('aria-label', koule ? 'Náklon krčku' : po.typ === 'ohyb' ? 'Úhel ohybu' : 'Úhel otevření');
    sl.value = poloha.u;
    zprava3d(null);
    zajistiTvary();
    ukazPodlozku();
    zobrazModel(!resetKamery && staryRezim === model.rezim);
    $('info3d').textContent = tisk ? 'Tisková poloha: díly tak, jak leží na podložce v exportu.' : koule ? 'Náklon krčku od osy jamky; směr = kam se krček vychýlí.' : po.typ === 'ohyb' ? 'Úhel ohybu pásku (0° = naplocho).' : '0° = listy naplocho, 180° = list B přeložený přes list A.';
    nastavPolohu();
    ukazDily();
    vypisVysledky();
    kontroly();
    spustKontrolu();
  }
  /* 3D: montážní poloha s pohybem, nebo díly na podložce (tisková poloha, převisy barevně). */
  function zobrazModel(zachovat) {
    if (!scena3d || !model) return;
    try {
      if (tisk) {
        const d = dilyTisku(true) || [];
        const box = G3D.obal(d.length ? Float64Array.from(d.flatMap(x => [...x.poz])) : [0, 0, 0]);
        const pseudo = { rezim: 'tisk', dily: d.map(x => ({ barva: x.barva, role: 'pevny' })),
          stred: [(box[0] + box[3]) / 2, (box[1] + box[4]) / 2, (box[2] + box[5]) / 2], velikost: Math.max(box[3] - box[0], box[4] - box[1], box[5] - box[2], 10) };
        S.nastavModel(pseudo, d, zachovat, { tridy: previsy ? d.map(x => G3D.tridyPrevisu(x.poz, x.idx, 45)) : null });
        S.nastavKolizi(null);
      } else S.nastavModel(model, model.dily.map(d => G.sitDilu(d.man)), zachovat);
      S.vykresli();
    } catch (e) { zprava3d('3D náhled nelze zobrazit: ' + (e && e.message || e)); }
    legenda();
  }
  function legenda() {
    const pol = tisk ? model.exporty.filter(e => e.naPodlozku).map(e => `<span><i style="background:${barvaExportu(e.id)}"></i>${e.nazev}</span>`)
      : model.dily.map(d => `<span><i style="background:${d.barva}"></i>${d.nazev}${d.role === 'pohyblivy' ? ' (pohyblivý)' : ''}</span>`);
    if (!tisk && model.pasek) pol.push(`<span><i style="background:${model.pasek.barva}"></i>Pružný pásek</span>`);
    if (!tisk) pol.push('<span><i style="background:var(--barva-kolize)"></i>Průnik (kolize)</span>');
    $('legenda').innerHTML = pol.join('');
    $('legPrevisy').hidden = !(tisk && previsy);
  }

  /* ---------- poloha a živá kolize ---------- */
  let cekaKolize = false;
  function nastavPolohu() {
    if (!model) return;
    const M = model.pohyb.matice(poloha.u, poloha.az);
    $('uhelHodnota').textContent = f(poloha.u, 1) + '°';
    $('azimutHodnota').textContent = f(poloha.az, 0) + '°';
    if (scena3d && !tisk) {
      S.nastavPolohu(M, model.pasek ? v => J.bodOhybu(model.p, poloha.u, v) : null);
      S.vykresli();
    }
    if (!cekaKolize) { cekaKolize = true; requestAnimationFrame(zivaKolize); }
  }
  function zivaKolize() {
    cekaKolize = false;
    if (!model) return;
    const M = model.pohyb.matice(poloha.u, poloha.az);
    const r = G.prunikVPoloze(model, M, { vratSit: true, tolerance: TOL });
    if (scena3d && !tisk) { S.nastavKolizi(r.objem > TOL ? r.site : null); S.vykresli(); }
    const el = $('polohaStav');
    const popis = model.pohyb.typ === 'koule' ? `náklon ${f(poloha.u, 1)}° ve směru ${f(poloha.az, 0)}°` : `úhel ${f(poloha.u, 1)}°`;
    if (r.objem > TOL) { el.className = 'stav-souhrn chyba'; el.innerHTML = `<b class="chyba">Kolize</b> v poloze ${popis}: díly se překrývají, objem průniku ${f(r.objem)} mm³ (červeně).`; }
    else { el.className = 'stav-souhrn ok'; el.textContent = `V poloze ${popis} se díly nepřekrývají.`; }
  }
  $('uhel').addEventListener('input', e => { zastavAnimaci(); poloha.u = +e.target.value; nastavPolohu(); });
  $('azimut').addEventListener('input', e => { zastavAnimaci(); poloha.az = +e.target.value; nastavPolohu(); });

  /* ---------- animace ---------- */
  let anim = 0, animT = 0, animSmer = 1;
  function krokAnimace(t) {
    if (!anim || !model) return;
    const dt = Math.min(0.1, (t - (animT || t)) / 1000); animT = t;
    const po = model.pohyb, rych = +P().rychlost || 1;
    if (po.typ === 'koule') {
      poloha.u = po.max;                       // kužel krajního náklonu
      poloha.az = (poloha.az + 90 * rych * dt) % 360;
      $('azimut').value = poloha.az;
    } else {
      const v = Math.max(30, (po.max - po.min) / 3) * rych;
      poloha.u += animSmer * v * dt;
      if (poloha.u >= po.max) { poloha.u = po.max; animSmer = -1; }
      if (poloha.u <= po.min) { poloha.u = po.min; animSmer = 1; }
    }
    $('uhel').value = poloha.u;
    nastavPolohu();
    anim = requestAnimationFrame(krokAnimace);
  }
  function spustAnimaci() {
    if (anim || !model) return;
    if (tisk) $('tTisk').click();               // pohyb má smysl jen v montážní poloze
    animT = 0; anim = requestAnimationFrame(krokAnimace); $('btnPrehraj').textContent = '❚❚ Zastavit'; $('btnPrehraj').setAttribute('aria-pressed', 'true');
  }
  function zastavAnimaci() { if (anim) cancelAnimationFrame(anim); anim = 0; $('btnPrehraj').textContent = '▶ Přehrát'; $('btnPrehraj').setAttribute('aria-pressed', 'false'); }
  $('btnPrehraj').addEventListener('click', () => (anim ? zastavAnimaci() : spustAnimaci()));
  document.addEventListener('keydown', e => {
    const t = e.target;
    if (document.querySelector('dialog[open]')) return;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.tagName === 'BUTTON' || t.isContentEditable)) return;
    if (e.code === 'Space') { e.preventDefault(); anim ? zastavAnimaci() : spustAnimaci(); }
    const m = /^Digit([1-4])$/.exec(e.code);
    if (m && e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) nastavRezim(REZIMY[+m[1] - 1]);
  });

  /* ---------- kontrola kolizí ---------- */
  async function spustKontrolu() {
    const tok = ++beh, m = model;
    analyza = null;
    $('kolize').innerHTML = '<p class="napoveda">Kontroluji kolize v celém rozsahu pohybu…</p><div class="prubeh"><i id="prubehKolizi"></i></div>';
    $('sKolize').textContent = '…';
    stopa(null);
    const gen = G.analyzaKroky(m, { tolerance: TOL });
    let t = performance.now();
    for (;;) {
      if (tok !== beh) return;
      let r;
      try { r = gen.next(); }
      catch (e) { $('kolize').innerHTML = '<p class="chybovy">Kontrola kolizí selhala: ' + (e && e.message || e) + '</p>'; return; }
      if (r.done) { analyza = r.value; break; }
      if (performance.now() - t > 40) {
        const p = $('prubehKolizi'); if (p) p.style.width = Math.round(r.value.hotovo * 100) + '%';
        await new Promise(ok => setTimeout(ok, 0));
        t = performance.now();
      }
    }
    if (tok !== beh) return;
    ukazKolize();
    kontroly();
  }

  function stopa(a) {
    const el = $('stopa');
    el.innerHTML = '';
    if (!a || a.typ !== '1d') return;
    const roz = a.max - a.min || 1;
    for (const [u0, u1] of a.useky) {
      const i = document.createElement('i');
      const krok = (a.vzorky[1] ? a.vzorky[1].u - a.vzorky[0].u : 0) / 2;
      i.style.left = Math.max(0, (u0 - krok - a.min) / roz * 100) + '%';
      i.style.width = Math.min(100, (u1 - u0 + 2 * krok) / roz * 100) + '%';
      el.appendChild(i);
    }
  }

  const box = (popis, cislo, dalsi, trida) => G3D.dlazdice(popis, cislo, dalsi, trida);
  const mezeraText = x => (x === Infinity || x > 1 - 1e-9 ? '> 1 mm' : f(x) + ' mm');

  function ukazKolize() {
    const a = analyza, p = model.p, rez = model.rezim, out = [];
    stopa(a);
    if (a.kolizeVKlidu) {
      out.push(`<div class="stav-souhrn chyba"><b class="chyba">Díly se překrývají už v klidové poloze</b> (objem průniku ${f(a.objemKlid)} mm³). Zvětšete vůle nebo upravte rozměry – takto by se díly spekly dohromady nebo nešly smontovat.</div>`);
      $('kolize').innerHTML = out.join('');
      $('sKolize').textContent = '✖';
      return;
    }
    if (a.typ === '1d') {
      const jedn = rez === 'pruzny' ? 'ohyb' : 'úhel';
      const celek = a.dosahMin && a.dosahMax;
      $('sKolize').textContent = celek ? '✔' : `${f(a.volnyOd, 0)}…${f(a.volnyDo, 0)}°`;
      out.push(`<div class="stav-souhrn ${celek ? 'ok' : 'mez'}">${celek
        ? `Celý požadovaný rozsah ${f(a.min, 1)}° až ${f(a.max, 1)}° je bez kolize.`
        : `Volný pohyb jen od ${f(a.volnyOd, 1)}° do ${f(a.volnyDo, 1)}° – mimo něj se díly srazí (červené úseky pod posuvníkem).`}</div>`);
      const boxy = [];
      boxy.push(box('Volný rozsah', `${f(a.volnyOd, 1)}° … ${f(a.volnyDo, 1)}°`, `požadováno ${f(a.min, 0)}° … ${f(a.max, 0)}°`, celek ? 'dobre' : 'mez'));
      if (!a.dosahMax) boxy.push(box('První dotyk (+)', f(a.volnyDo, 1) + '°', `${jedn} při zavírání`, 'mez'));
      if (!a.dosahMin) boxy.push(box('První dotyk (−)', f(a.volnyOd, 1) + '°', `${jedn} opačným směrem`, 'mez'));
      const malaKlid = rez === 'pant' && a.mezeraKlid < 0.25;
      boxy.push(box('Mezera v klidu', mezeraText(a.mezeraKlid), rez === 'pant' ? 'při tisku v místě' : 'nejmenší vzdálenost dílů', malaKlid ? 'spatne' : ''));
      boxy.push(box('Nejmenší mezera v pohybu', mezeraText(a.nejmensiMezera), 've vzorcích volného rozsahu'));
      if (rez === 'pant' || rez === 'cep') {
        const t = J.teorieMezePantu(p);
        if (t.platne) boxy.push(box('Vzorec: dotyk listů', `${f(t.min, 1)}° / ${f(t.max, 1)}°`, 'rohy listů (viz nápověda); síť se liší jen náhradou kružnic mnohoúhelníky'));
      } else if (rez === 'pruzny') {
        const th = J.teorieOhybu(p), s = J.pruznyPasek(p, Math.max(Math.abs(a.min), Math.abs(a.max)));
        boxy.push(box('Vzorec: dotyk bloků', f(th, 1) + '°', 'θ = L / (H − t/2)'));
        const tr = s.eps > s.epsKr ? 'spatne' : s.eps > s.epsOpak ? 'mez' : 'dobre';
        boxy.push(box('Přetvoření pásku', f(s.eps * 100) + ' %', `při ${f(Math.max(Math.abs(a.min), Math.abs(a.max)), 0)}°; opakovaně do ${f(s.epsOpak * 100)} %, jednorázově do ${f(s.epsKr * 100)} % (${J.MATERIALY[p.material].nazev})`, tr));
        boxy.push(box('Moment ohybu', f(s.M) + ' N·mm', `orientačně při ${f(Math.max(Math.abs(a.min), Math.abs(a.max)), 0)}°, E = ${f(J.MATERIALY[p.material].E, 0)} MPa`));
      }
      out.push(`<div class="vysledky">${boxy.join('')}</div>`);
      if (malaKlid) out.push(`<p class="chybovy">Mezera mezi díly v klidové poloze je jen ${f(a.mezeraKlid)} mm – při tisku v místě se díly mohou spojit.</p>`);
      out.push(grafPrubehu(a));
    } else {
      const ok = a.celyRozsah;
      $('sKolize').textContent = ok ? '✔' : f(a.volnyNaklon, 0) + '°';
      out.push(`<div class="stav-souhrn ${ok ? 'ok' : 'mez'}">${ok
        ? `Požadovaný náklon ${f(a.pozadovano, 0)}° je bez kolize ve všech směrech.`
        : `Ve všech směrech je volný náklon jen ${f(a.volnyNaklon, 1)}° (nejhorší směr ${f(a.nejhorsiAzimut, 0)}°); požadováno ${f(a.pozadovano, 0)}°.`}</div>`);
      const boxy = [];
      boxy.push(box('Volný náklon všemi směry', f(a.volnyNaklon, 1) + '°', `požadováno ${f(a.pozadovano, 0)}°`, ok ? 'dobre' : 'mez'));
      const maxi = Math.max(...a.azimuty.map(x => (x.mez === null ? a.pozadovano : x.mez)));
      boxy.push(box('Největší náklon', f(maxi, 1) + '°', 'v nejvýhodnějším směru (např. do zářezu)'));
      boxy.push(box('Vzorec bez zářezů', f(J.teorieNaklonu(p), 1) + '°', 'krček narazí na hranu hrdla'));
      boxy.push(box('Mezera v klidu', mezeraText(a.mezeraKlid), 'koule v jamce'));
      const z = J.zacvaknuti(p);
      if (z) boxy.push(box('Přetvoření při zacvaknutí', f(z.eps * 100) + ' %', `ε = 1,5·y·h/l², mez ${f(z.epsKr * 100)} % (${J.MATERIALY[p.material].nazev})`, z.eps > z.epsKr ? 'spatne' : z.eps > 0.7 * z.epsKr ? 'mez' : 'dobre'));
      out.push(`<div class="vysledky">${boxy.join('')}</div>`);
      out.push(grafPolarni(a));
    }
    $('kolize').innerHTML = out.join('');
  }

  /* graf průniku podle úhlu (1D): sloupce = objem průniku (log), zelená = volno */
  function grafPrubehu(a) {
    const W = 600, Hh = 90, x0 = 30, x1 = W - 8, y0 = 10, y1 = Hh - 22, roz = a.max - a.min || 1;
    const X = u => x0 + (u - a.min) / roz * (x1 - x0);
    const maxV = Math.max(1e-3, ...a.vzorky.map(s => s.objem));
    const sirka = Math.max(1, (x1 - x0) / a.vzorky.length);
    const pruhy = a.vzorky.map(s => {
      if (!s.kolize) return `<rect x="${(X(s.u) - sirka / 2).toFixed(1)}" y="${y1 - 3}" width="${sirka.toFixed(1)}" height="3" fill="var(--ok)"/>`;
      const h = Math.max(3, (Math.log10(1 + s.objem) / Math.log10(1 + maxV)) * (y1 - y0));
      return `<rect x="${(X(s.u) - sirka / 2).toFixed(1)}" y="${(y1 - h).toFixed(1)}" width="${sirka.toFixed(1)}" height="${h.toFixed(1)}" fill="var(--danger)"/>`;
    }).join('');
    const znacky = [];
    const krokZ = roz > 200 ? 90 : roz > 90 ? 45 : roz > 40 ? 15 : 5;
    for (let u = Math.ceil(a.min / krokZ) * krokZ; u <= a.max + 1e-9; u += krokZ)
      znacky.push(`<line x1="${X(u)}" x2="${X(u)}" y1="${y1}" y2="${y1 + 4}" stroke="var(--text-muted)"/><text x="${X(u)}" y="${Hh - 6}" text-anchor="middle">${f(u, 0)}°</text>`);
    return `<svg class="graf" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Objem průniku dílů podle úhlu: zelená = bez kolize, červená = kolize">
      <line x1="${x0}" x2="${x1}" y1="${y1}" y2="${y1}" stroke="var(--border-strong)"/>${pruhy}${znacky.join('')}
      <text x="${x0}" y="9">objem průniku (log) – zeleně bez kolize</text></svg>`;
  }
  /* polární graf mezního náklonu podle směru */
  function grafPolarni(a) {
    const R = 80, c = 100, max = Math.max(a.pozadovano, 1);
    const bod = (az, nak) => { const r = R * Math.min(1, nak / max), t = az * Math.PI / 180; return [c + r * Math.cos(t), c - r * Math.sin(t)]; };
    const body = a.azimuty.map(x => bod(x.az, x.mez === null ? a.pozadovano : x.mez));
    const kruhy = [0.25, 0.5, 0.75, 1].map(k => `<circle cx="${c}" cy="${c}" r="${R * k}" fill="none" stroke="var(--border)"/><text x="${c}" y="${c + R * k - 3}" text-anchor="middle">${f(max * k, 0)}°</text>`).join('');
    return `<svg class="graf" viewBox="-24 -4 248 206" style="max-width:300px;margin-inline:auto" role="img" aria-label="Mezní náklon podle směru">
      ${kruhy}<polygon points="${body.map(b => b.map(x => x.toFixed(1)).join(',')).join(' ')}" fill="var(--accent-soft)" stroke="var(--accent)" stroke-width="1.5"/>
      <text x="${c + R + 3}" y="${c + 4}">0°</text><text x="${c}" y="${c - R - 4}" text-anchor="middle">90°</text><text x="${c - R - 3}" y="${c + 4}" text-anchor="end">180°</text>
      <text x="2" y="196">mezní náklon podle směru</text></svg>`;
  }

  /* ---------- kontroly (záložka Kontrola + odznak) ---------- */
  function kontroly(chybaStavby) {
    const r = P().rezim, pole = k => [`hodnoty.${r}.${k}`];
    const Hl = [];
    for (const c of norm.chyby) Hl.push({ uroven: 'chyba', text: 'Chyba parametrů: ' + c.text, pole: pole(c.klic) });
    for (const c of norm.upozorneni) Hl.push({ uroven: 'varovani', text: c.text, pole: pole(c.klic) });
    for (const u of J.upozorneniTisku(r, norm.p)) Hl.push({ uroven: u.uroven, text: `${u.nadpis}: ${u.text}` });
    if (analyza && model) {
      const a = analyza;
      if (a.kolizeVKlidu) Hl.push({ uroven: 'chyba', text: `Díly se překrývají už v klidové poloze (průnik ${f(a.objemKlid)} mm³) – zvětšete vůle.`, pole: pole(r === 'kulovy' ? 'vuleK' : r === 'pruzny' ? 'pasekL' : 'vuleR') });
      else if (a.typ === '1d' && !(a.dosahMin && a.dosahMax)) Hl.push({ uroven: 'varovani', text: `Kolize v rozsahu pohybu: volně jen ${f(a.volnyOd, 1)}° až ${f(a.volnyDo, 1)}° (záložka Kolize).`, pole: pole(r === 'pruzny' ? 'ohybMax' : 'uhelMax') });
      else if (a.typ === 'koule' && !a.celyRozsah) Hl.push({ uroven: 'varovani', text: `Kolize v rozsahu pohybu: volný náklon jen ${f(a.volnyNaklon, 1)}° (záložka Kolize).`, pole: pole('naklonMax') });
      if (a.typ === '1d' && r === 'pant' && !a.kolizeVKlidu && a.mezeraKlid < 0.25) Hl.push({ uroven: 'varovani', text: `Mezera v klidové poloze jen ${f(a.mezeraKlid)} mm – při tisku v místě se díly mohou spojit.`, pole: pole('vuleR') });
    }
    if (model && rozm && rozm.nevejde.length) Hl.push({ uroven: 'varovani', text: `Na podložku se nevejde: ${rozm.nevejde.map(id => model.exporty.find(e => e.id === id).nazev).join(', ')}.`, pole: ['podlozka'] });
    Hl.push({ uroven: 'info', text: 'Neověřeno pro bezpečnostně kritické použití. ' + J.NEOVERENO });
    app.hlaseni(Hl, { chybaStavby: chybaStavby || chybaJadra, boxy: ['boxTvar', 'boxUpevneni'] });
  }

  /* ---------- výsledky ---------- */
  function vypisVysledky() {
    const mat = J.MATERIALY[model.p.material], tisknout = model.exporty.filter(e => e.naPodlozku);
    const V = tisknout.reduce((s, e) => s + e.man.volume(), 0);
    const od = G3D.odhadTisku(V, mat.hustota, { dilu: tisknout.length });
    let h = '';
    for (const e of tisknout) { const t = tvary[e.id]; h += box(e.nazev, `${f(t.sirka, 1)} × ${f(t.hloubka, 1)} × ${f(t.vyska, 1)} mm`, 'rozměr v tiskové poloze'); }
    h += box('Objem', `${f(V / 1000, 2)} cm³`, `${tisknout.length} ${tisknout.length === 1 ? 'díl' : tisknout.length < 5 ? 'díly' : 'dílů'} k tisku`);
    h += box('Hmotnost', `${f(od.g, od.g < 10 ? 1 : 0)} g`, `${mat.nazev}, plný díl (při 30 % výplni zhruba ${f(od.g * 0.55, 0)} g)`);
    h += box('Filament', `${f(od.metru, 2)} m`, 'průměr 1,75 mm, plný díl');
    h += box('Doba tisku', `≈ ${od.minut < 60 ? od.minut + ' min' : f(od.minut / 60, 1) + ' h'}`, 'hrubý odhad');
    const po = model.pohyb;
    h += box(po.typ === 'koule' ? 'Požadovaný náklon' : 'Rozsah pohybu', po.typ === 'koule' ? `${f(po.max, 0)}°` : `${f(po.min, 0)}° … ${f(po.max, 0)}°`, 'kontrola kolizí v záložce Kolize');
    $('vVysledky').innerHTML = h;
  }

  /* ---------- díly a STL ---------- */
  function uvolniTvary() {
    if (tvary) for (const t of Object.values(tvary)) try { t.man.delete(); } catch (e) { /* už uvolněno */ }
    tvary = null;
  }
  function zajistiTvary() {
    if (tvary || !model) return tvary;
    tvary = {};
    for (const e of model.exporty) tvary[e.id] = G.tiskovyTvar(e);
    return tvary;
  }
  function ukazDily() {
    const mat = J.MATERIALY[model.p.material];
    $('tabDily').tBodies[0].innerHTML = model.exporty.map(e => {
      const t = tvary[e.id], V = e.man.volume();
      return `<tr><td><span class="tecka" style="background:${barvaExportu(e.id)}"></span>${e.nazev}<span class="pozn-k">${e.poznamka}</span></td>
        <td class="cis">${f(t.sirka, 1)} × ${f(t.hloubka, 1)} × ${f(t.vyska, 1)} mm</td>
        <td class="cis">${f(V / 1000)} cm³</td><td class="cis">${f(V / 1000 * mat.hustota, 1)} g</td>
        <td><button type="button" class="tl" data-stl="${e.id}">STL</button></td></tr>`;
    }).join('');
    $('exportDilu').innerHTML = model.exporty.map(e => `<button class="pol" role="menuitem" data-stl="${e.id}">⬇ STL – ${e.nazev}<span class="pozn">jen tento díl</span></button>`).join('');
  }
  function barvaExportu(id) {
    const d = model.dily.find(x => x.id === id);
    return d ? d.barva : (model.exporty.length === 1 || id === 'celek' ? model.dily[0].barva : '#9aa4b0');
  }
  const nazevSouboru = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '').toLowerCase();
  function exportujSit(man, nazev, jmeno) {
    const sit = G.sitDilu(man), k = J.zkontrolujSit(sit);
    if (!k.vodotesna || !(k.objem > 0)) { Dialog.chyba('Síť dílu není uzavřená – export se nepovedl. Zkuste změnit parametry.'); return null; }
    const buf = J.stlBinarni(sit, nazev);
    app.stahni(buf, jmeno || nazevSouboru(`${J.REZIMY[model.rezim].kratce}_${nazev}`) + '.stl', 'model/stl');
    return { sit, kontrola: k, bajtu: buf.byteLength };
  }
  function stlDilu(e) {
    const b = e.target.closest('[data-stl]');
    if (!b || !model) return;
    zajistiTvary();
    const ex = model.exporty.find(x => x.id === b.dataset.stl);
    if (exportujSit(tvary[ex.id].man, ex.nazev)) Dialog.info('STL uloženo: ' + ex.nazev);
  }
  $('tabDily').addEventListener('click', stlDilu);
  $('exportDilu').addEventListener('click', stlDilu);
  /* Díly na podložce v tiskové poloze (sítě posunuté podle rozmístění) – 3MF, Modelář, tisková poloha v náhledu. */
  function dilyTisku(tise) {
    if (!model || !rozm || !rozm.umisteni.length) { if (!tise) Dialog.chyba(w ? 'Model není sestavený nebo se nic nevejde na podložku.' : 'Výpočetní jádro se ještě načítá.'); return null; }
    zajistiTvary();
    return rozm.umisteni.map(u => {
      const t = tvary[u.id], ex = model.exporty.find(e => e.id === u.id), s = G.sitDilu(t.man);
      const poz = new Float64Array(s.poz.length);
      for (let i = 0; i < poz.length; i += 3) {
        const x = s.poz[i], y = s.poz[i + 1];
        poz[i] = u.otoceno ? u.x + t.hloubka - y : u.x + x; poz[i + 1] = u.otoceno ? u.y + x : u.y + y; poz[i + 2] = s.poz[i + 2];
      }
      return { nazev: ex.nazev, jmeno: ex.id, poz, idx: s.idx, barva: barvaExportu(u.id) };
    });
  }
  function exportStl() {
    if (!model || !rozm || !rozm.umisteni.length) { dilyTisku(); return; }
    const m = G.podlozkaManifold(w, zajistiTvary(), rozm);
    if (!m) return;
    try { exportujSit(m, 'podlozka', app.jmeno('.stl')); } finally { m.delete(); }
  }
  $('btnStl').addEventListener('click', exportStl);
  $('btnStlPodlozka').addEventListener('click', exportStl);
  $('btn3mf').addEventListener('click', () => { const d = dilyTisku(); if (d) app.stahni(KRAB.soubor3mf(d, app.p.nazev || 'Pant'), app.jmeno('.3mf'), 'model/3mf'); });

  /* ---------- podložka ---------- */
  for (const [id, nazev] of J.PODLOZKY) $('podlozka').insertAdjacentHTML('beforeend', `<option value="${id}">${nazev}</option>`);
  function rozmeryPodlozky() {
    const p = P(), pr = J.PODLOZKY.find(x => x[0] === p.podlozka) || J.PODLOZKY[0];
    if (pr[0] === 'vlastni') {
      const W = J.cislo(p.podlozkaW), D = J.cislo(p.podlozkaD);
      return { sirka: Number.isFinite(W) && W >= 20 ? Math.min(W, 2000) : 220, hloubka: Number.isFinite(D) && D >= 20 ? Math.min(D, 2000) : 220 };
    }
    return { sirka: pr[2], hloubka: pr[3] };
  }
  function ukazPodlozku() {
    if (!model) return;
    const pod = rozmeryPodlozky(), roz = Math.max(0, Math.min(50, J.cislo(P().rozestup) || 0));
    const polozky = model.exporty.filter(e => e.naPodlozku).map(e => ({ id: e.id, sirka: tvary[e.id].sirka, hloubka: tvary[e.id].hloubka }));
    rozm = J.rozmisti(polozky, pod, roz);
    const W = pod.sirka, D = pod.hloubka;
    const mriz = [];
    for (let x = 10; x < W; x += 10) mriz.push(`<line class="mriz" x1="${x}" x2="${x}" y1="0" y2="${D}"/>`);
    for (let y = 10; y < D; y += 10) mriz.push(`<line class="mriz" x1="0" x2="${W}" y1="${y}" y2="${y}"/>`);
    const dily = rozm.umisteni.map(u => {
      const t = tvary[u.id], ex = model.exporty.find(e => e.id === u.id);
      const cesta = t.obrys.map(poly => 'M' + poly.map(([x, y]) => {
        const [px, py] = u.otoceno ? [t.hloubka - y, x] : [x, y];
        return `${(u.x + px).toFixed(2)},${(D - (u.y + py)).toFixed(2)}`;
      }).join('L') + 'Z').join('');
      const cx = u.x + u.sirka / 2, cy = D - (u.y + u.hloubka / 2);
      return `<path class="dil" d="${cesta}" fill="${barvaExportu(u.id)}"><title>${ex.nazev}</title></path><text x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" style="paint-order:stroke;stroke:var(--bg-input);stroke-width:1.6px">${ex.nazev}</text>`;
    }).join('');
    $('podlozkaSvg').innerHTML = `<svg class="podlozka-svg" viewBox="-2 -2 ${W + 4} ${D + 4}" role="img" aria-label="Rozmístění dílů na podložce ${W} × ${D} mm">
      <rect class="deska" x="0" y="0" width="${W}" height="${D}" rx="3"/>${mriz.join('')}${dily}</svg>`;
    const info = [`Podložka ${f(W, 0)} × ${f(D, 0)} mm, rozestup ${f(roz, 1)} mm, obsazeno ${f(rozm.vyuziti * 100, 1)} % plochy.`];
    if (rozm.nevejde.length) info.push(`<span class="chybovy">Nevejde se: ${rozm.nevejde.map(id => model.exporty.find(e => e.id === id).nazev).join(', ')} – zmenšete díl nebo zvolte větší podložku.</span>`);
    $('podlozkaInfo').innerHTML = info.join(' ');
    $('btnStlPodlozka').disabled = !rozm.umisteni.length;
    $('sTisk').textContent = `${rozm.umisteni.length} ${rozm.umisteni.length === 1 ? 'díl' : rozm.umisteni.length < 5 ? 'díly' : 'dílů'}`;
  }

  /* ---------- režimy ---------- */
  function nastavRezim(r) {
    if (!J.REZIMY[r] || r === P().rezim) return;
    app.zmen(q => { q.rezim = r; });
    app.naplnFormular();
  }
  for (const b of document.querySelectorAll('#rezimy button')) b.addEventListener('click', () => nastavRezim(b.dataset.rezim));
  REZIMY.forEach((r, i) => {
    const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
    b.innerHTML = `${J.REZIMY[r].nazev}<span class="pozn">Shift+${i + 1}</span>`;
    b.addEventListener('click', () => nastavRezim(r));
    $('seznamPredvoleb').appendChild(b);
  });

  /* ---------- zobrazení ---------- */
  try { S.init($('platno3d')); scena3d = true; }
  catch (e) { scena3d = false; console.error(e); zprava3d('3D náhled nelze zobrazit (' + (e && e.message || e) + '). Kontrola kolizí, export a rozmístění fungují dál.'); }
  app.prepinac('tRez', h => scena3d && S.nastavVolby({ rez: h }));
  app.prepinac('tPruhledne', h => scena3d && S.nastavVolby({ pruhledne: h }));
  app.prepinac('tHrany', h => scena3d && S.nastavVolby({ hrany: h }), true);
  app.prepinac('tPravitka', h => scena3d && S.nastavVolby({ pravitka: h }), true);
  app.prepinac('tPrevisy', h => { previsy = h; if (tisk) zobrazModel(true); }, true);
  app.prepinac('tTisk', h => {
    tisk = h;
    if (h) zastavAnimaci();
    $('pohyb').classList.toggle('vypnuto', h);
    if (model) { zobrazModel(false); if (!h) { nastavPolohu(); } $('info3d').textContent = h ? 'Tisková poloha: díly tak, jak leží na podložce v exportu.' : ''; }
  });
  TrubkyGui.pripoj({ klic: 'webapp_panty_gui', pohled: j => scena3d && S.pohled(j) });

  /* ---------- start ---------- */
  $('neovereno').textContent = J.NEOVERENO;
  $('platno3d').addEventListener('scenachyba', e => zprava3d(e.detail));
  $('platno3d').addEventListener('scenaobnovena', () => { zprava3d(null); if (model) prestav(); });
  app.start({
    manifold: {
      ok: m => { w = m; prestav(true); },
      chyba: e => {
        chybaJadra = 'Výpočetní jádro (manifold-3d) se nepodařilo načíst: ' + (e && e.message || e);
        zprava3d(chybaJadra); $('kolize').innerHTML = '<p class="chybovy">Bez výpočetního jádra nejde sestavit model.</p>'; kontroly();
      },
    },
  });

  /* rozhraní pro testy */
  window.PANTY_UI = {
    get stav() { return app.p; }, nastavRezim, prestav, app,
    nastav(klic, hodnota) { app.zmen(q => { q.hodnoty[q.rezim][klic] = hodnota; }); app.naplnFormular(); },
    poloha(u, az) { zastavAnimaci(); poloha.u = u; poloha.az = az || 0; $('uhel').value = u; $('azimut').value = poloha.az; nastavPolohu(); },
    model: () => model, analyza: () => analyza, norm: () => norm, rozmisteni: () => rozm, dilyTisku: () => dilyTisku(true),
    pripraveno: () => !!w && !!model
  };
})();

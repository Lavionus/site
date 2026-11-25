/* Dózy a víčka se závitem – ovládání stránky nad společným zapojením gen3d/aplikace.js
   (tady jen to, co je pro dózy zvláštní: druh dílu, databáze hrdel, viditelnost polí, souhrny, výsledky, výpočty, kusovník, výkres, export).
   Náhled = KNOF_NAHLED. Režimy: sestava (sešroubováno, u víčka se stávajícím hrdlem), rozpad (díly nad sebou), tisk (díly na podložce). */
/* global DOZY, DOZY_MECH, DOZY_VYK, KNOF_NAHLED, KRAB, G3D, Dialog, TrubkyGui */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const fmt = DOZY.fmt, N = DOZY.NAZVY;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  let p, o = null, wasm = null, model = null, mech = null, chybaStavby = '', chybaJadra = '';
  const stavZobr = { rezim: 'sestava', kontext: true };
  const nahled = KNOF_NAHLED.vytvorNahled($('platno'));

  const app = G3D.aplikace({
    typ: 'dozy_zavit', nazev: 'Dózy a víčka se závitem', klic: 'webapp_dozy_zavit', soubor: 'doza',
    normalizuj: DOZY.normalizuj, vychozi: () => DOZY.predvolba('doza250'),
    ulozProjekt: DOZY.ulozProjekt, nactiProjekt: DOZY.nactiProjekt, popis: DOZY.popis,
    vezmi: DOZY.vezmi, poloz: DOZY.poloz,
    viditelnost: () => viditelnost(),
    prepocitej: () => prepocitej(),
    png: () => nahled.png(), pohled: j => nahled.pohled(j),
    exportStl: () => exportVse('stl'),
    doModelare: () => (lzeExport() ? { data: KRAB.soubor3mf(kusy(), app.p.nazev || 'Dóza'), pripona: '.3mf' } : null),
    zkratky: { r: 'tRez', h: 'tHrany', m: 'tTisk', p: 'tPrevisy', l: 'tPravitka', c: 'tKontext', x: 'tRozpad' },
    zmenaTematu: () => prepocitej(),
  });

  /* ---------- nabídky formuláře ---------- */
  const moznosti = (sel, obj) => { sel.innerHTML = Object.entries(obj).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join(''); };
  moznosti($('f_zadani'), N.zadani);
  moznosti($('f_dopocet'), N.dopocet);
  moznosti($('f_plast'), N.plast);
  moznosti($('f_uchop'), N.uchop);
  moznosti($('f_tes'), N.tesneni);
  moznosti($('f_material'), Object.fromEntries(Object.entries(DOZY.MATERIALY).map(([k, m]) => [k, m.nazev])));
  $('f_rozmer').innerHTML = '<option value="doza">podle dózy (průměr + stěna)</option>'
    + `<optgroup label="Hrdla – ${DOZY.OVERIT} (stav ${DOZY.AKTUALIZACE})">` + DOZY.HRDLA.map(h => `<option value="${h.id}">${esc(h.nazev)} – Ø ${fmt(h.d, 2)} × ${fmt(h.p, 2)}</option>`).join('') + '</optgroup>'
    + '<option value="vlastni">vlastní rozměr…</option>';
  /** Závit podle dózy → vlastní pole (aby se při přechodu na „vlastní“ nebo jiný druh rozměr nezměnil). */
  function prevezmiZavit(q) {
    const Z = DOZY.odvozene(q).Z, r2 = x => Math.round(x * 100) / 100;
    Object.assign(q.zavit, { d: r2(Z.d), p: Z.p, chodu: Z.chodu, h: Z.hZad, vrchol: Z.soumerny ? 0 : Z.vrchol, vyska: Z.vyska, otvor: r2(Z.otvor) });
  }
  // rozměr závitu si stránka obsluhuje sama: při volbě „vlastní“ se do polí převezme dosavadní závit
  $('f_rozmer').addEventListener('change', e => {
    const v = e.target.value;
    app.zmen(q => { if (v === 'vlastni') prevezmiZavit(q); q.zavit.rozmer = v; });
    app.naplnFormular();
  });
  document.querySelectorAll('#paletaDruhu button').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.dlazdice === app.p.druh) return;
    app.zmen(q => {
      const druh = b.dataset.dlazdice;
      // víčko na hrdlo začíná na PET láhvi; hrdlo a zátka na vlastním rozměru převzatém z dózy
      if (q.druh === 'doza' && druh === 'vzorek') q.zavit.rozmer = 'doza';        // vzorek k právě navržené dóze
      if (q.zavit.rozmer === 'doza' && druh === 'vicko') q.zavit.rozmer = 'pco1881';
      if (q.zavit.rozmer === 'doza' && (druh === 'hrdlo' || druh === 'zatka')) { prevezmiZavit(q); q.zavit.rozmer = 'vlastni'; }
      q.druh = druh;
    });
    app.naplnFormular();
  }));

  const seznam = a => (a || '').split(/\s+/).filter(Boolean);
  function viditelnost() {
    p = app.p;
    const od = DOZY.odvozene(p), Z = od.Z, d = p.doza, vk = p.vicko;
    const zdroj = Z.db ? 'db' : Z.zdroj;
    $('f_rozmer').value = p.zavit.rozmer;
    document.querySelectorAll('[data-druh],[data-nedruh],[data-zdroj],[data-objem],[data-ma],[data-plast],[data-uchop],[data-tesneni],[data-duta],[data-sada]').forEach(el => {
      const a = el.dataset;
      let vid = true;
      if (a.druh && !seznam(a.druh).includes(p.druh)) vid = false;
      if (a.nedruh && seznam(a.nedruh).includes(p.druh)) vid = false;
      if (a.zdroj && !seznam(a.zdroj).includes(zdroj)) vid = false;
      if (a.objem && d.zadani !== 'objem') vid = false;
      if (a.ma && d.zadani === 'objem' && d.dopocet === a.ma) vid = false;
      if (a.plast && d.plast !== a.plast) vid = false;
      if (a.uchop && vk.uchop !== a.uchop) vid = false;
      if (a.tesneni && vk.tesneni !== a.tesneni) vid = false;
      if (a.duta && !p.zatka.duta) vid = false;
      if (a.sada && !p.vzorek.sada) vid = false;
      el.hidden = !vid;
    });
    $('nadpisDilu').textContent = { doza: 'Víčko a těsnění', vicko: 'Víčko a těsnění', hrdlo: 'Hrdlo', zatka: 'Zátka', vzorek: 'Vzorek' }[p.druh];
    $('nVicko').textContent = p.druh === 'zatka' ? 'Úchop hlavy' : 'Víčko';
    $('napDoza').textContent = p.druh === 'doza'
      ? `Dutina Ø ${fmt(2 * od.Ri, 1)} × ${fmt(od.hv, 1)} mm = ${fmt(od.objem, 0)} ml po okraj. Vně Ø ${fmt(2 * od.Ro, 1)} × ${fmt(od.H, 1)} mm, s víčkem Ø ${fmt(2 * od.RLmax, 1)} × ${fmt(od.top, 1)} mm.`
      : `Závit se počítá z dózy: vnější Ø ${fmt(Z.d, 2)} mm = vnitřní průměr + 2 × stěna + 2 × hloubka závitu.`;
    $('napZavit').innerHTML = `<span>Závit Ø ${fmt(Z.d, 2)} × ${fmt(Z.p, 2)} mm, hloubka ${fmt(Z.h, 2)} mm, hřbet ${fmt(Z.wc, 2)} mm.</span> `
      + (Z.chodu > 1 ? `<span>Počet chodů ${Z.chodu} – stoupání ${fmt(Z.lead, 2)} mm na otáčku.</span> ` : '')
      + (p.druh === 'hrdlo' || p.druh === 'zatka' ? '<span>Vnější závit se tiskne ve jmenovitém rozměru.</span>' : `<span>Vnitřní závit Ø ${fmt(2 * od.PI.rMaj, 2)} / ${fmt(2 * (od.PI.rMaj - Z.h), 2)} mm, zuby se překrývají o ${fmt(od.zaber, 2)} mm.</span>`)
      + (Z.db ? ` <span>Rozměry hrdla jsou ${DOZY.OVERIT} (stav ${DOZY.AKTUALIZACE}).</span>` : '');
    if (p.druh === 'doza' || p.druh === 'vicko') {
      $('napVicko').textContent = `Víčko Ø ${fmt(2 * od.RLmax, 1)} × ${fmt(od.top - od.zOpen, 1)} mm, zavře se na ${fmt(od.otacek, 2)} otáčky (${fmt(od.otacek * 360, 0)}°).`;
      $('napTesneni').textContent = od.oring ? `Čelní drážka Ø ${fmt(2 * od.oring.rg0, 1)} / ${fmt(2 * od.oring.rg1, 1)} mm, hloubka ${fmt(od.oring.hg, 2)} mm ve stropu víčka.`
        : od.ploche ? `Ploché těsnění Ø ${fmt(od.ploche.D, 1)} / ${fmt(od.ploche.d, 1)} × ${fmt(od.ploche.t, 1)} mm ve víčku.` : 'Bez těsnění dosedá strop víčka přímo na okraj hrdla – na sypké věci stačí.';
    } else $('napVicko').textContent = '';
    if (p.druh === 'hrdlo') $('napHrdlo').textContent = `Hrdlo Ø ${fmt(Z.d, 2)} s otvorem Ø ${fmt(2 * od.ri, 1)} mm, příruba Ø ${fmt(2 * od.Rp, 1)} mm, výška ${fmt(od.H, 1)} mm. Víčko k němu: druh Víčko na hrdlo se stejným vlastním rozměrem.`;
    if (p.druh === 'vzorek') $('napVzorek').textContent = od.vule.length > 1 ? `Kroužky vysoké ${fmt(od.hk, 1)} mm s vůlí ${od.vule.map(x => fmt(x, 2)).join(' / ')} mm mají 1, 2 a 3 zářezy. Zkuste je i na skutečném hrdle.`
      : `Kroužek vysoký ${fmt(od.hk, 1)} mm s vůlí ${fmt(od.vule[0], 2)} mm. Zkuste ho i na skutečném hrdle.`;
  }

  /* ---------- přepočet ---------- */
  function prepocitej() {
    p = app.p;
    document.querySelectorAll('#paletaDruhu button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.dlazdice === p.druh)));
    nahled.barvy(css('--border-strong'), css('--border'), css('--text'));
    let H = DOZY.kontroly(p);
    o = DOZY.odvozene(p);
    model = null; chybaStavby = chybaJadra;
    const chyby = H.some(h => h.uroven === 'chyba');
    if (wasm && !chyby) {
      try {
        model = DOZY.postav(wasm, p);
        o = model.o;
        H = H.concat(DOZY.kontrolyModelu(p, model));
      } catch (e) { chybaStavby = 'Model nelze sestavit: ' + (e && e.message || e); }
    } else if (wasm) chybaStavby = 'Model nelze sestavit – opravte chybu v záložce Kontrola.';
    mech = DOZY_MECH.spocitej(p, o, model);
    H = H.concat(mech.hlaseni);
    const st = $('stav3d');
    st.textContent = wasm || chybaJadra ? chybaStavby : 'Načítám geometrické jádro…';
    st.classList.toggle('chyba', !!chybaStavby);
    zobraz(false);
    app.hlaseni(H, { chybaStavby, boxy: ['boxTvar', 'boxDil'] });
    souhrny();
    vypisVysledky();
    vypisMechaniku();
    vypisTisk();
    vypisKusovnik();
    exportDilu();
    if (!$('vykresNahled').closest('[hidden]')) kresliVykres();
  }
  function souhrny() {
    const Z = o.Z, vk = p.vicko;
    TrubkyGui.souhrn('sDoza', p.druh === 'doza' ? `${fmt(o.objem, 0)} ml · Ø ${fmt(2 * o.Ri, 1)} × ${fmt(o.hv, 1)}` : `Ø ${fmt(2 * o.Ri, 1)}`, true);
    TrubkyGui.souhrn('sZavit', `Ø ${fmt(Z.d, 1)} × ${fmt(Z.p, 2)} · ${Z.chodu}×`, true);
    TrubkyGui.souhrn('sVicko', N.uchop[vk.uchop], true);
    TrubkyGui.souhrn('sTesneni', N.tesneni[vk.tesneni], vk.tesneni !== 'zadne');
    TrubkyGui.souhrn('sHrdlo', `příruba +${fmt(p.hrdlo.priruba, 1)}`, true);
    TrubkyGui.souhrn('sZatka', p.zatka.duta ? 'dutá' : 'plná', true);
    TrubkyGui.souhrn('sVzorek', p.vzorek.sada ? `3 kroužky po ${fmt(p.vzorek.krok, 2)}` : '1 kroužek', true);
  }
  const box = (a, b, c, d) => G3D.dlazdice(a, b, c, d);
  function vypisVysledky() {
    const el = $('vVysledky'), karta = $('karta3d');
    if (!model) { el.innerHTML = box('Model', wasm || chybaJadra ? 'nelze sestavit' : 'načítám…', chybaStavby); karta.innerHTML = ''; $('vSit').innerHTML = ''; $('tabRozmery').innerHTML = ''; return; }
    const mat = DOZY.MATERIALY[p.tisk.material], K = model.dily, Z = o.Z;
    const V = K.reduce((s, d) => s + d.objem, 0), g = V * mat.hustota / 1000;
    const od = G3D.odhadTisku(V, mat.hustota, { dilu: K.length });
    const B = K.map(d => DOZY.umisti(d, false)).reduce((A, d) => { const q = G3D.obal(d.poz); for (let i = 0; i < 3; i++) { A[i] = Math.min(A[i], q[i]); A[i + 3] = Math.max(A[i + 3], q[i + 3]); } return A; }, [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]);
    const zavit = `Ø ${fmt(Z.d, 2)} × ${fmt(Z.p, 2)}`;
    let h = '';
    if (p.druh === 'doza') h += box('Objem dózy', `${fmt(o.objem, 0)} ml`, `dutina Ø ${fmt(2 * o.Ri, 1)} × ${fmt(o.hv, 1)} mm po okraj`);
    h += box('Rozměr závitu', zavit, Z.chodu > 1 ? `počet chodů ${Z.chodu} · stoupání ${fmt(Z.lead, 2)} mm` : `jednochodý · hloubka ${fmt(Z.h, 2)} mm`);
    if (o.otacek !== undefined) h += box('Zavření víčka', `${fmt(o.otacek, 2)} ot.`, mech.samosvorny ? `${fmt(o.otacek * 360, 0)}° · závit je samosvorný` : `${fmt(o.otacek * 360, 0)}° · závit není samosvorný`, mech.samosvorny ? 'ok-t' : 'mez-t');
    h += box(p.druh === 'vzorek' ? 'Rozměr vzorku' : 'Vnější rozměr', `${fmt(B[3] - B[0], 1)} × ${fmt(B[5] - B[2], 1)} mm`, p.druh === 'vzorek' ? 'všechny díly vedle sebe' : 'průměr × výška v sestavě');
    h += box('Dílů k tisku', `${K.length}`, mat.nazev);
    h += box('Objem materiálu', `${fmt(V / 1000, 1)} cm³`, 'všechny díly, plné');
    h += box('Hmotnost dílů', `${fmt(g, g < 10 ? 1 : 0)} g`, mat.nazev);
    h += box('Spotřeba filamentu', `${fmt(od.metru, 1)} m`, 'průměr 1,75 mm, plné díly');
    h += box('Doba tisku', `≈ ${od.minut < 60 ? od.minut + ' min' : fmt(od.minut / 60, 1) + ' h'}`, 'hrubý odhad');
    el.innerHTML = h;
    // lícované rozměry
    const r = [], v = p.zavit.vule, vnitrni = p.druh !== 'hrdlo' && p.druh !== 'zatka';
    r.push(['Vnější závit – přes hřbety', `Ø ${fmt(Z.d, 2)}`, Z.db ? Z.db.nazev : Z.zdroj === 'doza' ? 'vnitřní průměr + 2 × stěna + 2 × hloubka' : 'vlastní rozměr']);
    r.push(['Vnější závit – jádro', `Ø ${fmt(2 * Z.rMin, 2)}`, Z.h < Z.hZad - 0.01 ? `omezená hloubka ${fmt(Z.h, 2)} mm, hrdlo má ${fmt(Z.hZad, 2)} mm` : `hloubka závitu ${fmt(Z.h, 2)} mm`]);
    if (vnitrni) {
      r.push(['Vnitřní závit – dno', `Ø ${fmt(2 * o.PI.rMaj, 2)}`, `vnější závit + 2 × vůle ${fmt(v, 2)}`]);
      r.push(['Vnitřní závit – přes zuby', `Ø ${fmt(2 * (o.PI.rMaj - Z.h), 2)}`, `zuby se překrývají o ${fmt(o.zaber, 2)} mm`]);
    }
    r.push(['Rozteč / stoupání', `${fmt(Z.p, 2)} / ${fmt(Z.lead, 2)}`, Z.soumerny ? `počet chodů ${Z.chodu}, boky ${fmt(Z.bok, 0)}°` : `počet chodů ${Z.chodu}, nosný bok ${fmt(Z.bok, 0)}°, volný ${fmt(Z.bok2, 0)}°`]);
    r.push(['Výška závitu', fmt(p.druh === 'vzorek' ? o.hk : Z.L, 1), `náběh ${fmt(o.nabeh, 1)} mm`]);
    if (o.oring) r.push(['Drážka O-kroužku', `Ø ${fmt(2 * o.oring.rg0, 1)} / ${fmt(2 * o.oring.rg1, 1)}`, `hloubka ${fmt(o.oring.hg, 2)}, šňůra ${fmt(o.oring.d2, 1)}`]);
    if (o.ploche) r.push(['Ploché těsnění', `Ø ${fmt(o.ploche.D, 1)} / ${fmt(o.ploche.d, 1)}`, `tloušťka ${fmt(o.ploche.t, 1)}`]);
    if (p.druh === 'vzorek') r.push(['Vůle kroužků', o.vule.map(x => fmt(x, 2)).join(' / '), 'číslo kroužku = počet zářezů']);
    $('tabRozmery').innerHTML = '<tr><th>Lícovaný prvek</th><th class="c">Rozměr</th><th>Pozn.</th></tr>' + r.map(x => `<tr><td>${esc(x[0])}</td><td class="c">${x[1]}</td><td>${esc(x[2])}</td></tr>`).join('');
    const tit = { sestava: 'Sestava', rozpad: 'Rozložené', tisk: 'Díly k tisku' }[stavZobr.rezim];
    karta.innerHTML = `<div class="titul">${tit}</div>` + (p.druh === 'doza' ? `<b>${fmt(o.objem, 0)} ml</b> · Ø ${fmt(2 * o.Ri, 1)} × ${fmt(o.hv, 1)}<br>` : `<b>${esc(N.druh[p.druh])}</b><br>`)
      + `<b>${zavit}</b>` + (o.otacek !== undefined ? `<br>zavření na ${fmt(o.otacek, 2)} ot.` : '') + `<br>${fmt(g, 0)} g · dílů: ${K.length}`;
    const kont = model.dily.map(d => ({ d, k: KRAB.kontrolaSite(d.poz, d.idx) }));
    $('vSit').innerHTML = kont.map(({ d, k }) => box('Síť', k.uzavrena && d.teles === 1 ? '✔ těsná' : '✖ netěsná', `<span>${esc(d.nazev)}</span> · <span>${k.trojuhelniku} trojúhelníků</span>${d.teles === 1 ? '' : ` · <span>těles: ${d.teles}</span>`}`, k.uzavrena && d.teles === 1 ? 'ok-t' : 'chyba-t')).join('')
      + box('Stavba', `${model.cas} ms`, 'manifold-3d');
  }
  function vypisMechaniku() {
    const m = mech, Z = o.Z, st = x => x * 180 / Math.PI;
    let h = '';
    if (m.objem !== null) h += box('Objem dózy', `${fmt(m.objem, 0)} ml`, `po okraj · Ø ${fmt(2 * o.Ri, 1)} × ${fmt(o.hv, 1)} mm`);
    if (model) {
      h += box('Hmotnost prázdné', `${fmt(m.hmotnost, m.hmotnost < 10 ? 1 : 0)} g`, `${DOZY.MATERIALY[p.tisk.material].nazev}, plné díly`);
      if (m.dily.length > 1) for (const d of m.dily) h += box(esc(d.nazev), `${fmt(d.g, d.g < 10 ? 1 : 0)} g`, 'hmotnost dílu');
      if (m.plna !== null) h += box('Plná vody', `${fmt(m.plna, 0)} g`, 'prázdná + objem × 1 g/ml');
    }
    h += box('Otáček k zavření', fmt(m.otacek, 2), `${fmt(m.uhelZavreni, 0)}° · závit v záběru ${fmt(Math.max(0, m.delka), 1)} mm`);
    h += box('Úhel stoupání', `${fmt(st(m.lambda), 2)}°`, `stoupání ${fmt(Z.lead, 2)} mm na středním Ø ${fmt(m.d2, 2)} mm`);
    h += box('Samosvornost závitu', m.samosvorny ? 'drží sám' : 'nedrží sám', `třecí úhel ${fmt(st(m.ro), 1)}° · rezerva ${fmt(m.bezpecnost, 1)}×`, m.samosvorny ? (m.bezpecnost < 1.5 ? 'mez-t' : 'ok-t') : 'chyba-t');
    if (m.samosvorny) h += box('Moment povolení', `${fmt(m.povoleni * 100, 0)} %`, 'momentu utažení (jen závit, bez tření pod víčkem)');
    $('vMech').innerHTML = h;
    $('tabMech').innerHTML = '<thead><tr><th>Chodů</th><th class="c">Stoupání</th><th class="c">Úhel</th><th class="c">Otáček</th><th>Samosvorný</th></tr></thead><tbody>'
      + m.chody.map(c => `<tr class="${c.n === Z.chodu ? 'aktivni' : ''}"><td>${c.n === Z.chodu ? c.n + ' ◀' : c.n}</td><td class="c">${fmt(c.lead, 2)} mm</td><td class="c">${fmt(st(c.lambda), 1)}°</td><td class="c">${fmt(c.otacek, 2)}</td><td>${c.samosvorny ? `drží sám, rezerva ${fmt(c.bezpecnost, 1)}×` : 'nedrží sám'}</td></tr>`).join('') + '</tbody>';
    $('napMech').innerHTML = `<span>Samosvorný závit se tlakem na víčko sám nepovolí: tg λ &lt; μ / cos β, kde β = ${fmt(Z.bok, 0)}° je nosný bok.</span> `
      + `<span>Účinné tření ${fmt(m.muE, 2)} při μ = ${fmt(p.mech.mu, 2)} – orientačně (stav ${DOZY.AKTUALIZACE}); namazaný závit nebo PP drží hůř.</span> `
      + '<span>Tabulka porovnává počty chodů při stejné rozteči.</span>';
  }
  function vypisTisk() {
    const mat = DOZY.MATERIALY[p.tisk.material], dop = Math.round(0.75 * p.tisk.tryska * 20) / 20;
    let h = box('Materiál tisku', mat.nazev, p.tisk.material === 'PLA' ? 'křehčí závit, nesnáší teplo' : p.tisk.material === 'PP' ? 'houževnatý, těsný, hůř se tiskne' : 'houževnatý závit');
    h += box('Doporučená vůle', `${fmt(dop, 2)} mm`, `0,75 × tryska ${fmt(p.tisk.tryska, 2)} mm · nastaveno ${fmt(p.zavit.vule, 2)} mm`, Math.abs(dop - p.zavit.vule) < 0.11 ? 'ok-t' : 'mez-t');
    h += box('Doporučení pro tisk', '3–4 perimetry', 'šev zarovnat dozadu, okraj hrdla tisknout pomalu');
    $('vTisk').innerHTML = h;
  }

  /* ---------- kusovník ---------- */
  function vypisKusovnik() {
    if (!model) { $('kusovnik').innerHTML = '<p class="napoveda">Kusovník se ukáže po sestavení modelu.</p>'; return; }
    const r = DOZY.kusovnik(p, model);
    $('kusovnik').innerHTML = '<table class="tabulka"><thead><tr><th>Položka</th><th class="c">Kusů</th><th class="c">Rozměr</th><th>Pozn.</th></tr></thead><tbody>'
      + r.map(x => {
        let roz = '';
        if (x.d) { const b = G3D.obal(x.d.poz); roz = `${fmt(b[3] - b[0], 1)} × ${fmt(b[4] - b[1], 1)} × ${fmt(b[5] - b[2], 1)}`; }
        return `<tr class="${x.druh}"><td>${esc(x.nazev)}</td><td class="c">${x.ks}</td><td class="c">${roz}</td><td>${esc(x.pozn)}</td></tr>`;
      }).join('') + '</tbody></table><p class="napoveda">🖨 = tištěný díl, 🛒 = nakupovaný díl.</p>';
  }

  /* ---------- náhled ---------- */
  const kusy = () => G3D.tiskoveRozlozeni(model.dily, 1, 6, app.p.tisk.podlozkaX);
  function zobraz(novyPohled) {
    document.querySelectorAll('[data-rezim]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.rezim === stavZobr.rezim)));
    $('tRozpad').setAttribute('aria-pressed', String(stavZobr.rezim === 'rozpad'));
    if (!model) { nahled.nastav(null); return; }
    const r = stavZobr.rezim;
    if (r === 'tisk') nahled.nastav(kusy(), { tisk: true, novyPohled, uhel: p.tisk.uhel });
    else nahled.nastav(model.dily.map(d => DOZY.umisti(d, r === 'rozpad')).concat(stavZobr.kontext ? model.kontext : []), { novyPohled });
    $('legPrevisy').hidden = !(r === 'tisk' && nahled.stav.previsy);
  }
  function nastavRezim(r) {
    const tisk = $('tTisk').getAttribute('aria-pressed') === 'true', pred = stavZobr.rezim;
    stavZobr.rezim = r;
    if ((r === 'tisk') !== tisk) { $('tTisk').click(); return; }
    zobraz(pred !== r);
    if (model) vypisVysledky();
  }
  document.querySelectorAll('[data-rezim]').forEach(b => b.addEventListener('click', () => nastavRezim(b.dataset.rezim)));
  $('tRozpad').addEventListener('click', () => nastavRezim(stavZobr.rezim === 'rozpad' ? 'sestava' : 'rozpad'));

  /* ---------- předvolby ---------- */
  TrubkyGui.pripoj({ klic: 'webapp_dozy_zavit_gui', pohled: j => nahled.pohled(j) });
  {
    let skup = '';
    for (const v of DOZY.PREDVOLBY) {
      if (v.skupina !== skup) { skup = v.skupina; const d = document.createElement('div'); d.className = 'nab-skupina'; d.textContent = skup; $('seznamPredvoleb').appendChild(d); }
      const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
      b.innerHTML = `${esc(v.nazev)}<span class="pozn">${esc(v.popis)}</span>`;
      b.addEventListener('click', () => {
        const q = DOZY.predvolba(v.id);
        // tisk a výpočty zůstávají uživatelovy
        q.tisk = DOZY.kopie(app.p.tisk); q.mech = DOZY.kopie(app.p.mech);
        app.nahrad(q);
      });
      $('seznamPredvoleb').appendChild(b);
    }
  }

  /* ---------- export ---------- */
  function lzeExport() {
    if (!model) { Dialog.chyba(chybaStavby || 'Geometrické jádro se ještě načítá.'); return false; }
    return true;
  }
  function exportVse(co) {
    if (!lzeExport()) return;
    if (co === 'stl') app.stahni(KRAB.stlBinarni(kusy(), 'dozy a vicka - github_site'), app.jmeno('.stl'), 'model/stl');
    else app.stahni(KRAB.soubor3mf(kusy(), app.p.nazev || 'Dóza'), app.jmeno('.3mf'), 'model/3mf');
  }
  $('btnStl').addEventListener('click', () => exportVse('stl'));
  $('btn3mf').addEventListener('click', () => exportVse('3mf'));
  function exportDilu() {
    const el = $('exportDilu'); el.innerHTML = '';
    if (!model || model.dily.length < 2) return;
    for (const d of model.dily) {
      const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
      b.innerHTML = `⬇ STL – ${esc(d.nazev)}`;
      b.addEventListener('click', () => app.stahni(KRAB.stlBinarni(G3D.tiskoveRozlozeni([d], 1, 6, app.p.tisk.podlozkaX), 'dozy - ' + d.jmeno), app.jmeno('_' + d.jmeno + '.stl'), 'model/stl'));
      el.appendChild(b);
    }
  }

  /* ---------- výkres ---------- */
  function vykresTed() {
    const d = new Date(), mat = DOZY.MATERIALY[app.p.tisk.material];
    const kus = DOZY.kusovnik(app.p, model).map(x => [x.nazev, x.ks, x.pozn]);
    const g = model ? model.dily.reduce((s, x) => s + x.objem * mat.hustota / 1000, 0) : 0;
    return DOZY_VYK.vykres(app.p, model ? model.o : DOZY.odvozene(app.p), { datum: `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`, kusovnik: kus, hmotnost: g, material: mat.nazev });
  }
  function kresliVykres() { $('vykresNahled').innerHTML = DOZY_VYK.svg(vykresTed()); }
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
  async function vykresPdf() {
    try {
      if (!window.jspdf) throw new Error('Knihovna jsPDF se nenačetla.');
      const pismo = await nactiPismo();
      const doc = DOZY_VYK.pdf(window.jspdf.jsPDF, vykresTed(), { pismo, nazev: app.p.nazev || 'Dóza' });
      app.stahni(doc.output('blob'), app.jmeno('_vykres.pdf'), 'application/pdf');
      if (!pismo) Dialog.info('Písmo se nepodařilo načíst – PDF je bez diakritiky.');
    } catch (e) { Dialog.chyba('PDF se nepodařilo vytvořit: ' + (e && e.message || e)); }
  }
  const vykresSvg = () => app.stahni(DOZY_VYK.svg(vykresTed()), app.jmeno('_vykres.svg'), 'image/svg+xml');
  $('btnVykresPdf').addEventListener('click', vykresPdf); $('btnVykresPdf2').addEventListener('click', vykresPdf);
  $('btnVykresSvg').addEventListener('click', vykresSvg); $('btnVykresSvg2').addEventListener('click', vykresSvg);
  $('btnVykresZobraz').addEventListener('click', () => { TrubkyGui.otevriZalozku('vykres'); kresliVykres(); });
  document.querySelector('[data-zalozka="vykres"]').addEventListener('click', () => setTimeout(kresliVykres, 0));

  app.prepinac('tRez', h => { nahled.prepni('rez', h); $('legRez').hidden = !h; });
  app.prepinac('tHrany', h => nahled.prepni('hrany', h));
  app.prepinac('tPrevisy', h => { nahled.prepni('previsy', h); $('legPrevisy').hidden = !(h && stavZobr.rezim === 'tisk'); }, true);
  app.prepinac('tPravitka', h => nahled.prepni('pravitka', h), true);
  app.prepinac('tKontext', h => { stavZobr.kontext = h; zobraz(false); }, true);
  app.prepinac('tTisk', h => {
    if (h) stavZobr.rezim = 'tisk';
    else if (stavZobr.rezim === 'tisk') stavZobr.rezim = 'sestava';
    zobraz(true);
    if (model) vypisVysledky();
  });

  /* ---------- start ---------- */
  app.start({
    manifold: {
      ok: w => { wasm = w; prepocitej(); },
      chyba: e => { chybaJadra = 'Geometrické jádro (manifold-3d) se nenačetlo: ' + (e && e.message || e) + ' – model ani export nejsou k dispozici.'; prepocitej(); },
    },
  });
  window.DOZY_UI = { get p() { return app.p; }, get model() { return model; }, zmen: app.zmen, nahrad: app.nahrad, prepocitej, nahled, app, nastavRezim };
})();

/* Klipy na sáčky a uzávěry – ovládání stránky nad společným zapojením gen3d/aplikace.js
   (tady jen to, co je pro klipy zvláštní: druh dílu, předvolby šířek, viditelnost polí, souhrny, výsledky, výpočty, kusovník, export).
   Náhled = KNOF_NAHLED. Režimy: sestava (klip zavřený, díly složené), rozpad (díly nad sebou), tisk (díly na podložce). */
/* global KLIPY, KLIPY_MECH, KNOF_NAHLED, KRAB, G3D, Dialog, TrubkyGui */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const fmt = KLIPY.fmt, N = KLIPY.NAZVY;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const pct = x => fmt(x * 100, 1) + ' %';
  const sila = x => (x < 10 ? fmt(x, 2) : fmt(x, 0)) + ' N';
  let p, o = null, wasm = null, model = null, mech = null, chybaStavby = '', chybaJadra = '';
  const stavZobr = { rezim: 'sestava' };
  const nahled = KNOF_NAHLED.vytvorNahled($('platno'));

  const app = G3D.aplikace({
    typ: 'klipy_sacky', nazev: 'Klipy na sáčky a uzávěry', klic: 'webapp_klipy_sacky', soubor: 'klip',
    normalizuj: KLIPY.normalizuj, vychozi: () => KLIPY.predvolba('klip120'),
    ulozProjekt: KLIPY.ulozProjekt, nactiProjekt: KLIPY.nactiProjekt, popis: KLIPY.popis,
    vezmi: KLIPY.vezmi, poloz: KLIPY.poloz,
    diry: true,
    viditelnost: () => viditelnost(),
    prepocitej: () => prepocitej(),
    png: () => nahled.png(), pohled: j => nahled.pohled(j),
    exportStl: () => exportVse('stl'),
    doModelare: () => (lzeExport() ? { data: KRAB.soubor3mf(kusy(), app.p.nazev || 'Klip'), pripona: '.3mf' } : null),
    zkratky: { r: 'tRez', h: 'tHrany', m: 'tTisk', p: 'tPrevisy', l: 'tPravitka', x: 'tRozpad' },
    zmenaTematu: () => prepocitej(),
  });

  /* ---------- nabídky formuláře ---------- */
  const moznosti = (sel, obj) => { sel.innerHTML = Object.entries(obj).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join(''); };
  moznosti($('f_pant'), N.pant);
  moznosti($('f_tycka'), N.tycka);
  moznosti($('f_dop'), N.doplnek);
  moznosti($('f_material'), Object.fromEntries(Object.entries(KLIPY.MATERIALY).map(([k, m]) => [k, m.nazev])));
  moznosti($('f_folie'), Object.fromEntries(Object.entries(KLIPY.FOLIE).map(([k, f]) => [k, f.nazev])));   // tloušťku ukazuje řádek pod polem
  // předvolby šířek sáčků si stránka obsluhuje sama (zapisují do pole Šířka sáčku)
  $('f_sirkaPred').innerHTML = KLIPY.SIRKY.map(s => `<option value="${s.sirka}">${s.sirka} mm – ${esc(s.nazev)}</option>`).join('') + '<option value="">vlastní šířka…</option>';
  $('f_sirkaPred').addEventListener('change', e => {
    const v = Number(e.target.value);
    if (v) { app.zmen(q => { q.sacek.sirka = v; }); app.naplnFormular(); } else $('f_sirka').focus();
  });
  document.querySelectorAll('#paletaDruhu button').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.dlazdice === app.p.druh) return;
    app.zmen(q => { q.druh = b.dataset.dlazdice; });
    app.naplnFormular();
  }));

  const seznam = a => (a || '').split(/\s+/).filter(Boolean);
  function viditelnost() {
    p = app.p;
    const od = KLIPY.odvozene(p), q = od.K, delka = p.druh === 'klip' || p.druh === 'lista' || (p.druh === 'cklip' && p.cklip.pres);
    $('f_sirkaPred').value = KLIPY.SIRKY.some(s => s.sirka === p.sacek.sirka) ? String(p.sacek.sirka) : '';
    document.querySelectorAll('[data-druh],[data-nedruh],[data-delka],[data-folie],[data-pant],[data-pres],[data-doplnek],[data-sada]').forEach(el => {
      const a = el.dataset;
      let vid = true;
      if (a.druh && !seznam(a.druh).includes(p.druh)) vid = false;
      if (a.nedruh && seznam(a.nedruh).includes(p.druh)) vid = false;
      if (a.delka && !delka) vid = false;
      if (a.folie && p.folie.druh !== a.folie) vid = false;
      if (a.pant && p.klip.pant !== a.pant) vid = false;
      if (a.pres && p.cklip.pres) vid = false;
      if (a.doplnek && p.doplnek.druh !== a.doplnek) vid = false;
      if (a.sada && !p.sada.zapnuta) vid = false;
      el.hidden = !vid;
    });
    $('nadpisDilu').textContent = { klip: 'Pant, západka a doplňky', vzorek: 'Pant a západka', lista: 'Doplňky a sada', cklip: 'Doplňky a sada', vylevka: 'Postup' }[p.druh];
    // věty zvlášť (každá ve vlastním <span>) – překlad je hledá jednotlivě
    const vety = [];
    if (p.druh === 'vylevka') vety.push(`Obvod sáčku ${fmt(2 * p.sacek.sirka, 0)} mm se musí přetáhnout přes závit hrdla Ø ${fmt(od.V.d, 1)} mm (obvod ${fmt(Math.PI * od.V.d, 0)} mm).`);
    else {
      vety.push(`Fólie ${fmt(od.tf, 3)} mm × ${p.folie.vrstev} = svazek ${fmt(od.s, 2)} mm.`);
      if (p.druh === 'vzorek') vety.push(`Vzorek má čelisti dlouhé ${KLIPY.DELKA_VZORKU} mm.`);
      else if (delka) vety.push(`Délka dílu ${od.delky.map(x => fmt(x, 0)).join(' / ')} mm = šířka sáčku + přesah.`);
    }
    $('napSacek').innerHTML = vety.map(v => `<span>${esc(v)}</span>`).join(' ');
    if (p.druh === 'klip' || p.druh === 'vzorek') {
      $('napKlip').textContent = `Mezera čelistí ${fmt(q.g, 2)} mm, pero vysoké ${fmt(q.hz, 1)} mm s boky 45°. Zavřený klip ${fmt(q.delka, 0)} × ${fmt(2 * q.T + q.g, 1)} × ${fmt(q.H, 1)} mm.`;
      $('napPant').textContent = q.zivy ? `Pásek ${fmt(q.tw, 2)} × ${fmt(q.H, 1)} mm, volná délka ${fmt(q.Lw, 1)} mm; zavřením se ohne o ${fmt(p.klip.uhel, 0)}°.`
        : `Čep Ø ${fmt(2 * q.rp, 1)} mm se soudkem +${fmt(q.k, 1)} mm v objímce Ø ${fmt(2 * q.Ro, 1)} mm. Největší rozevření ${fmt(q.max * 180 / Math.PI, 0)}°.`;
      $('napZapadka').textContent = `Rameno západky ${fmt(q.th, 1)} × ${fmt(q.Lh, 1)} mm se při zaklapnutí ohne o ${fmt(q.pruhyb, 2)} mm.`;
    }
    if (p.druh === 'lista') $('napLista').textContent = `Otvor Ø ${fmt(2 * od.L.ri, 2)} mm, štěrbina ${fmt(od.L.st, 2)} mm, lišta vně ${fmt(2 * od.L.Ro, 1)} mm.`;
    if (p.druh === 'vylevka') {
      const V = od.V;
      $('napVylevka').textContent = `Závit Ø ${fmt(V.d, 2)} × ${fmt(V.p, 1)} mm, hloubka ${fmt(V.h, 2)} mm, celková výška závitu ${fmt(V.L, 1)} mm (matice ${fmt(V.hk, 0)} + víčko ${fmt(V.Lv, 1)}).`;
      $('napPostup').textContent = `Vůle vnitřních závitů ${fmt(V.vule, 2)} mm = ${fmt(p.vule.zavit, 2)} + ${fmt(V.pridavek, 2)} mm na fólii.`;
    }
    if (p.druh === 'cklip') $('napCklip').textContent = `Profil ${fmt(od.C.Pk[0] + od.C.Rm + od.C.t, 1)} × ${fmt(2 * Math.max(od.C.Rm, od.C.Pk[1]) + od.C.t, 1)} mm, délka ${fmt(od.C.delka, 0)} mm. Svírá svazek silnější než ${fmt(od.C.gp, 2)} mm.`;
    $('napDoplnek').textContent = !od.ucho ? '' : od.ucho.ocko ? `Ucho Ø ${fmt(2 * od.ucho.rl, 1)} mm s dírou Ø ${fmt(2 * od.ucho.rd, 1)} mm.`
      : p.druh === 'klip' ? `Kapsa Ø ${fmt(2 * od.ucho.rd, 1)} × ${fmt(od.ucho.hloubka, 1)} mm shora (při tisku otevřená) – magnet vlepte.`
        : `Kapsa Ø ${fmt(2 * od.ucho.rd, 1)} × ${fmt(od.ucho.hloubka, 1)} mm zespodu (strop kapsy je most) – magnet vlepte.`;
    $('napSada').textContent = p.druh === 'cklip' && !p.cklip.pres ? 'Sada platí jen pro profil přes celou šířku sáčku.'
      : p.sada.zapnuta ? (od.sirky.length ? `Díly pro sáčky ${od.sirky.map(x => fmt(x, 0)).join(', ')} mm (nejvýš ${KLIPY.MAX_SADA}).` : 'Zadejte šířky sáčků, např. 80, 120, 160.') : '';
  }

  /* ---------- přepočet ---------- */
  function prepocitej() {
    p = app.p;
    document.querySelectorAll('#paletaDruhu button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.dlazdice === p.druh)));
    nahled.barvy(css('--border-strong'), css('--border'), css('--text'));
    o = KLIPY.odvozene(p);
    mech = KLIPY_MECH.spocitej(p, o);
    let H = KLIPY.kontroly(p).concat(mech.hlaseni);
    model = null; chybaStavby = chybaJadra;
    const chyby = H.some(h => h.uroven === 'chyba');
    if (wasm && !chyby) {
      try {
        model = KLIPY.postav(wasm, p);
        o = model.o;
        H = H.concat(KLIPY.kontrolyModelu(p, model));
      } catch (e) { chybaStavby = 'Model nelze sestavit: ' + (e && e.message || e); }
    } else if (wasm) chybaStavby = 'Model nelze sestavit – opravte chybu v záložce Kontrola.';
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
  }
  function souhrny() {
    const q = o.K;
    TrubkyGui.souhrn('sSacek', p.druh === 'vzorek' ? `fólie ${fmt(o.s, 2)}` : `${fmt(p.sacek.sirka, 0)} mm · fólie ${fmt(o.s, 2)}`, true);
    TrubkyGui.souhrn('sKlip', `${fmt(q.T, 1)} × ${fmt(q.H, 1)} · pero ${fmt(q.hz, 1)}`, true);
    TrubkyGui.souhrn('sLista', `tyčka Ø ${fmt(p.lista.prumer, 1)}`, true);
    TrubkyGui.souhrn('sVylevka', `Ø ${fmt(p.vylevka.prumer, 0)} · závit ${fmt(o.V.d, 1)} × ${fmt(o.V.p, 1)}`, true);
    TrubkyGui.souhrn('sCklip', `stěna ${fmt(o.C.t, 1)} · rameno ${fmt(o.C.La, 0)}`, true);
    TrubkyGui.souhrn('sPant', q.zivy ? `živý ${fmt(q.tw, 2)}` : `čep Ø ${fmt(p.klip.cep, 1)} · vůle ${fmt(p.vule.pant, 2)}`, true);
    TrubkyGui.souhrn('sZapadka', `zub ${fmt(q.u, 1)} · vůle ${fmt(q.vz, 2)}`, true);
    TrubkyGui.souhrn('sDoplnek', p.doplnek.druh === 'ocko' ? `očko Ø ${fmt(p.doplnek.ocko, 1)}` : p.doplnek.druh === 'magnet' ? `magnet ${fmt(p.doplnek.magnetD, 1)} × ${fmt(p.doplnek.magnetH, 1)}` : 'žádný', p.doplnek.druh !== 'zadny');
    TrubkyGui.souhrn('sSada', o.sada ? `kusů: ${o.sirky.length}` : 'vypnuto', !!o.sada);
  }
  const box = (a, b, c, d) => G3D.dlazdice(a, b, c, d);
  function vypisVysledky() {
    const el = $('vVysledky'), karta = $('karta3d');
    if (!model) { el.innerHTML = box('Model', wasm || chybaJadra ? 'nelze sestavit' : 'načítám…', chybaStavby); karta.innerHTML = ''; $('vSit').innerHTML = ''; $('tabRozmery').innerHTML = ''; return; }
    const mat = KLIPY.MATERIALY[p.tisk.material], K = model.dily, q = o.K, L = o.L, V = o.V, C = o.C;
    const objem = K.reduce((s, d) => s + d.objem, 0), g = objem * mat.hustota / 1000;
    const od = G3D.odhadTisku(objem, mat.hustota, { dilu: K.length });
    const B = kusy().reduce((A, d) => { const b = G3D.obal(d.poz); for (let i = 0; i < 3; i++) { A[i] = Math.min(A[i], b[i]); A[i + 3] = Math.max(A[i + 3], b[i + 3]); } return A; }, [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]);
    const delky = o.delky.map(x => fmt(x, 0)).join(' / ') + ' mm';   // s jednotkou – samotné „{x} mm“ by ve slovníku sedělo na cokoli
    let h = '', hlavni = '';
    const r = [];
    if (p.druh === 'klip' || p.druh === 'vzorek') {
      hlavni = `<b>${delky}</b> · mezera ${fmt(q.g, 2)}`;
      h += box('Délka čelistí', delky, p.druh === 'vzorek' ? 'kalibrační vzorek' : `sáček ${o.sirky.map(x => fmt(x, 0)).join(' / ')} mm + přesah ${fmt(p.sacek.presah, 0)}`);
      h += box('Mezera čelistí', `${fmt(q.g, 2)} mm`, `fólie ${fmt(o.tf, 3)} mm × ${p.folie.vrstev}`);
      h += box('Pant', q.zivy ? 'živý' : 'čepový', q.zivy ? `pásek ${fmt(q.tw, 2)} mm, jeden kus` : `tisk vcelku, rozevření až ${fmt(q.max * 180 / Math.PI, 0)}°`);
      h += box('Západka', `${sila(mech.zapadka.P)}`, `průhyb ${fmt(q.pruhyb, 2)} mm · přetvoření ${pct(mech.zapadka.eps)}`, mech.zapadka.eps > mat.epsKr ? 'chyba-t' : mech.zapadka.eps > mat.epsOpak ? 'mez-t' : 'ok-t');
      r.push(['Mezera čelistí', fmt(q.g, 2), `fólie ${fmt(o.tf, 3)} × ${p.folie.vrstev} vrstev`]);
      r.push(['Pero / drážka', `${fmt(q.hz, 1)} × ${fmt(2 * q.hz, 1)}`, 'výška × šířka u paty, boky 45°']);
      if (!q.zivy) {
        r.push(['Čep', `Ø ${fmt(2 * q.rp, 2)}`, `uprostřed výšky Ø ${fmt(2 * (q.rp + q.k), 2)} (soudek)`]);
        r.push(['Díra objímky', `Ø ${fmt(2 * q.rh, 2)}`, `čep + 2 × vůle ${fmt(q.v, 2)}`]);
      } else r.push(['Pásek pantu', `${fmt(q.tw, 2)} × ${fmt(q.Lw, 1)}`, 'tloušťka × volná délka']);
      r.push(['Zub západky', fmt(q.u, 2), `vůle ${fmt(q.vz, 2)}, zabírá ${fmt(q.pruhyb, 2)}`]);
      r.push(['Pružné rameno západky', `${fmt(q.th, 1)} × ${fmt(q.Lh, 1)}`, 'tloušťka × volná délka']);
      r.push(['Rozevření při tisku', `${fmt(p.klip.uhel, 0)}°`, K[0].mezeraTisku !== undefined ? `ramena za pantem nejblíž ${fmt(K[0].mezeraTisku, 1)} mm` : '']);
    } else if (p.druh === 'lista') {
      hlavni = `<b>${delky}</b> · tyčka Ø ${fmt(2 * L.rr, 1)}`;
      h += box('Délka lišty', delky, `sáček ${o.sirky.map(x => fmt(x, 0)).join(' / ')} mm + přesah ${fmt(p.sacek.presah, 0)}`);
      h += box('Otvor lišty', `Ø ${fmt(2 * L.ri, 2)} mm`, L.kapka ? 'kapka – tisk bez podpor' : 'kruh – strop převisá');
      h += box('Štěrbina', `${fmt(L.st, 2)} mm`, `2 × svazek ${fmt(o.s, 2)} + 2 × vůle ${fmt(L.v, 2)}`);
      r.push(['Otvor lišty', `Ø ${fmt(2 * L.ri, 2)}`, `průměr tyčky ${fmt(2 * L.rr, 1)} + 2 × svazek + 2 × vůle`]);
      r.push(['Štěrbina', fmt(L.st, 2), `${fmt(L.st / (2 * L.rr) * 100, 0)} % průměru tyčky`]);
      r.push(['Vnější rozměr lišty', `${fmt(2 * L.Ro, 1)} × ${fmt(2 * L.Ro, 1)}`, 'rovné dno, oblý vršek']);
      r.push(['Tyčka', `Ø ${fmt(2 * L.rr, 1)}`, p.lista.tycka === 'tisk' ? 'tištěná, zploštělá pod 45°' : 'vlastní – změřit']);
    } else if (p.druh === 'vylevka') {
      hlavni = `<b>hrdlo Ø ${fmt(p.vylevka.prumer, 0)}</b> · závit ${fmt(V.d, 1)} × ${fmt(V.p, 1)}`;
      h += box('Průměr hrdla', `Ø ${fmt(p.vylevka.prumer, 1)} mm`, `průřez ${fmt(mech.vylevka.plocha, 1)} cm²`);
      h += box('Rozměr závitu', `Ø ${fmt(V.d, 2)} × ${fmt(V.p, 1)}`, `jednochodý · hloubka ${fmt(V.h, 2)} mm`);
      h += box('Zavření víčka', `${fmt(V.otacek, 2)} ot.`, `závit víčka ${fmt(V.Lv, 1)} mm`);
      h += box('Nejužší sáček', `${fmt(mech.vylevka.sacekMin, 0)} mm`, 'aby šel ohrnout přes závit', p.sacek.sirka >= mech.vylevka.sacekMin ? 'ok-t' : 'chyba-t');
      r.push(['Hrdlo – vnitřní průměr', `Ø ${fmt(p.vylevka.prumer, 1)}`, `stěna ${fmt(p.vylevka.stena, 1)}`]);
      r.push(['Vnější závit hrdla', `Ø ${fmt(V.d, 2)}`, `jádro Ø ${fmt(V.d - 2 * V.h, 2)}`]);
      r.push(['Vnitřní závit matice a víčka', `Ø ${fmt(V.d + 2 * V.vule, 2)}`, `vůle ${fmt(p.vule.zavit, 2)} + fólie ${fmt(V.pridavek, 2)}`]);
      r.push(['Příruba', `Ø ${fmt(2 * V.Rp, 1)} × ${fmt(KLIPY.T_PRIRUBY, 1)}`, 'o ni se opírá matice']);
      r.push(['Matice', `Ø ${fmt(2 * V.Rk, 1)} × ${fmt(V.hk, 0)}`, 'vroubkovaná']);
      r.push(['Výška hrdla', fmt(V.H, 1), `závit ${fmt(V.L, 1)} = matice + mezera + víčko`]);
    } else {
      hlavni = `<b>${o.sada ? delky : fmt(C.delka, 0) + ' mm'}</b> · ${sila(mech.cklip.F)}`;
      h += box('Délka klipu', o.sada ? delky : fmt(C.delka, 0) + ' mm', 'výška při tisku na boku');
      h += box('Síla sevření', sila(mech.cklip.F), `svazek ${fmt(o.s, 2)} mm, rozevření ${fmt(mech.cklip.rozevreni, 2)} mm`, mech.cklip.rozevreni > 0 ? 'ok-t' : 'mez-t');
      h += box('Přetvoření hřbetu', pct(mech.cklip.eps), `mez opakovaného ohybu ${pct(mat.epsOpak)}`, mech.cklip.eps > mat.epsKr ? 'chyba-t' : mech.cklip.eps > mat.epsOpak ? 'mez-t' : 'ok-t');
      r.push(['Mezera čelistí', fmt(C.gp, 2), 'tisková – svazek musí být silnější']);
      r.push(['Stěna profilu', fmt(C.t, 2), `rameno ${fmt(C.La, 1)}, sklon ${fmt(C.beta * 180 / Math.PI, 1)}°`]);
      r.push(['Světlost hřbetu', `Ø ${fmt(p.cklip.hrbet, 1)}`, 'místo pro srolovaný okraj']);
      r.push(['Největší svazek', fmt(mech.cklip.svazekMax, 1), 'bez překročení meze opakovaného ohybu']);
    }
    if (o.ucho) r.push([o.ucho.ocko ? 'Očko' : 'Kapsa na magnet', o.ucho.ocko ? `Ø ${fmt(2 * o.ucho.rd, 1)}` : `Ø ${fmt(2 * o.ucho.rd, 1)} × ${fmt(o.ucho.hloubka, 1)}`, o.ucho.ocko ? 'průchozí' : 'magnet + 0,2 mm']);
    h += box('Na podložce', `${fmt(B[3] - B[0], 0)} × ${fmt(B[4] - B[1], 0)} mm`, `výška ${fmt(B[5] - B[2], 1)} mm`);
    h += box('Dílů k tisku', `${K.length}`, mat.nazev);
    h += box('Objem materiálu', `${fmt(objem / 1000, 1)} cm³`, 'všechny díly, plné');
    h += box('Hmotnost dílů', `${fmt(g, g < 10 ? 1 : 0)} g`, mat.nazev);
    h += box('Spotřeba filamentu', `${fmt(od.metru, 1)} m`, 'průměr 1,75 mm, plné díly');
    h += box('Doba tisku', `≈ ${od.minut < 60 ? od.minut + ' min' : fmt(od.minut / 60, 1) + ' h'}`, 'hrubý odhad');
    el.innerHTML = h;
    $('tabRozmery').innerHTML = '<tr><th>Lícovaný prvek</th><th class="c">Rozměr</th><th>Pozn.</th></tr>' + r.map(x => `<tr><td>${esc(x[0])}</td><td class="c">${x[1]}</td><td>${esc(x[2])}</td></tr>`).join('');
    const tit = { sestava: p.druh === 'klip' || p.druh === 'vzorek' ? 'Zavřeno' : 'Sestava', rozpad: 'Rozložené', tisk: 'Díly k tisku' }[stavZobr.rezim];
    karta.innerHTML = `<div class="titul">${tit}</div><b>${esc(N.druh[p.druh])}</b><br>${hlavni}<br>${fmt(g, g < 10 ? 1 : 0)} g · dílů: ${K.length}`;
    const kont = K.map(d => ({ d, k: KRAB.kontrolaSite(d.poz, d.idx) }));
    $('vSit').innerHTML = kont.map(({ d, k }) => { const dobre = k.uzavrena && d.teles === d.telesMa; return box('Síť', dobre ? '✔ těsná' : '✖ netěsná', `<span>${esc(d.nazev)}</span> · <span>${k.trojuhelniku} trojúhelníků</span>${d.telesMa === 2 ? ' · <span>2 tělesa spojená pantem</span>' : ''}`, dobre ? 'ok-t' : 'chyba-t'); }).join('')
      + box('Stavba', `${model.cas} ms`, 'manifold-3d');
  }
  function vypisMechaniku() {
    const m = mech, mat = m.mat, tr = eps => (eps > mat.epsKr ? 'chyba-t' : eps > mat.epsOpak ? 'mez-t' : 'ok-t');
    const napeti = x => `napětí ≈ ${fmt(x.sigma, x.sigma < 10 ? 1 : 0)} MPa`;
    let h = box('Materiál', esc(mat.nazev), `E ≈ ${fmt(mat.E, 0)} MPa · mez přetvoření ${pct(mat.epsOpak)} / ${pct(mat.epsKr)}`);
    let pozn = '';
    if (m.zapadka) {
      const z = m.zapadka, c = m.celisti;
      h += box('Průhyb západky', `${fmt(z.pruhyb, 2)} mm`, `rameno ${fmt(o.K.th, 1)} × ${fmt(z.delka, 1)} mm`);
      h += box('Přetvoření západky', pct(z.eps), napeti(z), tr(z.eps));
      h += box('Síla západky', sila(z.P), `zaklapnutí přes náběh 45°: ${sila(z.zaklapnuti)}`);
      if (o.K.zivy) {
        h += box('Přetvoření živého pantu', pct(m.pant.eps), `${napeti(m.pant)} · zavřený klip`, tr(m.pant.eps));
        h += box('Pant rozevírá silou', sila(m.pant.sila), 'na konci ramen – přebírá ji západka');
      } else h += box('Největší rozevření', `${fmt(m.pant.rozevreni, 0)}°`, 'dál objímka krček čepu nepustí');
      h += box('Tuhost čelistí', `${fmt(c.k, c.k < 10 ? 2 : 0)} N/mm`, `uprostřed délky ${fmt(c.delka, 0)} mm`);
      h += box('Sevření při přehybu navíc', sila(c.F), `svazek o ${fmt(c.presah, 2)} mm silnější · přetvoření ${pct(c.eps)}`, tr(c.eps));
      pozn = '<span>Rovně zavřený sáček vyplní mezeru čelistí bez přítlaku – těsní zalomení fólie perem v drážce.</span> <span>Přítlak vzniká, až když je svazek silnější než mezera (přehyb navíc): ramena se prohnou jako nosníky mezi pantem a západkou.</span> ';
    }
    if (m.lista) {
      h += box('Světlost lišty', `Ø ${fmt(m.lista.svetlost, 2)} mm`, `průměr tyčky ${fmt(p.lista.prumer, 1)} + 2 × svazek + 2 × vůle`);
      h += box('Štěrbina', `${fmt(m.lista.sterbina, 2)} mm`, `${fmt(m.lista.pomer * 100, 0)} % průměru tyčky`, m.lista.pomer < 0.5 ? 'ok-t' : 'mez-t');
      h += box('Fólie kolem tyčky', `${fmt(m.lista.obvod, 0)} mm`, 'délka sáčku schovaná v liště');
      pozn = '<span>Lišta nepruží – sáček drží tvarem: tyčka je širší než štěrbina a fólie se kolem ní ovíjí.</span> <span>Čím užší štěrbina proti tyčce, tím jistěji drží.</span> ';
    }
    if (m.vylevka) {
      const v = m.vylevka;
      h += box('Průměr hrdla', `Ø ${fmt(v.prumer, 1)} mm`, `průřez ${fmt(v.plocha, 1)} cm²`);
      h += box('Nejužší sáček', `${fmt(v.sacekMin, 0)} mm`, `obvod závitu Ø ${fmt(v.zavit, 1)} mm + rezerva`, p.sacek.sirka >= v.sacekMin ? 'ok-t' : 'chyba-t');
      h += box('Zavření víčka', `${fmt(v.otacek, 2)} ot.`, `${fmt(v.otacek * 360, 0)}°`);
      h += box('Záběr závitu', `${fmt(v.zaber, 2)} mm`, `hloubka − vůle ${fmt(v.vule, 2)} mm (s fólií)`, v.zaber >= 0.4 ? 'ok-t' : 'mez-t');
      pozn = '<span>Hrdlo Ø 20–30 mm se hodí na rýži, cukr a čočku, Ø 40 mm a víc na mouku a vločky.</span> <span>Výlevka nemá pružné části – drží závitem.</span> ';
    }
    if (m.cklip) {
      const c = m.cklip;
      h += box('Rozevření čelistí', `${fmt(c.rozevreni, 2)} mm`, `svazek ${fmt(o.s, 2)} − mezera ${fmt(o.C.gp, 2)} mm`, c.rozevreni > 0 ? 'ok-t' : 'mez-t');
      h += box('Síla sevření', sila(c.F), `${fmt(c.naMm, 3)} N na mm délky`);
      h += box('Tuhost', `${fmt(c.k, c.k < 10 ? 2 : 0)} N/mm`, 'síla na 1 mm rozevření');
      h += box('Přetvoření hřbetu', pct(c.eps), napeti(c), tr(c.eps));
      h += box('Největší svazek', `${fmt(c.svazekMax, 1)} mm`, 'po mez opakovaného ohybu');
      pozn = '<span>Polovina profilu se počítá jako zakřivená konzola vetknutá ve středu hřbetu (Castiglianova věta), síla působí v místě sevření.</span> ';
    }
    $('vMech').innerHTML = h;
    $('napMech').innerHTML = pozn + `<span>Hodnoty materiálů jsou typické (stav ${KLIPY.DATUM_MATERIALU}): modul pružnosti a dovolené přetvoření pro opakovaný / krátkodobý ohyb; napětí = E · ε.</span> `
      + '<span>Výtisk se liší podle orientace vrstev, výplně a teploty – berte čísla jako orientační.</span>';
  }
  function vypisTisk() {
    const mat = KLIPY.MATERIALY[p.tisk.material], dop = Math.round(0.75 * p.tisk.tryska * 20) / 20;
    let h = box('Materiál tisku', esc(mat.nazev), p.tisk.material === 'PLA' ? 'tuhý, pružné části brzy praskají' : p.tisk.material === 'TPU' ? 'měkký – živý pant, malé síly' : 'houževnatý – pant i západka');
    if (p.druh === 'klip' || p.druh === 'vzorek') h += box('Doporučená vůle pantu', `${fmt(dop, 2)} mm`, `0,75 × tryska ${fmt(p.tisk.tryska, 2)} mm · nastaveno ${fmt(p.vule.pant, 2)} mm`, o.K.zivy || Math.abs(dop - p.vule.pant) < 0.11 ? 'ok-t' : 'mez-t');
    h += box('Doporučení pro tisk', p.druh === 'cklip' ? '3 perimetry' : '3–4 perimetry', p.druh === 'cklip' ? 'pružina je nejpevnější z perimetrů; vysoký tisk s límcem' : p.druh === 'vylevka' ? 'šev zarovnat dozadu, závit tisknout pomalu' : 'první vrstvu nepřemačkat (sloní noha)');
    $('vTisk').innerHTML = h;
  }

  /* ---------- kusovník ---------- */
  function vypisKusovnik() {
    if (!model) { $('kusovnik').innerHTML = '<p class="napoveda">Kusovník se ukáže po sestavení modelu.</p>'; return; }
    const r = KLIPY.kusovnik(p, model);
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
    else nahled.nastav(model.sestava.map(d => KLIPY.umisti(d, r === 'rozpad')), { novyPohled });
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
  TrubkyGui.pripoj({ klic: 'webapp_klipy_sacky_gui', pohled: j => nahled.pohled(j) });
  {
    let skup = '';
    for (const v of KLIPY.PREDVOLBY) {
      if (v.skupina !== skup) { skup = v.skupina; const d = document.createElement('div'); d.className = 'nab-skupina'; d.textContent = skup; $('seznamPredvoleb').appendChild(d); }
      const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
      b.innerHTML = `${esc(v.nazev)}<span class="pozn">${esc(v.popis)}</span>`;
      b.addEventListener('click', () => {
        const q = KLIPY.predvolba(v.id);
        q.tisk = KLIPY.kopie(app.p.tisk);   // tiskárna a materiál zůstávají uživatelovy
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
    if (co === 'stl') app.stahni(KRAB.stlBinarni(kusy(), 'klipy na sacky - github_site'), app.jmeno('.stl'), 'model/stl');
    else app.stahni(KRAB.soubor3mf(kusy(), app.p.nazev || 'Klip'), app.jmeno('.3mf'), 'model/3mf');
  }
  $('btnStl').addEventListener('click', () => exportVse('stl'));
  $('btn3mf').addEventListener('click', () => exportVse('3mf'));
  function exportDilu() {
    const el = $('exportDilu'); el.innerHTML = '';
    if (!model || model.dily.length < 2) return;
    for (const d of model.dily) {
      const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
      b.innerHTML = `⬇ STL – ${esc(d.nazev)}`;
      b.addEventListener('click', () => app.stahni(KRAB.stlBinarni(G3D.tiskoveRozlozeni([d], 1, 6, app.p.tisk.podlozkaX), 'klipy - ' + d.jmeno), app.jmeno('_' + d.jmeno + '.stl'), 'model/stl'));
      el.appendChild(b);
    }
  }

  app.prepinac('tRez', h => { nahled.prepni('rez', h); $('legRez').hidden = !h; });
  app.prepinac('tHrany', h => nahled.prepni('hrany', h));
  app.prepinac('tPrevisy', h => { nahled.prepni('previsy', h); $('legPrevisy').hidden = !(h && stavZobr.rezim === 'tisk'); }, true);
  app.prepinac('tPravitka', h => nahled.prepni('pravitka', h), true);
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
  window.KLIPY_UI = { get p() { return app.p; }, get model() { return model; }, get mech() { return mech; }, zmen: app.zmen, nahrad: app.nahrad, prepocitej, nahled, app, nastavRezim };
})();

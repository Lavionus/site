/* Šnekový převod – ovládání stránky nad společným zapojením gen3d/aplikace.js
   (tady jen to, co je pro šnekový převod zvláštní: viditelnost polí, souhrny, výsledky, výpočty, kusovník, režimy náhledu, export, výkres).
   Náhled = KNOF_NAHLED. Režimy: sestava (v záběru, posuvník pootočení), kolo, šnek, tisk (díly na podložce), kalibrace. */
/* global SNEK, SNEK_VYK, KNOF_NAHLED, KRAB, G3D, Dialog, TrubkyGui */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const fmt = SNEK.fmt;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  let p, wasm = null, model = null, chybaStavby = '', chybaJadra = '';
  const stavZobr = { rezim: 'sestava', fi: 0 };
  const nahled = KNOF_NAHLED.vytvorNahled($('platno'), { drzPohled: true });

  const app = G3D.aplikace({
    typ: 'snek', nazev: 'Šnekový převod', klic: 'webapp_snek', soubor: 'snekovy_prevod',
    normalizuj: SNEK.normalizuj, vychozi: () => SNEK.predvolba('m15'),
    ulozProjekt: SNEK.ulozProjekt, nactiProjekt: SNEK.nactiProjekt, popis: SNEK.popis,
    viditelnost: () => viditelnost(),
    prepocitej: () => prepocitej(),
    png: () => nahled.png(), pohled: j => nahled.pohled(j),
    exportStl: () => exportVse('stl'),
    nahodny: q => SNEK.nahodny(q),
    doModelare: () => (lzeExport() ? { data: KRAB.soubor3mf(kusy(dilyKTisku()), app.p.nazev || 'Šnekový převod'), pripona: '.3mf' } : null),
    zkratky: { r: 'tRez', h: 'tHrany', m: 'tTisk', p: 'tPrevisy', l: 'tPravitka' },
    zmenaTematu: () => prepocitej(),
  });

  /* ---------- formulář ---------- */
  const moznosti = (sel, pol) => { sel.innerHTML = pol.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join(''); };
  moznosti($('f_kdz'), Object.keys(SNEK.ZAVITY).map(k => [k, k]));
  for (const id of ['f_ms', 'f_mk']) moznosti($(id), Object.entries(SNEK.MATERIALY).map(([k, m]) => [k, m.nazev]));
  for (const id of ['f_ls', 'f_lk']) moznosti($(id), Object.entries(SNEK.LOZISKA).map(([k, l]) => [k, `${k} (${l.d} × ${l.D} × ${l.B})`]));
  const seznam = a => (a || '').split(/\s+/).filter(Boolean);

  function viditelnost() {
    p = app.p;
    const naboj = !p.kolo.pulky && p.kolo.naboj > 0;
    document.querySelectorAll('[data-pulky],[data-nepulky],[data-naboj],[data-stavaci],[data-kdira],[data-ulozeni],[data-sdira],[data-skrin]').forEach(el => {
      const d = el.dataset;
      let vid = true;
      if (d.pulky && !p.kolo.pulky) vid = false;
      if (d.nepulky && p.kolo.pulky) vid = false;
      if (d.naboj && !naboj) vid = false;
      if (d.stavaci && !(naboj && p.kolo.stavaci && p.kolo.dira.typ !== 'zavit')) vid = false;
      if (d.kdira && !seznam(d.kdira).includes(p.kolo.dira.typ)) vid = false;
      if (d.ulozeni && d.ulozeni !== p.snek.ulozeni) vid = false;
      if (d.sdira && !(p.snek.ulozeni === 'dira' && p.snek.dira.typ === d.sdira)) vid = false;
      if (d.skrin && !p.skrin.zapnuto) vid = false;
      el.hidden = !vid;
    });
    $('lKdp').textContent = p.kolo.dira.typ === 'sestihran' ? 'Šestihran (klíč)' : 'Hřídel Ø';
    $('lSdp').textContent = p.snek.dira.typ === 'sestihran' ? 'Šestihran (klíč)' : 'Hřídel Ø';
    const o = SNEK.odvozene(p);
    $('napZaber').textContent = `Převod 1 : ${fmt(o.i, 2)}, úhel stoupání γ = ${fmt(o.ga * 180 / Math.PI, 2)}°, šnek Ø ${fmt(2 * o.r1, 2)} (q·m), kolo Ø ${fmt(2 * o.r2, 2)} (z2·m), rozteč os ${fmt(o.a, 2)} mm.`;
    $('napKolo').textContent = p.kolo.druh === 'globoidni'
      ? (p.kolo.pulky ? 'Globoidní kolo z půlek: plné hrdlo, každá půlka se tiskne vnější stranou dolů bez převisů.'
        : `Globoidní kolo: zub obepíná šnek (styk po čáře). Horní polovina hrdla je pro tisk seříznutá na ${fmt(p.tisk.uhel, 0)}° (Tisk → Největší převis).`)
      : 'Válcové kolo: šikmé evolventní zuby se sklonem γ, styk uprostřed šířky – jednodušší, snese posun šneku v ose, unese méně.';
    $('napNaboj').textContent = {
      kruh: 'Kruhová díra – hřídel drží stavěcí šroub.', D: 'Hřídel s ploškou (motorky, potenciometry) – ploška míří k +Y.',
      sestihran: 'Šestihranná hřídel nebo šestihran šroubu (klíč = rozměr přes plošky).', pero: 'Drážka pro těsné pero DIN 6885 (od hřídele Ø 6).',
      zavit: 'Tištěný vnitřní závit – kolo se našroubuje na závitovou tyč a zajistí maticí.',
    }[p.kolo.dira.typ] + (p.kolo.pulky ? ' Kolo z půlek je bez náboje.' : '');
    $('napSnek1').textContent = p.snek.ulozeni === 'cepy' ? 'Čepy s kuželem 45° k patě závitu – do ložisek nebo kluzných pouzder.' : 'Šnek nasazený na hřídel (D, šestihran nebo pero ho unáší).';
    $('napSnek2').textContent = o.pulkySnek ? 'Tiskne se na boku ze dvou půlek (spoj kolíčky, nasadit na hřídel a slepit).' : 'Tiskne se nastojato.';
    document.querySelectorAll('[data-rezimy]').forEach(el => { el.hidden = !seznam(el.dataset.rezimy).includes(stavZobr.rezim); });
  }

  /* ---------- přepočet ---------- */
  function prepocitej() {
    p = app.p;
    nahled.barvy(css('--border-strong'), css('--border'), css('--text'));
    let H = SNEK.kontroly(p);
    model = null;
    const chyby = H.some(h => h.uroven === 'chyba');
    chybaStavby = chybaJadra;
    if (wasm && !chyby) {
      try {
        model = SNEK.postav(wasm, p, { kalibrace: stavZobr.rezim === 'kalibrace' || p.tisk.kalibrace });
        H = H.concat(SNEK.kontrolyModelu(p, model), previsy());
        chybaStavby = '';
      } catch (e) { chybaStavby = 'Model nelze sestavit: ' + (e && e.message || e); }
    } else if (wasm && chyby) chybaStavby = '';
    const st = $('stav3d');
    st.textContent = wasm ? (chybaStavby || (chyby ? 'Model se sestaví po opravě chyb (záložka Kontrola).' : '')) : chybaStavby || 'Načítám geometrické jádro…';
    st.classList.toggle('chyba', !!chybaStavby || chyby);
    zobraz(false);
    app.hlaseni(H, { chybaStavby, boxy: ['boxZaber', 'boxSnek'] });
    const o = SNEK.odvozene(p);
    vypisVysledky(o);
    vypisVypocty(o);
    souhrny(o);
    exportDilu();
  }
  /** Převisy dílů v tiskové poloze (měřené na síti). */
  function previsy() {
    const H = [], u = p.tisk.uhel;
    for (const d of model.tisk.concat(model.kalibrace)) {
      const r = SNEK.rozborDilu(d, u);
      if (d.jmeno === 'snek') { if (r.previs > 3) H.push({ uroven: 'info', pole: ['snek.poloha'], text: `Šnek nastojato: spodní boky závitu převisají na ploše ${fmt(r.previs, 0)} mm².` }); continue; }
      if (d.jmeno.startsWith('snek_')) { if (r.previs + r.most > 3) H.push({ uroven: 'info', pole: null, text: `${d.nazev}: strop díry hřídele ${fmt(r.previs + r.most, 0)} mm² – krátký most, tiskne se bez podpor.` }); continue; }
      if (r.previs > 3) H.push({ uroven: r.previs > 20 ? 'varovani' : 'info', pole: ['tisk.uhel'], text: `${d.nazev}: převis nad ${fmt(u, 0)}° od svislice ${fmt(r.previs, 0)} mm².` });
      if (r.most > 3) H.push({ uroven: 'info', pole: null, text: `${d.nazev}: tiskárna přemostí ${fmt(r.most, 0)} mm² vodorovného stropu.` });
    }
    return H;
  }
  const hustota = d => SNEK.MATERIALY[/^snek/.test(d.jmeno) || /hreben/.test(d.jmeno) ? p.vypocet.matSnek : p.vypocet.matKolo].hustota;
  function dilyKTisku() { return model ? model.tisk.concat(p.tisk.kalibrace ? model.kalibrace : []) : []; }

  const box = G3D.dlazdice;
  function vypisVysledky(o) {
    const el = $('vVysledky'), karta = $('karta3d');
    let h = box('Převod', `1 : ${fmt(o.i, 2)}`, `${o.z1} ${o.z1 === 1 ? 'chod' : 'chody'} · ${o.z2} zubů · ${p.zaber.smer === 'levy' ? 'levé' : 'pravé'} stoupání`);
    h += box('Rozteč os', `${fmt(o.a, 3)} mm`, Math.abs(o.x2) > 1e-6 ? `posunutí kola x₂ = ${fmt(o.x2, 3)}` : '(d1 + d2) / 2');
    h += box('Úhel stoupání', `γ = ${fmt(o.ga * 180 / Math.PI, 2)}°`, `px = ${fmt(o.px, 3)} · pz = ${fmt(o.pz, 3)} mm`);
    h += box('Šnek', `Ø ${fmt(2 * o.ra1, 2)} × ${fmt(SNEK.delkaSneku(p, o), 1)}`, `d1 ${fmt(2 * o.r1, 2)} · df1 ${fmt(2 * o.rf1, 2)} · závit ${fmt(o.L1, 1)} mm`);
    h += box('Kolo', `Ø ${fmt(2 * o.rRimSkut, 2)} × ${fmt(o.b2, 1)}`, `d2 ${fmt(2 * o.r2, 2)} · da2 ${fmt(2 * o.ra2, 2)} · df2 ${fmt(2 * o.rf2, 2)}`);
    if (model) {
      const dily = dilyKTisku(), sad = p.tisk.kusu;
      const V = dily.reduce((s, d) => s + d.objem, 0) * sad, g = dily.reduce((s, d) => s + d.objem * hustota(d), 0) / 1000 * sad;
      const od = G3D.odhadTisku(V, 1, { dilu: dily.length * sad });
      h += box('Objem', `${fmt(V / 1000, 2)} cm³`, `${dily.length * sad} ${dily.length * sad < 5 ? 'díly' : 'dílů'}`);
      h += box('Hmotnost', `${fmt(g, g < 10 ? 1 : 0)} g`, `kolo ${SNEK.MATERIALY[p.vypocet.matKolo].nazev}, šnek ${SNEK.MATERIALY[p.vypocet.matSnek].nazev}, plné díly`);
      h += box('Filament', `${fmt(od.metru, 2)} m`, 'průměr 1,75 mm, plné díly');
      h += box('Doba tisku', `≈ ${od.minut < 60 ? od.minut + ' min' : fmt(od.minut / 60, 1) + ' h'}`, 'hrubý odhad');
      h += box('Tisk šneku', o.pulkySnek ? 'na boku, 2 půlky' : 'nastojato', p.snek.poloha === 'auto' ? 'zvoleno automaticky' : 'zadáno ručně');
      karta.innerHTML = `<div class="titul">Šnekový převod</div><b>1 : ${fmt(o.i, 2)}</b> · m ${fmt(o.m, 2)} · a = <b>${fmt(o.a, 2)}</b> mm<br>`
        + `kolo Ø ${fmt(2 * o.rRimSkut, 1)} · šnek Ø ${fmt(2 * o.ra1, 1)}<br>${SNEK.NAZVY.druh[p.kolo.druh]} · <b>${fmt(g, g < 10 ? 1 : 0)}</b> g`;
      $('vSit').innerHTML = model.tisk.concat(model.kalibrace).map(d => { const k = KRAB.kontrolaSite(d.poz, d.idx); return box('Síť – ' + d.nazev, k.uzavrena ? '✔ těsná' : '✖ netěsná', `${k.trojuhelniku} trojúhelníků, ${d.teles} těleso`, k.uzavrena && d.teles === 1 ? 'ok-t' : 'chyba-t'); }).join('')
        + box('Stavba', `${model.cas} ms`, 'manifold-3d');
    } else {
      h += box('Model', wasm ? 'nesestaven' : 'načítám…', chybaStavby || (wasm ? 'opravte chyby v záložce Kontrola' : ''));
      karta.innerHTML = ''; $('vSit').innerHTML = '';
    }
    el.innerHTML = h;
    const r = [
      ['Šnek – hlava da1', `Ø ${fmt(2 * o.ra1, 2)}`, ''], ['Šnek – roztečný d1', `Ø ${fmt(2 * o.r1, 2)}`, 'q·m'], ['Šnek – pata df1', `Ø ${fmt(2 * o.rf1, 2)}`, `výška závitu ${fmt(o.hz, 2)}`],
      ['Tloušťka závitu (osově)', fmt(o.wp, 3), `na roztečné přímce, px/2 − j/2`],
      ['Kolo – hrdlo da2', `Ø ${fmt(2 * o.ra2, 2)}`, 've střední rovině'], ['Kolo – vnější', `Ø ${fmt(2 * o.rRimSkut, 2)}`, o.glob ? 'okraj hrdla' : 'válcové'],
      ['Kolo – roztečný d2', `Ø ${fmt(2 * o.r2, 2)}`, 'z2·m'], ['Kolo – pata df2', `Ø ${fmt(2 * o.rf2, 2)}`, 've střední rovině'],
      ['Díra kola', `Ø ${fmt(2 * o.rDiraKolo, 2)}`, SNEK.NAZVY.dira[p.kolo.dira.typ]],
    ];
    if (p.snek.ulozeni === 'dira') r.push(['Díra šneku', `Ø ${fmt(2 * o.rDiraSnek, 2)}`, SNEK.NAZVY.dira[p.snek.dira.typ]]);
    else r.push(['Čepy šneku', `Ø ${fmt(p.snek.cep, 2)} × ${fmt(p.snek.cepDelka, 1)}`, '']);
    $('tabRozmery').innerHTML = '<tr><th>Rozměr</th><th class="c">mm</th><th>Pozn.</th></tr>' + r.map(x => `<tr><td>${x[0]}</td><td class="c">${x[1]}</td><td>${x[2]}</td></tr>`).join('');
    kusovnik(o);
    tiskInfo(o);
  }
  function vypisVypocty(o) {
    const v = SNEK.vypocty(p, o), V = p.vypocet;
    const proc = x => `${fmt(100 * x, 0)} %`;
    let h = box('Převodový poměr', `i = ${fmt(o.i, 2)}`, `${o.z2} / ${o.z1}`);
    h += box('Úhel stoupání', `γ = ${fmt(o.ga * 180 / Math.PI, 2)}°`, `tan γ = ${fmt(Math.tan(o.ga), 3)} = z1 / q`);
    h += box('Třecí úhel', `ρ′ = ${fmt(v.rho * 180 / Math.PI, 2)}°`, `μ = ${fmt(v.mu, 3)}${V.treni > 0 ? ' (zadáno)' : V.mazani ? ' (mazáno)' : ' (nasucho)'} · αn ${fmt(v.an * 180 / Math.PI, 1)}°`);
    h += box('Samosvornost', v.samosvorny ? 'ANO' : 'ne', v.samosvorny ? 'γ ≤ ρ′ – kolo šnekem neotočí (staticky)' : 'γ > ρ′ – kolo se dá roztočit zpět', v.samosvorny ? 'ok-t' : 'mez-t');
    h += box('Účinnost', proc(v.eta), `zpětný chod ${v.etaZpet > 0 ? proc(v.etaZpet) : '0 % (samosvorný)'}`);
    h += box('Otáčky výstupu', `${fmt(v.n2, v.n2 < 10 ? 2 : 1)} ot/min`, `vstup ${fmt(V.otacky, 0)} ot/min`);
    h += box('Moment výstupu', `${fmt(v.T2, v.T2 < 1 ? 3 : 2)} N·m`, `vstup ${fmt(V.moment, 3)} N·m × i × η`);
    h += box('Výkon', `${fmt(v.P1, v.P1 < 1 ? 2 : 1)} W → ${fmt(v.P2, v.P2 < 1 ? 2 : 1)} W`, `ztráta ${fmt(v.P1 - v.P2, 2)} W teplem`);
    h += box('Kluzná rychlost', `${fmt(v.vs, 2)} m/s`, v.vs > 1 ? 'nad 1 m/s se plast zahřívá – mazat, zpomalit' : 'pro plast v pořádku', v.vs > 1 ? 'mez-t' : '');
    h += box('Obvodová síla kola', `${fmt(v.Ft2, 0)} N`, `osová síla na šnek; radiální ${fmt(v.Fr, 0)} N, obvodová šneku ${fmt(v.Ft1, 0)} N`);
    h += box('Ohyb zubu kola', `${fmt(v.sigma, 1)} MPa`, `bezpečnost ${Number.isFinite(v.S) ? fmt(v.S, 1) : '∞'} (dovoleno ${SNEK.MATERIALY[V.matKolo].sigma} MPa, nosná šířka ${fmt(v.bEf, 1)} mm)`, v.S < 1 ? 'chyba-t' : v.S < 2 ? 'mez-t' : 'ok-t');
    h += box('Mez podřezání', `z2 ≥ ${fmt(v.z2min, 1)}`, o.z2 < v.z2min - 0.5 ? 'zuby jsou u paty podřezané' : 'bez podřezání', o.z2 < v.z2min - 0.5 ? 'mez-t' : '');
    $('vVypocty').innerHTML = h;
  }
  function tiskInfo(o) {
    const g = G3D.dlazdice;
    let h = g('Kolo', p.kolo.pulky ? '2 půlky naplocho' : 'naplocho', p.kolo.pulky ? `${p.kolo.kolicku} kolíčky Ø ${fmt(p.tisk.kolicek, 2)}` : o.glob ? `hrdlo seříznuté na ${fmt(p.tisk.uhel, 0)}°` : 'válcové');
    h += g('Šnek', o.pulkySnek ? 'na boku, 2 půlky' : 'nastojato', o.pulkySnek ? 'kolíčky + hřídel' : `převis boků ${fmt(90 - p.zaber.uhel, 0)}° na ${fmt(o.hz, 1)} mm`);
    if (p.skrin.zapnuto) h += g('Držák', 'deskou dolů', 'díry ložisek šneku jsou kapky – bez podpor');
    $('vTisk').innerHTML = h;
  }
  function kusovnik(o) {
    const rad = polozkyKusovniku(o);
    $('tabKusovnik').innerHTML = '<tr><th>Díl</th><th class="c">ks</th><th>Pozn.</th></tr>' + rad.map(([n, ks, poz]) => `<tr><td>${esc(n)}</td><td class="c">${ks}</td><td>${esc(poz || '')}</td></tr>`).join('');
  }
  function polozkyKusovniku(o) {
    const r = [], MS = SNEK.MATERIALY[p.vypocet.matSnek].nazev, MK = SNEK.MATERIALY[p.vypocet.matKolo].nazev;
    r.push([p.kolo.pulky ? 'Šnekové kolo – půlka' : 'Šnekové kolo', p.kolo.pulky ? 2 : 1, `tisk, ${MK}`]);
    r.push([o.pulkySnek ? 'Šnek – půlka' : 'Šnek', o.pulkySnek ? 2 : 1, `tisk, ${MS}`]);
    if (p.skrin.zapnuto) r.push(['Držák', 1, `tisk, ${MK}`]);
    if (p.kolo.pulky && p.kolo.kolicku > 0) r.push([`Kolíček Ø ${fmt(p.tisk.kolicek, 2)} × ${fmt(o.b2, 1)}`, p.kolo.kolicku, 'filament / šroub']);
    if (o.pulkySnek) r.push(o.kolickySnek ? [`Kolíček Ø ${fmt(p.tisk.kolicek, 2)} × 10`, 2, 'filament, + lepidlo'] : ['Lepidlo na půlky šneku', 1, 'kyanoakrylát / epoxid']);
    if (!p.kolo.pulky && p.kolo.naboj > 0 && p.kolo.stavaci && p.kolo.dira.typ !== 'zavit') r.push([`Stavěcí šroub ${p.kolo.sroub} + matice`, 1, 'ISO 4026 / 4032']);
    if (p.kolo.dira.typ === 'pero' && SNEK.pero(p.kolo.dira.prumer)) { const pr = SNEK.pero(p.kolo.dira.prumer); r.push([`Pero ${pr.b} × ${pr.b}`, 1, 'DIN 6885']); }
    if (p.skrin.zapnuto) {
      const LS = SNEK.LOZISKA[p.skrin.loziskoSnek], LK = SNEK.LOZISKA[p.skrin.loziskoKolo];
      r.push([`Ložisko ${p.skrin.loziskoSnek}`, 2, `${LS.d} × ${LS.D} × ${LS.B}`]);
      r.push([`Ložisko ${p.skrin.loziskoKolo}`, 1, `${LK.d} × ${LK.D} × ${LK.B}`]);
      r.push([`Hřídel kola Ø ${fmt(LK.d)}`, 1, 'ocel']);
      if (p.snek.ulozeni === 'dira') r.push([`Hřídel šneku Ø ${fmt(LS.d)}`, 1, 'ocel']);
      r.push(['Šroub M4 do podkladu', 4, '']);
    }
    return r;
  }
  function souhrny(o) {
    const S = TrubkyGui.souhrn;
    S('sZaber', `m ${fmt(o.m, 2)} · ${o.z1}/${o.z2} · q ${fmt(o.q, 1)} · ${fmt(p.zaber.uhel, 1)}°`, true);
    S('sVule', `j ${fmt(o.j, 2)} · c ${fmt(p.zaber.hlavova, 2)}·m · a ${fmt(o.a, 2)}`, true);
    S('sKolo', `${p.kolo.druh === 'globoidni' ? 'globoidní' : 'válcové'} · b ${fmt(o.b2, 1)}${p.kolo.pulky ? ' · půlky' : ''}`, true);
    S('sNaboj', `${SNEK.NAZVY.dira[p.kolo.dira.typ]}${p.kolo.dira.typ === 'zavit' ? ' ' + p.kolo.dira.zavit : ' Ø ' + fmt(p.kolo.dira.prumer, 2)}${o.naboj > 0 ? ` · náboj ${fmt(o.naboj)}` : ''}`, true);
    S('sSnek', `${fmt(SNEK.delkaSneku(p, o), 1)} mm · ${p.snek.ulozeni === 'cepy' ? 'čepy Ø ' + fmt(p.snek.cep) : SNEK.NAZVY.dira[p.snek.dira.typ]}`, true);
    S('sSkrin', p.skrin.zapnuto ? `${p.skrin.loziskoSnek} + ${p.skrin.loziskoKolo}` : 'bez držáku', p.skrin.zapnuto);
  }

  /* ---------- náhled ---------- */
  function zobraz(novyPohled) {
    if (stavZobr.novy) { novyPohled = true; stavZobr.novy = false; }
    document.querySelectorAll('[data-rezim]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.rezim === stavZobr.rezim)));
    document.querySelectorAll('[data-rezimy]').forEach(el => { el.hidden = !seznam(el.dataset.rezimy).includes(stavZobr.rezim); });
    $('legPrevisy').hidden = !((stavZobr.rezim === 'tisk' || stavZobr.rezim === 'kalibrace') && nahled.stav.previsy);
    if (!model) { nahled.nastav(null); return; }
    const r = stavZobr.rezim;
    if (r === 'tisk') nahled.nastav(kusy(dilyKTisku()), { tisk: true, novyPohled, uhel: p.tisk.uhel });
    else if (r === 'kalibrace') nahled.nastav(G3D.tiskoveRozlozeni(model.kalibrace, 1, 5, 120), { tisk: true, novyPohled, uhel: p.tisk.uhel });
    else if (r === 'kolo') nahled.nastav(model.kolo, { novyPohled });
    else if (r === 'snek') nahled.nastav(model.snekPulky ? G3D.tiskoveRozlozeni(model.snekPulky, 1, 6, 400) : [model.snek], { novyPohled });
    else nahled.nastav(SNEK.sestava(model, stavZobr.fi), { novyPohled });
  }
  function nastavRezim(r) {
    const tisk = $('tTisk').getAttribute('aria-pressed') === 'true';
    const pred = stavZobr.rezim;
    stavZobr.rezim = r;
    if ((r === 'tisk') !== tisk) { $('tTisk').click(); return; }   // přepínač tiskové polohy zavolá zobrazení
    if (r === 'kalibrace' && model && !model.kalibrace.length) { stavZobr.novy = true; prepocitej(); return; }
    zobraz(pred !== r);
  }
  document.querySelectorAll('[data-rezim]').forEach(b => b.addEventListener('click', () => nastavRezim(b.dataset.rezim)));
  let casNatoc = null;
  $('natoceni').addEventListener('input', e => {
    stavZobr.fi = Number(e.target.value) / 100 * 2 * Math.PI / app.p.zaber.zubu;
    clearTimeout(casNatoc); casNatoc = setTimeout(() => { if (model && stavZobr.rezim === 'sestava') nahled.nastav(SNEK.sestava(model, stavZobr.fi)); }, 40);
  });

  /* ---------- nabídky, export ---------- */
  TrubkyGui.pripoj({ klic: 'webapp_snek_gui', pohled: j => nahled.pohled(j) });
  for (const v of SNEK.PREDVOLBY) {
    const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
    b.innerHTML = `${esc(v.nazev)}<span class="pozn">${esc(v.popis)}</span>`;
    b.addEventListener('click', () => {
      const q = SNEK.predvolba(v.id);
      q.tisk = SNEK.kopie(app.p.tisk);
      app.nahrad(q);
      nahled.pohled('iso');
    });
    $('seznamPredvoleb').appendChild(b);
  }
  function lzeExport() {
    if (!model) { Dialog.chyba(chybaStavby || (wasm ? 'Model nejde sestavit – opravte chyby v záložce Kontrola.' : 'Geometrické jádro se ještě načítá.')); return false; }
    return true;
  }
  const kusy = dily => G3D.tiskoveRozlozeni(dily, app.p.tisk.kusu, 6, 200);
  function exportVse(druh) {
    if (!lzeExport()) return;
    if (druh === 'stl') app.stahni(KRAB.stlBinarni(kusy(dilyKTisku()), 'snekovy prevod - github_site'), app.jmeno('.stl'), 'model/stl');
    else app.stahni(KRAB.soubor3mf(kusy(dilyKTisku()), app.p.nazev || 'Šnekový převod'), app.jmeno('.3mf'), 'model/3mf');
  }
  $('btnStl').addEventListener('click', () => exportVse('stl'));
  $('btn3mf').addEventListener('click', () => exportVse('3mf'));
  /** Každý díl zvlášť. */
  function exportDilu() {
    const el = $('exportDilu'); el.innerHTML = '';
    if (!model) return;
    for (const d of model.tisk) {
      const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
      b.innerHTML = `⬇ STL – ${esc(d.nazev)}<span class="pozn">jen tento díl</span>`;
      b.addEventListener('click', () => app.stahni(KRAB.stlBinarni(G3D.tiskoveRozlozeni([d], 1), 'snekovy prevod - ' + d.jmeno), app.jmeno('_' + d.jmeno + '.stl'), 'model/stl'));
      el.appendChild(b);
    }
  }
  document.querySelectorAll('[data-export]').forEach(b => b.addEventListener('click', () => {
    if (!lzeExport()) return;
    if (b.dataset.export === 'kalibrace') {
      if (!model.kalibrace.length) {
        try { model = SNEK.postav(wasm, app.p, { kalibrace: true }); } catch (e) { Dialog.chyba('Kalibrační vzorek nelze sestavit: ' + (e && e.message || e)); return; }
      }
      app.stahni(KRAB.stlBinarni(G3D.tiskoveRozlozeni(model.kalibrace, 1, 5, 120), 'snekovy prevod - kalibrace'), app.jmeno('_kalibrace.stl'), 'model/stl');
    } else app.stahni(KRAB.stlBinarni(SNEK.sestava(model, stavZobr.fi), 'snekovy prevod - sestava (vizualizace)'), app.jmeno('_sestava.stl'), 'model/stl');
  }));

  /* ---------- výkres ---------- */
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
  function vykresTed() {
    if (!lzeExport()) return null;
    const o = SNEK.odvozene(app.p), d = new Date();
    return SNEK_VYK.vykres(app.p, o, model, { datum: `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`, kusovnik: polozkyKusovniku(o) });
  }
  $('btnVykres').addEventListener('click', () => { const v = vykresTed(); if (!v) return; $('vykresObsah').innerHTML = SNEK_VYK.svg(v, { sirkaPx: true }); $('vykresDlg').showModal(); });
  const vykresSvg = () => { const v = vykresTed(); if (v) app.stahni(SNEK_VYK.svg(v), app.jmeno('_vykres.svg'), 'image/svg+xml'); };
  async function vykresPdf() {
    const v = vykresTed(); if (!v) return;
    try {
      if (!window.jspdf) throw new Error('Knihovna jsPDF se nenačetla.');
      const pismo = await nactiPismo();
      app.stahni(SNEK_VYK.pdf(window.jspdf.jsPDF, v, { pismo, nazev: app.p.nazev || 'Šnekový převod' }).output('blob'), app.jmeno('_vykres.pdf'));
      if (!pismo) Dialog.info('Písmo se nepodařilo načíst – PDF je bez diakritiky.');
    } catch (e) { Dialog.chyba('PDF se nepodařilo vytvořit: ' + (e && e.message || e)); }
  }
  $('btnVykresSvg').addEventListener('click', vykresSvg); $('btnVykresSvg2').addEventListener('click', vykresSvg);
  $('btnVykresPdf').addEventListener('click', vykresPdf); $('btnVykresPdf2').addEventListener('click', vykresPdf);
  $('btnZavritVyk').addEventListener('click', () => $('vykresDlg').close());

  app.prepinac('tRez', h => { nahled.prepni('rez', h); $('legRez').hidden = !h; });
  app.prepinac('tHrany', h => nahled.prepni('hrany', h));
  app.prepinac('tPrevisy', h => { nahled.prepni('previsy', h); $('legPrevisy').hidden = !(h && (stavZobr.rezim === 'tisk' || stavZobr.rezim === 'kalibrace')); }, true);
  app.prepinac('tPravitka', h => nahled.prepni('pravitka', h), true);
  app.prepinac('tTisk', h => {
    if (h) stavZobr.rezim = 'tisk';
    else if (stavZobr.rezim === 'tisk') stavZobr.rezim = 'sestava';
    zobraz(true);
  });

  /* ---------- start ---------- */
  app.start({
    manifold: {
      ok: w => { wasm = w; prepocitej(); },
      chyba: e => { chybaJadra = 'Geometrické jádro (manifold-3d) se nenačetlo: ' + (e && e.message || e) + ' – model ani export nejsou k dispozici.'; prepocitej(); },
    },
  });
  window.SNEK_UI = { get p() { return app.p; }, get model() { return model; }, zmen: app.zmen, nahrad: app.nahrad, prepocitej, nahled, app, nastavRezim };
})();

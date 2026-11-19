/* Trychtýře a násypky – ovládání stránky nad společným zapojením gen3d/aplikace.js
   (tady jen to, co je pro trychtýře zvláštní: databáze hrdel, viditelnost polí, souhrny, výsledky, výpočty průtoku,
   kusovník, režimy náhledu, export po dílech, kalibrační vzorky, výkres). Náhled = KNOF_NAHLED. */
/* global TRYCH, TRYCH_VYK, KNOF_NAHLED, KRAB, G3D, Dialog, TrubkyGui */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const K = TRYCH, fmt = K.fmt;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  let p, o, wasm = null, model = null, chybaStavby = '', chybaJadra = '', vyp = null;
  const stavZobr = { rezim: 'sestava' };
  const nahled = KNOF_NAHLED.vytvorNahled($('platno'), { drzPohled: true });

  const app = G3D.aplikace({
    typ: 'trychtyre', nazev: 'Trychtýře', klic: 'webapp_trychtyre', soubor: 'trychtyr',
    normalizuj: K.normalizuj, vychozi: () => K.predvolba('pet_zasun'),
    ulozProjekt: K.ulozProjekt, nactiProjekt: K.nactiProjekt, popis: K.popis,
    viditelnost: () => viditelnost(),
    prepocitej: () => prepocitej(),
    png: () => nahled.png(), pohled: j => nahled.pohled(j),
    exportStl: () => exportVse('stl'),
    nahodny: () => nahodny(),
    doModelare: () => (lzeExport() ? { data: KRAB.soubor3mf(kusy(model.tisk), app.p.nazev || 'Trychtýř'), pripona: '.3mf' } : null),
    zkratky: { r: 'tRez', h: 'tHrany', m: 'tTisk', p: 'tPrevisy', l: 'tPravitka' },
    zmenaTematu: () => prepocitej(),
  });

  /* ---------- databáze hrdel ---------- */
  (function naplnDb() {
    const skupiny = new Map();
    for (const x of K.HRDLA) { if (!skupiny.has(x.skupina)) skupiny.set(x.skupina, []); skupiny.get(x.skupina).push(x); }
    let h = '<option value="vlastni">— vlastní rozměr —</option>';
    for (const [g, s] of skupiny) h += `<optgroup label="${esc(g)}">${s.map(x => `<option value="${esc(x.id)}">${esc(x.nazev)}</option>`).join('')}</optgroup>`;
    $('dbHrdlo').innerHTML = h;
  })();
  $('dbHrdlo').addEventListener('change', () => {
    const id = $('dbHrdlo').value;
    if (id === 'vlastni') { app.zmen(q => { q.hrdlo.zdroj = 'vlastni'; }); return; }
    app.zmen(q => { K.hrdloZDb(q, id); });
    app.naplnFormular();
  });
  $('f_material').innerHTML = Object.entries(K.MATERIALY).map(([k, m]) => `<option value="${k}">${m.nazev}</option>`).join('');
  $('f_med').innerHTML = `<optgroup label="Kapaliny">${Object.entries(K.MEDIA).filter(([, m]) => !m.sypke).map(([k, m]) => `<option value="${k}">${m.nazev}</option>`).join('')}</optgroup>`
    + `<optgroup label="Sypké hmoty">${Object.entries(K.MEDIA).filter(([, m]) => m.sypke).map(([k, m]) => `<option value="${k}">${m.nazev}</option>`).join('')}</optgroup>`;

  /* ---------- viditelnost a popisy ---------- */
  const seznam = a => (a || '').split(/\s+/).filter(Boolean);
  /** data-kdyz="cesta:hodnoty;cesta!hodnoty" – všechny podmínky musí platit. */
  function plati(podm) {
    return podm.split(';').every(c => {
      const ne = c.includes('!'), [cesta, hod] = c.split(ne ? '!' : ':');
      const v = String(K.vezmi(p, cesta.trim()));
      return seznam(hod).includes(v) !== ne;
    });
  }
  document.querySelectorAll('#paletaTvaru button').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.tvar === app.p.telo.tvar) return;
    app.zmen(q => { q.telo.tvar = b.dataset.tvar; });
    app.naplnFormular();
  }));
  function viditelnost() {
    p = app.p; o = K.odvozene(p);
    document.querySelectorAll('#paletaTvaru button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tvar === p.telo.tvar)));
    document.querySelectorAll('[data-kdyz]').forEach(el => { el.hidden = !plati(el.dataset.kdyz); });
    document.querySelectorAll('[data-spoj]').forEach(el => { el.hidden = !o.dilVypusti; });
    const Hr = p.hrdlo, x = K.zdrojHrdla(p);
    $('dbHrdlo').value = x ? Hr.zdroj : 'vlastni';
    $('poznHrdlo').innerHTML = x ? `Typické rozměry (databáze ${esc(K.DATUM)}) – <b>ověřte měřením</b>.${x.pozn ? ' ' + esc(x.pozn[0].toUpperCase() + x.pozn.slice(1)) + '.' : ''}${x.upraveno ? ' Závit upravený.' : ''}`
      : 'Vlastní rozměr – změřte posuvkou (světlost = vnitřní Ø otvoru, vnější Ø = přes závit).';
    $('lHve').textContent = Hr.rezim === 'zavit' ? 'Ø závitu hrdla' : 'Vnější Ø hrdla';
    $('lVde').textContent = o.hrot ? 'Délka hrotu' : 'Délka pod hrdlem';
    $('lOh').textContent = p.odvz.typ === 'zebra' ? 'Výška žeber' : 'Hloubka';
    $('lTuh').textContent = p.telo.tvar === 'dvoj' ? 'Úhel horního kuželu' : 'Úhel kuželu';
    $('napHrdlo').textContent = {
      zasun: `Kónus se zaklíní v hrdle v hloubce ${fmt(Hr.hloubka)} mm (tam má Ø hrdla minus vůle). Menší kužel = pevnější sevření, ale menší rozsah.`,
      stupne: 'Stupně se sraženými přechody 45° – sedne na každé hrdlo mezi nejmenším a největším průměrem.',
      zavit: 'Čepička s vnitřním závitem – trychtýř se našroubuje místo víčka. Výpust vede dovnitř hrdla.',
      limec: 'Límec leží na okraji hrdla, výpust vede dovnitř; sukně přes hrdlo zvenku drží trychtýř na místě.',
      volne: 'Výpust bez spoje – do široké nádoby, násypka, odměrka.',
    }[Hr.rezim];
    $('napVypust').textContent = o.hrot ? ({
      rovna: 'Rovná výpust.', zahnuta: 'Oblouk do strany – do hrdla, ke kterému se nejde dostat shora. Tiskne se bez podpor do ohybu rovného povolenému převisu.',
      vlnovec: 'Vlnovec s boky 45° – ohebný z pružného materiálu; z tuhého spíš jen tlumí ráz.',
    }[p.vypust.tvar] + (o.dilVypusti ? ' Výpust je samostatný díl zasunutý do zásuvky těla.' : '')) : 'U závitu a límce je výpust rovná a krátká – vede jen do hrdla.';
    $('napOdvz').textContent = {
      drazky: o.hrot ? 'Podélné drážky po celém hrotu – vzduch uniká kolem výpusti nad hrdlo.' : Hr.rezim === 'zavit' ? 'Drážky přes čelo čepičky a podél závitu – vzduch uniká závitem ven.' : 'Drážky na spodku límce a přes sukni.',
      zebra: o.hrot ? 'Žebra drží výpust od stěny hrdla – vzduch uniká mezi nimi; obálka žeber tvoří kónus spoje.' : 'Žebra jsou jen na hrotu – u závitu a límce použijte drážky nebo trubičku.',
      trubicka: 'Kanálek vedle výpusti vyvedený bokem nad hrdlem. Nalévání se samo zastaví, když hladina v nádobě dosáhne konce trubičky.',
      zadne: 'Bez odvzdušnění – jen do širokých nádob nebo když výpust v hrdle netěsní.',
    }[p.odvz.typ];
    $('napTelo').textContent = o.plochy ? 'Plochý oválný trychtýř do úzkých míst (motor, mezi díly). Úhel platí pro širokou stranu, úzká je strmější.'
      : p.telo.tvar === 'nasypka' ? 'Úhel od osy = převis vnitřku při tisku ústím dolů. Válec nad kuželem zvětší objem násypky.'
        : 'Úhel od osy = převis vnitřku při tisku ústím dolů. Standardní trychtýř má vrcholový úhel 60° (tj. 30° od osy).';
    $('napTisk').innerHTML = `Tělo se tiskne <b>ústím dolů</b> (okraj a ucho na podložce, vnitřek kuželu je převis ${fmt(o.uhelMax || 0, 0)}° od svislice), samostatná výpust spojem dolů, prodloužení zásuvkou dolů, víčko lícem dolů. Boky závitu (60°) se tisknou běžně. Doporučeno PETG (paliva, oleje), PP nebo PA; PLA jen na vodu a sypké hmoty. 3 perimetry, 15–20 % výplně.`;
  }

  /* ---------- přepočet ---------- */
  function prepocitej() {
    p = app.p; o = K.odvozene(p);
    nahled.barvy(css('--border-strong'), css('--border'), css('--text'));
    let H = K.kontroly(p);
    model = null; chybaStavby = chybaJadra;
    if (wasm && !o.chyba && !H.some(x => x.uroven === 'chyba')) {
      try {
        model = K.postav(wasm, p, { kalibrace: stavZobr.rezim === 'kalibrace' });
        o = model.o;
        H = H.concat(K.kontrolyModelu(p, model));
      } catch (e) { chybaStavby = 'Model nelze sestavit: ' + (e && e.message || e); }
    } else if (wasm && !chybaStavby) chybaStavby = 'Model nelze sestavit – opravte chybu v záložce Kontrola.';
    vyp = o.chyba ? null : K.vypocty(p, o);
    if (vyp && vyp.tesny && vyp.omezeni > 0.6 && p.odvz.typ !== 'zadne') H.push({ uroven: 'info', pole: ['odvz.pocet', 'odvz.sirka', 'odvz.hloubka', 'odvz.trubicka'], text: `Odvzdušnění zpomalí nalévání o ${fmt(vyp.omezeni * 100, 0)} % (vzduch v něm proudí ${fmt(vyp.vVzduch, 0)} m/s) – přidejte drážky nebo je rozšiřte.` });
    const st = $('stav3d');
    st.textContent = wasm || chybaJadra ? chybaStavby : 'Načítám geometrické jádro…';
    st.classList.toggle('chyba', !!chybaStavby);
    zobraz(false);
    app.hlaseni(H, { chybaStavby, boxy: ['boxHrdlo', 'boxTelo'] });
    vypisVysledky();
    souhrny();
    vypisVypocty();
    naplnExporty();
  }
  const box = (a, b, c, d) => G3D.dlazdice(a, b, c, d);
  const mat = () => K.MATERIALY[p.tisk.material];
  const cas = s => (!Number.isFinite(s) ? '∞' : s < 90 ? `${fmt(s, s < 10 ? 1 : 0)} s` : `${fmt(s / 60, 1)} min`);
  const dilu = n => (n === 1 ? '1 díl' : n < 5 ? n + ' díly' : n + ' dílů');
  function popisSpoje() {
    const Hr = p.hrdlo;
    return {
      zasun: `kónus Ø ${fmt(2 * (o.rw || 0), 2)} v hl. ${fmt(Hr.hloubka)}`, stupne: `stupně Ø ${fmt(Hr.dMin, 1)}–${fmt(Hr.dMax, 1)}`,
      zavit: `závit Ø ${fmt(Hr.vnejsi, 1)} × ${fmt(Hr.stoupani, 2)}`, limec: `límec na Ø ${fmt(Hr.vnejsi, 1)}`, volne: `volná Ø ${fmt(p.vypust.prumer, 1)}`,
    }[Hr.rezim];
  }
  function vypisVysledky() {
    const el = $('vVysledky'), karta = $('karta3d');
    if (!model) { el.innerHTML = box('Model', wasm || chybaJadra ? 'nelze sestavit' : 'načítám…', chybaStavby); karta.innerHTML = ''; $('vSit').innerHTML = ''; $('kusovnik').innerHTML = ''; return; }
    const m = model, M = mat();
    const V = m.tisk.reduce((s, d) => s + d.objem, 0) * p.tisk.sad;
    const od = G3D.odhadTisku(V, M.hustota, { dilu: m.tisk.length * p.tisk.sad });
    const B = m.sestava.filter(d => d.jmeno !== 'stojanek').reduce((b, d) => { const q = G3D.obal(d.poz); for (let i = 0; i < 3; i++) { b[i] = Math.min(b[i], q[i]); b[i + 3] = Math.max(b[i + 3], q[i + 3]); } return b; }, [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]);
    let h = box('Ústí', o.plochy ? `${fmt(2 * o.a)} × ${fmt(2 * o.b)} mm` : `Ø ${fmt(2 * o.Rout)} mm`, `${K.NAZVY.tvar[p.telo.tvar]} · ${fmt(o.uhelMax, 0)}° od osy`, o.uhelMax > p.tisk.uhel ? 'mez-t' : '');
    h += box('Spoj s hrdlem', popisSpoje(), K.NAZVY.rezim[p.hrdlo.rezim]);
    h += box('Průchod výpusti', `Ø ${fmt(2 * o.ri, 1)} mm`, `${K.NAZVY.vypust[p.vypust.tvar]} · ${fmt(o.delkaVypusti, 0)} mm${o.ohyb ? ` · ohyb ${fmt(o.ohyb)}°` : ''}`);
    h += box('Objem', `${fmt(o.objemCelkem, 0)} ml`, 'po okraj, s výpustí zavřenou na konci');
    h += box('Rozměry sestavy', `${fmt(B[3] - B[0], 0)} × ${fmt(B[4] - B[1], 0)} × ${fmt(B[5] - B[2], 0)} mm`, dilu(m.tisk.length));
    if (vyp && !vyp.medium.sypke) h += box('Nalévání', `${fmt(vyp.Q, 2)} l/s`, `${vyp.medium.nazev} · plný trychtýř se vyprázdní za ${cas(vyp.cas)}`);
    else if (vyp) h += box('Průtok', vyp.Q > 0 ? `${fmt(vyp.Q * 60, 1)} l/min` : 'neteče', vyp.medium.nazev, vyp.Q > 0 ? '' : 'mez-t');
    h += box('Hmotnost', `${fmt(od.g, od.g < 10 ? 1 : 0)} g`, p.tisk.sad > 1 ? `${M.nazev}, plné díly, ${p.tisk.sad} sady` : `${M.nazev}, plné díly`);
    h += box('Filament', `${fmt(od.metru, 1)} m`, `průměr 1,75 mm · ${fmt(V / 1000, 1)} cm³`);
    h += box('Doba tisku', `≈ ${od.minut < 60 ? od.minut + ' min' : fmt(od.minut / 60, 1) + ' h'}`, `${dilu(m.tisk.length * p.tisk.sad)} · hrubý odhad`);
    el.innerHTML = h;
    // kusovník
    const navic = [];
    if (o.dilVypusti) navic.push([`Kapka lepidla na zasouvací spoje (nepovinné) – ${m.tisk.filter(d => /prodlouzeni|vypust/.test(d.jmeno)).length}×`, '']);
    if (p.hrdlo.rezim === 'zavit') navic.push(['Těsnění není potřeba – trychtýř se dotahuje jen rukou', '']);
    $('kusovnik').innerHTML = `<table class="tabulka"><thead><tr><th>Díl</th><th class="c">Kusů</th><th class="c">Rozměr</th><th class="c">Objem</th></tr></thead><tbody>`
      + m.tisk.map(d => { const q = G3D.obal(d.poz); return `<tr><td>${esc(d.nazev)}</td><td class="c">${p.tisk.sad}</td><td class="c">${fmt(q[3] - q[0], 1)} × ${fmt(q[4] - q[1], 1)} × ${fmt(q[5] - q[2], 1)}</td><td class="c">${fmt(d.objem / 1000, 1)} cm³</td></tr>`; }).join('')
      + navic.map(([n]) => `<tr><td colspan="4">+ ${esc(n)}</td></tr>`).join('') + '</tbody></table>'
      + `<p class="napoveda">Rozměry hrdel z databáze jsou typické (${esc(K.DATUM)}) – ověřte posuvkou, případně vytiskněte kalibrační vzorky.</p>`;
    const titul = { sestava: 'Sestava', tisk: 'Díly k tisku', kalibrace: 'Kalibrační vzorky' }[stavZobr.rezim];
    karta.innerHTML = `<div class="titul">${titul}</div>${o.plochy ? `<b>${fmt(2 * o.a)} × ${fmt(2 * o.b)}</b>` : `Ø <b>${fmt(2 * o.Rout)}</b>`} mm · <b>${fmt(o.objemCelkem, 0)}</b> ml<br>${esc(popisSpoje())}<br>${dilu(m.tisk.length)} · <b>${fmt(od.g, 0)}</b> g ${M.nazev}`;
    $('vSit').innerHTML = m.tisk.concat(m.kalibrace).map(d => { const k = KRAB.kontrolaSite(d.poz, d.idx), ok = k.uzavrena && d.teles === 1; return box('Síť – ' + d.nazev, ok ? '✔ těsná' : '✖ netěsná', `${k.trojuhelniku} trojúhelníků, ${d.teles} ${d.teles === 1 ? 'těleso' : 'tělesa'}`, ok ? 'ok-t' : 'chyba-t'); }).join('')
      + box('Stavba', `${m.cas} ms`, 'manifold-3d');
  }
  function souhrny() {
    TrubkyGui.souhrn('sHrdlo', popisSpoje(), true);
    TrubkyGui.souhrn('sVypust', `Ø ${fmt(2 * o.ri, 1)} · ${K.NAZVY.vypust[o.hrot ? p.vypust.tvar : 'rovna']}${o.dilVypusti ? ' · zvlášť' : ''}`, true);
    TrubkyGui.souhrn('sOdvz', p.odvz.typ === 'trubicka' ? `trubička Ø ${fmt(p.odvz.trubicka, 1)}` : p.odvz.typ === 'zadne' ? 'žádné' : `${p.odvz.pocet} × ${K.NAZVY.odvz[p.odvz.typ]}`, p.odvz.typ !== 'zadne');
    TrubkyGui.souhrn('sProdl', p.prodlouzeni.dilu ? `${p.prodlouzeni.dilu} × ${fmt(p.prodlouzeni.delka)} mm` : 'bez', p.prodlouzeni.dilu > 0);
    TrubkyGui.souhrn('sTelo', o.plochy ? `${fmt(p.telo.sirka)} × ${fmt(p.telo.hloubkaO)} · ${fmt(p.telo.uhel)}°` : `Ø ${fmt(p.telo.prumer)} · ${fmt(p.telo.uhel)}°`, true);
    TrubkyGui.souhrn('sOkraj', [p.telo.okraj > 0 ? `okraj ${fmt(p.telo.okraj)}` : '', p.telo.ucho ? 'ucho' : ''].filter(Boolean).join(' · ') || 'bez', p.telo.okraj > 0 || p.telo.ucho);
    TrubkyGui.souhrn('sStupnice', p.stupnice.zap ? `${o.rysky.length} rysek po ${fmt(p.stupnice.krok)} ml` : 'vypnuto', p.stupnice.zap);
    TrubkyGui.souhrn('sDeleni', p.deleni.zap ? (o.del ? `ve výšce ${fmt(o.del.zs, 0)} mm` : 'zapnuto') : 'vypnuto', p.deleni.zap);
    const dpl = [p.doplnky.vicko && 'víčko', p.doplnky.zatka && 'zátka', p.doplnky.stojanek && 'stojánek'].filter(Boolean);
    TrubkyGui.souhrn('sDoplnky', dpl.join(' · ') || 'žádné', dpl.length > 0);
    const kal = p.kalibrace, Hr = p.hrdlo;
    TrubkyGui.souhrn('sKalibrace', `${kal.kusu} × po ${fmt(kal.krok, 2)}`, false);
    const v0 = Hr.vule - (kal.kusu - 1) / 2 * kal.krok, v1 = Hr.vule + (kal.kusu - 1) / 2 * kal.krok;
    $('napKalibrace').textContent = ['zasun', 'zavit', 'limec'].includes(Hr.rezim)
      ? `Vzorky 1–${kal.kusu} = ${{ zasun: 'kónus', zavit: 'čepička se závitem', limec: 'límec se sukní' }[Hr.rezim]} s vůlí ${fmt(v0, 2)} až ${fmt(v1, 2)} mm (prostřední = nastavená ${fmt(Hr.vule, 2)} mm). Číslo vzorku = počet zářezů na přírubě. Vyzkoušejte je na hrdle a vůli nejlepšího zapište do pole Vůle.`
      : 'Kalibrační vzorky jsou pro kónus, závit a límec – stupňovitý kónus a volná výpust se nelícují.';
    $('tabRysky').innerHTML = o.rysky.length ? '<tr><th>Ryska</th><th class="c">Objem</th><th class="c">Výška nad výpustí</th></tr>' + o.rysky.map((r, i) => `<tr><td>${i + 1}${r.dlouha ? ' (dlouhá)' : ''}</td><td class="c">${fmt(r.V, 0)} ml</td><td class="c">${fmt(r.z, 1)} mm</td></tr>`).join('') : '';
  }

  /* ---------- výpočty ---------- */
  function vypisVypocty() {
    const el = $('vVypocty'), gr = $('grafPrutok');
    if (!vyp) { el.innerHTML = box('Výpočty', '–', 'nejdřív opravte chyby v záložce Kontrola'); gr.hidden = true; return; }
    const r = vyp, m = r.medium;
    let h;
    if (m.sypke) {
      h = box('Průtok (Beverloo)', r.Q > 0 ? `${fmt(r.W * 60, 1)} kg/min` : 'neteče', r.Q > 0 ? `${fmt(r.Q * 60, 2)} l/min · nezávisí na výšce násypu` : m.soudrzna ? 'soudržná hmota – klenby, Beverloo neplatí' : 'výpust je na zrno úzká', r.Q > 0 ? '' : 'mez-t');
      h += box('Vyprázdnění', cas(r.cas), `${fmt(r.objem, 0)} ml při naplnění ${fmt(p.vypocty.plneni, 0)} %`);
      h += box('Výpust / zrno', `${fmt(r.D / m.zrno, 1)} ×`, `Ø ${fmt(r.D, 1)} mm / zrno ${fmt(m.zrno, 2)} mm · aspoň 6× proti zaklínění`, r.zaklineni ? 'chyba-t' : 'ok-t');
      h += box('Úhel kuželu', `${fmt(o.uhelMax, 0)}°`, `pro tok celou hmotou do ${m.uhel}° od osy`, o.uhelMax > m.uhel ? 'mez-t' : 'ok-t');
      $('napVypocty').textContent = 'Sypké hmoty: Beverlooho vztah W = 0,58 ρ √g (D − 1,5 d)^2,5 – průtok otvorem nezávisí na výšce násypu. Hodnoty sypné hustoty a zrna jsou orientační.';
      gr.hidden = true;
    } else {
      h = box('Průtok – plný trychtýř', `${fmt(r.Q, 2)} l/s`, `${fmt(r.Q * 60, 1)} l/min · ${m.nazev}${r.tesny && r.omezeni > 0.02 ? ` · bez omezení vzduchem ${fmt(r.Qvolny, 2)} l/s` : ''}`);
      h += box('Rychlost ve výpusti', `${fmt(r.Q / 1000 / (Math.PI * r.D * r.D / 4e6), 2)} m/s`, `Re ${fmt(r.Re, 0)} · ${r.rezim}`);
      h += box('Torricelli (ideál)', `${fmt(r.torricelli, 2)} l/s`, 'bez tření a ztrát – horní mez');
      h += box('Vyprázdnění', cas(r.cas), `${fmt(r.objem, 0)} ml při naplnění ${fmt(p.vypocty.plneni, 0)} %`);
      h += box('Spád', `${fmt(r.zPln + r.pokles, 0)} mm`, `hladina ${fmt(r.zPln, 0)} + výpust ${fmt(r.pokles, 0)} mm`);
      if (r.tesny) h += box('Odvzdušnění', r.Avzduch > 0 ? `−${fmt(r.omezeni * 100, 0)} %` : 'žádné', r.Avzduch > 0 ? `průřez ${fmt(r.Avzduch, 1)} mm² · vzduch ${fmt(r.vVzduch, 0)} m/s` : 'kapalina bude bublat nebo stát', r.Avzduch > 0 ? (r.omezeni > 0.6 ? 'mez-t' : 'ok-t') : 'chyba-t');
      $('napVypocty').textContent = 'Průtok výpustí: Bernoulli se ztrátami (vtok, ohyb, vlnovec, tření – laminárně přesně, turbulentně Swamee–Jain), spád = hladina v trychtýři + délka výpusti. U těsného spoje musí stejný průtok vzduchu odejít odvzdušněním – jeho odpor sloupec kapaliny zpomalí. Doba vyprázdnění je integrál objemu přes průtok při klesající hladině. Viskozity jsou orientační (20 °C).';
      // graf: průtok podle výšky hladiny
      const n = 24, body = [], Hm = o.zTop;
      for (let i = 0; i <= n; i++) {
        const z = Hm * i / n, q = K.vypocty(Object.assign(K.kopie(p), { vypocty: { medium: p.vypocty.medium, plneni: Math.max(5, 100 * i / n) } }), o);
        body.push({ z, Q: q ? q.Q : 0 });
      }
      const W = 320, Hh = 120, L0 = 44, Rr = 8, T0 = 8, B0 = 20, qmax = Math.max(...body.map(b => b.Q), 1e-6) * 1.1;
      const X = z => L0 + (W - L0 - Rr) * z / Hm, Y = q => T0 + (Hh - T0 - B0) * (1 - q / qmax);
      gr.hidden = false;
      gr.innerHTML = `<h3>Průtok podle výšky hladiny v trychtýři</h3><svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Průtok podle výšky hladiny: plný ${fmt(r.Q, 2)} l/s">`
        + `<line class="osa" x1="${L0}" y1="${Y(0)}" x2="${W - Rr}" y2="${Y(0)}"/><line class="osa" x1="${L0}" y1="${T0}" x2="${L0}" y2="${Y(0)}"/>`
        + `<text class="popis-osy" x="${L0 - 4}" y="${Y(0) + 3}" text-anchor="end">0</text><text class="popis-osy" x="${L0 - 4}" y="${T0 + 8}" text-anchor="end">${fmt(qmax / 1.1, 2)} l/s</text>`
        + `<text class="popis-osy" x="${L0}" y="${Hh - 5}">0 mm</text><text class="popis-osy" x="${W - Rr}" y="${Hh - 5}" text-anchor="end">${fmt(Hm, 0)} mm</text>`
        + `<polyline class="cara" points="${body.map(b => `${X(b.z).toFixed(1)},${Y(b.Q).toFixed(1)}`).join(' ')}"/>`
        + `<circle class="bod" r="4" cx="${X(r.zPln).toFixed(1)}" cy="${Y(r.Q).toFixed(1)}"/></svg>`;
    }
    el.innerHTML = h;
  }

  /* ---------- náhled ---------- */
  function zobraz(novyPohled) {
    document.querySelectorAll('[data-rezim]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.rezim === stavZobr.rezim)));
    if (!model) { nahled.nastav(null); return; }
    const r = stavZobr.rezim;
    if (r === 'tisk') nahled.nastav(kusy(model.tisk), { tisk: true, novyPohled, uhel: p.tisk.uhel });
    else if (r === 'kalibrace') nahled.nastav(G3D.tiskoveRozlozeni(model.kalibrace, 1, 5, 200), { tisk: true, novyPohled, uhel: p.tisk.uhel });
    else nahled.nastav(model.sestava, { novyPohled });
    $('legPrevisy').hidden = !((r === 'tisk' || r === 'kalibrace') && nahled.stav.previsy);
  }
  function nastavRezim(r) {
    const tisk = $('tTisk').getAttribute('aria-pressed') === 'true';
    const predchozi = stavZobr.rezim;
    stavZobr.rezim = r;
    const chybiKal = () => r === 'kalibrace' && model && !model.kalibrace.length;
    if ((r === 'tisk') !== tisk) { $('tTisk').click(); if (!chybiKal()) return; }
    if (chybiKal()) { prepocitej(); zobraz(true); return; }
    zobraz(predchozi !== r);
    if (model) vypisVysledky();
  }
  document.querySelectorAll('[data-rezim]').forEach(b => b.addEventListener('click', () => nastavRezim(b.dataset.rezim)));
  $('btnKalibrace').addEventListener('click', () => nastavRezim('kalibrace'));

  /* ---------- předvolby, náhoda ---------- */
  TrubkyGui.pripoj({ klic: 'webapp_trychtyre_gui', pohled: j => nahled.pohled(j) });
  for (const v of K.PREDVOLBY) {
    const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
    b.innerHTML = `${esc(v.nazev)}<span class="pozn">${esc(v.popis)}</span>`;
    b.addEventListener('click', () => {
      const q = K.predvolba(v.id);
      q.tisk = K.kopie(app.p.tisk); q.kalibrace = K.kopie(app.p.kalibrace);
      app.nahrad(q);
      nahled.pohled('iso');
    });
    $('seznamPredvoleb').appendChild(b);
  }
  /** Náhodný trychtýř z předvolby s pozměněnými rozměry (vždy bez chyb – jinak další pokus). */
  function nahodny() {
    for (let i = 0; i < 30; i++) {
      const pv = K.PREDVOLBY[Math.floor(Math.random() * K.PREDVOLBY.length)];
      const q = K.predvolba(pv.id), r = (a, b) => a + (b - a) * Math.random();
      q.tisk = K.kopie(app.p.tisk);
      if (q.telo.tvar === 'plochy') { q.telo.sirka = Math.round(r(80, 160)); q.telo.hloubkaO = Math.round(r(35, 70)); } else q.telo.prumer = Math.round(r(Math.max(60, q.telo.prumer * 0.7), Math.min(q.tisk.podlozka - 30, q.telo.prumer * 1.3)));
      q.telo.uhel = Math.round(r(22, Math.min(45, q.tisk.uhel)));
      q.telo.ucho = Math.random() < 0.6;
      q.stupnice.zap = q.telo.tvar !== 'plochy' && Math.random() < 0.3;
      q.nazev = 'Náhodný trychtýř';
      if (!K.kontroly(q).some(h => h.uroven === 'chyba')) return q;
    }
    return K.predvolba('pet_zasun');
  }

  /* ---------- export ---------- */
  function lzeExport() {
    if (!model) { Dialog.chyba(chybaStavby || 'Geometrické jádro se ještě načítá.'); return false; }
    return true;
  }
  const kusy = dily => G3D.tiskoveRozlozeni(dily, app.p.tisk.sad, 8, app.p.tisk.podlozka);
  function exportVse(druh) {
    if (!lzeExport()) return;
    if (druh === 'stl') app.stahni(KRAB.stlBinarni(kusy(model.tisk), 'trychtyre - github_site'), app.jmeno('.stl'), 'model/stl');
    else app.stahni(KRAB.soubor3mf(kusy(model.tisk), app.p.nazev || 'Trychtýř'), app.jmeno('.3mf'), 'model/3mf');
  }
  $('btnStl').addEventListener('click', () => exportVse('stl'));
  $('btn3mf').addEventListener('click', () => exportVse('3mf'));
  let podpisExportu = '';
  function naplnExporty() {
    const dily = model ? model.tisk : [], podpis = dily.map(d => d.jmeno + d.nazev).join('|');
    if (podpis === podpisExportu) return;
    podpisExportu = podpis;
    $('seznamExportu').innerHTML = dily.length > 1 ? dily.map(d => `<button class="pol" role="menuitem" data-export-dil="${esc(d.jmeno)}">⬇ STL – ${esc(d.nazev)}</button>`).join('') : '';
  }
  $('seznamExportu').addEventListener('click', e => {
    const b = e.target.closest('[data-export-dil]');
    if (!b || !lzeExport()) return;
    const d = model.tisk.find(x => x.jmeno === b.dataset.exportDil);
    if (d) app.stahni(KRAB.stlBinarni(G3D.tiskoveRozlozeni([d], app.p.tisk.sad, 8, app.p.tisk.podlozka), 'trychtyre - ' + d.jmeno), app.jmeno('_' + d.jmeno + '.stl'), 'model/stl');
  });
  document.querySelectorAll('[data-export="kalibrace"]').forEach(b => b.addEventListener('click', () => {
    if (!lzeExport()) return;
    if (!['zasun', 'zavit', 'limec'].includes(app.p.hrdlo.rezim)) { Dialog.info('Kalibrační vzorky jsou pro kónus, závit a límec.'); return; }
    let kal = model.kalibrace;
    if (!kal.length) {
      try { kal = K.postav(wasm, app.p, { kalibrace: true }).kalibrace; } catch (e) { Dialog.chyba('Kalibrační vzorky nelze sestavit: ' + (e && e.message || e)); return; }
    }
    app.stahni(KRAB.stlBinarni(G3D.tiskoveRozlozeni(kal, 1, 5, 200), 'trychtyre - kalibrace'), app.jmeno('_kalibrace.stl'), 'model/stl');
  }));

  /* ---------- výkres ---------- */
  function svgVykresu() {
    if (!lzeExport()) return null;
    const d = new Date(), M = mat();
    const hm = model.tisk.reduce((s, x) => s + x.objem, 0) * M.hustota / 1000;
    const kus = model.tisk.map(x => [x.nazev, app.p.tisk.sad]);
    return TRYCH_VYK.sestavVykres(app.p, model, {
      datum: `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`, hmotnost: hm, material: M.nazev, kusovnik: kus,
      prutok: vyp ? (vyp.medium.sypke ? `${fmt(vyp.W * 60, 1)} kg/min ${vyp.medium.nazev}` : `${fmt(vyp.Q, 2)} l/s ${vyp.medium.nazev}`) : '',
    });
  }
  function ukazVykres() { const svg = svgVykresu(); if (!svg) return; $('vykresObsah').innerHTML = svg; $('vykresDlg').showModal(); }
  function ulozSvg() { const svg = svgVykresu(); if (svg) app.stahni(svg, app.jmeno('_vykres.svg'), 'image/svg+xml'); }
  function tiskni() {
    const svg = svgVykresu(); if (!svg) return;
    const ram = document.createElement('iframe');
    ram.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(ram);
    const d = ram.contentDocument;
    d.open(); d.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(app.jmeno(''))}</title><style>@page{size:A4 landscape;margin:0}html,body{margin:0;padding:0}svg{display:block;width:297mm;height:210mm}</style></head><body>${svg}</body></html>`); d.close();
    setTimeout(() => { try { ram.contentWindow.focus(); ram.contentWindow.print(); } finally { setTimeout(() => ram.remove(), 60000); } }, 250);
  }
  $('btnVykres').addEventListener('click', ukazVykres);
  $('btnVykresSvg').addEventListener('click', ulozSvg);
  $('btnVykresSvg2').addEventListener('click', ulozSvg);
  $('btnVykresTisk').addEventListener('click', tiskni);
  $('btnVykresTisk2').addEventListener('click', tiskni);
  $('btnZavritVyk').addEventListener('click', () => $('vykresDlg').close());

  app.prepinac('tRez', h => { nahled.prepni('rez', h); $('legRez').hidden = !h; });
  app.prepinac('tHrany', h => nahled.prepni('hrany', h));
  app.prepinac('tPrevisy', h => { nahled.prepni('previsy', h); $('legPrevisy').hidden = !(h && (stavZobr.rezim === 'tisk' || stavZobr.rezim === 'kalibrace')); }, true);
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
  window.TRYCH_UI = { get p() { return app.p; }, get model() { return model; }, get vyp() { return vyp; }, zmen: app.zmen, nahrad: app.nahrad, prepocitej, nahled, app, nastavRezim, svgVykresu };
})();

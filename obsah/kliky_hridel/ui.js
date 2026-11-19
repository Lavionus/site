/* Kliky a ruční kola na hřídel – ovládání stránky nad společným zapojením gen3d/aplikace.js
   (tady jen to, co je pro kliky zvláštní: viditelnost polí, souhrny, výsledky, mechanika, kusovník, výkres, export po dílech).
   Náhled = KNOF_NAHLED. Režimy: sestava, tisk (díly na podložce), kalibrace. */
/* global KLH, KLH_GEOM, KLH_VYK, KNOF_NAHLED, KRAB, G3D, Dialog, TrubkyGui */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const fmt = KLH.fmt;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  let p, wasm = null, model = null, chybaStavby = '', chybaJadra = '', mech = null;
  const stavZobr = { rezim: 'sestava' };
  const nahled = KNOF_NAHLED.vytvorNahled($('platno'), { drzPohled: true });

  const app = G3D.aplikace({
    typ: 'kliky_hridel', nazev: 'Kliky na hřídel', klic: 'webapp_kliky_hridel', soubor: 'klika',
    normalizuj: KLH.normalizuj, vychozi: () => KLH.predvolba('klika'),
    ulozProjekt: KLH.ulozProjekt, nactiProjekt: KLH.nactiProjekt, popis: KLH.popis,
    vezmi: KLH.vezmi, poloz: KLH.poloz,
    viditelnost: () => viditelnost(),
    prepocitej: () => prepocitej(),
    png: () => nahled.png(), pohled: j => nahled.pohled(j),
    exportStl: () => exportVse('stl'),
    doModelare: () => (lzeExport() ? { data: KRAB.soubor3mf(kusy(dilyKTisku()), app.p.nazev || 'Klika'), pripona: '.3mf' } : null),
    zkratky: { r: 'tRez', h: 'tHrany', m: 'tTisk', p: 'tPrevisy', l: 'tPravitka' },
    diry: true,
    zmenaTematu: () => prepocitej(),
  });

  /* ---------- výběry ---------- */
  const moznosti = (sel, obj, popis) => { $(sel).innerHTML = Object.entries(obj).map(([k, v]) => `<option value="${k}">${esc(popis(v, k))}</option>`).join(''); };
  moznosti('f_tvar', KLH.NAZVY.tvar, v => v);
  document.querySelectorAll('#paletaDruhu button').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.dlazdice !== app.p.druh) app.zmen(q => { q.druh = b.dataset.dlazdice; });
  }));
  moznosti('f_hz', KLH.ZAVITY, v => v.nazev);
  for (const id of ['f_ns', 'f_ds', 'f_dp']) moznosti(id, KLH.SROUBY, (v, k) => k);
  moznosti('f_material', KLH.MATERIALY, v => v.nazev);
  $('f_hpv').innerHTML = '<option value="">– vlastní rozměr –</option>' + KLH.HRIDELE.map(h => `<option value="${h.id}">${esc(h.nazev)}</option>`).join('');
  $('f_hpv').addEventListener('change', e => {
    const id = e.target.value; if (!id) return;
    app.zmen(q => { KLH.nastavHridel(q, id); });
    app.naplnFormular();
  });

  const seznam = a => (a || '').split(/\s+/).filter(Boolean);
  function viditelnost() {
    p = app.p;
    const o = KLH.odvozene(p);
    document.querySelectorAll('[data-druh],[data-nedruh],[data-tvar],[data-netvar],[data-jisteni],[data-matice],[data-stupnice],[data-krouzek],[data-uchyceni],[data-loukote],[data-neprochozi],[data-sdrzadlem]').forEach(el => {
      const d = el.dataset;
      let vid = true;
      if (d.druh && !seznam(d.druh).includes(p.druh)) vid = false;
      if (d.nedruh && seznam(d.nedruh).includes(p.druh)) vid = false;
      if (d.tvar && !seznam(d.tvar).includes(p.hridel.tvar)) vid = false;
      if (d.netvar && seznam(d.netvar).includes(p.hridel.tvar)) vid = false;
      if (d.jisteni && !seznam(d.jisteni).includes(p.naboj.jisteni)) vid = false;
      if (d.matice && !(p.naboj.jisteni !== 'zadne' || (p.hridel.tvar === 'zavit' && p.hridel.zavitTyp === 'matice'))) vid = false;
      if (d.stupnice && p.stupnice.typ === 'zadna') vid = false;
      if (d.krouzek && p.stupnice.typ !== 'krouzek') vid = false;
      if (d.uchyceni && (p.drzadlo.uchyceni !== d.uchyceni || p.druh === 'sklopna')) vid = false;
      if (d.loukote && p.kolo.loukoti === 0) vid = false;
      if (d.neprochozi && p.hridel.pruchozi) vid = false;
      if (d.sdrzadlem && !o.sDrzadlem) vid = false;
      el.hidden = !vid;
    });
    $('l_hd').textContent = p.hridel.tvar === 'sestihran' || p.hridel.tvar === 'ctyrhran' ? 'Přes plošky' : 'Průměr';
    $('l_rl').textContent = p.druh === 'paka' ? 'Délka k zalomení / kouli' : 'Délka ramene';
    $('l_ktl').textContent = p.kolo.loukoti === 0 ? 'Tloušťka desky' : 'Tloušťka loukotě';
    $('napHridel').textContent = {
      kruh: 'Kulatý otvor potřebuje jištění – stavěcí šroub nebo štěrbinu.',
      d: 'Ploška míří ke stavěcímu šroubu (šroub tlačí na plošku).',
      sestihran: 'Šestihran přenese moment tvarem; vhodné pro bit 1/4″ nebo šestihrannou hřídel.',
      ctyrhran: 'Čtyřhran přenese moment tvarem (vřetena ventilů, ruční kola).',
      pero: 'Drážka pro pero DIN 6885 podle průměru hřídele; pero je ocelové, kupované.',
      zavit: p.hridel.zavitTyp === 'matice' ? 'Matice se zalisuje do šestihranné kapsy v předním čele – utahováním se tlačí do materiálu.' : 'Tištěný vnitřní závit – vhodný od M8, jemné závity raději s maticí.',
    }[p.hridel.tvar];
    $('napNaboj').textContent = {
      zadne: 'Bez jištění – jen pro tvarové otvory nebo závit.',
      stavec: 'Stavěcí šroub míří do −X (proti rameni), matice se zasune z boku do kapsy.',
      sterbina: 'Štěrbina nad tělem rozřízne náboj, šroub ji stáhne – bez vůle, nastavitelné kdekoli na hřídeli.',
    }[p.naboj.jisteni];
    $('napDruh').textContent = {
      klika: 'Rameno naplocho, na konci otvor pro čep otočného držadla.',
      kolo: 'Věnec s loukotěmi (0 = plné kolo), volitelně otočné držadlo na věnci.',
      hvezda: 'Ramena s kulatými laloky; 2 ramena = křídlová rukojeť.',
      paka: 'Páka s koulí na konci; zalomení v rovině ramene (0 mm = rovná).',
      sklopna: 'Na konci ramene jazyk pantu, držadlo s vidlicí se sklopí ven za konec ramene.',
    }[p.druh];
    $('napDrzadlo').textContent = p.druh === 'sklopna' ? 'Držadlo s vidlicí drží na šroubu pantu s pojistnou maticí.'
      : p.drzadlo.uchyceni === 'zacvak' ? 'Čep je součástí držadla, rozříznutý konec se zobáčkem se zacvakne za rameno.'
        : 'Šroub prochází čepem a držadlem, matice je v čele držadla, podložka a hlava u stroje.';
  }

  /* ---------- přepočet ---------- */
  function prepocitej() {
    p = app.p;
    document.querySelectorAll('#paletaDruhu button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.dlazdice === p.druh)));
    nahled.barvy(css('--border-strong'), css('--border'), css('--text'));
    let H = KLH.kontroly(p);
    const o = KLH.odvozene(p);
    model = null; chybaStavby = chybaJadra; mech = o.chyba ? null : KLH.mechanika(p, o);
    if (wasm && !o.chyba) {
      try {
        model = KLH_GEOM.postav(wasm, p, { kalibrace: stavZobr.rezim === 'kalibrace' || p.tisk.kalibrace });
        H = H.concat(KLH_GEOM.kontrolyModelu(p, model, G3D));
      } catch (e) { chybaStavby = 'Model nelze sestavit: ' + (e && e.message || e); }
    } else if (wasm) chybaStavby = 'Model nelze sestavit – opravte chybu v záložce Kontrola.';
    const st = $('stav3d');
    st.textContent = wasm || chybaJadra ? chybaStavby : 'Načítám geometrické jádro…';
    st.classList.toggle('chyba', !!chybaStavby);
    zobraz(false);
    app.hlaseni(H, { chybaStavby, boxy: ['boxNaboj', 'boxTvar'] });
    vypisVysledky(o);
    souhrny(o);
    vypisMech(o);
    if (!$('vykresObsah').closest('[hidden]')) kresliVykres();
  }
  /** Hodnota dílku čitelně: mm, u palcového stoupání i tisíciny palce. */
  function dilekText(o) {
    const s = `${fmt(o.dilek, o.dilek < 0.01 ? 4 : 3)} mm`;
    return o.palce ? `${s} (${fmt(o.dilek / 25.4 * 1000, 2)} tis. palce)` : s;
  }
  function souhrny(o) {
    const h = p.hridel, N = KLH.NAZVY;
    TrubkyGui.souhrn('sHridel', h.tvar === 'zavit' ? `${KLH.ZAVITY[h.zavit].nazev} · ${N.zavitTyp[h.zavitTyp]}` : `${N.tvar[h.tvar]} ${fmt(h.prumer, 2)} · vůle ${fmt(h.vule, 2)}`, true);
    TrubkyGui.souhrn('sNaboj', `Ø ${fmt(p.naboj.prumer)} × ${fmt(p.naboj.delka)} · ${N.jisteni[p.naboj.jisteni]}`, true);
    TrubkyGui.souhrn('sStupnice', p.stupnice.typ === 'zadna' ? 'bez stupnice' : `${p.stupnice.dilku} dílků · ${N.stupnice[p.stupnice.typ]}`, true);
    TrubkyGui.souhrn('sDruh', `${N.druh[p.druh]} · rameno ${fmt(o.Ref, 0)} mm`, true);
    TrubkyGui.souhrn('sDrzadlo', `Ø ${fmt(p.drzadlo.prumer)} × ${fmt(p.drzadlo.delka)}${p.druh === 'sklopna' ? ' · sklopné' : ' · ' + N.uchyceni[p.drzadlo.uchyceni]}`, true);
    const st = p.stupnice;
    $('stupInfo').innerHTML = st.typ === 'zadna' || o.chyba ? '' : `1 dílek = <b>${esc(dilekText(o))}</b>${st.prumerove ? ' na průměr' : ''} · otáčka = ${fmt(st.stoupani * (st.prumerove ? 2 : 1), 3)} mm · rozteč rysek ${fmt(o.roztec, 2)} mm`;
  }
  const box = (a, b, c, d) => G3D.dlazdice(a, b, c, d);
  function dilyKTisku() { return model ? model.tisk.concat(p.tisk.kalibrace ? model.kalibrace : []) : []; }
  /** Spojovací materiál do kusovníku. */
  function navic(o) {
    const out = [], n = p.naboj, d = p.drzadlo, delky = [6, 8, 10, 12, 16, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 80, 90, 100, 110, 120, 130, 140, 150];
    const delka = L => delky.find(x => x >= L) || Math.ceil(L / 10) * 10;
    if (p.hridel.tvar === 'pero' && o.ot.pero) out.push(`Pero ${o.ot.pero.bNom} × ${o.ot.pero.bNom} DIN 6885 (ocel), délka ≈ ${fmt(Math.min(o.H, 3 * p.hridel.prumer), 0)} mm`);
    if (p.hridel.tvar === 'zavit' && p.hridel.zavitTyp === 'matice') out.push(`Matice ${KLH.ZAVITY[p.hridel.zavit].nazev} (zalisovat, případně zalepit)`);
    if (n.jisteni === 'stavec') out.push(`Stavěcí šroub ${n.sroub} × ${delka(o.Rn - o.ot.r + 2)} s důlkem (nebo šroub s válcovou hlavou) + matice ${n.sroub}`);
    if (n.jisteni === 'sterbina') out.push(`Šroub ${n.sroub} × ${delka(2 * o.sterbina.yb - 2)} s válcovou hlavou + matice ${n.sroub}`);
    if (o.drz && p.druh !== 'sklopna' && (p.druh !== 'kolo' || p.kolo.drzadlo) && d.uchyceni === 'sroub') out.push(`Šroub ${d.sroub} × ${delka(o.drz.L + o.drz.Lcep + 2)} + podložka + matice ${d.sroub} (do čela držadla)`);
    if (p.druh === 'sklopna') out.push(`Šroub ${d.pant} × ${delka(o.pant.sirkaVidlice + 5)} + pojistná matice ${d.pant} (s nylonovým kroužkem)`);
    if (p.stupnice.typ === 'krouzek' && p.stupnice.jisteni) out.push('Šroub M3 × 6 (aretace kroužku, závit se vyřízne do plastu)');
    return out;
  }
  function vypisVysledky(o) {
    const el = $('vVysledky'), karta = $('karta3d');
    if (!model) { el.innerHTML = box('Model', wasm || chybaJadra ? 'nelze sestavit' : 'načítám…', chybaStavby); karta.innerHTML = ''; $('vSit').innerHTML = ''; $('kusovnik').innerHTML = ''; return; }
    const mat = KLH.MATERIALY[p.tisk.material], m = model;
    const B = m.sestava.reduce((B, d) => { const q = G3D.obal(d.poz); for (let i = 0; i < 3; i++) { B[i] = Math.min(B[i], q[i]); B[i + 3] = Math.max(B[i + 3], q[i + 3]); } return B; }, [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]);
    const dily = dilyKTisku(), V = dily.reduce((s, d) => s + d.objem, 0);
    const od = G3D.odhadTisku(V, mat.hustota, { dilu: dily.length });
    let h = box('Rozměr sestavy', `${fmt(B[3] - B[0], 0)} × ${fmt(B[4] - B[1], 0)} × ${fmt(B[5] - B[2], 0)} mm`, `rameno ${fmt(o.Ref, 0)} mm od osy`);
    const ot = o.ot;
    h += box('Otvor', p.hridel.tvar === 'zavit' ? KLH.ZAVITY[p.hridel.zavit].nazev : `${KLH.NAZVY.tvar[p.hridel.tvar]} ${fmt(2 * ot.r, 2)}`, `stěna náboje ${fmt(o.Rn - ot.rMax, 1)} mm${p.hridel.pruchozi ? '' : ' · slepý'}`);
    if (mech) h += box('Moment rukou', `${fmt(mech.Truka / 1000, 2)} N·m`, `při ${fmt(p.mech.sila, 0)} N · potřeba ${fmt(p.mech.moment, 2)} N·m`, mech.T > 0 ? (mech.Truka >= mech.T ? 'ok-t' : 'mez-t') : '');
    if (mech) h += box('Pevnost', `${fmt(mech.max * 100, 0)} %`, 'nejvíce využitý prvek (Mechanika)', mech.max <= 0.8 ? 'ok-t' : mech.max <= 1 ? 'mez-t' : 'chyba-t');
    if (p.stupnice.typ !== 'zadna') h += box('Dílek stupnice', dilekText(o), `${p.stupnice.dilku} dílků · ${fmt(p.stupnice.stoupani, 3)} mm/ot${p.stupnice.prumerove ? ' · na průměr' : ''}`);
    h += box('Hmotnost', `${fmt(od.g, od.g < 10 ? 1 : 0)} g`, `${mat.nazev}, plné díly`);
    h += box('Filament', `${fmt(od.metru, 1)} m`, `průměr 1,75 mm · ${fmt(V / 1000, 1)} cm³`);
    h += box('Doba tisku', `≈ ${od.minut < 60 ? od.minut + ' min' : fmt(od.minut / 60, 1) + ' h'}`, `${dily.length} ${dily.length === 1 ? 'díl' : dily.length < 5 ? 'díly' : 'dílů'} · hrubý odhad`);
    el.innerHTML = h;
    // kusovník
    const radky = dily.map(d => [d.nazev, 1, d]);
    const nav = navic(o);
    $('kusovnik').innerHTML = `<table class="tabulka"><thead><tr><th>Díl</th><th class="c">Kusů</th><th class="c">Rozměr</th><th class="c">Objem</th></tr></thead><tbody>`
      + radky.map(([n, ks, d]) => { const b = G3D.obal(d.poz); return `<tr><td>${esc(n)}</td><td class="c">${ks}</td><td class="c">${fmt(b[3] - b[0], 1)} × ${fmt(b[4] - b[1], 1)} × ${fmt(b[5] - b[2], 1)}</td><td class="c">${fmt(d.objem / 1000, 2)} cm³</td></tr>`; }).join('')
      + nav.map(t => `<tr><td colspan="4">+ ${esc(t)}</td></tr>`).join('') + '</tbody></table>';
    const titul = { sestava: 'Sestava', tisk: 'Díly k tisku', kalibrace: 'Kalibrační vzorek' }[stavZobr.rezim];
    karta.innerHTML = `<div class="titul">${titul}</div>${esc(KLH.NAZVY.druh[p.druh])}<br>rameno <b>${fmt(o.Ref, 0)}</b> mm · <b>${fmt(od.g, 0)}</b> g ${esc(mat.nazev)}`
      + (p.stupnice.typ !== 'zadna' ? `<br>dílek <b>${esc(dilekText(o))}</b>` : '');
    $('vSit').innerHTML = m.tisk.map(d => { const k = KRAB.kontrolaSite(d.poz, d.idx), ok = k.uzavrena && d.teles === 1; return box('Síť – ' + d.nazev, ok ? '✔ těsná' : '✖ netěsná', d.teles === 1 ? `${k.trojuhelniku} trojúhelníků, 1 těleso` : `${k.trojuhelniku} trojúhelníků, ${d.teles} tělesa`, ok ? 'ok-t' : 'chyba-t'); }).join('')
      + box('Stavba', `${m.cas} ms`, 'manifold-3d');
  }
  function vypisMech(o) {
    const el = $('vMech'), tab = $('tabMech');
    if (!mech) { el.innerHTML = box('Mechanika', '–', 'opravte chyby v záložce Kontrola'); tab.innerHTML = ''; return; }
    const me = mech, M = p.mech;
    let h = box('Doporučené rameno', me.T > 0 ? `${fmt(me.Rdoporuc, 0)} mm` : '–', me.T > 0 ? `pro ${fmt(M.moment, 2)} N·m silou ${fmt(M.sila, 0)} N · teď ${fmt(o.Ref, 0)} mm` : 'zadejte potřebný moment', me.T > 0 ? (o.Ref >= me.Rdoporuc ? 'ok-t' : 'mez-t') : '');
    h += box('Moment rukou', `${fmt(me.Truka / 1000, 2)} N·m`, `pohodlně ${fmt(M.sila, 0)} N · nejvíc ${fmt(me.Tmax / 1000, 2)} N·m při ${fmt(M.silaMax, 0)} N`);
    h += box('Posuv', `${fmt(me.posuv, 0)} mm/min`, `při ${fmt(M.otacky, 0)} ot/min · ruka ${fmt(me.obvod, 2)} m/s`);
    if (me.strihPera !== undefined) h += box('Pero – střih', `${fmt(me.strihPera, 1)} MPa`, 'ocel, dovoleno ≈ 60 MPa', me.strihPera < 60 ? 'ok-t' : 'chyba-t');
    if (me.zacvak) h += box('Zacvaknutí čepu', `${fmt(me.zacvak.eps, 1)} %`, `přetvoření půlek čepu · mez ${fmt(me.zacvak.mez, 1)} %`, me.zacvak.eps <= me.zacvak.mez ? 'ok-t' : 'mez-t');
    el.innerHTML = h;
    tab.innerHTML = '<thead><tr><th>Prvek</th><th class="c">Napětí</th><th class="c">Dovoleno</th><th class="c">Využití</th></tr></thead><tbody>'
      + me.prvky.map(x => {
        const tr = x.vyuziti > 1 ? 'chyba-t' : x.vyuziti > 0.8 ? 'mez-t' : 'ok-t';
        const nap = x.moment ? `${fmt(x.napeti / 1000, 2)} N·m` : `${fmt(x.napeti, 1)} MPa`, dov = x.moment ? `${fmt(x.dov / 1000, 2)} N·m` : `${fmt(x.dov, 1)} MPa`;
        return `<tr><td>${esc(x.nazev)}<br><span class="napoveda">${esc(x.popis)}</span></td><td class="c">${nap}</td><td class="c">${dov}</td><td class="c ${tr}">${fmt(x.vyuziti * 100, 0)} %</td></tr>`;
      }).join('') + '</tbody>';
  }

  /* ---------- náhled ---------- */
  function zobraz(novyPohled) {
    document.querySelectorAll('[data-rezim]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.rezim === stavZobr.rezim)));
    if (!model) { nahled.nastav(null); return; }
    const r = stavZobr.rezim;
    if (r === 'tisk') nahled.nastav(G3D.tiskoveRozlozeni(dilyKTisku(), 1, 6, 220), { tisk: true, novyPohled, uhel: p.tisk.uhel });
    else if (r === 'kalibrace') nahled.nastav(G3D.tiskoveRozlozeni(model.kalibrace, 1, 5, 160), { tisk: true, novyPohled, uhel: p.tisk.uhel });
    else nahled.nastav(model.sestava, { novyPohled });
    $('legPrevisy').hidden = !((r === 'tisk' || r === 'kalibrace') && nahled.stav.previsy);
  }
  function nastavRezim(r) {
    const tisk = $('tTisk').getAttribute('aria-pressed') === 'true';
    const predchozi = stavZobr.rezim;
    stavZobr.rezim = r;
    const chybiKal = () => r === 'kalibrace' && model && !model.kalibrace.length;
    if ((r === 'tisk') !== tisk) { $('tTisk').click(); if (!chybiKal()) return; }
    if (chybiKal()) { prepocitej(); return; }
    zobraz(predchozi !== r);
    if (model) vypisVysledky(KLH.odvozene(app.p));
  }
  document.querySelectorAll('[data-rezim]').forEach(b => b.addEventListener('click', () => nastavRezim(b.dataset.rezim)));

  /* ---------- nabídky, export ---------- */
  TrubkyGui.pripoj({ klic: 'webapp_kliky_hridel_gui', pohled: j => nahled.pohled(j) });
  for (const v of KLH.PREDVOLBY) {
    const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
    b.innerHTML = `${esc(v.nazev)}<span class="pozn">${esc(v.popis)}</span>`;
    b.addEventListener('click', () => {
      const q = KLH.predvolba(v.id);
      q.tisk = KLH.kopie(app.p.tisk);
      app.nahrad(q);
      nahled.pohled('iso');
    });
    $(v.skupina === 'druh' ? 'seznamDruhu' : 'seznamPredvoleb').appendChild(b);
  }
  function lzeExport() {
    if (!model) { Dialog.chyba(chybaStavby || 'Geometrické jádro se ještě načítá.'); return false; }
    return true;
  }
  const kusy = dily => G3D.tiskoveRozlozeni(dily, 1, 6, 220);
  function exportVse(druh) {
    if (!lzeExport()) return;
    if (druh === 'stl') app.stahni(KRAB.stlBinarni(kusy(dilyKTisku()), 'kliky na hridel - github_site'), app.jmeno('.stl'), 'model/stl');
    else app.stahni(KRAB.soubor3mf(kusy(dilyKTisku()), app.p.nazev || 'Klika'), app.jmeno('.3mf'), 'model/3mf');
  }
  $('btnStl').addEventListener('click', () => exportVse('stl'));
  $('btn3mf').addEventListener('click', () => exportVse('3mf'));
  document.querySelectorAll('[data-export]').forEach(b => b.addEventListener('click', () => {
    if (!lzeExport()) return;
    const co = b.dataset.export;
    let dily;
    if (co === 'kalibrace') {
      if (!model.kalibrace.length) {
        try { model = KLH_GEOM.postav(wasm, app.p, { kalibrace: true }); } catch (e) { Dialog.chyba('Kalibrační vzorek nelze sestavit: ' + (e && e.message || e)); return; }
      }
      dily = model.kalibrace;
    } else {
      if (!model[co]) { Dialog.info(co === 'krouzek' ? 'Tento návrh nemá kroužek stupnice (Stupnice → nulovatelný kroužek).' : 'Tento druh nemá samostatné držadlo.'); return; }
      dily = [model[co]];
    }
    app.stahni(KRAB.stlBinarni(G3D.tiskoveRozlozeni(dily, 1, 5, 200), 'kliky na hridel - ' + co), app.jmeno('_' + co + '.stl'), 'model/stl');
  }));

  /* ---------- výkres ---------- */
  function metaVykresu() {
    const o = KLH.odvozene(app.p), q = app.p, d = new Date(), N = KLH.NAZVY;
    const radky = [
      ['Druh', N.druh[q.druh]],
      ['Otvor', q.hridel.tvar === 'zavit' ? `${KLH.ZAVITY[q.hridel.zavit].nazev} (${N.zavitTyp[q.hridel.zavitTyp]})` : `${N.tvar[q.hridel.tvar]} ${fmt(q.hridel.prumer, 2)} + vůle ${fmt(q.hridel.vule, 2)}`],
      ['Náboj', `Ø ${fmt(q.naboj.prumer)} × ${fmt(q.naboj.delka)} mm, ${N.jisteni[q.naboj.jisteni]}`],
      ['Rameno (osa držadla)', `${fmt(o.Ref, 1)} mm`],
      ['Materiál', KLH.MATERIALY[q.tisk.material].nazev],
    ];
    if (o.drz && o.drz.rp) radky.push(['Čep držadla', `Ø ${fmt(2 * o.drz.rp, 1)}, otvor Ø ${fmt(2 * o.drz.rd, 2)}`]);
    if (mech) radky.push(['Moment rukou / pevnost', `${fmt(mech.Truka / 1000, 2)} N·m / ${fmt(mech.max * 100, 0)} %`]);
    const kus = model.tisk.map(x => [x.nazev, '1 ks']).concat(navic(o).map(t => [t, '']));
    const stup = q.stupnice.typ === 'zadna' ? null : [
      ['Stoupání', `${fmt(q.stupnice.stoupani, 3)} mm/ot`], ['Dílků', String(q.stupnice.dilku)], ['1 dílek', dilekText(o)],
      ['Čísla', `každý ${q.stupnice.kazde}. dílek`], ['Průměr', `Ø ${fmt(2 * o.Rd, 1)}`],
    ];
    return { radky, kusovnik: kus, stupnice: stup, nazev: q.nazev, datum: `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`, popis: KLH.popis(q) };
  }
  const vykresTed = () => KLH_VYK.vykres(app.p, model, metaVykresu());
  function kresliVykres() {
    if (!model) { $('vykresObsah').innerHTML = `<p class="napoveda">${esc(chybaStavby || 'Model se ještě načítá.')}</p>`; return; }
    $('vykresObsah').innerHTML = KLH_VYK.svg(vykresTed());
  }
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
  async function pdf() {
    if (!lzeExport()) return;
    try {
      if (!window.jspdf) throw new Error('Knihovna jsPDF se nenačetla.');
      const pismo = await nactiPismo();
      const doc = KLH_VYK.pdf(window.jspdf.jsPDF, vykresTed(), { pismo, nazev: app.p.nazev || 'Klika' });
      app.stahni(doc.output('blob'), app.jmeno('_vykres.pdf'), 'application/pdf');
      if (!pismo) Dialog.info('Písmo se nepodařilo načíst – PDF je bez diakritiky.');
    } catch (e) { Dialog.chyba('PDF se nepodařilo vytvořit: ' + (e && e.message || e)); }
  }
  const svgVykres = () => { if (lzeExport()) app.stahni(KLH_VYK.svg(vykresTed()), app.jmeno('_vykres.svg'), 'image/svg+xml'); };
  $('btnVykres').addEventListener('click', () => { TrubkyGui.otevriZalozku('vykres'); kresliVykres(); });
  for (const id of ['btnVykresSvg', 'btnVykresSvg2']) $(id).addEventListener('click', svgVykres);
  for (const id of ['btnVykresPdf', 'btnVykresPdf2']) $(id).addEventListener('click', pdf);
  document.querySelector('[data-zalozka="vykres"]').addEventListener('click', () => kresliVykres());

  app.prepinac('tRez', h => { nahled.prepni('rez', h); $('legRez').hidden = !h; });
  app.prepinac('tHrany', h => nahled.prepni('hrany', h));
  app.prepinac('tPrevisy', h => { nahled.prepni('previsy', h); $('legPrevisy').hidden = !(h && (stavZobr.rezim === 'tisk' || stavZobr.rezim === 'kalibrace')); }, true);
  app.prepinac('tPravitka', h => nahled.prepni('pravitka', h), true);
  app.prepinac('tTisk', h => {
    if (h) stavZobr.rezim = 'tisk';
    else if (stavZobr.rezim === 'tisk') stavZobr.rezim = 'sestava';
    zobraz(true);
    if (model) vypisVysledky(KLH.odvozene(app.p));
  });

  /* ---------- start ---------- */
  app.start({
    manifold: {
      ok: w => { wasm = w; prepocitej(); },
      chyba: e => { chybaJadra = 'Geometrické jádro (manifold-3d) se nenačetlo: ' + (e && e.message || e) + ' – model ani export nejsou k dispozici.'; prepocitej(); },
    },
  });
  window.KLH_UI = { get p() { return app.p; }, get model() { return model; }, zmen: app.zmen, nahrad: app.nahrad, prepocitej, nahled, app, nastavRezim };
})();

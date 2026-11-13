/* Knoflíky a hlavice – ovládání stránky nad společným zapojením gen3d/aplikace.js:
   tady jen to, co je pro knoflíky zvláštní (viditelnost polí, souhrny, výsledky, předvolby, díly). */
/* global KNOF, KNOF_NAHLED, KRAB, G3D, Dialog, TrubkyGui */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const fmt = KNOF.fmt;
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  let p, wasm = null, model = null, tiskDily = null, chybaStavby = '';
  const stavZobr = { tisk: false };
  const nahled = KNOF_NAHLED.vytvorNahled($('platno'));

  const app = G3D.aplikace({
    typ: 'knofliky', nazev: 'Knoflíky', klic: 'webapp_knofliky', soubor: 'knoflik',
    normalizuj: KNOF.normalizuj, vychozi: () => KNOF.predvolba('pot_d'),
    ulozProjekt: KNOF.ulozProjekt, nactiProjekt: KNOF.nactiProjekt, popis: KNOF.popis,
    vezmi: KNOF.vezmi, poloz: KNOF.poloz,
    predNaplnenim: q => {
      moznosti($('f_utyp'), KNOF.TYPY[q.typ].uchopy.map(u => [u, KNOF.NAZVY.uchop[u]]));
      moznosti($('f_uptyp'), KNOF.TYPY[q.typ].upevneni.map(u => [u, KNOF.NAZVY.upevneni[u]]));
    },
    viditelnost: () => viditelnost(),
    prepocitej: () => prepocitej(),
    png: () => nahled.png(), pohled: j => nahled.pohled(j),
    exportStl: () => exportStl(),
    doModelare: () => (lzeExport() ? { data: KRAB.soubor3mf(kusy(model.dily), app.p.nazev || 'Knoflík'), pripona: '.3mf' } : null),
    zkratky: { r: 'tRez', h: 'tHrany', m: 'tTisk', p: 'tPrevisy', l: 'tPravitka' },
    zmenaTematu: () => prepocitej(),
  });

  /* ---------- formulář ---------- */
  function moznosti(sel, polozky) {
    const h = sel.value;
    sel.innerHTML = '';
    for (const [v, t] of polozky) { const o = document.createElement('option'); o.value = v; o.textContent = t; sel.appendChild(o); }
    sel.value = h;
  }
  const seznam = a => (a || '').split(/\s+/).filter(Boolean);
  /** Pole a oddíly jen pro daný typ, úchop, upevnění, tvar knopky a rukojeť. */
  function viditelnost() {
    p = app.p;
    const u = p.upevneni.typ, o = KNOF.odvozene(p);
    document.querySelectorAll('[data-typy],[data-netypy],[data-uchopy],[data-neuchop],[data-upev],[data-knopka],[data-neknopka],[data-ruk]').forEach(el => {
      const d = el.dataset;
      let vid = true;
      if (d.typy && !seznam(d.typy).includes(p.typ)) vid = false;
      if (d.netypy && seznam(d.netypy).includes(p.typ)) vid = false;
      if (d.uchopy && !seznam(d.uchopy).includes(p.uchop.typ)) vid = false;
      if (d.neuchop && p.typ === 'sroub' && seznam(d.neuchop).includes(p.uchop.typ)) vid = false;
      if (d.upev && !seznam(d.upev).includes(u)) vid = false;
      if (d.knopka && (p.typ !== 'knopka' || !seznam(d.knopka).includes(p.knopka.tvar))) vid = false;
      if (d.neknopka && p.typ === 'knopka' && seznam(d.neknopka).includes(p.knopka.tvar)) vid = false;
      if (d.ruk && !seznam(d.ruk).includes(p.rukojet.typ)) vid = false;
      el.hidden = !vid;
    });
    $('gSukne').hidden = !p.sukne.pouzit;
    // hloubka: hřídel, vrut, šroub nad maticí (knopka, neprůchozí hlavice)
    const hl = ['D', 'vroubek', 'hladka', 'vrut'].includes(u) || (u === 'matice' && (p.typ === 'knopka' || (p.typ === 'sroub' && o.vlozeni === 'zespodu' && !p.upevneni.pruchozi)));
    $('pHloubka').hidden = !hl;
    $('lHloubka').textContent = ['D', 'vroubek', 'hladka'].includes(u) ? 'Hloubka hřídele' : u === 'vrut' ? 'Hloubka otvoru' : 'Hloubka otvoru pro šroub';
    $('pPruchozi').hidden = !(p.typ === 'sroub' && u === 'matice' && o.vlozeni === 'zespodu');
    // popisky podle typu
    const t = p.typ, uc = p.uchop.typ;
    $('lPrumer').textContent = t === 'sroub' && (uc === 't' || uc === 'kridlo') ? 'Rozpětí' : t === 'kolecko' ? 'Průměr kola' : t === 'knopka' ? 'Průměr hlavy' : 'Průměr';
    $('lVyska').textContent = t === 'kolecko' ? 'Tloušťka kola' : t === 'sroub' && uc !== 'kridlo' ? 'Výška úchopu' : 'Výška';
    $('lPocet').textContent = uc === 'hvezdice' ? 'Počet ramen' : uc === 'drazky' ? 'Počet drážek' : 'Počet vroubků';
    $('lUzaob').textContent = uc === 'kridlo' ? 'Zaoblení rohu křídla' : 'Zaoblení ramen';
    $('lUsirka').textContent = uc === 'kridlo' ? 'Tloušťka křídla' : 'Šířka příčky';
    $('napTelo').textContent = {
      potenciometr: 'Výška = celý knoflík od spodku po vrch. Horní hrana se zaoblí nebo srazí, i přes vroubky.',
      sroub: uc === 'kridlo' ? 'Rozpětí křídel a jejich výška. Roh křídla je sražený 45° od líce, takže se lícem dolů tiskne bez podpor.' : 'Výška úchopu nad nábojem. Celková výška = náboj + úchop.',
      knopka: { hrib: 'Hřib: pata, krk a hlava s kuželem 45° zespodu – tiskne se bez podpor.', valec: 'Válec se zaoblenou horní hranou.', cocka: 'Čočka: nízký lem a kulová klenba nahoře.' }[p.knopka.tvar],
      kolecko: 'Kolo s nábojem na líci; rukojeť stojí na líci kola.',
    }[t];
    $('napUchop').textContent = {
      hladky: 'Hladký povrch.', vroubky: 'V-drážky 90° podél osy – hloubka je od obvodu.', drazky: 'Půlkruhové drážky – příjemnější do ruky než vroubky.',
      hvezdice: 'Hvězdice: výřezy mezi rameny, hloubka = jak hluboko výřez sahá od obvodu.', kridlo: 'Dvě křídla v jedné rovině kolem náboje (náboj = průměr náboje).',
      t: 'Příčka se zaoblenými konci na náboji.',
    }[uc];
    $('napNaboj').textContent = t === 'kolecko' ? 'Náboj na líci kola zesílí uchycení matice nebo hřídele.' : uc === 'kridlo' ? 'Náboj prochází celou výškou křídla, je v něm kapsa matice.' : 'Náboj pod úchopem (ke šroubovanému dílu); 0 = bez náboje.';
    $('napUpevneni').textContent = {
      D: 'Hřídel s ploškou (D). Ploška míří k ukazateli.', vroubek: 'Vroubkovaná (drážkovaná) hřídel – zuby se vytisknou do otvoru, knoflík drží sevřením.',
      hladka: 'Hladká hřídel: stavěcí šroub (červík) zboku do vložené matice. Drážka pro matici je otevřená zespodu.',
      matice: p.typ === 'knopka' ? 'Šroub zezadu (z vnitřku šuplíku) do matice vložené zespodu.' : 'Šestihranná matice v kapse; závitová tyč nebo šroub prochází otvorem.',
      hlava: 'Šroub se šestihrannou hlavou vložený shora – hlava se opírá o dno kapsy.',
      vrut: 'Otvor pro samořezný vrut nebo zalisovací (tepelnou) vložku.',
    }[u];
  }
  $('f_material').innerHTML = Object.entries(KNOF.MATERIALY).map(([k, m]) => `<option value="${k}">${m.nazev}</option>`).join('');
  $('f_sroub').innerHTML = Object.keys(KNOF.SROUBY).map(k => `<option>${k}</option>`).join('');
  document.querySelectorAll('#paletaTypu button').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.typ === app.p.typ) return;
    app.nahrad(KNOF.prepniTyp(app.p, b.dataset.typ));
  }));

  /* ---------- přepočet ---------- */
  function prepocitej() {
    p = app.p;
    nahled.barvy(css('--border-strong'), css('--border'), css('--text'));
    document.querySelectorAll('#paletaTypu button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.typ === p.typ)));
    let H = KNOF.kontroly(p);
    model = null; tiskDily = null;
    if (wasm) {
      try {
        model = KNOF.postav(wasm, p);
        tiskDily = KNOF.tiskoveRozlozeni(model.dily, 1);
        H = H.concat(KNOF.kontrolyModelu(p, tiskDily));
        chybaStavby = '';
      } catch (e) { chybaStavby = 'Model nelze sestavit: ' + (e && e.message || e); }
    }
    const st = $('stav3d');
    st.textContent = wasm ? chybaStavby : chybaStavby || 'Načítám geometrické jádro…';
    st.classList.toggle('chyba', !!chybaStavby);
    if (model) nahled.nastav(stavZobr.tisk ? tiskDily : model.dily, { tisk: stavZobr.tisk, uhel: p.tisk.uhel });
    else nahled.nastav(null);
    app.hlaseni(H, { chybaStavby, boxy: ['boxTvar', 'boxUpevneni'] });
    vypisVysledky();
    souhrny();
    exportDilu();
  }
  function souhrny() {
    const N = KNOF.NAZVY, u = p.upevneni;
    TrubkyGui.souhrn('sTelo', `Ø ${fmt(p.telo.prumer)} × ${fmt(p.telo.vyska)} mm${p.typ === 'knopka' ? ' · ' + { hrib: 'hřib', valec: 'válec', cocka: 'čočka' }[p.knopka.tvar] : ''}`, true);
    TrubkyGui.souhrn('sUchop', N.uchop[p.uchop.typ] + (['vroubky', 'drazky', 'hvezdice'].includes(p.uchop.typ) ? ` × ${p.uchop.pocet}` : ''), true);
    TrubkyGui.souhrn('sNaboj', p.typ === 'sroub' && p.uchop.typ === 'kridlo' ? `Ø ${fmt(p.naboj.prumer)} přes celou výšku` : p.naboj.vyska > 0 ? `Ø ${fmt(p.naboj.prumer)} × ${fmt(p.naboj.vyska)}` : 'bez náboje', p.naboj.vyska > 0 || p.uchop.typ === 'kridlo');
    TrubkyGui.souhrn('sUkazatel', `${{ zadny: 'bez ukazatele', ryska: 'ryska', sipka: 'šipka' }[p.ukazatel.typ]}${p.sukne.pouzit ? ` · sukně Ø ${fmt(p.sukne.prumer)}, ${p.sukne.dilku} dílků` : ''}`, p.ukazatel.typ !== 'zadny' || p.sukne.pouzit);
    TrubkyGui.souhrn('sRukojet', { zadna: 'bez rukojeti', pevna: `pevná Ø ${fmt(p.rukojet.prumer)}`, otocna: `otočná Ø ${fmt(p.rukojet.prumer)} na ${p.rukojet.sroub}` }[p.rukojet.typ], p.rukojet.typ !== 'zadna');
    TrubkyGui.souhrn('sUpevneni', N.upevneni[u.typ] + (u.typ === 'matice' || u.typ === 'hlava' ? ' ' + u.sroub : u.typ === 'vrut' ? ` Ø ${fmt(u.pilot)}` : ` Ø ${fmt(u.hridel, 2)}`), true);
    TrubkyGui.souhrn('sVule', `hřídel ${fmt(p.vule.hridel, 2)} · šroub ${fmt(p.vule.sroub, 2)} · matice ${fmt(p.vule.matice, 2)} · +${fmt(p.vule.kompenzace, 2)}`, true);
    $('sTisk').textContent = { spodek: 'spodkem dolů', nahore: '', vrch: 'lícem dolů' }[KNOF.polohaTisku(p)];
    tabulkaRozmeru();
  }
  function tabulkaRozmeru() {
    const o = KNOF.odvozene(p), r = [];
    if (o.hridel) r.push(['Otvor hřídele', `Ø ${fmt(o.hridel.D, 2)}`, o.hridel.pruchozi ? 'průchozí' : `hl. ${fmt(p.upevneni.hloubka)}`]);
    if (p.upevneni.typ === 'D') r.push(['Přes plošku', fmt(p.upevneni.plocha + p.vule.hridel + p.vule.kompenzace, 2), '']);
    if (p.upevneni.typ === 'vroubek') r.push(['Dno zubů', `Ø ${fmt(o.hridel.D - 2 * p.upevneni.vyskaZubu, 2)}`, `${p.upevneni.zuby} zubů`]);
    if (o.stavaci) r.push([`Stavěcí ${p.upevneni.stavaci}`, `Ø ${fmt(o.stavaci.ds, 2)}`, `matice ${fmt(o.stavaci.m.S, 2)} × ${fmt(o.stavaci.m.H, 2)}, osa z ${fmt(o.stavaci.zs, 1)}`]);
    if (o.kapsa) {
      r.push([`Kapsa ${p.upevneni.typ === 'hlava' ? 'hlavy' : 'matice'} ${p.upevneni.sroub}`, `s ${fmt(o.kapsa.m.S, 2)}`, `hl. ${fmt(o.kapsa.hloubka, 2)}, přes rohy ${fmt(o.kapsa.m.E, 2)}`]);
      r.push(['Otvor šroubu', `Ø ${fmt(o.kapsa.dS, 2)}`, { mustkova: 'můstková vrstva', obetovana: 'obětovaná vrstva', zadny: '' }[o.kapsa.mostek]]);
    }
    if (o.vrut) r.push(['Otvor pro vrut', `Ø ${fmt(o.vrut.D, 2)}`, `hl. ${fmt(o.vrut.hloubka)}`]);
    if (o.rukojet && o.rukojet.m) r.push([`Rukojeť ${p.rukojet.sroub}`, `Ø ${fmt(o.rukojet.dS, 2)}`, `matice ${fmt(o.rukojet.m.S, 2)}, otvor objímky Ø ${fmt(o.rukojet.dS + 0.2, 2)}`]);
    $('tabRozmery').innerHTML = '<tr><th>Prvek</th><th class="c">Rozměr</th><th>Pozn.</th></tr>' + r.map(x => `<tr><td>${x[0]}</td><td class="c">${x[1]}</td><td>${x[2]}</td></tr>`).join('');
  }
  const box = G3D.dlazdice;
  function vypisVysledky() {
    const el = $('vVysledky'), karta = $('karta3d');
    if (!model) { el.innerHTML = box('Model', wasm ? 'nelze sestavit' : 'načítám…', chybaStavby); karta.innerHTML = ''; $('vSit').innerHTML = ''; return; }
    const mat = KNOF.MATERIALY[p.tisk.material], o = KNOF.odvozene(p);
    const all = model.dily.map(d => ({ d, k: KRAB.kontrolaSite(d.poz, d.idx), b: KNOF.obal(d.poz) }));
    const V = model.dily.reduce((s, d) => s + d.objem, 0) * p.tisk.kusu;
    const g = V / 1000 * mat.hustota, metru = V / (Math.PI * 0.875 * 0.875) / 1000;
    const minut = Math.round((V / 6 + 90 * all.length * p.tisk.kusu) / 60);   // hrubě: ~6 mm³/s + najetí na díl
    const hl = all[0].b;
    const sx = hl[3] - hl[0], sy = hl[4] - hl[1], sz = hl[5] - hl[2];
    let h = box('Rozměry', `${fmt(sx)} × ${fmt(sy)} × ${fmt(sz)} mm`, model.dily.length > 1 ? `+ ${model.dily[1].nazev.toLowerCase()} Ø ${fmt(p.rukojet.prumer)} × ${fmt(p.rukojet.vyska)}` : 'š × h × v v montážní poloze');
    h += box('Objem', `${fmt(V / 1000, 2)} cm³`, p.tisk.kusu > 1 ? `${p.tisk.kusu} sady` : model.dily.length > 1 ? `${model.dily.length} díly` : 'plný díl');
    h += box('Hmotnost', `${fmt(g, g < 10 ? 1 : 0)} g`, `${mat.nazev}, plný díl (při 30 % výplni zhruba ${fmt(g * 0.55, 0)} g)`);
    h += box('Filament', `${fmt(metru, 2)} m`, 'průměr 1,75 mm, plný díl');
    h += box('Doba tisku', `≈ ${minut < 60 ? minut + ' min' : fmt(minut / 60, 1) + ' h'}`, 'hrubý odhad, vrstva 0,2 mm');
    h += box('Tisková poloha', { spodek: 'spodkem dolů', vrch: 'lícem dolů' }[o.poloha], p.tisk.poloha === 'auto' ? 'zvoleno automaticky' : 'zadáno ručně');
    if (o.kapsa) h += box(p.upevneni.typ === 'hlava' ? 'Hlava šroubu' : 'Matice', `${p.upevneni.sroub} · s ${fmt(o.kapsa.m.s)}`, `kapsa ${fmt(o.kapsa.m.S, 2)} × ${fmt(o.kapsa.hloubka, 2)} mm, ${o.vlozeni === 'shora' ? 'shora' : 'zespodu'}`);
    if (o.hridel) h += box('Hřídel', `Ø ${fmt(p.upevneni.hridel, 2)}`, `otvor Ø ${fmt(o.hridel.D, 2)}, ${o.hridel.pruchozi ? 'průchozí' : 'hloubka ' + fmt(p.upevneni.hloubka) + ' mm'}`);
    el.innerHTML = h;
    karta.innerHTML = `<div class="titul">${KNOF.NAZVY.typ[p.typ]}</div><b>${fmt(sx)} × ${fmt(sy)} × ${fmt(sz)}</b> mm · <b>${fmt(g, g < 10 ? 1 : 0)}</b> g ${mat.nazev}<br>`
      + `${KNOF.NAZVY.uchop[p.uchop.typ]} · ${KNOF.NAZVY.upevneni[p.upevneni.typ]}${o.kapsa ? ' ' + p.upevneni.sroub : ''}<br>tisk ${{ spodek: 'spodkem', vrch: 'lícem' }[o.poloha]} dolů`;
    $('vSit').innerHTML = all.map(({ d, k }) => box('Síť – ' + d.nazev, k.uzavrena ? '✔ těsná' : '✖ netěsná', `${k.trojuhelniku} trojúhelníků, ${k.teles} těleso, ${model.cas} ms`, k.uzavrena && k.teles === 1 ? 'ok-t' : 'chyba-t')).join('');
  }

  /* ---------- nabídky, export ---------- */
  TrubkyGui.pripoj({ klic: 'webapp_knofliky_gui', pohled: j => nahled.pohled(j) });
  for (const v of KNOF.PREDVOLBY) {
    const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
    b.innerHTML = `${v.nazev}<span class="pozn">${v.popis}</span>`;
    b.addEventListener('click', () => { const q = KNOF.predvolba(v.id); q.vule = KNOF.kopie(app.p.vule); q.tisk = Object.assign(KNOF.kopie(app.p.tisk), { poloha: 'auto' }); app.nahrad(q); });
    $('seznamPredvoleb').appendChild(b);
  }
  function lzeExport() {
    if (!model) { Dialog.chyba(chybaStavby || 'Geometrické jádro se ještě načítá.'); return false; }
    return true;
  }
  const kusy = dily => KNOF.tiskoveRozlozeni(dily, app.p.tisk.kusu);
  function exportStl() { if (lzeExport()) app.stahni(KRAB.stlBinarni(kusy(model.dily), 'knofliky - github_site'), app.jmeno('.stl'), 'model/stl'); }
  $('btnStl').addEventListener('click', exportStl);
  $('btn3mf').addEventListener('click', () => { if (lzeExport()) app.stahni(KRAB.soubor3mf(kusy(model.dily), app.p.nazev || 'Knoflík'), app.jmeno('.3mf'), 'model/3mf'); });
  /** Vícedílný model: každý díl zvlášť. */
  function exportDilu() {
    const el = $('exportDilu'); el.innerHTML = '';
    if (!model || model.dily.length < 2) return;
    for (const d of model.dily) {
      const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
      b.innerHTML = `⬇ STL – ${d.nazev}<span class="pozn">jen tento díl</span>`;
      b.addEventListener('click', () => app.stahni(KRAB.stlBinarni(kusy([d]), 'knofliky - ' + d.jmeno), app.jmeno('_' + d.jmeno + '.stl'), 'model/stl'));
      el.appendChild(b);
    }
  }
  app.prepinac('tRez', h => { nahled.prepni('rez', h); $('legRez').hidden = !h; });
  app.prepinac('tHrany', h => nahled.prepni('hrany', h));
  app.prepinac('tPrevisy', h => { nahled.prepni('previsy', h); $('legPrevisy').hidden = !(h && stavZobr.tisk); }, true);
  app.prepinac('tPravitka', h => nahled.prepni('pravitka', h), true);
  app.prepinac('tTisk', h => {
    stavZobr.tisk = h;
    $('legPrevisy').hidden = !(h && nahled.stav.previsy);
    if (model) nahled.nastav(h ? tiskDily : model.dily, { tisk: h, novyPohled: true, uhel: app.p.tisk.uhel });
  });

  /* ---------- start ---------- */
  app.start({
    manifold: {
      ok: w => { wasm = w; prepocitej(); },
      chyba: e => { chybaStavby = 'Geometrické jádro (manifold-3d) se nenačetlo: ' + (e && e.message || e) + ' – model ani export nejsou k dispozici.'; prepocitej(); },
    },
  });
  window.KNOF_UI = { get p() { return app.p; }, get model() { return model; }, zmen: app.zmen, nahrad: app.nahrad, naplnFormular: app.naplnFormular, prepocitej, nahled, app };
})();

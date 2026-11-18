/* Kloubová hadice – ovládání stránky nad společným zapojením gen3d/aplikace.js
   (tady jen to, co je pro hadici zvláštní: viditelnost polí, souhrny, výsledky, kusovník, režimy náhledu, export po dílech).
   Náhled = KNOF_NAHLED. Režimy: sestava (ohnutý řetěz), článek, tisk (díly na podložce), kalibrace. */
/* global KHAD, KNOF_NAHLED, KRAB, G3D, Dialog, TrubkyGui */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const fmt = KHAD.fmt;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  let p, wasm = null, model = null, chybaStavby = '', chybaJadra = '';
  const stavZobr = { rezim: 'sestava' };
  const nahled = KNOF_NAHLED.vytvorNahled($('platno'), { drzPohled: true });

  const app = G3D.aplikace({
    typ: 'kloubova_hadice', nazev: 'Kloubová hadice', klic: 'webapp_kloubova_hadice', soubor: 'hadice',
    normalizuj: KHAD.normalizuj, vychozi: () => KHAD.predvolba('ostrik6'),
    ulozProjekt: KHAD.ulozProjekt, nactiProjekt: KHAD.nactiProjekt, popis: KHAD.popis,
    vezmi: KHAD.vezmi, poloz: KHAD.poloz,
    viditelnost: () => viditelnost(),
    prepocitej: () => prepocitej(),
    png: () => nahled.png(), pohled: j => nahled.pohled(j),
    exportStl: () => exportVse('stl'),
    doModelare: () => (lzeExport() ? { data: KRAB.soubor3mf(kusy(dilyKTisku()), app.p.nazev || 'Hadice'), pripona: '.3mf' } : null),
    zkratky: { r: 'tRez', h: 'tHrany', m: 'tTisk', p: 'tPrevisy', l: 'tPravitka' },
    zmenaTematu: () => prepocitej(),
  });

  const seznam = a => (a || '').split(/\s+/).filter(Boolean);
  function viditelnost() {
    p = app.p;
    document.querySelectorAll('[data-vstup],[data-tryska],[data-netryska],[data-zarezy],[data-neretez]').forEach(el => {
      const d = el.dataset;
      let vid = true;
      if (d.vstup && !seznam(d.vstup).includes(p.vstup.typ)) vid = false;
      if (d.tryska && !seznam(d.tryska).includes(p.tryska.typ)) vid = false;
      if (d.netryska && d.netryska === p.tryska.typ) vid = false;
      if (d.zarezy && p.kloub.zarezu < 2) vid = false;
      if (d.neretez && d.neretez === p.retez.tvar) vid = false;
      el.hidden = !vid;
    });
    $('napVstup').textContent = {
      zavit: 'Vnější závit do stroje, šestihran na klíč. Závit je válcový – utěsnit teflonovou páskou nebo kroužkem pod šestihran. Jemný závit raději vyřízněte čelistí do hladkého dříku.',
      rozbocka: 'Přívod se závitem rozdělí šikmé kanály do rovnoběžných jamek – každá větev má vlastní řetěz a trysku.',
      priruba: 'Kulatá příruba s dírami na šrouby, jamka uprostřed. Průtok vede skrz přírubu – zespodu přišroubujte na otvor (s těsněním).',
      trn: 'Trn na měkkou hadici (vnitřní průměr hadice). Hadici zajistěte stahovací páskou nebo sponou.',
      magnet: 'Patka s kapsou na kulatý magnet zespodu – bez průtoku, pro stavitelný držák.',
    }[p.vstup.typ];
    $('napTryska').textContent = {
      plocha: 'Vějíř se štěrbinou – široký plochý proud (ostřik, ofuk).',
      kulata: 'Kulaté ústí: užší než kanál = ostrý proud, širší = sací hubička.',
      sprcha: 'Kuželová hlava s otvory rovnoběžnými s osou.',
      hubice: 'Obdélníkové sací ústí pro odsávání třísek a prachu.',
      zatka: 'Uzavřený konec – pro stavitelný držák nebo slepou větev.',
    }[p.tryska.typ];
  }
  $('f_material').innerHTML = Object.entries(KHAD.MATERIALY).map(([k, m]) => `<option value="${k}">${m.nazev}</option>`).join('');
  $('f_zavit').innerHTML = Object.entries(KHAD.ZAVITY).map(([k, z]) => `<option value="${k}">${z.nazev}</option>`).join('');

  /* ---------- přepočet ---------- */
  function prepocitej() {
    p = app.p;
    nahled.barvy(css('--border-strong'), css('--border'), css('--text'));
    let H = KHAD.kontroly(p);
    const o = KHAD.odvozene(p);
    model = null; chybaStavby = chybaJadra;
    if (wasm && !o.chyba) {
      try {
        model = KHAD.postav(wasm, p, { kalibrace: stavZobr.rezim === 'kalibrace' || p.tisk.kalibrace });
        H = H.concat(KHAD.kontrolyModelu(p, model));
      } catch (e) { chybaStavby = 'Model nelze sestavit: ' + (e && e.message || e); }
    } else if (wasm) chybaStavby = 'Model nelze sestavit – opravte chybu v záložce Kontrola.';
    const st = $('stav3d');
    st.textContent = wasm || chybaJadra ? chybaStavby : 'Načítám geometrické jádro…';
    st.classList.toggle('chyba', !!chybaStavby);
    zobraz(false);
    app.hlaseni(H, { chybaStavby, boxy: ['boxKloub', 'boxKoncovky'] });
    vypisVysledky(o);
    souhrny(o);
  }
  function souhrny(o) {
    const k = p.kloub, N = KHAD.NAZVY;
    TrubkyGui.souhrn('sClanek', k.kanal > 0 ? `kanál Ø ${fmt(k.kanal)} · koule Ø ${fmt(k.koule)} · ${fmt(k.roztec)} mm` : `plný · koule Ø ${fmt(k.koule)} · ${fmt(k.roztec)} mm`, true);
    TrubkyGui.souhrn('sZacvak', k.zarezu >= 2 ? `přesah ${fmt(k.presah, 2)} · vůle ${fmt(k.vule, 2)} · ${k.zarezu} zářezů` : `přesah ${fmt(k.presah, 2)} · vůle ${fmt(k.vule, 2)}`, true);
    TrubkyGui.souhrn('sRetez', `${p.retez.pocet} ks · ${N.tvar[p.retez.tvar]}`, true);
    const v = p.vstup;
    const zn = KHAD.ZAVITY[v.zavit].nazev;
    TrubkyGui.souhrn('sVstup', {
      zavit: `závit se šestihranem ${zn}`, rozbocka: `rozbočka ${zn} · ${v.vetvi} větve`, priruba: `příruba Ø ${fmt(v.priruba)} na ${v.der} šrouby`,
      trn: `trn na hadici Ø ${fmt(v.hadice)}`, magnet: `magnetická patka Ø ${fmt(v.patka)}`,
    }[v.typ], true);
    TrubkyGui.souhrn('sTryska', N.tryska[p.tryska.typ], true);
    $('napClanek').textContent = o.chyba ? '' : `Jamka Ø ${fmt(2 * o.Rs, 2)} (vnějšek Ø ${fmt(2 * o.Ro, 1)}), hrdlo Ø ${fmt(2 * o.rl, 2)}, krček Ø ${fmt(2 * o.rn, 1)}; výška článku ${fmt(o.vyska, 1)} mm, nejkratší rozteč ${fmt(o.Lmin, 1)} mm.`;
    const ohyb = fmt(o.ohybMax, 1), oblouk = fmt(o.ohybMax * (p.retez.pocet + 1), 0);
    $('napRetez').textContent = o.chyba ? '' : p.vstup.typ === 'rozbocka'
      ? `Kloub se ohne nejvýš o ${ohyb}° – ${p.retez.pocet} článků v každé větvi zvládne oblouk až ${oblouk}°.`
      : `Kloub se ohne nejvýš o ${ohyb}° – ${p.retez.pocet} článků zvládne oblouk až ${oblouk}°.`;
  }
  const box = (a, b, c, d) => G3D.dlazdice(a, b, c, d);
  function dilyKTisku() { return model ? model.tisk.concat(p.tisk.kalibrace ? model.kalibrace : []) : []; }
  function vypisVysledky(o) {
    const el = $('vVysledky'), karta = $('karta3d');
    if (!model) { el.innerHTML = box('Model', wasm || chybaJadra ? 'nelze sestavit' : 'načítám…', chybaStavby); karta.innerHTML = ''; $('vSit').innerHTML = ''; $('kusovnik').innerHTML = ''; return; }
    const mat = KHAD.MATERIALY[p.tisk.material], m = model, P = m.P, T = m.T;
    const delkaRovne = P.zS + p.retez.pocet * o.L + T.delkaCelkem - o.a;   // koule trysky (pod středem) leží v jamce
    const sest = m.sestava.reduce((B, d) => { const q = G3D.obal(d.poz); for (let i = 0; i < 3; i++) { B[i] = Math.min(B[i], q[i]); B[i + 3] = Math.max(B[i + 3], q[i + 3]); } return B; }, [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]);
    const dily = dilyKTisku(), V = dily.reduce((s, d) => s + d.objem, 0) * p.tisk.sad;
    const od = G3D.odhadTisku(V, mat.hustota, { dilu: dily.length * p.tisk.sad });
    let h = box('Délka hadice', `${fmt(delkaRovne, 0)} mm`, `natažená, od spodku patky po ústí · jeden článek přidá ${fmt(o.L, 1)} mm`);
    h += box('Ohyb kloubu', `${fmt(o.ohybMax, 1)}°`, `na článek · celý řetěz až ${fmt(o.ohybMax * (p.retez.pocet + 1), 0)}°`, o.ohybMax >= 15 ? '' : 'mez-t');
    if (p.vstup.typ === 'magnet' || p.tryska.typ === 'zatka') h += box('Průtok', 'žádný', p.vstup.typ === 'magnet' ? 'magnetická patka je bez průtoku' : 'zátka uzavírá konec');
    else if (o.rc > 0) {
      const nejuz = [o.rc, P.rb > 0 ? P.rb : o.rc];
      if (T.typ === 'kulata') nejuz.push(T.ru);
      const rmin = Math.min(...nejuz);
      h += box('Průtok', `Ø ${fmt(2 * o.rc, 1)} mm`, rmin < o.rc - 0.05 ? `průřez ${fmt(o.prurez, 0)} mm² · nejužší místo Ø ${fmt(2 * rmin, 1)}` : `průřez ${fmt(o.prurez, 0)} mm²`);
    } else h += box('Průtok', 'žádný', 'plné články – stavitelný držák');
    h += box('Zacvaknutí', `${fmt(o.preth, 1)} %`, `odhad přetvoření hrdla · mez ${mat.nazev} ≈ ${fmt(mat.eps, 0)} %`, o.preth <= mat.eps ? 'ok-t' : o.preth <= 2 * mat.eps ? 'mez-t' : 'chyba-t');
    h += box('Sestava v náhledu', `${fmt(sest[3] - sest[0], 0)} × ${fmt(sest[4] - sest[1], 0)} × ${fmt(sest[5] - sest[2], 0)} mm`, { rovne: 'rovná', oblouk: 'tvar oblouk', s: 'tvar esíčko', hak: 'tvar hák' }[p.retez.tvar]);
    h += box('Hmotnost', `${fmt(od.g, od.g < 10 ? 1 : 0)} g`, p.tisk.sad > 1 ? `${mat.nazev}, plné díly, ${p.tisk.sad} sady` : `${mat.nazev}, plné díly`);
    h += box('Filament', `${fmt(od.metru, 1)} m`, `průměr 1,75 mm · ${fmt(V / 1000, 1)} cm³`);
    h += box('Doba tisku', `≈ ${od.minut < 60 ? od.minut + ' min' : fmt(od.minut / 60, 1) + ' h'}`, `${dily.length * p.tisk.sad} dílů · hrubý odhad`);
    el.innerHTML = h;
    // kusovník
    const radky = [[m.patka.nazev, 1, m.patka], ['Článek', m.vetvi * p.retez.pocet, m.clanek], [m.tryska.nazev, m.vetvi, m.tryska]];
    if (p.tisk.kalibrace) for (const d of m.kalibrace) radky.push([d.nazev, 1, d]);
    const navic = [];
    if (p.vstup.typ === 'magnet') navic.push(`Magnet Ø ${fmt(p.vstup.magnet)} × ${fmt(p.vstup.vyskaMagnetu)} mm (neodym), lepidlo`);
    if (p.vstup.typ === 'priruba' && p.vstup.der > 0) navic.push(`${p.vstup.der} × šroub Ø ${fmt(p.vstup.dira - 0.5, 1)} mm, těsnění pod přírubu`);
    if (p.vstup.typ === 'trn') navic.push(`Hadice vnitřní Ø ${fmt(p.vstup.hadice)} mm, stahovací páska`);
    if ((p.vstup.typ === 'zavit' || p.vstup.typ === 'rozbocka')) navic.push(p.vstup.tisknoutZavit ? 'Teflonová páska na závit' : `Závitová čelist ${KHAD.ZAVITY[p.vstup.zavit].nazev}, teflonová páska`);
    $('kusovnik').innerHTML = `<table class="tabulka"><thead><tr><th>Díl</th><th class="c">Kusů</th><th class="c">Rozměr</th><th class="c">Objem</th></tr></thead><tbody>`
      + radky.map(([n, ks, d]) => { const b = G3D.obal(d.poz); return `<tr><td>${esc(n)}</td><td class="c">${ks * p.tisk.sad}</td><td class="c">${fmt(b[3] - b[0], 1)} × ${fmt(b[4] - b[1], 1)} × ${fmt(b[5] - b[2], 1)}</td><td class="c">${fmt(d.objem / 1000, 2)} cm³</td></tr>`; }).join('')
      + navic.map(t => `<tr><td colspan="4">+ ${esc(t)}</td></tr>`).join('') + '</tbody></table>';
    const titul = { sestava: 'Sestava', clanek: 'Článek', tisk: 'Díly k tisku', kalibrace: 'Kalibrační sada' }[stavZobr.rezim];
    karta.innerHTML = `<div class="titul">${titul}</div><b>${fmt(delkaRovne, 0)}</b> mm natažená · ohyb <b>${fmt(o.ohybMax, 0)}°</b> na článek<br>${m.vetvi > 1 ? m.vetvi + ' × ' : ''}${p.retez.pocet} článků · <b>${fmt(od.g, 0)}</b> g ${mat.nazev}`;
    const kont = [m.patka, m.clanek, m.tryska].map(d => ({ d, k: KRAB.kontrolaSite(d.poz, d.idx) }));
    $('vSit').innerHTML = kont.map(({ d, k }) => box('Síť – ' + d.nazev, k.uzavrena && d.teles === 1 ? '✔ těsná' : '✖ netěsná', d.teles === 1 ? `${k.trojuhelniku} trojúhelníků, 1 těleso` : `${k.trojuhelniku} trojúhelníků, ${d.teles} tělesa`, k.uzavrena && d.teles === 1 ? 'ok-t' : 'chyba-t')).join('')
      + box('Stavba', `${m.cas} ms`, 'manifold-3d');
  }

  /* ---------- náhled ---------- */
  function zobraz(novyPohled) {
    document.querySelectorAll('[data-rezim]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.rezim === stavZobr.rezim)));
    if (!model) { nahled.nastav(null); return; }
    const r = stavZobr.rezim;
    if (r === 'tisk') nahled.nastav(G3D.tiskoveRozlozeni(dilyKTisku(), p.tisk.sad, 5, 220), { tisk: true, novyPohled, uhel: p.tisk.uhel });
    else if (r === 'kalibrace') nahled.nastav(G3D.tiskoveRozlozeni(model.kalibrace, 1, 5, 160), { tisk: true, novyPohled, uhel: p.tisk.uhel });
    else if (r === 'clanek') nahled.nastav([model.clanek], { novyPohled });
    else nahled.nastav(model.sestava, { novyPohled });
    $('legPrevisy').hidden = !((r === 'tisk' || r === 'kalibrace') && nahled.stav.previsy);
  }
  function nastavRezim(r) {
    const tisk = $('tTisk').getAttribute('aria-pressed') === 'true';
    const predchozi = stavZobr.rezim;
    stavZobr.rezim = r;
    const chybiKal = () => r === 'kalibrace' && model && !model.kalibrace.length;   // sada se staví jen na požádání
    if ((r === 'tisk') !== tisk) { $('tTisk').click(); if (!chybiKal()) return; }   // přepínač tiskové polohy zavolá zobrazení
    if (chybiKal()) { prepocitej(); return; }
    zobraz(predchozi !== r);
    if (model) vypisVysledky(KHAD.odvozene(app.p));
  }
  document.querySelectorAll('[data-rezim]').forEach(b => b.addEventListener('click', () => nastavRezim(b.dataset.rezim)));

  /* ---------- nabídky, export ---------- */
  TrubkyGui.pripoj({ klic: 'webapp_kloubova_hadice_gui', pohled: j => nahled.pohled(j) });
  for (const v of KHAD.PREDVOLBY) {
    const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
    b.innerHTML = `${esc(v.nazev)}<span class="pozn">${esc(v.popis)}</span>`;
    b.addEventListener('click', () => {
      const q = KHAD.predvolba(v.id);
      q.tisk = KHAD.kopie(app.p.tisk);
      app.nahrad(q);
    });
    $('seznamPredvoleb').appendChild(b);
  }
  function lzeExport() {
    if (!model) { Dialog.chyba(chybaStavby || 'Geometrické jádro se ještě načítá.'); return false; }
    return true;
  }
  const kusy = dily => G3D.tiskoveRozlozeni(dily, app.p.tisk.sad, 5, 220);
  function exportVse(druh) {
    if (!lzeExport()) return;
    if (druh === 'stl') app.stahni(KRAB.stlBinarni(kusy(dilyKTisku()), 'kloubova hadice - github_site'), app.jmeno('.stl'), 'model/stl');
    else app.stahni(KRAB.soubor3mf(kusy(dilyKTisku()), app.p.nazev || 'Hadice'), app.jmeno('.3mf'), 'model/3mf');
  }
  $('btnStl').addEventListener('click', () => exportVse('stl'));
  $('btn3mf').addEventListener('click', () => exportVse('3mf'));
  document.querySelectorAll('[data-export]').forEach(b => b.addEventListener('click', () => {
    if (!lzeExport()) return;
    const co = b.dataset.export;
    let dily;
    if (co === 'kalibrace') {
      if (!model.kalibrace.length) {
        try { model = KHAD.postav(wasm, app.p, { kalibrace: true }); } catch (e) { Dialog.chyba('Kalibrační sadu nelze sestavit: ' + (e && e.message || e)); return; }
      }
      dily = model.kalibrace;
    } else dily = [model[co]];
    app.stahni(KRAB.stlBinarni(G3D.tiskoveRozlozeni(dily, 1, 5, 160), 'kloubova hadice - ' + co), app.jmeno('_' + co + '.stl'), 'model/stl');
  }));
  app.prepinac('tRez', h => { nahled.prepni('rez', h); $('legRez').hidden = !h; });
  app.prepinac('tHrany', h => nahled.prepni('hrany', h));
  app.prepinac('tPrevisy', h => { nahled.prepni('previsy', h); $('legPrevisy').hidden = !(h && (stavZobr.rezim === 'tisk' || stavZobr.rezim === 'kalibrace')); }, true);
  app.prepinac('tPravitka', h => nahled.prepni('pravitka', h), true);
  app.prepinac('tTisk', h => {
    if (h) stavZobr.rezim = 'tisk';
    else if (stavZobr.rezim === 'tisk') stavZobr.rezim = 'sestava';
    zobraz(true);
    if (model) vypisVysledky(KHAD.odvozene(app.p));
  });

  /* ---------- start ---------- */
  app.start({
    manifold: {
      ok: w => { wasm = w; prepocitej(); },
      chyba: e => { chybaJadra = 'Geometrické jádro (manifold-3d) se nenačetlo: ' + (e && e.message || e) + ' – model ani export nejsou k dispozici.'; prepocitej(); },
    },
  });
  window.KHAD_UI = { get p() { return app.p; }, get model() { return model; }, zmen: app.zmen, nahrad: app.nahrad, prepocitej, nahled, app, nastavRezim };
})();

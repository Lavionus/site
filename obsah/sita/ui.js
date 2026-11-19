/* Síta a mřížky – ovládání stránky nad společným zapojením gen3d/aplikace.js
   (tady jen to, co je pro síta zvláštní: viditelnost polí, souhrny, výsledky, výpočty, kusovník, režimy náhledu,
   kalibrační vzorek, výkres). Náhled = KNOF_NAHLED. Stavba běží odloženě (setTimeout) – jemná síta mají desítky tisíc otvorů. */
/* global SITA, SITA_VYK, KNOF_NAHLED, KRAB, G3D, Dialog, TrubkyGui */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const fmt = SITA.fmt;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  let p, wasm = null, model = null, tiskDily = null, kal = null, kalKlic = '', chybaStavby = '', chybaJadra = '', H0 = [], cekaStavba = 0;
  const stavZobr = { rezim: 'sestava' };
  const nahled = KNOF_NAHLED.vytvorNahled($('platno'));

  const app = G3D.aplikace({
    typ: 'sita', nazev: 'Síta a mřížky', klic: 'webapp_sita', soubor: 'sito',
    normalizuj: SITA.normalizuj, vychozi: () => SITA.predvolba('pisek'),
    ulozProjekt: SITA.ulozProjekt, nactiProjekt: SITA.nactiProjekt, popis: SITA.popis,
    vezmi: SITA.vezmi, poloz: SITA.poloz,
    predNaplnenim: q => moznostiUchytu(q),
    viditelnost: () => viditelnost(),
    prepocitej: () => prepocitej(),
    png: () => nahled.png(), pohled: j => nahled.pohled(j),
    exportStl: () => exportVse('stl'),
    doModelare: () => (lzeExport() ? { data: KRAB.soubor3mf(kusy(), app.p.nazev || 'Síto'), pripona: '.3mf' } : null),
    zkratky: { r: 'tRez', h: 'tHrany', m: 'tTisk', p: 'tPrevisy', l: 'tPravitka' },
    zmenaTematu: () => zobraz(false),
  });

  /* ---------- formulář ---------- */
  const seznam = a => (a || '').split(/\s+/).filter(Boolean);
  const N = SITA.NAZVY;
  const naplnSelect = (el, polozky) => { const h = el.value; el.innerHTML = polozky.map(([v, t]) => `<option value="${v}">${esc(t)}</option>`).join(''); if (polozky.some(x => x[0] === h)) el.value = h; };
  naplnSelect($('f_otyp'), Object.entries(N.oko));
  naplnSelect($('f_material'), Object.entries(SITA.MATERIALY).map(([k, m]) => [k, m.nazev]));
  naplnSelect($('f_cmat'), Object.entries(SITA.NASYPKY).map(([k, m]) => [k, `${m.nazev} (${fmt(m.rho, 0)} kg/m³)`]));
  function moznostiUchytu(q) {
    const moz = q.druh === 'sito' ? ['zadne', 'ucha', 'rukojet'] : ['zadne', 'ucha'];
    if (!moz.includes(q.uchyty.typ)) moz.push(q.uchyty.typ);   // zachovat hodnotu z projektu (kontrola ji ohlásí)
    naplnSelect($('f_utyp'), moz.map(u => [u, N.uchyty[u]]));
  }
  function viditelnost() {
    p = app.p;
    const miska = p.druh === 'kuzel' && p.kuzel.typ === 'miska';
    document.querySelectorAll('[data-druhy],[data-nedruhy],[data-tvary],[data-kuzel],[data-uchyt],[data-oka],[data-neoka],[data-vyztuha]').forEach(el => {
      const d = el.dataset;
      let vid = true;
      if (d.druhy && !seznam(d.druhy).includes(p.druh)) vid = false;
      if (d.nedruhy && seznam(d.nedruhy).includes(p.druh)) vid = false;
      if (d.tvary && !seznam(d.tvary).includes(p.tvar.typ)) vid = false;
      if (d.kuzel && !seznam(d.kuzel).includes(p.kuzel.typ)) vid = false;
      if (d.uchyt && !seznam(d.uchyt).includes(p.uchyty.typ)) vid = false;
      if (d.oka && !seznam(d.oka).includes(p.oko.typ)) vid = false;
      if (d.neoka && seznam(d.neoka).includes(p.oko.typ)) vid = false;
      if (d.vyztuha && !seznam(d.vyztuha).includes(p.vyztuha.typ)) vid = false;
      el.hidden = !vid;
    });
    document.querySelector('[data-oddil="uchyty"]').hidden = !(p.druh === 'sito' || miska);
    moznostiUchytu(p); $('f_utyp').value = p.uchyty.typ;
    $('pMiska').hidden = !p.vez.miska;
    const vl = p.druh === 'vlozka';
    $('lPrumer').textContent = (p.tvar.typ === 'mnohouhelnik' ? 'Rozměr přes plochy' : 'Průměr') + (vl ? ' otvoru' : '');
    $('lLvyska').textContent = { sito: 'Výška obruby', vez: 'Výška jednoho síta', kuzel: miska ? 'Hloubka košíku' : 'Výška obruby (kužel)' }[p.druh] || 'Výška obruby';
    $('lKprumer').textContent = miska ? 'Horní průměr košíku' : 'Průměr kužele v sedle';
    $('lUdelka').textContent = p.uchyty.typ === 'rukojet' ? 'Délka rukojeti' : 'Přesah ucha';
    $('lOvelikost').textContent = { ctverec: 'Strana oka', sestiuhelnik: 'Oko přes plochy', kruh: 'Průměr díry', sterbiny: 'Šířka štěrbiny', radialni: 'Šířka štěrbiny', kosoctverec: 'Oko (mezi stranami)', tkana: 'Mezera mezi pásy' }[p.oko.typ];
    $('napTvar').textContent = vl ? 'Rozměr otvoru, do kterého se vložka zasune (u trubky vnitřní průměr).'
      : p.druh === 'vez' ? 'Vnější rozměr sít věže. Rohy obdélníku zaoblete aspoň na 2 stěny + vůli, jinak budou ostré.'
        : p.tvar.typ === 'mnohouhelnik' ? 'Pravidelný mnohoúhelník – rozměr mezi protilehlými stranami (u lichého počtu průměr vepsané kružnice).' : 'Vnější rozměr obruby.';
    $('napKuzel').textContent = miska ? 'Košík: dno se sítem, stěna se štěrbinami podél povrchové přímky. Horní průměr volte o pár mm menší než hrnek a dejte ucha na okraj.'
      : 'Plochá vložka sedí v kuželu: zadejte průměr kužele v místě, kam má dosednout, a polovinu vrcholového úhlu (trychtýř 60° → 30°). Plášť vložky má stejný sklon.';
    $('napUchyty').textContent = p.uchyty.typ === 'ucha' ? 'Ucha na protilehlých stranách nahoře, zespodu zkosená 45° – opřou se o okraj kbelíku nebo hrnku.'
      : p.uchyty.typ === 'rukojet' ? 'Rukojeť leží na podložce u spodku síta, na konci otvor na pověšení.' : '';
    $('napVez').textContent = `Oka se odstupňují geometricky shora dolů: ${SITA.okaVeze(p).map(a => fmt(a, 1)).join(' → ')} mm. Nákružek každého síta se zasune do obruby síta pod ním.`;
    $('napOko').textContent = {
      ctverec: 'Čtvercové oko z přímých žeber – nejvíc volné plochy, tiskne se nejčistěji.',
      sestiuhelnik: 'Šestiúhelníky (plástev) – tuhé a pevné, oko přes plochy.',
      kruh: 'Kruhové díry v šestiúhelníkovém uspořádání – pevné, ale méně volné plochy.',
      sterbiny: 'Štěrbiny propustí podlouhlá zrna; dobré pro vodu a odtoky.',
      radialni: 'Štěrbiny paprskovitě v prstencích – vypadá jako sítko do dřezu.',
      kosoctverec: 'Kosočtverce (tahokov) – žebra pod ±30°.',
      tkana: 'Dvě vrstvy pásů křížem: spodní na podložce, horní je přemostí. Jemné oko bez zalévání děr.',
    }[p.oko.typ];
  }
  document.querySelectorAll('#paletaDruhu button').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.druh === app.p.druh) return;
    app.zmen(q => { q.druh = b.dataset.druh; });
    app.naplnFormular();
  }));
  document.querySelectorAll('[data-rezim]').forEach(b => b.addEventListener('click', () => nastavRezim(b.dataset.rezim)));
  function nastavRezim(r) {
    stavZobr.rezim = r;
    const tt = $('tTisk');
    if ((r === 'tisk') !== (tt.getAttribute('aria-pressed') === 'true')) tt.click(); else zobraz(true);
  }

  /* ---------- přepočet ---------- */
  function prepocitej() {
    p = app.p;
    document.querySelectorAll('#paletaDruhu button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.druh === p.druh)));
    H0 = SITA.kontroly(p);
    souhrny();
    const tezke = H0.some(h => h.uroven === 'chyba' && /otvorů/.test(h.text));
    if (!wasm || tezke) {
      model = null; tiskDily = null;
      chybaStavby = chybaJadra || (tezke ? 'Model se nestaví – příliš mnoho otvorů (viz Kontrola).' : '');
      dokonci();
      return;
    }
    const st = $('stav3d'); st.textContent = 'Počítám…'; st.classList.remove('chyba');
    const moje = ++cekaStavba;
    setTimeout(() => {
      if (moje !== cekaStavba) return;
      try {
        model = SITA.postav(wasm, app.p);
        tiskDily = G3D.tiskoveRozlozeni(model.dily, app.p.tisk.kusu, 6, app.p.tisk.podlozka);
        chybaStavby = '';
      } catch (e) { model = null; tiskDily = null; chybaStavby = 'Model nelze sestavit: ' + (e && e.message || e); }
      dokonci();
    }, 20);
  }
  function dokonci() {
    p = app.p;
    const st = $('stav3d');
    st.textContent = wasm || chybaJadra ? chybaStavby : 'Načítám geometrické jádro…';
    st.classList.toggle('chyba', !!chybaStavby);
    let H = H0;
    if (model) H = H.concat(SITA.kontrolyModelu(p, G3D.tiskoveRozlozeni(model.dily, 1, 6, p.tisk.podlozka)));
    app.hlaseni(H, { chybaStavby, boxy: ['boxTvar', 'boxOko'] });
    zobraz(false);
    vypisVysledky();
    vypisVypocty();
    kusovnik();
    exportDilu();
    tabulkaKalibrace();
  }
  function zobraz(novyPohled) {
    p = app.p;
    nahled.barvy(css('--border-strong'), css('--border'), css('--text'));
    document.querySelectorAll('[data-rezim]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.rezim === stavZobr.rezim)));
    $('legPrevisy').hidden = !(nahled.stav.previsy && stavZobr.rezim !== 'sestava');
    if (!model) { nahled.nastav(null); return; }
    const r = stavZobr.rezim;
    if (r === 'kalibrace') { const k = kalibrace(); if (k) { nahled.nastav(G3D.tiskoveRozlozeni(k.dily, 1, 6, 200), { tisk: true, novyPohled, uhel: p.tisk.uhel }); return; } }
    if (r === 'tisk') nahled.nastav(tiskDily, { tisk: true, novyPohled, uhel: p.tisk.uhel });
    else nahled.nastav(model.dily, { novyPohled });
  }
  /** Kalibrační vzorek – staví se až na požádání a pamatuje se podle parametrů, které ho ovlivňují. */
  function kalibrace() {
    if (!wasm) return null;
    const q = app.p, klic = JSON.stringify([q.oko, q.tisk.tryska, q.tisk.kompenzace, q.druh === 'vez' ? q.vez.okoDolni : 0, q.druh]);
    if (kal && kalKlic === klic) return kal;
    try { kal = SITA.postavKalibraci(wasm, q); kalKlic = klic; } catch (e) { kal = null; Dialog.chyba('Kalibrační vzorek nelze sestavit: ' + (e && e.message || e)); }
    return kal;
  }

  /* ---------- souhrny a tabulky ---------- */
  function souhrny() {
    const o = SITA.odvozene(p), t = p.tvar;
    const roz = t.typ === 'kruh' ? `Ø ${fmt(t.prumer)}` : t.typ === 'mnohouhelnik' ? `${t.stran}úhelník ${fmt(t.prumer)}` : `${fmt(t.sirka)} × ${fmt(t.delka)}`;
    TrubkyGui.souhrn('sTvar', t.typ === 'mnohouhelnik' ? `pravidelný ${roz} mm` : `${N.tvar[t.typ]} ${roz} mm`, true);
    TrubkyGui.souhrn('sKuzel', p.kuzel.typ === 'miska' ? `košík Ø ${fmt(p.kuzel.prumer)} / ${fmt(p.kuzel.dno)}, stěna ${fmt(o.k ? o.k.alfa : 0, 1)}°` : `Ø ${fmt(p.kuzel.prumer)}, kužel ${fmt(2 * p.kuzel.uhel)}°`, true);
    TrubkyGui.souhrn('sLem', p.druh === 'vlozka' ? `stěna ${fmt(p.lem.tl, 1)} · okraj ${fmt(p.lem.okraj, 1)}` : `výška ${fmt(p.lem.vyska)} · stěna ${fmt(p.lem.tl, 1)} · okraj ${fmt(p.lem.okraj, 1)}`, true);
    TrubkyGui.souhrn('sVlozka', p.vlozka.presah > 0 ? `límec ${fmt(p.vlozka.presah)} · nákružek ${fmt(p.vlozka.hloubka)} · vůle ${fmt(p.vlozka.vule, 2)}` : `bez límce · nákružek ${fmt(p.vlozka.hloubka)} · vůle ${fmt(p.vlozka.vule, 2)}`, true);
    const vm = p.vez.vicko ? (p.vez.miska ? 'víko a miska' : 'jen víko') : (p.vez.miska ? 'jen miska' : 'bez víka a misky');
    TrubkyGui.souhrn('sVez', `sít ${p.vez.pater} · oka ${SITA.okaVeze(p).map(a => fmt(a, 1)).join('/')} mm · ${vm}`, true);
    TrubkyGui.souhrn('sUchyty', N.uchyty[p.uchyty.typ], p.uchyty.typ !== 'zadne');
    TrubkyGui.souhrn('sOko', p.druh === 'vez' ? `${N.oko[p.oko.typ]} · žebro ${fmt(p.oko.zebro, 1)} · tl. ${fmt(p.oko.tl, 1)}` : `${N.oko[p.oko.typ]} ${fmt(p.oko.velikost, 1)} · žebro ${fmt(p.oko.zebro, 1)} · tl. ${fmt(p.oko.tl, 1)}`, true);
    TrubkyGui.souhrn('sVyztuha', N.vyztuha[p.vyztuha.typ], p.vyztuha.typ !== 'zadna');
    $('sTisk').textContent = `${p.tisk.material} · ${fmt(p.tisk.tryska, 1)}`;
    const r = o.sita.map(s => `<tr><td>${esc(s.nazev)}</td><td class="c">${fmt(s.a, 1)}</td><td class="c">${fmt(s.b, 1)}</td><td class="c">${fmt(s.a + s.b, 1)}</td><td class="c">≈ ${fmt(s.otvoru, 0)}</td><td class="c">${fmt(100 * s.Aotvoru / Math.max(1, s.Avnitr), 0)} %</td></tr>`);
    $('tabOko').innerHTML = '<tr><th>Síto</th><th class="c">Oko</th><th class="c">Žebro</th><th class="c">Rozteč</th><th class="c">Otvorů</th><th class="c">Volná pl.</th></tr>' + r.join('');
  }
  const box = (a, b, c, d) => G3D.dlazdice(a, b, c, d);
  function vypisVysledky() {
    const el = $('vVysledky'), karta = $('karta3d');
    if (!model) { el.innerHTML = box('Model', wasm ? (chybaStavby ? 'nelze sestavit' : 'počítám…') : 'načítám…', esc(chybaStavby)); karta.innerHTML = ''; $('vSit').innerHTML = ''; return; }
    const mat = SITA.MATERIALY[p.tisk.material], o = SITA.odvozene(p);
    const V = model.dily.reduce((s, d) => s + d.objem, 0) * p.tisk.kusu;
    const od = G3D.odhadTisku(V, mat.hustota, { dilu: model.dily.length * p.tisk.kusu });
    const B = model.dily.map(d => G3D.obal(d.poz)).reduce((a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2]), Math.max(a[3], b[3]), Math.max(a[4], b[4]), Math.max(a[5], b[5])]);
    const sx = B[3] - B[0], sy = B[4] - B[1], sz = B[5] - B[2];
    const s0 = model.sita[0], fi = s0.otvory / s0.vnitrni;
    let h = box('Rozměry', `${fmt(sx)} × ${fmt(sy)} × ${fmt(sz)} mm`, p.druh === 'vez' ? 'složená věž' : 'š × h × v v montážní poloze');
    h += box('Volná plocha', `${fmt(100 * fi, 0)} %`, model.sita.length > 1 ? `horní síto: ${fmt(s0.otvory / 100, 1)} cm² otvorů z ${fmt(s0.vnitrni / 100, 1)} cm²` : `${fmt(s0.otvory / 100, 1)} cm² otvorů z ${fmt(s0.vnitrni / 100, 1)} cm²`);
    h += box('Objem', `${fmt(V / 1000, 1)} cm³`, `dílů: ${model.dily.length} · sad: ${p.tisk.kusu}`);
    h += box('Hmotnost', `${fmt(od.g, od.g < 10 ? 1 : 0)} g`, `${mat.nazev}, plný díl`);
    h += box('Filament', `${fmt(od.metru, 1)} m`, 'průměr 1,75 mm');
    h += box('Doba tisku', `≈ ${od.minut < 60 ? od.minut + ' min' : fmt(od.minut / 60, 1) + ' h'}`, 'hrubý odhad – jemné síto tiskne pomaleji');
    const pv = SITA.pevnost(p, o.sita[0]);
    h += box('Průhyb pod nákladem', `${pv.pruhyb < 0.01 ? '< 0,01' : fmt(pv.pruhyb, pv.pruhyb < 1 ? 2 : 1)} mm`, `${fmt(pv.zatizeni, pv.zatizeni < 1 ? 2 : 1)} kg ${SITA.NASYPKY[p.vypocet.material].nazev}`, pv.napeti > pv.dovolene ? 'chyba-t' : pv.pruhyb > pv.mezPruhybu ? 'mez-t' : 'ok-t');
    el.innerHTML = h;
    karta.innerHTML = `<div class="titul">${esc(N.druh[p.druh])}</div><b>${fmt(sx)} × ${fmt(sy)} × ${fmt(sz)}</b> mm · <b>${fmt(od.g, 0)}</b> g ${mat.nazev}<br>`
      + `${esc(N.oko[p.oko.typ])} ${model.sita.map(s => fmt(s.a, 1)).join('/')} mm · volná plocha <b>${fmt(100 * fi, 0)} %</b>`;
    $('vSit').innerHTML = model.dily.map(d => { const k = KRAB.kontrolaSite(d.poz, d.idx); return box('Síť – ' + esc(d.nazev), k.uzavrena && d.teles === 1 ? '✔ těsná' : '✖ netěsná', `${k.trojuhelniku} trojúhelníků, ${d.teles} těleso, ${model.cas} ms`, k.uzavrena && d.teles === 1 ? 'ok-t' : 'chyba-t'); }).join('');
  }
  function vypisVypocty() {
    const v = SITA.vypocty(p, model), el = $('vVypocty');
    $('sVypocty').textContent = v.length ? `${fmt(100 * v[0].podil, 0)} %` : '';
    let h = '';
    for (const x of v) {
      const pr = x.prutok, pv = x.pevnost;
      h += `<div class="vypocet-sito"><h3>${esc(x.s.nazev)} – oko ${fmt(x.s.a, 1)} mm</h3><div class="vysledky">`;
      h += box('Volná plocha', `${fmt(100 * x.podil, 0)} %`, x.presne ? `${fmt(x.Aotv / 100, 1)} cm² otvorů (změřeno na modelu)` : `${fmt(x.Aotv / 100, 1)} cm² otvorů (odhad ze vzoru)`);
      h += box('Průtok vody', pr.drzi ? 'síto drží vodu' : `≈ ${fmt(pr.lmin, pr.lmin < 10 ? 1 : 0)} l/min`, pr.drzi ? `hladina ${fmt(p.vypocet.hladina)} mm < práh ${fmt(pr.hMin, 0)} mm` : `při hladině ${fmt(p.vypocet.hladina)} mm, výtok Cd 0,62`, pr.drzi ? 'mez-t' : '');
      h += box('Práh povrchového napětí', `${fmt(pr.hMin, 0)} mm vody`, `voda proteče až nad tuto hladinu (otvor ${fmt(pr.dh, 1)} mm)`);
      h += box('Náklad', `${fmt(pv.zatizeni, pv.zatizeni < 1 ? 2 : 1)} kg`, `${SITA.NASYPKY[p.vypocet.material].nazev} ${fmt(p.vypocet.vrstva)} mm · ${fmt(pv.tlak, 0)} Pa`);
      h += box('Průhyb', `${pv.pruhyb < 0.01 ? '< 0,01' : fmt(pv.pruhyb, pv.pruhyb < 1 ? 2 : 1)} mm`, pv.pruhybZeber ? `rozpětí ${fmt(pv.rozpeti, 0)} mm, mez ${fmt(pv.mezPruhybu, 1)} mm (žebra ${fmt(pv.pruhybZeber, 2)})` : `rozpětí ${fmt(pv.rozpeti, 0)} mm, mez ${fmt(pv.mezPruhybu, 1)} mm`, pv.pruhyb > pv.mezPruhybu ? 'mez-t' : 'ok-t');
      h += box('Napětí v žebrech', `${fmt(pv.napeti, 1)} MPa`, `dovoleno ${fmt(pv.dovolene, 0)} MPa (pevnost / 3), podíl žeber ${fmt(100 * pv.eta, 0)} %`, pv.napeti > pv.dovolene ? 'chyba-t' : 'ok-t');
      h += '</div></div>';
    }
    // co projde – sloupec pro každé síto
    const sl = v.map(x => x.propad);
    h += '<div class="vypocet-sito"><h3>Co projde okem</h3><div class="tab-box"><table class="tabulka propad"><tr><th>Materiál</th><th class="c">Zrno mm</th>'
      + v.map(x => `<th class="c">${fmt(x.s.a, 1)} mm</th>`).join('') + '</tr>';
    SITA.ZRNITOST.forEach((z, i) => {
      h += `<tr><td>${esc(z.nazev)}</td><td class="c">${fmt(z.min, z.min < 0.1 ? 3 : 1)}–${fmt(z.max, 1)}</td>`
        + sl.map(s => { const x = s[i], tr = { projde: 'projde', 'částečně': 'castecne', 'zachytí': 'zachyti' }[x.stav]; return `<td class="c ${tr}">${x.stav === 'projde' ? '✔ projde' : x.stav === 'zachytí' ? '✖ zůstane' : `◐ ${fmt(100 * x.podil, 0)} %`}</td>`; }).join('') + '</tr>';
    });
    h += '</table></div></div>';
    el.innerHTML = h;
    $('poznZrnitost').textContent = `Zrnitost: písek a štěrk podle ČSN EN ISO 14688-1, ostatní typické hodnoty (${SITA.DATUM_ZRNITOSTI}) – ověřit měřením. Podíl „◐“ předpokládá rovnoměrné rozdělení zrn v logaritmu velikosti. Průtok a průhyb jsou odhady.`;
  }
  function kusovnik() {
    const r = SITA.kusovnik(p, model);
    $('tabKusovnik').innerHTML = '<tr><th>Díl</th><th class="c">Ks</th><th>Pozn.</th></tr>' + (r.length ? r.map(x => `<tr><td>${esc(x[0])}</td><td class="c">${x[1]}</td><td>${esc(x[2])}</td></tr>`).join('') : '<tr><td colspan="3">model se ještě staví</td></tr>');
  }
  function tabulkaKalibrace() {
    const h = SITA.kalibraceHodnoty(p);
    $('tabKal').innerHTML = '<tr><th>Okénko (zářezů)</th>' + [1, 2, 3, 4, 5].map(i => `<th class="c">${i}</th>`).join('') + '</tr>'
      + `<tr><td>Proužek oka – oko / žebro ${fmt(h.b, 2)}</td>${h.oka.map(a => `<td class="c">${fmt(a, 1)}</td>`).join('')}</tr>`
      + `<tr><td>Proužek žeber – žebro / oko ${fmt(h.a, 1)}</td>${h.zebra.map(b => `<td class="c">${fmt(b, 2)}</td>`).join('')}</tr>`;
  }

  /* ---------- nabídky, export ---------- */
  TrubkyGui.pripoj({ klic: 'webapp_sita_gui', pohled: j => nahled.pohled(j) });
  for (const v of SITA.PREDVOLBY) {
    const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
    b.innerHTML = `${esc(v.nazev)}<span class="pozn">${esc(v.popis)}</span>`;
    b.addEventListener('click', () => { const q = SITA.predvolba(v.id); q.tisk = Object.assign(SITA.kopie(app.p.tisk), { material: q.tisk.material }); app.nahrad(q); });
    $('seznamPredvoleb').appendChild(b);
  }
  function lzeExport() {
    if (!model) { Dialog.chyba(chybaStavby || (wasm ? 'Model se ještě počítá.' : 'Geometrické jádro se ještě načítá.')); return false; }
    return true;
  }
  const kusy = (dily = model.dily) => G3D.tiskoveRozlozeni(dily, app.p.tisk.kusu, 6, app.p.tisk.podlozka);
  function exportVse(druh) {
    if (!lzeExport()) return;
    if (druh === 'stl') app.stahni(KRAB.stlBinarni(kusy(), 'sita - github_site'), app.jmeno('.stl'), 'model/stl');
    else app.stahni(KRAB.soubor3mf(kusy(), app.p.nazev || 'Síto'), app.jmeno('.3mf'), 'model/3mf');
  }
  $('btnStl').addEventListener('click', () => exportVse('stl'));
  $('btn3mf').addEventListener('click', () => exportVse('3mf'));
  function exportDilu() {
    const el = $('exportDilu'); el.innerHTML = '';
    if (!model || model.dily.length < 2) return;
    for (const d of model.dily) {
      const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
      b.innerHTML = `⬇ STL – ${esc(d.nazev)}<span class="pozn">jen tento díl</span>`;
      b.addEventListener('click', () => app.stahni(KRAB.stlBinarni(kusy([d]), 'sita - ' + d.jmeno), app.jmeno('_' + d.jmeno + '.stl'), 'model/stl'));
      el.appendChild(b);
    }
  }
  function exportKalibrace() {
    const k = kalibrace(); if (!k) return;
    app.stahni(KRAB.stlBinarni(G3D.tiskoveRozlozeni(k.dily, 1, 6, 200), 'sita - kalibrace'), app.jmeno('_kalibrace.stl'), 'model/stl');
  }
  $('btnKalStl').addEventListener('click', exportKalibrace);
  $('btnKalStl2').addEventListener('click', exportKalibrace);
  $('btnKalUkaz').addEventListener('click', () => nastavRezim('kalibrace'));

  /* ---------- výkres ---------- */
  function svgVykresu() {
    if (!lzeExport()) return null;
    const mat = SITA.MATERIALY[app.p.tisk.material], d = new Date();
    const V = model.dily.reduce((s, x) => s + x.objem, 0);
    return SITA_VYK.sestavVykres(app.p, model, {
      datum: `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`, hmotnost: V / 1000 * mat.hustota, material: mat.nazev,
      kusovnik: SITA.kusovnik(app.p, model), vypocty: SITA.vypocty(app.p, model),
    });
  }
  const ukazVykres = () => { const svg = svgVykresu(); if (!svg) return; $('vykresObsah').innerHTML = svg; $('vykresDlg').showModal(); };
  const svgStahni = () => { const svg = svgVykresu(); if (svg) app.stahni(svg, app.jmeno('_vykres.svg'), 'image/svg+xml'); };
  function tiskVykresu() {
    const svg = svgVykresu(); if (!svg) return;
    const ram = document.createElement('iframe');
    ram.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(ram);
    const dd = ram.contentDocument;
    dd.open(); dd.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(app.jmeno(''))}</title><style>@page{size:A4 landscape;margin:0}html,body{margin:0;padding:0}svg{display:block;width:297mm;height:210mm}</style></head><body>${svg}</body></html>`); dd.close();
    setTimeout(() => { try { ram.contentWindow.focus(); ram.contentWindow.print(); } finally { setTimeout(() => ram.remove(), 60000); } }, 250);
  }
  $('btnVykres').addEventListener('click', ukazVykres);
  $('btnVykresSvg').addEventListener('click', svgStahni);
  $('btnVykresSvg2').addEventListener('click', svgStahni);
  $('btnVykresTisk').addEventListener('click', tiskVykresu);
  $('btnVykresTisk2').addEventListener('click', tiskVykresu);
  $('btnZavritVyk').addEventListener('click', () => $('vykresDlg').close());

  app.prepinac('tRez', h => { nahled.prepni('rez', h); $('legRez').hidden = !h; });
  app.prepinac('tHrany', h => nahled.prepni('hrany', h), false);
  app.prepinac('tPrevisy', h => { nahled.prepni('previsy', h); $('legPrevisy').hidden = !(h && stavZobr.rezim !== 'sestava'); }, true);
  app.prepinac('tPravitka', h => nahled.prepni('pravitka', h));
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
  window.SITA_UI = { get p() { return app.p; }, get model() { return model; }, zmen: app.zmen, nahrad: app.nahrad, naplnFormular: app.naplnFormular, prepocitej, nahled, app, nastavRezim };
})();

/* ============================================================
   odizolovac/ui.js – ovládání stránky Stahovák izolace nad společným zapojením gen3d/aplikace.js
   (historie, projekt JSON, Moje…, sdílení #p=, klávesy, manifold).
   Projekt: ODIZ.normalizujStav – {nazev, rezim, hodnoty: {<režim>: {…, vodice}}}
   (localStorage webapp_odizolovac_projekt; starší webapp_odizolovac_stav a _sady se jednou převezmou).
   Formulář se staví podle režimu (data-p="hodnoty.<režim>.<klíč>", vodiče …vodice.<i>.D), vlastní obsluha změn – živě při psaní.
   Pro testy: window.ODIZ_APP.
   ============================================================ */
/* global G3D, Dialog, TrubkyGui, KRAB */
(function () {
  'use strict';
  const J = window.ODIZ, G = window.ODIZ_GEO, V = window.ODIZ_VYKRES, S = window.ODIZ_SCENA;
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const SKUPINY = { merka: 'Měrka', cepel: 'Čepel z ulamovacího nože', rez: 'Řez a nastavení', tvar: 'Kabel', kloub: 'Pružný kloub a ramena', tisk: 'Tisk a tvar tělesa' };
  const VPRAVO = ['kloub', 'tisk'];
  const SVODICI = r => J.SVODICI.includes(r);
  const KLOUB = r => J.KLOUB.includes(r);
  const HUSTOTA_PLA = 1.24;

  /* ---------- převzetí starších dat (jednou) ---------- */
  try {
    const stary = localStorage.getItem('webapp_odizolovac_stav');
    if (stary && !localStorage.getItem('webapp_odizolovac_projekt')) localStorage.setItem('webapp_odizolovac_projekt', stary);
    const sady = localStorage.getItem('webapp_odizolovac_sady');
    if (sady && !localStorage.getItem('webapp_odizolovac_tvary')) {
      const polozky = J.prevedSady(JSON.parse(sady));
      if (polozky.length) localStorage.setItem('webapp_odizolovac_tvary', JSON.stringify({ verze: 1, polozky }));
    }
  } catch (e) { /* bez úložiště nebo poškozený záznam */ }

  let norm = null, roz = null, w = null, telo = null, sit = null, dily = null, animace = 0, app = null;
  let rovina = 0, vybranaDrazka = 0, chybaJadra = null, chybaStavby = '', tisk = false, previsy = true, formRezim = null, rezimRez = null;

  /* ---------- projekt ---------- */
  function nactiProjekt(text) {
    let j;
    try { j = JSON.parse(text); } catch (e) { throw new Error('Soubor není platný JSON.'); }
    if (j && j.format === 'odizolovac-v1') {          // starší export návrhu (jen jeden režim)
      if (!J.REZIMY[j.rezim]) throw new Error('Soubor neobsahuje návrh stahováku.');
      const q = G3D.kopie(app.p);
      q.rezim = j.rezim; q.hodnoty[j.rezim] = Object.assign(J.vychozi(j.rezim), j.hodnoty || {});
      return J.normalizujStav(q);
    }
    if (j && j.format) throw new Error('Soubor není projekt Stahovák izolace.');
    return G3D.nactiProjektJson(text, 'odizolovac', J.normalizujStav, 'Stahovák izolace');
  }
  function vychozi() {
    const q = J.vychoziStav();
    if (!app) return q;
    const z = G3D.kopie(app.p);                      // jako dřív: výchozí hodnoty jen zvoleného režimu
    z.hodnoty[z.rezim] = q.hodnoty[z.rezim];
    return z;
  }
  app = G3D.aplikace({
    typ: 'odizolovac', nazev: 'Stahovák izolace', klic: 'webapp_odizolovac', soubor: 'stahovak',
    normalizuj: J.normalizujStav, vychozi, nactiProjekt, formular: false,
    popis: q => J.REZIMY[q.rezim].nazev + (SVODICI(q.rezim) ? ` · ${(q.hodnoty[q.rezim].vodice || []).length} vodičů` : ''),
    predNaplnenim: q => vykresliFormular(q),
    prepocitej: () => prestav(), zpozdeni: 150,
    png: () => S.snimek(), pohled: j => S.pohled(j),
    exportStl: () => exportStl(),
    doModelare: () => (lzeExport() ? { data: KRAB.soubor3mf([dilTisku()], app.p.nazev || 'Stahovák'), pripona: '.3mf' } : null),
    zkratky: { r: 'tRez', h: 'tHrany', m: 'tTisk', p: 'tPrevisy', l: 'tPravitka', c: 'tCepele', v: 'tVodice', t: 'tPruhledne' },
  });
  const H = () => app.p.hodnoty[app.p.rezim];

  /* ---------- formulář ---------- */
  function vykresliFormular(q) {
    const r = q.rezim, h = q.hodnoty[r];
    if (formRezim !== r) {
      formRezim = r;
      $('popisRezimu').textContent = J.REZIMY[r].popis;
      for (const b of document.querySelectorAll('#rezimy button')) b.setAttribute('aria-pressed', b.dataset.rezim === r ? 'true' : 'false');
      $('blokVodice').hidden = !SVODICI(r);
      $('legendaVodice').textContent = r === 'sesivacka' ? 'Vodiče (pořadí drážek se určí samo podle mezery mezi ostřími)'
        : J.VK.includes(r) ? 'Vodiče (pro každý se spočítá nastavení šroubu; ⌀ jádra je důležitý)' : 'Vodiče (drážky zleva doprava)';
      $('blokStisk').hidden = !KLOUB(r);
      if (!KLOUB(r)) zastavAnimaci();
      for (const [kam, sk] of [['formTvar', Object.keys(SKUPINY).filter(x => !VPRAVO.includes(x))], ['formTisk', VPRAVO]]) {
        const html = [];
        for (const s of sk) {
          const defs = J.PARAMETRY.filter(d => d.skupina === s && d.rezimy.includes(r));
          if (!defs.length) continue;
          html.push(`<details class="oddil" data-oddil="${s}" open><summary><span class="oddil-nazev">${SKUPINY[s]}</span><span class="souhrn" id="s_${s}"></span></summary><div class="oddil-telo"><div class="mrizka">`);
          for (const d of defs) {
            const id = 'p_' + d.klic, cesta = `hodnoty.${r}.${d.klic}`;
            if (d.typ === 'text') html.push(`<div class="pole cela"><label for="${id}">${esc(d.nazev)}</label><input type="text" id="${id}" data-p="${cesta}" data-typ="text"></div>`);
            else if (d.typ === 'vyber') html.push(`<div class="pole cela"><label for="${id}">${esc(d.nazev)}</label><select id="${id}" data-p="${cesta}" data-typ="text">${d.moznosti.map(([k, t]) => `<option value="${k}">${esc(t)}</option>`).join('')}</select></div>`);
            else html.push(`<div class="pole"><label for="${id}">${esc(d.nazev)}</label><div class="vstup"><input type="text" inputmode="decimal" class="mm" id="${id}" data-p="${cesta}"><span class="jedn">${esc(d.jedn || '')}</span></div>`
              + (d.napoveda ? `<p class="napoveda">${esc(d.napoveda)}</p>` : '') + '</div>');
          }
          html.push('</div></div></details>');
        }
        $(kam).innerHTML = html.join('');
      }
    }
    if (SVODICI(r) && $('tabVodice').tBodies[0].rows.length !== h.vodice.length || $('tabVodice').dataset.rezim !== r) vykresliVodice(r, h);
  }
  function vykresliVodice(r, h) {
    const tb = $('tabVodice').tBodies[0], c = i => `hodnoty.${r}.vodice.${i}`;
    $('tabVodice').dataset.rezim = r;
    tb.innerHTML = (h.vodice || []).map((v, i) => `<tr data-i="${i}">
      <td><input type="text" data-p="${c(i)}.nazev" data-typ="text" aria-label="Název vodiče ${i + 1}"></td>
      <td class="c"><input type="text" inputmode="decimal" data-p="${c(i)}.D" aria-label="Průměr přes izolaci ${i + 1}"></td>
      <td class="c"><input type="text" inputmode="decimal" data-p="${c(i)}.t" aria-label="Tloušťka izolace ${i + 1}"></td>
      <td class="c"><input type="text" inputmode="decimal" data-p="${c(i)}.d" aria-label="Průměr jádra ${i + 1}"></td>
      <td class="x"><button type="button" class="tl" data-smaz="${i}" title="Odebrat" aria-label="Odebrat vodič ${i + 1}">×</button></td></tr>`).join('');
  }
  // předvolby čepele a kabelu plní rozměry; ruční rozměr přepne na „vlastní“ (v jednom kroku zpět)
  function navazne(h, k, x) {
    if (k === 'cepel' && J.CEPELE[x] && J.CEPELE[x].W) { const c = J.CEPELE[x]; Object.assign(h, { cepelW: c.W, cepelT: c.t, roztec: c.roztec, uhel: c.uhel }); }
    else if (k === 'kabel' && x !== 'vlastni') { const c = J.KABELY.find(y => y.id === x); if (c) Object.assign(h, { kabelD: c.D, kabelT: c.t }); }
    else if (k === 'plochy' && x !== 'vlastni') { const c = J.PLOCHE.find(y => y.id === x); if (c) Object.assign(h, { plochyS: c.S, plochyH: c.H, plochyT: c.t }); }
    else if (['cepelW', 'cepelT', 'roztec', 'uhel'].includes(k) && h.cepel !== 'vlastni') h.cepel = 'vlastni';
    else if (['kabelD', 'kabelT'].includes(k) && h.kabel !== 'vlastni') h.kabel = 'vlastni';
    else if (['plochyS', 'plochyH', 'plochyT'].includes(k) && h.plochy !== 'vlastni') h.plochy = 'vlastni';
    else return false;
    return true;
  }
  function zmenaPole(e, konec) {
    const el = e.target.closest('[data-p]');
    if (!el) return;
    const cesta = el.dataset.p;
    let x;
    if (el.dataset.typ === 'text') x = el.value;
    else if (el.tagName === 'SELECT' && !/^-?\d+([.,]\d+)?$/.test(el.value)) x = el.value;
    else { x = G3D.ctiCislo(el.value); if (!Number.isFinite(x)) { el.classList.add('spatne'); return; } }
    el.classList.remove('spatne');
    let dalsi = false;
    app.zmen(q => {
      G3D.poloz(q, cesta, x);
      const c = cesta.split('.');
      if (c[0] === 'hodnoty' && c.length === 3) dalsi = navazne(q.hodnoty[c[1]], c[2], x);
    }, 'pole:' + cesta);
    if (konec || dalsi) {
      if (dalsi && !konec) for (const p of document.querySelectorAll('[data-p]')) if (p !== el) { const v = G3D.vezmi(app.p, p.dataset.p); if (p.tagName === 'SELECT') p.value = String(v); else if (typeof v === 'number') p.value = J.fmt(v, 3); }
      else app.naplnFormular();
    }
  }
  // zachytávací fáze: dojde i událost bez bublání (dispatchEvent(new Event('change')))
  for (const id of ['boxTvar', 'boxTisk', 'nabSoubor']) {
    $(id).addEventListener('input', e => { if (e.target.tagName === 'INPUT' && e.target.id !== 'pridejVodic') zmenaPole(e, false); }, true);
    $(id).addEventListener('change', e => { if (e.target.id !== 'pridejVodic') zmenaPole(e, true); }, true);
  }

  /* ---------- přestavba ---------- */
  const zprava3d = t => { $('stav3d').textContent = t || ''; };
  function prestav(resetKamery) {
    const r = app.p.rezim;
    if (rezimRez !== r) { rezimRez = r; rovina = 0; vybranaDrazka = 0; resetKamery = true; }
    norm = J.normalizuj(r, H());
    ukazStavPoli();
    const hl = [];
    const pole = k => { const m = /^vodic(\d+)$/.exec(k); return m ? [`hodnoty.${r}.vodice.${m[1]}.D`] : k === 'vodice' ? [] : [`hodnoty.${r}.${k}`]; };
    for (const c of norm.chyby) hl.push({ uroven: 'chyba', text: c.text, pole: pole(c.klic) });
    chybaStavby = '';
    if (norm.chyby.length) { roz = null; uvolni(); sit = null; zprava3d(w || chybaJadra ? 'Opravte parametry označené červeně – s nimi nejde model sestavit.' : 'Načítám výpočetní jádro…'); ukazHlaseni(hl); ukazVysledky(); ukazRezy(); souhrny(); return; }
    roz = J.rozvrhni(r, norm.p);
    for (const u of norm.upozorneni.concat(roz.upozorneni)) hl.push({ uroven: 'varovani', text: u.text, pole: u.klic ? pole(u.klic) : [] });
    for (const t of G.kontrolaCepeli(roz)) hl.push({ uroven: 'chyba', text: t });
    if (rovina >= V.roviny(roz).length) rovina = 0;
    if (vybranaDrazka >= (roz.nastaveni || roz.drazky).length) vybranaDrazka = 0;
    if (w) {
      uvolni();
      try {
        if (roz.kloub) {
          const v = G.postavSesivacku(w, roz);
          telo = v.telo; dily = [v.dolni, v.horni, v.horniSevreno];
          sit = J.sitZMeshe(telo.getMesh());
        } else {
          telo = G.postav(w, roz);
          sit = J.sitZMeshe(telo.getMesh());
        }
        zobrazModel(!resetKamery);
      } catch (e) { chybaStavby = 'Model nelze sestavit: ' + (e && e.message || e); sit = null; uvolni(); }
    }
    zprava3d(w ? chybaStavby : chybaJadra ? 'Výpočetní jádro (manifold-3d) se nepodařilo načíst: ' + (chybaJadra.message || chybaJadra) : 'Načítám výpočetní jádro…');
    ukazHlaseni(hl);
    ukazVysledky();
    ukazRezy();
    ukazPostup();
    souhrny();
  }
  /* 3D: pracovní poloha (s čepelemi, vodiči a stiskem) nebo síť STL v tiskové poloze s převisy. */
  function zobrazModel(zachovat) {
    if (!sit || !roz) return;
    try {
      if (tisk) {
        const s = sitKTisku(), b = G3D.obal(s.poz);
        S.nastavModel({ sit: s, roz: { cepele: [], vodice: [], rozmery: { x: b[3] - b[0], y: b[4] - b[1], z: b[5] - b[2] } }, obrysy: [],
          stred: [(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2], tridy: previsy ? G3D.tridyPrevisu(s.poz, s.idx, 45) : null }, zachovat);
      } else if (roz.kloub) {
        S.nastavModel({ sit, roz, obrysy: roz.cepele.map(G.obrysCepele), dily: { dolni: J.sitZMeshe(dily[0].getMesh()), horni: J.sitZMeshe(dily[2].getMesh()) } }, zachovat);
      } else S.nastavModel({ sit, roz, obrysy: roz.cepele.map(G.obrysCepele) }, zachovat);
    } catch (e) { zprava3d('3D náhled nelze zobrazit: ' + (e && e.message || e)); }
    $('legPrevisy').hidden = !(tisk && previsy);
    $('legenda').hidden = tisk;
  }

  function uvolni() {
    for (const m of [telo].concat(dily || [])) if (m) { try { m.delete(); } catch (e) { /* už uvolněno */ } }
    telo = null; dily = null;
  }
  function ukazStavPoli() {
    for (const el of document.querySelectorAll('#formTvar input, #formTisk input, #tabVodice input')) el.classList.remove('chyba', 'mez');
    for (const c of norm.upozorneni) { const el = $('p_' + c.klic); if (el) el.classList.add('mez'); }
    for (const c of norm.chyby) {
      const el = $('p_' + c.klic); if (el) el.classList.add('chyba');
      const m = /^vodic(\d+)$/.exec(c.klic);
      if (m) for (const i of document.querySelectorAll(`#tabVodice tr[data-i="${m[1]}"] input`)) i.classList.add('chyba');
    }
  }
  function ukazHlaseni(hl) { app.hlaseni(hl, { chybaStavby: chybaStavby || (chybaJadra ? 'Výpočetní jádro se nenačetlo – 3D model a export nejsou k dispozici.' : ''), boxy: ['boxTvar', 'boxTisk'] }); }
  function souhrny() {
    const p = norm.p, r = app.p.rezim, f = J.fmt;
    const s = (id, t) => TrubkyGui.souhrn('s_' + id, t, true);
    if (SVODICI(r)) TrubkyGui.souhrn('sVodice', `${(H().vodice || []).length} × ` + (H().vodice || []).map(v => f(+v.D)).join(' / ') + ' mm', true);
    if (p.cepelW !== undefined) s('cepel', `${f(p.cepelW)} × ${f(p.cepelT)} mm, rýhy ${f(p.roztec)} mm / ${f(p.uhel, 0)}°`);
    if (p.podilRezu !== undefined) s('rez', `${f(p.podilRezu, 0)} % izolace${p.korekce ? ` ${p.korekce > 0 ? '+' : ''}${f(p.korekce)} mm` : ''}${p.delkaOdiz ? ` · doraz ${f(p.delkaOdiz)} mm` : ''}`);
    else if (p.uhelV !== undefined) s('rez', `V ${f(p.uhelV, 0)}°, zbytek ${f(p.zbytek)} mm, šroub M${f(p.sroubD)}`);
    if (p.kabelD !== undefined) s('tvar', `⌀ ${f(p.kabelD)} mm, plášť ${f(p.kabelT)}`);
    else if (p.plochyS !== undefined) s('tvar', `${f(p.plochyS)} × ${f(p.plochyH)} mm, plášť ${f(p.plochyT)}`);
    if (p.druhJadra !== undefined) s('merka', `${J.JADRA[p.druhJadra].nazev}, deska ${f(p.tlDesky)} mm`);
    if (p.delkaRamen !== undefined) s('kloub', `ramena ${f(p.delkaRamen, 0)} mm, oblouk ${f(p.tlListu)} mm, ${p.materialListu}`);
    if (p.dno !== undefined) s('tisk', `dno ${f(p.dno)} · stěna ${f(p.stena)} · štěrbina +${f(p.vuleStrbiny)} mm`);
  }

  function ukazVysledky() {
    const box = (popis, cislo, dalsi) => G3D.dlazdice(popis, cislo, dalsi);
    const lze = !!(roz && telo);
    $('btnStl').disabled = $('btn3mf').disabled = $('btnSvg').disabled = !lze;
    if (!roz) { $('vysledky').innerHTML = '<p class="chybovy">Opravte parametry označené červeně.</p>'; $('tabRezy').innerHTML = ''; $('tabKusovnik').innerHTML = ''; return; }
    const r = roz.rozmery, o = [];
    o.push(box('Rozměr výtisku', `${J.fmt(r.x, 1)} × ${J.fmt(r.y, 1)} × ${J.fmt(r.z, 1)} mm`, 'šířka × hloubka × výška'));
    if (telo) {
      const objem = telo.volume(), od = G3D.odhadTisku(objem, HUSTOTA_PLA);
      o.push(box('Materiál', `${J.fmt(objem / 1000, 1)} cm³`, `≈ ${J.fmt(objem / 1000 * HUSTOTA_PLA, 0)} g PLA při plné výplni`));
      o.push(box('Filament', `${J.fmt(od.metru, 2)} m`, 'průměr 1,75 mm, plný díl'));
      o.push(box('Doba tisku', `≈ ${od.minut < 60 ? od.minut + ' min' : J.fmt(od.minut / 60, 1) + ' h'}`, 'hrubý odhad'));
    }
    roz.souhrn.kusy.forEach(k => o.push(box(esc(k.nazev), `${k.clanku} ${k.clanku === 1 ? 'článek' : k.clanku < 5 ? 'články' : 'článků'}`,
      `ostří ${J.fmt(k.P)} mm, kapsa ${J.fmt(k.kapsa)} mm`)));
    if (roz.kloub) {
      const k = roz.kloub, tr = k.eps > k.epsDov ? 'spatne' : k.eps > 0.7 * k.epsDov ? 'mez' : 'ok';
      o.push(box('Pružný oblouk', `<span class="${tr}">${J.fmt(k.eps * 100)} %</span>`, `přetvoření při sevření (pro ${esc(k.material)} bezpečně do ${J.fmt(k.epsDov * 100)} %), délka ${J.fmt(k.L)} mm, poloměr ${J.fmt(k.R0, 1)} → ${J.fmt(k.R1, 1)} mm`));
      o.push(box('Síla pružiny', `≈ ${J.fmt(k.F, 1)} N`, 'u drážek při sevření, k tomu síla na zaříznutí'));
      o.push(box('Rozevření u čela', `${J.fmt(k.otevreniCelo, 1)} mm`, `tisková poloha, úhel ${J.fmt(k.th / J.RAD, 1)}°`));
    } else if (roz.rezim !== 'merka') o.push(box('Výška ostří', `${J.fmt(roz.zE)} mm`, `nad spodní plochou (dno ${J.fmt(roz.z0)} + čepel ${J.fmt(norm.p.cepelW)})`));
    if (roz.nastaveni) {
      const S2 = roz.souhrn;
      o.push(box('Rozsah jader', `${J.fmt(S2.rozsah[0])} – ${J.fmt(S2.rozsah[1])} mm`, `nejmenší = sevřeno (šroub na 0), největší = dosah ostří`));
      o.push(box('Dorazový šroub', `M${J.fmt(S2.sroub.d)} × ${S2.sroub.delka}`, `matice zespodu do šestihranu; 1 otáčka ≈ ${J.fmt(norm.p.stoupani)} mm vysunutí`));
    }
    if (roz.rezim === 'merka') {
      o.push(box('Otvory', `${roz.otvory.length}`, `${esc(J.JADRA[norm.p.druhJadra].nazev)}, ⌀ jádro + ${J.fmt(norm.p.vuleJadra)} + korekce ${J.fmt(norm.p.korekceOtvoru)} mm`));
      o.push(box('Drážky na délku', `${roz.kanaly.length}`, roz.kanaly.map(c => J.fmt(c.L)).join(', ') + ' mm'));
    }
    if (SVODICI(roz.rezim) && roz.souhrn.yDoraz !== null) o.push(box('Délka odizolování', `${J.fmt(roz.souhrn.delkaOdiz)} mm`, 'od roviny čepele k dorazu'));
    $('vysledky').innerHTML = o.join('');
    kusovnik();
    // tabulka řezů
    if (roz.nastaveni) {
      $('tabRezy').innerHTML = `<thead><tr><th>#</th><th>Vodič</th><th>⌀ jádra</th><th>⌀ izolace</th><th>Kosočtverec ⌀</th><th>Šroub od dosednutí</th><th>Řez</th></tr></thead><tbody>` +
        roz.nastaveni.map((n, j) => `<tr class="klik${j === vybranaDrazka ? ' vybrany' : ''}" data-j="${j}"><td>${j + 1}</td><td>${esc(n.nazev)}</td><td class="cis">${J.fmt(n.d)}</td><td class="cis">${J.fmt(n.D)}</td>
          <td class="cis">${J.fmt(2 * n.r)}</td><td class="cis ${n.otacky === null ? 'spatne' : 'ok'}">${n.otacky === null ? 'nejde' : J.fmt(n.otacky, 2) + ' ot. (' + J.fmt(n.vysun, 2) + ' mm)'}</td><td class="cis">${J.fmt(n.c)}</td></tr>`).join('') + '</tbody>';
      return;
    }
    if (roz.rezim === 'merka') {
      $('tabRezy').innerHTML = `<thead><tr><th>Průřez</th><th>⌀ jádra</th><th>⌀ otvoru (model)</th></tr></thead><tbody>` +
        roz.otvory.map(h => `<tr><td>${J.fmt(h.prurez)} mm²</td><td class="cis">${J.fmt(h.dJ)}</td><td class="cis">${J.fmt(h.d)}</td></tr>`).join('') + '</tbody>';
      return;
    }
    const radky = roz.drazky.map((g, j) => {
      const rr = roz.rezy[Math.min(j, roz.rezy.length - 1)], a = J.rozborDrazky(roz, j);
      const tr = a.podil > 0.95 ? 'spatne' : a.podil > 0.9 || a.podil < 0.5 ? 'mez' : 'ok';
      return `<tr class="klik${j === vybranaDrazka ? ' vybrany' : ''}" data-j="${j}"><td>${j + 1}</td><td>${esc(rr.nazev)}</td><td>${rr.druh}</td>
        <td class="cis">${J.fmt(g.sirka)}</td><td class="cis">${J.fmt(rr.t)}</td><td class="cis ${tr}">${a.cH !== undefined ? J.fmt(a.c) + ' / ' + J.fmt(a.cH) : J.fmt(a.c)}</td><td class="cis">${J.fmt(a.zbytek)}</td><td class="cis">${J.fmt(g.zDno)}</td></tr>`;
    });
    $('tabRezy').innerHTML = `<thead><tr><th>#</th><th>Drážka</th><th>Řez</th><th>Šířka</th><th>Izolace</th><th>${roz.rezim === 'sesivacka' ? 'Řez dole / nahoře' : 'Hloubka řezu'}</th><th>Zbývá</th><th>Dno z</th></tr></thead><tbody>${radky.join('')}</tbody>`;
  }
  /* Kusovník: výtisk, kusy čepele, pojistné kolíky, u kleští šroub s maticí. */
  function kusovnik() {
    const r = roz.rozmery, k = roz.souhrn.kusy, rad = [];
    rad.push(['Výtisk', '1', `${J.fmt(r.x, 1)} × ${J.fmt(r.y, 1)} × ${J.fmt(r.z, 1)} mm${telo ? `, ${J.fmt(telo.volume() / 1000, 1)} cm³` : ''}`]);
    if (J.VK.includes(roz.rezim) && k[0]) rad.push([`Kus čepele ${esc(k[0].nazev)}`, '4', `${k[0].clanku} ${k[0].clanku === 1 ? 'článek' : 'články/článků'}, ostří ${J.fmt(k[0].P)} mm`]);
    else k.forEach(x => rad.push([`Kus čepele – ${esc(x.nazev)}`, '1', `${x.clanku} ${x.clanku === 1 ? 'článek' : 'články/článků'}, ostří ${J.fmt(x.P)} mm`]));
    if (roz.koliky && roz.koliky.length) rad.push([`Pojistný kolík (filament ⌀ ${J.fmt(norm.p.kolik)} mm)`, String(roz.koliky.length), 'kousek filamentu zastrčený přes štěrbinu']);
    if (roz.nastaveni && roz.souhrn.sroub) rad.push([`Dorazový šroub M${J.fmt(roz.souhrn.sroub.d)} × ${roz.souhrn.sroub.delka} + matice`, '1', `matice s klíčem ${J.fmt(norm.p.maticeS)} mm do šestihranné kapsy zespodu`]);
    $('tabKusovnik').innerHTML = '<thead><tr><th>Díl</th><th class="cis">ks</th><th>Pozn.</th></tr></thead><tbody>' + rad.map(x => `<tr><td>${x[0]}</td><td class="cis">${x[1]}</td><td>${x[2]}</td></tr>`).join('') + '</tbody>';
  }

  function ukazRezy() {
    if (!roz) { $('rezSvg').innerHTML = $('detailSvg').innerHTML = ''; $('zalozkyRez').innerHTML = ''; return; }
    const R = V.roviny(roz);
    $('zalozkyRez').innerHTML = R.length > 1 ? R.map((x, i) => `<button type="button" class="tl" role="tab" data-rovina="${i}" aria-selected="${i === rovina}">${esc(x.nazev)}</button>`).join('') : '';
    const y = R[rovina].y;
    $('rezSvg').innerHTML = V.rezSvg(roz, y, { oznacit: vybranaDrazka, rovina: R[rovina] });
    $('detailSvg').innerHTML = V.detailSvg(roz, vybranaDrazka);
    if (roz.rezim === 'merka') { $('popisRezu').textContent = 'Pohled shora. Dole přední hrana: konec vodiče na doraz drážky, hrana destičky ukazuje místo řezu. Otvory: holé jádro projde otvorem svého průřezu, menším ne.'; return; }
    if (roz.nastaveni) { const n = roz.nastaveni[vybranaDrazka]; $('popisRezu').textContent = `${R[rovina].nazev}: spodní čepele tvoří „V“, horní „Λ“ (zepředu přes sebe, ve dvou rovinách za sebou). Vpravo kosočtverec pro ${n.nazev}: vepsaná kružnice ⌀ ${J.fmt(2 * n.r)} mm, šroub ${n.otacky === null ? '–' : J.fmt(n.otacky, 2) + ' otáčky'} od dosednutí čelistí.`; return; }
    const a = J.rozborDrazky(roz, vybranaDrazka);
    $('popisRezu').textContent = a.cH !== undefined
      ? `${R[rovina].nazev} (y = ${J.fmt(y)} mm), pohled zepředu. Vpravo detail drážky ${vybranaDrazka + 1}: spodní ostří zajede o ${J.fmt(a.c)} mm, horní o ${J.fmt(a.cH)} mm, do jádra zbývá nejméně ${J.fmt(a.zbytek)} mm. Červené čárkované = ostří, modrá = dosednutí čelistí.`
      : `${R[rovina].nazev} (y = ${J.fmt(y)} mm), pohled zepředu. Vpravo detail drážky ${vybranaDrazka + 1}: ostří zajede o c = ${J.fmt(a.c)} mm (${J.fmt(a.podil * 100, 0)} % izolace), do jádra zbývá ${J.fmt(a.zbytek)} mm. Červená čárkovaná = výška ostří.`;
  }

  function ukazPostup() {
    if (!roz) return;
    const p = norm.p, kusy = roz.souhrn.kusy, kroky = [], rezim = app.p.rezim;
    const ol = () => { $('postup').innerHTML = '<ol>' + kroky.map(k => `<li>${k}</li>`).join('') + '</ol>'; };
    const tiskNaBoku = () => kroky.push(`Vytiskněte STL tak, jak je uložené – <b>na boku</b> (profil na podložce), bez podpěr, z ${esc(p.materialListu)}. Pružný oblouk leží v rovině podložky a vrstvy jdou podél něj. Aspoň 3 perimetry, oblouk plný.`);
    if (J.VK.includes(rezim)) {
      const S2 = roz.souhrn;
      tiskNaBoku();
      kroky.push(`Ulomte <b>4 kusy</b> čepele po ${kusy[0].clanku} ${kusy[0].clanku === 1 ? 'článku' : 'článcích'} (ostří ${J.fmt(kusy[0].P)} mm). Lámejte kleštěmi, nikdy prsty.`);
      kroky.push('Do každé čelisti patří dva kusy ve dvou štěrbinách za sebou. Kus se zasouvá zvenku (z boku nebo zespodu/shora, kudy štěrbina vychází) <b>špičkou napřed</b>, až se opře o šikmý konec u zářezu. Jde jen jednou stranou – když nejde, otočte ho. Zajistěte kouskem filamentu 1,75 mm zastrčeným <b>zepředu do vodorovného otvoru</b> za koncem kusu.');
      kroky.push(`Do šestihranné kapsy zespodu vložte matici M${J.fmt(S2.sroub.d)}, zašroubujte šroub M${J.fmt(S2.sroub.d)} × ${S2.sroub.delka} tak, aby špička byla zarovnaná s plochou čelisti (čelisti dosednou) – to je nula.`);
      kroky.push('Pro vybraný vodič vyšroubujte šroub o počet otáček z tabulky (zespodu, po směru hodin = ven). Kosočtverec ostří se tím zvětší.');
      kroky.push(`Vodič zasuňte zepředu do zářezu${S2.yDoraz ? ' až na doraz (' + J.fmt(S2.delkaOdiz) + ' mm)' : ''}, stiskněte až na šroub a vodič vytáhněte – čtyři řezy izolaci utrhnou.`);
      kroky.push('Když je jádro poškrábané, šroub o 1/8 otáčky vyšroubujte; když izolace drží, zašroubujte. Skutečnou nulu ověřte na odřezku – tabulka vychází z modelu oblouku.');
      return ol();
    }
    if (rezim === 'podelny') {
      tiskNaBoku();
      kroky.push(`Ulomte kus čepele o <b>${kusy[0].clanku} ${kusy[0].clanku === 1 ? 'článku' : 'článcích'}</b>. Štěrbina je šikmá (${J.fmt(norm.p.sklonCepele)}°): kus zasuňte zespodu/z boku <b>ostrým rohem napřed a ostřím nahoru</b>, až se špička opře o konec kapsy a vykoukne nad dno drážky o ${J.fmt(roz.rezy[0].c)} mm. Jde jen jednou stranou – když nejde, otočte ho. Zajistěte kouskem filamentu 1,75 mm zastrčeným <b>zepředu do vodorovného otvoru</b> za koncem kusu.`);
      kroky.push('Čelisti rozevřete a kabel vložte z boku napříč do drážky – kabel se nemusí přerušit.');
      kroky.push('Stiskněte, až čelisti dosednou – špička se zapíchne do pláště. Objímku posouvejte po kabelu <b>ve směru šipky</b> na horní čelisti (nebo kabel táhněte proti šipce). Ostří tak najíždí na plášť a špička ho podélně rozpárá.');
      kroky.push(`Plášť od řezu rozevřete a odstřihněte. Když řez nestačí, zvětšete hloubku řezu nebo korekci (nyní ${J.fmt(p.korekce)} mm).`);
      return ol();
    }
    if (rezim === 'merka') {
      kroky.push('Vytiskněte naplocho (číslice nahoře), bez podpěr. Otvory se tisknou o desetiny menší – korekce otvorů to vyrovnává; ověřte ji vrtákem nebo kalibrem známého průměru.');
      kroky.push('Určení průřezu: holé jádro zkoušejte od nejmenšího otvoru – průřez je číslo u prvního otvoru, kterým projde. Lanko nejdřív zakruťte. Je to orientační kontrola, ne měření.');
      kroky.push('Odměření délky: neodizolovaný vodič vložte do drážky koncem na doraz. Přední hrana destičky ukazuje, kde izolaci naříznout (např. hřebínkem nebo nožem).');
      if (norm.p.pravitko > 0) kroky.push('Pravítko u zadní hrany: rysky po 1 mm, delší po 5 a 10 mm.');
      return ol();
    }
    if (rezim === 'sesivacka') {
      kroky.push(`Vytiskněte STL tak, jak je uložené – <b>na boku</b> (profil na podložce), bez podpěr, z ${esc(p.materialListu)}. Pružný oblouk pak leží celý v rovině podložky – tiskne se bez podpěr a vrstvy jdou podél něj, takže vydrží. Aspoň 3 perimetry, oblouk tiskněte plný.`);
      kroky.push(`Zkontrolujte obě štěrbiny (šířka ${J.fmt(p.cepelT + p.vuleStrbiny)} mm). Je-li některá zalitá, protáhněte ji kouskem staré čepele.`);
      kusy.forEach(k => kroky.push(`Ulomte ${esc(k.nazev)} o <b>${k.clanku} ${k.clanku === 1 ? 'článku' : 'článcích'}</b> (ostří ${J.fmt(k.P)} mm). Lámejte kleštěmi, nikdy prsty.`));
      kroky.push('Spodní čepel zasuňte z boku ostřím nahoru, horní ostřím dolů, obě až na doraz. Zadní konec kapsy je šikmý podle lomové rýhy – kus jde zasunout jen jednou stranou (když nejde, otočte ho). Do svislých otvorů u boku zastrčte kousky filamentu 1,75 mm: kus se pak opírá o šikmý konec a kolík a nevypadne ani z horní čelisti.');
      kroky.push(`Vodiče zasuňte zepředu do svých drážek až na doraz (${roz.souhrn.yDoraz !== null ? J.fmt(roz.souhrn.delkaOdiz) + ' mm' : 'bez dorazu'}). Najednou jich může být i víc.`);
      kroky.push('Stiskněte čelisti až dosednou na sebe – to je doraz, víc tlačit není potřeba. Ostří se zakousnou do izolace shora i zespodu.');
      kroky.push('Se sevřenými čelistmi vodiče vytáhněte dopředu. Izolace se utrhne po obvodu a zůstane v čelistech; po povolení ji vyklepněte.');
      kroky.push(`Když izolace nejde stáhnout, zvětšete hloubku řezu nebo korekci (nyní ${J.fmt(p.korekce)} mm); když je jádro poškrábané, zmenšete ji.`);
      return ol();
    }
    kroky.push(`Vytiskněte STL spodní plochou na podložce, bez podpěr, s výškou vrstvy 0,2 mm nebo menší. Vhodný je PETG nebo PLA a aspoň 3 perimetry.`);
    kroky.push(`Zkontrolujte štěrbinu: šířka ${J.fmt(p.cepelT + p.vuleStrbiny)} mm, výška ${J.fmt(roz.strbiny[0].z1 - roz.z0)} mm. Je-li zalitá, protáhněte ji kouskem staré čepele.`);
    kusy.forEach(k => kroky.push(`Ulomte kus čepele (${esc(k.nazev)}) o <b>${k.clanku} ${k.clanku === 1 ? 'článku' : 'článcích'}</b> (ostří ${J.fmt(k.P)} mm). Lámejte kleštěmi nebo v drážce nože, nikdy prsty.`));
    if (rezim === 'hrebinek') kroky.push('Zasuňte čepel ostřím nahoru z levého boku až na doraz. Do svislého otvoru u boku zastrčte kousek filamentu 1,75 mm a zarovnejte ho.');
    else if (rezim === 'kulaty') kroky.push('Příčnou čepel zasuňte ostřím nahoru z levého boku, podélnou ze zadní stěny, obě až na doraz. Obě zajistěte kouskem filamentu 1,75 mm ve svislém otvoru.');
    else kroky.push('Čepel zasuňte ostřím nahoru ze zadní stěny až na doraz a zajistěte kouskem filamentu 1,75 mm ve svislém otvoru.');
    if (rezim === 'hrebinek') {
      kroky.push(`Vodič vložte zepředu do drážky svého průřezu${roz.souhrn.yDoraz !== null ? ' až na doraz' : ' na potřebnou délku'}. Palcem ho přitlačte ke dnu a protočte o 360° (raději 2×).`);
      kroky.push(`Vodič vytáhněte dopředu. Odříznutá izolace (${roz.souhrn.yDoraz !== null ? J.fmt(roz.souhrn.delkaOdiz) + ' mm' : 'za čepelí'}) zůstane v drážce, odkud ji vyklepněte.`);
    } else if (rezim === 'kulaty') {
      kroky.push('Kruhový řez: kabel vložte do levé drážky tak, aby rovina příčné čepele byla v místě řezu. Přitlačte ho dlaní ke dnu a jednou až dvakrát ho protočte.');
      kroky.push('Podélný řez: kabel vložte do pravé drážky kruhovým řezem k přední hraně čepele, přitlačte a protáhněte směrem ke konci kabelu.');
      kroky.push('Plášť rozevřete a stáhněte. Pod pláštěm CYKY je výplňový obal, který chrání žíly před ostřím.');
    } else {
      kroky.push('Plochý kabel vložte naplocho do drážky, přitlačte ke dnu a protáhněte. Plášť se podélně nařízne nad žílou.');
      kroky.push('Plášť od řezu rozevřete a stáhněte. Kraje pláště se pak dají odstřihnout.');
    }
    kroky.push(`Když řez nestačí nebo zasahuje do jádra, změňte <b>korekci výšky ostří</b> (nyní ${J.fmt(p.korekce)} mm) po 0,05–0,1 mm a vytiskněte znovu.`);
    ol();
  }

  /* ---------- export ---------- */
  function nazevSouboru() {
    if (app.p.nazev) return app.jmeno('');
    const p = norm.p, r = app.p.rezim;
    let t;
    if (r === 'hrebinek') t = `stahovak_hrebinek_${p.vodice.length}drazek_cepel${J.fmt(p.cepelW)}`;
    else if (r === 'sesivacka') t = `stahovak_sesivacka_${p.vodice.length}drazek_cepel${J.fmt(p.cepelW)}`;
    else if (r === 'vkleste') t = `kleste_v_zarez_alfa${J.fmt(p.uhelV)}`;
    else if (r === 'jemne') t = `jemny_odizolovac_alfa${J.fmt(p.uhelV)}`;
    else if (r === 'podelny') t = `objimka_podelny_rez_kabel${J.fmt(p.kabelD)}_${p.provedeni}`;
    else if (r === 'merka') t = `merka_${p.druhJadra}`;
    else if (r === 'kulaty') t = `odplastovac_kabel${J.fmt(p.kabelD)}_plast${J.fmt(p.kabelT)}`;
    else t = `odplastovac_plochy_${J.fmt(p.plochyS)}x${J.fmt(p.plochyH)}`;
    return t.replace(/,/g, '_');
  }
  /* Nástroje s obloukem se tisknou na boku: (x, y, z) → (y, z, x) – bok x = 0 s otvory štěrbin leží na podložce. */
  function sitKTisku() {
    if (!roz || !roz.kloub) return sit;
    const poz = new Float64Array(sit.poz.length);
    for (let i = 0; i < poz.length; i += 3) { poz[i] = sit.poz[i + 1]; poz[i + 1] = sit.poz[i + 2]; poz[i + 2] = sit.poz[i]; }
    return { poz, idx: sit.idx };
  }
  const dilTisku = () => Object.assign({ nazev: J.REZIMY[app.p.rezim].nazev, jmeno: app.p.rezim, barva: '#e0a040' }, sitKTisku());
  function lzeExport() {
    if (!sit || !roz) { Dialog.chyba(chybaStavby || (norm && norm.chyby.length ? 'Opravte parametry označené červeně.' : 'Výpočetní jádro se ještě načítá.')); return false; }
    const k = J.zkontrolujSit(sit);
    if (!k.vodotesna || !(k.objem > 0)) { Dialog.chyba('Síť není uzavřená – export se nepovedl. Zkuste změnit parametry.'); return false; }
    return true;
  }
  function exportStl() { if (lzeExport()) app.stahni(J.stlBinarni(sitKTisku(), nazevSouboru()), nazevSouboru() + '.stl', 'model/stl'); }
  function export3mf() { if (lzeExport()) app.stahni(KRAB.soubor3mf([dilTisku()], app.p.nazev || J.REZIMY[app.p.rezim].nazev), nazevSouboru() + '.3mf', 'model/3mf'); }
  function exportSvg() {
    if (!roz) return;
    const R = V.roviny(roz), svg = V.rezSvg(roz, R[rovina].y, { rovina: R[rovina] });
    const styl = `<style>.teleso{fill:#e7b25c;fill-opacity:.55;stroke:#222;stroke-width:.12}.srafa{stroke:#222;stroke-width:.12;opacity:.35}.vyrez{fill:#fff}.teleso.bez{stroke:none}.obrys{fill:none;stroke:#222;stroke-width:.14}.cepel{fill:#9aa0a8;stroke:#222;stroke-width:.08}.cepel.za{fill-opacity:.6;stroke-dasharray:.5 .3}.strbina{fill:none;stroke:#222;stroke-width:.06;stroke-dasharray:.4 .3}.kolik{fill:#7fbf6a}.izolace{fill:#3b7fd9;fill-opacity:.55;stroke:#3b7fd9;stroke-width:.06}.jadro,.jadro-pl{fill:#d08a3c}.ostri{stroke:#d0201a;stroke-width:.1;stroke-dasharray:.6 .4}.popis{fill:#555;font-family:sans-serif}</style>`;
    app.stahni(svg.replace('>', '>' + styl), nazevSouboru() + '_rez.svg', 'image/svg+xml');
  }

  /* ---------- události ---------- */
  function nastavRezim(r) {
    if (!J.REZIMY[r] || r === app.p.rezim) return;
    app.zmen(q => { q.rezim = r; });
    app.naplnFormular();
  }
  $('rezimy').addEventListener('click', e => { const b = e.target.closest('button[data-rezim]'); if (b) nastavRezim(b.dataset.rezim); });
  for (const r of Object.keys(J.REZIMY)) {
    const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
    b.innerHTML = `${J.REZIMY[r].nazev}<span class="pozn">${J.REZIMY[r].kratce}</span>`;
    b.addEventListener('click', () => nastavRezim(r));
    $('seznamPredvoleb').appendChild(b);
  }
  // vodiče
  const zmenVodice = f => { app.zmen(q => f(q.hodnoty[q.rezim].vodice)); app.naplnFormular(); };
  $('tabVodice').addEventListener('click', e => { const b = e.target.closest('button[data-smaz]'); if (b) zmenVodice(v => v.splice(+b.dataset.smaz, 1)); });
  $('pridejVodic').innerHTML = '<option value="">+ přidat vodič z předvoleb…</option>' + J.VODICE.concat(J.VODICE_JEMNE).map(v => `<option value="${v.id}">${esc(v.nazev)} – ⌀ ${J.fmt(v.D)}, izolace ${J.fmt(v.t)}</option>`).join('');
  $('pridejVodic').addEventListener('change', e => {
    const v = J.VODICE.concat(J.VODICE_JEMNE).find(x => x.id === e.target.value); e.target.value = '';
    if (!v) return;
    if (H().vodice.length >= 16) { Dialog.info('Nejvýš 16 drážek.'); return; }
    zmenVodice(s => s.push({ nazev: v.nazev, D: v.D, t: v.t, d: v.d }));
  });
  $('btnVlastniVodic').addEventListener('click', () => {
    if (H().vodice.length >= 16) { Dialog.info('Nejvýš 16 drážek.'); return; }
    zmenVodice(s => s.push({ nazev: 'vlastní', D: 3, t: 0.7, d: 1.6 }));
  });
  $('btnRadit').addEventListener('click', () => zmenVodice(s => s.sort((a, b) => J.cislo(String(a.D)) - J.cislo(String(b.D)))));
  // 3D
  app.prepinac('tCepele', h => S.nastavVolby({ cepele: h }));
  app.prepinac('tVodice', h => S.nastavVolby({ vodice: h }));
  app.prepinac('tPruhledne', h => S.nastavVolby({ pruhledne: h }));
  app.prepinac('tRez', h => S.nastavVolby({ rez: h }));
  app.prepinac('tHrany', h => S.nastavVolby({ hrany: h }), true);
  app.prepinac('tPravitka', h => S.nastavVolby({ pravitka: h }), true);
  app.prepinac('tPrevisy', h => { previsy = h; if (tisk) zobrazModel(true); }, true);
  app.prepinac('tTisk', h => { tisk = h; if (h) zastavAnimaci(); $('blokStisk').classList.toggle('skryto', h); zobrazModel(false); });
  // stisk sešívačky a kleští
  $('stisk').addEventListener('input', e => { zastavAnimaci(); $('stiskHodnota').textContent = e.target.value + ' %'; S.nastavStisk(e.target.value / 100); });
  $('btnStisk').addEventListener('click', () => {
    if (animace) { zastavAnimaci(); return; }
    $('btnStisk').setAttribute('aria-pressed', 'true'); $('btnStisk').textContent = '⏸ Zastavit';
    const t0 = performance.now();
    const krok = t => {
      const s = (1 - Math.cos((t - t0) / 1600 * Math.PI)) / 2;          // tam a zpět
      $('stisk').value = Math.round(s * 100); $('stiskHodnota').textContent = Math.round(s * 100) + ' %';
      S.nastavStisk(s);
      animace = requestAnimationFrame(krok);
    };
    animace = requestAnimationFrame(krok);
  });
  // řezy
  $('zalozkyRez').addEventListener('click', e => { const b = e.target.closest('[data-rovina]'); if (!b) return; rovina = +b.dataset.rovina; ukazRezy(); });
  $('tabRezy').addEventListener('click', e => { const tr = e.target.closest('tr[data-j]'); if (!tr) return; vybranaDrazka = +tr.dataset.j; ukazVysledky(); ukazRezy(); });
  // export
  $('btnStl').addEventListener('click', exportStl);
  $('btn3mf').addEventListener('click', export3mf);
  $('btnSvg').addEventListener('click', exportSvg);

  function zastavAnimaci() {
    if (animace) cancelAnimationFrame(animace);
    animace = 0; $('btnStisk').setAttribute('aria-pressed', 'false'); $('btnStisk').textContent = '▶ Stisknout';
  }

  /* ---------- start ---------- */
  TrubkyGui.pripoj({ klic: 'webapp_odizolovac_gui', pohled: j => S.pohled(j) });
  try { S.init($('platno3d')); } catch (e) { zprava3d('WebGL není k dispozici – 3D náhled nejde zobrazit (výkres řezu a export fungují).'); }
  app.start({
    manifold: {
      ok: m => { w = m; prestav(true); },
      chyba: e => { chybaJadra = e; prestav(); },
    },
  });
  window.ODIZ_APP = {
    sitKTisku: () => sitKTisku(), stav: () => app.p, norm: () => norm, roz: () => roz, sit: () => sit, pripraveno: () => !!w && !!telo, chyba: () => chybaJadra, prestav, app,
    nastavNavrh(d) { if (!d || !J.REZIMY[d.rezim]) throw new Error('soubor neobsahuje návrh stahováku'); app.nahrad(J.normalizujStav(d).p); },
  };
})();

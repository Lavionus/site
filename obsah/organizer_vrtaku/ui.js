/* Organizér vrtáků a bitů – ovládání stránky nad společným zapojením gen3d/aplikace.js
   (tady jen to, co je pro organizér zvláštní: druhy dílu, sady, viditelnost polí, souhrny, výsledky, tabulka otvorů,
   tisk a výměna filamentu, kusovník, režimy náhledu, barevný export 3MF, kalibrační vzorek). Náhled = KNOF_NAHLED. */
/* global ORGV, KLIC, KNOF_NAHLED, KRAB, FONTY, G3D, Dialog, TrubkyGui */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const K = ORGV, fmt = K.fmt;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  let p, o, wasm = null, font = null, model = null, chybaStavby = '', chybaJadra = '', chybaPisma = '';
  const stavZobr = { rezim: 'sestava' };
  const nahled = KNOF_NAHLED.vytvorNahled($('platno'), { drzPohled: true });

  const app = G3D.aplikace({
    typ: 'organizer_vrtaku', nazev: 'Organizér vrtáků', klic: 'webapp_organizer_vrtaku', soubor: 'organizer_vrtaku', diry: true,
    normalizuj: K.normalizuj, vychozi: () => K.predvolba('kov10'),
    ulozProjekt: K.ulozProjekt, nactiProjekt: K.nactiProjekt, popis: K.popis,
    viditelnost: () => viditelnost(),
    prepocitej: () => prepocitej(),
    png: () => nahled.png(), pohled: j => nahled.pohled(j),
    exportStl: () => exportVse('stl'),
    nahodny: () => nahodny(),
    doModelare: () => (lzeExport() ? { data: KRAB.soubor3mf(tiskDily(), app.p.nazev || 'Organizér'), pripona: '.3mf' } : null),
    zkratky: { r: 'tRez', h: 'tHrany', m: 'tTisk', p: 'tPrevisy', l: 'tPravitka' },
    zmenaTematu: () => prepocitej(),
  });

  /* ---------- výběry ---------- */
  $('f_sada').innerHTML = Object.entries(K.SADY).map(([k, s]) => `<option value="${k}">${esc(s.nazev)}</option>`).join('');
  $('f_bdr').innerHTML = Object.entries(K.BITY).map(([k, s]) => `<option value="${k}">${esc(s.nazev)}</option>`).join('');
  $('f_ucl').innerHTML = Object.entries(K.CLEATY).map(([k, s]) => `<option value="${k}">${esc(s.nazev)}</option>`).join('');
  $('f_material').innerHTML = Object.entries(K.MATERIALY).map(([k, m]) => `<option value="${k}">${m.nazev}</option>`).join('');
  document.querySelectorAll('#paletaDruhu button').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.druh === app.p.druh) return;
    app.nahrad(K.prepniDruh(app.p, b.dataset.druh));
    nahled.pohled('iso');
  }));
  $('btnDoSeznamu').addEventListener('click', () => {
    const s = K.polozkySady(app.p).polozky;
    const t = s.map(x => (x.popis === fmt(x.d, 2) ? fmt(x.d, 2) : `${fmt(x.d, 2)}:${x.popis}`)).join(' ');
    app.zmen(q => { q.sada.id = 'vlastni'; q.sada.seznam = t; });
    app.naplnFormular();
  });

  /* ---------- viditelnost a popisy ---------- */
  const seznam = a => (a || '').split(/\s+/).filter(Boolean);
  /** data-kdyz="cesta:hodnoty;cesta!hodnoty" – všechny podmínky musí platit. */
  function plati(podm) {
    return podm.split(';').every(c => {
      const ne = c.includes('!'), [cesta, hod] = c.split(ne ? '!' : ':');
      return seznam(hod).includes(String(K.vezmi(p, cesta.trim()))) !== ne;
    });
  }
  function viditelnost() {
    p = app.p;
    document.querySelectorAll('#paletaDruhu button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.druh === p.druh)));
    document.querySelectorAll('[data-kdyz]').forEach(el => { el.hidden = !plati(el.dataset.kdyz); });
    const S = K.SADY[p.sada.id];
    $('poznSada').innerHTML = `${esc(S.pozn)}.${p.sada.id === 'vlastni' ? '' : ` Délky a stopky jsou <b>${esc(K.POZNAMKA)}</b> (${esc(K.DATUM)}).`}`;
    $('btnDoSeznamu').hidden = p.sada.id === 'vlastni';
    $('lRelief').textContent = p.popisky.rezim === 'vystouply' ? 'Výška reliéfu' : 'Hloubka';
    $('napPopisky').textContent = {
      vystouply: 'Text vystupuje nad plochu jako zvláštní díl – v 3MF má vlastní barvu. Jedna tryska: výměna filamentu ve výšce z záložky Tisk.',
      vyrazeny: 'Text je vyražený do plochy – tiskne se jednou barvou, je dobře čitelný i bez barvy (stín v drážce).',
      vlozeny: 'Text je vyražený a vyplněný druhým dílem v rovině s plochou – hladký povrch, dvě barvy.',
    }[p.popisky.rezim];
    const typ = K.BITY[p.bity.druh];
    $('napBity').textContent = typ.tvar === 'kolik'
      ? `Čtyřhranné kolíky ¼″ (${fmt(typ.ctyrhran, 2)} mm minus vůle) se sraženým koncem – ořech se nasadí shora. Rozteč podle největšího ořechu.`
      : `Šestihranný otvor ${fmt(p.bity.af > 0 ? p.bity.af : typ.af, 2)} mm přes plochy + vůle, plocha šestihranu míří dopředu.${p.bity.magnet ? ' Magnet se vloží zespodu do kapsy (kapka lepidla), nad ním zůstanou 2 vrstvy – strop se přemostí.' : ''}`;
    const u = p.upevneni.typ;
    $('napUpevneni').textContent = {
      zadne: 'Díl stojí volně na stole nebo v zásuvce.',
      gridfinity: 'Půdorys se zvětší na celé buňky 42 mm, obsah se vystředí. Podstava podle referenční implementace Gridfinity (bez magnetů a stohovacího lemu).',
      zed: 'Deska za dílem se dvěma dírami pro šrouby (kapka – tisk bez podpor). Díl visí jako polička, otvory zůstávají svislé.',
      cleat: 'Zámek za deskou zapadne za úkos nástěnné lišty French cleat; dole je opěrka stejné tloušťky, aby díl visel svisle.',
    }[u];
  }

  /* ---------- přepočet ---------- */
  function prepocitej() {
    p = app.p; o = K.odvozene(p, font);
    nahled.barvy(css('--border-strong'), css('--border'), css('--text'));
    let H = K.kontroly(p, font);
    model = null; chybaStavby = chybaJadra;
    if (wasm && !o.chyba && !H.some(x => x.uroven === 'chyba')) {
      try {
        model = K.postav(wasm, p, font, { kalibrace: stavZobr.rezim === 'kalibrace' });
        o = model.o;
        H = H.concat(K.kontrolyModelu(p, model));
      } catch (e) { chybaStavby = 'Model nelze sestavit: ' + (e && e.message || e); }
    } else if (wasm && !chybaStavby) chybaStavby = 'Model nelze sestavit – opravte chybu v záložce Kontrola.';
    if (p.popisky.zap && !font) H.push({ uroven: 'info', pole: 'popisky.zap', text: chybaPisma || 'Písmo se načítá – popisky se doplní.' });
    const st = $('stav3d');
    st.textContent = wasm || chybaJadra ? chybaStavby : 'Načítám geometrické jádro…';
    st.classList.toggle('chyba', !!chybaStavby);
    zobraz(false);
    app.hlaseni(H, { chybaStavby, boxy: ['boxDruh', 'boxPopisky'] });
    vypisVysledky();
    vypisOtvory();
    souhrny();
    naplnExporty();
  }
  const box = (a, b, c, d) => G3D.dlazdice(a, b, c, d);
  const mat = () => K.MATERIALY[p.tisk.material];
  const dilu = n => (n === 1 ? '1 díl' : n < 5 ? n + ' díly' : n + ' dílů');
  const vsechnyDily = () => model.kusy.flatMap(x => x.dily);
  function vypisVysledky() {
    const el = $('vVysledky'), karta = $('karta3d');
    if (!model) { el.innerHTML = box('Model', wasm || chybaJadra ? 'nelze sestavit' : 'načítám…', chybaStavby); karta.innerHTML = ''; $('vSit').innerHTML = ''; $('kusovnik').innerHTML = ''; $('vTisk').innerHTML = ''; return; }
    const M = mat(), dily = vsechnyDily();
    const V = dily.reduce((s, d) => s + d.objem, 0) * p.tisk.sad;
    const od = G3D.odhadTisku(V, M.hustota, { dilu: model.kusy.length * p.tisk.sad });
    const nOt = o.otvory.length, co = p.druh === 'bity' ? (o.kolik ? 'kolíků' : 'otvorů') : p.druh === 'kazeta' ? 'korýtek' : 'otvorů';
    let h = box('Rozměry', `${fmt(o.W, 0)} × ${fmt(o.Dcelk, 0)} × ${fmt(o.Hcelk, 0)} mm`, `š × h × v${o.gf ? ` · Gridfinity ${o.gfN} × ${o.gfM}` : ''}`);
    h += box('Kapacita', `${nOt} ${co}`, p.druh === 'bity' ? `${K.BITY[p.bity.druh].nazev}` : `${K.SADY[p.sada.id].nazev}`);
    h += box('Rozsah', rozsah(), p.druh === 'stojanek' ? `${o.rady.length} ${o.rady.length === 1 ? 'řada' : o.rady.length < 5 ? 'řady' : 'řad'} · popisky ${o.svisle ? 'nastojato' : 'vodorovně'}` : p.druh === 'kazeta' ? K.NAZVY.uchyt[p.kazeta.uchyt] : '');
    h += box('Nejtenčí stěna', Number.isFinite(o.steny.min) ? `${fmt(o.steny.min, 2)} mm` : '–', `mezi ${o.steny.kde ? o.steny.kde.join(' a ') : '–'} · min. 2 extruze ${fmt(2 * p.tisk.extruze, 2)}`, o.steny.min >= 2 * p.tisk.extruze - 1e-6 ? 'ok-t' : 'mez-t');
    h += box('Hmotnost', `${fmt(od.g, od.g < 10 ? 1 : 0)} g`, p.tisk.sad > 1 ? `${M.nazev}, plné díly, ${p.tisk.sad} sady` : `${M.nazev}, plné díly (při 20 % výplni zhruba ${fmt(od.g * 0.55, 0)} g)`);
    h += box('Filament', `${fmt(od.metru, 1)} m`, `průměr 1,75 mm · ${fmt(V / 1000, 1)} cm³`);
    h += box('Doba tisku', `≈ ${od.minut < 60 ? od.minut + ' min' : fmt(od.minut / 60, 1) + ' h'}`, `${dilu(model.kusy.length * p.tisk.sad)} · hrubý odhad`);
    el.innerHTML = h;
    // kusovník
    const navic = [];
    if (p.druh === 'bity' && p.bity.magnet && !o.kolik) navic.push(`Magnet Ø ${fmt(p.bity.magnetD, 1)} × ${fmt(p.bity.magnetH, 1)} mm (neodym) – ${o.otvory.length * p.tisk.sad} ks, zalepit zespodu`);
    if (o.deska && o.deska.srouby) navic.push(`Vrut / šroub do Ø ${fmt(p.upevneni.sroub - 0.5, 1)} mm s podložkou – ${o.deska.srouby.length * p.tisk.sad} ks + hmoždinky`);
    if (o.deska && o.deska.zamek) navic.push(`Nástěnná lišta French cleat: ${K.CLEATY[p.upevneni.cleat].nazev}`);
    $('kusovnik').innerHTML = `<table class="tabulka"><thead><tr><th>Díl</th><th class="c">Kusů</th><th class="c">Rozměr</th><th class="c">Objem</th><th>Barva</th></tr></thead><tbody>`
      + dily.map(d => { const q = G3D.obal(d.poz); return `<tr><td>${esc(d.nazev)}</td><td class="c">${p.tisk.sad}</td><td class="c">${fmt(q[3] - q[0], 1)} × ${fmt(q[4] - q[1], 1)} × ${fmt(q[5] - q[2], 1)}</td><td class="c">${fmt(d.objem / 1000, 2)} cm³</td><td>${d.role === 'text' ? 'popisky' : 'tělo'}</td></tr>`; }).join('')
      + navic.map(t => `<tr><td colspan="5">+ ${esc(t)}</td></tr>`).join('') + '</tbody></table>';
    const titul = { sestava: K.NAZVY.druh[p.druh], tisk: 'Díly k tisku', kalibrace: 'Kalibrační vzorek' }[stavZobr.rezim];
    karta.innerHTML = `<div class="titul">${esc(titul)}</div><b>${fmt(o.W, 0)} × ${fmt(o.Dcelk, 0)} × ${fmt(o.Hcelk, 0)}</b> mm<br>${nOt} ${co} · ${esc(rozsah())}<br><b>${fmt(od.g, 0)}</b> g ${M.nazev}`;
    $('vSit').innerHTML = dily.concat(p.kalibrace.zap ? [] : model.kalibrace).map(d => {
      const k = KRAB.kontrolaSite(d.poz, d.idx), ok = k.uzavrena && (d.role === 'text' || d.teles === 1);
      return box('Síť – ' + d.nazev, ok ? '✔ těsná' : '✖ netěsná', `${k.trojuhelniku} trojúhelníků, ${d.teles} ${d.teles === 1 ? 'těleso' : d.teles < 5 ? 'tělesa' : 'těles'}`, ok ? 'ok-t' : 'chyba-t');
    }).join('') + box('Stavba', `${model.cas} ms`, 'manifold-3d');
    // tisk: výměna filamentu
    const z = K.vyskyTextu(p, o);
    const vrstva = zz => Math.round(zz / p.tisk.vrstva);
    $('vTisk').innerHTML = !z.length ? box('Barvy', 'jedna barva', p.popisky.zap ? 'popisky vyražené' : 'bez popisků')
      : box('Výměna filamentu', z.length === 1 ? `ve výšce ${fmt(z[0], 2)} mm` : `${z.length} výšky`, z.length === 1 ? `začátek ${vrstva(z[0]) + 1}. vrstvy (M600 / pauza) · jedna tryska` : `${z.map(x => fmt(x, 1)).join(', ')} mm – schody: lépe vícebarevná tiskárna, nebo vyražené popisky`, z.length === 1 ? 'ok-t' : 'mez-t');
    $('napTisk').innerHTML = `Všechny díly se tisknou <b>spodkem dolů bez podpor</b>${o.vicko ? '; víčko naplocho širší stranou dolů' : ''}. Svislé otvory nepotřebují kapku; díry pro šrouby v desce jsou ${p.diry === 'kapka' ? 'kapka se špičkou nahoru' : 'kruhové (strop převisá)'}.`
      + ` Doporučeno PLA nebo PETG, 3 perimetry, 15–20 % výplně. Barevný 3MF otevřete v PrusaSliceru / OrcaSliceru / Bambu Studiu – tělo a popisky jsou části jednoho objektu s vlastním extruderem.`;
  }
  function rozsah() {
    const h = o.otvory;
    if (!h.length) return '–';
    if (p.druh === 'bity') return o.kolik ? `${h[0].popis}–${h[h.length - 1].popis} mm` : `${h.filter(x => x.popis).length} popisků`;
    return `${h[0].popis} až ${h[h.length - 1].popis}`;
  }
  function vypisOtvory() {
    const el = $('tabOtvory');
    if (o.chyba) { el.innerHTML = ''; $('vOtvory').innerHTML = ''; return; }
    const v = p.otvory.vule, H = o.otvory;
    const roztec = (a, b) => (b ? Math.hypot(b.x - a.x, b.y - a.y) : NaN);
    let rows;
    if (p.druh === 'stojanek') {
      rows = '<tr><th>Popisek</th><th class="c">Ø</th><th class="c">Otvor</th><th class="c">Hloubka</th><th class="c">Délka</th><th class="c">Schod</th><th class="c">Rozteč</th></tr>'
        + H.map((h, i) => { const dalsi = H[i + 1] && H[i + 1].rada === h.rada ? H[i + 1] : null;
          return `<tr><td>${esc(h.popis)}</td><td class="c">${fmt(h.d, 2)}${h.D > h.d ? ` / ${fmt(h.D, 0)}` : ''}</td><td class="c">${fmt(2 * h.r, 2)}</td><td class="c">${fmt(h.hl, 1)}</td><td class="c">${h.L}</td><td class="c">${h.rada + 1} · ${fmt(h.zTop, 1)}</td><td class="c">${dalsi ? fmt(roztec(h, dalsi), 1) : '–'}</td></tr>`; }).join('');
      $('napOtvory').textContent = `Otvor = Ø + 2 × vůle ${fmt(v, 2)} mm, sražení ${fmt(p.otvory.zkoseni, 1)} mm. Hloubka ${p.stojanek.hloubka === 'delka' ? `${fmt(p.stojanek.podil, 0)} % délky vrtáku (DIN 338, ${K.POZNAMKA})` : 'pevná'}. Schod = číslo řady a výška horní plochy.`;
    } else if (p.druh === 'kazeta') {
      rows = '<tr><th>Popisek</th><th class="c">Ø</th><th class="c">Korýtko</th><th class="c">Délka</th><th class="c">Hloubka</th><th class="c">Rozteč</th></tr>'
        + o.korytka.map((q, i) => `<tr><td>${esc(H[i].popis)}</td><td class="c">${fmt(H[i].D, 2)}</td><td class="c">${fmt(2 * q.r, 2)}${p.kazeta.uchyt === 'klip' ? ` / ${fmt(2 * q.a, 2)}` : ''}</td><td class="c">${fmt(q.delka, 0)}</td><td class="c">${fmt(H[i].hl, 1)}</td><td class="c">${o.korytka[i + 1] ? fmt(o.korytka[i + 1].y - q.y, 1) : '–'}</td></tr>`).join('');
      $('napOtvory').textContent = p.kazeta.uchyt === 'klip' ? 'Korýtko = Ø + 2 × vůle / otvor klipu. Vrták se zatlačí shora, klip ho drží.' : 'Korýtko = půlkruh Ø + 2 × vůle; vrták v něm leží do poloviny.';
    } else {
      rows = '<tr><th>#</th><th>Popisek</th><th class="c">Rozměr</th><th class="c">Hloubka</th><th class="c">Poloha x, y</th></tr>'
        + H.map((h, i) => `<tr><td>${i + 1}</td><td>${esc(h.popis || '–')}</td><td class="c">${o.kolik ? `□ ${fmt(o.kolik.a, 2)} / Ø ${fmt(2 * h.ro, 1)}` : `⬡ ${fmt(o.hex.afo, 2)}`}</td><td class="c">${o.kolik ? `kolík ${fmt(o.kolik.h, 0)}` : fmt(h.hl, 1)}</td><td class="c">${fmt(h.x, 1)}, ${fmt(h.y, 1)}</td></tr>`).join('');
      $('napOtvory').textContent = o.kolik ? 'Kolík = čtyřhran ¼″ minus vůle; Ø = vnější průměr ořechu pro rozteč.' : `Šestihran přes plochy = ${fmt(o.hex.af, 2)} + 2 × vůle ${fmt(v, 2)} mm; přes rohy ${fmt(2 * o.hex.Ro, 2)} mm.`;
    }
    el.innerHTML = rows;
    const mr = o.mrizka;
    $('vOtvory').innerHTML = box('Otvorů', String(H.length), mr ? `mřížka ${mr.nx} × ${mr.ny}, rozteč ${fmt(mr.px, 1)} × ${fmt(mr.py, 1)}` : p.druh === 'stojanek' ? `${o.rady.length} řad` : `${o.korytka.length} korýtek`)
      + box('Nejtenčí stěna', Number.isFinite(o.steny.min) ? `${fmt(o.steny.min, 2)} mm` : '–', `= ${fmt(o.steny.min / p.tisk.extruze, 1)} extruze ${fmt(p.tisk.extruze, 2)} mm`, o.steny.min >= 2 * p.tisk.extruze - 1e-6 ? 'ok-t' : 'mez-t')
      + (o.cap ? box('Popisky', `${fmt(o.cap, 1)} mm`, `${K.NAZVY.rezim[p.popisky.rezim]}${p.druh === 'stojanek' ? ' · ' + (o.svisle ? 'nastojato' : 'vodorovně') : ''}`) : '');
  }
  function souhrny() {
    if (o.chyba) return;
    TrubkyGui.souhrn('sSada', `${K.SADY[p.sada.id].nazev} · ${o.otvory.length} ks`, true);
    if (p.druh === 'stojanek') TrubkyGui.souhrn('sStojanek', `${o.rady.length} řad · ${p.stojanek.hloubka === 'delka' ? fmt(p.stojanek.podil, 0) + ' % délky' : fmt(p.stojanek.pevna) + ' mm'}`, true);
    TrubkyGui.souhrn('sKazeta', `${K.NAZVY.uchyt[p.kazeta.uchyt]}${p.kazeta.vicko ? ' · víčko' : ''}`, true);
    TrubkyGui.souhrn('sBity', o.kolik ? `${o.otvory.length} kolíků ¼″` : `${p.bity.nx} × ${p.bity.ny}${p.bity.magnet ? ' · magnety' : ''}`, true);
    TrubkyGui.souhrn('sOtvory', `vůle ${fmt(p.otvory.vule, 2)} · stěna ${fmt(p.otvory.stena, 1)}`, true);
    TrubkyGui.souhrn('sPopisky', p.popisky.zap ? `${K.NAZVY.rezim[p.popisky.rezim]} ${fmt(p.popisky.vyska, 1)} mm` : 'bez popisků', p.popisky.zap);
    TrubkyGui.souhrn('sUpevneni', K.NAZVY.upevneni[p.upevneni.typ], p.upevneni.typ !== 'zadne');
    const vk = K.vuleKalibrace(p);
    TrubkyGui.souhrn('sKalibrace', `${vk.length} × ${fmt(vk[0], 2)}…${fmt(vk[vk.length - 1], 2)}`, p.kalibrace.zap);
    const typ = p.druh === 'bity' ? K.BITY[p.bity.druh] : null;
    $('napKalibrace').textContent = `Lišta s ${vk.length} ${typ && typ.tvar === 'kolik' ? 'kolíky' : 'průchozími otvory'} ${typ ? (typ.tvar === 'hex' ? 'šestihran' : 'čtyřhran ¼″') : `Ø ${fmt(p.kalibrace.prumer, 1)}`} s vůlí ${vk.map(x => fmt(x, 2)).join(' · ')} mm (prostřední = nastavená, hodnoty vyražené). Vyzkoušejte a vůli nejlepšího zapište do pole Vůle.`;
  }

  /* ---------- náhled ---------- */
  function zobraz(novyPohled) {
    document.querySelectorAll('[data-rezim]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.rezim === stavZobr.rezim)));
    if (!model) { nahled.nastav(null); return; }
    const r = stavZobr.rezim;
    if (r === 'tisk') nahled.nastav(tiskDily(), { tisk: true, novyPohled, uhel: p.tisk.uhel });
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
  TrubkyGui.pripoj({ klic: 'webapp_organizer_vrtaku_gui', pohled: j => nahled.pohled(j) });
  let skupina = '';
  for (const v of K.PREDVOLBY) {
    if (v.druh !== skupina) {
      skupina = v.druh;
      const n = document.createElement('div'); n.className = 'nab-nadpis'; n.textContent = K.NAZVY.druh[v.druh];
      $('seznamPredvoleb').appendChild(n);
    }
    const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
    b.innerHTML = `${esc(v.nazev)}<span class="pozn">${esc(v.popis)}</span>`;
    b.addEventListener('click', () => {
      const q = K.predvolba(v.id);
      q.tisk = K.kopie(app.p.tisk); q.kalibrace = K.kopie(app.p.kalibrace); q.otvory.vule = app.p.otvory.vule; q.barvy = K.kopie(app.p.barvy); q.diry = app.p.diry;
      app.nahrad(q);
      nahled.pohled('iso');
    });
    $('seznamPredvoleb').appendChild(b);
  }
  /** Náhodný organizér z předvolby s pozměněnými parametry (vždy bez chyb – jinak další pokus). */
  function nahodny() {
    const r = (a, b) => a + (b - a) * Math.random(), vyber = a => a[Math.floor(Math.random() * a.length)];
    for (let i = 0; i < 30; i++) {
      const q = K.predvolba(vyber(K.PREDVOLBY).id);
      q.tisk = K.kopie(app.p.tisk);
      q.popisky.rezim = vyber(Object.keys(K.NAZVY.rezim));
      q.otvory.stena = Math.round(r(1.6, 3) * 10) / 10;
      if (q.druh === 'stojanek') { q.stojanek.rad = Math.max(1, Math.round(r(1, 4))); q.stojanek.krokVysky = Math.round(r(4, 14)); }
      if (q.druh === 'bity' && !q.bity.druh.startsWith('nas')) { q.bity.nx = Math.round(r(3, 8)); q.bity.ny = Math.round(r(1, 4)); }
      q.upevneni.typ = vyber(['zadne', 'zadne', 'gridfinity', 'zed', 'cleat']);
      q.nazev = 'Náhodný organizér';
      if (!K.kontroly(q, font).some(h => h.uroven === 'chyba' || h.uroven === 'varovani')) return q;
    }
    return K.predvolba('kov10');
  }

  /* ---------- export ---------- */
  function lzeExport() {
    if (!model) { Dialog.chyba(chybaStavby || 'Geometrické jádro se ještě načítá.'); return false; }
    return true;
  }
  /** Kusy (skupiny dílů, které drží pohromadě – tělo + popisky) rozložené na podložku. */
  function tiskKusy() {
    const kusy = [];
    for (let i = 0; i < app.p.tisk.sad; i++) for (const k of model.kusy) kusy.push(Object.assign({}, k, { text: k.text + (app.p.tisk.sad > 1 ? ` ${i + 1}` : '') }));
    return KLIC.rozlozNaPodlozku(kusy, 8, app.p.tisk.podlozka).kusy;
  }
  const tiskDily = () => tiskKusy().flatMap(k => k.dily);
  const barvy = () => ({ podklad: app.p.barvy.telo, text: app.p.barvy.text, ramecek: app.p.barvy.text });
  function exportVse(druh) {
    if (!lzeExport()) return;
    if (druh === 'stl') app.stahni(KRAB.stlBinarni(tiskDily(), 'organizer_vrtaku - github_site'), app.jmeno('.stl'), 'model/stl');
    else app.stahni(KLIC.soubor3mfBarevny(tiskKusy(), app.p.nazev || 'Organizér', barvy()), app.jmeno('.3mf'), 'model/3mf');
  }
  $('btnStl').addEventListener('click', () => exportVse('stl'));
  $('btn3mf').addEventListener('click', () => exportVse('3mf'));
  $('btnStlBarvy').addEventListener('click', () => {
    if (!lzeExport()) return;
    const kusy = tiskKusy();
    for (const [role, jm] of [['podklad', 'telo'], ['text', 'popisky']]) {
      const d = kusy.flatMap(k => k.dily.filter(x => x.role === role));
      if (d.length) app.stahni(KRAB.stlBinarni(d, 'organizer_vrtaku - ' + jm), app.jmeno('_' + jm + '.stl'), 'model/stl');
    }
  });
  let podpisExportu = '';
  function naplnExporty() {
    const dily = model ? vsechnyDily() : [], podpis = dily.map(d => d.jmeno + d.nazev).join('|');
    if (podpis === podpisExportu) return;
    podpisExportu = podpis;
    $('seznamExportu').innerHTML = dily.length > 1 ? dily.map(d => `<button class="pol" role="menuitem" data-export-dil="${esc(d.jmeno)}">⬇ STL – ${esc(d.nazev)}</button>`).join('') : '';
  }
  $('seznamExportu').addEventListener('click', e => {
    const b = e.target.closest('[data-export-dil]');
    if (!b || !lzeExport()) return;
    const d = vsechnyDily().find(x => x.jmeno === b.dataset.exportDil);
    if (d) app.stahni(KRAB.stlBinarni(G3D.tiskoveRozlozeni([d], app.p.tisk.sad, 8, app.p.tisk.podlozka), 'organizer_vrtaku - ' + d.jmeno), app.jmeno('_' + d.jmeno + '.stl'), 'model/stl');
  });
  document.querySelectorAll('[data-export="kalibrace"]').forEach(b => b.addEventListener('click', () => {
    if (!lzeExport()) return;
    let kal = model.kalibrace;
    if (!kal.length) {
      try { kal = K.postav(wasm, app.p, font, { kalibrace: true }).kalibrace; } catch (e) { Dialog.chyba('Kalibrační vzorek nelze sestavit: ' + (e && e.message || e)); return; }
    }
    app.stahni(KRAB.stlBinarni(G3D.tiskoveRozlozeni(kal, 1, 5, 200), 'organizer_vrtaku - kalibrace'), app.jmeno('_kalibrace.stl'), 'model/stl');
  }));

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
  FONTY.opentype('libsans').then(f => { font = f; app.prepocitej(); })
    .catch(e => { chybaPisma = 'Písmo pro popisky se nenačetlo (' + (e && e.message || e) + ') – díl bude bez popisků.'; app.prepocitej(); });
  app.start({
    manifold: {
      ok: w => { wasm = w; prepocitej(); },
      chyba: e => { chybaJadra = 'Geometrické jádro (manifold-3d) se nenačetlo: ' + (e && e.message || e) + ' – model ani export nejsou k dispozici.'; prepocitej(); },
    },
  });
  window.ORGV_UI = { get p() { return app.p; }, get model() { return model; }, get font() { return font; }, zmen: app.zmen, nahrad: app.nahrad, prepocitej, nahled, app, nastavRezim };
})();

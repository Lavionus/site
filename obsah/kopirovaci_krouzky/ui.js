/* Kopírovací kroužky a podložky – ovládání stránky nad společným zapojením gen3d/aplikace.js
   (tady jen to, co je pro kroužky zvláštní: viditelnost polí, přehledy systémů, souhrny, výsledky, výpočty, kusovník, režimy náhledu,
   export po dílech, měrky, sada, výkres 1 : 1). Náhled = KNOF_NAHLED. Režimy: sestava, rozložená, tisk. */
/* global KROUZKY, KROUZKY_VYK, KNOF_NAHLED, KRAB, G3D, Dialog, TrubkyGui */
(function () {
  'use strict';
  const K = KROUZKY, $ = id => document.getElementById(id);
  const fmt = K.fmt;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  let p, wasm = null, model = null, chybaStavby = '', chybaJadra = '';
  const stavZobr = { rezim: 'sestava', freza: true };
  const nahled = KNOF_NAHLED.vytvorNahled($('platno'), { drzPohled: true });

  const app = G3D.aplikace({
    typ: 'kopirovaci_krouzky', nazev: 'Kopírovací kroužky', klic: 'webapp_kopirovaci_krouzky', soubor: 'krouzek',
    normalizuj: K.normalizuj, vychozi: () => K.predvolba('k17'),
    ulozProjekt: K.ulozProjekt, nactiProjekt: K.nactiProjekt, popis: K.popis,
    vezmi: K.vezmi, poloz: K.poloz,
    viditelnost: () => viditelnost(),
    prepocitej: () => prepocitej(),
    png: () => nahled.png(), pohled: j => nahled.pohled(j),
    exportStl: () => exportVse('stl'),
    doModelare: () => (lzeExport() ? { data: KRAB.soubor3mf(kusy(dilyKTisku()), app.p.nazev || 'Kroužek'), pripona: '.3mf' } : null),
    zkratky: { r: 'tRez', h: 'tHrany', m: 'tTisk', p: 'tPrevisy', l: 'tPravitka', f: 'tFreza' },
    zmenaTematu: () => prepocitej(),
  });

  /* ---------- formulář ---------- */
  const seznam = a => (a || '').split(/\s+/).filter(Boolean);
  function viditelnost() {
    p = app.p;
    const hodnoty = { rozhrani: p.rozhrani.typ, tvar: p.podlozka.tvar, otvor: p.podlozka.otvor,
      madlo: p.madlo.zapnuto ? '1' : '0', kruzitko: p.kruzitko.zapnuto ? '1' : '0', vyvod: p.vyvod.zapnuto ? '1' : '0' };
    document.querySelectorAll('[data-rozhrani],[data-tvar],[data-otvor],[data-madlo],[data-kruzitko],[data-vyvod]').forEach(el => {
      el.hidden = !Object.keys(hodnoty).every(k => !el.dataset[k] || seznam(el.dataset[k]).includes(hodnoty[k]));
    });
    document.querySelectorAll('#predKrouzku button').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.d) === p.krouzek.vnejsi)));
    document.querySelectorAll('#predStopek button').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.d) === p.trn.stopka)));
    const r = p.rozhrani, a = K.autoRozhrani(p.krouzek.vnejsi + p.krouzek.korekce);
    const sys = K.SYSTEMY.find(s => (s.auto ? Object.assign({}, s, a) : s).typ === r.typ && ['priruba', 'tlPriruby', 'krk', 'roztec', 'pocet', 'sroub'].every(k => { const h = (s.auto ? a : s)[k]; return h === undefined || h === r[k]; }));
    $('f_sys').value = sys ? sys.id : '';
    document.querySelectorAll('#paletaUchyceni [data-uchyceni-dl]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.uchyceniDl === r.typ)));
    const h = K.HADICE.find(x => x.prumer === p.vyvod.prumer && x.usazeni === p.vyvod.usazeni);
    $('f_had').value = h ? h.id : '';
  }
  const moznosti = (sel, obj) => { $(sel).innerHTML = Object.entries(obj).map(([k, m]) => `<option value="${esc(k)}">${esc(m.nazev)}</option>`).join(''); };
  moznosti('f_material', K.MATERIALY); moznosti('f_rs', K.SROUBY); moznosti('f_psr', K.SROUBY);
  const rychle = (kam, hodnoty, cesta, popis) => {
    for (const d of hodnoty) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'tl'; b.dataset.d = d; b.textContent = popis(d);
      b.addEventListener('click', () => { app.zmen(q => K.poloz(q, cesta, d)); app.naplnFormular(); });
      $(kam).appendChild(b);
    }
  };
  rychle('predKrouzku', K.KROUZKY, 'krouzek.vnejsi', d => `Ø ${fmt(d, 2)}`);
  rychle('predStopek', K.STOPKY, 'trn.stopka', d => (d === 6.35 ? '1/4″' : d === 12.7 ? '1/2″' : `Ø ${d}`));
  $('f_sys').innerHTML = '<option value="">– vlastní rozměry –</option>' + K.SYSTEMY.map(s => `<option value="${s.id}">${esc(s.nazev)}</option>`).join('');
  $('f_sys').addEventListener('change', e => {
    const s = K.SYSTEMY.find(x => x.id === e.target.value); if (!s) return;
    const h = s.auto ? K.autoRozhrani(app.p.krouzek.vnejsi + app.p.krouzek.korekce) : s;
    app.zmen(q => { for (const k of ['typ', 'priruba', 'tlPriruby', 'pocet', 'roztec', 'sroub', 'krk']) if (h[k] !== undefined) q.rozhrani[k] = h[k]; });
    app.naplnFormular();
  });
  document.querySelectorAll('#paletaUchyceni [data-uchyceni-dl]').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.uchyceniDl === app.p.rozhrani.typ) return;
    app.zmen(q => { q.rozhrani.typ = b.dataset.uchyceniDl; });
    app.naplnFormular();
  }));
  $('btnAuto').addEventListener('click', () => {
    const h = K.autoRozhrani(app.p.krouzek.vnejsi + app.p.krouzek.korekce);
    app.zmen(q => Object.assign(q.rozhrani, h)); app.naplnFormular();
  });
  $('f_had').innerHTML = '<option value="">– vlastní rozměr –</option>' + K.HADICE.map(h => `<option value="${h.id}">${esc(h.nazev)}</option>`).join('');
  $('f_had').addEventListener('change', e => {
    const h = K.HADICE.find(x => x.id === e.target.value); if (!h) return;
    app.zmen(q => { q.vyvod.prumer = h.prumer; q.vyvod.usazeni = h.usazeni; }); app.naplnFormular();
  });

  /* ---------- přepočet ---------- */
  function prepocitej() {
    p = app.p;
    nahled.barvy(css('--border-strong'), css('--border'), css('--text'));
    let H = K.kontroly(p);
    model = null; chybaStavby = '';
    const o = K.odvozene(p), lzeStavet = !o.chyby.length && (p.dily.krouzek || p.dily.podlozka || p.dily.trn);
    if (wasm && lzeStavet) {
      try {
        model = K.postav(wasm, p, { kalibrace: p.tisk.kalibrace });
        H = H.concat(K.kontrolyModelu(p, model));
      } catch (e) { chybaStavby = 'Model nelze sestavit: ' + (e && e.message || e); }
    } else if (wasm) chybaStavby = 'Model nejde sestavit – opravte chyby v záložce Kontrola.';
    const st = $('stav3d');
    st.textContent = chybaJadra || (wasm ? chybaStavby : 'Načítám geometrické jádro…');
    st.classList.toggle('chyba', !!(chybaJadra || chybaStavby));
    app.hlaseni(H, { chybaStavby: chybaJadra || (lzeStavet ? chybaStavby : ''), boxy: ['boxKrouzek', 'boxPodlozka'] });
    zobraz(false);
    vypisVysledky(o);
    vypisVypocty(o);
    vypisKusovnik(o);
    souhrny(o);
    exportDilu();
  }
  function souhrny(o) {
    const r = p.rozhrani, pd = p.podlozka, kr = o.kr;
    TrubkyGui.souhrn('sDily', ['krouzek', 'podlozka', 'trn'].filter(k => p.dily[k]).map(k => ({ krouzek: 'kroužek', podlozka: 'podložka', trn: 'trn' })[k]).join(' + ') || '—', true);
    TrubkyGui.souhrn('sKrouzek', `Ø ${fmt(kr.Dv, 2)} / ${fmt(kr.d, 2)} · límec ${fmt(kr.L, 1)}`, p.dily.krouzek);
    TrubkyGui.souhrn('sRozhrani', r.typ === 'srouby' ? `Ø ${fmt(r.priruba, 1)} · ${r.pocet}× ${K.SROUBY[r.sroub].nazev}` : `Ø ${fmt(r.priruba, 1)} · krk ${fmt(r.krk, 1)}`, true);
    TrubkyGui.souhrn('sTrn', `stopka ${fmt(p.trn.stopka, 2)} · Ø ${fmt(p.trn.dMin, 1)}–${fmt(p.trn.dMax, 1)}`, p.dily.trn);
    TrubkyGui.souhrn('sPodlozka', `${pd.tvar === 'kruh' || pd.tvar === 'D' ? (pd.tvar === 'D' ? 'D ' : '') + 'Ø ' + fmt(pd.prumer) : pd.tvar === 'obdelnik' ? fmt(pd.delka) + ' × ' + fmt(pd.sirka) : 'z bodů'} · ${fmt(o.t, 1)} mm`, p.dily.podlozka);
    TrubkyGui.souhrn('sSroubyP', pd.pocet ? `${pd.pocet}× ${K.SROUBY[pd.sroub].nazev} na Ø ${fmt(pd.roztec, 1)}` : 'bez šroubů', p.dily.podlozka);
    TrubkyGui.souhrn('sMadlo', p.madlo.zapnuto ? `${fmt(p.madlo.delka)} mm · ${fmt(p.madlo.natoceni)}°` : 'ne', p.madlo.zapnuto);
    TrubkyGui.souhrn('sKruzitko', p.kruzitko.zapnuto ? `R ${fmt(p.kruzitko.od)}–${fmt(p.kruzitko.do)} · ${o.dirKruzitka.length} děr` : 'ne', p.kruzitko.zapnuto);
    TrubkyGui.souhrn('sVyvod', p.vyvod.zapnuto ? `Ø ${fmt(p.vyvod.prumer)} ${p.vyvod.usazeni === 'zasun' ? 'zasunout' : 'navléknout'} · ${fmt(p.vyvod.sklon)}°` : 'ne', p.vyvod.zapnuto);
    const ods = K.odsazeni(kr.Dv, kr.d, p.vypocty.freza);
    $('napKrouzek').textContent = `S frézou Ø ${fmt(p.vypocty.freza, 2)} je odsazení šablony ${fmt(ods.o, 2)} mm. Průchodem projde fréza do Ø ${fmt(ods.maxFreza, 1)} mm. Límec ${fmt(kr.L, 1)} mm se hodí do šablony silné aspoň ${fmt(kr.L + 0.5, 1)} mm.`;
    const sys = K.SYSTEMY.find(s => s.id === $('f_sys').value);
    $('napRozhrani').textContent = sys ? sys.pozn : (r.typ === 'srouby'
      ? `Příruba leží v zahloubení zespodu patky, šrouby ${K.SROUBY[r.sroub].nazev} se zapustí do příruby. Rozměry změřte na původním kroužku.`
      : `Krk projde otvorem Ø ${fmt(2 * (r.krk / 2 + r.vule), 1)} v podložce, matice se utáhne shora. Krk vyčnívá ${fmt(o.matice ? o.Hn : 0, 1)} mm nad přírubu.`);
    $('napTrn').textContent = `Kužel Ø ${fmt(p.trn.dMin, 1)}–${fmt(p.trn.dMax, 1)} vystředí otvor Ø ${fmt(o.trnCil, 1)}. Upnout jen lehce a motor s trnem nikdy nezapínat.`;
    $('napPodlozka').textContent = `Spodní plocha je kluzná (jede po šabloně). ${pd.otvor === 'krouzky' ? `Zahloubení Ø ${fmt(2 * o.Rc, 2)} × ${fmt(o.tp, 1)} mm pro přírubu kroužku, otvor nad ním Ø ${fmt(2 * o.Rotvor, 1)}.` : `Středový otvor Ø ${fmt(2 * o.Rotvor, 1)}.`}`;
    $('napSroubyP').textContent = pd.pocet ? `Zápustné hlavy ${K.SROUBY[pd.sroub].nazev} (Ø ${fmt(o.sroubP.hlava, 1)}, 90°) zespodu. Rozteč a natočení ověřte výkresem 1 : 1 přiloženým na patku.` : 'Díry vyvrtáte podle původní podložky – výkres 1 : 1 ukáže střed.';
    $('napKruzitko').textContent = p.kruzitko.zapnuto && o.dirKruzitka.length ? `Díra na poloměru R vyřízne s frézou Ø ${fmt(p.vypocty.freza, 1)} kotouč o poloměru R − ${fmt(p.vypocty.freza / 2, 2)} nebo otvor R + ${fmt(p.vypocty.freza / 2, 2)} (tabulka ve Výpočtech).` : '';
  }

  /* ---------- náhled ---------- */
  function posun(d, dz) { const P = new Float32Array(d.poz); for (let i = 2; i < P.length; i += 3) P[i] += dz; return Object.assign({}, d, { poz: P }); }
  function dilyKTisku() { return model ? model.dily.concat(p.tisk.kalibrace ? model.kalibrace : []) : []; }
  const kusy = dily => G3D.tiskoveRozlozeni(dily, 1, 8, Math.max(160, p.tisk.podlozkaX));
  function zobraz(novyPohled) {
    const r = stavZobr.rezim;
    document.querySelectorAll('.rezimy [data-rezim]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.rezim === r)));
    if (!model || !model.dily.length) { nahled.nastav(null); return; }
    const B = G3D.obal(model.dily[0].poz), vel = Math.hypot(B[3] - B[0], B[4] - B[1], B[5] - B[2]);
    if (!stavZobr.vel || Math.abs(vel - stavZobr.vel) / stavZobr.vel > 0.25) { novyPohled = true; stavZobr.vel = vel; }
    if (r === 'tisk') nahled.nastav(kusy(dilyKTisku()), { tisk: true, novyPohled, uhel: p.tisk.uhel });
    else {
      const roz = r === 'rozlozena', L = model.o.kr.L;
      const dz = { krouzek: roz ? -(L + 30) : 0, matice: roz ? 25 : 0, trn: roz ? 25 : 0, cep: roz ? -25 : 0 };
      const viz = stavZobr.freza && !roz && !p.dily.trn ? model.vizual : [];   // trn je v kleštině místo frézy
      nahled.nastav(model.dily.concat(viz).map(d => (dz[d.jmeno] ? posun(d, dz[d.jmeno]) : d)), { tisk: false, novyPohled, uhel: p.tisk.uhel });
    }
    $('legPrevisy').hidden = !(r === 'tisk' && nahled.stav.previsy);
  }
  function nastavRezim(r) {
    const tisk = $('tTisk').getAttribute('aria-pressed') === 'true';
    if ((r === 'tisk') !== tisk) { $('tTisk').click(); if (r === 'tisk') return; }
    stavZobr.rezim = r; zobraz(true);
  }
  document.querySelectorAll('.rezimy [data-rezim]').forEach(b => b.addEventListener('click', () => nastavRezim(b.dataset.rezim)));

  /* ---------- výsledky ---------- */
  const box = G3D.dlazdice;
  const cas = m => (m < 60 ? m + ' min' : fmt(m / 60, 1) + ' h');
  function vypisVysledky(o) {
    const el = $('vVysledky'), karta = $('karta3d');
    if (!model) { el.innerHTML = box('Model', wasm ? 'nelze sestavit' : 'načítám…', chybaStavby); karta.innerHTML = ''; $('vSit').innerHTML = ''; return; }
    const mat = K.MATERIALY[p.tisk.material], V = model.dily.reduce((s, d) => s + d.objem, 0);
    const od = G3D.odhadTisku(V, mat.hustota, { dilu: model.dily.length });
    let h = '';
    for (const d of model.dily) { const b = G3D.obal(d.poz); h += box(d.nazev, `${fmt(b[3] - b[0], 1)} × ${fmt(b[4] - b[1], 1)} × ${fmt(b[5] - b[2], 1)} mm`, `${fmt(d.objem / 1000, 1)} cm³ · ${fmt(d.objem / 1000 * mat.hustota, 0)} g`); }
    h += box('Hmotnost celkem', `${fmt(od.g, 0)} g`, `${mat.nazev}, plné díly`);
    h += box('Filament', `${fmt(od.metru, 1)} m`, 'Ø 1,75 mm, plné díly (při 40 % výplni zhruba 60 %)');
    h += box('Doba tisku', `≈ ${cas(od.minut)}`, `${model.dily.length} ${model.dily.length === 1 ? 'díl' : model.dily.length < 5 ? 'díly' : 'dílů'} · hrubý odhad`);
    if (p.dily.krouzek) { const s = K.odsazeni(o.kr.Dv, o.kr.d, p.vypocty.freza); h += box('Odsazení šablony', `${fmt(s.o, 2)} mm`, `kroužek Ø ${fmt(o.kr.Dv, 2)}, fréza Ø ${fmt(p.vypocty.freza, 2)} · max. fréza Ø ${fmt(s.maxFreza, 1)}`, s.projde ? '' : 'chyba-t'); }
    el.innerHTML = h;
    karta.innerHTML = p.dily.krouzek
      ? `<div class="titul">kroužek</div><b>Ø ${fmt(o.kr.Dv, 2)}</b> / ${fmt(o.kr.d, 2)} · límec <b>${fmt(o.kr.L, 1)}</b><br>odsazení <b>${fmt(K.odsazeni(o.kr.Dv, o.kr.d, p.vypocty.freza).o, 2)}</b> mm pro frézu Ø ${fmt(p.vypocty.freza, 1)}`
      : `<div class="titul">${esc(model.dily[0].nazev)}</div><b>${fmt(od.g, 0)}</b> g`;
    $('vSit').innerHTML = model.dily.concat(model.kalibrace).map(d => { const k = KRAB.kontrolaSite(d.poz, d.idx); return box('Síť – ' + d.nazev, k.uzavrena ? '✔ těsná' : '✖ netěsná', `${k.trojuhelniku} trojúhelníků, ${d.teles} těleso`, k.uzavrena && d.teles === 1 ? 'ok-t' : 'chyba-t'); }).join('')
      + (model.prunik.krouzekPodlozka !== undefined ? box('Sestava', model.prunik.krouzekPodlozka < 1 ? '✔ bez kolize' : '✖ díly se prolínají', `kroužek × podložka ${fmt(model.prunik.krouzekPodlozka, 1)} mm³ · ${model.cas} ms`, model.prunik.krouzekPodlozka < 1 ? 'ok-t' : 'chyba-t') : '');
  }
  function vypisVypocty(o) {
    const v = p.vypocty, kr = o.kr, s = K.odsazeni(kr.Dv, kr.d, v.freza);
    let h = box('Odsazení o', `${fmt(s.o, 2)} mm`, `= (${fmt(kr.Dv, 2)} − ${fmt(v.freza, 2)}) / 2`);
    h += box('Otvor / kapsa', `šablona + ${fmt(2 * s.o, 2)} mm`, 'kroužek jede uvnitř otvoru šablony');
    h += box('Obrys dílu', `šablona − ${fmt(2 * s.o, 2)} mm`, 'kroužek obíhá šablonu');
    h += box('Největší fréza', `Ø ${fmt(s.maxFreza, 1)} mm`, `průchod Ø ${fmt(kr.d, 2)}, 0,5 mm vůle na stranu`, s.projde ? 'ok-t' : 'chyba-t');
    h += box('Límec × šablona', `${fmt(kr.L, 1)} / ${fmt(v.sablona, 1)} mm`, kr.L <= v.sablona - 0.5 ? `rezerva ${fmt(v.sablona - kr.L, 1)} mm` : 'límec drhne o obrobek', kr.L <= v.sablona - 0.5 ? 'ok-t' : 'chyba-t');
    h += box('Nejmenší vnitřní roh', `R ${fmt(Math.max(0, s.o), 2)} mm`, `vnější rohy dílu při obíhání; kouty R ${fmt(v.freza / 2, 2)} (fréza)`);
    $('vVypocty').innerHTML = h;
    const sd = K.sada(p);
    $('tabSada').innerHTML = '<tr><th>Kroužek Ø</th><th class="c">Průchod Ø</th><th class="c">Odsazení</th><th class="c">Max. fréza</th><th>Uchycení</th></tr>'
      + sd.map(r => `<tr class="${r.kolize || !r.projde ? 'spatne' : ''}${Math.abs(r.D - p.krouzek.vnejsi) < 1e-6 ? ' aktivni' : ''}"><td>${fmt(r.D, 2)}</td><td class="c">${fmt(r.d, 2)}</td><td class="c">${fmt(r.o, 2)}</td><td class="c">${fmt(r.maxFreza, 1)}</td><td>${r.kolize ? '✖ ' + esc(r.kolize) : r.projde ? '✔' : '✖ fréza neprojde'}</td></tr>`).join('');
    $('tabKruzitko').innerHTML = p.kruzitko.zapnuto && o.dirKruzitka.length
      ? '<tr><th>Díra R</th><th class="c">Kotouč Ø</th><th class="c">Otvor Ø</th></tr>' + o.dirKruzitka.map(d => { const k = K.kruzitkoKruh(d.R, v.freza); return `<tr><td>${fmt(d.R)}</td><td class="c">${fmt(2 * k.kotouc, 1)}</td><td class="c">${fmt(2 * k.otvor, 1)}</td></tr>`; }).join('')
      : '';
  }
  function vypisKusovnik(o) {
    $('tabKusovnik').innerHTML = '<tr><th>Položka</th><th class="c">Množství</th><th>Poznámka</th></tr>'
      + K.kusovnik(p, o, model).map(r => `<tr><td>${esc(r[0])}</td><td class="c">${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join('');
  }

  /* ---------- nabídky, export ---------- */
  TrubkyGui.pripoj({ klic: 'webapp_kopirovaci_krouzky_gui', pohled: j => nahled.pohled(j) });
  for (const v of K.PREDVOLBY) {
    const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
    b.innerHTML = `${esc(v.nazev)}<span class="pozn">${esc(v.popis)}</span>`;
    b.addEventListener('click', () => { const q = K.predvolba(v.id); q.tisk = K.kopie(app.p.tisk); q.vypocty = K.kopie(app.p.vypocty); app.nahrad(q); });
    $('seznamPredvoleb').appendChild(b);
  }
  function lzeExport() {
    if (!model) { Dialog.chyba(chybaJadra || chybaStavby || 'Geometrické jádro se ještě načítá.'); return false; }
    return true;
  }
  const stl = (dily, jm) => app.stahni(KRAB.stlBinarni(kusy(dily), 'kopirovaci krouzky - ' + jm), app.jmeno(jm ? '_' + jm + '.stl' : '.stl'), 'model/stl');
  function exportVse(druh) {
    if (!lzeExport()) return;
    if (druh === 'stl') stl(dilyKTisku(), '');
    else app.stahni(KRAB.soubor3mf(kusy(dilyKTisku()), app.p.nazev || 'Kroužek'), app.jmeno('.3mf'), 'model/3mf');
  }
  $('btnStl').addEventListener('click', () => exportVse('stl'));
  $('btn3mf').addEventListener('click', () => exportVse('3mf'));
  $('btnKalibrace').addEventListener('click', () => { if (lzeExport()) stl(K.postav(wasm, app.p, { kalibrace: true, vizual: false }).kalibrace, 'meraky'); });
  $('btnSada').addEventListener('click', () => {
    if (!lzeExport()) return;
    const s = K.postav(wasm, app.p, { sada: true, vizual: false }).sada;
    if (!s.length) { Dialog.chyba('Ze sady se do zvoleného uchycení nevejde žádný kroužek – upravte rozsah ve Výpočtech.'); return; }
    stl(s, 'sada');
  });
  function exportDilu() {
    const el = $('exportDilu'); el.innerHTML = '';
    if (!model || model.dily.length < 2) return;
    for (const d of model.dily) {
      const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
      b.innerHTML = `⬇ STL – ${esc(d.nazev.toLowerCase())}<span class="pozn">jen tento díl</span>`;
      b.addEventListener('click', () => { if (lzeExport()) stl([d], d.jmeno); });
      el.appendChild(b);
    }
  }
  /* ---------- výkres 1 : 1 ---------- */
  function vykres() {
    if (!lzeExport()) return null;
    const o = K.odvozene(app.p), d = new Date();
    return KROUZKY_VYK.sestavVykres(app.p, o, model, { datum: `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`, kusovnik: K.kusovnik(app.p, o, model).map(r => [r[0], r[1]]) });
  }
  const ukazVykres = () => { const v = vykres(); if (!v) return; $('vykresObsah').innerHTML = v.svg; $('vykresDlg').showModal(); };
  const stahniSvg = () => { const v = vykres(); if (v) app.stahni(v.svg, app.jmeno('_vykres_1-1.svg'), 'image/svg+xml'); };
  function tiskVykresu() {
    const v = vykres(); if (!v) return;
    const ram = document.createElement('iframe');
    ram.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(ram);
    const d = ram.contentDocument;
    d.open(); d.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(app.jmeno(''))}</title><style>@page{size:${v.sirka}mm ${v.vyska}mm;margin:0}html,body{margin:0;padding:0}svg{display:block;width:${v.sirka}mm;height:${v.vyska}mm}</style></head><body>${v.svg}</body></html>`); d.close();
    setTimeout(() => { try { ram.contentWindow.focus(); ram.contentWindow.print(); } finally { setTimeout(() => ram.remove(), 60000); } }, 250);
  }
  $('btnVykres').addEventListener('click', ukazVykres);
  $('btnVykresSvg').addEventListener('click', stahniSvg); $('btnVykresSvgM').addEventListener('click', stahniSvg);
  $('btnVykresTisk').addEventListener('click', tiskVykresu); $('btnVykresTiskM').addEventListener('click', tiskVykresu);
  $('btnZavritVyk').addEventListener('click', () => $('vykresDlg').close());

  app.prepinac('tRez', h => { nahled.prepni('rez', h); $('legRez').hidden = !h; });
  app.prepinac('tHrany', h => nahled.prepni('hrany', h));
  app.prepinac('tPrevisy', h => { nahled.prepni('previsy', h); $('legPrevisy').hidden = !(h && stavZobr.rezim === 'tisk'); }, true);
  app.prepinac('tPravitka', h => nahled.prepni('pravitka', h), true);
  app.prepinac('tFreza', h => { stavZobr.freza = h; zobraz(false); }, true);
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
  window.KROUZKY_UI = { get p() { return app.p; }, get model() { return model; }, zmen: app.zmen, nahrad: app.nahrad, prepocitej, nahled, app, nastavRezim };
})();

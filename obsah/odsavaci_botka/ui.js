/* Odsávací botka – ovládání stránky nad společným zapojením gen3d/aplikace.js
   (tady jen to, co je pro botku zvláštní: viditelnost polí, souhrny, výsledky, proudění, kusovník, režimy náhledu, export po dílech, výkres).
   Náhled = KNOF_NAHLED. Režimy: sestava (na vřetenu), rozložená (komora sundaná), tisk (díly na podložce). */
/* global BOTKA, BOTKA_VYK, KNOF_NAHLED, KRAB, G3D, Dialog, TrubkyGui */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const fmt = BOTKA.fmt;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  let p, wasm = null, model = null, chybaStavby = '', chybaJadra = '';
  const stavZobr = { rezim: 'sestava', vreteno: true };
  const nahled = KNOF_NAHLED.vytvorNahled($('platno'), { drzPohled: true });

  const app = G3D.aplikace({
    typ: 'odsavaci_botka', nazev: 'Odsávací botka', klic: 'webapp_odsavaci_botka', soubor: 'botka',
    normalizuj: BOTKA.normalizuj, vychozi: () => BOTKA.predvolba('oval52'),
    ulozProjekt: BOTKA.ulozProjekt, nactiProjekt: BOTKA.nactiProjekt, popis: BOTKA.popis,
    vezmi: BOTKA.vezmi, poloz: BOTKA.poloz,
    viditelnost: () => viditelnost(),
    prepocitej: () => prepocitej(),
    png: () => nahled.png(), pohled: j => nahled.pohled(j),
    exportStl: () => exportVse('stl'),
    doModelare: () => (lzeExport() ? { data: KRAB.soubor3mf(kusy(dilyKTisku()), app.p.nazev || 'Botka'), pripona: '.3mf' } : null),
    zkratky: { r: 'tRez', h: 'tHrany', m: 'tTisk', p: 'tPrevisy', l: 'tPravitka', v: 'tVreteno' },
    zmenaTematu: () => prepocitej(),
  });

  /* ---------- formulář ---------- */
  const seznam = a => (a || '').split(/\s+/).filter(Boolean);
  function viditelnost() {
    p = app.p;
    const hodnoty = { upnuti: p.objimka.upnuti, uchyceni: p.uchyceni.typ, tvar: p.komora.tvar, kartac: p.kartac.typ, umisteni: p.vyvod.umisteni };
    document.querySelectorAll('[data-upnuti],[data-uchyceni],[data-tvar],[data-kartac],[data-umisteni]').forEach(el => {
      el.hidden = !Object.keys(hodnoty).every(k => !el.dataset[k] || seznam(el.dataset[k]).includes(hodnoty[k]));
    });
    document.querySelectorAll('#predVreten button').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.d) === p.vreteno.prumer)));
    const h = BOTKA.HADICE.find(x => x.prumer === p.vyvod.prumer && x.usazeni === p.vyvod.usazeni);
    $('f_had').value = h ? h.id : '';
  }
  $('f_material').innerHTML = Object.entries(BOTKA.MATERIALY).map(([k, m]) => `<option value="${k}">${m.nazev}</option>`).join('');
  for (const d of BOTKA.VRETENA) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'tl'; b.dataset.d = d; b.textContent = `Ø ${d}`;
    b.addEventListener('click', () => { app.zmen(q => { q.vreteno.prumer = d; }); app.naplnFormular(); });
    $('predVreten').appendChild(b);
  }
  $('f_had').innerHTML = '<option value="">– vlastní rozměr –</option>' + BOTKA.HADICE.map(h => `<option value="${h.id}">${esc(h.nazev)}</option>`).join('');
  $('f_had').addEventListener('change', e => {
    const h = BOTKA.HADICE.find(x => x.id === e.target.value); if (!h) return;
    app.zmen(q => { q.vyvod.prumer = h.prumer; q.vyvod.usazeni = h.usazeni; }); app.naplnFormular();
  });
  for (const v of BOTKA.VYSAVACE) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'tl'; b.textContent = `${v.nazev} ~${v.prutok} m³/h`;
    b.addEventListener('click', () => { app.zmen(q => { q.proud.prutok = v.prutok; }); app.naplnFormular(); });
    $('predVysavacu').appendChild(b);
  }

  /* ---------- přepočet ---------- */
  function prepocitej() {
    p = app.p;
    nahled.barvy(css('--border-strong'), css('--border'), css('--text'));
    let H = BOTKA.kontroly(p);
    model = null; chybaStavby = '';
    const lzeStavet = !BOTKA.odvozene(p).chyby.length;
    if (wasm && lzeStavet) {
      try {
        model = BOTKA.postav(wasm, p, { kalibrace: p.tisk.kalibrace });
        H = H.concat(BOTKA.kontrolyModelu(p, model));
      } catch (e) { chybaStavby = 'Model nelze sestavit: ' + (e && e.message || e); }
    } else if (wasm) chybaStavby = 'Model nejde sestavit – opravte chyby v záložce Kontrola.';
    const st = $('stav3d');
    st.textContent = chybaJadra || (wasm ? chybaStavby : 'Načítám geometrické jádro…');
    st.classList.toggle('chyba', !!(chybaJadra || chybaStavby));
    app.hlaseni(H, { chybaStavby: chybaJadra || (lzeStavet ? chybaStavby : ''), boxy: ['boxObjimka', 'boxKomora'] });
    zobraz(false);
    const o = BOTKA.odvozene(p);
    vypisVysledky(o);
    vypisProudeni(o);
    vypisKusovnik(o);
    souhrny(o);
    exportDilu();
  }
  function souhrny(o) {
    const N = BOTKA.NAZVY, k = p.komora, v = p.vyvod, h = o.h;
    TrubkyGui.souhrn('sVreteno', `Ø ${fmt(p.vreteno.prumer)} · nástroj ${fmt(p.vreteno.vylozeni)} mm`, true);
    TrubkyGui.souhrn('sObjimka', `${N.upnuti[p.objimka.upnuti]}${p.objimka.upnuti === 'sroub' ? ' ' + p.objimka.sroub : ''} · výška ${fmt(p.objimka.vyska)}`, true);
    TrubkyGui.souhrn('sUchyceni', p.uchyceni.typ === 'magnety' ? `${o.magnety.body.length} × Ø ${fmt(p.uchyceni.prumer)} × ${fmt(p.uchyceni.vyska)}` : 'zásuvné vedení', true);
    TrubkyGui.souhrn('sKomora', `${k.tvar === 'kruh' ? 'kruh Ø ' + fmt(k.prumer) : N.tvar[k.tvar] + ' ' + fmt(k.delka) + ' × ' + fmt(k.sirka)} · výška ${fmt(o.Hk, 1)}`, true);
    TrubkyGui.souhrn('sKartac', p.kartac.typ === 'pasek' ? `lišta ${fmt(p.kartac.pasek)} mm · ${fmt(o.obvodKartace, 0)} mm` : `TPU · ${fmt(o.Lv, 0)} mm lamely`, true);
    TrubkyGui.souhrn('sVyvod', `Ø ${fmt(v.prumer)} ${v.usazeni === 'zasun' ? 'zasunout' : 'navléknout'} · ${v.umisteni === 'deska' ? 'z desky' : 'z boku'} ${fmt(v.sklon)}°`, true);
    $('napObjimka').textContent = p.objimka.upnuti === 'sroub'
      ? `Prstenec je rozříznutý štěrbinou až k okraji desky; šroub ${p.objimka.sroub} × ${o.delkaSroubu} prochází kapkovitým otvorem, matice se vkládá do kapsy shora. Deska je ${fmt(o.zpb, 1)} mm nad čelem vřetene.`
      : `Čtyři štěrbiny shora a drážka ${fmt(p.objimka.sirkaSpony)} mm pro hadicovou sponu nebo stahovací pásku. Deska je ${fmt(o.zpb, 1)} mm nad čelem vřetene.`;
    $('napUchyceni').textContent = p.uchyceni.typ === 'magnety'
      ? `Kapsy Ø ${fmt(2 * o.mR, 2)} × ${fmt(o.mH, 1)} mm v desce (zespodu) i v přírubě komory (shora). ${p.uchyceni.montaz === 'lepeni' ? 'Magnety zalepit' : 'Magnety zalisovat'}, v desce a v komoře s opačnou polaritou.`
      : `Lišty s náběhem 45° na přírubě komory obejmou zkosené hrany desky; komora se vysouvá ve směru vývodu, doraz je u vývodu. Lišty ≈ ${fmt(o.zas ? o.zas.delkaListy : 0, 0)} mm.`;
    $('napKomora').textContent = `Komora ${fmt(o.Hk, 1)} mm vysoká (od lišty kartáče po desku), příruba ${fmt(p.komora.priruba)} mm se sražením 45° zespodu. Volno mezi vřetenem a lištou ${fmt(o.lipVnitrni - p.vreteno.prumer / 2, 1)} mm.`;
    $('napKartac').textContent = p.kartac.typ === 'pasek'
      ? `Drážka ${fmt(o.wg, 2)} × ${fmt(o.hd)} mm, pásek dlouhý ${fmt(Math.ceil(o.obvodKartace / 10) * 10 + 20, 0)} mm (obvod + rezerva). Vlas vyčnívá ${fmt(o.Lv, 1)} mm, končí ${fmt(p.kartac.presah, 1)} mm pod špičkou nástroje.`
      : `Sukně z TPU tloušťky ${fmt(o.wg - 0.05, 2)} mm se zasune do drážky; lamely ${fmt(o.Lv, 1)} mm dlouhé po ${fmt(p.kartac.lamela)} mm.`;
    const vety = [(h.zasun ? `Hrdlo Ø ${fmt(2 * h.rs0, 2)}–${fmt(2 * h.rs1, 2)} mm (k ústí širší), doraz zúží průchod na Ø ${fmt(2 * h.rn, 1)} mm.`
      : `Trn Ø ${fmt(2 * h.os0, 2)}–${fmt(2 * h.os1, 2)} mm (k ústí užší), průchod Ø ${fmt(2 * h.ri, 1)} mm, osazení Ø ${fmt(2 * h.on, 1)} mm.`)
      , p.vyvod.umisteni === 'deska' && Number.isFinite(o.rp) ? `Pata ${fmt(o.rp, 1)} mm od osy vřetene.` : ''
      , p.vyvod.umisteni === 'bok' && o.e ? `Tečně posunutý o ${fmt(Math.abs(o.e), 1)} mm.` : ''];
    // každá věta zvlášť (překlad po textových uzlech)
    $('napVyvod').replaceChildren(...vety.filter(Boolean).flatMap((t, i) => { const sp = document.createElement('span'); sp.textContent = t; return i ? [' ', sp] : [sp]; }));
  }

  /* ---------- náhled ---------- */
  function posun(d, dz) { const P = new Float32Array(d.poz); for (let i = 2; i < P.length; i += 3) P[i] += dz; return Object.assign({}, d, { poz: P }); }
  function dilyKTisku() { return model ? model.dily.concat(p.tisk.kalibrace ? model.kalibrace : []) : []; }
  const kusy = dily => G3D.tiskoveRozlozeni(dily, 1, 8, 260);
  function zobraz(novyPohled) {
    const r = stavZobr.rezim;
    document.querySelectorAll('.rezimy [data-rezim]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.rezim === r)));
    if (!model) { nahled.nastav(null); return; }
    // jiná velikost botky (předvolba, vřeteno) → nový pohled; drobné změny pohled drží
    const b = G3D.obal(model.dily[0].poz), vel = Math.hypot(b[3] - b[0], b[4] - b[1], b[5] - b[2]);
    if (!stavZobr.vel || Math.abs(vel - stavZobr.vel) / stavZobr.vel > 0.25) { novyPohled = true; stavZobr.vel = vel; }
    if (r === 'tisk') nahled.nastav(kusy(dilyKTisku()), { tisk: true, novyPohled, uhel: p.tisk.uhel });
    else {
      const dz = r === 'rozlozena' ? -(model.o.Hk + 40) : 0;
      const viz = stavZobr.vreteno ? model.vizual : [];
      const dily = model.dily.concat(viz).map(d => (d.jmeno === 'objimka' || d.jmeno === 'vreteno' ? d : posun(d, dz)));
      nahled.nastav(dily, { tisk: false, novyPohled, uhel: p.tisk.uhel });
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
    const mat = BOTKA.MATERIALY[p.tisk.material];
    const vse = model.dily;
    const B = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (const d of vse) { const b = G3D.obal(d.poz); for (let i = 0; i < 3; i++) { B[i] = Math.min(B[i], b[i]); B[i + 3] = Math.max(B[i + 3], b[i + 3]); } }
    const tisk = model.dily.filter(d => d.jmeno !== 'sukne'), V = tisk.reduce((s, d) => s + d.objem, 0);
    const od = G3D.odhadTisku(V, mat.hustota, { dilu: tisk.length });
    const sukne = model.dily.find(d => d.jmeno === 'sukne');
    let h = box('Rozměry sestavy', `${fmt(B[3] - B[0], 0)} × ${fmt(B[4] - B[1], 0)} × ${fmt(B[5] - B[2], 0)} mm`, 'š × h × v bez vřetene');
    h += box('Komora', `${fmt(o.Hk, 1)} mm vysoká`, `kartáč ${fmt(o.Lv, 1)} mm pod ní, deska ${fmt(o.zpb, 1)} mm nad čelem vřetene`);
    h += box('Objem', `${fmt(V / 1000, 1)} cm³`, model.dily.map(d => `<span>${esc(d.nazev.toLowerCase())} ${fmt(d.objem / 1000, 1)}</span>`).join(' · '));
    h += box('Hmotnost', `${fmt(od.g, 0)} g`, `${mat.nazev}, plné díly${sukne ? ` + TPU ${fmt(sukne.objem / 1000 * BOTKA.HUSTOTA_TPU, 0)} g` : ''}`);
    h += box('Filament', `${fmt(od.metru, 1)} m`, 'Ø 1,75 mm, plné díly (při 25 % výplni zhruba polovina)');
    h += box('Doba tisku', `≈ ${cas(od.minut)}`, `${tisk.length} díly · hrubý odhad`);
    h += box('Kartáč', p.kartac.typ === 'pasek' ? `${fmt(Math.ceil(o.obvodKartace / 10) * 10 + 20, 0)} mm lišty` : `${o.lamel || '–'} lamel TPU`, `obvod drážky ${fmt(o.obvodKartace, 0)} mm`);
    h += box('Uchycení', p.uchyceni.typ === 'magnety' ? `${2 * o.magnety.body.length} magnetů` : 'zásuv', p.uchyceni.typ === 'magnety' ? `Ø ${fmt(p.uchyceni.prumer)} × ${fmt(p.uchyceni.vyska)}, kapsa Ø ${fmt(2 * o.mR, 2)}` : `lišty ≈ ${fmt(o.zas.delkaListy, 0)} mm`);
    el.innerHTML = h;
    karta.innerHTML = `<div class="titul">${esc(BOTKA.NAZVY.tvar[p.komora.tvar])}</div><b>${fmt(B[3] - B[0], 0)} × ${fmt(B[4] - B[1], 0)} × ${fmt(B[5] - B[2], 0)}</b> mm · <b>${fmt(od.g, 0)}</b> g<br>`
      + `vřeteno Ø ${fmt(p.vreteno.prumer)} · hadice Ø ${fmt(p.vyvod.prumer)}<br>komora ${fmt(o.Hk, 0)} mm · ${p.uchyceni.typ === 'magnety' ? 'magnety' : 'zásuv'}`;
    $('vSit').innerHTML = model.dily.concat(model.kalibrace).map(d => { const k = KRAB.kontrolaSite(d.poz, d.idx); return box('Síť – ' + d.nazev, k.uzavrena ? '✔ těsná' : '✖ netěsná', `${k.trojuhelniku} trojúhelníků, ${d.teles} těleso`, k.uzavrena && d.teles === 1 ? 'ok-t' : 'chyba-t'); }).join('')
      + box('Sestava', model.prunik.objimkaKomora < 1 ? '✔ bez kolize' : '✖ díly se prolínají', `objímka × komora ${fmt(model.prunik.objimkaKomora, 1)} mm³ · ${model.cas} ms`, model.prunik.objimkaKomora < 1 ? 'ok-t' : 'chyba-t');
  }
  const tlak = x => (x >= 1000 ? fmt(x / 1000, 2) + ' kPa' : fmt(x, 0) + ' Pa');
  function vypisProudeni(o) {
    const r = BOTKA.proudeni(p, o);
    const tr = (v, mez) => (v >= mez ? 'ok-t' : 'mez-t');
    let h = box('U kartáče', `${fmt(r.vK, 1)} m/s`, `plocha ${fmt(r.plochaK / 100, 1)} cm² · doporučeno ≥ 10 m/s`, tr(r.vK, 10));
    h += box('Ve vývodu', `${fmt(r.vV, 1)} m/s`, `průchod Ø ${fmt(r.dV, 1)} mm · dopravní ≥ 18 m/s`, tr(r.vV, 18));
    h += box('Tlaková ztráta botky', tlak(r.dp), `kartáč ${tlak(r.dpK)} + vývod ${tlak(r.dpV)}`);
    h += box('Průtok pro 20 m/s v hrdle', `${fmt(r.Q20, 0)} m³/h`, `pro 10 m/s u kartáče ${fmt(r.Q10k, 0)} m³/h`);
    // vysavač má podtlak do ~20 kPa, odsávačka do ~2,5 kPa (typické) – větší ztráta znamená, že zadaný průtok neprojde
    if (r.dp > (p.proud.prutok > 400 ? 2500 : 20000)) h += box('Průtok neprojde', 'menší než zadaný', `ztráta ${tlak(r.dp)} je víc, než ${p.proud.prutok > 400 ? 'odsávačka' : 'vysavač'} zvládne (typicky ${p.proud.prutok > 400 ? '2,5 kPa' : '20 kPa'}) – větší hadice nebo vývod`, 'chyba-t');
    $('vProud').innerHTML = h;
    $('tabProud').innerHTML = '<tr><th>Vysavač</th><th class="c">Průtok</th><th class="c">U kartáče</th><th class="c">Vývod</th><th class="c">Ztráta</th></tr>'
      + BOTKA.VYSAVACE.map(v => { const q = BOTKA.proudeni(p, o, v.prutok); return `<tr><td>${esc(v.nazev)}</td><td class="c">${v.prutok} m³/h</td><td class="c">${fmt(q.vK, 1)} m/s</td><td class="c">${fmt(q.vV, 1)} m/s</td><td class="c">${tlak(q.dp)}</td></tr>`; }).join('');
  }
  function vypisKusovnik(o) {
    $('tabKusovnik').innerHTML = '<tr><th>Položka</th><th class="c">Množství</th><th>Poznámka</th></tr>'
      + BOTKA.kusovnik(p, o, model).map(r => `<tr><td>${esc(r[0])}</td><td class="c">${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join('');
  }

  /* ---------- nabídky, export ---------- */
  TrubkyGui.pripoj({ klic: 'webapp_odsavaci_botka_gui', pohled: j => nahled.pohled(j) });
  for (const v of BOTKA.PREDVOLBY) {
    const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
    b.innerHTML = `${esc(v.nazev)}<span class="pozn">${esc(v.popis)}</span>`;
    b.addEventListener('click', () => { const q = BOTKA.predvolba(v.id); q.tisk = BOTKA.kopie(app.p.tisk); q.proud = BOTKA.kopie(app.p.proud); app.nahrad(q); });
    $('seznamPredvoleb').appendChild(b);
  }
  function lzeExport() {
    if (!model) { Dialog.chyba(chybaJadra || chybaStavby || 'Geometrické jádro se ještě načítá.'); return false; }
    return true;
  }
  function exportVse(druh) {
    if (!lzeExport()) return;
    const d = kusy(dilyKTisku());
    if (druh === 'stl') app.stahni(KRAB.stlBinarni(d, 'odsavaci botka - github_site'), app.jmeno('.stl'), 'model/stl');
    else app.stahni(KRAB.soubor3mf(d, app.p.nazev || 'Botka'), app.jmeno('.3mf'), 'model/3mf');
  }
  $('btnStl').addEventListener('click', () => exportVse('stl'));
  $('btn3mf').addEventListener('click', () => exportVse('3mf'));
  function exportDilu() {
    const el = $('exportDilu'); el.innerHTML = '';
    if (!model) return;
    const polozky = model.dily.map(d => [d.nazev, () => [d], d.jmeno]);
    polozky.push(['kalibrační vzorek', () => (p.tisk.kalibrace ? model.kalibrace : BOTKA.postav(wasm, p, { kalibrace: true, vizual: false }).kalibrace), 'kalibrace']);
    for (const [nazev, dily, jm] of polozky) {
      const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
      b.innerHTML = `⬇ STL – ${esc(nazev.toLowerCase())}<span class="pozn">jen tento díl</span>`;
      b.addEventListener('click', () => { if (lzeExport()) app.stahni(KRAB.stlBinarni(kusy(dily()), 'odsavaci botka - ' + jm), app.jmeno('_' + jm + '.stl'), 'model/stl'); });
      el.appendChild(b);
    }
  }
  /* ---------- výkres ---------- */
  function svgVykresu() {
    if (!lzeExport()) return null;
    const o = BOTKA.odvozene(app.p), d = new Date();
    return BOTKA_VYK.sestavVykres(app.p, o, { datum: `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`, kusovnik: BOTKA.kusovnik(app.p, o, model).map(r => [r[0], r[1]]) });
  }
  const ukazVykres = () => { const svg = svgVykresu(); if (!svg) return; $('vykresObsah').innerHTML = svg; $('vykresDlg').showModal(); };
  const stahniSvg = () => { const svg = svgVykresu(); if (svg) app.stahni(svg, app.jmeno('_vykres.svg'), 'image/svg+xml'); };
  function tiskVykresu() {
    const svg = svgVykresu(); if (!svg) return;
    const ram = document.createElement('iframe');
    ram.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(ram);
    const d = ram.contentDocument;
    d.open(); d.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(app.jmeno(''))}</title><style>@page{size:A4 landscape;margin:0}html,body{margin:0;padding:0}svg{display:block;width:297mm;height:210mm}</style></head><body>${svg}</body></html>`); d.close();
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
  app.prepinac('tVreteno', h => { stavZobr.vreteno = h; zobraz(false); }, true);
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
  window.BOTKA_UI = { get p() { return app.p; }, get model() { return model; }, zmen: app.zmen, nahrad: app.nahrad, prepocitej, nahled, app, nastavRezim };
})();

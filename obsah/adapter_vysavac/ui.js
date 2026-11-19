/* Adaptér nářadí → vysavač – ovládání stránky nad společným zapojením gen3d/aplikace.js
   (tady jen to, co je pro adaptér zvláštní: databáze rozměrů a Moje rozměry, viditelnost polí, souhrny, výsledky,
   proudění, kusovník, režimy náhledu, export po dílech, výkres). Náhled = KNOF_NAHLED. */
/* global ADVYS, ADVYS_VYK, KNOF_NAHLED, KRAB, G3D, Dialog, TrubkyGui */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const K = ADVYS, fmt = K.fmt;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const KLIC_ROZMERY = 'webapp_adapter_vysavac_rozmery';
  let p, wasm = null, model = null, chybaStavby = '', chybaJadra = '', proud = null, nv = null;
  const stavZobr = { rezim: 'sestava' };
  const nahled = KNOF_NAHLED.vytvorNahled($('platno'), { drzPohled: true });

  /* ---------- Moje rozměry (vlastní vývody a koncovky) ---------- */
  function nactiMoje() {
    try { const x = JSON.parse(localStorage.getItem(KLIC_ROZMERY) || '[]'); return Array.isArray(x) ? x.filter(o => o && typeof o.id === 'string' && o.nazev) : []; } catch (e) { return []; }
  }
  let moje = nactiMoje();
  K.nastavMoje(moje);

  const app = G3D.aplikace({
    typ: 'adapter_vysavac', nazev: 'Adaptér na vysavač', klic: 'webapp_adapter_vysavac', soubor: 'adapter',
    normalizuj: K.normalizuj, vychozi: () => K.predvolba('pex_karcher'),
    ulozProjekt: K.ulozProjekt, nactiProjekt: K.nactiProjekt, popis: K.popis,
    viditelnost: () => viditelnost(),
    prepocitej: () => prepocitej(),
    png: () => nahled.png(), pohled: j => nahled.pohled(j),
    exportStl: () => exportVse('stl'),
    doModelare: () => (lzeExport() ? { data: KRAB.soubor3mf(kusy(model.tisk), app.p.nazev || 'Adaptér'), pripona: '.3mf' } : null),
    zkratky: { r: 'tRez', h: 'tHrany', m: 'tTisk', p: 'tPrevisy', l: 'tPravitka' },
    zmenaTematu: () => prepocitej(),
  });

  function ulozMoje() {
    try { localStorage.setItem(KLIC_ROZMERY, JSON.stringify(moje)); } catch (e) { Dialog.chyba('Rozměr se nepodařilo uložit – úložiště prohlížeče je plné nebo zakázané.'); }
    K.nastavMoje(moje);
    naplnDb();
    viditelnost();
  }
  const popisPolozky = x => `${x.znacka ? x.znacka + ' – ' : ''}${x.nazev} (${x.typ === 'vnejsi' ? 'čep' : 'hrdlo'} Ø ${fmt(x.d0, 1)})`;
  function naplnDb() {
    for (const X of ['A', 'B']) {
      const sel = $('db' + X), skupiny = new Map();
      const poradi = X === 'A' ? ['naradi', 'hadice'] : ['hadice', 'naradi'];
      for (const druh of poradi) for (const x of K.DB.POLOZKY.filter(q => q.druh === druh)) {
        const g = (druh === 'naradi' ? 'Nářadí: ' : 'Vysavače a hadice: ') + x.skupina;
        if (!skupiny.has(g)) skupiny.set(g, []);
        skupiny.get(g).push(x);
      }
      let h = '<option value="vlastni">— vlastní rozměr —</option>';
      if (moje.length) h += `<optgroup label="Moje rozměry">${moje.map(x => `<option value="${esc(x.id)}">${esc(popisPolozky(x))}</option>`).join('')}</optgroup>`;
      for (const [g, seznam] of skupiny) h += `<optgroup label="${esc(g)}">${seznam.map(x => `<option value="${esc(x.id)}">${esc(popisPolozky(x))}</option>`).join('')}</optgroup>`;
      sel.innerHTML = h;
    }
  }
  naplnDb();
  document.querySelectorAll('[data-db]').forEach(sel => sel.addEventListener('change', () => {
    const X = sel.dataset.db, id = sel.value;
    if (id === 'vlastni') { app.zmen(q => { q[X].zdroj = 'vlastni'; }); return; }
    const x = K.najdi(id);
    if (!x) return;
    app.zmen(q => {
      Object.assign(q[X], { zdroj: id, typ: x.typ, d0: x.d0, d1: x.d1, L: x.L });
      if (x.spoj) q[X].spoj = x.spoj;
      if (x.stoupani) q[X].stoupani = x.stoupani;
      if (x.hloubka) q[X].hloubka = x.hloubka;
    });
    app.naplnFormular();
  }));
  document.querySelectorAll('[data-ulozit-rozmer]').forEach(b => b.addEventListener('click', async () => {
    const X = b.dataset.ulozitRozmer, e = app.p[X];
    const vych = K.zdrojKonce(e) ? K.nazevKonce(e) : `${X === 'A' ? 'Moje nářadí' : 'Moje hadice'} Ø ${fmt(e.d0, 1)}`;
    const nazev = await Dialog.zeptej('Název rozměru (např. „Bruska – vývod změřený 19. 11.“):', vych);
    if (!nazev || !String(nazev).trim()) return;
    const x = { id: 'moje_' + Date.now().toString(36), druh: X === 'A' ? 'naradi' : 'hadice', skupina: 'Moje', znacka: '', nazev: String(nazev).trim().slice(0, 80), typ: e.typ, d0: e.d0, d1: e.d1, L: e.L };
    if (e.spoj === 'zavit') Object.assign(x, { spoj: 'zavit', stoupani: e.stoupani, hloubka: e.hloubka });
    moje.push(x);
    ulozMoje();
    app.zmen(q => { q[X].zdroj = x.id; });
  }));
  document.querySelectorAll('[data-smazat-rozmer]').forEach(b => b.addEventListener('click', async () => {
    const X = b.dataset.smazatRozmer, id = app.p[X].zdroj, x = moje.find(q => q.id === id);
    if (!x) { Dialog.info('Smazat jde jen vlastní rozměr – vyberte ho v nabídce Z databáze (skupina Moje rozměry).'); return; }
    if (!await Dialog.potvrd(`Smazat můj rozměr „${x.nazev}“? Rozměry v projektu zůstanou.`)) return;
    moje = moje.filter(q => q.id !== id);
    ulozMoje();
  }));

  /* ---------- viditelnost polí a popisy ---------- */
  const seznam = a => (a || '').split(/\s+/).filter(Boolean);
  function viditelnost() {
    p = app.p;
    const druhy = ['A', 'B'].map(X => p[X].spojka);
    document.querySelectorAll('[data-spoj],[data-nezavit],[data-oring],[data-osa],[data-sspojkou],[data-druhspojky],[data-sterbina]').forEach(el => {
      const d = el.dataset;
      let vid = true;
      if (d.spoj) { const [X, s] = seznam(d.spoj); vid = p[X].spoj === s; }
      if (d.nezavit && p[d.nezavit].spoj === 'zavit') vid = false;
      if (d.oring) vid = p[d.oring].oring && p[d.oring].spoj !== 'zavit';
      if (d.osa && !seznam(d.osa).includes(p.osa.typ)) vid = false;
      if (d.sspojkou) vid = druhy.some(x => x !== 'zadna');
      if (d.druhspojky) vid = druhy.includes(d.druhspojky);
      if (d.sterbina) vid = p.sterbina.zap;
      el.hidden = !vid;
    });
    for (const X of ['A', 'B']) {
      const e = p[X], sel = $('db' + X), x = K.zdrojKonce(e);
      sel.value = x ? e.zdroj : 'vlastni';
      const zav = e.spoj === 'zavit', cep = e.typ === 'vnejsi';
      $('l' + X + 'd0').textContent = zav ? (cep ? 'Ø závitu protikusu' : 'Ø hadice (vrcholy vln)') : (cep ? 'Ø čepu u kořene' : 'Ø hrdla u ústí');
      $('l' + X + 'd1').textContent = cep ? 'Ø čepu na konci' : 'Ø hrdla v hloubce';
      const moj = moje.some(q => q.id === e.zdroj);
      $('pozn' + X).innerHTML = !x ? 'Vlastní rozměr – změřte posuvkou. Tlačítkem 💾 ho uložíte do Mých rozměrů.'
        : moj ? `Můj rozměr „${esc(x.nazev)}“.${x.upraveno ? ' <b>Upraveno.</b>' : ''}`
          : `Typické rozměry (databáze ${esc(K.DB.DATUM)}) – <b>ověřte měřením</b>.${x.pozn ? ' ' + esc(x.pozn[0].toUpperCase() + x.pozn.slice(1)) + '.' : ''}${x.upraveno ? ' Rozměry jsou upravené.' : ''}`;
      $('nap' + X).textContent = zav
        ? (cep ? 'Adaptér má vnitřní závit a našroubuje se na závit protikusu.' : 'Adaptér má vnější závit – hadice se na něj našroubuje (stoupání = rozteč vln).')
        : e.spoj === 'kuzel'
          ? (cep ? 'Hrdlo se nasune na čep; u ústí má vůli, do hloubky se zužuje o přídavný kužel – čep v hloubce sevře.' : 'Čep se zasune do hrdla; u kořene sevře, ke špičce se zužuje o přídavný kužel.')
          : (cep ? 'Rovné hrdlo s vůlí – drží třením nebo O-kroužkem.' : 'Rovný čep s vůlí – drží třením nebo O-kroužkem.');
    }
    $('napSpojka').textContent = druhy.includes('bajonet') && druhy.includes('klip') ? 'Bajonet: zasunout a pootočit. Klip: zacvaknout, uvolnit stiskem háčků.'
      : druhy.includes('bajonet') ? 'Nástrčka se zuby se zasune do zásuvky a pootočí o zadaný úhel. Zásuvka je na adaptéru, nástrčka zůstane na hadici nebo nářadí.'
        : 'Pružné jazýčky nástrčky s háčky zacvaknou do okének zásuvky. Uvolní se stisknutím háčků v okénkách.';
  }
  $('f_material').innerHTML = Object.entries(K.MATERIALY).map(([k, m]) => `<option value="${k}">${m.nazev}</option>`).join('');

  /* ---------- přepočet ---------- */
  function prepocitej() {
    p = app.p;
    nahled.barvy(css('--border-strong'), css('--border'), css('--text'));
    let H = K.kontroly(p);
    nv = K.navrh(p);
    model = null; chybaStavby = chybaJadra;
    if (wasm) {
      try {
        model = K.postav(wasm, p, { kalibrace: stavZobr.rezim === 'kalibrace' });
        H = H.concat(K.kontrolyModelu(p, model));
      } catch (e) { chybaStavby = 'Model nelze sestavit: ' + (e && e.message || e); }
    }
    try { proud = K.proudeni(p, nv); H = H.concat(hlaseniProudu()); } catch (e) { proud = null; }
    const st = $('stav3d');
    st.textContent = wasm || chybaJadra ? chybaStavby : 'Načítám geometrické jádro…';
    st.classList.toggle('chyba', !!chybaStavby);
    zobraz(false);
    app.hlaseni(H, { chybaStavby, boxy: ['boxKonce', 'boxPrechod'] });
    vypisVysledky();
    souhrny();
    vypisProudeni();
    naplnExporty();
  }
  function hlaseniProudu() {
    const H = [];
    if (!proud || !(p.proud.prutok > 0)) return H;
    if (proud.vMin < 15) H.push({ uroven: 'info', pole: ['proud.prutok'], text: `V nejširším místě adaptéru proudí vzduch jen ${fmt(proud.vMin, 1)} m/s – pod 15–18 m/s se prach a třísky usazují. Pomůže větší průtok nebo užší průchod.` });
    if (proud.vMax > 45) H.push({ uroven: 'info', pole: ['proud.prutok', 'stena'], text: `V nejužším místě (Ø ${fmt(proud.dMin, 1)} mm) proudí vzduch ${fmt(proud.vMax, 0)} m/s – ztráta roste se čtvercem rychlosti a adaptér píská. Zvětšete průchod (menší doraz nebo stěna).` });
    if (proud.podil > 10) H.push({ uroven: 'info', pole: ['proud.prutok', 'proud.podtlak'], text: `Adaptér sám spotřebuje ${fmt(proud.podil, 0)} % podtlaku u nářadí – zvažte plynulejší přechod nebo větší průchod.` });
    return H;
  }
  const box = (a, b, c, d) => G3D.dlazdice(a, b, c, d);
  const mat = () => K.MATERIALY[p.tisk.material];
  function popisKonce(X) {
    const K2 = nv.konce[X], f = K2.fit, e = p[X];
    const druh = f.hrdlo ? 'hrdlo' : 'čep', d = f.lic;
    const dd = Math.abs(d[0] - d[1]) > 0.02 ? `Ø ${fmt(d[0], 2)} → ${fmt(d[1], 2)}` : `Ø ${fmt(d[0], 2)}`;
    return { hlavni: `${druh} ${dd}`, dalsi: `${K.NAZVY.spoj[e.spoj]} · zasunutí ${fmt(e.L)} mm${e.spojka !== 'zadna' ? ' · ' + K.NAZVY.spojka[e.spojka] : ''}` };
  }
  function vypisVysledky() {
    const el = $('vVysledky'), karta = $('karta3d');
    if (!model) { el.innerHTML = box('Model', wasm || chybaJadra ? 'nelze sestavit' : 'načítám…', chybaStavby); karta.innerHTML = ''; $('vSit').innerHTML = ''; $('kusovnik').innerHTML = ''; return; }
    const m = model, M = mat();
    const B = m.sestava.reduce((b, d) => { const q = G3D.obal(d.poz); for (let i = 0; i < 3; i++) { b[i] = Math.min(b[i], q[i]); b[i + 3] = Math.max(b[i + 3], q[i + 3]); } return b; }, [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]);
    const V = m.tisk.reduce((s, d) => s + d.objem, 0) * p.tisk.sad;
    const od = G3D.odhadTisku(V, M.hustota, { dilu: m.tisk.length * p.tisk.sad });
    const a = popisKonce('A'), b = popisKonce('B'), d1 = nv.dily[0];
    let h = box('Konec A – nářadí', a.hlavni, a.dalsi);
    h += box('Konec B – vysavač', b.hlavni, b.dalsi);
    if (proud) h += box('Nejužší průchod', `Ø ${fmt(proud.dMin, 1)} mm`, `průřez ${fmt(Math.PI * proud.dMin * proud.dMin / 4, 0)} mm² · nejširší Ø ${fmt(proud.dMax, 1)}`);
    h += box('Přechod', `${fmt(d1.Lp, 1)} mm`, d1.uhelPrechodu > 0.05 ? `kužel ${fmt(d1.uhelPrechodu, 1)}° na stranu` : 'beze změny průchodu', d1.uhelPrechodu > 30 ? 'mez-t' : '');
    h += box('Sestava', `${fmt(B[3] - B[0], 0)} × ${fmt(B[4] - B[1], 0)} × ${fmt(B[5] - B[2], 0)} mm`, { rovna: 'rovná osa', ohyb: `ohyb ${fmt(p.osa.uhel)}°${nv.dilu > 1 ? ` · ${nv.dilu} díly` : ''}`, posun: `posun ${fmt(p.osa.posun)} mm` }[p.osa.typ]);
    if (proud) h += box('Tlaková ztráta', `${fmt(proud.dp, 0)} Pa`, `při ${fmt(proud.Q, 0)} m³/h · ${fmt(proud.podil, 1)} % podtlaku u nářadí`, proud.podil > 10 ? 'mez-t' : 'ok-t');
    h += box('Hmotnost', `${fmt(od.g, od.g < 10 ? 1 : 0)} g`, p.tisk.sad > 1 ? `${M.nazev}, plné díly, ${p.tisk.sad} sady` : `${M.nazev}, plné díly`);
    h += box('Filament', `${fmt(od.metru, 1)} m`, `průměr 1,75 mm · ${fmt(V / 1000, 1)} cm³`);
    h += box('Doba tisku', `≈ ${od.minut < 60 ? od.minut + ' min' : fmt(od.minut / 60, 1) + ' h'}`, `${(n => (n === 1 ? '1 díl' : n < 5 ? n + ' díly' : n + ' dílů'))(m.tisk.length * p.tisk.sad)} · hrubý odhad`);
    el.innerHTML = h;
    // kusovník
    const radky = m.tisk.map(d => [d.nazev, p.tisk.sad, d]);
    const navic = [];
    for (const X of ['A', 'B']) {
      const o = K.oringKonce(nv.konce[X].fit);
      if (o) navic.push([`O-kroužek ${fmt(o.ID, 1)} × ${fmt(o.snura, 1)} mm (NBR) – konec ${X}`, p.tisk.sad]);
    }
    if (nv.dilu > 1) navic.push([`Lepidlo na spoj dílů (kyanoakrylát nebo epoxid) – ${nv.dilu - 1}× zasunutí`, '']);
    $('kusovnik').innerHTML = `<table class="tabulka"><thead><tr><th>Díl</th><th class="c">Kusů</th><th class="c">Rozměr</th><th class="c">Objem</th></tr></thead><tbody>`
      + radky.map(([n, ks, d]) => { const q = G3D.obal(d.poz); return `<tr><td>${esc(n)}</td><td class="c">${ks}</td><td class="c">${fmt(q[3] - q[0], 1)} × ${fmt(q[4] - q[1], 1)} × ${fmt(q[5] - q[2], 1)}</td><td class="c">${fmt(d.objem / 1000, 1)} cm³</td></tr>`; }).join('')
      + navic.map(([n, ks]) => `<tr><td colspan="3">+ ${esc(n)}</td><td class="c">${ks === '' ? '' : ks + ' ks'}</td></tr>`).join('') + '</tbody></table>'
      + `<p class="napoveda">Rozměry vývodů z databáze jsou typické (${esc(K.DB.DATUM)}) – před tiskem ověřte posuvkou, případně vytiskněte kalibrační kroužky.</p>`;
    const titul = { sestava: 'Sestava', tisk: 'Díly k tisku', kalibrace: 'Kalibrační kroužky' }[stavZobr.rezim];
    karta.innerHTML = `<div class="titul">${titul}</div>A: <b>${esc(a.hlavni)}</b><br>B: <b>${esc(b.hlavni)}</b><br>${m.tisk.length} ${m.tisk.length === 1 ? 'díl' : m.tisk.length < 5 ? 'díly' : 'dílů'} · <b>${fmt(od.g, 0)}</b> g ${M.nazev}`;
    $('vSit').innerHTML = m.tisk.concat(m.kalibrace).map(d => { const k = KRAB.kontrolaSite(d.poz, d.idx), ok = k.uzavrena && d.teles === 1; return box('Síť – ' + d.nazev, ok ? '✔ těsná' : '✖ netěsná', `${k.trojuhelniku} trojúhelníků, ${d.teles} ${d.teles === 1 ? 'těleso' : 'tělesa'}`, ok ? 'ok-t' : 'chyba-t'); }).join('')
      + box('Stavba', `${m.cas} ms`, 'manifold-3d');
  }
  function souhrny() {
    for (const X of ['A', 'B']) { const a = popisKonce(X); TrubkyGui.souhrn('s' + X, a.hlavni + (p[X].spojka !== 'zadna' ? ' · ' + K.NAZVY.spojka[p[X].spojka] : ''), true); }
    const os = p.osa;
    TrubkyGui.souhrn('sPrechod', os.typ === 'ohyb' ? `ohyb ${fmt(os.uhel)}°${nv.dilu > 1 ? ` · ${nv.dilu} díly` : ''}` : os.typ === 'posun' ? `posun ${fmt(os.posun)} mm` : `rovná · přechod ${fmt(nv.dily[0].Lp, 0)} mm`, os.typ !== 'rovna');
    const spX = ['A', 'B'].find(X => nv.konce[X].Rc);
    TrubkyGui.souhrn('sSpojka', spX ? `Ø ${fmt(2 * nv.konce[spX].Rc, 1)} · vůle ${fmt(p.spojka.vule, 2)}` : '', !!spX);
    TrubkyGui.souhrn('sSterbina', p.sterbina.zap ? `${p.sterbina.pocet} × ${fmt(p.sterbina.sirka)} × ${fmt(p.sterbina.vyska)} mm` : 'vypnuto', p.sterbina.zap);
    const kal = p.kalibrace, e = p[kal.konec];
    TrubkyGui.souhrn('sKalibrace', `${kal.kusu} × konec ${kal.konec}`, false);
    const v0 = e.vule - (kal.kusu - 1) / 2 * kal.krok, v1 = e.vule + (kal.kusu - 1) / 2 * kal.krok;
    $('napKalibrace').textContent = `Kroužky 1–${kal.kusu} mají vůli ${fmt(v0, 2)} až ${fmt(v1, 2)} mm po ${fmt(kal.krok, 2)} mm (prostřední = nastavená vůle ${fmt(e.vule, 2)} mm). Číslo kroužku = počet zářezů na horní hraně. Nasaďte je na skutečný protikus a vůli nejlepšího zapište do pole Vůle u konce ${kal.konec}.`;
    const d1 = nv.dily[0];
    $('napPrechod').textContent = `Přechod ${fmt(d1.Lp, 1)} mm (nejkratší pro tisk ${fmt(d1.Lmin, 1)} mm)` + (os.typ !== 'rovna' ? ` · poloměr ohybu ${fmt(nv.Rb, 0)} mm` : '')
      + (os.typ === 'posun' && nv.beta ? ` · oblouky ${fmt(nv.beta, 1)}°` : '') + (nv.dilu > 1 ? ` · ${nv.dilu} díly po ${fmt(os.uhel / nv.dilu, 1)}°, spoj zasunutím ${fmt(nv.Lj, 0)} mm` : '') + '.';
  }

  /* ---------- proudění ---------- */
  function vypisProudeni() {
    const el = $('vProud'), gr = $('grafProud');
    if (!proud) { el.innerHTML = box('Proudění', '–', 'nelze spočítat'); gr.hidden = true; return; }
    const pr = proud, c = pr.dp || 1, podil = x => `${fmt(x / c * 100, 0)} %`;
    let h = box('Tlaková ztráta adaptéru', `${fmt(pr.dp, 0)} Pa`, `${fmt(pr.podil, 1)} % podtlaku ${fmt(p.proud.podtlak, 1)} kPa u nářadí`, pr.podil > 10 ? 'mez-t' : 'ok-t');
    h += box('Rychlost v nejužším místě', `${fmt(pr.vMax, 1)} m/s`, `Ø ${fmt(pr.dMin, 1)} mm · Re ${fmt(pr.Re, 0)}`, pr.vMax > 45 ? 'mez-t' : '');
    h += box('Rychlost v nejširším místě', `${fmt(pr.vMin, 1)} m/s`, `Ø ${fmt(pr.dMax, 1)} mm`, pr.vMin < 15 ? 'mez-t' : 'ok-t');
    h += box('Rychlost u nářadí / u hadice', `${fmt(pr.vA, 1)} / ${fmt(pr.vB, 1)} m/s`, `délka průchodu ${fmt(pr.delka, 0)} mm`);
    h += box('Kde se ztrácí tlak', `změny průřezu ${podil(pr.zmeny)}`, `tření ${podil(pr.treni)} · ohyb ${podil(pr.ohyb)}`);
    h += box('Průtok pro prach a třísky', `${fmt(pr.doporuceno[0], 0)}–${fmt(pr.doporuceno[1], 0)} m³/h`, `18–25 m/s v nejširším místě (Ø ${fmt(pr.dMax, 1)})`);
    if (p.sterbina.zap) h += box('Přisátí štěrbinou', `≈ ${fmt(pr.Qb, 0)} m³/h`, `plně otevřeno · ${fmt(pr.As, 0)} mm² · při ${fmt(p.proud.podtlak, 1)} kPa`);
    el.innerHTML = h;
    const Q0 = p.proud.prutok, Qmax = Math.max(Q0 * 2, pr.doporuceno[1] * 1.2, 10);
    const body = K.krivkaProudeni(p, nv, Qmax, 30);
    gr.hidden = false;
    const W = 320, Hh = 120, L0 = 44, Rr = 8, T0 = 8, B0 = 20, ymax = Math.max(...body.map(b => b.dp), 1) * 1.1;
    const X = q => L0 + (W - L0 - Rr) * q / Qmax, Y = d => T0 + (Hh - T0 - B0) * (1 - d / ymax);
    gr.innerHTML = `<h3>Tlaková ztráta adaptéru podle průtoku</h3><svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Tlaková ztráta podle průtoku: při ${fmt(Q0, 0)} m³/h ${fmt(pr.dp, 0)} Pa">`
      + `<line class="osa" x1="${L0}" y1="${Y(0)}" x2="${W - Rr}" y2="${Y(0)}"/><line class="osa" x1="${L0}" y1="${T0}" x2="${L0}" y2="${Y(0)}"/>`
      + `<text class="popis-osy" x="${L0 - 4}" y="${Y(0) + 3}" text-anchor="end">0</text><text class="popis-osy" x="${L0 - 4}" y="${T0 + 8}" text-anchor="end">${fmt(ymax / 1.1, 0)} Pa</text>`
      + `<text class="popis-osy" x="${L0}" y="${Hh - 5}">0 m³/h</text><text class="popis-osy" x="${W - Rr}" y="${Hh - 5}" text-anchor="end">${fmt(Qmax, 0)} m³/h</text>`
      + pr.doporuceno.map(q => (q < Qmax ? `<line class="mez" x1="${X(q)}" y1="${T0}" x2="${X(q)}" y2="${Y(0)}"/>` : '')).join('')
      + `<polyline class="cara" points="${body.map(b => `${X(b.Q).toFixed(1)},${Y(b.dp).toFixed(1)}`).join(' ')}"/>`
      + (Q0 > 0 && Q0 <= Qmax ? `<circle class="bod" r="4" cx="${X(Q0).toFixed(1)}" cy="${Y(pr.dp).toFixed(1)}"/>` : '') + '</svg>';
  }

  /* ---------- náhled ---------- */
  function zobraz(novyPohled) {
    document.querySelectorAll('[data-rezim]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.rezim === stavZobr.rezim)));
    if (!model) { nahled.nastav(null); return; }
    const r = stavZobr.rezim;
    if (r === 'tisk') nahled.nastav(G3D.tiskoveRozlozeni(model.tisk, p.tisk.sad, 8, 240), { tisk: true, novyPohled, uhel: p.tisk.uhel });
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

  /* ---------- nabídky, export ---------- */
  TrubkyGui.pripoj({ klic: 'webapp_adapter_vysavac_gui', pohled: j => nahled.pohled(j) });
  for (const v of K.PREDVOLBY) {
    const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
    b.innerHTML = `${esc(v.nazev)}<span class="pozn">${esc(v.popis)}</span>`;
    b.addEventListener('click', () => {
      const q = K.predvolba(v.id);
      q.tisk = K.kopie(app.p.tisk); q.proud = K.kopie(app.p.proud); q.kalibrace = K.kopie(app.p.kalibrace);
      app.nahrad(q);
      nahled.pohled('iso');
    });
    $('seznamPredvoleb').appendChild(b);
  }
  function lzeExport() {
    if (!model) { Dialog.chyba(chybaStavby || 'Geometrické jádro se ještě načítá.'); return false; }
    return true;
  }
  const kusy = dily => G3D.tiskoveRozlozeni(dily, app.p.tisk.sad, 8, 240);
  function exportVse(druh) {
    if (!lzeExport()) return;
    if (druh === 'stl') app.stahni(KRAB.stlBinarni(kusy(model.tisk), 'adapter vysavac - github_site'), app.jmeno('.stl'), 'model/stl');
    else app.stahni(KRAB.soubor3mf(kusy(model.tisk), app.p.nazev || 'Adaptér'), app.jmeno('.3mf'), 'model/3mf');
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
    if (d) app.stahni(KRAB.stlBinarni(G3D.tiskoveRozlozeni([d], app.p.tisk.sad, 8, 240), 'adapter vysavac - ' + d.jmeno), app.jmeno('_' + d.jmeno + '.stl'), 'model/stl');
  });
  document.querySelectorAll('[data-export]').forEach(b => b.addEventListener('click', () => {
    if (!lzeExport()) return;
    if (b.dataset.export === 'sestava') {
      let np = 0, ni = 0;
      for (const d of model.sestava) { np += d.poz.length; ni += d.idx.length; }
      const poz = new Float32Array(np), idx = new Uint32Array(ni);
      let a = 0, c = 0;
      for (const d of model.sestava) { poz.set(d.poz, a); for (let i = 0; i < d.idx.length; i++) idx[c + i] = d.idx[i] + a / 3; a += d.poz.length; c += d.idx.length; }
      app.stahni(KRAB.stlBinarni([{ nazev: 'Sestava', poz, idx }], 'adapter vysavac - sestava (vizualizace)'), app.jmeno('_sestava.stl'), 'model/stl');
      return;
    }
    let kal = model.kalibrace;
    if (!kal.length) {
      try { kal = K.postav(wasm, app.p, { kalibrace: true }).kalibrace; } catch (e) { Dialog.chyba('Kalibrační kroužky nelze sestavit: ' + (e && e.message || e)); return; }
    }
    app.stahni(KRAB.stlBinarni(G3D.tiskoveRozlozeni(kal, 1, 5, 200), 'adapter vysavac - kalibrace'), app.jmeno('_kalibrace.stl'), 'model/stl');
  }));

  /* ---------- výkres ---------- */
  function svgVykresu() {
    if (!lzeExport()) return null;
    const d = new Date(), M = mat();
    const hm = model.tisk.reduce((s, x) => s + x.objem, 0) * M.hustota / 1000;
    const kus = model.tisk.map(x => [x.nazev, app.p.tisk.sad]);
    for (const X of ['A', 'B']) { const o = K.oringKonce(nv.konce[X].fit); if (o) kus.push([`O-kroužek ${fmt(o.ID, 1)} × ${fmt(o.snura, 1)} (konec ${X})`, app.p.tisk.sad]); }
    if (nv.dilu > 1) kus.push(['Lepidlo na spoj dílů', '–']);
    return ADVYS_VYK.sestavVykres(app.p, nv, {
      datum: `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`, hmotnost: hm, material: M.nazev, kusovnik: kus,
      prumer: proud ? proud.dMin : 0, dp: proud ? `${fmt(proud.dp, 0)} Pa při ${fmt(app.p.proud.prutok, 0)} m³/h` : '',
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
  window.ADVYS_UI = { get p() { return app.p; }, get model() { return model; }, get nv() { return nv; }, get proud() { return proud; }, zmen: app.zmen, nahrad: app.nahrad, prepocitej, nahled, app, nastavRezim, svgVykresu };
})();

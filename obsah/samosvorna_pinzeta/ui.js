/* Samosvorná pinzeta – ovládání stránky nad společným zapojením gen3d/aplikace.js
   (tady jen to, co je pro pinzetu zvláštní: viditelnost polí, souhrny, výsledky, předvolby). Náhled = KNOF_NAHLED.
   Náhled ukazuje složenou pinzetu, tisková poloha (M) a export tiskový tvar (u otevřeného tisku rozevřený). */
/* global SPINZ, KNOF_NAHLED, KRAB, G3D, Dialog, TrubkyGui */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const fmt = SPINZ.fmt;
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  let p, wasm = null, model = null, tiskDily = null, chybaStavby = '', chybaJadra = '', zobrazene = null;
  const stavZobr = { tisk: false, rezim: 'slozena', mira: 1, anim: 0 };
  const nahled = KNOF_NAHLED.vytvorNahled($('platno'), { drzPohled: true });   // pohled se při změně voleb nemění

  const app = G3D.aplikace({
    typ: 'samosvorna_pinzeta', nazev: 'Samosvorná pinzeta', klic: 'webapp_samosvorna_pinzeta', soubor: 'pinzeta',
    normalizuj: SPINZ.normalizuj, vychozi: () => SPINZ.predvolba('nacrt'),
    ulozProjekt: SPINZ.ulozProjekt, nactiProjekt: SPINZ.nactiProjekt, popis: SPINZ.popis,
    vezmi: SPINZ.vezmi, poloz: SPINZ.poloz,
    viditelnost: () => viditelnost(),
    prepocitej: () => prepocitej(),
    png: () => nahled.png(), pohled: j => nahled.pohled(j),
    exportStl: () => exportStl(),
    doModelare: () => (lzeExport() ? { data: KRAB.soubor3mf(kusy(), app.p.nazev || 'Pinzeta'), pripona: '.3mf' } : null),
    zkratky: { r: 'tRez', h: 'tHrany', m: 'tTisk', p: 'tPrevisy', l: 'tPravitka' },
    zmenaTematu: () => prepocitej(),
  });

  const seznam = a => (a || '').split(/\s+/).filter(Boolean);
  function viditelnost() {
    p = app.p;
    const k = p.kloub;
    document.querySelectorAll('[data-spicka],[data-kloub],[data-nekloub],[data-uchop],[data-stav],[data-vzory],[data-hlava],[data-matice],[data-usi]').forEach(el => {
      const d = el.dataset;
      let vid = true;
      if (d.spicka && d.spicka !== p.celist.spicka) vid = false;
      if (d.kloub && !seznam(d.kloub).includes(k.typ)) vid = false;
      if (d.nekloub && d.nekloub === k.typ) vid = false;
      if (d.uchop && d.uchop !== p.uchop.typ) vid = false;
      if (d.stav && d.stav !== p.tisk.stav) vid = false;
      if (d.vzory && !seznam(d.vzory).includes(p.celist.vzor)) vid = false;
      if (d.hlava && !(k.hlava > 0)) vid = false;
      if (d.matice && !(k.matice > 0)) vid = false;
      if (d.usi && !p.tisk.usi) vid = false;
      el.hidden = !vid;
    });
    $('napPredpeti').textContent = p.tisk.stav === 'otevrena'
      ? 'Tiskne se s rozevřeným okem a nepřekříženými rameny. Po složení se oko ohne a stiskne špičky k sobě – čím větší rozevření, tím větší síla (i přetvoření oka).'
      : 'Tiskne se složená s mezerou mezi čelistmi – bez skládání, ale bez předpětí: čelisti drží jen to, co je silnější než mezera.';
    $('napVzor').textContent = {
      hladke: 'Hladké čelisti.', zoubky: 'Trojúhelníkové zoubky – na protější čelisti posunuté o půl rozteče, zapadnou do sebe.',
      vlnky: 'Oblé vlnky – zapadají do sebe jako zoubky, ale nepoškrábou měkký předmět.', ryhy: 'Příčné V-rýhy proti sobě – lepší úchop bez zapadání.',
      drazka: 'Půlkruhová drážka v obou čelistech – po zavření kulatý otvor na drát nebo jehlu.',
    }[p.celist.vzor];
    $('napKloub').textContent = {
      vlastni: 'Šroubek nebo kolík: v levém rameni otvor, v pravém drážka – ramena se při otevírání po sobě posouvají. Délka drážky vychází z největšího otevření.',
      rovny: 'Rovný čep roste z levého ramene. U otevřeného tisku se pravé rameno při skládání nasadí drážkou na čep; nic ho nejistí, ale napětí oka drží ramena na sobě.',
      zacvak: 'Čep s rozříznutou hlavou: při skládání se hlava stiskne, projde drážkou a zacvakne za rameno – ramena drží pohromadě. Jde u obou způsobů tisku.',
      cep: 'Čep s hlavou rozšířenou kuželem až k horní ploše – pravé rameno z něj nesklouzne ani se nenasadí, proto jen pro tisk sestavené pinzety.',
      volne: 'Ramena jsou v křížení nad sebou (rozdělení výšky níže) a po sobě jen kloužou – nic se nemůže zadřít, ale nic je nedrží pohromadě.',
    }[k.typ];
  }
  $('f_material').innerHTML = Object.entries(SPINZ.MATERIALY).map(([k, m]) => `<option value="${k}">${m.nazev}</option>`).join('');

  /* ---------- přepočet ---------- */
  function prepocitej() {
    p = app.p;
    nahled.barvy(css('--border-strong'), css('--border'), css('--text'));
    let H = SPINZ.kontroly(p);
    model = null; tiskDily = null; chybaStavby = chybaJadra;
    if (wasm && !SPINZ.odvozene(p).chyba) {
      try {
        model = SPINZ.postav(wasm, p);
        tiskDily = G3D.tiskoveRozlozeni(model.tisk, 1);
        H = H.concat(SPINZ.kontrolyModelu(p, model));
      } catch (e) { chybaStavby = 'Model nelze sestavit: ' + (e && e.message || e); }
    } else if (wasm) chybaStavby = 'Model nelze sestavit – opravte chybu v záložce Kontrola.';
    const st = $('stav3d');
    st.textContent = wasm || chybaJadra ? chybaStavby : 'Načítám geometrické jádro…';
    st.classList.toggle('chyba', !!chybaStavby);
    zobraz(false);
    app.hlaseni(H, { chybaStavby, boxy: ['boxTvar', 'boxCelisti'] });
    vypisVysledky();
    souhrny();
  }
  function souhrny() {
    const T = p.tvar, c = p.celist, k = p.kloub, N = SPINZ.NAZVY;
    TrubkyGui.souhrn('sTvar', `${fmt(T.delka)} mm · oko Ø ${fmt(T.oko)} · výška ${fmt(T.vyska)}`, true);
    TrubkyGui.souhrn('sPruz', `oko ${fmt(p.pruz.oko, 1)} · ramena ${fmt(p.pruz.rameno, 1)} mm${p.uchop.typ === 'ryhy' ? ` · ${p.uchop.pocet} rýh` : ''}`, true);
    TrubkyGui.souhrn('sCelist', `${N.spicka[c.spicka]} · ${fmt(c.delka)} mm · mezera ${fmt(c.mezera, 2)}–${fmt(c.mezera + c.sbihavost, 2)}`, true);
    TrubkyGui.souhrn('sVzor', N.vzor[c.vzor] + (['zoubky', 'vlnky', 'ryhy'].includes(c.vzor) ? ` · rozteč ${fmt(c.roztec, 1)}` : c.vzor === 'drazka' ? ` Ø ${fmt(c.drazka, 1)}` : ''), c.vzor !== 'hladke');
    TrubkyGui.souhrn('sKloub', ({ cep: `pojištěný čep Ø ${fmt(k.cep, 1)}`, rovny: `rovný čep Ø ${fmt(k.cep, 1)}`, zacvak: `zacvakávací čep Ø ${fmt(k.cep, 1)}`, vlastni: `vlastní čep Ø ${fmt(k.prumerCepu, 1)}`, volne: 'volné křížení' })[k.typ] + ` · dolní ${fmt(k.podil)} %`, true);
    TrubkyGui.souhrn('sPredpeti', (p.tisk.stav === 'otevrena' ? `otevřená, rozevřít o ${fmt(p.tisk.rozevreni)}°` : 'sestavená, bez předpětí') + (p.tisk.usi ? ' · uši' : ''), true);
  }
  const box = G3D.dlazdice;
  function vypisVysledky() {
    const el = $('vVysledky'), karta = $('karta3d');
    if (!model) { $('grafy').innerHTML = ''; el.innerHTML = box('Model', wasm || chybaJadra ? 'nelze sestavit' : 'načítám…', chybaStavby); karta.innerHTML = ''; $('vSit').innerHTML = ''; return; }
    const mat = SPINZ.MATERIALY[p.tisk.material], o = SPINZ.odvozene(p), d = model.dily[0], dt = model.tisk[0];
    const b = G3D.obal(d.poz), sx = b[3] - b[0], sy = b[4] - b[1], sz = b[5] - b[2];
    const bt = G3D.obal(dt.poz);
    const V = dt.objem * p.tisk.kusu, od = G3D.odhadTisku(V, mat.hustota, { dilu: p.tisk.kusu });
    let h = box('Rozměry složené', `${fmt(sx)} × ${fmt(sy)} × ${fmt(sz)} mm`, `při tisku ${fmt(bt[3] - bt[0])} × ${fmt(bt[4] - bt[1])} mm`);
    if (o.otevrena) {
      h += box('Síla na špičkách', `${fmt(o.sila, 2)} N`, `≈ ${fmt(o.sila / 9.81 * 1000, 0)} g · předpětí ze složení, ${mat.nazev}`, o.sila >= 0.15 ? '' : 'mez-t');
      h += box('Přetvoření oka', `${fmt(o.preth, 2)} %`, `při plném otevření ${fmt(o.prethMax, 2)} % · mez ${mat.nazev} ≈ ${fmt(mat.eps, 1)} %`,
        o.prethMax <= mat.eps ? 'ok-t' : o.preth <= mat.eps ? 'mez-t' : 'chyba-t');
    } else h += box('Síla na špičkách', '0 N', `sestavená bez předpětí, mezera ${fmt(p.celist.mezera, 2)} mm`);
    h += box('Síla stisku', `≈ ${fmt(o.silaStisku, 1)} N`, `na plné otevření ${fmt(p.kloub.otevreni)} mm, v půlce horních ramen`);
    h += box('Převod', `1 : ${fmt(o.paka, 1)}`, `stisk 1 mm otevře každou špičku asi o ${fmt(o.paka, 1)} mm`);
    h += box('Drážka kloubu', p.kloub.typ === 'volne' ? '–' : `${fmt(o.posun, 1)} mm`, `posun ramen v křížení při otevření ${fmt(p.kloub.otevreni)} mm`);
    h += box('Hmotnost', `${fmt(od.g, od.g < 10 ? 1 : 0)} g`, `${mat.nazev}, plný díl${p.tisk.kusu > 1 ? (p.tisk.kusu < 5 ? `, ${p.tisk.kusu} kusy` : `, ${p.tisk.kusu} kusů`) : ''}`);
    h += box('Filament', `${fmt(od.metru, 2)} m`, `průměr 1,75 mm · ${fmt(V / 1000, 2)} cm³`);
    h += box('Doba tisku', `≈ ${od.minut < 60 ? od.minut + ' min' : fmt(od.minut / 60, 1) + ' h'}`, 'hrubý odhad pro plný díl');
    el.innerHTML = h;
    grafy();
    const kb = stavZobr.tisk ? bt : stavZobr.rezim === 'otevrena' && zobrazene ? zobrazene : b;
    karta.innerHTML = `<div class="titul">${stavZobr.tisk ? 'Tiskový tvar' : stavZobr.rezim === 'otevrena' ? 'Rozevřená pinzeta' : 'Složená pinzeta'}</div><b>${fmt(kb[3] - kb[0])} × ${fmt(kb[4] - kb[1])} × ${fmt(sz)}</b> mm · <b>${fmt(od.g, 0)}</b> g ${mat.nazev}<br>`
      + (o.otevrena ? `špičky tlačí <b>${fmt(o.sila, 2)}</b> N · ` : '') + `${SPINZ.NAZVY.vzor[p.celist.vzor]}`;
    const k = KRAB.kontrolaSite(dt.poz, dt.idx);
    $('vSit').innerHTML = box('Síť – tiskový díl', k.uzavrena ? '✔ těsná' : '✖ netěsná', `${k.trojuhelniku} trojúhelníků, ${dt.teles === 1 ? '1 těleso' : dt.teles + ' tělesa'}, ${model.cas} ms`, k.uzavrena && dt.teles === 1 ? 'ok-t' : 'chyba-t');
  }

  /* ---------- grafy průběhu při otevírání (dva grafy – různé jednotky, žádná druhá osa) ---------- */
  function grafy() {
    const el = $('grafy'), pr = SPINZ.prubehSily(app.p, 24), mat = SPINZ.MATERIALY[app.p.tisk.material];
    el.innerHTML = '';
    if (pr.length < 2 || !(pr[pr.length - 1].otev > 0)) return;
    graf(el, pr, 'sila', 'Síla stisku podle otevření', 'N', 2, null);
    graf(el, pr, 'preth', 'Přetvoření oka podle otevření', '%', 2, { y: mat.eps, text: `mez ${mat.nazev} ${fmt(mat.eps, 1)} %` });
  }
  function graf(rodic, body, klic, nazev, jedn, des, mez) {
    const W = 300, H = 120, L = 34, Rr = 8, T = 8, Bm = 20;
    const xs = body.map(q => q.otev), ys = body.map(q => q[klic]);
    const xmax = xs[xs.length - 1], ymaxD = Math.max(...ys, mez ? mez.y : 0), ymax = ymaxD * 1.12 || 1;
    const X = x => L + (W - L - Rr) * x / xmax, Y = y => T + (H - T - Bm) * (1 - y / ymax);
    const ns = 'http://www.w3.org/2000/svg', box = document.createElement('div');
    box.className = 'graf';
    box.innerHTML = `<h3>${nazev}</h3>`;
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `${nazev}: od ${fmt(ys[0], des)} ${jedn} v klidu po ${fmt(ys[ys.length - 1], des)} ${jedn} při otevření ${fmt(xmax, 1)} mm`);
    let g = `<line class="osa" x1="${L}" y1="${Y(0)}" x2="${W - Rr}" y2="${Y(0)}"/>`
      + `<text class="popis-osy" x="${L - 4}" y="${Y(0) + 3}" text-anchor="end">0</text>`
      + `<text class="popis-osy" x="${L - 4}" y="${Y(ymaxD) + 3}" text-anchor="end">${fmt(ymaxD, des)}</text>`
      + `<line class="osa" x1="${L}" y1="${Y(ymaxD)}" x2="${W - Rr}" y2="${Y(ymaxD)}" opacity="0.5"/>`
      + `<text class="popis-osy" x="${L}" y="${H - 5}">0 mm</text>`
      + `<text class="popis-osy" x="${W - Rr}" y="${H - 5}" text-anchor="end">otevření ${fmt(xmax, 1)} mm</text>`;
    if (mez) g += `<line class="mez" x1="${L}" y1="${Y(mez.y)}" x2="${W - Rr}" y2="${Y(mez.y)}"/><text class="mez-popis" x="${W - Rr}" y="${Y(mez.y) - 4}" text-anchor="end">${mez.text}</text>`;
    g += `<polyline class="cara" points="${body.map(q => `${X(q.otev).toFixed(1)},${Y(q[klic]).toFixed(1)}`).join(' ')}"/>`
      + `<line class="kriz" id="k_${klic}" y1="${T}" y2="${Y(0)}" visibility="hidden"/><circle class="bod" id="b_${klic}" r="4" visibility="hidden"/>`
      + `<rect x="0" y="0" width="${W}" height="${H}" fill="transparent"/>`;
    svg.innerHTML = g;
    const tip = document.createElement('div'); tip.className = 'tip'; tip.hidden = true;
    box.append(svg, tip);
    rodic.appendChild(box);
    const kriz = svg.querySelector('.kriz'), bod = svg.querySelector('.bod');
    const ukaz = e => {
      const r = svg.getBoundingClientRect(), sx = (e.clientX - r.left) / r.width * W;
      let i = 0; for (let j = 1; j < body.length; j++) if (Math.abs(X(body[j].otev) - sx) < Math.abs(X(body[i].otev) - sx)) i = j;
      const q = body[i], px = X(q.otev), py = Y(q[klic]);
      kriz.setAttribute('x1', px); kriz.setAttribute('x2', px); kriz.setAttribute('visibility', 'visible');
      bod.setAttribute('cx', px); bod.setAttribute('cy', py); bod.setAttribute('visibility', 'visible');
      tip.hidden = false; tip.textContent = `${fmt(q.otev, 1)} mm → ${fmt(q[klic], des)} ${jedn}`;
      const rb = box.getBoundingClientRect();   // SVG nemá offsetLeft – poloha z obdélníků
      tip.style.left = (r.left - rb.left + px / W * r.width) + 'px'; tip.style.top = (r.top - rb.top + py / H * r.height - 6) + 'px';
    };
    svg.addEventListener('pointermove', ukaz);
    svg.addEventListener('pointerdown', ukaz);
    svg.addEventListener('pointerleave', () => { kriz.setAttribute('visibility', 'hidden'); bod.setAttribute('visibility', 'hidden'); tip.hidden = true; });
  }

  /* ---------- nabídky, export ---------- */
  TrubkyGui.pripoj({ klic: 'webapp_samosvorna_pinzeta_gui', pohled: j => nahled.pohled(j) });
  for (const v of SPINZ.PREDVOLBY) {
    const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
    b.innerHTML = `${v.nazev}<span class="pozn">${v.popis}</span>`;
    b.addEventListener('click', () => {
      const q = SPINZ.predvolba(v.id);
      q.kloub.vule = app.p.kloub.vule;
      const stav = v.p.tisk && v.p.tisk.stav ? v.p.tisk.stav : app.p.tisk.stav;   // způsob tisku mění jen předvolba, která ho určuje
      q.tisk = Object.assign(SPINZ.kopie(app.p.tisk), { stav });
      if (stav === 'sestavena' && q.celist.mezera < 2 * q.tisk.vrstva) q.celist.mezera = Math.max(0.4, 2 * q.tisk.vrstva);
      if (stav === 'otevrena' && q.kloub.typ === 'cep') q.kloub.typ = 'zacvak';
      app.nahrad(q);
    });
    $('seznamPredvoleb').appendChild(b);
  }
  function lzeExport() {
    if (!model) { Dialog.chyba(chybaStavby || 'Geometrické jádro se ještě načítá.'); return false; }
    return true;
  }
  const kusy = () => G3D.tiskoveRozlozeni(model.tisk, app.p.tisk.kusu);
  function exportStl() { if (lzeExport()) app.stahni(KRAB.stlBinarni(kusy(), 'samosvorna pinzeta - github_site'), app.jmeno('.stl'), 'model/stl'); }
  $('btnStl').addEventListener('click', exportStl);
  $('btn3mf').addEventListener('click', () => { if (lzeExport()) app.stahni(KRAB.soubor3mf(kusy(), app.p.nazev || 'Pinzeta'), app.jmeno('.3mf'), 'model/3mf'); });
  app.prepinac('tRez', h => { nahled.prepni('rez', h); $('legRez').hidden = !h; });
  app.prepinac('tHrany', h => nahled.prepni('hrany', h));
  app.prepinac('tPrevisy', h => { nahled.prepni('previsy', h); $('legPrevisy').hidden = !(h && stavZobr.tisk); }, true);
  app.prepinac('tPravitka', h => nahled.prepni('pravitka', h), true);
  app.prepinac('tTisk', h => {
    stavZobr.tisk = h;
    if (h) { stavZobr.rezim = 'tisk'; zastavAnimaci(); } else if (stavZobr.rezim === 'tisk') stavZobr.rezim = 'slozena';
    $('legPrevisy').hidden = !(h && nahled.stav.previsy);
    zobraz(true);
    vypisVysledky();
  });

  /* ---------- režim náhledu: složená / rozevřená (posuvník, animace) / tisk ---------- */
  /** Vykreslí model v aktuálním režimu; novyPohled = znovu vměstnat (jen při přepnutí na tisk a zpět). */
  function zobraz(novyPohled) {
    document.querySelectorAll('[data-rezim]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.rezim === stavZobr.rezim)));
    $('rezOtev').hidden = stavZobr.rezim !== 'otevrena';
    if (!model) { nahled.nastav(null); return; }
    const o = SPINZ.odvozene(app.p);
    $('popOtev').textContent = `${fmt(stavZobr.mira * app.p.kloub.otevreni, 1)} mm`;
    if (stavZobr.rezim === 'tisk') nahled.nastav(tiskDily, { tisk: true, novyPohled, uhel: app.p.tisk.uhel });
    else if (stavZobr.rezim === 'otevrena') {
      const d = SPINZ.prevedCasti(app.p, model.casti, -o.eps * stavZobr.mira);
      nahled.nastav(d, { novyPohled });
      zobrazene = d.reduce((B, x) => { const q = G3D.obal(x.poz); for (let i = 0; i < 3; i++) { B[i] = Math.min(B[i], q[i]); B[i + 3] = Math.max(B[i + 3], q[i + 3]); } return B; }, [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]);
      $('rozsahOtev').setAttribute('aria-valuetext', `otevření ${fmt(stavZobr.mira * app.p.kloub.otevreni, 1)} mm`);
    }
    else nahled.nastav(model.dily, { novyPohled });
  }
  function nastavRezim(r) {
    if (r !== 'otevrena') zastavAnimaci();
    const tisk = $('tTisk').getAttribute('aria-pressed') === 'true';
    if ((r === 'tisk') !== tisk) { stavZobr.rezim = r; $('tTisk').click(); return; }   // přepínač tiskové polohy zavolá zobraz
    stavZobr.rezim = r;
    zobraz(false); vypisVysledky();
  }
  document.querySelectorAll('[data-rezim]').forEach(b => b.addEventListener('click', () => nastavRezim(b.dataset.rezim)));
  $('rozsahOtev').addEventListener('input', e => { zastavAnimaci(); stavZobr.mira = e.target.value / 100; zobraz(false); });
  function zastavAnimaci() { if (stavZobr.anim) cancelAnimationFrame(stavZobr.anim); stavZobr.anim = 0; $('btnAnim').setAttribute('aria-pressed', 'false'); $('btnAnim').textContent = '▶'; $('btnAnim').setAttribute('aria-label', 'Spustit animaci otevírání'); }
  $('btnAnim').addEventListener('click', () => {
    if (stavZobr.anim) { zastavAnimaci(); return; }
    $('btnAnim').setAttribute('aria-pressed', 'true'); $('btnAnim').textContent = '⏸'; $('btnAnim').setAttribute('aria-label', 'Zastavit animaci');
    const t0 = performance.now();
    let posledni = 0;
    const krok = t => {
      stavZobr.anim = requestAnimationFrame(krok);
      if (t - posledni < 50) return;   // nejvýš ~20 snímků/s – každý snímek staví geometrii i hrany znovu
      posledni = t;
      stavZobr.mira = (1 - Math.cos((t - t0) / 1600 * Math.PI)) / 2;
      $('rozsahOtev').value = Math.round(stavZobr.mira * 100);
      zobraz(false);
    };
    stavZobr.anim = requestAnimationFrame(krok);
  });

  /* ---------- start ---------- */
  app.start({
    manifold: {
      ok: w => { wasm = w; prepocitej(); },
      chyba: e => { chybaJadra = 'Geometrické jádro (manifold-3d) se nenačetlo: ' + (e && e.message || e) + ' – model ani export nejsou k dispozici.'; prepocitej(); },
    },
  });
  window.SPINZ_UI = { get p() { return app.p; }, get model() { return model; }, zmen: app.zmen, nahrad: app.nahrad, prepocitej, nahled, app };
})();

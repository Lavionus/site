/* Šoupě do odsávání – ovládání stránky nad společným zapojením gen3d/aplikace.js
   (tady jen to, co je pro šoupě a klapku zvláštní: viditelnost polí, rozměry trubek, souhrny, výsledky, proudění,
   kusovník, režimy náhledu, poloha otevřeno/zavřeno, export po dílech, výkres). Náhled = KNOF_NAHLED. */
/* global SOUPE, SOUPE_VYK, KNOF_NAHLED, KRAB, G3D, Dialog, TrubkyGui */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const fmt = SOUPE.fmt;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  let p, wasm = null, model = null, chybaStavby = '', chybaJadra = '', proud = null, o = null;
  const stavZobr = { rezim: 'sestava', otevreno: false };
  const nahled = KNOF_NAHLED.vytvorNahled($('platno'), { drzPohled: true });

  const app = G3D.aplikace({
    typ: 'soupe', nazev: 'Šoupě do odsávání', klic: 'webapp_soupe', soubor: 'soupe',
    normalizuj: SOUPE.normalizuj, vychozi: () => SOUPE.predvolba('soupe100'),
    ulozProjekt: SOUPE.ulozProjekt, nactiProjekt: SOUPE.nactiProjekt, popis: SOUPE.popis,
    vezmi: SOUPE.vezmi, poloz: SOUPE.poloz,
    viditelnost: () => viditelnost(),
    prepocitej: () => prepocitej(),
    png: () => nahled.png(), pohled: j => nahled.pohled(j),
    exportStl: () => exportVse('stl'),
    doModelare: () => (lzeExport() ? { data: KRAB.soubor3mf(kusy(dilyKTisku()), app.p.nazev || 'Soupe'), pripona: '.3mf' } : null),
    zkratky: { r: 'tRez', h: 'tHrany', m: 'tTisk', p: 'tPrevisy', l: 'tPravitka', o: 'tOtevreno', w: 'btnVykres' },
    diry: true,
    cilPole: c => (c === 'druh' ? $('paletaDruhu') : null),
    zmenaTematu: () => prepocitej(),
  });

  const seznam = a => (a || '').split(/\s+/).filter(Boolean);
  const klapka = () => app.p.druh === 'klapka';
  function viditelnost() {
    p = app.p;
    document.querySelectorAll('[data-k1],[data-k2],[data-druhy],[data-aretace],[data-tesneni],[data-spinac]').forEach(el => {
      const d = el.dataset;
      let vid = true;
      if (d.k1 && !seznam(d.k1).includes(p.k1.spoj)) vid = false;
      if (d.k2 && !seznam(d.k2).includes(p.k2.spoj)) vid = false;
      if (d.druhy && !seznam(d.druhy).includes(p.druh)) vid = false;
      if (d.aretace && !p.soupatko.aretace) vid = false;
      if (d.tesneni && p.tesneni.typ === 'zadne') vid = false;
      if (d.spinac && !seznam(d.spinac).includes(p.spinac.typ)) vid = false;
      el.hidden = !vid;
    });
    const napKonce = k => ({
      na: 'Trubka se zasune do hrdla až na doraz. Se zadaným ID trubky navazuje průchod bez schodu.',
      do: 'Hrdlo se zasune do trubky nebo hadice; hadici zajistěte sponou. Kónus ji zaklíní.',
      priruba: 'Příruba s dírami na roztečné kružnici; pod ní jsou vybrání pro matice. Přišroubujte s těsněním.',
    }[k.spoj]);
    $('napK1').textContent = napKonce(p.k1);
    $('napK2').textContent = napKonce(p.k2);
    $('nadpisUzaveru').textContent = klapka() ? 'Klapka' : 'Šoupě';
    $('napDruh').textContent = klapka()
      ? 'Otočný disk na osmihranné hřídeli; těleso se tiskne nastojato. Kratší a ovládá se pákou, otevřená klapka ale trochu brzdí proud.'
      : 'Posuvné šoupátko mezi dvěma polovinami tělesa; vše se tiskne naplocho. Otevřené šoupě skoro nebrzdí a zavřené dobře těsní.';
    $('napTisk').textContent = klapka()
      ? (p.diry === 'kruh'
        ? 'Těleso klapky se tiskne nastojato (hrdlem 1 dolů) – díry pro hřídel jsou kruhové a jejich strop převisá: tiskněte s podporou uvnitř díry, nebo v 👁 Zobrazení zapněte 💧 Díry jako kapka. Náboje mají zespodu 45°. Disk a páka naplocho, hřídel naležato. Doporučeno PETG nebo ASA, 3–4 perimetry. Kalibrační destička ověří vůli hřídele: vyberte díru, ve které se hřídel točí lehce a neviklá.'
        : 'Těleso klapky se tiskne nastojato (hrdlem 1 dolů) – díry pro hřídel mají tvar kapky a náboje zespodu 45°, nic nepotřebuje podporu. Disk a páka naplocho, hřídel naležato. Doporučeno PETG nebo ASA, 3–4 perimetry. Kalibrační destička ověří vůli hřídele: vyberte díru, ve které se hřídel točí lehce a neviklá.')
      : 'Poloviny se tisknou vnitřní plochou dolů (hrdlo nahoru), lišty a šoupátko naplocho – bez podpor. Doporučeno PETG nebo ASA, 3 perimetry. Šoupátko a lišty tiskněte stejnou výškou vrstvy – jejich tloušťky určují vůli. Kalibrační vzorek: proužek šoupátka zkuste v tunýlcích 1–5 a vůli toho, kterým jde lehce a neklepe, zapište do pole Vůle.';
    document.querySelectorAll('.nabidka [data-druh]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.druh === p.druh)));
    document.querySelectorAll('#paletaDruhu [data-druh]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.druh === p.druh)));
    const db = document.querySelectorAll('.db-trubek');
    db.forEach(s => { s.value = ''; });
  }
  $('f_material').innerHTML = Object.entries(SOUPE.MATERIALY).map(([k, m]) => `<option value="${k}">${m.nazev}</option>`).join('');
  document.querySelectorAll('.db-trubek').forEach(s => {
    s.innerHTML = `<option value="">— vybrat (typické, ${SOUPE.DATUM_TRUBEK}) —</option>` + SOUPE.TRUBKY.map(t => `<option value="${t.kod}">${esc(t.nazev)}</option>`).join('');
    s.addEventListener('change', () => {
      const t = SOUPE.TRUBKY.find(x => x.kod === s.value), k = s.dataset.konec;
      if (!t) return;
      app.zmen(q => { q[k].spoj = t.spoj; q[k].od = t.od; q[k].id = t.id; });
      app.naplnFormular();
      s.value = '';
    });
  });

  /* ---------- přepočet ---------- */
  function prepocitej() {
    p = app.p;
    nahled.barvy(css('--border-strong'), css('--border'), css('--text'));
    let H = SOUPE.kontroly(p);
    o = SOUPE.odvozene(p);
    model = null; chybaStavby = chybaJadra; proud = null;
    const chyby = H.some(h => h.uroven === 'chyba');
    if (wasm && !o.chyba) {
      try {
        model = SOUPE.postav(wasm, p, { kalibrace: stavZobr.rezim === 'kalibrace' || p.tisk.kalibrace });
        H = H.concat(SOUPE.kontrolyModelu(p, model));
      } catch (e) { chybaStavby = 'Model nelze sestavit: ' + (e && e.message || e); }
    } else if (wasm) chybaStavby = 'Model nelze sestavit – opravte chybu v záložce Kontrola.';
    void chyby;
    if (!o.chyba) proud = SOUPE.proudeni(p, o);
    if (proud) H = H.concat(hlaseniProudeni());
    const st = $('stav3d');
    st.textContent = wasm || chybaJadra ? chybaStavby : 'Načítám geometrické jádro…';
    st.classList.toggle('chyba', !!chybaStavby);
    zobraz(false);
    app.hlaseni(H, { chybaStavby, boxy: ['boxHrdla', 'boxUzaver'] });
    souhrny();
    vypisVysledky();
    vypisProudeni();
    vypisKusovnik();
    seznamDilu();
  }
  /** Hlášení z proudění (celé věty kvůli překladu). */
  function hlaseniProudeni() {
    const H = [];
    if (proud.vt < 15) H.push({ uroven: 'info', pole: ['proud.prutok'], text: `Vzduch v trubce proudí ${fmt(proud.vt, 1)} m/s – pod dopravní rychlostí prach a třísky usedají v potrubí. Pro 18–25 m/s je potřeba ${fmt(proud.prutok18, 0)}–${fmt(proud.prutok25, 0)} m³/h.` });
    if (proud.vt > 30) H.push({ uroven: 'info', pole: ['proud.prutok'], text: `Vzduch v trubce proudí ${fmt(proud.vt, 1)} m/s – zbytečně velké ztráty a hluk; na tento průtok se hodí širší potrubí.` });
    return H;
  }
  function souhrny() {
    const k = q => (q.spoj === 'priruba' ? `příruba Ø ${fmt(q.priruba)} · ${q.der} díry`
      : q.spoj === 'na' ? (q.id > 0 ? `na trubku Ø ${fmt(q.od)} × ${fmt(q.id)}` : `na trubku Ø ${fmt(q.od)}`)
        : (q.kuzel > 0 ? `do Ø ${fmt(q.id)} · kónus ${fmt(q.kuzel)}` : `do Ø ${fmt(q.id)}`));
    TrubkyGui.souhrn('sK1', k(p.k1), true);
    TrubkyGui.souhrn('sK2', k(p.k2), true);
    TrubkyGui.souhrn('sTvar', `stěna ${fmt(p.tvar.stena)} · vůle ${fmt(p.tvar.vule, 2)}`, true);
    TrubkyGui.souhrn('sDruh', SOUPE.NAZVY.druh[p.druh], true);
    TrubkyGui.souhrn('sTeleso', `deska ${fmt(p.teleso.deska)} · ${p.teleso.sroub}`, true);
    TrubkyGui.souhrn('sSoupatko', p.soupatko.aretace ? `${fmt(p.soupatko.tl, 2)} + vůle ${fmt(p.soupatko.vule, 2)} · aretace` : `${fmt(p.soupatko.tl, 2)} + vůle ${fmt(p.soupatko.vule, 2)}`, true);
    TrubkyGui.souhrn('sTesneni', `${SOUPE.NAZVY.tesneni[p.tesneni.typ]} · ${SOUPE.NAZVY.spinac[p.spinac.typ]}`, p.tesneni.typ !== 'zadne' || p.spinac.typ !== 'zadny');
    TrubkyGui.souhrn('sKlapka', `disk ${fmt(p.klapka.disk, 1)} · hřídel ${fmt(p.klapka.hridel)} · páka ${fmt(p.klapka.paka)}`, true);
    if (o.chyba) { ['napTeleso', 'napSoupatko', 'napSpinac', 'napKlapka'].forEach(i => { $(i).textContent = ''; }); return; }
    if (!klapka()) {
      $('napTeleso').textContent = `Těleso ${fmt(o.Wt, 0)} × ${fmt(o.H, 0)} mm, ${o.srouby.length} šroubů ${o.sroub.nazev} × ${o.sroubDelka.L || o.sroubDelka.nejbliz} mm (hlavy v polovině 1, matice v polovině 2).`;
      $('napSoupatko').textContent = p.soupatko.aretace
        ? `Mezera ${fmt(o.g, 2)} mm, zdvih ${fmt(o.zdvih, 0)} mm. Aretace drží asi ${fmt(o.silaAretace, 1)} N, pružina se prohne o ${fmt(o.pretvoreni, 2)} %.`
        : `Mezera ${fmt(o.g, 2)} mm, zdvih ${fmt(o.zdvih, 0)} mm. Bez aretace drží šoupátko jen třením.`;
      $('napSpinac').textContent = p.spinac.typ === 'kontakt'
        ? 'Magnet se vlepí do kapsy v šoupátku, jazýčkový kontakt do štěrbiny v horní příčce pravé lišty, vývody vedou kanálkem nahoru. Kontakt sepne, když je otevřeno.'
        : p.spinac.typ === 'magnet' ? 'Kapsa na magnet v šoupátku – pro vlastní snímač (Hallova sonda, kontakt zvenku).' : 'Filcový pásek v drážce dosedne na šoupátko a utěsní zavřenou polohu.';
    } else {
      const hrdloVlozeni = o.Rpruchod === Math.min(o.h1.ri, o.Rk) ? 1 : 2;
      $('napKlapka').textContent = `Disk Ø ${fmt(2 * o.Rd, 2)} mm, díra hřídele Ø ${fmt(2 * o.rl, 2)} mm, hřídel ${fmt(o.dh)} × ${fmt(o.Lsh, 0)} mm. Disk se vkládá nastojato hrdlem ${hrdloVlozeni}.`;
    }
  }
  const box = (a, b, c, d) => G3D.dlazdice(a, b, c, d);
  function dilyKTisku() { return model ? model.tisk.concat(p.tisk.kalibrace ? model.kalibrace : []) : []; }
  function vypisVysledky() {
    const el = $('vVysledky'), karta = $('karta3d');
    if (!model) { el.innerHTML = box('Model', wasm || chybaJadra ? 'nelze sestavit' : 'načítám…', chybaStavby); karta.innerHTML = ''; $('vSit').innerHTML = ''; return; }
    const mat = SOUPE.MATERIALY[p.tisk.material], dily = dilyKTisku(), V = dily.reduce((s, d) => s + d.objem, 0);
    const od = G3D.odhadTisku(V, mat.hustota, { dilu: dily.length });
    let h = box('Průchod', `Ø ${fmt(2 * o.R, 1)} mm`, `průřez ${fmt(Math.PI * o.R * o.R / 100, 1)} cm²`);
    h += box('Stavební délka', `${fmt(o.stavebni, 1)} mm`, 'po ose od ústí k ústí hrdel');
    if (!klapka()) {
      h += box('Těleso', `${fmt(o.Wt, 0)} × ${fmt(o.H, 0)} mm`, `tloušťka bez hrdel ${fmt(2 * p.teleso.deska + o.g, 1)} mm`);
      h += box('Šoupátko', `${fmt(o.Wd, 0)} × ${fmt(o.delkaSoupatka, 0)} × ${fmt(p.soupatko.tl, 2)}`, `zdvih ${fmt(o.zdvih, 0)} mm · mezera ${fmt(o.g, 2)} mm`);
      if (p.soupatko.aretace) {
        const mez = mat.eps * 0.5;
        h += box('Aretace', `≈ ${fmt(o.silaAretace, 1)} N`, `pružina ${fmt(p.soupatko.pruzina)} × ${fmt(p.soupatko.sirkaPruziny, 1)} mm, prohnutí ${fmt(o.pretvoreni, 2)} % (mez ${fmt(mez, 1)} %)`, o.pretvoreni <= mez ? 'ok-t' : 'chyba-t');
      }
      h += box('Šrouby', `${o.srouby.length} × ${o.sroub.nazev} × ${o.sroubDelka.L || o.sroubDelka.nejbliz}`, o.sroubDelka.L ? `kapsa hlavy ${fmt(o.sroubDelka.cb, 1)} mm, matice ${fmt(o.sroubDelka.np, 1)} mm` : 'délka nesedí – viz Kontrola', o.sroubDelka.L ? '' : 'mez-t');
    } else {
      h += box('Těleso', `Ø ${fmt(2 * Math.max(o.Rc, o.h1.ro, o.h2.ro), 0)} × ${fmt(o.stavebni, 0)} mm`, `komora ${fmt(o.Lk, 0)} mm, náboje hřídele po stranách`);
      h += box('Disk', `Ø ${fmt(2 * o.Rd, 2)} × ${fmt(p.klapka.disk, 1)}`, `mezera ke stěně ${fmt(o.Rk - o.Rd, 2)} mm`);
      h += box('Hřídel', `${fmt(o.dh)} × ${fmt(o.Lsh, 0)} mm`, `osmihran, díra Ø ${fmt(2 * o.rl, 2)} mm`);
    }
    if (proud) h += box('Ztráta otevřeného', tlak(proud.celkem), `při ${fmt(proud.Q, 0)} m³/h · trubka stejné délky ${tlak(proud.trubka)}`);
    h += box('Hmotnost', `${fmt(od.g, 0)} g`, `${mat.nazev}, plné díly`);
    h += box('Filament', `${fmt(od.metru, 1)} m`, `průměr 1,75 mm · ${fmt(V / 1000, 1)} cm³`);
    h += box('Doba tisku', `≈ ${od.minut < 60 ? od.minut + ' min' : fmt(od.minut / 60, 1) + ' h'}`, `${dily.length} dílů · hrubý odhad`);
    el.innerHTML = h;
    const titul = klapka() ? (stavZobr.otevreno ? 'Klapka · otevřeno' : 'Klapka · zavřeno') : (stavZobr.otevreno ? 'Šoupě · otevřeno' : 'Šoupě · zavřeno');
    karta.innerHTML = `<div class="titul">${titul}</div>průchod <b>Ø ${fmt(2 * o.R, 0)}</b> · délka <b>${fmt(o.stavebni, 0)}</b> mm<br>${dily.length} dílů · <b>${fmt(od.g, 0)}</b> g ${mat.nazev}`;
    const kont = model.tisk.map(d => ({ d, k: KRAB.kontrolaSite(d.poz, d.idx) }));
    $('vSit').innerHTML = kont.map(({ d, k }) => box('Síť – ' + d.nazev, k.uzavrena && d.teles === 1 ? '✔ těsná' : '✖ netěsná', d.teles === 1 ? `${k.trojuhelniku} trojúhelníků, 1 těleso` : `${k.trojuhelniku} trojúhelníků, ${d.teles} tělesa`, k.uzavrena && d.teles === 1 ? 'ok-t' : 'chyba-t')).join('')
      + box('Stavba', `${model.cas} ms`, 'manifold-3d');
  }
  function vypisKusovnik() {
    const el = $('kusovnik');
    if (!model) { el.innerHTML = ''; return; }
    const mat = SOUPE.MATERIALY[p.tisk.material], dily = dilyKTisku();
    el.innerHTML = `<table class="tabulka"><thead><tr><th>Díl (tisk)</th><th class="c">Kusů</th><th class="c">Rozměr</th><th class="c">Hmotnost</th></tr></thead><tbody>`
      + dily.map(d => { const b = G3D.obal(d.poz); return `<tr><td>${esc(d.nazev)}</td><td class="c">1</td><td class="c">${fmt(b[3] - b[0], 1)} × ${fmt(b[4] - b[1], 1)} × ${fmt(b[5] - b[2], 1)}</td><td class="c">${fmt(d.objem / 1000 * mat.hustota, 0)} g</td></tr>`; }).join('')
      + `</tbody></table><table class="tabulka"><thead><tr><th>Nakoupit</th><th class="c">Kusů</th></tr></thead><tbody>`
      + SOUPE.nakup(p, o).map(([n, ks]) => `<tr><td>${esc(n)}</td><td class="c">${ks}</td></tr>`).join('') + '</tbody></table>';
  }

  /* ---------- proudění ---------- */
  const tlak = Pa => (Pa < 10000 ? `${fmt(Pa, Pa < 10 ? 1 : 0)} Pa` : `${fmt(Pa / 1000, 1)} kPa`);
  function vypisProudeni() {
    const el = $('vProud'), gr = $('grafProud'), tab = $('tabZtrat');
    if (!proud) { el.innerHTML = box('Proudění', '–', o && o.chyba ? 'opravte rozměry hrdel' : 'zadejte průtok'); gr.hidden = true; tab.innerHTML = ''; return; }
    let h = box('Rychlost v trubce', `${fmt(proud.vt, 1)} m/s`, `dopravní rychlost 18–25 m/s`, proud.vt >= 18 && proud.vt <= 25 ? 'ok-t' : 'mez-t');
    h += box('Rychlost v uzávěru', `${fmt(proud.vg, 1)} m/s`, `Re ${fmt(proud.Re, 0)}`);
    h += box('Ztráta otevřeného', tlak(proud.celkem), `ζ ${fmt(proud.zeta, 2)} (k rychlosti v uzávěru)`);
    h += box('Rovná trubka stejné délky', tlak(proud.trubka), `uzávěr navíc ${tlak(Math.max(0, proud.navic))}`);
    h += box('Odpovídá trubce', `${fmt(proud.ekvDelka, 2)} m`, 'ekvivalentní délka rovné trubky');
    h += box('Doporučený průtok', `${fmt(proud.prutok18, 0)}–${fmt(proud.prutok25, 0)} m³/h`, 'pro 18–25 m/s v trubce');
    h += box('Netěsnost zavřeného', `≈ ${fmt(proud.unik, proud.unik < 10 ? 1 : 0)} m³/h`, `při podtlaku ${tlak(p.proud.podtlak)} · řádový odhad`);
    if (!klapka()) h += box('Přítlak šoupátka', `${fmt(proud.silaS, 1)} N`, `vytažení pod podtlakem ≈ ${fmt(proud.silaVytazeni, 1)} N (tření 0,3)`);
    el.innerHTML = h;
    tab.innerHTML = '<thead><tr><th>Část</th><th class="c">Ztráta</th><th>Poznámka</th></tr></thead><tbody>'
      + proud.polozky.map(x => `<tr><td>${esc(x.nazev)}</td><td class="c">${tlak(x.dp)}</td><td>${esc(x.pozn)}</td></tr>`).join('') + '</tbody>';
    // graf ztráty podle průtoku: uzávěr a rovná trubka
    const Qmax = Math.max(p.proud.prutok * 1.6, proud.prutok25 * 1.1, 1);
    const body = SOUPE.krivka(p, o, Qmax, 30);
    gr.hidden = false;
    const W = 320, Hh = 130, L0 = 44, Rr = 8, T0 = 8, B0 = 20, ymax = Math.max(...body.map(b => b.dp), 1) * 1.1;
    const X = q => L0 + (W - L0 - Rr) * q / Qmax, Y = d => T0 + (Hh - T0 - B0) * (1 - d / ymax), qn = p.proud.prutok;
    gr.innerHTML = `<h3>Ztráta otevřeného uzávěru podle průtoku (plná) a rovné trubky stejné délky (čárkovaná)</h3><svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Ztráta při ${fmt(qn, 0)} m³/h: ${tlak(proud.celkem)}">`
      + `<line class="osa" x1="${L0}" y1="${Y(0)}" x2="${W - Rr}" y2="${Y(0)}"/><line class="osa" x1="${L0}" y1="${T0}" x2="${L0}" y2="${Y(0)}"/>`
      + `<text class="popis-osy" x="${L0 - 4}" y="${Y(0) + 3}" text-anchor="end">0</text><text class="popis-osy" x="${L0 - 4}" y="${T0 + 8}" text-anchor="end">${tlak(ymax / 1.1)}</text>`
      + `<text class="popis-osy" x="${L0}" y="${Hh - 5}">0 m³/h</text><text class="popis-osy" x="${W - Rr}" y="${Hh - 5}" text-anchor="end">${fmt(Qmax, 0)} m³/h</text>`
      + [proud.prutok18, proud.prutok25].map(q => (q < Qmax ? `<line class="mez" x1="${X(q)}" y1="${T0}" x2="${X(q)}" y2="${Y(0)}"/>` : '')).join('')
      + `<polyline class="cara" points="${body.map(b => `${X(b.Q).toFixed(1)},${Y(b.dp).toFixed(1)}`).join(' ')}"/>`
      + `<polyline class="cara" style="stroke-dasharray:4 3;opacity:.6" points="${body.map(b => `${X(b.Q).toFixed(1)},${Y(b.trubka).toFixed(1)}`).join(' ')}"/>`
      + (qn > 0 && qn <= Qmax ? `<circle class="bod" r="4" cx="${X(qn).toFixed(1)}" cy="${Y(proud.celkem).toFixed(1)}"/>` : '') + '</svg>';
  }

  /* ---------- náhled ---------- */
  function sestava() {
    const poloha = stavZobr.otevreno ? 'otevreno' : 'zavreno', s = model.sestava(poloha);
    if (stavZobr.rezim !== 'rozlozene') return s;
    // rozložené: díly odsunuté podél osy (šoupě) / hřídel a páka do stran (klapka)
    const posun = klapka() ? [[0, 0, 0], [0, 0, 0], [-o.Lsh * 0.6, 0, 0], [o.Lsh * 0.35, 0, 0]] : [[0, 0, -o.R * 0.7], [0, 0, o.R * 0.7], [-8, 0, -o.R * 0.25], [8, 0, -o.R * 0.25], [0, 0, 0]];
    return s.map((d, i) => Object.assign({}, d, { poz: SOUPE.transformuj(d.poz, (x, y, z) => [x + posun[i][0], y + posun[i][1], z + posun[i][2]]) }));
  }
  function zobraz(novyPohled) {
    document.querySelectorAll('[data-rezim]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.rezim === stavZobr.rezim)));
    document.querySelectorAll('[data-poloha]').forEach(b => b.setAttribute('aria-pressed', String(stavZobr.otevreno)));
    if (!model) { nahled.nastav(null); return; }
    const r = stavZobr.rezim;
    if (r === 'tisk') nahled.nastav(G3D.tiskoveRozlozeni(dilyKTisku(), 1, 8, p.tisk.podlozka), { tisk: true, novyPohled, uhel: p.tisk.uhel });
    else if (r === 'kalibrace') nahled.nastav(G3D.tiskoveRozlozeni(model.kalibrace, 1, 6, 160), { tisk: true, novyPohled, uhel: p.tisk.uhel });
    else nahled.nastav(sestava(), { novyPohled });
    $('legPrevisy').hidden = !((r === 'tisk' || r === 'kalibrace') && nahled.stav.previsy);
  }
  function nastavRezim(r) {
    const tisk = $('tTisk').getAttribute('aria-pressed') === 'true';
    const predchozi = stavZobr.rezim;
    stavZobr.rezim = r;
    const chybiKal = () => r === 'kalibrace' && model && !model.kalibrace.length;   // vzorek se staví jen na požádání
    if ((r === 'tisk') !== tisk) { $('tTisk').click(); if (!chybiKal()) return; }
    if (chybiKal()) { prepocitej(); return; }
    zobraz(predchozi !== r);
    if (model) vypisVysledky();
  }
  document.querySelectorAll('[data-rezim]').forEach(b => b.addEventListener('click', () => nastavRezim(b.dataset.rezim)));
  document.querySelectorAll('[data-poloha]').forEach(b => b.addEventListener('click', () => $('tOtevreno').click()));

  /* ---------- nabídky, export ---------- */
  TrubkyGui.pripoj({ klic: 'webapp_soupe_gui', pohled: j => nahled.pohled(j) });
  for (const v of SOUPE.PREDVOLBY) {
    const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
    b.innerHTML = `${esc(v.nazev)}<span class="pozn">${esc(v.popis)}</span>`;
    b.addEventListener('click', () => {
      const q = SOUPE.predvolba(v.id);
      q.tisk = SOUPE.kopie(app.p.tisk); q.proud = SOUPE.kopie(app.p.proud);
      app.nahrad(q);
      nahled.pohled('iso');
    });
    $('seznamPredvoleb').appendChild(b);
  }
  document.querySelectorAll('[data-druh]').forEach(b => b.addEventListener('click', () => {
    app.zmen(q => { q.druh = b.dataset.druh; });
    app.naplnFormular();
    nahled.pohled('iso');
  }));
  function lzeExport() {
    if (!model) { Dialog.chyba(chybaStavby || 'Geometrické jádro se ještě načítá.'); return false; }
    return true;
  }
  const kusy = dily => G3D.tiskoveRozlozeni(dily, 1, 8, app.p.tisk.podlozka);
  function exportVse(druh) {
    if (!lzeExport()) return;
    if (druh === 'stl') app.stahni(KRAB.stlBinarni(kusy(dilyKTisku()), 'soupe - github_site'), app.jmeno('.stl'), 'model/stl');
    else app.stahni(KRAB.soubor3mf(kusy(dilyKTisku()), app.p.nazev || 'Soupe'), app.jmeno('.3mf'), 'model/3mf');
  }
  $('btnStl').addEventListener('click', () => exportVse('stl'));
  $('btn3mf').addEventListener('click', () => exportVse('3mf'));
  /** Položky „STL – jen …“ podle dílů aktuálního druhu. */
  let dilyNabidky = '';
  function seznamDilu() {
    if (!model) return;
    const klic = model.tisk.map(d => d.jmeno).join('|');
    if (klic === dilyNabidky) return;
    dilyNabidky = klic;
    $('seznamDilu').innerHTML = model.tisk.map(d => `<button class="pol" role="menuitem" data-dil="${esc(d.jmeno)}">⬇ STL – ${esc(d.nazev)}</button>`).join('');
  }
  $('seznamDilu').addEventListener('click', e => {
    const b = e.target.closest('[data-dil]');
    if (!b || !lzeExport()) return;
    const d = model.tisk.find(x => x.jmeno === b.dataset.dil);
    if (d) app.stahni(KRAB.stlBinarni(kusy([d]), 'soupe - ' + d.jmeno), app.jmeno('_' + d.jmeno + '.stl'), 'model/stl');
  });
  document.querySelectorAll('[data-export]').forEach(b => b.addEventListener('click', () => {
    if (!lzeExport()) return;
    if (!model.kalibrace.length) {
      try { model = SOUPE.postav(wasm, app.p, { kalibrace: true }); } catch (e) { Dialog.chyba('Kalibrační vzorek nelze sestavit: ' + (e && e.message || e)); return; }
    }
    app.stahni(KRAB.stlBinarni(G3D.tiskoveRozlozeni(model.kalibrace, 1, 6, 160), 'soupe - kalibrace'), app.jmeno('_kalibrace.stl'), 'model/stl');
  }));

  /* ---------- výkres ---------- */
  function vykresTed() {
    if (!lzeExport()) return null;
    const mat = SOUPE.MATERIALY[app.p.tisk.material], d = new Date();
    const kus = model.tisk.map(x => [x.nazev, 1]);
    return SOUPE_VYK.vykres(app.p, o, {
      datum: `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`, kusovnik: kus, material: mat.nazev,
      hmotnost: model.tisk.reduce((s, x) => s + x.objem, 0) * mat.hustota / 1000,
      dp: proud ? `${tlak(proud.celkem)} při ${fmt(proud.Q, 0)} m³/h` : '',
    });
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
  function ukazVykres() { const v = vykresTed(); if (!v) return; $('vykresObsah').innerHTML = SOUPE_VYK.svg(v); if (!$('vykresDlg').open) $('vykresDlg').showModal(); }
  function vykresSvg() { const v = vykresTed(); if (v) app.stahni(SOUPE_VYK.svg(v), app.jmeno('_vykres.svg'), 'image/svg+xml'); }
  async function vykresPdf() {
    const v = vykresTed(); if (!v) return;
    try {
      if (!window.jspdf) throw new Error('Knihovna jsPDF se nenačetla.');
      const pismo = await nactiPismo();
      const doc = SOUPE_VYK.pdf(window.jspdf.jsPDF, v, { pismo, nazev: app.p.nazev || 'Šoupě' });
      app.stahni(doc.output('blob'), app.jmeno('_vykres.pdf'));
      if (!pismo) Dialog.info('Písmo se nepodařilo načíst – PDF je bez diakritiky.');
    } catch (e) { Dialog.chyba('PDF se nepodařilo vytvořit: ' + (e && e.message || e)); }
  }
  $('btnVykres').addEventListener('click', ukazVykres);
  $('btnVykresSvg').addEventListener('click', vykresSvg); $('btnVykresSvg2').addEventListener('click', vykresSvg);
  $('btnVykresPdf').addEventListener('click', vykresPdf); $('btnVykresPdf2').addEventListener('click', vykresPdf);
  $('btnZavritVyk').addEventListener('click', () => $('vykresDlg').close());

  app.prepinac('tRez', h => { nahled.prepni('rez', h); $('legRez').hidden = !h; });
  app.prepinac('tHrany', h => nahled.prepni('hrany', h));
  app.prepinac('tPrevisy', h => { nahled.prepni('previsy', h); $('legPrevisy').hidden = !(h && (stavZobr.rezim === 'tisk' || stavZobr.rezim === 'kalibrace')); }, true);
  app.prepinac('tPravitka', h => nahled.prepni('pravitka', h), true);
  app.prepinac('tOtevreno', h => {
    stavZobr.otevreno = h;
    if (stavZobr.rezim === 'tisk' || stavZobr.rezim === 'kalibrace') { stavZobr.rezim = 'sestava'; if ($('tTisk').getAttribute('aria-pressed') === 'true') { $('tTisk').click(); return; } }
    zobraz(false);
    if (model) vypisVysledky();
  });
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
  window.SOUPE_UI = { get p() { return app.p; }, get model() { return model; }, zmen: app.zmen, nahrad: app.nahrad, prepocitej, nahled, app, nastavRezim, stavZobr };
})();

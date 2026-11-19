/* Kloubová hadice – ovládání stránky nad společným zapojením gen3d/aplikace.js
   (tady jen to, co je pro hadici zvláštní: viditelnost polí, souhrny, výsledky, kusovník, režimy náhledu, export po dílech).
   Náhled = KNOF_NAHLED. Režimy: sestava (ohnutý řetěz), článek, tisk (díly na podložce), kalibrace. */
/* global KHAD, KHAD_MECH, KHAD_VYK, KNOF_NAHLED, KRAB, G3D, Dialog, TrubkyGui */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const fmt = KHAD.fmt;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  let p, wasm = null, model = null, chybaStavby = '', chybaJadra = '', mech = null, proud = null;
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
    document.querySelectorAll('[data-vstup],[data-tryska],[data-netryska],[data-zarezy],[data-neretez],[data-retez]').forEach(el => {
      const d = el.dataset;
      let vid = true;
      if (d.vstup && !seznam(d.vstup).includes(p.vstup.typ)) vid = false;
      if (d.tryska && !seznam(d.tryska).includes(p.tryska.typ)) vid = false;
      if (d.netryska && d.netryska === p.tryska.typ) vid = false;
      if (d.zarezy && p.kloub.zarezu < 2) vid = false;
      if (d.neretez && seznam(d.neretez).includes(p.retez.tvar)) vid = false;
      if (d.retez && d.retez !== p.retez.tvar) vid = false;
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
    $('jPrutok').textContent = p.proud.medium === 'vzduch' ? 'm³/h' : 'l/min';
    $('btnNaVlastni').hidden = p.retez.tvar === 'vlastni';
  }
  $('f_material').innerHTML = Object.entries(KHAD.MATERIALY).map(([k, m]) => `<option value="${k}">${m.nazev}</option>`).join('');
  $('f_zavit').innerHTML = Object.entries(KHAD.ZAVITY).map(([k, z]) => `<option value="${k}">${z.nazev}</option>`).join('');

  /* ---------- přepočet ---------- */
  let mediumPred = null, mediumTed = null;   // médium před poslední změnou (přepnutí kapalina ↔ vzduch)
  function prepocitej() {
    p = app.p;
    if (p.proud.medium !== mediumTed) { mediumPred = mediumTed; mediumTed = p.proud.medium; }
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
    mech = null; proud = null;
    if (model) {
      mech = KHAD_MECH.drzeni(p, o, model, KHAD.MATERIALY[p.tisk.material].hustota);
      if (!H.some(x => x.uroven === 'chyba')) proud = KHAD_MECH.proudeni(p, o, model.P, model.T, KHAD.uhlyRetezu(p, o.ohybMax));
      H = H.concat(hlaseniMech(o));
    }
    const st = $('stav3d');
    st.textContent = wasm || chybaJadra ? chybaStavby : 'Načítám geometrické jádro…';
    st.classList.toggle('chyba', !!chybaStavby);
    zobraz(false);
    app.hlaseni(H, { chybaStavby, boxy: ['boxKloub', 'boxKoncovky'] });
    vypisVysledky(o);
    souhrny(o);
    vypisProudeni(o);
    vypisDrzeni(o);
    kresliKlouby(o);
    if (p.retez.tvar !== 'vlastni') $('napCil').textContent = 'Najde nejmenší počet článků a úhly kloubů (v mezích kloubu, bez srážky článků), aby ústí trysky dosáhlo cíle. Výsledek se zapíše jako vlastní tvar.';
  }
  /** Název kloubu jako v tabulce kloubů: patka, 1…n−1, tryska. */
  const nazevKloubu = j => (j === 0 ? 'patka' : j === p.retez.pocet ? 'tryska' : String(j));
  /** Hlášení z proudění a držení tvaru (celé věty kvůli překladu). */
  function hlaseniMech(o) {
    const H = [], Mk = p.mech.moment;
    if (mech && mech.pretizene.length) {
      const seznamK = mech.pretizene.map(nazevKloubu).join(', ');
      H.push({ uroven: 'varovani', pole: ['mech.moment', 'retez.tvar'], text: `Klouby ${seznamK} neudrží tvar – moment od tíhy až ${fmt(mech.max, 0)} N·mm je víc než změřených ${fmt(Mk, 0)} N·mm. Zkraťte vyložení, zmenšete vůli nebo hadici podepřete.` });
    }
    if (proud && proud.odsavani && proud.v < 18) {
      const d = proud.doporuceno;
      H.push({ uroven: 'info', pole: ['proud.prutok'], text: `Vzduch v kanálu proudí ${fmt(proud.v, 1)} m/s – pod dopravní rychlostí 18 m/s třísky a prach zůstanou v hadici. Zvyšte průtok na ${fmt(d[0], 0)}–${fmt(d[1], 0)} m³/h.` });
    }
    if (proud && proud.plyn && proud.v > 60) H.push({ uroven: 'info', pole: ['proud.prutok'], text: `Vzduch v kanálu proudí ${fmt(proud.v, 0)} m/s – výpočet bere vzduch jako nestlačitelný, nad 60 m/s je jen orientační.` });
    if (proud && !proud.plyn && proud.v > 3) H.push({ uroven: 'info', pole: ['proud.prutok', 'kloub.kanal'], text: `Kapalina v kanálu proudí ${fmt(proud.v, 1)} m/s – velké ztráty v kloubech. Na tento průtok se hodí větší kanál.` });
    void o;
    return H;
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
    TrubkyGui.souhrn('sCil', p.cil.hlidatSmer ? `${fmt(p.cil.x, 0)} / ${fmt(p.cil.z, 0)} mm · ${fmt(p.cil.smer, 0)}°` : `${fmt(p.cil.x, 0)} / ${fmt(p.cil.z, 0)} mm`, true);
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
    h += box('Sestava v náhledu', `${fmt(sest[3] - sest[0], 0)} × ${fmt(sest[4] - sest[1], 0)} × ${fmt(sest[5] - sest[2], 0)} mm`, { rovne: 'rovná', oblouk: 'tvar oblouk', s: 'tvar esíčko', hak: 'tvar hák', vlastni: 'vlastní tvar' }[p.retez.tvar]);
    h += box('Hmotnost', `${fmt(od.g, od.g < 10 ? 1 : 0)} g`, p.tisk.sad > 1 ? `${mat.nazev}, plné díly, ${p.tisk.sad} sady` : `${mat.nazev}, plné díly`);
    h += box('Filament', `${fmt(od.metru, 1)} m`, `průměr 1,75 mm · ${fmt(V / 1000, 1)} cm³`);
    const desky = KHAD_MECH.podlozky(G3D.tiskoveRozlozeni(dily, p.tisk.sad, 5, 1e6), p.tisk.podlozka, p.tisk.podlozkaY);
    h += box('Podložky', `${desky.length}×`, `${fmt(p.tisk.podlozka, 0)} × ${fmt(p.tisk.podlozkaY, 0)} mm · ZIP po podložkách v nabídce Soubor`);
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
    const gHadice = m.tisk.reduce((s2, d) => s2 + d.objem, 0) * mat.hustota / 1000;   // jedna hadice, bez sad a kalibrace
    karta.innerHTML = `<div class="titul">${titul}</div><b>${fmt(delkaRovne, 0)}</b> mm natažená · ohyb <b>${fmt(o.ohybMax, 0)}°</b> na článek<br>`
      + (m.vetvi > 1 ? `${m.vetvi} × ${p.retez.pocet} článků · <b>${fmt(gHadice, 0)}</b> g ${mat.nazev}` : `${p.retez.pocet} článků · <b>${fmt(gHadice, 0)}</b> g ${mat.nazev}`);
    const kont = [m.patka, m.clanek, m.tryska].map(d => ({ d, k: KRAB.kontrolaSite(d.poz, d.idx) }));
    $('vSit').innerHTML = kont.map(({ d, k }) => box('Síť – ' + d.nazev, k.uzavrena && d.teles === 1 ? '✔ těsná' : '✖ netěsná', d.teles === 1 ? `${k.trojuhelniku} trojúhelníků, 1 těleso` : `${k.trojuhelniku} trojúhelníků, ${d.teles} tělesa`, k.uzavrena && d.teles === 1 ? 'ok-t' : 'chyba-t')).join('')
      + box('Stavba', `${m.cas} ms`, 'manifold-3d');
  }

  /* ---------- proudění ---------- */
  const tlak = (Pa, plyn) => (plyn ? (Pa < 10000 ? `${fmt(Pa, 0)} Pa` : `${fmt(Pa / 1000, 1)} kPa`) : (Pa < 100000 ? `${fmt(Pa / 1000, 1)} kPa` : `${fmt(Pa / 1e5, 2)} bar`));
  function vypisProudeni(o) {
    const el = $('vProud'), gr = $('grafProud');
    if (!proud) {
      el.innerHTML = box('Proudění', '–', p.vstup.typ === 'magnet' || p.tryska.typ === 'zatka' || o.rc <= 0 ? 'hadice nemá průtok (magnet, zátka nebo plné články)' : model ? 'nepočítá se – opravte chyby v záložce Kontrola' : 'model se ještě nesestavil');
      gr.hidden = true; return;
    }
    const pl = proud.plyn, jed = pl ? 'm³/h' : 'l/min';
    let h = box('Tlak na vstupu', tlak(proud.dp, pl), proud.odsavani ? 'podtlak ventilátoru / vysavače na hadici' : pl ? 'přetlak kompresoru / dmychadla na patce hadice' : 'přetlak čerpadla na patce hadice', '');
    h += box('Rychlost v kanálu', `${fmt(proud.v, 2)} m/s`, proud.vetvi > 1 ? `Re ${fmt(proud.Re, 0)} · ${proud.rezim} · ${proud.vetvi} větve` : `Re ${fmt(proud.Re, 0)} · ${proud.rezim}`,
      proud.odsavani ? (proud.v >= 18 ? 'ok-t' : 'mez-t') : (!pl && proud.v > 3 ? 'mez-t' : ''));
    if (proud.Au > 0) h += box('Rychlost na ústí', `${fmt(proud.vu, 1)} m/s`, `účinná plocha ústí ${fmt(proud.Au * 1e6, 1)} mm²`);
    const c = proud.casti, celk = proud.dp || 1, podil = x => `${fmt(x / celk * 100, 0)} %`;
    h += box('Kde se ztrácí tlak', `klouby ${podil(c.klouby)}`, `tření ${podil(c.treni)} · patka ${podil(c.patka)} · ústí ${podil(c.usti)}`);
    h += box('Hydraulický výkon', `${fmt(proud.vykon, proud.vykon < 10 ? 2 : 0)} W`, 'tlak × průtok (bez účinnosti čerpadla)');
    if (proud.odsavani) h += box('Doporučený průtok', `${fmt(proud.doporuceno[0], 0)}–${fmt(proud.doporuceno[1], 0)} ${jed}`, 'dopravní rychlost 18–25 m/s (prach, třísky)');
    el.innerHTML = h;
    // graf ztráty podle průtoku
    const Qmax = Math.max(p.proud.prutok * 2, proud.odsavani ? proud.doporuceno[1] * 1.2 : 1);
    const body = KHAD_MECH.krivkaProudeni(p, o, model.P, model.T, KHAD.uhlyRetezu(p, o.ohybMax), Qmax, 30);
    gr.hidden = false;
    const W = 320, Hh = 120, L0 = 44, Rr = 8, T0 = 8, B0 = 20, ymax = Math.max(...body.map(b => b.dp), 1) * 1.1;
    const X = q => L0 + (W - L0 - Rr) * q / Qmax, Y = d => T0 + (Hh - T0 - B0) * (1 - d / ymax);
    const qn = p.proud.prutok;
    gr.innerHTML = `<h3>Tlak na vstupu podle průtoku</h3><svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Tlak na vstupu podle průtoku: při ${fmt(qn, 1)} ${jed} ${tlak(proud.dp, pl)}">`
      + `<line class="osa" x1="${L0}" y1="${Y(0)}" x2="${W - Rr}" y2="${Y(0)}"/><line class="osa" x1="${L0}" y1="${T0}" x2="${L0}" y2="${Y(0)}"/>`
      + `<text class="popis-osy" x="${L0 - 4}" y="${Y(0) + 3}" text-anchor="end">0</text><text class="popis-osy" x="${L0 - 4}" y="${T0 + 8}" text-anchor="end">${tlak(ymax / 1.1, pl)}</text>`
      + `<text class="popis-osy" x="${L0}" y="${Hh - 5}">0 ${jed}</text><text class="popis-osy" x="${W - Rr}" y="${Hh - 5}" text-anchor="end">${fmt(Qmax, 1)} ${jed}</text>`
      + (proud.odsavani ? proud.doporuceno.map(q => (q < Qmax ? `<line class="mez" x1="${X(q)}" y1="${T0}" x2="${X(q)}" y2="${Y(0)}"/>` : '')).join('') : '')
      + `<polyline class="cara" points="${body.map(b => `${X(b.Q).toFixed(1)},${Y(b.dp).toFixed(1)}`).join(' ')}"/>`
      + (qn > 0 && qn <= Qmax ? `<circle class="bod" r="4" cx="${X(qn).toFixed(1)}" cy="${Y(proud.dp).toFixed(1)}"/>` : '') + '</svg>';
  }

  /* ---------- držení tvaru ---------- */
  function vypisDrzeni(o) {
    const el = $('vDrzeni'), tab = $('tabMomenty');
    if (!mech) { el.innerHTML = box('Držení tvaru', '–', 'model se ještě nesestavil'); tab.innerHTML = ''; $('legMom').hidden = true; return; }
    const Mk = p.mech.moment;
    let h = box('Největší moment', `${fmt(mech.max, mech.max < 10 ? 1 : 0)} N·mm`, mech.jmax === 0 ? 'v kloubu u patky pro aktuální tvar' : `v kloubu ${nazevKloubu(mech.jmax)} pro aktuální tvar`, Mk > 0 ? (mech.max <= Mk ? 'ok-t' : 'chyba-t') : '');
    h += box('Mezní moment kloubu', Mk > 0 ? `${fmt(Mk, 1)} N·mm` : 'neměřeno', Mk > 0 ? (mech.pretizene.length ? `přetížené klouby: ${mech.pretizene.length}` : 'všechny klouby tvar udrží') : 'změřte testem se závažím (návod níže)',
      Mk > 0 ? (mech.pretizene.length ? 'chyba-t' : 'ok-t') : 'mez-t');
    if (Mk > 0) h += box('Vodorovné vyložení', mech.vylozeni >= 0 ? `${mech.vylozeni} článků` : 'ani tryska', mech.vylozeni >= 0 ? `≈ ${fmt(mech.vylozeni * o.L, 0)} mm + tryska – vodorovně natažená hadice ještě drží` : 'kloub u patky neudrží ani samotnou trysku');
    h += box('Hmotnost větve', `${fmt(mech.hmotnost, 1)} g`, mech.kapalina ? `článek ${fmt(mech.mClanek, 2)} g i s kapalinou` : `článek ${fmt(mech.mClanek, 2)} g`);
    h += box('Potřebný moment vodorovně', `${fmt(mech.Mvod(p.retez.pocet), 0)} N·mm`, `kloub u patky, ${p.retez.pocet} článků natažených vodorovně`);
    el.innerHTML = h;
    tab.innerHTML = '<thead><tr><th>Kloub</th><th class="c">Moment</th><th class="c">Využití</th></tr></thead><tbody>'
      + mech.momenty.map((M, j) => `<tr><td>${j === 0 ? 'patka – článek 1' : j === p.retez.pocet ? `článek ${j} – tryska` : `článek ${j} – ${j + 1}`}</td><td class="c">${fmt(M, M < 10 ? 1 : 0)} N·mm</td><td class="c ${Mk > 0 && M > Mk ? 'chyba-t' : ''}">${Mk > 0 ? fmt(M / Mk * 100, 0) + ' %' : '–'}</td></tr>`).join('') + '</tbody>';
  }

  /* ---------- vlastní tvar: tabulka kloubů ---------- */
  function kresliKlouby(o) {
    const t = $('tabKlouby');
    if (p.retez.tvar !== 'vlastni' || t.contains(document.activeElement)) return;
    const n = p.retez.pocet + 1, k = p.retez.klouby, pret = new Set(mech ? mech.pretizene : []);
    let h = `<thead><tr><th>Kloub</th><th>Ohyb (±${fmt(o.ohybMax, 0)}°)</th><th>Natočení roviny</th></tr></thead><tbody>`;
    for (let i = 0; i < n; i++) {
      const q = k[i] || [0, 0];
      h += `<tr class="${pret.has(i) ? 'pretizeny' : ''}"><td>${i === 0 ? 'patka' : i === n - 1 ? 'tryska' : i}</td>`
        + `<td><input type="text" inputmode="text" data-kloub="${i}" data-slozka="0" value="${fmt(q[0], 2)}" aria-label="Ohyb kloubu ${i} (°)"></td>`
        + `<td><input type="text" inputmode="text" data-kloub="${i}" data-slozka="1" value="${fmt(q[1], 0)}" aria-label="Natočení roviny kloubu ${i} (°)"></td></tr>`;
    }
    t.innerHTML = h + '</tbody>';
  }
  $('tabKlouby').addEventListener('change', e => {
    const el = e.target.closest('[data-kloub]'); if (!el) return;
    const v = G3D.ctiCislo(el.value), i = +el.dataset.kloub, sl = +el.dataset.slozka;
    if (!Number.isFinite(v)) { el.classList.add('spatne'); return; }
    el.classList.remove('spatne');
    app.zmen(q => {
      while (q.retez.klouby.length <= i) q.retez.klouby.push([0, 0]);
      q.retez.klouby[i][sl] = v;
    });
    // tabulka se při fokusu nepřekresluje – hodnoty (oříznuté normalizací) a přetížení obnovit v místě
    const pret = new Set(mech ? mech.pretizene : []);
    $('tabKlouby').querySelectorAll('[data-kloub]').forEach(x => {
      const q = app.p.retez.klouby[+x.dataset.kloub] || [0, 0];
      x.value = fmt(q[+x.dataset.slozka], +x.dataset.slozka ? 0 : 2);
      x.closest('tr').classList.toggle('pretizeny', pret.has(+x.dataset.kloub));
    });
  });
  // změna média mezi kapalinou a vzduchem: jiné jednotky i řád – nastavit typický průtok pro tento kanál
  $('f_med').addEventListener('change', () => setTimeout(() => {
    const q = app.p, plyn = KHAD_MECH.MEDIA[q.proud.medium].plyn;
    if (!mediumPred || plyn === KHAD_MECH.MEDIA[mediumPred].plyn) return;
    const o = KHAD.odvozene(q), A = Math.PI * o.rc * o.rc / 1e6, vet = q.vstup.typ === 'rozbocka' ? q.vstup.vetvi : 1;
    if (!(A > 0)) return;
    app.zmen(x => { x.proud.prutok = plyn ? Math.round(20 * A * 3600 * vet) : Math.round(1.5 * A * 60000 * vet * 10) / 10; });
    app.naplnFormular();
  }, 0));
  let pocetPred = null, kloubyPred = null;
  $('f_pocet').addEventListener('focus', () => { pocetPred = app.p.retez.pocet; kloubyPred = KHAD.kopie(app.p.retez.klouby); });
  $('f_pocet').addEventListener('change', () => setTimeout(() => {
    const q = app.p, n = q.retez.pocet;
    if (q.retez.tvar !== 'vlastni' || pocetPred === null || n === pocetPred) { pocetPred = n; return; }
    const stare = kloubyPred, tr = stare[pocetPred] || [0, 0];
    const nove = Array.from({ length: n }, (_, i) => (i < pocetPred && stare[i] ? stare[i] : [0, 0]));
    nove.push(tr);   // kloub trysky zůstane trysce
    pocetPred = n; kloubyPred = KHAD.kopie(nove);
    app.zmen(x => { x.retez.klouby = nove; });
  }, 0));
  $('btnNaVlastni').addEventListener('click', () => {
    const o = KHAD.odvozene(app.p), u = KHAD.uhlyRetezu(app.p, o.ohybMax || 0);
    app.zmen(q => { q.retez.klouby = u.map(x => [x, 0]); q.retez.tvar = 'vlastni'; });
    app.naplnFormular();
  });
  $('btnNavrh').addEventListener('click', () => {
    if (!model) { Dialog.chyba(chybaStavby || 'Geometrické jádro se ještě načítá.'); return; }
    const b = $('btnNavrh');
    b.disabled = true; $('napCil').textContent = 'Počítám…';
    setTimeout(() => {   // nechat vykreslit „Počítám…“ – dlouhé řetězy počítají až ~2 s
      try {
        const o = KHAD.odvozene(app.p), r = KHAD_MECH.navrhTvar(app.p, o, model.P, model.T, app.p.cil);
        if (r.dosazeno || r.duvod !== 'daleko') {
          app.zmen(q => { q.retez.pocet = r.pocet; q.retez.klouby = r.klouby; q.retez.tvar = 'vlastni'; });
          app.naplnFormular();
        }
        const ch = fmt(r.chyba, r.chyba < 1 ? 2 : 1), sm = fmt(r.chybaSmeru, 1);
        $('napCil').textContent = r.dosazeno
          ? (app.p.cil.hlidatSmer ? `Cíl dosažen: ${r.pocet} článků, odchylka ${ch} mm a ${sm}°. Tvar je zapsaný jako vlastní – lze ho dál ladit po kloubech.`
            : `Cíl dosažen: ${r.pocet} článků, odchylka ${ch} mm. Tvar je zapsaný jako vlastní – lze ho dál ladit po kloubech.`)
          : {
            daleko: 'Cíl je dál, než dosáhne 60 článků – zvětšete rozteč, nebo hadici prodlužte jiným vedením.',
            srazka: `Nejbližší tvar (odchylka ${ch} mm) by měl články srážející se navzájem nebo s patkou – zkuste cíl posunout.`,
            smer: `Poloha sedí, ale směr trysky se nepodaří dodržet (odchylka ${sm}°) – kloub se neohne dost. Uvolněte směr nebo posuňte cíl.`,
            blizko: `Cíl se nepodařilo přesně dosáhnout (nejblíž ${ch} mm) – je pro tuto rozteč a mezní ohyb kloubu příliš blízko patky nebo za ostrým ohybem.`,
          }[r.duvod];
      } finally { b.disabled = false; }
    }, 30);
  });
  $('btnZmereny').addEventListener('click', () => {
    const v = id => G3D.ctiCislo($(id).value);
    const D = v('m_koule'), dh = v('m_hrdlo'), dk = v('m_kanal'), L = v('m_roztec');
    if (!(D > 0) || !(dh > 0) || !(dh < D)) { Dialog.chyba('Zadejte průměr koule a hrdla – hrdlo musí být užší než koule.'); return; }
    app.zmen(q => {
      q.kloub.koule = D; q.kloub.presah = Math.round((D - dh) / 2 * 100) / 100;
      if (dk >= 0 && Number.isFinite(dk)) q.kloub.kanal = dk;
      if (L > 0) q.kloub.roztec = L;
    });
    app.naplnFormular();
  });

  /* ---------- náhled ---------- */
  function zobraz(novyPohled) {
    document.querySelectorAll('[data-rezim]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.rezim === stavZobr.rezim)));
    if (!model) { nahled.nastav(null); return; }
    const r = stavZobr.rezim;
    if (r === 'tisk') nahled.nastav(G3D.tiskoveRozlozeni(dilyKTisku(), p.tisk.sad, 5, p.tisk.podlozka), { tisk: true, novyPohled, uhel: p.tisk.uhel });
    else if (r === 'kalibrace') nahled.nastav(G3D.tiskoveRozlozeni(model.kalibrace, 1, 5, 160), { tisk: true, novyPohled, uhel: p.tisk.uhel });
    else if (r === 'clanek') nahled.nastav([model.clanek], { novyPohled });
    else nahled.nastav(sestavaSBarvami().concat(znackaCile()), { novyPohled });
    $('legMom').hidden = !(r === 'sestava' && mech && mech.pretizene.length);
    $('legPrevisy').hidden = !((r === 'tisk' || r === 'kalibrace') && nahled.stav.previsy);
  }
  /** Sestava náhledu; články v přetížených kloubech (koule článku j sedí v kloubu j) červeně. */
  function sestavaSBarvami() {
    if (!mech || !mech.pretizene.length) return model.sestava;
    const pret = new Set(mech.pretizene), ok = [], spatne = [], tr = [], trS = [];
    for (const r of model.ramy) {
      for (let i = 0; i < p.retez.pocet; i++) (pret.has(i) ? spatne : ok).push({ poz: KHAD.presun(model.clanek, r[i]), idx: model.clanek.idx });
      (pret.has(p.retez.pocet) ? trS : tr).push({ poz: KHAD.presun(model.tryska, r[p.retez.pocet]), idx: model.tryska.idx });
    }
    const out = [model.patka];
    if (ok.length) out.push(KHAD.slouc(ok, 'Články', 'clanky', '#2F5FA8'));
    if (spatne.length) out.push(KHAD.slouc(spatne, 'Přetížené články', 'pretizene', '#D64541'));
    if (tr.length) out.push(KHAD.slouc(tr, model.tryska.nazev, 'trysky', '#E88A2E'));
    if (trS.length) out.push(KHAD.slouc(trS, model.tryska.nazev, 'trysky_s', '#D64541'));
    return out;
  }
  /** Zelená kulička v cíli trysky (jen s otevřeným oddílem Cíl trysky). */
  function znackaCile() {
    if (!document.querySelector('[data-oddil="cil"]').open) return [];
    const c = p.cil, y = model.ramy[0][0].P[1], r = Math.max(2, KHAD.odvozene(p).Ro * 0.35), poz = [], idx = [], M = 10, N = 16;
    for (let i = 0; i <= M; i++) for (let j = 0; j < N; j++) {
      const t = Math.PI * i / M, f = 2 * Math.PI * j / N;
      poz.push(c.x + r * Math.sin(t) * Math.cos(f), y + r * Math.sin(t) * Math.sin(f), c.z + r * Math.cos(t));
    }
    for (let i = 0; i < M; i++) for (let j = 0; j < N; j++) {
      const a = i * N + j, b = i * N + (j + 1) % N, c2 = a + N, d = b + N;
      idx.push(a, c2, b, b, c2, d);
    }
    return [{ nazev: 'Cíl trysky', jmeno: 'cil', poz: new Float32Array(poz), idx: new Uint32Array(idx), barva: '#2EAD5B' }];
  }
  document.querySelector('[data-oddil="cil"]').addEventListener('toggle', () => { if (model && stavZobr.rezim === 'sestava') zobraz(false); });
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
      nahled.pohled('iso');   // jiná velikost hadice – nový pohled
    });
    $('seznamPredvoleb').appendChild(b);
  }
  function lzeExport() {
    if (!model) { Dialog.chyba(chybaStavby || 'Geometrické jádro se ještě načítá.'); return false; }
    return true;
  }
  const kusy = dily => G3D.tiskoveRozlozeni(dily, app.p.tisk.sad, 5, app.p.tisk.podlozka);
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
    } else if (co === 'sestava') {
      dily = [KHAD.slouc(model.sestava, 'Sestava', 'sestava', '#888')];
      app.stahni(KRAB.stlBinarni(dily, 'kloubova hadice - sestava (vizualizace)'), app.jmeno('_sestava.stl'), 'model/stl');
      return;
    } else dily = [model[co]];
    app.stahni(KRAB.stlBinarni(G3D.tiskoveRozlozeni(dily, 1, 5, 160), 'kloubova hadice - ' + co), app.jmeno('_' + co + '.stl'), 'model/stl');
  }));
  $('btnZip').addEventListener('click', () => {
    if (!lzeExport()) return;
    const desky = KHAD_MECH.podlozky(G3D.tiskoveRozlozeni(dilyKTisku(), app.p.tisk.sad, 5, 1e6), app.p.tisk.podlozka, app.p.tisk.podlozkaY);
    const soubory = desky.map((d, i) => ({ name: app.jmeno(`_podlozka_${i + 1}.stl`), data: KRAB.stlBinarni(d, 'kloubova hadice - podlozka ' + (i + 1)) }));
    app.stahni(KRAB.zip(soubory), app.jmeno('_podlozky.zip'), 'application/zip');
  });
  /* ---------- výkres ---------- */
  function svgVykresu() {
    if (!lzeExport()) return null;
    const o = KHAD.odvozene(app.p), mat = KHAD.MATERIALY[app.p.tisk.material], d = new Date();
    const hm = model.tisk.reduce((s, x) => s + x.objem, 0) * mat.hustota / 1000;   // bez kalibrační sady
    const kus = [[model.patka.nazev, 1], ['Článek', model.vetvi * app.p.retez.pocet], [model.tryska.nazev, model.vetvi]];
    return KHAD_VYK.sestavVykres(app.p, o, model, {
      datum: `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`, hmotnost: hm, material: mat.nazev, kusovnik: kus,
      delka: model.P.zS + app.p.retez.pocet * o.L + model.T.delkaCelkem - o.a,
      dp: proud ? `${tlak(proud.dp, proud.plyn)} při ${fmt(app.p.proud.prutok, 1)} ${proud.plyn ? 'm³/h' : 'l/min'}` : '',
    });
  }
  $('btnVykres').addEventListener('click', () => { const svg = svgVykresu(); if (!svg) return; $('vykresObsah').innerHTML = svg; $('vykresDlg').showModal(); });
  $('btnVykresSvg').addEventListener('click', () => { const svg = svgVykresu(); if (svg) app.stahni(svg, app.jmeno('_vykres.svg'), 'image/svg+xml'); });
  $('btnVykresTisk').addEventListener('click', () => {
    const svg = svgVykresu(); if (!svg) return;
    const ram = document.createElement('iframe');
    ram.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(ram);
    const d = ram.contentDocument;
    d.open(); d.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(app.jmeno(''))}</title><style>@page{size:A4 landscape;margin:0}html,body{margin:0;padding:0}svg{display:block;width:297mm;height:210mm}</style></head><body>${svg}</body></html>`); d.close();
    setTimeout(() => { try { ram.contentWindow.focus(); ram.contentWindow.print(); } finally { setTimeout(() => ram.remove(), 60000); } }, 250);
  });
  $('btnZavritVyk').addEventListener('click', () => $('vykresDlg').close());
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

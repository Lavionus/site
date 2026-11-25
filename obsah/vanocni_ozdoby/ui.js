/* Vánoční ozdoby – ovládání stránky nad společným zapojením gen3d/aplikace.js
   (tady jen to, co je pro ozdoby zvláštní: druh, viditelnost polí, písmo jmenovky, souhrny, výsledky, kusovník, export).
   Náhled = KNOF_NAHLED. Režimy: ozdoba (sestavená), tisk (díly na podložce), zkouška spoje. */
/* global VANOCE, KLIC, KNOF_NAHLED, KRAB, FONTY, G3D, Dialog, TrubkyGui */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const fmt = VANOCE.fmt, N = VANOCE.NAZVY;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  let p, wasm = null, model = null, chybaStavby = '', chybaJadra = '', font = null, fontId = null, beh = 0;
  const stavZobr = { rezim: 'sestava' };
  const nahled = KNOF_NAHLED.vytvorNahled($('platno'));
  let vyberPisma = null;

  const app = G3D.aplikace({
    typ: 'vanocni_ozdoby', nazev: 'Vánoční ozdoby', klic: 'webapp_vanocni_ozdoby', soubor: q => q.druh,
    normalizuj: VANOCE.normalizuj, vychozi: () => VANOCE.predvolba('vlocka'),
    ulozProjekt: VANOCE.ulozProjekt, nactiProjekt: VANOCE.nactiProjekt, popis: VANOCE.popis,
    viditelnost: () => viditelnost(),
    poNaplneni: q => { if (vyberPisma) vyberPisma.hodnota = q.jmenovka.pismo; },
    prepocitej: () => { prestav(); },
    png: () => nahled.png(), pohled: j => nahled.pohled(j),
    exportStl: () => exportVse('stl'),
    doModelare: () => (lzeExport() ? { data: KRAB.soubor3mf(obarvi(kusy()), app.p.nazev || 'Ozdoba'), pripona: '.3mf' } : null),
    nahodny: q => { const r = VANOCE.kopie(q); r.vlocka.seminko = Math.floor(Math.random() * 1e6); return r; },
    zkratky: { r: 'tRez', h: 'tHrany', m: 'tTisk', p: 'tPrevisy', l: 'tPravitka' },
    diry: true,
    zmenaTematu: () => prestav(),
  });

  /* ---------- nabídky formuláře ---------- */
  const moznosti = (sel, obj) => { sel.innerHTML = Object.entries(obj).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join(''); };
  moznosti($('f_hstyl'), N.styl);
  moznosti($('f_bprofil'), N.profil);
  moznosti($('f_bpovrch'), N.povrch);
  moznosti($('f_bspoj'), N.spoj);
  moznosti($('f_jtvar'), N.tvar);
  moznosti($('f_jrezim'), N.rezim);
  moznosti($('f_jdirka'), N.dirka);
  moznosti($('f_material'), Object.fromEntries(Object.entries(VANOCE.MATERIALY).map(([k, m]) => [k, m.nazev])));
  document.querySelectorAll('#paletaDruhu button').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.dlazdice === app.p.druh) return;
    app.zmen(q => { q.druh = b.dataset.dlazdice; });
    app.naplnFormular();
  }));
  // text jmenovky se přepočítává už při psaní (jeden krok zpět)
  $('f_jtext').addEventListener('input', e => app.zmen(q => { q.jmenovka.text = e.target.value; }, 'pole:jmenovka.text'));

  /* ---------- písmo jmenovky (knihovna fonty/fonty.js, stejně jako klíčenky) ---------- */
  vyberPisma = FONTY.vyberFontu($('vyberPisma'), {
    ukazka: () => app.p.jmenovka.text || 'Aa 123',
    poznamka: f => (f.typ === 'woff2' ? 'WOFF2 – nejde do 3D' : !f.pro3d ? 'tenké tahy' : ''),
    doporucene: () => 'latinka',
    onZmena: id => app.zmen(q => { q.jmenovka.pismo = id; }),
  });
  FONTY.seznam().then(s => vyberPisma.nastav(s.filter(f => !f.pismo || f.pismo === 'latinka'), app.p.jmenovka.pismo)).catch(() => { /* zůstane výchozí */ });
  async function pripravPismo(id) {
    if (fontId === id && font) return font;
    $('stavPisma').textContent = '';
    try { font = await FONTY.opentype(id); fontId = id; return font; }
    catch (e) {
      font = null; fontId = null;
      $('stavPisma').textContent = 'Písmo se nenačetlo: ' + (e && e.message || e) + (FONTY.ZE_SOUBORU ? ' ' + FONTY.HLASKA_SOUBOR : '');
      return null;
    }
  }

  const seznam = a => (a || '').split(/\s+/).filter(Boolean);
  function viditelnost() {
    p = app.p;
    const j = p.jmenovka;
    document.querySelectorAll('[data-druh],[data-styl],[data-povrch],[data-rezim-textu],[data-nekruh],[data-nekolecko]').forEach(el => {
      const d = el.dataset;
      let vid = true;
      if (d.druh && !seznam(d.druh).includes(p.druh)) vid = false;
      if (d.styl && !seznam(d.styl).includes(p.hvezda.styl)) vid = false;
      if (d.povrch && !seznam(d.povrch).includes(p.banka.povrch)) vid = false;
      if (d.rezimTextu && !seznam(d.rezimTextu).includes(j.rezim)) vid = false;
      if (d.nekruh && (j.tvar === 'kolecko' || j.tvar === 'hvezda')) vid = false;
      if (d.nekolecko && j.tvar === 'kolecko') vid = false;
      el.hidden = !vid;
    });
    $('gOcko').hidden = !p.ocko.zap;
    $('nadpisPravy').textContent = { vlocka: 'Závěs', hvezda: 'Závěs', banka: 'Čepička a závěs', jmenovka: 'Text a dírka' }[p.druh];
    $('nOcko').textContent = p.druh === 'jmenovka' ? 'Dírka na provázek' : p.druh === 'banka' ? 'Očko na čepičce' : 'Očko na zavěšení';
    $('lOckoZap').textContent = p.druh === 'jmenovka' ? 'S dírkou' : 'S očkem';
    $('lPocet').textContent = p.banka.povrch === 'fazety' ? 'Fazet po obvodu' : 'Žeber';
    $('lJSirka').textContent = j.tvar === 'kolecko' ? 'Průměr' : j.tvar === 'hvezda' ? 'Průměr přes cípy' : 'Šířka';
    $('lHvTl').textContent = p.hvezda.styl === 'vypoukla' ? 'Tloušťka hrany' : p.hvezda.styl === 'zasouvaci' ? 'Tloušťka plátů' : 'Tloušťka';
    $('lBarva1').textContent = { vlocka: 'Vločka', hvezda: p.hvezda.styl === 'zasouvaci' ? 'Plát A' : 'Hvězda', banka: 'Baňka', jmenovka: 'Cedulka' }[p.druh];
    $('lBarva2').textContent = { hvezda: 'Plát B', banka: 'Čepička', jmenovka: 'Text' }[p.druh] || '';
    $('gBarva2').hidden = p.druh === 'vlocka' || (p.druh === 'hvezda' && p.hvezda.styl !== 'zasouvaci');
    $('btnKalibrace').hidden = $('btnKalibrace2').hidden = !(p.druh === 'banka' || (p.druh === 'hvezda' && p.hvezda.styl === 'zasouvaci'));
    document.querySelector('[data-rezim="kalibrace"]').hidden = $('btnKalibrace').hidden;
    if ($('btnKalibrace').hidden && stavZobr.rezim === 'kalibrace') stavZobr.rezim = 'sestava';
    if ($('tKapky')) $('tKapky').hidden = p.druh !== 'banka';   // vodorovnou díru má jen očko na čepičce baňky
  }

  /* ---------- přepočet ---------- */
  async function prestav() {
    const cislo = ++beh;
    p = app.p;
    document.querySelectorAll('#paletaDruhu button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.dlazdice === p.druh)));
    nahled.barvy(css('--border-strong'), css('--border'), css('--text'));
    let H = VANOCE.kontroly(p), novy = null, chyba = chybaJadra;
    const st = $('stav3d');
    if (wasm && !H.some(h => h.uroven === 'chyba')) {
      let f = null;
      if (p.druh === 'jmenovka' && p.jmenovka.text.trim()) {
        if (fontId !== p.jmenovka.pismo) { st.textContent = 'Načítám písmo…'; st.classList.remove('chyba'); }
        f = await pripravPismo(p.jmenovka.pismo);
        if (cislo !== beh) return;   // mezitím přišla další změna
        if (!f) chyba = 'Písmo se nenačetlo – zvolte jiné.';
      }
      if (!chyba) {
        try { novy = VANOCE.postav(wasm, p, { font: f }); H = H.concat(VANOCE.kontrolyModelu(p, novy)); }
        catch (e) { chyba = 'Model nelze sestavit: ' + (e && e.message || e); }
      }
    } else if (wasm) chyba = 'Model nelze sestavit – opravte chybu v záložce Kontrola.';
    model = novy; chybaStavby = chyba;
    st.textContent = wasm || chybaJadra ? chybaStavby : 'Načítám geometrické jádro…';
    st.classList.toggle('chyba', !!chybaStavby);
    zobraz(false);
    app.hlaseni(H, { chybaStavby, boxy: ['boxTvar', 'boxZaves'] });
    souhrny();
    vypisVysledky();
    vypisTisk();
    vypisKusovnik();
    exportDilu();
  }
  function souhrny() {
    const o = VANOCE.odvozene(p), v = p.vlocka, h = p.hvezda, b = p.banka, j = p.jmenovka, oc = p.ocko;
    const S = (id, t, je) => TrubkyGui.souhrn(id, t, je);
    S('sVlocka', `Ø ${fmt(v.prumer * o.k)} · č. ${v.seminko}`, true);
    S('sHvezda', `${h.cipu} cípů · R ${fmt(h.vnejsi * o.k)}`, true);
    S('sBanka', `${N.profil[b.profil]} Ø ${fmt(b.prumer * o.k)} × ${fmt(b.vyska * o.k)}`, true);
    S('sPovrch', b.povrch === 'hladky' ? N.povrch.hladky : `${N.povrch[b.povrch]} ${b.pocet}×`, b.povrch !== 'hladky');
    S('sCedulka', `${N.tvar[j.tvar]} ${fmt(j.sirka * o.k)}${j.tvar === 'kolecko' || j.tvar === 'hvezda' ? '' : ' × ' + fmt(j.vyska * o.k)}`, true);
    S('sMeritko', `${fmt(p.meritko)} %`, p.meritko !== 100);
    S('sText', N.rezim[j.rezim], true);
    S('sCepicka', `Ø ${fmt(b.hrdlo)} · ${b.spoj === 'zaklapnuti' ? 'zaklapne' : 'lepená'}`, true);
    S('sOcko', oc.zap ? `Ø ${fmt(oc.prumer, 1)}` : 'bez', oc.zap);
    S('sBarvy', '', false);
    $('sBarvy').innerHTML = `<span class="tecka" style="background:${p.barvy.podklad}"></span>` + ($('gBarva2').hidden ? '' : ` <span class="tecka" style="background:${p.barvy.text}"></span>`);
    // nápovědy pod poli
    const st = model && model.info.styl;
    $('napVlocka').innerHTML = st ? `<span>Semínko ${v.seminko}: větve pod úhlem ${fmt(st.alfa, 0)}°,</span> <span>${{ jedle: 'ke špičce kratší', list: 'nejdelší uprostřed', koruna: 'ke špičce delší', stridave: 'střídavě dlouhé a krátké' }[st.obalka]},</span> `
      + `<span>střed: ${{ plny: 'plný šestiúhelník', prstenec: 'šestiúhelníkový prstenec', dvojity: 'dva prstence', nic: 'jen ramena' }[st.stred]},</span> `
      + `<span>špičky: ${{ nic: 'rovné', vidlice: 'vidlice', kosoctverec: 'kosočtverec', kulicka: 'kulička' }[st.spicka]}.</span>` : '';
    $('napHvezda').textContent = p.druh !== 'hvezda' ? '' : h.styl === 'zasouvaci' ? `Výřez ${fmt(o.vyrez, 2)} mm široký do poloviny výšky; plát A má výřez zdola a nese očko, plát B shora.`
      : h.styl === 'vypoukla' ? `Spodek je rovný, vrchol ${fmt(h.tloustka + h.vyska, 1)} mm nad podložkou. Úhel cípu ${fmt(o.uhelCipu, 0)}°.`
        : `Úhel cípu ${fmt(o.uhelCipu, 0)}°, plocha ${fmt(o.plocha / 100, 1)} cm².`;
    $('napBanka').textContent = p.druh !== 'banka' || o.chybaProfilu ? '' : `Největší průměr ${fmt(2 * o.rMax, 1)} mm, dno Ø ${fmt(2 * o.rDno, 1)} mm, stěny nejvýš ${fmt(Math.max(o.sklonVen, o.sklonDovnitr), 0)}° od svislice.`;
    $('napCepicka').textContent = p.druh !== 'banka' ? '' : o.zak ? `Čepička Ø ${fmt(2 * o.ro, 1)} mm, dutina Ø ${fmt(2 * o.rc, 2)} mm, ústí Ø ${fmt(2 * o.rl, 2)} mm přeskočí lem Ø ${fmt(2 * (o.rh + o.presah), 1)} mm.`
      : `Čepička Ø ${fmt(2 * o.ro, 1)} mm, dutina Ø ${fmt(2 * o.rc, 2)} mm – kápněte vteřinové lepidlo na hrdlo.`;
    $('napOcko').textContent = !p.ocko.zap ? '' : p.druh === 'banka' ? (p.diry === 'kruh' ? 'Svislý plátek na čepičce, díra kruhová – její strop převisá.' : 'Svislý plátek na čepičce, díra jako kapka – tisk bez podpor.')
      : p.druh === 'jmenovka' ? 'Dírka je od kraje cedulky vzdálená o stěnu kolem otvoru.' : 'Kroužek na horní špičce, spojený s tvarem krčkem.';
    const cap = model && model.info.cap;
    $('napText').innerHTML = p.druh !== 'jmenovka' ? '' : (cap ? `<span>Verzálky ${fmt(cap, 1)} mm, text ${fmt(model.info.textRozmer[0], 1)} × ${fmt(model.info.textRozmer[1], 1)} mm.</span> ` : '')
      + '<span>' + { vystouply: 'Dvě barvy: výměna filamentu ve výšce cedulky, nebo barevný 3MF.', zapusteny: 'Dno vybrání je v barvě textu – výměna filamentu ve výšce dna, nebo barevný 3MF.', skrz: 'Text prochází skrz; vnitřky písmen drží jen u šablonových písem.' }[j.rezim] + '</span>';
  }
  const box = (a, b, c, d) => G3D.dlazdice(a, b, c, d);
  const barva = d => p.barvy[d.role] || p.barvy.podklad;
  const obarvi = dily => dily.map(d => Object.assign({}, d, { barva: barva(d) }));
  const material = () => VANOCE.MATERIALY[p.tisk.material];
  const hmotnost = d => VANOCE.objemMaterialu(d, p) * material().hustota / 1000;
  const rozmer = dily => {
    const B = dily.reduce((A, d) => { const q = G3D.obal(d.poz); for (let i = 0; i < 3; i++) { A[i] = Math.min(A[i], q[i]); A[i + 3] = Math.max(A[i + 3], q[i + 3]); } return A; }, [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]);
    return [B[3] - B[0], B[4] - B[1], B[5] - B[2]];
  };
  function vypisVysledky() {
    const el = $('vVysledky'), karta = $('karta3d');
    if (!model) { el.innerHTML = box('Model', wasm || chybaJadra ? 'nelze sestavit' : 'načítám…', esc(chybaStavby)); karta.innerHTML = ''; $('vSit').innerHTML = ''; $('tabRozmery').innerHTML = ''; return; }
    const o = model.o, D = model.dily, mat = material();
    const V = D.reduce((s, d) => s + d.ks * VANOCE.objemMaterialu(d, p), 0), g = V * mat.hustota / 1000;
    const od = G3D.odhadTisku(V, mat.hustota, { dilu: D.length });
    const R = rozmer(model.sestava), f3 = r => `${fmt(r[0], 1)} × ${fmt(r[1], 1)} × ${fmt(r[2], 1)} mm`;
    let h = box('Rozměry ozdoby', f3(R), p.druh === 'banka' ? 'baňka s nasazenou čepičkou' : p.druh === 'hvezda' && p.hvezda.styl === 'zasouvaci' ? 'pláty zasunuté do sebe' : 'šířka × výška × tloušťka, s očkem');
    if (p.druh === 'vlocka') h += box('Vločka', `č. ${p.vlocka.seminko}`, `Ø ${fmt(2 * o.R, 1)} mm · ramena ${fmt(o.w, 2)} mm · nejtenčí prvek ≥ ${fmt(p.vlocka.minimum, 2)} mm`, model.info.tenke > 0.005 ? 'mez-t' : 'ok-t');
    if (p.druh === 'hvezda') h += box('Hvězda', `${o.n} cípů`, `R ${fmt(o.R, 1)} / r ${fmt(o.r, 1)} mm · cíp ${fmt(o.uhelCipu, 0)}°`);
    if (p.druh === 'banka') {
      const r = VANOCE.rozborSite(D[0]), sklon = Math.max(r.sklonVen, r.sklonDovnitr);
      h += box('Stěna baňky', `nejvýš ${fmt(sklon, 0)}°`, `od svislice · tiskárna zvládne ${fmt(p.tisk.uhel, 0)}°`, sklon > p.tisk.uhel + 1.5 ? 'mez-t' : 'ok-t');
      h += box('Vázový režim', `1 stěna ${fmt(p.tisk.stena, 2)} mm`, `objem uvnitř ${fmt(D[0].objem / 1000, 0)} cm³`);
    }
    if (p.druh === 'jmenovka' && model.info.cap) h += box('Písmo', `${fmt(model.info.cap, 1)} mm`, `výška verzálek · ${N.rezim[p.jmenovka.rezim]} text`);
    h += box('Dílů k tisku', `${D.reduce((s, d) => s + d.ks, 0)}`, D.map(d => esc(d.nazev)).join(' · '));
    h += box('Objem materiálu', `${fmt(V / 1000, 2)} cm³`, p.druh === 'banka' ? 'stěna a dno baňky + plná čepička' : 'plné díly');
    h += box('Hmotnost', `${fmt(g, 1)} g`, mat.nazev);
    h += box('Filament', `${fmt(od.metru, 2)} m`, 'průměr 1,75 mm');
    h += box('Doba tisku', `≈ ${od.minut < 60 ? od.minut + ' min' : fmt(od.minut / 60, 1) + ' h'}`, 'hrubý odhad');
    el.innerHTML = h;
    // lícované rozměry
    const r = [];
    if (p.druh === 'banka') {
      r.push(['Hrdlo baňky', `Ø ${fmt(2 * o.rh, 2)}`, `výška ${fmt(o.hh, 1)} mm, vázový režim – vnější rozměr je přesný`]);
      if (o.zak) r.push(['Lem na hrdle', `Ø ${fmt(2 * (o.rh + o.presah), 2)}`, `${fmt(o.lemOd, 1)} mm nad tělem baňky, výška ${fmt(VANOCE.ZAKLAP.lem, 1)} mm`]);
      if (o.zak) r.push(['Ústí čepičky', `Ø ${fmt(2 * o.rl, 2)}`, `hrdlo + 2 × vůle ${fmt(p.banka.vule, 2)}; přes lem pruží o ${fmt(o.presah - p.banka.vule, 2)} mm`]);
      r.push(['Dutina čepičky', `Ø ${fmt(2 * o.rc, 2)}`, `hloubka ${fmt(o.hk, 1)} mm + kuželový strop 45°`]);
    }
    if (p.druh === 'hvezda' && p.hvezda.styl === 'zasouvaci') {
      r.push(['Šířka výřezu', fmt(o.vyrez, 2), `tloušťka ${fmt(p.hvezda.tloustka, 2)} + 2 × vůle ${fmt(p.hvezda.vule, 2)}`]);
      r.push(['Délka výřezu', fmt(o.yStred - o.yDno + p.hvezda.vule, 1), 'plát A zdola, plát B shora do stejné výšky']);
    }
    $('tabRozmery').innerHTML = r.length ? '<tr><th>Lícovaný prvek</th><th class="c">Rozměr</th><th>Pozn.</th></tr>' + r.map(x => `<tr><td>${esc(x[0])}</td><td class="c">${x[1]}</td><td>${esc(x[2])}</td></tr>`).join('') : '';
    const tit = { sestava: 'Ozdoba', tisk: 'Díly k tisku', kalibrace: 'Zkouška spoje' }[stavZobr.rezim];
    if (stavZobr.rezim === 'kalibrace' && model.kalibrace.length) {
      const zk = model.kalibrace[0], Rz = rozmer([zk]);
      karta.innerHTML = `<div class="titul">${tit}</div><b>${esc(zk.nazev)}</b><br><b>${fmt(Rz[0], 0)} × ${fmt(Rz[1], 0)} × ${fmt(Rz[2], 0)}</b> mm · ${zk.ks} ks<br>${fmt(zk.ks * hmotnost(zk), 1)} g`;
    } else karta.innerHTML = `<div class="titul">${tit}</div><b>${esc(N.druh[p.druh])}</b><br><b>${fmt(R[0], 0)} × ${fmt(R[1], 0)} × ${fmt(R[2], 0)}</b> mm<br>${fmt(g, 1)} g · ${od.minut < 60 ? od.minut + ' min' : fmt(od.minut / 60, 1) + ' h'}`;
    const kont = D.concat(model.kalibrace).map(d => ({ d, k: KRAB.kontrolaSite(d.poz, d.idx) }));
    $('vSit').innerHTML = kont.map(({ d, k }) => box('Síť', k.uzavrena ? '✔ těsná' : '✖ netěsná', `<span>${esc(d.nazev)}</span> · <span>${k.trojuhelniku} trojúhelníků</span>`, k.uzavrena ? 'ok-t' : 'chyba-t')).join('')
      + box('Stavba', `${model.cas} ms`, 'manifold-3d');
  }
  function vypisTisk() {
    const mat = material();
    let h = box('Materiál', mat.nazev, p.tisk.material === 'PLA' ? 'na stromek i do okna stačí' : 'odolnější teplu (okno na slunci)');
    h += box('Poloha', p.druh === 'banka' ? 'baňka dnem dolů' : 'naplocho', p.druh === 'banka' ? 'čepička otvorem dolů' : 'bez podpor');
    h += box('Doporučení', p.druh === 'banka' ? 'vázový režim' : p.druh === 'vlocka' ? '100 % výplň' : '3 perimetry, 20 %',
      p.druh === 'banka' ? 'baňka spirálou, čepička běžně' : p.druh === 'vlocka' ? 'tenká ramena jsou jen z perimetrů' : 'první vrstva pomalu');
    $('vTisk').innerHTML = h;
    $('napTisk').innerHTML = {
      vlocka: 'Vločka se tiskne <b>naplocho bez podpor</b>. Tenké prvky drží jen dobře přilepená první vrstva – čistá podložka, první vrstva pomalu, sundávat až po vychladnutí.',
      hvezda: p.hvezda.styl === 'zasouvaci' ? 'Oba pláty <b>naplocho</b>. Před celou hvězdou vytiskněte <b>zkoušku spoje</b> (dvě destičky se stejným výřezem) a podle ní dolaďte vůli.'
        : 'Hvězda se tiskne <b>naplocho bez podpor</b>, vypouklá rovnou stranou dolů.',
      banka: '<b>Baňka:</b> vázový režim (spirála), 1 stěna, 3–4 plné vrstvy dna, bez výplně a horních vrstev, chlazení naplno. <b>Čepička:</b> běžný tisk otvorem dolů, bez podpor. '
        + 'Lícování vylaďte <b>zkouškou spoje</b> – krátké hrdlo se tiskne také vázovým režimem.',
      jmenovka: 'Cedulka <b>naplocho</b>, text nahoře. Dvě barvy jednou tryskou: zastavte tisk ve výšce, kde začíná druhý díl (viz Kusovník), a vyměňte filament.',
    }[p.druh];
  }

  /* ---------- kusovník ---------- */
  function vypisKusovnik() {
    if (!model) { $('kusovnik').innerHTML = '<p class="napoveda">Kusovník se ukáže po sestavení modelu.</p>'; return; }
    $('kusovnik').innerHTML = '<table class="tabulka"><thead><tr><th>Díl</th><th class="c">Kusů</th><th class="c">Rozměr</th><th class="c">Výška od–do</th><th class="c">Hmotnost</th><th>Tisk</th></tr></thead><tbody>'
      + model.dily.map(d => {
        const b = G3D.obal(d.poz);
        return `<tr><td><span class="tecka" style="background:${barva(d)}"></span> ${esc(d.nazev)}</td><td class="c">${d.ks}</td><td class="c">${fmt(b[3] - b[0], 1)} × ${fmt(b[4] - b[1], 1)} × ${fmt(b[5] - b[2], 1)}</td>`
          + `<td class="c">${fmt(b[2], 2)}–${fmt(b[5], 2)}</td><td class="c">${fmt(hmotnost(d), 1)} g</td><td>${d.vaza ? 'vázový režim' : 'běžně'}</td></tr>`;
      }).join('') + '</tbody></table><p class="napoveda">Rozměry v tiskové poloze. Zavěšení: nit, provázek nebo háček se nekupuje s ozdobou – projde otvorem očka.</p>';
  }

  /* ---------- náhled ---------- */
  const kusy = () => VANOCE.kusyTisku(model, app.p);
  function zobraz(novyPohled) {
    document.querySelectorAll('[data-rezim]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.rezim === stavZobr.rezim)));
    if (!model) { nahled.nastav(null); return; }
    const r = stavZobr.rezim;
    if (r === 'tisk') nahled.nastav(obarvi(kusy()), { tisk: true, novyPohled, uhel: p.tisk.uhel });
    else if (r === 'kalibrace') nahled.nastav(model.kalibrace.length ? obarvi(VANOCE.kusyTisku(model, p, true)) : null, { tisk: true, novyPohled, uhel: p.tisk.uhel });
    else nahled.nastav(obarvi(model.sestava), { novyPohled });
    $('legPrevisy').hidden = !(r !== 'sestava' && nahled.stav.previsy);
  }
  function nastavRezim(r) {
    const tisk = $('tTisk').getAttribute('aria-pressed') === 'true', pred = stavZobr.rezim;
    stavZobr.rezim = r;
    if ((r === 'tisk') !== tisk) { $('tTisk').click(); return; }
    zobraz(pred !== r);
    if (model) vypisVysledky();
  }
  document.querySelectorAll('[data-rezim]').forEach(b => b.addEventListener('click', () => nastavRezim(b.dataset.rezim)));

  /* ---------- předvolby ---------- */
  TrubkyGui.pripoj({ klic: 'webapp_vanocni_ozdoby_gui', pohled: j => nahled.pohled(j) });
  {
    let skup = '';
    for (const v of VANOCE.PREDVOLBY) {
      if (v.skupina !== skup) { skup = v.skupina; const d = document.createElement('div'); d.className = 'nab-skupina'; d.textContent = skup; $('seznamPredvoleb').appendChild(d); }
      const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
      b.innerHTML = `${esc(v.nazev)}<span class="pozn">${esc(v.popis)}</span>`;
      b.addEventListener('click', () => {
        if (v.skupina === 'Druh ozdoby') { app.zmen(q => { q.druh = v.p.druh; }); app.naplnFormular(); return; }   // jen přepne druh, nastavení zůstane
        const q = VANOCE.predvolba(v.id);
        q.tisk = VANOCE.kopie(app.p.tisk);   // tisk zůstává uživatelův, barvy také (pokud je sada nemá vlastní)
        if (!v.p.barvy) q.barvy = VANOCE.kopie(app.p.barvy);
        app.nahrad(q);
      });
      $('seznamPredvoleb').appendChild(b);
    }
  }

  /* ---------- export ---------- */
  function lzeExport() {
    if (!model) { Dialog.chyba(chybaStavby || 'Geometrické jádro se ještě načítá.'); return false; }
    return true;
  }
  /** Barevný 3MF (klicenky/jadro.js): jmenovka = jeden objekt z dílů s vlastní barvou, ostatní díly samostatné objekty. */
  function soubor3mf() {
    const K = kusy(), skupiny = app.p.druh === 'jmenovka' ? [{ text: app.p.nazev || 'Jmenovka', dily: K }] : K.map(d => ({ text: d.nazev, dily: [d] }));
    return KLIC.soubor3mfBarevny(skupiny, app.p.nazev || 'Ozdoba', { podklad: app.p.barvy.podklad, text: app.p.barvy.text, ramecek: app.p.barvy.text });
  }
  function exportVse(co) {
    if (!lzeExport()) return;
    if (co === 'stl') app.stahni(KRAB.stlBinarni(kusy(), 'vanocni ozdoby - github_site'), app.jmeno('.stl'), 'model/stl');
    else app.stahni(soubor3mf(), app.jmeno('.3mf'), 'model/3mf');
  }
  $('btnStl').addEventListener('click', () => exportVse('stl'));
  $('btn3mf').addEventListener('click', () => exportVse('3mf'));
  function exportDilu() {
    const el = $('exportDilu'); el.innerHTML = '';
    if (!model || model.dily.length < 2) return;
    for (const d of model.dily) {
      const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
      b.innerHTML = `⬇ STL – ${esc(d.nazev)}`;
      b.addEventListener('click', () => app.stahni(KRAB.stlBinarni([d], 'vanocni ozdoby - ' + d.jmeno), app.jmeno('_' + d.jmeno + '.stl'), 'model/stl'));
      el.appendChild(b);
    }
  }
  function exportKalibrace() {
    if (!lzeExport()) return;
    if (!model.kalibrace.length) { Dialog.info('Zkouška spoje je jen u baňky (hrdlo pro čepičku) a u zasouvací hvězdy (destičky s výřezem).'); return; }
    app.stahni(KRAB.stlBinarni(VANOCE.kusyTisku(model, app.p, true), 'vanocni ozdoby - zkouska spoje'), app.jmeno('_zkouska.stl'), 'model/stl');
  }
  $('btnKalibrace').addEventListener('click', exportKalibrace);
  $('btnKalibrace2').addEventListener('click', exportKalibrace);

  app.prepinac('tRez', h => { nahled.prepni('rez', h); $('legRez').hidden = !h; });
  app.prepinac('tHrany', h => nahled.prepni('hrany', h));
  app.prepinac('tPrevisy', h => { nahled.prepni('previsy', h); $('legPrevisy').hidden = !(h && stavZobr.rezim !== 'sestava'); }, true);
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
      ok: w => { wasm = w; prestav(); },
      chyba: e => { chybaJadra = 'Geometrické jádro (manifold-3d) se nenačetlo: ' + (e && e.message || e) + ' – model ani export nejsou k dispozici.'; prestav(); },
    },
  });
  window.VANOCE_UI = { get p() { return app.p; }, get model() { return model; }, zmen: app.zmen, nahrad: app.nahrad, prestav, nahled, app, nastavRezim };
})();

/* Nástavce na sluchátka a špunty – ovládání stránky nad gen3d/aplikace.js
   (tady jen to, co je zvláštní: palety druhů a režimu, viditelnost polí, souhrny, výsledky, kusovník, exporty). */
/* global SLUCH, SLUCH_NAHLED, KRAB, G3D, Dialog, TrubkyGui */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const fmt = SLUCH.fmt;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  let p, wasm = null, model = null, chybaStavby = '', posledniDruh = null;
  const stavZobr = { tisk: false };
  const nahled = SLUCH_NAHLED.vytvorNahled($('platno'));

  const app = G3D.aplikace({
    typ: 'sluchatka', nazev: 'Nástavce na sluchátka', klic: 'webapp_sluchatka', soubor: 'nastavec',
    normalizuj: SLUCH.normalizuj, vychozi: () => SLUCH.predvolba('cerv'),
    ulozProjekt: SLUCH.ulozProjekt, nactiProjekt: SLUCH.nactiProjekt, popis: SLUCH.popis,
    vezmi: SLUCH.vezmi, poloz: SLUCH.poloz,
    viditelnost: () => viditelnost(),
    prepocitej: () => prepocitej(),
    png: () => nahled.png(), pohled: j => nahled.pohled(j),
    exportStl: () => exportStl(),
    nahodny: q => nahodny(q),
    doModelare: () => (lzeExport() ? { data: KRAB.soubor3mf(kusy(), app.p.nazev || 'Nástavec'), pripona: '.3mf' } : null),
    zkratky: { r: 'tRez', h: 'tHrany', m: 'tTisk', p: 'tPrevisy', l: 'tPravitka', u: 'tDuch' },
    zmenaTematu: () => prepocitej(),
  });

  /* ---------- nabídky formuláře ---------- */
  const moznosti = (sel, obj) => { sel.innerHTML = Object.entries(obj).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join(''); };
  moznosti($('f_stvar'), SLUCH.NAZVY.spicka);
  moznosti($('f_btvar'), SLUCH.NAZVY.tvarTela);
  moznosti($('f_bkabel'), SLUCH.NAZVY.kabel);
  moznosti($('f_deleni'), SLUCH.NAZVY.deleni);
  moznosti($('f_aptvar'), SLUCH.NAZVY.prurez);
  moznosti($('f_apuch'), SLUCH.NAZVY.uchyceni);
  $('f_ap').innerHTML = SLUCH.AIRPODS.map(a => `<option value="${a.id}">${esc(a.nazev)}</option>`).join('') + '<option value="vlastni">vlastní rozměry</option>';
  $('f_ap').addEventListener('change', e => app.nahrad(SLUCH.nastavAirpods(app.p, e.target.value)));
  const mat = Object.fromEntries(Object.entries(SLUCH.MATERIALY).map(([k, m]) => [k, m.nazev]));
  moznosti($('f_material'), mat);
  moznosti($('f_materialS'), mat);
  $('f_db').innerHTML = '<option value="">— vyberte, nebo zadejte změřené —</option>' + SLUCH.SLUCHATKA.map(s => `<option value="${s.id}">${esc(s.nazev)}</option>`).join('');
  $('f_db').addEventListener('change', e => { if (e.target.value) { app.nahrad(SLUCH.nastavSluchatko(app.p, e.target.value)); } e.target.value = ''; });

  $('paletaDruhu').innerHTML = Object.entries(SLUCH.DRUHY).map(([k, d]) => `<button type="button" data-druh="${k}"><span aria-hidden="true">${d.emoji}</span><span>${esc(d.nazev)}</span></button>`).join('');
  $('paletaDruhu').addEventListener('click', e => {
    const b = e.target.closest('[data-druh]');
    if (b && b.dataset.druh !== app.p.ozdoba.druh) app.nahrad(SLUCH.prepniDruh(app.p, b.dataset.druh));
  });
  $('paletaRezimu').addEventListener('click', e => {
    const b = e.target.closest('[data-rezim]');
    if (!b || b.dataset.rezim === app.p.rezim) return;
    app.zmen(q => { q.rezim = b.dataset.rezim; if (q.rezim === 'spunt') q.spicka.kanal = 0; else if (q.spicka.kanal < 1.5) q.spicka.kanal = 2.8; });
    app.naplnFormular();
  });

  const NAP_DRUH = {
    cerv: 'Žížala s kroužky, opaskem a očima leze z ucha ve vlnkách – rozkmit a počet vln nastavíte.',
    prst: 'Prst trčí z ucha, nehet má na špičce, vrásky na kloubech. Pokrčení se rozdělí do dvou kloubů.',
    papricka: 'Chilli paprička s kalichem u ucha, špička se zahýbá.',
    chapadlo: 'Chapadlo s přísavkami na vnitřní straně, stočení přibývá ke špičce.',
    roh: 'Kroucený roh jednorožce: počet žeber a zkroucení (stupně za celou délku).',
    mrkev: 'Mrkev – špička je „v uchu“, ven trčí horní část s rýhami a natí.',
    kost: 'Kost skrz ucho s kloubními hlavicemi nahoře.',
    kaktus: 'Žebrovaný kaktus se dvěma rameny a trnovými polštářky.',
    ulita: 'Šnek leze z ucha – tělo, ulita na zádech a oční tykadla.',
    srdce: 'Nafouklé srdíčko, špičkou v uchu.',
    svicka: 'Ušní svíčka s rozteklým voskem, kapkami a plamenem.',
    had: 'Had se šupinami, plochou hlavou, očima a rozeklým jazykem se vlní z ucha – rozkmit a počet vln nastavíte.',
    banan: 'Banán s hranami a stopkou, prohnutí nastavíte.',
    ryba: 'Ryba skočila do ucha – ven kouká zadní půlka se šupinami, hřbetní a ocasní ploutví.',
    klicek: 'Z ucha raší klíček se dvěma lístky (do 40° od svislice – tiskne se nastojato).',
    tuzka: 'Šestiboká tužka zapíchnutá v uchu, nahoře plechová objímka s rýhami a guma.',
    houba: 'Muchomůrka s prstenem na noze, puntíky na klobouku a lupeny zespodu.',
    lizatko: 'Lízátko s nafouklým kotoučem a spirálou; tloušťka zvětší tyčinku i kotouč.',
    mys: 'Myš mizí v uchu – ven trčí zadeček, kopající zadní nožky a dlouhý ocas.',
    tykadla: 'Tykadla s kuličkami – kulička má zespodu kužel 45°, takže se tiskne nastojato.',
    zadna: 'Bez ozdoby – jen pouzdro / podstava s kuželem, třeba jako kryt nebo základ pro vlastní úpravy v Modeláři.',
  };

  function viditelnost() {
    p = app.p;
    const sl = p.rezim === 'sluchatka', D = SLUCH.DRUHY[p.ozdoba.druh], prir = ['hrib', 'dvojity', 'trojity'].includes(p.spicka.tvar);
    document.querySelectorAll('[data-rezimy]').forEach(el => { el.hidden = !el.dataset.rezimy.split(' ').includes(p.rezim); });
    document.querySelectorAll('[data-priruba]').forEach(el => { el.hidden = !prir; });
    document.querySelectorAll('[data-oval]').forEach(el => { el.hidden = p.telo.tvar !== 'oval'; });
    document.querySelectorAll('[data-kabel]').forEach(el => { el.hidden = p.telo.kabel !== 'bokem'; });
    document.querySelectorAll('[data-lem]').forEach(el => { el.hidden = !(p.trn.lem > 0); });
    document.querySelectorAll('[data-rozmer]').forEach(el => { el.hidden = !!D.bezRozmeru; });
    $('pOhyb').hidden = !D.ohybPopis; $('pPocet').hidden = !D.pocetPopis;
    $('lOhyb').textContent = D.ohybPopis || 'Ohyb';
    $('lPocet').textContent = D.pocetPopis || 'Počet';
    $('lTloustka').textContent = { srdce: 'Tloušťka srdce', tykadla: 'Ø kuliček', ulita: 'Šířka', kaktus: 'Šířka s rameny', mrkev: 'Ø mrkve', kost: 'Ø kosti', had: 'Ø hada', banan: 'Ø banánu', ryba: 'Šířka', klicek: 'Ø stonku', tuzka: 'Šířka tužky', houba: 'Ø nohy', lizatko: 'Ø tyčinky', mys: 'Šířka' }[p.ozdoba.druh] || 'Tloušťka (Ø)';
    $('lSirka').textContent = p.telo.tvar === 'oval' ? 'Šířka těla' : 'Průměr těla';
    $('nSpicka').textContent = sl ? 'Ušní špička' : 'Špunt do ucha';
    $('lMaterialS').textContent = sl ? 'Materiál špičky' : 'Materiál špuntu';
    $('pKolik').hidden = p.tisk.deleni === 'cela';
    $('napOzdoba').textContent = NAP_DRUH[p.ozdoba.druh] + (D.meze && D.meze.ohyb ? ` ${D.ohybPopis}: rozumně ${D.meze.ohyb[0]}–${D.meze.ohyb[1]}°.` : '');
    $('napSpicka').textContent = {
      hrib: 'Jedna příruba jako deštník – nejběžnější, nejlíp sedí v uchu střední velikosti.',
      dvojity: 'Dvě příruby za sebou – drží pevněji a líp těsní.',
      trojity: 'Tři příruby (menší vpředu) – nejlíp drží v uchu, hodí se k těžším ozdobám.',
      olivka: 'Plné tělo jako pěnová špička – jednoduché, z TPU 85A pohodlné.',
      kuzel: 'Kužel – jde hluboko a sám se vystředí; u špuntu je to „špička mrkve“.',
    }[p.spicka.tvar];
    document.querySelectorAll('#paletaDruhu button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.druh === p.ozdoba.druh)));
    $('f_ap').value = p.airpods.model;
    const naHlave = p.rezim === 'airpods' && p.airpods.uchyceni === 'hlava';
    document.querySelectorAll('[data-hlava]').forEach(el => { el.hidden = !naHlave; });
    // čep a materiál druhého dílu: špunt, nebo klip s ramenem
    document.querySelector('[data-oddil="cep"]').hidden = !(p.rezim === 'spunt' || naHlave);
    $('f_vcep').closest('.pole').hidden = !(p.rezim === 'spunt' || naHlave);
    $('f_materialS').closest('.pole').hidden = p.rezim === 'airpods' && !naHlave;
    if (naHlave) $('lMaterialS').textContent = 'Materiál klipu';
    document.querySelectorAll('#paletaRezimu button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.rezim === p.rezim)));
  }

  /* ---------- přepočet ---------- */
  function prepocitej() {
    p = app.p;
    nahled.barvy(css('--border-strong'), css('--border'), css('--text'));
    let H = SLUCH.kontroly(p);
    model = null;
    const chybi = SLUCH.chybiTvar(p);
    if (chybi) nactiTvar(chybi);
    if (wasm && !chybi) {
      try {
        model = SLUCH.postav(wasm, p);
        H = H.concat(SLUCH.kontrolyModelu(p, model));
        chybaStavby = '';
      } catch (e) { chybaStavby = 'Model nelze sestavit: ' + (e && e.message || e); }
    }
    const st = $('stav3d');
    st.textContent = chybaStavby || (!wasm ? 'Načítám geometrické jádro…' : chybi ? 'Načítám tvar ozdoby…' : '');
    st.classList.toggle('chyba', !!chybaStavby);
    const jiny = model && posledniDruh !== p.ozdoba.druh + p.rezim;   // jiná ozdoba = nový záběr kamery
    if (model) { nahled.nastav(stavZobr.tisk ? kusy() : model.dily, { tisk: stavZobr.tisk, uhel: p.tisk.uhel, novyPohled: jiny && posledniDruh !== null }); posledniDruh = p.ozdoba.druh + p.rezim; }
    else nahled.nastav(null);
    app.hlaseni(H, { chybaStavby, boxy: ['boxOzdoba', 'boxUcho'] });
    vypisVysledky();
    souhrny();
    kusovnik();
    exportDilu();
  }
  /** Tvar z Blenderu se načte skriptem až při prvním použití (funguje i z file://). */
  const nacitane = {};
  function nactiTvar(druh) {
    if (nacitane[druh]) return;
    nacitane[druh] = true;
    const sc = document.createElement('script');
    sc.src = 'sluchatka/tvary/' + druh + '.js';
    sc.onload = () => prepocitej();
    sc.onerror = () => { chybaStavby = `Tvar ozdoby „${druh}“ se nepodařilo načíst – zkontrolujte připojení a obnovte stránku.`; nacitane[druh] = false; prepocitej(); };
    document.head.appendChild(sc);
  }
  function souhrny() {
    const D = SLUCH.DRUHY[p.ozdoba.druh], o = SLUCH.odvozene(p), sl = o.sluch;
    TrubkyGui.souhrn('sOzdoba', D.bezRozmeru ? D.nazev : `${D.emoji} ${fmt(p.ozdoba.delka)} × Ø ${fmt(p.ozdoba.tloustka)}`, true);
    TrubkyGui.souhrn('sSpicka', `${SLUCH.NAZVY.spicka[p.spicka.tvar].split(' –')[0]} Ø ${fmt(p.spicka.prumer)} × ${fmt(p.spicka.delka)}`, true);
    TrubkyGui.souhrn('sTrn', `Ø ${fmt(p.trn.prumer, 2)}${p.trn.lem > 0 ? ` · lem ${fmt(p.trn.lem, 2)}` : ''} · přesah ${fmt(p.trn.presah, 2)}`, true);
    TrubkyGui.souhrn('sTelo', `${p.telo.tvar === 'oval' ? `${fmt(p.telo.sirka)} × ${fmt(p.telo.vyska)}` : 'Ø ' + fmt(p.telo.sirka)} · pouzdro ${fmt(p.telo.hloubka)} mm${p.telo.kabel === 'bokem' ? ' · kabel' : ''}`, true);
    { const a = SLUCH.AIRPODS.find(x => x.id === p.airpods.model); TrubkyGui.souhrn('sAir', `${a ? a.nazev.replace(/ \(.*\)$/, '') : 'vlastní'} · ${fmt(p.airpods.sirka, 1)} × ${fmt(p.airpods.hloubka, 1)} · klip ${fmt(p.airpods.klip)} mm`, true); }
    TrubkyGui.souhrn('sCep', `Ø ${fmt(p.cep.prumer)} × ${fmt(p.cep.delka)}`, true);
    TrubkyGui.souhrn('sVule', o.air ? `nožička ${fmt(p.airpods.vule, 2)} · +${fmt(p.vule.kompenzace, 2)}` : sl ? `pouzdro ${fmt(p.vule.telo, 2)} · +${fmt(p.vule.kompenzace, 2)}` : `čep ${fmt(p.vule.cep, 2)} · +${fmt(p.vule.kompenzace, 2)}`, true);
    $('sTisk').textContent = model ? (model.deleni === 'pulky' ? 'půlky' : 'celá') : '';
    const r = [];
    if (o.air) {
      r.push(['Dutina klipu nahoře', `${fmt(2 * o.kHor[0], 2)} × ${fmt(2 * o.kHor[1], 2)}`, SLUCH.NAZVY.prurez[p.airpods.tvar]]);
      r.push(['Dutina klipu dole', `${fmt(2 * o.kDol[0], 2)} × ${fmt(2 * o.kDol[1], 2)}`, `délka ${fmt(p.airpods.klip, 1)}`]);
      r.push(['Štěrbina', `${fmt(o.otevreni, 2)}`, `${fmt(p.airpods.otevreni, 0)} % šířky`]);
      if (o.naHlave) {
        r.push(['Čep (kapka)', `Ø ${fmt(2 * o.rc, 2)}`, `délka ${fmt(p.cep.delka, 1)}, hrot k nožičce`]);
        r.push(['Díra v ozdobě', `Ø ${fmt(2 * o.rd, 2)}`, `hl. ${fmt(p.cep.delka + 0.3, 1)}`]);
        r.push(['Podložka nad hlavou', `${fmt(o.zPad - (o.hlava.zc + o.hlava.hz / 2), 2)}`, 'mezera nad hlavou (mm)']);
      }
    } else if (sl) {
      r.push(['Otvor na nátrubek', `Ø ${fmt(2 * o.rb, 2)}`, `hl. ${fmt(p.trn.hloubka, 1)}`]);
      if (o.rl > o.rb) r.push(['Drážka lemu', `Ø ${fmt(2 * o.rl, 2)}`, `výška ${fmt(p.trn.lemVyska, 1)}, boky 45°`]);
      if (o.kanal > 0) r.push(['Zvukový kanál', `Ø ${fmt(2 * o.kanal, 2)}`, '']);
      r.push(['Dutina pouzdra', p.telo.tvar === 'oval' ? `${fmt(2 * o.a, 2)} × ${fmt(2 * o.b, 2)}` : `Ø ${fmt(2 * o.a, 2)}`, `hl. ${fmt(p.telo.hloubka, 1)}`]);
    } else {
      r.push(['Čep špuntu', `Ø ${fmt(2 * o.rc, 2)}`, `délka ${fmt(p.cep.delka, 1)}`]);
      r.push(['Díra v ozdobě', `Ø ${fmt(2 * o.rd, 2)}`, `hl. ${fmt(p.cep.delka + 0.3, 1)}`]);
    }
    if (!o.air) r.push(['Dřík špičky', `Ø ${fmt(2 * o.rs, 2)}`, o.priruby ? `${o.priruby.length}× příruba, min. délka ${fmt(o.Lmin, 1)}` : `min. délka ${fmt(o.Lmin, 1)}`]);
    $('tabRozmery').innerHTML = '<tr><th>Prvek</th><th class="c">Rozměr</th><th>Pozn.</th></tr>' + r.map(x => `<tr><td>${x[0]}</td><td class="c">${x[1]}</td><td>${x[2]}</td></tr>`).join('');
  }
  const box = G3D.dlazdice || app.dlazdice;
  const obal = d => G3D.obal(d.poz);
  function vypisVysledky() {
    const el = $('vVysledky'), karta = $('karta3d');
    if (!model) { el.innerHTML = box('Model', wasm ? 'nelze sestavit' : 'načítám…', chybaStavby); karta.innerHTML = ''; $('vSit').innerHTML = ''; return; }
    const D = SLUCH.DRUHY[p.ozdoba.druh], M = SLUCH.MATERIALY, sp = model.dily.find(d => d.jmeno === 'spicka' || d.jmeno === 'klip'), oz = model.dily.find(d => d.jmeno === 'ozdoba');
    const b = obal(oz), bs = sp ? obal(sp) : [0, 0, 0, 0, 0, 0], pk = SLUCH.paka(p, model), air = model.o.air;
    const ozd = model.tisk.filter(d => d.material === 'ozdoba'), spi = model.tisk.filter(d => d.material === 'spicka');
    const Vo = ozd.reduce((s, d) => s + d.objem, 0), Vs = spi.reduce((s, d) => s + d.objem, 0);
    const f = Math.min(1, 0.45 + 0.55 * p.tisk.vypln / 100);
    const tOz = G3D.odhadTisku(Vo * f, M[p.tisk.material].hustota, { dilu: ozd.length }), tSp = G3D.odhadTisku(Vs, M[p.tisk.materialSpicky].hustota, { dilu: spi.length });
    const par = p.tisk.par ? ' (pár)' : '';
    let h = box(air ? 'Klip s ozdobou' : 'Ozdoba / pouzdro', `${fmt(b[3] - b[0])} × ${fmt(b[4] - b[1])} × ${fmt(b[5] - b[2])} mm`, `${D.emoji} ${D.nazev}, š × h × v`);
    if (sp && !air) h += box(model.o.sluch ? 'Ušní špička' : 'Špunt', `Ø ${fmt(bs[3] - bs[0])} × ${fmt(bs[5] - bs[2])} mm`, SLUCH.NAZVY.spicka[p.spicka.tvar]);
    else { const a = SLUCH.AIRPODS.find(x => x.id === p.airpods.model); h += box('Na nožičku', a ? a.nazev : 'vlastní rozměry', `${fmt(p.airpods.sirka, 1)} × ${fmt(p.airpods.hloubka, 1)} mm, klip ${fmt(p.airpods.klip)} mm, střed ${fmt(p.airpods.poloha)} mm od hlavy`); }
    h += box('Hmotnost' + par, sp ? `${fmt(tOz.g, 1)} + ${fmt(tSp.g, 1)} g` : `${fmt(tOz.g, 1)} g`, `ozdoba ${M[p.tisk.material].nazev} při ${fmt(p.tisk.vypln, 0)} % výplni` + (sp ? ` + ${air ? 'klip' : model.o.sluch ? 'špička' : 'špunt'} ${M[p.tisk.materialSpicky].nazev} plná` : ''));
    h += box('Filament' + par, sp ? `${fmt(tOz.metru, 2)} + ${fmt(tSp.metru, 2)} m` : `${fmt(tOz.metru, 2)} m`, 'Ø 1,75 mm, hrubý odhad');
    const min = tOz.minut + (sp ? tSp.minut * 2.5 : 0);
    h += box('Doba tisku' + par, `≈ ${min < 60 ? Math.round(min) + ' min' : fmt(min / 60, 1) + ' h'}`, 'TPU pomalu (×2,5), hrubý odhad');
    h += box('Tisk ozdoby', model.deleni === 'pulky' ? 'dvě půlky naplocho' : 'celá nastojato', p.tisk.deleni === 'auto' ? `vybráno automaticky${model.previsPulky !== null ? ` (převisy ${fmt(model.previsCela, 0)} / ${fmt(model.previsPulky, 0)} mm²)` : ''}` : 'zadáno ručně');
    const tr = pk.moment > 1.2 ? 'mez-t' : 'ok-t';
    h += box('Páka na ucho', `${fmt(pk.moment, 2)} mN·m`, `${fmt(pk.g, 1)} g, těžiště ${fmt(pk.rameno, 0)} mm od ${air ? 'klipu' : 'čela'}${pk.moment > 1.2 ? ' – může vypadávat' : ' – drží'} (orientačně)`, tr);
    el.innerHTML = h;
    karta.innerHTML = `<div class="titul">${D.emoji} ${esc(D.nazev)}</div><b>${fmt(b[5] - b[2] + (sp ? bs[5] - bs[2] : 0))}</b> mm celkem · <b>${fmt(tOz.g, 1)}</b> g<br>`
      + `${esc(SLUCH.NAZVY.rezim[p.rezim])}<br>${model.deleni === 'pulky' ? 'ozdoba na dvě půlky' : 'ozdoba celá'}${p.tisk.par ? ' · pár' : ''}`;
    $('vSit').innerHTML = model.tisk.filter(d => !/_L$|_2$/.test(d.jmeno)).map(d => {
      const k = KRAB.kontrolaSite(d.poz, d.idx);
      return box('Síť – ' + d.nazev, k.uzavrena ? '✔ těsná' : '✖ netěsná', `${k.trojuhelniku} trojúhelníků, ${d.teles} těleso`, k.uzavrena && d.teles === 1 ? 'ok-t' : 'chyba-t');
    }).join('') + box('Výpočet', `${model.cas} ms`, 'manifold-3d');
  }
  function kusovnik() {
    const t = $('tabKusovnik');
    if (!model) { t.innerHTML = ''; return; }
    const M = SLUCH.MATERIALY, r = [];
    const n = p.tisk.par ? 2 : 1, sl = model.o.sluch;
    const air = model.o.air;
    if (!air) r.push([sl ? 'Ušní špička' : 'Špunt s čepem', M[p.tisk.materialSpicky].nazev, n, 'ušním koncem dolů, bez podpor']);
    const naHlave = air && model.o.naHlave;
    if (naHlave) r.push(['Klip s ramenem a čepem', M[p.tisk.materialSpicky].nazev, n, 'nožičkou dolů, bez podpor']);
    if (model.deleni === 'pulky') r.push([air && !naHlave ? 'Klip s ozdobou – půlky A + B' : 'Ozdoba – půlky A + B', M[p.tisk.material].nazev, 2 * n, (p.tisk.par ? 'pravá + levá zrcadlově, ' : '') + 'řezem na podložku']);
    else r.push([air && !naHlave ? 'Klip s ozdobou' : sl ? 'Pouzdro s ozdobou' : 'Ozdoba s dírou pro čep', M[p.tisk.material].nazev, n, (p.tisk.par ? 'pravá + levá zrcadlově, ' : '') + (air && !naHlave ? 'rty klipu na podložku' : sl ? 'dnem pouzdra dolů' : 'podstavou dolů')]);
    if (model.koliky.length) r.push(['Kolík z filamentu 1,75 mm', 'filament', model.koliky.length * n, `délka ${fmt(2 * Math.min(...model.koliky.map(q => q.hl)) - 0.4, 1)} mm`]);
    if (model.deleni === 'pulky') r.push(['Vteřinové lepidlo', '–', '–', 'na slepení půlek']);
    if (!sl && (!air || naHlave)) r.push(['Lepidlo (volitelně)', '–', '–', 'kapka na čep, má-li ozdoba držet napevno']);
    t.innerHTML = '<tr><th>Díl</th><th>Materiál</th><th class="c">Ks</th><th>Poznámka</th></tr>' + r.map(x => `<tr><td>${esc(x[0])}</td><td>${esc(x[1])}</td><td class="c">${x[2]}</td><td>${esc(x[3])}</td></tr>`).join('');
  }

  /* ---------- předvolby, náhoda ---------- */
  TrubkyGui.pripoj({ klic: 'webapp_sluchatka_gui', pohled: j => nahled.pohled(j) });
  (() => {
    const el = $('seznamPredvoleb');
    let skup = '';
    const nadpis = t => { const d = document.createElement('div'); d.className = 'nab-nadpis'; d.textContent = t; el.appendChild(d); };
    for (const v of SLUCH.PREDVOLBY) {
      if (v.skupina !== skup) { skup = v.skupina; nadpis(skup); }
      const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
      b.innerHTML = `${esc(v.nazev)}<span class="pozn">${esc(v.popis)}</span>`;
      b.addEventListener('click', () => { const q = SLUCH.predvolba(v.id); q.vule = SLUCH.kopie(app.p.vule); q.tisk = Object.assign(SLUCH.kopie(app.p.tisk), { deleni: 'auto' }); app.nahrad(q); });
      el.appendChild(b);
    }
  })();
  function nahodny(q0) {
    const r = Math.random, vyber = a => a[Math.floor(r() * a.length)];
    const druhy = Object.keys(SLUCH.DRUHY).filter(k => k !== 'zadna'), druh = vyber(druhy), D = SLUCH.DRUHY[druh];
    const q = SLUCH.prepniDruh(q0, druh);
    q.ozdoba.delka = Math.round(D.L * (0.8 + 0.4 * r()));
    q.ozdoba.tloustka = Math.round(D.T * (0.85 + 0.3 * r()) * 2) / 2;
    if (D.meze.ohyb) q.ozdoba.ohyb = Math.round(D.meze.ohyb[0] + (D.meze.ohyb[1] - D.meze.ohyb[0]) * (0.2 + 0.7 * r()));
    if (D.meze.pocet) q.ozdoba.pocet = D.meze.pocet[0] + Math.floor(r() * (D.meze.pocet[1] - D.meze.pocet[0] + 1));
    q.ozdoba.natoceni = vyber([0, 0, 45, 90, -45]);
    q.spicka.tvar = vyber(Object.keys(SLUCH.NAZVY.spicka));
    q.spicka.delka = Math.max(q.spicka.delka, Math.ceil(SLUCH.odvozene(q).Lmin * 10) / 10);
    q.nazev = `${D.nazev} – nápad`;
    return SLUCH.normalizuj(q).p;
  }

  /* ---------- export ---------- */
  function lzeExport() {
    if (!model) { Dialog.chyba(chybaStavby || 'Geometrické jádro se ještě načítá.'); return false; }
    return true;
  }
  const kusy = (dily = model.tisk) => G3D.tiskoveRozlozeni(dily, 1, 5);
  function exportStl() { if (lzeExport()) app.stahni(KRAB.stlBinarni(kusy(), 'sluchatka - github_site'), app.jmeno('.stl'), 'model/stl'); }
  $('btnStl').addEventListener('click', exportStl);
  $('btn3mf').addEventListener('click', () => { if (lzeExport()) app.stahni(KRAB.soubor3mf(kusy(), app.p.nazev || 'Nástavec'), app.jmeno('.3mf'), 'model/3mf'); });
  $('btnKalibrace').addEventListener('click', () => {
    if (!lzeExport()) return;
    try {
      const kal = SLUCH.postav(wasm, app.p, { kalibrace: true }).kalibrace;
      app.stahni(KRAB.stlBinarni(G3D.tiskoveRozlozeni(kal, 1, 5), 'sluchatka - kalibrace'), app.jmeno('_kalibrace.stl'), 'model/stl');
    } catch (e) { Dialog.chyba('Kalibrační vzorek nelze sestavit: ' + (e && e.message || e)); }
  });
  /** Díly podle materiálu (TPU a tvrdý plast se tisknou zvlášť). */
  function exportDilu() {
    const el = $('exportDilu'); el.innerHTML = '';
    if (!model) return;
    const M = SLUCH.MATERIALY;
    for (const [mat, text, mp] of [['spicka', model.o.air ? 'klipy' : model.o.sluch ? 'špičky' : 'špunty', M[app.p.tisk.materialSpicky].nazev], ['ozdoba', model.deleni === 'pulky' ? 'půlky ozdob' : 'ozdoby', M[app.p.tisk.material].nazev]]) {
      const d = model.tisk.filter(x => x.material === mat);
      if (!d.length) continue;
      const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
      b.innerHTML = `⬇ STL – ${text}<span class="pozn">${d.length} ks · ${esc(mp)}</span>`;
      b.addEventListener('click', () => app.stahni(KRAB.stlBinarni(kusy(d), 'sluchatka - ' + mat), app.jmeno('_' + mat + '.stl'), 'model/stl'));
      el.appendChild(b);
    }
  }
  app.prepinac('tRez', h => { nahled.prepni('rez', h); $('legRez').hidden = !h; });
  app.prepinac('tHrany', h => nahled.prepni('hrany', h));
  app.prepinac('tDuch', h => nahled.prepni('duch', h), true);
  app.prepinac('tPrevisy', h => { nahled.prepni('previsy', h); $('legPrevisy').hidden = !(h && stavZobr.tisk); }, true);
  app.prepinac('tPravitka', h => nahled.prepni('pravitka', h), true);
  app.prepinac('tTisk', h => {
    stavZobr.tisk = h;
    $('legPrevisy').hidden = !(h && nahled.stav.previsy);
    if (model) nahled.nastav(h ? kusy() : model.dily, { tisk: h, novyPohled: true, uhel: app.p.tisk.uhel });
  });

  /* ---------- start ---------- */
  app.start({
    manifold: {
      ok: w => { wasm = w; prepocitej(); },
      chyba: e => { chybaStavby = 'Geometrické jádro (manifold-3d) se nenačetlo: ' + (e && e.message || e) + ' – model ani export nejsou k dispozici.'; prepocitej(); },
    },
  });
  window.SLUCH_UI = { get p() { return app.p; }, get model() { return model; }, zmen: app.zmen, nahrad: app.nahrad, naplnFormular: app.naplnFormular, prepocitej, nahled, app };
})();

/* Knoflíky a hlavice – ovládání stránky: formulář, historie, nabídky, manifold, náhled, výsledky, kontroly, export. */
/* global KNOF, KNOF_NAHLED, KRAB, Dialog, Tvary, TrubkyGui */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const KLIC = 'webapp_knofliky_projekt';
  const fmt = KNOF.fmt;
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  /* ---------- manifold ---------- */
  function nactiSkript(src) {
    return new Promise((ok, chyba) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => chyba(new Error('nelze načíst ' + src)); document.head.appendChild(s); });
  }
  async function nactiManifold() {
    globalThis.MANIFOLD_URL = new URL('lib/manifold/manifold.klasicky.js', location.href).href;
    if (!globalThis.ManifoldModule) await nactiSkript('lib/manifold/manifold.klasicky.js');
    let volby;
    if (location.protocol === 'file:') {
      await nactiSkript('lib/manifold/manifold.wasm.js');
      const s = atob(globalThis.MANIFOLD_WASM_B64), bin = new Uint8Array(s.length);
      for (let i = 0; i < s.length; i++) bin[i] = s.charCodeAt(i);
      delete globalThis.MANIFOLD_WASM_B64;
      volby = { wasmBinary: bin };
    } else volby = { locateFile: f => new URL('lib/manifold/' + f, location.href).href };
    const w = await globalThis.ManifoldModule(volby);
    w.setup();
    return w;
  }

  /* ---------- stav a historie ---------- */
  let p, wasm = null, model = null, tiskDily = null, chybaStavby = '';
  const zpet = [], znovu = [];
  function nactiUlozeny() {
    try { const t = localStorage.getItem(KLIC); if (t) return KNOF.normalizuj(JSON.parse(t)).p; } catch (e) { /* bez úložiště */ }
    return KNOF.predvolba('pot_d');
  }
  const uloz = () => { try { localStorage.setItem(KLIC, JSON.stringify(p)); } catch (e) { /* bez úložiště */ } };
  function zmen(f) {
    zpet.push(JSON.stringify(p)); if (zpet.length > 80) zpet.shift(); znovu.length = 0;
    f(p); p = KNOF.normalizuj(p).p;
    uloz(); obnovTlacitka(); prepocitej();
  }
  function krokHistorie(z, do_) {
    if (!z.length) return;
    do_.push(JSON.stringify(p)); p = JSON.parse(z.pop());
    uloz(); obnovTlacitka(); naplnFormular(); prepocitej();
  }
  function obnovTlacitka() { $('btnZpet').disabled = !zpet.length; $('btnZnovu').disabled = !znovu.length; }
  function nahrad(q) { zmen(x => { Object.keys(x).forEach(k => delete x[k]); Object.assign(x, KNOF.kopie(q)); }); naplnFormular(); }

  /* ---------- formulář ---------- */
  const zobrazCislo = x => (Number.isFinite(x) ? String(Math.round(x * 1e4) / 1e4).replace('.', ',') : '');
  const ctiCislo = s => { const t = String(s).trim().replace(/\s/g, '').replace(',', '.').replace('−', '-'); return t === '' ? NaN : Number(t); };
  function moznosti(sel, polozky) {
    const h = sel.value;
    sel.innerHTML = '';
    for (const [v, t] of polozky) { const o = document.createElement('option'); o.value = v; o.textContent = t; sel.appendChild(o); }
    sel.value = h;
  }
  function naplnFormular() {
    moznosti($('f_utyp'), KNOF.TYPY[p.typ].uchopy.map(u => [u, KNOF.NAZVY.uchop[u]]));
    moznosti($('f_uptyp'), KNOF.TYPY[p.typ].upevneni.map(u => [u, KNOF.NAZVY.upevneni[u]]));
    document.querySelectorAll('[data-p]').forEach(el => {
      const h = KNOF.vezmi(p, el.dataset.p);
      if (el.dataset.typ === 'bool') el.checked = !!h;
      else if (el.dataset.typ === 'text') el.value = h == null ? '' : h;
      else el.value = el.tagName === 'SELECT' ? String(h) : zobrazCislo(h);
      el.classList.remove('spatne');
    });
    viditelnost();
  }
  const seznam = a => (a || '').split(/\s+/).filter(Boolean);
  /** Pole a oddíly jen pro daný typ, úchop, upevnění, tvar knopky a rukojeť. */
  function viditelnost() {
    const u = p.upevneni.typ, o = KNOF.odvozene(p);
    document.querySelectorAll('[data-typy],[data-netypy],[data-uchopy],[data-neuchop],[data-upev],[data-knopka],[data-neknopka],[data-ruk]').forEach(el => {
      const d = el.dataset;
      let vid = true;
      if (d.typy && !seznam(d.typy).includes(p.typ)) vid = false;
      if (d.netypy && seznam(d.netypy).includes(p.typ)) vid = false;
      if (d.uchopy && !seznam(d.uchopy).includes(p.uchop.typ)) vid = false;
      if (d.neuchop && p.typ === 'sroub' && seznam(d.neuchop).includes(p.uchop.typ)) vid = false;
      if (d.upev && !seznam(d.upev).includes(u)) vid = false;
      if (d.knopka && (p.typ !== 'knopka' || !seznam(d.knopka).includes(p.knopka.tvar))) vid = false;
      if (d.neknopka && p.typ === 'knopka' && seznam(d.neknopka).includes(p.knopka.tvar)) vid = false;
      if (d.ruk && !seznam(d.ruk).includes(p.rukojet.typ)) vid = false;
      el.hidden = !vid;
    });
    $('gSukne').hidden = !p.sukne.pouzit;
    // hloubka: hřídel, vrut, šroub nad maticí (knopka, neprůchozí hlavice)
    const hl = ['D', 'vroubek', 'hladka', 'vrut'].includes(u) || (u === 'matice' && (p.typ === 'knopka' || (p.typ === 'sroub' && o.vlozeni === 'zespodu' && !p.upevneni.pruchozi)));
    $('pHloubka').hidden = !hl;
    $('lHloubka').textContent = ['D', 'vroubek', 'hladka'].includes(u) ? 'Hloubka hřídele' : u === 'vrut' ? 'Hloubka otvoru' : 'Hloubka otvoru pro šroub';
    $('pPruchozi').hidden = !(p.typ === 'sroub' && u === 'matice' && o.vlozeni === 'zespodu');
    // popisky podle typu
    const t = p.typ, uc = p.uchop.typ;
    $('lPrumer').textContent = t === 'sroub' && (uc === 't' || uc === 'kridlo') ? 'Rozpětí' : t === 'kolecko' ? 'Průměr kola' : t === 'knopka' ? 'Průměr hlavy' : 'Průměr';
    $('lVyska').textContent = t === 'kolecko' ? 'Tloušťka kola' : t === 'sroub' && uc !== 'kridlo' ? 'Výška úchopu' : 'Výška';
    $('lPocet').textContent = uc === 'hvezdice' ? 'Počet ramen' : uc === 'drazky' ? 'Počet drážek' : 'Počet vroubků';
    $('lUzaob').textContent = uc === 'kridlo' ? 'Zaoblení rohu křídla' : 'Zaoblení ramen';
    $('lUsirka').textContent = uc === 'kridlo' ? 'Tloušťka křídla' : 'Šířka příčky';
    $('napTelo').textContent = {
      potenciometr: 'Výška = celý knoflík od spodku po vrch. Horní hrana se zaoblí nebo srazí, i přes vroubky.',
      sroub: uc === 'kridlo' ? 'Rozpětí křídel a jejich výška. Roh křídla je sražený 45° od líce, takže se lícem dolů tiskne bez podpor.' : 'Výška úchopu nad nábojem. Celková výška = náboj + úchop.',
      knopka: { hrib: 'Hřib: pata, krk a hlava s kuželem 45° zespodu – tiskne se bez podpor.', valec: 'Válec se zaoblenou horní hranou.', cocka: 'Čočka: nízký lem a kulová klenba nahoře.' }[p.knopka.tvar],
      kolecko: 'Kolo s nábojem na líci; rukojeť stojí na líci kola.',
    }[t];
    $('napUchop').textContent = {
      hladky: 'Hladký povrch.', vroubky: 'V-drážky 90° podél osy – hloubka je od obvodu.', drazky: 'Půlkruhové drážky – příjemnější do ruky než vroubky.',
      hvezdice: 'Hvězdice: výřezy mezi rameny, hloubka = jak hluboko výřez sahá od obvodu.', kridlo: 'Dvě křídla v jedné rovině kolem náboje (náboj = průměr náboje).',
      t: 'Příčka se zaoblenými konci na náboji.',
    }[uc];
    $('napNaboj').textContent = t === 'kolecko' ? 'Náboj na líci kola zesílí uchycení matice nebo hřídele.' : uc === 'kridlo' ? 'Náboj prochází celou výškou křídla, je v něm kapsa matice.' : 'Náboj pod úchopem (ke šroubovanému dílu); 0 = bez náboje.';
    $('napUpevneni').textContent = {
      D: 'Hřídel s ploškou (D). Ploška míří k ukazateli.', vroubek: 'Vroubkovaná (drážkovaná) hřídel – zuby se vytisknou do otvoru, knoflík drží sevřením.',
      hladka: 'Hladká hřídel: stavěcí šroub (červík) zboku do vložené matice. Drážka pro matici je otevřená zespodu.',
      matice: p.typ === 'knopka' ? 'Šroub zezadu (z vnitřku šuplíku) do matice vložené zespodu.' : 'Šestihranná matice v kapse; závitová tyč nebo šroub prochází otvorem.',
      hlava: 'Šroub se šestihrannou hlavou vložený shora – hlava se opírá o dno kapsy.',
      vrut: 'Otvor pro samořezný vrut nebo zalisovací (tepelnou) vložku.',
    }[u];
  }
  document.querySelectorAll('[data-p]').forEach(el => {
    const cesta = el.dataset.p;
    el.addEventListener('change', () => {
      let h;
      if (el.dataset.typ === 'bool') h = el.checked;
      else if (el.dataset.typ === 'text') h = el.value;
      else { h = ctiCislo(el.value); if (!Number.isFinite(h)) { el.classList.add('spatne'); return; } }
      el.classList.remove('spatne');
      zmen(q => KNOF.poloz(q, cesta, h));
      naplnFormular();
    });
    if (el.tagName === 'INPUT' && !el.dataset.typ) el.addEventListener('keydown', e => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      const x = ctiCislo(el.value); if (!Number.isFinite(x)) return;
      e.preventDefault();
      const krok = (e.shiftKey ? 10 : e.altKey ? 0.1 : 1) * (e.key === 'ArrowUp' ? 1 : -1);
      el.value = zobrazCislo(Math.round((x + krok) * 1000) / 1000); el.dispatchEvent(new Event('change'));
    });
  });
  $('f_material').innerHTML = Object.entries(KNOF.MATERIALY).map(([k, m]) => `<option value="${k}">${m.nazev}</option>`).join('');
  $('f_sroub').innerHTML = Object.keys(KNOF.SROUBY).map(k => `<option>${k}</option>`).join('');
  document.querySelectorAll('#paletaTypu button').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.typ === p.typ) return;
    nahrad(KNOF.prepniTyp(p, b.dataset.typ));
  }));

  /* ---------- přepočet ---------- */
  const nahled = KNOF_NAHLED.vytvorNahled($('platno'));
  const stavZobr = { tisk: false };
  function prepocitej() {
    nahled.barvy(css('--border-strong'), css('--border'), css('--text'));
    document.querySelectorAll('#paletaTypu button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.typ === p.typ)));
    let H = KNOF.kontroly(p);
    model = null; tiskDily = null;
    if (wasm) {
      try {
        model = KNOF.postav(wasm, p);
        tiskDily = KNOF.tiskoveRozlozeni(model.dily, 1);
        H = H.concat(KNOF.kontrolyModelu(p, tiskDily));
        chybaStavby = '';
      } catch (e) { chybaStavby = 'Model nelze sestavit: ' + (e && e.message || e); }
    }
    const st = $('stav3d');
    if (!wasm) st.textContent = chybaStavby || 'Načítám geometrické jádro…';
    else st.textContent = chybaStavby;
    st.classList.toggle('chyba', !!chybaStavby);
    if (model) nahled.nastav(stavZobr.tisk ? tiskDily : model.dily, { tisk: stavZobr.tisk });
    else nahled.nastav(null);
    vypisHlaseni(H);
    vypisVysledky();
    souhrny();
    exportDilu();
  }
  function souhrny() {
    const N = KNOF.NAZVY, u = p.upevneni;
    TrubkyGui.souhrn('sTelo', `Ø ${fmt(p.telo.prumer)} × ${fmt(p.telo.vyska)} mm${p.typ === 'knopka' ? ' · ' + { hrib: 'hřib', valec: 'válec', cocka: 'čočka' }[p.knopka.tvar] : ''}`, true);
    TrubkyGui.souhrn('sUchop', N.uchop[p.uchop.typ] + (['vroubky', 'drazky', 'hvezdice'].includes(p.uchop.typ) ? ` × ${p.uchop.pocet}` : ''), true);
    TrubkyGui.souhrn('sNaboj', p.typ === 'sroub' && p.uchop.typ === 'kridlo' ? `Ø ${fmt(p.naboj.prumer)} přes celou výšku` : p.naboj.vyska > 0 ? `Ø ${fmt(p.naboj.prumer)} × ${fmt(p.naboj.vyska)}` : 'bez náboje', p.naboj.vyska > 0 || p.uchop.typ === 'kridlo');
    TrubkyGui.souhrn('sUkazatel', `${{ zadny: 'bez ukazatele', ryska: 'ryska', sipka: 'šipka' }[p.ukazatel.typ]}${p.sukne.pouzit ? ` · sukně Ø ${fmt(p.sukne.prumer)}, ${p.sukne.dilku} dílků` : ''}`, p.ukazatel.typ !== 'zadny' || p.sukne.pouzit);
    TrubkyGui.souhrn('sRukojet', { zadna: 'bez rukojeti', pevna: `pevná Ø ${fmt(p.rukojet.prumer)}`, otocna: `otočná Ø ${fmt(p.rukojet.prumer)} na ${p.rukojet.sroub}` }[p.rukojet.typ], p.rukojet.typ !== 'zadna');
    TrubkyGui.souhrn('sUpevneni', N.upevneni[u.typ] + (u.typ === 'matice' || u.typ === 'hlava' ? ' ' + u.sroub : u.typ === 'vrut' ? ` Ø ${fmt(u.pilot)}` : ` Ø ${fmt(u.hridel, 2)}`), true);
    TrubkyGui.souhrn('sVule', `hřídel ${fmt(p.vule.hridel, 2)} · šroub ${fmt(p.vule.sroub, 2)} · matice ${fmt(p.vule.matice, 2)} · +${fmt(p.vule.kompenzace, 2)}`, true);
    $('sTisk').textContent = { spodek: 'spodkem dolů', nahore: '', vrch: 'lícem dolů' }[KNOF.polohaTisku(p)];
    tabulkaRozmeru();
  }
  function tabulkaRozmeru() {
    const o = KNOF.odvozene(p), r = [];
    if (o.hridel) r.push(['Otvor hřídele', `Ø ${fmt(o.hridel.D, 2)}`, o.hridel.pruchozi ? 'průchozí' : `hl. ${fmt(p.upevneni.hloubka)}`]);
    if (p.upevneni.typ === 'D') r.push(['Přes plošku', fmt(p.upevneni.plocha + p.vule.hridel + p.vule.kompenzace, 2), '']);
    if (p.upevneni.typ === 'vroubek') r.push(['Dno zubů', `Ø ${fmt(o.hridel.D - 2 * p.upevneni.vyskaZubu, 2)}`, `${p.upevneni.zuby} zubů`]);
    if (o.stavaci) r.push([`Stavěcí ${p.upevneni.stavaci}`, `Ø ${fmt(o.stavaci.ds, 2)}`, `matice ${fmt(o.stavaci.m.S, 2)} × ${fmt(o.stavaci.m.H, 2)}, osa z ${fmt(o.stavaci.zs, 1)}`]);
    if (o.kapsa) {
      r.push([`Kapsa ${p.upevneni.typ === 'hlava' ? 'hlavy' : 'matice'} ${p.upevneni.sroub}`, `s ${fmt(o.kapsa.m.S, 2)}`, `hl. ${fmt(o.kapsa.hloubka, 2)}, přes rohy ${fmt(o.kapsa.m.E, 2)}`]);
      r.push(['Otvor šroubu', `Ø ${fmt(o.kapsa.dS, 2)}`, { mustkova: 'můstková vrstva', obetovana: 'obětovaná vrstva', zadny: '' }[o.kapsa.mostek]]);
    }
    if (o.vrut) r.push(['Otvor pro vrut', `Ø ${fmt(o.vrut.D, 2)}`, `hl. ${fmt(o.vrut.hloubka)}`]);
    if (o.rukojet && o.rukojet.m) r.push([`Rukojeť ${p.rukojet.sroub}`, `Ø ${fmt(o.rukojet.dS, 2)}`, `matice ${fmt(o.rukojet.m.S, 2)}, otvor objímky Ø ${fmt(o.rukojet.dS + 0.2, 2)}`]);
    $('tabRozmery').innerHTML = '<tr><th>Prvek</th><th class="c">Rozměr</th><th>Pozn.</th></tr>' + r.map(x => `<tr><td>${x[0]}</td><td class="c">${x[1]}</td><td>${x[2]}</td></tr>`).join('');
  }
  const box = (popis, cislo, dalsi, tr) => `<div class="dlazdice"><div class="popis">${popis}</div><div class="cislo ${tr || ''}">${cislo}</div>${dalsi ? `<div class="dalsi">${dalsi}</div>` : ''}</div>`;
  function vypisVysledky() {
    const el = $('vVysledky'), karta = $('karta3d');
    if (!model) { el.innerHTML = box('Model', wasm ? 'nelze sestavit' : 'načítám…', chybaStavby); karta.innerHTML = ''; $('vSit').innerHTML = ''; return; }
    const mat = KNOF.MATERIALY[p.tisk.material], o = KNOF.odvozene(p);
    const all = model.dily.map(d => ({ d, k: KRAB.kontrolaSite(d.poz, d.idx), b: KNOF.obal(d.poz) }));
    const V = model.dily.reduce((s, d) => s + d.objem, 0) * p.tisk.kusu;
    const g = V / 1000 * mat.hustota, metru = V / (Math.PI * 0.875 * 0.875) / 1000;
    const minut = Math.round((V / 6 + 90 * all.length * p.tisk.kusu) / 60);   // hrubě: ~6 mm³/s + najetí na díl
    const hl = all[0].b;
    const sx = hl[3] - hl[0], sy = hl[4] - hl[1], sz = hl[5] - hl[2];
    let h = box('Rozměry', `${fmt(sx)} × ${fmt(sy)} × ${fmt(sz)} mm`, model.dily.length > 1 ? `+ ${model.dily[1].nazev.toLowerCase()} Ø ${fmt(p.rukojet.prumer)} × ${fmt(p.rukojet.vyska)}` : 'š × h × v v montážní poloze');
    h += box('Objem', `${fmt(V / 1000, 2)} cm³`, p.tisk.kusu > 1 ? `${p.tisk.kusu} sady` : model.dily.length > 1 ? `${model.dily.length} díly` : 'plný díl');
    h += box('Hmotnost', `${fmt(g, g < 10 ? 1 : 0)} g`, `${mat.nazev}, plný díl (při 30 % výplni zhruba ${fmt(g * 0.55, 0)} g)`);
    h += box('Filament', `${fmt(metru, 2)} m`, 'průměr 1,75 mm, plný díl');
    h += box('Doba tisku', `≈ ${minut < 60 ? minut + ' min' : fmt(minut / 60, 1) + ' h'}`, 'hrubý odhad, vrstva 0,2 mm');
    h += box('Tisková poloha', { spodek: 'spodkem dolů', vrch: 'lícem dolů' }[o.poloha], p.tisk.poloha === 'auto' ? 'zvoleno automaticky' : 'zadáno ručně');
    if (o.kapsa) h += box(p.upevneni.typ === 'hlava' ? 'Hlava šroubu' : 'Matice', `${p.upevneni.sroub} · s ${fmt(o.kapsa.m.s)}`, `kapsa ${fmt(o.kapsa.m.S, 2)} × ${fmt(o.kapsa.hloubka, 2)} mm, ${o.vlozeni === 'shora' ? 'shora' : 'zespodu'}`);
    if (o.hridel) h += box('Hřídel', `Ø ${fmt(p.upevneni.hridel, 2)}`, `otvor Ø ${fmt(o.hridel.D, 2)}, ${o.hridel.pruchozi ? 'průchozí' : 'hloubka ' + fmt(p.upevneni.hloubka) + ' mm'}`);
    el.innerHTML = h;
    karta.innerHTML = `<div class="titul">${KNOF.NAZVY.typ[p.typ]}</div><b>${fmt(sx)} × ${fmt(sy)} × ${fmt(sz)}</b> mm · <b>${fmt(g, g < 10 ? 1 : 0)}</b> g ${mat.nazev}<br>`
      + `${KNOF.NAZVY.uchop[p.uchop.typ]} · ${KNOF.NAZVY.upevneni[p.upevneni.typ]}${o.kapsa ? ' ' + p.upevneni.sroub : ''}<br>tisk ${{ spodek: 'spodkem', vrch: 'lícem' }[o.poloha]} dolů`;
    $('vSit').innerHTML = all.map(({ d, k }) => box('Síť – ' + d.nazev, k.uzavrena ? '✔ těsná' : '✖ netěsná', `${k.trojuhelniku} trojúhelníků, ${k.teles} těleso, ${model.cas} ms`, k.uzavrena && k.teles === 1 ? 'ok-t' : 'chyba-t')).join('');
  }
  function vypisHlaseni(H) {
    const ul = $('hlaseni'); ul.innerHTML = '';
    if (chybaStavby) H = [{ uroven: 'chyba', text: chybaStavby, pole: [] }].concat(H);
    if (!H.some(x => x.uroven !== 'info')) H = [{ uroven: 'ok', text: 'Bez chyb a varování.', pole: [] }].concat(H);
    const poradi = { chyba: 0, varovani: 1, ok: 2, info: 3 };
    H = H.slice().sort((a, b) => poradi[a.uroven] - poradi[b.uroven]);
    for (const x of H) {
      const li = document.createElement('li'); li.className = x.uroven + (x.pole.length ? ' skok' : '');
      li.textContent = x.text;
      if (x.pole.length) {
        li.tabIndex = 0;
        const kam = document.createElement('span'); kam.className = 'kam'; kam.textContent = '→ upravit'; li.appendChild(kam);
        const jdi = () => jdiNaPole(x.pole[0]);
        li.addEventListener('click', e => { if (e.target.tagName !== 'BUTTON') jdi(); });
        li.addEventListener('keydown', e => { if (e.key === 'Enter') jdi(); });
      }
      if (x.oprava) {
        const b = document.createElement('button'); b.className = 'tl oprava'; b.textContent = '🔧 ' + x.oprava.text;
        b.addEventListener('click', () => { zmen(q => KNOF.poloz(q, x.oprava.pole, x.oprava.hodnota)); naplnFormular(); });
        li.appendChild(b);
      }
      ul.appendChild(li);
    }
    const nch = H.filter(x => x.uroven === 'chyba').length, nv = H.filter(x => x.uroven === 'varovani').length;
    const o = $('stavOdznak');
    o.className = 'odznak ' + (nch ? 'chyba' : nv ? 'mez' : 'ok');
    o.textContent = nch ? `✖ ${nch}` : nv ? `⚠ ${nv}` : '✔';
    $('sKontrola').textContent = nch ? `${nch} ${nch === 1 ? 'chyba' : nch < 5 ? 'chyby' : 'chyb'}` : nv ? `${nv} varování` : 'v pořádku';
    // vykřičník u boxu, jehož pole je v chybě
    const vBoxu = id => H.some(x => x.uroven === 'chyba' && x.pole.some(c => { const el = document.querySelector(`[data-p="${c}"]`); return el && el.closest('#' + id); }));
    TrubkyGui.oznacChybu('boxTvar', vBoxu('boxTvar'));
    TrubkyGui.oznacChybu('boxUpevneni', vBoxu('boxUpevneni'));
  }
  function jdiNaPole(cesta) {
    const el = document.querySelector(`[data-p="${cesta}"]`);
    if (!el) return;
    const det = el.closest('details'); if (det) det.open = true;
    const tel = el.closest('.zalozka-telo'); if (tel) TrubkyGui.otevriZalozku(tel.dataset.telo);
    const bx = el.closest('[data-box]'); TrubkyGui.ukazBox(bx ? bx.dataset.box : 'obecne');
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.focus({ preventScroll: true });
    const cil = el.closest('.pole') || el;
    cil.classList.remove('zvyrazni'); void cil.offsetWidth; cil.classList.add('zvyrazni');
  }

  /* ---------- nabídky, export ---------- */
  TrubkyGui.pripoj({ klic: 'webapp_knofliky_gui', pohled: j => nahled.pohled(j) });
  for (const v of KNOF.PREDVOLBY) {
    const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
    b.innerHTML = `${v.nazev}<span class="pozn">${v.popis}</span>`;
    b.addEventListener('click', () => { const q = KNOF.predvolba(v.id); q.vule = KNOF.kopie(p.vule); q.tisk = Object.assign(KNOF.kopie(p.tisk), { poloha: 'auto' }); nahrad(q); });
    $('seznamPredvoleb').appendChild(b);
  }
  const jmenoSouboru = pripona => ((p.nazev || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/^_|_$/g, '') || 'knoflik') + pripona;
  function stahni(data, nazev, typ) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type: typ }));
    a.download = nazev; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function lzeExport() {
    if (!model) { Dialog.chyba(chybaStavby || 'Geometrické jádro se ještě načítá.'); return false; }
    return true;
  }
  const kusy = dily => KNOF.tiskoveRozlozeni(dily, p.tisk.kusu);
  function exportStl() { if (lzeExport()) stahni(KRAB.stlBinarni(kusy(model.dily), 'knofliky - github_site'), jmenoSouboru('.stl'), 'model/stl'); }
  $('btnStl').addEventListener('click', exportStl);
  $('btn3mf').addEventListener('click', () => { if (lzeExport()) stahni(KRAB.soubor3mf(kusy(model.dily), p.nazev || 'Knoflík'), jmenoSouboru('.3mf'), 'model/3mf'); });
  /** Vícedílný model: každý díl zvlášť. */
  function exportDilu() {
    const el = $('exportDilu'); el.innerHTML = '';
    if (!model || model.dily.length < 2) return;
    for (const d of model.dily) {
      const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
      b.innerHTML = `⬇ STL – ${d.nazev}<span class="pozn">jen tento díl</span>`;
      b.addEventListener('click', () => stahni(KRAB.stlBinarni(kusy([d]), 'knofliky - ' + d.jmeno), jmenoSouboru('_' + d.jmeno + '.stl'), 'model/stl'));
      el.appendChild(b);
    }
  }
  $('btnUlozit').addEventListener('click', () => stahni(KNOF.ulozProjekt(p), jmenoSouboru('.json'), 'application/json'));
  $('btnNacist').addEventListener('click', () => $('soubor').click());
  $('soubor').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try {
      const { p: q, hlaseni } = KNOF.nactiProjekt(await f.text());
      nahrad(q);
      if (hlaseni.length) Dialog.info('Projekt načten, některé hodnoty byly opraveny:\n• ' + hlaseni.join('\n• '));
      else Dialog.info('Projekt načten.');
    } catch (err) { Dialog.chyba(err.message); }
  });
  $('btnVychozi').addEventListener('click', async () => {
    if (!await Dialog.potvrd('Vrátit všechny parametry na výchozí hodnoty?')) return;
    nahrad(KNOF.predvolba('pot_d'));
  });
  $('btnPng').addEventListener('click', () => { fetch(nahled.png()).then(r => r.blob()).then(b => stahni(b, jmenoSouboru('.png'))); });
  $('btnZpet').addEventListener('click', () => krokHistorie(zpet, znovu));
  $('btnZnovu').addEventListener('click', () => krokHistorie(znovu, zpet));
  function prepinac(id, f) {
    const b = $(id);
    b.addEventListener('click', () => { const h = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(h)); f(h); });
  }
  prepinac('tRez', h => { nahled.prepni('rez', h); $('legRez').hidden = !h; });
  prepinac('tHrany', h => nahled.prepni('hrany', h));
  prepinac('tTisk', h => { stavZobr.tisk = h; if (model) nahled.nastav(h ? tiskDily : model.dily, { tisk: h, novyPohled: true }); });
  $('stavOdznak').addEventListener('click', () => TrubkyGui.otevriZalozku('kontrola'));
  $('btnNap').addEventListener('click', () => $('dlgNapoveda').showModal());
  $('btnZavritNap').addEventListener('click', () => $('dlgNapoveda').close());
  document.addEventListener('keydown', e => {
    const a = document.activeElement;
    const vPoli = a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || (a.tagName === 'INPUT' && !/checkbox|range|radio|button/.test(a.type));
    const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (ctrl && !vPoli && k === 'z') { e.preventDefault(); krokHistorie(e.shiftKey ? znovu : zpet, e.shiftKey ? zpet : znovu); return; }
    if (ctrl && !vPoli && k === 'y') { e.preventDefault(); krokHistorie(znovu, zpet); return; }
    if (ctrl && k === 's') { e.preventDefault(); exportStl(); return; }
    if (e.key === 'F1') { e.preventDefault(); $('dlgNapoveda').showModal(); return; }
    if (vPoli || ctrl || e.altKey || $('dlgNapoveda').open) return;
    const pohledy = { 1: 'iso', 2: 'shora', 3: 'zboku', 4: 'zespodu' };
    if (pohledy[k]) nahled.pohled(pohledy[k]);
    else if (k === 'r') $('tRez').click(); else if (k === 'h') $('tHrany').click(); else if (k === 'm') $('tTisk').click();
  });
  new MutationObserver(() => prepocitej()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  if (typeof Tvary !== 'undefined') Tvary.pripoj({
    klic: 'webapp_knofliky_tvary', typ: 'knofliky', nazev: 'Knoflíky', kontejner: $('tvary'),
    parametry: () => KNOF.kopie(p),
    pouzij: q => nahrad(KNOF.normalizuj(q).p),
    popis: q => KNOF.popis(KNOF.normalizuj(q).p),
  });

  /* ---------- start ---------- */
  p = nactiUlozeny();
  naplnFormular();
  prepocitej();
  nactiManifold().then(w => { wasm = w; prepocitej(); }).catch(e => {
    chybaStavby = 'Geometrické jádro (manifold-3d) se nenačetlo: ' + (e && e.message || e) + ' – model ani export nejsou k dispozici.';
    prepocitej();
  });
  window.KNOF_UI = { get p() { return p; }, get model() { return model; }, zmen, nahrad, naplnFormular, prepocitej, nahled };
})();

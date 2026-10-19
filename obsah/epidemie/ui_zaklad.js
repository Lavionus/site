/* ============================================================
   epidemie/ui_zaklad.js – společný základ ovládání: stav parametrů, formulář, odvozené veličiny,
   časová osa zásahů, záložky, sdílený odkaz, export PNG/CSV. Ostatní ui_*.js se registrují do EpiApp.
   ============================================================ */
(function () {
  'use strict';
  const M = window.EpiModel, J = window.EpiJadro, Graf = window.EpiGraf;
  const $ = (s, el = document) => el.querySelector(s);
  const KLIC = 'webapp_epidemie_';
  const App = window.EpiApp = { $, zalozky: {}, grafy: {} };

  // ---------- formátování ----------
  App.f = (x, d = 2) => Number.isFinite(x) ? x.toLocaleString('cs-CZ', { maximumFractionDigits: d, minimumFractionDigits: 0 }) : '–';
  App.fc = (x) => Number.isFinite(x) ? Math.round(x).toLocaleString('cs-CZ') : '–';
  App.fp = (x, d = 1) => Number.isFinite(x) ? (x * 100).toLocaleString('cs-CZ', { maximumFractionDigits: d, minimumFractionDigits: 0 }) + ' %' : '–';
  App.fpa = (x) => { if (!Number.isFinite(x)) return '–'; const a = Math.abs(x * 100); return App.fp(x, a >= 10 ? 1 : a >= 1 ? 2 : a >= 0.01 ? 3 : 4); };
  App.fd = (x) => Number.isFinite(x) ? 'den ' + App.f(x, 0) : '–';
  App.esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  App.cti = (k) => { try { return JSON.parse(localStorage.getItem(KLIC + k)); } catch (e) { return null; } };
  App.zapis = (k, v) => { try { localStorage.setItem(KLIC + k, JSON.stringify(v)); } catch (e) { /* úložiště nedostupné */ } };
  App.box = (popis, cislo, dalsi, znacka, trida) =>
    `<div class="box${trida ? ' ' + trida : ''}"><div class="popis">${znacka ? `<span class="znacka" style="background:var(${znacka})"></span>` : ''}${popis}</div><div class="cislo">${cislo}</div>${dalsi ? `<div class="dalsi">${dalsi}</div>` : ''}</div>`;
  App.chyba = (sel, text) => { const el = $(sel); if (!el) return; el.textContent = text || ''; el.hidden = !text; };
  App.stahni = (nazev, obsah, typ) => {
    const blob = obsah instanceof Blob ? obsah : new Blob([obsah], { type: typ || 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = nazev;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  App.pauza = () => new Promise(r => setTimeout(r, 0));
  /** Nový graf s registrací pro tlačítka PNG (data-png="id"). */
  App.graf = (id, volby) => { const g = new Graf($('#' + id), volby); App.grafy[id] = g; return g; };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-png]'); if (!b) return;
    const g = App.grafy[b.dataset.png]; if (g) g.png('epidemie_' + b.dataset.png);
  });

  // ---------- výchozí stav ----------
  const VYCHOZI = Object.assign({}, M.VYCHOZI, {
    N: 1000000, I0: 20, dny: 365, krok: 0.25,
    zavaznost: true, kapH100k: 60, kapC100k: 10, kampanDavky100k: 0,
    zasahy: [],
    // agenti a sítě
    rezimAgentu: 'prostor', agN: 3000, agI0: 5, seed: '2026', sousede: 6, mobilita: 0.05, skoky: 0.02, rozdeleni: 'exp', superK: 0,
    sitTyp: 'er', sitK: 8, sitBeta: 0.1, sitKKom: 4, sitWDom: 3,
    // stochastika
    stMetoda: 'gillespie', stN: 10000, stI0: 3, stBehu: 100, stSeed: '1', stTau: 0.1,
    // kraje
    metaMobilita: 0.05, metaExponent: 2, metaZdroj: 0
  });
  delete VYCHOZI.kapH; delete VYCHOZI.kapC; delete VYCHOZI.kampanDavky;
  App.VYCHOZI = VYCHOZI;

  function nactiZOdkazu() {
    const m = /[#&]p=([A-Za-z0-9_-]+)/.exec(location.hash);
    if (!m) return null;
    try {
      const b64 = m[1].replace(/-/g, '+').replace(/_/g, '/');
      const json = decodeURIComponent(escape(atob(b64 + '==='.slice((b64.length + 3) % 4))));
      const o = JSON.parse(json);
      return o && typeof o === 'object' ? o : null;
    } catch (e) { return null; }
  }
  const zOdkazu = nactiZOdkazu();
  App.nast = Object.assign({}, VYCHOZI, App.cti('nastaveni2') || {}, zOdkazu || {});
  App.zOdkazu = !!zOdkazu;
  if (!Array.isArray(App.nast.zasahy)) App.nast.zasahy = [];

  /** Parametry pro rozšířený model (přepočet hodnot „na 100 000 obyvatel“). */
  App.parModel = (n0 = App.nast, prepis) => {
    const n = prepis ? Object.assign({}, n0, prepis) : n0;
    const p = {};
    for (const k of Object.keys(M.VYCHOZI)) if (k in n) p[k] = n[k];
    p.kapH = n.kapH100k * n.N / 1e5; p.kapC = n.kapC100k * n.N / 1e5;
    p.kampanDavky = n.kampanDavky100k * n.N / 1e5;
    p.zasahy = (n.zasahy || []).map(z => Object.assign({}, z));
    return p;
  };
  /** Parametry pro agenty a sítě: asymptomatičtí zahrnuti průměrnou infekčností, izoluje se jen symptomatický podíl. */
  App.parAgentu = (n = App.nast) => ({
    model: n.latence ? 'SEIR' : 'SIR', N: n.agN, I0: n.agI0,
    p: Math.min(1, n.p * ((1 - n.podilA) + n.podilA * n.rA)), c: n.c, inkubace: n.inkubace, infekcni: n.infekcni, dny: n.dny,
    izolacePodil: n.izolacePodil * (1 - n.podilA), izolaceZpozdeni: n.izolaceZpozdeni,
    ockovaniPodil: n.ockovaniPodil, ucinnost: n.ucinnost, zasahy: n.zasahy, sezonA: n.sezonA, sezonMax: n.sezonMax,
    seed: n.seed, sousede: n.sousede, mobilita: n.mobilita, skoky: n.skoky, rozdeleni: n.rozdeleni, superK: n.superK
  });
  App.ulozit = () => App.zapis('nastaveni2', App.nast);

  // ---------- pole formuláře ----------
  const POLE = [
    { id: 'N', sk: 'nakaza', popis: 'Velikost populace N', min: 10, max: 1e10, des: 0, cele: true },
    { id: 'I0', sk: 'nakaza', popis: 'Nakažených na začátku I₀', min: 0, max: 1e10, des: 2 },
    { id: 'p', sk: 'nakaza', popis: 'Pravděpodobnost přenosu při kontaktu', min: 0, max: 1, krok: 0.005, rozsahMax: 0.3, des: 4, posuvnik: true, napoveda: 'Šance, že jeden kontakt infekčního s vnímavým vede k nákaze.' },
    { id: 'c', sk: 'nakaza', popis: 'Kontaktní míra c', jednotka: 'kontaktů/den', min: 0, max: 200, krok: 0.5, rozsahMax: 40, des: 2, posuvnik: true, napoveda: 'Průměrný počet kontaktů za den. β = c·p.' },
    { id: 'inkubace', sk: 'nakaza', popis: 'Latence (do začátku infekčnosti)', jednotka: 'dní', min: 0.05, max: 60, krok: 0.5, rozsahMin: 0.5, rozsahMax: 21, des: 2, posuvnik: true, jen: n => n.latence },
    { id: 'infekcni', sk: 'nakaza', popis: 'Infekční období', jednotka: 'dní', min: 0.05, max: 60, krok: 0.5, rozsahMin: 0.5, rozsahMax: 21, des: 2, posuvnik: true },
    { id: 'podilA', sk: 'nakaza', popis: 'Podíl asymptomatických', min: 0, max: 1, krok: 0.05, des: 1, posuvnik: true, proc: true },
    { id: 'rA', sk: 'nakaza', popis: 'Relativní infekčnost asymptomatických', min: 0, max: 1, krok: 0.05, des: 1, posuvnik: true, proc: true, jen: n => n.podilA > 0 },
    { id: 'dny', sk: 'nakaza', popis: 'Délka simulace', jednotka: 'dní', min: 10, max: 3650, des: 0, cele: true },
    { id: 'ihrNasobek', sk: 'zavaznost', popis: 'Násobek hospitalizací (IHR)', min: 0, max: 20, krok: 0.1, rozsahMax: 5, des: 2, posuvnik: true, jen: n => n.zavaznost, napoveda: '1 = ilustrativní věkový profil (viz Dokumentace).' },
    { id: 'ifrNasobek', sk: 'zavaznost', popis: 'Násobek smrtnosti (IFR)', min: 0, max: 20, krok: 0.1, rozsahMax: 5, des: 2, posuvnik: true, jen: n => n.zavaznost },
    { id: 'podilJIP', sk: 'zavaznost', popis: 'Hospitalizovaných na JIP', min: 0, max: 1, krok: 0.05, des: 1, posuvnik: true, proc: true, jen: n => n.zavaznost },
    { id: 'umrtiNaJIP', sk: 'zavaznost', popis: 'Podíl úmrtí, která nastanou na JIP', min: 0, max: 1, krok: 0.05, des: 1, posuvnik: true, proc: true, jen: n => n.zavaznost && n.podilJIP > 0 },
    { id: 'dobaH', sk: 'zavaznost', popis: 'Doba hospitalizace', jednotka: 'dní', min: 0.1, max: 365, des: 1, pul: true, jen: n => n.zavaznost },
    { id: 'dobaC', sk: 'zavaznost', popis: 'Doba na JIP', jednotka: 'dní', min: 0.1, max: 365, des: 1, pul: true, jen: n => n.zavaznost },
    { id: 'kapH100k', sk: 'zavaznost', popis: 'Lůžka', jednotka: 'na 100 tis.', min: 0, max: 1e5, des: 1, pul: true, jen: n => n.zavaznost },
    { id: 'kapC100k', sk: 'zavaznost', popis: 'Lůžka JIP', jednotka: 'na 100 tis.', min: 0, max: 1e5, des: 1, pul: true, jen: n => n.zavaznost },
    { id: 'imunitaDny', sk: 'imunita', popis: 'Imunita po prodělání (0 = trvalá)', jednotka: 'dní', min: 0, max: 1e5, des: 0, pul: true, napoveda: null },
    { id: 'imunitaVDny', sk: 'imunita', popis: 'Ochrana po očkování (0 = trvalá)', jednotka: 'dní', min: 0, max: 1e5, des: 0, pul: true },
    { id: 'sezonA', sk: 'imunita', popis: 'Sezónní kolísání přenosu (amplituda)', min: 0, max: 1, krok: 0.05, des: 1, posuvnik: true, proc: true },
    { id: 'sezonMax', sk: 'imunita', popis: 'Den nejsilnějšího přenosu', min: -365, max: 3650, des: 0, jen: n => n.sezonA > 0 },
    { id: 'importy', sk: 'imunita', popis: 'Importované nákazy', jednotka: 'za den', min: 0, max: 1e7, des: 2 },
    { id: 'importyOd', sk: 'imunita', popis: 'Importy od dne', min: 0, max: 1e5, des: 0, pul: true, jen: n => n.importy > 0 },
    { id: 'importyDo', sk: 'imunita', popis: 'do dne (prázdné = stále)', min: 0, max: 1e9, des: 0, pul: true, prazdne: 1e9, jen: n => n.importy > 0 },
    { id: 'izolacePodil', sk: 'izolace', popis: 'Podíl symptomatických, kteří se izolují', min: 0, max: 1, krok: 0.05, des: 1, posuvnik: true, proc: true, napoveda: 'Asymptomatičtí se neizolují.' },
    { id: 'izolaceZpozdeni', sk: 'izolace', popis: 'Zpoždění izolace od začátku infekčnosti', jednotka: 'dní', min: 0, max: 30, krok: 0.5, rozsahMax: 10, des: 2, posuvnik: true },
    { id: 'ockovaniPodil', sk: 'ockovani', popis: 'Proočkovanost na začátku', min: 0, max: 1, krok: 0.05, des: 1, posuvnik: true, proc: true },
    { id: 'ucinnost', sk: 'ockovani', popis: 'Účinnost proti nákaze', min: 0, max: 1, krok: 0.05, des: 1, posuvnik: true, proc: true },
    { id: 'kampanDavky100k', sk: 'ockovani', popis: 'Kampaň: dávek za den', jednotka: 'na 100 tis.', min: 0, max: 1e5, des: 1, pul: true },
    { id: 'kampanOd', sk: 'ockovani', popis: 'Kampaň od dne', min: 0, max: 1e5, des: 0, pul: true },
    { id: 'kampanUcast', sk: 'ockovani', popis: 'Ochota k očkování (strop)', min: 0, max: 1, krok: 0.05, des: 1, posuvnik: true, proc: true },
    { id: 'superK', sk: 'superk', popis: 'Superšíření: disperze k (0 = vypnuto)', min: 0, max: 100, krok: 0.05, rozsahMax: 2, des: 2, posuvnik: true, napoveda: 'Menší k = víc superšíření. Typicky se uvádí 0,1–0,5 pro SARS/COVID-19, ≈ 1 pro chřipku.' },
    { id: 'sousede', sk: 'agenti', popis: 'Průměrně lidí v dosahu k', min: 0.5, max: 50, krok: 0.5, rozsahMin: 1, rozsahMax: 20, des: 1, posuvnik: true },
    { id: 'mobilita', sk: 'agenti', popis: 'Mobilita', jednotka: 'šířky světa/den', min: 0, max: 2, krok: 0.01, rozsahMax: 0.5, des: 3, posuvnik: true, napoveda: 'Malá mobilita = shlukování a postupující vlna.' },
    { id: 'skoky', sk: 'agenti', popis: 'Dálkové přesuny', jednotka: 'na osobu/den', min: 0, max: 100, krok: 0.01, rozsahMax: 2, des: 2, posuvnik: true, napoveda: 'Velké hodnoty = dokonalé promíchání jako v ODR.' },
    { id: 'sitK', sk: 'sit', popis: 'Průměrný stupeň (kontaktů v síti)', min: 1, max: 50, krok: 1, rozsahMax: 20, des: 1, posuvnik: true, jen: n => n.sitTyp !== 'dom' },
    { id: 'sitBeta', sk: 'sit', popis: 'Přepojení β (malý svět)', min: 0, max: 1, krok: 0.01, des: 2, posuvnik: true, jen: n => n.sitTyp === 'ws' },
    { id: 'sitKKom', sk: 'sit', popis: 'Komunitních kontaktů na osobu', min: 0, max: 50, krok: 0.5, rozsahMax: 15, des: 1, posuvnik: true, jen: n => n.sitTyp === 'dom' },
    { id: 'sitWDom', sk: 'sit', popis: 'Relativní síla kontaktu v domácnosti', min: 0, max: 20, krok: 0.5, rozsahMax: 10, des: 1, posuvnik: true, jen: n => n.sitTyp === 'dom' },
    { id: 'metaMobilita', sk: 'kraje2', popis: 'Kontaktů mimo vlastní kraj', min: 0, max: 1, krok: 0.005, rozsahMax: 0.2, des: 1, posuvnik: true, proc: true },
    { id: 'metaExponent', sk: 'kraje2', popis: 'Exponent vzdálenosti a', min: 0, max: 5, krok: 0.1, des: 1, posuvnik: true }
  ];
  const prvky = {};
  App.prvky = prvky;
  function zobraz(d, v) {
    if (d.prazdne != null && v >= d.prazdne) return '';
    return (d.proc ? v * 100 : v).toLocaleString('cs-CZ', { maximumFractionDigits: d.des, useGrouping: false });
  }
  function precti(d, text) {
    const t = String(text).trim().replace(/\s/g, '').replace(',', '.');
    if (t === '' && d.prazdne != null) return { v: d.prazdne };
    if (t === '' || !/^-?\d*\.?\d+(e[-+]?\d+)?$/i.test(t)) return { chyba: 'Zadejte číslo.' };
    let v = Number(t);
    if (d.proc) v /= 100;
    if (d.cele && v !== Math.round(v)) return { chyba: 'Zadejte celé číslo.' };
    const zob = (x) => (d.proc ? x * 100 : x).toLocaleString('cs-CZ') + (d.proc ? ' %' : '');
    if (v < d.min) return { chyba: 'Nejméně ' + zob(d.min) + '.' };
    if (v > d.max) return { chyba: 'Nejvýš ' + zob(d.max) + '.' };
    return { v };
  }
  function vytvorPole(d) {
    const kont = $('#pole-' + d.sk);
    if (!kont) return;
    const obal = document.createElement('div');
    obal.className = 'pole';
    const jedn = d.proc ? '%' : (d.jednotka || '');
    obal.innerHTML = `<label class="popisek" for="f-${d.id}"><span>${App.esc(d.popis)}${jedn ? ' [' + App.esc(jedn) + ']' : ''}</span><span class="hodnota-odvoz" id="o-${d.id}"></span></label>` +
      (d.posuvnik ? `<div class="s-posuvnikem"><input type="range" id="r-${d.id}" aria-label="${App.esc(d.popis)} – posuvník"><input type="text" inputmode="decimal" id="f-${d.id}" autocomplete="off"></div>`
                  : `<input type="text" inputmode="decimal" id="f-${d.id}" autocomplete="off">`) +
      `<div class="pole-chyba" id="e-${d.id}" hidden></div>` + (d.napoveda ? `<div class="napoveda">${App.esc(d.napoveda)}</div>` : '');
    if (d.pul) {
      let mr = kont.lastElementChild;
      if (!mr || !mr.classList.contains('mrizka2') || mr.children.length >= 2) { mr = document.createElement('div'); mr.className = 'mrizka2'; kont.appendChild(mr); }
      mr.appendChild(obal);
    } else kont.appendChild(obal);
    const vstup = $('#f-' + d.id, obal), rozsah = $('#r-' + d.id, obal);
    const k = d.proc ? 100 : 1;
    if (rozsah) {
      const mn = d.rozsahMin != null ? d.rozsahMin : d.min, mx = d.rozsahMax != null ? d.rozsahMax : d.max;
      rozsah.min = mn * k; rozsah.max = mx * k; rozsah.step = (d.krok || 0.01) * k;
      rozsah.addEventListener('input', () => {
        App.nast[d.id] = Number(rozsah.value) / k;
        vstup.value = zobraz(d, App.nast[d.id]);
        vstup.classList.remove('chyba'); $('#e-' + d.id).hidden = true;
        App.zmena(d.id);
      });
    }
    vstup.addEventListener('input', () => {
      const r = precti(d, vstup.value), ch = $('#e-' + d.id);
      if (r.chyba) { vstup.classList.add('chyba'); ch.textContent = r.chyba; ch.hidden = false; return; }
      vstup.classList.remove('chyba'); ch.hidden = true;
      App.nast[d.id] = r.v;
      if (rozsah) rozsah.value = k * r.v;
      App.zmena(d.id);
    });
    vstup.addEventListener('blur', () => { if (!vstup.classList.contains('chyba')) vstup.value = zobraz(d, App.nast[d.id]); });
    prvky[d.id] = { d, vstup, rozsah, obal };
  }
  POLE.forEach(vytvorPole);
  for (const [k, v] of Object.entries(M.PRIORITY)) { const o = document.createElement('option'); o.value = k; o.textContent = v; $('#f-kampanPriorita').appendChild(o); }

  /** Přenese stav do formuláře (po načtení předvolby, scénáře…). */
  App.naplnFormular = () => {
    const n = App.nast;
    for (const id in prvky) {
      const { d, vstup, rozsah } = prvky[id];
      if (document.activeElement !== vstup) vstup.value = zobraz(d, n[id]);
      vstup.classList.remove('chyba'); $('#e-' + id).hidden = true;
      if (rozsah) rozsah.value = (d.proc ? 100 : 1) * n[id];
    }
    $('#f-latence').checked = !!n.latence; $('#f-vek').checked = !!n.vek; $('#f-zavaznost').checked = !!n.zavaznost;
    $('#f-kampanPriorita').value = n.kampanPriorita;
    $('#f-krok').value = String(n.krok); if (!$('#f-krok').value) { n.krok = 0.25; $('#f-krok').value = '0.25'; }
    App.viditelnostPoli();
    App.zalozky.agenti && App.zalozky.agenti.naplnit && App.zalozky.agenti.naplnit();
    App.zalozky.stoch && App.zalozky.stoch.naplnit && App.zalozky.stoch.naplnit();
    App.zalozky.kraje && App.zalozky.kraje.naplnit && App.zalozky.kraje.naplnit();
  };
  App.viditelnostPoli = () => {
    for (const id in prvky) { const { d, obal } = prvky[id]; obal.hidden = d.jen ? !d.jen(App.nast) : false; }
    $('#f-kampanPriorita').disabled = !App.nast.vek;
    $('#f-kampanPriorita').title = App.nast.vek ? '' : 'Priorita má smysl jen s věkovou strukturou.';
  };
  $('#f-latence').addEventListener('change', (e) => { App.nast.latence = e.target.checked; App.zmena('latence'); });
  $('#f-vek').addEventListener('change', (e) => { App.nast.vek = e.target.checked; App.zmena('vek'); });
  $('#f-zavaznost').addEventListener('change', (e) => { App.nast.zavaznost = e.target.checked; App.zmena('zavaznost'); });
  $('#f-kampanPriorita').addEventListener('change', (e) => { App.nast.kampanPriorita = e.target.value; App.zmena('kampanPriorita'); });
  $('#f-krok').addEventListener('change', (e) => { App.nast.krok = Number(e.target.value); App.zmena('krok'); });

  // ---------- předvolby ----------
  const PREDVOLBY = [
    { nazev: 'Výchozí (R₀ ≈ 2,5, SEIR)', par: { latence: true, p: 0.05, c: 10, inkubace: 5, infekcni: 5, podilA: 0, vek: false, imunitaDny: 0, sezonA: 0, importy: 0 } },
    { nazev: 'Řádově sezónní chřipka (R₀ ≈ 1,3, sezónnost, slábnoucí imunita)', par: { latence: true, p: 0.026, c: 10, inkubace: 2, infekcni: 5, podilA: 0.3, rA: 0.5, imunitaDny: 365, sezonA: 0.3, sezonMax: 30, importy: 2, dny: 1095 } },
    { nazev: 'Řádově spalničky (R₀ ≈ 15)', par: { latence: true, p: 0.094, c: 20, inkubace: 10, infekcni: 8, podilA: 0, imunitaDny: 0, sezonA: 0 } },
    { nazev: 'Asymptomatický přenos (40 %) a izolace symptomatických', par: { latence: true, p: 0.05, c: 10, inkubace: 4, infekcni: 6, podilA: 0.4, rA: 0.6, izolacePodil: 0.6, izolaceZpozdeni: 1 } },
    { nazev: 'Pod prahem (R₀ = 0,8)', par: { latence: false, p: 0.02, c: 8, infekcni: 5, podilA: 0 } },
    { nazev: 'Endemie: SEIRS s imunitou ½ roku', par: { latence: true, p: 0.04, c: 10, inkubace: 3, infekcni: 5, imunitaDny: 180, dny: 1825, sezonA: 0, importy: 1 } }
  ];
  PREDVOLBY.forEach((p, i) => { const o = document.createElement('option'); o.value = i; o.textContent = p.nazev; $('#predvolba').appendChild(o); });
  $('#predvolba').addEventListener('change', (e) => {
    const p = PREDVOLBY[e.target.value]; e.target.value = '';
    if (!p) return;
    Object.assign(App.nast, p.par);
    App.naplnFormular(); App.zmena('predvolba', true);
    Dialog.info('Ilustrativní předvolba: ' + p.nazev);
  });
  App.bezZasahu = (n) => Object.assign({}, n, { zasahy: [], ockovaniPodil: 0, kampanDavky100k: 0, izolacePodil: 0 });
  $('#b-bez-zasahu').addEventListener('click', () => { App.nast = App.bezZasahu(App.nast); App.osaVybrany = -1; App.naplnFormular(); App.zmena('vse', true); });
  $('#b-vychozi').addEventListener('click', async () => {
    if (!(await Dialog.potvrd('Vrátit všechny parametry na výchozí hodnoty?'))) return;
    App.nast = JSON.parse(JSON.stringify(VYCHOZI)); App.osaVybrany = -1; App.naplnFormular(); App.zmena('vse', true);
  });
  $('#b-sdilet').addEventListener('click', async () => {
    const json = JSON.stringify(App.nast);
    const b64 = btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const url = location.href.split('#')[0] + '#p=' + b64;
    try { await navigator.clipboard.writeText(url); Dialog.info('Odkaz s parametry zkopírován do schránky.'); }
    catch (e) { await Dialog.zeptej('Odkaz s parametry (zkopírujte):', url); }
  });

  // ---------- odvozené veličiny ----------
  App.odvozene = () => {
    let par, st, R0, R0h;
    try {
      const o = M.over(App.parModel()); if (o.chyby.length) throw new Error(o.chyby.join(' '));
      par = o.par; st = M.priprav(par);
      R0 = M.spektralniPolomer(M.maticeDalsichGeneraci(par, st, 0, null, false));
      R0h = par.p * par.c * ((1 - par.podilA) + par.podilA * par.rA) * par.infekcni;
    } catch (e) { $('#odvozene').innerHTML = `<div class="chybovy" style="grid-column:1/-1">${App.esc(e.message)}</div>`; return; }
    const f = App.f, fp = App.fp;
    const S0 = st.pop.map(x => x * (1 - par.ockovaniPodil * par.ucinnost));
    const Rzac = M.spektralniPolomer(M.maticeDalsichGeneraci(par, st, 0, S0, true));
    const gammaEf = 1 / par.infekcni;
    const r = J.rustovaRychlost(par.latence ? 'SEIR' : 'SIR', R0 * gammaEf, gammaEf, par.latence ? 1 / par.inkubace : Infinity);
    let h = App.box('R₀ (spektrální poloměr NGM)', f(R0, 2), par.vek ? 'p·c·D bez věku: ' + f(R0h, 2) : 'R₀ = p·c·D') +
      App.box('R na začátku se zásahy', f(Rzac, 2), Rzac < 1 ? 'pod 1 – ohnisko nevzlétne' : 'den 0: zásahy, imunita, izolace') +
      App.box('Práh stádní imunity', fp(J.prahStadniImunity(R0)), par.vek ? '1 − 1/R₀ (při rovnoměrné imunitě)' : '1 − 1/R₀') +
      App.box('Zdvojení na začátku', r > 0 ? f(Math.log(2) / r, 1) + ' dne' : '—', r > 0 ? 'bez zásahů, r = ' + f(r, 3) + '/den' : 'počet klesá');
    if (M.analytickaPlatnost(par)) {
      const k = M.konecnaVelikostSkupin(par);
      h += App.box('Konečná velikost (teorie)', fp(k.celkem), par.vek ? 'skupinová rovnice' : 'z = s₀(1 − e^(−R z))');
    } else h += App.box('Konečná velikost (teorie)', '—', 'parametry se mění v čase – jen simulace');
    if (par.zavaznost) {
      const w = st.pop.map(x => x / par.N);
      const ihr = st.ihrSkut.reduce((a, x, g) => a + x * w[g], 0), ifr = st.ifrSkut.reduce((a, x, g) => a + x * w[g], 0);
      h += App.box('IHR / IFR (populace)', App.fpa(ihr) + ' / ' + App.fpa(ifr), 'při stejném zasažení všech věků');
    }
    $('#odvozene').innerHTML = h;
    const n = App.nast;
    $('#sk-populace .stav-zasahu').textContent = n.vek ? '8 skupin' : 'homogenní';
    $('#sk-zavaznost .stav-zasahu').textContent = n.zavaznost ? 'zapnuto' : 'vypnuto';
    $('#sk-imunita .stav-zasahu').textContent = [n.imunitaDny > 0 ? 'SEIRS' : '', n.sezonA > 0 ? 'sezóna' : '', n.importy > 0 ? 'importy' : ''].filter(Boolean).join(', ') || 'vypnuto';
    $('#sk-izolace .stav-zasahu').textContent = n.izolacePodil > 0 ? fp(n.izolacePodil, 0) : 'vypnuto';
    $('#sk-ockovani .stav-zasahu').textContent = [n.ockovaniPodil > 0 ? fp(n.ockovaniPodil, 0) : '', n.kampanDavky100k > 0 ? 'kampaň' : ''].filter(Boolean).join(' + ') || 'vypnuto';
    $('#o-izolaceZpozdeni').textContent = n.izolacePodil > 0 ? 'f_iso = ' + f(st.fIso, 3) : '';
  };

  // ---------- časová osa zásahů ----------
  const BARVY_TYP = { vse: '--accent', domov: '--c-h', skola: '--c-e', prace: '--c-s', ostatni: '--c-a' };
  const KRATKE = { vse: 'Vše', domov: 'Domov', skola: 'Škola', prace: 'Práce', ostatni: 'Ostatní' };
  App.osaVybrany = -1;
  const osa = $('#osa-platno'), octx = osa.getContext('2d');
  let tah = null;
  function osaMer() {
    const w = osa.clientWidth;
    const radku = Math.max(2, App.nast.zasahy.length);
    const vyska = 26 + radku * 24;
    if (Math.abs(osa.clientHeight - vyska) > 0.5) osa.style.height = vyska + 'px';
    return { w, h: vyska, x0: 10, sir: w - 20, radku };
  }
  App.kresliOsu = () => {
    const m = osaMer();
    const dpr = window.devicePixelRatio || 1;
    if (!m.w) return;
    if (osa.width !== Math.round(m.w * dpr) || osa.height !== Math.round(m.h * dpr)) { osa.width = Math.round(m.w * dpr); osa.height = Math.round(m.h * dpr); }
    octx.setTransform(dpr, 0, 0, dpr, 0, 0);
    octx.clearRect(0, 0, m.w, m.h);
    const css = getComputedStyle(osa), bar = v => css.getPropertyValue(v).trim();
    const dny = App.nast.dny;
    const X = d => m.x0 + d / dny * m.sir;
    octx.font = '11px ' + (bar('--font') || 'sans-serif');
    octx.strokeStyle = bar('--border'); octx.fillStyle = bar('--text-muted'); octx.textAlign = 'center'; octx.textBaseline = 'top';
    const krok = [7, 14, 30, 60, 90, 180, 365, 730].find(k => dny / k <= Math.max(3, m.sir / 60)) || 1000;
    for (let d = 0; d <= dny; d += krok) {
      const x = Math.round(X(d)) + 0.5;
      octx.beginPath(); octx.moveTo(x, 18); octx.lineTo(x, m.h); octx.stroke();
      octx.fillText(App.f(d, 0), Math.min(m.w - 12, Math.max(10, x)), 3);
    }
    App.nast.zasahy.forEach((z, i) => {
      const y = 22 + i * 24, a = X(Math.min(dny, z.od)), b = X(Math.min(dny, z.do));
      const c = bar(BARVY_TYP[z.typ] || '--accent');
      octx.globalAlpha = 0.18 + 0.5 * z.sila; octx.fillStyle = c;
      octx.fillRect(a, y, Math.max(2, b - a), 19); octx.globalAlpha = 1;
      octx.strokeStyle = c; octx.lineWidth = i === App.osaVybrany ? 2.5 : 1.2;
      octx.strokeRect(a + 0.5, y + 0.5, Math.max(2, b - a) - 1, 18);
      octx.fillStyle = bar('--text'); octx.textAlign = 'left'; octx.textBaseline = 'middle';
      const text = `${KRATKE[z.typ]} −${Math.round(z.sila * 100)} % (${App.f(z.od, 0)}–${App.f(z.do, 0)})`;
      const sirT = octx.measureText(text).width;
      if (b - a >= sirT + 10) octx.fillText(text, a + 5, y + 10);
      else if (b + 6 + sirT <= m.w - 4) octx.fillText(text, b + 6, y + 10);           // vedle pruhu vpravo
      else if (a - 6 - sirT >= 4) { octx.textAlign = 'right'; octx.fillText(text, a - 6, y + 10); }  // vlevo
      else { octx.save(); octx.beginPath(); octx.rect(a, y, Math.max(2, b - a), 19); octx.clip(); octx.fillText(text, a + 5, y + 10); octx.restore(); }
    });
    if (!App.nast.zasahy.length) { octx.fillStyle = bar('--text-muted'); octx.textAlign = 'left'; octx.textBaseline = 'middle'; octx.fillText('Žádné zásahy – přidejte je tlačítkem „+ Přidat zásah“ nebo šablonou.', 12, 40); }
  };
  function osaZasah(px, py) {
    const m = osaMer(), dny = App.nast.dny;
    const i = Math.floor((py - 22) / 24);
    const z = App.nast.zasahy[i];
    if (!z) return null;
    const a = m.x0 + z.od / dny * m.sir, b = m.x0 + Math.min(dny, z.do) / dny * m.sir;
    if (px < a - 7 || px > b + 7) return null;
    const rezim = Math.abs(px - a) <= 7 ? 'od' : Math.abs(px - b) <= 7 ? 'do' : 'posun';
    return { i, rezim };
  }
  osa.addEventListener('pointerdown', (e) => {
    const r = osa.getBoundingClientRect();
    const hit = osaZasah(e.clientX - r.left, e.clientY - r.top);
    if (!hit) { return; }
    App.osaVybrany = hit.i;
    const z = App.nast.zasahy[hit.i];
    tah = { ...hit, start: e.clientX, od: z.od, do: z.do };
    osa.setPointerCapture(e.pointerId);
    App.editorOsy(); App.kresliOsu();
    e.preventDefault();
  });
  osa.addEventListener('pointermove', (e) => {
    const r = osa.getBoundingClientRect();
    if (!tah) {
      const hit = osaZasah(e.clientX - r.left, e.clientY - r.top);
      osa.style.cursor = !hit ? 'default' : hit.rezim === 'posun' ? 'grab' : 'ew-resize';
      return;
    }
    const m = osaMer();
    const dd = Math.round((e.clientX - tah.start) / m.sir * App.nast.dny);
    const z = App.nast.zasahy[tah.i];
    const delka = tah.do - tah.od;
    if (tah.rezim === 'posun') { z.od = Math.max(0, tah.od + dd); z.do = z.od + delka; }
    else if (tah.rezim === 'od') z.od = Math.max(0, Math.min(tah.do - 1, tah.od + dd));
    else z.do = Math.max(tah.od + 1, tah.do + dd);
    App.kresliOsu(); App.editorOsy(true);
    App.zmena('zasahy');
  });
  const pust = () => { if (tah) { tah = null; App.editorOsy(); } };
  osa.addEventListener('pointerup', pust); osa.addEventListener('pointercancel', pust);
  osa.addEventListener('keydown', (e) => {
    const z = App.nast.zasahy[App.osaVybrany];
    if (!z) { if (e.key === 'ArrowDown' && App.nast.zasahy.length) { App.osaVybrany = 0; App.editorOsy(); App.kresliOsu(); e.preventDefault(); } return; }
    const k = e.shiftKey ? 10 : 1;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const d = e.key === 'ArrowRight' ? k : -k;
      if (e.altKey) z.do = Math.max(z.od + 1, z.do + d);
      else { const del = z.do - z.od; z.od = Math.max(0, z.od + d); z.do = z.od + del; }
      e.preventDefault(); App.kresliOsu(); App.editorOsy(); App.zmena('zasahy');
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      App.osaVybrany = Math.max(0, Math.min(App.nast.zasahy.length - 1, App.osaVybrany + (e.key === 'ArrowDown' ? 1 : -1)));
      e.preventDefault(); App.kresliOsu(); App.editorOsy();
    } else if (e.key === 'Delete') { smazZasah(App.osaVybrany); e.preventDefault(); }
  });
  let osaRaf = 0;
  new ResizeObserver(() => { cancelAnimationFrame(osaRaf); osaRaf = requestAnimationFrame(App.kresliOsu); }).observe(osa);
  new MutationObserver(() => App.kresliOsu()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  function smazZasah(i) {
    App.nast.zasahy.splice(i, 1);
    App.osaVybrany = Math.min(App.osaVybrany, App.nast.zasahy.length - 1);
    App.kresliOsu(); App.editorOsy(); App.zmena('zasahy');
  }
  /** Editor vybraného zásahu (jenHodnoty = jen přepsat čísla, nevytvářet znovu prvky). */
  App.editorOsy = (jenHodnoty) => {
    const el = $('#osa-editor');
    const z = App.nast.zasahy[App.osaVybrany];
    if (!z) { el.innerHTML = App.nast.zasahy.length ? '<p class="napoveda">Klepněte na zásah v ose pro úpravu.</p>' : ''; return; }
    if (jenHodnoty && el.dataset.i === String(App.osaVybrany)) {
      $('#oz-od').value = App.f(z.od, 1).replace(/\s/g, ''); $('#oz-do').value = App.f(z.do, 1).replace(/\s/g, '');
      return;
    }
    el.dataset.i = String(App.osaVybrany);
    el.innerHTML = `<div class="osa-editor">
      <div><label class="popisek" for="oz-typ">Prostředí</label><select id="oz-typ">${Object.entries(M.NAZVY_PROSTREDI).map(([k, v]) => `<option value="${k}"${k === z.typ ? ' selected' : ''}>${App.esc(v)}</option>`).join('')}</select></div>
      <div><label class="popisek" for="oz-sila"><span>Snížení kontaktů [%]</span></label><div class="s-posuvnikem"><input type="range" id="oz-silar" min="0" max="100" step="5" value="${Math.round(z.sila * 100)}" aria-label="Snížení kontaktů – posuvník"><input type="text" inputmode="decimal" id="oz-sila" value="${App.f(z.sila * 100, 1)}"></div></div>
      <div class="mrizka2"><div><label class="popisek" for="oz-od">Od dne</label><input type="text" inputmode="decimal" id="oz-od" value="${App.f(z.od, 1).replace(/\s/g, '')}"></div>
        <div><label class="popisek" for="oz-do">Do dne</label><input type="text" inputmode="decimal" id="oz-do" value="${App.f(z.do, 1).replace(/\s/g, '')}"></div></div>
      <div class="tlacitka"><button type="button" class="male" id="oz-smaz">Smazat zásah</button></div></div>`;
    const cislo = (s) => Number(String(s).replace(/\s/g, '').replace(',', '.'));
    $('#oz-typ').addEventListener('change', (e) => { z.typ = e.target.value; App.kresliOsu(); App.zmena('zasahy'); });
    const sila = (v) => { if (!(v >= 0 && v <= 100)) return; z.sila = v / 100; App.kresliOsu(); App.zmena('zasahy'); };
    $('#oz-silar').addEventListener('input', (e) => { $('#oz-sila').value = e.target.value; sila(Number(e.target.value)); });
    $('#oz-sila').addEventListener('input', (e) => { const v = cislo(e.target.value); if (v >= 0 && v <= 100) { $('#oz-silar').value = v; sila(v); } });
    $('#oz-od').addEventListener('input', (e) => { const v = cislo(e.target.value); if (v >= 0 && v < z.do) { z.od = v; App.kresliOsu(); App.zmena('zasahy'); } });
    $('#oz-do').addEventListener('input', (e) => { const v = cislo(e.target.value); if (v > z.od) { z.do = v; App.kresliOsu(); App.zmena('zasahy'); } });
    $('#oz-smaz').addEventListener('click', () => smazZasah(App.osaVybrany));
  };
  $('#b-zasah-pridat').addEventListener('click', () => {
    const d = App.nast.dny;
    App.nast.zasahy.push({ typ: 'vse', od: Math.round(d * 0.1), do: Math.round(d * 0.3), sila: 0.4 });
    App.osaVybrany = App.nast.zasahy.length - 1;
    App.kresliOsu(); App.editorOsy(); App.zmena('zasahy');
  });
  const SABLONY = {
    skoly: [{ typ: 'skola', od: 20, do: 80, sila: 1 }],
    lockdown: [{ typ: 'vse', od: 30, do: 75, sila: 0.6 }],
    vlny: [{ typ: 'vse', od: 30, do: 60, sila: 0.5 }, { typ: 'vse', od: 110, do: 140, sila: 0.5 }, { typ: 'vse', od: 190, do: 220, sila: 0.5 }],
    prace: [{ typ: 'prace', od: 20, do: 110, sila: 0.5 }]
  };
  $('#zasah-sablona').addEventListener('change', (e) => {
    const s = SABLONY[e.target.value]; e.target.value = '';
    if (!s) return;
    App.nast.zasahy.push(...s.map(z => Object.assign({}, z)));
    App.osaVybrany = App.nast.zasahy.length - 1;
    App.kresliOsu(); App.editorOsy(); App.zmena('zasahy');
  });
  /** Pásma zásahů pro grafy. */
  App.pasma = (n = App.nast) => (n.zasahy || []).map((z, i) => ({ x0: z.od, x1: z.do, popis: `${KRATKE[z.typ]} −${Math.round(z.sila * 100)} %`, radek: i % 3 }));

  // ---------- záložky a změny ----------
  const ZALOZKY = ['model', 'stoch', 'agenti', 'kraje', 'data', 'citlivost', 'porovnani', 'dok'];
  App.aktivni = 'model';
  App.prepni = (id, fokus) => {
    if (!ZALOZKY.includes(id)) id = 'model';
    const predchozi = App.aktivni;
    App.aktivni = id;
    for (const z of ZALOZKY) {
      $('#z-' + z).setAttribute('aria-selected', String(z === id));
      $('#z-' + z).tabIndex = z === id ? 0 : -1;
      $('#p-' + z).hidden = z !== id;
    }
    if (fokus) $('#z-' + id).focus();
    App.zapis('zalozka2', id);
    if (predchozi !== id && App.zalozky[predchozi] && App.zalozky[predchozi].deaktivuj) App.zalozky[predchozi].deaktivuj();
    const z = App.zalozky[id];
    if (z && z.aktivuj) z.aktivuj();
    Graf.vsechny.forEach(g => { if (g.platno.offsetParent) g.kresli(); });
  };
  ZALOZKY.forEach((z, i) => {
    $('#z-' + z).addEventListener('click', () => App.prepni(z));
    $('#z-' + z).addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        App.prepni(ZALOZKY[(i + (e.key === 'ArrowRight' ? 1 : ZALOZKY.length - 1)) % ZALOZKY.length], true);
      }
    });
  });
  document.querySelectorAll('[data-prejdi]').forEach(a => a.addEventListener('click', (e) => { e.preventDefault(); App.prepni(a.dataset.prejdi, true); }));

  let casovac = 0;
  /** Změna parametru: uloží, přepočítá odvozené, aktivní záložku (s krátkým zpožděním), ostatní označí jako zastaralé. */
  App.zmena = (co, hned) => {
    App.ulozit();
    App.viditelnostPoli();
    App.odvozene();
    if (co === 'dny' || co === 'zasahy' || co === 'vse') App.kresliOsu();
    for (const id in App.zalozky) App.zalozky[id].zastarale = true;
    clearTimeout(casovac);
    const proved = () => { const z = App.zalozky[App.aktivni]; if (z && z.zmena) z.zmena(co); };
    if (hned) proved(); else casovac = setTimeout(proved, 150);
  };
})();

/* ============================================================
   mapa_souvislosti/ui.js – jádro editoru: stav, kreslení SVG, myš, klávesnice, ukládání.
   Panely jsou v ui_panely.js, nástroje (minimapa, paleta příkazů, prezentace, export,
   Wikipedie, verze) v ui_nastroje.js. Všechny části sdílí objekt window.MapaApp (A);
   spuštění volá A.start() na konci ui_nastroje.js.
   Logika bez DOM je v jadro.js, analyza.js, formaty.js, rozlozeni.js.
   Pro testy: window.MAPA_SOUVISLOSTI === A.
   ============================================================ */
(function () {
  'use strict';
  const J = window.MapaJadro, S = window.MapaSablony;
  const KLIC = 'webapp_mapa_souvislosti';
  const $ = id => document.getElementById(id);
  const esc = J.esc;
  const A = window.MapaApp = {};
  A.J = J; A.$ = $; A.esc = esc; A.KLIC = KLIC;

  /* ---------- stav ---------- */
  let ulozene = { aktivni: null, mapy: [] };   /* mapy: [{id, nazev, upraveno, data}] */
  let mapa = null, idMapy = null;
  let pohled = { x: 0, y: 0, z: 1 };
  let vybUzly = new Set(), vybHrany = new Set(), vybSkupina = null;
  let zpet = [], znovu = [];
  let rezim = 'normal', zdrojSpojeni = null;
  let nalezy = [], indexNalezu = -1;
  let cesta = null;
  let geo = new Map(), geoHran = new Map(), stupne = new Map();
  let schranka = null;
  let animace = null;
  let osaCasu = null;   /* značky let po rozmístění na časovou osu (jen do dalšího rozmístění / otevření mapy) */
  let revize = 0;       /* roste s každou změnou modelu – klíč pro mezipaměť analýzy */
  let vykresleneUzly = new Set();

  /* nastavení zobrazení (pro tohoto návštěvníka, ne součást mapy) */
  const nastaveni = { stitky: true, okoli: false, hloubka: 1, minimapa: true, mrizka: false, velikostPodle: '', barvaPodle: 'typ', mosty: false, zamcene: true };
  try { Object.assign(nastaveni, JSON.parse(localStorage.getItem(KLIC + '_nastaveni') || '{}')); } catch (e) { /* nic */ }
  function ulozNastaveni() { try { localStorage.setItem(KLIC + '_nastaveni', JSON.stringify(nastaveni)); } catch (e) { /* nic */ } }
  A.nastaveni = nastaveni; A.ulozNastaveni = ulozNastaveni;

  /* filtry (platí pro otevřenou mapu, při otevření jiné se zruší) */
  const prazdnyFiltr = () => ({ typy: new Set(), typyVztahu: new Set(), tagy: new Set(), od: '', do: '', minStupen: 0, komunita: null, atribut: '', rezim: 'skryt' });
  let filtr = prazdnyFiltr();
  A.zrusFiltry = () => { filtr = prazdnyFiltr(); prekresli(); vykresliPanely(); };
  A.filtrAktivni = () => !!(filtr.typy.size || filtr.typyVztahu.size || filtr.tagy.size || filtr.od || filtr.do || filtr.minStupen || filtr.komunita != null || filtr.atribut);

  /* ---------- měření textu ---------- */
  const ctx = document.createElement('canvas').getContext('2d');
  const PISMO = getComputedStyle(document.body).fontFamily || 'sans-serif';
  const cacheMer = new Map();
  function mer(t, tucne) {
    const k = (tucne ? 'b' : 'n') + t;
    let w = cacheMer.get(k);
    if (w == null) {
      ctx.font = tucne ? '600 13px ' + PISMO : '400 11.5px ' + PISMO;
      w = ctx.measureText(t).width;
      if (cacheMer.size > 20000) cacheMer.clear();
      cacheMer.set(k, w);
    }
    return w;
  }
  A.mer = mer; A.PISMO = PISMO;

  /* poměry stran obrázků uzlů (zjišťují se načtením, pak se uzel překreslí) */
  const pomery = new Map();
  function pomerObrazku(url) {
    if (!url) return 0;
    if (pomery.has(url)) return pomery.get(url);
    pomery.set(url, 0);
    const img = new Image();
    img.onload = () => { pomery.set(url, img.naturalWidth / (img.naturalHeight || 1) || 1.6); prekresliPozdeji(); };
    img.onerror = () => pomery.set(url, 1.6);
    img.src = url;
    return 0;
  }
  A.pomery = pomery;

  /* ---------- ukládání ---------- */
  function nactiUlozene() {
    try {
      const s = localStorage.getItem(KLIC);
      if (s) { const d = JSON.parse(s); if (d && Array.isArray(d.mapy)) ulozene = d; }
    } catch (e) { /* soukromé okno / zakázané úložiště */ }
  }
  let casovacUlozeni = null;
  function ulozPozdeji() {
    $('stavUlozeno').textContent = 'Neuloženo…';
    clearTimeout(casovacUlozeni);
    casovacUlozeni = setTimeout(ulozHned, 500);
  }
  function ulozHned() {
    clearTimeout(casovacUlozeni);
    if (!mapa) return;
    const r = svg.getBoundingClientRect();
    mapa.pohled = { x: Math.round(pohled.x), y: Math.round(pohled.y), z: +pohled.z.toFixed(3), w: Math.round(r.width), h: Math.round(r.height) };
    const zaz = ulozene.mapy.find(m => m.id === idMapy);
    const data = JSON.parse(J.naJSON(mapa));
    if (zaz) { zaz.data = data; zaz.nazev = mapa.nazev; zaz.upraveno = Date.now(); }
    else ulozene.mapy.push({ id: idMapy, nazev: mapa.nazev, upraveno: Date.now(), data });
    ulozene.aktivni = idMapy;
    try {
      localStorage.setItem(KLIC, JSON.stringify(ulozene));
      $('stavUlozeno').textContent = '✓ Uloženo v prohlížeči';
    } catch (e) {
      $('stavUlozeno').textContent = '⚠ Nelze uložit (plné úložiště – velké obrázky?) – exportujte JSON';
    }
  }

  function otevriMapu(id) {
    const zaz = ulozene.mapy.find(m => m.id === id);
    if (!zaz) return;
    if (mapa) ulozHned();
    let nova;
    try { nova = J.nactiData(zaz.data).mapa; }
    catch (e) { Dialog.chyba('Mapu se nepodařilo načíst: ' + e.message); return; }
    if (A.prezentace && A.prezentace.bezi()) A.prezentace.konec();
    mapa = nova;
    idMapy = id; ulozene.aktivni = id;
    vybUzly.clear(); vybHrany.clear(); vybSkupina = null; zpet = []; znovu = []; cesta = null; osaCasu = null;
    filtr = prazdnyFiltr(); revize++;
    zrusRezim();
    doplnPozice();
    prekresli();
    /* uložený pohled jen při stejné velikosti plátna (jinak by na mobilu ukázal kus mapy z desktopu) */
    const r = svg.getBoundingClientRect();
    if (mapa.pohled && mapa.pohled.w === Math.round(r.width) && mapa.pohled.h === Math.round(r.height)) { pohled = { x: mapa.pohled.x, y: mapa.pohled.y, z: mapa.pohled.z }; aplikujPohled(); }
    else prizpusobit();
    aktualizujVyberMap();
    vykresliPanely();
    aktualizujTlacitka();
    try { localStorage.setItem(KLIC, JSON.stringify(ulozene)); } catch (e) { /* nic */ }
  }

  function vlozNovouMapu(m, otevrit) {
    const id = 'm' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
    if (mapa) ulozHned();
    ulozene.mapy.push({ id, nazev: m.nazev, upraveno: Date.now(), data: JSON.parse(J.naJSON(m)) });
    if (otevrit !== false) otevriMapu(id);
    return id;
  }

  function mapaZeSablony(sid) {
    const s = S.SABLONY.find(x => x.id === sid);
    const m = S.vytvor(J, s);
    const g = new Map(m.uzly.map(u => [u.id, J.geometrieUzlu(m, u, mer, {})]));
    (window.MapaRozlozeni ? window.MapaRozlozeni.rozmistiSilove : J.rozmistiSilove)(m, g, { iterace: 500, seed: 11 });
    return m;
  }

  function aktualizujVyberMap() {
    const sel = $('vyberMapy');
    const serazene = ulozene.mapy.slice().sort((a, b) => a.nazev.localeCompare(b.nazev, 'cs'));
    sel.innerHTML = serazene.map(m => '<option value="' + esc(m.id) + '"' + (m.id === idMapy ? ' selected' : '') + '>' + esc(m.nazev) + '</option>').join('');
  }
  function smazMapu(id) {
    ulozene.mapy = ulozene.mapy.filter(m => m.id !== id);
    try { localStorage.removeItem(KLIC + '_verze_' + id); } catch (e) { /* nic */ }
    if (id !== idMapy) { aktualizujVyberMap(); return; }
    mapa = null;
    if (!ulozene.mapy.length) { vlozNovouMapu(J.novaMapa('Nová mapa')); return; }
    otevriMapu(ulozene.mapy[0].id);
  }

  /* ---------- historie ---------- */
  function zaloha() {
    zpet.push(JSON.stringify(mapa));
    if (zpet.length > 100) zpet.shift();
    znovu = [];
    aktualizujTlacitka();
  }
  function obnov(snimek) {
    mapa = JSON.parse(snimek);
    const ids = new Set(mapa.uzly.map(u => u.id)), hids = new Set(mapa.hrany.map(h => h.id));
    vybUzly = new Set([...vybUzly].filter(i => ids.has(i)));
    vybHrany = new Set([...vybHrany].filter(i => hids.has(i)));
    if (vybSkupina && !(mapa.skupiny || []).some(s => s.id === vybSkupina)) vybSkupina = null;
    cesta = null;
    zmena(true);
  }
  function krokZpet() { if (!zpet.length) return; znovu.push(JSON.stringify(mapa)); obnov(zpet.pop()); }
  function krokZnovu() { if (!znovu.length) return; zpet.push(JSON.stringify(mapa)); obnov(znovu.pop()); }
  /* nahradí celý obsah mapy (vrátit jde přes Zpět) */
  function nahradMapu(nova) { zaloha(); mapa = nova; vybUzly.clear(); vybHrany.clear(); vybSkupina = null; cesta = null; zmena(); }

  /* po každé změně modelu */
  function zmena(panely) {
    revize++;
    prekresli();
    if (panely !== false) vykresliPanely();
    aktualizujTlacitka();
    ulozPozdeji();
  }

  /* ---------- analýza (mezipaměť podle revize) ---------- */
  let cacheAnalyzy = { revize: -1, data: null };
  function analyza() {
    if (!window.MapaAnalyza) return null;
    if (cacheAnalyzy.revize === revize && cacheAnalyzy.data) return cacheAnalyzy.data;
    let d = null;
    try { d = window.MapaAnalyza.shrnuti(mapa, {}); } catch (e) { console.error(e); }
    if (d) d.podleId = new Map(d.radky.map(r => [r.id, r]));
    cacheAnalyzy = { revize, data: d };
    return d;
  }
  /* metrika uzlu normalizovaná do 0..1 (podle maxima v mapě) */
  function normMetrika(id) {
    const d = analyza();
    const m = nastaveni.velikostPodle || nastaveni.barvaPodle;
    if (!d) return 0;
    if (!d.max || d.max.metrika !== m) {
      let mx = 0, mn = Infinity;
      for (const r of d.radky) { const v = +r[m] || 0; if (v > mx) mx = v; if (v < mn) mn = v; }
      d.max = { metrika: m, mx, mn };
    }
    const r = d.podleId.get(id);
    if (!r) return 0;
    const { mx, mn } = d.max;
    return mx > mn ? ((+r[m] || 0) - mn) / (mx - mn) : 0;
  }
  function hodnotaMetriky(id, m) {
    const d = analyza();
    if (!d) return 0;
    if (!d.rozsah) d.rozsah = {};
    if (!d.rozsah[m]) {
      let mx = 0, mn = Infinity;
      for (const r of d.radky) { const v = +r[m] || 0; if (v > mx) mx = v; if (v < mn) mn = v; }
      d.rozsah[m] = { mx, mn };
    }
    const r = d.podleId.get(id), { mx, mn } = d.rozsah[m];
    return r && mx > mn ? ((+r[m] || 0) - mn) / (mx - mn) : 0;
  }
  const PALETA_KOMUNIT = ['#3987e5', '#d95926', '#199e70', '#9085e9', '#c98500', '#d55181', '#2aa5b5', '#6ca83a', '#b5651d', '#7b8794'];
  function barvaSkala(t) {
    /* modrá → žlutá → červená */
    const s = [[0x5b, 0x8f, 0xf9], [0xf6, 0xbd, 0x16], [0xe8, 0x68, 0x4a]];
    const k = Math.max(0, Math.min(1, t)) * 2, i = Math.min(1, Math.floor(k)), f = k - i;
    const c = s[i].map((v, j) => Math.round(v + (s[i + 1][j] - v) * f));
    return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
  }
  function barvaUzlu(u) {
    const bp = nastaveni.barvaPodle;
    if (bp === 'komunita') {
      const d = analyza();
      const r = d && d.podleId.get(u.id);
      if (r && r.komunita != null) return PALETA_KOMUNIT[r.komunita % PALETA_KOMUNIT.length];
    } else if (bp && bp !== 'typ') {
      return barvaSkala(hodnotaMetriky(u.id, bp));
    }
    return u.barva || J.typUzlu(mapa, u).barva;
  }
  function meritkoUzlu(u) {
    const m = nastaveni.velikostPodle;
    if (!m) return 1;
    return 0.85 + 1.15 * Math.sqrt(hodnotaMetriky(u.id, m));
  }
  A.analyza = analyza; A.barvaUzlu = barvaUzlu; A.PALETA_KOMUNIT = PALETA_KOMUNIT; A.barvaSkala = barvaSkala;

  /* ---------- filtry a viditelnost ---------- */
  function prosel(u) {
    if (filtr.typy.has(u.typ)) return false;
    if (filtr.tagy.size && !u.tagy.some(t => filtr.tagy.has(t))) return false;
    if (filtr.od || filtr.do) {
      const r = J.rokZData(u.datum);
      if (!isFinite(r)) return false;
      const rDo = isFinite(J.rokZData(u.datumDo)) ? J.rokZData(u.datumDo) : r;
      if (filtr.od && isFinite(J.rokZData(filtr.od)) && rDo < J.rokZData(filtr.od)) return false;
      if (filtr.do && isFinite(J.rokZData(filtr.do)) && r > J.rokZData(filtr.do) + 0.9999) return false;
    }
    if (filtr.minStupen && (stupne.get(u.id) || 0) < filtr.minStupen) return false;
    if (filtr.komunita != null) {
      const d = analyza(), r = d && d.podleId.get(u.id);
      if (!r || r.komunita !== filtr.komunita) return false;
    }
    if (filtr.atribut) {
      const q = J.bezDiakritiky(filtr.atribut.toLowerCase());
      if (!(u.atributy || []).some(a => J.bezDiakritiky((a[0] + ': ' + a[1]).toLowerCase()).indexOf(q) >= 0)) return false;
    }
    return true;
  }
  /* vidět = projde filtrem, nebo je filtr v režimu ztlumení */
  function viditelny(u) { return filtr.rezim === 'ztlumit' || prosel(u); }
  function hranaVidet(h) { return !filtr.typyVztahu.has(h.typ || ''); }   /* '' = vztahy bez typu */
  A.prosel = prosel; A.viditelny = u => viditelny(u);
  Object.defineProperty(A, 'filtr', { get: () => filtr });

  /* ---------- geometrie a kreslení ---------- */
  const svg = $('platno');
  function doplnPozice() {
    const bez = mapa.uzly.filter(u => !isFinite(u.x) || !isFinite(u.y));
    if (!bez.length) return;
    spocitejGeo();
    const pevne = new Set(mapa.uzly.filter(u => isFinite(u.x) && isFinite(u.y)).map(u => u.id));
    const sim = J.silovaSimulace(mapa, geo, { pevne: pevne.size ? pevne : undefined, seed: 5 });
    for (let i = 0; i < 300; i++) sim.krok(1);
    J.odstranPrekryvy(mapa, geo, pevne);
  }

  function spocitejGeo() {
    const st = J.statistika(mapa);
    stupne = st.stupne;
    geo = new Map();
    for (const u of mapa.uzly) {
      geo.set(u.id, J.geometrieUzlu(mapa, u, mer, { stupen: stupne.get(u.id), meritko: meritkoUzlu(u), obrazekPomer: u.rozbaleny ? pomerObrazku(u.obrazek) : 0 }));
    }
  }

  /* viditelná oblast plátna ve světových souřadnicích (s rezervou) */
  function vyrez(rezerva) {
    const r = svg.getBoundingClientRect();
    const m = (rezerva || 0) / pohled.z;
    return { x1: -pohled.x / pohled.z - m, y1: -pohled.y / pohled.z - m, x2: (r.width - pohled.x) / pohled.z + m, y2: (r.height - pohled.y) / pohled.z + m };
  }
  const OREZ_OD = 250;   /* od kolika uzlů se kreslí jen to, co je vidět */

  function prekresli() {
    if (!mapa) return;
    spocitejGeo();
    const vid = new Set(mapa.uzly.filter(viditelny).map(u => u.id));
    const ztlum = mnozinaZtlumeni();
    const cestaU = cesta ? new Set(cesta.uzly) : null, cestaH = cesta ? new Set(cesta.hrany) : null;
    const nal = new Set(nalezy);
    const orez = mapa.uzly.length > OREZ_OD ? vyrez(300) : null;
    const vOrezu = u => { if (!orez) return true; const g = geo.get(u.id); return u.x + g.w / 2 > orez.x1 && u.x - g.w / 2 < orez.x2 && u.y + g.h / 2 > orez.y1 && u.y - g.h / 2 < orez.y2; };
    const an = (nastaveni.mosty && analyza()) || null;
    const kloubove = an ? new Set(an.radky.filter(r => r.kloubovy).map(r => r.id)) : null;
    const mosty = an && window.MapaAnalyza ? new Set(window.MapaAnalyza.mosty(mapa)) : null;
    /* skupiny */
    const sk = [];
    for (const s of mapa.skupiny || []) {
      const r = J.obalSkupiny(mapa, geo, s, vid);
      if (!r) continue;
      sk.push('<g class="skupina' + (vybSkupina === s.id ? ' vybrana' : '') + '" data-skupina="' + esc(s.id) + '" style="--sc:' + s.barva + '">' +
        '<rect class="ram" x="' + r.x.toFixed(1) + '" y="' + r.y.toFixed(1) + '" width="' + r.w.toFixed(1) + '" height="' + r.h.toFixed(1) + '" rx="12"/>' +
        '<rect class="hlava" x="' + r.x.toFixed(1) + '" y="' + r.y.toFixed(1) + '" width="' + r.w.toFixed(1) + '" height="' + J.SKUPINA_HLAVA + '" rx="12"><title>Tažením přesunete celou skupinu</title></rect>' +
        '<text x="' + (r.x + 12).toFixed(1) + '" y="' + (r.y + 17).toFixed(1) + '">' + esc(s.nazev) + ' <tspan class="pocet-sk">' + s.uzly.length + '</tspan></text></g>');
    }
    $('vrstvaSkupin').innerHTML = sk.join('');
    /* uzly */
    const out = [];
    vykresleneUzly = new Set();
    for (const u of mapa.uzly) {
      if (!vid.has(u.id) || !vOrezu(u)) continue;
      vykresleneUzly.add(u.id);
      const g = geo.get(u.id);
      const c = barvaUzlu(u);
      const cls = ['uzel'];
      if (vybUzly.has(u.id)) cls.push('vybrany');
      if (zdrojSpojeni === u.id) cls.push('zdroj');
      if (nal.has(u.id)) cls.push('nalez');
      if (cestaU && cestaU.has(u.id)) cls.push('cesta');
      if (ztlum && !ztlum.has(u.id)) cls.push('ztlumeny');
      if (kloubove && kloubove.has(u.id)) cls.push('kloubovy');
      const uz = c === u.barva ? u : Object.assign({}, u, { barva: c });
      let s = '<g class="' + cls.join(' ') + '" data-id="' + esc(u.id) + '" style="--c:' + c + '" transform="translate(' + (u.x - g.w / 2).toFixed(1) + ' ' + (u.y - g.h / 2).toFixed(1) + ')' + (g.k !== 1 ? ' scale(' + g.k.toFixed(3) + ')' : '') + '">';
      s += '<rect class="obrys" x="-5" y="-5" width="' + (g.w0 + 10) + '" height="' + (g.h0 + 10) + '" rx="' + (g.tvar === 'elipsa' ? g.h0 / 2 + 5 : 12) + '"/>';
      s += J.svgUzlu(mapa, uz, g, null);
      const maObsah = u.popis || u.datum || u.tagy.length || u.odkaz || u.obrazek || (u.atributy && u.atributy.length);
      s += '<text class="rozb" x="' + (g.w0 - (g.odsazeni || 0) - 13) + '" y="' + (g.tvar === 'elipsa' ? g.h0 / 2 + 3 : 15) + '">' + (u.rozbaleny ? '▾' : (maObsah ? '▸' : '')) + '</text>';
      if (u.zamceny) s += '<text class="zamek" x="' + (g.w0 - (g.odsazeni || 0) - 14) + '" y="' + (g.h0 - 5) + '">🔒</text>';
      s += '<circle class="uchyt" cx="' + g.w0 + '" cy="' + (g.h0 / 2) + '" r="7"><title>Táhněte na jiný uzel – vznikne vztah</title></circle>';
      s += '</g>';
      out.push(s);
    }
    $('vrstvaUzlu').innerHTML = out.join('');
    /* hrany */
    const m = { typy: mapa.typy, typyVztahu: mapa.typyVztahu, uzly: mapa.uzly.filter(u => vid.has(u.id)), hrany: mapa.hrany.filter(h => vid.has(h.od) && vid.has(h.do) && hranaVidet(h)) };
    geoHran = J.geometrieHran(m, geo);
    const hr = [], st = [];
    for (const h of m.hrany) {
      const g = geoHran.get(h.id);
      if (!g) continue;
      if (orez && !vykresleneUzly.has(h.od) && !vykresleneUzly.has(h.do)) {
        const x1 = Math.min(g.x1, g.x2), x2 = Math.max(g.x1, g.x2), y1 = Math.min(g.y1, g.y2), y2 = Math.max(g.y1, g.y2);
        if (x2 < orez.x1 || x1 > orez.x2 || y2 < orez.y1 || y1 > orez.y2) continue;
      }
      const cls = ['hrana'];
      if (vybHrany.has(h.id)) cls.push('vybrana');
      if (cestaH && cestaH.has(h.id)) cls.push('cesta');
      else if (vybUzly.size && (vybUzly.has(h.od) || vybUzly.has(h.do))) cls.push('zvyraznena');
      if (mosty && mosty.has(h.id)) cls.push('most');
      const tlumena = ztlum && !(ztlum.has(h.od) && ztlum.has(h.do));
      if (tlumena) cls.push('ztlumeny');
      const dash = h.styl === 'carkovana' ? ' stroke-dasharray="8 5"' : h.styl === 'teckovana' ? ' stroke-dasharray="2 4" stroke-linecap="round"' : '';
      const barva = J.barvaHrany(mapa, h);
      let s = '<g class="' + cls.join(' ') + '" data-hrana="' + esc(h.id) + '"' + (barva ? ' style="--hc:' + barva + '"' : '') + (g.skryta ? ' display="none"' : '') + '>';
      s += '<path class="zasah" d="' + g.d + '"/>';
      s += '<path class="cara" d="' + g.d + '" stroke-width="' + (1 + h.sila * 0.6).toFixed(1) + '"' + dash + '/>';
      s += '<path class="hrot hk" d="' + (g.sipkaKonec || '') + '"/>';
      s += '<path class="hrot hz" d="' + (g.sipkaZacatek || '') + '"/>';
      s += '</g>';
      hr.push(s);
      const text = J.stitekHrany(mapa, h);
      if (nastaveni.stitky && text && !g.skryta) {
        const w = mer(text, false) + 10;
        st.push('<g class="stitek' + (vybHrany.has(h.id) ? ' vybrana' : '') + (tlumena ? ' ztlumeny' : '') + (h.popis ? '' : ' ztypu') + '" data-hrana="' + esc(h.id) + '" transform="translate(' + g.lx.toFixed(1) + ' ' + g.ly.toFixed(1) + ')">' +
          '<rect x="' + (-w / 2).toFixed(1) + '" y="-9" width="' + w.toFixed(1) + '" height="18" rx="4"/><text x="0" y="4" text-anchor="middle">' + esc(text) + '</text></g>');
      }
    }
    if (osaCasu) {
      const o = osaCasu;
      hr.unshift('<g class="osa-casu"><line x1="' + (o.x1 - 30) + '" y1="' + o.yOsy + '" x2="' + (o.x2 + 30) + '" y2="' + o.yOsy + '"/>' +
        o.znacky.map(z => '<line x1="' + z.x + '" y1="' + (o.yOsy - 6) + '" x2="' + z.x + '" y2="' + (o.yOsy + 6) + '"/><text x="' + z.x + '" y="' + (o.yOsy + 22) + '">' + esc(z.popis) + '</text>').join('') + '</g>');
    }
    $('vrstvaHran').innerHTML = hr.join('');
    $('vrstvaStitku').innerHTML = st.join('');
    $('prazdna').hidden = mapa.uzly.length > 0;
    vykresliLegendu();
    aktualizujStav();
    if (A.minimapa) A.minimapa.kresli();
  }
  let cekaPrekresleni = false;
  function prekresliPozdeji() {
    if (cekaPrekresleni) return;
    cekaPrekresleni = true;
    requestAnimationFrame(() => { cekaPrekresleni = false; prekresli(); });
  }

  /* rychlá aktualizace při tažení: posune uzly a přepočte jen čáry a rámečky */
  function aktualizujPozice() {
    for (const el of $('vrstvaUzlu').children) {
      const u = J.najdiUzel(mapa, el.dataset.id), g = geo.get(el.dataset.id);
      if (u && g) el.setAttribute('transform', 'translate(' + (u.x - g.w / 2).toFixed(1) + ' ' + (u.y - g.h / 2).toFixed(1) + ')' + (g.k !== 1 ? ' scale(' + g.k.toFixed(3) + ')' : ''));
    }
    const vid = new Set(mapa.uzly.filter(viditelny).map(u => u.id));
    const m = { typy: mapa.typy, uzly: mapa.uzly.filter(u => vid.has(u.id)), hrany: mapa.hrany.filter(h => vid.has(h.od) && vid.has(h.do) && hranaVidet(h)) };
    geoHran = J.geometrieHran(m, geo);
    for (const el of $('vrstvaHran').children) {
      if (!el.dataset.hrana) continue;
      const g = geoHran.get(el.dataset.hrana);
      if (!g) continue;
      if (g.skryta) el.setAttribute('display', 'none'); else el.removeAttribute('display');
      el.children[0].setAttribute('d', g.d);
      el.children[1].setAttribute('d', g.d);
      el.children[2].setAttribute('d', g.sipkaKonec || '');
      el.children[3].setAttribute('d', g.sipkaZacatek || '');
    }
    for (const el of $('vrstvaStitku').children) {
      const g = geoHran.get(el.dataset.hrana);
      if (!g) continue;
      el.setAttribute('transform', 'translate(' + g.lx.toFixed(1) + ' ' + g.ly.toFixed(1) + ')');
      el.style.display = g.skryta ? 'none' : '';
    }
    for (const el of $('vrstvaSkupin').children) {
      const s = (mapa.skupiny || []).find(x => x.id === el.dataset.skupina);
      const r = s && J.obalSkupiny(mapa, geo, s, vid);
      if (!r) continue;
      for (const rr of el.querySelectorAll('rect')) { rr.setAttribute('x', r.x.toFixed(1)); rr.setAttribute('y', r.y.toFixed(1)); rr.setAttribute('width', r.w.toFixed(1)); }
      el.querySelector('.ram').setAttribute('height', r.h.toFixed(1));
      const t = el.querySelector('text'); t.setAttribute('x', (r.x + 12).toFixed(1)); t.setAttribute('y', (r.y + 17).toFixed(1));
    }
    if (A.minimapa) A.minimapa.kresli();
  }

  function mnozinaZtlumeni() {
    if (A.prezentace && A.prezentace.bezi()) { const k = A.prezentace.aktualni(); if (k && k.uzly.length) return new Set(k.uzly); }
    if (cesta) return new Set(cesta.uzly);
    if (nalezy.length && $('hledat').value.trim()) return new Set(nalezy);
    if (filtr.rezim === 'ztlumit' && A.filtrAktivni()) return new Set(mapa.uzly.filter(prosel).map(u => u.id));
    if (nastaveni.okoli && vybUzly.size) return new Set(J.okoli(mapa, [...vybUzly], nastaveni.hloubka).keys());
    return null;
  }

  function vykresliLegendu() {
    const pocty = {};
    for (const u of mapa.uzly) pocty[u.typ] = (pocty[u.typ] || 0) + 1;
    let s = mapa.typy.filter(t => pocty[t.id]).map(t =>
      '<button data-typ="' + esc(t.id) + '" class="' + (filtr.typy.has(t.id) ? 'vypnuty' : '') + '" style="--c:' + t.barva + '" title="Skrýt / zobrazit typ" aria-pressed="' + !filtr.typy.has(t.id) + '">' +
      '<span class="tecka"></span>' + esc((t.ikona ? t.ikona + ' ' : '') + t.nazev) + ' <span class="pocet-leg">' + pocty[t.id] + '</span></button>').join('');
    if (nastaveni.barvaPodle === 'komunita') s += '<span class="leg-info">barvy = komunity</span>';
    else if (nastaveni.barvaPodle && nastaveni.barvaPodle !== 'typ') s += '<span class="leg-info">barvy = ' + esc(nazevMetriky(nastaveni.barvaPodle)) + ' <span class="skala"></span></span>';
    if (nastaveni.velikostPodle) s += '<span class="leg-info">velikost = ' + esc(nazevMetriky(nastaveni.velikostPodle)) + '</span>';
    if (A.filtrAktivni()) s += '<button class="filtr-aktivni" data-zrusfiltr="1" title="Zrušit všechny filtry">⨯ filtr aktivní</button>';
    $('legenda').innerHTML = s;
  }
  function nazevMetriky(id) {
    const m = window.MapaAnalyza && (window.MapaAnalyza.METRIKY || []).find(x => x.id === id);
    return m ? m.nazev : id;
  }
  A.nazevMetriky = nazevMetriky;

  function aktualizujStav() {
    const vid = A.filtrAktivni() && filtr.rezim === 'skryt' ? mapa.uzly.filter(prosel).length : null;
    $('stavPocty').textContent = mapa.uzly.length + ' uzlů · ' + mapa.hrany.length + ' vztahů' + ((mapa.skupiny || []).length ? ' · ' + mapa.skupiny.length + ' skupin' : '') + (vid != null ? ' · zobrazeno ' + vid : '');
    const n = vybUzly.size, h = vybHrany.size;
    $('stavVyber').textContent = n || h ? 'vybráno: ' + (n ? n + ' uzl' + (n === 1 ? '' : n < 5 ? 'y' : 'ů') : '') + (n && h ? ', ' : '') + (h ? h + ' vztah' + (h === 1 ? '' : h < 5 ? 'y' : 'ů') : '') : (vybSkupina ? 'vybrána skupina' : '');
  }

  function aktualizujTlacitka() {
    $('tlZpet').disabled = !zpet.length;
    $('tlZnovu').disabled = !znovu.length;
    $('tlSmazat').disabled = !vybUzly.size && !vybHrany.size && !vybSkupina;
    $('tlSpojit').classList.toggle('aktivni', rezim === 'spojit');
  }

  /* ---------- pohled ---------- */
  function aplikujPohled() {
    $('svet').setAttribute('transform', 'translate(' + pohled.x.toFixed(2) + ' ' + pohled.y.toFixed(2) + ') scale(' + pohled.z.toFixed(4) + ')');
    $('procZoom').textContent = Math.round(pohled.z * 100) + ' %';
    const obal = $('platnoObal');
    let krok = 24 * pohled.z;
    while (krok < 14) krok *= 4;   /* při oddálení řidší tečky, ať plocha nešumí */
    obal.style.backgroundSize = krok.toFixed(2) + 'px ' + krok.toFixed(2) + 'px';
    obal.style.backgroundPosition = pohled.x.toFixed(1) + 'px ' + pohled.y.toFixed(1) + 'px';
    svg.classList.toggle('daleko', pohled.z < 0.38);   /* úroveň detailu: drobné texty pryč */
    if (mapa && mapa.uzly.length > OREZ_OD) prekresliOrez();
    if (A.minimapa) A.minimapa.kresli();
  }
  /* při ořezu po posunu/zoomu dokreslit, co přibylo do výřezu (s malým zpožděním) */
  let casovacOrezu = null;
  function prekresliOrez() { clearTimeout(casovacOrezu); casovacOrezu = setTimeout(() => { if (!tah) prekresli(); }, 90); }
  function naSvet(cx, cy) {
    const r = svg.getBoundingClientRect();
    return { x: (cx - r.left - pohled.x) / pohled.z, y: (cy - r.top - pohled.y) / pohled.z };
  }
  function zoomKolem(f, cx, cy) {
    const r = svg.getBoundingClientRect();
    if (cx == null) { cx = r.left + r.width / 2; cy = r.top + r.height / 2; }
    const nz = Math.max(0.05, Math.min(4, pohled.z * f));
    const sx = cx - r.left, sy = cy - r.top;
    pohled.x = sx - (sx - pohled.x) * nz / pohled.z;
    pohled.y = sy - (sy - pohled.y) * nz / pohled.z;
    pohled.z = nz;
    aplikujPohled(); ulozPozdeji();
  }
  function cilPohledu(ids, maxZ) {
    const r = svg.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    const vid = mapa.uzly.filter(viditelny).map(u => u.id);
    const ob = J.obal(mapa, geo, ids && ids.length ? ids : vid);
    const z = Math.max(0.05, Math.min(maxZ || 1.4, (r.width - 60) / (ob.w || 1), (r.height - 100) / (ob.h || 1)));
    return { z, x: r.width / 2 - (ob.x + ob.w / 2) * z, y: r.height / 2 - (ob.y + ob.h / 2) * z + 14 };
  }
  function prizpusobit(ids) {
    const c = cilPohledu(ids);
    if (!c) return;
    pohled = c;
    aplikujPohled();
  }
  /* plynulý přelet kamery (prezentace, skok na uzel) */
  let animacePohledu = null;
  function preletNa(cil, T) {
    if (!cil) return;
    cancelAnimationFrame(animacePohledu);
    const z0 = Object.assign({}, pohled), t0 = performance.now();
    T = T || 450;
    const krok = now => {
      const t = Math.min(1, (now - t0) / T), e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      pohled = { x: z0.x + (cil.x - z0.x) * e, y: z0.y + (cil.y - z0.y) * e, z: z0.z + (cil.z - z0.z) * e };
      aplikujPohled();
      if (t < 1) animacePohledu = requestAnimationFrame(krok);
    };
    animacePohledu = requestAnimationFrame(krok);
  }
  function vycentruj(id, plynule) {
    const u = J.najdiUzel(mapa, id);
    if (!u) return;
    const r = svg.getBoundingClientRect();
    const z = pohled.z < 0.6 ? 0.9 : pohled.z;
    const cil = { z, x: r.width / 2 - u.x * z, y: r.height / 2 - u.y * z };
    if (plynule) preletNa(cil, 350); else { pohled = cil; aplikujPohled(); }
  }

  /* ---------- akce ---------- */
  function vyber(uzly, hrany, skupina) {
    vybUzly = new Set(uzly || []); vybHrany = new Set(hrany || []); vybSkupina = skupina || null;
    prekresli(); vykresliPanely(); aktualizujTlacitka();
  }

  function volneMisto(x, y, g) {
    /* posouvá dolů, dokud nový obdélník nepřekrývá jiný uzel */
    for (let k = 0; k < 40; k++) {
      const koliduje = mapa.uzly.some(u => {
        const h = geo.get(u.id) || { w: 150, h: 40 };
        return Math.abs(u.x - x) < (h.w + g.w) / 2 + 16 && Math.abs(u.y - y) < (h.h + g.h) / 2 + 16;
      });
      if (!koliduje) break;
      y += 50;
    }
    return { x, y };
  }
  function zamerNazev() { setTimeout(() => { const i = $('dNazev'); if (i) { i.focus(); i.select(); } }, 30); }

  function novyUzel(x, y, data, skupina) {
    zaloha();
    if (x == null) {
      const r = svg.getBoundingClientRect();
      const p = naSvet(r.left + r.width / 2, r.top + r.height / 2);
      x = p.x; y = p.y;
    }
    const typ = (data && data.typ) || (vybUzly.size === 1 ? J.najdiUzel(mapa, [...vybUzly][0]).typ : undefined);
    const u = J.pridejUzel(mapa, Object.assign({ nazev: 'Nový uzel', typ }, data || {}));
    const g = J.geometrieUzlu(mapa, u, mer, {});
    const p = volneMisto(x, y, g);
    u.x = prichyt(p.x, g.w); u.y = prichyt(p.y, g.h);
    if (skupina) J.vlozDoSkupiny(mapa, skupina, u.id);
    vybUzly = new Set([u.id]); vybHrany.clear(); vybSkupina = null;
    zmena();
    prepniZalozku('detail');
    zamerNazev();
    return u;
  }

  function pridejSouvislost(idOd) {
    const Z = J.najdiUzel(mapa, idOd);
    if (!Z) return;
    zaloha();
    const gA = geo.get(Z.id) || { w: 150 };
    const u = J.pridejUzel(mapa, { nazev: 'Nový uzel', typ: Z.typ });
    const g = J.geometrieUzlu(mapa, u, mer, {});
    const p = volneMisto(Z.x + gA.w / 2 + 110 + g.w / 2, Z.y, g);
    u.x = p.x; u.y = p.y;
    const sk = J.skupinaUzlu(mapa, Z.id);
    if (sk) J.vlozDoSkupiny(mapa, sk.id, u.id);
    J.pridejHranu(mapa, Z.id, u.id, { popis: '' });
    vybUzly = new Set([u.id]); vybHrany.clear(); vybSkupina = null;
    zmena();
    zamerNazev();
  }

  function spoj(a, b) {
    if (a === b) return null;
    zaloha();
    const h = J.pridejHranu(mapa, a, b, { popis: '' });
    if (!h) { zpet.pop(); return null; }
    vybUzly.clear(); vybHrany = new Set([h.id]); vybSkupina = null;
    zmena();
    prepniZalozku('detail');
    setTimeout(() => { const i = $('hPopis'); if (i) i.focus(); }, 30);
    return h;
  }

  function smazVybrane() {
    if (!vybUzly.size && !vybHrany.size && !vybSkupina) return;
    zaloha();
    if (vybSkupina && !vybUzly.size && !vybHrany.size) {
      /* smazat jen rámeček skupiny, uzly zůstanou */
      mapa.skupiny = mapa.skupiny.filter(s => s.id !== vybSkupina);
      vybSkupina = null;
      zmena();
      return;
    }
    J.odeberHrany(mapa, [...vybHrany]);
    J.odeberUzly(mapa, [...vybUzly]);
    vybUzly.clear(); vybHrany.clear(); vybSkupina = null; cesta = null;
    zmena();
  }

  function prepniRozbaleni(id) {
    const u = J.najdiUzel(mapa, id);
    if (!u) return;
    zaloha();
    u.rozbaleny = !u.rozbaleny;
    if (u.rozbaleny) uvolniMisto([u.id]); else zmena();
  }

  /* po rozbalení: sousedy, které uzel překryl, plynule odsunout (rozbalené a zamčené stojí) */
  function uvolniMisto(stojici) {
    spocitejGeo();
    const pred = new Map(mapa.uzly.map(x => [x.id, { x: x.x, y: x.y }]));
    const pevne = new Set(stojici.concat(mapa.uzly.filter(x => x.zamceny).map(x => x.id)));
    J.odstranPrekryvy(mapa, geo, pevne, 10);
    const pohnuto = mapa.uzly.some(x => Math.abs(x.x - pred.get(x.id).x) > 0.5 || Math.abs(x.y - pred.get(x.id).y) > 0.5);
    zmena();
    if (pohnuto && !animace) animujPrechod(pred, false);
  }

  function nastavRezimSpojit(zap) {
    rezim = zap ? 'spojit' : 'normal';
    zdrojSpojeni = null;
    svg.classList.toggle('rezim-spojit', zap);
    $('rezimInfo').hidden = !zap;
    $('rezimText').textContent = 'Spojování: klikněte na první uzel';
    if (zap && vybUzly.size === 1) { zdrojSpojeni = [...vybUzly][0]; $('rezimText').textContent = 'Spojování: klikněte na cílový uzel'; }
    aktualizujTlacitka(); prekresli();
  }
  function zrusRezim() { if (rezim !== 'normal') nastavRezimSpojit(false); }

  /* mřížka pro přichytávání (levý horní roh uzlu) */
  const KROK_MRIZKY = 24;
  function prichyt(stred, rozmer) {
    if (!nastaveni.mrizka) return stred;
    return Math.round((stred - rozmer / 2) / KROK_MRIZKY) * KROK_MRIZKY + rozmer / 2;
  }

  /* Rozmístění s animací. druh: silove | casove | kruhove | mrizka | hierarchicky | hierarchickyVodorovne | strom | radialni | zabalit */
  function rozmisti(druh) {
    if (!mapa.uzly.length) return;
    zastavAnimaci();
    zaloha();
    const R = window.MapaRozlozeni;
    const zamcene = nastaveni.zamcene;
    const pevne = zamcene ? new Set(mapa.uzly.filter(u => u.zamceny).map(u => u.id)) : new Set();
    const puvodni = new Map(mapa.uzly.map(u => [u.id, { x: u.x, y: u.y }]));
    if (!zamcene) for (const u of mapa.uzly) u._z = u.zamceny, u.zamceny = false;
    const vratZamky = () => { if (!zamcene) for (const u of mapa.uzly) { u.zamceny = u._z; delete u._z; } };
    osaCasu = null;
    if (druh === 'silove') {
      const velka = mapa.uzly.length > 120 && R && R.silovaBH;
      const sim = velka ? R.silovaBH(mapa, geo, { pevne, seed: (Date.now() & 0xffff) || 1, teplota: 1 })
        : J.silovaSimulace(mapa, geo, { pevne, seed: (Date.now() & 0xffff) || 1, teplota: 1 });
      let n = 0;
      const kroku = mapa.uzly.length > 600 ? 2 : 6;
      const krok = () => {
        sim.krok(kroku); n++;
        aktualizujPozice();
        if (n < 70) animace = requestAnimationFrame(krok);
        else {
          const pred = new Map(mapa.uzly.map(u => [u.id, { x: u.x, y: u.y }]));
          for (let kolo = 0; kolo < 6 && J.odstranPrekryvy(mapa, geo, pevne); kolo++) { /* dorovnat */ }
          if (R && R.zabalKomponenty) R.zabalKomponenty(mapa, geo, {});
          vratZamky();
          animujPrechod(pred);
        }
      };
      animace = requestAnimationFrame(krok);
      return;
    }
    let ok = true, chyba = '';
    const vybrany = vybUzly.size ? [...vybUzly][0] : (J.statistika(mapa).nejpropojenejsi[0] || {}).id;
    try {
      if (druh === 'casove') { ok = J.rozmistiCasove(mapa, geo); if (ok) osaCasu = ok; else chyba = 'Žádný uzel nemá vyplněné datum – časovou osu nelze sestavit.'; }
      else if (druh === 'kruhove') { if (!vybrany) ok = false; else J.rozmistiKruhove(mapa, geo, vybrany); }
      else if (druh === 'mrizka') J.rozmistiMrizku(mapa, geo);
      else if (druh === 'hierarchicky' || druh === 'hierarchickyVodorovne') R.hierarchicky(mapa, geo, { smer: druh === 'hierarchicky' ? 'dolu' : 'doprava', pevne });
      else if (druh === 'strom') { if (!vybrany) ok = false; else R.strom(mapa, geo, vybrany, { smer: 'dolu' }); }
      else if (druh === 'radialni') { if (!vybrany) ok = false; else R.radialniStrom(mapa, geo, vybrany); }
      else if (druh === 'zabalit') R.zabalKomponenty(mapa, geo, {});
    } catch (e) { console.error(e); ok = false; chyba = 'Rozmístění selhalo: ' + e.message; }
    vratZamky();
    if (!ok) {
      for (const u of mapa.uzly) { const p = puvodni.get(u.id); u.x = p.x; u.y = p.y; }
      zpet.pop(); aktualizujTlacitka();
      Dialog.chyba(chyba || 'Vyberte uzel, od kterého se má mapa rozmístit.');
      return;
    }
    if (zamcene) for (const u of mapa.uzly) if (pevne.has(u.id)) { u.x = puvodni.get(u.id).x; u.y = puvodni.get(u.id).y; }
    animujPrechod(puvodni);
  }
  function animujPrechod(puvodni, prizpusobitPo) {
    const cil = new Map(mapa.uzly.map(u => [u.id, { x: u.x, y: u.y }]));
    const t0 = performance.now(), T = 450;
    const krok = now => {
      const t = Math.min(1, (now - t0) / T), e = 1 - Math.pow(1 - t, 3);
      for (const u of mapa.uzly) {
        const a = puvodni.get(u.id), b = cil.get(u.id);
        if (a && isFinite(a.x)) { u.x = a.x + (b.x - a.x) * e; u.y = a.y + (b.y - a.y) * e; }
      }
      aktualizujPozice();
      if (t < 1) animace = requestAnimationFrame(krok);
      else { animace = null; zmena(); if (prizpusobitPo !== false) prizpusobit(); }
    };
    animace = requestAnimationFrame(krok);
  }
  function zastavAnimaci() { if (animace) { cancelAnimationFrame(animace); animace = null; } }

  /* zarovnání a rozprostření vybraných (modul rozlozeni.js) */
  function zarovnej(jak) {
    const R = window.MapaRozlozeni;
    if (!R || vybUzly.size < 2) return;
    zaloha();
    const pred = new Map(mapa.uzly.map(u => [u.id, { x: u.x, y: u.y }]));
    if (jak === 'x' || jak === 'y') R.rozprostri(mapa, geo, [...vybUzly], jak);
    else if (jak === 'mrizka') R.prichytUzly(mapa, geo, [...vybUzly], KROK_MRIZKY);
    else R.zarovnej(mapa, geo, [...vybUzly], jak);
    animujPrechod(pred, false);
  }

  /* skupiny */
  function seskupit(ids, nazev) {
    if (!ids.length) return null;
    zaloha();
    const sk = J.pridejSkupinu(mapa, nazev || 'Skupina ' + ((mapa.skupiny || []).length + 1), ids);
    vybUzly.clear(); vybHrany.clear(); vybSkupina = sk.id;
    uvolniMistoSkupinam();
    zmena();
    return sk;
  }
  /* uzly cizí skupiny nesmí ležet v rámečku jiné – lehké odsunutí ven */
  function uvolniMistoSkupinam() {
    spocitejGeo();
    for (let it = 0; it < 8; it++) {
      let pohnuto = false;
      for (const s of mapa.skupiny || []) {
        const r = J.obalSkupiny(mapa, geo, s);
        if (!r) continue;
        const clen = new Set(s.uzly);
        for (const u of mapa.uzly) {
          if (clen.has(u.id) || u.zamceny) continue;
          const g = geo.get(u.id);
          if (u.x + g.w / 2 < r.x || u.x - g.w / 2 > r.x + r.w || u.y + g.h / 2 < r.y || u.y - g.h / 2 > r.y + r.h) continue;
          /* nejkratší cesta ven */
          const moz = [[r.x - g.w / 2 - 14 - u.x, 0], [r.x + r.w + g.w / 2 + 14 - u.x, 0], [0, r.y - g.h / 2 - 14 - u.y], [0, r.y + r.h + g.h / 2 + 14 - u.y]];
          moz.sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]));
          u.x += moz[0][0]; u.y += moz[0][1];
          pohnuto = true;
        }
      }
      if (!pohnuto) break;
    }
  }

  /* ---------- ovládání myší / dotykem ---------- */
  const ukazatele = new Map();
  let tah = null;   /* {druh:'uzly'|'posun'|'ramecek'|'spoj'|'pinch'|'skupina', …} */

  /* rámečky skupin, do kterých lze uzly přetáhnout (bez tažených uzlů) */
  function ramyProPusteni(tazene) {
    const t = new Set(tazene);
    return (mapa.skupiny || []).map(s => {
      const zbytek = Object.assign({}, s, { uzly: s.uzly.filter(i => !t.has(i)) });
      return { s, r: J.obalSkupiny(mapa, geo, zbytek) };
    }).filter(x => x.r);
  }

  svg.addEventListener('pointerdown', e => {
    if (e.button !== 0 && e.pointerType === 'mouse') { if (e.button === 1) zacniPosun(e); return; }
    zastavAnimaci();
    ukazatele.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { svg.setPointerCapture(e.pointerId); } catch (err) { /* syntetické události */ }
    if (ukazatele.size === 2) {
      const [a, b] = [...ukazatele.values()];
      tah = { druh: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y), z0: pohled.z, px: pohled.x, py: pohled.y, sx: (a.x + b.x) / 2, sy: (a.y + b.y) / 2 };
      return;
    }
    const cil = e.target;
    const elUzel = cil.closest && cil.closest('.uzel');
    const elHrana = cil.closest && cil.closest('[data-hrana]');
    const elSkupina = cil.closest && cil.closest('.skupina');
    if (elUzel && cil.classList.contains('uchyt') && rezim === 'normal') {
      tah = { druh: 'spoj', od: elUzel.dataset.id };
      return;
    }
    if (elUzel) {
      const id = elUzel.dataset.id;
      if (rezim === 'spojit') { tah = { druh: 'klikSpoj', id }; return; }
      const pridat = e.shiftKey || e.ctrlKey || e.metaKey;
      const bylVybrany = vybUzly.has(id);
      if (!bylVybrany && !pridat) { vybUzly = new Set([id]); vybHrany.clear(); vybSkupina = null; prekresli(); vykresliPanely(); aktualizujTlacitka(); }
      else if (!bylVybrany && pridat) { vybUzly.add(id); prekresli(); vykresliPanely(); aktualizujTlacitka(); }
      tah = { druh: 'uzly', id, pridat, bylVybrany, sx: e.clientX, sy: e.clientY, pohnuto: false,
        start: new Map([...vybUzly].map(i => { const u = J.najdiUzel(mapa, i); return [i, { x: u.x, y: u.y }]; })) };
      return;
    }
    if (elHrana) {
      const id = elHrana.dataset.hrana;
      if (e.shiftKey || e.ctrlKey || e.metaKey) { if (vybHrany.has(id)) vybHrany.delete(id); else vybHrany.add(id); vyber([...vybUzly], [...vybHrany]); }
      else vyber([], [id]);
      prepniZalozku('detail');
      tah = null;
      return;
    }
    if (elSkupina && (cil.classList.contains('hlava') || cil.tagName === 'text' || cil.tagName === 'tspan' || cil.classList.contains('ram'))) {
      const s = (mapa.skupiny || []).find(x => x.id === elSkupina.dataset.skupina);
      if (s) {
        tah = { druh: 'skupina', id: s.id, sx: e.clientX, sy: e.clientY, pohnuto: false,
          start: new Map(s.uzly.map(i => { const u = J.najdiUzel(mapa, i); return [i, { x: u.x, y: u.y }]; })) };
        return;
      }
    }
    if (e.shiftKey) {
      const p = naSvet(e.clientX, e.clientY);
      tah = { druh: 'ramecek', p0: p, sx: e.clientX, sy: e.clientY, puvodni: new Set(vybUzly) };
      return;
    }
    zacniPosun(e);
  });

  function zacniPosun(e) {
    tah = { druh: 'posun', sx: e.clientX, sy: e.clientY, px: pohled.x, py: pohled.y, pohnuto: false };
    svg.classList.add('posun');
  }

  function posunUzly(start, dx, dy) {
    for (const [i, s] of start) {
      const u = J.najdiUzel(mapa, i);
      if (!u) continue;
      const g = geo.get(i) || { w: 0, h: 0 };
      u.x = prichyt(s.x + dx / pohled.z, g.w); u.y = prichyt(s.y + dy / pohled.z, g.h);
    }
  }

  svg.addEventListener('pointermove', e => {
    if (ukazatele.has(e.pointerId)) ukazatele.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!tah) return;
    if (tah.druh === 'pinch') {
      if (ukazatele.size < 2) return;
      const [a, b] = [...ukazatele.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const nz = Math.max(0.05, Math.min(4, tah.z0 * d / (tah.d0 || 1)));
      const r = svg.getBoundingClientRect();
      const sx = tah.sx - r.left, sy = tah.sy - r.top;
      const mx = (a.x + b.x) / 2 - tah.sx, my = (a.y + b.y) / 2 - tah.sy;
      pohled.z = nz;
      pohled.x = sx - (sx - tah.px) * nz / tah.z0 + mx;
      pohled.y = sy - (sy - tah.py) * nz / tah.z0 + my;
      aplikujPohled();
      return;
    }
    if (tah.druh === 'posun') {
      const dx = e.clientX - tah.sx, dy = e.clientY - tah.sy;
      if (Math.abs(dx) + Math.abs(dy) > 3) tah.pohnuto = true;
      pohled.x = tah.px + dx; pohled.y = tah.py + dy;
      aplikujPohled();
      return;
    }
    if (tah.druh === 'uzly' || tah.druh === 'skupina') {
      const dx = e.clientX - tah.sx, dy = e.clientY - tah.sy;
      if (!tah.pohnuto && Math.abs(dx) + Math.abs(dy) < 4) return;
      if (!tah.pohnuto) {
        tah.pohnuto = true; zaloha();
        if (tah.druh === 'uzly') tah.ramy = ramyProPusteni([...tah.start.keys()]);
      }
      posunUzly(tah.start, dx, dy);
      aktualizujPozice();
      if (tah.ramy) {
        const p = naSvet(e.clientX, e.clientY);
        const cilovy = tah.ramy.find(({ r }) => p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h);
        for (const el of $('vrstvaSkupin').children) el.classList.toggle('cil', !!cilovy && el.dataset.skupina === cilovy.s.id);
        tah.cilovaSkupina = cilovy ? cilovy.s.id : null;
      }
      return;
    }
    if (tah.druh === 'spoj') {
      const Z = J.najdiUzel(mapa, tah.od), p = naSvet(e.clientX, e.clientY);
      const g = geo.get(Z.id);
      const z = J.naOkraji(Z.x, Z.y, g, p.x - Z.x, p.y - Z.y);
      const d = $('docasna');
      d.hidden = false;
      d.setAttribute('d', 'M' + z.x.toFixed(1) + ' ' + z.y.toFixed(1) + 'L' + p.x.toFixed(1) + ' ' + p.y.toFixed(1));
      return;
    }
    if (tah.druh === 'ramecek') {
      const p = naSvet(e.clientX, e.clientY);
      const x1 = Math.min(p.x, tah.p0.x), y1 = Math.min(p.y, tah.p0.y), x2 = Math.max(p.x, tah.p0.x), y2 = Math.max(p.y, tah.p0.y);
      const r = $('ramecek'), sr = svg.getBoundingClientRect();
      r.hidden = false;
      r.setAttribute('x', Math.min(e.clientX, tah.sx) - sr.left); r.setAttribute('y', Math.min(e.clientY, tah.sy) - sr.top);
      r.setAttribute('width', Math.abs(e.clientX - tah.sx)); r.setAttribute('height', Math.abs(e.clientY - tah.sy));
      const nove = new Set(tah.puvodni);
      for (const u of mapa.uzly) {
        if (!viditelny(u)) continue;
        if (u.x >= x1 && u.x <= x2 && u.y >= y1 && u.y <= y2) nove.add(u.id);
      }
      vybUzly = nove;
      for (const el of $('vrstvaUzlu').children) el.classList.toggle('vybrany', vybUzly.has(el.dataset.id));
    }
  });

  function konecTahu(e) {
    ukazatele.delete(e.pointerId);
    if (!tah) return;
    const t = tah;
    if (t.druh === 'pinch') { if (ukazatele.size < 2) { tah = null; ulozPozdeji(); } return; }
    tah = null;
    svg.classList.remove('posun');
    for (const el of $('vrstvaSkupin').children) el.classList.remove('cil');
    if (e.type === 'pointercancel') { if ((t.druh === 'uzly' || t.druh === 'skupina') && t.pohnuto) zmena(); $('docasna').hidden = true; $('ramecek').hidden = true; return; }
    if (t.druh === 'posun') {
      if (!t.pohnuto) {
        if (rezim === 'spojit') { zdrojSpojeni = null; $('rezimText').textContent = 'Spojování: klikněte na první uzel'; prekresli(); }
        else if (vybUzly.size || vybHrany.size || cesta || vybSkupina) { cesta = null; vyber([], []); }
      } else { ulozPozdeji(); if (mapa.uzly.length > OREZ_OD) prekresli(); }
      return;
    }
    if (t.druh === 'skupina') {
      if (t.pohnuto) { uvolniMistoSkupinam(); zmena(false); return; }
      vyber([], [], t.id);
      prepniZalozku('detail');
      return;
    }
    if (t.druh === 'uzly') {
      if (t.pohnuto) {
        if (t.cilovaSkupina) {
          for (const i of t.start.keys()) J.vlozDoSkupiny(mapa, t.cilovaSkupina, i);
          const s = mapa.skupiny.find(x => x.id === t.cilovaSkupina);
          Dialog.info('Přidáno do skupiny „' + s.nazev + '“');
          uvolniMistoSkupinam();
          zmena();
        } else zmena(false);
        return;
      }
      /* klik bez tažení */
      if (t.pridat) {
        if (t.bylVybrany) { vybUzly.delete(t.id); vyber([...vybUzly], [...vybHrany]); }
        return;
      }
      vybUzly = new Set([t.id]); vybHrany.clear(); vybSkupina = null;
      prepniRozbaleni(t.id);
      prepniZalozku('detail');
      return;
    }
    if (t.druh === 'klikSpoj') {
      if (!zdrojSpojeni) { zdrojSpojeni = t.id; $('rezimText').textContent = 'Spojování: klikněte na cílový uzel'; prekresli(); }
      else if (zdrojSpojeni !== t.id) {
        const a = zdrojSpojeni;
        spoj(a, t.id);
        zdrojSpojeni = e.shiftKey ? a : null;   /* se Shiftem lze z jednoho uzlu spojovat dál */
        $('rezimText').textContent = zdrojSpojeni ? 'Spojování: další cílový uzel' : 'Spojování: klikněte na první uzel';
        prekresli();
      }
      return;
    }
    if (t.druh === 'spoj') {
      $('docasna').hidden = true;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const cil = el && el.closest && el.closest('.uzel');
      if (cil && cil.dataset.id !== t.od) spoj(t.od, cil.dataset.id);
      else if (!cil) {
        /* puštěno do prázdna – nový uzel na tom místě, rovnou propojený */
        const p = naSvet(e.clientX, e.clientY);
        const Z = J.najdiUzel(mapa, t.od);
        if (Math.hypot(p.x - Z.x, p.y - Z.y) > 60) {
          zaloha();
          const u = J.pridejUzel(mapa, { nazev: 'Nový uzel', typ: Z.typ, x: p.x, y: p.y });
          const sk = J.skupinaUzlu(mapa, Z.id);
          if (sk) J.vlozDoSkupiny(mapa, sk.id, u.id);
          J.pridejHranu(mapa, Z.id, u.id, {});
          vybUzly = new Set([u.id]); vybHrany.clear(); vybSkupina = null;
          zmena();
          zamerNazev();
        }
      }
      return;
    }
    if (t.druh === 'ramecek') { $('ramecek').hidden = true; vyber([...vybUzly], [...vybHrany]); }
  }
  svg.addEventListener('pointerup', konecTahu);
  svg.addEventListener('pointercancel', konecTahu);

  svg.addEventListener('dblclick', e => {
    const elUzel = e.target.closest && e.target.closest('.uzel');
    if (elUzel) {
      /* dvojklik = dvakrát klik (rozbalení se vrátí) a do pole názvu */
      prepniZalozku('detail');
      setTimeout(() => { const i = $('dNazev'); if (i) { i.focus(); i.select(); } }, 20);
      return;
    }
    if (e.target.closest && e.target.closest('[data-hrana]')) { setTimeout(() => { const i = $('hPopis'); if (i) i.focus(); }, 20); return; }
    const elSk = e.target.closest && e.target.closest('.skupina');
    if (elSk && e.target.classList.contains('hlava')) { vyber([], [], elSk.dataset.skupina); setTimeout(() => { const i = $('sNazev'); if (i) { i.focus(); i.select(); } }, 20); return; }
    const p = naSvet(e.clientX, e.clientY);
    /* dvojklik uvnitř rámečku skupiny → nový uzel do ní */
    const vSkupine = ramyProPusteni([]).find(({ r }) => p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h);
    novyUzel(p.x, p.y, null, vSkupine ? vSkupine.s.id : null);
  });

  svg.addEventListener('wheel', e => {
    e.preventDefault();
    const f = Math.exp(-(e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY) * 0.0015);
    zoomKolem(f, e.clientX, e.clientY);
  }, { passive: false });

  /* ---------- klávesnice ---------- */
  /* Alt+šipka: přeskočit na nejbližšího souseda v daném směru (navigace bez myši) */
  function skokNaSouseda(smer) {
    if (vybUzly.size !== 1) {
      const prvni = mapa.uzly.find(viditelny);
      if (prvni) { vyber([prvni.id], []); vycentruj(prvni.id, true); }
      return;
    }
    const id = [...vybUzly][0], u = J.najdiUzel(mapa, id);
    const sous = J.sousedstvi(mapa, false).get(id).map(n => J.najdiUzel(mapa, n.id)).filter(v => v && viditelny(v));
    const vektor = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[smer];
    let nej = null, nejSkore = Infinity;
    for (const v of sous) {
      const dx = v.x - u.x, dy = v.y - u.y, d = Math.hypot(dx, dy) || 1;
      const cos = (dx * vektor[0] + dy * vektor[1]) / d;
      if (cos < 0.3) continue;
      const skore = d * (2 - cos);
      if (skore < nejSkore) { nejSkore = skore; nej = v; }
    }
    if (nej) { vyber([nej.id], []); vycentruj(nej.id, true); }
  }

  document.addEventListener('keydown', e => {
    const ae = document.activeElement;
    const vPoli = /^(INPUT|TEXTAREA|SELECT)$/.test(ae && ae.tagName) || (ae && ae.isContentEditable);
    const ctrl = e.ctrlKey || e.metaKey;
    const k = (e.key || '').toLowerCase();
    if (A.paleta && A.paleta.otevrena()) return;
    if (ctrl && k === 'k') { e.preventDefault(); if (A.paleta) A.paleta.otevri(); return; }
    if (ctrl && k === 'f') { e.preventDefault(); $('hledat').focus(); $('hledat').select(); return; }
    if (A.prezentace && A.prezentace.bezi() && !vPoli) {
      if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); A.prezentace.dalsi(); return; }
      if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); A.prezentace.predchozi(); return; }
      if (e.key === 'Escape') { e.preventDefault(); A.prezentace.konec(); return; }
      if (k === 'f') { A.prezentace.celaObrazovka(); return; }
      return;
    }
    if (vPoli) {
      if (e.key === 'Escape') ae.blur();
      return;
    }
    if (ctrl && (k === 'z' || (!k && e.code === 'KeyZ'))) { e.preventDefault(); if (e.shiftKey) krokZnovu(); else krokZpet(); return; }
    if (ctrl && k === 'y') { e.preventDefault(); krokZnovu(); return; }
    if (ctrl && k === 'a') { e.preventDefault(); vyber(mapa.uzly.filter(viditelny).map(u => u.id), []); return; }
    if (ctrl && k === 'c') { kopiruj(); return; }
    if (ctrl && k === 'v') { vloz(); return; }
    if (ctrl && k === 'd') { e.preventDefault(); kopiruj(); vloz(); return; }
    if (ctrl && k === 'g') { e.preventDefault(); if (vybUzly.size) seskupit([...vybUzly]); return; }
    if (ctrl && k === 's') { e.preventDefault(); ulozHned(); Dialog.info('Uloženo v prohlížeči'); return; }
    if (e.altKey && e.key.startsWith('Arrow')) { e.preventDefault(); skokNaSouseda(e.key); return; }
    if (ctrl || e.altKey) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); smazVybrane(); return; }
    if (e.key === 'Escape') { zrusRezim(); cesta = null; if ($('hledat').value) { $('hledat').value = ''; hledej(); } vyber([], []); return; }
    if (k === 'n') { e.preventDefault(); novyUzel(); return; }
    if (k === 'f') { prizpusobit(vybUzly.size ? [...vybUzly] : null); return; }
    if (k === 'l') { nastavRezimSpojit(rezim !== 'spojit'); return; }
    if (k === 'm') { nastaveni.minimapa = !nastaveni.minimapa; ulozNastaveni(); if (A.minimapa) A.minimapa.kresli(); vykresliPanely(); return; }
    if (k === 'g') { nastaveni.mrizka = !nastaveni.mrizka; ulozNastaveni(); Dialog.info(nastaveni.mrizka ? 'Přichytávání k mřížce zapnuto' : 'Přichytávání vypnuto'); return; }
    if (k === 'e' && vybUzly.size) {
      zaloha();
      const roz = ![...vybUzly].every(i => J.najdiUzel(mapa, i).rozbaleny);
      for (const i of vybUzly) J.najdiUzel(mapa, i).rozbaleny = roz;
      if (roz) uvolniMisto([...vybUzly]); else zmena();
      return;
    }
    if (e.key === 'Enter' && vybUzly.size === 1) { e.preventDefault(); const i = $('dNazev'); if (i) { i.focus(); i.select(); } return; }
    if (e.key === 'Tab' && vybUzly.size === 1) { e.preventDefault(); pridejSouvislost([...vybUzly][0]); return; }
    if (e.key === '+' || e.key === '=') { zoomKolem(1.2); return; }
    if (e.key === '-') { zoomKolem(1 / 1.2); return; }
    if (e.key === '?') { if (A.paleta) A.paleta.otevri('?'); return; }
    if (e.key.startsWith('Arrow') && vybUzly.size) {
      e.preventDefault();
      const d = e.shiftKey ? 40 : (nastaveni.mrizka ? KROK_MRIZKY : 8);
      zaloha();
      for (const i of vybUzly) {
        const u = J.najdiUzel(mapa, i);
        if (u.zamceny) continue;
        if (e.key === 'ArrowLeft') u.x -= d; if (e.key === 'ArrowRight') u.x += d;
        if (e.key === 'ArrowUp') u.y -= d; if (e.key === 'ArrowDown') u.y += d;
      }
      zmena(false);
    }
  });

  function kopiruj() {
    if (!vybUzly.size) return;
    const ids = new Set(vybUzly);
    schranka = { uzly: mapa.uzly.filter(u => ids.has(u.id)).map(u => JSON.parse(JSON.stringify(u))),
      hrany: mapa.hrany.filter(h => ids.has(h.od) && ids.has(h.do)).map(h => Object.assign({}, h)) };
    try { navigator.clipboard && navigator.clipboard.writeText(J.naText({ nazev: 'výběr', typy: mapa.typy, typyVztahu: mapa.typyVztahu, uzly: schranka.uzly, hrany: schranka.hrany, skupiny: [] })); } catch (e) { /* nic */ }
    Dialog.info('Zkopírováno: ' + schranka.uzly.length + ' uzl' + (schranka.uzly.length === 1 ? '' : 'ů'));
  }
  function vloz() {
    if (!schranka) return;
    zaloha();
    const mapovani = new Map();
    const nove = [];
    for (const u of schranka.uzly) {
      const n = J.pridejUzel(mapa, Object.assign({}, u, { id: null, x: u.x + 40, y: u.y + 40 }));
      mapovani.set(u.id, n.id); nove.push(n.id);
    }
    for (const h of schranka.hrany) J.pridejHranu(mapa, mapovani.get(h.od), mapovani.get(h.do), Object.assign({}, h, { id: null }));
    for (const u of schranka.uzly) { u.x += 40; u.y += 40; }
    vybUzly = new Set(nove); vybHrany.clear(); vybSkupina = null;
    zmena();
  }

  /* ---------- hledání ---------- */
  function hledej() {
    const q = $('hledat').value;
    nalezy = J.hledej(mapa, q).filter(id => viditelny(J.najdiUzel(mapa, id)));
    indexNalezu = -1;
    $('pocetNalezu').textContent = q.trim() ? (nalezy.length ? nalezy.length + '×' : '0') : '';
    prekresli();
  }
  $('hledat').addEventListener('input', hledej);
  $('hledat').addEventListener('keydown', e => {
    if (e.key === 'Enter' && nalezy.length) {
      e.preventDefault();
      indexNalezu = (indexNalezu + (e.shiftKey ? -1 : 1) + nalezy.length) % nalezy.length;
      const id = nalezy[indexNalezu];
      vybUzly = new Set([id]); vybHrany.clear(); vybSkupina = null;
      vycentruj(id, true); prekresli(); vykresliPanely(); aktualizujTlacitka();
      $('pocetNalezu').textContent = (indexNalezu + 1) + '/' + nalezy.length;
    }
    if (e.key === 'Escape') { $('hledat').value = ''; hledej(); $('hledat').blur(); }
  });

  /* ---------- panely (vlastní kód v ui_panely.js) ---------- */
  function prepniZalozku(z) {
    if (A.panely) A.panely.prepni(z);
  }
  function vykresliPanely() { if (A.panely && mapa) A.panely.vykresli(); }

  /* ---------- lišta ---------- */
  function zavriMenu() { for (const d of document.querySelectorAll('details.menu[open]')) d.open = false; }
  document.addEventListener('click', e => { for (const d of document.querySelectorAll('details.menu[open]')) if (!d.contains(e.target)) d.open = false; });
  /* jen jedno menu otevřené */
  for (const d of document.querySelectorAll('details.menu')) d.addEventListener('toggle', () => { if (d.open) for (const o of document.querySelectorAll('details.menu[open]')) if (o !== d) o.open = false; });

  $('seznamSablon').innerHTML = S.SABLONY.map(s => '<button data-sablona="' + s.id + '">✨ ' + esc(s.nazev) + '</button>').join('');
  $('menuMapa').addEventListener('click', async e => {
    const b = e.target.closest('button');
    if (!b) return;
    zavriMenu();
    if (b.dataset.sablona) { vlozNovouMapu(mapaZeSablony(b.dataset.sablona)); return; }
    const a = b.dataset.akce;
    if (a === 'nova') {
      const n = await Dialog.zeptej('Název nové mapy', 'Nová mapa');
      if (n == null) return;
      vlozNovouMapu(J.novaMapa(n.trim() || 'Nová mapa'));
    } else if (a === 'prejmenovat') {
      const n = await Dialog.zeptej('Nový název mapy', mapa.nazev);
      if (n == null || !n.trim()) return;
      zaloha(); mapa.nazev = n.trim(); zmena(); ulozHned(); aktualizujVyberMap();
    } else if (a === 'duplikovat') {
      const m = JSON.parse(J.naJSON(mapa)); m.nazev = mapa.nazev + ' (kopie)';
      vlozNovouMapu(J.nactiData(m).mapa);
    } else if (a === 'smazatMapu') {
      if (!await Dialog.potvrd('Smazat mapu „' + mapa.nazev + '“ včetně uložených verzí? Tuto akci nelze vrátit – případně si ji nejdřív exportujte.')) return;
      smazMapu(idMapy);
    } else if (a === 'verze') {
      prepniZalozku('prehled');
      setTimeout(() => { const el = $('pVerze'); if (el) el.scrollIntoView({ block: 'start' }); }, 30);
    }
  });
  $('vyberMapy').onchange = e => otevriMapu(e.target.value);
  $('tlPridat').onclick = () => novyUzel();
  $('tlSpojit').onclick = () => nastavRezimSpojit(rezim !== 'spojit');
  $('rezimKonec').onclick = () => nastavRezimSpojit(false);
  $('tlSmazat').onclick = smazVybrane;
  $('tlZpet').onclick = krokZpet;
  $('tlZnovu').onclick = krokZnovu;
  $('tlPriblizit').onclick = () => zoomKolem(1.25);
  $('tlOddalit').onclick = () => zoomKolem(0.8);
  $('tlPrizpusobit').onclick = () => prizpusobit();
  $('prazdnaPridat').onclick = () => novyUzel(0, 0);
  $('prazdnaSablona').onclick = () => vlozNovouMapu(mapaZeSablony('pocitace'));
  $('menuRozmisteni').addEventListener('click', e => { const b = e.target.closest('button[data-rozm]'); if (b) { zavriMenu(); rozmisti(b.dataset.rozm); } });
  $('chZamcene').checked = nastaveni.zamcene;
  $('chZamcene').onchange = e => { nastaveni.zamcene = e.target.checked; ulozNastaveni(); };
  $('menuZobrazeni').addEventListener('click', e => {
    const b = e.target.closest('button[data-zobr]');
    if (!b) return;
    zavriMenu(); zaloha();
    for (const u of mapa.uzly) u.rozbaleny = b.dataset.zobr === 'rozbalit';
    if (b.dataset.zobr === 'rozbalit') uvolniMisto([]); else zmena();
  });
  const prepinace = { chOkoli: 'okoli', chStitky: 'stitky', chMinimapa: 'minimapa', chMrizka: 'mrizka' };
  for (const [id, klic] of Object.entries(prepinace)) {
    $(id).checked = !!nastaveni[klic];
    $(id).addEventListener('change', e => { nastaveni[klic] = e.target.checked; ulozNastaveni(); prekresli(); });
  }
  $('hloubkaOkoli').value = String(nastaveni.hloubka);
  $('hloubkaOkoli').addEventListener('change', e => { nastaveni.hloubka = +e.target.value; ulozNastaveni(); prekresli(); });
  $('legenda').addEventListener('click', e => {
    if (e.target.closest('[data-zrusfiltr]')) { A.zrusFiltry(); return; }
    const b = e.target.closest('button[data-typ]');
    if (!b) return;
    const t = b.dataset.typ;
    if (filtr.typy.has(t)) filtr.typy.delete(t); else filtr.typy.add(t);
    for (const id of [...vybUzly]) if (!viditelny(J.najdiUzel(mapa, id))) vybUzly.delete(id);
    prekresli(); vykresliPanely();
  });
  window.addEventListener('resize', () => aplikujPohled());
  window.addEventListener('beforeunload', ulozHned);
  document.addEventListener('visibilitychange', () => { if (document.hidden) ulozHned(); });

  /* ---------- sdílené rozhraní pro ostatní části a testy ---------- */
  Object.assign(A, {
    nactiUlozene, ulozPozdeji, ulozHned, otevriMapu, vlozNovouMapu, mapaZeSablony, aktualizujVyberMap, smazMapu,
    zaloha, krokZpet, krokZnovu, nahradMapu, zmena, prekresli, prekresliPozdeji, aktualizujPozice, aktualizujTlacitka, spocitejGeo, doplnPozice,
    aplikujPohled, naSvet, zoomKolem, cilPohledu, prizpusobit, preletNa, vycentruj,
    vyber, novyUzel, pridejSouvislost, spoj, smazVybrane, prepniRozbaleni, uvolniMisto, nastavRezimSpojit, zrusRezim,
    rozmisti, animujPrechod, zarovnej, seskupit, uvolniMistoSkupinam, kopiruj, vloz, hledej, prepniZalozku, vykresliPanely, zavriMenu,
    skokNaSouseda, vyrez, KROK_MRIZKY
  });
  Object.defineProperties(A, {
    mapa: { get: () => mapa },
    idMapy: { get: () => idMapy },
    ulozene: { get: () => ulozene },
    pohled: { get: () => pohled, set: v => { pohled = v; aplikujPohled(); } },
    vybUzly: { get: () => vybUzly },
    vybHrany: { get: () => vybHrany },
    vybSkupina: { get: () => vybSkupina },
    vybrane: { get: () => ({ uzly: [...vybUzly], hrany: [...vybHrany], skupina: vybSkupina }) },
    geo: { get: () => geo },
    stupne: { get: () => stupne },
    cesta: { get: () => cesta, set: v => { cesta = v; } },
    osaCasu: { get: () => osaCasu, set: v => { osaCasu = v; } },
    revize: { get: () => revize },
    zpet: { get: () => zpet.length },
    rezim: { get: () => rezim },
    vykreslene: { get: () => vykresleneUzly }
  });

  A.start = function () {
    nactiUlozene();
    const sdilena = /^#m=/.test(location.hash);
    if (!ulozene.mapy.length && !sdilena) vlozNovouMapu(mapaZeSablony('pocitace'), false);
    if (!ulozene.mapy.length) vlozNovouMapu(J.novaMapa('Nová mapa'), false);
    otevriMapu(ulozene.mapy.some(m => m.id === ulozene.aktivni) ? ulozene.aktivni : ulozene.mapy[0].id);
    aktualizujTlacitka();
    window.MAPA_SOUVISLOSTI = A;
    /* odkaz ke sdílení (#m=…) – dekóduje se asynchronně a otevře jako nová mapa */
    if (sdilena && A.nastroje && A.nastroje.zpracujOdkaz) A.nastroje.zpracujOdkaz();
  };
})();

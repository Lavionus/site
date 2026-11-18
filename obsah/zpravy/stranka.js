/* Mozaika zpráv – rozhraní. Logika bez DOM je v jadro.js (ZPRAVY_JADRO). */
(function () {
  'use strict';
  const J = window.ZPRAVY_JADRO;
  const $ = s => document.querySelector(s);
  const el = (tag, tridy, text) => { const e = document.createElement(tag); if (tridy) e.className = tridy; if (text != null) e.textContent = text; return e; };
  const ted = () => Math.floor(Date.now() / 1000);

  // Data stahuje GitHub Action (.github/workflows/zpravy.yml) do větve zpravy-data.
  // zpravy-nove.json = posledních 6 h (při každé obnově), zpravy-starsi.json = 6–48 h (až když je potřeba), zpravy.json = vše
  const DATA_ZAKLAD = 'https://raw.githubusercontent.com/Lavionus/site/zpravy-data/zpravy';
  const VEREJNA_ADRESA = 'https://lavionus.github.io/site/obsah/zpravy.html';   // pro QR z lokálního serveru
  const MISTNI = /^(localhost|127\.|\[::1\])/.test(location.hostname);
  const DAVKA = 120;                 // témat na jedno vykreslení (další po „Zobrazit další“ / při posunu)

  const K = {
    nastaveni: 'webapp_zpravy_nastaveni', precteno: 'webapp_zpravy_precteno', skryte: 'webapp_zpravy_skryte',
    ulozene: 'webapp_zpravy_ulozene', navsteva: 'webapp_zpravy_navsteva', oznameno: 'webapp_zpravy_oznameno',
    cteni: 'webapp_zpravy_cteni',    // deník čtení pro „zrcadlo“: [čas, web, rubrika, režim]
  };
  const VYCHOZI = {
    zdroje: null,                    // null = výchozí výběr z katalogu
    rezim: 'zpravy',                 // 'zpravy' | 'pohoda' (Zajímavosti – bez politiky, třeba před spaním)
    skryteRubriky: [],               // skryté rubriky v režimu Zprávy
    skryteRubrikyPohoda: ['cesko', 'svet', 'ekonomika', 'sport', 'bulvar', 'kraj'],
    mujKraj: null,                   // id kraje z katalogu – regionální zprávy jen odtud (null = žádné)
    bezClickbaitu: false,            // skrývat lákavé titulky („Neuvěříte…“, VELKÁ PÍSMENA)
    ranniSouhrn: true,               // ráno při prvním otevření souhrn noci
    dostLimit: true, dostZprav: 15,  // večer po N přečtených zprávách navrhnout konec
    pohodaBezPolitiky: true,         // v Zajímavostech skrýt i politiku a válku z ostatních rubrik (slova z katalogu)
    pohodaBezNegativnich: true,      // …a neštěstí, nehody, krimi (negativni_slova) – „dobré zprávy“
    pohodaTlumene: true,             // …a tlumené, teplé barvy
    autoPohoda: true, autoOd: '21:00', autoDo: '06:00',   // večer samo přepnout na Zajímavosti, ráno zpět
    rubrikyZdroju: {},               // id webu → povolené rubriky (chybí = všechny), např. Blesk jen bulvár
    upozorneni: false,               // oznámení prohlížeče na nové zprávy se zvýrazněnými slovy
    jazyky: ['cs', 'sk', 'en'],
    ztlumit: [], zvyraznit: [], vlastni: [], proxy: '',
    zobrazeni: 'mozaika', husta: false, obrazky: true, seskupit: true, temata: true, jenNeprectene: false,
    obnova: 10,
  };

  // ---------- úložiště ----------
  function nacti(klic, vychozi) {
    try { const v = JSON.parse(localStorage.getItem(klic)); return v == null ? vychozi : v; } catch (e) { return vychozi; }
  }
  function uloz(klic, hodnota) {
    try { localStorage.setItem(klic, JSON.stringify(hodnota)); } catch (e) { console.warn('Nelze uložit', klic, e); }
  }
  // hluboká kopie: N.vlastni.push() apod. nesmí měnit VYCHOZI (jinak „Obnovit výchozí“ nesmaže vlastní kanály)
  const N = Object.assign(JSON.parse(JSON.stringify(VYCHOZI)), nacti(K.nastaveni, {}));
  const ulozNastaveni = () => uloz(K.nastaveni, N);

  // přečtené a skryté: id → čas (drží se 8 dní, data samotná mají 48 h)
  const mapaSCasem = klic => new Map(Object.entries(nacti(klic, {})));
  const precteno = mapaSCasem(K.precteno);
  const skryte = mapaSCasem(K.skryte);
  function ulozMapu(klic, mapa) {
    const hranice = ted() - 8 * 86400;
    for (const [k, v] of mapa) if (v < hranice) mapa.delete(k);
    uloz(klic, Object.fromEntries(mapa));
  }
  let ulozene = nacti(K.ulozene, []);
  const oznameno = mapaSCasem(K.oznameno);     // id zpráv se zvýrazněným slovem, na které už jsme upozornili

  // IndexedDB: poslední data pro offline (≈ 1 MB se do localStorage nehodí)
  const DB = {
    otevri() {
      return this._db || (this._db = new Promise((ok, chyba) => {
        const r = indexedDB.open('webapp_zpravy', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('data');
        r.onsuccess = () => ok(r.result);
        r.onerror = () => chyba(r.error);
      }));
    },
    async cti(klic) {
      try {
        const db = await this.otevri();
        return await new Promise((ok, chyba) => { const r = db.transaction('data').objectStore('data').get(klic); r.onsuccess = () => ok(r.result); r.onerror = () => chyba(r.error); });
      } catch (e) { return null; }
    },
    async pis(klic, hodnota) {
      try {
        const db = await this.otevri();
        db.transaction('data', 'readwrite').objectStore('data').put(hodnota, klic);
      } catch (e) { /* offline cache je jen bonus */ }
    },
  };

  // ---------- stav ----------
  let katalog = null;                // zdroje.json
  let ZDROJE = new Map();            // id → zdroj (katalog + vlastní)
  let RUBRIKY = new Map();
  let data = null;                   // { vygenerovano, zdroje, polozky }
  let vlastniPolozky = [], vlastniStav = {};
  let filtrZdroje = null;            // dočasně jen jeden web (⋯ v náhledu → „Jen zprávy z …“)
  let filtrTema = null;              // dočasně jen sledované téma (slovo ze zvýrazněných; 🗂️ Rubriky → Sledovaná témata)
  let rezimUlozene = false;
  let zobrazenaTemata = [], vykreslenoDo = 0, oddilAktualni = null, mrizkaAktualni = null;
  let cekajiciData = null;           // nová data čekající na kliknutí na banner
  const navsteva = nacti(K.navsteva, { minula: 0, posledni: 0 });
  if (ted() - navsteva.posledni > 30 * 60) navsteva.minula = navsteva.posledni;   // nová návštěva po 30 min klidu
  const oznacNavstevu = () => { navsteva.posledni = ted(); uloz(K.navsteva, navsteva); };

  function vybraneZdroje() {
    if (N.zdroje) return new Set([...N.zdroje, ...N.vlastni.map(v => v.id)]);
    return new Set([...katalog.zdroje.filter(z => z.vychozi).map(z => z.id), ...N.vlastni.map(v => v.id)]);
  }

  // ---------- pomocníci zobrazení ----------
  function zkratkaZdroje(nazev) {
    const zaklad = nazev.replace(/\.(cz|sk|com|eu)$/i, '').replace(/^The /, '').replace(/[–-].*$/, '').trim();
    const slova = zaklad.split(/[\s.]+/).filter(Boolean);
    if (slova.length >= 2) return (slova[0][0] + slova[1][0]).toUpperCase();
    return zaklad.slice(0, 2);
  }
  function barvaZHashe(s) { return 'hsl(' + (J.hash(s) % 360) + ' 55% 38%)'; }
  function znak(zdroj) {
    const z = el('span', 'znak', zkratkaZdroje(zdroj.nazev));
    z.style.setProperty('--zb', zdroj.barva || barvaZHashe(zdroj.id));
    z.setAttribute('aria-hidden', 'true');
    return z;
  }
  const zdrojPol = p => ZDROJE.get(p.z) || { id: p.z, nazev: p.z };
  const barvaRubriky = r => (RUBRIKY.get(r) || {}).barva || 'var(--accent)';

  // ---------- načtení dat ----------
  async function nactiKatalog() {
    const r = await fetch('zpravy/zdroje.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    katalog = await r.json();
    RUBRIKY = new Map(katalog.rubriky.map(r => [r.id, r]));
    sestavZdroje();
  }
  function sestavZdroje() {
    ZDROJE = new Map(katalog.zdroje.map(z => [z.id, z]));
    for (const v of N.vlastni) ZDROJE.set(v.id, { id: v.id, nazev: v.nazev, web: v.url, jazyk: 'cs', vlastni: true, barva: barvaZHashe(v.id) });
  }

  // Přehled po částech: `nove` (posledních 6 h, stahuje se při každé obnově) a `starsi` (6–48 h, až když je
  // potřeba – posun na konec, hledání, „co jste zmeškali“). `data` = obojí složené dohromady.
  let nove = null, starsi = null, nacitamStarsi = null;
  function adresyDat(cast, t) {
    const u = DATA_ZAKLAD + cast + '.json?t=' + t;
    return MISTNI ? ['zpravy/data' + cast + '.json?t=' + t, u] : [u];
  }
  async function stahniJson(adresy, vynutit) {
    let chyba;
    for (const u of adresy) {
      try {
        const r = await fetch(u, { cache: vynutit ? 'reload' : 'no-cache' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const d = await r.json();
        if (!Array.isArray(d.polozky)) throw new Error('neplatná data');
        return d;
      } catch (e) { chyba = e; }
    }
    throw chyba;
  }
  /** vynutit = ruční ⟳: obejít cache prohlížeče i CDN (jinak nejvýš po 2 min). */
  async function stahniData(vynutit) {
    const t = vynutit ? Date.now() : Math.floor(Date.now() / 120000);
    let d;
    try {
      try { d = await stahniJson(adresyDat('-nove', t), vynutit); }
      catch (e) { d = await stahniJson(adresyDat('', t), vynutit); }   // data z doby před rozdělením: celý přehled
    } catch (e) {
      const ulozena = await DB.cti('nove');
      if (ulozena) return { d: ulozena, offline: true, chyba: e };
      throw e;
    }
    DB.pis('nove', d);
    return { d, offline: false };
  }
  /** Má složený přehled i starší část, která navazuje (mezera do 30 min)? */
  const maStarsi = () => !nove || !nove.cast || (starsi && nove.od - starsi.do < 1800);
  function nactiStarsi() {
    if (maStarsi()) return Promise.resolve();
    if (nacitamStarsi) return nacitamStarsi;
    nacitamStarsi = (async () => {
      $('#tl-starsi').disabled = true;
      $('#tl-starsi').textContent = 'Načítám starší zprávy…';
      try {
        starsi = await stahniJson(adresyDat('-starsi', Date.now()), true);
        DB.pis('starsi', starsi);
      } catch (e) {
        if (!starsi) starsi = await DB.cti('starsi');
        Dialog.info('Starší zprávy se nepodařilo načíst: ' + e.message);
      }
      slozData();
      vykresliBezSkoku();
    })().finally(() => { nacitamStarsi = null; $('#tl-starsi').disabled = false; $('#tl-starsi').textContent = 'Načíst starší zprávy (6–48 h)'; });
    return nacitamStarsi;
  }
  function slozData() {
    if (!nove) return;
    const ids = new Set(nove.polozky.map(p => p.i));
    const zbytek = nove.cast && starsi ? starsi.polozky.filter(p => !ids.has(p.i)) : [];
    data = Object.assign({}, nove, { polozky: nove.polozky.concat(zbytek) });
  }

  async function stahniVlastni() {
    if (!N.vlastni.length) { vlastniPolozky = []; return; }
    const vysledky = await Promise.all(N.vlastni.map(v => nactiKanal(v).then(
      pol => { vlastniStav[v.id] = { ok: true, pocet: pol.length }; return pol; },
      e => { vlastniStav[v.id] = { ok: false, chyba: e.message }; return null; })));
    const stare = await DB.cti('vlastni') || {};
    vlastniPolozky = [];
    N.vlastni.forEach((v, i) => {
      const pol = vysledky[i] || stare[v.id] || [];
      if (vysledky[i]) stare[v.id] = pol;
      vlastniPolozky.push(...pol);
    });
    DB.pis('vlastni', stare);
  }

  async function nactiKanal(v) {
    let text;
    try {
      const r = await fetch(v.url, { cache: 'no-cache' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      text = await r.text();
    } catch (e) {
      if (!N.proxy) throw new Error('Web nepovoluje čtení z cizí stránky (CORS) – nastavte proxy.');
      const r = await fetch(J.prezProxy(N.proxy, v.url), { cache: 'no-cache' });
      if (!r.ok) throw new Error('Proxy: HTTP ' + r.status);
      text = await r.text();
    }
    return J.rozeberKanal(text, v.id, v.rubrika || 'cesko').slice(0, 60);
  }

  /**
   * Živé načtení: kanály vybraných webů, které čtení z prohlížeče dovolují (seznam `cors` zapisuje
   * stahovací skript), přímo; ostatní přes proxy z nastavení, je-li zadaná. Rubriky stejně jako skript.
   */
  let zivePolozky = [], posledniZive = 0, ziveKanalu = 0;
  async function stahniZive() {
    const cors = new Set((data && data.cors) || []);
    const vybrane = vybraneZdroje();
    const ukoly = [];
    for (const z of katalog.zdroje) {
      if (!vybrane.has(z.id)) continue;
      for (const k of z.kanaly) {
        if (cors.has(k.url)) ukoly.push({ z, k, url: k.url });
        else if (N.proxy) ukoly.push({ z, k, url: J.prezProxy(N.proxy, k.url) });
      }
    }
    const vysledek = [];
    let dalsi = 0, ok = 0;
    async function pracovnik() {
      while (dalsi < ukoly.length) {
        const u = ukoly[dalsi++];
        const ctl = new AbortController();
        const limit = setTimeout(() => ctl.abort(), 12000);
        try {
          const r = await fetch(u.url, { cache: 'no-store', signal: ctl.signal });
          if (!r.ok) throw new Error('HTTP ' + r.status);
          for (const p of J.rozeberKanal(await r.text(), u.z.id, u.k.rubrika).slice(0, 40)) {
            if (p.d < ted() - 48 * 3600) continue;      // krajské kanály vracejí i staré články – přehled drží 48 h
            p.n = p.d;                                    // „poprvé viděno“ = vydání: starší než minulá návštěva nesvítí jako NOVÉ
            p.r = J.urciRubriku(p, u.z, u.k, katalog);
            if (u.k.kraj) p.kr = u.k.kraj;
            delete p.k;
            vysledek.push(p);
          }
          ok++;
        } catch (e) { /* kanál teď nejde – zůstane verze z přehledu */ }
        finally { clearTimeout(limit); }
      }
    }
    await Promise.all(Array.from({ length: 6 }, pracovnik));
    if (ok) { zivePolozky = vysledek; posledniZive = ted(); }
    ziveKanalu = ok;
    return { ok, celkem: ukoly.length };
  }

  /** rucne = vynutit znovunačtení i živé kanály; tichy = bez hlášení výsledku (start stránky). */
  async function obnov(rucne, tichy) {
    const tl = $('#tl-obnovit');
    if (tl.classList.contains('toci')) return;
    tl.classList.add('toci');
    tl.disabled = true;
    $('#stav-obnovy').textContent = 'Načítám…';
    const vybrane = vybraneZdroje();
    const predtim = rucne && data && data.vygenerovano ? new Set(vsechnyPolozky().map(p => p.i)) : null;
    try {
      const [vysl] = await Promise.all([stahniData(rucne), stahniVlastni()]);
      const zmena = !nove || vysl.d.vygenerovano !== nove.vygenerovano;
      hlaseni(vysl.offline
        ? { text: 'Nepodařilo se načíst nová data (' + (vysl.chyba && vysl.chyba.message || 'offline') + '). Zobrazuji poslední uložená z ' + J.casRelativni(vysl.d.vygenerovano, ted()) + '.' }
        : null);
      if (!nove || rucne) {
        nove = vysl.d;
        slozData();
        cekajiciData = null;
        $('#banner').hidden = true;
        const zive = rucne && !vysl.offline ? await stahniZive() : null;
        vykresli(true);
        if (predtim && !tichy) {
          const n = vsechnyPolozky().filter(p => vybrane.has(p.z) && !predtim.has(p.i)).length;
          const cas = new Date(data.vygenerovano * 1000).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
          Dialog.info((n ? '✓ ' + n + ' ' + (n === 1 ? 'nová zpráva' : n < 5 ? 'nové zprávy' : 'nových zpráv') : 'Žádné nové zprávy')
            + (zive && zive.ok ? ' · živě ' + zive.ok + ' kanálů' : '') + ' · ostatní weby stažené v ' + cas);
        }
      }
      else if (!zmena) {
        aktualizujCasy();                 // stejná data – jen obnovit „před X min“, nepřekreslovat (čtenář by skočil nahoru)
      } else {
        // automatická obnova s novými daty: když je čtenář nahoře, rovnou překreslit, jinak nabídnout banner
        const znama = new Set(vsechnyPolozky().map(p => p.i));
        const pocetNovych = vysl.d.polozky.filter(p => !znama.has(p.i) && vybrane.has(p.z)).length;
        if (window.scrollY < 80 || !pocetNovych) { nove = vysl.d; slozData(); cekajiciData = null; $('#banner').hidden = true; vykresliBezSkoku(); }
        else { cekajiciData = vysl.d; ukazBanner(pocetNovych); }
      }
      oznacNavstevu();
      zkontrolujUpozorneni(tichy);
    } catch (e) {
      hlaseni({ chyba: true, text: 'Zprávy se nepodařilo načíst: ' + e.message + '. Data připravuje GitHub Action „Zprávy – stažení kanálů“ ve větvi zpravy-data – pokud stránka běží poprvé, ještě neproběhla.' });
      if (!data) { nove = { vygenerovano: 0, zdroje: {}, polozky: [] }; slozData(); vykresli(true); }
    } finally {
      tl.disabled = false;
      tl.classList.remove('toci');
      aktualizujStavObnovy();
    }
  }

  function ukazBanner(pocet) {
    const b = $('#banner');
    b.textContent = '▲ ' + pocet + ' ' + (pocet === 1 ? 'nová zpráva' : pocet < 5 ? 'nové zprávy' : 'nových zpráv') + ' – zobrazit';
    b.hidden = false;
  }
  $('#banner').addEventListener('click', () => {
    if (cekajiciData) { nove = cekajiciData; cekajiciData = null; slozData(); }
    $('#banner').hidden = true;
    vykresli(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  function hlaseni(h) {
    const box = $('#hlaseni');
    box.replaceChildren();
    if (!h) return;
    box.append(el('div', 'hlaseni' + (h.chyba ? ' chyba' : ''), h.text));
  }

  /** Relativní časy na dlaždicích („před 5 min“) bez překreslení – kvůli automatické obnově. */
  function aktualizujCasy() {
    for (const d of document.querySelectorAll('#osa .dl')) {
      const c = d.querySelector('.dl-zdroj .cas');
      if (c && d._tema) c.textContent = J.casRelativni(d._tema.hlavni.d, ted());
    }
  }

  function aktualizujStavObnovy() {
    if (!data || !data.vygenerovano) { $('#stav-obnovy').textContent = 'Obnovit'; return; }
    $('#stav-obnovy').textContent = J.casRelativni(Math.max(data.vygenerovano, posledniZive), ted());
    const h = t => new Date(t * 1000).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
    $('#tl-obnovit').title = 'Přehled všech webů z ' + h(data.vygenerovano) + ' (stahuje se každých 20 min)'
      + (posledniZive ? ', živě ' + ziveKanalu + ' kanálů v ' + h(posledniZive) : '') + '\nKlik = načíst znovu, ' + (N.proxy ? 'všechny weby živě přes proxy' : 'weby, které to dovolují, živě') + ' (R)';
  }

  // ---------- filtrování ----------
  function vsechnyPolozky() {
    if (!data) return vlastniPolozky;
    if (!zivePolozky.length) return data.polozky.concat(vlastniPolozky);
    // živé položky jen ty, které přehled ještě nemá (id = hash odkazu, stejné jako ve skriptu)
    if (!data._ids) data._ids = new Set(data.polozky.map(p => p.i));
    const videne = new Set();
    const zive = zivePolozky.filter(p => {
      if (data._ids.has(p.i) || videne.has(p.i)) return false;
      videne.add(p.i);
      return true;
    });
    return data.polozky.concat(zive, vlastniPolozky);
  }

  // ---------- režimy: Zprávy / Zajímavosti (každý má vlastní skryté rubriky) ----------
  const pohoda = () => N.rezim === 'pohoda';
  const klicSkrytych = () => pohoda() ? 'skryteRubrikyPohoda' : 'skryteRubriky';
  const skryteR = () => N[klicSkrytych()];
  function nastavSkryteR(seznam) { N[klicSkrytych()] = seznam; ulozNastaveni(); vykresli(true); }
  let vyloucitKlic = '', vyloucitRe = null, clickbaitRe = null;
  /** Zajímavosti: jeden výraz ze slov politiky a/nebo neštěstí (podle voleb). */
  function vyloucitPohoda() {
    if (!pohoda()) return null;
    const klic = (N.pohodaBezPolitiky ? 'p' : '') + (N.pohodaBezNegativnich ? 'n' : '');
    if (klic !== vyloucitKlic) {
      vyloucitKlic = klic;
      vyloucitRe = klic ? J.vyrazSlov([...(N.pohodaBezPolitiky ? katalog.politika_slova || [] : []),
        ...(N.pohodaBezNegativnich ? katalog.negativni_slova || [] : [])]) : null;
    }
    return vyloucitRe;
  }
  function prepniRezim(rezim, tise) {
    if (N.rezim === rezim) return;
    N.rezim = rezim;
    ulozNastaveni();
    if (!data) return;
    vykresli(true);
    if (!tise) window.scrollTo({ top: 0 });
  }
  /**
   * Večerní režim: při vstupu do intervalu (21:00–06:00) přepnout na Zajímavosti, při odchodu zpět.
   * Reaguje jen na přechod, takže ruční přepnutí uprostřed večera vydrží do rána.
   */
  function hlidejVecer() {
    if (!N.autoPohoda) { N._autoStav = null; return; }
    const stav = J.vIntervalu(N.autoOd, N.autoDo, new Date()) ? 'vecer' : 'den';
    if (N._autoStav === stav) return;
    N._autoStav = stav;
    const cil = stav === 'vecer' ? 'pohoda' : 'zpravy';
    if (N.rezim !== cil) {
      prepniRezim(cil, true);
      Dialog.info(stav === 'vecer' ? '🌙 Je večer – přepnuto na Zajímavosti (bez politiky a neštěstí)' : '📰 Dobré ráno – zpět na Zprávy');
    } else ulozNastaveni();
  }
  $('#rezim-zpravy').addEventListener('click', () => prepniRezim('zpravy'));
  $('#rezim-pohoda').addEventListener('click', () => prepniRezim('pohoda'));
  function zakladFiltru() {
    return {
      zdroje: filtrZdroje ? new Set([filtrZdroje]) : vybraneZdroje(),
      skryteRubriky: new Set(skryteR()),
      vyloucit: vyloucitPohoda(),
      rubrikyZdroju: new Map(Object.entries(N.rubrikyZdroju || {}).map(([z, r]) => [z, new Set(r)])),
      kraj: N.mujKraj || null,
      clickbait: N.bezClickbaitu ? (clickbaitRe || (clickbaitRe = new RegExp((katalog.clickbait_vzory || ['$^']).join('|'), 'i'))) : null,
      jazyky: new Set(N.jazyky),
      jazykZdroje: new Map([...ZDROJE.values()].map(z => [z.id, z.jazyk || 'cs'])),
      nazvyZdroju: new Map([...ZDROJE.values()].map(z => [z.id, z.nazev])),
      ztlumit: N.ztlumit, skryte,
      jenNeprectene: N.jenNeprectene, precteno,
      dotaz: $('#hledat').value,
    };
  }

  // ---------- vykreslení ----------
  function vykresli(odZacatku) {
    if (!katalog || !data) return;
    const f = zakladFiltru();
    let polozky;
    if (rezimUlozene) {
      polozky = J.filtruj(ulozene, Object.assign({}, f, { zdroje: null, skryte: null, jenNeprectene: false, jazyky: null, skryteRubriky: null, ztlumit: [], vyloucit: null, kraj: undefined, clickbait: null, rubrikyZdroju: null }));
    } else {
      const bezRubrik = J.filtruj(vsechnyPolozky(), Object.assign({}, f, { skryteRubriky: null }));
      polozkyPohledu = bezRubrik;
      pocetRubrik = new Map();
      for (const p of bezRubrik) pocetRubrik.set(p.r, (pocetRubrik.get(p.r) || 0) + 1);
      // sledované téma: všechno o něm bez ohledu na skryté rubriky
      polozky = filtrTema ? bezRubrik.filter(p => J.zvyraznena(p, [filtrTema])) : bezRubrik.filter(p => !f.skryteRubriky.has(p.r));
    }
    aktualizujListu();
    const poradi = N.zdroje || katalog.zdroje.filter(z => z.vychozi).map(z => z.id);
    zobrazenaTemata = J.seskup(polozky, { zapnuto: N.seskupit && !rezimUlozene, poradiZdroju: poradi, vydavatel: vydavatele() });

    document.body.classList.toggle('husta', N.husta);
    document.body.classList.toggle('bez-obrazku', !N.obrazky);
    document.body.classList.toggle('titulky', N.zobrazeni === 'titulky');

    // hlavní témata nahoře jen v neutrálním pohledu; po delší nepřítomnosti „co jste zmeškali“
    const ukazTemata = N.temata && N.seskupit && !rezimUlozene && !f.dotaz.trim() && !filtrZdroje && !filtrTema;
    const zmeskaneOd = zmeskaneOdKdy();
    let top = [];
    if (ukazTemata) {
      top = zmeskaneOd
        ? velkaTemata(zmeskaneOd, 8)
        : J.hlavniTemata(zobrazenaTemata, ted(), 6, 12).filter(t => t.redakce.size >= 3);
    }
    const zmeskane = !!(zmeskaneOd && top.length);
    $('#temata-nadpis').textContent = zmeskane
      ? '🕐 Co jste zmeškali od ' + new Date(zmeskaneOd * 1000).toLocaleString('cs-CZ', { weekday: 'long', hour: '2-digit', minute: '2-digit' })
      : '🔥 Hlavní témata – o čem píše nejvíc webů';
    $('#zmeskane-zavrit').hidden = !zmeskane;
    $('#hlavni-temata').hidden = !top.length;
    $('#temata').replaceChildren(...top.map(kartaTematu));

    if (odZacatku) {
      $('#osa').replaceChildren();
      vykreslenoDo = 0; oddilAktualni = null; mrizkaAktualni = null;
    }
    if (!zobrazenaTemata.length) {
      $('#osa').replaceChildren(el('div', 'prazdno', rezimUlozene ? 'Zatím nemáte uložené žádné články. Uložíte je tlačítkem ☆ Uložit v náhledu zprávy.'
        : f.dotaz.trim() ? 'Nic nenalezeno. Zkuste jiné slovo nebo jinou rubriku.'
        : data.polozky.length ? 'Ve vybraných rubrikách teď nejsou žádné zprávy z vybraných webů.' : 'Žádné zprávy k zobrazení.'));
    }
    pridejDavku();
    vykresliPatu();
    $('#pocet-ulozenych').textContent = ulozene.length ? ' ' + ulozene.length : '';
  }

  /** id webu → vydavatel (iDNES a Lidovky = MAFRA): kopie téhož článku se nepočítají jako další redakce. */
  let vydavateleMapa = null;
  const vydavatele = () => vydavateleMapa || (vydavateleMapa = new Map(katalog.zdroje.filter(z => z.vydavatel).map(z => [z.id, z.vydavatel])));
  /** Největší témata od času `od` (aspoň 3 redakce). */
  const velkaTemata = (od, pocet) => zobrazenaTemata.filter(t => t.d > od && t.redakce.size >= 3)
    .sort((a, b) => b.redakce.size - a.redakce.size || b.d - a.d).slice(0, pocet);
  let polozkyPohledu = [];          // vyfiltrované položky (bez omezení rubrik) – pro vývoj tématu v náhledu
  let zmeskaneSkryto = false;
  /** Od kdy ukázat „co jste zmeškali“: minulá návštěva před víc než 6 h (jinak 0). */
  const zmeskaneOdKdy = () => !zmeskaneSkryto && navsteva.minula && ted() - navsteva.minula > 6 * 3600 ? navsteva.minula : 0;
  $('#zmeskane-zavrit').addEventListener('click', () => { zmeskaneSkryto = true; vykresliBezSkoku(); });

  function pridejDavku() {
    const oddily = J.oddilyCasu(ted());
    const konec = Math.min(zobrazenaTemata.length, vykreslenoDo + DAVKA);
    const zvyr = N.zvyraznit;
    for (let i = vykreslenoDo; i < konec; i++) {
      const t = zobrazenaTemata[i];
      const oddil = J.oddilPro(t.d, oddily);
      if (oddil !== oddilAktualni) {
        oddilAktualni = oddil;
        $('#osa').append(el('h2', 'oddil', oddily.find(o => o.id === oddil).nazev));
        mrizkaAktualni = el('div', N.zobrazeni === 'mozaika' ? 'mozaika' : 'seznam');
        $('#osa').append(mrizkaAktualni);
      }
      mrizkaAktualni.append(dlazdice(t, zvyr));
    }
    vykreslenoDo = konec;
    $('#tl-dalsi').hidden = vykreslenoDo >= zobrazenaTemata.length;
    $('#tl-dalsi').textContent = 'Zobrazit další (' + (zobrazenaTemata.length - vykreslenoDo) + ')';
    $('#tl-starsi').hidden = !$('#tl-dalsi').hidden || maStarsi() || rezimUlozene;
  }
  $('#tl-starsi').addEventListener('click', () => nactiStarsi());
  // na konci seznamu dotáhnout starší zprávy samo
  new IntersectionObserver(z => { if (z[0].isIntersecting && !$('#tl-starsi').hidden && !nacitamStarsi) nactiStarsi(); }, { rootMargin: '400px' }).observe($('#tl-starsi'));
  $('#tl-dalsi').addEventListener('click', pridejDavku);
  // automaticky při dojetí k tlačítku
  new IntersectionObserver(z => { if (z[0].isIntersecting && !$('#tl-dalsi').hidden) pridejDavku(); }, { rootMargin: '600px' }).observe($('#tl-dalsi'));

  function dlazdice(t, zvyr) {
    const p = t.hlavni, zdroj = zdrojPol(p);
    const sObr = p.o && N.obrazky;
    const a = el('article', 'dl' + (sObr ? ' foto' : ' bez-foto'));
    a.dataset.id = p.i;
    a.style.setProperty('--rb', barvaRubriky(p.r));
    if (precteno.has(p.i)) a.classList.add('precteno');
    if (J.zvyraznena(p, zvyr)) a.classList.add('zvyraznit');

    // skutečný odkaz kvůli Ctrl/prostřednímu kliku (rovnou web); obyčejný klik otevře náhled
    const odkaz = el('a', 'dl-odkaz');
    odkaz.href = p.u; odkaz.target = '_blank'; odkaz.rel = 'noopener noreferrer';
    odkaz.setAttribute('data-i18n', 'ne');
    if (sObr) {
      const img = el('img');
      img.loading = 'lazy'; img.decoding = 'async'; img.referrerPolicy = 'no-referrer'; img.alt = '';
      img.src = p.o;
      img.addEventListener('error', () => { a.classList.remove('foto'); a.classList.add('bez-foto'); img.remove(); }, { once: true });
      odkaz.append(img);
    }
    const hlava = el('div', 'dl-zdroj');
    hlava.append(znak(zdroj), el('span', 'zdroj', zdroj.nazev));
    if (t.redakce.size > 1) {
      const n = el('span', 'vic', '+' + (t.redakce.size - 1));
      n.title = 'Píše o tom ještě ' + (t.redakce.size - 1) + ' ' + (t.redakce.size === 2 ? 'redakce' : t.redakce.size <= 5 ? 'redakce' : 'redakcí');
      hlava.append(n);
    }
    if (navsteva.minula && (p.n || p.d) > navsteva.minula && !precteno.has(p.i)) hlava.append(el('span', 'nove', 'NOVÉ'));
    hlava.append(el('span', 'cas', J.casRelativni(p.d, ted())));
    odkaz.append(hlava, el('h3', 'dl-titulek', p.t));
    if (p.p) odkaz.append(el('p', 'dl-perex', p.p));
    a.append(odkaz);
    a._tema = t;
    return a;
  }

  function kartaTematu(t) {
    const b = el('button', 'tema-karta');
    b.style.setProperty('--rb', barvaRubriky(t.hlavni.r));
    b.append(el('b', null, t.hlavni.t));
    const znaky = el('span', 'znaky');
    [...t.zdroje].slice(0, 8).forEach(z => znaky.append(znak(zdrojPol({ z }))));
    znaky.append(document.createTextNode(' ' + t.redakce.size + ' redakcí · ' + J.casRelativni(t.d, ted())));
    b.append(znaky);
    b.setAttribute('data-i18n', 'ne');
    b.addEventListener('click', () => ukazNahled(t, t.hlavni));
    return b;
  }

  // ---------- rubriky (jen čip v liště se zaškrtávátky) ----------
  let pocetRubrik = new Map();
  function aktualizujListu() {
    const skryte = skryteR().filter(r => RUBRIKY.has(r)).length;
    $('#rezim-zpravy').setAttribute('aria-pressed', String(!pohoda()));
    $('#rezim-pohoda').setAttribute('aria-pressed', String(pohoda()));
    document.body.classList.toggle('pohoda', pohoda());
    document.body.classList.toggle('tlumene', pohoda() && N.pohodaTlumene);
    $('#popis-rubrik').textContent = skryte ? 'Rubriky ' + (katalog.rubriky.length - skryte) + '/' + katalog.rubriky.length : 'Rubriky';
    $('#tl-rubriky').setAttribute('aria-pressed', String(!!skryte));
    const fz = $('#filtr-zdroje');
    fz.hidden = !filtrZdroje;
    if (filtrZdroje) fz.textContent = 'Jen ' + zdrojPol({ z: filtrZdroje }).nazev + ' ✕';
    const ft = $('#filtr-tema');
    ft.hidden = !filtrTema;
    if (filtrTema) ft.textContent = '📌 ' + filtrTema + ' ✕';
  }
  $('#filtr-zdroje').addEventListener('click', () => { filtrZdroje = null; vykresli(true); });
  $('#filtr-tema').addEventListener('click', () => { filtrTema = null; vykresli(true); });
  function ukazTemaSledovane(slovo) {
    filtrTema = slovo;
    rezimUlozene = false;
    $('#tl-ulozene').setAttribute('aria-pressed', 'false');
    nactiStarsi();                      // téma i ze starších zpráv
    vykresli(true);
    window.scrollTo({ top: 0 });
  }
  async function pridejTema() {
    const s = await Dialog.zeptej('Sledovat téma (slovo nebo frázi – zprávy s ním se zvýrazní a budou mít vlastní pohled):', '');
    if (!s || !s.trim()) return;
    N.zvyraznit = [...new Set(N.zvyraznit.concat(s.trim()))];
    ulozNastaveni();
    zkontrolujUpozorneni(true);
    ukazTemaSledovane(s.trim());
  }
  const nazevKraje = id => ((katalog.kraje || []).find(k => k.id === id) || {}).nazev || id;
  function prepniSkrytiRubriky(id) {
    nastavSkryteR(skryteR().includes(id) ? skryteR().filter(x => x !== id) : skryteR().concat(id));
  }
  function nabidkaRubrik() {
    return [
      'Rubriky v režimu ' + (pohoda() ? '🌙 Zajímavosti' : '📰 Zprávy'),
      ...katalog.rubriky.map(r => [r.ikona + ' ' + (r.id === 'kraj' ? 'Můj kraj' + (N.mujKraj ? ' – ' + nazevKraje(N.mujKraj) : ' (vyberte kraj)') : r.nazev),
        () => { if (r.id === 'kraj' && !N.mujKraj) { zavriNabidku(); otevriNastaveni('rubriky'); return; } prepniSkrytiRubriky(r.id); },
        !skryteR().includes(r.id), pocetRubrik.get(r.id) || 0]),
      null,
      ...(pohoda() ? [
        ['🚫 Skrývat politiku a válku i v ostatních rubrikách', () => { N.pohodaBezPolitiky = !N.pohodaBezPolitiky; ulozNastaveni(); vykresli(true); }, N.pohodaBezPolitiky],
        ['😌 Skrývat neštěstí, nehody a krimi', () => { N.pohodaBezNegativnich = !N.pohodaBezNegativnich; ulozNastaveni(); vykresli(true); }, N.pohodaBezNegativnich],
        ['🕯️ Tlumené barvy', () => { N.pohodaTlumene = !N.pohodaTlumene; ulozNastaveni(); aktualizujListu(); }, N.pohodaTlumene],
        null] : []),
      ['Zapnout všechny', () => nastavSkryteR([])],
      ['Vypnout všechny', () => nastavSkryteR(katalog.rubriky.map(r => r.id))],
      null, '📌 Sledovaná témata',
      ...N.zvyraznit.map(sl => ['📌 ' + sl, () => { zavriNabidku(); ukazTemaSledovane(sl); }, null, polozkyPohledu.filter(p => J.zvyraznena(p, [sl])).length]),
      ['＋ Sledovat nové téma…', () => { zavriNabidku(); pridejTema(); }],
      ['📍 ' + (N.mujKraj ? 'Kraj: ' + nazevKraje(N.mujKraj) + ' – změnit…' : 'Vybrat svůj kraj…'), () => { zavriNabidku(); otevriNastaveni('rubriky'); }],
    ];
  }

  function vykresliPatu() {
    const pata = $('#pata');
    pata.replaceChildren();
    if (!data || !data.vygenerovano) return;
    const vybrane = vybraneZdroje();
    const stavy = Object.entries(data.zdroje || {}).filter(([z]) => vybrane.has(z));
    const chyby = stavy.filter(([, s]) => !s.ok).map(([z]) => zdrojPol({ z }).nazev);
    pata.append(document.createTextNode('Data z ' + new Date(data.vygenerovano * 1000).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })
      + ' · ' + vybrane.size + ' sledovaných webů · ' + zobrazenaTemata.length + ' zpráv v pohledu'
      + (chyby.length ? ' · nedostupné: ' + chyby.join(', ') : '') + ' · '));
    const b = el('button', null, 'upravit výběr webů');
    b.addEventListener('click', () => otevriNastaveni('zdroje'));
    pata.append(b, document.createTextNode(' · Titulky a perexy patří jejich vydavatelům, článek se otevře na jejich webu.'));
  }

  // ---------- akce na dlaždicích ----------
  /** p = položka (kvůli deníku čtení pro zrcadlo a „dost pro dnešek“). */
  function oznacPrecteno(id, p) {
    if (precteno.has(id)) return;
    precteno.set(id, ted());
    ulozMapu(K.precteno, precteno);
    if (p) zapisCteni(p);
    document.querySelectorAll('.dl[data-id="' + CSS.escape(id) + '"]').forEach(d => { d.classList.add('precteno'); d.querySelector('.nove')?.remove(); });
  }

  function prepniUlozeni(p) {
    const i = ulozene.findIndex(u => u.i === p.i);
    if (i >= 0) ulozene.splice(i, 1);
    else {
      const kopie = { i: p.i, z: p.z, r: p.r, t: p.t, p: p.p, u: p.u, d: p.d };
      if (p.o) kopie.o = p.o;
      ulozene.unshift(kopie);
      ulozene = ulozene.slice(0, 300);
    }
    uloz(K.ulozene, ulozene);
    if (window.Dialog) Dialog.info(i >= 0 ? 'Odebráno z uložených' : 'Uloženo na později ★');
    vykresliBezSkoku();
  }

  /** Skrýt téma – všechny jeho články, jinak by se téma vrátilo s jiným webem v čele. */
  function skryj(t, p) {
    if (rezimUlozene) { prepniUlozeni(p || t.hlavni); return; }
    for (const c of t.cleny) skryte.set(c.i, ted());
    ulozMapu(K.skryte, skryte);
    vykresliBezSkoku();
  }

  /** Překreslit a zachovat pozici čtení (i zobrazený počet dlaždic). */
  function vykresliBezSkoku() {
    const y = window.scrollY, kolik = vykreslenoDo;
    vykresli(true);
    while (vykreslenoDo < Math.min(kolik, zobrazenaTemata.length)) pridejDavku();
    window.scrollTo(0, y);
  }

  async function ztlumSlovo(vychozi) {
    const s = await Dialog.zeptej('Skrývat zprávy obsahující slovo nebo frázi:', vychozi || '');
    if (!s || !s.trim()) return;
    N.ztlumit = [...new Set(N.ztlumit.concat(s.trim()))];
    ulozNastaveni();
    vykresliBezSkoku();
    Dialog.info('Ztlumeno: ' + s.trim());
  }

  function nabidkaClanku(p, kotva) {
    const zdroj = zdrojPol(p);
    const polozky = [
      ['🔗 Kopírovat odkaz', async () => { try { await navigator.clipboard.writeText(p.u); Dialog.info('Odkaz zkopírován'); } catch (e) { Dialog.chyba('Schránka není dostupná'); } }],
    ];
    if (navigator.share) polozky.push(['📤 Sdílet…', () => navigator.share({ title: p.t, url: p.u }).catch(() => {})]);
    polozky.push(null,
      [precteno.has(p.i) ? '◻ Označit jako nepřečtené' : '✓ Označit jako přečtené', () => {
        if (precteno.has(p.i)) { precteno.delete(p.i); ulozMapu(K.precteno, precteno); vykresliBezSkoku(); } else oznacPrecteno(p.i, p);
      }],
      ['📡 Jen zprávy z ' + zdroj.nazev, () => { $('#dlg-nahled').close(); filtrZdroje = p.z; rezimUlozene = false; vykresli(true); window.scrollTo({ top: 0 }); }],
      ['🔇 Přestat sledovat ' + zdroj.nazev, async () => {
        if (!await Dialog.potvrd('Přestat sledovat web ' + zdroj.nazev + '? Vrátit ho můžete v Nastavení → Weby.')) return;
        if (zdroj.vlastni) N.vlastni = N.vlastni.filter(v => v.id !== p.z);
        else N.zdroje = [...vybraneZdroje()].filter(z => z !== p.z && !z.startsWith('v_'));
        $('#dlg-nahled').close(); ulozNastaveni(); sestavZdroje(); vykresliBezSkoku();
      }],
      ['🔇 Ztlumit slovo…', () => ztlumSlovo('')]);
    const r = RUBRIKY.get(p.r);
    if (r) polozky.push(['🗂️ Z ' + zdroj.nazev + ' nezobrazovat rubriku ' + r.nazev, () => {
      const akt = povoleneRubriky(p.z) || rubrikyWebu(p.z).map(x => x.id);
      $('#dlg-nahled').close();
      nastavRubrikyWebu(p.z, akt.filter(x => x !== r.id));
      Dialog.info(zdroj.nazev + ': rubrika ' + r.nazev + ' skryta – vrátíte ji v Nastavení → Weby');
    }]);
    if (r) polozky.push(['🙈 Skrýt celou rubriku ' + r.nazev, () => { $('#dlg-nahled').close(); prepniSkrytiRubriky(r.id); Dialog.info('Rubrika ' + r.nazev + ' skryta – vrátíte ji v 🗂️ Rubriky'); }]);
    otevriNabidku(kotva, polozky);
  }

  $('#osa').addEventListener('click', e => {
    const dl = e.target.closest('.dl');
    if (!dl || e.ctrlKey || e.metaKey || e.shiftKey) {   // Ctrl+klik = rovnou web v nové kartě
      if (dl) oznacPrecteno(dl.dataset.id, dl._tema.hlavni);
      return;
    }
    e.preventDefault();
    ukazNahled(dl._tema, dl._tema.hlavni);
  });
  // prostřední tlačítko myši = otevření v nové kartě → taky přečteno
  $('#osa').addEventListener('auxclick', e => {
    const dl = e.target.closest('.dl');
    if (dl && e.button === 1) oznacPrecteno(dl.dataset.id, dl._tema.hlavni);
  });

  // ---------- náhled zprávy (první klik); článek na webu až dalším klikem ----------
  let nahled = null;           // { t, p }
  function ukazNahled(t, p) {
    nahled = { t, p };
    const zdroj = zdrojPol(p);
    const dlg = $('#dlg-nahled');
    dlg.style.setProperty('--rb', barvaRubriky(p.r));
    const obr = $('#nahled-obr');
    obr.hidden = !(p.o && N.obrazky);
    if (!obr.hidden) { obr.src = p.o; obr.onerror = () => { obr.hidden = true; }; }
    else obr.removeAttribute('src');
    for (const a of dlg.querySelectorAll('.na-web')) a.href = p.u;
    const meta = $('#nahled-meta');
    meta.replaceChildren(znak(zdroj), el('b', null, zdroj.nazev), el('span', null, '· ' + J.casRelativni(p.d, ted())));
    const r = RUBRIKY.get(p.r);
    if (r) meta.append(el('span', 'rubrika', r.ikona + ' ' + r.nazev));
    $('#nahled-titulek a').textContent = p.t;
    $('#nahled-perex').textContent = p.p || 'Web k této zprávě nepřipojil anotaci – celý text najdete na webu.';
    $('#nahled-perex').classList.toggle('prazdny', !p.p);
    $('#nahled-otevrit').textContent = 'Číst na ' + zdroj.nazev + ' ↗';
    const jeUlozeno = ulozene.some(u => u.i === p.i);
    $('#nahled-ulozit').textContent = jeUlozeno ? '★ Uloženo' : '☆ Uložit';
    $('#nahled-ulozit').setAttribute('aria-pressed', String(jeUlozeno));
    $('#nahled-skryt').textContent = rezimUlozene ? '✕ Odebrat z uložených' : '✕ Skrýt';
    // vývoj tématu: všechny zprávy o téže události (i aktualizace téhož webu) od nejstarší – klik přepne náhled
    const mapa = new Map();
    for (const c of [...t.cleny, ...J.souvisejici(t.hlavni, polozkyPohledu.length ? polozkyPohledu : t.cleny)]) mapa.set(c.i, c);
    // kopie téhož článku od jednoho vydavatele (iDNES + Lidovky) = jeden řádek se dvěma weby
    const kopie = new Map();
    for (const c of [...mapa.values()].sort((a, b) => a.d - b.d)) {
      const klic = (vydavatele().get(c.z) || c.z) + '|' + J.normalizuj(c.t);
      if (kopie.has(klic)) kopie.get(klic).dalsi.push(c); else kopie.set(klic, { c, dalsi: [] });
    }
    const vyvoj = [...kopie.values()].map(x => x.c);
    const dalsiWeby = new Map([...kopie.values()].map(x => [x.c.i, x.dalsi.map(d => zdrojPol(d).nazev)]));
    const sekce = $('#nahled-tema');
    sekce.hidden = vyvoj.length < 2;
    const webu = new Set([...mapa.values()].map(c => c.z)).size;
    $('#nahled-tema-h').textContent = '🧵 Vývoj zprávy – ' + vyvoj.length + ' ' + (vyvoj.length < 5 ? 'zprávy' : 'zpráv')
      + ' z ' + webu + ' ' + (webu === 1 ? 'webu' : 'webů') + (vyvoj.length > 1 ? ' za ' + delka(vyvoj[vyvoj.length - 1].d - vyvoj[0].d) : '');
    const dnes = new Date().toDateString();
    $('#nahled-clenove').replaceChildren(...vyvoj.map((c, i) => {
      const b = el('button', 'clen' + (c === p ? ' aktivni' : ''));
      const dt = new Date(c.d * 1000);
      const cas = el('span', 'cas', (dt.toDateString() === dnes ? '' : dt.getDate() + '. ' + (dt.getMonth() + 1) + '. ') + dt.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' }));
      const stred = el('span');
      stred.append(el('span', null, c.t), el('small', null, [zdrojPol(c).nazev, ...dalsiWeby.get(c.i)].join(' + ')
        + (i === 0 ? ' · první zpráva' : i === vyvoj.length - 1 ? ' · nejnovější' : '') + (precteno.has(c.i) ? ' · přečteno' : '')));
      b.append(cas, znak(zdrojPol(c)), stred);
      b.setAttribute('data-i18n', 'ne');
      b.addEventListener('click', () => ukazNahled(t, c));
      return b;
    }));
    zastavCteni();
    // pozice pro listování
    const vse = dlazdiceVPoradi();
    const i = vse.findIndex(d => d.dataset.id === t.hlavni.i);   // podle id: dlaždice se po uložení překreslí
    $('#nahled-pozice').textContent = i >= 0 ? (i + 1) + ' / ' + zobrazenaTemata.length : '';
    $('#nahled-pred').disabled = i <= 0;
    $('#nahled-dalsi').disabled = i < 0 || i >= zobrazenaTemata.length - 1;
    oznacPrecteno(p.i, p);
    if (!dlg.open) dlg.showModal();
    dlg.querySelector('.okno-telo').scrollTop = 0;
    $('#nahled-otevrit').focus();
  }
  const delka = s => s < 3600 ? Math.max(1, Math.round(s / 60)) + ' min' : s < 48 * 3600 ? Math.round(s / 3600) + ' h' : Math.round(s / 86400) + ' dní';
  function listuj(smer) {
    if (!nahled) return;
    let vse = dlazdiceVPoradi();
    let i = vse.findIndex(d => d.dataset.id === nahled.t.hlavni.i) + smer;
    if (i >= vse.length && vykreslenoDo < zobrazenaTemata.length) { pridejDavku(); vse = dlazdiceVPoradi(); }
    if (i < 0 || i >= vse.length) return;
    vse[i].scrollIntoView({ block: 'center' });
    ukazNahled(vse[i]._tema, vse[i]._tema.hlavni);
  }
  $('#nahled-pred').addEventListener('click', () => listuj(-1));
  $('#nahled-dalsi').addEventListener('click', () => listuj(1));
  $('#nahled-ulozit').addEventListener('click', () => { prepniUlozeni(nahled.p); ukazNahled(nahled.t, nahled.p); });
  $('#nahled-skryt').addEventListener('click', () => { const { t, p } = nahled; $('#dlg-nahled').close(); skryj(t, p); });
  $('#nahled-vice').addEventListener('click', e => nabidkaClanku(nahled.p, e.currentTarget));
  $('#nahled-cist').addEventListener('click', () => {
    if (cteni) { zastavCteni(); return; }
    const p = nahled.p, z = zdrojPol(p);
    predcitej([{ text: z.nazev + '. ' + p.t + '. ' + (p.p || ''), jazyk: z.jazyk || 'cs' }]);
  });
  $('#dlg-nahled').addEventListener('close', () => {
    if (cteni && cteni.zNahledu) zastavCteni();
    if (otevrena && $('#dlg-nahled').contains(otevrena)) zavriNabidku();   // close přijde asynchronně – nezavřít nabídku otevřenou mezitím jinde
    const dl = nahled && document.querySelector('#osa .dl[data-id="' + CSS.escape(nahled.t.hlavni.i) + '"] .dl-odkaz');
    if (dl) dl.focus({ preventScroll: true });
  });
  $('#dlg-nahled').addEventListener('keydown', e => {
    if (e.target.closest('.nabidka')) return;
    const k = e.key.toLowerCase();
    if (e.key === 'ArrowRight' || k === 'j') { listuj(1); e.preventDefault(); }
    else if (e.key === 'ArrowLeft' || k === 'k') { listuj(-1); e.preventDefault(); }
    else if (k === 's') $('#nahled-ulozit').click();
    else if (k === 'h') $('#nahled-skryt').click();
    else if (k === 'o') $('#nahled-otevrit').click();
    else if (k === 'p') $('#nahled-cist').click();
  });
  for (const a of document.querySelectorAll('#dlg-nahled .na-web')) a.addEventListener('click', () => setTimeout(() => $('#dlg-nahled').close(), 0));
  // gesta na mobilu: přejetí doleva/doprava = další/předchozí zpráva, dolů (když je náhled nahoře) = zavřít
  let dotyk = null;
  $('#dlg-nahled').addEventListener('touchstart', e => {
    if (e.touches.length !== 1 || e.target.closest('.nabidka')) { dotyk = null; return; }
    dotyk = { x: e.touches[0].clientX, y: e.touches[0].clientY, nahore: $('#dlg-nahled .okno-telo').scrollTop <= 0, t: Date.now() };
  }, { passive: true });
  $('#dlg-nahled').addEventListener('touchend', e => {
    if (!dotyk || Date.now() - dotyk.t > 800) { dotyk = null; return; }
    const dx = e.changedTouches[0].clientX - dotyk.x, dy = e.changedTouches[0].clientY - dotyk.y;
    const nahore = dotyk.nahore;
    dotyk = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > 1.5 * Math.abs(dy)) listuj(dx < 0 ? 1 : -1);
    else if (dy > 90 && dy > 1.5 * Math.abs(dx) && nahore) $('#dlg-nahled').close();
  }, { passive: true });

  // ---------- předčítání (hlas prohlížeče – na krátké texty stačí; neuronové hlasy má stránka Předčítač) ----------
  let cteni = null;                 // { fronta, i, zNahledu }
  const NAZVY_JAZYKU = { cs: 'češtinu', sk: 'slovenštinu', en: 'angličtinu' };
  async function hlasPro(jazyk) {
    if (!window.speechSynthesis) throw new Error('Prohlížeč neumí předčítat.');
    let hlasy = speechSynthesis.getVoices();
    if (!hlasy.length) {          // Chrome načítá hlasy asynchronně
      await new Promise(ok => { speechSynthesis.addEventListener('voiceschanged', ok, { once: true }); setTimeout(ok, 1500); });
      hlasy = speechSynthesis.getVoices();
    }
    const najdi = j => hlasy.find(h => h.lang.toLowerCase().replace('_', '-').startsWith(j));
    const h = najdi(jazyk) || (jazyk === 'sk' ? najdi('cs') : null);
    if (!h) throw new Error('Prohlížeč nemá hlas pro ' + (NAZVY_JAZYKU[jazyk] || jazyk) + ' – doinstalujte ho v systému, nebo použijte stránku Předčítač.');
    return h;
  }
  function rekni(text, hlas) {
    return new Promise(ok => {
      const u = new SpeechSynthesisUtterance(text);
      u.voice = hlas; u.lang = hlas.lang; u.rate = 1;
      u.onend = u.onerror = () => ok();
      speechSynthesis.speak(u);
    });
  }
  /** fronta = [{ text, jazyk }]; zNahledu = předčítání se zastaví se zavřením náhledu. */
  async function predcitej(fronta, moznosti) {
    zastavCteni();
    const stav = cteni = Object.assign({ fronta, i: 0, zNahledu: $('#dlg-nahled').open }, moznosti);
    $('#nahled-cist').textContent = '⏹ Zastavit čtení';
    try {
      while (cteni === stav && stav.i < fronta.length) {
        const kus = fronta[stav.i];
        if (stav.popis) { $('#predcitani').hidden = false; $('#predcitani-text').textContent = '🔊 ' + (stav.i + 1) + '/' + fronta.length + ': ' + kus.popis; }
        await rekni(kus.text, await hlasPro(kus.jazyk));
        if (cteni !== stav) break;
        if (!stav.preskoc) stav.i++;
        stav.preskoc = false;
      }
    } catch (e) { Dialog.chyba(e.message); }
    if (cteni === stav) zastavCteni();
  }
  function zastavCteni() {
    if (!cteni) return;
    cteni = null;
    if (window.speechSynthesis) speechSynthesis.cancel();
    $('#predcitani').hidden = true;
    $('#nahled-cist').textContent = '🔊 Přečíst';
  }
  /** Předčítat titulky zobrazených zpráv od první viditelné – třeba ke snídani nebo večer se zhasnutým displejem. */
  function predcitejTitulky() {
    const vse = dlazdiceVPoradi();
    const od = Math.max(0, vse.findIndex(d => d.getBoundingClientRect().bottom > 60));
    const fronta = zobrazenaTemata.slice(od, od + 40).map(t => {
      const z = zdrojPol(t.hlavni);
      return { text: z.nazev + ': ' + t.hlavni.t, jazyk: z.jazyk || 'cs', popis: t.hlavni.t };
    });
    if (fronta.length) predcitej(fronta, { zNahledu: false, popis: true });
  }
  $('#predcitani-stop').addEventListener('click', zastavCteni);
  $('#predcitani-dalsi').addEventListener('click', () => {
    if (!cteni) return;
    cteni.i++; cteni.preskoc = true;
    speechSynthesis.cancel();          // ukončí aktuální větu → smyčka pokračuje další
  });

  // ---------- upozornění na zvýrazněná slova ----------
  let neprectenychUpozorneni = 0;
  const TITULEK = document.title;
  /** tise = jen si zapamatovat (start stránky, změna slov) – upozorňuje se jen na zprávy, které přibyly potom. */
  function zkontrolujUpozorneni(tise) {
    if (!N.zvyraznit.length || !data) return;
    const vybrane = vybraneZdroje();
    const nalezene = vsechnyPolozky().filter(p => vybrane.has(p.z) && !oznameno.has(p.i) && J.zvyraznena(p, N.zvyraznit));
    if (!nalezene.length) return;
    for (const p of nalezene) oznameno.set(p.i, ted());
    ulozMapu(K.oznameno, oznameno);
    if (tise || !N.upozorneni) return;
    nalezene.sort((a, b) => b.d - a.d);
    if (window.Notification && Notification.permission === 'granted') {
      for (const p of nalezene.slice(0, 3)) {
        try {
          const n = new Notification('🔔 ' + zdrojPol(p).nazev, { body: p.t, tag: 'zpravy-' + p.i, icon: '../icon-192.png' });
          n.onclick = () => { window.focus(); n.close(); ukazNahled(temaPro(p), p); };
        } catch (e) { /* v některých prohlížečích jen přes service worker – stačí hlášení na stránce */ }
      }
    }
    Dialog.info('🔔 ' + nalezene[0].t + (nalezene.length > 1 ? ' (+' + (nalezene.length - 1) + ' další)' : ''));
    if (document.hidden) { neprectenychUpozorneni += nalezene.length; document.title = '(' + neprectenychUpozorneni + ') ' + TITULEK; }
  }
  const temaPro = p => zobrazenaTemata.find(t => t.cleny.some(c => c.i === p.i)) || { id: p.i, hlavni: p, cleny: [p], zdroje: new Set([p.z]), d: p.d };

  // ---------- přenos do jiného zařízení (kód, soubor, QR) ----------
  async function zabal(obj) {
    const proud = new Blob([JSON.stringify(obj)]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    const b = new Uint8Array(await new Response(proud).arrayBuffer());
    let bin = '';
    for (const x of b) bin += String.fromCharCode(x);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  async function rozbal(kod) {
    const b64 = String(kod).trim().replace(/^.*#sync=/, '').replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '='.repeat((4 - b64.length % 4) % 4));
    const proud = new Blob([Uint8Array.from(bin, c => c.charCodeAt(0))]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return JSON.parse(await new Response(proud).text());
  }
  /** rozsah: 'vse' (i přečtené a skryté) | 'ulozene' (nastavení + uložené) | 'nastaveni' */
  function zaloha(rozsah) {
    const n = Object.assign({}, N);
    for (const k of Object.keys(n)) if (k.startsWith('_')) delete n[k];   // vnitřní stav (večer, souhrn) nepřenášet
    const z = { a: 'mozaika-zprav', v: 1, n };
    if (rozsah !== 'nastaveni') z.u = ulozene;
    if (rozsah === 'vse') { z.p = Object.fromEntries(precteno); z.s = Object.fromEntries(skryte); }
    return z;
  }
  async function prijmiZalohu(z) {
    if (!z || z.a !== 'mozaika-zprav' || typeof z.n !== 'object') throw new Error('Tohle není záloha Mozaiky zpráv.');
    const co = ['nastavení'].concat(z.u ? ['uložené (' + z.u.length + ')'] : [], z.p ? ['přečtené (' + Object.keys(z.p).length + ')'] : []);
    const proxy = typeof z.n.proxy === 'string' && z.n.proxy.trim();
    if (!await Dialog.potvrd('Načíst zálohu: ' + co.join(', ') + '? Nastavení se nahradí, uložené a přečtené se sloučí s těmi, co tu už máte.'
      + (proxy ? '\n\nPozor: záloha nastavuje proxy ' + proxy + ' – načítejte jen vlastní zálohy.' : ''), { ok: 'Načíst' })) return false;
    const n = {};
    for (const k of Object.keys(VYCHOZI)) if (k in z.n) n[k] = z.n[k];      // jen známé volby
    Object.keys(N).forEach(k => delete N[k]);
    Object.assign(N, JSON.parse(JSON.stringify(VYCHOZI)), n);
    ulozNastaveni();
    if (Array.isArray(z.u)) {
      const ids = new Set(ulozene.map(u => u.i));
      ulozene = ulozene.concat(z.u.filter(u => u && u.i && /^https?:/.test(u.u) && !ids.has(u.i))).slice(0, 300);
      uloz(K.ulozene, ulozene);
    }
    for (const [zdroj, mapa, klic] of [[z.p, precteno, K.precteno], [z.s, skryte, K.skryte]]) {
      if (!zdroj) continue;
      for (const [id, t] of Object.entries(zdroj)) if (!mapa.has(id)) mapa.set(id, +t || ted());
      ulozMapu(klic, mapa);
    }
    sestavZdroje(); planujObnovu(); hlidejVecer();
    if ($('#dlg-nastaveni').open) vyplnNastaveni();
    vykresli(true);
    Dialog.info('✓ Záloha načtena');
    return true;
  }
  $('#sync-kopirovat').addEventListener('click', async () => {
    const kod = await zabal(zaloha('vse'));
    try { await navigator.clipboard.writeText(kod); Dialog.info('📋 Kód zkopírován (' + kod.length.toLocaleString('cs') + ' znaků) – vložte ho na druhém zařízení'); }
    catch (e) { await Dialog.zeptej('Zkopírujte si kód (schránka není dostupná):', kod); }
  });
  $('#sync-vlozit').addEventListener('click', async () => {
    const kod = await Dialog.zeptej('Vložte kód zálohy z jiného zařízení:', '');
    if (!kod) return;
    try { await prijmiZalohu(await rozbal(kod)); } catch (e) { Dialog.chyba('Kód se nepodařilo načíst: ' + e.message); }
  });
  $('#sync-ulozit').addEventListener('click', () => {
    const a = el('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(zaloha('vse'), null, 1)], { type: 'application/json' }));
    a.download = 'mozaika-zprav-zaloha.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  $('#sync-nacist').addEventListener('click', () => $('#sync-soubor').click());
  $('#sync-soubor').addEventListener('change', async e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try { await prijmiZalohu(JSON.parse(await f.text())); } catch (err) { Dialog.chyba('Soubor se nepodařilo načíst: ' + err.message); }
  });
  let qrKnihovna = null;
  const nactiQR = () => qrKnihovna || (qrKnihovna = new Promise((ok, chyba) => {
    const sc = el('script');
    sc.src = 'lib/qrcode.min.js';
    sc.onload = () => ok(window.QRCode);
    sc.onerror = () => { qrKnihovna = null; chyba(new Error('knihovnu QR se nepodařilo načíst (offline?)')); };
    document.head.append(sc);
  }));
  $('#sync-qr').addEventListener('click', async () => {
    const box = $('#sync-qr-box'), info = $('#sync-qr-info');
    box.replaceChildren(); box.hidden = false;
    const zaklad = (MISTNI ? VEREJNA_ADRESA : location.href.split('#')[0]) + '#sync=';
    // QR spolehlivě čitelný z obrazovky do ~1 200 znaků: co se vejde – vše, bez přečtených, jen nastavení
    let url, popis;
    for (const [rozsah, p] of [['vse', 'nastavení, uložené i přečtené'], ['ulozene', 'nastavení a uložené články'], ['nastaveni', 'jen nastavení']]) {
      url = zaklad + await zabal(zaloha(rozsah)); popis = p;
      if (url.length <= 1200) break;
    }
    if (url.length > 1200) { info.textContent = 'Na QR kód je i samotné nastavení moc velké – použijte kód nebo soubor.'; return; }
    try {
      const QRCode = await nactiQR();
      new QRCode(box, { text: url, width: 360, height: 360, correctLevel: QRCode.CorrectLevel.L });
      info.textContent = 'Naskenujte telefonem – přenese se ' + popis + '.' + (MISTNI ? ' Odkaz vede na veřejný web.' : '');
    } catch (e) { info.textContent = 'QR kód se nepodařilo vytvořit: ' + e.message; }
  });

  // ---------- čtenářské zrcadlo (deník čtení jen v tomto prohlížeči) ----------
  let denikCteni = nacti(K.cteni, []);
  function zapisCteni(p) {
    denikCteni.push([ted(), p.z, p.r, pohoda() ? 'p' : 'z']);
    const hranice = ted() - 35 * 86400;
    if (denikCteni.length > 5000 || denikCteni[0][0] < hranice) denikCteni = denikCteni.filter(c => c[0] >= hranice).slice(-5000);
    uloz(K.cteni, denikCteni);
    hlidejDostPrecteno();
  }
  const ZPRAVODAJSKE = new Set(['cesko', 'svet', 'ekonomika', 'kraj']);
  function radekGrafu(popis, hodnota, max, text) {
    const r = el('div', 'graf-radek');
    const pruh = el('span', 'graf-pruh');
    const v = el('i');
    v.style.width = (max ? Math.round(100 * hodnota / max) : 0) + '%';
    pruh.append(v);
    r.append(el('span', 'graf-popis', popis), pruh, el('span', 'graf-hodnota', text == null ? String(hodnota) : text));
    return r;
  }
  function vykresliZrcadlo() {
    const box = $('#zrcadlo');
    box.replaceChildren();
    const od = ted() - 7 * 86400;
    const tyden = denikCteni.filter(c => c[0] >= od);
    if (!tyden.length) { box.append(el('p', 'pozn', 'Za posledních 7 dní tu zatím nejsou žádné přečtené zprávy (počítá se otevření náhledu nebo článku).')); return; }
    const zprav = tyden.filter(c => ZPRAVODAJSKE.has(c[2])).length;
    const vecer = tyden.filter(c => J.vIntervalu('21:00', '06:00', new Date(c[0] * 1000)));
    box.append(el('p', 'zrcadlo-souhrn', 'Za 7 dní ' + tyden.length + ' zpráv (∅ ' + Math.round(tyden.length / 7) + ' denně) · zpravodajství a politika '
      + Math.round(100 * zprav / tyden.length) + ' % · večer po 21:00 ' + vecer.length + ' zpráv'
      + (vecer.length ? ', z toho ' + Math.round(100 * vecer.filter(c => c[3] === 'p').length / vecer.length) + ' % v Zajímavostech' : '')));
    // dny
    box.append(el('h4', null, 'Po dnech'));
    const dny = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      const a = d.getTime() / 1000, b = a + 86400;
      dny.push([d.toLocaleDateString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric' }), tyden.filter(c => c[0] >= a && c[0] < b).length]);
    }
    const maxD = Math.max(...dny.map(x => x[1]));
    dny.forEach(([p, n]) => box.append(radekGrafu(p, n, maxD)));
    // rubriky
    box.append(el('h4', null, 'Podle rubrik'));
    const rub = new Map();
    for (const c of tyden) rub.set(c[2], (rub.get(c[2]) || 0) + 1);
    const maxR = Math.max(...rub.values());
    [...rub].sort((a, b) => b[1] - a[1]).forEach(([r, n]) => {
      const x = RUBRIKY.get(r) || { ikona: '', nazev: r };
      box.append(radekGrafu(x.ikona + ' ' + x.nazev, n, maxR, Math.round(100 * n / tyden.length) + ' %'));
    });
    // weby
    box.append(el('h4', null, 'Nejčtenější weby'));
    const web = new Map();
    for (const c of tyden) web.set(c[1], (web.get(c[1]) || 0) + 1);
    const maxW = Math.max(...web.values());
    [...web].sort((a, b) => b[1] - a[1]).slice(0, 8).forEach(([z, n]) => box.append(radekGrafu(zdrojPol({ z }).nazev, n, maxW)));
    // hodiny
    box.append(el('h4', null, 'Kdy čtete'));
    const hod = Array(24).fill(0);
    for (const c of tyden) hod[new Date(c[0] * 1000).getHours()]++;
    const maxH = Math.max(...hod);
    const hodiny = el('div', 'graf-hodiny');
    hod.forEach((n, h) => {
      const s = el('span');
      s.style.height = (maxH ? Math.max(2, Math.round(100 * n / maxH)) : 2) + '%';
      s.title = h + ':00–' + (h + 1) + ':00 · ' + n + ' zpráv';
      if (h >= 21 || h < 6) s.classList.add('noc');
      hodiny.append(s);
    });
    const osa = el('div', 'graf-osa');
    for (let h = 0; h < 24; h++) osa.append(el('span', null, h % 6 === 0 ? h + ':00' : ''));
    box.append(hodiny, osa);
  }
  $('#zrcadlo-smazat').addEventListener('click', async () => {
    if (!await Dialog.potvrd('Smazat historii čtení (statistiku zrcadla)?', { ok: 'Smazat' })) return;
    denikCteni = []; uloz(K.cteni, denikCteni); vykresliZrcadlo();
  });

  // ---------- „Dost pro dnešek“: večer po N přečtených zprávách jemně navrhnout konec ----------
  /** Začátek dnešního večera (unix s) podle nastavení, nebo 0 když teď není večer. */
  function zacatekVecera() {
    const d = new Date();
    if (!J.vIntervalu(N.autoOd, N.autoDo, d)) return 0;
    const [h, m] = N.autoOd.split(':').map(Number);
    const z = new Date(d); z.setHours(h, m, 0, 0);
    if (z > d) z.setDate(z.getDate() - 1);           // po půlnoci: večer začal včera
    return z.getTime() / 1000;
  }
  const prectenoOd = od => denikCteni.filter(c => c[0] >= od).length;
  /** Jednou za večer po dosažení prahu; „Ještě chvíli“ posune práh o 10 zpráv. */
  function hlidejDostPrecteno() {
    if (!N.dostLimit) return;
    const od = zacatekVecera();
    if (!od) return;
    const n = prectenoOd(od);
    const prah = N._dostVecer === od ? N._dostPrah : N.dostZprav;
    if (n < prah) return;
    N._dostVecer = od;
    N._dostPrah = Infinity;              // tento večer už ne (dokud nedá „Ještě chvíli“)
    ulozNastaveni();
    $('#dost-text').textContent = 'Dnes večer jste si přečetli už ' + n + ' zpráv. Zprávy počkají do rána – svět se do té doby obejde i bez vás.';
    const ukaz = () => $('#dlg-dost').showModal();
    if ($('#dlg-nahled').open) $('#dlg-nahled').addEventListener('close', ukaz, { once: true }); else ukaz();
  }
  $('#dost-jeste').addEventListener('click', () => {
    N._dostPrah = prectenoOd(N._dostVecer) + 10;
    ulozNastaveni();
    $('#dlg-dost').close();
  });
  $('#dost-noc').addEventListener('click', () => {
    $('#dlg-dost').close();
    zastavCteni();
    $('#dobrou-noc').hidden = false;
    $('#dobrou-noc').focus();
  });
  $('#dobrou-noc').addEventListener('click', () => { $('#dobrou-noc').hidden = true; });
  $('#dobrou-noc').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') { e.preventDefault(); $('#dobrou-noc').hidden = true; } });

  // ---------- ranní souhrn ----------
  /** Ráno (5–11 h) při prvním otevření dne: největší témata od večera. */
  async function ranniSouhrn(vynutit) {
    const d = new Date();
    const dnes = d.toDateString();
    if (!vynutit && (!N.ranniSouhrn || pohoda() || d.getHours() < 5 || d.getHours() >= 11 || N._souhrnDen === dnes)) return;
    if (!vynutit) {
      const rano = new Date(d); rano.setHours(5, 0, 0, 0);
      if (navsteva.minula && navsteva.minula * 1000 >= rano.getTime()) { N._souhrnDen = dnes; ulozNastaveni(); return; }   // dnes ráno už tu byl
    }
    const vecer = new Date(d); vecer.setDate(vecer.getDate() - (d.getHours() < 18 ? 1 : 0)); vecer.setHours(20, 0, 0, 0);
    const od = vecer.getTime() / 1000;
    if (nove && nove.od && nove.od > od) await nactiStarsi();          // noc je starší než 6 h
    const top = velkaTemata(od, 5);
    N._souhrnDen = dnes;
    ulozNastaveni();
    if (!top.length) { if (vynutit) Dialog.info('Od včerejšího večera se nic velkého nestalo.'); return; }
    $('#souhrn-od').textContent = 'Co se stalo od ' + vecer.toLocaleString('cs-CZ', { weekday: 'long', hour: '2-digit', minute: '2-digit' }) + ' – nejvíc psaná témata:';
    $('#souhrn-seznam').replaceChildren(...top.map((t, i) => {
      const b = el('button', 'souhrn-polozka');
      b.style.setProperty('--rb', barvaRubriky(t.hlavni.r));
      const veta = (t.hlavni.p || '').split(/(?<=[.!?…])\s+/)[0];
      b.append(el('span', 'souhrn-cislo', String(i + 1)), el('b', null, t.hlavni.t));
      if (veta && veta !== t.hlavni.t) b.append(el('span', 'souhrn-veta', veta.length > 220 ? veta.slice(0, 218) + '…' : veta));
      b.append(el('small', null, t.redakce.size + ' redakcí · ' + J.casRelativni(t.d, ted())));
      b.setAttribute('data-i18n', 'ne');
      b.addEventListener('click', () => { $('#dlg-souhrn').close(); ukazNahled(t, t.hlavni); });
      return b;
    }));
    $('#dlg-souhrn').showModal();
  }

  // ---------- instalace jako aplikace ----------
  let instalace = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); instalace = e; $('#instalovat').hidden = false; });
  $('#instalovat').addEventListener('click', async () => {
    if (!instalace) return;
    instalace.prompt();
    const v = await instalace.userChoice.catch(() => null);
    if (v && v.outcome === 'accepted') { $('#instalovat').hidden = true; Dialog.info('📲 Mozaika zpráv je na ploše'); }
    instalace = null;
  });
  // hlavní service worker webu (offline: stránka, skripty; data jsou v IndexedDB) – když je stránka otevřená jako aplikace
  // (v rozcestníku ho registruje index.html; tady jen pro samostatně otevřenou / nainstalovanou stránku)
  if ('serviceWorker' in navigator && window.top === window && (location.protocol === 'https:' || MISTNI)) navigator.serviceWorker.register('../sw.js').catch(() => {});

  // ---------- rozbalovací nabídky ----------
  let otevrena = null;
  function zavriNabidku() { if (otevrena) { otevrena.remove(); otevrena = null; } }
  /** polozky = pole nebo funkce, která ho vrací; u funkce zůstane nabídka po kliknutí na přepínač (✓) otevřená */
  function otevriNabidku(kotva, polozky, fokus) {
    const sestav = typeof polozky === 'function' ? polozky : null;
    zavriNabidku();
    const n = el('div', 'nabidka');
    n.setAttribute('role', 'menu');
    for (const pol of sestav ? sestav() : polozky) {
      if (!pol) { n.append(el('hr')); continue; }
      if (typeof pol === 'string') { n.append(el('div', 'titulek', pol)); continue; }
      const [text, akce, stav, pocet] = pol;
      const b = el('button', stav != null ? 'prep' : null, text);
      b.setAttribute('role', stav != null ? 'menuitemcheckbox' : 'menuitem');
      if (stav != null) b.setAttribute('aria-checked', String(!!stav)), b.setAttribute('aria-pressed', String(!!stav));
      if (pocet != null) b.append(el('span', 'n', String(pocet)));
      b.addEventListener('click', () => {
        const ponechat = sestav && stav != null;
        const i = [...n.querySelectorAll('button')].indexOf(b);
        zavriNabidku();
        akce();
        // znovu otevřít jen tam, kde je vidět (ne pod nově otevřeným oknem)
        if (ponechat && (kotva.closest('dialog') || !document.querySelector('dialog[open]'))) otevriNabidku(kotva, sestav, i);
      });
      n.append(b);
    }
    n._z = kotva;
    (kotva.closest('dialog') || document.body).append(n);
    const r = kotva.getBoundingClientRect();
    const sirka = n.offsetWidth, vyska = n.offsetHeight;
    n.style.left = Math.max(6, Math.min(r.left, document.documentElement.clientWidth - sirka - 6)) + 'px';   // bez posuvníku
    n.style.top = (r.bottom + 4 + vyska > innerHeight ? Math.max(6, r.top - vyska - 4) : r.bottom + 4) + 'px';
    otevrena = n;
    (n.querySelectorAll('button')[fokus || 0] || n.querySelector('button'))?.focus();
  }
  document.addEventListener('pointerdown', e => { if (otevrena && !otevrena.contains(e.target) && !e.target.closest('[data-nabidka], #nahled-vice, .rub-web')) zavriNabidku(); });

  const NABIDKY = {
    rubrika: nabidkaRubrik,
    zobrazeni: () => {
      const nastav = (k, v) => () => { N[k] = v; ulozNastaveni(); vykresli(true); };   // nabídka se po přepnutí znovu sestaví
      return [
        'Rozložení',
        ['🧩 Mozaika', nastav('zobrazeni', 'mozaika'), N.zobrazeni === 'mozaika'],
        ['📋 Seznam s náhledy', nastav('zobrazeni', 'seznam'), N.zobrazeni === 'seznam'],
        ['📰 Jen titulky', nastav('zobrazeni', 'titulky'), N.zobrazeni === 'titulky'],
        null,
        ['Hustší mozaika', nastav('husta', !N.husta), N.husta],
        ['Obrázky', nastav('obrazky', !N.obrazky), N.obrazky],
        ['Spojovat stejné zprávy do témat', nastav('seskupit', !N.seskupit), N.seskupit],
        ['Hlavní témata nahoře', nastav('temata', !N.temata), N.temata],
        ['Jen nepřečtené', nastav('jenNeprectene', !N.jenNeprectene), N.jenNeprectene],
        ['🎣 Skrývat lákavé titulky (clickbait)', nastav('bezClickbaitu', !N.bezClickbaitu), N.bezClickbaitu],
        null,
        ['☀️ Ranní souhrn', () => ranniSouhrn(true)],
        null,
        ['🔊 Předčítat titulky odsud', predcitejTitulky],
        ['✓ Označit vše zobrazené jako přečtené', () => {
          for (const t of zobrazenaTemata) for (const c of t.cleny) if (!precteno.has(c.i)) precteno.set(c.i, ted());
          ulozMapu(K.precteno, precteno); vykresliBezSkoku();
        }],
      ];
    },
  };
  document.querySelectorAll('[data-nabidka]').forEach(tl => tl.addEventListener('click', () => {
    if (otevrena && otevrena._z === tl) { zavriNabidku(); return; }
    otevriNabidku(tl, NABIDKY[tl.dataset.nabidka]);
  }));

  // ---------- rubriky po webech (např. Blesk jen bulvár) ----------
  /** Rubriky, ve kterých web píše (kanály katalogu + skutečná data). */
  function rubrikyWebu(zid) {
    const r = new Set(((ZDROJE.get(zid) || {}).kanaly || []).map(k => k.rubrika));
    for (const p of data ? data.polozky : []) if (p.z === zid) r.add(p.r);
    return katalog.rubriky.filter(x => r.has(x.id));
  }
  const povoleneRubriky = zid => (N.rubrikyZdroju[zid] ? N.rubrikyZdroju[zid].slice() : null);
  function nastavRubrikyWebu(zid, seznam) {
    const vse = rubrikyWebu(zid).map(r => r.id);
    if (!seznam || vse.every(r => seznam.includes(r))) delete N.rubrikyZdroju[zid];
    else N.rubrikyZdroju[zid] = seznam;
    ulozNastaveni();
    if ($('#dlg-nastaveni').open) obnovTlacitkoRubrik(zid); else vykresliBezSkoku();
  }
  /** Jen tlačítko 🗂️ u webu – celý seznam ne, jinak by se zavřela nabídka ukotvená k tlačítku. */
  function obnovTlacitkoRubrik(zid, tl) {
    tl = tl || document.querySelector('.rub-web[data-z="' + CSS.escape(zid) + '"]');
    if (!tl) return;
    const pov = povoleneRubriky(zid);
    tl.textContent = pov ? '🗂️ ' + pov.length : '🗂️';
    tl.classList.toggle('omezeno', !!pov);
    tl.title = pov ? 'Zobrazuje se jen ' + pov.map(r => (RUBRIKY.get(r) || {}).nazev).join(', ') : 'Které rubriky z tohoto webu zobrazovat';
  }
  /** Nabídka (funkce → po zaškrtnutí zůstane otevřená). */
  const nabidkaRubrikWebu = zid => () => {
    const vse = rubrikyWebu(zid);
    const pov = povoleneRubriky(zid);
    return [
      'Rubriky z webu ' + zdrojPol({ z: zid }).nazev,
      ...vse.map(r => [r.ikona + ' ' + r.nazev, () => {
        const akt = povoleneRubriky(zid) || vse.map(x => x.id);
        nastavRubrikyWebu(zid, akt.includes(r.id) ? akt.filter(x => x !== r.id) : akt.concat(r.id));
      }, !pov || pov.includes(r.id)]),
      null,
      ['Všechny rubriky', () => nastavRubrikyWebu(zid, null)],
    ];
  };

  /** Spolehlivost webu za posledních ~24 h z historie stahování ('1' ok, 'c' část kanálů, '0' nic). */
  function spolehlivost(zid) {
    const h = data && data.historie && data.historie[zid];
    if (!h || h.length < 6) return null;
    const body = [...h].reduce((s, c) => s + (c === '1' ? 1 : c === 'c' ? 0.5 : 0), 0);
    return { pct: Math.round(100 * body / h.length), hodin: Math.max(1, Math.round(h.length / 3)) };
  }
  const problemovy = zid => { const s = spolehlivost(zid); return s && s.pct < 90; };
  let jenProblemove = false;

  // ---------- nastavení ----------
  function otevriNastaveni(karta) {
    prepniKartu(karta || 'zdroje');
    vyplnNastaveni();
    $('#dlg-nastaveni').showModal();
  }
  function prepniKartu(id) {
    document.querySelectorAll('#dlg-nastaveni [data-karta]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.karta === id)));
    document.querySelectorAll('#dlg-nastaveni [data-panel]').forEach(p => { p.hidden = p.dataset.panel !== id; });
  }
  document.querySelectorAll('#dlg-nastaveni [data-karta]').forEach(b => b.addEventListener('click', () => prepniKartu(b.dataset.karta)));
  document.querySelectorAll('dialog [data-zavrit]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
  document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));
  $('#dlg-nastaveni').addEventListener('close', () => { sestavZdroje(); vykresliBezSkoku(); });

  function zmenVyber(fn) {
    const s = new Set([...vybraneZdroje()].filter(z => ZDROJE.get(z) && !ZDROJE.get(z).vlastni));
    fn(s);
    N.zdroje = [...s];
    ulozNastaveni();
    vyplnZdroje();
  }

  function vyplnNastaveni() {
    vyplnZdroje();
    const JAZYKY = [['cs', '🇨🇿 česky'], ['sk', '🇸🇰 slovensky'], ['en', '🇬🇧 anglicky']];
    $('#volby-jazyku').replaceChildren(...JAZYKY.map(([j, nazev]) => zaskrtavatko(nazev, N.jazyky.includes(j), on => {
      N.jazyky = on ? [...new Set(N.jazyky.concat(j))] : N.jazyky.filter(x => x !== j);
      ulozNastaveni();
    })));
    $('#auto-pohoda').checked = N.autoPohoda;
    $('#ranni-souhrn').checked = N.ranniSouhrn;
    $('#dost-limit').checked = N.dostLimit;
    $('#dost-zprav').value = N.dostZprav;
    $('#bez-clickbaitu').checked = N.bezClickbaitu;
    $('#muj-kraj').replaceChildren(...[{ id: '', nazev: '— regionální zprávy nezobrazovat —' }, ...(katalog.kraje || [])].map(k => { const o = el('option', null, k.nazev); o.value = k.id; return o; }));
    $('#muj-kraj').value = N.mujKraj || '';
    vykresliZrcadlo();
    $('#auto-od').value = N.autoOd; $('#auto-do').value = N.autoDo;
    $('#pohoda-politika').checked = N.pohodaBezPolitiky;
    $('#pohoda-negativni').checked = N.pohodaBezNegativnich;
    $('#pohoda-tlumene').checked = N.pohodaTlumene;
    $('#upozorneni').checked = N.upozorneni;
    $('#ztlumit').value = N.ztlumit.join('\n');
    $('#zvyraznit').value = N.zvyraznit.join('\n');
    $('#pocet-skrytych').textContent = 'Skrytých článků: ' + skryte.size;
    $('#proxy').value = N.proxy;
    $('#obnova').value = String(N.obnova);
    $('#vlastni-rubrika').replaceChildren(...katalog.rubriky.map(r => { const o = el('option', null, r.nazev); o.value = r.id; return o; }));
    vyplnVlastni();
    vyplnStavZdroju();
  }

  function zaskrtavatko(text, zapnuto, priZmene) {
    const l = el('label');
    const i = el('input'); i.type = 'checkbox'; i.checked = zapnuto;
    i.addEventListener('change', () => priZmene(i.checked));
    l.append(i, document.createTextNode(text));
    return l;
  }

  function vyplnZdroje() {
    const vybrane = vybraneZdroje();
    const hledat = J.normalizuj($('#hledat-zdroj').value.trim());
    const box = $('#zdroje-skupiny');
    box.replaceChildren();
    const stav = (data && data.zdroje) || {};
    const pocty = new Map();
    for (const p of (data ? data.polozky : [])) pocty.set(p.z, (pocty.get(p.z) || 0) + 1);
    for (const sk of katalog.skupiny) {
      const zdroje = katalog.zdroje.filter(z => z.skupina === sk.id && (!hledat || J.normalizuj(z.nazev + ' ' + z.web).includes(hledat))
        && (!jenProblemove || problemovy(z.id) || (stav[z.id] && !stav[z.id].ok)));
      if (!zdroje.length) continue;
      const h = el('h3', null, sk.nazev + ' ');
      h.append(el('span', 'n', '(' + zdroje.filter(z => vybrane.has(z.id)).length + '/' + zdroje.length + ')'));
      const vse = el('button', 'tl mini', 'vše'), nic = el('button', 'tl mini', 'nic');
      vse.style.marginLeft = 'auto';
      vse.addEventListener('click', () => zmenVyber(s => zdroje.forEach(z => s.add(z.id))));
      nic.addEventListener('click', () => zmenVyber(s => zdroje.forEach(z => s.delete(z.id))));
      h.append(vse, nic);
      const mrizka = el('div', 'zdroje-mrizka');
      for (const z of zdroje) {
        const l = el('label', 'zdroj-volba');
        const i = el('input'); i.type = 'checkbox'; i.checked = vybrane.has(z.id);
        i.addEventListener('change', () => zmenVyber(s => i.checked ? s.add(z.id) : s.delete(z.id)));
        const rubriky = [...new Set(z.kanaly.map(k => k.rubrika))].map(r => (RUBRIKY.get(r) || {}).nazev).join(', ');
        const jm = el('span', 'jm', z.nazev);
        l.title = z.web + '\nRubriky: ' + rubriky + (z.jazyk !== 'cs' ? '\nJazyk: ' + z.jazyk : '');
        const s = stav[z.id];
        const sp = spolehlivost(z.id);
        const info = el('span', 'info', s ? (s.ok ? (pocty.get(z.id) || 0) + ' zpr.' : '⚠ nedostupný') : '');
        if (sp && sp.pct < 90) {
          info.textContent = '⚠ ' + sp.pct + ' %';
          info.title = 'Za posledních ~' + sp.hodin + ' h se web podařilo stáhnout jen v ' + sp.pct + ' % pokusů' + (s && s.chyba ? '\n' + s.chyba : '');
        } else if (s && s.chyba) info.title = s.chyba;
        info.classList.toggle('chyba', !!(s && !s.ok) || !!(sp && sp.pct < 90));
        const tlR = el('button', 'tl mini rub-web');
        tlR.dataset.z = z.id;
        obnovTlacitkoRubrik(z.id, tlR);
        tlR.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); otevriNabidku(tlR, nabidkaRubrikWebu(z.id)); });
        l.append(i, znak(z), jm, info, tlR);
        mrizka.append(l);
      }
      box.append(h, mrizka);
    }
    $('#zdroje-souhrn').textContent = 'Sledujete ' + [...vybrane].filter(z => !(ZDROJE.get(z) || {}).vlastni).length + ' z ' + katalog.zdroje.length + ' webů'
      + (N.vlastni.length ? ' a ' + N.vlastni.length + ' vlastních kanálů' : '') + (N.zdroje ? '.' : ' (výchozí výběr).');
  }
  $('#hledat-zdroj').addEventListener('input', vyplnZdroje);
  $('#zdroje-vychozi').addEventListener('click', () => { N.zdroje = null; ulozNastaveni(); vyplnZdroje(); });
  $('#zdroje-vse').addEventListener('click', () => zmenVyber(s => katalog.zdroje.forEach(z => s.add(z.id))));
  $('#zdroje-nic').addEventListener('click', () => zmenVyber(s => s.clear()));
  $('#zdroje-problemove').addEventListener('click', () => {
    jenProblemove = !jenProblemove;
    $('#zdroje-problemove').setAttribute('aria-pressed', String(jenProblemove));
    vyplnZdroje();
  });

  const radky = t => [...new Set(t.split('\n').map(s => s.trim()).filter(Boolean))];
  $('#ztlumit').addEventListener('change', e => { N.ztlumit = radky(e.target.value); ulozNastaveni(); });
  $('#zvyraznit').addEventListener('change', e => { N.zvyraznit = radky(e.target.value); ulozNastaveni(); zkontrolujUpozorneni(true); });
  $('#upozorneni').addEventListener('change', async e => {
    N.upozorneni = e.target.checked;
    ulozNastaveni();
    if (!N.upozorneni) return;
    zkontrolujUpozorneni(true);                    // na staré zprávy neupozorňovat
    if (!window.Notification) { Dialog.info('Prohlížeč oznámení neumí – upozornění se ukážou jen na stránce.'); return; }
    let povoleni = Notification.permission;
    if (povoleni === 'default') { try { povoleni = await Notification.requestPermission(); } catch (err) { povoleni = 'denied'; } }
    if (povoleni !== 'granted') Dialog.info('Oznámení nejsou povolená – upozornění se ukážou jen na stránce.');
  });
  const volbaVecera = (id, klic) => $(id).addEventListener('change', e => { N[klic] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; ulozNastaveni(); });
  volbaVecera('#pohoda-politika', 'pohodaBezPolitiky');
  volbaVecera('#pohoda-negativni', 'pohodaBezNegativnich');
  volbaVecera('#pohoda-tlumene', 'pohodaTlumene');
  volbaVecera('#ranni-souhrn', 'ranniSouhrn');
  volbaVecera('#dost-limit', 'dostLimit');
  volbaVecera('#bez-clickbaitu', 'bezClickbaitu');
  $('#dost-zprav').addEventListener('change', e => { N.dostZprav = Math.max(3, Math.min(200, +e.target.value || 15)); e.target.value = N.dostZprav; ulozNastaveni(); });
  $('#muj-kraj').addEventListener('change', e => {
    N.mujKraj = e.target.value || null;
    if (N.mujKraj) N.skryteRubriky = N.skryteRubriky.filter(r => r !== 'kraj');   // vybral kraj → v Zprávách ho ukázat
    ulozNastaveni();
  });
  for (const [id, klic] of [['#auto-pohoda', 'autoPohoda'], ['#auto-od', 'autoOd'], ['#auto-do', 'autoDo']]) {
    $(id).addEventListener('change', e => {
      N[klic] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
      N._autoStav = null;            // nový interval vyhodnotit hned
      ulozNastaveni(); hlidejVecer();
    });
  }
  $('#proxy').addEventListener('change', e => { N.proxy = e.target.value.trim(); ulozNastaveni(); });
  $('#obnova').addEventListener('change', e => { N.obnova = +e.target.value; ulozNastaveni(); planujObnovu(); });
  $('#obnovit-skryte').addEventListener('click', () => { skryte.clear(); ulozMapu(K.skryte, skryte); $('#pocet-skrytych').textContent = 'Skrytých článků: 0'; });
  $('#smazat-prectene').addEventListener('click', async () => {
    if (!await Dialog.potvrd('Zapomenout, které články jste četli?')) return;
    precteno.clear(); ulozMapu(K.precteno, precteno); Dialog.info('Hotovo');
  });
  $('#smazat-ulozene').addEventListener('click', async () => {
    if (!await Dialog.potvrd('Smazat všech ' + ulozene.length + ' uložených článků?', { ok: 'Smazat' })) return;
    ulozene = []; uloz(K.ulozene, ulozene); Dialog.info('Uložené články smazány');
  });
  $('#obnovit-vychozi').addEventListener('click', async () => {
    if (!await Dialog.potvrd('Vrátit výběr webů, filtry i zobrazení na výchozí? Vlastní kanály se smažou.')) return;
    Object.keys(N).forEach(k => delete N[k]);
    Object.assign(N, JSON.parse(JSON.stringify(VYCHOZI)));
    ulozNastaveni(); sestavZdroje(); vyplnNastaveni(); planujObnovu();
  });

  function vyplnVlastni() {
    const box = $('#vlastni-seznam');
    box.replaceChildren();
    if (!N.vlastni.length) box.append(el('p', 'pozn', 'Zatím žádné vlastní kanály.'));
    for (const v of N.vlastni) {
      const r = el('div', 'vlastni-radek');
      const s = vlastniStav[v.id];
      r.append(znak(ZDROJE.get(v.id) || { nazev: v.nazev, id: v.id }), el('b', null, v.nazev), el('span', 'url', v.url),
        el('span', 'pozn', s ? (s.ok ? '✓ ' + s.pocet + ' zpr.' : '⚠ ' + s.chyba) : ''));
      const smaz = el('button', 'tl mini', 'Odebrat');
      smaz.addEventListener('click', () => {
        N.vlastni = N.vlastni.filter(x => x.id !== v.id);
        vlastniPolozky = vlastniPolozky.filter(p => p.z !== v.id);
        ulozNastaveni(); sestavZdroje(); vyplnVlastni();
      });
      r.append(smaz);
      box.append(r);
    }
  }
  $('#vlastni-form').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target;
    const v = { id: 'v_' + J.hash(f.url.value.trim()).toString(36), nazev: f.nazev.value.trim(), url: f.url.value.trim(), rubrika: f.rubrika.value };
    if (N.vlastni.some(x => x.url === v.url)) { Dialog.chyba('Tento kanál už máte.'); return; }
    const tl = f.querySelector('button');
    tl.disabled = true; tl.textContent = 'Zkouším…';
    try {
      const pol = await nactiKanal(v);
      if (!pol.length) throw new Error('V kanálu nejsou žádné články.');
      N.vlastni.push(v);
      ulozNastaveni(); sestavZdroje();
      vlastniStav[v.id] = { ok: true, pocet: pol.length };
      vlastniPolozky = vlastniPolozky.filter(p => p.z !== v.id).concat(pol);
      f.reset();
      vyplnVlastni();
      Dialog.info('Přidáno: ' + v.nazev + ' (' + pol.length + ' článků)');
    } catch (err) {
      Dialog.chyba('Kanál se nepodařilo načíst: ' + err.message);
    } finally { tl.disabled = false; tl.textContent = 'Vyzkoušet a přidat'; }
  });

  function vyplnStavZdroju() {
    const box = $('#stav-zdroju');
    if (!data || !data.vygenerovano) { box.textContent = 'Data zatím nejsou načtená.'; return; }
    const chyby = Object.entries(data.zdroje || {}).filter(([, s]) => !s.ok);
    const dlouho = katalog.zdroje.filter(z => problemovy(z.id)).map(z => z.nazev + ' ' + spolehlivost(z.id).pct + ' %');
    box.textContent = 'Stažení z ' + new Date(data.vygenerovano * 1000).toLocaleString('cs-CZ') + ': '
      + (Object.keys(data.zdroje || {}).length - chyby.length) + ' webů v pořádku'
      + (chyby.length ? ', teď nedostupné: ' + chyby.map(([z, s]) => zdrojPol({ z }).nazev + ' (' + (s.chyba || '?').slice(0, 80) + ')').join('; ') : '')
      + (dlouho.length ? '. Dlouhodobě nespolehlivé (úspěšnost za ~24 h): ' + dlouho.join(', ') + ' – zvažte jejich vypnutí.' : '.');
  }

  // ---------- horní lišta ----------
  $('#tl-obnovit').addEventListener('click', () => obnov(true));
  $('#tl-nastaveni').addEventListener('click', () => otevriNastaveni());
  $('#tl-ulozene').addEventListener('click', () => {
    rezimUlozene = !rezimUlozene;
    $('#tl-ulozene').setAttribute('aria-pressed', String(rezimUlozene));
    vykresli(true); window.scrollTo({ top: 0 });
  });
  let casHledani;
  $('#hledat').addEventListener('input', () => {
    clearTimeout(casHledani);
    casHledani = setTimeout(() => vykresli(true), 200);
    if ($('#hledat').value.trim()) nactiStarsi();          // hledat i ve starších zprávách
  });
  function otevriHledani() {
    $('#hledat-box').classList.add('otevreno');
    $('#hledat').tabIndex = 0;
    $('#hledat').focus();
  }
  function zavriHledani(vycistit) {
    if (vycistit && $('#hledat').value) { $('#hledat').value = ''; vykresli(true); }
    if ($('#hledat').value) return;
    $('#hledat-box').classList.remove('otevreno');
    $('#hledat').tabIndex = -1;
  }
  $('#tl-hledat').addEventListener('click', () => {
    if ($('#hledat-box').classList.contains('otevreno')) zavriHledani(true); else otevriHledani();
  });
  $('#hledat').addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== $('#tl-hledat')) zavriHledani(false); }, 150));
  $('#hledat').addEventListener('keydown', e => { if (e.key === 'Escape') { zavriHledani(true); $('#tl-hledat').focus(); } });

  // výška lišty pro lepivé rubriky (lišta se na úzkém displeji zalamuje)
  const nastavVysku = () => document.documentElement.style.setProperty('--vyska-listy', $('#lista').offsetHeight + 'px');
  new ResizeObserver(nastavVysku).observe($('#lista'));

  // ---------- klávesy ----------
  function dlazdiceVPoradi() { return [...document.querySelectorAll('#osa .dl')]; }
  function aktualniDlazdice() { return document.activeElement && document.activeElement.closest && document.activeElement.closest('#osa .dl'); }
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && otevrena) { zavriNabidku(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.querySelector('dialog[open]')) return;
    const vPoli = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    if (vPoli) return;
    const k = e.key.toLowerCase();
    const dl = aktualniDlazdice();
    if (k === 'j' || k === 'k') {
      const vse = dlazdiceVPoradi();
      if (!vse.length) return;
      let i = dl ? vse.indexOf(dl) + (k === 'j' ? 1 : -1) : 0;
      if (i >= vse.length && !$('#tl-dalsi').hidden) { pridejDavku(); return; }
      i = Math.max(0, Math.min(vse.length - 1, i));
      vse[i].querySelector('.dl-odkaz').focus();
      vse[i].scrollIntoView({ block: 'center', behavior: 'smooth' });
      e.preventDefault();
    } else if ((k === 'o' || e.key === 'Enter') && dl) { e.preventDefault(); ukazNahled(dl._tema, dl._tema.hlavni); }
    else if (k === 's' && dl) prepniUlozeni(dl._tema.hlavni);
    else if (k === 'h' && dl) skryj(dl._tema);
    else if (e.key === '/') { e.preventDefault(); otevriHledani(); }
    else if (k === 'r') obnov(true);
    else if (e.key === '?') otevriNastaveni('napoveda');
    else if (k === 'm') prepniRezim(pohoda() ? 'zpravy' : 'pohoda');
    else if (k === 'p') { if (cteni) zastavCteni(); else predcitejTitulky(); }
  });

  // ---------- obnova ----------
  let casovac;
  function planujObnovu() {
    clearInterval(casovac);
    if (N.obnova > 0) casovac = setInterval(() => { if (!document.hidden) obnov(false); }, N.obnova * 60000);
  }
  setInterval(() => { aktualizujStavObnovy(); aktualizujCasy(); hlidejVecer(); }, 60000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && neprectenychUpozorneni) { neprectenychUpozorneni = 0; document.title = TITULEK; }
    if (document.hidden) oznacNavstevu();
    else if (data && N.obnova > 0 && ted() - data.vygenerovano > N.obnova * 60 + 20 * 60) obnov(false);
  });

  // ---------- start ----------
  (async function start() {
    try {
      await nactiKatalog();
    } catch (e) {
      hlaseni({ chyba: true, text: 'Nepodařilo se načíst katalog webů (zpravy/zdroje.json): ' + e.message });
      return;
    }
    hlidejVecer();
    [nove, starsi] = await Promise.all([DB.cti('nove'), DB.cti('starsi')]);
    if (nove) { slozData(); vykresli(true); aktualizujStavObnovy(); }
    await obnov(true, true);
    planujObnovu();
    if (zmeskaneOdKdy() && zmeskaneOdKdy() < ted() - 6 * 3600) nactiStarsi();   // „co jste zmeškali“ potřebuje i starší zprávy
    ranniSouhrn(false);
    // příchozí odkaz z QR / kódu: #sync=…
    const m = location.hash.match(/[#&]sync=([A-Za-z0-9_-]+)/);
    if (m) {
      history.replaceState(null, '', location.pathname + location.search);
      try { await prijmiZalohu(await rozbal(m[1])); } catch (e) { Dialog.chyba('Odkaz se zálohou se nepodařilo načíst: ' + e.message); }
    }
  })();

  // pro testy
  window.ZPRAVY_STRANKA = {
    stav: () => ({ N, data, nove, starsi, zobrazenaTemata, vykreslenoDo, zivePolozky, ziveKanalu, oznameno, cteni }),
    obnov, vykresli, hlidejVecer, nactiStarsi, ranniSouhrn, hlidejDostPrecteno, vykresliZrcadlo, zapisCteni, zabal, rozbal, zaloha, zkontrolujUpozorneni, navsteva,
  };
})();

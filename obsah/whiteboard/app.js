/* ============================================================
   whiteboard/app.js – ovládání tabule (plátno, nástroje, schránka,
   spojnice, rámy a prezentace, úložiště v IndexedDB, galerie).
   Model a kreslení objektů je v whiteboard/jadro.js (WB_JADRO),
   šablony v whiteboard/sablony.js (WB_SABLONY).
   ============================================================ */
(function () {
  'use strict';
  const J = window.WB_JADRO, SABLONY = window.WB_SABLONY;
  const $ = id => document.getElementById(id);
  const platno = $('platno'), ctx = platno.getContext('2d'), plocha = $('plocha');
  const vrstvaKurzoru = $('vrstvaKurzoru'), kctx = vrstvaKurzoru.getContext('2d');      // stopa pera bez překreslení tabule

  const merCtx = document.createElement('canvas').getContext('2d');
  J.nastavMereni((t, vel, pis) => { merCtx.font = `${vel}px ${J.PISMA[pis] || J.PISMA.sans}`; return merCtx.measureText(t).width; });

  const MRIZKA = 25;
  const MAX_HISTORIE = 100;
  const MAX_OBR = 3000;            // delší strana vloženého obrázku (px), větší se zmenší
  const NEUTRALNI = ['#1e1e1e', '#e0e0e0', '#ffffff', '#000000'];
  const PALETA = ['#1e1e1e', '#e0e0e0', '#ff5252', '#ff9800', '#ffd93d', '#6bcb77', '#2e9e4f', '#6aa6fd', '#2862bb', '#9c27b0', '#ff80ab', '#8d6e63'];
  const DALSI_TVARY = ['zaobleny', 'trojuhelnik', 'sestiuhelnik', 'hvezda', 'lomena', 'krivka'];
  const NAZVY_NASTROJU = {
    vyber: 'Výběr', ruka: 'Posun plochy', pero: 'Pero', zvyr: 'Zvýrazňovač', guma: 'Guma', cara: 'Čára', sipka: 'Šipka',
    obdelnik: 'Obdélník', elipsa: 'Elipsa', kosoctverec: 'Kosočtverec', zaobleny: 'Zaoblený obdélník', trojuhelnik: 'Trojúhelník',
    sestiuhelnik: 'Šestiúhelník', hvezda: 'Hvězda', text: 'Text', listek: 'Lístek', vypln: 'Kbelík', laser: 'Laser', ram: 'Rám',
    pipeta: 'Pipeta', lomena: 'Lomená čára', krivka: 'Křivka', pruhl: 'Barva → průhledná'
  };
  const KURZORY = { vyber: 'vyber', ruka: 'ruka', text: 'text', vypln: 'vypln', guma: 'guma', pero: 'stopa', zvyr: 'stopa' };
  // nástroje, u kterých se kolem kurzoru kreslí stopa budoucí čáry (pero/zvýrazňovač místo kurzoru, čáry ke křížku)
  const NEKRESLI = new Set(['vyber', 'ruka', 'pipeta', 'laser', 'guma', 'pruhl']);     // nástroje, které nic nepřidávají
  const STOPA = new Set(['pero', 'zvyr', 'cara', 'sipka', 'lomena', 'krivka']);
  const KLAVESY = { v: 'vyber', p: 'pero', h: 'zvyr', x: 'guma', l: 'cara', a: 'sipka', r: 'obdelnik', e: 'elipsa', d: 'kosoctverec', t: 'text', n: 'listek', f: 'vypln', k: 'laser', m: 'ram', i: 'pipeta', o: 'lomena', u: 'krivka' };
  const KLIC_NASTAVENI = 'webapp_whiteboard_nastaveni';
  const STARY_KLIC = 'whiteboard_drawings';
  const UPRAVITELNE = ['text', 'listek', 'tvar', 'cara'];

  // ---------- stav ----------
  let tabule = null;
  let seznam = [];                  // přehled tabulí {id, nazev, vytvoreno, upraveno, nahled}
  let vyber = new Set();            // id vybraných objektů
  let nastroj = 'pero';
  const styl = { barva: '#e0e0e0', sirka: 3, alfa: 1, vypln: false, styl: 'plna', sipkaZ: false, sipkaK: true, pismo: 'sans', velikost: 24, trasa: 'prima',
    stetec: 'fix', vyhlazeni: 3, rozpoznat: false, symetrie: 'ne', mezery: 2, tolPruhl: 15, souvisle: false };
  // které skupiny pruhu vlastností patří k nástroji / k typu vybraného objektu
  const TVAR_PRUH = ['sirka', 'alfa', 'vypln', 'styl', 'pismo'];
  const PRUH_NASTROJE = {
    pero: ['sirka', 'alfa', 'kresba'], zvyr: ['sirka', 'alfa', 'kresba'], guma: ['sirka'],
    cara: ['sirka', 'alfa', 'styl', 'sipky', 'pismo'], sipka: ['sirka', 'alfa', 'styl', 'sipky', 'pismo'],
    lomena: ['sirka', 'alfa', 'vypln', 'styl'], krivka: ['sirka', 'alfa', 'vypln', 'styl'],
    text: ['alfa', 'pismo'], listek: ['pismo'], vypln: ['alfa', 'kbelik'], pruhl: ['pruhl']
  };
  const PRUH_TYPU = {
    tah: ['sirka', 'alfa', 'kresba'], cara: ['sirka', 'alfa', 'styl', 'sipky', 'pismo'], tvar: TVAR_PRUH,
    krivka: ['sirka', 'alfa', 'vypln', 'styl'], text: ['alfa', 'pismo'], listek: ['alfa', 'pismo'], obr: ['alfa', 'obrazek'], oblast: ['alfa']
  };
  let pruhledne = false;
  let minimapa = innerWidth > 700;
  let panelVrstev = false;
  let zpet = [], vpred = [], stavJSON = '[]';
  let akce = null;                  // probíhající tah myší
  let editor = null;                // {o, el}
  let laser = [];
  const mys = { x: 0, y: 0, uvnitr: false, typ: 'mouse' };
  let mezernik = false;
  let vlozeni = 0;                  // posun opakovaně vložených objektů
  let akcent = '#6aa6fd';
  let prezentace = null;            // {snimky, i, kamera, nastroj}
  let kontextZamceny = null;
  let casovacSipek = 0;
  let kontextBod = null, bodPrikazu = null;   // místo pravého kliku pro „Vložit“ z kontextové nabídky
  let predPipetou = 'pero';
  let symStred = null;              // střed symetrického kreslení (svět)

  const kam = () => tabule.kamera;
  const sirkaPlochy = () => platno.clientWidth, vyskaPlochy = () => platno.clientHeight;
  const naSvet = (sx, sy) => ({ x: sx / kam().z + kam().x, y: sy / kam().z + kam().y });
  const naObr = (x, y) => ({ x: (x - kam().x) * kam().z, y: (y - kam().y) * kam().z });
  const prichyt = v => tabule.prichytit && tabule.mrizka !== 'ne' ? Math.round(v / MRIZKA) * MRIZKA : v;
  const vybrane = () => tabule.objekty.filter(o => vyber.has(o.id));
  const info = t => window.Dialog ? Dialog.info(t) : console.log(t);
  const chyba = t => window.Dialog ? Dialog.chyba(t) : console.error(t);
  const tmaveTema = () => J.jas(getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()) < 0.5;
  // vrstvy: mapa id → vrstva; objekt ve skryté nebo zamčené vrstvě se nedá vybrat ani měnit
  let mapaVrstev = new Map();
  const vrstvaObjektu = o => mapaVrstev.get(o.vrstva);
  const vrstvaNepristupna = o => { const v = mapaVrstev.get(o.vrstva); return !!(v && (v.zamcena || v.skryta)); };
  const skryty = o => { const v = mapaVrstev.get(o.vrstva); return !!(v && v.skryta); };
  let jenAktivni = true;            // vybírat, posouvat a mazat jen objekty aktivní vrstvy
  const zamceny = o => {
    if (o.zamek) return true;
    const v = mapaVrstev.get(o.vrstva);
    if (v && (v.zamcena || v.skryta)) return true;
    return jenAktivni && !!tabule && mapaVrstev.size > 1 && o.vrstva !== tabule.aktivniVrstva;
  };
  const T = (s, p) => (window.I18N && I18N.t ? I18N.t(s, p) : s.replace(/\{(\w+)\}/g, (_, k) => p[k]));
  const barvaRamu = () => J.jas(tabule.pozadi) > 0.5 ? '#5f666e' : '#9e9e9e';
  const viditelnaOblast = () => ({ x: kam().x, y: kam().y, w: sirkaPlochy() / kam().z, h: vyskaPlochy() / kam().z });

  // ---------- nastavení (localStorage) ----------
  function nactiNastaveni() {
    try {
      const n = JSON.parse(localStorage.getItem(KLIC_NASTAVENI) || '{}');
      if (n.styl) Object.assign(styl, n.styl);
      pruhledne = !!n.pruhledne;
      if (typeof n.minimapa === 'boolean') minimapa = n.minimapa;
      if (typeof n.panelVrstev === 'boolean') panelVrstev = n.panelVrstev;
      if (typeof n.jenAktivni === 'boolean') jenAktivni = n.jenAktivni;
      return n;
    } catch (e) { return {}; }
  }
  function ulozNastaveni() {
    try { localStorage.setItem(KLIC_NASTAVENI, JSON.stringify({ styl, pruhledne, minimapa, panelVrstev, jenAktivni, posledni: tabule && tabule.id })); } catch (e) { /* plné úložiště – nastavení není důležité */ }
  }

  // ---------- IndexedDB ----------
  const DB = 'webapp_whiteboard', ST = 'data';
  const otevreniDB = new Promise(ok => {
    let req;
    try { req = indexedDB.open(DB, 1); } catch (e) { return ok(null); }
    req.onupgradeneeded = () => req.result.createObjectStore(ST);
    req.onsuccess = () => ok(req.result);
    req.onerror = req.onblocked = () => ok(null);
  });
  async function dbCti(klic) {
    const db = await otevreniDB;
    if (!db) return undefined;
    return new Promise((ok, ko) => {
      const r = db.transaction(ST).objectStore(ST).get(klic);
      r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error);
    });
  }
  async function dbZapis(zapsat, smazat = []) {
    const db = await otevreniDB;
    if (!db) throw new Error('IndexedDB není k dispozici');
    return new Promise((ok, ko) => {
      const tx = db.transaction(ST, 'readwrite'), s = tx.objectStore(ST);
      for (const [k, v] of Object.entries(zapsat)) s.put(v, k);
      for (const k of smazat) s.delete(k);
      tx.oncomplete = () => ok();
      tx.onerror = tx.onabort = () => ko(tx.error || new Error('Zápis selhal'));
    });
  }

  // ---------- ukládání ----------
  let casovacUlozeni = 0;
  function naplanujUlozeni() {
    clearTimeout(casovacUlozeni);
    casovacUlozeni = setTimeout(ulozit, 900);
    $('stavUlozeno').textContent = '● neuloženo';
  }
  // seznam tabulí se mění v transakci nad jeho aktuální verzí v DB – jinak by ho druhé
  // otevřené okno přepsalo svou starou kopií (zmizelé / vzkříšené tabule)
  async function upravSeznam(uprav, zapsat = {}, smazat = []) {
    const db = await otevreniDB;
    if (!db) throw new Error('IndexedDB není k dispozici');
    return new Promise((ok, ko) => {
      const tx = db.transaction(ST, 'readwrite'), st = tx.objectStore(ST);
      let novy = null;
      const r = st.get('seznam');
      r.onsuccess = () => {
        novy = uprav((r.result || []).slice());
        st.put(novy, 'seznam');
        for (const [k, v] of Object.entries(zapsat)) st.put(v, k);
        for (const k of smazat) st.delete(k);
      };
      tx.oncomplete = () => { seznam = novy; ok(); };
      tx.onerror = tx.onabort = () => ko(tx.error || new Error('Zápis selhal'));
    });
  }

  // t = ukládaná tabule (při přepnutí se ukládá ta stará, ne právě otevřená)
  async function ulozit(t = tabule) {
    if (t === tabule) { clearTimeout(casovacUlozeni); casovacUlozeni = 0; }
    if (!t) return;
    t.upraveno = new Date().toISOString();
    const meta = { id: t.id, nazev: t.nazev, vytvoreno: t.vytvoreno, upraveno: t.upraveno, nahled: nahled(t) };
    try {
      await upravSeznam(sz => {
        const i = sz.findIndex(x => x.id === t.id);
        if (i >= 0) sz[i] = meta; else sz.unshift(meta);
        return sz;
      }, { ['tabule:' + t.id]: t });
      if (t !== tabule) return;
      $('stavUlozeno').textContent = '✓ uloženo ' + new Date().toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      $('stavUlozeno').textContent = '⚠ neuloženo';
      chyba('Tabuli se nepodařilo uložit: ' + e.message);
    }
    if ($('galerie').classList.contains('otevrena')) vykresliGalerii();
  }

  function novaTabule(nazev) {
    const ted = new Date().toISOString();
    return {
      id: J.noveId(), nazev, vytvoreno: ted, upraveno: ted,
      pozadi: tmaveTema() ? '#252525' : '#ffffff', mrizka: 'ne', prichytit: false,
      objekty: [], obrazky: {}, kamera: { x: 0, y: 0, z: 1 }
    };
  }

  function volnyNazev() {
    let n = seznam.length + 1;
    while (seznam.some(t => t.nazev === 'Tabule ' + n)) n++;
    return 'Tabule ' + n;
  }

  function otevriTabuli(t) {
    // rozdělanou práci dokončit a uložit ještě do staré tabule
    potvrdEditor();
    dokonciKrivku(false);
    zrusAkci();
    if (prezentace) ukoncitPrezentaci();
    clearTimeout(casovacSipek);
    if (tabule && casovacUlozeni) ulozit(tabule);
    tabule = t;
    tabule.objekty = (tabule.objekty || []).filter(o => J.platnyObjekt(o, false));
    tabule.obrazky = J.pouziteObrazky(tabule.objekty, tabule.obrazky || {});
    tabule.kamera = tabule.kamera || { x: 0, y: 0, z: 1 };
    cacheObr.clear();
    vyber.clear(); zpet = []; vpred = [];
    obnovVrstvy();
    J.prepoj(tabule.objekty);
    stavJSON = snimek();
    kontrastPera();
    ulozNastaveni();
    $('nazevTabule').textContent = tabule.nazev;
    document.title = '✏️ ' + tabule.nazev + ' – Whiteboard';
    $('tlMrizka').setAttribute('aria-pressed', tabule.mrizka !== 'ne');
    zavriHledani();
    poZmene(false);
    poKamere(false);
  }

  async function otevriPodleId(id) {
    if (tabule && id === tabule.id) return;
    if (casovacUlozeni) await ulozit();
    const t = await dbCti('tabule:' + id);
    if (!t) return chyba('Tabule nebyla nalezena.');
    otevriTabuli(t);
    vykresliGalerii();
  }

  // pero nesmí splývat s pozadím (bílé pero na bílé tabuli)
  function kontrastPera() {
    if (Math.abs(J.jas(styl.barva) - J.jas(tabule.pozadi)) < 0.25) {
      styl.barva = J.jas(tabule.pozadi) > 0.5 ? '#1e1e1e' : '#e0e0e0';
      obnovPruh();
    }
  }

  // převod starých rastrových kreseb z localStorage (do 11/2026)
  async function prevedStare() {
    let stare;
    try { stare = JSON.parse(localStorage.getItem(STARY_KLIC) || 'null'); } catch (e) { return; }
    if (!Array.isArray(stare) || !stare.length) return;
    const zapsat = {}, nove = [];
    for (const d of stare) {
      if (!d || typeof d.dataUrl !== 'string' || !d.dataUrl.startsWith('data:image/')) continue;
      const img = await nactiObrazek(d.dataUrl).catch(() => null);
      if (!img) continue;
      const t = novaTabule(String(d.name || 'Kresba'));
      t.pozadi = '#252525';
      t.vytvoreno = d.createdAt || t.vytvoreno; t.upraveno = d.updatedAt || t.upraveno;
      const id = J.otisk(d.dataUrl);
      t.obrazky[id] = d.dataUrl;
      t.objekty.push({ id: J.noveId(), typ: 'obr', obr: id, x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight, barva: '#000000', alfa: 1 });
      zapsat['tabule:' + t.id] = t;
      nove.push({ id: t.id, nazev: t.nazev, vytvoreno: t.vytvoreno, upraveno: t.upraveno, nahled: d.thumb || null });
    }
    await upravSeznam(sz => sz.concat(nove), zapsat);
    localStorage.removeItem(STARY_KLIC);
    info(`Převedeno ${nove.length} starších kreseb do nového formátu.`);
  }

  // ---------- historie ----------
  const snimek = () => JSON.stringify({ o: tabule.objekty, v: tabule.vrstvy });
  function zapis() {
    obnovVrstvy();
    J.prepoj(tabule.objekty);
    const s = snimek();
    if (s === stavJSON) return;
    zpet.push(stavJSON);
    if (zpet.length > MAX_HISTORIE) zpet.shift();
    vpred = [];
    stavJSON = s;
    poZmene();
  }
  function obnovStav(s) {
    const d = JSON.parse(s);
    tabule.objekty = d.o; tabule.vrstvy = d.v;
    obnovVrstvy();
    stavJSON = s;
    const ids = new Set(tabule.objekty.map(o => o.id));
    vyber = new Set([...vyber].filter(id => ids.has(id)));
    poZmene();
  }
  function zpetKrok() {
    if (akce && akce.typ === 'krivka') {      // u rozdělané lomené čáry Zpět ubere poslední bod
      const b = akce.nahled.body;
      if (b.length > 4) { b.splice(-4, 2); J.zneplatni(akce.nahled); } else akce = null;
      return prekresli();
    }
    potvrdEditor(); zrusAkci();
    if (zpet.length) { vpred.push(stavJSON); obnovStav(zpet.pop()); }
  }
  function znovuKrok() { potvrdEditor(); zrusAkci(); if (vpred.length) { zpet.push(stavJSON); obnovStav(vpred.pop()); } }

  function poZmene(ulozit = true) {
    if (vyber.size) {                     // výběr nesmí držet id, která už na tabuli nejsou
      const ids = new Set(tabule.objekty.map(o => o.id));
      for (const id of vyber) if (!ids.has(id)) vyber.delete(id);
    }
    $('tlZpet').disabled = !zpet.length;
    $('tlZnovu').disabled = !vpred.length;
    if (ulozit) naplanujUlozeni();
    mm.platne = false;
    obnovStavRadek();
    obnovPruh();
    vykresliPanelVrstev();
    prekresli();
  }

  function poKamere(ulozit = true) {
    $('zoomHodn').textContent = Math.round(kam().z * 100) + ' %';
    if (editor) umistiEditor();
    if (ulozit && !prezentace) naplanujUlozeni();
    prekresli();
  }

  // ---------- obrázky ----------
  // barva pod bodem p (souřadnice tabule) v obrázku o zprůhlední – podle tolerance, případně jen souvislá oblast
  let pruhlBezi = false;            // další klik počká, jinak by oba počítaly z původního obrázku
  async function barvaDoPruhledne(o, p) {
    if (pruhlBezi) return;
    pruhlBezi = true;
    try { await barvaDoPruhledneTed(o, p); } finally { pruhlBezi = false; }
  }
  async function barvaDoPruhledneTed(o, p) {
    const t0 = tabule, obr0 = o.obr, src = tabule.obrazky[o.obr];
    if (!src) return;
    let img;
    try { img = await nactiObrazek(src); } catch (e) { return chyba('Obrázek nejde načíst.'); }
    const W = img.naturalWidth, H = img.naturalHeight;
    if (!W || !H) return;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0);
    let u = (p.x - o.x) / o.w, v = (p.y - o.y) / o.h;
    if (o.zrcX) u = 1 - u;
    if (o.zrcY) v = 1 - v;
    const sx = Math.max(0, Math.min(W - 1, Math.floor(u * W))), sy = Math.max(0, Math.min(H - 1, Math.floor(v * H)));
    const obr = x.getImageData(0, 0, W, H), d = obr.data, i = 4 * (sy * W + sx);
    if (!d[i + 3]) return info('Tady je obrázek už průhledný.');
    const barva = [d[i], d[i + 1], d[i + 2]], hex = '#' + barva.map(k => k.toString(16).padStart(2, '0')).join('');
    const n = J.barvaDoPruhledne(d, W, H, barva, styl.tolPruhl * 2.2, { souvisle: styl.souvisle, sx, sy });
    if (!n) return info('Nic se nezměnilo.');
    x.putImageData(obr, 0, 0);
    const novy = c.toDataURL('image/png');
    if (tabule !== t0) return;
    const cil = tabule.objekty.find(q => q.id === o.id);
    if (!cil || cil.obr !== obr0) return;           // mezitím Zpět nebo smazání
    const id = J.otisk(novy);
    tabule.obrazky[id] = novy;      // původní zůstává kvůli Zpět (neužívané se pročistí při dalším otevření)
    cil.obr = id;
    mm.platne = false;
    zapis();
    info(`Barva ${hex} → průhledná (${Math.max(1, Math.round(n / (W * H) * 100))} % obrázku).`);
  }

  const cacheObr = new Map();
  const env = {
    pozadi: null, bezRamu: false,
    vrstva: o => mapaVrstev.get(o.vrstva),
    obrazek(id) {
      let i = cacheObr.get(id);
      if (!i) {
        const src = tabule.obrazky[id];
        if (!src) return null;
        i = new Image(); i.onload = () => { mm.platne = false; prekresli(); }; i.src = src;
        cacheObr.set(id, i);
      }
      return i.complete && i.naturalWidth ? i : null;
    }
  };
  function nactiObrazek(src) {
    return new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ko(new Error('Obrázek nejde načíst')); i.src = src; });
  }
  async function nactiVsechnyObrazky(objekty) {
    await Promise.all(objekty.filter(o => o.typ === 'obr' && tabule.obrazky[o.obr]).map(o =>
      nactiObrazek(tabule.obrazky[o.obr]).then(i => cacheObr.set(o.obr, i)).catch(() => {})));
  }
  const ctiSoubor = blob => new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => ko(r.error); r.readAsDataURL(blob); });

  // místo vložení: pod myší, jinak střed obrazovky
  function mistoVlozeni() {
    const s = bodPrikazu || (mys.uvnitr ? mys : { x: sirkaPlochy() / 2, y: vyskaPlochy() / 2 });
    return naSvet(s.x, s.y);
  }
  const presneMisto = () => !!bodPrikazu || mys.uvnitr;

  async function vlozObrazek(blob, posun = 0) {
    if (!aktivniPristupna()) return;
    const t0 = tabule;
    let src;
    try { src = await ctiSoubor(blob); } catch (e) { return chyba('Soubor nejde přečíst.'); }
    let img;
    try { img = await nactiObrazek(src); } catch (e) { return chyba('Tohle není obrázek, který umí prohlížeč zobrazit.'); }
    let w = img.naturalWidth || 300, h = img.naturalHeight || 300;
    if (Math.max(w, h) > MAX_OBR && img.naturalWidth) {
      const s = MAX_OBR / Math.max(w, h);
      const c = document.createElement('canvas');
      c.width = Math.round(w * s); c.height = Math.round(h * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      src = blob.type === 'image/jpeg' ? c.toDataURL('image/jpeg', 0.9) : c.toDataURL('image/png');
      w = c.width; h = c.height;
    }
    if (tabule !== t0) return;            // mezitím přepnuto na jinou tabuli
    const id = J.otisk(src);
    tabule.obrazky[id] = src;
    const z = kam().z;
    const s = Math.min(1, 0.7 * sirkaPlochy() / z / w, 0.7 * vyskaPlochy() / z / h);
    const m = mistoVlozeni();
    const o = { id: J.noveId(), typ: 'obr', obr: id, x: m.x - w * s / 2 + posun, y: m.y - h * s / 2 + posun, w: w * s, h: h * s, barva: '#000000', alfa: 1 };
    tabule.objekty.push(o);
    vyber = new Set([o.id]);
    zvolNastroj('vyber');
    zapis();
  }

  // vložení dat ze schránky / přetažení
  function vlozText(text) {
    if (!text || !aktivniPristupna()) return;
    try {
      const d = JSON.parse(text);
      if (d && d.whiteboard === 1 && Array.isArray(d.objekty)) return vlozObjekty(d);
    } catch (e) { /* obyčejný text */ }
    if (/^\s*<svg[\s>]/i.test(text)) {
      return vlozObrazek(new Blob([text], { type: 'image/svg+xml' }));
    }
    const m = mistoVlozeni();
    const o = { id: J.noveId(), typ: 'text', x: prichyt(m.x), y: prichyt(m.y), text: text.replace(/\r\n?/g, '\n').replace(/\t/g, '    '), velikost: styl.velikost, pismo: styl.pismo, barva: styl.barva, alfa: styl.alfa };
    tabule.objekty.push(o);
    vyber = new Set([o.id]);
    zvolNastroj('vyber');
    zapis();
  }

  function vlozObjekty(d, naMisto = true) {
    if (!aktivniPristupna()) return [];
    const objekty = J.klonuj(d.objekty.filter(o => J.platnyObjekt(o)));
    if (!objekty.length) return [];
    objekty.forEach(o => { delete o.vrstva; });       // vložené objekty patří do aktivní vrstvy
    prevezmiObrazky(objekty, d.obrazky, tabule.obrazky);
    if (naMisto) {
      const h = J.hraniceVsech(objekty), m = mistoVlozeni();
      vlozeni = (vlozeni + 1) % 10;
      const dx = prichyt(m.x - h.w / 2) - h.x + (presneMisto() ? 0 : vlozeni * 15), dy = prichyt(m.y - h.h / 2) - h.y + (presneMisto() ? 0 : vlozeni * 15);
      objekty.forEach(o => J.premisti(o, dx, dy));
    }
    tabule.objekty.push(...objekty);
    vyber = new Set(objekty.map(o => o.id));
    zvolNastroj('vyber');
    zapis();
    return objekty;
  }

  // obrázky z cizích dat: id = otisk obsahu (nepřepíše jiný obrázek se stejným id), objekty se přemapují
  function prevezmiObrazky(objekty, zdroj, cil) {
    const mapa = {};
    for (const [id, src] of Object.entries(zdroj || {})) {
      if (typeof src !== 'string' || !/^data:image\/(png|jpeg|gif|webp|svg\+xml|bmp|avif)[;,]/i.test(src)) continue;
      const nove = J.otisk(src);
      cil[nove] = src;
      mapa[id] = nove;
    }
    for (const o of objekty) if (o.typ === 'obr') o.obr = mapa[o.obr] || o.obr;
  }

  function vlozSablonu(id) {
    if (!aktivniPristupna()) return;
    const objekty = SABLONY.vytvor(id, { tmave: J.jas(tabule.pozadi) < 0.5 });
    if (!objekty.length) return;
    const h = J.hraniceVsech(objekty), v = viditelnaOblast();
    objekty.forEach(o => J.premisti(o, v.x + v.w / 2 - h.x - h.w / 2, v.y + v.h / 2 - h.y - h.h / 2));
    tabule.objekty.push(...objekty);
    vyber = new Set(objekty.map(o => o.id));
    zvolNastroj('vyber');
    zapis();
    zobrazit(objekty);
  }

  function vlozData(dt) {
    const soubory = [...(dt.files || [])];
    const obr = soubory.filter(f => f.type.startsWith('image/'));
    if (obr.length) { obr.forEach((f, i) => vlozObrazek(f, i * 24)); return true; }
    const json = soubory.find(f => /\.json$/i.test(f.name) || f.type === 'application/json');
    if (json) { importJson(json); return true; }
    const t = dt.getData('text/plain');
    if (t) { vlozText(t); return true; }
    return false;
  }

  async function vlozitZeSchranky() {
    if (!navigator.clipboard || !navigator.clipboard.read) {
      return info('Prohlížeč neumí číst schránku tlačítkem – stiskněte Ctrl+V.');
    }
    try {
      const polozky = await navigator.clipboard.read();
      for (const p of polozky) {
        const typ = p.types.find(t => t.startsWith('image/'));
        if (typ) return vlozObrazek(await p.getType(typ));
        if (p.types.includes('text/plain')) return vlozText(await (await p.getType('text/plain')).text());
      }
      info('Ve schránce není obrázek ani text.');
    } catch (e) {
      info('Prohlížeč nepovolil čtení schránky – stiskněte Ctrl+V.');
    }
  }

  function dataVyberu() {
    const v = vybrane();
    return JSON.stringify({ whiteboard: 1, objekty: v, obrazky: J.pouziteObrazky(v, tabule.obrazky) });
  }

  // ---------- operace s výběrem ----------
  // klik na člen skupiny vybere celou skupinu
  function rozsirSkupiny() {
    const sk = new Set();
    for (const o of tabule.objekty) if (vyber.has(o.id) && o.skupina) sk.add(o.skupina);
    if (!sk.size) return;
    for (const o of tabule.objekty) if (o.skupina && sk.has(o.skupina) && !zamceny(o)) vyber.add(o.id);      // ne části v jiné vrstvě
  }
  function smazVyber() {
    if (!vyber.size) return;
    tabule.objekty = tabule.objekty.filter(o => !vyber.has(o.id));
    vyber.clear();
    zapis();
  }
  function duplikuj() {
    const v = vybrane();
    if (!v.length) return;
    const kopie = J.klonuj(v);
    kopie.forEach(o => J.premisti(o, MRIZKA, MRIZKA));
    tabule.objekty.push(...kopie);
    vyber = new Set(kopie.map(o => o.id));
    zapis();
  }
  function poradi(kam) {
    const o = tabule.objekty, je = x => vyber.has(x.id);
    if (!vyber.size) return;
    if (kam === 'naVrch') tabule.objekty = [...o.filter(x => !je(x)), ...o.filter(je)];
    else if (kam === 'naSpod') tabule.objekty = [...o.filter(je), ...o.filter(x => !je(x))];
    else if (kam === 'vys') { for (let i = o.length - 2; i >= 0; i--) if (je(o[i]) && !je(o[i + 1])) [o[i], o[i + 1]] = [o[i + 1], o[i]]; }
    else if (kam === 'niz') { for (let i = 1; i < o.length; i++) if (je(o[i]) && !je(o[i - 1])) [o[i], o[i - 1]] = [o[i - 1], o[i]]; }
    zapis();
  }
  function posunVyber(dx, dy) {
    vybrane().forEach(o => J.premisti(o, dx, dy));
    prekresli();
  }
  function seskupit() {
    const v = vybrane();
    if (v.length < 2) return info('Pro seskupení vyberte aspoň dva objekty.');
    const g = 'g' + J.noveId();
    v.forEach(o => { o.skupina = g; });
    zapis();
  }
  function rozdelit() {
    vybrane().forEach(o => { delete o.skupina; });
    zapis();
  }
  function zamknout() {
    const v = vybrane();
    if (!v.length) return;
    v.forEach(o => { o.zamek = true; });
    vyber.clear();
    zapis();
    info('Zamčeno – odemknete pravým tlačítkem nebo v nabídce Uspořádat.');
  }
  function odemknout(o) {
    const cil = o ? [o] : tabule.objekty.filter(x => x.zamek && !skryty(x));
    if (!cil.length) return info('Nic není zamčené.');
    cil.forEach(x => { delete x.zamek; });
    vyber = new Set(cil.map(x => x.id));
    zvolNastroj('vyber');
    zapis();
  }
  function ramKolemVyberu() {
    const v = vybrane().filter(o => o.typ !== 'ram');
    if (!v.length) return info('Nejdřív vyberte objekty, kolem kterých má rám být.');
    const h = J.hraniceVsech(v), okraj = 40;
    const r = { id: J.noveId(), typ: 'ram', x: h.x - okraj, y: h.y - okraj, w: h.w + 2 * okraj, h: h.h + 2 * okraj, nazev: novyNazevRamu(), barva: barvaRamu(), alfa: 1 };
    tabule.objekty.unshift(r);
    vyber = new Set([r.id]);
    zapis();
  }
  const novyNazevRamu = () => 'Rám ' + (tabule.objekty.filter(o => o.typ === 'ram').length + 1);

  // vlastnost z pruhu → výchozí styl + vybrané objekty
  function nastavStyl(klic, hodnota, trvale = true) {
    styl[klic] = hodnota;
    ulozNastaveni();
    const v = vybrane();
    for (const o of v) {
      if (klic === 'barva') { if (o.typ !== 'obr') o.barva = hodnota; }
      else if (klic === 'sirka') { if ('sirka' in o) o.sirka = hodnota; }
      else if (klic === 'alfa') o.alfa = hodnota;
      else if (klic === 'vypln') { if (o.typ === 'tvar' || o.typ === 'krivka') o.vypln = hodnota ? o.barva : null; }
      else if (klic === 'styl') { if (o.typ === 'cara' || o.typ === 'tvar' || o.typ === 'krivka') o.styl = hodnota; }
      else if (klic === 'sipkaZ' || klic === 'sipkaK') { if (o.typ === 'cara') o[klic] = hodnota; }
      else if (klic === 'trasa') { if (o.typ === 'cara') o.trasa = hodnota; }
      else if (klic === 'stetec') {
        if (o.typ === 'tah' && !o.zvyr) { o.stetec = hodnota; if (hodnota === 'stetec' && !o.tl) o.tl = new Array(o.body.length / 2).fill(1); }
      }
      else if (klic === 'pismo' || klic === 'velikost') { if (UPRAVITELNE.includes(o.typ)) o[klic] = hodnota; }
      J.zneplatni(o);
    }
    if (v.length && trvale) zapis();
    else { obnovPruh(); prekresli(); }
  }

  // ---------- pruh vlastností ----------
  const barvyEl = $('barvy');
  PALETA.forEach(b => {
    const t = document.createElement('button');
    t.className = 'vzorek'; t.style.background = b; t.dataset.barva = b; t.title = b; t.setAttribute('aria-label', 'Barva ' + b);
    t.addEventListener('click', () => nastavStyl('barva', b));
    barvyEl.appendChild(t);
  });
  const vlastni = document.createElement('label');
  vlastni.className = 'vzorek vlastni'; vlastni.title = 'Vlastní barva';
  vlastni.innerHTML = '<input type="color" id="vlastniBarva" aria-label="Vlastní barva">';
  barvyEl.appendChild(vlastni);
  $('vlastniBarva').addEventListener('input', e => nastavStyl('barva', e.target.value, false));
  $('vlastniBarva').addEventListener('change', () => zapis());

  $('sirka').addEventListener('input', e => nastavStyl('sirka', +e.target.value, false));
  $('alfa').addEventListener('input', e => nastavStyl('alfa', +e.target.value / 100, false));
  $('sirka').addEventListener('change', () => zapis());
  $('alfa').addEventListener('change', () => zapis());
  $('tlVypln').addEventListener('click', () => nastavStyl('vypln', !styl.vypln));
  $('stylCary').addEventListener('change', e => nastavStyl('styl', e.target.value));
  $('trasa').addEventListener('change', e => nastavStyl('trasa', e.target.value));
  $('tlSipkaZ').addEventListener('click', () => nastavStyl('sipkaZ', !styl.sipkaZ));
  $('tlSipkaK').addEventListener('click', () => nastavStyl('sipkaK', !styl.sipkaK));
  $('pismo').addEventListener('change', e => nastavStyl('pismo', e.target.value));
  $('velikostPisma').addEventListener('change', e => nastavStyl('velikost', +e.target.value));
  $('stetec').addEventListener('change', e => nastavStyl('stetec', e.target.value));
  $('tolPruhl').addEventListener('input', e => { styl.tolPruhl = +e.target.value; $('tolPruhlHodn').textContent = styl.tolPruhl; ulozNastaveni(); });
  $('tlSouvisle').addEventListener('click', () => { styl.souvisle = !styl.souvisle; $('tlSouvisle').setAttribute('aria-pressed', styl.souvisle); ulozNastaveni(); });
  $('tlPruhl').addEventListener('click', () => zvolNastroj('pruhl'));
  $('vyhlazeni').addEventListener('input', e => { styl.vyhlazeni = +e.target.value; ulozNastaveni(); });
  $('tlRozpoznat').addEventListener('click', () => { styl.rozpoznat = !styl.rozpoznat; ulozNastaveni(); obnovPruh(); });
  $('symetrie').addEventListener('change', e => { styl.symetrie = e.target.value; nastavSymStred(); ulozNastaveni(); prekresli(); });
  $('tlSymStred').addEventListener('click', () => { nastavSymStred(); prekresli(); });
  $('mezery').addEventListener('change', e => { styl.mezery = +e.target.value; ulozNastaveni(); });
  function nastavSymStred() { const v = viditelnaOblast(); symStred = { x: v.x + v.w / 2, y: v.y + v.h / 2 }; }

  function obnovSkupinyPruhu() {
    let sk;
    if (nastroj === 'vyber') {
      const v = tabule ? vybrane() : [];
      sk = new Set(v.length ? v.flatMap(o => PRUH_TYPU[o.typ] || []) : ['sirka', 'alfa']);
    } else sk = new Set(PRUH_NASTROJE[nastroj] || (J.DRUHY.includes(nastroj) ? TVAR_PRUH : []));
    document.querySelectorAll('#vlastnosti [data-pro]').forEach(el => { el.hidden = !el.dataset.pro.split(' ').some(k => sk.has(k)); });
  }

  // pruh ukazuje vlastnosti prvního vybraného objektu, jinak výchozí styl
  function obnovPruh() {
    const o = tabule && vybrane()[0];
    const z = Object.assign({}, styl, o ? {
      barva: o.typ === 'obr' ? styl.barva : o.barva,
      sirka: 'sirka' in o ? o.sirka : styl.sirka,
      alfa: o.alfa == null ? 1 : o.alfa,
      vypln: o.typ === 'tvar' || o.typ === 'krivka' ? !!o.vypln : styl.vypln,
      styl: o.styl || styl.styl,
      sipkaZ: o.typ === 'cara' ? !!o.sipkaZ : styl.sipkaZ,
      sipkaK: o.typ === 'cara' ? !!o.sipkaK : styl.sipkaK,
      trasa: o.typ === 'cara' ? (o.trasa || 'prima') : styl.trasa,
      stetec: o.typ === 'tah' ? (o.stetec || 'fix') : styl.stetec,
      pismo: o.pismo || styl.pismo,
      velikost: o.velikost || styl.velikost
    } : {});
    barvyEl.querySelectorAll('[data-barva]').forEach(b => b.setAttribute('aria-pressed', b.dataset.barva === z.barva));
    vlastni.setAttribute('aria-pressed', !PALETA.includes(z.barva));
    if (/^#[0-9a-f]{6}$/i.test(z.barva)) $('vlastniBarva').value = z.barva;
    $('sirka').value = z.sirka; $('sirkaHodn').textContent = z.sirka;
    $('alfa').value = Math.round(z.alfa * 100); $('alfaHodn').textContent = Math.round(z.alfa * 100) + ' %';
    $('tlVypln').setAttribute('aria-pressed', !!z.vypln);
    $('stylCary').value = z.styl;
    $('trasa').value = z.trasa;
    $('tlSipkaZ').setAttribute('aria-pressed', !!z.sipkaZ);
    $('tlSipkaK').setAttribute('aria-pressed', !!z.sipkaK);
    $('pismo').value = z.pismo;
    const vp = $('velikostPisma');
    if (![...vp.options].some(op => +op.value === Math.round(z.velikost))) {
      vp.querySelectorAll('[data-vlastni]').forEach(op => op.remove());
      const op = new Option(Math.round(z.velikost) + ' px', Math.round(z.velikost)); op.dataset.vlastni = '1'; vp.add(op);
    }
    vp.value = Math.round(z.velikost);
    $('stetec').value = z.stetec;
    $('vyhlazeni').value = styl.vyhlazeni;
    $('tlRozpoznat').setAttribute('aria-pressed', !!styl.rozpoznat);
    $('symetrie').value = styl.symetrie;
    $('tlSymStred').hidden = styl.symetrie === 'ne';
    $('mezery').value = styl.mezery;
    $('tolPruhl').value = styl.tolPruhl; $('tolPruhlHodn').textContent = styl.tolPruhl;
    $('tlSouvisle').setAttribute('aria-pressed', !!styl.souvisle);
    obnovSkupinyPruhu();
  }

  // ---------- nástroje ----------
  function zvolNastroj(n) {
    if (n !== nastroj) { potvrdEditor(); dokonciKrivku(false); }
    if (n === 'pipeta' && nastroj !== 'pipeta') predPipetou = nastroj;
    nastroj = n;
    document.querySelectorAll('[data-nastroj]').forEach(b => b.setAttribute('aria-pressed', b.dataset.nastroj === n));
    $('tlDalsiTvary').setAttribute('aria-pressed', DALSI_TVARY.includes(n));
    if (n !== 'vyber' && n !== 'vypln' && vyber.size) { vyber.clear(); obnovPruh(); }
    plocha.dataset.kurzor = KURZORY[n] || '';
    obnovStavRadek();
    obnovSkupinyPruhu();
    prekresli();
  }
  document.querySelectorAll('[data-nastroj]').forEach(b => b.addEventListener('click', () => zvolNastroj(b.dataset.nastroj)));

  function obnovStavRadek() {
    $('stavNastroj').textContent = NAZVY_NASTROJU[nastroj];
    if (!tabule) return;
    $('stavObjekty').textContent = `Objektů: ${tabule.objekty.length}` + (vyber.size ? ` · vybráno ${vyber.size}` : '');
  }

  // ---------- kreslení ----------
  let planovano = false;
  function prekresli() { if (!planovano) { planovano = true; requestAnimationFrame(vykresli); } }

  function prizpusobPlatno() {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(platno.clientWidth * dpr)), h = Math.max(1, Math.round(platno.clientHeight * dpr));
    if (platno.width !== w || platno.height !== h) { platno.width = w; platno.height = h; vrstvaKurzoru.width = w; vrstvaKurzoru.height = h; }
    if (!tabule) return;
    if (prezentace) ukazSnimek(prezentace.i);
    vykresli();
  }
  new ResizeObserver(prizpusobPlatno).observe(platno);

  function kresliMrizku(k, vid) {
    if (tabule.mrizka === 'ne' || prezentace) return;
    let krok = MRIZKA;
    while (krok * k.z < 10) krok *= 5;
    const svetle = J.jas(tabule.pozadi) > 0.5;
    ctx.fillStyle = ctx.strokeStyle = svetle ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.08)';
    const x0 = Math.floor(vid.x / krok) * krok, y0 = Math.floor(vid.y / krok) * krok;
    if (tabule.mrizka === 'tecky') {
      const r = 1.6 / k.z;
      ctx.fillStyle = svetle ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.2)';
      for (let x = x0; x <= vid.x + vid.w; x += krok) for (let y = y0; y <= vid.y + vid.h; y += krok) ctx.fillRect(x - r / 2, y - r / 2, r, r);
      return;
    }
    ctx.lineWidth = 1 / k.z;
    ctx.beginPath();
    for (let x = x0; x <= vid.x + vid.w; x += krok) { ctx.moveTo(x, vid.y); ctx.lineTo(x, vid.y + vid.h); }
    for (let y = y0; y <= vid.y + vid.h; y += krok) { ctx.moveTo(vid.x, y); ctx.lineTo(vid.x + vid.w, y); }
    ctx.stroke();
  }

  function uchyty(h) {
    const x1 = h.x, x2 = h.x + h.w, y1 = h.y, y2 = h.y + h.h, xm = (x1 + x2) / 2, ym = (y1 + y2) / 2;
    return [['nw', x1, y1], ['n', xm, y1], ['ne', x2, y1], ['e', x2, ym], ['se', x2, y2], ['s', xm, y2], ['sw', x1, y2], ['w', x1, ym]];
  }
  const jedinaCara = () => { const v = vybrane(); return v.length === 1 && v[0].typ === 'cara' ? v[0] : null; };
  const OKRAJ_VYBERU = 4;
  function hraniceVyberu() {
    const h = J.hraniceVsech(vybrane());
    if (!h) return null;
    const p = OKRAJ_VYBERU / kam().z;
    return { x: h.x - p, y: h.y - p, w: h.w + 2 * p, h: h.h + 2 * p };
  }

  function kresliVyber(k) {
    if (!vyber.size || editor || !vybrane().length) return;
    const px = 1 / k.z;
    ctx.save();
    ctx.strokeStyle = akcent; ctx.lineWidth = px;
    const v = vybrane();
    if (v.length > 1) {
      ctx.setLineDash([4 * px, 3 * px]);
      for (const o of v) { const h = J.hranice(o); ctx.strokeRect(h.x, h.y, h.w, h.h); }
      ctx.setLineDash([]);
    }
    const cara = jedinaCara();
    const body = cara ? [['1', cara.x1, cara.y1], ['2', cara.x2, cara.y2]] : (() => {
      const h = hraniceVyberu();
      ctx.strokeRect(h.x, h.y, h.w, h.h);
      return uchyty(h);
    })();
    const r = 4.5 * px;
    ctx.lineWidth = 1.5 * px;
    for (const [id, x, y] of body) {
      // připojený konec spojnice = plný bod
      ctx.fillStyle = cara && cara[id === '1' ? 'zac' : 'kon'] ? akcent : '#ffffff';
      ctx.beginPath();
      if (cara) ctx.arc(x, y, r * 1.1, 0, Math.PI * 2); else ctx.rect(x - r, y - r, 2 * r, 2 * r);
      ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  function kresliObjekt(o, vid, mazane) {
    if (!J.prekryva(J.hranice(o), vid)) return;
    if (editor && editor.o === o) {
      if (o.typ !== 'text') J.kresli(ctx, Object.assign({}, o, { text: '' }), env);
      return;
    }
    if (mazane && mazane.has(o.id)) J.kresli(ctx, Object.assign({}, o, { alfa: (o.alfa == null ? 1 : o.alfa) * 0.2 }), env);
    else J.kresli(ctx, o, env);
  }

  function vykresli() {
    planovano = false;
    if (!tabule) return;
    const dpr = window.devicePixelRatio || 1, k = kam();
    J.prepoj(tabule.objekty);
    const sach = tabule.pruhledna && !prezentace;      // průhledná tabule: šachovnice jako v grafických editorech
    env.pozadi = sach ? null : tabule.pozadi; env.bezRamu = !!prezentace;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = sach ? vzorSachovnice(dpr) : tabule.pozadi;
    ctx.fillRect(0, 0, platno.width, platno.height);
    ctx.setTransform(dpr * k.z, 0, 0, dpr * k.z, -k.x * k.z * dpr, -k.y * k.z * dpr);
    const vid = viditelnaOblast();
    kresliMrizku(k, vid);
    const mazane = akce && akce.typ === 'guma' ? akce.mazat : null;
    for (const o of tabule.objekty) if (o.typ === 'ram') kresliObjekt(o, vid, mazane);
    for (const o of tabule.objekty) if (o.typ !== 'ram') kresliObjekt(o, vid, mazane);
    if (akce && akce.nahled) {
      J.kresli(ctx, akce.nahled, env);
      for (const f of akce.sym || []) {
        const c = Object.assign({}, akce.nahled, { body: akce.nahled.body.slice() });
        J.transformuj(c, f);
        J.kresli(ctx, c, env);
      }
    }
    if (akce && akce.typ === 'krivka') {      // první bod – klik na něj mnohoúhelník uzavře
      const b = akce.nahled.body;
      ctx.save(); ctx.strokeStyle = akcent; ctx.fillStyle = tabule.pozadi; ctx.lineWidth = 1.5 / k.z;
      ctx.beginPath(); ctx.arc(b[0], b[1], 5 / k.z, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
    }
    if ((nastroj === 'pero' || nastroj === 'zvyr') && styl.symetrie !== 'ne' && symStred && !prezentace) kresliOsySymetrie(k, vid);
    if (akce && akce.cil) {      // cíl, ke kterému se spojnice připojí
      const h = J.hranice(akce.cil), p = 4 / k.z;
      ctx.save(); ctx.strokeStyle = akcent; ctx.lineWidth = 2 / k.z; ctx.setLineDash([6 / k.z, 4 / k.z]);
      ctx.strokeRect(h.x - p, h.y - p, h.w + 2 * p, h.h + 2 * p); ctx.restore();
    }
    kresliVyber(k);
    if (akce && akce.vod) {      // vodítka zarovnání
      ctx.save(); ctx.strokeStyle = '#ff3d9a'; ctx.lineWidth = 1 / k.z;
      ctx.beginPath();
      if (akce.vod.x != null) { ctx.moveTo(akce.vod.x, vid.y); ctx.lineTo(akce.vod.x, vid.y + vid.h); }
      if (akce.vod.y != null) { ctx.moveTo(vid.x, akce.vod.y); ctx.lineTo(vid.x + vid.w, akce.vod.y); }
      ctx.stroke(); ctx.restore();
    }
    if (akce && akce.typ === 'ramecek') {
      const r = obdelnik(akce.p0, akce.p1);
      ctx.fillStyle = 'rgba(106,166,253,0.12)'; ctx.strokeStyle = akcent; ctx.lineWidth = 1 / k.z;
      ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeRect(r.x, r.y, r.w, r.h);
    }
    if (laser.length) {
      const ted = performance.now();
      laser = laser.filter(b => ted - b.t < 900);
      ctx.lineCap = ctx.lineJoin = 'round';
      for (let i = 1; i < laser.length; i++) {
        const a = laser[i - 1], b = laser[i];
        ctx.strokeStyle = `rgba(255,40,40,${(1 - (ted - b.t) / 900).toFixed(3)})`;
        ctx.lineWidth = 5 / k.z;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      if (laser.length) prekresli();
    }
    if (nastroj === 'guma' && mys.uvnitr) {
      const p = naSvet(mys.x, mys.y);
      ctx.strokeStyle = akcent; ctx.lineWidth = 1.5 / k.z;
      ctx.beginPath(); ctx.arc(p.x, p.y, polomerGumy() / k.z, 0, Math.PI * 2); ctx.stroke();
    }
    kresliStopu();
    kresliMinimapu();
  }

  function kresliOsySymetrie(k, vid) {
    const c = symStred, R = Math.max(vid.w, vid.h) * 2, rez = styl.symetrie;
    ctx.save();
    ctx.strokeStyle = akcent; ctx.globalAlpha = 0.4; ctx.lineWidth = 1 / k.z; ctx.setLineDash([6 / k.z, 6 / k.z]);
    ctx.beginPath();
    if (rez === 'svisle') { ctx.moveTo(c.x, c.y - R); ctx.lineTo(c.x, c.y + R); }
    else if (rez === 'vodorovne') { ctx.moveTo(c.x - R, c.y); ctx.lineTo(c.x + R, c.y); }
    else {
      const n = rez === 'kaleidoskop' ? 12 : +rez;
      for (let i = 0; i < n; i++) { const u = -Math.PI / 2 + 2 * Math.PI * i / n; ctx.moveTo(c.x, c.y); ctx.lineTo(c.x + Math.cos(u) * R, c.y + Math.sin(u) * R); }
    }
    ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.arc(c.x, c.y, 4 / k.z, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  // barva bodu tabule složená jen z objektů (průhledná tabule – šachovnice se nepočítá); [r, g, b, a]
  function bodBezPozadi(p) {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    const x = c.getContext('2d', { willReadFrequently: true }), z = kam().z * (window.devicePixelRatio || 1);
    x.setTransform(z, 0, 0, z, -p.x * z, -p.y * z);
    const e = Object.assign({}, env, { pozadi: null, bezRamu: false });
    const ob = { x: p.x - 1, y: p.y - 1, w: 2, h: 2 };
    for (const o of tabule.objekty) if (o.typ === 'ram' && J.prekryva(J.hranice(o), ob)) J.kresli(x, o, e);
    for (const o of tabule.objekty) if (o.typ !== 'ram' && J.prekryva(J.hranice(o), ob)) J.kresli(x, o, e);
    const d = x.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], d[3]];
  }
  // šachovnice v pixelech obrazovky; světlá/tmavá podle zvoleného tónu tabule (ten řídí i kontrast pera)
  let sachovnice = null;
  function vzorSachovnice(dpr) {
    const svetla = J.jas(tabule.pozadi) > 0.5, klic = svetla + ':' + dpr;
    if (!sachovnice || sachovnice.klic !== klic) {
      const b = Math.max(1, Math.round(8 * dpr)), c = document.createElement('canvas');
      c.width = c.height = 2 * b;
      const x = c.getContext('2d');
      x.fillStyle = svetla ? '#ffffff' : '#2a2a2a'; x.fillRect(0, 0, 2 * b, 2 * b);
      x.fillStyle = svetla ? '#e2e2e2' : '#383838'; x.fillRect(0, 0, b, b); x.fillRect(b, b, b, b);
      sachovnice = { klic, vzor: ctx.createPattern(c, 'repeat') };
    }
    return sachovnice.vzor;
  }
  const polomerGumy = () => Math.max(6, styl.sirka * 1.5);

  // kurzor ve velikosti budoucí stopy: kruh (pero, štětec, zvýrazňovač, čáry), hrot (kaligrafie), oblak (sprej)
  // kreslí se do vlastní průhledné vrstvy nad tabulí – pohyb myši nepřekresluje tabuli
  let stopaViditelna = false;
  function kresliStopu() {
    const ctx = kctx;
    const ukazat = tabule && STOPA.has(nastroj) && mys.uvnitr && mys.typ !== 'touch' && !mezernik && !prezentace &&
      !(akce && (akce.typ === 'posun' || akce.typ === 'pinch'));
    if (stopaViditelna) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, vrstvaKurzoru.width, vrstvaKurzoru.height); stopaViditelna = false; }
    if (!ukazat) return;
    const k = kam(), dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr * k.z, 0, 0, dpr * k.z, -k.x * k.z * dpr, -k.y * k.z * dpr);
    const p = naSvet(mys.x, mys.y), px = 1 / k.z;
    const kresba = nastroj === 'pero' || nastroj === 'zvyr';
    const stetec = nastroj === 'pero' ? styl.stetec : 'fix';
    let r = styl.sirka / 2;
    if (nastroj === 'zvyr') r = Math.max(8, styl.sirka * 3) / 2;
    else if (stetec === 'stetec') r = styl.sirka * 0.75;
    else if (stetec === 'sprej') r = styl.sirka * 2;
    if (!kresba && r * k.z < 3) return;              // čárám stačí křížek systémového kurzoru
    stopaViditelna = true;
    const alfa = (styl.alfa == null ? 1 : styl.alfa) * (nastroj === 'zvyr' ? 0.35 : 0.55);
    // dvojitý obrys (tmavý + světlý) je vidět na každém pozadí
    const obtahni = cesta => {
      ctx.lineWidth = 2.5 * px; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; cesta(); ctx.stroke();
      ctx.lineWidth = 1 * px; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; cesta(); ctx.stroke();
    };
    ctx.save();
    ctx.lineCap = ctx.lineJoin = 'round'; ctx.setLineDash([]);
    if (stetec === 'kaligrafie') {
      const v = styl.sirka / 2 * Math.SQRT1_2, hrot = () => { ctx.beginPath(); ctx.moveTo(p.x + v, p.y - v); ctx.lineTo(p.x - v, p.y + v); };
      obtahni(hrot);
      ctx.strokeStyle = styl.barva; ctx.lineWidth = 1 * px; hrot(); ctx.stroke();
    } else {
      const rk = Math.max(r, 2 * px), kruh = () => { ctx.beginPath(); ctx.arc(p.x, p.y, rk, 0, Math.PI * 2); };
      if (stetec !== 'sprej') { ctx.globalAlpha = alfa; ctx.fillStyle = styl.barva; kruh(); ctx.fill(); ctx.globalAlpha = 1; }
      else ctx.setLineDash([3 * px, 3 * px]);
      obtahni(kruh);
      ctx.setLineDash([]);
    }
    if (kresba && r * k.z < 4) {                      // malý hrot: ramínka, ať se kurzor neztratí
      const a = Math.max(r, 2 * px) + 3 * px, b = a + 5 * px, ramena = () => {
        ctx.beginPath();
        ctx.moveTo(p.x - a, p.y); ctx.lineTo(p.x - b, p.y); ctx.moveTo(p.x + a, p.y); ctx.lineTo(p.x + b, p.y);
        ctx.moveTo(p.x, p.y - a); ctx.lineTo(p.x, p.y - b); ctx.moveTo(p.x, p.y + a); ctx.lineTo(p.x, p.y + b);
      };
      obtahni(ramena);
    }
    ctx.restore();
  }

  const obdelnik = (a, b) => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) });

  // ---------- minimapa ----------
  const mmPlatno = $('minimapa'), mmCtx = mmPlatno.getContext('2d');
  const mm = { platne: false, oblast: null, m: 1, ox: 0, oy: 0, cache: document.createElement('canvas') };
  function kresliMinimapu() {
    mmPlatno.hidden = !minimapa || !!prezentace;
    if (mmPlatno.hidden) return;
    const dpr = window.devicePixelRatio || 1, W = mmPlatno.clientWidth, H = mmPlatno.clientHeight;
    if (!W || !H) return;
    if (mmPlatno.width !== Math.round(W * dpr)) { mmPlatno.width = Math.round(W * dpr); mmPlatno.height = Math.round(H * dpr); mm.platne = false; }
    if (!mm.platne) {
      const h = J.hraniceVsech(tabule.objekty) || viditelnaOblast();
      const o = { x: h.x - h.w * 0.15 - 50, y: h.y - h.h * 0.15 - 50, w: h.w * 1.3 + 100, h: h.h * 1.3 + 100 };
      mm.m = Math.min(W / o.w, H / o.h);
      mm.ox = (W - o.w * mm.m) / 2; mm.oy = (H - o.h * mm.m) / 2; mm.oblast = o;
      const c = mm.cache;
      c.width = mmPlatno.width; c.height = mmPlatno.height;
      const x = c.getContext('2d');
      x.fillStyle = tabule.pozadi; x.fillRect(0, 0, c.width, c.height);
      x.setTransform(dpr * mm.m, 0, 0, dpr * mm.m, dpr * (mm.ox - o.x * mm.m), dpr * (mm.oy - o.y * mm.m));
      const e = Object.assign({}, env, { bezRamu: false });
      for (const ob of tabule.objekty) if (ob.typ === 'ram') J.kresli(x, ob, e);
      for (const ob of tabule.objekty) if (ob.typ !== 'ram') J.kresli(x, ob, e);
      mm.platne = true;
    }
    mmCtx.setTransform(1, 0, 0, 1, 0, 0);
    mmCtx.drawImage(mm.cache, 0, 0);
    const v = viditelnaOblast(), o = mm.oblast;
    mmCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    mmCtx.strokeStyle = akcent; mmCtx.lineWidth = 1.5;
    mmCtx.fillStyle = 'rgba(106,166,253,0.12)';
    const r = [mm.ox + (v.x - o.x) * mm.m, mm.oy + (v.y - o.y) * mm.m, v.w * mm.m, v.h * mm.m];
    mmCtx.fillRect(...r); mmCtx.strokeRect(...r);
  }
  function minimapaNaKameru(e) {
    const r = mmPlatno.getBoundingClientRect(), o = mm.oblast;
    if (!o) return;
    const x = o.x + (e.clientX - r.left - mm.ox) / mm.m, y = o.y + (e.clientY - r.top - mm.oy) / mm.m;
    const k = kam();
    k.x = x - sirkaPlochy() / 2 / k.z; k.y = y - vyskaPlochy() / 2 / k.z;
    poKamere();
  }
  mmPlatno.addEventListener('pointerdown', e => { e.preventDefault(); mmPlatno.setPointerCapture(e.pointerId); minimapaNaKameru(e); });
  mmPlatno.addEventListener('pointermove', e => { if (e.buttons) minimapaNaKameru(e); });

  // ---------- myš, pero, dotyk ----------
  const ukazatele = new Map();
  let obdelnikPlatna = platno.getBoundingClientRect();
  const poziceObr = e => ({ x: e.clientX - obdelnikPlatna.left, y: e.clientY - obdelnikPlatna.top });

  function uchytPod(sx, sy) {
    if (!vyber.size || !vybrane().length) return null;
    const cara = jedinaCara();
    const body = cara ? [['1', cara.x1, cara.y1], ['2', cara.x2, cara.y2]] : uchyty(hraniceVyberu());
    for (const [id, x, y] of body) {
      const s = naObr(x, y);
      if (Math.abs(s.x - sx) <= 8 && Math.abs(s.y - sy) <= 8) return id;
    }
    return null;
  }

  // objekt, ke kterému se připojí konec spojnice (bod uvnitř jeho obdélníku)
  function najdiCil(p, krome) {
    const t = 4 / kam().z;
    for (let i = tabule.objekty.length - 1; i >= 0; i--) {
      const o = tabule.objekty[i];
      if (o === krome || !J.lzePripojit(o) || o.typ === 'ram' || skryty(o)) continue;
      const h = J.hraniceHole(o);
      if (p.x >= h.x - t && p.x <= h.x + h.w + t && p.y >= h.y - t && p.y <= h.y + h.h + t) return o;
    }
    return null;
  }

  function zrusAkci() {
    if (!akce) return;
    if (['presun', 'zmena', 'konec'].includes(akce.typ)) obnovStav(stavJSON);
    akce = null;
    prekresli();
  }

  function zacniPinch() {
    // rozdělaná lomená čára přežije zoom dvěma prsty; bod přidaný prvním prstem gesta se vrátí
    let krivka = akce && akce.typ === 'krivka' ? akce : null;
    if (krivka && performance.now() - krivka.cas < 500) {
      const b = krivka.nahled.body;
      if (b.length <= 4) krivka = null; else b.splice(-2, 2);
    }
    if (!krivka) zrusAkci();
    const [a, b] = [...ukazatele.values()];
    const stred = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    akce = { typ: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: kam().z, w0: naSvet(stred.x, stred.y), krivka };
  }

  const novyText = p => ({ id: J.noveId(), typ: 'text', x: prichyt(p.x), y: prichyt(p.y) - styl.velikost * J.RADEK / 2, text: '', velikost: styl.velikost, pismo: styl.pismo, barva: styl.barva, alfa: styl.alfa });

  platno.addEventListener('pointerdown', e => {
    obdelnikPlatna = platno.getBoundingClientRect();
    zavriNabidky();
    bodPrikazu = null;
    const s = poziceObr(e);
    ukazatele.set(e.pointerId, s);
    if (ukazatele.size === 2) { zacniPinch(); return; }
    if (akce && akce.typ === 'krivka' && e.button === 0) { e.preventDefault(); return klikKrivky(s); }
    if (ukazatele.size > 2 || akce) return;
    if (e.button === 2) return;
    e.preventDefault();             // jinak mousedown vrátí fokus plátnu a editor textu se hned zavře
    if (editor) { potvrdEditor(); if (nastroj === 'text' || nastroj === 'listek' || nastroj === 'vyber') return; }
    platno.focus({ preventScroll: true });
    try { platno.setPointerCapture(e.pointerId); } catch (_) { /* syntetické události */ }
    const p = naSvet(s.x, s.y), k = kam(), tol = 5 / k.z;

    if (e.button === 1 || mezernik || nastroj === 'ruka') {
      akce = { typ: 'posun', sx: s.x, sy: s.y, kx: k.x, ky: k.y };
      plocha.dataset.kurzor = 'tahne';
      return;
    }
    if (!NEKRESLI.has(nastroj) && !aktivniPristupna()) return;
    const zakl = { id: J.noveId(), barva: styl.barva, alfa: styl.alfa, sirka: styl.sirka };
    switch (nastroj) {
      case 'pero': case 'zvyr': {
        const n = Object.assign(zakl, { typ: 'tah', zvyr: nastroj === 'zvyr', body: [p.x, p.y] });
        if (nastroj === 'pero' && styl.stetec !== 'fix') n.stetec = styl.stetec;
        if (n.stetec === 'stetec') n.tl = [0.3];
        if (styl.symetrie !== 'ne' && !symStred) nastavSymStred();
        akce = {
          typ: 'kresba', nahled: n, vyhl: { x: p.x, y: p.y }, f: 0.6, cas: e.timeStamp, sx: s.x, sy: s.y,
          sym: styl.symetrie !== 'ne' ? J.symetrie(styl.symetrie, symStred.x, symStred.y) : []
        };
        break;
      }
      case 'lomena': case 'krivka': {
        const x = prichyt(p.x), y = prichyt(p.y);
        akce = { typ: 'krivka', cas: performance.now(), nahled: { id: zakl.id, typ: 'krivka', body: [x, y, x, y], hladka: nastroj === 'krivka', uzavrena: false, vypln: null, styl: styl.styl, sirka: styl.sirka, barva: styl.barva, alfa: styl.alfa } };
        break;
      }
      case 'pipeta': {
        const dpr = window.devicePixelRatio || 1;
        const d = ctx.getImageData(Math.floor(s.x * dpr), Math.floor(s.y * dpr), 1, 1).data;
        const bod = tabule.pruhledna ? bodBezPozadi(p) : d;
        if (bod[3] < 128) { zvolNastroj(predPipetou === 'pipeta' ? 'pero' : predPipetou); return info('Tady je průhledné pozadí – žádná barva.'); }
        const hex = '#' + [bod[0], bod[1], bod[2]].map(v => v.toString(16).padStart(2, '0')).join('');
        nastavStyl('barva', hex, false);
        zvolNastroj(predPipetou === 'pipeta' ? 'pero' : predPipetou);
        info('Barva ' + hex);
        return;
      }
      case 'pruhl': {
        const o = J.najdi(tabule.objekty, p.x, p.y, 0, x => x.typ !== 'obr' || zamceny(x));
        if (!o) return info('Klikněte do obrázku – barva, na kterou kliknete, v něm zprůhlední.');
        barvaDoPruhledne(o, p);
        return;
      }
      case 'cara': case 'sipka': {
        const cil = najdiCil(p);
        const x = prichyt(p.x), y = prichyt(p.y);
        const sip = nastroj === 'sipka' ? { sipkaZ: styl.sipkaZ, sipkaK: styl.sipkaK || !styl.sipkaZ } : { sipkaZ: false, sipkaK: false };
        akce = { typ: 'tvar', p0: { x, y }, nahled: Object.assign(zakl, { typ: 'cara', x1: x, y1: y, x2: x, y2: y, styl: styl.styl, trasa: styl.trasa, zac: cil ? cil.id : null, kon: null }, sip) };
        break;
      }
      case 'ram': {
        const x = prichyt(p.x), y = prichyt(p.y);
        akce = { typ: 'tvar', p0: { x, y }, nahled: { id: zakl.id, typ: 'ram', x, y, w: 0, h: 0, nazev: novyNazevRamu(), barva: barvaRamu(), alfa: 1 } };
        break;
      }
      case 'text': {
        const o = J.najdi(tabule.objekty, p.x, p.y, tol, o => o.typ !== 'text' || zamceny(o));
        if (o) return otevriEditor(o);
        const t = novyText(p);
        tabule.objekty.push(t);
        return otevriEditor(t);
      }
      case 'listek': {
        const o = J.najdi(tabule.objekty, p.x, p.y, tol, o => o.typ !== 'listek' || zamceny(o));
        if (o) return otevriEditor(o);
        const barva = NEUTRALNI.includes(styl.barva.toLowerCase()) ? '#ffd93d' : styl.barva;
        const l = { id: zakl.id, typ: 'listek', x: prichyt(p.x - 100), y: prichyt(p.y - 100), w: 200, h: 200, text: '', velikost: Math.min(styl.velikost, 36), pismo: styl.pismo, barva, alfa: 1 };
        tabule.objekty.push(l);
        return otevriEditor(l);
      }
      case 'vypln': {
        // objekt pod kurzorem se přebarví; prázdné místo (i obrázek) = výplň uzavřené oblasti
        const o = J.najdi(tabule.objekty, p.x, p.y, tol, x => zamceny(x) || x.typ === 'ram' || x.typ === 'obr');
        if (!o) { kbelik(p); return; }
        if (o.typ === 'tvar' || (o.typ === 'krivka' && o.uzavrena)) {
          // obrys = přebarvit čáru, vnitřek = vyplnit oblast (celý vnitřek → výplň tvaru)
          if (!J.zasah(Object.assign({}, o, { vypln: null, text: '' }), p.x, p.y, tol)) { kbelik(p); return; }
          o.barva = styl.barva;
        } else { o.barva = styl.barva; o.alfa = styl.alfa; }
        zapis();
        return;
      }
      case 'guma':
        akce = { typ: 'guma', mazat: new Set() };
        gumuj(p);
        break;
      case 'laser':
        akce = { typ: 'laser' };
        laser.push({ x: p.x, y: p.y, t: performance.now() });
        prekresli();
        break;
      case 'vyber': {
        const u = uchytPod(s.x, s.y);
        if (u === '1' || u === '2') { akce = { typ: 'konec', o: jedinaCara(), kt: u }; return; }
        if (u) {
          const v = vybrane();
          akce = {
            typ: 'zmena', u, h0: J.hraniceVsech(v), puvodni: new Map(v.map(o => [o.id, JSON.stringify(o)])),
            rovnomerne: v.some(o => o.typ === 'text' || o.typ === 'obr')
          };
          return;
        }
        const o = J.najdi(tabule.objekty, p.x, p.y, tol, zamceny);
        if (o) {
          if (e.shiftKey) {
            const cleni = o.skupina ? tabule.objekty.filter(x => x.skupina === o.skupina && !zamceny(x)) : [o];
            const pryc = vyber.has(o.id);
            cleni.forEach(x => pryc ? vyber.delete(x.id) : vyber.add(x.id));
            poZmene(false);
            return;
          }
          if (!vyber.has(o.id)) { vyber = new Set([o.id]); rozsirSkupiny(); poZmene(false); }
          zacniPresun(p);
          akce.kopirovat = e.altKey;    // Alt + tažení = kopie (vznikne až při skutečném pohybu)
        } else {
          akce = { typ: 'ramecek', p0: p, p1: p, puvodni: e.shiftKey ? new Set(vyber) : new Set() };
          if (!e.shiftKey && vyber.size) { vyber.clear(); poZmene(false); }
        }
        break;
      }
      default:       // tvary
        if (J.DRUHY.includes(nastroj)) {
          const x = prichyt(p.x), y = prichyt(p.y);
          akce = { typ: 'tvar', p0: { x, y }, nahled: Object.assign(zakl, { typ: 'tvar', druh: nastroj, x, y, w: 0, h: 0, vypln: styl.vypln ? styl.barva : null, styl: styl.styl }) };
        }
    }
    prekresli();
  });

  const zaokr = v => Math.round(v * 10) / 10;
  function rozpoznanyObjekt(r, n) {
    const z = { id: n.id, barva: n.barva, alfa: n.alfa, sirka: n.sirka };
    if (r.typ === 'cara') return Object.assign(z, { typ: 'cara', x1: zaokr(r.x1), y1: zaokr(r.y1), x2: zaokr(r.x2), y2: zaokr(r.y2), styl: styl.styl, trasa: 'prima', sipkaZ: false, sipkaK: false });
    const vypln = styl.vypln ? n.barva : null;
    if (r.typ === 'tvar') return Object.assign(z, { typ: 'tvar', druh: r.druh, x: zaokr(r.x), y: zaokr(r.y), w: zaokr(r.w), h: zaokr(r.h), vypln, styl: styl.styl });
    return Object.assign(z, { typ: 'krivka', body: r.body.map(zaokr), uzavrena: true, hladka: false, vypln, styl: styl.styl });
  }

  // lomená čára / křivka: klik přidá bod, klik na první bod uzavře
  function klikKrivky(s) {
    const n = akce.nahled, b = n.body, prvni = naObr(b[0], b[1]), p = naSvet(s.x, s.y);
    if (b.length >= 8 && Math.hypot(prvni.x - s.x, prvni.y - s.y) < 10) return dokonciKrivku(true);
    // bod z místa kliknutí (na dotyku žádný pohyb myši předtím není)
    b[b.length - 2] = prichyt(p.x); b[b.length - 1] = prichyt(p.y);
    b.push(b[b.length - 2], b[b.length - 1]);
    akce.cas = performance.now();
    J.zneplatni(n);
    prekresli();
  }
  function dokonciKrivku(zavrit) {
    if (!akce || akce.typ !== 'krivka') return;
    const n = akce.nahled, z = kam().z;
    akce = null;
    const b = n.body.slice(0, -2), c = [];      // bez bodu pod kurzorem, bez dvojic z dvojkliku
    for (let i = 0; i < b.length; i += 2) {
      if (!c.length || Math.hypot(b[i] - c[c.length - 2], b[i + 1] - c[c.length - 1]) > 0.5 / z) c.push(zaokr(b[i]), zaokr(b[i + 1]));
    }
    if (c.length < 4) { prekresli(); return; }
    n.body = c;
    n.uzavrena = !!zavrit && c.length >= 6;
    if (n.uzavrena && styl.vypln) n.vypln = styl.barva;
    J.zneplatni(n);
    tabule.objekty.push(n);
    zapis();
  }

  // kbelík: vykreslí tabuli do rastru, zaplaví oblast pod kurzorem a obrys uloží jako vektorovou plochu
  let kbelikBezi = false;
  async function kbelik(p) {
    if (kbelikBezi) return;             // rychlý dvojklik = jedna výplň
    kbelikBezi = true;
    try { await kbelikVypln(p); } finally { kbelikBezi = false; }
  }
  async function kbelikVypln(p) {
    const t0 = tabule;
    const vse = tabule.objekty.filter(o => o.typ !== 'ram');
    const h = J.hraniceVsech(vse);
    if (!h || p.x <= h.x || p.y <= h.y || p.x >= h.x + h.w || p.y >= h.y + h.h) {
      return info('Tady není uzavřená oblast – kbelík vyplní plochu ohraničenou čarami, tvary nebo obrázkem.');
    }
    const okraj = 4, ob = { x: h.x - okraj, y: h.y - okraj, w: h.w + 2 * okraj, h: h.h + 2 * okraj };
    const z = kam().z, s = Math.min(z * (window.devicePixelRatio || 1), 2400 / Math.max(ob.w, ob.h));
    const W = Math.max(3, Math.ceil(ob.w * s)), H = Math.max(3, Math.ceil(ob.h * s));
    await nactiVsechnyObrazky(vse);
    if (tabule !== t0) return;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.fillStyle = tabule.pozadi; x.fillRect(0, 0, W, H);
    x.setTransform(s, 0, 0, s, -ob.x * s, -ob.y * s);
    const e = Object.assign({}, env, { pozadi: tabule.pozadi, bezRamu: true });
    for (const o of vse) J.kresli(x, o, e);
    const data = x.getImageData(0, 0, W, H).data;
    const mezera = Math.round((+styl.mezery || 0) * s / z);
    const maska = J.zaplav(data, W, H, (p.x - ob.x) * s, (p.y - ob.y) * s, 48, mezera);
    if (!maska) return info('Oblast není uzavřená – dokreslete okraj, nebo zvyšte „Mezery“ v pruhu vlastností.');
    const kruhy = J.obrysy(maska, W, H)
      .map(k => J.zjednodus(k.concat([k[0], k[1]]), 0.7).slice(0, -2))
      .filter(k => k.length >= 6)
      .map(k => k.map((v, i) => zaokr(i % 2 ? ob.y + v / s : ob.x + v / s)));
    if (!kruhy.length) return;
    // oblast = celý vnitřek tvaru (nic ho nedělí) → vyplnit přímo tvar, ať se s ním hýbe
    const tvar = tabule.objekty.slice().reverse().find(q => !zamceny(q) &&
      (q.typ === 'tvar' || (q.typ === 'krivka' && q.uzavrena)) && J.zasah(Object.assign({}, q, { vypln: '#000' }), p.x, p.y, 0));
    if (tvar && kruhy.length === 1) {
      const a = J.hraniceHole({ typ: 'oblast', kruhy }), b = J.hraniceHole(tvar), t = tvar.sirka + 4 / z;
      if (Math.abs(a.x - b.x) < t && Math.abs(a.y - b.y) < t && Math.abs(a.w - b.w) < 2 * t && Math.abs(a.h - b.h) < 2 * t) {
        tvar.vypln = styl.barva;
        return zapis();
      }
    }
    const o = { id: J.noveId(), typ: 'oblast', kruhy, barva: styl.barva, alfa: styl.alfa };
    // pod čáry: hned nad nejvyšší plochu pod kurzorem (obrázek, výplň, vyplněný tvar, lístek)
    let idx = -1;
    tabule.objekty.forEach((q, i) => {
      const plocha = ['obr', 'oblast', 'listek'].includes(q.typ) || ((q.typ === 'tvar' || q.typ === 'krivka') && q.vypln);
      if (plocha && J.zasah(q, p.x, p.y, 0)) idx = i;
    });
    tabule.objekty.splice(idx + 1, 0, o);
    zapis();
  }

  function prevratit(osa) {
    const v = vybrane();
    if (!v.length) return;
    const h = J.hraniceVsech(v), cx = h.x + h.w / 2, cy = h.y + h.h / 2;
    for (const o of v) {
      J.skaluj(o, cx, cy, osa === 'x' ? -1 : 1, osa === 'y' ? -1 : 1);
      if (o.typ === 'obr') { const k = osa === 'x' ? 'zrcX' : 'zrcY'; o[k] = !o[k]; }
    }
    zapis();
  }

  // přesun výběru: rámy unášejí objekty, které celé leží uvnitř
  function zacniPresun(p) {
    const v = vybrane();
    const navic = [];
    for (const r of v.filter(o => o.typ === 'ram')) {
      const h = J.hraniceHole(r);
      for (const o of tabule.objekty) {
        // připojená spojnice se neunáší – dopočítá se podle svých tvarů
        if (o.typ === 'cara' && (o.zac || o.kon)) continue;
        if (!vyber.has(o.id) && !navic.includes(o) && J.obsahuje(h, J.hranice(o))) navic.push(o);
      }
    }
    const pohyb = v.concat(navic), ids = new Set(pohyb.map(o => o.id)), vid = viditelnaOblast();
    akce = {
      typ: 'presun', p0: p, h0: J.hraniceVsech(pohyb), dx: 0, dy: 0, pohyb, ids,
      ostatni: tabule.objekty.filter(o => !ids.has(o.id) && o.typ !== 'cara' && o.typ !== 'tah' && J.prekryva(J.hranice(o), vid)).slice(0, 400)
    };
    plocha.dataset.kurzor = 'presun';
  }

  function gumuj(p) {
    const r = polomerGumy() / kam().z;
    for (const o of tabule.objekty) if (!zamceny(o) && !akce.mazat.has(o.id) && o.typ !== 'ram' && J.zasah(o, p.x, p.y, r)) akce.mazat.add(o.id);
    prekresli();
  }

  platno.addEventListener('pointermove', e => {
    obdelnikPlatna = platno.getBoundingClientRect();
    const s = poziceObr(e);
    mys.x = s.x; mys.y = s.y; mys.uvnitr = true; mys.typ = e.pointerType;
    if (ukazatele.has(e.pointerId)) ukazatele.set(e.pointerId, s);
    const p = naSvet(s.x, s.y), k = kam();
    $('stavPozice').textContent = `${Math.round(p.x)}, ${Math.round(p.y)}`;

    if (!akce) {
      if (nastroj === 'vyber' && !mezernik) {
        const u = uchytPod(s.x, s.y);
        plocha.dataset.kurzor = u ? ({ nw: 'nwse', se: 'nwse', ne: 'nesw', sw: 'nesw', n: 'ns', s: 'ns', e: 'ew', w: 'ew', 1: 'presun', 2: 'presun' })[u]
          : (J.najdi(tabule.objekty, p.x, p.y, 5 / k.z, zamceny) ? 'presun' : 'vyber');
      }
      if (nastroj === 'guma') prekresli();
      else if (STOPA.has(nastroj)) kresliStopu();
      return;
    }
    switch (akce.typ) {
      case 'pinch': {
        if (ukazatele.size < 2) return;
        const [a, b] = [...ukazatele.values()];
        const stred = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        k.z = Math.max(0.05, Math.min(16, akce.z0 * Math.hypot(a.x - b.x, a.y - b.y) / akce.d0));
        k.x = akce.w0.x - stred.x / k.z; k.y = akce.w0.y - stred.y / k.z;
        poKamere();
        break;
      }
      case 'posun':
        k.x = akce.kx - (s.x - akce.sx) / k.z; k.y = akce.ky - (s.y - akce.sy) / k.z;
        poKamere();
        break;
      case 'kresba': {
        const n = akce.nahled, udal = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
        const kf = Math.min(0.9, styl.vyhlazeni * 0.085), v = akce.vyhl;
        for (const u of (udal.length ? udal : [e])) {
          const q = poziceObr(u), w = naSvet(q.x, q.y);
          v.x += (w.x - v.x) * (1 - kf); v.y += (w.y - v.y) * (1 - kf);      // stabilizátor
          const b = n.body;
          if (Math.hypot(v.x - b[b.length - 2], v.y - b[b.length - 1]) < 0.6 / k.z) continue;
          b.push(v.x, v.y);
          if (n.tl) {
            // šířka štětce: tlak pera, u myši a prstu rychlost (pomalu = široce)
            let f;
            if (u.pointerType === 'pen' && u.pressure > 0) f = 0.15 + 0.85 * Math.pow(u.pressure, 0.8);
            else {
              const dt = Math.max(1, u.timeStamp - akce.cas), rych = Math.hypot(q.x - akce.sx, q.y - akce.sy) / dt;
              f = Math.max(0.25, Math.min(1, 1.15 - rych * 0.35));
            }
            akce.f = akce.f * 0.75 + f * 0.25;
            n.tl.push(Math.round(Math.min(1, akce.f * Math.min(1, 0.3 + n.tl.length * 0.18)) * 100) / 100);
            akce.cas = u.timeStamp; akce.sx = q.x; akce.sy = q.y;
          }
        }
        J.zneplatni(n);
        prekresli();
        break;
      }
      case 'krivka': {
        const n = akce.nahled, b = n.body, L = b.length;
        let q = { x: prichyt(p.x), y: prichyt(p.y) };
        if (e.shiftKey && L >= 4) q = J.omez('cara', b[L - 4], b[L - 3], p.x, p.y);
        b[L - 2] = q.x; b[L - 1] = q.y;
        J.zneplatni(n);
        prekresli();
        break;
      }
      case 'tvar': {
        const n = akce.nahled;
        let q = { x: prichyt(p.x), y: prichyt(p.y) };
        if (n.typ === 'cara') {
          const zac = n.zac ? tabule.objekty.find(o => o.id === n.zac) : null;
          const cil = najdiCil(p, zac);
          akce.cil = cil;
          if (e.shiftKey && !cil && !zac) q = J.omez('cara', akce.p0.x, akce.p0.y, p.x, p.y);
          n.x2 = q.x; n.y2 = q.y; n.kon = cil ? cil.id : null;
          if (!zac) { n.x1 = akce.p0.x; n.y1 = akce.p0.y; }
          J.prepoj(tabule.objekty.concat([n]), [n]);
          J.zneplatni(n);
        } else {
          if (e.shiftKey) q = J.omez('tvar', akce.p0.x, akce.p0.y, p.x, p.y);
          Object.assign(n, obdelnik(akce.p0, q));
        }
        prekresli();
        break;
      }
      case 'guma': gumuj(p); break;
      case 'laser': laser.push({ x: p.x, y: p.y, t: performance.now() }); prekresli(); break;
      case 'ramecek': {
        akce.p1 = p;
        const r = obdelnik(akce.p0, p);
        vyber = new Set(akce.puvodni);
        for (const o of tabule.objekty) if (!zamceny(o) && J.obsahuje(r, J.hranice(o))) vyber.add(o.id);
        rozsirSkupiny();
        obnovStavRadek();
        prekresli();
        break;
      }
      case 'presun': {
        if (akce.kopirovat && (p.x !== akce.p0.x || p.y !== akce.p0.y)) {
          const kopie = J.klonuj(vybrane());
          tabule.objekty.push(...kopie);
          vyber = new Set(kopie.map(x => x.id));
          zacniPresun(akce.p0);
        }
        let dx = p.x - akce.p0.x, dy = p.y - akce.p0.y;
        if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
        akce.vod = null;
        if (tabule.prichytit && tabule.mrizka !== 'ne') { dx = prichyt(akce.h0.x + dx) - akce.h0.x; dy = prichyt(akce.h0.y + dy) - akce.h0.y; }
        else if (!e.ctrlKey && !e.metaKey) {
          const r = J.voditka(akce.h0, dx, dy, akce.ostatni, 6 / k.z);
          if (!e.shiftKey || dy === 0) dx = r.dx;
          if (!e.shiftKey || dx === 0) dy = r.dy;
          akce.vod = { x: r.x, y: r.y };
        }
        akce.pohyb.forEach(o => J.premisti(o, dx - akce.dx, dy - akce.dy));
        akce.dx = dx; akce.dy = dy;
        prekresli();
        break;
      }
      case 'konec': {
        const o = akce.o, druhy = akce.kt === '1' ? [o.x2, o.y2] : [o.x1, o.y1];
        const cil = najdiCil(p, o);
        akce.cil = cil;
        let q = { x: prichyt(p.x), y: prichyt(p.y) };
        if (e.shiftKey && !cil) q = J.omez('cara', druhy[0], druhy[1], p.x, p.y);
        if (akce.kt === '1') { o.x1 = q.x; o.y1 = q.y; o.zac = cil ? cil.id : null; }
        else { o.x2 = q.x; o.y2 = q.y; o.kon = cil ? cil.id : null; }
        J.zneplatni(o);
        J.prepoj(tabule.objekty, [o]);
        prekresli();
        break;
      }
      case 'zmena': zmenVelikost(p, e.shiftKey); break;
    }
  });

  function zmenVelikost(p, shift) {
    const { u, h0 } = akce;
    const ax = u.includes('w') ? h0.x + h0.w : h0.x, ay = u.includes('n') ? h0.y + h0.h : h0.y;
    const hx = u.includes('w') ? h0.x : h0.x + h0.w, hy = u.includes('n') ? h0.y : h0.y + h0.h;
    const vodor = u.includes('e') || u.includes('w'), svisle = u.includes('n') || u.includes('s');
    let sx = vodor && hx !== ax ? (p.x - ax) / (hx - ax) : 1;
    let sy = svisle && hy !== ay ? (p.y - ay) / (hy - ay) : 1;
    if (akce.rovnomerne !== shift) {
      const m = vodor && svisle ? Math.max(Math.abs(sx), Math.abs(sy)) : Math.abs(vodor ? sx : sy);
      sx = Math.sign(sx || 1) * m; sy = Math.sign(sy || 1) * m;
    }
    const min = 0.01;
    if (Math.abs(sx) < min) sx = min * Math.sign(sx || 1);
    if (Math.abs(sy) < min) sy = min * Math.sign(sy || 1);
    for (const o of vybrane()) {
      if (!akce.puvodni.has(o.id)) continue;
      const puv = JSON.parse(akce.puvodni.get(o.id));
      Object.assign(o, puv);
      J.zneplatni(o);
      J.skaluj(o, ax, ay, sx, sy);
    }
    prekresli();
  }

  function konecUkazatele(e) {
    ukazatele.delete(e.pointerId);
    if (!akce) return;
    if (akce.typ === 'pinch') { if (!ukazatele.size) { akce = akce.krivka || null; prekresli(); } return; }
    if (akce.typ === 'krivka') return;          // křivka pokračuje dalším klikem
    const a = akce;
    akce = null;
    const z = kam().z;
    switch (a.typ) {
      case 'posun': plocha.dataset.kurzor = KURZORY[nastroj] || ''; break;
      case 'kresba': {
        const n = a.nahled;
        if (n.tl) {                     // štětec se ke konci zúží
          const L = n.tl.length;
          for (let i = 0; i < Math.min(5, L - 1); i++) n.tl[L - 1 - i] = Math.round(n.tl[L - 1 - i] * (0.3 + 0.7 * i / 5) * 100) / 100;
        } else {
          n.body = J.zredukuj(n.body, 0.7 / z);
          if (n.body.length === 4 && n.body[0] === n.body[2] && n.body[1] === n.body[3]) n.body.length = 2;
        }
        let nove = [n];
        if (styl.rozpoznat && !a.sym.length && !n.zvyr) {
          const r = J.rozpoznej(n.body);
          if (r) nove = [rozpoznanyObjekt(r, n)];
        }
        for (const f of a.sym) {
          const c = JSON.parse(JSON.stringify(n));
          c.id = J.noveId();
          J.transformuj(c, f);
          nove.push(c);
        }
        tabule.objekty.push(...nove);
        zapis();
        break;
      }
      case 'tvar': {
        const n = a.nahled;
        const maly = n.typ === 'cara' ? Math.hypot(n.x2 - n.x1, n.y2 - n.y1) * z < 3 && !(n.zac && n.kon) : (n.w * z < 3 || n.h * z < 3);
        if (maly) { prekresli(); break; }
        if (n.typ === 'ram') tabule.objekty.unshift(n); else tabule.objekty.push(n);
        zapis();
        break;
      }
      case 'guma':
        if (a.mazat.size) { tabule.objekty = tabule.objekty.filter(o => !a.mazat.has(o.id)); vyber.clear(); zapis(); }
        else prekresli();
        break;
      case 'laser': prekresli(); break;
      case 'ramecek': poZmene(false); break;
      case 'presun':
        // spojnice přesunutá bez svého cíle se od něj odpojí
        for (const c of a.pohyb) {
          if (c.typ !== 'cara') continue;
          if (c.zac && !a.ids.has(c.zac)) c.zac = null;
          if (c.kon && !a.ids.has(c.kon)) c.kon = null;
        }
        plocha.dataset.kurzor = KURZORY[nastroj] || '';
        zapis();
        prekresli();
        break;
      case 'konec': case 'zmena':
        plocha.dataset.kurzor = KURZORY[nastroj] || '';
        zapis();
        prekresli();
        break;
    }
  }
  platno.addEventListener('pointerup', konecUkazatele);
  platno.addEventListener('pointercancel', e => { ukazatele.delete(e.pointerId); zrusAkci(); });
  platno.addEventListener('pointerleave', () => { mys.uvnitr = false; kresliStopu(); if (nastroj === 'guma') prekresli(); });

  platno.addEventListener('dblclick', e => {
    if (akce && akce.typ === 'krivka') return dokonciKrivku(false);
    if (nastroj !== 'vyber') return;
    const s = poziceObr(e), p = naSvet(s.x, s.y);
    const o = J.najdi(tabule.objekty, p.x, p.y, 5 / kam().z, zamceny);
    if (o && UPRAVITELNE.includes(o.typ)) return otevriEditor(o);
    if (o && o.typ === 'ram') return prejmenovatRam(o);
    if (!o) {
      const t = novyText(p);
      tabule.objekty.push(t);
      otevriEditor(t);
    }
  });

  // kolečko = posun, Ctrl/⌘ + kolečko (i sevření na touchpadu) = zoom
  platno.addEventListener('wheel', e => {
    e.preventDefault();
    const s = poziceObr(e), k = kam();
    const nasobek = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
    if (e.ctrlKey || e.metaKey) {
      zoomNa(k.z * Math.exp(-e.deltaY * nasobek * 0.0025), s.x, s.y);
    } else {
      const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX, dy = e.shiftKey && !e.deltaX ? 0 : e.deltaY;
      k.x += dx * nasobek / k.z; k.y += dy * nasobek / k.z;
      poKamere();
    }
  }, { passive: false });

  platno.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (prezentace) return;
    if (akce && akce.typ !== 'krivka') zrusAkci();     // dlouhý stisk prstem nesmí dokreslit tečku
    obdelnikPlatna = platno.getBoundingClientRect();
    const s = poziceObr(e), p = naSvet(s.x, s.y), tol = 5 / kam().z;
    mys.x = s.x; mys.y = s.y; mys.uvnitr = true;
    kontextBod = { x: s.x, y: s.y };
    const o = J.najdi(tabule.objekty, p.x, p.y, tol, zamceny);
    kontextZamceny = o ? null : J.najdi(tabule.objekty, p.x, p.y, tol, x => !x.zamek || skryty(x));
    if (o && !vyber.has(o.id)) { vyber = new Set([o.id]); rozsirSkupiny(); if (nastroj !== 'vyber') zvolNastroj('vyber'); poZmene(false); }
    if (!o && vyber.size) { vyber.clear(); poZmene(false); }
    const n = $('nabKontext'), v = vybrane();
    n.querySelectorAll('[data-vyber]').forEach(x => { x.hidden = !vyber.size; });
    n.querySelectorAll('[data-bez-vyberu]').forEach(x => { x.hidden = !!vyber.size; });
    n.querySelectorAll('[data-jeden]').forEach(x => { x.hidden = !(v.length === 1 && UPRAVITELNE.includes(v[0].typ)); });
    n.querySelectorAll('[data-skupina]').forEach(x => { x.hidden = !v.some(y => y.skupina); });
    n.querySelectorAll('[data-zamek]').forEach(x => { x.hidden = !kontextZamceny; });
    n.querySelectorAll('[data-obr]').forEach(x => { x.hidden = !v.some(y => y.typ === 'obr'); });
    zavriNabidky();
    n.hidden = false;
    n.style.left = Math.max(6, Math.min(e.clientX, innerWidth - n.offsetWidth - 6)) + 'px';
    n.style.top = Math.max(6, Math.min(e.clientY, innerHeight - n.offsetHeight - 6)) + 'px';
  });

  // ---------- zoom ----------
  function zoomNa(z, sx = sirkaPlochy() / 2, sy = vyskaPlochy() / 2) {
    const k = kam(), w = naSvet(sx, sy);
    k.z = Math.max(0.05, Math.min(16, z));
    k.x = w.x - sx / k.z; k.y = w.y - sy / k.z;
    poKamere();
  }
  function zobrazitOblast(h, okraj, maxZ = 4) {
    const k = kam();
    k.z = Math.max(0.05, Math.min(maxZ, (sirkaPlochy() - 2 * okraj) / Math.max(h.w, 1), (vyskaPlochy() - 2 * okraj) / Math.max(h.h, 1)));
    k.x = h.x + h.w / 2 - sirkaPlochy() / 2 / k.z;
    k.y = h.y + h.h / 2 - vyskaPlochy() / 2 / k.z;
    poKamere(!prezentace);
  }
  function zobrazit(objekty) {
    const h = J.hraniceVsech(objekty), k = kam();
    if (!h) { k.x = -sirkaPlochy() / 2; k.y = -vyskaPlochy() / 2; k.z = 1; return poKamere(); }
    zobrazitOblast(h, 60);
  }

  // ---------- editor textu a popisků ----------
  function otevriEditor(o) {
    potvrdEditor();
    if ((o.typ === 'tvar' || o.typ === 'cara') && !o.velikost) { o.velikost = Math.min(styl.velikost, 36); o.pismo = styl.pismo; }
    zvolNastroj(nastroj === 'listek' || nastroj === 'text' ? nastroj : 'vyber');
    vyber = new Set([o.id]);
    const el = document.createElement('textarea');
    el.className = 'editor' + (o.typ === 'listek' ? ' listek' : '') + (o.typ === 'tvar' || o.typ === 'cara' ? ' stitek' : '');
    el.value = o.text || '';
    el.setAttribute('aria-label', o.typ === 'listek' ? 'Text lístku' : o.typ === 'text' ? 'Text' : 'Popisek');
    el.setAttribute('data-i18n', 'ne');
    plocha.appendChild(el);
    editor = { o, el };
    umistiEditor();
    el.focus();
    if (o.text) el.select();
    el.addEventListener('input', umistiEditor);
    el.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); potvrdEditor(); platno.focus(); }
    });
    el.addEventListener('blur', () => potvrdEditor());
    prekresli();
  }

  function umistiEditor() {
    const { o, el } = editor, z = kam().z;
    el.style.font = `${(o.velikost || 20) * z}px ${J.PISMA[o.pismo] || J.PISMA.sans}`;
    el.style.lineHeight = J.RADEK;
    el.style.opacity = o.alfa == null ? 1 : o.alfa;
    if (o.typ === 'listek') {
      const s = naObr(o.x, o.y);
      el.style.left = s.x + 'px'; el.style.top = s.y + 'px';
      el.style.width = o.w * z + 'px'; el.style.height = o.h * z + 'px';
      el.style.padding = J.OKRAJ_LISTKU * z + 'px';
      el.style.color = J.textNaPodklad(o.barva);
      el.style.background = o.barva;
      return;
    }
    if (o.typ === 'text') {
      const s = naObr(o.x, o.y);
      el.style.left = s.x + 'px'; el.style.top = s.y + 'px';
      el.style.color = o.barva;
      el.style.width = '1px'; el.style.height = '1px';
      el.style.width = Math.max(el.scrollWidth + o.velikost * z * 0.6, 30) + 'px';
      el.style.height = el.scrollHeight + 'px';
      return;
    }
    // popisek tvaru / čáry – vycentrovaný
    let stredS, sirka;
    if (o.typ === 'tvar') {
      const p = J.popisekTvaru(Object.assign({}, o, { text: el.value }));
      stredS = naObr(p.cx, p.cy); sirka = p.sirka * z;
      el.style.color = J.barvaPopisku(o);
      el.style.background = 'transparent';
    } else {
      stredS = naObr(J.stredCary(o).x, J.stredCary(o).y);
      el.style.width = '1px';
      sirka = Math.max(el.scrollWidth + (o.velikost || 20) * z, 60);
      el.style.color = o.barva;
      el.style.background = tabule.pozadi;
    }
    el.style.width = sirka + 'px';
    el.style.height = '1px';
    const v = el.scrollHeight;
    el.style.height = v + 'px';
    el.style.left = stredS.x - sirka / 2 + 'px';
    el.style.top = stredS.y - v / 2 + 'px';
  }

  function potvrdEditor() {
    if (!editor) return;
    const { o, el } = editor;
    editor = null;
    el.remove();
    o.text = el.value.replace(/\s+$/, '');
    J.zneplatni(o);
    if (o.typ === 'text' && !o.text) {
      tabule.objekty = tabule.objekty.filter(x => x !== o);
      vyber.delete(o.id);
    }
    if ((o.typ === 'tvar' || o.typ === 'cara') && !o.text) delete o.text;
    zapis();
    prekresli();
  }

  async function prejmenovatRam(r) {
    const n = await Dialog.zeptej('Název rámu', r.nazev || '');
    if (n == null) return;
    r.nazev = n.trim().slice(0, 120);
    J.zneplatni(r);
    zapis();
  }

  // ---------- hledání ----------
  const hledani = { nalezy: [], i: -1 };
  const bezDiakritiky = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  function otevriHledani() {
    $('hledani').hidden = false;
    $('hledatText').focus();
    $('hledatText').select();
    hledej();
  }
  function zavriHledani() {
    $('hledani').hidden = true;
    hledani.nalezy = []; hledani.i = -1;
  }
  function hledej() {
    const q = bezDiakritiky($('hledatText').value.trim());
    hledani.nalezy = q ? tabule.objekty.filter(o => !skryty(o) && bezDiakritiky(J.textObjektu(o)).includes(q)).map(o => o.id) : [];
    hledani.i = -1;
    if (hledani.nalezy.length) dalsiNalez(1);
    else $('hledatPocet').textContent = q ? '0 / 0' : '';
  }
  function dalsiNalez(smer) {
    const n = hledani.nalezy.length;
    if (!n) return;
    hledani.i = (hledani.i + smer + n) % n;
    const o = tabule.objekty.find(x => x.id === hledani.nalezy[hledani.i]);
    if (!o) return hledej();              // tabule se od hledání změnila
    $('hledatPocet').textContent = `${hledani.i + 1} / ${n}`;
    vyber = new Set([o.id]);
    const h = J.hranice(o), v = viditelnaOblast();
    if (h.w > v.w * 0.8 || h.h > v.h * 0.8 || kam().z < 0.4) zobrazitOblast(h, 80, 1.5);
    else { const k = kam(); k.x = h.x + h.w / 2 - v.w / 2; k.y = h.y + h.h / 2 - v.h / 2; poKamere(false); }
    poZmene(false);
  }
  $('hledatText').addEventListener('input', hledej);
  $('hledatText').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); dalsiNalez(e.shiftKey ? -1 : 1); }
    if (e.key === 'Escape') { e.preventDefault(); zavriHledani(); platno.focus(); }
  });

  // ---------- prezentace ----------
  function prezentovat() {
    if (prezentace) return;
    potvrdEditor(); zrusAkci(); zavriNabidky(); zavriHledani();
    const vid = viditelneObjekty();
    const ramy = J.poradiRamu(vid);
    const vse = J.hraniceVsech(vid);
    const snimky = ramy.length ? ramy.map(r => ({ x: r.x, y: r.y, w: r.w, h: r.h, nazev: r.nazev })) : (vse ? [vse] : []);
    if (!snimky.length) return info('Tabule je prázdná – není co prezentovat.');
    prezentace = { snimky, i: 0, kamera: Object.assign({}, kam()), nastroj, bezRamu: !ramy.length };
    vyber.clear();
    document.body.classList.add('prezentace');
    zvolNastroj('laser');
    // Esc za celé obrazovky si vezme prohlížeč – konec fullscreenu proto ukončí i prezentaci
    if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => { if (prezentace) prezentace.fs = true; }).catch(() => {});
    }
    $('prezPanel').hidden = false;
    ukazSnimek(0);
    if (!ramy.length) info('Tabule nemá rámy – ukazuji ji celou. Rámy (M) z ní udělají snímky.');
  }
  function ukazSnimek(i) {
    const p = prezentace;
    p.i = Math.max(0, Math.min(p.snimky.length - 1, i));
    const s = p.snimky[p.i];
    zobrazitOblast(s, p.bezRamu ? 30 : 0, 16);
    $('prezCitac').textContent = `${p.i + 1} / ${p.snimky.length}` + (s.nazev ? ' · ' + s.nazev : '');
  }
  function ukoncitPrezentaci() {
    if (!prezentace) return;
    const p = prezentace;
    prezentace = null;
    document.body.classList.remove('prezentace');
    $('prezPanel').hidden = true;
    Object.assign(kam(), p.kamera);
    zvolNastroj(p.nastroj);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    poKamere(false);
  }

  document.addEventListener('fullscreenchange', () => {
    if (prezentace && prezentace.fs && !document.fullscreenElement) ukoncitPrezentaci();
  });

  // ---------- lišta: popisky tlačítek jen když se vejdou (závisí na jazyku a šířce okna) ----------
  const lista = $('lista');
  // pořadí, ve kterém popisky ustupují (od nejméně důležitých)
  const PORADI_POPISKU = ['vlozitSchranka', 'prezentovat', 'nabSablony', 'nabUsporadat', 'nabVlozit', 'nabVrstvy', 'nabZobrazit', 'nabUpravit', 'nabSoubor', 'nabExport'];
  const popiskyListy = PORADI_POPISKU.map(k => lista.querySelector(`[data-prikaz="${k}"] .txt, [data-nabidka="${k}"] .txt`)).filter(Boolean);
  const pretika = () => lista.scrollWidth > lista.clientWidth + 1;
  function prizpusobListu() {
    lista.classList.remove('uzka3');
    popiskyListy.forEach(t => t.classList.remove('schovat'));
    for (const t of popiskyListy) { if (!pretika()) return; t.classList.add('schovat'); }
    if (pretika()) lista.classList.add('uzka3');      // jinak se lišta posouvá (telefon)
  }
  let listaPlan = 0;      // přepočet až v dalším snímku – změna tříd uvnitř zpětného volání by hlásila smyčku ResizeObserveru
  const roLista = new ResizeObserver(() => { if (!listaPlan) listaPlan = requestAnimationFrame(() => { listaPlan = 0; prizpusobListu(); }); });
  roLista.observe(lista);
  lista.querySelectorAll('.skup').forEach(sk => roLista.observe(sk));      // překlad změní šířku skupin

  // ---------- vrstvy ----------
  // po každé změně: doplnit/seřadit (jádro), mapa, výběr bez nepřístupných objektů, panel
  function obnovVrstvy() {
    tabule.aktivniVrstva = J.normalizujVrstvy(tabule, tabule.aktivniVrstva, T('Vrstva {n}', { n: 1 }));
    mapaVrstev = new Map(tabule.vrstvy.map(v => [v.id, v]));
    if (vyber.size) for (const o of tabule.objekty) if (vyber.has(o.id) && vrstvaNepristupna(o)) vyber.delete(o.id);
    mm.platne = false;
    vykresliPanelVrstev();
  }
  const aktivniVrstva = () => mapaVrstev.get(tabule.aktivniVrstva) || tabule.vrstvy[tabule.vrstvy.length - 1];
  const indexVrstvy = id => tabule.vrstvy.findIndex(v => v.id === id);
  const pocetVeVrstve = id => tabule.objekty.reduce((n, o) => n + (o.vrstva === id), 0);
  function aktivniPristupna() {
    const v = aktivniVrstva();
    if (v && v.skryta) { info('Aktivní vrstva je skrytá – zobrazte ji, nebo v panelu vrstev vyberte jinou.'); return false; }
    if (v && v.zamcena) { info('Aktivní vrstva je zamčená – odemkněte ji, nebo v panelu vrstev vyberte jinou.'); return false; }
    return true;
  }
  function volnyNazevVrstvy() {
    let n = tabule.vrstvy.length + 1;
    while (tabule.vrstvy.some(v => v.nazev === T('Vrstva {n}', { n }))) n++;
    return T('Vrstva {n}', { n });
  }
  function aktivujVrstvu(id) {
    if (!mapaVrstev.has(id)) return;
    if (tabule.aktivniVrstva === id) return;
    tabule.aktivniVrstva = id;
    naplanujUlozeni();
    // výběr zůstává – vybrané objekty jde pak tlačítkem ⇲ přesunout do této vrstvy; nové vybírání už jen v ní
    vykresliPanelVrstev();
    prekresli();
  }
  function prepniJenAktivni() {
    jenAktivni = !jenAktivni;
    ulozNastaveni();
    vykresliPanelVrstev();
    info(jenAktivni ? 'Vybírat a posouvat jde jen objekty aktivní vrstvy.' : 'Vybírat a posouvat jde objekty všech viditelných vrstev.');
  }
  function novaVrstva() {
    const v = { id: 'v' + J.noveId(), nazev: volnyNazevVrstvy() };
    tabule.vrstvy.splice(indexVrstvy(aktivniVrstva().id) + 1, 0, v);
    tabule.aktivniVrstva = v.id;
    zapis();
  }
  function duplikovatVrstvu() {
    const a = aktivniVrstva();
    const v = Object.assign({}, a, { id: 'v' + J.noveId(), nazev: T('{nazev} – kopie', { nazev: a.nazev }).slice(0, 120) });
    const kopie = J.klonuj(tabule.objekty.filter(o => o.vrstva === a.id));
    kopie.forEach(o => { o.vrstva = v.id; });
    tabule.vrstvy.splice(indexVrstvy(a.id) + 1, 0, v);
    tabule.objekty.push(...kopie);
    tabule.aktivniVrstva = v.id;
    zapis();
  }
  async function smazatVrstvu(id = aktivniVrstva().id) {
    const v = mapaVrstev.get(id);
    if (!v) return;
    if (tabule.vrstvy.length === 1) return info('Tabule musí mít aspoň jednu vrstvu.');
    const n = pocetVeVrstve(id);
    if (n && !await Dialog.potvrd(T('Smazat vrstvu „{nazev}“ i s objekty ({n})? Vrátit jde přes Zpět.', { nazev: v.nazev, n }))) return;
    const i = indexVrstvy(id);
    tabule.objekty = tabule.objekty.filter(o => o.vrstva !== id);
    tabule.vrstvy.splice(i, 1);
    if (tabule.aktivniVrstva === id) tabule.aktivniVrstva = tabule.vrstvy[Math.max(0, i - 1)].id;
    zapis();
  }
  async function prejmenovatVrstvu(id = aktivniVrstva().id) {
    const v = mapaVrstev.get(id);
    if (!v) return;
    const n = await Dialog.zeptej('Název vrstvy', v.nazev);
    if (n == null || !n.trim() || n.trim() === v.nazev) return;
    v.nazev = n.trim().slice(0, 120);
    zapis();
  }
  function posunVrstvu(id, kam) {
    const i = indexVrstvy(id), j = i + kam;
    if (i < 0 || j < 0 || j >= tabule.vrstvy.length) return;
    const [v] = tabule.vrstvy.splice(i, 1);
    tabule.vrstvy.splice(j, 0, v);
    zapis();
  }
  function presunVrstvuNa(id, j) {           // tažení v panelu
    const i = indexVrstvy(id);
    if (i < 0 || i === j) return;
    const [v] = tabule.vrstvy.splice(i, 1);
    tabule.vrstvy.splice(Math.max(0, Math.min(tabule.vrstvy.length, j)), 0, v);
    zapis();
  }
  function sloucitDolu() {
    const a = aktivniVrstva(), i = indexVrstvy(a.id);
    if (i <= 0) return info('Pod touto vrstvou už žádná není.');
    const b = tabule.vrstvy[i - 1];
    if (b.zamcena || b.skryta) return info('Vrstva pod ní je skrytá nebo zamčená – nejdřív ji zobrazte a odemkněte.');
    J.slucVrstvy(tabule, a.id, b.id);
    tabule.aktivniVrstva = b.id;
    zapis();
  }
  function sloucitViditelne() {
    const vid = tabule.vrstvy.filter(v => !v.skryta);
    if (vid.length < 2) return info('Ke sloučení jsou potřeba aspoň dvě viditelné vrstvy.');
    const cil = vid[0];
    delete cil.zamcena;
    for (const v of vid.slice(1)) J.slucVrstvy(tabule, v.id, cil.id);
    tabule.aktivniVrstva = cil.id;
    zapis();
  }
  function prepniSkryti(id = aktivniVrstva().id) {
    const v = mapaVrstev.get(id);
    if (!v) return;
    if (v.skryta) delete v.skryta; else v.skryta = true;
    zapis();
  }
  function prepniZamekVrstvy(id = aktivniVrstva().id) {
    const v = mapaVrstev.get(id);
    if (!v) return;
    if (v.zamcena) delete v.zamcena; else v.zamcena = true;
    zapis();
  }
  function zobrazitVsechnyVrstvy() {
    tabule.vrstvy.forEach(v => { delete v.skryta; });
    zapis();
  }
  function vybratVrstvu(id = aktivniVrstva().id) {
    const v = mapaVrstev.get(id);
    if (!v || v.skryta || v.zamcena) return info('Skrytá nebo zamčená vrstva se nedá vybrat.');
    zvolNastroj('vyber');
    vyber = new Set(tabule.objekty.filter(o => o.vrstva === id && !o.zamek).map(o => o.id));
    poZmene(false);
  }
  function vyberDoVrstvy(id = aktivniVrstva().id) {
    const v = mapaVrstev.get(id), ob = vybrane();
    if (!v || !ob.length) return info('Nejdřív vyberte objekty, které se mají přesunout.');
    ob.forEach(o => { o.vrstva = id; });
    zapis();
    info(T('Přesunuto do vrstvy „{nazev}“.', { nazev: v.nazev }));
  }

  // panel vrstev: nahoře nejvyšší vrstva (jako v grafických editorech)
  const seznamVrstev = $('seznamVrstev');
  function vykresliPanelVrstev() {
    const panel = $('panelVrstev');
    panel.hidden = !panelVrstev;
    $('tlPanelVrstev').setAttribute('aria-pressed', panelVrstev);
    if (!panelVrstev || !tabule) return;
    const vybraneVrstvy = new Set(vybrane().map(o => o.vrstva));
    const pocty = new Map();
    for (const o of tabule.objekty) pocty.set(o.vrstva, (pocty.get(o.vrstva) || 0) + 1);
    // řádky se aktualizují na místě – přestavění seznamu mezi dvěma kliky by zrušilo dvojklik (přejmenování)
    const poradi = tabule.vrstvy.slice().reverse();
    const stare = [...seznamVrstev.children];
    if (stare.length !== poradi.length || stare.some((li, i) => li.dataset.id !== poradi[i].id)) {
      seznamVrstev.replaceChildren(...poradi.map(v => {
        const li = document.createElement('li');
        li.className = 'pv-radek';
        li.dataset.id = v.id;
        li.draggable = true;
        const oko = document.createElement('button');
        oko.className = 'tl ik pv-oko'; oko.dataset.akce = 'oko';
        const zam = document.createElement('button');
        zam.className = 'tl ik pv-zamek'; zam.dataset.akce = 'zamek';
        const jm = document.createElement('span');
        jm.className = 'pv-nazev'; jm.dataset.i18n = 'ne';
        jm.title = 'Dvojklik = přejmenovat';
        const pc = document.createElement('span');
        pc.className = 'pv-pocet';
        li.append(oko, zam, jm, pc);
        return li;
      }));
    }
    [...seznamVrstev.children].forEach((li, i) => {
      const v = poradi[i], [oko, zam, jm, pc] = li.children;
      li.classList.toggle('skryta', !!v.skryta);
      li.toggleAttribute('aria-current', v.id === tabule.aktivniVrstva);
      oko.textContent = v.skryta ? '⊘' : '👁';
      oko.title = v.skryta ? 'Zobrazit vrstvu' : 'Skrýt vrstvu';
      oko.setAttribute('aria-pressed', !v.skryta);
      zam.textContent = v.zamcena ? '🔒' : '🔓';
      zam.title = v.zamcena ? 'Odemknout vrstvu' : 'Zamknout vrstvu';
      zam.setAttribute('aria-pressed', !!v.zamcena);
      if (jm.textContent !== v.nazev) jm.textContent = v.nazev;
      pc.textContent = (vybraneVrstvy.has(v.id) ? '● ' : '') + (pocty.get(v.id) || 0) + (v.alfa != null && v.alfa < 1 ? ` · ${Math.round(v.alfa * 100)} %` : '');
    });
    obnovOvladaniPanelu();
  }
  function obnovOvladaniPanelu() {
    const a = aktivniVrstva(), i = indexVrstvy(a.id);
    const alfa = Math.round((a.alfa == null ? 1 : a.alfa) * 100);
    $('krytiVrstvy').value = alfa; $('krytiVrstvyHodn').textContent = alfa + ' %';
    $('pvVys').disabled = i === tabule.vrstvy.length - 1;
    $('pvNiz').disabled = $('pvSloucit').disabled = i === 0;
    $('pvSmazat').disabled = tabule.vrstvy.length === 1;
    $('pvVyberSem').disabled = !vyber.size;
    $('tlJenAktivni').setAttribute('aria-pressed', jenAktivni);
  }
  seznamVrstev.addEventListener('click', e => {
    const li = e.target.closest('.pv-radek');
    if (!li) return;
    const b = e.target.closest('[data-akce]');
    if (b && b.dataset.akce === 'oko') return prepniSkryti(li.dataset.id);
    if (b && b.dataset.akce === 'zamek') return prepniZamekVrstvy(li.dataset.id);
    aktivujVrstvu(li.dataset.id);
  });
  seznamVrstev.addEventListener('dblclick', e => {
    const li = e.target.closest('.pv-radek');
    if (li && !e.target.closest('[data-akce]')) prejmenovatVrstvu(li.dataset.id);
  });
  let tazenaVrstva = null;
  seznamVrstev.addEventListener('dragstart', e => {
    const li = e.target.closest('.pv-radek');
    if (!li) return;
    tazenaVrstva = li.dataset.id;
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/x-wb-vrstva', tazenaVrstva); } catch (_) { /* starší prohlížeče */ }
  });
  seznamVrstev.addEventListener('dragover', e => {
    if (!tazenaVrstva) return;
    e.preventDefault();
    seznamVrstev.querySelectorAll('.cil').forEach(x => x.classList.remove('cil'));
    const li = e.target.closest('.pv-radek');
    if (li) li.classList.add('cil');
  });
  seznamVrstev.addEventListener('drop', e => {
    if (!tazenaVrstva) return;
    e.preventDefault(); e.stopPropagation();
    const li = e.target.closest('.pv-radek');
    if (li) presunVrstvuNa(tazenaVrstva, indexVrstvy(li.dataset.id));
    tazenaVrstva = null;
  });
  seznamVrstev.addEventListener('dragend', () => { tazenaVrstva = null; seznamVrstev.querySelectorAll('.cil').forEach(x => x.classList.remove('cil')); });
  $('krytiVrstvy').addEventListener('input', e => {
    const a = aktivniVrstva(), v = +e.target.value / 100;
    if (v >= 1) delete a.alfa; else a.alfa = v;
    $('krytiVrstvyHodn').textContent = e.target.value + ' %';
    mm.platne = false; prekresli();
  });
  $('krytiVrstvy').addEventListener('change', () => zapis());

  // ---------- export ----------
  const pruhlednyExport = () => pruhledne || !!tabule.pruhledna;
  const viditelneObjekty = () => tabule.objekty.filter(o => !skryty(o));
  const exportObjekty = () => (vyber.size ? vybrane() : viditelneObjekty());
  // pro SVG: krytí vrstvy převést do objektů
  const sKrytimVrstvy = objekty => objekty.map(o => {
    const v = vrstvaObjektu(o);
    return v && v.alfa != null && v.alfa < 1 ? Object.assign({}, o, { alfa: (o.alfa == null ? 1 : o.alfa) * v.alfa }) : o;
  });
  const bezpecneJmeno = s => (s || 'tabule').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'tabule';

  // vykreslí oblast světa (objekty, které ji protínají) do plátna v daném měřítku
  async function vykresliOblast(ob, objekty, meritko, { bezRamu = false, pruhledne: pruh = false } = {}) {
    await nactiVsechnyObrazky(objekty);
    const m = Math.min(meritko, 16000 / ob.w, 16000 / ob.h, Math.sqrt(100e6 / (ob.w * ob.h)));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(ob.w * m)); c.height = Math.max(1, Math.ceil(ob.h * m));
    const x = c.getContext('2d');
    if (!pruh) { x.fillStyle = tabule.pozadi; x.fillRect(0, 0, c.width, c.height); }
    x.setTransform(m, 0, 0, m, -ob.x * m, -ob.y * m);
    const e = Object.assign({}, env, { pozadi: pruh ? null : tabule.pozadi, bezRamu });
    const vid = objekty.filter(o => J.prekryva(J.hranice(o), ob));
    for (const o of vid) if (o.typ === 'ram') J.kresli(x, o, e);
    for (const o of vid) if (o.typ !== 'ram') J.kresli(x, o, e);
    return c;
  }

  async function vykresliPNG(objekty, meritko) {
    const h = J.hraniceVsech(objekty);
    if (!h) return null;
    const okraj = 20;
    return vykresliOblast({ x: h.x - okraj, y: h.y - okraj, w: h.w + 2 * okraj, h: h.h + 2 * okraj }, objekty, meritko, { pruhledne: pruhlednyExport() });
  }

  function stahni(blob, jmeno) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = jmeno;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  async function exportPNG(meritko) {
    const c = await vykresliPNG(exportObjekty(), meritko);
    if (!c) return info('Tabule je prázdná.');
    c.toBlob(b => stahni(b, bezpecneJmeno(tabule.nazev) + '.png'), 'image/png');
  }

  function exportSVG() {
    const o = exportObjekty();
    if (!o.length) return info('Tabule je prázdná.');
    const s = J.svg(sKrytimVrstvy(o), { obrazky: tabule.obrazky, pozadi: pruhlednyExport() ? null : tabule.pozadi });
    stahni(new Blob([s], { type: 'image/svg+xml;charset=utf-8' }), bezpecneJmeno(tabule.nazev) + '.svg');
  }

  function nactiJsPDF() {
    if (window.jspdf) return Promise.resolve();
    return new Promise((ok, ko) => {
      const s = document.createElement('script');
      s.src = 'lib/jspdf.umd.min.js';
      s.onload = ok; s.onerror = () => ko(new Error('Knihovnu PDF se nepodařilo načíst.'));
      document.head.appendChild(s);
    });
  }

  // PDF: stránka na každý rám (v pořadí snímků), bez rámů celá tabule na jedné stránce
  async function exportPDF(stahnout = true) {
    const ramy = J.poradiRamu(viditelneObjekty());
    const h = J.hraniceVsech(viditelneObjekty());
    if (!h) { info('Tabule je prázdná.'); return null; }
    const oblasti = ramy.length ? ramy : [{ x: h.x - 20, y: h.y - 20, w: h.w + 40, h: h.h + 40 }];
    try { await nactiJsPDF(); } catch (e) { chyba(e.message); return null; }
    const { jsPDF } = window.jspdf;
    let pdf = null;
    for (const ob of oblasti) {
      const c = await vykresliOblast(ob, tabule.objekty, 2, { bezRamu: !!ramy.length });
      const w = ob.w * 0.75, v = ob.h * 0.75, orient = w > v ? 'landscape' : 'portrait';
      if (!pdf) pdf = new jsPDF({ orientation: orient, unit: 'pt', format: [w, v], compress: true });
      else pdf.addPage([w, v], orient);
      pdf.addImage(c.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, w, v);
    }
    const blob = pdf.output('blob');
    if (stahnout) {
      stahni(blob, bezpecneJmeno(tabule.nazev) + '.pdf');
      info(ramy.length ? `PDF: ${ramy.length} stran (jedna na rám).` : 'PDF: celá tabule na jedné stránce.');
    }
    return blob;
  }

  async function kopirovatObrazek() {
    const c = await vykresliPNG(exportObjekty(), 2);
    if (!c) return info('Tabule je prázdná.');
    if (!navigator.clipboard || !window.ClipboardItem) return chyba('Prohlížeč neumí kopírovat obrázky do schránky – použijte stažení PNG.');
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': new Promise(ok => c.toBlob(ok, 'image/png')) })]);
      info(vyber.size ? 'Výběr zkopírován jako obrázek.' : 'Tabule zkopírována jako obrázek.');
    } catch (e) {
      chyba('Kopírování obrázku se nepodařilo: ' + e.message);
    }
  }

  function nahled(t) {
    if (!t.objekty.length) return null;
    const h = J.hraniceVsech(t.objekty), W = 320, H = 200, okraj = 10;
    const m = Math.min((W - 2 * okraj) / Math.max(h.w, 1), (H - 2 * okraj) / Math.max(h.h, 1), 2);
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.fillStyle = t.pozadi; x.fillRect(0, 0, W, H);
    x.setTransform(m, 0, 0, m, W / 2 - (h.x + h.w / 2) * m, H / 2 - (h.y + h.h / 2) * m);
    const e = Object.assign({}, env, { pozadi: t.pozadi, bezRamu: false });
    for (const o of t.objekty) if (o.typ === 'ram') J.kresli(x, o, e);
    for (const o of t.objekty) if (o.typ !== 'ram') J.kresli(x, o, e);
    return c.toDataURL('image/jpeg', 0.7);
  }

  function exportJson() {
    const d = {
      format: 'whiteboard', verze: 1, nazev: tabule.nazev, pozadi: tabule.pozadi, pruhledna: !!tabule.pruhledna, mrizka: tabule.mrizka, vrstvy: tabule.vrstvy, aktivniVrstva: tabule.aktivniVrstva,
      objekty: tabule.objekty, obrazky: J.pouziteObrazky(tabule.objekty, tabule.obrazky)
    };
    stahni(new Blob([JSON.stringify(d)], { type: 'application/json' }), bezpecneJmeno(tabule.nazev) + '.whiteboard.json');
  }

  async function importJson(soubor) {
    let d;
    try { d = JSON.parse(await soubor.text()); } catch (e) { return chyba('Soubor není platný JSON.'); }
    if (!d || d.format !== 'whiteboard' || !Array.isArray(d.objekty)) return chyba('Tohle není soubor tabule (.whiteboard.json).');
    if (casovacUlozeni) await ulozit();
    const t = novaTabule(String(d.nazev || volnyNazev()).slice(0, 120));
    if (/^#[0-9a-f]{6}$/i.test(d.pozadi)) t.pozadi = d.pozadi;
    if (d.pruhledna === true) t.pruhledna = true;
    if (Array.isArray(d.vrstvy)) { t.vrstvy = d.vrstvy.filter(v => J.platnaVrstva(v)); t.aktivniVrstva = d.aktivniVrstva; }
    if (['ne', 'ctverce', 'tecky'].includes(d.mrizka)) t.mrizka = d.mrizka;
    t.objekty = J.klonuj(d.objekty.filter(o => J.platnyObjekt(o)));     // nová id – cizí soubor může mít duplicitní
    prevezmiObrazky(t.objekty, d.obrazky, t.obrazky);
    otevriTabuli(t);
    zobrazit(t.objekty);
    await ulozit();
    info(`Otevřeno: ${t.nazev} (${t.objekty.length} objektů)`);
  }

  // ---------- správa tabulí ----------
  async function nova() {
    if (casovacUlozeni) await ulozit();
    const t = novaTabule(volnyNazev());
    otevriTabuli(t);
    zobrazit([]);
    await ulozit();
  }

  async function prejmenovat(id = tabule.id) {
    const meta = seznam.find(t => t.id === id);
    const stare = id === tabule.id ? tabule.nazev : meta && meta.nazev;
    const n = await Dialog.zeptej('Název tabule', stare);
    if (!n || !n.trim() || n.trim() === stare) return;
    const nazev = n.trim().slice(0, 120);
    if (id === tabule.id) {
      tabule.nazev = nazev;
      $('nazevTabule').textContent = nazev;
      document.title = '✏️ ' + nazev + ' – Whiteboard';
      return ulozit();
    }
    const t = await dbCti('tabule:' + id);
    if (!t) return;
    t.nazev = nazev;
    await upravSeznam(sz => { const m = sz.find(x => x.id === id); if (m) m.nazev = nazev; return sz; }, { ['tabule:' + id]: t });
    vykresliGalerii();
  }

  async function duplikovatTabuli(id = tabule.id) {
    if (casovacUlozeni) await ulozit();
    const t = id === tabule.id ? JSON.parse(JSON.stringify(tabule)) : await dbCti('tabule:' + id);
    if (!t) return;
    const ted = new Date().toISOString();
    Object.assign(t, { id: J.noveId(), nazev: t.nazev + ' (kopie)', vytvoreno: ted, upraveno: ted });
    otevriTabuli(t);
    await ulozit();
    info('Vytvořena kopie: ' + t.nazev);
  }

  async function smazatTabuli(id = tabule.id) {
    const meta = seznam.find(t => t.id === id);
    if (!meta) return;
    if (!await Dialog.potvrd(`Smazat tabuli „${meta.nazev}“? Tuto akci nelze vrátit.`)) return;
    await upravSeznam(sz => sz.filter(t => t.id !== id), {}, ['tabule:' + id]);
    if (id === tabule.id) {
      clearTimeout(casovacUlozeni); casovacUlozeni = 0;
      const dalsi = seznam.slice().sort((a, b) => (b.upraveno || '').localeCompare(a.upraveno || ''))[0];
      const t = dalsi && await dbCti('tabule:' + dalsi.id);
      if (t) otevriTabuli(t); else await nova();
    }
    vykresliGalerii();
  }

  function vykresliGalerii() {
    const el = $('seznamTabuli'), hledat = $('hledatTabuli').value.trim().toLowerCase();
    el.textContent = '';
    const s = seznam.slice()
      .filter(t => !hledat || t.nazev.toLowerCase().includes(hledat))
      .sort((a, b) => (b.upraveno || '').localeCompare(a.upraveno || ''));
    if (!s.length) {
      const p = document.createElement('p');
      p.className = 'dat'; p.style.padding = '12px'; p.style.color = 'var(--text-faint)';
      p.textContent = hledat ? 'Nic nenalezeno.' : 'Zatím žádné tabule.';
      el.appendChild(p);
      return;
    }
    for (const t of s) {
      const k = document.createElement('div');
      k.className = 'karta' + (t.id === tabule.id ? ' aktivni' : '');
      k.title = 'Otevřít';
      if (t.nahled) { const i = document.createElement('img'); i.src = t.nahled; i.alt = ''; k.appendChild(i); }
      else { const d = document.createElement('div'); d.className = 'prazdna'; d.textContent = '🗒'; k.appendChild(d); }
      const m = document.createElement('div'); m.className = 'meta';
      const jm = document.createElement('div'); jm.className = 'jm'; jm.textContent = t.nazev; jm.setAttribute('data-i18n', 'ne');
      const dat = document.createElement('div'); dat.className = 'dat';
      dat.textContent = 'Upraveno ' + new Date(t.upraveno).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      m.append(jm, dat);
      const a = document.createElement('div'); a.className = 'akce';
      [['✎', 'Přejmenovat', () => prejmenovat(t.id)], ['⧉', 'Duplikovat', () => duplikovatTabuli(t.id)], ['🗑', 'Smazat', () => smazatTabuli(t.id)]].forEach(([z, popis, fn]) => {
        const b = document.createElement('button');
        b.className = 'tl'; b.textContent = z + ' ' + popis; b.title = popis;
        b.addEventListener('click', e => { e.stopPropagation(); fn(); });
        a.appendChild(b);
      });
      k.append(m, a);
      k.addEventListener('click', () => otevriPodleId(t.id));
      k.tabIndex = 0; k.setAttribute('role', 'button'); k.setAttribute('aria-label', t.nazev);
      k.addEventListener('keydown', e => { if (e.target === k && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); otevriPodleId(t.id); } });
      el.appendChild(k);
    }
  }
  $('hledatTabuli').addEventListener('input', vykresliGalerii);

  function prepniGalerii(otevrit) {
    const g = $('galerie');
    const o = otevrit == null ? !g.classList.contains('otevrena') : otevrit;
    g.classList.toggle('otevrena', o);
    if (!o) return;
    vykresliGalerii();
    // seznam mohlo mezitím změnit jiné okno
    dbCti('seznam').then(sz => { if (Array.isArray(sz)) { seznam = sz; vykresliGalerii(); } }).catch(() => {});
  }

  // ---------- nabídky a příkazy ----------
  const nabSablony = $('nabSablony');
  SABLONY.seznam.forEach(s => {
    const b = document.createElement('button');
    b.className = 'tl'; b.dataset.prikaz = 'sab-' + s.id; b.title = s.popis;
    b.textContent = s.nazev;
    nabSablony.appendChild(b);
  });

  function zavriNabidky() {
    document.querySelectorAll('.nabidka:not([hidden])').forEach(n => { n.hidden = true; });
    document.querySelectorAll('[data-nabidka][aria-expanded="true"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
  }
  function obnovNabidky() {
    document.querySelectorAll('[data-prikaz^="mrizka-"]').forEach(b => b.setAttribute('aria-pressed', b.dataset.prikaz === 'mrizka-' + tabule.mrizka));
    document.querySelectorAll('[data-prikaz^="poz-"]').forEach(b => b.setAttribute('aria-pressed', !tabule.pruhledna && b.dataset.prikaz === 'poz-' + tabule.pozadi));
    $('tlPozPruhledna').setAttribute('aria-pressed', !!tabule.pruhledna);
    $('tlPrichytit').setAttribute('aria-pressed', !!tabule.prichytit);
    $('tlPruhledne').setAttribute('aria-pressed', pruhlednyExport());
    $('tlPruhledne').disabled = !!tabule.pruhledna;      // průhledná tabule se exportuje průhledně vždy
    $('tlMinimapa').setAttribute('aria-pressed', minimapa);
    $('expRozsah').textContent = vyber.size ? `výběr (${vyber.size})` : 'vše';
    // položky, které bez vhodného výběru nic neudělají, jsou zašedlé (kontextová nabídka je skrývá sama)
    const v = vybrane(), n = v.length;
    const av = aktivniVrstva(), ai = indexVrstvy(av.id), nv = tabule.vrstvy.length;
    $('nazevAktivniVrstvy').textContent = av.nazev;
    $('tlVrstvaSkryt').setAttribute('aria-pressed', !!av.skryta);
    $('tlVrstvaZamek').setAttribute('aria-pressed', !!av.zamcena);
    $('tlPanelVrstev2').setAttribute('aria-pressed', panelVrstev);
    $('tlJenAktivni2').setAttribute('aria-pressed', jenAktivni);
    const lze = {
      'vrstva-smazat': nv > 1, 'vrstva-vys': ai < nv - 1, 'vrstva-niz': ai > 0, 'vrstva-sloucit': ai > 0,
      'vrstva-sloucitViditelne': tabule.vrstvy.filter(x => !x.skryta).length > 1, 'vrstva-vyberSem': n,
      'vrstva-zobrazitVse': tabule.vrstvy.some(x => x.skryta), 'vrstva-vybrat': !av.skryta && !av.zamcena,
      vyjmout: n, kopirovat: n, duplikovat: n, smazat: n, zrusitVyber: n, prevratitX: n, prevratitY: n,
      naVrch: n, vys: n, niz: n, naSpod: n, seskupit: n > 1, zamknout: n, ramVyber: n, zobrazitVyber: n,
      rozdelit: v.some(o => o.skupina), upravitText: n === 1 && UPRAVITELNE.includes(v[0].typ)
    };
    document.querySelectorAll('.nabidka:not(#nabKontext) [data-prikaz]').forEach(b => {
      const p = b.dataset.prikaz;
      if (p in lze) b.disabled = !lze[p];
      else if (p.startsWith('zar-')) b.disabled = n < 2;
      else if (p.startsWith('roz-')) b.disabled = n < 3;
    });
  }
  document.querySelectorAll('[data-nabidka]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    const n = $(b.dataset.nabidka), bylo = !n.hidden;
    zavriNabidky();
    if (bylo) return;
    obnovNabidky();
    n.hidden = false; b.setAttribute('aria-expanded', 'true');
    const r = b.getBoundingClientRect();
    if (b.closest('.nastroje')) {        // z panelu nástrojů vpravo vedle tlačítka
      n.style.left = (r.right + 6) + 'px';
      n.style.top = Math.max(6, Math.min(r.top, innerHeight - n.offsetHeight - 6)) + 'px';
    } else {
      n.style.top = (r.bottom + 4) + 'px';
      n.style.left = Math.max(6, Math.min(r.left, innerWidth - n.offsetWidth - 6)) + 'px';
    }
  }));
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-prikaz]');
    if (b && !b.disabled) {
      e.stopPropagation();
      const zustan = b.classList.contains('prep');
      bodPrikazu = b.closest('#nabKontext') ? kontextBod : null;
      if (!zustan) zavriNabidky();
      prikaz(b.dataset.prikaz);
      if (zustan) obnovNabidky();
      return;
    }
    if (!e.target.closest('.nabidka')) zavriNabidky();
  });
  addEventListener('resize', zavriNabidky);
  $('nazevTabule').addEventListener('click', () => prejmenovat());
  $('nazevTabule').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); prejmenovat(); } });

  function nastavMrizku(m) {
    tabule.mrizka = m;
    $('tlMrizka').setAttribute('aria-pressed', m !== 'ne');
    naplanujUlozeni(); prekresli();
  }

  function prikaz(p) {
    if (p.startsWith('zar-')) { J.zarovnej(vybrane(), p.slice(4)); return zapis(); }
    if (p.startsWith('roz-')) { J.rozmisti(vybrane(), p.slice(4)); return zapis(); }
    if (p.startsWith('mrizka-')) return nastavMrizku(p.slice(7));
    if (p.startsWith('poz-')) { tabule.pozadi = p.slice(4); tabule.pruhledna = false; kontrastPera(); mm.platne = false; naplanujUlozeni(); return prekresli(); }
    if (p.startsWith('sab-')) return vlozSablonu(p.slice(4));
    if (p.startsWith('nastroj-')) return zvolNastroj(p.slice(8));
    switch (p) {
      case 'nova': return nova();
      case 'galerie': return prepniGalerii();
      case 'prejmenovat': return prejmenovat();
      case 'duplikovatTabuli': return duplikovatTabuli();
      case 'smazatTabuli': return smazatTabuli();
      case 'ulozit': return ulozit().then(() => info('Uloženo.'));
      case 'png1': return exportPNG(1);
      case 'png2': return exportPNG(2);
      case 'svg': return exportSVG();
      case 'pdf': return exportPDF();
      case 'kopirovatObr': return kopirovatObrazek();
      case 'pruhledne': pruhledne = !pruhledne; return ulozNastaveni();
      case 'panelVrstev': panelVrstev = !panelVrstev; ulozNastaveni(); return vykresliPanelVrstev();
      case 'vrstva-nova': return novaVrstva();
      case 'vrstva-duplikovat': return duplikovatVrstvu();
      case 'vrstva-prejmenovat': return prejmenovatVrstvu();
      case 'vrstva-smazat': return smazatVrstvu();
      case 'vrstva-vys': return posunVrstvu(aktivniVrstva().id, 1);
      case 'vrstva-niz': return posunVrstvu(aktivniVrstva().id, -1);
      case 'vrstva-sloucit': return sloucitDolu();
      case 'vrstva-sloucitViditelne': return sloucitViditelne();
      case 'vrstva-skryt': return prepniSkryti();
      case 'vrstva-zamknout': return prepniZamekVrstvy();
      case 'vrstva-zobrazitVse': return zobrazitVsechnyVrstvy();
      case 'vrstva-vybrat': return vybratVrstvu();
      case 'vrstva-vyberSem': return vyberDoVrstvy();
      case 'vrstva-jenAktivni': return prepniJenAktivni();
      case 'pozPruhledna': tabule.pruhledna = !tabule.pruhledna; mm.platne = false; naplanujUlozeni(); return prekresli();
      case 'minimapa': minimapa = !minimapa; ulozNastaveni(); mm.platne = false; return prekresli();
      case 'exportJson': return exportJson();
      case 'importJson': return $('souborJson').click();
      case 'zpet': return zpetKrok();
      case 'znovu': return znovuKrok();
      case 'vyjmout': if (vyber.size) { kopirovatInterne(); smazVyber(); } return;
      case 'kopirovat': return kopirovatInterne();
      case 'vlozitSchranka': return vlozitZeSchranky();
      case 'duplikovat': return duplikuj();
      case 'smazat': return smazVyber();
      case 'upravitText': { const v = vybrane(); if (v.length === 1 && UPRAVITELNE.includes(v[0].typ)) otevriEditor(v[0]); return; }
      case 'vybratVse': zvolNastroj('vyber'); vyber = new Set(tabule.objekty.filter(o => !zamceny(o)).map(o => o.id)); return poZmene(false);
      case 'zrusitVyber': vyber.clear(); return poZmene(false);
      case 'vymazat': return vymazatVse();
      case 'obrazek': return $('souborObr').click();
      case 'vlozText': return zvolNastroj('text');
      case 'vlozListek': return zvolNastroj('listek');
      case 'naVrch': case 'naSpod': case 'vys': case 'niz': return poradi(p);
      case 'seskupit': return seskupit();
      case 'rozdelit': return rozdelit();
      case 'zamknout': return zamknout();
      case 'odemknoutVse': return odemknout();
      case 'odemknoutTady': { const o = kontextZamceny && tabule.objekty.find(x => x.id === kontextZamceny.id); return o && odemknout(o); }
      case 'ramVyber': return ramKolemVyberu();
      case 'prevratitX': return prevratit('x');
      case 'prevratitY': return prevratit('y');
      case 'mrizka': return nastavMrizku(tabule.mrizka === 'ne' ? 'ctverce' : 'ne');
      case 'prichytit': tabule.prichytit = !tabule.prichytit; if (tabule.prichytit && tabule.mrizka === 'ne') nastavMrizku('ctverce'); return naplanujUlozeni();
      case 'priblizit': return zoomNa(kam().z * 1.25);
      case 'oddalit': return zoomNa(kam().z / 1.25);
      case 'zoom100': return zoomNa(1);
      case 'zobrazitVse': return zobrazit(tabule.objekty);
      case 'zobrazitVyber': return zobrazit(vyber.size ? vybrane() : tabule.objekty);
      case 'hledat': return otevriHledani();
      case 'hledatDalsi': return dalsiNalez(1);
      case 'hledatPredchozi': return dalsiNalez(-1);
      case 'hledatZavrit': return zavriHledani();
      case 'prezentovat': return prezentovat();
      case 'prezDalsi': return prezentace && ukazSnimek(prezentace.i + 1);
      case 'prezPredchozi': return prezentace && ukazSnimek(prezentace.i - 1);
      case 'prezKonec': return ukoncitPrezentaci();
      case 'celaObrazovka':
        if (document.fullscreenElement) return document.exitFullscreen();
        return document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => info('Celá obrazovka není povolená.'));
      case 'napoveda': return $('pomoc').showModal();
    }
  }

  async function vymazatVse() {
    if (!tabule.objekty.length) return;
    if (!await Dialog.potvrd('Vymazat všechny objekty na tabuli? (Jde vrátit přes Zpět.)')) return;
    tabule.objekty = [];
    vyber.clear();
    zapis();
  }

  // menu „Kopírovat“ – systémová schránka přes execCommand (spustí událost copy)
  let interniSchranka = null;
  function kopirovatInterne() {
    if (!vyber.size) return;
    interniSchranka = dataVyberu();
    if (!document.execCommand('copy') && navigator.clipboard) navigator.clipboard.writeText(interniSchranka).catch(() => {});
  }

  // ---------- schránka (Ctrl+C / X / V) ----------
  const vPoli = () => {
    const a = document.activeElement;
    return a && a !== platno && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || a.isContentEditable);
  };
  document.addEventListener('copy', e => {
    if (vPoli() || !vyber.size) return;
    interniSchranka = dataVyberu();
    e.clipboardData.setData('text/plain', interniSchranka);
    e.preventDefault();
    info(`Zkopírováno: ${vyber.size} objektů`);
  });
  document.addEventListener('cut', e => {
    if (vPoli() || !vyber.size) return;
    e.clipboardData.setData('text/plain', dataVyberu());
    e.preventDefault();
    smazVyber();
  });
  document.addEventListener('paste', e => {
    if (vPoli() || document.querySelector('dialog[open]')) return;
    bodPrikazu = null;
    e.preventDefault();
    if (!vlozData(e.clipboardData) && interniSchranka) vlozText(interniSchranka);
  });

  // ---------- přetažení souborů ----------
  plocha.addEventListener('dragover', e => {
    if (![...e.dataTransfer.types].some(t => t === 'Files' || t === 'text/plain')) return;
    e.preventDefault();
    plocha.classList.add('pretah');
  });
  plocha.addEventListener('dragleave', e => { if (!plocha.contains(e.relatedTarget)) plocha.classList.remove('pretah'); });
  plocha.addEventListener('drop', e => {
    e.preventDefault();
    plocha.classList.remove('pretah');
    obdelnikPlatna = platno.getBoundingClientRect();
    const s = poziceObr(e);
    mys.x = s.x; mys.y = s.y; mys.uvnitr = true;
    vlozData(e.dataTransfer);
  });
  $('souborObr').addEventListener('change', e => { [...e.target.files].forEach((f, i) => vlozObrazek(f, i * 24)); e.target.value = ''; });
  $('souborJson').addEventListener('change', e => { if (e.target.files[0]) importJson(e.target.files[0]); e.target.value = ''; });

  // ---------- klávesnice ----------
  const SIPKY = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  document.addEventListener('keydown', e => {
    if (e.key === 'F1') { e.preventDefault(); return $('pomoc').showModal(); }
    if (prezentace && !editor && !vPoli()) {
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); return ukazSnimek(prezentace.i + 1); }
      if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); return ukazSnimek(prezentace.i - 1); }
      if (e.key === 'Home') return ukazSnimek(0);
      if (e.key === 'End') return ukazSnimek(prezentace.snimky.length - 1);
      if (e.key === 'Escape') return ukoncitPrezentaci();
    }
    if (vPoli() || editor || document.querySelector('dialog[open]')) return;
    // během tažení myší klávesy model nemění (Esc tah zruší)
    if (akce && akce.typ !== 'krivka') { if (e.key === 'Escape') zrusAkci(); return; }
    // mezerník a Enter na tlačítku patří tlačítku
    if ((e.key === ' ' || e.key === 'Enter') && e.target.closest && e.target.closest('button, [role="button"], a[href], summary')) return;
    const ctrl = e.ctrlKey || e.metaKey;
    if (e.key === 'F5') { e.preventDefault(); return prezentovat(); }
    if (e.key === 'Escape') {
      if (document.querySelector('.nabidka:not([hidden])')) return zavriNabidky();
      if (!$('hledani').hidden) return zavriHledani();
      if ($('galerie').classList.contains('otevrena')) return prepniGalerii(false);
      if (akce) return zrusAkci();
      if (vyber.size) { vyber.clear(); return poZmene(false); }
      if (nastroj !== 'vyber') return zvolNastroj('vyber');
      return;
    }
    if (ctrl) {
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); return zpetKrok(); }
      if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); return znovuKrok(); }
      if (k === 'a') { e.preventDefault(); return prikaz('vybratVse'); }
      if (k === 'd') { e.preventDefault(); return duplikuj(); }
      if (k === 's') { e.preventDefault(); return prikaz('ulozit'); }
      if (k === 'o') { e.preventDefault(); return prepniGalerii(true); }
      if (k === 'f') { e.preventDefault(); return otevriHledani(); }
      if (k === 'g') { e.preventDefault(); return e.shiftKey ? rozdelit() : seskupit(); }
      if (k === 'l' && e.shiftKey) { e.preventDefault(); return zamknout(); }
      if (e.code === 'BracketRight') { e.preventDefault(); return poradi(e.shiftKey ? 'naVrch' : 'vys'); }
      if (e.code === 'BracketLeft') { e.preventDefault(); return poradi(e.shiftKey ? 'naSpod' : 'niz'); }
      if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') { e.preventDefault(); return prikaz('priblizit'); }
      if (e.key === '-' || e.code === 'NumpadSubtract') { e.preventDefault(); return prikaz('oddalit'); }
      if (e.key === '0' || e.code === 'Digit0' || e.code === 'Numpad0') { e.preventDefault(); return prikaz('zoom100'); }
      return;
    }
    if (e.altKey) return;
    if (e.key === ' ') {
      e.preventDefault();
      if (!e.repeat && !mezernik) { mezernik = true; if (!akce) plocha.dataset.kurzor = 'ruka'; kresliStopu(); }
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); return smazVyber(); }
    if (e.key === 'Enter' && akce && akce.typ === 'krivka') { e.preventDefault(); return dokonciKrivku(false); }
    if (e.key === 'Enter' && vyber.size === 1) { e.preventDefault(); return prikaz('upravitText'); }
    if (SIPKY[e.key] && vyber.size) {
      e.preventDefault();
      const [x, y] = SIPKY[e.key], krok = e.shiftKey ? 10 : 1;
      posunVyber(x * krok, y * krok);
      clearTimeout(casovacSipek);
      casovacSipek = setTimeout(zapis, 500);      // keyup nemusí přijít (Alt+Tab, Ctrl+F…)
      return;
    }
    if (e.shiftKey && e.code === 'Digit1') return prikaz('zobrazitVse');
    if (e.shiftKey && e.code === 'Digit2') return prikaz('zobrazitVyber');
    if (e.key === '?') return $('pomoc').showModal();
    const k = e.key.toLowerCase();
    if (k === 'g') return prikaz('mrizka');
    if (KLAVESY[k]) zvolNastroj(KLAVESY[k]);
  });
  document.addEventListener('keyup', e => {
    if (e.key === ' ') { mezernik = false; if (!akce) plocha.dataset.kurzor = KURZORY[nastroj] || ''; kresliStopu(); }
    if (SIPKY[e.key] && casovacSipek && !editor && !prezentace) { clearTimeout(casovacSipek); casovacSipek = 0; zapis(); }
  });

  // ---------- téma, ukončení ----------
  function nactiAkcent() {
    akcent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || akcent;
    prekresli();
  }
  new MutationObserver(nactiAkcent).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });
  document.addEventListener('visibilitychange', () => { if (document.hidden && casovacUlozeni) ulozit(); if (document.hidden) pustMezernik(); });
  addEventListener('blur', pustMezernik);
  function pustMezernik() { if (!mezernik) return; mezernik = false; if (!akce) plocha.dataset.kurzor = KURZORY[nastroj] || ''; kresliStopu(); }
  addEventListener('pagehide', () => { if (casovacUlozeni) ulozit(); });

  // ---------- start ----------
  async function start() {
    const n = nactiNastaveni();
    nactiAkcent();
    if (!await otevreniDB) chyba('Prohlížeč nepovolil IndexedDB – tabule se nebude ukládat.');
    try { seznam = (await dbCti('seznam')) || []; } catch (e) { seznam = []; }
    try { await prevedStare(); } catch (e) { chyba('Převod starých kreseb se nepodařil: ' + e.message); }
    let t = null;
    const id = n.posledni || (seznam.slice().sort((a, b) => (b.upraveno || '').localeCompare(a.upraveno || ''))[0] || {}).id;
    if (id) { try { t = await dbCti('tabule:' + id); } catch (e) { t = null; } }
    if (!t && seznam.length) { try { t = await dbCti('tabule:' + seznam[0].id); } catch (e) { t = null; } }
    if (t) otevriTabuli(t);
    else {
      otevriTabuli(novaTabule(volnyNazev()));
      kam().x = -sirkaPlochy() / 2; kam().y = -vyskaPlochy() / 2;
      poKamere(false);
    }
    zvolNastroj('pero');
    obnovPruh();
    prizpusobPlatno();
  }

  // pro testy
  window.WB_APP = {
    get tabule() { return tabule; }, get vyber() { return vyber; }, get nastroj() { return nastroj; }, get prezentace() { return prezentace; },
    styl, prikaz, zvolNastroj, kbelik, vlozText, vlozObjekty, vlozObrazek, vlozSablonu, ulozit, dataVyberu, zapis, exportPDF, vykresliPNG,
    hotovo: null
  };
  window.WB_APP.hotovo = start();
})();

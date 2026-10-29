/* Lamamp – aplikace: okna na ploše, myš a dotyk, přehrávání, playlist, ekvalizér, skiny, menu, klávesy,
   Media Session a ukládání. Stav všech oken je v jednom objektu `s`, který kreslí moduly WA_HLAVNI/WA_EQ/WA_PL. */
(function () {
  'use strict';
  const H = WA_HLAVNI, E = WA_EQ, P = WA_PL, J = WA_JADRO, T = WA_TAGY, O = WA_OKNA, U = WA_ULOZ;
  const $ = id => document.getElementById(id);
  const plocha = $('plocha');
  const KLIC = 'webapp_lamamp_nastaveni';
  const VERZE = '2.95';
  const omez = (v, a, b) => Math.min(b, Math.max(a, v));

  // ---------- nastavení (localStorage) ----------
  const nast = {
    zoom: 'auto', pozadi: 'tmave', rozlozeno: false,
    okna: { hlavni: { x: 0, y: 0 }, eq: { x: 0, y: 116 }, pl: { x: 0, y: 232 } },
    eqVid: true, plVid: true, stinHlavni: false, stinEq: false, stinPl: false, plW: 275, plH: 145,
    hlasitost: 75, balance: 0, shuffle: false, repeat: false, zbyvajici: false, viz: 'spektrum',
    ekv: { zap: false, auto: false, preamp: 0, pasma: new Array(10).fill(0) }, eqPisne: {}, eqVlastni: [],
    prolinani: 0, pamatovat: true, vyhlazeni: false, rezimZvuku: null, skin: '', vzdyNavrchu: false
  };
  // uložené nastavení: převzít jen hodnoty stejného typu jako výchozí (poškozená/stará data nesmí shodit start)
  try {
    const ul = JSON.parse(localStorage.getItem(KLIC) || '{}');
    const typ = v => Array.isArray(v) ? 'pole' : v === null ? 'null' : typeof v;
    const sloucit = (cil, zdroj) => {
      if (typ(zdroj) !== 'object') return;
      for (const kl of Object.keys(cil)) {
        const v = zdroj[kl], vych = cil[kl];
        if (v === undefined || (typ(v) !== typ(vych) && vych !== null)) continue;
        if (typeof v === 'number' && !isFinite(v)) continue;
        if (typ(vych) === 'object' && Object.keys(vych).length) sloucit(vych, v); else cil[kl] = v;
      }
    };
    sloucit(nast, ul);
    if (typ(ul.eqPisne) === 'object') nast.eqPisne = ul.eqPisne;
  } catch (e) { /* poškozené – výchozí */ }
  if (!['auto', '1', '2', '3'].includes(nast.zoom)) nast.zoom = 'auto';
  if (!['spektrum', 'osciloskop', 'vyp'].includes(nast.viz)) nast.viz = 'spektrum';
  if (nast.ekv.pasma.length !== 10 || !nast.ekv.pasma.every(v => typeof v === 'number' && isFinite(v))) nast.ekv.pasma = new Array(10).fill(0);
  nast.eqVlastni = nast.eqVlastni.filter(p => p && typeof p.nazev === 'string' && Array.isArray(p.pasma) && p.pasma.length === 10);
  nast.plW = Math.max(275, Math.round(nast.plW)); nast.plH = Math.max(116, Math.round(nast.plH));
  let casUlozeni = 0;
  function ulozNast() {
    clearTimeout(casUlozeni);
    casUlozeni = setTimeout(zapisNast, 250);
  }
  function zapisNast() {
    clearTimeout(casUlozeni);
    {
      Object.assign(nast, { eqVid: s.eq, plVid: s.pl, stinHlavni: s.stinHlavni, stinEq: s.stinEq, stinPl: s.stinPl, plW: s.plW, plH: s.plH,
        hlasitost: s.hlasitost, balance: s.balance, shuffle: s.shuffle, repeat: s.repeat, zbyvajici: s.zbyvajici, ekv: s.ekv, vzdyNavrchu: s.vzdyNavrchu });
      try { localStorage.setItem(KLIC, JSON.stringify(nast)); } catch (e) { /* plné úložiště */ }
    }
  }
  // slib s časovým limitem (úložiště, které neodpovídá, nesmí zablokovat nabídku)
  const sLimitem = (slib, ms, nahrada) => Promise.race([slib.catch(() => nahrada), new Promise(h => setTimeout(() => h(nahrada), ms))]);

  // ---------- stav pro kreslení ----------
  const seznam = J.novyPlaylist();
  const s = {
    aktivni: true, aktivniOkno: 'hlavni', stav: 'stop', cas: 0, delka: 0, zbyvajici: nast.zbyvajici, blik: false,
    titulek: '', posunTitulku: 0, zprava: '', kbps: null, khz: null, stereo: null,
    hlasitost: nast.hlasitost, balance: nast.balance, shuffle: nast.shuffle, repeat: nast.repeat, eq: nast.eqVid, pl: nast.plVid,
    maSoubor: false, stisk: null, tahPozice: 0, dvojita: nast.zoom === '2', vzdyNavrchu: nast.vzdyNavrchu,
    stinHlavni: nast.stinHlavni, stinEq: nast.stinEq, stinPl: nast.stinPl,
    ekv: Object.assign({}, nast.ekv, { pasma: nast.ekv.pasma.slice() }),
    seznam, plW: nast.plW, plH: nast.plH, plPosun: 0, plNabidka: null, plCil: -1
  };
  window.WA_APP = { stav: s, seznam };   // pro testy

  let skin = WA_SKIN.vychozi();
  const zvuk = WA_ZVUK.vytvor(nast.rezimZvuku ? { rezim: nast.rezimZvuku } : {});
  const viz = WA_VIZ.vytvor();
  zvuk.hlasitost(s.hlasitost); zvuk.balance(s.balance); zvuk.eq(s.ekv);
  WA_APP.zvuk = zvuk;

  let ikony = null;   // složky na ploše (WA_PLOCHA), vytvoří se níž

  // ---------- okna ----------
  const OKNA = {};
  for (const id of ['hlavni', 'eq', 'pl']) {
    const el = $('okno-' + id), platno = el.querySelector('canvas'), lg = document.createElement('canvas');
    OKNA[id] = { id, el, platno, lg, lgc: lg.getContext('2d') };
  }
  const viditelne = id => !skryto && (id === 'hlavni' || (id === 'eq' ? s.eq : s.pl));
  function rozmerOkna(id) {
    if (id === 'hlavni') return [H.SIRKA, s.stinHlavni ? 14 : H.VYSKA];
    if (id === 'eq') return [E.SIRKA, s.stinEq ? 14 : E.VYSKA];
    return [s.plW, s.stinPl ? 14 : s.plH];
  }
  const obdelnik = id => { const [w, h] = rozmerOkna(id); return { id, x: nast.okna[id].x, y: nast.okna[id].y, w, h }; };
  const vsechnaOkna = () => ['hlavni', 'eq', 'pl'].filter(viditelne).map(obdelnik);
  function zasahOkna(id, x, y) {
    if (id === 'hlavni') return H.zasah(x, y, s.stinHlavni);
    if (id === 'eq') return E.zasah(x, y, s.stinEq);
    return P.zasah(x, y, s.plW, s.stinPl ? 14 : s.plH, s.stinPl);
  }

  // měřítko: k pixelů zařízení na pixel skinu (celé číslo → ostré pixely na každém DPI)
  let k = 1, dpr = 1;
  const css = v => v * k / dpr;   // pixely skinu → CSS px
  // vestavěný skin se kreslí v měřítku okna (HD od 2×); skiny .wsz jsou bitmapy (měřítko 1)
  const meritkoSkinu = () => k >= 2 ? k : 1;
  function srovnejSkin() {
    if (skin.tema !== undefined && skin.m !== meritkoSkinu()) skin = WA_SKIN.vychozi(skin.tema, meritkoSkinu());
  }
  function spoctiMeritko() {
    dpr = window.devicePixelRatio || 1;
    if (nast.zoom === 'auto') {
      // co největší, ale všechna okna (pod sebou) se musí vejít na šířku i výšku
      const misto = Math.max(H.SIRKA, plocha.clientWidth - 16) * dpr;
      const vyska = ['hlavni', 'eq', 'pl'].filter(viditelne).reduce((v, id) => v + rozmerOkna(id)[1], 0) + 16;
      const kV = Math.floor(Math.max(120, plocha.clientHeight) * dpr / vyska);
      k = Math.max(1, Math.min(Math.floor(misto / H.SIRKA), Math.round(2 * dpr), Math.max(kV, Math.round(dpr))));
    } else k = Math.max(1, Math.round(Number(nast.zoom) * dpr));
    srovnejSkin();
  }
  const plochaSkin = () => ({ w: plocha.clientWidth * dpr / k, h: Math.max(plocha.clientHeight, 120) * dpr / k });

  function vychoziRozlozeni() {
    const p = plochaSkin(), x = Math.max(0, Math.floor((p.w - H.SIRKA) / 2));
    nast.okna.hlavni = { x, y: 8 };
    nast.okna.eq = { x, y: 8 + rozmerOkna('hlavni')[1] };
    nast.okna.pl = { x, y: nast.okna.eq.y + (s.eq ? rozmerOkna('eq')[1] : 0) };
    nast.rozlozeno = true;
    ulozNast();
  }
  function umistiOkna() {
    const p = plochaSkin();
    for (const id in OKNA) {
      const o = OKNA[id], [w, h] = rozmerOkna(id), poz = nast.okna[id];
      o.el.hidden = !viditelne(id);
      // okno nesmí utéct z plochy (aspoň lišta musí jít chytit)
      poz.x = Math.round(omez(poz.x, Math.min(0, p.w - w), Math.max(0, p.w - w)));
      poz.y = Math.round(omez(poz.y, 0, Math.max(0, p.h - 14)));
      o.el.style.left = css(poz.x) + 'px'; o.el.style.top = css(poz.y) + 'px';
      o.el.style.width = css(w) + 'px'; o.el.style.height = css(h) + 'px';
    }
    if (s.vzdyNavrchu) OKNA.hlavni.el.style.zIndex = NAVRCHU;
    aplikujRegion();
    if (ikony) ikony.obnov();
  }
  // tvar okna podle region.txt skinu
  function aplikujRegion() {
    for (const [id, sekce, stin] of [['hlavni', 'normal', s.stinHlavni], ['eq', 'equalizer', s.stinEq]]) {
      const poly = skin.region && !stin ? skin.region[sekce] : null;
      OKNA[id].el.style.clipPath = poly ? `path('${poly.map(p => 'M' + p.map(([x, y]) => `${css(x)} ${css(y)}`).join(' L') + ' Z').join(' ')}')` : '';
    }
  }

  // ---------- kreslení ----------
  const spinave = new Set();
  const prekresli = (...id) => { (id.length ? id : ['hlavni', 'eq', 'pl']).forEach(i => spinave.add(i)); };
  function kresliOkno(id) {
    const o = OKNA[id], [w, h] = rozmerOkna(id), c = o.platno;
    if (c.width !== w * k || c.height !== h * k) { c.width = w * k; c.height = h * k; }
    c.style.width = css(w) + 'px'; c.style.height = css(h) + 'px';   // i když se k nezměnilo, ale dpr ano (zoom prohlížeče)
    const d = c.getContext('2d');
    // HD (vestavěný skin ve 2× a víc): kreslí se rovnou v rozlišení obrazovky, archy mají stejné měřítko → ostré, bez zvětšování
    const hd = skin.hd && skin.m === k;
    if (o.lg.width !== w || o.lg.height !== h) { o.lg.width = w; o.lg.height = h; }
    const g = hd ? d : o.lgc;
    if (hd) { d.setTransform(k, 0, 0, k, 0, 0); d.imageSmoothingEnabled = false; }
    if (id === 'hlavni') {
      H.kresli(g, skin, Object.assign(pomocny, s, { zbyvajici: s.zbyvajici && isFinite(s.delka) }));
      if (!s.stinHlavni && nast.viz !== 'vyp') viz.kresli(g, skin.barvy.vis, 24, 43, nast.viz);
    } else if (id === 'eq') E.kresli(g, skin, s);
    else P.kresli(g, skin, s);
    if (!hd) {
      d.setTransform(1, 0, 0, 1, 0, 0);
      WA_VYHLAZ.vykresli(d, o.lg, w, h, k, nast.vyhlazeni);   // skiny .wsz a 1×: ostré pixely, nebo Scale2x + interpolace
    }
    if (id === 'pl') { d.setTransform(k, 0, 0, k, 0, 0); P.kresliText(d, skin, s); d.imageSmoothingEnabled = false; P.kresliNabidku(d, skin, s); }
  }
  const pomocny = {};

  // ---------- smyčka: čas, posun titulku, blikání, vizualizace, prolínání ----------
  let posledni = performance.now(), dalsiKrokTitulku = 0, casZpravy = 0, posledniSekunda = -1, posledniPozice = 0;
  let chybaSmycky = false;
  function smycka(ted) {
    requestAnimationFrame(smycka);   // naplánovat hned – výjimka v jednom snímku nesmí zastavit kreslení napořád
    try { snimek(ted); } catch (e) { if (!chybaSmycky) { chybaSmycky = true; console.error('Lamamp: chyba ve snímku', e); } }
  }
  function snimek(ted) {
    const dt = Math.min(0.1, (ted - posledni) / 1000);
    posledni = ted;
    if (zvuk.audio && s.stav !== 'stop') {
      s.cas = zvuk.cas;
      const d = zvuk.delka, p = seznam.polozky[seznam.aktualni];
      s.delka = isFinite(d) && d > 0 ? d : (p && p.url && d === Infinity ? Infinity : (p && p.delka) || 0);
      if (Math.floor(s.cas) !== posledniSekunda) { posledniSekunda = Math.floor(s.cas); prekresli('hlavni', 'pl'); obnovPoziciMedia(); }
      if (s.stisk === 'pozice' || s.stisk === 'poziceMini') prekresli('hlavni');
      else if (Math.round(s.cas / (s.delka || 1) * 219) !== posledniPozice) { posledniPozice = Math.round(s.cas / (s.delka || 1) * 219); prekresli('hlavni'); }
      hlidejProlinani();
    }
    const blik = s.stav === 'pauza' && Math.floor(ted / 500) % 2 === 1;
    if (blik !== s.blik) { s.blik = blik; prekresli('hlavni', 'pl'); }
    if (casZpravy && ted > casZpravy && !tah) { s.zprava = ''; casZpravy = 0; prekresli('hlavni'); }
    if (ted > dalsiKrokTitulku) {
      dalsiKrokTitulku = ted + 220;
      if (!s.zprava && !s.tazenyTitulek && WA_SKIN.pripravText(s.titulek).length * 5 > 154) { s.posunTitulku += 5; prekresli('hlavni'); }
    }
    // vizualizace se počítá i u zmenšeného/skrytého okna, aby po rozbalení nezůstaly zamrzlé vrcholky
    if (nast.viz !== 'vyp') {
      const meloData = viz.maData;
      if ((viz.krok(zvuk, nast.viz, s.stav === 'hraje', dt) || meloData) && !s.stinHlavni && !skryto) prekresli('hlavni');
    }
    const okna = [...spinave];
    spinave.clear();
    for (const id of okna) if (viditelne(id)) kresliOkno(id);
  }

  // ---------- zprávy v titulku ----------
  function oznam(t, ms = 2500) { s.zprava = t; casZpravy = performance.now() + ms; prekresli('hlavni'); }
  function nastavTitulek() {
    const p = seznam.polozky[seznam.aktualni];
    if (!p) { s.titulek = `${WA_SKIN.NAZEV} ${VERZE}`; s.maSoubor = false; s.kbps = s.khz = s.stereo = null; return; }
    const d = p.delka || (isFinite(s.delka) && s.delka) || 0;
    s.titulek = `${seznam.aktualni + 1}. ${J.titulek(p)}${d ? ` (${J.mmss(d)})` : ''}`;
    s.maSoubor = true;
    s.kbps = p.kbps; s.khz = p.khz; s.stereo = p.kanaly ? p.kanaly > 1 : null;
    prekresli('hlavni');
  }

  // ---------- přehrávání ----------
  const urlPolozek = new Map();   // id → blob URL (uvolní se po přepnutí)
  async function zdroj(p) {
    if (p.url) return p.url;
    let blob = p._file;
    if (!blob && p.ulozena) { try { blob = await U.cti('soubory', p.id); if (blob) p._file = blob; } catch (e) { /* bez souboru */ } }
    if (!blob && p.slozka && ikony) { blob = await ikony.souborPolozky(p); if (blob) p._file = blob; }   // skladba ze složky na ploše
    if (!blob) return null;
    if (!urlPolozek.has(p.id)) urlPolozek.set(p.id, URL.createObjectURL(blob));
    return urlPolozek.get(p.id);
  }
  function uklidUrl(ponechat) {
    for (const [id, url] of urlPolozek) if (!ponechat.includes(id)) { URL.revokeObjectURL(url); urlPolozek.delete(id); }
  }
  let chybVRade = 0, prolinaSe = false;
  let hrajGen = 0;   // generace přehrávání: pozdě doběhlé hrajIndex/časovače starší volby nic nepřepíšou

  async function hrajIndex(i, { prolnout = false } = {}) {
    const p = seznam.polozky[i];
    if (!p) return;
    const gen = ++hrajGen;
    if (!prolnout) prolinaSe = false;
    const predchozi = seznam.polozky[seznam.aktualni];
    seznam.aktualni = i;
    s.posunTitulku = 0; s.cas = 0; posledniSekunda = -1;
    const url = await zdroj(p);
    if (gen !== hrajGen) return;
    if (!url && p.slozka && ikony && ikony.chybiPovoleni) {   // přístup ke složce na disku jde povolit jen kliknutím
      prolinaSe = false; zastav(); return oznam('KLIKNI NA PLAY - POVOL PRISTUP KE SLOZCE', 5000);
    }
    if (!url) { prolinaSe = false; p.chyba = true; return poChybe('SOUBOR UZ NENI K DISPOZICI'); }
    s.delka = p.delka || 0;
    nastavTitulek();
    if (prolnout && nast.prolinani > 0) {
      prolinaSe = true;
      try { await zvuk.prolni(url, nast.prolinani); }
      catch (e) {
        prolinaSe = false;
        if (gen !== hrajGen) return;
        if (e && e.name === 'NotAllowedError') { s.stav = 'pauza'; prekresli(); obnovStavMedia(); return; }
        return;   // jinou chybu ohlásí událost error
      }
      setTimeout(() => { if (gen === hrajGen) { prolinaSe = false; uklidUrl([p.id]); } }, nast.prolinani * 1000 + 500);
    } else {
      zvuk.nacti(url, { stream: !!p.url });
      uklidUrl([p.id]);
      try { await zvuk.hraj(); }
      catch (e) {
        if (gen !== hrajGen) return;
        if (e && e.name === 'NotAllowedError') { s.stav = 'pauza'; prekresli(); return; }
        return;   // AbortError = mezitím přepnuto; nepřehratelný soubor řeší událost error (zvuk.on.chyba)
      }
    }
    if (gen !== hrajGen) return;
    if (predchozi !== p) autoEq(p);
    s.stav = 'hraje';
    chybVRade = 0;
    if (p.chyba) delete p.chyba;
    ukazRadek(i);
    obnovMedia(p);
    prekresli();
    ulozPlaylist();
    if (ikony) ikony.obnov();
  }
  zvuk.on.konec = () => { if (!prolinaSe) dalsiPoKonci(); };
  // pauza nebo pokračování mimo přehrávač (sluchátka, hovor, ovládání systému) → srovnat stav
  zvuk.on.pauza = () => { if (s.stav === 'hraje' && !prolinaSe) { s.stav = 'pauza'; prekresli(); obnovStavMedia(); } };
  zvuk.on.hraje = () => { if (s.stav === 'pauza') { s.stav = 'hraje'; prekresli(); obnovStavMedia(); } };
  zvuk.on.metadata = d => {
    const p = seznam.polozky[seznam.aktualni];
    if (p && isFinite(d) && d > 0 && !p.url && (!p.delka || Math.abs(p.delka - d) > 1)) { p.delka = d; nastavTitulek(); prekresli('pl'); ulozPlaylist(); }
  };
  zvuk.on.chyba = () => {
    const p = seznam.polozky[seznam.aktualni];
    if (!p) return;
    // stream bez CORS: zkusit hrát přímo
    if (p.url && !p._primo && zvuk.rezim === 'webaudio') {
      p._primo = true;
      zvuk.nactiPrimo(p.url);
      const gen = hrajGen;
      zvuk.hraj().then(() => { if (gen === hrajGen) { s.stav = 'hraje'; oznam('STREAM HRAJE PRIMO (BEZ EQ A VIZUALIZACE)', 3500); prekresli(); } })
        .catch(() => { if (gen === hrajGen) poChybe('STREAM NEJDE PREHRAT'); });
      return;
    }
    p.chyba = true;
    poChybe(p.url ? 'STREAM NEJDE PREHRAT' : 'FORMAT NEJDE PREHRAT');
  };
  function poChybe(zprava) {
    oznam(zprava, 3000);
    prekresli('pl');
    if (++chybVRade >= Math.min(seznam.polozky.length, 8)) { zastav(); chybVRade = 0; return; }
    const i = J.dalsi(seznam, { shuffle: s.shuffle, repeat: s.repeat });
    const gen = hrajGen;
    if (i >= 0) setTimeout(() => { if (gen === hrajGen) hrajIndex(i); }, 400); else zastav();
  }
  function dalsiPoKonci() {
    const i = J.dalsi(seznam, { shuffle: s.shuffle, repeat: s.repeat });
    if (i < 0) { zastav(); return; }
    hrajIndex(i);
  }
  function hlidejProlinani() {
    if (!nast.prolinani || prolinaSe || s.stav !== 'hraje' || !isFinite(s.delka) || s.delka < nast.prolinani * 2) return;
    if (s.delka - s.cas > nast.prolinani) return;
    const i = J.dalsi(seznam, { shuffle: s.shuffle, repeat: s.repeat });
    if (i >= 0 && i !== seznam.aktualni && !seznam.polozky[i].url) { prolinaSe = true; hrajIndex(i, { prolnout: true }); }
  }
  async function prehrat() {
    if (s.stav === 'pauza') { try { await zvuk.hraj(); s.stav = 'hraje'; } catch (e) { /* bez gesta */ } prekresli(); obnovStavMedia(); return; }
    if (!seznam.polozky.length) return otevritSoubory('otevrit');
    if (s.stav === 'hraje') { zvuk.cas = 0; return; }
    let i = seznam.aktualni;
    if (i < 0) { i = seznam.polozky.findIndex(p => p.vybrana); if (i < 0) i = s.shuffle ? J.dalsi(seznam, { shuffle: true }) : 0; }
    return hrajIndex(i);
  }
  function pozastavit() {
    if (s.stav === 'hraje') { zvuk.pauza(); s.stav = 'pauza'; }
    else if (s.stav === 'pauza') return prehrat();
    prekresli(); obnovStavMedia();
  }
  function zastav() {
    zvuk.stop(); s.stav = 'stop'; s.cas = 0; prolinaSe = false;
    prekresli(); obnovStavMedia(); if (ikony) ikony.obnov();
  }
  async function zastavZtlumenim() {
    const gen = hrajGen;
    await zvuk.stopZtlumenim(1.5);
    if (gen !== hrajGen) return;   // mezitím spuštěná jiná skladba
    s.stav = 'stop'; s.cas = 0; prolinaSe = false; prekresli(); obnovStavMedia();
  }
  function skok(smer) {
    const i = smer > 0 ? J.dalsi(seznam, { shuffle: s.shuffle, repeat: true }) : J.predchozi(seznam, { shuffle: s.shuffle, repeat: true });
    if (i < 0) return;
    if (s.stav === 'hraje' || s.stav === 'pauza') hrajIndex(i);
    else { seznam.aktualni = i; s.posunTitulku = 0; nastavTitulek(); ukazRadek(i); prekresli(); }
  }
  function posunCas(o) { if (s.stav !== 'stop' && isFinite(s.delka)) { zvuk.cas = zvuk.cas + o; s.cas = zvuk.cas; prekresli('hlavni'); } }
  function nastavHlasitost(v) { s.hlasitost = omez(Math.round(v), 0, 100); zvuk.hlasitost(s.hlasitost); ulozNast(); prekresli('hlavni'); }

  // ---------- ekvalizér ----------
  function eqZmenen() {
    zvuk.eq(s.ekv);
    const p = seznam.polozky[seznam.aktualni];
    if (s.ekv.auto && p) {
      nast.eqPisne[J.titulek(p)] = { preamp: s.ekv.preamp, pasma: s.ekv.pasma.slice() };
      const klice = Object.keys(nast.eqPisne); if (klice.length > 500) delete nast.eqPisne[klice[0]];
    }
    ulozNast(); prekresli('eq');
  }
  function autoEq(p) {
    if (!s.ekv.auto) return;
    const u = nast.eqPisne[J.titulek(p)];
    if (u) { s.ekv.preamp = u.preamp; s.ekv.pasma = u.pasma.slice(); zvuk.eq(s.ekv); prekresli('eq'); }
  }
  function pouzijPredvolbu(pv) {
    s.ekv.preamp = pv.preamp; s.ekv.pasma = pv.pasma.slice();
    if (!s.ekv.zap) s.ekv.zap = true;
    eqZmenen(); oznam('EQ: ' + pv.nazev.toUpperCase());
  }

  // ---------- přidávání skladeb ----------
  const frontaTagu = []; let tagyBezi = 0;
  function nactiTagy(polozky) { frontaTagu.push(...polozky); pumpaTagu(); }
  function pumpaTagu() {
    while (tagyBezi < 3 && frontaTagu.length) {
      const p = frontaTagu.shift(); tagyBezi++;
      zpracujTagy(p).catch(() => {}).finally(() => { tagyBezi--; pumpaTagu(); if (!frontaTagu.length && !tagyBezi) ulozPlaylist(); });
    }
  }
  async function zpracujTagy(p) {
    const blob = p._file || (p.ulozena && await U.cti('soubory', p.id));
    if (!blob) return;
    const t = await T.precti(T.ctiBlob(blob), blob.size);
    for (const kl of ['titul', 'interpret', 'album', 'rok', 'stopa', 'zanr', 'format']) if (t[kl]) p[kl] = t[kl];
    for (const kl of ['delka', 'kbps', 'khz', 'kanaly']) if (t[kl]) p[kl] = t[kl];
    if (p === seznam.polozky[seznam.aktualni]) { nastavTitulek(); obnovMedia(p); }
    prekresli('pl');
  }

  // soubory z výběru nebo přetažení; kam = index vložení, akce 'pridat' | 'otevrit' (nahradit a hrát) | 'hrat' (přidat a hrát)
  async function pridejSoubory(soubory, { kam = seznam.polozky.length, akce = 'pridat', nahodne = false } = {}) {
    const zvukove = [], seznamy = [];
    for (const f of soubory) {
      if (J.jeSkin(f.name) && soubory.length === 1) return nactiSkinSoubor(f);
      if (J.jeSeznam(f.name)) seznamy.push(f);
      else if (J.jeZvuk(f.name, f.type)) zvukove.push(f);
    }
    if (!zvukove.length) {
      if (seznamy.length) oznam('SEZNAM: VYBER HO SPOLU SE SKLADBAMI', 4000);
      else if (soubory.length) oznam('ZADNE ZVUKOVE SOUBORY', 3000);
      return;
    }
    const cesta = f => (f.webkitRelativePath || f._cesta || '').replace(/\/[^/]*$/, '');
    zvukove.sort((a, b) => (cesta(a) + '/' + a.name).localeCompare(cesta(b) + '/' + b.name, 'cs', { numeric: true }));
    // skladby ze složky na ploše si pamatují složku a cestu v ní (nekopírují se znovu)
    let nove = zvukove.map(f => J.novaPolozka(Object.assign({ soubor: f.name, cesta: cesta(f), _file: f },
      f._slozka ? { slozka: f._slozka, rel: f._rel, blobKlic: f._blobKlic || '' } : {})));
    for (const sf of seznamy) { try { nove = J.seradPodleSeznamu(nove, J.nactiSeznam(await sf.text(), sf.name)); } catch (e) { /* vadný seznam */ } }
    if (nahodne) for (let i = nove.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [nove[i], nove[j]] = [nove[j], nove[i]]; }
    if (akce === 'otevrit') { odeberVsePolozky(); kam = 0; }
    J.pridej(seznam, nove, kam);
    nactiTagy(nove);
    if (nast.pamatovat) ulozSoubory(nove);
    oznam(`PRIDANO SKLADEB: ${nove.length}`, 1500);
    umistiOkna(); prekresli('pl'); ulozPlaylist();
    if (akce !== 'pridat') hrajIndex(seznam.polozky.indexOf(nove[0]));
  }
  const vlastniKopie = polozky => polozky.filter(p => !p.slozka).map(p => p.id);   // soubory složek patří složkám
  function odeberVsePolozky() {
    const ids = vlastniKopie(seznam.polozky);
    J.odeberVse(seznam);
    smazSoubory(ids);
    if (s.stav !== 'stop') zastav();
    nastavTitulek();
  }
  // po odebrání: zrušit uložené soubory a případně zastavit
  function poOdebrani(predtim) {
    const zustava = new Set(seznam.polozky.map(p => p.id));
    smazSoubory(vlastniKopie(predtim.filter(p => !zustava.has(p.id))));
    if (seznam.aktualni < 0 && s.stav !== 'stop') zastav();
    s.plPosun = omez(s.plPosun, 0, P.maxPosun(seznam.polozky.length, s.plH));
    nastavTitulek(); umistiOkna(); prekresli(); ulozPlaylist();
  }
  // vstupní pole souborů
  let rezimVyberu = 'pridat';
  function otevritSoubory(akce = 'pridat') { rezimVyberu = akce; $('vstupSoubory').value = ''; $('vstupSoubory').click(); }
  function otevritSlozku() { $('vstupSlozka').value = ''; $('vstupSlozka').click(); }
  $('vstupSoubory').addEventListener('change', e => pridejSoubory([...e.target.files], { akce: rezimVyberu }));
  $('vstupSlozka').addEventListener('change', e => pridejSoubory([...e.target.files], { akce: 'pridat' }));
  $('vstupSkin').addEventListener('change', e => { if (e.target.files[0]) nactiSkinSoubor(e.target.files[0]); e.target.value = ''; });
  $('vstupEqf').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try {
      const pv = J.nactiEqf(await f.arrayBuffer());
      nast.eqVlastni = nast.eqVlastni.filter(a => !pv.some(b => b.nazev === a.nazev)).concat(pv);
      if (pv.length === 1) pouzijPredvolbu(pv[0]); else oznam(`EQ: NACTENO PREDVOLEB ${pv.length}`);
      ulozNast();
    } catch (err) { oznam('EQ: ' + J.bezDiakritiky(err.message).toUpperCase(), 4000); }
  });

  // přetahování souborů a složek
  // položky DataTransfer je nutné vyzvednout synchronně (po prvním await je prohlížeč vyprázdní)
  async function souboryZPretazeni({ zaznamy, soubory }) {
    const polozky = zaznamy;
    if (!polozky.length) return soubory;
    const vysl = [];
    async function projdi(z, cesta) {
      if (z.isFile) { const f = await new Promise((a, b) => z.file(a, b)); f._cesta = cesta + '/' + f.name; vysl.push(f); }
      else if (z.isDirectory) {
        const r = z.createReader();
        for (;;) {
          const davka = await new Promise((a, b) => r.readEntries(a, b));
          if (!davka.length) break;
          for (const d of davka) await projdi(d, cesta + '/' + z.name);
        }
      }
    }
    for (const z of polozky) await projdi(z, '');
    return vysl;
  }
  plocha.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; plocha.classList.add('pretahovani'); });
  plocha.addEventListener('dragleave', e => { if (e.target === plocha) plocha.classList.remove('pretahovani'); });
  plocha.addEventListener('drop', async e => {
    e.preventDefault(); plocha.classList.remove('pretahovani');
    const dt = e.dataTransfer, polozkyDt = [...(dt.items || [])];
    const obsah = { zaznamy: polozkyDt.map(i => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean), soubory: [...dt.files] };
    // složka puštěná na volnou plochu → nová ikona (zástupce složky na disku)
    if (!naOkneXY(e.clientX, e.clientY) && WA_PLOCHA.umiDisk()) {
      const handly = polozkyDt.filter(i => i.kind === 'file' && i.getAsFileSystemHandle).map(i => i.getAsFileSystemHandle());
      if (handly.length) {
        const h = (await Promise.all(handly)).filter(x => x && x.kind === 'directory');
        if (h.length) return ikony.pridejDisk(h);
      }
    }
    const soubory = await souboryZPretazeni(obsah);
    // nad playlistem: vložit na řádek; nad hlavním oknem: přidat a hrát
    const naOkne = id => { const r = OKNA[id].el.getBoundingClientRect(); return viditelne(id) && e.clientX >= r.left && e.clientX < r.right && e.clientY >= r.top && e.clientY < r.bottom; };
    if (naOkne('pl') && !s.stinPl) {
      const r = OKNA.pl.platno.getBoundingClientRect(), y = (e.clientY - r.top) * s.plH / r.height;
      pridejSoubory(soubory, { kam: omez(P.radekNa(y, s), 0, seznam.polozky.length) });
    } else pridejSoubory(soubory, { akce: naOkne('hlavni') ? 'hrat' : 'pridat' });
  });

  // ---------- ukládání playlistu a souborů ----------
  const POLE = ['id', 'soubor', 'cesta', 'titul', 'interpret', 'album', 'rok', 'stopa', 'zanr', 'delka', 'kbps', 'khz', 'kanaly', 'format', 'url', 'ulozena', 'slozka', 'rel', 'blobKlic'];
  let casPlaylistu = 0;
  function ulozPlaylist() {
    clearTimeout(casPlaylistu);
    casPlaylistu = setTimeout(zapisPlaylist, 700);
  }
  function ulozHned() { zapisNast(); if (casPlaylistu) zapisPlaylist(); }
  function zapisPlaylist() {
    clearTimeout(casPlaylistu); casPlaylistu = 0;
    {
      if (U.jenCteni) return;   // jiná záložka je hlavní
      if (!playlistNacten) return ulozPlaylist();   // počkat na načtení uloženého
      const data = seznam.polozky.filter(p => p.url || p.ulozena || p.slozka).map(p => Object.fromEntries(POLE.map(k => [k, p[k]])));
      const akt = seznam.polozky[seznam.aktualni];
      U.zapis('kv', 'playlist', { polozky: data, aktualni: akt ? data.findIndex(d => d.id === akt.id) : -1 }).catch(() => {});
    }
  }
  async function ulozSoubory(polozky) {
    for (const p of polozky) {
      if (!nast.pamatovat || U.jenCteni) break;   // mezitím vypnuto / jiná záložka
      if (p.ulozena || p.slozka || !p._file || !seznam.polozky.includes(p)) continue;
      try {
        await U.zapis('soubory', p.id, await U.proUlozeni(p._file)); p.ulozena = true;
        ulozPlaylist();   // průběžně – při zavření stránky uprostřed kopírování se neztratí, co už je uložené
        if (!seznam.polozky.includes(p)) U.smaz('soubory', p.id).catch(() => {});   // mezitím odebrána → nenechat sirotka
      }
      catch (e) { oznam('PLNE ULOZISTE - DALSI SKLADBY SE NEULOZI', 4000); break; }
    }
    ulozPlaylist();
  }
  function smazSoubory(ids) { for (const id of ids) U.smaz('soubory', id).catch(() => {}); }
  let playlistNacten = false;   // dokud se uložený playlist nenačetl, neukládat (přepsal by ho)
  async function obnovPlaylist(pokus = 0) {
    let d = null;
    try { d = await U.cti('kv', 'playlist'); }
    catch (e) {
      if (pokus < 4) setTimeout(() => obnovPlaylist(pokus + 1), 3000 * (pokus + 1));
      else { playlistNacten = true; oznam('ULOZENY PLAYLIST SE NEDA NACIST', 5000); }
      return false;
    }
    playlistNacten = true;
    if (!d || !Array.isArray(d.polozky) || !d.polozky.length) return true;
    const bylPrazdny = !seznam.polozky.length;   // uživatel mohl mezitím přidat skladby – obnovené jdou před ně
    J.pridej(seznam, d.polozky.map(p => J.novaPolozka(p)), 0);
    if (bylPrazdny) seznam.aktualni = Number.isInteger(d.aktualni) && d.aktualni < seznam.polozky.length ? d.aktualni : -1;
    nastavTitulek(); umistiOkna(); prekresli();
    return true;
  }
  // úklid: uložené soubory, na které neodkazuje playlist ani žádná složka (přerušené kopírování apod.)
  // Jen záložka se zámkem; seznamy klíčů až PO přečtení úložiště (jinak by smazal skladbu, jejíž zápis právě doběhl)
  // a nikdy ne soubor, který se právě zapisuje.
  async function uklidSirotky() {
    if (zamek !== 'mam' || !playlistNacten || !ikony.pouziteKlice()) return;
    const klice = await U.klice('soubory').catch(() => []);
    const playlistove = new Set(seznam.polozky.filter(p => p.ulozena).map(p => p.id)), slozkove = ikony.pouziteKlice();
    if (!slozkove) return;
    for (const kl of klice) if (!playlistove.has(kl) && !slozkove.has(kl) && !U.rozepsane.has(kl)) await U.smaz('soubory', kl).catch(() => {});
  }

  // ---------- skiny ----------
  async function nactiSkinSoubor(f) {
    try {
      const buf = await f.arrayBuffer();
      const novy = await WA_SKIN.nactiWsz(buf, f.name);
      await U.zapis('skiny', novy.nazev, buf).catch(() => {});
      pouzijSkin(novy, novy.nazev);
      oznam('SKIN: ' + novy.nazev.toUpperCase());
    } catch (e) { oznam('SKIN NEJDE NACIST', 3500); }
  }
  // nazev: '' výchozí, 'tema:<id>' vestavěný motiv, jinak skin .wsz uložený v IndexedDB
  async function prepniSkin(nazev) {
    if (!nazev) { pouzijSkin(WA_SKIN.vychozi('', meritkoSkinu()), ''); return; }
    if (nazev.startsWith('tema:')) {
      const id = nazev.slice(5);
      if (!WA_SKIN.TEMATA.some(t => t.id === id)) return prepniSkin('');
      const novy = WA_SKIN.vychozi(id, meritkoSkinu());
      pouzijSkin(novy, nazev); oznam('SKIN: ' + J.bezDiakritiky(novy.nazev).toUpperCase(), 1500); return;
    }
    try { const buf = await U.cti('skiny', nazev); if (buf) pouzijSkin(await WA_SKIN.nactiWsz(buf, nazev), nazev); } catch (e) { oznam('SKIN NEJDE NACIST', 3000); }
  }
  function pouzijSkin(novy, nazev) {
    skin = novy;
    nast.skin = nazev;
    ulozNast(); umistiOkna(); prekresli();
  }

  // ---------- myš a dotyk ----------
  let tah = null, posledniKlik = null, dlouhyStisk = 0;
  function bod(id, e) {
    const r = OKNA[id].platno.getBoundingClientRect(), [w, h] = rozmerOkna(id);
    return [Math.floor((e.clientX - r.left) * w / r.width), Math.floor((e.clientY - r.top) * h / r.height)];
  }
  // u prstu: nejbližší ovládací prvek do 4 px (originální tlačítka jsou drobná)
  function najdi(id, x, y, dotyk) {
    const o = zasahOkna(id, x, y);
    if (!dotyk || (o && o.druh !== 'okno')) return o;
    let nej = o, vzd = 99;
    for (let dy = -4; dy <= 4; dy += 2) for (let dx = -4; dx <= 4; dx += 2) {
      const a = zasahOkna(id, x + dx, y + dy);
      if (a && a.druh !== 'okno' && dx * dx + dy * dy < vzd) { nej = a; vzd = dx * dx + dy * dy; }
    }
    return nej;
  }
  let zPoradi = 1;
  const NAVRCHU = 1000000;   // „vždy navrchu“ – nad jakýmkoli pořadím ostatních oken
  function aktivuj(id) {
    if (s.aktivniOkno !== id) { s.aktivniOkno = id; prekresli(); }
    s.aktivni = id === 'hlavni';
    OKNA[id].el.style.zIndex = id === 'hlavni' && s.vzdyNavrchu ? NAVRCHU : ++zPoradi;
  }

  function dolu(id, e) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    zavriMenu();
    const [x, y] = bod(id, e), dotyk = e.pointerType !== 'mouse';
    aktivuj(id);
    // otevřená nabídka playlistu (po kliknutí): klik na položku ji spustí, jinam ji zavře
    if (s.plNabidka && s.plNabidka.otevrena) {
      const pol = id === 'pl' ? P.polozkaNabidky(s.plNabidka.id, x, y, s.plW, s.plH) : null;
      s.plNabidka = null; prekresli('pl');
      if (pol) return akce(pol);
    }
    const o = najdi(id, x, y, dotyk) || { id: 'nic', druh: 'nic', x: 0, y: 0, w: 0, h: 0 };   // prázdné místo: jen dlouhý stisk
    OKNA[id].platno.setPointerCapture(e.pointerId);
    tah = { id, o, x0: x, y0: y, sx: e.clientX, sy: e.clientY, uvnitr: true, dotyk, pohnuto: false };
    // dlouhý stisk = nabídka, ale ne na posuvníku či tlačítku (tam prst drží ovládání)
    if (dotyk && ['nic', 'okno', 'seznam'].includes(o.druh)) {
      clearTimeout(dlouhyStisk);
      dlouhyStisk = setTimeout(() => { if (tah && !tah.pohnuto) { const t = tah; tah = null; s.stisk = null; prekresli(); otevriMenuKontext(t.sx, t.sy, id); } }, 550);
    }
    switch (o.druh) {
      case 'tlacitko': s.stisk = o.id; break;
      case 'posuvnik': s.stisk = o.id; posuvnik(id, o.id, x, y); break;
      case 'okno': {
        const sk = id === 'hlavni' ? O.skupina(vsechnaOkna(), 'hlavni') : new Set([id]);
        tah.skupina = [...sk]; tah.start = Object.fromEntries(tah.skupina.map(i => [i, { ...nast.okna[i] }]));
        break;
      }
      case 'klik': klik(o.id); break;
      case 'tazeni': tah.posun = s.posunTitulku; break;
      case 'seznam': seznamDolu(e, x, y); break;
      case 'nabidka': s.plNabidka = { id: o.id, vybrana: null }; break;
      case 'zmena': tah.w0 = s.plW; tah.h0 = s.plH; break;
    }
    prekresli(id);
  }
  function pohyb(id, e) {
    if (!tah || tah.id !== id) {
      if (id === 'pl' && s.plNabidka && s.plNabidka.otevrena) {
        const [x, y] = bod(id, e), v = P.polozkaNabidky(s.plNabidka.id, x, y, s.plW, s.plH);
        if (v !== s.plNabidka.vybrana) { s.plNabidka.vybrana = v; prekresli('pl'); }
      }
      return;
    }
    const [x, y] = bod(id, e), o = tah.o;
    if (Math.abs(e.clientX - tah.sx) + Math.abs(e.clientY - tah.sy) > 6) { tah.pohnuto = true; clearTimeout(dlouhyStisk); }
    const dx = (e.clientX - tah.sx) * dpr / k, dy = (e.clientY - tah.sy) * dpr / k;
    switch (o.druh) {
      case 'okno': {
        const posunuta = tah.skupina.map(i => { const r = obdelnik(i); return { ...r, x: tah.start[i].x + dx, y: tah.start[i].y + dy }; });
        const ob = O.obalka(posunuta), ostatni = vsechnaOkna().filter(r => !tah.skupina.includes(r.id));
        const p = O.prichyt(ob, ostatni, plochaSkin());
        for (const i of tah.skupina) { nast.okna[i].x = Math.round(tah.start[i].x + dx + p.x - ob.x); nast.okna[i].y = Math.round(tah.start[i].y + dy + p.y - ob.y); }
        umistiOkna();
        break;
      }
      case 'posuvnik': posuvnik(id, o.id, x, y); break;
      case 'tlacitko': tah.uvnitr = x >= o.x - (tah.dotyk ? 4 : 0) && x < o.x + o.w + (tah.dotyk ? 4 : 0) && y >= o.y - (tah.dotyk ? 4 : 0) && y < o.y + o.h + (tah.dotyk ? 4 : 0); s.stisk = tah.uvnitr ? o.id : null; break;
      case 'tazeni': s.posunTitulku = tah.posun - (x - tah.x0); s.tazenyTitulek = true; break;
      case 'seznam': seznamTah(x, y); break;
      case 'nabidka': s.plNabidka.vybrana = P.polozkaNabidky(o.id, x, y, s.plW, s.plH); break;
      case 'zmena': {
        const [w, h] = P.rozmer(tah.w0 + dx, s.stinPl ? s.plH : tah.h0 + dy);
        if (w !== s.plW || h !== s.plH) { s.plW = w; s.plH = h; s.plPosun = omez(s.plPosun, 0, P.maxPosun(seznam.polozky.length, h)); umistiOkna(); }
        break;
      }
    }
    prekresli(id);
  }
  function nahoru(id, e) {
    clearTimeout(dlouhyStisk);
    if (!tah || tah.id !== id) return;
    const t = tah, o = t.o, [x, y] = bod(id, e);
    tah = null;
    switch (o.druh) {
      case 'tlacitko': if (e.type === 'pointerup' && t.uvnitr) akce(o.id); break;
      case 'posuvnik': posuvnikKonec(o.id); break;
      case 'okno': ulozNast(); break;
      case 'tazeni': s.tazenyTitulek = false; break;
      case 'seznam': seznamNahoru(e, t); break;
      case 'nabidka':
        if (s.plNabidka && s.plNabidka.vybrana) { const a = s.plNabidka.vybrana; s.plNabidka = null; akce(a); }
        else if (s.plNabidka && !t.pohnuto) s.plNabidka.otevrena = true;   // kliknutí: nabídka zůstane otevřená
        else s.plNabidka = null;
        break;
      case 'zmena': ulozNast(); break;
    }
    s.stisk = null;
    // dvojklik (i dvojí ťuknutí)
    const ted = performance.now();
    if (e.type === 'pointerup' && !t.pohnuto) {
      if (posledniKlik && posledniKlik.id === id && posledniKlik.oid === o.id && ted - posledniKlik.t < 380 && Math.abs(posledniKlik.x - x) < 6 && Math.abs(posledniKlik.y - y) < 6) {
        posledniKlik = null; dvojklik(id, o, x, y);
      } else posledniKlik = { id, oid: o.id, t: ted, x, y };
    }
    prekresli();
  }
  function dvojklik(id, o, x, y) {
    if (o.druh === 'okno' && y < 14 + (id === 'pl' ? 6 : 0)) akce(id === 'hlavni' ? 'stin' : id === 'eq' ? 'eqStin' : 'plStin');
    else if (o.druh === 'seznam') { const i = P.radekNa(y, s); if (seznam.polozky[i]) hrajIndex(i); }
  }
  function kolecko(id, e) {
    e.preventDefault();
    const smer = Math.sign(e.deltaY);
    if (id === 'pl' && !s.stinPl) { s.plPosun = omez(Math.floor(s.plPosun) + smer * 3, 0, P.maxPosun(seznam.polozky.length, s.plH)); prekresli('pl'); }
    else if (id === 'hlavni') { nastavHlasitost(s.hlasitost - smer * 4); oznam(H.zpravaPosuvniku('hlasitost', s.hlasitost), 800); }
  }

  function posuvnik(id, oid, x, y) {
    if (id === 'hlavni') {
      const v = H.hodnotaPosuvniku(oid, x);
      if (oid === 'hlasitost') { nastavHlasitost(v); s.zprava = H.zpravaPosuvniku(oid, v); }
      else if (oid === 'balance') { s.balance = v; zvuk.balance(v); s.zprava = H.zpravaPosuvniku(oid, v); ulozNast(); }
      else if (s.maSoubor && s.stav !== 'stop') { s.tahPozice = v; s.zprava = H.zpravaPosuvniku('pozice', v, s.delka); }
    } else if (id === 'eq') {
      const db = E.hodnota(oid, y);
      if (oid === 'eqPreamp') s.ekv.preamp = db; else s.ekv.pasma[+oid.slice(7)] = db;
      s.zprava = E.zprava(oid, db); casZpravy = 0;
      eqZmenen(); prekresli('hlavni');
    } else if (oid === 'plPosuvnik') {
      s.plPosun = P.posunZPosuvniku(y, seznam.polozky.length, s.plH);
    }
  }
  function posuvnikKonec(oid) {
    if ((oid === 'pozice' || oid === 'poziceMini') && s.maSoubor && s.stav !== 'stop') { zvuk.cas = s.tahPozice * s.delka; s.cas = zvuk.cas; obnovPoziciMedia(); }
    if (s.zprava && !casZpravy) s.zprava = '';
    prekresli();
  }

  // výběr a přetahování řádků
  function seznamDolu(e, x, y) {
    const i = P.radekNa(y, s), p = seznam.polozky[i];
    tah.radek = i;
    if (!p) { J.vyberVse(seznam, false); tah.prazdno = true; return; }
    const ctrl = e.ctrlKey || e.metaKey;
    if (e.shiftKey || ctrl) { J.vyber(seznam, i, { ctrl, shift: e.shiftKey }); tah.modifikator = true; }
    else if (!p.vybrana) J.vyber(seznam, i);
  }
  function seznamTah(x, y) {
    if (tah.prazdno || tah.modifikator) return;
    // u okraje seznamu se posouvá
    if (y < 22 && s.plPosun > 0) s.plPosun = Math.max(0, s.plPosun - 0.4);
    else if (y > s.plH - 40) s.plPosun = Math.min(P.maxPosun(seznam.polozky.length, s.plH), s.plPosun + 0.4);
    const i = omez(P.radekNa(y, s), 0, seznam.polozky.length - 1), o = i - tah.radek;
    if (o) tah.radek += J.posunVybrane(seznam, o);
  }
  function seznamNahoru(e, t) {
    if (!t.pohnuto && !t.modifikator && !t.prazdno) J.vyber(seznam, t.radek);
    if (t.pohnuto) ulozPlaylist();
  }
  function ukazRadek(i) {
    const v = P.viditelnychRadku(s.plH);
    if (i < s.plPosun) s.plPosun = i; else if (i >= s.plPosun + v) s.plPosun = i - v + 1;
    s.plPosun = omez(s.plPosun, 0, P.maxPosun(seznam.polozky.length, s.plH));
  }

  for (const id in OKNA) {
    const c = OKNA[id].platno;
    c.addEventListener('pointerdown', e => dolu(id, e));
    c.addEventListener('pointermove', e => pohyb(id, e));
    c.addEventListener('pointerup', e => nahoru(id, e));
    c.addEventListener('pointercancel', e => nahoru(id, e));
    c.addEventListener('wheel', e => kolecko(id, e), { passive: false });
    c.addEventListener('contextmenu', e => { e.preventDefault(); if (e.pointerType !== 'touch') otevriMenuKontext(e.clientX, e.clientY, id); });
  }
  plocha.addEventListener('pointerdown', e => {
    if (e.target === plocha) { zavriMenu(); if (s.plNabidka) { s.plNabidka = null; prekresli('pl'); } s.aktivniOkno = ''; s.aktivni = false; prekresli(); }
  });

  // ---------- akce tlačítek ----------
  function klik(id) {
    if (id === 'cas') { s.zbyvajici = !s.zbyvajici; ulozNast(); prekresli('hlavni', 'pl'); }
    else if (id === 'vizualizace') { nast.viz = WA_VIZ.REZIMY[(WA_VIZ.REZIMY.indexOf(nast.viz) + 1) % 3]; ulozNast(); prekresli('hlavni'); }
    else if (id === 'logo') oProgramu();
  }
  function prepniStin(kl, okno) {
    const stara = rozmerOkna(okno)[1];
    s[kl] = !s[kl];
    const r = vsechnaOkna(), o = r.find(a => a.id === okno);
    if (o) { o.h = rozmerOkna(okno)[1]; O.posunPod(r, okno, stara); for (const a of r) nast.okna[a.id].y = a.y; }
    ulozNast(); umistiOkna(); prekresli();
  }
  function akce(id) {
    switch (id) {
      case 'prehrat': return prehrat();
      case 'pozastavit': return pozastavit();
      case 'zastavit': return zastav();
      case 'predchozi': return skok(-1);
      case 'dalsi': return skok(1);
      case 'vysunout': return otevritSoubory('otevrit');
      case 'shuffle': s.shuffle = !s.shuffle; seznam.poradi = []; oznam(s.shuffle ? 'SHUFFLE: ZAPNUTO' : 'SHUFFLE: VYPNUTO', 1200); break;
      case 'repeat': s.repeat = !s.repeat; oznam(s.repeat ? 'REPEAT: ZAPNUTO' : 'REPEAT: VYPNUTO', 1200); break;
      case 'eq': case 'eqZavrit': s.eq = id === 'eq' ? !s.eq : false; umistiOkna(); break;
      case 'pl': case 'plZavrit': s.pl = id === 'pl' ? !s.pl : false; umistiOkna(); break;
      case 'stin': return prepniStin('stinHlavni', 'hlavni');
      case 'eqStin': return prepniStin('stinEq', 'eq');
      case 'plStin': return prepniStin('stinPl', 'pl');
      case 'zavrit': zastav(); return skryj(true);
      case 'minimalizovat': return skryj(false);
      case 'moznosti': case 'clutterO': { const r = OKNA.hlavni.el.getBoundingClientRect(); return otevriMenuKontext(r.left + css(8), r.top + css(id === 'moznosti' ? 13 : 30), 'hlavni'); }
      case 'clutterA': s.vzdyNavrchu = !s.vzdyNavrchu; OKNA.hlavni.el.style.zIndex = s.vzdyNavrchu ? NAVRCHU : ++zPoradi; umistiOkna(); oznam(s.vzdyNavrchu ? 'VZDY NAVRCHU' : 'VZDY NAVRCHU: VYPNUTO', 1200); break;
      case 'clutterI': return infoSouboru(seznam.aktualni);
      case 'clutterD': return nastavZoom(nast.zoom === '2' ? '1' : '2');
      case 'clutterV': { const r = OKNA.hlavni.el.getBoundingClientRect(); return otevriMenu(menuVizualizace(), r.left + css(18), r.top + css(55)); }
      case 'eqZap': s.ekv.zap = !s.ekv.zap; eqZmenen(); break;
      case 'eqAuto': s.ekv.auto = !s.ekv.auto; eqZmenen(); break;
      case 'eqPredvolby': { const r = OKNA.eq.el.getBoundingClientRect(); return otevriMenu(menuPredvoleb(), r.left + css(217), r.top + css(31)); }
      // nabídky playlistu
      case 'pridatUrl': return pridatAdresu();
      case 'pridatSlozku': return otevritSlozku();
      case 'pridatSoubory': return otevritSoubory('pridat');
      case 'odebratVse': { const p = seznam.polozky.slice(); J.odeberVse(seznam); return poOdebrani(p); }
      case 'orez': { const p = seznam.polozky.slice(); J.orez(seznam); return poOdebrani(p); }
      case 'odebratVybrane': { const p = seznam.polozky.slice(); J.odeberVybrane(seznam); return poOdebrani(p); }
      case 'odebratDuplicity': {
        const p = seznam.polozky.slice(), videno = new Set();
        J.odeberIndexy(seznam, p.map((x, i) => { const kl = (x.url || x.cesta + '/' + x.soubor) + '|' + (x._file ? x._file.size : ''); if (videno.has(kl)) return i; videno.add(kl); return -1; }).filter(i => i >= 0));
        return poOdebrani(p);
      }
      case 'obratitVyber': J.obratVyber(seznam); break;
      case 'zrusitVyber': J.vyberVse(seznam, false); break;
      case 'vybratVse': J.vyberVse(seznam, true); break;
      case 'razeni': { const r = OKNA.pl.el.getBoundingClientRect(); return otevriMenu(menuRazeni(), r.left + css(101), r.bottom - css(40)); }
      case 'infoSouboru': { const i = seznam.polozky.findIndex(p => p.vybrana); return infoSouboru(i >= 0 ? i : seznam.aktualni); }
      case 'moznostiPl': { const r = OKNA.pl.el.getBoundingClientRect(); return otevriMenu(menuMoznostiPl(), r.left + css(101), r.bottom - css(40)); }
      case 'novySeznam': { const p = seznam.polozky.slice(); J.odeberVse(seznam); return poOdebrani(p); }
      case 'ulozitSeznam': { const r = OKNA.pl.el.getBoundingClientRect(); return otevriMenu(menuUlozitSeznam(), r.right - css(150), r.bottom - css(40)); }
      case 'nactiSeznam': return otevritSoubory('otevrit');
    }
    prekresli(); ulozNast();
  }

  // ---------- minimalizace a zavření ----------
  let skryto = false;
  function skryj(zavreno) {
    skryto = true;
    const b = $('obnovit');
    b.hidden = false;
    b.textContent = zavreno ? `🦙 Spustit ${WA_SKIN.NAZEV}` : `🦙 ${seznam.polozky[seznam.aktualni] ? J.titulek(seznam.polozky[seznam.aktualni]) : WA_SKIN.NAZEV}`;
    umistiOkna();
  }
  $('obnovit').addEventListener('click', () => { skryto = false; $('obnovit').hidden = true; umistiOkna(); prekresli(); });

  // ---------- Win98 nabídky ----------
  const menuEl = $('menu98');
  function zavriMenu() { menuEl.hidden = true; menuEl.innerHTML = ''; }
  function otevriMenu(polozky, x, y, uroven = menuEl, rodic = null) {
    if (uroven === menuEl) { zavriMenu(); menuEl.hidden = false; }
    const ul = document.createElement('div'); ul.className = 'menu98-seznam';
    for (const p of polozky) {
      if (p === '-') { const hr = document.createElement('div'); hr.className = 'menu98-oddel'; ul.appendChild(hr); continue; }
      const b = document.createElement('button');
      b.className = 'menu98-pol'; b.type = 'button'; b.disabled = !!p.zakazano;
      b.innerHTML = `<span class="m98-zn">${p.zaskrtnuto ? '✓' : p.tecka ? '●' : ''}</span><span class="m98-t"></span><span class="m98-k">${p.klavesa || ''}</span><span class="m98-s">${p.podmenu ? '▸' : ''}</span>`;
      b.querySelector('.m98-t').textContent = p.text;
      if (p.podmenu) {
        b.addEventListener('pointerenter', () => otevriPodmenu(b, p.podmenu));
        b.addEventListener('click', e => { e.stopPropagation(); otevriPodmenu(b, p.podmenu); });
      } else {
        b.addEventListener('pointerenter', () => { for (const sub of ul.querySelectorAll(':scope > .menu98-seznam')) sub.remove(); });
        b.addEventListener('click', e => { e.stopPropagation(); zavriMenu(); p.akce && p.akce(); });
      }
      ul.appendChild(b);
    }
    (rodic || menuEl).appendChild(ul);
    // umístění v okně prohlížeče
    const r = ul.getBoundingClientRect();
    const xx = Math.max(2, Math.min(x, innerWidth - r.width - 2)), yy = Math.max(2, Math.min(y, innerHeight - r.height - 2));
    ul.style.left = xx + 'px'; ul.style.top = yy + 'px';
    return ul;
  }
  function otevriPodmenu(b, polozky) {
    const ul = b.parentElement;
    for (const sub of ul.querySelectorAll(':scope > .menu98-seznam')) sub.remove();
    const r = b.getBoundingClientRect();
    const sub = otevriMenu(polozky, r.right - 3, r.top - 3, null, ul);
    const rs = sub.getBoundingClientRect();
    if (rs.right > innerWidth - 2) sub.style.left = Math.max(2, r.left - rs.width + 3) + 'px';
  }
  document.addEventListener('pointerdown', e => { if (!menuEl.hidden && !menuEl.contains(e.target)) zavriMenu(); }, true);

  const zaskrt = (text, ano, akce, klavesa) => ({ text, zaskrtnuto: ano, akce, klavesa });
  function menuVizualizace() {
    return [zaskrt('Spektrální analyzátor', nast.viz === 'spektrum', () => { nast.viz = 'spektrum'; ulozNast(); }),
      zaskrt('Osciloskop', nast.viz === 'osciloskop', () => { nast.viz = 'osciloskop'; ulozNast(); }),
      zaskrt('Vypnuto', nast.viz === 'vyp', () => { nast.viz = 'vyp'; ulozNast(); prekresli('hlavni'); })];
  }
  function menuPredvoleb() {
    const pol = pv => ({ text: pv.nazev, akce: () => pouzijPredvolbu(pv) });
    return [
      { text: 'Načíst', podmenu: J.PREDVOLBY.map(pol) },
      { text: 'Moje předvolby', podmenu: nast.eqVlastni.length ? nast.eqVlastni.map(pol) : [{ text: '(zatím žádné)', zakazano: true }], zakazano: false },
      '-',
      { text: 'Uložit jako…', akce: ulozitPredvolbu },
      { text: 'Smazat moji předvolbu', podmenu: nast.eqVlastni.length ? nast.eqVlastni.map(pv => ({ text: pv.nazev, akce: () => { nast.eqVlastni = nast.eqVlastni.filter(a => a !== pv); ulozNast(); } })) : [{ text: '(žádné)', zakazano: true }] },
      '-',
      { text: 'Načíst soubor .eqf…', akce: () => $('vstupEqf').click() },
      { text: 'Uložit moje předvolby do .eqf', akce: () => stahni(new Blob([J.exportEqf(nast.eqVlastni.length ? nast.eqVlastni : [{ nazev: 'Aktuální', preamp: s.ekv.preamp, pasma: s.ekv.pasma }])]), 'lamamp.eqf'), zakazano: false },
      '-',
      { text: 'Vynulovat', akce: () => { s.ekv.preamp = 0; s.ekv.pasma = new Array(10).fill(0); eqZmenen(); } }
    ];
  }
  function menuRazeni() {
    const r = podle => () => { J.serad(seznam, podle); prekresli('pl'); ulozPlaylist(); };
    return [{ text: 'Seřadit podle titulku', akce: r('titulek') }, { text: 'Seřadit podle jména souboru', akce: r('soubor') },
      { text: 'Seřadit podle cesty a jména', akce: r('cesta') }, '-', { text: 'Obrátit pořadí', akce: r('obratit') }, { text: 'Náhodně zamíchat', akce: r('nahodne') }];
  }
  function menuUlozitSeznam() {
    return [{ text: 'Uložit jako M3U…', akce: () => stahni(new Blob([J.exportM3u(seznam)], { type: 'audio/x-mpegurl' }), 'playlist.m3u') },
      { text: 'Uložit jako PLS…', akce: () => stahni(new Blob([J.exportPls(seznam)], { type: 'audio/x-scpls' }), 'playlist.pls') }];
  }
  function menuMoznostiPl() {
    return [
      zaskrt('Pamatovat si skladby (kopie v prohlížeči)', nast.pamatovat, () => prepniPamatovani()),
      { text: 'Využité místo…', akce: ukazMisto },
      '-',
      { text: 'Skok na skladbu…', klavesa: 'J', akce: skokNaSkladbu },
      { text: 'Informace o skladbě…', akce: () => akce('infoSouboru') }
    ];
  }
  function menuSkinu(nazvy) {
    const vestavene = WA_SKIN.TEMATA.map(t => zaskrt(t.id ? t.nazev : 'Lamamp (výchozí)', t.id ? nast.skin === 'tema:' + t.id : !nast.skin, () => prepniSkin(t.id ? 'tema:' + t.id : '')));
    return [{ text: 'Vestavěné', zakazano: true }, ...vestavene,
      '-', { text: 'Načtené (.wsz)', zakazano: true }, ...(nazvy.length ? nazvy.map(n => zaskrt(n, nast.skin === n, () => prepniSkin(n))) : [{ text: '(zatím žádné)', zakazano: true }]),
      '-', { text: 'Načíst skin .wsz…', akce: () => $('vstupSkin').click() },
      { text: 'Smazat uložený skin', podmenu: nazvy.length ? nazvy.map(n => ({ text: n, akce: async () => { await U.smaz('skiny', n); if (nast.skin === n) prepniSkin(''); } })) : [{ text: '(žádný)', zakazano: true }] }];
  }
  async function otevriMenuKontext(x, y) {
    const skiny = await sLimitem(U.klice('skiny'), 400, []);
    otevriMenu([
      { text: `${WA_SKIN.NAZEV} ${VERZE}…`, akce: oProgramu },
      '-',
      { text: 'Otevřít soubory…', klavesa: 'L', akce: () => otevritSoubory('otevrit') },
      { text: 'Přidat soubory…', akce: () => otevritSoubory('pridat') },
      { text: 'Přidat složku…', akce: otevritSlozku, zakazano: !('webkitdirectory' in $('vstupSlozka')) || zvuk.jeIos() },
      { text: 'Přidat adresu (rádio)…', akce: pridatAdresu },
      { text: 'Nová složka s hudbou na ploše…', akce: () => ikony.novaSlozka() },
      '-',
      zaskrt('Hlavní okno', !skryto, () => { skryto = false; $('obnovit').hidden = true; umistiOkna(); prekresli(); }),
      zaskrt('Ekvalizér', s.eq, () => akce('eq'), 'Alt+G'),
      zaskrt('Playlist', s.pl, () => akce('pl'), 'Alt+E'),
      '-',
      { text: 'Skiny', podmenu: menuSkinu(skiny) },
      { text: 'Vizualizace', podmenu: menuVizualizace() },
      { text: 'Možnosti', podmenu: [
        zaskrt('Zobrazit zbývající čas', s.zbyvajici, () => klik('cas'), 'Ctrl+T'),
        zaskrt('Dvojitá velikost', nast.zoom === '2', () => akce('clutterD'), 'Ctrl+D'),
        zaskrt('Vyhlazovat skiny .wsz při zvětšení', nast.vyhlazeni, () => prepniVyhlazeni()),
        zaskrt('Hlavní okno vždy navrchu', s.vzdyNavrchu, () => akce('clutterA')),
        '-',
        ...[0, 2, 4, 6, 8].map(n => zaskrt(n ? `Prolínání skladeb ${n} s` : 'Bez prolínání', nast.prolinani === n, () => { nast.prolinani = n; ulozNast(); })),
        '-',
        zaskrt('Zvuk přes Web Audio (EQ, vizualizace)', zvuk.rezim === 'webaudio', () => prepniRezim('webaudio')),
        zaskrt('Zvuk přímo (hraje i se zamčeným displejem)', zvuk.rezim === 'primo', () => prepniRezim('primo')),
        '-',
        zaskrt('Pamatovat si skladby', nast.pamatovat, prepniPamatovani)
      ] },
      { text: 'Přehrávání', podmenu: [
        { text: 'Předchozí', klavesa: 'Z', akce: () => skok(-1) }, { text: 'Přehrát', klavesa: 'X', akce: prehrat },
        { text: 'Pauza', klavesa: 'C', akce: pozastavit }, { text: 'Stop', klavesa: 'V', akce: zastav },
        { text: 'Stop se ztlumením', klavesa: 'Shift+V', akce: zastavZtlumenim }, { text: 'Další', klavesa: 'B', akce: () => skok(1) },
        '-', zaskrt('Repeat', s.repeat, () => akce('repeat'), 'R'), zaskrt('Shuffle', s.shuffle, () => akce('shuffle'), 'S'),
        '-', { text: 'Skok na skladbu…', klavesa: 'J', akce: skokNaSkladbu }
      ] },
      '-',
      { text: 'Informace o skladbě…', klavesa: 'Alt+3', akce: () => infoSouboru(seznam.aktualni), zakazano: seznam.aktualni < 0 },
      { text: 'Nápověda', klavesa: 'F1', akce: () => $('napoveda').showModal() }
    ], x, y);
  }

  function prepniRezim(r) {
    if (r === zvuk.rezim) return;
    seznam.polozky.forEach(p => { delete p._primo; });
    zvuk.nastavRezim(r);
    nast.rezimZvuku = r; ulozNast();
    oznam(r === 'primo' ? 'ZVUK PRIMO - BEZ EQ A VIZUALIZACE' : 'ZVUK PRES WEB AUDIO', 3000);
  }
  async function prepniPamatovani() {
    nast.pamatovat = !nast.pamatovat; ulozNast();
    if (nast.pamatovat) {
      U.trvale();
      await ulozSoubory(seznam.polozky);
      oznam('SKLADBY SE PAMATUJI', 2000);
    } else {
      if (await potvrd('Smazat kopie skladeb uložené v prohlížeči? Playlist po zavření stránky zmizí.')) {
        // obnovené skladby (jen v úložišti) si nejdřív vzít do paměti, ať v tomto sezení dál hrají
        for (const p of seznam.polozky) if (p.ulozena && !p._file && !p.slozka) p._file = await U.cti('soubory', p.id).catch(() => null) || undefined;
        // jen kopie playlistu – skladby složek na ploše (klíče sl:…) zůstávají
        const klice = await U.klice('soubory').catch(() => []);
        for (const kl of klice) if (!String(kl).startsWith('sl:')) await U.smaz('soubory', kl).catch(() => {});
        seznam.polozky.forEach(p => { if (!p.slozka) p.ulozena = false; });
        ulozPlaylist();
      }
    }
  }
  async function ukazMisto() {
    const m = await U.misto(), n = seznam.polozky.filter(p => p.ulozena).length;
    const mb = v => (v / 1048576).toFixed(1).replace('.', ',') + ' MB';
    dialog98('Využité místo', `<p>Uložených skladeb: <b>${n}</b> z ${seznam.polozky.length}.</p>` +
      (m ? `<p>Web zabírá <b>${mb(m.pouzito)}</b> z dostupných ${mb(m.kvota)}.</p>` : '<p>Prohlížeč velikost úložiště nesděluje.</p>') +
      '<p class="m98-pozn">Na iPhonu Safari maže data webu, který se 7 dní nepoužil – kromě stránky přidané na plochu.</p>', ['OK']);
  }

  // ---------- dialogy ----------
  function dialog98(titul, html, tlacitka = ['OK'], priOtevreni) {
    return new Promise(hotovo => {
      const d = $('dialog98');
      d.querySelector('.d98-titul').textContent = titul;
      d.querySelector('.d98-telo').innerHTML = html;
      const tl = d.querySelector('.d98-tlacitka'); tl.innerHTML = '';
      tlacitka.forEach((t, i) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'tl98'; b.textContent = t;
        b.addEventListener('click', () => { d.close(); hotovo(i); });
        tl.appendChild(b);
      });
      d.onclose = () => hotovo(-1);
      d.showModal();
      if (priOtevreni) priOtevreni(d, i => { d.close(); hotovo(i); });
    });
  }
  const potvrd = async text => (await dialog98(WA_SKIN.NAZEV, `<p>${esc(text)}</p>`, ['Ano', 'Ne'])) === 0;
  const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function stahni(blob, nazev) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nazev;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  async function ulozitPredvolbu() {
    let jmeno = '';
    const i = await dialog98('Uložit předvolbu EQ', '<label>Název: <input class="vstup98" id="d98-jmeno" maxlength="60"></label>', ['Uložit', 'Zrušit'],
      (d, zavri) => { const v = d.querySelector('#d98-jmeno'); v.focus(); v.addEventListener('input', () => { jmeno = v.value; }); v.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); zavri(0); } }); });
    jmeno = jmeno.trim();
    if (i !== 0 || !jmeno) return;
    nast.eqVlastni = nast.eqVlastni.filter(p => p.nazev !== jmeno).concat([{ nazev: jmeno, preamp: s.ekv.preamp, pasma: s.ekv.pasma.slice() }]);
    ulozNast(); oznam('EQ ULOZEN: ' + jmeno.toUpperCase());
  }
  async function pridatAdresu() {
    let url = '';
    const i = await dialog98('Přidat adresu', '<p>Adresa internetového rádia nebo zvukového souboru (http/https):</p><input class="vstup98" id="d98-url" type="url" placeholder="https://…">' +
      '<p class="m98-pozn">Rádio bez povolení CORS hraje „přímo“ – bez ekvalizéru a vizualizace. Stránka na https nepřehraje adresu http.</p>', ['Přidat', 'Zrušit'],
      (d, zavri) => { const v = d.querySelector('#d98-url'); v.focus(); v.addEventListener('input', () => { url = v.value; }); v.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); zavri(0); } }); });
    url = url.trim();
    if (i !== 0 || !/^https?:\/\/\S+$/i.test(url)) return;
    const holy = url.replace(/^https?:\/\//, '').replace(/[?#].*$/, '');
    let titul = holy; try { titul = decodeURIComponent(holy); } catch (e) { /* neplatné %XX */ }
    const p = J.novaPolozka({ url, soubor: '', titul });
    J.pridej(seznam, [p]);
    umistiOkna(); prekresli('pl'); ulozPlaylist();
    if (s.stav === 'stop') hrajIndex(seznam.polozky.length - 1);
  }
  async function infoSouboru(i) {
    const p = seznam.polozky[i];
    if (!p) return;
    let obal = '';
    const blob = p._file || (p.ulozena && await U.cti('soubory', p.id).catch(() => null)) || (p.slozka && ikony && await ikony.souborPolozky(p));
    if (blob) {
      try { const t = await T.precti(T.ctiBlob(blob), blob.size); if (t.obal) obal = URL.createObjectURL(new Blob([t.obal.data], { type: t.obal.mime })); } catch (e) { /* bez obalu */ }
    }
    const radek = (n, v) => v ? `<tr><th>${n}</th><td>${esc(v)}</td></tr>` : '';
    const kan = p.kanaly === 1 ? 'mono' : p.kanaly === 2 ? 'stereo' : p.kanaly ? p.kanaly + ' kanálů' : '';
    await dialog98('Informace o skladbě', `<div class="d98-info">${obal ? `<img src="${obal}" alt="Obal alba">` : ''}<table>
      ${radek('Název', p.titul)}${radek('Interpret', p.interpret)}${radek('Album', p.album)}${radek('Rok', p.rok)}${radek('Stopa', p.stopa)}${radek('Žánr', p.zanr)}
      ${radek('Délka', J.mmss(p.delka))}${radek('Formát', [p.format, p.kbps && p.kbps + ' kbps', p.khz && p.khz + ' kHz', kan].filter(Boolean).join(', '))}
      ${radek('Soubor', p.url || ((p.cesta ? p.cesta + '/' : '') + p.soubor))}${radek('Velikost', blob ? (blob.size / 1048576).toFixed(2).replace('.', ',') + ' MB' : '')}
      ${radek('Uloženo v prohlížeči', p.ulozena ? 'ano' : '')}</table></div>`, ['Zavřít']);
    if (obal) URL.revokeObjectURL(obal);
  }
  async function skokNaSkladbu() {
    let vybrano = -1;
    const i = await dialog98('Skok na skladbu', '<input class="vstup98" id="d98-hledat" placeholder="Hledat (slova bez diakritiky)…"><div class="d98-seznam" id="d98-vysl" role="listbox"></div>', ['Přehrát', 'Zavřít'],
      (d, zavri) => {
        const v = d.querySelector('#d98-hledat'), vysl = d.querySelector('#d98-vysl');
        const ukaz = () => {
          const idx = J.hledej(seznam, v.value).slice(0, 300);
          vybrano = idx.length ? idx[0] : -1;
          vysl.innerHTML = idx.map(n => `<div class="d98-radek${n === vybrano ? ' vybrany' : ''}" data-i="${n}">${n + 1}. ${esc(J.titulek(seznam.polozky[n]))}</div>`).join('');
        };
        vysl.addEventListener('click', e => { const r = e.target.closest('[data-i]'); if (!r) return; vybrano = +r.dataset.i; vysl.querySelectorAll('.vybrany').forEach(x => x.classList.remove('vybrany')); r.classList.add('vybrany'); });
        vysl.addEventListener('dblclick', e => { const r = e.target.closest('[data-i]'); if (r) { vybrano = +r.dataset.i; zavri(0); } });
        v.addEventListener('input', ukaz);
        v.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); zavri(0); } });
        ukaz(); v.focus();
      });
    if (i === 0 && vybrano >= 0) hrajIndex(vybrano);
  }
  function oProgramu() {
    dialog98(`O programu ${WA_SKIN.NAZEV}`, `<div class="d98-o"><canvas id="d98-lama" width="13" height="15"></canvas><div>
      <p><b>${WA_SKIN.NAZEV} ${VERZE}</b> – retro přehrávač hudby.</p>
      <p>Umí načíst klasické skiny <code>.wsz</code>.</p>
      <p>Skladby se přehrávají jen v tomto prohlížeči, nikam se neodesílají.</p>
</div></div>`, ['OK'],
      d => { const c = d.querySelector('#d98-lama'); c.getContext('2d').drawImage(WA_SKIN.vychozi().main, 253, 91, 13, 15, 0, 0, 13, 15); });
  }

  // ---------- Media Session ----------
  const ms = 'mediaSession' in navigator ? navigator.mediaSession : null;
  let obalMedia = null;
  async function obnovMedia(p) {
    if (!ms || !p) return;
    const md = { title: p.titul || J.titulek(p), artist: p.interpret || '', album: p.album || '' };
    try { ms.metadata = new MediaMetadata(md); } catch (e) { return; }
    obnovStavMedia();
    const blob = p._file;
    if (!blob) return;
    try {
      const t = await T.precti(T.ctiBlob(blob), blob.size);
      if (t.obal && p === seznam.polozky[seznam.aktualni]) {
        if (obalMedia) URL.revokeObjectURL(obalMedia);
        obalMedia = URL.createObjectURL(new Blob([t.obal.data], { type: t.obal.mime }));
        ms.metadata = new MediaMetadata(Object.assign(md, { artwork: [{ src: obalMedia, sizes: '512x512', type: t.obal.mime }] }));
      }
    } catch (e) { /* bez obalu */ }
  }
  function obnovStavMedia() { if (ms) ms.playbackState = s.stav === 'hraje' ? 'playing' : s.stav === 'pauza' ? 'paused' : 'none'; }
  function obnovPoziciMedia() {
    if (!ms || !ms.setPositionState || !isFinite(s.delka) || !s.delka) return;
    try { ms.setPositionState({ duration: s.delka, position: Math.min(s.cas, s.delka), playbackRate: 1 }); } catch (e) { /* neplatná pozice */ }
  }
  if (ms) {
    const h = (a, fn) => { try { ms.setActionHandler(a, fn); } catch (e) { /* nepodporováno */ } };
    h('play', () => { if (s.stav !== 'hraje') prehrat(); }); h('pause', () => { if (s.stav === 'hraje') pozastavit(); }); h('stop', zastav);
    h('previoustrack', () => skok(-1)); h('nexttrack', () => skok(1));
    h('seekbackward', d => posunCas(-(d.seekOffset || 10))); h('seekforward', d => posunCas(d.seekOffset || 10));
    h('seekto', d => { zvuk.cas = d.seekTime; s.cas = d.seekTime; obnovPoziciMedia(); });
  }

  // ---------- klávesy ----------
  document.addEventListener('keydown', e => {
    if (e.target.closest('input, textarea, select, dialog') || document.querySelector('dialog[open]')) return;
    if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('button, [role=button], #menu98, .nabidka')) return;   // aktivace tlačítka
    if (e.key === 'Escape') { zavriMenu(); if (s.plNabidka) { s.plNabidka = null; prekresli('pl'); } return; }
    if (e.key === 'F1') { e.preventDefault(); return $('napoveda').showModal(); }
    const kl = e.key.length === 1 ? e.key.toLowerCase() : e.key, ctrl = e.ctrlKey || e.metaKey;
    let hotovo = true;
    if (e.altKey && (kl === 'g' || e.code === 'KeyG')) akce('eq');
    else if (e.altKey && (kl === 'e' || e.code === 'KeyE')) akce('pl');
    else if (e.altKey && (kl === '3' || e.code === 'Digit3')) infoSouboru(seznam.aktualni);
    else if (ctrl && kl === 'd') akce('clutterD');
    else if (ctrl && kl === 't') klik('cas');
    else if (ctrl && kl === 'a') { J.vyberVse(seznam, true); prekresli('pl'); }
    else if (ctrl || e.altKey) hotovo = false;
    else if (kl === 'z') skok(-1);
    else if (kl === 'x') prehrat();
    else if (kl === 'c' || kl === ' ') pozastavit();
    else if (kl === 'v') e.shiftKey ? zastavZtlumenim() : zastav();
    else if (kl === 'b') skok(1);
    else if (kl === 'j') skokNaSkladbu();
    else if (kl === 'l') otevritSoubory('otevrit');
    else if (kl === 'r') akce('repeat');
    else if (kl === 's') akce('shuffle');
    else if (kl === 'ArrowLeft') posunCas(-5);
    else if (kl === 'ArrowRight') posunCas(5);
    else if (kl === 'ArrowUp') { nastavHlasitost(s.hlasitost + 2); oznam(H.zpravaPosuvniku('hlasitost', s.hlasitost), 800); }
    else if (kl === 'ArrowDown') { nastavHlasitost(s.hlasitost - 2); oznam(H.zpravaPosuvniku('hlasitost', s.hlasitost), 800); }
    else if (kl === 'Delete') akce('odebratVybrane');
    else if (kl === 'Enter') { const i = seznam.polozky.findIndex(p => p.vybrana); if (i >= 0) hrajIndex(i); }
    else if (kl === 'PageUp' || kl === 'PageDown') { s.plPosun = omez(s.plPosun + (kl === 'PageUp' ? -1 : 1) * P.viditelnychRadku(s.plH), 0, P.maxPosun(seznam.polozky.length, s.plH)); prekresli('pl'); }
    else hotovo = false;
    if (hotovo) e.preventDefault();
  });
  // okno prohlížeče bez fokusu → lišty neaktivní (jako ve Windows)
  let posledniOkno = 'hlavni';
  addEventListener('focus', () => { s.aktivniOkno = posledniOkno; s.aktivni = posledniOkno === 'hlavni'; prekresli(); });
  addEventListener('blur', () => { if (s.aktivniOkno) posledniOkno = s.aktivniOkno; s.aktivni = false; s.aktivniOkno = ''; prekresli(); });

  // ---------- horní lišta stránky ----------
  function nastavZoom(z) { nast.zoom = z; s.dvojita = z === '2'; ulozNast(); obnovPrepinace(); spoctiMeritko(); umistiOkna(); prekresli(); }
  function nastavPozadi(p) { nast.pozadi = p; plocha.classList.toggle('win98', p === 'win98'); ulozNast(); obnovPrepinace(); }
  function prepniVyhlazeni() { nast.vyhlazeni = !nast.vyhlazeni; ulozNast(); obnovPrepinace(); prekresli(); if (ikony) ikony.obnov(); }
  function obnovPrepinace() {
    document.querySelectorAll('.prep').forEach(b => {
      const h = b.dataset.prikaz === 'zoom' ? nast.zoom : b.dataset.prikaz === 'pozadi' ? nast.pozadi : b.dataset.prikaz === 'vyhlazeni' ? (nast.vyhlazeni ? '1' : '0') : null;
      if (h !== null) b.setAttribute('aria-pressed', String(h === b.dataset.hodnota));
    });
  }
  function zavriNabidky() { document.querySelectorAll('.nabidka:not([hidden])').forEach(n => { n.hidden = true; }); }
  document.querySelectorAll('[data-nabidka]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    const n = $(b.dataset.nabidka), bylo = !n.hidden;
    zavriNabidky();
    if (bylo) return;
    n.hidden = false;
    const r = b.getBoundingClientRect();
    n.style.top = (r.bottom + 4) + 'px';
    n.style.left = Math.max(6, Math.min(r.left, innerWidth - n.offsetWidth - 6)) + 'px';
  }));
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-prikaz]');
    if (b) { e.stopPropagation(); zavriNabidky(); return prikaz(b.dataset.prikaz, b.dataset.hodnota, b); }
    if (!e.target.closest('.nabidka')) zavriNabidky();
  });
  async function prikaz(p, hodnota, b) {
    const r = b.getBoundingClientRect();
    switch (p) {
      case 'zoom': return nastavZoom(hodnota);
      case 'vyhlazeni': return prepniVyhlazeni();
      case 'pozadi': return nastavPozadi(hodnota);
      case 'napoveda': return $('napoveda').showModal();
      case 'otevrit': return otevritSoubory('otevrit');
      case 'pridat': return otevritSoubory('pridat');
      case 'slozka': return otevritSlozku();
      case 'adresa': return pridatAdresu();
      case 'novaSlozka': return ikony.novaSlozka();
      case 'skiny': return otevriMenu(menuSkinu(await sLimitem(U.klice('skiny'), 400, [])), r.left, r.bottom + 4);
      case 'ulozitSeznam': return otevriMenu(menuUlozitSeznam(), r.left, r.bottom + 4);
      case 'menu': return otevriMenuKontext(r.left, r.bottom + 4);
      case 'rozlozeni': s.stinHlavni = s.stinEq = s.stinPl = false; s.eq = s.pl = true; skryto = false; $('obnovit').hidden = true; vychoziRozlozeni(); umistiOkna(); return prekresli();
    }
  }

  // ---------- složky na ploše ----------
  function naOkneXY(x, y) {
    for (const id of ['hlavni', 'eq', 'pl']) {
      if (!viditelne(id)) continue;
      const r = OKNA[id].el.getBoundingClientRect();
      if (x >= r.left && x < r.right && y >= r.top && y < r.bottom) return id;
    }
    return null;
  }
  function zeptej(titul, vychozi = '') {
    let hodnota = vychozi;
    return dialog98(titul, `<input class="vstup98" id="d98-text" maxlength="80" value="${esc(vychozi)}">`, ['OK', 'Zrušit'],
      (d, zavri) => {
        const v = d.querySelector('#d98-text'); v.focus(); v.select();
        v.addEventListener('input', () => { hodnota = v.value; });
        v.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); zavri(0); } });
      }).then(i => i === 0 && hodnota.trim() ? hodnota.trim() : null);
  }
  // výběr skladeb pro složku v prohlížeči: na počítači celá složka, na iPhonu soubory
  function vyberSoubory() {
    return new Promise(hotovo => {
      const v = document.createElement('input');
      v.type = 'file'; v.multiple = true; v.accept = 'audio/*,.mp3,.m4a,.aac,.flac,.ogg,.oga,.opus,.wav';
      if ('webkitdirectory' in v && !zvuk.jeIos()) { v.webkitdirectory = true; v.removeAttribute('accept'); }
      v.addEventListener('change', () => hotovo([...v.files]));
      v.addEventListener('cancel', () => hotovo(null));
      v.click();
    });
  }
  ikony = WA_PLOCHA.vytvor({
    el: plocha, kontejner: $('ikony'), U, J, nast, ulozNast, oznam, dialog98, potvrd, zeptej, esc, otevriMenu, vyberSoubory, pridejSoubory,
    meritko: () => k / dpr,
    vyhlazeni: () => nast.vyhlazeni,
    naOkne: naOkneXY,
    obalkaOken: () => {
      const r = vsechnaOkna();
      if (!r.length) return null;
      const o = O.obalka(r);
      return { left: css(o.x), top: css(o.y), right: css(o.x + o.w), bottom: css(o.y + o.h) };
    },
    odebranaSlozka: id => {
      const predtim = seznam.polozky.slice();
      J.odeberIndexy(seznam, predtim.map((p, i) => p.slozka === id ? i : -1).filter(i => i >= 0));
      if (seznam.polozky.length !== predtim.length) poOdebrani(predtim);
    },
    aktualniSlozka: () => { const p = seznam.polozky[seznam.aktualni]; return s.stav !== 'stop' && p ? p.slozka || null : null; },
    menuPozadi: () => [
      zaskrt('Pozadí tmavé', nast.pozadi === 'tmave', () => nastavPozadi('tmave')),
      zaskrt('Pozadí Windows 98', nast.pozadi === 'win98', () => nastavPozadi('win98'))
    ]
  });
  WA_APP.ikony = ikony;

  // první dotyk nebo klávesa odemkne zvuk (iPhone jinak odmítne play() po asynchronním načtení skladby)
  const odemkni = () => { zvuk.odemkni(); removeEventListener('pointerdown', odemkni, true); removeEventListener('keydown', odemkni, true); };
  addEventListener('pointerdown', odemkni, true); addEventListener('keydown', odemkni, true);

  // ---------- jedna záložka zapisuje ----------
  // Dvě otevřené záložky by si přepisovaly playlist a složky (vyhrává poslední zápis) a úklid by mazal cizí skladby.
  // Zápisy proto dělá jen záložka, která drží zámek; další záložka jen čte. Bez Web Locks se jen neuklízí.
  let zamek = 'cekam';
  if (navigator.locks && navigator.locks.request) {
    navigator.locks.request('webapp_lamamp_zapis', { ifAvailable: true }, z => {
      zamek = z ? 'mam' : 'nemam';
      if (!z) {
        U.jenCteni = true;
        oznam('OTEVRENO V JINE ZALOZCE - ZMENY SE TU NEUKLADAJI', 8000);
        dialog98(WA_SKIN.NAZEV, '<p>Přehrávač je otevřený i v jiné záložce. Tady můžeš poslouchat, ale <b>změny playlistu, složek a skinů se neuloží</b>, aby si záložky nepřepisovaly data.</p><p class="m98-pozn">Ukládat se bude po zavření ostatních záložek a obnovení této stránky.</p>', ['OK']);
        return;
      }
      return new Promise(() => {});   // zámek drží záložka až do zavření
    }).catch(() => { zamek = 'nepodporovano'; });
  } else zamek = 'nepodporovano';

  // ---------- start ----------
  if (window.self === window.top) document.body.classList.add('samostatne');
  if (!('webkitdirectory' in $('vstupSlozka')) || zvuk.jeIos()) document.querySelectorAll('[data-prikaz="slozka"]').forEach(b => { b.disabled = true; });
  s.plNapoveda = ['Přetáhni sem písničky nebo celou složku,', 'nebo klikni na ⏏ v přehrávači či na ADD.', '',
    'Pravé tlačítko (na dotyku dlouhé podržení) = nabídka.', 'Dvojklik na lištu okno zmenší, F1 nápověda.',
    ...(zvuk.jeIos() ? ['', 'iPhone: skladby z aplikace Soubory.', 'Ekvalizér: nabídka → Možnosti → Web Audio.'] : [])];
  nastavPozadi(nast.pozadi);
  spoctiMeritko();
  if (!nast.rozlozeno) vychoziRozlozeni();
  umistiOkna();
  nastavTitulek();
  if (nast.skin) prepniSkin(nast.skin);
  if (nast.pamatovat) U.trvale();   // požádat prohlížeč, ať uložené skladby nemaže
  Promise.all([obnovPlaylist(), ikony.nacti()]).then(([a, b]) => { if (a && b) setTimeout(uklidSirotky, 4000); });
  // zavření / skrytí stránky: uložit hned (jinak by se ztratily změny z posledních 0,7 s)
  addEventListener('pagehide', ulozHned);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') ulozHned(); });
  function zmenaMeritka() { zavriNabidky(); zavriMenu(); spoctiMeritko(); umistiOkna(); prekresli(); hlidejDpr(); }
  addEventListener('resize', zmenaMeritka);
  // přesun okna prohlížeče na jiný monitor mění devicePixelRatio bez události resize
  let dprDotaz = null;
  function hlidejDpr() {
    if (dprDotaz) (dprDotaz.removeEventListener ? dprDotaz.removeEventListener('change', zmenaMeritka) : dprDotaz.removeListener(zmenaMeritka));
    dprDotaz = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    if (dprDotaz.addEventListener) dprDotaz.addEventListener('change', zmenaMeritka, { once: true });
    else dprDotaz.addListener(zmenaMeritka);   // Safari 13
  }
  hlidejDpr();
  prekresli();
  requestAnimationFrame(smycka);

  Object.assign(WA_APP, { pridejSoubory, hrajIndex, akce, prekresli, nactiSkinSoubor, nast });
  Object.defineProperty(WA_APP, 'skin', { get: () => skin });
})();

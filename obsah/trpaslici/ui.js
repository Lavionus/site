/* ============================================================
   Srdce hory – ui.js: plátno, kamera, ovládání, herní smyčka a panel.
   Jediný soubor (vedle grafika.js), který sahá na DOM.
   ============================================================ */
var TRP = globalThis.TRP = globalThis.TRP || {};

(function (T) {
  'use strict';
  const HORA = T.hora, G = T.grafika, HRA = T.hra, P = T.prace, ST = T.stavby, U = T.ulozeni, POT = T.potreby, OB = T.obdobi, UD = T.udalosti, PB = T.pribeh, Z = T.zvuk;
  const { W, H, UDOLI, M, MATERIAL, RUDA, OBJEKT } = HORA;
  const S = G.S;
  const KLIC_SEED = 'webapp_hra_trpaslici_seed';
  const KLIC_ULOZENI = 'webapp_hra_trpaslici_save';
  const KLIC_VELIKOST = 'webapp_hra_trpaslici_velikost', KLIC_NOVA = 'webapp_hra_trpaslici_nova';   // velikost hory; nová hra po přenačtení
  const KLIC_GRAFIKA = 'webapp_hra_trpaslici_grafika';
  const KLIC_PREPNUTI = 'webapp_hra_trpaslici_prepnuti';    // sessionStorage: kolikrát po sobě se stránka kvůli velikosti hory načetla znovu (pojistka proti smyčce)
  const KLIC_EFEKTY = 'webapp_hra_trpaslici_efekty';        // JSON { svetlo: true, … } – jen změněné volby
  const TAH_MS = 100;                            // jeden tah simulace při rychlosti 1×
  const $ = id => document.getElementById(id);

  const st = { hra: null, vseZnamo: false, vyber: null, najeti: null, nastroj: 'pohled', tah: null,
               vybrany: 0, sledovat: false, rychlost: 1, predPauzou: 1, alfa: 0, rozbaleno: {} };
  const kam = { x: 0, y: 0, z: 3 };
  let cv, ctx, mini, mctx, dpr = 1, spinave = true, snimek = 0;
  let rekordy = null;                               // osobní rekordy (rekord.js), když je k dispozici
  const cas0 = performance.now();

  const uloziste = {
    cti(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    pis(k, v) {
      try { localStorage.setItem(k, v); return true; }
      catch (e) {                                   // plné úložiště ohlásit jednou; soukromé okno potichu
        const plno = e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014);
        if (plno && !st.chybaMista) { st.chybaMista = true; oznam('Uložení selhalo – místo v prohlížeči došlo, exportuj hru do souboru (☰ → 💾 Uložit do souboru).', true); }
        return false;
      }
    },
  };
  // text prvku jen při změně: přepis textContent by každé 4 s za vteřinu znovu vytvářel obrázkové ikony (ui-skin.js)
  const textJen = (el, v) => { if (el.dataset.t !== v) { el.textContent = v; el.dataset.t = v; } };
  const mn = (n, a, b, c) => `${n} ${n === 1 ? a : n >= 2 && n <= 4 ? b : c}`;   // 1 pole, 2 pole, 5 polí

  // --- hra --------------------------------------------------------------------------
  // nová hra začíná v pauze s „Co dál?" nahoře v Přehledu
  function novaHra(seed, rezim) {
    zacniHru(HRA.novaHra(seed, rezim || ($('rezimVolny') && $('rezimVolny').checked ? 'volny' : 'kampan')));
    uloz(); nastavRychlost(0);
    if (st.zalozka) zalozka('prehled');
  }
  function zacniHru(hra) {
    st.hra = hra;
    st.vyber = null; st.najeti = null; st.vybrany = 0; st.sledovat = false; st.tah = null;
    st.denikVidel = hra.tik;                        // staré zprávy uložené hry nejsou „nové"
    st.posledniOznameni = hra.denik[hra.denik.length - 1] || null;   // oznámení jen o tom, co se stane od teď
    uloziste.pis(KLIC_SEED, String(st.hra.seed));
    $('nazevHory').textContent = st.hra.hora.nazev;
    $('nadpisHory').textContent = st.hra.hora.nazev;
    $('seedChip').textContent = st.hra.seed;
    $('seed').value = st.hra.seed;
    kam.z = vychoziZoom();
    naBranu();
    $('jak').open = hra.tik < HRA.TAHU_ZA_DEN;      // nápověda rozbalená jen na začátku hry
    $('btnKonec').hidden = true;
    posledniDenik = -1;
    obnovPanel(true);
    spinave = true;
  }
  let posledniUlozenyDen = 0;
  function uloz() {
    if (!st.hra || st.bezUkladani) return;         // po chybě (načtení / simulace) se neukládá, dokud hráč nerozhodne
    uloziste.pis(KLIC_ULOZENI, U.serializuj(st.hra));
    posledniUlozenyDen = HRA.den(st.hra);
  }
  // hlášení nahoře v Přehledu (chyba načtení, chyba simulace); tlačítka [text, akce]
  function ukazHlaseni(text, tlacitka) {
    const el = $('hlaseni');
    el.innerHTML = `<p>${text}</p><div class="radek">` + tlacitka.map(([t, a], k) => `<button class="btn${k ? ' sede' : ''} mini-sirka" data-hlaseni="${a}">${t}</button>`).join('') + '</div>';
    el.hidden = false;
  }
  function stahniText(text, jmeno) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = jmeno;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function akceHlaseni(a) {
    if (a === 'export') { exportuj(); return; }
    if (a === 'zavri') { $('hlaseni').hidden = true; return; }
    if (a === 'vratZalohu') {                       // vrátit hru zálohovanou před importem (i jiné velikosti hory)
      const z = uloziste.cti(KLIC_ULOZENI + '_zaloha');
      let d = null; try { d = JSON.parse(z); } catch (e) { /* poškozená záloha */ }
      const vel = d && d.hra === 'srdce-hory' && Object.keys(HORA.VELIKOSTI).find(k => HORA.VELIKOSTI[k] === (d.sirka || 96));
      if (!vel) { oznam('Záloha se nedá vrátit – stáhni si ji do souboru.', true); return; }
      if (!znovuNacti([[KLIC_ULOZENI, z], [KLIC_VELIKOST, vel]])) selhaloPrepnuti('Vrácení předchozí hry');
      return;
    }
    if (a === 'zaloha') { stahniText(uloziste.cti(KLIC_ULOZENI + '_zaloha') || '', 'srdce-hory-zaloha.json'); return; }
    if (a === 'nacti') {                            // zpět k poslednímu uložení (napůl provedený tah zahodit)
      try { zacniHru(U.obnov(uloziste.cti(KLIC_ULOZENI))); }
      catch (e) { oznam('Poslední uložení se nedá načíst: ' + e.message, true); return; }
    }
    st.bezUkladani = null; $('hlaseni').hidden = true;
    uloz(); obnovPanel(true);
  }
  // výjimka v simulaci: pauza, hlášení a žádné ukládání (napůl provedený tah by se uložil)
  function chybaSimulace(e) {
    console.error(e);
    nastavRychlost(0);
    if (st.bezUkladani === 'chyba') return;
    st.bezUkladani = 'chyba';
    zalozka('prehled');
    ukazHlaseni(`⚠️ Ve hře nastala chyba (${String(e && e.message || e).replace(/[<&]/g, '')}). Hra je pozastavená a neukládá se, aby se neuložil napůl provedený tah.`,
      [['↺ Vrátit poslední uložení', 'nacti'], ['▶ Pokračovat a ukládat dál', 'pokracuj']]);
    oznam('Ve hře nastala chyba – hra je pozastavená, viz Přehled.', true);
  }
  function exportuj() {
    const blob = new Blob([U.serializuj(st.hra)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `srdce-hory-${st.hra.seed}-den${HRA.den(st.hra)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function importuj(soubor) {
    const r = new FileReader();
    r.onload = () => {
      try { zacniHru(U.obnov(r.result)); uloz(); oznam(`Načteno: ${st.hra.hora.nazev}, den ${HRA.den(st.hra)}.`); }
      catch (e) {
        const vel = e.sirka && Object.keys(HORA.VELIKOSTI).find(k => HORA.VELIKOSTI[k] === e.sirka);
        let d = null; try { d = JSON.parse(r.result); } catch (e2) { /* není JSON */ }
        if (vel && d && d.hra === 'srdce-hory') {      // jiná velikost hory: rozehranou zálohovat, soubor uložit a načíst znovu
          uloz();
          const puvodni = uloziste.cti(KLIC_ULOZENI);
          const zapisy = (puvodni != null ? [[KLIC_ULOZENI + '_zaloha', puvodni]] : []).concat([[KLIC_ULOZENI, r.result], [KLIC_VELIKOST, vel]]);
          try { sessionStorage.setItem(KLIC_PREPNUTI + '_import', '1'); } catch (e2) { /* nic */ }   // po načtení: kdyby soubor nešel přečíst, záloha rozehrané se nepřepíše
          if (!znovuNacti(zapisy)) {
            try { sessionStorage.removeItem(KLIC_PREPNUTI + '_import'); } catch (e2) { /* nic */ }
            selhaloPrepnuti('Načtení hory jiné velikosti');
          }
          return;
        }
        oznam('Soubor se nedá načíst: ' + e.message, true);
      }
    };
    r.readAsText(soubor);
  }
  // přepnutí velikosti hory: zapsat [klíč, hodnota] a načíst stránku znovu (moduly si šířku berou při startu).
  // Když zápis selže, vrátí původní hodnoty a false (bez přenačtení – jinak by se mohla točit smyčka);
  // stejně tak po dvou přenačteních za sebou bez úspěšného startu.
  function znovuNacti(zapisy) {
    let n = 0;
    try { n = Number(sessionStorage.getItem(KLIC_PREPNUTI)) || 0; } catch (e) { /* bez sessionStorage */ }
    if (n >= 2) return false;
    const predtim = zapisy.map(([k]) => [k, uloziste.cti(k)]);
    for (const [k, v] of zapisy) {
      if (uloziste.pis(k, v)) continue;
      for (const [k2, v2] of predtim) { try { if (v2 == null) localStorage.removeItem(k2); else localStorage.setItem(k2, v2); } catch (e) { /* nic */ } }
      return false;
    }
    try { sessionStorage.setItem(KLIC_PREPNUTI, String(n + 1)); } catch (e) { /* nic */ }
    st.bezUkladani = 'prepnuti';                    // pagehide → uloz() nesmí zapsané přepsat rozehranou hrou
    location.reload();
    return true;
  }
  function selhaloPrepnuti(co) {
    zalozka('prehled');
    ukazHlaseni(`⚠️ ${co} se nepovedlo – do úložiště prohlížeče nejde zapisovat (plné nebo zakázané). Rozehraná hra zůstala beze změny; ulož si ji do souboru a uvolni místo.`,
      [['💾 Uložit hru do souboru', 'export'], ['Zavřít', 'zavri']]);
    oznam(`${co} se nepovedlo – úložiště prohlížeče je plné nebo zakázané.`, true);
  }
  function oznam(text, chyba) { if (typeof Dialog !== 'undefined') (chyba ? Dialog.chyba : Dialog.info)(text); }

  // kolik polí hory je prozkoumaných (obloha se nepočítá)
  function statistika() {
    const { hora, znamo } = st.hra;
    let zname = 0, hory = 0;
    for (let i = 0; i < W * H; i++) {
      if (hora.pozadi[i] === M.VZDUCH) continue;
      hory++;
      if (st.vseZnamo || znamo[i]) zname++;
    }
    return 100 * zname / hory;
  }

  // --- kamera -----------------------------------------------------------------------
  const ZMIN = 1, ZMAX = 8;
  function nastavGrafiku(styl) {
    G.nastavStyl(styl); portrety.clear(); posledniKlan = '';
    uloziste.pis(KLIC_GRAFIKA, styl);
    spinave = true; if (st.hra) { obnovPanel(true); ukazVyber(); }
  }
  // přepínače efektů v nastavení: uložená volba se použije při startu, zaškrtávátka ukazují skutečný stav grafiky
  const EFEKTY = {
    svetlo: v => G.barevneSvetlo(v),
    obloha: v => G.oblohaEfekty(v),
    zare: v => G.aditivniEfekty(v),
    okraje: v => G.okrajeTerenu(v),
    otres: v => G.zatreseni(v),
    kamera: v => { if (v !== undefined) T.ui.plynule = v; return PLYNULE; },
  };
  function napojEfekty() {
    let ulozene = {};
    try { ulozene = JSON.parse(uloziste.cti(KLIC_EFEKTY) || '{}') || {}; } catch (e) { /* poškozený záznam – výchozí volby */ }
    for (const k in EFEKTY) if (typeof ulozene[k] === 'boolean' && EFEKTY[k]() !== ulozene[k]) EFEKTY[k](ulozene[k]);
    for (const c of document.querySelectorAll('input[data-efekt]')) {
      const k = c.dataset.efekt; if (!EFEKTY[k]) continue;
      c.checked = EFEKTY[k]();
      c.onchange = () => {
        ulozene[k] = EFEKTY[k](c.checked);
        c.checked = ulozene[k];
        uloziste.pis(KLIC_EFEKTY, JSON.stringify(ulozene));
        spinave = true;
      };
    }
  }
  function vychoziZoom() {
    const cssVyska = cv.height / dpr;
    return Math.max(2, Math.min(4, Math.round(cssVyska / (14 * S)))) * dpr;
  }
  // posun pohledu na místo zprávy a krátké zvýraznění pole
  function ukazMisto(i) {
    st.sledovat = false;
    vystred(i % W, i / W | 0, true);
    st.zvyrazni = { x: i % W, y: i / W | 0, do: performance.now() + 2500 };
    spinave = true;
  }
  function naBranu() { st.sledovat = false; vystred(st.hra.hora.brana.x + 1, st.hra.hora.brana.y - 2); }
  function vystred(tx, ty, plynule) {            // plynule: kamera k cíli dojede (jinak skok – testy čtou hned)
    if (plynule && PLYNULE) { zPohledu(); dojezd = true; } else srovnej();
    kam.x = (tx + 0.5) * S - cv.width / kam.z / 2;
    kam.y = (ty + 0.5) * S - cv.height / kam.z / 2;
    omezKameru();
  }
  function omezKameru() {                        // za okraj mapy se nedívá (tam nic není)
    const osa = (v, vel, rozmer) => {
      const lo = 0, hi = rozmer - vel;
      return lo > hi ? (rozmer - vel) / 2 : Math.max(lo, Math.min(hi, v));
    };
    kam.x = osa(kam.x, cv.width / kam.z, W * S);
    kam.y = osa(kam.y, cv.height / kam.z, H * S);
    spinave = true;
  }
  // z je v px zařízení na pixel světa; povolené jsou celé násobky dpr (ostré pixely).
  // kam je vždy cílový (logický) stav – mění se hned, takže testy i výpočty ho čtou synchronně;
  // plynule: vykreslovaný pohled (vid) k němu za ZOOM_MS doanimuje, bod pod kurzorem zůstává na místě
  function zoomuj(krok, cx, cy, plynule) {
    const anim_ = plynule && PLYNULE;
    if (!anim_) srovnej();
    const uroven = Math.round(kam.z / dpr) + krok;
    const nz = Math.max(ZMIN, Math.min(ZMAX, uroven)) * dpr;
    if (nz === kam.z) return;
    if (cx == null) { cx = cv.width / 2; cy = cv.height / 2; }
    if (anim_) {                                   // animace začíná z právě vykresleného pohledu (i uprostřed jiné)
      zPohledu();
      zoomAnim = { t0: performance.now(), z0: vid.z, cx, cy, wx: vid.x + cx / vid.z, wy: vid.y + cy / vid.z };
    }
    const wx = kam.x + cx / kam.z, wy = kam.y + cy / kam.z;
    kam.z = nz;
    kam.x = wx - cx / nz; kam.y = wy - cy / nz;
    omezKameru();
  }

  // --- plynulá kamera: vid = co je právě vidět; bez animace a dojezdu je pohledem přímo kam -------------
  let PLYNULE = !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);   // přepínač plynulého zoomu, dojezdu a setrvačnosti
  const ZOOM_MS = 150, DOJEZD_MS = 140, SETRV_MS = 320;   // délka animace zoomu, časová konstanta dojezdu a útlumu setrvačnosti
  const vid = { x: 0, y: 0, z: 3 };
  let zoomAnim = null, dojezd = false, setrv = null;     // setrv = {vx, vy} ve světových px za ms
  const pohled = () => (zoomAnim || dojezd) ? vid : kam;
  function zPohledu() { if (!zoomAnim && !dojezd) { vid.x = kam.x; vid.y = kam.y; vid.z = kam.z; } }
  function srovnej() { zoomAnim = null; dojezd = false; }             // okamžitě ukázat cílový stav
  function zastavKameru() {                        // dotyk / tažení: vše, co se dotahuje, zůstane tam, kde je vidět
    setrv = null;
    if (dojezd && !zoomAnim) dojezd = false;      // dojetí se dokončí skokem – cíl (kam) se nemění, jinak by první bod tažení mířil jinam než další
  }
  function kamKresby() {                          // posun zaokrouhlený na celé px zařízení (i při necelém z) – sprity se nechvějí
    const v = pohled(), z = v.z;
    return { x: Math.round(v.x * z) / z, y: Math.round(v.y * z) / z, z };
  }
  function krokKamery(ted, dt) {                  // jednou za snímek: setrvačnost, animace zoomu, dojezd
    if (setrv) {
      kam.x += setrv.vx * dt; kam.y += setrv.vy * dt;
      const x0 = kam.x, y0 = kam.y; omezKameru();
      if (kam.x !== x0) setrv.vx = 0;              // o okraj mapy se zastaví
      if (kam.y !== y0) setrv.vy = 0;
      const u = Math.exp(-dt / SETRV_MS); setrv.vx *= u; setrv.vy *= u;
      if (Math.hypot(setrv.vx, setrv.vy) * kam.z < 0.03) setrv = null;   // pod ~0,03 px zařízení za ms
    }
    if (zoomAnim) {
      const s = Math.min(1, (ted - zoomAnim.t0) / ZOOM_MS), e = 1 - (1 - s) ** 3;
      if (s >= 1) zoomAnim = null;
      else {
        // z geometricky (stejně rychlé kroky 2→3 i 6→8); bod pod kurzorem se posouvá jen o případné omezení okrajem
        const z = zoomAnim.z0 * (kam.z / zoomAnim.z0) ** e, a = zoomAnim;
        const wx = a.wx + (kam.x + a.cx / kam.z - a.wx) * e, wy = a.wy + (kam.y + a.cy / kam.z - a.wy) * e;
        vid.z = z; vid.x = wx - a.cx / z; vid.y = wy - a.cy / z;
        dojezd = false;
      }
      spinave = true;
    } else if (dojezd) {
      const k = 1 - Math.exp(-dt / DOJEZD_MS);
      vid.z = kam.z; vid.x += (kam.x - vid.x) * k; vid.y += (kam.y - vid.y) * k;
      if (Math.abs(kam.x - vid.x) * kam.z < 0.5 && Math.abs(kam.y - vid.y) * kam.z < 0.5) dojezd = false;
      spinave = true;
    }
  }
  function velikost() {
    const obal = $('mapaObal');
    const staryDpr = dpr;
    dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(obal.clientWidth * dpr)), h = Math.max(1, Math.round(obal.clientHeight * dpr));
    if (cv.width === w && cv.height === h && staryDpr === dpr) return;
    const stred = cv.width > 1 ? { x: kam.x + cv.width / kam.z / 2, y: kam.y + cv.height / kam.z / 2 } : null;
    if (staryDpr !== dpr) kam.z = Math.max(1, Math.round(kam.z / staryDpr)) * dpr;
    cv.width = w; cv.height = h;
    if (stred) { kam.x = stred.x - w / kam.z / 2; kam.y = stred.y - h / kam.z / 2; }
    srovnej(); setrv = null;
    omezKameru();
  }
  function poleZBodu(ox, oy) {                   // CSS px na plátně → pole: během animace zoomu podle toho, co je vidět;
    const k = zoomAnim ? kamKresby() : kam;       // při krátkém dojezdu kamery podle cíle (skripty a testy počítají body z kam)
    return { x: Math.floor((k.x + ox * dpr / k.z) / S), y: Math.floor((k.y + oy * dpr / k.z) / S) };
  }
  function trpaslikNa(p) {                        // trpaslík, který je vidět na poli (i v pohybu)
    let nej = null, nd = 1e9;
    for (const t of st.hra.trpaslici) {
      const q = G.polohaTrpaslika(t, st.alfa);
      const d = Math.hypot(q.x - (p.x + 0.5) * S, q.y - (p.y + 0.5) * S);
      if (d < 12 && d < nd) { nd = d; nej = t; }
    }
    return nej;
  }

  // --- panel ------------------------------------------------------------------------
  const MISTA = {
    krapnikova: 'krápníková jeskyně', jeskyne: 'jeskyně', houbova: 'houbová jeskyně', jezero: 'podzemní jezero',
    hlubinna: 'hlubinná jeskyně', tunel: 'cizí tunel', magma: 'magmatická kapsa', sin: 'Síň předků',
    straznice: 'strážnice předků', srdce: 'Srdce hory',
  };
  const radek = (a, b) => `<div class="radek"><span>${a}</span><span>${b}</span></div>`;
  function popisPole(p) {
    if (!p || p.x < 0 || p.y < 0 || p.x >= W || p.y >= H) return '<p class="tip">Klikni na pole nebo na trpaslíka.</p>';
    const hra = st.hra, hora = hra.hora, i = p.y * W + p.x;
    const radky = [];
    const r = (a, b) => radky.push(radek(a, b));
    const hl = p.y - UDOLI;
    r('Hloubka', hl === 0 ? 'v úrovni údolí' : hl < 0 ? `${-hl} m nad údolím` : `${hl} m pod údolím`);
    const hv = PB.hloubkaVarovani(hra);                // pásmo Spáče: od 130 m varování, od 138 m ho kopání probudí
    if (hv.aktivni && p.y >= hv.yPrah) r('⚠️ Spáč', `<b class="spatne">kopání tady ho probudí – nejdřív ukuj Klíč k Srdci</b>`);
    else if (hv.aktivni && p.y >= hv.yOd) r('⚠️ blízko Spáče', `<span class="spatne">od ${hv.prah} m ho kopání probudí</span>`);
    if (!st.vseZnamo && !hra.znamo[i]) {
      r('Co tu je', '<i>neprozkoumaná hora</i>');
    } else {
      const t = hora.teren[i], mat = MATERIAL[t];
      if (mat.pevne) {
        r('Hornina', mat.nazev);
        if (hora.ruda[i]) r('Žíla', '<b>' + RUDA[hora.ruda[i]].nazev + '</b>');
        r('Tvrdost', t === M.PODLOZI ? 'nedá se prokopat' : '⛏️'.repeat(mat.tvrdost));
        if (t !== M.PODLOZI && mat.tvrdost >= P.TVRDA) r('Krumpáč', `tvrdá skála – bez železného krumpáče ${String(P.BEZ_ZELEZA).replace('.', ',')}× pomaleji`);
        r('Unese strop', t === M.PODLOZI ? '–' : `${P.rozpetiNa ? P.rozpetiNa(hra, i) : mat.rozpeti} polí bez podpěry`);
        const pr = (hra.praskani || []).find(q => q.y - 1 === p.y && p.x >= q.x0 && p.x <= q.x1);
        if (pr) r('⚠️ Strop', `<b class="spatne">praská – zřítí se za ${Math.max(0, Math.ceil((pr.tik - hra.tik) / 10))} s</b>`);
      } else if (t === M.VODA || t === M.MAGMA) {
        r('Kapalina', mat.nazev);
        if (hra.stavba[i] === ST.K.STUDNA) r('Stavba', '🪣 studna – voda tu zůstane, pije se z ní');
      } else {
        r('Volno', hora.pozadi[i] === M.VZDUCH ? 'obloha' : 'dutina (' + MATERIAL[hora.pozadi[i]].nazev + ')');
        if (hra.lez[i] === 1) r('Stavba', 'vytesané schodiště');
        const pr = (hra.praskani || []).find(q => q.y <= p.y && p.x >= q.x0 && p.x <= q.x1 && p.y - q.y < 3);
        if (pr) r('⚠️ Strop nad', `<b class="spatne">praská – podepři ho (zřítí se za ${Math.max(0, Math.ceil((pr.tik - hra.tik) / 10))} s)</b>`);
        if ((hra.prameny || []).some(q => q.i === i)) r('Pramen', 'z pukliny tu vytéká voda');
        if (hra.lez[i] === 2) r('Stavba', 'žebřík');
        if (hra.lez[i] === 3) r('Stavba', 'výtah');
        const kod = hra.stavba[i];
        if (kod && kod !== ST.K.DILNA) r('Stavba', ST.STAVBY[ST.KOD_TYP[kod]].nazev + (hra.materialNa.get(i) === 'kamen' ? ' (kamenný)' : ''));
      }
      if (hora.obj[i]) r('Objekt', OBJEKT[hora.obj[i]]);
      const ob = hora.oblast[i] && hora.oblasti.find(o => o.cislo === hora.oblast[i]);
      if (ob && (st.vseZnamo || hra.objeveno[ob.cislo])) r('Místo', MISTA[ob.typ] || ob.typ);
      const veci = P.veciNa(hra, i);
      if (veci.length) r('Leží tu', veci.map(v => P.VECI[v.druh].nazev).join(', '));
    }
    if (hra.oznac[i]) r('Práce', { [P.OZN.SCHODY]: '⛰️ vytesat schodiště', [P.OZN.KACET]: '🪓 kácet', [P.OZN.TESAT]: (hora.teren[i] === M.VZDUCH ? '🧱 otesat stěnu' : '🧱 otesat ' + (P.jePodlaha(hra, i) ? 'podlahu' : hora.teren[i + W] === M.VZDUCH ? 'strop' : 'stěnu z horniny') + (hora.ruda[i] ? ' (ruda se vytěží)' : '')) + (P.tesatZaKamen(hra, i) ? ' – za 1 kámen' : '') }[hra.oznac[i]] || '⛏️ vykopat');
    return radky.join('');
  }
  function popisTrpaslika(t) {
    const hra = st.hra, pr = HRA.PROFESE[t.prof];
    const y = (t.i / W | 0) - UDOLI;
    const zdravi = t.zdravi >= 100 ? 'zdravý' : t.zdravi > 60 ? 'pohmožděný' : t.zdravi > 30 ? 'zraněný' : 'těžce zraněný';
    return `<div class="trp-hlava"><img src="${portret(t)}" alt="" width="32" height="32"><div><b>${t.jmeno}</b><br><span class="popis">${pr.nazev}</span></div></div>` +
      [['Dělá', cinnost(hra, t)], ['Zdraví', `${zdravi} (${Math.max(0, Math.round(t.zdravi))} %)`],
       ['Kde', y === 0 ? 'v úrovni údolí' : y < 0 ? `${-y} m nad údolím` : `${y} m pod údolím`]].map(([a, b]) => radek(a, b)).join('') +
      // dovednosti a výbava sbalitelné – detail jinak přetéká
      rozbal('dov', '🎓 Dovednosti a výbava', [['Kopání', hvezdy(Math.ceil(t.dov.kopani / 4)) + ` ${t.dov.kopani}/20`],
       ['Boj', hvezdy(Math.ceil((t.dov.boj || 0) / 2)) + ` ${t.dov.boj || 0}/10` + (t.zbran ? ' · 🗡️ válečná sekera' : '') + (t.zbroj ? ` · 🛡️ ${t.zbroj.mat === 'med' ? 'měděná' : 'železná'} zbroj` : '')],
       ['Nástroj', t.nastroj ? `${P.VECI[t.nastroj.druh].ikona} ${t.nastroj.mat === 'med' ? 'měděný' : 'železný'} ${P.VECI[t.nastroj.druh].nazev} (${Math.ceil(t.nastroj.stav)} %)`
         : (ST.PREFERUJE[t.prof] ? `<i>žádný – chce ${P.VECI[ST.PREFERUJE[t.prof]].nazev}</i>` : '–')]]
        .map(([a, b]) => radek(a, b)).join('')) +
      ['jidlo', 'piti', 'spanek'].map(k => {
        const v = Math.round(t[k]), tr = v < 20 ? 'spatne' : v < 40 ? 'varuj' : '';
        return `<div class="pruh ${tr}"><span>${{ jidlo: '🍖 jídlo', piti: '🍺 pití', spanek: '💤 spánek' }[k]}</span><i><b style="width:${v}%"></b></i></div>`;
      }).join('') +
      `<div class="nalada">` + rozbal('nalada', `${smajlik(t.nalada)} nálada ${t.nalada}/100${naladaCil(hra, t)} <small>práce ${Math.round(POT.rychlost(t) * 100)} %${POT.nevrly(t) ? ` · <span class="spatne">nevrlý (pod ${POT.NEVRLY} o 15 % pomaleji)</span>` : ''}</small>`,
        `<div class="duvod"><span>základ</span><span>${POT.ZAKLAD}</span></div>` + POT.rozpis(hra, t).sort((a, b) => a[1] - b[1]).map(([txt, h]) => `<div class="duvod ${h < 0 ? 'minus' : 'plus'}"><span>${txt}</span><span>${h > 0 ? '+' : ''}${h}</span></div>`).join('')) +
      '</div>' + pracePanel(hra, t) +
      (st.sledovat ? '<p class="tip" style="margin-top:4px">🎥 Pohled ho sleduje – posunem pohledu sledování skončí.</p>' : '');
  }
  // pět hvězd (prázdné šedě) – i nula je vidět jako prázdné hvězdy
  const hvezdy = n => { n = Math.max(0, Math.min(5, n)); return `<span class="hvezdy" aria-hidden="true">${'★'.repeat(n)}<span class="prazdne">${'★'.repeat(5 - n)}</span></span>`; };
  // nálada se po chvilkách přepočítá na součet důvodů – kam míří, když se liší od současné
  const naladaCil = (hra, t) => { const c = POT.spocitejNaladu(hra, t); return c !== t.nalada ? ` <span class="nalada-cil" title="Nálada se postupně srovná se součtem důvodů">→ míří k ${c}</span>` : ''; };
  // práce v detailu trpaslíka: stejné přepínače stupňů jako v kartě klanu + souhrn podle stupňů a pracoviště
  function pracePanel(hra, t) {
    const podle = [1, 2, 3, 0].map(s => [s, PRACE.filter(([k]) => (t.povoleno[k] || 0) === s)]).filter(([, a]) => a.length);
    return `<div class="blok prace-detail"><h4>Práce</h4>` + hlavickaPraci() + `<div class="prace-radek">` + PRACE.map(([k, ik]) => prepinac(k, ik, t.povoleno[k] || 0, `data-id="${t.id}"`, '')).join('') +
      `</div><div class="prace-souhrn">` + podle.map(([s, a]) => `<span class="stupen-stitek${s ? ' s' + s : ' s0'}">${s ? ['', '1 hlavní', '2 běžná', '3 když nic jiného'][s] : 'vypnuto'}</span>` +
        `<span>${a.map(([k, ik]) => ik + ' ' + PRACE_NAZEV[k].split(' (')[0]).join(', ')}</span>`).join('') + '</div>' +
      volbaPracoviste(hra, t, [...new Set(hra.dilny.map(d => d.typ))]) + '</div>';
  }
  // přepínač stupně práce: odznak 1/2/3 (zlatý, stříbrný, bronzový), vypnuto přeškrtnuté; aria-label „kopání: stupeň 2"
  const ZKRATKY = { kopat: 'kop', kacet: 'kác', stavet: 'stav', nosit: 'nos', pole: 'pole', remeslo: 'řem', hlidat: 'stráž' };
  function prepinac(k, ik, s, attrs, kdo, trida, title) {
    const nazev = PRACE_NAZEV[k].split(' (')[0];
    return `<button class="prepinac${s ? ' zap s' + s : ' vyp'}${trida || ''}" ${attrs} data-k="${k}" aria-label="${kdo ? kdo + ' – ' : ''}${nazev}: ${s ? 'stupeň ' + s : 'vypnuto'}" ` +
      `title="${title || `${kdo ? kdo + ': ' : ''}${PRACE_NAZEV[k]} – ${STUPNE[s]}. Klik = další stupeň, pravý klik = předchozí`}"><span class="ik">${ik}</span><small class="stupen">${s || ''}</small></button>`;
  }
  const hlavickaPraci = () => `<div class="prace-hlavicka" aria-hidden="true">${PRACE.map(([k]) => `<span>${ZKRATKY[k]}</span>`).join('')}</div>`;
  // sbalitelný oddíl detailu; rozbalení přežije překreslení panelu
  const rozbal = (klic, nadpis, obsah) => `<details class="rozbal" data-pamet="${klic}"${st.rozbaleno[klic] ? ' open' : ''}><summary>${nadpis}</summary>${obsah}</details>`;
  // „odpočívá" s důvodem, když se dá levně odvodit (popisCinnosti je v hra.js)
  function cinnost(hra, t) {
    const s = HRA.popisCinnosti(hra, t);
    return s === 'odpočívá' ? 'odpočívá – ' + procNepracuje(hra, t) : s;
  }
  function dostupnaPrace(hra) {                    // kolik práce jakého druhu vůbec existuje (jednou za tah)
    if (st.dp && st.dp.tik === hra.tik && st.dp.hra === hra) return st.dp;
    const d = { tik: hra.tik, hra, kopat: 0, kacet: 0, stavet: hra.plany.length, nosit: 0, pole: 0, remeslo: 0, hlidat: (hra.tvorove || []).length };
    for (let i = 0; i < hra.oznac.length; i++) { const o = hra.oznac[i]; if (!o) continue; if (o === P.OZN.KACET) d.kacet++; else if (o === P.OZN.TESAT) d.stavet++; else d.kopat++; }
    for (const x of hra.dilny) if (x.fronta.length) d.remeslo++;
    for (const z of hra.zony) if (ST.FARMY[z.typ]) d.pole++;
    for (const v of hra.veci) if (!v.nese && !ST.jeSklad(hra, v.i)) { d.nosit++; break; }
    if (hra.dilny.some(x => x.typ === 'zbrojnice')) d.hlidat++;
    return (st.dp = d);
  }
  function procNepracuje(hra, t) {
    const zap = PRACE.filter(([k]) => t.povoleno[k]).map(([k]) => k), d = dostupnaPrace(hra);
    if (!zap.length) return 'nemá zapnutou žádnou práci (stupně v Klanu)';
    if (t.dilna && !hra.dilny.some(x => x.typ === t.dilna && x.fronta.length)) return hra.dilny.some(x => x.typ === t.dilna) ? 'jeho dílna nemá zakázku' : 'jeho dílna ještě nestojí';
    if (!PRACE.some(([k]) => d[k])) return 'nemá práci – označ kopání (K) nebo naplánuj stavbu (B)';
    if (!zap.some(k => d[k])) return 'nemá práci – pro jeho zapnuté práce nic není, zapni stupně';
    return 'práce je rozebraná nebo mimo jeho dosah';
  }
  const smajlik = n => n >= 70 ? '😀' : n >= 50 ? '🙂' : n >= 35 ? '😐' : n >= 20 ? '🙁' : '😠';
  // svislý „teploměr" 0–100 (po 5 %, ať se seznam zbytečně nepřekresluje); barva zelená → žlutá → červená
  function teplomer(nazev, hodnota, pozn) {
    const v = Math.max(0, Math.min(100, Math.round(hodnota / 5) * 5));
    const tr = v >= 60 ? 'dobre' : v >= 30 ? 'stredne' : 'spatne';
    const popis = `${nazev} ${Math.round(hodnota)} %${pozn ? ' ' + pozn : ''}`;
    return `<span class="teplomer ${tr}" role="img" aria-label="${popis}" title="${popis}"><b style="height:${v}%"></b></span>`;
  }
  const portrety = new Map();
  function portret(t) {
    const cep = G.barvaCepice(t), k = t.prof + t.vous + cep;       // čepice v barvě hlavní práce
    if (!portrety.has(k)) {
      const c = document.createElement('canvas'); c.width = c.height = 32;
      const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
      x.imageSmoothingEnabled = false;
      x.drawImage(G.portretTrpaslika(HRA.PROFESE[t.prof].barva, t.vous, t.prof, cep), 0, 0, 32, 32);   // vlastní portrét 32 × 32
      portrety.set(k, c.toDataURL());
    }
    return portrety.get(k);
  }
  // dílna, plán nebo zóna na vybraném poli
  // filtr skladu: skupiny (zapnout/vypnout celé) a jednotlivé druhy s počtem kusů v tomto skladu
  function filtrSkladu(hra, zo) {
    const prij = ST.prijimaneDruhy(zo), bunky = ST.bunkyZony(hra, zo.id), mista = new Set(bunky);
    const tady = {}; let kusu = 0;
    for (const v of hra.veci) if (!v.nese && mista.has(v.i)) { tady[v.druh] = (tady[v.druh] || 0) + 1; kusu++; }
    const skupiny = Object.entries(ST.SKUPINY).filter(([k]) => k !== 'vse').map(([k, g]) => {
      const zap = g.druhy.filter(d => prij.has(d)).length, stav = zap === g.druhy.length ? 'vse' : zap ? 'cast' : 'nic';
      return `<div class="filtr-skupina"><button class="filtr-sk ${stav}" data-akce="filtr-sk" data-zona="${zo.id}" data-sk="${k}" title="${stav === 'vse' ? 'Nepřijímat' : 'Přijímat'} celou skupinu">` +
        `<span class="zaskrt">${stav === 'vse' ? '✔' : stav === 'cast' ? '–' : ''}</span>${g.ikona} ${g.nazev}</button><div class="filtr-druhy">` +
        g.druhy.map(d => `<button class="filtr-druh${prij.has(d) ? ' zap' : ''}" data-akce="filtr-druh" data-zona="${zo.id}" data-d="${d}" ` +
          `title="${P.VECI[d].nazev} – ${prij.has(d) ? 'přijímá' : 'nepřijímá'}${tady[d] ? `, leží tu ${tady[d]}` : ''}">${P.VECI[d].ikona}${tady[d] ? `<small>${tady[d]}</small>` : ''}</button>`).join('') +
        `</div></div>`;
    }).join('');
    const vse = prij.size === ST.DRUHY_SKLADU.length;
    return `<div class="filtr-sklad"><div class="filtr-hlava"><b>Přijímá:</b> ${vse ? 'vše' : prij.size ? `${prij.size} druhů` : '<span class="spatne">nic</span>'}` +
      `<button class="mini" data-akce="filtr-vse" data-zona="${zo.id}">vše</button><button class="mini" data-akce="filtr-nic" data-zona="${zo.id}">nic</button>` +
      `<button class="mini${zo.prio ? ' zap' : ''}" data-akce="sklad-prio" data-zona="${zo.id}" title="Přednostní sklad: nové věci se nosí nejdřív sem, i když je jiný sklad blíž">⭐ přednostní</button></div>` +
      `<p class="tip">Leží tu ${mn(kusu, 'věc', 'věci', 'věcí')} na ${bunky.length} ${bunky.length === 1 ? 'poli' : 'polích'}` +
        (kusu > bunky.length * ST.MAX_NA_POLI ? ` – <span class="spatne">přeplněno</span> (pohodlně ${bunky.length * ST.MAX_NA_POLI}, zvětši sklad)` : ` (pohodlně se vejde ${bunky.length * ST.MAX_NA_POLI})`) +
        `. Věci, které sklad nepřijímá, trpaslíci odnesou jinam.</p>` +
      skupiny + '</div>';
  }
  // kvalita jídelny / ložnice: co přidá k náladě (hodnoty jako hra.js hodnotaJidelny / hodnotaLoznice) a co ji zlepší
  function kvalitaMistnosti(hra, zo) {
    const k = ST.kvalitaZony(hra, zo.id), zdi = Math.round(k.podilZdi * 100), jid = zo.typ === 'jidelna';
    const bonus = jid ? 4 + (k.kamen ? 2 : 0) + Math.min(4, 2 * k.sochy) + (zdi >= 60 ? 2 : 0) : 5 + (zdi >= 60 ? 2 : 0) + (k.sochy ? 2 : 0);
    const rady = [];
    if (zdi < 60) rady.push(`🧱 otesej stěny (${zdi} %, od 60 % +2)`);
    if (jid ? k.sochy < 2 : !k.sochy) rady.push(`🗿 socha z kamenictví (+2${jid ? ', nejvýš 2' : ''})`);
    if (jid && !k.kamen) rady.push('kamenný stůl nebo židle z kamenictví (+2)');
    return `<div class="kvalita">${radek('Kvalita', `<b>+${bonus}</b> k náladě ${jid ? 'při jídle' : 'po spánku'}`)}` +
      radek('Otesané stěny', `${zdi} %`) + radek('Sochy', k.sochy) + (jid ? radek('Kamenný nábytek', `${k.kamen} z ${k.nabytek}`) : '') +
      (rady.length ? `<p class="tip">Zlepší ji: ${rady.join(' · ')}.</p>` : '<p class="tip">✅ Nádherná síň – víc už nejde.</p>') + '</div>';
  }
  // farma: stav políček a cílová zásoba (nad ní se nesklízí ani neseje)
  function farmaDetail(hra, zo) {
    const c = ST.cilFarmy(hra, zo), V = P.VECI[c.plodina], ma = HRA.zasobaPlodin(hra)[c.plodina] || 0;
    let h = '';
    if (zo.typ === 'les') {                          // lesní školka: stromky (pařez s sazenicí), jedle, prázdno
      let prazdne = 0, stromky = 0, jedle = 0;
      for (let k = 0; k < hra.zona.length; k++) if (hra.zona[k] === zo.id) {
        const o = hra.hora.obj[k];
        if (o === HORA.O.STROM) jedle++; else if (o === HORA.O.PAREZ) stromky++; else prazdne++;
      }
      h += radek('Políčka', `volná ${prazdne} · stromky a pařezy ${stromky} · vzrostlé jedle ${jedle}`);
    } else {
      let zas = 0, roste = 0, zrale = 0, prazdne = 0;
      for (let k = 0; k < hra.zona.length; k++) if (hra.zona[k] === zo.id) { const u = hra.uroda[k]; if (!u) prazdne++; else if (u === 101) zrale++; else if (u > 40) roste++; else zas++; }
      h += radek('Políčka', `prázdná ${prazdne} · zasetá ${zas} · rostoucí ${roste} · zralá ${zrale}`);
    }
    const sklizi = HRA.farmaSklizi(hra, zo);
    h += `<div class="cil-farmy"><span>Udržuj zásobu ${V.ikona}: <b>${c.cil}</b>${c.auto ? ' <small>(auto)</small>' : ''}</span>` +
      `<button class="mini" data-akce="cil-farmy" data-zona="${zo.id}" data-o="-5" title="O 5 méně (0 = nesklízet)">−</button>` +
      `<button class="mini" data-akce="cil-farmy" data-zona="${zo.id}" data-o="5" title="O 5 víc">+</button>` +
      `<button class="mini${c.auto ? ' zap' : ''}" data-akce="cil-farmy" data-zona="${zo.id}" data-o="auto" title="Automaticky podle velikosti klanu">auto</button></div>` +
      `<p class="tip">V hoře je ${ma} × ${V.nazev} – ${sklizi ? 'farma pracuje' : '<b>zásoba je plná, farma čeká</b>'}. Nad cílem nikdo nesklízí ani neseje${zo.typ === 'les' ? ' (nekácí)' : ' a zralá úroda počká na poli'}` +
      (zo.typ === 'pole' ? '; na podzim se pole sklidí vždy (mráz by úrodu spálil).' : '.') + '</p>';
    return h;
  }
  function popisStavby(p) {
    if (!p || p.x < 0 || p.y < 0 || p.x >= W || p.y >= H) return '';
    const hra = st.hra, i = p.y * W + p.x, z = P.zasoby(hra);
    let h = '';
    const d = ST.dilnaNa(hra, i);
    if (d) {
      const D = ST.STAVBY[d.typ];
      // kdo tu smí pracovat: jen s řemeslem; když nikdo, skutečný důvod
      const sRem = hra.trpaslici.filter(t => t.povoleno.remeslo);
      const kdo = sRem.filter(t => HRA.smiVDilne(hra, t, d)).map(t => t.jmeno + (t.dilna === d.typ ? ' 🎯' : '')).join(', ') ||
        `<span class="spatne">nikdo – ${!sRem.length ? 'nikdo nemá zapnuté řemeslo ⚒️ (Klan)' : sRem.every(t => t.dilna && t.dilna !== d.typ) ? 'všichni s řemeslem mají jiné pracoviště' : 'řemeslník je jinde, ostatní zaskočí, když nestíhá'}</span>`;
      h += `<div class="blok"><h4>${D.ikona} ${D.nazev}</h4><p class="popis">${D.popis}</p><p class="tip">Pracuje: ${kdo}</p>` +
        [d, d.m2].map((mi, k) => mi && mi.vRobe ? (() => {             // dvě pracoviště – dva trpaslíci naráz
          const zk = d.fronta.find(q => q.id === mi.vRobe.zak), rc = zk && ST.RECEPTY[d.typ][zk.r];
          if (!rc) return '';
          const m = ST.materialReceptu(rc), kdo = mi.rez && hra.trpaslici.find(t => t.id === mi.rez);
          return `<p class="tip">Pracoviště ${k + 1}: <b>${rc.nazev || P.VECI[rc.vyrobek].nazev}</b> – materiál ` +
            Object.entries(m).map(([druh, n]) => `${P.VECI[druh].ikona} ${mi.vRobe.doneseno[druh] || 0}/${n}`).join(', ') +
            (kdo ? ` · ${kdo.jmeno} vyrábí` : HRA.dilnaPripravena(d, mi) ? ' ✔ čeká na řemeslníka' : '') + '</p>';
        })() : '').join('') +
        ST.RECEPTY[d.typ].map((rc, r) => {
          // Klíč k Srdci až po 2 ze 3 artefaktů: recept šedě s důvodem, objednat nejde
          const kp = rc.vyrobek === 'art_klic' && PB.klicPodminka(hra), zamek = kp && !kp.ok ? ` disabled title="${kp.chybi}"` : '';
          return `<div class="recept${zamek ? ' zamceny' : ''}"><span>${P.VECI[rc.vyrobek].ikona} ${rc.nazev || P.VECI[rc.vyrobek].nazev}${(rc.pocet || 1) > 1 ? ` <small>×${rc.pocet}</small>` : ''}</span>` +
          `<button class="mini" data-akce="zakazka" data-dilna="${d.id}" data-r="${r}" data-n="1"${zamek || ' title="Vyrobit jednou"'}>+1</button>` +
          `<button class="mini" data-akce="zakazka" data-dilna="${d.id}" data-r="${r}" data-n="5"${zamek || ' title="Vyrobit pětkrát"'}>+5</button>` +
          `<button class="mini" data-akce="udrzuj" data-dilna="${d.id}" data-r="${r}" data-n="5"${zamek || ` title="Vyrábět, dokud nebude na skladě ${((d.fronta.find(q => q.trvala && q.r === r) || {}).cil || 0) + 5} kusů"`}>♾️</button>` +
          // materiál na vlastním řádku: potřeba / ve skladech
          `<small class="recept-mat" title="potřeba na 1 výrobu / máš ve skladech">${Object.entries(ST.materialReceptu(rc)).map(([druh, n]) =>
            `<span class="${(z[druh] || 0) >= n ? '' : 'spatne'}">${P.VECI[druh].ikona} ${n}/${z[druh] || 0}</span>`).join(' · ')}</small>` +
          (zamek ? `<small class="recept-duvod">🔒 ${kp.chybi}</small>` : '') + '</div>';
        }).join('') +
        (d.fronta.length ? '<p class="tip" style="margin-top:4px">Zakázky:</p>' + d.fronta.map(zk => {
          const rc = ST.RECEPTY[d.typ][zk.r];
          const popis = zk.trvala ? `udržuj ${zk.cil} × ${P.VECI[rc.vyrobek].nazev} <small>(je ${hra.veci.filter(v => v.druh === rc.vyrobek).length})</small>` : `${rc.nazev || P.VECI[rc.vyrobek].nazev} × ${zk.zbyva}`;
          return `<div class="recept"><span>${zk.trvala ? '♾️' : '▶'} ${popis}</span>` +
            (zk.trvala ? `<button class="mini" data-akce="udrzuj" data-dilna="${d.id}" data-r="${zk.r}" data-n="-5" title="O 5 méně">−5</button>` : '') +
            `<button class="mini" data-akce="zakazka-nahoru" data-dilna="${d.id}" data-id="${zk.id}" title="Posunout výš – dílna dělá zakázky shora dolů">↑</button>` +
            `<button class="mini" data-akce="zrus-zakazku" data-dilna="${d.id}" data-id="${zk.id}" title="Zrušit zakázku">✖</button></div>`;
        }).join('')
          : '<p class="tip">Žádné zakázky – +1 vyrobí jednou, ♾️ udržuje zásobu.</p>') + '</div>';
    }
    const pid = hra.planNa.get(i);
    if (pid) {
      const pl = ST.planPodle(hra, pid), D = ST.STAVBY[pl.typ];
      h += `<div class="blok"><h4>${D.ikona} plán: ${D.nazev}${pl.prio ? ' ⭐' : ''}</h4><p class="popis">${D.popis}</p>` +
        Object.entries(D.mat).map(([druh, n]) => radek(P.VECI[druh].ikona + ' ' + P.VECI[druh].nazev, `${pl.doneseno[druh]} / ${n}` +
          (pl.doneseno[druh] < n && !(z[druh] || hra.veci.some(v => v.druh === druh)) ? ' <span class="spatne">– chybí!</span>' : ''))).join('') +
        `<p class="tip">${ST.pripraven(pl) ? 'Materiál je na místě, čeká se na stavitele.' : 'Trpaslíci nosí materiál.'}</p>` +
        `<button class="btn${pl.prio ? '' : ' sede'} mini-sirka" data-akce="plan-prio" data-i="${i}" title="Přednost: plán se postaví dřív (o dva stupně výš), materiál se k němu nosí přednostně">${pl.prio ? '⭐ Má přednost – zrušit' : '⭐ Dát přednost'}</button> ` +
        `<button class="btn sede mini-sirka" data-akce="zrus-plan" data-i="${i}">✖ Zrušit plán</button></div>`;
    }
    // ostatní hotové stavby: k čemu jsou a v jakém stavu
    const typS = hra.lez[i] === 2 ? 'zebrik' : hra.lez[i] === 3 ? 'vytah' : (!d && hra.stavba[i] && hra.stavba[i] !== ST.K.MRIZ) ? ST.KOD_TYP[hra.stavba[i]] : null;
    if (typS && ST.STAVBY[typS]) {
      const D = ST.STAVBY[typS];
      let stav = '';
      if (typS === 'pumpa') stav = radek('Voda do 3 polí', T.priroda.vodaUPumpy(hra, i) >= 0 ? '💧 ano – trpaslík s nošením (📦) ji odčerpá' : 'ne – pumpa stojí');
      if (typS === 'past') stav = radek('Stav', hra.stavbaStav[i] ? '⏳ spuštěná, brzy se napne' : '✅ napnutá');
      if (typS === 'dvere' && hra.stavbaStav[i]) stav = radek('Poškození od nepřátel', `${hra.stavbaStav[i]} / 8`);
      h += `<div class="blok"><h4>${D.ikona} ${D.nazev}</h4><p class="popis">${D.popis}</p>${stav}</div>`;
    } else if (hra.lez[i] === 1) {
      h += `<div class="blok"><h4>⛰️ schodiště</h4><p class="popis">Vytesané do skály – cesta nahoru i dolů. Tesá se nástrojem ⛰️ schody.</p></div>`;
    }
    if (hra.stavba[i] === ST.K.MRIZ) {
      const z = hra.zavreno[i];
      h += `<div class="blok"><h4>🚧 padací mříž – ${z ? '<b class="spatne">zavřená</b>' : 'otevřená'}</h4><p class="tip">Zavřená nepustí nikoho, ani trpaslíky.</p>` +
        `<button class="btn${z ? '' : ' sede'} mini-sirka" data-akce="mriz" data-i="${i}">${z ? '⬆️ Otevřít mříž' : '⬇️ Spustit mříž'}</button></div>`;
    }
    const tv = (hra.tvorove || []).filter(u => u.i === i);
    for (const u of tv) {
      const D = T.hrozby.DRUHY[u.druh] || { nazev: u.druh, zdravi: 1 };
      h += `<div class="blok"><h4>👹 ${D.nazev}</h4>${radek('Zdraví', `${Math.max(0, Math.round(u.zdravi))} / ${D.zdravi}`)}` +
        (D.utok ? radek('Útok', `⚔️ ${D.utok}${D.dosah ? ` · střílí na ${D.dosah} pole` : ''}`) : '') +
        (D.dvere && D.dvere < 8 ? radek('Dveře', `vyrazí na ${D.dvere} rány`) : '') + '</div>';
    }
    const zo = ST.zonaNa(hra, i);
    if (zo) {
      const Z = ST.ZONY[zo.typ], vyb = ST.vybaveni(hra, zo.id);
      h += `<div class="blok"><h4>${Z.ikona} ${Z.nazev} <small>(${mn(vyb.polí, 'pole', 'pole', 'polí')})</small></h4><p class="tip">${Z.popis}</p>`;
      if (zo.typ === 'sklad') h += filtrSkladu(hra, zo);
      if (zo.typ === 'loznice' || zo.typ === 'osetrovna') h += radek('Postele', vyb.postel + (vyb.postel ? '' : ' <span class="spatne">– postav postel</span>'));
      if (zo.typ === 'osetrovna') {
        const lecí = hra.trpaslici.filter(t => hra.zona[t.i] === zo.id && POT.zraneny(t)).length;
        h += radek('Zranění', `${hra.trpaslici.filter(t => POT.zraneny(t)).length} v klanu` + (lecí ? ` · ${lecí} se tu léčí` : '')) +
          '<p class="tip">Zraněný (zdraví pod 60) si sem jde lehnout a hojí se 3× rychleji. Postele objednáš v tesařské dílně.</p>';
      }
      if (zo.typ === 'jidelna') h += radek('Stoly / židle', `${vyb.stul} / ${vyb.zidle}` + (vyb.stul ? '' : ' <span class="spatne">– chybí stůl</span>'));
      if (zo.typ === 'loznice' || zo.typ === 'jidelna') h += kvalitaMistnosti(hra, zo);
      else if (vyb.socha) h += radek('Sochy', vyb.socha);
      if (ST.FARMY[zo.typ]) h += farmaDetail(hra, zo);
      h += `<button class="btn sede mini-sirka" data-akce="zrus-zonu" data-zona="${zo.id}">✖ Zrušit zónu</button></div>`;
    }
    return h;
  }
  // nadpis záložky Výběr podle toho, co na poli je
  function nadpisVyberu(p) {
    if (!p || p.x < 0 || p.y < 0 || p.x >= W || p.y >= H) return '🔍 Pole';
    const hra = st.hra, i = p.y * W + p.x;
    if (ST.dilnaNa(hra, i)) return '⚒️ Dílna';
    if (hra.planNa.get(i)) return '📐 Plán stavby';
    const tvor = (hra.tvorove || []).find(u => u.i === i);
    if (tvor) { const n = (T.hrozby.DRUHY[tvor.druh] || {}).nazev || 'nepřítel'; return '👹 ' + n[0].toUpperCase() + n.slice(1); }
    if (hra.stavba[i] || hra.lez[i]) return '🔨 Stavba';
    const zo = ST.zonaNa(hra, i);
    if (zo) return `${ST.ZONY[zo.typ].ikona} ${ST.ZONY[zo.typ].nazev}`;
    return '🔍 Pole';
  }
  function ukazVyber() {
    const t = st.vybrany && st.hra.trpaslici.find(t => t.id === st.vybrany);
    if (st.vybrany && !t) { st.vybrany = 0; st.sledovat = false; }
    // nový výběr na mapě nebo v „Pozor" → otevřít záložku Výběr; výběr ze seznamu klanu záložku nemění
    const klic = t ? 't' + t.id : st.vyber ? st.vyber.x + ',' + st.vyber.y : '';
    if (klic !== st.vyberKlic) {
      const byl = st.vyberKlic, tichy = st.tichyVyber; st.vyberKlic = klic; st.tichyVyber = false;
      if (klic && byl !== undefined && !tichy && st.zalozka !== 'vyber') { zalozka('vyber'); return; }
    }
    const nadpis = t ? '🧔 Trpaslík' : nadpisVyberu(st.vyber);
    if ($('vyberNadpis').dataset.h !== nadpis) { $('vyberNadpis').textContent = nadpis; $('vyberNadpis').dataset.h = nadpis; }
    const html = t ? popisTrpaslika(t) : popisStavby(st.vyber) + popisPole(st.vyber);
    const el = $('info');
    const vybira = document.activeElement && document.activeElement.closest && document.activeElement.closest('#info select');   // rozbalenou volbu nepřekreslit
    if (el.dataset.h !== html && !vybira) { el.innerHTML = html; el.dataset.h = html; }
  }
  let posledniDenik = -1, posledniKlan = '';
  // stupně práce: 0 vypnuto, 1 hlavní, 2 běžná, 3 když není co jiného; klik cyklí 1 → 2 → 3 → vyp
  const STUPNE = ['vypnuto', 'stupeň 1 – hlavní práce', 'stupeň 2 – běžná práce', 'stupeň 3 – jen když není co jiného'];
  const dalsiStupen = (s, zpet) => zpet ? (s + 3) % 4 : (s + 1) % 4;
  function vetsinovyStupen(hra, k) {
    const n = [0, 0, 0, 0]; for (const t of hra.trpaslici) n[t.povoleno[k] || 0]++;
    return n.indexOf(Math.max(...n));
  }
  function nastavStupen(hra, t, k, s) {
    t.povoleno[k] = s; t.urovenBlok = null; t.hledej = 0;
    if (!s && t.prace) HRA.pustPraci(hra, t);
  }
  // volba „pracoviště": trpaslík pracuje jen v jednom typu dílny (sládek jen v pivovaru…)
  function volbaPracoviste(hra, t, typy) {
    const moje = ST.PROFESE_DILNY ? Object.keys(ST.PROFESE_DILNY).filter(k => ST.PROFESE_DILNY[k] === t.prof) : [];
    const typySeznam = [...new Set([...(t.dilna ? [t.dilna] : []), ...typy])];
    if (!typySeznam.length) return '';                  // dokud nestojí žádná dílna, není co vybírat
    const opt = typySeznam.map(k => `<option value="${k}"${t.dilna === k ? ' selected' : ''}>${ST.STAVBY[k].ikona} jen ${ST.STAVBY[k].nazev}${moje.includes(k) ? ' (jeho řemeslo)' : ''}</option>`).join('');
    return `<label class="pracoviste${t.dilna ? ' prirazen' : ''}" title="Přiřadit trpaslíka k jedné dílně – bude pracovat jen v ní a dílnu budou obsluhovat jen přiřazení">` +
      `<select data-id="${t.id}" aria-label="Pracoviště: ${t.jmeno}"><option value="">🎯 všechny dílny</option>${opt}</select></label>` +
      (t.dilna ? '<small class="pracoviste-pozn">ostatní práce vypnuty – po zrušení se vrátí</small>' : '');
  }
  const ZAKLADNI_ZASOBY = [['jidloChip', 'jidlo'], ['pivoChip', 'pivo'], ['drevoChip', 'drevo'], ['kamenChip', 'kamen'], ['uhliChip', 'uhli'], ['prutChip', 'prut_zelezo']];
  const DULEZITE = new Set(['smrt', 'objev', 'nalez', 'uvizl', 'pribeh', 'zraneni', 'boj', 'varovani', 'obchod']);
  // typy zpráv: ikona (když text žádnou nemá) a zvuk oznámení; null = záměrně ticho (zvuk dává logika, nebo není důležitá)
  // každý zvuk má oznámení – hráč vždy vidí, co zaznělo (smrt a objev zvučí z logiky, nájezd rohem, příjezd karavany zvonkem)
  const ZPRAVY = {
    smrt: { ikona: '🪦', zvuk: null }, objev: { ikona: '✨', zvuk: null }, nalez: { ikona: '💎', zvuk: null },
    pribeh: { ikona: '📜', zvuk: null }, zraneni: { ikona: '🩹', zvuk: 'zasah' }, uvizl: { ikona: '🆘', zvuk: 'varovani' },
    boj: { ikona: '⚔️', zvuk: 'boj' }, varovani: { ikona: '⚠️', zvuk: 'varovani' }, obchod: { ikona: '🐫', zvuk: 'zvonek' },
    obdobi: { ikona: '🍂', zvuk: null }, udalost: { ikona: '📜', zvuk: null }, stavba: { ikona: '🔨', zvuk: null },
  };
  const OBDOBI_IKONA = [[/^Jaro/, '🌸'], [/^Léto/, '☀️'], [/^Podzim/, '🍂'], [/zima/i, '❄️']];
  const S_IKONOU = /^(?:\p{Extended_Pictographic}|\p{Regional_Indicator})/u;
  function textZpravy(zp) {                       // ikona typu před text, pokud ho žádná nezačíná
    if (S_IKONOU.test(zp.text)) return zp.text;
    const ik = zp.typ === 'obdobi' ? (OBDOBI_IKONA.find(([re]) => re.test(zp.text)) || [, '🍂'])[1] : (ZPRAVY[zp.typ] || {}).ikona;
    return ik ? ik + ' ' + zp.text : zp.text;
  }
  // varovný dvojtón (zvuk.js ho nemá) – přidá se k ostatním zvukům, hraje se přes Z.hraj
  if (Z && Z.ZVUKY && !Z.ZVUKY.varovani) Z.ZVUKY.varovani = (c, cil, t0, s) => {
    for (const [f, d] of [[740, 0], [554, 0.16]]) {
      const o = c.createOscillator(), g = c.createGain(); o.type = 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + d); g.gain.exponentialRampToValueAtTime(0.25 * s, t0 + d + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.28);
      o.connect(g); g.connect(cil); o.start(t0 + d); o.stop(t0 + d + 0.32);
    }
  };
  let globalniZvuk = -1e9;                        // kdy naposled zazněl globální zvuk z logiky (roh, zvonek, objev…)
  function zvukZpravy(zp) {
    if (performance.now() - globalniZvuk < 1000) return;      // logika už k tomu zahrála (roh k nájezdu, zvonek ke karavaně)
    const z = zp.typ === 'boj' && /SPÁČ/.test(zp.text) ? 'rev' : (ZPRAVY[zp.typ] || {}).zvuk;
    if (z) Z.hraj(z, 0.7, 0, 1);
  }
  function oznameni(zp) {
    const box = $('oznameni'), el = document.createElement('div');
    el.className = 'ozn dz-' + zp.typ;
    const text = textZpravy(zp);
    el.textContent = (text.length > 180 ? text.slice(0, 177) + '…' : text) + (zp.i >= 0 ? ' 📍' : '');
    // zpráva s místem (📍): klik posune pohled tam, kde se to stalo; bez místa otevře deník
    el.title = zp.i >= 0 ? 'Klikni – ukázat místo' : 'Klikni – otevře deník';
    el.tabIndex = 0; el.setAttribute('role', 'button');
    el.onclick = () => { if (zp.i >= 0) ukazMisto(zp.i); else zalozka('denik'); el.remove(); };
    el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.onclick(); } };
    box.append(el);
    while (box.children.length > 3) box.firstElementChild.remove();
    const doba = zp.typ === 'pribeh' ? 12000 : 7000;
    setTimeout(() => { el.classList.add('pryc'); setTimeout(() => el.remove(), 450); }, doba);
  }
  const KLIC_ZALOZKA = 'webapp_hra_trpaslici_zalozka';
  // záložky panelu (pamatuje si poslední v prohlížeči)
  function zalozka(co) {
    st.zalozka = co;
    for (const b of document.querySelectorAll('.zalozky button')) { b.setAttribute('aria-selected', b.dataset.zal === co); b.tabIndex = b.dataset.zal === co ? 0 : -1; }
    for (const d of document.querySelectorAll('.zalozka')) d.hidden = d.dataset.zal !== co;
    if (st.zalozkaPosl !== co) { st.zalozkaPosl = co; $('panel').scrollTop = 0; }   // nová záložka od začátku
    uloziste.pis(KLIC_ZALOZKA, co);
    if (st.hra) obnovPanel(true);
  }
  const PRACE = [['kopat', '⛏️'], ['kacet', '🪓'], ['stavet', '🔨'], ['nosit', '📦'], ['pole', '🌾'], ['remeslo', '⚒️'], ['hlidat', '⚔️']];
  // výbava trpaslíka: nástroj, válečná zbraň, zbroj (ikony v kartě, text s přepínačem „zobrazit výbavu")
  const matNazev = (m, druh) => m === 'med' ? (druh === 'zbroj' ? 'měděná' : 'měděný') : m === 'zelezo' ? (druh === 'zbroj' ? 'železná' : 'železný') : '';
  function vybava(t) {
    const r = [];
    if (t.nastroj) r.push({ ik: P.VECI[t.nastroj.druh].ikona, text: `${matNazev(t.nastroj.mat)} ${P.VECI[t.nastroj.druh].nazev} (${Math.ceil(t.nastroj.stav)} %)`.trim() });
    if (t.zbran) r.push({ ik: '🗡️', text: 'válečná sekera', zbran: true });
    if (t.zbroj) r.push({ ik: '🛡️', text: `${matNazev(t.zbroj.mat, 'zbroj')} zbroj`.trim() });
    return r;
  }
  const vybavaIkony = t => { const v = vybava(t); return v.length ? `<span class="vybava" title="Výbava: ${v.map(x => x.text).join(', ')}">${v.map(x => x.ik).join('')}</span>` : ''; };
  const vybavaText = t => { const v = vybava(t); return v.length ? v.map(x => `${x.ik} ${x.text}`).join(' · ') : '<i>bez výbavy</i>'; };
  // filtr klanu: podle práce (zapnutá na nějakém stupni, seřazeno podle stupně), ozbrojení; výbava je přepínač zobrazení
  function filtrujKlan(hra, f) {
    const vse = hra.trpaslici;
    if (!f) return vse;
    if (f === 'ozbrojeni') return vse.filter(t => t.zbran || t.zbroj);
    return vse.filter(t => t.povoleno[f]).sort((a, b) => a.povoleno[f] - b.povoleno[f]);
  }
  function filtrKlanuHtml(hra, f, n) {
    // filtr s nulovým počtem zešedne (a nejde zvolit), dokud není právě zvolený
    const b = (k, ik, txt, pocet, title) => `<button class="mini${f === k ? ' zap' : ''}${pocet || f === k ? '' : ' nula'}" data-filtr="${k}" aria-pressed="${f === k}" title="${title}"${pocet || f === k ? '' : ' disabled'}>${ik} ${txt} <small>${pocet}</small></button>`;
    return b('', '👥', 'všichni', hra.trpaslici.length, 'Zobrazit celý klan') +
      PRACE.map(([k, ik]) => b(k, ik, ZKRATKY[k], hra.trpaslici.filter(t => t.povoleno[k]).length, `Jen ti, kdo mají zapnuté ${PRACE_NAZEV[k]} (seřazeno podle stupně)`)).join('') +
      b('ozbrojeni', '🗡️', 'ozbrojení', hra.trpaslici.filter(t => t.zbran || t.zbroj).length, 'Jen trpaslíci se zbraní nebo zbrojí') +
      `<button class="mini prepni-vybavu${st.ukazVybavu ? ' zap' : ''}" data-vybava="1" aria-pressed="${!!st.ukazVybavu}" title="Vypsat u každého jeho výbavu (nástroj, zbraň, zbroj) – mění jen zobrazení, ne filtr">🧰 zobrazit výbavu</button>` +
      (f ? ` <small class="tip">zobrazeno ${n} z ${hra.trpaslici.length}</small>` : '');
  }
  // legenda barev čepic přímo z grafiky (nošení se do hlavní práce nepočítá, proto v ní není)
  function legendaCepic() {
    const pol = Object.entries(G.BARVY_PRACE).filter(([k]) => k !== 'nosit').map(([k, c]) => [c, PRACE_NAZEV[k].split(' (')[0]]).concat([['#8e8e8e', 'všestranný']]);
    return pol.map(([c, txt]) => `<span class="cep"><i style="background:${c}"></i>${txt}</span>`).join(' ');
  }
  const PRACE_NAZEV = { kopat: 'kopání', kacet: 'kácení', stavet: 'stavění', nosit: 'nošení', pole: 'polní práce', remeslo: 'řemeslo v dílně', hlidat: 'stráž (lov nepřátel, výcvik)' };
  // „Pozor": seznam z logiky bez dvojích zpráv o hladu (jedna s konkrétní radou), nouze vždy vidět, mírné se ořežou první
  const dnyTxt = x => x === Infinity ? 'dlouho' : mn(Math.max(0, Math.round(x)), 'den', 'dny', 'dní');
  // jedno číslo „na kolik dní jídlo vystačí" pro Přehled, Pozor i Sklad: porce (jídlo i suroviny) proti denní bilanci
  const dniJidla = zp => zp.verdikt === 'hlad' ? zp.dojdeZaDni : zp.sazba < 0 ? zp.porce / -zp.sazba : Infinity;
  function radaJidlo(hra, zp) {
    if (!hra.dilny.some(d => d.typ === 'kuchyne')) return 'Postav kuchyni (🔨 stavět) – z houby uvaří 1 jídlo, z ječmene 2';
    if (!hra.zony.some(z => z.typ === 'houbarna' || z.typ === 'pole')) return 'Založ houbárnu nebo pole (🗺️ zóny)';
    if (!hra.zony.some(z => z.typ === 'houbarna') && (zp.vZime || zp.dnyDoZimy < 8)) return 'Založ houbárnu – roste i v zimě';
    return 'Rozšiř houbárnu nebo pole, případně nakup jídlo od karavany';
  }
  // „Pozor": seřazený seznam z logiky (váha); jídlo jednou s konkrétní radou místo 🍖/❄️/nouze hladu, plus obrana proti Spáči
  function pozorSeznam(hra) {
    const n = hra.trpaslici.length; if (!n) return [];
    const zp = HRA.predpovedZimy(hra), dni = dniJidla(zp), nz = hra.nouze || {}, jidlo = P.zasoby(hra).jidlo || 0;
    const nouzeHlad = HRA.textNouze(hra, 'hlad');
    const out = HRA.upozorneni(hra).filter(u => u.ikona !== '❄️' && u.ikona !== '🍖' && !(u.ikona === '🚨' && u.text.includes(nouzeHlad)))
      .map(u => Object.assign({}, u, { text: u.text.replace(/,? viz Přehled$/, '') }));
    const hladovi = hra.trpaslici.filter(t => t.jidlo < 25).length;
    if (nz.hlad || jidlo < 2 * n || (zp.verdikt === 'hlad' && dni < 15 && HRA.den(hra) > 2)) {
      const kuch = hra.dilny.find(d => d.typ === 'kuchyne');
      out.push({ ikona: nz.hlad ? '🚨' : '🍖', i: kuch ? kuch.i : undefined, hlad: true, vaha: nz.hlad ? 21 : 25,
        text: `${nz.hlad ? 'Hlad – ' : ''}jídlo vydrží ~${dnyTxt(dni)} (${mn(jidlo, 'jídlo', 'jídla', 'jídel')} pro ${n}${hladovi ? `, ${hladovi} hladových` : ''}). ${radaJidlo(hra, zp)}.` });
    }
    // nájezd ohlášený den předem (hrozby.js varujNajezd: tik = dalsiNajezd − den) – do jeho příchodu v Pozor
    const doNajezdu = hra.dalsiNajezd - hra.tik;
    if (doNajezdu > 0 && doNajezdu <= HRA.TAHU_ZA_DEN) {
      const sila = T.hrozby.silaNajezdu(hra), tunel = hra.hora.oblasti.find(o => o.typ === 'tunel');
      const zTunelu = tunel && hra.objeveno[tunel.cislo] && (tunel.bunky || []).find(i => hra.hora.teren[i] === M.VZDUCH);
      const br = hra.hora.brana, ozbrojeni = hra.trpaslici.some(t => t.povoleno.hlidat && t.zbran);
      out.push({ ikona: '⚔️', i: zTunelu !== undefined && zTunelu !== false ? zTunelu : br.y * W + br.x, vaha: 9,
        text: `Zítra nájezd (~${mn(sila, 'nepřítel', 'nepřátelé', 'nepřátel')}${zTunelu ? ', z goblinního tunelu' : ', k bráně'}) – ` +
          (hra.poplach ? 'poplach už platí' : 'vyhlas 🔔 poplach') + (ozbrojeni ? '' : ' / ozbroj strážce') });
    }
    // finále na spadnutí (Spáč vzhůru, Klíč hotový, Výheň se zažíhá) a obrana nestačí
    if (PB.kampan(hra) && !hra.spac.porazen && (hra.spac.probuzen || hra.zazehnuti || hra.veci.some(v => v.druh === 'klic'))) {
      const o = T.hrozby.silaObrany(hra);
      if (o.odhad === 'špatný' || o.odhad === 'málo strážců') {
        const sp = (hra.tvorove || []).find(u => u.druh === 'spac'), zb = hra.dilny.find(d => d.typ === 'zbrojnice');
        out.push({ ikona: '🛡️', i: sp ? sp.i : zb ? zb.i : undefined, vaha: 12,
          text: `Obrana proti Spáči: ${o.odhad} (ozbrojených strážců ${o.ozbrojenych}, útok ${o.utok}). ` +
            (o.odhad === 'málo strážců' ? `Na Spáče jdou jen ozbrojení strážci, aspoň ${T.hrozby.SKUPINA_NA_SPACE}.` : 'Vyzbroj a vycvič další strážce.') });
      }
    }
    // bez tesařské dílny nejde postele objednat
    for (const u of out) if (u.ikona === '🛏️' && /tesařské dílně/.test(u.text) && !hra.dilny.some(d => d.typ === 'tesarna')) u.text = u.text.replace(/ – objednej.*$/, ' – postav tesařskou dílnu (🔨 stavět)');
    out.sort((a, b) => (a.vaha || 50) - (b.vaha || 50));
    return [...out.filter(u => !u.mirne), ...out.filter(u => u.mirne)].slice(0, 5);
  }
  function obnovPanel(vse) {
    const hra = st.hra;
    if (HRA.den(hra) !== posledniUlozenyDen) uloz();
    $('den').textContent = HRA.den(hra);
    const h = HRA.hodina(hra);
    $('hodina').textContent = String(Math.floor(h)).padStart(2, '0') + ':' + String(Math.floor(h % 1 * 6) * 10).padStart(2, '0');
    $('lidi').textContent = hra.trpaslici.length;
    const o = OB.OBDOBI[OB.obdobi(hra)];
    textJen($('obdobi'), `${o.ikona} ${o.nazev} ${(OB.denRoku(hra) - 1) % OB.DNI_OBDOBI + 1}/${OB.DNI_OBDOBI}`);
    $('obdobiChip').title = `Rok ${OB.rok(hra)}. Karavana přijíždí 8. den jara a 6. den podzimu.`;
    $('slava').textContent = hra.slava || 0;
    $('btnKaravana').hidden = !hra.karavana;
    const vidni = (hra.tvorove || []).filter(u => st.vseZnamo || hra.znamo[u.i]), nepratel = vidni.length;
    $('btnPoplach').hidden = !nepratel;
    textJen($('btnPoplach'), `⚔️ ${nepratel}`);
    // 🔔 přepínač poplachu: když jsou vidět nepřátelé, je ohlášený nájezd (den předem) nebo už poplach platí
    const najezdBlizko = hra.dalsiNajezd && hra.dalsiNajezd - hra.tik <= HRA.TAHU_ZA_DEN;
    const pz = $('btnPoplachZap');
    pz.hidden = !(nepratel || hra.poplach || najezdBlizko);
    if (pz.getAttribute('aria-pressed') !== String(!!hra.poplach)) {
      pz.setAttribute('aria-pressed', String(!!hra.poplach));
      pz.textContent = hra.poplach ? '🔔 Poplach – odvolat' : '🔔 Poplach';
      pz.title = hra.poplach ? 'Poplach platí: civilisté se schovávají. Klik = odvolat, klan se vrátí k práci'
        : 'Vyhlásit poplach: kdo nestráží, nechá práce a schová se do ložnice, ošetřovny, skladu nebo jídelny dál než 12 polí od nepřátel';
    }
    const pocty = {}; for (const u of vidni) { const n = (T.hrozby.DRUHY[u.druh] || {}).nazev || u.druh; pocty[n] = (pocty[n] || 0) + 1; }
    $('btnPoplach').title = 'Nepřátelé: ' + Object.entries(pocty).map(([n, k]) => `${k}× ${n}`).join(', ') + ' – klik ukáže prvního';
    // zásoby ve skladu
    const z = P.zasoby(hra), n = Math.max(1, hra.trpaslici.length);
    const jidla = (z.jidlo || 0), piv = (z.pivo || 0);
    $('jidloChip').classList.toggle('varovani', jidla < 2 * n);
    $('pivoChip').classList.toggle('varovani', piv < 2 * n);
    // základní zásoby mají v liště pevné místo (i s nulou); ostatní shrne 📦
    for (const [id, druh] of ZAKLADNI_ZASOBY) {
      const el = $(id), v = z[druh] || 0;
      el.querySelector('b').textContent = v; el.classList.toggle('nula', !v);
    }
    const ostatni = Object.keys(P.VECI).filter(k => z[k] && !ZAKLADNI_ZASOBY.some(([, d]) => d === k));
    $('ostatniChip').querySelector('b').textContent = ostatni.reduce((a, k) => a + z[k], 0);
    $('ostatniChip').classList.toggle('nula', !ostatni.length);
    $('ostatniChip').title = ostatni.length ? 'Ostatní ve skladech: ' + ostatni.map(k => `${P.VECI[k].nazev} ${z[k]}`).join(', ') : 'Nic dalšího ve skladech';
    $('prozkoumano').textContent = statistika().toFixed(1).replace('.', ',') + ' %';
    $('nejhloubeji').textContent = hra.nejhloubeji + ' m';
    const typyDilen = [...new Set(hra.dilny.map(d => d.typ))];
    // klan: karta trpaslíka = kdo to je, co dělá, a řádek povolených prací
    if (st.filtrKlanu === 'vybava') st.filtrKlanu = '';
    const f = st.filtrKlanu || '', vyber = filtrujKlan(hra, f);
    const filtrH = filtrKlanuHtml(hra, f, vyber.length);
    if ($('klanFiltr').dataset.h !== filtrH) { $('klanFiltr').dataset.h = filtrH; $('klanFiltr').innerHTML = filtrH; }
    const klan = (vyber.length ? '' : '<p class="tip">Nikdo – zkus jiný filtr.</p>') + vyber.map(t => `<div class="clen-karta${st.vybrany === t.id ? ' vybrany' : ''}"><button class="clen${st.vybrany === t.id ? ' vybrany' : ''}" data-id="${t.id}">` +
      `<img src="${portret(t)}" alt="" width="24" height="24"><span><b>${t.jmeno}</b> <small>${HRA.PROFESE[t.prof].nazev}</small>` +
      (c => `<small class="cinnost" title="${c.replace(/"/g, '&quot;')}">${c}</small>`)(cinnost(hra, t)) + `</span>` +
      `${t.uvizl ? '<i title="uvízl">🆘</i>' : ''}${t.zdravi < 100 ? '<i title="zraněný">🩹</i>' : ''}` +
      vybavaIkony(t) +
      `<span class="teplomery">${teplomer('jídlo', t.jidlo)}${teplomer('pití', t.piti)}${teplomer('nálada', t.nalada, smajlik(t.nalada))}</span>` +
      `</button>` + (st.ukazVybavu ? `<div class="vybava-radek">${vybavaText(t)}</div>` : '') +
      `<div class="prace-radek">` + PRACE.map(([k, ik]) => prepinac(k, ik, t.povoleno[k] || 0, `data-id="${t.id}"`, t.jmeno)).join('') +
      `</div>` + volbaPracoviste(hra, t, typyDilen) +
      (st.vybrany === t.id ? `<button class="detail-odkaz" data-detail="${t.id}" title="Otevřít detail v záložce Výběr">detail →</button>` : '') + `</div>`).join('');
    // seznam se nepřekresluje, dokud má hráč rozbalenou volbu pracoviště
    const vybira = document.activeElement && document.activeElement.closest && document.activeElement.closest('#klan select');
    if ((klan !== posledniKlan || vse) && !vybira) { $('klan').innerHTML = klan; posledniKlan = klan; }
    const vseH = PRACE.map(([k, ik]) => {
      const zap = hra.trpaslici.filter(t => t.povoleno[k]).length, s = vetsinovyStupen(hra, k), stejne = hra.trpaslici.every(t => (t.povoleno[k] || 0) === s);
      return prepinac(k, ik, s, '', 'všem', stejne ? '' : ' cast', `${PRACE_NAZEV[k]}: povoleno ${zap} z ${hra.trpaslici.length}${stejne ? `, všichni ${STUPNE[s]}` : ', různě'}. Klik = všem další stupeň, pravý klik = předchozí`);
    }).join('');
    if ($('praceVse').dataset.h !== vseH) { $('praceVse').dataset.h = vseH; $('praceVse').innerHTML = vseH; }
    if (st.zalozka === 'sklad') vykresliBilanci(hra);
    if ($('prehledZasob').open) {
      const vse_ = {}, nese = {};
      for (const v of hra.veci) { const k = v.nese ? nese : ST.jeSklad(hra, v.i) ? z : vse_; if (k !== z) k[v.druh] = (k[v.druh] || 0) + 1; }
      const vRukou = {}; for (const t of hra.trpaslici) if (t.nastroj) vRukou[t.nastroj.druh] = (vRukou[t.nastroj.druh] || 0) + 1;
      const html = Object.entries(ST.SKUPINY).filter(([k]) => k !== 'vse').map(([k, g]) => {
        const radky = g.druhy.filter(d => z[d] || vse_[d] || nese[d] || vRukou[d]).map(d =>
          `<tr><td>${P.VECI[d].ikona} ${P.VECI[d].nazev}</td><td>${z[d] || 0}</td><td>${(vse_[d] || 0) + (nese[d] || 0)}</td><td>${vRukou[d] || ''}</td></tr>`).join('');
        return radky ? `<tr class="skupina"><th colspan="4">${g.ikona} ${g.nazev}</th></tr>` + radky : '';
      }).join('');
      const t = $('zasobyTab');
      if (t.dataset.h !== html) { t.dataset.h = html; t.querySelector('tbody').innerHTML = html || '<tr><td colspan="4" class="tip">nic</td></tr>'; }
    }
    // příběh předků a artefakty
    const pr = (hra.prectene.length ? hra.prectene.map(k => `<p class="ulomek"><b>📜 ${PB.ULOMKY[k].nadpis}</b><br>${PB.ULOMKY[k].text}</p>`).join('')
      : '<p class="tip">Runové desky předků leží v ruinách hluboko v hoře. Kdo je přečte, pozná cestu k Srdci.</p>') +
      (Object.keys(hra.artefakty).length ? '<div class="chipy">' + Object.keys(hra.artefakty).map(k => `<span class="chip" title="${PB.ARTEFAKTY[k].popis}">${PB.ARTEFAKTY[k].ikona} ${PB.ARTEFAKTY[k].nazev}</span>`).join('') + '</div>' : '') +
      `<p class="tip">${hra.rezim === 'volny' ? 'Volný režim – Spáč spí a hra nekončí.' : hra.vyhenHori ? '🔥 Výheň předků hoří.' : hra.spac.probuzen && !hra.spac.porazen ? '🌋 Pradávný spáč je vzhůru!' : 'Cíl: zažehnout Výheň předků Klíčem k Srdci.'}</p>`;
    if ($('pribeh').dataset.h !== pr) { $('pribeh').innerHTML = pr; $('pribeh').dataset.h = pr; }
    // výukové úkoly
    const cd = PB.coDal(hra);
    const cdh = cd ? `${cd.text} <small>(krok ${cd.krok}/${cd.z})</small>` : '✅ Všechny úkoly splněné – hora je vaše.';
    if ($('coDal').dataset.h !== cdh) { $('coDal').innerHTML = cdh; $('coDal').dataset.h = cdh; }
    $('odkazJak').hidden = hra.tik >= HRA.TAHU_ZA_DEN;                   // „❓ Jak hrát" jen první den
    if (rekordy) rekordy.hloubka.zapis(hra.nejhloubeji);
    // deník
    if (!$('paleta').hidden) vykresliPaletu();
    // ❄️ předpověď zimy
    if (st.zalozka === 'prehled') { vykresliZimu(hra); vykresliObranu(hra); vykresliCas(hra); }
    // co hoří
    const poz = pozorSeznam(hra);
    // s místem = tlačítko s 📍 (klik ukáže místo), bez místa jen řádek textu
    const pozH = poz.map((u, k) => u.i === undefined ? `<li class="bez-mista${u.mirne ? ' mirne' : ''}">${u.ikona} ${u.text}</li>`
      : `<li><button data-pozor="${k}"${u.mirne ? ' class="mirne"' : ''} title="Klikni – ukázat místo">${u.ikona} ${u.text} <span class="kde">📍</span></button></li>`).join('');
    if ($('pozor').dataset.h !== pozH) { $('pozor').innerHTML = pozH || '<li class="tip">✅ Nic nehoří.</li>'; $('pozor').dataset.h = pozH; $('pozorSekce').hidden = false; }
    st.pozor = poz;
    const nalehave = poz.filter(u => !u.mirne).length;
    $('pozorPocet').hidden = !nalehave || st.zalozka === 'prehled'; $('pozorPocet').textContent = nalehave;
    // odznak nových důležitých zpráv na záložce Deník
    if (st.zalozka === 'denik') st.denikVidel = hra.tik;
    const nove = hra.denik.filter(z => z.tik > (st.denikVidel || 0) && DULEZITE.has(z.typ)).length;
    $('denikNove').hidden = !nove; $('denikNove').textContent = nove > 9 ? '9+' : nove;
    // nová důležitá zpráva → oznámení nad mapou (co se stalo, když zazněl zvuk)
    const nove2 = [];
    for (let k = hra.denik.length - 1; k >= 0 && hra.denik[k] !== st.posledniOznameni; k--) nove2.push(hra.denik[k]);
    if (hra.denik.length) st.posledniOznameni = hra.denik[hra.denik.length - 1];
    // obchod hráče samotného (okno karavany je otevřené) hlásí dialog, ne oznámení
    const ozn = nove2.reverse().filter(zp => DULEZITE.has(zp.typ) && !(zp.typ === 'obchod' && $('obchodOkno').open)).slice(-3);
    for (const zp of ozn) oznameni(zp);
    if (ozn.length) zvukZpravy(ozn[ozn.length - 1]);      // jeden zvuk za dávku – k poslední zprávě
    // deník má strop 200 zpráv (push + shift) – délka se pak nemění, proto porovnat poslední zprávu
    const posledniZprava = hra.denik[hra.denik.length - 1] || null;
    if (posledniZprava !== posledniDenik || vse) {
      posledniDenik = posledniZprava;
      $('denik').innerHTML = hra.denik.slice(-40).reverse().map(z =>
        `<li class="dz-${z.typ}${z.i >= 0 ? ' skok' : ''}"${z.i >= 0 ? ` data-i="${z.i}" role="button" tabindex="0" title="Klikni – ukázat místo"` : ''}><span class="dz-den">den ${Math.floor(z.tik / HRA.TAHU_ZA_DEN) + 1}</span> ${textZpravy(z)}${z.i >= 0 ? ' <span class="dz-kde">📍</span>' : ''}</li>`).join('');
    }
    ukazVyber();
  }

  // --- události s volbou -------------------------------------------------------------------
  const OBRAZY_UDALOSTI = {
    poutnik: ['event-navstevnik.webp', 'Poutník před trpasličí bránou'],
    zbloudily: ['event-navstevnik.webp', 'Zbloudilý trpaslík před bránou'],
    migranti: ['event-navstevnik.webp', 'Noví trpaslíci přicházejí k bráně'],
    dar: ['event-navstevnik.webp', 'Posel přináší dar ke vstupu do hory'],
    nemoc: ['event-klan.webp', 'Trpasličí klan shromážděný v síni'],
    spor: ['event-klan.webp', 'Trpaslíci se dohadují v klanové síni'],
    slavnost: ['event-klan.webp', 'Pivní slavnost v trpasličí síni'],
    dutina: ['event-objev.webp', 'Horníci objevili prastarou krystalovou dutinu'],
  };
  let udalostOtevrena = null;
  function hlidejUdalost() {
    const u = st.hra.udalost;
    if (!u || udalostOtevrena === u) return;
    udalostOtevrena = u;
    if (st.rychlost) { st.predUdalosti = st.rychlost; nastavRychlost(0); }
    const obraz = OBRAZY_UDALOSTI[u.id] || OBRAZY_UDALOSTI.poutnik;
    $('udalostObraz').src = `trpaslici/assets/${obraz[0]}`;
    $('udalostObraz').alt = obraz[1];
    $('udalostText').textContent = u.text;
    $('udalostVolby').innerHTML = u.volby.map((v, i) => `<button class="btn${i ? ' sede' : ''}" data-i="${i}">${v}</button>`).join('');
    const d = $('udalostOkno');
    if (!d.open) d.showModal();
  }
  function vyresUdalost(i) {
    const text = UD.vyres(st.hra, i);
    $('udalostOkno').close();
    udalostOtevrena = null;
    if (text) oznam(text);
    if (st.predUdalosti) { nastavRychlost(st.predUdalosti); st.predUdalosti = 0; }
    obnovPanel(true);
  }

  // --- konec hry ---------------------------------------------------------------------------------
  let konecUkazan = null;
  function hlidejKonec() {
    const k = st.hra.konec;
    if (!k || k.pokracovat || konecUkazan === k) return;
    konecUkazan = k;
    nastavRychlost(0);
    $('konecObraz').src = `trpaslici/assets/konec-${k.vitezstvi ? 'vitezstvi' : 'porazka'}.webp`;
    $('konecObraz').alt = k.vitezstvi ? 'Probuzená Výheň předků v runové síni' : 'Opuštěná síň po zániku klanu';
    const s = k.stat;
    $('konecNadpis').textContent = k.vitezstvi ? '🔥 Srdce hory bije!' : '🪦 Hora utichla';
    $('konecText').textContent = PB.epilog(st.hra);
    $('konecStat').innerHTML = [['Dní', s.dni], ['Let', s.roky], ['Trpaslíků (nejvíc)', `${s.zije} (${s.nejvic})`], ['Padlých', s.padlo],
      ['Sláva', s.slava], ['Nejhlouběji', s.hloubka + ' m'], ['Vykopaných polí', s.vykopano], ['Poražených nepřátel', s.zabito],
      ['Nájezdů', s.najezdu], ['Artefaktů', s.artefakty], ['Pradávný spáč', s.spac]].map(([a, b]) => radek(a, b)).join('');
    $('konecDal').hidden = !k.vitezstvi;
    let nove = [];
    if (rekordy) {
      if (k.vitezstvi && rekordy.vitezstvi.zapis(s.dni)) nove.push('nejrychlejší vítězství');
      if (rekordy.slava.zapis(s.slava) && k.vitezstvi) nove.push('nejvyšší sláva');   // po porážce rekord neohlašovat
      rekordy.hloubka.zapis(s.hloubka);
    }
    $('konecRekord').textContent = nove.length ? `🏆 Nový rekord: ${nove.join(', ')}!` : '';
    $('btnKonec').hidden = true;
    $('konecOkno').showModal();
  }

  // --- obchod s karavanou -------------------------------------------------------------------
  const obchodVyber = { nakup: {}, prodej: {} };
  function otevriObchod() {
    if (!st.hra.karavana) return;
    obchodVyber.nakup = {}; obchodVyber.prodej = {};
    if (st.rychlost) { st.predObchodem = st.rychlost; nastavRychlost(0); }
    vykresliObchod();
    $('obchodOkno').showModal();
  }
  function hodnotaProdeje(druh, n) {       // stejně jako obchod(): nejdražší kusy první, potraviny od 10 ks s příplatkem
    const vv = (OB.naProdej(st.hra)[druh] || []).slice().sort((a, b) => OB.cenaProdej(st.hra, b) - OB.cenaProdej(st.hra, a));
    return OB.prodejDruhu(st.hra, druh, vv, Math.min(n, vv.length));
  }
  const ZAKLADNI_DRUHY = ['jidlo', 'pivo', 'drevo', 'kamen', 'uhli', 'prut_zelezo'];   // „Doplnit" je neprodává
  function maxObchodu(strana, druh) {
    const hra = st.hra, k = hra.karavana;
    return strana === 'nakup' ? (k && k.nabidka[druh] || 0) : (OB.naProdej(hra)[druh] || []).length;
  }
  function zmenObchod(strana, druh, o) {
    const v = obchodVyber[strana], max = maxObchodu(strana, druh);
    v[druh] = Math.max(0, Math.min(max, (v[druh] || 0) + o));
    if (!v[druh]) delete v[druh];
  }
  // 📊 bilance zásob: výroba, spotřeba, výdrž a kapacita kuchyní/pivovarů
  const cislo = (x, zn) => { const v = Math.round(x * 10) / 10; return (zn && v > 0 ? '+' : '') + String(v).replace('.', ','); };
  const zdrojeText = o => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ') || 'nic';
  function vykresliZimu(hra) {
    const z = HRA.predpovedZimy(hra), dny = x => { const v = Math.max(0, Math.round(x)); return `${v} ${v === 1 ? 'den' : v >= 2 && v <= 4 ? 'dny' : 'dní'}`; };
    textJen($('zimaNadpis'), z.vZime ? `❄️ Zima – do jara ${dny(z.dnyZimy)}` : `❄️ Do zimy ${dny(z.dnyDoZimy)}`);
    const porci = x => mn(Math.max(0, Math.round(x)), 'porce', 'porce', 'porcí');
    let verdikt, trida = z.verdikt;
    // poplach jen když opravdu hoří: první dny (nic se ještě nevaří) a s dostatkem času neutrálně
    const klidne = z.verdikt === 'hlad' && (HRA.den(hra) <= 2 || dniJidla(z) >= 10);
    if (z.verdikt === 'ok') verdikt = `✅ Přežijete – na konci zimy zbude ~${porci(z.naKonci)}.`;
    else if (z.verdikt === 'tesne') verdikt = `⚠️ Těsně – na konci zimy zbude jen ~${porci(z.naKonci)}.`;
    else if (klidne) { trida = 'info'; verdikt = `📋 Zásoby vydrží ~${dny(dniJidla(z))}. Na zimu zatím chybí ~${porci(z.chybi)} – ${radaJidlo(hra, z).replace(/^./, c => c.toLowerCase())}.`; }
    else verdikt = (z.dojdeZaDni < z.dnyDoZimy ? `❌ Jídlo dojde už za ~${dny(z.dojdeZaDni)}, ještě před zimou!` : `❌ Jídlo dojde ~${Math.max(1, Math.ceil(z.dojdeZaDni - z.dnyDoZimy))}. den zimy.`) +
      ` Chybí ~${porci(z.chybi)} – ${radaJidlo(hra, z).replace(/^./, c => c.toLowerCase())}.`;
    const html = `<div class="zima-verdikt ${trida}">${verdikt}</div>` +
      `<p class="tip">Jídlo: ~${porci(z.porce)} (i ze surovin${z.kuchyne ? '' : ' – bez kuchyně jen poloviční'}), denně ${cislo(z.sazba, 1)}` +
      (z.zPoli > 0.05 ? `, v zimě ${cislo(z.sazbaZima, 1)} (pole nerostou)` : '') + `. <span title="Větší ze skutečné spotřeby a potřeby (kolik by klan snědl dosyta)">Klan sní ~${cislo(z.spotrebaDen)}/den.</span></p>` +
      `<p class="tip">${z.pivo.vydrzi ? '🍺 Pivo vydrží.' : '🍺 Pivo nevydrží – trpaslíci budou pít vodu nebo led (horší nálada, žízní ale nezemřou).'}</p>`;
    if ($('zima').dataset.h !== html) { $('zima').innerHTML = html; $('zima').dataset.h = html; }
  }
  // ⏳ čím klan tráví čas: podíly činností za poslední 3 dny (nejvýš 6 pruhů, po 1 %)
  function vykresliCas(hra) {
    const c = HRA.casKlanu(hra, 3), max = c.podily.length ? c.podily[0].podil : 1;
    const html = c.vzorku ? c.podily.slice(0, 6).map(p => {
      const pr = Math.round(p.podil * 100);
      return `<div class="pruh" title="${p.nazev}: ${pr} % času klanu"><span>${p.ikona} ${p.nazev}</span><i><b style="width:${Math.round(p.podil / max * 100)}%"></b></i><small>${pr} %</small></div>`;
    }).join('') : '<p class="tip">Zatím žádná data – hra se teprve rozbíhá.</p>';
    if ($('casKlanu').dataset.h !== html) { $('casKlanu').innerHTML = html; $('casKlanu').dataset.h = html; }
    $('casObdobi').textContent = c.vzorku ? `– poslední ${Math.min(c.dni, HRA.den(hra))} ${Math.min(c.dni, HRA.den(hra)) === 1 ? 'den' : 'dny'}` : '';
  }
  // 🛡️ obrana proti Spáči (kampaň, dokud žije) a neklid hory
  const ODHAD_TRIDA = { 'dobrý': 'dobre', 'vyrovnaný': 'varuj', 'špatný': 'spatne', 'málo strážců': 'spatne' };
  // obrana proti Spáči má smysl až ke konci kampaně: Klíč, 2 artefakty, hloubka od 120 m, nebo Spáč už je vzhůru
  const spacNaObzoru = hra => hra.spac.probuzen || hra.zazehnuti || hra.artefakty.klic || hra.veci.some(v => v.druh === 'klic') ||
    Object.keys(hra.artefakty).filter(k => k !== 'klic').length >= 2 || (hra.nejhloubeji || 0) >= 120;
  function vykresliObranu(hra) {
    const spac = PB.kampan(hra) && !hra.spac.porazen && spacNaObzoru(hra), nk = T.hrozby.neklid(hra), pr = Math.round(nk * 100);
    let html = '';
    if (spac) {
      const o = T.hrozby.silaObrany(hra), sp = o.spac;
      html += radek('Strážci', `${o.strazcu} <small>(ozbrojených ${o.ozbrojenych})</small>`) +
        radek('Útok strážců', `⚔️ ${o.utok}` + (o.zbroj && o.ozbrojenych ? ` · 🛡️ zbroj ~${Math.round(o.zbroj / o.ozbrojenych * 100)} %` : '')) +
        radek('Spáč', `${sp.vzhuru ? '<b class="spatne">vzhůru</b>' : 'spí'} · ❤ ${sp.zdravi}/${sp.max} · ⚔️ ${sp.utok}`) +
        `<div class="obrana-odhad ${ODHAD_TRIDA[o.odhad] || ''}">Odhad boje: <b>${o.odhad}</b>` +
        (o.odhad === 'málo strážců' ? ` – na Spáče jdou jen ozbrojení strážci, aspoň ${T.hrozby.SKUPINA_NA_SPACE}` : o.odhad === 'špatný' ? ' – vyzbroj a vycvič další strážce' : '') + '</div>';
    }
    const tip = `Neklid hory ${pr} %: s hloubkou a artefakty rostou nájezdy a z hlubin lezou tvorové`;
    html += `<div class="pruh neklid${nk >= 0.75 ? ' spatne' : nk >= 0.4 ? ' varuj' : ''}" title="${tip}" role="img" aria-label="${tip}"><span>🌋 neklid hory</span><i><b style="width:${pr}%"></b></i><small>${pr} %</small></div>`;
    textJen($('obranaNadpis'), spac ? '🛡️ Obrana proti Spáči' : '🌋 Neklid hory');
    if ($('obrana').dataset.h !== html) { $('obrana').innerHTML = html; $('obrana').dataset.h = html; }
  }
  // ⚒️ výroba zbraní, zbroje a nástrojů: co jde ukovat hned a co chybí (souhrnně podle příčiny)
  // sbalitelné oddíly skladu; stav si pamatuje prohlížeč (jen pohodlí hráče)
  const KLIC_SEKCE = 'webapp_hra_trpaslici_sklad_sekce';
  let sekceSkladu = null;
  function sekceOtevrena(k) {
    if (!sekceSkladu) { try { sekceSkladu = JSON.parse(uloziste.cti(KLIC_SEKCE) || '{}') || {}; } catch (e) { sekceSkladu = {}; } }
    return sekceSkladu[k] !== false;
  }
  function zapamatujSekci(k, otevrena) {
    sekceOtevrena(k); sekceSkladu[k] = otevrena;
    try { localStorage.setItem(KLIC_SEKCE, JSON.stringify(sekceSkladu)); } catch (e) { /* jen pohodlí */ }
  }
  const sekce = (k, souhrn, telo, trida) => `<details class="sekce-sklad${trida ? ' ' + trida : ''}" data-sekce="${k}"${sekceOtevrena(k) ? ' open' : ''}><summary>${souhrn}</summary>${telo}</details>`;
  function blokaceHtml(bl, hra) {
    if (!bl || !bl.length) return '';
    const ok = bl.filter(b => b.lze), spatne = bl.filter(b => !b.lze), duvody = new Map();
    for (const b of spatne) for (const c of b.chybi) { if (!duvody.has(c.co)) duvody.set(c.co, { text: c.text, co: [] }); duvody.get(c.co).co.push(b.nazev + (b.zakazka ? ' ▶' : '')); }
    // bez kovárny (ani magmatické výhně) je to výhled, ne poplach: neutrálně a sbaleně
    if (hra && !hra.dilny.some(d => d.typ === 'kovarna' || d.typ === 'magmovyhen'))
      return `<details class="sekce-sklad blokace neutralni" data-sekce="blokace-pozdeji"${sekceSkladu && sekceSkladu['blokace-pozdeji'] === true ? ' open' : ''}>` +
        `<summary><h4>⚒️ Zbraně, zbroj a nástroje <small>až po kovárně</small></h4></summary>` +
        `<p class="tip">Kove je kovárna (nebo magmatická výheň) ze železných prutů z tavírny. Co bude chybět:</p>` +
        (duvody.size ? '<ul>' + [...duvody.values()].map(d => `<li>• ${d.text}</li>`).join('') + '</ul>' : '') + '</details>';
    return sekce('blokace', `<h4>⚒️ Zbraně, zbroj a nástroje <small>${spatne.length ? `⛔ ${spatne.length}` : '✅'}</small></h4>`,
      (ok.length ? `<p class="tip">✅ Jde ukovat: ${ok.map(b => b.nazev + (b.zakazka ? ' ▶' : '')).join(', ')}</p>` : '') +
      (duvody.size ? '<ul>' + [...duvody.values()].map(d => `<li><span class="bil-minus">⛔ ${d.text}</span> <small>– ${d.co.join(', ')}</small></li>`).join('') + '</ul>' : '') +
      (spatne.some(b => b.zakazka) ? '<p class="tip">▶ = zakázka v kovárně stojí</p>' : ''), 'blokace');
  }
  function vykresliBilanci(hra) {
    const b = HRA.bilance(hra), n = hra.trpaslici.length;
    const d0 = b.jidlo.dni;
    const obd = d0 ? `průměr za ${d0 === 1 ? 'poslední den' : `poslední ${d0} ${d0 < 5 ? 'dny' : 'dní'}`}` : 'zatím jen dnešek – odhad';
    const zp = HRA.predpovedZimy(hra), dJ = dniJidla(zp);
    const vydrzJidla = () => dJ === Infinity ? 'zásoba roste' : dJ < 1 ? '<b class="bil-minus">dojde dnes!</b>' : `vydrží ~${dnyTxt(dJ)}`;
    const vydrz = r => r === b.jidlo ? vydrzJidla() : r.bilance >= 0 ? (r.vyroba || r.spotreba ? 'zásoba roste' : '') : r.vydrzi < 1 ? '<b class="bil-minus">dojde dnes!</b>' : `vydrží ~${Math.floor(r.vydrzi)} ${Math.floor(r.vydrzi) === 1 ? 'den' : Math.floor(r.vydrzi) < 5 ? 'dny' : 'dní'}`;
    const karta = (druh, dilna, dilnaMn, kusy, nevari) => {
      const r = b[druh], V = P.VECI[druh], max = Math.max(r.vyroba, r.spotreba, r.potreba, 0.1);
      const kap = r.dilen ? `${dilnaMn(r.dilen)}: reálně ~${Math.round(r.kapacita)} ${kusy}/den <small>(teoreticky ${Math.round(r.kapacitaTeor)})</small> → uživí ~${mn(Math.round(r.uzivi), 'trpaslíka', 'trpaslíky', 'trpaslíků')}. ` +
          `Máš ${n}, potřeba ~${cislo(r.potreba)}/den${r.kapacita < r.potreba ? ' – <span class="bil-minus">postav další</span>' : ''}.` +
          (r.udrzuje ? ` Zakázka udržuje zásobu ${r.udrzuje} – když je plná, ${nevari}.` : '')
        : `<span class="bil-minus">Nemáš ${dilna} – ${V.nazev} ubývá jen ze zásob.</span> Klan (${n}) potřebuje ~${cislo(r.potreba)}/den.`;
      return sekce(druh, `<h4><span>${V.ikona} ${V.nazev}</span><small title="ve skladu ${r.veSkladu}, jinde ${r.zasoba - r.veSkladu}${druh === 'jidlo' ? '. Výdrž počítá hotová jídla i suroviny (kuchyně: z houby 1 jídlo, z ječmene 2) a zimu bez polí – stejné číslo jako v Přehledu' : ''}">zásoba ${r.zasoba} · ${vydrz(r)}</small></h4>`,
        `<div class="bil-pruhy"><span>výroba</span><span class="bil-pruh v" title="${zdrojeText(r.plus)}"><b style="width:${r.vyroba / max * 100}%"></b></span>` +
        `<span>spotřeba</span><span class="bil-pruh s" title="${zdrojeText(r.minus)}"><b style="width:${r.spotreba / max * 100}%"></b></span></div>` +
        `<div class="bil-radek" title="Odkud: ${zdrojeText(r.plus)}"><span>Výroba</span><b class="bil-plus">${cislo(r.vyroba, 1)}/den</b></div>` +
        `<div class="bil-radek" title="${r.odhad ? 'Zatím bez měření – odhad podle počtu trpaslíků' : 'Kam: ' + zdrojeText(r.minus)}. Spotřeba = co klan skutečně snědl/vypil; potřeba = kolik by spotřeboval dosyta – liší se, když trpaslíci hladoví nebo pijí vodu."><span>Spotřeba${r.odhad ? ' (odhad)' : ''}</span><b class="bil-minus">${cislo(-r.spotreba)}/den</b></div>` +
        (r.nepokryto >= 0.05 ? `<div class="bil-radek" title="${zdrojeText(r.nepok)}"><span>Nepokryto (${Object.keys(r.nepok).join(', ')})</span><b class="bil-minus">${cislo(r.nepokryto)}/den ⚠️</b></div>` : '') +
        `<div class="bil-radek"><span>Bilance</span><b class="${r.bilance >= 0 ? 'bil-plus' : 'bil-minus'}">${cislo(r.bilance, 1)}/den ${r.bilance >= 0 ? '✅' : '⚠️'}</b></div>` +
        `<p class="bil-kap">${kap}</p>`, 'bil-karta');
    };
    const dalsi = ['houby', 'jecmen', 'drevo', 'kamen', 'uhli', 'prut_zelezo'].filter(d => b[d].zasoba || b[d].vyroba || b[d].spotreba).map(d => {
      const r = b[d];
      return `<tr title="Odkud: ${zdrojeText(r.plus)} · Kam: ${zdrojeText(r.minus)}"><td>${P.VECI[d].ikona} ${P.VECI[d].nazev}</td><td class="bil-plus">${cislo(r.vyroba, 1)}</td>` +
        `<td class="bil-minus">${cislo(-r.spotreba)}</td><td class="${r.bilance >= 0 ? 'bil-plus' : 'bil-minus'}">${cislo(r.bilance, 1)}</td><td>${r.zasoba}</td></tr>`;
    }).join('');
    const html = karta('jidlo', 'kuchyni', k => k === 1 ? 'Kuchyně' : `Kuchyně (${k})`, 'jídel', 'kuchyně nevaří') +
      karta('pivo', 'pivovar', k => k === 1 ? 'Pivovar' : `Pivovary (${k})`, 'piv', 'pivovar nevaří') +
      blokaceHtml(b.blokace || HRA.coBlokujeVyrobu(hra), hra) +
      (dalsi ? sekce('suroviny', '<h4>🧱 Suroviny za den</h4>', `<table class="bil-tab"><thead><tr><th>surovina</th><th>výroba</th><th>spotřeba</th><th>bilance</th><th>zásoba</th></tr></thead><tbody>${dalsi}</tbody></table>`) : '');
    if ($('bilance').dataset.h !== html) { $('bilance').innerHTML = html; $('bilance').dataset.h = html; }
    $('bilanceObdobi').textContent = '– ' + obd;
  }
  function vykresliObchod() {
    const hra = st.hra, k = hra.karavana;
    if (!k) { $('obchodOkno').close(); return; }
    const sklad = OB.naProdej(hra);
    let chci = 0, dam = 0;
    const bonus = Math.round((OB.HROMADNE_BONUS - 1) * 100);
    const karta = (strana, druh, max, cena, n) => {
      // potraviny a pití ve velkém (od HROMADNE_OD kusů) karavana vykoupí dráž
      const hrom = strana === 'prodej' && OB.HROMADNE.includes(druh);
      return `<button class="zbozi${n ? ' vybrano' : ''}${n >= max ? ' vycerpano' : ''}" data-s="${strana}" data-d="${druh}" ` +
      `title="${P.VECI[druh].nazev} – ${strana === 'nakup' ? 'karavana má' : 've skladu'} ${max}, hodnota ${cena} za kus${hrom ? `; od ${OB.HROMADNE_OD} kusů najednou o ${bonus} % dráž` : ''}">` +
      (hrom ? `<span class="hromadne${n >= OB.HROMADNE_OD ? ' plati' : ''}">${n >= OB.HROMADNE_OD ? '✔' : 'od ' + OB.HROMADNE_OD}<br>+${bonus} %</span>` : '') +
      `<span class="ikona">${P.VECI[druh].ikona}</span><span class="nazev">${P.VECI[druh].nazev}</span>` +
      `<span class="radek-zb"><span>×${max}</span><span class="mince">${cena}</span></span>${n ? `<b class="pocet-n">${n}</b>` : ''}</button>`;
    };
    const polozka = (strana, druh, n) => `<button class="kos-polozka" data-s="${strana}" data-d="${druh}" data-kos="1" title="Kliknutím vrátíš 1 ks (Shift 10, Ctrl vše)">${P.VECI[druh].ikona} ${n}</button>`;
    const nab = Object.entries(k.nabidka).map(([druh, max]) => {
      const n = obchodVyber.nakup[druh] || 0; chci += n * OB.cenaNakup(druh);
      return karta('nakup', druh, max, OB.cenaNakup(druh), n);
    }).join('');
    const pro = Object.keys(sklad).sort((a, b) => OB.cenaProdej(hra, sklad[b][0]) - OB.cenaProdej(hra, sklad[a][0])).map(druh => {
      const n = obchodVyber.prodej[druh] || 0; dam += hodnotaProdeje(druh, n);
      return karta('prodej', druh, sklad[druh].length, Math.max(...sklad[druh].map(v => OB.cenaProdej(hra, v))), n);
    }).join('');
    $('obchodNakup').innerHTML = nab || '<p class="tip">Karavana už nic nemá.</p>';
    $('obchodProdej').innerHTML = pro || '<p class="tip">Ve skladech nic není.</p>';
    const kos = strana => Object.entries(obchodVyber[strana]).filter(([, n]) => n > 0).map(([d, n]) => polozka(strana, d, n)).join('') || '<span class="prazdny">nic – klikni na zboží</span>';
    $('kosikNakup').innerHTML = kos('nakup'); $('kosikProdej').innerHTML = kos('prodej');
    $('sumaNakup').textContent = chci; $('sumaProdej').textContent = dam;
    const pomer = chci ? dam / chci : (dam ? 1.5 : 0);
    $('obchodVahy').style.width = (Math.min(1.5, pomer) / 1.5 * 100) + '%';
    $('obchodVahy').classList.toggle('dost', chci > 0 ? dam >= chci : dam > 0);
    const zbyva = Math.max(0, Math.ceil((k.do - hra.tik) / HRA.TAHU_ZA_DEN * 24));
    $('obchodCas').textContent = `🕐 odjede za ${zbyva} h`;
    $('obchodBilance').innerHTML = !chci && !dam ? 'Vyber, co chceš a co dáš.'
      : dam >= chci ? `✅ Karavana souhlasí.${dam > chci ? ` <small>Přebytek ${dam - chci} nevrací.</small>` : ''}`
      : `❌ Chybí ještě <span class="mince">${chci - dam}</span> – přidej zboží, nebo ⚖️ Doplnit.`;
    $('btnObchod').disabled = !(chci || dam) || dam < chci;
  }
  // ⚖️ Doplnit: přidá ze skladu nejdražší zboží mimo základní zásoby, dokud nepokryje cenu
  function doplnObchod() {
    const hra = st.hra, sklad = OB.naProdej(hra);
    let chci = 0; for (const [d, n] of Object.entries(obchodVyber.nakup)) chci += n * OB.cenaNakup(d);
    const dam = () => Object.entries(obchodVyber.prodej).reduce((a, [d, n]) => a + hodnotaProdeje(d, n), 0);
    const kandidati = Object.keys(sklad).filter(d => !ZAKLADNI_DRUHY.includes(d) && !obchodVyber.nakup[d])
      .sort((a, b) => OB.cenaProdej(hra, sklad[b][0]) - OB.cenaProdej(hra, sklad[a][0]));
    for (const d of kandidati) while (dam() < chci && (obchodVyber.prodej[d] || 0) < sklad[d].length) zmenObchod('prodej', d, 1);
    if (dam() < chci) oznam('Cennosti a přebytky nestačí – přidej ručně jídlo, dřevo nebo kovy.', true);
  }

  // --- zvuk a částice: události z logiky ------------------------------------------------------------
  const GLOBALNI = new Set(['roh', 'objev', 'zvonek', 'smrt', 'fanfara']);
  function vyberZvuky() {
    const ev = st.hra._zvuky;
    if (!ev || !ev.length) return;
    st.hra._zvuky = [];
    const sirka = cv.width / kam.z, vyska = cv.height / kam.z;
    for (const e of ev) {
      if (e.i < 0 || GLOBALNI.has(e.typ)) { if (Z.hraj(e.typ, 0.8, 0, e.x)) globalniZvuk = performance.now(); continue; }
      const wx = (e.i % W) * S + 8, wy = (e.i / W | 0) * S + 8;
      const vObraze = wx > kam.x - S * 4 && wx < kam.x + sirka + S * 4 && wy > kam.y - S * 4 && wy < kam.y + vyska + S * 4;
      if (!vObraze || (!st.vseZnamo && !st.hra.znamo[e.i])) continue;
      G.casticeZUdalosti(e, st.hra);
      Z.hraj(e.typ, Math.min(1, 0.35 + kam.z / dpr / 6), ((wx - kam.x) / sirka) * 2 - 1, e.x);
    }
  }

  // --- nástroje a rychlost --------------------------------------------------------------
  // náhled stavby pod myší (jen s nástrojem stavby, bez tažení); důvod, proč nejde, jde do informačního pruhu
  // zóny se kreslí jen při práci se zónami; vybrané pole v zóně ukáže jen tu jednu
  function viditelneZony() {
    if ((st.nastroj || '').startsWith('zona') || (!$('paleta').hidden && $('paleta').dataset.co === 'zona')) return 'vse';
    if (!st.vybrany && st.vyber && st.hra) { const id = st.hra.zona[st.vyber.y * W + st.vyber.x]; if (id) return id; }
    return null;
  }
  // stavět s předností: nové plány dostanou ⭐ hned při umístění
  const prioTlacitko = () => `<button class="mini${st.stavPrio ? ' zap' : ''}" data-akce="stavet-prio" aria-pressed="${!!st.stavPrio}" title="Nové plány dostanou ⭐ přednost – postaví se dřív">⭐ s předností: ${st.stavPrio ? 'ano' : 'ne'}</button>`;
  function nahledStavby() {
    const [druh, typ] = (st.nastroj || '').split(':');
    if (druh !== 'stavba' || !typ || !st.najeti || st.tah) return null;
    const i = st.najeti.y * W + st.najeti.x, proc = ST.prekazka(st.hra, typ, i);
    const d = ST.STAVBY[typ];
    const info = `${d.ikona} <b>${d.nazev}</b>${d.sirka ? ` – zabere ${d.sirka} pole vedle sebe, ukaž na levé` : ' – klikni nebo táhni'}` +
      (proc ? ` <span class="nejde">⛔ ${proc}</span>` : ' <span class="jde">✅ sem to jde</span>') + ` <small>(Esc / pravý klik = konec)</small> ${prioTlacitko()}<br><span class="popis-stavby" title="${d.popis}">${d.popis}</span>`;
    if ($('nastrojInfo').dataset.h !== info) { $('nastrojInfo').innerHTML = info; $('nastrojInfo').dataset.h = info; }
    return { x: st.najeti.x, y: st.najeti.y, typ, sirka: d.sirka || 1, ok: !proc };
  }
  // kopání: rozpětí stropu po vykopání obdélníku – stejné pravidlo jako priroda.nestabilniStropy (síň vysoká 3+ pole,
  // nad ní pevný strop, delší úsek bez podpěry, než hornina stropu unese); plánované podpěry se počítají jako hotové.
  // Vrací nejmenší překročené rozpětí, nebo 0, když strop vydrží.
  function rozpetiPoKopani(hra, x0, y0, x1, y1) {
    const t = hra.hora.teren, v = hra.vykopane, N = W * H;
    const vRect = i => { const x = i % W, y = i / W | 0; return x >= x0 && x <= x1 && y >= y0 && y <= y1 && P.lzeKopat(hra, i); };
    const otev = i => !HORA.pevne(t[i]) || vRect(i);
    const podpera = i => hra.stavba[i] === ST.K.PODPERA || (hra.planNa.has(i) && (ST.planPodle(hra, hra.planNa.get(i)) || {}).typ === 'podpera');
    const kvalif = (x, y) => {
      const i = y * W + x;
      if (x < 0 || x >= W || !(v[i] || vRect(i)) || !otev(i) || otev(i - W) || hra.hora.pozadi[i] === M.VZDUCH) return false;
      let vys = 0;
      for (let j = i; j < N && otev(j); j += W) { vys++; if (podpera(j)) return false; }
      return vys >= 3;
    };
    let nej = 0;
    for (let y = Math.max(1, y0 - 2); y <= Math.min(H - 2, y1); y++) {
      for (let x = x0; x <= x1; x++) {
        if (!kvalif(x, y)) continue;
        let a = x, b = x; while (kvalif(a - 1, y)) a--; while (kvalif(b + 1, y)) b++;
        let roz = Infinity; for (let k = a; k <= b; k++) roz = Math.min(roz, P.rozpetiNa(hra, (y - 1) * W + k));
        if (b - a + 1 > roz && (!nej || roz < nej)) nej = roz;
        x = b;
      }
    }
    return nej;
  }
  // během tažení kopání: velikost obdélníku a varování, že síň bude potřebovat podpěry
  function infoTahu() {
    const t = st.tah, el = $('nastrojInfo');
    if (!t || t.druh !== 'kopat') { if (el.dataset.tah) { el.dataset.tah = ''; el.dataset.h = ''; el.hidden = true; } return; }
    const x0 = Math.max(0, Math.min(t.x0, t.x1)), x1 = Math.min(W - 1, Math.max(t.x0, t.x1));
    const y0 = Math.max(1, Math.min(t.y0, t.y1)), y1 = Math.min(H - 2, Math.max(t.y0, t.y1));
    const klic = [x0, y0, x1, y1].join(',');
    if (el.dataset.tah === klic) return;
    el.dataset.tah = klic;
    const sir = x1 - x0 + 1, vys = y1 - y0 + 1, roz = rozpetiPoKopani(st.hra, x0, y0, x1, y1);
    el.innerHTML = `⛏️ <b>${sir}×${vys}</b> <small>(${mn(sir * vys, 'pole', 'pole', 'polí')})</small>` +
      (roz ? ` <span class="nejde">⚠️ potřebuje podpěry (rozpětí ${roz})</span><br><small>Síň vysoká 3+ pole se bez podpěr zřítí – nejvýš 2 pole vysoko je bezpečné, jinak postav 🪵 podpěry aspoň každá ${roz} pole.</small>`
        : vys >= 3 ? ' <span class="jde">✅ strop vydrží</span>' : '');
    el.dataset.h = ''; el.hidden = false;
  }
  function nastav(n) {
    st.nastroj = n; spinave = true;
    $('nastrojInfo').dataset.tah = '';
    const skupina = n.split(':')[0];
    for (const b of document.querySelectorAll('#nastroje button')) b.setAttribute('aria-pressed', b.dataset.n === skupina);
    cv.classList.toggle('kresli', n !== 'pohled');
    $('paleta').hidden = true;
    const [druh, typ] = n.split(':');
    $('nastrojInfo').hidden = !typ;
    if (druh === 'stavba') {
      const d = ST.STAVBY[typ];
      $('nastrojInfo').innerHTML = `${d.ikona} <b>${d.nazev}</b> – ${d.sirka ? `zabere ${d.sirka} pole vedle sebe, klikni na levé` : 'klikni nebo táhni'} <small>(Esc / pravý klik = konec)</small> ${prioTlacitko()}<br><span class="popis-stavby" title="${d.popis}">${d.popis}</span>`;
      $('nastrojInfo').dataset.h = '';
    } else if (druh === 'zona') {
      $('nastrojInfo').innerHTML = typ === 'zmensit' ? '✂️ <b>zmenšit zónu</b> – táhni přes pole, která z ní vyjmout'
        : `${ST.ZONY[typ].ikona} <b>${ST.ZONY[typ].nazev}</b> – táhni obdélník <small>(Esc = konec)</small>`;
    }
  }
  function ukazPaletu(co) {
    const pal = $('paleta');
    if (!pal.hidden && pal.dataset.co === co) { pal.hidden = true; spinave = true; return; }
    pal.dataset.co = co; pal.dataset.h = '';
    vykresliPaletu();
    pal.hidden = false; spinave = true;
  }
  // kam která zóna jde (stavby.lzeZona) a co v ní musí stát – druhý řádek tlačítka v paletě
  const PRAVIDLA_ZON = { sklad: 'na podlahu, venku i pod zemí', loznice: 'pod zem · potřebuje postele', jidelna: 'pod zem · stoly a židle',
    pole: 'venku na hlínu nebo jíl', houbarna: 'pod zem na pevnou podlahu', les: 'venku na hlínu nebo jíl', osetrovna: 'pod zem · potřebuje postele' };
  // obsah palety (volá se i při obnově panelu, aby se stavby odemkly, jakmile jdou postavit)
  function vykresliPaletu() {
    const pal = $('paleta'), co = pal.dataset.co;
    const z = P.zasoby(st.hra);
    const cena = d => Object.entries(d.mat).map(([druh, n]) => `${n} ${P.VECI[druh].ikona}` +
      `<small class="${(z[druh] || 0) >= n ? '' : 'spatne'}">(${z[druh] || 0})</small>`).join(' ');
    const tlacitko = typ => {
      const d = ST.STAVBY[typ], proc = ST.dostupnost(st.hra, typ);
      return proc
        ? `<button data-n="stavba:${typ}" class="zamceno" disabled title="${d.popis} – ${proc}"><span>${d.ikona}</span><b>${d.nazev}</b><i>🔒 ${proc}</i></button>`
        : `<button data-n="stavba:${typ}" title="${d.popis}${d.sirka ? ` Zabere ${d.sirka} pole vedle sebe.` : ''}"><span>${d.ikona}</span><b>${d.nazev}${d.sirka ? ` <em class="sirka">↔ ${d.sirka} pole</em>` : ''}</b><i>${cena(d)}</i></button>`;
    };
    const html = co === 'stavba'
      ? ST.SKUPINY_STAVEB.map(g => `<h4 class="skupina">${g.ikona} ${g.nazev}</h4>` + g.typy.map(tlacitko).join('')).join('')
      : Object.entries(ST.ZONY).map(([typ, d]) => `<button data-n="zona:${typ}" title="${d.popis}"><span>${d.ikona}</span><b>${d.nazev}</b><i>${PRAVIDLA_ZON[typ] || ''}</i></button>`).join('') +
        `<button data-n="zona:zmensit" class="zmensit" title="Vyjmout pole ze zóny (táhni přes ně)"><span>✂️</span><b>zmenšit zónu</b><i>táhni přes pole, která vyjmout</i></button>`;
    if (pal.dataset.h !== html) { pal.innerHTML = html; pal.dataset.h = html; }
  }
  function nastavRychlost(r) {
    if (r) st.predPauzou = r;
    st.rychlost = r;
    for (const b of document.querySelectorAll('#rychlost button')) b.setAttribute('aria-pressed', +b.dataset.r === r);
    $('pauzaZnacka').hidden = r !== 0;
  }

  // --- smyčka -----------------------------------------------------------------------
  let chybaKresleni = false, chybaPanelu = false, posledniSnimek = 0, posledniCas = 0, akum = 0, posledniPanel = 0, stiskOd = 0;
  function prekresli() {
    infoTahu();
    if (st.sledovat && st.vybrany) {
      const t = st.hra.trpaslici.find(t => t.id === st.vybrany);
      if (t) {
        const q = G.polohaTrpaslika(t, st.alfa);
        if (PLYNULE) { zPohledu(); dojezd = true; }     // kamera za trpaslíkem dojíždí (krokKamery), neskáče
        setrv = null;
        kam.x = q.x - cv.width / kam.z / 2; kam.y = q.y - cv.height / kam.z / 2; omezKameru();
      }
    }
    const ted = performance.now(), dt = Math.min(0.1, (ted - (st.posledniKresba || ted)) / 1000);
    st.posledniKresba = ted;
    const p = { hora: st.hra.hora, znamo: st.hra.znamo, vseZnamo: st.vseZnamo, vyber: st.vybrany ? null : st.vyber,
                najeti: st.najeti, dpr, hra: st.hra, alfa: st.alfa, vybrany: st.vybrany, tah: st.tah, dt, nahled: nahledStavby(), zony: viditelneZony(), pauza: st.rychlost === 0, nastroj: st.nastroj, zvyrazni: st.zvyrazni };
    const k = kamKresby();
    G.kresli(ctx, p, k, snimek, (performance.now() - cas0) / 1000);
    G.kresliMinimapu(mctx, p, k, cv.width, cv.height);
    spinave = false;
  }
  function tahni(n) {                              // n tahů simulace naráz (pro testy a ladění)
    for (let k = 0; k < n; k++) HRA.krok(st.hra);
    spinave = true;
  }
  function smycka(t) {
    requestAnimationFrame(smycka);
    const dt = Math.min(250, t - (posledniCas || t)); posledniCas = t;
    if (st.hra && st.rychlost > 0 && !$('menu').open && !$('udalostOkno').open) {
      akum += dt * st.rychlost;
      let n = 0;
      try { while (akum >= TAH_MS && n < 40) { HRA.krok(st.hra); akum -= TAH_MS; n++; } }
      catch (e) { akum = 0; chybaSimulace(e); }
      if (n === 40) akum = 0;
      st.alfa = akum / TAH_MS;
      spinave = true;
    }
    if (t - posledniSnimek > 125) { posledniSnimek = t; snimek++; spinave = true; }
    if (st.hra) krokKamery(performance.now(), dt);
    if (st.hra) vyberZvuky();
    if (st.hra && t - (st.posledniHudba || 0) > 1000) { st.posledniHudba = t; Z.hudba((kam.y + cv.height / kam.z / 2) / S - UDOLI); }
    if (G.castice.length || G.animuje()) spinave = true;
    // panel se nepřekresluje, dokud hráč drží tlačítko myši mimo mapu: překreslení mezi stiskem a puštěním by klik zahodilo
    const drzi = stiskOd && t - stiskOd < 3000;
    if (st.hra && t - posledniPanel > 250 && !drzi) {
      posledniPanel = t;
      // výjimka v panelu nesmí vypnout události a konec hry: každý krok zvlášť, hráči ohlásit jednou
      for (const f of [() => obnovPanel(false), hlidejUdalost, hlidejKonec, () => { if ($('obchodOkno').open && !st.hra.karavana) $('obchodOkno').close(); }]) {
        try { f(); }
        catch (e) {
          console.error(e);
          if (!chybaPanelu) { chybaPanelu = true; oznam(`Chyba při obnově panelu (${String(e && e.message || e)}). Hra běží dál, některé údaje se nemusí ukazovat správně.`, true); }
        }
      }
    }
    if (!spinave || !st.hra) return;
    try { prekresli(); chybaKresleni = false; }
    catch (e) { if (!chybaKresleni) { chybaKresleni = true; console.error(e); } }
  }

  // kopání pod prahem Spáče (bez Klíče) ho probudí předčasně – nejdřív se zeptat; zrušení = nic se neoznačí
  function budiSpace(hra, r) {
    const y0 = Math.max(0, Math.min(r.y0, r.y1)), y1 = Math.min(H - 1, Math.max(r.y0, r.y1));
    const x0 = Math.max(0, Math.min(r.x0, r.x1)), x1 = Math.min(W - 1, Math.max(r.x0, r.x1));
    for (let y = y1; y >= y0 && PB.budiSpace(hra, y); y--)
      for (let x = x0; x <= x1; x++) if (P.lzeKopat(hra, y * W + x)) return true;
    return false;
  }
  function pouzijNastroj(r) {
    const hra = st.hra, [druh, typ] = r.druh.split(':');
    if ((druh === 'kopat' || druh === 'schody') && !r.potvrzeno && budiSpace(hra, r) && typeof Dialog !== 'undefined') {
      const hv = PB.hloubkaVarovani(hra);
      return Dialog.potvrd(`⚠️ Kopání hlouběji než ${hv.prah} m probudí Pradávného spáče – předčasně, dřív než klan ukove Klíč k Srdci. ` +
        'Ze Srdce hory vyleze obr, kterého porazí jen skupina ozbrojených strážců; ostatní trpaslíci před ním utečou. Opravdu tu kopat?',
        { ok: '⛏️ Kopat i tak', zrus: 'Zrušit' })
        .then(ano => { if (ano && st.hra === hra) pouzijNastroj(Object.assign({}, r, { potvrzeno: true })); });
    }
    if (druh === 'stavba') {
      const id0 = hra.dalsiId, n = ST.naplanujObdelnik(hra, typ, r.x0, r.y0, r.x1, r.y1);
      if (n && st.stavPrio) for (const p of hra.plany) if (p.id >= id0) p.prio = true;           // ⭐ s předností
      if (!n) oznam(`${ST.STAVBY[typ].nazev}: ${ST.prekazka(hra, typ, r.y0 * W + r.x0) || 'sem to nejde'}`, true);
    } else if (druh === 'zona') {
      if (typ === 'zmensit') ST.zrusZonu(hra, r.x0, r.y0, r.x1, r.y1);
      else if (!ST.novaZona(hra, r.x0, r.y0, r.x1, r.y1, typ, 'vse'))
        oznam(typ === 'sklad' ? 'Sklad jde jen na prozkoumanou volnou podlahu, která ještě není v jiné zóně.'
          : typ === 'pole' || typ === 'les' ? `${ST.ZONY[typ].nazev[0].toUpperCase() + ST.ZONY[typ].nazev.slice(1)} jde jen venku na hlínu nebo jíl (ne na balvany a stavby).`
          : typ === 'houbarna' ? 'Houbárna jde jen pod zem na pevnou podlahu.'
          : 'Místnost jde jen do prozkoumaného volného prostoru pod zemí.', true);
      else { st.vybrany = 0; st.vyber = { x: r.x0, y: r.y0 }; }
    } else if (druh === 'zrusit') {
      P.oznac(hra, r.x0, r.y0, r.x1, r.y1, 'zrusit');
      HRA.zrusPlany(hra, r.x0, r.y0, r.x1, r.y1);
    } else { P.oznac(hra, r.x0, r.y0, r.x1, r.y1, druh); if (druh === 'prio') HRA.prioPlanu(hra, r.x0, r.y0, r.x1, r.y1); }
    obnovPanel(true);
  }

  // --- ovládání ---------------------------------------------------------------------
  function napojOvladani() {
    // stisk mimo mapu (panel, lišta, menu, dialogy) pozdrží periodické překreslení panelu, viz smycka
    document.addEventListener('pointerdown', e => { if (e.target !== cv) stiskOd = performance.now(); }, true);
    // tlačítko kliknuté myší nesmí držet fokus (zkratky by pak psaly do něj); fokus z klávesnice zůstává
    document.addEventListener('click', e => {
      if (e.detail === 0) return;                                  // Enter/mezerník na tlačítku = klávesnice
      const b = e.target instanceof Element && e.target.closest('#panel button, #panel [role=button], #panel summary, .lista button, #nastroje button, #paleta button, .zoom button, .mapa-akce button');
      if (b && !b.closest('dialog') && document.activeElement === b) b.blur();
    });
    const pustil = () => setTimeout(() => { stiskOd = 0; }, 0);   // až po události click
    document.addEventListener('pointerup', pustil, true);
    document.addEventListener('pointercancel', pustil, true);
    // poloha v CSS px na plátně; offsetX nepoužívat – syntetické události ho při DPI ≠ 1 v Chromiu počítají špatně
    const bod = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const ukazatele = new Map();
    let tah = null, stipnuti = null;
    cv.addEventListener('contextmenu', e => e.preventDefault());
    for (const ud of ['pointerdown', 'keydown']) window.addEventListener(ud, () => Z.probud(), { passive: true });
    $('zvukZap').checked = Z.nast.zvuk; $('hudbaZap').checked = Z.nast.hudba; $('hlasitost').value = Math.round(Z.nast.hlasitost * 100);
    $('zvukZap').onchange = e => Z.nastav('zvuk', e.target.checked);
    $('hudbaZap').onchange = e => Z.nastav('hudba', e.target.checked);
    $('hlasitost').oninput = e => Z.nastav('hlasitost', e.target.value / 100);
    cv.addEventListener('pointerdown', e => {
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* syntetická událost */ }
      zastavKameru();                                 // další dotyk zastaví setrvačnost i dojezd
      const q = bod(e);
      ukazatele.set(e.pointerId, q);
      if (ukazatele.size === 1) {
        // s nástrojem se kreslí levým tlačítkem / jedním prstem; pravým tlačítkem se posouvá pohled, pravý klik vrátí nástroj „pohled"
        const kresli = st.nastroj !== 'pohled' && (e.button === 0 || e.pointerType !== 'mouse');
        const p = poleZBodu(q.x, q.y);
        tah = { x: q.x, y: q.y, kx: kam.x, ky: kam.y, posunuto: false, kresli, prave: e.pointerType === 'mouse' && e.button === 2,
                stopa: [{ t: performance.now(), x: q.x, y: q.y }] };   // stopa posledních bodů → rychlost pro setrvačnost
        if (kresli) st.tah = { x0: p.x, y0: p.y, x1: p.x, y1: p.y, druh: st.nastroj };
      } else if (ukazatele.size === 2) {
        const [a, b] = [...ukazatele.values()];
        stipnuti = { d: Math.hypot(a.x - b.x, a.y - b.y), uroven: Math.round(kam.z / dpr), sx: (a.x + b.x) / 2, sy: (a.y + b.y) / 2 };
        st.tah = null;
        if (tah) { tah.posunuto = true; tah.kresli = false; }
      }
      spinave = true;
    });
    cv.addEventListener('pointermove', e => {
      const q = bod(e);
      if (!ukazatele.has(e.pointerId)) {
        if (e.pointerType === 'mouse') {
          const p = poleZBodu(q.x, q.y);
          if (!st.najeti || st.najeti.x !== p.x || st.najeti.y !== p.y) { st.najeti = p; spinave = true; }
        }
        return;
      }
      ukazatele.set(e.pointerId, q);
      if (ukazatele.size === 2 && stipnuti) {
        const [a, b] = [...ukazatele.values()];
        const cil = Math.round(stipnuti.uroven * Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, stipnuti.d));
        const sx = (a.x + b.x) / 2, sy = (a.y + b.y) / 2;
        zoomuj(cil - Math.round(kam.z / dpr), sx * dpr, sy * dpr, true);
        kam.x -= (sx - stipnuti.sx) * dpr / kam.z; kam.y -= (sy - stipnuti.sy) * dpr / kam.z;
        stipnuti.sx = sx; stipnuti.sy = sy; st.sledovat = false; omezKameru();
        return;
      }
      if (!tah) return;
      const dx = q.x - tah.x, dy = q.y - tah.y;
      if (!tah.posunuto && Math.hypot(dx, dy) > 6) { tah.posunuto = true; if (!tah.kresli) cv.classList.add('tazeni'); }
      if (tah.kresli) {
        const p = poleZBodu(q.x, q.y);
        if (st.tah && (st.tah.x1 !== p.x || st.tah.y1 !== p.y)) { st.tah.x1 = p.x; st.tah.y1 = p.y; spinave = true; }
      } else if (tah.posunuto) {
        kam.x = tah.kx - dx * dpr / kam.z; kam.y = tah.ky - dy * dpr / kam.z; st.sledovat = false; omezKameru();
        const ted = performance.now();
        tah.stopa.push({ t: ted, x: q.x, y: q.y });
        while (tah.stopa.length > 2 && ted - tah.stopa[0].t > 100) tah.stopa.shift();
      }
    });
    // setrvačnost: rychlost z posledních ~100 ms tažení; kdo se před puštěním zastavil (nebo syntetické
    // události ve stejném okamžiku), nic nedoklouže
    const pustSetrvacne = stopa => {
      if (!PLYNULE || !stopa || stopa.length < 2) return;
      const a = stopa[0], b = stopa[stopa.length - 1], ted = performance.now(), dt = b.t - a.t;
      if (dt < 12 || ted - b.t > 60) return;
      let vx = (b.x - a.x) / dt, vy = (b.y - a.y) / dt;               // CSS px za ms
      const v = Math.hypot(vx, vy), MAX = 4;
      if (v < 0.15) return;
      if (v > MAX) { vx *= MAX / v; vy *= MAX / v; }
      setrv = { vx: -vx * dpr / kam.z, vy: -vy * dpr / kam.z };
    };
    const konec = e => {
      if (!ukazatele.has(e.pointerId)) return;
      ukazatele.delete(e.pointerId);
      if (ukazatele.size < 2) stipnuti = null;
      if (ukazatele.size === 0) {
        // pravý klik (bez tažení) s nástrojem nebo otevřenou paletou → zpět na pohled
        if (tah && tah.prave && !tah.posunuto && e.type === 'pointerup' && (st.nastroj !== 'pohled' || !$('paleta').hidden)) {
          nastav('pohled'); st.tah = null; tah = null; cv.classList.remove('tazeni'); spinave = true; return;
        }
        if (tah && tah.posunuto && !tah.kresli && e.type === 'pointerup') pustSetrvacne(tah.stopa);
        if (tah && tah.kresli && st.tah && e.type === 'pointerup') pouzijNastroj(st.tah); else if (tah && !tah.posunuto && e.type === 'pointerup') {
          const q = bod(e), p = poleZBodu(q.x, q.y);
          const t = trpaslikNa(p);
          st.sledovat = false;
          const b_ = st.hra.hora.brana;
          if (st.hra.karavana && !t && p.y >= b_.y - 1 && p.y <= b_.y && p.x >= b_.x - 7 && p.x <= b_.x - 4) { otevriObchod(); st.tah = null; tah = null; return; }
          // druhé klepnutí na už vybraného trpaslíka vybere pole pod ním (dílnu, zónu…)
          if (t && st.vybrany !== t.id) st.vybrany = t.id;
          else { st.vybrany = 0; st.vyber = p; }
          obnovPanel(true);
        }
        st.tah = null; tah = null; cv.classList.remove('tazeni'); spinave = true;
      }
    };
    cv.addEventListener('pointerup', konec);
    cv.addEventListener('pointercancel', konec);
    cv.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && st.najeti) { st.najeti = null; spinave = true; } });
    cv.addEventListener('wheel', e => { e.preventDefault(); setrv = null; const q = bod(e); zoomuj(e.deltaY < 0 ? 1 : -1, q.x * dpr, q.y * dpr, true); }, { passive: false });
    mini.addEventListener('click', e => {
      const r = mini.getBoundingClientRect();
      st.sledovat = false;
      setrv = null;
      vystred(Math.floor((e.clientX - r.left) / r.width * W), Math.floor((e.clientY - r.top) / r.height * H), true);
    });
    $('btnPlus').onclick = () => zoomuj(1, null, null, true);
    $('btnMinus').onclick = () => zoomuj(-1, null, null, true);
    $('btnBrana').onclick = naBranu;
    for (const b of document.querySelectorAll('#nastroje button'))
      b.onclick = () => (b.dataset.n === 'stavba' || b.dataset.n === 'zona') ? ukazPaletu(b.dataset.n) : nastav(b.dataset.n);
    $('paleta').addEventListener('click', e => { const b = e.target.closest('button'); if (b && !b.disabled) nastav(b.dataset.n); });
    // tlačítka v panelu vybraného pole
    $('info').addEventListener('click', e => {
      const b = e.target.closest('[data-akce]'); if (!b || b.tagName === 'SELECT' || b.disabled) return;
      const hra = st.hra, a = b.dataset.akce;
      if (a.startsWith('filtr-') || a === 'sklad-prio') {
        const z = hra.zony.find(z => z.id === +b.dataset.zona); if (!z) return;
        const set = ST.prijimaneDruhy(z);
        if (a === 'filtr-vse') ST.nastavFiltr(z, null);
        else if (a === 'filtr-nic') ST.nastavFiltr(z, []);
        else if (a === 'sklad-prio') z.prio = !z.prio;
        else if (a === 'filtr-druh') { const d = b.dataset.d; if (set.has(d)) set.delete(d); else set.add(d); ST.nastavFiltr(z, [...set]); }
        else if (a === 'filtr-sk') {
          const g = ST.SKUPINY[b.dataset.sk].druhy, vsechny = g.every(d => set.has(d));
          for (const d of g) { if (vsechny) set.delete(d); else set.add(d); }
          ST.nastavFiltr(z, [...set]);
        }
        obnovPanel(true); return;
      }
      if (a === 'zakazka' || a === 'udrzuj') HRA.pridejZakazku(hra, hra.dilny.find(d => d.id === +b.dataset.dilna), +b.dataset.r, +b.dataset.n, a === 'udrzuj');
      else if (a === 'zrus-zakazku') HRA.zrusZakazku(hra, hra.dilny.find(d => d.id === +b.dataset.dilna), +b.dataset.id);
      else if (a === 'zakazka-nahoru') HRA.posunZakazku(hra.dilny.find(d => d.id === +b.dataset.dilna), +b.dataset.id, -1);
      else if (a === 'mriz') HRA.prepniMriz(hra, +b.dataset.i);
      else if (a === 'plan-prio') { const i = +b.dataset.i; HRA.prioPlanu(hra, i % W, i / W | 0, i % W, i / W | 0); }
      else if (a === 'zrus-plan') { const i = +b.dataset.i; HRA.zrusPlany(hra, i % W, i / W | 0, i % W, i / W | 0); }
      else if (a === 'cil-farmy') {
        const z = hra.zony.find(z => z.id === +b.dataset.zona); if (!z) return;
        const c = ST.cilFarmy(hra, z);
        ST.nastavCilFarmy(z, b.dataset.o === 'auto' ? null : Math.max(0, c.cil + +b.dataset.o));
      }
      else if (a === 'zrus-zonu') { const id = +b.dataset.zona; for (let i = 0; i < hra.zona.length; i++) if (hra.zona[i] === id) hra.zona[i] = 0; ST.uklidZony(hra); }
      obnovPanel(true); spinave = true;
    });
    // dlouhý stisk na dotykovém displeji vyvolá contextmenu – ten stupeň potichu snižovat nesmí
    let typUkazatele = 'mouse';
    $('panel').addEventListener('pointerdown', e => { typUkazatele = e.pointerType || 'mouse'; }, true);
    const stupenKlik = zpet => e => {
      const b = e.target.closest('button.prepinac'); if (!b) return;
      if (zpet) { e.preventDefault(); if (typUkazatele === 'touch') return; }
      const t = st.hra.trpaslici.find(t => t.id === +b.dataset.id); if (!t) return;
      nastavStupen(st.hra, t, b.dataset.k, dalsiStupen(t.povoleno[b.dataset.k] || 0, zpet));
      obnovPanel(true);
    };
    const pracovisteZmena = e => {
      const sel = e.target.closest('select[data-id]'); if (!sel) return;
      const t = st.hra.trpaslici.find(t => t.id === +sel.dataset.id); if (!t) return;
      HRA.nastavDilnu(st.hra, t, sel.value || null);
      sel.blur(); obnovPanel(true);
    };
    for (const id of ['klan', 'info']) {                  // karta v klanu i detail trpaslíka
      $(id).addEventListener('click', stupenKlik(false));
      $(id).addEventListener('contextmenu', stupenKlik(true));
      $(id).addEventListener('change', pracovisteZmena);
    }
    const stupenVsem = zpet => e => {                       // všem stejný stupeň (další / předchozí od většinového)
      const pv = e.target.closest('button[data-predvolba]');
      if (pv && !zpet) {
        for (const t of st.hra.trpaslici) {
          const v = pv.dataset.predvolba === 'profese' ? HRA.vychoziStupne(t.prof) : { kopat: 2, kacet: 2, stavet: 2, nosit: 2, pole: 2, remeslo: 2, hlidat: t.povoleno.hlidat };
          for (const k of Object.keys(v)) nastavStupen(st.hra, t, k, v[k]);
        }
        obnovPanel(true); return;
      }
      const b = e.target.closest('button.prepinac'); if (!b) return;
      if (zpet) { e.preventDefault(); if (typUkazatele === 'touch') return; }
      const k = b.dataset.k, s = dalsiStupen(vetsinovyStupen(st.hra, k), zpet);
      for (const t of st.hra.trpaslici) nastavStupen(st.hra, t, k, s);
      obnovPanel(true);
    };
    $('praceVse').addEventListener('click', stupenVsem(false));
    document.querySelector('.predvolby').addEventListener('click', stupenVsem(false));
    $('praceVse').addEventListener('contextmenu', stupenVsem(true));
    $('prehledZasob').open = sekceOtevrena('zasoby');
    $('prehledZasob').addEventListener('toggle', () => { zapamatujSekci('zasoby', $('prehledZasob').open); obnovPanel(true); });
    $('bilance').addEventListener('toggle', e => { const d = e.target; if (d.dataset && d.dataset.sekce) zapamatujSekci(d.dataset.sekce, d.open); }, true);
    for (const b of document.querySelectorAll('#rychlost button')) b.onclick = () => nastavRychlost(+b.dataset.r);
    $('klan').addEventListener('click', e => {
      if (e.target.closest('.detail-odkaz')) { zalozka('vyber'); return; }
      const b = e.target.closest('.clen'); if (!b) return;
      st.vybrany = +b.dataset.id; st.sledovat = true; st.tichyVyber = true;   // ze seznamu: záložka Klan zůstane
      if (e.detail >= 2) { zalozka('vyber'); return; }                       // dvojklik = detail (karta se mezi kliky překreslí, proto e.detail)
      obnovPanel(true); spinave = true;
    });
    $('nastrojInfo').addEventListener('click', e => {
      if (!e.target.closest('[data-akce=stavet-prio]')) return;
      st.stavPrio = !st.stavPrio; $('nastrojInfo').dataset.h = ''; nastav(st.nastroj); spinave = true;
    });
    $('denik').addEventListener('click', e => { const li = e.target.closest('li[data-i]'); if (li) ukazMisto(+li.dataset.i); });
    $('denik').addEventListener('keydown', e => {
      const li = e.target.closest('li[data-i]'); if (!li || (e.key !== 'Enter' && e.key !== ' ')) return;
      e.preventDefault(); ukazMisto(+li.dataset.i);
    });
    $('klanFiltr').addEventListener('click', e => {
      if (e.target.closest('button[data-vybava]')) { st.ukazVybavu = !st.ukazVybavu; obnovPanel(true); return; }
      const b = e.target.closest('button[data-filtr]'); if (!b || b.disabled) return;
      st.filtrKlanu = b.dataset.filtr; obnovPanel(true);
    });
    // rozbalení oddílů detailu (nálada, dovednosti) si panel pamatuje
    $('info').addEventListener('toggle', e => { const d = e.target; if (d.dataset && d.dataset.pamet) st.rozbaleno[d.dataset.pamet] = d.open; }, true);

    window.addEventListener('keydown', e => {
      // zkratky nesmí rozbíjet ovládací prvky: pole formulářů je ignorují, šipky na záložkách patří záložkám;
      // Enter a mezerník na tlačítku (nebo prvku s role=button) ho stisknou
      const el = e.target instanceof Element ? e.target : null;
      if (el && (/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) || el.isContentEditable)) return;
      if (el && el.closest('[role=tablist]') && /^(Arrow|Home$|End$)/.test(e.key)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if ($('menu').open || document.querySelector('dialog[open]')) return;
      if (el && (el.tagName === 'BUTTON' || el.matches('[role=button],summary,a[href]')) && (e.key === ' ' || e.key === 'Enter')) return;
      const krok = 4 * S;
      const posun = { ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0], ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1] }[e.key];
      if (posun) {                                    // šipky: kam se posune hned, pohled k němu dojede
        e.preventDefault(); st.sledovat = false; setrv = null;
        if (PLYNULE) { zPohledu(); dojezd = true; }
        kam.x += posun[0] * krok; kam.y += posun[1] * krok; omezKameru(); return;
      }
      const k = e.key.toLowerCase();
      if (e.key === '+' || e.key === '=') zoomuj(1, null, null, true);
      else if (e.key === '-') zoomuj(-1, null, null, true);
      else if (e.key === 'Home') naBranu();
      else if (e.key === ' ') { if (el && el !== document.body && el !== cv && el.closest('#panel')) return; e.preventDefault(); nastavRychlost(st.rychlost ? 0 : st.predPauzou); }
      else if (e.key === '1' || e.key === '2' || e.key === '3') nastavRychlost([1, 2, 4][+e.key - 1]);
      else if (k === 'k') nastav('kopat');
      else if (k === 'l') nastav('schody');
      else if (k === 'p') nastav('prio');
      else if (k === 'x') nastav('zrusit');
      else if (k === 'c') nastav('kacet');
      else if (k === 'o') nastav('tesat');
      else if (k === 'b') ukazPaletu('stavba');
      else if (k === 'z') ukazPaletu('zona');
      else if (k === 'v' || e.key === 'Escape') { nastav('pohled'); st.tah = null; }
    });

    // události a obchod
    $('udalostVolby').addEventListener('click', e => { const b = e.target.closest('button'); if (b) vyresUdalost(+b.dataset.i); });
    $('udalostOkno').addEventListener('cancel', e => e.preventDefault());       // bez volby se okno nezavře
    $('btnKaravana').onclick = otevriObchod;
    $('btnPoplachZap').onclick = () => { HRA.prepniPoplach(st.hra); obnovPanel(true); };
    $('btnPoplach').onclick = () => {
      const u = (st.hra.tvorove || []).find(u => st.vseZnamo || st.hra.znamo[u.i]);
      if (u) { st.sledovat = false; vystred(u.i % W, u.i / W | 0); st.vyber = { x: u.i % W, y: u.i / W | 0 }; st.vybrany = 0; obnovPanel(true); }
    };
    // obchod: klik +1, Shift +10, Ctrl/⌘ vše; pravý klik −1 (Shift −10, Ctrl vrátit vše); klik v košíku vrací
    const krokObchodu = e => e.ctrlKey || e.metaKey ? 1e6 : e.shiftKey ? 10 : 1;
    $('obchodOkno').addEventListener('click', e => {
      const b = e.target.closest('button[data-s]'); if (!b || !st.hra.karavana) return;
      zmenObchod(b.dataset.s, b.dataset.d, (b.dataset.kos ? -1 : 1) * krokObchodu(e));
      vykresliObchod();
    });
    $('obchodOkno').addEventListener('contextmenu', e => {
      const b = e.target.closest('button[data-s]'); if (!b) return;
      e.preventDefault(); if (!st.hra.karavana) return;
      zmenObchod(b.dataset.s, b.dataset.d, -krokObchodu(e));
      vykresliObchod();
    });
    $('obchodVyrovnat').onclick = () => { doplnObchod(); vykresliObchod(); };
    $('obchodVycistit').onclick = () => { obchodVyber.nakup = {}; obchodVyber.prodej = {}; vykresliObchod(); };
    $('btnObchod').onclick = () => {
      const r = OB.obchod(st.hra, obchodVyber.nakup, obchodVyber.prodej);
      oznam(r.zprava, !r.ok);
      if (r.ok) { obchodVyber.nakup = {}; obchodVyber.prodej = {}; }
      vykresliObchod(); obnovPanel(true);
    };
    $('obchodZavrit').onclick = () => $('obchodOkno').close();
    $('obchodOkno').addEventListener('close', () => { if (st.predObchodem) { nastavRychlost(st.predObchodem); st.predObchodem = 0; } });
    // menu
    const menu = $('menu');
    $('btnMenu').onclick = () => { $('celaHora').checked = st.vseZnamo; menu.showModal(); };
    $('menuZavrit').onclick = () => menu.close();
    const zacni = async seed => {
      menu.close();
      if (st.hra && st.hra.tik > HRA.TAHU_ZA_DEN && typeof Dialog !== 'undefined' &&
          !await Dialog.potvrd('Začít novou horu? Rozehraná hra se přepíše (ulož si ji případně do souboru).')) return;
      // jiná velikost: uložit volbu a načíst stránku znovu – nová hra začne po načtení (moduly si šířku berou při startu)
      const vel = (document.querySelector('input[name=velikost]:checked') || {}).value || HORA.VELIKOST;
      if (vel !== HORA.VELIKOST) {
        if (!znovuNacti([[KLIC_NOVA, JSON.stringify({ seed, rezim: $('rezimVolny') && $('rezimVolny').checked ? 'volny' : 'kampan' })], [KLIC_VELIKOST, vel]]))
          selhaloPrepnuti('Přepnutí velikosti hory');
        return;
      }
      novaHra(seed);
    };
    for (const r of document.querySelectorAll('input[name=velikost]')) r.checked = r.value === HORA.VELIKOST;
    $('btnExport').onclick = () => { exportuj(); menu.close(); };
    $('souborImport').onchange = e => { if (e.target.files[0]) importuj(e.target.files[0]); e.target.value = ''; menu.close(); };
    $('konecDal').onclick = () => { st.hra.konec.pokracovat = true; st.hra.rezim = 'volny'; $('konecOkno').close(); nastavRychlost(1); obnovPanel(true); };
    $('konecNova').onclick = () => { $('konecOkno').close(); menu.showModal(); };
    // prohlédnout horu: okno zavřít (hra zůstane v pauze), tlačítkem nad mapou se k němu jde vrátit
    $('konecProhlednout').onclick = () => { $('konecOkno').close(); $('btnKonec').hidden = false; };
    $('btnKonec').onclick = () => { $('btnKonec').hidden = true; $('konecOkno').showModal(); };
    $('konecOkno').addEventListener('cancel', e => e.preventDefault());
    // uložit při odchodu ze stránky
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') uloz(); });
    window.addEventListener('pagehide', uloz);
    $('btnNova').onclick = () => zacni((Math.random() * 4294967296) >>> 0);
    $('btnDne').onclick = () => zacni(T.nahoda.seedDne());
    $('btnSeed').onclick = () => { const s = $('seed').value.trim(); if (s) zacni(T.nahoda.seedZTextu(s)); };
    // odkaz na rozehranou horu: seed i velikost (stejný seed dá v jiné velikosti jinou horu)
    $('btnOdkaz').onclick = async () => {
      const url = location.href.split(/[?#]/)[0] + `?seed=${st.hra.seed}&velikost=${HORA.VELIKOST}`;
      try { await navigator.clipboard.writeText(url); oznam('Odkaz na horu je ve schránce: ' + url); }
      catch (e) { oznam('Odkaz na tuhle horu: ' + url); }
    };
    $('seed').addEventListener('keydown', e => { if (e.key === 'Enter') $('btnSeed').click(); });
    $('celaHora').onchange = e => { st.vseZnamo = e.target.checked; obnovPanel(true); spinave = true; };
    window.addEventListener('resize', velikost);
  }

  function vyplnLegendu() {
    const V = [['povrch', 'údolí, les, louka, potok'], ['0–20 m', MATERIAL[M.HLINA].nazev + ', ' + MATERIAL[M.JIL].nazev, M.HLINA],
      ['20–50 m', MATERIAL[M.VAPENEC].nazev + ', uhlí, krápníkové jeskyně', M.VAPENEC],
      ['50–90 m', MATERIAL[M.ZULA].nazev + ', železo, měď', M.ZULA],
      ['90–130 m', MATERIAL[M.CEDIC].nazev + ', stříbro, drahokamy, houby, jezero, ruiny předků', M.CEDIC],
      ['130–160 m', MATERIAL[M.HLUBINNY].nazev + ', magma, hvězdná ruda, Srdce hory', M.HLUBINNY]];
    $('vrstvy').innerHTML = V.map(([a, b, m]) =>
      `<tr><td>${a}</td><td>${m != null ? `<span class="vzorek" style="background:${MATERIAL[m].mini}"></span>` : '🌲 '}${b}</td></tr>`).join('');
    $('cepiceLegenda').innerHTML = legendaCepic();
    $('rudy').innerHTML = Object.keys(RUDA).map(k => RUDA[k]).map(d =>
      `<span><span class="vzorek" style="background:${d.mini}"></span>${d.nazev}</span>`).join('');
  }

  function start() {
    cv = $('mapa'); ctx = cv.getContext('2d');
    mini = $('minimapa'); mctx = mini.getContext('2d');
    velikost();
    // styl grafiky (pamatuje se v prohlížeči)
    const ulozeny = uloziste.cti(KLIC_GRAFIKA), styl = ulozeny === 'jemny' || ulozeny === 'hladky' ? ulozeny : 'klasicky';
    G.nastavStyl(styl);
    for (const r of document.querySelectorAll('input[name=grafika]')) {
      r.checked = r.value === styl;
      r.onchange = () => { if (r.checked) nastavGrafiku(r.value); };
    }
    napojEfekty();
    napojOvladani();
    vyplnLegendu();
    // sbalitelné nápovědy (Klan: jak fungují stupně, barvy čepic): výchozí sbalené, stav si pamatuje prohlížeč
    for (const d of document.querySelectorAll('details[data-pamatuj]')) {
      const k = d.dataset.pamatuj;
      sekceOtevrena(k); d.open = sekceSkladu[k] === true;
      d.addEventListener('toggle', () => zapamatujSekci(k, d.open));
    }
    // horní lišta na úzkém displeji jde posouvat do strany – stín na okraji, kde ještě něco je
    const stav = document.querySelector('.lista .stav');
    const stin = () => {
      stav.classList.toggle('dal-vpravo', stav.scrollLeft + stav.clientWidth < stav.scrollWidth - 2);
      stav.classList.toggle('dal-vlevo', stav.scrollLeft > 2);
    };
    stav.addEventListener('scroll', stin, { passive: true }); window.addEventListener('resize', stin); stin(); setTimeout(stin, 400);
    // minimapa v poměru stran hory: plátno W × H, v CSS pevná výška a šířka auto (podle velikosti hory)
    mini.width = W; mini.height = H;
    for (const b of document.querySelectorAll('.zalozky button')) b.onclick = () => zalozka(b.dataset.zal);
    // záložky šipkami (vzor ARIA tabs): ←/→ další, Home/End krajní; fokus jde s výběrem
    document.querySelector('.zalozky').addEventListener('keydown', e => {
      const tl = [...document.querySelectorAll('.zalozky button')], k = tl.findIndex(b => b.dataset.zal === st.zalozka);
      const j = { ArrowLeft: k - 1, ArrowRight: k + 1, Home: 0, End: tl.length - 1 }[e.key];
      if (j === undefined) return;
      e.preventDefault();
      const b = tl[(j + tl.length) % tl.length]; zalozka(b.dataset.zal); b.focus();
    });
    $('hlaseni').onclick = e => { const b = e.target.closest('[data-hlaseni]'); if (b) akceHlaseni(b.dataset.hlaseni); };
    $('odkazJak').onclick = () => { zalozka('pomoc'); $('jak').open = true; };
    // jiná záložka ukládá stejnou hru → ukládání se navzájem přepisuje
    window.addEventListener('storage', e => {
      if (e.key !== KLIC_ULOZENI || !e.newValue || st.jinaZalozka || performance.now() - cas0 < 3000) return;   // hned po načtení: uložení odcházející stránky
      st.jinaZalozka = true;
      oznam('Tuhle hru má otevřenou i jiná záložka a právě ji uložila – uložení se navzájem přepisují. Hraj jen v jedné záložce.', true);
    });
    const naSklad = () => { zalozka('sklad'); const d = $('prehledZasob'); d.open = true; d.scrollIntoView({ block: 'nearest' }); };
    $('zasobyLista').onclick = naSklad;
    $('zasobyLista').onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); naSklad(); } };
    $('pozor').onclick = e => {
      const b = e.target.closest('button[data-pozor]'); const u = b && st.pozor && st.pozor[+b.dataset.pozor];
      if (!u || u.i === undefined) return;
      if (u.id) { st.vybrany = u.id; } else { st.vybrany = 0; st.vyber = { x: u.i % W, y: u.i / W | 0 }; }
      vystred(u.i % W, u.i / W | 0); obnovPanel(true);
    };
    const zal = uloziste.cti(KLIC_ZALOZKA);
    st.zalozka = ['prehled', 'klan', 'sklad', 'denik', 'pribeh', 'pomoc'].includes(zal) ? zal : 'prehled';   // Výběr bez výběru nemá smysl
    if (typeof Rekord !== 'undefined') {
      rekordy = {
        vitezstvi: Rekord.sleduj('webapp_hra_trpaslici_vitezstvi', { vyssiLepsi: false, popisek: '🔥 Nejrychlejší vítězství', format: v => `${v}. den` }),
        hloubka: Rekord.sleduj('webapp_hra_trpaslici_hloubka', { popisek: '⛏️ Nejhlubší šachta', format: v => `${v} m` }),
        slava: Rekord.sleduj('webapp_hra_trpaslici_slava', { popisek: '⭐ Nejvyšší sláva', format: v => String(v) }),
      };
      rekordy.vitezstvi.prvek($('rekordVitezstvi')); rekordy.hloubka.prvek($('rekordHloubka')); rekordy.slava.prvek($('rekordSlava'));
    }
    const q = new URLSearchParams(location.search);
    st.vseZnamo = q.has('ladeni');
    const seed = q.get('seed') != null ? T.nahoda.seedZTextu(q.get('seed'))
      : uloziste.cti(KLIC_SEED) != null ? Number(uloziste.cti(KLIC_SEED)) >>> 0
      : (Math.random() * 4294967296) >>> 0;
    let ulozena = null, chybaNacteni = null;
    const text = uloziste.cti(KLIC_ULOZENI);
    // nová hora jiné velikosti (stránka se kvůli ní znovu načetla): začít ji, rozehranou hráč přepsat potvrdil
    const nova = (() => { try { return JSON.parse(uloziste.cti(KLIC_NOVA) || 'null'); } catch (e) { return null; } })();
    if (nova) { try { localStorage.removeItem(KLIC_NOVA); } catch (e) { /* nic */ } }
    let poImportu = false;                          // stránka se načetla kvůli importu hory jiné velikosti
    try { poImportu = !!sessionStorage.getItem(KLIC_PREPNUTI + '_import'); sessionStorage.removeItem(KLIC_PREPNUTI + '_import'); } catch (e) { /* nic */ }
    if (text && !nova) {
      try { ulozena = U.obnov(text); }
      catch (e) {
        // uložená hora jiné velikosti: přepnout velikost a načíst znovu (jen jednou – když už sedí, je chyba jinde)
        const vel = e.sirka && Object.keys(HORA.VELIKOSTI).find(k => HORA.VELIKOSTI[k] === e.sirka);
        if (vel && vel !== HORA.VELIKOST && znovuNacti([[KLIC_VELIKOST, vel]])) return;
        chybaNacteni = e;
      }
    }
    // nečitelné uložení nepřepsat: kopie do zálohy, nová hora se neukládá, dokud hráč nerozhodne
    // po importu je v záloze předchozí rozehraná hra – nepřepsat ji nečitelným souborem
    if (chybaNacteni) { if (!poImportu) uloziste.pis(KLIC_ULOZENI + '_zaloha', text); st.bezUkladani = 'nacteni'; }
    // odkaz s ?velikost= jiné velikosti: nová hora té velikosti (přes přenačtení, pojistka proti smyčce je ve znovuNacti);
    // rozehranou hru nejdřív potvrdit (níže), bez ní rovnou
    const velUrl = HORA.VELIKOSTI[q.get('velikost')] ? q.get('velikost') : null, jinaVel = !!velUrl && velUrl !== HORA.VELIKOST && !nova;
    const prepniVelikost = () => znovuNacti([[KLIC_NOVA, JSON.stringify({ seed, rezim: 'kampan' })], [KLIC_VELIKOST, velUrl]]);
    if (jinaVel && !ulozena && !chybaNacteni && prepniVelikost()) return;
    if (ulozena) zacniHru(ulozena); else if (nova) novaHra(nova.seed >>> 0, nova.rezim); else novaHra(seed);
    nastav('pohled'); if (ulozena) nastavRychlost(1);
    zalozka(st.zalozka);
    if (chybaNacteni && poImportu) {
      zalozka('prehled');
      ukazHlaseni(`⚠️ Importovanou hru se nepodařilo načíst (${String(chybaNacteni.message).replace(/[<&]/g, '')}). Předchozí rozehraná hra je zálohovaná v prohlížeči; nová hora se zatím neukládá.`,
        [['↺ Vrátit předchozí hru', 'vratZalohu'], ['💾 Stáhnout zálohu', 'zaloha'], ['▶ Hrát novou horu a ukládat', 'pokracuj']]);
      oznam('Importovanou hru se nepodařilo načíst – předchozí hra je v záloze, viz Přehled.', true);
    } else if (chybaNacteni) {
      zalozka('prehled');
      ukazHlaseni(`⚠️ Uloženou hru se nepodařilo načíst (${String(chybaNacteni.message).replace(/[<&]/g, '')}). Původní data jsou zálohovaná v prohlížeči a nepřepíšou se; nová hora se zatím neukládá.`,
        [['💾 Stáhnout zálohu', 'zaloha'], ['▶ Hrát novou horu a ukládat', 'pokracuj']]);
      oznam('Uloženou hru se nepodařilo načíst – záloha zůstala, viz Přehled.', true);
    }
    // odkaz ?seed= (nebo &velikost=) na jinou horu než rozehraná: zeptat se, než se rozehraná hra přepíše
    if (ulozena && ((q.get('seed') != null && ulozena.seed !== seed) || jinaVel) && typeof Dialog !== 'undefined') {
      nastavRychlost(0);
      Dialog.potvrd(`Odkaz vede na jinou horu (${q.get('seed') != null ? 'seed ' + q.get('seed') : 'jiný seed'}${jinaVel ? `, velikost ${HORA.VELIKOSTI[velUrl]}` : ''}), ale v prohlížeči je rozehraná hora ${ulozena.hora.nazev} (den ${HRA.den(ulozena)}). ` +
        'Začít novou horu podle odkazu? Rozehraná hra se přepíše – případně si ji předtím ulož do souboru (☰).', { ok: 'Nová hora', zrus: 'Pokračovat v rozehrané' })
        .then(ano => {
          if (!ano) { nastavRychlost(st.predPauzou || 1); return; }
          if (jinaVel) { if (!prepniVelikost()) selhaloPrepnuti('Přepnutí velikosti hory'); return; }
          novaHra(seed);
        });
    }
    try { sessionStorage.removeItem(KLIC_PREPNUTI); } catch (e) { /* nic */ }   // start se povedl: pojistku proti smyčce vynulovat
    requestAnimationFrame(smycka);
  }

  T.ui = { st, kam, zalozka, nastavGrafiku, obchod: () => obchodVyber, viditelneZony, novaHra, zacniHru, uloz, otevriObchod, vyresUdalost, hlidejUdalost, hlidejKonec, prekresli, tahni, pouzijNastroj, ukazPaletu, zoomuj, vystred, naBranu, poleZBodu, nastav, nastavRychlost, obnovPanel,
           get platno() { return cv; }, get dpr() { return dpr; },
           get plynule() { return PLYNULE; }, set plynule(v) { PLYNULE = !!v; if (!PLYNULE) { srovnej(); setrv = null; spinave = true; } },
           get pohled() { return kamKresby(); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})(TRP);

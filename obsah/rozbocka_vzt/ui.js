/* Rozbočka pro vzduchotechniku – ovládání stránky nad gen3d/aplikace.js (historie, projekt, Moje…, sdílení, klávesy):
   tady formulář s živou odezvou, výpočet ve workeru, simulace, grafy, výkres, výsledky, export. */
/* global ROZB_VZT, ROZB_VZT_SIM, ROZB_VZT_GRAFY, ROZB_VZT_VYKRES, SPOJKY_NAHLED, KRAB, G3D, Dialog, TrubkyGui, THREE */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const R = ROZB_VZT, fmt = R.fmt;
  const cislo = s => { const x = Number(String(s).trim().replace(/\s/g, '').replace(',', '.')); return String(s).trim() === '' ? NaN : x; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  let p, wasm = null, model = null, chybaStavby = null, o = null;   // wasm = jádro připravené (ve workeru nebo zde)
  const FORMAT = 'webapp_rozbocka_vzt';
  const app = G3D.aplikace({
    typ: 'rozbocka_vzt', nazev: 'Rozbočky VZT', klic: 'webapp_rozbocka_vzt',
    get soubor() { return G3D.jmenoSouboru(R.popis(app.p), 'rozbocka', ''); },   // bez názvu soubor podle popisu dílu
    normalizuj: q => ({ p: R.normalizuj(q), hlaseni: [] }), vychozi: () => R.normalizuj({}),
    vezmi: R.cti, poloz: R.poloz,
    ulozProjekt: q => JSON.stringify({ format: FORMAT, verze: 1, ulozeno: new Date().toISOString(), projekt: q }, null, 2),
    nactiProjekt: t => {
      let d;
      try { d = JSON.parse(t); } catch (e) { throw new Error('Projekt nejde načíst: soubor není platný JSON.'); }
      if (!d || d.format !== FORMAT || !d.projekt) throw new Error('Projekt nejde načíst: soubor není projekt rozbočky VZT (chybí "format": "webapp_rozbocka_vzt").');
      return { p: R.normalizuj(d.projekt), hlaseni: [] };
    },
    popis: q => `${q.nazev || 'Rozbočka'} – ${R.popis(q)}`,
    formular: false,   // pole reagují už při psaní (input) – vlastní obsluha níž
    viditelnost: () => viditelnost(),
    prepocitej: () => naplanuj(),
    png: () => nahled.png(), pohled: j => nahled.pohled(j),
    exportStl: () => exportStl(),
    doModelare: async () => { const d = await dily(); return d ? { data: KRAB.soubor3mf(d, app.p.nazev || 'Rozbočka'), pripona: '.3mf' } : null; },
    // P = simulace proudění (převisy V) a skrytá volba se klávesou nespouští – vlastní obsluha níž
    zkratky: { r: 'tRez', l: 'tPravitka', w: 'btnVykres', m: 'tTisk', d: 'tDuchove', v: 'tPrevisy', h: 'tHrany' },
  });
  const zmen = (f, sl) => app.zmen(f, sl), nahrad = q => app.nahrad(q), naplnFormular = () => app.naplnFormular();

  /* ---------- formulář ---------- */
  const pole = [...document.querySelectorAll('[data-p]')];
  /** Ukáže jen to, co ke zvolenému dílu patří ([data-pro] = seznam dílů). */
  function viditelnost() {
    p = app.p;
    for (const el of document.querySelectorAll('[data-pro]')) el.hidden = !el.dataset.pro.split(' ').includes(p.dil);
    for (const el of document.querySelectorAll('[data-uchyt]')) el.hidden = !el.dataset.uchyt.split(' ').includes(p.uchyty.typ);
    document.querySelectorAll('[data-uchyt-volba]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.uchytVolba === p.uchyty.typ)));
    document.querySelectorAll('[data-zebro-volba]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.zebroVolba === p.zpevneni.typ)));
    for (const el of document.querySelectorAll('[data-zebro]')) el.hidden = !p.zpevneni.zebra;
    for (const el of document.querySelectorAll('[data-zebro-typ]')) el.hidden = !p.zpevneni.zebra || el.dataset.zebroTyp !== p.zpevneni.typ;
    for (const el of document.querySelectorAll('[data-hlava]')) el.hidden = el.dataset.hlava.split(' ').indexOf(p.uchyty.hlava) < 0 || p.uchyty.typ === 'zadne' || p.uchyty.typ === 'zavesy';
    $('lHlD').firstChild.textContent = p.uchyty.hlava === 'matice' ? 'Matice přes plochy ' : 'Průměr hlavy ';
    const hl = R.hlavaRozmery(p.uchyty);
    $('pHlava').textContent = { kuzel: `Zahloubení 90° do Ø ${fmt(2 * hl.r, 1)} mm – hlava vrutu nebo zápustného šroubu zapadne do roviny.`,
      valec: `Válcové zahloubení Ø ${fmt(2 * hl.r, 1)} × ${fmt(hl.h, 1)} mm pro šroub s válcovou hlavou (imbus).`,
      matice: `Šestihran ${fmt(hl.s, 1)} mm přes plochy (s vůlí), hloubka ${fmt(hl.h, 1)} mm – matice se zasune a nepootočí se.`,
      zadna: 'Bez zahloubení – hlava (nebo podložka) leží na povrchu úchytu.' }[p.uchyty.hlava];
    if (p.dil !== 'rozbocka' && sim && sim.zap) $('tSim').click();
    const akt = document.querySelector('[data-zalozka][aria-selected="true"]');
    if (akt && akt.hidden) TrubkyGui.otevriZalozku('vysledky');
  }
  document.querySelectorAll('[data-uchyt-volba]').forEach(b => b.addEventListener('click', () => zmen(x => { x.uchyty.typ = b.dataset.uchytVolba; })));
  document.querySelectorAll('[data-zebro-volba]').forEach(b => b.addEventListener('click', () => zmen(x => { x.zpevneni.typ = b.dataset.zebroVolba; })));
  for (const el of pole) {
    const c = el.dataset.p;
    const akce = () => {
      el._posl = el.value;
      let h = el.type === 'checkbox' ? el.checked : el.value;
      if (el.type !== 'checkbox' && el.dataset.typ !== 'text') {
        h = cislo(el.value);
        el.classList.toggle('spatne', !Number.isFinite(h));
        if (!Number.isFinite(h)) return;
      }
      zmen(x => R.poloz(x, c, h), c);
    };
    el.addEventListener(el.tagName === 'SELECT' || el.type === 'checkbox' ? 'change' : 'input', akce);
    if (el.tagName === 'INPUT' && el.type !== 'checkbox' && el.dataset.typ !== 'text') {
      el.addEventListener('change', () => {
        if (el.value !== el._posl) akce();   // vložení bez psaní (automatické vyplnění, testy)
        const psano = cislo(el.value), h = R.cti(p, c), roz = R.MEZE[c];
        el.value = String(h).replace('.', ',');
        if (roz && Number.isFinite(psano) && Math.abs(psano - h) > 1e-9)
          Dialog.info(`${el.labels[0] ? el.labels[0].textContent.trim() : 'Hodnota'}: povoleno ${fmt(roz[0], 2)}–${fmt(roz[1], 2)}, použito ${fmt(h, 2)}.`);
      });
      el.addEventListener('keydown', e => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        const h = cislo(el.value); if (!Number.isFinite(h)) return;
        e.preventDefault();
        const krok = (e.shiftKey ? 10 : e.altKey ? 0.1 : 1) * (e.key === 'ArrowUp' ? 1 : -1);
        el.value = fmt(Math.round((h + krok) * 1000) / 1000, 3);
        el.dispatchEvent(new Event('input'));
      });
    }
  }

  /* ---------- výpočet: na pozadí ve workeru, když nejde, tady v hlavním vlákně ---------- */
  let worker = null, wasmZde = null, vLetu = false, znovu = false, dalsiId = 0, posledniQ = null;
  const cekajici = new Map();
  function spustWorker() {
    try { worker = new Worker('rozbocka_vzt/stavba_worker.js?v=771'); } catch (e) { worker = null; zalohaZde('Worker nejde spustit'); return; }
    worker.onmessage = e => {
      const d = e.data;
      if (d.start) { if (d.ok) { wasm = true; prepocitej(); } else zalohaZde(d.chyba); return; }
      const c = cekajici.get(d.id); if (!c) return;
      cekajici.delete(d.id); c(d);
    };
    worker.onerror = e => { e.preventDefault(); zalohaZde(e.message || 'chyba workeru'); };
  }
  /** Worker se nerozběhl – manifold se načte do stránky a počítá se tady (stránka při přepočtu na chvíli zamrzne). */
  function zalohaZde(duvod) {
    if (worker) { try { worker.terminate(); } catch (e) { /* už neběží */ } worker = null; }
    console.warn('Rozbočka VZT: výpočet v hlavním vlákně (' + duvod + ')');
    wasm = false;                 // jádro v hlavním vlákně se teprve načítá – do té doby nepočítat (wasmZde je null)
    for (const c of cekajici.values()) c(null);
    cekajici.clear(); vLetu = false;
    G3D.manifold().then(w => { wasmZde = w; wasm = true; prepocitej(); }).catch(e => {
      cekani(false);
      chybaStavby = 'Geometrické jádro (manifold-3d) se nenačetlo: ' + (e && e.message || e) + ' – model ani export nejsou k dispozici.';
      const st = $('stav3d'); st.textContent = chybaStavby; st.classList.add('chyba');
    });
  }
  /** Stejný výpočet jako worker, ale v hlavním vlákně. */
  function spoctiZde(q) {
    try { return spoctiZdeBezOchrany(q); } catch (e) { return { ok: false, o: null, H: [], chyba: String(e && e.message || e) }; }   // výjimka nesmí nechat přepočet viset
  }
  function spoctiZdeBezOchrany(q) {
    const t0 = performance.now(), o2 = R.odvozene(q), H = R.kontroly(q, o2);
    let sit = null, tisk = null, podpory = null, chyba = null;
    if (!H.some(h => h.uroven === 'chyba')) {
      try {
        sit = o2.spojka ? R.postavSpojku(wasmZde, q, o2) : R.postav(wasmZde, q, o2);
        tisk = R.tiskova(sit, sit.orientace, q.tisk.previs, sit.roviny);
        sit.rez.tisk = R.tiskova(sit.rez, sit.orientace, q.tisk.previs, sit.roviny);
        if (q.podpory.zapnout && tisk.plochaPrevisu > 0) podpory = R.podpory(tisk, sit.idx, q.podpory);
      } catch (e) { chyba = String(e && e.message || e); sit = null; tisk = null; }
    }
    return { ok: true, o: o2, H, sit, tisk, podpory, chyba, cas: performance.now() - t0 };
  }
  function spocti(q) {
    if (worker) return new Promise(ok => { const id = ++dalsiId; cekajici.set(id, ok); worker.postMessage({ id, p: q }); });
    // v hlavním vlákně až po vykreslení čekacího kolečka
    return new Promise(ok => { const dal = () => ok(spoctiZde(q)); if (document.hidden) setTimeout(dal, 0); else requestAnimationFrame(() => setTimeout(dal, 0)); });
  }

  /* ---------- přepočet ---------- */
  const nahled = SPOJKY_NAHLED.vytvorNahled($('platno'));
  const sim = ROZB_VZT_SIM.vytvorSimulaci(nahled);
  /* zobrazení – jen pohodlí jednoho prohlížeče */
  const KLIC_ZOBR = 'webapp_rozbocka_vzt_zobrazeni';
  const zobr = Object.assign({ hrany: false, duchove: true, duch: 0.35, dil: 1, pravitka: false }, (() => { try { return JSON.parse(localStorage.getItem(KLIC_ZOBR)) || {}; } catch (e) { return {}; } })());
  const ulozZobr = () => { try { localStorage.setItem(KLIC_ZOBR, JSON.stringify(zobr)); } catch (e) { /* bez úložiště */ } };
  let dilPredSimulaci = null;
  nahled.prepni('hrany', zobr.hrany); $('tHrany').setAttribute('aria-pressed', String(zobr.hrany));
  nahled.prepni('duchove', zobr.duchove); $('tDuchove').setAttribute('aria-pressed', String(zobr.duchove));
  function pruhlednost() {
    $('rDuch').value = Math.round(zobr.duch * 100); $('oDuch').textContent = `${Math.round(zobr.duch * 100)} %`;
    $('rDil').value = Math.round(zobr.dil * 100); $('oDil').textContent = `${Math.round(zobr.dil * 100)} %`;
    nahled.pruhlednost(zobr.dil, zobr.duch);
  }
  $('rDuch').addEventListener('input', e => { zobr.duch = e.target.value / 100; ulozZobr(); pruhlednost(); });
  $('rDil').addEventListener('input', e => { zobr.dil = e.target.value / 100; dilPredSimulaci = null; ulozZobr(); pruhlednost(); });
  pruhlednost();
  let casovac = null, rez = false;
  function cekani(ano) { $('cekani').hidden = !ano; }
  function naplanuj() {
    // beze změny zadání (zpět po neúčinné změně, opakovaný „change“) nepočítat znovu
    if (model && !vLetu && posledniQ === JSON.stringify(app.p)) { clearTimeout(casovac); casovac = null; cekani(false); return; }
    clearTimeout(casovac); if (wasm) cekani(true); casovac = setTimeout(prepocitej, 180);
  }
  /** Přepočet: jeden výpočet naráz; když se mezitím změní zadání, výsledek se zahodí a spočítá se poslední stav. */
  function prepocitej() {
    p = app.p;
    if (!wasm) { cekani(true); return; }          // jádro se ještě načítá – přepočítá se, až bude připravené
    if (vLetu) { znovu = true; return; }
    vLetu = true; znovu = false; cekani(true);
    const q = R.kopie(p);
    spocti(q).then(v => {
      vLetu = false;
      if (znovu || !v) { prepocitej(); return; }
      if (JSON.stringify(q) !== JSON.stringify(p)) return;   // zadání se mezitím změnilo – čeká naplánovaný přepočet
      prevezmi(q, v);
    });
  }
  function prevezmi(q, v) {
    posledniQ = JSON.stringify(q);
    nahled.barvy(css('--border-strong'), css('--border'), '#000000', 0.6);   // obrysové hrany černé
    sim.tema(tmaveTema());
    o = v.o || { chyba: 'Výpočet selhal: ' + v.chyba };   // odvozene() spadlo – výpisy potřebují aspoň o.chyba
    const H = v.H || [];
    model = null; chybaStavby = null;
    if (!v.ok) { chybaStavby = 'Výpočet selhal: ' + v.chyba; H.push({ uroven: 'chyba', text: chybaStavby, pole: [] }); }
    else if (v.chyba) { chybaStavby = 'Těleso nejde sestavit: ' + v.chyba; H.push({ uroven: 'chyba', text: chybaStavby, pole: [] }); }
    else if (v.sit) {
      try {
        const sit = v.sit, tisk = v.tisk, ks = sit.ks || KRAB.kontrolaSite(sit.poz, sit.idx);
        model = Object.assign(sit, { tisk, ks, klic: `${q.dil}|${o.n}|${Math.round(4 * Math.log2(o.vyska))}` });
        model.rez.duchove = sit.duchove; model.rez.klic = model.klic;
        // odlomitelné podpory: díl se ukáže i s nimi (šedě) a jdou do exportu
        model.podpory = v.podpory;
        if (model.podpory && model.podpory.pocet) model.sPodporami = sPodporami(model, model.podpory, tisk);
        model.cas = v.cas;
        if (!ks.uzavrena) H.push({ uroven: 'chyba', text: 'Síť není uzavřená – export by nemusel jít vytisknout.', pole: [] });
        if (model.podpory && model.podpory.pocet) H.push({ uroven: 'info', text: `Odlomitelné podpory: ${model.podpory.pocet} sloupků pod ${fmt(tisk.plochaPrevisu, 0)} mm² převisů (mezera ${fmt(p.podpory.mezera, 2)} mm) – v náhledu šedě, exportují se s dílem.`, pole: ['podpory.zapnout'] });
        else if (p.podpory.zapnout) H.push({ uroven: 'info', text: tisk.plochaPrevisu > 0 ? 'Odlomitelné podpory: pod převisy se nevešel žádný sloupek – převisy jsou příliš nízko nad dílem nebo podložkou.' : 'Odlomitelné podpory: díl v této poloze nemá převisy – podpory nejsou potřeba.', pole: ['podpory.zapnout'] });
        else if (tisk.plochaPrevisu > 200) H.push({ uroven: 'varovani', text: `V tiskové poloze visí ${fmt(tisk.plochaPrevisu, 0)} mm² bez opory – zapněte odlomitelné podpory (záložka Tisk)${o.spojka ? '' : ', zkuste druhou orientaci nebo menší odklon'}.`, pole: ['podpory.zapnout'] });
      } catch (e) {
        chybaStavby = 'Těleso nejde sestavit: ' + (e && e.message || e);
        H.push({ uroven: 'chyba', text: chybaStavby, pole: [] });
      }
    }
    const st = $('stav3d');
    st.textContent = !wasm ? (chybaStavby || 'Načítám geometrické jádro…') : chybaStavby || (model ? '' : 'Model nelze sestavit – viz Kontrola.');
    st.classList.toggle('chyba', !!chybaStavby || (wasm && !model));
    zobrazModel();
    vypis(H);
    kresliPlan();
    sim.nastav(p, o); sim.rez(rez && o.kanaly ? o.kanaly[0].fi : null);
    if (aktivniZalozka() === 'proudeni') kresliProudeni();
    else krivka = null;
    cekani(false);
  }
  /** Díl i s podporami (třída 4 = šedá, v montážní i tiskové poloze – podpory se převedou zpět do montážních souřadnic). */
  function sPodporami(m, pod, tisk) {
    const n = m.poz.length / 3, spoj = (a, b) => { const c = new Float32Array(a.length + b.length); c.set(a); c.set(b, a.length); return c; };
    const idx = new Uint32Array(m.idx.length + pod.idx.length);
    idx.set(m.idx); for (let i = 0; i < pod.idx.length; i++) idx[m.idx.length + i] = pod.idx[i] + n;
    const tridy = new Uint8Array(idx.length / 3); tridy.set(tisk.tridy); tridy.fill(4, tisk.tridy.length);
    return { poz: spoj(m.poz, R.zTiskove(pod.poz, tisk)), idx, tisk: { poz: spoj(tisk.poz, pod.poz), tridy }, duchove: m.duchove, klic: m.klic };
  }
  function zobrazModel() {
    const sPodp = model && model.sPodporami && !rez;
    nahled.nastav(model ? (sPodp ? model.sPodporami : rez ? model.rez : model) : null);
    nahled.pruhlednost(zobr.dil, zobr.duch);
    sim.obnovViditelnost();
    $('legenda3d').hidden = !(model && (nahled.stav.tisk && nahled.stav.previsy || model.sPodporami));
    $('simLegenda').hidden = !(sim.zap && !nahled.stav.tisk && o && o.kanaly);
    kresliPravitka();
    if (!$('simLegenda').hidden) { $('simMin').textContent = '0'; $('simMax').textContent = `${fmt(sim.vmax, 1)} m/s`; }
    $('simLegenda').querySelector('i').style.background = `linear-gradient(90deg, ${(tmaveTema() ? ['#7a2a08', '#b8461a', '#eb6834', '#f39a6c', '#fcd9c4'] : ['#fcd9c4', '#f39a6c', '#eb6834', '#b8461a', '#7a2a08']).join(', ')})`;
  }
  /* ---------- pravítka: tři osy obalového kvádru zobrazeného dílu s dílky po mm ---------- */
  let pravitka = null;
  const hezkyKrok = x => [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500].find(k => k >= x) || 1000;
  function stitek(text, barva, vyska) {
    const c = document.createElement('canvas'), g = c.getContext('2d'), font = '600 44px system-ui, sans-serif';
    g.font = font; const w = Math.ceil(g.measureText(text).width) + 12; c.width = w; c.height = 60;
    g.font = font; g.fillStyle = barva; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, 32);
    const tx = new THREE.CanvasTexture(c); tx.minFilter = THREE.LinearFilter;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, depthTest: false, transparent: true }));
    sp.scale.set(vyska * w / 60, vyska, 1); sp.renderOrder = 7;
    return sp;
  }
  function kresliPravitka() {
    if (pravitka) {
      nahled.scena.remove(pravitka);
      pravitka.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) { if (c.material.map) c.material.map.dispose(); c.material.dispose(); } });
      pravitka = null;
    }
    $('tPravitka').setAttribute('aria-pressed', String(!!zobr.pravitka));
    if (!zobr.pravitka || !model) { nahled.prekresli(); return; }
    const m = model.sPodporami && !rez ? model.sPodporami : rez ? model.rez : model, P = nahled.stav.tisk ? m.tisk.poz : m.poz;
    const a = [Infinity, Infinity, Infinity], b = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) { a[k] = Math.min(a[k], P[i + k]); b[k] = Math.max(b[k], P[i + k]); }
    const vel = Math.max(b[0] - a[0], b[1] - a[1], b[2] - a[2]), off = vel * 0.07, hl = hezkyKrok(vel / 6), drobny = hl / (hl % 5 === 0 ? 5 : 2);
    const barva = css('--text') || '#888', body = [];
    const grp = new THREE.Group();
    /** pravítko z bodu O ve směru d (jednotkový) délky L, dílky ve směru t */
    const pravitko = (O, d, L, t, popisky) => {
      const bod = (s, k) => [O[0] + d[0] * s + t[0] * k, O[1] + d[1] * s + t[1] * k, O[2] + d[2] * s + t[2] * k];
      body.push(...bod(0, 0), ...bod(L, 0));
      for (let s = 0; s <= L + 1e-6; s += drobny) {
        const velky = Math.abs(s / hl - Math.round(s / hl)) < 1e-6, dl = velky ? off * 0.45 : off * 0.22;
        body.push(...bod(s, 0), ...bod(s, dl));
        if (velky) { const st = stitek(String(Math.round(s)), barva, off * 0.42); st.position.set(...bod(s, off * 0.85)); grp.add(st); }
      }
      const kon = bod(L, 0), st = stitek(popisky + ' ' + fmt(L, 1) + ' mm', barva, off * 0.42);
      st.position.set(kon[0] + d[0] * off * 1.4 + t[0] * off * 0.85, kon[1] + d[1] * off * 1.4 + t[1] * off * 0.85, kon[2] + d[2] * off * 1.4 + t[2] * off * 0.85); grp.add(st);
    };
    pravitko([a[0], a[1] - off, a[2]], [1, 0, 0], b[0] - a[0], [0, -1, 0], 'x');
    pravitko([b[0] + off, a[1], a[2]], [0, 1, 0], b[1] - a[1], [1, 0, 0], 'y');
    pravitko([a[0] - off, a[1] - off, a[2]], [0, 0, 1], b[2] - a[2], [-0.7071, -0.7071, 0], 'z');
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(body, 3));
    grp.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: new THREE.Color(barva) })));
    pravitka = grp; nahled.scena.add(grp); nahled.prekresli();
  }
  function tmaveTema() { const b = css('--bg'); const m = b.match(/\d+/g); if (b.startsWith('#')) { const v = parseInt(b.slice(1, 7), 16); return ((v >> 16) + ((v >> 8) & 255) + (v & 255)) / 3 < 128; } return m ? (+m[0] + +m[1] + +m[2]) / 3 < 128 : false; }
  const aktivniZalozka = () => { const b = document.querySelector('[data-zalozka][aria-selected="true"]'); return b ? b.dataset.zalozka : ''; };

  /* ---------- proudění: rozpis ztrát, grafy, varianty ---------- */
  const G = ROZB_VZT_GRAFY;
  let krivka = null;
  const tip = $('grafTip');
  function priNajeti(x, e) {
    grafy.forEach(gr => gr.kurzor(x));
    if (x == null) { tip.hidden = true; return; }
    const radky = [grafy[0].hodnoty(x), grafy[1].hodnoty(x)].filter(Boolean).flatMap(h => h.rady);
    tip.innerHTML = `<b>z = ${fmt(x, 0)} mm</b><br>` + radky.map(rr => `<i style="background:${rr.barva}"></i>${esc(rr.nazev)}: <b>${fmt(rr.y, 2)}</b> ${rr.nazev.startsWith('Rychlost') ? 'm/s' : 'Pa'}`).join('<br>');
    tip.hidden = false;
    tip.style.left = Math.min(innerWidth - tip.offsetWidth - 8, e.clientX + 14) + 'px'; tip.style.top = (e.clientY - tip.offsetHeight - 10) + 'px';
  }
  const zony = () => [{ x0: -p.vstup.delka, x1: 0, nazev: 'vstup' }, { x0: 0, x1: o.L, nazev: 'přechod' }, { x0: o.L, x1: o.L + p.vyvody.delka, nazev: 'vývody' }];
  const grafy = [
    G.vytvorGraf($('grafRychlost'), { titul: 'Střední rychlost vzduchu v kanálu', jednotkaX: 'mm', jednotkaY: 'm/s', desetinY: 1, zony }, priNajeti),
    G.vytvorGraf($('grafTlak'), { titul: 'Tlak vůči vstupu', jednotkaX: 'mm', jednotkaY: 'Pa', desetinY: 1, nula: true, zony }, priNajeti),
  ];
  const grafVar = G.vytvorGraf($('grafVarianty'), { titul: 'Tlaková ztráta podle délky přechodu', jednotkaX: 'přechod mm', jednotkaY: 'Pa', desetinY: 1 }, (x, e) => {
    if (x == null || !krivka) { tip.hidden = true; grafVar.kurzor(null); return; }
    grafVar.kurzor(x);
    const b = krivka.body.find(q => q.L === x);
    tip.innerHTML = `<b>přechod ${fmt(x, 0)} mm</b><br>ztráta ${fmt(b.dp, 2)} Pa · odklon ${fmt(b.odklon)}° · rozšíření ${fmt(b.rozsireni)}°<br>stěny ≈ ${fmt(b.objem / 1000 * p.tisk.material, 0)} g`;
    tip.hidden = false;
    tip.style.left = Math.min(innerWidth - tip.offsetWidth - 8, e.clientX + 14) + 'px'; tip.style.top = (e.clientY - tip.offsetHeight - 10) + 'px';
  });
  function kresliProudeni() {
    const q = o && o.proudeni;
    const v1 = css('--viz-1'), v2 = css('--viz-2');
    if (!q) {
      $('tabZtraty').innerHTML = ''; $('tabVarianty').innerHTML = '';
      grafy.forEach(gr => gr.nastav(null)); grafVar.nastav(null); krivka = null; return;
    }
    const nej = Math.max(...q.polozky.map(x => x.dp), 1e-9);
    $('tabZtraty').innerHTML = '<tr><th>Část</th><th class="c">Pa</th><th class="c">ζ</th><th>Podíl</th><th>Poznámka</th></tr>'
      + q.polozky.map(x => `<tr><td>${esc(x.nazev)}</td><td class="c">${fmt(x.dp, 2)}</td><td class="c">${fmt(x.zeta, 3)}</td>`
        + `<td class="c" style="text-align:left"><span class="podil" style="width:${Math.round(60 * x.dp / nej)}px"></span>${fmt(x.podil * 100, 0)} %</td><td class="pozn-t">${esc(x.pozn)}</td></tr>`).join('')
      + `<tr class="soucet"><td>Celkem</td><td class="c">${fmt(q.celkem, 2)}</td><td class="c">${fmt(q.zeta, 3)}</td><td></td><td class="pozn-t">jako ${fmt(q.ekvDelka, 2)} m rovné vstupní trubky</td></tr>`;
    const P = q.profil;
    grafy[0].nastav({ x: P.z, rady: [{ nazev: 'Rychlost', y: P.v, barva: v1 }] });
    grafy[1].nastav({ x: P.z, rady: [{ nazev: 'Ztráta celkového tlaku', kratce: 'celkový', y: P.ztrata.map(x => -x), barva: v1 }, { nazev: 'Statický tlak', kratce: 'statický', y: P.staticky, barva: v2 }] });
    krivka = R.krivkaDelky(p, o);
    if (!krivka) return;
    const akt = R.aktualniVarianta(p, krivka);
    grafVar.nastav({ x: krivka.body.map(b => b.L), rady: [{ nazev: 'Ztráta', y: krivka.body.map(b => b.dp), barva: v1 }],
      ymax: Math.max(...Object.values(krivka.varianty).map(b => b.dp), q.celkem) * 1.4,
      znacky: Object.entries(krivka.varianty).map(([k, b]) => ({ x: b.L, y: b.dp, nazev: R.VARIANTY[k].nazev })),
      svisle: [{ x: o.L, nazev: 'teď' }] });
    $('tabVarianty').innerHTML = '<tr><th>Varianta</th><th class="c">Přechod</th><th class="c">Ztráta</th><th class="c">Odklon / rozš.</th><th class="c">Stěny</th><th></th></tr>'
      + Object.entries(krivka.varianty).map(([k, b]) => `<tr class="${k === akt ? 'vybrana' : ''}"><td><b>${esc(R.VARIANTY[k].nazev)}</b><br><span class="pozn-t">${esc(R.VARIANTY[k].popis)}</span></td>`
        + `<td class="c">${fmt(b.L, 0)} mm</td><td class="c">${fmt(b.dp, 2)} Pa</td><td class="c">${fmt(b.odklon)}° / ${fmt(b.rozsireni)}°</td><td class="c">≈ ${fmt(b.objem / 1000 * p.tisk.material, 0)} g</td>`
        + `<td>${k === akt ? '✓ použito' : `<button class="tl" type="button" data-varianta="${k}">Použít</button>`}</td></tr>`).join('')
      + `<tr class="${akt ? '' : 'vybrana'}"><td>Teď${p.tvar.delka > 0 ? ' (ruční délka)' : ' (podle úhlů)'}</td><td class="c">${fmt(o.L, 0)} mm</td><td class="c">${fmt(q.celkem, 2)} Pa</td><td class="c">${fmt(o.odklon)}° / ${fmt(o.rozsireni)}°</td><td class="c">≈ ${fmt(R.odhadObjemu(p, o) / 1000 * p.tisk.material, 0)} g</td><td></td></tr>`;
    vyplnVarianty(akt);
  }
  function pouzijVariantu(k) {
    if (!krivka) krivka = R.krivkaDelky(p, o);
    if (!krivka) return;
    nahrad(R.pouzijVariantu(p, k, krivka));
  }
  $('tabVarianty').addEventListener('click', e => { const b = e.target.closest('[data-varianta]'); if (b) pouzijVariantu(b.dataset.varianta); });
  function vyplnVarianty(akt) {
    $('seznamVariant').innerHTML = Object.entries(R.VARIANTY).map(([k, v]) => `<button class="pol" role="menuitemcheckbox" aria-pressed="${k === akt}" data-varianta="${k}">${esc(v.nazev)}`
      + `<span class="pozn">${esc(v.popis)}${krivka ? ` · ${fmt(krivka.varianty[k].L, 0)} mm, ${fmt(krivka.varianty[k].dp, 1)} Pa` : ''}</span></button>`).join('');
  }
  $('seznamVariant').addEventListener('click', e => { const b = e.target.closest('[data-varianta]'); if (b) pouzijVariantu(b.dataset.varianta); });
  document.querySelector('[data-nabidka="nabPredvolby"]').addEventListener('click', () => { if (o && o.kanaly && !krivka) { krivka = R.krivkaDelky(p, o); vyplnVarianty(R.aktualniVarianta(p, krivka)); } });
  $('btnAutoDelka').addEventListener('click', () => zmen(x => { x.tvar.delka = 0; }));

  /* ---------- výkres ---------- */
  function svgVykresu() {
    if (!model || !model.vykres) { Dialog.chyba(chybaStavby || (wasm ? 'Model nelze sestavit – viz záložka Kontrola.' : 'Geometrické jádro se ještě načítá.')); return null; }
    const d = new Date();
    return ROZB_VZT_VYKRES.sestavVykres(p, o, model, { objem: model.objem, hmotnost: model.objem / 1000 * p.tisk.material,
      ztrata: o.spojka ? null : o.proudeni, datum: `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}` });
  }
  function ukazVykres() { const svg = svgVykresu(); if (!svg) return; $('vykresObsah').innerHTML = svg; $('vykresDlg').showModal(); }
  function stahniVykres() { const svg = svgVykresu(); if (svg) app.stahni(svg, app.jmeno('_vykres.svg'), 'image/svg+xml'); }
  /** tisk přes skrytý rámec: A4 na šířku bez okrajů, výkres ve skutečné velikosti (PDF = „Uložit jako PDF“) */
  function tiskniVykres() {
    const svg = svgVykresu(); if (!svg) return;
    const ram = document.createElement('iframe');
    ram.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(ram);
    const d = ram.contentDocument;
    d.open(); d.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(app.jmeno(''))}</title><style>@page{size:A4 landscape;margin:0}html,body{margin:0;padding:0}svg{display:block;width:297mm;height:210mm}</style></head><body>${svg}</body></html>`); d.close();
    setTimeout(() => { try { ram.contentWindow.focus(); ram.contentWindow.print(); } finally { setTimeout(() => ram.remove(), 60000); } }, 250);
  }
  $('btnVykres').addEventListener('click', ukazVykres);
  $('btnVykresSvg').addEventListener('click', stahniVykres); $('btnVykresSvg2').addEventListener('click', stahniVykres);
  $('btnVykresTisk').addEventListener('click', tiskniVykres); $('btnVykresTisk2').addEventListener('click', tiskniVykres);
  $('btnZavritVyk').addEventListener('click', () => $('vykresDlg').close());
  document.querySelector('[data-zalozka="proudeni"]').addEventListener('click', () => setTimeout(kresliProudeni, 0));
  vyplnVarianty(null);

  /* ---------- výpisy ---------- */
  const dl = (popis, hodnota, dalsi = '') => `<div class="dlazdice"><div class="popis">${popis}</div><div class="cislo">${hodnota}</div>${dalsi ? `<div class="dalsi">${dalsi}</div>` : ''}</div>`;
  const spoj = h => h.spoj === 'do' ? `vnější Ø ${fmt(2 * h.ro, 2)}` : `vnitřní Ø ${fmt(2 * h.ri, 2)}`;
  function vypis(H) {
    let v = '';
    if (!o.chyba && o.spojka) {
      const sp = o.spojka;
      v += dl('Spojka hadic', `${fmt(sp.delka)} mm`, `2 hrdla po ${fmt(sp.Lh)} mm + střed ${fmt(sp.m)} mm`);
      v += dl('Hrdla', spoj(sp.h), `světlost Ø ${fmt(2 * sp.h.rp, 1)} mm${sp.h.hladke ? ' = ID trubek' : ''}`);
      v += dl('Obal', `Ø ${fmt(2 * (sp.h.ro + (sp.h.spoj === 'do' ? sp.h.limec : 0)), 1)} mm`);
    } else if (!o.chyba) {
      v += dl('Délka přechodu', `${fmt(o.L)} mm`, p.tvar.delka > 0 ? `ručně (doporučeno ${fmt(o.Lauto)} mm)` : 'dopočteno z úhlů');
      v += dl('Odklon / rozšíření', `${fmt(o.odklon)}° / ${fmt(o.rozsireni)}°`, `meze ${fmt(p.tvar.odklon)}° / ${fmt(p.tvar.rozsireni)}° (difuzor ${fmt(2 * o.rozsireni)}°)`);
      v += dl('Vstupní hrdlo', spoj(o.h0), `světlost kanálu Ø ${fmt(2 * o.h0.rp, 1)} mm`);
      v += dl('Hrdla vývodů', `${o.n} × ${spoj(o.h1)}`, `rozteč ${fmt(o.roztec)} mm${p.vyvody.roztec > 0 ? ' (ručně)' : ' (auto)'}`);
      v += dl('Průřez vývodů / vstupu', `${fmt(o.n * o.A1 / o.A0 * 100, 0)} %`, `${fmt(o.n * o.A1 / 100, 0)} / ${fmt(o.A0 / 100, 0)} cm²`);
      v += dl('Rozměry', `Ø ${fmt(Math.max(o.prumerObalu, 2 * (o.h0.ro + o.h0.limec)), 0)} × ${fmt(o.vyska + 2 * Math.max(o.h0.limec, o.h1.limec), 0)} mm`, 'obal × výška');
    }
    if (model) {
      const g = model.objem / 1000 * p.tisk.material;
      v += dl('Objem / hmotnost', `${fmt(model.objem / 1000, 1)} cm³ · ${fmt(g, 0)} g`, `plný díl při hustotě ${fmt(p.tisk.material, 2)} g/cm³`);
      v += dl('Síť', model.ks.uzavrena ? '✔ uzavřená' : '✖ otevřená', `${model.idx.length / 3} trojúhelníků, ${fmt(model.cas, 0)} ms`);
    }
    $('vVysledky').innerHTML = v || dl('Model', 'nelze dopočítat', esc(o.chyba || ''));
    // proudění
    const q = o.proudeni;
    $('vProudeni').innerHTML = q ? dl('Tlaková ztráta', `≈ ${fmt(q.celkem, 1)} Pa`, `ζ = ${fmt(q.zeta, 3)} (k dyn. tlaku na vstupu)`)
      + dl('Jako rovná trubka', `${fmt(q.ekvDelka, 2)} m`, `vstupní trubky Ø ${fmt(2 * o.h0.rp, 0)} mm`)
      + dl('Rychlost na vstupu', `${fmt(q.v0, 2)} m/s`, `dynamický tlak ${fmt(q.pd0, 1)} Pa, Re ${fmt(q.Re0, 0)}`)
      + dl('Rychlost ve vývodu', `${fmt(q.v1, 2)} m/s`, `${fmt(q.Q / o.n, 0)} m³/h na vývod, dyn. tlak ${fmt(q.pd1, 1)} Pa`)
      : dl('Proudění', '–', 'zadejte průtok');
    $('sProud').textContent = q ? `${fmt(q.celkem, 1)} Pa` : '';
    const vol = model ? model.tisk.plochaPrevisu : 0;
    $('vTisk').innerHTML = model ? dl('Převisy bez opory', `${fmt(vol, 0)} mm²`, (vol > 200 ? 'zvažte podpory' : 'tiskne se bez podpor')
        + (model.tisk.plochaOsazeni > 0 ? `; rovná osazení ${fmt(model.tisk.plochaOsazeni, 0)} mm² (žlutě) jsou krátký převis (šířka stěny trubky) – zvládnou se bez podpor` : ''))
      + (model.podpory ? dl('Odlomitelné podpory', `${model.podpory.pocet} sloupků`, `rozteč ${fmt(p.podpory.roztec)} mm, mezera ${fmt(p.podpory.mezera, 2)} mm, hrot 0,6 mm`) : '')
      + dl('Výška tisku', `${fmt(o.spojka ? o.vyska : o.vyska + 2 * Math.max(o.h0.limec, o.h1.limec), 0)} mm`) : '';
    app.hlaseni(H);
    // souhrny oddílů
    const konec = q => [q.od > 0 ? `OD ${fmt(q.od)}` : '', q.id > 0 ? `ID ${fmt(q.id)}` : ''].filter(Boolean).join(' / ');
    TrubkyGui.souhrn('sVstup', konec(p.vstup));
    TrubkyGui.souhrn('sPrechod', o.chyba ? '' : `${fmt(o.L)} mm`);
    TrubkyGui.souhrn('sVyvody', `${p.vyvody.pocet} × ${konec(p.vyvody)}`);
    TrubkyGui.souhrn('sStena', `${fmt(p.tvar.stena)} mm`);
    TrubkyGui.souhrn('sZpevneni', p.zpevneni.zebra ? `${{ sousede: 'mezi sousedy', stred: 'ke středu', oboje: 'obojí', deska: 'deska' }[p.zpevneni.typ]}, ${fmt(p.zpevneni.tl)} mm` : 'bez zpevnění');
    TrubkyGui.souhrn('sUchyty', { zadne: 'bez', ouska: `${p.uchyty.pocet} ouška`, priruba: `příruba, ${p.uchyty.tvar === 'ctverec' ? 4 : p.uchyty.pocet} otvorů`,
      patky: 'patky', lista: 'lišta po délce', zavesy: `${p.uchyty.zavesu} ${p.uchyty.zavesu === 1 ? 'závěs' : 'závěsy'}` }[p.uchyty.typ]);
    TrubkyGui.souhrn('sDil', { rozbocka: 'rozbočka', spojka_vstup: 'spojka vstupu', spojka_vyvod: 'spojka vývodů' }[p.dil]);
  }
  /** Plánek v rohu: pohled do rozbočky ve směru proudu – vstup, výseče kanálů a vývody. */
  function kresliPlan() {
    const c = $('plan'), g = c.getContext('2d'), W = c.width;
    g.clearRect(0, 0, W, W);
    if (o.chyba || o.spojka) return;
    const R0 = Math.max(o.h0.ro + o.h0.limec, o.Rr + o.h1.ro + o.h1.limec), k = W / 2 / R0 * 0.9, X = x => W / 2 + x * k, Y = y => W / 2 - y * k;
    g.lineWidth = 2;
    g.strokeStyle = css('--text-muted'); g.beginPath(); g.arc(W / 2, W / 2, o.h0.rp * k, 0, 2 * Math.PI); g.stroke();
    g.fillStyle = color(css('--accent'), 0.25); g.strokeStyle = css('--accent');
    for (const kn of o.kanaly) {
      const b = R.body(R.prurez(kn, 0));
      g.beginPath(); b.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y)))); g.closePath(); g.fill();
    }
    g.strokeStyle = css('--text');
    for (const kn of o.kanaly) { g.beginPath(); g.arc(X(kn.c1[0]), Y(kn.c1[1]), o.h1.ro * k, 0, 2 * Math.PI); g.stroke(); }
  }
  function color(c, a) { return `color-mix(in srgb, ${c} ${a * 100}%, transparent)`; }

  /* ---------- nabídky, export ---------- */
  TrubkyGui.pripoj({ klic: 'webapp_rozbocka_vzt_gui', pohled: j => nahled.pohled(j) });
  /** Díly k exportu – když se zrovna přepočítává, počká na výsledek (Ctrl+S hned po změně). */
  async function dily() {
    for (let i = 0; i < 600 && wasm && (vLetu || !$('cekani').hidden); i++) await new Promise(ok => setTimeout(ok, 100));
    if (!model) { Dialog.chyba(chybaStavby || (wasm ? 'Model nelze sestavit – viz záložka Kontrola.' : 'Geometrické jádro se ještě načítá.')); return null; }
    const d = [{ jmeno: 'rozbocka', nazev: p.nazev || 'Rozbočka', poz: model.tisk.poz, idx: model.idx, barva: '#4F86D9' }];
    if (model.podpory && model.podpory.pocet) d.push({ jmeno: 'podpory', nazev: 'Odlomitelné podpory', poz: model.podpory.poz, idx: model.podpory.idx, barva: '#A8ADB8' });
    return d;
  }
  async function exportStl() { const d = await dily(); if (d) app.stahni(KRAB.stlBinarni(d, 'rozbocka VZT - github_site'), app.jmeno('.stl'), 'model/stl'); }
  $('btnStl').addEventListener('click', exportStl);
  $('btn3mf').addEventListener('click', async () => { const d = await dily(); if (d) app.stahni(KRAB.soubor3mf(d, p.nazev || 'Rozbočka'), app.jmeno('.3mf'), 'model/3mf'); });
  function prepinac(id, fn) {
    const b = $(id);
    b.addEventListener('click', () => { const h = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(h)); fn(h); });
  }
  prepinac('tDuchove', h => { zobr.duchove = h; ulozZobr(); nahled.prepni('duchove', h); });
  prepinac('tHrany', h => { zobr.hrany = h; ulozZobr(); nahled.prepni('hrany', h); });
  // stav náhledu jen nastavit – geometrii postaví jednou zobrazModel (prepni by ji stavěl podruhé)
  prepinac('tTisk', h => { nahled.stav.tisk = h; zobrazModel(); nahled.pohled('iso'); });
  prepinac('tPrevisy', h => { nahled.stav.previsy = h; zobrazModel(); });
  $('tPravitka').addEventListener('click', () => { zobr.pravitka = !zobr.pravitka; ulozZobr(); kresliPravitka(); });
  prepinac('tRez', h => { rez = h; sim.rez(h && o && o.kanaly ? o.kanaly[0].fi : null); zobrazModel(); });
  prepinac('tSim', h => {
    // při simulaci zprůhlednit díl (pokud ho uživatel nemá průhledný sám), po vypnutí vrátit
    if (h && zobr.dil > 0.6) { dilPredSimulaci = zobr.dil; zobr.dil = 0.3; }
    if (!h && dilPredSimulaci != null) { zobr.dil = dilPredSimulaci; dilPredSimulaci = null; }
    pruhlednost(); sim.zapni(h); zobrazModel();
    $('btnSim').textContent = h ? '⏹ Zastavit simulaci' : '🌬️ Spustit simulaci proudění';
  });
  $('btnSim').addEventListener('click', () => $('tSim').click());
  // P = simulace proudění; u spojky je volba skrytá a klávesa ji nespustí
  document.addEventListener('keydown', e => {
    const a = document.activeElement;
    const vPoli = a && (a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || a.isContentEditable || (a.tagName === 'INPUT' && !/checkbox|range|radio|button/.test(a.type)));
    if (vPoli || e.ctrlKey || e.metaKey || e.altKey || document.querySelector('dialog[open]')) return;
    if ((e.key || '').toLowerCase() === 'p' && !$('tSim').hidden) $('tSim').click();
  });
  // změna tématu jen přebarví náhled, plánek a grafy – síť se kvůli barvám znovu nestaví
  new MutationObserver(() => {
    if (!o) { naplanuj(); return; }
    nahled.barvy(css('--border-strong'), css('--border'), '#000000', 0.6);
    sim.tema(tmaveTema());
    zobrazModel(); kresliPlan();
    if (aktivniZalozka() === 'proudeni') kresliProudeni();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  /* ---------- start ---------- */
  p = app.p;
  cekani(true);
  app.start();
  spustWorker();
  window.ROZB_VZT_UI = { get vlakno() { return worker ? 'worker' : wasmZde ? 'stranka' : 'nacita'; }, get p() { return app.p; }, get model() { return model; }, get o() { return o; }, nahled, zmen, naplnFormular, prepocitej, app };
})();

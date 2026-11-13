/* ============================================================
   gen3d/aplikace.js – společné zapojení stránky 3D generátoru (potřebuje gen3d/zaklad.js, gen3d/gui.js, dialog.js).

   const app = G3D.aplikace({
     typ: 'knofliky', nazev: 'Knoflíky', klic: 'webapp_knofliky',   // klíče <klic>_projekt / _tvary (rozvržení si drží TrubkyGui: <klic>_gui)
     normalizuj: q => ({p, hlaseni}), vychozi: () => p,             // povinné
     ulozProjekt(p) → text, nactiProjekt(text) → {p, hlaseni},      // volitelné (jinak G3D.projektJson)
     popis(p), soubor: 'knoflik',                                    // popis do Moje…, náhradní jméno souboru
     predNaplnenim(p), poNaplneni(p), viditelnost(p),               // formulář
     prepocitej(), zpozdeni: 0,                                      // přepočet po změně (ms; 0 = hned)
     png: () => dataURL, pohled: jmeno => …, POHLEDY: ['iso', …],    // náhled (klávesy 1–5)
     exportStl: () => …, zkratky: {r: 'tRez', …},                    // Ctrl+S a písmena → klik na prvek
     nahodny: () => p, hlaseniNavic(li, x), zmenaTematu(),
     doModelare: () => ({data, pripona}),                           // Soubor → Otevřít v Modeláři (gen3d/predavka.js)
     // volitelné rozšíření (13. 11. 2026):
     klicProjektu: 'webapp_x',                // jiný klíč autosave než <klic>_projekt (stránky se starším klíčem)
     zive: true,                              // přepočet už při psaní (input), psaní do pole = jeden krok zpět, pole s fokusem se nepřepisuje
     hlasitOriznuti: true,                    // po potvrzení pole: „povoleno …, použito …“, když normalizace hodnotu změnila
     cilPole: cesta => element,               // kam skočit z hlášení (jinak [data-p], [data-volba], [data-seg] podle cesty)
     textVychozi: 'Vrátit …?', hlasitOpravyTvaru: true, zpozdeniUlozeni: 0, plneUloziste: e => …,
     staryOdkaz: hash => objekt | null,         // starší formát odkazu stránky (#n=…)
   })
   app.p, app.zmen(f, slouceni), app.nahrad(q), app.naplnFormular(), app.prepocitej()
   app.hlaseni(H, {chybaStavby, boxy}), app.jdiNaPole(cesta), app.prepinac(id, f, vychozi)
   app.stahni(data, jmeno, typ), app.jmeno(pripona), app.manifold() → Promise<wasm>
   app.dlazdice(popis, cislo, dalsi, trida), app.tvary (instance Tvary.pripoj), await app.start() → {zOdkazu}
   Hlášení: pole = [cesty] | 'cesta' | null; oprava = {text, pole, hodnota} | {text, zmeny: {cesta: hodnota}}.

   Prvky podle id (všechny volitelné): btnZpet btnZnovu btnUlozit btnNacist soubor btnVychozi btnPng
   btnSdilet btnNahoda btnModelar stavOdznak sKontrola hlaseni tvary; nápověda: #dlgNapoveda / #napoveda + btnNap / btnZavritNap.
   Pole formuláře: [data-p="cesta"] s data-typ="bool" | "text" (jinak číslo s desetinnou čárkou; šipky ±1, Shift ±10, Alt ±0,1).
   ============================================================ */
/* global G3D, Dialog, Tvary, TrubkyGui */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- manifold (jednou pro celou stránku) ---------- */
  function nactiSkript(src) {
    return new Promise((ok, chyba) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => chyba(new Error('nelze načíst ' + src)); document.head.appendChild(s); });
  }
  let slibManifold = null;
  function manifold() {
    if (slibManifold) return slibManifold;
    slibManifold = (async () => {
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
    })();
    return slibManifold;
  }

  function stahni(data, nazev, typ) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type: typ || 'application/octet-stream' }));
    a.download = nazev; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  const dlazdice = (popis, cislo, dalsi, tr) => `<div class="dlazdice"><div class="popis">${popis}</div><div class="cislo ${tr || ''}">${cislo}</div>${dalsi ? `<div class="dalsi">${dalsi}</div>` : ''}</div>`;
  const zobrazCislo = x => (Number.isFinite(x) ? String(Math.round(x * 1e4) / 1e4).replace('.', ',') : '');
  const gui = () => (typeof TrubkyGui !== 'undefined' ? TrubkyGui : null);

  function aplikace(cfg) {
    const KLIC = cfg.klicProjektu || cfg.klic + '_projekt';
    const vezmi = cfg.vezmi || G3D.vezmi, poloz = cfg.poloz || G3D.poloz;
    const norm = q => cfg.normalizuj(q);
    const LIMIT = cfg.limitHistorie || 100;
    let p;
    const zpet = [], znovu = [];
    const ukazOpravy = (hl, co) => { if (hl && hl.length) setTimeout(() => Dialog.info(`${co} upraven: ${hl.join('; ')}.`), 300); };

    /* ---------- stav a historie ---------- */
    function nactiUlozeny() {
      try {
        const t = localStorage.getItem(KLIC);
        if (t) { const r = norm(JSON.parse(t)); if (cfg.hlasitOpravyUlozeneho) ukazOpravy(r.hlaseni, 'Uložený projekt'); return r.p; }
      } catch (e) { /* bez úložiště nebo poškozený záznam */ }
      return norm(cfg.vychozi()).p;
    }
    let casUlozeni = null;
    const ulozHned = () => { try { localStorage.setItem(KLIC, JSON.stringify(p)); } catch (e) { if (cfg.plneUloziste) cfg.plneUloziste(e); } };
    const uloz = () => { if (!cfg.zpozdeniUlozeni) return ulozHned(); clearTimeout(casUlozeni); casUlozeni = setTimeout(ulozHned, cfg.zpozdeniUlozeni); };
    addEventListener('pagehide', () => { if (casUlozeni) { clearTimeout(casUlozeni); ulozHned(); } });
    let casovac = null;
    function prepocitej() {
      if (!cfg.prepocitej) return;
      if (!cfg.zpozdeni) { cfg.prepocitej(); return; }
      clearTimeout(casovac); casovac = setTimeout(() => cfg.prepocitej(), cfg.zpozdeni);
    }
    function po() {
      if ($('btnZpet')) $('btnZpet').disabled = !zpet.length;
      if ($('btnZnovu')) $('btnZnovu').disabled = !znovu.length;
      uloz();
      if (cfg.viditelnost) cfg.viditelnost(p);
      prepocitej();
    }
    /** Změna projektu: f(p) upraví kopii; slouceni = klíč, pod kterým se rychlé změny (tažení) slijí do jednoho kroku zpět. */
    function zmen(f, slouceni) {
      const pred = JSON.stringify(p);
      f(p);
      p = norm(p).p;
      if (JSON.stringify(p) === pred) return;   // beze změny: žádný krok zpět, přepočet ani ukládání
      const posl = zpet[zpet.length - 1];
      if (slouceni && posl && posl.klic === slouceni && Date.now() - posl.cas < 1200) posl.cas = Date.now();
      else zpet.push({ stav: pred, klic: slouceni, cas: Date.now() });
      if (zpet.length > LIMIT) zpet.shift();
      znovu.length = 0;
      po();
    }
    function krok(z, do_) {
      if (!z.length) return;
      do_.push({ stav: JSON.stringify(p), cas: 0 });
      p = norm(JSON.parse(z.pop().stav)).p;
      naplnFormular(); po();
    }
    function nahrad(q) { zmen(x => { Object.keys(x).forEach(k => delete x[k]); Object.assign(x, G3D.kopie(q)); }); naplnFormular(); }

    /* ---------- formulář [data-p] ---------- */
    function naplnFormular() {
      if (cfg.predNaplnenim) cfg.predNaplnenim(p);
      const fokus = document.activeElement;
      document.querySelectorAll('[data-p]').forEach(el => {
        if (cfg.zive && el === fokus && el.tagName === 'INPUT' && !/checkbox|radio/.test(el.type)) return;   // rozepsané pole nepřepisovat
        const h = vezmi(p, el.dataset.p);
        if (el.dataset.typ === 'bool') el.checked = !!h;
        else if (el.dataset.typ === 'text') el.value = h == null ? '' : h;
        else el.value = el.tagName === 'SELECT' ? String(h) : /range|number/.test(el.type) ? (Number.isFinite(h) ? String(h) : '') : zobrazCislo(h);
        el.classList.remove('spatne');
      });
      if (cfg.viditelnost) cfg.viditelnost(p);
      if (cfg.poNaplneni) cfg.poNaplneni(p);
    }
    // delegovaně (funguje i pro pole přidaná později); cfg.formular === false → stránka si pole obsluhuje sama
    const ctiPole = el => {
      if (el.dataset.typ === 'bool') return el.checked;
      if (el.dataset.typ === 'text') return el.value;
      if (el.tagName === 'SELECT' && !/^-?\d+([.,]\d+)?$/.test(el.value)) return el.value;
      return G3D.ctiCislo(el.value);
    };
    const jeCislo = el => !el.dataset.typ && !(el.tagName === 'SELECT' && !/^-?\d+([.,]\d+)?$/.test(el.value));
    function prevezmiPole(el, zive) {
      const cesta = el.dataset.p, h = ctiPole(el);
      if (jeCislo(el) && !Number.isFinite(h)) { el.classList.add('spatne'); return; }
      el.classList.remove('spatne');
      zmen(q => poloz(q, cesta, h), zive ? 'pole:' + cesta : undefined);
      if (!zive && cfg.hlasitOriznuti && jeCislo(el)) {
        const nova = vezmi(p, cesta);
        if (Number.isFinite(nova) && Math.abs(nova - h) > 1e-9) Dialog.info(`Hodnota ${zobrazCislo(h)} je mimo povolený rozsah – použito ${zobrazCislo(nova)}.`);
      }
      naplnFormular();
    }
    // pole s vlastním data-typ (např. „kabely“) si obsluhuje stránka
    const vlastni = el => cfg.formular === false || !el || !el.dataset || el.dataset.p === undefined || el.dataset.g3d === 'ne'
      || (el.dataset.typ && el.dataset.typ !== 'bool' && el.dataset.typ !== 'text');
    // fáze capture: zachytí i nebublající change/input, které stránky vyvolávají programově (dispatchEvent(new Event('change')))
    document.addEventListener('change', e => { const el = e.target.closest && e.target.closest('[data-p]'); if (!vlastni(el)) prevezmiPole(el, false); }, true);
    if (cfg.zive) document.addEventListener('input', e => {
      const el = e.target.closest && e.target.closest('[data-p]');
      if (vlastni(el) || el.tagName === 'SELECT' || /checkbox|radio/.test(el.type)) return;
      if (jeCislo(el) && !Number.isFinite(ctiPole(el))) return;   // rozepsané číslo („1,“) – počkat
      prevezmiPole(el, true);
    }, true);
    document.addEventListener('keydown', e => {
      const el = e.target.closest && e.target.closest('input[data-p]');
      if (vlastni(el) || el.dataset.typ || /range|number|checkbox|radio/.test(el.type)) return;
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      const x = G3D.ctiCislo(el.value); if (!Number.isFinite(x)) return;
      e.preventDefault();
      const krokPole = Number(el.dataset.krok) || 1;
      const k = krokPole * (e.shiftKey ? 10 : e.altKey ? 0.1 : 1) * (e.key === 'ArrowUp' ? 1 : -1);
      el.value = zobrazCislo(Math.round((x + k) * 1000) / 1000); el.dispatchEvent(new Event('change', { bubbles: true }));
    });

    /* ---------- kontroly ---------- */
    // u zdvojených polí (stejná cesta na víc místech) přednost má viditelné
    const pole = cesta => { const v = [...document.querySelectorAll(`[data-p="${cesta}"]`)]; return v.find(e => e.offsetParent || e.getClientRects().length) || v[0] || null; };
    function jdiNaPole(cesta) {
      const el = (cfg.cilPole && cfg.cilPole(cesta)) || pole(cesta)
        || document.querySelector(`[data-volba="${cesta}"], [data-seg="${cesta}"]`);
      if (!el) return;
      const det = el.closest('details'); if (det) det.open = true;
      const g = gui();
      const tel = el.closest('.zalozka-telo'); if (tel && g) g.otevriZalozku(tel.dataset.telo);
      const bx = el.closest('[data-box]'); if (g) g.ukazBox(bx ? bx.dataset.box : 'obecne');
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el.focus({ preventScroll: true });
      const cil = el.closest('.pole') || el;
      cil.classList.remove('zvyrazni'); void cil.offsetWidth; cil.classList.add('zvyrazni');
    }
    /** Vypíše hlášení {uroven: chyba|varovani|info|ok, text, pole: [cesty], oprava: {text, pole, hodnota}}; vrátí {chyb, varovani}. */
    function hlaseni(H, o = {}) {
      const ul = o.ul || $('hlaseni');
      H = (H || []).map(x => Object.assign({}, x, { pole: Array.isArray(x.pole) ? x.pole : x.pole ? [x.pole] : [] }));
      if (o.chybaStavby) H = [{ uroven: 'chyba', text: o.chybaStavby, pole: [] }].concat(H);
      if (!H.some(x => x.uroven !== 'info')) H = [{ uroven: 'ok', text: 'Bez chyb a varování.', pole: [] }].concat(H);
      const poradi = { chyba: 0, varovani: 1, ok: 2, info: 3 };
      H = H.slice().sort((a, b) => (poradi[a.uroven] ?? 3) - (poradi[b.uroven] ?? 3));
      if (ul) {
        ul.innerHTML = '';
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
            b.addEventListener('click', () => {
              const z = x.oprava.zmeny || { [x.oprava.pole]: x.oprava.hodnota };
              zmen(q => { for (const [c, h] of Object.entries(z)) poloz(q, c, h); }); naplnFormular();
            });
            li.appendChild(b);
          }
          if (cfg.hlaseniNavic) cfg.hlaseniNavic(li, x);
          ul.appendChild(li);
        }
      }
      const nch = H.filter(x => x.uroven === 'chyba').length, nv = H.filter(x => x.uroven === 'varovani').length;
      const od = $('stavOdznak');
      if (od) { od.className = 'odznak ' + (nch ? 'chyba' : nv ? 'mez' : 'ok'); od.textContent = nch ? `✖ ${nch}` : nv ? `⚠ ${nv}` : '✔'; }
      const sk = $('sKontrola');
      if (sk) sk.textContent = nch ? `${nch} ${nch === 1 ? 'chyba' : nch < 5 ? 'chyby' : 'chyb'}` : nv ? `${nv} varování` : 'v pořádku';
      const g = gui();
      if (g) for (const id of o.boxy || [...document.querySelectorAll('[data-box]')].map(b => b.id).filter(Boolean)) {
        g.oznacChybu(id, H.some(x => x.uroven === 'chyba' && x.pole.some(c => { const el = pole(c); return el && el.closest('#' + id); })));
      }
      return { chyb: nch, varovani: nv };
    }

    /* ---------- přepínače v nabídce Zobrazení ---------- */
    /** Tlačítko s aria-pressed: f(stav) hned s počátečním stavem (z HTML) a pak po každém kliknutí.
        pamatovat = true → stav se drží v <klic>_zobrazeni. */
    const KLIC_ZOBR = cfg.klic + '_zobrazeni';
    const zobr = (() => { try { return JSON.parse(localStorage.getItem(KLIC_ZOBR)) || {}; } catch (e) { return {}; } })();
    function prepinac(id, f, pamatovat) {
      const b = $(id); if (!b) return;
      const nastav = h => { b.setAttribute('aria-pressed', String(h)); f(h); };
      nastav(pamatovat && id in zobr ? !!zobr[id] : b.getAttribute('aria-pressed') === 'true');
      b.addEventListener('click', () => {
        const h = b.getAttribute('aria-pressed') !== 'true';
        if (pamatovat) { zobr[id] = h; try { localStorage.setItem(KLIC_ZOBR, JSON.stringify(zobr)); } catch (e) { /* bez úložiště */ } }
        nastav(h);
      });
    }

    /* ---------- soubory, sdílení ---------- */
    const jmeno = pripona => G3D.jmenoSouboru(p.nazev, (typeof cfg.soubor === 'function' ? cfg.soubor(p) : cfg.soubor) || cfg.typ, pripona);
    const ulozProjekt = q => (cfg.ulozProjekt ? cfg.ulozProjekt(q) : G3D.projektJson(cfg.typ, q));
    const nactiProjekt = t => (cfg.nactiProjekt ? cfg.nactiProjekt(t) : G3D.nactiProjektJson(t, cfg.typ, norm, cfg.nazev));
    const ulozitProjekt = () => stahni(ulozProjekt(p), jmeno('.json'), 'application/json');
    const klik = (id, f) => { const el = $(id); if (el) el.addEventListener('click', f); };
    klik('btnZpet', () => krok(zpet, znovu));
    klik('btnZnovu', () => krok(znovu, zpet));
    klik('btnUlozit', ulozitProjekt);
    klik('btnNacist', () => $('soubor') && $('soubor').click());
    if ($('soubor')) $('soubor').addEventListener('change', async e => {
      const f = e.target.files[0]; e.target.value = '';
      if (!f) return;
      try {
        const { p: q, hlaseni: hl } = nactiProjekt(await f.text());
        nahrad(q);
        Dialog.info(hl && hl.length ? 'Projekt načten, některé hodnoty byly opraveny:\n• ' + hl.join('\n• ') : 'Projekt načten.');
      } catch (err) { Dialog.chyba(err.message); }
    });
    klik('btnVychozi', async () => {
      if (!await Dialog.potvrd(cfg.textVychozi || 'Vrátit všechny parametry na výchozí hodnoty?')) return;
      nahrad(cfg.vychozi());
    });
    klik('btnPng', async () => {
      const url = cfg.png && await cfg.png();
      if (!url || url.length < 100) { Dialog.chyba('Obrázek náhledu nejde vytvořit (prohlížeč bez WebGL?).'); return; }
      fetch(url).then(r => r.blob()).then(b => stahni(b, jmeno('.png')));
    });
    klik('btnNahoda', () => { if (cfg.nahodny) nahrad(cfg.nahodny(p)); });
    // předání do Modeláře: cfg.doModelare() → {data: Blob|Uint8Array|string, pripona: '.3mf'} (nebo null, když model není)
    klik('btnModelar', async () => {
      const v = cfg.doModelare && await cfg.doModelare();
      if (!v) return;
      try {
        await G3D.predej('modelar', v.data instanceof Blob ? v.data : new Blob([v.data]), jmeno(v.pripona || '.3mf'));
        location.href = 'modelar.html#predavka';
      } catch (e) { Dialog.chyba('Model se nepodařilo předat Modeláři: ' + (e && e.message || e) + ' – stáhněte ho a otevřete v Modeláři ručně.'); }
    });
    klik('btnSdilet', async () => {
      try {
        const odkaz = location.href.split('#')[0] + '#p=' + await G3D.zakoduj(p);
        try { navigator.clipboard.writeText(odkaz).catch(() => {}); } catch (e) { /* schránka nedostupná */ }   // nečekat – bez oprávnění slib visí
        await Dialog.zeptej(`Odkaz s celým nastavením (zkopírováno do schránky, pokud to prohlížeč dovolil). Kdo ho otevře, uvidí stejný návrh:`, odkaz);
      } catch (e) { Dialog.chyba('Odkaz se nepodařilo vytvořit: ' + (e && e.message || e)); }
    });
    // cfg.staryOdkaz(hash) → objekt parametrů | null: starší formáty odkazů stránky (#n=, #p={JSON}…)
    async function nactiZOdkazu() {
      const stary = cfg.staryOdkaz ? await cfg.staryOdkaz(location.hash) : null;
      const m = /[#&]p=([\w-]+)(?:&|$)/.exec(location.hash);
      if (!m && !stary) return false;
      try {
        const data = stary || await G3D.dekoduj(m[1]);
        if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('není objekt');
        const r = norm(data);
        nahrad(r.p);
        ukazOpravy(r.hlaseni, 'Sdílený návrh');
      } catch (e) { Dialog.chyba('Odkaz je poškozený – návrh z něj nejde načíst.'); }
      try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* sandbox */ }
      return true;
    }

    /* ---------- nápověda, odznak, klávesy, téma ---------- */
    const dlg = $('dlgNapoveda') || $('napoveda');
    klik('btnNap', () => dlg && dlg.showModal());
    klik('btnZavritNap', () => dlg && dlg.close());
    klik('stavOdznak', () => gui() && gui().otevriZalozku('kontrola'));
    const POHLEDY = cfg.POHLEDY || ['iso', 'shora', 'zepredu', 'zboku', 'zespodu'];
    document.addEventListener('keydown', e => {
      const a = document.activeElement;
      const vPoli = a && (a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || a.isContentEditable || (a.tagName === 'INPUT' && !/checkbox|range|radio|button/.test(a.type)));
      const ctrl = e.ctrlKey || e.metaKey, k = (e.key || '').toLowerCase();
      if (document.querySelector('dialog[open]') && e.key !== 'F1') return;
      if (ctrl && !vPoli && k === 'z') { e.preventDefault(); if (e.shiftKey) krok(znovu, zpet); else krok(zpet, znovu); return; }
      if (ctrl && !vPoli && k === 'y') { e.preventDefault(); krok(znovu, zpet); return; }
      if (ctrl && k === 's') { e.preventDefault(); if (e.shiftKey) ulozitProjekt(); else if (cfg.exportStl) cfg.exportStl(); return; }
      if (e.key === 'F1') { e.preventDefault(); if (dlg) dlg.showModal(); return; }
      if (vPoli || ctrl || e.altKey) return;
      const cd = /^(Digit|Numpad)(\d)$/.exec(e.code || ''), i = cd ? Number(cd[2]) : Number(k);   // i česká klávesnice (+ěščř)
      if (i >= 1 && i <= POHLEDY.length && cfg.pohled) { cfg.pohled(POHLEDY[i - 1]); return; }
      const kc = /^Key([A-Z])$/.exec(e.code || ''), pismeno = kc ? kc[1].toLowerCase() : k;   // písmena i na jiném rozložení
      const cil = cfg.zkratky && (cfg.zkratky[k] || cfg.zkratky[pismeno]);
      const el = cil && $(cil);
      const skryty = el && el.closest('[hidden]');   // zavřená nabídka nevadí, skrytá část stránky ano
      if (el && !el.disabled && (!skryty || skryty.classList.contains('nabidka'))) el.click();
    });
    if (cfg.zmenaTematu) new MutationObserver(() => cfg.zmenaTematu()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    /* ---------- start ---------- */
    p = nactiUlozeny();
    const tvary = typeof Tvary !== 'undefined' && $('tvary') ? Tvary.pripoj({
      klic: cfg.klic + '_tvary', typ: cfg.typ, nazev: cfg.nazev, kontejner: $('tvary'),
      parametry: () => G3D.kopie(p),
      pouzij: q => { const r = norm(q); nahrad(r.p); if (cfg.hlasitOpravyTvaru) ukazOpravy(r.hlaseni, 'Uložený návrh'); },
      popis: q => (cfg.popis ? cfg.popis(norm(q).p) : ''),
    }) : null;
    addEventListener('hashchange', () => { if (/[#&]p=/.test(location.hash)) nactiZOdkazu(); });
    const app = {
      get p() { return p; }, zmen, nahrad, naplnFormular, prepocitej, hlaseni, jdiNaPole, prepinac,
      stahni, jmeno, manifold, dlazdice, esc, ulozProjekt, nactiProjekt, nactiZOdkazu, tvary,
      historie: () => ({ zpet: zpet.length, znovu: znovu.length }),
      /** Spustí stránku: naplní formulář, přepočítá, načte odkaz #p= a manifold (když cfg.manifold). */
      async start(volby = {}) {
        naplnFormular(); po();
        const zOdkazu = await nactiZOdkazu();
        if (volby.manifold) {
          try { const w = await manifold(); if (volby.manifold.ok) volby.manifold.ok(w); }
          catch (e) { if (volby.manifold.chyba) volby.manifold.chyba(e); }
        }
        return { zOdkazu };
      },
    };
    window.G3D.app = app;   // pro testy a ladění
    return app;
  }
  window.G3D = Object.assign(window.G3D || {}, { aplikace, manifold, stahni, dlazdice, esc, nactiSkript });
})();

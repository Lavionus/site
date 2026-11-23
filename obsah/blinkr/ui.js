/* Zrcátko, blinkr, jeď! – ovládání stránky: menu, smyčka, vstupy, HUD, situace a volná jízda. */
(function () {
  'use strict';
  const J = window.BLINKR_JADRO, SV = window.BLINKR_SVET, PR = window.BLINKR_PROVOZ;
  const { SITUACE, MESTO, nazevSituace } = window.BLINKR_SITUACE;
  const K = window.BLINKR_KRESBA;
  const $ = id => document.getElementById(id);
  const KLIC = 'webapp_hra_blinkr';
  const DT = 1 / 60;

  if (window.self === window.top) document.body.classList.add('samostatne');

  let ulozene = {};
  try { ulozene = JSON.parse(localStorage.getItem(KLIC) || '{}') || {}; } catch (e) { ulozene = {}; }
  // uložená data ověřit – cizí nebo stará hodnota nesmí stránku shodit
  const cislo = (x, min, max, vychozi) => (typeof x === 'number' && x >= min && x <= max ? x : vychozi);
  const stav = {
    stat: ulozene.stat in J.PROFILY ? ulozene.stat : null,
    rezim: ['situace', 'mesto', 'ostrov'].includes(ulozene.rezim) ? ulozene.rezim : 'situace',
    idx: Number.isInteger(ulozene.idx) && ulozene.idx >= 0 ? ulozene.idx % SITUACE.length : 0,
    hotovo: { cz: {}, uk: {}, ...(ulozene.hotovo && typeof ulozene.hotovo === 'object' ? ulozene.hotovo : {}) },
    auto: {   // rozjezd a brzdy (m/s²)
      plyn: cislo((ulozene.auto || {}).plyn, 1.5, 7, PR.A_PLYN),
      brzda: cislo((ulozene.auto || {}).brzda, 4, 11, PR.A_BRZDA),
    },
    cekaStart: false,
    zoom: 1, pauza: false, sim: null, sit: null, dojezdu: 0, trasa: new Map(),
  };
  const uloz = () => { try { localStorage.setItem(KLIC, JSON.stringify({ stat: stav.stat, rezim: stav.rezim, idx: stav.idx, hotovo: stav.hotovo, auto: stav.auto })); } catch (e) { /* plné úložiště */ } };

  const kresba = K.vytvor($('platno'));
  K.nactiSprity('blinkr/', () => kresba.zneplatni());

  const profil = () => J.PROFILY[stav.stat || 'cz'];
  const vyjezdPro = (p, smer) => (smer === 'rovne' ? 0 : smer === 'pres' ? (p.strana > 0 ? 3 : 1) : (p.strana > 0 ? 1 : 3));

  /* ---------- spuštění ---------- */

  function spust() {
    const p = profil();
    zavriNabidku();
    $('zpravy').textContent = '';
    ukazOkno(stav.stat ? null : 'oknoStat');          // bez zvoleného státu zůstává volba státu otevřená
    stav.pauza = false; $('tlPauza').setAttribute('aria-pressed', 'false');
    for (const k in vstup) vstup[k] = 0;
    skryjPanel('panelUvod', false); skryjPanel('panelKonec', false);
    stav.cekaStart = false;
    if (stav.rezim === 'mesto' || stav.rezim === 'ostrov') {
      const ostrov = stav.rezim === 'ostrov';
      const def = ostrov ? window.BLINKR_MAURICIUS : MESTO;
      const svet = SV.postav(def, p);
      const sim = PR.vytvor(svet, { seed: (Math.random() * 1e9) | 0, plneni: ostrov ? { aut: 10, chodcu: 3, okruh: 220 } : { aut: 9, chodcu: 4 } });
      const h = PR.pridejAuto(sim, { ...def.hrac, hrac: true, barva: '#d94b3d' });
      h.zamer = t => stav.trasa.get(t.klic) ?? null;
      stav.sim = sim; stav.sit = null; stav.dojezdu = 0; stav.cilNazev = null;
      if (!ostrov) {
        // provoz hned od začátku: auta rozmístěná po rovných úsecích dál od hráče
        const useky = [...svet.dl.values()].filter(t => !t.box && Math.hypot(t.cx - h.x, t.cy - h.y) > 40);
        for (let i = 0; i < 7 && useky.length; i++) {
          const t = useky.splice(Math.floor(Math.random() * useky.length), 1)[0];
          PR.pridejAuto(sim, { tile: t, vjezd: t.ramena[Math.floor(Math.random() * t.ramena.length)], s: 4 + Math.random() * 18, v: 8 });
        }
      }
      novyCil();
      $('ukolText').textContent = ostrov ? `Mauricius – dojeď do ${stav.cilNazev}.` : 'Volná jízda – dojeď k hvězdě.';
      if (ostrov) {
        $('uvodNazev').textContent = '🏝️ Mauricius';
        $('uvodUkol').textContent = `Síť hlavních silnic ostrova (dálnice M1–M3, silnice A a B) zmenšená tak, že 1 dlaždice = 1 km. Cíl: ${stav.cilNazev}. Navigace ukazuje cestu, minimapa vlevo nahoře celý ostrov.`;
        // celé věty (kvůli překladu), datum dat jako parametr
        $('uvodRada').textContent = p.id === 'uk'
          ? `Na Mauriciu se jezdí vlevo jako tady. Rozhodčí hodnotí podle britských pravidel; mauricijský Highway Code simulace nemodeluje. Silnice, pobřeží a města: © přispěvatelé OpenStreetMap (ODbL), stav ${def.datum}.`
          : `Na skutečném Mauriciu se jezdí vlevo – tady jezdíš podle českých pravidel, jako by ostrov ležel v Česku. Mauricijský Highway Code simulace nemodeluje. Silnice, pobřeží a města: © přispěvatelé OpenStreetMap (ODbL), stav ${def.datum}.`;
        ukazPanel('panelUvod');
        stav.cekaStart = true;
      }
      if (ostrov) { K.minimapa($('minimapa'), svet); }
      $('minimapaObal').hidden = !ostrov;
      $('scena').classList.toggle('s-minimapou', ostrov);
    } else {
      const sit = SITUACE[stav.idx % SITUACE.length];
      const d = sit.postav(p);
      const svet = SV.postav(d, p);
      const sim = PR.vytvor(svet, { seed: 7, ukoly: d.ukoly });
      const cil = vyjezdPro(p, d.smer);
      const h = PR.pridejAuto(sim, { ...d.hrac, plan: [cil], hrac: true, barva: '#d94b3d' });
      h.zamer = t => (t.box ? cil : null);
      sim.cil = svet.dl.get(d.cil);
      stav.sim = sim; stav.sit = { def: sit, d };
      $('ukolText').textContent = d.ukol;
      $('uvodNazev').textContent = `${stav.idx % SITUACE.length + 1}/${SITUACE.length} · ${nazevSituace(sit, p)}`;
      $('uvodUkol').textContent = d.ukol;
      $('uvodRada').textContent = d.rada;
      ukazPanel('panelUvod');
      stav.cekaStart = true;          // svět stojí, dokud se hráč nerozjede
      $('minimapaObal').hidden = true;
      $('scena').classList.remove('s-minimapou');
    }
    stav.sim.hrac.aPlyn = stav.auto.plyn; stav.sim.hrac.aBrzda = stav.auto.brzda;
    kresba.zneplatni();
    stav.zoomZaklad = null;
    aktualizujListu();
  }

  function novyCil() {
    const sim = stav.sim, h = sim.hrac, svet = sim.svet;
    if (stav.rezim === 'ostrov') {
      const mesta = svet.def.mesta.filter(m => m.nazev !== stav.cilNazev && Math.hypot((m.x + .5) * svet.T - h.x, (m.y + .5) * svet.T - h.y) > 120);
      const m = mesta[Math.floor(Math.random() * mesta.length)];
      stav.cilNazev = m.nazev;
      sim.cil = svet.dlazdice(m.x, m.y);
    } else {
      const kandidati = [...svet.dl.values()].filter(t => !t.box && !t.ven.length && Math.hypot(t.cx - h.x, t.cy - h.y) > 70);
      sim.cil = kandidati[Math.floor(Math.random() * kandidati.length)] || null;
    }
    sim.konec = null;
    // trasa k cíli pro celou síť naráz (BFS od cíle)
    stav.trasa = sim.cil ? SV.trasaDo(svet, sim.cil).vyjezd : new Map();
  }

  // Hráč a cíl na minimapě (podklad se kreslí jednou při spuštění)
  function kresliPolohuNaMinimape() {
    const cv = $('minimapaPoloha'), mm = $('minimapa'), sim = stav.sim, T = sim.svet.T;
    if (cv.width !== mm.width) { cv.width = mm.width; cv.height = mm.height; }
    const g = cv.getContext('2d'), k = mm.width / sim.svet.W;
    g.clearRect(0, 0, cv.width, cv.height);
    if (sim.cil) { g.fillStyle = '#ffd400'; g.strokeStyle = '#7a5b00'; g.lineWidth = 1.5; g.beginPath(); g.arc((sim.cil.x + .5) * k, (sim.cil.y + .5) * k, 5, 0, 7); g.fill(); g.stroke(); }
    const h = sim.hrac;
    g.fillStyle = '#e8322a'; g.strokeStyle = '#fff'; g.lineWidth = 1.5;
    g.beginPath(); g.arc(h.x / T * k, h.y / T * k, 4.5, 0, 7); g.fill(); g.stroke();
  }

  function textNavigace() {
    const sim = stav.sim, h = sim.hrac;
    if (!h.t || !sim.cil) return '';
    let t = h.t, a = h.a, d = 0;
    for (let i = 0; i < 12 && t; i++) {
      const b = stav.trasa.get(t.klic);
      if (b == null) return '';
      if (t.box && !(t === h.t && h.vBoxu === 'ven')) {
        const m = Math.round(d / 10) * 10;
        if (t.typ === 'kruhac') {
          const n = J.poradiVyjezdu(profil(), a, b);
          return d > 0 ? `Za ${m} m: na kruhovém objezdu ${n}. výjezd` : `Teď: na kruhovém objezdu ${n}. výjezd`;
        }
        // celé věty kvůli překladu
        const VETY = {
          rovne: [`Za ${m} m: rovně`, 'Teď: rovně'], vlevo: [`Za ${m} m: odboč vlevo`, 'Teď: odboč vlevo'],
          vpravo: [`Za ${m} m: odboč vpravo`, 'Teď: odboč vpravo'], otoceni: [`Za ${m} m: otoč se`, 'Teď: otoč se'],
        };
        return VETY[J.manevr(a, b)][d > 0 ? 0 : 1];
      }
      d += t === h.t ? Math.max(0, (h.c ? h.c.delka - h.s : 0)) : sim.svet.T;
      const n = sim.svet.soused(t, b);
      if (!n) return '';
      a = (b + 2) % 4; t = n;
    }
    return '';
  }

  /* ---------- vstup ---------- */

  const vstup = { plyn: 0, brzda: 0, vlevo: 0, vpravo: 0 };
  const KLAV = { ArrowUp: 'plyn', KeyW: 'plyn', ArrowDown: 'brzda', KeyS: 'brzda', Space: 'brzda', ArrowLeft: 'vlevo', KeyA: 'vlevo', ArrowRight: 'vpravo', KeyD: 'vpravo' };
  function blinkr(smer) {
    const h = stav.sim && stav.sim.hrac;
    if (!h) return;
    h.blinkr = h.blinkr === smer ? 'zadny' : smer;
    h.otoceni = 0;
  }
  addEventListener('keydown', e => {
    if (e.code === 'Escape' && nabidka) { e.preventDefault(); zavriNabidku(true); return; }
    if (e.target.closest && e.target.closest('input,textarea,select')) return;
    const naTlacitku = e.target.closest && e.target.closest('.panel button, .okno button, .nabidka');
    // Výsledek jízdy zavře „libovolná“ klávesa: po správném průjezdu další situace, po chybě znovu tatáž.
    // Ne však držená klávesa (autorepeat z jízdy), modifikátory, Tab, ani v prvních 0,4 s po zobrazení;
    // Enter/mezerník na tlačítku panelu spustí to tlačítko.
    if (!$('panelKonec').hidden) {
      if (e.repeat || e.ctrlKey || e.altKey || e.metaKey || ['Tab', 'Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(e.key)) return;
      if (naTlacitku && (e.key === 'Enter' || e.key === ' ')) return;
      if (performance.now() - (stav.konecOd || 0) < 400) return;
      e.preventDefault(); pokracuj(); return;
    }
    if (naTlacitku) return;                                   // v nabídce a dialozích patří klávesy jim
    if (KLAV[e.code]) {
      vstup[KLAV[e.code]] = 1; e.preventDefault();
      if (KLAV[e.code] === 'plyn' && !e.repeat) stav.cekaStart = false;   // svět rozjede jen nové stisknutí plynu
      return;
    }
    if (e.repeat) return;
    if (e.code === 'KeyQ') blinkr('vlevo');
    else if (e.code === 'KeyE') blinkr('vpravo');
    else if (e.code === 'KeyR') spust();
    else if (e.code === 'KeyP') prepniPauzu();
    else if (e.code === 'Equal' || e.code === 'NumpadAdd') priblizeni(1.25);
    else if (e.code === 'Minus' || e.code === 'NumpadSubtract') priblizeni(0.8);
  });
  addEventListener('keyup', e => { if (KLAV[e.code]) vstup[KLAV[e.code]] = 0; });
  const pustVse = () => { for (const k in vstup) vstup[k] = 0; for (const b of document.querySelectorAll('#dotyk .drzi')) b.classList.remove('drzi'); };
  addEventListener('blur', pustVse);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pustVse(); });
  for (const b of document.querySelectorAll('#dotyk button')) {
    const k = b.dataset.k;
    const dolu = e => {
      e.preventDefault();
      if (k === 'blL') return blinkr('vlevo');
      if (k === 'blP') return blinkr('vpravo');
      vstup[k] = 1; b.classList.add('drzi');
      if (k === 'plyn') stav.cekaStart = false;
    };
    const nahoru = e => { e.preventDefault(); if (k in vstup) vstup[k] = 0; b.classList.remove('drzi'); };
    b.addEventListener('pointerdown', dolu);
    b.addEventListener('pointerup', nahoru);
    b.addEventListener('pointercancel', nahoru);
    b.addEventListener('pointerleave', nahoru);
  }
  $('platno').addEventListener('wheel', e => { e.preventDefault(); priblizeni(e.deltaY < 0 ? 1.12 : 0.89); }, { passive: false });
  $('zoomPlus').onclick = () => priblizeni(1.25);
  $('zoomMinus').onclick = () => priblizeni(0.8);
  function priblizeni(f) { stav.zoom = Math.max(0.35, Math.min(3, stav.zoom * f)); }

  /* ---------- okna a nabídky ---------- */

  function ukazOkno(id) {
    for (const o of document.querySelectorAll('.okno')) o.hidden = o.id !== id;
  }
  const oknoOtevrene = () => [...document.querySelectorAll('.okno')].some(o => !o.hidden);
  // Nemodální panely vpravo dole: ukáže se hned, skrytí buď postupné (pomalu zmizí), nebo okamžité.
  function ukazPanel(id) { const el = $(id); clearTimeout(el._casovac); el.classList.remove('mizi'); el.hidden = false; }
  function skryjPanel(id, postupne) {
    const el = $(id);
    if (!postupne) { clearTimeout(el._casovac); el.hidden = true; el.classList.remove('mizi'); return; }
    if (el.hidden || el.classList.contains('mizi')) return;     // už mizí – časovač nerušit
    el.classList.add('mizi');
    el._casovac = setTimeout(() => { el.hidden = true; el.classList.remove('mizi'); }, 2600);
  }
  function pokracuj() {
    skryjPanel('panelKonec', false);
    if (stav.rezim !== 'situace') return;
    if (stav.vysledekOk) stav.idx = (stav.idx + 1) % SITUACE.length;
    uloz(); spust();
  }
  $('konecZnovu').onclick = () => spust();
  $('konecDalsi').onclick = () => { stav.idx = (stav.idx + 1) % SITUACE.length; uloz(); spust(); };
  for (const b of document.querySelectorAll('[data-stat]')) b.onclick = () => { stav.stat = b.dataset.stat; uloz(); spust(); };

  let nabidka = null;
  function zavriNabidku(vratitFokus) {
    if (!nabidka) return;
    const tl = nabidka._tl;
    nabidka.remove(); nabidka = null;
    if (vratitFokus && tl) tl.focus();
  }
  function otevriNabidku(tl, stavet) {
    const byla = nabidka && nabidka._tl === tl;
    zavriNabidku();
    if (byla) return;
    nabidka = document.createElement('div');
    nabidka.className = 'nabidka'; nabidka._tl = tl; nabidka.setAttribute('role', 'menu');
    stavet(nabidka);
    document.body.appendChild(nabidka);
    const r = tl.getBoundingClientRect();
    const w = nabidka.offsetWidth;
    nabidka.style.top = (r.bottom + 4) + 'px';
    nabidka.style.left = Math.max(6, Math.min(r.left, innerWidth - w - 6)) + 'px';
    const prvni = nabidka.querySelector('button, input');
    if (prvni) prvni.focus({ preventScroll: true });
  }
  addEventListener('pointerdown', e => { if (nabidka && !nabidka.contains(e.target) && e.target.closest('.tl') !== nabidka._tl) zavriNabidku(); });
  const polozka = (n, text, f, zvoleno, extra) => {
    const b = document.createElement('button');
    b.className = 'tl' + (zvoleno !== undefined ? ' prep' : '');
    if (zvoleno !== undefined) b.setAttribute('aria-pressed', zvoleno ? 'true' : 'false');
    b.textContent = text;
    if (extra) { const s = document.createElement('span'); s.className = 'hotovo'; s.textContent = extra; b.appendChild(s); }
    b.onclick = () => { zavriNabidku(); f(); };
    n.appendChild(b);
    return b;
  };
  const titulek = (n, t) => { const d = document.createElement('div'); d.className = 'titulek'; d.textContent = t; n.appendChild(d); };

  $('tlStat').onclick = () => otevriNabidku($('tlStat'), n => {
    titulek(n, 'Pravidla státu');
    polozka(n, '🇨🇿 Česko – jízda vpravo', () => { stav.stat = 'cz'; uloz(); spust(); }, stav.stat === 'cz');
    polozka(n, '🇬🇧 Velká Británie – jízda vlevo', () => { stav.stat = 'uk'; uloz(); spust(); }, stav.stat === 'uk');
  });
  $('tlRezim').onclick = () => otevriNabidku($('tlRezim'), n => {
    titulek(n, 'Výukové situace');
    const p = profil();
    SITUACE.forEach((s, i) => polozka(n, `${i + 1}. ${nazevSituace(s, p)}`, () => { stav.rezim = 'situace'; stav.idx = i; uloz(); spust(); },
      stav.rezim === 'situace' && stav.idx % SITUACE.length === i, stav.hotovo[p.id] && stav.hotovo[p.id][s.id] ? '✓ bez chyby' : ''));
    n.appendChild(document.createElement('hr'));
    polozka(n, '🏙️ Volná jízda po městečku', () => { stav.rezim = 'mesto'; uloz(); spust(); }, stav.rezim === 'mesto');
    polozka(n, '🏝️ Mauricius – ostrov podle skutečné mapy', () => { stav.rezim = 'ostrov'; uloz(); spust(); }, stav.rezim === 'ostrov');
  });
  $('tlAuto').onclick = () => otevriNabidku($('tlAuto'), n => {
    titulek(n, 'Tvoje auto');
    const box = document.createElement('div'); box.className = 'nastaveni';
    const radek = (popis, klic, min, max, krok, info) => {
      const l = document.createElement('label'); l.textContent = popis;
      const r = document.createElement('input'); r.type = 'range'; r.min = min; r.max = max; r.step = krok; r.value = stav.auto[klic];
      const o = document.createElement('output');
      const ukaz = () => { o.textContent = info(+r.value); };
      r.oninput = () => {
        stav.auto[klic] = +r.value; ukaz(); uloz();
        if (stav.sim) { stav.sim.hrac.aPlyn = stav.auto.plyn; stav.sim.hrac.aBrzda = stav.auto.brzda; }
      };
      l.htmlFor = r.id = 'nast_' + klic;
      ukaz(); box.append(l, r, o);
    };
    const p = profil();
    const z50 = a => {
      const s = ((p.id === 'cz' ? 50 / 3.6 : 30 * J.MPH) / a).toFixed(1).replace('.', ',');
      return p.id === 'cz' ? `0–50 km/h za ${s} s` : `0–30 mph za ${s} s`;
    };
    radek('Rozjezd', 'plyn', 1.5, 7, 0.25, z50);
    radek('Brzdy', 'brzda', 4, 11, 0.25, a => {
      const v = p.id === 'cz' ? 50 / 3.6 : 30 * J.MPH, m = (v * v / (2 * a)).toFixed(0);
      return p.id === 'cz' ? `z 50 km/h na ${m} m` : `z 30 mph na ${m} m`;
    });
    n.appendChild(box);
    polozka(n, '↺ Výchozí hodnoty', () => {
      stav.auto = { plyn: PR.A_PLYN, brzda: PR.A_BRZDA }; uloz();
      if (stav.sim) { stav.sim.hrac.aPlyn = stav.auto.plyn; stav.sim.hrac.aBrzda = stav.auto.brzda; }
    });
  });
  $('tlZnovu').onclick = () => spust();
  $('tlPauza').onclick = () => prepniPauzu();
  function prepniPauzu() { stav.pauza = !stav.pauza; $('tlPauza').setAttribute('aria-pressed', stav.pauza ? 'true' : 'false'); }

  $('tlNapoveda').onclick = () => otevriNabidku($('tlNapoveda'), n => {
    titulek(n, 'Ovládání');
    const d = document.createElement('div'); d.className = 'text';
    d.innerHTML = '<kbd>↑</kbd>/<kbd>W</kbd> plyn · <kbd>↓</kbd>/<kbd>S</kbd>/<kbd>mezera</kbd> brzda, ze stání couvání<br>' +
      '<kbd>←</kbd> <kbd>→</kbd> (<kbd>A</kbd> <kbd>D</kbd>) zatáčení<br><kbd>Q</kbd> blinkr vlevo · <kbd>E</kbd> blinkr vpravo (po odbočení se sám vypne)<br>' +
      '<kbd>R</kbd> znovu · <kbd>P</kbd> pauza · <kbd>+</kbd> <kbd>−</kbd> nebo kolečko myši = přiblížení<br>Na dotykové obrazovce tlačítka dole.';
    n.appendChild(d);
    titulek(n, 'Co rozhodčí hlídá');
    const d2 = document.createElement('div'); d2.className = 'text';
    d2.innerHTML = 'Přednost (podle zákona: vozidlo s předností <b>nesmí být nuceno náhle brzdit nebo uhýbat</b>), semafory, STOP, chodce, blinkr, stranu jízdy, směr na kruháči, vjezd do zaplněné křižovatky a rychlost. ' +
      'Povinnost = 3 trestné body, britské doporučení („should“) = 1 bod, srážka = 10 bodů.<br><br>' +
      '<b>Nesimuluje se:</b> tramvaje, cyklisté a cyklopruhy, vyhrazené pruhy, zalomená hlavní silnice, víc pruhů na kruháči, předjíždění, dálnice.';
    n.appendChild(d2);
  });

  $('tlPravidla').onclick = () => otevriNabidku($('tlPravidla'), n => {
    titulek(n, 'Česko vs. Velká Británie');
    const tab = document.createElement('table');
    const radky = [
      ['', '🇨🇿 Česko (zákon 361/2000 Sb.)', '🇬🇧 UK (The Highway Code)'],
      ['Strana jízdy', 'vpravo (§ 11)', 'vlevo (pravidlo 160)'],
      ['Neoznačená křižovatka', 'pravidlo pravé ruky (§ 22/2)', 'nikdo nemá přednost (146)'],
      ['Odbočení přes protisměr', 'vlevo, přednost protijedoucím (§ 21/5)', 'vpravo, počkat na mezeru (180)'],
      ['Kruhový objezd', 'proti hodinám, přednost vozidlům na objezdu (§ 22/5)', 'po hodinách, přednost zprava (185)'],
      ['Blinkr na kruháči', 'při vjezdu ne, při výjezdu ano (§ 30/5)', 'vlevo / vpravo už při příjezdu podle výjezdu (186)'],
      ['Chodec čeká u zebry', 'musíš ho pustit (§ 5/2f)', 'měl bys ho pustit; vstoupil-li, musíš (195)'],
      ['Chodci při odbočení', 'nesmíš ohrozit přecházejícího (§ 5/2g)', 'přednost i čekajícím (H2)'],
      ['Červená + žlutá', 'připrav se, nejeď (§ 70/2b)', 'také znamená stůj'],
      ['Doplňková / zelená šipka', 'i na červenou, přednost volnému směru (§ 70/2g)', 've směru šipky, je-li cesta volná'],
      ['Rychlost v obci', '50 km/h (§ 18/4)', '30 mph (124)'],
    ];
    radky.forEach((r, i) => {
      const tr = document.createElement('tr');
      r.forEach(c => { const td = document.createElement(i === 0 ? 'th' : 'td'); td.textContent = c; tr.appendChild(td); });
      tab.appendChild(tr);
    });
    const obal = document.createElement('div'); obal.style.overflowX = 'auto'; obal.appendChild(tab);
    n.appendChild(obal);
    const d = document.createElement('div'); d.className = 'text';
    d.textContent = 'Znění ověřeno 20. 11. 2026 (zakonyprolidi.cz, gov.uk). Předpisy se mění – při pochybnostech platí aktuální text předpisu.';
    n.appendChild(d);
  });

  function aktualizujListu() {
    const p = profil();
    $('statNazev').textContent = p.id === 'cz' ? 'Česko' : 'Velká Británie';
    $('rezimNazev').textContent = stav.rezim === 'mesto' ? 'Volná jízda' : stav.rezim === 'ostrov' ? 'Mauricius' : `Situace ${stav.idx % SITUACE.length + 1}`;
    $('jednotka').textContent = p.jednotka;
    $('limit').innerHTML = p.id === 'cz' ? '50' : '30<small>mph</small>';
  }

  /* ---------- zprávy a konec ---------- */

  function ukazZpravu(z) {
    const el = document.createElement('div');
    el.className = 'zprava' + (z.typ === 'ok' ? ' ok' : z.zavaznost === 'doporuceni' ? ' doporuceni' : '');
    if (z.typ === 'ok') el.textContent = '👍 ' + z.text;
    else {
      const b = document.createElement('b'); b.textContent = `${z.titulek} (+${z.body})`; el.appendChild(b);
      el.appendChild(document.createTextNode(z.text));
      const c = document.createElement('span'); c.className = 'cit';
      c.textContent = `${z.predpis}, ${z.citace}${z.zavaznost === 'doporuceni' ? ' · doporučení (should)' : ''}`;
      el.appendChild(document.createElement('br')); el.appendChild(c);
    }
    $('zpravy').prepend(el);
    while ($('zpravy').children.length > 4) $('zpravy').lastChild.remove();
    setTimeout(() => el.remove(), z.typ === 'ok' ? 3000 : 9000);
  }

  function konecSituace() {
    const sim = stav.sim, p = profil();
    const ch = sim.prestupky;
    const body = ch.reduce((s, x) => s + x.body, 0);
    $('konecNazev').textContent = nazevSituace(stav.sit.def, p);
    const v = $('konecVysledek');
    if (sim.konec === 'srazka') { v.textContent = '💥 Srážka – situaci zkus znovu.'; v.className = 'vysledek chyba'; }
    else if (!ch.length) { v.textContent = '✅ Bez chyby – přesně podle předpisu!'; v.className = 'vysledek ok'; stav.hotovo[p.id] = stav.hotovo[p.id] || {}; stav.hotovo[p.id][stav.sit.def.id] = true; uloz(); }
    else { v.textContent = `Dojel jsi, ale s chybami: ${body} trestných bodů.`; v.className = 'vysledek chyba'; }
    stav.vysledekOk = sim.konec !== 'srazka' && !ch.length;
    // výchozí akce (libovolná klávesa) = zvýrazněné tlačítko
    $('konecDalsi').classList.toggle('hlavni-tl', stav.vysledekOk);
    $('konecZnovu').classList.toggle('hlavni-tl', !stav.vysledekOk);
    $('konecKlavesa').textContent = stav.vysledekOk ? 'Libovolná klávesa: další situace.' : 'Libovolná klávesa: zkusit znovu od začátku.';
    const ul = $('konecChyby'); ul.textContent = '';
    for (const x of ch) {
      const li = document.createElement('li'); if (x.zavaznost === 'doporuceni') li.className = 'doporuceni';
      const b = document.createElement('b'); b.textContent = x.titulek + ': '; li.appendChild(b);
      li.appendChild(document.createTextNode(x.text + ' '));
      const c = document.createElement('span'); c.className = 'cit'; c.textContent = `(${x.predpis}, ${x.citace})`; li.appendChild(c);
      ul.appendChild(li);
    }
    ukazPanel('panelKonec');
    stav.konecOd = performance.now();
    (stav.vysledekOk ? $('konecDalsi') : $('konecZnovu')).focus({ preventScroll: true });
  }

  /* ---------- smyčka ---------- */

  let posledni = performance.now(), zasoba = 0, blikani = 0;
  function snimek(ted) {
    requestAnimationFrame(snimek);
    const dt = Math.min(0.1, (ted - posledni) / 1000); posledni = ted;
    const sim = stav.sim;
    if (!sim) return;
    // Svět čeká na první plyn (u situace); pak se úvodní panel pomalu schová, jakmile se auto rozjede.
    if (stav.cekaStart && stav.bot) stav.cekaStart = false;
    if (!stav.cekaStart && !$('panelUvod').hidden && Math.abs(sim.hrac.v) > 0.5) skryjPanel('panelUvod', true);
    const bezi = !stav.pauza && !oknoOtevrene() && !document.hidden && !stav.cekaStart;
    if (bezi) {
      zasoba += dt * (stav.zrychleni || 1);
      while (zasoba >= DT) {
        // stav.bot = vzorný řidič místo hráče (testy a ukázka)
        PR.krok(sim, DT, stav.bot ? PR.ridicBot(sim, sim.hrac, DT) : vstup);
        zasoba -= DT;
        if (sim.konec) break;
      }
      while (sim.zpravy.length) ukazZpravu(sim.zpravy.shift());
      if (sim.konec) {
        if (stav.rezim !== 'situace' && sim.konec === 'cil') {
          stav.dojezdu++;
          const byl = stav.cilNazev;
          novyCil();
          ukazZpravu({ typ: 'ok', text: byl ? `Vítej v ${byl}! Další cíl: ${stav.cilNazev}.` : `Cíl ${stav.dojezdu} – další hvězda je na mapě.` });
        } else if (stav.rezim === 'situace' && !sim._konecUkazan) { sim._konecUkazan = true; konecSituace(); }
      }
    } else zasoba = 0;

    const h = sim.hrac, p = profil();
    // kamera
    const zakl = Math.max(6.5, Math.min(13, Math.min($('platno').clientWidth, $('platno').clientHeight) / 55));
    const kam = { x: h.x + Math.cos(h.uhel) * h.v * 0.6, y: h.y + Math.sin(h.uhel) * h.v * 0.6, zoom: zakl * stav.zoom };
    stav.kam = stav.kam ? { x: stav.kam.x + (kam.x - stav.kam.x) * 0.12, y: stav.kam.y + (kam.y - stav.kam.y) * 0.12, zoom: kam.zoom } : kam;
    kresba.kresli(sim, stav.kam);

    // HUD
    $('rychlost').textContent = Math.round(Math.abs(p.naJednotku(h.v)));
    blikani = (sim.cas * 1.5) % 1 < 0.55;
    $('blL').classList.toggle('zap', h.blinkr === 'vlevo' && blikani);
    $('blP').classList.toggle('zap', h.blinkr === 'vpravo' && blikani);
    $('body').textContent = sim.prestupky.reduce((s, x) => s + x.body, 0);
    if (stav.rezim === 'mesto') {
      $('ukolText').textContent = `Volná jízda – dojeď k hvězdě (cílů: ${stav.dojezdu})`;
      $('navi').textContent = textNavigace();
    } else if (stav.rezim === 'ostrov') {
      $('ukolText').textContent = `Mauricius – dojeď do ${stav.cilNazev} (cílů: ${stav.dojezdu})`;
      $('navi').textContent = textNavigace();
      kresliPolohuNaMinimape();
    } else $('navi').textContent = '';
  }

  spust();                       // bez uloženého státu se ukáže volba státu (pravidla zatím ČR)
  if (!stav.stat) { $('statNazev').textContent = 'Stát'; }
  requestAnimationFrame(snimek);
  window.BLINKR_UI = { stav, spust, vstup };
})();

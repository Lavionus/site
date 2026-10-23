/* ============================================================
   Písmolijna – ui/generator.js
   Karta Generátor: galerie stylů s náhledy, velký náhled textu,
   volba základního písma, síly a semínka, vlastní kombinace
   efektů (pokročilý režim) a vytvoření celého fontu po dávkách.
   ============================================================ */
(function () {
  'use strict';
  const P = window.PSL, A = window.PSLAPP;
  const el = A.el;
  const koren = document.getElementById('generator');
  const st = Object.assign({ styl: 'strasidelne', zaklad: '', sila: 1, seminko: 1, text: 'Strašidelný hrad', sada: 'cesky', vlastni: ['zkos', 'trny'], hladke: false }, A.nastaveni.generator || {});
  const fonty = new Map();      // id písma → font modelu (načtené z knihovny)
  const glyfy = new Map();      // klíč → vygenerovaný glyf (mezipaměť náhledů)
  let sestaveno = false, bezi = false;

  function uloz() { A.nastaveni.generator = st; A.ulozNastaveni(); }
  const styl = () => st.styl === 'vlastni' ? P.vlastniStyl(st.vlastni, st.hladke) : P.GENERATOR_STYLY.find(s => s.id === st.styl) || P.GENERATOR_STYLY[0];

  async function zakladProStyl(s) {
    const id = st.zaklad || s.zaklad || 'libsans';
    if (id === 'projekt') return A.font;
    if (!fonty.has(id)) fonty.set(id, FONTY.data(id).then(d => P.nactiFont(d)));
    return fonty.get(id);
  }

  /* Vygenerované glyfy pro text (s mezipamětí). */
  function glyfyTextu(zdroj, s, text) {
    const mapa = P.cmap(zdroj), out = [];
    for (const z of Array.from(text)) {
      const n = mapa.get(z.codePointAt(0));
      if (!n) continue;
      const klic = [s.id, zdroj.info.rodina, st.sila, st.seminko, n].join('|');
      if (!glyfy.has(klic)) {
        let g;
        try { g = P.generujGlyf(zdroj, zdroj.glyfy[n], s, { sila: st.sila, seminko: st.seminko }); }
        catch (e) { console.warn(e); g = { obrysy: [], sirka: zdroj.glyfy[n].sirka }; }
        glyfy.set(klic, g);
        if (glyfy.size > 3000) glyfy.delete(glyfy.keys().next().value);
      }
      out.push({ g: glyfy.get(klic), n });
    }
    return out;
  }

  function kresliText(cv, zdroj, s, text, vyska) {
    const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    const ctx = cv.getContext('2d'), B = A.barvy();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const i = zdroj.info, rada = glyfyTextu(zdroj, s, text);
    const celkem = rada.reduce((a, x, j) => a + x.g.sirka + (j ? P.kernPar(zdroj, rada[j - 1].n, x.n) : 0), 0) || 1;
    const vys = Math.max(i.ascender, i.vyskaVerzalek * 1.25) - Math.min(i.descender, -i.upm * 0.3);
    const k = Math.min((h * (vyska || 0.8)) / vys, (w - 16) / celkem);
    let x = Math.max(8, (w - celkem * k) / 2);
    const zakl = h / 2 + (i.vyskaVerzalek / 2) * k;
    ctx.fillStyle = B.plna;
    rada.forEach((r, j) => {
      if (j) x += P.kernPar(zdroj, rada[j - 1].n, r.n) * k;
      ctx.beginPath(); P.kresliObrysy(ctx, r.g.obrysy, [k, 0, 0, -k, x, zakl]); ctx.fill('nonzero');
      x += r.g.sirka * k;
    });
  }

  /* ---------- rozhraní ---------- */
  async function sestav() {
    sestaveno = true;
    koren.innerHTML = '';
    let seznam = [];
    try { seznam = (await FONTY.seznam()).filter(f => !f.pismo || f.pismo === 'latinka'); } catch (e) { /* knihovna nedostupná */ }
    const vyberZakladu = el('select', { 'aria-label': 'Základní písmo' },
      [el('option', { value: '', text: 'doporučené pro styl' }), el('option', { value: 'projekt', text: 'otevřený projekt (' + A.font.info.rodina + ')' })]
        .concat(seznam.map(f => el('option', { value: f.id, text: f.nazev }))));
    vyberZakladu.value = st.zaklad;
    vyberZakladu.addEventListener('change', () => { st.zaklad = vyberZakladu.value; uloz(); obnovNahledy(); });
    const sila = el('input', { type: 'range', min: 0.2, max: 2, step: 0.1, value: st.sila, 'aria-label': 'Síla efektu' });
    const silaTxt = el('span', { class: 'mala', text: Math.round(st.sila * 100) + ' %' });
    sila.addEventListener('input', () => { silaTxt.textContent = Math.round(sila.value * 100) + ' %'; });
    sila.addEventListener('change', () => { st.sila = +sila.value; uloz(); obnovNahledy(); });
    const sem = el('input', { type: 'number', value: st.seminko, min: 1, 'aria-label': 'Semínko', style: 'width:70px' });
    sem.addEventListener('change', () => { st.seminko = Math.max(1, Math.round(+sem.value || 1)); uloz(); obnovNahledy(); });
    const kostka = el('button', { type: 'button', class: 'tl', text: '🎲 Jiná varianta', title: 'Náhodné semínko – stejný styl, jiné kapky, trny a poskakování', onclick: () => { st.seminko = 1 + Math.floor(Math.random() * 9999); sem.value = st.seminko; uloz(); obnovNahledy(); } });
    const text = el('input', { type: 'text', value: st.text, 'aria-label': 'Text náhledu' });
    text.addEventListener('input', () => { st.text = text.value; uloz(); clearTimeout(text._t); text._t = setTimeout(obnovVelky, 200); });
    const sada = el('select', { 'aria-label': 'Znaková sada' }, [['cesky', 'čeština + latinka (rychlé)'], ['vse', 'všechny glyfy písma']].map(([v, t]) => { const o = el('option', { value: v, text: t }); if (v === st.sada) o.selected = true; return o; }));
    sada.addEventListener('change', () => { st.sada = sada.value; uloz(); });
    const tlVytvorit = el('button', { type: 'button', class: 'tl hlavni', text: '✨ Vytvořit font', onclick: vytvor });
    const prubeh = el('span', { class: 'poznamka', id: 'genPrubeh' });

    // vlastní kombinace (jen pokročilý režim)
    const efekty = el('div', { class: 'gen-efekty' });
    for (const sk of P.GENERATOR_SKUPINY) {
      efekty.append(el('h4', { text: sk }));
      for (const [id, nazev] of P.GENERATOR_EFEKTY.filter(e => e[3] === sk)) {
        const c = el('input', { type: 'checkbox' }); c.checked = st.vlastni.includes(id);
        c.addEventListener('change', () => {
          st.vlastni = P.GENERATOR_EFEKTY.map(e => e[0]).filter(x => x === id ? c.checked : st.vlastni.includes(x));
          vyberStyl('vlastni');   // zaškrtnutý efekt rovnou ukáže vlastní kombinaci
        });
        efekty.append(el('label', { class: 'mala' }, [c, nazev]));
      }
    }
    const zrusit = el('button', { type: 'button', class: 'tl', text: 'Zrušit výběr efektů', onclick: () => { st.vlastni = []; uloz(); for (const c of efekty.querySelectorAll('input')) c.checked = false; if (st.styl === 'vlastni') obnovNahledy(); } });
    const hladke = el('input', { type: 'checkbox' }); hladke.checked = st.hladke;
    hladke.addEventListener('change', () => { st.hladke = hladke.checked; vyberStyl('vlastni'); });

    const velky = el('canvas', { class: 'gen-velky', 'aria-label': 'Náhled vybraného stylu' });
    const galerie = el('div', { class: 'gen-galerie' });
    const styly = P.GENERATOR_STYLY.concat([{ id: 'vlastni', nazev: 'Vlastní kombinace', ikona: '🧪', pokrocile: true }]);
    for (const s of styly) {
      const b = el('button', { type: 'button', class: 'gen-styl' + (s.pokrocile ? ' pokrocile' : ''), 'data-styl': s.id, 'aria-pressed': String(st.styl === s.id), onclick: () => vyberStyl(s.id) },
        [el('canvas', { 'aria-hidden': 'true' }), el('span', { text: s.ikona + ' ' + s.nazev })]);
      galerie.append(b);
    }
    koren.append(
      el('aside', { class: 'gen-ovl' }, [
        el('h3', { text: 'Generátor písma' }),
        el('p', { class: 'poznamka', text: 'Vyberte styl – z volného písma vznikne nový font s efektem (kapky, trny, pixely, neon…). Výsledek se otevře jako nový projekt a jde dál upravovat i stáhnout.' }),
        el('label', { class: 'pole-gen' }, ['Text náhledu', text]),
        el('label', { class: 'pole-gen' }, ['Základní písmo', vyberZakladu]),
        el('label', { class: 'pole-gen' }, [el('span', {}, ['Síla efektu ', silaTxt]), sila]),
        el('div', { class: 'pole-gen' }, [el('span', { text: 'Varianta (semínko)' }), el('div', { class: 'tlacitka' }, [sem, kostka])]),
        el('label', { class: 'pole-gen' }, ['Znaky', sada]),
        el('div', { class: 'pole-gen pokrocile' }, [el('span', { text: 'Vlastní kombinace efektů (' + P.GENERATOR_EFEKTY.length + ') – zaškrtněte, co chcete spojit; použijí se v pořadí skupin' }), efekty,
          el('label', { class: 'mala' }, [hladke, 'proložit křivkami (jinak ostré hrany)']), el('div', { class: 'tlacitka' }, [zrusit])]),
        el('div', { class: 'tlacitka' }, [tlVytvorit]), prubeh,
        el('p', { class: 'poznamka', text: 'Písma z knihovny jsou pod licencí SIL OFL – odvozený font se smí šířit pod stejnou licencí a pod novým názvem (generátor ho přejmenuje sám).' })
      ]),
      el('div', { class: 'gen-hlavni' }, [velky, galerie])
    );
    obnovNahledy();
  }

  function vyberStyl(id) {
    st.styl = id; uloz();
    for (const x of koren.querySelectorAll('.gen-styl')) x.setAttribute('aria-pressed', String(x.dataset.styl === id));
    if (id === 'vlastni') {   // náhled vlastní kombinace na její kartě
      const b = koren.querySelector('.gen-styl[data-styl=vlastni]');
      zakladProStyl(styl()).then(z => kresliText(b.querySelector('canvas'), z, styl(), 'Aa', 0.95)).catch(() => {});
    }
    obnovVelky();
  }

  let generace = 0;
  async function obnovNahledy() {
    const moje = ++generace;
    obnovVelky();
    for (const b of koren.querySelectorAll('.gen-styl')) {
      if (moje !== generace) return;
      const s = b.dataset.styl === 'vlastni' ? P.vlastniStyl(st.vlastni, st.hladke) : P.GENERATOR_STYLY.find(x => x.id === b.dataset.styl);
      try {
        const z = await zakladProStyl(s);
        await new Promise(r => setTimeout(r, 0));   // ať se stránka mezi kartami překreslí
        if (moje !== generace) return;
        kresliText(b.querySelector('canvas'), z, s, 'Aa', 0.95);
      } catch (e) { console.warn(e); }
    }
  }
  async function obnovVelky() {
    const cv = koren.querySelector('.gen-velky');
    if (!cv) return;
    try { kresliText(cv, await zakladProStyl(styl()), styl(), st.text || 'Aa', 0.8); }
    catch (e) { A.zprava('Náhled se nepodařil: ' + e.message, true); }
  }

  async function vytvor() {
    if (bezi) return;
    if (st.styl === 'vlastni' && !st.vlastni.length) { A.zprava('Vyberte aspoň jeden efekt.', true); return; }
    bezi = true;
    const prubeh = document.getElementById('genPrubeh');
    try {
      const s = styl(), zdroj = await zakladProStyl(s);
      const { font, nazvy } = P.zalozGenerovanyFont(zdroj, s, { sada: st.sada });
      for (let i = 0; i < nazvy.length; i++) {
        const n = nazvy[i];
        const g = P.generujGlyf(zdroj, zdroj.glyfy[n], s, { sila: st.sila, seminko: st.seminko });
        if (font.glyfy[n]) font.glyfy[n] = g; else P.pridejGlyf(font, g);
        if (i % 20 === 19) {   // po dávkách, ať stránka nezamrzne a ukazuje průběh
          prubeh.textContent = 'Generuji ' + (i + 1) + ' / ' + nazvy.length + '…';
          await new Promise(r => setTimeout(r, 0));
        }
      }
      P.dokonciGenerovanyFont(zdroj, font);
      A.otevriFont(font);
      prubeh.textContent = '';
      A.prepniPohled('znaky');
      A.zprava('Hotovo: „' + font.info.rodina + '“ (' + font.poradi.length + ' glyfů). Předchozí projekt zůstal uložený v Projektech.');
    } catch (e) {
      console.error(e);
      prubeh.textContent = '';
      A.zprava('Generování selhalo: ' + e.message, true);
    } finally { bezi = false; }
  }

  A.na('pohled', p => { if (p === 'generator') { if (!sestaveno) sestav(); else obnovNahledy(); } });
  A.na('font', () => { sestaveno = false; glyfy.clear(); });
  A.na('zmena', () => { if (st.zaklad === 'projekt') glyfy.clear(); });
  A.na('tema', () => { if (A.pohled === 'generator') obnovNahledy(); });
  window.addEventListener('resize', () => { if (A.pohled === 'generator') { clearTimeout(vytvor._rs); vytvor._rs = setTimeout(obnovNahledy, 200); } });
  A.generator = { sestav, vytvor };
})();

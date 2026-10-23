/* ============================================================
   Písmolijna – ui/app.js
   Hlavní nabídka, akce, přepínání pohledů, globální zkratky,
   téma a start aplikace.
   ============================================================ */
(function () {
  'use strict';
  const P = window.PSL, A = window.PSLAPP, D = A.dialogy, E = A.editor;
  const el = A.el;
  const ma = fn => typeof P[fn] === 'function';

  /* ---------- pohledy ---------- */
  A.prepniPohled = function (p) {
    if (A.pohled === p) return;
    A.pohled = p;
    for (const s of document.querySelectorAll('.pohled')) s.hidden = s.dataset.pohled !== p;
    for (const b of document.querySelectorAll('#karty button')) b.setAttribute('aria-selected', String(b.dataset.pohled === p));
    A.vyhlas('pohled', p);
  };
  for (const b of document.querySelectorAll('#karty button')) b.addEventListener('click', () => {
    if (b.dataset.pohled === 'glyf' && !A.aktualni) {
      const v = A.vybraneGlyfy();
      const n = v[0] || A.font.poradi.find(x => !P.glyfJePrazdny(A.font.glyfy[x]) && x !== '.notdef') || A.font.poradi[0];
      if (n) { A.otevriGlyf(n); return; }
    }
    A.prepniPohled(b.dataset.pohled);
  });

  /* ---------- akce ---------- */
  const AKCE = {
    novy: () => D.novyFont(),
    otevrit: () => D.otevriSoubor(),
    knihovna: () => D.zKnihovny(),
    projekty: () => D.projekty(),
    start: () => D.start(),
    ulozitProjekt: () => D.export('projekt'),
    exportTTF: () => D.export('ttf'),
    exportOTF: () => D.export('otf'),
    exportWOFF: () => D.export('woff'),
    exportSVG: () => D.export('svg'),
    exportCSS: () => D.export('css'),
    exportGlyfSVG: () => D.export('glyfsvg'),
    doFontuWebu: () => D.doFontuWebu(),
    svgDoGlyfu: () => D.svgDoGlyfu(),
    obrazekPozadi: () => D.obrazekPozadi(),
    referencePozadi: () => D.referencePozadi(),
    rukopis: () => D.rukopis(),
    zpet: () => A.zpet(),
    znovu: () => A.znovu(),
    kopiruj: () => (A.pohled === 'glyf' ? E.kopiruj() : AKCE.kopirujGlyfy()),
    vloz: () => (A.pohled === 'glyf' ? E.vloz() : AKCE.vlozGlyfy()),
    vlozOdkazem: () => vlozOdkazem(),
    vyberVse: () => (A.pohled === 'glyf' ? E.vyberVse() : null),
    smaz: () => (A.pohled === 'glyf' ? E.smazVyber() : AKCE.smazGlyfy()),
    kopirujGlyfy: () => {
      const v = A.vybraneGlyfy();
      if (!v.length) { A.zprava('Vyberte glyfy v mřížce.'); return; }
      A.schranka = { druh: 'glyfy', glyfy: v.map(n => P.klonuj(A.font.glyfy[n])) };
      A.zprava('Zkopírováno glyfů: ' + v.length + '.');
    },
    vlozGlyfy: () => {
      const s = A.schranka;
      if (!s) { A.zprava('Schránka je prázdná.'); return; }
      const cil = A.mrizka.vybranePozice();
      if (!cil.length) { A.zprava('Vyberte cílové buňky.'); return; }
      const zdroj = s.druh === 'glyfy' ? s.glyfy : [{ obrysy: s.obrysy, komponenty: s.komponenty, sirka: s.sirka }];
      const jmena = [];
      A.zmen('Vložit glyfy', { glyfy: cil.map(c => c.nazev).filter(Boolean) }, () => {
        cil.forEach((c, i) => {
          const z = zdroj[i % zdroj.length];
          const g = c.nazev ? A.font.glyfy[c.nazev] : P.glyfProZnak(A.font, c.cp, true);
          g.obrysy = P.klonuj(z.obrysy || []);
          g.komponenty = P.klonuj(z.komponenty || []).filter(k => k.glyf !== g.nazev);
          g.kotvy = P.klonuj(z.kotvy || []);
          g.sirka = z.sirka;
          jmena.push(g.nazev);
        });
      });
      A.zprava('Vloženo do ' + jmena.length + ' glyfů.');
    },
    vymazGlyfy: () => {
      const v = A.vybraneGlyfy();
      A.zmen('Vymazat obrysy', { glyfy: v }, () => { for (const n of v) { const g = A.font.glyfy[n]; g.obrysy = []; g.komponenty = []; } });
    },
    smazGlyfy: async () => {
      const v = A.vybraneGlyfy().filter(n => n !== '.notdef');
      if (!v.length) return;
      if (!(await Dialog.potvrd('Smazat ' + (v.length === 1 ? 'glyf „' + v[0] + '“' : v.length + ' glyfů') + ' z fontu? (Ctrl+Z vrátí.)'))) return;
      A.zmen('Smazat glyfy', { cely: true }, () => { for (const n of v) P.smazGlyf(A.font, n); });
    },
    novyGlyf: async () => {
      const n = await Dialog.zeptej('Název nového glyfu (např. a.alt, f_f_i, ornament.1):', 'a.alt');
      if (!n) return;
      const nazev = n.trim();
      if (!P.platnyNazev(nazev)) { A.zprava('Neplatný název (jen písmena bez diakritiky, číslice, tečka, podtržítko).', true); return; }
      if (A.font.glyfy[nazev]) { A.otevriGlyf(nazev); return; }
      A.zmen('Nový glyf', { glyfy: [] }, () => {
        const zaklad = A.font.glyfy[nazev.split('.')[0]];
        const g = P.novyGlyf(nazev, P.unicodeZNazvu(nazev), zaklad ? zaklad.sirka : Math.round(A.font.info.upm * 0.6));
        if (zaklad && nazev.indexOf('.') > 0) { g.obrysy = P.klonuj(P.plneObrysy(A.font, zaklad)); }
        P.pridejGlyf(A.font, g);
      });
      A.otevriGlyf(nazev);
    },
    otevritGlyf: () => {
      const p = A.mrizka.vybranePozice()[0];
      if (p) A.mrizka.otevri(p); else A.zprava('Vyberte buňku v mřížce.');
    },
    info: () => D.info(),
    mezeryJako: () => D.mezeryJako(),
    obtahni: () => D.obtahni(),
    zesil: () => D.zesil(),
    kurziva: () => D.kurziva(),
    transformace: () => D.transformaceFontu(),
    akcenty: () => D.akcenty(),
    autoMezery: () => D.autoMezery(),
    autoKerning: () => D.autoKerning(),
    kapitalky: () => D.kapitalky(),
    interpolace: () => D.interpolace(),
    sjednotit: () => D.hromadne('Sjednotit', g => { if (!g.obrysy.length) return false; P.sjednot(g, null); }),
    opravSmer: () => D.hromadne('Opravit směr', g => { ma('opravSmerGlyfu') ? P.opravSmerGlyfu(g) : P.opravSmer(g.obrysy); }),
    extremy: () => D.hromadne('Přidat extrémy', g => { g.obrysy.forEach(o => P.pridejExtremy(o)); }),
    zjednodusit: () => D.hromadne('Zjednodušit', g => { ma('zjednodusGlyf') ? P.zjednodusGlyf(g, 1.5) : g.obrysy.forEach(o => P.vycisti(o)); }),
    zaokrouhlit: () => D.hromadne('Zaokrouhlit', g => { g.obrysy.forEach(o => P.zaokrouhli(o)); }),
    rozlozit: () => D.hromadne('Rozložit komponenty', g => { if (!(g.komponenty || []).length) return false; P.rozlozKomponenty(A.font, g); }),
    zrcadlitVodorovne: () => D.hromadne('Zrcadlit vodorovně', g => { if (P.glyfJePrazdny(g)) return false; P.transformujGlyf(g, [-1, 0, 0, 1, g.sirka, 0], null); }),
    zrcadlitSvisle: () => D.hromadne('Zrcadlit svisle', g => {
      const o = P.obalkaGlyfu(A.font, g); if (!o) return false;
      P.transformujGlyf(g, [1, 0, 0, -1, 0, o.y0 + o.y1], null);
    }),
    vystredit: () => D.hromadne('Vystředit', g => { const o = P.obalkaGlyfu(A.font, g); if (!o) return false; const m = Math.round((g.sirka - (o.x1 - o.x0)) / 2); P.nastavLsb(A.font, g, m); P.nastavRsb(A.font, g, m); }),
    kontrola: () => A.prepniPohled('kontrola'),
    generator: () => A.prepniPohled('generator'),
    nahled: () => A.prepniPohled('nahled'),
    napoveda: () => D.napoveda(),
    vodidlo: async () => {
      const t = await Dialog.zeptej('Vodorovné vodítko ve výšce (jednotky), např. 520 nebo „x 300“ pro svislé:', '');
      if (!t) return;
      const m = /^\s*(x\s+)?(-?\d+(?:\.\d+)?)\s*(.*)$/.exec(t);
      if (!m) return;
      A.zmen('Vodítko', { vodidla: true }, () => { A.font.vodidla.push({ osa: m[1] ? 'x' : 'y', poz: +m[2], nazev: m[3] || '' }); });
    },
    smazVodidla: () => A.zmen('Smazat vodítka', { vodidla: true }, () => { A.font.vodidla = []; })
  };
  A.akce = function (n) {
    const fn = AKCE[n];
    if (!fn) { console.warn('Neznámá akce', n); return; }
    if (!A.font && !['novy', 'otevrit', 'knihovna', 'projekty', 'start', 'napoveda', 'rukopis'].includes(n)) return;
    try { const r = fn(); if (r && r.catch) r.catch(e => { console.error(e); A.zprava('Chyba: ' + e.message, true); }); }
    catch (e) { console.error(e); A.zprava('Chyba: ' + e.message, true); }
  };

  /* Vložit odkazem: obsah schránky (glyfy) jako komponenty – jako „Paste Reference“ ve FontForge. */
  function vlozOdkazem() {
    const s = A.schranka;
    if (!s || s.druh !== 'glyfy') { A.zprava('Nejdřív zkopírujte glyfy v mřížce (Ctrl+C).'); return; }
    const zdroj = s.glyfy.map(g => g.nazev).filter(n => A.font.glyfy[n]);
    if (A.pohled === 'glyf' && A.aktualni) {
      E.zmen('Vložit odkazem', () => { const g = A.font.glyfy[A.aktualni]; for (const n of zdroj) if (n !== g.nazev) g.komponenty.push({ glyf: n, m: [1, 0, 0, 1, 0, 0] }); });
      return;
    }
    const cil = A.mrizka.vybranePozice();
    A.zmen('Vložit odkazem', { glyfy: cil.map(c => c.nazev).filter(Boolean) }, () => {
      cil.forEach((c, i) => {
        const g = c.nazev ? A.font.glyfy[c.nazev] : P.glyfProZnak(A.font, c.cp, true);
        const z = zdroj[i % zdroj.length];
        if (z === g.nazev) return;
        g.obrysy = []; g.komponenty = [{ glyf: z, m: [1, 0, 0, 1, 0, 0] }]; g.sirka = A.font.glyfy[z].sirka;
      });
    });
  }

  /* ---------- nabídka ---------- */
  const MENU = [
    ['Soubor', [
      ['✨ Nový font…', 'novy'], ['📂 Otevřít soubor…', 'otevrit', 'TTF, OTF, WOFF, .pismo.json'], ['📚 Písmo z knihovny webu…', 'knihovna'], ['🗂️ Projekty v prohlížeči…', 'projekty'],
      '-', ['💾 Uložit projekt (.pismo.json)', 'ulozitProjekt', 'Ctrl+S'],
      '-', '#Stáhnout font', ['TrueType (.ttf)', 'exportTTF', 'Ctrl+E'], ['OpenType CFF (.otf)', 'exportOTF'], ['WOFF pro web (.woff)', 'exportWOFF'], ['CSS s vloženým písmem', 'exportCSS'], ['SVG font', 'exportSVG'], ['Aktuální glyf jako SVG', 'exportGlyfSVG'],
      '-', ['🔤 Přidat do písem webu', 'doFontuWebu', '3D text, Převodník…'],
      '-', ['📥 SVG do glyfu…', 'svgDoGlyfu'], ['🖼️ Obrázek do pozadí glyfu…', 'obrazekPozadi'], ['✍️ Rukopisné písmo ze skenu…', 'rukopis']
    ]],
    ['Úpravy', [
      ['↶ Zpět', 'zpet', 'Ctrl+Z'], ['↷ Znovu', 'znovu', 'Ctrl+Y'],
      '-', ['Kopírovat', 'kopiruj', 'Ctrl+C'], ['Vložit', 'vloz', 'Ctrl+V'], ['Vložit odkazem (komponenty)', 'vlozOdkazem'], ['Vybrat vše', 'vyberVse', 'Ctrl+A'], ['Smazat', 'smaz', 'Delete'],
      '-', ['＋ Nový glyf (bez Unicode)…', 'novyGlyf'], ['Vymazat obrysy vybraných glyfů', 'vymazGlyfy']
    ]],
    ['Glyf', [
      '#Platí pro otevřený glyf, v mřížce pro vybrané',
      ['Sjednotit (odstranit překryvy)', 'sjednotit'], ['Opravit směr obrysů', 'opravSmer'], ['Přidat extrémy', 'extremy'], ['Zjednodušit', 'zjednodusit'], ['Zaokrouhlit na celá čísla', 'zaokrouhlit'], ['Rozložit komponenty', 'rozlozit'],
      '-', ['⇋ Zrcadlit vodorovně', 'zrcadlitVodorovne'], ['⇵ Zrcadlit svisle', 'zrcadlitSvisle'],
      '-', ['〰️ Obtáhnout tahem…', 'obtahni'], ['🅱️ Zesílit / zúžit…', 'zesil'], ['𝘐 Kurzíva…', 'kurziva'], ['⤡ Transformovat…', 'transformace'],
      '-', ['Vystředit v šířce', 'vystredit'], ['Mezery jako jiný glyf…', 'mezeryJako'], ['Jiný glyf do pozadí…', 'referencePozadi']
    ]],
    ['Písmo', [
      ['ℹ️ Informace o fontu…', 'info'],
      '-', ['✨ Generátor stylových písem', 'generator'], ['🇨🇿 Sestavit písmena s diakritikou…', 'akcenty'], ['🔠 Vytvořit kapitálky', 'kapitalky'], ['🔀 Interpolace s jiným řezem…', 'interpolace'],
      '-', ['Automatické mezery', 'autoMezery'], ['🤖 Automatický kerning…', 'autoKerning'],
      '-', ['Přidat vodítko…', 'vodidlo'], ['Smazat vodítka', 'smazVodidla'],
      '-', ['🩺 Kontrola chyb', 'kontrola'], ['👁️ Náhled', 'nahled']
    ]],
    ['Nápověda', [['❓ Nápověda a zkratky', 'napoveda', 'F1'], ['🏠 Úvodní okno', 'start']]]
  ];
  /* Položky nabídky jen pro pokročilý režim. */
  const POKR_AKCE = new Set(['exportOTF', 'exportSVG', 'exportCSS', 'exportGlyfSVG', 'svgDoGlyfu', 'vlozOdkazem', 'vymazGlyfy', 'novyGlyf',
    'extremy', 'zjednodusit', 'zaokrouhlit', 'rozlozit', 'transformace', 'mezeryJako', 'referencePozadi', 'kapitalky', 'interpolace',
    'autoKerning', 'vodidlo', 'smazVodidla', 'kontrola']);
  const elMenu = document.getElementById('menu');
  let otevrene = null;
  function zavriMenu() { if (otevrene) { otevrene.panel.remove(); otevrene.tl.setAttribute('aria-expanded', 'false'); otevrene = null; } }
  for (const [nazev, polozky] of MENU) {
    const tl = el('button', { type: 'button', class: 'menu-tl', text: nazev, 'aria-haspopup': 'true', 'aria-expanded': 'false' });
    const obal = el('div', {}, tl);
    const otevri = () => {
      zavriMenu();
      const panel = el('div', { class: 'rozbal', role: 'menu' });
      const jednoduchy = A.rezim === 'jednoduchy';
      for (const p of polozky) {
        if (jednoduchy && Array.isArray(p) && POKR_AKCE.has(p[1])) continue;
        if (p === '-') { if (panel.lastChild && panel.lastChild.tagName !== 'HR') panel.append(el('hr')); continue; }
        if (typeof p === 'string' && p[0] === '#') { panel.append(el('div', { class: 'nadpis', text: p.slice(1) })); continue; }
        const [text, akce, zkr] = p;
        const vyp = (akce === 'zpet' && !A.lzeZpet()) || (akce === 'znovu' && !A.lzeZnovu()) || (!A.font && !['novy', 'otevrit', 'knihovna', 'projekty', 'start', 'napoveda', 'rukopis'].includes(akce));
        panel.append(el('button', { type: 'button', role: 'menuitem', disabled: vyp, onclick: () => { zavriMenu(); A.akce(akce); } }, [el('span', { text }), zkr ? el('span', { class: 'zkr', text: zkr }) : null]));
      }
      while (panel.lastChild && panel.lastChild.tagName === 'HR') panel.lastChild.remove();
      document.body.append(panel);
      const r = tl.getBoundingClientRect();
      panel.style.left = Math.max(4, Math.min(r.left, window.innerWidth - panel.offsetWidth - 4)) + 'px';
      panel.style.top = (r.bottom + 2) + 'px';
      tl.setAttribute('aria-expanded', 'true');
      otevrene = { tl, panel };
      const prvni = panel.querySelector('button:not(:disabled)');
      if (prvni && document.activeElement === tl) prvni.focus();
    };
    tl.addEventListener('click', () => { if (otevrene && otevrene.tl === tl) zavriMenu(); else otevri(); });
    tl.addEventListener('mouseenter', () => { if (otevrene && otevrene.tl !== tl) otevri(); });
    elMenu.append(obal);
  }
  document.addEventListener('pointerdown', e => { if (otevrene && !otevrene.panel.contains(e.target) && !otevrene.tl.contains(e.target)) zavriMenu(); });
  document.addEventListener('keydown', e => {
    if (!otevrene) return;
    if (e.key === 'Escape') { const t = otevrene.tl; zavriMenu(); t.focus(); e.preventDefault(); e.stopPropagation(); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const b = Array.from(otevrene.panel.querySelectorAll('button:not(:disabled)'));
      const i = b.indexOf(document.activeElement);
      b[(i + (e.key === 'ArrowDown' ? 1 : -1) + b.length) % b.length].focus();
    }
  }, true);

  /* ---------- tlačítka v mřížce ---------- */
  document.getElementById('tlNovyGlyf').onclick = () => A.akce('novyGlyf');
  document.getElementById('tlOtevritGlyf').onclick = () => A.akce('otevritGlyf');
  document.getElementById('tlSmazGlyfy').onclick = () => A.akce('smazGlyfy');
  document.getElementById('nazevFontu').onclick = () => A.akce('info');

  /* ---------- režim jednoduchý / pokročilý ----------
     Dosavadní plné rozhraní = pokročilý režim; nový uživatel začíná v jednoduchém. */
  A.nastavRezim = function (r) {
    A.rezim = r === 'pokrocily' ? 'pokrocily' : 'jednoduchy';
    A.nastaveni.rezim = A.rezim; A.ulozNastaveni();
    document.body.classList.toggle('jednoduchy', A.rezim === 'jednoduchy');
    for (const b of document.querySelectorAll('.rezim button')) b.setAttribute('aria-pressed', String(b.dataset.rezim === A.rezim));
    if (A.rezim === 'jednoduchy') {
      if (A.pohled === 'metriky' || A.pohled === 'kontrola') A.prepniPohled('znaky');
      if (['nuz', 'meritko', 'kotva'].includes(E.nastroj)) E.zvolNastroj('vyber');
    }
    A.vyhlas('rezim', A.rezim);
  };
  for (const b of document.querySelectorAll('.rezim button')) b.addEventListener('click', () => A.nastavRezim(b.dataset.rezim));
  A.nastavRezim(A.nastaveni.rezim || 'jednoduchy');

  /* ---------- globální zkratky ---------- */
  document.addEventListener('keydown', e => {
    if (document.querySelector('dialog[open]')) return;
    const t = e.target, vPoli = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    const ctrl = e.ctrlKey || e.metaKey, kl = (e.key || '').toLowerCase();
    if (e.key === 'F1') { e.preventDefault(); A.akce('napoveda'); return; }
    if (!ctrl || !A.font) return;
    if (kl === 's' && !e.shiftKey) { e.preventDefault(); A.akce('ulozitProjekt'); return; }
    if (kl === 'e' && !e.shiftKey) { e.preventDefault(); A.akce('exportTTF'); return; }
    if (kl === 'o' && !e.shiftKey) { e.preventDefault(); A.akce('otevrit'); return; }
    if (vPoli) return;
    if (kl === 'z' && !e.shiftKey) { e.preventDefault(); A.zpet(); return; }
    if ((kl === 'z' && e.shiftKey) || kl === 'y') { e.preventDefault(); A.znovu(); return; }
  });

  /* ---------- název fontu v liště ---------- */
  function obnovNazev() {
    if (!A.font) return;
    const i = A.font.info;
    document.getElementById('nazevFontu').textContent = i.rodina + ' · ' + i.styl;
    document.title = '🅰️ ' + i.rodina + ' – Písmolijna';
  }
  A.na('font', obnovNazev);
  A.na('info', obnovNazev);
  A.na('zmena', co => { if (!co || co.vse || (co.rozsah && (co.rozsah.info || co.rozsah.cely))) obnovNazev(); });

  /* ---------- téma (přepínač rozcestníku posílá postMessage) ---------- */
  new MutationObserver(() => A.vyhlas('tema')).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  /* ---------- úzké okno: tlačítko bloků ---------- */
  const tlBloky = el('button', { type: 'button', class: 'tl jen-uzke', text: '☰ Bloky', onclick: () => document.getElementById('bloky').classList.toggle('otevrene') });
  document.querySelector('.znaky-lista').prepend(tlBloky);

  /* ---------- start ---------- */
  async function start() {
    let id = null;
    try { id = localStorage.getItem('webapp_pismolijna_posledni'); } catch (e) { /* nevadí */ }
    if (id) {
      try {
        const f = await A.nactiProjekt(id);
        if (f) { A.otevriFont(f, id); return; }
      } catch (e) { console.warn(e); }
    }
    D.start();
  }
  start();
})();

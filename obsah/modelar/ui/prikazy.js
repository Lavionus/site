/* Modelář 3D – příkazy: jeden seznam akcí s klávesami a podmínkou povolení.
   Používá ho lišta (tlačítka data-prikaz), klávesnice a později paleta Ctrl+K.
   Šipky posouvají výběr v pracovní rovině ve směru nejbližším obrazovce
   (o krok mřížky, se Shiftem ×10), Ctrl+↑/↓ ho zvedá a spouští. */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';
  const V = THREE.Vector3;

  M.vytvorPrikazy = function (S) {
    const vybrano = () => M.app.vyber.length > 0;
    const volne = () => M.vybraneVolne().length > 0;
    const stredVyberu = () => M.obalkaVice(M.vybraneUzly()).stred;

    const P = [
      { id: 'zpet', nazev: 'Zpět', klavesy: ['Ctrl+Z'], akce: M.zpet, povoleno: () => M.historie.muzeZpet() },
      { id: 'znovu', nazev: 'Znovu', klavesy: ['Ctrl+Y', 'Ctrl+Shift+Z'], akce: M.znovu, povoleno: () => M.historie.muzeZnovu() },
      { id: 'duplikovat', nazev: 'Duplikovat (opakovaně = pole)', klavesy: ['Ctrl+D'], akce: M.duplikuj, povoleno: vybrano },
      { id: 'kopirovat', nazev: 'Kopírovat', klavesy: ['Ctrl+C'], akce: M.kopiruj, povoleno: vybrano },
      { id: 'tvary', nazev: 'Vložit tvar (nabídka Tvary s hledáním)', klavesy: ['A', 'Insert'], akce: () => M.otevriTvary(), povoleno: () => true },
      { id: 'vlozit', nazev: 'Vložit', klavesy: ['Ctrl+V'], akce: () => M.vloz(10), povoleno: () => !!M.app.schranka },
      { id: 'smazat', nazev: 'Smazat', klavesy: ['Delete', 'Backspace'], akce: M.smazVybrane, povoleno: volne },
      { id: 'vybratVse', nazev: 'Vybrat vše', klavesy: ['Ctrl+A'], akce: () => M.nastavVyber(M.app.dok.uzly.map(u => u.id)), povoleno: () => M.app.dok.uzly.length > 0 },
      { id: 'zrusitVyber', nazev: 'Zrušit výběr', klavesy: ['Escape'], akce: () => M.nastavVyber([]), povoleno: vybrano },
      { id: 'naDesku', nazev: 'Položit na desku / rovinu', klavesy: ['D'], povoleno: volne,
        akce: () => M.provedNaVybranych((d, ids) => M.polozNaRovinu(d, ids, M.rovina()), 'Položit') },
      { id: 'plochou', nazev: 'Položit plochou (klikni na stěnu)', klavesy: ['F'], povoleno: volne,
        akce: () => M.nastavRezim(M.app.rezim === 'plochou' ? null : 'plochou') },
      { id: 'rovina', nazev: 'Pracovní rovina (klikni na stěnu)', klavesy: ['W'], povoleno: () => true,
        akce: () => M.nastavRezim(M.app.rezim === 'rovina' ? null : 'rovina') },
      { id: 'rovinaZrusit', nazev: 'Pracovní rovina zpět na desku', klavesy: [], povoleno: () => !!M.app.rovina,
        akce: () => M.nastavRovinu(null) },
      { id: 'seskupit', nazev: 'Seskupit (díry se odečtou)', klavesy: ['Ctrl+G'], akce: M.seskupVybrane,
        povoleno: () => M.vybraneVolne().length > 1 },
      { id: 'rozdelit', nazev: 'Zrušit seskupení (rozložit skupinu na části)', klavesy: ['Ctrl+Shift+G'], akce: M.rozdelVybrane,
        povoleno: () => M.vybraneVolne().some(u => u.druh === 'skupina') },
      { id: 'pole', nazev: 'Pole (řada, kruh, spirála)', klavesy: [], povoleno: volne, akce: () => M.otevriPole() },
      { id: 'rozdelitRovinou', nazev: 'Rozdělit rovinou', klavesy: [], povoleno: () => M.vybraneVolne().length === 1, akce: () => M.otevriRez() },
      { id: 'vzorDer', nazev: 'Vzor děr na ploše (klikni na plochu)', klavesy: [], povoleno: () => true,
        akce: () => M.nastavRezim(M.app.rezim === 'vzorDer' ? null : 'vzorDer') },
      { id: 'struktura', nazev: 'Struktura na ploše – vzor do plochy, např. váleček na těsto (klikni na plochu)', klavesy: [], povoleno: () => true,
        akce: () => M.nastavRezim(M.app.rezim === 'struktura' ? null : 'struktura') },
      { id: 'obalSvg', nazev: 'Ovinout SVG kolem válce', klavesy: [], povoleno: () => M.vybraneVolne().length === 1, akce: () => M.otevriObal() },
      { id: 'zaoblitHrany', nazev: 'Zaoblit hrany (přesně)', klavesy: [], povoleno: () => M.vybraneVolne().length === 1, akce: () => M.otevriUpravuHran('zaobleni') },
      { id: 'srazitHrany', nazev: 'Srazit hrany (přesně)', klavesy: [], povoleno: () => M.vybraneVolne().length === 1, akce: () => M.otevriUpravuHran('srazeni') },
      // jen plná tělesa (trubka, torus, rámeček… už duté nebo tenké jsou)
      { id: 'odsadit', nazev: 'Odsadit stěny – vůle (zvětšit / zmenšit těleso o mm, přesně)', klavesy: [], povoleno: () => M.vybraneVolne().length === 1, akce: () => M.otevriOdsazeni() },
      { id: 'skorepina', nazev: 'Skořepina – vyhloubit (přesně, plná tělesa)', klavesy: [], povoleno: () => M.vybraneVolne().length === 1 && M.lzeSkorepinu(M.vybraneVolne()[0]),
        akce: () => M.otevriUpravuHran('skorepina') },
      { id: 'vule', nazev: 'Vůle mezi dvěma tělesy (nejmenší vzdálenost)', klavesy: [], povoleno: () => M.vybraneUzly().length === 2, akce: () => M.zmerVuli() },
      { id: 'mereni', nazev: 'Měřit (vzdálenost, úhel, poloměr)', klavesy: ['R'], povoleno: () => true,
        akce: () => M.app.rezim === 'mereni' ? M.nastavRezim(null) : M.otevriMereni() },
      { id: 'rezPohledu', nazev: 'Řez pohledem (nahlédnout dovnitř)', klavesy: [], povoleno: () => true, akce: () => M.otevriRezPohledu() },
      { id: 'poznamka', nazev: 'Poznámka nebo referenční bod (klikni do scény)', klavesy: ['N'], povoleno: () => true,
        akce: () => M.nastavRezim(M.app.rezim === 'poznamka' ? null : 'poznamka') },
      { id: 'poznamkySkryt', nazev: 'Ukázat / skrýt poznámky', klavesy: [], povoleno: () => M.poznamky(M.app.dok).length > 0, akce: () => M.prepniPoznamky() },
      { id: 'historie', nazev: 'Historie úprav (posuvník)', klavesy: [], povoleno: () => true, akce: () => M.otevriHistorii() },
      { id: 'vykres', nazev: 'Výkres – pohledy, řez, osy a kóty děr (PDF, SVG, DXF)', klavesy: [], povoleno: () => M.telesaKExportu(M.app.dok).length > 0, akce: () => M.otevriVykres() },
      { id: 'ulozitTvar', nazev: 'Uložit výběr jako vlastní tvar (Tvary → Moje tvary)', klavesy: [], povoleno: vybrano, akce: () => M.ulozitVlastniTvar() },
      { id: 'paleta', nazev: 'Paleta příkazů', klavesy: ['Ctrl+K'], povoleno: () => true, akce: () => M.otevriPaletu() },
      { id: 'zarovnat', nazev: 'Zarovnat (puntíky ve scéně)', klavesy: ['L'], povoleno: () => M.app.rezim === 'zarovnani' || (M.vybraneUzly().length > 1 && volne()),
        akce: () => M.prepniZarovnani() },
      { id: 'zrcadlit', nazev: 'Zrcadlit (šipky ve scéně)', klavesy: ['M'], povoleno: () => M.app.rezim === 'zrcadleni' || volne(),
        akce: () => M.prepniZrcadleni() },
      { id: 'pivot', nazev: 'Bod otáčení (klikni do scény)', klavesy: ['P'], povoleno: () => M.app.rezim === 'pivot' || volne(),
        akce: () => M.prepniPivot() },
      { id: 'pivotZrusit', nazev: 'Bod otáčení zpět na střed výběru', klavesy: [], povoleno: () => !!M.app.pivot, akce: () => M.nastavPivot(null) },
      { id: 'otocitKolemBodu', nazev: 'Otočit kolem bodu (úhel, osa, bod)', klavesy: [], povoleno: () => true, akce: () => M.otevriOtoceniKolemBodu() },
      { id: 'kontrolaTisku', nazev: 'Kontrola tisku (materiál, hmotnost, převisy, problémy)', klavesy: [], povoleno: () => true, akce: () => M.otevriKontroluTisku() },
      { id: 'zamerit', nazev: 'Zaměřit výběr (přiblížit vybraná tělesa)', klavesy: ['.'], povoleno: vybrano, akce: () => S.zamerit(M.app.vyber) },
      { id: 'koty', nazev: 'Ukázat / skrýt kóty vybraného tělesa (klik na číslo = nová velikost)', klavesy: [], povoleno: () => true, akce: () => M.prepniKoty() },
      { id: 'prevesy', nazev: 'Ukázat / skrýt převisy (plochy, které potřebují podpěry)', klavesy: [], povoleno: () => true, akce: () => M.prepniPrevesy() },
      { id: 'orientace', nazev: 'Nejlepší orientace pro tisk (nejméně převisů, velká plocha na desce)', klavesy: [], povoleno: () => M.app.dok.uzly.some(u => !u.skryto && !u.zamceno && u.role !== 'dira'), akce: () => M.orientujProTisk() },
      { id: 'rozmistit', nazev: 'Rozmístit tělesa na desce (vedle sebe pro tisk)', klavesy: [], povoleno: () => M.app.dok.uzly.some(u => !u.skryto && !u.zamceno), akce: () => M.rozmistitNaDesce() },
      { id: 'dira', nazev: 'Na díru', klavesy: ['H'], povoleno: volne, akce: () => M.upravVybrane({ role: 'dira' }, 'Na díru') },
      { id: 'teleso', nazev: 'Na těleso', klavesy: ['S'], povoleno: volne, akce: () => M.upravVybrane({ role: 'teleso' }, 'Na těleso') },
    ];
    ['X', 'Y', 'Z'].forEach((o, i) => P.push({
      id: 'zrcadlit' + o, nazev: 'Zrcadlit podle ' + o, klavesy: [], povoleno: volne,
      akce: () => M.provedNaVybranych((d, ids) => M.zrcadliUzly(d, ids, i, stredVyberu()), 'Zrcadlit ' + o),
    }));
    // stejné znění jako popisky tlačítek v nabídce Zarovnat
    const KDE = { min: ['vlevo', 'dopředu', 'dolů'], max: ['vpravo', 'dozadu', 'nahoru'] };
    ['X', 'Y', 'Z'].forEach((o, i) => ['min', 'stred', 'max'].forEach(kde => P.push({
      id: `zarovnat${o}_${kde}`, nazev: kde === 'stred' ? `Zarovnat na střed ${o}` : `Zarovnat ${KDE[kde][i]} (${o})`, klavesy: [],
      povoleno: () => M.app.vyber.length > 1,
      akce: () => M.provedNaVybranych((d, ids) => M.zarovnejUzly(d, ids, i, kde), 'Zarovnat'),
    })));
    const podleId = Object.fromEntries(P.map(p => [p.id, p]));
    M.PRIKAZY = P;

    M.spustPrikaz = function (id) {
      const p = podleId[id];
      if (!p || !p.povoleno()) return false;
      p.akce();
      return true;
    };

    // ------------------------------------------------------------ klávesnice
    /** Klávesa jako text „Ctrl+Shift+Z“; Shift se u samotného písmene nepočítá. */
    function zapis(e) {
      const ctrl = e.ctrlKey || e.metaKey, pismeno = e.key.length === 1;
      return (ctrl ? 'Ctrl+' : '') + (e.shiftKey && (ctrl || !pismeno) ? 'Shift+' : '') + (pismeno ? e.key.toUpperCase() : e.key);
    }
    const mapa = new Map();
    for (const p of P) for (const k of p.klavesy) mapa.set(k, p);

    /** Šipky: směr v rovině, který na obrazovce nejlépe odpovídá šipce. */
    function smerSipky(klic) {
      const [u, v, n] = M.rovina().osy.map(o => new V(...o));
      const k = S.kamera.aktivni();
      const vpravo = new V().setFromMatrixColumn(k.matrixWorld, 0);
      const nahoru = new V().setFromMatrixColumn(k.matrixWorld, 1);
      const cil = { ArrowRight: vpravo, ArrowLeft: vpravo.clone().negate(), ArrowUp: nahoru, ArrowDown: nahoru.clone().negate() }[klic];
      let nej = null, nejD = -Infinity;
      for (const c of [u, v, u.clone().negate(), v.clone().negate()]) { const d = c.dot(cil); if (d > nejD) { nejD = d; nej = c; } }
      return nej;
    }

    let posledniStisk = 0;
    document.addEventListener('pointerdown', () => { posledniStisk = performance.now(); }, true);
    document.addEventListener('keydown', e => {
      const cil = e.target;
      // Ctrl+D / G / K z pole inspektoru: rozepsanou hodnotu potvrdit a příkaz provést (prohlížeč by jinak
      // otevřel záložky a zkratka by v poli nedělala nic)
      if (cil && cil.tagName === 'INPUT' && cil.closest('#inspektor') && (e.ctrlKey || e.metaKey) && !e.altKey && ['d', 'g', 'k'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        cil.dispatchEvent(new Event('change'));
        cil.blur();
        S.renderer.domElement.focus({ preventScroll: true });
        const id = { d: 'duplikovat', g: e.shiftKey ? 'rozdelit' : 'seskupit', k: 'paleta' }[e.key.toLowerCase()];
        const p = podleId[id];
        if (p && p.povoleno()) p.akce();
        return;
      }
      // Ctrl+Z/Y v číselném poli inspektoru: zpět v modelu (ne textové zpět prohlížeče, které by vrátilo jiné pole)
      if (cil && cil.tagName === 'INPUT' && cil.closest('#inspektor') && (e.ctrlKey || e.metaKey) && !e.altKey && ['z', 'y'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        cil.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));   // rozepsaný text zahodit
        const p = podleId[e.key.toLowerCase() === 'y' || e.shiftKey ? 'znovu' : 'zpet'];
        if (p.povoleno()) p.akce();
        return;
      }
      // textová pole si klávesy nechají; přepínač, zaškrtávátko nebo tlačítko ne (fokus na volbě v panelu úprav
      // by jinak spolkl Ctrl+Z, i když panel slibuje „Ctrl+Z vrátí“)
      const textove = cil && ((cil.tagName === 'INPUT' && !['radio', 'checkbox', 'button', 'range', 'color'].includes(cil.type)) || cil.tagName === 'TEXTAREA' || cil.tagName === 'SELECT' || cil.isContentEditable);
      if (textove) return;
      // na přepínači, posuvníku či zaškrtávátku projdou jen kombinace s Ctrl (Zpět/Znovu…) – Delete by smazal tělesa
      if (cil && cil.tagName === 'INPUT' && !(e.ctrlKey || e.metaKey)) return;
      // šipky v otevřené nabídce: pohyb mezi položkami (Home/End na kraj)
      const nab = cil && cil.closest && cil.closest('.nabidka');
      const hledat = nab && nab.querySelector('input[type=search]');
      if (nab && ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
        // jen viditelné položky (hledání v nabídce Tvary schovává dlaždice) a bez křížků mazání
        const pol = [...nab.querySelectorAll('button:not(:disabled)')].filter(b => b.offsetParent !== null && !b.classList.contains('smaz-tvar'));
        const i = pol.indexOf(cil), n = pol.length;
        if (!n) return;
        e.preventDefault();
        // ↑ z první položky zpět do hledání
        if (hledat && i === 0 && (e.key === 'ArrowUp' || e.key === 'ArrowLeft')) { hledat.focus(); return; }
        const j = e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : (i + (e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1) + n) % n;
        pol[j].focus();
        return;
      }
      // v nabídce s hledáním: psaní a Backspace patří hledání (ne zkratkám – Backspace by smazal výběr)
      if (hledat && !e.ctrlKey && !e.metaKey && !e.altKey && (e.key.length === 1 || e.key === 'Backspace')) { hledat.focus(); return; }
      // v otevřené nabídce žádné zkratky (H, D, Delete… by měnily tělesa za ní)
      if (nab && e.key !== 'Escape') return;
      if (M.ovladaniBlokovano || M.modalniOkno()) return;
      // náhled pod myší (zarovnání, zrcadlení) se před příkazem zruší – jinak by příkaz zapsal do dočasného stavu
      if (M.app.uprava && !(M.zrusNahledy && M.zrusNahledy())) return;
      if (e.key.startsWith('Arrow')) {
        // tělesa posouvají šipky jen s fokusem na scéně (ne na tlačítku, v seznamu, nabídce ani panelu)
        if (cil && cil !== document.body && cil !== S.renderer.domElement && cil.closest && cil.closest('button, a, summary, [role], [tabindex], dialog, #seznam, .panel')) return;
        if (!volne()) return;
        e.preventDefault();
        const krok = Math.max(S.deska.krok, 0.1) * (e.shiftKey ? 10 : 1);
        let d;
        if ((e.ctrlKey || e.metaKey) && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
          d = new V(...M.rovina().osy[2]).multiplyScalar(e.key === 'ArrowUp' ? krok : -krok);
        } else d = smerSipky(e.key).multiplyScalar(krok);
        M.provedNaVybranych((dok, ids) => M.posunUzly(dok, ids, d.toArray()), 'Posun šipkami', { sloucit: 'sipky' });
        return;
      }
      const p = mapa.get(zapis(e));
      if (!p) return;
      if (e.altKey) return;
      e.preventDefault();
      if (p.povoleno()) p.akce();
    });

    // ------------------------------------------------------------ lišta a nabídky
    function obnovListu() {
      document.querySelectorAll('[data-prikaz]').forEach(b => {
        const p = podleId[b.dataset.prikaz];
        if (!p) return;
        b.disabled = !p.povoleno();
        if (p.id === 'zpet') b.title = 'Zpět' + (M.historie.popisZpet() ? ': ' + M.historie.popisZpet() : '') + ' (Ctrl+Z)';
        if (p.id === 'znovu') b.title = 'Znovu' + (M.historie.popisZnovu() ? ': ' + M.historie.popisZnovu() : '') + ' (Ctrl+Y)';
      });
      document.querySelectorAll('[data-nabidka]').forEach(b => {
        const pol = document.getElementById(b.dataset.nabidka);
        const polozky = [...pol.querySelectorAll('[data-prikaz]')];
        if (polozky.length) b.disabled = !polozky.some(x => !x.disabled);
      });
      document.querySelectorAll('[data-rezim]').forEach(b => b.setAttribute('aria-pressed', M.app.rezim === b.dataset.rezim ? 'true' : 'false'));
    }
    document.addEventListener('click', e => {
      const b = e.target.closest('[data-prikaz]');
      if (b && !b.disabled) {
        // fokus nejdřív na tlačítko nabídky: okno, které příkaz otevře, ho po zavření vrátí tam (ne na <body>)
        const nab = b.closest('.nabidka');
        if (nab) { const t = document.querySelector(`[data-nabidka="${nab.id}"]`); if (t) t.focus(); M.zavriNabidku(nab); }
        M.spustPrikaz(b.dataset.prikaz);
        return;
      }
      // klik, který je jen koncem přetažení tvaru z nabídky (puštěno nad lištou), nic neotevírá
      const otevri = e.target.closest('[data-nabidka]');
      // puštění taženého tvaru nad lištou vyrobí klik – ten nabídku neotevře (stisk začal ještě během tažení);
      // nový klik po tažení ano
      if (otevri && e.detail > 0 && (M.posledniTahKnihovny || 0) > posledniStisk - 1) return;
      document.querySelectorAll('.nabidka').forEach(n => {
        if (otevri && n.id === otevri.dataset.nabidka) {
          n.hidden = !n.hidden;
          otevri.setAttribute('aria-expanded', String(!n.hidden));
          if (!n.hidden && e.detail === 0) { const prvni = n.querySelector('button:not(:disabled)'); if (prvni) prvni.focus(); }   // otevřeno klávesnicí
          if (!n.hidden) {
            const r = otevri.getBoundingClientRect();
            n.style.left = Math.max(8, Math.min(r.left, innerWidth - n.offsetWidth - 8)) + 'px';
            n.style.top = r.bottom + 4 + 'px';
            n.style.maxHeight = Math.max(120, innerHeight - r.bottom - 12) + 'px';      // nízké okno: nabídka se posouvá, nevyjede ven
          }
        } else if (!n.contains(e.target)) n.hidden = true;
      });
      document.querySelectorAll('[data-nabidka]').forEach(b => { if (b !== otevri) b.setAttribute('aria-expanded', String(!document.getElementById(b.dataset.nabidka).hidden)); });
    });
    // Esc zavře otevřenou nabídku (a fokus vrátí na její tlačítko) dřív, než by zrušil výběr
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      // nejdřív rozdělané přetažení tvaru z nabídky (nabídka je při něm otevřená, jen průhledná)
      if (M.zrusTahKnihovny && M.zrusTahKnihovny()) { e.preventDefault(); e.stopPropagation(); return; }
      // Esc v hledání s textem nejdřív smaže text
      if (e.target && e.target.matches && e.target.matches('.nabidka input[type=search]') && e.target.value) {
        e.target.value = ''; e.target.dispatchEvent(new Event('input', { bubbles: true })); e.preventDefault(); e.stopPropagation(); return;
      }
      const otevrena = [...document.querySelectorAll('.nabidka')].find(n => !n.hidden);
      if (!otevrena) return;
      otevrena.hidden = true;
      const b = document.querySelector(`[data-nabidka="${otevrena.id}"]`);
      if (b) { b.setAttribute('aria-expanded', 'false'); b.focus(); }
      e.preventDefault(); e.stopPropagation();
    }, true);
    // přístupné názvy tlačítek lišty: na užší obrazovce je text schovaný a zbyla by jen ikona
    // (viditelný text musí být v názvu – WCAG 2.5.3: „⌂ Domů“ zůstane „Domů“, jen ikony dostanou název z title)
    const jenIkona = b => !/\p{L}{2}/u.test(b.textContent.replace(/[▾]/g, ''));
    document.querySelectorAll('.lista button').forEach(b => {
      if (b.dataset.nabidka) {
        b.setAttribute('aria-haspopup', 'menu'); b.setAttribute('aria-expanded', 'false');
        // Tab nebo ↓ na tlačítku otevřené nabídky: do nabídky (je na konci stránky, Tab by ji přeskočil)
        b.addEventListener('keydown', e => {
          const n = document.getElementById(b.dataset.nabidka);
          if (!n || n.hidden || !((e.key === 'Tab' && !e.shiftKey) || e.key === 'ArrowDown')) return;
          const prvni = n.querySelector('button:not(:disabled)');
          if (prvni) { e.preventDefault(); prvni.focus(); }
        });
      }
      if (b.hasAttribute('aria-label')) return;
      const t = b.querySelector('.txt');
      if (t) b.setAttribute('aria-label', t.textContent.trim() + (b.title && !b.title.startsWith(t.textContent.trim()) ? ' – ' + b.title : ''));
      else if (jenIkona(b) && b.title) b.setAttribute('aria-label', b.title);
    });
    // nabídky: role menu / menuitem, ikonová tlačítka (Zarovnat ⇤ ↔ ⇥…) název z title
    document.querySelectorAll('.nabidka').forEach(n => {
      const t = document.querySelector(`[data-nabidka="${n.id}"]`);
      // nabídka Tvary je dialog s hledáním a dlaždicemi (ne menu): vlastní role a název
      if (n.getAttribute('role') === 'dialog') { if (t) t.setAttribute('aria-haspopup', 'dialog'); }
      else {
        n.setAttribute('role', 'menu');
        if (t && t.getAttribute('aria-label')) n.setAttribute('aria-label', t.getAttribute('aria-label').split(' – ')[0]);
        n.querySelectorAll('button').forEach(b => {
          // přepínače (režimy, převisy, projekce) jako zaškrtávací položky
          b.setAttribute('role', b.dataset.rezim || b.hasAttribute('aria-pressed') ? 'menuitemcheckbox' : 'menuitem');
          if (!b.hasAttribute('aria-label') && jenIkona(b) && b.title) b.setAttribute('aria-label', b.title);
        });
      }
      // fokus odešel z nabídky (Tab dál): zavřít ji – ne když ho vzalo potvrzovací okno (smazat vlastní tvar)
      n.addEventListener('focusout', e => {
        const r = e.relatedTarget;
        if (!n.hidden && r && !n.contains(r) && !(t && t.contains(r)) && !(r.closest && r.closest('dialog.dlg-okno'))) M.zavriNabidku(n);
      });
    });
    document.querySelectorAll('[role=menuitemcheckbox]').forEach(b => b.setAttribute('aria-checked', b.getAttribute('aria-pressed') || 'false'));
    const lista = document.querySelector('.lista');
    if (lista) {
      // zaměřené tlačítko nesmí zajet pod přilepené ❓ / ☰ Panel: odsazení posunu podle jejich skutečné šířky
      const vpravo = lista.querySelector('.vpravo');
      if (vpravo && typeof ResizeObserver === 'function') new ResizeObserver(() => { lista.style.scrollPaddingRight = (vpravo.offsetWidth + 16) + 'px'; }).observe(vpravo);
      // fokus (Tab) na tlačítko zčásti pod ❓ / ☰ Panel: prohlížeč ho neposune – dorovnat
      lista.addEventListener('focusin', e => {
        if (!vpravo || vpravo.contains(e.target)) return;
        const r = e.target.getBoundingClientRect(), l = lista.getBoundingClientRect(), hranice = vpravo.getBoundingClientRect().left - 8;
        if (r.right > hranice) lista.scrollLeft += r.right - hranice;
        else if (r.left < l.left + 8) lista.scrollLeft -= l.left + 8 - r.left;
      });
      // posun lišty (úzké okno) ujede tlačítkům: otevřené nabídky zavřít
      // nabídka jede s tlačítkem; zavře se, až když tlačítko zajede mimo viditelnou část lišty
      lista.addEventListener('scroll', () => document.querySelectorAll('.nabidka:not([hidden])').forEach(n => {
        const b = document.querySelector(`[data-nabidka="${n.id}"]`);
        if (!b || !lista.contains(b)) return;
        const r = b.getBoundingClientRect(), l = lista.getBoundingClientRect();
        const pravy = vpravo ? vpravo.getBoundingClientRect().left : l.right;
        if (r.right < l.left + 4 || r.left > pravy - 4) { M.zavriNabidku(n); return; }
        n.style.left = Math.max(8, Math.min(r.left, innerWidth - n.offsetWidth - 8)) + 'px';
      }), { passive: true });
      // obyčejné kolečko myši posouvá lištu do strany (posuvník je skrytý)
      lista.addEventListener('wheel', e => {
        if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY) || lista.scrollWidth <= lista.clientWidth + 1) return;
        if (e.target.closest && e.target.closest('.nabidka')) return;
        lista.scrollLeft += e.deltaY * (e.deltaMode === 1 ? 16 : 1);
        e.preventDefault();
      }, { passive: false });
    }
    // aria-checked zaškrtávacích položek podle aria-pressed (přepínače ho nastavují samy)
    new MutationObserver(z => { for (const m of z) if (m.target.getAttribute('role') === 'menuitemcheckbox') m.target.setAttribute('aria-checked', m.target.getAttribute('aria-pressed') || 'false'); })
      .observe(document.body, { subtree: true, attributes: true, attributeFilter: ['aria-pressed'] });
    document.querySelectorAll('#skicar button[title]').forEach(b => { if (!b.hasAttribute('aria-label') && jenIkona(b)) b.setAttribute('aria-label', b.title); });
    ['vyber', 'dokument', 'historie', 'rezim', 'rovina'].forEach(u => M.na(u, obnovListu));
    // fokus nesmí skončit na <body> (zavřené okno, smazaný řádek seznamu): vrátit ho na scénu
    const naScenu = () => setTimeout(() => {
      if ((!document.activeElement || document.activeElement === document.body) && !M.modalniOkno()) S.renderer.domElement.focus({ preventScroll: true });
    }, 0);
    document.addEventListener('close', naScenu, true);
    M.na('dokument', e => { if (!e || !e.docasne) naScenu(); });
    obnovListu();
    return { obnovListu };
  };
})(MDL);

/* Modelář 3D – nápověda a průvodce pro začátečníky.
   Nápověda (tlačítko ? a klávesa F1): ovládání myší a dotykem, klávesové zkratky
   (vypsané z M.PRIKAZY, takže sedí s tím, co aplikace opravdu umí), postupy
   a odkaz na licence. Průvodce: několik kroků se zvýrazněním části obrazovky,
   spustí se sám při první návštěvě (prázdná scéna) a jde pustit znovu z nápovědy.
   Že už proběhl, si pamatuje localStorage (bez úložiště se prostě neukáže sám). */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const KLIC = 'modelar_pruvodce';

  const KROKY = [
    { cil: '#btnTvary', nadpis: 'Tvary', text: 'Tady otevřeš nabídku tvarů: kvádry, válce, koule, rozšířené a další tvary (mnohostěny, drahokam, váza, krabička s víkem, montážní deska, háčky, puzzle a celá skládačka…), díly se závity a ozubená kola (sada šroub + matice, maticová šroubovice, klip na trubku, příchytka, držák na zeď, zacvakávací čep, kalibrace vůlí) i vlastní tvary. Tvar přetáhni na desku, nebo na něj klikni. Nabídka má hledání a dole kvalitu nových těles.' },
    { cil: '#plocha', nadpis: 'Pracovní plocha', text: 'Těleso posuneš tažením. Bílé úchyty mění velikost, horní čtverec výšku, šipka nad ním těleso zvedá a zahnuté šipky ho otáčejí. Pohled otáčíš pravým tlačítkem (kolem středu vybraného tělesa, bez výběru kolem středu desky), posouváš ho se Shiftem nebo prostředním tlačítkem, kolečkem přibližuješ. Na dotykové obrazovce: jeden prst otáčí, dva přibližují a posouvají.' },
    { cil: '[data-prikaz="seskupit"]', nadpis: 'Díry a seskupení', text: 'Těleso přepni v inspektoru na Díru (klávesa H), vyber ho spolu s jiným tělesem a Seskup (Ctrl+G) – díra se odečte. Seskupení jde kdykoli zrušit (Ctrl+Shift+G).' },
    { cil: '[data-nabidka="nabUpravy"]', nadpis: 'Úpravy a Dílna', text: 'V Úpravách najdeš pole (i podél křivky ze skici), rozdělení rovinou, vzor děr, strukturu na ploše (třeba váleček na těsto), závit na válec, text po obvodu, reliéf z obrázku, zaoblení a sražení hran (tlačítko Spoje vybere vnitřní hrany sloučených těles) a skořepinu. V Dílně měření, moje vůle pro tisk (kalibrační destička), kontrolu tisku (hmotnost, cena, převisy), rozmístění na desku, výkres a paletu příkazů (Ctrl+K).' },
    { cil: '[data-nabidka="nabSoubor"]', nadpis: 'Ukládání a export', text: 'Projekt se ukládá sám v prohlížeči. Nový projekt můžeš začít i ze šablony (krabička na elektroniku, stojánek na telefon, jmenovka…). Pro tisk exportuj STL nebo 3MF (i každou barvu zvlášť), pro CAD programy STEP. Projekt si můžeš stáhnout jako soubor .modelar.' },
    { cil: '#btnNapoveda', nadpis: 'Nápověda', text: 'Klávesy, postupy a tento průvodce najdeš kdykoli tady (nebo F1). Hodně zdaru!' },
  ];

  M.vytvorNapovedu = function () {
    const okno = $('oknoNapovedy');

    // ------------------------------------------------------------ nápověda
    function klavesy() {
      const kl = k => k.replace('Escape', 'Esc');
      const radky = M.PRIKAZY.filter(p => p.klavesy.length).map(p => `<tr><td>${p.klavesy.map(k => `<kbd>${esc(kl(k))}</kbd>`).join(' ')}</td><td>${esc(p.nazev)}</td></tr>`);
      radky.push('<tr><td><kbd>←</kbd> <kbd>→</kbd> <kbd>↑</kbd> <kbd>↓</kbd></td><td>posun výběru v rovině o krok mřížky (se Shiftem ×10)</td></tr>',
        '<tr><td><kbd>Ctrl+↑</kbd> <kbd>Ctrl+↓</kbd></td><td>zvednout / spustit výběr</td></tr>',
        '<tr><td><kbd>Ctrl+S</kbd> <kbd>Ctrl+O</kbd> <kbd>Ctrl+E</kbd></td><td>uložit hned, otevřít soubor, exportovat</td></tr>',
        '<tr><td><kbd>Esc</kbd></td><td>zrušit tažení nebo režim klikání</td></tr>',
        '<tr><td><kbd>F1</kbd></td><td>tato nápověda</td></tr>');
      return radky.join('');
    }
    M.otevriNapovedu = function () {
      $('napovedaKlavesy').innerHTML = klavesy();
      if (!okno.open) okno.showModal();
    };
    $('btnNapoveda').onclick = () => M.otevriNapovedu();
    $('napovedaZavrit').onclick = () => okno.close();
    $('napovedaPruvodce').onclick = () => { okno.close(); M.spustPruvodce(); };
    document.addEventListener('keydown', e => {
      if (e.key !== 'F1' || e.ctrlKey || e.altKey || e.metaKey) return;
      e.preventDefault();
      if (!M.modalniOkno()) M.otevriNapovedu();
    });

    // ------------------------------------------------------------ průvodce
    const vrstva = $('pruvodce'), bublina = $('pruvodceBublina'), dira = $('pruvodceDira');
    let krok = -1;
    function ukaz() {
      const k = KROKY[krok];
      // cíl schovaný: bublina uprostřed obrazovky
      const videt = e => e && e.getClientRects().length && e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().left < innerWidth;
      const cil = document.querySelector(k.cil);
      // cíl v posouvané liště (telefon) nejdřív posunout do zorného pole
      if (cil && cil.scrollIntoView) cil.scrollIntoView({ block: 'nearest', inline: 'center' });
      const r = videt(cil) ? cil.getBoundingClientRect() : { left: innerWidth / 2 - 60, top: innerHeight / 2 - 30, width: 120, height: 60 };
      const o = 6;
      Object.assign(dira.style, { left: (r.left - o) + 'px', top: (r.top - o) + 'px', width: (r.width + 2 * o) + 'px', height: (r.height + 2 * o) + 'px' });
      $('pruvodceNadpis').textContent = `${krok + 1}/${KROKY.length} · ${k.nadpis}`;
      $('pruvodceText').textContent = k.text;
      $('pruvodceDalsi').textContent = krok === KROKY.length - 1 ? 'Hotovo' : 'Další →';
      $('pruvodceZpet').disabled = krok === 0;
      // bublina vedle zvýrazněného místa: pod ním, když je místo, jinak nad, vždy celá na obrazovce
      const bw = Math.min(340, innerWidth - 20);
      bublina.style.width = bw + 'px';
      const bh = bublina.offsetHeight || 160;
      let top = r.top + r.height + o + 10;
      if (top + bh > innerHeight - 10) top = Math.max(10, r.top - o - 10 - bh);
      let left = Math.min(Math.max(10, r.left + r.width / 2 - bw / 2), innerWidth - bw - 10);
      if (r.height > innerHeight * 0.5) {
        // vysoký prvek (panel, plocha): bublina vedle něj, ať ho nezakrývá
        top = Math.max(10, Math.min(innerHeight - bh - 10, r.top + r.height / 2 - bh / 2));
        if (r.left - o - 16 - bw >= 10) left = r.left - o - 16 - bw;
        else if (r.left + r.width + o + 16 + bw <= innerWidth - 10) left = r.left + r.width + o + 16;
      }
      Object.assign(bublina.style, { top: top + 'px', left: left + 'px' });
      $('pruvodceDalsi').focus();
    }
    let fokusPred = null;
    function konec() {
      krok = -1;
      vrstva.hidden = true;
      if (fokusPred && fokusPred.isConnected) fokusPred.focus(); else S_fokus();
      try { localStorage.setItem(KLIC, '1'); } catch (e) { /* bez úložiště */ }
    }
    const S_fokus = () => { const c = document.querySelector('canvas.platno3d'); if (c) c.focus({ preventScroll: true }); };
    M.spustPruvodce = function () {
      fokusPred = document.activeElement !== document.body ? document.activeElement : null;
      krok = 0;
      document.querySelectorAll('.nabidka:not([hidden])').forEach(n => M.zavriNabidku(n));
      vrstva.hidden = false;
      ukaz();
    };
    M.pruvodceKrok = () => krok;
    $('pruvodceDalsi').onclick = () => { if (krok >= KROKY.length - 1) konec(); else { krok++; ukaz(); } };
    $('pruvodceZpet').onclick = () => { if (krok > 0) { krok--; ukaz(); } };
    $('pruvodcePreskocit').onclick = konec;
    addEventListener('resize', () => { if (krok >= 0) ukaz(); });
    document.addEventListener('keydown', e => {
      if (krok < 0) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); konec(); }
      // Tab jen mezi tlačítky bubliny (pod ztmavením nic jiného ovládat nejde)
      else if (e.key === 'Tab') {
        const t = [...bublina.querySelectorAll('button:not(:disabled)')], i = t.indexOf(document.activeElement);
        e.preventDefault(); e.stopPropagation();
        t[(i + (e.shiftKey ? -1 : 1) + t.length) % t.length].focus();
      }
      // Enter na tlačítku (Přeskočit, Zpět) ho stiskne – jinak znamená Další
      else if (e.key === 'ArrowRight' || (e.key === 'Enter' && !(document.activeElement && document.activeElement.closest('#pruvodceBublina button')))) { e.preventDefault(); e.stopPropagation(); $('pruvodceDalsi').click(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); $('pruvodceZpet').click(); }
    }, true);

    /** Při první návštěvě (prázdná scéna, průvodce ještě neproběhl) se spustí sám. */
    M.pruvodceNaZacatku = function () {
      if (navigator.webdriver) return;               // automatické testy: průvodce by zakryl plochu
      let probehl = true;
      try { probehl = !!localStorage.getItem(KLIC); } catch (e) { /* bez úložiště: nespouštět */ }
      if (!probehl && !M.app.dok.uzly.length) M.spustPruvodce();
    };
  };
})(MDL);

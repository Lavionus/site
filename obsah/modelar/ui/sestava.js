/* Modelář 3D – panel Pohyblivá sestava (Dílna → ⚙ Sestava a klouby…).
   Kloub z vybraných dílů: otočení kolem osy nebo posuv podél směru, meze, posuvník.
   Tažení posuvníku je jeden krok historie (úprava), „Hlídat srážky“ po puštění spočítá
   průniky pohyblivých dílů s ostatními tělesy (manifold ve workeru) a ukáže je červeně.
   „Projet rozsah“ vyzkouší celý rozsah kloubu a vypíše, kde do sebe díly narážejí;
   „Přehrát“ kloubem pohne tam a zpět (jen náhled, dokument se nezmění). */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const OSY = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
  const MEZ_OBJEMU = 0.01;           // mm³ – menší průnik je jen dotyk (zaokrouhlení sítí)

  M.vytvorSestavu = function (S) {
    const okno = document.createElement('dialog');
    okno.id = 'oknoSestavy';
    okno.className = 'okno vedle okno-sestavy';
    okno.setAttribute('aria-labelledby', 'sesNadpis');
    okno.innerHTML = `<h2 id="sesNadpis">⚙ Pohyblivá sestava <button type="button" class="tl tl-navod" data-navod="sestava" title="Názorný návod">❔ Návod</button></h2>
      <div id="sesKlouby" class="ses-klouby"></div>
      <details id="sesNovy" class="ses-novy"><summary>✚ Nový kloub z vybraných těles</summary>
        <fieldset><legend>Pohyb</legend>
          <label><input type="radio" name="sesTyp" value="otoceni" checked> ⟲ Otáčení</label>
          <label><input type="radio" name="sesTyp" value="posun"> ⇄ Posuv</label></fieldset>
        <fieldset><legend>Osa / směr</legend>
          <label><input type="radio" name="sesOsa" value="x"> X</label>
          <label><input type="radio" name="sesOsa" value="y"> Y</label>
          <label><input type="radio" name="sesOsa" value="z" checked> Z</label></fieldset>
        <fieldset data-bez-potvrzeni><legend>Bod na ose (mm)</legend>
          <div class="radek"><label for="sesBodX">X</label><input id="sesBodX" inputmode="decimal" value="0">
            <label for="sesBodY">Y</label><input id="sesBodY" inputmode="decimal" value="0">
            <label for="sesBodZ">Z</label><input id="sesBodZ" inputmode="decimal" value="0"></div>
          <div class="radek"><button type="button" class="tl" id="sesBodStred">Střed výběru</button><button type="button" class="tl" id="sesBodPivot" title="Bod otáčení nastavený klávesou P">Bod otáčení (P)</button></div></fieldset>
        <div class="radek"><label for="sesMin">Od</label><input id="sesMin" inputmode="decimal" value="-90"><label for="sesMax">do</label><input id="sesMax" inputmode="decimal" value="90"><span id="sesJed">°</span></div>
        <p class="chyba-text" id="sesChyba" aria-live="polite"></p>
        <div class="tlacitka"><button type="button" class="tl hlavni-tl" id="sesVytvorit">Vytvořit kloub</button></div>
      </details>
      <label class="zaskrt"><input type="checkbox" id="sesHlidat" checked> Hlídat srážky (po puštění posuvníku)</label>
      <p class="poznamka" id="sesInfo" aria-live="polite"></p>
      <ul id="sesVysledky" class="ses-vysledky"></ul>
      <div class="tlacitka"><button type="button" class="tl hlavni-tl" id="sesZavrit">Zavřít</button></div>`;
    document.body.appendChild(okno);
    const info = $('sesInfo');
    const typ = () => okno.querySelector('[name=sesTyp]:checked').value;
    const osa = () => okno.querySelector('[name=sesOsa]:checked').value;

    // ------------------------------------------------------------ zobrazení srážek
    let vrstva = null;
    const mat = new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0.7, depthTest: false, side: THREE.DoubleSide });
    function zrusSrazky() {
      if (!vrstva) return;
      S.scena.remove(vrstva);
      vrstva.traverse(o => { if (o.geometry) o.geometry.dispose(); });
      vrstva = null;
      M.prekresli();
    }
    function ukazSrazky(site) {
      zrusSrazky();
      if (!site.length) return;
      vrstva = new THREE.Group();
      vrstva.renderOrder = 10;
      for (const { sit, matice } of site) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(sit.poz, 3));
        g.setIndex(new THREE.BufferAttribute(sit.idx, 1));
        const m = new THREE.Mesh(g, mat);
        m.applyMatrix4(matice);
        m.renderOrder = 10;
        vrstva.add(m);
      }
      S.scena.add(vrstva);
      M.prekresli();
    }

    /** Srážky kloubu v dokumentu dok: [[a, b, objem, sit, matice]]. */
    async function srazky(dok, kloubId) {
      const out = [];
      for (const [a, b] of M.dvojiceKeKontrole(dok, kloubId)) {
        const g = M.uzelPrunikuDvojice(dok, a, b);
        if (!g) continue;
        try {
          const r = await M.sitSkupiny(g);
          if (r && r.objem > MEZ_OBJEMU && r.idx && r.idx.length) out.push([a, b, r.objem, { poz: r.poz, idx: r.idx }, M.maticeUzlu(g)]);
        } catch (e) { /* prázdný průnik nebo chyba výpočtu = bez srážky */ }
      }
      return out;
    }
    const nazev = (dok, id) => { const u = M.najdiUzel(dok, id); return u ? u.nazev : '?'; };
    const jednotka = k => k.typ === 'posun' ? 'mm' : '°';

    let cisloKontroly = 0;
    async function zkontroluj(kloubId) {
      const c = ++cisloKontroly, dok = M.app.dok;
      const k = M.klouby(dok).find(x => x.id === kloubId);
      if (!k) return;
      info.textContent = 'Hledám srážky…';
      M.cekej('sestava', 'Hledám srážky…');
      try {
        const s = await srazky(dok, kloubId);
        if (c !== cisloKontroly || dok !== M.app.dok) return;
        ukazSrazky(s.map(x => ({ sit: x[3], matice: x[4] })));
        info.textContent = s.length
          ? `⚠ Při ${M.mm(k.hodnota, 1)} ${jednotka(k)} do sebe narážejí: ${s.map(x => `${nazev(dok, x[0])} × ${nazev(dok, x[1])} (${M.mm(x[2], 1)} mm³)`).join(', ')}.`
          : `✓ Při ${M.mm(k.hodnota, 1)} ${jednotka(k)} se nic nesráží.`;
      } finally { M.hotovoCekani('sestava'); }
    }

    // ------------------------------------------------------------ seznam kloubů
    function postav() {
      const dok = M.srovnejKlouby(M.app.dok);
      const kl = M.klouby(dok);
      $('sesKlouby').innerHTML = kl.length ? kl.map(k => `<div class="ses-kloub" data-kloub="${esc(k.id)}">
          <div class="ses-hlava"><input class="ses-nazev" value="${esc(k.nazev)}" aria-label="Název kloubu" maxlength="60">
            <span class="pozn">${k.typ === 'posun' ? '⇄' : '⟲'} ${k.dily.map(id => esc(nazev(dok, id))).join(', ')}</span></div>
          <div class="ses-ovladani"><input type="range" class="ses-posuvnik" min="${k.min}" max="${k.max}" step="${k.typ === 'posun' ? 0.1 : 1}" value="${k.hodnota}" aria-label="Poloha kloubu ${esc(k.nazev)}">
            <input class="ses-hodnota" inputmode="decimal" value="${M.mm(k.hodnota, 2)}" aria-label="Hodnota kloubu ${esc(k.nazev)} (${jednotka(k)})"><span class="jed">${jednotka(k)}</span></div>
          <div class="ses-akce">
            <label>od <input class="ses-mez" data-mez="min" inputmode="decimal" value="${M.mm(k.min, 2)}" aria-label="Dolní mez"></label>
            <label>do <input class="ses-mez" data-mez="max" inputmode="decimal" value="${M.mm(k.max, 2)}" aria-label="Horní mez"></label>
            <button type="button" class="tl ik ses-prehrat" title="Přehrát pohyb (jen náhled)" aria-label="Přehrát pohyb">▶</button>
            <button type="button" class="tl ik ses-projet" title="Projet celý rozsah a najít srážky" aria-label="Projet rozsah">🔍</button>
            <button type="button" class="tl ik ses-vybrat" title="Vybrat díly kloubu" aria-label="Vybrat díly">⬚</button>
            <button type="button" class="tl ik ses-smaz" title="Smazat kloub (díly zůstanou, kde jsou)" aria-label="Smazat kloub">🗑</button></div>
        </div>`).join('') : '<p class="poznamka">Zatím žádný kloub. Vyber díly, které se mají pohybovat (víko, rameno, šoupátko), a vytvoř kloub níž.</p>';
    }

    const kloubEl = e => e.target.closest('[data-kloub]');
    const kloub = id => M.klouby(M.app.dok).find(k => k.id === id);
    $('sesKlouby').addEventListener('input', e => {
      if (!e.target.classList.contains('ses-posuvnik')) return;
      const id = kloubEl(e).dataset.kloub;
      if (!M.app.uprava) { zastavPrehravani(); M.zacniUpravu(); zrusSrazky(); }
      M.zmenDokument(M.dokSKloubem(M.app.dok, id, +e.target.value), '', { docasne: true });
      kloubEl(e).querySelector('.ses-hodnota').value = M.mm(+e.target.value, 2);
    });
    $('sesKlouby').addEventListener('change', e => {
      const el = kloubEl(e);
      if (!el) return;
      const id = el.dataset.kloub, k = kloub(id);
      if (!k) return;
      if (e.target.classList.contains('ses-posuvnik')) {
        M.dokonciUpravu('Pohyb: ' + k.nazev);
        if ($('sesHlidat').checked) zkontroluj(id);
      } else if (e.target.classList.contains('ses-hodnota')) {
        const v = M.prectiCislo(e.target.value, M.hodnotyPromennych(M.app.dok));
        if (!isFinite(v)) { M.oznamPole(e.target, 'Zadej číslo.'); e.target.value = M.mm(k.hodnota, 2); return; }
        if (v < k.min || v > k.max) M.oznamPole(e.target, `Kloub jde jen od ${M.mm(k.min, 2)} do ${M.mm(k.max, 2)} ${jednotka(k)}.`);
        M.zmenDokument(M.dokSKloubem(M.app.dok, id, v), 'Pohyb: ' + k.nazev);
        if ($('sesHlidat').checked) zkontroluj(id);
      } else if (e.target.classList.contains('ses-mez')) {
        const v = M.prectiCislo(e.target.value);
        if (!isFinite(v)) { M.oznamPole(e.target, 'Zadej číslo.'); postav(); return; }
        const z = { [e.target.dataset.mez]: v };
        let d = M.upravKloub(M.app.dok, id, z);
        // současná hodnota mimo nové meze: kloub se do nich vrátí
        const n = M.klouby(d).find(x => x.id === id);
        if (n.hodnota < n.min || n.hodnota > n.max) d = M.dokSKloubem(Object.assign({}, d, { klouby: M.klouby(d).map(x => x.id === id ? Object.assign({}, x, { min: -1e9, max: 1e9 }) : x) }), id, M.omez(n.hodnota, n.min, n.max));
        d = Object.assign({}, d, { klouby: M.klouby(d).map(x => x.id === id ? Object.assign({}, x, { min: n.min, max: n.max }) : x) });
        M.zmenDokument(d, 'Meze kloubu');
      } else if (e.target.classList.contains('ses-nazev')) {
        M.zmenDokument(M.upravKloub(M.app.dok, id, { nazev: e.target.value }), 'Přejmenovat kloub');
      }
    });
    $('sesKlouby').addEventListener('click', async e => {
      const el = kloubEl(e);
      if (!el) return;
      const id = el.dataset.kloub, k = kloub(id);
      if (!k) return;
      if (e.target.closest('.ses-smaz')) { zrusSrazky(); M.zmenDokument(M.smazKloub(M.app.dok, id), 'Smazat kloub'); }
      else if (e.target.closest('.ses-vybrat')) M.nastavVyber(k.dily);
      else if (e.target.closest('.ses-prehrat')) prehraj(id);
      else if (e.target.closest('.ses-projet')) projet(id);
    });

    /** Projede rozsah kloubu (dočasně, dokument se nezmění) a vypíše úseky se srážkou. */
    async function projet(id) {
      zastavPrehravani();
      const dok0 = M.app.dok, k = kloub(id);
      const vz = M.vzorkyKloubu(k, 36), vysledky = [];
      $('sesVysledky').innerHTML = '';
      try {
        for (let i = 0; i < vz.length; i++) {
          M.cekej('sestavaProjet', `Zkouším ${k.nazev}: ${M.mm(vz[i], 1)} ${jednotka(k)}`, i / vz.length, 0);
          const d = M.dokSKloubem(dok0, id, vz[i]);
          const s = await srazky(d, id);
          if (M.app.dok !== dok0) { info.textContent = 'Model se mezitím změnil – zkoušení přerušeno.'; return; }
          vysledky.push({ hodnota: vz[i], srazky: s.map(x => [x[0], x[1], x[2]]) });
        }
      } finally { M.hotovoCekani('sestavaProjet'); }
      const us = M.useKySrazek(vysledky);
      const j = jednotka(k);
      info.textContent = us.length ? `⚠ Srážky v ${M.pocet(us.length, 'úseku', 'úsecích', 'úsecích')} rozsahu (krok ${M.mm(vz[1] - vz[0], 1)} ${j}):`
        : `✓ V celém rozsahu ${M.mm(k.min, 1)} až ${M.mm(k.max, 1)} ${j} se nic nesráží (krok ${M.mm(vz[1] - vz[0], 1)} ${j}).`;
      $('sesVysledky').innerHTML = us.map(u => `<li><button type="button" class="odkaz-tl" data-skoc="${u.od}">${M.mm(u.od, 1)}${u.do !== u.od ? ' až ' + M.mm(u.do, 1) : ''} ${j}</button>: `
        + [...u.dvojice].map(p => p.split('|').map(x => esc(nazev(dok0, x))).join(' × ')).join(', ') + '</li>').join('');
      $('sesVysledky').onclick = ev => {
        const b = ev.target.closest('[data-skoc]');
        if (!b) return;
        M.zmenDokument(M.dokSKloubem(M.app.dok, id, +b.dataset.skoc), 'Pohyb: ' + k.nazev);
        zkontroluj(id);
      };
    }

    // ------------------------------------------------------------ přehrávání (náhled tam a zpět)
    let prehravani = null;
    function zastavPrehravani() {
      if (!prehravani) return;
      cancelAnimationFrame(prehravani.raf);
      prehravani = null;
      if (M.app.uprava) M.zrusUpravu();
      okno.querySelectorAll('.ses-prehrat').forEach(b => { b.textContent = '▶'; b.setAttribute('aria-label', 'Přehrát pohyb'); });
    }
    function prehraj(id) {
      if (prehravani) { const bylo = prehravani.id; zastavPrehravani(); if (bylo === id) return; }
      const k = kloub(id);
      if (!k || M.app.uprava) return;
      zrusSrazky();
      M.zacniUpravu();
      const dok0 = M.app.dok, t0 = performance.now(), perioda = 3000;
      prehravani = { id, raf: 0 };
      const b = okno.querySelector(`[data-kloub="${CSS.escape(id)}"] .ses-prehrat`);
      if (b) { b.textContent = '⏸'; b.setAttribute('aria-label', 'Zastavit přehrávání'); }
      const krok = t => {
        if (!prehravani) return;
        const f = (1 - Math.cos(((t - t0) % perioda) / perioda * 2 * Math.PI)) / 2;      // tam a zpět, plynule
        M.zmenDokument(M.dokSKloubem(dok0, id, k.min + (k.max - k.min) * f), '', { docasne: true });
        prehravani.raf = requestAnimationFrame(krok);
      };
      prehravani.raf = requestAnimationFrame(krok);
    }

    // ------------------------------------------------------------ nový kloub
    function nastavBod(b) { ['X', 'Y', 'Z'].forEach((o, i) => { $('sesBod' + o).value = M.mm(b[i], 2); }); }
    $('sesBodStred').onclick = () => { const u = M.vybraneUzly(); if (u.length) nastavBod(M.obalkaVice(u).stred); };
    $('sesBodPivot').onclick = () => { if (M.app.pivot) nastavBod(M.app.pivot); else Dialog.info('Bod otáčení zatím není – nastav ho klávesou P a kliknutím do scény.'); };
    okno.querySelectorAll('[name=sesTyp]').forEach(r => r.addEventListener('change', () => {
      const p = typ() === 'posun';
      $('sesJed').textContent = p ? 'mm' : '°';
      $('sesMin').value = p ? '0' : '-90'; $('sesMax').value = p ? '20' : '90';
    }));
    $('sesNovy').addEventListener('toggle', () => {
      if (!$('sesNovy').open) return;
      const u = M.vybraneUzly();
      nastavBod(M.app.pivot || (u.length ? M.obalkaVice(u).stred : [0, 0, 0]));
    });
    $('sesVytvorit').onclick = () => {
      const chyba = $('sesChyba');
      chyba.textContent = '';
      const ids = M.vybraneUzly().map(u => u.id);
      if (!ids.length) { chyba.textContent = 'Nejdřív vyber tělesa, která se mají pohybovat.'; return; }
      if (ids.length === M.app.dok.uzly.filter(u => !u.skryto).length) { chyba.textContent = 'Vybrané je všechno – kloub potřebuje i pevnou část, vůči které se díly pohybují.'; return; }
      const cti = el => M.prectiCislo($(el).value, M.hodnotyPromennych(M.app.dok));
      const bod = ['X', 'Y', 'Z'].map(o => cti('sesBod' + o)), min = cti('sesMin'), max = cti('sesMax');
      if (![...bod, min, max].every(isFinite)) { chyba.textContent = 'Bod a meze musí být čísla.'; return; }
      if (max - min < 1e-6) { chyba.textContent = 'Horní mez musí být větší než dolní.'; return; }
      if (min > 0 || max < 0) { chyba.textContent = 'Rozsah musí obsahovat 0 (současnou polohu dílů).'; return; }
      const r = M.novyKloub(M.app.dok, ids, { typ: typ(), bod, smer: OSY[osa()], min, max });
      M.zmenDokument(r.dok, 'Nový kloub');
      $('sesNovy').open = false;
      postav();
    };

    const zavri = () => { zastavPrehravani(); zrusSrazky(); if (okno.open) okno.close(); };
    $('sesZavrit').onclick = zavri;
    okno.addEventListener('cancel', e => { e.preventDefault(); zavri(); });

    M.otevriSestavu = function () {
      // klouby s díly, které mezitím zmizely (seskupení, smazání), vyčistit bez kroku historie
      const d = M.srovnejKlouby(M.app.dok);
      if (d !== M.app.dok) M.zmenDokument(d, 'Srovnat klouby', { nahraditPosledni: true });
      postav();
      info.textContent = '';
      $('sesVysledky').innerHTML = '';
      if (!M.klouby(M.app.dok).length && M.app.vyber.length) $('sesNovy').open = true;
      M.otevriPanel(okno);
    };
    M.na('dokument', e => {
      if (!okno.open || (e && e.docasne)) return;
      zrusSrazky();
      if (!okno.contains(document.activeElement) || document.activeElement.type === 'range') postav();
    });
    // pro testy
    M.sestavaStav = () => ({ srazky: vrstva ? vrstva.children.length : 0, info: info.textContent, prehrava: !!prehravani });
  };
})(MDL);

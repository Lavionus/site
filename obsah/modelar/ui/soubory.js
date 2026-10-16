/* Modelář 3D – soubory v uživatelském rozhraní.
   Název projektu v liště, nabídka Soubor, otevření souboru (.modelar jako
   nový projekt; STL/OBJ/3MF se přidá do scény), přetažení souborů na plochu,
   okno Exportovat (STL/3MF/OBJ, vybraná nebo všechna tělesa, sloučení),
   stažení projektu jako .modelar. Klávesy: Ctrl+S uložit hned, Ctrl+O otevřít,
   Ctrl+E exportovat. Stahování jde přes M.stahniSoubor (testy ho zachytí). */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';
  const $ = id => document.getElementById(id);
  const MAX_SOUBOR = 300 * 1024 * 1024;

  /** Stáhne data jako soubor (Blob + odkaz s download; funguje i z file://). */
  M.stahniSoubor = function (data, jmeno, mime = 'application/octet-stream') {
    const url = URL.createObjectURL(new Blob([data], { type: mime }));
    const a = document.createElement('a');
    a.href = url; a.download = jmeno;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  /** Název souboru z názvu projektu (bez znaků, které systémy nemají rády). */
  M.jmenoSouboru = (nazev, pripona) => (String(nazev || 'model').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'model') + pripona;

  M.vytvorSoubory = function (S, U) {
    // ------------------------------------------------------------ název projektu
    const nazev = $('nazevProjektu');
    M.na('projekt', p => { if (document.activeElement !== nazev) nazev.value = p.nazev; document.title = '🧊 ' + p.nazev + ' – Modelář 3D'; });
    nazev.addEventListener('change', () => U.prejmenuj(nazev.value));
    nazev.addEventListener('keydown', e => { if (e.key === 'Enter') { nazev.blur(); } if (e.key === 'Escape') { nazev.value = M.app.projekt.nazev; nazev.blur(); } });
    const stavUlozeni = $('stavUlozeni');
    M.na('neulozeno', () => { stavUlozeni.textContent = '● neuloženo'; stavUlozeni.className = 'neulozeno'; });
    M.na('ulozeno', () => { stavUlozeni.textContent = '✓ uloženo'; stavUlozeni.className = 'ulozeno'; });
    let hlasenoUlozeni = false;
    M.na('chybaUlozeni', e => {
      stavUlozeni.textContent = '⚠ neukládá se'; stavUlozeni.className = 'chyba';
      const proc = e && /aktualizována/.test(e.message || '') ? e.message
        : 'Prohlížeč nedovolil uložit projekt (soukromé okno, plný disk nebo zakázané úložiště).';
      stavUlozeni.title = proc + ' Ulož si projekt do souboru (Soubor → Uložit .modelar).';
      // jednou za relaci i hlášením – na úzké obrazovce stavový údaj není vidět
      if (!hlasenoUlozeni && M.pripraveno) { hlasenoUlozeni = true; Dialog.info('⚠ Projekt se neukládá: ' + stavUlozeni.title); }
    });

    // ------------------------------------------------------------ otevření a import
    const vstup = document.createElement('input');
    vstup.type = 'file';
    vstup.multiple = true;
    vstup.accept = '.modelar,.stl,.obj,.mtl,.3mf,.zip,.svg,.step,.stp';
    vstup.hidden = true;
    vstup.id = 'vstupSouboru';
    document.body.appendChild(vstup);
    vstup.addEventListener('change', () => { const f = [...vstup.files]; vstup.value = ''; M.otevriSoubory(f); });

    /** Otevře soubory: .modelar = nový projekt, ostatní se naimportují do scény. */
    M.otevriSoubory = async function (soubory) {
      const geometrie = [];
      // .mtl samy o sobě nic nejsou – patří k OBJ vybranému spolu s nimi
      const mtl = new Map();
      for (const f of soubory) if (/\.mtl$/i.test(f.name)) mtl.set(f.name, new Uint8Array(await f.arrayBuffer()));
      if (mtl.size && !soubory.some(f => /\.obj$/i.test(f.name))) Dialog.chyba('Soubor MTL obsahuje jen barvy – vyber ho spolu s OBJ.');
      const nacitane = soubory.filter(f => !/\.mtl$/i.test(f.name));
      let poradi = 0;
      for (const f of soubory) {
        if (/\.mtl$/i.test(f.name)) continue;
        poradi++;
        // velký soubor se čte a převádí i sekundy – ukazatel čekání nad plochou
        M.cekej('soubor', `Načítám ${f.name}${nacitane.length > 1 ? ` (${poradi} z ${nacitane.length})` : ''}…`, nacitane.length > 1 ? (poradi - 1) / nacitane.length : null, 0);
        await M.dejVykreslit();
        try {
          if (f.size > MAX_SOUBOR) throw new Error('soubor je větší než 300 MB');
          const buf = new Uint8Array(await f.arrayBuffer());
          if (/\.svg$/i.test(f.name)) {
            M.otevriSvg(new TextDecoder().decode(buf), f.name.replace(/\.[^.]+$/, ''));
          } else if (/\.(step|stp)$/i.test(f.name)) {
            Dialog.info(`Čtu ${f.name} přesným jádrem…`);
            const text = new TextDecoder().decode(buf);
            if (!/^\s*ISO-10303-21/.test(text)) throw new Error('soubor není STEP (chybí hlavička ISO-10303-21)');
            const r = await M.occtImportStep(text);
            geometrie.push({ nazev: f.name.replace(/\.[^.]+$/, ''), sit: r.sit, step: text, format: 'step' });
          } else if (/\.modelar$/i.test(f.name)) {
            const p = await M.projekt.cti(buf);
            await U.zeSouboru(p);
            Dialog.info(`Otevřen projekt „${M.app.projekt ? M.app.projekt.nazev : p.nazev}“ (${M.pocet(p.dok.uzly.length, 'těleso', 'tělesa', 'těles')})`);
          } else {
            const objekty = await M.nactiGeometrii(f.name, buf, mtl);
            geometrie.push(...objekty.map(o => Object.assign(o, { format: f.name.split('.').pop().toLowerCase() })));
          }
        } catch (e) {
          console.error(e);
          Dialog.chyba(`${f.name}: ${e.message}`);
        }
      }
      try {
        if (geometrie.length) {
          M.cekej('soubor', 'Vkládám do scény…', null, 0);
          await M.dejVykreslit();
          importuj(geometrie);
          await M.dejVykreslit();
        }
      } finally { M.hotovoCekani('soubor'); }
    };

    function importuj(objekty) {
      const krok = Math.max(S.deska.krok, 1);
      const kam = [Math.round(S.kamera.cil.x / krok) * krok, Math.round(S.kamera.cil.y / krok) * krok];
      let uzly = M.uzlyZImportu(objekty, M.app.dok, kam, objekty[0].format || '');
      const meritko = uzly.meritko || 1;
      // když na místě něco stojí, posunout import doprava na první volné místo
      const stojici = M.app.dok.uzly.filter(u => !u.skryto).map(u => M.obalkaUzlu(u));
      const ob = M.obalkaVice(uzly);
      const sirka = Math.ceil((ob.max[0] - ob.min[0] + 5) / krok) * krok;
      let dx = 0;
      const koliduje = d => stojici.some(o => o.min[0] < ob.max[0] + d && o.max[0] > ob.min[0] + d && o.min[1] < ob.max[1] && o.max[1] > ob.min[1]);
      for (let i = 0; i < 50 && koliduje(dx); i++) dx += sirka;
      if (dx) uzly = uzly.map(u => M.normalizujUzel(Object.assign({}, u, { poloha: [u.poloha[0] + dx, u.poloha[1], u.poloha[2]] })));
      M.zmenDokument(M.pridejUzly(M.app.dok, uzly), 'Import ' + (uzly.length === 1 ? uzly[0].nazev : M.pocet(uzly.length, 'model', 'modely', 'modelů')));
      M.nastavVyber(uzly.map(u => u.id));
      const troj = objekty.reduce((s, o) => s + o.sit.idx.length / 3, 0);
      // kontrola vodotěsnosti jen u menších sítí (u milionu trojúhelníků by zdržela o sekundy; booleany chybu stejně ohlásí)
      const spatne = objekty.filter(o => o.sit.idx.length / 3 <= 500000 && !M.zkontrolujSit(o.sit).vodotesna).map(o => o.nazev);
      Dialog.info(`Naimportováno: ${uzly.map(u => u.nazev).join(', ')} (${M.pocet(troj, 'trojúhelník', 'trojúhelníky', 'trojúhelníků').replace(/^\d+/, troj.toLocaleString('cs'))})`);
      if (meritko !== 1) Dialog.info(meritko < 1
        ? `Model byl větší než 10 m – nejspíš je v mikrometrech: zmenšen ${Math.round(1 / meritko).toLocaleString('cs')}× (rozměr uprav v inspektoru, kdyby nesedělo).`
        : `Model byl menší než 0,1 mm – nejspíš je v metrech: zvětšen ${Math.round(meritko).toLocaleString('cs')}× (rozměr uprav v inspektoru, kdyby nesedělo).`);
      if (spatne.length) Dialog.chyba(`Model ${spatne.join(', ')} není uzavřený (má díry v síti). Zobrazí se, ale ve skupině s dírami nemusí jít spočítat.`);
    }

    // přetažení souborů na plochu
    const plocha = $('plocha');
    let hloubka = 0;
    const maSoubory = e => e.dataTransfer && [...e.dataTransfer.types].includes('Files');
    plocha.addEventListener('dragenter', e => { if (!maSoubory(e)) return; e.preventDefault(); hloubka++; plocha.classList.add('pretahovani'); });
    plocha.addEventListener('dragover', e => { if (maSoubory(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
    plocha.addEventListener('dragleave', () => { if (--hloubka <= 0) { hloubka = 0; plocha.classList.remove('pretahovani'); } });
    plocha.addEventListener('drop', e => {
      if (!maSoubory(e)) return;
      e.preventDefault();
      hloubka = 0; plocha.classList.remove('pretahovani');
      M.otevriSoubory([...e.dataTransfer.files]);
    });

    // ------------------------------------------------------------ export
    const okno = $('oknoExportu');
    const vyberVolby = () => ({
      format: okno.querySelector('input[name=format]:checked').value,
      jenVyber: okno.querySelector('input[name=rozsah]:checked').value === 'vyber',
      sloucit: $('exportSloucit').checked,
      podleBarev: $('exportBarvy').checked,
    });
    function obnovOkno() {
      const v = vyberVolby();
      const vybrane = M.telesaKExportu(M.app.dok, M.app.vyber).length, vse = M.telesaKExportu(M.app.dok).length;
      $('exportPocetVyber').textContent = vybrane;
      $('exportPocetVse').textContent = vse;
      okno.querySelector('input[name=rozsah][value=vyber]').disabled = !vybrane;
      if (!vybrane) okno.querySelector('input[name=rozsah][value=vse]').checked = true;
      $('exportPoznamka').textContent = v.podleBarev && v.format !== 'step'
        ? (v.format === 'stl' ? 'Každá barva jako samostatné STL, všechna v jednom ZIPu – ve sliceru je přiřaď k filamentům.'
          : 'Každá barva jako jeden objekt pojmenovaný podle barvy. Barevné skupiny se rozdělí na uzavřená tělesa.')
        : v.format === '3mf'
        ? '3MF nese názvy a barvy těles (i po trojúhelnících) – slicer je načte jako samostatné díly.'
        : v.format === 'stl' ? 'STL je jen tvar, bez barev. Nejrozšířenější formát pro tisk.'
        : v.format === 'step' ? 'STEP pro CAD programy: tvary, zaoblení a díry přesně (válec jako válec). Díly se závity a skici jdou jako síť trojúhelníků. Počítá přesné jádro (poprvé se načítá 22 MB).'
        : 'OBJ s barvami v souboru MTL – oba dostaneš v jednom ZIPu.';
      $('exportSloucit').disabled = v.format === 'step';
      $('exportBarvy').disabled = v.format === 'step';
      $('exportChyba').textContent = '';
    }
    okno.addEventListener('change', obnovOkno);
    M.otevriExport = function () {
      okno.querySelector(`input[name=rozsah][value=${M.app.vyber.length ? 'vyber' : 'vse'}]`).checked = true;
      obnovOkno();
      if (!okno.open) okno.showModal();
    };
    $('exportZrusit').onclick = () => okno.close();
    $('exportOk').onclick = async () => {
      const v = vyberVolby();
      const uzly = M.telesaKExportu(M.app.dok, v.jenVyber ? M.app.vyber : null);
      const tl = $('exportOk');
      tl.disabled = true; tl.textContent = '⏳ Počítám…';
      try {
        if (v.format === 'step') {
          if (!uzly.length) throw new Error('není co exportovat');
          const text = await M.occtStep(uzly);
          M.stahniSoubor(text, M.jmenoSouboru(M.app.projekt.nazev, '.step'), 'model/step');
          okno.close();
          Dialog.info(`Do STEP ${uzly.length === 1 ? 'exportováno' : uzly.length <= 4 ? 'exportována' : 'exportováno'} ${M.pocet(uzly.length, 'těleso', 'tělesa', 'těles')} (${(text.length / 1024).toFixed(0)} kB)`);
          if (M.posledniStepVarovani) Dialog.info(M.posledniStepVarovani);
          return;
        }
        const r = await M.exportuj(uzly, M.sitSkupiny, { format: v.format, sloucit: v.sloucit, podleBarev: v.podleBarev, castiPodleBarev: M.castiPodleBarev, nazev: M.app.projekt.nazev });
        M.stahniSoubor(r.data, M.jmenoSouboru(M.app.projekt.nazev, r.pripona), r.mime);
        okno.close();
        const pocet = (n, a, b, c) => n + ' ' + (n === 1 ? a : n >= 2 && n <= 4 ? b : c);
        // shoda přísudku: exportována 1 barva / 2 tělesa, exportovány 2 barvy, exportováno 5 těles
        const sloveso = v.podleBarev ? (r.objektu === 1 ? 'Exportována' : r.objektu <= 4 ? 'Exportovány' : 'Exportováno') : (r.objektu >= 2 && r.objektu <= 4 ? 'Exportována' : 'Exportováno');
        Dialog.info(`${sloveso} ${v.podleBarev ? pocet(r.objektu, 'barva', 'barvy', 'barev') : pocet(r.objektu, 'těleso', 'tělesa', 'těles')}, ${M.pocet(r.trojuhelniku, 'trojúhelník', 'trojúhelníky', 'trojúhelníků').replace(/^\d+/, r.trojuhelniku.toLocaleString('cs'))} (${(r.data.length / 1024).toFixed(0)} kB)`);
      } catch (e) {
        console.error(e);
        $('exportChyba').textContent = '⚠ ' + e.message;
      } finally {
        tl.disabled = false; tl.textContent = '⬇ Exportovat';
      }
    };

    // ------------------------------------------------------------ import SVG do skici
    const oknoSvg = $('oknoSvg');
    let svgData = null, svgNazev = '', svgVysledek = null;
    function nahledSvg() {
      const rezim = oknoSvg.querySelector('input[name=svgRezim]:checked').value;
      $('svgTloustkaRadek').hidden = rezim !== 'obrys';
      $('svgChyba').textContent = '';
      try {
        svgVysledek = M.svgNaKontury(svgData, rezim, M.prectiCislo($('svgTloustka').value) || 0);
      } catch (e) { svgVysledek = null; $('svgChyba').textContent = '⚠ ' + e.message; $('svgNahled').innerHTML = ''; $('svgOk').disabled = true; return; }
      $('svgOk').disabled = false;
      const v = svgVysledek, okraj = Math.max(v.sirka, v.vyska) * 0.05 + 0.1;
      const d = v.kontury.map(k => 'M' + k.map(p => `${p[0].toFixed(3)},${(-p[1]).toFixed(3)}`).join('L') + 'Z').join('');
      $('svgNahled').innerHTML = `<svg viewBox="${-v.sirka / 2 - okraj} ${-v.vyska / 2 - okraj} ${v.sirka + 2 * okraj} ${v.vyska + 2 * okraj}"><path d="${d}" fill-rule="nonzero"/></svg>`;
      $('svgRozmer').textContent = `původně ${M.mm(v.sirka, 1)} × ${M.mm(v.vyska, 1)} mm`;
      if (!$('svgSirka').dataset.zmeneno) $('svgSirka').value = M.mm(v.sirka, 2);
    }
    M.otevriSvg = function (text, nazev) {
      try { svgData = M.ctiSvg(text); } catch (e) { Dialog.chyba(nazev + ': ' + e.message); return; }
      svgNazev = nazev;
      delete $('svgSirka').dataset.zmeneno;
      oknoSvg.querySelector('input[name=svgRezim][value=plocha]').checked = true;
      oknoSvg.showModal();
      nahledSvg();
      // písmo v SVG (<text>) se nenačte – obrysy písmen zná jen editor, ve kterém vznikl
      if (/<text[\s>]/i.test(String(text))) Dialog.info('SVG obsahuje text – ten se nenačte. V editoru ho převeď na křivky (Inkscape: Cesta → Objekt na cestu), nebo napiš text přímo ve skice.');
    };
    oknoSvg.addEventListener('change', e => { if (e.target.id === 'svgSirka') e.target.dataset.zmeneno = '1'; nahledSvg(); });
    $('svgZrusit').onclick = () => oknoSvg.close();
    $('svgOk').onclick = () => {
      if (!svgVysledek) return;
      const sirka = M.prectiCislo($('svgSirka').value);
      const meritko = sirka > 0 && svgVysledek.sirka > 0 ? sirka / svgVysledek.sirka : 1;
      const vyska = M.prectiCislo($('svgVyska').value) || 3;
      M.pridejSkicu({ tvary: [{ typ: 'polygony', kontury: svgVysledek.kontury, x: 0, y: 0, meritko }], vyska }, null, svgNazev);
      oknoSvg.close();
      Dialog.info(`SVG „${svgNazev}“ převedeno na skicu (${M.pocet(svgVysledek.kontury.length, 'obrys', 'obrysy', 'obrysů')}). Dvojklik ji otevře v editoru.`);
    };

    // ------------------------------------------------------------ projekt do souboru
    M.ulozDoSouboru = async function (p = null) {
      const zdroj = p || { nazev: M.app.projekt.nazev, dok: M.app.dok, deska: { sirka: S.deska.sirka, hloubka: S.deska.hloubka, krok: S.deska.krok }, kamera: S.kamera.stav() };
      const data = await M.projekt.zapis(zdroj);
      M.stahniSoubor(data, M.jmenoSouboru(zdroj.nazev, M.projekt.PRIPONA), 'application/x-modelar');
    };

    // ------------------------------------------------------------ šablony projektů
    const oknoSab = document.getElementById('oknoSablony');
    /** Otevře šablonu jako nový projekt (pro testy volatelné přímo). */
    M.otevriSablonu = async function (id) {
      const s = M.SABLONY.find(x => x.id === id);
      if (!s) return false;
      const dok = M.dokumentSablony(id);
      if (!await U.novy(s.nazev)) return false;
      M.zmenDokument(dok, 'Šablona: ' + s.nazev);
      M.nastavVyber([]);
      if (S.domu) S.domu(); else if (M.scena && M.scena.domu) M.scena.domu();
      return true;
    };
    M.otevriSablony = function () {
      const sez = document.getElementById('sabSeznam');
      sez.innerHTML = M.SABLONY.map(s => `<button type="button" class="sablona" data-sablona="${s.id}"><span class="ik">${s.ikona}</span><b>${s.nazev}</b><span>${s.popis}</span></button>`).join('');
      sez.querySelectorAll('[data-sablona]').forEach(b => b.onclick = async () => { oknoSab.close(); await M.otevriSablonu(b.dataset.sablona); });
      oknoSab.showModal();
    };
    document.getElementById('sabZavrit').onclick = () => oknoSab.close();

    // ------------------------------------------------------------ příkazy
    const prikazy = {
      novyProjekt: () => U.novy(),
      projekty: () => M.otevriProjekty(),
      sablony: () => M.otevriSablony(),
      otevritSoubor: () => vstup.click(),
      ulozitSoubor: () => M.ulozDoSouboru(),
      exportovat: () => M.otevriExport(),
      ulozitTed: async () => { if (U.dostupne && await U.ulozTed()) Dialog.info('Uloženo v prohlížeči'); else if (!U.dostupne) M.ulozDoSouboru(); },
    };
    // i do palety příkazů (Ctrl+K): „export“, „nový“… najde (klávesy Ctrl+S/O/E má nápověda zvlášť)
    if (M.PRIKAZY) M.PRIKAZY.push(
      { id: 'souborNovy', nazev: 'Nový projekt', klavesy: [], povoleno: () => true, akce: prikazy.novyProjekt },
      { id: 'souborProjekty', nazev: 'Moje projekty (přehled)', klavesy: [], povoleno: () => true, akce: prikazy.projekty },
      { id: 'souborSablony', nazev: 'Nový projekt ze šablony (krabička, stojánek, jmenovka…)', klavesy: [], povoleno: () => true, akce: prikazy.sablony },
      { id: 'souborOtevrit', nazev: 'Otevřít / importovat soubor (Ctrl+O)', klavesy: [], povoleno: () => true, akce: prikazy.otevritSoubor },
      { id: 'souborUlozit', nazev: 'Uložit projekt do souboru .modelar', klavesy: [], povoleno: () => true, akce: prikazy.ulozitSoubor },
      { id: 'souborExport', nazev: 'Exportovat STL, 3MF, OBJ, STEP (Ctrl+E)', klavesy: [], povoleno: () => true, akce: prikazy.exportovat },
      { id: 'napoveda', nazev: 'Nápověda (F1)', klavesy: [], povoleno: () => true, akce: () => M.otevriNapovedu && M.otevriNapovedu() },
      { id: 'pruvodce', nazev: 'Průvodce pro začátečníky', klavesy: [], povoleno: () => true, akce: () => M.spustPruvodce && M.spustPruvodce() });
    document.addEventListener('click', e => {
      const b = e.target.closest('[data-soubor]');
      if (!b) return;
      const nab = b.closest('.nabidka');
      if (nab) { const t = document.querySelector(`[data-nabidka="${nab.id}"]`); if (t) t.focus(); }
      M.zavriNabidku(nab);
      prikazy[b.dataset.soubor]();
    });
    document.addEventListener('keydown', e => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
      const k = e.key.toLowerCase();
      const akce = { s: 'ulozitTed', o: 'otevritSoubor', e: 'exportovat' }[k];
      if (!akce) return;
      e.preventDefault();
      // ne nad otevřeným oknem (skica, pole…) ani během rozdělané úpravy: import by šel do náhledu a Zrušit by ho smazal
      if (M.modalniOkno()) return;
      // náhled pod myší (zarovnání, zrcadlení) nejdřív zrušit – jinak by zkratka potichu nic neudělala
      if (M.app.uprava && M.zrusNahledy) M.zrusNahledy();
      if (M.app.uprava) return;
      prikazy[akce]();
    });
    return { prikazy };
  };
})(MDL);

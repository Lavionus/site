/* Vstupenky – kontrola na vstupu: seznamy platných kódů v IndexedDB, skenování kamerou
   (nativní BarcodeDetector, jinak zxing-wasm z lib/zxing), ruční zadání a ruční čtečky. */
(function () {
  'use strict';
  const V = window.VSTUPENKY, A = window.VSTUP_APP;
  const $ = id => document.getElementById(id);
  const dlg = A.dlg;
  const LS = 'webapp_vstupenky_seznam';
  let seznam = null;
  const historie = [];   // pro „vrátit“: [{kod (normalizovaný), log}]

  const STAVY = {
    platny: { titul: '✔ PLATNÁ', trida: 'platny' },
    pouzity: { titul: '⚠ UŽ POUŽITÁ', trida: 'pouzity' },
    neznamy: { titul: '✖ NEZNÁMÝ KÓD', trida: 'neznamy' },
    chyba_kontrolni: { titul: '✖ PŘEKLEP – chybný kontrolní znak', trida: 'chyba_kontrolni' },
    overeno: { titul: '✔ PLATNÁ (jen ověřeno)', trida: 'platny' },
    vraceno: { titul: '↩ odbavení vráceno', trida: '' },
  };

  async function vykresliSeznamy() {
    const vse = (await A.DB.vse('seznamy')).sort((a, b) => String(b.vytvoreno).localeCompare(String(a.vytvoreno)));
    const box = $('seznamy');
    box.innerHTML = vse.length ? '' : '<p class="pozn">Žádný seznam. Načti CSV nebo převezmi sérii z projektu.</p>';
    for (const s of vse) {
      const b = document.createElement('button');
      b.className = 'tl';
      b.setAttribute('aria-pressed', String(!!seznam && seznam.id === s.id));
      const pouz = Object.keys(s.pouzite || {}).length;
      b.innerHTML = '<span></span><br><small></small>';
      b.firstChild.textContent = s.nazev;
      b.lastChild.textContent = pouz + ' / ' + s.kody.length + ' odbaveno';
      b.onclick = () => aktivuj(s.id);
      box.appendChild(b);
    }
  }
  function vykresliStav() {
    $('sekceSeznam').hidden = !seznam;
    const st = $('statistika');
    if (!seznam) { st.innerHTML = ''; $('logTelo').innerHTML = ''; return; }
    const pouz = Object.keys(seznam.pouzite).length, celkem = seznam.kody.length;
    const odmitnuto = seznam.log.filter(l => l.stav !== 'platny' && l.stav !== 'overeno').length;
    st.innerHTML = `<div><b>${pouz}</b>odbaveno</div><div><b>${celkem - pouz}</b>zbývá</div><div><b>${celkem}</b>celkem</div><div><b>${odmitnuto}</b>odmítnuto</div>`;
    $('infoSeznam').textContent = seznam.nazev + (seznam.nastaveni && seznam.nastaveni.kontrolni !== 'zadny' ? ' · kontroluje se i kontrolní znak' : '');
    const t = $('logTelo');
    t.innerHTML = '';
    for (const l of seznam.log.slice(-60).reverse()) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td></td><td></td><td></td>';
      tr.children[0].textContent = new Date(l.cas).toLocaleTimeString('cs');
      tr.children[1].textContent = l.kod || l.vstup;
      tr.children[2].textContent = (STAVY[l.stav] || { titul: l.stav }).titul + (l.info ? ' · ' + l.info : '');
      tr.children[2].className = 's-' + l.stav;
      t.appendChild(tr);
    }
  }
  async function aktivuj(id) {
    const s = await A.DB.nacti('seznamy', id);
    if (!s) return;
    s.pouzite = s.pouzite || {}; s.log = s.log || []; s.info = s.info || {};
    seznam = s;
    historie.length = 0;
    try { localStorage.setItem(LS, id); } catch (_) { /* nevadí */ }
    ukazVysledek(null);
    vykresliSeznamy(); vykresliStav();
    $('vstupKod').focus();
  }
  const uloz = () => seznam && A.DB.uloz('seznamy', seznam);

  function ukazVysledek(r) {
    const v = $('vysledek');
    v.className = 'vysledek' + (r ? ' ' + STAVY[r.stav].trida : '');
    if (!r) { v.innerHTML = '<div class="velky">Připraveno</div><div class="pozn">' + (seznam ? 'Seznam: ' : 'Vyber nebo načti seznam kódů.') + '</div>'; if (seznam) v.lastChild.textContent += seznam.nazev; return; }
    v.innerHTML = '<div class="velky"></div><div class="kod"></div><div class="pozn"></div>';
    v.children[0].textContent = STAVY[r.stav].titul;
    v.children[1].textContent = r.kod;
    const info = seznam.info[V.normalizuj(r.kod)];
    v.children[2].textContent = [info, r.stav === 'pouzity' ? 'odbaveno ' + new Date(r.kdy).toLocaleString('cs') : '',
      r.stav === 'neznamy' ? 'kód není v seznamu' : ''].filter(Boolean).join(' · ');
  }

  // zvuková a hmatová odezva
  let audio = null;
  function pipni(stav) {
    if (!$('zvuk').checked) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const tony = stav === 'platny' || stav === 'overeno' ? [[880, 0, 0.12]] : stav === 'pouzity' ? [[440, 0, 0.15], [440, 0.2, 0.15]] : [[220, 0, 0.45]];
      for (const [f, z, d] of tony) {
        const o = audio.createOscillator(), g = audio.createGain();
        o.frequency.value = f; o.type = 'square';
        g.gain.setValueAtTime(0.08, audio.currentTime + z);
        g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + z + d);
        o.connect(g).connect(audio.destination);
        o.start(audio.currentTime + z); o.stop(audio.currentTime + z + d + 0.02);
      }
    } catch (_) { /* bez zvuku */ }
    if (navigator.vibrate) navigator.vibrate(stav === 'platny' || stav === 'overeno' ? 80 : [120, 80, 120]);
  }

  async function over(vstup) {
    if (!seznam) return dlg().chyba('Nejdřív vyber nebo načti seznam kódů.');
    if (!String(vstup).trim()) return;
    let r;
    if ($('jenOverit').checked) {
      const kopie = Object.assign({}, seznam, { pouzite: Object.assign({}, seznam.pouzite) });
      r = V.zkontroluj(kopie, vstup);
      if (r.stav === 'platny') r.stav = 'overeno';
    } else r = V.zkontroluj(seznam, vstup);
    if (r.stav === 'prazdny') return;
    const zaznam = { cas: new Date().toISOString(), vstup: String(vstup).slice(0, 200), kod: r.kod, stav: r.stav, info: seznam.info[V.normalizuj(r.kod)] || '' };
    seznam.log.push(zaznam);
    if (seznam.log.length > 5000) seznam.log.splice(0, seznam.log.length - 5000);
    if (r.stav === 'platny') historie.push(V.normalizuj(r.kod));
    ukazVysledek(r);
    pipni(r.stav);
    vykresliStav();
    await uloz();
    vykresliSeznamy();
  }
  $('formKod').addEventListener('submit', e => {
    e.preventDefault();
    const v = $('vstupKod').value;
    $('vstupKod').value = '';
    over(v);
  });

  async function vratit() {
    if (!seznam) return;
    const k = historie.pop();
    if (!k) return dlg().info('Není co vrátit.');
    delete seznam.pouzite[k];
    seznam.log.push({ cas: new Date().toISOString(), vstup: '', kod: k, stav: 'vraceno' });
    await uloz(); vykresliStav(); vykresliSeznamy();
    dlg().info('Odbavení kódu ' + k + ' vráceno.');
  }
  $('btnVratit').onclick = vratit;
  $('btnVynulovat').onclick = async () => {
    if (!seznam || !(await dlg().potvrd('Vynulovat všechna odbavení v seznamu „' + seznam.nazev + '“? Kódy zůstanou, jen se označí jako nepoužité.', { ok: 'Vynulovat' }))) return;
    seznam.pouzite = {}; seznam.log = []; historie.length = 0;
    await uloz(); ukazVysledek(null); vykresliStav(); vykresliSeznamy();
  };
  $('btnSmazatSeznam').onclick = async () => {
    if (!seznam || !(await dlg().potvrd('Smazat seznam „' + seznam.nazev + '“ i se stavem odbavení?', { ok: 'Smazat' }))) return;
    await A.DB.smaz('seznamy', seznam.id);
    seznam = null; ukazVysledek(null); vykresliStav(); vykresliSeznamy();
  };
  $('btnExportStav').onclick = () => {
    if (!seznam) return;
    const nazev = seznam.nazev.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').toLowerCase();
    A.stahni(nazev + '-stav-' + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-') + '.csv', '﻿' + V.csvStavu(seznam), 'text/csv;charset=utf-8');
  };

  // import CSV: nový seznam, nebo sloučení stavu z jiného zařízení
  let rezimCsv = 'novy';
  async function importCsv(soubor) {
    const text = await soubor.text();
    if (rezimCsv === 'sloucit' && seznam) {
      rezimCsv = 'novy';
      const r = V.parseCsv(text);
      const hl = (r[0] || []).map(x => x.trim().toLowerCase());
      const sk = hl.indexOf('kod'), ss = hl.indexOf('stav'), sc = hl.indexOf('cas');
      if (sk < 0 || ss < 0) return dlg().chyba('Tohle není export stavu (chybí sloupce kod a stav).');
      const zname = new Set(seznam.kody.map(V.normalizuj));
      let pridano = 0;
      for (const radek of r.slice(1)) {
        const n = V.normalizuj(radek[sk]);
        if (/použit/i.test(radek[ss] || '') && !/nepoužit/i.test(radek[ss]) && zname.has(n) && !seznam.pouzite[n]) {
          seznam.pouzite[n] = radek[sc] || new Date().toISOString(); pridano++;
        }
      }
      await uloz(); vykresliStav(); vykresliSeznamy();
      return dlg().info('Sloučeno: ' + pridano + ' nově odbavených kódů.');
    }
    const { kody, info } = V.kodyZCsv(text);
    if (!kody.length) return dlg().chyba('V souboru nejsou žádné kódy.');
    const s = { id: 's' + Date.now().toString(36), nazev: soubor.name.replace(/\.\w+$/, '') + ' (' + kody.length + ' ks)', kody, info, pouzite: {}, log: [], nastaveni: null, vytvoreno: new Date().toISOString() };
    await A.DB.uloz('seznamy', s);
    await aktivuj(s.id);
    dlg().info('Načteno ' + kody.length + ' kódů.');
  }
  $('btnNactiCsv').onclick = () => { rezimCsv = 'novy'; $('souborCsv').click(); };
  $('btnSloucit').onclick = () => { rezimCsv = 'sloucit'; $('souborCsv').click(); };
  $('souborCsv').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) importCsv(f); };

  // ---------- kamera ----------
  let proud = null, smycka = 0, ctecka = null, posledni = { text: '', cas: 0 };
  let zxingSlib = null;
  function nactiZxing() {
    if (!zxingSlib) zxingSlib = new Promise((hotovo, chyba) => {
      if (window.ZXingWASM) return hotovo(window.ZXingWASM);
      const s = document.createElement('script');
      s.src = 'lib/zxing/zxing-reader.js';
      s.onload = () => window.ZXingWASM ? hotovo(window.ZXingWASM) : chyba(new Error('Čtečku se nepodařilo načíst.'));
      s.onerror = () => { zxingSlib = null; chyba(new Error('Čtečku se nepodařilo stáhnout.')); };
      document.head.appendChild(s);
    }).then(Z => {
      const wasm = new URL('lib/zxing/zxing_reader.wasm', location.href).href;
      Z.prepareZXingModule({ overrides: { locateFile: (cesta, prefix) => cesta.endsWith('.wasm') ? wasm : prefix + cesta } });
      return Z;
    });
    return zxingSlib;
  }
  async function pripravCtecku() {
    if ('BarcodeDetector' in window) {
      try {
        const f = await BarcodeDetector.getSupportedFormats();
        if (f.includes('qr_code')) {
          const d = new BarcodeDetector({ formats: ['qr_code', 'code_128'].filter(x => f.includes(x)) });
          return async zdroj => (await d.detect(zdroj)).map(r => r.rawValue);
        }
      } catch (_) { /* zxing */ }
    }
    const Z = await nactiZxing();
    const c = document.createElement('canvas'), ctx = c.getContext('2d', { willReadFrequently: true });
    return async video => {
      c.width = video.videoWidth; c.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      const r = await Z.readBarcodes(ctx.getImageData(0, 0, c.width, c.height), { formats: ['QRCode', 'Code128'], tryHarder: false, maxNumberOfSymbols: 1 });
      return r.filter(x => x.isValid !== false).map(x => x.text);
    };
  }
  async function spustKameru() {
    if (proud) return zastavKameru();
    if (!seznam) return dlg().chyba('Nejdřív vyber nebo načti seznam kódů.');
    try {
      proud = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } });
    } catch (e) { proud = null; return dlg().chyba('Kamera není dostupná: ' + (e.message || e.name)); }
    const v = $('video');
    v.srcObject = proud;
    await v.play().catch(() => {});
    $('kameraBox').hidden = false;
    $('btnKamera').setAttribute('aria-pressed', 'true');
    try { ctecka = ctecka || await pripravCtecku(); } catch (e) { zastavKameru(); return dlg().chyba(e.message); }
    const krok = async () => {
      if (!proud) return;
      try {
        if (v.readyState >= 2) {
          const texty = await ctecka(v);
          const t = texty[0];
          // stejný kód před kamerou nehlásit znovu dřív než za 3 s
          if (t && (t !== posledni.text || Date.now() - posledni.cas > 3000)) { posledni = { text: t, cas: Date.now() }; await over(t); }
          else if (t) posledni.cas = Date.now();
        }
      } catch (_) { /* snímek bez kódu */ }
      smycka = setTimeout(krok, 180);
    };
    krok();
  }
  function zastavKameru() {
    clearTimeout(smycka);
    if (proud) proud.getTracks().forEach(t => t.stop());
    proud = null;
    $('video').srcObject = null;
    $('kameraBox').hidden = true;
    $('btnKamera').setAttribute('aria-pressed', 'false');
  }
  $('btnKamera').onclick = spustKameru;

  document.addEventListener('keydown', e => {
    if ($('kontrola').hidden) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && e.target.id !== 'vstupKod') { e.preventDefault(); vratit(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && e.target.id === 'vstupKod' && !e.target.value) { e.preventDefault(); vratit(); }
  });

  async function zobraz() {
    if (!seznam) {
      let id = null;
      try { id = localStorage.getItem(LS); } catch (_) { /* nic */ }
      if (id) await aktivuj(id);
    }
    vykresliSeznamy(); vykresliStav();
    if (!seznam) ukazVysledek(null);
    setTimeout(() => $('vstupKod').focus(), 50);
  }

  window.VSTUP_KONTROLA = { aktivuj, zobraz, zastavKameru, importCsv, over, seznam: () => seznam };
})();

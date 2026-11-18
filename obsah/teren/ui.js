/* 📱 Terén – UI (mobilní rozložení). Jádro: teren/jadro.js (window.TEREN), spis: spis/jadro.js (window.SPIS).
   Sken QR: jsQR (lib/jsQR.min.js) nad snímky kamery / fotkou štítku; ukázkový štítek kreslí lib/qrcode.min.js
   z TEREN.qrText (formát štítku Evidenčního deníku). Vše se zapisuje do aktivního spisu; přenos jen balíčkem (SPIS.exportuj/importuj). */
(function () {
  'use strict';
  const S = window.SPIS, T = window.TEREN, el = S.el, NASTROJ = T.NASTROJ;
  const $ = id => document.getElementById(id);
  const ne = (tag, text, atr) => el(tag, Object.assign({ 'data-i18n': 'ne', text: text == null ? '' : String(text) }, atr || {}));
  const chyba = e => Dialog.chyba(e && e.message ? e.message : String(e));
  let pripad = null, aktStopa = null, posledniQR = null;

  /* ---------- stav stránky ---------- */
  async function obnov() {
    try {
      pripad = S.aktivni() ? await S.pripad(S.aktivni()) : null;
      $('chybaUloziste').hidden = true;
    } catch (e) { pripad = null; $('chybaUloziste').textContent = e.message; $('chybaUloziste').hidden = false; }
    $('bezSpisu').hidden = !!pripad;
    document.querySelectorAll('[data-potrebuje-pripad]').forEach(b => { b.disabled = !pripad; });
    if (aktStopa && pripad) await ukazStopu(aktStopa);
    else if (!pripad) { aktStopa = null; $('vysledek').hidden = true; }
  }

  /* ---------- čtení QR ---------- */
  // obraz → text QR (víc měřítek: fotky z telefonu bývají obří, výřezy malé); UTF-8 z bajtů, BOM pryč
  function dekoduj(zdroj, w, h, meritka) {
    const cv = document.createElement('canvas'), g = cv.getContext('2d', { willReadFrequently: true });
    for (const cil of meritka) {
      const m = Math.min(cil / Math.max(w, h), 3);
      cv.width = Math.max(1, Math.round(w * m)); cv.height = Math.max(1, Math.round(h * m));
      g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(zdroj, 0, 0, cv.width, cv.height);
      const k = jsQR(g.getImageData(0, 0, cv.width, cv.height).data, cv.width, cv.height, { inversionAttempts: 'attemptBoth' });
      if (k) {
        try { return new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(k.binaryData)); } catch (e) { return k.data; }
      }
    }
    return null;
  }

  let proud = null, smycka = null, pokus = 0;
  async function skenovat() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return Dialog.chyba('Prohlížeč nedovolí použít kameru (je potřeba zabezpečené připojení https). Použijte 🖼️ Fotka štítku.');
    zastavit();
    const muj = pokus;
    let p;
    try {
      p = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } });
    } catch (e) {
      if (muj !== pokus) return;
      return Dialog.chyba('Kamera není k dispozici (' + (e.name === 'NotAllowedError' ? 'přístup zamítnut' : e.message || e.name) + '). Použijte 🖼️ Fotka štítku nebo ⌨️ Číslo stopy.');
    }
    // mezitím Zastavit, skrytá záložka nebo druhé Skenovat → kamera hned zhasne (jinak by zůstala svítit bez náhledu)
    if (muj !== pokus || document.hidden) { p.getTracks().forEach(t => t.stop()); return; }
    proud = p;
    const v = $('video');
    v.srcObject = proud;
    $('skener').hidden = false;
    $('skenerStav').textContent = 'Namiřte na QR štítek stopy…';
    try { await v.play(); } catch (e) { /* přehrávání spustí až snímky */ }
    $('skener').scrollIntoView({ block: 'nearest' });
    const krok = () => {
      if (!proud) return;
      if (v.readyState >= 2 && v.videoWidth) {
        const text = dekoduj(v, v.videoWidth, v.videoHeight, [800]);
        if (text) { zastavit(); if (navigator.vibrate) navigator.vibrate(60); return zpracuj(text); }
      }
      smycka = setTimeout(krok, 180);
    };
    krok();
  }
  function zastavit() {
    pokus++;
    clearTimeout(smycka);
    if (proud) proud.getTracks().forEach(t => t.stop());
    proud = null;
    $('video').srcObject = null;
    $('skener').hidden = true;
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) zastavit(); });
  addEventListener('pagehide', zastavit);

  function prectiObrazek(soubor) {
    return new Promise(hotovo => {
      const url = URL.createObjectURL(soubor), img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); hotovo(dekoduj(img, img.naturalWidth, img.naturalHeight, [1000, 1600, 700, 2400])); };
      img.onerror = () => { URL.revokeObjectURL(url); hotovo(undefined); };
      img.src = url;
    });
  }

  /* ---------- štítek → stopa ---------- */
  async function zpracuj(text) {
    const qr = T.rozeberQR(text);
    posledniQR = qr;
    if (!qr.platny) return Dialog.chyba('Tohle není štítek stopy (chybí číslo stopy, id i otisk). Přečtený text: ' + String(text).slice(0, 120));
    if (!pripad) return Dialog.chyba('Nejdřív zvolte spis (📁 Spis v liště).');
    let r;
    try { r = T.najdi(qr, await S.seznam('stopa'), pripad); } catch (e) { return chyba(e); }
    if (r.stopa) return ukazStopu(r.stopa.id, r);
    aktStopa = null;
    const box = $('vysledek');
    box.className = 'panel';
    box.replaceChildren(...[
      el('h2', { text: '❔ Stopa ve spisu není' }),
      el('dl', { class: 'udaje' }, udajeQR(qr)),
      r.jinySpis ? el('p', { class: 'hlaseni pozor', style: 'margin-top:10px' }, 'Štítek patří k jinému spisu: ', ne('b', qr.spis), '. Aktivní spis je ', ne('b', nazevPripadu()), '.') : null,
      r.kandidati.length ? el('h3', { text: 'Stopy se stejným číslem v tomto spisu' }) : null,
      ...r.kandidati.map(k => el('button', { type: 'button', class: 'tl kandidat', onclick: () => ukazStopu(k.id, { podle: 'cislo', jinySpis: r.jinySpis }) }, '🧪 ', ne('span', (k.data.cislo ? k.data.cislo + ' · ' : '') + k.nazev))),
      el('div', { class: 'radek-tl' }, el('button', { type: 'button', class: 'tl hlavni velky', id: 'zalozitZQR', onclick: () => zalozZQR(qr) }, '➕ Založit stopu z údajů štítku'))].filter(Boolean));
    box.hidden = false;
    box.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  const nazevPripadu = () => pripad ? (pripad.cislo ? pripad.cislo + ' – ' : '') + pripad.nazev : '';
  const udajeQR = qr => [['Spis na štítku', qr.spis], ['Číslo stopy', qr.stopa], ['ID', qr.id], ['Otisk SHA-256', qr.sha256]]
    .filter(x => x[1]).flatMap(([k, v]) => [el('dt', { text: k }), ne('dd', v, k === 'ID' || k.startsWith('Otisk') ? { class: 'mono' } : null)]);

  async function zalozZQR(qr) {
    try {
      const volne = !qr.id || !(await S.entita(qr.id));
      const e = await S.uloz(T.stopaZQR(qr, volne), { nastroj: NASTROJ });
      Dialog.info('Stopa založena ve spisu. Doplňte údaje v kartě (📄 Karta ve spisu).');
      await ukazStopu(e.id, { podle: 'novy' });
    } catch (e) { chyba(e); }
  }

  const PODLE = { id: 'podle id ze štítku', otisk: 'podle otisku SHA-256', cislo: 'podle čísla stopy', novy: 'založena ze štítku' };
  async function ukazStopu(id, info) {
    const e = await S.entita(id).catch(() => null);
    const box = $('vysledek');
    if (!e || e.smazano || !pripad || e.pripad !== pripad.id) { aktStopa = null; box.hidden = true; return; }
    aktStopa = id;
    if (info) box.dataset.podle = info.podle || '';
    const d = e.data, predani = T.predaniStopy(e);
    const radky = [['Druh', d.druh], ['Místo nálezu', d.misto], ['Zajistil', d.zajistil], ['Zajištěno', d.kdy && S.formatCas(d.kdy)], ['Obal / pečeť', d.obal], ['Stav', d.stav], ['Otisk SHA-256', d.sha256]]
      .filter(x => x[1]).flatMap(([k, v]) => [el('dt', { text: k }), ne('dd', v, k.startsWith('Otisk') ? { class: 'mono' } : null)]);
    const obal = k => (T.OBALY.find(o => o[0] === k) || [k, k])[1];
    const vyhrady = T.kontrola(e, T.mistniCas());
    box.className = 'panel stopa';
    box.replaceChildren(...[
      el('h2', {}, '🧪 ', d.cislo ? ne('span', 'č. ' + d.cislo, { class: 'cislo' }) : null, ne('span', e.nazev)),
      box.dataset.podle && PODLE[box.dataset.podle] ? el('span', { class: 'znak', text: '✓ ' + PODLE[box.dataset.podle] }) : null,
      info && info.jinySpis ? el('p', { class: 'hlaseni pozor', style: 'margin-top:8px' }, 'Pozor: štítek uvádí jiný spis (', ne('span', posledniQR ? posledniQR.spis : ''), ').') : null,
      el('dl', { class: 'udaje' }, radky),
      el('div', { class: 'drzitel' }, 'Teď má: ', ne('b', T.drzitel(e) || '–')),
      el('h3', { text: 'Řetězec předávání (' + predani.length + ')' }),
      predani.length ? el('ol', { class: 'retezec', id: 'retezec' }, predani.map(p => el('li', {},
        ne('div', S.formatCas(p.kdy) || p.kdy || '–', { class: 'kdy' }),
        ne('span', (p.od || '?') + ' → ' + (p.komu || '?')),
        p.ucel ? ne('span', ' · ' + p.ucel) : null,
        p.obal ? el('span', { class: 'kdy' }, ' · ', el('span', { text: 'obal' }), ' ', el('span', { text: obal(p.obal) })) : null,
        p.pozn ? ne('div', p.pozn, { class: 'kdy' }) : null)))
        : el('p', { class: 'sub', id: 'retezec', text: 'Zatím žádné předání – stopu má ten, kdo ji zajistil.' }),
      vyhrady.length ? el('ul', { class: 'vyhrady' }, vyhrady.map(v => el('li', { class: v.uroven }, (v.uroven === 'chyba' ? '⛔ ' : '⚠️ '), ne('span', v.text)))) : null,
      el('div', { class: 'radek-tl' },
        el('button', { type: 'button', class: 'tl hlavni velky', 'data-prikaz': 'predat' }, '🤝 Předat'),
        el('button', { type: 'button', class: 'tl velky', 'data-prikaz': 'zaznamStopa' }, '📝 Záznam ke stopě'),
        el('button', { type: 'button', class: 'tl velky', 'data-prikaz': 'karta' }, '📄 Karta ve spisu'))].filter(Boolean));
    if (box.hidden || info) { box.hidden = false; box.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
  }

  /* ---------- předání ---------- */
  async function predat() {
    const e = aktStopa && await S.entita(aktStopa);
    if (!e) return;
    const osoby = new Set();
    for (const s of await S.seznam('stopa')) { if (s.data.zajistil) osoby.add(s.data.zajistil); for (const p of T.predaniStopy(s)) { if (p.od) osoby.add(p.od); if (p.komu) osoby.add(p.komu); } }
    for (const o of await S.seznam('osoba', { fn: x => /polic/i.test(x.data.role || '') })) osoby.add(o.nazev);
    $('seznamOsob').replaceChildren(...[...osoby].sort((a, b) => a.localeCompare(b, 'cs')).map(o => el('option', { value: o })));
    $('seznamUcelu').replaceChildren(...T.UCELY.map(u => el('option', { value: u })));
    $('predaniStopa').textContent = e.data.cislo ? 'č. ' + e.data.cislo : e.nazev;
    $('pOd').value = T.drzitel(e); $('pKomu').value = ''; $('pKdy').value = T.mistniCas(); $('pUcel').value = ''; $('pObal').value = 'neporusen'; $('pPozn').value = '';
    $('pChyba').textContent = '';
    $('dlgPredani').showModal();
    (($('pOd').value ? $('pKomu') : $('pOd'))).focus();
  }
  $('formPredani').addEventListener('submit', async ev => {
    if (ev.submitter && ev.submitter.value !== 'ok') return;
    ev.preventDefault();
    try {
      await T.predat(S, aktStopa, { od: $('pOd').value, komu: $('pKomu').value, kdy: $('pKdy').value, ucel: $('pUcel').value, obal: $('pObal').value, pozn: $('pPozn').value });
      $('dlgPredani').close();
      Dialog.info('Předání zapsáno do spisu.');
      await ukazStopu(aktStopa);
    } catch (e) { $('pChyba').textContent = e.chyby && e.chyby.length ? e.chyby.join(' ') : e.message; }
  });

  /* ---------- rychlý záznam ---------- */
  let foto = null, poloha = null, nahledUrl = null;
  async function zaznam(keStope) {
    const e = keStope && aktStopa ? await S.entita(aktStopa) : null;
    foto = null; poloha = null;
    if (nahledUrl) URL.revokeObjectURL(nahledUrl);
    $('zNahled').hidden = true; $('zFotoInfo').hidden = true;
    $('zPozn').value = ''; $('zKdy').value = T.mistniCas(); $('zOsa').checked = true; $('zGps').checked = false;
    $('zGpsStav').hidden = true; $('zChyba').textContent = '';
    $('zStopaVolba').hidden = !e; $('zStopa').checked = !!e;
    $('zStopaNazev').textContent = e ? (e.data.cislo ? 'č. ' + e.data.cislo + ' · ' : '') + e.nazev : '';
    $('dlgZaznam').showModal();
  }
  function vlozFoto(f) {
    if (!f) return;
    if (!/^image\//.test(f.type)) return Dialog.chyba('Vybraný soubor není obrázek.');
    if (f.size > 200 * 1024 * 1024) return Dialog.chyba('Fotka je větší než 200 MB.');
    foto = f;
    if (nahledUrl) URL.revokeObjectURL(nahledUrl);
    nahledUrl = URL.createObjectURL(f);
    $('zNahled').src = nahledUrl; $('zNahled').hidden = false;
    $('zFotoInfo').textContent = (f.name || 'fotka') + ' · ' + (f.size / 1048576).toFixed(2) + ' MB – po uložení dostane otisk SHA-256';
    $('zFotoInfo').hidden = false;
    if (!$('zKdy').value) $('zKdy').value = T.mistniCas();
  }
  $('zVyfotit').onclick = () => $('zFoto').click();
  $('zGalerie').onclick = () => $('zFotoGalerie').click();
  for (const id of ['zFoto', 'zFotoGalerie']) $(id).addEventListener('change', e => { vlozFoto(e.target.files[0]); e.target.value = ''; });
  // poloha jen po výslovném zaškrtnutí; bez souhlasu se geolokace vůbec nevolá
  $('zGps').addEventListener('change', () => {
    const st = $('zGpsStav');
    poloha = null;
    if (!$('zGps').checked) { st.hidden = true; return; }
    st.hidden = false;
    if (!navigator.geolocation) { st.textContent = 'Prohlížeč polohu neposkytuje.'; $('zGps').checked = false; return; }
    st.textContent = '⏳ Zjišťuji polohu…';
    navigator.geolocation.getCurrentPosition(p => {
      if (!$('zGps').checked) return;
      poloha = { lat: p.coords.latitude, lon: p.coords.longitude, presnost: p.coords.accuracy };
      st.textContent = '📍 ' + T.textPolohy(poloha);
    }, e => {
      $('zGps').checked = false;
      st.textContent = 'Polohu se nepodařilo zjistit' + (e.code === 1 ? ' – přístup zamítnut.' : '.') + ' Záznam se uloží bez ní.';
    }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 });
  });
  $('formZaznam').addEventListener('submit', async ev => {
    if (ev.submitter && ev.submitter.value !== 'ok') return;
    ev.preventDefault();
    $('zChyba').textContent = '';
    if ($('zGps').checked && !poloha) { $('zChyba').textContent = 'Poloha se ještě zjišťuje – počkejte, nebo ji vypněte.'; return; }
    const tl = $('zUlozit');
    tl.disabled = true;
    try {
      const r = await T.zaznam(S, { foto, poznamka: $('zPozn').value, kdy: $('zKdy').value, poloha: $('zGps').checked ? poloha : null,
        naOsu: $('zOsa').checked, stopa: !$('zStopaVolba').hidden && $('zStopa').checked ? aktStopa : null });
      $('dlgZaznam').close();
      Dialog.info('Uloženo do spisu: ' + [r.foto ? 'fotografie (fotodokumentace)' : '', r.udalost ? 'událost (časová osa)' : ''].filter(Boolean).join(' + ') + (r.vazby.some(v => v.typ === 'tyka_se') ? ', připojeno ke stopě.' : '.'));
    } catch (e) { $('zChyba').textContent = e.chyby && e.chyby.length ? e.chyby.join(' ') : e.message; }
    finally { tl.disabled = false; }
  });

  /* ---------- přenos balíčkem ---------- */
  function stahni(soubor) {
    const a = el('a', { href: URL.createObjectURL(soubor), download: soubor.name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  async function odeslat() {
    if (!pripad) return;
    let text;
    try { text = await S.exportuj(pripad.id); } catch (e) { return chyba(e); }
    const soubor = new File([text], T.jmenoBalicku(pripad), { type: 'application/json' });
    let zpusob = 'stazeni';
    try {
      if (navigator.canShare && navigator.share && navigator.canShare({ files: [soubor] })) {
        await navigator.share({ files: [soubor], title: 'Balíček spisu ' + nazevPripadu(), text: 'Balíček spisu – na druhém zařízení ho načtěte (📁 Spis případu → 📦 Balíček → Importovat).' });
        zpusob = 'sdileni';
      }
    } catch (e) {
      if (e.name === 'AbortError') return { zpusob: 'zruseno', text };
      zpusob = 'stazeni';   // sdílení selhalo → aspoň stáhnout
    }
    if (zpusob === 'stazeni') { stahni(soubor); Dialog.info('Balíček stažen (' + soubor.name + '). Přeneste ho na druhé zařízení a tam načtěte.'); }
    else Dialog.info('Balíček nasdílen. Na druhém zařízení ho načtěte.');
    return { zpusob, text, nazev: soubor.name };
  }
  async function nactiText(text) {
    try {
      const r = await S.importuj(text, { nastroj: NASTROJ });
      await S.otevri(r.pripad);
      const zprava = 'Balíček načten: ' + r.nazev + ' – nových ' + r.nove + ', aktualizovaných ' + r.aktualizovane + ', ponechaných ' + r.ponechane + '.'
        + (r.konflikty.length ? ' Konflikty: ' + r.konflikty.length + ' (podrobnosti ve 📁 Spisu případu – historie).' : '')
        + (r.vynechane.length ? ' Vynecháno neplatných: ' + r.vynechane.length + '.' : '');
      (r.konflikty.length || r.vynechane.length ? Dialog.chyba : Dialog.info)(zprava);
      return r;
    } catch (e) { chyba(e); }
  }
  $('souborBalicku').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    if (f.size > 1024 * 1024 * 1024) return Dialog.chyba('Soubor je větší než 1 GB – to není balíček spisu.');
    nactiText(await f.text());
  });
  $('souborStitku').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    const text = await prectiObrazek(f);
    if (text === undefined) return Dialog.chyba('Obrázek nejde otevřít.');
    if (!text) return Dialog.chyba('Na fotce jsem QR kód nenašel. Zkuste ostřejší snímek zblízka, celý štítek v záběru.');
    zpracuj(text);
  });

  /* ---------- ukázka (modelový případ 17/2026) ---------- */
  async function ukazka() {
    try {
      await S.zalozModelovy(window.MODELOVY_PRIPAD, { nastroj: NASTROJ });
      const M = window.MODELOVY_PRIPAD;
      await S.otevri('model-' + M.id);
      await obnov();
      const s = await S.entita('model-' + M.id + '-stopa-5');
      if (!s) return Dialog.chyba('Stopa č. 5 v modelovém spisu chybí (smazaná?).');
      const box = $('ukazkaQR');
      box.replaceChildren();
      // stejný obsah jako štítek z Evidenčního deníku nad spisem
      new QRCode(box, { text: T.qrText(s.data.cislo, s.id, s.data.sha256, nazevPripadu()), width: 300, height: 300, correctLevel: QRCode.CorrectLevel.M });
      $('ukazkaText').replaceChildren(el('b', { text: s.data.cislo }), el('span', { text: s.nazev }), el('br'), el('span', { text: nazevPripadu() }));
      $('ukazka').hidden = false;
      $('ukazka').scrollIntoView({ block: 'start', behavior: 'smooth' });
    } catch (e) { chyba(e); }
  }
  function prectiUkazku() {
    const c = $('ukazkaQR').querySelector('canvas');
    if (!c) return;
    // bílý okraj jako na papíře, pak stejné čtení jako u fotky
    const k = document.createElement('canvas'), q = 30;
    k.width = c.width + 2 * q; k.height = c.height + 2 * q;
    const g = k.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, k.width, k.height); g.drawImage(c, q, q);
    const text = dekoduj(k, k.width, k.height, [600]);
    if (!text) return Dialog.chyba('Štítek se nepodařilo přečíst.');
    zpracuj(text);
  }

  /* ---------- příkazy, lišta, nabídky ---------- */
  const PRIKAZY = {
    skenovat, zastavit, fotoStitku: () => $('souborStitku').click(),
    async rucne() {
      const t = await Dialog.zeptej('Číslo stopy (např. 5 nebo D-05) nebo otisk SHA-256', '');
      if (t !== null && t.trim()) zpracuj(t.trim());
    },
    zaznam: () => zaznam(false), zaznamStopa: () => zaznam(true), predat,
    karta: () => aktStopa && SpisKarta.otevri(aktStopa, { nastroj: NASTROJ }),
    odeslat, nacist: () => $('souborBalicku').click(), nactiText,
    ukazka, prectiUkazku, skryjUkazku: () => { $('ukazka').hidden = true; },
    napoveda: () => $('dlgNapoveda').showModal(),
    zpracuj, prectiObrazek
  };
  function zavriNabidky() {
    document.querySelectorAll('.nabidka:not([hidden])').forEach(n => { n.hidden = true; });
    document.querySelectorAll('[data-nabidka][aria-expanded="true"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
  }
  document.querySelectorAll('[data-nabidka]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    const n = $(b.dataset.nabidka), bylo = !n.hidden;
    zavriNabidky();
    if (bylo) return;
    n.hidden = false; b.setAttribute('aria-expanded', 'true');
    const r = b.getBoundingClientRect();
    n.style.top = (r.bottom + 4) + 'px';
    n.style.left = Math.max(6, Math.min(r.left, innerWidth - n.offsetWidth - 6)) + 'px';
  }));
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-prikaz]');
    if (b && !b.disabled) { zavriNabidky(); return PRIKAZY[b.dataset.prikaz](); }
    if (!e.target.closest('.nabidka')) zavriNabidky();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') zavriNabidky(); });
  addEventListener('resize', zavriNabidky);
  document.querySelectorAll('[data-zavrit]').forEach(b => b.onclick = () => b.closest('dialog').close());

  // změny spisu z jiných záložek / nástrojů (např. předání zapsané v deníku) i přepnutí případu
  S.odebirej(u => { if (u.druh === 'aktivni' || u.druh === 'pripad' || u.druh === 'import' || (pripad && u.pripad === pripad.id)) obnov(); });
  addEventListener('storage', e => { if (e.key === S.KLIC_AKTIVNI) obnov(); });

  SpisVyber.vloz($('vyberMisto'), { nastroj: NASTROJ });
  // průvodce modelovým případem (?pripad=17): rovnou otevřít modelový spis a ukázkový štítek
  const hotovo = obnov().then(() => window.ModelovyPripad && window.ModelovyPripad.aktivni ? ukazka() : null);
  window.TEREN_APP = { PRIKAZY, hotovo, get stopa() { return aktStopa; }, get pripad() { return pripad; } };
})();

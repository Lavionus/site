/* cvGen/stranka.js – obsluha stránky Životopis (editor, náhled, verze, ořez fotky).
   Data a vykreslení listu jsou v cvGen/jadro.js (CVJ). */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = CVJ.esc;
  const KLIC = 'webapp_cv_data', KLIC_VERZE = 'webapp_cv_verze', KLIC_UI = 'webapp_cv_ui', STARY_KLIC = 'cvBuilderData';

  $('cv-css').textContent = CVJ.CSS + CVJ.CSS_TISK;
  if (typeof qrcode === 'function') qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
  const qrMatice = text => {
    if (typeof qrcode !== 'function') return null;
    try { const q = qrcode(0, 'M'); q.addData(text); q.make(); return { n: q.getModuleCount(), dark: (y, x) => q.isDark(y, x) }; }
    catch (e) { return null; }   // text je na QR moc dlouhý
  };
  // co je v náhledu a v tisku: životopis, nebo průvodní dopis
  let dokument = 'cv';
  const list = () => (dokument === 'dopis' ? CVJ.vykresliDopis : dokument === 'vizitky' ? CVJ.vykresliVizitky : CVJ.vykresli)(stav, fotky.foto, qrMatice);
  const jmenoDokumentu = () => CVJ.jmenoSouboru(stav).replace(/^CV_/, { dopis: 'Dopis_', vizitky: 'Vizitky_' }[dokument] || 'CV_');
  if (window.self === window.top) document.body.classList.add('samostatne');   // místo pro štítek z podpis.js
  let stav = CVJ.vychozi();
  let fotky = { foto: null, original: null };

  // ---------- úložiště ----------

  // fotky do IndexedDB – v localStorage (5 MB na celý web) by se nevešly
  const DB = (() => {
    let spojeni;
    const otevri = () => spojeni || (spojeni = new Promise((ok, ko) => {
      const r = indexedDB.open('webapp_cv', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('fotky');
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ko(r.error);
    }));
    const tx = (rezim, f) => otevri().then(db => new Promise((ok, ko) => {
      const t = db.transaction('fotky', rezim), poz = f(t.objectStore('fotky'));
      t.oncomplete = () => ok(poz.result);
      t.onerror = () => ko(t.error);
    }));
    return {
      nacti: k => tx('readonly', s => s.get(k)),
      uloz: (k, v) => tx('readwrite', s => v ? s.put(v, k) : s.delete(k))
    };
  })();

  function ulozFotky() {
    return Promise.all([DB.uloz('foto', fotky.foto), DB.uloz('original', fotky.original)])
      .then(() => { if (kanal) kanal.postMessage('fotky'); })
      .catch(e => Dialog.chyba('Fotku se nepodařilo uložit (' + e.message + '). Zálohujte ji přes Export JSON.'));
  }

  let chybaUlozeni = false, casovac = 0;
  function uloz() {
    clearTimeout(casovac); casovac = 0;
    try {
      localStorage.setItem(KLIC, JSON.stringify(stav));
      chybaUlozeni = false;
    } catch (e) {
      if (!chybaUlozeni) Dialog.chyba('Životopis se nepodařilo uložit – úložiště prohlížeče je plné nebo zakázané. Zálohujte ho přes Soubor → Export JSON.');
      chybaUlozeni = true;
    }
  }
  addEventListener('pagehide', () => { if (casovac) uloz(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && casovac) uloz(); });

  // stejný životopis otevřený v jiné kartě: jeho uložení převezmeme, jinak bychom ho přepsali starým stavem
  addEventListener('storage', e => {
    if (e.key !== KLIC || !e.newValue) return;
    try { stav = CVJ.normalizuj(JSON.parse(e.newValue)); } catch (err) { return; }
    clearTimeout(casovac); casovac = 0;
    naplnFormular(); vykresliNahled(); zaznamenej();
    Dialog.info('Životopis byl upraven v jiné kartě – zobrazena novější verze.');
  });
  const kanal = typeof BroadcastChannel === 'function' ? new BroadcastChannel('webapp_cv') : null;
  if (kanal) kanal.onmessage = async () => {
    try { fotky = { foto: await DB.nacti('foto') || null, original: await DB.nacti('original') || null }; } catch (e) { return; }
    vykresliFoto(); vykresliNahled();
  };

  let snimek = 0;
  function zmena() {
    if (!snimek) snimek = requestAnimationFrame(() => { snimek = 0; vykresliNahled(); });
    clearTimeout(casovac); casovac = setTimeout(uloz, 400);
    clearTimeout(casHistorie); casHistorie = setTimeout(zaznamenej, 500);
  }

  // historie (Zpět / Znovu): snímky celého stavu, psaní se slučuje po půl sekundě klidu
  let historie = [], pozice = -1, casHistorie = 0;
  function zaznamenej() {
    clearTimeout(casHistorie); casHistorie = 0;
    const j = JSON.stringify(stav);
    if (j === historie[pozice]) return;
    historie = historie.slice(0, pozice + 1);
    historie.push(j);
    if (historie.length > 80) historie.shift();
    pozice = historie.length - 1;
    oznacHistorii();
  }
  function oznacHistorii() {
    $('tlZpet').disabled = pozice <= 0;
    $('tlZnovu').disabled = pozice >= historie.length - 1;
  }
  function krokHistorie(d) {
    if (casHistorie) zaznamenej();
    const n = pozice + d;
    if (n < 0 || n >= historie.length) return;
    pozice = n;
    stav = CVJ.normalizuj(JSON.parse(historie[n]));
    naplnFormular(); vykresliNahled(); oznacHistorii();
    clearTimeout(casovac); casovac = setTimeout(uloz, 400);
  }
  document.addEventListener('keydown', e => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const k = e.key.toLowerCase(), zpet = k === 'z' && !e.shiftKey, znovu = k === 'y' || (k === 'z' && e.shiftKey);
    if (!zpet && !znovu) return;
    // v textovém poli nechat jeho vlastní Zpět
    if (e.target.closest('input:not([type=range]):not([type=checkbox]):not([type=radio]):not([type=color]), textarea, select')) return;
    e.preventDefault(); krokHistorie(zpet ? -1 : 1);
  });

  const ui = (() => { try { return JSON.parse(localStorage.getItem(KLIC_UI)) || {}; } catch (e) { return {}; } })();
  function ulozUi() { try { localStorage.setItem(KLIC_UI, JSON.stringify(ui)); } catch (e) { /* jen pohodlí */ } }

  // ---------- formulář ----------

  function cesta(p) {
    const c = p.split('.');
    let o = stav;
    while (c.length > 1) o = o[c.shift()];
    return [o, c[0]];
  }
  const hodnota = el => el.type === 'checkbox' ? el.checked : el.type === 'range' ? +el.value : el.value;
  function ukazHodnotu(el) {
    const v = el.closest('.pole') && el.closest('.pole').querySelector('output');
    if (v) v.textContent = el.value + (el.dataset.jednotka || '');
  }

  $('qrTyp').innerHTML = Object.entries(CVJ.QR_TYPY).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
  $('qrMisto').innerHTML = Object.entries(CVJ.QR_MISTA).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
  function volbyQr() {
    const sel = $('qrOdkaz'), st = stav.settings;
    sel.innerHTML = stav.links.length ? stav.links.map((l, i) => `<option value="${i}">${esc(l.platform.trim() || l.url.trim() || 'Odkaz ' + (i + 1))}</option>`).join('')
      : '<option value="0">– nejdřív přidejte odkaz –</option>';
    st.qrLink = Math.max(0, Math.min(st.qrLink, stav.links.length - 1));
    sel.value = String(st.qrLink);
    sel.disabled = !stav.links.length;
    document.querySelectorAll('[data-qr-jen]').forEach(el => { el.hidden = el.dataset.qrJen !== st.qr; });
    $('qrMisto').disabled = st.qr === 'ne';
    nahledQr();
  }
  // živý náhled QR kódu ve Vzhledu (černý na bílé, jak se stáhne)
  function nahledQr() {
    const q = CVJ.qrObsah(stav), m = q && qrMatice(q.text);
    $('qrNahled').innerHTML = m ? CVJ.qrSvgSoubor(m) : stav.settings.qr === 'ne' ? 'bez QR kódu' : q ? 'text je na QR kód příliš dlouhý' : 'chybí údaj';
    $('qrSvg').disabled = $('qrPng').disabled = !m;
    $('qrInfo').textContent = m ? `Obsah: ${q.text.length > 90 ? q.text.slice(0, 90) + '…' : q.text}` : '';
  }
  function stahniQr(png) {
    const q = CVJ.qrObsah(stav), m = q && qrMatice(q.text);
    if (!m) return;
    const jmeno = 'QR_' + CVJ.jmenoSouboru(stav).replace(/^CV_/, '') + '_' + stav.settings.qr;
    if (!png) return stahni(CVJ.qrSvgSoubor(m), jmeno + '.svg', 'image/svg+xml');
    const v = m.n + 8, k = Math.max(4, Math.floor(1200 / v)), c = document.createElement('canvas'), g = c.getContext('2d');
    c.width = c.height = v * k;
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#000';
    for (let y = 0; y < m.n; y++) for (let x = 0; x < m.n; x++) if (m.dark(y, x)) g.fillRect((x + 4) * k, (y + 4) * k, k, k);
    c.toBlob(b => { const u = URL.createObjectURL(b), a = document.createElement('a'); a.href = u; a.download = jmeno + '.png'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 1000); });
  }
  $('qrSvg').onclick = () => stahniQr(false);
  $('qrPng').onclick = () => stahniQr(true);
  // vizitky: volby odkazů a rozvržení
  $('vzQr').innerHTML = Object.entries(CVJ.QR_TYPY).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
  $('vzRozvrzeni').innerHTML = Object.entries(CVJ.VIZITKA_ROZVRZENI).map(([id, n]) =>
    `<label><input type="radio" name="vzRozvrzeni" value="${id}" data-pole="card.layout"><span class="mini-vz m-${id}"></span>${n}</label>`).join('');
  function volbyVizitek() {
    const C = stav.card, nazev = (l, i) => esc(l.platform.trim() || l.url.trim() || 'Odkaz ' + (i + 1));
    $('vzWeb').innerHTML = '<option value="-1">Žádný</option>' + stav.links.map((l, i) => `<option value="${i}">${nazev(l, i)}</option>`).join('');
    if (C.web >= stav.links.length) C.web = -1;
    $('vzWeb').value = String(C.web);
    $('vzQrOdkaz').innerHTML = stav.links.length ? stav.links.map((l, i) => `<option value="${i}">${nazev(l, i)}</option>`).join('') : '<option value="0">– nejdřív přidejte odkaz –</option>';
    C.qrLink = Math.max(0, Math.min(C.qrLink, stav.links.length - 1));
    $('vzQrOdkaz').value = String(C.qrLink);
    document.querySelectorAll('[data-vzqr-jen]').forEach(el => { el.hidden = el.dataset.vzqrJen !== C.qr; });
  }
  function naplnFormular() {
    volbyQr();
    volbyVizitek();
    document.querySelectorAll('[data-pole]').forEach(el => {
      const [o, k] = cesta(el.dataset.pole);
      if (el.type === 'checkbox') el.checked = !!o[k];
      else if (el.type === 'radio') el.checked = el.value === o[k];
      else el.value = o[k];
      ukazHodnotu(el);
    });
    Object.keys(SEZNAMY).forEach(vykresliSeznam);
    vykresliRozlozeni();
    vykresliFoto();
    oznacVolby();
  }

  $('editor').addEventListener('input', e => {
    const el = e.target;
    if (el.dataset.pole) {
      const [o, k] = cesta(el.dataset.pole);
      o[k] = hodnota(el);
      if (el.dataset.pole === 'custom.heading') vykresliRozlozeni();
      if (el.dataset.pole === 'settings.qrLink') stav.settings.qrLink = +el.value;
      if (el.dataset.pole === 'card.web' || el.dataset.pole === 'card.qrLink') o[k] = +el.value;
      if (el.dataset.pole === 'card.qr') volbyVizitek();
      if (el.dataset.pole.startsWith('settings.qr')) volbyQr();
      if (el.dataset.pole === 'settings.lang') {
        const vychozi = Object.values(CVJ.JAZYKY).map(j => j.gdpr);
        if (vychozi.includes(stav.gdpr.text)) { stav.gdpr.text = CVJ.JAZYKY[stav.settings.lang].gdpr; naplnFormular(); }
        vykresliRozlozeni();
      }
      if (el.dataset.pole === 'settings.primary' || el.dataset.pole === 'settings.accent') { stav.settings.theme = 'vlastni'; oznacVolby(); }
    } else if (el.dataset.k) {
      const kol = el.closest('[data-seznam]').dataset.seznam, i = +el.closest('[data-i]').dataset.i;
      stav[kol][i][el.dataset.k] = hodnota(el);
      if (kol === 'links') { volbyQr(); volbyVizitek(); }
    } else return;
    ukazHodnotu(el);
    if (stav.settings.qr !== 'ne' && !$('panel-vzhled').hidden) nahledQr();
    zmena();
  });

  // seznamy: [klíč, popisek, typ, nápověda, třída]
  const SEZNAMY = {
    links: { radek: true, nove: { platform: 'Web', url: '' }, pole: [['platform', 'Druh', 'text', 'LinkedIn', 'uzke'], ['url', 'Adresa', 'text', 'linkedin.com/in/…']] },
    skills: { radek: true, nove: { name: '', level: 60 }, pole: [['name', 'Dovednost', 'text', 'např. Excel'], ['level', 'Úroveň', 'range', '', 'uzke']] },
    languages: { radek: true, nove: { name: '', level: '' }, pole: [['name', 'Jazyk', 'text', 'Angličtina'], ['level', 'Úroveň', 'text', 'B2, rodilý mluvčí…', 'uzke']] },
    experience: { nove: { date: '', role: '', company: '', desc: '' }, pole: [['date', 'Období', 'text', '2020 — dnes'], ['role', 'Pozice', 'text'],
      ['company', 'Firma', 'text', '', 'cela'], ['desc', 'Náplň práce a úspěchy', 'md', '* Odpovědnost…\n* Úspěch s číslem…', 'cela']] },
    education: { nove: { date: '', degree: '', school: '', desc: '' }, pole: [['date', 'Období', 'text', '2015 — 2019'], ['degree', 'Titul / obor', 'text'],
      ['school', 'Škola', 'text', '', 'cela'], ['desc', 'Poznámka', 'md', 'zaměření, závěrečná práce…', 'cela']] },
    certificates: { nove: { date: '', name: '', issuer: '' }, pole: [['date', 'Rok', 'text', '2023'], ['name', 'Název', 'text', 'např. PMP, svářečský průkaz'],
      ['issuer', 'Vydal', 'text', '', 'cela']] },
    projects: { nove: { name: '', url: '', desc: '' }, pole: [['name', 'Název', 'text'], ['url', 'Odkaz', 'text', 'github.com/…'], ['desc', 'Popis', 'md', '', 'cela']] },
    references: { nove: { name: '', relation: '', contact: '' }, pole: [['name', 'Jméno', 'text'], ['relation', 'Vztah / firma', 'text', 'bývalý nadřízený, Firma a.s.'],
      ['contact', 'Kontakt', 'text', 'telefon nebo e-mail', 'cela']] }
  };

  function vstup([k, nazev, typ, ph = '', trida = ''], v) {
    const el = typ === 'md' ? `<textarea class="vstup" data-k="${k}" placeholder="${esc(ph)}">${esc(v)}</textarea>`
      : typ === 'range' ? `<input type="range" min="0" max="100" step="5" value="${+v}" data-k="${k}" data-jednotka=" %">`
      : `<input class="vstup" data-k="${k}" value="${esc(v)}" placeholder="${esc(ph)}">`;
    return `<label class="pole ${trida}"><span>${nazev}${typ === 'range' ? `<output>${+v} %</output>` : ''}</span>${el}</label>`;
  }

  function vykresliSeznam(kol) {
    const d = SEZNAMY[kol], a = stav[kol], el = document.querySelector(`[data-seznam="${kol}"]`);
    const tl = i => `<span class="pol-tl">` +
      `<button type="button" class="tl mini" data-posun="-1" title="Posunout výš" aria-label="Posunout výš"${i === 0 ? ' disabled' : ''}>↑</button>` +
      `<button type="button" class="tl mini" data-posun="1" title="Posunout níž" aria-label="Posunout níž"${i === a.length - 1 ? ' disabled' : ''}>↓</button>` +
      `<button type="button" class="tl mini" data-smaz title="Odebrat" aria-label="Odebrat">🗑</button></span>`;
    el.innerHTML = a.length ? a.map((x, i) => d.radek
      ? `<div class="pol radek" data-i="${i}">${d.pole.map(f => vstup(f, x[f[0]])).join('')}${tl(i)}</div>`
      : `<div class="pol" data-i="${i}"><div class="pol-hl"><span>${i + 1}.</span>${tl(i)}</div><div class="mriz">${d.pole.map(f => vstup(f, x[f[0]])).join('')}</div></div>`
    ).join('') : '<p class="napoveda">Zatím prázdné.</p>';
    oznacPocty();
    if (kol === 'links') { volbyQr(); volbyVizitek(); }
  }

  $('editor').addEventListener('click', async e => {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    if (b.dataset.pridat) {
      const kol = b.dataset.pridat;
      stav[kol].push(Object.assign({}, SEZNAMY[kol].nove));
      vykresliSeznam(kol); zmena();
      const pole = document.querySelectorAll(`[data-seznam="${kol}"] [data-i]:last-child .vstup`);
      if (pole[0]) pole[0].focus();
      return;
    }
    const pol = b.closest('[data-i]');
    if (!pol) return;
    const kol = b.closest('[data-seznam]').dataset.seznam, i = +pol.dataset.i, a = stav[kol];
    let fokus;
    if (b.dataset.posun) {
      const j = i + +b.dataset.posun;
      [a[i], a[j]] = [a[j], a[i]];
      fokus = [j, `[data-posun="${b.dataset.posun}"]`];
      if (kol === 'links') {
        const sw = x => x === i ? j : x === j ? i : x;
        stav.settings.qrLink = sw(stav.settings.qrLink); stav.card.web = sw(stav.card.web); stav.card.qrLink = sw(stav.card.qrLink);
      }
    } else if ('smaz' in b.dataset) {
      const plne = Object.values(a[i]).some(v => typeof v === 'string' && v.trim());
      if (plne && !await Dialog.potvrd('Odebrat tuto položku?', { ok: 'Odebrat' })) return;
      a.splice(i, 1);
      fokus = [Math.min(i, a.length - 1), '[data-smaz]'];
      if (kol === 'links') {
        if (stav.settings.qrLink > i) stav.settings.qrLink--;
        if (stav.card.qrLink > i) stav.card.qrLink--;
        stav.card.web = stav.card.web === i ? -1 : stav.card.web > i ? stav.card.web - 1 : stav.card.web;
      }
    } else return;
    vykresliSeznam(kol); zmena();
    // fokus zpět na stejné tlačítko (u krajní položky na sousední), jinak na „Přidat“
    const sez = document.querySelector(`[data-seznam="${kol}"]`), pol2 = sez.querySelector(`[data-i="${fokus[0]}"]`);
    const cil = pol2 && [...pol2.querySelectorAll(`${fokus[1]}, .pol-tl button`)].find(x => !x.disabled);
    (cil || document.querySelector(`[data-pridat="${kol}"]`)).focus();
  });

  // ---------- záložky, předvolby barev ----------

  function nastavDokument(d) {
    if (d === dokument) return;
    dokument = d; $('dokVolba').value = d; ui.dokument = d; ulozUi();
    vykresliNahled();
  }
  $('dokVolba').addEventListener('change', e => nastavDokument(e.target.value));
  $('kostraDopisu').addEventListener('click', async () => {
    if (stav.letter.body.trim() && !await Dialog.potvrd('Nahradit dosavadní text dopisu kostrou?', { ok: 'Nahradit' })) return;
    stav.letter.body = CVJ.kostraDopisu(stav);
    naplnFormular(); zmena();
    Dialog.info('Kostra vložena – místa se „…“ doplňte vlastními slovy.');
  });
  function prepniZalozku(z) {
    if (!['obsah', 'vzhled', 'rozlozeni', 'dopis', 'vizitky'].includes(z)) z = 'obsah';
    if (z === 'vizitky') nastavDokument('vizitky');
    if (z === 'vzhled') nahledQr();
    if (z === 'dopis') nastavDokument('dopis');
    else if (z !== 'vzhled' && z !== 'vizitky' && $('panel-' + z).hidden) nastavDokument('cv');
    document.querySelectorAll('[data-zalozka]').forEach(b => b.setAttribute('aria-selected', b.dataset.zalozka === z));
    document.querySelectorAll('.editor .panel').forEach(p => { p.hidden = p.id !== 'panel-' + z; });
    ui.zalozka = z; ulozUi();
  }
  document.querySelectorAll('[data-zalozka]').forEach(b => b.addEventListener('click', () => prepniZalozku(b.dataset.zalozka)));

  // výběr části panelu: tlačítko s aktuální částí + rozbalovací seznam + šipky ‹ ›
  // casti: [id, ikona, krátký název, celý název, seznamy pro počet položek]; karty panelu mají data-<atr>="id"
  function vyberCasti({ panel, atr, casti, tl, nab, popis, klic }) {
    const p = $(panel);
    p.insertAdjacentHTML('afterbegin', `<div class="pz-vyber">` +
      `<button type="button" class="tl pz-krok" data-krok="-1" title="Předchozí část" aria-label="Předchozí část">‹</button>` +
      `<button type="button" class="tl pz-tl" id="${tl}" data-nabidka="${nab}" aria-expanded="false" aria-haspopup="listbox" title="Vybrat část"></button>` +
      `<button type="button" class="tl pz-krok" data-krok="1" title="Další část" aria-label="Další část">›</button></div>`);
    document.body.insertAdjacentHTML('beforeend', `<div id="${nab}" class="nabidka" role="listbox" aria-label="${popis}" hidden>` +
      casti.map(([id, ik, , cely]) => `<button type="button" class="tl" role="option" data-cast-id="${id}" aria-selected="false">` +
        `<span class="pz-ik" aria-hidden="true">${ik}</span><span>${cely}</span><span class="pocet" hidden></span></button>`).join('') + '</div>');
    let aktivni = casti[0][0];
    const pocet = kol => kol ? kol.reduce((a, k) => a + stav[k].length, 0) : 0;
    function oznac() {
      for (const [id, , , , kol] of casti) {
        const n = pocet(kol), el = $(nab).querySelector(`[data-cast-id="${id}"] .pocet`);
        el.textContent = n; el.hidden = !n;
      }
      const [, ik, , cely, kol] = casti.find(x => x[0] === aktivni), n = pocet(kol);
      $(tl).innerHTML = `<span class="pz-ik" aria-hidden="true">${ik}</span><span class="pz-txt">${cely}</span>${n ? `<span class="pocet">${n}</span>` : ''}`;
    }
    function prepni(z) {
      if (!casti.some(x => x[0] === z)) z = casti[0][0];
      aktivni = z;
      $(nab).querySelectorAll('[data-cast-id]').forEach(b => b.setAttribute('aria-selected', b.dataset.castId === z));
      p.querySelectorAll(`.karta[data-${atr}]`).forEach(k => { k.hidden = k.dataset[atr] !== z; });
      const i = casti.findIndex(x => x[0] === z);
      p.querySelector('[data-krok="-1"]').disabled = i === 0;
      p.querySelector('[data-krok="1"]').disabled = i === casti.length - 1;
      oznac();
      ui[klic] = z; ulozUi();
    }
    $(nab).addEventListener('click', e => {
      const b = e.target.closest('[data-cast-id]');
      if (b) { zavriNabidky(); prepni(b.dataset.castId); p.scrollTop = 0; }
    });
    p.querySelectorAll('[data-krok]').forEach(b => b.addEventListener('click', () => {
      const c = casti[casti.findIndex(x => x[0] === aktivni) + +b.dataset.krok];
      if (c) { prepni(c[0]); p.scrollTop = 0; }
    }));
    return { prepni, oznac, aktivni: () => aktivni };
  }
  const OBSAH = vyberCasti({ panel: 'panel-obsah', atr: 'pz', tl: 'pzTlacitko', nab: 'nabSekce', popis: 'Části životopisu', klic: 'podzalozka', casti: [
    ['osobni', '👤', 'Osobní', 'Osobní údaje a odkazy'], ['profil', '🧑‍💼', 'Profil', 'Profil / o mně'],
    ['zkusenosti', '💼', 'Zkušenosti', 'Pracovní zkušenosti', ['experience']], ['vzdelani', '🎓', 'Vzdělání', 'Vzdělání', ['education']],
    ['dovednosti', '⚡', 'Dovednosti', 'Dovednosti a jazyky', ['skills', 'languages']],
    ['certifikaty', '📜', 'Certifikáty', 'Certifikáty a kurzy', ['certificates']], ['projekty', '🛠', 'Projekty', 'Projekty', ['projects']],
    ['reference', '🤝', 'Reference', 'Reference', ['references']], ['vlastni', '➕', 'Vlastní', 'Vlastní sekce'],
    ['souhlas', '✍️', 'Souhlas', 'Souhlas se zpracováním údajů']] });
  const VZHLED = vyberCasti({ panel: 'panel-vzhled', atr: 'vz', tl: 'vzTlacitko', nab: 'nabVzhled', popis: 'Části vzhledu', klic: 'vzhledCast', casti: [
    ['sablona', '🧩', 'Šablona', 'Šablona rozvržení'], ['barvy', '🎨', 'Barvy', 'Barevné téma'], ['papir', '📄', 'Papír', 'Pozadí papíru'],
    ['text', '🔤', 'Písmo', 'Písmo, fotka, jazyk a velikosti'], ['qr', '📱', 'QR', 'QR kód']] });
  const prepniPodzalozku = z => OBSAH.prepni(z), oznacPocty = () => OBSAH.oznac();

  // klik do náhledu otevře editaci dané sekce
  const SEKCE_ZALOZKA = { contact: 'osobni', links: 'osobni', interests: 'osobni', profile: 'profil', experience: 'zkusenosti',
    education: 'vzdelani', skills: 'dovednosti', languages: 'dovednosti', certificates: 'certifikaty', projects: 'projekty',
    references: 'reference', custom: 'vlastni' };
  $('cv').addEventListener('click', e => {
    e.preventDefault();   // odkazy v náhledu neotvírat
    const sek = e.target.closest('.cv-sekce'), m = sek && /\bs-(\w+)/.exec(sek.className);
    if (e.target.closest('.cv-vizitky')) { prepniZalozku('vizitky'); if ($('plocha').dataset.pohled === 'nahled' && innerWidth <= 1100) pohled('editor'); return; }
    if (e.target.closest('.cv-dopis')) { prepniZalozku('dopis'); if ($('plocha').dataset.pohled === 'nahled' && innerWidth <= 1100) pohled('editor'); return; }
    const z = m ? SEKCE_ZALOZKA[m[1]] : e.target.closest('.cv-gdpr') ? 'souhlas'
      : e.target.closest('.cv-hlava, .cv-jmeno, .cv-pozice, .cv-foto') ? 'osobni' : null;
    if (!z) return;
    prepniZalozku('obsah'); prepniPodzalozku(z); $('panel-obsah').scrollTop = 0;
    if ($('plocha').dataset.pohled === 'nahled' && innerWidth <= 1100) pohled('editor');
  });

  // šablony, barevná témata, papír
  $('sablony').innerHTML = Object.entries(CVJ.SABLONY).map(([id, x]) =>
    `<label><input type="radio" name="sablona" value="${id}" data-pole="settings.template"><span class="mini-list m-${id}"></span>${x.nazev}</label>`).join('');
  $('temata').innerHTML = CVJ.TEMATA.map(t => `<button type="button" data-tema="${t.id}" aria-pressed="false">` +
    `<span class="vzorek"><i style="background:${t.primary}"></i><i style="background:${t.accent}"></i><i style="background:${t.line}"></i></span>${esc(t.nazev)}</button>`).join('');
  $('temata').addEventListener('click', e => {
    const b = e.target.closest('[data-tema]');
    if (!b) return;
    const t = CVJ.TEMATA.find(x => x.id === b.dataset.tema);
    for (const k of ['primary', 'accent', 'text', 'muted', 'line']) stav.settings[k] = t[k];
    stav.settings.theme = t.id;
    naplnFormular(); zmena();
  });
  $('kostka').addEventListener('click', () => {
    const t = CVJ.nahodneTema(), k = document.querySelector('#kostka .kostka');
    for (const b of ['primary', 'accent', 'text', 'muted', 'line']) stav.settings[b] = t[b];
    stav.settings.theme = 'vlastni';
    k.classList.remove('toc'); void k.offsetWidth; k.classList.add('toc');
    $('kostkaInfo').textContent = `Schéma ${t.schema}: ${t.primary} + ${t.accent}. Nelíbí se? Hoďte znovu.`;
    naplnFormular(); zmena();
  });
  $('papiry').addEventListener('click', e => {
    const b = e.target.closest('[data-papir]');
    if (!b) return;
    stav.settings.paper = b.dataset.papir;
    document.querySelectorAll('#papiry [data-papir]').forEach(x => x.setAttribute('aria-pressed', x === b));
    zmena();
  });
  function oznacVolby() {
    document.querySelectorAll('#temata [data-tema]').forEach(b => b.setAttribute('aria-pressed', b.dataset.tema === stav.settings.theme));
    // vzorky papíru v barvách aktuálního tématu
    $('papiry').innerHTML = Object.entries(CVJ.PAPIRY).map(([id, nazev]) =>
      `<button type="button" data-papir="${id}" aria-pressed="${id === stav.settings.paper}">` +
      `<span class="papir-vz" style="background:${CVJ.papir(Object.assign({}, stav.settings, { paper: id })).css}"></span>${nazev}</button>`).join('');
  }

  // ---------- rozložení sekcí ----------

  function vykresliRozlozeni() {
    const L = stav.sectionLayout, P = { sidebar: 'Postranní panel', main: 'Hlavní sloupec', hidden: 'Skryté' };
    const nazev = id => CVJ.nadpisSekce(id, stav);
    const tl = (atr, znak, popis, vypnout) => `<button type="button" class="tl mini" ${atr} title="${popis}" aria-label="${popis}"${vypnout ? ' disabled' : ''}>${znak}</button>`;
    $('rozlozeni').innerHTML = Object.keys(P).map(k => `<div class="rozl-sl${k === 'hidden' ? ' skryte' : ''}"><h3>${P[k]}</h3>` +
      (L[k].map((id, i) => `<div class="rozl-pol" data-id="${id}" data-kde="${k}"><span>${esc(nazev(id))}</span>` +
        tl('data-rposun="-1"', '↑', 'Výš', i === 0) + tl('data-rposun="1"', '↓', 'Níž', i === L[k].length - 1) +
        (k !== 'sidebar' ? tl('data-rkam="sidebar"', '◀', 'Do postranního panelu') : '') +
        (k !== 'main' ? tl('data-rkam="main"', '▶', 'Do hlavního sloupce') : '') +
        (k !== 'hidden' ? tl('data-rkam="hidden"', '🙈', 'Skrýt') : '') + tl('data-rjmeno', '✎', 'Přejmenovat nadpis') + '</div>').join('') || '<p class="napoveda">—</p>') +
      '</div>').join('');
  }
  $('rozlozeni').addEventListener('click', async e => {
    const b = e.target.closest('button'), r = e.target.closest('.rozl-pol');
    if (!b || !r || b.disabled) return;
    const L = stav.sectionLayout, a = L[r.dataset.kde], i = a.indexOf(r.dataset.id);
    if ('rjmeno' in b.dataset) {
      const id = r.dataset.id, n = await Dialog.zeptej('Nadpis sekce (prázdné = výchozí)', CVJ.nadpisSekce(id, stav), { ok: 'Uložit' });
      if (n === null) return;
      if (id === 'custom') { stav.custom.heading = n.trim(); delete stav.headings.custom; naplnFormular(); }
      else if (n.trim() && n.trim() !== CVJ.JAZYKY[stav.settings.lang].sekce[id]) stav.headings[id] = n.trim();
      else delete stav.headings[id];
    } else if (b.dataset.rposun) {
      const j = i + +b.dataset.rposun;
      [a[i], a[j]] = [a[j], a[i]];
    } else {
      a.splice(i, 1);
      L[b.dataset.rkam].push(r.dataset.id);
    }
    const typ = ['rposun', 'rkam', 'rjmeno'].find(k => k in b.dataset), hodn = b.dataset[typ];
    vykresliRozlozeni(); zmena();
    const radek = document.querySelector(`#rozlozeni [data-id="${r.dataset.id}"]`), tl = [...radek.querySelectorAll('button')];
    (tl.find(x => !x.disabled && x.dataset[typ] === hodn) || tl.find(x => !x.disabled)).focus();
  });

  // ---------- náhled ----------

  const A4_SIRKA = 210 * 96 / 25.4;
  const sklonStrany = n => n === 1 ? 'strana' : n < 5 ? 'strany' : 'stran';
  function vykresliNahled() {
    const cv = $('cv');
    cv.innerHTML = list();
    const el = cv.firstElementChild;
    nahledSkryty = !el.offsetWidth;
    if (nahledSkryty) return;   // náhled je schovaný (úzký displej) – změří se po přepnutí nebo rozšíření okna
    // poměr výšky a šířky nezávisí na zvětšení náhledu
    const strany = Math.max(1, Math.ceil(el.offsetHeight / (el.offsetWidth * 297 / 210) - 0.01));
    for (let k = 1; k < strany; k++) {
      cv.insertAdjacentHTML('beforeend', `<div class="zlom" style="top:calc(${k} * 297mm)"><span>konec ${k}. strany (přibližně)</span></div>`);
    }
    const s = $('strany');
    const varuj = strany > 1 && dokument !== 'vizitky';   // u vizitek je 2. strana zadní strana
    s.textContent = (varuj ? '⚠ ' : '') + strany + ' ' + sklonStrany(strany) + ' A4';
    s.className = varuj ? 'upoz' : '';
    s.title = strany > 1 ? 'Obsah přetéká na další stranu – zkraťte text, zmenšete písmo nebo přesuňte sekce. U většiny pozic stačí 1–2 strany.' : '';
    vykresliKontrolu(strany);
    prizpusob();
  }
  function vykresliKontrolu(strany) {
    const v = dokument === 'dopis' ? CVJ.kontrolaDopisu(stav, strany) : dokument === 'vizitky' ? CVJ.kontrolaVizitek(stav, qrMatice)
      : CVJ.kontrola(stav, strany, qrMatice), chyb = v.filter(x => x.uroven === 'chyba').length, p = $('kontrolaPocet');
    p.textContent = v.length || '✓';
    p.className = 'pocet' + (chyb ? ' je-chyba' : v.length ? ' je-tip' : '');
    $('kontrolaTl').title = v.length ? `Kontrola: ${chyb} chyb, ${v.length - chyb} tipů` : 'Kontrola: vše v pořádku';
    $('nabKontrola').innerHTML = v.length ? v.map(x => `<button type="button" class="tl" data-cast="${x.cast}">` +
      `${x.uroven === 'chyba' ? '⛔' : '💡'} <span>${esc(x.text)}</span></button>`).join('')
      : '<div class="ok">✓ Nic k vytknutí. Ještě si text přečtěte nahlas – překlepy kontrola nenajde.</div>';
  }
  $('nabKontrola').addEventListener('click', e => {
    const b = e.target.closest('[data-cast]');
    if (!b) return;
    zavriNabidky();
    if (b.dataset.cast === 'vzhled') { prepniZalozku('vzhled'); VZHLED.prepni('qr'); $('panel-vzhled').scrollTop = 0; }
    else if (b.dataset.cast === 'dopis' || b.dataset.cast === 'vizitky') prepniZalozku(b.dataset.cast);
    else { prepniZalozku('obsah'); prepniPodzalozku(b.dataset.cast); $('panel-obsah').scrollTop = 0; }
    if (innerWidth <= 1100) pohled('editor');
  });
  function prizpusob() {
    const v = $('zoomVolba').value;
    const z = v === 'fit' ? Math.min(1.25, ($('papir').clientWidth - 32) / A4_SIRKA) : +v;
    $('zoom').style.zoom = Math.max(0.2, z || 1);
  }
  $('zoomVolba').addEventListener('change', () => { ui.zoom = $('zoomVolba').value; ulozUi(); prizpusob(); });
  let nahledSkryty = false;
  addEventListener('resize', () => {
    const skryty = !$('cv').offsetWidth;
    if (nahledSkryty && !skryty) vykresliNahled(); else prizpusob();
    nahledSkryty = skryty;
  });

  // ---------- fotka a ořez ----------

  function vykresliFoto() {
    $('fotoNahled').innerHTML = fotky.foto ? `<img src="${esc(fotky.foto)}" alt="Fotografie">` : '📷';
    $('fotoOrez').hidden = !fotky.original;
    $('fotoSmaz').hidden = !fotky.foto;
  }
  const nactiObrazek = src => new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = src; });
  function zmensi(img, max) {
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';   // průhledné PNG by v JPEG zčernalo
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.9);
  }

  $('fotoNahrat').onclick = () => $('fotoSoubor').click();
  $('fotoSoubor').onchange = async e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const url = URL.createObjectURL(f);
    try { await otevriOrez(zmensi(await nactiObrazek(url), 1600)); }
    catch (err) { Dialog.chyba('Obrázek se nepodařilo načíst.'); }
    finally { URL.revokeObjectURL(url); }
  };
  $('fotoOrez').onclick = () => otevriOrez(fotky.original);
  $('fotoSmaz').onclick = async () => {
    if (!await Dialog.potvrd('Odebrat fotografii z životopisu?', { ok: 'Odebrat' })) return;
    fotky = { foto: null, original: null };
    ulozFotky(); vykresliFoto(); zmena();
  };

  // posun x, y je ve zlomcích velikosti výřezu, z = přiblížení (1 = obraz právě pokryje kruh)
  const orez = { img: null, zdroj: null, z: 1, x: 0, y: 0, tah: null };
  function omezOrez() {
    const im = orez.img, m = Math.min(im.naturalWidth, im.naturalHeight);
    const sx = (im.naturalWidth / m * orez.z - 1) / 2, sy = (im.naturalHeight / m * orez.z - 1) / 2;
    orez.x = Math.max(-sx, Math.min(sx, orez.x));
    orez.y = Math.max(-sy, Math.min(sy, orez.y));
  }
  function kresliOrez(ctx, n) {
    const im = orez.img, m = Math.min(im.naturalWidth, im.naturalHeight);
    const w = im.naturalWidth / m * orez.z * n, h = im.naturalHeight / m * orez.z * n;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, n, n);
    ctx.drawImage(im, (n - w) / 2 + orez.x * n, (n - h) / 2 + orez.y * n, w, h);
  }
  const prekresliOrez = () => { omezOrez(); kresliOrez($('orezPlatno').getContext('2d'), 600); };
  function nastavZoomOrezu(z) {
    orez.z = Math.max(1, Math.min(4, z));
    $('orezZoom').value = Math.round(orez.z * 100);
    ukazHodnotu($('orezZoom'));
    prekresliOrez();
  }
  let fokusPredOrezem = null;
  async function otevriOrez(zdroj) {
    fokusPredOrezem = document.activeElement;
    orez.img = await nactiObrazek(zdroj);
    orez.zdroj = zdroj; orez.x = orez.y = 0;
    $('orezModal').classList.add('zobraz');
    nastavZoomOrezu(1);
    $('orezPouzit').focus();
  }
  const zavriOrez = () => {
    $('orezModal').classList.remove('zobraz'); orez.img = null;
    const zpet = fokusPredOrezem && document.contains(fokusPredOrezem) && !fokusPredOrezem.hidden ? fokusPredOrezem : $('fotoNahrat');
    zpet.focus();
  };
  $('orez').addEventListener('keydown', e => {
    const krok = e.shiftKey ? 0.08 : 0.02, posun = { ArrowLeft: [-krok, 0], ArrowRight: [krok, 0], ArrowUp: [0, -krok], ArrowDown: [0, krok] }[e.key];
    if (posun) { orez.x += posun[0]; orez.y += posun[1]; prekresliOrez(); }
    else if (e.key === '+' || e.key === '=') nastavZoomOrezu(orez.z * 1.1);
    else if (e.key === '-') nastavZoomOrezu(orez.z / 1.1);
    else return;
    e.preventDefault();
  });
  $('orezModal').addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const f = [...$('orezModal').querySelectorAll('button, input, [tabindex="0"]')];
    const i = f.indexOf(document.activeElement), j = (i + (e.shiftKey ? -1 : 1) + f.length) % f.length;
    e.preventDefault(); f[j].focus();
  });
  const plocha = $('orez');
  plocha.addEventListener('pointerdown', e => {
    orez.tah = { px: e.clientX, py: e.clientY, x: orez.x, y: orez.y };
    plocha.setPointerCapture(e.pointerId);
  });
  plocha.addEventListener('pointermove', e => {
    if (!orez.tah) return;
    orez.x = orez.tah.x + (e.clientX - orez.tah.px) / plocha.clientWidth;
    orez.y = orez.tah.y + (e.clientY - orez.tah.py) / plocha.clientHeight;
    prekresliOrez();
  });
  plocha.addEventListener('pointerup', () => { orez.tah = null; });
  plocha.addEventListener('pointercancel', () => { orez.tah = null; });
  plocha.addEventListener('wheel', e => { e.preventDefault(); nastavZoomOrezu(orez.z * (e.deltaY < 0 ? 1.1 : 1 / 1.1)); }, { passive: false });
  $('orezZoom').addEventListener('input', e => nastavZoomOrezu(e.target.value / 100));
  $('orezZrusit').onclick = zavriOrez;
  $('orezPouzit').onclick = () => {
    const c = document.createElement('canvas');
    c.width = c.height = 600;
    kresliOrez(c.getContext('2d'), 600);
    fotky = { foto: c.toDataURL('image/jpeg', 0.9), original: orez.zdroj };
    zavriOrez(); ulozFotky(); vykresliFoto(); zmena();
  };

  // ---------- soubory ----------

  function stahni(text, jmeno, typ) {
    const url = URL.createObjectURL(new Blob([text], { type: typ }));
    const a = document.createElement('a');
    a.href = url; a.download = jmeno;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function exportHtml() {
    const html = `<!DOCTYPE html>\n<html lang="${stav.settings.lang}">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n` +
      `<title>${esc(stav.name.trim() || 'Životopis')}</title>\n<style>${CVJ.CSS}\nbody{margin:0;background:#e5e7eb}\n.cv{margin:20px auto;box-shadow:0 4px 20px rgba(0,0,0,.2)}\n` +
      `${CVJ.CSS_TISK}\n@media print{html{background:${CVJ.pozadiTisku(stav, dokument)}}body{background:none}.cv{margin:0;box-shadow:none}}\n</style>\n</head>\n<body>\n${list()}\n</body>\n</html>\n`;
    stahni(html, jmenoDokumentu() + '.html', 'text/html');
  }
  $('importSoubor').onchange = async e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    let r;
    try { r = CVJ.zJSON(JSON.parse(await f.text())); }
    catch (err) { Dialog.chyba('Soubor se nepodařilo načíst: ' + err.message); return; }
    if (!await Dialog.potvrd(`Načíst životopis „${r.stav.name || f.name}“? Aktuální obsah se nahradí (uložené verze zůstanou).`, { ok: 'Načíst' })) return;
    stav = r.stav; fotky = r.fotky;
    ulozFotky(); naplnFormular(); zmena();
    Dialog.info('Životopis načten');
  };

  // ---------- verze ----------

  const nactiVerze = () => { try { return JSON.parse(localStorage.getItem(KLIC_VERZE)) || []; } catch (e) { return []; } };
  function ulozVerze(v) {
    try { localStorage.setItem(KLIC_VERZE, JSON.stringify(v)); return true; }
    catch (e) { Dialog.chyba('Verzi se nepodařilo uložit – úložiště prohlížeče je plné.'); return false; }
  }
  const kopie = s => JSON.parse(JSON.stringify(s));
  function vykresliVerze() {
    const v = nactiVerze();
    $('verzeSeznam').innerHTML = v.length ? v.map(x => `<div class="verze-r" data-id="${esc(x.id)}">` +
      `<button class="tl" data-v="nacti" title="Načíst tuto verzi">${esc(x.nazev)}<small>${new Date(x.ulozeno).toLocaleDateString('cs-CZ')}</small></button>` +
      `<button class="tl mini" data-v="prepis" title="Přepsat aktuálním obsahem" aria-label="Přepsat aktuálním obsahem">💾</button>` +
      `<button class="tl mini" data-v="jmeno" title="Přejmenovat" aria-label="Přejmenovat">✎</button>` +
      `<button class="tl mini" data-v="smaz" title="Smazat" aria-label="Smazat">🗑</button></div>`).join('')
      : '<p class="napoveda" style="padding:2px 10px 6px;max-width:260px">Zatím žádná. Uložte si třeba verzi pro každou pozici, na kterou se hlásíte.</p>';
  }
  async function ulozJakoVerzi() {
    const v = nactiVerze();
    const navrh = [stav.title.trim(), new Date().toLocaleDateString('cs-CZ')].filter(Boolean).join(' – ');
    const nazev = ((await Dialog.zeptej('Název verze', navrh, { ok: 'Uložit' })) || '').trim();
    if (!nazev) return;
    const stara = v.find(x => x.nazev === nazev);
    if (stara && !await Dialog.potvrd(`Verze „${nazev}“ už existuje. Přepsat ji?`, { ok: 'Přepsat' })) return;
    const zaznam = { id: stara ? stara.id : Date.now().toString(36), nazev, ulozeno: Date.now(), stav: kopie(stav) };
    if (ulozVerze(stara ? v.map(x => x === stara ? zaznam : x) : [zaznam, ...v])) Dialog.info('Verze „' + nazev + '“ uložena');
    vykresliVerze();
  }
  $('nabVerze').addEventListener('click', async e => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    e.stopPropagation();
    const v = nactiVerze(), x = v.find(z => z.id === b.closest('.verze-r').dataset.id);
    if (!x) return;
    zavriNabidky();
    if (b.dataset.v === 'nacti') {
      if (!await Dialog.potvrd(`Načíst verzi „${x.nazev}“? Aktuální obsah se nahradí.`, { ok: 'Načíst' })) return;
      stav = CVJ.normalizuj(kopie(x.stav));
      naplnFormular(); zmena();
    } else if (b.dataset.v === 'prepis') {
      if (!await Dialog.potvrd(`Přepsat verzi „${x.nazev}“ aktuálním obsahem?`, { ok: 'Přepsat' })) return;
      x.stav = kopie(stav); x.ulozeno = Date.now();
      if (ulozVerze(v)) Dialog.info('Verze přepsána');
    } else if (b.dataset.v === 'jmeno') {
      const n = ((await Dialog.zeptej('Nový název verze', x.nazev, { ok: 'Přejmenovat' })) || '').trim();
      if (!n || n === x.nazev) return;
      if (v.some(z => z.nazev === n)) { Dialog.chyba('Verze s tímto názvem už existuje.'); return; }
      x.nazev = n; ulozVerze(v);
    } else if (b.dataset.v === 'smaz') {
      if (!await Dialog.potvrd(`Smazat verzi „${x.nazev}“?`, { ok: 'Smazat' })) return;
      ulozVerze(v.filter(z => z !== x));
    }
    vykresliVerze();
  });

  // ---------- příkazy a nabídky lišty ----------

  function pohled(p) {
    $('plocha').dataset.pohled = p;
    document.querySelector('[data-prikaz="pohled-editor"]').setAttribute('aria-pressed', p === 'editor');
    document.querySelector('[data-prikaz="pohled-nahled"]').setAttribute('aria-pressed', p === 'nahled');
    if (p === 'nahled') vykresliNahled();
  }
  const PRIKAZY = {
    novy: async () => {
      if (!await Dialog.potvrd('Začít nový prázdný životopis? Aktuální obsah i fotka se smažou (uložené verze zůstanou).', { ok: 'Začít znovu' })) return;
      const s = CVJ.normalizuj({});
      s.settings = stav.settings; s.sectionLayout = stav.sectionLayout;
      stav = s; fotky = { foto: null, original: null };
      ulozFotky(); naplnFormular(); zmena();
    },
    ukazka: async () => {
      if (!await Dialog.potvrd('Načíst ukázkový životopis? Aktuální obsah se nahradí (fotka, vzhled a rozložení zůstanou).', { ok: 'Načíst' })) return;
      const s = CVJ.vychozi();
      s.settings = stav.settings; s.sectionLayout = stav.sectionLayout; s.headings = stav.headings;
      stav = s; naplnFormular(); zmena();
    },
    import: () => $('importSoubor').click(),
    expJson: () => stahni(JSON.stringify(CVJ.doJSON(stav, fotky), null, 2), CVJ.jmenoSouboru(stav) + '.json', 'application/json'),
    expHtml: exportHtml,
    tisk: () => { pripravTisk(); window.print(); },
    zpet: () => krokHistorie(-1),
    znovu: () => krokHistorie(1),
    kopieText: async () => {
      const t = dokument === 'dopis' ? CVJ.textDopisu(stav) : CVJ.text(stav);
      try { await navigator.clipboard.writeText(t); Dialog.info(dokument === 'dopis' ? 'Dopis zkopírován jako text – hodí se do e-mailu.' : 'Životopis zkopírován jako text – vložte ho do formuláře portálu.'); }
      catch (e) { stahni(t, jmenoDokumentu() + '.txt', 'text/plain;charset=utf-8'); Dialog.info('Schránka není dostupná – text se stáhl jako soubor.'); }
    },
    ulozVerzi: ulozJakoVerzi,
    'pohled-editor': () => pohled('editor'),
    'pohled-nahled': () => pohled('nahled')
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
    if (n.id === 'nabVerze') vykresliVerze();
    if (n.getAttribute('role') === 'listbox') n.style.minWidth = b.offsetWidth + 'px';
    n.hidden = false; b.setAttribute('aria-expanded', 'true');
    otvirac = b;
    const r = b.getBoundingClientRect();
    n.style.top = (r.bottom + 4) + 'px';
    n.style.left = Math.max(6, Math.min(r.left, innerWidth - n.offsetWidth - 6)) + 'px';
    const prvni = n.querySelector('[aria-selected="true"]') || n.querySelector('button:not(:disabled)');
    if (prvni && e.detail === 0) prvni.focus();   // otevřeno klávesou → fokus do nabídky
  }));
  let otvirac = null;
  document.addEventListener('keydown', e => {
    const n = e.target.closest && e.target.closest('.nabidka');
    if (!n || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    const t = [...n.querySelectorAll('button:not(:disabled)')], i = t.indexOf(e.target);
    const j = e.key === 'Home' ? 0 : e.key === 'End' ? t.length - 1 : (i + (e.key === 'ArrowDown' ? 1 : -1) + t.length) % t.length;
    e.preventDefault(); t[j].focus();
  });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-prikaz]');
    if (b && !b.disabled) { zavriNabidky(); PRIKAZY[b.dataset.prikaz](); return; }
    if (!e.target.closest('.nabidka')) zavriNabidky();
  });
  addEventListener('resize', zavriNabidky);
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if ($('orezModal').classList.contains('zobraz')) zavriOrez();
    const vNabidce = document.activeElement && document.activeElement.closest('.nabidka');
    zavriNabidky();
    if (vNabidce && otvirac) otvirac.focus();
  });

  // tisk: list bez zvětšení náhledu, PDF pojmenované podle jména
  let titulek = document.title;
  function pripravTisk() {
    $('tisk').innerHTML = list();
    $('tiskPozadi').textContent = `@media print{html{background:${CVJ.pozadiTisku(stav, dokument)} !important}}`;
    titulek = document.title;
    document.title = jmenoDokumentu();
  }
  addEventListener('beforeprint', pripravTisk);
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'p') { e.preventDefault(); PRIKAZY.tisk(); }
  });
  addEventListener('afterprint', () => { $('tisk').innerHTML = ''; $('tiskPozadi').textContent = ''; document.title = titulek; });

  // ---------- start ----------

  (async function start() {
    let prevzate = null, ulozene = null, stare = null;
    try { ulozene = localStorage.getItem(KLIC); stare = localStorage.getItem(STARY_KLIC); }
    catch (e) { Dialog.chyba('Prohlížeč nedovoluje ukládat data stránek – životopis se po zavření ztratí. Zálohujte ho přes Soubor → Export JSON.'); }
    try {
      if (ulozene) stav = CVJ.normalizuj(JSON.parse(ulozene));
      else if (stare) { prevzate = CVJ.zJSON(JSON.parse(stare)); stav = prevzate.stav; }
    } catch (e) {
      Dialog.chyba('Uložený životopis je poškozený, načtena ukázka.');
    }
    try {
      if (prevzate) {
        // převzetí dat ze staré verze stránky (klíč cvBuilderData, fotky v localStorage)
        fotky = prevzate.fotky;
        await Promise.all([DB.uloz('foto', fotky.foto), DB.uloz('original', fotky.original)]);
        uloz();
        if (!chybaUlozeni) localStorage.removeItem(STARY_KLIC);
      } else {
        fotky = { foto: await DB.nacti('foto') || null, original: await DB.nacti('original') || null };
      }
    } catch (e) {
      console.warn('IndexedDB nedostupná, fotka se neuloží:', e);
    }
    if (ui.zoom) $('zoomVolba').value = ui.zoom;
    if (['dopis', 'vizitky'].includes(ui.dokument)) { dokument = ui.dokument; $('dokVolba').value = dokument; }
    prepniZalozku(ui.zalozka || 'obsah');
    OBSAH.prepni(ui.podzalozka);
    VZHLED.prepni(ui.vzhledCast);
    naplnFormular();
    vykresliNahled();
    zaznamenej();
  })();
})();

/* ============================================================
   zalozky.js – záložky otevřených stránek v rozcestníku (index.html).

   Každá záložka má vlastní <iframe>: přepnutím se nic neztratí
   (rozehraná hra, rozdělaný výkres, hrající hudba). Aby paměť
   nerostla, drží se naživu jen pár naposledy použitých záložek;
   starší se „uspí“ (kolik a kdy, nastaví ⚙️ Nastavení) (iframe se zahodí, po kliknutí se stránka
   načte znovu – jako šetřič paměti v Chrome). Připnutá záložka
   a záložka, ve které hraje zvuk, se neuspí nikdy. Stránka, která
   hlásí neuložené změny (beforeunload), se neuspí a před zavřením
   se rozcestník zeptá.

   Skrytá záložka se stránce jeví jako skrytá karta prohlížeče:
   document.hidden = true + visibilitychange (hry se pauznou,
   editory uloží) a requestAnimationFrame stojí (3D a animace
   na pozadí nežerou procesor). Chromium jinak skrytý iframe
   nechává běžet naplno.

   Rozcestník volá:
     Zalozky.init({ lista, ramy, domovska, popis, platna, prejdi, zmena })
       lista   – prvek pro lištu záložek
       ramy    – prvek, do kterého se vkládají iframy
       popis(soubor) → { nazev, emoji, ikona } nebo null
       platna(soubor) → stránku jde otevřít (je v katalogu)
       prejdi(page, nahradit) – navigace rozcestníku (hash → otevri())
       zmena(page) – aktivní stránka sama přešla jinam (odkaz uvnitř)
     Zalozky.ukaz(page)        – otevřít / přepnout (volá otevri())
     Zalozky.posliVsem(zprava) – postMessage do všech živých stránek
     Zalozky.ulozenaAktivni()  – aktivní záložka z minulé návštěvy
   ============================================================ */
const Zalozky = (function () {
  'use strict';

  const KLIC = 'webapp_zalozky';
  /* Uspávání se nastavuje v ⚙️ Nastavení (obsah/nastaveni.html, stejné výchozí hodnoty):
     zivych = nepřipnuté stránky v paměti včetně aktivní, poMin = po kolika minutách
     skrytí se záložka uspí (0 = nikdy). Výchozí je úsporné: aktivní + jedna předchozí. */
  const KLIC_USPAVANI = 'webapp_zalozky_uspavani';
  const USPAVANI_VYCHOZI = { zivych: 2, poMin: 5 };
  function nactiUspavani() {
    let u = {};
    try { u = JSON.parse(localStorage.getItem(KLIC_USPAVANI)) || {}; } catch { /* výchozí */ }
    return {
      zivych: Number.isInteger(u.zivych) && u.zivych >= 1 && u.zivych <= 10 ? u.zivych : USPAVANI_VYCHOZI.zivych,
      poMin: typeof u.poMin === 'number' && u.poMin >= 0 ? u.poMin : USPAVANI_VYCHOZI.poMin,
    };
  }
  let uspavani = nactiUspavani();
  const MAX_ZALOZEK = 24;           // nad tolik se zavře nejdéle nepoužitá
  const MAX_ZAVRENYCH = 15;         // historie pro Alt+Shift+T
  const POVOLENI = 'fullscreen; autoplay; encrypted-media; picture-in-picture; camera; '
    + 'screen-wake-lock; local-fonts; clipboard-read; clipboard-write';

  const t = (s, p) => window.I18N ? I18N.t(s, p)
    : s.replace(/\{([\p{L}\p{N}_]+)\}/gu, (m, k) => (p && k in p ? p[k] : m));
  const zaklad = page => page.split('?')[0];
  const norm = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  let o = null;                // nastavení z init()
  let karty = [];              // { page, pin, domu, iframe, el, posledni, skrytoOd, nacita, zvuk, titulek }
  let aktivni = null;
  const zavrene = [];          // { page, pin, index }
  let pasEl, prehledBtn, pocetEl;
  let zameritRam = false;      // po kliknutí na záložku / zkratce dát fokus stránce

  // stejná stránka může být ve dvou záložkách (odkaz uvnitř stránky) – přednost má aktivní
  const najdi = page => (aktivni && zaklad(aktivni.page) === zaklad(page) ? aktivni
    : karty.find(k => zaklad(k.page) === zaklad(page)));

  /* ---------- trvalý stav ---------- */
  function cti() {
    try { return JSON.parse(localStorage.getItem(KLIC)) || {}; } catch { return {}; }
  }
  function uloz() {
    const data = {
      karty: karty.filter(k => !k.domu).map(k => {
        // sdílený odkaz s celým stavem v adrese by mohl být obří – stačí stránka
        const page = k.page.length > 1500 ? zaklad(k.page) : k.page;
        return k.pin ? { page, pin: true } : { page };
      }),
      aktivni: aktivni && !aktivni.domu ? zaklad(aktivni.page) : null,
    };
    try { localStorage.setItem(KLIC, JSON.stringify(data)); } catch { /* bez úložiště */ }
  }

  /* ---------- popisky ---------- */
  function popis(k) {
    if (k.domu) return { nazev: 'Hlavní stránka', emoji: '🏠', ikona: null };
    const p = o.popis(zaklad(k.page));
    if (p) return p;
    const soubor = zaklad(k.page).split('/').pop();
    return { nazev: k.titulek || soubor, emoji: '📄', ikona: null };
  }

  function titulekKarty(k) {
    const casti = [t(popis(k).nazev)];
    if (k.pin && !k.domu) casti.push(t('📌 připnutá – neuspí se'));
    if (!k.iframe && !k.domu) casti.push(t('💤 uspaná – po kliknutí se znovu načte'));
    if (k.zvuk) casti.push(t('🔊 hraje zvuk'));
    return casti.join('\n');
  }

  /* ---------- prvek záložky ---------- */
  function vytvorEl(k) {
    const el = document.createElement('div');
    el.className = 'zalozka';
    el.setAttribute('role', 'tab');
    el.tabIndex = -1;
    el.draggable = !k.domu;
    const ik = document.createElement('span');
    ik.className = 'z-ikona';
    const nazev = document.createElement('span');
    nazev.className = 'z-nazev';
    const zvuk = document.createElement('span');
    zvuk.className = 'z-zvuk';
    zvuk.textContent = '🔊';
    zvuk.setAttribute('aria-hidden', 'true');
    el.append(ik, nazev, zvuk);
    if (!k.domu) {
      const x = document.createElement('button');
      x.type = 'button';
      x.className = 'z-zavri';
      x.textContent = '✕';
      x.tabIndex = -1;
      x.title = t('Zavřít záložku (Alt+Shift+W)');
      x.setAttribute('aria-label', t('Zavřít záložku'));
      el.appendChild(x);
    }

    el.addEventListener('click', e => {
      if (e.target.closest('.z-zavri')) { zavri(k); return; }
      zameritRam = true;
      prejdiNa(k);
    });
    // prostřední tlačítko zavírá (mousedown jen kvůli automatickému posunu stránky)
    el.addEventListener('mousedown', e => { if (e.button === 1) e.preventDefault(); });
    el.addEventListener('auxclick', e => { if (e.button === 1) { e.preventDefault(); zavri(k); } });
    el.addEventListener('contextmenu', e => { e.preventDefault(); otevriNabidku(k, e.clientX, e.clientY); });
    el.addEventListener('keydown', e => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const i = karty.indexOf(k);
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); prejdiNa(k); }
      else if (e.key === 'Delete') { e.preventDefault(); zavri(k); }
      else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const n = karty[(i + (e.key === 'ArrowRight' ? 1 : -1) + karty.length) % karty.length];
        n.el.focus();
      } else if (e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        karty[e.key === 'Home' ? 0 : karty.length - 1].el.focus();
      } else if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
        e.preventDefault();
        const r = el.getBoundingClientRect();
        otevriNabidku(k, r.left, r.bottom);
      }
    });
    if (!k.domu) napojTazeni(k, el);
    k.el = el;
    vyplnPopis(k);
    return el;
  }

  function vyplnPopis(k) {
    const p = popis(k);
    const ik = k.el.querySelector('.z-ikona');
    ik.replaceChildren();
    if (p.ikona) {
      const img = document.createElement('img');
      img.src = p.ikona;
      img.alt = '';
      img.decoding = 'async';
      // chybějící ikona (nová stránka před přegenerováním balíku) → emoji
      img.addEventListener('error', () => { ik.textContent = p.emoji || '📄'; }, { once: true });
      ik.appendChild(img);
    } else {
      ik.textContent = p.emoji || '📄';
    }
    k.el.querySelector('.z-nazev').textContent = p.nazev;
  }

  function obnovKartu(k) {
    const el = k.el;
    el.classList.toggle('aktivni', k === aktivni);
    el.classList.toggle('pripnuta', !!k.pin || !!k.domu);
    el.classList.toggle('domu', !!k.domu);
    el.classList.toggle('uspana', !k.iframe && !k.domu);
    el.classList.toggle('nacita', !!k.nacita);
    el.classList.toggle('zvuk', !!k.zvuk);
    el.setAttribute('aria-selected', String(k === aktivni));
    el.tabIndex = k === aktivni ? 0 : -1;
    el.title = titulekKarty(k);
  }

  // pořadí: hlavní stránka, připnuté, ostatní (stabilně – v rámci skupiny beze změny)
  const skupina = k => (k.domu ? 0 : k.pin ? 1 : 2);
  function serad() {
    karty = karty.map((k, i) => [k, i]).sort((a, b) => skupina(a[0]) - skupina(b[0]) || a[1] - b[1]).map(x => x[0]);
  }

  function obnov() {
    serad();
    karty.forEach(k => {
      if (!k.el) vytvorEl(k);
      obnovKartu(k);
    });
    // přeskládat jen když nesedí pořadí (přesun prvku by zrušil animaci a hover)
    const ted = [...pasEl.children];
    if (ted.length !== karty.length || karty.some((k, i) => ted[i] !== k.el)) {
      pasEl.replaceChildren(...karty.map(k => k.el));
    }
    pocetEl.textContent = karty.length;
    prehledBtn.title = t('Přehled záložek a naposledy otevřených ({počet} otevřeno) – Alt+Shift+O', { 'počet': karty.length });
    if (prehled && !prehled.hidden) vykresliPrehled();
  }

  function ukazAktivni() {
    if (!aktivni) return;
    const el = aktivni.el, r = el.getBoundingClientRect(), p = pasEl.getBoundingClientRect();
    if (r.left < p.left) pasEl.scrollLeft -= p.left - r.left + 8;
    else if (r.right > p.right) pasEl.scrollLeft += r.right - p.right + 8;
  }

  /* ---------- iframe a jeho napojení ---------- */
  function vytvorRam(k, page) {
    const f = document.createElement('iframe');
    f.title = t('Aktivní aplikace');
    f.setAttribute('allow', POVOLENI);
    f.allowFullscreen = true;
    f.addEventListener('load', () => napoj(k, f));
    f.src = page;
    k.iframe = f;
    k.nacita = true;
    o.ramy.appendChild(f);
  }

  function odstranRam(k) {
    if (!k.iframe) return;
    k.iframe.remove();
    k.iframe = null;
    k.zvuk = false;
    k.nacita = false;
    k.skryto = false;
  }

  function relativni(href) {
    const koren = new URL('.', location.href).href;
    return href.startsWith(koren) ? href.slice(koren.length).split('#')[0] : null;
  }

  function napoj(k, f) {
    if (k.iframe !== f) return;
    k.nacita = false;
    let w;
    try { w = f.contentWindow; void w.document.title; } catch { obnovKartu(k); return; }
    w.addEventListener('keydown', klavesa, true);
    // klik do stránky zavře rozbalené nabídky lišty (události z iframu do rozcestníku nedojdou)
    w.addEventListener('pointerdown', zavriVyskakovaci, true);
    hlidejZvuk(w);
    k.titulek = w.document.title;
    k.skryto = false;   // nový dokument o skrytí neví
    if (k !== aktivni) nastavSkryti(k, true);
    // odkaz uvnitř stránky vedl jinam – záložka i adresa se přizpůsobí
    const rel = relativni(w.location.href);
    if (rel && rel !== k.page && o.platna(zaklad(rel))) {
      const jina = zaklad(rel) !== zaklad(k.page);
      k.page = rel;
      if (jina) vyplnPopis(k);
      if (k === aktivni) o.zmena(rel);
      uloz();
    } else if (!o.popis(zaklad(k.page))) {
      vyplnPopis(k);   // stránka mimo katalog – název z <title>
    }
    obnovKartu(k);
  }

  /* Skrytá záložka = skrytá karta prohlížeče. Vlastnosti se přepíšou
     přímo na dokumentu (prototyp zůstává), po zobrazení se smažou. */
  function nastavSkryti(k, skryto) {
    if (!k.iframe || !!k.skryto === skryto) return;
    k.skryto = skryto;
    try {
      const w = k.iframe.contentWindow, d = w.document;
      if (skryto) {
        Object.defineProperty(d, 'visibilityState', { configurable: true, get: () => 'hidden' });
        Object.defineProperty(d, 'hidden', { configurable: true, get: () => true });
        zastavSnimky(w);
      } else {
        delete d.visibilityState;
        delete d.hidden;
        pustSnimky(w);
      }
      d.dispatchEvent(new w.Event('visibilitychange'));
    } catch { /* stránka mimo náš původ – nechat být */ }
  }

  // requestAnimationFrame ve skryté záložce: zpětná volání se odloží a pustí po zobrazení
  function zastavSnimky(w) {
    if (w.__zalozkySnimky) return;
    const raf = w.requestAnimationFrame, caf = w.cancelAnimationFrame;
    const fronta = new Map();
    let id = 0;
    w.__zalozkySnimky = { raf, caf, fronta };
    w.requestAnimationFrame = cb => { fronta.set(--id, cb); return id; };   // záporná id = odložená
    w.cancelAnimationFrame = i => { if (!fronta.delete(i)) caf.call(w, i); };
  }
  function pustSnimky(w) {
    const s = w.__zalozkySnimky;
    if (!s) return;
    delete w.__zalozkySnimky;
    const preklad = new Map();
    s.fronta.forEach((cb, i) => preklad.set(i, s.raf.call(w, cb)));
    w.requestAnimationFrame = s.raf;
    // stránka si mohla nechat záporné id a zrušit ho až teď
    w.cancelAnimationFrame = i => s.caf.call(w, preklad.has(i) ? preklad.get(i) : i);
  }

  /* Zvuk: <audio>/<video> v dokumentu i mimo něj (new Audio() – Lamamp,
     Předčítač). Mimo DOM je najít nejde, proto se zachytí play(). */
  function hlidejZvuk(w) {
    try {
      const P = w.HTMLMediaElement.prototype;
      if (P.__zalozky) return;
      const play = P.play;
      const media = w.__zalozkyMedia = new Set();
      P.play = function () { media.add(this); return play.apply(this, arguments); };
      Object.defineProperty(P, '__zalozky', { value: true });
    } catch { /* bez médií */ }
  }
  function hrajeZvuk(k) {
    if (!k.iframe) return false;
    try {
      const w = k.iframe.contentWindow;
      const media = [...(w.__zalozkyMedia || []), ...w.document.querySelectorAll('audio, video')];
      return media.some(m => !m.paused && !m.ended && !m.muted && m.volume > 0);
    } catch { return false; }
  }

  /* Neuložené změny: stránka na beforeunload odpoví preventDefault()
     (SQLite, Heritage, Dělení videa…). Zároveň tím stránky, které
     na beforeunload ukládají, uloží svůj stav. */
  function neulozeno(k) {
    if (!k.iframe) return false;
    try {
      const w = k.iframe.contentWindow;
      const e = w.document.createEvent('BeforeUnloadEvent');
      e.initEvent('beforeunload', false, true);
      w.dispatchEvent(e);
      return e.defaultPrevented || !!e.returnValue;
    } catch { return false; }
  }

  /* ---------- přepínání ---------- */
  function ukaz(page) {
    let k = najdi(page);
    if (!k) k = pridej(page);
    if (k !== aktivni) {
      const stara = aktivni;
      aktivni = k;
      if (stara && karty.includes(stara)) skryj(stara);
    }
    k.posledni = Date.now();
    k.skrytoOd = 0;
    if (!k.iframe) vytvorRam(k, page);
    else if (k.page !== page) { k.nacita = true; k.iframe.src = page; }
    k.page = page;
    k.iframe.hidden = false;
    k.iframe.name = 'okno';
    nastavSkryti(k, false);
    if (zameritRam) { zameritRam = false; k.iframe.focus(); }
    uspiPrebytecne();
    obnov();
    ukazAktivni();
    uloz();
  }

  function skryj(k) {
    if (!k.iframe) return;
    k.iframe.hidden = true;
    k.iframe.removeAttribute('name');
    k.skrytoOd = Date.now();
    nastavSkryti(k, true);
  }

  function prejdiNa(k) {
    if (k === aktivni) { if (zameritRam) { zameritRam = false; k.iframe && k.iframe.focus(); } return; }
    o.prejdi(k.page, false);
  }

  function posun(smer) {
    const i = karty.indexOf(aktivni);
    zameritRam = true;
    prejdiNa(karty[(i + smer + karty.length) % karty.length]);
  }

  function pridej(page, index) {
    const k = { page, pin: false, posledni: Date.now() };
    if (index == null) karty.push(k);
    else karty.splice(Math.max(1, Math.min(index, karty.length)), 0, k);
    // příliš mnoho záložek → zavřít tu nejdéle nepoužitou (uspanou nebo bez neuložených změn)
    const bezne = karty.filter(x => !x.domu && !x.pin && x !== k);
    if (karty.length - 1 > MAX_ZALOZEK) {
      const obet = bezne.sort((a, b) => (a.posledni || 0) - (b.posledni || 0))
        .find(x => x !== aktivni && !x.zvuk && !neulozeno(x));
      if (obet) {
        odeber(obet);
        if (window.Dialog) Dialog.info(t('Zavřena nejdéle nepoužitá záložka „{název}“ – vrátí ji Alt+Shift+T.',
          { 'název': t(popis(obet).nazev) }));
      }
    }
    return k;
  }

  // drží v paměti jen uspavani.zivych naposledy použitých nepřipnutých stránek;
  // ty, které uspat nejde (zvuk, neuložené změny), ubírají z limitu jako první
  function uspiPrebytecne() {
    const zive = karty.filter(k => k.iframe && !k.pin && !k.domu && k !== aktivni)
      .sort((a, b) => (b.posledni || 0) - (a.posledni || 0));
    const nejde = zive.filter(k => hrajeZvuk(k) || neulozeno(k));
    let volno = uspavani.zivych - 1 - nejde.length;
    zive.filter(k => !nejde.includes(k)).forEach(k => {
      if (volno > 0) volno--;
      else uspi(k);
    });
  }

  function uspi(k) {
    if (!k.iframe || k === aktivni || k.domu) return false;
    if (hrajeZvuk(k) || neulozeno(k)) return false;
    odstranRam(k);
    k.skrytoOd = 0;
    obnovKartu(k);
    return true;
  }

  /* ---------- zavírání ---------- */
  function odeber(k) {
    const i = karty.indexOf(k);
    if (i < 0) return -1;
    zavrene.push({ page: k.page, pin: k.pin, index: i });
    if (zavrene.length > MAX_ZAVRENYCH) zavrene.shift();
    karty.splice(i, 1);
    odstranRam(k);
    k.el && k.el.remove();
    return i;
  }

  async function zavri(k, bezDotazu) {
    if (k.domu || !karty.includes(k)) return false;
    if (!bezDotazu && neulozeno(k)) {
      const ok = window.Dialog ? await Dialog.potvrd(
        t('Stránka „{název}“ má neuložené změny. Opravdu ji zavřít?', { 'název': t(popis(k).nazev) }),
        { ok: t('Zavřít'), zrus: t('Nechat otevřenou') }) : true;
      if (!ok || !karty.includes(k)) return false;
    }
    const byla = k === aktivni;
    const i = odeber(k);
    if (byla) {
      aktivni = null;
      // jako prohlížeč: soused vpravo, jinak vlevo
      const dalsi = karty[i] || karty[i - 1];
      zameritRam = true;
      o.prejdi(dalsi.page, true);
    }
    obnov();
    uloz();
    return true;
  }

  async function zavriVice(seznam) {
    for (const k of seznam) await zavri(k);
  }

  function znovuOtevri() {
    const z = zavrene.pop();
    if (!z) { if (window.Dialog) Dialog.info(t('Žádná zavřená záložka k obnovení.')); return; }
    if (!najdi(z.page)) {
      const k = pridej(z.page, z.index);
      k.pin = z.pin;
    }
    zameritRam = true;
    o.prejdi(z.page, false);
  }

  function pripni(k) {
    if (k.domu) return;
    k.pin = !k.pin;
    // připnutá jde na konec připnutých, odepnutá na začátek ostatních
    karty.splice(karty.indexOf(k), 1);
    const posledniPripnuta = karty.reduce((n, x, i) => (x.domu || x.pin ? i : n), 0);
    karty.splice(posledniPripnuta + 1, 0, k);
    obnov();
    uloz();
  }

  function nactiZnovu(k) {
    if (!k.iframe) { if (k !== aktivni) prejdiNa(k); return; }
    k.nacita = true;
    k.skryto = false;
    try { k.iframe.contentWindow.location.reload(); } catch { k.iframe.src = k.page; }
    obnovKartu(k);
  }

  /* ---------- přetahování ---------- */
  let tazena = null;
  function napojTazeni(k, el) {
    el.addEventListener('dragstart', e => {
      tazena = k;
      e.dataTransfer.effectAllowed = 'move';
      // přetažení mimo lištu (do adresního řádku) otevře stránku samostatně
      e.dataTransfer.setData('text/uri-list', new URL(k.page, location.href).href);
      e.dataTransfer.setData('text/plain', new URL(k.page, location.href).href);
      el.classList.add('tazena');
      zavriVyskakovaci();
    });
    el.addEventListener('dragend', () => {
      tazena = null;
      el.classList.remove('tazena');
      pasEl.querySelectorAll('.cil-pred, .cil-za').forEach(x => x.classList.remove('cil-pred', 'cil-za'));
    });
    el.addEventListener('dragover', e => {
      if (!tazena || tazena === k || skupina(tazena) !== skupina(k)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const r = el.getBoundingClientRect();
      const pred = e.clientX < r.left + r.width / 2;
      el.classList.toggle('cil-pred', pred);
      el.classList.toggle('cil-za', !pred);
    });
    el.addEventListener('dragleave', () => el.classList.remove('cil-pred', 'cil-za'));
    el.addEventListener('drop', e => {
      if (!tazena || tazena === k || skupina(tazena) !== skupina(k)) return;
      e.preventDefault();
      const pred = el.classList.contains('cil-pred');
      el.classList.remove('cil-pred', 'cil-za');
      karty.splice(karty.indexOf(tazena), 1);
      karty.splice(karty.indexOf(k) + (pred ? 0 : 1), 0, tazena);
      obnov();
      uloz();
    });
  }

  /* ---------- kontextová nabídka záložky ---------- */
  let nabidka = null;
  function otevriNabidku(k, x, y) {
    zavriVyskakovaci();
    const i = karty.indexOf(k);
    const polozky = [];
    const pridejPol = (text, akce, zkratka) => polozky.push({ text, akce, zkratka });
    if (!k.domu) pridejPol(k.pin ? '📌 Odepnout' : '📌 Připnout (neuspí se)', () => pripni(k), 'Alt+Shift+P');
    pridejPol('↻ Načíst znovu', () => nactiZnovu(k));
    if (k.iframe && k !== aktivni && !k.domu) pridejPol('💤 Uspat (uvolnit paměť)', () => {
      if (!uspi(k) && window.Dialog) Dialog.info(t('Stránku nejde uspat – hraje zvuk nebo má neuložené změny.'));
    });
    pridejPol('🗗 Otevřít v novém okně', () => window.open(k.page, '_blank'));
    polozky.push(null);
    if (!k.domu) pridejPol('✕ Zavřít', () => zavri(k), 'Alt+Shift+W');
    const ostatni = karty.filter(x => x !== k && !x.domu && !x.pin);
    if (ostatni.length) pridejPol('Zavřít ostatní', () => zavriVice(ostatni));
    const vpravo = karty.slice(i + 1).filter(x => !x.pin);
    if (vpravo.length) pridejPol('Zavřít záložky vpravo', () => zavriVice(vpravo));
    if (zavrene.length) pridejPol('↶ Znovu otevřít zavřenou', znovuOtevri, 'Alt+Shift+T');

    nabidka = document.createElement('div');
    nabidka.className = 'z-nabidka';
    nabidka.setAttribute('role', 'menu');
    polozky.forEach(p => {
      if (!p) { const hr = document.createElement('div'); hr.className = 'z-oddel'; nabidka.appendChild(hr); return; }
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'menuitem');
      const s = document.createElement('span');
      s.textContent = p.text;
      b.appendChild(s);
      if (p.zkratka) {
        const z = document.createElement('kbd');
        z.textContent = p.zkratka;
        z.dataset.i18n = 'ne';
        b.appendChild(z);
      }
      b.addEventListener('click', () => { zavriVyskakovaci(); p.akce(); });
      nabidka.appendChild(b);
    });
    nabidka.addEventListener('keydown', e => {
      const tl = [...nabidka.querySelectorAll('button')];
      const j = tl.indexOf(document.activeElement);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        tl[(j + (e.key === 'ArrowDown' ? 1 : -1) + tl.length) % tl.length].focus();
      } else if (e.key === 'Escape') { e.preventDefault(); zavriVyskakovaci(); k.el.focus(); }
    });
    document.body.appendChild(nabidka);
    const r = nabidka.getBoundingClientRect();
    nabidka.style.left = Math.max(4, Math.min(x, innerWidth - r.width - 4)) + 'px';
    nabidka.style.top = Math.max(4, Math.min(y, innerHeight - r.height - 4)) + 'px';
    nabidka.querySelector('button').focus();
  }

  /* ---------- přehled: otevřené, zavřené, naposledy otevřené ---------- */
  let prehled = null, prehledFiltr = null, prehledSeznam = null, vyber = 0;

  function vytvorPrehled() {
    prehled = document.createElement('div');
    prehled.className = 'z-prehled';
    prehled.hidden = true;
    prehled.setAttribute('role', 'dialog');
    prehled.setAttribute('aria-label', t('Přehled záložek'));
    prehledFiltr = document.createElement('input');
    prehledFiltr.type = 'search';
    prehledFiltr.className = 'z-filtr';
    prehledFiltr.placeholder = t('🔍 Hledat v záložkách a historii…');
    prehledFiltr.autocomplete = 'off';
    prehledSeznam = document.createElement('div');
    prehledSeznam.className = 'z-seznam';
    prehledSeznam.setAttribute('role', 'listbox');
    const pata = document.createElement('div');
    pata.className = 'z-pata';
    const uspat = document.createElement('button');
    uspat.type = 'button';
    uspat.textContent = t('💤 Uspat ostatní');
    uspat.title = t('Uvolnit paměť – skryté záložky se po kliknutí znovu načtou (kromě připnutých a hrajících)');
    uspat.addEventListener('click', () => {
      const n = karty.filter(k => k !== aktivni && !k.pin && uspi(k)).length;
      if (window.Dialog) Dialog.info(t('Uspáno záložek: {počet}', { 'počet': n }));
      vykresliPrehled();
    });
    const zkratky = document.createElement('span');
    zkratky.className = 'z-zkratky';
    zkratky.textContent = t('Alt+Shift+← → přepnout · W zavřít · T vrátit · P připnout · 1–9 skok');
    const nast = document.createElement('button');
    nast.type = 'button';
    nast.textContent = t('⚙️ Uspávání…');
    nast.title = t('Kolik stránek držet v paměti a kdy uspávat skryté záložky');
    nast.addEventListener('click', () => { zavriVyskakovaci(); zameritRam = true; o.prejdi('obsah/nastaveni.html', false); });
    pata.append(uspat, nast, zkratky);
    prehled.append(prehledFiltr, prehledSeznam, pata);
    o.lista.appendChild(prehled);

    prehledFiltr.addEventListener('input', () => { vyber = 0; vykresliPrehled(); });
    prehledFiltr.addEventListener('keydown', e => {
      const radky = [...prehledSeznam.querySelectorAll('.z-radek')];
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!radky.length) return;
        vyber = (vyber + (e.key === 'ArrowDown' ? 1 : -1) + radky.length) % radky.length;
        oznacVyber();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        radky[vyber] && radky[vyber].click();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        zavriVyskakovaci();
      }
    });
  }

  function oznacVyber() {
    const radky = [...prehledSeznam.querySelectorAll('.z-radek')];
    radky.forEach((r, i) => r.setAttribute('aria-selected', String(i === vyber)));
    if (radky[vyber]) radky[vyber].scrollIntoView({ block: 'nearest' });
  }

  function vykresliPrehled() {
    const q = norm(prehledFiltr.value.trim());
    const sedi = nazev => !q || norm(nazev).includes(q) || norm(t(nazev)).includes(q);
    prehledSeznam.replaceChildren();

    const radek = (k, page, stavy, akce, zavrit) => {
      const p = k ? popis(k) : (o.popis(zaklad(page)) || { nazev: zaklad(page), emoji: '📄' });
      if (!sedi(p.nazev)) return;
      const r = document.createElement('div');
      r.className = 'z-radek' + (k && k === aktivni ? ' aktivni' : '');
      r.setAttribute('role', 'option');
      const ik = document.createElement('span');
      ik.className = 'z-ikona';
      if (p.ikona) { const img = document.createElement('img'); img.src = p.ikona; img.alt = ''; ik.appendChild(img); }
      else ik.textContent = p.emoji || '📄';
      const n = document.createElement('span');
      n.className = 'z-nazev';
      n.textContent = p.nazev;
      const st = document.createElement('span');
      st.className = 'z-stavy';
      st.textContent = stavy;
      r.append(ik, n, st);
      if (zavrit) {
        const x = document.createElement('button');
        x.type = 'button';
        x.className = 'z-zavri';
        x.textContent = '✕';
        x.title = t('Zavřít záložku');
        x.addEventListener('click', async e => {
          e.stopPropagation();
          await zavrit();
          vykresliPrehled();
          prehledFiltr.focus();
        });
        r.appendChild(x);
      }
      r.addEventListener('click', () => { zavriVyskakovaci(); akce(); });
      r.addEventListener('mousemove', () => {
        const i = [...prehledSeznam.querySelectorAll('.z-radek')].indexOf(r);
        if (i !== vyber) { vyber = i; oznacVyber(); }
      });
      prehledSeznam.appendChild(r);
      return r;
    };
    const nadpis = text => {
      const h = document.createElement('div');
      h.className = 'z-nadpis';
      h.textContent = text;
      prehledSeznam.appendChild(h);
    };

    nadpis(t('Otevřené záložky'));
    karty.forEach(k => {
      const stavy = (k.pin && !k.domu ? '📌' : '') + (!k.iframe && !k.domu ? '💤' : '') + (k.zvuk ? '🔊' : '');
      radek(k, k.page, stavy, () => { zameritRam = true; prejdiNa(k); }, k.domu ? null : () => zavri(k));
    });

    const videno = new Set(karty.map(k => zaklad(k.page)));
    const zavreneNove = [...zavrene].reverse().filter(z => !videno.has(zaklad(z.page)) && o.platna(zaklad(z.page)));
    zavreneNove.forEach(z => videno.add(zaklad(z.page)));
    if (zavreneNove.length) {
      nadpis(t('Nedávno zavřené'));
      zavreneNove.forEach(z => radek(null, z.page, '', () => {
        const i = zavrene.lastIndexOf(z);
        if (i >= 0) zavrene.splice(i, 1);
        if (!najdi(z.page)) pridej(z.page, z.index).pin = z.pin;
        zameritRam = true;
        o.prejdi(z.page, false);
      }));
    }

    let nedavne = [];
    try { nedavne = JSON.parse(localStorage.getItem('webapp_nedavne')) || []; } catch { /* nic */ }
    nedavne = nedavne.filter(s => typeof s === 'string' && !videno.has(s) && o.platna(s)).slice(0, q ? 24 : 10);
    if (nedavne.length) {
      nadpis(t('🕘 Naposledy otevřené'));
      nedavne.forEach(s => radek(null, s, '', () => { zameritRam = true; o.prejdi(s, false); }));
    }

    // prázdné skupiny (filtr nic nenašel) – nadpis bez řádků pryč
    [...prehledSeznam.querySelectorAll('.z-nadpis')].forEach(h => {
      if (!h.nextElementSibling || h.nextElementSibling.classList.contains('z-nadpis')) h.remove();
    });
    if (!prehledSeznam.children.length) {
      const nic = document.createElement('div');
      nic.className = 'z-nic';
      nic.textContent = t('Nic nenalezeno.');
      prehledSeznam.appendChild(nic);
    }
    const pocet = prehledSeznam.querySelectorAll('.z-radek').length;
    if (vyber >= pocet) vyber = Math.max(0, pocet - 1);
    oznacVyber();
  }

  function otevriPrehled() {
    if (prehled && !prehled.hidden) { zavriVyskakovaci(); return; }
    zavriVyskakovaci();
    prehled.hidden = false;
    prehledBtn.setAttribute('aria-expanded', 'true');
    prehledFiltr.value = '';
    vyber = Math.max(0, karty.indexOf(aktivni));
    vykresliPrehled();
    prehledFiltr.focus();
  }

  function zavriVyskakovaci() {
    if (nabidka) { nabidka.remove(); nabidka = null; }
    if (prehled && !prehled.hidden) {
      prehled.hidden = true;
      prehledBtn.setAttribute('aria-expanded', 'false');
    }
  }

  /* ---------- klávesové zkratky (v rozcestníku i uvnitř stránek) ---------- */
  function klavesa(e) {
    if (!e.altKey || !e.shiftKey || e.ctrlKey || e.metaKey) return;
    const kod = e.code;
    if (kod === 'ArrowRight' || kod === 'ArrowLeft') posun(kod === 'ArrowRight' ? 1 : -1);
    else if (kod === 'KeyW') { if (aktivni && !aktivni.domu) zavri(aktivni); }
    else if (kod === 'KeyT') znovuOtevri();
    else if (kod === 'KeyP') { if (aktivni && !aktivni.domu) pripni(aktivni); }
    else if (kod === 'KeyO') otevriPrehled();
    else if (/^Digit[1-9]$/.test(kod)) {
      const n = +kod.slice(5);
      const k = n === 9 ? karty[karty.length - 1] : karty[n - 1];
      if (k) { zameritRam = true; prejdiNa(k); }
    } else return;
    e.preventDefault();
    e.stopPropagation();
  }

  /* ---------- start ---------- */
  function init(nastaveni) {
    o = nastaveni;
    const lista = o.lista;
    lista.classList.add('zalozky');
    pasEl = document.createElement('div');
    pasEl.className = 'z-pas';
    pasEl.setAttribute('role', 'tablist');
    pasEl.setAttribute('aria-label', t('Otevřené stránky'));
    prehledBtn = document.createElement('button');
    prehledBtn.type = 'button';
    prehledBtn.className = 'z-prehled-btn';
    prehledBtn.setAttribute('aria-haspopup', 'dialog');
    prehledBtn.setAttribute('aria-expanded', 'false');
    pocetEl = document.createElement('span');
    pocetEl.className = 'z-pocet';
    pocetEl.dataset.i18n = 'ne';
    const sipka = document.createElement('span');
    sipka.textContent = '▾';
    sipka.setAttribute('aria-hidden', 'true');
    prehledBtn.append(pocetEl, sipka);
    prehledBtn.addEventListener('click', otevriPrehled);
    lista.append(pasEl, prehledBtn);
    vytvorPrehled();

    // kolečko myši posouvá lištu do stran
    pasEl.addEventListener('wheel', e => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && pasEl.scrollWidth > pasEl.clientWidth) {
        e.preventDefault();
        pasEl.scrollLeft += e.deltaY;
      }
    }, { passive: false });

    karty.push({ page: o.domovska, domu: true, posledni: 0 });
    const ulozene = cti();
    (Array.isArray(ulozene.karty) ? ulozene.karty : []).forEach(z => {
      if (z && typeof z.page === 'string' && o.platna(zaklad(z.page)) && !najdi(z.page)) {
        karty.push({ page: z.page, pin: !!z.pin, posledni: 0 });
      }
    });
    obnov();

    document.addEventListener('keydown', klavesa, true);
    document.addEventListener('pointerdown', e => {
      if (nabidka && !nabidka.contains(e.target)) zavriVyskakovaci();
      if (prehled && !prehled.hidden && !prehled.contains(e.target) && !prehledBtn.contains(e.target)) zavriVyskakovaci();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && (nabidka || !prehled.hidden)) zavriVyskakovaci(); });
    window.addEventListener('resize', () => { zavriVyskakovaci(); ukazAktivni(); });
    // změna v ⚙️ Nastavení (jiný dokument → událost storage) platí hned
    window.addEventListener('storage', e => {
      if (e.key !== KLIC_USPAVANI) return;
      uspavani = nactiUspavani();
      uspiPrebytecne();
    });

    // hlídání zvuku a uspávání dlouho skrytých záložek
    setInterval(() => {
      const ted = Date.now();
      karty.forEach(k => {
        const z = hrajeZvuk(k);
        if (z !== !!k.zvuk) { k.zvuk = z; obnovKartu(k); }
        if (k.iframe && k !== aktivni && !k.pin && !k.domu && !z && k.skrytoOd && uspavani.poMin > 0
          && ted - k.skrytoOd > uspavani.poMin * 60e3) uspi(k);
      });
    }, 3000);
  }

  function ulozenaAktivni() {
    const a = cti().aktivni;
    return typeof a === 'string' && o.platna(a) ? a : null;
  }

  function posliVsem(zprava) {
    karty.forEach(k => { if (k.iframe) k.iframe.contentWindow?.postMessage(zprava, '*'); });
  }

  // pro testy: stav záložek bez sahání do DOM
  function stav() {
    return karty.map(k => ({
      page: k.page, pin: !!k.pin, domu: !!k.domu, aktivni: k === aktivni,
      zivy: !!k.iframe, zvuk: !!k.zvuk, skryto: !!k.skryto, uspavani,
    }));
  }

  return { init, ukaz, posliVsem, ulozenaAktivni, stav };
})();
window.Zalozky = Zalozky;

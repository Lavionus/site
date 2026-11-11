/* French cleat – ovládání stránky: formulář, historie, manifold, přepočet, výsledky, pevnost, kontroly, výkres, export.
   3D náhled je společný se spojkami (spojky/nahled.js); model se do náhledu otočí o 180° kolem svislé osy,
   aby zeď byla vzadu a díl mířil ke kameře. */
/* global CLEAT, CLEAT_GEOM, CLEAT_VYKRES, CLEAT_STENA, SPOJKY_NAHLED, KRAB, Dialog, Tvary, TrubkyGui */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const U = CLEAT, fmt = U.fmt;
  const KLIC = 'webapp_cleat_projekt';

  /* ---------- stav a historie ---------- */
  let p, wasm = null, model = null, chybaStavby = null;
  const zpet = [], znovu = [];
  function hlasPrevod(hl, co) { if (hl && hl.length) setTimeout(() => Dialog.info(`${co} upraven: ${hl.join('; ')}.`), 300); }
  function nactiUlozeny() {
    try {
      const t = localStorage.getItem(KLIC);
      if (t) { const r = U.normalizuj(JSON.parse(t)); hlasPrevod(r.hlaseni, 'Uložený projekt'); return r.p; }
    } catch (e) { /* poškozený záznam */ }
    return U.zPredvolby(0);
  }
  function uloz() { try { localStorage.setItem(KLIC, JSON.stringify(p)); } catch (e) { /* plné úložiště */ } }
  function zmen(fn, slouceni) {
    const pred = JSON.stringify(p);
    fn(p);
    p = U.normalizuj(p).p;
    if (JSON.stringify(p) === pred) return;
    const posl = zpet[zpet.length - 1];
    if (!(slouceni && posl && posl.klic === slouceni && Date.now() - posl.cas < 1200)) zpet.push({ stav: pred, klic: slouceni, cas: Date.now() });
    else posl.cas = Date.now();
    if (zpet.length > 100) zpet.shift();
    znovu.length = 0;
    po();
  }
  function krokHistorie(z, do_) {
    if (!z.length) return;
    do_.push({ stav: JSON.stringify(p), cas: 0 });
    p = U.normalizuj(JSON.parse(z.pop().stav)).p;
    naplnFormular(); po();
  }
  function po() {
    $('btnZpet').disabled = !zpet.length; $('btnZnovu').disabled = !znovu.length;
    uloz(); viditelnost(); naplanuj();
  }
  function nahrad(q) { zmen(x => { Object.keys(x).forEach(k => delete x[k]); Object.assign(x, q); }); naplnFormular(); }

  /* ---------- formulář ---------- */
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const opt = (sel, obj, f = (k, v) => v) => { $(sel).innerHTML = Object.entries(obj).map(([k, v]) => `<option value="${k}">${esc(f(k, v))}</option>`).join(''); };
  const vruty = sel => { $(sel).innerHTML = Object.keys(U.VRUTY).sort((a, b) => a - b).map(k => { const v = U.VRUTY[k]; return `<option value="${k}">${fmt(v.d)} mm (otvor ${fmt(v.otvor)}, hlava ${fmt(v.hlava)})</option>`; }).join(''); };
  opt('f_vzp', U.VZPERY); opt('f_osa', U.OSY_KLIPU); opt('f_kdnot', U.DNA);
  opt('f_dotv', U.OTVORY_DESKY); opt('f_dspoj', U.SPOJE_DESKY); opt('f_dsroub', U.SROUBY, (k, v) => `${k} (otvor ${fmt(v.otvor)})`);
  opt('f_lspoj', U.SPOJE_LISTY); opt('f_sdr', U.DRUHY_LISTY); opt('f_opera', U.OPERY);
  opt('f_hrany', U.HRANY); opt('f_odl', U.ODLEHCENI); opt('f_koltv', U.KOLEJNICE);
  opt('f_mat', U.MATERIALY, (k, v) => `${v.nazev} – ${fmt(v.hustota, 2)} g/cm³`);
  vruty('f_dvrut'); vruty('f_lvrut');
  $('f_sys').innerHTML = '<option value="">— vlastní rozměry —</option>' + Object.entries(U.SYSTEMY).map(([k, v]) => `<option value="${k}">${esc(v.nazev)}</option>`).join('');
  $('segTypy').innerHTML = Object.entries(U.TYPY).map(([k, v]) => `<button type="button" data-typ-volba="${k}" title="${esc(v.popis)}"><span class="zn" aria-hidden="true">${v.znak}</span>${esc(v.nazev)}</button>`).join('');
  // přepínače tvarů (tlačítka místo rozbalovacích seznamů)
  const SEGMENTY = { segHak: ['hak.tvar', U.TVARY_HAKU], segSvorka: ['svorka.tvar', U.TVARY_SVORKY], segStojan: ['stojan.druh', U.DRUHY_OTVORU], segKapsa: ['kapsa.tvar', U.TVARY_KAPSY],
    segZubyHak: ['hak.vZuby', U.ZUBY], segZubySvorka: ['svorka.zuby', U.ZUBY], segListaDruh: ['lista.druh', U.DRUHY_LISTY_DILU], segZkouska: ['zkouska.druh', U.ZKOUSKY] };
  for (const [id, [cesta, tab]] of Object.entries(SEGMENTY)) {
    $(id).innerHTML = Object.entries(tab).map(([k, v]) => `<button type="button" data-seg="${cesta}" data-hodnota="${k}" title="${esc(v)}">${esc(v.split(' (')[0].split(' – ')[0])}</button>`).join('');
  }
  /** Obrázek stěn V-drážky (stejný princip jako vDrazka v geometrii, zvětšený). */
  function ikonaZubu(styl) {
    const S = { pilove: [5, 1.4, 'h'], jemne: [3.2, 0.9, 'h'], zebra: [4.4, 1.2, 'z'], vlny: [5, 1.2, 'v'] }[styl];
    const lev = [[2, 2], [9, 2]], st = z => 9 + (z - 2) * (6 / 34);   // levá stěna: x od 9 nahoře k 15 dole
    if (S) for (let z = 5; z + S[0] < 34; z += S[0]) {
      const z2 = z + S[0] * (S[2] === 'h' ? 0.67 : 1);
      if (S[2] === 'h') lev.push([st(z), z], [st(z2) + S[1], z2], [st(z2), z2]);
      else if (S[2] === 'z') lev.push([st(z), z], [st((z + z2) / 2) + S[1], (z + z2) / 2], [st(z2), z2]);
      else for (let j = 0; j <= 6; j++) { const t = j / 6, zz = z + (z2 - z) * t; lev.push([st(zz) + S[1] * Math.sin(Math.PI * t), zz]); }
    }
    lev.push([15, 36]);
    const body = lev.concat(lev.slice().reverse().map(([x, z]) => [30 - x, z]));
    return `<svg viewBox="0 0 30 40" aria-hidden="true"><path class="z-dil" d="M0 0H30V40H0Z"/><path class="z-v" d="M${body.map(([x, z]) => `${x.toFixed(2)} ${z.toFixed(2)}`).join('L')}Z"/></svg>`;
  }
  for (const id of ['segZubyHak', 'segZubySvorka']) $(id).querySelectorAll('button').forEach(b => b.insertAdjacentHTML('afterbegin', ikonaZubu(b.dataset.hodnota)));
  document.querySelectorAll('[data-seg]').forEach(b => b.addEventListener('click', () => { zmen(x => U.poloz(x, b.dataset.seg, b.dataset.hodnota)); naplnFormular(); }));
  document.querySelectorAll('[data-zamek-volba]').forEach(b => b.addEventListener('click', () => {
    zmen(x => {
      // výchozí tloušťka pásu u zámku „kopie“ je menší než blok nad lištou
      const pas = v => v === 'kopie' || v === 'zaves';
      if (pas(b.dataset.zamekVolba) && !pas(x.zada.zamek) && x.zada.nad > 8) x.zada.nad = Math.max(5, Math.round(x.zada.nad / 2));
      if (b.dataset.zamekVolba === 'plochy' && pas(x.zada.zamek) && x.zada.nad < 10) x.zada.nad = 12;
      x.zada.zamek = b.dataset.zamekVolba;
    });
    naplnFormular();
  }));
  // rychlé sady vrtáků
  const rada = (a, b, k) => Array.from({ length: Math.round((b - a) / k) + 1 }, (_, i) => fmt(a + i * k)).join('; ');
  const SADY_VRTAKU = [
    ['1–10 po 0,5', '1; 1,5; 2; 2,5; 3; 3,5; 4; 4,5; 5; 5,5; 6; 6,5; 7; 7,5; 8; 8,5; 9; 9,5; 10'],
    ['1–13 po 0,5', rada(1, 13, 0.5)],
    ['1–6 po 0,1… jemné', '1; 1,2; 1,5; 1,8; 2; 2,2; 2,5; 2,8; 3; 3,2; 3,5; 3,8; 4; 4,5; 5; 5,5; 6'],
    ['pod závity M3–M12', '2,5; 3,3; 4,2; 5; 6,8; 8,5; 10,2'],
    ['do dřeva 3–10', '3; 4; 5; 6; 7; 8; 10'],
    ['do zdi 5–12', '5; 6; 8; 10; 12'],
  ];
  $('rychleVrtaky').innerHTML = SADY_VRTAKU.map(([n], i) => `<button type="button" data-sada="${i}">${esc(n)}</button>`).join('');
  $('rychleVrtaky').addEventListener('click', e => {
    const b = e.target.closest('[data-sada]'); if (!b) return;
    zmen(x => { x.stojan.vrtaky = SADY_VRTAKU[+b.dataset.sada][1]; }); naplnFormular();
  });

  const pole = [...document.querySelectorAll('[data-p]')];
  function naplnFormular() {
    for (const el of pole) {
      const h = U.vezmi(p, el.dataset.p);
      if (el.type === 'checkbox') el.checked = !!h;
      // přepsat i pole s kurzorem – formulář se plní jen při změně celého projektu (zpět, předvolba, 🎲, výběr), ne při psaní
      else el.value = el.dataset.typ === 'text' ? (h ?? '') : String(h).replace('.', ',');
      el.classList.remove('spatne');
    }
    const s = p.system, shoda = Object.entries(U.SYSTEMY).find(([, v]) => ['tl', 'vyska', 'uhel'].every(c => v.s[c] === s[c]));
    $('f_sys').value = shoda ? shoda[0] : '';
    viditelnost();
  }
  for (const el of pole) {
    const akce = () => {
      const c = el.dataset.p;
      let h;
      if (el.type === 'checkbox') h = el.checked;
      else if (el.dataset.typ === 'text') h = el.value;
      else {
        h = U.cislo(el.value, NaN);
        el.classList.toggle('spatne', !Number.isFinite(h));
        if (!Number.isFinite(h)) return;
      }
      zmen(x => U.poloz(x, c, h), c);
      if (el.tagName === 'SELECT') naplnFormular();
    };
    el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', akce);
    if (el.tagName === 'INPUT' && el.type === 'text' && el.dataset.typ !== 'text') {
      el.addEventListener('change', () => {
        const psano = U.cislo(el.value, NaN), h = U.vezmi(p, el.dataset.p), roz = U.ROZSAHY[el.dataset.p];
        el.value = String(h).replace('.', ',');
        if (roz && Number.isFinite(psano) && Math.abs(psano - h) > 1e-9) {
          el.classList.remove('zvyrazni'); void el.offsetWidth; el.classList.add('zvyrazni');
          Dialog.info(`${el.labels[0] ? el.labels[0].textContent.trim() : 'Hodnota'}: omezeno na ${fmt(roz[0], 2)}–${fmt(roz[1], 2)}, použito ${fmt(h, 2)}.`);
        }
      });
      // ↑/↓ ± 1, Shift × 10, Alt po 0,1
      el.addEventListener('keydown', e => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        const h = U.cislo(el.value, NaN); if (!Number.isFinite(h)) return;
        e.preventDefault();
        const krok = (e.shiftKey ? 10 : e.altKey ? 0.1 : 1) * (e.key === 'ArrowUp' ? 1 : -1);
        el.value = fmt(Math.round((h + krok) * 1000) / 1000, 3);
        el.dispatchEvent(new Event('input'));
      });
    }
  }
  $('f_sys').addEventListener('change', e => { if (e.target.value) { zmen(x => U.nastavSystem(x, e.target.value)); naplnFormular(); } });
  const VYCH_NAZVY = { hak: 'Hák na French cleat', svorka: 'Klip na French cleat', zkouska: 'Zkušební zámky French cleat', police: 'Police na French cleat', stojan: 'Stojánek na nářadí', kapsa: 'Kapsa na French cleat', deska: 'Montážní deska na French cleat', lista: 'Lišta French cleat' };
  document.querySelectorAll('[data-typ-volba]').forEach(b => b.addEventListener('click', () => {
    zmen(x => {
      x.typ = b.dataset.typVolba;
      // výchozí název podle typu, vlastní název nechat
      if (!x.nazev || Object.values(VYCH_NAZVY).includes(x.nazev) || U.PREDVOLBY.some(v => v.nazev === x.nazev)) x.nazev = VYCH_NAZVY[x.typ];
    });
    naplnFormular();
  }));

  /** Ukáže jen pole, která pro zvolený typ a volby dávají smysl (prvek je vidět, když platí všechny jeho podmínky). */
  const PODMINKY = {
    pro: v => v.split(' ').includes(p.typ),
    tvar: v => v.split(' ').includes(p.hak.tvar),
    stvar: v => v === p.svorka.tvar,
    osa: v => v === p.svorka.osa,
    druh: v => v.split(' ').includes(p.stojan.druh),
    ktvar: v => v === p.kapsa.tvar,
    dno: v => v.split(' ').includes(p.kapsa.dnoTyp),
    vzpera: () => p.police.vzpera !== 'zadna',
    hvzpera: () => p.hak.vzpera,
    hvdrazka: () => p.hak.vDrazka,
    bocnice: () => p.stojan.bocnice,
    popisky: () => p.stojan.popisky,
    patka: () => p.zada.opera === 'zed',
    pruvlaky: () => p.deska.pruvlaky > 0,
    dspoj: () => p.deska.otvory === 'zezadu',
    dvrut: () => p.deska.otvory === 'zepredu' || (p.deska.otvory === 'zezadu' && p.deska.spoj === 'vrut'),
    dsroub: () => p.deska.otvory === 'matice' || (p.deska.otvory === 'zezadu' && p.deska.spoj === 'sroub'),
    rybina: () => p.lista.spoj === 'rybina',
    pevnost: () => U.jeDrzak(p),
    drzak: () => U.jeDrzak(p),
    zamek: v => v.split(' ').includes(p.zada.zamek),
    ldruh: v => v === p.lista.druh,
    zdruh: v => v === p.zkouska.druh,
    kolejnice: () => p.deska.kolejnice > 0,
    magnety: () => p.deska.magnety > 0,
    zub: () => p.zada.zub,
    zarezy: () => p.lista.zarezy > 0,
    odlehceni: () => p.zada.odlehceni !== 'zadne',
  };
  const SELEKTOR = Object.keys(PODMINKY).map(k => `[data-${k}]`).join(',');
  function viditelnost() {
    for (const el of document.querySelectorAll(SELEKTOR)) {
      el.hidden = !Object.entries(PODMINKY).every(([k, f]) => !(k in el.dataset) || f(el.dataset[k]));
    }
    document.querySelectorAll('[data-typ-volba]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.typVolba === p.typ)));
    document.querySelectorAll('[data-seg]').forEach(b => b.setAttribute('aria-pressed', String(U.vezmi(p, b.dataset.seg) === b.dataset.hodnota)));
    document.querySelectorAll('[data-zamek-volba]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.zamekVolba === p.zada.zamek)));
    $('pRozmery').textContent = {
      hak: 'Šířka = šířka zad i háku (víc užších háků nastavíte v oddílu Víc háků). Výška zad určuje, jak nízko se záda opírají o lištu.',
      svorka: 'Šířka zad; svislé klipy si záda podle potřeby rozšíří.',
      police: 'Šířka = šířka police. Police je nahoře u zámku, vzpěra sahá ke spodku zad.',
      stojan: 'Šířka = šířka stojánku. Deska s otvory je u spodku zad.',
      kapsa: 'Šířka = šířka kapsy (kelímky si záda podle potřeby rozšíří). Dno kapsy lícuje se spodkem zad.',
      deska: 'Šířka a výška montážní desky; otvory jsou jen pod spodkem zámku.',
      lista: '', zkouska: '',
    }[p.typ];
    $('lSraz').textContent = p.zada.hrany === 'oble' ? 'Zaoblení boků' : 'Sražení boků';
    $('pLista').textContent = {
      dil: '',
      koncovka: 'Krytka se nasune na konec lišty (dřevěné i tištěné) – zakryje řez a vruty držáků nesjedou z konce. Tiskne se čelem dolů.',
      podlozka: 'Distanční podložka pod lištu: vytvoří mezeru za lištou pro zámek „závěs přes lištu“. Otvor pro vrut lišty je uprostřed.',
    }[p.lista.druh];
    $('pZkouska').textContent = p.zkouska.druh === 'merka'
      ? 'Měrka: destička s výřezem přesně podle nastaveného profilu lišty (+0,2 mm). Přiložte ji k dřevěné liště – když sedne, rozměry v pravém boxu odpovídají.'
      : 'Malé vzorky zámku vedle sebe, každý s jinou vůlí a s vyrytou hodnotou. Vytiskněte, nasaďte na svou lištu a vůli, která sedí nejlépe, zadejte v pravém boxu. Tvar zámku se bere z pravého boxu.';
    $('lNad').textContent = p.zada.zamek === 'plochy' ? 'Zámek nad lištou' : 'Tloušťka pásu';
    $('lStl').textContent = p.stojan.druh === 'vrtaky' ? 'Výška přední řady' : 'Tloušťka desky';
    $('pSvorka').textContent = p.svorka.tvar === 'klip'
      ? (p.svorka.osa === 'svisle' ? 'Svislá tyč (koště, násada, trubka) se zepředu nacvakne do kroužku. Tiskne se nastojato – nejlépe z PETG nebo PA, které pruží.'
        : 'Vodorovná tyč podél zdi (ručníky, role) – tiskněte dva klipy. Profil se tiskne na boku.')
      : 'Roh hadru nebo rukavice se zatlačí do zužující se drážky a zasekne se. Pilové a jemné zuby brání vytažení nahoru, žebra a vlnky drží látku v obou směrech, hladká drážka se nejsnáz čistí. Otvor na konci drážky zakončí ostré dno.';
    $('pStojan').textContent = {
      kruh: 'Deska je u spodku zad – stojánek se tiskne nastojato, otvory jsou svislé. Šroubovák projde dříkem, rukojeť dosedne na desku; změřte dřík a přidejte 1–2 mm.',
      sestihran: 'Bity ¼″: šestihran 6,6 mm na plochy, slepý otvor 8–10 mm.',
      drazka: 'Drážky otevřené zepředu – kleště, nůžky, klíče. Hrdlo užší než drážka = zacvaknutí (hřeben na kabely), náběh = snazší zasunutí (vidlice na násadu).',
      vrtaky: 'Vrtáky od nejmenšího, rozdělené do schodů – zadní řada je výš, takže jsou všechny vidět. Popisky Ø se vyryjí před otvory (čtou se zepředu).',
    }[p.stojan.druh];
    $('lDosah').textContent = p.hak.tvar === 'kolik' ? 'Délka kolíku' : 'Dosah od zad';
    $('lSprum').textContent = p.stojan.druh === 'sestihran' ? 'Šestihran (na plochy)' : 'Průměr otvoru';
    $('lKg').textContent = U.kusu(p) > 1 ? (p.typ === 'hak' ? 'Zátěž na 1 hák' : 'Zátěž na 1 klip') : 'Zátěž';
    $('pHak').textContent = {
      J: 'Hák J: rameno od zad, ohyb a špička nahoru. Velký poloměr ohybu = široké sedlo, na kterém se hadice ani kabel nezlomí; malý dosah a nulový poloměr = jazýček na sponu.',
      dvojity: 'Dva háky J nad sebou na jedněch zádech – dlouhý dole, krátký nahoře (nastavení v oddílu Druhý hák).',
      kolik: 'Kolík míří šikmo nahoru, aby věc nesklouzla; kulička na konci ji ještě zarazí.',
      kolebka: 'Kolébka: lůžko otevřené nahoru pro tyč – dvě kolébky ponesou tyč s rolí pásky, papíru nebo drátu.',
      role: 'Tyč na roli: rameno z jedné strany zad, na něm vodorovná tyč podél zdi se zarážkou na konci. Role (utěrky, fólie, pásky) se nasune z volné strany. Délka tyče = šířka zad.',
    }[p.hak.tvar];
  }

  /* ---------- manifold ---------- */
  function nactiSkript(src) {
    return new Promise((ok, ko) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => ko(new Error('nenačteno ' + src)); document.head.appendChild(s); });
  }
  async function nactiManifold() {
    globalThis.MANIFOLD_URL = new URL('lib/manifold/manifold.klasicky.js', location.href).href;
    if (!globalThis.ManifoldModule) await nactiSkript('lib/manifold/manifold.klasicky.js');
    let volby;
    if (location.protocol === 'file:') {
      await nactiSkript('lib/manifold/manifold.wasm.js');
      const s = atob(globalThis.MANIFOLD_WASM_B64), bin = new Uint8Array(s.length);
      for (let i = 0; i < s.length; i++) bin[i] = s.charCodeAt(i);
      delete globalThis.MANIFOLD_WASM_B64;
      volby = { wasmBinary: bin };
    } else volby = { locateFile: f => new URL('lib/manifold/' + f, location.href).href };
    const w = await globalThis.ManifoldModule(volby);
    w.setup();
    return w;
  }

  /* ---------- přepočet ---------- */
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const nahled = SPOJKY_NAHLED.vytvorNahled($('platno'));
  $('platno').querySelector('canvas').setAttribute('aria-label', '3D náhled držáku – tažením otáčíte, kolečkem přibližujete, pravým tlačítkem posouváte');
  /** otočení o 180° kolem svislé osy (x → −x, y → −y): zeď vzadu */
  const otoc = poz => { const q = new Float32Array(poz); for (let i = 0; i < q.length; i += 3) { q[i] = -q[i]; q[i + 1] = -q[i + 1]; } return q; };
  const otocDucha = d => (d.typ === 'box' ? { typ: 'box', min: [-d.max[0], -d.max[1], d.min[2]], max: [-d.min[0], -d.min[1], d.max[2]] } : Object.assign({}, d, { poz: otoc(d.poz) }));
  let casovac = null, pevnostVysl = null, pismo = null, pismoNacitam = null;
  /** písmo pro vyryté popisky (opentype.js + Liberation Sans Bold, OFL) – načte se, až je potřeba */
  const chcePismo = q => (q.typ === 'stojan' && q.stojan.druh === 'vrtaky' && q.stojan.popisky) || q.typ === 'zkouska';
  function potrebujePismo(q = p) {
    if (pismo || !chcePismo(q)) return Promise.resolve();
    if (pismoNacitam) return pismoNacitam;
    return (pismoNacitam = (async () => {
      try {
        if (!window.opentype) await nactiSkript('lib/opentype.min.js');
        let buf = null;
        try { const r = await fetch('fonty/LiberationSans-Bold.ttf'); if (r.ok) buf = await r.arrayBuffer(); } catch (e) { buf = null; }
        if (!buf) {
          await nactiSkript('fonty/js/LiberationSans-Bold.ttf.js');
          const b = atob(window.FONTY_JS['LiberationSans-Bold.ttf']), u = new Uint8Array(b.length);
          for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
          buf = u.buffer;
        }
        pismo = window.opentype.parse(buf);
        naplanuj();
      } catch (e) { pismoNacitam = null; }
    })());
  }
  function naplanuj() { clearTimeout(casovac); casovac = setTimeout(prepocitej, 40); }
  function prepocitej() {
    nahled.barvy(css('--border-strong'), css('--border'), css('--text'));
    const o = U.odvozene(p);
    let H = U.kontroly(p, o);
    model = null; chybaStavby = null; pevnostVysl = U.pevnost(p, o, 'x');
    const st = $('stav3d');
    if (!wasm) { vypis(H, o); return; }
    try {
      const t0 = performance.now();
      potrebujePismo();
      const sit = CLEAT_GEOM.postav(wasm, p, o, pismo);
      const rozbor = U.rozborTisku(sit, p, o);
      const tisk = U.tiskovaPoloha(sit, rozbor.vybrana.R);
      tisk.tridy = U.previsy(tisk.poz, sit.idx, p.tisk.previs, Math.max(1, o.sraz + 0.1)).tridy;
      model = Object.assign(sit, { o, rozbor, tisk, ks: KRAB.kontrolaSite(tisk.poz, sit.idx), cas: performance.now() - t0, klic: p.typ });
      pevnostVysl = U.pevnost(p, o, U.osaNahoru(rozbor.vybrana.klic));
      model.barvy = U.jeDrzak(p) && pevnostVysl.prurezy.length ? barvyNapeti(sit.poz, sit.idx, U.mapaPevnosti(p, o, pevnostVysl)) : null;
      H = H.concat(U.kontrolyTisku(p, o, rozbor, sit.plocha), U.kontrolyPevnosti(p, pevnostVysl));
      if (!model.ks.uzavrena) H.push({ uroven: 'chyba', text: 'Síť není uzavřená – export by nemusel jít vytisknout.', pole: [] });
      if (chcePismo(p) && !pismo) H.push({ uroven: 'info', text: 'Načítám písmo pro vyryté popisky…', pole: [] });
      if (sit.pojistkaBlokovana) H.push({ uroven: 'varovani', text: 'K pojistnému vrutu se šroubovák zepředu nedostane – stojí mu v cestě hák, police nebo kapsa. Pojistku vypněte, nebo použijte úhlový šroubovák.', pole: ['zada.pojistka'] });
      if (sit.dilu > 1 && !sit.vzorky) H.push({ uroven: 'varovani', text: `Díl se rozpadl na ${sit.dilu} kusy – zkontrolujte rozměry.`, pole: [] });
    } catch (e) {
      chybaStavby = 'Těleso nejde sestavit: ' + (e && e.message || e);
      H.push({ uroven: 'chyba', text: chybaStavby, pole: [] });
    }
    st.textContent = chybaStavby || ''; st.classList.toggle('chyba', !!chybaStavby);
    nahled.nastav(model && { poz: otoc(model.poz), idx: model.idx, duchove: model.duchove.map(otocDucha), tisk: model.tisk, klic: model.klic, barvy: model.barvy });
    obnovKoty();
    vypis(H, o);
    obnovZalozky();
  }

  /* ---------- výpisy ---------- */
  const dl = (popis, cislo, dalsi = '', tr = '') => `<div class="dlazdice"><div class="popis">${popis}</div><div class="cislo ${tr}">${cislo}</div>${dalsi ? `<div class="dalsi">${dalsi}</div>` : ''}</div>`;
  const tridaK = k => (k >= U.BEZPECNOST ? 'ok-t' : k >= 1.5 ? 'mez-t' : 'chyba-t');
  const kg = x => (Number.isFinite(x) ? `${fmt(x, x < 10 ? 1 : 0)} kg` : '–');
  function vypis(H, o) {
    const m = model, pv = pevnostVysl;
    let v = '';
    const podpory = m && U.potrebujePodpory(m.rozbor.vybrana, m.plocha);
    if (m) {
      const b = m.ks.bbox, odh = U.odhadTisku(m.objem, m.plocha, b[5] - b[2], p), mat = U.MATERIALY[p.tisk.material];
      v += dl('Rozměry (tisk)', `${fmt(b[3] - b[0])} × ${fmt(b[4] - b[1])} × ${fmt(b[5] - b[2])} mm`, 'šířka × hloubka × výška tisku');
      v += dl('Hmotnost', `≈ ${fmt(odh.gramy, 1)} g`, `${mat.nazev}, výplň ${fmt(p.tisk.vypln, 0)} %, ${fmt(odh.metru, 2)} m filamentu 1,75`);
      v += dl('Doba tisku', `≈ ${odh.minut < 90 ? fmt(odh.minut, 0) + ' min' : fmt(odh.minut / 60, 1) + ' h'}`, `1 kus, hrubý odhad (vrstva 0,2 mm)${p.tisk.kusu > 1 ? `; ${p.tisk.kusu} ks ≈ ${fmt(odh.minut * p.tisk.kusu / 60, 1)} h` : ''}`);
      v += dl('Orientace tisku', m.rozbor.vybrana.nazev, podpory ? `${fmt(m.rozbor.vybrana.volne, 0)} mm² převisů – s podporami` : 'bez podpor', podpory ? 'mez-t' : 'ok-t');
    } else v = dl('Model', wasm ? 'nesestaven' : 'načítám…', chybaStavby || '');
    if (U.jeDrzak(p) && pv.prurezy.length) v += dl('Doporučená zátěž', kg(pv.nosnost), `${U.kusu(p) > 1 ? 'na jeden kus, ' : ''}rezerva ${U.BEZPECNOST}× · nejslabší místo: ${pv.prurezy.reduce((a, c) => (c.k < a.k ? c : a)).nazev.toLowerCase()}`, tridaK(pv.kMin));
    if (p.typ === 'zkouska') v += p.zkouska.druh === 'merka' ? dl('Měrka', `${fmt(o.T)} × ${fmt(o.H)} mm, ${fmt(o.al)}°`, 'výřez = profil lišty + 0,2 mm')
      : dl('Vzorky', `${o.zkouska.vzorky.length} ×`, `vůle ${o.zkouska.vule.map(c => fmt(c, 2)).join(' · ')} mm`);
    else if (p.typ === 'lista' && p.lista.druh === 'dil') v += dl('Vruty', `${o.lista.xs.length} × ${fmt(o.lista.d.v.d)} mm`, `po ${fmt(p.lista.roztec)} mm, ${fmt(o.lista.zs, 1)} mm nad spodkem`);
    else if (U.jeDrzak(p)) v += dl('Zámek', `${fmt(p.zada.nad)} mm nad lištou`, `lišta ${fmt(o.T)} × ${fmt(o.H)}, úkos ${fmt(o.al)}°, vůle ${fmt(o.c, 2)} mm`);
    if (p.typ === 'hak' && p.hak.tvar === 'kolebka') v += dl('Lůžko', `Ø ${fmt(2 * o.hak.rr, 1)} mm`, `tyč Ø ${fmt(p.hak.prumerTyce)} + vůle`);
    if (p.typ === 'stojan') v += dl('Otvory', `${o.stojan.otvory.length} ×`, `rozteč ${fmt(o.stojan.krok, 1)} mm, deska ${fmt(o.stojan.D)} × ${fmt(o.stojan.tp)} mm`);
    $('vVysledky').innerHTML = v;
    $('sVysledky').textContent = m ? `${fmt(U.odhadTisku(m.objem, m.plocha, m.ks.bbox[5] - m.ks.bbox[2], p).gramy, 0)} g` : '';
    // pevnost
    if (U.jeDrzak(p) && pv.prurezy.length) {
      $('vSily').innerHTML = dl('Zátěž', `${fmt(pv.F, 0)} N`, `${fmt(p.zatez.kg * U.kusu(p, o), 1)} kg, těžiště ${fmt(pv.e)} mm před zády`)
        + dl('Síla na úkos lišty', `${fmt(pv.N, 0)} N`, 'zámek tlačí šikmo dolů a ke zdi')
        + dl('Tlak dole', `${fmt(pv.R, 0)} N`, `${p.zada.opera === 'zed' ? 'patka o zeď' : 'záda o líc lišty'}, páka ${fmt(pv.a)} mm`)
        + dl('Doporučeno do', kg(pv.nosnost), `materiál ${pv.mat.mez} MPa, rezerva ${U.BEZPECNOST}×`, tridaK(pv.kMin));
      $('tabPevnost').innerHTML = '<tr><th>Místo</th><th>Průřez</th><th class="c">Napětí</th><th class="c">Mez</th><th class="c">Bezpečnost</th></tr>'
        + pv.prurezy.map(x => `<tr><td>${esc(x.nazev)}</td><td>${esc(x.pozn)}${x.napric ? ' · <b>napříč vrstvami</b>' : ''}</td><td class="c">${fmt(x.sigma, 1)} MPa</td><td class="c">${fmt(x.mez, 0)} MPa</td>`
          + `<td class="c ${tridaK(x.k)}">${fmt(x.k, 1)}×${x.vzper ? ` / vzpěr ${fmt(x.vzper.k, 1)}×` : ''}</td></tr>`).join('');
      $('sPevnost').textContent = `do ${kg(pv.nosnost)}`;
    } else {
      $('vSily').innerHTML = p.typ === 'zkouska' ? dl('Zkouška', '–', 'vzorky a měrky nic nenesou') : p.typ === 'lista' ? dl('Lišta', 'nese přes vruty', 'únosnost určují vruty a hmoždinky ve zdi') : dl('Zátěž', '0 kg', 'zadejte zátěž');
      $('tabPevnost').innerHTML = ''; $('sPevnost').textContent = '';
    }
    // tisk
    const sel = $('f_orient'), r = m && m.rozbor;
    sel.innerHTML = '<option value="auto">automaticky – nejlepší</option>' + (r ? r.kandidati.map(k => `<option value="${k.klic}">${esc(k.nazev)}</option>`).join('') : '');
    sel.value = r && r.kandidati.some(k => k.klic === p.tisk.orientace) ? p.tisk.orientace : 'auto';
    $('tabOrientace').innerHTML = r ? '<tr><th>Poloha</th><th class="c">Bez opory</th><th class="c">Mosty</th><th class="c">Podložka</th><th class="c">Výška</th></tr>'
      + r.kandidati.map(k => `<tr class="klik${k === r.vybrana ? ' vybrana' : ''}" data-klic="${k.klic}" tabindex="0"><td>${k === r.nejlepsi ? '★ ' : ''}${esc(k.nazev)}</td><td class="c">${fmt(k.volne, 0)} mm²</td><td class="c">${fmt(k.most, 0)} mm²</td><td class="c">${fmt(k.podlozka, 0)} mm²</td><td class="c">${fmt(k.vyska)} mm</td></tr>`).join('') : '';
    $('sTisk').textContent = m ? (podpory ? 's podporami' : 'bez podpor') : '';
    $('pMaterial').textContent = U.MATERIALY[p.tisk.material].pozn;
    // kusovník
    const kus = U.kusovnik(p, o);
    $('tabKusovnik').innerHTML = kus.length ? '<tr><th class="c">Ks</th><th>Položka</th><th>Poznámka</th></tr>'
      + kus.map(x => `<tr><td class="c">${x.ks == null ? '' : x.ks}</td><td>${esc(x.co)}</td><td>${esc(x.pozn || '')}</td></tr>`).join('')
      : '<tr><td>Bez spojovacího materiálu – držák se jen zavěsí na lištu.</td></tr>';
    $('vSit').innerHTML = m ? dl('Síť', m.ks.uzavrena ? '✔ uzavřená' : '✖ otevřená', `${m.ks.trojuhelniku} trojúhelníků, ${m.ks.hranOkrajovych} okrajových hran, rod ${m.rod}, ${fmt(m.cas, 0)} ms`, m.ks.uzavrena ? 'ok-t' : 'chyba-t') : '';
    $('karta3d').innerHTML = m ? `<div class="titul">${esc(U.TYPY[p.typ].nazev)}</div><b>${esc(U.popis(p))}</b><br>`
      + `<b>${fmt(U.odhadTisku(m.objem, m.plocha, m.ks.bbox[5] - m.ks.bbox[2], p).gramy, 1)}</b> g ${U.MATERIALY[p.tisk.material].nazev} · ${podpory ? '<b>s podporami</b>' : 'bez podpor'}`
      + (U.jeDrzak(p) && Number.isFinite(pv.nosnost) ? `<br>unese ≈ <b>${kg(pv.nosnost)}</b>` : '') : '';
    legendy();
    // štítek nosnosti v liště
    const chip = $('chipNosnost');
    chip.hidden = !(U.jeDrzak(p) && pv.prurezy.length && Number.isFinite(pv.nosnost));
    if (!chip.hidden) { chip.textContent = `💪 ${kg(pv.nosnost)}`; chip.className = 'odznak cip ' + (pv.kMin >= U.BEZPECNOST ? 'ok' : pv.kMin >= 1.5 ? 'mez' : 'chyba'); }
    miniProfil(o);
    // výkres
    if (m) {
      try {
        const vy = CLEAT_VYKRES.vykres(p, o, m.pohledy, { datum: new Date().toLocaleDateString('cs-CZ') });
        $('vykresNahled').innerHTML = CLEAT_VYKRES.svg(vy, { sirkaPx: true });
        $('sVykres').textContent = vy.meritko;
      } catch (e) { $('vykresNahled').textContent = 'Výkres nejde sestavit: ' + (e && e.message || e); $('sVykres').textContent = ''; }
    } else { $('vykresNahled').textContent = 'Výkres čeká na model.'; $('sVykres').textContent = ''; }
    // souhrny oddílů
    const s = p.system, h = p.hak, z = p.zada;
    TrubkyGui.souhrn('sSystem', `${fmt(s.tl)} × ${fmt(s.vyska)}, ${fmt(s.uhel)}°`);
    TrubkyGui.souhrn('sRozmery', `${fmt(o.W)} × ${fmt(z.vyska)} × ${fmt(z.tl)} mm`);
    TrubkyGui.souhrn('sHrany', z.sraz || z.zaobleni || z.rohy ? [z.sraz ? `${z.hrany === 'oble' ? 'zaoblení' : 'sražení'} ${fmt(z.sraz)}` : '', z.zaobleni ? `kouty R ${fmt(z.zaobleni)}` : '', z.rohy ? `rohy R ${fmt(z.rohy)}` : ''].filter(Boolean).join(' · ') : 'ostré', !!(z.zaobleni || z.rohy));
    TrubkyGui.souhrn('sOpera', z.opera === 'zed' ? `patka o zeď · ${fmt(z.patka)} mm` : 'o líc lišty');
    TrubkyGui.souhrn('sZatez', U.kusu(p) > 1 ? `${fmt(p.zatez.kg, 1)} kg na kus` : `${fmt(p.zatez.kg, 1)} kg`);
    TrubkyGui.souhrn('sVHak', h.vDrazka ? `${h.vPocet} × ${fmt(h.vSirka)} → ${fmt(Math.min(h.vSirkaDole, h.vSirka))} mm, ${U.ZUBY[h.vZuby]}${h.vOtvor ? `, otvor Ø ${fmt(h.vOtvor)}` : ''}` : 'bez drážky', h.vDrazka);
    TrubkyGui.souhrn('sHak', `${U.TVARY_HAKU[h.tvar].split(' (')[0]} · ${fmt(h.dosah)} mm`);
    TrubkyGui.souhrn('sSpicka', h.zahnuti || h.koule ? `${h.zahnuti ? `zahnutí ${fmt(h.zahnuti)}°` : ''}${h.zahnuti && h.koule ? ', ' : ''}${h.koule ? `kulička Ø ${fmt(h.koule)}` : ''}` : 'rovná', !!(h.zahnuti || h.koule));
    TrubkyGui.souhrn('sRameno', h.vzpera ? `vzpěra · rameno ${fmt(h.vyskaRamene)} mm` : h.vyskaRamene ? `rameno ${fmt(h.vyskaRamene)} mm` : 'u spodku zad', h.vzpera || h.vyskaRamene > 0);
    TrubkyGui.souhrn('sDruhy', `+${fmt(h.odstup2)} mm, dosah ${fmt(h.dosah2)}`);
    TrubkyGui.souhrn('sRozmisteni', h.pocet > 1 || h.sirka > 0 ? `${h.pocet} × ${fmt(o.hak ? o.hak.w : h.sirka)} mm` : '1 přes celou šířku', h.pocet > 1 || h.sirka > 0);
    const sv = p.svorka;
    TrubkyGui.souhrn('sSvorka', sv.tvar === 'klip' ? `klip Ø ${fmt(sv.prumer)}${sv.osa === 'svisle' && sv.pocet > 1 ? ' × ' + sv.pocet : ''}` : `${sv.vPocet} × V ${fmt(sv.vSirka)} → ${fmt(Math.min(sv.vSirkaDole, sv.vSirka))} mm`);
    TrubkyGui.souhrn('sZamek', (z.zamek === 'zaves' ? `závěs · ocas ${fmt(z.ocas)} mm` : z.zamek === 'kopie' ? `kopíruje úkos · ${fmt(z.nad)} mm` : `hranatý · ${fmt(z.nad)} mm`) + (z.zub && U.jeDrzak(p) ? ' · zub' : ''));
    TrubkyGui.souhrn('sPruvlaky', p.deska.pruvlaky ? `${p.deska.pruvlaky} × ${fmt(p.deska.sirkaPruvlaku)} mm` : 'žádné', p.deska.pruvlaky > 0);
    TrubkyGui.souhrn('sPolice', `${fmt(z.sirka)} × ${fmt(p.police.hloubka)}`);
    TrubkyGui.souhrn('sStojan', p.stojan.druh === 'vrtaky' ? `${o.stojan ? o.stojan.otvory.length : ''} vrtáků` : p.stojan.druh === 'drazka' ? `${p.stojan.pocet} drážek` : `${p.stojan.pocet}${p.stojan.rady > 1 ? ' × ' + p.stojan.rady : ''} otvorů`);
    TrubkyGui.souhrn('sKapsa', (p.kapsa.tvar === 'kulata' ? `${p.kapsa.pocet} × Ø ${fmt(p.kapsa.prumer)}` : `${fmt(z.sirka)} × ${fmt(p.kapsa.hloubka)} × ${fmt(p.kapsa.vyska)}`) + (p.kapsa.dnoTyp !== 'plne' ? ` · ${p.kapsa.dnoTyp === 'prstenec' ? 'prstenec' : 'bez dna'}` : ''));
    TrubkyGui.souhrn('sDeska', `${o.deska ? o.deska.otvory.length : p.deska.sloupcu * p.deska.rad} otvorů`);
    const li = p.lista;
    TrubkyGui.souhrn('sLista', li.druh === 'koncovka' ? 'koncovka' : li.druh === 'podlozka' ? `podložka ${fmt(li.velPodlozky)} × ${fmt(li.tlPodlozky)} mm`
      : `${fmt(li.delka)} mm${li.spoj === 'rybina' ? ' · rybina' : ''}${li.zarezy ? ` · zářezy po ${fmt(li.zarezy)}` : ''}`);
    TrubkyGui.souhrn('sZkouska', p.zkouska.druh === 'merka' ? 'měrka profilu' : `${o.zkouska ? o.zkouska.vzorky.length : ''} vzorků`);
    TrubkyGui.souhrn('sKolejnice', p.deska.kolejnice ? `${p.deska.kolejnice} × ${fmt(p.deska.kolSirka)} mm` : 'žádné', p.deska.kolejnice > 0);
    TrubkyGui.souhrn('sMagnety', p.deska.magnety ? `${p.deska.magnety} × Ø ${fmt(p.deska.magPrumer)} × ${fmt(p.deska.magVyska)}` : 'žádné', p.deska.magnety > 0);
    TrubkyGui.souhrn('sOdlehceni', z.odlehceni === 'zadne' ? 'plná záda' : `${U.ODLEHCENI[z.odlehceni]} ${fmt(z.velOdlehceni)} mm${m && m.odlehcenych != null ? ` · ${m.odlehcenych} ×` : ''}`, z.odlehceni !== 'zadne');
    // hlášení
    if (!wasm && !chybaStavby) H = H.concat([{ uroven: 'info', text: 'Načítám geometrické jádro (manifold-3d)…', pole: [] }]);
    const ul = $('hlaseni'); ul.innerHTML = '';
    for (const x of H) {
      const li = document.createElement('li'); li.className = x.uroven + (x.pole.length ? ' skok' : '');
      li.textContent = x.text;
      if (x.pole.length) {
        li.tabIndex = 0;
        const kam = document.createElement('span'); kam.className = 'kam'; kam.textContent = '→ upravit'; li.appendChild(kam);
        li.addEventListener('click', e => { if (e.target.tagName !== 'BUTTON') jdiNaPole(x.pole[0]); });
        li.addEventListener('keydown', e => { if (e.key === 'Enter') jdiNaPole(x.pole[0]); });
      }
      if (x.akce === 'zesil') {
        const b = document.createElement('button'); b.className = 'tl oprava'; b.textContent = '💪 Zesílit';
        b.addEventListener('click', zesilit);
        li.appendChild(b);
      }
      if (x.oprava) {
        const b = document.createElement('button'); b.className = 'tl oprava'; b.textContent = '🔧 ' + x.oprava.text;
        b.addEventListener('click', () => { zmen(q2 => U.poloz(q2, x.oprava.pole, x.oprava.hodnota)); naplnFormular(); });
        li.appendChild(b);
      }
      ul.appendChild(li);
    }
    const nch = H.filter(x => x.uroven === 'chyba').length, nv = H.filter(x => x.uroven === 'varovani').length;
    const od = $('stavOdznak');
    od.className = 'odznak ' + (nch ? 'chyba' : nv ? 'mez' : 'ok');
    od.textContent = nch ? `✖ ${nch}` : nv ? `⚠ ${nv}` : '✔';
    $('sKontrola').textContent = nch ? `${nch} ${nch === 1 ? 'chyba' : nch < 5 ? 'chyby' : 'chyb'}` : nv ? `${nv} varování` : 'v pořádku';
    const boxy = { boxTyp: false, boxLista: false };
    for (const x of H) if (x.uroven === 'chyba') for (const c of x.pole) {
      const el = document.querySelector(`[data-p="${c}"]`), bx = el && el.closest('[data-box]');
      if (bx && bx.id in boxy) boxy[bx.id] = true;
    }
    for (const [id, a] of Object.entries(boxy)) TrubkyGui.oznacChybu(id, a);
  }
  /* ---------- kóty a pravítka v 3D náhledu ---------- */
  const KLIC_KOTY = 'webapp_cleat_koty';
  const vrstvy = (() => { try { return Object.assign({ koty: false, pravitka: false }, JSON.parse(localStorage.getItem(KLIC_KOTY)) || {}); } catch (e) { return { koty: false, pravitka: false }; } })();
  let skupinaKot = null;
  const obal = poz => { const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]; for (let i = 0; i < poz.length; i += 3) for (let j = 0; j < 3; j++) { b[j] = Math.min(b[j], poz[i + j]); b[j + 3] = Math.max(b[j + 3], poz[i + j]); } return b; };
  function obnovKoty() {
    if (skupinaKot) { nahled.scena.remove(skupinaKot); skupinaKot.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) { if (c.material.map) c.material.map.dispose(); c.material.dispose(); } }); skupinaKot = null; }
    if (!model || !(vrstvy.koty || vrstvy.pravitka)) { nahled.prekresli(); return; }
    const tisk = nahled.stav.tisk, o = model.o;
    // montážní poloha je v náhledu otočená o 180° kolem z (zeď vzadu): (x, y, z) → (−x, −y, z)
    const M = tisk ? (a => a) : (a => [-a[0], -a[1], a[2]]);
    const [x0, y0, z0, x1, y1, z1] = obal(tisk ? model.tisk.poz : model.poz), vel = Math.max(x1 - x0, y1 - y0, z1 - z0);
    const mm = v => `${fmt(v)} mm`, K = [], P = [];
    const kota = (a, b, n, txt, od) => K.push({ a: M(a), b: M(b), n: M(n), txt: txt || mm(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])), od });
    if (vrstvy.koty) {
      kota([x0, y1, z0], [x1, y1, z0], [0, 0, -1]);                     // šířka
      kota([x0, y0, z0], [x0, y1, z0], [0, 0, -1]);                     // hloubka
      kota([x0, y1, z0], [x0, y1, z1], [-1, 0, 0]);                     // výška
      if (!tisk) {
        const dal = vel * 0.26, h = o.hak;
        if (p.typ === 'hak' && h && (h.tvar === 'J' || h.tvar === 'dvojity')) {
          kota([x1, o.y0, h.zA], [x1, o.y0 + p.hak.dosah, h.zA], [0, 0, -1], `dosah ${mm(p.hak.dosah)}`, dal);
          if (h.svisla) kota([x1, h.xv + h.t1 / 2, h.zA], [x1, h.xv + h.t1 / 2, h.zA + h.vyskaSpicky], [0, 1, 0], `špička ${mm(h.vyskaSpicky)}`);
        } else if (p.typ === 'hak' && h && h.tvar === 'kolik') kota([x1, o.y0, h.zc0], [x1, h.konec[0], h.zc0], [0, 0, -1], `kolík ${mm(p.hak.dosah)}`, dal);
        else if (p.typ === 'hak' && h) kota([x1, h.yc - h.rr, h.zr], [x1, h.yc + h.rr, h.zr], [0, 0, 1], `lůžko Ø ${fmt(2 * h.rr, 1)}`);
        else if (p.typ === 'police') kota([x1, o.y0, o.police.zt], [x1, o.y0 + o.police.D, o.police.zt], [0, 0, 1], `hloubka ${mm(o.police.D)}`);
        else if (p.typ === 'stojan' || p.typ === 'kapsa') kota([x1, o.y0, o.zBot], [x1, o.y0 + o[p.typ].D, o.zBot], [0, 0, -1], `hloubka ${mm(o[p.typ].D)}`, dal);
        else if (p.typ === 'svorka' && o.svorka.tvar === 'klip') { const q = o.svorka, x = q.svisle ? q.xs[0] : x1, z = q.svisle ? o.zBot + p.svorka.vyska : q.vc; kota([x, q.uc - q.Ri, z], [x, q.uc + q.Ri, z], [0, 0, 1], `Ø ${fmt(2 * q.Ri, 2)}`); }
        if (p.typ !== 'lista') kota([x1, o.yZ, o.zBot], [x1, o.yZ, o.zTop], [0, -1, 0], `záda ${mm(o.zTop - o.zBot)}`);
      }
    }
    if (vrstvy.pravitka) {
      P.push({ a: M([x0, y1, z0]), b: M([x1, y1, z0]), n: M([0, 1, 0]) }, { a: M([x0, y0, z0]), b: M([x0, y1, z0]), n: M([-1, 0, 0]) }, { a: M([x1, y1, z0]), b: M([x1, y1, z1]), n: M([0, 1, 0]) });
    }
    skupinaKot = CLEAT_KOTY.postav(THREE, { koty: K, pravitka: P, barva: css('--text') || '#ddd', pozadi: css('--bg-panel') || '#222', velikost: vel });
    nahled.scena.add(skupinaKot);
    nahled.prekresli();
  }
  for (const [id, co] of [['tKoty', 'koty'], ['tPravitka', 'pravitka']]) {
    $(id).setAttribute('aria-pressed', String(vrstvy[co]));
    $(id).addEventListener('click', () => {
      vrstvy[co] = !vrstvy[co]; $(id).setAttribute('aria-pressed', String(vrstvy[co]));
      try { localStorage.setItem(KLIC_KOTY, JSON.stringify(vrstvy)); } catch (e) { /* bez úložiště */ }
      obnovKoty();
    });
  }
  /** Živý profil zboku: průmět dílu, lišta čárkovaně, zeď – ať je vidět, jak zámek sedí za úkosem. */
  function miniProfil(o) {
    const el = $('miniProfil');
    if (!model || !model.pohledy) { el.innerHTML = ''; return; }
    const polys = model.pohledy.bok, lista = [[0, 0], [o.T, 0], [o.T, o.H], [0, o.H - o.pokles]];
    const vse = polys.flat().concat(lista), yz = o.yZed || 0;
    const y0 = Math.min(yz - 4, ...vse.map(b => b[0])), y1 = Math.max(...vse.map(b => b[0])) + 4;
    const z0 = Math.min(...vse.map(b => b[1])) - 4, z1 = Math.max(...vse.map(b => b[1])) + 4;
    const cesta = pl => 'M' + pl.map(([y, z]) => `${(y - y0).toFixed(2)} ${(z1 - z).toFixed(2)}`).join('L') + 'Z';
    el.innerHTML = `<svg viewBox="0 0 ${(y1 - y0).toFixed(1)} ${(z1 - z0).toFixed(1)}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Profil zboku">`
      + (yz < -0.5 ? `<rect class="mp-latka" x="${(yz - y0).toFixed(2)}" y="0" width="${(-yz).toFixed(2)}" height="${(z1 - z0).toFixed(1)}"/>` : '')
      + `<line class="mp-zed" x1="${(yz - y0).toFixed(2)}" y1="0" x2="${(yz - y0).toFixed(2)}" y2="${(z1 - z0).toFixed(1)}" stroke-width="${((y1 - y0) / 120).toFixed(2)}"/>`
      + `<path class="mp-lista" d="${cesta(lista)}" stroke-width="${((y1 - y0) / 250).toFixed(2)}"/>`
      + `<path class="mp-dil" fill-rule="evenodd" d="${polys.map(cesta).join('')}"/></svg>`;
  }
  function jdiNaPole(cesta) {
    const el = [...document.querySelectorAll(`[data-p="${cesta}"]`)].find(e => !e.closest('[hidden]')) || document.querySelector(`[data-p="${cesta}"]`);
    if (!el) return;
    const det = el.closest('details'); if (det) det.open = true;
    const tel = el.closest('.zalozka-telo'); if (tel) TrubkyGui.otevriZalozku(tel.dataset.telo);
    const bx = el.closest('[data-box]'); TrubkyGui.ukazBox(bx ? bx.dataset.box : 'obecne');
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.focus({ preventScroll: true });
    el.classList.remove('zvyrazni'); void el.offsetWidth; el.classList.add('zvyrazni');
  }
  $('tabOrientace').addEventListener('click', e => {
    const tr = e.target.closest('tr[data-klic]'); if (!tr) return;
    zmen(x => { x.tisk.orientace = tr.dataset.klic; }); naplnFormular();
  });
  $('tabOrientace').addEventListener('keydown', e => { if (e.key === 'Enter') e.target.click(); });

  /* ---------- nabídky, export ---------- */
  TrubkyGui.pripoj({ klic: 'webapp_cleat_gui', pohled: j => nahled.pohled(j) });
  const seznam = $('seznamPredvoleb');
  let skupina = null;
  U.PREDVOLBY.forEach((v, i) => {
    if (v.skupina !== skupina) {
      skupina = v.skupina;
      const nd = document.createElement('div'); nd.className = 'nab-nadpis'; nd.textContent = skupina; seznam.appendChild(nd);
    }
    const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
    b.innerHTML = `${esc(v.nazev)}<span class="pozn">${esc(v.popis)}</span>`;
    b.addEventListener('click', () => nahrad(U.zPredvolby(i)));
    seznam.appendChild(b);
  });
  const jmenoSouboru = pripona => ((p.nazev || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/^_|_$/g, '') || 'cleat') + pripona;
  function stahni(data, nazev, typ) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type: typ }));
    a.download = nazev; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function kusy(n) {
    if (!model) { Dialog.chyba(chybaStavby || (wasm ? 'Model nelze sestavit – viz záložka Kontrola.' : 'Geometrické jádro se ještě načítá.')); return null; }
    const d = { poz: model.tisk.poz, idx: model.idx, barva: '#4F86D9' };
    return KRAB.tiskoveRozlozeni(Array.from({ length: n }, (_, i) => Object.assign({ jmeno: 'cleat', nazev: (p.nazev || 'Držák') + (n > 1 ? ` ${i + 1}` : '') }, d)), 8);
  }
  function exportStl(n) { const k = kusy(n); if (k) stahni(KRAB.stlBinarni(k, 'french cleat - github_site'), jmenoSouboru(n > 1 ? `_${n}ks.stl` : '.stl'), 'model/stl'); }
  $('btnStl').addEventListener('click', () => exportStl(p.tisk.kusu));
  $('btnStl1').addEventListener('click', () => exportStl(1));
  $('btn3mf').addEventListener('click', () => { const k = kusy(p.tisk.kusu); if (k) stahni(KRAB.soubor3mf(k, p.nazev || 'Držák'), jmenoSouboru('.3mf'), 'model/3mf'); });
  $('btnPng').addEventListener('click', () => { fetch(nahled.png()).then(r => r.blob()).then(b => stahni(b, jmenoSouboru('.png'))); });
  let pismoSlib = null;
  function nactiPismo() {
    if (window.FONTY_JS && window.FONTY_JS['LiberationSans-Regular.ttf']) return Promise.resolve(window.FONTY_JS['LiberationSans-Regular.ttf']);
    if (pismoSlib) return pismoSlib;
    pismoSlib = new Promise(ok => {
      const s = document.createElement('script'); s.src = 'stitky_panely/fonty/LiberationSans-Regular.ttf.js';
      s.onload = () => ok((window.FONTY_JS || {})['LiberationSans-Regular.ttf'] || null);
      s.onerror = () => { pismoSlib = null; ok(null); };
      document.head.appendChild(s);
    });
    return pismoSlib;
  }
  function vykresTed() {
    if (!model) throw new Error(chybaStavby || 'Model ještě není sestavený.');
    return CLEAT_VYKRES.vykres(p, U.odvozene(p), model.pohledy, { datum: new Date().toLocaleDateString('cs-CZ') });
  }
  async function vykresPdf() {
    try {
      if (!window.jspdf) throw new Error('Knihovna jsPDF se nenačetla.');
      const pismo = await nactiPismo();
      const doc = CLEAT_VYKRES.pdf(window.jspdf.jsPDF, vykresTed(), { pismo, nazev: p.nazev || 'French cleat' });
      stahni(doc.output('blob'), jmenoSouboru('_vykres.pdf'));
      if (!pismo) Dialog.info('Písmo se nepodařilo načíst – PDF je bez diakritiky.');
    } catch (e) { Dialog.chyba('PDF se nepodařilo vytvořit: ' + (e && e.message || e)); }
  }
  function vykresSvg() {
    try { stahni(CLEAT_VYKRES.svg(vykresTed()), jmenoSouboru('_vykres.svg'), 'image/svg+xml'); } catch (e) { Dialog.chyba(e.message); }
  }
  $('btnVykresPdf').addEventListener('click', vykresPdf); $('btnVykresPdf2').addEventListener('click', vykresPdf);
  $('btnVykresSvg').addEventListener('click', vykresSvg); $('btnVykresSvg2').addEventListener('click', vykresSvg);
  $('btnUlozit').addEventListener('click', () => stahni(U.ulozProjekt(p), jmenoSouboru('.json'), 'application/json'));
  $('btnNacist').addEventListener('click', () => $('soubor').click());
  $('soubor').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try { const r = U.nactiProjekt(await f.text()); nahrad(r.p); hlasPrevod(r.hlaseni, 'Načtený projekt'); }
    catch (err) { Dialog.chyba(err.message); }
  });
  $('btnVychozi').addEventListener('click', async () => {
    if (await Dialog.potvrd('Vrátit všechny hodnoty na výchozí (první předvolba)?')) nahrad(U.zPredvolby(0));
  });
  /** 🎲 náhodný držák (zpět ho vrátí Ctrl+Z); stejnyTyp = zůstane aktuální typ */
  function nahodny(stejnyTyp) {
    const q = U.nahodny(p, (Math.random() * 4294967296) >>> 0, stejnyTyp ? p.typ : undefined);
    if (!q) { Dialog.info('Náhodný držák se nepodařilo najít – zkuste to znovu.'); return; }
    nahrad(q);
    TrubkyGui.otevriZalozku('vysledky');
  }
  $('btnNahoda').addEventListener('click', e => nahodny(e.shiftKey));
  $('btnZpet').addEventListener('click', () => krokHistorie(zpet, znovu));
  $('btnZnovu').addEventListener('click', () => krokHistorie(znovu, zpet));
  function prepinac(id, co) {
    const b = $(id);
    b.addEventListener('click', () => {
      const h = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', String(h)); nahled.prepni(co, h);
      if (co === 'tisk') obnovKoty();
      legendy();
    });
  }
  prepinac('tDuchove', 'duchove'); prepinac('tHrany', 'hrany'); prepinac('tTisk', 'tisk'); prepinac('tPrevisy', 'previsy');
  /* ---------- mapa pevnosti v náhledu ---------- */
  const BARVY_K = [[0.2, 0.7, 0.35], [0.88, 0.63, 0.19], [0.86, 0.22, 0.2]], ZAKLAD = [0.25, 0.48, 0.84];
  /** Barva trojúhelníku podle nejslabšího průřezu, do jehož oblasti padne jeho těžiště (souřadnice dílu). */
  function barvyNapeti(poz, idx, oblasti) {
    const nT = idx.length / 3, out = new Float32Array(3 * nT);
    for (let t = 0; t < nT; t++) {
      const c = [0, 1, 2].map(j => (poz[3 * idx[3 * t] + j] + poz[3 * idx[3 * t + 1] + j] + poz[3 * idx[3 * t + 2] + j]) / 3);
      let k = Infinity;
      for (const ob of oblasti) if (c.every((v, j) => v >= ob.min[j] && v <= ob.max[j])) k = Math.min(k, ob.k);
      const b = !Number.isFinite(k) ? ZAKLAD : k >= U.BEZPECNOST ? BARVY_K[0] : k >= 1.5 ? BARVY_K[1] : BARVY_K[2];
      out[3 * t] = b[0]; out[3 * t + 1] = b[1]; out[3 * t + 2] = b[2];
    }
    return out;
  }
  function legendy() {
    const nap = !!(model && model.barvy && nahled.stav.napeti);
    $('legendaNapeti').hidden = !nap;
    $('legenda3d').hidden = nap || !(model && nahled.stav.tisk && nahled.stav.previsy);
  }
  function prepniMapu(h) {
    if (h == null) h = !nahled.stav.napeti;
    for (const id of ['tNapeti', 'btnMapa']) $(id).setAttribute('aria-pressed', String(h));
    nahled.prepni('napeti', h);
    legendy();
  }
  $('tNapeti').addEventListener('click', () => prepniMapu());
  $('btnMapa').addEventListener('click', () => prepniMapu());

  /* ---------- zesílit na zadanou zátěž ---------- */
  const popisPole = c => { const el = document.querySelector(`[data-p="${c}"]`); return el && el.labels && el.labels[0] ? el.labels[0].textContent.trim() : c; };
  function zesilit() {
    const r = U.zesil(p, model ? U.osaNahoru(model.rozbor.vybrana.klic) : undefined);
    if (!r.zmeny.length) { Dialog.info(r.ok ? 'Díl už zadanou zátěž unese s rezervou – není co zesilovat.' : 'Zesílit nejde – tloušťky jsou na maximu nebo by vznikla chyba. Zkuste delší záda, vzpěru nebo menší zátěž.'); return; }
    nahrad(r.p);
    Dialog.info(`${r.ok ? 'Zesíleno' : 'Zesíleno, jak to šlo – rezerva je pořád pod 3×'}: ${r.zmeny.map(x => `${popisPole(x.cesta)} ${fmt(x.z)} → ${fmt(x.na)} mm`).join('; ')}. Zpět vrátí Ctrl+Z.`);
  }
  $('btnZesil').addEventListener('click', zesilit);
  $('stavOdznak').addEventListener('click', () => TrubkyGui.otevriZalozku('kontrola'));
  $('chipNosnost').addEventListener('click', () => TrubkyGui.otevriZalozku('pevnost'));
  // galerie předvoleb: náhledy (profil zboku + pohled zepředu) se staví postupně při prvním otevření
  let galerieHotova = false;
  function galerie() {
    if (galerieHotova || !wasm) return;
    galerieHotova = true;
    const box = $('galerie');
    let skupina = null, html = '';
    U.PREDVOLBY.forEach((v, i) => {
      if (v.skupina !== skupina) { skupina = v.skupina; html += `<div class="skup">${esc(skupina)}</div>`; }
      html += `<button type="button" data-predvolba="${i}" title="${esc(v.popis)}"><span class="nahl" id="nahl${i}">…</span><b>${esc(v.nazev)}</b><span class="po">${esc(v.popis)}</span></button>`;
    });
    box.innerHTML = html;
    let i = 0;
    const dalsi = () => {
      if (i >= U.PREDVOLBY.length) { $('galerieStav').textContent = 'Náhledy všech předvoleb – klepnutím ji použijete (přepíše celé nastavení).'; return; }
      const q = U.zPredvolby(i), o = U.odvozene(q), cil = $('nahl' + i);
      try {
        const s = CLEAT_GEOM.postav(wasm, q, o, null);
        // profil zboku (s lištou) a u neprofilových dílů vedle něj pohled shora (zeď nahoře) – tam jsou vidět otvory a přihrádky
        const lista = [[0, 0], [o.T, 0], [o.T, o.H], [0, o.H - o.pokles]];
        const pohledy = [{ polys: s.pohledy.bok, lista: q.typ === 'lista' ? null : lista }];
        if (q.typ === 'lista') pohledy[0] = { polys: s.pohledy.cela };
        else if (!U.profilovy(q)) pohledy.push({ polys: s.pohledy.shora.map(pl => pl.map(([x, y]) => [x, -y])) });
        let posun = 0, telo = '';
        const meze = pohledy.map(v => {
          const vse = v.polys.flat().concat(v.lista || []);
          return [Math.min(...vse.map(b => b[0])), Math.max(...vse.map(b => b[0])), Math.min(...vse.map(b => b[1])), Math.max(...vse.map(b => b[1]))];
        });
        const H = Math.max(...meze.map(m => m[3] - m[2])) + 6;
        pohledy.forEach((v, j) => {
          const [a0, a1, b0, b1] = meze[j], dz = (H - (b1 - b0)) / 2;
          const c = pl => 'M' + pl.map(([a, b]) => `${(a - a0 + posun + 3).toFixed(1)} ${(b1 - b + dz).toFixed(1)}`).join('L') + 'Z';
          if (v.lista) telo += `<path class="mp-lista" stroke-width="${(H / 150).toFixed(2)}" d="${c(v.lista)}"/>`;
          telo += `<path class="mp-dil" fill-rule="evenodd" d="${v.polys.map(c).join('')}"/>`;
          posun += a1 - a0 + 10;
        });
        cil.innerHTML = `<svg viewBox="0 0 ${(posun - 4).toFixed(1)} ${H.toFixed(1)}" preserveAspectRatio="xMidYMid meet">${telo}</svg>`;
      } catch (e) { cil.textContent = '–'; }
      i++;
      $('galerieStav').textContent = `Kreslím náhledy… ${i} / ${U.PREDVOLBY.length}`;
      setTimeout(dalsi, 0);
    };
    dalsi();
  }
  $('galerie').addEventListener('click', e => { const b = e.target.closest('[data-predvolba]'); if (b) { nahrad(U.zPredvolby(+b.dataset.predvolba)); TrubkyGui.otevriZalozku('vysledky'); } });
  document.querySelector('[data-zalozka="galerie"]').addEventListener('click', galerie);
  $('btnZavritNap').addEventListener('click', () => $('napoveda').close());
  document.addEventListener('keydown', e => {
    const a = document.activeElement;
    const vPoli = a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || (a.tagName === 'INPUT' && !/checkbox|range|radio|button/.test(a.type));
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && !vPoli && k === 'z') { e.preventDefault(); krokHistorie(e.shiftKey ? znovu : zpet, e.shiftKey ? zpet : znovu); return; }
    if ((e.ctrlKey || e.metaKey) && !vPoli && k === 'y') { e.preventDefault(); krokHistorie(znovu, zpet); return; }
    if ((e.ctrlKey || e.metaKey) && k === 's') { e.preventDefault(); exportStl(p.tisk.kusu); return; }
    if (e.key === 'F1') { e.preventDefault(); $('napoveda').showModal(); return; }
    if (vPoli || e.ctrlKey || e.metaKey || e.altKey || $('napoveda').open) return;
    const pohl = { 1: 'iso', 2: 'shora', 3: 'zepredu', 4: 'zboku' }[(e.code || '').replace(/^(Digit|Numpad)/, '')];
    if (pohl) nahled.pohled(pohl);
    else if (e.code === 'KeyR') nahodny(e.shiftKey);
    else if (e.code === 'KeyK') $('tKoty').click(); else if (e.code === 'KeyL') $('tPravitka').click();
    else if (e.code === 'KeyN') prepniMapu();
    else if (k === 'm') $('tTisk').click(); else if (k === 'd') $('tDuchove').click(); else if (k === 'v') $('tPrevisy').click(); else if (k === 'h') $('tHrany').click();
  });
  new MutationObserver(() => naplanuj()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  if (typeof Tvary !== 'undefined') Tvary.pripoj({
    klic: 'webapp_cleat_tvary', typ: 'cleat', nazev: 'Držáky na French cleat', kontejner: $('tvary'),
    parametry: () => U.kopie(p),
    pouzij: q => { const n = U.normalizuj(q); hlasPrevod(n.hlaseni, 'Uložený držák'); nahrad(n.p); },
    popis: q => `${q.nazev || 'Držák'} – ${U.popis(U.normalizuj(q).p)}`,
  });

  /* ---------- sdílení odkazem: #p= JSON zkomprimovaný deflate-raw, base64url ---------- */
  const b64u = u8 => { let t = ''; for (const b of u8) t += String.fromCharCode(b); return btoa(t).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const zB64u = t => { const s2 = atob(t.replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(s2, c => c.charCodeAt(0)); };
  async function proud(data, Trida, druh) { return new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new Trida(druh))).arrayBuffer()); }
  async function zakoduj(q) {
    const json = new TextEncoder().encode(JSON.stringify(q));
    if (typeof CompressionStream === 'undefined') return 'j' + b64u(json);
    return 'z' + b64u(await proud(json, CompressionStream, 'deflate-raw'));
  }
  async function dekoduj(t) {
    const data = zB64u(t.slice(1));
    const json = t[0] === 'z' ? await proud(data, DecompressionStream, 'deflate-raw') : data;
    return JSON.parse(new TextDecoder().decode(json));
  }
  $('btnSdilet').addEventListener('click', async () => {
    try {
      const odkaz = new URL('cleat.html', location.href).href.split('#')[0] + '#p=' + await zakoduj(p);
      // nečekat – bez oprávnění může slib viset (iframe, headless)
      try { navigator.clipboard.writeText(odkaz).catch(() => {}); } catch (e) { /* schránka nedostupná */ }
      await Dialog.zeptej('Odkaz s celým nastavením držáku (zkopírováno do schránky, pokud to prohlížeč dovolil). Kdo ho otevře, uvidí stejný držák:', odkaz);
    } catch (e) { Dialog.chyba('Odkaz se nepodařilo vytvořit: ' + (e && e.message || e)); }
  });
  async function nactiZOdkazu() {
    const m = /[#&]p=([\w-]+)/.exec(location.hash);
    if (!m) return;
    try {
      const data = await dekoduj(m[1]);
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('není objekt');
      const r = U.normalizuj(data);
      nahrad(r.p);
      hlasPrevod(r.hlaseni, 'Sdílený držák');
    } catch (e) { Dialog.chyba('Odkaz je poškozený – držák z něj nejde načíst.'); }
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* sandbox */ }
  }

  /* ---------- katalog uložených držáků (Moje držáky) pro sadu a stěnu ---------- */
  function ulozene() {
    try {
      const d = JSON.parse(localStorage.getItem('webapp_cleat_tvary'));
      return (d && Array.isArray(d.polozky) ? d.polozky : []).filter(x => x && x.parametry).map(x => ({ klic: 'u' + x.id, nazev: x.nazev || 'Držák', p: U.normalizuj(x.parametry).p }));
    } catch (e) { return []; }
  }
  const katalog = () => [{ klic: 'akt', nazev: `${p.nazev || 'Držák'} (aktuální)`, p: U.kopie(p) }].concat(ulozene());
  /** Model libovolného nastavení (cache podle JSON) – pro sadu, stěnu a porovnání. */
  const cacheModelu = new Map();
  function modelPro(q) {
    if (!wasm) return null;
    const k = JSON.stringify(q) + (pismo ? '+p' : '');
    if (JSON.stringify(q) === JSON.stringify(p) && model) return model;
    if (cacheModelu.has(k)) return cacheModelu.get(k);
    let m = null;
    try {
      const o = U.odvozene(q), sit = CLEAT_GEOM.postav(wasm, q, o, pismo), rozbor = U.rozborTisku(sit, q, o), tisk = U.tiskovaPoloha(sit, rozbor.vybrana.R);
      m = Object.assign(sit, { o, rozbor, tisk, ks: KRAB.kontrolaSite(tisk.poz, sit.idx) });
    } catch (e) { m = null; }
    if (cacheModelu.size > 40) cacheModelu.delete(cacheModelu.keys().next().value);
    cacheModelu.set(k, m);
    return m;
  }
  const cacheMetrik = new Map();
  function metriky(q) {
    const k = JSON.stringify(q) + (pismo ? '+p' : '') + (wasm ? '' : '-');
    if (cacheMetrik.has(k) && (cacheMetrik.get(k) || !wasm)) return cacheMetrik.get(k);
    const t = metrikyTed(q);
    if (cacheMetrik.size > 40) cacheMetrik.delete(cacheMetrik.keys().next().value);
    cacheMetrik.set(k, t);
    return t;
  }
  function metrikyTed(q) {
    const m = modelPro(q);
    if (!m) return null;
    const o = m.o, b = m.ks.bbox, odh = U.odhadTisku(m.objem, m.plocha, b[5] - b[2], q);
    const pv = U.jeDrzak(q) ? U.pevnost(q, o, U.osaNahoru(m.rozbor.vybrana.klic)) : null;
    const zp = obal(m.poz);
    return { m, o, gramy: odh.gramy, minut: odh.minut, rozmer: [b[3] - b[0], b[4] - b[1], b[5] - b[2]], nosnost: pv && pv.prurezy.length ? pv.nosnost : NaN,
      kMin: pv ? pv.kMin : NaN, podpory: U.potrebujePodpory(m.rozbor.vybrana, m.plocha), orientace: m.rozbor.vybrana.nazev, W: zp[3] - zp[0], dole: zp[2], horni: zp[5] };
  }

  /* ---------- sada na podložku ---------- */
  const pocetSady = Object.create(null);
  function kresliSadu() {
    const k = katalog();
    $('tabSada').innerHTML = '<tr><th class="c">Ks</th><th>Držák</th></tr>' + k.map(x => `<tr><td class="c"><input class="ks" type="text" inputmode="numeric" data-sada="${esc(x.klic)}" value="${+(pocetSady[x.klic] ?? (x.klic === 'akt' ? p.tisk.kusu : 0)) || 0}" aria-label="Kusů: ${esc(x.nazev)}"></td><td>${esc(x.nazev)} <span class="pozn">${esc(U.popis(x.p))}</span></td></tr>`).join('');
    $('sSada').textContent = k.length > 1 ? `${k.length - 1} uložených` : 'jen aktuální';
  }
  $('tabSada').addEventListener('input', e => { const i = e.target.closest('[data-sada]'); if (i) pocetSady[i.dataset.sada] = Math.max(0, Math.min(30, Math.round(U.cislo(i.value, 0)))); });
  $('sadaOddil').addEventListener('toggle', () => { if ($('sadaOddil').open) kresliSadu(); });
  /** Rozložení do řad po ~220 mm (běžná podložka), díly v tiskové poloze. */
  async function sestavSadu() {
    if (!wasm) { Dialog.chyba('Geometrické jádro se ještě načítá.'); return null; }
    for (const x of katalog()) await potrebujePismo(x.p);
    const dily = [];
    for (const x of katalog()) {
      const n = pocetSady[x.klic] ?? (x.klic === 'akt' ? p.tisk.kusu : 0);
      if (!n) continue;
      const m = modelPro(x.p);
      if (!m) { Dialog.chyba(`Držák „${x.nazev}“ nejde sestavit – otevřete ho a podívejte se do Kontroly.`); return null; }
      for (let i = 0; i < n; i++) dily.push({ jmeno: 'cleat', nazev: x.nazev + (n > 1 ? ` ${i + 1}` : ''), poz: m.tisk.poz, idx: m.idx, barva: '#4F86D9' });
    }
    if (!dily.length) { Dialog.info('Zadejte u některého držáku počet kusů.'); return null; }
    const SIR = 220, MEZ = 8, out = [];
    let x = 0, y = 0, hloubkaRady = 0, rada = [];
    const uzavri = () => { out.push(...rada); y += hloubkaRady + MEZ; x = 0; hloubkaRady = 0; rada = []; };
    for (const d of dily) {
      const b = KRAB.obal(d.poz), w = b[3] - b[0], h = b[4] - b[1];
      if (x > 0 && x + w > SIR) uzavri();
      rada.push(Object.assign({}, d, KRAB.presun(d, x - b[0], y - b[1], -b[2])));
      x += w + MEZ; hloubkaRady = Math.max(hloubkaRady, h);
    }
    uzavri();
    const c = KRAB.obal(out.flatMap(d => Array.from(d.poz)));
    $('stavSada').textContent = `${out.length} dílů, plocha ${fmt(c[3] - c[0], 0)} × ${fmt(c[4] - c[1], 0)} mm`;
    return out.map(d => Object.assign({}, d, KRAB.presun(d, -(c[0] + c[3]) / 2, -(c[1] + c[4]) / 2, 0)));
  }
  $('btnSada3mf').addEventListener('click', async () => { const k = await sestavSadu(); if (k) stahni(KRAB.soubor3mf(k, 'Sada French cleat'), 'sada_french_cleat.3mf', 'model/3mf'); });
  $('btnSadaStl').addEventListener('click', async () => { const k = await sestavSadu(); if (k) stahni(KRAB.stlBinarni(k, 'french cleat - github_site'), 'sada_french_cleat.stl', 'model/stl'); });

  /* ---------- porovnání dvou variant ---------- */
  const KLIC_POR = 'webapp_cleat_porovnani';
  let variantaA = (() => { try { const t = JSON.parse(localStorage.getItem(KLIC_POR)); return t ? U.normalizuj(t).p : null; } catch (e) { return null; } })();
  function profilSvg(m, q) {
    if (!m || !m.pohledy) return '';
    const o = m.o, lista = U.jeDrzak(q) ? [[0, 0], [o.T, 0], [o.T, o.H], [0, o.H - o.pokles]] : null;
    const polys = m.pohledy.bok, vse = polys.flat().concat(lista || []);
    const y0 = Math.min(...vse.map(b => b[0])) - 3, y1 = Math.max(...vse.map(b => b[0])) + 3, z0 = Math.min(...vse.map(b => b[1])) - 3, z1 = Math.max(...vse.map(b => b[1])) + 3;
    const c = pl => 'M' + pl.map(([y, z]) => `${(y - y0).toFixed(1)} ${(z1 - z).toFixed(1)}`).join('L') + 'Z';
    return `<svg viewBox="0 0 ${(y1 - y0).toFixed(1)} ${(z1 - z0).toFixed(1)}" preserveAspectRatio="xMidYMid meet">${lista ? `<path class="mp-lista" stroke-width="${((y1 - y0) / 250).toFixed(2)}" d="${c(lista)}"/>` : ''}<path class="mp-dil" fill-rule="evenodd" d="${polys.map(c).join('')}"/></svg>`;
  }
  function kresliPorovnani() {
    $('btnVratA').disabled = $('btnProhodA').disabled = !variantaA;
    const el = $('porovnani');
    if (!variantaA) { el.innerHTML = '<p class="napoveda">Zatím není odložená žádná varianta.</p>'; return; }
    const A = metriky(variantaA), B = metriky(p);
    if (!A || !B) { el.innerHTML = `<p class="napoveda">${wasm ? 'Některou variantu nejde sestavit.' : 'Načítám geometrické jádro…'}</p>`; return; }
    // lepsi: 1 = víc je lepší, −1 = míň je lepší, 0 = nehodnotit
    const radky = [
      ['Popis', U.popis(variantaA), U.popis(p), null, 0],
      ['Rozměry tisku', A.rozmer.map(x => fmt(x)).join(' × ') + ' mm', B.rozmer.map(x => fmt(x)).join(' × ') + ' mm', null, 0],
      ['Hmotnost', `${fmt(A.gramy, 1)} g`, `${fmt(B.gramy, 1)} g`, [A.gramy, B.gramy], -1],
      ['Doba tisku', `${fmt(A.minut, 0)} min`, `${fmt(B.minut, 0)} min`, [A.minut, B.minut], -1],
      ['Doporučená zátěž', kg(A.nosnost), kg(B.nosnost), [A.nosnost, B.nosnost], 1],
      ['Nejmenší rezerva', Number.isFinite(A.kMin) ? `${fmt(A.kMin, 1)}×` : '–', Number.isFinite(B.kMin) ? `${fmt(B.kMin, 1)}×` : '–', [A.kMin, B.kMin], 1],
      ['Orientace tisku', A.orientace + (A.podpory ? ' (podpory)' : ''), B.orientace + (B.podpory ? ' (podpory)' : ''), [A.podpory ? 1 : 0, B.podpory ? 1 : 0], -1],
    ];
    const tr = (a, b, d, sm) => {
      if (!d || !sm || !d.every(Number.isFinite) || Math.abs(d[0] - d[1]) < 1e-6 * Math.max(1, Math.abs(d[0]))) return ['', ''];
      const bLepsi = (d[1] - d[0]) * sm > 0;
      return [bLepsi ? 'horsi' : 'lepsi', bLepsi ? 'lepsi' : 'horsi'];
    };
    el.innerHTML = '<div class="obal-tab"><table class="tabulka"><tr><th></th><th>A (odložená)</th><th>Aktuální</th></tr>'
      + radky.map(([n, a, b, d, sm]) => { const [ta, tb] = tr(a, b, d, sm); return `<tr><td>${n}</td><td class="${ta}">${esc(a)}</td><td class="${tb}">${esc(b)}</td></tr>`; }).join('')
      + `</table></div><div class="porov-nahledy"><figure>${profilSvg(A.m, variantaA)}<figcaption>A – profil zboku</figcaption></figure><figure>${profilSvg(B.m, p)}<figcaption>aktuální – profil zboku</figcaption></figure></div>`;
  }
  const ulozA = () => { try { localStorage.setItem(KLIC_POR, JSON.stringify(variantaA)); } catch (e) { /* plné úložiště */ } };
  $('btnOdlozA').addEventListener('click', () => { variantaA = U.kopie(p); ulozA(); kresliPorovnani(); });
  $('btnVratA').addEventListener('click', () => { if (variantaA) nahrad(U.kopie(variantaA)); });
  $('btnProhodA').addEventListener('click', () => { if (!variantaA) return; const a = variantaA; variantaA = U.kopie(p); ulozA(); nahrad(U.kopie(a)); });

  /* ---------- plánovač stěny ---------- */
  const stena = CLEAT_STENA.pripoj({
    kontejner: $('stena'), klic: 'webapp_cleat_stena', fmt, vyskaListy: () => U.odvozene(p).H,
    katalog: () => katalog().map(x => ({ nazev: x.klic === 'akt' ? (p.nazev || 'Držák') : x.nazev, p: x.p })),
    info: q => {
      const t = metriky(q);
      return t ? { W: t.W, dole: t.dole, horni: t.horni, H: t.o.H, gramy: t.gramy, minut: t.minut } : null;
    },
  });
  const viditelna = id => { const el = document.querySelector(`[data-telo="${id}"]`); return el && !el.hidden; };
  // záložka se dá otevřít klepnutím i z kódu (TrubkyGui.otevriZalozku) – hlídat přímo její viditelnost
  for (const [id, fn] of [['porovnani', kresliPorovnani], ['stena', () => stena.kresli()], ['tisk', () => { if ($('sadaOddil').open) kresliSadu(); }]]) {
    const el = document.querySelector(`[data-telo="${id}"]`);
    new MutationObserver(() => { if (!el.hidden) fn(); }).observe(el, { attributes: true, attributeFilter: ['hidden'] });
  }
  /** Otevřené záložky Porovnání / Stěna se obnoví po každém přepočtu. */
  function obnovZalozky() {
    if (viditelna('porovnani')) kresliPorovnani();
    if (viditelna('stena')) stena.kresli();
  }

  /* ---------- start ---------- */
  p = nactiUlozeny();
  naplnFormular();
  prepocitej();
  nactiZOdkazu();
  addEventListener('hashchange', nactiZOdkazu);   // odkaz vložený do adresy už otevřené stránky
  nactiManifold().then(w => { wasm = w; $('stav3d').textContent = ''; prepocitej(); }).catch(e => {
    chybaStavby = 'Geometrické jádro (manifold-3d) se nenačetlo: ' + (e && e.message || e) + ' – model ani export nejsou k dispozici.';
    const st = $('stav3d'); st.textContent = chybaStavby; st.classList.add('chyba');
    vypis(U.kontroly(p, U.odvozene(p)).concat([{ uroven: 'chyba', text: chybaStavby, pole: [] }]), U.odvozene(p));
  });
  window.CLEAT_UI = { get p() { return p; }, get model() { return model; }, nahled, zmen, naplnFormular, prepocitej, nahrad };
})();

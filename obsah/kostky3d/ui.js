/* Herní kostky a žetony – ovládání stránky: formulář, historie, písmo, manifold, výsledky, těžiště, kontroly, export. */
/* global KOSTKY3D, KOSTKY3D_GEO, KOSTKY3D_NAHLED, KOSTKY3D_PREDVOLBY, KRAB, Dialog, Tvary, TrubkyGui, FONTY */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const K = KOSTKY3D, fmt = K.fmt;
  const KLIC = 'webapp_kostky3d_projekt';

  /* ---------- stav a historie ---------- */
  let p, plan = null, geo = null, hlaseni = [], chybaStavby = null;
  const zpet = [], znovu = [];
  function nactiUlozeny() {
    try { const t = localStorage.getItem(KLIC); if (t) return K.normalizuj(JSON.parse(t)).p; } catch (e) { /* poškozený záznam */ }
    return K.normalizuj({}).p;
  }
  function uloz() { try { localStorage.setItem(KLIC, JSON.stringify(p)); } catch (e) { /* plné úložiště */ } }
  function zmen(fn, slouceni) {
    const pred = JSON.stringify(p);
    fn(p);
    p = K.normalizuj(p).p;
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
    p = K.normalizuj(JSON.parse(z.pop().stav)).p;
    naplnFormular(); po();
  }
  function po() { $('btnZpet').disabled = !zpet.length; $('btnZnovu').disabled = !znovu.length; uloz(); viditelnost(); naplanuj(); }
  const nahradVse = q => zmen(x => { Object.keys(x).forEach(k => delete x[k]); Object.assign(x, q); });

  /* ---------- formulář ---------- */
  const pole = [...document.querySelectorAll('[data-p]')];
  function naplnFormular() {
    for (const el of pole) {
      const h = K.vezmi(p, el.dataset.p);
      if (el.type === 'checkbox') el.checked = !!h;
      else if (document.activeElement !== el) el.value = el.dataset.typ === 'text' ? (h ?? '') : String(h).replace('.', ',');
      el.classList.remove('spatne');
    }
    viditelnost();
  }
  for (const el of pole) {
    const akce = () => {
      const c = el.dataset.p;
      let h;
      if (el.type === 'checkbox') h = el.checked;
      else if (el.dataset.typ === 'text') h = el.value;
      else {
        h = K.cislo(el.value, NaN);
        el.classList.toggle('spatne', !Number.isFinite(h));
        if (!Number.isFinite(h)) return;
      }
      zmen(x => K.poloz(x, c, h), c);
    };
    el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', akce);
    if (el.tagName === 'INPUT' && el.type !== 'checkbox' && el.dataset.typ !== 'text') el.addEventListener('change', () => {
      // po potvrzení ukázat hodnotu, se kterou model počítá, a upozornit na omezení
      const psano = K.cislo(el.value, NaN), h = K.vezmi(p, el.dataset.p), rozsah = K.ROZSAHY[el.dataset.p];
      el.value = String(h).replace('.', ',');
      if (Number.isFinite(psano) && Math.abs(psano - h) > 1e-9 && rozsah) {
        el.classList.remove('zvyrazni'); void el.offsetWidth; el.classList.add('zvyrazni');
        Dialog.info(`${el.labels[0] ? el.labels[0].textContent : 'Hodnota'}: povoleno ${fmt(rozsah[0], 2)}–${fmt(rozsah[1], 2)}, použito ${fmt(h, 2)}.`);
      }
    });
  }
  for (const el of pole) if (el.tagName === 'INPUT' && el.type === 'text' && el.dataset.typ !== 'text') el.addEventListener('keydown', e => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    const h = K.cislo(el.value, NaN); if (!Number.isFinite(h)) return;
    e.preventDefault();
    const krok = (e.shiftKey ? 10 : e.altKey ? 0.1 : 1) * (e.key === 'ArrowUp' ? 1 : -1);
    el.value = fmt(Math.round((h + krok) * 1000) / 1000, 3);
    el.dispatchEvent(new Event('input'));
  });
  $('f_mat').innerHTML = Object.entries(K.MATERIALY).map(([k, m]) => `<option value="${k}">${m.nazev} – ${m.hustota} g/cm³</option>`).join('');

  // typ kostky: tlačítka
  const typy = $('typy');
  for (const [typ, t] of Object.entries(K.TYPY)) {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.typ = typ; b.title = t.nazev;
    b.innerHTML = `${typ === 'dpct' ? 'D%' : typ.toUpperCase()}<small>${t.nazev.replace(/^D\S+\s*/, '') || '&nbsp;'}</small>`;
    b.addEventListener('click', () => zmen(x => { x.kostka.typ = typ; }));
    typy.appendChild(b);
  }
  // sada: zaškrtávátka
  for (const typ of K.SADA_TYPY) {
    const l = document.createElement('label'); l.className = 'zaskrt';
    l.innerHTML = `<input type="checkbox" data-sada="${typ}"> ${typ === 'dpct' ? 'D%' : typ.toUpperCase()}`;
    l.querySelector('input').addEventListener('change', e => zmen(x => {
      const s = new Set(x.sada.typy); if (e.target.checked) s.add(typ); else s.delete(typ); x.sada.typy = K.SADA_TYPY.filter(t => s.has(t));
    }));
    $('sadaVolby').appendChild(l);
  }

  /** Které oddíly a pole dávají v daném režimu smysl. */
  function viditelnost() {
    const r = p.rezim, kostky = r === 'kostka' || r === 'sada', typ = p.kostka.typ;
    const d6 = (r === 'kostka' && typ === 'd6') || (r === 'sada' && p.sada.typy.includes('d6'));
    $('dKostka').hidden = !kostky; $('dZeton').hidden = r !== 'zetony'; $('dFigurka').hidden = r !== 'figurky';
    document.querySelectorAll('[data-pro="kostka"]').forEach(el => { el.hidden = r !== 'kostka'; });
    document.querySelectorAll('[data-pro="sada"]').forEach(el => { el.hidden = r !== 'sada'; });
    document.querySelectorAll('[data-pro="kostky"]').forEach(el => { el.hidden = !kostky; });
    for (const b of typy.children) b.setAttribute('aria-pressed', String(b.dataset.typ === typ));
    $('sadaVolby').querySelectorAll('input').forEach(i => { i.checked = p.sada.typy.includes(i.dataset.sada); });
    $('gTloustka').hidden = !(r === 'kostka' && typ === 'd2');
    $('gZnaceni').hidden = !d6;
    $('dTecky').hidden = !(d6 && p.kostka.znaceni === 'tecky');
    $('dVlastni').hidden = r !== 'kostka';
    $('dPismo').hidden = r === 'figurky'; $('pBezZnaceni').hidden = r !== 'figurky';
    $('gFtl').hidden = p.figurka.typ !== 'meeple';
    $('lFd').textContent = p.figurka.typ === 'meeple' ? 'Šířka' : 'Průměr podstavy';
    $('lZd').textContent = p.zeton.tvar === 'sestiuhelnik' ? 'Rozměr přes plochy' : 'Průměr';
    $('lZh').textContent = p.zeton.znaceni === 'vyryte' ? 'Hloubka' : 'Výška';
    const popisRoz = r === 'sada' ? 'Rozměr D6 (základ sady)' : typ === 'd2' ? 'Průměr mince' : typ === 'd4' ? 'Hrana čtyřstěnu' : 'Stěna – stěna';
    $('lRozmer').textContent = popisRoz;
    $('pRozmer').textContent = r === 'sada'
      ? `Ostatní kostky ze standardních poměrů: ${K.SADA_TYPY.map(t => `${t === 'dpct' ? 'D%' : t.toUpperCase()} ${fmt(p.kostka.rozmer * K.TYPY[t].sada, 1)}`).join(', ')} mm (D4 hrana, ostatní stěna–stěna).`
      : typ === 'd4' ? 'D4: rozměr je hrana ostrého čtyřstěnu, čísla jsou u vrcholů (platí číslo nahoře).'
        : typ === 'd2' ? 'D2: mince se dvěma čely, vlastní symboly v oddílu Značení (např. P / O).' : 'Rozměr = vzdálenost protilehlých stěn (u D6 hrana).';
    if (r === 'kostka') {
      const hod = typ === 'd4' ? [1, 2, 3, 4] : typ === 'd2' ? ['1. čelo', '2. čelo'] : K.cislovani(K.teleso(typ, 16)).map(c => c.text).sort((a, b) => +a - +b);
      $('lVlastni').textContent = `Řádek = stěna v pořadí: ${hod.join(', ')}`;
    }
  }

  /* ---------- písmo (opentype) a geometrické jádro ---------- */
  const pisma = new Map(); let font = null, fontId = null;
  async function nactiPismo(id) {
    if (!pisma.has(id)) pisma.set(id, FONTY.opentype(id));
    try { font = await pisma.get(id); fontId = id; }
    catch (e) {
      pisma.delete(id);
      if (id !== 'libsans') { Dialog.chyba(`Písmo se nenačetlo (${e.message || e}), použije se Liberation Sans.`); zmen(x => { x.pismo.id = 'libsans'; }); naplnFormular(); return nactiPismo('libsans'); }
      throw e;
    }
  }
  const tvary = new Map();
  function tvar(text, podtrzeni) {
    const kl = fontId + '|' + text + '|' + (podtrzeni ? 1 : 0);
    if (!tvary.has(kl)) tvary.set(kl, Object.assign(K.tvarTextu(font, text, podtrzeni), { klic: kl }));
    return tvary.get(kl);
  }
  if (typeof FONTY !== 'undefined') FONTY.seznam().then(sez => {
    const sel = $('f_font');
    sel.innerHTML = sez.filter(f => f.pro3d && (f.pismo || 'latinka') === 'latinka').map(f => `<option value="${f.id}">${f.nazev}${f.vlastni ? ' (vlastní)' : ''}</option>`).join('');
    sel.value = p.pismo.id;
  }).catch(() => { /* jen výchozí písmo */ });

  function nactiSkript(src) { return new Promise((ok, chyba) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => chyba(new Error('nelze načíst ' + src)); document.head.appendChild(s); }); }
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
  let wasm = null;

  /* ---------- přepočet ---------- */
  const nahled = KOSTKY3D_NAHLED.vytvorNahled($('platno'));
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  let casovac = null;
  function naplanuj() { clearTimeout(casovac); casovac = setTimeout(prepocitej, 90); }
  let rozlozeno = [];
  async function prepocitej() {
    const st = $('stav3d');
    if (!wasm) return;
    if (p.rezim !== 'figurky' && fontId !== p.pismo.id) { st.textContent = 'Načítám písmo…'; st.classList.remove('chyba'); await nactiPismo(p.pismo.id); }
    if (!font) return;
    nahled.barvy(css('--border-strong'));
    chybaStavby = null;
    try {
      const t0 = performance.now();
      plan = K.plan(p, tvar);
      geo = KOSTKY3D_GEO.postav(wasm, plan, p);
      hlaseni = K.kontroly(p, plan, geo);
      geo.cas = performance.now() - t0;
      rozlozeno = K.rozmisti(geo.kusy, p.tisk.mezera).map((x, i) => {
        const z = geo.kusy[i];
        return Object.assign(x, { zdroj: z.poz, posunZdroje: [x.poz[0] - z.poz[0], x.poz[1] - z.poz[1], x.poz[2] - z.poz[2]] });
      });
      nahled.nastav(rozlozeno);
      st.textContent = ''; st.classList.remove('chyba');
    } catch (e) {
      console.error(e);
      chybaStavby = e.message || String(e);
      geo = null; rozlozeno = []; nahled.nastav([]);
      hlaseni = [{ uroven: 'chyba', text: 'Model nelze sestavit: ' + chybaStavby, pole: [] }];
      st.textContent = 'Model nelze sestavit: ' + chybaStavby; st.classList.add('chyba');
    }
    vypis();
  }

  /* ---------- výsledky ---------- */
  const box = (popis, cislo, dalsi, tr) => `<div class="dlazdice"><div class="popis">${popis}</div><div class="cislo ${tr || ''}">${cislo}</div>${dalsi ? `<div class="dalsi">${dalsi}</div>` : ''}</div>`;
  const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const um = mm => `${fmt(mm * 1000, mm * 1000 < 10 ? 1 : 0)} µm`;
  /** Ke které stěně (popisku) míří posun těžiště. */
  function smer(k, v) {
    if (Math.hypot(...v) < 1e-7) return '—';
    if (k.typ === 'd4') { const i = k.T.V.reduce((m, q, j) => (K.vec.dot(q, v) > K.vec.dot(k.T.V[m], v) ? j : m), 0); return `k vrcholu ${i + 1}`; }
    const s = k.steny.reduce((m, q) => (K.vec.dot(q.n, v) > K.vec.dot(m.n, v) ? q : m));
    return `ke stěně ${s.cislo.text}`;
  }
  function vypis() {
    const kostky = plan ? plan.dily.filter(d => d.druh === 'kostka') : [];
    if (geo && rozlozeno.length) {
      const bb = K.obal(rozlozeno.reduce((a, x) => { const b = K.obal(x.poz); a.push(b[0], b[1], b[2], b[3], b[4], b[5]); return a; }, []));
      const objem = geo.kusy.reduce((a, x) => a + x.objem, 0);
      const od = K.odhad(objem, bb[5] - bb[2], p);
      const vadne = geo.site.filter(s => !s.uzavrena).length;
      const troj = rozlozeno.reduce((a, x) => a + x.idx.length / 3, 0);
      let h = box('Sestava na podložce', `${fmt(bb[3] - bb[0])} × ${fmt(bb[4] - bb[1])} × ${fmt(bb[5] - bb[2])} mm`, `${geo.kusy.length} ${geo.kusy.length === 1 ? 'díl' : geo.kusy.length < 5 ? 'díly' : 'dílů'}`)
        + box('Objem', `${fmt(objem / 1000, 2)} cm³`, '100 % výplň')
        + box('Hmotnost', `${fmt(od.gramu, 1)} g`, `${od.material}, filament ${fmt(od.metru, 2)} m (1,75 mm)`)
        + box('Doba tisku', od.minut < 90 ? `≈ ${fmt(od.minut, 0)} min` : `≈ ${fmt(od.minut / 60, 1)} h`, 'hrubý odhad')
        + box('Síť', vadne ? 'vadná' : 'uzavřená', `${troj.toLocaleString('cs-CZ')} trojúhelníků · ${fmt(geo.cas, 0)} ms`, vadne ? 'chyba-t' : 'ok-t');
      if (kostky.length === 1) {
        const k = kostky[0], s = geo.site.find(x => x.dil === k), hs = k.znacky.filter(z => z.druh === 'text').map(z => z.h);
        h += box('Kostka', `${fmt(s.kontrola.bbox[3] - s.kontrola.bbox[0])} × ${fmt(s.kontrola.bbox[4] - s.kontrola.bbox[1])} × ${fmt(s.kontrola.bbox[5] - s.kontrola.bbox[2])} mm`, `${k.nazev}, zaoblení ${fmt(k.r, 2)} mm`)
          + (hs.length ? box('Výška čísel', `${fmt(Math.min(...hs), 1)}${Math.max(...hs) - Math.min(...hs) > 0.05 ? '–' + fmt(Math.max(...hs), 1) : ''} mm`, `hloubka ${fmt(p.pismo.hloubka, 2)} mm`) : '')
          + box('Posun těžiště', um(s.posun), `bez vyrovnání ${um(k.tez0.velikost)}`, s.posun / k.rozmer > 0.001 ? 'mez-t' : 'ok-t');
      }
      $('vVysledky').innerHTML = h;
      $('sVysledky').textContent = `${fmt(od.gramu, 0)} g`;
    } else { $('vVysledky').innerHTML = chybaStavby ? box('Model', 'nelze sestavit', esc(chybaStavby), 'chyba-t') : ''; $('sVysledky').textContent = ''; }

    // těžiště
    const tab = $('tTeziste');
    if (kostky.length && geo) {
      tab.innerHTML = '<tr><th>Kostka</th><th class="c">Bez vyrovnání</th><th class="c">Nyní (výpočet)</th><th class="c">Na síti</th><th class="c">% rozměru</th><th>Směr</th></tr>'
        + kostky.map(k => {
          const s = geo.site.find(x => x.dil === k), rel = s.posun / k.rozmer * 100;
          return `<tr><td>${esc(k.nazev)}</td><td class="c">${um(k.tez0.velikost)}</td><td class="c">${um(k.tez.velikost)}</td><td class="c">${um(s.posun)}</td>`
            + `<td class="c ${rel > 0.1 ? 'mez-t' : 'ok-t'}">${fmt(rel, 3)} %</td><td>${smer(k, s.teziste)}</td></tr>`;
        }).join('');
      const mx = Math.max(...kostky.map(k => geo.site.find(x => x.dil === k).posun));
      $('sTeziste').textContent = um(mx);
    } else { tab.innerHTML = '<tr><td>Těžiště se počítá jen u kostek.</td></tr>'; $('sTeziste').textContent = ''; }
    $('sTisk').textContent = `${K.MATERIALY[p.tisk.material].nazev} · ${fmt(p.tisk.tryska, 2)}`;

    // souhrny oddílů
    const tt = t => (t === 'dpct' ? 'D%' : t.toUpperCase());
    TrubkyGui.souhrn('sKostka', p.rezim === 'sada' ? `${p.sada.typy.length} kostek` : `${tt(p.kostka.typ)} ${fmt(p.kostka.rozmer)} mm${p.kostka.kusu > 1 ? ` × ${p.kostka.kusu}` : ''}`);
    TrubkyGui.souhrn('sZeton', `${plan && plan.dily[0] && plan.dily[0].celkem || 0} ks`);
    TrubkyGui.souhrn('sFigurka', `${p.figurka.hracu} × ${p.figurka.kusu}`);
    TrubkyGui.souhrn('sPismo', `${fmt(p.pismo.velikost, 0)} % · ${fmt(p.pismo.hloubka, 2)} mm`);
    TrubkyGui.souhrn('sTecky', `Ø ${fmt(p.tecky.prumer, 1)} · ${fmt(p.tecky.hloubka, 1)}`);
    TrubkyGui.souhrn('sVlastni', p.kostka.vlastni.trim() ? 'zapnuto' : '', !!p.kostka.vlastni.trim());

    // hlášení
    const ul = $('hlaseni'); ul.innerHTML = '';
    for (const x of hlaseni) {
      const li = document.createElement('li'); li.className = x.uroven + (x.pole && x.pole.length ? ' skok' : '');
      li.textContent = x.text;
      if (x.pole && x.pole.length) {
        li.tabIndex = 0;
        const kam = document.createElement('span'); kam.className = 'kam'; kam.textContent = '→ upravit'; li.appendChild(kam);
        const jdi = () => jdiNaPole(x.pole[0]);
        li.addEventListener('click', e => { if (e.target.tagName !== 'BUTTON') jdi(); });
        li.addEventListener('keydown', e => { if (e.key === 'Enter') jdi(); });
      }
      if (x.oprava) {
        const b = document.createElement('button'); b.className = 'tl oprava'; b.textContent = '🔧 ' + x.oprava.text;
        b.addEventListener('click', () => { zmen(q => K.poloz(q, x.oprava.pole, x.oprava.hodnota)); naplnFormular(); });
        li.appendChild(b);
      }
      ul.appendChild(li);
    }
    const nch = hlaseni.filter(x => x.uroven === 'chyba').length, nv = hlaseni.filter(x => x.uroven === 'varovani').length;
    const o = $('stavOdznak');
    o.className = 'odznak ' + (nch ? 'chyba' : nv ? 'mez' : 'ok');
    o.textContent = nch ? `✖ ${nch}` : nv ? `⚠ ${nv}` : '✔';
    $('sKontrola').textContent = nch ? `${nch} ${nch === 1 ? 'chyba' : nch < 5 ? 'chyby' : 'chyb'}` : nv ? `${nv} varování` : 'v pořádku';
    if (chybaStavby) TrubkyGui.otevriZalozku('kontrola');
    karta(kostky);
  }
  function karta(kostky) {
    const el = $('karta3d');
    if (!geo) { el.innerHTML = ''; return; }
    if (kostky.length === 1) {
      const k = kostky[0], s = geo.site.find(x => x.dil === k);
      el.innerHTML = `<div class="titul">${esc(k.nazev)}</div><b>${fmt(k.rozmer)}</b> mm · těžiště <b>${um(s.posun)}</b><br>`
        + `${k.tecky ? 'tečky' : 'čísla'} ${p.vyrovnat ? 'vyrovnaná' : 'nevyrovnaná'} · převis ${fmt(k.previs, 0)}°`;
    } else el.innerHTML = `<div class="titul">${{ sada: 'Sada kostek', zetony: 'Žetony', figurky: 'Figurky', kostka: 'Kostky' }[p.rezim]}</div><b>${geo.kusy.length}</b> dílů na podložce`;
  }
  function jdiNaPole(cesta) {
    let el = document.querySelector(`[data-p="${cesta}"]`) || (cesta === 'sada.typy' ? $('sadaVolby') : null);
    if (!el) return;
    const det = el.closest('details'); if (det) det.open = true;
    const tel = el.closest('.zalozka-telo'); if (tel) TrubkyGui.otevriZalozku(tel.dataset.telo);
    const bx = el.closest('[data-box]'); TrubkyGui.ukazBox(bx ? bx.dataset.box : 'obecne');
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    if (el.focus) el.focus({ preventScroll: true });
    el.classList.remove('zvyrazni'); void el.offsetWidth; el.classList.add('zvyrazni');
  }

  /* ---------- nabídky, předvolby, export ---------- */
  TrubkyGui.pripoj({ klic: 'webapp_kostky3d_gui', pohled: j => nahled.pohled(j) });
  const seznam = $('seznamPredvoleb');
  for (const v of KOSTKY3D_PREDVOLBY) {
    const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
    b.innerHTML = `${v.nazev}<span class="pozn">${v.popis}</span>`;
    b.addEventListener('click', () => {
      zmen(x => { for (const [k, h] of Object.entries(K.kopie(v.p))) { if (h && typeof h === 'object') Object.assign(x[k], h); else x[k] = h; } });
      naplnFormular();
    });
    seznam.appendChild(b);
  }
  const jmenoSouboru = pripona => ((p.nazev || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/^_|_$/g, '') || 'kostky') + pripona;
  function stahni(data, nazev, typ) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type: typ }));
    a.download = nazev; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  const lzeExport = () => {
    if (!geo || !rozlozeno.length) { Dialog.chyba('Model není sestavený' + (chybaStavby ? ': ' + chybaStavby : ' – počkejte na načtení.')); return false; }
    if (hlaseni.some(h => /není uzavřená/.test(h.text))) { Dialog.chyba('Síť není uzavřená, export by nebyl tisknutelný.'); return false; }
    return true;
  };
  const dilyExportu = () => rozlozeno.map(x => ({ nazev: x.nazev, barva: x.barva, poz: x.poz, idx: x.idx }));
  function exportStl() { if (lzeExport()) stahni(KRAB.stlBinarni(dilyExportu(), 'kostky3d - github_site'), jmenoSouboru('.stl'), 'model/stl'); }
  $('btnStl').addEventListener('click', exportStl);
  $('btn3mf').addEventListener('click', () => { if (lzeExport()) stahni(KRAB.soubor3mf(dilyExportu(), p.nazev || 'Herní kostky'), jmenoSouboru('.3mf'), 'model/3mf'); });
  $('btnZip').addEventListener('click', () => {
    if (!lzeExport()) return;
    // jedinečné díly (kopie mají stejnou síť), každý na podložce ve středu
    const videno = new Map();
    for (const x of geo.kusy) if (!videno.has(x.idx)) videno.set(x.idx, x);
    const jmena = new Set();
    const polozky = [...videno.values()].map(x => {
      let jm = x.nazev.replace(/ \(?\d+\)?$/, '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_');
      while (jmena.has(jm)) jm += '_';
      jmena.add(jm);
      return { name: jm + '.stl', data: new Uint8Array(KRAB.stlBinarni(K.rozmisti([x], 0), x.nazev)) };
    });
    stahni(new Blob([KRAB.zip(polozky)], { type: 'application/zip' }), jmenoSouboru('_dily.zip'), 'application/zip');
  });
  $('btnPng').addEventListener('click', () => { fetch(nahled.png()).then(r => r.blob()).then(b => stahni(b, jmenoSouboru('.png'))); });
  $('btnUlozit').addEventListener('click', () => stahni(K.ulozProjekt(p), jmenoSouboru('.json'), 'application/json'));
  $('btnNacist').addEventListener('click', () => $('soubor').click());
  $('soubor').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try {
      const r = K.nactiProjekt(await f.text());
      nahradVse(r.p); naplnFormular();
      Dialog.info(r.hlaseni.length ? `Projekt načten s úpravami: ${r.hlaseni.join('; ')}.` : 'Projekt načten.');
    } catch (err) { Dialog.chyba(err.message); }
  });
  $('btnVychozi').addEventListener('click', async () => {
    if (!await Dialog.potvrd('Vrátit všechny parametry na výchozí hodnoty?')) return;
    nahradVse(K.normalizuj({}).p); naplnFormular();
  });
  $('btnZpet').addEventListener('click', () => krokHistorie(zpet, znovu));
  $('btnZnovu').addEventListener('click', () => krokHistorie(znovu, zpet));
  for (const [id, co] of [['tRyti', 'barvaRyti'], ['tHrany', 'hrany']]) $(id).addEventListener('click', () => {
    const b = $(id), h = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', String(h)); nahled.prepni(co, h);
  });
  $('stavOdznak').addEventListener('click', () => TrubkyGui.otevriZalozku('kontrola'));
  $('btnZavritNap').addEventListener('click', () => $('napoveda').close());
  document.addEventListener('keydown', e => {
    const a = document.activeElement;
    const vPoli = a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || (a.tagName === 'INPUT' && !/checkbox|range|radio|button/.test(a.type));
    if ((e.ctrlKey || e.metaKey) && !vPoli && e.key.toLowerCase() === 'z') { e.preventDefault(); krokHistorie(e.shiftKey ? znovu : zpet, e.shiftKey ? zpet : znovu); return; }
    if ((e.ctrlKey || e.metaKey) && !vPoli && e.key.toLowerCase() === 'y') { e.preventDefault(); krokHistorie(znovu, zpet); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); exportStl(); return; }
    if (e.key === 'F1') { e.preventDefault(); $('napoveda').showModal(); return; }
    if (vPoli || e.ctrlKey || e.metaKey || e.altKey || $('napoveda').open) return;
    const k = e.key.toLowerCase();
    if (k === '1') nahled.pohled('iso'); else if (k === '2') nahled.pohled('shora'); else if (k === '3') nahled.pohled('zboku');
    else if (k === 'b') $('tRyti').click(); else if (k === 'h') $('tHrany').click();
  });
  new MutationObserver(() => { nahled.barvy(css('--border-strong')); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  if (typeof Tvary !== 'undefined') Tvary.pripoj({
    klic: 'webapp_kostky3d_tvary', typ: 'kostky3d', nazev: 'Herní kostky', kontejner: $('tvary'),
    parametry: () => K.kopie(p),
    pouzij: q => { nahradVse(K.normalizuj(q).p); naplnFormular(); },
    popis: q => `${q.nazev || 'Návrh'} – ${{ kostka: 'kostka', sada: 'sada', zetony: 'žetony', figurky: 'figurky' }[q.rezim] || ''}`,
  });

  /* ---------- start ---------- */
  p = nactiUlozeny();
  naplnFormular();
  vypis();
  Promise.all([nactiManifold(), nactiPismo(p.pismo.id)]).then(([w]) => { wasm = w; prepocitej(); }).catch(e => {
    const st = $('stav3d'); st.textContent = 'Geometrické jádro (manifold-3d) nebo písmo se nenačetlo: ' + (e && e.message || e); st.classList.add('chyba');
    chybaStavby = 'manifold-3d nebo písmo se nenačetlo – model ani export nejsou k dispozici.';
    hlaseni = [{ uroven: 'chyba', text: chybaStavby, pole: [] }];
    vypis();
  });
  // pro testy
  window.__kostky3d = { nahled, get p() { return p; }, get plan() { return plan; }, get geo() { return geo; }, get hlaseni() { return hlaseni; }, zmen, naplnFormular, prepocitej };
})();

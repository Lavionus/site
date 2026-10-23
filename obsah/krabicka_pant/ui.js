/* Krabička s víčkem na pantu – ovládání stránky: formulář ↔ projekt, tažení úchytů, přestavba modelu,
   kontrola sítí a pohybu, exporty (STL, 3MF, ZIP, měrka vůlí), text na víku, odhad tisku,
   uložené návrhy (tvary.js), JSON, zpět/znovu. */
/* global KRAB, KPANT, KPANT_GEO, KPANT_NAHLED, Dialog, Tvary, FONTY */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const KLIC = 'webapp_krabicka_pant_projekt';
  const fmt = KPANT.fmt;
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const OSY = { x: 'vnitrni.delka', y: 'vnitrni.sirka', z: 'vnitrni.vyska' };
  const BARVY = { krabicka: '#4F86D9', viko: '#E0A63F', chlopen: '#4CAF7A', vlozka: '#A77BD6', cepPant: '#D8D8D8', cepZap: '#D8D8D8' };

  /* ---------- stav ---------- */
  let p = null, hlaseniVstupu = [], wasm = null, model = null, chybaStavby = null, vysledekPohybu = null;
  const historie = [], budoucnost = [];
  function nactiUlozeny() {
    try { const s = localStorage.getItem(KLIC); if (s) return KPANT.nactiProjekt(s).p; } catch (e) { /* poškozený záznam */ }
    return KPANT.normalizuj(KPANT.VYCHOZI).p;
  }
  function ulozMistne() { try { localStorage.setItem(KLIC, KPANT.ulozProjekt(p)); } catch (e) { /* plné úložiště */ } }

  /* ---------- 3D náhled ---------- */
  let nahled = null;
  try {
    nahled = KPANT_NAHLED.vytvorNahled($('platno'), {
      hodnoty: () => ({ x: p.vnitrni.delka, y: p.vnitrni.sirka, z: p.vnitrni.vyska }),
      priTazeni,
    });
  } catch (e) {
    $('stav3d').textContent = 'WebGL není k dispozici – náhled nejde zobrazit, generování a export fungují dál.';
    $('stav3d').classList.add('chyba');
  }
  function priTazeni(osa, h, konec) {
    zmen(q => poloz(q, OSY[osa], h), 'tah-' + osa, !konec);
    if (konec) posledniKlic = null;   // další tažení = nový krok zpět
    const el = document.querySelector(`[data-p="${OSY[osa]}"]`);
    if (el) { el.value = zobrazCislo(vezmi(p, OSY[osa])); el.classList.remove('spatne'); }
  }

  /* ---------- manifold ---------- */
  function nactiSkript(src) {
    return new Promise((ok, chyba) => {
      const el = document.createElement('script'); el.src = src; el.onload = ok;
      el.onerror = () => chyba(new Error('nejde načíst ' + src)); document.head.appendChild(el);
    });
  }
  async function nactiManifold() {
    globalThis.MANIFOLD_URL = new URL('lib/manifold/manifold.klasicky.js', location.href).href;
    if (!globalThis.ManifoldModule) await nactiSkript('lib/manifold/manifold.klasicky.js');
    let volby;
    if (location.protocol === 'file:') {
      // z file:// prohlížeč .wasm nestáhne – vezme se z base64
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

  /* ---------- text na víku: opentype.js a písmo se načtou až při prvním použití ---------- */
  let textData = null, textNacita = null;            // textData = {klic, obrysy, rozmer}
  const klicTextu = () => `${p.text.pismo}|${p.text.obsah.trim()}|${p.text.velikost}`;
  const textModel = () => (textData && textData.klic === klicTextu() ? textData : null);
  async function pripravText() {
    const klic = klicTextu();
    if (!p.text.obsah.trim()) { $('stavTextu').textContent = ''; return; }
    if (textModel() || textNacita === klic) return;
    textNacita = klic; $('stavTextu').textContent = 'Načítám písmo…';
    try {
      if (!window.opentype) await nactiSkript('lib/opentype.min.js');
      const font = await FONTY.opentype(p.text.pismo);
      const r = KPANT.textNaObrysy(font, p.text.obsah.trim(), p.text.velikost);
      textData = { klic, obrysy: r.obrysy, rozmer: r.rozmer };
    } catch (e) {
      $('stavTextu').textContent = 'Písmo se nenačetlo: ' + (e && e.message || e);
      textNacita = null; return;
    }
    textNacita = null;
    if (klic === klicTextu()) naplanuj();
  }
  const doplnky = () => { const tm = textModel(); return tm ? { textRozmer: tm.rozmer } : {}; };
  const kontrolyNavrhu = () => KPANT.kontroly(p, KPANT.odvozene(p), doplnky());
  if (typeof FONTY !== 'undefined') FONTY.seznam().then(sez => {
    const sel = $('f_tp');
    sel.innerHTML = sez.filter(f => f.pro3d !== false && (!f.pismo || f.pismo === 'latinka'))
      .map(f => `<option value="${esc(f.id)}">${esc(f.nazev)}</option>`).join('');
    sel.value = p.text.pismo;
  }).catch(() => { /* zůstane výchozí písmo */ });

  /* ---------- formulář ---------- */
  const vezmi = (o, c) => c.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  function poloz(o, c, h) { const k = c.split('.'); const l = k.pop(); k.reduce((a, x) => a[x], o)[l] = h; }
  const zobrazCislo = x => (Number.isFinite(x) ? String(Math.round(x * 1e4) / 1e4).replace('.', ',') : '');
  const ctiCislo = s => { const t = String(s).trim().replace(/\s/g, '').replace(',', '.').replace('−', '-'); return t === '' ? NaN : Number(t); };

  function naplnFormular() {
    document.querySelectorAll('[data-p]').forEach(el => {
      const h = vezmi(p, el.dataset.p);
      if (el.dataset.typ === 'bool') el.checked = !!h;
      else if (el.dataset.typ === 'text') el.value = h == null ? '' : h;
      else el.value = zobrazCislo(h);
      el.classList.remove('spatne');
    });
    viditelnost();
  }
  document.querySelectorAll('[data-p]').forEach(el => {
    const udalost = el.tagName === 'SELECT' || el.type === 'checkbox' ? 'change' : 'input';
    el.addEventListener(udalost, () => {
      let h;
      if (el.dataset.typ === 'bool') h = el.checked;
      else if (el.dataset.typ === 'text') h = el.value;
      else {
        h = ctiCislo(el.value);
        if (!Number.isFinite(h)) { el.classList.add('spatne'); return; }
        el.classList.remove('spatne');
      }
      zmen(q => {
        poloz(q, el.dataset.p, h);
        if (el.dataset.p === 'cep.druh' && h === 'plast') prizpusobPlastu(q);
      }, el.dataset.p);
      if (el.dataset.p === 'cep.druh') naplnFormular();
    });
    if (!el.dataset.typ) el.addEventListener('change', () => { if (!el.classList.contains('spatne')) el.value = zobrazCislo(vezmi(p, el.dataset.p)); });
  });
  /* Tištěný čep pod 2,5 mm je křehký: při přepnutí se zvětší čep a podle potřeby i články (stěna ≥ 1,2 mm). */
  function prizpusobPlastu(q) {
    if (q.cep.prumer >= 2.5) return;
    q.cep.prumer = 3;
    const rd = q.cep.prumer / 2 + q.cep.vule, potreba = Math.ceil((2 * (rd * (q.cep.slza ? Math.SQRT2 : 1) + 1.2)) * 5) / 5;
    if (q.pant.prumer < potreba) q.pant.prumer = potreba;
    q.cep.hlavaD = Math.max(q.cep.hlavaD, q.cep.prumer + 2);
    hlaseniPrepnuti = `Pro tištěný čep zvětšen průměr čepu na 3 mm` + (q.pant.prumer === potreba ? ` a článku na ${fmt(potreba)} mm.` : '.');
  }
  let hlaseniPrepnuti = null;

  function viditelnost() {
    $('gZap').hidden = $('napZap').hidden = $('lChlopen').hidden = $('lTreni').hidden = $('tolZap').hidden = $('gSadaChl').hidden = !(p.zapinani.pocet || p.zapinani.boky);
    $('btnSadaChl').disabled = !(p.zapinani.pocet || p.zapinani.boky);
    $('gVlozka').hidden = p.prihradky.typ !== 'vlozka';
    $('gMagnety').hidden = !(p.magnety.zavirani || p.magnety.stohovani);
    $('f_prx').disabled = !!p.prihradky.pomeryDelka; $('f_pry').disabled = !!p.prihradky.pomerySirka;
    $('gOsazeni').hidden = !p.viko.osazeni;
    $('gPlast').hidden = p.cep.druh !== 'plast';
    $('gTesny').hidden = !p.cep.tesnyKonec;
  }

  /* ---------- změny, zpět/znovu ---------- */
  let posledniKlic = null, posledniCas = 0;
  function zmen(fn, klic, rychle) {
    const pred = JSON.stringify(p);
    hlaseniPrepnuti = null;
    const q = KPANT.kopie(p); fn(q);
    const r = KPANT.normalizuj(q);
    if (JSON.stringify(r.p) === pred) return;
    // souvislé psaní do jednoho pole i celé tažení úchytu = jeden krok zpět
    const now = Date.now();
    const pokracuje = klic && klic === posledniKlic && (now - posledniCas < 1500 || String(klic).startsWith('tah'));
    if (!pokracuje) { historie.push(pred); if (historie.length > 100) historie.shift(); }
    posledniKlic = klic; posledniCas = now;
    budoucnost.length = 0;
    p = r.p; hlaseniVstupu = r.hlaseni;
    viditelnost();
    naplanuj(rychle);
  }
  function obnov(stav) { p = JSON.parse(stav); posledniKlic = null; naplnFormular(); naplanuj(); }
  function zpet() { if (!historie.length) return; budoucnost.push(JSON.stringify(p)); obnov(historie.pop()); }
  function znovu() { if (!budoucnost.length) return; historie.push(JSON.stringify(p)); obnov(budoucnost.pop()); }
  $('btnZpet').onclick = zpet; $('btnZnovu').onclick = znovu;
  $('btnVychozi').onclick = async () => {
    if (!(await Dialog.potvrd('Vrátit všechny parametry na výchozí hodnoty? (Krok jde vrátit tlačítkem Zpět.)'))) return;
    zmen(q => { Object.keys(q).forEach(x => delete q[x]); Object.assign(q, KPANT.kopie(KPANT.VYCHOZI)); }, 'vychozi');
    naplnFormular();
  };

  let casovac = null, casovacPohybu = null, pohledPoStavbe = null;
  /* Při tažení se model přestavuje průběžně (nejvýš každých 60 ms), jinak 160 ms po poslední změně. */
  function naplanuj(rychle) {
    $('btnZpet').disabled = !historie.length; $('btnZnovu').disabled = !budoucnost.length;
    clearTimeout(casovacPohybu);
    if (rychle) { if (!casovac) casovac = setTimeout(prestav, 60); }
    else { clearTimeout(casovac); casovac = setTimeout(prestav, 160); }
    souhrny();
  }

  /* ---------- přestavba ---------- */
  function prestav() {
    casovac = null;
    ulozMistne();
    if (!wasm) { vypisHlaseni(); return; }
    const stav = $('stav3d');
    try {
      pripravText();
      const tm = textModel();
      const r = KPANT_GEO.postav(wasm, p, { text: tm ? tm.obrysy : null });
      const o = KPANT.odvozene(p);
      model = { dily: r.dily, cas: r.cas, kontroly: r.dily.map(d => KRAB.kontrolaSite(d.poz, d.idx)), odv: o };
      chybaStavby = null;
      stav.textContent = ''; stav.classList.remove('chyba');
      if (nahled) nahled.nastavDily(model.dily, o, {
        x: `Délka ${fmt(p.vnitrni.delka)} mm`, y: `Šířka ${fmt(p.vnitrni.sirka)} mm`, z: `Výška ${fmt(p.vnitrni.vyska)} mm`,
      }, p.cep.druh === 'kov');
      if (nahled && pohledPoStavbe) { nahled.pohled(pohledPoStavbe); pohledPoStavbe = null; }
    } catch (e) {
      chybaStavby = String(e && e.message || e);
      model = null;
      stav.textContent = 'Model nejde sestavit: ' + chybaStavby; stav.classList.add('chyba');
    }
    vysledekPohybu = null;
    vypisVysledky(); vypisHlaseni(); vypisPohyb(); vypisExport();
    if (model && !(nahled && nahled.tahne())) casovacPohybu = setTimeout(overPohyb, 350);
  }

  function overPohyb() {
    if (!model || !wasm) return;
    try { vysledekPohybu = KPANT_GEO.pohyb(wasm, p); } catch (e) { vysledekPohybu = { chyba: String(e && e.message || e) }; }
    vypisPohyb();
  }

  function souhrny() {
    const o = KPANT.odvozene(p);
    $('sRozmery').textContent = `${fmt(o.Lo)} × ${fmt(o.Wo)} × ${fmt(o.Hb + o.tv)} mm`;
    $('vnejsiRozmery').textContent = `Vnější rozměry ${fmt(o.Lo, 2)} × ${fmt(o.Wo, 2)} × ${fmt(o.Hb + o.tv, 2)} mm (bez pantu a zapínání), `
      + `s pantem a chlopněmi ${fmt(o.celkem[0], 1)} × ${fmt(o.celkem[1], 1)} mm.`;
    $('sViko').textContent = `${fmt(p.viko.tloustka)} mm` + (p.viko.osazeni ? ', s osazením' : '');
    $('sPant').textContent = `${p.pant.pocet}× ${fmt(o.pant.L)} mm, ${p.pant.clanku} článků` + (o.pant.zarazka ? `, zarážka ${fmt(o.pant.zarazka.uhel)}°` : '');
    $('sCep').textContent = `${p.cep.druh === 'kov' ? 'kovový' : 'tištěný'} Ø ${fmt(p.cep.prumer, 2)} mm`;
    const z = p.zapinani;
    $('sZap').textContent = z.pocet || z.boky ? [z.pocet ? `${z.pocet}× vpředu` : '', z.boky ? `${z.boky}× na bocích` : ''].filter(Boolean).join(', ') : 'bez zapínání';
    // rozbor tolerance zapínání
    if (o.zap.pocet) {
      const t = KPANT.toleranceZapinani(p);
      const slovo = { ok: ['ok-t', '✓ v pořádku'], volne: ['chyba-t', '⚠ příliš volné – může vyskočit'], tesne: ['mez-t', '⚠ příliš těsné – nemusí zapadnout'] }[t.verdikt];
      $('tolZap').innerHTML = `<div class="popis">Tolerance zapínání</div><div class="cislo ${slovo[0]}">${slovo[1]}</div>`
        + `<div class="dalsi">Záběr ${fmt(t.zaber, 2)} mm, s vůlí čepů nejhůř ${fmt(t.zaberMin, 2)} mm (doporučeno ≥ 0,3) · `
        + `víko se zvedne o ${fmt(t.hra, 2)} mm, než chlopeň zabere · vůle okénka ${fmt(p.zapinani.vule, 2)} mm (doporučeno ≥ 0,15).<br>`
        + `Po tisku moc volné → doladění +0,1 až +0,2 mm; moc tuhé → vůle okénka +0,1 mm nebo doladění −0,1 mm. Mění se jen chlopeň.</div>`;
    }
    const pr = o.prihradky;
    $('sPrihradky').textContent = (pr.ma ? `${pr.pocetX} × ${pr.pocetY}` : 'nedělené') + (pr.typ === 'vlozka' ? ', vložka' : '');
    $('rozmerPrihradky').textContent = pr.ma ? `Nejmenší přihrádka ${fmt(pr.sirkaX, 1)} × ${fmt(pr.sirkaY, 1)} mm, přepážky vysoké ${fmt(pr.vyska, 1)} mm.` : '';
    $('sMagnety').textContent = [p.magnety.zavirani ? 'zavírání' : '', p.magnety.stohovani ? 'stohování' : ''].filter(Boolean).join(' + ') || 'bez';
    $('sText').textContent = p.text.obsah.trim() ? `„${p.text.obsah.trim().slice(0, 14)}${p.text.obsah.trim().length > 14 ? '…' : ''}“` : 'bez';
  }

  function vypisVysledky() {
    const el = $('vysledky');
    if (!model) { el.innerHTML = `<div class="box"><div class="popis">Stav</div><div class="cislo chyba-t">${wasm ? 'Chyba stavby' : 'Načítám…'}</div></div>`; return; }
    const o = model.odv;
    let h = `<div class="box"><div class="popis">Celkové rozměry</div><div class="cislo">${fmt(o.celkem[0])} × ${fmt(o.celkem[1])} × ${fmt(o.celkem[2])}</div><div class="dalsi">mm (X × Y × Z, zavřená sestava)</div></div>`;
    model.dily.forEach((d, i) => {
      if (!d.tisk) return;
      const c = model.kontroly[i], ok = c.uzavrena && c.normalyVen && c.teles === 1 && c.dutin === 0;
      const g = d.objem / 1000 * 1.24;
      h += `<div class="box"><div class="popis">${esc(d.nazev)}${d.kusu > 1 ? ` × ${d.kusu}` : ''}</div><div class="cislo ${ok ? 'ok-t' : 'chyba-t'}">${ok ? '✓ tisknutelné' : '✗ problém'}</div>`
        + `<div class="dalsi">${c.uzavrena ? 'uzavřená síť' : `<span class="chyba-t">otevřená síť (${c.hranOkrajovych} okr. hran)</span>`} · `
        + `${c.teles} těleso${c.teles > 1 ? ' <span class="chyba-t">(víc těles!)</span>' : ''} · otvorů ${c.rod}<br>`
        + `${c.trojuhelniku.toLocaleString('cs-CZ')} trojúhelníků · ${fmt(d.objem / 1000, 2)} cm³ ≈ ${fmt(g, 1)} g PLA (100 % výplň)</div></div>`;
    });
    h += `<div class="box"><div class="popis">Výpočet</div><div class="cislo">${model.cas} ms</div><div class="dalsi">manifold-3d, ${p.segmenty} segmentů na kružnici</div></div>`;
    el.innerHTML = h;
  }

  function vypisHlaseni() {
    const sez = [];
    if (chybaStavby) sez.push({ uroven: 'chyba', text: 'Geometrie: ' + chybaStavby });
    if (hlaseniPrepnuti) sez.push({ uroven: 'info', text: hlaseniPrepnuti, pole: ['cep.prumer', 'pant.prumer'] });
    // „cesta: …“ na začátku opravy vstupu = pole, kterého se týká
    for (const t of hlaseniVstupu) sez.push({ uroven: 'varovani', text: 'Vstup opraven – ' + t, pole: [String(t).split(':')[0]] });
    if (model) model.kontroly.forEach((c, i) => {
      const jm = model.dily[i].nazev;
      if (!c.uzavrena) sez.push({ uroven: 'chyba', text: `${jm}: síť není uzavřená – export se nedoporučuje.` });
      if (c.teles > 1) sez.push({ uroven: 'chyba', text: `${jm}: obsahuje ${c.teles} oddělená tělesa – zkontrolujte rozměry.` });
    });
    sez.push(...kontrolyNavrhu());
    const poradi = { chyba: 0, varovani: 1, info: 2 };
    sez.sort((a, b) => poradi[a.uroven] - poradi[b.uroven]);
    if (!sez.some(h => h.uroven !== 'info')) sez.unshift({ uroven: 'ok', text: 'Bez chyb a varování.' });
    vypisSeznam('hlaseni', sez);
  }
  const seznamy = { hlaseni: [], pohyb: [] };
  const poleFormulare = c => document.querySelector(`[data-p="${c}"]`);
  const popisPole = c => { const el = poleFormulare(c), l = el && document.querySelector(`label[for="${el.id}"]`); return l ? l.textContent.trim() : c; };
  const zobrazHodnotu = h => (typeof h === 'boolean' ? (h ? 'zapnuto' : 'vypnuto') : typeof h === 'number' ? fmt(h, 2) : ({ pevne: 'pevné přepážky' }[h] || h));
  function vypisSeznam(id, sez) {
    const ikona = { chyba: '⛔ ', varovani: '⚠️ ', info: 'ℹ️ ', ok: '✓ ' };
    $(id).innerHTML = sez.map((h, i) => {
      const pole = (h.pole || []).filter(c => poleFormulare(c));
      if (!pole.length) return `<li class="${h.uroven}">${ikona[h.uroven]}${esc(h.text)}</li>`;
      const kam = pole.map(popisPole).join(', ');
      const oprava = h.oprava && poleFormulare(h.oprava.pole)
        ? ` <button class="tl oprava" data-oprava="${i}" title="Nastaví ${esc(popisPole(h.oprava.pole))} na ${esc(zobrazHodnotu(h.oprava.hodnota))}">🔧 ${esc(popisPole(h.oprava.pole))} → ${esc(zobrazHodnotu(h.oprava.hodnota))}</button>` : '';
      return `<li class="${h.uroven} skok" tabindex="0" role="button" data-skok="${i}" title="Přejít na: ${esc(kam)}">${ikona[h.uroven]}${esc(h.text)}`
        + `<span class="kam">→ ${esc(kam)}</span>${oprava}</li>`;
    }).join('');
    seznamy[id] = sez;
    // odznak v liště: počet chyb a varování ze všech kontrol
    const vse = [...seznamy.hlaseni, ...seznamy.pohyb];
    const ch = vse.filter(h => h.uroven === 'chyba').length, va = vse.filter(h => h.uroven === 'varovani').length;
    const od = $('stavOdznak');
    od.className = 'tl odznak ' + (ch ? 'chyba' : va ? 'mez' : 'ok');
    od.textContent = ch ? `⛔ ${ch}` : va ? `⚠️ ${va}` : '✓';
    od.title = (ch || va ? `${ch} chyb, ${va} varování` : 'Bez chyb a varování') + ' – otevře Kontrolu modelu';
    $('sKontrola').textContent = ch || va ? `${ch} ⛔ · ${va} ⚠️` : '✓';
  }

  /* ---------- skok z hlášení na pole: otevře panel a sekci, odroluje, zaměří a krátce zvýrazní ---------- */
  function jdiNaPole(pole) {
    const prvky = pole.map(poleFormulare).filter(Boolean);
    if (!prvky.length) return;
    nastavPanel(true);
    for (const el of prvky) { const d = el.closest('details'); if (d) d.open = true; }
    prvky[0].scrollIntoView({ block: 'center', behavior: 'smooth' });
    prvky[0].focus({ preventScroll: true });
    for (const el of prvky) { el.classList.remove('zvyrazni'); void el.offsetWidth; el.classList.add('zvyrazni'); }
    setTimeout(() => prvky.forEach(el => el.classList.remove('zvyrazni')), 2600);
  }
  for (const id of ['hlaseni', 'pohyb']) {
    $(id).addEventListener('click', e => {
      const bo = e.target.closest('[data-oprava]');
      if (bo) {
        const h = seznamy[id][+bo.dataset.oprava];
        if (!h || !h.oprava) return;
        zmen(q => poloz(q, h.oprava.pole, h.oprava.hodnota), 'oprava');
        naplnFormular();
        jdiNaPole([h.oprava.pole]);
        return;
      }
      const li = e.target.closest('[data-skok]');
      if (li) jdiNaPole(seznamy[id][+li.dataset.skok].pole);
    });
    $(id).addEventListener('keydown', e => {
      const li = e.target.closest('[data-skok]');
      if (li && (e.key === 'Enter' || e.key === ' ') && e.target === li) { e.preventDefault(); jdiNaPole(seznamy[id][+li.dataset.skok].pole); }
    });
  }

  function vypisPohyb() {
    const v = vysledekPohybu;
    if (!model) { vypisSeznam('pohyb', []); return; }
    if (!v) { vypisSeznam('pohyb', [{ uroven: 'info', text: 'Ověřuji pohyb víka a chlopní…' }]); return; }
    if (v.chyba) { vypisSeznam('pohyb', [{ uroven: 'chyba', text: 'Kontrolu pohybu nejde spočítat: ' + v.chyba }]); return; }
    const sez = [];
    const kolize = (s, co, plny, pole) => {
      if (s.max === null) return { uroven: 'chyba', text: `${co} koliduje už v zavřené poloze (průnik ${fmt(s.vzorky[0][1], 2)} mm³).`, pole };
      if (s.max >= plny) return { uroven: 'ok', text: `${co} se otevře až o ${s.max}° bez kolize.` };
      const dalsi = s.vzorky[s.vzorky.length - 1];
      return { uroven: s.max >= 90 ? 'varovani' : 'chyba', text: `${co} se otevře jen do ${s.max}°, při ${dalsi[0]}° narazí (průnik ${fmt(dalsi[1], 2)} mm³).`, pole };
    };
    if (v.viko.zarazka && v.viko.max !== null) {
      // se zarážkou má víko narazit kousek za zadaným úhlem
      const ok = v.viko.max >= v.viko.zarazka - 10;
      sez.push({ uroven: ok ? 'ok' : 'varovani', text: ok ? `Víko se otevře do ${v.viko.max}° a zastaví se o zarážku.`
        : `Víko narazí už při ${v.viko.vzorky[v.viko.vzorky.length - 1][0]}°, dřív než na zarážku (${fmt(v.viko.zarazka)}°).` });
    } else sez.push(kolize(v.viko, 'Víko', 180, ['prihradky.vyska', 'viko.vyskaOsazeni', 'pant.odstup', 'pant.prumer']));
    if (!v.chlopen) {
      sez.push({ uroven: 'info', text: `Bez zapínání – výpočet průniků ${v.cas} ms.` });
      vypisSeznam('pohyb', sez); return;
    }
    sez.push(kolize(v.chlopen, 'Chlopeň zapínání', 120, ['zapinani.odstup', 'zapinani.dolad', 'zapinani.tloustka']));
    sez.push(v.cepVChlopni > 0.01
      ? { uroven: 'chyba', text: `Čep zapínání se v chlopni dře (průnik ${fmt(v.cepVChlopni, 2)} mm³) – zvětšete vůli.`, pole: ['cep.vule', 'zapinani.treni'] }
      : { uroven: 'ok', text: 'Čepy se v pohyblivých článcích otáčejí s vůlí.' });
    if (v.drzi) sez.push({ uroven: 'ok', text: `Zapínání drží: při pootevření víka o ${fmt(v.zdvih, 2)}° se příčka chlopně zapře o výstupek.`
      + (v.uvolneni ? ` Víko se uvolní po odklopení chlopně o ${v.uvolneni}°.` : '') });
    else sez.push({ uroven: 'chyba', text: 'Zapínání nedrží – zavřená chlopeň se při zvednutí víka o výstupek nezapře (zvětšete přesah výstupku nebo doladění záběru).',
      pole: ['zapinani.presah', 'zapinani.dolad', 'zapinani.vule'], oprava: { pole: 'zapinani.dolad', hodnota: Math.min(p.zapinani.odstup - 0.1, Math.round((p.zapinani.dolad + 0.2) * 100) / 100) } });
    if (v.drzi && !v.uvolneni) sez.push({ uroven: 'varovani', text: 'Chlopeň se ani po odklopení o 45° z výstupku neuvolní.', pole: ['zapinani.presah', 'zapinani.dolad'] });
    sez.push({ uroven: 'info', text: `Výpočet průniků ${v.cas} ms (víko po 15° do 180°, chlopně po 15° do 120°).` });
    vypisSeznam('pohyb', sez);
  }

  /* ---------- export ---------- */
  function stahni(data, jmeno, typ) {
    const url = URL.createObjectURL(new Blob([data], { type: typ }));
    const a = document.createElement('a'); a.href = url; a.download = jmeno; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  const slug = () => (p.nazev || 'krabicka').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').toLowerCase() || 'krabicka';
  const tiskoveDily = () => model.dily.filter(d => d.tisk);

  async function pripravExport(dily) {
    if (!model) { Dialog.chyba('Model není sestavený.'); return false; }
    const i = d => model.dily.indexOf(d);
    if (dily.some(d => !model.kontroly[i(d)].uzavrena || !model.kontroly[i(d)].normalyVen)) { Dialog.chyba('Síť neprošla kontrolou těsnosti – export zablokován.'); return false; }
    const chyby = kontrolyNavrhu().filter(h => h.uroven === 'chyba').length;
    if (chyby && !(await Dialog.potvrd(`Návrh má ${chyby} chyb v kontrolách (viz Hlášení). Přesto exportovat?`))) return false;
    return true;
  }
  /** Všechny kusy (chlopně a čepy zapínání tolikrát, kolik jich je) s pořadovým názvem. */
  function vsechnyKusy() {
    const out = [];
    for (const d of tiskoveDily()) for (let i = 0; i < d.kusu; i++) out.push(Object.assign({}, d, { nazev: d.kusu > 1 ? `${d.nazev} ${i + 1}` : d.nazev, barva: BARVY[d.jmeno] }));
    return out;
  }
  function vypisExport() {
    const el = $('exportDily');
    if (!model) { el.innerHTML = ''; return; }
    el.innerHTML = tiskoveDily().map(d => `<button class="tl" role="menuitem" data-stl="${d.jmeno}">⬇ ${esc(d.nazev)}${d.kusu > 1 ? ` (tisknout ${d.kusu}×)` : ''}</button>`).join('');
    $('kusovnik').innerHTML = KPANT.kusovnik(p).map(r => `<tr><td>${esc(r.co)}</td><td class="ks">${r.ks}</td><td>${esc(r.tisk)}</td></tr>`).join('');
    // odhad tisku (všechny kusy)
    const suma = { g: 0, m: 0, min: 0 };
    const cas = min => (min >= 60 ? `${Math.floor(min / 60)} h ${Math.round(min % 60)} min` : `${Math.max(1, Math.round(min))} min`);
    const radky = tiskoveDily().map(d => {
      const e = KPANT.odhadTisku(d.objem, model.kontroly[model.dily.indexOf(d)].plocha, p.tisk);
      suma.g += e.g * d.kusu; suma.m += e.m * d.kusu; suma.min += e.min * d.kusu;
      return `<tr><td>${esc(d.nazev)}</td><td class="ks">${d.kusu}</td><td>${fmt(e.g * d.kusu, 1)} g</td><td>${fmt(e.m * d.kusu, 2)} m</td><td>${cas(e.min * d.kusu)}</td></tr>`;
    });
    radky.push(`<tr><td><b>Celkem</b></td><td></td><td><b>${fmt(suma.g, 0)} g</b></td><td><b>${fmt(suma.m, 1)} m</b></td><td><b>${cas(suma.min)}</b></td></tr>`);
    $('odhad').innerHTML = radky.join('');
  }
  $('f_km').innerHTML = Object.entries(KPANT.MATERIALY).map(([k, m]) => `<option value="${k}">${esc(m.nazev)} (${fmt(m.hustota, 2)} g/cm³)</option>`).join('');

  /* ---------- zkušební díly (měrka vůlí, sada chlopní): okno s náhledem v tiskové poloze, stažení až odtud ---------- */
  let prohlizecZk = null, zkouska = null;            // zkouska = {dily, soubor}
  /** Otevře okno: titul, popis, hlavička a řádky tabulky (HTML), postup, díly v tiskové poloze a popisky. */
  function otevriZkousku(cfg) {
    zkouska = cfg;
    $('zkTitul').textContent = cfg.titul; $('zkPopis').textContent = cfg.popis;
    $('zkHlava').innerHTML = cfg.hlava; $('zkTabulka').innerHTML = cfg.radky; $('zkPostup').innerHTML = cfg.postup;
    if (!$('dlgZkouska').open) $('dlgZkouska').showModal();
    try {
      if (!prohlizecZk) prohlizecZk = KPANT_NAHLED.vytvorProhlizec($('zkNahled'));
      prohlizecZk.zobraz(cfg.dily, cfg.popisky);
    } catch (e) { $('zkNahled').textContent = 'Náhled není k dispozici (WebGL).'; }
  }
  $('btnZkStahnout').onclick = () => {
    if (!zkouska) return;
    stahni(KRAB.stlBinarni(zkouska.stl, 'krabicka_pant: ' + zkouska.soubor), `${slug()}_${zkouska.soubor}.stl`, 'model/stl');
    Dialog.info(`${zkouska.titul.replace(/^\S+\s/, '')} – STL uloženo.`);
  };
  $('btnZkZavrit').onclick = $('btnZkZpet').onclick = () => $('dlgZkouska').close();
  $('dlgZkouska').addEventListener('click', e => { if (e.target === $('dlgZkouska')) $('dlgZkouska').close(); });
  const pripraveno = () => { if (!wasm) { Dialog.chyba('Geometrické jádro se ještě načítá.'); return false; } return true; };

  function otevriMerku() {
    if (!pripraveno()) return;
    let m;
    try { m = KPANT_GEO.merka(wasm, p); } catch (e) { Dialog.chyba('Měrku nejde sestavit: ' + (e && e.message || e)); return; }
    const { dily, otvory, rozmer } = m, d = p.cep.prumer;
    // zvýrazní se otvor s vůlí nejbližší té, která je teď nastavená
    const blizka = otvory.reduce((a, o) => (Math.abs(o.vule - p.cep.vule) < Math.abs(a.vule - p.cep.vule) ? o : a));
    otevriZkousku({
      titul: '📏 Měrka vůlí čepu', soubor: 'merka_vuli', stl: KPANT.tiskoveRozlozeni(dily),
      popis: `Hranolek ${fmt(rozmer[0], 1)} × ${fmt(rozmer[1], 1)} × ${fmt(rozmer[2], 1)} mm s ${otvory.length} otvory pro `
        + (p.cep.druh === 'plast' ? `tištěný čep Ø ${fmt(d, 2)} mm (zkušební kousek čepu je vytištěný vedle).` : `kovový čep Ø ${fmt(d, 2)} mm.`),
      hlava: '<tr><th>Rýh nahoře</th><th>Vůle (na poloměru)</th><th>Průměr otvoru</th></tr>',
      radky: otvory.map(o => `<tr${o === blizka ? ' style="font-weight:700"' : ''}><td>${o.rez}</td><td>${fmt(o.vule, 2)} mm${o === blizka ? ' (nastaveno)' : ''}</td><td>${fmt(d + 2 * o.vule, 2)} mm</td></tr>`).join(''),
      postup: '<b>Postup:</b> vytiskněte měrku stejným materiálem a nastavením jako krabičku. Zkoušejte čep od nejtěsnějšího otvoru: vyberte ten, '
        + 've kterém se čep otáčí lehce, ale nehází se, a jeho vůli zadejte do pole <b>Čep → Vůle v otvoru</b>. Otvor, kterým čep jde jen silou, '
        + 'je vhodný pro těsný koncový článek.',
      dily: dily.map(x => Object.assign({ barva: x.jmeno === 'merka' ? 0x4f86d9 : 0xd8d8d8 }, x)),
      popisky: otvory.map(o => ({ bod: [o.x, o.y, o.z + 2], text: `${o.rez}: ${fmt(o.vule, 2)}`, zvyraznit: o === blizka })),
    });
  }

  function otevriSaduChlopni() {
    if (!pripraveno()) return;
    if (!KPANT.odvozene(p).zap.pocet) { Dialog.chyba('Krabička nemá zapínání – nastavte počet chlopní vpředu nebo na bocích.'); return; }
    let sada;
    try { sada = KPANT_GEO.sadaChlopni(wasm, p); } catch (e) { Dialog.chyba('Sadu nejde sestavit: ' + (e && e.message || e)); return; }
    // tisková poloha, pak vedle sebe do řady podél X (v náhledu zepředu je každá vidět)
    let x = 0;
    const stl = KPANT.tiskoveRozlozeni(sada.dily).map(d => {
      const b = KRAB.obal(d.poz), posun = KRAB.presun(d, x - b[0], -(b[1] + b[4]) / 2, 0);
      x += b[3] - b[0] + 6;
      return Object.assign({}, d, posun);
    }).map((d, _, vse) => Object.assign({}, d, KRAB.presun(d, -(x - 6) / 2, 0, 0)));
    const verdikt = { ok: 'v pořádku', volne: 'může vyskočit', tesne: 'nemusí zapadnout' };
    otevriZkousku({
      titul: '🧪 Sada zkušebních chlopní', soubor: 'zkusebni_chlopne', stl,
      popis: `5 chlopní ${fmt(p.zapinani.sirka)} mm od nejtužší (1 zářez v jazýčku) po nejvolnější (5 zářezů). Prostřední = současné nastavení.`
        + (p.cep.druh === 'plast' ? ' Čep zapínání použijte z hotové krabičky.' : ''),
      hlava: '<tr><th>Zářezů</th><th>Vůle okénka</th><th>Doladění</th><th>Záběr (nejhůř)</th><th></th></tr>',
      radky: sada.varianty.map(v => `<tr${v.i === 3 ? ' style="font-weight:700"' : ''}><td>${v.i}</td><td>${fmt(v.vule, 2)} mm</td>`
        + `<td>${v.dolad > 0 ? '+' : ''}${fmt(v.dolad, 2)} mm</td><td>${fmt(v.zaber, 2)} (${fmt(v.zaberMin, 2)}) mm – ${verdikt[v.verdikt]}</td>`
        + `<td><button class="tl" data-pouzij-chlopen="${v.i}">${v.i === 3 ? 'nastaveno' : 'Použít'}</button></td></tr>`).join(''),
      postup: '<b>Postup:</b> vytiskněte krabičku s víkem a tuto sadu. Nasaďte chlopně postupně na kloub (čepem) a zkuste zavřít a otevřít víko. '
        + 'Volná chlopeň se při zatažení za víko vysmekne, tuhá nejde přes výstupek nebo nedosedne. Nejlepší chlopeň nechte na krabičce '
        + '(zářezy nevadí) a tlačítkem <b>Použít</b> přeneste její nastavení – další chlopně už vytisknete správně.',
      dily: stl.map((x, i) => Object.assign({ barva: i === 2 ? 0x4caf7a : 0x8bc9a6 }, x)),
      popisky: stl.map((x, i) => { const b = KRAB.obal(x.poz); return { bod: [(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, b[5] + 1], text: String(i + 1), zvyraznit: i === 2 }; }),
      varianty: sada.varianty,
    });
  }
  $('zkTabulka').addEventListener('click', e => {
    const b = e.target.closest('[data-pouzij-chlopen]'); if (!b || !zkouska || !zkouska.varianty) return;
    const v = zkouska.varianty.find(x => x.i === +b.dataset.pouzijChlopen);
    if (!v || v.i === 3) return;
    zmen(q => { q.zapinani.vule = v.vule; q.zapinani.dolad = v.dolad; }, 'chlopen-varianta');
    naplnFormular();
    $('dlgZkouska').close();
    Dialog.info(`Použito nastavení chlopně ${v.i}: vůle okénka ${fmt(v.vule, 2)} mm, doladění ${fmt(v.dolad, 2)} mm.`);
  });
  document.querySelectorAll('.btnMerka').forEach(b => b.addEventListener('click', otevriMerku));
  document.querySelectorAll('.btnSadaChl').forEach(b => b.addEventListener('click', otevriSaduChlopni));
  $('legendaMerky').textContent = 'Počet rýh → vůle: ' + KPANT.VULE_MERKY.map((v, i) => `${i + 1} = ${fmt(v, 2)} mm`).join(', ') + '.';
  $('exportDily').addEventListener('click', async e => {
    const b = e.target.closest('button[data-stl]'); if (!b) return;
    const d = model && model.dily.find(x => x.jmeno === b.dataset.stl);
    if (!d || !(await pripravExport([d]))) return;
    stahni(KRAB.stlBinarni(KPANT.tiskoveRozlozeni([d]), `krabicka_pant: ${slug()} ${d.jmeno}`), `${slug()}_${d.jmeno}.stl`, 'model/stl');
  });
  $('btnStlVse').onclick = async () => {
    if (!model || !(await pripravExport(tiskoveDily()))) return;
    stahni(KRAB.stlBinarni(KPANT.tiskoveRozlozeni(vsechnyKusy()), 'krabicka_pant: ' + slug()), `${slug()}.stl`, 'model/stl');
  };
  $('btn3mf').onclick = async () => {
    if (!model || !(await pripravExport(tiskoveDily()))) return;
    stahni(KRAB.soubor3mf(KPANT.tiskoveRozlozeni(vsechnyKusy()), p.nazev), `${slug()}.3mf`, 'model/3mf');
  };
  $('btnZip').onclick = async () => {
    if (!model || !(await pripravExport(tiskoveDily()))) return;
    const polozky = tiskoveDily().map(d => ({
      name: `${slug()}_${d.jmeno}${d.kusu > 1 ? `_${d.kusu}x` : ''}.stl`,
      data: KRAB.stlBinarni(KPANT.tiskoveRozlozeni([d]), `krabicka_pant: ${slug()} ${d.jmeno}`),
    }));
    polozky.push({ name: `${slug()}.json`, data: KPANT.ulozProjekt(p) });
    stahni(KRAB.zip(polozky, new Date()), `${slug()}.zip`, 'application/zip');
  };
  $('btnPng').onclick = () => {
    if (!nahled) return;
    const a = document.createElement('a'); a.href = nahled.snimekPNG(); a.download = `${slug()}.png`; document.body.appendChild(a); a.click(); a.remove();
  };

  /* ---------- projekt ---------- */
  $('btnUlozit').onclick = () => stahni(KPANT.ulozProjekt(p), `${slug()}.json`, 'application/json');
  $('btnNacist').onclick = () => $('soubor').click();
  $('soubor').onchange = async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try {
      const r = KPANT.nactiProjekt(await f.text());
      zmen(q => { Object.keys(q).forEach(x => delete q[x]); Object.assign(q, r.p); }, 'nacist');
      hlaseniVstupu = r.hlaseni;
      naplnFormular();
      Dialog.info(r.hlaseni.length ? `Projekt načten, ${r.hlaseni.length} hodnot opraveno (viz Hlášení).` : 'Projekt načten.');
    } catch (err) { Dialog.chyba(err.message); }
  };

  /* ---------- náhled: přepínače, otevírání ---------- */
  function prepinac(id, fn) {
    const b = $(id);
    b.onclick = () => { const v = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(v)); if (nahled) fn(v); };
  }
  prepinac('tPruhledne', v => nahled.pruhledne(v));
  prepinac('tUchyty', v => nahled.zobrazUchyty(v));
  document.querySelectorAll('[data-pohled]').forEach(b => { b.onclick = () => nahled && nahled.pohled(b.dataset.pohled); });
  function nastavUhly() {
    $('oViko').textContent = $('rViko').value + '°'; $('oChlopen').textContent = $('rChlopen').value + '°';
    if (nahled) nahled.uhly(+$('rViko').value, +$('rChlopen').value);
  }
  $('rViko').oninput = $('rChlopen').oninput = () => { animace = null; nastavUhly(); };
  /* Animace: odklopit chlopně → otevřít víko, nebo opačně zavřít. */
  let animace = null;
  $('btnOtevrit').onclick = () => {
    const otevreno = +$('rViko').value > 0;
    const zar = KPANT.odvozene(p).pant.zarazka;
    const cil = otevreno ? [[0, 'rViko'], [0, 'rChlopen']] : [[60, 'rChlopen'], [Math.min(110, zar ? Math.floor(zar.uhel) : 110), 'rViko']];
    const id = {}; animace = id;
    $('txtOtevrit').textContent = otevreno ? ' Otevřít' : ' Zavřít';
    const krok = () => {
      if (animace !== id || !cil.length) return;
      const [c, k] = cil[0], el = $(k), h = +el.value;
      if (h === c) { cil.shift(); } else el.value = h + Math.sign(c - h) * Math.min(3, Math.abs(c - h));
      nastavUhly();
      requestAnimationFrame(krok);
    };
    krok();
  };

  document.addEventListener('keydown', e => {
    const t = e.target, vPoli = t && /INPUT|SELECT|TEXTAREA/.test(t.tagName) && t.type !== 'range';
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ' && !vPoli) { e.preventDefault(); e.shiftKey ? znovu() : zpet(); return; }
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY' && !vPoli) { e.preventDefault(); znovu(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey || vPoli || document.querySelector('dialog[open]')) return;
    const pohledy = { Digit1: 'izo', Digit2: 'shora', Digit3: 'zepredu', Digit4: 'zboku', Digit5: 'zezadu' };
    if (pohledy[e.code] && nahled) nahled.pohled(pohledy[e.code]);
    else if (e.code === 'KeyT') $('tPruhledne').click();
    else if (e.code === 'KeyU') $('tUchyty').click();
    else if (e.code === 'KeyO') $('btnOtevrit').click();
    else if (e.code === 'KeyP') $('btnPanel').click();
    else if (e.code === 'KeyV') $('btnVarianta').click();
    else if (e.code === 'KeyR') $('tRez').click();
    else if (e.code === 'KeyM') otevriMerku();
    else if (e.code === 'KeyZ') otevriSaduChlopni();
    else if (e.code === 'F1') { e.preventDefault(); $('btnNapoveda').click(); }
    else if (e.code === 'Escape') zavriNabidky();
  });

  /* ---------- nabídky v liště ---------- */
  function zavriNabidky() {
    document.querySelectorAll('.nabidka').forEach(n => { n.hidden = true; });
    document.querySelectorAll('[data-nabidka]').forEach(b => b.setAttribute('aria-expanded', 'false'));
  }
  document.querySelectorAll('[data-nabidka]').forEach(b => {
    b.setAttribute('aria-haspopup', 'menu'); b.setAttribute('aria-expanded', 'false');
    b.addEventListener('click', e => {
      e.stopPropagation();
      const n = $(b.dataset.nabidka), byla = !n.hidden;
      zavriNabidky();
      if (byla) return;
      n.hidden = false; b.setAttribute('aria-expanded', 'true');
      const r = b.getBoundingClientRect();
      n.style.left = Math.max(4, Math.min(r.left, innerWidth - n.offsetWidth - 4)) + 'px';
      n.style.top = (r.bottom + 4) + 'px';
      const prvni = n.querySelector('button'); if (prvni) prvni.focus();
    });
  });
  // klik mimo nabídku nebo na její položku nabídku zavře (obsluha položky už proběhla)
  document.addEventListener('click', e => { if (!e.target.closest('.nabidka') || e.target.closest('.nabidka button')) zavriNabidky(); });
  window.addEventListener('resize', zavriNabidky);

  /* ---------- varianty ---------- */
  $('seznamVariant').innerHTML = Object.entries(KPANT.VARIANTY).map(([k, v]) =>
    `<button class="tl" role="menuitem" data-varianta="${k}"><b>${esc(v.nazev)}</b><span class="popis-polozky">${esc(v.popis)}</span></button>`).join('');
  $('seznamVariant').addEventListener('click', async e => {
    const b = e.target.closest('[data-varianta]'); if (!b) return;
    const v = KPANT.VARIANTY[b.dataset.varianta];
    if (!(await Dialog.potvrd(`Použít variantu „${v.nazev}“? Přepíše rozměry, panty, přihrádky a zapínání (krok jde vrátit tlačítkem Zpět).`))) return;
    const nova = KPANT.varianta(b.dataset.varianta, p);
    zmen(q => { Object.keys(q).forEach(x => delete q[x]); Object.assign(q, nova); }, 'varianta');
    naplnFormular();
    pohledPoStavbe = 'izo';
  });

  /* ---------- panel, nápověda, odznak ---------- */
  function nastavPanel(v, ulozit) {
    $('panel').hidden = !v; $('btnPanel').setAttribute('aria-pressed', String(v));
    // ukládá se jen volba uživatele, ne výchozí stav podle šířky okna
    if (ulozit) try { localStorage.setItem(KLIC_PANEL, v ? '1' : '0'); } catch (e) { /* bez úložiště */ }
  }
  const KLIC_PANEL = 'webapp_krabicka_pant_panel';
  $('btnPanel').onclick = () => nastavPanel($('panel').hidden, true);
  {
    let ulozeny = null;
    try { ulozeny = localStorage.getItem(KLIC_PANEL); } catch (e) { /* bez úložiště */ }
    // na úzkém displeji panel zakrývá náhled – výchozí je zavřený
    nastavPanel(ulozeny ? ulozeny === '1' : innerWidth > 860);
  }
  $('stavOdznak').onclick = () => {
    nastavPanel(true);
    $('dKontrola').open = true;
    $('dKontrola').scrollIntoView({ block: 'start', behavior: 'smooth' });
  };
  $('btnNapoveda').onclick = () => $('dlgNapoveda').showModal();
  $('btnZavritNapovedu').onclick = () => $('dlgNapoveda').close();
  $('dlgNapoveda').addEventListener('click', e => { if (e.target === $('dlgNapoveda')) $('dlgNapoveda').close(); });

  /* ---------- řez ---------- */
  const nastavRez = () => { if (nahled) nahled.rez($('tRez').getAttribute('aria-pressed') === 'true' ? $('selRez').value : null, $('rRez').value / 100); };
  $('tRez').onclick = () => {
    const v = $('tRez').getAttribute('aria-pressed') !== 'true';
    $('tRez').setAttribute('aria-pressed', String(v)); $('gRez').hidden = !v;
    nastavRez();
  };
  $('selRez').onchange = $('rRez').oninput = nastavRez;

  /* ---------- uložené návrhy (tvary.js) ---------- */
  if (typeof Tvary !== 'undefined') Tvary.pripoj({
    klic: 'webapp_krabicka_pant_tvary', typ: 'krabicka_pant', nazev: 'Krabička s víčkem', kontejner: $('tvary'),
    parametry: () => KPANT.kopie(p),
    pouzij: q => {
      const r = KPANT.normalizuj(q);
      zmen(x => { Object.keys(x).forEach(k => delete x[k]); Object.assign(x, r.p); }, 'tvar');
      naplnFormular();
    },
    popis: q => `${q.nazev || 'Krabička'} – ${q.vnitrni.delka} × ${q.vnitrni.sirka} × ${q.vnitrni.vyska} mm`,
  });

  /* ---------- start ---------- */
  p = nactiUlozeny();
  naplnFormular();
  souhrny();
  vypisVysledky(); vypisHlaseni();
  nactiManifold().then(w => { wasm = w; prestav(); }).catch(e => {
    const st = $('stav3d'); st.textContent = 'Geometrické jádro (manifold-3d) se nenačetlo: ' + (e && e.message || e); st.classList.add('chyba');
    chybaStavby = 'manifold-3d se nenačetl – model ani export nejsou k dispozici.';
    vypisHlaseni();
  });
  // pro testy
  window.__krabicka_pant = { get p() { return p; }, get model() { return model; }, get pohyb() { return vysledekPohybu; }, get nahled() { return nahled; }, zmen, prestav, overPohyb };
})();

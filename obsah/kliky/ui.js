/* Kliky a knoby – ovládání stránky nad společným zapojením gen3d/aplikace.js (historie, projekt, sdílení, klávesy, manifold):
   tady formulář s živým přepočtem, přepočet, výsledky, pevnost, kontroly, export, vrtací šablona a skici. */
/* global KLIKY, KLIKY_GEOM, KLIKY_NAHLED, KLIKY_SKICA, EDITOR_PROFILU, KRAB, G3D, Dialog, TrubkyGui */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  // chyba skriptu se ukáže přímo v ploše náhledu (jinak je vidět jen v konzoli rámu); typicky stará verze souboru z cache
  window.addEventListener('error', e => {
    const st = $('stav3d'); if (!st) return;
    st.textContent = `Chyba skriptu: ${e.message} (${String(e.filename || '').split('/').slice(-2).join('/')}:${e.lineno}) – zkuste Ctrl+Shift+R.`;
    st.classList.add('chyba');
  });
  const K = KLIKY, fmt = K.fmt, esc = G3D.esc;
  const KLIC_VZHLED = 'webapp_kliky_vzhled';

  /* ---------- stav (historie, ukládání, projekt, sdílení a klávesy: gen3d/aplikace.js) ---------- */
  let p, wasm = null, model = null, chybaStavby = null, chybaJadra = null, posledniO = null, skica = null, edHlava = null, edKrcek = null, startOk = false;
  const app = G3D.aplikace({
    typ: 'kliky', nazev: 'Kliky', klic: 'webapp_kliky', soubor: 'klika',
    normalizuj: K.normalizuj, vychozi: () => K.zPredvolby(0),
    ulozProjekt: K.ulozProjekt, nactiProjekt: K.nactiProjekt,
    popis: q => `${q.nazev || 'Klika'} – ${K.popis(q)}`,
    vezmi: K.vezmi, poloz: K.poloz,
    formular: false, hlasitOpravyUlozeneho: true,   // pole se váží níž (živý přepočet při psaní, vazby norma ↔ rozměr)
    viditelnost: () => viditelnost(),
    prepocitej: () => prepocitej(), zpozdeni: 40,
    png: () => nahled.png(), pohled: j => nahled.pohled(j),
    exportStl: () => exportStl(),
    doModelare: () => (maModel() ? { data: KRAB.soubor3mf(kusyNaPodlozku(), app.p.nazev || 'Klika'), pripona: '.3mf' } : null),
    zkratky: { m: 'tTisk', d: 'tDuchove', p: 'tPrevisy', v: 'tPrevisy', h: 'tHrany', l: 'tPravitka' },
    // hlášení s polem bez [data-p] (tvary = segmentová tlačítka) skočí vlastní cestou
    hlaseniNavic: (li, x) => {
      if (!x.pole.length || document.querySelector(`[data-p="${x.pole[0]}"]`)) return;
      li.addEventListener('click', e => { if (e.target.tagName !== 'BUTTON') jdiNaPole(x.pole[0]); });
      li.addEventListener('keydown', e => { if (e.key === 'Enter') jdiNaPole(x.pole[0]); });
    },
    zmenaTematu: () => app.prepocitej(),
  });
  p = app.p;
  const zmen = app.zmen, nahrad = app.nahrad, naplnFormular = app.naplnFormular;

  /* ---------- formulář ---------- */
  const opt = (sel, obj, f) => { $(sel).innerHTML = Object.entries(obj).map(([k, v]) => `<option value="${k}">${esc(f(k, v))}</option>`).join(''); };
  opt('f_norma', K.VRETENA, (k, v) => v.nazev);
  opt('f_uch', K.UCHYCENI, (k, v) => v);
  opt('f_sv', K.STAVECI, (k, v) => (v ? `${k} (imbus ${fmt(v.klic, 1)})` : 'vlastní průměr'));
  opt('f_kprurez', K.PRUREZY, (k, v) => v.nazev);
  opt('f_npud', K.PUDORYSY, (k, v) => v);
  opt('f_rtvar', K.TVARY_ROZETY, (k, v) => v);
  opt('f_rsr', K.SROUBY_ROZETY, (k, v) => v.nazev);
  opt('f_klic', K.KLICE, (k, v) => v.nazev);
  opt('f_vkon', K.KONCE_KLIK, (k, v) => v);
  opt('f_mat', K.MATERIALY, (k, v) => `${v.nazev} – ${fmt(v.hustota, 2)} g/cm³`);
  $('trny').innerHTML = K.TRNY.map(t => `<option value="${t}">`).join('') + K.TRNY_US.map(t => `<option value="${t.mm}" label="${t.nazev}">`).join('');
  const segment = (id, obj, cesta) => {
    $(id).innerHTML = Object.entries(obj).map(([k, v]) => `<button type="button" data-seg="${cesta}" data-hodnota="${k}"><span aria-hidden="true">${v.znak || ''}</span>${esc(v.nazev || v)}</button>`).join('');
  };
  segment('segKlika', K.TVARY_KLIKY, 'klika.tvar');
  segment('segKnob', K.TVARY_KNOBU, 'knob.tvar');
  segment('segKrcek', K.TVARY_KRCKU, 'krcek.tvar');
  $('f_kkh').innerHTML = Object.entries(K.HRANY_KRCKU).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('');
  segment('segPodl', { rozeta: { nazev: 'Rozeta', znak: '◯' }, stit: { nazev: 'Štít', znak: '▯' }, zadne: { nazev: 'Bez rozety', znak: '·' } }, 'podlozeni.druh');
  document.querySelectorAll('[data-seg]').forEach(b => b.addEventListener('click', () => { zmen(x => K.poloz(x, b.dataset.seg, b.dataset.hodnota)); naplnFormular(); }));
  document.querySelectorAll('[data-typ-volba]').forEach(b => b.addEventListener('click', () => {
    zmen(x => { x.typ = b.dataset.typVolba; if (/^(Klika|Knob)$/.test(x.nazev)) x.nazev = x.typ === 'knob' ? 'Knob' : 'Klika'; }); naplnFormular();
  }));

  const pole = [...document.querySelectorAll('[data-p]')];
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
      zmen(x => {
        K.poloz(x, c, h);
        // ruční změna strany čtyřhranu = vlastní norma; výběr normy přepíše stranu
        if (c === 'vreteno.s') { const v = K.VRETENA[x.vreteno.norma]; if (v.s && Math.abs(v.s - h) > 1e-9) x.vreteno.norma = 'vlastni'; }
        if (c === 'sroub.prumer') { const v = K.STAVECI[x.sroub.velikost]; if (v && Math.abs(v.d - h) > 1e-9) x.sroub.velikost = 'vlastni'; }
        if (c === 'sroub.uchyceni' && h === 'vrut' && x.sroub.velikost !== 'vlastni') { x.sroub.velikost = 'vlastni'; x.sroub.prumer = 3.5; }   // běžný vrut 3,5 mm
      }, c);
      if (['vreteno.norma', 'vreteno.s', 'sroub.velikost', 'sroub.prumer', 'sroub.uchyceni'].includes(c)) {
        const psano = el.value; naplnFormular();
        if (document.activeElement === el && el.tagName === 'INPUT') el.value = psano;   // rozepsané číslo nepřepisovat
      }
    };
    el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', akce);
    if (el.tagName === 'INPUT' && el.type === 'text' && el.dataset.typ !== 'text') {
      el.addEventListener('change', () => {
        const psano = K.cislo(el.value, NaN), h = K.vezmi(p, el.dataset.p), roz = K.ROZSAHY[el.dataset.p];
        el.value = String(h).replace('.', ',');
        if (roz && Number.isFinite(psano) && Math.abs(psano - h) > 1e-9) {
          el.classList.remove('zvyrazni'); void el.offsetWidth; el.classList.add('zvyrazni');
          Dialog.info(`${el.labels[0] ? el.labels[0].textContent.trim() : 'Hodnota'}: omezeno na ${fmt(roz[0], 2)}–${fmt(roz[1], 2)}, použito ${fmt(h, 2)}.`);
        }
      });
      // ↑/↓ ± 1, Shift × 10, Alt po 0,1
      el.addEventListener('keydown', e => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        const h = K.cislo(el.value, NaN); if (!Number.isFinite(h)) return;
        e.preventDefault();
        const krok = (e.shiftKey ? 10 : e.altKey ? 0.1 : 1) * (e.key === 'ArrowUp' ? 1 : -1);
        el.value = fmt(Math.round((h + krok) * 1000) / 1000, 3);
        el.dispatchEvent(new Event('input'));
      });
    }
  }

  /** Ukáže jen pole, která pro zvolený typ / tvar dávají smysl. */
  function viditelnost() {
    p = app.p;
    const pd = p.podlozeni, tvar = K.TVARY_KLIKY[p.klika.tvar];
    for (const el of document.querySelectorAll('[data-pro]')) el.hidden = !el.dataset.pro.split(' ').includes(p.typ);
    for (const el of document.querySelectorAll('[data-ktvar]')) el.hidden = !tvar.pole.includes(el.dataset.ktvar);
    for (const el of document.querySelectorAll('[data-knobtvar]')) el.hidden = el.dataset.knobtvar !== p.knob.tvar;
    for (const el of document.querySelectorAll('[data-pudorys]')) el.hidden = !el.dataset.pudorys.split(' ').includes(p.knob.pudorys);
    for (const el of document.querySelectorAll('[data-podl]')) el.hidden = !el.dataset.podl.split(' ').includes(pd.druh);
    for (const el of document.querySelectorAll('[data-rtvar]')) if (!el.hidden) el.hidden = !el.dataset.rtvar.split(' ').includes(pd.tvar);
    for (const el of document.querySelectorAll('[data-klic]')) el.hidden = pd.klic === 'zadny';
    for (const el of document.querySelectorAll('[data-sroub]')) el.hidden = p.sroub.uchyceni === 'zadne';
    for (const el of document.querySelectorAll('[data-zahl]')) el.hidden = !el.dataset.zahl.split(' ').includes(p.sroub.uchyceni);
    $('skica').hidden = p.typ !== 'klika'; $('skicaKnob').hidden = p.typ !== 'knob';
    for (const el of document.querySelectorAll('[data-pouzdro]')) el.hidden = !p.vreteno.pouzdro;
    for (const el of document.querySelectorAll('[data-nekruh]')) el.hidden = p.klika.prurez === 'kruh' && p.klika.tvar !== 'generator';
    for (const el of document.querySelectorAll('[data-krcektvar]')) el.hidden = el.dataset.krcektvar !== p.krcek.tvar;
    // u U-trubky je krčkem sama trubka – tvar krčku nemá smysl, odsazení v rozetě ano
    const trubka = p.typ === 'klika' && p.klika.tvar === 'trubka';
    for (const el of document.querySelectorAll('[data-tvarkrcku]')) el.hidden = trubka || (el.dataset.pro ? !el.dataset.pro.split(' ').includes(p.typ) : false);
    for (const el of document.querySelectorAll('[data-krcektvar]')) if (trubka) el.hidden = true;
    $('oddilKrcek').hidden = trubka && p.podlozeni.druh === 'zadne';
    for (const el of document.querySelectorAll('[data-knobnevlastni]')) el.hidden = p.knob.tvar === 'vlastni';
    $('oddilSkica').hidden = !((p.typ === 'klika' && p.klika.tvar === 'vlastni') || (p.typ === 'knob' && p.knob.tvar === 'vlastni'));
    for (const el of document.querySelectorAll('[data-nekgen]')) el.hidden = p.klika.tvar === 'generator' || p.klika.tvar === 'vlastni';
    $('f_klic').closest('.pole').hidden = pd.druh === 'zadne';
    document.querySelectorAll('[data-typ-volba]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.typVolba === p.typ)));
    document.querySelectorAll('[data-seg]').forEach(b => b.setAttribute('aria-pressed', String(K.vezmi(p, b.dataset.seg) === b.dataset.hodnota)));
    $('lKvyska').textContent = p.klika.prurez === 'kruh' ? 'Průměr ramene' : 'Výška průřezu';
    $('lKrcek').textContent = p.klika.tvar === 'trubka' ? 'Límec u rozety Ø' : 'Krček Ø';
    $('lRsir').textContent = pd.tvar === 'kruh' ? 'Průměr' : 'Šířka';
    $('lPocet').textContent = p.knob.pudorys === 'hrany' ? 'Počet faset' : 'Počet rýh';
    $('lOrient').textContent = p.typ === 'klika' ? 'Orientace kliky' : 'Orientace knobu';
    $('hTvar').textContent = p.typ === 'klika' ? 'Tvar kliky' : 'Tvar knobu';
    $('f_orient').disabled = p.typ === 'klika' && p.tisk.rozpulit;
  }

  /* ---------- přepočet ---------- */
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const nahled = KLIKY_NAHLED.vytvorNahled($('platno'));
  /** Tiskové kusy: díl v doporučené orientaci, sada = dva kusy (druhá klika zrcadlově). */
  function sestavTisk(r, o) {
    const hlavni = p.typ === 'klika' && p.tisk.rozpulit ? ['pul+', 'pul-'] : [p.typ];
    const vysl = [];
    for (const d of r.dily) {
      if (d.cela) continue;
      const jeHlavni = hlavni.includes(d.dil);
      const rozbor = K.rozborDilu(d, p, o, d.dil, jeHlavni && !p.tisk.rozpulit ? p.tisk.orientace : 'auto');
      const pv = K.previsyDilu(d, rozbor.vybrana.R, p, rozbor.maska);
      vysl.push({ dil: d.dil, nazev: d.nazev, hlavni: jeHlavni, rozbor, poz: pv.poz, idx: d.idx, tridy: pv.tridy, objem: d.objem, plocha: d.plocha, rod: d.rod,
        ks: KRAB.kontrolaSite(pv.poz, d.idx) });
    }
    return vysl;
  }
  /** Kusy na podložku (všechny díly × počet), rozložené vedle sebe. */
  function kusyNaPodlozku(jen) {
    const out = [], ks = p.dvere.sada ? 2 : 1;
    for (const d of model.tisk) {
      if (jen && d.dil !== jen) continue;
      for (let i = 0; i < (jen ? 1 : ks); i++) {
        // druhá klika sady je zrcadlová (druhá strana dveří); zrcadlení podle x zachová polohu na podložce
        const sit = i === 1 && d.hlavni && p.typ === 'klika' ? KLIKY_GEOM.zrcadli(d) : d;
        out.push({ jmeno: d.dil, nazev: (p.nazev || 'Klika') + ' – ' + d.nazev + (ks > 1 && !jen ? (i ? ' (druhá strana)' : ' (první strana)') : ''),
          poz: sit.poz, idx: sit.idx, tridy: d.tridy, role: d.hlavni ? 'hlavni' : 'deska', barva: d.hlavni ? '#3F7BD6' : '#8FA9CF' });
      }
    }
    return rozloz(out, 8);
  }
  /** Díly do řad na podložku ≈ 220 mm (od největšího), celé vystředěné kolem počátku, vše na z = 0. */
  function rozloz(dily, mezera, sirka = 220) {
    const obal = poz => { const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
      for (let i = 0; i < poz.length; i += 3) for (let k = 0; k < 3; k++) { b[k] = Math.min(b[k], poz[i + k]); b[k + 3] = Math.max(b[k + 3], poz[i + k]); } return b; };
    const s = dily.map(d => ({ d, b: obal(d.poz) })).sort((a, b) => (b.b[4] - b.b[1]) - (a.b[4] - a.b[1]));
    let x = 0, y = 0, rada = 0, maxX = 0;
    const umisteni = s.map(({ d, b }) => {
      const w = b[3] - b[0], h = b[4] - b[1];
      if (x > 0 && x + w > sirka) { x = 0; y += rada + mezera; rada = 0; }
      const pos = [x - b[0], y - b[1], -b[2]];
      x += w + mezera; rada = Math.max(rada, h); maxX = Math.max(maxX, x - mezera);
      return { d, pos };
    });
    const cx = maxX / 2, cy = (y + rada) / 2;
    return umisteni.map(({ d, pos }) => {
      const poz = new Float32Array(d.poz.length);
      for (let i = 0; i < poz.length; i += 3) { poz[i] = d.poz[i] + pos[0] - cx; poz[i + 1] = d.poz[i + 1] + pos[1] - cy; poz[i + 2] = d.poz[i + 2] + pos[2]; }
      return Object.assign({}, d, { poz });
    });
  }
  /** Přepočet; když hned první selže (poškozený uložený projekt), otevře se výchozí klika. */
  function prepocitej() {
    try { prepocitejModel(); startOk = true; } catch (e) {
      if (startOk) throw e;
      console.error(e); startOk = true;
      app.nahrad(K.zPredvolby(0));
      setTimeout(() => Dialog.info('Uložený projekt nešel načíst (' + e.message + ') – otevřela se výchozí klika.'), 300);
    }
  }
  function prepocitejModel() {
    p = app.p;
    nahled.barvy(css('--border-strong'), css('--border'), css('--text'));
    const o = K.odvozene(p);
    posledniO = o;
    let H = K.kontroly(p, o);
    model = null; chybaStavby = chybaJadra;   // nenačtené jádro zůstává chybou i po dalších úpravách
    const st = $('stav3d');
    if (!wasm) {
      if (chybaJadra) H.push({ uroven: 'chyba', text: chybaJadra, pole: [] });
      $('stav3d').textContent = chybaJadra || 'Načítám geometrické jádro…'; $('stav3d').classList.toggle('chyba', !!chybaJadra);
      vypis(H, o, null); return;
    }
    const vazne = H.some(h => h.uroven === 'chyba' && /nemá krček|leží na rozetě|samo protínalo|zmačkal|kříží samo|by se přeložil|až ke dveřím/.test(h.text));
    if (!vazne) {
      try {
        const t0 = performance.now();
        const r = KLIKY_GEOM.postav(wasm, p, o);
        model = { o, dily: r.dily, duchove: r.duchove, tisk: sestavTisk(r, o), cas: 0 };
        model.podlozka = kusyNaPodlozku();
        model.cas = performance.now() - t0;
        for (const d of model.tisk) if (!d.ks.uzavrena) H.push({ uroven: 'chyba', text: `Síť dílu „${d.nazev}“ není uzavřená – export by nemusel jít vytisknout.`, pole: [] });
        H = H.concat(kontrolyTisku(o));
      } catch (e) {
        chybaStavby = 'Těleso nejde sestavit: ' + (e && e.message || e);
        H.push({ uroven: 'chyba', text: chybaStavby, pole: [] });
        model = null;
      }
    }
    st.textContent = chybaStavby || ''; st.classList.toggle('chyba', !!chybaStavby);
    if (model) {
      nahled.nastav({ klic: p.typ + p.podlozeni.druh,
        montaz: model.dily.filter(d => !d.polovina).map(d => ({ poz: d.poz, idx: d.idx, role: d.dil === 'klika' || d.dil === 'knob' ? 'hlavni' : 'deska' })),
        tisk: model.podlozka, duchove: model.duchove });
    } else nahled.nastav(null);
    vypis(H, o, model);
  }
  function kontrolyTisku(o) {
    const H = [];
    for (const d of model.tisk) {
      const v = d.rozbor.vybrana, best = d.rozbor.nejlepsi;
      if (K.potrebujePodpory(v, d.plocha)) {
        const lepsi = best !== v && best.volne + 4 * best.strme < 0.5 * (v.volne + 4 * v.strme);
        H.push({ uroven: d.hlavni ? 'info' : 'varovani', text: `${d.nazev}: v orientaci „${v.nazev}“ visí ${fmt(v.volne, 0)} mm² povrchu bez opory – tiskněte s podporami od podložky`
          + (d.hlavni && p.typ === 'klika' && !p.tisk.rozpulit ? ' (nebo kliku rozpulte).' : '.') + (lepsi ? ` Méně převisů má „${best.nazev}“.` : ''), pole: d.hlavni ? ['tisk.orientace'] : [],
          oprava: lepsi && d.hlavni && !p.tisk.rozpulit ? { pole: 'tisk.orientace', hodnota: best.klic, text: 'použít lepší orientaci' }
            : d.hlavni && p.typ === 'klika' && !p.tisk.rozpulit && p.klika.tvar !== 'dolu' ? { pole: 'tisk.rozpulit', hodnota: true, text: 'rozpůlit kliku' } : undefined });
      }
      if (v.podlozka < 15) H.push({ uroven: K.potrebujePodpory(v, d.plocha) ? 'info' : 'varovani', text: `${d.nazev}: na podložce leží jen ${fmt(v.podlozka, 0)} mm² – přidejte límec (brim), nebo ho podepřou podpory.`, pole: [] });
      if (d.hlavni && v.slabe && p.typ === 'klika') H.push({ uroven: 'varovani', text: `${d.nazev}: v orientaci „${v.nazev}“ vedou vrstvy napříč namáhaným místem – klika je asi o polovinu slabší (viz Pevnost).`, pole: ['tisk.orientace'] });
    }
    const b = [Infinity, Infinity, 0, -Infinity, -Infinity, 0];
    for (const d of model.podlozka) for (let i = 0; i < d.poz.length; i += 3) {
      b[0] = Math.min(b[0], d.poz[i]); b[3] = Math.max(b[3], d.poz[i]); b[1] = Math.min(b[1], d.poz[i + 1]); b[4] = Math.max(b[4], d.poz[i + 1]);
    }
    if (b[3] - b[0] > 230 || b[4] - b[1] > 230) H.push({ uroven: 'info', text: `Všechny díly vedle sebe zaberou ${fmt(b[3] - b[0], 0)} × ${fmt(b[4] - b[1], 0)} mm – na menší podložku je tiskněte po dílech (Soubor → STL jednoho dílu).`, pole: [] });
    return H;
  }

  /* ---------- výpisy ---------- */
  const dl = (popis, cislo, dalsi = '', tr = '') => `<div class="dlazdice"><div class="popis">${popis}</div><div class="cislo ${tr}">${cislo}</div>${dalsi ? `<div class="dalsi">${dalsi}</div>` : ''}</div>`;
  const cas = m => (m < 90 ? fmt(m, 0) + ' min' : fmt(m / 60, 1) + ' h');
  function vypis(H, o, m) {
    const ks = p.dvere.sada ? 2 : 1, mat = K.MATERIALY[p.tisk.material];
    let v = '', celkem = { g: 0, min: 0 };
    const hl = m && m.tisk.find(d => d.hlavni);
    if (m) {
      for (const d of m.tisk) {
        const b = d.ks.bbox, odh = K.odhadTisku(d.objem, d.plocha, b[5] - b[2], p);
        d.odhad = odh; celkem.g += odh.gramy * ks; celkem.min += odh.minut * ks;
      }
      if (p.typ === 'klika') {
        v += dl('Klika', `${fmt(p.klika.delka)} × ${fmt(o.vrchDilu)} mm`, `dosah ${fmt(o.dosah)} mm od osy, vyložení ${fmt(p.klika.vylozeni)} mm`);
        v += dl('Místo na prsty', `${fmt(o.svetlost)} mm`, o.tr ? 'mezi ramenem a rozetou' : 'mezi ramenem a dveřmi', o.svetlost < 25 ? 'chyba-t' : o.svetlost < 35 ? 'mez-t' : 'ok-t');
      } else {
        v += dl('Knob', `Ø ${fmt(p.knob.prumer)} × ${fmt(p.knob.vylozeni)} mm`, `hlava ${fmt(p.knob.hlava)} mm, krček Ø ${fmt(p.knob.krcek)}`);
        v += dl('Místo na prsty', `${fmt(o.svetlost)} mm`, 'pod nejširším místem hlavy', o.svetlost < 15 ? 'chyba-t' : o.svetlost < 20 ? 'mez-t' : 'ok-t');
      }
      v += dl('Otvor čtyřhranu', `□ ${fmt(o.dira, 2)} × ${fmt(o.hloubkaDiry)} mm`, `stěna u rohů ${fmt(o.stena)} mm${o.pouzdro ? `, pouzdro ${fmt(o.pouzdro, 2)} mm` : ''}`, o.stena < 1.2 ? 'chyba-t' : o.stena < 2.5 ? 'mez-t' : '');
      v += dl('Čtyřhran', o.vreteno.std ? `${fmt(p.vreteno.s, 2)} × ${o.vreteno.std} mm` : `≈ ${fmt(Math.round(o.vreteno.idealni))} mm`, `vyhoví ${fmt(Math.ceil(o.vreteno.min))}–${fmt(Math.floor(o.vreteno.max))} mm (dveře ${fmt(p.dvere.tloustka)})`);
      v += dl('Hmotnost', `≈ ${fmt(celkem.g, 0)} g`, `${mat.nazev}, výplň ${fmt(p.tisk.vypln, 0)} %${ks > 1 ? ', sada 2 strany' : ''}`);
      v += dl('Doba tisku', `≈ ${cas(celkem.min)}`, 'všechny díly, hrubý odhad (vrstva 0,2 mm)');
      const pv = pevnostVybrana(o, m);
      const kmin = Math.min(...pv.radky.map(r => r.k));
      v += dl('Pevnost', `× ${fmt(kmin, 1)}`, `nejslabší: ${pv.radky.find(r => r.k === kmin).co.toLowerCase()}`, K.tridaBezpecnosti(kmin) + '-t');
      if (hl) v += dl('Orientace kliky', p.tisk.rozpulit && p.typ === 'klika' ? 'rozpůlená, řezem dolů' : hl.rozbor.vybrana.nazev,
        K.potrebujePodpory(hl.rozbor.vybrana, hl.plocha) ? 's podporami' : 'bez podpor', K.potrebujePodpory(hl.rozbor.vybrana, hl.plocha) ? 'mez-t' : 'ok-t');
      $('tabDily').innerHTML = '<tr><th>Díl</th><th class="c">Ks</th><th class="c">Rozměr tisku</th><th class="c">Hmotnost</th><th class="c">Čas</th><th>Orientace</th></tr>'
        + m.tisk.map(d => { const b = d.ks.bbox; return `<tr><td>${esc(d.nazev)}</td><td class="c">${ks}</td><td class="c">${fmt(b[3] - b[0], 0)} × ${fmt(b[4] - b[1], 0)} × ${fmt(b[5] - b[2], 0)} mm</td>`
          + `<td class="c">${fmt(d.odhad.gramy, 0)} g</td><td class="c">${cas(d.odhad.minut)}</td><td>${esc(d.rozbor.vybrana.nazev)}${K.potrebujePodpory(d.rozbor.vybrana, d.plocha) ? ' · podpory' : ''}</td></tr>`; }).join('');
    } else { v = dl('Model', wasm ? 'nesestaven' : chybaJadra ? 'nedostupný' : 'načítám…', chybaStavby || ''); $('tabDily').innerHTML = ''; }
    $('vVysledky').innerHTML = v;
    $('sVysledky').textContent = m ? `≈ ${fmt(celkem.g, 0)} g` : '';

    // pevnost
    const pv = pevnostVybrana(o, m);
    $('pPevnost').textContent = `Zatížení: ${pv.popis}. ${pv.orientace}`;
    $('tabPevnost').innerHTML = '<tr><th>Místo</th><th class="c">Napětí</th><th class="c">Unese</th><th class="c">Bezpečnost</th><th>Poznámka</th></tr>'
      + pv.radky.map(r => `<tr><td>${esc(r.co)}${r.napric ? ' <span class="mez-t">(napříč vrstvami)</span>' : ''}</td><td class="c">${fmt(r.napeti, 1)} MPa</td><td class="c">${fmt(r.dovolene, 0)} MPa</td>`
        + `<td class="c ${K.tridaBezpecnosti(r.k)}-t">× ${r.k > 99 ? '>99' : fmt(r.k, 1)}</td><td>${esc(r.pozn)}</td></tr>`).join('');
    const kmin = Math.min(...pv.radky.map(r => r.k)), ctyr = pv.radky.find(r => r.co.startsWith('Čtyřhran'));
    $('sPevnost').textContent = `× ${fmt(kmin, 1)}`;
    const rady = [];
    if (ctyr && ctyr.k < 2 && !p.vreteno.pouzdro) rady.push(['Otvor čtyřhranu se vytluče – vlepte do kliky ocelové pouzdro.', () => zmen(x => { x.vreteno.pouzdro = true; })]);
    if (kmin < 2 && p.tisk.material === 'PLA') rady.push(['PLA je křehké – PETG nebo PA vydrží víc a nepraskne náhle.', () => zmen(x => { x.tisk.material = 'PETG'; })]);
    if (kmin < 2 && p.tisk.vypln < 100) rady.push(['Tiskněte s výplní 100 %.', () => zmen(x => { x.tisk.vypln = 100; })]);
    const rn = pv.radky.find(r => r.co.startsWith('Rameno'));
    if (rn && rn.k < 1.5) rady.push([`Rameno je v ohybu slabé – zvětšete výšku průřezu (nese s její druhou mocninou).`, () => zmen(x => { x.klika.vyska = Math.min(50, Math.ceil(x.klika.vyska * 1.2)); })]);
    $('radaPevnost').innerHTML = '';
    for (const [t, f] of rady) {
      const b = document.createElement('button'); b.className = 'tl'; b.style.margin = '0 6px 6px 0'; b.textContent = '🔧 ' + t;
      b.addEventListener('click', () => { f(); naplnFormular(); }); $('radaPevnost').appendChild(b);
    }

    // tisk
    const sel = $('f_orient'), r = hl && hl.rozbor;
    sel.innerHTML = '<option value="auto">automaticky – nejlepší</option>' + (r ? r.kandidati.map(k => `<option value="${k.klic}">${esc(k.nazev)}</option>`).join('') : '');
    sel.value = r && r.kandidati.some(k => k.klic === p.tisk.orientace) ? p.tisk.orientace : 'auto';
    $('tabOrientace').innerHTML = r && !(p.typ === 'klika' && p.tisk.rozpulit)
      ? '<tr><th>Poloha</th><th class="c">Bez opory</th><th class="c">Mosty</th><th class="c">Podložka</th><th class="c">Výška</th><th>Vrstvy</th></tr>'
        + r.kandidati.map(k => `<tr class="klik${k === r.vybrana ? ' vybrana' : ''}" data-klic="${k.klic}" tabindex="0"><td>${k === r.nejlepsi ? '★ ' : ''}${esc(k.nazev)}</td><td class="c">${fmt(k.volne, 0)} mm²</td>`
          + `<td class="c">${fmt(k.most, 0)} mm²</td><td class="c">${fmt(k.podlozka, 0)} mm²</td><td class="c">${fmt(k.vyska)} mm</td><td class="${k.slabe ? 'mez-t' : 'ok-t'}">${k.slabe ? 'napříč' : 'podél'}</td></tr>`).join('')
      : '';
    $('sTisk').textContent = hl ? (p.typ === 'klika' && p.tisk.rozpulit ? 'rozpůlená' : K.potrebujePodpory(hl.rozbor.vybrana, hl.plocha) ? 's podporami' : 'bez podpor') : '';
    $('pMaterial').textContent = mat.pozn + ` Orientační pevnost ${mat.xy} MPa ve vrstvě, ${mat.z} MPa napříč.`;

    // kusovník
    const kus = K.kusovnik(p, o);
    const dily = o.dily.map(d => ({ ks: d.ks, co: `Tištěný díl: ${K.KOLIK_DILU[d.dil].toLowerCase()}${d.dil === 'klika' && p.tisk.rozpulit ? ' (2 poloviny)' : ''}`,
      pozn: d.ks > 1 && (d.dil === 'klika') ? 'druhá klika zrcadlově' : '' }));
    $('tabKusovnik').innerHTML = '<tr><th class="c">Ks</th><th>Položka</th><th>Poznámka</th></tr>'
      + dily.concat(kus).map(x => `<tr><td class="c">${x.ks}</td><td class="${x.chyba ? 'chyba-t' : ''}">${esc(x.co)}</td><td>${esc(x.pozn || '')}</td></tr>`).join('');

    // síť
    $('vSit').innerHTML = m ? m.tisk.map(d => dl('Síť – ' + d.nazev.toLowerCase(), d.ks.uzavrena ? '✔ uzavřená' : '✖ otevřená',
      `${d.ks.trojuhelniku} trojúhelníků, ${d.ks.teles} těleso, rod ${d.rod}`, d.ks.uzavrena ? 'ok-t' : 'chyba-t')).join('') + dl('Výpočet', `${fmt(m.cas, 0)} ms`, 'stavba a rozbor tisku') : '';
    // karta v rohu
    $('karta3d').innerHTML = m ? `<div class="titul">${p.typ === 'klika' ? 'Klika' : 'Knob'}</div><b>${esc(K.popis(p))}</b><br>`
      + `<b>${fmt(celkem.g, 0)}</b> g ${mat.nazev} · pevnost <b>× ${fmt(kmin, 1)}</b>` : '';
    $('legPrevisy').hidden = !(m && nahled.stav.tisk && nahled.stav.previsy);
    // souhrny oddílů
    TrubkyGui.souhrn('sVreteno', `□ ${fmt(p.vreteno.s, 2)}${p.vreteno.pouzdro ? ' + pouzdro' : ''}`);
    TrubkyGui.souhrn('sSroub', p.sroub.uchyceni === 'zadne' ? 'bez šroubu' : `${K.jmenoSroubu(p)}, ${K.UCHYCENI[p.sroub.uchyceni].split(' ')[0]}`);
    TrubkyGui.souhrn('sDvere', `${fmt(p.dvere.tloustka)} mm, trn ${fmt(p.dvere.trn)}`);
    TrubkyGui.souhrn('sKlika', `${K.TVARY_KLIKY[p.klika.tvar].nazev}, ${fmt(p.klika.delka)} mm`);
    TrubkyGui.souhrn('sKnob', `${p.knob.tvar === 'generator' ? `🎲 ${p.knob.seminko}` : K.TVARY_KNOBU[p.knob.tvar].nazev}, Ø ${fmt(p.knob.prumer)}`);
    if ($('pGenerator')) $('pGenerator').textContent = p.knob.tvar === 'generator' ? `Tvar č. ${p.knob.seminko}: ${K.tvarZeSeminka(p.knob.seminko).popis}. Stejné semínko dá vždy stejný tvar – zapište si ho.` : '';
    if ($('pGeneratorK')) $('pGeneratorK').textContent = p.typ === 'klika' && p.klika.tvar === 'generator' ? `Klika č. ${p.klika.seminko}: ${o.pat.popis}. Stejné semínko dá vždy stejnou kliku.` : '';
    nahledProfilu(o);
    TrubkyGui.souhrn('sKrcek', `${K.TVARY_KRCKU[p.krcek.tvar].nazev}${p.typ === 'klika' && p.krcek.hrany ? ', ' + K.HRANY_KRCKU[p.krcek.hrany] : ''}`);
    if ($('pKrcek')) $('pKrcek').textContent = o.krcekF ? `Krček mezi ${p.podlozeni.druh === 'stit' ? 'štítem' : p.podlozeni.druh === 'rozeta' ? 'rozetou' : 'dveřmi'} a ${p.typ === 'klika' ? 'ramenem' : 'hlavou'}: ${o.krcekF.popis}, u paty Ø ${fmt(2 * o.rVnejsi, 1)} mm. Tvar jen přidává materiál – stěna kolem čtyřhranu zůstává.` : '';
    if (!$('oddilSkica').hidden) {
      if (p.typ === 'klika' && skica && !skica.tahne()) skica.kresli();
      if (p.typ === 'knob' && edHlava && !edHlava.tahne()) edHlava.kresli();
      TrubkyGui.souhrn('sSkica', `${(p.typ === 'klika' ? p.klika.vlastni : p.knob.vlastni).body.length} bodů`);
    }
    if (edKrcek && p.krcek.tvar === 'vlastni' && !edKrcek.tahne()) edKrcek.kresli();
    if ($('pOsazeni')) $('pOsazeni').textContent = !o.rOs ? '' : o.osazeniVen ? `Límec Ø ${fmt(2 * o.rOs, 1)} × ${fmt(o.hlOsazeni, 1)} mm zapadne do otvoru Ø ${fmt(2 * o.rOs + 0.8, 1)} mm ${p.podlozeni.druh === 'stit' ? 've štítu' : 'v rozetě'} a lícuje s ${p.podlozeni.druh === 'stit' ? 'ním' : 'ní'}; krček Ø ${fmt(2 * o.rVnejsi, 1)} vychází z něj.`
      : `Čep Ø ${fmt(2 * o.rOs, 1)} × ${fmt(o.hlOsazeni, 1)} mm zajede do otvoru Ø ${fmt(2 * o.rOs + 0.8, 1)} mm; rameno krčku Ø ${fmt(2 * o.rVnejsi, 1)} dosedne na líc ${p.podlozeni.druh === 'stit' ? 'štítu' : 'rozety'}.`;
    const pd = p.podlozeni;
    TrubkyGui.souhrn('sPodl', pd.druh === 'zadne' ? 'bez rozety' : `${K.PODLOZENI[pd.druh]}${pd.klic !== 'zadny' ? `, ${pd.klic} ${fmt(pd.roztec)}` : ''}`);
    // exporty jednotlivých dílů
    $('exportDilu').innerHTML = '';
    if (m) for (const d of m.tisk) {
      const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
      b.textContent = `⬇ STL – ${d.nazev.toLowerCase()} (1 kus)`;
      b.addEventListener('click', () => exportStl(d.dil));
      $('exportDilu').appendChild(b);
    }
    // hlášení
    if (!wasm && !chybaStavby) H = H.concat([{ uroven: 'info', text: 'Načítám geometrické jádro (manifold-3d)…', pole: [] }]);
    for (const r2 of pv.radky) if (r2.k < 1.2) H.push({ uroven: 'varovani', text: `${r2.co}: bezpečnost jen × ${fmt(r2.k, 1)} – při zatížení ${pv.popis.split(' (')[0]} praskne (záložka Pevnost).`, pole: [p.typ === 'klika' ? 'pevnost.sila' : 'pevnost.moment'] });
    app.hlaseni(H, { boxy: ['boxUchyceni', 'boxTvar'] });
    // chyba u tvaru (segmentová tlačítka, bez [data-p]) označí box taky
    for (const x of H) if (x.uroven === 'chyba') for (const c of x.pole) {
      const el = !document.querySelector(`[data-p="${c}"]`) && document.querySelector(`[data-seg="${c}"]`), bx = el && el.closest('[data-box]');
      if (bx) TrubkyGui.oznacChybu(bx.id, true);
    }
  }
  /* ---------- náhled profilu (2D SVG) ---------- */
  function obal2(b) {   // konvexní obal bodů [x, y] (monotónní řetěz)
    const P = b.slice().sort((a, c) => a[0] - c[0] || a[1] - c[1]), cr = (o, a, c) => (a[0] - o[0]) * (c[1] - o[1]) - (a[1] - o[1]) * (c[0] - o[0]);
    const lo = [], hi = [];
    for (const q of P) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (const q of P.reverse()) { while (hi.length > 1 && cr(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
    return lo.slice(0, -1).concat(hi.slice(0, -1));
  }
  /** Pohled: tvary = mnohoúhelníky v mm (y nahoru), doplňky = obdélníky [x0, y0, x1, y1], čára dveří y = 0. */
  function pohledSvg(nazev, tvary, doplnky, dvere = true) {
    const vse = tvary.flat().concat(doplnky.flatMap(d => [[d[0], d[1]], [d[2], d[3]]]));
    if (!vse.length) return '';
    const x0 = Math.min(...vse.map(b => b[0])) - 4, x1 = Math.max(...vse.map(b => b[0])) + 4;
    const y0 = Math.min(0, ...vse.map(b => b[1])) - 4, y1 = Math.max(...vse.map(b => b[1])) + 4;
    const n = v => v.toFixed(1), d = ob => 'M' + ob.map(([x, y]) => `${n(x - x0)} ${n(y1 - y)}`).join('L') + 'Z';
    let g = doplnky.map(r => `<rect class="doplnek" x="${n(r[0] - x0)}" y="${n(y1 - r[3])}" width="${n(r[2] - r[0])}" height="${n(r[3] - r[1])}"/>`).join('');
    if (dvere) g += `<line class="cara" x1="0" x2="${n(x1 - x0)}" y1="${n(y1)}" y2="${n(y1)}"/>`;
    g += `<path class="tvar${tvary.length > 1 ? ' bez' : ''}" d="${tvary.map(d).join('')}" fill-rule="nonzero"/>`;
    return `<figure><figcaption>${esc(nazev)}</figcaption><svg viewBox="0 0 ${n(x1 - x0)} ${n(y1 - y0)}" role="img" aria-label="${esc(nazev)}">${g}</svg></figure>`;
  }
  function nahledProfilu(o) {
    const el = $('profilSvg'); if (!el) return;
    let html = '';
    if (p.typ === 'klika') {
      const q = p.klika, h2 = q.vyska / 2, t2 = q.tloustka / 2, vz = o.pat.vz, M = 24;
      const kruhy = vz.map(v => K.kruhPateru(v, h2, t2, o.n, M));
      const posl = vz[vz.length - 1];
      for (let j = 1; j <= 6; j++) { const f = Math.PI / 2 * j / 6; kruhy.push(K.kruhPateru(Object.assign({}, posl, { c: K.V.add(posl.c, K.V.mul(posl.t, o.pat.e * Math.sin(f))) }), h2, t2, o.n, M, Math.cos(f))); }
      const pohled = (ix, iy) => kruhy.slice(1).map((k, i) => obal2(kruhy[i].concat(k).map(P => [P[ix], P[iy]])));
      const krcek = q.tvar === 'trubka' ? [] : [[-o.rKrcku, o.zKrcekDo, o.rKrcku, o.vrchKrcku]];
      const obrysKrcku = [];
      if (q.tvar !== 'trubka') { for (let i = 0; i <= 40; i++) { const z = o.zR + (o.zKrcekDo - o.zR) * i / 40; obrysKrcku.push([o.rKrckuV(z) / (o.hrany ? Math.cos(Math.PI / o.hrany) : 1), z]); } }
      const krcekPoly = obrysKrcku.length ? [obrysKrcku.concat(obrysKrcku.slice().reverse().map(([r, z]) => [-r, z]))] : [];
      const deska = o.tr ? [[-(o.desky[0].w / 2), 0, o.desky[0].w / 2, o.tr]] : [];
      html += pohledSvg('Shora (dveře dole)', pohled(0, 2).concat(krcekPoly), deska.concat(krcek));
      html += pohledSvg('Zepředu (na dveře)', pohled(0, 1), q.tvar === 'trubka' ? [] : [[-o.rKrcku, -o.rKrcku, o.rKrcku, o.rKrcku]], false);
      // průřezy ve třech místech ramene
      const iVz = [0.15, 0.5, 0.85].map(u => Math.min(vz.length - 1, Math.round(u * (vz.length - 1))));
      html += '<div class="rezy">' + iVz.map((i, k) => {
        const v = Object.assign({}, vz[i], { c: [0, 0, 0], t: [0, 0, 1], u: [0, 1, 0] });
        return pohledSvg(`Průřez ${['u krčku', 'uprostřed', 'u konce'][k]}`, [K.kruhPateru(v, h2, t2, o.n, 48).map(P => [P[0], P[1]])], [], false);
      }).join('') + '</div>';
    } else {
      const q = p.knob, b = o.prof.body, R = o.prof.R, rn = o.prof.rn;
      const bok = b.map(([r, z]) => [r, z]).concat(b.slice().reverse().map(([r, z]) => [-r, z]));
      const doplnky = (o.tr ? [[-(o.desky[0].w / 2), 0, o.desky[0].w / 2, o.tr]] : []).concat(o.rOs ? [[-o.rOs, o.z0, o.rOs, o.zR]] : []);
      html += pohledSvg('Zboku (dveře dole)', [bok], doplnky);
      const pud = []; for (let i = 0; i < 144; i++) { const f = 2 * Math.PI * i / 144, rr = R * K.pudorysKnobu(q, f, 1); pud.push([rr * Math.cos(f), rr * Math.sin(f)]); }
      html += '<div class="rezy">' + pohledSvg('Půdorys (zepředu)', [pud], [[-rn, -rn, rn, rn]], false) + '</div>';
    }
    el.innerHTML = html;
    TrubkyGui.souhrn('sProfil', p.typ === 'klika' ? (p.klika.tvar === 'generator' ? `🎲 ${p.klika.seminko}` : K.TVARY_KLIKY[p.klika.tvar].nazev) : K.TVARY_KNOBU[p.knob.tvar].nazev);
  }

  /** Pevnost v orientaci, ve které se hlavní díl opravdu tiskne. */
  function pevnostVybrana(o, m) {
    let nahoru = null, popisO = 'Orientace tisku zatím není známá – počítá se s horším případem (napříč vrstvami).';
    const hl = m && m.tisk.find(d => d.hlavni);
    if (hl) { nahoru = hl.rozbor.vybrana.nahoru; popisO = `Orientace: ${p.typ === 'klika' && p.tisk.rozpulit ? 'rozpůlená klika řezem dolů' : hl.rozbor.vybrana.nazev}.`; }
    return Object.assign(K.pevnost(p, o, nahoru), { orientace: popisO });
  }
  function jdiNaPole(cesta) {
    const najdi = sel => [...document.querySelectorAll(sel)].find(e => !e.closest('[hidden]')) || document.querySelector(sel);
    const el = najdi(`[data-p="${cesta}"]`) || najdi(`[data-seg="${cesta}"]`);   // tvary se vybírají segmentovými tlačítky
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

  /* ---------- vrtací šablona 1:1 ---------- */
  function sablona() {
    const o = K.odvozene(p), s = K.sablona(p, o), smer = p.dvere.strana === 'leva' ? -1 : 1;
    const X = x => smer * x, body = [], n = v => (+v).toFixed(2);
    const vse = [[X(s.hrana), 0], [0, 0]];
    for (const ob of s.obrysy) for (const b of ob) vse.push([X(b[0]), b[1]]);
    if (s.klic) for (const b of s.klic.obrys) vse.push([X(b[0]), b[1]]);
    const xs = vse.map(b => b[0]), ys = vse.map(b => b[1]);
    const x0 = Math.min(...xs) - 22, x1 = Math.max(...xs, 30) + 22, y0 = Math.min(...ys) - 34, y1 = Math.max(...ys) + 26;
    const W = x1 - x0, Hh = y1 - y0;
    const sx = x => x - x0, sy = y => y1 - y;      // mm na listu
    const cesta = ob => 'M' + ob.map(([x, y]) => `${n(sx(X(x)))} ${n(sy(y))}`).join('L') + 'Z';
    const text = (x, y, t, vel = 3, kotva = 'start', navic = '') => body.push(`<text x="${n(x)}" y="${n(y)}" font-size="${vel}" text-anchor="${kotva}"${navic}>${esc(t)}</text>`);
    const xh = sx(X(s.hrana));
    body.push(`<line x1="${n(xh)}" y1="0" x2="${n(xh)}" y2="${n(Hh)}" stroke="#000" stroke-width="0.6"/>`);
    text(xh + 2 * smer, 6, 'hrana dveří (čelo zámku)', 3, smer > 0 ? 'start' : 'end');
    for (const ob of s.obrysy) body.push(`<path d="${cesta(ob)}" fill="none" stroke="#666" stroke-width="0.3" stroke-dasharray="2 1.2"/>`);
    if (s.klic) body.push(`<path d="${cesta(s.klic.obrys)}" fill="none" stroke="#000" stroke-width="0.35"/>`);
    s.otvory.forEach((ot, i) => {
      const cx = sx(X(ot.x)), cy = sy(ot.y);
      body.push(`<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(ot.d / 2)}" fill="none" stroke="#000" stroke-width="0.3"/>`);
      const k = Math.max(5, ot.d / 2 + 3);
      body.push(`<path d="M${n(cx - k)} ${n(cy)}h${n(2 * k)}M${n(cx)} ${n(cy - k)}v${n(2 * k)}" stroke="#000" stroke-width="0.2"/>`);
      text(cx + ot.d / 2 + 1, cy - ot.d / 2 - 0.8, i ? `Ø ${fmt(ot.d, 1)}` : 'osa čtyřhranu', 2.6);
    });
    // kóty: trn nad vším, rozteč vlevo od osy (na straně hrany)
    const yTrn = sy(Math.max(...ys)) - 8;
    body.push(`<path d="M${n(xh)} ${n(yTrn)}H${n(sx(0))}" stroke="#000" stroke-width="0.25" marker-start="url(#s)" marker-end="url(#s)"/>`);
    text((xh + sx(0)) / 2, yTrn - 1.5, `trn ${fmt(s.trn)} mm`, 3, 'middle');
    if (s.roztec) {
      const xr = sx(0) - (Math.min(30, s.trn * 0.45)) * smer, ym = (sy(0) + sy(s.klic.y)) / 2;
      body.push(`<path d="M${n(xr)} ${n(sy(0))}V${n(sy(s.klic.y))}" stroke="#000" stroke-width="0.25" marker-start="url(#s)" marker-end="url(#s)"/>`);
      text(xr - 1.2, ym, `rozteč ${fmt(s.roztec)} mm`, 3, 'middle', ` transform="rotate(-90 ${n(xr - 1.2)} ${n(ym)})"`);
    }
    // legenda a měřítko 50 mm
    const sr = o.sr, leg = [];
    if (sr) leg.push(sr.vrut ? `Ø ${fmt(sr.predvrt, 1)} = předvrt pro ${sr.nazev.split(' se ')[0]}` : `Ø ${fmt(sr.predvrt)} = otvor skrz dveře pro šroub M${fmt(sr.d)}`);
    leg.push(`osa čtyřhranu: prostup Ø ${fmt(s.otvory[0].d)} mm vrtat jen do dveří bez zámku`);
    const xl = smer > 0 ? xh + 3 : 4;   // legenda a měřítko na ploše dveří, ne přes hranu
    leg.forEach((t, i) => text(xl, Hh - 24 + i * 4, t, 2.8));
    const xm = xl;
    body.push(`<path d="M${n(xm)} ${n(Hh - 6)}h50m-50 -2v4m50 -4v4" stroke="#000" stroke-width="0.4" fill="none"/>`);
    text(xm, Hh - 9, '50 mm – ověřte pravítkem', 2.8);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${n(W)}mm" height="${n(Hh)}mm" viewBox="0 0 ${n(W)} ${n(Hh)}" font-family="sans-serif">`
      + '<defs><marker id="s" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0L6 3L0 6Z"/></marker></defs>'
      + body.join('') + '</svg>';
    $('sablona').innerHTML = `<div style="font:11pt sans-serif;color:#000;margin-bottom:3mm"><b>Vrtací šablona – ${esc(p.nazev || 'klika')}</b> · ${esc(K.popis(p))}<br>`
      + `Pohled na líc dveří ze strany kliky. Na druhé straně dveří šablonu obraťte. Střed čtyřhranu přiložte k ose zámku.</div>` + svg;
    if (W > 194 || Hh > 270) Dialog.info(`Šablona měří ${fmt(W, 0)} × ${fmt(Hh, 0)} mm – na A4 na výšku se celá nevejde, tiskárna ji ořízne.`);
    document.documentElement.classList.add('tisk-sablony');
    const konec = () => { document.documentElement.classList.remove('tisk-sablony'); window.removeEventListener('afterprint', konec); };
    window.addEventListener('afterprint', konec);
    setTimeout(() => { window.print(); setTimeout(konec, 500); }, 50);
  }

  /* ---------- nabídky, export ---------- */
  TrubkyGui.pripoj({ klic: 'webapp_kliky_gui', pohled: j => nahled.pohled(j) });
  const seznam = $('seznamPredvoleb');
  K.PREDVOLBY.forEach((v, i) => {
    const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
    b.innerHTML = `${esc(v.nazev)}<span class="pozn">${esc(v.popis)}</span>`;
    b.addEventListener('click', () => nahrad(K.zPredvolby(i)));
    seznam.appendChild(b);
  });
  let vzhled = 'plast';
  try { vzhled = localStorage.getItem(KLIC_VZHLED) || 'plast'; } catch (e) { /* bez úložiště */ }
  if (!KLIKY_NAHLED.VZHLEDY[vzhled]) vzhled = 'plast';
  nahled.stav.vzhled = vzhled;
  for (const [k, v] of Object.entries(KLIKY_NAHLED.VZHLEDY)) {
    const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitemradio'); b.dataset.vzhled = k;
    b.textContent = v.nazev; b.setAttribute('aria-checked', String(k === vzhled));
    b.addEventListener('click', () => {
      document.querySelectorAll('[data-vzhled]').forEach(x => x.setAttribute('aria-checked', String(x === b)));
      nahled.prepni('vzhled', k);
      try { localStorage.setItem(KLIC_VZHLED, k); } catch (e) { /* bez úložiště */ }
    });
    $('vzhledy').appendChild(b);
  }
  function maModel() {
    if (model) return true;
    Dialog.chyba(chybaStavby || (wasm ? 'Model nelze sestavit – viz záložka Kontrola.' : 'Geometrické jádro se ještě načítá.'));
    return false;
  }
  function exportStl(jen) {
    if (!maModel()) return;
    const k = kusyNaPodlozku(jen);
    app.stahni(KRAB.stlBinarni(k, 'kliky - github_site'), app.jmeno(jen ? '_' + jen.replace('+', '_horni').replace('-', '_dolni') + '.stl' : '.stl'), 'model/stl');
  }
  $('btnStl').addEventListener('click', () => exportStl());
  $('btn3mf').addEventListener('click', () => { if (maModel()) app.stahni(KRAB.soubor3mf(kusyNaPodlozku(), p.nazev || 'Klika'), app.jmeno('.3mf'), 'model/3mf'); });
  $('btnSablona').addEventListener('click', sablona);
  skica = KLIKY_SKICA.vytvor($('skica'), { p: () => p, o: () => posledniO || K.odvozene(p), zmen: (fn, k) => zmen(fn, k) });
  edHlava = EDITOR_PROFILU.vytvor($('skicaKnob'), {
    ziskej: () => ({ body: p.knob.vlastni.body, sx: p.knob.prumer / 2, sy: p.knob.hlava, hlava: true, rMax: 1, ram: [[-p.knob.krcek / 2, -6, p.knob.krcek / 2, 0]] }),
    zapis: b => zmen(x => { x.knob.vlastni = { body: b }; }, 'skica'),
  });
  // délka krčku: od rozety k rameni (klika) nebo k hlavě (knob)
  const delkaKrcku = () => { const o = posledniO || K.odvozene(p); return Math.max(3, p.typ === 'klika' ? (o.zKrcekDo || 10) - o.zR : (o.prof ? o.prof.zNapoj - o.zR : 10)); };
  edKrcek = EDITOR_PROFILU.vytvor($('skicaKrcek'), {
    ziskej: () => ({ body: p.krcek.vlastni.body, sx: (p.typ === 'klika' ? p.klika.krcek : p.knob.krcek) / 2, sy: delkaKrcku(), hlava: false, serazene: true, rMin: p.typ === 'klika' ? 1 : 0.4, rMax: 3,
      pevne: (i, n) => (i === 0 ? { u: true } : i === n - 1 ? { u: true, r: true } : null) }),
    zapis: b => zmen(x => { x.krcek.vlastni = { body: b }; }, 'skicaKrcek'),
  });
  $('btnKrcekVychozi').addEventListener('click', () => { zmen(x => { delete x.krcek.vlastni; }); naplnFormular(); });
  $('btnKrcekVyhladit').addEventListener('click', () => {
    zmen(x => { const b = x.krcek.vlastni.body, puv = JSON.parse(JSON.stringify(b)); for (let i = 1; i < b.length - 1; i++) b[i].r = Math.round((puv[i - 1].r + 2 * puv[i].r + puv[i + 1].r) / 4 * 1000) / 1000; });
    naplnFormular();
  });
  $('btnDoSkicyK').addEventListener('click', () => { zmen(x => { x.klika.vlastni = K.vlastniZeSeminka(x); x.klika.tvar = 'vlastni'; }); naplnFormular(); });
  $('btnDoSkicyN').addEventListener('click', () => { zmen(x => { x.knob.vlastni = K.vlastniKnobZTvaru(x); x.knob.tvar = 'vlastni'; }); naplnFormular(); });
  $('btnSkicaVychozi').addEventListener('click', () => { zmen(x => { if (x.typ === 'klika') delete x.klika.vlastni; else delete x.knob.vlastni; }); naplnFormular(); });
  $('btnSkicaVyhladit').addEventListener('click', () => {
    zmen(x => {
      const b = x.typ === 'klika' ? x.klika.vlastni.body : x.knob.vlastni.body, kl = x.typ === 'klika' ? ['dz', 'dy', 'sh', 'st'] : ['r'];
      const puv = JSON.parse(JSON.stringify(b));
      for (let i = 1; i < b.length - 1; i++) for (const k of kl) b[i][k] = Math.round((puv[i - 1][k] + 2 * puv[i][k] + puv[i + 1][k]) / 4 * 100) / 100;
    });
    naplnFormular();
  });
  $('btnKostkaKrcek').addEventListener('click', () => { zmen(x => { x.krcek.seminko = 1 + Math.floor(Math.random() * 999998); }); naplnFormular(); });
  if ($('btnKostkaK')) $('btnKostkaK').addEventListener('click', () => { zmen(x => { x.klika.seminko = 1 + Math.floor(Math.random() * 999998); }); naplnFormular(); });
  if ($('btnKostka')) $('btnKostka').addEventListener('click', () => { zmen(x => { x.knob.seminko = 1 + Math.floor(Math.random() * 999998); }); naplnFormular(); });
  const legenda = () => { $('legPrevisy').hidden = !(model && nahled.stav.tisk && nahled.stav.previsy); };
  for (const [id, co] of [['tDuchove', 'duchove'], ['tHrany', 'hrany'], ['tTisk', 'tisk'], ['tPrevisy', 'previsy'], ['tPravitka', 'pravitka']])
    app.prepinac(id, h => { if (nahled.stav[co] !== h) nahled.prepni(co, h); legenda(); });

  /* ---------- start ---------- */
  app.start({
    manifold: {
      ok: w => { wasm = w; $('stav3d').textContent = ''; prepocitej(); },
      chyba: e => { chybaJadra = 'Geometrické jádro (manifold-3d) se nenačetlo: ' + (e && e.message || e) + ' – model ani export nejsou k dispozici.'; prepocitej(); },
    },
  });
  window.KLIKY_UI = { get p() { return app.p; }, get model() { return model; }, nahled, zmen, naplnFormular, prepocitej, nahrad, sablona, app };
})();

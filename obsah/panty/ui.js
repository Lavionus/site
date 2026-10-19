/* ============================================================
   panty/ui.js – ovládání stránky Panty a klouby.
   Stav: režim + parametry všech režimů (localStorage webapp_panty_stav),
   pojmenované návrhy (webapp_panty_sady). Manifold běží v hlavním vlákně
   (z file:// se WASM načte z base64 v manifold.wasm.js). Kontrola kolizí
   je generátor krokovaný po kouscích, aby stránka nezamrzla.
   ============================================================ */
(function () {
  'use strict';
  const J = window.PANTY, G = window.PANTY_GEO, S = window.PANTY_SCENA;
  const KLIC = 'webapp_panty_stav', KLIC_SADY = 'webapp_panty_sady';
  const $ = id => document.getElementById(id);
  const f = J.fmt;
  const TOL = 1e-3;

  /* ---------- stav ---------- */
  const stav = { rezim: 'pant', hodnoty: {}, podlozka: '220x220', podlozkaW: 220, podlozkaD: 220, rozestup: 5, rychlost: 1 };
  for (const r of Object.keys(J.REZIMY)) stav.hodnoty[r] = J.vychozi(r);
  try {
    const ul = JSON.parse(localStorage.getItem(KLIC) || 'null');
    if (ul && typeof ul === 'object') {
      if (J.REZIMY[ul.rezim]) stav.rezim = ul.rezim;
      for (const r of Object.keys(J.REZIMY)) if (ul.hodnoty && ul.hodnoty[r]) Object.assign(stav.hodnoty[r], ul.hodnoty[r]);
      for (const k of ['podlozka', 'podlozkaW', 'podlozkaD', 'rozestup', 'rychlost']) if (ul[k] !== undefined) stav[k] = ul[k];
    }
  } catch (e) { /* poškozený záznam – výchozí stav */ }
  let casUlozeni = 0;
  function ulozStav() {
    clearTimeout(casUlozeni);
    casUlozeni = setTimeout(() => { try { localStorage.setItem(KLIC, JSON.stringify(stav)); } catch (e) { /* plné úložiště / soukromé okno */ } }, 300);
  }

  let w = null, model = null, norm = null, analyza = null, beh = 0, tvary = null, rozm = null, scena3d = false;
  const poloha = { u: 0, az: 0 };

  /* ---------- formulář ---------- */
  const SKUPINY = ['Rozměry', 'Čep a vůle', 'Zacvaknutí', 'Pásek', 'Pohyb', 'Montážní otvory', 'Tisk'];
  const textCisla = x => (typeof x === 'number' ? String(+x.toPrecision(10)) : String(x)).replace('.', ',');

  function postavFormular() {
    const form = $('formular'), r = stav.rezim, h = stav.hodnoty[r];
    form.innerHTML = '';
    for (const sk of SKUPINY) {
      const defs = J.PARAMETRY.filter(d => d.skupina === sk && d.rezimy.includes(r));
      if (!defs.length) continue;
      const fs = document.createElement('fieldset');
      fs.innerHTML = `<legend>${sk}</legend>`;
      const mr = document.createElement('div'); mr.className = 'mrizka2';
      for (const d of defs) {
        const pole = document.createElement('div');
        pole.className = 'pole'; pole.dataset.klic = d.klic;
        const id = 'p_' + d.klic;
        let vstup;
        if (d.typ === 'vyber') {
          vstup = `<select id="${id}">${d.volby.map(v => `<option value="${v[0]}"${v[0] === h[d.klic] ? ' selected' : ''}>${v[1]}</option>`).join('')}</select>`;
        } else {
          vstup = `<input type="text" inputmode="decimal" id="${id}" value="${textCisla(h[d.klic])}" aria-describedby="s_${d.klic}">` + (d.j ? `<span class="jedn">${d.j}</span>` : '');
        }
        pole.innerHTML = `<label for="${id}">${d.nazev}</label><div class="vstup">${vstup}</div>` +
          `<div class="pole-stav" id="s_${d.klic}" aria-live="polite"></div>` + (d.napoveda ? `<div class="napoveda">${d.napoveda}</div>` : '');
        if (d.typ === 'vyber') pole.style.gridColumn = '1 / -1';
        mr.appendChild(pole);
      }
      fs.appendChild(mr);
      form.appendChild(fs);
    }
    $('popisRezimu').textContent = J.REZIMY[r].popis;
    for (const b of document.querySelectorAll('#rezimy button')) b.setAttribute('aria-pressed', String(b.dataset.rezim === r));
    viditelnost();
  }
  function viditelnost() {
    const h = stav.hodnoty[stav.rezim];
    const skryj = (klic, ano) => { const el = document.querySelector(`.pole[data-klic="${klic}"]`); if (el) el.hidden = ano; };
    const bez = !(J.cislo(h.otvoru) > 0);
    skryj('otvorD', bez); skryj('zahloubeni', bez); skryj('otvorOdOsy', bez);
    skryj('hlavaSroubuD', bez || h.zahloubeni === 'zadne');
    skryj('hlavaSroubuH', bez || h.zahloubeni !== 'valec');
    for (const k of ['zarezS', 'zarezH']) skryj(k, !(J.cislo(h.zarezu) > 0));
  }

  let casPrestavby = 0;
  $('formular').addEventListener('input', e => {
    const pole = e.target.closest('.pole');
    if (!pole) return;
    const k = pole.dataset.klic, d = J.PODLE_KLICE[k];
    stav.hodnoty[stav.rezim][k] = d.typ === 'vyber' ? e.target.value : e.target.value;
    viditelnost();
    ulozStav();
    clearTimeout(casPrestavby);
    casPrestavby = setTimeout(prestav, e.target.tagName === 'SELECT' ? 0 : 350);
  });
  $('formular').addEventListener('change', e => {
    // po opuštění pole ukázat normalizovanou hodnotu (čárka, ořez do mezí)
    const pole = e.target.closest('.pole');
    if (!pole || e.target.tagName === 'SELECT' || !norm) return;
    const k = pole.dataset.klic, x = J.cislo(e.target.value);
    if (Number.isFinite(x) && norm.p[k] !== undefined) {
      e.target.value = textCisla(norm.p[k]);
      stav.hodnoty[stav.rezim][k] = norm.p[k];
      ulozStav();
    }
  });
  $('formular').addEventListener('submit', e => e.preventDefault());

  function ukazStavPoli() {
    for (const el of document.querySelectorAll('#formular .pole-stav')) { el.textContent = ''; el.classList.remove('mez'); }
    for (const el of document.querySelectorAll('#formular input, #formular select')) el.classList.remove('chyba', 'mez');
    const zapis = (seznam, trida) => {
      for (const c of seznam) {
        const s = $('s_' + c.klic), v = $('p_' + c.klic);
        if (!s) continue;
        s.textContent = (s.textContent ? s.textContent + ' ' : '') + c.text;
        if (trida === 'mez' && !v.classList.contains('chyba')) { s.classList.add('mez'); v.classList.add('mez'); }
        if (trida === 'chyba') { s.classList.remove('mez'); v.classList.add('chyba'); v.classList.remove('mez'); }
      }
    };
    zapis(norm.upozorneni, 'mez');
    zapis(norm.chyby, 'chyba');
  }

  /* ---------- manifold ---------- */
  function nactiSkript(src) {
    return new Promise((ok, chyba) => {
      const el = document.createElement('script'); el.src = src;
      el.onload = ok; el.onerror = () => chyba(new Error('nejde načíst ' + src));
      document.head.appendChild(el);
    });
  }
  async function nactiManifold() {
    globalThis.MANIFOLD_URL = new URL('lib/manifold/manifold.klasicky.js', location.href).href;
    if (!globalThis.ManifoldModule) await nactiSkript('lib/manifold/manifold.klasicky.js');
    let volby;
    if (location.protocol === 'file:') {
      // z file:// nejde stáhnout .wasm – vezme se z base64
      await nactiSkript('lib/manifold/manifold.wasm.js');
      const b64 = globalThis.MANIFOLD_WASM_B64, s = atob(b64), bin = new Uint8Array(s.length);
      for (let i = 0; i < s.length; i++) bin[i] = s.charCodeAt(i);
      delete globalThis.MANIFOLD_WASM_B64;
      volby = { wasmBinary: bin };
    } else volby = { locateFile: x => new URL('lib/manifold/' + x, location.href).href };
    const m = await globalThis.ManifoldModule(volby);
    m.setup();
    return m;
  }

  /* ---------- přestavba modelu ---------- */
  function prestav(resetKamery) {
    norm = J.normalizuj(stav.rezim, stav.hodnoty[stav.rezim]);
    ukazStavPoli();
    ukazUpozorneni();
    if (!w) return;
    beh++;                                       // zastaví běžící kontrolu kolizí
    if (norm.chyby.length) {
      zprava3d('Opravte parametry označené červeně – s nimi nejde model sestavit.');
      $('kolize').innerHTML = '<p class="chybovy">Model není sestavený: ' + norm.chyby.map(c => c.text).join(' ') + '</p>';
      $('tabDily').tBodies[0].innerHTML = '';
      $('podlozkaSvg').innerHTML = ''; $('podlozkaInfo').textContent = '';
      $('btnStlPodlozka').disabled = true;
      $('polohaStav').className = 'stav-souhrn chyba'; $('polohaStav').textContent = 'Model není sestavený.';
      return;
    }
    const staryRezim = model && model.rezim;
    uvolniTvary();
    if (model) model.uvolni();
    analyza = null;
    try { model = G.postav(w, stav.rezim, norm.p); }
    catch (e) { model = null; zprava3d('Model se nepodařilo sestavit: ' + (e && e.message || e)); return; }
    const po = model.pohyb;
    const sl = $('uhel');
    sl.min = po.min; sl.max = po.max; sl.step = 0.5;
    if (!(poloha.u >= po.min && poloha.u <= po.max) || staryRezim !== model.rezim) poloha.u = po.klid;
    const koule = po.typ === 'koule';
    for (const id of ['azimut', 'azimutHodnota', 'azimutPopisek']) $(id).hidden = !koule;
    sl.setAttribute('aria-label', koule ? 'Náklon krčku' : po.typ === 'ohyb' ? 'Úhel ohybu' : 'Úhel otevření');
    sl.value = poloha.u;
    if (scena3d) {
      try {
        S.nastavModel(model, model.dily.map(d => G.sitDilu(d.man)), !resetKamery && staryRezim === model.rezim);
        zprava3d(null);
      } catch (e) { zprava3d('3D náhled nelze zobrazit: ' + (e && e.message || e)); }
    }
    legenda();
    $('info3d').textContent = koule ? 'Náklon krčku od osy jamky; směr = kam se krček vychýlí.' : po.typ === 'ohyb' ? 'Úhel ohybu pásku (0° = naplocho).' : '0° = listy naplocho, 180° = list B přeložený přes list A.';
    nastavPolohu();
    ukazDily();
    ukazPodlozku();
    spustKontrolu();
  }
  function zprava3d(t) { const z = $('zprava3d'); z.hidden = !t; if (t) z.textContent = t; }
  function legenda() {
    const pol = model.dily.map(d => `<span><i style="background:${d.barva}"></i>${d.nazev}${d.role === 'pohyblivy' ? ' (pohyblivý)' : ''}</span>`);
    if (model.pasek) pol.push(`<span><i style="background:${model.pasek.barva}"></i>Pružný pásek</span>`);
    pol.push('<span><i style="background:var(--barva-kolize)"></i>Průnik (kolize)</span>');
    $('legenda').innerHTML = pol.join('');
  }

  /* ---------- poloha a živá kolize ---------- */
  let cekaKolize = false;
  function nastavPolohu() {
    if (!model) return;
    const M = model.pohyb.matice(poloha.u, poloha.az);
    $('uhelHodnota').textContent = f(poloha.u, 1) + '°';
    $('azimutHodnota').textContent = f(poloha.az, 0) + '°';
    if (scena3d) {
      S.nastavPolohu(M, model.pasek ? v => J.bodOhybu(model.p, poloha.u, v) : null);
      S.vykresli();
    }
    if (!cekaKolize) { cekaKolize = true; requestAnimationFrame(zivaKolize); }
  }
  function zivaKolize() {
    cekaKolize = false;
    if (!model) return;
    const M = model.pohyb.matice(poloha.u, poloha.az);
    const r = G.prunikVPoloze(model, M, { vratSit: true, tolerance: TOL });
    if (scena3d) { S.nastavKolizi(r.objem > TOL ? r.site : null); S.vykresli(); }
    const el = $('polohaStav');
    const popis = model.pohyb.typ === 'koule' ? `náklon ${f(poloha.u, 1)}° ve směru ${f(poloha.az, 0)}°` : `úhel ${f(poloha.u, 1)}°`;
    if (r.objem > TOL) { el.className = 'stav-souhrn chyba'; el.innerHTML = `<b class="chyba">Kolize</b> v poloze ${popis}: díly se překrývají, objem průniku ${f(r.objem)} mm³ (červeně).`; }
    else { el.className = 'stav-souhrn ok'; el.textContent = `V poloze ${popis} se díly nepřekrývají.`; }
  }
  $('uhel').addEventListener('input', e => { zastavAnimaci(); poloha.u = +e.target.value; nastavPolohu(); });
  $('azimut').addEventListener('input', e => { zastavAnimaci(); poloha.az = +e.target.value; nastavPolohu(); });

  /* ---------- animace ---------- */
  let anim = 0, animT = 0, animSmer = 1;
  function krokAnimace(t) {
    if (!anim || !model) return;
    const dt = Math.min(0.1, (t - (animT || t)) / 1000); animT = t;
    const po = model.pohyb, rych = +stav.rychlost || 1;
    if (po.typ === 'koule') {
      poloha.u = po.max;                       // kužel krajního náklonu
      poloha.az = (poloha.az + 90 * rych * dt) % 360;
      $('azimut').value = poloha.az;
    } else {
      const v = Math.max(30, (po.max - po.min) / 3) * rych;
      poloha.u += animSmer * v * dt;
      if (poloha.u >= po.max) { poloha.u = po.max; animSmer = -1; }
      if (poloha.u <= po.min) { poloha.u = po.min; animSmer = 1; }
    }
    $('uhel').value = poloha.u;
    nastavPolohu();
    anim = requestAnimationFrame(krokAnimace);
  }
  function spustAnimaci() { if (anim || !model) return; animT = 0; anim = requestAnimationFrame(krokAnimace); $('btnPrehraj').textContent = '❚❚ Zastavit'; $('btnPrehraj').setAttribute('aria-pressed', 'true'); }
  function zastavAnimaci() { if (anim) cancelAnimationFrame(anim); anim = 0; $('btnPrehraj').textContent = '▶ Přehrát'; $('btnPrehraj').setAttribute('aria-pressed', 'false'); }
  $('btnPrehraj').addEventListener('click', () => (anim ? zastavAnimaci() : spustAnimaci()));
  $('rychlost').value = String(stav.rychlost);
  $('rychlost').addEventListener('change', e => { stav.rychlost = +e.target.value; ulozStav(); });
  $('chkRez').addEventListener('change', e => scena3d && S.nastavVolby({ rez: e.target.checked }));
  $('chkPruhledne').addEventListener('change', e => scena3d && S.nastavVolby({ pruhledne: e.target.checked }));
  for (const b of document.querySelectorAll('[data-pohled]')) b.addEventListener('click', () => scena3d && S.pohled(b.dataset.pohled));
  document.addEventListener('keydown', e => {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.tagName === 'BUTTON' || t.isContentEditable)) return;
    if (e.code === 'Space') { e.preventDefault(); anim ? zastavAnimaci() : spustAnimaci(); }
    const m = /^Digit([1-4])$/.exec(e.code);
    if (m && !e.ctrlKey && !e.altKey && !e.metaKey) nastavRezim(Object.keys(J.REZIMY)[+m[1] - 1]);
  });

  /* ---------- kontrola kolizí ---------- */
  async function spustKontrolu() {
    const tok = ++beh, m = model;
    analyza = null;
    $('kolize').innerHTML = '<p class="napoveda">Kontroluji kolize v celém rozsahu pohybu…</p><div class="prubeh"><i id="prubehKolizi"></i></div>';
    stopa(null);
    const gen = G.analyzaKroky(m, { tolerance: TOL });
    let t = performance.now();
    for (;;) {
      if (tok !== beh) return;
      let r;
      try { r = gen.next(); }
      catch (e) { $('kolize').innerHTML = '<p class="chybovy">Kontrola kolizí selhala: ' + (e && e.message || e) + '</p>'; return; }
      if (r.done) { analyza = r.value; break; }
      if (performance.now() - t > 40) {
        const p = $('prubehKolizi'); if (p) p.style.width = Math.round(r.value.hotovo * 100) + '%';
        await new Promise(ok => setTimeout(ok, 0));
        t = performance.now();
      }
    }
    if (tok !== beh) return;
    ukazKolize();
  }

  function stopa(a) {
    const el = $('stopa');
    el.innerHTML = '';
    if (!a || a.typ !== '1d') return;
    const roz = a.max - a.min || 1;
    for (const [u0, u1] of a.useky) {
      const i = document.createElement('i');
      const krok = (a.vzorky[1] ? a.vzorky[1].u - a.vzorky[0].u : 0) / 2;
      i.style.left = Math.max(0, (u0 - krok - a.min) / roz * 100) + '%';
      i.style.width = Math.min(100, (u1 - u0 + 2 * krok) / roz * 100) + '%';
      el.appendChild(i);
    }
  }

  function box(popis, cislo, dalsi, trida) {
    return `<div class="box ${trida || ''}"><div class="popis">${popis}</div><div class="cislo">${cislo}</div>${dalsi ? `<div class="dalsi">${dalsi}</div>` : ''}</div>`;
  }
  const mezeraText = x => (x === Infinity || x > 1 - 1e-9 ? '> 1 mm' : f(x) + ' mm');

  function ukazKolize() {
    const a = analyza, p = model.p, rez = model.rezim, out = [];
    stopa(a);
    if (a.kolizeVKlidu) {
      out.push(`<div class="stav-souhrn chyba"><b class="chyba">Díly se překrývají už v klidové poloze</b> (objem průniku ${f(a.objemKlid)} mm³). Zvětšete vůle nebo upravte rozměry – takto by se díly spekly dohromady nebo nešly smontovat.</div>`);
      $('kolize').innerHTML = out.join('');
      return;
    }
    if (a.typ === '1d') {
      const jedn = rez === 'pruzny' ? 'ohyb' : 'úhel';
      const celek = a.dosahMin && a.dosahMax;
      out.push(`<div class="stav-souhrn ${celek ? 'ok' : 'mez'}">${celek
        ? `Celý požadovaný rozsah ${f(a.min, 1)}° až ${f(a.max, 1)}° je bez kolize.`
        : `Volný pohyb jen od ${f(a.volnyOd, 1)}° do ${f(a.volnyDo, 1)}° – mimo něj se díly srazí (červené úseky pod posuvníkem).`}</div>`);
      const boxy = [];
      boxy.push(box('Volný rozsah', `${f(a.volnyOd, 1)}° … ${f(a.volnyDo, 1)}°`, `požadováno ${f(a.min, 0)}° … ${f(a.max, 0)}°`, celek ? 'dobre' : 'mez'));
      if (!a.dosahMax) boxy.push(box('První dotyk (+)', f(a.volnyDo, 1) + '°', `${jedn} při zavírání`, 'mez'));
      if (!a.dosahMin) boxy.push(box('První dotyk (−)', f(a.volnyOd, 1) + '°', `${jedn} opačným směrem`, 'mez'));
      const malaKlid = rez === 'pant' && a.mezeraKlid < 0.25;
      boxy.push(box('Mezera v klidu', mezeraText(a.mezeraKlid), rez === 'pant' ? 'při tisku v místě' : 'nejmenší vzdálenost dílů', malaKlid ? 'spatne' : ''));
      boxy.push(box('Nejmenší mezera v pohybu', mezeraText(a.nejmensiMezera), 've vzorcích volného rozsahu'));
      if (rez === 'pant' || rez === 'cep') {
        const t = J.teorieMezePantu(p);
        if (t.platne) boxy.push(box('Vzorec: dotyk listů', `${f(t.min, 1)}° / ${f(t.max, 1)}°`, 'rohy listů (viz poznámky dole); síť se liší jen náhradou kružnic mnohoúhelníky'));
      } else if (rez === 'pruzny') {
        const th = J.teorieOhybu(p), s = J.pruznyPasek(p, Math.max(Math.abs(a.min), Math.abs(a.max)));
        boxy.push(box('Vzorec: dotyk bloků', f(th, 1) + '°', 'θ = L / (H − t/2)'));
        const tr = s.eps > s.epsKr ? 'spatne' : s.eps > s.epsOpak ? 'mez' : 'dobre';
        boxy.push(box('Přetvoření pásku', f(s.eps * 100) + ' %', `při ${f(Math.max(Math.abs(a.min), Math.abs(a.max)), 0)}°; opakovaně do ${f(s.epsOpak * 100)} %, jednorázově do ${f(s.epsKr * 100)} % (${J.MATERIALY[p.material].nazev})`, tr));
        boxy.push(box('Moment ohybu', f(s.M) + ' N·mm', `orientačně při ${f(Math.max(Math.abs(a.min), Math.abs(a.max)), 0)}°, E = ${f(J.MATERIALY[p.material].E, 0)} MPa`));
      }
      out.push(`<div class="vysledky">${boxy.join('')}</div>`);
      if (malaKlid) out.push(`<p class="chybovy">Mezera mezi díly v klidové poloze je jen ${f(a.mezeraKlid)} mm – při tisku v místě se díly mohou spojit.</p>`);
      out.push(grafPrubehu(a));
    } else {
      const ok = a.celyRozsah;
      out.push(`<div class="stav-souhrn ${ok ? 'ok' : 'mez'}">${ok
        ? `Požadovaný náklon ${f(a.pozadovano, 0)}° je bez kolize ve všech směrech.`
        : `Ve všech směrech je volný náklon jen ${f(a.volnyNaklon, 1)}° (nejhorší směr ${f(a.nejhorsiAzimut, 0)}°); požadováno ${f(a.pozadovano, 0)}°.`}</div>`);
      const boxy = [];
      boxy.push(box('Volný náklon všemi směry', f(a.volnyNaklon, 1) + '°', `požadováno ${f(a.pozadovano, 0)}°`, ok ? 'dobre' : 'mez'));
      const maxi = Math.max(...a.azimuty.map(x => (x.mez === null ? a.pozadovano : x.mez)));
      boxy.push(box('Největší náklon', f(maxi, 1) + '°', 'v nejvýhodnějším směru (např. do zářezu)'));
      boxy.push(box('Vzorec bez zářezů', f(J.teorieNaklonu(p), 1) + '°', 'krček narazí na hranu hrdla'));
      boxy.push(box('Mezera v klidu', mezeraText(a.mezeraKlid), 'koule v jamce'));
      const z = J.zacvaknuti(p);
      if (z) boxy.push(box('Přetvoření při zacvaknutí', f(z.eps * 100) + ' %', `ε = 1,5·y·h/l², mez ${f(z.epsKr * 100)} % (${J.MATERIALY[p.material].nazev})`, z.eps > z.epsKr ? 'spatne' : z.eps > 0.7 * z.epsKr ? 'mez' : 'dobre'));
      out.push(`<div class="vysledky">${boxy.join('')}</div>`);
      out.push(grafPolarni(a));
    }
    $('kolize').innerHTML = out.join('');
  }

  /* graf průniku podle úhlu (1D): sloupce = objem průniku (log), zelená = volno */
  function grafPrubehu(a) {
    const W = 600, H = 90, x0 = 30, x1 = W - 8, y0 = 10, y1 = H - 22, roz = a.max - a.min || 1;
    const X = u => x0 + (u - a.min) / roz * (x1 - x0);
    const maxV = Math.max(1e-3, ...a.vzorky.map(s => s.objem));
    const sirka = Math.max(1, (x1 - x0) / a.vzorky.length);
    const pruhy = a.vzorky.map(s => {
      if (!s.kolize) return `<rect x="${(X(s.u) - sirka / 2).toFixed(1)}" y="${y1 - 3}" width="${sirka.toFixed(1)}" height="3" fill="var(--ok)"/>`;
      const h = Math.max(3, (Math.log10(1 + s.objem) / Math.log10(1 + maxV)) * (y1 - y0));
      return `<rect x="${(X(s.u) - sirka / 2).toFixed(1)}" y="${(y1 - h).toFixed(1)}" width="${sirka.toFixed(1)}" height="${h.toFixed(1)}" fill="var(--danger)"/>`;
    }).join('');
    const znacky = [];
    const krokZ = roz > 200 ? 90 : roz > 90 ? 45 : roz > 40 ? 15 : 5;
    for (let u = Math.ceil(a.min / krokZ) * krokZ; u <= a.max + 1e-9; u += krokZ)
      znacky.push(`<line x1="${X(u)}" x2="${X(u)}" y1="${y1}" y2="${y1 + 4}" stroke="var(--text-muted)"/><text x="${X(u)}" y="${H - 6}" text-anchor="middle">${f(u, 0)}°</text>`);
    return `<svg class="graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="Objem průniku dílů podle úhlu: zelená = bez kolize, červená = kolize">
      <line x1="${x0}" x2="${x1}" y1="${y1}" y2="${y1}" stroke="var(--border-strong)"/>${pruhy}${znacky.join('')}
      <text x="${x0}" y="9">objem průniku (log) – zeleně bez kolize</text></svg>`;
  }
  /* polární graf mezního náklonu podle směru */
  function grafPolarni(a) {
    const R = 80, c = 100, max = Math.max(a.pozadovano, 1);
    const bod = (az, nak) => { const r = R * Math.min(1, nak / max), t = az * Math.PI / 180; return [c + r * Math.cos(t), c - r * Math.sin(t)]; };
    const body = a.azimuty.map(x => bod(x.az, x.mez === null ? a.pozadovano : x.mez));
    const kruhy = [0.25, 0.5, 0.75, 1].map(k => `<circle cx="${c}" cy="${c}" r="${R * k}" fill="none" stroke="var(--border)"/><text x="${c}" y="${c + R * k - 3}" text-anchor="middle">${f(max * k, 0)}°</text>`).join('');
    return `<svg class="graf" viewBox="-24 -4 248 206" style="max-width:300px;margin-inline:auto" role="img" aria-label="Mezní náklon podle směru">
      ${kruhy}<polygon points="${body.map(b => b.map(x => x.toFixed(1)).join(',')).join(' ')}" fill="var(--accent-soft)" stroke="var(--accent)" stroke-width="1.5"/>
      <text x="${c + R + 3}" y="${c + 4}">0°</text><text x="${c}" y="${c - R - 4}" text-anchor="middle">90°</text><text x="${c - R - 3}" y="${c + 4}" text-anchor="end">180°</text>
      <text x="2" y="196">mezní náklon podle směru</text></svg>`;
  }

  /* ---------- upozornění ---------- */
  function ukazUpozorneni() {
    const p = norm.p, seznam = J.upozorneniTisku(stav.rezim, p);
    const html = [];
    for (const c of norm.chyby) html.push(`<li class="chyba"><b>Chyba parametrů</b>${c.text}</li>`);
    for (const u of seznam) html.push(`<li class="${u.uroven}"><b>${u.nadpis}</b>${u.text}</li>`);
    $('upozorneni').innerHTML = html.join('');
  }

  /* ---------- díly a STL ---------- */
  function uvolniTvary() {
    if (tvary) for (const t of Object.values(tvary)) try { t.man.delete(); } catch (e) { /* už uvolněno */ }
    tvary = null;
  }
  function zajistiTvary() {
    if (tvary || !model) return tvary;
    tvary = {};
    for (const e of model.exporty) tvary[e.id] = G.tiskovyTvar(e);
    return tvary;
  }
  function ukazDily() {
    zajistiTvary();
    const mat = J.MATERIALY[model.p.material];
    const radky = model.exporty.map(e => {
      const t = tvary[e.id], V = e.man.volume();
      return `<tr><td><span class="tecka" style="background:${barvaExportu(e.id)}"></span>${e.nazev}<span class="pozn-k">${e.poznamka}</span></td>
        <td class="cis">${f(t.sirka, 1)} × ${f(t.hloubka, 1)} × ${f(t.vyska, 1)} mm</td>
        <td class="cis">${f(V / 1000)} cm³</td><td class="cis">${f(V / 1000 * mat.hustota, 1)} g</td>
        <td><button type="button" class="male" data-stl="${e.id}">STL</button></td></tr>`;
    });
    $('tabDily').tBodies[0].innerHTML = radky.join('');
  }
  function barvaExportu(id) {
    const d = model.dily.find(x => x.id === id);
    return d ? d.barva : 'var(--text-faint)';
  }
  function stahni(data, nazev, typ) {
    const url = URL.createObjectURL(new Blob([data], { type: typ }));
    const a = document.createElement('a'); a.href = url; a.download = nazev;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  const nazevSouboru = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '').toLowerCase();
  function exportujSit(man, nazev) {
    const sit = G.sitDilu(man), k = J.zkontrolujSit(sit);
    if (!k.vodotesna || !(k.objem > 0)) { Dialog.chyba('Síť dílu není uzavřená – export se nepovedl. Zkuste změnit parametry.'); return null; }
    const buf = J.stlBinarni(sit, nazev);
    stahni(buf, nazevSouboru(`${J.REZIMY[model.rezim].kratce}_${nazev}`) + '.stl', 'model/stl');
    return { sit, kontrola: k, bajtu: buf.byteLength };
  }
  $('tabDily').addEventListener('click', e => {
    const b = e.target.closest('[data-stl]');
    if (!b || !model) return;
    zajistiTvary();
    const ex = model.exporty.find(x => x.id === b.dataset.stl);
    if (exportujSit(tvary[ex.id].man, ex.nazev)) Dialog.info('STL uloženo: ' + ex.nazev);
  });

  /* ---------- podložka ---------- */
  for (const [id, nazev] of J.PODLOZKY) $('podlozka').insertAdjacentHTML('beforeend', `<option value="${id}">${nazev}</option>`);
  function rozmeryPodlozky() {
    const pr = J.PODLOZKY.find(x => x[0] === stav.podlozka) || J.PODLOZKY[0];
    if (pr[0] === 'vlastni') {
      const W = J.cislo(stav.podlozkaW), D = J.cislo(stav.podlozkaD);
      return { sirka: Number.isFinite(W) && W >= 20 ? Math.min(W, 2000) : 220, hloubka: Number.isFinite(D) && D >= 20 ? Math.min(D, 2000) : 220 };
    }
    return { sirka: pr[2], hloubka: pr[3] };
  }
  function ukazPodlozku() {
    $('podlozka').value = stav.podlozka;
    $('vlastniW').hidden = $('vlastniD').hidden = stav.podlozka !== 'vlastni';
    if (!model) return;
    zajistiTvary();
    const pod = rozmeryPodlozky(), roz = Math.max(0, Math.min(50, J.cislo(stav.rozestup) || 0));
    const polozky = model.exporty.filter(e => e.naPodlozku).map(e => ({ id: e.id, sirka: tvary[e.id].sirka, hloubka: tvary[e.id].hloubka }));
    rozm = J.rozmisti(polozky, pod, roz);
    const W = pod.sirka, D = pod.hloubka;
    const mriz = [];
    for (let x = 10; x < W; x += 10) mriz.push(`<line class="mriz" x1="${x}" x2="${x}" y1="0" y2="${D}"/>`);
    for (let y = 10; y < D; y += 10) mriz.push(`<line class="mriz" x1="0" x2="${W}" y1="${y}" y2="${y}"/>`);
    const dily = rozm.umisteni.map(u => {
      const t = tvary[u.id], ex = model.exporty.find(e => e.id === u.id);
      const cesta = t.obrys.map(poly => 'M' + poly.map(([x, y]) => {
        const [px, py] = u.otoceno ? [t.hloubka - y, x] : [x, y];
        return `${(u.x + px).toFixed(2)},${(D - (u.y + py)).toFixed(2)}`;
      }).join('L') + 'Z').join('');
      const cx = u.x + u.sirka / 2, cy = D - (u.y + u.hloubka / 2);
      return `<path class="dil" d="${cesta}" fill="${barvaExportu(u.id)}"><title>${ex.nazev}</title></path><text x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" style="paint-order:stroke;stroke:var(--bg-input);stroke-width:1.6px">${ex.nazev}</text>`;
    }).join('');
    $('podlozkaSvg').innerHTML = `<svg class="podlozka-svg" viewBox="-2 -2 ${W + 4} ${D + 4}" role="img" aria-label="Rozmístění dílů na podložce ${W} × ${D} mm">
      <rect class="deska" x="0" y="0" width="${W}" height="${D}" rx="3"/>${mriz.join('')}${dily}</svg>`;
    const info = [`Podložka ${f(W, 0)} × ${f(D, 0)} mm, rozestup ${f(roz, 1)} mm, obsazeno ${f(rozm.vyuziti * 100, 1)} % plochy.`];
    if (rozm.nevejde.length) info.push(`<span class="chybovy">Nevejde se: ${rozm.nevejde.map(id => model.exporty.find(e => e.id === id).nazev).join(', ')} – zmenšete díl nebo zvolte větší podložku.</span>`);
    $('podlozkaInfo').innerHTML = info.join(' ');
    $('btnStlPodlozka').disabled = !rozm.umisteni.length;
  }
  $('podlozka').addEventListener('change', e => { stav.podlozka = e.target.value; ulozStav(); ukazPodlozku(); });
  $('podlozkaW').value = textCisla(stav.podlozkaW); $('podlozkaD').value = textCisla(stav.podlozkaD); $('rozestup').value = textCisla(stav.rozestup);
  for (const id of ['podlozkaW', 'podlozkaD', 'rozestup']) $(id).addEventListener('input', e => { stav[id] = e.target.value; ulozStav(); ukazPodlozku(); });
  $('btnStlPodlozka').addEventListener('click', () => {
    if (!model || !rozm) return;
    zajistiTvary();
    const m = G.podlozkaManifold(w, tvary, rozm);
    if (!m) return;
    try { if (exportujSit(m, 'podlozka')) Dialog.info('STL podložky uloženo'); } finally { m.delete(); }
  });

  /* ---------- režimy ---------- */
  function nastavRezim(r) {
    if (!J.REZIMY[r] || r === stav.rezim) return;
    zastavAnimaci();
    stav.rezim = r; ulozStav();
    postavFormular();
    prestav(true);
  }
  for (const b of document.querySelectorAll('#rezimy button')) b.addEventListener('click', () => nastavRezim(b.dataset.rezim));
  $('btnVychozi').addEventListener('click', async () => {
    if (!(await Dialog.potvrd('Vrátit všechny parametry režimu „' + J.REZIMY[stav.rezim].kratce + '“ na výchozí hodnoty?'))) return;
    stav.hodnoty[stav.rezim] = J.vychozi(stav.rezim); ulozStav();
    postavFormular(); prestav();
  });

  /* ---------- uložené návrhy ---------- */
  function ctiSady() { try { const s = JSON.parse(localStorage.getItem(KLIC_SADY) || '{}'); return s && typeof s === 'object' ? s : {}; } catch (e) { return {}; } }
  function zapisSady(s) { try { localStorage.setItem(KLIC_SADY, JSON.stringify(s)); return true; } catch (e) { Dialog.chyba('Návrh se nepodařilo uložit (úložiště prohlížeče je plné nebo zakázané).'); return false; } }
  function ukazSady(vybrat) {
    const s = ctiSady(), jm = Object.keys(s).sort((a, b) => a.localeCompare(b, 'cs'));
    const sel = $('sady');
    sel.innerHTML = jm.length ? jm.map(n => `<option>${n.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</option>`).join('') : '<option value="">(žádné uložené návrhy)</option>';
    if (vybrat && s[vybrat]) sel.value = vybrat;
    $('btnNacti').disabled = $('btnSmaz').disabled = !jm.length;
  }
  function nactiNavrh(data) {
    if (!data || !J.REZIMY[data.rezim] || typeof data.hodnoty !== 'object') throw new Error('soubor neobsahuje návrh pantu');
    const n = J.normalizuj(data.rezim, data.hodnoty);
    stav.rezim = data.rezim;
    stav.hodnoty[data.rezim] = Object.assign(J.vychozi(data.rezim), n.p);
    ulozStav();
    postavFormular(); prestav(true);
  }
  $('btnUloz').addEventListener('click', async () => {
    const jm = await Dialog.zeptej('Název návrhu', J.REZIMY[stav.rezim].kratce + ' ' + new Date().toLocaleDateString('cs-CZ'));
    if (!jm || !jm.trim()) return;
    const s = ctiSady();
    if (s[jm.trim()] && !(await Dialog.potvrd('Návrh „' + jm.trim() + '“ už existuje. Přepsat?'))) return;
    s[jm.trim()] = { rezim: stav.rezim, hodnoty: Object.assign({}, stav.hodnoty[stav.rezim]), cas: new Date().toISOString() };
    if (zapisSady(s)) { ukazSady(jm.trim()); Dialog.info('Návrh uložen'); }
  });
  $('btnNacti').addEventListener('click', () => {
    const s = ctiSady(), x = s[$('sady').value];
    if (!x) return;
    try { nactiNavrh(x); Dialog.info('Načteno: ' + $('sady').value); } catch (e) { Dialog.chyba('Návrh nejde načíst: ' + e.message); }
  });
  $('btnSmaz').addEventListener('click', async () => {
    const jm = $('sady').value, s = ctiSady();
    if (!s[jm] || !(await Dialog.potvrd('Smazat návrh „' + jm + '“?'))) return;
    delete s[jm];
    if (zapisSady(s)) ukazSady();
  });
  $('btnExportJson').addEventListener('click', () => {
    const data = { format: 'webapp_panty', verze: 1, rezim: stav.rezim, hodnoty: stav.hodnoty[stav.rezim], ulozeno: new Date().toISOString() };
    stahni(JSON.stringify(data, null, 2), nazevSouboru('navrh_' + J.REZIMY[stav.rezim].kratce) + '.json', 'application/json');
  });
  $('btnImportJson').addEventListener('click', () => $('souborJson').click());
  $('souborJson').addEventListener('change', async e => {
    const soubor = e.target.files[0]; e.target.value = '';
    if (!soubor) return;
    try {
      if (soubor.size > 1e6) throw new Error('soubor je příliš velký');
      const data = JSON.parse(await soubor.text());
      if (data.format !== 'webapp_panty') throw new Error('není to návrh z této stránky');
      nactiNavrh(data);
      Dialog.info('Návrh načten ze souboru');
    } catch (err) { Dialog.chyba('Soubor nejde načíst: ' + err.message); }
  });

  /* ---------- start ---------- */
  $('neovereno').textContent = J.NEOVERENO;
  postavFormular();
  ukazSady();
  ukazPodlozku();
  norm = J.normalizuj(stav.rezim, stav.hodnoty[stav.rezim]);
  ukazStavPoli(); ukazUpozorneni();
  try { S.init($('platno3d')); scena3d = true; }
  catch (e) { scena3d = false; console.error(e); zprava3d('3D náhled nelze zobrazit (' + (e && e.message || e) + '). Kontrola kolizí, export a rozmístění fungují dál.'); }
  $('platno3d').addEventListener('scenachyba', e => zprava3d(e.detail));
  $('platno3d').addEventListener('scenaobnovena', () => { zprava3d(null); if (model) prestav(); });
  nactiManifold().then(m => { w = m; if (scena3d) zprava3d(null); prestav(true); })
    .catch(e => { zprava3d('Výpočetní jádro (manifold-3d) se nepodařilo načíst: ' + (e && e.message || e)); $('kolize').innerHTML = '<p class="chybovy">Bez výpočetního jádra nejde sestavit model.</p>'; });

  /* rozhraní pro testy */
  window.PANTY_UI = {
    stav, nastavRezim, prestav,
    nastav(klic, hodnota) { stav.hodnoty[stav.rezim][klic] = hodnota; postavFormular(); prestav(); },
    poloha(u, az) { zastavAnimaci(); poloha.u = u; poloha.az = az || 0; $('uhel').value = u; $('azimut').value = poloha.az; nastavPolohu(); },
    model: () => model, analyza: () => analyza, norm: () => norm, rozmisteni: () => rozm,
    pripraveno: () => !!w && !!model
  };
})();

/* Pružné mechanismy – ovládání stránky nad společným zapojením gen3d/aplikace.js: tady jen to, co je pro pružné
   mechanismy zvláštní (formulář z PRUZ.PARAMETRY, druhy, graf síla–průhyb, vzorce, výsledky, kusovník, export po dílech).
   Historie, hlášení, soubory, sdílení, klávesy a manifold dělá G3D.aplikace. */
/* global PRUZ, PRUZ_GEO, KNOF_NAHLED, KRAB, G3D, TrubkyGui, Dialog */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const J = PRUZ, fmt = J.fmt;
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  let p, vysl = null, model = null, wasm = null, chybaStavby = '', bezi = false;
  const stavZobr = { tisk: true };

  /* ---------- formulář (pole s data-p pro G3D.aplikace; čísla se přepočítávají už při psaní) ---------- */
  const zobrazCislo = x => (Number.isFinite(x) ? String(Math.round(x * 1e4) / 1e4).replace('.', ',') : '');
  function vytvorPole(d) {
    const obal = document.createElement('div');
    obal.className = 'pole'; obal.dataset.klic = d.klic;
    const id = 'f_' + d.klic;
    if (d.typ === 'bool') {
      obal.classList.add('siroke');
      obal.innerHTML = `<label class="zaskrt"><input type="checkbox" id="${id}" data-p="${d.klic}" data-typ="bool"> ${d.nazev}</label>`;
    } else if (d.typ === 'vyber') {
      obal.classList.add('siroke');
      obal.innerHTML = `<label for="${id}">${d.nazev}</label><select id="${id}" data-p="${d.klic}" data-typ="text">${d.volby.map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select>`;
    } else {
      obal.innerHTML = `<label for="${id}">${d.nazev}</label><input type="text" inputmode="decimal" class="mm" id="${id}" data-p="${d.klic}" title="${fmt(d.min, 2)} až ${fmt(d.max, 2)} ${d.j || ''}"><span class="jedn">${d.j || ''}</span>`;
      const inp = obal.querySelector('input');
      inp.addEventListener('input', () => {
        let n = G3D.ctiCislo(inp.value);
        if (d.typ === 'cele') n = Math.round(n);
        const dobre = Number.isFinite(n) && n >= d.min && n <= d.max;
        inp.classList.toggle('spatne', !dobre);
        if (dobre) app.zmen(q => { q[d.klic] = n; }, d.klic);
      });
      inp.addEventListener('blur', () => { inp.value = zobrazCislo(app.p[d.klic]); inp.classList.remove('spatne'); });
      // vlastní krok šipek (jemnější u malých rozsahů) – registrováno dřív než G3D.aplikace, její obsluhu zastaví
      inp.addEventListener('keydown', e => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        e.preventDefault(); e.stopImmediatePropagation();
        const krok = e.shiftKey ? 10 : e.altKey ? 0.1 : (d.max - d.min <= 10 ? 0.1 : 1);
        const n = Math.min(d.max, Math.max(d.min, Math.round((app.p[d.klic] + (e.key === 'ArrowUp' ? krok : -krok)) * 1e4) / 1e4));
        inp.value = zobrazCislo(n); app.zmen(q => { q[d.klic] = n; }, d.klic);
      });
    }
    return obal;
  }
  /** Přepnutí druhu: parametry zůstanou (každý druh má svoje), název se změní, jen když byl výchozí. */
  function prepniTyp(k) {
    if (app.p.typ === k) return;
    app.zmen(q => { if (Object.values(J.TYPY).some(x => x.nazev === q.nazev)) q.nazev = J.TYPY[k].nazev; q.typ = k; });
    app.naplnFormular();
  }
  function postavFormular() {
    const skupiny = new Map();
    for (const d of J.PARAMETRY) {
      if (!skupiny.has(d.skupina)) skupiny.set(d.skupina, []);
      skupiny.get(d.skupina).push(d);
    }
    for (const [sk, pole] of skupiny) {
      const det = document.createElement('details');
      det.className = 'oddil'; det.dataset.oddil = sk; det.open = true; det.dataset.skupina = sk;
      det.innerHTML = `<summary><span class="oddil-nazev">${sk}</span><span class="souhrn"></span></summary><div class="oddil-telo"><div class="mrizka"></div></div>`;
      const m = det.querySelector('.mrizka');
      pole.forEach(d => m.appendChild(vytvorPole(d)));
      (sk === 'Tisk' ? $('poleOut') : $('poleIn')).appendChild(det);
    }
    for (const [k, t] of Object.entries(J.TYPY)) {
      const b = document.createElement('button');
      b.type = 'button'; b.dataset.typ = k; b.innerHTML = `<b aria-hidden="true">${t.znak}</b>${t.nazev}`; b.title = t.popis;
      b.addEventListener('click', () => prepniTyp(k));
      $('typy').appendChild(b);
      // Předvolby: první skupina = druh mechanismu
      const pol = document.createElement('button'); pol.className = 'pol'; pol.setAttribute('role', 'menuitem'); pol.dataset.typ = k;
      pol.innerHTML = `${t.znak} ${t.nazev}<span class="pozn">ponechá rozměry</span>`;
      pol.addEventListener('click', () => prepniTyp(k));
      $('seznamTypu').appendChild(pol);
    }
  }
  function viditelnost() {
    p = app.p;
    document.querySelectorAll('.pole[data-klic]').forEach(el => { el.hidden = !J.viditelny(J.PODLE_KLICE[el.dataset.klic], p); });
    document.querySelectorAll('details[data-skupina]').forEach(det => { det.hidden = !det.querySelector('.pole[data-klic]:not([hidden])'); });
    document.querySelectorAll('#typy button, #seznamTypu button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.typ === p.typ)));
    $('popisTypu').textContent = J.TYPY[p.typ].popis;
  }
  postavFormular();

  const nahled = KNOF_NAHLED.vytvorNahled($('platno'));
  const app = G3D.aplikace({
    typ: 'pruzne', nazev: 'Pružné mechanismy', klic: 'webapp_pruzne', soubor: 'pruzny_mechanismus',
    normalizuj: J.normalizuj, vychozi: () => (bezi ? J.vychozi(app.p.typ) : J.zPredvolby(0)),   // tlačítko = výchozí hodnoty zvoleného druhu
    ulozProjekt: J.ulozProjekt, nactiProjekt: J.nactiProjekt,
    popis: q => `${(J.TYPY[q.typ] || J.TYPY.pant).nazev} – ${(J.MATERIALY[q.material] || {}).nazev || ''}`,
    viditelnost: () => viditelnost(),
    prepocitej: () => prepocitej(), zpozdeni: 120,
    png: () => nahled.png(), pohled: j => nahled.pohled(j),
    exportStl: () => exportStl(),
    doModelare: () => (lzeExport() ? { data: KRAB.soubor3mf(model.kusy, app.p.nazev || 'Pružný mechanismus'), pripona: '.3mf' } : null),
    zkratky: { h: 'tHrany', m: 'tTisk', p: 'tPrevisy', l: 'tPravitka' },
    hlaseniNavic: (li, x) => { const d = x.pole.length && J.PODLE_KLICE[x.pole[0]], k = li.querySelector('.kam'); if (d && k) k.textContent = '→ ' + d.nazev; },
    zmenaTematu: () => { if (vysl) prepocitej(); },
  });

  /* ---------- výpočet a vykreslení ---------- */
  function ukazNahled() {
    if (!model) { nahled.nastav(null); $('legPrevisy').hidden = true; return; }
    nahled.nastav(stavZobr.tisk ? model.kusy : KRAB.tiskoveRozlozeni(model.dily, 6), { tisk: stavZobr.tisk, uhel: 45 });
    $('legPrevisy').hidden = !(stavZobr.tisk && nahled.stav.previsy);
  }
  function prepocitej() {
    p = app.p;
    vysl = J.vypocet(p);
    const H = J.kontroly(p, vysl).map(h => Object.assign({}, h, { pole: h.pole ? [h.pole] : [] }));
    nahled.barvy(css('--border-strong'), css('--border'), css('--text'));
    model = null;
    if (wasm) {
      try { model = PRUZ_GEO.postav(wasm, p); chybaStavby = ''; } catch (e) { chybaStavby = e.message || String(e); }
    }
    const st = $('stav3d');
    st.textContent = chybaStavby || (wasm ? '' : st.textContent);
    st.classList.toggle('chyba', !!chybaStavby);
    ukazNahled();
    app.hlaseni(H, { chybaStavby: chybaStavby && 'Geometrie: ' + chybaStavby, boxy: ['boxIn', 'boxOut'] });
    dlazdice();
    kresliGraf();
    vzorce();
    seznamDilu();
    souhrny();
  }
  function souhrny() {
    document.querySelectorAll('details[data-skupina]').forEach(det => {
      const vid = [...det.querySelectorAll('.pole[data-klic]:not([hidden])')].map(el => J.PODLE_KLICE[el.dataset.klic]).filter(d => !d.typ || d.typ === 'cele').slice(0, 3);
      det.querySelector('.souhrn').textContent = vid.map(d => `${fmt(p[d.klic], 2)}${d.j === '°' ? '°' : ''}`).join(' · ');
    });
  }

  function dlazdice() {
    const html = (popis, cislo, jedn, dalsi, hlavni) => `<div class="dlazdice${hlavni ? ' hlavni' : ''}"><div class="popis">${popis}</div><div class="cislo">${cislo} <small>${jedn || ''}</small></div>${dalsi ? `<div class="dalsi">${dalsi}</div>` : ''}</div>`;
    const m = J.MATERIALY[p.material];
    $('vMech').innerHTML = vysl.vel.map((v, i) => html(v.popis, v.hodnota, v.jedn, v.dalsi, i === 0)).join('')
      + html('Využití meze', fmt(vysl.vyuziti * 100, 0), '%', `${vysl.opakovane ? 'opakovaný ohyb' : 'krátkodobě'} – ${m.nazev}`);
    const tabKus = document.querySelector('[data-zalozka="kusovnik"]');
    tabKus.hidden = !model || model.dily.length < 2;
    if (tabKus.hidden && tabKus.getAttribute('aria-selected') === 'true') TrubkyGui.otevriZalozku('vysledky');
    if (!model) { $('vTisk').innerHTML = html('Geometrie', wasm ? 'chyba' : '…', '', chybaStavby || 'čeká na manifold-3d'); $('tKusovnik').innerHTML = ''; return; }
    let objem = 0; const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (const d of model.kusy) { const o = KRAB.obal(d.poz); for (let k = 0; k < 3; k++) { b[k] = Math.min(b[k], o[k]); b[k + 3] = Math.max(b[k + 3], o[k + 3]); } }
    for (const d of model.kusy) objem += Math.abs(KRAB.kontrolaSite(d.poz, d.idx).objem);
    const od = J.odhadTisku(objem, b[5] - b[2], p), min = Math.round(od.cas / 60);
    $('vTisk').innerHTML = html('Rozměr na podložce', `${fmt(b[3] - b[0], 1)} × ${fmt(b[4] - b[1], 1)} × ${fmt(b[5] - b[2], 1)}`, 'mm', `${model.kusy.length} ${model.kusy.length === 1 ? 'díl' : model.kusy.length < 5 ? 'díly' : 'dílů'}`)
      + html('Objem', fmt(objem / 1000, 2), 'cm³', 'při 100 % výplni')
      + html('Hmotnost', fmt(od.hmotnost, 1), 'g', `${m.nazev}, ${fmt(m.hustota, 2)} g/cm³`)
      + html('Filament', fmt(od.filament, 2), 'm', 'Ø 1,75 mm')
      + html('Doba tisku', min < 60 ? String(min) : `${Math.floor(min / 60)} h ${min % 60}`, min < 60 ? 'min' : 'min', 'hrubý odhad');
    // kusovník: jedna sada dílů
    $('tKusovnik').innerHTML = '<tr><th>Díl</th><th class="c">Rozměr mm</th><th class="c">cm³</th><th class="c">g</th><th class="c">ks</th></tr>'
      + model.dily.map(d => {
        const o = KRAB.obal(d.poz), g = Math.abs(d.objem) / 1000 * m.hustota;
        return `<tr><td>${d.nazev}</td><td class="c">${fmt(o[3] - o[0], 1)} × ${fmt(o[4] - o[1], 1)} × ${fmt(o[5] - o[2], 1)}</td><td class="c">${fmt(Math.abs(d.objem) / 1000, 2)}</td><td class="c">${fmt(g, 1)}</td><td class="c">${Math.max(1, Math.round(p.kusu || 1))}</td></tr>`;
      }).join('');
  }

  /* ---------- graf síla – průhyb ---------- */
  function kresliGraf() {
    const c = $('graf'), g = vysl.graf, dpr = window.devicePixelRatio || 1;
    const W = c.clientWidth || 300, Hh = c.clientHeight || 200;
    c.width = Math.round(W * dpr); c.height = Math.round(Hh * dpr);
    const x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, W, Hh);
    if (!g) return;
    const barva = { text: css('--text'), muted: css('--text-muted'), faint: css('--text-faint'), mriz: css('--border'), acc: css('--accent'), warn: css('--warn'), dang: css('--danger'), ok: css('--ok') };
    const body = g.krivky.flatMap(k => k.body);
    let x1 = Math.max(...body.map(b => b[0]), ...(g.svisle || []).map(s => s.x)) || 1;
    let y0 = Math.min(0, ...body.map(b => b[1])), y1 = Math.max(...body.map(b => b[1])) || 1;
    const pad = (y1 - y0) * 0.08; y1 += pad; if (y0 < 0) y0 -= pad;
    const L = 52, R = 12, T = 12, B = 34, sx = v => L + v / x1 * (W - L - R), sy = v => T + (y1 - v) / (y1 - y0) * (Hh - T - B);
    const krokOsy = r => { const s = 10 ** Math.floor(Math.log10(r / 5)); return [1, 2, 2.5, 5, 10].map(k => k * s).find(k => r / k <= 6); };
    x.font = '11px system-ui, sans-serif'; x.lineWidth = 1;
    const kx = krokOsy(x1), ky = krokOsy(y1 - y0);
    x.strokeStyle = barva.mriz; x.fillStyle = barva.muted; x.textAlign = 'center'; x.textBaseline = 'top';
    for (let v = 0; v <= x1 + 1e-9; v += kx) { x.beginPath(); x.moveTo(sx(v), T); x.lineTo(sx(v), Hh - B); x.stroke(); x.fillText(fmt(v, 2), sx(v), Hh - B + 4); }
    x.textAlign = 'right'; x.textBaseline = 'middle';
    for (let v = Math.ceil(y0 / ky) * ky; v <= y1 + 1e-9; v += ky) { x.beginPath(); x.moveTo(L, sy(v)); x.lineTo(W - R, sy(v)); x.stroke(); x.fillText(fmt(v, 2), L - 5, sy(v)); }
    if (y0 < 0) { x.strokeStyle = barva.faint; x.lineWidth = 1.5; x.beginPath(); x.moveTo(L, sy(0)); x.lineTo(W - R, sy(0)); x.stroke(); x.lineWidth = 1; }
    x.fillStyle = barva.muted; x.textAlign = 'center'; x.textBaseline = 'bottom'; x.fillText(g.osaX, (L + W - R) / 2, Hh - 2);
    x.save(); x.translate(12, (T + Hh - B) / 2); x.rotate(-Math.PI / 2); x.textBaseline = 'middle'; x.fillText(g.osaY, 0, 0); x.restore();
    const legenda = [`<span><i></i>${g.krivky[0].popis}</span>`];
    const druhy = { prac: [barva.text, 'pracovní bod'], opak: [barva.warn, 'mez opakovaného ohybu'], kr: [barva.dang, 'krátkodobá mez'], doraz: [barva.muted, 'doraz'] };
    for (const s of g.svisle || []) {
      const [b, n] = druhy[s.druh] || druhy.prac;
      x.strokeStyle = b; x.setLineDash([5, 4]); x.lineWidth = 1.5;
      x.beginPath(); x.moveTo(sx(s.x), T); x.lineTo(sx(s.x), Hh - B); x.stroke(); x.setLineDash([]);
      if (!legenda.some(l => l.includes(n))) legenda.push(`<span><i class="${s.druh === 'doraz' ? 'prac' : s.druh}" style="border-top-color:${b}"></i>${n}${s.druh === 'prac' ? '' : ' ' + fmt(s.x, 1)}</span>`);
    }
    x.strokeStyle = barva.acc; x.lineWidth = 2.2; x.beginPath();
    g.krivky[0].body.forEach(([a, b], i) => (i ? x.lineTo(sx(a), sy(b)) : x.moveTo(sx(a), sy(b)))); x.stroke();
    for (const bod of g.body || []) {
      x.fillStyle = barva.ok; x.beginPath(); x.arc(sx(bod.x), sy(bod.y), 4.5, 0, 2 * Math.PI); x.fill();
      x.fillStyle = barva.text; x.textAlign = 'center'; x.textBaseline = 'bottom'; x.fillText(bod.popis, Math.min(W - R - 30, Math.max(L + 30, sx(bod.x))), sy(bod.y) - 7);
    }
    $('legenda').innerHTML = legenda.join('');
  }
  new ResizeObserver(() => { if (vysl) kresliGraf(); }).observe($('graf'));

  function vzorce() {
    $('vzorce').innerHTML = vysl.vzorce.map(v => `<li>${v}</li>`).join('');
    $('datumDat').textContent = J.DATUM_DAT;
    const pc = x => fmt(x * 100, 1) + ' %';
    $('tabMat').innerHTML = '<tr><th>Materiál</th><th class="c">E [MPa]</th><th class="c">ε krátk.</th><th class="c">ε opak.</th><th class="c">μ</th><th>Únava</th></tr>'
      + Object.entries(J.MATERIALY).map(([k, m]) => `<tr${k === p.material ? ' class="vybrany"' : ''}><td>${m.nazev}</td><td class="c">${fmt(m.E, 0)}</td><td class="c">${pc(m.epsKr)}</td><td class="c">${pc(m.epsOpak)}</td><td class="c">${fmt(m.mu, 2)}</td><td>${m.cykly}</td></tr>`).join('');
  }

  /* ---------- export ---------- */
  const lzeExport = () => {
    if (!model) { Dialog.chyba(wasm ? 'Model nelze sestavit: ' + chybaStavby : 'Geometrické jádro se ještě načítá.'); return false; }
    return true;
  };
  function exportStl(kusy, pripona = '') { if (lzeExport()) app.stahni(KRAB.stlBinarni(kusy || model.kusy, 'pruzne mechanismy - github_site'), app.jmeno(pripona + '.stl'), 'model/stl'); }
  function export3mf(kusy, pripona = '') { if (lzeExport()) app.stahni(KRAB.soubor3mf(kusy || model.kusy, app.p.nazev || 'Pružný mechanismus'), app.jmeno(pripona + '.3mf'), 'model/3mf'); }
  $('btnStl').addEventListener('click', () => exportStl());
  $('btn3mf').addEventListener('click', () => export3mf());
  function seznamDilu() {
    const s = $('seznamDilu'); s.innerHTML = '';
    if (!model || model.dily.length < 2) return;
    for (const d of model.dily) {
      const kusy = () => KRAB.tiskoveRozlozeni(model.kusy.filter(k => k.jmeno === d.jmeno), 6);
      for (const [fmtN, f] of [['STL', exportStl], ['3MF', export3mf]]) {
        const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
        b.innerHTML = `⬇ ${d.nazev} <span class="pozn">${fmtN}</span>`;
        b.addEventListener('click', () => f(kusy(), '_' + d.jmeno));
        s.appendChild(b);
      }
    }
  }

  /* ---------- nabídky ---------- */
  J.PREDVOLBY.forEach((v, i) => {
    const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
    b.innerHTML = `${J.TYPY[v.p.typ].znak} ${v.nazev}<span class="pozn">${v.popis}</span>`;
    b.addEventListener('click', () => app.nahrad(J.zPredvolby(i)));
    $('seznamPredvoleb').appendChild(b);
  });
  app.prepinac('tHrany', h => nahled.prepni('hrany', h));
  app.prepinac('tTisk', h => { stavZobr.tisk = h; ukazNahled(); });
  app.prepinac('tPrevisy', h => { nahled.prepni('previsy', h); $('legPrevisy').hidden = !(h && stavZobr.tisk && model); }, true);
  app.prepinac('tPravitka', h => nahled.prepni('pravitka', h), true);

  /* ---------- start ---------- */
  TrubkyGui.pripoj({ klic: 'webapp_pruzne_gui', pohled: j => nahled.pohled(j) });
  bezi = true;
  app.start({
    manifold: {
      ok: w => { wasm = w; $('stav3d').textContent = ''; prepocitej(); },
      chyba: e => { chybaStavby = 'geometrické jádro manifold-3d se nenačetlo (' + (e && e.message || e) + ') – výpočty fungují, náhled a export ne.'; prepocitej(); },
    },
  });

  window.__pruzne = { get p() { return app.p; }, get model() { return model; }, get vysl() { return vysl; }, nahled, app,
    nastav: q => { app.nahrad(J.normalizuj(Object.assign(J.kopie(app.p), q)).p); } };
})();

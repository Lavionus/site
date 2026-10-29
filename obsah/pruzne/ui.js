/* Pružné mechanismy – ovládání stránky: formulář z PRUZ.PARAMETRY, přepočet, graf, kontroly, export. */
/* global PRUZ, PRUZ_GEO, PRUZ_NAHLED, KRAB, TrubkyGui, Dialog, Tvary */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const J = PRUZ, fmt = J.fmt;
  const KLIC = 'webapp_pruzne_projekt';
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  let p, vysl = null, model = null, wasm = null, chybaStavby = '';

  function nactiUlozeny() {
    try { const t = localStorage.getItem(KLIC); if (t) return J.normalizuj(JSON.parse(t)).p; } catch (e) { /* bez úložiště */ }
    return J.zPredvolby(0);
  }
  const uloz = () => { try { localStorage.setItem(KLIC, JSON.stringify(p)); } catch (e) { /* bez úložiště */ } };

  /* ---------- formulář ---------- */
  const zobrazCislo = x => (Number.isFinite(x) ? String(Math.round(x * 1e4) / 1e4).replace('.', ',') : '');
  const ctiCislo = s => { const t = String(s).trim().replace(/\s/g, '').replace(',', '.').replace('−', '-'); return t === '' ? NaN : Number(t); };

  function vytvorPole(d) {
    const obal = document.createElement('div');
    obal.className = 'pole'; obal.dataset.klic = d.klic;
    const id = 'f_' + d.klic;
    if (d.typ === 'bool') {
      obal.classList.add('siroke');
      obal.innerHTML = `<label class="zaskrt"><input type="checkbox" id="${id}"> ${d.nazev}</label>`;
      obal.querySelector('input').addEventListener('change', e => zmen(d.klic, e.target.checked));
    } else if (d.typ === 'vyber') {
      obal.classList.add('siroke');
      obal.innerHTML = `<label for="${id}">${d.nazev}</label><select id="${id}">${d.volby.map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select>`;
      obal.querySelector('select').addEventListener('change', e => zmen(d.klic, e.target.value));
    } else {
      obal.innerHTML = `<label for="${id}">${d.nazev}</label><input type="text" inputmode="decimal" class="mm" id="${id}" title="${fmt(d.min, 2)} až ${fmt(d.max, 2)} ${d.j || ''}"><span class="jedn">${d.j || ''}</span>`;
      const inp = obal.querySelector('input');
      inp.addEventListener('input', () => {
        let n = ctiCislo(inp.value);
        if (d.typ === 'cele') n = Math.round(n);
        const dobre = Number.isFinite(n) && n >= d.min && n <= d.max;
        inp.classList.toggle('spatne', !dobre);
        if (dobre) zmen(d.klic, n, true);
      });
      inp.addEventListener('blur', () => { inp.value = zobrazCislo(p[d.klic]); inp.classList.remove('spatne'); });
      inp.addEventListener('keydown', e => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        e.preventDefault();
        const krok = e.shiftKey ? 10 : e.altKey ? 0.1 : (d.max - d.min <= 10 ? 0.1 : 1);
        const n = Math.min(d.max, Math.max(d.min, Math.round((p[d.klic] + (e.key === 'ArrowUp' ? krok : -krok)) * 1e4) / 1e4));
        inp.value = zobrazCislo(n); zmen(d.klic, n, true);
      });
    }
    return obal;
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
    const typy = $('typy');
    for (const [k, t] of Object.entries(J.TYPY)) {
      const b = document.createElement('button');
      b.type = 'button'; b.dataset.typ = k; b.innerHTML = `<b aria-hidden="true">${t.znak}</b>${t.nazev}`; b.title = t.popis;
      b.addEventListener('click', () => { if (p.typ !== k) { p.typ = k; if (Object.values(J.TYPY).some(x => x.nazev === p.nazev)) p.nazev = t.nazev; naplnFormular(); prepocitej(); } });
      typy.appendChild(b);
    }
  }
  function naplnFormular() {
    for (const d of J.PARAMETRY) {
      const el = $('f_' + d.klic);
      if (d.typ === 'bool') el.checked = !!p[d.klic];
      else if (d.typ === 'vyber') el.value = p[d.klic];
      else if (document.activeElement !== el) { el.value = zobrazCislo(p[d.klic]); el.classList.remove('spatne'); }
    }
    $('f_nazev').value = p.nazev || '';
    viditelnost();
  }
  function viditelnost() {
    document.querySelectorAll('.pole[data-klic]').forEach(el => { el.hidden = !J.viditelny(J.PODLE_KLICE[el.dataset.klic], p); });
    document.querySelectorAll('details[data-skupina]').forEach(det => { det.hidden = !det.querySelector('.pole[data-klic]:not([hidden])'); });
    document.querySelectorAll('#typy button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.typ === p.typ)));
    $('popisTypu').textContent = J.TYPY[p.typ].popis;
  }
  let casovac = null;
  function zmen(klic, hodnota, cislo) {
    p[klic] = hodnota;
    if (!cislo) viditelnost();
    else if (J.PARAMETRY.some(d => d.kdy && d.typy.includes(p.typ))) viditelnost();
    clearTimeout(casovac);
    casovac = setTimeout(prepocitej, cislo ? 140 : 0);
  }
  $('f_nazev').addEventListener('input', e => { p.nazev = e.target.value; uloz(); });

  /* ---------- výpočet a vykreslení ---------- */
  const nahled = PRUZ_NAHLED.vytvorNahled($('platno'));
  function prepocitej() {
    uloz();
    vysl = J.vypocet(p);
    const H = J.kontroly(p, vysl);
    nahled.barvy(css('--border-strong'), css('--border'), css('--text'));
    model = null;
    if (wasm) {
      try { model = PRUZ_GEO.postav(wasm, p); chybaStavby = ''; } catch (e) { chybaStavby = e.message || String(e); }
    }
    const st = $('stav3d');
    st.textContent = chybaStavby || (wasm ? '' : st.textContent);
    st.classList.toggle('chyba', !!chybaStavby);
    nahled.nastav(model ? model.kusy : null);
    vypisHlaseni(H);
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

  function vypisHlaseni(H) {
    const ul = $('hlaseni'); ul.innerHTML = '';
    const poradi = { chyba: 0, varovani: 1, ok: 2, info: 3 };
    const vse = H.slice();
    if (chybaStavby) vse.unshift({ uroven: 'chyba', text: 'Geometrie: ' + chybaStavby, pole: null });
    vse.sort((a, b) => poradi[a.uroven] - poradi[b.uroven]);
    for (const h of vse) {
      const li = document.createElement('li');
      li.className = h.uroven; li.tabIndex = 0;
      const d = h.pole && J.PODLE_KLICE[h.pole];
      li.innerHTML = `${{ chyba: '⛔', varovani: '⚠️', ok: '✅', info: 'ℹ️' }[h.uroven]} ${h.text}` + (d ? `<span class="kam">→ ${d.nazev}</span>` : '');
      if (d) { const skoc = () => skocNaPole(h.pole); li.addEventListener('click', skoc); li.addEventListener('keydown', e => { if (e.key === 'Enter') skoc(); }); }
      ul.appendChild(li);
    }
    const ch = vse.filter(h => h.uroven === 'chyba').length, va = vse.filter(h => h.uroven === 'varovani').length;
    const o = $('stavOdznak');
    o.className = 'odznak ' + (ch ? 'chyba' : va ? 'mez' : 'ok');
    o.textContent = ch ? `⛔ ${ch} chyb${ch === 1 ? 'a' : ch < 5 ? 'y' : ''}` : va ? `⚠️ ${va} varování` : '✅ v pořádku';
    const vBoxu = box => vse.some(h => h.uroven === 'chyba' && h.pole && $('f_' + h.pole) && $(box).contains($('f_' + h.pole)));
    TrubkyGui.oznacChybu('boxIn', vBoxu('boxIn')); TrubkyGui.oznacChybu('boxOut', vBoxu('boxOut'));
  }
  function skocNaPole(klic) {
    const el = $('f_' + klic); if (!el) return;
    const det = el.closest('details'); if (det) det.open = true;
    TrubkyGui.ukazBox($('boxOut').contains(el) ? 'out' : 'in');
    const pole = el.closest('.pole');
    pole.scrollIntoView({ block: 'center', behavior: 'smooth' });
    pole.classList.remove('zvyrazni'); void pole.offsetWidth; pole.classList.add('zvyrazni');
    el.focus({ preventScroll: true });
  }

  function dlazdice() {
    const html = (popis, cislo, jedn, dalsi, hlavni) => `<div class="dlazdice${hlavni ? ' hlavni' : ''}"><div class="popis">${popis}</div><div class="cislo">${cislo} <small>${jedn || ''}</small></div>${dalsi ? `<div class="dalsi">${dalsi}</div>` : ''}</div>`;
    const m = J.MATERIALY[p.material];
    $('vMech').innerHTML = vysl.vel.map((v, i) => html(v.popis, v.hodnota, v.jedn, v.dalsi, i === 0)).join('')
      + html('Využití meze', fmt(vysl.vyuziti * 100, 0), '%', `${vysl.opakovane ? 'opakovaný ohyb' : 'krátkodobě'} – ${m.nazev}`);
    if (!model) { $('vTisk').innerHTML = html('Geometrie', wasm ? 'chyba' : '…', '', chybaStavby || 'čeká na manifold-3d'); return; }
    let objem = 0; const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (const d of model.kusy) { const o = KRAB.obal(d.poz); for (let k = 0; k < 3; k++) { b[k] = Math.min(b[k], o[k]); b[k + 3] = Math.max(b[k + 3], o[k + 3]); } }
    for (const d of model.kusy) objem += Math.abs(KRAB.kontrolaSite(d.poz, d.idx).objem);
    const od = J.odhadTisku(objem, b[5] - b[2], p), min = Math.round(od.cas / 60);
    $('vTisk').innerHTML = html('Rozměr na podložce', `${fmt(b[3] - b[0], 1)} × ${fmt(b[4] - b[1], 1)} × ${fmt(b[5] - b[2], 1)}`, 'mm', `${model.kusy.length} ${model.kusy.length === 1 ? 'díl' : model.kusy.length < 5 ? 'díly' : 'dílů'}`)
      + html('Objem', fmt(objem / 1000, 2), 'cm³', 'při 100 % výplni')
      + html('Hmotnost', fmt(od.hmotnost, 1), 'g', `${m.nazev}, ${fmt(m.hustota, 2)} g/cm³`)
      + html('Filament', fmt(od.filament, 2), 'm', 'Ø 1,75 mm')
      + html('Doba tisku', min < 60 ? String(min) : `${Math.floor(min / 60)} h ${min % 60}`, min < 60 ? 'min' : 'min', 'hrubý odhad');
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
  const jmenoSouboru = pripona => ((p.nazev || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/^_|_$/g, '') || 'pruzny_mechanismus') + pripona;
  function stahni(data, nazev, typ) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type: typ }));
    a.download = nazev; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  const lzeExport = () => {
    if (!model) { Dialog.chyba(wasm ? 'Model nelze sestavit: ' + chybaStavby : 'Geometrické jádro se ještě načítá.'); return false; }
    return true;
  };
  function exportStl(kusy, pripona = '') { if (lzeExport()) stahni(KRAB.stlBinarni(kusy || model.kusy, 'pruzne mechanismy - github_site'), jmenoSouboru(pripona + '.stl'), 'model/stl'); }
  function export3mf(kusy, pripona = '') { if (lzeExport()) stahni(KRAB.soubor3mf(kusy || model.kusy, p.nazev || 'Pružný mechanismus'), jmenoSouboru(pripona + '.3mf'), 'model/3mf'); }
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
  $('btnPng').addEventListener('click', () => { fetch(nahled.png()).then(r => r.blob()).then(b => stahni(b, jmenoSouboru('.png'))); });
  $('btnUlozit').addEventListener('click', () => stahni(J.ulozProjekt(p), jmenoSouboru('.json'), 'application/json'));
  $('btnNacist').addEventListener('click', () => $('soubor').click());
  $('soubor').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try {
      const r = J.nactiProjekt(await f.text());
      p = r.p; naplnFormular(); prepocitej();
      if (r.hlaseni.length) Dialog.info('Projekt načten s opravami:\n• ' + r.hlaseni.join('\n• '));
    } catch (err) { Dialog.chyba(err.message); }
  });
  $('btnVychozi').addEventListener('click', async () => {
    if (!(await Dialog.potvrd(`Nastavit výchozí hodnoty pro „${J.TYPY[p.typ].nazev}“?`))) return;
    p = J.vychozi(p.typ); naplnFormular(); prepocitej();
  });

  /* ---------- nabídky ---------- */
  const seznam = $('seznamPredvoleb');
  J.PREDVOLBY.forEach((v, i) => {
    const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
    b.innerHTML = `${J.TYPY[v.p.typ].znak} ${v.nazev}<span class="pozn">${v.popis}</span>`;
    b.addEventListener('click', () => { p = J.zPredvolby(i); naplnFormular(); prepocitej(); });
    seznam.appendChild(b);
  });
  $('tHrany').addEventListener('click', () => {
    const h = $('tHrany').getAttribute('aria-pressed') !== 'true';
    $('tHrany').setAttribute('aria-pressed', String(h)); nahled.prepni('hrany', h);
  });
  $('stavOdznak').addEventListener('click', () => TrubkyGui.otevriZalozku('kontrola'));
  document.addEventListener('keydown', e => {
    const a = document.activeElement;
    const vPoli = a && (a.tagName === 'SELECT' || (a.tagName === 'INPUT' && !/checkbox|range|radio|button/.test(a.type)));
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); exportStl(); return; }
    if (e.key === 'F1') { e.preventDefault(); $('napoveda').showModal(); return; }
    if (vPoli || e.ctrlKey || e.metaKey || e.altKey || $('napoveda').open) return;
    const k = e.key.toLowerCase();
    if (k === '1') nahled.pohled('iso'); else if (k === '2') nahled.pohled('shora'); else if (k === '3') nahled.pohled('zboku');
    else if (k === 'h') $('tHrany').click();
  });
  new MutationObserver(() => { if (vysl) prepocitej(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  /* ---------- start ---------- */
  postavFormular();
  TrubkyGui.pripoj({ klic: 'webapp_pruzne_gui', pohled: j => nahled.pohled(j) });
  if (typeof Tvary !== 'undefined') Tvary.pripoj({
    klic: 'webapp_pruzne_tvary', typ: 'pruzne', nazev: 'Pružné mechanismy', kontejner: $('tvary'),
    parametry: () => J.kopie(p),
    pouzij: q => { p = J.normalizuj(q).p; naplnFormular(); prepocitej(); },
    popis: q => `${(J.TYPY[q.typ] || J.TYPY.pant).nazev} – ${(J.MATERIALY[q.material] || {}).nazev || ''}`,
  });
  p = nactiUlozeny();
  naplnFormular();
  prepocitej();

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
  nactiManifold().then(w => { wasm = w; $('stav3d').textContent = ''; prepocitej(); }).catch(e => {
    chybaStavby = 'geometrické jádro manifold-3d se nenačetlo (' + (e && e.message || e) + ') – výpočty fungují, náhled a export ne.';
    prepocitej();
  });

  window.__pruzne = { get p() { return p; }, get model() { return model; }, get vysl() { return vysl; }, nahled, nastav: q => { p = J.normalizuj(Object.assign(J.kopie(p), q)).p; naplnFormular(); prepocitej(); } };
})();

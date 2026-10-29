/* Bludiště – ovládání stránky: formulář, historie, manifold, mapa bludiště, výsledky, kontroly, export. */
/* global BLUD, BLUD_GEO, BLUD_NAHLED, KRAB, Dialog, Tvary, TrubkyGui */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const KLIC = 'webapp_bludiste3d_projekt';
  const fmt = BLUD.fmt;

  /* ---------- stav a historie ---------- */
  let p, model = null, geo = null, wasm = null, chybaJadra = null;
  const zpet = [], znovu = [];
  function nactiUlozeny() {
    try { const t = localStorage.getItem(KLIC); if (t) return BLUD.normalizuj(JSON.parse(t)).p; } catch (e) { /* poškozený záznam */ }
    return BLUD.normalizuj({}).p;
  }
  function uloz() { try { localStorage.setItem(KLIC, JSON.stringify(p)); } catch (e) { /* plné úložiště */ } }
  function zmen(fn, slouceni) {
    const pred = JSON.stringify(p);
    fn(p);
    p = BLUD.normalizuj(p).p;
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
    p = BLUD.normalizuj(JSON.parse(z.pop().stav)).p;
    naplnFormular(); po();
  }
  function po() { $('btnZpet').disabled = !zpet.length; $('btnZnovu').disabled = !znovu.length; uloz(); naplanuj(); }
  const nahradVse = q => zmen(x => { Object.keys(x).forEach(k => delete x[k]); Object.assign(x, q); });

  /* ---------- formulář ---------- */
  const pole = [...document.querySelectorAll('[data-p]')];
  $('f_mat').innerHTML = Object.entries(BLUD.MATERIALY).map(([k, m]) => `<option value="${k}">${m.nazev}</option>`).join('');
  function naplnFormular() {
    for (const el of pole) {
      const h = BLUD.vezmi(p, el.dataset.p);
      if (document.activeElement !== el) el.value = el.dataset.typ === 'text' ? (h ?? '') : String(h).replace('.', ',');
      el.classList.remove('spatne');
    }
    for (const b of $('rezimy').children) b.setAttribute('aria-pressed', String(b.dataset.rezim === p.rezim));
    for (const el of document.querySelectorAll('[data-jen]')) el.hidden = el.dataset.jen !== p.rezim;
    for (const el of document.querySelectorAll('[data-jen-viko]')) el.hidden = el.dataset.jenViko !== p.deska.viko;
    const valec = p.rezim === 'valec';
    $('lKulicka').textContent = valec ? '⌀ čepu' : '⌀ kuličky';
    $('nKulicka').textContent = valec ? 'Čep a drážky' : 'Kulička a chodby';
    $('lRamecek').textContent = p.deska.viko === 'plexi' ? 'Tloušťka rámečku' : 'Tloušťka víka';
  }
  for (const el of pole) {
    el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => {
      const c = el.dataset.p;
      let h;
      if (el.dataset.typ === 'text') h = el.value;
      else {
        h = BLUD.cislo(el.value, NaN);
        el.classList.toggle('spatne', !Number.isFinite(h));
        if (!Number.isFinite(h)) return;
      }
      zmen(x => BLUD.poloz(x, c, h), c);
      if (el.tagName === 'SELECT') naplnFormular();
    });
    if (el.tagName === 'INPUT' && el.dataset.typ !== 'text') {
      el.addEventListener('change', () => {
        const psano = BLUD.cislo(el.value, NaN), h = BLUD.vezmi(p, el.dataset.p), roz = BLUD.ROZSAHY[el.dataset.p];
        el.value = String(h).replace('.', ',');
        if (Number.isFinite(psano) && Math.abs(psano - h) > 1e-9 && roz) {
          el.classList.remove('zvyrazni'); void el.offsetWidth; el.classList.add('zvyrazni');
          Dialog.info(`${el.labels[0] ? el.labels[0].textContent : 'Hodnota'}: povoleno ${fmt(roz[0], 2)}–${fmt(roz[1], 2)}, použito ${fmt(h, 2)}.`);
        }
      });
      // ↑/↓ ± 1, Shift × 10, Alt po 0,1
      el.addEventListener('keydown', e => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        const h = BLUD.cislo(el.value, NaN); if (!Number.isFinite(h)) return;
        e.preventDefault();
        const krok = (e.shiftKey ? 10 : e.altKey ? 0.1 : 1) * (e.key === 'ArrowUp' ? 1 : -1);
        el.value = fmt(Math.round((h + krok) * 1000) / 1000, 3);
        el.dispatchEvent(new Event('input'));
      });
    }
  }
  for (const [k, r] of Object.entries(BLUD.REZIMY)) {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.rezim = k; b.title = r.popis;
    b.innerHTML = `<span class="znak" aria-hidden="true">${r.znak}</span>${r.nazev}`;
    b.addEventListener('click', () => {
      if (p.rezim === k) return;
      // typické rozměry chodby pro daný typ (čep krabičky je menší než kulička)
      const vzor = BLUD.PREDVOLBY.find(v => v.p.rezim === k).p;
      zmen(x => { x.rezim = k; x.kulicka = vzor.kulicka; x.vule = vzor.vule; x.stena = vzor.stena; });
      naplnFormular();
    });
    $('rezimy').appendChild(b);
  }
  const noveSeminko = () => { zmen(x => { x.seed = Math.floor(Math.random() * 1e6); }); naplnFormular(); };
  $('btnNahoda').addEventListener('click', noveSeminko);

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

  /* ---------- plátna a barvy ---------- */
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  function pripravPlatno(c, dprVlastni) {
    const dpr = dprVlastni || Math.min(window.devicePixelRatio || 1, 3), w = c.clientWidth || 300, h = c.clientHeight || 150;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    return { g, w, h };
  }

  /* ---------- mapa bludiště (rozvinutý válec, deska, vrstvy kostky) ---------- */
  function kresliMapu(g, w, h, m) {
    if (!m || m.chyba) { g.fillStyle = css('--text-muted'); g.font = '13px sans-serif'; g.fillText('Bludiště nelze sestavit.', 12, 22); return; }
    const p = m.p, b = m.b, okraj = 10;
    const panely = [];   // {x0, y0, s, sl, ra, bunka(i) → [c, r] nebo null}
    let sl, ra;
    if (p.rezim === 'valec') { sl = m.nC; ra = m.nR; }
    else if (p.rezim === 'deska') { sl = p.deska.x; ra = p.deska.y; }
    if (p.rezim !== 'kostka') {
      const s = Math.min((w - 2 * okraj) / sl, (h - 2 * okraj - 12) / ra);
      const x0 = (w - s * sl) / 2, y0 = (h - s * ra) / 2 + 6;
      panely.push({ x0, y0, s, sl, ra, bunka: i => [i % sl, ra - 1 - Math.floor(i / sl)] });
    } else {
      const n = m.n;
      let nej = null;
      for (let pr = 1; pr <= n; pr++) {
        const rad = Math.ceil(n / pr), s = Math.min((w - 2 * okraj) / (pr * (n + 0.8)), (h - 2 * okraj) / (rad * (n + 1.4)));
        if (!nej || s > nej.s) nej = { pr, rad, s };
      }
      const { pr, rad, s } = nej, sirka = pr * (n + 0.8) * s - 0.8 * s, vyska = rad * (n + 1.4) * s;
      const X0 = (w - sirka) / 2, Y0 = (h - vyska) / 2 + 1.2 * s;
      for (let z = n - 1, k = 0; z >= 0; z--, k++) {
        const x0 = X0 + (k % pr) * (n + 0.8) * s, y0 = Y0 + Math.floor(k / pr) * (n + 1.4) * s;
        panely.push({ x0, y0, s, sl: n, ra: n, z, bunka: i => Math.floor(i / (n * n)) === z ? [i % n, n - 1 - Math.floor(i / n) % n] : null });
      }
    }
    const panelBunky = i => { for (const P of panely) { const c = P.bunka(i); if (c) return [P, c]; } return null; };
    const stred = i => { const [P, [c, r]] = panelBunky(i); return [P.x0 + (c + 0.5) * P.s, P.y0 + (r + 0.5) * P.s, P]; };
    const ma = (a, c) => b.adj[a].includes(c);
    g.lineCap = 'round';
    for (const P of panely) {
      g.fillStyle = css('--bg-elevated'); g.fillRect(P.x0, P.y0, P.s * P.sl, P.s * P.ra);
      if (P.z !== undefined) {
        g.fillStyle = css('--text-muted'); g.font = `${Math.max(9, Math.min(12, P.s * 0.8))}px sans-serif`;
        g.fillText(`vrstva ${P.z + 1}${P.z === m.n - 1 ? ' (pod víkem)' : P.z === 0 ? ' (dno)' : ''}`, P.x0, P.y0 - 4);
      }
    }
    // stěny: hranice buňky bez chodby k sousedovi
    g.strokeStyle = css('--text'); g.lineWidth = Math.max(1, Math.min(3, panely[0].s * 0.16));
    g.beginPath();
    for (let i = 0; i < m.g.N; i++) {
      const [P, [c, r]] = panelBunky(i), x = P.x0 + c * P.s, y = P.y0 + r * P.s, s = P.s;
      let vpravo, nahore, vlevo = null, dole = null;
      if (p.rezim === 'valec') {
        const C = i % m.nC, R = Math.floor(i / m.nC);
        vpravo = (R * m.nC + (C + 1) % m.nC); nahore = R < m.nR - 1 ? i + m.nC : -1;
        if (C === 0) vlevo = R * m.nC + m.nC - 1;
        if (R === 0) dole = -1;
        if (R === m.nR - 1 && i === b.start) nahore = -2;   // vstup
      } else {
        const n = p.rezim === 'kostka' ? m.n : p.deska.x, ny = p.rezim === 'kostka' ? m.n : p.deska.y;
        const X = i % n, Y = Math.floor(i / n) % ny;
        vpravo = X < n - 1 ? i + 1 : -1; nahore = Y < ny - 1 ? i + n : -1;
        if (X === 0) vlevo = -1;
        if (Y === 0) dole = -1;
      }
      const cara = (x1, y1, x2, y2) => { g.moveTo(x1, y1); g.lineTo(x2, y2); };
      if (vpravo !== -2 && !(vpravo >= 0 && ma(i, vpravo))) cara(x + s, y, x + s, y + s);
      if (nahore !== -2 && !(nahore >= 0 && ma(i, nahore))) cara(x, y, x + s, y);
      if (vlevo !== null && !(vlevo >= 0 && ma(i, vlevo))) cara(x, y, x, y + s);
      if (dole !== null) cara(x, y + s, x + s, y + s);
    }
    g.stroke();
    if (p.rezim === 'valec') {
      const P = panely[0];
      g.save(); g.setLineDash([3, 3]); g.strokeStyle = css('--text-faint'); g.lineWidth = 1;
      g.beginPath(); g.moveTo(P.x0, P.y0 - 4); g.lineTo(P.x0, P.y0 + P.s * P.ra + 4); g.moveTo(P.x0 + P.s * P.sl, P.y0 - 4); g.lineTo(P.x0 + P.s * P.sl, P.y0 + P.s * P.ra + 4); g.stroke(); g.restore();
      g.fillStyle = css('--text-muted'); g.font = '10px sans-serif';
      g.fillText('▼ vstup', P.x0 + 2, P.y0 - 3);
      g.fillText('šev ↔ obvod pokračuje', P.x0 + P.s * P.sl - 118, P.y0 + P.s * P.ra + 12);
    }
    if (p.rezim === 'kostka') {
      // průchody do vedlejších vrstev: ▲ nahoru, ▼ dolů
      g.fillStyle = css('--text-muted');
      const n2 = m.n * m.n;
      for (let i = 0; i < m.g.N; i++) {
        const [x, y, P] = stred(i), t = P.s * 0.22;
        if (ma(i, i + n2)) { g.beginPath(); g.moveTo(x, y - t); g.lineTo(x + t, y + t * 0.7); g.lineTo(x - t, y + t * 0.7); g.fill(); }
        if (ma(i, i - n2)) { g.beginPath(); g.moveTo(x, y + t); g.lineTo(x + t, y - t * 0.7); g.lineTo(x - t, y - t * 0.7); g.fill(); }
      }
    }
    if (stavReseni()) {
      g.strokeStyle = css('--accent'); g.lineWidth = Math.max(1.5, panely[0].s * 0.22); g.globalAlpha = 0.85;
      g.beginPath();
      for (let k = 1; k < b.cesta.length; k++) {
        const a = stred(b.cesta[k - 1]), c = stred(b.cesta[k]);
        if (a[2] !== c[2]) continue;   // přechod mezi vrstvami kostky
        if (Math.abs(a[0] - c[0]) > 1.5 * a[2].s) {   // přes šev válce
          const P = a[2], vl = a[0] < c[0];
          g.moveTo(a[0], a[1]); g.lineTo(vl ? P.x0 : P.x0 + P.s * P.sl, a[1]);
          g.moveTo(vl ? P.x0 + P.s * P.sl : P.x0, c[1]); g.lineTo(c[0], c[1]);
        } else { g.moveTo(a[0], a[1]); g.lineTo(c[0], c[1]); }
      }
      if (p.rezim === 'valec') { const s0 = stred(b.start); g.moveTo(s0[0], s0[1]); g.lineTo(s0[0], s0[2].y0 - 2); }
      g.stroke(); g.globalAlpha = 1;
    }
    for (const [i, barva] of [[b.start, css('--ok')], [b.cil, css('--danger')]]) {
      const [x, y, P] = stred(i);
      g.fillStyle = barva; g.beginPath(); g.arc(x, y, Math.max(2.5, P.s * 0.28), 0, 2 * Math.PI); g.fill();
    }
  }
  const stavReseni = () => $('tReseni').getAttribute('aria-pressed') === 'true';
  function kresliMapuDoPlatna() { const c = $('cMapa'), { g, w, h } = pripravPlatno(c); kresliMapu(g, w, h, model); }

  /* ---------- výsledky ---------- */
  const box = (popis, cislo, dalsi, tr) => `<div class="dlazdice"><div class="popis">${popis}</div><div class="cislo ${tr || ''}">${cislo}</div>${dalsi ? `<div class="dalsi">${dalsi}</div>` : ''}</div>`;
  function rozmerSestavy(m) {
    const p = m.p;
    if (p.rezim === 'valec') return [2 * m.Ro, 2 * m.Ro, m.zavrena];
    if (p.rezim === 'kostka') return [m.L, m.L, m.Hc];
    return [m.Lx, m.Ly, m.Hc];
  }
  function vypis(H) {
    const m = model, ok = m && !m.chyba;
    const r3 = ok ? rozmerSestavy(m) : null;
    if (ok) {
      const b = m.b, p = m.p;
      $('vBludiste').innerHTML = box('Řešení', `${b.cesta.length} buněk`, `z ${m.g.N} (${fmt(100 * b.cesta.length / m.g.N, 0)} %)`)
        + box('Slepé uličky', String(b.slepe), `${b.rozhodnuti} rozhodnutí na cestě`);
      $('legMapa').textContent = p.rezim === 'valec' ? 'mapa = rozvinutý obvod nádoby' : p.rezim === 'kostka' ? '▲▼ průchod do vrstvy nad / pod' : '';
      $('pKulicka').textContent = `Chodba ${fmt(m.w, 2)} mm (⌀ + 2 × vůle), rozteč ${fmt(m.pz, 2)} mm.`
        + (p.rezim === 'valec' ? ` Po obvodu ${m.nC} sloupců (oblouk ${fmt(m.alfa * m.Rv, 2)} mm), ${m.nR} řad.` : '');
      $('sTyp').textContent = `${BLUD.REZIMY[p.rezim].nazev} · ${p.seed}`;
      $('sKulicka').textContent = `⌀ ${fmt(p.kulicka)} · vůle ${fmt(p.vule, 2)}`;
      $('sRozmery').textContent = r3.map(x => fmt(x, 0)).join(' × ') + ' mm';
      let roz = '';
      if (p.rezim === 'valec') {
        roz = box('Vnitřní prostor', `⌀ ${fmt(2 * m.Ri)} × ${fmt(m.hloubkaNadoby)} mm`, 'místo na dárek')
          + box('Mřížka', `${m.nC} × ${m.nR}`, `sloupců po obvodu × řad`)
          + box('Zavřená krabička', `⌀ ${fmt(2 * m.Ro)} × ${fmt(m.zavrena)} mm`, `patka ${fmt(m.patka)} mm`);
      } else if (p.rezim === 'kostka') {
        roz = box('Kostka', `${fmt(m.L)} × ${fmt(m.L)} × ${fmt(m.Hc)} mm`, `${m.n} vrstev + víko`)
          + box('Vrstva', `${fmt(m.krok)} mm`, `podlaha ${fmt(p.kostka.podlaha)} + chodba ${fmt(m.w)} mm`);
      } else {
        roz = box('Deska', `${fmt(m.Lx)} × ${fmt(m.Ly)} × ${fmt(m.Hc)} mm`, `${p.deska.x} × ${p.deska.y} buněk`);
        if (p.deska.viko === 'plexi') roz += box('Plexi', `${fmt(m.Lx - 2 * p.deska.okraj + 2 * m.prekryv)} × ${fmt(m.Ly - 2 * p.deska.okraj + 2 * m.prekryv)} mm`, `tloušťka ${fmt(p.deska.plexi)} mm`);
      }
      $('vRozmery').innerHTML = roz;
    } else {
      for (const id of ['vBludiste', 'vRozmery']) $(id).innerHTML = '';
    }
    // díly a odhad tisku
    const dily = ok && geo ? geo.dily.filter(d => d.tisk) : [];
    let sumG = 0, sumM = 0, sumH = 0;
    const radky = dily.map((d, i) => {
      const o = BLUD.odhadTisku(d.objem, d.plocha, p.material); sumG += o.gramy; sumM += o.metry; sumH += o.hodiny;
      return `<tr><td>${d.nazev}</td><td class="c">${fmt(d.objem / 1000, 1)} cm³</td><td class="c">${fmt(o.gramy, 0)} g</td><td class="c">${fmt(o.hodiny, 1)} h</td>
        <td class="c"><button class="tl" data-dil="${i}" data-fmt="stl">STL</button> <button class="tl" data-dil="${i}" data-fmt="3mf">3MF</button></td></tr>`;
    });
    $('tDily').innerHTML = dily.length ? `<tr><th>Díl</th><th class="c">Objem</th><th class="c">Hmotnost</th><th class="c">Tisk</th><th class="c">Export</th></tr>${radky.join('')}` : '';
    $('sTisk').textContent = dily.length ? `${dily.length} díly · ${fmt(sumG, 0)} g` : '';
    $('pTisk').innerHTML = !ok ? '' : {
      valec: 'Nádobu tiskněte patkou na podložku, pouzdro víkem dolů. Výplň 15–20 %, 3 obvody, vrstva 0,2 mm; drážky bez podpor. Po tisku čep zbavte otřepů a krabičku několikrát projděte.',
      kostka: 'Vrstvy podlahou dolů (kolíky nahoru), víko naplocho. Víko z průhledného PETG s výplní 100 %. Zkontrolujte, že kulička projde otvorem v podlaze, a teprve pak lepte nebo nasazujte zámky.',
      deska: 'Desku dnem dolů, rámeček / víko kolíky nahoru. Kolíky lze do děr zalepit. Plexi 2–3 mm nařezat podle rozměru, hrany lehce srazit.',
    }[p.rezim] + ' Hmotnost a čas jsou hrubý odhad (3 obvody, 20 % výplně, ~8 mm³/s).';
    if (ok && geo) {
      $('vVysledky').innerHTML = box('Rozměr sestavy', r3.map(x => fmt(x, 1)).join(' × ') + ' mm', BLUD.REZIMY[p.rezim].nazev)
        + box('Bludiště', `${m.g.N} buněk`, `řešení ${m.b.cesta.length} kroků, nejdál ${m.b.maxDist}`)
        + box('Materiál', `${fmt(sumG, 0)} g`, `${fmt(sumM, 1)} m filamentu 1,75 mm (${BLUD.MATERIALY[p.material].nazev})`)
        + box('Doba tisku', `≈ ${fmt(sumH, 1)} h`, `${dily.length} díly, hrubý odhad`)
        + box('Výpočet', `${geo.cas} ms`, 'manifold-3d, sítě uzavřené');
    } else $('vVysledky').innerHTML = ok ? box('Geometrie', chybaJadra ? 'nedostupná' : 'počítám…', chybaJadra || '') : '';
    // karta v rohu náhledu
    $('karta3d').innerHTML = ok && geo ? `<div class="titul">${BLUD.REZIMY[p.rezim].nazev}</div><b>${r3.map(x => fmt(x, 0)).join(' × ')}</b> mm · <b>${fmt(sumG, 0)}</b> g<br>`
      + `řešení <b>${m.b.cesta.length}</b> kroků, slepých uliček <b>${m.b.slepe}</b>` : '';
    // hlášení
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
      if (x.oprava) {
        const b = document.createElement('button'); b.className = 'tl oprava'; b.textContent = '🔧 ' + x.oprava.text;
        b.addEventListener('click', () => { zmen(q => BLUD.poloz(q, x.oprava.pole, x.oprava.hodnota)); naplnFormular(); });
        li.appendChild(b);
      }
      ul.appendChild(li);
    }
    const nch = H.filter(x => x.uroven === 'chyba').length, nv = H.filter(x => x.uroven === 'varovani').length;
    const o = $('stavOdznak');
    o.className = 'odznak ' + (nch ? 'chyba' : nv ? 'mez' : 'ok');
    o.textContent = nch ? `✖ ${nch}` : nv ? `⚠ ${nv}` : '✔';
    $('sKontrola').textContent = nch ? `${nch} ${nch === 1 ? 'chyba' : nch < 5 ? 'chyby' : 'chyb'}` : nv ? `${nv} varování` : 'v pořádku';
    if (m && m.chyba) TrubkyGui.otevriZalozku('kontrola');
  }
  function jdiNaPole(cesta) {
    let el = document.querySelector(`[data-p="${cesta}"]`);
    if (!el) return;
    const det = el.closest('details'); if (det) det.open = true;
    const tel = el.closest('.zalozka-telo'); if (tel) TrubkyGui.otevriZalozku(tel.dataset.telo);
    const bx = el.closest('[data-box]'); TrubkyGui.ukazBox(bx ? bx.dataset.box : 'obecne');
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.focus({ preventScroll: true });
    el.classList.remove('zvyrazni'); void el.offsetWidth; el.classList.add('zvyrazni');
  }

  /* ---------- přepočet ---------- */
  const nahled = BLUD_NAHLED.vytvorNahled($('platno'));
  let casovac = null;
  function naplanuj() { clearTimeout(casovac); $('stav3d').textContent = wasm ? 'Počítám…' : $('stav3d').textContent; casovac = setTimeout(prepocitej, 120); }
  function prepocitej() {
    nahled.barvy(css('--border-strong'), css('--border'), css('--text'));
    model = BLUD.model(p);
    const H = BLUD.kontroly(model);
    geo = null;
    const st = $('stav3d');
    st.classList.remove('chyba');
    if (model.chyba) { st.textContent = model.chyba; st.classList.add('chyba'); }
    else if (wasm) {
      try { geo = BLUD_GEO.postav(wasm, model); st.textContent = ''; }
      catch (e) { st.textContent = 'Geometrie selhala: ' + e.message; st.classList.add('chyba'); }
    } else if (chybaJadra) { st.textContent = chybaJadra; st.classList.add('chyba'); }
    nahled.nastav(model, geo ? geo.dily : null);
    vypis(H);
    kresliMapuDoPlatna();
  }

  /* ---------- lišta, nabídky, export ---------- */
  TrubkyGui.pripoj({ klic: 'webapp_bludiste3d_gui', pohled: j => nahled.pohled(j) });
  for (const [i, v] of BLUD.PREDVOLBY.entries()) {
    const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
    b.innerHTML = `${BLUD.REZIMY[v.p.rezim].znak} ${v.nazev}<span class="pozn">${v.popis}</span>`;
    b.addEventListener('click', () => { nahradVse(BLUD.predvolba(i, p)); naplnFormular(); });
    $('seznamPredvoleb').appendChild(b);
  }
  const jmenoSouboru = pripona => ((p.nazev || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/^_|_$/g, '') || 'Bludiste') + pripona;
  function stahni(data, nazev, typ) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type: typ }));
    a.download = nazev; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function tiskoveDily(vyber) {
    if (!model || model.chyba || !geo) { Dialog.chyba(model && model.chyba ? 'Model nelze sestavit: ' + model.chyba : 'Geometrie ještě není spočítaná.'); return null; }
    const dily = geo.dily.filter(d => d.tisk);
    return BLUD.rozmisti(vyber === undefined ? dily : [dily[vyber]]);
  }
  function exportuj(format, vyber) {
    const d = tiskoveDily(vyber);
    if (!d) return;
    const pripona = vyber === undefined ? '' : '_' + d[0].jmeno;
    if (format === 'stl') stahni(KRAB.stlBinarni(d, 'Bludiste - github_site'), jmenoSouboru(pripona + '.stl'), 'model/stl');
    else stahni(KRAB.soubor3mf(d, p.nazev || 'Bludiště'), jmenoSouboru(pripona + '.3mf'), 'model/3mf');
  }
  $('btnStl').addEventListener('click', () => exportuj('stl'));
  $('btn3mf').addEventListener('click', () => exportuj('3mf'));
  $('tDily').addEventListener('click', e => { const b = e.target.closest('[data-dil]'); if (b) exportuj(b.dataset.fmt, +b.dataset.dil); });
  $('btnPng').addEventListener('click', () => fetch(nahled.png()).then(r => r.blob()).then(b => stahni(b, jmenoSouboru('.png'))));
  $('btnMapa').addEventListener('click', () => {
    if (!model || model.chyba) return;
    // mapa pro papír: světlé téma, 1600 px
    const c = document.createElement('canvas'); c.width = 1600; c.height = model.p.rezim === 'valec' ? Math.round(1600 * (model.nR + 1.5) / model.nC) : 1200;
    const koren = document.documentElement, tema0 = koren.getAttribute('data-theme');
    koren.setAttribute('data-theme', 'light');
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    kresliMapu(g, c.width, c.height, model);
    if (tema0 === null) koren.removeAttribute('data-theme'); else koren.setAttribute('data-theme', tema0);
    c.toBlob(b => stahni(b, jmenoSouboru('_mapa.png')));
  });
  $('btnUlozit').addEventListener('click', () => stahni(BLUD.ulozProjekt(p), jmenoSouboru('.json'), 'application/json'));
  $('btnNacist').addEventListener('click', () => $('soubor').click());
  $('soubor').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try {
      const { p: q, hlaseni } = BLUD.nactiProjekt(await f.text());
      nahradVse(q); naplnFormular();
      Dialog.info(hlaseni.length ? 'Projekt načten s úpravami: ' + hlaseni.join('; ') + '.' : 'Projekt načten.');
    } catch (err) { Dialog.chyba(err.message); }
  });
  $('btnVychozi').addEventListener('click', async () => {
    if (!await Dialog.potvrd('Vrátit všechny parametry na výchozí hodnoty?')) return;
    nahradVse(BLUD.normalizuj({}).p); naplnFormular();
  });
  $('btnZpet').addEventListener('click', () => krokHistorie(zpet, znovu));
  $('btnZnovu').addEventListener('click', () => krokHistorie(znovu, zpet));
  function prepinac(id, co) {
    const b = $(id);
    b.addEventListener('click', () => {
      const h = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', String(h)); nahled.prepni(co, h);
      if (co === 'reseni') kresliMapuDoPlatna();
    });
  }
  prepinac('tReseni', 'reseni'); prepinac('tRozlozit', 'rozlozit'); prepinac('tPruhledne', 'pruhledne'); prepinac('tHrany', 'hrany'); prepinac('tTisk', 'tisk');
  $('stavOdznak').addEventListener('click', () => TrubkyGui.otevriZalozku('kontrola'));
  $('btnNapoveda').addEventListener('click', () => $('dlgNapoveda').showModal());
  $('btnZavritNap').addEventListener('click', () => $('dlgNapoveda').close());
  document.addEventListener('keydown', e => {
    const a = document.activeElement;
    const vPoli = a.tagName === 'SELECT' || (a.tagName === 'INPUT' && !/checkbox|range|radio|button/.test(a.type));
    if ((e.ctrlKey || e.metaKey) && !vPoli && e.key.toLowerCase() === 'z') { e.preventDefault(); krokHistorie(e.shiftKey ? znovu : zpet, e.shiftKey ? zpet : znovu); return; }
    if ((e.ctrlKey || e.metaKey) && !vPoli && e.key.toLowerCase() === 'y') { e.preventDefault(); krokHistorie(znovu, zpet); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); exportuj('stl'); return; }
    if (e.key === 'F1') { e.preventDefault(); $('dlgNapoveda').showModal(); return; }
    if (vPoli || e.ctrlKey || e.metaKey || e.altKey || $('dlgNapoveda').open) return;
    const k = e.key.toLowerCase();
    const akce = { 1: () => nahled.pohled('iso'), 2: () => nahled.pohled('shora'), 3: () => nahled.pohled('zboku'),
      r: () => $('tReseni').click(), e: () => $('tRozlozit').click(), p: () => $('tPruhledne').click(), h: () => $('tHrany').click(), m: () => $('tTisk').click(), n: noveSeminko };
    if (akce[k]) akce[k]();
  });
  new ResizeObserver(() => { if (model) requestAnimationFrame(kresliMapuDoPlatna); }).observe($('cMapa'));
  new MutationObserver(() => { if (model) { nahled.barvy(css('--border-strong'), css('--border'), css('--text')); kresliMapuDoPlatna(); } })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  if (typeof Tvary !== 'undefined') Tvary.pripoj({
    klic: 'webapp_bludiste3d_tvary', typ: 'bludiste3d', nazev: 'Bludiště', kontejner: $('tvary'),
    parametry: () => BLUD.kopie(p),
    pouzij: q => { nahradVse(BLUD.normalizuj(q).p); naplnFormular(); },
    popis: q => `${q.nazev || 'Bludiště'} – ${(BLUD.REZIMY[q.rezim] || BLUD.REZIMY.valec).nazev}, semínko ${q.seed}`,
  });

  /* ---------- start ---------- */
  p = nactiUlozeny();
  naplnFormular();
  prepocitej();
  nactiManifold().then(w => { wasm = w; prepocitej(); }).catch(e => {
    chybaJadra = 'Geometrické jádro (manifold-3d) se nenačetlo: ' + (e && e.message || e) + ' – mapa a kontroly fungují, export ne.';
    prepocitej();
  });
  window.BLUD_UI = { nahled, get p() { return p; }, get model() { return model; }, get geo() { return geo; }, zmen, naplnFormular, prepocitej };
})();

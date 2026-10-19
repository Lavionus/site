/* evoluce/ui.js – ovládání, vykreslení světa, grafy, rodokmen, ukládání. */
(function () {
  'use strict';
  const J = window.EvoJadro, G = window.EvoGrafy, A = window.EvoAnalyza;
  const $ = id => document.getElementById(id);
  const KLIC_STAV = 'webapp_evoluce_stav', KLIC_VOLBY = 'webapp_evoluce_volby';
  const ZAKLAD_TEMPA = 30; // kroků za sekundu při rychlosti 1×

  let stav = null;
  let bezi = false, rychlost = '1', akum = 0, posledniCas = 0;
  let vybranyId = 0, hloubkaRodokmenu = 0;
  let znak = 3;
  let posledniPanel = 0, posledniGrafy = -1, posledniGrafyCas = 0;
  let tempoKroky = 0, tempoCas = 0;
  let barvyCache = null;
  let zalozka = 'grafy', posledniVyber = 0, experiment = null, expVysledek = null;

  /* ---------- pomocné ---------- */
  function cislo(x, des) { return G.cislo(x, des); }
  function cele(x) { return Math.round(x).toLocaleString('cs-CZ'); }
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function barvaGenu(b) {
    const x = Math.max(0, Math.min(1, b));
    return `hsl(${Math.round(265 - 215 * x)}, 70%, ${Math.round(32 + 36 * x)}%)`;
  }
  function nactiBarvy() {
    barvyCache = {
      bg: G.css('--bg-deep', '#121212'), text: G.css('--text', '#ddd'), muted: G.css('--text-muted', '#aaa'),
      jidlo: G.css('--jidlo', '#5fc27e'), predator: G.css('--predator', '#ff7a6b'), accent: G.css('--accent', '#6aa6fd'),
      g: [1, 2, 3, 4, 5].map(i => G.css('--g' + i, '#888')), danger: G.css('--danger', '#e55'), border: G.css('--border', '#444'),
      svetle: document.documentElement.getAttribute('data-theme') === 'light',
    };
  }
  function ulozVolby() {
    try {
      localStorage.setItem(KLIC_VOLBY, JSON.stringify({
        rychlost, znak, barvit: $('optBarvit').value, vnimani: $('optVnimani').checked, smer: $('optSmer').checked,
        zalozka, morfoX: $('morfoX').value, morfoY: $('morfoY').value, csvCesky: $('csvCesky').checked,
      }));
    } catch (e) { /* úložiště nedostupné */ }
  }
  function nactiVolby() {
    try {
      const v = JSON.parse(localStorage.getItem(KLIC_VOLBY) || 'null');
      if (!v) return;
      if (v.rychlost) { rychlost = String(v.rychlost); $('rychlost').value = rychlost; if ($('rychlost').value !== rychlost) { rychlost = '1'; $('rychlost').value = '1'; } }
      if (Number.isInteger(v.znak) && v.znak >= 0 && v.znak < J.GENY.length) znak = v.znak;
      if (v.barvit) $('optBarvit').value = v.barvit;
      if (typeof v.vnimani === 'boolean') $('optVnimani').checked = v.vnimani;
      if (typeof v.smer === 'boolean') $('optSmer').checked = v.smer;
      if (['grafy', 'morfo', 'vyber', 'exp'].includes(v.zalozka)) zalozka = v.zalozka;
      if (v.morfoX !== undefined && v.morfoX !== '') $('morfoX').value = v.morfoX;
      if (v.morfoY !== undefined && v.morfoY !== '') $('morfoY').value = v.morfoY;
      if (typeof v.csvCesky === 'boolean') $('csvCesky').checked = v.csvCesky;
    } catch (e) { /* poškozené volby ignorovat */ }
  }
  function nahodnySeed() {
    const abc = 'abcdefghijkmnpqrstuvwxyz23456789';
    let s = ''; for (let i = 0; i < 6; i++) s += abc[Math.floor(Math.random() * abc.length)];
    return s;
  }

  /* ---------- založení světa ---------- */
  function novySvet(scenar, seed, upravy) {
    const n = J.nastaveniScenare(scenar);
    n.seed = seed;
    if (upravy) Object.assign(n, upravy);
    stav = J.vytvorSvet(n);
    poZmeneStavu();
  }
  function poZmeneStavu() {
    vybranyId = 0; hloubkaRodokmenu = 0;
    J.nastavZachovat(stav, []);
    $('scenar').value = stav.nastaveni.scenar || 'vychozi';
    $('seed').value = stav.seed;
    zobrazPopisScenare();
    vyplnPocatek(stav.nastaveni.pocatek);
    $('planKrok').value = Math.ceil((stav.tick + 500) / 100) * 100;
    synchronizujParametry();
    posledniGrafy = -1;
    $('vymreli').hidden = stav.orgs.length > 0;
    obnovPanel(true);
    kresliSvet();
  }
  function zobrazPopisScenare() {
    const s = J.SCENARE[$('scenar').value];
    $('scenarPopis').textContent = s ? s.popis : '';
  }

  /* ---------- parametry ---------- */
  const SKUPINY = [
    { nazev: 'Potrava', klice: ['prisunPotravy', 'maxPotravy', 'energiePotravy', 'sezonnost', 'perioda'], otevrena: true },
    { nazev: 'Predátoři', klice: ['pocetPredatoru', 'rychlostPredatora', 'dohledPredatora', 'limitKoristi', 'barvaProstredi'], otevrena: true },
    { nazev: 'Podmínky prostředí', klice: ['chlad', 'maxVek', 'maxPopulace'] },
    { nazev: 'Dědičnost', klice: ['rekombinace', 'mirMutace', 'silaMutace'], otevrena: true },
  ];
  const POPISKY = {
    sezonnost: 'Amplituda kolísání přísunu (0 = stálý, 1 = v zimě nic).',
    barvaProstredi: 'Barva pozadí; predátor hůř vidí kořist podobné barvy.',
    limitKoristi: 'Větší organismy predátor neloví.',
    chlad: 'Tepelné ztráty ~ chlad · s²; zvýhodňuje větší těla.',
    silaMutace: 'σ změny genu jako podíl jeho rozsahu.',
    rekombinace: 'Potomek vzniká ze dvou rodičů, každý gen od jednoho z nich.',
  };
  function desetinParam(d) { return d.krok >= 1 ? 0 : Math.min(3, Math.ceil(-Math.log10(d.krok) - 1e-9)); }
  function stavbaParametru() {
    const kont = $('parametry'); kont.innerHTML = '';
    for (const sk of SKUPINY) {
      const det = document.createElement('details'); det.className = 'skupina'; if (sk.otevrena) det.open = true;
      det.innerHTML = `<summary>${sk.nazev}</summary>`;
      for (const k of sk.klice) {
        const d = J.PARAMETRY.find(x => x.k === k);
        const div = document.createElement('div');
        if (d.bool) {
          div.className = 'pole prepinac';
          div.innerHTML = `<label><input type="checkbox" id="p_${k}"> ${esc(d.nazev)}</label>`;
        } else {
          div.className = 'pole';
          div.innerHTML = `<div class="radek"><label for="p_${k}">${esc(d.nazev)}</label><output id="o_${k}"></output></div>
            <input type="range" id="p_${k}" min="${d.min}" max="${d.max}" step="${d.krok}">`;
        }
        if (POPISKY[k]) div.title = POPISKY[k];
        det.appendChild(div);
        const inp = div.querySelector('input');
        if (d.bool) inp.addEventListener('change', () => zmenaParametru(k, inp.checked));
        else {
          inp.addEventListener('input', () => { $('o_' + k).textContent = formatParam(d, +inp.value); });
          inp.addEventListener('change', () => zmenaParametru(k, +inp.value));
        }
      }
      kont.appendChild(det);
    }
  }
  function formatParam(d, v) {
    if (d.k === 'mirMutace') return cislo(v * 100, 0) + ' %';
    if (d.k === 'sezonnost') return cislo(v * 100, 0) + ' %';
    return cislo(v, desetinParam(d)) + (d.jedn ? ' ' + d.jedn : '');
  }
  function synchronizujParametry() {
    for (const d of J.PARAMETRY) {
      const inp = $('p_' + d.k); if (!inp) continue;
      if (d.bool) inp.checked = !!stav.p[d.k];
      else { inp.value = stav.p[d.k]; $('o_' + d.k).textContent = formatParam(d, stav.p[d.k]); }
    }
    vykresliProtokol();
  }
  function zmenaParametru(k, v) {
    J.zmen(stav, k, v);
    if (!bezi) { // projeví se hned (zásah se zapíše k aktuálnímu kroku a provede se na jeho začátku)
      const docasne = J.normalizujParametry(Object.assign({}, stav.p, { [k]: v }));
      $('o_' + k) && ($('o_' + k).textContent = formatParam(J.PARAMETRY.find(x => x.k === k), docasne[k]));
    }
    vykresliProtokol();
  }
  const NAZEV_ZASAHU = k => k === 'katastrofa' ? 'Katastrofa' : (J.PARAMETRY.find(x => x.k === k) || { nazev: k }).nazev;
  function hodnotaZasahu(z) {
    if (z.k === 'katastrofa') return cislo(z.v * 100, 0) + ' % obětí';
    if (typeof z.v === 'boolean') return z.v ? 'zapnuto' : 'vypnuto';
    const d = J.PARAMETRY.find(x => x.k === z.k);
    return d ? formatParam(d, z.v) : String(z.v);
  }
  function vykresliProtokol() {
    const tb = $('protokol');
    if (!stav.protokol.length) { tb.innerHTML = '<tr><td class="prazdne">Zatím žádné zásahy.</td></tr>'; return; }
    const rady = stav.protokol.map((z, i) => ({ z, i })).sort((a, b) => b.z.t - a.z.t || b.i - a.i);
    tb.innerHTML = rady.map(({ z, i }) => {
      const ceka = z.t >= stav.tick;
      return `<tr><td>krok ${cele(z.t)}${ceka ? ' <span style="color:var(--text-muted)">(čeká)</span>' : ''}</td><td style="text-align:left;white-space:normal">${esc(NAZEV_ZASAHU(z.k))}</td><td>${esc(hodnotaZasahu(z))}</td>` +
        `<td>${ceka ? `<button class="male x" data-zrus="${i}" title="Zrušit naplánovaný zásah" aria-label="Zrušit zásah v kroku ${z.t}">✕</button>` : ''}</td></tr>`;
    }).join('');
  }
  function planHodnotaPole() {
    const k = $('planCo').value, obal = $('planHodnotaObal');
    if (k === 'katastrofa') { obal.innerHTML = 'podíl obětí <input type="number" id="planHodnota" min="0.01" max="1" step="0.01" value="0.9">'; return; }
    const d = J.PARAMETRY.find(x => x.k === k);
    if (d.bool) obal.innerHTML = `hodnota <select id="planHodnota"><option value="1">zapnuto</option><option value="0">vypnuto</option></select>`;
    else obal.innerHTML = `hodnota${d.jedn ? ' (' + esc(d.jedn) + ')' : ''} <input type="number" id="planHodnota" min="${d.min}" max="${d.max}" step="${d.krok}" value="${stav.p[k]}">`;
  }
  function naplanovat() {
    const k = $('planCo').value, t = Math.floor(+$('planKrok').value);
    const d = J.PARAMETRY.find(x => x.k === k);
    let v = $('planHodnota').value;
    v = d && d.bool ? v === '1' : parseFloat(String(v).replace(',', '.'));
    if (typeof v === 'number' && !Number.isFinite(v)) { Dialog.chyba('Zadejte hodnotu zásahu.'); return; }
    if (!Number.isFinite(t) || t < stav.tick) { Dialog.chyba(`Krok musí být aspoň ${cele(stav.tick)} (aktuální).`); return; }
    try {
      if (d && !d.bool) v = Math.min(d.max, Math.max(d.min, v));
      J.naplanuj(stav, t, k, v);
      vykresliProtokol();
      Dialog.info(`Naplánováno na krok ${cele(t)}: ${NAZEV_ZASAHU(k)} → ${hodnotaZasahu({ k, v })}`);
    } catch (e) { Dialog.chyba(e.message); }
  }

  /* ---------- hlavní smyčka (pevný krok, vykreslení odděleně) ---------- */
  function provedKroky(n) {
    for (let i = 0; i < n; i++) {
      J.krok(stav);
      if (!stav.orgs.length) { vymreni(); return i + 1; }
    }
    return n;
  }
  function vymreni() {
    if (bezi) nastavBeh(false);
    $('vymreli').hidden = false;
  }
  function smycka(t) {
    const dt = posledniCas ? Math.min(0.25, (t - posledniCas) / 1000) : 0;
    posledniCas = t;
    if (bezi && stav.orgs.length) {
      let hotovo = 0;
      if (rychlost === 'max') {
        const konec = performance.now() + 14;
        while (performance.now() < konec && stav.orgs.length) hotovo += provedKroky(5);
      } else {
        akum += dt * ZAKLAD_TEMPA * parseFloat(rychlost);
        let n = Math.floor(akum); akum -= n;
        if (n > 0) {
          const konec = performance.now() + 30;
          while (n > 0 && performance.now() < konec && stav.orgs.length) { const k = Math.min(n, 10); hotovo += provedKroky(k); n -= k; }
          if (n > 0) akum = 0; // nestíhá – zpomalíme (simulace zůstává deterministická, jen pomalejší)
        }
      }
      tempoKroky += hotovo;
    }
    tempoCas += dt;
    if (tempoCas >= 1) { $('sTempo').textContent = bezi ? `${cele(tempoKroky / tempoCas)} kroků/s` : ''; tempoKroky = 0; tempoCas = 0; }
    kresliSvet();
    if (t - posledniPanel > 250) { posledniPanel = t; obnovPanel(false); }
    requestAnimationFrame(smycka);
  }
  function nastavBeh(b) {
    bezi = b && stav.orgs.length > 0;
    $('btnBeh').textContent = bezi ? '⏸ Pauza' : '▶ Spustit';
    akum = 0;
  }

  /* ---------- svět ---------- */
  const cv = $('svet');
  function hodnotaBarveni(o, rezim) {
    if (rezim === 'energie') return o.e / J.emax(o.g);
    const gi = J.GENY.findIndex(g => g.k === rezim);
    const d = J.GENY[gi];
    return (o.g[gi] - d.min) / (d.max - d.min);
  }
  function kresliSvet() {
    if (!barvyCache) nactiBarvy();
    const B = barvyCache;
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const k = w / stav.W; // měřítko (zachovaný poměr 3 : 2)
    g.fillStyle = B.bg; g.fillRect(0, 0, w, h);
    g.globalAlpha = B.svetle ? 0.28 : 0.16; g.fillStyle = barvaGenu(stav.p.barvaProstredi); g.fillRect(0, 0, w, h); g.globalAlpha = 1;
    // potrava
    g.fillStyle = B.jidlo;
    const rj = Math.max(1.2, 1.6 * k);
    for (const f of stav.potrava) g.fillRect(f.x * k - rj, f.y * k - rj, rj * 2, rj * 2);
    // organismy
    const rezim = $('optBarvit').value;
    const smer = $('optSmer').checked;
    g.lineWidth = 1;
    g.strokeStyle = B.svetle ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.35)';
    let vybrany = null;
    for (const o of stav.orgs) {
      const r = Math.max(1.8, J.K.TELO * o.g[1] * k);
      const x = o.x * k, y = o.y * k;
      g.fillStyle = barvaGenu(hodnotaBarveni(o, rezim));
      g.beginPath(); g.arc(x, y, r, 0, 2 * Math.PI); g.fill(); g.stroke();
      if (smer) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(o.dir) * r * 2, y + Math.sin(o.dir) * r * 2); g.stroke(); }
      if (o.id === vybranyId) vybrany = o;
    }
    // predátoři
    for (const p of stav.predatori) {
      const x = p.x * k, y = p.y * k, r = Math.max(5, 9 * k);
      g.save(); g.translate(x, y); g.rotate(p.dir);
      g.fillStyle = B.predator; g.globalAlpha = p.traveni > 0 ? 0.55 : 1;
      g.beginPath(); g.moveTo(r, 0); g.lineTo(-r * 0.75, r * 0.65); g.lineTo(-r * 0.4, 0); g.lineTo(-r * 0.75, -r * 0.65); g.closePath(); g.fill();
      g.globalAlpha = 1; g.strokeStyle = B.svetle ? '#000' : '#fff'; g.lineWidth = 1; g.stroke();
      g.restore();
    }
    // vybraný
    if (vybrany) {
      const x = vybrany.x * k, y = vybrany.y * k, r = Math.max(1.8, J.K.TELO * vybrany.g[1] * k);
      g.strokeStyle = B.text; g.lineWidth = 2;
      g.beginPath(); g.arc(x, y, r + 4, 0, 2 * Math.PI); g.stroke();
      if ($('optVnimani').checked) {
        g.setLineDash([4, 4]); g.lineWidth = 1; g.strokeStyle = B.accent;
        g.beginPath(); g.arc(x, y, vybrany.g[2] * k, 0, 2 * Math.PI); g.stroke(); g.setLineDash([]);
      }
    }
  }
  cv.addEventListener('click', e => {
    const r = cv.getBoundingClientRect();
    const k = r.width / stav.W;
    const x = (e.clientX - r.left) / k, y = (e.clientY - r.top) / k;
    let best = null, bd = Math.pow(Math.max(12, 14 / k), 2);
    for (const o of stav.orgs) {
      const dx = J.rozdil(x, o.x, stav.W), dy = J.rozdil(y, o.y, stav.H), d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = o; }
    }
    if (best) vyber(best.id);
  });
  function vyber(id) {
    vybranyId = id;
    J.nastavZachovat(stav, id ? [id] : []);
    obnovJedince(true);
    kresliSvet();
  }

  /* ---------- panel: čísla, grafy, jedinec ---------- */
  function obnovPanel(vynutit) {
    $('sKrok').textContent = cele(stav.tick);
    $('sPop').textContent = cele(stav.orgs.length);
    $('sJidlo').textContent = cele(stav.potrava.length);
    let gen = 0; for (const o of stav.orgs) gen += o.gen;
    $('sGen').textContent = stav.orgs.length ? cislo(gen / stav.orgs.length, 1) : '–';
    const H = stav.historie.body;
    const ted = performance.now();
    if (zalozka === 'grafy' && (vynutit || (H.length !== posledniGrafy && ted - posledniGrafyCas > 600))) {
      posledniGrafy = H.length; posledniGrafyCas = ted;
      kresliGrafy();
    }
    if (zalozka === 'morfo') kresliMorfo();
    if (zalozka === 'vyber' && (vynutit || ted - posledniVyber > 1000)) { posledniVyber = ted; kresliVyber(); }
    obnovJedince(vynutit);
    if (vynutit) vykresliProtokol();
    else if (stav.protokol.some(z => z.t === stav.tick - 1 || z.t === stav.tick)) vykresliProtokol();
  }

  function kresliGrafy() {
    if (!barvyCache) nactiBarvy();
    const B = barvyCache, H = stav.historie.body, d = J.GENY[znak];
    const udalosti = stav.protokol.filter(z => z.k === 'katastrofa' && z.t < stav.tick).map(z => z.t);
    const fKrok = x => 'krok ' + cele(x);
    G.cary($('gPop'), [
      { body: H.map(b => [b.t, b.jidlo]), barva: B.jidlo, tloustka: 1.3, nazev: 'potrava', des: 0 },
      { body: H.map(b => [b.t, b.pred]), barva: B.predator, tloustka: 1.3, carkovane: true, nazev: 'predátoři', des: 0 },
      { body: H.map(b => [b.t, b.n]), barva: B.g[0], tloustka: 2, nazev: 'organismy', des: 0 },
    ], { ymin: 0, udalosti, popisY: 'počet', formatX: fKrok });
    const sP = H.filter(b => b.n);
    $('hPrum').firstChild.textContent = `${d.nazev}: průměr ± směrodatná odchylka`;
    G.cary($('gPrum'), [{
      body: sP.map(b => [b.t, b.prum[znak]]), barva: B.g[0], tloustka: 2, nazev: 'průměr (± sd)', des: d.des + 1,
      pas: sP.map(b => { const s = Math.sqrt(b.roz[znak]); return [b.t, b.prum[znak] - s, b.prum[znak] + s]; }),
    }], { ymin: d.min, ymax: d.max, udalosti, popisY: d.jedn || '', formatX: fKrok });
    $('hMapa').firstChild.textContent = `${d.nazev}: četnosti hodnot v čase`;
    G.mapa($('gMapa'), H, znak, d, { udalosti, popisY: d.jedn || '' });
    G.cary($('gRoz'), J.GENY.map((gg, j) => ({
      body: sP.map(b => [b.t, Math.sqrt(b.roz[j]) / (gg.max - gg.min)]), barva: B.g[j], tloustka: j === znak ? 2.4 : 1.4, nazev: gg.nazev, des: 3,
    })), { ymin: 0, udalosti, popisY: 'SD/rozsah', formatX: fKrok });
    $('hHist').firstChild.textContent = `${d.nazev}: současné rozložení (n = ${cele(stav.orgs.length)})`;
    G.sloupce($('gHist'), J.histogram(stav.orgs, znak, 24), d, znak === 3 ? barvaGenu : null);
    G.cary($('gSmrt'), [
      { body: H.map(b => [b.t, b.smrt.hlad]), barva: B.g[2], nazev: 'hlad', des: 0 },
      { body: H.map(b => [b.t, b.smrt.predace]), barva: B.g[4], nazev: 'predace', des: 0 },
      { body: H.map(b => [b.t, b.smrt.stari]), barva: B.g[3], nazev: 'stáří', des: 0 },
      { body: H.map(b => [b.t, b.smrt.katastrofa]), barva: B.muted, carkovane: true, nazev: 'katastrofa', des: 0 },
    ], { ymin: 0, popisY: 'úmrtí', formatX: fKrok });
  }

  /* ---------- morfoprostor ---------- */
  let morfoO = null;
  function kresliMorfo() {
    if (!barvyCache) nactiBarvy();
    const gx = +$('morfoX').value, gy = +$('morfoY').value, dx = J.GENY[gx], dy = J.GENY[gy];
    const rezim = $('optBarvit').value;
    const body = stav.orgs.map(o => ({
      x: o.g[gx], y: o.g[gy], id: o.id, r: 1.4 + 1.5 * o.g[1],
      barva: barvaGenu(hodnotaBarveni(o, rezim)), titulek: `#${o.id} · generace ${o.gen}`,
    }));
    let xmin = dx.min, xmax = dx.max, ymin = dy.min, ymax = dy.max;
    if ($('morfoPriblizit').checked && body.length) {
      const rozp = (vals, d) => {
        let lo = Math.min(...vals), hi = Math.max(...vals);
        const m = Math.max((hi - lo) * 0.08, (d.max - d.min) * 0.01);
        return [Math.max(d.min, lo - m), Math.min(d.max, hi + m)];
      };
      [xmin, xmax] = rozp(body.map(b => b.x), dx); [ymin, ymax] = rozp(body.map(b => b.y), dy);
    }
    const stopa = $('morfoStopa').checked ? stav.historie.body.filter(b => b.n).map(b => [b.prum[gx], b.prum[gy]]) : null;
    morfoO = G.bodovy($('gMorfo'), body, {
      xmin, xmax, ymin, ymax, stopa, vybrany: vybranyId,
      popisX: dx.nazev + (dx.jedn ? ' [' + dx.jedn + ']' : ''), popisY: dy.nazev + (dy.jedn ? ' [' + dy.jedn + ']' : ''),
      formatX: x => cislo(x, dx.des + 1), formatY: y => cislo(y, dy.des + 1),
    });
  }

  /* ---------- analýza výběru ---------- */
  function fmtKoef(x, se) {
    if (!Number.isFinite(x)) return '–';
    const pr = A.pruka(x, se);
    const t = `${x > 0 ? '+' : ''}${cislo(x, 3)}${Number.isFinite(se) ? ' ± ' + cislo(se, 3) : ''}`;
    return pr ? `<span class="${x > 0 ? 'kladne' : 'zaporne'}"><b>${t}</b></span>` : t;
  }
  function vyklad(r) {
    if (!Number.isFinite(r.beta)) return 'bez variability – nelze hodnotit';
    const casti = [];
    if (A.pruka(r.beta, r.seBeta)) casti.push(r.beta > 0 ? 'přímý výběr pro vyšší hodnoty' : 'přímý výběr pro nižší hodnoty');
    if (A.pruka(r.gamma, r.seGamma)) casti.push(r.gamma < 0 ? 'stabilizující' : 'disruptivní');
    return casti.length ? casti.join(', ') : 'bez průkazného přímého výběru';
  }
  function kresliVyber() {
    if (!barvyCache) nactiBarvy();
    const okno = $('vyberOkno').value === 'vse' ? Infinity : +$('vyberOkno').value;
    const u = A.uzavreneKohorty(stav, J.K.KOH_SIRKA, okno, $('vyberBezKat').checked);
    const a = u.chyba ? { chyba: u.chyba, n: 0 } : A.selekceZeSum(u.soucet, J.GENY);
    const kont = $('vyberObsah');
    const gj = +$('vyberZnak').value, d = J.GENY[gj];
    $('hProfil').firstChild.textContent = `${d.nazev}: relativní fitness podle hodnoty znaku`;
    if (a.chyba) {
      const zivy = Number.isFinite(u.nejstarsiZivy) ? ` Nejstarší žijící jedinec se narodil v kroku ${cele(u.nejstarsiZivy)} – jeho kohorta se uzavře, až zemřou všichni její členové.` : '';
      kont.innerHTML = `<p class="prazdne">${esc(a.chyba)}${u.chyba ? '' : ` Jedinců v uzavřených kohortách: ${cele(a.n)}.`}${zivy} Nechte simulaci běžet déle.</p>`;
      G.intervaly($('gProfil'), [], {});
      return;
    }
    const od = u.od, N = stav.historie.body.filter(b => b.t >= od && b.n > 0).map(b => b.n);
    const Ne = A.harmonickyPrumer(N.length ? N : [stav.orgs.length]);
    const radky = a.geny.map(r => {
      const dd = J.GENY[r.j], pr = A.pruka(r.beta, r.seBeta) || A.pruka(r.gamma, r.seGamma);
      return `<tr${r.j === gj ? ' style="background:var(--accent-soft)"' : ''}><td>${dd.nazev}</td><td>${cislo(r.prum, dd.des + 1)}</td><td>${cislo(r.sd, dd.des + 2)}</td>
        <td>${Number.isFinite(r.S) ? (r.S > 0 ? '+' : '') + cislo(r.S, 3) : '–'}</td><td>${fmtKoef(r.beta, r.seBeta)}</td><td>${fmtKoef(r.gamma, r.seGamma)}</td>
        <td class="vyklad${pr ? ' prukazne' : ''}">${vyklad(r)}</td></tr>`;
    }).join('');
    kont.innerHTML = `
      <div class="box-rada">
        <div class="box" title="Jedinci narození v uzavřených kohortách okna"><div class="popis">Jedinců</div><div class="cislo">${cele(a.n)}</div></div>
        <div class="box" title="${u.kohort} uzavřených kohort po ${J.K.KOH_SIRKA} krocích; ${u.otevrenych} kohort ještě má žijící členy"><div class="popis">Narozeni v krocích</div><div class="cislo" style="font-size:.86rem">${cele(od)} – ${cele(u.do)}</div></div>
        <div class="box" title="Průměrný celoživotní počet potomků"><div class="popis">Průměr LRS</div><div class="cislo">${cislo(a.W, 2)}</div></div>
        <div class="box" title="Příležitost k výběru I = Var(LRS) / průměr²"><div class="popis">Příležitost I</div><div class="cislo">${cislo(a.I, 2)}</div></div>
        <div class="box" title="Harmonický průměr velikosti populace za období okna"><div class="popis">Ne ≈</div><div class="cislo">${cele(Ne)}</div></div>
        <div class="box" title="Podíl rozptylu fitness vysvětlený lineárním modelem"><div class="popis">R² (β model)</div><div class="cislo">${cislo(a.r2 * 100, 1)} %</div></div>
      </div>
      <div class="obal-tab" style="margin-top:10px"><table>
        <thead><tr><th>Znak</th><th>průměr</th><th>sd</th><th title="Selekční diferenciál v jednotkách sd">S</th><th title="Směrový selekční gradient ± SE">β ± SE</th><th title="Kvadratický gradient ± SE">γ ± SE</th><th style="text-align:left">výklad</th></tr></thead>
        <tbody>${radky}</tbody></table></div>`;
    const prof = a.geny[gj].profil;
    G.intervaly($('gProfil'), prof.filter(q => q.n > 0).map(q => ({
      od: q.od, do: q.do, y: q.w, lo: q.n > 1 ? q.w - q.ci : NaN, hi: q.n > 1 ? q.w + q.ci : NaN,
      titul: `${cislo(q.od, d.des + 1)} – ${cislo(q.do, d.des + 1)}${d.jedn ? ' ' + d.jedn : ''}`,
      popis: `w = ${cislo(q.w, 2)}${q.n > 1 ? ' ± ' + cislo(q.ci, 2) : ''} (n = ${q.n})`,
    })), { referencni: 1, popisY: 'relativní fitness', popisX: d.nazev });
  }

  /* ---------- export dat ---------- */
  function stahni(text, nazev, typ) {
    const blob = new Blob([text], { type: typ || 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = nazev;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function stahniCsv(radky, nazev) {
    const cz = $('csvCesky').checked;
    stahni((cz ? '\ufeff' : '') + A.csv(radky, cz), nazev);
  }
  const souborZaklad = () => `evoluce_${String(stav.seed).replace(/[^\w-]+/g, '_')}_krok${stav.tick}`;
  function csvVyvoj() {
    const k = J.GENY.map(d => d.k);
    const hl = ['krok', 'populace', 'potrava', 'predatori', 'generace_prumer', 'energie_prumer']
      .concat(k.map(x => 'prumer_' + x), k.map(x => 'sd_' + x), ['umrti_hlad', 'umrti_predace', 'umrti_stari', 'umrti_katastrofa', 'narozeni']);
    const rows = [hl].concat(stav.historie.body.map(b => [b.t, b.n, b.jidlo, b.pred, b.gen, b.en]
      .concat(b.prum.map((x, j) => b.n ? x : null), b.roz.map(v => b.n ? Math.sqrt(v) : null),
        [b.smrt.hlad, b.smrt.predace, b.smrt.stari, b.smrt.katastrofa, b.smrt.narozeni])));
    stahniCsv(rows, souborZaklad() + '_vyvoj.csv');
  }
  function csvPopulace() {
    const rows = [['id', 'generace', 'vek', 'energie', 'x', 'y', 'potomku'].concat(J.GENY.map(d => d.k))]
      .concat(stav.orgs.map(o => [o.id, o.gen, o.vek, o.e, o.x, o.y, o.pot || 0].concat(o.g)));
    stahniCsv(rows, souborZaklad() + '_populace.csv');
  }
  function csvZivoty() {
    const Z = stav.zivoty || [];
    if (!Z.length) { Dialog.chyba('Zatím žádný dokončený život.'); return; }
    const rows = [['narozen', 'zemrel', 'pricina', 'potomku'].concat(J.GENY.map(d => d.k))]
      .concat(Z.map(z => [z.n, z.u, z.pr, z.w].concat(z.g)));
    stahniCsv(rows, souborZaklad() + '_zivoty.csv');
  }

  /* ---------- počáteční populace a odkaz ---------- */
  function vyplnPocatek(pc) {
    $('pocPocet').value = pc.pocet;
    $('pocAlely').value = pc.alely ? pc.alely.map(x => cislo(x, 2)).join(' ') : '';
    $('pocGeny').innerHTML = J.GENY.map((d, j) => `<tr><td>${d.nazev}</td>
      <td><input type="number" id="pocS${j}" step="any" min="${d.min}" max="${d.max}" value="${pc.stred[j]}" aria-label="${d.nazev} – střed"></td>
      <td><input type="number" id="pocD${j}" step="any" min="0" value="${(pc.sd && pc.sd[j]) || 0}" aria-label="${d.nazev} – směrodatná odchylka"></td></tr>`).join('');
  }
  function cisloVstup(id, zaloha) { const v = parseFloat(String($(id).value).replace(',', '.')); return Number.isFinite(v) ? v : zaloha; }
  function prectiPocatek() {
    const zal = J.SCENARE[$('scenar').value].pocatek;
    const pc = {
      pocet: Math.max(1, Math.min(3000, Math.round(cisloVstup('pocPocet', zal.pocet)))),
      stred: J.GENY.map((d, j) => Math.min(d.max, Math.max(d.min, cisloVstup('pocS' + j, zal.stred[j])))),
      sd: J.GENY.map((d, j) => Math.max(0, cisloVstup('pocD' + j, 0))),
    };
    const alely = $('pocAlely').value.split(/[\s;]+/).map(x => parseFloat(x.replace(',', '.'))).filter(Number.isFinite).map(x => Math.min(1, Math.max(0, x)));
    if (alely.length) pc.alely = alely;
    return pc;
  }
  function b64url(t) { return btoa(unescape(encodeURIComponent(t))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function zB64url(t) { t = t.replace(/-/g, '+').replace(/_/g, '/'); while (t.length % 4) t += '='; return decodeURIComponent(escape(atob(t))); }
  function kodujExperiment() {
    const n = stav.nastaveni, scen = n.scenar && J.SCENARE[n.scenar] ? n.scenar : 'vychozi';
    const zakl = J.nastaveniScenare(scen), p = {};
    for (const k of Object.keys(n.p)) if (n.p[k] !== zakl.p[k]) p[k] = n.p[k];
    const o = { s: scen, seed: n.seed, p, z: stav.protokol.map(z => [z.t, z.k, z.v]) };
    if (JSON.stringify(n.pocatek) !== JSON.stringify(zakl.pocatek)) o.c = n.pocatek;
    return b64url(JSON.stringify(o));
  }
  function dekodujExperiment(t) {
    const o = JSON.parse(zB64url(t));
    if (!o || !J.SCENARE[o.s]) throw new Error('neznámý scénář');
    const zakl = J.nastaveniScenare(o.s);
    const upravy = { p: Object.assign({}, zakl.p, o.p || {}) };
    if (o.c && Array.isArray(o.c.stred) && o.c.stred.length === J.GENY.length) upravy.pocatek = o.c;
    if (Array.isArray(o.z)) upravy.plan = o.z.filter(z => Array.isArray(z) && z.length === 3 && (z[1] === 'katastrofa' || J.PARAMETRY.some(d => d.k === z[1])))
      .map(z => ({ t: Math.max(0, z[0] | 0), k: z[1], v: z[1] === 'katastrofa' ? Math.min(1, Math.max(0, +z[2] || 0)) : z[2] }));
    return { scenar: o.s, seed: String(o.seed || '1').slice(0, 64), upravy };
  }

  /* ---------- dávkové experimenty ---------- */
  let expZnak = 3;
  function expParametrUI() {
    const sweep = $('expTyp').value === 'sweep';
    $('expSweep').hidden = !sweep;
    const d = J.PARAMETRY.find(x => x.k === $('expPar').value);
    const bool = !!d.bool;
    ['expOd', 'expDo', 'expPocet'].forEach(id => { $(id).parentElement.hidden = bool; });
    if (!bool) {
      $('expOd').min = $('expDo').min = d.min; $('expOd').max = $('expDo').max = d.max; $('expOd').step = $('expDo').step = d.krok;
    }
  }
  function vychoziRozsahSweep() {
    const d = J.PARAMETRY.find(x => x.k === $('expPar').value);
    if (d.bool) return;
    const v = stav.nastaveni.p[d.k], L = d.max - d.min;
    const zaokr = x => Math.round(x / d.krok) * d.krok;
    $('expOd').value = +zaokr(Math.max(d.min, v - L * 0.25)).toFixed(6);
    $('expDo').value = +zaokr(Math.min(d.max, v + L * 0.25)).toFixed(6);
  }
  function zakladExperimentu() {
    const n = JSON.parse(JSON.stringify(stav.nastaveni));
    n.plan = JSON.parse(JSON.stringify(stav.protokol));
    return n;
  }
  async function spustitExperiment() {
    if (experiment) return;
    const typ = $('expTyp').value;
    const rep = Math.max(2, Math.min(50, Math.round(cisloVstup('expRep', 8))));
    const delka = Math.max(100, Math.min(200000, Math.round(cisloVstup('expDelka', 5000))));
    const zaklad = ($('expSeed').value.trim() || stav.seed).slice(0, 48);
    const zaznam = Math.max(10, Math.round(delka / 150 / 10) * 10);
    let par = null, d = null, hodnoty = [null];
    if (typ === 'sweep') {
      par = $('expPar').value; d = J.PARAMETRY.find(x => x.k === par);
      if (d.bool) hodnoty = [false, true];
      else {
        const od = cisloVstup('expOd', NaN), d2 = cisloVstup('expDo', NaN);
        const pocet = Math.max(2, Math.min(15, Math.round(cisloVstup('expPocet', 5))));
        if (!Number.isFinite(od) || !Number.isFinite(d2) || od === d2) { Dialog.chyba('Zadejte dvě různé meze „od“ a „do“.'); return; }
        const set = new Set();
        for (let i = 0; i < pocet; i++) set.add(J.normalizujParametry({ [par]: od + (d2 - od) * i / (pocet - 1) })[par]);
        hodnoty = Array.from(set).sort((a, b) => a - b);
        if (hodnoty.length < 2) { Dialog.chyba('Po zaokrouhlení zbyla jen jedna hodnota – zvětšete rozsah.'); return; }
      }
    }
    const zakl = zakladExperimentu();
    const ulohy = [];
    hodnoty.forEach((h, hi) => {
      for (let i = 0; i < rep; i++) {
        const n = JSON.parse(JSON.stringify(zakl));
        n.seed = `${zaklad}-${i + 1}`;
        if (par) { n.p[par] = h; n.plan = n.plan.filter(z => z.k !== par); }
        ulohy.push({ id: ulohy.length, nastaveni: n, delka, zaznam, hi, r: i });
      }
    });
    const prace = ulohy.length * delka;
    if (prace > 2e6 && !(await Dialog.potvrd(`Experiment má ${cele(ulohy.length)} běhů po ${cele(delka)} krocích (${cele(prace)} kroků). Může to trvat i několik minut. Pokračovat?`))) return;
    expVysledek = { typ, par, hodnoty, rep, delka, zaklad, zaznam, ulohy, vysledky: new Array(ulohy.length).fill(null), chyby: 0, start: performance.now(), hotovo: false };
    const ticky = new Array(ulohy.length).fill(0);
    let posledniKresba = 0;
    const progres = () => {
      const f = ticky.reduce((a, b) => a + b, 0) / prace;
      $('expProg').value = f;
      const hot = expVysledek.vysledky.filter(Boolean).length;
      const uplynulo = (performance.now() - expVysledek.start) / 1000;
      const zbyva = f > 0.02 ? uplynulo * (1 - f) / f : NaN;
      $('expStav').textContent = `${cele(hot)} / ${cele(ulohy.length)} běhů · ${cislo(f * 100, 0)} % · ${cislo(uplynulo, 0)} s` +
        (Number.isFinite(zbyva) && f < 1 ? ` · zbývá asi ${cislo(zbyva, 0)} s` : '') +
        (experiment ? (experiment.rezim === 'worker' ? ` · ${experiment.vlaken} vláken` : ' · hlavní vlákno') : '');
    };
    $('expPrubeh').hidden = false; $('btnExp').disabled = true; $('btnExpZrus').disabled = false;
    experiment = window.EvoExperiment.spust(ulohy.map(u => ({ id: u.id, nastaveni: u.nastaveni, delka, zaznam })), {
      prubeh(id, t) { ticky[id] = t; progres(); },
      hotovo(id, v) {
        ticky[id] = delka; expVysledek.vysledky[id] = v; progres();
        const ted = performance.now();
        if (zalozka === 'exp' && ted - posledniKresba > 1500) { posledniKresba = ted; vykresliExperiment(); }
      },
      chyba(id, z) { ticky[id] = delka; expVysledek.chyby++; console.error('Replika', id, z); },
      konec(zruseno) {
        experiment = null; expVysledek.hotovo = true; expVysledek.zruseno = zruseno;
        $('btnExp').disabled = false; $('btnExpZrus').disabled = true;
        progres();
        $('expStav').textContent += zruseno ? ' · zrušeno' : ' · hotovo';
        if (expVysledek.chyby) Dialog.chyba(`${expVysledek.chyby} běhů skončilo chybou (podrobnosti v konzoli).`);
        vykresliExperiment();
      },
    });
    progres();
  }
  /** Souhrny hotových replik: [{u (úloha), v (výsledek), s (souhrn)}] */
  function hotoveRepliky() {
    const E = expVysledek;
    return E.ulohy.map((u, i) => ({ u, v: E.vysledky[i] })).filter(x => x.v).map(x => Object.assign(x, { s: A.souhrnRepliky(x.v) }));
  }
  function fmtCI(p, des) { return p.n ? cislo(p.prum, des) + (p.n > 1 ? ' ± ' + cislo(p.ci, des) : '') : '–'; }
  function popisHodnoty(h) {
    const E = expVysledek;
    if (!E.par) return '';
    const d = J.PARAMETRY.find(x => x.k === E.par);
    return d.bool ? (h ? 'zapnuto' : 'vypnuto') : formatParam(d, h);
  }
  function vykresliExperiment() {
    const kont = $('expVysledky');
    const E = expVysledek;
    if (!E) { kont.innerHTML = ''; return; }
    if (!barvyCache) nactiBarvy();
    const B = barvyCache, H = hotoveRepliky();
    if (!H.length) { kont.innerHTML = '<p class="prazdne">Počítám první repliky…</p>'; return; }
    const d = J.GENY[expZnak], pd = E.par ? J.PARAMETRY.find(x => x.k === E.par) : null;
    const volbaZnaku = `<select id="expZnak" aria-label="Znak ve výsledcích">${J.GENY.map((g, j) => `<option value="${j}"${j === expZnak ? ' selected' : ''}>${g.nazev}</option>`).join('')}</select>`;
    const hlavicka = `<div class="formular cast" style="align-items:center">
      <b style="color:var(--text)">${E.typ === 'rep' ? 'Replikace' : 'Citlivost: ' + esc(pd.nazev)}</b>
      <span>${cele(H.length)} / ${cele(E.ulohy.length)} běhů · ${cele(E.delka)} kroků · seedy ${esc(E.zaklad)}-1 … -${E.rep}${E.hotovo ? '' : ' · průběžně'}</span>
      <label style="flex-direction:row;align-items:center;gap:6px">znak ${volbaZnaku}</label>
      <button class="male" id="btnExpCsvS">CSV souhrn</button><button class="male" id="btnExpCsvP">CSV průběhy</button></div>`;
    let telo = '';
    const vymrelo = H.filter(x => x.v.vymrelo !== null).length;
    if (E.typ === 'rep') {
      telo = `<div class="grafy cast">
        <div class="graf"><h3>${esc(d.nazev)}: průměr přes repliky<button class="male png" data-png="gExpZnak">PNG</button></h3><canvas id="gExpZnak"></canvas>
          <div class="leg"><span><i style="background:${B.g[0]}"></i>průměr replik</span><span><i style="background:${B.g[0]};opacity:.3;height:9px;vertical-align:-1px"></i>95% interval</span><span><i style="background:${B.muted}"></i>jednotlivé repliky</span></div></div>
        <div class="graf"><h3>Velikost populace<button class="male png" data-png="gExpN">PNG</button></h3><canvas id="gExpN"></canvas>
          <div class="leg"><span><i style="background:${B.g[1]}"></i>průměr replik</span><span><i style="background:${B.g[1]};opacity:.3;height:9px;vertical-align:-1px"></i>95% interval</span></div></div>
      </div>
      <h3>Výsledek (průměr posledních 20 % běhu)${vymrelo ? ` – vymřelo ${vymrelo} z ${H.length}` : ''}</h3>
      <div class="obal-tab"><table><thead><tr><th>Znak</th><th>start</th><th>konec ± 95% CI</th><th>sd mezi replikami</th><th>min – max</th></tr></thead><tbody>
      ${J.GENY.map((g, j) => {
        const p = A.popis(H.filter(x => x.s.prum).map(x => x.s.prum[j]));
        const st = A.popis(H.map(x => x.v.rada[0].prum[j]));
        return `<tr><td>${g.nazev}</td><td>${cislo(st.prum, g.des + 1)}</td><td>${fmtCI(p, g.des + 1)}</td><td>${cislo(p.sd, g.des + 2)}</td><td>${p.n ? cislo(p.min, g.des + 1) + ' – ' + cislo(p.max, g.des + 1) : '–'}</td></tr>`;
      }).join('')}
      <tr><td>Populace</td><td>${cele(A.popis(H.map(x => x.v.rada[0].n)).prum)}</td><td>${fmtCI(A.popis(H.map(x => x.s.n)), 0)}</td><td>${cislo(A.popis(H.map(x => x.s.n)).sd, 0)}</td><td></td></tr>
      </tbody></table></div>`;
    } else {
      telo = `<div class="grafy cast">
        <div class="graf"><h3>${esc(d.nazev)} na konci podle parametru<button class="male png" data-png="gExpSweep">PNG</button></h3><canvas id="gExpSweep"></canvas>
          <div class="leg"><span><i style="background:${B.g[0]}"></i>průměr replik ± 95% interval</span></div></div>
        <div class="graf"><h3>Velikost populace na konci<button class="male png" data-png="gExpSweepN">PNG</button></h3><canvas id="gExpSweepN"></canvas>
          <div class="leg"><span><i style="background:${B.g[1]}"></i>průměr replik ± 95% interval (vymřelé = 0)</span></div></div>
      </div>`;
    }
    const radky = H.map(x => `<tr class="klik" data-uloha="${x.u.id}" title="Otevřít tento běh v laboratoři">
      ${E.par ? `<td>${esc(popisHodnoty(E.hodnoty[x.u.hi]))}</td>` : ''}<td>${esc(x.v.seed)}</td><td>${x.v.vymrelo !== null ? 'vymřela v kroku ' + cele(x.v.vymrelo) : cele(x.s.n)}</td>
      ${J.GENY.map((g, j) => `<td>${x.s.prum ? cislo(x.s.prum[j], g.des + 1) : '–'}</td>`).join('')}</tr>`).join('');
    const souhrnSweep = E.typ === 'sweep' ? `<h3>Souhrn podle hodnoty parametru</h3><div class="obal-tab"><table><thead><tr><th>${esc(pd.nazev)}</th><th>vymřelo</th><th>populace</th>${J.GENY.map(g => `<th>${g.nazev}</th>`).join('')}</tr></thead><tbody>
      ${E.hodnoty.map((h, hi) => {
        const X = H.filter(x => x.u.hi === hi);
        if (!X.length) return '';
        return `<tr><td>${esc(popisHodnoty(h))}</td><td>${X.filter(x => x.v.vymrelo !== null).length} / ${X.length}</td><td>${fmtCI(A.popis(X.map(x => x.s.n)), 0)}</td>` +
          J.GENY.map((g, j) => `<td>${fmtCI(A.popis(X.filter(x => x.s.prum).map(x => x.s.prum[j])), g.des + 1)}</td>`).join('') + '</tr>';
      }).join('')}</tbody></table></div>` : '';
    kont.innerHTML = hlavicka + telo + souhrnSweep + `<h3>Jednotlivé běhy (klepnutím otevřete v laboratoři)</h3><div class="obal-tab" style="max-height:320px;overflow-y:auto"><table>
      <thead><tr>${E.par ? `<th>${esc(pd.nazev)}</th>` : ''}<th>seed</th><th>populace</th>${J.GENY.map(g => `<th>${g.nazev}</th>`).join('')}</tr></thead><tbody>${radky}</tbody></table></div>`;
    const fKrok = x => 'krok ' + cele(x);
    if (E.typ === 'rep') {
      const pr = A.prubehReplik(H.map(x => x.v), expZnak);
      const jednotlive = H.map(x => ({ body: x.v.rada.filter(b => b.n).map(b => [b.t, b.prum[expZnak]]), barva: B.muted, tloustka: 0.7 }));
      G.cary($('gExpZnak'), jednotlive.concat([{
        body: pr.map(b => [b.t, b.prum]), barva: B.g[0], tloustka: 2.2, nazev: `průměr (95% CI, n)`, des: d.des + 1,
        pas: pr.map(b => [b.t, b.prum - (b.ci || 0), b.prum + (b.ci || 0)]),
      }]), { ymin: d.min, ymax: d.max, popisY: d.jedn || '', formatX: fKrok });
      const pn = A.prubehReplik(H.map(x => x.v), 'n');
      G.cary($('gExpN'), [{
        body: pn.map(b => [b.t, b.prum]), barva: B.g[1], tloustka: 2, nazev: 'populace (95% CI)', des: 0,
        pas: pn.map(b => [b.t, Math.max(0, b.prum - (b.ci || 0)), b.prum + (b.ci || 0)]),
      }], { ymin: 0, popisY: 'počet', formatX: fKrok });
    } else {
      const xh = h => (typeof h === 'boolean' ? (h ? 1 : 0) : h);
      const fx = x => pd.bool ? (x >= 0.5 ? 'zapnuto' : 'vypnuto') : formatParam(pd, x);
      const body = [], chyby = [], bodyN = [], chybyN = [];
      E.hodnoty.forEach((h, hi) => {
        const X = H.filter(x => x.u.hi === hi);
        if (!X.length) return;
        const p = A.popis(X.filter(x => x.s.prum).map(x => x.s.prum[expZnak]));
        if (p.n) { body.push([xh(h), p.prum]); chyby.push([xh(h), p.prum - (p.ci || 0), p.prum + (p.ci || 0)]); }
        const pn = A.popis(X.map(x => x.s.n));
        bodyN.push([xh(h), pn.prum]); chybyN.push([xh(h), Math.max(0, pn.prum - (pn.ci || 0)), pn.prum + (pn.ci || 0)]);
      });
      G.cary($('gExpSweep'), [{ body, chyby, znacky: true, barva: B.g[0], tloustka: 1.6, nazev: d.nazev, des: d.des + 1 }],
        { ymin: d.min, ymax: d.max, popisY: d.jedn || '', popisX: pd.nazev, formatX: fx });
      G.cary($('gExpSweepN'), [{ body: bodyN, chyby: chybyN, znacky: true, barva: B.g[1], tloustka: 1.6, nazev: 'populace', des: 0 }],
        { ymin: 0, popisY: 'počet', popisX: pd.nazev, formatX: fx });
    }
    $('expZnak').addEventListener('change', () => { expZnak = +$('expZnak').value; vykresliExperiment(); });
    $('btnExpCsvS').addEventListener('click', csvExperimentSouhrn);
    $('btnExpCsvP').addEventListener('click', csvExperimentPrubehy);
    kont.querySelectorAll('tr.klik').forEach(tr => tr.addEventListener('click', () => otevritBeh(+tr.dataset.uloha)));
  }
  function csvExperimentSouhrn() {
    const E = expVysledek, k = J.GENY.map(d => d.k);
    const rows = [(E.par ? [E.par] : []).concat(['replika', 'seed', 'kroku', 'vymrelo_v_kroku', 'populace_konec'], k.map(x => 'prumer_' + x))];
    for (const x of hotoveRepliky()) rows.push((E.par ? [E.hodnoty[x.u.hi]] : []).concat([x.u.r + 1, x.v.seed, x.v.kroku, x.v.vymrelo, x.s.n], x.s.prum || k.map(() => null)));
    stahniCsv(rows, `evoluce_experiment_${E.zaklad.replace(/[^\w-]+/g, '_')}_souhrn.csv`);
  }
  function csvExperimentPrubehy() {
    const E = expVysledek, k = J.GENY.map(d => d.k);
    const rows = [(E.par ? [E.par] : []).concat(['replika', 'seed', 'krok', 'populace'], k.map(x => 'prumer_' + x), k.map(x => 'sd_' + x))];
    for (const x of hotoveRepliky()) for (const b of x.v.rada)
      rows.push((E.par ? [E.hodnoty[x.u.hi]] : []).concat([x.u.r + 1, x.v.seed, b.t, b.n], b.prum.map(v => b.n ? v : null), b.roz.map(v => b.n ? Math.sqrt(v) : null)));
    stahniCsv(rows, `evoluce_experiment_${E.zaklad.replace(/[^\w-]+/g, '_')}_prubehy.csv`);
  }
  async function otevritBeh(id) {
    const u = expVysledek.ulohy[id];
    if (!(await Dialog.potvrd(`Otevřít běh se seedem „${u.nastaveni.seed}“ v laboratoři od kroku 0? Současná simulace se zahodí (výsledky experimentu zůstanou).`))) return;
    nastavBeh(false);
    stav = J.vytvorSvet(JSON.parse(JSON.stringify(u.nastaveni)));
    poZmeneStavu();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    Dialog.info('Běh otevřen – spusťte ho mezerníkem nebo tlačítkem ▶');
  }

  /* ---------- záložky ---------- */
  const ZALOZKY = ['grafy', 'morfo', 'vyber', 'exp'];
  function prepniZalozku(k, fokus) {
    zalozka = k;
    for (const z of ZALOZKY) {
      const t = $('tab-' + z);
      t.setAttribute('aria-selected', z === k ? 'true' : 'false');
      t.tabIndex = z === k ? 0 : -1;
      $('pan-' + z).hidden = z !== k;
    }
    if (fokus) $('tab-' + k).focus();
    prekresliZalozku();
    ulozVolby();
  }
  function prekresliZalozku() {
    if (zalozka === 'grafy') { posledniGrafy = stav.historie.body.length; kresliGrafy(); }
    else if (zalozka === 'morfo') kresliMorfo();
    else if (zalozka === 'vyber') kresliVyber();
    else if (zalozka === 'exp') vykresliExperiment();
  }

  function obnovJedince(vynutit) {
    const kont = $('jedinec');
    if (!vybranyId) {
      if (vynutit || !kont.querySelector('.prazdne')) {
        kont.innerHTML = '<p class="prazdne">Klepněte na organismus ve světě, nebo <button class="male" id="btnNahodny">vyberte náhodného</button>.</p>';
        $('btnNahodny').addEventListener('click', vyberNahodneho);
      }
      return;
    }
    const o = stav.orgs.find(x => x.id === vybranyId);
    const z = stav.rod[vybranyId];
    if (!o && !z) { vybranyId = 0; obnovJedince(true); return; }
    const g = o ? o.g : z.g;
    const st = J.statistika(stav.orgs);
    const sp = J.spotreba(g, stav.p);
    const em = J.emax(g);
    // hlavička + geny – přepisujeme jen část, rodokmen jen při změně
    let hl = kont.querySelector('#jedHlava');
    if (!hl || vynutit) {
      kont.innerHTML = `<div id="jedHlava"></div>
        <h3>Rodokmen (předci)</h3>
        <div class="tlacitka" style="margin-top:0;align-items:center">
          <label for="hloubka" style="font-size:.8rem;color:var(--text-muted)">hloubka</label>
          <select id="hloubka"></select>
          <button class="male" id="btnZrusVyber">Zrušit výběr</button>
          <button class="male" id="btnNahodny2">Náhodný jedinec</button>
        </div>
        <div class="rodokmen" id="rodokmen"></div>
        <p class="napoveda">Kořen vlevo je vybraný jedinec, doprava jeho rodiče, prarodiče… Barva kroužku = gen barvy, prázdný kroužek = už nežije,
          „?“ = záznam se nezachoval (oříznuto kvůli paměti). Klepnutím na předka zobrazíte jeho údaje.</p>`;
      hl = $('jedHlava');
      const pohl = (z && z.r.length === 2) || stav.p.rekombinace;
      const vychozi = hloubkaRodokmenu || (pohl ? 4 : 10);
      const moznosti = pohl ? [2, 3, 4, 5, 6] : [3, 5, 10, 20, 40];
      if (!moznosti.includes(vychozi)) moznosti.push(vychozi);
      $('hloubka').innerHTML = moznosti.sort((a, b) => a - b).map(h => `<option value="${h}"${h === vychozi ? ' selected' : ''}>${h} generací</option>`).join('');
      $('hloubka').addEventListener('change', () => { hloubkaRodokmenu = +$('hloubka').value; kresliRodokmen(); });
      $('btnZrusVyber').addEventListener('click', () => vyber(0));
      $('btnNahodny2').addEventListener('click', vyberNahodneho);
      kresliRodokmen();
    }
    const radky = J.GENY.map((d, j) => `<tr><td>${d.nazev}</td><td>${cislo(g[j], d.des)}${d.jedn ? ' ' + d.jedn : ''}</td><td>${st.n ? cislo(st.prum[j], d.des) : '–'}</td></tr>`).join('');
    const zivy = !!o;
    const potomci = J.zijiciPotomci(stav, vybranyId);
    hl.innerHTML = `
      <div class="box-rada">
        <div class="box"><div class="popis">Jedinec</div><div class="cislo">#${vybranyId}</div></div>
        <div class="box"><div class="popis">Stav</div><div class="cislo" style="color:${zivy ? 'var(--ok)' : 'var(--danger)'}">${zivy ? 'žije' : 'mrtvý'}</div></div>
        <div class="box"><div class="popis">Generace</div><div class="cislo">${o ? o.gen : z.gen}</div></div>
        <div class="box"><div class="popis">${zivy ? 'Věk' : 'Žil'}</div><div class="cislo">${zivy ? cele(o.vek) : (z.u !== null ? cele(z.u - z.n) : '–')} kr.</div></div>
        <div class="box"><div class="popis">Žijící potomci</div><div class="cislo">${cele(potomci)}</div></div>
      </div>
      ${zivy ? `<div style="font-size:.8rem;color:var(--text-muted);margin-top:8px">Zásoby ${cislo(o.e, 1)} / ${cislo(em, 0)} J, rozmnoží se od ${cislo(g[4] * em, 0)} J${o.vek < J.K.DOSPELOST ? ' (ještě nedospělý)' : ''}</div>
        <div class="energie-pruh" role="img" aria-label="Zásoby energie"><span style="width:${Math.max(0, Math.min(100, o.e / em * 100)).toFixed(1)}%"></span></div>`
        : `<div style="font-size:.8rem;color:var(--text-muted);margin-top:8px">Narozen v kroku ${cele(z.n)}, zemřel v kroku ${z.u !== null ? cele(z.u) : '?'} – příčina: ${({ hlad: 'hlad', stari: 'stáří', predace: 'predátor', katastrofa: 'katastrofa' })[z.pr] || 'neznámá'}.</div>`}
      <div class="grafy" style="margin-top:6px;gap:10px">
        <div class="obal-tab"><table><thead><tr><th>Gen</th><th>jedinec</th><th>průměr pop.</th></tr></thead><tbody>${radky}</tbody></table></div>
        <div class="obal-tab"><table><thead><tr><th>Spotřeba za krok</th><th>J</th><th>podíl</th></tr></thead><tbody>
          ${[['pohyb (s³·v²)', sp.pohyb], ['vnímání (p)', sp.vnim], ['bazální (s^2,25)', sp.bazal], ['teplo (chlad·s²)', sp.teplo]].map(([n, v]) =>
            `<tr><td>${n}</td><td>${cislo(v, 3)}</td><td>${cislo(v / sp.celkem * 100, 0)} %</td></tr>`).join('')}
          <tr><td><b>celkem</b></td><td><b>${cislo(sp.celkem, 3)}</b></td><td>${zivy ? 'vydrží ' + cele(o.e / sp.celkem) + ' kr.' : ''}</td></tr>
        </tbody></table></div>
      </div>`;
  }
  function vyberNahodneho() {
    if (!stav.orgs.length) return;
    const o = stav.orgs[Math.floor(Math.random() * stav.orgs.length)];
    vyber(o.id);
  }

  function kresliRodokmen() {
    const kont = $('rodokmen'); if (!kont) return;
    const h = +($('hloubka') && $('hloubka').value) || 4;
    const strom = J.predkove(stav, vybranyId, h);
    const RH = 26, SL = 118, OK = 10;
    let listu = 0, maxH = 0, uzlu = 0;
    (function rozmer(u, d) {
      uzlu++;
      if (d > maxH) maxH = d;
      if (!u.rodice.length) { u.list = 1; listu++; return 1; }
      let s = 0; for (const c of u.rodice) s += rozmer(c, d + 1);
      u.list = s; return s;
    })(strom, 0);
    if (uzlu > 3000) { kont.innerHTML = '<p class="prazdne" style="padding:10px">Rodokmen je příliš rozsáhlý – zvolte menší hloubku.</p>'; return; }
    const W = (maxH + 1) * SL + OK * 2, H = listu * RH + OK * 2;
    const hrany = [], uzly = [];
    const zive = new Set(stav.orgs.map(o => o.id));
    (function umisti(u, d, y0) {
      u.x = OK + 10 + d * SL; u.y = y0 + u.list * RH / 2;
      let y = y0;
      for (const c of u.rodice) { umisti(c, d + 1, y); y += c.list * RH; hrany.push(`<path d="M${u.x + 7},${u.y} C${u.x + SL / 2},${u.y} ${c.x - SL / 2},${c.y} ${c.x - 7},${c.y}"/>`); }
      const z = u.z;
      const ziv = zive.has(u.id);
      const titul = z ? `#${u.id}, generace ${z.gen}, narozen v kroku ${z.n}${z.u !== null ? ', zemřel v kroku ' + z.u : ''}\n` +
        J.GENY.map((d2, j) => `${d2.nazev}: ${cislo(z.g[j], d2.des)}`).join('\n') : `#${u.id}: záznam nezachován`;
      uzly.push(`<g class="uzel" data-id="${u.id}" data-ma="${z ? 1 : 0}"><title>${esc(titul)}</title>
        ${z ? `<circle cx="${u.x}" cy="${u.y}" r="7" fill="${ziv ? barvaGenu(z.g[3]) : 'none'}" stroke="${barvaGenu(z.g[3])}" stroke-width="${ziv ? 1 : 2.5}"/>`
            : `<circle cx="${u.x}" cy="${u.y}" r="7" fill="none" stroke="var(--text-muted)" stroke-dasharray="2 2"/>`}
        <text x="${u.x + 11}" y="${u.y - 2}">${z ? '#' + u.id : '?'}</text>
        <text class="slabe" x="${u.x + 11}" y="${u.y + 10}">${z ? 'g' + z.gen + ' · v ' + cislo(z.g[0], 1) + ' · s ' + cislo(z.g[1], 1) : 'oříznuto'}</text></g>`);
    })(strom, 0, OK);
    kont.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Rodokmen jedince #${vybranyId}">${hrany.join('')}${uzly.join('')}</svg>`;
    kont.querySelectorAll('g.uzel').forEach(el => el.addEventListener('click', () => {
      if (el.dataset.ma === '1' && +el.dataset.id !== vybranyId) vyber(+el.dataset.id);
    }));
  }

  /* ---------- uložení ---------- */
  function ulozit() {
    try {
      J.proriznRodokmen(stav, vybranyId ? [vybranyId] : null);
      localStorage.setItem(KLIC_STAV, J.serializuj(stav));
      Dialog.info(`Stav uložen (krok ${cele(stav.tick)})`);
      infoUlozeni();
    } catch (e) {
      Dialog.chyba('Stav se do prohlížeče nevešel (' + (e && e.name === 'QuotaExceededError' ? 'plné úložiště' : e.message) + '). Použijte export do souboru.');
    }
  }
  async function nacist() {
    let text = null;
    try { text = localStorage.getItem(KLIC_STAV); } catch (e) { /* nedostupné */ }
    if (!text) { Dialog.chyba('V prohlížeči není uložený žádný stav.'); return; }
    try {
      const s = J.obnov(text);
      if (!(await Dialog.potvrd(`Načíst uložený stav (krok ${cele(s.tick)}, seed „${s.seed}“)? Současná simulace se zahodí.`))) return;
      nastavBeh(false); stav = s; poZmeneStavu();
      Dialog.info('Stav načten');
    } catch (e) { Dialog.chyba(e.message); }
  }
  function infoUlozeni() {
    try {
      const t = localStorage.getItem(KLIC_STAV);
      if (t) {
        const m = /"tick":(\d+)/.exec(t);
        $('ulozeniInfo').textContent = `V prohlížeči je uložen stav z kroku ${m ? cele(+m[1]) : '?'} (${cislo(t.length / 1048576, 2)} MB). Pro archiv použijte export do souboru.`;
      }
    } catch (e) { /* nic */ }
  }
  function exportovat() {
    J.proriznRodokmen(stav, vybranyId ? [vybranyId] : null);
    const blob = new Blob([J.serializuj(stav)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `evoluce_${String(stav.seed).replace(/[^\w-]+/g, '_')}_krok${stav.tick}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function importovat(soubor) {
    const r = new FileReader();
    r.onload = () => {
      try { const s = J.obnov(String(r.result)); nastavBeh(false); stav = s; poZmeneStavu(); Dialog.info(`Načten stav z kroku ${cele(s.tick)}`); }
      catch (e) { Dialog.chyba(e.message); }
    };
    r.onerror = () => Dialog.chyba('Soubor se nepodařilo přečíst.');
    r.readAsText(soubor);
  }
  async function prehrat() {
    if (stav.tick > 30000 && !(await Dialog.potvrd(`Přehrání ${cele(stav.tick)} kroků může chvíli trvat. Pokračovat?`))) return;
    const bylo = bezi; nastavBeh(false);
    $('btnPrehrat').disabled = true; $('btnPrehrat').textContent = 'Přehrávám…';
    await new Promise(r => setTimeout(r, 30));
    try {
      const t0 = performance.now();
      const r = J.prehraj(stav);
      const shoda = JSON.stringify([r.orgs, r.potrava, r.predatori, r.rng]) === JSON.stringify([stav.orgs, stav.potrava, stav.predatori, stav.rng]);
      const ms = performance.now() - t0;
      if (shoda) Dialog.info(`✓ Přehráno ${cele(stav.tick)} kroků za ${cislo(ms / 1000, 1)} s – stav je bit po bitu shodný.`);
      else Dialog.chyba('Přehrání se liší – stav byl pravděpodobně načten z jiné verze nebo upraven ručně.');
    } catch (e) { Dialog.chyba('Přehrání selhalo: ' + e.message); }
    $('btnPrehrat').disabled = false; $('btnPrehrat').textContent = 'Přehrát a ověřit';
    if (bylo) nastavBeh(true);
  }

  /* ---------- události ---------- */
  function init() {
    // scénáře
    $('scenar').innerHTML = Object.entries(J.SCENARE).map(([k, s]) => `<option value="${k}">${esc(s.nazev)}</option>`).join('');
    $('znak').innerHTML = J.GENY.map((d, j) => `<option value="${j}">${d.nazev}</option>`).join('');
    $('prechod').style.background = `linear-gradient(90deg, ${[0, 0.25, 0.5, 0.75, 1].map(barvaGenu).join(', ')})`;
    $('legRoz').innerHTML = J.GENY.map((d, j) => `<span><i style="background: var(--g${j + 1})"></i>${d.nazev.toLowerCase()}</span>`).join('');
    const moznostiGenu = J.GENY.map((d, j) => `<option value="${j}">${d.nazev}</option>`).join('');
    $('morfoX').innerHTML = $('morfoY').innerHTML = $('vyberZnak').innerHTML = moznostiGenu;
    $('morfoX').value = '1'; $('morfoY').value = '0'; $('vyberZnak').value = '0';
    $('planCo').innerHTML = '<option value="katastrofa">Katastrofa</option>' + J.PARAMETRY.map(d => `<option value="${d.k}">${esc(d.nazev)}</option>`).join('');
    $('expPar').innerHTML = J.PARAMETRY.map(d => `<option value="${d.k}">${esc(d.nazev)}</option>`).join('');
    $('expPar').value = 'prisunPotravy';
    stavbaParametru();
    nactiVolby();
    $('znak').value = znak;
    // tlačítka PNG u grafů
    document.querySelectorAll('.graf > canvas').forEach(cv => {
      const h = cv.previousElementSibling;
      if (!h || h.tagName !== 'H3' || h.querySelector('.png')) return;
      const b = document.createElement('button'); b.className = 'male png'; b.textContent = 'PNG'; b.dataset.png = cv.id; b.title = 'Stáhnout graf jako obrázek';
      h.appendChild(b);
    });
    document.addEventListener('click', e => {
      const b = e.target.closest && e.target.closest('button[data-png]');
      if (b && $(b.dataset.png)) G.stahniPng($(b.dataset.png), `evoluce_${b.dataset.png}_krok${stav.tick}.png`);
      const x = e.target.closest && e.target.closest('button[data-zrus]');
      if (x) { try { J.zrusZasah(stav, +x.dataset.zrus); vykresliProtokol(); } catch (err) { Dialog.chyba(err.message); } }
    });

    let scenar = 'vychozi', seed = null, upravy = null;
    try {
      const h = new URLSearchParams(location.hash.slice(1));
      if (h.get('exp')) {
        try { const x = dekodujExperiment(h.get('exp')); scenar = x.scenar; seed = x.seed; upravy = x.upravy; }
        catch (e) { setTimeout(() => Dialog.chyba('Odkaz na experiment je poškozený: ' + e.message), 300); }
      }
      if (!upravy && h.get('scenar') && J.SCENARE[h.get('scenar')]) scenar = h.get('scenar');
      if (!upravy && h.get('seed')) seed = h.get('seed').slice(0, 64);
    } catch (e) { /* neplatný hash */ }
    novySvet(scenar, seed || nahodnySeed(), upravy);
    $('expSeed').value = 'exp';
    vychoziRozsahSweep(); expParametrUI();
    planHodnotaPole();
    prepniZalozku(zalozka);
    infoUlozeni();

    $('btnBeh').addEventListener('click', () => nastavBeh(!bezi));
    $('btnKrok').addEventListener('click', () => { nastavBeh(false); provedKroky(1); obnovPanel(true); });
    $('btnKrok100').addEventListener('click', () => { nastavBeh(false); provedKroky(100); obnovPanel(true); });
    $('btnKrok1000').addEventListener('click', () => { nastavBeh(false); provedKroky(1000); obnovPanel(true); });
    $('rychlost').addEventListener('change', () => { rychlost = $('rychlost').value; akum = 0; ulozVolby(); });
    $('znak').addEventListener('change', () => { znak = +$('znak').value; kresliGrafy(); ulozVolby(); });
    ['optBarvit', 'optVnimani', 'optSmer'].forEach(id => $(id).addEventListener('change', () => { kresliSvet(); ulozVolby(); }));
    $('scenar').addEventListener('change', () => { zobrazPopisScenare(); vyplnPocatek(J.SCENARE[$('scenar').value].pocatek); });
    ZALOZKY.forEach((z, i) => $('tab-' + z).addEventListener('click', () => prepniZalozku(z)));
    document.querySelector('.zalozky').addEventListener('keydown', e => {
      const i = ZALOZKY.indexOf(zalozka);
      if (e.key === 'ArrowRight') { e.preventDefault(); prepniZalozku(ZALOZKY[(i + 1) % ZALOZKY.length], true); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); prepniZalozku(ZALOZKY[(i + ZALOZKY.length - 1) % ZALOZKY.length], true); }
    });
    ['morfoX', 'morfoY', 'morfoStopa', 'morfoPriblizit'].forEach(id => $(id).addEventListener('change', () => { kresliMorfo(); ulozVolby(); }));
    $('gMorfo').addEventListener('click', e => {
      if (!morfoO) return;
      const r = $('gMorfo').getBoundingClientRect();
      const b = morfoO.nejblizsi(e.clientX - r.left, e.clientY - r.top, 16);
      if (b) vyber(b.id);
    });
    ['vyberOkno', 'vyberBezKat', 'vyberZnak'].forEach(id => $(id).addEventListener('change', kresliVyber));
    $('planCo').addEventListener('change', planHodnotaPole);
    $('btnPlan').addEventListener('click', naplanovat);
    $('expTyp').addEventListener('change', expParametrUI);
    $('expPar').addEventListener('change', () => { vychoziRozsahSweep(); expParametrUI(); });
    $('btnExp').addEventListener('click', spustitExperiment);
    $('btnExpZrus').addEventListener('click', () => { if (experiment) experiment.zrus(); });
    $('btnCsvHist').addEventListener('click', csvVyvoj);
    $('btnCsvPop').addEventListener('click', csvPopulace);
    $('btnCsvZivoty').addEventListener('click', csvZivoty);
    $('btnPngSvet').addEventListener('click', () => G.stahniPng($('svet'), souborZaklad() + '.png'));
    $('csvCesky').addEventListener('change', ulozVolby);
    $('btnNahodnySeed').addEventListener('click', () => { $('seed').value = nahodnySeed(); });
    $('btnStart').addEventListener('click', () => {
      const s = $('seed').value.trim() || nahodnySeed();
      const upr = { pocatek: prectiPocatek() };
      if ($('startParam').checked) upr.p = Object.assign({}, stav.p);
      novySvet($('scenar').value, s.slice(0, 64), upr);
      nastavBeh(true);
    });
    $('btnOdkaz').addEventListener('click', async () => {
      const url = location.href.split('#')[0] + '#exp=' + kodujExperiment();
      try { await navigator.clipboard.writeText(url); Dialog.info('Odkaz zkopírován'); }
      catch (e) { await Dialog.zeptej('Odkaz se scénářem a seedem:', url); }
    });
    $('btnKatastrofa').addEventListener('click', () => {
      const v = +$('katPodil').value;
      J.zmen(stav, 'katastrofa', v);
      if (!bezi) { provedKroky(1); obnovPanel(true); }
      Dialog.info(`Katastrofa: zahyne ${cislo(v * 100, 0)} % populace`);
      vykresliProtokol();
    });
    $('btnUlozit').addEventListener('click', ulozit);
    $('btnNacist').addEventListener('click', nacist);
    $('btnExport').addEventListener('click', exportovat);
    $('btnImport').addEventListener('click', () => $('soubor').click());
    $('soubor').addEventListener('change', () => { const f = $('soubor').files[0]; if (f) importovat(f); $('soubor').value = ''; });
    $('btnPrehrat').addEventListener('click', prehrat);

    document.addEventListener('keydown', e => {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.code === 'Space') { e.preventDefault(); nastavBeh(!bezi); }
      else if (e.code === 'ArrowRight') { e.preventDefault(); nastavBeh(false); provedKroky(1); obnovPanel(true); }
      else {
        const m = /^(Digit|Numpad)([1-6])$/.exec(e.code);
        if (m) { const sel = $('rychlost'); sel.selectedIndex = +m[2] - 1; rychlost = sel.value; akum = 0; ulozVolby(); }
      }
    });
    // změna tématu → přebarvit
    new MutationObserver(() => { nactiBarvy(); prekresliZalozku(); kresliSvet(); if (vybranyId) kresliRodokmen(); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    let casResize = 0;
    window.addEventListener('resize', () => { clearTimeout(casResize); casResize = setTimeout(() => { prekresliZalozku(); kresliSvet(); }, 120); });

    nastavBeh(true);
    requestAnimationFrame(smycka);
  }

  // pro testy v prohlížeči
  window.EvoUI = {
    get stav() { return stav; }, get expVysledek() { return expVysledek; }, get experiment() { return experiment; },
    vyber, nastavBeh, provedKroky, obnovPanel, novySvet, prepniZalozku, kodujExperiment, dekodujExperiment, prectiPocatek,
  };
  init();
})();

/* Evolventní ozubená kola – ovládání stránky nad společným zapojením gen3d/aplikace.js:
   tady jen to, co je pro kola zvláštní (2D profil s animací záběru, výsledky, kontroly jádra, výuka, exporty).
   Projekt p a jeho normalizace: evolventni_kola/stav.js (EVOL_STAV), výpočet: evolventni_kola/jadro.js (EvolKola). */
/* global EvolKola, EVOL_STAV, EVOL_NAHLED, KRAB, G3D, Dialog, TrubkyGui */
(function () {
  'use strict';
  const E = window.EvolKola, ST = window.EVOL_STAV;
  const $ = (id) => document.getElementById(id);
  const PI = Math.PI, TAU = 2 * PI;
  const KLIC = 'webapp_evolventni_kola';
  const SVGNS = 'http://www.w3.org/2000/svg';
  const f = (v, d) => E.fmt(v, d == null ? 3 : d);
  const esc = G3D.esc;
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const BARVY_3MF = ['#4F86D9', '#E0A63F'];

  /* ---------- převod starého uloženého stavu (webapp_evolventni_kola_stav, do 11/2026) ---------- */
  (function () {
    try {
      if (localStorage.getItem(KLIC + '_projekt')) return;
      const t = localStorage.getItem(KLIC + '_stav');
      if (!t) return;
      const r = ST.prevedStary(JSON.parse(t));
      localStorage.setItem(KLIC + '_projekt', JSON.stringify(r.p));
      if (Object.keys(r.zobrazeni).length) localStorage.setItem(KLIC + '_zobrazeni', JSON.stringify(Object.assign(JSON.parse(localStorage.getItem(KLIC + '_zobrazeni') || '{}'), r.zobrazeni)));
      if (r.vyuka) localStorage.setItem(KLIC + '_gui', JSON.stringify(Object.assign(JSON.parse(localStorage.getItem(KLIC + '_gui') || '{}'), { vyuka: r.vyuka })));
    } catch (e) { /* bez úložiště nebo poškozený záznam */ }
  })();

  // moduly do výběru, materiály
  (function () {
    const sel = $('vModul');
    for (const [nazev, rada] of [['Řada 1 (přednostní)', E.MODULY_RADA1], ['Řada 2', E.MODULY_RADA2]]) {
      const og = document.createElement('optgroup'); og.label = nazev;
      for (const m of rada) { const o = document.createElement('option'); o.value = String(m); o.textContent = String(m).replace('.', ','); og.appendChild(o); }
      sel.appendChild(og);
    }
    $('f_material').innerHTML = Object.entries(ST.MATERIALY).map(([k, m]) => `<option value="${k}">${m.nazev}</option>`).join('');
  })();

  /* ---------- 3D náhled ---------- */
  let nahled = null;
  try { nahled = EVOL_NAHLED.vytvor($('platno')); }
  catch (e) { $('stav3d').textContent = '3D náhled není dostupný (WebGL): ' + (e && e.message || e) + ' – 2D profil a exporty fungují dál.'; $('stav3d').classList.add('chyba'); }

  const app = G3D.aplikace({
    typ: 'evolventni_kola', nazev: 'Evolventní kola', klic: KLIC, soubor: 'evolventni_kolo',
    normalizuj: ST.normalizuj, vychozi: () => G3D.kopie(ST.VYCHOZI),
    popis: q => `m ${f(q.exp ? q.eModul : q.modul, 2)} · z ${q.z1}${q.rezim === 'dvojice' ? ' : ' + q.z2 : ''}${q.x1 || (q.rezim === 'dvojice' && q.x2) ? ' · s korekcí' : ''}`,
    viditelnost: () => viditelnost(),
    prepocitej: () => prepocet(),
    png: () => nahled && nahled.png(),
    pohled: j => { if (!nahled) return; je3d(true); nahled.pohled(j); },
    exportStl: () => exportVse('stl'),
    doModelare: () => { const d = dilyExportu(); return d ? { data: KRAB.soubor3mf(G3D.tiskoveRozlozeni(d, 1), app.p.nazev || 'Evolventní kola'), pripona: '.3mf' } : null; },
    zkratky: { h: 'tHrany', m: 'tTisk', p: 'tPrevisy', r: 'tRez', l: 'tPravitka', d: 't3d', a: 'btnAnim' },
    zmenaTematu: () => prepocet(),
  });
  let p = app.p;

  /* ---------- Výpočet ---------- */
  let V = null; // poslední výsledek {par, g1, g2, sk, nestd}
  let posledniRezim = null;
  function nestandardni(spol) {
    const d = [];
    if (p.exp) {
      if (!E.MODULY_RADA1.includes(spol.m) && !E.MODULY_RADA2.includes(spol.m)) d.push('modul mimo ČSN 01 4608');
      if (spol.alfa !== 20) d.push('α = ' + f(spol.alfa, 1) + '°');
      if (spol.haS !== 1) d.push('ha* = ' + f(spol.haS, 2));
      if (spol.cS !== 0.25) d.push('c* = ' + f(spol.cS, 2));
      if (spol.rhoS !== 0.38) d.push('ρf* = ' + f(spol.rhoS, 2));
    }
    return d;
  }
  function prepocet() {
    p = app.p;
    const par = ST.parametry(p);
    let g1, g2 = null, sk = null;
    if (p.rezim === 'dvojice') { sk = E.soukoli(par.spol, par.k1, par.k2); g1 = sk.g1; g2 = sk.g2; }
    else {
      const ds = (par.spol.jn || 0) / (2 * Math.cos(par.spol.alfa * PI / 180));
      g1 = E.kolo(Object.assign({}, par.spol, par.k1, { ds: isFinite(ds) && ds >= 0 ? ds : 0 }));
      if (!(par.spol.jn >= 0)) g1.chyby.push('Boční vůle nesmí být záporná.');
    }
    V = { par, g1, g2, sk, nestd: nestandardni(par.spol) };
    const novyRezim = posledniRezim !== p.rezim; posledniRezim = p.rezim;
    if (novyRezim) pohled = 'celek';
    vykresliVysledky(); kresli2D(true); naplanuj3D(); vyukaObnov(); souhrny();
  }

  /* ---------- Viditelnost a souhrny ---------- */
  function viditelnost() {
    p = app.p;
    const dv = p.rezim === 'dvojice';
    $('rezJedno').setAttribute('aria-pressed', String(!dv)); $('rezDvojice').setAttribute('aria-pressed', String(dv));
    $('blokKolo2').hidden = !dv; $('kartaSoukoli').hidden = !dv;
    $('exStl2').hidden = !dv; $('exStlS').hidden = !dv; $('zalKusovnik').hidden = !dv;
    $('btnAnim').textContent = anim ? '❚❚ Zastavit' : (dv ? '▶ Animace záběru' : '▶ Otáčení');
    $('nadpis1Doplnek').textContent = dv ? ' (hnací, pastorek)' : '';
    $('vModul').disabled = p.exp; $('vAlfa').disabled = p.exp; $('napovedaStd').style.opacity = p.exp ? 0.5 : 1;
    if (p.exp) $('detExp').open = true;
  }
  function souhrny() {
    const g = G3D.fmt;
    const m = p.exp ? p.eModul : p.modul, dv = p.rezim === 'dvojice';
    TrubkyGui.souhrn('sOzubeni', `m ${g(m, 3)} · z ${p.z1}${dv ? ' : ' + p.z2 : ''} · b ${g(p.b)} mm`, true);
    TrubkyGui.souhrn('sSoukoli', V.sk && V.sk.aw ? `a_w ${g(V.sk.aw, 3)} mm · i ${g(V.sk.i, 3)}` : '', !!(V.sk && V.sk.aw));
    TrubkyGui.souhrn('sVule', `j_n ${g(p.jn, 3)} · c ${g(p.ct, 3)} · otvor +${g(p.ko, 3)} mm`, p.jn || p.ct || p.ko);
    TrubkyGui.souhrn('sKvalita', `odchylka ≤ ${g(p.tol, 4)} mm`, true);
    TrubkyGui.souhrn('sTiskBox', ST.MATERIALY[p.tisk.material].nazev, true);
    TrubkyGui.souhrn('sExp', p.exp ? 'zapnuto' : 'vypnuto', p.exp);
  }

  /* ---------- Výsledky a kontroly ---------- */
  /** Pole formuláře, kterého se hlášení jádra týká (pro skok z Kontroly). */
  function polePro(text) {
    const i = /^Kolo 2:/.test(text) ? 2 : 1;
    const R = [
      [/otvor/i, 'd' + i], [/věnec/i, 'd' + i], [/Počet zubů|Počty zubů/, 'z' + i], [/Šířka/, 'b'], [/Boční vůle|vůle\)/, 'jn'],
      [/Tolerance/, 'tol'], [/tisková korekce/i, 'ct'], [/Modul|modul/, p.exp ? 'eModul' : 'modul'], [/Tlakový úhel/, p.exp ? 'eAlfa' : 'alfa'],
      [/ha\*/, 'eHa'], [/c\*/, 'eC'], [/ρf/, 'eRho'], [/Kolize|hlavová vůle|Součet korekcí/i, 'zkratit'],
      [/Podřezání|špičatý|Tenká hlava|Korekce|korekc|Interference|ε_α/, 'x' + i],
    ];
    for (const [re, c] of R) if (re.test(text)) return [c];
    return [];
  }
  function vykresliVysledky() {
    const { g1, g2, sk, nestd } = V;
    const dvoj = !!sk;
    const chyby = sk ? sk.chyby || [] : g1.chyby;
    const varov = sk ? sk.varovani || [] : g1.varovani || [];
    const stitek = $('stitekGeom');
    stitek.textContent = nestd.length ? 'experimentální: ' + nestd.join(', ') : 'standardní geometrie';
    stitek.className = 'stitek' + (nestd.length ? ' exp' : '');
    $('stitek2D').hidden = !nestd.length;
    const souhrn = $('souhrn');
    const uroven = chyby.length ? 'chyba' : varov.some((v) => v.uroven !== 'info') ? 'mez' : 'ok';
    souhrn.className = 'souhrn-v ' + uroven;
    souhrn.textContent = chyby.length ? 'Návrh má ' + chyby.length + ' ' + (chyby.length === 1 ? 'chybu' : chyby.length < 5 ? 'chyby' : 'chyb') + ' – viz Kontrola.'
      : uroven === 'mez' ? 'Geometrie je platná, ale má upozornění.' : (dvoj ? 'Soukolí je geometricky v pořádku.' : 'Kolo je geometricky v pořádku.');
    // dlaždice
    const boxy = [];
    const box = (popis, cislo, tr) => boxy.push(G3D.dlazdice(popis, cislo, '', tr === 'hl' ? 'hl' : tr === 'spatne' ? 'chyba-t' : ''));
    if (g1 && g1.d) {
      if (dvoj && sk.aw) {
        box('Osová vzdálenost a<sub>w</sub>', f(sk.aw, 4) + ' mm', 'hl');
        box('Převod i = z₂/z₁', f(sk.i, 4));
        box('Úhel záběru α<sub>w</sub>', f(sk.alfaW * 180 / PI, 4) + '°');
        box('Součinitel záběru ε<sub>α</sub>', f(sk.epsA, 3), sk.epsA < 1.1 ? 'spatne' : '');
      } else {
        box('Roztečný průměr d', f(g1.d, 3) + ' mm', 'hl');
        box('Hlavový průměr d<sub>a</sub>', f(g1.da, 3) + ' mm');
        box('Patní průměr d<sub>f</sub>', f(g1.df, 3) + ' mm');
        box('Podřezání', g1.podrez ? 'ano' : 'ne', g1.podrez ? 'spatne' : '');
      }
    }
    $('boxy').innerHTML = boxy.join('');
    // tabulka
    const kola = [g1, g2].filter((g) => g && g.d);
    const radky = [];
    const rad = (nazev, sym, fn, jed) => radky.push('<tr><td>' + nazev + '<span class="sym">' + sym + '</span></td>' + kola.map((g) => '<td>' + fn(g) + '</td>').join('') + '<td class="jed">' + (jed || '') + '</td></tr>');
    if (kola.length) {
      rad('Počet zubů', 'z', (g) => g.z);
      rad('Korekce', 'x', (g) => f(g.x, 3));
      rad('Roztečný průměr', 'd', (g) => f(g.d, 4), 'mm');
      rad('Základní průměr', 'd<sub>b</sub>', (g) => f(g.db, 4), 'mm');
      rad('Hlavový průměr', 'd<sub>a</sub>', (g) => f(g.da, 4), 'mm');
      rad('Patní průměr', 'd<sub>f</sub>', (g) => f(g.df, 4), 'mm');
      rad('Začátek evolventy', 'd<sub>Ff</sub>', (g) => f(g.dForm, 4), 'mm');
      if (dvoj && sk.aw) rad('Valivý průměr', 'd<sub>w</sub>', (g) => f(2 * (g === g1 ? sk.rw1 : sk.rw2), 4), 'mm');
      rad('Výška zubu', 'h', (g) => f(g.h, 4), 'mm');
      rad('Rozteč / základní rozteč', 'p / p<sub>b</sub>', (g) => f(g.p, 4) + ' / ' + f(g.pb, 4), 'mm');
      rad('Tloušťka zubu na d (oblouk)', 's', (g) => f(g.s, 4), 'mm');
      rad('Tětivová tloušťka / výška', 's̄ / h̄', (g) => f(g.tetivova.s, 4) + ' / ' + f(g.tetivova.h, 4), 'mm');
      rad('Tloušťka na hlavě', 's<sub>a</sub>', (g) => f(g.sa, 3), 'mm');
      rad('Rozměr přes zuby', 'W<sub>k</sub>', (g) => f(g.Wk.W, 4) + ' (k = ' + g.Wk.k + ')', 'mm');
      rad('Mez podřezání', 'z<sub>min</sub>', (g) => f(g.zMin, 2));
      rad('Nejmenší korekce bez podřezání', 'x<sub>min</sub>', (g) => f(g.xMin, 3));
      rad('Průměr otvoru v modelu', 'd<sub>o</sub>', (g) => g.rOtvor > 0 ? f(2 * g.rOtvor, 3) : '—', 'mm');
      rad('Body půlprofilu (evolventa + pata)', 'n', (g) => (g.evBody.length + g.prBody.length - 1));
      if (dvoj && sk.aw) {
        radky.push('<tr><th colspan="' + (kola.length + 2) + '" style="text-align:left;padding-top:12px">Soukolí</th></tr>');
        const r2 = (n, s, v, j) => radky.push('<tr><td>' + n + '<span class="sym">' + s + '</span></td><td colspan="' + kola.length + '">' + v + '</td><td>' + (j || '') + '</td></tr>');
        r2('Nulová osová vzdálenost', 'a', f(sk.a, 4), 'mm');
        r2('Osová vzdálenost', 'a<sub>w</sub>', f(sk.aw, 4), 'mm');
        r2('Součet korekcí', 'Σx', f(V.par.k1.x + V.par.k2.x, 4));
        r2('Součinitel změny osové vzdálenosti', 'y', f(sk.y, 4));
        r2('Součinitel zkrácení hlav' + (sk.kZkr ? ' (použit)' : ''), 'k', f(sk.kS, 4));
        r2('inv α<sub>w</sub>', '', f(sk.invAw, 6));
        r2('Úhel záběru', 'α<sub>w</sub>', f(sk.alfaW * 180 / PI, 4), '°');
        r2('Délka dráhy záběru', 'g<sub>α</sub>', f(sk.LE - sk.LA, 4), 'mm');
        r2('Součinitel záběru', 'ε<sub>α</sub>', f(sk.epsA, 4));
        r2('Hlavová vůle 1→2 / 2→1', 'c', f(sk.c12, 3) + ' / ' + f(sk.c21, 3), 'mm');
        r2('Boční vůle normálová / obvodová', 'j<sub>n</sub> / j<sub>wt</sub>', f(sk.jn, 3) + ' / ' + f(sk.jt, 3), 'mm');
        r2('Ztenčení každého zubu', 'Δs', f(sk.ds, 4), 'mm');
      }
    }
    $('tabVysl').innerHTML = kola.length ? '<thead><tr><th>Veličina</th>' + kola.map((g, i) => '<th>Kolo ' + (i + 1) + '</th>').join('') + '<th></th></tr></thead><tbody>' + radky.join('') + '</tbody>' : '';
    // kontroly → app.hlaseni
    const H = [];
    chyby.forEach((t) => H.push({ uroven: 'chyba', text: t, pole: polePro(t) }));
    varov.forEach((v) => {
      const x = { uroven: v.uroven === 'chyba' ? 'chyba' : v.uroven === 'info' ? 'info' : 'varovani', text: v.text, pole: polePro(v.text) };
      const i = /^Kolo 2:/.test(v.text) ? 2 : 1, g = i === 2 ? g2 : g1;
      if (/Podřezání/.test(v.text) && g && isFinite(g.xMin)) x.oprava = { text: 'x bez podřezání', pole: 'x' + i, hodnota: Math.max(p['x' + i] || 0, Math.ceil(g.xMin * 1000) / 1000) };
      H.push(x);
    });
    if (nestd.length) H.push({ uroven: 'varovani', text: 'Experimentální nastavení: ' + nestd.join(', ') + ' – kolo neodpovídá základnímu profilu ISO 53 a nezabírá s normalizovanými koly.', pole: ['exp'] });
    if (g1 && g1.d) {
      [g1, g2].forEach((g, i) => { if (g && g.d && !g.podrez) H.push({ uroven: 'ok', text: 'Kolo ' + (i + 1) + ' bez podřezání (z ≥ z_min nebo x ≥ x_min).' }); });
      if (dvoj && sk.aw && !sk.chyby.length) H.push({ uroven: 'ok', text: 'Bez interference a kolize, ε_α = ' + f(sk.epsA, 3) + '.' });
    }
    app.hlaseni(H, { boxy: ['boxOzubeni', 'boxVule'] });
    const n = g1 && g1.pul ? g1.evBody.length + g1.prBody.length - 1 : 0;
    $('infoKvalita').textContent = n ? 'Půlprofil kola 1 má ' + n + ' bodů (evolventa ' + g1.evBody.length + ', přechodová křivka ' + g1.prBody.length + '); obrys celkem ' + g1.obrys.length + ' vrcholů.' : '';
    $('btnXmin1').disabled = !(g1 && isFinite(g1.xMin));
    $('btnXmin2').disabled = !(g2 && isFinite(g2.xMin));
  }

  /* ---------- 2D výkres ---------- */
  const vykres = $('vykres2d');
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', '2D profil ozubení');
  vykres.appendChild(svg);
  const el = (tag, attrs, rodic) => { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (rodic) rodic.appendChild(e); return e; };
  let vb = null, pohled = 'celek', phi1 = 0, anim = false, posledniCas = 0;
  const vrstvy = Object.assign({}, ST.VRSTVY);
  const vrstvy2D = {};
  function kresli2D(novy) {
    svg.innerHTML = '';
    const { g1, g2, sk } = V;
    if (!g1 || !g1.obrys) { el('text', { x: 0, y: 0, fill: 'currentColor' }, svg).textContent = 'Geometrii nelze sestrojit – viz Kontrola.'; svg.setAttribute('viewBox', '-60 -20 300 40'); svg.style.color = 'var(--text-chyba)'; vrstvy2D.kola = null; return; }
    svg.style.color = '';
    const svet = el('g', { transform: 'scale(1,-1)' }, svg);
    const kola = [{ g: g1, x: 0, barva: 'var(--accent)' }];
    if (g2 && g2.obrys && sk && sk.aw) kola.push({ g: g2, x: sk.aw, barva: 'var(--warn)' });
    vrstvy2D.kola = [];
    for (const k of kola) {
      const st = el('g', { transform: 'translate(' + k.x + ',0)' }, svet);
      const rot = el('g', {}, st);
      let d = E.svgCesta(k.g.obrys, 1);
      if (k.g.rOtvor > 0) d += E.kruhCesta(0, 0, k.g.rOtvor, 1);
      el('path', { d, fill: k.barva, 'fill-opacity': '0.22', 'fill-rule': 'evenodd', stroke: k.barva, 'stroke-width': '1.4', 'vector-effect': 'non-scaling-stroke', 'stroke-linejoin': 'round' }, rot);
      // značka na zubu 0 (pro sledování otáčení)
      el('circle', { cx: (k.g.rf + k.g.rOtvor) / 2 || k.g.rf / 2, cy: 0, r: Math.max(k.g.m * 0.18, 0.1), fill: k.barva }, rot);
      const kr = [['ra', k.g.ra, 'var(--text-muted)', ''], ['r', k.g.r, 'var(--accent)', '6 4'], ['rb', k.g.rb, 'var(--ok)', '6 4'], ['rf', k.g.rf, 'var(--warn)', ''], ['rForm', k.g.rForm, 'var(--danger)', '2 3']];
      if (sk && sk.aw) kr.push(['rw', k.g === g1 ? sk.rw1 : sk.rw2, 'var(--text)', '10 4 2 4']);
      for (const [id, R, barva, dash] of kr) {
        if (!vrstvy[id]) continue;
        el('circle', { cx: 0, cy: 0, r: R, fill: 'none', stroke: barva, 'stroke-width': '1', 'stroke-dasharray': dash, 'vector-effect': 'non-scaling-stroke', opacity: '0.85' }, st);
      }
      el('circle', { cx: 0, cy: 0, r: Math.max(k.g.m * 0.15, 0.1), fill: 'var(--text-muted)' }, st);
      vrstvy2D.kola.push(rot);
    }
    vrstvy2D.dotyky = null;
    if (sk && sk.aw && sk.g1.obrys && sk.g2.obrys) {
      if (vrstvy.rw) {
        const a = sk.alfaW, T1 = [sk.g1.rb * Math.cos(a), -sk.g1.rb * Math.sin(a)], T2 = [sk.aw - sk.g2.rb * Math.cos(a), sk.g2.rb * Math.sin(a)];
        el('line', { x1: T1[0], y1: T1[1], x2: T2[0], y2: T2[1], stroke: 'var(--text)', 'stroke-width': '1', 'stroke-dasharray': '4 3', 'vector-effect': 'non-scaling-stroke', opacity: '0.7' }, svet);
        const d = [Math.sin(a), Math.cos(a)];
        el('line', { x1: T1[0] + sk.LA * d[0], y1: T1[1] + sk.LA * d[1], x2: T1[0] + sk.LE * d[0], y2: T1[1] + sk.LE * d[1], stroke: 'var(--danger)', 'stroke-width': '3', 'vector-effect': 'non-scaling-stroke', opacity: '0.8' }, svet);
      }
      vrstvy2D.dotyky = el('g', {}, svet);
    }
    if (novy || !vb) nastavPohled(pohled);
    else aplikujVB();
    otoc2D();
  }
  function nastavPohled(typ) {
    pohled = typ;
    $('pohCelek').setAttribute('aria-pressed', typ === 'celek'); $('pohDetail').setAttribute('aria-pressed', typ === 'detail');
    const { g1, g2, sk } = V; if (!g1 || !g1.obrys) return;
    const pomer = (svg.clientHeight || 400) / (svg.clientWidth || 600);
    let cx, cy, w;
    if (typ === 'celek') {
      if (sk && sk.aw && g2 && g2.obrys) { const L = -g1.ra, P = sk.aw + g2.ra; cx = (L + P) / 2; cy = 0; w = Math.max(P - L, 2 * Math.max(g1.ra, g2.ra) / pomer) * 1.06; }
      else { cx = 0; cy = 0; w = 2 * g1.ra * Math.max(1, 1 / pomer) * 1.08; }
    } else {
      if (sk && sk.aw && g2 && g2.obrys) { cx = sk.rw1; cy = 0; w = 7 * g1.m / Math.min(1, pomer); }
      else { cx = (g1.ra + g1.rf) / 2; cy = 0; w = 4.2 * g1.p / Math.min(1, pomer) * 0.6; }
    }
    vb = { x: cx - w / 2, y: -cy - w * pomer / 2, w, h: w * pomer };
    aplikujVB();
  }
  function aplikujVB() { svg.setAttribute('viewBox', vb.x + ' ' + vb.y + ' ' + vb.w + ' ' + vb.h); }
  function otoc2D() {
    if (!V || !vrstvy2D.kola) return;
    const { sk } = V;
    const u1 = phi1 * 180 / PI;
    if (vrstvy2D.kola[0]) vrstvy2D.kola[0].setAttribute('transform', 'rotate(' + u1 + ')');
    if (vrstvy2D.kola[1]) vrstvy2D.kola[1].setAttribute('transform', 'rotate(' + E.natoceni2(sk, phi1, p.dosed) * 180 / PI + ')');
    if (vrstvy2D.dotyky) {
      const g = vrstvy2D.dotyky; g.innerHTML = '';
      const rPx = vb ? 4.5 * vb.w / (svg.clientWidth || 600) : 0.3;
      for (const d of E.dotyky(sk, phi1)) el('circle', { cx: d.x, cy: d.y, r: rPx, fill: 'var(--danger)', stroke: 'var(--bg-input)', 'stroke-width': '1', 'vector-effect': 'non-scaling-stroke' }, g);
    }
    if (nahled && V3) {
      const uhly = [phi1]; if (V3.dvoj) uhly.push(E.natoceni2(sk, phi1, p.dosed));
      nahled.natoc(uhly);
    }
  }
  function krok(t) {
    if (!anim) return;
    const dt = posledniCas ? Math.min(0.1, (t - posledniCas) / 1000) : 0; posledniCas = t;
    const z1 = V && V.g1 ? V.g1.z || 20 : 20;
    phi1 = (phi1 + dt * (TAU / z1) / 1.6) % TAU;
    otoc2D();
    requestAnimationFrame(krok);
  }
  $('btnAnim').addEventListener('click', () => {
    anim = !anim; $('btnAnim').setAttribute('aria-pressed', anim);
    viditelnost();
    posledniCas = 0; if (anim) requestAnimationFrame(krok);
  });
  $('pohCelek').addEventListener('click', () => nastavPohled('celek'));
  $('pohDetail').addEventListener('click', () => nastavPohled('detail'));
  // posun a zoom
  const ukaz = new Map(); let pinch = 0;
  function svgBod(cx, cy) { const r = svg.getBoundingClientRect(); return [vb.x + (cx - r.left) / r.width * vb.w, vb.y + (cy - r.top) / r.height * vb.h]; }
  function zoom(faktor, cx, cy) {
    const [px, py] = svgBod(cx, cy);
    vb.x = px - (px - vb.x) * faktor; vb.y = py - (py - vb.y) * faktor; vb.w *= faktor; vb.h *= faktor; aplikujVB(); otoc2D();
  }
  svg.addEventListener('wheel', (e) => { if (!vb) return; e.preventDefault(); zoom(Math.exp(e.deltaY * 0.0015), e.clientX, e.clientY); }, { passive: false });
  svg.addEventListener('pointerdown', (e) => { svg.setPointerCapture(e.pointerId); ukaz.set(e.pointerId, { x: e.clientX, y: e.clientY }); });
  svg.addEventListener('pointermove', (e) => {
    const q = ukaz.get(e.pointerId); if (!q || !vb) return;
    if (ukaz.size === 2) {
      const [a, b] = [...ukaz.values()]; q.x = e.clientX; q.y = e.clientY;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch) zoom(pinch / d, (a.x + b.x) / 2, (a.y + b.y) / 2);
      pinch = d; return;
    }
    const r = svg.getBoundingClientRect();
    vb.x -= (e.clientX - q.x) / r.width * vb.w; vb.y -= (e.clientY - q.y) / r.height * vb.h;
    q.x = e.clientX; q.y = e.clientY; aplikujVB();
  });
  const konecU = (e) => { ukaz.delete(e.pointerId); if (ukaz.size < 2) pinch = 0; };
  svg.addEventListener('pointerup', konecU); svg.addEventListener('pointercancel', konecU);
  let sirka2D = 0;
  new ResizeObserver(() => { const w = vykres.clientWidth; if (V && vb && w && Math.abs(w - sirka2D) > 2) { sirka2D = w; nastavPohled(pohled); otoc2D(); } }).observe(vykres);

  /* ---------- 3D (náhled sítí s odchylkou ≤ max(kvalita, m·0,004)) ---------- */
  let V3 = null, cas3d = 0, dily3d = [], tiskDily = null;
  const stavZobr = { tisk: false };
  function naplanuj3D() { clearTimeout(cas3d); cas3d = setTimeout(obnov3D, 180); }
  function tol3D(g) { return Math.max(V.par.spol.tol, g.m * 0.004); }
  const lzeSit = g => g && g.obrys && g.ok !== false && !g.chyby.some((t) => /Otvor zasahuje/.test(t));
  /** Díl pro gen3d z indexované sítě jádra. */
  function dil(sit, nazev, jmeno, barva, x) {
    const k = E.kontrolaSite(sit);
    return { nazev, jmeno, poz: Float32Array.from(sit.pozice), idx: sit.trojuhelniky, objem: k.objem, barva, x: x || 0, kontrola: k };
  }
  function obnov3D() {
    const { g1, g2, sk } = V;
    let info = '';
    dily3d = [];
    try {
      if (lzeSit(g1)) dily3d.push(dil(E.sitKola(g1, tol3D(g1)), 'Kolo 1', 'kolo1', BARVY_3MF[0], 0));
      if (sk && sk.aw && g2 && g2.obrys && dily3d.length && !g2.chyby.some((t) => /Otvor zasahuje/.test(t))) dily3d.push(dil(E.sitKola(g2, tol3D(g2)), 'Kolo 2', 'kolo2', BARVY_3MF[1], sk.aw));
      info = dily3d.length ? (dily3d.reduce((s, d) => s + d.idx.length / 3, 0)).toLocaleString('cs-CZ') + ' trojúhelníků' : '';
    } catch (e) { info = 'Síť se nepodařilo sestavit: ' + e.message; dily3d = []; }
    V3 = { dvoj: dily3d.length === 2 };
    tiskDily = dily3d.length ? G3D.tiskoveRozlozeni(dily3d.map(d => Object.assign({}, d, { x: 0 })), 1) : null;
    zobraz3D(false);
    $('info3d').textContent = dily3d.length ? info + ' (náhled s odchylkou ≤ ' + f(tol3D(g1), 3) + ' mm)' : 'Model nelze sestavit – viz Kontrola.';
    vypisTisk();
    otoc2D();
  }
  function zobraz3D(novyPohled) {
    if (!nahled) return;
    nahled.barvy(css('--border-strong'), css('--border'), css('--text'));
    if (!dily3d.length) { nahled.nastav(null); return; }
    nahled.nastav(stavZobr.tisk ? tiskDily : dily3d, { tisk: stavZobr.tisk, uhel: p.tisk.uhel, novyPohled });
  }
  $('btn3dReset').addEventListener('click', () => nahled && nahled.pohled('iso'));
  // 2D ↔ 3D
  function je3d(h) { const b = $('t3d'); if ((b.getAttribute('aria-pressed') === 'true') !== h) b.click(); }
  app.prepinac('t3d', h => {
    $('vykres2d').hidden = h; $('canvas-container').classList.toggle('je3d', h);
    $('btn2d').setAttribute('aria-pressed', String(!h)); $('btn3d').setAttribute('aria-pressed', String(h));
    document.querySelectorAll('.jen2d').forEach(x => { x.hidden = h; });
    document.querySelectorAll('.jen3d').forEach(x => { x.hidden = !h; });
    $('tip2d').textContent = h ? 'tažení = otáčení · pravé tl. = posun · kolečko = zoom' : 'tažení = posun · kolečko / dva prsty = zoom';
    $('legPrevisy').hidden = !(h && stavZobr.tisk && nahled && nahled.stav.previsy);
    $('legRez').hidden = !(h && nahled && nahled.stav.rez);
    if (h && nahled) nahled.prekresli();
  }, true);
  $('btn2d').addEventListener('click', () => je3d(false));
  $('btn3d').addEventListener('click', () => je3d(true));
  $('btnUkaz2d').addEventListener('click', () => je3d(false));
  if (nahled) {
    app.prepinac('tRez', h => { nahled.prepni('rez', h); $('legRez').hidden = !h; if (h) je3d(true); });
    app.prepinac('tHrany', h => nahled.prepni('hrany', h));
    app.prepinac('tPrevisy', h => { nahled.prepni('previsy', h); $('legPrevisy').hidden = !(h && stavZobr.tisk); }, true);
    app.prepinac('tPravitka', h => nahled.prepni('pravitka', h), true);
    app.prepinac('tTisk', h => {
      stavZobr.tisk = h;
      if (h) je3d(true);
      $('legPrevisy').hidden = !(h && nahled.stav.previsy);
      if (dily3d.length) zobraz3D(true);
      if (!h) otoc2D();
    });
  }
  // kružnice 2D profilu (pamatují se v <klic>_zobrazeni)
  for (const k of Object.keys(ST.VRSTVY)) app.prepinac('tV_' + k, h => { vrstvy[k] = h; if (V) kresli2D(false); }, true);

  /* ---------- Výsledky tisku a kusovník ---------- */
  function vypisTisk() {
    const box = G3D.dlazdice, mat = ST.MATERIALY[p.tisk.material];
    if (!dily3d.length) { $('vTisk').innerHTML = box('Model', 'nelze sestavit', 'viz Kontrola'); $('vSit').innerHTML = ''; $('tabKusovnik').innerHTML = ''; return; }
    const objem = dily3d.reduce((s, d) => s + d.objem, 0);
    const o = G3D.odhadTisku(objem, mat.hustota, { dilu: dily3d.length });
    const b = G3D.obal(dily3d[0].poz);
    let h = box('Rozměry kola 1', `Ø ${f(b[3] - b[0], 2)} × ${f(b[5] - b[2], 2)} mm`, dily3d.length > 1 ? `kolo 2 Ø ${f(2 * V.g2.ra, 2)} mm` : 'průměr hlavy × šířka');
    h += box('Objem', `${f(objem / 1000, 2)} cm³`, dily3d.length > 1 ? `${dily3d.length} kola` : 'plný díl');
    h += box('Hmotnost', `${f(o.g, o.g < 10 ? 1 : 0)} g`, `${mat.nazev}, plný díl (při 30 % výplni zhruba ${f(o.g * 0.55, 0)} g)`);
    h += box('Filament', `${f(o.metru, 2)} m`, 'průměr 1,75 mm, plný díl');
    h += box('Doba tisku', `≈ ${o.minut < 60 ? o.minut + ' min' : f(o.minut / 60, 1) + ' h'}`, 'hrubý odhad, vrstva 0,2 mm');
    h += box('Tisková poloha', 'čelem na podložce', 'zuby svislé, bez podpor');
    $('vTisk').innerHTML = h;
    $('vSit').innerHTML = dily3d.map(d => box('Síť náhledu – ' + d.nazev, d.kontrola.vadneHrany ? '✖ netěsná' : '✔ těsná', `${d.kontrola.trojuhelniku.toLocaleString('cs-CZ')} trojúhelníků, objem ${f(d.objem / 1000, 3)} cm³`, d.kontrola.vadneHrany || !(d.objem > 0) ? 'chyba-t' : 'ok-t')).join('');
    const kola = [V.g1, V.g2].filter((g, i) => g && dily3d[i]);
    $('tabKusovnik').innerHTML = '<thead><tr><th>Poz.</th><th>Díl</th><th>Ks</th><th>m</th><th>z</th><th>x</th><th>d<sub>a</sub></th><th>b</th><th>Otvor</th><th>Materiál</th><th>Hmotnost</th></tr></thead><tbody>'
      + kola.map((g, i) => `<tr><td>${i + 1}</td><td>Kolo ${i + 1}${V.sk ? (i ? ' (hnané)' : ' (hnací)') : ''}</td><td>1</td><td>${f(g.m, 3)}</td><td>${g.z}</td><td>${f(g.x, 3)}</td><td>${f(g.da, 3)}</td><td>${f(g.b, 2)}</td><td>${g.rOtvor > 0 ? 'Ø ' + f(2 * g.rOtvor, 2) : '—'}</td><td>${mat.nazev}</td><td>${f(dily3d[i].objem / 1000 * mat.hustota, 1)} g</td></tr>`).join('')
      + '</tbody>';
  }

  /* ---------- Exporty ---------- */
  function jmeno(pripona, ktere) {
    if (p.nazev) return app.jmeno((ktere === 1 || ktere === 2 ? '_kolo' + ktere : '') + '.' + pripona);
    const { g1, g2, sk } = V; const m = String(g1.m).replace('.', '_');
    if (sk && ktere !== 1 && ktere !== 2) return 'soukoli_m' + m + '_z' + g1.z + '-' + g2.z + '.' + pripona;
    const g = ktere === 2 ? g2 : g1;
    return 'kolo_m' + m + '_z' + g.z + (g.x ? '_x' + String(g.x).replace('.', '_').replace('-', 'm') : '') + '.' + pripona;
  }
  function dily2D() {
    const { g1, g2, sk } = V;
    const d = [{ g: g1, x: 0, y: 0, uhel: 0 }];
    if (sk && sk.aw && g2 && g2.obrys) d.push({ g: g2, x: sk.aw, y: 0, uhel: E.natoceni2(sk, 0, p.dosed) });
    return d;
  }
  function lzeExportovat() {
    const chyby = V.sk ? V.sk.chyby : V.g1.chyby;
    if (!V.g1 || !V.g1.obrys || (V.sk && !(V.g2 && V.g2.obrys))) { Dialog.chyba('Geometrii nelze sestrojit – opravte chyby v Kontrole.'); return false; }
    if (chyby.length) Dialog.info('Pozor: návrh obsahuje chyby (viz Kontrola), export přesto proběhl.');
    return true;
  }
  $('exSvg').addEventListener('click', () => { if (lzeExportovat()) app.stahni(E.exportSVG(dily2D(), { pomocne: p.pomocne }), jmeno('svg'), 'image/svg+xml'); });
  $('exDxf').addEventListener('click', () => { if (lzeExportovat()) app.stahni(E.exportDXF(dily2D(), { pomocne: p.pomocne }), jmeno('dxf'), 'application/dxf'); });
  function kontrolaSiti(site) {
    for (const s of site) {
      const k = E.kontrolaSite(s);
      if (k.vadneHrany || !(k.objem > 0)) { Dialog.chyba('Kontrola sítě selhala (' + k.vadneHrany + ' vadných hran) – soubor se neuložil.'); return false; }
    }
    return true;
  }
  function infoExport(site, co) {
    const n = site.reduce((a, s) => a + s.trojuhelniky.length / 3, 0);
    $('infoExport').textContent = co + ': ' + n.toLocaleString('cs-CZ') + ' trojúhelníků, síť uzavřená (každá hrana sdílená právě dvěma trojúhelníky), objem ' +
      f(site.reduce((a, s) => a + E.kontrolaSite(s).objem, 0) / 1000, 3) + ' cm³.';
  }
  // jednotlivá kola a sestava v záběru (jako dřív – STL přímo z jádra)
  function exportSTL(ktere) {
    if (!lzeExportovat()) return;
    const { g1, g2, sk } = V;
    const site = [];
    if (ktere === 1 || ktere === 's') site.push(E.sitKola(g1));
    if (ktere === 2) site.push(E.sitKola(g2));
    if (ktere === 's') site.push(E.sitKola(g2, null, { x: sk.aw, uhel: E.natoceni2(sk, 0, p.dosed) }));
    if (!kontrolaSiti(site)) return;
    app.stahni(new Blob([E.stlBinarni(site, 'evolventni kolo - github_site')], { type: 'model/stl' }), jmeno('stl', ktere), 'model/stl');
    infoExport(site, 'STL');
  }
  $('exStl1').addEventListener('click', () => exportSTL(1));
  $('exStl2').addEventListener('click', () => exportSTL(2));
  $('exStlS').addEventListener('click', () => exportSTL('s'));
  /** Všechna kola v plné kvalitě jako díly gen3d (null = nejde). */
  function dilyExportu() {
    if (!lzeExportovat()) return null;
    const kola = [V.g1]; if (V.sk) kola.push(V.g2);
    const site = kola.map(g => E.sitKola(g));
    if (!kontrolaSiti(site)) return null;
    infoExport(site, 'Export');
    return site.map((s, i) => dil(s, 'Kolo ' + (i + 1), 'kolo' + (i + 1), BARVY_3MF[i]));
  }
  function exportVse(druh) {
    const d = dilyExportu(); if (!d) return;
    const kusy = G3D.tiskoveRozlozeni(d, 1);
    if (druh === 'stl') app.stahni(KRAB.stlBinarni(kusy, 'evolventni kola - github_site'), jmeno('stl'), 'model/stl');
    else app.stahni(KRAB.soubor3mf(kusy, p.nazev || 'Evolventní kola'), jmeno('3mf'), 'model/3mf');
  }
  $('btnStl').addEventListener('click', () => exportVse('stl'));
  $('btn3mf').addEventListener('click', () => exportVse('3mf'));
  $('exJson').addEventListener('click', () => {
    const { par, sk, g1, g2 } = V;
    const out = { generator: 'Evolventní ozubená kola (github_site)', datum: new Date().toISOString().slice(0, 10), rezim: p.rezim, experimentalni: p.exp, parametry: par };
    const vyber = (g) => g && g.d ? { z: g.z, x: g.x, d: g.d, db: g.db, da: g.da, df: g.df, dFf: g.dForm, s: g.s, sa: g.sa, Wk: g.Wk, podrezani: g.podrez } : null;
    out.kolo1 = vyber(g1); if (g2) out.kolo2 = vyber(g2);
    if (sk && sk.aw) out.soukoli = { a: sk.a, aw: sk.aw, alfaW_deg: sk.alfaW * 180 / PI, i: sk.i, epsAlfa: sk.epsA, y: sk.y, k: sk.kS, c12: sk.c12, c21: sk.c21, jn: sk.jn };
    app.stahni(JSON.stringify(out, null, 2), jmeno('json').replace(/\.json$/, '_vysledky.json'), 'application/json');
  });

  /* ---------- Výukový režim ---------- */
  const tabs = ['Ev', 'Vyr', 'Zab'];
  let vyukaTab = 'Ev';
  try { const g = JSON.parse(localStorage.getItem(KLIC + '_gui') || '{}'); if (tabs.includes(g.vyuka)) vyukaTab = g.vyuka; } catch (e) { /* bez úložiště */ }
  function prepniTab(t) {
    vyukaTab = t;
    try { localStorage.setItem(KLIC + '_gui', JSON.stringify(Object.assign(JSON.parse(localStorage.getItem(KLIC + '_gui') || '{}'), { vyuka: t }))); } catch (e) { /* bez úložiště */ }
    for (const x of tabs) { $('tab' + x).setAttribute('aria-selected', x === t); $('pan' + x).hidden = x !== t; }
    vyukaObnov();
  }
  tabs.forEach((t) => $('tab' + t).addEventListener('click', () => prepniTab(t)));
  function vyukaObnov() {
    if (!V) return;
    if (vyukaTab === 'Ev') kresliEvolventu();
    else if (vyukaTab === 'Vyr') kresliVyrobu();
    else textZaber();
  }
  function kresliEvolventu() {
    const s = $('svgEv'); s.innerHTML = '';
    const u = +$('slEv').value, rb = 100, Y = (y) => -y;
    s.setAttribute('viewBox', '-150 -200 420 300');
    el('circle', { cx: 0, cy: 0, r: rb, fill: 'none', stroke: 'var(--ok)', 'stroke-width': 1.5 }, s);
    el('circle', { cx: 0, cy: 0, r: 2.5, fill: 'var(--text-muted)' }, s);
    // celá evolventa (slabě) a odvinutá část
    const ev = (t) => [rb * (Math.cos(t) + t * Math.sin(t)), rb * (Math.sin(t) - t * Math.cos(t))];
    const cesta = (do_) => { let d = ''; for (let i = 0; i <= 120; i++) { const t = do_ * i / 120, q = ev(t); d += (i ? 'L' : 'M') + q[0].toFixed(2) + ' ' + Y(q[1]).toFixed(2); } return d; };
    el('path', { d: cesta(1.4), fill: 'none', stroke: 'var(--text-faint)', 'stroke-width': 1, 'stroke-dasharray': '4 3' }, s);
    el('path', { d: cesta(u), fill: 'none', stroke: 'var(--accent)', 'stroke-width': 3 }, s);
    const P = ev(u), T = [rb * Math.cos(u), rb * Math.sin(u)];
    // odvinuté vlákno na kružnici (oblouk 0..u) a vlákno TP
    el('path', { d: 'M' + rb + ' 0 A' + rb + ' ' + rb + ' 0 0 0 ' + T[0] + ' ' + Y(T[1]), fill: 'none', stroke: 'var(--warn)', 'stroke-width': 3 }, s);
    el('line', { x1: T[0], y1: Y(T[1]), x2: P[0], y2: Y(P[1]), stroke: 'var(--warn)', 'stroke-width': 2 }, s);
    el('line', { x1: 0, y1: 0, x2: T[0], y2: Y(T[1]), stroke: 'var(--text-muted)', 'stroke-width': 1 }, s);
    el('line', { x1: 0, y1: 0, x2: P[0], y2: Y(P[1]), stroke: 'var(--text-muted)', 'stroke-width': 1, 'stroke-dasharray': '3 3' }, s);
    for (const [q, t, dx, dy] of [[P, 'P', 8, -6], [T, 'T', -16, -6], [[0, 0], 'O', -16, 16]]) {
      el('circle', { cx: q[0], cy: Y(q[1]), r: 4, fill: 'var(--text)' }, s);
      const tx = el('text', { x: q[0] + dx, y: Y(q[1]) + dy, fill: 'var(--text)', 'font-size': 15, 'font-weight': 600 }, s); tx.textContent = t;
    }
    const ay = Math.atan(u), R = rb * Math.sqrt(1 + u * u), invy = Math.tan(ay) - ay;
    // úhel inv α_y (od počátku evolventy k bodu P) jako oblouk
    const rr = 34, aP = Math.atan2(P[1], P[0]);
    if (aP > 0.01) el('path', { d: 'M' + rr + ' 0 A' + rr + ' ' + rr + ' 0 0 0 ' + (rr * Math.cos(aP)).toFixed(2) + ' ' + Y(rr * Math.sin(aP)).toFixed(2), fill: 'none', stroke: 'var(--accent)', 'stroke-width': 2 }, s);
    const tt = el('text', { x: rr + 6, y: -4, fill: 'var(--accent)', 'font-size': 13 }, s); tt.textContent = 'θ = inv αᵧ';
    const leg = el('text', { x: -140, y: 85, fill: 'var(--text-muted)', 'font-size': 12 }, s);
    leg.textContent = 'zelená: základní kružnice r_b · oranžová: odvinuté vlákno (|TP| = oblouk) · modrá: evolventa';
    $('hodEv').innerHTML = 'u = ' + f(u, 3) + ' rad · α<sub>y</sub> = arctg u = ' + f(ay * 180 / PI, 2) + '° · r/r<sub>b</sub> = 1/cos α<sub>y</sub> = ' + f(R / rb, 4) +
      ' · |TP| = r<sub>b</sub>·u = ' + f(u, 3) + '·r<sub>b</sub> · inv α<sub>y</sub> = tg α<sub>y</sub> − α<sub>y</sub> = ' + f(invy, 5) + ' rad (' + f(invy * 180 / PI, 3) + '°)';
  }
  let animEv = 0, animVyr = 0;
  $('slEv').addEventListener('input', kresliEvolventu);
  $('btnEvAnim').addEventListener('click', () => {
    if (animEv) { cancelAnimationFrame(animEv); animEv = 0; $('btnEvAnim').textContent = '▶'; return; }
    $('btnEvAnim').textContent = '❚❚';
    const sl = $('slEv'); let t0 = 0;
    const k = (t) => { if (!t0) t0 = t; sl.value = (((t - t0) / 4000) % 1) * 1.4; kresliEvolventu(); animEv = requestAnimationFrame(k); };
    animEv = requestAnimationFrame(k);
  });
  function kresliVyrobu() {
    const s = $('svgVyr'); s.innerHTML = '';
    const g = V && V.g1;
    if (!g || !g.obrys) { const t = el('text', { x: 10, y: 30, fill: 'var(--text-chyba)' }, s); t.textContent = 'Kolo 1 nelze sestrojit.'; s.setAttribute('viewBox', '0 0 300 60'); return; }
    const m = g.m, z = g.z;
    const sv = el('g', { transform: 'scale(1,-1)' }, s);
    const sc = [g.r * Math.cos(PI / z), g.r * Math.sin(PI / z)]; // střed mezery na roztečné kružnici
    const w = 7.5 * m, rect = s.getBoundingClientRect(), pomer = rect.width ? Math.min(1.2, rect.height / rect.width) : 0.75, h = w * pomer;
    s.setAttribute('viewBox', (sc[0] - w / 2) + ' ' + (-sc[1] - h / 2) + ' ' + w + ' ' + h);
    const rozsah = 5 * m / g.r, phi = +$('slVyr').value * rozsah;
    el('path', { d: E.svgCesta(g.obrys, 1), fill: 'var(--accent)', 'fill-opacity': '0.18', stroke: 'var(--accent)', 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' }, sv);
    for (const [R, barva, dash] of [[g.r, 'var(--accent)', '6 4'], [g.rb, 'var(--ok)', '6 4'], [g.rf, 'var(--warn)', '']]) el('circle', { cx: 0, cy: 0, r: R, fill: 'none', stroke: barva, 'stroke-dasharray': dash, 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' }, sv);
    const cesta = (P) => 'M' + P.map((q) => q[0].toFixed(5) + ' ' + q[1].toFixed(5)).join('L');
    if ($('vStopa').checked) {
      const stopy = el('g', { opacity: '0.35' }, sv);
      for (let i = -24; i <= 24; i++) el('path', { d: cesta(E.nastrojObrys(g, rozsah * i / 24, 0, m * 0.01)), fill: 'none', stroke: 'var(--text-faint)', 'stroke-width': 0.7, 'vector-effect': 'non-scaling-stroke' }, stopy);
      // trochoida středu zaoblení (oba rohy nástrojového zubu)
      for (const zn of [1, -1]) {
        const P = [];
        for (let i = 0; i <= 200; i++) {
          const ph = -rozsah + 2 * rozsah * i / 200, N = g.nastroj;
          const wx = zn * N.uc - g.r * ph, wy = g.r + g.x * m + N.vc;
          const q = E.rot(wx, wy, -ph); P.push(E.rot(q[0], q[1], PI / z - PI / 2));
        }
        el('path', { d: cesta(P), fill: 'none', stroke: 'var(--danger)', 'stroke-width': 1.2, 'stroke-dasharray': '3 2', 'vector-effect': 'non-scaling-stroke' }, sv);
      }
    }
    // zvýraznění boků mezery: evolventa a přechodová křivka
    const bok = (P, zrcadlo) => P.map((q) => zrcadlo ? E.rot(q[0], -q[1], TAU / z) : q);
    for (const zr of [false, true]) {
      el('path', { d: cesta(bok(g.evBody, zr)), fill: 'none', stroke: 'var(--accent)', 'stroke-width': 3, 'vector-effect': 'non-scaling-stroke' }, sv);
      el('path', { d: cesta(bok(g.prBody, zr)), fill: 'none', stroke: 'var(--danger)', 'stroke-width': 3, 'vector-effect': 'non-scaling-stroke' }, sv);
    }
    const nas = E.nastrojObrys(g, phi, 2, m * 0.005);
    el('path', { d: cesta(nas), fill: 'var(--warn)', 'fill-opacity': '0.35', stroke: 'var(--warn)', 'stroke-width': 1.5, 'vector-effect': 'non-scaling-stroke' }, sv);
  }
  $('slVyr').addEventListener('input', kresliVyrobu);
  $('vStopa').addEventListener('change', kresliVyrobu);
  $('btnVyrAnim').addEventListener('click', () => {
    if (animVyr) { cancelAnimationFrame(animVyr); animVyr = 0; $('btnVyrAnim').textContent = '▶'; return; }
    $('btnVyrAnim').textContent = '❚❚';
    const sl = $('slVyr'); let t0 = 0;
    const k = (t) => { if (!t0) t0 = t; const fz = ((t - t0) / 6000) % 2; sl.value = fz < 1 ? -1 + 2 * fz : 3 - 2 * fz; kresliVyrobu(); animVyr = requestAnimationFrame(k); };
    animVyr = requestAnimationFrame(k);
  });
  function textZaber() {
    const { sk } = V;
    let h = '<p><b>Přímka záběru</b> je společná tečna obou základních kružnic. Svírá s tečnou valivých kružnic úhel záběru α<sub>w</sub>; dotyk boků se po ní posouvá od bodu A (hlava hnaného kola vstupuje do záběru) do bodu E (hlava hnacího kola vystupuje). Ve 2D náhledu je aktivní úsek AE červeně a body dotyku jako červené tečky.</p>';
    h += '<p><b>Součinitel záběru</b> ε<sub>α</sub> = |AE| / p<sub>b</sub> udává průměrný počet párů zubů v záběru. Musí být > 1, prakticky ≥ 1,2.</p>';
    h += '<p><b>Korekce</b> x₁, x₂ posunou profily. Pokud Σx ≠ 0, změní se úhel záběru: <span class="vzorec">inv α<sub>w</sub> = inv α + 2·Σx·tg α/(z₁+z₂)</span> a osová vzdálenost <span class="vzorec">a<sub>w</sub> = a·cos α / cos α<sub>w</sub></span>. Rovnice pro α<sub>w</sub> nemá řešení v uzavřeném tvaru, generátor ji řeší Newtonovou metodou.</p>';
    if (sk && sk.aw) {
      h += '<p><b>Aktuální soukolí:</b> a = m(z₁+z₂)/2 = ' + f(sk.a, 3) + ' mm; inv α<sub>w</sub> = ' + f(E.inv(sk.alfa), 6) + ' + 2·' + f(V.par.k1.x + V.par.k2.x, 3) + '·tg ' + f(sk.alfa * 180 / PI, 1) + '°/' + (sk.g1.z + sk.g2.z) + ' = ' + f(sk.invAw, 6) +
        ' → α<sub>w</sub> = ' + f(sk.alfaW * 180 / PI, 4) + '°, a<sub>w</sub> = ' + f(sk.aw, 4) + ' mm. Dráha záběru |AE| = ' + f(sk.LE - sk.LA, 3) + ' mm, p<sub>b</sub> = ' + f(sk.pb, 3) + ' mm → ε<sub>α</sub> = ' + f(sk.epsA, 3) + '.</p>';
    } else h += '<p>Přepněte vlevo režim <b>Dvojice kol</b> – zde se pak zobrazí výpočet pro vaše soukolí.</p>';
    h += '<p><b>Vůle:</b> evolventní soukolí bez vůle by se při tepelné roztažnosti nebo nepřesnosti zadřelo. Ztenčení zubů o Δs dá normálovou boční vůli j<sub>n</sub> = (Δs₁+Δs₂)·cos α. Při tisku navíc kompenzujte roztékání materiálu tiskovou korekcí.</p>';
    $('textZab').innerHTML = h;
  }

  /* ---------- Režim, korekce, předvolby ---------- */
  $('rezJedno').addEventListener('click', () => app.zmen(q => { q.rezim = 'jedno'; }));
  $('rezDvojice').addEventListener('click', () => app.zmen(q => { q.rezim = 'dvojice'; }));
  function nastavX(i) {
    const g = i === 1 ? V.g1 : V.g2; if (!g || !isFinite(g.xMin)) return;
    const x = Math.max(p['x' + i] || 0, Math.ceil(g.xMin * 1000) / 1000);
    app.zmen(q => { q['x' + i] = x; }); app.naplnFormular();
  }
  $('btnXmin1').addEventListener('click', () => nastavX(1));
  $('btnXmin2').addEventListener('click', () => nastavX(2));
  $('btnAw').addEventListener('click', () => {
    const aw = G3D.ctiCislo($('vAwZad').value), sp = V.par.spol, z1 = p.z1, z2 = p.z2;
    const nav = isFinite(aw) ? E.korekceProOsovou(sp.m, sp.alfa, z1, z2, aw) : null;
    if (!nav) { $('awInfo').textContent = 'Zadejte kladnou osovou vzdálenost blízkou a = m(z₁+z₂)/2 = ' + f(sp.m * (z1 + z2) / 2, 3) + ' mm.'; return; }
    const s2 = Math.sin(sp.alfa * PI / 180) ** 2;
    const xmin1 = sp.haS - z1 * s2 / 2;
    // pastorek dostane alespoň x_min, zbytek se rozdělí podle poměru zubů (víc pastorku)
    let x1 = nav.sumaX * z2 / (z1 + z2);
    if (x1 < xmin1) x1 = xmin1;
    const x2 = nav.sumaX - x1;
    app.zmen(q => { q.x1 = +x1.toFixed(4); q.x2 = +x2.toFixed(4); }); app.naplnFormular();
    $('awInfo').textContent = 'Σx = ' + f(nav.sumaX, 4) + ', α_w = ' + f(nav.alfaW * 180 / PI, 3) + '° → x₁ = ' + f(x1, 4) + ', x₂ = ' + f(x2, 4) + '.';
  });
  for (const v of ST.PREDVOLBY) {
    const b = document.createElement('button'); b.className = 'pol'; b.setAttribute('role', 'menuitem');
    b.innerHTML = `${esc(v.nazev)}<span class="pozn">${esc(v.popis)}</span>`;
    b.addEventListener('click', () => app.nahrad(ST.predvolba(v.id, app.p)));
    $('seznamPredvoleb').appendChild(b);
  }

  /* ---------- start ---------- */
  TrubkyGui.pripoj({ klic: KLIC + '_gui', pohled: j => { if (nahled) { je3d(true); nahled.pohled(j); } } });
  prepniTab(vyukaTab);
  app.start();
  window.__evolKola = { stav: () => app.p, vysledek: () => V, prepocet, nastavPohled, prepniTab, natoc: (q) => { phi1 = q; otoc2D(); }, app, nahled, dily: () => dily3d };
})();

/* Uživatelské rozhraní generátoru evolventních kol. */
(function () {
  'use strict';
  const E = window.EvolKola;
  const $ = (id) => document.getElementById(id);
  const PI = Math.PI, TAU = 2 * PI;
  const KLIC = 'webapp_evolventni_kola_stav';
  const SVGNS = 'http://www.w3.org/2000/svg';
  const f = (v, d) => E.fmt(v, d == null ? 3 : d);

  /* ---------- Stav ---------- */
  const VYCH = {
    rezim: 'jedno', modul: '2', alfa: '20', z1: 20, x1: '0', d1: '8', z2: 40, x2: '0', d2: '8', b: '10',
    jn: '0', ct: '0', ko: '0', tol: '0.005', zkratit: true, exp: false,
    eModul: '1', eAlfa: '20', eHa: '1', eC: '0.25', eRho: '0.38', pomocne: false, dosed: true,
    vrstvy: { ra: true, r: true, rb: true, rf: true, rForm: false, rw: true }, vyukaTab: 'Ev'
  };
  let S = Object.assign({}, VYCH);
  try { const ul = JSON.parse(localStorage.getItem(KLIC) || 'null'); if (ul && typeof ul === 'object') S = Object.assign(S, ul, { vrstvy: Object.assign({}, VYCH.vrstvy, ul.vrstvy || {}) }); } catch (e) { /* bez uložení */ }
  function uloz() { try { localStorage.setItem(KLIC, JSON.stringify(S)); } catch (e) { /* plné úložiště */ } }

  // moduly do výběru
  (function () {
    const sel = $('vModul');
    for (const [nazev, rada] of [['Řada 1 (přednostní)', E.MODULY_RADA1], ['Řada 2', E.MODULY_RADA2]]) {
      const og = document.createElement('optgroup'); og.label = nazev;
      for (const m of rada) { const o = document.createElement('option'); o.value = String(m); o.textContent = String(m).replace('.', ','); og.appendChild(o); }
      sel.appendChild(og);
    }
  })();

  const POLE = { vModul: 'modul', vAlfa: 'alfa', vZ1: 'z1', vX1: 'x1', vD1: 'd1', vZ2: 'z2', vX2: 'x2', vD2: 'd2', vB: 'b', vJn: 'jn', vCt: 'ct', vKo: 'ko', vTol: 'tol', eModul: 'eModul', eAlfa: 'eAlfa', eHa: 'eHa', eC: 'eC', eRho: 'eRho' };
  const ZASKRT = { vZkratit: 'zkratit', vExp: 'exp', vPomocne: 'pomocne', vDosed: 'dosed' };
  function doFormulare() {
    for (const [id, k] of Object.entries(POLE)) { const el = $(id); el.value = String(S[k]).replace('.', el.tagName === 'SELECT' ? '.' : ','); if (el.tagName === 'SELECT' && el.selectedIndex < 0) el.value = String(VYCH[k]); }
    for (const [id, k] of Object.entries(ZASKRT)) $(id).checked = !!S[k];
    document.querySelectorAll('#legenda2d input').forEach((i) => { i.checked = !!S.vrstvy[i.dataset.vrstva]; });
    if (S.exp) $('detExp').open = true;
  }
  const cislo = (v) => parseFloat(String(v).replace(',', '.').replace('−', '-'));

  /* ---------- Výpočet ---------- */
  let V = null; // poslední výsledek {par, g1, g2, sk}
  function parametry() {
    const exp = S.exp;
    const spol = {
      m: exp ? cislo(S.eModul) : cislo(S.modul), alfa: exp ? cislo(S.eAlfa) : cislo(S.alfa),
      haS: exp ? cislo(S.eHa) : 1, cS: exp ? cislo(S.eC) : 0.25, rhoS: exp ? cislo(S.eRho) : 0.38,
      b: cislo(S.b), cTisk: cislo(S.ct), korOtvor: cislo(S.ko), tol: cislo(S.tol), jn: cislo(S.jn), zkratitHlavy: !!S.zkratit
    };
    return { spol, k1: { z: +S.z1, x: cislo(S.x1), dOtvor: cislo(S.d1) }, k2: { z: +S.z2, x: cislo(S.x2), dOtvor: cislo(S.d2) } };
  }
  function nestandardni(spol) {
    const d = [];
    if (S.exp) {
      if (!E.MODULY_RADA1.includes(spol.m) && !E.MODULY_RADA2.includes(spol.m)) d.push('modul mimo ČSN 01 4608');
      if (spol.alfa !== 20) d.push('α = ' + f(spol.alfa, 1) + '°');
      if (spol.haS !== 1) d.push('ha* = ' + f(spol.haS, 2));
      if (spol.cS !== 0.25) d.push('c* = ' + f(spol.cS, 2));
      if (spol.rhoS !== 0.38) d.push('ρf* = ' + f(spol.rhoS, 2));
    }
    return d;
  }
  function prepocet() {
    const par = parametry();
    // zvýraznit neplatná čísla
    for (const [id, k] of Object.entries(POLE)) { const el = $(id); if (el.tagName === 'INPUT') el.classList.toggle('chyba', !isFinite(cislo(S[k]))); }
    let g1, g2 = null, sk = null;
    if (S.rezim === 'dvojice') { sk = E.soukoli(par.spol, par.k1, par.k2); g1 = sk.g1; g2 = sk.g2; }
    else {
      const ds = (par.spol.jn || 0) / (2 * Math.cos(par.spol.alfa * PI / 180));
      g1 = E.kolo(Object.assign({}, par.spol, par.k1, { ds: isFinite(ds) && ds >= 0 ? ds : 0 }));
      if (!(par.spol.jn >= 0)) g1.chyby.push('Boční vůle nesmí být záporná.');
    }
    V = { par, g1, g2, sk, nestd: nestandardni(par.spol) };
    vykresliVysledky(); kresli2D(true); naplanuj3D(); vyukaObnov();
  }

  /* ---------- Výsledky a kontroly ---------- */
  function vykresliVysledky() {
    const { g1, g2, sk, nestd } = V;
    const dvoj = !!sk;
    const chyby = sk ? sk.chyby || [] : g1.chyby;
    const varov = sk ? sk.varovani || [] : g1.varovani || [];
    const stitek = $('stitekGeom');
    stitek.textContent = nestd.length ? 'experimentální: ' + nestd.join(', ') : 'standardní geometrie';
    stitek.className = 'stitek' + (nestd.length ? ' exp' : '');
    $('stitek2D').textContent = nestd.length ? 'nestandardní' : '';
    $('stitek2D').className = 'stitek' + (nestd.length ? ' exp' : '');
    $('stitek2D').hidden = !nestd.length;
    const souhrn = $('souhrn');
    const uroven = chyby.length ? 'chyba' : varov.some((v) => v.uroven !== 'info') ? 'mez' : 'ok';
    souhrn.className = 'souhrn ' + uroven;
    souhrn.textContent = chyby.length ? 'Návrh má ' + chyby.length + ' ' + (chyby.length === 1 ? 'chybu' : chyby.length < 5 ? 'chyby' : 'chyb') + ' – viz Kontroly.'
      : uroven === 'mez' ? 'Geometrie je platná, ale má upozornění.' : (dvoj ? 'Soukolí je geometricky v pořádku.' : 'Kolo je geometricky v pořádku.');
    // boxy
    const boxy = [];
    const box = (popis, cislo, tr) => boxy.push('<div class="box ' + (tr || '') + '"><div class="popis">' + popis + '</div><div class="cislo">' + cislo + '</div></div>');
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
    // kontroly
    const li = [];
    chyby.forEach((t) => li.push('<li class="chyba"><b>Chyba:</b> ' + esc(t) + '</li>'));
    varov.forEach((v) => li.push('<li class="' + v.uroven + '"><b>' + (v.uroven === 'chyba' ? 'Chyba' : v.uroven === 'info' ? 'Poznámka' : 'Upozornění') + ':</b> ' + esc(v.text) + '</li>'));
    if (nestd.length) li.push('<li class="mez"><b>Experimentální nastavení:</b> ' + esc(nestd.join(', ')) + ' – kolo neodpovídá základnímu profilu ISO 53 a nezabírá s normalizovanými koly.</li>');
    if (g1 && g1.d) {
      const okk = [];
      [g1, g2].forEach((g, i) => { if (g && g.d && !g.podrez) okk.push('kolo ' + (i + 1) + ' bez podřezání (z ≥ z_min nebo x ≥ x_min)'); });
      if (dvoj && sk.aw && !sk.chyby.length) okk.push('bez interference a kolize, ε_α = ' + f(sk.epsA, 3));
      okk.forEach((t) => li.push('<li><b>OK:</b> ' + esc(t) + '</li>'));
    }
    $('kontroly').innerHTML = li.join('');
    const n = g1 && g1.pul ? g1.evBody.length + g1.prBody.length - 1 : 0;
    $('infoKvalita').textContent = n ? 'Půlprofil kola 1 má ' + n + ' bodů (evolventa ' + g1.evBody.length + ', přechodová křivka ' + g1.prBody.length + '); obrys celkem ' + g1.obrys.length + ' vrcholů.' : '';
    $('btnXmin1').disabled = !(g1 && isFinite(g1.xMin));
    $('btnXmin2').disabled = !(g2 && isFinite(g2.xMin));
  }
  function esc(t) { return String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  /* ---------- 2D výkres ---------- */
  const vykres = $('vykres2d');
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', '2D profil ozubení');
  vykres.appendChild(svg);
  const el = (tag, attrs, rodic) => { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (rodic) rodic.appendChild(e); return e; };
  let vb = null, pohled = 'celek', phi1 = 0, anim = false, posledniCas = 0;
  const vrstvy2D = {};
  function kresli2D(novy) {
    svg.innerHTML = '';
    const { g1, g2, sk } = V;
    if (!g1 || !g1.obrys) { el('text', { x: 0, y: 0, fill: 'currentColor' }, svg).textContent = 'Geometrii nelze sestrojit – viz Kontroly.'; svg.setAttribute('viewBox', '-60 -20 300 40'); svg.style.color = 'var(--text-chyba)'; return; }
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
        if (!S.vrstvy[id]) continue;
        el('circle', { cx: 0, cy: 0, r: R, fill: 'none', stroke: barva, 'stroke-width': '1', 'stroke-dasharray': dash, 'vector-effect': 'non-scaling-stroke', opacity: '0.85' }, st);
      }
      el('circle', { cx: 0, cy: 0, r: Math.max(k.g.m * 0.15, 0.1), fill: 'var(--text-muted)' }, st);
      vrstvy2D.kola.push(rot);
    }
    vrstvy2D.dotyky = null;
    if (sk && sk.aw && sk.g1.obrys && sk.g2.obrys) {
      if (S.vrstvy.rw) {
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
    if (vrstvy2D.kola[1]) vrstvy2D.kola[1].setAttribute('transform', 'rotate(' + E.natoceni2(sk, phi1, S.dosed) * 180 / PI + ')');
    if (vrstvy2D.dotyky) {
      const g = vrstvy2D.dotyky; g.innerHTML = '';
      const rPx = vb ? 4.5 * vb.w / (svg.clientWidth || 600) : 0.3;
      for (const d of E.dotyky(sk, phi1)) el('circle', { cx: d.x, cy: d.y, r: rPx, fill: 'var(--danger)', stroke: 'var(--bg-input)', 'stroke-width': '1', 'vector-effect': 'non-scaling-stroke' }, g);
    }
    if (pohled3d && V3) {
      const uhly = [phi1]; if (V3.dvoj) uhly.push(E.natoceni2(sk, phi1, S.dosed));
      pohled3d.natoc(uhly);
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
    anim = !anim; $('btnAnim').setAttribute('aria-pressed', anim); $('btnAnim').textContent = anim ? '❚❚ Zastavit' : '▶ Animace záběru';
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
    const p = ukaz.get(e.pointerId); if (!p || !vb) return;
    if (ukaz.size === 2) {
      const [a, b] = [...ukaz.values()]; p.x = e.clientX; p.y = e.clientY;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch) zoom(pinch / d, (a.x + b.x) / 2, (a.y + b.y) / 2);
      pinch = d; return;
    }
    const r = svg.getBoundingClientRect();
    vb.x -= (e.clientX - p.x) / r.width * vb.w; vb.y -= (e.clientY - p.y) / r.height * vb.h;
    p.x = e.clientX; p.y = e.clientY; aplikujVB();
  });
  const konecU = (e) => { ukaz.delete(e.pointerId); if (ukaz.size < 2) pinch = 0; };
  svg.addEventListener('pointerup', konecU); svg.addEventListener('pointercancel', konecU);
  document.querySelectorAll('#legenda2d input').forEach((i) => i.addEventListener('change', () => { S.vrstvy[i.dataset.vrstva] = i.checked; uloz(); kresli2D(false); }));

  /* ---------- 3D ---------- */
  let pohled3d = null, V3 = null, cas3d = 0;
  try { pohled3d = window.Pohled3D ? window.Pohled3D.vytvor($('platno3d')) : null; } catch (e) { pohled3d = null; }
  function naplanuj3D() { clearTimeout(cas3d); cas3d = setTimeout(obnov3D, 180); }
  function tol3D(g) { return Math.max(V.par.spol.tol, g.m * 0.004); }
  function obnov3D() {
    if (!pohled3d) return;
    const { g1, g2, sk } = V;
    const site = [];
    let info = '';
    try {
      if (g1 && g1.obrys && g1.ok !== false && !g1.chyby.some((t) => /Otvor zasahuje/.test(t))) {
        const s1 = E.sitKola(g1, tol3D(g1));
        site.push({ sit: s1, x: 0, y: 0, R: g1.ra, b: g1.b });
        info = (s1.trojuhelniky.length / 3).toLocaleString('cs-CZ') + ' trojúhelníků';
      }
      if (sk && sk.aw && g2 && g2.obrys && site.length && !g2.chyby.some((t) => /Otvor zasahuje/.test(t))) {
        const s2 = E.sitKola(g2, tol3D(g2));
        site.push({ sit: s2, x: sk.aw, y: 0, R: g2.ra, b: g2.b });
        info = ((site[0].sit.trojuhelniky.length + s2.trojuhelniky.length) / 3).toLocaleString('cs-CZ') + ' trojúhelníků';
      }
    } catch (e) { info = 'Síť se nepodařilo sestavit: ' + e.message; }
    V3 = { dvoj: site.length === 2 };
    pohled3d.nastav(site);
    $('info3d').textContent = site.length ? info + ' (náhled s odchylkou ≤ ' + f(tol3D(g1), 3) + ' mm)' : 'Model nelze sestavit – viz Kontroly.';
    otoc2D();
  }
  $('btn3dReset').addEventListener('click', () => pohled3d && pohled3d.vychozi());

  /* ---------- Exporty ---------- */
  function stahni(data, nazev, typ) {
    const blob = data instanceof Blob ? data : new Blob([data], { type: typ });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nazev;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function jmeno(pripona, ktere) {
    const { g1, g2, sk } = V; const m = String(g1.m).replace('.', '_');
    if (sk && ktere !== 1 && ktere !== 2) return 'soukoli_m' + m + '_z' + g1.z + '-' + g2.z + '.' + pripona;
    const g = ktere === 2 ? g2 : g1;
    return 'kolo_m' + m + '_z' + g.z + (g.x ? '_x' + String(g.x).replace('.', '_').replace('-', 'm') : '') + '.' + pripona;
  }
  function dily2D() {
    const { g1, g2, sk } = V;
    const d = [{ g: g1, x: 0, y: 0, uhel: 0 }];
    if (sk && sk.aw && g2 && g2.obrys) d.push({ g: g2, x: sk.aw, y: 0, uhel: E.natoceni2(sk, 0, S.dosed) });
    return d;
  }
  function lzeExportovat() {
    const chyby = V.sk ? V.sk.chyby : V.g1.chyby;
    if (!V.g1 || !V.g1.obrys || (V.sk && !(V.g2 && V.g2.obrys))) { Dialog.chyba('Geometrii nelze sestrojit – opravte chyby v Kontrolách.'); return false; }
    if (chyby.length) Dialog.info('Pozor: návrh obsahuje chyby (viz Kontroly), export přesto proběhl.');
    return true;
  }
  $('exSvg').addEventListener('click', () => { if (lzeExportovat()) stahni(E.exportSVG(dily2D(), { pomocne: S.pomocne }), jmeno('svg'), 'image/svg+xml'); });
  $('exDxf').addEventListener('click', () => { if (lzeExportovat()) stahni(E.exportDXF(dily2D(), { pomocne: S.pomocne }), jmeno('dxf'), 'application/dxf'); });
  function exportSTL(ktere) {
    if (!lzeExportovat()) return;
    const { g1, g2, sk } = V;
    const site = [];
    if (ktere === 1 || ktere === 's') site.push(E.sitKola(g1));
    if (ktere === 2) site.push(E.sitKola(g2));
    if (ktere === 's') site.push(E.sitKola(g2, null, { x: sk.aw, uhel: E.natoceni2(sk, 0, S.dosed) }));
    for (const s of site) {
      const k = E.kontrolaSite(s);
      if (k.vadneHrany || !(k.objem > 0)) { Dialog.chyba('Kontrola sítě selhala (' + k.vadneHrany + ' vadných hran) – STL se neuložilo.'); return; }
    }
    const n = site.reduce((a, s) => a + s.trojuhelniky.length / 3, 0);
    stahni(new Blob([E.stlBinarni(site, 'evolventni kolo - github_site')], { type: 'model/stl' }), jmeno('stl', ktere), 'model/stl');
    $('infoExport').textContent = 'STL: ' + n.toLocaleString('cs-CZ') + ' trojúhelníků, síť uzavřená (každá hrana sdílená právě dvěma trojúhelníky), objem ' +
      f(site.reduce((a, s) => a + E.kontrolaSite(s).objem, 0) / 1000, 3) + ' cm³.';
  }
  $('exStl1').addEventListener('click', () => exportSTL(1));
  $('exStl2').addEventListener('click', () => exportSTL(2));
  $('exStlS').addEventListener('click', () => exportSTL('s'));
  $('exJson').addEventListener('click', () => {
    const { par, sk, g1, g2 } = V;
    const out = { generator: 'Evolventní ozubená kola (github_site)', datum: new Date().toISOString().slice(0, 10), rezim: S.rezim, experimentalni: S.exp, parametry: par };
    const vyber = (g) => g && g.d ? { z: g.z, x: g.x, d: g.d, db: g.db, da: g.da, df: g.df, dFf: g.dForm, s: g.s, sa: g.sa, Wk: g.Wk, podrezani: g.podrez } : null;
    out.kolo1 = vyber(g1); if (g2) out.kolo2 = vyber(g2);
    if (sk && sk.aw) out.soukoli = { a: sk.a, aw: sk.aw, alfaW_deg: sk.alfaW * 180 / PI, i: sk.i, epsAlfa: sk.epsA, y: sk.y, k: sk.kS, c12: sk.c12, c21: sk.c21, jn: sk.jn };
    stahni(JSON.stringify(out, null, 2), jmeno('json'), 'application/json');
  });

  /* ---------- Výukový režim ---------- */
  const tabs = ['Ev', 'Vyr', 'Zab'];
  function prepniTab(t) {
    S.vyukaTab = t; uloz();
    for (const x of tabs) { $('tab' + x).setAttribute('aria-selected', x === t); $('pan' + x).hidden = x !== t; }
    vyukaObnov();
  }
  tabs.forEach((t) => $('tab' + t).addEventListener('click', () => prepniTab(t)));
  function vyukaObnov() {
    if (S.vyukaTab === 'Ev') kresliEvolventu();
    else if (S.vyukaTab === 'Vyr') kresliVyrobu();
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
    const cesta = (do_) => { let d = ''; for (let i = 0; i <= 120; i++) { const t = do_ * i / 120, p = ev(t); d += (i ? 'L' : 'M') + p[0].toFixed(2) + ' ' + Y(p[1]).toFixed(2); } return d; };
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
    const { sk, g1 } = V;
    let h = '<p><b>Přímka záběru</b> je společná tečna obou základních kružnic. Svírá s tečnou valivých kružnic úhel záběru α<sub>w</sub>; dotyk boků se po ní posouvá od bodu A (hlava hnaného kola vstupuje do záběru) do bodu E (hlava hnacího kola vystupuje). Ve 2D náhledu je aktivní úsek AE červeně a body dotyku jako červené tečky.</p>';
    h += '<p><b>Součinitel záběru</b> ε<sub>α</sub> = |AE| / p<sub>b</sub> udává průměrný počet párů zubů v záběru. Musí být > 1, prakticky ≥ 1,2.</p>';
    h += '<p><b>Korekce</b> x₁, x₂ posunou profily. Pokud Σx ≠ 0, změní se úhel záběru: <span class="vzorec">inv α<sub>w</sub> = inv α + 2·Σx·tg α/(z₁+z₂)</span> a osová vzdálenost <span class="vzorec">a<sub>w</sub> = a·cos α / cos α<sub>w</sub></span>. Rovnice pro α<sub>w</sub> nemá řešení v uzavřeném tvaru, generátor ji řeší Newtonovou metodou.</p>';
    if (sk && sk.aw) {
      h += '<p><b>Aktuální soukolí:</b> a = m(z₁+z₂)/2 = ' + f(sk.a, 3) + ' mm; inv α<sub>w</sub> = ' + f(E.inv(sk.alfa), 6) + ' + 2·' + f(V.par.k1.x + V.par.k2.x, 3) + '·tg ' + f(sk.alfa * 180 / PI, 1) + '°/' + (sk.g1.z + sk.g2.z) + ' = ' + f(sk.invAw, 6) +
        ' → α<sub>w</sub> = ' + f(sk.alfaW * 180 / PI, 4) + '°, a<sub>w</sub> = ' + f(sk.aw, 4) + ' mm. Dráha záběru |AE| = ' + f(sk.LE - sk.LA, 3) + ' mm, p<sub>b</sub> = ' + f(sk.pb, 3) + ' mm → ε<sub>α</sub> = ' + f(sk.epsA, 3) + '.</p>';
    } else h += '<p>Přepněte nahoře režim <b>Dvojice kol</b> – zde se pak zobrazí výpočet pro vaše soukolí' + (g1 && g1.d ? '' : '') + '.</p>';
    h += '<p><b>Vůle:</b> evolventní soukolí bez vůle by se při tepelné roztažnosti nebo nepřesnosti zadřelo. Ztenčení zubů o Δs dá normálovou boční vůli j<sub>n</sub> = (Δs₁+Δs₂)·cos α. Při tisku navíc kompenzujte roztékání materiálu tiskovou korekcí.</p>';
    $('textZab').innerHTML = h;
  }

  /* ---------- Události formuláře ---------- */
  let casVstup = 0;
  for (const [id, k] of Object.entries(POLE)) {
    $(id).addEventListener(($(id).tagName === 'SELECT') ? 'change' : 'input', () => {
      S[k] = $(id).value; uloz(); clearTimeout(casVstup); casVstup = setTimeout(prepocet, 120);
    });
  }
  for (const [id, k] of Object.entries(ZASKRT)) $(id).addEventListener('change', () => { S[k] = $(id).checked; uloz(); if (k === 'exp') nastavExp(); prepocet(); });
  function nastavExp() { $('vModul').disabled = S.exp; $('vAlfa').disabled = S.exp; $('kartaStd').querySelector('#napovedaStd').style.opacity = S.exp ? 0.5 : 1; }
  function nastavRezim(r) {
    S.rezim = r; uloz();
    $('rezJedno').setAttribute('aria-pressed', r === 'jedno'); $('rezDvojice').setAttribute('aria-pressed', r === 'dvojice');
    $('blokKolo2').hidden = r !== 'dvojice'; $('kartaSoukoli').hidden = r !== 'dvojice';
    $('exStl2').hidden = r !== 'dvojice'; $('exStlS').hidden = r !== 'dvojice';
    $('btnAnim').textContent = anim ? '❚❚ Zastavit' : (r === 'dvojice' ? '▶ Animace záběru' : '▶ Otáčení');
    $('nadpis1Doplnek').textContent = r === 'dvojice' ? ' (hnací, pastorek)' : '';
    pohled = 'celek'; prepocet();
  }
  $('rezJedno').addEventListener('click', () => nastavRezim('jedno'));
  $('rezDvojice').addEventListener('click', () => nastavRezim('dvojice'));
  function nastavX(i) {
    const g = i === 1 ? V.g1 : V.g2; if (!g || !isFinite(g.xMin)) return;
    const x = Math.max(cislo(S['x' + i]) || 0, Math.ceil(g.xMin * 1000) / 1000);
    S['x' + i] = String(x); $('vX' + i).value = String(x).replace('.', ','); uloz(); prepocet();
  }
  $('btnXmin1').addEventListener('click', () => nastavX(1));
  $('btnXmin2').addEventListener('click', () => nastavX(2));
  $('btnAw').addEventListener('click', () => {
    const aw = cislo($('vAwZad').value), sp = V.par.spol, z1 = +S.z1, z2 = +S.z2;
    const nav = isFinite(aw) ? E.korekceProOsovou(sp.m, sp.alfa, z1, z2, aw) : null;
    if (!nav) { $('awInfo').textContent = 'Zadejte kladnou osovou vzdálenost blízkou a = m(z₁+z₂)/2 = ' + f(sp.m * (z1 + z2) / 2, 3) + ' mm.'; return; }
    const s2 = Math.sin(sp.alfa * PI / 180) ** 2;
    const xmin1 = sp.haS - z1 * s2 / 2;
    // pastorek dostane alespoň x_min, zbytek se rozdělí podle poměru zubů (víc pastorku)
    let x1 = nav.sumaX * z2 / (z1 + z2);
    if (x1 < xmin1) x1 = xmin1;
    const x2 = nav.sumaX - x1;
    S.x1 = String(+x1.toFixed(4)); S.x2 = String(+x2.toFixed(4));
    $('vX1').value = S.x1.replace('.', ','); $('vX2').value = S.x2.replace('.', ',');
    $('awInfo').textContent = 'Σx = ' + f(nav.sumaX, 4) + ', α_w = ' + f(nav.alfaW * 180 / PI, 3) + '° → x₁ = ' + f(x1, 4) + ', x₂ = ' + f(x2, 4) + '.';
    uloz(); prepocet();
  });
  let sirka2D = 0;
  new ResizeObserver(() => { const w = vykres.clientWidth; if (V && vb && Math.abs(w - sirka2D) > 2) { sirka2D = w; nastavPohled(pohled); otoc2D(); } }).observe(vykres);

  doFormulare(); nastavExp();
  nastavRezim(S.rezim === 'dvojice' ? 'dvojice' : 'jedno');
  prepniTab(tabs.includes(S.vyukaTab) ? S.vyukaTab : 'Ev');
  window.__evolKola = { stav: () => S, vysledek: () => V, prepocet, nastavRezim, nastavPohled, prepniTab, natoc: (p) => { phi1 = p; otoc2D(); } };
})();

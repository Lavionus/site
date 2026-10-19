/* ============================================================
   epidemie/ui_stoch.js – záložka „Stochastika“: soubory běhů (Gillespie / tau-leaping) a větvící proces.
   ============================================================ */
(function () {
  'use strict';
  const App = window.EpiApp, S = window.EpiStoch, M = window.EpiModel, $ = App.$;
  const { f, fc, fp, fpa, box } = App;

  const g = App.graf('g-st', { vyska: 280, legenda: $('#leg-st'), titulek: 'Infekční v souboru stochastických běhů' });
  const gH = App.graf('g-st-hist', { vyska: 170, popisX: 'podíl nakažených', formatX: (x) => fp(x, 0), popisKurzor: 'konečná velikost', titulek: 'Rozdělení konečné velikosti' });
  const gK = App.graf('g-vp-k', { vyska: 200, popisX: 'disperze k', formatX: (x) => f(Math.pow(10, x), 2), popisKurzor: 'k =', formatY: (y) => fp(y, 0), formatBublina: (y) => fp(y, 1), titulek: 'Pravděpodobnost vymření podle k' });
  const gP = App.graf('g-vp-pot', { vyska: 200, popisX: 'počet nákaz od jednoho případu', popisKurzor: 'nákaz', formatY: (y) => fp(y, 0), formatBublina: (y) => fp(y, 2), titulek: 'Rozdělení počtu nákaz' });
  let bezi = false, prerusit = false;

  const n = () => App.nast;
  function naplnit() {
    $('#st-metoda').value = n().stMetoda; $('#st-N').value = n().stN; $('#st-I0').value = n().stI0;
    $('#st-behu').value = String(n().stBehu); $('#st-seed').value = n().stSeed; $('#st-tau').value = String(n().stTau);
  }
  const cele = (sel, klic, min, max) => $(sel).addEventListener('input', () => {
    const v = Number($(sel).value.replace(/\s/g, ''));
    if (!Number.isInteger(v) || v < min || v > max) { $(sel).classList.add('chyba'); return; }
    $(sel).classList.remove('chyba'); n()[klic] = v; App.ulozit();
  });
  cele('#st-N', 'stN', 10, 1e9); cele('#st-I0', 'stI0', 1, 1e6);
  $('#st-metoda').addEventListener('change', (e) => { n().stMetoda = e.target.value; App.ulozit(); });
  $('#st-behu').addEventListener('change', (e) => { n().stBehu = Number(e.target.value); App.ulozit(); });
  $('#st-tau').addEventListener('change', (e) => { n().stTau = Number(e.target.value); App.ulozit(); });
  $('#st-seed').addEventListener('input', (e) => { n().stSeed = e.target.value; App.ulozit(); });

  async function spustit() {
    if (bezi) return;
    const par = App.parModel(App.nast, { N: n().stN, I0: Math.min(n().stI0, n().stN), vek: false, kampanDavky100k: 0 });
    const metoda = n().stMetoda;
    App.chyba('#st-chyba', '');
    const poznamka = n().kampanDavky100k > 0 || n().vek ? ' Pozn.: stochastický model je homogenní (bez věku) a bez očkovací kampaně.' : '';
    if (metoda === 'gillespie' && par.N > 200000) { App.chyba('#st-chyba', 'Gillespieho algoritmus je pro více než 200 000 lidí příliš pomalý (každá událost zvlášť). Zvolte tau-leaping.'); return; }
    let odr;
    try { odr = M.simuluj(Object.assign({}, par, { krok: 0.1 }), { bezRt: true }); S.intenzity(par); }
    catch (e) { App.chyba('#st-chyba', e.message); return; }
    bezi = true; prerusit = false;
    $('#b-st-spustit').disabled = true; $('#b-st-stop').hidden = false; $('#st-prubeh').hidden = false;
    const pruh = $('#st-prubeh > div');
    const pocet = n().stBehu;
    const zakladSeed = window.EpiAgenti.normalizujSeed(n().stSeed);
    const behy = [];
    const t0 = performance.now();
    let udalosti = 0, cas = performance.now();
    for (let b = 0; b < pocet; b++) {
      const seed = (zakladSeed + b) >>> 0;
      const r = metoda === 'gillespie' ? S.gillespie(par, seed) : S.tauLeaping(par, seed, n().stTau);
      udalosti += r.udalosti || 0;
      behy.push(r);
      if (performance.now() - cas > 40) {
        pruh.style.width = ((b + 1) / pocet * 100).toFixed(1) + '%';
        $('#st-stav').textContent = `běh ${b + 1} z ${pocet}…`;
        await App.pauza(); cas = performance.now();
        if (prerusit) break;
      }
    }
    bezi = false;
    $('#b-st-spustit').disabled = false; $('#b-st-stop').hidden = true; $('#st-prubeh').hidden = true;
    $('#st-stav').textContent = `${behy.length} běhů za ${f((performance.now() - t0) / 1000, 1)} s` + (udalosti ? ` · ${fc(udalosti)} událostí` : '') + '.' + poznamka;
    if (!behy.length) return;
    vykresli(behy, odr, par);
  }

  function vykresli(behy, odr, par) {
    const N = par.N;
    const zOdr = (odr.celkem.kInf[odr.t.length - 1] + par.I0) / N;
    const hranice = Math.max(par.I0 + 1, 0.1 * zOdr * N);
    const sh = S.souhrnSouboru(behy, ['I', 'kum'], hranice);
    const ints = S.intenzity(par);
    const S0 = (N - par.I0) * (1 - par.ockovaniPodil * par.ucinnost);
    const Rzac = ints.beta(0) / ints.gamma * S0 / N;
    const konstantni = M.analytickaPlatnost(M.over(par).par) && par.imunitaDny === 0;
    const teorie = konstantni ? S.pVymreniTeorie(Rzac, par.I0) : null;
    const velke = sh.konecne.filter(k => k >= hranice).map(k => k / N);
    let h = box('P(vymření) simulace', fp(sh.pVymreni), `${sh.vymrele} z ${sh.pocet} běhů`);
    h += box('P(vymření) teorie', teorie == null ? '—' : fp(teorie), teorie == null ? 'zásahy/sezóna mění R v čase' : `(1/R)^I₀, R = ${f(Rzac, 2)}, I₀ = ${par.I0}`);
    h += box('Velká ohniska: nakaženo', fp(sh.prumerVelkych / N), velke.length ? 'rozsah ' + fp(Math.min(...velke)) + ' – ' + fp(Math.max(...velke)) : '—');
    h += box('ODR pro srovnání', fp(zOdr), 'deterministický model');
    $('#st-dlazdice').innerHTML = h;
    const x = sh.t, p = sh.pasy.I;
    const rady = [
      { id: 'p95', nazev: '95% pásmo', barva: '--c-i', x, y: p.q975, y2: p.q025, pas: true, pruhlednost: 0.14 },
      { id: 'p50', nazev: '50% pásmo', barva: '--c-i', x, y: p.q75, y2: p.q25, pas: true, pruhlednost: 0.3 },
      { id: 'med', nazev: 'medián', barva: '--c-i', x, y: p.q50, sirka: 2.5 },
      { id: 'pr', nazev: 'průměr', barva: '--c-s', x, y: p.prumer, sirka: 1.5, carky: [2, 3] },
      { id: 'odr', nazev: 'ODR', barva: '--text', x: odr.t, y: odr.celkem.I.map((y, i) => y + odr.celkem.A[i]), carky: [6, 4], sirka: 1.5 }
    ];
    behy.slice(0, 8).forEach((b, i) => rady.push({ id: 'beh', nazev: 'jednotlivé běhy (8)', bezLegendy: i > 0, bezBubliny: true, barva: '--c-i', x: b.z.t, y: b.z.I, sirka: 0.8, pruhlednost: 0.4 }));
    g.nastav({ rady, pasma: App.pasma(par), maxX: par.dny });
    // histogram konečné velikosti (40 košů)
    const kose = 40, poc = new Array(kose).fill(0);
    for (const k of sh.konecne) poc[Math.min(kose - 1, Math.floor((k + par.I0) / N * kose))]++;
    const hx = [], hy = [], h0 = [];
    poc.forEach((c, i) => { hx.push(i / kose, (i + 1) / kose); hy.push(c / sh.pocet, c / sh.pocet); h0.push(0, 0); });
    gH.v.formatY = (y) => fp(y, 0); gH.v.formatBublina = (y) => fp(y, 1);
    gH.nastav({ rady: [{ id: 'h', nazev: 'podíl běhů', barva: '--c-s', x: hx, y: hy, y2: h0, pas: true, pruhlednost: 0.6 }, { id: 'hl', nazev: 'podíl běhů', bezLegendy: true, barva: '--c-s', x: hx, y: hy, sirka: 1.5 }], vLinie: [{ x: zOdr, popis: 'ODR' }], maxX: 1 });
  }
  $('#b-st-spustit').addEventListener('click', spustit);
  $('#b-st-stop').addEventListener('click', () => { prerusit = true; });

  // ---------- větvící proces ----------
  const cislo = (s) => { const t = String(s).trim().replace(/\s/g, '').replace(',', '.'); if (t === '∞' || /^inf/i.test(t)) return Infinity; return Number(t); };
  function vetveni() {
    const R = cislo($('#vp-R').value), k0 = cislo($('#vp-k').value), pocet = Number($('#vp-pocet').value);
    if (!(R >= 0 && R <= 50)) { $('#vp-dlazdice').innerHTML = '<div class="chybovy">R musí být 0–50.</div>'; return; }
    if (!(k0 > 0)) { $('#vp-dlazdice').innerHTML = '<div class="chybovy">k musí být kladné (nebo ∞).</div>'; return; }
    const k = k0 > 1e4 ? Infinity : k0;
    const sim = S.vetvici(R, k, pocet, n().stSeed || 1, 2000);
    const q = S.pVymreniVetveni(R, k);
    const qPoi = S.pVymreniVetveni(R, Infinity);
    const nul = sim.potomci.filter(x => x === 0).length / sim.potomci.length;
    const nulTeor = S.pgf(R, k, 0);
    const p80 = S.podilPro80(R, k);
    const male = sim.velikosti.filter(v => Number.isFinite(v));
    let h = box('P(vymření) simulace', fp(sim.pVymreni), `${pocet} řetězců (velké = nad 2 000 případů)`);
    h += box('P(vymření) teorie', fp(q), Number.isFinite(k) ? 'q = (1 + R(1−q)/k)^(−k)' : 'q = e^(−R(1−q))');
    h += box('Bez superšíření (Poisson)', fp(qPoi), 'stejné R, k = ∞');
    h += box('Nikoho nenakazí', fp(nulTeor), 'simulace ' + fp(nul));
    h += box('80 % přenosů způsobí', fp(p80), 'nejaktivnějších případů');
    h += box('Vymřelý řetězec: průměr', male.length ? f(male.reduce((a, b) => a + b, 0) / male.length, 1) + ' případů' : '—', male.length ? 'max ' + fc(Math.max(...male)) : '');
    $('#vp-dlazdice').innerHTML = h;
    // q(k) pro log k od −2 do 2
    const xs = [], ys = [];
    for (let i = 0; i <= 80; i++) { const lk = -2 + i * 0.05; xs.push(lk); ys.push(S.pVymreniVetveni(R, Math.pow(10, lk))); }
    gK.nastav({
      rady: [{ id: 'q', nazev: 'P(vymření)', barva: '--c-i', x: xs, y: ys, sirka: 2.5 }],
      hLinie: [{ y: qPoi, popis: 'Poisson (k = ∞)' }], vLinie: Number.isFinite(k) && k >= 0.01 && k <= 100 ? [{ x: Math.log10(k), popis: 'zvolené k' }] : [],
      minX: -2, maxX: 2, minY: 0, maxY: 1
    });
    const kmax = 20, xt = [], teor = [], emp = [];
    const cetn = new Array(kmax + 1).fill(0);
    for (const x of sim.potomci) if (x <= kmax) cetn[x]++;
    let pm = Number.isFinite(k) ? Math.pow(k / (k + R), k) : Math.exp(-R);
    for (let x = 0; x <= kmax; x++) {
      xt.push(x); teor.push(pm); emp.push(cetn[x] / sim.potomci.length);
      pm = Number.isFinite(k) ? pm * (x + k) / (x + 1) * (R / (k + R)) : pm * R / (x + 1);
    }
    gP.nastav({ rady: [
      { id: 't', nazev: Number.isFinite(k) ? 'teorie NB(R, k)' : 'teorie Poisson(R)', barva: '--c-s', x: xt, y: teor, body: true, sirka: 1.5 },
      { id: 'e', nazev: 'simulace', barva: '--c-i', x: xt, y: emp, jenBody: true }
    ], maxX: kmax, minY: 0 });
  }
  $('#b-vp').addEventListener('click', vetveni);

  App.zalozky.stoch = {
    naplnit,
    aktivuj() { if (!this.prvni) { this.prvni = true; vetveni(); } },
    zmena() { /* soubor běhů se spouští ručně – výpočet trvá */ }
  };
})();

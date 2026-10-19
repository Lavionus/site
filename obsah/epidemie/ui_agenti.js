/* ============================================================
   epidemie/ui_agenti.js – záložka „Agenti a sítě“: animace jedinců v prostoru nebo na síti kontaktů.
   ============================================================ */
(function () {
  'use strict';
  const App = window.EpiApp, A = window.EpiAgenti, Sit = window.EpiSit, M = window.EpiModel, $ = App.$;
  const { f, fc, fp, fd, box } = App;
  const n = () => App.nast;

  const arena = $('#arena'), actx = arena.getContext('2d');
  const gAg = App.graf('g-ag', { vyska: 260, legenda: $('#leg-ag'), titulek: 'Průběh u jedinců a v ODR' });
  const gRt = App.graf('g-ag-rt', { vyska: 190, legenda: $('#leg-ag-rt'), formatY: (y) => f(y, 2), desY: 2, titulek: 'Reprodukční číslo jedinců' });
  const histLeg = document.createElement('div'); histLeg.className = 'legenda'; $('#g-ag-hist').before(histLeg);
  const gHist = App.graf('g-ag-hist', { vyska: 190, legenda: histLeg, popisX: 'počet', popisKurzor: 'počet', formatY: (y) => fp(y, 0), formatBublina: (y) => fp(y, 1), titulek: 'Rozdělení počtu nákaz' });
  let sim = null, odr = null, sit = null, sitKlic = '', rozl = null, rozlKroku = 0;
  let bezi = false, posledniCas = 0, dluh = 0, posledniGraf = 0, konecHlaska = '';

  function naplnit() {
    $('#agN').value = n().agN; $('#agI0').value = n().agI0; $('#seed').value = n().seed;
    $('#f-rozdeleni').value = n().rozdeleni; $('#f-sitTyp').value = n().sitTyp;
    document.querySelectorAll('[data-rezim]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.rezim === n().rezimAgentu)));
    $('#ag-prostor').hidden = n().rezimAgentu !== 'prostor';
    $('#ag-sit').hidden = n().rezimAgentu !== 'sit';
    $('#kreslit-dosah').closest('label').hidden = n().rezimAgentu !== 'prostor';
  }
  const jeSit = () => n().rezimAgentu === 'sit';

  function pripravSit(par) {
    const klic = JSON.stringify([n().sitTyp, par.N, n().sitK, n().sitBeta, n().sitKKom, n().sitWDom, n().seed]);
    if (klic !== sitKlic) {
      sit = Sit.vytvorSit(n().sitTyp, par.N, { k: n().sitK, beta: n().sitBeta, kKomunita: n().sitKKom, wDomov: n().sitWDom }, n().seed);
      sit.stat = Sit.statistiky(sit);
      sitKlic = klic;
      rozl = par.N <= 1500 ? Sit.rozlozeni(sit, n().seed) : null;
      rozlKroku = 0;
    }
    return sit;
  }

  function reset() {
    zastav();
    App.chyba('#ag-chyba', '');
    const par = App.parAgentu();
    try {
      if (jeSit()) {
        if (par.N > 50000) throw new Error('Síť zvládne nejvýš 50 000 uzlů.');
        pripravSit(par);
        sim = Sit.vytvorEpidemii(sit, Object.assign(App.parModel(), { N: par.N, I0: par.I0, p: par.p, izolacePodil: par.izolacePodil, podilA: 0 }),
          { seed: n().seed, superK: n().superK > 0 ? n().superK : Infinity, pevne: n().rozdeleni === 'pevne' });
      } else {
        sim = A.vytvor(par);
      }
      odr = M.simuluj(Object.assign(App.parModel(), { N: par.N, I0: par.I0, vek: false, kampanDavky: 0, importy: 0, krok: 0.1 }), { bezRt: true });
    } catch (e) { sim = null; App.chyba('#ag-chyba', e.message); kresli(); grafy(); dlazdice(); return; }
    konecHlaska = '';
    const var_ = [];
    if (!jeSit()) {
      if (sim.varovani) var_.push(sim.varovani);
      if (sim.n > 20000) var_.push('Při více než 20 000 agentech může být animace na slabším zařízení trhaná.');
      if (sim.par.p * sim.kappa * sim.par.dtAgent > 0.3) var_.push('Vysoká intenzita přenosu na krok – zvyšte počet lidí v dosahu k.');
    } else if (!rozl) var_.push('Síť má víc než 1 500 uzlů – nekreslí se, simulace a grafy běží dál.');
    if (n().podilA > 0) var_.push('Asymptomatičtí jsou u jedinců zahrnuti průměrnou infekčností (bez zvláštního stavu).');
    if (n().kampanDavky100k > 0 || n().importy > 0) var_.push('Očkovací kampaň a importy se u jedinců nemodelují.');
    $('#ag-varovani').textContent = var_.join(' '); $('#ag-varovani').hidden = !var_.length;
    kresli(); grafy(); dlazdice();
    if (rozl && rozlKroku < 250) requestAnimationFrame(rozkladej);
  }
  function rozkladej() {
    if (!rozl || rozlKroku >= 250 || !jeSit() || $('#p-agenti').hidden) return;
    const t0 = performance.now();
    while (rozlKroku < 250 && performance.now() - t0 < 12) { rozl.krok(); rozlKroku++; }
    if (!bezi) kresli();
    requestAnimationFrame(rozkladej);
  }

  function zastav() { bezi = false; $('#b-start').textContent = '▶ Spustit'; }
  function konec() { return sim && ((jeSit() ? Sit.skoncila(sim) : A.skoncila(sim)) || sim.t >= n().dny - 1e-9); }
  function krok() { if (jeSit()) Sit.krok(sim); else A.krok(sim); }
  function spust() {
    if (!sim) reset();
    if (!sim) return;
    if (konec()) reset();
    bezi = true; posledniCas = performance.now(); dluh = 0;
    $('#b-start').textContent = '⏸ Pozastavit';
    requestAnimationFrame(smycka);
  }
  function smycka(ted) {
    if (!bezi || !sim) return;
    const rychlost = Number($('#rychlost').value);
    const dtReal = Math.min(0.25, (ted - posledniCas) / 1000);
    posledniCas = ted;
    const start = performance.now(), dt = sim.dt || sim.par.dtAgent;
    if (rychlost > 0) {
      dluh += dtReal * rychlost / dt;
      while (dluh >= 1 && !konec() && performance.now() - start < 30) { krok(); dluh -= 1; }
      if (dluh > 5) dluh = 0;
    } else while (!konec() && performance.now() - start < 14) krok();
    if (konec()) { konecHlaska = (jeSit() ? Sit.skoncila(sim) : A.skoncila(sim)) ? 'Epidemie skončila v den ' + f(sim.t, 1) + '.' : 'Dosažena délka simulace.'; zastav(); }
    kresli();
    if (ted - posledniGraf > 300 || !bezi) { grafy(); dlazdice(); posledniGraf = ted; }
    if (bezi) requestAnimationFrame(smycka);
  }

  function kresli() {
    const w = arena.clientWidth, h = arena.clientHeight;
    if (!w || !h) return;
    const dpr = window.devicePixelRatio || 1;
    if (arena.width !== Math.round(w * dpr) || arena.height !== Math.round(h * dpr)) { arena.width = Math.round(w * dpr); arena.height = Math.round(h * dpr); }
    actx.setTransform(dpr, 0, 0, dpr, 0, 0);
    actx.clearRect(0, 0, w, h);
    if (!sim) { $('#arena-info').textContent = 'chyba parametrů'; return; }
    const css = getComputedStyle(document.documentElement);
    const barvy = ['--c-s', '--c-e', '--c-i', '--c-r', '--c-v'].map(v => css.getPropertyValue(v).trim());
    const st = sim.stav, iso = sim.iso, nn = sim.n;
    let X, Y, vel;
    if (jeSit()) {
      if (!rozl) { actx.fillStyle = css.getPropertyValue('--text-muted').trim(); actx.font = '14px sans-serif'; actx.fillText('Síť je příliš velká pro kreslení.', 16, 40); $('#arena-info').textContent = 'den ' + f(sim.t, 1) + (konecHlaska ? ' · ' + konecHlaska : ''); return; }
      X = (i) => rozl.x[i] * w; Y = (i) => rozl.y[i] * h;
      vel = Math.max(2, Math.min(7, 0.5 * w / Math.sqrt(nn)));
      // hrany
      actx.strokeStyle = css.getPropertyValue('--border-strong').trim(); actx.lineWidth = 0.6; actx.globalAlpha = sit.m > 6000 ? 0.25 : 0.6;
      actx.beginPath();
      for (const [a, b] of sit.hrany) { actx.moveTo(X(a), Y(a)); actx.lineTo(X(b), Y(b)); }
      actx.stroke(); actx.globalAlpha = 1;
    } else {
      X = (i) => sim.x[i] * w; Y = (i) => sim.y[i] * h;
      vel = Math.max(1.4, Math.min(6, 0.42 * w / Math.sqrt(nn)));
      if ($('#kreslit-dosah').checked && sim.pocet[A.I] < 3000) {
        const rr = sim.r * Math.sqrt(sim.nasob(sim.t)) * w;
        actx.fillStyle = barvy[2]; actx.globalAlpha = 0.13; actx.beginPath();
        for (let i = 0; i < nn; i++) if (st[i] === A.I && !iso[i]) { actx.moveTo(X(i) + rr, Y(i)); actx.arc(X(i), Y(i), rr, 0, 6.2832); }
        actx.fill(); actx.globalAlpha = 1;
      }
    }
    const pol = vel / 2;
    // u sítí velikost uzlu podle stupně (√ stupně vůči průměru) – huby bezškálové sítě jsou vidět
    const velUzlu = (i) => jeSit() ? Math.min(3, Math.max(0.7, Math.sqrt((sit.off[i + 1] - sit.off[i]) / Math.max(1, sit.stat.prumer)))) : 1;
    for (const s of [3, 4, 0, 1, 2]) {
      actx.fillStyle = barvy[s]; actx.beginPath();
      for (let i = 0; i < nn; i++) {
        if (st[i] !== s || (s === 2 && iso[i])) continue;
        if (jeSit()) { const r = pol * velUzlu(i); actx.moveTo(X(i) + r, Y(i)); actx.arc(X(i), Y(i), r, 0, 6.2832); }
        else actx.rect(X(i) - pol, Y(i) - pol, vel, vel);
      }
      actx.fill();
    }
    actx.strokeStyle = barvy[2]; actx.lineWidth = Math.max(1, vel / 3); actx.beginPath();
    for (let i = 0; i < nn; i++) if (st[i] === 2 && iso[i]) { actx.moveTo(X(i) + vel, Y(i)); actx.arc(X(i), Y(i), vel, 0, 6.2832); }
    actx.stroke();
    if ($('#kreslit-prenosy').checked) {
      actx.strokeStyle = barvy[2]; actx.lineWidth = 1.3;
      for (const p of sim.prenosy) {
        const stari = sim.t - p.t;
        if (stari > 1.5) continue;
        let x1, y1, x2, y2;
        if (jeSit()) { x1 = X(p.a); y1 = Y(p.a); x2 = X(p.b); y2 = Y(p.b); }
        else { if (Math.abs(p.x2 - p.x1) > 0.5 || Math.abs(p.y2 - p.y1) > 0.5) continue; x1 = p.x1 * w; y1 = p.y1 * h; x2 = p.x2 * w; y2 = p.y2 * h; }
        actx.globalAlpha = Math.max(0, 1 - stari / 1.5) * 0.9;
        actx.beginPath(); actx.moveTo(x1, y1); actx.lineTo(x2, y2); actx.stroke();
      }
      actx.globalAlpha = 1;
    }
    $('#arena-info').textContent = 'den ' + f(sim.t, 1) + (konecHlaska ? ' · ' + konecHlaska : '');
  }

  function grafy() {
    if (!sim) { gAg.nastav({ rady: [] }); gRt.nastav({ rady: [] }); gHist.nastav({ rady: [] }); return; }
    const z = sim.zaznam;
    const rady = [];
    const pridej = (id, kr, barva, data, odrData) => {
      rady.push({ id: 'a' + id, nazev: 'jedinci ' + kr, kratce: kr, barva, x: z.t, y: data, popisKonec: true, sirka: id === 'i' ? 2.5 : 2 });
      if (odr && odrData) rady.push({ id: 'o' + id, nazev: 'ODR ' + kr, kratce: 'ODR ' + kr, barva, x: odr.t, y: odrData, carky: [5, 4], sirka: 1.5, pruhlednost: 0.85 });
    };
    const c = odr && odr.celkem;
    pridej('s', 'S', '--c-s', z.S, c && c.S);
    if (n().latence) pridej('e', 'E', '--c-e', z.E, c && c.E);
    pridej('i', 'I', '--c-i', z.I, c && c.I.map((y, i) => y + c.A[i]));
    pridej('r', 'R', '--c-r', z.R, c && c.R);
    if (z.V && z.V.some(v => v > 0)) pridej('v', 'V', '--c-v', z.V, c && c.V);
    gAg.nastav({ rady, pasma: App.pasma(), maxX: n().dny, maxY: sim.n });
    const re = A.rtEmpiricky(sim);
    const emp = re.t.map((d, i) => re.uplna[i] ? re.hodnota[i] : NaN);
    const rt = [{ id: 'emp', nazev: 'empirické R (uzavřené kohorty)', kratce: 'R emp.', barva: '--c-i', x: re.t, y: emp, jenBody: true }];
    if (z.RtTeor) rt.unshift({ id: 'rt', nazev: 'teoretické Rₜ (homogenní)', kratce: 'Rₜ teor.', barva: '--c-rt', x: z.t, y: z.RtTeor });
    else if (odr) {
      const st = sit.stat, gamma = 1 / n().infekcni;
      const R0s = Sit.R0Site(st, sim.tau, gamma, n().rozdeleni === 'pevne').R0;
      rt.unshift({ id: 'rt', nazev: 'odhad R sítě · S/N (konfigurační model)', kratce: 'R síť', barva: '--c-rt', x: z.t, y: z.S.map(s => R0s * s / sim.n) });
    }
    gRt.nastav({ rady: rt, pasma: App.pasma(), hLinie: [{ y: 1, popis: 'R = 1' }], maxX: n().dny });
    // rozdělení počtu nákaz od zotavených (a stupňů sítě)
    const kmax = 25, cetn = new Array(kmax + 1).fill(0);
    let pocet = 0;
    for (let i = 0; i < sim.n; i++) if (sim.stav[i] === 3) { cetn[Math.min(kmax, sim.sekundarni[i])]++; pocet++; }
    const xs = cetn.map((_, i) => i);
    const hr = [];
    if (pocet) hr.push({ id: 'pot', nazev: `nákaz od jednoho zotaveného (n = ${fc(pocet)}, 25+ sloučeno)`, kratce: 'nákazy', barva: '--c-i', x: xs, y: cetn.map(x => x / pocet), body: true, sirka: 1.5 });
    if (jeSit() && sit) {
      const hst = sit.stat.hist, deg = xs.map(k => k < kmax ? (hst[k] || 0) / sim.n : hst.slice(kmax).reduce((a, b) => a + (b || 0), 0) / sim.n);
      hr.push({ id: 'deg', nazev: 'stupně uzlů v síti', kratce: 'stupeň', barva: '--c-s', x: xs, y: deg, carky: [4, 3], sirka: 1.5 });
    }
    $('#h-ag-hist').textContent = jeSit() ? 'Počet nákaz od jednoho nakaženého a stupně sítě' : 'Počet nákaz od jednoho nakaženého';
    gHist.nastav({ rady: hr, maxX: kmax, minY: 0 });
  }

  function dlazdice() {
    if (!sim) { $('#ag-dlazdice').innerHTML = ''; return; }
    const p = sim.pocet, nn = sim.n, z = sim.zaznam;
    let maxI = 0, denMax = 0;
    z.I.forEach((v, i) => { if (v > maxI) { maxI = v; denMax = z.t[i]; } });
    const kum = (sim.kumulativne != null ? sim.kumulativne : sim.kum) + Math.round(sim.par.I0);
    let h = box('Vnímaví S', fc(p[0]), fp(p[0] / nn), '--c-s');
    if (n().latence) h += box('Exponovaní E', fc(p[1]), fp(p[1] / nn), '--c-e');
    let isoN = 0; for (let i = 0; i < nn; i++) if (sim.iso[i]) isoN++;
    h += box('Infekční I', fc(p[2]), isoN ? fc(isoN) + ' v izolaci' : fp(p[2] / nn), '--c-i');
    h += box('Zotavení R', fc(p[3]), fp(p[3] / nn), '--c-r');
    if (p[4]) h += box('Očkovaní V', fc(p[4]), fp(p[4] / nn), '--c-v');
    h += box('Nakaženo celkem', fc(kum), fp(kum / nn) + ' · ODR ' + (odr ? fp((odr.celkem.kInf[odr.t.length - 1] + sim.par.I0) / nn) : '–'));
    h += box('Vrchol I zatím', fc(maxI), fd(denMax));
    if (jeSit() && sit) {
      const st = sit.stat, gamma = 1 / n().infekcni;
      const r = Sit.R0Site(st, sim.tau, gamma, n().rozdeleni === 'pevne');
      h += box('Síť', 'k̄ = ' + f(st.prumer, 2), `⟨k²⟩ = ${f(st.k2, 1)} · max ${st.max} · shlukování ${f(st.shluk, 3)}`);
      h += box('R₀ sítě (odhad)', f(r.R0, 2), `T = ${f(r.T, 3)} · homogenně ${f(sim.tau * st.prumer / gamma, 2)}`);
    } else {
      h += box('Dosah r', f(sim.r * 100, 2) + ' %', 'šířky světa · mřížka ' + sim.nc + '×' + sim.nc);
    }
    $('#ag-dlazdice').innerHTML = h;
  }

  $('#b-start').addEventListener('click', () => { if (bezi) zastav(); else spust(); });
  $('#b-krok').addEventListener('click', () => {
    if (!sim) reset();
    if (!sim || konec()) return;
    zastav();
    const cil = Math.floor(sim.t + 1e-9) + 1;
    while (sim.zaznam.t[sim.zaznam.t.length - 1] < cil && !konec()) krok();
    kresli(); grafy(); dlazdice();
  });
  $('#b-reset').addEventListener('click', reset);
  $('#b-seed').addEventListener('click', () => { n().seed = String(Math.floor(Math.random() * 1e6)); $('#seed').value = n().seed; App.ulozit(); reset(); });
  let casovac = 0;
  const planuj = () => { clearTimeout(casovac); casovac = setTimeout(() => { if (!$('#p-agenti').hidden) reset(); }, 250); };
  $('#seed').addEventListener('input', () => { n().seed = $('#seed').value; App.ulozit(); planuj(); });
  for (const [id, klic, min, max] of [['#agN', 'agN', 2, 50000], ['#agI0', 'agI0', 0, 50000]]) {
    $(id).addEventListener('input', () => {
      const v = Number($(id).value.replace(/\s/g, ''));
      if (!Number.isInteger(v) || v < min || v > max) { $(id).classList.add('chyba'); App.chyba('#ag-chyba', klic === 'agN' ? 'Počet jedinců: celé číslo 2–50 000.' : 'Nakažených na začátku: celé číslo 0–50 000.'); return; }
      $(id).classList.remove('chyba'); n()[klic] = v; App.ulozit(); planuj();
    });
  }
  $('#f-rozdeleni').addEventListener('change', (e) => { n().rozdeleni = e.target.value; App.ulozit(); planuj(); });
  $('#f-sitTyp').addEventListener('change', (e) => { n().sitTyp = e.target.value; App.ulozit(); App.viditelnostPoli(); planuj(); });
  document.querySelectorAll('[data-rezim]').forEach(b => b.addEventListener('click', () => { n().rezimAgentu = b.dataset.rezim; App.ulozit(); naplnit(); reset(); }));
  $('#kreslit-prenosy').addEventListener('change', kresli);
  $('#kreslit-dosah').addEventListener('change', kresli);
  new ResizeObserver(() => kresli()).observe(arena);
  new MutationObserver(() => kresli()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // ---------- opakované běhy ----------
  const gBehy = App.graf('g-behy', { vyska: 240, legenda: $('#leg-behy'), formatY: (y) => fp(y, 1), formatBublina: (y) => fp(y, 2), titulek: 'Opakované běhy jedinců' });
  let prerus = false;
  async function behy() {
    const par = App.parAgentu();
    try { if (jeSit()) pripravSit(par); else { const ch = A.overAgenty(par).chyby; if (ch.length) throw new Error(ch.join(' ')); } }
    catch (e) { App.chyba('#ag-chyba', e.message); return; }
    const kolik = Number($('#pocet-behu').value);
    prerus = false;
    $('#b-behy').disabled = true; $('#b-behy-stop').hidden = false; $('#behy-prubeh').hidden = false;
    const pruh = $('#behy-prubeh > div');
    const z0 = A.normalizujSeed(n().seed);
    const vysl = [];
    for (let k = 0; k < kolik; k++) {
      const seed = (z0 + k) >>> 0;
      const s = jeSit()
        ? Sit.vytvorEpidemii(sit, Object.assign(App.parModel(), { N: par.N, I0: par.I0, p: par.p, izolacePodil: par.izolacePodil, podilA: 0 }), { seed, superK: n().superK > 0 ? n().superK : Infinity, pevne: n().rozdeleni === 'pevne' })
        : A.vytvor(Object.assign({}, par, { seed }));
      let t0 = performance.now();
      const hotovo = () => (jeSit() ? Sit.skoncila(s) : A.skoncila(s)) || s.t >= n().dny - 1e-9;
      while (!hotovo()) {
        if (jeSit()) Sit.krok(s); else A.krok(s);
        if (performance.now() - t0 > 30) { pruh.style.width = ((k + s.t / n().dny) / kolik * 100).toFixed(1) + '%'; await App.pauza(); t0 = performance.now(); if (prerus) break; }
      }
      if (prerus) break;
      const z = s.zaznam;
      while (z.t[z.t.length - 1] < Math.round(n().dny)) { z.t.push(z.t[z.t.length - 1] + 1); z.I.push(0); }
      const kum = (s.kumulativne != null ? s.kumulativne : s.kum) + Math.round(par.I0);
      let mx = 0, dm = 0; z.I.forEach((v, i) => { if (v > mx) { mx = v; dm = z.t[i]; } });
      vysl.push({ seed, t: z.t, I: z.I.map(y => y / s.n), celkem: kum / s.n, maxI: mx / s.n, denMax: dm });
    }
    $('#b-behy').disabled = false; $('#b-behy-stop').hidden = true; $('#behy-prubeh').hidden = true;
    if (!vysl.length) { $('#behy-vysledek').innerHTML = '<p class="napoveda">Přerušeno.</p>'; return; }
    const o = M.simuluj(Object.assign(App.parModel(), { N: par.N, I0: par.I0, vek: false, kampanDavky: 0, importy: 0, krok: 0.1 }), { bezRt: true });
    const teor = (o.celkem.kInf[o.t.length - 1] + par.I0) / par.N;
    const hranice = Math.max(0.02, 0.1 * teor);
    const c = vysl.map(v => v.celkem);
    const vyhasle = c.filter(x => x < hranice).length;
    const velke = vysl.filter(v => v.celkem >= hranice);
    $('#behy-vysledek').innerHTML = '<div class="dlazdice">' +
      box('Celkem nakažených', fp(c.reduce((a, b) => a + b, 0) / c.length), 'průměr · rozsah ' + fp(Math.min(...c)) + '–' + fp(Math.max(...c))) +
      box('ODR pro srovnání', fp(teor), 'homogenní deterministický model') +
      box('Ohnisko brzy vyhaslo', vyhasle + ' z ' + vysl.length, 'méně než ' + fp(hranice, 0) + ' nakažených') +
      box('Vrchol I (velké běhy)', velke.length ? fp(velke.reduce((a, v) => a + v.maxI, 0) / velke.length) : '—', velke.length ? 'průměrně ' + fd(velke.reduce((a, v) => a + v.denMax, 0) / velke.length) : '') +
      `</div><p class="napoveda">Seedy ${vysl[0].seed}–${vysl[vysl.length - 1].seed}${jeSit() ? ' (síť je pro všechny běhy stejná, liší se jen průběh nákazy)' : ''}. Každý běh lze přehrát zadáním jeho seedu.</p>`;
    const rady = vysl.map((v, i) => ({ id: 'behy', nazev: 'jednotlivé běhy', bezLegendy: i > 0, bezBubliny: true, barva: '--c-i', x: v.t, y: v.I, sirka: 1, pruhlednost: 0.45 }));
    const prum = vysl[0].t.map((_, i) => vysl.reduce((a, v) => a + (v.I[i] || 0), 0) / vysl.length);
    rady.push({ id: 'prum', nazev: 'průměr běhů', barva: '--c-s', x: vysl[0].t, y: prum, sirka: 2.5 });
    rady.push({ id: 'odr', nazev: 'ODR', barva: '--text', x: o.t, y: o.celkem.I.map((y, i) => (y + o.celkem.A[i]) / par.N), carky: [6, 4], sirka: 1.5 });
    $('#g-behy').hidden = false; $('#leg-behy').hidden = false;
    gBehy.nastav({ rady, maxX: n().dny });
  }
  $('#b-behy').addEventListener('click', behy);
  $('#b-behy-stop').addEventListener('click', () => { prerus = true; });

  App.zalozky.agenti = {
    naplnit,
    aktivuj() { if (this.zastarale || !sim) { reset(); this.zastarale = false; } else { kresli(); if (rozl && rozlKroku < 250) requestAnimationFrame(rozkladej); } },
    deaktivuj() { zastav(); },
    zmena() { reset(); this.zastarale = false; }
  };
  App.agenti = { get sim() { return sim; }, spust, zastav, reset };
})();

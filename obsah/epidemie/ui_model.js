/* ============================================================
   epidemie/ui_model.js – záložka „Kompartmentový model“ (rozšířený ODR model).
   ============================================================ */
(function () {
  'use strict';
  const App = window.EpiApp, M = window.EpiModel, $ = App.$;
  const { f, fc, fp, fpa, fd, esc, box } = App;

  const g = App.graf('g-m', { vyska: 300, legenda: $('#leg-m'), titulek: 'Přihrádky modelu' });
  const gH = App.graf('g-m-hosp', { vyska: 220, legenda: $('#leg-m-hosp'), titulek: 'Obsazená lůžka a JIP' });
  const gD = App.graf('g-m-umrti', { vyska: 180, titulek: 'Úmrtí kumulativně' });
  const gRt = App.graf('g-m-rt', { vyska: 200, formatY: (y) => f(y, 2), desY: 3, titulek: 'Reprodukční číslo Rt' });
  const gInc = App.graf('g-m-inc', { vyska: 200, titulek: 'Denní toky' });
  let posledni = null;

  function rady(v, podil) {
    const c = v.celkem, x = v.t, N = v.par.N;
    const d = (a) => podil ? a.map(y => y / N) : a;
    const r = [{ id: 's', nazev: 'Vnímaví S', kratce: 'S', barva: '--c-s', x, y: d(c.S), popisKonec: true }];
    if (v.par.latence) r.push({ id: 'e', nazev: 'Exponovaní E', kratce: 'E', barva: '--c-e', x, y: d(c.E), popisKonec: true });
    if (v.par.podilA > 0) r.push({ id: 'a', nazev: 'Asymptomatičtí A', kratce: 'A', barva: '--c-a', x, y: d(c.A), popisKonec: true, carky: [6, 3] });
    r.push({ id: 'i', nazev: v.par.podilA > 0 ? 'Symptomatičtí I' : 'Infekční I', kratce: 'I', barva: '--c-i', x, y: d(c.I), popisKonec: true, sirka: 2.5 });
    r.push({ id: 'r', nazev: 'Zotavení R', kratce: 'R', barva: '--c-r', x, y: d(c.R), popisKonec: true });
    if (c.V.some(y => y > 1e-9)) r.push({ id: 'v', nazev: 'Očkovaní V', kratce: 'V', barva: '--c-v', x, y: d(c.V), popisKonec: true, carky: [2, 3] });
    return r;
  }

  function vykresli() {
    let v;
    try { v = M.simuluj(App.parModel()); }
    catch (e) { App.chyba('#m-chyba', e.message); return; }
    App.chyba('#m-chyba', '');
    posledni = v;
    const s = v.souhrn, N = v.par.N, c = v.celkem;
    const var_ = v.st.varovani.slice();
    if (s.bezi) var_.push(`Na konci simulace (den ${f(v.par.dny, 0)}) epidemie ještě probíhá – prodlužte délku simulace.`);
    $('#m-varovani').textContent = var_.join(' '); $('#m-varovani').hidden = !var_.length;
    let h = box('R₀', f(v.R0, 2), 'Rₜ(0) = ' + f(v.Rt[0], 2));
    h += box('Vrchol infekčních', fc(s.vrcholI.hodnota), fp(s.vrcholI.hodnota / N) + ' · den ' + f(s.vrcholI.t, 0), '--c-i');
    let teor = '';
    if (M.analytickaPlatnost(v.par)) teor = ' · teorie ' + fp(M.konecnaVelikostSkupin(v.par).celkem);
    h += box('Celkem nakažených', fp(s.podilNakazenych), fc(s.nakazeni) + ' osob' + teor, '--c-r');
    h += box('Nejvíc nových nákaz', fc(s.maxIncidence.hodnota) + '/den', fd(s.maxIncidence.t));
    h += box('Rₜ klesne pod 1', s.denRtPod1 == null ? 'nikdy' : fd(s.denRtPod1), v.par.imunitaDny > 0 ? 'u SEIRS může znovu stoupnout' : '');
    if (v.par.zavaznost) {
      h += box('Vrchol hospitalizovaných', fc(s.vrcholH.hodnota), fd(s.vrcholH.t) + (v.par.kapH > 0 ? ` · nad kapacitou ${s.dnyNadKapH} dní` : ''), '--c-h', s.dnyNadKapH > 0 ? 'varuj' : '');
      h += box('Vrchol JIP', fc(s.vrcholC.hodnota), fd(s.vrcholC.t) + (v.par.kapC > 0 ? ` · nad kapacitou ${s.dnyNadKapC} dní` : ''), '--c-c', s.dnyNadKapC > 0 ? 'varuj' : '');
      h += box('Úmrtí', fc(s.umrti), f(s.umrti / N * 1e5, 1) + ' na 100 tis. · IFR ' + fpa(s.umrti / Math.max(1, s.nakazeni)), '--c-d');
    }
    if (s.davky > 0) h += box('Podané dávky', fc(s.davky), fp(c.V[c.V.length - 1] / N) + ' chráněno na konci', '--c-v');
    $('#m-dlazdice').innerHTML = h;
    const podil = $('#m-podil').checked;
    g.v.logY = $('#m-log').checked;
    g.v.formatY = podil ? (y) => fp(y, y < 0.01 && y > 0 ? 3 : 1) : window.EpiGraf.zkratka;
    g.v.formatBublina = podil ? (y) => fpa(y) : null;
    const pasma = App.pasma();
    const vl = v.par.kampanDavky > 0 ? [{ x: v.par.kampanOd, popis: 'kampaň' }] : [];
    g.nastav({ rady: rady(v, podil), pasma, vLinie: vl, maxX: v.par.dny });
    $('#m-nemocnice').hidden = !v.par.zavaznost;
    if (v.par.zavaznost) {
      gH.nastav({
        rady: [
          { id: 'h', nazev: 'Hospitalizovaní (mimo JIP)', kratce: 'H', barva: '--c-h', x: v.t, y: c.H, popisKonec: true },
          { id: 'c', nazev: 'JIP', kratce: 'JIP', barva: '--c-c', x: v.t, y: c.C, popisKonec: true, sirka: 2.5 }
        ],
        hLinie: [
          ...(v.par.kapH > 0 ? [{ y: v.par.kapH, popis: 'kapacita lůžek', barva: '--c-h' }] : []),
          ...(v.par.kapC > 0 ? [{ y: v.par.kapC, popis: 'kapacita JIP', barva: '--c-c' }] : [])
        ], pasma, maxX: v.par.dny
      });
      gD.nastav({ rady: [{ id: 'd', nazev: 'Zemřelí kumulativně', kratce: 'D', barva: '--c-d', x: v.t, y: c.D }], pasma, maxX: v.par.dny });
    }
    gRt.nastav({ rady: [{ id: 'rt', nazev: 'Rₜ', barva: '--c-rt', x: v.t, y: v.Rt }], pasma, hLinie: [{ y: 1, popis: 'Rₜ = 1' }], maxX: v.par.dny });
    const co = $('#m-inc-co').value;
    const nazvy = { incidence: ['nové nákazy/den', '--c-i'], hospPrijmy: ['příjmy do nemocnic/den', '--c-h'], umrtiDen: ['úmrtí/den', '--c-d'] };
    const [naz, bar] = nazvy[co] || nazvy.incidence;
    gInc.nastav({ rady: [{ id: co, nazev: naz, barva: bar, x: v.t.slice(1), y: v[co].slice(1) }], pasma, maxX: v.par.dny });
    // kontrola přesnosti: poloviční krok
    try {
      const v2 = M.simuluj(Object.assign(App.parModel(), { krok: v.par.krok / 2 }), { bezRt: true });
      let m = 0; for (let i = 0; i < c.I.length; i++) m = Math.max(m, Math.abs(c.I[i] - v2.celkem.I[i]));
      const rel = m / Math.max(1, s.vrcholI.hodnota);
      $('#m-presnost').textContent = `Kontrola přesnosti RK4: s polovičním krokem (${f(v.par.krok / 2, 3)} dne) se I(t) liší nejvýš o ${f(m, m < 0.01 ? 6 : 3)} osob (${rel < 1e-3 ? 'zanedbatelné' : 'zkuste menší krok'}). Zachování N: ${f(Math.abs(s.zachovani - N), 6)} osob.`;
    } catch (e) { $('#m-presnost').textContent = ''; }
    vekovaCast(v);
    tabulka();
  }

  function barvaBunky(x, max) {
    const pct = max > 0 ? Math.round(Math.min(1, x / max) * 85) : 0;
    return `background: color-mix(in srgb, var(--accent) ${pct}%, var(--bg-panel)); color: ${pct > 50 ? 'var(--on-accent)' : 'var(--text)'}`;
  }
  function maticeHTML(K, skupiny, des) {
    let max = 0; K.forEach(r => r.forEach(x => { if (x > max) max = x; }));
    let h = '<table class="matice"><thead><tr><th scope="col"></th>' + skupiny.map(s => `<th scope="col">${esc(s)}</th>`).join('') + '</tr></thead><tbody>';
    K.forEach((r, i) => { h += `<tr><th scope="row">${esc(skupiny[i])}</th>` + r.map(x => `<td style="${barvaBunky(x, max)}">${f(x, des)}</td>`).join('') + '</tr>'; });
    return h + '</tbody></table>';
  }
  function vekovaCast(v) {
    $('#m-vek').hidden = !v.par.vek;
    if (!v.par.vek) return;
    const s = v.souhrn;
    const maxA = Math.max(...s.poSkupinach.map(q => q.nakazeni / q.N));
    let h = '<table><thead><tr><th>Věk</th><th>Obyvatel</th><th>Nakaženo</th><th class="pruh"></th>' + (v.par.zavaznost ? '<th>Hospitalizací</th><th>Úmrtí</th><th>IFR (model)</th>' : '') + (s.davky > 0 ? '<th>Dávek</th>' : '') + '</tr></thead><tbody>';
    s.poSkupinach.forEach((q, i) => {
      const a = q.nakazeni / q.N;
      h += `<tr><td>${esc(q.skupina)}</td><td>${fc(q.N)}</td><td>${fp(a)}</td><td class="pruh"><div class="pruh-v" style="width:${(a / maxA * 100).toFixed(1)}%; --b: var(--c-i)"></div></td>` +
        (v.par.zavaznost ? `<td>${fc(q.hosp)}</td><td>${fc(q.umrti)}</td><td>${fpa(v.st.ifrSkut[i])}</td>` : '') + (s.davky > 0 ? `<td>${fc(q.davky)}</td>` : '') + '</tr>';
    });
    $('#m-vek-tab').innerHTML = h + '</tbody></table>';
    const pr = $('#m-matice-prostredi').value;
    const C = pr === 'vse'
      ? v.st.matice.domov.map((r, i) => r.map((x, j) => M.PROSTREDI.reduce((a, k) => a + v.st.matice[k][i][j], 0)))
      : v.st.matice[pr];
    $('#m-matice').innerHTML = maticeHTML(C, v.st.skupiny, 2);
    const K = M.maticeDalsichGeneraci(v.par, v.st, 0, null, false);
    $('#m-ngm').innerHTML = maticeHTML(K, v.st.skupiny, 2) + `<p class="napoveda">ρ(K) = R₀ = ${f(v.R0, 3)}</p>`;
  }

  function tabulka() {
    const det = $('#m-tabulka').closest('details');
    if (!det.open || !posledni) return;
    const v = posledni, c = v.celkem;
    const zav = v.par.zavaznost;
    let h = `<table><thead><tr><th>Den</th><th>S</th><th>E</th><th>A</th><th>I</th><th>R</th><th>V</th>${zav ? '<th>H</th><th>JIP</th><th>D</th>' : ''}<th>Nové/den</th><th>Rₜ</th></tr></thead><tbody>`;
    for (let i = 0; i < v.t.length; i++) {
      h += `<tr><td>${f(v.t[i], 1)}</td><td>${fc(c.S[i])}</td><td>${fc(c.E[i])}</td><td>${fc(c.A[i])}</td><td>${fc(c.I[i])}</td><td>${fc(c.R[i])}</td><td>${fc(c.V[i])}</td>` +
        (zav ? `<td>${fc(c.H[i])}</td><td>${fc(c.C[i])}</td><td>${fc(c.D[i])}</td>` : '') + `<td>${fc(v.incidence[i])}</td><td>${f(v.Rt[i], 3)}</td></tr>`;
    }
    $('#m-tabulka').innerHTML = h + '</tbody></table>';
  }
  $('#m-tabulka').closest('details').addEventListener('toggle', tabulka);
  ['#m-log', '#m-podil', '#m-inc-co', '#m-matice-prostredi'].forEach(s => $(s).addEventListener('change', vykresli));
  $('#b-m-csv').addEventListener('click', () => {
    if (!posledni) return;
    App.stahni(`epidemie_model_R0-${f(posledni.R0, 2).replace(',', '_')}.csv`, '﻿' + M.csv(posledni), 'text/csv;charset=utf-8');
  });
  $('#b-m-scenar').addEventListener('click', () => {
    if (App.pridejScenar && App.pridejScenar('Scénář ' + (App.scenare().length + 1), App.nast)) Dialog.info('Přidáno do porovnání (' + App.scenare().length + '/4).');
  });

  App.zalozky.model = {
    aktivuj() { if (this.zastarale || !posledni) { vykresli(); this.zastarale = false; } },
    zmena() { vykresli(); this.zastarale = false; }
  };
  App.vysledekModelu = () => posledni;
})();

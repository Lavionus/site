/* ============================================================
   epidemie/ui_data.js – záložka „Analýza dat“: import incidence, Cori R_t, doba zdvojnásobení, fit SEIR.
   ============================================================ */
(function () {
  'use strict';
  const App = window.EpiApp, An = window.EpiAnalyza, S = window.EpiStoch, $ = App.$;
  const { f, fc, fp, box, esc } = App;
  const n = () => App.nast;
  const g = App.graf('g-da', { vyska: 260, legenda: $('#leg-da'), titulek: 'Denní případy' });
  const gR = App.graf('g-da-rt', { vyska: 220, legenda: $('#leg-da-rt'), formatY: (y) => f(y, 1), desY: 2, titulek: 'Odhad Rt podle Cori' });
  let data = null, fit = null;
  const cislo = (s) => Number(String(s).trim().replace(/\s/g, '').replace(',', '.'));

  function zdroj() {
    const z = $('#da-zdroj').value;
    $('#da-csv').hidden = z !== 'csv';
    $('#da-syn').hidden = z !== 'obnova';
    $('#b-da-gen').hidden = z === 'csv';
  }
  $('#da-zdroj').addEventListener('change', () => { zdroj(); if ($('#da-zdroj').value !== 'csv') generuj(); });

  function parSI() {
    const si = cislo($('#da-si').value), sd = cislo($('#da-sisd').value), okno = Math.round(cislo($('#da-okno').value));
    if (!(si > 0 && si < 60)) throw new Error('Průměr sériového intervalu musí být 0–60 dní.');
    if (!(sd > 0 && sd < 60)) throw new Error('Směrodatná odchylka sériového intervalu musí být 0–60 dní.');
    if (!(okno >= 1 && okno <= 60)) throw new Error('Okno odhadu musí být 1–60 dní.');
    return { si, sd, okno };
  }

  function generuj() {
    App.chyba('#da-chyba', '');
    try {
      const { si, sd } = parSI();
      const dny = Math.round(cislo($('#da-dny').value));
      if (!(dny >= 10 && dny <= 2000)) throw new Error('Počet dní musí být 10–2000.');
      if ($('#da-zdroj').value === 'obnova') {
        const r1 = cislo($('#da-r1').value), r2 = cislo($('#da-r2').value), zlom = Math.round(cislo($('#da-zlom').value));
        if (!(r1 >= 0 && r1 <= 20 && r2 >= 0 && r2 <= 20)) throw new Error('Rₜ musí být 0–20.');
        const Rt = (t) => t < zlom ? r1 : r2;
        const w = An.serioveRozdeleni(si, sd);
        const I = An.syntetickaObnova(Rt, w, dny, 10, n().seed);
        data = { dny: I.map((_, i) => i), pripady: I, datumy: null, skutecneRt: I.map((_, t) => Rt(t)), popis: `obnovovací proces, Rₜ = ${f(r1)} → ${f(r2)} od dne ${zlom}, seed ${esc(n().seed)}` };
      } else {
        const pevne = { N: n().N, c: n().c, inkubace: n().inkubace, infekcni: n().infekcni, latence: n().latence };
        const R0 = n().p * n().c * n().infekcni;
        const mu = An.modelIncidence(R0, Math.max(1, n().I0), pevne, dny);
        const rnd = window.EpiAgenti.mulberry32(window.EpiAgenti.normalizujSeed(n().seed));
        const I = mu.map(m => S.poisson(rnd, m));
        data = { dny: I.map((_, i) => i), pripady: I, datumy: null, skutecneRt: null, skutecneR0: R0, popis: `SEIR (R₀ = ${f(R0, 2)}, N = ${fc(n().N)}) + Poissonův šum, seed ${esc(n().seed)}` };
      }
      fit = null; $('#da-fit').textContent = '';
      $('#da-do').value = String(Math.min(data.dny.length - 1, 35)); $('#da-od').value = '10';
      analyzuj();
    } catch (e) { App.chyba('#da-chyba', e.message); }
  }
  $('#b-da-gen').addEventListener('click', generuj);

  function nacti(text) {
    App.chyba('#da-chyba', '');
    try {
      const r = An.nactiCSV(text);
      data = { dny: r.dny, pripady: r.pripady, datumy: r.datumy, skutecneRt: null, popis: 'vlastní data (' + r.pripady.length + ' dní)' };
      $('#da-varovani').textContent = r.varovani.join(' '); $('#da-varovani').hidden = !r.varovani.length;
      fit = null; $('#da-fit').textContent = '';
      $('#da-od').value = '0'; $('#da-do').value = String(Math.min(r.pripady.length - 1, 30));
      analyzuj();
    } catch (e) { App.chyba('#da-chyba', e.message); }
  }
  $('#b-da-nacti').addEventListener('click', () => nacti($('#da-text').value));
  $('#da-soubor').addEventListener('change', (e) => {
    const s = e.target.files && e.target.files[0]; if (!s) return;
    if (s.size > 5e6) { App.chyba('#da-chyba', 'Soubor je větší než 5 MB.'); return; }
    const r = new FileReader();
    r.onload = () => { $('#da-text').value = String(r.result).slice(0, 20000); nacti(String(r.result)); };
    r.onerror = () => App.chyba('#da-chyba', 'Soubor nelze přečíst.');
    r.readAsText(s);
  });

  function analyzuj() {
    if (!data) return;
    let si;
    try { si = parSI(); } catch (e) { App.chyba('#da-chyba', e.message); return; }
    App.chyba('#da-chyba', '');
    const w = An.serioveRozdeleni(si.si, si.sd);
    const c = An.cori(data.pripady, w, { okno: si.okno });
    const I = data.pripady, x = data.dny;
    const formatX = data.datumy ? (d) => { const s = data.datumy[Math.round(d)]; return s ? `${+s.slice(8, 10)}. ${+s.slice(5, 7)}.` : ''; } : null;
    g.v.formatX = formatX; gR.v.formatX = formatX;
    g.v.popisX = gR.v.popisX = data.datumy ? 'datum' : 'den';
    const celk = I.reduce((a, b) => a + b, 0);
    const posl = c.t.length - 1;
    let h = box('Data', fc(celk) + ' případů', data.popis);
    if (posl >= 0) {
      h += box('Rₜ na konci', f(c.prumer[posl], 2), `95% interval ${f(c.q025[posl], 2)}–${f(c.q975[posl], 2)}`, '--c-rt');
      const nad = c.t.filter((t, i) => c.q025[i] > 1).length, pod = c.t.filter((t, i) => c.q975[i] < 1).length;
      h += box('Dny jistě nad / pod 1', `${nad} / ${pod}`, 'celý 95% interval nad/pod 1');
    } else h += box('Rₜ', '—', 'málo případů pro odhad (potřeba ≥ 12 a celé okno)');
    if (data.skutecneRt && posl >= 0) {
      let chyba = 0, kryto = 0, pocet = 0;
      c.t.forEach((t, i) => { if (data.skutecneRt[t] == null) return; pocet++; chyba += Math.abs(c.prumer[i] - data.skutecneRt[t]); if (data.skutecneRt[t] >= c.q025[i] && data.skutecneRt[t] <= c.q975[i]) kryto++; });
      h += box('Pokrytí skutečného Rₜ', fp(kryto / pocet, 0), `průměrná odchylka ${f(chyba / pocet, 2)} (zpoždění okna!)`);
    }
    $('#da-dlazdice').innerHTML = h;
    const hx = [], hy = [], h0 = [];
    I.forEach((v, i) => { hx.push(i - 0.5, i + 0.5); hy.push(v, v); h0.push(0, 0); });
    const rady = [{ id: 'pr', nazev: 'hlášené případy', barva: '--c-s', x: hx, y: hy, y2: h0, pas: true, pruhlednost: 0.45 },
      { id: 'pr2', nazev: 'případy', bezLegendy: true, barva: '--c-s', x, y: I, sirka: 0.01, pruhlednost: 0.01 }];
    if (fit) rady.push({ id: 'fit', nazev: `fit SEIR (R₀ = ${f(fit.R0, 2)})`, barva: '--c-i', x: fit.fit.map((_, i) => i).slice(1), y: fit.fit.slice(1), sirka: 2.5 });
    g.nastav({ rady, minX: -0.5, maxX: x.length - 0.5, minY: 0 });
    const rr = [
      { id: 'ci', nazev: '95% interval', barva: '--c-rt', x: c.t, y: c.q975, y2: c.q025, pas: true, pruhlednost: 0.25 },
      { id: 'rt', nazev: 'Rₜ (Cori, aposteriorní průměr)', barva: '--c-rt', x: c.t, y: c.prumer, sirka: 2.5 }
    ];
    if (data.skutecneRt) rr.push({ id: 'sk', nazev: 'skutečné Rₜ (simulace)', barva: '--text', x, y: data.skutecneRt, carky: [6, 4], sirka: 1.5 });
    gR.nastav({ rady: rr, hLinie: [{ y: 1, popis: 'R = 1' }], minX: 0, maxX: x.length - 1, minY: 0 });
    zdvojeni();
  }
  ['#da-si', '#da-sisd', '#da-okno'].forEach(s => $(s).addEventListener('input', () => { clearTimeout(analyzuj.t); analyzuj.t = setTimeout(analyzuj, 300); }));

  function zdvojeni() {
    if (!data) return;
    const od = Math.round(cislo($('#da-od').value)), doD = Math.round(cislo($('#da-do').value));
    const r = An.dobaZdvojeni(data.pripady, od, doD);
    if (!r) { $('#da-zdv').textContent = 'V okně jsou méně než 3 dny s nenulovým počtem případů.'; return; }
    const ci = `95% interval r: ${f(r.rLo, 3)} až ${f(r.rHi, 3)} za den`;
    const doba = r.dobaLo == null ? 'interval obsahuje nulový růst – doba není určena' : `${r.rust ? 'doba zdvojnásobení' : 'poločas poklesu'} ${f(r.doba, 1)} dne (95% interval ${f(r.dobaLo, 1)}–${f(r.dobaHi, 1)})`;
    $('#da-zdv').textContent = `Dny ${od}–${doD} (n = ${r.n}): růstová rychlost r = ${f(r.r, 3)}/den, ${ci}; ${doba}.`;
  }
  $('#b-da-zdv').addEventListener('click', zdvojeni);

  $('#b-da-fit').addEventListener('click', () => {
    if (!data) return;
    const hl = cislo($('#da-hlaseni').value) / 100;
    if (!(hl > 0 && hl <= 1)) { App.chyba('#da-chyba', 'Podíl hlášených musí být 0–100 %.'); return; }
    const fd = $('#da-fitdo').value.trim() === '' ? data.pripady.length : Math.round(cislo($('#da-fitdo').value)) + 1;
    if (!(fd >= 5)) { App.chyba('#da-chyba', 'Fit potřebuje aspoň 5 dní.'); return; }
    const d = data.pripady.slice(0, fd);
    $('#da-fit').textContent = 'Počítám…';
    setTimeout(() => {
      try {
        const pevne = { N: n().N, c: n().c, inkubace: n().inkubace, infekcni: n().infekcni, latence: n().latence, hlaseni: hl };
        if (d.reduce((a, b) => a + b, 0) > pevne.N * hl) throw new Error('Případů je víc než populace N × hlášený podíl – zvětšete N vlevo.');
        const t0 = performance.now();
        fit = An.fitujSEIR(d, pevne);
        const ci = fit.ciR0.map(x => x == null ? '?' : f(x, 2));
        $('#da-fit').innerHTML = `R₀ = <b>${f(fit.R0, 2)}</b> (95% profilový interval ${ci[0]}–${ci[1]}), nakažených na začátku ${f(fit.I0, 1)}, ` +
          `log-věrohodnost ${f(fit.logVer, 1)}. Pevné: N = ${fc(pevne.N)}, latence ${pevne.latence ? f(pevne.inkubace, 1) + ' d' : 'žádná'}, infekční období ${f(pevne.infekcni, 1)} d, hlášeno ${fp(hl, 0)}. ` +
          (data.skutecneR0 ? `Skutečné R₀ dat: ${f(data.skutecneR0, 2)}. ` : '') + `Výpočet ${f((performance.now() - t0) / 1000, 2)} s.`;
        analyzuj();
      } catch (e) { $('#da-fit').textContent = ''; App.chyba('#da-chyba', e.message); }
    }, 20);
  });

  App.zalozky.data = {
    aktivuj() { zdroj(); if (!data) generuj(); },
    zmena() { if ($('#da-zdroj').value === 'seir' && data) generuj(); }
  };
  App.data = { get data() { return data; }, nacti };
})();

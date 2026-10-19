/* ============================================================
   epidemie/ui_porovnani.js – záložka „Porovnání“: až 4 scénáře rozšířeného modelu vedle sebe.
   ============================================================ */
(function () {
  'use strict';
  const App = window.EpiApp, M = window.EpiModel, Graf = window.EpiGraf, $ = App.$;
  const { f, fc, fp, fpa, esc } = App;
  const gI = App.graf('g-por', { vyska: 260, legenda: $('#leg-por'), formatY: (y) => fp(y, 1), formatBublina: (y) => fpa(y), titulek: 'Infekční ve scénářích' });
  const gC = App.graf('g-por-jip', { vyska: 220, formatY: (y) => f(y, 1), titulek: 'JIP na 100 000 obyvatel ve scénářích' });
  const CARKY = [null, [8, 4], [3, 3], [10, 3, 2, 3]];
  let scenare = App.cti('scenare2');
  if (!Array.isArray(scenare)) scenare = [];
  const uloz = () => App.zapis('scenare2', scenare);
  App.scenare = () => scenare;

  function popis(n) {
    const c = [];
    c.push((n.latence ? 'SEIR' : 'SIR') + (n.imunitaDny > 0 ? 'S' : '') + (n.vek ? ', věk' : ''));
    try { c.push('R₀ = ' + f(M.R0(App.parModel(n)), 2)); } catch (e) { /* neplatné */ }
    if (n.podilA > 0) c.push('asympt. ' + fp(n.podilA, 0));
    (n.zasahy || []).forEach(z => c.push(`${M.NAZVY_PROSTREDI[z.typ]} −${Math.round(z.sila * 100)} % (${f(z.od, 0)}–${f(z.do, 0)})`));
    if (n.ockovaniPodil > 0) c.push('očkováno ' + fp(n.ockovaniPodil, 0));
    if (n.kampanDavky100k > 0) c.push(`kampaň ${f(n.kampanDavky100k)}/100 tis./den (${M.PRIORITY[n.kampanPriorita]})`);
    if (n.izolacePodil > 0) c.push(`izolace ${fp(n.izolacePodil, 0)} po ${f(n.izolaceZpozdeni)} d`);
    return c.join(' · ');
  }
  function volnaBarva() { for (let b = 0; b < 4; b++) if (!scenare.some(s => s.barva === b)) return b; return 0; }
  App.pridejScenar = (nazev, n) => {
    if (scenare.length >= 4) { Dialog.info('Porovnat lze nejvýš 4 scénáře – nejdřív některý odeberte.'); return false; }
    scenare.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), nazev, nast: JSON.parse(JSON.stringify(n)), barva: volnaBarva() });
    uloz();
    if (App.aktivni === 'porovnani') vykresli();
    return true;
  };
  const bez = (n) => App.bezZasahu(JSON.parse(JSON.stringify(n)));
  const celaDoba = (n, typ, sila) => Object.assign(bez(n), { zasahy: sila > 0 ? [{ typ, od: 0, do: n.dny, sila }] : [] });
  const EXPERIMENTY = {
    omezeni: (n) => [0, 0.25, 0.5, 0.75].map(m => [m ? 'Kontakty −' + fp(m, 0) : 'Bez omezení', celaDoba(n, 'vse', m)]),
    prostredi: (n) => [['Bez zásahu', bez(n)],
      ['Zavřené školy (dny 20–80)', Object.assign(bez(n), { zasahy: [{ typ: 'skola', od: 20, do: 80, sila: 1 }] })],
      ['Práce z domova −50 % (20–80)', Object.assign(bez(n), { zasahy: [{ typ: 'prace', od: 20, do: 80, sila: 0.5 }] })],
      ['Volný čas −50 % (20–80)', Object.assign(bez(n), { zasahy: [{ typ: 'ostatni', od: 20, do: 80, sila: 0.5 }] })]],
    ockovani: (n) => [0, 0.3, 0.5, 0.7].map(v => [v ? 'Očkováno ' + fp(v, 0) : 'Bez očkování', Object.assign(bez(n), { ockovaniPodil: v, ucinnost: 1 })]),
    priorita: (n) => ['nejstarsi', 'nejmladsi', 'kontakty', 'rovnomerne'].map(p => ['Kampaň: ' + M.PRIORITY[p], Object.assign(bez(n), { vek: true, zavaznost: true, kampanDavky100k: 600, kampanOd: 0, kampanUcast: 0.8, kampanPriorita: p, ucinnost: 0.9 })]),
    izolace: (n) => [0, 1, 2, 4].map(d => ['Izolace 60 % po ' + f(d) + ' d', Object.assign(bez(n), { izolacePodil: 0.6, izolaceZpozdeni: d })]),
    asympt: (n) => [0, 0.2, 0.4, 0.6].map(a => ['Asymptomatických ' + fp(a, 0), Object.assign(bez(n), { podilA: a, rA: 0.5, izolacePodil: 0.6, izolaceZpozdeni: 1 })]),
    nacasovani: (n) => [10, 30, 50, 70].map(d => ['Omezení od dne ' + d, Object.assign(bez(n), { zasahy: [{ typ: 'vse', od: d, do: d + 30, sila: 0.5 }] })]),
    imunita: (n) => [0, 365, 182, 91].map(d => [d ? 'Imunita ~' + f(d) + ' dní' : 'Trvalá imunita', Object.assign(bez(n), { imunitaDny: d, dny: Math.max(n.dny, 1095) })])
  };
  App.EXPERIMENTY = EXPERIMENTY;

  function metriky(sc) {
    const v = M.simuluj(App.parModel(sc.nast), {});
    return { v, s: v.souhrn, N: v.par.N };
  }
  function vykresli() {
    const kont = $('#scenare');
    Graf.uklid();
    if (!scenare.length) {
      kont.innerHTML = '<div class="prazdne" style="grid-column:1/-1">Zatím žádný scénář. Přidejte aktuální nastavení, nebo vyberte připravený experiment (vytvoří 4 scénáře z aktuálních parametrů nákazy).</div>';
      $('#por-grafy').hidden = true; return;
    }
    let m;
    try { m = scenare.map(metriky); } catch (e) { kont.innerHTML = `<div class="chybovy">${esc(e.message)}</div>`; return; }
    const zav = m.some(q => q.v.par.zavaznost);
    kont.innerHTML = scenare.map((sc, i) => {
      const { s, v, N } = m[i];
      return `<article class="scenar" style="--sb: var(--c-${sc.barva + 1})" data-id="${sc.id}">
        <h4><span>${String.fromCharCode(65 + i)} · ${esc(sc.nazev)}</span><span class="tlacitka" style="margin:0; flex-wrap:nowrap">
          <button type="button" class="male" data-akce="nacti" title="Načíst parametry do formuláře">Načíst</button>
          <button type="button" class="male" data-akce="prejmenuj" aria-label="Přejmenovat scénář" title="Přejmenovat">✎</button>
          <button type="button" class="male" data-akce="odeber" aria-label="Odebrat scénář" title="Odebrat">✕</button></span></h4>
        <div class="popis-par">${esc(popis(sc.nast))}</div>
        <canvas class="graf" data-mini="${sc.id}"></canvas>
        <dl><dt>Vrchol infekčních</dt><dd>${fp(s.vrcholI.hodnota / N)} · den ${f(s.vrcholI.t, 0)}</dd>
          <dt>Celkem nakažených</dt><dd>${fp(s.podilNakazenych)}</dd>
          <dt>Rₜ na začátku</dt><dd>${f(v.Rt[0], 2)}</dd>
          ${v.par.zavaznost ? `<dt>Vrchol JIP</dt><dd>${f(s.vrcholC.hodnota / N * 1e5, 1)}/100 tis.${v.par.kapC > 0 ? ` · ${s.dnyNadKapC} d nad kap.` : ''}</dd><dt>Úmrtí</dt><dd>${f(s.umrti / N * 1e5, 1)}/100 tis.</dd>` : ''}
          ${s.davky > 0 ? `<dt>Dávek</dt><dd>${fc(s.davky)}</dd>` : ''}</dl></article>`;
    }).join('');
    const maxDny = Math.max(...m.map(q => q.v.par.dny));
    scenare.forEach((sc, i) => {
      const g = new Graf(kont.querySelector(`canvas[data-mini="${sc.id}"]`), { vyska: 120, formatY: (y) => fp(y, 0), formatBublina: (y) => fpa(y), titulek: 'Průběh scénáře ' + sc.nazev });
      const v = m[i].v, c = v.celkem, N = m[i].N, x = v.t;
      g.nastav({ rady: [
        { id: 's', nazev: 'S', barva: '--c-s', x, y: c.S.map(y => y / N) },
        { id: 'i', nazev: 'I + A', barva: '--c-i', x, y: c.I.map((y, k) => (y + c.A[k]) / N), sirka: 2.5 },
        { id: 'r', nazev: 'R', barva: '--c-r', x, y: c.R.map(y => y / N) },
        ...(c.V.some(y => y > 0) ? [{ id: 'v', nazev: 'V', barva: '--c-v', x, y: c.V.map(y => y / N), carky: [2, 3] }] : [])
      ], pasma: App.pasma(sc.nast).map(p => Object.assign(p, { popis: '' })), maxX: maxDny, maxY: 1 });
    });
    $('#por-grafy').hidden = false;
    const rI = [], rC = [];
    scenare.forEach((sc, i) => {
      const { v, N } = m[i], c = v.celkem;
      const spol = { kratce: String.fromCharCode(65 + i), barva: '--c-' + (sc.barva + 1), carky: CARKY[sc.barva], sirka: 2.5, popisKonec: true, x: v.t };
      rI.push(Object.assign({ id: sc.id, nazev: String.fromCharCode(65 + i) + ' · ' + sc.nazev, y: c.I.map((y, k) => (y + c.A[k]) / N) }, spol));
      if (v.par.zavaznost) rC.push(Object.assign({ id: sc.id, nazev: sc.nazev, y: c.C.map(y => y / N * 1e5) }, spol));
    });
    gI.nastav({ rady: rI, maxX: maxDny });
    $('#g-por-jip').hidden = !zav; $('#g-por-jip').previousElementSibling.hidden = !zav;
    const kapC = m.find(q => q.v.par.kapC > 0);
    if (zav) gC.nastav({ rady: rC, maxX: maxDny, hLinie: kapC ? [{ y: kapC.v.par.kapC / kapC.N * 1e5, popis: 'kapacita JIP' }] : [] });
    let t = '<table><thead><tr><th>Scénář</th><th>R₀</th><th>Rₜ(0)</th><th>Vrchol I+A</th><th>Den vrcholu</th><th>Celkem nakažených</th>' + (zav ? '<th>Vrchol JIP /100 tis.</th><th>Úmrtí /100 tis.</th>' : '') + '</tr></thead><tbody>';
    scenare.forEach((sc, i) => {
      const { s, v, N } = m[i];
      t += `<tr><td>${String.fromCharCode(65 + i)} · ${esc(sc.nazev)}</td><td>${f(v.R0, 2)}</td><td>${f(v.Rt[0], 2)}</td><td>${fp(s.vrcholI.hodnota / N)}</td><td>${f(s.vrcholI.t, 0)}</td><td>${fp(s.podilNakazenych)}</td>` +
        (zav ? `<td>${v.par.zavaznost ? f(s.vrcholC.hodnota / N * 1e5, 1) : '–'}</td><td>${v.par.zavaznost ? f(s.umrti / N * 1e5, 1) : '–'}</td>` : '') + '</tr>';
    });
    $('#por-tabulka').innerHTML = t + '</tbody></table>';
  }

  $('#b-pridat').addEventListener('click', () => App.pridejScenar('Scénář ' + (scenare.length + 1), App.nast));
  $('#experiment').addEventListener('change', async (e) => {
    const typ = e.target.value; e.target.value = '';
    if (!typ) return;
    if (scenare.length && !(await Dialog.potvrd('Experiment nahradí současné scénáře. Pokračovat?'))) return;
    scenare = [];
    for (const [nazev, n] of EXPERIMENTY[typ](App.nast)) scenare.push({ id: Math.random().toString(36).slice(2, 10), nazev, nast: n, barva: scenare.length });
    uloz(); vykresli();
  });
  $('#b-vycistit').addEventListener('click', async () => {
    if (!scenare.length || !(await Dialog.potvrd('Smazat všechny scénáře?'))) return;
    scenare = []; uloz(); vykresli();
  });
  $('#scenare').addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-akce]'); if (!b) return;
    const sc = scenare.find(s => s.id === b.closest('[data-id]').dataset.id); if (!sc) return;
    if (b.dataset.akce === 'odeber') { scenare = scenare.filter(s => s !== sc); uloz(); vykresli(); }
    else if (b.dataset.akce === 'prejmenuj') {
      const t = await Dialog.zeptej('Název scénáře', sc.nazev);
      if (t && t.trim()) { sc.nazev = t.trim().slice(0, 60); uloz(); vykresli(); }
    } else {
      App.nast = Object.assign({}, App.VYCHOZI, JSON.parse(JSON.stringify(sc.nast)));
      App.osaVybrany = -1; App.naplnFormular(); App.kresliOsu(); App.editorOsy(); App.zmena('vse', true);
      Dialog.info('Parametry scénáře „' + sc.nazev + '“ načteny.');
    }
  });

  App.zalozky.porovnani = { aktivuj() { vykresli(); }, zmena() { /* scénáře jsou uložené zvlášť */ } };
  App.porovnani = { vykresli };
})();

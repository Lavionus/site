/* ============================================================
   tco/grafy.js – konfigurace grafů Chart.js 3.9 pro kalkulátor TCO.
   Barvy variant: pevné pořadí kategorií (ověřená paleta pro barvoslepé),
   zvlášť pro světlé a tmavé téma. Text nese barvy textu, ne barvy řad.
   ============================================================ */
(function () {
  'use strict';
  const SERIE = {
    light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300'],
    dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300']
  };
  const VZOR_CAR = [[], [6, 4], [2, 3], [10, 3, 2, 3], [1, 2], [8, 2]];  // druhé kódování řad (nejen barva)
  const KAT_BARVY = {
    light: { porizeni: '#2a78d6', splatky: '#6250d6', energie: '#eda100', servis: '#eb6834', material: '#1baf7a', ostatni: '#8a8a86', zustatek: '#e87ba4' },
    dark: { porizeni: '#3987e5', splatky: '#9085e9', energie: '#c98500', servis: '#d95926', material: '#199e70', ostatni: '#8a8a86', zustatek: '#d55181' }
  };

  function paleta(tema) {
    const cs = getComputedStyle(document.documentElement);
    const v = (n, z) => (cs.getPropertyValue(n) || '').trim() || z;
    if (tema === 'tisk') return { tema: 'light', serie: SERIE.light, kat: KAT_BARVY.light, text: '#24292f', muted: '#4b535b', mrizka: '#dde1e6', povrch: '#ffffff' };
    const t = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    return { tema: t, serie: SERIE[t], kat: KAT_BARVY[t], text: v('--text', '#e0e0e0'), muted: v('--text-muted', '#b0b0b0'),
             mrizka: t === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)', povrch: v('--bg-panel', '#242424') };
  }

  const nf0 = new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 0 });
  const nf2 = new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  const kc = x => (Math.abs(x) < 100 && x !== 0 ? nf2.format(x) : nf0.format(x)) + ' Kč';
  const kcOsa = x => {
    const a = Math.abs(x);
    if (a >= 1e6) return new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 2 }).format(x / 1e6) + ' mil.';
    if (a >= 1e4) return nf0.format(x / 1e3) + ' tis.';
    return nf0.format(x);
  };
  const mesicText = m => {
    const r = Math.floor(m / 12), mm = m - r * 12;
    return (r ? r + ' r. ' : '') + new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 1 }).format(mm) + ' m.';
  };

  function zaklad(P, extra) {
    const o = {
      responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: 'nearest', intersect: false },
      plugins: {
        legend: { labels: { color: P.text, boxWidth: 14, usePointStyle: true, font: { size: 12 } } },
        tooltip: { backgroundColor: P.tema === 'light' ? '#ffffff' : '#2d2d2d', titleColor: P.text, bodyColor: P.text,
                   borderColor: P.mrizka, borderWidth: 1, padding: 9 }
      },
      scales: {}
    };
    return Object.assign(o, extra || {});
  }
  const osa = (P, titul, extra) => Object.assign({
    ticks: { color: P.muted, font: { size: 11 } }, grid: { color: P.mrizka, drawBorder: false },
    title: titul ? { display: true, text: titul, color: P.muted, font: { size: 11 } } : undefined
  }, extra || {});

  /** Náklady v čase: 'kum' = kumulativní čáry s body zvratu, 'roky' = sloupce po letech. */
  function konfigCas(R, typ, P) {
    const disk = R.g.rezim === 'diskontovane';
    const H = R.H;
    if (typ === 'roky') {
      const roku = Math.ceil(H / 12), labels = [];
      for (let r = 1; r <= roku; r++) labels.push(String(r));
      const ds = R.vysledky.map((v, i) => {
        const data = new Array(roku).fill(0), t = v.horizont.toky.celkem, s = R.sazby.nominalni;
        for (let m = 0; m <= H; m++) { const r = Math.max(0, Math.ceil(m / 12) - 1); data[r] += disk ? t[m] * Math.pow(1 + s, -m / 12) : t[m]; }
        return { label: v.nazev, data, backgroundColor: P.serie[i % 6], borderColor: P.povrch, borderWidth: 1, borderRadius: 3, maxBarThickness: 26 };
      });
      return { type: 'bar', data: { labels, datasets: ds }, options: zaklad(P, {
        interaction: { mode: 'index', intersect: false },
        plugins: Object.assign(zaklad(P).plugins, { tooltip: Object.assign(zaklad(P).plugins.tooltip, {
          callbacks: { title: it => 'Rok ' + it[0].label, label: c => ' ' + c.dataset.label + ': ' + kc(c.parsed.y) } }) }),
        scales: { x: osa(P, 'rok vlastnictví', { grid: { display: false } }), y: osa(P, disk ? 'Kč (současná hodnota)' : 'Kč (nominálně)', { ticks: { color: P.muted, callback: kcOsa } }) }
      }) };
    }
    const ds = R.vysledky.map((v, i) => {
      const k = disk ? v.horizont.kumPV : v.horizont.kum, data = [];
      for (let m = 0; m <= H; m++) data.push({ x: m / 12, y: k[m] });
      return { label: v.nazev, data, borderColor: P.serie[i % 6], backgroundColor: P.serie[i % 6], borderWidth: 2,
               borderDash: VZOR_CAR[i % 6], pointRadius: 0, pointHoverRadius: 4, stepped: false, tension: 0 };
    });
    const body = [];
    for (const b of R.body) for (const p of b.prusecky) {
      const A = disk ? R.vysledky[b.a].horizont.kumPV : R.vysledky[b.a].horizont.kum;
      const m0 = Math.floor(p.mesic), f = p.mesic - m0;
      const y = A[m0] + (m0 + 1 < A.length ? (A[m0 + 1] - A[m0]) * f : 0);
      body.push({ x: p.mesic / 12, y, popis: R.vysledky[b.a].nazev + ' = ' + R.vysledky[b.b].nazev, mesic: p.mesic });
    }
    if (body.length) ds.push({ label: 'Bod zvratu', type: 'scatter', data: body, pointStyle: 'rectRot', pointRadius: 7, pointHoverRadius: 9,
      backgroundColor: P.text, borderColor: P.povrch, borderWidth: 2 });
    return { type: 'line', data: { datasets: ds }, options: zaklad(P, {
      parsing: false,
      plugins: Object.assign(zaklad(P).plugins, { tooltip: Object.assign(zaklad(P).plugins.tooltip, {
        callbacks: {
          title: it => it.length ? (it[0].raw.mesic != null ? 'Bod zvratu v ' + mesicText(it[0].raw.mesic) : mesicText(Math.round(it[0].parsed.x * 12))) : '',
          label: c => c.raw.popis ? ' ' + c.raw.popis + ': ' + kc(c.parsed.y) : ' ' + c.dataset.label + ': ' + kc(c.parsed.y)
        } }) }),
      scales: {
        x: osa(P, 'roky od pořízení', { type: 'linear', min: 0, max: H / 12, ticks: { color: P.muted, stepSize: H > 240 ? 5 : (H > 72 ? 2 : 1) } }),
        y: osa(P, disk ? 'kumulativně, Kč (současná hodnota)' : 'kumulativně, Kč (nominálně)', { ticks: { color: P.muted, callback: kcOsa } })
      }
    }) };
  }

  /** Struktura nákladů za vlastní životnost (skládané vodorovné sloupce). */
  function konfigStruktura(R, P, TCO) {
    const disk = R.g.rezim === 'diskontovane';
    const labels = R.vysledky.map(v => v.nazev);
    const ds = TCO.KATEGORIE.map(k => ({
      label: TCO.NAZVY_KATEGORII[k], backgroundColor: P.kat[k], borderColor: P.povrch, borderWidth: 1, borderSkipped: false,
      data: R.vysledky.map(v => (disk ? v.strukturaPV : v.struktura)[k]), maxBarThickness: 30
    })).filter(d => d.data.some(x => Math.abs(x) > 0.5));
    return { type: 'bar', data: { labels, datasets: ds }, options: zaklad(P, {
      indexAxis: 'y',
      interaction: { mode: 'nearest', intersect: true },
      plugins: Object.assign(zaklad(P).plugins, { tooltip: Object.assign(zaklad(P).plugins.tooltip, {
        callbacks: { label: c => ' ' + c.dataset.label + ': ' + kc(c.parsed.x) } }) }),
      scales: {
        x: osa(P, disk ? 'Kč (současná hodnota)' : 'Kč (nominálně)', { stacked: true, ticks: { color: P.muted, callback: kcOsa } }),
        y: osa(P, '', { stacked: true, grid: { display: false }, ticks: { color: P.text, font: { size: 12 }, callback: function (v) { const s = this.getLabelForValue(v); return s.length > 22 ? s.slice(0, 21) + '…' : s; } } })
      }
    }) };
  }

  /** Tornádo: plovoucí sloupce od základní hodnoty k hodnotě při −Δ a +Δ. */
  function konfigTornado(c, P, formatHodnoty, popisZmeny) {
    const labels = c.polozky.map(p => p.nazev + ' ' + popisZmeny(p));
    const minus = c.polozky.map(p => [c.zaklad, p.nizka]), plus = c.polozky.map(p => [c.zaklad, p.vysoka]);
    const vse = [c.zaklad].concat(...c.polozky.map(p => [p.nizka, p.vysoka])).filter(isFinite);
    const lo = Math.min(...vse), hi = Math.max(...vse), okraj = Math.max((hi - lo) * 0.08, Math.abs(c.zaklad) * 0.01, 1e-6);
    return { type: 'bar', data: { labels, datasets: [
      { label: 'Parametr snížen', data: minus, backgroundColor: P.serie[0], borderColor: P.povrch, borderWidth: 1, borderSkipped: false, maxBarThickness: 24, grouped: false },
      { label: 'Parametr zvýšen', data: plus, backgroundColor: P.serie[1], borderColor: P.povrch, borderWidth: 1, borderSkipped: false, maxBarThickness: 24, grouped: false }
    ] }, options: zaklad(P, {
      indexAxis: 'y',
      interaction: { mode: 'nearest', intersect: true },
      plugins: Object.assign(zaklad(P).plugins, { tooltip: Object.assign(zaklad(P).plugins.tooltip, {
        callbacks: { label: ctx => { const [a, b] = ctx.raw; return ' ' + ctx.dataset.label + ': ' + formatHodnoty(b) + ' (změna ' + (b - a >= 0 ? '+' : '−') + formatHodnoty(Math.abs(b - a)) + ')'; } } }) }),
      scales: {
        x: osa(P, 'základ: ' + formatHodnoty(c.zaklad), { beginAtZero: false, suggestedMin: lo - okraj, suggestedMax: hi + okraj, ticks: { color: P.muted, callback: v => Math.abs(c.zaklad) < 1000 ? new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 2 }).format(v) : kcOsa(v) } }),
        y: osa(P, '', { grid: { display: false }, ticks: { color: P.text, font: { size: 11 } } })
      }
    }) };
  }

  /** Průběh ukazatele všech variant při změně parametru. */
  function konfigPrubeh(p, nazvy, P, formatHodnoty, popisOsy) {
    const ds = nazvy.map((n, i) => ({
      label: n, data: p.xs.map((x, j) => ({ x: x * 100, y: p.ys[i][j] })), borderColor: P.serie[i % 6], backgroundColor: P.serie[i % 6],
      borderWidth: 2, borderDash: VZOR_CAR[i % 6], pointRadius: 0, pointHoverRadius: 4
    }));
    return { type: 'line', data: { datasets: ds }, options: zaklad(P, {
      parsing: false,
      interaction: { mode: 'index', intersect: false },
      plugins: Object.assign(zaklad(P).plugins, { tooltip: Object.assign(zaklad(P).plugins.tooltip, {
        callbacks: { title: it => it.length ? 'Změna ' + (it[0].parsed.x > 0 ? '+' : '') + Math.round(it[0].parsed.x) + ' %' : '',
                     label: c => ' ' + c.dataset.label + ': ' + formatHodnoty(c.parsed.y) } }) }),
      scales: {
        x: osa(P, popisOsy, { type: 'linear', ticks: { color: P.muted, callback: v => (v > 0 ? '+' : '') + v + ' %' } }),
        y: osa(P, '', { ticks: { color: P.muted, callback: v => Math.abs(v) < 1000 ? new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 2 }).format(v) : kcOsa(v) } })
      }
    }) };
  }

  window.TCO_GRAFY = { paleta, konfigCas, konfigStruktura, konfigTornado, konfigPrubeh, kc, mesicText, SERIE };
})();

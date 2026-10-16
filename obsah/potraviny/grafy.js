/* ============================================================
   potraviny/grafy.js – jednoduché SVG grafy pro Deník jídla.
   Barvy berou z CSS proměnných (světlý i tmavý motiv), takže se
   po přepnutí motivu stačí překreslit. Bez knihoven.
     DENIK_GRAFY.kruh(el, hodnota, cil, {popis})
     DENIK_GRAFY.sloupce(el, [{k, v, popis}], {cil, jednotka})
     DENIK_GRAFY.cara(el, [{k, v}], {trend:true, jednotka})
     DENIK_GRAFY.kolac(el, [{v, barva, popis}])
   ============================================================ */
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';

  function el(nazev, atr, rodic) {
    const e = document.createElementNS(NS, nazev);
    for (const k in atr) e.setAttribute(k, atr[k]);
    if (rodic) rodic.appendChild(e);
    return e;
  }
  function txt(rodic, x, y, text, atr) {
    const t = el('text', Object.assign({ x, y }, atr || {}), rodic);
    t.textContent = text;
    return t;
  }
  function fmt(v, d) {
    return Number.isFinite(v) ? v.toLocaleString('cs-CZ', { maximumFractionDigits: d || 0 }) : '–';
  }

  // prstenec: snědeno / cíl
  function kruh(kontejner, hodnota, cil, volby) {
    volby = volby || {};
    kontejner.innerHTML = '';
    const r = 52, obvod = 2 * Math.PI * r;
    const svg = el('svg', { viewBox: '0 0 128 128', class: 'graf-kruh', role: 'img',
      'aria-label': (volby.popis || 'Energie') + ': ' + fmt(hodnota) + (cil ? ' z ' + fmt(cil) : '') }, kontejner);
    el('circle', { cx: 64, cy: 64, r, class: 'kruh-pozadi' }, svg);
    if (cil > 0) {
      const podil = Math.max(0, hodnota / cil);
      const hlavni = Math.min(1, podil);
      el('circle', { cx: 64, cy: 64, r, class: 'kruh-hodnota' + (podil > 1.05 ? ' nad' : ''),
        'stroke-dasharray': (hlavni * obvod) + ' ' + obvod, transform: 'rotate(-90 64 64)' }, svg);
      if (podil > 1) {
        el('circle', { cx: 64, cy: 64, r, class: 'kruh-preteceni',
          'stroke-dasharray': (Math.min(1, podil - 1) * obvod) + ' ' + obvod, transform: 'rotate(-90 64 64)' }, svg);
      }
    }
    txt(svg, 64, 60, fmt(hodnota), { class: 'kruh-cislo', 'text-anchor': 'middle' });
    txt(svg, 64, 80, cil ? 'z ' + fmt(cil) + ' kcal' : 'kcal', { class: 'kruh-popis', 'text-anchor': 'middle' });
    return svg;
  }

  // sloupcový graf po dnech s čárou cíle
  function sloupce(kontejner, data, volby) {
    volby = volby || {};
    kontejner.innerHTML = '';
    const W = Math.max(280, kontejner.clientWidth || 600), H = volby.vyska || 200;
    const okraj = { l: 44, r: 8, t: 12, b: 26 };
    const max = Math.max(1, volby.cil || 0, ...data.map(d => d.v || 0)) * 1.1;
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'graf', role: 'img', 'aria-label': volby.popis || 'Graf' }, kontejner);
    const vy = v => okraj.t + (H - okraj.t - okraj.b) * (1 - v / max);
    // mřížka
    const krok = hezkyKrok(max / 4);
    for (let v = 0; v <= max; v += krok) {
      el('line', { x1: okraj.l, x2: W - okraj.r, y1: vy(v), y2: vy(v), class: 'mrizka' }, svg);
      txt(svg, okraj.l - 6, vy(v) + 4, fmt(v), { class: 'osa', 'text-anchor': 'end' });
    }
    const n = data.length || 1;
    const sirka = (W - okraj.l - okraj.r) / n;
    const popisKazdy = Math.ceil(n / Math.max(1, Math.floor((W - okraj.l) / 34)));
    data.forEach((d, i) => {
      const x = okraj.l + i * sirka;
      if (d.v > 0) {
        const nad = volby.cil && d.v > volby.cil * 1.05;
        const r = el('rect', { x: x + sirka * 0.15, y: vy(d.v), width: Math.max(1, sirka * 0.7), height: Math.max(0, vy(0) - vy(d.v)),
          rx: Math.min(3, sirka * 0.15), class: 'sloupec' + (nad ? ' nad' : '') }, svg);
        const t = el('title', {}, r); t.textContent = (d.popis || d.k) + ': ' + fmt(d.v) + ' ' + (volby.jednotka || '');
      }
      if (i % popisKazdy === 0) txt(svg, x + sirka / 2, H - 8, d.kratce || '', { class: 'osa', 'text-anchor': 'middle' });
    });
    if (volby.cil) {
      el('line', { x1: okraj.l, x2: W - okraj.r, y1: vy(volby.cil), y2: vy(volby.cil), class: 'cil' }, svg);
      txt(svg, W - okraj.r - 2, vy(volby.cil) - 4, 'cíl ' + fmt(volby.cil), { class: 'osa cil-popis', 'text-anchor': 'end' });
    }
    return svg;
  }

  // spojnicový graf (hmotnost) s plovoucím průměrem
  function cara(kontejner, body, volby) {
    volby = volby || {};
    kontejner.innerHTML = '';
    if (!body.length) return null;
    const W = Math.max(280, kontejner.clientWidth || 600), H = volby.vyska || 200;
    const okraj = { l: 44, r: 10, t: 12, b: 26 };
    const hodn = body.map(b => b.v);
    let min = Math.min(...hodn), max = Math.max(...hodn);
    if (volby.cilV) { min = Math.min(min, volby.cilV); max = Math.max(max, volby.cilV); }
    const roz = Math.max(1, max - min);
    min -= roz * 0.15; max += roz * 0.15;
    const t0 = body[0].t, t1 = body[body.length - 1].t;
    const vx = t => okraj.l + (W - okraj.l - okraj.r) * (t1 === t0 ? 0.5 : (t - t0) / (t1 - t0));
    const vy = v => okraj.t + (H - okraj.t - okraj.b) * (1 - (v - min) / (max - min));
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'graf', role: 'img', 'aria-label': volby.popis || 'Graf' }, kontejner);
    const krok = hezkyKrok((max - min) / 4);
    for (let v = Math.ceil(min / krok) * krok; v <= max; v += krok) {
      el('line', { x1: okraj.l, x2: W - okraj.r, y1: vy(v), y2: vy(v), class: 'mrizka' }, svg);
      txt(svg, okraj.l - 6, vy(v) + 4, fmt(v, krok < 1 ? 1 : 0), { class: 'osa', 'text-anchor': 'end' });
    }
    if (volby.cilV) {
      el('line', { x1: okraj.l, x2: W - okraj.r, y1: vy(volby.cilV), y2: vy(volby.cilV), class: 'cil' }, svg);
      txt(svg, W - okraj.r - 2, vy(volby.cilV) - 4, 'cíl ' + fmt(volby.cilV, 1), { class: 'osa cil-popis', 'text-anchor': 'end' });
    }
    // trend: exponenciálně vážený průměr (vyhlazuje kolísání vody)
    if (volby.trend && body.length > 2) {
      let ema = body[0].v; const tr = [];
      for (const b of body) { ema = ema + 0.25 * (b.v - ema); tr.push([vx(b.t), vy(ema)]); }
      el('polyline', { points: tr.map(p => p.join(',')).join(' '), class: 'trend' }, svg);
    }
    el('polyline', { points: body.map(b => vx(b.t) + ',' + vy(b.v)).join(' '), class: 'cara' }, svg);
    for (const b of body) {
      const c = el('circle', { cx: vx(b.t), cy: vy(b.v), r: 3, class: 'bod' }, svg);
      const t = el('title', {}, c); t.textContent = (b.popis || '') + ': ' + fmt(b.v, 1) + ' ' + (volby.jednotka || '');
    }
    const popisy = volby.popisy || [];
    // krajní popisky zarovnat dovnitř, ať je okraj neusekne
    for (const p of popisy) {
      const x = vx(p.t);
      const kotva = x < okraj.l + 30 ? 'start' : x > W - okraj.r - 30 ? 'end' : 'middle';
      txt(svg, x, H - 8, p.text, { class: 'osa', 'text-anchor': kotva });
    }
    return svg;
  }

  // koláč (podíl makroživin na energii)
  function kolac(kontejner, casti, volby) {
    volby = volby || {};
    kontejner.innerHTML = '';
    const svg = el('svg', { viewBox: '0 0 120 120', class: 'graf-kolac', role: 'img', 'aria-label': volby.popis || 'Podíl' }, kontejner);
    const soucet = casti.reduce((s, c) => s + Math.max(0, c.v), 0);
    const r = 46, obvod = 2 * Math.PI * r;
    el('circle', { cx: 60, cy: 60, r, class: 'kruh-pozadi', 'stroke-width': 18 }, svg);
    if (soucet <= 0) return svg;
    let posun = 0;
    for (const c of casti) {
      const d = Math.max(0, c.v) / soucet * obvod;
      if (d <= 0) continue;
      // barva přes style – v atributu SVG by var(--…) nefungovala
      const k = el('circle', { cx: 60, cy: 60, r, fill: 'none', style: 'stroke:' + c.barva, 'stroke-width': 18,
        'stroke-dasharray': d + ' ' + (obvod - d), 'stroke-dashoffset': -posun, transform: 'rotate(-90 60 60)' }, svg);
      const t = el('title', {}, k); t.textContent = c.popis + ': ' + fmt(100 * c.v / soucet) + ' %';
      posun += d;
    }
    return svg;
  }

  function hezkyKrok(x) {
    if (!(x > 0)) return 1;
    const m = Math.pow(10, Math.floor(Math.log10(x)));
    const n = x / m;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * m;
  }

  window.DENIK_GRAFY = { kruh, sloupce, cara, kolac, hezkyKrok };
})();

/* Voynichův rukopis – malé SVG grafy bez knihoven. Popisky po najetí myší přes atribut data-tip
 * (společný #tip). Barvy: jedna řada = --accent, dvě skupiny = --rada-1 / --rada-2, intenzita = průhlednost akcentu. */
(function () {
  'use strict';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cislo = (x, d) => (d == null ? x : x.toFixed(d)).toString().replace('.', ',');
  const fmt = x => Math.abs(x) >= 1000 ? Math.round(x).toLocaleString('cs-CZ') : (Math.abs(x) >= 10 || x === Math.round(x)) ? cislo(Math.round(x * 10) / 10) : cislo(Math.round(x * 1000) / 1000);

  function hezkeKroky(max, n) {
    if (max <= 0) return [0, 1];
    const hrub = max / (n || 4);
    const mag = Math.pow(10, Math.floor(Math.log10(hrub)));
    const k = [1, 2, 2.5, 5, 10].map(x => x * mag).find(x => x >= hrub) || 10 * mag;
    const out = [];
    for (let v = 0; v <= max + k * 0.001; v += k) out.push(v);
    if (out[out.length - 1] < max) out.push(out[out.length - 1] + k);
    return out;
  }

  // Svislé sloupce. data: [{popis, hodnota, tip?}], volby: {vyska, formatY, barva, sirkaSloupce}
  function sloupce(data, v) {
    v = v || {};
    const H = v.vyska || 220, L = v.sikmePopisky ? 64 : 44, B = v.sikmePopisky ? 70 : 24, T = 10;
    let bw = v.sirkaSloupce || Math.max(8, Math.min(34, 640 / Math.max(1, data.length) - 3));
    // vodorovné popisky se nesmí překrývat
    if (!v.sikmePopisky && data.length <= 40) bw = Math.max(bw, Math.max(...data.map(d => String(d.popis).length)) * 6.2 + 4);
    const W = L + data.length * (bw + 3) + 10;
    const max = Math.max(...data.map(d => d.hodnota), 0);
    const kroky = hezkeKroky(max, 4), top = kroky[kroky.length - 1] || 1;
    const y = val => T + (H - T - B) * (1 - val / top);
    const fy = v.formatY || fmt;
    let s = `<svg class="graf" viewBox="0 0 ${W} ${H}" style="width:${W}px;max-width:100%" role="img" aria-label="${esc(v.popis || 'sloupcový graf')}">`;
    for (const k of kroky) s += `<line class="mriz" x1="${L}" x2="${W - 6}" y1="${y(k)}" y2="${y(k)}"/><text x="${L - 5}" y="${y(k) + 3.5}" text-anchor="end">${esc(fy(k))}</text>`;
    data.forEach((d, i) => {
      const x = L + i * (bw + 3) + 2, yy = y(d.hodnota), h = Math.max(0, H - B - yy);
      const r = Math.min(4, bw / 2, h);
      const tip = d.tip || `${d.popis}: ${fy(d.hodnota)}`;
      // zaoblený jen horní konec, dole u osy rovně
      s += `<path class="hit" fill="${d.barva || v.barva || 'var(--accent)'}" d="M${x},${H - B}V${yy + r}Q${x},${yy} ${x + r},${yy}H${x + bw - r}Q${x + bw},${yy} ${x + bw},${yy + r}V${H - B}Z" data-tip="${esc(tip)}"/>`;
      // neviditelný větší zásah pro myš
      s += `<rect x="${x - 1}" y="${T}" width="${bw + 2}" height="${H - B - T}" fill="transparent" data-tip="${esc(tip)}"/>`;
      const px = x + bw / 2;
      if (v.sikmePopisky) s += `<text x="${px}" y="${H - B + 12}" text-anchor="end" transform="rotate(-50 ${px} ${H - B + 12})" class="eva">${esc(d.popis)}</text>`;
      else if (data.length <= 40 || i % Math.ceil(data.length / 40) === 0) s += `<text x="${px}" y="${H - B + 14}" text-anchor="middle">${esc(d.popis)}</text>`;
    });
    s += `<line class="osa" x1="${L}" x2="${W - 6}" y1="${H - B}" y2="${H - B}"/></svg>`;
    return s;
  }

  // Seskupené sloupce pro 2–4 řady. kategorie: [popis], rady: [{nazev, barva, hodnoty:[], tipy?:[]}]
  function skupiny(kategorie, rady, v) {
    v = v || {};
    const H = v.vyska || 230, L = v.sikmePopisky ? 64 : 44, B = v.sikmePopisky ? 70 : 24, T = 10;
    const bw = v.sirkaSloupce || Math.max(5, Math.min(18, 600 / Math.max(1, kategorie.length * rady.length) - 2));
    const gw = rady.length * (bw + 2) + 6;
    const W = L + kategorie.length * gw + 10;
    const max = Math.max(0, ...rady.flatMap(r => r.hodnoty));
    const kroky = hezkeKroky(max, 4), top = kroky[kroky.length - 1] || 1;
    const y = val => T + (H - T - B) * (1 - val / top);
    const fy = v.formatY || fmt;
    let s = `<svg class="graf" viewBox="0 0 ${W} ${H}" style="width:${W}px;max-width:100%" role="img" aria-label="${esc(v.popis || 'srovnávací graf')}">`;
    for (const k of kroky) s += `<line class="mriz" x1="${L}" x2="${W - 6}" y1="${y(k)}" y2="${y(k)}"/><text x="${L - 5}" y="${y(k) + 3.5}" text-anchor="end">${esc(fy(k))}</text>`;
    kategorie.forEach((kat, i) => {
      const gx = L + i * gw + 3;
      rady.forEach((r, j) => {
        const val = r.hodnoty[i] || 0, x = gx + j * (bw + 2), yy = y(val), h = Math.max(0, H - B - yy);
        const rr = Math.min(3, bw / 2, h);
        const tip = (r.tipy && r.tipy[i]) || `${kat} · ${r.nazev}: ${fy(val)}`;
        s += `<path class="hit" fill="${r.barva}" d="M${x},${H - B}V${yy + rr}Q${x},${yy} ${x + rr},${yy}H${x + bw - rr}Q${x + bw},${yy} ${x + bw},${yy + rr}V${H - B}Z" data-tip="${esc(tip)}"/>`;
      });
      const px = gx + (rady.length * (bw + 2)) / 2;
      s += `<rect x="${gx - 2}" y="${T}" width="${gw}" height="${H - B - T}" fill="transparent" data-tip="${esc(kat + '\n' + rady.map(r => r.nazev + ': ' + fy(r.hodnoty[i] || 0)).join('\n'))}"/>`;
      if (v.sikmePopisky) s += `<text x="${px}" y="${H - B + 12}" text-anchor="end" transform="rotate(-50 ${px} ${H - B + 12})" class="eva">${esc(kat)}</text>`;
      else s += `<text x="${px}" y="${H - B + 14}" text-anchor="middle">${esc(kat)}</text>`;
    });
    s += `<line class="osa" x1="${L}" x2="${W - 6}" y1="${H - B}" y2="${H - B}"/></svg>`;
    return legenda(rady) + s;
  }

  function legenda(rady) {
    if (rady.length < 2) return '';
    return '<div class="legenda">' + rady.map(r => `<span><i style="background:${r.barva}"></i>${esc(r.nazev)}</span>`).join('') + '</div>';
  }

  // Zipfův graf: log(pořadí) × log(četnost). rady: [{nazev, barva, body:[{x, y, tip}]}]
  function zipf(rady, v) {
    v = v || {};
    const W = 640, H = v.vyska || 280, L = 50, B = 34, T = 10, R = 12;
    const maxX = Math.max(...rady.flatMap(r => r.body.map(b => b.x)), 10);
    const maxY = Math.max(...rady.flatMap(r => r.body.map(b => b.y)), 10);
    const lx = x => L + (W - L - R) * Math.log10(x) / Math.log10(maxX);
    const ly = yv => T + (H - T - B) * (1 - Math.log10(yv) / Math.log10(maxY));
    let s = `<svg class="graf" viewBox="0 0 ${W} ${H}" style="width:${W}px;max-width:100%" role="img" aria-label="Zipfův graf">`;
    for (let p = 1; p <= maxX; p *= 10) s += `<line class="mriz" x1="${lx(p)}" x2="${lx(p)}" y1="${T}" y2="${H - B}"/><text x="${lx(p)}" y="${H - B + 14}" text-anchor="middle">${p.toLocaleString('cs-CZ')}</text>`;
    for (let p = 1; p <= maxY; p *= 10) s += `<line class="mriz" x1="${L}" x2="${W - R}" y1="${ly(p)}" y2="${ly(p)}"/><text x="${L - 5}" y="${ly(p) + 3.5}" text-anchor="end">${p.toLocaleString('cs-CZ')}</text>`;
    s += `<text x="${(L + W) / 2}" y="${H - 3}" text-anchor="middle">pořadí slova (log)</text>`;
    s += `<text x="12" y="${(T + H - B) / 2}" text-anchor="middle" transform="rotate(-90 12 ${(T + H - B) / 2})">četnost (log)</text>`;
    // ideální Zipf 1/r od prvního bodu
    if (v.idealni && rady[0] && rady[0].body[0]) {
      const c = rady[0].body[0].y;
      s += `<line x1="${lx(1)}" y1="${ly(c)}" x2="${lx(maxX)}" y2="${ly(Math.max(1, c / maxX))}" stroke="var(--text-faint)" stroke-dasharray="4 4" stroke-width="1.5"/>`;
    }
    for (const r of rady) {
      const d = r.body.map((b, i) => (i ? 'L' : 'M') + lx(b.x).toFixed(1) + ',' + ly(b.y).toFixed(1)).join('');
      s += `<path d="${d}" fill="none" stroke="${r.barva}" stroke-width="2" stroke-linejoin="round"/>`;
      // body s popiskem: jen prvních 30 a pak logaritmicky řidčeji
      r.body.forEach((b, i) => {
        if (i > 30 && Math.round(Math.log(i + 1) * 12) === Math.round(Math.log(i) * 12)) return;
        s += `<circle cx="${lx(b.x)}" cy="${ly(b.y)}" r="${i < 30 ? 3 : 2}" fill="${r.barva}"/><circle cx="${lx(b.x)}" cy="${ly(b.y)}" r="7" fill="transparent" data-tip="${esc(b.tip || '')}" ${b.slovo ? `data-slovo="${esc(b.slovo)}"` : ''} style="cursor:pointer"/>`;
      });
    }
    s += `<line class="osa" x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}"/><line class="osa" x1="${L}" x2="${L}" y1="${T}" y2="${H - B}"/></svg>`;
    return legenda(rady) + s;
  }

  // Tepelná mapa: hodnota 0–1 → průhlednost akcentu. bunka(a, b) → {v, tip, text?}
  function heatmapa(radky, sloupce, bunka, v) {
    v = v || {};
    const c = v.bunka || 22, L = v.levyOkraj || 42, T = v.horniOkraj || 34;
    const W = L + sloupce.length * c + 4, H = T + radky.length * c + 4;
    let s = `<svg class="graf" viewBox="0 0 ${W} ${H}" style="width:${W}px;max-width:100%" role="img" aria-label="${esc(v.popis || 'tepelná mapa')}">`;
    sloupce.forEach((b, j) => s += `<text x="${L + j * c + c / 2}" y="${T - 8}" text-anchor="middle" class="eva">${esc(b)}</text>`);
    radky.forEach((a, i) => {
      s += `<text x="${L - 6}" y="${T + i * c + c / 2 + 4}" text-anchor="end" class="eva">${esc(a)}</text>`;
      sloupce.forEach((b, j) => {
        const z = bunka(a, b);
        const op = Math.max(0, Math.min(1, z.v));
        s += `<rect x="${L + j * c + 1}" y="${T + i * c + 1}" width="${c - 2}" height="${c - 2}" rx="2" fill="${op > 0 ? 'var(--accent)' : 'var(--bg-input)'}" fill-opacity="${op > 0 ? (0.06 + 0.94 * op).toFixed(3) : 1}" data-tip="${esc(z.tip)}"/>`;
        if (z.text) s += `<text x="${L + j * c + c / 2}" y="${T + i * c + c / 2 + 3.5}" text-anchor="middle" style="font-size:9px;pointer-events:none;fill:${op > 0.55 ? 'var(--on-accent)' : 'var(--text-muted)'}">${esc(z.text)}</text>`;
      });
    });
    s += '</svg>';
    return s;
  }

  // Skládaný vodorovný pruh (podíly), segmenty [{nazev, barva, podil}] – mezera 2 px mezi segmenty
  function pruh(segmenty, sirka) {
    sirka = sirka || 160;
    let x = 0, s = `<svg width="${sirka}" height="12" style="vertical-align:middle" role="img">`;
    for (const g of segmenty) {
      const w = Math.max(0, g.podil * sirka - 2);
      if (w > 0) s += `<rect x="${x}" y="1" width="${w}" height="10" rx="2" fill="${g.barva}" data-tip="${esc(g.nazev + ': ' + Math.round(g.podil * 100) + ' %')}"/>`;
      x += g.podil * sirka;
    }
    return s + '</svg>';
  }

  // společný popisek
  function zapniTipy() {
    const tip = document.getElementById('tip');
    if (!tip) return;
    let cil = null;
    document.addEventListener('mousemove', e => {
      const el = e.target.closest && e.target.closest('[data-tip]');
      if (!el) { if (cil) { tip.style.display = 'none'; cil = null; } return; }
      if (el !== cil) { tip.textContent = el.getAttribute('data-tip'); tip.style.display = 'block'; cil = el; }
      const w = tip.offsetWidth, h = tip.offsetHeight;
      let x = e.clientX + 14, y = e.clientY + 14;
      if (x + w > innerWidth - 6) x = e.clientX - w - 10;
      if (y + h > innerHeight - 6) y = e.clientY - h - 10;
      tip.style.left = Math.max(4, x) + 'px'; tip.style.top = Math.max(4, y) + 'px';
    });
    document.addEventListener('scroll', () => { tip.style.display = 'none'; cil = null; }, true);
  }

  window.VoynichGrafy = { sloupce, skupiny, zipf, heatmapa, pruh, legenda, zapniTipy, esc, fmt, cislo };
})();

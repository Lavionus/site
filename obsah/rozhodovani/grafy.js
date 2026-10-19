/* rozhodovani/grafy.js – vlastní SVG/HTML grafy (bez knihoven). Barvy přes CSS proměnné --s1…--s8,
   identita řady se drží entity (index alternativy / kritéria), nad 8 řad čárkovaně / šrafovaně. */
(function () {
  'use strict';
  const F = (x, d) => window.Rozhodovani.formatCislo(x, d);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const barva = i => `var(--s${(i % 8) + 1})`;
  const carky = i => (i >= 8 ? ' stroke-dasharray="6 4"' : '');
  const zkrat = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

  /** Vodorovné sloupce (HTML). polozky: [{nazev, hodnota, tip, znacka}] – hodnota může být záporná. */
  function sloupce(polozky, volby) {
    volby = volby || {};
    const des = volby.des === undefined ? 3 : volby.des;
    const hodn = polozky.map(p => p.hodnota).filter(x => isFinite(x));
    let lo = Math.min(0, ...hodn), hi = Math.max(0, ...hodn);
    if (volby.min !== undefined) lo = Math.min(lo, volby.min);
    if (volby.max !== undefined) hi = Math.max(hi, volby.max);
    const roz = hi - lo || 1;
    const nula = (0 - lo) / roz * 100;
    return '<div class="sl-graf">' + polozky.map(p => {
      const a = (Math.min(0, p.hodnota) - lo) / roz * 100, b = (Math.max(0, p.hodnota) - lo) / roz * 100;
      return `<div class="sl-radek" data-tip="${esc(p.tip || p.nazev + ': ' + F(p.hodnota, des))}">
        <span class="sl-nazev">${p.znacka ? `<b class="sl-znacka">${esc(p.znacka)}</b>` : ''}${esc(p.nazev)}</span>
        <span class="sl-drah">${lo < 0 ? `<i class="sl-nula" style="left:${nula}%"></i>` : ''}<i class="sl-pruh${p.hodnota < 0 ? ' zap' : ''}" style="left:${a}%;width:${Math.max(b - a, 0.4)}%"></i></span>
        <span class="sl-hodn">${F(p.hodnota, des)}</span></div>`;
    }).join('') + '</div>';
  }

  /** Skládané sloupce příspěvků (HTML). radky: [{nazev, dily:[hodnota po kritériích], soucet}], kriteria: [názvy] */
  function skladane(radky, kriteria, volby) {
    volby = volby || {};
    const max = volby.max || Math.max(1e-12, ...radky.map(r => r.soucet));
    const leg = '<div class="legenda">' + kriteria.map((k, j) =>
      `<span><i class="lg-ctv${j >= 8 ? ' sraf' : ''}" style="--c:${barva(j)}"></i>${esc(k)}</span>`).join('') + '</div>';
    return leg + '<div class="sk-graf">' + radky.map(r => `<div class="sl-radek">
      <span class="sl-nazev">${esc(r.nazev)}</span>
      <span class="sk-drah">${r.dily.map((d, j) => d > 1e-12 ? `<i class="sk-dil${j >= 8 ? ' sraf' : ''}" style="--c:${barva(j)};width:${d / max * 100}%"
        data-tip="${esc(r.nazev + ' · ' + kriteria[j] + ': ' + F(d, 3) + ' (' + F(d / (r.soucet || 1) * 100, 1) + ' % skóre)')}"></i>` : '').join('')}</span>
      <span class="sl-hodn">${F(r.soucet, 3)}</span></div>`).join('') + '</div>';
  }

  /** Radarový graf (SVG). osy: názvy kritérií; serie: [{nazev, hodnoty (0–1), index}] */
  function radar(osy, serie, sirka) {
    const W = Math.max(280, Math.min(sirka, 620));
    const H = Math.round(W * (W < 420 ? 0.92 : 0.78));
    const cx = W / 2, cy = H / 2 + 4, R = Math.min(W * (W < 420 ? 0.25 : 0.33), H / 2 - 34);
    const n = osy.length;
    if (n < 3) return '<p class="napoveda">Radarový graf potřebuje alespoň 3 kritéria.</p>';
    const bod = (j, r) => {
      const a = -Math.PI / 2 + 2 * Math.PI * j / n;
      return [cx + Math.cos(a) * R * r, cy + Math.sin(a) * R * r];
    };
    let s = `<svg class="graf-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Radarový graf normalizovaných hodnot">`;
    for (const k of [0.25, 0.5, 0.75, 1]) {
      s += `<polygon class="mriz" points="${osy.map((_, j) => bod(j, k).join(',')).join(' ')}"/>`;
    }
    s += `<text class="osa-txt" x="${cx + 3}" y="${cy - R * 0.5 - 2}">0,5</text><text class="osa-txt" x="${cx + 3}" y="${cy - R - 2}">1</text>`;
    const maxZn = W < 420 ? 9 : 18;
    osy.forEach((o, j) => {
      const [x, y] = bod(j, 1), [tx, ty] = bod(j, 1.13);
      s += `<line class="mriz" x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"/>`;
      const anchor = Math.abs(tx - cx) < 4 ? 'middle' : tx > cx ? 'start' : 'end';
      s += `<text class="osa-txt pop" x="${tx}" y="${ty + 4}" text-anchor="${anchor}"><title>${esc(o)}</title>${esc(zkrat(o, maxZn))}</text>`;
    });
    serie.forEach(se => {
      const pts = se.hodnoty.map((v, j) => bod(j, Math.max(0, Math.min(1, v))));
      s += `<polygon class="rad-pl" points="${pts.map(p => p.join(',')).join(' ')}" style="--c:${barva(se.index)}"${carky(se.index)}/>`;
      pts.forEach((p, j) => {
        s += `<circle class="rad-bod" cx="${p[0]}" cy="${p[1]}" r="4" style="--c:${barva(se.index)}" data-tip="${esc(se.nazev + ' · ' + osy[j] + ': ' + F(se.hodnoty[j], 3))}"/>`;
      });
    });
    return s + '</svg>';
  }

  /** Graf citlivosti (SVG): skóre alternativ v závislosti na váze kritéria. */
  function citlivost(c, nazvy, sirka, nazevKrit, volby) {
    volby = volby || {};
    const W = Math.max(280, Math.min(sirka, 900)), H = W < 420 ? 240 : 300;
    const ml = 44, mr = 12, mt = 12, mb = 36;
    const pw = W - ml - mr, ph = H - mt - mb;
    const vsechny = c.prubeh.flatMap(p => p.skore);
    let lo = Math.min(...vsechny), hi = Math.max(...vsechny);
    if (hi - lo < 1e-9) { lo -= 0.5; hi += 0.5; }
    const pad = (hi - lo) * 0.06; lo -= pad; hi += pad;
    const X = t => ml + t * pw, Y = v => mt + (hi - v) / (hi - lo) * ph;
    let s = `<svg class="graf-svg cit-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Citlivost výsledku na váhu kritéria ${esc(nazevKrit)}">`;
    s += `<rect class="stabilni" x="${X(c.od)}" y="${mt}" width="${Math.max(0, X(c.do) - X(c.od))}" height="${ph}"/>`;
    // mřížka
    for (let k = 0; k <= 4; k++) {
      const v = lo + (hi - lo) * k / 4, y = Y(v);
      s += `<line class="mriz" x1="${ml}" x2="${W - mr}" y1="${y}" y2="${y}"/><text class="osa-txt" x="${ml - 5}" y="${y + 4}" text-anchor="end">${F(v, 2)}</text>`;
    }
    for (let k = 0; k <= 10; k += (W < 420 ? 2 : 1)) {
      const x = X(k / 10);
      s += `<line class="mriz slaba" x1="${x}" x2="${x}" y1="${mt}" y2="${mt + ph}"/><text class="osa-txt" x="${x}" y="${H - mb + 15}" text-anchor="middle">${k * 10}</text>`;
    }
    s += `<text class="osa-txt" x="${ml + pw / 2}" y="${H - 4}" text-anchor="middle">váha kritéria „${esc(zkrat(nazevKrit, 30))}“ [%]</text>`;
    const ent = volby.entity || nazvy.map((_, i) => i);
    nazvy.forEach((nz, i) => {
      if (volby.skryte && volby.skryte.has(ent[i])) return;
      const d = c.prubeh.map((p, k) => (k ? 'L' : 'M') + X(p.t).toFixed(1) + ' ' + Y(p.skore[i]).toFixed(1)).join('');
      s += `<path class="cit-cara${i === c.vitez ? ' vitez' : ''}" d="${d}" style="--c:${barva(ent[i])}"${carky(ent[i])}/>`;
    });
    s += `<line class="aktualni" x1="${X(c.w0)}" x2="${X(c.w0)}" y1="${mt}" y2="${mt + ph}"/>`;
    s += `<line class="kurzor" x1="0" x2="0" y1="${mt}" y2="${mt + ph}" style="display:none"/>`;
    s += `<rect class="cit-zachyt" x="${ml}" y="${mt}" width="${pw}" height="${ph}" data-ml="${ml}" data-pw="${pw}"/>`;
    return s + '</svg>';
  }

  /** Legenda alternativ; entity[i] = trvalý index alternativy (barva), vitez = trvalý index vítěze. */
  const legendaAlt = (nazvy, skryte, vitez, entity) => '<div class="legenda">' + nazvy.map((n, q) => {
    const i = entity ? entity[q] : q;
    return `<button type="button" class="lg-pol${skryte && skryte.has(i) ? ' vyp' : ''}" data-alt="${i}" aria-pressed="${!(skryte && skryte.has(i))}">
      <i class="lg-car${i >= 8 ? ' car' : ''}" style="--c:${barva(i)}"></i>${esc(n)}${i === vitez ? ' ★' : ''}</button>`;
  }).join('') + '</div>';

  /** Pravděpodobnosti pořadí (SMAA): pro každou alternativu skládaný pruh podle míst 1…m (sekvenční odstíny). */
  function akceptabilita(b, nazvy) {
    const m = b.length;
    const odst = r => (m <= 1 ? 1 : 1 - 0.68 * r / (m - 1));
    const leg = '<div class="legenda">' + b[0].map((_, r) => `<span><i class="lg-ctv" style="--c:var(--accent);opacity:${odst(r)}"></i>${r + 1}. místo</span>`).join('') + '</div>';
    return leg + '<div class="sk-graf">' + b.map((row, i) => `<div class="sl-radek">
      <span class="sl-nazev">${esc(nazvy[i])}</span>
      <span class="sk-drah">${row.map((p, r) => p > 0.0005 ? `<i class="sk-dil" style="--c:var(--accent);opacity:${odst(r)};width:${p * 100}%"
        data-tip="${esc(nazvy[i] + ' – ' + (r + 1) + '. místo: ' + F(p * 100, 1) + ' % simulací')}"></i>` : '').join('')}</span>
      <span class="sl-hodn">${F(row[0] * 100, 0)} %</span></div>`).join('') + '</div>';
  }

  /**
   * Editor hodnotové funkce (SVG): body [[x,u]], hodnoty alternativ (značky na ose x), rozsah [x0, x1].
   * Body mají data-bod = index (táhnutí řeší ui.js), rozměry v data-* pro přepočet souřadnic.
   */
  function editorFunkce(body, znacky, x0, x1, sirka, jednotka) {
    const W = Math.max(280, Math.min(sirka, 640)), H = W < 420 ? 210 : 240;
    const ml = 40, mr = 14, mt = 12, mb = 46;
    const pw = W - ml - mr, ph = H - mt - mb;
    const X = x => ml + (x - x0) / (x1 - x0 || 1) * pw, Y = u => mt + (1 - u) * ph;
    let s = `<svg class="graf-svg fce-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" data-ml="${ml}" data-mt="${mt}" data-pw="${pw}" data-ph="${ph}" data-x0="${x0}" data-x1="${x1}" role="img" aria-label="Hodnotová funkce">`;
    for (let k = 0; k <= 4; k++) {
      const u = k / 4, y = Y(u);
      s += `<line class="mriz" x1="${ml}" x2="${W - mr}" y1="${y}" y2="${y}"/><text class="osa-txt" x="${ml - 6}" y="${y + 4}" text-anchor="end">${F(u, 2)}</text>`;
    }
    for (let k = 0; k <= 4; k++) {
      const x = x0 + (x1 - x0) * k / 4;
      s += `<text class="osa-txt" x="${X(x)}" y="${H - mb + 15}" text-anchor="middle">${F(x, Math.abs(x1 - x0) < 10 ? 2 : 0)}</text>`;
    }
    s += `<text class="osa-txt" x="${ml + pw / 2}" y="${H - 4}" text-anchor="middle">hodnota${jednotka ? ' [' + esc(jednotka) + ']' : ''} → užitek u(x)</text>`;
    znacky.forEach(z => {
      s += `<line class="fce-znacka" x1="${X(z.x)}" x2="${X(z.x)}" y1="${mt + ph}" y2="${Y(z.u)}" style="--c:${barva(z.index)}"/>
        <circle class="fce-alt" cx="${X(z.x)}" cy="${Y(z.u)}" r="4" style="--c:${barva(z.index)}" data-tip="${esc(z.nazev + ': ' + F(z.x, 3) + ' → u = ' + F(z.u, 3))}"/>`;
    });
    const pts = [[x0, body[0][1]]].concat(body).concat([[x1, body[body.length - 1][1]]]);
    s += `<path class="fce-cara" d="${pts.map((p, k) => (k ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1)).join('')}"/>`;
    body.forEach((p, k) => {
      s += `<circle class="fce-bod" cx="${X(p[0])}" cy="${Y(p[1])}" r="8" data-bod="${k}" tabindex="0" role="slider" aria-label="Bod ${k + 1}: x = ${F(p[0], 3)}, u = ${F(p[1], 2)}" aria-valuenow="${p[1]}" aria-valuemin="0" aria-valuemax="1"/>`;
    });
    return s + '</svg>';
  }

  window.RozhodovaniGrafy = { sloupce, skladane, radar, citlivost, legendaAlt, akceptabilita, editorFunkce, barva, esc };
})();

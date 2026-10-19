/* Pevnost FDM výtisků – generátory SVG (čisté funkce vracející řetězce; barvy přes třídy a CSS proměnné). */
(function () {
  'use strict';
  const fmt = (typeof module !== 'undefined') ? require('./jadro.js').fmt : window.PevnostTisku.fmt;

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function r2(x) { return Math.round(x * 100) / 100; }

  /** „Hezké“ dělení osy. */
  function kroky(min, max, n) {
    const rozsah = max - min || Math.abs(max) || 1;
    const hrubý = rozsah / (n || 5);
    const mag = Math.pow(10, Math.floor(Math.log10(hrubý)));
    const k = [1, 2, 2.5, 5, 10].find(m => m * mag >= hrubý) * mag;
    const out = [];
    for (let v = Math.ceil(min / k) * k; v <= max + k * 1e-9; v += k) out.push(Math.abs(v) < k * 1e-9 ? 0 : v);
    return out;
  }

  /**
   * Diagram průběhu. o = { x[], y[], pas: [lo[], hi[]] | null, L, sirka, vyska, titul, jednotka, obratit (kladné dolů),
   *   trida, popisExtremu: true }
   * Vrací { svg, mapa: { x0, x1, L, y: fn hodnota→px } }.
   */
  function diagram(o) {
    const W = Math.max(260, o.sirka || 640), H = o.vyska || 170;
    const ml = 58, mr = 14, mt = 22, mb = 26;
    const x0 = ml, x1 = W - mr, y0 = mt, y1 = H - mb;
    let lo = 0, hi = 0;
    const vse = o.y.slice();
    if (o.pas) vse.push(...o.pas[0], ...o.pas[1]);
    for (const v of vse) { if (v < lo) lo = v; if (v > hi) hi = v; }
    if (hi - lo < 1e-12) { hi = 1; lo = -1; }
    const okraj = (hi - lo) * 0.12; hi += hi > 0 ? okraj : 0; lo -= lo < 0 ? okraj : 0;
    if (hi === 0 && lo === 0) hi = 1;
    const obr = !!o.obratit; // kladné hodnoty kreslit dolů (průhyb, moment po konvenci tahů dole)
    const py = v => obr ? y0 + (v - lo) / (hi - lo) * (y1 - y0) : y1 - (v - lo) / (hi - lo) * (y1 - y0);
    const px = x => x0 + x / o.L * (x1 - x0);
    let s = `<svg xmlns="http://www.w3.org/2000/svg" class="graf ${o.trida || ''}" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.titul)}">`;
    s += `<text class="g-titul" x="${x0}" y="14">${esc(o.titul)}${o.jednotka ? ' [' + esc(o.jednotka) + ']' : ''}</text>`;
    // mřížka y
    for (const t of kroky(lo, hi, 4)) {
      const y = r2(py(t));
      s += `<line class="g-mriz" x1="${x0}" y1="${y}" x2="${x1}" y2="${y}"/><text class="g-osa" x="${x0 - 6}" y="${y + 4}" text-anchor="end">${esc(fmt(t, 3))}</text>`;
    }
    // mřížka x
    for (const t of kroky(0, o.L, Math.max(2, Math.floor((x1 - x0) / 70)))) {
      const x = r2(px(t));
      s += `<line class="g-mriz" x1="${x}" y1="${y0}" x2="${x}" y2="${y1}"/><text class="g-osa" x="${x}" y="${H - 8}" text-anchor="middle">${esc(fmt(t, 3))}</text>`;
    }
    const nula = r2(py(0));
    // pás nejistoty
    if (o.pas) {
      let d = '';
      o.x.forEach((x, i) => { d += (i ? 'L' : 'M') + r2(px(x)) + ',' + r2(py(o.pas[1][i])); });
      for (let i = o.x.length - 1; i >= 0; i--) d += 'L' + r2(px(o.x[i])) + ',' + r2(py(o.pas[0][i]));
      s += `<path class="g-pas" d="${d}Z"/>`;
    }
    // plocha a čára
    let d = 'M' + r2(px(o.x[0])) + ',' + nula;
    o.x.forEach((x, i) => { d += 'L' + r2(px(x)) + ',' + r2(py(o.y[i])); });
    d += 'L' + r2(px(o.x[o.x.length - 1])) + ',' + nula + 'Z';
    s += `<path class="g-plocha" d="${d}"/>`;
    let c = '';
    o.x.forEach((x, i) => { c += (i ? 'L' : 'M') + r2(px(x)) + ',' + r2(py(o.y[i])); });
    s += `<path class="g-cara" d="${c}"/>`;
    s += `<line class="g-nula" x1="${x0}" y1="${nula}" x2="${x1}" y2="${nula}"/>`;
    // extrémy
    if (o.popisExtremu !== false) {
      let iMax = 0, iMin = 0;
      o.y.forEach((v, i) => { if (v > o.y[iMax]) iMax = i; if (v < o.y[iMin]) iMin = i; });
      const pop = [];
      if (Math.abs(o.y[iMax]) > 1e-12) pop.push(iMax);
      if (iMin !== iMax && Math.abs(o.y[iMin]) > 1e-12 && Math.abs(o.y[iMin] - o.y[iMax]) > 1e-9 * Math.max(1, Math.abs(o.y[iMax]))) pop.push(iMin);
      for (const i of pop) {
        const x = px(o.x[i]), y = py(o.y[i]);
        const anchor = x < x0 + 60 ? 'start' : (x > x1 - 60 ? 'end' : 'middle');
        const nad = obr ? (o.y[i] < 0) : (o.y[i] > 0);
        const ty = nad ? Math.max(y - 6, y0 + 10) : Math.min(y + 15, y1 - 3);
        s += `<circle class="g-bod" cx="${r2(x)}" cy="${r2(y)}" r="3"/><text class="g-hodn" x="${r2(x)}" y="${r2(ty)}" text-anchor="${anchor}">${esc(fmt(o.y[i], 4))}</text>`;
      }
    }
    s += `<line class="g-kurzor" x1="0" y1="${y0}" x2="0" y2="${y1}" visibility="hidden"/>`;
    s += '</svg>';
    return { svg: s, mapa: { x0, x1, L: o.L } };
  }

  /** Schéma nosníku se zatížením a reakcemi. */
  function schema(r, sirka) {
    const v = r.vstup, W = Math.max(260, sirka || 640), H = 150;
    const x0 = 40, x1 = W - 40, yb = 82;
    const px = x => x0 + x / v.L * (x1 - x0);
    let s = `<svg xmlns="http://www.w3.org/2000/svg" class="schema" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Schéma nosníku a zatížení">`;
    s += '<defs><marker id="sip" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="s-sipka" d="M0,0L10,5L0,10Z"/></marker>'
      + '<marker id="sipR" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="s-reakce-h" d="M0,0L10,5L0,10Z"/></marker></defs>';
    if (v.uloha === 'tah') {
      s += `<rect class="s-nosnik" x="${x0 + 30}" y="${yb - 9}" width="${x1 - x0 - 60}" height="18" rx="2"/>`;
      s += `<line class="s-sila" x1="${x0 + 30}" y1="${yb}" x2="${x0 - 8}" y2="${yb}" marker-end="url(#sip)"/>`;
      s += `<line class="s-sila" x1="${x1 - 30}" y1="${yb}" x2="${x1 + 8}" y2="${yb}" marker-end="url(#sip)"/>`;
      s += `<text class="s-text" x="${x0}" y="${yb - 16}">F = ${esc(fmt(v.sily[0].F))} N</text><text class="s-text" x="${x1}" y="${yb - 16}" text-anchor="end">F</text>`;
      s += `<text class="s-text" x="${(x0 + x1) / 2}" y="${yb + 36}" text-anchor="middle">L = ${esc(fmt(v.L))} mm</text>`;
      return s + '</svg>';
    }
    const nos = r.nos;
    // spojité zatížení
    if (r.qCelk > 0) {
      const yq = 34;
      s += `<rect class="s-q" x="${x0}" y="${yq}" width="${x1 - x0}" height="${yb - 7 - yq}"/>`;
      const n = Math.max(4, Math.floor((x1 - x0) / 36));
      for (let i = 0; i <= n; i++) { const x = r2(x0 + (x1 - x0) * i / n); s += `<line class="s-qs" x1="${x}" y1="${yq}" x2="${x}" y2="${yb - 8}" marker-end="url(#sip)"/>`; }
      s += `<text class="s-text" x="${x1}" y="${yq - 5}" text-anchor="end">q = ${esc(fmt(r.qCelk))} N/mm${r.qG ? ' (vč. vlastní tíhy)' : ''}</text>`;
    }
    s += `<rect class="s-nosnik" x="${x0}" y="${yb - 6}" width="${x1 - x0}" height="12" rx="2"/>`;
    // podpory
    if (v.uloha === 'prosty') {
      for (const [x, pos] of [[x0, false], [x1, true]]) {
        s += `<path class="s-podpora" d="M${x},${yb + 6}l-10,16h20Z"/>`;
        if (pos) s += `<line class="s-podpora-c" x1="${x - 13}" y1="${yb + 26}" x2="${x + 13}" y2="${yb + 26}"/>`;
        s += `<line class="s-podpora-c" x1="${x - 14}" y1="${yb + (pos ? 30 : 23)}" x2="${x + 14}" y2="${yb + (pos ? 30 : 23)}"/>`;
      }
      s += `<text class="s-reakce" x="${x0}" y="${yb + 46}" text-anchor="middle">R_A = ${esc(fmt(nos.RA))} N</text>`;
      s += `<text class="s-reakce" x="${x1}" y="${yb + 46}" text-anchor="end">R_B = ${esc(fmt(nos.RB))} N</text>`;
    } else {
      s += `<rect class="s-zed" x="${x0 - 14}" y="${yb - 34}" width="14" height="68"/>`;
      for (let i = 0; i < 6; i++) s += `<line class="s-podpora-c" x1="${x0 - 14}" y1="${yb - 30 + i * 12}" x2="${x0 - 24}" y2="${yb - 22 + i * 12}"/>`;
      s += `<text class="s-reakce" x="${x0 - 14}" y="${yb + 50}">R_A = ${esc(fmt(nos.RA))} N, M_A = ${esc(fmt(nos.MA))} N·mm</text>`;
    }
    // osamělé síly
    nos.sily.forEach((f, i) => {
      const x = r2(px(f.a));
      const dolu = f.F > 0;
      s += dolu ? `<line class="s-sila" x1="${x}" y1="${yb - 50}" x2="${x}" y2="${yb - 8}" marker-end="url(#sip)"/>`
        : `<line class="s-sila" x1="${x}" y1="${yb + 50}" x2="${x}" y2="${yb + 8}" marker-end="url(#sip)"/>`;
      const anchor = x < x0 + 50 ? 'start' : (x > x1 - 50 ? 'end' : 'middle');
      s += `<text class="s-text s-tucne" x="${x}" y="${dolu ? yb - 54 - (i % 2) * 12 : yb + 64}" text-anchor="${anchor}">F${nos.sily.length > 1 ? i + 1 : ''} = ${esc(fmt(Math.abs(f.F)))} N${dolu ? '' : ' ↑'}</text>`;
    });
    s += `<text class="s-text" x="${(x0 + x1) / 2}" y="${H - 6}" text-anchor="middle">L = ${esc(fmt(v.L))} mm</text>`;
    return s + '</svg>';
  }

  /** Náhled průřezu s oblastmi tisku a směrem Z tiskárny. */
  function prurez(vstup, geo) {
    const W = 220, H = 190, p = vstup.prurez, t = vstup.tisk, o = vstup.orientace;
    const homog = t.model === 'homogenni';
    const bb = p.tvar === 'kruh' ? p.d : p.b, hh = p.tvar === 'kruh' ? p.d : p.h;
    const m = Math.min((W - 70) / bb, (H - 60) / hh);
    const cx = 100, cy = 92;
    const X = y => r2(cx + y * m), Y = z => r2(cy - z * m);
    let s = `<svg xmlns="http://www.w3.org/2000/svg" class="prurez-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Náhled průřezu">`;
    s += '<defs><pattern id="srafa" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line class="p-srafa" x1="0" y1="0" x2="0" y2="6"/></pattern></defs>';
    const obd = (cls, y, z, w, h) => { if (w > 1e-9 && h > 1e-9) s += `<rect class="${cls}" x="${X(y)}" y="${Y(z + h)}" width="${r2(w * m)}" height="${r2(h * m)}"/>`; };
    if (p.tvar === 'kruh') {
      const R = p.d / 2;
      if (homog) s += `<circle class="p-plny" cx="${cx}" cy="${cy}" r="${r2(R * m)}"/>`;
      else {
        const tp = Math.min(t.nPerim * t.stopa, R);
        s += `<circle class="p-perim" cx="${cx}" cy="${cy}" r="${r2(R * m)}"/>`;
        if (R - tp > 1e-9) s += `<circle class="p-vypln" cx="${cx}" cy="${cy}" r="${r2((R - tp) * m)}"/><circle class="p-vypln-s" cx="${cx}" cy="${cy}" r="${r2((R - tp) * m)}"/>`;
      }
    } else {
      const b = p.b, h = p.h;
      if (homog) obd('p-plny', -b / 2, -h / 2, b, h);
      else {
        const tS = t.nPerim * t.stopa, tP = t.nPlne * t.vrstva;
        let core;
        if (o === 'A') {
          const tp = Math.min(tS, b / 2), ts = Math.min(tP, h / 2);
          obd('p-perim', -b / 2, -h / 2, tp, h); obd('p-perim', b / 2 - tp, -h / 2, tp, h);
          obd('p-skin', -b / 2 + tp, h / 2 - ts, b - 2 * tp, ts); obd('p-skin', -b / 2 + tp, -h / 2, b - 2 * tp, ts);
          core = [-b / 2 + tp, -h / 2 + ts, b - 2 * tp, h - 2 * ts];
        } else if (o === 'B') {
          const tp = Math.min(tS, h / 2), ts = Math.min(tP, b / 2);
          obd('p-skin', -b / 2, -h / 2, ts, h); obd('p-skin', b / 2 - ts, -h / 2, ts, h);
          obd('p-perim', -b / 2 + ts, h / 2 - tp, b - 2 * ts, tp); obd('p-perim', -b / 2 + ts, -h / 2, b - 2 * ts, tp);
          core = [-b / 2 + ts, -h / 2 + tp, b - 2 * ts, h - 2 * tp];
        } else {
          const tp = Math.min(tS, b / 2, h / 2);
          obd('p-perim', -b / 2, -h / 2, b, h);
          core = [-b / 2 + tp, -h / 2 + tp, b - 2 * tp, h - 2 * tp];
        }
        obd('p-vypln', ...core); obd('p-vypln-s', ...core);
      }
    }
    // neutrální osa
    s += `<line class="p-no" x1="${X(-bb / 2) - 8}" y1="${cy}" x2="${X(bb / 2) + 8}" y2="${cy}"/>`;
    // směr zatížení
    if (vstup.uloha !== 'tah') s += `<line class="p-zat" x1="${cx}" y1="${Y(hh / 2) - 26}" x2="${cx}" y2="${Y(hh / 2) - 4}" marker-end="url(#psip)"/>`;
    s += '<defs><marker id="psip" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path class="s-sipka" d="M0,0L10,5L0,10Z"/></marker></defs>';
    if (vstup.uloha !== 'tah') s += `<text class="p-text" x="${cx + 6}" y="${Y(hh / 2) - 16}">zatížení</text>`;
    // směr Z tiskárny
    const zx = W - 22;
    if (o === 'A') s += `<line class="p-z" x1="${zx}" y1="${cy + 30}" x2="${zx}" y2="${cy - 30}" marker-end="url(#psipz)"/><text class="p-ztext" x="${zx}" y="${cy + 46}" text-anchor="middle">Z</text>`;
    else if (o === 'B') s += `<line class="p-z" x1="${cx - 30}" y1="${H - 12}" x2="${cx + 30}" y2="${H - 12}" marker-end="url(#psipz)"/><text class="p-ztext" x="${cx + 40}" y="${H - 8}">Z</text>`;
    else s += `<circle class="p-zkruh" cx="${zx}" cy="${cy}" r="9"/><circle class="p-ztecka" cx="${zx}" cy="${cy}" r="2.5"/><text class="p-ztext" x="${zx}" y="${cy + 26}" text-anchor="middle">Z</text>`;
    s += '<defs><marker id="psipz" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path class="p-zsip" d="M0,0L10,5L0,10Z"/></marker></defs>';
    s += `<text class="p-text" x="${X(-bb / 2)}" y="${Y(-hh / 2) + 16}">${p.tvar === 'kruh' ? 'd = ' + esc(fmt(p.d)) : esc(fmt(p.b)) + ' × ' + esc(fmt(p.h))} mm</text>`;
    return s + '</svg>';
  }

  const API = { diagram, schema, prurez, kroky };
  if (typeof module !== 'undefined') module.exports = API; else window.PevnostGrafy = API;
})();

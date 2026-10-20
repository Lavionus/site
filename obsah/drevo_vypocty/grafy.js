/* ============================================================
   Dřevo – pohyb, průhyb, povrchy · GRAFY a SCHÉMATA (SVG jako text, bez DOM)
   Barvy se předávají paletou: na obrazovce CSS proměnné, do PDF pevné hexa.
   pripojHover() je jediná část s DOM (volitelná, jen v prohlížeči).
   ============================================================ */
(function (koren) {
  'use strict';
  const PAL_OBR = { text: 'var(--text)', slaby: 'var(--text-faint)', mrizka: 'var(--border)', osa: 'var(--border-strong)', pozadi: 'var(--bg-elevated)',
    s1: 'var(--serie-1)', s2: 'var(--serie-2)', s3: 'var(--serie-3)', s4: 'var(--serie-4)', zla: 'var(--danger)', ok: 'var(--ok)', drevo: '#d9a66a', drevoT: '#a9733f', letokruh: '#8a5a2b' };
  const PAL_PDF = { text: '#111111', slaby: '#555555', mrizka: '#dddddd', osa: '#999999', pozadi: '#ffffff',
    s1: '#2a78d6', s2: '#eb6834', s3: '#1baf7a', s4: '#6250d6', zla: '#c62828', ok: '#2e7d32', drevo: '#d9a66a', drevoT: '#a9733f', letokruh: '#8a5a2b' };

  const n = (v) => (Math.round(v * 100) / 100).toString();
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const fmtC = (v, d) => v.toLocaleString('cs-CZ', { maximumFractionDigits: d === undefined ? 1 : d, minimumFractionDigits: 0 }).replace(/ /g, ' ');

  /** „hezké“ dělení osy */
  function ticky(min, max, cil) {
    if (!(max > min)) { max = min + 1; }
    const r = (max - min) / (cil || 5), m = Math.pow(10, Math.floor(Math.log10(r)));
    const k = [1, 2, 2.5, 5, 10].find((x) => x * m >= r) * m;
    const a = Math.ceil(min / k - 1e-9) * k, out = [];
    for (let v = a; v <= max + k * 1e-6; v += k) out.push(Math.abs(v) < k * 1e-9 ? 0 : v);
    return out;
  }

  /** Spojnicový graf. o = { w, h, pal, x:{min,max,popis,tick:[{v,t}]}, y:{min,max,popis}, serie:[{nazev,body,barva,sirka,carky,plocha,body2:true}],
   *  vodorovne:[{y, barva, popis, carky}], svisle:[{x, barva, popis}], body:[{x,y,barva,popis}], nadpis } → { svg, meta } */
  function cara(o) {
    const P = o.pal || PAL_OBR, W = o.w || 640, H = o.h || 260;
    const ml = 52, mr = 14, mt = o.nadpis ? 26 : 12, mb = 38;
    const pw = W - ml - mr, ph = H - mt - mb;
    let ymin = o.y.min, ymax = o.y.max;
    if (ymin === undefined || ymax === undefined) {
      const ys = [];
      for (const s of o.serie) for (const b of s.body) if (Number.isFinite(b[1])) ys.push(b[1]);
      for (const v of o.vodorovne || []) ys.push(v.y);
      const lo = Math.min(...ys), hi = Math.max(...ys), pad = (hi - lo) * 0.08 || Math.abs(hi) * 0.1 || 1;
      if (ymin === undefined) ymin = lo - pad;
      if (ymax === undefined) ymax = hi + pad;
    }
    const xmin = o.x.min, xmax = o.x.max;
    const X = (v) => ml + (v - xmin) / (xmax - xmin) * pw, Y = (v) => mt + (1 - (v - ymin) / (ymax - ymin)) * ph;
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Liberation Sans, Arial, sans-serif" font-size="11" role="img" aria-label="${esc(o.nadpis || o.y.popis || 'graf')}">`;
    if (o.pozadi !== false) s += `<rect width="${W}" height="${H}" fill="${P.pozadi}"/>`;
    if (o.nadpis) s += `<text x="${ml}" y="16" fill="${P.text}" font-size="12.5" font-weight="600">${esc(o.nadpis)}</text>`;
    const yt = ticky(ymin, ymax, Math.max(3, Math.round(ph / 45)));
    for (const v of yt) {
      s += `<line x1="${ml}" x2="${ml + pw}" y1="${n(Y(v))}" y2="${n(Y(v))}" stroke="${P.mrizka}" stroke-width="1"/>`;
      s += `<text x="${ml - 6}" y="${n(Y(v) + 3.5)}" text-anchor="end" fill="${P.slaby}">${fmtC(v, 2)}</text>`;
    }
    const xt = o.x.tick || ticky(xmin, xmax, Math.max(3, Math.round(pw / 80))).map((v) => ({ v, t: fmtC(v, 2) }));
    for (const t of xt) {
      s += `<line x1="${n(X(t.v))}" x2="${n(X(t.v))}" y1="${mt + ph}" y2="${mt + ph + 4}" stroke="${P.osa}"/>`;
      s += `<text x="${n(X(t.v + (t.posun || 0)))}" y="${mt + ph + 16}" text-anchor="middle" fill="${P.slaby}">${esc(t.t)}</text>`;
    }
    s += `<line x1="${ml}" x2="${ml + pw}" y1="${mt + ph}" y2="${mt + ph}" stroke="${P.osa}"/>`;
    if (ymin < 0 && ymax > 0) s += `<line x1="${ml}" x2="${ml + pw}" y1="${n(Y(0))}" y2="${n(Y(0))}" stroke="${P.osa}"/>`;
    if (o.x.popis) s += `<text x="${ml + pw}" y="${H - 4}" text-anchor="end" fill="${P.slaby}">${esc(o.x.popis)}</text>`;
    if (o.y.popis) s += `<text x="12" y="${mt + ph / 2}" transform="rotate(-90 12 ${mt + ph / 2})" text-anchor="middle" fill="${P.slaby}">${esc(o.y.popis)}</text>`;
    s += `<defs><clipPath id="${o.id || 'g'}_clip"><rect x="${ml}" y="${mt}" width="${pw}" height="${ph}"/></clipPath></defs><g clip-path="url(#${o.id || 'g'}_clip)">`;
    for (const v of o.pasy || []) s += `<rect x="${ml}" y="${n(Y(v.y2))}" width="${pw}" height="${n(Math.abs(Y(v.y1) - Y(v.y2)))}" fill="${v.barva}" opacity="${v.opacita || 0.12}"/>`;
    for (const v of o.vodorovne || []) s += `<line x1="${ml}" x2="${ml + pw}" y1="${n(Y(v.y))}" y2="${n(Y(v.y))}" stroke="${v.barva || P.zla}" stroke-width="1.5" stroke-dasharray="${v.carky || '6 4'}"/>`;
    for (const v of o.svisle || []) s += `<line x1="${n(X(v.x))}" x2="${n(X(v.x))}" y1="${mt}" y2="${mt + ph}" stroke="${v.barva || P.osa}" stroke-width="1" stroke-dasharray="3 3"/>`;
    for (const sr of o.serie) {
      const pts = sr.body.filter((b) => Number.isFinite(b[1]));
      if (!pts.length) continue;
      const d = pts.map((b, i) => (i ? 'L' : 'M') + n(X(b[0])) + ' ' + n(Y(b[1]))).join('');
      if (sr.plocha) {
        const z = Y(Math.max(ymin, Math.min(ymax, 0)));
        s += `<path d="${d}L${n(X(pts[pts.length - 1][0]))} ${n(z)}L${n(X(pts[0][0]))} ${n(z)}Z" fill="${sr.barva}" opacity="0.14"/>`;
      }
      if (!sr.jenBody) s += `<path d="${d}" fill="none" stroke="${sr.barva}" stroke-width="${sr.sirka || 2}" stroke-linejoin="round" stroke-linecap="round"${sr.carky ? ` stroke-dasharray="${sr.carky}"` : ''}/>`;
      if (sr.znacky) for (const b of pts) s += `<circle cx="${n(X(b[0]))}" cy="${n(Y(b[1]))}" r="4" fill="${sr.barva}" stroke="${P.pozadi}" stroke-width="2"/>`;
    }
    s += '</g>';
    for (const v of o.vodorovne || []) if (v.popis) s += `<text x="${ml + pw - 4}" y="${n(Y(v.y) - 4)}" text-anchor="end" fill="${P.text}" font-size="10.5">${esc(v.popis)}</text>`;
    for (const v of o.svisle || []) if (v.popis) s += `<text x="${n(X(v.x) + 3)}" y="${mt + 10}" fill="${P.slaby}" font-size="10">${esc(v.popis)}</text>`;
    for (const b of o.body || []) {
      s += `<circle cx="${n(X(b.x))}" cy="${n(Y(b.y))}" r="5" fill="${b.barva || P.s2}" stroke="${P.pozadi}" stroke-width="2"/>`;
      if (b.popis) s += `<text x="${n(X(b.x) + 8)}" y="${n(Y(b.y) - 7)}" fill="${P.text}" font-size="10.5">${esc(b.popis)}</text>`;
    }
    // legenda (≥ 2 řady)
    const leg = o.serie.filter((sr) => sr.nazev);
    if (leg.length >= 2) {
      const sirky = leg.map((sr) => sr.nazev.length * 5.6 + 26), celk = sirky.reduce((a, b) => a + b, 0);
      // s nadpisem: legenda vpravo v řádku nadpisu (pokud se vejde), jinak vlevo nahoře v grafu
      const vpravo = o.nadpis && celk < pw - o.nadpis.length * 6.8 - 10;
      let lx = vpravo ? ml + pw - celk : ml + 6, ly = vpravo ? 16 : mt + 12;
      const parts = [];
      for (const sr of leg) {
        const wTxt = sr.nazev.length * 5.6 + 26;
        if (lx + wTxt > ml + pw + 1) { lx = ml + 6; ly += 14; }
        parts.push(`<line x1="${lx}" x2="${lx + 16}" y1="${ly - 4}" y2="${ly - 4}" stroke="${sr.barva}" stroke-width="2.5"${sr.carky ? ` stroke-dasharray="${sr.carky}"` : ''}/><text x="${lx + 20}" y="${ly}" fill="${P.text}" font-size="10.5">${esc(sr.nazev)}</text>`);
        lx += wTxt;
      }
      s += `<g>${parts.join('')}</g>`;
    }
    s += '</svg>';
    return { svg: s, meta: { ml, mt, pw, ph, W, H, xmin, xmax, ymin, ymax, serie: o.serie.map((sr) => ({ nazev: sr.nazev, body: sr.body, barva: sr.barva, jednotka: sr.jednotka })), xFmt: o.xFmt } };
  }

  /** Crosshair + tooltip nad grafem (DOM). el = obal, ve kterém je <svg>; meta z cara(). */
  function pripojHover(el, meta, formatX) {
    if (typeof document === 'undefined' || !el) return;
    const svg = el.querySelector('svg'); if (!svg) return;
    el.style.position = 'relative';
    let tip = el.querySelector('.graf-tip');
    if (!tip) { tip = document.createElement('div'); tip.className = 'graf-tip'; el.appendChild(tip); }
    let car = svg.querySelector('.graf-kriz');
    if (!car) { car = document.createElementNS('http://www.w3.org/2000/svg', 'line'); car.setAttribute('class', 'graf-kriz'); car.setAttribute('stroke', 'currentColor'); car.setAttribute('stroke-width', '1'); car.setAttribute('opacity', '0'); svg.appendChild(car); }
    const pohyb = (ev) => {
      const r = svg.getBoundingClientRect(); if (!r.width) return;
      const sx = (ev.clientX - r.left) / r.width * meta.W;
      if (sx < meta.ml || sx > meta.ml + meta.pw) { skryj(); return; }
      const xv = meta.xmin + (sx - meta.ml) / meta.pw * (meta.xmax - meta.xmin);
      const radky = [];
      for (const sr of meta.serie) {
        if (!sr.nazev || !sr.body.length) continue;
        let b = sr.body[0], d = Infinity;
        for (const q of sr.body) { const dd = Math.abs(q[0] - xv); if (dd < d && Number.isFinite(q[1])) { d = dd; b = q; } }
        radky.push(`<div><i style="background:${sr.barva}"></i>${esc(sr.nazev)}: <b>${fmtC(b[1], 2)}${sr.jednotka ? ' ' + sr.jednotka : ''}</b></div>`);
      }
      if (!radky.length) { skryj(); return; }
      car.setAttribute('x1', sx); car.setAttribute('x2', sx); car.setAttribute('y1', meta.mt); car.setAttribute('y2', meta.mt + meta.ph); car.setAttribute('opacity', '0.5');
      tip.innerHTML = `<div class="graf-tip-x">${esc(formatX ? formatX(xv) : fmtC(xv, 1))}</div>` + radky.join('');
      tip.style.display = 'block';
      const px = (sx / meta.W) * r.width, er = el.getBoundingClientRect();
      const left = r.left - er.left + px + 12, maxL = er.width - tip.offsetWidth - 4;
      tip.style.left = Math.max(4, left > maxL ? left - tip.offsetWidth - 24 : left) + 'px';
      tip.style.top = (r.top - er.top + 8) + 'px';
    };
    const skryj = () => { tip.style.display = 'none'; car.setAttribute('opacity', '0'); };
    svg.addEventListener('pointermove', pohyb); svg.addEventListener('pointerleave', skryj);
  }

  /** Časová osa plánu (Gantt po dnech). kroky z DVJ.planPraci. */
  function gantt(kroky, o) {
    const P = (o && o.pal) || PAL_OBR, W = (o && o.w) || 640;
    const prace = kroky.filter((k) => k.typ !== 'vytvrzeni');
    const dny = Math.max(1, Math.ceil(Math.max(...prace.map((k) => k.do), 1) / 24 - 1e-9));
    const rH = 22, top = 22, ml = 58, mr = 22, pw = W - ml - mr, H = top + dny * rH + 26;
    const X = (h) => ml + h / 24 * pw;
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Liberation Sans, Arial, sans-serif" font-size="10.5" role="img" aria-label="Plán prací po dnech">`;
    s += `<rect width="${W}" height="${H}" fill="${P.pozadi}"/>`;
    for (let h = 0; h <= 24; h += 3) {
      s += `<line x1="${n(X(h))}" x2="${n(X(h))}" y1="${top - 4}" y2="${top + dny * rH}" stroke="${P.mrizka}"/>`;
      s += `<text x="${n(X(h))}" y="${top - 8}" text-anchor="middle" fill="${P.slaby}">${h}:00</text>`;
    }
    const barvy = { prace: P.s4, naneseni: P.s1, schnuti: P.s3 };
    for (let d = 0; d < dny; d++) s += `<text x="${ml - 6}" y="${top + d * rH + 15}" text-anchor="end" fill="${P.text}">den ${d + 1}</text>`;
    for (const k of prace) {
      for (let d = Math.floor(k.od / 24); d <= Math.floor((k.do - 1e-9) / 24) && d < dny; d++) {
        const a = Math.max(k.od, d * 24) - d * 24, b = Math.min(k.do, (d + 1) * 24) - d * 24;
        if (b - a <= 1e-6) continue;
        const y = top + d * rH + 4, hh = rH - 8;
        const sch = k.typ === 'schnuti';
        s += `<rect x="${n(X(a))}" y="${n(y + (sch ? 4 : 0))}" width="${n(Math.max(2, X(b) - X(a) - 1))}" height="${n(sch ? hh - 8 : hh)}" rx="2" fill="${barvy[k.typ] || P.s2}" opacity="${sch ? 0.45 : 0.95}"><title>${esc(k.akce)}</title></rect>`;
      }
    }
    const ly = H - 8;
    s += `<rect x="${ml}" y="${ly - 9}" width="12" height="9" fill="${P.s4}"/><text x="${ml + 16}" y="${ly}" fill="${P.text}">příprava / broušení</text>`;
    s += `<rect x="${ml + 140}" y="${ly - 9}" width="12" height="9" fill="${P.s1}"/><text x="${ml + 156}" y="${ly}" fill="${P.text}">nanášení</text>`;
    s += `<rect x="${ml + 230}" y="${ly - 7}" width="12" height="5" fill="${P.s3}" opacity="0.6"/><text x="${ml + 246}" y="${ly}" fill="${P.text}">schnutí</text>`;
    return s + '</svg>';
  }

  /** Příčný řez deskou z kmene s letokruhy: w, t (mm), x0 (posun středu desky od dřeně vodorovně), y0 (vzdálenost plochy od dřeně). */
  function rezKmene(o) {
    const P = o.pal || PAL_OBR, W = o.w || 320, H = o.h || 220;
    const w = o.sirka, t = o.tloustka, x0 = o.x0, y0 = Math.max(1, o.y0);
    // rozsah zobrazení: deska + dřeň
    const minX = Math.min(x0 - w / 2, 0) - 20, maxX = Math.max(x0 + w / 2, 0) + 20, minY = -20, maxY = y0 + t + 20;
    const sc = Math.min((W - 20) / (maxX - minX), (H - 30) / (maxY - minY));
    const X = (x) => 10 + (x - minX) * sc + ((W - 20) - (maxX - minX) * sc) / 2, Y = (y) => H - 20 - (y - minY) * sc;
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Liberation Sans, Arial, sans-serif" font-size="10.5" role="img" aria-label="Poloha desky v kmeni">`;
    s += `<rect width="${W}" height="${H}" fill="${P.pozadi}"/>`;
    const R = Math.hypot(Math.max(Math.abs(x0 - w / 2), Math.abs(x0 + w / 2)), y0 + t) + 15;
    s += `<defs><clipPath id="rk_clip"><rect x="${n(X(x0 - w / 2))}" y="${n(Y(y0 + t))}" width="${n(w * sc)}" height="${n(t * sc)}"/></clipPath></defs>`;
    s += `<circle cx="${n(X(0))}" cy="${n(Y(0))}" r="${n(R * sc)}" fill="none" stroke="${P.osa}" stroke-dasharray="4 3"/>`;
    s += `<rect x="${n(X(x0 - w / 2))}" y="${n(Y(y0 + t))}" width="${n(w * sc)}" height="${n(t * sc)}" fill="${P.drevo}" stroke="${P.text}" stroke-width="1.2"/>`;
    const krok = Math.max(3, R / 18);
    s += '<g clip-path="url(#rk_clip)">';
    for (let r = krok; r < R + krok; r += krok) s += `<circle cx="${n(X(0))}" cy="${n(Y(0))}" r="${n(r * sc)}" fill="none" stroke="${P.letokruh}" stroke-width="1"/>`;
    s += '</g>';
    s += `<circle cx="${n(X(0))}" cy="${n(Y(0))}" r="3" fill="${P.letokruh}"/><text x="${n(X(0) + 6)}" y="${n(Y(0) + 12)}" fill="${P.slaby}">dřeň</text>`;
    // šipka změny šířky
    const ya = Y(y0 + t) - 8;
    s += `<line x1="${n(X(x0 - w / 2))}" x2="${n(X(x0 + w / 2))}" y1="${n(ya)}" y2="${n(ya)}" stroke="${P.s1}" stroke-width="1.5" marker-start="url(#rk_s)" marker-end="url(#rk_s)"/>`;
    s += `<defs><marker id="rk_s" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${P.s1}"/></marker></defs>`;
    s += `<text x="${n(X(x0))}" y="${n(ya - 5)}" text-anchor="middle" fill="${P.text}">šířka ${fmtC(w, 0)} mm</text>`;
    return s + '</svg>';
  }

  /** Bokorys police se zvětšeným průhybem, podporami a kótami. v = výsledek DVJ.police, p = vstup. */
  function bokorysPolice(v, p, o) {
    const P = (o && o.pal) || PAL_OBR, W = (o && o.w) || 640, H = (o && o.h) || 200;
    const L = p.delka, ml = 20, mr = 20, sc = (W - ml - mr) / L;
    const wMax = Math.max(1e-9, Math.max(...v.dlouhodobe.w.map(Math.abs)));
    const zv = (o && o.zvetseni) || Math.min(400, Math.max(0, (H - 140)) / wMax); // px na mm průhybu
    const vyska = v.prurez.yMax - v.prurez.yMin; // celková výška průřezu (deska + lišty)
    const thL = Math.max(5, Math.min(28, vyska * sc * 2)), th = thL;
    const y0 = 60, X = (x) => ml + x * sc;
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Liberation Sans, Arial, sans-serif" font-size="10.5" role="img" aria-label="Bokorys police s průhybem">`;
    s += `<rect width="${W}" height="${H}" fill="${P.pozadi}"/>`;
    // přímá (nezatížená) poloha
    s += `<rect x="${n(X(0))}" y="${y0}" width="${n(L * sc)}" height="${n(th)}" fill="none" stroke="${P.osa}" stroke-dasharray="4 3"/>`;
    // zatížené – horní a spodní obrys
    const xs = v.okamzite.x, ws = v.dlouhodobe.w;
    const top = xs.map((x, i) => [X(x), y0 + ws[i] * zv]);
    const bot = xs.map((x, i) => [X(x), y0 + ws[i] * zv + thL]).reverse();
    s += `<path d="${top.concat(bot).map((q, i) => (i ? 'L' : 'M') + n(q[0]) + ' ' + n(q[1])).join('')}Z" fill="${P.drevo}" stroke="${P.text}" stroke-width="1"/>`;
    // zatížení – šipky
    const nSip = Math.max(4, Math.round(L / 80));
    if (v.qUzitne > 0) for (let i = 0; i <= nSip; i++) {
      const x = L * i / nSip, j = Math.min(xs.length - 1, Math.round(i / nSip * (xs.length - 1))), yy = y0 + ws[j] * zv;
      s += `<line x1="${n(X(x))}" x2="${n(X(x))}" y1="${n(yy - 22)}" y2="${n(yy - 3)}" stroke="${P.s2}" stroke-width="1.2"/><path d="M${n(X(x) - 3)} ${n(yy - 7)}L${n(X(x))} ${n(yy - 2)}L${n(X(x) + 3)} ${n(yy - 7)}" fill="none" stroke="${P.s2}" stroke-width="1.2"/>`;
    }
    if (p.bodKg > 0) {
      const j = xs.reduce((b, x, i) => (Math.abs(x - p.bodX) < Math.abs(xs[b] - p.bodX) ? i : b), 0), yy = y0 + ws[j] * zv;
      s += `<line x1="${n(X(p.bodX))}" x2="${n(X(p.bodX))}" y1="${n(yy - 44)}" y2="${n(yy - 3)}" stroke="${P.zla}" stroke-width="2"/><path d="M${n(X(p.bodX) - 5)} ${n(yy - 10)}L${n(X(p.bodX))} ${n(yy - 2)}L${n(X(p.bodX) + 5)} ${n(yy - 10)}" fill="${P.zla}"/>`;
      s += `<text x="${n(X(p.bodX) + 6)}" y="${n(yy - 34)}" fill="${P.text}">${fmtC(p.bodKg, 1)} kg</text>`;
    }
    s += `<text x="${ml}" y="16" fill="${P.text}">užitné ${fmtC(p.kgm, 1)} kg/m · průhyb zvětšen ${fmtC(zv / sc, 0)}×</text>`;
    // podpory
    for (const sp of p.podpory) {
      const xx = X(sp.x), j = xs.reduce((b, x, i) => (Math.abs(x - sp.x) < Math.abs(xs[b] - sp.x) ? i : b), 0), yy = y0 + ws[j] * zv + thL;
      if (sp.vetknuti) s += `<rect x="${n(xx - (sp.x < L / 2 ? 10 : 0))}" y="${n(y0 - 14)}" width="10" height="${n(thL + 28)}" fill="${P.osa}" opacity="0.6"/>`;
      else s += `<path d="M${n(xx)} ${n(yy)}L${n(xx - 8)} ${n(yy + 12)}L${n(xx + 8)} ${n(yy + 12)}Z" fill="${P.osa}"/>`;
    }
    // kóty úseků
    const yk = H - 34;
    const hr = [...new Set([0, ...p.podpory.map((q) => q.x), L])].sort((a, b) => a - b);
    for (let i = 0; i < hr.length - 1; i++) {
      const a = X(hr[i]), b = X(hr[i + 1]);
      if (b - a < 2) continue;
      s += `<line x1="${n(a)}" x2="${n(b)}" y1="${yk}" y2="${yk}" stroke="${P.slaby}"/><line x1="${n(a)}" x2="${n(a)}" y1="${yk - 5}" y2="${yk + 5}" stroke="${P.slaby}"/><line x1="${n(b)}" x2="${n(b)}" y1="${yk - 5}" y2="${yk + 5}" stroke="${P.slaby}"/>`;
      if (b - a > 30) s += `<text x="${n((a + b) / 2)}" y="${yk - 4}" text-anchor="middle" fill="${P.text}">${fmtC(hr[i + 1] - hr[i], 0)}</text>`;
    }
    const yc = H - 12;
    s += `<line x1="${n(X(0))}" x2="${n(X(L))}" y1="${yc}" y2="${yc}" stroke="${P.slaby}"/><text x="${n(X(L / 2))}" y="${yc - 3}" text-anchor="middle" fill="${P.text}">L = ${fmtC(L, 0)} mm</text>`;
    // max průhyb
    const jm = ws.reduce((b, w, i) => (Math.abs(w) > Math.abs(ws[b]) ? i : b), 0);
    s += `<text x="${W - mr}" y="16" text-anchor="end" fill="${P.text}" font-weight="600">max. δ = ${fmtC(ws[jm], 2)} mm v ${fmtC(xs[jm], 0)} mm</text>`;
    return s + '</svg>';
  }

  /** Příčný řez policí (deska + lišty) s kótami. */
  function prurezPolice(v, p, o) {
    const P = (o && o.pal) || PAL_OBR, W = (o && o.w) || 320, Hmax = (o && o.h) || 170;
    const cs = v.casti;
    const xs = [], ys = [];
    // x: deska 0..hloubka, přední lišta před deskou (x < 0), zadní za deskou
    const geo = cs.map((c, i) => {
      const x = i === 0 ? 0 : c.nazev === 'přední lišta' ? -c.b : p.hloubka;
      xs.push(x, x + c.b); ys.push(c.y, c.y + c.h);
      return { x, y: c.y, b: c.b, h: c.h, nazev: c.nazev };
    });
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const sc = Math.min((W - 110) / (maxX - minX), (Hmax - 60) / Math.max(1, maxY - minY), 6);
    const H = Math.min(Hmax, Math.max(90, Math.round((maxY - minY) * sc + 64)));
    const ox = 50 + ((W - 110) - (maxX - minX) * sc) / 2, oy = H - 30;
    const X = (x) => ox + (x - minX) * sc, Y = (y) => oy - (y - minY) * sc;
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Liberation Sans, Arial, sans-serif" font-size="10.5" role="img" aria-label="Příčný řez policí">`;
    s += `<rect width="${W}" height="${H}" fill="${P.pozadi}"/>`;
    geo.forEach((g, i) => { s += `<rect x="${n(X(g.x))}" y="${n(Y(g.y + g.h))}" width="${n(g.b * sc)}" height="${n(g.h * sc)}" fill="${i ? P.drevoT : P.drevo}" stroke="${P.text}" stroke-width="1"/>`; });
    // neutrální osa
    s += `<line x1="${n(X(minX) - 10)}" x2="${n(X(maxX) + 10)}" y1="${n(Y(v.prurez.yn))}" y2="${n(Y(v.prurez.yn))}" stroke="${P.zla}" stroke-dasharray="6 3 1 3"/>`;
    s += `<text x="${n(X(maxX) + 12)}" y="${n(Y(v.prurez.yn) + 4)}" fill="${P.zla}" font-size="10">n. o.</text>`;
    // kóty
    s += `<text x="${n(X(p.hloubka / 2))}" y="${n(oy + 16)}" text-anchor="middle" fill="${P.text}">hloubka ${fmtC(p.hloubka, 0)}</text>`;
    s += `<text x="${n(X(minX) - 6)}" y="${n(Y(p.tloustka / 2) + 4)}" text-anchor="end" fill="${P.text}">${fmtC(p.tloustka, 0)}</text>`;
    for (const g of geo.slice(1)) s += `<text x="${n(X(g.x + g.b / 2))}" y="${n(Y(g.y + g.h) - 4)}" text-anchor="middle" fill="${P.text}">${fmtC(g.b, 0)}×${fmtC(g.h, 0)}</text>`;
    s += `<text x="8" y="14" fill="${P.slaby}">předek ←</text>`;
    return s + '</svg>';
  }

  /** SVG → PNG data URL (prohlížeč) pro vložení do PDF. */
  function svgNaPng(svg, sirkaPx) {
    return new Promise((ok, chyba) => {
      const m = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg), w = m ? +m[1] : 640, h = m ? +m[2] : 300;
      const k = (sirkaPx || 1600) / w;
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
        const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
        ok({ data: c.toDataURL('image/png'), w, h });
      };
      img.onerror = () => chyba(new Error('SVG se nepodařilo převést'));
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
  }

  const GR = { PAL_OBR, PAL_PDF, ticky, cara, pripojHover, gantt, rezKmene, bokorysPolice, prurezPolice, svgNaPng, esc };
  koren.DVG = GR;
  if (typeof module !== 'undefined' && module.exports) module.exports = GR;
})(typeof window !== 'undefined' ? window : globalThis);

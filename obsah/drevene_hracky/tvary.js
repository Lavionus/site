/* ============================================================
   Dřevěné hračky – vektorové tvary zvířátek (vlastní kresba ze základních tvarů) a import SVG (bez DOM)
   Tvar = seznam primitiv v souřadnicích ~0–100 (y nahoru, chodidla na y = 0):
     ['e', cx, cy, rx, ry, rot°] elipsa · ['k', cx, cy, r] kruh · ['r', x0, y0, x1, y1, R] obdélník se zaoblením
     ['p', [[x,y]..]] polygon · ['c', [[x,y]..], w] tlustá čára · ['-', primitivum] odečíst
   Detaily (gravírování) stejnými primitivy + ['l', [[x,y]..]] otevřená čára.
   ============================================================ */
(function (koren) {
  'use strict';
  const DH = koren.DH || (typeof require !== 'undefined' ? require('./jadro.js') : null);

  const srdce = () => { const o = []; for (let i = 0; i < 80; i++) { const t = i / 80 * 2 * Math.PI; o.push([50 + 3.1 * 16 * Math.pow(Math.sin(t), 3), 52 + 3.1 * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))]); } return o; };
  const hvezda = (n, R, r) => { const o = []; for (let i = 0; i < 2 * n; i++) { const a = Math.PI / 2 + i * Math.PI / n, q = i % 2 ? r : R; o.push([50 + q * Math.cos(a), 50 + q * Math.sin(a)]); } return o; };

  const TVARY = {
    slon: { nazev: 'slon', stoji: true,
      p: [['e', 48, 46, 32, 24, 0], ['k', 80, 56, 17], ['c', [[90, 54], [98, 40], [97, 25], [92, 15]], 10], ['r', 21, 0, 35, 36, 4], ['r', 38, 0, 50, 30, 4], ['r', 57, 0, 69, 30, 4], ['r', 70, 0, 84, 38, 4], ['c', [[18, 50], [11, 40], [10, 31]], 3.5]],
      g: [['e', 72, 57, 9, 13, -10], ['k', 86, 63, 1.8]] },
    kocka: { nazev: 'kočka', stoji: true,
      p: [['e', 42, 30, 27, 32, 0], ['k', 58, 72, 17], ['p', [[44, 80], [47, 99], [58, 87]]], ['p', [[62, 87], [73, 99], [73, 79]]], ['c', [[20, 8], [6, 20], [7, 40], [15, 52]], 7], ['r', 46, 0, 68, 14, 6]],
      g: [['k', 52, 74, 1.8], ['k', 64, 74, 1.8], ['p', [[56, 68], [60, 68], [58, 65.5]]], ['l', [[56, 6], [56, 14]]], ['l', [[62, 6], [62, 14]]]] },
    pes: { nazev: 'pejsek', stoji: true,
      p: [['e', 45, 46, 28, 15, 0], ['e', 78, 64, 14, 12, 0], ['e', 92, 59, 9, 6, 0], ['e', 70, 60, 5, 12, 15], ['r', 19, 0, 29, 42, 4], ['r', 32, 0, 41, 38, 4], ['r', 55, 0, 64, 38, 4], ['r', 66, 0, 75, 42, 4], ['c', [[66, 50], [76, 60]], 14], ['c', [[19, 52], [9, 63], [7, 73]], 5]],
      g: [['k', 81, 67, 1.6], ['k', 99, 61, 1.8], ['l', [[66, 70], [71, 50]]]] },
    ryba: { nazev: 'rybka', stoji: true,
      p: [['e', 47, 34, 32, 18, 0], ['p', [[18, 34], [1, 52], [3, 16]]], ['p', [[36, 49], [50, 62], [62, 49]]], ['p', [[42, 18], [50, 11], [58, 18]]], ['r', 30, 0, 64, 6, 2], ['c', [[47, 6], [47, 16]], 12]],
      g: [['k', 68, 38, 2.5], ['l', [[58, 46], [55, 34], [58, 22]]], ['l', [[30, 40], [40, 34], [30, 28]]]] },
    ptacek: { nazev: 'ptáček', stoji: true,
      p: [['e', 45, 42, 25, 19, -15], ['k', 69, 58, 13], ['p', [[80, 61], [94, 57], [80, 53]]], ['p', [[24, 44], [2, 58], [10, 36]]], ['c', [[42, 26], [40, 6]], 3], ['c', [[52, 26], [54, 6]], 3], ['r', 25, 0, 70, 7, 3]],
      g: [['k', 72, 61, 1.8], ['l', [[34, 46], [46, 36], [58, 42]]]] },
    zelva: { nazev: 'želva', stoji: true,
      p: [['e', 48, 24, 34, 22, 0], ['r', 18, 0, 30, 14, 4], ['r', 64, 0, 76, 14, 4], ['e', 86, 18, 11, 8, 0], ['p', [[16, 14], [4, 9], [16, 8]]], ['r', 14, 0, 82, 6, 1]],
      g: [['k', 90, 20, 1.6], ['p', [[38, 20], [48, 14], [58, 20], [58, 32], [48, 38], [38, 32]]], ['l', [[38, 20], [24, 16]]], ['l', [[58, 20], [72, 16]]], ['l', [[48, 38], [48, 45]]]] },
    dino: { nazev: 'dinosaurus', stoji: true,
      p: [['e', 45, 40, 26, 18, 0], ['c', [[60, 46], [73, 66], [80, 82]], 11], ['e', 86, 86, 10, 6, 0], ['c', [[24, 40], [10, 30], [1, 22]], 8], ['r', 22, 0, 31, 32, 4], ['r', 34, 0, 42, 30, 4], ['r', 50, 0, 58, 30, 4], ['r', 60, 0, 68, 32, 4]],
      g: [['k', 88, 88, 1.3], ['l', [[30, 48], [45, 55], [60, 48]]]] },
    zajic: { nazev: 'zajíček', stoji: true,
      p: [['e', 40, 28, 28, 30, 0], ['e', 64, 62, 14, 13, 0], ['e', 57, 84, 5, 16, -12], ['e', 70, 83, 5, 15, -28], ['k', 12, 24, 8], ['r', 52, 0, 72, 10, 5]],
      g: [['k', 68, 65, 1.6], ['k', 77, 59, 1.4], ['e', 57, 84, 2, 10, -12]] },
    medved: { nazev: 'medvídek', stoji: true,
      p: [['e', 50, 36, 22, 26, 0], ['k', 50, 74, 17], ['k', 36, 88, 7], ['k', 64, 88, 7], ['c', [[33, 50], [23, 36]], 10], ['c', [[67, 50], [77, 36]], 10], ['r', 34, 0, 48, 22, 6], ['r', 52, 0, 66, 22, 6]],
      g: [['k', 44, 78, 1.8], ['k', 56, 78, 1.8], ['e', 50, 70, 6, 4, 0], ['e', 50, 34, 12, 14, 0]] },
    konik: { nazev: 'koník', stoji: true,
      p: [['e', 45, 48, 26, 14, 0], ['c', [[64, 52], [74, 72]], 14], ['e', 82, 76, 12, 7, -30], ['p', [[71, 80], [73, 93], [78, 82]]], ['r', 22, 0, 29, 44, 3], ['r', 32, 0, 39, 42, 3], ['r', 54, 0, 61, 42, 3], ['r', 64, 0, 71, 44, 3], ['c', [[19, 52], [10, 40], [9, 28]], 6]],
      g: [['k', 82, 79, 1.5], ['l', [[66, 62], [69, 74], [73, 82]]]] },
    kruh: { nazev: 'kruh', stoji: false, zakladni: true, p: [['k', 50, 50, 50]], g: [] },
    ctverec: { nazev: 'čtverec', stoji: false, zakladni: true, p: [['r', 0, 0, 100, 100, 6]], g: [] },
    trojuhelnik: { nazev: 'trojúhelník', stoji: false, zakladni: true, p: [['p', [[0, 0], [100, 0], [50, 87]]]], g: [] },
    hvezda: { nazev: 'hvězda', stoji: false, zakladni: true, p: [['p', hvezda(5, 52, 24)]], g: [] },
    srdce: { nazev: 'srdce', stoji: false, zakladni: true, p: [['p', srdce()]], g: [] },
    mesic: { nazev: 'měsíc', stoji: false, zakladni: true, p: [['k', 50, 50, 50], ['-', ['k', 70, 60, 40]]], g: [] },
  };
  DH.TVARY = TVARY;

  function primitivum(q) {
    switch (q[0]) {
      case 'e': return [DH.elipsa(q[1], q[2], q[3], q[4], (q[5] || 0) * Math.PI / 180, 72)];
      case 'k': return [DH.kruh(q[1], q[2], q[3], Math.max(20, Math.round(q[3] * 3)))];
      case 'r': return [DH.zaoblenyObd(q[1], q[2], q[3], q[4], q[5] || 0, 6)];
      case 'p': return [DH.plocha(q[1]) < 0 ? q[1].slice().reverse() : q[1]];
      case 'c': return DH.tlustaCara(q[1], q[2]);
      default: return [];
    }
  }
  /** detail jako čáry k gravírování: [{b, otevrena}] */
  function detaily(g, k) {
    const out = [];
    for (const q of g || []) {
      if (q[0] === 'l') out.push({ b: q[1].map((p) => [p[0] * k, p[1] * k]), otevrena: true });
      else for (const b of primitivum(q)) out.push({ b: b.map((p) => [p[0] * k, p[1] * k]) });
    }
    return out;
  }

  /**
   * Obrys tvaru v mm.
   * id: klíč TVARY nebo 'import' (pak data.importPolys = polygony v libovolných jednotkách)
   * o: {sirka (mm), zaobleni (poloměr výplně koutů, mm), naStoj (oříznout rovné chodidlo)}
   * → {obrys: [polygony (vnější kladně, díry záporně)], detaily: [{b, otevrena}], w, h, nazev}
   */
  DH.tvarMm = (id, o, data) => {
    o = o || {};
    const T = TVARY[id];
    let pol, det = [], nazev;
    if (id === 'import' || !T) {
      pol = (data && data.importPolys) || [];
      nazev = (data && data.importNazev) || 'vlastní tvar';
      if (!pol.length) return { obrys: [], detaily: [], w: 0, h: 0, nazev, prazdny: true };
    } else {
      const plus = [], minus = [];
      for (const q of T.p) (q[0] === '-' ? minus : plus).push(...(q[0] === '-' ? primitivum(q[1]) : primitivum(q)));
      pol = DH.sjednot(plus);
      if (minus.length) pol = DH.rozdil(pol, minus);
      if (T.stoji) pol = DH.prunik(pol, [DH.obdelnik(-50, 0, 200, 200)]);
      nazev = T.nazev;
    }
    const bb = DH.bbox(pol), k = (o.sirka || 150) / (bb.w || 1);
    pol = pol.map((b) => b.map((p) => [(p[0] - bb.x0) * k, (p[1] - bb.y0) * k]));
    if (T) det = detaily(T.g, 1).map((d) => ({ b: d.b.map((p) => [(p[0] - bb.x0) * k, (p[1] - bb.y0) * k]), otevrena: d.otevrena }));
    const z = Math.max(0, +o.zaobleni || 0);
    if (z > 0) {
      pol = DH.zaobli(pol, Math.min(z, 3), z);
      if (T && T.stoji) pol = DH.prunik(pol, [DH.obdelnik(-50, 0, 1e5, 1e5)]);
    }
    if (T) pol = pol.filter((b) => DH.plocha(b) > 0);      // vlastní tvary: bez vnitřních otvorů (pevnější, bez pastí na prsty)
    pol = pol.map((b) => DH.zjednodus(b, 0.05));
    // po zaoblení znovu přesně na požadovanou šířku (od x0, chodidla zůstanou na y = 0)
    const b1 = DH.bbox(pol), k2 = (o.sirka || 150) / (b1.w || 1), y0 = b1.y0;
    pol = pol.map((b) => b.map((p) => [(p[0] - b1.x0) * k2, (p[1] - y0) * k2]));
    det = det.map((d) => ({ b: d.b.map((p) => [(p[0] - b1.x0) * k2, (p[1] - y0) * k2]), otevrena: d.otevrena }));
    const b2 = DH.bbox(pol);
    return { obrys: pol, detaily: det, w: b2.w, h: b2.h, nazev, stoji: !!(T && T.stoji) };
  };

  /* ============================================================
     Import SVG (bez DOM): path, polygon, polyline, rect, circle, ellipse; transformace prvků i skupin.
     → {polys:[[x,y]..] (y nahoru), pocet, varovani}
     ============================================================ */
  const nasob = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
  const JED = [1, 0, 0, 1, 0, 0];
  function transformace(s) {
    let m = JED;
    if (!s) return m;
    const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g; let q;
    while ((q = re.exec(s))) {
      const a = q[2].split(/[\s,]+/).filter(Boolean).map(Number);
      let t = JED;
      if (q[1] === 'matrix' && a.length >= 6) t = a.slice(0, 6);
      else if (q[1] === 'translate') t = [1, 0, 0, 1, a[0] || 0, a[1] || 0];
      else if (q[1] === 'scale') t = [a[0], 0, 0, a[1] == null ? a[0] : a[1], 0, 0];
      else if (q[1] === 'rotate') { const u = (a[0] || 0) * Math.PI / 180, c = Math.cos(u), si = Math.sin(u); t = [c, si, -si, c, 0, 0]; if (a.length >= 3) t = nasob(nasob([1, 0, 0, 1, a[1], a[2]], t), [1, 0, 0, 1, -a[1], -a[2]]); }
      else if (q[1] === 'skewX') t = [1, 0, Math.tan((a[0] || 0) * Math.PI / 180), 1, 0, 0];
      else if (q[1] === 'skewY') t = [1, Math.tan((a[0] || 0) * Math.PI / 180), 0, 1, 0, 0];
      m = nasob(m, t);
    }
    return m;
  }
  const atr = (tag, jm) => { const q = new RegExp('(?:^|\\s)' + jm + '\\s*=\\s*("([^"]*)"|\'([^\']*)\')', 'i').exec(tag); return q ? (q[2] != null ? q[2] : q[3]) : null; };
  const cislo = (tag, jm, v) => { const x = parseFloat(atr(tag, jm)); return isFinite(x) ? x : v; };

  /** cesta SVG → podcesty [[x,y]..] (Béziery a oblouky rozložené na úsečky) */
  DH.cestaSvg = (d, jemnost) => {
    const tok = String(d).match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) || [];
    const out = []; let cur = null, i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0, cx = 0, cy = 0, qx = 0, qy = 0, prev = '';
    const n = () => parseFloat(tok[i++]);
    const kroky = jemnost || 16;
    const bod = (px, py) => { cur.push([px, py]); x = px; y = py; };
    const bez3 = (x1, y1, x2, y2, x3, y3) => { const x0 = x, y0 = y; for (let k = 1; k <= kroky; k++) { const t = k / kroky, u = 1 - t; bod(u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3, u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3); } };
    const bez2 = (x1, y1, x2, y2) => { const x0 = x, y0 = y; for (let k = 1; k <= kroky; k++) { const t = k / kroky, u = 1 - t; bod(u * u * x0 + 2 * u * t * x1 + t * t * x2, u * u * y0 + 2 * u * t * y1 + t * t * y2); } };
    const oblouk = (rx, ry, fi, fa, fs, x2, y2) => {
      const x1 = x, y1 = y; if (!rx || !ry) { bod(x2, y2); return; }
      rx = Math.abs(rx); ry = Math.abs(ry); const p = fi * Math.PI / 180, c = Math.cos(p), s = Math.sin(p);
      const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2, x1p = c * dx + s * dy, y1p = -s * dx + c * dy;
      const lam = x1p * x1p / (rx * rx) + y1p * y1p / (ry * ry); if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
      const zn = (fa === fs ? -1 : 1), num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p, den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
      const co = zn * Math.sqrt(Math.max(0, num / den)), cxp = co * rx * y1p / ry, cyp = -co * ry * x1p / rx;
      const ccx = c * cxp - s * cyp + (x1 + x2) / 2, ccy = s * cxp + c * cyp + (y1 + y2) / 2;
      const ug = (ux, uy, vx, vy) => { const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy); return a; };
      const t1 = ug(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry); let dt = ug((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
      if (!fs && dt > 0) dt -= 2 * Math.PI; else if (fs && dt < 0) dt += 2 * Math.PI;
      const k = Math.max(4, Math.ceil(Math.abs(dt) / (Math.PI / 18)));
      for (let j = 1; j <= k; j++) { const t = t1 + dt * j / k; bod(ccx + rx * Math.cos(t) * c - ry * Math.sin(t) * s, ccy + rx * Math.cos(t) * s + ry * Math.sin(t) * c); }
    };
    while (i < tok.length) {
      if (/[a-zA-Z]/.test(tok[i])) cmd = tok[i++];
      else if (!cmd) { i++; continue; }
      const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase(), ox = rel ? x : 0, oy = rel ? y : 0;
      if (C === 'M') { cur = []; out.push(cur); const a = n() + ox, b = n() + oy; bod(a, b); sx = a; sy = b; cmd = rel ? 'l' : 'L'; prev = 'M'; continue; }
      if (C === 'Z') { if (cur) { x = sx; y = sy; } cur = null; prev = 'Z'; continue; }
      if (!cur) { cur = [[x, y]]; out.push(cur); }
      if (C === 'L') bod(n() + ox, n() + oy);
      else if (C === 'H') bod(n() + ox, y);
      else if (C === 'V') bod(x, n() + oy);
      else if (C === 'C') { const a = n() + ox, b = n() + oy, c2 = n() + ox, d2 = n() + oy, e = n() + ox, f = n() + oy; cx = c2; cy = d2; bez3(a, b, c2, d2, e, f); }
      else if (C === 'S') { const a = prev === 'C' || prev === 'S' ? 2 * x - cx : x, b = prev === 'C' || prev === 'S' ? 2 * y - cy : y, c2 = n() + ox, d2 = n() + oy, e = n() + ox, f = n() + oy; cx = c2; cy = d2; bez3(a, b, c2, d2, e, f); }
      else if (C === 'Q') { const a = n() + ox, b = n() + oy, e = n() + ox, f = n() + oy; qx = a; qy = b; bez2(a, b, e, f); }
      else if (C === 'T') { const a = prev === 'Q' || prev === 'T' ? 2 * x - qx : x, b = prev === 'Q' || prev === 'T' ? 2 * y - qy : y, e = n() + ox, f = n() + oy; qx = a; qy = b; bez2(a, b, e, f); }
      else if (C === 'A') { const rx = n(), ry = n(), fi = n(), fa = n(), fs = n(), e = n() + ox, f = n() + oy; oblouk(rx, ry, fi, fa, fs, e, f); }
      else { i++; }
      prev = C;
      if (tok.length && i > tok.length + 5) break;
    }
    return out.filter((q) => q.length >= 3);
  };

  DH.importSvg = (text) => {
    const polys = [], varovani = [];
    const zasobnik = [JED];
    const re = /<\s*(\/?)\s*([a-zA-Z:]+)([^>]*?)(\/?)\s*>/g; let q, pocet = 0;
    const src = String(text).replace(/<!--[\s\S]*?-->/g, '').replace(/<(defs|clipPath|mask|symbol|style|metadata)[\s\S]*?<\/\1>/gi, '');
    while ((q = re.exec(src))) {
      const zav = q[1] === '/', jm = q[2].toLowerCase(), tag = q[3], samo = q[4] === '/' || /\/$/.test(tag);
      if (zav) { if (jm === 'g' || jm === 'svg' || jm === 'a') zasobnik.pop(); if (!zasobnik.length) zasobnik.push(JED); continue; }
      const m = nasob(zasobnik[zasobnik.length - 1], transformace(atr(tag, 'transform')));
      if (jm === 'g' || jm === 'svg' || jm === 'a') { if (!samo) zasobnik.push(m); continue; }
      if (/fill\s*[:=]\s*["']?none/i.test(tag) && !/stroke/i.test(tag)) continue;
      let pod = [];
      if (jm === 'path') pod = DH.cestaSvg(atr(tag, 'd') || '');
      else if (jm === 'polygon' || jm === 'polyline') { const c = (atr(tag, 'points') || '').split(/[\s,]+/).filter(Boolean).map(Number); const b = []; for (let k = 0; k + 1 < c.length; k += 2) b.push([c[k], c[k + 1]]); pod = [b]; }
      else if (jm === 'rect') { const x = cislo(tag, 'x', 0), y = cislo(tag, 'y', 0), w = cislo(tag, 'width', 0), h = cislo(tag, 'height', 0), rx = cislo(tag, 'rx', cislo(tag, 'ry', 0)); if (w > 0 && h > 0) pod = [DH.zaoblenyObd(x, y, x + w, y + h, rx, 6)]; }
      else if (jm === 'circle') { const r = cislo(tag, 'r', 0); if (r > 0) pod = [DH.kruh(cislo(tag, 'cx', 0), cislo(tag, 'cy', 0), r, 64)]; }
      else if (jm === 'ellipse') { const rx = cislo(tag, 'rx', 0), ry = cislo(tag, 'ry', 0); if (rx > 0 && ry > 0) pod = [DH.elipsa(cislo(tag, 'cx', 0), cislo(tag, 'cy', 0), rx, ry, 0, 64)]; }
      else continue;
      for (const b of pod) { if (b.length < 3) continue; polys.push(b.map(([x, y]) => [m[0] * x + m[2] * y + m[4], -(m[1] * x + m[3] * y + m[5])])); pocet++; }
    }
    if (!pocet) varovani.push('V SVG nejsou žádné vyplněné tvary (path, polygon, rect, circle, ellipse).');
    let vysl = polys.length ? DH.sjednot(polys) : [];
    if (polys.length && Math.abs(DH.plochaPoli(vysl)) < 1e-9) vysl = DH.sjednot(polys, 'eo');
    return { polys: vysl, pocet, varovani };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = DH;
})(typeof window !== 'undefined' ? window : globalThis);

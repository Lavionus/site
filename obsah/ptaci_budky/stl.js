/* ============================================================
   Ptačí budky – STL pro 3D tisk (manifold-3d z obsah/lib/manifold, Apache-2.0; modul WASM parametrem w)
   - tunel(w, o): kryt vletového otvoru proti kunám a strakám (prodloužený tunel s přírubou)
       příruba leží na tiskové podložce (z = 0), tunel roste nahoru → bez převisů, bez podpěr
   - stitek(w, font (opentype.Font), o): štítek s vystouplým textem a dvěma otvory na vruty
   - kontrolaSite(poz, idx): uzavřenost (každá orientovaná hrana má protějšek), objem
   - stlBinarni(poz, idx, nazev)
   Souřadnice mm, z nahoru.
   ============================================================ */
(function (koren) {
  'use strict';
  const r2 = (x) => Math.round(x * 100) / 100;

  function elipsa(cx, cy, rx, ry, n, opacne) {
    const out = [];
    for (let i = 0; i < n; i++) { const a = (opacne ? -1 : 1) * i / n * Math.PI * 2; out.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); }
    return out;
  }
  function zaoblenyObd(w, h, r, n) {
    r = Math.max(0.1, Math.min(r, w / 2 - 0.01, h / 2 - 0.01));
    const out = [], st = [[w / 2 - r, h / 2 - r, 0], [-w / 2 + r, h / 2 - r, 90], [-w / 2 + r, -h / 2 + r, 180], [w / 2 - r, -h / 2 + r, 270]];
    for (const [cx, cy, a0] of st) for (let i = 0; i <= n; i++) { const a = (a0 + 90 * i / n) * Math.PI / 180; out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
    return out;
  }
  const segmentu = (r) => Math.max(32, Math.min(128, Math.round(r * 4)));

  function sit(m, navic) {
    const st = m.status();
    if (st !== 'NoError' && st !== 0 && !(st && st.value === 0)) throw new Error('manifold hlásí ' + st);
    const mesh = m.getMesh(), np = mesh.numProp, vp = mesh.vertProperties;
    const poz = new Float32Array(vp.length / np * 3);
    for (let q = 0, t = 0; q < vp.length; q += np, t += 3) { poz[t] = vp[q]; poz[t + 1] = vp[q + 1]; poz[t + 2] = vp[q + 2]; }
    const bb = m.boundingBox();
    return Object.assign({ poz, idx: new Uint32Array(mesh.triVerts), objem: m.volume(), rod: m.genus(), rozmer: [r2(bb.max[0] - bb.min[0]), r2(bb.max[1] - bb.min[1]), r2(bb.max[2] - bb.min[2])] }, navic || {});
  }

  /** výchozí tunel podle otvoru budky */
  function vychoziTunel(B) {
    const o = B && B.info && B.info.otv;
    const w = o ? o.w : 32, h = o ? o.h : 32;
    return { tvar: o && o.tvar === 'oval' ? 'oval' : 'kruh', w, h, delka: Math.max(40, Math.min(80, Math.round(Math.max(w, h) * 1.5 / 5) * 5)), stena: 2.5, deska: 3, lem: 12, sroub: 3.5, vule: 0.5 };
  }
  /**
   * tunel(w, o) → síť; o: {tvar 'kruh'|'oval', w, h (světlost otvoru), delka (celková výška tunelu nad přírubou),
   *   stena, deska (tl. příruby), lem (šířka příruby kolem tunelu), sroub (Ø vrutu), vule (přídavek na světlost)}
   */
  function tunel(w, oin) {
    const o = Object.assign({ tvar: 'kruh', w: 32, h: 32, delka: 50, stena: 2.5, deska: 3, lem: 12, sroub: 3.5, vule: 0.5 }, oin || {});
    const smaz = [], k = (x) => { smaz.push(x); return x; };
    try {
      const st = Math.max(2, +o.stena), T = Math.max(2, +o.deska), L = Math.max(T + 5, +o.delka), lem = Math.max(8, +o.lem);
      const rx = (+o.w + +o.vule) / 2, ry = (o.tvar === 'oval' ? +o.h + +o.vule : +o.w + +o.vule) / 2;
      const n = segmentu(Math.max(rx, ry));
      const W = 2 * (rx + st + lem), H = 2 * (ry + st + lem);
      const deska = k(k(new w.CrossSection([zaoblenyObd(W, H, 6, 8)], 'Positive')).extrude(T));
      const trubka = k(k(new w.CrossSection([elipsa(0, 0, rx + st, ry + st, n)], 'Positive')).extrude(L));
      let telo = k(deska.add(trubka));
      const dutina = k(k(k(new w.CrossSection([elipsa(0, 0, rx, ry, n)], 'Positive')).extrude(L + 2)).translate([0, 0, -1]));
      telo = k(telo.subtract(dutina));
      // otvory pro vruty v rozích příruby
      const rs = (+o.sroub + 0.4) / 2, ox = W / 2 - lem / 2 - 1.5, oy = H / 2 - lem / 2 - 1.5;
      const vruty = [];
      for (const [x, y] of [[ox, oy], [-ox, oy], [-ox, -oy], [ox, -oy]]) {
        if (Math.hypot(x / (rx + st + rs + 1), y / (ry + st + rs + 1)) < 1.05) continue;
        telo = k(telo.subtract(k(k(w.Manifold.cylinder(T + 2, rs, rs, 24, false)).translate([x, y, -1]))));
        vruty.push([r2(x), r2(y)]);
      }
      const varovani = [];
      if (W > 220 || H > 220) varovani.push(`Příruba ${Math.round(W)} × ${Math.round(H)} mm je větší než běžná tisková plocha 220 × 220 mm – zmenšete lem.`);
      return sit(telo, { svetlost: [r2(2 * rx), r2(2 * ry)], vnejsi: [r2(W), r2(H)], vruty, varovani, delka: L, stena: st });
    } finally { for (const x of smaz) { try { x.delete(); } catch (e) { /* uvolněno */ } } }
  }

  /* ---------------- text z písma (opentype.js) → obrysy ---------------- */
  function obrysyTextu(font, text, velikost, x0, y0) {
    const path = font.getPath(text, 0, 0, velikost), cesty = [];
    let akt = null, px = 0, py = 0;
    const B = (x, y) => [x, -y];   // opentype má y dolů
    for (const c of path.commands) {
      if (c.type === 'M') { if (akt && akt.length > 2) cesty.push(akt); akt = [B(c.x, c.y)]; px = c.x; py = c.y; }
      else if (c.type === 'L') { akt.push(B(c.x, c.y)); px = c.x; py = c.y; }
      else if (c.type === 'Q') { for (let i = 1; i <= 6; i++) { const t = i / 6, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, d = t * t; akt.push(B(a * px + b * c.x1 + d * c.x, a * py + b * c.y1 + d * c.y)); } px = c.x; py = c.y; }
      else if (c.type === 'C') { for (let i = 1; i <= 8; i++) { const t = i / 8, a = (1 - t) ** 3, b = 3 * (1 - t) ** 2 * t, e = 3 * (1 - t) * t * t, d = t ** 3; akt.push(B(a * px + b * c.x1 + e * c.x2 + d * c.x, a * py + b * c.y1 + e * c.y2 + d * c.y)); } px = c.x; py = c.y; }
      else if (c.type === 'Z') { if (akt && akt.length > 2) cesty.push(akt); akt = null; }
    }
    if (akt && akt.length > 2) cesty.push(akt);
    // ohraničení a posun
    let mx = Infinity, Mx = -Infinity, my = Infinity, My = -Infinity;
    for (const c of cesty) for (const [x, y] of c) { mx = Math.min(mx, x); Mx = Math.max(Mx, x); my = Math.min(my, y); My = Math.max(My, y); }
    if (!cesty.length) return { cesty: [], sirka: 0, vyska: 0 };
    const sx = x0 - (mx + Mx) / 2, sy = y0 - (my + My) / 2;
    return { cesty: cesty.map((c) => c.map(([x, y]) => [x + sx, y + sy])), sirka: Mx - mx, vyska: My - my };
  }

  /**
   * stitek(w, font, o) → síť; o: {radky: ['…', '…'], sirka, vyska, tl, vyskaTextu (vystoupení), otvory (true = 2 otvory na vruty), sroub}
   */
  function stitek(w, font, oin) {
    const o = Object.assign({ radky: ['Sýkora koňadra', '2026'], sirka: 90, vyska: 32, tl: 3, vyskaTextu: 1, otvory: true, sroub: 3.5 }, oin || {});
    const smaz = [], k = (x) => { smaz.push(x); return x; };
    try {
      const W = Math.max(30, Math.min(220, +o.sirka)), H = Math.max(15, Math.min(220, +o.vyska)), T = Math.max(2, +o.tl), ht = Math.max(0.4, +o.vyskaTextu);
      let telo = k(k(new w.CrossSection([zaoblenyObd(W, H, 4, 8)], 'Positive')).extrude(T));
      const rs = (+o.sroub + 0.4) / 2, ox = W / 2 - 3 - rs;
      const okrajX = o.otvory ? 2 * (3 + 2 * rs + 2) : 8;
      if (o.otvory) for (const x of [ox, -ox]) telo = k(telo.subtract(k(k(w.Manifold.cylinder(T + 2, rs, rs, 24, false)).translate([x, 0, -1]))));
      const radky = (o.radky || []).map((s) => String(s).trim()).filter(Boolean).slice(0, 3);
      const varovani = [];
      if (font && radky.length) {
        const volnaW = W - okrajX - 4, volnaH = H - 6, rh = volnaH / radky.length;
        radky.forEach((txt, i) => {
          // velikost tak, aby se řádek vešel do šířky i výšky
          let vel = rh * 1.25, g = obrysyTextu(font, txt, vel, 0, 0);
          if (g.sirka > volnaW) vel *= volnaW / g.sirka;
          if (g.vyska * vel / (rh * 1.25) > rh * 0.82) vel = Math.min(vel, rh * 0.82 / (g.vyska / (rh * 1.25)));
          const yc = H / 2 - 3 - rh * (i + 0.5);
          g = obrysyTextu(font, txt, vel, 0, yc);
          if (g.vyska < 3.5) varovani.push(`Řádek „${txt}“ vychází jen ${g.vyska.toFixed(1)} mm vysoký – na FDM tisku bude špatně čitelný (zkraťte text nebo zvětšete štítek).`);
          if (!g.cesty.length) return;
          const cs = k(new w.CrossSection(g.cesty, 'EvenOdd'));
          telo = k(telo.add(k(k(cs.extrude(ht + 0.01)).translate([0, 0, T - 0.01]))));
        });
      }
      return sit(telo, { varovani, rozmerStitku: [W, H, T + ht] });
    } finally { for (const x of smaz) { try { x.delete(); } catch (e) { /* uvolněno */ } } }
  }

  function kontrolaSite(poz, idx) {
    const hrany = new Map();
    let chyb = 0, objem = 0;
    for (let t = 0; t < idx.length; t += 3) {
      const v = [idx[t], idx[t + 1], idx[t + 2]];
      for (let i = 0; i < 3; i++) { const kl = v[i] + ',' + v[(i + 1) % 3]; hrany.set(kl, (hrany.get(kl) || 0) + 1); }
      const A = v[0] * 3, B = v[1] * 3, C = v[2] * 3;
      objem += (poz[A] * (poz[B + 1] * poz[C + 2] - poz[B + 2] * poz[C + 1]) - poz[A + 1] * (poz[B] * poz[C + 2] - poz[B + 2] * poz[C]) + poz[A + 2] * (poz[B] * poz[C + 1] - poz[B + 1] * poz[C])) / 6;
    }
    for (const [kl, c] of hrany) { const [a, b] = kl.split(','); if (c !== 1 || hrany.get(b + ',' + a) !== 1) chyb++; }
    return { uzavrena: chyb === 0, chybnychHran: chyb, objem, trojuhelniku: idx.length / 3 };
  }
  function stlBinarni(poz, idx, nazev) {
    const n = idx.length / 3, buf = new ArrayBuffer(84 + 50 * n), dv = new DataView(buf);
    const hl = String(nazev || 'ptaci budka').normalize('NFD').replace(/[^\x20-\x7e]/g, '').slice(0, 79);
    for (let i = 0; i < hl.length; i++) dv.setUint8(i, hl.charCodeAt(i));
    dv.setUint32(80, n, true);
    let o = 84;
    for (let t = 0; t < n; t++) {
      const a = idx[3 * t] * 3, b = idx[3 * t + 1] * 3, c = idx[3 * t + 2] * 3;
      const ux = poz[b] - poz[a], uy = poz[b + 1] - poz[a + 1], uz = poz[b + 2] - poz[a + 2], vx = poz[c] - poz[a], vy = poz[c + 1] - poz[a + 1], vz = poz[c + 2] - poz[a + 2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1;
      dv.setFloat32(o, nx / l, true); dv.setFloat32(o + 4, ny / l, true); dv.setFloat32(o + 8, nz / l, true); o += 12;
      for (const q of [a, b, c]) { dv.setFloat32(o, poz[q], true); dv.setFloat32(o + 4, poz[q + 1], true); dv.setFloat32(o + 8, poz[q + 2], true); o += 12; }
      o += 2;
    }
    return buf;
  }

  const API = { tunel, vychoziTunel, stitek, obrysyTextu, kontrolaSite, stlBinarni };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.PBSTL = API;
})(typeof window !== 'undefined' ? window : globalThis);

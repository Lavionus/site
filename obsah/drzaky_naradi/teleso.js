/* ============================================================
   Držáky nářadí a Gridfinity – tělesa pro 3D tisk (manifold-3d z obsah/lib/manifold, Apache-2.0)
   Modul WASM se předává parametrem w (po w.setup()). Písmo pro vyryté popisky = objekt opentype.js
   (nepovinné; bez něj se popisky v STL vynechají).
   Všechny funkce vracejí {poz, idx, objem, rod, bbox} – těsnou síť z manifoldu.
   - podlozka(w, P, dilId)          díl podložky v souřadnicích mřížky (z = 0 spodek)
   - krabicka(w, K, font)           krabička / vložka v souřadnicích mřížky
   - drzak(w, G, font, o)           držák na lištu; o.tisk = true → v orientaci tisku, o.cast = index dílu
   - hak(w, H, o)                   pegboard háček (tisk naplocho)
   - koncovka(w, L)                 koncovka lišty French cleat
   - listaSit(w, L, delka)          dřevěná lišta (jen pro 3D náhled)
   - stlBinarni(poz, idx, nazev), zip(soubory)
   ============================================================ */
(function (koren) {
  'use strict';
  const DN = koren.DN || (typeof require !== 'undefined' ? require('./jadro.js') : null);
  const GF = DN.GF;
  const SEG_ROH = 8;

  function sit(m, navic) {
    const st = m.status();
    if (st !== 'NoError') throw new Error('manifold hlásí ' + st);
    const mesh = m.getMesh(), np = mesh.numProp, vp = mesh.vertProperties;
    const poz = new Float32Array(vp.length / np * 3);
    for (let q = 0, t = 0; q < vp.length; q += np, t += 3) { poz[t] = vp[q]; poz[t + 1] = vp[q + 1]; poz[t + 2] = vp[q + 2]; }
    const bb = m.boundingBox();
    return Object.assign({ poz, idx: new Uint32Array(mesh.triVerts), objem: m.volume(), rod: m.genus(), bbox: { min: Array.from(bb.min), max: Array.from(bb.max) } }, navic || {});
  }
  /** obal pro uvolňování objektů WASM */
  function s(w, fn) {
    const smaz = [], k = (x) => { smaz.push(x); return x; };
    try { return fn(w.Manifold, w.CrossSection, k); }
    finally { for (const x of smaz) { try { x.delete(); } catch (e) { /* už uvolněno */ } } }
  }

  /** body zaobleného obdélníku (proti směru hodin) */
  function rrBody(x0, y0, x1, y1, r) {
    r = Math.max(0.02, Math.min(r, (x1 - x0) / 2 - 1e-4, (y1 - y0) / 2 - 1e-4));
    const out = [], st = [[x1 - r, y0 + r, -90], [x1 - r, y1 - r, 0], [x0 + r, y1 - r, 90], [x0 + r, y0 + r, 180]];
    for (const [cx, cy, a0] of st) for (let i = 0; i <= SEG_ROH; i++) { const a = (a0 + i * 90 / SEG_ROH) * Math.PI / 180; out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
    return out;
  }
  /** zkosená/svislá část: konvexní obal dvou zaoblených obdélníků (vnější obrys o, odsazení d, výška z) */
  function patro(M, k, o, R, dA, zA, dB, zB) {
    const pts = [];
    for (const [d, z] of [[dA, zA], [dB, zB]]) for (const [x, y] of rrBody(o[0] + d, o[1] + d, o[2] - d, o[3] - d, R - d)) pts.push([x, y, z]);
    return k(M.hull(pts));
  }
  /** svislý sloupec profilu [[d, z], …] (odsazení dovnitř, výška) → sjednocení pater */
  function sloupec(M, k, o, R, body) {
    const casti = [];
    for (let i = 1; i < body.length; i++) casti.push(patro(M, k, o, R, body[i - 1][0], body[i - 1][1], body[i][0], body[i][1]));
    return casti.length === 1 ? casti[0] : k(M.union(casti));
  }
  const box = (M, k, x0, y0, z0, x1, y1, z1) => k(k(M.cube([x1 - x0, y1 - y0, z1 - z0], false)).translate([x0, y0, z0]));
  const valec = (M, k, x, y, z0, z1, r, seg) => k(k(M.cylinder(z1 - z0, r, r, seg || Math.max(24, Math.min(72, Math.round(r * 8))), false)).translate([x, y, z0]));
  /** profil v rovině (u, v) vytažený podél osy x: (u, v, w) → (x = w, y = u, z = v) */
  function vytahniX(M, CS, k, body, x0, x1) {
    const cs = k(new CS([cistyPolygon(body)], 'Positive'));
    return k(k(k(cs.extrude(x1 - x0)).rotate([90, 0, 90])).translate([x0, 0, 0]));
  }
  /** odstraní opakované body a zajistí orientaci proti směru hodin */
  function cistyPolygon(b) {
    let out = b.filter((q, i) => { const p = b[(i + b.length - 1) % b.length]; return Math.hypot(q[0] - p[0], q[1] - p[1]) > 1e-6; });
    let a = 0; for (let i = 0; i < out.length; i++) { const p = out[i], q = out[(i + 1) % out.length]; a += p[0] * q[1] - q[0] * p[1]; }
    if (a < 0) out = out.slice().reverse();
    return out;
  }

  /* ---------------- text (opentype.js → polygony) ---------------- */
  function textPolygony(font, text, h) {
    if (!font || !text) return null;
    const upm = font.unitsPerEm || 2048, cap = (font.tables && font.tables.os2 && font.tables.os2.sCapHeight) || upm * 0.72;
    const vel = h * upm / cap, path = font.getPath(String(text), 0, 0, vel), polys = [];
    let cur = null, x = 0, y = 0;
    const add = (a, b) => { x = a; y = b; cur.push([a, -b]); };
    for (const c of path.commands) {
      if (c.type === 'M') { if (cur && cur.length > 2) polys.push(cur); cur = []; add(c.x, c.y); }
      else if (c.type === 'L') add(c.x, c.y);
      else if (c.type === 'Q') { const x0 = x, y0 = y; for (let i = 1; i <= 6; i++) { const t = i / 6, u = 1 - t; add(u * u * x0 + 2 * u * t * c.x1 + t * t * c.x, u * u * y0 + 2 * u * t * c.y1 + t * t * c.y); } }
      else if (c.type === 'C') { const x0 = x, y0 = y; for (let i = 1; i <= 8; i++) { const t = i / 8, u = 1 - t; add(u * u * u * x0 + 3 * u * u * t * c.x1 + 3 * u * t * t * c.x2 + t * t * t * c.x, u * u * u * y0 + 3 * u * u * t * c.y1 + 3 * u * t * t * c.y2 + t * t * t * c.y); } }
      else if (c.type === 'Z') { if (cur && cur.length > 2) polys.push(cur); cur = null; }
    }
    if (cur && cur.length > 2) polys.push(cur);
    if (!polys.length) return null;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of polys) for (const [a, b] of p) { x0 = Math.min(x0, a); x1 = Math.max(x1, a); y0 = Math.min(y0, b); y1 = Math.max(y1, b); }
    return { polys, x0, x1, y0, y1, w: x1 - x0, h: y1 - y0 };
  }
  /** vyrytí textu shora do plochy z (hloubka hl), střed textu v (cx, cy); maxW = největší šířka */
  function rytina(M, CS, k, font, text, h, cx, cy, z, hl, maxW, otoc) {
    let T = textPolygony(font, text, h);
    if (!T) return null;
    if (maxW && T.w > maxW) T = textPolygony(font, text, h * maxW / T.w);
    let cs = k(new CS(T.polys, 'NonZero'));
    const sx = T.x0 + T.w / 2, sy = T.y0 + T.h / 2;
    // otoc: text otočený o 180° (čte se od −y, tj. stojíte-li před stěnou)
    if (otoc) { cs = k(cs.rotate(180)); return k(k(cs.extrude(hl + 1)).translate([cx + sx, cy + sy, z - hl])); }
    return k(k(cs.extrude(hl + 1)).translate([cx - sx, cy - sy, z - hl]));
  }

  /* ---------------- podložka ---------------- */
  function podlozka(w, P0, dilId) {
    const P = P0.deleni ? P0 : DN.podlozka(P0);
    return s(w, (M, CS, k) => {
      const dily = dilId ? P.deleni.dily.filter((d) => d.id === dilId) : P.deleni.dily;
      if (!dily.length) throw new Error('díl podložky ' + dilId + ' neexistuje');
      const zF = P.sDnem ? P.dnoTl : 0, Hp = P.vyska, g = GF.roztec;
      const obrys = [P.x0, P.y0, P.x1, P.y1];
      const telesa = [];
      for (const d of dily) {
        let t = k(box(M, k, d.x0, d.y0, 0, d.x1, d.y1, Hp).intersect(patro(M, k, obrys, GF.rPodlozky, 0, -1, 0, Hp + 1)));
        const rezy = [], diry = [];
        const pp = GF.profilPodlozky, vr = pp[pp.length - 1][0];
        for (let i = d.bx0; i < d.bx1; i++) for (let j = d.by0; j < d.by1; j++) {
          const o = [i * g, j * g, (i + 1) * g, (j + 1) * g], cl = GF.vyskaPodlozky - pp[3][1];
          const body = [[vr, P.sDnem ? zF : -1], [vr, zF + cl]];
          for (let q = 1; q < pp.length; q++) body.push([vr - pp[q][0], zF + cl + pp[q][1]]);
          body.push([0, Hp + 1]);
          rezy.push(sloupec(M, k, o, GF.rPodlozky, body));
          if (P.sDnem && P.magnety) for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) diry.push(valec(M, k, o[0] + g / 2 + sx * GF.otvorOdStredu, o[1] + g / 2 + sy * GF.otvorOdStredu, zF - GF.hloubkaMagnetu, zF + 0.5, GF.otvorMagnetu / 2, 40));
          if (P.sDnem && P.vruty) {
            const rs = DN.cislo(P.vrutD, 4) / 2 + 0.2, rh = Math.max(rs + 0.5, DN.cislo(P.vrutHlava, 8) / 2 + 0.2), cx = o[0] + g / 2, cy = o[1] + g / 2;
            diry.push(valec(M, k, cx, cy, -1, zF + 0.5, rs, 32));
            diry.push(k(k(M.cylinder(rh - rs + 0.01, rs, rh, 40, false)).translate([cx, cy, zF - (rh - rs)])));
          }
        }
        t = k(t.subtract(k(M.union(rezy.concat(diry)))));
        telesa.push(t);
      }
      const vse = telesa.length === 1 ? telesa[0] : k(M.union(telesa));
      return sit(vse, { dilu: dily.length });
    });
  }

  /* ---------------- krabička / vložka ---------------- */
  function krabicka(w, K0, font) {
    const K = K0.komory ? K0 : DN.krabicka(K0);
    return s(w, (M, CS, k) => {
      const g = GF.roztec, o = [K.x0, K.y0, K.x1, K.y1], R = GF.rKrabicky, H = K.vyska;
      const pk = GF.profilKrabicky, vr = pk[pk.length - 1][0];
      const dily = [];
      // podstava každé buňky
      for (let i = 0; i < K.n; i++) for (let j = 0; j < K.m; j++) {
        const c = [(K.gx + i) * g + GF.mezera / 2, (K.gy + j) * g + GF.mezera / 2, (K.gx + i + 1) * g - GF.mezera / 2, (K.gy + j + 1) * g - GF.mezera / 2];
        dily.push(sloupec(M, k, c, R, pk.map((q) => [vr - q[0], q[1]])));
      }
      dily.push(patro(M, k, o, R, 0, pk[pk.length - 1][1] - 0.01, 0, K.vyskaCelkem));
      let t = k(M.union(dily));
      // dutina: stěna 0,95, opora lemu 45°, lem 0,7 / 1,8 / 1,9
      const dut = K.lem
        ? [[GF.stena, K.zDno], [GF.stena, H - GF.oporaLemu - (2.6 - GF.stena)], [2.6, H - GF.oporaLemu], [2.6, H], [1.9, H + 0.7], [1.9, H + 2.5], [0, H + 4.4], [-1, H + 5.4]]
        : [[GF.stena, K.zDno], [GF.stena, H + 1]];
      t = k(t.subtract(sloupec(M, k, o, R, dut)));
      const pridat = [], ubrat = [];
      const vnitrek = patro(M, k, o, R, GF.stena - 0.05, K.zDno - 0.01, GF.stena - 0.05, K.zKomor);
      if (K.vlozka) {
        // výplň do výšky zKomor a kapsy
        pridat.push(vnitrek);
        const V = DN.vlozka(K, K.vlozka);
        for (const p of V.kapsy) {
          const z0 = p.dnoZ, z1 = K.zKomor + 1, t0 = p.t, v = DN.cislo(V.V.vule, 0.4);
          if (t0.tvar === 'valec') ubrat.push(valec(M, k, p.gx, p.gy, z0, z1, p.pkw / 2));
          else if (t0.tvar === 'sestihran') ubrat.push(k(k(M.cylinder(z1 - z0, p.pkw / 2, p.pkw / 2, 6, false)).translate([p.gx, p.gy, z0])));
          else if (t0.tvar === 'lezici') {
            const r = p.rot ? p.pkw / 2 : p.pkh / 2, delka = p.rot ? p.pkh : p.pkw, za = z0 + r;
            let c = k(M.cylinder(delka, r, r, 48, true));
            c = k(c.rotate(p.rot ? [90, 0, 0] : [0, 90, 0]));
            ubrat.push(k(c.translate([p.gx, p.gy, za])));
            ubrat.push(p.rot ? box(M, k, p.gx - r, p.gy - delka / 2, za, p.gx + r, p.gy + delka / 2, z1) : box(M, k, p.gx - delka / 2, p.gy - r, za, p.gx + delka / 2, p.gy + r, z1));
          } else if (t0.tvar === 'obrys' && t0.body && t0.body.length > 2) {
            const xs = t0.body.map((q) => q[0]), ys = t0.body.map((q) => q[1]);
            const mx = (Math.min(...xs) + Math.max(...xs)) / 2, my = (Math.min(...ys) + Math.max(...ys)) / 2;
            let cs = k(new CS([cistyPolygon(t0.body.map((q) => [q[0] - mx, q[1] - my]))], 'Positive'));
            if (v > 0) cs = k(cs.offset(v / 2, 'Round', 2, 24));
            if (p.rot) cs = k(cs.rotate(90));
            ubrat.push(k(k(cs.extrude(z1 - z0)).translate([p.gx, p.gy, z0])));
          } else {
            const a = p.pkw, b = p.pkh;
            ubrat.push(patro(M, k, [p.gx - a / 2, p.gy - b / 2, p.gx + a / 2, p.gy + b / 2], Math.min(1.5, a / 3, b / 3), 0, z0, 0, z1));
          }
          if (p.prst) {
            // zářez na prsty napříč kapsou: válec R10 s dnem na dně kapsy, přesahuje kapsu o 4 mm na obě strany
            const r = DN.PRST_R, delka = p.rot ? p.kw : p.kh;
            let c = k(M.cylinder(delka, r, r, 48, true));
            c = k(c.rotate(p.rot ? [0, 90, 0] : [90, 0, 0]));
            ubrat.push(k(c.translate([p.gx, p.gy, z0 + r])));
          }
          if (t0.popis && V.V.popisky && font && p.px != null) {
            const r = rytina(M, CS, k, font, t0.popis, DN.cislo(V.V.vyskaPisma, 3.5) * 0.85, p.px, p.py, K.zKomor, DN.cislo(V.V.hloubkaPisma, 0.6), p.sw - 0.6);
            if (r) ubrat.push(r);
          }
        }
      } else {
        // příčky
        for (const q of K.komory) {
          if (q.i < K.delX - 1) pridat.push(box(M, k, q.x1 - 0.01, q.y0 - 0.01, K.zDno - 0.01, q.x1 + GF.prepazka + 0.01, q.y1 + 0.01 + (q.j < K.delY - 1 ? GF.prepazka : 0), K.zKomor));
          if (q.j < K.delY - 1) pridat.push(box(M, k, q.x0 - 0.01, q.y1 - 0.01, K.zDno - 0.01, q.x1 + 0.01, q.y1 + GF.prepazka + 0.01, K.zKomor));
        }
        // lopatka (scoop) vpředu každé řady a štítek vzadu každé komory
        for (const q of K.komory) {
          const Rl = K.lopatkaR;
          if (Rl > 0.5) {
            let b = box(M, k, q.x0 - 0.02, q.y0 - 0.02, K.zDno - 0.02, q.x1 + 0.02, q.y0 + Rl, K.zDno + Rl);
            let c = k(k(M.cylinder(q.x1 - q.x0 + 2, Rl, Rl, 64, true)).rotate([0, 90, 0]));
            c = k(c.translate([(q.x0 + q.x1) / 2, q.y0 + Rl, K.zDno + Rl]));
            b = k(b.subtract(c));
            pridat.push(b);
          }
          if (K.stitekH > 0) {
            const y1 = q.y1 + 0.02, zt = K.zKomor, d = K.stitekH;
            const prof = [[y1, zt - K.stitekV], [y1, zt], [y1 - d, zt], [y1 - d, zt - GF.oporaLemu]];
            pridat.push(vytahniX(M, CS, k, prof, q.x0 - 0.02, q.x1 + 0.02));
          }
        }
      }
      if (pridat.length) {
        let pr = k(M.union(pridat));
        pr = k(pr.intersect(vnitrek));
        t = k(t.add(pr));
      }
      // otvory v podstavě
      for (const q of K.otvory) {
        if (K.magnety) ubrat.push(valec(M, k, q.x, q.y, -1, GF.hloubkaMagnetu, GF.otvorMagnetu / 2, 40));
        if (K.srouby) ubrat.push(valec(M, k, q.x, q.y, -1, GF.hloubkaSroubu, GF.otvorSroubu / 2, 24));
      }
      if (ubrat.length) t = k(t.subtract(k(M.union(ubrat))));
      return sit(t);
    });
  }

  /* ---------------- držák na lištu ---------------- */
  /** kapka (teardrop) se špičkou ve směru +x: kruh + 45° střecha – tisk na boku bez podpor */
  function kapka(r) {
    const b = [];
    for (let i = 0; i <= 36; i++) { const a = (45 + i * 270 / 36) * Math.PI / 180; b.push([r * Math.cos(a), r * Math.sin(a)]); }
    b.push([r * Math.SQRT2, 0]);
    return b;
  }
  function drzakManifold(M, CS, k, G, font, N) {
    const zMin = Math.min(...G.profil.map((q) => q[1])) - 1, zMax = G.zHorni + 1;
    let t = vytahniX(M, CS, k, G.profil, 0, G.sirka);
    const ubrat = [], bok = G.orientace === 'bok';
    for (const q of G.vyrezy) {
      const z1 = (q.z0 != null ? q.z0 : G.zHorni) + 1, z0 = q.skrz ? zMin : (q.z0 != null ? q.z0 : G.zHorni) - q.hloubka;
      if (q.tvar === 'kruh') {
        if (bok) ubrat.push(k(k(k(new CS([kapka(q.d / 2)], 'Positive')).extrude(z1 - z0)).translate([q.x, q.y, z0])));
        else ubrat.push(valec(M, k, q.x, q.y, z0, z1, q.d / 2));
      } else if (q.tvar === 'obd') {
        ubrat.push(box(M, k, q.x - q.w / 2, q.y - q.hl / 2, z0, q.x + q.w / 2, q.y + q.hl / 2, z1));
      } else if (q.tvar === 'otevreny') {
        // drážka otevřená dopředu, vzadu zaoblená
        const r = q.w / 2;
        ubrat.push(box(M, k, q.x - r, q.y - q.hl / 2 + r, z0, q.x + r, q.y + q.hl / 2 + 40, z1));
        ubrat.push(valec(M, k, q.x, q.y - q.hl / 2 + r, z0, z1, r));
      }
    }
    if (font) for (const p of G.popisky) {
      const r = rytina(M, CS, k, font, p.text, p.h * 0.85, p.x, p.y, p.z != null ? p.z : G.zHorni, DN.cislo(N.hloubkaPisma, 0.6), 30, true);
      if (r) ubrat.push(r);
    }
    if (ubrat.length) t = k(t.subtract(k(M.union(ubrat))));
    void zMax;
    return t;
  }
  /** o: {tisk: orientace pro tisk, cast: index dílu (jinak celé)} */
  function drzak(w, G, font, o) {
    o = o || {};
    return s(w, (M, CS, k) => {
      let t = drzakManifold(M, CS, k, G, font, o.nast || {});
      const casti = o.cast != null ? [G.casti[o.cast]] : G.casti;
      const kusy = [];
      let posun = 0;
      for (const [a, b] of casti) {
        let c = casti.length === 1 && a === 0 && b === G.sirka ? t : k(t.intersect(box(M, k, a, -500, -500, b, 500, 500)));
        if (o.tisk) {
          c = k(c.translate([-a, 0, 0]));
          c = k(G.orientace === 'hlavou' ? c.rotate([180, 0, 0]) : c.rotate([0, -90, 0]));
          const bb = c.boundingBox();
          c = k(c.translate([-bb.min[0] + posun, -bb.min[1], -bb.min[2]]));
          posun += bb.max[0] - bb.min[0] + 8;
        }
        kusy.push(c);
      }
      return sit(kusy.length === 1 ? kusy[0] : k(M.union(kusy)), { dilu: kusy.length, orientace: G.orientace });
    });
  }

  /* ---------------- pegboard háček (tisk naplocho: X = y profilu, Y = z profilu) ---------------- */
  function hak(w, H0, o) {
    const H = H0.telo ? H0 : DN.hak(H0);
    o = o || {};
    return s(w, (M, CS, k) => {
      const telo = k(k(new CS([cistyPolygon(H.telo)], 'Positive')).extrude(H.w));
      const kol = H.koliky.map((b) => k(k(new CS([cistyPolygon(b)], 'Positive')).extrude(H.s)));
      let t = k(M.union([telo, ...kol]));
      if (o.namontovany) t = k(k(t.rotate([90, 0, 0])).rotate([0, 0, 90]));   // pro náhled: (y, z, šířka) → (x = šířka, y, z)
      return sit(t);
    });
  }

  /* ---------------- lišta a koncovka ---------------- */
  function koncovka(w, L0) {
    const L = L0.profil ? L0 : DN.lista(L0);
    return s(w, (M, CS, k) => {
      const prof = k(new CS([cistyPolygon(L.profil)], 'Positive'));
      const vnejsi = k(prof.offset(2.3, 'Miter', 3)), vnitrni = k(prof.offset(0.3, 'Miter', 3));
      let t = k(vnejsi.extrude(20));
      t = k(t.subtract(k(k(vnitrni.extrude(20)).translate([0, 0, 2.4]))));
      t = k(t.subtract(box(M, k, -20, -20, -1, 0, L.h + 20, 30)));       // záda otevřená ke stěně
      return sit(t);
    });
  }
  function listaSit(w, L0, delka) {
    const L = L0.profil ? L0 : DN.lista(L0);
    return s(w, (M, CS, k) => sit(vytahniX(M, CS, k, L.profil, 0, delka || L.delka)));
  }

  /* ---------------- STL a ZIP ---------------- */
  function stlBinarni(poz, idx, nazev) {
    const nt = idx.length / 3, buf = new ArrayBuffer(84 + nt * 50), dv = new DataView(buf);
    const hl = String(nazev || 'drzaky naradi').normalize('NFD').replace(/[̀-ͯ]/g, '').slice(0, 79);
    for (let i = 0; i < hl.length; i++) dv.setUint8(i, hl.charCodeAt(i) & 0x7f);
    dv.setUint32(80, nt, true);
    let p = 84;
    for (let t = 0; t < nt; t++) {
      const A = idx[t * 3] * 3, B = idx[t * 3 + 1] * 3, C = idx[t * 3 + 2] * 3;
      const ux = poz[B] - poz[A], uy = poz[B + 1] - poz[A + 1], uz = poz[B + 2] - poz[A + 2];
      const vx = poz[C] - poz[A], vy = poz[C + 1] - poz[A + 1], vz = poz[C + 2] - poz[A + 2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1;
      for (const v of [nx / l, ny / l, nz / l]) { dv.setFloat32(p, v, true); p += 4; }
      for (const q of [A, B, C]) for (let i = 0; i < 3; i++) { dv.setFloat32(p, poz[q + i], true); p += 4; }
      dv.setUint16(p, 0, true); p += 2;
    }
    return buf;
  }
  let CRC = null;
  function crc32(u8) {
    if (!CRC) { CRC = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c >>> 0; } }
    let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0;
  }
  /** ZIP bez komprese (store): soubory [{nazev, data: ArrayBuffer|Uint8Array|string}] → Uint8Array */
  function zip(soubory) {
    const enc = (x) => (typeof x === 'string' ? new TextEncoder().encode(x) : x instanceof Uint8Array ? x : new Uint8Array(x));
    const casti = [], cent = [];
    let off = 0;
    for (const f of soubory) {
      const jm = enc(String(f.nazev).normalize('NFD').replace(/[̀-ͯ]/g, '')), d = enc(f.data), crc = crc32(d);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(8, 0, true); h.setUint32(14, crc, true); h.setUint32(18, d.length, true); h.setUint32(22, d.length, true); h.setUint16(26, jm.length, true);
      casti.push(new Uint8Array(h.buffer), jm, d);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint32(16, crc, true); c.setUint32(20, d.length, true); c.setUint32(24, d.length, true); c.setUint16(28, jm.length, true); c.setUint32(42, off, true);
      cent.push(new Uint8Array(c.buffer), jm);
      off += 30 + jm.length + d.length;
    }
    const velC = cent.reduce((s2, x) => s2 + x.length, 0), e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, soubory.length, true); e.setUint16(10, soubory.length, true); e.setUint32(12, velC, true); e.setUint32(16, off, true);
    const vse = casti.concat(cent, [new Uint8Array(e.buffer)]), out = new Uint8Array(vse.reduce((s2, x) => s2 + x.length, 0));
    let p = 0; for (const x of vse) { out.set(x, p); p += x.length; }
    return out;
  }

  const API = { podlozka, krabicka, drzak, hak, koncovka, listaSit, stlBinarni, zip, crc32, textPolygony, rrBody, kapka, cistyPolygon };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.DNT = API;
})(typeof window !== 'undefined' ? window : globalThis);

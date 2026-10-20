/* ============================================================
   Kolíkovací a kapsové přípravky – STL (manifold-3d z obsah/lib/manifold, Apache-2.0; modul WASM parametrem)
   Každé těleso se staví v souřadnicích vrtaného dílu (přípravek přiložený – pro 3D náhled a testy)
   a pro tisk se otočí rigidní rotací tak, aby velká rovná plocha ležela na podložce a otvory vedení
   byly svislé (kolíky, deska) – u přípravku na kapsy leží profil na podložce a vedení je vodorovné
   (doporučený kapkovitý otvor bez převisu, nebo kovové pouzdro).
   - teleso(w, R, P, ktery) → [{id, nazev, sit, sitTisk, info}]
   ============================================================ */
(function (koren) {
  'use strict';
  const KP = koren.KP || (typeof require !== 'undefined' ? require('./jadro.js') : null);
  const r2 = (x) => Math.round(x * 100) / 100;
  const RAD = Math.PI / 180;

  /* 7segmentové znaky pro vyryté označení */
  const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg',
    A: 'abcefg', B: 'cdefg', C: 'adef', D: 'bcdeg', E: 'adefg', F: 'aefg', H: 'bcefg', L: 'def', P: 'abefg', U: 'bcdef', Z: 'abged', '-': 'g' };
  function segmentyTextu(text, h) {
    const wc = 0.58 * h, s = Math.max(0.8, 0.14 * h), mez = 0.38 * h, out = [];
    let x = 0;
    for (const ch of String(text).toUpperCase()) {
      const sg = SEG[ch];
      if (sg) for (const q of sg) {
        const R = { a: [0, h - s, wc, h], d: [0, 0, wc, s], g: [0, h / 2 - s / 2, wc, h / 2 + s / 2], f: [0, h / 2, s, h], b: [wc - s, h / 2, wc, h], e: [0, 0, s, h / 2], c: [wc - s, 0, wc, h / 2] }[q];
        out.push([x + R[0], R[1], x + R[2], R[3]]);
      }
      x += (sg || ch === ' ' ? wc : 0) + mez;
    }
    return { obd: out, sirka: Math.max(0, x - mez), vyska: h };
  }

  function sit(m) {
    const st = m.status();
    if (st !== 'NoError') throw new Error('manifold hlásí ' + st);
    const mesh = m.getMesh(), np = mesh.numProp, vp = mesh.vertProperties;
    const poz = new Float32Array(vp.length / np * 3);
    for (let q = 0, t = 0; q < vp.length; q += np, t += 3) { poz[t] = vp[q]; poz[t + 1] = vp[q + 1]; poz[t + 2] = vp[q + 2]; }
    const bb = m.boundingBox();
    return { poz, idx: new Uint32Array(mesh.triVerts), objem: m.volume(), rod: m.genus(), bb: { min: bb.min.slice(), max: bb.max.slice() } };
  }
  const segm = (r) => Math.max(24, Math.min(96, Math.round(r * 6)));

  /** kontext s úklidem WASM objektů */
  function kontext(w) {
    const smaz = [], k = (x) => { smaz.push(x); return x; }, M = w.Manifold;
    const box = (x0, y0, z0, x1, y1, z1) => k(M.cube([x1 - x0, y1 - y0, z1 - z0], false).translate([x0, y0, z0]));
    /** válec podél osy z od z0 do z1 */
    const valZ = (x, y, z0, z1, r) => k(k(M.cylinder(z1 - z0, r, r, segm(r), false)).translate([x, y, z0]));
    /** válec podél osy y (rotace x o −90° převede +z na +y) */
    const valY = (x, z, y0, y1, r) => k(k(k(M.cylinder(y1 - y0, r, r, segm(r), false)).rotate([-90, 0, 0])).translate([x, y0, z]));
    const uklid = () => { for (const x of smaz) { try { x.delete(); } catch (e) { /* uvolněno */ } } smaz.length = 0; };
    return { k, M, box, valZ, valY, uklid, w };
  }

  /** vyrytí textu do roviny: mapuj(u, v, hloubka) vrací krabici; obdélníky u ∈ šířka, v ∈ výška */
  function vyryt(C, telo, text, h, mapuj) {
    const g = segmentyTextu(text, h);
    let t = telo;
    for (const [a, b, c, d] of g.obd) t = C.k(t.subtract(mapuj(a, b, c, d)));
    return t;
  }

  /* ---------------- přípravek na čelo / hranu ---------------- */
  function teloHrana(C, p, c, oznaceni) {
    const { box, valY } = C, U = p.profil === 'U';
    const zL = U ? -p.sevreni / 2 : 0;
    const rMax = Math.max(...c.otvory.map((o) => o.otvor / 2));
    const zR = U ? p.t + p.sevreni / 2 : Math.max(p.v + rMax + p.stena, Math.min(p.t, p.v + rMax + p.stena + 4));
    const zOut = zR + (U || p.kridlo ? (p.kridlo ? Math.max(p.stena, p.kridlo.tl) : p.stena) : 0);
    const x0 = c.x0, x1 = c.x1;
    let t = box(x0, -p.Hv, zL - p.stena, x1, 0, zOut);
    t = C.k(t.add(box(x0, -p.Hv, zL - p.stena, x1, p.hc, zL)));                 // líc
    if (U) {
      const yK = p.kridlo ? p.kridlo.y + p.kridlo.d / 2 + 8 : p.hc;
      t = C.k(t.add(box(x0, -p.Hv, zR, x1, Math.max(p.hc, yK), zOut)));        // rub (s křídlem)
    }
    if (c.doraz) {
      const xa = p.smerX > 0 ? x0 - p.s : x1, xb = p.smerX > 0 ? x0 : x1 + p.s;
      t = C.k(t.add(box(xa, -p.Hv, zL - p.stena, xb, p.hd, zOut)));
    }
    for (const o of c.otvory) t = C.k(t.subtract(valY(o.x, o.z, -p.Hv - 1, 1, o.otvor / 2)));
    if (p.kridlo && c.kridlo) for (const o of c.kridlo) t = C.k(t.subtract(C.k(C.k(C.k(C.M.cylinder(zOut - zR + 2, o.otvor / 2, o.otvor / 2, segm(o.otvor / 2), false)).translate([o.x, o.y, zR - 1])))));
    // označení na vnitřní ploše desky (y = 0, mezi lícní a rubovou stěnou), mimo otvory
    if (oznaceni) {
      const txt = c.stitek;
      for (const h of [7, 5, 4]) {
        const g = segmentyTextu(txt, h), zMin = zL + 1, zMax = zR - 1;
        if (zMax - zMin < h) continue;
        const z0 = (zMin + zMax) / 2 - h / 2;
        let x = null;
        for (let xx = x0 + 2; xx + g.sirka <= x1 - 2; xx += 1) {
          if (c.otvory.every((o) => xx > o.x + o.otvor / 2 + 1.5 || xx + g.sirka < o.x - o.otvor / 2 - 1.5 || z0 > o.z + o.otvor / 2 + 1 || z0 + h < o.z - o.otvor / 2 - 1)) { x = xx; break; }
        }
        if (x == null) continue;
        const hl = 0.6;
        t = vyryt(C, t, txt, h, (a, b, cc, d) => box(x + a, -hl, z0 + b, x + cc, 0.5, z0 + d));
        break;
      }
    }
    return t;
  }

  /* ---------------- deska na plochu ---------------- */
  function teloDeska(C, p, c, oznaceni) {
    const { box, valZ } = C, z0 = p.plocha, z1 = p.plocha + p.Hv, hd = Math.min(p.hd, p.plocha - 1);
    const x0 = c.x0, x1 = c.x1;
    let t;
    if (p.yPas > 0) {
      // pás s otvory + dvě ramena k dorazu na čele (úspora materiálu u T-spoje)
      const wr = Math.min(16, (x1 - x0) / 3);
      t = box(x0, p.yPas, z0, x1, p.y1, z1);
      t = C.k(t.add(box(x0, -0.01, z0, x0 + wr, p.yPas + 0.01, z1)));
      t = C.k(t.add(box(x1 - wr, -0.01, z0, x1, p.yPas + 0.01, z1)));
    } else t = box(x0, 0, z0, x1, p.y1, z1);
    t = C.k(t.add(box(x0 - (c.doraz ? p.s : 0), -p.s, z0 - hd, x1, 0, z1)));   // doraz u čela B
    if (c.doraz) t = C.k(t.add(box(x0 - p.s, -p.s, z0 - hd, x0, p.y1, z1)));   // boční doraz u x = 0
    for (const o of c.otvory) t = C.k(t.subtract(valZ(o.x, o.y, z0 - 1, z1 + 1, o.otvor / 2)));
    if (oznaceni) {
      const txt = c.stitek;
      for (const h of [7, 5, 4]) {
        const g = segmentyTextu(txt, h);
        let m = null;
        for (let y = p.y1 - h - 2; y >= Math.max(2, (p.yPas || 0) + 2) && !m; y -= 1) for (let x = x0 + 2; x + g.sirka <= x1 - 2; x += 1) {
          if (c.otvory.every((o) => { const nx = Math.max(x, Math.min(o.x, x + g.sirka)), ny = Math.max(y, Math.min(o.y, y + h)); return Math.hypot(nx - o.x, ny - o.y) > o.otvor / 2 + 1.5; })) { m = [x, y]; break; }
        }
        if (!m) continue;
        // na spodní ploše (leží na dílu, při tisku nahoře) – zrcadlově, aby se četlo při pohledu na tisk shora
        t = vyryt(C, t, txt, h, (a, b, cc, d) => box(m[0] + g.sirka - cc, m[1] + b, z0 - 0.5, m[0] + g.sirka - a, m[1] + d, z0 + 0.6));
        break;
      }
    }
    return t;
  }

  /* ---------------- přípravek na kapsy (tiskový rám: profil x, z → X, Y; šířka → Z) ---------------- */
  function obrys2D(r, kapka, n) {
    const out = [];
    n = n || segm(r);
    for (let i = 0; i < n; i++) {
      const u = 2 * Math.PI * i / n;
      out.push([r * Math.cos(u), r * Math.sin(u)]);
    }
    if (!kapka) return out;
    // kapka: špička nahoru (+v), stěny pod 45°
    const sp = r * Math.SQRT2, res = [];
    for (const q of out) { const ang = Math.atan2(q[1], q[0]) / RAD; if (ang > 45 && ang < 135) continue; res.push(q); }
    // vložit špičku mezi body u 45° a 135°
    const idx = res.findIndex((q) => Math.atan2(q[1], q[0]) / RAD >= 135 - 1e-6);
    res.splice(idx < 0 ? res.length : idx, 0, [0, sp]);
    return res;
  }
  /** vrtání podél osy v rovině X-Y tiskového rámu: z bodu A směrem d (jednotkový, 2D) délky L ve výšce Z */
  function vrtaniXY(C, A, d, L, r, Z, kapka) {
    const M = C.M;
    let t = C.k(M.extrude(obrys2D(r, kapka), L));
    t = C.k(t.rotate([90, 0, 0]));                          // v → +Z, osa vytažení → −Y
    const phi = Math.atan2(d[0], -d[1]) / RAD;             // −Y → d
    t = C.k(t.rotate([0, 0, phi]));
    return C.k(t.translate([A[0], A[1], Z]));
  }
  function bodVPolygonu(p, P) {
    let v = false;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      const [xi, yi] = P[i], [xj, yj] = P[j];
      if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) v = !v;
    }
    return v;
  }
  function teloKapsa(C, K, J) {
    const Pj = K.pripravek, M = C.M;
    let prof = Pj.profil.slice();
    let plocha = 0;
    for (let i = 0, j = prof.length - 1; i < prof.length; j = i++) plocha += (prof[j][0] - prof[i][0]) * (prof[j][1] + prof[i][1]);
    if (plocha < 0) prof = prof.reverse();   // CCW
    let t = C.k(M.extrude(prof, Pj.sirka));
    const kapka = J.kapka !== false && !K.otvor.pouzdro;
    for (const Z of Pj.vedeni) {
      // vedení: od horní plochy (G + 2 b) po ústí na rubu (I + 3 u)
      const A = [K.G[0] + 2 * K.b[0], K.G[1] + 2 * K.b[1]], L = K.Lg + 2 + 3;
      t = C.k(t.subtract(vrtaniXY(C, A, K.u, L, K.Rb, Z, kapka)));
      // vybrání pro pilotní vrták přes doraz
      const A2 = [K.I[0] - K.b[0], K.I[1] - K.b[1]], L2 = K.vstup + 1 + Pj.s / K.cos + 8;
      t = C.k(t.subtract(vrtaniXY(C, A2, K.u, L2, K.dp / 2 + 1.5, Z, kapka)));
    }
    // značky osy vedení na horní ploše dorazu nejsou potřeba – štítek na boční ploše (tisk nahoře)
    if (J.oznaceni !== false) {
      const txt = `${Math.round(K.uhel)}-${Math.round(K.tA)}`;
      for (const h of [7, 5, 4]) {
        const g = segmentyTextu(txt, h);
        let m = null;
        const xs = Pj.profil.map((q) => q[0]), ys = Pj.profil.map((q) => q[1]);
        for (let y = Math.max(...ys) - h - 1; y >= Math.min(...ys) && !m; y -= 0.5) for (let x = Math.min(...xs) + 1; x + g.sirka <= Math.max(...xs) - 1; x += 0.5) {
          const roh = [[x - 1, y - 1], [x + g.sirka + 1, y - 1], [x - 1, y + h + 1], [x + g.sirka + 1, y + h + 1], [x + g.sirka / 2, y + h / 2]];
          if (roh.every((q) => bodVPolygonu(q, prof))) { m = [x, y]; break; }
        }
        if (!m) continue;
        t = vyryt(C, t, txt, h, (a, b, cc, d) => C.box(m[0] + a, m[1] + b, Pj.sirka - 0.6, m[0] + cc, m[1] + d, Pj.sirka + 1));
        break;
      }
    }
    return t;
  }

  /* ---------------- kroužek, měrka, centrovací měrka ---------------- */
  function teloKrouzek(C, k, J) {
    const M = C.M, ri = k.sedlo / 2 + 0.1, ro = Math.max(ri + (+J.krouzekStena || 4), (k.opora || 0) / 2 + 2.5, 7), H = Math.max(5, +J.krouzekV || 10);
    const rs = Math.max(0.8, (+J.sroubek || 3) / 2 * 0.85);
    let t = C.k(C.k(M.cylinder(H, ro, ro, segm(ro), false)).subtract(C.valZ(0, 0, -1, H + 1, ri)));
    t = C.k(t.subtract(C.k(C.k(C.k(M.cylinder(ro + 2, rs, rs, 16, false)).rotate([0, 90, 0])).translate([0, 0, H / 2]))));
    return { t, ri, ro, H };
  }
  function teloMerka(C, k, poradi) {
    const m = k.merka, sir = m.d1 + 12, txt = `${poradi}-${Math.round(k.vzdalenost)}`, g = segmentyTextu(txt, 5);
    const dl = sir + g.sirka + 6, H = m.h1 + m.h2 + 3;
    let t = C.box(0, 0, 0, dl, sir, H);
    const cx = sir / 2, cy = sir / 2;
    t = C.k(t.subtract(C.valZ(cx, cy, H - m.h1, H + 1, m.d1 / 2)));
    t = C.k(t.subtract(C.valZ(cx, cy, H - m.h1 - m.h2, H - m.h1 + 0.5, m.d2 / 2)));
    t = vyryt(C, t, txt, 5, (a, b, c, d) => C.box(sir + 2 + a, sir / 2 - 2.5 + b, H - 0.6, sir + 2 + c, sir / 2 - 2.5 + d, H + 1));
    return { t, H, cx, cy, dl, sir };
  }
  function teloCentr(C, q) {
    const M = C.M;
    let t = C.valZ(0, 0, 0, q.delkaCepu, q.rCep);
    t = C.k(t.add(C.k(C.k(M.cylinder(q.prechod, q.rCep, q.rLimec, segm(q.rLimec), false)).translate([0, 0, q.delkaCepu - 0.01]))));
    const zl = q.delkaCepu + q.prechod;
    t = C.k(t.add(C.valZ(0, 0, zl - 0.01, zl + q.tlLimec, q.rLimec)));
    const zt = zl + q.tlLimec, hh = Math.max(q.hrot, q.rHrot);
    t = C.k(t.add(C.k(C.k(M.cylinder(hh, q.rHrot, 0.05, 32, false)).translate([0, 0, zt - 0.01]))));
    if (q.spendlik) t = C.k(t.subtract(C.valZ(0, 0, zt - 4, zt + hh + 1, 0.6)));
    return { t, vyska: zt + hh };
  }

  /* ---------------- sestavení výstupů ---------------- */
  /**
   * teleso(w, R, P, ktery) – ktery: 'pripravky' | 'krouzky' | 'merky' | 'centr' | 'vse'
   * vrací [{id, nazev, sit (rám dílu), sitTisk (tiskový rám), druh, dil, cast}]
   */
  function telesa(w, R, P, ktery) {
    const C = kontext(w), J = Object.assign({}, KP.vychoziProjekt().pripravek, P.pripravek || {}), out = [];
    ktery = ktery || 'vse';
    const chce = (x) => ktery === 'vse' || ktery === x;
    try {
      if (R.rezim === 'kapsa') {
        if (chce('pripravky')) {
          const tisk = teloKapsa(C, R, J);
          const dil = C.k(tisk.rotate([90, 0, 0]));   // (X, Y, Z) → (x, −Z, Y): profil zpět do řezu x–z, šířka do −y
          out.push({ id: 'P', nazev: R.dvojity ? 'Přípravek na kapsy (dvojitý)' : 'Přípravek na kapsy', druh: 'kapsa', sit: sit(dil), sitTisk: sit(posunNaPodlozku(C, tisk)) });
        }
      } else if (R.rezim === 'centr') {
        if (chce('centr') || chce('pripravky')) {
          let vse = null, x = 0;
          for (const q of R.kusy) {
            const rozt = 2 * q.rLimec + 4;
            for (let i = 0; i < R.kusu; i++) {
              const { t } = teloCentr(C, q);
              const v = C.k(t.translate([x + q.rLimec, i * rozt + q.rLimec, 0]));
              vse = vse ? C.k(vse.add(v)) : v;
            }
            x += rozt;
          }
          if (vse) out.push({ id: 'C', nazev: 'Centrovací měrky', druh: 'centr', sit: sit(vse), sitTisk: sit(vse) });
        }
      } else {
        if (chce('pripravky')) for (const p of R.pripravky) p.casti.forEach((c, i) => {
          c.stitek = p.id + (p.casti.length > 1 ? '-' + (i + 1) : '');
          if (p.druh === 'hrana') {
            const t = teloHrana(C, p, c, J.oznaceni !== false);
            out.push({ id: c.stitek, nazev: p.nazev + (p.casti.length > 1 ? ` – díl ${i + 1}/${p.casti.length}` : ''), druh: 'hrana', dil: p.dil, cast: i, sit: sit(t), sitTisk: sit(posunNaPodlozku(C, C.k(t.rotate([90, 0, 0])))) });
          } else {
            const t = teloDeska(C, p, c, J.oznaceni !== false);
            out.push({ id: c.stitek, nazev: p.nazev + (p.casti.length > 1 ? ` – díl ${i + 1}/${p.casti.length}` : ''), druh: 'deska', dil: p.dil, cast: i, sit: sit(t), sitTisk: sit(posunNaPodlozku(C, C.k(t.rotate([180, 0, 0])))) });
          }
        });
      }
      if (chce('krouzky') || chce('merky')) (R.krouzky || []).forEach((k, i) => {
        if (chce('krouzky')) { const { t } = teloKrouzek(C, k, J); out.push({ id: k.id, nazev: `Kroužek ${k.id} (Ø ${k.sedlo})`, druh: 'krouzek', sit: sit(t), sitTisk: sit(t) }); }
        if (chce('merky')) { const { t } = teloMerka(C, k, i + 1); out.push({ id: 'M' + (i + 1), nazev: `Měrka ${k.id} – ${KP.cz(k.vzdalenost)} mm`, druh: 'merka', sit: sit(t), sitTisk: sit(t) }); }
      });
      return out;
    } finally { C.uklid(); }
  }
  function posunNaPodlozku(C, t) { const bb = t.boundingBox(); return C.k(t.translate([-bb.min[0], -bb.min[1], -bb.min[2]])); }

  /** více sítí vedle sebe do jedné (pro jeden soubor STL) */
  function slouc(site, mezera) {
    let n = 0, m = 0;
    for (const s of site) { n += s.poz.length; m += s.idx.length; }
    const poz = new Float32Array(n), idx = new Uint32Array(m);
    let o = 0, oi = 0, x = 0;
    for (const s of site) {
      const dx = x - s.bb.min[0], dy = -s.bb.min[1], dz = -s.bb.min[2], v0 = o / 3;
      for (let i = 0; i < s.poz.length; i += 3) { poz[o + i] = s.poz[i] + dx; poz[o + i + 1] = s.poz[i + 1] + dy; poz[o + i + 2] = s.poz[i + 2] + dz; }
      for (let i = 0; i < s.idx.length; i++) idx[oi + i] = s.idx[i] + v0;
      o += s.poz.length; oi += s.idx.length; x += s.bb.max[0] - s.bb.min[0] + (mezera || 8);
    }
    return { poz, idx };
  }

  function stlBinarni(poz, idx, nazev) {
    const nt = idx.length / 3, buf = new ArrayBuffer(84 + nt * 50), dv = new DataView(buf);
    const hl = String(nazev || 'kolikovaci pripravek').normalize('NFD').replace(/[̀-ͯ]/g, '').slice(0, 79);
    for (let i = 0; i < hl.length; i++) dv.setUint8(i, hl.charCodeAt(i) & 0x7f);
    dv.setUint32(80, nt, true);
    let o = 84;
    for (let t = 0; t < nt; t++) {
      const A = idx[t * 3] * 3, B = idx[t * 3 + 1] * 3, Cc = idx[t * 3 + 2] * 3;
      const ux = poz[B] - poz[A], uy = poz[B + 1] - poz[A + 1], uz = poz[B + 2] - poz[A + 2];
      const vx = poz[Cc] - poz[A], vy = poz[Cc + 1] - poz[A + 1], vz = poz[Cc + 2] - poz[A + 2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l; ny /= l; nz /= l;
      for (const v of [nx, ny, nz]) { dv.setFloat32(o, v, true); o += 4; }
      for (const q of [A, B, Cc]) for (let s = 0; s < 3; s++) { dv.setFloat32(o, poz[q + s], true); o += 4; }
      dv.setUint16(o, 0, true); o += 2;
    }
    return buf;
  }

  const API = { telesa, slouc, stlBinarni, segmentyTextu, obrys2D };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.KPSTL = API;
})(typeof window !== 'undefined' ? window : globalThis);

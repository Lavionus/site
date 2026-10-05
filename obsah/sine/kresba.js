/* ============================================================
   Síně pod horou – kresba.js: malovaný terén pohledem shora.

   Terén se kreslí po pixelech do bloků BLOK × BLOK polí a ukládá
   do mezipaměti (LRU podle počtu pixelů). Blok má rozlišení LOD
   pixelů na pole (16/32/64/128) podle přiblížení.
   Postup bloku:
     1. vzorkovací mřížka k vzorků na pole: volno/skála, okraje
        jeskyní zvlněné šumem, otesané prostory rovné,
     2. vzdálenostní pole (chamfer) → znaménková vzdálenost od stěny,
     3. pixely: podlaha z dlaždicové textury + stín stěn (AO a vržený
        stín od SZ), útesy ve vrstvených pruzích, prázdnota s hvězdami
        (v podzemí) nebo skalní masiv (na povrchu), voda, magma,
     4. předměty (stromy, balvany, sloupy…) cestami Canvasu se stínem.
   ============================================================ */
var SIN = globalThis.SIN = globalThis.SIN || {};

(function (S) {
  'use strict';
  const SV = S.svet, { M, P, O, K } = SV;
  const BLOK = 8, OKRAJ = 2, DLAZ = 4;           // blok 8 × 8 polí, okraj vzorků 2 pole, textura 4 × 4 pole
  const LODY = [16, 32, 64, 128];
  const ROZPOCET_PX = 36e6;                       // mezipaměť bloků (≈ 144 MB)

  // --- rychlé hashe a periodický šum --------------------------------------------------
  function hp(x, y) {
    let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  const hladka = t => t * t * (3 - 2 * t);
  const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  // hodnotový šum s periodou `per` mřížkových bodů (pro dlaždice textur)
  function sumP(seme, per) {
    return function (u, v) {
      const x0 = Math.floor(u), y0 = Math.floor(v), fx = hladka(u - x0), fy = hladka(v - y0);
      const m = (x, y) => hp(((x % per) + per) % per + seme * 1013, ((y % per) + per) % per - seme * 7919);
      const a = m(x0, y0), b = m(x0 + 1, y0), c = m(x0, y0 + 1), d = m(x0 + 1, y0 + 1);
      return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
    };
  }
  // fraktálový šum periodický přes DLAZ polí; frek = mřížkových bodů na pole
  function fbmP(seme, frek, okt, per) {
    const v = [];
    for (let i = 0; i < okt; i++) v.push(sumP(seme + i * 31, (per || DLAZ) * frek * (1 << i)));
    return function (u, w) {
      let s = 0, a = 1, n = 0;
      for (let i = 0; i < okt; i++) { const f = frek * (1 << i); s += v[i](u * f, w * f) * a; n += a; a *= 0.5; }
      return s / n;
    };
  }
  // obyčejný (neperiodický) šum ve světových souřadnicích
  function sumW(seme) {
    return function (u, v) {
      const x0 = Math.floor(u), y0 = Math.floor(v), fx = hladka(u - x0), fy = hladka(v - y0);
      const a = hp(x0 + seme, y0), b = hp(x0 + 1 + seme, y0), c = hp(x0 + seme, y0 + 1), d = hp(x0 + 1 + seme, y0 + 1);
      return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
    };
  }

  // --- textury podlah (dlaždice DLAZ × DLAZ polí, RGB) ---------------------------------
  const TEX = {};          // klíč typ/lod → { n, d: Uint8ClampedArray }
  const TEX_VOID = 'void', TEX_MASIV = 'masiv';
  const n1 = fbmP(1, 1.5, 3), n2 = fbmP(2, 6, 2), n3 = fbmP(3, 3, 2), n4 = fbmP(4, 0.75, 3), n5 = fbmP(5, 12, 1);
  // masiv a prázdnota jsou velké plochy – dlaždice 8 × 8 polí, ať se vzor neopakuje tak nápadně
  const DLAZ_VELKA = 8, m1 = fbmP(6, 1.5, 3, 8), m2 = fbmP(7, 6, 2, 8), m3 = fbmP(8, 0.75, 2, 8), m4 = fbmP(9, 0.5, 3, 8);
  const perTex = t => (t === TEX_MASIV || t === TEX_VOID ? DLAZ_VELKA : DLAZ);

  // oblázky: mřížka `hus` buněk na pole, pravděpodobnost `pr`; vrací [jas, stín] nebo null
  function oblazek(u, v, hus, pr, seme) {
    const per = DLAZ * hus, X = u * hus, Y = v * hus, i = Math.floor(X), j = Math.floor(Y);
    const h = hp(((i % per) + per) % per + seme, ((j % per) + per) % per);
    if (h > pr) return null;
    const r = 0.28 + 0.18 * hp(i + 7, j + seme), cx = 0.5 + (hp(i, j + 3) - 0.5) * 0.3, cy = 0.5 + (hp(i + 5, j) - 0.5) * 0.3;
    const dx = X - i - cx, dy = Y - j - cy, d = Math.sqrt(dx * dx + dy * dy) / r;
    if (d < 1) return [1 - d * 0.6 - (dx + dy) * 0.6, 0, h / pr];
    const sx = dx - 0.12, sy = dy - 0.12, ds = Math.sqrt(sx * sx + sy * sy) / r;   // stín k JV
    if (ds < 1) return [0, 1 - ds, 0];
    return null;
  }

  // periodický Voronoi: hus bodů na pole; vrací [F1, F2, náhoda buňky]
  function voronoi(u, v, hus, seme) {
    const per = DLAZ * hus, X = u * hus, Y = v * hus, i0 = Math.floor(X), j0 = Math.floor(Y);
    let f1 = 9, f2 = 9, id = 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const i = i0 + di, j = j0 + dj, ii = ((i % per) + per) % per, jj = ((j % per) + per) % per;
      const px = i + 0.15 + 0.7 * hp(ii + seme, jj), py = j + 0.15 + 0.7 * hp(ii, jj + seme);
      const d = Math.hypot(X - px, Y - py);
      if (d < f1) { f2 = f1; f1 = d; id = hp(ii * 7 + 3, jj * 13 + seme); } else if (d < f2) f2 = d;
    }
    return [f1, f2, id];
  }

  function texel(typ, u, v, px, py, lod) {
    switch (typ) {
      case P.SUROVA: {          // nepravidelné kameny s prasklinami (barví se horninou)
        const vr = voronoi(u, v, 2.5, 41);           // hus × DLAZ musí být celé číslo (jinak švy)
        let g = 118 + (vr[2] - 0.5) * 36 + (n1(u, v) - 0.5) * 30 + (n2(u, v) - 0.5) * 22;
        const hrana = vr[1] - vr[0];
        if (hrana < 0.05) g = 52 + hrana * 300;                        // spára
        else if (hrana < 0.11) g -= 14;                                 // zaoblený kraj kamene
        else g += Math.min(12, (hrana - 0.11) * 40);
        if (hp(px, py) < 0.05) g += 12;
        return [g, g, g];
      }
      case P.TRAVA: {
        const a = n1(u, v), b = n5(u * 1.5, v * 0.5);
        let r = 66 + (a - 0.5) * 40, g = 96 + (a - 0.5) * 50 + (b - 0.5) * 36, bb = 46 + (a - 0.5) * 20;
        if (n4(u, v) > 0.62) { r += 22; g += 14; bb -= 4; }                 // vyschlé plochy
        if (b > 0.68) { r -= 14; g -= 18; bb -= 8; }
        const k = hp(px >> 1, py >> 1);
        if (k < 0.0025) return [230, 214, 90];
        if (k > 0.9985) return [235, 235, 240];
        return [r, g, bb];
      }
      case P.CESTA: case P.HLINA: {
        const c = typ === P.CESTA ? [156, 128, 92] : [112, 84, 58];
        const a = (n1(u, v) - 0.5) * 36 + (n2(u, v) - 0.5) * 24;
        let s = 1 + a / 128;
        const ob = oblazek(u, v, 6, typ === P.CESTA ? 0.08 : 0.05, 21);
        if (ob) s += ob[0] * 0.25 - ob[1] * 0.25;
        if (typ === P.CESTA && Math.abs(n3(u * 0.5, v * 2) - 0.5) < 0.03) s *= 0.88;
        return [c[0] * s, c[1] * s, c[2] * s];
      }
      case P.STERK: {
        let c = [128, 120, 104];
        const s0 = 1 + (n1(u, v) - 0.5) * 0.3;
        const ob = oblazek(u, v, 8, 0.6, 31);
        if (ob) {
          if (ob[0]) { const t = ob[2]; c = [150 + t * 40, 142 + t * 30, 126 + t * 20]; return [c[0] * (0.8 + ob[0] * 0.3), c[1] * (0.8 + ob[0] * 0.3), c[2] * (0.8 + ob[0] * 0.3)]; }
          return [c[0] * s0 * (1 - ob[1] * 0.35), c[1] * s0 * (1 - ob[1] * 0.35), c[2] * s0 * (1 - ob[1] * 0.35)];
        }
        return [c[0] * s0, c[1] * s0, c[2] * s0];
      }
      case P.MECH: {
        const a = n1(u, v), b = n2(u, v);
        let c = [54 + a * 24, 82 + a * 34 + b * 10, 68 + b * 20];
        if (hp(px, py) < 0.004) c = [150, 230, 200];
        return c;
      }
      case P.DLAZBA: case P.SACHOVNICE: {
        const j = Math.floor(v * 2), sach = typ === P.SACHOVNICE;
        const U = u * 2 + (!sach && (j & 1) ? 0.5 : 0), i = Math.floor(U);
        const fx = U - i, fy = v * 2 - j, sp = 0.035;
        if (fx < sp || fy < sp) return [62, 58, 54];
        let s = sach ? ((i + j) & 1 ? 190 : 62) : 116 + (hp(i & 7, j & 7) - 0.5) * 30;
        s += (n2(u, v) - 0.5) * 22;
        if (fx < 0.09 || fy < 0.09) s += 16; else if (fx > 0.93 || fy > 0.93) s -= 18;
        if (sach && (i + j) & 1 && Math.abs(n3(u * 2, v) - 0.5) < 0.02) s -= 40;     // žilky mramoru
        if (!sach && Math.abs(n3(u, v) - 0.5) < 0.008) s -= 36;                        // prasklina
        return sach ? [s, s * 0.98, s * 0.94] : [s * 1.02, s, s * 0.95];
      }
      case P.PRKNA: {
        const j = Math.floor(v * 3), fy = v * 3 - j;
        const U = u * 0.75 + hp(j & 15, 77), i = Math.floor(U), fx = U - i;
        if (fy < 0.06 || fx < 0.012) return [46, 30, 20];
        const var_ = hp(i & 15, j & 15), zrn = Math.sin(u * 38 + n3(u, v) * 14 + var_ * 6) * 0.5 + 0.5;
        let s = 0.82 + var_ * 0.22 + zrn * 0.1;
        if (fy < 0.14) s += 0.1; else if (fy > 0.9) s -= 0.12;
        if ((fx < 0.04 || fx > 0.96) && Math.abs(fy - 0.5) < 0.08) return [40, 40, 44];   // hřebíky
        return [150 * s, 104 * s, 62 * s];
      }
      case P.KOBEREC: {
        const fx = u - Math.floor(u), fy = v - Math.floor(v);
        const d = Math.abs(fx - 0.5) + Math.abs(fy - 0.5);
        let c = [128, 30, 36];
        if (Math.abs(d - 0.32) < 0.035) c = [196, 150, 66];
        else if (d < 0.12) c = [40, 52, 96];
        const f = 0.9 + n5(u, v) * 0.2;
        return [c[0] * f, c[1] * f, c[2] * f];
      }
      case P.MOZAIKA: {         // položená mozaika bez středu: kosočtverce z kamínků na pole
        const fx = u - Math.floor(u), fy = v - Math.floor(v), tx = u * 8, ty = v * 8;
        if (tx - Math.floor(tx) < 0.12 || ty - Math.floor(ty) < 0.12) return [64, 54, 44];
        const dd = Math.abs(fx - 0.5) + Math.abs(fy - 0.5);
        let c = dd < 0.16 ? [232, 192, 84] : dd < 0.3 ? [60, 104, 156] : dd < 0.36 ? [52, 40, 36] : (Math.floor(tx) + Math.floor(ty)) & 1 ? [214, 200, 164] : [168, 84, 58];
        const f = 0.86 + hp(Math.floor(tx), Math.floor(ty)) * 0.24;
        return [c[0] * f, c[1] * f, c[2] * f];
      }
      case TEX_VOID: {
        const a = m4(u, v), b = m1(u * 0.5, v * 0.5);
        let r = 9 + a * 8, g = 11 + a * 8 + b * 4, bb = 20 + a * 16 + b * 8;
        const h = hp(px, py), prah = 1.4 / (lod * lod);
        if (h < prah) { const j = 90 + hp(py, px) * 150; return [j, j, j * 1.08]; }
        if (h < prah * 6) { r += 10; g += 10; bb += 14; }
        return [r, g, bb];
      }
      case TEX_MASIV: {        // vrchol skalního masivu na povrchu (barví se horninou)
        const a = m1(u, v), hr = 1 - Math.abs(2 * m3(u, v) - 1);
        let g = 104 + (a - 0.5) * 56 + (m2(u, v) - 0.5) * 24;
        if (hr > 0.94) g -= 44 * (hr - 0.94) / 0.06;                // pukliny
        else if (hr > 0.86) g += 14;                                // světlá hrana u puklin
        return [g, g, g];
      }
    }
    return [128, 0, 128];
  }

  function textura(typ, lod) {
    const klic = typ + '/' + lod;
    if (TEX[klic]) return TEX[klic];
    const n = perTex(typ) * lod, d = new Uint8ClampedArray(n * n * 4);
    for (let py = 0; py < n; py++) for (let px = 0; px < n; px++) {
      const c = texel(typ, (px + 0.5) / lod, (py + 0.5) / lod, px, py, lod), o = (py * n + px) * 4;
      d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = c[3] ? c[3] * 255 : 0;
    }
    return (TEX[klic] = { n, d });
  }

  // --- mozaika (kruhová, se středem v oblasti) -----------------------------------------
  // du, dv = vzdálenost od středu v polích, r = poloměr mozaiky
  function mozaika(du, dv, r) {
    const d = Math.sqrt(du * du + dv * dv), q = d / r, ang = Math.atan2(dv, du);
    const tx = du * 9, ty = dv * 9, fx = tx - Math.floor(tx), fy = ty - Math.floor(ty);
    if (fx < 0.1 || fy < 0.1) return [66, 56, 46];
    let c;
    if (q < 0.2) c = [236, 194, 84];                                               // slunce
    else if (q < 0.27 || (q > 0.6 && q < 0.66) || q > 0.93) c = [52, 40, 36];      // tmavé prstence
    else if (q < 0.6) {                                                             // okvětí
      const seg = (ang / Math.PI + 1) * 6, f = seg - Math.floor(seg), sp = Math.abs(f - 0.5) * 2;
      c = sp < 1 - (q - 0.27) / 0.33 * 0.9 ? (Math.floor(seg) & 1 ? [62, 104, 156] : [196, 156, 70]) : [218, 204, 168];
    } else {                                                                        // runový pás
      const seg = Math.floor((ang / Math.PI + 1) * 12);
      c = seg & 1 ? [56, 122, 112] : [168, 84, 58];
      if (Math.abs(q - 0.795) < 0.035) c = [226, 214, 180];
    }
    const f = 0.84 + hp(Math.floor(tx), Math.floor(ty)) * 0.26;
    return [c[0] * f, c[1] * f, c[2] * f];
  }

  // --- plátno ---------------------------------------------------------------------------
  function platno(w, h) {
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
    const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
  }

  // --- stavba bloku ---------------------------------------------------------------------
  function postavBlok(sv, p, bx, by, lod, hook) {
    const { W, H, N } = sv, L = lod, NP = BLOK * L;
    const k = Math.min(L, 16), G = (BLOK + 2 * OKRAJ) * k;
    const u0 = bx * BLOK - OKRAJ, v0 = by * BLOK - OKRAJ;
    const povrch = p === 0;

    // okno polí (s jedním polem navíc kvůli interpolaci)
    const C = BLOK + 2 * OKRAJ + 2, cu0 = u0 - 1, cv0 = v0 - 1;
    const otv = new Float32Array(C * C), hw = new Float32Array(C * C), voda = new Float32Array(C * C), magma = new Float32Array(C * C);
    const pidx = new Int32Array(C * C), hornina = new Uint8Array(C * C), podl = new Uint8Array(C * C);
    const prirod = new Uint8Array(C * C);       // přírodní hornina (u zdiva ta za ním) – barva vrcholu masivu
    for (let cj = 0; cj < C; cj++) for (let ci = 0; ci < C; ci++) {
      const x = Math.max(0, Math.min(W - 1, cu0 + ci)), y = Math.max(0, Math.min(H - 1, cv0 + cj));
      const i = p * N + y * W + x, c = cj * C + ci;
      pidx[c] = i;
      const vol = sv.teren[i] === M.VOLNO && sv.zn[i];
      otv[c] = vol ? 1 : 0;
      // 1 = rovné zdi (zdivo), 0.75 = oblé bez zvlnění (runová zeď Srdce), 0 = přírodní jeskyně
      const ob = vol && sv.oblast[i] ? sv.oblasti[sv.oblast[i]] : null;
      hw[c] = vol ? (sv.otes[i] ? (ob && ob.typ === 'srdce' ? 0.75 : 1) : 0) : (sv.teren[i] === M.CIHLA ? 1 : sv.teren[i] === M.RUNA ? 0.75 : 0);
      if (vol && sv.kap[i]) { if (sv.kapTyp[i] === K.MAGMA) magma[c] = Math.min(1, sv.kap[i] / 4); else voda[c] = Math.min(1, sv.kap[i] / 5); }
      let m = sv.teren[i] !== M.VOLNO ? sv.teren[i] : sv.zaklad[i], zm = sv.zaklad[i];
      if (m === M.PODLOZI && povrch) m = zm = M.VAPENEC;
      hornina[c] = m; prirod[c] = SV.prirodni(zm) ? zm : SV.prirodni(m) ? m : M.VAPENEC; podl[c] = sv.podlaha[i];
    }
    // skála bere barvu i podlahu od sousedů: pixel ve „skalním“ poli (kvůli zvlnění) dostane podlahu souseda
    const podlR = new Uint8Array(podl), mozR = new Int32Array(C * C).fill(-1);
    const moz = new Array(C * C).fill(null), otesC = new Uint8Array(C * C);
    for (let c = 0; c < C * C; c++) {
      if (!otv[c]) continue;
      otesC[c] = sv.otes[pidx[c]];
      const ob = sv.oblast[pidx[c]] && sv.oblasti[sv.oblast[pidx[c]]];
      if (ob && ob.mozaika) moz[c] = ob.mozaika;
    }
    for (let cj = 1; cj < C - 1; cj++) for (let ci = 1; ci < C - 1; ci++) {
      const c = cj * C + ci;
      if (otv[c]) continue;
      for (const d of [1, -1, C, -C, C + 1, C - 1, -C + 1, -C - 1]) if (otv[c + d]) { podlR[c] = podl[c + d]; mozR[c] = c + d; break; }
    }
    const bil = (pole, u, v) => {        // bilineárně mezi středy polí
      const x = u - cu0 - 0.5, y = v - cv0 - 0.5, i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
      const a = j * C + i;
      return (pole[a] * (1 - fx) + pole[a + 1] * fx) * (1 - fy) + (pole[a + C] * (1 - fx) + pole[a + C + 1] * fx) * fy;
    };
    const bunka = (u, v) => (Math.floor(v) - cv0) * C + (Math.floor(u) - cu0);

    // 1. vzorky volno / skála
    const sw1 = sumW(p * 977 + 13), sw2 = sumW(p * 977 + 51), sw3 = sumW(p * 977 + 89);
    const sw4 = sumW(p * 977 + 131), sw5 = sumW(p * 977 + 173), sw6 = sumW(p * 977 + 211);
    const uvn = new Uint8Array(G * G), jit = new Float32Array(G * G);
    const jx = new Float32Array(G * G), jy = new Float32Array(G * G), velk = new Float32Array(G * G), mech = new Float32Array(G * G);
    for (let sy = 0; sy < G; sy++) for (let sx = 0; sx < G; sx++) {
      const u = u0 + (sx + 0.5) / k, v = v0 + (sy + 0.5) / k;
      const h = bil(hw, u, v);
      let o;
      if (h > 0.9) o = otv[bunka(u, v)];
      else if (h > 0.5) o = bil(otv, u, v);
      else {
        const A = 0.62 * (1 - h);
        const wu = u + A * (sw1(u * 1.3, v * 1.3) - 0.5) + 0.25 * A * (sw1(u * 4, v * 4) - 0.5);
        const wv = v + A * (sw2(u * 1.3, v * 1.3) - 0.5) + 0.25 * A * (sw2(u * 4, v * 4) - 0.5);
        o = bil(otv, wu, wv) + (sw3(u * 2.5, v * 2.5) - 0.5) * 0.18;
      }
      uvn[sy * G + sx] = o > 0.5 ? 1 : 0;
      const sg = sy * G + sx;
      jit[sg] = sw3(u * 2.2 + 40, v * 2.2);
      jx[sg] = ((sw4(u * 1.4, v * 1.4) + 0.4 * sw4(u * 4.5 + 9, v * 4.5)) / 1.4 - 0.5) * 1.15;
      jy[sg] = ((sw5(u * 1.4, v * 1.4) + 0.4 * sw5(u * 4.5, v * 4.5 + 9)) / 1.4 - 0.5) * 1.15;
      velk[sg] = sw6(u * 0.3, v * 0.3) * 0.7 + sw6(u * 1.1 + 50, v * 1.1) * 0.3;
      mech[sg] = povrch ? sw6(u * 0.55 + 100, v * 0.55) * 0.75 + sw3(u * 3 + 7, v * 3) * 0.25 : sw6(u * 2.6 + 300, v * 2.6) * 0.7 + sw4(u * 7, v * 7 + 30) * 0.3;
    }
    // 2. vzdálenost (chamfer 1 / √2) uvnitř i vně
    const sd = new Float32Array(G * G);
    for (const stav of [1, 0]) {
      const d = new Float32Array(G * G);
      for (let s = 0; s < G * G; s++) d[s] = uvn[s] === stav ? 1e6 : 0;
      for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) {
        const s = y * G + x; let v = d[s];
        if (!v) continue;
        if (x > 0) v = Math.min(v, d[s - 1] + 1);
        if (y > 0) { v = Math.min(v, d[s - G] + 1); if (x > 0) v = Math.min(v, d[s - G - 1] + 1.4142); if (x < G - 1) v = Math.min(v, d[s - G + 1] + 1.4142); }
        d[s] = v;
      }
      for (let y = G - 1; y >= 0; y--) for (let x = G - 1; x >= 0; x--) {
        const s = y * G + x; let v = d[s];
        if (!v) continue;
        if (x < G - 1) v = Math.min(v, d[s + 1] + 1);
        if (y < G - 1) { v = Math.min(v, d[s + G] + 1); if (x < G - 1) v = Math.min(v, d[s + G + 1] + 1.4142); if (x > 0) v = Math.min(v, d[s + G - 1] + 1.4142); }
        d[s] = v;
      }
      for (let s = 0; s < G * G; s++) if (uvn[s] === stav) sd[s] = stav ? (d[s] - 0.5) / k : -(d[s] - 0.5) / k;
    }
    const vz = (pole, gx, gy) => {
      gx = Math.max(0, Math.min(G - 1.001, gx)); gy = Math.max(0, Math.min(G - 1.001, gy));
      const i = gx | 0, j = gy | 0, fx = gx - i, fy = gy - j, a = j * G + i;
      return (pole[a] * (1 - fx) + pole[a + 1] * fx) * (1 - fy) + (pole[a + G] * (1 - fx) + pole[a + G + 1] * fx) * fy;
    };

    // 3. pixely
    const can = platno(NP, NP), ctx = can.getContext('2d');
    const img = ctx.createImageData(NP, NP), d = img.data;
    const tVoid = textura(TEX_VOID, L), tMas = povrch ? textura(TEX_MASIV, L) : null;
    const texCache = {};
    const tex = t => texCache[t] || (texCache[t] = textura(t, L));
    const TN = DLAZ * L;
    const RW = povrch ? 0.85 : 0.62;                // šířka útesu (v polích)
    const obdobi = povrch ? sv.obdobi : -1;          // 2 podzim, 3 zima (barva povrchu)
    const stinX = povrch ? 0.45 : 0.22, stinY = povrch ? 0.6 : 0.3;
    const ox = ((bx * BLOK * L) % TN + TN) % TN, oy = ((by * BLOK * L) % TN + TN) % TN;
    const TNV = DLAZ_VELKA * L, oxV = (bx * BLOK * L) % TNV, oyV = (by * BLOK * L) % TNV;
    const ks = k;
    for (let py = 0; py < NP; py++) {
      const v = by * BLOK + (py + 0.5) / L, gy = (v - v0) * ks - 0.5, ty = (oy + py) % TN;
      for (let px = 0; px < NP; px++) {
        const u = bx * BLOK + (px + 0.5) / L, gx = (u - u0) * ks - 0.5, tx = (ox + px) % TN;
        const o = (py * NP + px) * 4, ti = (ty * TN + tx) * 4, tiV = (((oyV + py) % TNV) * TNV + (oxV + px) % TNV) * 4;
        const s = vz(sd, gx, gy), c = bunka(u, v);
        // rozvlněný výběr pole: druhy podlah a hornin se prolínají po klikatých hranicích, ne po čtvercích
        const ojx = vz(jx, gx, gy), ojy = vz(jy, gx, gy), uj = u + ojx, vj = v + ojy;
        let cj = bunka(uj, vj);
        const jas = 0.9 + 0.2 * vz(velk, gx, gy);
        let r, g, b;
        if (s >= 0) {
          // --- podlaha
          const cc = otesC[c] || !otv[cj] || otesC[cj] ? (otv[c] ? c : (mozR[c] >= 0 ? mozR[c] : c)) : cj;
          const typ = podlR[cc], mz = moz[otv[c] ? c : (mozR[c] >= 0 ? mozR[c] : c)];
          let dm = 1e9;
          if (mz) { const du = u - mz.x, dv = v - mz.y; dm = Math.sqrt(du * du + dv * dv); }
          if (dm < mz_r(mz)) {
            [r, g, b] = mozaika(u - mz.x, v - mz.y, mz.r);
          } else {
            const t = tex(typ), td = t.d;
            r = td[ti]; g = td[ti + 1]; b = td[ti + 2];
            if (typ === P.SUROVA) {
              const bc = SV.MATERIAL[hornina[cc]].barva || [128, 128, 128];
              const k0 = povrch ? 150 : 185;          // podzemní podlahy tmavší než skála (jako předloha)
              r = r * bc[0] / k0; g = g * bc[1] / k0; b = b * bc[2] / k0;
            }
            if (!otesC[cc]) { r *= jas; g *= jas; b *= jas; }
            // období na povrchu: zrezavělá tráva na podzim, sníh v zimě (prošlapaná cesta méně)
            if (povrch && !otesC[cc]) {
              if (obdobi === 2 && typ === P.TRAVA) { r += (156 - r) * 0.35; g += (122 - g) * 0.35; b += (58 - b) * 0.35; }
              else if (obdobi === 3 && (typ === P.TRAVA || typ === P.HLINA || typ === P.CESTA || typ === P.STERK)) {
                const sn = (typ === P.CESTA ? 0.45 : 0.78) * (0.8 + 0.4 * vz(mech, gx, gy)), jx2 = 0.94 + 0.08 * (td[ti] / 255);
                r += (232 * jx2 - r) * sn; g += (238 * jx2 - g) * sn; b += (246 * jx2 - b) * sn;
              }
            }
          }
          // voda a magma (hladké okraje mezi poli)
          const wv = bil(voda, u + ojx * 0.7, v + ojy * 0.7);
          if (wv > 0.04 && povrch && obdobi === 3) {          // zamrzlý potok: led s prasklinami
            const a = smooth(0.04, 0.3, wv), pr = Math.abs(vz(jit, gx * 1, gy * 1) - 0.5) < 0.02 ? 0.8 : 1;
            r += (196 * pr - r) * a; g += (222 * pr - g) * a; b += (238 * pr - b) * a;
          } else if (wv > 0.04) {
            const hl = smooth(0.25, 1, wv), vl = Math.sin(u * 9 + Math.sin(v * 5) * 2 + jit[0] * 4) * Math.sin(v * 7 - u * 2);
            let wr = 70 - 52 * hl, wg = 118 - 76 * hl, wb = 136 - 64 * hl;
            if (vl > 0.9) { wr += 22; wg += 30; wb += 32; }
            const a = smooth(0.04, 0.3, wv) * (0.55 + 0.4 * hl);
            r += (wr - r) * a; g += (wg - g) * a; b += (wb - b) * a;
            if (wv > 0.12 && wv < 0.2) { r += 18; g += 22; b += 22; }        // pěna u břehu
          }
          const mg = bil(magma, u + ojx * 0.7, v + ojy * 0.7);
          if (mg > 0.04) {
            const kr = vz(mech, gx, gy), a = smooth(0.05, 0.4, mg);
            let mr = 236, mgg = 96 + kr * 80, mb = 24;
            if (kr < 0.42) { mr = 70; mgg = 26; mb = 18; } else if (kr < 0.47) { mr = 255; mgg = 210; mb = 90; }
            r += (mr - r) * a; g += (mgg - g) * a; b += (mb - b) * a;
          }
          // stín stěn: okluze + vržený stín od SZ
          const ao = povrch ? 0.78 + 0.22 * smooth(0, 0.6, s) : 0.5 + 0.5 * smooth(0, 0.55, s);
          const s2 = vz(sd, gx - stinX * ks, gy - stinY * ks);
          const st = 0.62 + 0.38 * smooth(-0.08, 0.06, s2);
          const f = ao * st * (povrch ? 1 : 0.82);
          r *= f * (povrch ? 1 : 1.04); g *= f; b *= f * (povrch ? 1 : 0.9);
        } else {
          const dd = -s;
          const hwv = bil(hw, u, v);
          const rw = hwv > 0.5 ? 0.62 : RW;
          if (hwv > 0.5 || hw[cj] || hw[c]) cj = c;
          if (dd < rw) {
            // --- útes / zeď
            const bc = SV.MATERIAL[hornina[cj]].barva || [120, 120, 120];
            const jt = vz(jit, gx, gy);
            // sklon stěny: světlo od SZ
            const nx = vz(sd, gx + 1, gy) - vz(sd, gx - 1, gy), ny = vz(sd, gx, gy + 1) - vz(sd, gx, gy - 1);
            const nl = Math.sqrt(nx * nx + ny * ny) || 1, sv_ = -(nx + ny) / nl * 0.7071;   // >0 = stěna klesá k SZ (osvětlená)
            let sh;
            if (hwv > 0.5) {
              const t = dd / rw, rr = Math.floor(v * 4), U = u * 2 + (rr & 1) * 0.5, ci2 = Math.floor(U);
              const fx = U - ci2, fy = v * 4 - rr;
              sh = 1.05 + (hp(ci2, rr) - 0.5) * 0.22 - t * 0.25;
              if (fx < 0.06 || fy < 0.1) sh *= 0.62;
              if (t < 0.14) sh = 1.32;
              if (t > 0.86) sh *= 0.5;
              sh *= 1 + 0.12 * sv_;
            } else {
              const t = Math.max(0, Math.min(1, dd / rw + (jt - 0.5) * 0.3));
              // proudnice souběžné s okrajem (jako vrstvené skalní hřbety předlohy)
              const pr = dd * 15 + (vz(mech, gx, gy) - 0.5) * 7 + (jt - 0.5) * 4, f = pr - Math.floor(pr);
              sh = 1.12 - 0.3 * t + (f < 0.18 ? -0.3 : f < 0.32 ? 0.12 : 0);
              const hreben = Math.floor(t * 2.4);
              if (hreben && Math.abs(t * 2.4 - hreben) < 0.06) sh *= 0.55;          // rýha mezi hřbety
              sh *= 1 + 0.3 * sv_;
              if (dd < 0.035) sh = 0.28;                                         // tmavá linka u podlahy
              if (!povrch && t > 0.8) sh *= 1 - (t - 0.8) / 0.2 * 0.9;
            }
            const kz = povrch ? 0.82 : 0.7;
            r = bc[0] * sh * kz; g = bc[1] * sh * kz; b = bc[2] * sh * kz;
            if (hwv <= 0.5) { r *= jas; g *= jas; b *= jas; }
            const ru = sv.ruda[pidx[cj]];
            if (ru && hp(Math.floor(u * 7), Math.floor(v * 7)) < 0.4) {
              const rc = SV.RUDA[ru].barva, l = hp(Math.floor(u * 21), Math.floor(v * 21)) * 0.5 + 0.7;
              r = rc[0] * l * sh; g = rc[1] * l * sh; b = rc[2] * l * sh;
            }
          } else if (povrch) {
            // --- vrchol masivu
            const bc = SV.MATERIAL[prirod[cj]].barva, td = tMas.d;
            const okr = (dd < rw + 0.1 ? 1.12 : 1) * jas;
            r = td[tiV] * bc[0] / 150 * okr; g = td[tiV + 1] * bc[1] / 150 * okr; b = td[tiV + 2] * bc[2] / 150 * okr;
            const mc = smooth(0.6, 0.625, vz(mech, gx, gy) + (vz(jit, gx, gy) - 0.5) * 0.07);
            if (mc) {         // mech: tráva ztmavená a zbarvená do mechové zelené
              const tt = tex(P.TRAVA).d, f = jas * (0.62 + 0.38 * (td[tiV] / 150));
              r = r * (1 - mc) + tt[ti] * 0.8 * f * mc; g = g * (1 - mc) + tt[ti + 1] * 0.92 * f * mc; b = b * (1 - mc) + tt[ti + 2] * 0.75 * f * mc;
            }
            if (obdobi === 3) { const sn = 0.35 + 0.4 * smooth(0.45, 0.6, vz(mech, gx, gy)); r += (236 - r) * sn; g += (240 - g) * sn; b += (248 - b) * sn; }
          } else {
            // --- prázdnota
            const td = tVoid.d, ti = tiV;
            const tm = dd < rw + 0.35 ? 0.35 + 0.65 * smooth(rw, rw + 0.35, dd) : 1;
            r = td[ti] * tm; g = td[ti + 1] * tm; b = td[ti + 2] * tm;
          }
        }
        d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    // 4. předměty
    const seznam = [];
    for (let y = by * BLOK - OKRAJ; y < (by + 1) * BLOK + OKRAJ; y++) for (let x = bx * BLOK - OKRAJ; x < (bx + 1) * BLOK + OKRAJ; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const i = p * N + y * W + x;
      if (sv.obj[i] && sv.zn[i]) seznam.push([x, y, sv.obj[i], i]);
      else if ((sv.teren[i] === M.CIHLA || sv.teren[i] === M.RUNA) && jePilir(sv, p, x, y)) seznam.push([x, y, PILIR, i]);
    }
    seznam.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    ctx.save();
    ctx.translate(-bx * BLOK * L, -by * BLOK * L);
    for (const [x, y, typ, i] of seznam) kresliObjekt(ctx, sv, typ, x, y, L, i);
    if (hook) hook(ctx, p, bx * BLOK - OKRAJ, by * BLOK - OKRAJ, (bx + 1) * BLOK + OKRAJ, (by + 1) * BLOK + OKRAJ, L);
    ctx.restore();
    return can;
  }

  // --- předměty -------------------------------------------------------------------------
  // pilíř ve zdi otesané síně: v rozích a každé třetí pole podél rovné zdi (sousedí se známou otesanou podlahou)
  const PILIR = 1000;
  function jePilir(sv, p, x, y) {
    const { W, H, N } = sv;
    const o = (dx, dy) => {
      const X = x + dx, Y = y + dy;
      if (X < 0 || Y < 0 || X >= W || Y >= H) return false;
      const j = p * N + Y * W + X;
      return sv.teren[j] === M.VOLNO && sv.otes[j] && sv.zn[j];
    };
    const l = o(-1, 0), r = o(1, 0), u = o(0, -1), d = o(0, 1);
    const diag = o(-1, -1) || o(1, -1) || o(-1, 1) || o(1, 1);
    if (!l && !r && !u && !d) return diag;                       // vnější roh
    if ((l || r) && (u || d)) return true;                       // vnitřní roh
    const zed = j => { const X = x + j[0], Y = y + j[1]; if (X < 0 || Y < 0 || X >= W || Y >= H) return false;
      const t = sv.teren[p * N + Y * W + X]; return t === M.CIHLA || t === M.RUNA; };
    if (u || d) return !(zed([-1, 0]) && zed([1, 0])) || x % 4 === 0;  // konec zdi nebo rozestup
    return !(zed([0, -1]) && zed([0, 1])) || y % 4 === 0;
  }
  function stin(ctx, x, y, rx, ry, a) {
    ctx.fillStyle = `rgba(0,0,0,${a || 0.35})`;
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  }
  function kruh(ctx, x, y, r, barva) { ctx.fillStyle = barva; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
  function radial(ctx, x, y, r, c0, c1) {
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
    g.addColorStop(0, c0); g.addColorStop(1, c1); return g;
  }
  function hvezda(ctx, x, y, r1, r2, n, rot) {
    ctx.beginPath();
    for (let k = 0; k < n * 2; k++) {
      const a = rot + k * Math.PI / n, r = k & 1 ? r2 : r1;
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    ctx.closePath();
  }
  function kamen(ctx, x, y, r, h, svetla, tmava) {
    ctx.beginPath();
    const n = 7;
    for (let k = 0; k < n; k++) {
      const a = k / n * Math.PI * 2 + h * 3, rr = r * (0.78 + 0.3 * hp(k, h * 1e4 | 0));
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.86);
    }
    ctx.closePath();
    ctx.fillStyle = radial(ctx, x, y, r, svetla, tmava); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = Math.max(1, r * 0.08); ctx.stroke();
  }

  function kresliPilir(ctx, sv, i, cx, cy, L) { kresliObjekt(ctx, sv, PILIR + 1, 0, 0, L, i, cx, cy); }
  function kresliObjekt(ctx, sv, typ, x, y, L, i, px, py) {
    const cx = px !== undefined ? px : (x + 0.5) * L, cy = py !== undefined ? py : (y + 0.5) * L, h = hp(x * 3 + 1, y * 7 + 5);
    switch (typ) {
      case PILIR: {
        // pilíř přisazený ke stěně síně: posun ke známé otesané podlaze
        let sx = 0, sy = 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
          const X = x + dx, Y = y + dy;
          if (X < 0 || Y < 0 || X >= sv.W || Y >= sv.H) continue;
          const j = i + dy * sv.W + dx;
          if (sv.teren[j] === M.VOLNO && sv.otes[j] && sv.zn[j]) { sx += dx; sy += dy; }
        }
        const dl = Math.hypot(sx, sy) || 1;
        const cx2 = cx + sx / dl * L * 0.16, cy2 = cy + sy / dl * L * 0.16;
        return kresliPilir(ctx, sv, i, cx2, cy2, L);
      }
      case PILIR + 1: {
        const a = L * 0.52, runa = sv.teren[i] === M.RUNA;
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(cx - a / 2 + L * 0.1, cy - a / 2 + L * 0.12, a, a);
        ctx.fillStyle = runa ? '#4d6670' : '#6f675d'; ctx.fillRect(cx - a / 2, cy - a / 2, a, a);
        ctx.fillStyle = runa ? '#7c9aa6' : '#a39889'; ctx.fillRect(cx - a / 2 + L * 0.05, cy - a / 2 + L * 0.05, a - L * 0.1, a - L * 0.1);
        ctx.fillStyle = runa ? '#93b4c0' : '#bdb2a1'; ctx.fillRect(cx - a / 2 + L * 0.05, cy - a / 2 + L * 0.05, a - L * 0.1, L * 0.06);
        ctx.strokeStyle = 'rgba(20,16,14,0.8)'; ctx.lineWidth = Math.max(1, L * 0.035); ctx.strokeRect(cx - a / 2, cy - a / 2, a, a);
        if (runa) { ctx.fillStyle = 'rgba(120,220,240,0.7)'; ctx.fillRect(cx - L * 0.04, cy - L * 0.12, L * 0.08, L * 0.24); }
        break;
      }
      case O.JEDLE: {
        const r = L * (0.62 + 0.22 * h), rot = h * 6;
        stin(ctx, cx + r * 0.35, cy + r * 0.45, r * 0.95, r * 0.8, 0.4);
        const barvy = ['#173322', '#1f4a2c', '#2b6036', '#3c7a44'];
        for (let k = 0; k < 4; k++) {
          const rr = r * (1 - k * 0.22);
          hvezda(ctx, cx - k * r * 0.05, cy - k * r * 0.06, rr, rr * 0.66, 9, rot + k * 0.35);
          ctx.fillStyle = barvy[k]; ctx.fill();
        }
        kruh(ctx, cx - r * 0.18, cy - r * 0.2, r * 0.1, '#5f9a52');
        if (sv.obdobi === 3) {                    // sníh na větvích
          ctx.fillStyle = 'rgba(240,246,252,0.85)';
          for (let k = 0; k < 3; k++) { hvezda(ctx, cx - k * r * 0.05 - r * 0.06, cy - k * r * 0.06 - r * 0.07, r * (0.75 - k * 0.2), r * (0.4 - k * 0.1), 9, rot + k * 0.35 + 0.15); ctx.fill(); }
        }
        break;
      }
      case O.KER: {
        const r = L * 0.3;
        stin(ctx, cx + r * 0.3, cy + r * 0.4, r * 1.1, r * 0.8, 0.3);
        for (let k = 0; k < 4; k++) {
          const a = k * 1.7 + h * 5, ox = Math.cos(a) * r * 0.5, oy = Math.sin(a) * r * 0.5;
          ctx.fillStyle = radial(ctx, cx + ox, cy + oy, r * 0.7, '#6a9a4c', '#2d5230');
          ctx.beginPath(); ctx.arc(cx + ox, cy + oy, r * 0.7, 0, Math.PI * 2); ctx.fill();
        }
        break;
      }
      case O.BALVAN: {
        const r = L * (0.28 + 0.14 * h), ox = (h - 0.5) * L * 0.3;
        const ve = sv.kap[i] > 0;
        stin(ctx, cx + ox + r * 0.3, cy + r * 0.35, r * 1.05, r * 0.85, ve ? 0.2 : 0.4);
        kamen(ctx, cx + ox, cy, r, h, '#b9b2a6', '#5d5850');
        break;
      }
      case O.KRAPNIK: {
        const r = L * (0.17 + 0.12 * h);
        stin(ctx, cx + r * 0.5, cy + r * 0.6, r * 1.2, r, 0.4);
        ctx.fillStyle = radial(ctx, cx, cy, r * 1.3, '#efe4cc', '#7d6c55');
        ctx.beginPath(); ctx.arc(cx, cy, r * 1.15, 0, Math.PI * 2); ctx.fill();
        kruh(ctx, cx - r * 0.25, cy - r * 0.25, r * 0.35, '#fff6e0');
        if (h > 0.5) {
          const x2 = cx + L * 0.28, y2 = cy - L * 0.22;
          ctx.fillStyle = radial(ctx, x2, y2, r * 0.8, '#e6d9bd', '#6f604b');
          ctx.beginPath(); ctx.arc(x2, y2, r * 0.6, 0, Math.PI * 2); ctx.fill();
        }
        break;
      }
      case O.HOUBA: {
        const r = L * (0.42 + 0.2 * h);
        stin(ctx, cx + r * 0.3, cy + r * 0.4, r, r * 0.85, 0.45);
        const c0 = h > 0.5 ? '#c86a8a' : '#a15ad0', c1 = h > 0.5 ? '#5a1f3a' : '#3a1a5a';
        ctx.fillStyle = radial(ctx, cx, cy, r, c0, c1);
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
        for (let k = 0; k < 6; k++) {
          const a = k * 2.4 + h * 9, d = r * (0.25 + 0.5 * hp(k, x + y));
          kruh(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d, r * 0.09, 'rgba(240,230,250,0.85)');
        }
        // záře
        const g = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r * 1.6);
        g.addColorStop(0, 'rgba(190,120,255,0.14)'); g.addColorStop(1, 'rgba(190,120,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r * 1.6, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case O.KRYSTAL: {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, L * 0.8);
        g.addColorStop(0, 'rgba(120,220,255,0.28)'); g.addColorStop(1, 'rgba(120,220,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, L * 0.8, 0, Math.PI * 2); ctx.fill();
        for (let k = 0; k < 4; k++) {
          const a = h * 6 + k * 1.6, len = L * (0.25 + 0.2 * hp(k, x)), w = L * 0.08;
          ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
          ctx.beginPath(); ctx.moveTo(0, -w); ctx.lineTo(len, -w * 0.7); ctx.lineTo(len + w * 1.4, 0); ctx.lineTo(len, w * 0.7); ctx.lineTo(0, w); ctx.closePath();
          ctx.fillStyle = k & 1 ? '#7fd8f0' : '#a68cf5'; ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(0, -w * 0.6, len, w * 0.4);
          ctx.restore();
        }
        break;
      }
      case O.SLOUP: {
        const r = L * 0.34;
        stin(ctx, cx + r * 0.45, cy + r * 0.55, r * 1.05, r * 0.95, 0.5);
        ctx.fillStyle = radial(ctx, cx, cy, r * 1.15, '#d8d0c0', '#6b645a');
        ctx.beginPath(); ctx.arc(cx, cy, r * 1.1, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(40,34,28,0.55)'; ctx.lineWidth = Math.max(1, L * 0.03);
        ctx.beginPath(); ctx.arc(cx, cy, r * 0.8, 0, Math.PI * 2); ctx.stroke();
        kruh(ctx, cx - r * 0.25, cy - r * 0.25, r * 0.28, 'rgba(255,250,235,0.5)');
        break;
      }
      case O.OLTAR: {
        const w = L * 1.7, hh = L * 0.85;
        ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(cx - w / 2 + L * 0.12, cy - hh / 2 + L * 0.15, w, hh);
        ctx.fillStyle = '#7d7468'; ctx.fillRect(cx - w / 2, cy - hh / 2, w, hh);
        ctx.fillStyle = '#a69c8d'; ctx.fillRect(cx - w / 2 + L * 0.08, cy - hh / 2 + L * 0.08, w - L * 0.16, hh - L * 0.16);
        ctx.fillStyle = '#d9b24a';
        for (let k = 0; k < 5; k++) ctx.fillRect(cx - w / 2 + L * (0.25 + k * 0.28), cy - L * 0.06, L * 0.12, L * 0.12);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, L * 1.2);
        g.addColorStop(0, 'rgba(255,210,120,0.18)'); g.addColorStop(1, 'rgba(255,210,120,0)');
        ctx.fillStyle = g; ctx.fillRect(cx - L * 1.2, cy - L * 1.2, L * 2.4, L * 2.4);
        break;
      }
      case O.DESKA: {
        const w = L * 0.62, hh = L * 0.4;
        ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(cx - w / 2 + L * 0.08, cy - hh / 2 + L * 0.1, w, hh);
        ctx.fillStyle = '#3a3f4a'; ctx.fillRect(cx - w / 2, cy - hh / 2, w, hh);
        ctx.strokeStyle = '#7ee0f0'; ctx.lineWidth = Math.max(1, L * 0.035);
        ctx.beginPath();
        for (let k = 0; k < 4; k++) {
          const x0 = cx - w / 2 + L * (0.09 + k * 0.13);
          ctx.moveTo(x0, cy - hh * 0.3); ctx.lineTo(x0 + L * 0.06, cy + hh * 0.3 * (k & 1 ? 1 : -0.2));
        }
        ctx.stroke();
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, L * 0.9);
        g.addColorStop(0, 'rgba(120,230,250,0.2)'); g.addColorStop(1, 'rgba(120,230,250,0)');
        ctx.fillStyle = g; ctx.fillRect(cx - L, cy - L, L * 2, L * 2);
        break;
      }
      case O.POKLAD: {
        const w = L * 0.6, hh = L * 0.42;
        ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(cx - w / 2 + L * 0.08, cy - hh / 2 + L * 0.1, w, hh);
        ctx.fillStyle = '#6e4322'; ctx.fillRect(cx - w / 2, cy - hh / 2, w, hh);
        ctx.fillStyle = '#c9a03c'; ctx.fillRect(cx - w / 2, cy - L * 0.04, w, L * 0.08); ctx.fillRect(cx - L * 0.05, cy - hh / 2, L * 0.1, hh);
        for (let k = 0; k < 5; k++) kruh(ctx, cx + (hp(k, x) - 0.5) * L * 0.9, cy + hh * 0.6 + hp(x, k) * L * 0.15, L * 0.05, '#f0cc55');
        break;
      }
      case O.KOSTI: {
        ctx.strokeStyle = '#e4dccb'; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(1.5, L * 0.06);
        ctx.beginPath();
        for (let k = 0; k < 3; k++) {
          const a = h * 7 + k * 2.1, x0 = cx + (hp(k, y) - 0.5) * L * 0.5, y0 = cy + (hp(y, k) - 0.5) * L * 0.5;
          ctx.moveTo(x0, y0); ctx.lineTo(x0 + Math.cos(a) * L * 0.22, y0 + Math.sin(a) * L * 0.22);
        }
        ctx.stroke();
        kruh(ctx, cx + L * 0.15, cy - L * 0.12, L * 0.1, '#ece5d6');
        break;
      }
      case O.VYHEN: {
        const r = L * 1.45;
        stin(ctx, cx + L * 0.2, cy + L * 0.25, r, r * 0.95, 0.45);
        ctx.fillStyle = radial(ctx, cx, cy, r, '#5a5560', '#1c1a22'); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#6fb4c8'; ctx.lineWidth = Math.max(1, L * 0.05);
        ctx.beginPath(); ctx.arc(cx, cy, r * 0.82, 0, Math.PI * 2); ctx.stroke();
        for (let k = 0; k < 12; k++) {
          const a = k / 12 * Math.PI * 2;
          ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r * 0.86, cy + Math.sin(a) * r * 0.86);
          ctx.lineTo(cx + Math.cos(a + 0.12) * r * 0.95, cy + Math.sin(a + 0.12) * r * 0.95); ctx.stroke();
        }
        ctx.fillStyle = radial(ctx, cx, cy, r * 0.55, '#3b3439', '#141016'); ctx.beginPath(); ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2); ctx.fill();
        for (let k = 0; k < 9; k++) kruh(ctx, cx + (hp(k, 3) - 0.5) * r * 0.7, cy + (hp(3, k) - 0.5) * r * 0.7, L * 0.06, '#5a4c4a');
        break;
      }
      case O.BRANA: {
        if (sv.obj[i - sv.W] === O.BRANA) break;          // kreslí se jednou za oba řádky
        const x0 = x * L, y0 = y * L, hh = L * 2;
        ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(x0 + L * 0.1, y0, L * 0.9, hh);
        // otevřená křídla vrat
        ctx.fillStyle = '#5b3a20';
        ctx.save(); ctx.translate(x0 + L * 0.85, y0 + L * 0.08); ctx.rotate(0.9); ctx.fillRect(0, 0, L * 0.9, L * 0.16); ctx.restore();
        ctx.save(); ctx.translate(x0 + L * 0.85, y0 + hh - L * 0.08); ctx.rotate(-0.9); ctx.fillRect(0, -L * 0.16, L * 0.9, L * 0.16); ctx.restore();
        // kamenné pilíře
        for (const yy of [y0 - L * 0.22, y0 + hh - L * 0.3]) {
          ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(x0 + L * 0.08, yy + L * 0.1, L * 0.62, L * 0.52);
          ctx.fillStyle = '#9c9284'; ctx.fillRect(x0, yy, L * 0.62, L * 0.52);
          ctx.fillStyle = '#c9bfae'; ctx.fillRect(x0 + L * 0.06, yy + L * 0.06, L * 0.5, L * 0.12);
        }
        // runový práh
        ctx.fillStyle = '#6a6358'; ctx.fillRect(x0 + L * 0.2, y0 + L * 0.3, L * 0.18, hh - L * 0.6);
        ctx.fillStyle = 'rgba(120,220,240,0.6)';
        for (let k = 0; k < 4; k++) ctx.fillRect(x0 + L * 0.25, y0 + L * (0.45 + k * 0.3), L * 0.08, L * 0.14);
        break;
      }
      case O.SCHODY_DOLU: case O.SCHODY_NAHORU: {
        const x0 = x * L, y0 = y * L, n = 5, dolu = typ === O.SCHODY_DOLU;
        for (let k = 0; k < n; k++) {
          const t = k / (n - 1), s = dolu ? 1 - t * 0.75 : 0.45 + t * 0.55;
          ctx.fillStyle = `rgb(${150 * s | 0},${142 * s | 0},${128 * s | 0})`;
          ctx.fillRect(x0 + L * 0.06, y0 + L * (0.06 + k * 0.176), L * 0.88, L * 0.176);
          ctx.fillStyle = `rgba(255,250,235,${0.25 * s})`;
          ctx.fillRect(x0 + L * 0.06, y0 + L * (0.06 + k * 0.176), L * 0.88, L * 0.03);
        }
        ctx.strokeStyle = 'rgba(30,24,20,0.6)'; ctx.lineWidth = Math.max(1, L * 0.04);
        ctx.strokeRect(x0 + L * 0.06, y0 + L * 0.06, L * 0.88, L * 0.88);
        break;
      }
      case O.MOST: case O.MOST_ROZBITY: {
        const x0 = x * L, y0 = y * L, rozb = typ === O.MOST_ROZBITY;
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x0 + L * 0.1, y0 + L * 0.1, L, L);
        for (let k = 0; k < 5; k++) {
          if (rozb && hp(x * 5 + k, y) < 0.35) continue;
          const s = 0.8 + hp(k, x * 3 + y) * 0.3;
          ctx.fillStyle = `rgb(${128 * s | 0},${86 * s | 0},${50 * s | 0})`;
          ctx.save(); ctx.translate(x0 + L / 2, y0 + L * (0.1 + k * 0.2)); ctx.rotate(rozb ? (hp(k, y) - 0.5) * 0.25 : 0);
          ctx.fillRect(-L / 2, 0, L, L * 0.17); ctx.restore();
        }
        ctx.fillStyle = '#4a3020';
        const lx = sv.obj[i - 1] === typ, rx = sv.obj[i + 1] === typ;
        if (!lx) ctx.fillRect(x0, y0, L * 0.1, L);
        if (!rx) ctx.fillRect(x0 + L * 0.9, y0, L * 0.1, L);
        break;
      }
      case O.JECMEN: {
        ctx.strokeStyle = '#c9a94e'; ctx.lineWidth = Math.max(1, L * 0.03); ctx.lineCap = 'round';
        ctx.beginPath();
        for (let k = 0; k < 9; k++) {
          const x1 = cx + (hp(k, x) - 0.5) * L * 0.7, y1 = cy + (hp(y, k) - 0.5) * L * 0.6;
          ctx.moveTo(x1, y1); ctx.lineTo(x1 + L * 0.06, y1 - L * 0.18);
        }
        ctx.stroke();
        break;
      }
      case O.DIRA: case O.ZEBRIK: case O.SACHTA: {
        // jáma do patra pod: tmavý trychtýř s kamenným okrajem
        const r = L * 0.46;
        const g = ctx.createRadialGradient(cx + L * 0.05, cy + L * 0.06, r * 0.1, cx, cy, r);
        g.addColorStop(0, '#000'); g.addColorStop(0.7, '#0b0a0d'); g.addColorStop(1, '#2e2925');
        ctx.fillStyle = g; ctx.beginPath();
        for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2, rr = r * (0.9 + 0.14 * hp(k, x * 31 + y)); ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(150,140,125,0.7)'; ctx.lineWidth = Math.max(1, L * 0.04); ctx.stroke();
        if (typ === O.ZEBRIK) {
          ctx.strokeStyle = '#8a5a30'; ctx.lineWidth = Math.max(1.5, L * 0.07); ctx.lineCap = 'butt';
          ctx.beginPath(); ctx.moveTo(cx - L * 0.16, cy - L * 0.4); ctx.lineTo(cx - L * 0.16, cy + L * 0.3);
          ctx.moveTo(cx + L * 0.16, cy - L * 0.4); ctx.lineTo(cx + L * 0.16, cy + L * 0.3); ctx.stroke();
          ctx.lineWidth = Math.max(1, L * 0.05); ctx.strokeStyle = '#a8763f'; ctx.beginPath();
          for (let k = 0; k < 4; k++) { const yy = cy - L * 0.32 + k * L * 0.17; ctx.moveTo(cx - L * 0.16, yy); ctx.lineTo(cx + L * 0.16, yy); }
          ctx.stroke();
        } else if (typ === O.SACHTA) {
          // rám z trámů a rumpál s lanem
          ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(cx - L * 0.44, cy - L * 0.36, L * 0.94, L * 0.84);
          ctx.strokeStyle = '#6b4424'; ctx.lineWidth = Math.max(2, L * 0.09);
          ctx.strokeRect(cx - L * 0.44, cy - L * 0.44, L * 0.88, L * 0.88);
          ctx.fillStyle = '#9a6a3a'; ctx.fillRect(cx - L * 0.46, cy - L * 0.08, L * 0.92, L * 0.16);
          ctx.fillStyle = '#c99a5c'; ctx.fillRect(cx - L * 0.46, cy - L * 0.08, L * 0.92, L * 0.04);
          ctx.fillStyle = '#5a3a20'; ctx.fillRect(cx + L * 0.36, cy - L * 0.22, L * 0.08, L * 0.18);   // klika
          ctx.strokeStyle = '#d8c79c'; ctx.lineWidth = Math.max(1, L * 0.03);
          ctx.beginPath(); ctx.moveTo(cx, cy + L * 0.08); ctx.lineTo(cx, cy + L * 0.3); ctx.stroke();
        }
        break;
      }
      case O.PAREZ: {
        stin(ctx, cx + L * 0.08, cy + L * 0.1, L * 0.24, L * 0.2, 0.35);
        kruh(ctx, cx, cy, L * 0.2, '#6b4a2c'); kruh(ctx, cx, cy, L * 0.15, '#c9a578');
        break;
      }
    }
  }

  // --- vykreslovač ----------------------------------------------------------------------
  function vytvor(sv, volby) {
    const hook = volby && volby.stavby;
    const cache = new Map();          // klíč → { can, px }
    let obsazeno = 0;
    const klic = (p, bx, by, lod) => p + ',' + bx + ',' + by + ',' + lod;
    function vezmi(p, bx, by, lod, smiStavet) {
      const k = klic(p, bx, by, lod);
      let z = cache.get(k);
      if (z) { cache.delete(k); cache.set(k, z); return z.can; }
      if (!smiStavet) return null;
      const can = postavBlok(sv, p, bx, by, lod, hook), px = (BLOK * lod) ** 2;
      cache.set(k, { can, px }); obsazeno += px;
      for (const [kk, zz] of cache) {         // vyhoď nejdéle nepoužité
        if (obsazeno <= ROZPOCET_PX) break;
        cache.delete(kk); obsazeno -= zz.px;
      }
      return can;
    }
    function zneplatni(p, x0, y0, x1, y1) {
      const bx0 = Math.floor((x0 - OKRAJ - 1) / BLOK), bx1 = Math.floor((x1 + OKRAJ + 1) / BLOK);
      const by0 = Math.floor((y0 - OKRAJ - 1) / BLOK), by1 = Math.floor((y1 + OKRAJ + 1) / BLOK);
      for (const [k, z] of cache) {
        const [pp, bx, by] = k.split(',').map(Number);
        if ((p == null || pp === p) && (x0 == null || (bx >= bx0 && bx <= bx1 && by >= by0 && by <= by1))) { cache.delete(k); obsazeno -= z.px; }
      }
    }
    // kam = { p, x, y (střed v polích), zoom }; vrací počet bloků, které ještě čekají na stavbu
    function kresli(ctx, kam, sirka, vyska, dpr, rozpocetMs) {
      const s = 64 * kam.zoom * dpr;
      let lod = LODY[LODY.length - 1];
      for (const l of LODY) if (l >= s * 0.92) { lod = l; break; }
      ctx.fillStyle = kam.p === 0 ? '#2b2824' : '#0a0c15';
      ctx.fillRect(0, 0, sirka, vyska);
      const x0 = kam.x - sirka / 2 / s, y0 = kam.y - vyska / 2 / s;
      const bx0 = Math.floor(x0 / BLOK), by0 = Math.floor(y0 / BLOK);
      const bx1 = Math.floor((x0 + sirka / s) / BLOK), by1 = Math.floor((y0 + vyska / s) / BLOK);
      const nbx = Math.ceil(sv.W / BLOK), nby = Math.ceil(sv.H / BLOK);
      const t0 = now();
      let ceka = 0;
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      // bloky od středu ven, ať se nejdřív staví to, na co se hráč dívá
      const poradi = [];
      for (let by = Math.max(0, by0); by <= Math.min(nby - 1, by1); by++)
        for (let bx = Math.max(0, bx0); bx <= Math.min(nbx - 1, bx1); bx++) {
          const dx = (bx + 0.5) * BLOK - kam.x, dy = (by + 0.5) * BLOK - kam.y;
          poradi.push([dx * dx + dy * dy, bx, by]);
        }
      poradi.sort((a, b) => a[0] - b[0]);
      for (const [, bx, by] of poradi) {
        let can = vezmi(kam.p, bx, by, lod, now() - t0 < (rozpocetMs == null ? 12 : rozpocetMs));
        if (!can) {
          ceka++;
          for (const l of LODY) if ((can = vezmi(kam.p, bx, by, l, false))) break;
          if (!can) continue;
        }
        const sx0 = Math.round((bx * BLOK - x0) * s), sy0 = Math.round((by * BLOK - y0) * s);
        const sx1 = Math.round(((bx + 1) * BLOK - x0) * s), sy1 = Math.round(((by + 1) * BLOK - y0) * s);
        ctx.drawImage(can, sx0, sy0, sx1 - sx0, sy1 - sy0);
      }
      return ceka;
    }
    return { kresli, zneplatni, statistika: () => ({ bloku: cache.size, mpx: +(obsazeno / 1e6).toFixed(1) }) };
  }
  const mz_r = mz => (mz ? mz.r : -1);
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  // --- minimapa: 1 pixel na pole ----------------------------------------------------------
  function hex(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function minimapa(sv, p, data) {
    const { W, H, N } = sv;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = p * N + y * W + x, o = (y * W + x) * 4;
      let c;
      if (sv.teren[i] === M.VOLNO && sv.zn[i]) {
        if (sv.kap[i]) c = sv.kapTyp[i] === K.MAGMA ? [224, 86, 29] : sv.kap[i] >= SV.HLUBOKA ? [36, 76, 130] : [70, 120, 170];
        else if (sv.obj[i] === O.JEDLE) c = [30, 66, 40];
        else {
          const pm = SV.PODLAHA[sv.podlaha[i]].mini;
          c = pm ? hex(pm) : SV.MATERIAL[sv.zaklad[i]].barva.map(v => v * 0.75);
        }
      } else {
        let blizko = p === 0;
        if (!blizko) {
          for (let dy = -1; dy <= 1 && !blizko; dy++) for (let dx = -1; dx <= 1; dx++) {
            const X = x + dx, Y = y + dy;
            if (X >= 0 && Y >= 0 && X < W && Y < H) { const j = p * N + Y * W + X; if (sv.teren[j] === M.VOLNO && sv.zn[j]) { blizko = true; break; } }
          }
        }
        if (blizko) {
          const m = sv.zaklad[i] === M.PODLOZI && p === 0 ? M.VAPENEC : sv.zaklad[i];
          c = hex(SV.MATERIAL[m].mini); if (p === 0) c = c.map(v => v * 0.8 + 20);
        } else c = [11, 13, 22];
      }
      data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = 255;
    }
  }

  S.kresba = { BLOK, LODY, vytvor, minimapa, postavBlok, textura };
})(SIN);

if (typeof module !== 'undefined') module.exports = SIN;
